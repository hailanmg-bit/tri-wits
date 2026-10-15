/* 电脑策略库。每个策略只看公开局面 + 自己的手牌；me 为该电脑自己的座位。 */
import { Card, Rng, cardKey, isJoker } from '../cards';
import { HandEval, HandType, cmpFull, evalHand3 } from '../evaluate';
import type { Seat, SeatType } from '../game';
import {
  AiView, Combo, allTripsOrSF, analyzeHand, best235, bestAllowedOfType, bestComboInPool, combosOfHand, combosOfType,
  countPossible235, countPossibleValid, estimateWinRate, idxKey, maxBy, minBy, othersOf, poolBestByType, poolCan235,
  poolOf, probAnyOpponentTrips, protectedSetsOf, removalPotential, secondLargestSingle, splitsProtection,
  weakestAllowedAny, weakestAllowedOfType, weakestPreserving
} from './analysis';

export interface Strategy {
  chooseP1(hand: Card[], view: AiView, me: Seat): number[];
  chooseP2Join(hand: Card[], view: AiView, me: Seat): boolean;
  chooseP2Cards(hand: Card[], view: AiView, me: Seat): number[];
}

/* ---------- 共用 ---------- */

function bestValid(hand: Card[], type: HandType | null): Combo | null {
  const list = combosOfType(hand, type);
  return list.length ? maxBy(list) : null;
}

/** 有符合牌型的出最强；否则随机出 3 张（1-1 / 2-1 的原始行为） */
function bestValidOrRandom(hand: Card[], type: HandType | null, rng: Rng): number[] {
  const b = bestValid(hand, type);
  if (b) return b.idx;
  const all = combosOfHand(hand);
  return all[Math.floor(rng() * all.length)].idx;
}

/** 有符合牌型的出最强；否则出不拆三条/同花顺的最弱组合 */
function bestValidOrDiscard(hand: Card[], type: HandType | null): number[] {
  const b = bestValid(hand, type);
  if (b) return b.idx;
  return weakestAllowedAny(combosOfHand(hand), protectedSetsOf(hand, true, false)).idx;
}

const minOtherHand = (view: AiView, me: Seat) => Math.min(...othersOf(me).map(s => view.hands[s].length));

/** 只剩 3 张时是否参与第二阶段（2-1 / 2-2 / 3-1 共用） */
function joinThreeCards(hand: Card[], view: AiView, me: Seat): boolean {
  const lens = othersOf(me).map(s => view.hands[s].length);
  if (lens.some(n => n === 3)) return true;
  if (lens.every(n => n > 3)) {
    const pb = poolBestByType(poolOf(view, hand));
    if (!pb.overall || cmpFull(evalHand3(hand), pb.overall) > 0) return false;
  }
  return true;
}

/** 有绝对大就出最大；否则在不拆三条/同花顺的前提下，找某牌型内的绝对大并出该牌型较小的一手，争第二阶段 */
function controlChooseP1(hand: Card[], view: AiView): number[] {
  const sets = protectedSetsOf(hand, true, false);
  const mine = combosOfHand(hand);
  const best = maxBy(mine);
  const pb = poolBestByType(poolOf(view, hand));
  if (!pb.overall || cmpFull(best.ev, pb.overall) > 0) return best.idx;
  for (const tp of [4, 3, 2, 1] as HandType[]) {
    const strong = bestAllowedOfType(mine, tp, sets);
    if (!strong) continue;
    const top = pb.byType[tp];
    if (!top || cmpFull(strong.ev, top) > 0) {
      const weak = weakestAllowedOfType(mine, tp, sets);
      if (weak && idxKey(weak.idx) !== idxKey(strong.idx)) return weak.idx;
      for (const t2 of [4, 3, 2, 1] as HandType[]) {
        const s2 = bestAllowedOfType(mine, t2, sets);
        const w2 = weakestAllowedOfType(mine, t2, sets);
        if (s2 && w2 && idxKey(s2.idx) !== idxKey(w2.idx)) return w2.idx;
      }
    }
  }
  return weakestAllowedAny(mine, sets).idx;
}

