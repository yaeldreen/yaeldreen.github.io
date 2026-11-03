/** Camps de combat partagés par #simu-combat et #simu-raz : préremplissage et formulaire d'armée. */
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { findPlayer, gameData, linkedProfiles, MemberProfile, playerKey } from '../game-data.js';
import type { CombatData } from './combat.js';
import { emptySide, formValues, SideForm } from './combat-form.js';

export function combatData(): CombatData | null {
  return gameData.combat && gameData.buildings
    ? { rules: gameData.combat, buildings: gameData.buildings }
    : null;
}

/** Niveaux saisis par un membre Discord (`!mesNiveaux`) appliqués à un camp : ils passent avant ceux de la base. */
export function withMemberLevels(side: SideForm, profile: MemberProfile | undefined): SideForm {
  if (!profile) return side;
  const l = side.levels;
  return {
    ...side,
    levels: {
      training: profile.ce ?? l.training,
      academy: profile.academy ?? l.academy,
      chunnin: profile.chunnin ?? l.chunnin,
      jounin: profile.jounin ?? l.jounin,
      hospital: profile.hospital ?? l.hospital,
      wall: profile.wall ?? l.wall,
    },
  };
}

/** Réglages des membres reliés, par joueur (pour préremplir un camp avec les niveaux du membre). */
export async function profilesByPlayer(): Promise<Map<string, MemberProfile>> {
  return new Map(
    (await linkedProfiles())
      .filter((m) => m.profile.player)
      .map((m) => [playerKey(m.profile.player!), m.profile]),
  );
}

/** Camp prérempli avec un joueur connu : niveaux renseignés, ceux du membre Discord relié, et dernière armée connue. */
export function prefillSide(name: string, members: Map<string, MemberProfile>): SideForm | null {
  const p = findPlayer(name);
  if (!p) return null;
  const army = gameData.armies.get(playerKey(p.name));
  const side: SideForm = {
    ...emptySide(),
    player: p.name,
    troops: army ? { ...army.troops } : { genin: null, chuunin: null, jounin: null },
    levels: {
      training: p.ce ?? null,
      academy: p.academy ?? null,
      chunnin: p.chunninCenter ?? null,
      jounin: p.jouninCenter ?? null,
      hospital: p.hospital ?? null,
      wall: p.wall ?? null,
    },
  };
  return withMemberLevels(side, members.get(playerKey(p.name)));
}

/** Camp du membre qui lance la commande : son joueur relié et ses niveaux (troupes à saisir ou à optimiser). */
export function mySide(profile: MemberProfile, members: Map<string, MemberProfile>): SideForm {
  const base = profile.player ? prefillSide(profile.player, members) : null;
  return withMemberLevels(
    base ? { ...base, troops: { genin: null, chuunin: null, jounin: null } } : emptySide(),
    profile,
  );
}

export const hasLevels = (p: MemberProfile): boolean =>
  [p.ce, p.academy, p.chunnin, p.jounin, p.hospital, p.wall].some((v) => v !== undefined);

/**
 * Formulaire d'un camp : joueur (préremplit), troupes, niveaux, hôpital, et mur pour un défenseur.
 * `customId` identifie la fiche et le camp (ex. « combat:modal:attacker »).
 */
export function sideModal(customId: string, title: string, form: SideForm, defending: boolean): ModalBuilder {
  const values = formValues(form);
  const input = (id: string, label: string, placeholder: string, value: string) => {
    const field = new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setPlaceholder(placeholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    if (value) field.setValue(value);
    return new ActionRowBuilder<TextInputBuilder>().addComponents(field);
  };
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      input('player', 'Joueur (nom ou village : préremplit)', 'Ex. Tard', values.player),
      input('troops', 'Troupes : Genin Chuunin Jounin', 'Ex. 500 300 100', values.troops),
      input(
        'levels',
        'Niveaux : CE Académie Chuunin Jounin',
        'Ex. 11 8 8 5  (? si inconnu)',
        values.levels,
      ),
      input('hospital', 'Hôpital (niveau)', 'Ex. 5', values.hospital),
    );
  if (defending)
    modal.addComponents(input('wall', "Mur d'enceinte (niveau)", 'Ex. 7', values.wall));
  return modal;
}

