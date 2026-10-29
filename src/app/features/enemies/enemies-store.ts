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
import { MapVillage } from '../../core/game-data/map-villages';
import { OWN_CLAN, Player, PlayerStatKey, SEED_CLANS, SEED_PLAYERS } from './clans.data';
import { EnemyRecord, playerKey } from './enemies.model';

/** `unconfigured` : configuration web Firebase absente (core/firebase.ts). */
export type StoreStatus = 'unconfigured' | 'loading' | 'ready';

export interface MapImportSummary {
  villages: number;
  playersUpdated: number;
  playersAdded: number;
  clansAdded: string[];
}

const ENEMIES = 'enemies';
const PLAYERS = 'players';
const CLANS = 'clans';
const VILLAGES = 'villages';
/** Une écriture groupée Firestore accepte 500 opérations : on reste en dessous. */
const BATCH_SIZE = 450;
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
  /** Carte du jeu (coordonnées, points, habitants, clans), importée depuis MAJ joueurs. */
  readonly villages = signal<readonly MapVillage[]>([]);
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
    onSnapshot(
      collection(db, VILLAGES),
      (snapshot) => this.villages.set(snapshot.docs.map((d) => d.data() as MapVillage)),
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

  /** Ne modifie que les infos fournies. */
  setPlayerStats(player: string, stats: Partial<Record<PlayerStatKey, number | null>>): void {
    this.run(`Mise à jour de ${player}`, (db) => updateDoc(doc(db, PLAYERS, docId(player)), stats));
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

  /**
   * Remplace la carte par l'export du jeu et synchronise les joueurs (clan, village, points, habitants)
   * et les clans. Les villages neutres vont seulement dans la carte. Les infos saisies à la main
   * (armées, CE, centres…) ne sont pas touchées, sauf pour notre clan dont on ne garde que village et kage.
   */
  async importMap(villages: readonly MapVillage[]): Promise<MapImportSummary> {
    const db = this.db;
    if (!db) throw new Error('Base partagée non configurée.');
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    const summary: MapImportSummary = { villages: villages.length, playersUpdated: 0, playersAdded: 0, clansAdded: [] };

    const keep = new Set(villages.map((v) => docId(v.name)));
    for (const v of villages) ops.push((b) => b.set(doc(db, VILLAGES, docId(v.name)), v));
    for (const old of this.villages()) {
      if (!keep.has(docId(old.name))) ops.push((b) => b.delete(doc(db, VILLAGES, docId(old.name))));
    }

    const knownClans = new Set(this.clanNames().map(playerKey));
    for (const clan of new Set(villages.flatMap((v) => (v.clan ? [v.clan] : [])))) {
      if (knownClans.has(playerKey(clan))) continue;
      summary.clansAdded.push(clan);
      ops.push((b) => b.set(doc(db, CLANS, docId(clan)), { name: clan }));
    }

    const players = this.players();
    for (const v of villages.filter((v) => !v.neutral)) {
      const existing =
        players.find((p) => playerKey(p.name) === playerKey(v.kage)) ?? players.find((p) => playerKey(p.village) === playerKey(v.name));
      // Notre clan : seulement le village et le kage (les coordonnées sont dans la carte), sans armée ni niveaux.
      if (v.clan === OWN_CLAN) {
        const name = existing?.name ?? v.kage;
        if (existing) summary.playersUpdated++;
        else summary.playersAdded++;
        ops.push((b) => b.set(doc(db, PLAYERS, docId(name)), { name, village: v.name, clan: v.clan }));
        if (this.records()[playerKey(name)]) ops.push((b) => b.delete(doc(db, ENEMIES, docId(name))));
        continue;
      }
      const fromMap = { village: v.name, clan: v.clan, points: v.points, inhabitants: v.inhabitants };
      if (existing) {
        summary.playersUpdated++;
        ops.push((b) => b.update(doc(db, PLAYERS, docId(existing.name)), fromMap));
      } else {
        summary.playersAdded++;
        ops.push((b) => b.set(doc(db, PLAYERS, docId(v.kage)), { name: v.kage, ...fromMap }));
      }
    }

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
      await batch.commit();
    }
    return summary;
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
