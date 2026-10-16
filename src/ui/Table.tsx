/* 牌桌：竖屏与横屏是两套网格布局，共用同一批组件 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Basis, Card, GameEvent, HandEval, HandType, RANK_STR, RankedEntry, SUIT_CHARS, Seat, cardKey, compareCards, evalHand3, explainEntry } from '../engine';
import { Match } from '../app/match';
import { useCountdown, useLandscape, useSize, useSubscribe } from '../app/hooks';
import { botName, t, typeName } from '../app/i18n';
import { CardView, cardLabel } from './Card';
import { Avatar, Icon, Sheet } from './common';
import { RulesSheet } from './Rules';
import { buzz, sfx } from '../app/sound';
import { CoachAct, CoachStep, Tutorial } from '../app/tutorial';
import { Bubble, Chatter } from '../app/chatter';
import { quickChats } from '../app/lines';
import { store } from '../app/store';

interface Props {
  match: Match;
  /** 闯关模式时显示在顶栏下方的进度条 */
  banner?: string;
  onQuit(): void;
  onResults(): void;
  /** 新手教程：提示与操作限制 */
  coach?: Tutorial;
}

export function TableScreen({ match, banner, onQuit, onResults, coach }: Props) {
  useSubscribe(match);
  useSubscribe(coach);
  const step = coach?.step ?? null;
  // 教程剧本阶段不聊天，以免打断提示
  const chatter = useMemo(() => new Chatter(match, () => !!coach?.scripted), [match]);
  useEffect(() => () => chatter.dispose(), [chatter]);
  useSubscribe(chatter);
  const g = match.game;
  const land = useLandscape();
  const stage = g.round + ':' + g.phase;
  // 选牌和阶段绑定：进入新阶段（手牌已变化）时旧的下标自动失效
  const [picked, setPicked] = useState<{ stage: string; sel: number[] }>({ stage, sel: [] });
  const sel = picked.stage === stage ? picked.sel : [];
  const setSel: SetSel = v => setPicked(prev => {
    const cur = prev.stage === stage ? prev.sel : [];
    return { stage, sel: typeof v === 'function' ? v(cur) : v };
  });
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  useEffect(() => {
    const onBack = () => { if (rules) setRules(false); else setMenu(m => !m); };
    window.addEventListener('tw-back', onBack);
    return () => window.removeEventListener('tw-back', onBack);
  }, [rules]);

  const left = useCountdown(match.deadline);
  useGameSounds(match);
  useEffect(() => {
    if (left === null || left > 5 || left <= 0) return;
    sfx(left <= 2 ? 'tickLast' : 'tick');
    if (left <= 2) buzz(15);
  }, [left]);
  const sameBots = g.seatStrategies[1] === g.seatStrategies[2];
  const name = (s: Seat) => (s === 0 ? t('you') : botName(g.seatStrategies[s]) + (sameBots ? ' ' + (s === 1 ? 'A' : 'B') : ''));

  const phaseLabel = g.phase === 'p1_select' ? t('phase1')
    : g.phase === 'p2_choose' || g.phase === 'p2_select' ? t('phase2') : t('phaseResult');
  const sub = g.phase === 'p1_select' ? t('sub_p1')
    : g.phase === 'p2_choose' ? t('sub_p2choose', { type: typeName(g.requiredType) })
    : g.phase === 'p2_select' ? t('sub_p2select', { type: typeName(g.requiredType) })
    : g.phase === 'round_end' ? t('sub_roundEnd', { n: g.round + 1 }) : t('sub_gameOver');

  return (
    <div class={'table ' + (land ? 'land' : 'port')}>
      <header class="topbar">
        <button class="icon-btn" aria-label={t('menu')} onClick={() => setMenu(true)}><Icon name="menu" /></button>
        <div class="topbar-title">
          <div class="tb-main">{t('roundLine', { n: g.round + 1, phase: phaseLabel })}</div>
          <div class="tb-sub">{sub}</div>
        </div>
        {left !== null
          ? <div class={'timer' + (left <= 5 ? ' low' : '')} role="timer">{t('timer', { n: left })}</div>
          : <button class="icon-btn" aria-label={t('rules')} onClick={() => setRules(true)}><Icon name="help" /></button>}
      </header>
      {banner && <div class="level-banner">{banner}</div>}

      <Opponent match={match} seat={1} name={name(1)} area="opp1" bubble={chatter.bubbleOf(1)} />
      <Opponent match={match} seat={2} name={name(2)} area="opp2" bubble={chatter.bubbleOf(2)} />
      <Center match={match} name={name} land={land} />
      <MeRow match={match} sel={sel} chatter={chatter} canChat={!coach?.scripted} />
      <Hand match={match} sel={sel} setSel={setSel} land={land} coach={coach} step={step} />
      <Actions match={match} sel={sel} setSel={setSel} onResults={onResults} coach={coach} step={step} />
      {step && <CoachBubble step={step} params={{ a: name(1), b: name(2) }} />}

      {menu && (
        <Sheet onClose={() => setMenu(false)}>
          <button class="btn ghost wide" onClick={() => { setMenu(false); setRules(true); }}>{t('rules')}</button>
          <button class="btn ghost wide" onClick={onQuit}>{t('home')}</button>
          <button class="btn primary wide" onClick={() => setMenu(false)}>{t('close')}</button>
        </Sheet>
      )}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
    </div>
  );
}

