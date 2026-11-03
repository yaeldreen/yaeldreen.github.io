import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parisToMs } from '../shared/paris-time.js';
import { returnsDescription, returnsTitle } from './render.js';
import { returnRows, TravelData } from './travel.js';

const travel = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8')).travel as TravelData;
const attackedAtMs = parisToMs({ year: 2026, month: 11, day: 1, hour: 21, minute: 39, second: 10 });

describe('affichage des retours', () => {
  it('donne l’heure de retour de chaque CE, à l’heure de Paris', () => {
    const view = { distanceKm: 38.5, attackedAtMs, rows: returnRows(travel, 38.5, attackedAtMs, null) };
    const text = returnsDescription(view);
    assert.equal(returnsTitle(view), '↩️ Retours · 38,5 km');
    assert.match(text, /Attaque à \*\*21:39:10\*\* \(01\/11\)/);
    // CE 11 : 3 604 s sans ticket (22:39:14), 1 810 s avec (22:09:20).
    assert.match(text, /\*\*CE 11\*\* · 🕐 22:39:14 · 🎟️ 22:09:20/);
    assert.match(text, /!monCE 11/);
    assert.equal(text.split('\n').filter((l) => l.includes('**CE ')).length, 20);
  });

  it('indique si la contre-attaque arrive avant, et met en avant le CE connu', () => {
    const nowMs = attackedAtMs;
    const counter = { level: 11, distanceKm: 38.5, from: 'Tard', arrivalMs: nowMs + 3_604_000 };
    const view = { distanceKm: 38.5, attackedAtMs, counter, attackerCe: 9, rows: returnRows(travel, 38.5, attackedAtMs, { level: 11, distanceKm: 38.5, nowMs }) };
    const text = returnsDescription(view);
    assert.match(text, /⭐ \*\*CE 9\*\* · 🕐 \S+ ✅ \+/);
    assert.match(text, /\*\*CE 12\*\* · 🕐 \S+ ❌ −/);
    assert.ok(text.length < 4000);
  });

  it('prévient quand l’heure n’est connue qu’à la minute', () => {
    const view = { distanceKm: 10, attackedAtMs, minutePrecision: true, rows: returnRows(travel, 10, attackedAtMs, null) };
    assert.match(returnsDescription(view), /jusqu'à 59 s plus tard/);
  });
});
