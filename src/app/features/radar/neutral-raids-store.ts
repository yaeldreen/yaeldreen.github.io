import { computed, Injectable, signal } from '@angular/core';
import { collection, doc, Firestore, onSnapshot, writeBatch } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../../core/firebase';
import { newRaids, NeutralRaid, raidId } from './neutral-raids.logic';

const RAIDS = 'neutralRaids';
/** Une écriture groupée Firestore accepte 500 opérations : on reste en dessous. */
const BATCH_SIZE = 450;

/** Attaques des villages neutres relevées dans le jeu, partagées via Firestore et mises à jour en direct. */
@Injectable({ providedIn: 'root' })
export class NeutralRaidsStore {
  readonly raids = signal<readonly NeutralRaid[]>([]);
  readonly error = signal<string | null>(null);
  private readonly knownIds = computed(() => new Set(this.raids().map(raidId)));
  private db: Firestore | null = null;

  constructor() {
    if (!isFirebaseConfigured()) return;
    const db = (this.db = firestoreDb());
    const readError = () => this.error.set('La base refuse l’accès aux pillages : publiez les règles Firestore (firestore.rules) dans la console Firebase.');
    onSnapshot(collection(db, RAIDS), (snapshot) => this.raids.set(snapshot.docs.map((d) => d.data() as NeutralRaid)), readError);
  }

  /** Enregistre les attaques qui ne sont pas encore en base ; retourne leur nombre. */
  async save(raids: readonly NeutralRaid[]): Promise<number> {
    const db = this.db;
    if (!db) throw new Error('Base partagée non configurée.');
    const fresh = newRaids(raids, this.knownIds());
    for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const raid of fresh.slice(i, i + BATCH_SIZE)) batch.set(doc(db, RAIDS, raidId(raid)), raid);
      await batch.commit();
    }
    return fresh.length;
  }
}