/* ---------- 1-1：出最强；第二阶段能组牌型时 60% 参与 ---------- */

const s11: Strategy = {
  chooseP1(hand, view) {
    const combos = combosOfHand(hand);
    const top = maxBy(combos).sc;
    const ties = combos.filter(c => c.sc === top);
    return ties[Math.floor(view.rng() * ties.length)].idx;
  },
  chooseP2Join(hand, view) {
    if (hand.length === 3) {
      if (!view.firstEmpty) return true;
      return bestValid(hand, view.requiredType) !== null && view.rng() < 0.5;
    }
    if (!bestValid(hand, view.requiredType)) return false;
    return view.rng() < 0.6;
  },
  chooseP2Cards(hand, view) { return bestValidOrRandom(hand, view.requiredType, view.rng); }
};

/* ---------- 2-1：235 优先 → 绝对大判断 → 前三回合保守 → 之后出最大 ---------- */

const s21: Strategy = {
  chooseP1(hand, view) {
    const A = analyzeHand(hand);
    if (A.s235) return A.s235.idx;
    if (!A.best) return A.combos[0].idx;
    if (view.round + 1 > 3) return A.best.idx;
    const pool = poolOf(view, hand);
    // 池子 ≥29 张时必有某点数凑成三条，非三条不可能绝对大
    if (pool.length >= 29 && A.best.ev.type <= 5) return weakestPreserving(hand, A).idx;
    const poolBest = bestComboInPool(pool, true);
    if (!poolBest || cmpFull(A.best.ev, poolBest) > 0) return A.best.idx;
    return weakestPreserving(hand, A).idx;
  },
  chooseP2Join(hand, view, me) {
    if (hand.length === 3) return joinThreeCards(hand, view, me);
    if (!bestValid(hand, view.requiredType)) return false;
    return view.rng() < 0.6;
  },
  chooseP2Cards(hand, view) { return bestValidOrRandom(hand, view.requiredType, view.rng); }
};

/* ---------- 2-2：对手可能有 235 时出第二大单张；否则控牌型；第二阶段点数 ≥10 才参与 ---------- */

const s22: Strategy = {
  chooseP1(hand, view) {
    if (poolCan235(poolOf(view, hand))) {
      const idx = secondLargestSingle(hand, protectedSetsOf(hand, true, false));
      if (idx) return idx;
    }
    return controlChooseP1(hand, view);
  },
  chooseP2Join(hand, view, me) {
    if (hand.length === 3) return joinThreeCards(hand, view, me);
    const best = bestAllowedOfType(combosOfHand(hand), view.requiredType, protectedSetsOf(hand, false, true));
    return !!best && best.ev.points[0] >= 10;
  },
  chooseP2Cards(hand, view) {
    const best = bestAllowedOfType(combosOfHand(hand), view.requiredType, protectedSetsOf(hand, false, true));
    return best ? best.idx : bestValidOrRandom(hand, view.requiredType, view.rng);
  }
};

/* ---------- 3-1：首回合出第二大单张并必参与；之后看上回合对手牌型决定控牌或出最大 ---------- */

const s31: Strategy = {
  chooseP1(hand, view, me) {
    const sets = protectedSetsOf(hand, true, false);
    if (view.round === 0) {
      return secondLargestSingle(hand, sets) || weakestAllowedAny(combosOfHand(hand), sets).idx;
    }
    const prevCards = othersOf(me).map(s => view.lastRoundP1[s]).filter((x): x is Card[] => !!x);
    let case1 = false, case2 = false;
    if (prevCards.length) {
      const types = prevCards.map(cs => evalHand3(cs).type);
      case1 = types.some(t => t === 6 || t === 5);
      case2 = types.every(t => t === 2 || t === 1);
    }
    if (case1 || !case2) return controlChooseP1(hand, view);
    const mine = combosOfHand(hand);
    if (allTripsOrSF(hand)) return maxBy(mine).idx;
    let bestAllowed: Combo | null = null;
    for (const tp of [4, 3, 2, 1] as HandType[]) {
      const b = bestAllowedOfType(mine, tp, sets);
      if (b && (!bestAllowed || b.sc > bestAllowed.sc)) bestAllowed = b;
    }
    return (bestAllowed || maxBy(mine)).idx;
  },
  chooseP2Join(hand, view, me) {
    if (hand.length === 3) return joinThreeCards(hand, view, me);
    if (view.round === 0) return true;
    const best = bestAllowedOfType(combosOfHand(hand), view.requiredType, protectedSetsOf(hand, true, false));
    return !!best && best.ev.points[0] > 10;
  },
  chooseP2Cards(hand, view) {
    const best = bestAllowedOfType(combosOfHand(hand), view.requiredType, protectedSetsOf(hand, true, false));
    return best ? best.idx : bestValidOrRandom(hand, view.requiredType, view.rng);
  }
};

