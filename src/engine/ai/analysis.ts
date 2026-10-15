/* 电脑 AI 共用的牌力分析工具。只读取公开信息 + 自己的手牌。 */
import { Card, NaturalCard, Rng, cardKey, compareCards, isJoker, makeDeck, shuffle, subsetsIdx } from '../cards';
import { HandEval, HandType, cmpFull, cmpHands, cmpSuits, evalHand3, evalNatural3, isSpecial235, scoreEval } from '../evaluate';
import type { EmptyMark, Seat } from '../game';
import P2_TABLE_JSON from './p2-table.json';

/** 电脑决策时可见的局面（不含其他玩家手牌内容） */
export interface AiView {
  round: number;
  hands: Card[][];        // 只读取各家张数；自己的手牌另行传入
  piles: number[];
  seen: Card[];
  requiredType: HandType | null;
  firstEmpty: EmptyMark | null;
  lastRoundP1: (Card[] | null)[];
  rng: Rng;
}

export interface Combo { idx: number[]; ev: HandEval; sc: number }

export const handSizes = (v: AiView): number[] => v.hands.map(h => h.length);
export const othersOf = (me: Seat): Seat[] => ([0, 1, 2] as Seat[]).filter(s => s !== me);

/** 手牌的全部三张组合 */
export function combosOfHand(hand: Card[]): Combo[] {
  return subsetsIdx(hand.length, 3).map(idx => {
    const ev = evalHand3(idx.map(i => hand[i]));
    return { idx, ev, sc: scoreEval(ev) };
  });
}

export function combosOfType(hand: Card[], type: HandType | null): Combo[] {
  return combosOfHand(hand).filter(c => c.ev.type === type);
}

export const maxBy = (list: Combo[]): Combo => list.reduce((a, b) => (a.sc >= b.sc ? a : b));
export const minBy = (list: Combo[]): Combo => list.reduce((a, b) => (a.sc <= b.sc ? a : b));

/** 全部组合 + 最弱的 235 + 非 235 中最强组合 */
export function analyzeHand(hand: Card[]) {
  const combos: Combo[] = [];
  let s235: Combo | null = null, best: Combo | null = null;
  for (const c of combosOfHand(hand)) {
    if (c.ev.special235) {
      if (!s235 || c.sc < s235.sc) s235 = c;
    } else if (!best || c.sc > best.sc) {
      best = c;
    }
    combos.push(c);
  }
  return { combos, s235, best };
}

/** 未知牌池：整副牌 − 已亮出的牌 − 自己手牌（= 对手手牌的并集） */
export function poolOf(view: AiView, hand: Card[]): Card[] {
  const seenSet = new Set(view.seen.map(cardKey));
  const mine = new Set(hand.map(cardKey));
  return makeDeck().filter(c => !seenSet.has(cardKey(c)) && !mine.has(cardKey(c)));
}

/** 两张自然牌 + 一张王：王按最大牌力取值（近似，供 AI 估算） */
export function bestWithJoker(a: NaturalCard, b: NaturalCard, j: Card): HandEval {
  const flags = { hasBig: !!j.w && j.w === 1, hasSmall: !!j.w && j.w === 2, special235: false, invalid: false };
  if (a.r === b.r) return { type: 6, points: [a.r], suitSeq: [a.s, b.s, 0], ...flags };
  const lo = Math.min(a.r, b.r), hi = Math.max(a.r, b.r);
  const d = hi - lo;
  let straightTop = 0;
  if (d === 1) straightTop = hi === 14 ? 14 : Math.min(14, hi + 1);
  else if (d === 2) straightTop = hi;
  else if (hi === 14 && (lo === 2 || lo === 3)) straightTop = 3; // A23
  const sameSuit = a.s === b.s;
  if (straightTop && sameSuit) return { type: 5, points: [straightTop], suitSeq: [a.s, a.s, a.s], ...flags };
  if (straightTop) return { type: 3, points: [straightTop], suitSeq: [a.s, b.s, 0], ...flags };
  if (sameSuit) {
    const used = new Set([a.r, b.r]);
    let jr = 14;
    while (used.has(jr)) jr--;
    return { type: 4, points: [a.r, b.r, jr].sort((x, y) => y - x), suitSeq: [a.s, a.s, a.s], ...flags };
  }
  return { type: 2, points: [hi, lo], suitSeq: [hi === a.r ? a.s : b.s, hi === a.r ? b.s : a.s, 0], ...flags };
}

