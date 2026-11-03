/** Écritures de #infos-ennemis dans Firestore (mêmes collections et formats que l'appli web). */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { gameData, playerKey } from '../game-data.js';
import type { TroopCounts } from '../combat/combat.js';

/** Identifiant de document, comme dans l'appli. */
const docId = (name: string): string => encodeURIComponent(playerKey(name));

/** Niveaux d'un joueur tels que stockés dans `players`. */
export type PlayerLevels = Partial<Record<'ce' | 'academy' | 'chunninCenter' | 'jouninCenter' | 'hospital' | 'wall', number>>;

/** Dernière armée connue d'un joueur (la plus récente remplace l'ancienne). */
export async function saveArmy(player: string, troops: TroopCounts, side: 'Assaillant' | 'Défenseur' | null): Promise<void> {
  await db.collection('enemies').doc(docId(player)).set({ player, troops, side, updatedAt: new Date().toISOString() });
}

/** Met à jour les niveaux donnés ; un joueur inconnu est créé dans « Sans clan ». */
export async function savePlayerLevels(player: string, levels: PlayerLevels): Promise<void> {
  const ref = db.collection('players').doc(docId(player));
  const known = gameData.players.some((p) => playerKey(p.name) === playerKey(player));
  if (known) await ref.update(levels);
  else await ref.set({ name: player, village: '', clan: null, ...levels });
}

export async function addPlayer(name: string, village: string, clan: string | null): Promise<void> {
  await db.collection('players').doc(docId(name)).set({ name, village, clan });
}

export async function setPlayerClan(player: string, clan: string | null): Promise<void> {
  await db.collection('players').doc(docId(player)).update({ clan });
}

export async function addClan(name: string): Promise<void> {
  await db.collection('clans').doc(docId(name)).set({ name });
}

/** Supprime le clan ; ses joueurs passent « Sans clan ». */
export async function removeClan(name: string): Promise<number> {
  const members = gameData.players.filter((p) => p.clan === name);
  const batch = db.batch();
  batch.delete(db.collection('clans').doc(docId(name)));
  for (const p of members) batch.update(db.collection('players').doc(docId(p.name)), { clan: null });
  await batch.commit();
  return members.length;
}

/** Commentaire libre sur un joueur (vide = supprimé) ; un joueur inconnu est créé dans « Sans clan ». */
export async function savePlayerComment(player: string, comment: string, author: string): Promise<void> {
  const ref = db.collection('players').doc(docId(player));
  const known = gameData.players.some((p) => playerKey(p.name) === playerKey(player));
  const fields = comment
    ? { comment, commentBy: author, commentAt: new Date().toISOString() }
    : { comment: FieldValue.delete(), commentBy: FieldValue.delete(), commentAt: FieldValue.delete() };
  if (known) await ref.update(fields);
  else if (comment) await ref.set({ name: player, village: '', clan: null, ...fields });
}
