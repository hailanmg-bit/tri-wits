import { useEffect, useState } from 'preact/hooks';
import { LevelConfig, LevelRun, levelById, nextGame, playerWon, recordGame, startRun } from '../game/levels';
import { Match } from './match';
import { addStats, store } from './store';
import { t } from './i18n';
import { useStore } from './hooks';
import { TableScreen } from '../ui/Table';
import { sfx } from './sound';
import { exitApp } from './native';
import { TUTORIAL_BOTS, Tutorial, tutorialHands, tutorialScript } from './tutorial';
import { Home, LevelList, QuickSetup, Results, Settings, goalText } from '../ui/screens';

type View = 'home' | 'quick' | 'levels' | 'settings' | 'game' | 'tutorial';

interface Session {
  id: number;
  match: Match;
  quick?: { opps: [string, string]; timed: boolean };
  level?: { cfg: LevelConfig; run: LevelRun };
  tutorial?: Tutorial;
  results: boolean;
}

/** 开发者选项：网址带 ?dev=1 时显示（对手顺序切换、解锁全部关卡） */
const DEV = /[?&]dev=1/.test(location.search);
if (DEV) (window as unknown as { __sfx?: typeof sfx }).__sfx = sfx;
let nextId = 1;

export function App() {
  const d = useStore();
  const [view, setView] = useState<View>('home');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => () => session?.match.dispose(), [session?.match]);

  const begin = (s: Omit<Session, 'id' | 'match' | 'results'>) => {
    session?.match.dispose();
    const bots = s.level ? s.level.run.games[s.level.run.idx] : s.quick!.opps;
    const timed = s.level ? s.level.cfg.hard : s.quick!.timed;
    setSession({ ...s, id: nextId++, match: new Match({ bots, timed }), results: false });
    setView('game');
  };

  const startTutorial = () => {
    session?.match.dispose();
    const match = new Match({ bots: TUTORIAL_BOTS, timed: false, hands: tutorialHands(), script: tutorialScript });
    setSession({ id: nextId++, match, tutorial: new Tutorial(match), results: false });
    setView('game');
  };

  const playLevel = (cfg: LevelConfig) => begin({ level: { cfg, run: startRun(cfg, Math.random) } });

  /** 对局结束：记录战绩与闯关进度（每局只记一次），然后显示结算 */
  const showResults = () => {
    if (!session || session.results) return;
    const g = session.match.game;
    if (!g.gameOver) return;
    const won = playerWon(g), score = g.finalScores![0], base = g.base[0] > 0;
    let level = session.level;
    if (session.tutorial) {
      // 教程不计入战绩
      store.update(s => ({ ...s, tutorialDone: true }));
    } else if (level) {
      const run = recordGame(level.cfg, level.run, g);
      level = { ...level, run };
      const id = level.cfg.id;
      store.update(s => ({
        ...s,
        stats: { ...s.stats, level: addStats(s.stats.level, score, won, base) },
        cleared: run.status === 'cleared' && !s.cleared[s.levelOrder].includes(id)
          ? { ...s.cleared, [s.levelOrder]: [...s.cleared[s.levelOrder], id] }
          : s.cleared
      }));
    } else {
      store.update(s => ({ ...s, stats: { ...s.stats, quick: addStats(s.stats.quick, score, won, base) } }));
    }
    setSession({ ...session, level, results: true });
  };

  if (DEV) (window as unknown as { __tw?: Session | null }).__tw = session;

  // 安卓返回键：牌桌由 TableScreen 自己处理（开关菜单），结算时回首页，其他页面回首页，首页退出
  useEffect(() => {
    const onBack = () => {
      if (view === 'game' && session && !session.results) return;
      if (view === 'game') { session?.match.dispose(); setSession(null); setView('home'); }
      else if (view !== 'home') setView('home');
      else exitApp();
    };
    window.addEventListener('tw-back', onBack);
    return () => window.removeEventListener('tw-back', onBack);
  }, [view, session]);

  const quit = () => { session?.match.dispose(); setSession(null); setView('home'); };

  if (view === 'game' && session) {
    const lv = session.level;
    const banner = lv ? `${t('lv_name', { n: lv.cfg.id })} · ${t('lv_game', { x: lv.run.idx + 1, y: lv.cfg.games })} · ${goalText(lv.cfg)}` : undefined;
    return (
      <>
        <TableScreen key={session.id} match={session.match} banner={banner} onQuit={quit} onResults={showResults} coach={session.tutorial} />
        {session.results && (
          <Results
            match={session.match}
            level={lv ?? null}
            tutorial={!!session.tutorial}
            onQuick={() => { session.match.dispose(); setSession(null); setView('quick'); }}
            onAgain={() => begin({ quick: session.quick })}
            onHome={quit}
            onLevels={() => { session.match.dispose(); setSession(null); setView('levels'); }}
            onNextGame={() => lv && begin({ level: { cfg: lv.cfg, run: nextGame(lv.run) } })}
            onRetry={() => lv && playLevel(lv.cfg)}
            onNextLevel={() => { const next = lv && levelById(lv.cfg.id + 1, d.levelOrder); if (next) playLevel(next); }}
          />
        )}
      </>
    );
  }

  if (view === 'quick') return <QuickSetup onBack={() => setView('home')} onStart={(opps, timed) => begin({ quick: { opps, timed } })} />;
  if (view === 'levels') return <LevelList onBack={() => setView('home')} onPlay={playLevel} />;
  if (view === 'settings') return <Settings onBack={() => setView('home')} dev={DEV} />;
  return <Home go={v => (v === 'tutorial' ? startTutorial() : setView(v))} />;
}
