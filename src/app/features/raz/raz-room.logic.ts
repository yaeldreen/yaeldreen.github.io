import { emptySide } from '../combat/army-form';
import { SideForm } from '../combat/combat-history';

export interface Fighter {
  /** Le même pour tout le monde, et croissant : il donne l'ordre des attaquants. */ id: number;
  player: string;
  loaded: string | null;
  form: SideForm;
}

export interface RazRoomState {
  defender: Fighter;
  attackers: Fighter[];
  /** Le rapport est affiché pour tout le monde. */ simulated: boolean;
}

/** Clé du camp en cours de saisie : `defender` ou l'identifiant de l'attaquant. */
export const DEFENDER_KEY = 'defender';

let lastId = 0;

/** Identifiant unique entre appareils : l'heure en microsecondes, plus un peu de hasard. */
export function newFighter(form: SideForm = emptySide(), player = ''): Fighter {
  lastId = Math.max(Date.now() * 1000 + Math.floor(Math.random() * 1000), lastId + 1);
  return { id: lastId, player, loaded: null, form };
}

export const emptyRoom = (): RazRoomState => ({ defender: newFighter(), attackers: [newFighter()], simulated: false });

const isFighter = (value: unknown): value is Fighter => {
  const f = value as Partial<Fighter> | null;
  return Number.isFinite(f?.id) && typeof f?.player === 'string' && !!f.form?.troops && !!f.form.levels;
};

/**
 * Applique le document partagé sur l'état local. Un camp encore en attente d'enregistrement (`pending`) garde sa
 * saisie locale, pour ne pas effacer ce qui est en train d'être tapé. Sans attaquant dans la base, on garde ceux de l'écran.
 */
export function mergeRoom(remote: unknown, local: RazRoomState, pending: ReadonlySet<string>): RazRoomState {
  const data = (remote ?? {}) as { defender?: unknown; attackers?: Record<string, unknown>; simulated?: unknown };
  const fromBase = Object.values(data.attackers ?? {}).filter(isFighter);
  const kept = local.attackers.filter((a) => pending.has(String(a.id)));
  const attackers = [...fromBase.filter((a) => !pending.has(String(a.id))), ...kept].sort((a, b) => a.id - b.id);
  return {
    defender: !pending.has(DEFENDER_KEY) && isFighter(data.defender) ? data.defender : local.defender,
    attackers: attackers.length ? attackers : local.attackers,
    simulated: data.simulated === true,
  };
}

/** Document complet, pour remplacer le raz de tout le monde. */
export const encodeRoom = ({ defender, attackers, simulated }: RazRoomState) => ({
  defender,
  attackers: Object.fromEntries(attackers.map((a) => [String(a.id), a])),
  simulated,
});
