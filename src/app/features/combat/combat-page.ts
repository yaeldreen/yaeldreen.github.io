import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { formatNumber } from '../../shared/utils/format';
import { TROOPS, TroopKey } from '../enemies/enemies.model';
import { Army, ArmyLevels, ATTACKER_LOSS_FACTOR, DEFENDER_LOSS_RANGE, simulateCombat } from './combat.logic';

type LevelKey = keyof ArmyLevels;
type Side = 'attacker' | 'defender';

interface SideForm {
  troops: Record<TroopKey, number | null>;
  levels: Record<LevelKey, number | null>;
}

const LEVEL_MAX = 20;

const LEVEL_FIELDS: readonly { key: LevelKey; label: string; icon: string }[] = [
  { key: 'training', label: "Camp d'entraînement", icon: 'fa-dumbbell' },
  { key: 'academy', label: 'Académie', icon: 'fa-graduation-cap' },
  { key: 'chunnin', label: 'Centre Chuunin', icon: 'fa-user-ninja' },
  { key: 'jounin', label: 'Centre Jounin', icon: 'fa-user-shield' },
  { key: 'wall', label: "Mur d'enceinte", icon: 'fa-shield' },
];

const clamp = (value: number | null, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));

const toArmy = ({ troops: t, levels: l }: SideForm): Army => {
  const count = (v: number | null) => clamp(v, 0, Infinity);
  const level = (v: number | null) => clamp(v, 0, LEVEL_MAX);
  return {
    troops: { genin: count(t.genin), chuunin: count(t.chuunin), jounin: count(t.jounin) },
    levels: { training: level(l.training), academy: level(l.academy), chunnin: level(l.chunnin), jounin: level(l.jounin), wall: level(l.wall) },
  };
};

// Pré-rempli avec le rapport Guerre → Matrice du 19/10.
const ATTACKER_DEFAULT: SideForm = {
  troops: { genin: 1108, chuunin: 703, jounin: 114 },
  levels: { training: 5, academy: 8, chunnin: 8, jounin: 5, wall: 0 },
};
const DEFENDER_DEFAULT: SideForm = {
  troops: { genin: 693, chuunin: 414, jounin: 53 },
  levels: { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 },
};

@Component({
  selector: 'app-combat-page',
  imports: [Card, NumberInput],
  templateUrl: './combat-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombatPage {
  protected readonly troopTypes = TROOPS;
  protected readonly formatNumber = formatNumber;
  protected readonly levelMax = LEVEL_MAX;
  protected readonly attackLevelFields = LEVEL_FIELDS.filter((f) => f.key !== 'wall');
  protected readonly defenseLevelFields = LEVEL_FIELDS;
  protected readonly lossFactorPct = (ATTACKER_LOSS_FACTOR * 100).toFixed(1);
  protected readonly defenderRangePct = `${DEFENDER_LOSS_RANGE.min * 100} à ${DEFENDER_LOSS_RANGE.max * 100} %`;

  protected readonly attacker = signal<SideForm>(structuredClone(ATTACKER_DEFAULT));
  protected readonly defender = signal<SideForm>(structuredClone(DEFENDER_DEFAULT));

  protected readonly result = computed(() => simulateCombat(toArmy(this.attacker()), toArmy(this.defender())));

  protected readonly sides = computed(() => [
    { id: 'attacker' as const, title: 'Assaillant', icon: 'fa-hand-fist', color: 'text-red-400', form: this.attacker(), fields: this.attackLevelFields, stats: this.result().attack },
    { id: 'defender' as const, title: 'Défenseur', icon: 'fa-shield-halved', color: 'text-emerald-400', form: this.defender(), fields: this.defenseLevelFields, stats: this.result().defense },
  ]);

  protected setTroop(side: Side, key: TroopKey, value: number | null): void {
    this[side].update((f) => ({ ...f, troops: { ...f.troops, [key]: value } }));
  }

  protected setLevel(side: Side, key: LevelKey, value: number | null): void {
    this[side].update((f) => ({ ...f, levels: { ...f.levels, [key]: value } }));
  }

  protected reset(): void {
    const empty = (): SideForm => ({
      troops: { genin: 0, chuunin: 0, jounin: 0 },
      levels: { training: 0, academy: 0, chunnin: 0, jounin: 0, wall: 0 },
    });
    this.attacker.set(empty());
    this.defender.set(empty());
  }

  protected percent(rate: number): string {
    return `${(rate * 100).toFixed(1).replace('.', ',')} %`;
  }

  protected power(value: number): string {
    return formatNumber(Math.round(value));
  }
}
