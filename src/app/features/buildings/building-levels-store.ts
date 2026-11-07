import { Injectable, signal } from '@angular/core';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../../core/firebase';
import { levelHistoryEntry, LevelRow, upsertLevel } from './building-levels';
import { BuildingLevel } from './buildings.data';
import { BUILDING_GUIDES, BuildingId } from './buildings.guides';

const BUILDINGS_DOC = ['gameData', 'buildings'] as const;
/** Modifications du temps et des ressources : conservées en base, non affichées dans l'appli. */
const HISTORY = 'buildingHistory';

/**
 * Niveaux des bâtiments partagés via Firestore (`gameData/buildings`, le même document que le bot).
 * Les tableaux du code servent de valeurs de départ. Ils sont mis à jour sur place : les calculs de toutes les pages
 * (combat, pillages, simulation…) les lisent directement et profitent ainsi des niveaux ajoutés ou corrigés.
 */
@Injectable({ providedIn: 'root' })
export class BuildingLevelsStore {
  /** Change à chaque mise à jour des tableaux, pour que les pages affichées se recalculent. */
  readonly version = signal(0);

  constructor() {
    if (!isFirebaseConfigured()) return;
    onSnapshot(
      doc(firestoreDb(), ...BUILDINGS_DOC),
      (snapshot) => {
        const data = snapshot.data() as Record<string, { levels?: BuildingLevel[] }> | undefined;
        if (!data) return;
        for (const guide of BUILDING_GUIDES) {
          const levels = data[guide.id]?.levels;
          if (!levels?.length) continue;
          const rows = guide.rows as BuildingLevel[];
          rows.splice(0, rows.length, ...[...levels].sort((a, b) => a.level - b.level));
        }
        this.version.update((v) => v + 1);
      },
      // Lecture refusée : on garde les tableaux du code.
      () => undefined,
    );
  }

  /** Ajoute ou corrige un niveau et note le changement. Transaction : deux modifications ne s'écrasent pas, et l'historique ne peut pas manquer. */
  async saveLevel(id: BuildingId, row: LevelRow): Promise<void> {
    if (!isFirebaseConfigured()) throw new Error('Base partagée non configurée.');
    const db = firestoreDb();
    const ref = doc(db, ...BUILDINGS_DOC);
    await runTransaction(db, async (tx) => {
      const building = (await tx.get(ref)).data()?.[id] as { levels?: LevelRow[] } | undefined;
      if (!building) throw new Error('Bâtiment absent de la base.');
      const entry = levelHistoryEntry(id, building.levels?.find((l) => l.level === row.level), row);
      if (entry) tx.set(doc(collection(db, HISTORY)), { ...entry, at: serverTimestamp() });
      tx.update(ref, {
        [id]: { ...building, levels: upsertLevel(building.levels ?? [], row) },
        updatedAt: new Date().toISOString(),
        updatedBy: 'appli',
      });
    });
  }
}
