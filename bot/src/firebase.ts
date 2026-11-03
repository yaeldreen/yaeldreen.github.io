import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Accès administrateur à Firestore (compte de service) : ignore les règles de sécurité,
 * c'est donc le bot qui contrôle qui peut modifier quoi (rôle Discord).
 */
initializeApp({ credential: applicationDefault(), projectId: 'tsukuyomi-hub' });

export const db = getFirestore();
