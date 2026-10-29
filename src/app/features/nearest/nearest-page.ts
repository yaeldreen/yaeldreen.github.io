import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { findVillage, villageOptions } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { OWN_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { clanVillages } from '../travel/travel.logic';
import { rankClanMembers } from './nearest.logic';

@Component({
  selector: 'app-nearest-page',
  imports: [Card, Combobox],
  templateUrl: './nearest-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NearestPage {
  protected readonly clan = OWN_CLAN;

  protected readonly store = inject(EnemiesStore);
  protected readonly villageOptions = computed((): ComboboxOption[] => villageOptions(this.store.villages()));
  private readonly members = computed(() => clanVillages(this.store.players(), this.store.villages()));

  protected readonly targetName = signal('');
  protected readonly target = computed(() => findVillage(this.store.villages(), this.targetName()));
  protected readonly ranking = computed(() => {
    const target = this.target();
    return target ? rankClanMembers(target, this.members()) : [];
  });
}
