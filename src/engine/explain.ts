/* 比牌说明：亮牌结果里每一手为什么赢、为什么输给上一名。只产出结构化原因，文案由界面层本地化。 */
import { HandEval, HandType, cmpPoints } from './evaluate';
import { RankedEntry } from './game';

export type Basis =
  /** 第一名：最大 */
  | { k: 'max'; ev: HandEval }
  /** 第一名是 235 且同场有三条 */
  | { k: '235Trips' }
  /** 都是 235，比花色胜出 */
  | { k: '235Suit' }
  /** 没有三条时 235 最小 */
  | { k: '235Min' }
  | { k: 'type'; mine: HandType; above: HandType }
  /** 点数：at 为第几个比较位（0 起），前面都相同 */
  | { k: 'point'; mine: number; above: number; at: number }
  /** 上一名多一张大王 / 小王 */
  | { k: 'joker'; which: 'big' | 'small' }
  | { k: 'suit'; mine: number; above: number }
  | { k: 'invalid'; required: HandType | null };

/** 上一名 above 胜过 mine 的依据（与 cmpFull / rankBy 的比较顺序一致） */
export function basisBetween(above: HandEval, mine: HandEval): Basis {
  if (above.special235 && !mine.special235) return { k: '235Trips' };
  if (mine.special235 && !above.special235) return { k: '235Min' };
  if (above.type !== mine.type) return { k: 'type', mine: mine.type, above: above.type };
  if (cmpPoints(above, mine) !== 0) {
    let i = 0;
    while ((above.points[i] || 0) === (mine.points[i] || 0)) i++;
    return { k: 'point', mine: mine.points[i] || 0, above: above.points[i] || 0, at: i };
  }
  if (above.hasBig !== mine.hasBig) return { k: 'joker', which: 'big' };
  if (above.hasSmall !== mine.hasSmall) return { k: 'joker', which: 'small' };
  const n = Math.max(above.suitSeq.length, mine.suitSeq.length);
  let j = 0;
  while (j < n && above.suitSeq[j] === mine.suitSeq[j]) j++;
  return { k: 'suit', above: j < above.suitSeq.length ? above.suitSeq[j] : 3, mine: j < mine.suitSeq.length ? mine.suitSeq[j] : 3 };
}

/** 排名列表中第 idx 名的说明 */
export function explainEntry(ranked: readonly RankedEntry[], idx: number, required: HandType | null = null): Basis {
  const e = ranked[idx];
  if (e.ev.invalid) return { k: 'invalid', required };
  if (idx === 0) {
    if (e.ev.special235) return ranked.some(r => r.ev.type === 6) ? { k: '235Trips' } : { k: '235Suit' };
    return { k: 'max', ev: e.ev };
  }
  return basisBetween(ranked[idx - 1].ev, e.ev);
}
