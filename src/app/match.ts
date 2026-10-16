/* 一局对局的驱动：真人在 0 号座位，电脑各自独立“思考”后出牌；限时模式下超时自动代打。 */
import { BotAction, Card, Game, GameEvent, Rng, Seat, applyAction, decideBot, defaultRng, resolveStrategies } from '../engine';

export interface MatchOptions {
  bots: [string, string];   // 1、2 号座位的策略（'random' 为随机）
  timed: boolean;
  rng?: Rng;
  /** 指定三手牌（新手教程） */
  hands?: [Card[], Card[], Card[]];
  /** 电脑的剧本动作；返回 null 时按策略行动 */
  script?: (game: Game, seat: Seat) => BotAction | null;
}

const BOT_DELAY = [450, 1050];
const AUTO_NEXT_MS = 1400;

export class Match {
  readonly game: Game;
  readonly timed: boolean;
  /** 限时模式下真人本次操作的截止时间（ms 时间戳）；无需操作时为 null */
  deadline: number | null = null;
  /** 最近一次超时代打的提示 */
  timeout: 'play' | 'skip' | null = null;
  version = 0;

  private listeners = new Set<() => void>();
  private botTimers = new Map<Seat, ReturnType<typeof setTimeout>>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private turnKey = '';
  private nextTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private script: MatchOptions['script'];

  constructor(opts: MatchOptions) {
    const rng = opts.rng ?? defaultRng;
    this.timed = opts.timed;
    this.script = opts.script;
    this.game = new Game(['human', 'ai', 'ai'], rng);
    if (opts.hands) this.game.startWith(opts.hands); else this.game.start();
    this.game.seatStrategies = resolveStrategies(this.game.seatTypes, [null, opts.bots[0], opts.bots[1]], rng);
    this.tick();
  }

  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  get events(): readonly GameEvent[] { return this.game.log; }

  /** 当前阶段某座位是否还需要行动 */
  needs(seat: Seat): boolean {
    const g = this.game;
    if (!g.pending.includes(seat)) return false;
    if (g.phase === 'p1_select') return !g.p1Locked[seat];
    if (g.phase === 'p2_choose') return !g.p2Decided[seat];
    if (g.phase === 'p2_select') return !g.p2Locked[seat];
    return false;
  }

  playCards(indices: number[]): boolean {
    const g = this.game;
    const ok = g.phase === 'p1_select' ? g.playP1(0, indices) : g.phase === 'p2_select' ? g.playP2(0, indices) : false;
    if (ok) { this.timeout = null; this.tick(); }
    return ok;
  }

  chooseJoin(join: boolean): boolean {
    const ok = this.game.chooseP2(0, join);
    if (ok) { this.timeout = null; this.tick(); }
    return ok;
  }

  nextRound(): void {
    if (this.game.nextRound()) this.tick();
  }

  dispose(): void {
    this.disposed = true;
    this.botTimers.forEach(clearTimeout);
    this.botTimers.clear();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.listeners.clear();
  }

  /** 状态变化后：通知界面、安排电脑行动、维护计时器 */
  private tick(): void {
    if (this.disposed) return;
    this.version++;
    this.scheduleBots();
    this.scheduleTurnTimer();
    this.scheduleAutoNext();
    this.listeners.forEach(l => l());
  }

  private stageKey(): string { return this.game.round + ':' + this.game.phase; }

  private scheduleBots(): void {
    for (const seat of [1, 2] as Seat[]) {
      if (!this.needs(seat) || this.botTimers.has(seat)) continue;
      const key = this.stageKey();
      const delay = BOT_DELAY[0] + Math.random() * (BOT_DELAY[1] - BOT_DELAY[0]);
      this.botTimers.set(seat, setTimeout(() => {
        this.botTimers.delete(seat);
        if (this.disposed || this.stageKey() !== key || !this.needs(seat)) { this.scheduleBots(); return; }
        const a = this.script?.(this.game, seat) ?? decideBot(this.game, seat);
        if (a && !applyAction(this.game, seat, a)) throw new Error(`bot produced illegal action ${JSON.stringify(a)}`);
        this.tick();
      }, delay));
    }
  }

  private scheduleTurnTimer(): void {
    const key = this.stageKey();
    const active = this.timed && this.needs(0);
    if (!active) {
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = null; this.deadline = null; this.turnKey = '';
      return;
    }
    if (this.turnKey === key) return;
    this.turnKey = key;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    const g = this.game;
    const seconds = g.round === 0 && g.phase === 'p1_select' ? 30 : 15;
    this.deadline = Date.now() + seconds * 1000;
    this.turnTimer = setTimeout(() => this.onTimeout(key), seconds * 1000);
  }

  /** 超时：选牌阶段按默认电脑策略代打（不像旧版那样直接出最大的三张），是否参与则视为跳过 */
  private onTimeout(key: string): void {
    this.turnTimer = null;
    if (this.disposed || this.stageKey() !== key || !this.needs(0)) return;
    if (this.game.phase === 'p2_choose') {
      this.game.chooseP2(0, false);
      this.timeout = 'skip';
    } else {
      const a = decideBot(this.game, 0);
      if (!a) return;
      applyAction(this.game, 0, a);
      this.timeout = 'play';
    }
    this.turnKey = '';
    this.tick();
  }

  /** 限时模式、或真人已打空手牌时，回合结束后自动进入下一回合 */
  private scheduleAutoNext(): void {
    const g = this.game;
    if (g.phase !== 'round_end' || this.nextTimer) return;
    const humanOut = g.hands[0].length === 0;
    const willEnd = g.holders().length <= 1;
    if (!(this.timed || humanOut) || willEnd) return;
    const round = g.round;
    this.nextTimer = setTimeout(() => {
      this.nextTimer = null;
      if (this.disposed || g.phase !== 'round_end' || g.round !== round) return;
      this.nextRound();
    }, AUTO_NEXT_MS);
  }
}
