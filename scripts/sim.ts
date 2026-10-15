/* 电脑策略强弱模拟：每个策略 X 坐一个座位，对阵两个同为 Y 的电脑，轮换座位。
   用法：npm run sim -- [每个座位的局数=40] [只测这些策略，逗号分隔] */
import { Game, Seat, STRATEGY_KEYS, botStep } from '../src/engine';

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 电脑以随机顺序行动（与真实对局中并行思考一致） */
export function playOut(strats: string[], seed: number): number[] {
  const g = new Game(['ai', 'ai', 'ai'], seeded(seed));
  g.start();
  g.seatStrategies = [strats[0], strats[1], strats[2]];
  while (!g.gameOver) {
    if (g.phase === 'round_end') { g.nextRound(); continue; }
    const waiting = g.pending.filter(s =>
      g.phase === 'p1_select' ? !g.p1Locked[s] : g.phase === 'p2_choose' ? !g.p2Decided[s] : !g.p2Locked[s]);
    botStep(g, waiting[Math.floor(g.rng() * waiting.length)] as Seat);
  }
  return g.finalScores!;
}

const perSeat = Number(process.argv[2] || 40);
const only = process.argv[3] ? process.argv[3].split(',') : STRATEGY_KEYS;

for (const x of only) {
  const row: string[] = [];
  let allW = 0, allN = 0, allS = 0;
  for (const y of STRATEGY_KEYS) {
    let w = 0, sc = 0, n = 0;
    for (let seat = 0; seat < 3; seat++) {
      for (let k = 0; k < perSeat; k++) {
        const strats = [y, y, y]; strats[seat] = x;
        const f = playOut(strats, (STRATEGY_KEYS.indexOf(x) * 7919 + STRATEGY_KEYS.indexOf(y) * 104729 + seat * 1299709 + k) >>> 0);
        if (f[seat] > Math.max(...f.filter((_, i) => i !== seat))) w++; // 严格第一才算赢
        sc += f[seat]; n++;
      }
    }
    allW += w; allN += n; allS += sc;
    row.push(`${y}:${(w / n * 100).toFixed(0)}%/${(sc / n).toFixed(1)}`);
  }
  console.log(`${x.padEnd(5)} overall ${(allW / allN * 100).toFixed(1)}% avg ${(allS / allN).toFixed(1)} | ${row.join('  ')}`);
}
