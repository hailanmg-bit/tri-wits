/* 首页、快速对局设置、闯关列表、设置、结算 */
import { useEffect, useState } from 'preact/hooks';
import { STRATEGY_KEYS, Seat } from '../engine';
import { LevelConfig, LevelRun, getLevels, isUnlocked, LEVEL_ORDERS } from '../game/levels';
import { Match } from '../app/match';
import { SaveData, store } from '../app/store';
import { buzz, sfx } from '../app/sound';
import { Key, Lang, botName, setLang, t } from '../app/i18n';
import { useStore } from '../app/hooks';
import { Icon, Sheet } from './common';
import { CardView } from './Card';

function Logo() {
  return (
    <div class="logo">
      <svg viewBox="0 0 40 40" width="48" height="48" aria-hidden="true">
        <circle cx="20" cy="20" r="18.5" fill="none" stroke="#C9A45C" stroke-width="1.5" />
        <circle cx="20" cy="12.5" r="4" fill="#C9A45C" /><circle cx="12.5" cy="25" r="4" fill="#F3EEE2" /><circle cx="27.5" cy="25" r="4" fill="#C8323F" />
      </svg>
      <h1>TriWits</h1>
    </div>
  );
}

function ScreenHead({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <header class="screen-head">
      <button class="icon-btn" aria-label={t('back')} onClick={onBack}><Icon name="back" /></button>
      <h2>{title}</h2>
      <span class="icon-btn-spacer" />
    </header>
  );
}

/* ---------- 首页 ---------- */

export function Home({ go }: { go(s: 'quick' | 'levels' | 'settings'): void }) {
  const d = useStore();
  const levels = getLevels(d.levelOrder);
  return (
    <main class="home">
      <div class="home-top">
        <Logo />
        <p class="tagline">{t('tagline')}</p>
      </div>
      <div class="hero-fan" aria-hidden="true">
        <CardView card={{ r: 14, s: 0 }} width={92} style={{ transform: 'rotate(-14deg) translate(8px, 14px)' }} />
        <CardView card={{ r: 13, s: 1 }} width={92} selected style={{ transform: 'translateY(-10px)', zIndex: 1 }} />
        <CardView card={{ r: 12, s: 2 }} width={92} style={{ transform: 'rotate(14deg) translate(-8px, 14px)' }} />
      </div>
      <nav class="home-menu">
        <button class="menu-card primary" onClick={() => go('quick')}>
          <span class="mc-title">{t('quickMatch')}</span>
          <span class="mc-sub">{t('quickMatchSub')}</span>
        </button>
        <button class="menu-card" onClick={() => go('levels')}>
          <span class="mc-title">{t('levels')}</span>
          <span class="mc-sub">{t('levelsSub', { c: d.cleared[d.levelOrder].length, t: levels.length })}</span>
        </button>
        <button class="menu-card slim" onClick={() => go('settings')}>
          <Icon name="gear" size={20} /><span class="mc-title">{t('settings')}</span>
        </button>
      </nav>
    </main>
  );
}

/* ---------- 快速对局 ---------- */

export function QuickSetup({ onBack, onStart }: { onBack(): void; onStart(opps: [string, string], timed: boolean): void }) {
  const d = useStore();
  const [opps, setOpps] = useState<[string, string]>(d.quick.opps);
  const [timed, setTimed] = useState(d.quick.timed);
  const options = ['random', ...STRATEGY_KEYS];
  const start = () => {
    store.update(s => ({ ...s, quick: { opps, timed } }));
    onStart(opps, timed);
  };
  return (
    <main class="page">
      <ScreenHead title={t('quickMatch')} onBack={onBack} />
      <div class="page-body">
        <h3 class="label">{t('opponents')}</h3>
        {[0, 1].map(i => (
          <div class="field" key={i}>
            <label for={'opp' + i}>{t('opponents')} {i + 1}</label>
            <select id={'opp' + i} value={opps[i]} onChange={e => {
              const v = (e.target as HTMLSelectElement).value;
              setOpps(i === 0 ? [v, opps[1]] : [opps[0], v]);
            }}>
              {options.map(k => <option key={k} value={k}>{k === 'random' ? t('random') : botName(k)}</option>)}
            </select>
          </div>
        ))}
        <label class="toggle">
          <input type="checkbox" checked={timed} onChange={e => setTimed((e.target as HTMLInputElement).checked)} />
          <span><b>{t('timedMode')}</b><small>{t('timedModeSub')}</small></span>
        </label>
      </div>
      <footer class="page-foot"><button class="btn primary wide" onClick={start}>{t('start')}</button></footer>
    </main>
  );
}

