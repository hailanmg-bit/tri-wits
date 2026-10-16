/* 对局状态机：发牌 → 每回合 第一阶段（必出）→ 第二阶段（自愿）→ 回合结算 → … → 终局 */
import { Card, Rng, defaultRng, makeDeck, shuffle } from './cards';
import { HandEval, HandType, evalHand3, rankBy } from './evaluate';

export type Seat = 0 | 1 | 2;
export const SEATS: Seat[] = [0, 1, 2];
export type SeatType = 'human' | 'ai';
export type Phase = 'p1_select' | 'p2_choose' | 'p2_select' | 'round_end' | 'game_over';

export interface RankedEntry { seat: Seat; ev: HandEval }
export interface EmptyMark { r: number; p: 1 | 2 }

/** 引擎只产出结构化事件，文案由界面层本地化 */
export type GameEvent =
  | { t: 'p1Played'; round: number; seat: Seat }
  | { t: 'p1Won'; round: number; seat: Seat; type: HandType; n: number }
  | { t: 'p2NotEnough'; round: number }
  | { t: 'p2Join'; round: number; seat: Seat }
  | { t: 'p2Skip'; round: number; seat: Seat }
  | { t: 'p2Open'; round: number; type: HandType }
  | { t: 'p2Played'; round: number; seat: Seat }
  | { t: 'p2AllInvalid'; round: number }
  | { t: 'p2Won'; round: number; seat: Seat; type: HandType; n: number }
  | { t: 'emptied'; round: number; seat: Seat; phase: 1 | 2 }
  | { t: 'gameOverRemain'; round: number; seat: Seat; n: number; k: number }
  | { t: 'gameOverNone'; round: number }
  | { t: 'base'; round: number; seats: Seat[] }
  | { t: 'final'; round: number; scores: number[]; base: number[]; piles: number[] };

type Triple<T> = [T, T, T];
const triple = <T>(v: T): Triple<T> => [v, v, v];

/** 合法出牌下标：3 个互不相同、在手牌范围内的整数 */
export function validIndices(indices: unknown, handLen: number): indices is number[] {
  return Array.isArray(indices) && indices.length === 3 &&
    indices.every(i => Number.isInteger(i) && i >= 0 && i < handLen) &&
    new Set(indices).size === 3;
}

export class Game {
  readonly seatTypes: Triple<SeatType>;
  readonly rng: Rng;
  /** 电脑座位使用的策略 key（由调用方在 start() 之后设置；真人座位为 null） */
  seatStrategies: Triple<string | null> = triple(null);

  deck: Card[] = [];
  hands: Triple<Card[]> = [[], [], []];
  piles: Triple<number> = triple(0);
  base: Triple<number> = triple(0);
  round = 0;
  phase: Phase = 'p1_select';
  currentSeat: Seat = 0;
  pending: Seat[] = [];

  playedP1: Triple<Card[] | null> = triple(null);
  p1Sel: Triple<number[] | null> = triple(null);
  p1Locked: Triple<boolean> = triple(false);
  p1Ranked: RankedEntry[] | null = null;
  p1Winner = -1;
  requiredType: HandType | null = null;

  p2Decided: Triple<boolean> = triple(false);
  p2Joins: Triple<boolean> = triple(false);
  playedP2: Triple<Card[] | null> = triple(null);
  p2Sel: Triple<number[] | null> = triple(null);
  p2Locked: Triple<boolean> = triple(false);
  p2Ranked: RankedEntry[] | null = null;
  p2Winner = -1;
  p2Refund = false;
  p2Skipped = false;

  /** 上一回合第一阶段各家亮出的牌（公开信息） */
  lastRoundP1: Triple<Card[] | null> = triple(null);
  /** 已经亮出的全部牌（公开信息） */
  seen: Card[] = [];
  emptiedAt: Triple<EmptyMark | null> = triple(null);
  firstEmpty: EmptyMark | null = null;
  gameOver = false;
  finalScores: number[] | null = null;
  log: GameEvent[] = [];

  constructor(seatTypes: SeatType[] = ['human', 'human', 'human'], rng: Rng = defaultRng) {
    this.seatTypes = [seatTypes[0], seatTypes[1], seatTypes[2]];
    this.rng = rng;
  }

