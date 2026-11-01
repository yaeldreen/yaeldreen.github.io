import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapVillage, parseMapExport, parseNeutralExport } from '../../core/game-data/map-villages';
import { AccessGate } from '../../core/access';
import { Card } from '../../shared/ui/card';
import { EnemiesStore, MapImportSummary } from '../enemies/enemies-store';
import { buildSnapshot, compareSnapshots, EvolutionRow, isSnapshotDue, monthLabel } from './monthly-snapshot';

/** Mise à jour des joueurs, villages et clans (export JSON de la carte), puis des villages neutres (export compact). */
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

  protected async importMap(): Promise<void> {
    this.importResult.set(null);
    this.importError.set(null);
    let villages: MapVillage[];
    try {
      villages = parseMapExport(this.mapText());
    } catch (e) {
      this.importError.set((e as Error).message);
      return;
    }
    this.importing.set(true);
    try {
      this.importResult.set(await this.store.importMap(villages));
      this.mapText.set('');
      await this.snapshotIfDue(villages);
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

  // --- Villages neutres (export compact à clés numérotées) ---

  protected readonly neutralText = signal('');
  protected readonly neutralImporting = signal(false);
  protected readonly neutralResult = signal<number | null>(null);
  protected readonly neutralError = signal<string | null>(null);
  protected readonly neutralCount = computed(() => this.store.villages().filter((v) => v.neutral).length);

  protected async importNeutral(): Promise<void> {
    this.neutralResult.set(null);
    this.neutralError.set(null);
    let villages: MapVillage[];
    try {
      villages = parseNeutralExport(this.neutralText());
    } catch (e) {
      this.neutralError.set((e as Error).message);
      return;
    }
    if (!villages.length) {
      this.neutralError.set('Aucun village neutre (9: true) dans la liste.');
      return;
    }
    this.neutralImporting.set(true);
    try {
      this.neutralResult.set(await this.store.importNeutralVillages(villages));
      this.neutralText.set('');
    } catch (e) {
      this.neutralError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.neutralImporting.set(false);
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
