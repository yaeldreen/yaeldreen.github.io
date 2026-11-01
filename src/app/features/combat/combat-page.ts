import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, HostListener, inject, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { LevelInput } from '../../shared/ui/level-input';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatDuration, formatNumber } from '../../shared/utils/format';
import { readStored, writeStored } from '../../shared/utils/storage';
import { TROOPS, TroopKey } from '../enemies/enemies.model';
import { ArmyCard, PlayerPick } from './army-card';
import { clamp, emptySide, LEVEL_FIELDS, LEVEL_MAX, toArmy } from './army-form';
import { encodeHistory, HistoryEntry, HistorySide, loadHistory, pushHistory, saveHistory, SideForm } from './combat-history';
import {
  ATTACKER_LOSS_FACTOR,
  DEFENDER_LOSS_RANGE,
  DEFENSE_WINS,
  HOSPITAL_TICKET_BONUS,
  optimalAttack,
  PRODUCTION_MINUTES,
  sideStats,
  simulateCombat,
} from './combat.logic';

type Side = 'attacker' | 'defender';
type Tab = 'simulation' | 'optimisation';

/** Nos niveaux pour l'optimisation (l'hôpital n'y est pas pris en compte). */
type MyLevelKey = 'training' | 'academy' | 'chunnin' | 'jounin';
interface MyForm {
  levels: Record<MyLevelKey, number | null>;
  combatTicket: boolean;
}

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

@Component({
  selector: 'app-combat-page',
  imports: [Card, NumberInput, SegmentedControl, LevelInput, ArmyCard],
  templateUrl: './combat-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombatPage {
  protected readonly troopTypes = TROOPS;
  protected readonly formatNumber = formatNumber;
  protected readonly levelMax = LEVEL_MAX;
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

  protected readonly playerNames = signal<Record<Side, string>>({ attacker: '', defender: '' });
  /** Message sous le champ joueur : ce qui a été prérempli. */
  protected readonly loaded = signal<Record<Side, string | null>>({ attacker: null, defender: null });

  /** Un joueur reconnu préremplit son camp (voir `prefillFromPlayer`) ; tout reste modifiable. */
  protected selectPlayer(side: Side, { name, prefill }: PlayerPick): void {
    this.playerNames.update((n) => ({ ...n, [side]: name }));
    this.loaded.update((l) => ({ ...l, [side]: prefill?.loaded ?? null }));
    if (!prefill) return;
    this.historySession = null;
    this[side].set(prefill.form);
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

  // --- Historique : les 5 dernières simulations, enregistrées automatiquement dans un cookie de ce navigateur ---

  protected readonly history = signal<HistoryEntry[]>(loadHistory());
  protected readonly historyRows = computed(() =>
    this.history().map((entry) => ({ entry, result: simulateCombat(toArmy(entry.attacker.form), toArmy(entry.defender.form)) })),
  );

  /**
   * Entrée de la simulation en cours : tant qu'on modifie la même simulation, son entrée est mise à jour.
   * Une nouvelle entrée commence après « Tout remettre à zéro », un chargement depuis l'historique ou le choix d'un joueur.
   */
  private historySession: number | null = null;
  /** Contenu déjà enregistré (ou rechargé) : rien à faire tant qu'il ne change pas. */
  private lastSaved = '';
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly autoSave = effect(() => {
    const side = (s: Side): HistorySide => ({ player: this.playerNames()[s], form: this[s]() });
    const entry: HistoryEntry = { at: 0, attacker: side('attacker'), defender: side('defender') };
    const ready = this.result().ratio !== null;
    clearTimeout(this.saveTimer);
    if (!ready) return;
    // Attend une pause dans la saisie pour ne pas enregistrer chaque chiffre tapé.
    this.saveTimer = setTimeout(() => this.record(entry), 1500);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.saveTimer));
  }

  private record(entry: HistoryEntry): void {
    const key = encodeHistory([entry]);
    if (key === this.lastSaved) return;
    this.lastSaved = key;
    const at = Date.now();
    const session = this.historySession;
    this.history.update((h) => pushHistory(session === null ? h : h.filter((e) => e.at !== session), { ...entry, at }));
    this.historySession = at;
    saveHistory(this.history());
  }

  // Popup : on choisit une armée d'attaque et/ou une armée de défense, éventuellement de deux simulations différentes.
  protected readonly historyOpen = signal(false);
  protected readonly picked = signal<Record<Side, number | null>>({ attacker: null, defender: null });

  protected openHistory(): void {
    this.picked.set({ attacker: null, defender: null });
    this.historyOpen.set(true);
  }

  protected pick(side: Side, at: number): void {
    this.picked.update((p) => ({ ...p, [side]: p[side] === at ? null : at }));
  }

  protected applyPicked(): void {
    const picked = this.picked();
    for (const side of ['attacker', 'defender'] as const) {
      const entry = this.history().find((e) => e.at === picked[side]);
      if (!entry) continue;
      this[side].set(structuredClone(entry[side].form));
      this.playerNames.update((n) => ({ ...n, [side]: entry[side].player }));
      this.loaded.update((l) => ({ ...l, [side]: null }));
    }
    this.historySession = null;
    this.lastSaved = encodeHistory([{ at: 0, attacker: { player: this.playerNames().attacker, form: this.attacker() }, defender: { player: this.playerNames().defender, form: this.defender() } }]);
    this.tab.set('simulation');
    this.historyOpen.set(false);
  }

  protected removeFromHistory(at: number): void {
    this.history.update((h) => h.filter((e) => e.at !== at));
    this.picked.update((p) => ({ attacker: p.attacker === at ? null : p.attacker, defender: p.defender === at ? null : p.defender }));
    if (this.historySession === at) this.historySession = null;
    saveHistory(this.history());
  }

  @HostListener('document:keydown.escape')
  protected closeHistory(): void {
    this.historyOpen.set(false);
  }

  protected troopsSummary(form: SideForm): string {
    return TROOPS.map((t) => formatNumber(Number(form.troops[t.key]) || 0)).join(' / ');
  }

  protected historyDate(at: number): string {
    return new Date(at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  protected reset(): void {
    this.historySession = null;
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
