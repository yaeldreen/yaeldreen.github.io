// Envoie data/game-data.json dans Firestore : un document `gameData/<partie>` par partie du fichier.
// Lancer depuis bot/ : npm run seed:game-data   (avec GOOGLE_APPLICATION_CREDENTIALS, voir .env.example)
import { readFileSync } from 'node:fs';
import { db } from './firebase.js';

const data = JSON.parse(readFileSync(new URL('../../data/game-data.json', import.meta.url), 'utf8')) as Record<string, object>;
const batch = db.batch();
const updatedAt = new Date().toISOString();
for (const [part, content] of Object.entries(data)) {
  batch.set(db.collection('gameData').doc(part), { ...content, updatedAt, updatedBy: 'seed' });
}
await batch.commit();
console.log(`gameData : ${Object.keys(data).join(', ')} envoyés.`);
