/* 牌与牌堆：点数 2..14（A=14），花色 0..3（♠ ♥ ♣ ♦，序号越小越大），王用 w 区分 */

export type Suit = 0 | 1 | 2 | 3;

export interface NaturalCard { r: number; s: Suit; w?: undefined }
export interface JokerCard { w: 1 | 2; r?: undefined; s?: undefined } // 1=大王 2=小王
export type Card = NaturalCard | JokerCard;

/** 随机数源；默认在调用时读取 Math.random，便于测试中替换为可复现的序列 */
export type Rng = () => number;
export const defaultRng: Rng = () => Math.random();

export const RANK_STR = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUIT_CHARS = ['♠', '♥', '♣', '♦'];

export function isJoker(c: Card | null | undefined): c is JokerCard {
  return !!c && typeof c.w === 'number';
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) deck.push({ r, s: s as Suit });
  deck.push({ w: 1 });
  deck.push({ w: 2 });
  return deck;
}

/** Fisher–Yates，返回新数组 */
export function shuffle<T>(arr: readonly T[], rng: Rng = defaultRng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function cardKey(c: Card): string {
  return isJoker(c) ? 'w' + c.w : c.r + '-' + c.s;
}

export function cardIsRed(c: Card): boolean {
  if (isJoker(c)) return c.w === 1;
  return c.s === 1 || c.s === 3;
}

/** 展示排序：大王、小王，然后 A→2，同点数按花色 ♠♥♣♦ */
export function compareCards(a: Card, b: Card): number {
  const key = (c: Card) => (isJoker(c) ? c.w - 1 : 16 - c.r);
  const ka = key(a), kb = key(b);
  if (ka !== kb) return ka - kb;
  const sa = isJoker(a) ? 0 : a.s;
  const sb = isJoker(b) ? 0 : b.s;
  return sa - sb;
}

/** n 个元素中取 k 个的全部下标组合（字典序） */
export function subsetsIdx(n: number, k: number): number[][] {
  const res: number[][] = [];
  const idx: number[] = [];
  (function rec(start: number) {
    if (idx.length === k) { res.push(idx.slice()); return; }
    for (let i = start; i <= n - (k - idx.length); i++) {
      idx.push(i); rec(i + 1); idx.pop();
    }
  })(0);
  return res;
}

export function combosOf<T>(arr: readonly T[], k: number): T[][] {
  return subsetsIdx(arr.length, k).map(idxs => idxs.map(i => arr[i]));
}
