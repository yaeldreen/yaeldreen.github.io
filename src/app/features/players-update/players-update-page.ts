import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { applyCarte, MapVillage, mergeRanking, parseCompactExport, parseMapExport, parseRankingExport, RankingEntry } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { EnemiesStore, MapImportSummary } from '../enemies/enemies-store';
import { compareSnapshots, EvolutionRow, EvolutionSort, placeRanking, snapshotLabel, sortEvolution, toggleSort } from './ranking-snapshot';

/** Mise à jour des joueurs (classement), puis de la carte : villages neutres et coordonnées des joueurs (export compact). */
@Component({
  selector: 'app-players-update-page',
  imports: [FormsModule, Card],
  templateUrl: './players-update-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      if (ranking) await this.saveSnapshot(ranking);
    } catch (e) {
      this.importError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.importing.set(false);
    }
  }

  // --- Relevé du classement (points et habitants) ---

  protected readonly snapshotLabel = snapshotLabel;
  protected readonly snapshotMessage = signal<string | null>(null);
  protected readonly snapshotError = signal<string | null>(null);
  protected readonly evolutionClan = signal('');
  protected readonly evolutionSort = signal<EvolutionSort>({ key: 'points', direction: 'desc' });

  /** Chaque collage du classement met à jour le tableau d'évolution (nouveau relevé, ou page de plus du relevé en cours). */
  private async saveSnapshot(ranking: readonly RankingEntry[]): Promise<void> {
    this.snapshotMessage.set(null);
    this.snapshotError.set(null);
    const { snapshot, rotate } = placeRanking(this.store.snapshots().current, ranking, new Date());
    try {
      if (rotate) await this.store.rotateSnapshot(snapshot);
      else await this.store.replaceCurrentSnapshot(snapshot);
      const count = snapshot.players.length.toLocaleString('fr-FR');
      this.snapshotMessage.set(rotate ? `Nouveau relevé : ${count} joueurs, le ${snapshotLabel(snapshot)}.` : `Relevé du ${snapshotLabel(snapshot)} complété : ${count} joueurs.`);
    } catch {
      this.snapshotError.set('Relevé refusé par la base : vérifiez que les règles Firestore sont publiées.');
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
