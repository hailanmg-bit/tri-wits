/* 电脑座位执行一步：按该座位的策略决定并提交动作 */
import { Game, Seat } from './game';
import { getStrategy } from './ai/strategies';

export type BotAction =
  | { kind: 'p1'; indices: number[] }
  | { kind: 'join'; join: boolean }
  | { kind: 'p2'; indices: number[] };

/** 只计算不提交；当前阶段该座位无需行动时返回 null */
export function decideBot(game: Game, seat: Seat): BotAction | null {
  const s = getStrategy(game.seatStrategies[seat]);
  const hand = game.hands[seat];
  if (game.phase === 'p1_select' && game.pending.includes(seat) && !game.p1Locked[seat]) {
    return { kind: 'p1', indices: s.chooseP1(hand, game, seat) };
  }
  if (game.phase === 'p2_choose' && game.pending.includes(seat) && !game.p2Decided[seat]) {
    return { kind: 'join', join: s.chooseP2Join(hand, game, seat) };
  }
  if (game.phase === 'p2_select' && game.pending.includes(seat) && !game.p2Locked[seat]) {
    return { kind: 'p2', indices: s.chooseP2Cards(hand, game, seat) };
  }
  return null;
}

export function applyAction(game: Game, seat: Seat, a: BotAction): boolean {
  if (a.kind === 'p1') return game.playP1(seat, a.indices);
  if (a.kind === 'join') return game.chooseP2(seat, a.join);
  return game.playP2(seat, a.indices);
}

/** 让电脑座位执行一步，返回执行的动作 */
export function botStep(game: Game, seat: Seat): BotAction | null {
  const a = decideBot(game, seat);
  if (a && !applyAction(game, seat, a)) throw new Error(`bot ${game.seatStrategies[seat]} produced illegal action ${JSON.stringify(a)}`);
  return a;
}
