import { ChangeDetectionStrategy, Component, computed, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatDateTime, formatDuration, toLocalIsoSeconds } from '../../shared/utils/format';
import { readClipboardImage } from '../../shared/utils/clipboard';
import { ocrErrorDetail, readReportImage } from '../enemies/report-ocr';
import {
  computeDistance,
  computeReturnRows,
  Coordinate,
  CLAN_VILLAGES,
  CounterAttack,
  counterArrivalMs,
  DistanceMode,
} from './travel.logic';
import { findVillage, MAP_VILLAGES } from '../../core/game-data/map-villages';

// Choix mémorisés dans le navigateur (si le stockage est disponible).
const ME_KEY = 'travel.me';
const CE_KEY = 'travel.ce';

const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix ne sera simplement pas retenu.
  }
};

@Component({
  selector: 'app-travel-page',
  imports: [FormsModule, Card, NumberInput, SegmentedControl],
  templateUrl: './travel-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:paste)': 'onPaste($event)' },
})
export class TravelPage implements OnDestroy {
  protected readonly modeOptions: readonly SegmentOption<DistanceMode>[] = [
    { id: 'manual', label: 'Saisie km directe' },
    { id: 'coords', label: 'Villages (1 / 2)' },
    { id: 'report', label: 'Calcul rapport' },
  ];
  protected readonly villageNames = MAP_VILLAGES.map((v) => v.name).sort((a, b) => a.localeCompare(b, 'fr'));

  protected readonly distanceMode = signal<DistanceMode>('manual');
  protected readonly manualDistance = signal<number | null>(5);
  protected readonly departureTime = signal(toLocalIsoSeconds(new Date()));

  // Mode « Coordonnées » : deux villages choisis dans la carte.
  private readonly originName = signal('');
  private readonly targetName = signal('');
  protected readonly villages = computed(() => [
    { n: 1, label: 'Village 1 (Départ / Source)', labelClass: 'text-red-300', name: this.originName, village: findVillage(this.originName()) },
    { n: 2, label: 'Village 2 (Cible / Arrivée)', labelClass: 'text-emerald-300', name: this.targetName, village: findVillage(this.targetName()) },
  ]);

  // Mode « Calcul rapport » : villages lus dans la capture (ou saisis), coordonnées prises dans la carte.
  protected readonly attackerName = signal('');
  protected readonly defenderName = signal('');
  protected readonly reportVillages = computed(() => [
    { label: 'Assaillant', labelClass: 'text-red-300', name: this.attackerName, village: findVillage(this.attackerName()) },
    { label: 'Défenseur', labelClass: 'text-emerald-300', name: this.defenderName, village: findVillage(this.defenderName()) },
  ]);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly reading = signal(false);
  protected readonly readWarning = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly pasteError = signal<string | null>(null);

  protected readonly distance = computed(() => {
    const mode = this.distanceMode();
    if (mode === 'manual') return computeDistance(mode, this.manualDistance(), { x: 0, y: 0 }, { x: 0, y: 0 });
    const [from, to] = (mode === 'coords' ? this.villages() : this.reportVillages()).map((v) => v.village);
    return from && to ? computeDistance(mode, null, from, to) : 0;
  });

  // Contre-attaque : mes troupes partent maintenant avec mon CE vers le village de l'assaillant.
  protected readonly clanVillages = CLAN_VILLAGES;
  /** Kage choisi dans « Qui es-tu ? » ('' = on suppose que je suis le défenseur). */
  protected readonly me = signal(readStored(ME_KEY) ?? '');
  protected readonly myVillage = computed(() => CLAN_VILLAGES.find((v) => v.kage === this.me()) ?? null);
  protected readonly ourLevel = signal<number | null>(Number(readStored(CE_KEY)) || 11);
  private readonly now = signal(Date.now());
  private readonly clock = setInterval(() => this.now.set(Date.now()), 1000);

