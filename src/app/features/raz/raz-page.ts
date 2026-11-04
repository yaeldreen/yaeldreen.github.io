import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { formatNumber } from '../../shared/utils/format';
import { TROOPS, TroopKey } from '../enemies/enemies.model';
import { ArmyCard, PlayerPick } from '../combat/army-card';
import { toArmy } from '../combat/army-form';
import { SideForm } from '../combat/combat-history';
import { sideStats } from '../combat/combat.logic';
import { loadRazHistory, pushRazHistory, RazEntry, saveRazHistory } from './raz-history';
import { RazRoom } from './raz-room';
import { emptyRoom, newFighter } from './raz-room.logic';
import { planRaz, RazPlan } from './raz.logic';

/** Raz simulé, affiché à tout le monde jusqu'au retour aux armées. */
interface RazReport {
  plan: RazPlan;
  names: string[];
  sent: Record<TroopKey, number>[];
  defenderName: string;
}

/**
 * Simu raz : plusieurs attaquants passent l'un après l'autre sur la même défense, dans l'ordre optimisé.
 * D'abord la saisie des armées, puis le rapport. Armées et rapport sont partagés en direct (voir RazRoom) ;
 * les 2 derniers raz de chacun restent dans un cookie.
 */
@Component({
  selector: 'app-raz-page',
  imports: [Card, ArmyCard],
  providers: [RazRoom],
  templateUrl: './raz-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RazPage {
  private readonly room = inject(RazRoom);
  protected readonly status = this.room.status;
  protected readonly defender = this.room.defender;
  protected readonly attackers = this.room.attackers;
  /** Attaquant dont la carte est dépliée, propre à chacun ; les autres sont des volets fermés. */
  protected readonly openId = signal<number | null>(this.attackers()[0].id);

  constructor() {
    // Attaquant remplacé par quelqu'un d'autre : s'il n'en reste qu'un, on le déplie.
    effect(() => {
      const list = this.attackers();
      if (this.openId() !== null && !list.some((a) => a.id === this.openId())) this.openId.set(list.length === 1 ? list[0].id : null);
    });
  }

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
    this.room.editDefender((d) => ({ ...d, form }));
  }

  protected selectDefender({ name, prefill }: PlayerPick): void {
    this.room.editDefender((d) => ({ ...d, player: name, loaded: prefill?.loaded ?? null, form: prefill?.form ?? d.form }));
  }

  protected setAttackerForm(id: number, form: SideForm): void {
    this.room.editAttacker(id, (a) => ({ ...a, form }));
  }

  protected selectAttacker(id: number, { name, prefill }: PlayerPick): void {
    this.room.editAttacker(id, (a) => ({ ...a, player: name, loaded: prefill?.loaded ?? null, form: prefill?.form ?? a.form }));
  }

  /** Le nouvel attaquant s'ouvre, le précédent se replie en volet. */
  protected addAttacker(): void {
    const fighter = newFighter();
    this.room.addAttacker(fighter);
    this.openId.set(fighter.id);
  }

  protected removeAttacker(id: number): void {
    if (this.attackers().length > 1) this.room.removeAttacker(id);
    if (this.openId() === id) this.openId.set(null);
  }

  protected toggle(id: number): void {
    this.openId.update((open) => (open === id ? null : id));
  }

  protected reset(): void {
    if (!this.confirmShared('Tout remettre à zéro pour tout le monde ?')) return;
    const room = emptyRoom();
    this.room.replaceAll(room);
    this.openId.set(room.attackers[0].id);
  }

  /** Remplacer le raz en cours touche tout le monde : on ne demande confirmation que s'il est partagé. */
  private confirmShared(question: string): boolean {
    return this.status() !== 'live' || window.confirm(question);
  }

  // --- Rapport ---

  protected readonly report = computed((): RazReport | null => {
    if (!this.room.simulated() || !this.canSimulate()) return null;
    const armies = this.attackers().map((a) => toArmy(a.form));
    return {
      plan: planRaz(armies, toArmy(this.defender().form)),
      names: this.summaries().map((s) => s.name),
      sent: armies.map((a) => a.troops),
      defenderName: this.defender().player || 'Défenseur',
    };
  });

  protected simulate(): void {
    if (!this.canSimulate()) return;
    this.room.setSimulated(true);
    this.openPass.set(null);
    this.history.update((h) =>
      pushRazHistory(h, {
        at: Date.now(),
        defender: { player: this.defender().player, form: this.defender().form },
        attackers: this.attackers().map((a) => ({ player: a.player, form: a.form })),
      }),
    );
    saveRazHistory(this.history());
    window.scrollTo({ top: 0 });
  }

  protected backToArmies(): void {
    this.room.setSimulated(false);
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

  /** Remet les armées d'un raz passé pour tout le monde et affiche son rapport. */
  protected loadFromHistory(entry: RazEntry): void {
    if (!this.confirmShared('Remplacer le raz en cours pour tout le monde ?')) return;
    this.room.replaceAll({
      defender: newFighter(structuredClone(entry.defender.form), entry.defender.player),
      attackers: entry.attackers.map((a) => newFighter(structuredClone(a.form), a.player)),
      simulated: false,
    });
    this.openId.set(null);
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
