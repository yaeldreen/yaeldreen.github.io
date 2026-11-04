import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { findVillage, MapVillage, villageOptions } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatNumber } from '../../shared/utils/format';
import { readStored, writeStored } from '../../shared/utils/storage';
import { OWN_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { rankClanMembers } from '../nearest/nearest.logic';
import { computeDistance } from '../travel/travel.logic';
import { groupOf, MAP_SIZE, mapPoint, mapScale, MapView, NEUTRAL_GROUP, radarGroups, viewBox, zoomView } from './radar.logic';

const ORIGIN_KEY = 'radar.origin';
const HIDDEN_KEY = 'radar.hidden';
const RADII = [5, 10, 15, 20, 25, 30];
const HOME_VIEW: MapView = { zoom: 1, panX: 0, panY: 0 };
/** Un doigt qui bouge moins que ça (en pixels) tape un village au lieu de déplacer la carte. */
const DRAG_THRESHOLD = 5;

const savedHidden = (): string[] => {
  try {
    return JSON.parse(readStored(HIDDEN_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** Radar : la carte autour d'un village, les groupes affichés au choix, et les villages proches dans un rayon. */
@Component({
  selector: 'app-radar-page',
  imports: [Card, Combobox, SegmentedControl],
  templateUrl: './radar-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadarPage {
  protected readonly store = inject(EnemiesStore);
  protected readonly formatNumber = formatNumber;
  protected readonly neutralGroup = NEUTRAL_GROUP;
  protected readonly mapSize = MAP_SIZE;
  protected readonly villageOptions = computed((): ComboboxOption[] => villageOptions(this.store.villages()));

  // --- Village au centre ---

  /** Saisie en cours ; le centre ne change que sur un village reconnu. */
  private readonly typed = signal<string | null>(null);
  private readonly originName = signal(readStored(ORIGIN_KEY) ?? '');
  protected readonly origin = computed((): MapVillage | null => {
    const villages = this.store.villages();
    const own = villages.filter((v) => v.clan === OWN_CLAN).sort((a, b) => a.kage.localeCompare(b.kage, 'fr'));
    return findVillage(villages, this.originName()) ?? own[0] ?? villages[0] ?? null;
  });
  protected readonly originText = computed(() => this.typed() ?? this.origin()?.name ?? '');
  protected readonly originUnknown = computed(() => {
    const typed = this.typed();
    return !!typed && !findVillage(this.store.villages(), typed);
  });

  protected typeOrigin(name: string): void {
    this.typed.set(name);
    const village = findVillage(this.store.villages(), name);
    if (village) this.center(village, false);
  }

  /** `clearText` : le centre vient d'ailleurs que du champ, qui doit afficher son nom. */
  protected center(village: MapVillage, clearText = true): void {
    if (clearText) this.typed.set(null);
    this.originName.set(village.name);
    writeStored(ORIGIN_KEY, village.name);
    this.selected.set(null);
    this.view.set(HOME_VIEW);
  }

  // --- Groupes affichés ---

  private readonly hidden = signal<readonly string[]>(savedHidden());
  protected readonly groups = computed(() => radarGroups(this.store.villages()));
  protected readonly shownCount = computed(() => this.groups().filter((g) => this.isShown(g.name)).length);
  private readonly colors = computed(() => new Map(this.groups().map((g) => [g.name, g.color])));

  protected isShown(group: string): boolean {
    return !this.hidden().includes(group);
  }

  protected setShown(group: string, shown: boolean): void {
    this.setHidden(shown ? this.hidden().filter((g) => g !== group) : [...this.hidden(), group]);
  }

  protected setAllShown(shown: boolean): void {
    this.setHidden(shown ? [] : this.groups().map((g) => g.name));
  }

  private setHidden(hidden: readonly string[]): void {
    this.hidden.set(hidden);
    writeStored(HIDDEN_KEY, JSON.stringify(hidden));
    const selected = this.selected();
    if (selected && !hidden.includes(groupOf(selected))) return;
    this.selected.set(null);
  }

  /** Villages des groupes cochés, sans le village au centre. */
  private readonly visible = computed(() => {
    const origin = this.origin();
    return this.store.villages().filter((v) => v.name !== origin?.name && this.isShown(groupOf(v)));
  });

  // --- Carte ---

  protected readonly view = signal<MapView>(HOME_VIEW);
  protected readonly viewBox = computed(() => viewBox(this.view()));
  protected readonly zoomPercent = computed(() => Math.round(this.view().zoom * 100));
  /** Points et textes grossissent moins vite que la carte, pour séparer les villages proches en zoomant. */
  protected readonly unit = computed(() => 1 / Math.pow(this.view().zoom, 0.7));
  protected readonly showLabels = computed(() => this.view().zoom >= 3);
  private readonly scale = computed(() => {
    const origin = this.origin();
    return origin ? mapScale(origin, this.visible()) : 1;
  });

  protected readonly points = computed(() => {
    const origin = this.origin();
    if (!origin) return [];
    return this.visible().map((village) => ({
      village,
      ...mapPoint(village, origin, this.scale()),
      color: this.colors().get(groupOf(village)) ?? '#7d93a6',
      neutral: village.neutral,
    }));
  });

  /** Cercles de distance tous les 10 km, jusqu'au bord de la carte. */
  protected readonly rings = computed(() => {
    const extent = 300 / this.scale();
    return Array.from({ length: Math.floor(extent / 10) }, (_, i) => ({ km: (i + 1) * 10, r: (i + 1) * 10 * this.scale() }));
  });
  protected readonly radiusRing = computed(() => this.radius() * this.scale());

  protected zoomBy(factor: number): void {
    this.view.update((v) => zoomView(v, v.zoom * factor));
  }

  protected resetView(): void {
    this.view.set(HOME_VIEW);
  }

  private readonly mapEl = viewChild.required<ElementRef<SVGSVGElement>>('map');
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragMoved = false;
  private pinchDistance = 0;

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.mapEl().nativeElement.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    this.view.update((v) => zoomView(v, v.zoom * factor, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height));
  }

  protected onPointerDown(event: PointerEvent): void {
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) this.dragMoved = false;
    if (this.pointers.size === 2) {
      this.dragMoved = true;
      this.pinchDistance = this.pointerGap();
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const rect = this.mapEl().nativeElement.getBoundingClientRect();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      const gap = this.pointerGap();
      if (this.pinchDistance > 0) this.view.update((v) => zoomView(v, (v.zoom * gap) / this.pinchDistance));
      this.pinchDistance = gap;
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (!this.dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      // Le petit mouvement reste compté depuis le point de départ.
      this.pointers.set(event.pointerId, previous);
      return;
    }
    this.dragMoved = true;
    this.view.update((v) => ({ ...v, panX: v.panX - (dx * MAP_SIZE) / (v.zoom * rect.width), panY: v.panY - (dy * MAP_SIZE) / (v.zoom * rect.height) }));
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
  }

  private pointerGap(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // --- Fiche d'un village ---

  protected readonly selected = signal<MapVillage | null>(null);
  protected readonly selectedDistance = computed(() => {
    const [selected, origin] = [this.selected(), this.origin()];
    return selected && origin ? computeDistance('coords', null, origin, selected) : 0;
  });

  protected tapVillage(village: MapVillage): void {
    if (!this.dragMoved) this.selected.set(village);
  }

  protected groupName(village: MapVillage): string {
    return groupOf(village);
  }

  protected groupColor(village: MapVillage): string {
    return this.colors().get(groupOf(village)) ?? '#7d93a6';
  }

  // --- Villages proches ---

  protected readonly radiusOptions: SegmentOption<string>[] = RADII.map((km) => ({ id: String(km), label: `${km} km` }));
  protected readonly radiusId = signal('10');
  protected readonly radius = computed(() => Number(this.radiusId()));
  protected readonly nearby = computed(() => {
    const origin = this.origin();
    return origin ? rankClanMembers(origin, this.visible()).filter((entry) => entry.distance <= this.radius()) : [];
  });
}