  /** Village de l'assaillant, quand ses coordonnées sont connues (pas en saisie km directe). */
  private readonly attackerPoint = computed((): Coordinate | null => {
    switch (this.distanceMode()) {
      case 'coords':
        return this.villages()[0].village;
      case 'report':
        return this.reportVillages()[0].village;
      default:
        return null;
    }
  });

  /** Depuis mon village si je l'ai choisi et que l'assaillant est localisé ; sinon je suis le défenseur (même trajet, sens inverse). */
  protected readonly counterFromMyVillage = computed(() => !!this.myVillage() && !!this.attackerPoint());
  protected readonly counterDistance = computed(() => {
    const [mine, attacker] = [this.myVillage(), this.attackerPoint()];
    return mine && attacker ? computeDistance('coords', null, mine, attacker) : this.distance();
  });

  protected readonly counter = computed(
    (): CounterAttack => ({
      level: Math.min(20, Math.max(1, Math.floor(Number(this.ourLevel()) || 1))),
      distanceKm: this.counterDistance(),
      nowMs: this.now(),
    }),
  );
  protected readonly counterArrival = computed(() => formatDateTime(counterArrivalMs(this.counter())));

  protected readonly rows = computed(() => {
    const departure = this.departureTime();
    return computeReturnRows(this.distance(), departure ? new Date(departure).getTime() : Date.now(), this.counter());
  });

  /** "+12 min 30 s" d'avance, "−3 min" de retard. */
  protected formatMargin(ms: number): string {
    return `${ms >= 0 ? '+' : '−'}${formatDuration(Math.floor(Math.abs(ms) / 1000))}`;
  }

  protected setMe(kage: string): void {
    this.me.set(kage);
    writeStored(ME_KEY, kage);
  }

  protected setOurLevel(level: number | null): void {
    this.ourLevel.set(level);
    writeStored(CE_KEY, level === null ? '' : String(level));
  }

  protected setNow(): void {
    this.departureTime.set(toLocalIsoSeconds(new Date()));
  }

  protected onPaste(event: ClipboardEvent): void {
    if (this.distanceMode() !== 'report') return;
    const file = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      event.preventDefault();
      void this.analyze(file);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) void this.analyze(file);
  }

  /** Bouton « Coller » : indispensable sur iPhone, où le collage clavier n'atteint pas la page. */
  protected async pasteFromClipboard(): Promise<void> {
    this.pasteError.set(null);
    try {
      const image = await readClipboardImage();
      if (image) void this.analyze(image);
      else this.pasteError.set("Le presse-papiers ne contient pas d'image : copiez d'abord la capture du rapport.");
    } catch {
      this.pasteError.set('Accès au presse-papiers impossible : touchez la zone pour choisir la capture dans vos photos.');
    }
  }

  protected onFilePicked(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.analyze(file);
  }

  ngOnDestroy(): void {
    clearInterval(this.clock);
    this.setImage(null);
  }

  private async analyze(file: Blob): Promise<void> {
    this.pasteError.set(null);
    this.setImage(URL.createObjectURL(file));
    this.reading.set(true);
    this.readWarning.set(null);
    try {
      const { sections, attackedAt } = await readReportImage(file);
      const villageOf = (side: string) => sections.find((s) => s.side === side)?.village ?? '';
      this.attackerName.set(villageOf('Assaillant'));
      this.defenderName.set(villageOf('Défenseur'));
      if (attackedAt !== null) this.departureTime.set(toLocalIsoSeconds(new Date(attackedAt)));

      const missing = [
        !this.attackerName() && 'assaillant',
        !this.defenderName() && 'défenseur',
        attackedAt === null && "heure d'attaque",
      ].filter(Boolean);
      if (missing.length) this.readWarning.set(`Non lu dans la capture : ${missing.join(', ')}. Complétez à la main.`);
    } catch (e) {
      this.readWarning.set(
        `La lecture a échoué (connexion nécessaire au premier usage) : saisissez les valeurs à la main. Détail : ${ocrErrorDetail(e)}`,
      );
    } finally {
      this.reading.set(false);
    }
  }

  private setImage(url: string | null): void {
    const previous = this.imageUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.imageUrl.set(url);
  }
}
