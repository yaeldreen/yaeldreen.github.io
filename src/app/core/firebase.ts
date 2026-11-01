import { FirebaseApp, initializeApp } from 'firebase/app';
import { FIREBASE_CONFIG } from './firebase-config';

export { FIREBASE_CONFIG };
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

export const isFirebaseConfigured = (): boolean => Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.appId);

let app: FirebaseApp | null = null;
export const firebaseApp = (): FirebaseApp => (app ??= initializeApp(FIREBASE_CONFIG));

let db: Firestore | null = null;
/** Base partagée, avec copie locale (IndexedDB) : affichage immédiat et écritures possibles hors ligne. */
export const firestoreDb = (): Firestore =>
  (db ??= initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  }));