/* ---------- 闯关 ---------- */

export function goalText(cfg: LevelConfig): string {
  const g = cfg.goal;
  if (g.cond === 'win') return t('goal_win');
  if (g.cond === 'score') return t('goal_score', { t: g.target, n: cfg.games });
  let s = t('goal_streak', { n: cfg.games });
  if (g.minBase) s += t('goal_minBase', { m: g.minBase });
  if (g.forbid === 1) s += t('goal_forbid1');
  if (g.forbid === 6) s += t('goal_forbid6');
  return s;
}

export function oppText(cfg: LevelConfig): string {
  const o = cfg.opp;
  if (o.mode === 'fixed') return o.pair[0] === o.pair[1] ? botName(o.pair[0]) + ' ×2' : botName(o.pair[0]) + ' · ' + botName(o.pair[1]);
  if (o.mode === 'shuffle') return t('opp_shuffle', { names: o.pool.map(botName).join(' / ') });
  return t('opp_anchor', { anchor: botName(o.anchor) });
}

export function LevelList({ onBack, onPlay }: { onBack(): void; onPlay(cfg: LevelConfig): void }) {
  const d = useStore();
  const levels = getLevels(d.levelOrder);
  const cleared = d.cleared[d.levelOrder];
  const [open, setOpen] = useState<LevelConfig | null>(null);
  return (
    <main class="page">
      <ScreenHead title={t('levels')} onBack={onBack} />
      <div class="page-body">
        <div class="level-grid">
          {levels.map(cfg => {
            const done = cleared.includes(cfg.id);
            const unlocked = d.devUnlockAll || isUnlocked(cleared, cfg.id);
            return (
              <button key={cfg.id} class={'level' + (done ? ' done' : '') + (unlocked ? '' : ' locked') + (cfg.hard ? ' hard' : '')}
                disabled={!unlocked} onClick={() => setOpen(cfg)} aria-label={t('lv_name', { n: cfg.id })}>
                <span class="lv-no">{cfg.id}</span>
                {done ? <Icon name="check" size={16} /> : !unlocked ? <Icon name="lock" size={16} /> : cfg.hard ? <Icon name="clock" size={16} /> : null}
              </button>
            );
          })}
        </div>
      </div>
      {open && (
        <Sheet onClose={() => setOpen(null)} title={t('lv_name', { n: open.id }) + (open.hard ? ' · ' + t('lv_timed') : '')}>
          <dl class="lv-info">
            <dt>{t('lv_goal')}</dt><dd>{goalText(open)}</dd>
            <dt>{t('lv_opp')}</dt><dd>{oppText(open)}</dd>
          </dl>
          <button class="btn primary wide" onClick={() => { const c = open; setOpen(null); onPlay(c); }}>{t('lv_enter')}</button>
        </Sheet>
      )}
    </main>
  );
}

/* ---------- 设置 ---------- */

export function Settings({ onBack, dev }: { onBack(): void; dev: boolean }) {
  const d = useStore();
  const set = (patch: Partial<SaveData>) => store.update(s => ({ ...s, ...patch }));
  return (
    <main class="page">
      <ScreenHead title={t('settings')} onBack={onBack} />
      <div class="page-body">
        <div class="field">
          <label for="lang">{t('set_language')}</label>
          <select id="lang" value={d.lang} onChange={e => {
            const l = (e.target as HTMLSelectElement).value as Lang;
            setLang(l); set({ lang: l });
          }}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
        <label class="toggle">
          <input type="checkbox" checked={d.sound} onChange={e => { set({ sound: (e.target as HTMLInputElement).checked }); sfx('button'); }} />
          <span><b>{t('set_sound')}</b></span>
        </label>
        <label class="toggle">
          <input type="checkbox" checked={d.haptics} onChange={e => { set({ haptics: (e.target as HTMLInputElement).checked }); buzz(20); }} />
          <span><b>{t('set_haptics')}</b><small>{t('set_hapticsSub')}</small></span>
        </label>
        {dev && <>
          <h3 class="label">{t('set_dev')}</h3>
          <div class="field">
            <label for="order">{t('set_order')}</label>
            <select id="order" value={d.levelOrder} onChange={e => set({ levelOrder: (e.target as HTMLSelectElement).value as SaveData['levelOrder'] })}>
              {LEVEL_ORDERS.map(o => <option key={o} value={o}>{t(('set_order_' + o) as Key)}</option>)}
            </select>
          </div>
          <label class="toggle">
            <input type="checkbox" checked={d.devUnlockAll} onChange={e => set({ devUnlockAll: (e.target as HTMLInputElement).checked })} />
            <span><b>{t('set_unlockAll')}</b></span>
          </label>
        </>}
      </div>
    </main>
  );
}