const naturalsOf = (cards: Card[]) => cards.filter((c): c is NaturalCard => !isJoker(c));

/** 牌池中能组成的最大牌力；exclude235 时忽略非同花 235 */
export function bestComboInPool(pool: Card[], exclude235: boolean): HandEval | null {
  const naturals = naturalsOf(pool);
  const jokers = pool.filter(isJoker);
  let best: HandEval | null = null;
  const consider = (ev: HandEval) => { if (!best || cmpHands(ev, best) > 0) best = ev; };
  for (const idx of subsetsIdx(naturals.length, 3)) {
    const cards = idx.map(i => naturals[i]);
    const ev: HandEval = { ...evalNatural3(cards), special235: isSpecial235(cards), hasBig: false, hasSmall: false, invalid: false };
    if (exclude235 && ev.special235) continue;
    consider(ev);
  }
  for (const j of jokers)
    for (const idx of subsetsIdx(naturals.length, 2)) consider(bestWithJoker(naturals[idx[0]], naturals[idx[1]], j));
  if (jokers.length === 2)
    for (const c of naturals) consider({ type: 6, points: [c.r], suitSeq: [c.s, 0, 0], hasBig: true, hasSmall: true, special235: false, invalid: false });
  return best;
}

/** 牌池按牌型的最佳组合（忽略 235 特殊地位） */
export function poolBestByType(pool: Card[]): { byType: Partial<Record<HandType, HandEval>>; overall: HandEval | null } {
  const naturals = naturalsOf(pool);
  const jokers = pool.filter(isJoker);
  const byType: Partial<Record<HandType, HandEval>> = {};
  let overall: HandEval | null = null;
  const add = (ev: HandEval) => {
    const cur = byType[ev.type];
    if (!cur || cmpHands(ev, cur) > 0) byType[ev.type] = ev;
    if (!overall || cmpHands(ev, overall) > 0) overall = ev;
  };
  for (const idx of subsetsIdx(naturals.length, 3)) {
    const cards = idx.map(i => naturals[i]);
    if (isSpecial235(cards)) continue;
    add({ ...evalNatural3(cards), special235: false, hasBig: false, hasSmall: false, invalid: false });
  }
  for (const j of jokers)
    for (const idx of subsetsIdx(naturals.length, 2)) add(bestWithJoker(naturals[idx[0]], naturals[idx[1]], j));
  if (jokers.length === 2)
    for (const c of naturals) add({ type: 6, points: [c.r], suitSeq: [c.s, 0, 0], hasBig: true, hasSmall: true, special235: false, invalid: false });
  return { byType, overall };
}

/** 受保护牌（最大手牌、三条、A♠）尽量不拆，从中挑最弱的组合 */
export function weakestPreserving(hand: Card[], A: ReturnType<typeof analyzeHand>): Combo {
  const protectedSet = new Set(A.best ? A.best.idx : []);
  const rankCount: Record<number, number> = {};
  hand.forEach(c => { if (!isJoker(c)) rankCount[c.r] = (rankCount[c.r] || 0) + 1; });
  hand.forEach((c, i) => {
    if (!isJoker(c) && rankCount[c.r] >= 3) protectedSet.add(i);
    if (!isJoker(c) && c.r === 14 && c.s === 0) protectedSet.add(i);
  });
  let pick: Combo | null = null, bestU = Infinity;
  for (const c of A.combos) {
    const uses = c.idx.reduce((n, i) => n + (protectedSet.has(i) ? 1 : 0), 0);
    const u = c.sc + 3000000 * uses;
    if (u < bestU) { bestU = u; pick = c; }
  }
  return pick!;
}

