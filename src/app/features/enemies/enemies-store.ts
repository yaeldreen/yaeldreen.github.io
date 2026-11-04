import { computed, Injectable, signal } from '@angular/core';
import {
  collection,
  deleteField,
  doc,
  Firestore,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../../core/firebase';
import { hasCoordinates, MapVillage, notesOf, playersMissingFromCarte, VillageArmy, VillageDoc } from '../../core/game-data/map-villages';
import { MonthlySnapshot, SnapshotSlot } from '../players-update/monthly-snapshot';
import { joinPlayers, OWN_CLAN, Player, PlayerStatKey, SEED_CLANS, SEED_PLAYERS } from './clans.data';
import { EnemyRecord, playerKey } from './enemies.model';

/** `unconfigured` : configuration web Firebase absente (core/firebase.ts). */
export type StoreStatus = 'unconfigured' | 'loading' | 'ready';

export interface MapImportSummary {
  villages: number;
  playersUpdated: number;
  playersAdded: number;
  clansAdded: string[];
}

const CLANS = 'clans';
const VILLAGES = 'villages';
const SNAPSHOTS = 'snapshots';
/** Une écriture groupée Firestore accepte 500 opérations : on reste en dessous. */
const BATCH_SIZE = 450;
/** Identifiant de document Firestore : pas de « / » ni de forme réservée « __x__ ». */
const docId = (name: string): string => encodeURIComponent(playerKey(name));

/**
 * Un village par nom : un doublon écrit sous un autre identifiant est écarté, celui mis à jour par les imports est gardé.
 * Un ancien document sans le champ `neutral` compte comme un village de joueur.
 */
export function uniqueVillages(docs: readonly { id: string; data: VillageDoc }[]): VillageDoc[] {
  const byName = new Map<string, VillageDoc>();
  for (const { id, data } of docs) {
    const key = playerKey(data.name);
    if (!byName.has(key) || id === docId(data.name)) byName.set(key, { ...data, neutral: data.neutral === true });
  }
  return [...byName.values()];
}

/** Armées, indexées par nom de joueur normalisé (`playerKey`). */
export function armyRecords(villages: readonly VillageDoc[]): Record<string, EnemyRecord> {
  return Object.fromEntries(villages.flatMap((v) => (v.army && !v.neutral ? [[playerKey(v.kage), { player: v.kage, ...v.army }]] : [])));
}

/** Document écrit par un import : les notes et l'armée sont conservées, sauf l'armée de notre clan, jamais enregistrée. */
export function importedVillage(village: MapVillage, previous: VillageDoc | undefined): MapVillage {
  const { army, ...record } = { ...notesOf(previous), ...village };
  return army && village.clan !== OWN_CLAN ? { ...record, army } : record;
}

/**
 * Infos ennemis partagées via Firestore, mises à jour en direct pour tout le monde :
 * joueurs, armées et carte (`villages`) et clans (`clans`).
 * Accès ouvert à tous (choix assumé) ; seules les données mal formées sont refusées (firestore.rules).
 */
@Injectable({ providedIn: 'root' })
export class EnemiesStore {
  readonly clanNames = signal<readonly string[]>(SEED_CLANS);
  /** Tous les documents de `villages` : la référence pour les joueurs, y compris ce qui est saisi à la main. */
  readonly villageRecords = signal<readonly VillageDoc[]>([]);
  /** Carte du jeu : les villages qui ont des coordonnées. */
  readonly villages = computed(() => this.villageRecords().filter(hasCoordinates));
  /** Vrais identifiants des documents de villages, doublons compris. */
  private villageDocs: readonly { id: string; data: VillageDoc }[] = [];
  readonly records = computed(() => armyRecords(this.villageRecords()));
  /** Liste initiale tant que la base n'a pas répondu (ou sans configuration). */
  readonly players = computed((): readonly Player[] => (this.villageRecords().length ? joinPlayers(this.villageRecords()) : SEED_PLAYERS));
  /** Relevés mensuels des points et habitants : mois en cours et mois précédent. */
  readonly snapshots = signal<Record<SnapshotSlot, MonthlySnapshot | null>>({ current: null, previous: null });
  readonly status = signal<StoreStatus>(isFirebaseConfigured() ? 'loading' : 'unconfigured');
  readonly error = signal<string | null>(null);

  private db: Firestore | null = null;

  constructor() {
    if (this.status() === 'unconfigured') return;
    const db = (this.db = firestoreDb());
    const readError = () => this.error.set('Lecture des infos impossible : vérifiez la base Firestore et ses règles.');

    onSnapshot(
      collection(db, CLANS),
      (snapshot) => {
        if (!snapshot.empty) this.clanNames.set(snapshot.docs.map((d) => (d.data() as { name: string }).name));
      },
      readError,
    );
    onSnapshot(
      collection(db, SNAPSHOTS),
      (snapshot) => {
        const byId = Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as MonthlySnapshot]));
        this.snapshots.set({ current: byId['current'] ?? null, previous: byId['previous'] ?? null });
      },
      readError,
    );
    onSnapshot(
      collection(db, VILLAGES),
      (snapshot) => {
        this.villageDocs = snapshot.docs.map((d) => ({ id: d.id, data: d.data() as VillageDoc }));
        this.villageRecords.set(uniqueVillages(this.villageDocs));
        this.status.set('ready');
      },
      readError,
    );
  }

  /** Le plus récent remplace l'ancien. Non bloquant : la copie locale est à jour tout de suite. */
  upsert({ player, ...army }: EnemyRecord): void {
    if (this.villageOf(player)) this.updateVillage(`Enregistrement de ${player}`, player, { army });
    else this.addPlayer({ name: player, village: '', clan: null }, army);
  }

  remove(player: string): void {
    this.updateVillage(`Suppression de l'armée de ${player}`, player, { army: deleteField() });
  }

  addClan(name: string): void {
    this.run(`Création du clan ${name}`, (db) => setDoc(doc(db, CLANS, docId(name)), { name }));
  }

  private villageOf(player: string): VillageDoc | undefined {
    return this.villageRecords().find((v) => !v.neutral && playerKey(v.kage) === playerKey(player));
  }

  /** Le document affiché pour ce village, même si son identifiant n'a pas la forme habituelle. */
  private villageRef(db: Firestore, village: VillageDoc) {
    const docs = this.villageDocs.filter((d) => playerKey(d.data.name) === playerKey(village.name));
    return doc(db, VILLAGES, docs.find((d) => d.id === docId(village.name))?.id ?? docs[0]?.id ?? docId(village.name));
  }

  /**
   * N'écrit que les champs fournis : plusieurs écritures peuvent partir d'affilée sur le même village (armée et niveaux).
   * `neutral` est renvoyé car la règle l'exige et un ancien document peut ne pas l'avoir.
   */
  private updateVillage(label: string, player: string, changes: Record<string, unknown>): void {
    const village = this.villageOf(player);
    if (village) this.run(label, (db) => updateDoc(this.villageRef(db, village), { ...changes, neutral: false }));
  }

  /** Les joueurs du clan passent dans « Sans Clans ». */
  removeClan(name: string): void {
    this.run(`Suppression du clan ${name}`, (db) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, CLANS, docId(name)));
      for (const village of this.villageRecords().filter((v) => !v.neutral && v.clan === name)) {
        batch.update(this.villageRef(db, village), { clan: null, neutral: false });
      }
      return batch.commit();
    });
  }

  /** Joueur absent de la carte : un document sans coordonnées, que l'import de la carte complétera ou retirera. */
  addPlayer({ name, village, clan, points, inhabitants, ...notes }: Player, army?: VillageArmy): void {
    const record: VillageDoc = { ...notes, ...(army ? { army } : {}), name: village || name, kage: name, clan, points: points ?? 0, inhabitants: inhabitants ?? 0, neutral: false };
    this.run(`Ajout de ${name}`, (db) => setDoc(doc(db, VILLAGES, docId(record.name)), record, { merge: true }));
  }

  setPlayerClan(player: string, clan: string | null): void {
    this.updateVillage(`Changement de clan de ${player}`, player, { clan });
  }

  /** Ne modifie que les infos fournies. */
  setPlayerStats(player: string, stats: Partial<Record<PlayerStatKey, number | null>>): void {
    const { points, inhabitants, ...notes } = stats;
    this.updateVillage(`Mise à jour de ${player}`, player, {
      ...notes,
      ...(points != null ? { points } : {}),
      ...(inhabitants != null ? { inhabitants } : {}),
    });
  }

  /** Supprime le joueur et son village, armée comprise. */
  removePlayer(player: string): void {
    this.run(`Suppression de ${player}`, (db) => {
      const batch = writeBatch(db);
      for (const { id, data } of this.villageDocs) {
        if (!data.neutral && playerKey(data.kage) === playerKey(player)) batch.delete(doc(db, VILLAGES, id));
      }
      return batch.commit();
    });
  }

  /**
   * Remplace la carte par l'export du jeu et ajoute les nouveaux clans. Les infos saisies à la main (armées, CE, centres…)
   * sont conservées et suivent un joueur renommé.
   */
  /** `partial` : la liste ne couvre qu'une partie de la carte (classement), les villages absents restent. */
  async importMap(villages: readonly MapVillage[], { partial = false } = {}): Promise<MapImportSummary> {
    const db = this.db;
    if (!db) throw new Error('Base partagée non configurée.');
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    const summary: MapImportSummary = { villages: villages.length, playersUpdated: 0, playersAdded: 0, clansAdded: [] };

    const keep = new Set(villages.map((v) => docId(v.name)));
    const known = this.villageRecords().filter((v) => !v.neutral);
    const sameKage = (v: MapVillage) => known.find((k) => playerKey(k.kage) === playerKey(v.kage));
    const sameVillage = (v: MapVillage) => known.find((k) => playerKey(k.name) === playerKey(v.name));
    for (const v of villages) {
      const record = v.neutral ? v : importedVillage(v, sameKage(v) ?? sameVillage(v));
      ops.push((b) => b.set(doc(db, VILLAGES, docId(v.name)), record));
    }
    // Les villages neutres absents de l'export restent : ils ont leur propre mise à jour.
    for (const { id, data } of this.villageDocs) {
      if (data.neutral === true || keep.has(id)) continue;
      // Import partiel : seul l'ancien document d'un village renommé ou en double disparaît.
      if (!partial || villages.some((v) => playerKey(v.kage) === playerKey(data.kage))) ops.push((b) => b.delete(doc(db, VILLAGES, id)));
    }

    const knownClans = new Set(this.clanNames().map(playerKey));
    for (const clan of new Set(villages.flatMap((v) => (v.clan ? [v.clan] : [])))) {
      if (knownClans.has(playerKey(clan))) continue;
      summary.clansAdded.push(clan);
      ops.push((b) => b.set(doc(db, CLANS, docId(clan)), { name: clan }));
    }

    for (const v of villages.filter((v) => !v.neutral)) {
      if (sameKage(v) || sameVillage(v)) summary.playersUpdated++;
      else summary.playersAdded++;
    }

    await this.commitAll(db, ops);
    return summary;
  }

  /** Remplace les villages neutres de la carte (les villages de joueurs ne sont pas touchés). Retourne leur nombre. */
  /**
   * Applique l'export complet de la carte : villages neutres, puis joueurs. Les joueurs absents de la liste sont supprimés
   * (village et armée), ainsi que tout village en double. On lit la base pour viser les vrais identifiants de documents.
   */
  async importCarte(neutral: readonly MapVillage[], players: readonly MapVillage[]): Promise<MapImportSummary & { removed: string[] }> {
    const db = this.db;
    if (!db) throw new Error('Base partagée non configurée.');
    if (neutral.length) await this.importNeutralVillages(neutral);
    const summary = await this.importMap(players, { partial: true });

    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    const keep = new Set([...neutral, ...players].map((v) => docId(v.name)));
    const docs = (await getDocs(collection(db, VILLAGES))).docs;
    const records = docs.map((d) => d.data() as VillageDoc).filter((v) => !v.neutral);
    const gone = playersMissingFromCarte(
      records.map((v) => ({ name: v.kage, village: v.name })),
      players,
    );
    for (const d of docs) {
      if (!(d.data() as VillageDoc).neutral && !keep.has(d.id)) ops.push((b) => b.delete(d.ref));
    }
    await this.commitAll(db, ops);
    return { ...summary, removed: gone.map((p) => p.name) };
  }

  async importNeutralVillages(villages: readonly MapVillage[]): Promise<number> {
    const db = this.db;
    if (!db) throw new Error('Base partagée non configurée.');
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    const keep = new Set(villages.map((v) => docId(v.name)));
    for (const v of villages) ops.push((b) => b.set(doc(db, VILLAGES, docId(v.name)), v));
    for (const old of this.villages()) {
      if (old.neutral && !keep.has(docId(old.name))) ops.push((b) => b.delete(doc(db, VILLAGES, docId(old.name))));
    }
    await this.commitAll(db, ops);
    return villages.length;
  }

  private async commitAll(db: Firestore, ops: readonly ((batch: ReturnType<typeof writeBatch>) => void)[]): Promise<void> {
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
      await batch.commit();
    }
  }

  /**
   * Nouveau relevé du mois : l'ancien « mois en cours » devient « mois précédent »
   * (le précédent d'avant est écrasé), le nouveau relevé devient « mois en cours ».
   */
  async rotateSnapshot(snapshot: MonthlySnapshot): Promise<void> {
    const db = this.db;
    if (!db) throw new Error('Base partagée non configurée.');
    const batch = writeBatch(db);
    const current = this.snapshots().current;
    if (current) batch.set(doc(db, SNAPSHOTS, 'previous'), current);
    batch.set(doc(db, SNAPSHOTS, 'current'), snapshot);
    await batch.commit();
  }

  private run(label: string, operation: (db: Firestore) => Promise<void>): void {
    if (!this.db) {
      this.error.set(`${label} impossible : base partagée non configurée.`);
      return;
    }
    operation(this.db).catch(() => this.error.set(`${label} refusé par le serveur.`));
  }

  /** Copie la liste initiale (148 joueurs, leurs clans) si la base ne l'a jamais reçue. */
}
