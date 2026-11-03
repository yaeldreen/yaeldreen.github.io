/**
 * Écritures de #gestion-joueurs dans Firestore (reprises de la page « MAJ joueurs » de l'appli web) :
 * liste des joueurs et villages, villages neutres, relevé mensuel des points et habitants.
 */
import type { WriteBatch } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { gameData, playerKey } from '../game-data.js';
import type { ImportedVillage } from './map-import.js';
import { buildSnapshot, isSnapshotDue, MonthlySnapshot } from './monthly-snapshot.js';

export const OWN_CLAN = 'Tsukuyomi';
/** Une écriture groupée Firestore accepte 500 opérations : on reste en dessous. */
const BATCH_SIZE = 450;

/** Identifiant de document, comme dans l'appli : pas de « / » ni de forme réservée « __x__ ». */
const docId = (name: string): string => encodeURIComponent(playerKey(name));

type Op = (batch: WriteBatch) => void;

async function commitAll(ops: readonly Op[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
    await batch.commit();
  }
}

export interface MapImportSummary {
  villages: number;
  playersUpdated: number;
  playersAdded: number;
  clansAdded: string[];
}

/**
 * Remplace les villages de joueurs de la carte et synchronise les joueurs (clan, village, points, habitants) et les
 * clans. Les villages neutres absents de l'export restent (ils ont leur propre mise à jour). Les infos saisies à la
 * main (armées, CE, centres…) ne sont pas touchées, sauf pour notre clan dont on ne garde que village et kage.
 */
export async function importMap(villages: readonly ImportedVillage[]): Promise<MapImportSummary> {
  const ops: Op[] = [];
  const summary: MapImportSummary = { villages: villages.length, playersUpdated: 0, playersAdded: 0, clansAdded: [] };

  const keep = new Set(villages.map((v) => docId(v.name)));
  for (const v of villages) ops.push((b) => b.set(db.collection('villages').doc(docId(v.name)), v));
  for (const old of gameData.villages) {
    if (!old.neutral && !keep.has(docId(old.name))) ops.push((b) => b.delete(db.collection('villages').doc(docId(old.name))));
  }

  const knownClans = new Set((await db.collection('clans').get()).docs.map((d) => playerKey(String(d.get('name') ?? ''))));
  for (const clan of new Set(villages.flatMap((v) => (v.clan ? [v.clan] : [])))) {
    if (knownClans.has(playerKey(clan))) continue;
    summary.clansAdded.push(clan);
    ops.push((b) => b.set(db.collection('clans').doc(docId(clan)), { name: clan }));
  }

  const players = gameData.players;
  for (const v of villages.filter((v) => !v.neutral)) {
    const existing = players.find((p) => playerKey(p.name) === playerKey(v.kage)) ?? players.find((p) => playerKey(p.village) === playerKey(v.name));
    if (existing) summary.playersUpdated++;
    else summary.playersAdded++;
    // Notre clan : seulement le village et le kage (les coordonnées sont dans la carte), sans armée ni niveaux.
    if (v.clan === OWN_CLAN) {
      const name = existing?.name ?? v.kage;
      ops.push((b) => b.set(db.collection('players').doc(docId(name)), { name, village: v.name, clan: v.clan }));
      if (gameData.armies.has(playerKey(name))) ops.push((b) => b.delete(db.collection('enemies').doc(docId(name))));
      continue;
    }
    const fromMap = { village: v.name, clan: v.clan, points: v.points, inhabitants: v.inhabitants };
    if (existing) ops.push((b) => b.update(db.collection('players').doc(docId(existing.name)), fromMap));
    else ops.push((b) => b.set(db.collection('players').doc(docId(v.kage)), { name: v.kage, ...fromMap }));
  }

  await commitAll(ops);
  return summary;
}

/** Remplace les villages neutres de la carte (les villages de joueurs ne sont pas touchés). Retourne leur nombre. */
export async function importNeutralVillages(villages: readonly ImportedVillage[]): Promise<number> {
  const ops: Op[] = [];
  const keep = new Set(villages.map((v) => docId(v.name)));
  for (const v of villages) ops.push((b) => b.set(db.collection('villages').doc(docId(v.name)), v));
  for (const old of gameData.villages) {
    if (old.neutral && !keep.has(docId(old.name))) ops.push((b) => b.delete(db.collection('villages').doc(docId(old.name))));
  }
  await commitAll(ops);
  return villages.length;
}

/**
 * Le 1er du mois (heure de Paris), le premier import enregistre le relevé du mois : l'ancien « mois en cours »
 * devient « mois précédent » (le précédent d'avant est écrasé). Retourne le relevé enregistré, ou null.
 */
export async function snapshotIfDue(villages: readonly ImportedVillage[], now = new Date()): Promise<MonthlySnapshot | null> {
  const snapshots = db.collection('snapshots');
  const current = ((await snapshots.doc('current').get()).data() as MonthlySnapshot | undefined) ?? null;
  if (!isSnapshotDue(now, current)) return null;
  const snapshot = buildSnapshot(villages, now);
  const batch = db.batch();
  if (current) batch.set(snapshots.doc('previous'), current);
  batch.set(snapshots.doc('current'), snapshot);
  await batch.commit();
  return snapshot;
}

/** Supprime un joueur et sa dernière armée connue (son village reste sur la carte jusqu'au prochain import). */
export async function deletePlayer(name: string): Promise<void> {
  const batch = db.batch();
  batch.delete(db.collection('players').doc(docId(name)));
  batch.delete(db.collection('enemies').doc(docId(name)));
  await batch.commit();
}
