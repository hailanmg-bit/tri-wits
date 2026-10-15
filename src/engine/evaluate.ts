/* 三张牌的牌型评估与比较 */
import { Card, NaturalCard, Suit, isJoker, combosOf } from './cards';

/** 1 单张 · 2 对子 · 3 顺子 · 4 同花 · 5 同花顺 · 6 三条 */
export type HandType = 1 | 2 | 3 | 4 | 5 | 6;
export const HAND_TYPES: HandType[] = [1, 2, 3, 4, 5, 6];

export interface HandEval {
  type: HandType;
  points: number[];
  suitSeq: number[];
  special235: boolean;
  hasBig: boolean;
  hasSmall: boolean;
  invalid: boolean;
}

type NaturalEval = Pick<HandEval, 'type' | 'points' | 'suitSeq'>;

function effRank(c: NaturalCard, aLow: boolean): number { return aLow && c.r === 14 ? 1 : c.r; }

function isA23(cs: NaturalCard[]): boolean {
  const ranks = cs.map(c => c.r).sort((x, y) => x - y);
  return ranks.length === 3 && ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 14;
}

/** 评估 3 张自然牌（无王） */
export function evalNatural3(cs: NaturalCard[]): NaturalEval {
  const aLow = isA23(cs);
  const cards = cs.slice().sort((a, b) => {
    const ea = effRank(a, aLow), eb = effRank(b, aLow);
    return eb - ea || a.s - b.s;
  });
  const ranks = cards.map(c => effRank(c, aLow));
  const flush = cs.every(c => c.s === cs[0].s);
  const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const straight = ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1;
  const seq = cards.map(c => c.s as number);

  if (trips) return { type: 6, points: [ranks[0]], suitSeq: seq };
  if (straight && flush) return { type: 5, points: [ranks[0]], suitSeq: seq };
  if (flush) return { type: 4, points: ranks.slice(), suitSeq: seq };
  if (straight) return { type: 3, points: [ranks[0]], suitSeq: seq };
  if (ranks[0] === ranks[1] || ranks[1] === ranks[2]) {
    const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[2];
    const kicker = ranks[0] === ranks[1] ? ranks[2] : ranks[0];
    const pairCards = cards.filter(c => effRank(c, aLow) === pairRank).sort((a, b) => a.s - b.s);
    const kickCard = cards.find(c => effRank(c, aLow) === kicker)!;
    return { type: 2, points: [pairRank, kicker], suitSeq: pairCards.map(c => c.s as number).concat(kickCard.s) };
  }
  return { type: 1, points: ranks.slice(), suitSeq: seq };
}

/** 非同花 235：2、3、5，花色不全相同，且无王 */
export function isSpecial235(cs: Card[]): boolean {
  if (cs.length !== 3 || cs.some(isJoker)) return false;
  const nat = cs as NaturalCard[];
  const ranks = nat.map(c => c.r).sort((a, b) => a - b);
  if (!(ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 5)) return false;
  return !(nat[0].s === nat[1].s && nat[1].s === nat[2].s);
}

/** 只按牌型+点数比较，用于王的取值 */
function betterEval(a: NaturalEval, b: NaturalEval): boolean {
  if (a.type !== b.type) return a.type > b.type;
  for (let i = 0; i < Math.max(a.points.length, b.points.length); i++) {
    const pa = a.points[i] || 0, pb = b.points[i] || 0;
    if (pa !== pb) return pa > pb;
  }
  return false;
}