/* ---------- 状态 ---------- */

type Status = 'played' | 'thinking' | 'joined' | 'skipped' | 'out' | 'yourTurn' | 'waiting' | '';

function statusOf(match: Match, seat: Seat): Status {
  const g = match.game;
  const inPending = g.pending.includes(seat);
  if (g.phase === 'p1_select') {
    if (!inPending) return 'out';
    if (g.p1Locked[seat]) return 'played';
    return seat === 0 ? 'yourTurn' : 'thinking';
  }
  if (g.phase === 'p2_choose') {
    if (!inPending) return 'out';
    // 真人做决定前不透露电脑是否参与
    if (seat !== 0 && match.needs(0)) return 'thinking';
    if (g.p2Decided[seat]) return g.p2Joins[seat] ? 'joined' : 'skipped';
    return seat === 0 ? 'yourTurn' : 'thinking';
  }
  if (g.phase === 'p2_select') {
    if (!inPending) return g.hands[seat].length ? 'skipped' : 'out';
    if (g.p2Locked[seat]) return 'played';
    return seat === 0 ? 'yourTurn' : 'thinking';
  }
  return g.hands[seat].length ? '' : 'out';
}

const STATUS_KEY = {
  played: 'st_played', thinking: 'st_thinking', joined: 'st_joined', skipped: 'st_skipped',
  out: 'st_out', yourTurn: 'st_yourTurn', waiting: 'st_waiting'
} as const;

function StatusPill({ s }: { s: Status }) {
  if (!s) return null;
  return <span class={'pill status-' + s}>{t(STATUS_KEY[s])}</span>;
}

/** 当前选牌阶段已锁定、但还没结算的出牌 */
function lockedPlay(match: Match, seat: Seat): Card[] | null {
  const g = match.game;
  if (g.phase === 'p1_select' && g.p1Locked[seat]) return g.playedP1[seat];
  if (g.phase === 'p2_select' && g.p2Locked[seat]) return g.playedP2[seat];
  return null;
}

/* ---------- 对手 ---------- */

