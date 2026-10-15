/* 闯关模式：关卡配置、每关的对局安排、胜负判定。只依赖引擎，不涉及界面。 */
import { Game, HandType, Rng, STRATEGY_KEYS, shuffle } from '../engine';

/**
 * 对手安排
 * - fixed：每局都用同一对电脑
 * - shuffle：从列表中两两组合，每局一组、不重复
 * - anchor：anchor 固定出场，搭配其余策略中随机一个、每局不重复
 */
export type OppMode =
  | { mode: 'fixed'; pair: [string, string] }
  | { mode: 'shuffle'; pool: string[] }
  | { mode: 'anchor'; anchor: string; pool: string[] };

/** win：赢一局 · streak：连赢 N 局 · score：N 局总分达标 */
export type Goal =
  | { cond: 'win' }
  | { cond: 'streak'; minBase?: number; forbid?: HandType }
  | { cond: 'score'; target: number };

export interface LevelConfig {
  id: number;
  games: number;
  opp: OppMode;
  goal: Goal;
  /** 困难版：限时出牌 */
  hard: boolean;
}

const ALL = STRATEGY_KEYS.slice();
type BaseLevel = Omit<LevelConfig, 'id' | 'hard'>;

/** 第 11~15 关：随机对手 + 附加条件，两套顺序共用 */
const LATE: BaseLevel[] = [
  { games: 5, opp: { mode: 'shuffle', pool: ALL }, goal: { cond: 'streak' } },
  { games: 5, opp: { mode: 'shuffle', pool: ALL }, goal: { cond: 'score', target: 150 } },
  { games: 5, opp: { mode: 'shuffle', pool: ALL }, goal: { cond: 'streak', minBase: 4 } },
  { games: 5, opp: { mode: 'shuffle', pool: ALL }, goal: { cond: 'streak', forbid: 1 } },
  { games: 5, opp: { mode: 'shuffle', pool: ALL }, goal: { cond: 'streak', forbid: 6 } }
];

/** 原版顺序（依据《博弈牌关卡设置》）：阿凯 → 老周 → 小豪 → 大壮 → 苏博士/冷锋 */
const ORIGINAL: BaseLevel[] = [
  { games: 1, opp: { mode: 'fixed', pair: ['1-1', '1-1'] }, goal: { cond: 'win' } },
  { games: 3, opp: { mode: 'fixed', pair: ['1-1', '1-1'] }, goal: { cond: 'streak' } },
  { games: 1, opp: { mode: 'fixed', pair: ['2-1', '2-1'] }, goal: { cond: 'win' } },
  { games: 1, opp: { mode: 'fixed', pair: ['2-2', '2-2'] }, goal: { cond: 'win' } },
  { games: 1, opp: { mode: 'fixed', pair: ['2-1', '2-2'] }, goal: { cond: 'win' } },
  { games: 3, opp: { mode: 'shuffle', pool: ['2-1', '2-2', '1-1'] }, goal: { cond: 'streak' } },
  { games: 1, opp: { mode: 'fixed', pair: ['3-1', '3-1'] }, goal: { cond: 'win' } },
  { games: 3, opp: { mode: 'shuffle', pool: ['2-1', '2-2', '3-1'] }, goal: { cond: 'streak' } },
  { games: 3, opp: { mode: 'fixed', pair: ['ai-1', 'ai-2'] }, goal: { cond: 'streak' } },
  { games: 3, opp: { mode: 'anchor', anchor: '1-1', pool: ALL }, goal: { cond: 'streak' } },
  ...LATE
];

/*
 * 模拟顺序：按 scripts/sim.ts 电脑对电脑的实测排序（2026-10，每格 120 局；数值为其他电脑对阵它的平均胜率，越低越难）：
 * 小豪 2-2 41.7% < 冷锋 ai-2 41.3% < 苏博士 ai-1 41.0% < 阿凯 1-1 35.8% < 老周 2-1 31.2% < 大壮 3-1 27.0%
 * 电脑之间相互克制明显，不代表真人体感；两套顺序都保留，由实测决定。
 */
const SIMULATED: BaseLevel[] = [
  { games: 1, opp: { mode: 'fixed', pair: ['2-2', '2-2'] }, goal: { cond: 'win' } },
  { games: 3, opp: { mode: 'fixed', pair: ['2-2', '2-2'] }, goal: { cond: 'streak' } },
  { games: 1, opp: { mode: 'fixed', pair: ['ai-2', 'ai-2'] }, goal: { cond: 'win' } },
  { games: 1, opp: { mode: 'fixed', pair: ['ai-1', 'ai-1'] }, goal: { cond: 'win' } },
  { games: 1, opp: { mode: 'fixed', pair: ['ai-2', 'ai-1'] }, goal: { cond: 'win' } },
  { games: 3, opp: { mode: 'shuffle', pool: ['2-2', 'ai-2', 'ai-1'] }, goal: { cond: 'streak' } },
  { games: 1, opp: { mode: 'fixed', pair: ['1-1', '1-1'] }, goal: { cond: 'win' } },
  { games: 3, opp: { mode: 'shuffle', pool: ['ai-1', '1-1', '2-1'] }, goal: { cond: 'streak' } },
  { games: 3, opp: { mode: 'fixed', pair: ['2-1', '3-1'] }, goal: { cond: 'streak' } },
  { games: 3, opp: { mode: 'anchor', anchor: '3-1', pool: ALL }, goal: { cond: 'streak' } },
  ...LATE
];

