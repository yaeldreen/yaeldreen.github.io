import { Injectable, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseConfigured } from '../../core/firebase';
import { Player, SEED_CLANS, SEED_PLAYERS } from './clans.data';
import { EnemyRecord, playerKey } from './enemies.model';

/** `unconfigured` : configuration web Firebase absente (core/firebase.ts). */
export type StoreStatus = 'unconfigured' | 'loading' | 'ready';

const ENEMIES = 'enemies';
const PLAYERS = 'players';
const CLANS = 'clans';
/** Document témoin : la liste initiale n'est copiée qu'une fois. */
const SEED_DOC = ['meta', 'seed'] as const;

/** Identifiant de document Firestore : pas de « / » ni de forme réservée « __x__ ». */
const docId = (name: string): string => encodeURIComponent(playerKey(name));

/**
 * Infos ennemis partagées via Firestore, mises à jour en direct pour tout le monde :
 * armées (`enemies`), joueurs (`players`) et clans (`clans`).
 * Accès ouvert à tous (choix assumé) ; seules les données mal formées sont refusées (firestore.rules).
 */
@Injectable({ providedIn: 'root' })
export class EnemiesStore {
  /** Armées, indexées par nom de joueur normalisé (`playerKey`). */
  readonly records = signal<Record<string, EnemyRecord>>({});
  /** Liste initiale tant que la base n'a pas répondu (ou sans configuration). */
  readonly players = signal<readonly Player[]>(SEED_PLAYERS);
  readonly clanNames = signal<readonly string[]>(SEED_CLANS);
  readonly status = signal<StoreStatus>(isFirebaseConfigured() ? 'loading' : 'unconfigured');
  readonly error = signal<string | null>(null);

  private db: Firestore | null = null;

  constructor() {
    if (this.status() === 'unconfigured') return;
    // Copie locale (IndexedDB) : affichage immédiat et écritures possibles hors ligne.
    const db = (this.db = initializeFirestore(firebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }));
    const readError = () => this.error.set('Lecture des infos impossible : vérifiez la base Firestore et ses règles.');

    onSnapshot(
      collection(db, ENEMIES),
      (snapshot) => {
        const records: Record<string, EnemyRecord> = {};
        for (const d of snapshot.docs) {
          const record = d.data() as EnemyRecord;
          records[playerKey(record.player)] = record;
        }
        this.records.set(records);
        this.status.set('ready');
      },
      readError,
    );
    onSnapshot(
      collection(db, PLAYERS),
      (snapshot) => {
        if (!snapshot.empty) this.players.set(snapshot.docs.map((d) => d.data() as Player));
      },
      readError,
    );
    onSnapshot(
      collection(db, CLANS),
      (snapshot) => {
        if (!snapshot.empty) this.clanNames.set(snapshot.docs.map((d) => (d.data() as { name: string }).name));
      },
      readError,
    );
    void this.seedOnce(db);
  }

  /** Le plus récent remplace l'ancien. Non bloquant : la copie locale est à jour tout de suite. */
  upsert(record: EnemyRecord): void {
    this.run(`Enregistrement de ${record.player}`, (db) => setDoc(doc(db, ENEMIES, docId(record.player)), record));
  }

  remove(player: string): void {
    this.run(`Suppression de l'armée de ${player}`, (db) => deleteDoc(doc(db, ENEMIES, docId(player))));
  }

  addClan(name: string): void {
    this.run(`Création du clan ${name}`, (db) => setDoc(doc(db, CLANS, docId(name)), { name }));
  }

  /** Les joueurs du clan passent dans « Sans Clans ». */
  removeClan(name: string): void {
    this.run(`Suppression du clan ${name}`, (db) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, CLANS, docId(name)));
      for (const player of this.players().filter((p) => p.clan === name)) {
        batch.update(doc(db, PLAYERS, docId(player.name)), { clan: null });
      }
      return batch.commit();
    });
  }

  addPlayer(player: Player): void {
    this.run(`Ajout de ${player.name}`, (db) => setDoc(doc(db, PLAYERS, docId(player.name)), player));
  }

  setPlayerClan(player: string, clan: string | null): void {
    this.run(`Changement de clan de ${player}`, (db) => updateDoc(doc(db, PLAYERS, docId(player)), { clan }));
  }

  /** Supprime le joueur et son armée. */
  removePlayer(player: string): void {
    this.run(`Suppression de ${player}`, (db) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, PLAYERS, docId(player)));
      batch.delete(doc(db, ENEMIES, docId(player)));
      return batch.commit();
    });
  }

  private run(label: string, operation: (db: Firestore) => Promise<void>): void {
    if (!this.db) {
      this.error.set(`${label} impossible : base partagée non configurée.`);
      return;
    }
    operation(this.db).catch(() => this.error.set(`${label} refusé par le serveur.`));
  }

  /** Copie la liste initiale (148 joueurs, leurs clans) si la base ne l'a jamais reçue. */
  private async seedOnce(db: Firestore): Promise<void> {
    try {
      if ((await getDoc(doc(db, ...SEED_DOC))).exists()) return;
      const batch = writeBatch(db);
      for (const name of SEED_CLANS) batch.set(doc(db, CLANS, docId(name)), { name });
      for (const player of SEED_PLAYERS) batch.set(doc(db, PLAYERS, docId(player.name)), player);
      batch.set(doc(db, ...SEED_DOC), { at: new Date().toISOString() });
      await batch.commit();
    } catch {
      // Hors ligne ou refusé : la liste initiale reste affichée, nouvel essai au prochain chargement.
    }
  }
}
