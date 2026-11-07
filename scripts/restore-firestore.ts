// Remet dans la base les villages et les clans d'une sauvegarde : les documents absents sont recréés, ceux qui existent remplacés.
// Rien n'est supprimé. Les autres collections se restaurent à la main, dans la console Firebase.
// Sans --apply, affiche seulement ce qui serait fait.
// Lancer : npx --yes tsx scripts/restore-firestore.ts backups/sauvegarde-….json [--apply]
import { readFileSync } from 'node:fs';
import { FIREBASE_CONFIG } from '../src/app/core/firebase-config';

interface RawDoc {
  name: string;
  fields: Record<string, unknown>;
}

const KEY = FIREBASE_CONFIG.apiKey;
const RESTORED = ['villages', 'clans'];
const docUrl = (doc: RawDoc) => `https://firestore.googleapis.com/v1/${doc.name.split('/').map(encodeURIComponent).join('/')}?key=${KEY}`;
const canon = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(canon) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canon(v)])) : value;

async function main(): Promise<void> {
  const [file] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!file) throw new Error('Indiquez le fichier de sauvegarde.');
  const apply = process.argv.includes('--apply');
  const backup = JSON.parse(readFileSync(file, 'utf8')) as { takenAt: string; collections: Record<string, RawDoc[]> };
  console.log(`Sauvegarde du ${backup.takenAt}`);
  for (const collection of RESTORED) {
    const saved = backup.collections[collection] ?? [];
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collection}?pageSize=500&key=${KEY}`);
    if (!response.ok) throw new Error(`Lecture de ${collection} : HTTP ${response.status}`);
    const current = new Map(((await response.json()) as { documents?: RawDoc[] }).documents?.map((d) => [d.name, d]) ?? []);
    const changed = saved.filter((d) => JSON.stringify(canon(current.get(d.name)?.fields)) !== JSON.stringify(canon(d.fields)));
    const missing = changed.filter((d) => !current.has(d.name)).length;
    const extra = [...current.keys()].filter((name) => !saved.some((d) => d.name === name)).length;
    console.log(`${collection} : ${saved.length} sauvegardés · ${missing} à recréer · ${changed.length - missing} à remplacer · ${extra} en plus dans la base, conservés`);
    if (!apply) continue;
    for (const doc of changed) {
      const write = await fetch(docUrl(doc), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: doc.fields }) });
      if (!write.ok) throw new Error(`Écriture de ${doc.name} : HTTP ${write.status}`);
    }
    console.log(`${collection} : ${changed.length} documents écrits.`);
  }
  if (!apply) console.log('Rien n’a été modifié. Ajouter --apply pour exécuter.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
