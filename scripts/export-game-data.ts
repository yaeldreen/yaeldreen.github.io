// Export unique des données de jeu codées en dur vers data/game-data.json (source de l'envoi dans Firestore).
// Lancer : npx --yes tsx scripts/export-game-data.ts
import { readFileSync, writeFileSync } from 'node:fs';
import {
  ACADEMY_LEVELS, CHUNNIN_LEVELS, COMMERCE_LEVELS, FOOD_DEPOT_LEVELS, HIGH_COUNCIL_LEVELS, HOSPITAL_LEVELS, HQ_LEVELS,
  JOUNIN_LEVELS, MINE_LEVELS, RAPTOR_LEVELS, RESERVE_LEVELS, RESOURCE_DEPOT_LEVELS, TRAINING_CENTER_LEVELS, WALL_LEVELS,
  WATCHTOWER_LEVELS,
} from '../src/app/features/buildings/buildings.data';
import { TRAVEL_SPEEDS } from '../src/app/core/game-data/travel-speeds';
import {
  ATTACKER_LOSS_FACTOR, BASE_POWER, COMBAT_TICKET_MULTIPLIER, DEFENDER_LOSS_RANGE, DEFENSE_WINS, HOSPITAL_TICKET_BONUS,
  KILL_POINTS, PRODUCTION_MINUTES,
} from '../src/app/features/combat/combat.logic';
import { TROOP_TYPES } from '../src/app/features/plunder/plunder.data';
import { FIELD_COUNTS } from '../src/app/features/production/production.logic';

const buildings = {
  hq: { name: 'Quartier général', levels: HQ_LEVELS },
  training: { name: "Camp d'entraînement", levels: TRAINING_CENTER_LEVELS },
  academy: { name: 'Académie', levels: ACADEMY_LEVELS },
  chunnin: { name: 'Centre Chuunin', levels: CHUNNIN_LEVELS },
  jounin: { name: 'Centre Jounin', levels: JOUNIN_LEVELS },
  watchtower: { name: 'Tour de garde', levels: WATCHTOWER_LEVELS },
  wall: { name: "Mur d'enceinte", levels: WALL_LEVELS },
  hospital: { name: 'Hôpital', levels: HOSPITAL_LEVELS },
  mine: { name: 'Mines et champs', levels: MINE_LEVELS },
  resourceDepot: { name: 'Dépôt de ressources', levels: RESOURCE_DEPOT_LEVELS },
  foodDepot: { name: 'Dépôt de nourriture', levels: FOOD_DEPOT_LEVELS },
  reserve: { name: 'Réserve', levels: RESERVE_LEVELS },
  raptor: { name: 'Élevage de rapaces', levels: RAPTOR_LEVELS },
  commerce: { name: 'Commerces', levels: COMMERCE_LEVELS },
  highCouncil: { name: 'Haut Conseil', levels: HIGH_COUNCIL_LEVELS },
};

// Arbre des constructions : description et prérequis de chaque bâtiment.
const tree = readFileSync('src/app/shared/utils/prerequis.txt', 'utf8')
  .split(/\n(?=[^\n]+\n[^\n]+\n[^\n]+\n\nPrérequis)/)
  .flatMap((block) => {
    const m = /^([^\n]+)\n[^\n]+\n([^\n]+)\n\nPrérequis : ([^\n]+)/.exec(block.trim().replace(/^BuildTree\nArbre des Constructions\n\n/, ''));
    if (!m) return [];
    const prerequisites = m[3].trim() === 'Aucun' ? [] : m[3].split(',').map((p) => {
      const [, building, level] = /^\s*(.+?)\s+Lvl(\d+)\s*$/.exec(p)!;
      return { building, level: Number(level) };
    });
    return [{ name: m[1].trim(), description: m[2].trim(), prerequisites }];
  });

const data = {
  buildings,
  tree: { buildings: tree },
  travel: {
    note: 'Temps par km du jeu (centièmes de seconde), par niveau de Camp d’entraînement.',
    baseSecondsPerKm: 208,
    levels: TRAVEL_SPEEDS,
  },
  combat: {
    basePower: BASE_POWER,
    productionMinutes: PRODUCTION_MINUTES,
    killPoints: KILL_POINTS,
    attackerLossFactor: ATTACKER_LOSS_FACTOR,
    defenderLossRange: DEFENDER_LOSS_RANGE,
    defenseWins: DEFENSE_WINS,
    combatTicketMultiplier: COMBAT_TICKET_MULTIPLIER,
    hospitalTicketBonus: HOSPITAL_TICKET_BONUS,
  },
  troops: { list: TROOP_TYPES.map(({ id, label, capacity }) => ({ id, label, capacity })) },
  production: { fieldCounts: FIELD_COUNTS },
};

writeFileSync('data/game-data.json', JSON.stringify(data, null, 2) + '\n');
console.log(`data/game-data.json : ${Object.keys(buildings).length} bâtiments, ${tree.length} fiches d'arbre.`);
