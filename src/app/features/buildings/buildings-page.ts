import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RESOURCES } from '../../core/game-data/resources';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { formatDuration, formatNumber } from '../../shared/utils/format';
import { parseDuration } from '../simulation/simulation.logic';
import { EFFECT_FIELDS, EffectField, levelEntries, levelForm, LevelForm, LevelRow, readLevelForm } from './building-levels';
import { BuildingLevelsStore } from './building-levels-store';
import { BUILDING_GUIDES, BuildingId, COMMON_COLUMNS } from './buildings.guides';

@Component({
  selector: 'app-buildings-page',
  imports: [Card, FormsModule, NumberInput],
  templateUrl: './buildings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildingsPage {
  protected readonly guides = BUILDING_GUIDES;
  protected readonly resources = RESOURCES;
  protected readonly formatNumber = formatNumber;
  protected readonly asRow = (row: unknown): LevelRow | undefined => row as LevelRow | undefined;

  protected readonly selectedId = signal<BuildingId>('hq');
  protected readonly guide = computed(() => BUILDING_GUIDES.find((g) => g.id === this.selectedId())!);
  /** Effets propres au bâtiment, affichés sous les coûts de chaque niveau. */
  protected readonly effects = computed(() => this.guide().columns.filter((c) => !COMMON_COLUMNS.has(c)));

  private readonly store = inject(BuildingLevelsStore);
  protected readonly entries = computed(() => {
    this.store.version();
    return levelEntries(this.guide().rows);
  });
  protected readonly effectFields = computed((): readonly EffectField[] => EFFECT_FIELDS[this.selectedId()] ?? []);

  /** Niveau en cours d'ajout ou de modification. */
  protected readonly editing = signal<number | null>(null);
  protected readonly form = signal<LevelForm>({ buildTime: '', numbers: {}, texts: {} });
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected selectBuilding(id: BuildingId): void {
    this.selectedId.set(id);
    this.cancel();
  }

  protected edit(level: number, row: LevelRow | undefined): void {
    this.form.set(levelForm(row, this.effectFields()));
    this.formError.set(null);
    this.editing.set(level);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.formError.set(null);
  }

  protected setBuildTime(buildTime: string): void {
    this.form.update((f) => ({ ...f, buildTime }));
  }

  protected setNumber(key: string, value: number | null): void {
    this.form.update((f) => ({ ...f, numbers: { ...f.numbers, [key]: value } }));
  }

  protected setText(key: string, value: string): void {
    this.form.update((f) => ({ ...f, texts: { ...f.texts, [key]: value } }));
  }

  protected async save(level: number): Promise<void> {
    const result = readLevelForm(level, this.form(), this.effectFields());
    if ('error' in result) {
      this.formError.set(result.error);
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      await this.store.saveLevel(this.selectedId(), result.row);
      this.editing.set(null);
    } catch (e) {
      this.formError.set(`Enregistrement refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.saving.set(false);
    }
  }

  protected buildTime(text: string): string {
    try {
      return formatDuration(parseDuration(text));
    } catch {
      return text;
    }
  }
}
