import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { LevelInput } from '../../shared/ui/level-input';
import { NumberInput } from '../../shared/ui/number-input';
import { formatNumber } from '../../shared/utils/format';
import { NO_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { TROOPS, TroopKey } from '../enemies/enemies.model';
import { LEVEL_FIELDS, LEVEL_MAX, prefillFromPlayer, toArmy } from './army-form';
import { LevelKey, SideForm } from './combat-history';
import { HOSPITAL_TICKET_BONUS, recoveryRate, sideStats } from './combat.logic';

/** Ce que la carte remonte quand on choisit un joueur : son nom, et le camp prérempli s'il est reconnu. */
export interface PlayerPick {
  name: string;
  prefill: { form: SideForm; loaded: string } | null;
}

/** Carte de saisie d'une armée (assaillant ou défenseur) : joueur, troupes, niveaux et tickets. */
@Component({
  selector: 'app-army-card',
  imports: [Card, Combobox, NumberInput, LevelInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = stats();
    <app-card class="p-6 space-y-5">
      <div class="border-b border-stone-800 pb-3 flex justify-between items-center">
        @if (collapsible()) {
          <button type="button" (click)="collapse.emit()" class="font-semibold text-stone-200 flex items-center gap-2 cursor-pointer hover:text-white" aria-expanded="true">
            <span class="text-stone-500">▾</span> {{ title() }}
          </button>
        } @else {
          <h2 class="font-semibold text-stone-200 flex items-center">{{ title() }}</h2>
        }
        <span class="text-xs text-stone-400 flex items-center gap-3">
          <span>Force <span class="font-mono font-bold" [class]="color()">{{ power(s.strength) }}</span></span>
          @if (removable()) {
            <button type="button" (click)="remove.emit()" class="text-stone-500 hover:text-rose-400 cursor-pointer" aria-label="Retirer">✕</button>
          }
        </span>
      </div>

      <div>
        <label class="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Joueur</label>
        <app-combobox [value]="playerName()" (valueChange)="pickPlayer($event)" [options]="playerOptions()" placeholder="Choisir un joueur (facultatif)" />
        @if (loaded(); as info) {
          <p class="text-[11px] text-cyan-300 mt-1">{{ info }}</p>
        }
      </div>

      <div class="grid grid-cols-3 gap-3">
        @for (troop of troopTypes; track troop.key) {
          <div>
            <label class="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">{{ troop.label }}</label>
            <app-number-input [value]="form().troops[troop.key]" (valueChange)="setTroop(troop.key, $event)" [min]="0" placeholder="0" />
            <p class="text-[11px] text-stone-500 mt-1">
              Puissance <span class="font-mono text-stone-300">{{ power(s.unitPower[troop.key]) }}</span>
              (+{{ s.bonus[troop.key] }} %@if (form().combatTicket) { ×1,2 })
            </p>
          </div>
        }
      </div>

      <div class="grid grid-cols-2 gap-3 border-t border-stone-800 pt-5">
        @for (field of fields(); track field.key) {
          <div>
            <label class="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">{{ field.label }}</label>
            <app-level-input [value]="form().levels[field.key]" (valueChange)="setLevel(field.key, $event)" [min]="0" [max]="levelMax" placeholder="0" />
          </div>
        }
        <label class="col-span-2 flex items-center gap-2 text-xs text-stone-300 cursor-pointer select-none">
          <input type="checkbox" [checked]="form().combatTicket" (change)="setTicket('combatTicket', $any($event.target).checked)" class="accent-red-700 w-4 h-4 cursor-pointer" />
          {{ defending() ? 'Ticket défense' : 'Ticket attaque' }} activé (puissance ×1,2)
        </label>
        <label class="col-span-2 flex items-center gap-2 text-xs text-stone-300 cursor-pointer select-none">
          <input type="checkbox" [checked]="form().hospitalTicket" (change)="setTicket('hospitalTicket', $any($event.target).checked)" class="accent-red-700 w-4 h-4 cursor-pointer" />
          Ticket hôpital activé (+{{ ticketBonus }} %)
          <span class="ml-auto text-stone-400">Récupération <span class="font-mono font-bold text-emerald-300">{{ recovery() }} %</span></span>
        </label>
      </div>
    </app-card>
  `,
})
export class ArmyCard {
  readonly title = input.required<string>();
  /** Défenseur : le mur compte et le ticket est un ticket défense. */
  readonly defending = input(false);
  readonly color = input('text-red-400');
  readonly form = input.required<SideForm>();
  readonly playerName = input('');
  readonly loaded = input<string | null>(null);
  readonly removable = input(false);
  /** Le titre devient un bouton qui replie la carte (le parent affiche alors un résumé). */
  readonly collapsible = input(false);

  readonly formChange = output<SideForm>();
  readonly playerChange = output<PlayerPick>();
  readonly remove = output<void>();
  readonly collapse = output<void>();

  private readonly store = inject(EnemiesStore);
  protected readonly troopTypes = TROOPS;
  protected readonly levelMax = LEVEL_MAX;
  protected readonly ticketBonus = HOSPITAL_TICKET_BONUS;

  protected readonly fields = computed(() => (this.defending() ? LEVEL_FIELDS : LEVEL_FIELDS.filter((f) => f.key !== 'wall')));
  protected readonly stats = computed(() => sideStats(toArmy(this.form()), this.defending()));
  protected readonly recovery = computed(() => recoveryRate(toArmy(this.form())));
  protected readonly playerOptions = computed((): ComboboxOption[] =>
    this.store
      .players()
      .map((p) => ({ value: p.name, hint: `${p.village} · ${p.clan ?? NO_CLAN}` }))
      .sort((a, b) => a.value.localeCompare(b.value, 'fr')),
  );

  protected pickPlayer(name: string): void {
    this.playerChange.emit({ name, prefill: prefillFromPlayer(this.store.players(), this.store.records(), this.form(), name) });
  }

  protected setTroop(key: TroopKey, value: number | null): void {
    this.formChange.emit({ ...this.form(), troops: { ...this.form().troops, [key]: value } });
  }

  protected setLevel(key: LevelKey, value: number | null): void {
    this.formChange.emit({ ...this.form(), levels: { ...this.form().levels, [key]: value } });
  }

  protected setTicket(ticket: 'hospitalTicket' | 'combatTicket', active: boolean): void {
    this.formChange.emit({ ...this.form(), [ticket]: active });
  }

  protected power(value: number): string {
    return formatNumber(Math.round(value));
  }
}
