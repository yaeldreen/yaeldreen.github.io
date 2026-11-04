import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { findVillage, villageOptions } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { NO_CLAN, OWN_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { clanVillages, playerVillages } from '../travel/travel.logic';
import { rankClanMembers } from './nearest.logic';

const ALL_PLAYERS = 'Tous les joueurs';

@Component({
  selector: 'app-nearest-page',
  imports: [FormsModule, Card, Combobox],
  templateUrl: './nearest-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NearestPage {
  protected readonly store = inject(EnemiesStore);
  /** Revient à notre clan à chaque ouverture de la page. */
  protected readonly clan = signal<string>(OWN_CLAN);
  protected readonly clanOptions = computed(() => {
    const clans = this.store.players().flatMap((p) => (p.clan ? [p.clan] : []));
    return [ALL_PLAYERS, ...[...new Set([OWN_CLAN, ...clans])].sort((a, b) => a.localeCompare(b, 'fr')), NO_CLAN];
  });
  protected readonly villageOptions = computed((): ComboboxOption[] => villageOptions(this.store.villages()));
  private readonly members = computed(() => {
    const clan = this.clan();
    if (clan === ALL_PLAYERS) return playerVillages(this.store.players(), this.store.villages());
    return clanVillages(this.store.players(), this.store.villages(), clan === NO_CLAN ? null : clan);
  });

  protected readonly targetName = signal('');
  protected readonly target = computed(() => findVillage(this.store.villages(), this.targetName()));
  protected readonly ranking = computed(() => {
    const target = this.target();
    return target ? rankClanMembers(target, this.members()) : [];
  });
}
