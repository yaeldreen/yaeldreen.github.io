import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RESOURCES, ResourceKey } from '../../core/game-data/resources';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { formatDateTime, formatDuration, formatNumber, toLocalIsoSeconds } from '../../shared/utils/format';
import { readStored, writeStored } from '../../shared/utils/storage';
import { FIELD_COUNTS, FIELD_MAX_LEVEL, timeSinceEmpty } from './production.logic';

type FieldLevels = Record<ResourceKey, (number | null)[]>;

const LEVELS_KEY = 'production.levels';

const clamp = (value: number | null): number => Math.min(FIELD_MAX_LEVEL, Math.max(0, Math.floor(Number(value) || 0)));

/** Niveaux mémorisés dans le navigateur, sinon tous les champs au niveau 0. */
function storedLevels(): FieldLevels {
  let saved: Partial<FieldLevels> = {};
  try {
    saved = JSON.parse(readStored(LEVELS_KEY) ?? '{}');
  } catch {
    // Valeur illisible : on repart de zéro.
  }
  return Object.fromEntries(
    RESOURCES.map(({ key }) => [key, Array.from({ length: FIELD_COUNTS[key] }, (_, i) => saved[key]?.[i] ?? 0)]),
  ) as FieldLevels;
}

@Component({
  selector: 'app-production-page',
  imports: [FormsModule, Card, NumberInput],
  templateUrl: './production-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionPage {
  protected readonly formatNumber = formatNumber;
  protected readonly formatDuration = formatDuration;
  protected readonly maxLevel = FIELD_MAX_LEVEL;

  protected readonly levels = signal<FieldLevels>(storedLevels());
  protected readonly amounts = signal<Record<ResourceKey, number | null>>({ stone: null, wood: null, iron: null, food: null });
  protected readonly time = signal(toLocalIsoSeconds(new Date()));

  protected readonly rows = computed(() => {
    const at = this.time() ? new Date(this.time()).getTime() : Date.now();
    return RESOURCES.map((resource) => {
      const fields = this.levels()[resource.key];
      const amount = this.amounts()[resource.key];
      const timing = timeSinceEmpty(fields.map(clamp), amount === null ? null : Math.max(0, amount), at);
      return { resource, fields, amount, ...timing, zero: timing.zeroAt === null ? null : formatDateTime(timing.zeroAt) };
    });
  });

  protected setLevel(key: ResourceKey, index: number, value: number | null): void {
    this.levels.update((all) => ({ ...all, [key]: all[key].map((l, i) => (i === index ? value : l)) }));
    writeStored(LEVELS_KEY, JSON.stringify(this.levels()));
  }

  protected setAmount(key: ResourceKey, value: number | null): void {
    this.amounts.update((a) => ({ ...a, [key]: value }));
  }

  protected setNow(): void {
    this.time.set(toLocalIsoSeconds(new Date()));
  }
}