function Opponent({ match, seat, name, area, bubble }: { match: Match; seat: Seat; name: string; area: string; bubble?: Bubble }) {
  const g = match.game;
  const locked = lockedPlay(match, seat);
  const waiting = !locked && (g.phase === 'p1_select' || g.phase === 'p2_select') && match.needs(seat);
  return (
    <section class={'opp ' + area} aria-label={name}>
      <div class="opp-head">
        <Avatar strategy={g.seatStrategies[seat]} size={44} />
        <div class="opp-meta">
          <div class="opp-name">{name}</div>
          <div class="muted">{t('cards', { n: g.hands[seat].length - (locked ? 3 : 0) })} · {t('pile', { n: g.piles[seat] })}</div>
          <Gain value={g.piles[seat]} />
        </div>
      </div>
      <div class="opp-play">
        <div class="mini-stack">
          {locked && [0, 1, 2].map(i => <CardView key={i} width={34} faceDown class="drop-in" style={{ left: i * 16 + 'px', '--i': i }} />)}
          {waiting && <div class="slot-dashed" />}
        </div>
        <StatusPill s={statusOf(match, seat)} />
      </div>
      {bubble && <div class="bubble opp-bubble" key={bubble.id} role="status">{bubble.text}</div>}
    </section>
  );
}

/* ---------- 中央：牌池 / 亮牌结果 / 事件 ---------- */

function eventText(e: GameEvent, name: (s: Seat) => string): string | null {
  switch (e.t) {
    case 'p1Won': case 'p2Won': return t(e.seat === 0 ? 'ev_wonYou' : 'ev_won', { name: name(e.seat), n: e.n, type: typeName(e.type) });
    case 'p2AllInvalid': return t('ev_allInvalid');
    case 'p2NotEnough': return t('ev_notOpened');
    case 'emptied': return t(e.seat === 0 ? 'ev_outYou' : 'ev_out', { name: name(e.seat) });
    default: return null;
  }
}

function Center({ match, name, land }: { match: Match; name: (s: Seat) => string; land: boolean }) {
  const g = match.game;
  const selecting = g.phase === 'p1_select' || g.phase === 'p2_select';
  const resolved = { p1: g.p1Ranked, p2: g.p2Ranked };
  const [tab, setTab] = useState<'p1' | 'p2'>('p1');
  useEffect(() => setTab(g.p2Ranked ? 'p2' : 'p1'), [g.round, !!g.p2Ranked]);

  // 本回合最近一条值得提示的事件
  const msg = useMemo(() => {
    for (let i = g.log.length - 1; i >= 0; i--) {
      const e = g.log[i];
      if (e.round !== g.round) break;
      const s = eventText(e, name);
      if (s) return s;
    }
    return null;
  }, [match.version]);

  const timeoutMsg = match.timeout === 'play' ? t('ev_timeoutPlay') : match.timeout === 'skip' ? t('ev_timeoutSkip') : null;

  return (
    <section class="center">
      <div class="felt-ring" aria-hidden="true" />
      {selecting ? (
        <div class={'pool' + (g.phase === 'p2_select' ? ' has-req' : '')}>
          {g.phase === 'p2_select' && <RequiredPlaque match={match} compact={land} />}
          <div class="pool-stack">
            {Array.from({ length: Math.min(3, lockedCount(match)) }, (_, i) => (
              <CardView key={i} width={42} faceDown class="pool-in" style={{ left: 6 + i * 12 + 'px', '--rot': (i - 1) * 8 + 'deg' }} />
            ))}
          </div>
          <div class="chip dark">{t('pool', { a: lockedCount(match) * 3, b: g.pending.length * 3 })}</div>
        </div>
      ) : (
        <div class="showdown">
          {g.phase === 'p2_choose' && <RequiredPlaque match={match} compact />}
          {resolved.p1 && resolved.p2 && (
            <div class="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'p1'} class={tab === 'p1' ? 'on' : ''} onClick={() => setTab('p1')}>{t('phase1')}</button>
              <button role="tab" aria-selected={tab === 'p2'} class={tab === 'p2' ? 'on' : ''} onClick={() => setTab('p2')}>{t('phase2')}</button>
            </div>
          )}
          {resolved[tab] && <Showdown key={g.round + tab} ranked={resolved[tab]!} phase={tab} match={match} name={name} cardW={land ? 24 : 30} />}
        </div>
      )}
      {/* 横屏中区较矮：第二阶段让位给牌型提示牌，赢家已在亮牌列表中标出 */}
      {(timeoutMsg || (msg && !(land && g.requiredType))) && <div class="center-msg" aria-live="polite">{timeoutMsg || msg}</div>}
    </section>
  );
}