/* ---------- 保护组合（不拆三条 / 同花顺 / 同花） ---------- */

export const idxKey = (idx: number[]) => idx.slice().sort((a, b) => a - b).join(',');

export function protectedSetsOf(hand: Card[], wantSF: boolean, wantFlush: boolean): number[][] {
  const want: HandType[] = [6];
  if (wantSF) want.push(5);
  if (wantFlush) want.push(4);
  const combos = combosOfHand(hand);
  const sets: number[][] = [];
  for (const tp of want) {
    let best: Combo | null = null;
    for (const c of combos) if (c.ev.type === tp && (!best || c.sc > best.sc)) best = c;
    if (best) sets.push(best.idx.slice().sort((a, b) => a - b));
  }
  return sets;
}

/** 是否部分拆用了某个保护组合（完全等于或完全不用都允许） */
export function splitsProtection(idx: number[], sets: number[][]): boolean {
  return sets.some(set => {
    const inter = idx.filter(i => set.includes(i)).length;
    return inter > 0 && inter < set.length;
  });
}

export function bestAllowedOfType(list: Combo[], tp: HandType | null, sets: number[][]): Combo | null {
  let best: Combo | null = null;
  for (const c of list) {
    if (c.ev.type !== tp || splitsProtection(c.idx, sets)) continue;
    if (!best || c.sc > best.sc) best = c;
  }
  return best;
}

export function weakestAllowedOfType(list: Combo[], tp: HandType, sets: number[][]): Combo | null {
  let pick: Combo | null = null;
  for (const c of list) {
    if (c.ev.type !== tp || splitsProtection(c.idx, sets)) continue;
    if (!pick || c.sc < pick.sc) pick = c;
  }
  return pick;
}

export function weakestAllowedAny(list: Combo[], sets: number[][]): Combo {
  let pick: Combo | null = null;
  for (const c of list) {
    if (splitsProtection(c.idx, sets)) continue;
    if (!pick || c.sc < pick.sc) pick = c;
  }
  return pick || list[0];
}

/** 手牌是否全部由三条/同花顺的牌组成 */
export function allTripsOrSF(hand: Card[]): boolean {
  const inSets = new Set<number>();
  for (const c of combosOfHand(hand)) if (c.ev.type === 6 || c.ev.type === 5) c.idx.forEach(i => inSets.add(i));
  return inSets.size === hand.length;
}

/** 以非保护牌中第二大单张为顶牌的最弱单张组合 */
export function secondLargestSingle(hand: Card[], sets: number[][]): number[] | null {
  const free = hand.map((c, i) => ({ c, i })).filter(o => !sets.some(set => set.includes(o.i)));
  free.sort((a, b) => compareCards(a.c, b.c));
  const target = free[1] || free[0];
  if (!target) return null;
  let pick: Combo | null = null;
  for (const c of combosOfHand(hand)) {
    if (c.ev.type !== 1 || splitsProtection(c.idx, sets) || !c.idx.includes(target.i)) continue;
    const sorted = c.idx.slice().sort((a, b) => compareCards(hand[a], hand[b]));
    if (sorted[0] !== target.i) continue;
    if (!pick || c.sc < pick.sc) pick = c;
  }
  return pick ? pick.idx : null;
}

/* ---------- 235 相关 ---------- */

export function countPossible235(pool: Card[]): number {
  const nat = naturalsOf(pool);
  const twos = nat.filter(c => c.r === 2), threes = nat.filter(c => c.r === 3), fives = nat.filter(c => c.r === 5);
  let n = 0;
  for (const t of twos) for (const h of threes) for (const f of fives) if (!(t.s === h.s && h.s === f.s)) n++;
  return n;
}