/* ---------- ai-1：235 狙击 / 三条过滤 / 拆牌代价；第二阶段按胜率表参与 ---------- */

const sAi1: Strategy = {
  chooseP1(hand, view, me) {
    if (hand.length <= 6 && hand.length <= minOtherHand(view, me)) return minBy(combosOfHand(hand)).idx; // 终局加速
    // 拆牌代价要反复评估剩余手牌的组合，按牌面缓存评估结果
    const cache = new Map<string, HandEval>();
    const keyOf = (cs: Card[]) => cs.map(cardKey).sort().join('|');
    const evOf = (cs: Card[]) => {
      const k = keyOf(cs);
      let ev = cache.get(k);
      if (!ev) { ev = evalHand3(cs); cache.set(k, ev); }
      return ev;
    };
    const combos = combosOfHand(hand);
    combos.forEach(c => cache.set(keyOf(c.idx.map(i => hand[i])), c.ev));
    const pool = poolOf(view, hand);
    if (combos.some(c => c.ev.special235)) {
      const probThree = probAnyOpponentTrips(view, hand, me);
      const myScore = view.piles[me] || 0;
      const maxScore = Math.max(...view.piles);
      const needSnipe = myScore < maxScore - 10 || (myScore < maxScore && hand.length <= 9);
      if (probThree >= 0.2 && needSnipe) {
        const b = best235(combos);
        if (b) return b.idx;
      }
    }
    let candidates = combos;
    if (countPossible235(pool) > 0 && pool.length <= 30) {
      const nonTrips = candidates.filter(c => c.ev.type !== 6);
      if (nonTrips.length) candidates = nonTrips;
    }
    candidates = candidates.slice().sort((a, b) => b.sc - a.sc);
    if (candidates.every(c => c.ev.type <= 2)) return candidates[0].idx;
    const top = candidates.slice(0, 3);
    const topSc = top[0].sc;
    let best: Combo | null = null;
    let bestPot: { maxType: number; strong: number } | null = null;
    for (const c of top) {
      if (c.sc < topSc * 0.95) continue;
      const pot = removalPotential(hand, c.idx, evOf);
      const better = !bestPot || !best ||
        pot.maxType > bestPot.maxType ||
        (pot.maxType === bestPot.maxType && pot.strong > bestPot.strong) ||
        (pot.maxType === bestPot.maxType && pot.strong === bestPot.strong && c.sc > best.sc);
      if (better) { best = c; bestPot = pot; }
    }
    return (best || candidates[0]).idx;
  },
  chooseP2Join(hand, view, me) {
    const race = !view.firstEmpty && hand.length <= minOtherHand(view, me);
    const valid = combosOfType(hand, view.requiredType);
    if (valid.length) {
      const winProb = estimateWinRate(maxBy(valid).ev, view, me);
      if (winProb >= 0.5) return true;
      return hand.length <= 6 && race && winProb >= 0.3;
    }
    // 无有效组合：要求牌型罕见时，用无效出牌抢先打空
    const t = view.requiredType;
    return (t === 3 || t === 4 || t === 5) && countPossibleValid(poolOf(view, hand), t, 2) <= 1 && hand.length <= 6 && race;
  },
  chooseP2Cards(hand, view) { return bestValidOrDiscard(hand, view.requiredType); }
};

