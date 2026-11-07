import { computed, Injectable, signal } from '@angular/core';
import { collection, doc, Firestore, onSnapshot, serverTimestamp, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../../core/firebase';
import { newRaids, NeutralRaid, raidId } from './neutral-raids.logic';

const RAIDS = 'neutralRaids';
/** Dernière actualisation, partagée par tout le clan : les règles Firestore refusent la suivante avant une heure. */
const REFRESH_DOC = ['neutralRaidsRefresh', 'last'] as const;
/** Une écriture groupée Firestore accepte 500 opérations : on reste en dessous. */
const BATCH_SIZE = 450;

/** Attaques des villages neutres relevées dans le jeu, partagées via Firestore et mises à jour en direct. */
@Injectable({ providedIn: 'root' })
export class NeutralRaidsStore {
  readonly raids = signal<readonly NeutralRaid[]>([]);
  /** Heure (ms) de la dernière actualisation demandée, `null` si aucune. */
  readonly lastRefresh = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  private readonly knownIds = computed(() => new Set(this.raids().map(raidId)));
  private db: Firestore | null = null;

  constructor() {
    if (!isFirebaseConfigured()) return;
    const db = (this.db = firestoreDb());
    const readError = () => this.error.set('La base refuse l’accès aux pillages : publiez les règles Firestore (firestore.rules) dans la console Firebase.');
    onSnapshot(collection(db, RAIDS), (snapshot) => this.raids.set(snapshot.docs.map((d) => d.data() as NeutralRaid)), readError);
    onSnapshot(
      doc(db, ...REFRESH_DOC),
      (snapshot) => {
        // Juste après l'écriture, l'heure du serveur n'est pas encore connue : on prend son estimation locale.
        const at = snapshot.get('at', { serverTimestamps: 'estimate' }) as Timestamp | undefined;
        this.lastRefresh.set(at ? at.toMillis() : null);
      },
      readError,
    );
  }

  /** Réserve l'actualisation pour l'heure qui vient. Refusée par la base si la précédente date de moins d'une heure. */
  async claimRefresh(): Promise<void> {
    if (!this.db) throw new Error('Base partagée non configurée.');
    await setDoc(doc(this.db, ...REFRESH_DOC), { at: serverTimestamp() });
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
