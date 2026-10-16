import { describe, it, expect, vi } from 'vitest';

// 聊天依赖 store（localStorage）；测试环境给一个内存版
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) });
vi.stubGlobal('navigator', { languages: ['en'] });
vi.stubGlobal('document', { documentElement: {} });

describe('table chatter', () => {
  it('bots talk during a game and stay quiet when muted', async () => {
    vi.useFakeTimers();
    const { Match } = await import('../src/app/match');
    const { Chatter } = await import('../src/app/chatter');
    const { seeded } = await import('./rng');
    const { decideBot, applyAction } = await import('../src/engine');
    const run = (muted: boolean) => {
      const m = new Match({ bots: ['2-2', '3-1'], timed: false, rng: seeded(3) });
      const c = new Chatter(m, () => muted, () => 0);
      let said = 0;
      c.subscribe(() => { said += c.bubbles.length ? 1 : 0; });
      for (let i = 0; i < 400 && !m.game.gameOver; i++) {
        const g = m.game;
        if (g.phase === 'round_end') m.nextRound();
        else if (m.needs(0)) { const a = decideBot(g, 0)!; applyAction(g, 0, a); (m as any).tick(); }
        vi.advanceTimersByTime(1500);
      }
      vi.advanceTimersByTime(5000);
      m.dispose(); c.dispose();
      return said;
    };
    expect(run(false)).toBeGreaterThan(0);
    expect(run(true)).toBe(0);
    vi.useRealTimers();
  });
});
