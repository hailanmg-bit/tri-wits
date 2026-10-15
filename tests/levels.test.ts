import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine';
import { LEVEL_ORDERS, getLevels, levelById, startRun, recordGame, nextGame, isUnlocked } from '../src/game/levels';
import { seeded } from './rng';

function finished(scores: number[], base: number[], log: Game['log']): Game {
  const g = new Game(['human', 'ai', 'ai']);
  g.finalScores = scores; g.base = base as Game['base']; g.log = log; g.gameOver = true;
  return g;
}

describe('levels', () => {
  for (const order of LEVEL_ORDERS) {
    it(`${order}: 30 levels, 16-30 mirror 1-15 with a time limit`, () => {
      const levels = getLevels(order);
      expect(levels).toHaveLength(30);
      for (let i = 1; i <= 15; i++) {
        const a = levelById(i, order)!, b = levelById(i + 15, order)!;
        expect(b.hard).toBe(true);
        expect({ ...b, id: 0, hard: false }).toEqual({ ...a, id: 0, hard: false });
      }
    });

    it(`${order}: builds distinct opponent pairs for shuffle levels`, () => {
      for (const cfg of getLevels(order).filter(l => l.opp.mode !== 'fixed')) {
        const run = startRun(cfg, seeded(cfg.id));
        expect(run.games).toHaveLength(cfg.games);
        expect(new Set(run.games.map(p => p.join('+'))).size).toBe(cfg.games);
        run.games.forEach(p => expect(p[0]).not.toBe(p[1]));
      }
    });
  }

  it('original order starts with Kai and ends the first act with Dr. Su + Frost', () => {
    expect(levelById(1, 'original')!.opp).toEqual({ mode: 'fixed', pair: ['1-1', '1-1'] });
    expect(levelById(9, 'original')!.opp).toEqual({ mode: 'fixed', pair: ['ai-1', 'ai-2'] });
    expect(levelById(1)!.opp).toEqual(levelById(1, 'original')!.opp);
  });

  it('forbidden type fails the level even when it wins a later round (old version only checked the first win)', () => {
    const cfg = levelById(15)!; // 禁止以三条赢
    let run = startRun(cfg, seeded(1));
    const g = finished([30, 12, 12], [5, 0, 0], [
      { t: 'p1Won', round: 0, seat: 0, type: 2, n: 9 },
      { t: 'p1Won', round: 1, seat: 1, type: 3, n: 9 },
      { t: 'p1Won', round: 2, seat: 0, type: 6, n: 9 }
    ]);
    run = recordGame(cfg, run, g);
    expect(run.status).toBe('failed');
    expect(run.failReason).toBe('forbid');
  });

  it('streak level clears after N wins; a tie for first counts as a win', () => {
    const cfg = levelById(2)!;
    let run = startRun(cfg, seeded(1));
    for (let i = 0; i < 3; i++) {
      run = recordGame(cfg, run, finished([20, 20, 14], [0, 0, 0], []));
      if (i < 2) { expect(run.status).toBe('playing'); run = nextGame(run); }
    }
    expect(run.status).toBe('cleared');
  });

  it('minBase fails early once the bonus target is out of reach', () => {
    const cfg = levelById(13)!; // 5 局中至少 4 局拿基础分
    let run = startRun(cfg, seeded(1));
    run = recordGame(cfg, run, finished([25, 15, 14], [0, 0, 5], []));
    expect(run.status).toBe('playing');
    run = recordGame(cfg, nextGame(run), finished([25, 15, 14], [0, 0, 5], []));
    expect(run.failReason).toBe('base');
  });

  it('unlocks levels in order', () => {
    expect(isUnlocked([], 1)).toBe(true);
    expect(isUnlocked([], 2)).toBe(false);
    expect(isUnlocked([1], 2)).toBe(true);
  });
});