  start(): void {
    this.deck = shuffle(makeDeck(), this.rng);
    this.hands = [[], [], []];
    for (let i = 0; i < 54; i++) this.hands[i % 3].push(this.deck[i]);
    this.setupPhase1();
  }

  /** 用指定的三手牌开局（新手教程用），每手 18 张 */
  startWith(hands: Triple<Card[]>): void {
    this.deck = ([] as Card[]).concat(...hands);
    this.hands = [hands[0].slice(), hands[1].slice(), hands[2].slice()];
    this.setupPhase1();
  }

  holders(): Seat[] { return SEATS.filter(s => this.hands[s].length > 0); }

  private setupPhase1(): void {
    this.phase = 'p1_select';
    this.pending = this.holders();
    this.currentSeat = this.pending.length ? this.pending[0] : 0;
  }

  /** 第一阶段出牌；不合法或不轮到时返回 false */
  playP1(seat: Seat, indices: number[]): boolean {
    if (this.phase !== 'p1_select' || this.p1Locked[seat] || !this.pending.includes(seat)) return false;
    if (!validIndices(indices, this.hands[seat].length)) return false;
    this.p1Sel[seat] = indices.slice();
    this.playedP1[seat] = indices.map(i => this.hands[seat][i]);
    this.p1Locked[seat] = true;
    this.emit({ t: 'p1Played', round: this.round, seat });
    const next = this.pending.find(s => !this.p1Locked[s]);
    if (next !== undefined) this.currentSeat = next;
    else this.resolvePhase1();
    return true;
  }

  private takePlayed(seat: Seat, sel: number[]): void {
    this.hands[seat] = this.hands[seat].filter((_, i) => !sel.includes(i));
  }

  private resolvePhase1(): void {
    const entries: RankedEntry[] = [];
    for (const seat of this.pending) {
      const played = this.playedP1[seat]!;
      this.takePlayed(seat, this.p1Sel[seat]!);
      entries.push({ seat, ev: evalHand3(played) });
      this.seen.push(...played);
      if (this.hands[seat].length === 0) this.markEmpty(seat, 1);
    }
    const ranked = rankBy(entries, e => e.ev);
    const top = ranked[0];
    const n = this.pending.length * 3;
    this.p1Ranked = ranked;
    this.p1Winner = top.seat;
    this.piles[top.seat] += n;
    // 第二阶段需出：第一阶段最弱一手的牌型；若 235 胜出（同场有三条），改为单张
    this.requiredType = top.ev.special235 ? 1 : ranked[ranked.length - 1].ev.type;
    this.emit({ t: 'p1Won', round: this.round, seat: top.seat, type: top.ev.type, n });

    const canJoin = this.holders();
    if (canJoin.length < 2) {
      this.p2Skipped = true;
      this.emit({ t: 'p2NotEnough', round: this.round });
      this.phase = 'round_end';
      return;
    }
    this.p2Skipped = false;
    this.phase = 'p2_choose';
    this.pending = canJoin;
    this.currentSeat = canJoin[0];
  }

  chooseP2(seat: Seat, join: boolean): boolean {
    if (this.phase !== 'p2_choose' || this.p2Decided[seat] || !this.pending.includes(seat)) return false;
    this.p2Joins[seat] = !!join;
    this.p2Decided[seat] = true;
    this.emit({ t: join ? 'p2Join' : 'p2Skip', round: this.round, seat });
    const next = this.pending.find(s => !this.p2Decided[s]);
    if (next !== undefined) { this.currentSeat = next; return true; }
    const joiners = this.pending.filter(s => this.p2Joins[s]);
    if (joiners.length < 2) {
      this.p2Skipped = true;
      this.emit({ t: 'p2NotEnough', round: this.round });
      this.phase = 'round_end';
      return true;
    }
    this.phase = 'p2_select';
    this.pending = joiners;
    this.currentSeat = joiners[0];
    this.emit({ t: 'p2Open', round: this.round, type: this.requiredType! });
    return true;
  }

  playP2(seat: Seat, indices: number[]): boolean {
    if (this.phase !== 'p2_select' || this.p2Locked[seat] || !this.pending.includes(seat)) return false;
    if (!validIndices(indices, this.hands[seat].length)) return false;
    this.p2Sel[seat] = indices.slice();
    this.playedP2[seat] = indices.map(i => this.hands[seat][i]);
    this.p2Locked[seat] = true;
    this.emit({ t: 'p2Played', round: this.round, seat });
    const next = this.pending.find(s => !this.p2Locked[s]);
    if (next !== undefined) this.currentSeat = next;
    else this.resolvePhase2();
    return true;
  }

