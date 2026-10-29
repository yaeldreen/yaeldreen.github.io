import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatDuration, formatNumber } from '../../shared/utils/format';
import { readStored, writeStored } from '../../shared/utils/storage';
import { findPlayer, NO_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { playerKey, TROOPS, TroopKey } from '../enemies/enemies.model';
import {
  Army,
  ArmyLevels,
  ATTACKER_LOSS_FACTOR,
  DEFENDER_LOSS_RANGE,
  DEFENSE_WINS,
  HOSPITAL_TICKET_BONUS,
  optimalAttack,
  PRODUCTION_MINUTES,
  sideStats,
  simulateCombat,
} from './combat.logic';

type LevelKey = keyof ArmyLevels;
type Side = 'attacker' | 'defender';
type Tab = 'simulation' | 'optimisation';

/** Nos niveaux pour l'optimisation (l'hôpital n'y est pas pris en compte). */
type MyLevelKey = 'training' | 'academy' | 'chunnin' | 'jounin';
interface MyForm {
  levels: Record<MyLevelKey, number | null>;
  combatTicket: boolean;
}

interface SideForm {
  troops: Record<TroopKey, number | null>;
  levels: Record<LevelKey, number | null>;
  hospitalTicket: boolean;
  combatTicket: boolean;
}

const LEVEL_MAX = 20;

const LEVEL_FIELDS: readonly { key: LevelKey; label: string; icon: string }[] = [
  { key: 'training', label: "Camp d'entraînement", icon: 'fa-dumbbell' },
  { key: 'academy', label: 'Académie', icon: 'fa-graduation-cap' },
  { key: 'chunnin', label: 'Centre Chuunin', icon: 'fa-user-ninja' },
  { key: 'jounin', label: 'Centre Jounin', icon: 'fa-user-shield' },
  { key: 'hospital', label: 'Hôpital', icon: 'fa-hospital' },
  { key: 'wall', label: "Mur d'enceinte", icon: 'fa-shield' },
];

const AVAILABLE_KEY = 'combat.available';
const MY_LEVELS_KEY = 'combat.myLevels';

/** Valeur JSON retenue dans ce navigateur, complétée par `fallback`. */
function stored<T extends object>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(readStored(key) ?? '{}') };
  } catch {
    return fallback;
  }
}

const clamp = (value: number | null, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));

const toArmy = ({ troops: t, levels: l, hospitalTicket, combatTicket }: SideForm): Army => {
  const count = (v: number | null) => clamp(v, 0, Infinity);
  const level = (v: number | null) => clamp(v, 0, LEVEL_MAX);
  return {
    troops: { genin: count(t.genin), chuunin: count(t.chuunin), jounin: count(t.jounin) },
    levels: {
      training: level(l.training),
      academy: level(l.academy),
      chunnin: level(l.chunnin),
      jounin: level(l.jounin),
      wall: level(l.wall),
      hospital: level(l.hospital),
    },
    hospitalTicket,
    combatTicket,
  };
};

/** Camp vide : la page démarre sans aucune valeur. */
const emptySide = (): SideForm => ({
  troops: { genin: null, chuunin: null, jounin: null },
  levels: { training: null, academy: null, chunnin: null, jounin: null, wall: null, hospital: null },
  hospitalTicket: false,
  combatTicket: false,
});

