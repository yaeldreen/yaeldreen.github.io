/** Réglages du bot, lus dans les variables d'environnement (fichier bot/.env en local). */

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name} (voir bot/.env.example).`);
  return value;
};

export const config = {
  /** Lu seulement à la connexion (les tests n'en ont pas besoin). */
  get token(): string {
    return required('DISCORD_TOKEN');
  },
  /** Serveur du clan (sert à retirer les commandes « / » d'une version précédente du bot). */
  guildId: process.env['ID_SERVEUR'] || undefined,
  /** Rôle Discord autorisé à modifier les données de jeu. */
  editorRole: process.env['EDITOR_ROLE'] ?? 'Éditeur HUB',
  /** Nom de chaque salon, un par onglet de l'appli. */
  channels: {
    buildGuide: process.env['CHANNEL_BUILD_GUIDE'] ?? 'build-guide',
    simuConstru: process.env['CHANNEL_SIMU_CONSTRU'] ?? 'simu-constru',
    simuCombat: process.env['CHANNEL_SIMU_COMBAT'] ?? 'simu-combat',
    retours: process.env['CHANNEL_RETOURS'] ?? 'retours',
    gestionJoueurs: process.env['CHANNEL_GESTION_JOUEURS'] ?? 'gestion-joueurs',
    plusProche: process.env['CHANNEL_PLUS_PROCHE'] ?? 'plus-proche',
    infosEnnemis: process.env['CHANNEL_INFOS_ENNEMIS'] ?? 'infos-ennemis',
    pillages: process.env['CHANNEL_PILLAGES'] ?? 'pillages',
    calculSeconde: process.env['CHANNEL_CALCUL_SECONDE'] ?? 'calcul-seconde',
    simuRaz: process.env['CHANNEL_SIMU_RAZ'] ?? 'simu-raz',
  },
  /** Délai pour répondre à une question du bot. */
  answerTimeoutMs: 3 * 60_000,
};
