import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { deleteField, doc, DocumentReference, onSnapshot, setDoc } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../../core/firebase';
import { DEFENDER_KEY, emptyRoom, encodeRoom, Fighter, mergeRoom, RazRoomState } from './raz-room.logic';

/** Attente après la dernière frappe avant d'enregistrer un camp : évite une écriture par chiffre tapé. */
const SAVE_DELAY_MS = 400;

/**
 * Raz partagé en direct (document Firestore `raz/current`) : tout le monde voit les mêmes armées et le même rapport.
 * Chaque camp s'enregistre séparément, pour que deux personnes puissent remplir deux attaquants en même temps.
 * Si la base refuse (règles non publiées), la page reste utilisable sur cet appareil seulement.
 */
@Injectable()
export class RazRoom {
  private readonly ref: DocumentReference | null = isFirebaseConfigured() ? doc(firestoreDb(), 'raz', 'current') : null;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly initial = emptyRoom();
  readonly defender = signal(this.initial.defender);
  readonly attackers = signal(this.initial.attackers);
  readonly simulated = signal(false);
  readonly status = signal<'connecting' | 'live' | 'offline'>(this.ref ? 'connecting' : 'offline');

  constructor() {
    if (!this.ref) return;
    const stop = onSnapshot(
      this.ref,
      (snapshot) => {
        this.status.set('live');
        this.apply(mergeRoom(snapshot.data(), this.state(), new Set(this.timers.keys())));
      },
      () => this.status.set('offline'),
    );
    inject(DestroyRef).onDestroy(() => {
      this.flushAll();
      stop();
    });
  }

  private state(): RazRoomState {
    return { defender: this.defender(), attackers: this.attackers(), simulated: this.simulated() };
  }

  private apply({ defender, attackers, simulated }: RazRoomState): void {
    this.defender.set(defender);
    this.attackers.set(attackers);
    this.simulated.set(simulated);
  }

  private write(data: Record<string, unknown>, merge = true): void {
    if (!this.ref || this.status() === 'offline') return;
    setDoc(this.ref, { ...data, updatedAt: Date.now() }, { merge }).catch(() => this.status.set('offline'));
  }

  private saveLater(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.flush(key), SAVE_DELAY_MS));
  }

  private flush(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    if (key === DEFENDER_KEY) return this.write({ defender: this.defender() });
    const attacker = this.attackers().find((a) => String(a.id) === key);
    if (attacker) this.write({ attackers: { [key]: attacker } });
  }

  private flushAll(): void {
    for (const key of [...this.timers.keys()]) this.flush(key);
  }

  editDefender(change: (defender: Fighter) => Fighter): void {
    this.defender.update(change);
    this.saveLater(DEFENDER_KEY);
  }

  editAttacker(id: number, change: (attacker: Fighter) => Fighter): void {
    this.attackers.update((list) => list.map((a) => (a.id === id ? change(a) : a)));
    this.saveLater(String(id));
  }

  addAttacker(attacker: Fighter): void {
    this.attackers.update((list) => [...list, attacker]);
    this.write({ attackers: { [attacker.id]: attacker } });
  }

  removeAttacker(id: number): void {
    clearTimeout(this.timers.get(String(id)));
    this.timers.delete(String(id));
    this.attackers.update((list) => list.filter((a) => a.id !== id));
    this.write({ attackers: { [id]: deleteField() } });
  }

  setSimulated(simulated: boolean): void {
    this.flushAll();
    this.simulated.set(simulated);
    this.write({ simulated });
  }

  /** Remplace le raz de tout le monde (remise à zéro, raz repris de l'historique). */
  replaceAll(state: RazRoomState): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.apply(state);
    this.write(encodeRoom(state), false);
  }
}
