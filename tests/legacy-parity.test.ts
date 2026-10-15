/* 移植一致性：同一随机序列下，新引擎与旧版 engine.js 的每一步动作和最终得分完全相同 */
import { createRequire } from 'node:module';
import { describe, it, expect, afterEach } from 'vitest';
import { Game, Seat, botStep, resolveStrategies, STRATEGY_KEYS } from '../src/engine';
import { seeded } from './rng';

const require = createRequire(import.meta.url);
const legacy = require('../legacy/engine.js');
const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

function runLegacy(seed: number, picks: string[]) {
  Math.random = seeded(seed);
  const G = new legacy.Game(['ai', 'ai', 'ai']);
  G.start(picks);
  const trace: string[] = [];
  while (!G.gameOver) {
    const s = G.currentSeat, S = legacy.getStrategy(G.seatStrategies[s]), h = G.hands[s];
    if (G.phase === 'p1_select') { const i = S.chooseP1(h, G); trace.push(`${s}:p1:${i}`); G.selectP1(s, i); G.confirmP1(s); }
    else if (G.phase === 'p2_choose') { const j = S.chooseP2Join(h, G); trace.push(`${s}:join:${j}`); G.chooseP2(s, j); }
    else if (G.phase === 'p2_select') { const i = S.chooseP2Cards(h, G); trace.push(`${s}:p2:${i}`); G.selectP2(s, i); G.confirmP2(s); }
    else G.nextRound();
  }
  return { trace, scores: G.finalScores, strategies: G.seatStrategies };
}

function runNew(seed: number, picks: string[]) {
  Math.random = seeded(seed);
  const g = new Game(['ai', 'ai', 'ai']);
  g.start();
  g.seatStrategies = resolveStrategies(g.seatTypes, picks, g.rng);
  const trace: string[] = [];
  while (!g.gameOver) {
    if (g.phase === 'round_end') { g.nextRound(); continue; }
    const s = g.currentSeat as Seat;
    const a = botStep(g, s)!;
    trace.push(`${s}:${a.kind}:${a.kind === 'join' ? a.join : a.indices}`);
  }
  return { trace, scores: g.finalScores, strategies: g.seatStrategies };
}

describe('legacy parity', () => {
  const combos: string[][] = [];
  for (const a of STRATEGY_KEYS) combos.push([a, a, a]);
  for (let i = 0; i < STRATEGY_KEYS.length; i++) combos.push([STRATEGY_KEYS[i], STRATEGY_KEYS[(i + 1) % 6], STRATEGY_KEYS[(i + 3) % 6]]);
  combos.push(['random', 'random', 'random']);

  combos.forEach((picks, ci) => {
    it(`matches legacy for ${picks.join(' / ')}`, () => {
      for (let k = 0; k < 8; k++) {
        const seed = 1000 + ci * 100 + k;
        const L = runLegacy(seed, picks);
        const N = runNew(seed, picks);
        expect(N.strategies).toEqual(L.strategies);
        expect(N.trace).toEqual(L.trace);
        expect(N.scores).toEqual(L.scores);
      }
    }, 120000);
  });
});
