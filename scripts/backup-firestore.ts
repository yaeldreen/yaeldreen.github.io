// Sauvegarde dans backups/ tout ce que la base laisse lire. `buildingHistory` et `discordUsers` n'en font pas partie (lecture interdite).
// Lancer : npx --yes tsx scripts/backup-firestore.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { FIREBASE_CONFIG } from '../src/app/core/firebase-config';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const COLLECTIONS = ['villages', 'clans', 'snapshots', 'raz', 'gameData'];

async function list(collection: string): Promise<unknown[]> {
  const docs: unknown[] = [];
  let token = '';
  do {
    const response = await fetch(`${BASE}/${collection}?pageSize=300&key=${FIREBASE_CONFIG.apiKey}${token ? `&pageToken=${token}` : ''}`);
    if (!response.ok) throw new Error(`Lecture de ${collection} : HTTP ${response.status}`);
    const page = (await response.json()) as { documents?: unknown[]; nextPageToken?: string };
    docs.push(...(page.documents ?? []));
    token = page.nextPageToken ?? '';
  } while (token);
  return docs;
}

async function main(): Promise<void> {
  const collections: Record<string, unknown[]> = {};
  for (const name of COLLECTIONS) collections[name] = await list(name);
  // `meta` ne peut pas être listée : seul son document du mot de passe est lisible.
  const access = await fetch(`${BASE}/meta/access?key=${FIREBASE_CONFIG.apiKey}`);
  if (!access.ok) throw new Error(`Lecture de meta/access : HTTP ${access.status}`);
  collections['meta'] = [await access.json()];
  // Une carte vide est le signe d'un problème : mieux vaut un échec visible qu'une sauvegarde vide.
  if (!collections['villages'].length) throw new Error('Aucun village lu : sauvegarde annulée.');
  mkdirSync('backups', { recursive: true });
  const takenAt = new Date().toISOString();
  const file = `backups/sauvegarde-${takenAt.replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({ takenAt, collections }));
  console.log(`${file} : ${Object.entries(collections).map(([name, docs]) => `${name} ${docs.length}`).join(' · ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