/* ---------- 结算 ---------- */

export interface LevelResult { cfg: LevelConfig; run: LevelRun }

export function Results({ match, level, onAgain, onHome, onNextGame, onRetry, onNextLevel, onLevels }: {
  match: Match;
  level: LevelResult | null;
  onAgain(): void; onHome(): void;
  onNextGame(): void; onRetry(): void; onNextLevel(): void; onLevels(): void;
}) {
  const g = match.game;
  const f = g.finalScores!;
  const order = ([0, 1, 2] as Seat[]).slice().sort((a, b) => f[b] - f[a]);
  const sameBots = g.seatStrategies[1] === g.seatStrategies[2];
  const name = (s: Seat) => (s === 0 ? t('you') : botName(g.seatStrategies[s]) + (sameBots ? ' ' + (s === 1 ? 'A' : 'B') : ''));
  const top = Math.max(...f);
  const run = level?.run;
  useEffect(() => {
    const won = run ? run.status !== 'failed' && f[0] === top : f[0] === top;
    sfx(won ? 'gameWin' : 'gameLose', 250);
    buzz(won ? [20, 60, 20] : 40);
  }, []);
  const reason = run?.failReason === 'loss' ? t('lv_r_loss')
    : run?.failReason === 'forbid' ? t('lv_r_forbid')
    : run?.failReason === 'base' ? t('lv_r_base', { n: level!.cfg.goal.cond === 'streak' ? level!.cfg.goal.minBase ?? 0 : 0 })
    : run?.failReason === 'score' ? t('lv_r_score', { s: run.totalScore }) : '';
  return (
    <div class="sheet-wrap">
      <div class="sheet results" role="dialog" aria-modal="true" aria-label={t('final')}>
        <h2 class="sheet-title">{t('final')}</h2>
        <ol class="score-list">
          {order.map((s, r) => (
            <li key={s} class={(f[s] === top ? 'first ' : '') + (s === 0 ? 'me' : '')} style={{ '--r': r }}>
              <span class="sc-name">{name(s)}</span>
              <span class="muted">{t('scoreDetail', { b: g.base[s], p: g.piles[s] })}</span>
              <b class="sc-val">{f[s]}</b>
            </li>
          ))}
        </ol>
        {level && run && (
          <div class="lv-result">
            <div>{t('lv_name', { n: level.cfg.id })} · {t('lv_game', { x: run.idx + 1, y: level.cfg.games })} · {f[0] === top ? t('lv_won') : t('lv_lost')}</div>
            <div class="muted">{level.cfg.goal.cond === 'score' ? t('lv_total', { s: run.totalScore }) : t('lv_streak', { n: run.wins })}</div>
            {run.status === 'cleared' && <div class="verdict pass">{t('lv_cleared')}</div>}
            {run.status === 'failed' && <><div class="verdict fail">{t('lv_failed')}</div><div class="muted">{reason}</div></>}
          </div>
        )}
        <div class="btn-row">
          {!level && <>
            <button class="btn ghost" onClick={onHome}>{t('home')}</button>
            <button class="btn primary grow" onClick={onAgain}>{t('playAgain')}</button>
          </>}
          {level && run?.status === 'playing' && <>
            <button class="btn ghost" onClick={onLevels}>{t('lv_list')}</button>
            <button class="btn primary grow" onClick={onNextGame}>{t('lv_nextGame')}</button>
          </>}
          {level && run?.status === 'failed' && <>
            <button class="btn ghost" onClick={onLevels}>{t('lv_list')}</button>
            <button class="btn primary grow" onClick={onRetry}>{t('lv_retry')}</button>
          </>}
          {level && run?.status === 'cleared' && <>
            <button class="btn ghost" onClick={onLevels}>{t('lv_list')}</button>
            {level.cfg.id < 30
              ? <button class="btn primary grow" onClick={onNextLevel}>{t('lv_nextLevel')}</button>
              : <button class="btn primary grow" onClick={onHome}>{t('home')}</button>}
          </>}
        </div>
      </div>
    </div>
  );
}
