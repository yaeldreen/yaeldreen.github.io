import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parisClock, parisDay, parisParts, parisToMs, parseParisTime } from '../shared/paris-time.js';
import { distanceKm, returnRows, secondsPerKm, ticketSecondsPerKm, TravelData, travelMs } from './travel.js';

const data = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8')).travel as TravelData;

describe('temps de trajet (règles validées en jeu)', () => {
  it('sans ticket : 208 s moins le bonus du CE, trajet arrondi à la seconde', () => {
    assert.ok(Math.abs(secondsPerKm(data, 11) - 93.6) < 1e-9);
    assert.equal(secondsPerKm(data, 20), 5);
    assert.equal(travelMs(data, 38.5, 11), 3_604_000);
  });

  it('avec ticket : CE 12 à 41,5 s/km, CE 13 à 36,5 s/km', () => {
    assert.equal(ticketSecondsPerKm(data, 12), 41.5);
    assert.equal(ticketSecondsPerKm(data, 13), 36.5);
  });

  it('avec ticket : trajets observés (CE 4 sur 7,5 km = 10:27, CE 11 sur 38,5 km = 30:10)', () => {
    assert.equal(travelMs(data, 7.5, 4, true), (10 * 60 + 27) * 1000);
    assert.equal(travelMs(data, 38.5, 11, true), (30 * 60 + 10) * 1000);
  });

  it('distance entre deux villages, au demi-km', () => {
    assert.equal(distanceKm({ x: 8222, y: -17 }, { x: 8180, y: -6 }), 43.5);
  });

  it('retour faisable si notre contre-attaque arrive avant', () => {
    const rows = returnRows(data, 38.5, 0, { level: 11, distanceKm: 38.5, nowMs: 0 });
    assert.equal(rows.length, 20);
    assert.equal(rows[10].marginMs, 0);
    assert.ok(rows[0].marginMs! > 0);
    assert.ok(rows[10].ticketMarginMs! < 0);
    assert.equal(returnRows(data, 10, 0, null)[0].marginMs, null);
  });
});

describe('heure de Paris', () => {
  // 1er novembre 2026 : Paris est en UTC+1 (heure d'hiver).
  const now = Date.UTC(2026, 10, 1, 21, 0, 0); // 22:00 à Paris

  it('convertit dans les deux sens, quel que soit le fuseau du serveur', () => {
    const ms = parisToMs({ year: 2026, month: 11, day: 1, hour: 21, minute: 39, second: 10 });
    assert.equal(ms, Date.UTC(2026, 10, 1, 20, 39, 10));
    assert.equal(parisClock(ms), '21:39:10');
    assert.equal(parisDay(ms), '01/11');
    // Heure d'été : UTC+2.
    assert.equal(parisToMs({ year: 2026, month: 7, day: 14, hour: 12, minute: 0, second: 0 }), Date.UTC(2026, 6, 14, 10, 0, 0));
    assert.equal(parisParts(Date.UTC(2026, 6, 14, 10, 0, 0)).hour, 12);
  });

  it('lit les heures tapées par les joueurs', () => {
    const at = (h: number, m: number, s = 0, day = 1) => parisToMs({ year: 2026, month: 11, day, hour: h, minute: m, second: s });
    assert.equal(parseParisTime('21:39:10', now), at(21, 39, 10));
    assert.equal(parseParisTime('21h39', now), at(21, 39));
    assert.equal(parseParisTime('21h39m10', now), at(21, 39, 10));
    assert.equal(parseParisTime('31/10 23:05:00', now), parisToMs({ year: 2026, month: 10, day: 31, hour: 23, minute: 5, second: 0 }));
    // Pas encore passée aujourd'hui : c'était hier.
    assert.equal(parseParisTime('23:30', now), parisToMs({ year: 2026, month: 10, day: 31, hour: 23, minute: 30, second: 0 }));
    assert.equal(parseParisTime('demain', now), null);
    assert.equal(parseParisTime('25:00', now), null);
  });
});
