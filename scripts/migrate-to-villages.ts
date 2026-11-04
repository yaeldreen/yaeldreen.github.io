// Copie les infos saisies à la main (`players`) et les armées (`enemies`) vers `villages`, puis supprime ces deux collections.
// Sans option : affiche seulement ce qui serait fait. À exécuter une fois l'appli déployée et les règles publiées.
// Lancer : npx --yes tsx scripts/migrate-to-villages.ts [--apply]
import { mkdirSync, writeFileSync } from 'node:fs';
import { FIREBASE_CONFIG } from '../src/app/core/firebase-config';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const KEY = FIREBASE_CONFIG.apiKey;
const NOTE_FIELDS = ['ce', 'academy', 'chunninCenter', 'jouninCenter', 'hospital', 'wall', 'comment', 'commentBy', 'commentAt'];

type Fields = Record<string, Record<string, unknown>>;
interface RawDoc {
  name: string;
  fields: Fields;
}

const docId = (doc: RawDoc) => doc.name.split('/').pop() ?? '';
/** Adresse d'un document : ses identifiants peuvent contenir « % » ou des espaces, à encoder dans l'URL. */
const docUrl = (doc: RawDoc) => `https://firestore.googleapis.com/v1/${doc.name.split('/').map(encodeURIComponent).join('/')}`;
const text = (doc: RawDoc, field: string) => String(doc.fields[field]?.['stringValue'] ?? '');
const key = (name: string) => name.trim().toLocaleLowerCase('fr');

async function list(collection: string): Promise<RawDoc[]> {
  const docs: RawDoc[] = [];
  let token = '';
  do {
    const response = await fetch(`${BASE}/${collection}?pageSize=300&key=${KEY}${token ? `&pageToken=${token}` : ''}`);
    if (!response.ok) throw new Error(`Lecture de ${collection} : HTTP ${response.status}`);
    const page = (await response.json()) as { documents?: RawDoc[]; nextPageToken?: string };
    docs.push(...(page.documents ?? []));
    token = page.nextPageToken ?? '';
  } while (token);
  return docs;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const [players, enemies, villages] = await Promise.all([list('players'), list('enemies'), list('villages')]);

  // Le document affiché par l'appli pour ce joueur : celui à l'identifiant habituel, sinon le premier.
  const villageOf = (player: string): RawDoc | undefined => {
    const candidates = villages.filter((v) => !v.fields['neutral']?.['booleanValue'] && key(text(v, 'kage')) === key(player));
    return candidates.find((v) => docId(v) === encodeURIComponent(key(text(v, 'name')))) ?? candidates[0];
  };

  const plan = new Map<string, { village: RawDoc; fields: Fields; labels: string[] }>();
  const add = (village: RawDoc, fields: Fields, label: string) => {
    const entry = plan.get(village.name) ?? { village, fields: {}, labels: [] };
    Object.assign(entry.fields, fields);
    entry.labels.push(label);
    plan.set(village.name, entry);
  };

  const keptPlayers: RawDoc[] = [];
  for (const player of players) {
    const notes = Object.fromEntries(NOTE_FIELDS.flatMap((f) => (player.fields[f] && !('nullValue' in player.fields[f]) ? [[f, player.fields[f]]] : []))) as Fields;
    if (!Object.keys(notes).length) continue;
    const village = villageOf(text(player, 'name'));
    if (village) add(village, notes, Object.keys(notes).join(', '));
    else keptPlayers.push(player);
  }

  const keptEnemies: RawDoc[] = [];
  for (const enemy of enemies) {
    const village = villageOf(text(enemy, 'player'));
    if (!village) {
      keptEnemies.push(enemy);
      continue;
    }
    const { troops, side, updatedAt } = enemy.fields;
    add(village, { army: { mapValue: { fields: { troops, side: side ?? { nullValue: null }, updatedAt } } } }, 'armée');
  }

  console.log(`players : ${players.length} · enemies : ${enemies.length} · villages : ${villages.length}`);
  console.log(`Villages complétés (${plan.size}) :`);
  for (const { village, labels } of plan.values()) console.log(`  ${text(village, 'kage')} (${text(village, 'name')}) : ${labels.join(' + ')}`);
  console.log('Fiches conservées, sans village :', keptPlayers.map((p) => text(p, 'name')));
  console.log('Armées conservées, sans village :', keptEnemies.map((e) => text(e, 'player')));
  const keep = new Set([...keptPlayers, ...keptEnemies].map((d) => d.name));
  const toDelete = [...players, ...enemies].filter((d) => !keep.has(d.name));
  console.log(`Documents à supprimer : ${toDelete.length}`);

  if (!apply) {
    console.log('\nRien n’a été modifié. Ajouter --apply pour exécuter.');
    return;
  }
  mkdirSync('backups', { recursive: true });
  const backup = `backups/avant-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(backup, JSON.stringify({ players, enemies, villages }, null, 2));
  console.log(`\nSauvegarde : ${backup}`);
  for (const { village, fields } of plan.values()) {
    // La règle valide le document entier : un ancien document sans `neutral` doit le recevoir.
    const body = { ...fields, ...(village.fields['neutral'] ? {} : { neutral: { booleanValue: false } }) };
    const mask = Object.keys(body).map((f) => `updateMask.fieldPaths=${f}`).join('&');
    const response = await fetch(`${docUrl(village)}?${mask}&key=${KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: body }),
    });
    if (!response.ok) throw new Error(`Copie vers ${text(village, 'name')} : HTTP ${response.status}. Rien n'a été supprimé.`);
  }
  for (const doc of toDelete) {
    const response = await fetch(`${docUrl(doc)}?key=${KEY}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Suppression de ${doc.name} : HTTP ${response.status}`);
  }
  console.log(`${plan.size} villages complétés, ${toDelete.length} documents supprimés.`);
}

void main();
