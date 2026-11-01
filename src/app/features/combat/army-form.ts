import { findPlayer, Player } from '../enemies/clans.data';
import { EnemyRecord, playerKey, TROOPS } from '../enemies/enemies.model';
import { LevelKey, SideForm } from './combat-history';
import { Army } from './combat.logic';

export const LEVEL_MAX = 20;

export const LEVEL_FIELDS: readonly { key: LevelKey; label: string; icon: string }[] = [
  { key: 'training', label: "Camp d'entraînement", icon: 'fa-dumbbell' },
  { key: 'academy', label: 'Académie', icon: 'fa-graduation-cap' },
  { key: 'chunnin', label: 'Centre Chuunin', icon: 'fa-user-ninja' },
  { key: 'jounin', label: 'Centre Jounin', icon: 'fa-user-shield' },
  { key: 'hospital', label: 'Hôpital', icon: 'fa-hospital' },
  { key: 'wall', label: "Mur d'enceinte", icon: 'fa-shield' },
];

export const clamp = (value: number | null, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));

export const toArmy = ({ troops: t, levels: l, hospitalTicket, combatTicket }: SideForm): Army => {
  const count = (v: number | null) => clamp(v, 0, Infinity);
  const level = (v: number | null) => clamp(v, 0, LEVEL_MAX);
  return {
    troops: { genin: count(t.genin), chuunin: count(t.chuunin), jounin: count(t.jounin) },
    levels: {
      training: level(l.training),
      academy: level(l.academy),
      chunnin: level(l.chunnin),
      jounin: level(l.jounin),
      wall: level(l.wall),
      hospital: level(l.hospital),
    },
    hospitalTicket,
    combatTicket,
  };
};

/** Camp vide : les pages démarrent sans aucune valeur. */
export const emptySide = (): SideForm => ({
  troops: { genin: null, chuunin: null, jounin: null },
  levels: { training: null, academy: null, chunnin: null, jounin: null, wall: null, hospital: null },
  hospitalTicket: false,
  combatTicket: false,
});

/**
 * Un joueur reconnu (nom ou village) préremplit un camp avec ce qu'on sait de lui (infos enemis) :
 * dernière armée connue et niveaux renseignés. Les cases inconnues sont vidées ; les tickets ne changent pas.
 * Retourne null si le joueur n'est pas reconnu.
 */
export function prefillFromPlayer(
  players: readonly Player[],
  records: Record<string, EnemyRecord>,
  form: SideForm,
  name: string,
): { form: SideForm; loaded: string } | null {
  const match = findPlayer(players, name);
  if (!match) return null;
  const p = match.player;
  const record = records[playerKey(p.name)];
  const fromPlayer: Record<LevelKey, number | null | undefined> = {
    training: p.ce,
    academy: p.academy,
    chunnin: p.chunninCenter,
    jounin: p.jouninCenter,
    hospital: p.hospital,
    wall: p.wall,
  };
  const levels = { ...form.levels };
  let known = 0;
  for (const key of Object.keys(fromPlayer) as LevelKey[]) {
    levels[key] = fromPlayer[key] ?? null;
    if (levels[key] !== null) known++;
  }
  const filled = (record ? TROOPS.length : 0) + known;
  return {
    form: { ...form, troops: record ? { ...record.troops } : { genin: null, chuunin: null, jounin: null }, levels },
    loaded: `${p.name} (${p.village}) : ${filled} champ(s) prérempli(s).`,
  };
}
