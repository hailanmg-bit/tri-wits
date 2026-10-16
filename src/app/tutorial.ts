/* 新手教程：一局发好牌的对局。前两回合由剧本引导（电脑按剧本出牌，玩家只能按提示操作），之后自由打完。 */
import { BotAction, Card, Game, Seat, Suit, cardKey } from '../engine';
import { Key } from './i18n';
import { Match } from './match';

const SUITS: Record<string, Suit> = { s: 0, h: 1, c: 2, d: 3 };
const RANKS: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
/** 'As' 'Th' '2c'；'BJ' 大王，'SJ' 小王 */
const card = (t: string): Card => (t === 'BJ' ? { w: 1 } : t === 'SJ' ? { w: 2 } : { r: RANKS[t[0]] ?? +t[0], s: SUITS[t[1]] });
const keys = (...ts: string[]) => ts.map(t => cardKey(card(t)));

/* 剧本用到的牌 */
const P_PAIR = ['9s', '9h', '4c'], P_HIGH = ['As', 'Jd', '6c'], P_235 = ['2c', '3d', '5h'];
const P_FILL = ['SJ', 'Ks', 'Qc', 'Th', 'Tc', '8s', '7d', '5d', '2s'];
const A_STRAIGHT = ['5c', '6h', '7s'], A_HIGH = ['Ah', 'Jc', '6d'], A_TRIPS = ['Qs', 'Qh', 'Qd'];
const B_HIGH = ['Kd', '8c', '3h'], B_FLUSH = ['4h', '8h', 'Jh'];

/** 电脑：1 号座位小豪，2 号座位大壮 */
export const TUTORIAL_BOTS: [string, string] = ['2-2', '3-1'];

export function tutorialHands(): [Card[], Card[], Card[]] {
  const p = [...P_PAIR, ...P_HIGH, ...P_235, ...P_FILL].map(card);
  const a = [...A_STRAIGHT, ...A_HIGH, ...A_TRIPS].map(card);
  const b = [...B_HIGH, ...B_FLUSH].map(card);
  const used = new Set([...p, ...a, ...b].map(cardKey));
  const rest: Card[] = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) { const c: Card = { r, s: s as Suit }; if (!used.has(cardKey(c))) rest.push(c); }
  for (const w of [1, 2] as const) if (!used.has('w' + w)) rest.push({ w });
  // 固定种子洗剩余的牌，保证每次教程完全一样
  let x = 20251015;
  const rnd = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 2 ** 32; };
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const na = 18 - a.length, nb = 18 - b.length;
  a.push(...rest.slice(0, na));
  b.push(...rest.slice(na, na + nb));
  return [p, a, b];
}

function indicesOf(g: Game, seat: Seat, ts: string[]): number[] {
  const want = keys(...ts);
  return want.map(k => g.hands[seat].findIndex(c => cardKey(c) === k));
}

/** 前两回合电脑按剧本行动 */
export function tutorialScript(g: Game, seat: Seat): BotAction | null {
  const a = seat === 1;
  if (g.round === 0) {
    if (g.phase === 'p1_select') return { kind: 'p1', indices: indicesOf(g, seat, a ? A_STRAIGHT : B_HIGH) };
    if (g.phase === 'p2_choose') return { kind: 'join', join: a };
    if (g.phase === 'p2_select') return { kind: 'p2', indices: indicesOf(g, seat, A_HIGH) };
  }
  if (g.round === 1) {
    if (g.phase === 'p1_select') return { kind: 'p1', indices: indicesOf(g, seat, a ? A_TRIPS : B_FLUSH) };
    if (g.phase === 'p2_choose') return { kind: 'join', join: !a };
  }
  return null;
}

export type CoachAct = 'play' | 'join' | 'skip' | 'next';

export interface CoachStep {
  text: Key;
  /** tap：读完点「知道了」；act：必须做指定操作 */
  mode: 'tap' | 'act';
  act?: CoachAct;
  /** 必须选中的牌 */
  pick?: string[];
  /** 提示框放在中区下方，或盖住手牌区 */
  at: 'center' | 'hand';
  /** 额外显示牌型大小表 */
  types?: boolean;
  when(m: Match): boolean;
}

const at = (round: number, phase: Game['phase']) => (m: Match) => m.game.round === round && m.game.phase === phase && (phase === 'round_end' || m.needs(0));

const STEPS: CoachStep[] = [
  { text: 'tut_welcome', mode: 'tap', at: 'hand', when: at(0, 'p1_select') },
  { text: 'tut_types', mode: 'tap', at: 'hand', types: true, when: at(0, 'p1_select') },
  { text: 'tut_p1', mode: 'act', act: 'play', pick: keys(...P_PAIR), at: 'center', when: at(0, 'p1_select') },
  { text: 'tut_reveal', mode: 'tap', at: 'hand', when: at(0, 'p2_choose') },
  { text: 'tut_req', mode: 'tap', at: 'hand', when: at(0, 'p2_choose') },
  { text: 'tut_join', mode: 'act', act: 'join', at: 'hand', when: at(0, 'p2_choose') },
  { text: 'tut_p2', mode: 'act', act: 'play', pick: keys(...P_HIGH), at: 'center', when: at(0, 'p2_select') },
  { text: 'tut_suit', mode: 'act', act: 'next', at: 'hand', when: at(0, 'round_end') },
  { text: 'tut_235', mode: 'act', act: 'play', pick: keys(...P_235), at: 'center', when: at(1, 'p1_select') },
  { text: 'tut_235win', mode: 'tap', at: 'hand', when: at(1, 'p2_choose') },
  { text: 'tut_skip', mode: 'act', act: 'skip', at: 'hand', when: at(1, 'p2_choose') },
  { text: 'tut_score', mode: 'tap', at: 'hand', when: at(1, 'round_end') },
  { text: 'tut_free', mode: 'act', act: 'next', at: 'hand', when: at(1, 'round_end') }
];

export class Tutorial {
  private i = 0;
  private listeners = new Set<() => void>();
  constructor(readonly match: Match) {}

  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  /** 当前生效的提示；等待电脑或进入自由对局时为 null */
  get step(): CoachStep | null {
    const s = STEPS[this.i];
    return s && s.when(this.match) ? s : null;
  }

  get scripted(): boolean { return this.i < STEPS.length; }

  /** 点「知道了」 */
  next(): void { if (this.step?.mode === 'tap') this.advance(); }

  /** 玩家做了某个操作；符合当前要求才推进 */
  acted(act: CoachAct): void { if (this.step?.act === act) this.advance(); }

  private advance(): void { this.i++; this.listeners.forEach(l => l()); }
}
