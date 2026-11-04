import { VillageDoc } from '../../core/game-data/map-villages';
import { joinPlayers } from './clans.data';
import { findPlayer, groupByClan, NO_CLAN, OWN_CLAN, SEED_CLANS, SEED_PLAYERS } from './clans.data';

describe('liste initiale', () => {
  it('contient les 148 joueurs et leurs clans', () => {
    expect(SEED_PLAYERS).toHaveLength(148);
    expect(SEED_CLANS).toContain(OWN_CLAN);
    expect(SEED_CLANS).not.toContain(NO_CLAN);
  });
});

describe('groupByClan', () => {
  const players = [
    { name: 'A', village: 'a', clan: 'Zeta' },
    { name: 'B', village: 'b', clan: null },
    { name: 'C', village: 'c', clan: 'Supprimé' },
  ];

  it('trie par nom, garde les clans vides et met « Sans Clans » en dernier', () => {
    const groups = groupByClan(players, ['Zeta', 'Alpha']);
    expect(groups.map((g) => g.name)).toEqual(['Alpha', 'Zeta', NO_CLAN]);
    expect(groups[0].players).toEqual([]);
  });

  it('range dans « Sans Clans » les joueurs d’un clan supprimé', () => {
    const noClan = groupByClan(players, ['Zeta']).find((g) => g.name === NO_CLAN);
    expect(noClan?.players.map((p) => p.name)).toEqual(['B', 'C']);
  });

  it('omet « Sans Clans » quand il est vide', () => {
    expect(groupByClan([players[0]], ['Zeta']).map((g) => g.name)).toEqual(['Zeta']);
  });
});

describe('findPlayer', () => {
  it('retrouve le joueur par son village (nom affiché dans les rapports)', () => {
    expect(findPlayer(SEED_PLAYERS, 'Tard')).toEqual({
      player: { name: 'Serpent', village: 'Tard', clan: OWN_CLAN },
      clan: OWN_CLAN,
    });
  });

  it('ignore la casse et les accents', () => {
    expect(findPlayer(SEED_PLAYERS, 'grece')?.player.name).toBe('Ody');
  });

  it('préfère le village quand un nom de joueur est identique', () => {
    // « Oasis » est le village de Timon et aussi un joueur (village Map).
    expect(findPlayer(SEED_PLAYERS, 'Oasis')?.player.name).toBe('Timon');
  });

  it('se rabat sur le nom du joueur, et donne « Sans Clans » sans clan', () => {
    expect(findPlayer(SEED_PLAYERS, 'Serpent')?.player.village).toBe('Tard');
    expect(findPlayer(SEED_PLAYERS, 'Neo')?.clan).toBe(NO_CLAN);
  });

  it('retourne null pour un inconnu', () => {
    expect(findPlayer(SEED_PLAYERS, 'Inconnu du bataillon')).toBeNull();
  });
});

describe('joinPlayers', () => {
  const village = (name: string, kage: string, clan: string | null, extra: Partial<VillageDoc> = {}): VillageDoc => ({
    name,
    kage,
    clan,
    x: 1,
    y: 2,
    points: 10,
    inhabitants: 20,
    neutral: false,
    ...extra,
  });

  it('crée un joueur par village, avec ce qui est saisi à la main', () => {
    expect(joinPlayers([village('Reggaeton', 'Jakojak', 'Yawata', { ce: 10, comment: 'À surveiller' })])).toEqual([
      { name: 'Jakojak', village: 'Reggaeton', clan: 'Yawata', points: 10, inhabitants: 20, ce: 10, comment: 'À surveiller' },
    ]);
  });

  it('ignore les villages neutres et les doublons du même joueur', () => {
    const villages = [village('Yuuno', 'Hinata', null, { neutral: true }), village('A', 'Bob', null), village('B', 'bob', null)];
    expect(joinPlayers(villages).map((p) => p.village)).toEqual(['A']);
  });

  it('garde un joueur ajouté à la main, sans coordonnées', () => {
    const { x: _x, y: _y, ...offMap } = village('Loin', 'Inconnu', null);
    expect(joinPlayers([offMap]).map((p) => p.name)).toEqual(['Inconnu']);
  });
});
