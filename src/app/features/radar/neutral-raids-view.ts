import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapVillage } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { readStored, writeStored } from '../../shared/utils/storage';
import { NO_CLAN } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { GAME_ORIGIN } from '../players-update/ranking-snapshot';
import { computeDistance } from '../travel/travel.logic';
import { NeutralRaidsStore } from './neutral-raids-store';
import { NeutralRaid, nextRefreshAt, raidedVillages, raidsPageUrl, raidTime, readRaidsMessage, sortedRaids } from './neutral-raids.logic';

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
  imports: [Card, RouterLink],
  templateUrl: './neutral-raids-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:message)': 'onRaidsMessage($event)' },
})
export class NeutralRaidsView {
  protected readonly raidsStore = inject(NeutralRaidsStore);
  private readonly villagesStore = inject(EnemiesStore);
  protected readonly raidTime = raidTime;
  protected readonly gameOrigin = GAME_ORIGIN;

  /** L'heure avance toute seule pour débloquer le bouton une heure après la dernière actualisation. */
  private readonly now = signal(Date.now());
  protected readonly nextRefresh = computed(() => nextRefreshAt(this.raidsStore.lastRefresh(), this.now()));
  private readonly neutralIds = computed(() => this.villagesStore.villages().flatMap((v) => (v.neutral && v.gameId !== undefined ? [v.gameId] : [])));

  protected readonly waiting = signal(false);
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

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * Ouvre le premier village neutre du jeu : le script y relève l'historique de tous les villages neutres et le renvoie ici.
   * La fenêtre s'ouvre avant la réservation de l'heure, sinon le navigateur la bloquerait ; elle est refermée si la réservation échoue.
   */
  protected async refresh(): Promise<void> {
    this.message.set(null);
    this.error.set(null);
    const ids = this.neutralIds();
    if (!ids.length) {
      this.error.set('Aucun village neutre sur la carte : importez la carte dans « MAJ joueurs ».');
      return;
    }
    const popup = window.open(raidsPageUrl(ids), '_blank');
    if (!popup) {
      this.error.set("Le navigateur a bloqué l'ouverture du jeu : autorisez les fenêtres pour cette appli.");
      return;
    }
    try {
      await this.raidsStore.claimRefresh();
      this.waiting.set(true);
    } catch {
      popup.close();
      this.error.set("Actualisation refusée : une autre a eu lieu il y a moins d'une heure, ou les règles Firestore ne sont pas publiées.");
    }
  }

  protected onRaidsMessage(event: MessageEvent): void {
    if (event.origin !== GAME_ORIGIN) return;
    const raids = readRaidsMessage(event.data);
    if (raids) void this.save(raids);
  }

  /** Secours quand le relevé n'a pas pu revenir tout seul : le script l'a copié. */
  protected async paste(): Promise<void> {
    this.error.set(null);
    let raids: NeutralRaid[] | null = null;
    try {
      raids = readRaidsMessage(JSON.parse(await navigator.clipboard.readText()));
    } catch {
      // Presse-papiers refusé ou texte qui n'est pas du JSON : même message que pour un relevé illisible.
    }
    if (raids) await this.save(raids);
    else this.error.set('Le presse-papiers ne contient pas de relevé : touchez « Copier pour La Table Ronde » sur la page du jeu.');
  }

  private async save(raids: NeutralRaid[]): Promise<void> {
    this.waiting.set(false);
    this.saving.set(true);
    try {
      const added = await this.raidsStore.save(raids);
      this.message.set(`${added} nouvelle${added > 1 ? 's' : ''} attaque${added > 1 ? 's' : ''} enregistrée${added > 1 ? 's' : ''}, ${raids.length - added} déjà connue${raids.length - added > 1 ? 's' : ''}.`);
      this.error.set(null);
    } catch {
      this.error.set('Enregistrement refusé par la base : vérifiez que les règles Firestore sont publiées.');
    } finally {
      this.saving.set(false);
    }
  }

  protected setVillageFilter(value: string): void {
    this.villageFilter.set(value === '' ? null : Number(value));
  }

  protected formatHour(ms: number): string {
    return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
