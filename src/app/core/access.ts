import { Injectable, signal } from '@angular/core';
import { readStored, writeStored } from '../shared/utils/storage';
import { FIREBASE_CONFIG } from './firebase-config';

export type AccessStatus = 'checking' | 'locked' | 'unlocked';

const ACCESS_DOC = ['meta', 'access'] as const;
const STORED_KEY = 'access.hash';
const UNAVAILABLE = 'Vérification impossible : connexion à la base indisponible. Réessayez.';

/** Firebase n'est chargé qu'à la demande : l'écran du mot de passe s'affiche sans attendre ce gros module. */
async function accessDoc() {
  const [{ doc, getDoc }, { firestoreDb }] = await Promise.all([import('firebase/firestore'), import('./firebase')]);
  return { ref: doc(firestoreDb(), ...ACCESS_DOC), getDoc };
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

  /** Sans mot de passe lisible dans la base, l'accès reste fermé : aucun mot de passe de secours n'est écrit dans le code. */
  private async load(): Promise<void> {
    try {
      const { ref, getDoc } = await accessDoc();
      const snapshot = await getDoc(ref);
      this.expected = snapshot.exists() ? (snapshot.data() as { hash: string }).hash : null;
    } catch {
      this.expected = null;
    }
    this.error.set(this.expected ? null : UNAVAILABLE);
    this.status.set(this.expected && readStored(STORED_KEY) === this.expected ? 'unlocked' : 'locked');
  }

  async unlock(password: string): Promise<boolean> {
    if (!this.expected) await this.load();
    if (!this.expected) return false;
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
}