export const poolCan235 = (pool: Card[]) => countPossible235(pool) > 0;

export function best235(combos: Combo[]): Combo | null {
  let best: Combo | null = null;
  for (const c of combos) {
    if (!c.ev.special235) continue;
    if (!best || cmpSuits(c.ev, best.ev) > 0) best = c;
  }
  return best;
}

/** 一组牌能否组成三条：自然三条 / 对子+王 / 单张+双王 */
function partCanTrips(cards: Card[]): boolean {
  const rankCount: Record<number, number> = {};
  let nJ = 0;
  for (const c of cards) {
    if (isJoker(c)) nJ++;
    else rankCount[c.r] = (rankCount[c.r] || 0) + 1;
  }
  if (nJ >= 2 && cards.length >= 3) return true;
  return Object.values(rankCount).some(n => n >= 3 || (n === 2 && nJ >= 1));
}

/** 蒙特卡洛估算“至少一个对手能组成三条”的概率 */
export function probAnyOpponentTrips(view: AiView, hand: Card[], me: Seat): number {
  const opps = othersOf(me).filter(s => view.hands[s].length > 0);
  const pool = poolOf(view, hand);
  const sizes = opps.map(s => view.hands[s].length);
  if (!opps.length || pool.length < 3) return 0;
  const N = 100;
  let hits = 0;
  for (let t = 0; t < N; t++) {
    const sh = shuffle(pool, view.rng);
    let offset = 0;
    for (const n of sizes) {
      if (partCanTrips(sh.slice(offset, offset + n))) { hits++; break; }
      offset += n;
    }
  }
  return hits / N;
}

/* ---------- 第二阶段胜率估算（离线统计表） ---------- */

const P2_TABLE = P2_TABLE_JSON as Record<string, Record<string, number[]>>;

/** 牌力 power 在分布 dist（0%..100% 分位值）中的位置 */
export function percentileBelow(dist: number[] | undefined, power: number): number {
  if (!dist || !dist.length) return 0.5;
  if (power <= dist[0]) return 0;
  if (power > dist[dist.length - 1]) return 1;
  for (let i = 1; i < dist.length; i++) {
    if (power <= dist[i]) {
      const lo = dist[i - 1], hi = dist[i];
      const f = hi > lo ? (power - lo) / (hi - lo) : 1;
      return Math.min(1, (i - 1 + f) / (dist.length - 1));
    }
  }
  return 1;
}

export function estimateWinRate(myEval: HandEval, view: AiView, me: Seat): number {
  const opps = othersOf(me).filter(s => view.hands[s].length > 0);
  if (!opps.length) return 1;
  const myPower = scoreEval(myEval);
  let p = 1;
  for (const s of opps) {
    const cell = P2_TABLE[String(view.hands[s].length)];
    p *= cell ? percentileBelow(cell[String(myEval.type)], myPower) : 0.5;
  }
  return p;
}

/** 牌池中指定牌型可能组合数（数到 limit 即停） */
export function countPossibleValid(pool: Card[], type: HandType, limit = 2): number {
  let n = 0;
  for (const idx of subsetsIdx(pool.length, 3)) {
    if (evalHand3(idx.map(i => pool[i])).type === type && ++n >= limit) return n;
  }
  return n;
}

/** 移除某组合后，剩余手牌的最强牌型与强牌（≥顺子）组合数 */
export function removalPotential(hand: Card[], idx: number[], evOf: (cs: Card[]) => HandEval) {
  const keep = hand.filter((_, i) => !idx.includes(i));
  let maxType = 0, strong = 0;
  for (const c of subsetsIdx(keep.length, 3)) {
    const ev = evOf(c.map(i => keep[i]));
    if (ev.type > maxType) maxType = ev.type;
    if (ev.type >= 3) strong++;
  }
  return { maxType, strong };
}

export { cmpFull };
