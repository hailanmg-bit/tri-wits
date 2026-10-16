/* 本地存档：设置、闯关进度、战绩。以后接 Capacitor Preferences / 云存档时只需替换 load/save。 */
import { DEFAULT_LEVEL_ORDER, LevelOrder } from '../game/levels';
import { Lang, detectLang } from './i18n';

export interface Stats { games: number; wins: number; totalScore: number; baseGames: number }
const emptyStats = (): Stats => ({ games: 0, wins: 0, totalScore: 0, baseGames: 0 });

export interface SaveData {
  v: 2;
  lang: Lang;
  levelOrder: LevelOrder;
  devUnlockAll: boolean;
  sound: boolean;
  tutorialDone: boolean;
  haptics: boolean;
  quick: { opps: [string, string]; timed: boolean };
  /** 两套对手顺序的关卡不同，进度分开记 */
  cleared: Record<LevelOrder, number[]>;
  stats: { quick: Stats; level: Stats };
}

const KEY = 'triwits.save';

function defaults(): SaveData {
  return {
    v: 2,
    lang: detectLang(),
    levelOrder: DEFAULT_LEVEL_ORDER,
    devUnlockAll: false,
    sound: true,
    tutorialDone: false,
    haptics: true,
    quick: { opps: ['random', 'random'], timed: false },
    cleared: { original: [], simulated: [] },
    stats: { quick: emptyStats(), level: emptyStats() }
  };
}

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw);
    if (!p || p.v !== 2) return d;
    return {
      ...d, ...p,
      quick: { ...d.quick, ...p.quick },
      cleared: { ...d.cleared, ...p.cleared },
      stats: { quick: { ...d.stats.quick, ...p.stats?.quick }, level: { ...d.stats.level, ...p.stats?.level } }
    };
  } catch {
    return d;
  }
}

let data = load();
const listeners = new Set<() => void>();

export const store = {
  get: () => data,
  update(fn: (d: SaveData) => SaveData) {
    data = fn(data);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 存储不可用时仅保留内存状态 */ }
    listeners.forEach(l => l());
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
};

export function addStats(s: Stats, score: number, won: boolean, gotBase: boolean): Stats {
  return { games: s.games + 1, wins: s.wins + (won ? 1 : 0), totalScore: s.totalScore + score, baseGames: s.baseGames + (gotBase ? 1 : 0) };
}
