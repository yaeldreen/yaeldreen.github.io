import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapVillage, parseMapExport } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { EnemiesStore, MapImportSummary } from '../enemies/enemies-store';

/** Mise à jour des joueurs, villages et clans à partir de l'export JSON de la carte du jeu. */
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
    } catch (e) {
      this.importError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.importing.set(false);
    }
  }
}
