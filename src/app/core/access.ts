import { Injectable, signal } from '@angular/core';
import { readStored, writeStored } from '../shared/utils/storage';
import { FIREBASE_CONFIG } from './firebase-config';

export type AccessStatus = 'checking' | 'locked' | 'unlocked';

const ACCESS_DOC = ['meta', 'access'] as const;
const STORED_KEY = 'access.hash';
/** Empreinte du premier mot de passe, posée dans la base si elle n'y est pas encore. */
const FIRST_PASSWORD_HASH = 'a8929c75be21efb27824a7f8e656130a1d323c336f4f85b9f22e68fec0261dd8';

/** Firebase n'est chargé qu'à la demande : l'écran du mot de passe s'affiche sans attendre ce gros module. */
async function accessDoc() {
  const [{ doc, getDoc, setDoc }, { firestoreDb }] = await Promise.all([import('firebase/firestore'), import('./firebase')]);
  return { ref: doc(firestoreDb(), ...ACCESS_DOC), getDoc, setDoc };
}

/** SHA-256 (hexadécimal) du mot de passe : la base ne garde que cette empreinte, jamais le mot de passe. */
export async function passwordHash(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tsukuyomi-hub:${password}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mot de passe d'accès à l'application, partagé par le clan et stocké (en empreinte) dans `meta/access`.
 * Une fois saisi, il est retenu dans ce navigateur jusqu'à ce qu'il change dans la base.
 * C'est une porte d'entrée, pas une protection des données : la base Firestore reste lisible sans mot de passe.
 */
@Injectable({ providedIn: 'root' })
export class AccessGate {
  readonly status = signal<AccessStatus>(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.appId ? 'checking' : 'unlocked');
  readonly error = signal<string | null>(null);
  private expected: string | null = null;

  constructor() {
    if (this.status() === 'checking') void this.load();
  }

  private async load(): Promise<void> {
    try {
      const { ref, getDoc, setDoc } = await accessDoc();
      const snapshot = await getDoc(ref);
      this.expected = snapshot.exists() ? (snapshot.data() as { hash: string }).hash : FIRST_PASSWORD_HASH;
      if (!snapshot.exists()) await setDoc(ref, { hash: FIRST_PASSWORD_HASH }).catch(() => undefined);
    } catch {
      // Hors ligne sans copie locale : on retombe sur le premier mot de passe.
      this.expected = FIRST_PASSWORD_HASH;
    }
    this.status.set(readStored(STORED_KEY) === this.expected ? 'unlocked' : 'locked');
  }

  async unlock(password: string): Promise<boolean> {
    const hash = await passwordHash(password);
    if (hash !== this.expected) {
      this.error.set('Mot de passe incorrect.');
      return false;
    }
    writeStored(STORED_KEY, hash);
    this.error.set(null);
    this.status.set('unlocked');
    return true;
  }

  /** Change le mot de passe de tout le clan (le mot de passe actuel est demandé). */
  async change(current: string, next: string): Promise<string | null> {
    if ((await passwordHash(current)) !== this.expected) return 'Mot de passe actuel incorrect.';
    if (next.trim().length < 4) return 'Le nouveau mot de passe doit faire au moins 4 caractères.';
    const hash = await passwordHash(next.trim());
    try {
      const { ref, setDoc } = await accessDoc();
      await setDoc(ref, { hash, previous: this.expected });
    } catch {
      return 'Changement refusé par la base : vérifiez que les règles Firestore sont publiées.';
    }
    this.expected = hash;
    writeStored(STORED_KEY, hash);
    return null;
  }
}