  private resolvePhase2(): void {
    const entries: RankedEntry[] = [];
    for (const seat of this.pending) {
      const played = this.playedP2[seat]!;
      this.takePlayed(seat, this.p2Sel[seat]!);
      const ev = evalHand3(played);
      ev.invalid = ev.type !== this.requiredType;
      entries.push({ seat, ev });
      this.seen.push(...played);
      if (this.hands[seat].length === 0) this.markEmpty(seat, 2);
    }
    const valid = entries.filter(e => !e.ev.invalid);
    const invalid = entries.filter(e => e.ev.invalid);
    if (valid.length === 0) {
      // 全部无效：各家出的 3 张计入自己的牌堆
      this.p2Refund = true;
      this.p2Winner = -1;
      this.p2Ranked = entries.slice();
      for (const e of entries) this.piles[e.seat] += 3;
      this.emit({ t: 'p2AllInvalid', round: this.round });
    } else {
      this.p2Refund = false;
      const vrank = rankBy(valid, e => e.ev);
      const n = entries.length * 3;
      this.p2Ranked = vrank.concat(invalid);
      this.p2Winner = vrank[0].seat;
      this.piles[vrank[0].seat] += n;
      this.emit({ t: 'p2Won', round: this.round, seat: vrank[0].seat, type: vrank[0].ev.type, n });
    }
    this.phase = 'round_end';
  }

  private markEmpty(seat: Seat, phase: 1 | 2): void {
    this.emptiedAt[seat] = { r: this.round, p: phase };
    const f = this.firstEmpty;
    if (!f || f.r > this.round || (f.r === this.round && f.p > phase)) {
      this.firstEmpty = { r: this.round, p: phase };
    }
    this.emit({ t: 'emptied', round: this.round, seat, phase });
  }

  nextRound(): boolean {
    if (this.phase !== 'round_end') return false;
    const holders = this.holders();
    if (holders.length <= 1) {
      this.finish(holders);
      return true;
    }
    this.round++;
    this.lastRoundP1 = this.playedP1.map(p => (p && p.length ? p.slice() : null)) as Triple<Card[] | null>;
    this.p1Sel = triple(null);
    this.p1Locked = triple(false);
    this.playedP1 = triple(null);
    this.p1Ranked = null;
    this.p1Winner = -1;
    this.requiredType = null;
    this.p2Decided = triple(false);
    this.p2Joins = triple(false);
    this.p2Sel = triple(null);
    this.p2Locked = triple(false);
    this.playedP2 = triple(null);
    this.p2Ranked = null;
    this.p2Winner = -1;
    this.p2Refund = false;
    this.p2Skipped = false;
    this.setupPhase1();
    return true;
  }

  private finish(holders: Seat[]): void {
    if (holders.length === 1) {
      // 最后一人的剩余手牌平分进三家牌堆（手牌数恒为 3 的倍数）
      const last = holders[0];
      const n = this.hands[last].length;
      const k = n / 3;
      for (const s of SEATS) this.piles[s] += k;
      this.emit({ t: 'gameOverRemain', round: this.round, seat: last, n, k });
      this.hands[last] = [];
    } else {
      this.emit({ t: 'gameOverNone', round: this.round });
    }
    // 基础分：最早（同一回合同一阶段）打空手牌的玩家各得 5 分
    if (this.firstEmpty) {
      for (const s of SEATS) {
        const e = this.emptiedAt[s];
        if (e && e.r === this.firstEmpty.r && e.p === this.firstEmpty.p) this.base[s] = 5;
      }
    }
    this.emit({ t: 'base', round: this.round, seats: SEATS.filter(s => this.base[s] > 0) });
    this.finalScores = SEATS.map(s => this.base[s] + this.piles[s]);
    this.emit({ t: 'final', round: this.round, scores: this.finalScores.slice(), base: this.base.slice(), piles: this.piles.slice() });
    this.gameOver = true;
    this.phase = 'game_over';
  }

  private emit(e: GameEvent): void { this.log.push(e); }
}