@Component({
  selector: 'app-combat-page',
  imports: [Card, NumberInput, SegmentedControl, NgTemplateOutlet, Combobox],
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
  protected readonly ticketBonus = HOSPITAL_TICKET_BONUS;
  protected readonly defenderRangePct = `${DEFENDER_LOSS_RANGE.min * 100} à ${DEFENDER_LOSS_RANGE.max * 100} %`;
  protected readonly defenseWins = {
    attacker: (DEFENSE_WINS.attackerFactor * 100).toFixed(0),
    defender: `${DEFENSE_WINS.defenderFactor.min * 100} à ${DEFENSE_WINS.defenderFactor.max * 100}`,
  };

  protected readonly tabOptions: readonly SegmentOption<Tab>[] = [
    { id: 'simulation', label: 'Simulation' },
    { id: 'optimisation', label: 'Optimisation attaque' },
  ];
  protected readonly tab = signal<Tab>('simulation');

  protected readonly attacker = signal<SideForm>(emptySide());
  protected readonly defender = signal<SideForm>(emptySide());

  protected readonly result = computed(() => simulateCombat(toArmy(this.attacker()), toArmy(this.defender())));

  // --- Joueur choisi pour chaque camp (infos enemis) ---

  private readonly store = inject(EnemiesStore);
  protected readonly playerOptions = computed((): ComboboxOption[] =>
    this.store
      .players()
      .map((p) => ({ value: p.name, hint: `${p.village} · ${p.clan ?? NO_CLAN}` }))
      .sort((a, b) => a.value.localeCompare(b.value, 'fr')),
  );
  protected readonly playerNames = signal<Record<Side, string>>({ attacker: '', defender: '' });
  /** Message sous le champ joueur : ce qui a été prérempli. */
  protected readonly loaded = signal<Record<Side, string | null>>({ attacker: null, defender: null });

  /**
   * Un joueur reconnu (nom ou village) préremplit son camp avec ce qu'on sait de lui (infos enemis) :
   * dernière armée connue et niveaux renseignés. Les cases inconnues sont vidées ; tout reste modifiable.
   */
  protected selectPlayer(side: Side, name: string): void {
    this.playerNames.update((n) => ({ ...n, [side]: name }));
    const match = findPlayer(this.store.players(), name);
    if (!match) {
      this.loaded.update((l) => ({ ...l, [side]: null }));
      return;
    }
    const p = match.player;
    const record = this.store.records()[playerKey(p.name)];
    const levels = { ...this[side]().levels };
    let knownLevels = 0;
    const fromPlayer: [LevelKey, number | null | undefined][] = [
      ['training', p.ce],
      ['academy', p.academy],
      ['chunnin', p.chunninCenter],
      ['jounin', p.jouninCenter],
      ['hospital', p.hospital],
      ['wall', p.wall],
    ];
    for (const [key, value] of fromPlayer) {
      levels[key] = value ?? null;
      if (value !== null && value !== undefined) knownLevels++;
    }

    this[side].update((f) => ({
      ...f,
      troops: record ? { ...record.troops } : { genin: null, chuunin: null, jounin: null },
      levels,
    }));
    const filled = (record ? TROOPS.length : 0) + knownLevels;
    this.loaded.update((l) => ({ ...l, [side]: `${p.name} (${p.village}) : ${filled} champ(s) prérempli(s).` }));
  }

  protected readonly sides = computed(() => [
    { id: 'attacker' as const, title: 'Assaillant', icon: 'fa-hand-fist', color: 'text-red-400', form: this.attacker(), fields: this.attackLevelFields, stats: this.result().attack, ticketLabel: 'Ticket attaque', recoveryRate: this.result().attackerRecoveryRate, playerName: this.playerNames().attacker, loaded: this.loaded().attacker },
    { id: 'defender' as const, title: 'Défenseur', icon: 'fa-shield-halved', color: 'text-emerald-400', form: this.defender(), fields: this.defenseLevelFields, stats: this.result().defense, ticketLabel: 'Ticket défense', recoveryRate: this.result().defenderRecoveryRate, playerName: this.playerNames().defender, loaded: this.loaded().defender },
  ]);

  protected setTroop(side: Side, key: TroopKey, value: number | null): void {
    this[side].update((f) => ({ ...f, troops: { ...f.troops, [key]: value } }));
  }

  protected setLevel(side: Side, key: LevelKey, value: number | null): void {
    this[side].update((f) => ({ ...f, levels: { ...f.levels, [key]: value } }));
  }

  protected setTicket(side: Side, ticket: 'hospitalTicket' | 'combatTicket', active: boolean): void {
    this[side].update((f) => ({ ...f, [ticket]: active }));
  }

  // --- Optimisation attaque : nos niveaux + armée disponible, contre la défense saisie ---

  protected readonly myLevelFields = LEVEL_FIELDS.filter(
    (f): f is { key: MyLevelKey; label: string; icon: string } => f.key !== 'wall' && f.key !== 'hospital',
  );
  protected readonly margin = signal<number | null>(10);
  protected readonly minutes = PRODUCTION_MINUTES;
  protected readonly formatDuration = formatDuration;
  /** Retenus dans ce navigateur. */
  protected readonly available = signal(stored<Record<TroopKey, number | null>>(AVAILABLE_KEY, { genin: null, chuunin: null, jounin: null }));
  protected readonly me = signal(
    stored<MyForm>(MY_LEVELS_KEY, { levels: { training: null, academy: null, chunnin: null, jounin: null }, combatTicket: false }),
  );

  /** Nos niveaux sous forme d'armée (troupes vides, hôpital ignoré). */
  private readonly myArmy = computed(() =>
    toArmy({
      troops: { genin: 0, chuunin: 0, jounin: 0 },
      levels: { ...this.me().levels, wall: 0, hospital: 0 },
      hospitalTicket: false,
      combatTicket: this.me().combatTicket,
    }),
  );

  protected readonly myPower = computed(() => sideStats(this.myArmy(), false));

  protected readonly optimal = computed(() => {
    const defender = toArmy(this.defender());
    if (this.result().defense.strength <= 0) return null;
    const a = this.available();
    const available = { genin: clamp(a.genin, 0, Infinity), chuunin: clamp(a.chuunin, 0, Infinity), jounin: clamp(a.jounin, 0, Infinity) };
    const { troops: _ignored, ...attacker } = this.myArmy();
    return optimalAttack(attacker, defender, available, Number(this.margin()) || 0);
  });

  protected setAvailable(key: TroopKey, value: number | null): void {
    this.available.update((a) => ({ ...a, [key]: value }));
    writeStored(AVAILABLE_KEY, JSON.stringify(this.available()));
  }

  protected setMyLevel(key: MyLevelKey, value: number | null): void {
    this.me.update((m) => ({ ...m, levels: { ...m.levels, [key]: value } }));
    writeStored(MY_LEVELS_KEY, JSON.stringify(this.me()));
  }

  protected setMyTicket(combatTicket: boolean): void {
    this.me.update((m) => ({ ...m, combatTicket }));
    writeStored(MY_LEVELS_KEY, JSON.stringify(this.me()));
  }

  /** Reporte l'armée proposée et nos niveaux dans l'onglet Simulation. */
  protected simulateOptimal(): void {
    const plan = this.optimal();
    if (!plan) return;
    const { levels, combatTicket } = this.me();
    this.attacker.update((f) => ({ ...f, troops: { ...plan.troops }, levels: { ...f.levels, ...levels }, combatTicket }));
    this.tab.set('simulation');
  }

  protected reset(): void {
    this.attacker.set(emptySide());
    this.defender.set(emptySide());
    this.playerNames.set({ attacker: '', defender: '' });
    this.loaded.set({ attacker: null, defender: null });
  }

  protected percent(rate: number): string {
    return `${(rate * 100).toFixed(1).replace('.', ',')} %`;
  }

  protected power(value: number): string {
    return formatNumber(Math.round(value));
  }
}