/* 第二阶段的牌型要求：本回合最关键的信息，单独做成牌桌中央的提示牌 */
const EXAMPLES: Record<HandType, Card[]> = {
  1: [{ r: 13, s: 0 }, { r: 8, s: 1 }, { r: 3, s: 2 }],
  2: [{ r: 9, s: 0 }, { r: 9, s: 1 }, { r: 4, s: 2 }],
  3: [{ r: 5, s: 2 }, { r: 6, s: 3 }, { r: 7, s: 0 }],
  4: [{ r: 3, s: 1 }, { r: 8, s: 1 }, { r: 12, s: 1 }],
  5: [{ r: 8, s: 0 }, { r: 9, s: 0 }, { r: 10, s: 0 }],
  6: [{ r: 12, s: 0 }, { r: 12, s: 1 }, { r: 12, s: 3 }]
};

function RequiredPlaque({ match, compact }: { match: Match; compact?: boolean }) {
  const g = match.game;
  const tp = g.requiredType;
  if (!tp) return null;
  const by235 = !!g.p1Ranked?.[0]?.ev.special235;
  return (
    <div class={'req-plaque' + (compact ? ' compact' : '')} role="status" aria-label={t('req_label') + ' ' + typeName(tp)}>
      <div class="req-text">
        <div class="req-label">{t('req_label')}</div>
        <div class="req-type">{typeName(tp)}</div>
        <div class="req-why">{by235 ? t('req_why235') : t('req_whyWeakest')}</div>
      </div>
      <div class="req-eg" aria-hidden="true">
        {EXAMPLES[tp].map((c, i) => <CardView key={i} card={c} width={compact ? 26 : 34} />)}
      </div>
    </div>
  );
}

function lockedCount(match: Match): number {
  const g = match.game;
  const locks = g.phase === 'p1_select' ? g.p1Locked : g.p2Locked;
  return g.pending.filter(s => locks[s]).length;
}

