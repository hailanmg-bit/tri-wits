import { describe, it, expect } from 'vitest';
import { Card, Game, Seat, Suit, evalHand3, rankHands, cmpFull, botStep, resolveStrategies } from '../src/engine';
import { seeded } from './rng';

// 'As' 'Th' '2c' 'BJ'(大王) 'SJ'(小王)
const S: Record<string, Suit> = { s: 0, h: 1, c: 2, d: 3 };
const R: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
const c = (t: string): Card => t === 'BJ' ? { w: 1 } : t === 'SJ' ? { w: 2 } : { r: R[t[0]] ?? +t[0], s: S[t[1]] };
const h = (...ts: string[]) => evalHand3(ts.map(c));

describe('hand types', () => {
  it('orders types: trips > straight flush > flush > straight > pair > high', () => {
    expect(h('7s', '7h', '7c').type).toBe(6);
    expect(h('9h', 'Th', 'Jh').type).toBe(5);
    expect(h('2h', '9h', 'Kh').type).toBe(4);
    expect(h('9h', 'Ts', 'Jd').type).toBe(3);
    expect(h('9h', '9s', 'Jd').type).toBe(2);
    expect(h('2h', '9s', 'Jd').type).toBe(1);
  });
  it('A23 is the smallest straight, QKA the largest, KA2 is not a straight', () => {
    expect(h('As', '2h', '3d')).toMatchObject({ type: 3, points: [3] });
    expect(h('Qs', 'Kh', 'Ad')).toMatchObject({ type: 3, points: [14] });
    expect(h('Ks', 'Ah', '2d').type).toBe(1);
    expect(cmpFull(h('As', '2h', '3d'), h('2s', '3h', '4d'))).toBeLessThan(0);
  });
  it('jokers make the strongest combo; big joker beats small joker on ties', () => {
    expect(h('9s', '9h', 'BJ')).toMatchObject({ type: 6, points: [9], hasBig: true });
    expect(h('9s', 'SJ', 'BJ').type).toBe(6);
    expect(h('9s', 'Ts', 'SJ').type).toBe(5);
    expect(cmpFull(h('Qs', 'Ks', 'BJ'), h('Qh', 'Kh', 'SJ'))).toBeGreaterThan(0);
  });
  it('suits break ties: spade > heart > club > diamond', () => {
    expect(cmpFull(h('As', 'Kh', '9d'), h('Ah', 'Ks', '9d'))).toBeGreaterThan(0);
  });
});

describe('special 235', () => {
  it('off-suit 235 is the weakest hand without trips', () => {
    const r = rankHands([h('2s', '3h', '5d'), h('2c', '4h', '6d'), h('Ks', 'Kh', '3c')]);
    expect(r[2].special235).toBe(true);
  });
  it('off-suit 235 beats everything when trips are present', () => {
    const r = rankHands([h('9h', 'Th', 'Jh'), h('2s', '3h', '5d'), h('As', 'Ah', 'Ac')]);
    expect(r[0].special235).toBe(true);
    expect(r[1].type).toBe(6);
  });
  it('same-suit 235 is a flush, and jokers cannot form 235', () => {
    expect(h('2s', '3s', '5s')).toMatchObject({ type: 4, special235: false });
    expect(h('2s', '3h', 'BJ').special235).toBe(false);
  });
});

function fixedGame(hands: string[][]): Game {
  const g = new Game(['human', 'human', 'human'], seeded(1));
  g.start();
  g.hands = hands.map(hs => hs.map(c)) as [Card[], Card[], Card[]];
  return g;
}

describe('game flow', () => {
  it('rejects duplicate, out-of-range or non-integer indices', () => {
    const g = new Game(['human', 'human', 'human'], seeded(2));
    g.start();
    expect(g.playP1(0, [0, 0, 1])).toBe(false);
    expect(g.playP1(0, [0, 1, 18])).toBe(false);
    expect(g.playP1(0, [0, 1.5, 2])).toBe(false);
    expect(g.playP1(0, [0, 1])).toBe(false);
    expect(g.playP1(0, [0, 1, 2])).toBe(true);
    expect(g.playP1(0, [3, 4, 5])).toBe(false); // 已出过
  });

  it('phase 2 requires the weakest phase-1 type; 235 beating trips makes it High Card', () => {
    const g = fixedGame([['2s', '3h', '5d', '9c', '9d', 'Kc'], ['As', 'Ah', 'Ac', '4s', '4h', '8c'], ['9h', 'Th', 'Jh', '6s', '6h', '7c']]);
    g.playP1(0, [0, 1, 2]); g.playP1(1, [0, 1, 2]); g.playP1(2, [0, 1, 2]);
    expect(g.p1Winner).toBe(0);
    expect(g.piles[0]).toBe(9);
    expect(g.requiredType).toBe(1);
  });

  it('when every phase-2 play is invalid, each player banks their own 3 cards', () => {
    const g = fixedGame([['Ks', 'Kh', '2c', '4d', '7c', '9h'], ['Qs', 'Qh', '3c', '5s', '8d', 'Jc'], ['Js', 'Jh', '4c', '6d', '9s', 'Th']]);
    [0, 1, 2].forEach(s => g.playP1(s as Seat, [0, 1, 2]));
    expect(g.requiredType).toBe(2);
    [0, 1, 2].forEach(s => g.chooseP2(s as Seat, true));
    g.playP2(0, [0, 1, 2]); g.playP2(1, [0, 1, 2]); g.playP2(2, [0, 1, 2]);
    expect(g.p2Refund).toBe(true);
    expect(g.piles).toEqual([9 + 3, 3, 3]);
  });

  it('players emptying in the same round and phase all get the 5-point base', () => {
    const g = fixedGame([['2s', '7h', '9d'], ['3s', '8h', 'Td'], ['As', 'Ah', 'Ac', '4d', '6c', '8s']]);
    [0, 1, 2].forEach(s => g.playP1(s as Seat, [0, 1, 2]));
    expect(g.phase).toBe('round_end');
    g.nextRound();
    expect(g.gameOver).toBe(true);
    expect(g.base).toEqual([5, 5, 0]);
    expect(g.piles).toEqual([1, 1, 9 + 1]);
    expect(g.finalScores).toEqual([6, 6, 10]);
  });
});

describe('invariants over random bot games', () => {
  it('conserves 54 cards and ends every game', () => {
    for (let k = 0; k < 150; k++) {
      const g = new Game(['ai', 'ai', 'ai'], seeded(500 + k));
      g.start();
      g.seatStrategies = resolveStrategies(g.seatTypes, ['random', 'random', 'random'], g.rng);
      let steps = 0;
      while (!g.gameOver && steps++ < 500) {
        if (g.phase === 'round_end') { g.nextRound(); continue; }
        // 电脑可能以任意顺序行动：每次让一个随机的待行动座位先走
        const waiting = g.pending.filter(s => botStepReady(g, s));
        botStep(g, waiting[Math.floor(g.rng() * waiting.length)]);
      }
      expect(g.gameOver).toBe(true);
      expect(g.piles.reduce((a, b) => a + b, 0)).toBe(54);
      expect(g.finalScores!.every(Number.isInteger)).toBe(true);
    }
  }, 120000);
});

function botStepReady(g: Game, s: Seat): boolean {
  if (g.phase === 'p1_select') return !g.p1Locked[s];
  if (g.phase === 'p2_choose') return !g.p2Decided[s];
  return !g.p2Locked[s];
}
