import { describe, it, expect } from 'vitest';
import { Game, Seat, applyAction, botStep, cardKey, resolveStrategies } from '../src/engine';
import { TUTORIAL_BOTS, tutorialHands, tutorialScript } from '../src/app/tutorial';

/** 按剧本跑完教程：玩家动作照提示，电脑按剧本，剧本之外按策略 */
function run() {
  const g = new Game(['human', 'ai', 'ai'], () => 0.5);
  g.startWith(tutorialHands());
  g.seatStrategies = resolveStrategies(g.seatTypes, [null, ...TUTORIAL_BOTS], () => 0.5);
  const pick = (...ks: string[]) => ks.map(k => g.hands[0].findIndex(c => cardKey(c) === k));
  const bots = () => {
    for (const s of [1, 2] as Seat[]) {
      const a = tutorialScript(g, s);
      if (a) expect(applyAction(g, s, a)).toBe(true); else botStep(g, s);
    }
  };
  return { g, pick, bots };
}

describe('tutorial script', () => {
  it('deals 54 distinct cards, 18 each', () => {
    const h = tutorialHands();
    expect(h.map(x => x.length)).toEqual([18, 18, 18]);
    expect(new Set(h.flat().map(cardKey)).size).toBe(54);
  });

  it('plays out the scripted lessons', () => {
    const { g, pick, bots } = run();
    // 第 1 回合：对子输给顺子；第二阶段需出单张，同点数比花色赢
    expect(g.playP1(0, pick('9-0', '9-1', '4-2'))).toBe(true);
    bots();
    expect(g.p1Winner).toBe(1);
    expect(g.requiredType).toBe(1);
    expect(g.chooseP2(0, true)).toBe(true);
    bots();
    expect(g.phase).toBe('p2_select');
    expect(g.playP2(0, pick('14-0', '11-3', '6-2'))).toBe(true);
    bots();
    expect(g.p2Winner).toBe(0);
    expect(g.nextRound()).toBe(true);
    // 第 2 回合：235 遇三条胜出；跳过后第二阶段人数不足不开
    expect(g.playP1(0, pick('2-2', '3-3', '5-1'))).toBe(true);
    bots();
    expect(g.p1Winner).toBe(0);
    expect(g.p1Ranked![0].ev.special235).toBe(true);
    expect(g.requiredType).toBe(1);
    expect(g.chooseP2(0, false)).toBe(true);
    bots();
    expect(g.phase).toBe('round_end');
    expect(g.log.some(e => e.t === 'p2NotEnough' && e.round === 1)).toBe(true);
    // 之后自由打完
    let guard = 0;
    while (!g.gameOver && guard++ < 200) {
      if (g.phase === 'round_end') { g.nextRound(); continue; }
      botStep(g, 0 as Seat); bots();
    }
    expect(g.gameOver).toBe(true);
  });
});