/** 对手顺序：original 原版（默认）· simulated 按模拟强弱 */
export type LevelOrder = 'original' | 'simulated';
export const LEVEL_ORDERS: LevelOrder[] = ['original', 'simulated'];
export const DEFAULT_LEVEL_ORDER: LevelOrder = 'original';

/** 1~15 关为普通版，16~30 关为同样配置的限时困难版 */
export function getLevels(order: LevelOrder = DEFAULT_LEVEL_ORDER): LevelConfig[] {
  const base = order === 'simulated' ? SIMULATED : ORIGINAL;
  return [
    ...base.map((l, i) => ({ ...l, id: i + 1, hard: false })),
    ...base.map((l, i) => ({ ...l, id: i + 16, hard: true }))
  ];
}

export function levelById(id: number, order: LevelOrder = DEFAULT_LEVEL_ORDER): LevelConfig | undefined {
  return getLevels(order).find(l => l.id === id);
}

export function isUnlocked(cleared: number[], id: number): boolean {
  return id <= 1 || cleared.includes(id - 1);
}

/* ---------- 一次闯关 ---------- */

export interface LevelRun {
  levelId: number;
  /** 每局两位电脑的策略 */
  games: [string, string][];
  idx: number;
  wins: number;
  totalScore: number;
  baseGames: number;
  status: 'playing' | 'cleared' | 'failed';
  failReason: 'loss' | 'forbid' | 'base' | 'score' | null;
}

function pairsOf(pool: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) out.push([pool[a], pool[b]]);
  return out;
}

export function startRun(cfg: LevelConfig, rng: Rng): LevelRun {
  let games: [string, string][];
  const o = cfg.opp;
  if (o.mode === 'fixed') {
    games = Array.from({ length: cfg.games }, () => [o.pair[0], o.pair[1]] as [string, string]);
  } else if (o.mode === 'shuffle') {
    games = shuffle(pairsOf(o.pool), rng).slice(0, cfg.games);
  } else {
    const others = shuffle(o.pool.filter(k => k !== o.anchor), rng);
    games = Array.from({ length: cfg.games }, (_, i) => [o.anchor, others[i]] as [string, string]);
  }
  return { levelId: cfg.id, games, idx: 0, wins: 0, totalScore: 0, baseGames: 0, status: 'playing', failReason: null };
}

/** 玩家（0 号座位）本局赢下阶段时所用的牌型 */
export function phaseWinTypes(game: Game, seat = 0): HandType[] {
  const out: HandType[] = [];
  for (const e of game.log) if ((e.t === 'p1Won' || e.t === 'p2Won') && e.seat === seat) out.push(e.type);
  return out;
}

/** 并列第一也算赢 */
export function playerWon(game: Game, seat = 0): boolean {
  const f = game.finalScores!;
  return f.every((v, i) => i === seat || f[seat] >= v);
}

/** 一局结束后推进闯关进度；返回新的 run（不修改入参） */
export function recordGame(cfg: LevelConfig, prev: LevelRun, game: Game): LevelRun {
  const run = { ...prev };
  const score = game.finalScores![0];
  const won = playerWon(game);
  const gotBase = game.base[0] > 0;
  run.totalScore += score;
  if (won) run.wins++;
  if (gotBase) run.baseGames++;
  const done = run.idx + 1 >= cfg.games;
  const g = cfg.goal;

  if (g.cond === 'score') {
    if (done) {
      run.status = run.totalScore >= g.target ? 'cleared' : 'failed';
      run.failReason = run.status === 'failed' ? 'score' : null;
    }
  } else {
    if (!won) run.failReason = 'loss';
    else if (g.cond === 'streak' && g.forbid && phaseWinTypes(game).includes(g.forbid)) run.failReason = 'forbid';
    else if (g.cond === 'streak' && g.minBase && run.baseGames + (cfg.games - run.idx - 1) < g.minBase) run.failReason = 'base';
    if (run.failReason) run.status = 'failed';
    else if (done) run.status = 'cleared';
  }
  return run;
}

/** 进入下一局 */
export function nextGame(run: LevelRun): LevelRun {
  return { ...run, idx: run.idx + 1 };
}
