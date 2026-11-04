import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { applyCoordinates, MapVillage, mergeRanking, parseCompactExport, parseMapExport, parseRankingExport, RankingEntry } from '../../core/game-data/map-villages';
import { AccessGate } from '../../core/access';
import { Card } from '../../shared/ui/card';
import { EnemiesStore, MapImportSummary } from '../enemies/enemies-store';
import { buildSnapshot, compareSnapshots, EvolutionRow, isSnapshotDue, monthLabel } from './monthly-snapshot';

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
      const merged = mergeRanking(this.store.villages(), ranking);
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
      // Le relevé mensuel doit couvrir tous les joueurs : le classement partiel ne le déclenche pas.
      if (!ranking) await this.snapshotIfDue(villages);
    } catch (e) {
      this.importError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.importing.set(false);
    }
  }

  // --- Relevé mensuel des points et habitants ---

  protected readonly snapshotMessage = signal<string | null>(null);
  protected readonly monthLabel = monthLabel;
  protected readonly evolutionClan = signal('');
  protected readonly evolutionSort = signal<'points' | 'inhabitants' | 'name'>('points');

  /** Le 1er du mois, le premier import enregistre le relevé du mois (et décale l'ancien en « mois précédent »). */
  private async snapshotIfDue(villages: readonly MapVillage[]): Promise<void> {
    const now = new Date();
    if (!isSnapshotDue(now, this.store.snapshots().current)) return;
    try {
      const snapshot = buildSnapshot(villages, now);
      await this.store.rotateSnapshot(snapshot);
      this.snapshotMessage.set(`Relevé du ${monthLabel(snapshot.month)} enregistré.`);
    } catch {
      this.snapshotMessage.set('Relevé mensuel refusé par la base : vérifiez que les règles Firestore sont publiées.');
    }
  }

  protected readonly evolutionClans = computed(() =>
    [...new Set((this.store.snapshots().current?.players ?? []).map((p) => p.c ?? 'Sans clan'))].sort((a, b) => a.localeCompare(b, 'fr')),
  );

  protected readonly evolution = computed((): EvolutionRow[] => {
    const { current, previous } = this.store.snapshots();
    if (!current) return [];
    const clan = this.evolutionClan();
    const rows = compareSnapshots(previous, current).filter((r) => !clan || (r.clan ?? 'Sans clan') === clan);
    const by = this.evolutionSort();
    const delta = (r: EvolutionRow) => (by === 'points' ? r.pointsDelta : r.inhabitantsDelta) ?? -Infinity;
    return by === 'name' ? rows.sort((a, b) => a.name.localeCompare(b.name, 'fr')) : rows.sort((a, b) => delta(b) - delta(a));
  });

  protected signed(n: number | null): string {
    return n === null ? 'nouveau' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR')}`;
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
      const villages = applyCoordinates(this.store.villages(), this.store.players(), carte.players);
      const summary = await this.store.importCarte(carte.neutral, villages);
      this.carteResult.set({ neutral: carte.neutral.length, updated: summary.playersUpdated, added: summary.playersAdded, removed: summary.removed });
      this.carteText.set('');
      // Cet export couvre tous les joueurs : c'est lui qui déclenche le relevé mensuel, avec ses propres clans, points et habitants.
      await this.snapshotIfDue(villages.map((v, i) => ({ ...v, clan: carte.players[i].clan, points: carte.players[i].points, inhabitants: carte.players[i].inhabitants })));
    } catch (e) {
      this.carteError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.carteImporting.set(false);
    }
  }

  // --- Mot de passe d'accès ---

  private readonly access = inject(AccessGate);
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly passwordMessage = signal<{ ok: boolean; text: string } | null>(null);

  protected async changePassword(): Promise<void> {
    const error = await this.access.change(this.currentPassword(), this.newPassword());
    this.passwordMessage.set(error ? { ok: false, text: error } : { ok: true, text: 'Mot de passe changé pour tout le clan.' });
    if (!error) {
      this.currentPassword.set('');
      this.newPassword.set('');
    }
  }
}
