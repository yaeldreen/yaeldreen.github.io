import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { formatNumber } from '../../shared/utils/format';
import { TROOPS, TroopKey } from '../enemies/enemies.model';
import { ArmyCard, PlayerPick } from '../combat/army-card';
import { emptySide, toArmy } from '../combat/army-form';
import { SideForm } from '../combat/combat-history';
import { sideStats } from '../combat/combat.logic';
import { loadRazHistory, pushRazHistory, RazEntry, saveRazHistory } from './raz-history';
import { planRaz, RazPlan } from './raz.logic';

interface Fighter {
  id: number;
  player: string;
  loaded: string | null;
  form: SideForm;
}

/** Raz simulé : figé au moment du clic sur « Simuler le raz ». */
interface RazReport {
  plan: RazPlan;
  names: string[];
  sent: Record<TroopKey, number>[];
  defenderName: string;
}

/**
 * Simu raz : plusieurs attaquants passent l'un après l'autre sur la même défense, dans l'ordre optimisé.
 * D'abord la saisie des armées, puis le rapport ; les 2 derniers raz sont gardés dans un cookie.
 */
@Component({
  selector: 'app-raz-page',
  imports: [Card, ArmyCard],
  templateUrl: './raz-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RazPage {
  private nextId = 1;
  private readonly newFighter = (form = emptySide(), player = ''): Fighter => ({ id: this.nextId++, player, loaded: null, form });

  protected readonly defender = signal<Fighter>(this.newFighter());
  protected readonly attackers = signal<Fighter[]>([this.newFighter()]);
  /** Attaquant dont la carte est dépliée ; les autres sont des volets fermés. */
  protected readonly openId = signal<number | null>(this.attackers()[0].id);
  /** Les soignés de l'hôpital du défenseur reviennent avant le passage suivant (hypothèse prudente). */
  protected readonly healedReturn = signal(true);

  protected readonly report = signal<RazReport | null>(null);
  /** Passage dont le rapport détaillé est ouvert. */
  protected readonly openPass = signal<number | null>(null);

  protected readonly summaries = computed(() =>
    this.attackers().map((a, i) => {
      const army = toArmy(a.form);
      return { id: a.id, name: a.player || `Attaquant ${i + 1}`, troops: army.troops, strength: sideStats(army, false).strength };
    }),
  );

  protected readonly defenderStrength = computed(() => sideStats(toArmy(this.defender().form), true).strength);
  protected readonly canSimulate = computed(() => this.defenderStrength() > 0 && this.summaries().some((s) => s.strength > 0));

  // --- Saisie ---

  protected setDefenderForm(form: SideForm): void {
    this.defender.update((d) => ({ ...d, form }));
  }

  protected selectDefender({ name, prefill }: PlayerPick): void {
    this.defender.update((d) => ({ ...d, player: name, loaded: prefill?.loaded ?? null, form: prefill?.form ?? d.form }));
  }

  protected setAttackerForm(id: number, form: SideForm): void {
    this.attackers.update((list) => list.map((a) => (a.id === id ? { ...a, form } : a)));
  }

  protected selectAttacker(id: number, { name, prefill }: PlayerPick): void {
    this.attackers.update((list) =>
      list.map((a) => (a.id === id ? { ...a, player: name, loaded: prefill?.loaded ?? null, form: prefill?.form ?? a.form } : a)),
    );
  }

  /** Le nouvel attaquant s'ouvre, le précédent se replie en volet. */
  protected addAttacker(): void {
    const fighter = this.newFighter();
    this.attackers.update((list) => [...list, fighter]);
    this.openId.set(fighter.id);
  }

  protected removeAttacker(id: number): void {
    this.attackers.update((list) => (list.length > 1 ? list.filter((a) => a.id !== id) : list));
    if (this.openId() === id) this.openId.set(null);
  }

  protected toggle(id: number): void {
    this.openId.update((open) => (open === id ? null : id));
  }

  protected reset(): void {
    this.defender.set(this.newFighter());
    const first = this.newFighter();
    this.attackers.set([first]);
    this.openId.set(first.id);
  }

  // --- Rapport ---

  protected simulate(): void {
    if (!this.canSimulate()) return;
    const attackers = this.attackers();
    const armies = attackers.map((a) => toArmy(a.form));
    this.report.set({
      plan: planRaz(armies, toArmy(this.defender().form), this.healedReturn()),
      names: this.summaries().map((s) => s.name),
      sent: armies.map((a) => a.troops),
      defenderName: this.defender().player || 'Défenseur',
    });
    this.openPass.set(null);
    this.history.update((h) =>
      pushRazHistory(h, {
        at: Date.now(),
        defender: { player: this.defender().player, form: this.defender().form },
        attackers: attackers.map((a) => ({ player: a.player, form: a.form })),
        healedReturn: this.healedReturn(),
      }),
    );
    saveRazHistory(this.history());
    window.scrollTo({ top: 0 });
  }

  protected backToArmies(): void {
    this.report.set(null);
    window.scrollTo({ top: 0 });
  }

  protected namesOf(report: RazReport, indexes: readonly number[]): string {
    return indexes.map((i) => report.names[i]).join(', ');
  }

  protected togglePass(index: number): void {
    this.openPass.update((open) => (open === index ? null : index));
  }

  // --- Historique : les 2 derniers raz ---

  protected readonly history = signal<RazEntry[]>(loadRazHistory());

  /** Remet les armées d'un raz passé et affiche son rapport. */
  protected loadFromHistory(entry: RazEntry): void {
    this.defender.set(this.newFighter(structuredClone(entry.defender.form), entry.defender.player));
    this.attackers.set(entry.attackers.map((a) => this.newFighter(structuredClone(a.form), a.player)));
    this.openId.set(null);
    this.healedReturn.set(entry.healedReturn);
    this.simulate();
  }

  protected historyLabel(entry: RazEntry): string {
    const date = new Date(entry.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `${date} · ${entry.defender.player || 'Défenseur'} · ${entry.attackers.length} attaquant(s)`;
  }

  // --- Affichage ---

  protected troopsOf(troops: Record<TroopKey, number>): string {
    return TROOPS.map((t) => formatNumber(troops[t.key])).join(' / ');
  }

  protected percent(rate: number): string {
    return `${(rate * 100).toFixed(1).replace('.', ',')} %`;
  }

  protected power(value: number): string {
    return formatNumber(Math.round(value));
  }

  protected readonly troopTypes = TROOPS;
  protected readonly formatNumber = formatNumber;
}
