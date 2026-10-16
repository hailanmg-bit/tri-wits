import { describe, it, expect } from 'vitest';
import { Card, Suit, evalHand3, rankBy, explainEntry, basisBetween, cmpPoints, makeDeck, shuffle, HandEval } from '../src/engine';
import { seeded } from './rng';

const S: Record<string, Suit> = { s: 0, h: 1, c: 2, d: 3 };
const R: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
const c = (t: string): Card => t === 'BJ' ? { w: 1 } : t === 'SJ' ? { w: 2 } : { r: R[t[0]] ?? +t[0], s: S[t[1]] };
const h = (...ts: string[]) => evalHand3(ts.map(c));
const rank = (...hands: HandEval[]) => rankBy(hands.map((ev, seat) => ({ seat: seat as 0 | 1 | 2, ev })), e => e.ev);

describe('showdown explanations', () => {
  it('same points lose on suit', () => {
    const r = rank(h('As', 'Jd', '6c'), h('Ah', 'Jc', '6d'));
    expect(r[0].seat).toBe(0);
    expect(explainEntry(r, 1)).toEqual({ k: 'suit', above: 0, mine: 1 });
  });
  it('points name the first differing position', () => {
    const r = rank(h('As', 'Jd', '6c'), h('Ah', 'Jc', '4d'));
    expect(explainEntry(r, 1)).toEqual({ k: 'point', above: 6, mine: 4, at: 2 });
  });
  it('type difference', () => {
    const r = rank(h('9h', 'Ts', 'Jd'), h('9s', '9d', 'Ac'));
    expect(explainEntry(r, 1)).toEqual({ k: 'type', above: 3, mine: 2 });
    expect(explainEntry(r, 0).k).toBe('max');
  });
  it('235 beats trips, and is weakest without them', () => {
    let r = rank(h('7s', '7h', '7c'), h('2s', '3h', '5d'));
    expect(r[0].seat).toBe(1);
    expect(explainEntry(r, 0)).toEqual({ k: '235Trips' });
    expect(explainEntry(r, 1)).toEqual({ k: '235Trips' });
    r = rank(h('4s', '8h', 'Tc'), h('2s', '3h', '5d'));
    expect(explainEntry(r, 1)).toEqual({ k: '235Min' });
  });
  it('joker beats a natural hand of the same strength', () => {
    const r = rank(h('Ks', 'Kh', '9c'), h('BJ', 'Kd', '9h'));
    expect(r[0].seat).toBe(1);
    expect(explainEntry(r, 1)).toEqual({ k: 'joker', which: 'big' });
  });
  it('invalid plays say so', () => {
    const ev = h('9s', '9h', 'Kc'); ev.invalid = true;
    expect(explainEntry([{ seat: 0, ev }], 0, 1)).toEqual({ k: 'invalid', required: 1 });
  });
  it('every explanation agrees with the ranking on random deals', () => {
    const rng = seeded(7);
    for (let n = 0; n < 2000; n++) {
      const d = shuffle(makeDeck(), rng);
      const r = rank(evalHand3(d.slice(0, 3)), evalHand3(d.slice(3, 6)), evalHand3(d.slice(6, 9)));
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1].ev, b = r[i].ev, x = basisBetween(a, b);
        if (x.k === 'type') expect(x.above).toBeGreaterThan(x.mine);
        if (x.k === 'point') { expect(a.type).toBe(b.type); expect(x.above).toBeGreaterThan(x.mine); }
        if (x.k === 'suit') { expect(a.type).toBe(b.type); expect(cmpPoints(a, b)).toBe(0); expect(x.above).toBeLessThan(x.mine); }
      }
    }
  });
});