function Showdown({ ranked, phase, match, name, cardW }: { ranked: RankedEntry[]; phase: 'p1' | 'p2'; match: Match; name: (s: Seat) => string; cardW: number }) {
  const g = match.game;
  const winner = phase === 'p1' ? g.p1Winner : g.p2Winner;
  const open = g.log.find(e => e.t === 'p2Open' && e.round === g.round);
  const required = open && open.t === 'p2Open' ? open.type : g.requiredType;
  return (
    <ol class="sd-list">
      {ranked.map((e, row) => {
        const cards = ((phase === 'p1' ? g.playedP1 : g.playedP2)[e.seat] || []).slice().sort(compareCards);
        return (
          <li key={e.seat} class={'sd-row' + (e.seat === winner ? ' win' : '') + (e.ev.invalid ? ' invalid' : '')} style={{ '--r': row }}>
            <span class="sd-name">{name(e.seat)}</span>
            <span class="sd-cards" aria-label={cards.map(cardLabel).join(', ')}>
              {cards.map((c, i) => <CardView key={i} card={c} width={cardW} class="flip-in" style={{ '--i': row * 3 + i }} />)}
            </span>
            <span class="sd-info">
              <span class="sd-type">{typeName(e.ev.type)}{e.ev.special235 ? ' · 235' : ''}</span>
              {(() => { const why = basisText(explainEntry(ranked, row, required)); return <span class={'sd-why' + (e.seat === 0 ? ' mine' : '')} title={why}>{withSuits(why)}</span>; })()}
            </span>
            {e.seat === winner && <span class="pill win">{t('tag_win')}</span>}
            {e.ev.invalid && <span class="pill bad">{t('tag_invalid')}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* 比牌说明：亮牌时顺带教规则 */
const rankText = (r: number) => (r === 1 ? 'A' : RANK_STR[r] || String(r));

function handText(ev: HandEval): string {
  const p = ev.points;
  let s = typeName(ev.type) + ' ';
  if (ev.type === 2) s += t('ex_pairKick', { p: rankText(p[0]), k: rankText(p[1]) });
  else if (ev.type === 1 || ev.type === 4) s += p.map(rankText).join(' ');
  else s += rankText(p[0]);
  return s + (ev.hasBig ? t('ex_withBig') : ev.hasSmall ? t('ex_withSmall') : '');
}

function basisText(b: Basis): string {
  switch (b.k) {
    case 'max': return t('ex_max', { hand: handText(b.ev) });
    case '235Trips': return t('ex_235Trips');
    case '235Suit': return t('ex_235Suit');
    case '235Min': return t('ex_235Min');
    case 'type': return t('ex_type', { mine: typeName(b.mine), above: typeName(b.above) });
    case 'point': return t(b.at > 0 ? 'ex_pointLead' : 'ex_point', { mine: rankText(b.mine), above: rankText(b.above) });
    case 'joker': return t(b.which === 'big' ? 'ex_jokerBig' : 'ex_jokerSmall');
    case 'suit': return t('ex_suit', { mine: SUIT_CHARS[b.mine], above: SUIT_CHARS[b.above] });
    case 'invalid': return t('ex_invalid', { req: typeName(b.required) });
  }
}

/** 红桃、方块符号染红 */
function withSuits(text: string) {
  return text.split(/([♥♦])/).map((part, i) => (part === '♥' || part === '♦' ? <span key={i} class="red-suit">{part}</span> : part));
}

/* ---------- 自己 ---------- */

function MeRow({ match, sel, chatter, canChat }: { match: Match; sel: number[]; chatter: Chatter; canChat: boolean }) {
  const g = match.game;
  const [picker, setPicker] = useState(false);
  const bubble = chatter.bubbleOf(0);
  const profile = store.get().profile;
  const locked = lockedPlay(match, 0);
  let chip: { text: string; bad: boolean; ok: boolean; target?: boolean } | null = null;
  if (sel.length === 3) {
    const ev = evalHand3(sel.map(i => g.hands[0][i]));
    const p2 = g.phase === 'p2_select';
    chip = { text: typeName(ev.type) + (ev.special235 ? ' · 235' : ''), bad: p2 && ev.type !== g.requiredType, ok: p2 && ev.type === g.requiredType };
  } else if (g.phase === 'p2_select' && match.needs(0)) {
    chip = { text: t('req_need', { type: typeName(g.requiredType) }), bad: false, ok: false, target: true };
  }
  return (
    <section class="me" style={{ position: 'relative' }}>
      <div class="me-left">
        <Avatar avatar={profile?.avatar} size={36} me />
        <span class="me-name">{t('you')}</span>
        <span class="muted">{t('cards', { n: g.hands[0].length - (locked ? 3 : 0) })} · {t('pile', { n: g.piles[0] })}</span>
        {g.base[0] > 0 && <span class="pill win pop">+5</span>}
        <Gain value={g.piles[0]} />
        {canChat && store.get().chat && (
          <button class="icon-btn chat-btn" aria-label={t('chat')} aria-expanded={picker} onClick={() => setPicker(v => !v)}><Icon name="chat" size={20} /></button>
        )}
      </div>
      {picker && (
        <div class="chat-picker" role="menu">
          {quickChats().map(c => (
            <button key={c} role="menuitem" class="chip dark" onClick={() => { chatter.playerSays(c); setPicker(false); }}>{c}</button>
          ))}
        </div>
      )}
      {bubble && <div class="bubble me-bubble" key={bubble.id} role="status">{bubble.text}</div>}
      {chip && <span class={'chip ' + (chip.bad ? 'bad' : chip.ok ? 'ok' : chip.target ? 'outline' : 'light')}>{chip.ok ? '✓ ' : ''}{chip.text}</span>}
    </section>
  );
}

type SetSel = (v: number[] | ((prev: number[]) => number[])) => void;

/** 竖屏手牌超过 12 张时分两排，避免点数被压住 */
function Hand({ match, sel, setSel, land, coach, step: cstep }: { match: Match; sel: number[]; setSel: SetSel; land: boolean; coach?: Tutorial; step: CoachStep | null }) {
  const g = match.game;
  const [ref, size] = useSize<HTMLDivElement>();
  const locked = lockedPlay(match, 0);
  // 教程剧本阶段：只能选提示的牌
  const canPick = (g.phase === 'p1_select' || g.phase === 'p2_select') && match.needs(0) &&
    !(coach?.scripted && (!cstep || cstep.mode === 'tap'));
  const allowed = (c: Card) => !coach?.scripted || !cstep?.pick || cstep.pick.includes(cardKey(c));
  const list = g.hands[0].map((c, i) => ({ c, i })).filter(x => !locked || !locked.includes(x.c)).sort((a, b) => compareCards(a.c, b.c));

  const W = size.w || 360;
  const n = list.length;
  const rows = !land && n > 12 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const cardW = Math.round(land ? Math.max(46, Math.min(76, window.innerHeight * 0.18)) : Math.max(56, Math.min(80, W * 0.18)));
  const cardH = Math.round(cardW * 1.4375);
  const step = perRow > 1 ? Math.min(cardW * 0.62, (W - cardW) / (perRow - 1)) : 0;
  const lift = Math.round(cardW * 0.22);
  const rowGap = Math.round(cardH * 0.5);

  const toggle = (i: number) => {
    if (!canPick) return;
    const was = sel.includes(i);
    if (!was && sel.length >= 3) return;
    sfx(was ? 'deselect' : 'select');
    buzz(8);
    setSel(prev => (prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 3 ? [...prev, i] : prev));
  };

  return (
    <section class="hand" ref={ref} style={{ height: cardH + lift + (rows - 1) * rowGap + 'px' }}>
      {list.map(({ c, i }, k) => {
        const on = sel.includes(i);
        const r = Math.floor(k / perRow), col = k % perRow;
        const inRow = Math.min(perRow, n - r * perRow);
        const off = Math.max(0, (W - (cardW + step * (inRow - 1))) / 2);
        return (
          <button
            key={cardKey(c)}
            class="hand-card"
            aria-pressed={on}
            aria-label={cardLabel(c)}
            disabled={!canPick || !allowed(c)}
            onClick={() => toggle(i)}
            style={{ left: off + col * step + 'px', top: r * rowGap + (on ? 0 : lift) + 'px', zIndex: k, '--d': k }}
          >
            <CardView card={c} width={cardW} selected={on} class={canPick && cstep?.pick?.includes(cardKey(c)) && !on ? 'coach-glow' : ''} dim={canPick && !allowed(c)} />
          </button>
        );
      })}
    </section>
  );
}

function Actions({ match, sel, setSel, onResults, coach, step }: { match: Match; sel: number[]; setSel: SetSel; onResults(): void; coach?: Tutorial; step: CoachStep | null }) {
  const g = match.game;
  // 教程：tap 提示只显示「知道了」；act 提示只开放指定的按钮
  const lock = (a: CoachAct) => !!coach?.scripted && (!step || step.act !== a);
  const mark = (a: CoachAct) => (step?.act === a ? ' coach-target' : '');
  const did = (a: CoachAct) => coach?.acted(a);
  const pickOk = !step?.pick || (sel.length === 3 && sel.every(i => step.pick!.includes(cardKey(g.hands[0][i]))));
  let body;
  if (step?.mode === 'tap') {
    body = <button class="btn primary grow coach-target" data-act="coach" onClick={() => { sfx('button'); coach!.next(); }}>{t('tut_continue')}</button>;
  } else if (g.phase === 'game_over') {
    body = <button class="btn primary grow" data-act="results" onClick={onResults}>{t('btn_results')}</button>;
  } else if (g.phase === 'round_end') {
    const ending = g.holders().length <= 1;
    body = ending
      ? <button class="btn primary grow" data-act="results" onClick={() => { match.nextRound(); onResults(); }}>{t('btn_results')}</button>
      : <button class={'btn primary grow' + mark('next')} data-act="next" disabled={lock('next')} onClick={() => { sfx('button'); did('next'); match.nextRound(); }}>{t('btn_next')}</button>;
  } else if (g.phase === 'p2_choose' && match.needs(0)) {
    body = <>
      <button class={'btn ghost' + mark('skip')} data-act="skip" disabled={lock('skip')} onClick={() => { sfx('button'); did('skip'); match.chooseJoin(false); }}>{t('btn_skip')}</button>
      <button class={'btn primary grow' + mark('join')} data-act="join" disabled={lock('join')} onClick={() => { sfx('button'); did('join'); match.chooseJoin(true); }}>{t('btn_join')}</button>
    </>;
  } else if ((g.phase === 'p1_select' || g.phase === 'p2_select') && match.needs(0)) {
    const invalid = sel.length === 3 && g.phase === 'p2_select' &&
      evalHand3(sel.map(i => g.hands[0][i])).type !== g.requiredType;
    body = <>
      <button class="btn ghost" onClick={() => { sfx('deselect'); setSel([]); }} disabled={!sel.length}>{t('btn_reset')}</button>
      <button class={'btn primary grow' + (sel.length === 3 && pickOk ? mark('play') : '')} data-act="play" disabled={sel.length !== 3 || lock('play') || !pickOk} onClick={() => { did('play'); match.playCards(sel); }}>
        {sel.length === 3 ? t('btn_play') : t('hint_selected', { n: sel.length })}
      </button>
      {invalid && <div class="action-warn" role="status">{t('hint_invalid', { req: typeName(g.requiredType) })}</div>}
    </>;
  } else {
    body = <div class="action-wait">{g.hands[0].length ? t('prompt_wait') : t('prompt_out')}</div>;
  }
  return <section class="actions">{body}</section>;
}

/* ---------- 动效与音效 ---------- */

/** 牌堆增加时浮出 +N */
function Gain({ value }: { value: number }) {
  const prev = useRef(value);
  const [pop, setPop] = useState<{ n: number; k: number } | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d <= 0) return;
    setPop(p => ({ n: d, k: (p?.k ?? 0) + 1 }));
    const id = setTimeout(() => setPop(null), 1600);
    return () => clearTimeout(id);
  }, [value]);
  return pop ? <span key={pop.k} class="gain" aria-hidden="true">+{pop.n}</span> : null;
}

/** 根据引擎事件播放音效：亮牌 → 胜负 → 第二阶段开启，按时间错开 */
function useGameSounds(match: Match) {
  const seen = useRef(-1);
  useEffect(() => {
    const log = match.game.log;
    if (seen.current < 0) { seen.current = log.length; sfx('deal'); return; }
    const fresh = log.slice(seen.current);
    seen.current = log.length;
    let at = 0;
    for (const e of fresh) {
      switch (e.t) {
        case 'p1Played': case 'p2Played': if (e.seat !== 0) sfx('botPlay'); else sfx('play'); break;
        case 'p1Won': case 'p2Won':
          sfx('flip', at); at += 380;
          sfx(e.seat === 0 ? 'winMe' : 'winOther', at);
          if (e.seat === 0) setTimeout(() => buzz(30), at);
          at += 420; break;
        case 'p2AllInvalid': sfx('flip', at); sfx('invalid', at + 380); at += 800; break;
        case 'p2Open': sfx('phase2', at + 200); break;
        case 'emptied': if (e.seat === 0) sfx('out', at + 200); break;
      }
    }
  }, [match.version]);
}

/* ---------- 新手教程提示 ---------- */

const TYPE_ORDER: HandType[] = [6, 5, 4, 3, 2, 1];

function CoachBubble({ step, params }: { step: CoachStep; params: Record<string, string> }) {
  return (
    <div class={'coach at-' + step.at} role="status" aria-live="polite" key={step.text}>
      <p class="coach-text">{withSuits(t(step.text, params))}</p>
      {step.types && (
        <ol class="coach-types">
          {TYPE_ORDER.map((tp, i) => <li key={tp}>{i > 0 && <span class="gt">&gt;</span>}{typeName(tp)}</li>)}
        </ol>
      )}
    </div>
  );
}
