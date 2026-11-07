import { ageInDays, formatCreatedAt, hasChanges, isCreatedAtValid, isDefaultPhoto, parseCreatedAt, playerSheet, PlayerSheet, profilePhotoUrl, sheetChanges, sheetForm } from './player.logic';

const player = { name: 'Jakojak', village: 'Reggaeton', clan: 'Yawata', points: 100, inhabitants: 10, ce: 10 };
const village = { name: 'Reggaeton', kage: 'Jakojak', clan: 'Yawata', x: 1, y: 2, points: 100, inhabitants: 10, neutral: false, gameId: 107 };
const record = { player: 'Jakojak', troops: { genin: 1, chuunin: 2, jounin: 3 }, side: null, updatedAt: '2026-11-01T10:00:00.000Z' };
const snapshot = (points: number) => ({ month: '2026-11', takenAt: '', players: [{ n: 'Jakojak', c: 'Yawata', p: points, h: 10 }] });

describe('playerSheet', () => {
  it('regroupe le joueur, son village, son armée et son évolution, sans tenir compte de la casse', () => {
    const sheet = playerSheet('jakojak', [player], [village], { jakojak: record }, { previous: snapshot(40), current: snapshot(100) });
    expect(sheet?.player.ce).toBe(10);
    expect(sheet?.village?.gameId).toBe(107);
    expect(sheet?.record?.troops.jounin).toBe(3);
    expect(sheet?.evolution?.pointsDelta).toBe(60);
  });

  it('accepte un joueur sans armée, sans relevé, ni village de joueur', () => {
    const neutral = { ...village, neutral: true };
    expect(playerSheet('Jakojak', [player], [neutral], {}, { previous: null, current: null })).toEqual({ player, village: null, record: null, evolution: null });
  });

  it('ne trouve pas un joueur inconnu', () => {
    expect(playerSheet('Personne', [player], [village], {}, { previous: null, current: null })).toBeNull();
  });
});

describe('ageInDays', () => {
  it('compte les jours entiers écoulés, jamais négatifs', () => {
    const now = Date.parse('2026-11-05T12:00:00.000Z');
    expect(ageInDays('2026-11-05T01:00:00.000Z', now)).toBe(0);
    expect(ageInDays('2026-11-01T12:00:00.000Z', now)).toBe(4);
    expect(ageInDays('2026-11-06T12:00:00.000Z', now)).toBe(0);
  });
});

describe('profilePhotoUrl', () => {
  it('vise la photo du joueur par son identifiant du jeu', () => {
    expect(profilePhotoUrl(93)).toBe('https://worldofshinobi.com/api/profile-logo?id=93&size=128');
  });

  it('ne donne rien sans identifiant, ni pour un village neutre', () => {
    expect(profilePhotoUrl(undefined)).toBeNull();
    expect(profilePhotoUrl(-75)).toBeNull();
  });
});

describe('isDefaultPhoto', () => {
  it('reconnaît l’image par défaut du jeu à sa taille', () => {
    expect(isDefaultPhoto(150, 150)).toBe(true);
    expect(isDefaultPhoto(128, 86)).toBe(false);
  });
});

describe('parseCreatedAt', () => {
  it('lit les timestamps du jeu, en millisecondes ou en secondes', () => {
    expect(parseCreatedAt('1791380674853')).toBe('2026-10-07T13:44:34.853Z');
    expect(parseCreatedAt(' 1791380674 ')).toBe('2026-10-07T13:44:34.000Z');
  });

  it('lit une date, avec ou sans heure, et revient au même format', () => {
    expect(parseCreatedAt('07/10/2026')).toBe(new Date(2026, 9, 7).toISOString());
    expect(formatCreatedAt(parseCreatedAt('07/10/2026 15:44')!)).toBe('07/10/2026 15:44');
    expect(parseCreatedAt('7/10/2026 15h44')).toBe(new Date(2026, 9, 7, 15, 44).toISOString());
  });

  it('refuse ce qui n’est pas une vraie date', () => {
    expect(parseCreatedAt('31/02/2026')).toBeNull();
    expect(parseCreatedAt('07/10/2026 25:00')).toBeNull();
    expect(parseCreatedAt('12345')).toBeNull();
  });
});

describe('modification de la fiche', () => {
  const sheet: PlayerSheet = { player: { ...player, comment: 'À surveiller' }, village, record, evolution: null };
  const form = () => sheetForm(sheet);

  it('préremplit le formulaire et ne voit aucun changement', () => {
    expect(form().stats.ce).toBe(10);
    expect(form().stats.wall).toBeNull();
    expect(form().troops.chuunin).toBe(2);
    expect(hasChanges(sheetChanges(sheet, form()))).toBe(false);
  });

  it('ne retient que ce qui change', () => {
    const edited = form();
    edited.stats.ce = 12;
    edited.stats.wall = 4;
    edited.troops.genin = 9;
    expect(sheetChanges(sheet, edited)).toEqual({ stats: { ce: 12, wall: 4 }, troops: { genin: 9, chuunin: 2, jounin: 3 }, createdAt: null, comment: null });
  });

  it('efface un niveau vidé, mais jamais les points ou les habitants', () => {
    const edited = form();
    edited.stats.ce = null;
    edited.stats.points = null;
    edited.stats.inhabitants = null;
    expect(sheetChanges(sheet, edited).stats).toEqual({ ce: null });
  });

  it('borne les niveaux et ramène les nombres à des entiers positifs', () => {
    const edited = form();
    edited.stats.ce = 99;
    edited.stats.points = 150.7;
    edited.troops.genin = -3;
    const changes = sheetChanges(sheet, edited);
    expect(changes.stats).toEqual({ ce: 20, points: 150 });
    expect(changes.troops?.genin).toBe(0);
  });

  it('compte une troupe vide pour 0, et ne crée pas d’armée si tout est vide', () => {
    const noArmy: PlayerSheet = { ...sheet, record: null };
    const edited = sheetForm(noArmy);
    expect(sheetChanges(noArmy, edited).troops).toBeNull();
    edited.troops.jounin = 5;
    expect(sheetChanges(noArmy, edited).troops).toEqual({ genin: 0, chuunin: 0, jounin: 5 });
  });

  it('modifie ou efface la date de création', () => {
    const edited = form();
    edited.createdAt = '1791380674853';
    expect(sheetChanges(sheet, edited).createdAt).toBe('2026-10-07T13:44:34.853Z');
    const known: PlayerSheet = { ...sheet, player: { ...sheet.player, createdAt: '2026-10-07T13:44:34.853Z' } };
    expect(hasChanges(sheetChanges(known, sheetForm(known)))).toBe(false);
    expect(sheetChanges(known, { ...sheetForm(known), createdAt: '' }).createdAt).toBe('');
  });

  it('n’enregistre pas une date illisible', () => {
    const edited = form();
    edited.createdAt = 'hier';
    expect(sheetChanges(sheet, edited).createdAt).toBeNull();
    expect(isCreatedAtValid('hier')).toBe(false);
    expect(isCreatedAtValid('')).toBe(true);
  });

  it('modifie ou efface le commentaire', () => {
    const edited = form();
    edited.comment = '  Nouveau  ';
    expect(sheetChanges(sheet, edited).comment).toBe('Nouveau');
    edited.comment = '';
    expect(sheetChanges(sheet, edited).comment).toBe('');
  });
});