/* ---------- ai-2：王/235 优先、首回合垫牌、三条分阶段处理；第二阶段前 50% 参与 ---------- */

const hasJoker = (c: Combo, hand: Card[]) => c.idx.some(i => isJoker(hand[i]));

function bestWhere(combos: Combo[], pred: (c: Combo) => boolean): Combo | null {
  let best: Combo | null = null;
  for (const c of combos) if (pred(c) && (!best || c.sc > best.sc)) best = c;
  return best;
}

/** 垫牌：无王、非 235 的最低单张组合；没有则退回最弱组合 */
function discardLowest(combos: Combo[], hand: Card[]): number[] {
  const singles = combos.filter(c => !c.ev.special235 && !hasJoker(c, hand) && c.ev.type === 1).sort((a, b) => a.sc - b.sc);
  if (singles.length) return singles[0].idx;
  const noJoker = combos.filter(c => !hasJoker(c, hand));
  return minBy(noJoker.length ? noJoker : combos).idx;
}

const sAi2: Strategy = {
  chooseP1(hand, view) {
    const combos = combosOfHand(hand);
    const s235 = best235(combos);
    if (view.round === 0) {
      if (s235) return s235.idx;
      const joker = bestWhere(combos, c => hasJoker(c, hand));
      return joker ? joker.idx : discardLowest(combos, hand);
    }
    if (s235) return hand.length === 3 ? discardLowest(combos, hand) : s235.idx;
    const jokerTrip = bestWhere(combos, c => c.ev.type === 6 && hasJoker(c, hand));
    const natTrip = bestWhere(combos, c => c.ev.type === 6 && !hasJoker(c, hand));
    // 含王三条只在点数严格高于自然三条时打出，否则保留王
    if (jokerTrip && (!natTrip || jokerTrip.ev.points[0] > natTrip.ev.points[0])) return jokerTrip.idx;
    if (natTrip) {
      const can235 = countPossible235(poolOf(view, hand)) > 0;
      return hand.length > 6 || !can235 ? natTrip.idx : discardLowest(combos, hand);
    }
    return discardLowest(combos, hand);
  },
  chooseP2Join(hand, view, me) {
    const race = !view.firstEmpty && hand.length <= minOtherHand(view, me);
    const valid = combosOfType(hand, view.requiredType);
    if (valid.length) {
      const myBest = maxBy(valid);
      if (hand.length === 3) return true;
      if (splitsProtection(myBest.idx, protectedSetsOf(hand, true, false))) return false;
      return estimateWinRate(myBest.ev, view, me) >= 0.5;
    }
    return hand.length === 3 || (hand.length <= 6 && race);
  },
  chooseP2Cards(hand, view) { return bestValidOrDiscard(hand, view.requiredType); }
};

/* ---------- 注册表 ---------- */

export const STRATEGIES: Record<string, Strategy> = {
  '1-1': s11, '2-1': s21, '2-2': s22, '3-1': s31, 'ai-1': sAi1, 'ai-2': sAi2
};
export const STRATEGY_KEYS = Object.keys(STRATEGIES);

export function getStrategy(key: string | null | undefined): Strategy {
  return (key && STRATEGIES[key]) || STRATEGIES['2-1'];
}

export function randomStrategyKey(rng: Rng): string {
  return STRATEGY_KEYS[Math.floor(rng() * STRATEGY_KEYS.length)];
}

/** 电脑座位：指定的策略原样使用；未指定或 'random' 时随机抽取 */
export function resolveStrategies(seatTypes: SeatType[], picks: (string | null | undefined)[], rng: Rng): [string | null, string | null, string | null] {
  return [0, 1, 2].map(s => {
    if (seatTypes[s] !== 'ai') return null;
    const p = picks[s];
    return p && p !== 'random' && STRATEGIES[p] ? p : randomStrategyKey(rng);
  }) as [string | null, string | null, string | null];
}
