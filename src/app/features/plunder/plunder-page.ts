import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { LevelInput } from '../../shared/ui/level-input';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatNumber } from '../../shared/utils/format';
import { TROOP_TYPES, TroopId } from './plunder.data';
import { planFullTeams, planPlunder, plunderCapacity, storageCapacity, Troops } from './plunder.logic';

type TroopCounts = Record<TroopId, number | null>;
const EMPTY_COUNTS: TroopCounts = { genin: 0, chunin: 0, jounin: 0 };
const DEPOT_MAX = 20;

type PlunderMode = 'opti' | 'max';

const clamp = (value: number | null, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));

@Component({
  selector: 'app-plunder-page',
  imports: [Card, NumberInput, LevelInput, SegmentedControl],
  templateUrl: './plunder-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlunderPage {
  protected readonly troopTypes = TROOP_TYPES;
  protected readonly formatNumber = formatNumber;
  protected readonly depotMax = DEPOT_MAX;
  protected readonly modes: SegmentOption<PlunderMode>[] = [
    { id: 'opti', label: 'Pillage opti' },
    { id: 'max', label: 'Pillage max' },
  ];
  protected readonly mode = signal<PlunderMode>('opti');

  protected readonly resourceDepotLevel = signal<number | null>(8);
  protected readonly foodDepotLevel = signal<number | null>(8);
  private readonly counts = signal<TroopCounts>({ ...EMPTY_COUNTS });

  protected readonly troops = computed(() => TROOP_TYPES.map((type) => ({ ...type, count: this.counts()[type.id] })));

  private readonly army = computed(
    (): Troops => ({
      genin: clamp(this.counts().genin, 0, Infinity),
      chunin: clamp(this.counts().chunin, 0, Infinity),
      jounin: clamp(this.counts().jounin, 0, Infinity),
    }),
  );

  protected readonly storage = computed(() =>
    storageCapacity(clamp(this.resourceDepotLevel(), 1, DEPOT_MAX), clamp(this.foodDepotLevel(), 1, DEPOT_MAX)),
  );

  protected readonly armyCapacity = computed(() => plunderCapacity(this.army()));
  protected readonly plan = computed(() => planPlunder(this.army(), this.storage().target));
  protected readonly fullPlan = computed(() => planFullTeams(this.army(), this.storage().target));
  protected readonly leftoverCapacity = computed(() => plunderCapacity(this.fullPlan().leftover));
  protected readonly fillPercent = computed(() => Math.round((this.fullPlan().capacity / this.storage().target) * 100));

  protected setCount(id: TroopId, value: number | null): void {
    const sanitized = value !== null && value < 0 ? 0 : value;
    this.counts.update((c) => ({ ...c, [id]: sanitized }));
  }

  protected reset(): void {
    this.counts.set({ ...EMPTY_COUNTS });
  }
}
