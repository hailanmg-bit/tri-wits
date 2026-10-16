/* 牌桌聊天：根据对局事件让电脑按性格说话，玩家可以发快捷语，电脑偶尔回应。同一时间每个座位最多一个气泡。 */
import { GameEvent, Seat } from '../engine';
import { Match } from './match';
import { Moment, botLine } from './lines';
import { store } from './store';

export interface Bubble { seat: Seat; text: string; id: number }

const SHOW_MS = 2600;
/** 亮牌动画结束后再说话 */
const AFTER_REVEAL_MS = 900;

export class Chatter {
  bubbles: Bubble[] = [];
  private seen: number;
  private nextId = 1;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private lastPlayerChat = 0;
  private unsub: () => void;

  constructor(private match: Match, private muted: () => boolean = () => false, private rnd: () => number = Math.random) {
    this.seen = match.game.log.length;
    this.unsub = match.subscribe(() => this.onEvents());
  }

  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  dispose() { this.unsub(); this.timers.forEach(clearTimeout); this.timers.clear(); this.listeners.clear(); }

  bubbleOf(seat: Seat): Bubble | undefined { return this.bubbles.find(b => b.seat === seat); }

  /** 玩家发快捷语；3 秒内只能发一次。返回是否发出 */
  playerSays(text: string): boolean {
    const now = Date.now();
    if (now - this.lastPlayerChat < 3000) return false;
    this.lastPlayerChat = now;
    this.show(0, text);
    // 一个电脑接话
    const bots = ([1, 2] as Seat[]).filter(s => !this.bubbleOf(s));
    if (bots.length && this.rnd() < 0.6) {
      const s = bots[Math.floor(this.rnd() * bots.length)];
      this.later(900 + this.rnd() * 500, () => this.botSays(s, 'reply'));
    }
    return true;
  }

  private enabled(): boolean { return store.get().chat && !this.muted(); }

  private onEvents(): void {
    const log = this.match.game.log;
    const fresh = log.slice(this.seen);
    this.seen = log.length;
    if (!this.enabled()) return;
    for (const e of fresh) this.react(e);
  }

  private react(e: GameEvent): void {
    const g = this.match.game;
    const bots = ([1, 2] as Seat[]);
    switch (e.t) {
      case 'p1Won': case 'p2Won': {
        const ranked = e.t === 'p1Won' ? g.p1Ranked : g.p2Ranked;
        const top = ranked?.[0];
        if (e.seat !== 0) {
          const big = !!top && (top.ev.type >= 5 || top.ev.special235);
          if (big || this.rnd() < 0.55) this.later(AFTER_REVEAL_MS, () => this.botSays(e.seat, big ? 'bigWin' : 'win'));
        } else if (this.rnd() < 0.5) {
          const losers = (ranked || []).map(r => r.seat).filter(s => s !== 0);
          if (losers.length) this.later(AFTER_REVEAL_MS, () => this.botSays(losers[Math.floor(this.rnd() * losers.length)], 'lose'));
        }
        break;
      }
      case 'p2Open': {
        const joiners = bots.filter(s => g.p2Joins[s]);
        if (joiners.length && this.rnd() < 0.35) this.later(300, () => this.botSays(joiners[Math.floor(this.rnd() * joiners.length)], 'join'));
        break;
      }
      case 'emptied':
        if (e.seat !== 0 && this.rnd() < 0.7) this.later(AFTER_REVEAL_MS + 600, () => this.botSays(e.seat, 'out'));
        break;
      case 'final': {
        const top = Math.max(...e.scores);
        const winners = bots.filter(s => e.scores[s] === top);
        if (winners.length) this.later(AFTER_REVEAL_MS, () => this.botSays(winners[0], 'gameWin'));
        else this.later(AFTER_REVEAL_MS, () => this.botSays(bots[Math.floor(this.rnd() * 2)], 'gameLose'));
        break;
      }
    }
  }

  private botSays(seat: Seat, m: Moment): void {
    if (!this.enabled()) return;
    const ending = m === 'gameWin' || m === 'gameLose';
    // 对局结束后只说收尾台词；收尾台词可以顶掉正在显示的气泡
    if (this.match.game.gameOver && !ending) return;
    if (this.bubbleOf(seat) && !ending) return;
    const text = botLine(this.match.game.seatStrategies[seat], m, this.rnd);
    if (text) this.show(seat, text);
  }

  private show(seat: Seat, text: string): void {
    const b: Bubble = { seat, text, id: this.nextId++ };
    this.bubbles = [...this.bubbles.filter(x => x.seat !== seat), b];
    this.emit();
    this.later(SHOW_MS, () => { this.bubbles = this.bubbles.filter(x => x.id !== b.id); this.emit(); });
  }

  private later(ms: number, fn: () => void): void {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  private emit(): void { this.listeners.forEach(l => l()); }
}
