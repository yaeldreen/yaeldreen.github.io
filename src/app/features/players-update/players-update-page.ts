import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { applyCarte, MapVillage, mergeRanking, parseCompactExport, parseMapExport, parseRankingExport, RankingEntry } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { EnemiesStore, MapImportSummary } from '../enemies/enemies-store';
import { compareSnapshots, EvolutionRow, EvolutionSort, GAME_ORIGIN, PlayersSnapshot, RANKING_PAGE_URL, readRankingMessage, snapshotLabel, sortEvolution, toggleSort } from './ranking-snapshot';

/** Mise à jour des joueurs (classement), puis de la carte : villages neutres et coordonnées des joueurs (export compact). */
@Component({
  selector: 'app-players-update-page',
  imports: [FormsModule, Card],
  templateUrl: './players-update-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:message)': 'onRankingMessage($event)' },
})
export class PlayersUpdatePage {
  protected readonly store = inject(EnemiesStore);

  protected readonly mapText = signal('');
  protected readonly importing = signal(false);
  protected readonly importResult = signal<MapImportSummary | null>(null);
  protected readonly importError = signal<string | null>(null);
  /** Joueurs du classement absents de la carte, donc non importés (pas de coordonnées). */
  protected readonly rankingUnknown = signal<string[]>([]);

  protected async importMap(): Promise<void> {
    this.importResult.set(null);
    this.importError.set(null);
    this.rankingUnknown.set([]);
    let ranking: RankingEntry[] | null;
    let villages: MapVillage[];
    try {
      ranking = parseRankingExport(this.mapText());
      villages = ranking ? [] : parseMapExport(this.mapText());
    } catch (e) {
      this.importError.set((e as Error).message);
      return;
    }
    if (ranking) {
      const merged = mergeRanking(this.store.villageRecords(), ranking);
      villages = merged.villages;
      this.rankingUnknown.set(merged.unknown);
      if (!villages.length) {
        this.importError.set('Aucun joueur de cette liste n\'est sur la carte : faites d\'abord « MAJ joueurs carte ».');
        return;
      }
    }
    this.importing.set(true);
    try {
      this.importResult.set(await this.store.importMap(villages, { partial: !!ranking }));
      this.mapText.set('');
    } catch (e) {
      this.importError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.importing.set(false);
    }
  }

  // --- Relevé du classement (points et habitants) ---

  protected readonly snapshotLabel = snapshotLabel;
  protected readonly refreshing = signal(false);
  protected readonly refreshMessage = signal<string | null>(null);
  protected readonly refreshError = signal<string | null>(null);
  protected readonly evolutionClan = signal('');
  protected readonly evolutionSort = signal<EvolutionSort>({ key: 'points', direction: 'desc' });

  /** Ouvre le classement du jeu : le script de la page relève toutes les pages et renvoie les joueurs à cet onglet. */
  protected refresh(): void {
    this.refreshMessage.set(null);
    this.refreshError.set(null);
    if (!window.open(RANKING_PAGE_URL, '_blank')) {
      this.refreshError.set("Le navigateur a bloqué l'ouverture du classement : autorisez les fenêtres pour cette appli.");
      return;
    }
    this.refreshing.set(true);
  }

  protected onRankingMessage(event: MessageEvent): void {
    if (event.origin !== GAME_ORIGIN) return;
    const snapshot = readRankingMessage(event.data, new Date());
    if (snapshot) void this.saveSnapshot(snapshot);
  }

  /** Secours quand le classement n'a pas pu revenir tout seul : le script l'a copié. */
  protected async pasteSnapshot(): Promise<void> {
    this.refreshError.set(null);
    let snapshot: PlayersSnapshot | null = null;
    try {
      snapshot = readRankingMessage(JSON.parse(await navigator.clipboard.readText()), new Date());
    } catch {
      // Presse-papiers refusé ou texte qui n'est pas du JSON : même message que pour un relevé illisible.
    }
    if (snapshot) await this.saveSnapshot(snapshot);
    else this.refreshError.set('Le presse-papiers ne contient pas de relevé : touchez « Copier pour La Table Ronde » sur la page du classement.');
  }

  private async saveSnapshot(snapshot: PlayersSnapshot): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.store.rotateSnapshot(snapshot);
      this.refreshMessage.set(`Relevé enregistré : ${snapshot.players.length.toLocaleString('fr-FR')} joueurs, le ${snapshotLabel(snapshot)}.`);
      this.refreshError.set(null);
    } catch {
      this.refreshError.set('Relevé refusé par la base : vérifiez que les règles Firestore sont publiées.');
    } finally {
      this.refreshing.set(false);
    }
  }

  protected readonly evolutionClans = computed(() =>
    [...new Set((this.store.snapshots().current?.players ?? []).map((p) => p.c ?? 'Sans clan'))].sort((a, b) => a.localeCompare(b, 'fr')),
  );

  protected readonly evolution = computed((): EvolutionRow[] => {
    const { current, previous } = this.store.snapshots();
    if (!current) return [];
    const clan = this.evolutionClan();
    return sortEvolution(
      compareSnapshots(previous, current).filter((r) => !clan || (r.clan ?? 'Sans clan') === clan),
      this.evolutionSort(),
    );
  });

  protected sortBy(key: EvolutionSort['key']): void {
    this.evolutionSort.update((sort) => toggleSort(sort, key));
  }

  /** Écart affiché : « — » pour un joueur absent du relevé d'avant. */
  protected signed(n: number | null): string {
    return n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('fr-FR')}`;
  }

  protected deltaClass(n: number | null): string {
    return n === null || n === 0 ? 'text-stone-500' : n > 0 ? 'text-emerald-300' : 'text-rose-300';
  }

  /** Flèche de l'en-tête : sens du tri, ou ↕ pour une colonne triable qui ne l'est pas. */
  protected sortArrow(key: EvolutionSort['key']): string {
    const sort = this.evolutionSort();
    return sort.key !== key ? '↕' : sort.direction === 'desc' ? '↓' : '↑';
  }

  // --- Carte (export compact à clés numérotées) ---

  protected readonly carteText = signal('');
  protected readonly carteImporting = signal(false);
  protected readonly carteResult = signal<{ neutral: number; updated: number; added: number; removed: string[] } | null>(null);
  protected readonly carteError = signal<string | null>(null);
  protected readonly neutralCount = computed(() => this.store.villages().filter((v) => v.neutral).length);

  protected async importCarte(): Promise<void> {
    this.carteResult.set(null);
    this.carteError.set(null);
    let carte: { neutral: MapVillage[]; players: MapVillage[] };
    try {
      carte = parseCompactExport(this.carteText());
    } catch (e) {
      this.carteError.set((e as Error).message);
      return;
    }
    // Les joueurs absents de la liste sont supprimés : une liste coupée viderait la carte.
    const current = this.store.villages().filter((v) => !v.neutral).length;
    if (!carte.players.length || carte.players.length < current / 2) {
      this.carteError.set(`Liste incomplète : ${carte.players.length} joueurs pour ${current} sur la carte. Rien n'a été modifié, collez le fichier entier.`);
      return;
    }
    this.carteImporting.set(true);
    try {
      const villages = applyCarte(this.store.villageRecords(), carte.players);
      const summary = await this.store.importCarte(carte.neutral, villages);
      this.carteResult.set({ neutral: carte.neutral.length, updated: summary.playersUpdated, added: summary.playersAdded, removed: summary.removed });
      this.carteText.set('');
    } catch (e) {
      this.carteError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.carteImporting.set(false);
    }
  }
}
