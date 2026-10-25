import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';

/**
 * Configuration web du projet Firebase « tsukuyomi-hub ».
 * Console Firebase → Paramètres du projet → Vos applications → application Web (</>).
 * Ces valeurs sont publiques par nature : ce sont les règles Firestore (firestore.rules) qui décident des accès.
 */
export const FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyCBB3-ETMUoHhO-GVnoVThyqXVt_7RSzmg',
  authDomain: 'tsukuyomi-hub.firebaseapp.com',
  projectId: 'tsukuyomi-hub',
  storageBucket: 'tsukuyomi-hub.firebasestorage.app',
  messagingSenderId: '1015865872211',
  appId: '1:1015865872211:web:53b3017046f7df09391ba6',
};

export const isFirebaseConfigured = (): boolean => Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.appId);

let app: FirebaseApp | null = null;
export const firebaseApp = (): FirebaseApp => (app ??= initializeApp(FIREBASE_CONFIG));
