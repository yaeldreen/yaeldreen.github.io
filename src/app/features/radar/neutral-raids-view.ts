import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MapVillage } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { readStored, writeStored } from '../../shared/utils/storage';
import { NO_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { computeDistance } from '../travel/travel.logic';
import { NeutralRaidsStore } from './neutral-raids-store';
import { NeutralRaid, parseRaidsExport, raidedVillages, raidTime, sortedRaids } from './neutral-raids.logic';
import { GAME_URL } from './radar.logic';

const HIDDEN_CLANS_KEY = 'raids.hiddenClans';
/** Attaquant dont le village n'est pas sur la carte : son clan est inconnu. */
export const UNKNOWN_CLAN = 'Hors carte';

const savedHiddenClans = (): string[] => {
  try {
    return JSON.parse(readStored(HIDDEN_CLANS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** Page « Retours » préremplie : de l'attaquant vers le village neutre, à l'heure de l'impact. */
const retourParams = (from: MapVillage, target: MapVillage, raid: NeutralRaid) => ({ from: from.name, to: target.name, at: raid.at });

/** Vue « Villages neutres » du Radar : les attaques relevées dans l'historique de chaque village neutre du jeu. */
@Component({
  selector: 'app-neutral-raids-view',
  imports: [Card, FormsModule, RouterLink],
  templateUrl: './neutral-raids-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeutralRaidsView {
  protected readonly raidsStore = inject(NeutralRaidsStore);
  private readonly villagesStore = inject(EnemiesStore);
  protected readonly raidTime = raidTime;
  protected readonly gameOrigin = GAME_URL;

  protected readonly raidsText = signal('');
  protected readonly saving = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly villageFilter = signal<number | null>(null);
  protected readonly villages = computed(() => raidedVillages(this.raidsStore.raids()));
  /** Villages de la carte par identifiant du jeu : le neutre attaqué et le village de l'attaquant. */
  private readonly villagesById = computed(() => new Map(this.villagesStore.villages().flatMap((v) => (v.gameId !== undefined ? [[v.gameId, v]] : []))));
  /** Toutes les attaques du village choisi, avec le clan actuel de l'attaquant (d'après la carte). */
  private readonly allRows = computed(() => {
    const byId = this.villagesById();
    return sortedRaids(this.raidsStore.raids(), this.villageFilter()).map((raid) => {
      const [target, from] = [byId.get(raid.village), byId.get(raid.attackerVillageId)];
      return {
        raid,
        clan: from ? (from.clan ?? NO_CLAN) : UNKNOWN_CLAN,
        distance: target && from ? computeDistance('coords', null, from, target) : null,
        retour: target && from ? retourParams(from, target, raid) : null,
      };
    });
  });

  /** Clans décochés : leurs attaques sont retirées du tableau (choix retenu sur cet appareil). */
  protected readonly hiddenClans = signal<readonly string[]>(savedHiddenClans());
  /** Clans des attaquants, du plus actif au moins actif, « Sans Clans » et « Hors carte » à la fin. */
  protected readonly clans = computed(() => {
    const counts = new Map<string, number>();
    for (const row of this.allRows()) counts.set(row.clan, (counts.get(row.clan) ?? 0) + 1);
    const last = (name: string) => (name === UNKNOWN_CLAN ? 2 : name === NO_CLAN ? 1 : 0);
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => last(a.name) - last(b.name) || b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  });
  protected readonly rows = computed(() => {
    const hidden = this.hiddenClans();
    return this.allRows().filter((row) => !hidden.includes(row.clan));
  });

  /** Clans cochés parmi ceux du tableau (un clan décoché qui n'attaque plus n'est pas compté). */
  protected readonly shownClanCount = computed(() => this.clans().filter((c) => !this.hiddenClans().includes(c.name)).length);

  protected setClanShown(clan: string, shown: boolean): void {
    this.saveHiddenClans(shown ? this.hiddenClans().filter((c) => c !== clan) : [...this.hiddenClans(), clan]);
  }

  protected setAllClansShown(shown: boolean): void {
    this.saveHiddenClans(shown ? [] : this.clans().map((c) => c.name));
  }

  private saveHiddenClans(hidden: readonly string[]): void {
    this.hiddenClans.set(hidden);
    writeStored(HIDDEN_CLANS_KEY, JSON.stringify(hidden));
  }

  /** Ajoute les attaques collées qui ne sont pas encore en base. */
  protected async importRaids(): Promise<void> {
    this.message.set(null);
    this.error.set(null);
    let parsed: { raids: NeutralRaid[]; ignored: number };
    try {
      parsed = parseRaidsExport(this.raidsText());
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    this.saving.set(true);
    try {
      const added = await this.raidsStore.save(parsed.raids);
      const known = parsed.raids.length - added;
      const s = (n: number) => (n > 1 ? 's' : '');
      this.message.set(
        `${added} nouvelle${s(added)} attaque${s(added)} enregistrée${s(added)}, ${known} déjà connue${s(known)}` +
          (parsed.ignored ? `, ${parsed.ignored} ignorée${s(parsed.ignored)} (village de joueur).` : '.'),
      );
      this.raidsText.set('');
    } catch {
      this.error.set('Enregistrement refusé par la base : vérifiez que les règles Firestore sont publiées.');
    } finally {
      this.saving.set(false);
    }
  }

  protected setVillageFilter(value: string): void {
    this.villageFilter.set(value === '' ? null : Number(value));
  }
}