/** 评估 3 张牌（可含王）：王取能构成的最大牌型 */
export function evalHand3(cards: Card[]): HandEval {
  const jokers = cards.filter(isJoker);
  const naturals = cards.filter((c): c is NaturalCard => !isJoker(c));
  if (jokers.length === 0) {
    return { ...evalNatural3(naturals), special235: isSpecial235(naturals), hasBig: false, hasSmall: false, invalid: false };
  }
  const used = new Set(naturals.map(c => c.r * 4 + c.s));
  const cands: NaturalCard[] = [];
  for (let r = 2; r <= 14; r++)
    for (let s = 0; s < 4; s++)
      if (!used.has(r * 4 + s)) cands.push({ r, s: s as Suit });
  let best: NaturalEval | null = null;
  for (const combo of combosOf(cands, jokers.length)) {
    const e = evalNatural3(naturals.concat(combo));
    if (!best || betterEval(e, best)) best = e;
  }
  return {
    ...best!,
    special235: false, // 王不能组成 235
    hasBig: jokers.some(c => c.w === 1),
    hasSmall: jokers.some(c => c.w === 2),
    invalid: false
  };
}

/* ================= 比较：返回值 >0 表示 a 更强 ================= */

export function cmpPoints(a: { points: number[] }, b: { points: number[] }): number {
  for (let i = 0; i < Math.max(a.points.length, b.points.length); i++) {
    const pa = a.points[i] || 0, pb = b.points[i] || 0;
    if (pa !== pb) return pa - pb;
  }
  return 0;
}

/** 花色序列比较（♠ 最大） */
export function cmpSuits(a: { suitSeq: number[] }, b: { suitSeq: number[] }): number {
  const n = Math.max(a.suitSeq.length, b.suitSeq.length);
  for (let i = 0; i < n; i++) {
    const sa = i < a.suitSeq.length ? a.suitSeq[i] : 3;
    const sb = i < b.suitSeq.length ? b.suitSeq[i] : 3;
    if (sa !== sb) return sa < sb ? 1 : -1;
  }
  return 0;
}

export function cmpJokers(a: Pick<HandEval, 'hasBig' | 'hasSmall'>, b: Pick<HandEval, 'hasBig' | 'hasSmall'>): number {
  if (a.hasBig !== b.hasBig) return a.hasBig ? 1 : -1;
  if (a.hasSmall !== b.hasSmall) return a.hasSmall ? 1 : -1;
  return 0;
}

/** 常规比较：牌型 → 点数 → 含王 → 花色 */
export function cmpHands(a: HandEval, b: HandEval): number {
  if (a.type !== b.type) return a.type - b.type;
  const p = cmpPoints(a, b); if (p) return p;
  const j = cmpJokers(a, b); if (j) return j;
  return cmpSuits(a, b);
}

/** 两两比较（含 235 特殊地位，不考虑同场三条） */
export function cmpFull(a: HandEval, b: HandEval): number {
  if (a.special235 && b.special235) return cmpSuits(a, b);
  if (a.special235) return -1;
  if (b.special235) return 1;
  return cmpHands(a, b);
}

/**
 * 多人比牌，返回从强到弱的新数组。
 * 同组内同时出现非同花 235 与三条时，235 最大；否则 235 最小。
 */
export function rankBy<T>(list: readonly T[], evOf: (x: T) => HandEval): T[] {
  const any235 = list.some(x => evOf(x).special235);
  const anyTrips = list.some(x => evOf(x).type === 6);
  if (any235 && anyTrips) {
    const s235 = list.filter(x => evOf(x).special235).sort((a, b) => cmpSuits(evOf(b), evOf(a)));
    const rest = list.filter(x => !evOf(x).special235).sort((a, b) => cmpHands(evOf(b), evOf(a)));
    return s235.concat(rest);
  }
  return list.slice().sort((a, b) => cmpFull(evOf(b), evOf(a)));
}

export function rankHands(list: readonly HandEval[]): HandEval[] {
  return rankBy(list, h => h);
}

/** AI 用的单值牌力：牌型 × 1e6 + 点数加权 */
export function scoreEval(e: Pick<HandEval, 'type' | 'points'>): number {
  let sc = e.type * 1000000;
  const w = [10000, 100, 1];
  for (let i = 0; i < e.points.length; i++) sc += (e.points[i] || 0) * (w[i] || 0);
  return sc;
}
