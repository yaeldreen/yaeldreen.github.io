import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RESOURCES } from '../../core/game-data/resources';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { formatNumber } from '../../shared/utils/format';
import { TROOP_TYPES, TroopId } from './plunder.data';

type TroopCounts = Record<TroopId, number | null>;
const EMPTY_COUNTS: TroopCounts = { genin: 0, chunin: 0, jounin: 0 };

@Component({
  selector: 'app-plunder-page',
  imports: [Card, NumberInput],
  templateUrl: './plunder-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlunderPage {
  protected readonly resources = RESOURCES;
  protected readonly formatNumber = formatNumber;

  private readonly counts = signal<TroopCounts>({ ...EMPTY_COUNTS });

  protected readonly troops = computed(() =>
    TROOP_TYPES.map((type) => {
      const count = this.counts()[type.id];
      return { ...type, count, max: (Number(count) || 0) * type.capacity };
    }),
  );

  /** Capacité totale, identique pour chaque ressource. */
  protected readonly totalCapacity = computed(() => this.troops().reduce((sum, t) => sum + t.max, 0));

  protected setCount(id: TroopId, value: number | null): void {
    const sanitized = value !== null && value < 0 ? 0 : value;
    this.counts.update((c) => ({ ...c, [id]: sanitized }));
  }

  protected reset(): void {
    this.counts.set({ ...EMPTY_COUNTS });
  }
}
