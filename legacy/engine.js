'use strict';

/* ================= 基础常量与工具 ================= */

const RANK_STR = ['', '', '2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUIT_CHARS = ['♠','♥','♣','♦'];
const TYPE_NAMES = {1:'单张', 2:'对子', 3:'顺子', 4:'同花', 5:'同花顺', 6:'三条'};
const TYPE_NUMS = {'单张':1,'对子':2,'顺子':3,'同花':4,'同花顺':5,'三条':6};

/* ================= 国际化（仅文案，规则逻辑不受影响） ================= */
const I18N = {
  zh: {
    typeNames: {1:'单张', 2:'对子', 3:'顺子', 4:'同花', 5:'同花顺', 6:'三条'},
    bigJoker: '大王', smallJoker: '小王',
    roundPrefix: '第{round}回合：',
    p1Played: '第一阶段：玩家{seat} 已出牌（牌面朝下）',
    p1Won: '第一阶段：玩家{seat} 以「{type}」赢 {n} 张',
    p2NotEnough: '第二阶段：参与人数不足2人，不开启',
    p2Join: '第二阶段：玩家{seat} 参与',
    p2Skip: '第二阶段：玩家{seat} 跳过',
    p2Open: '第二阶段开启：需出牌型「{type}」',
    p2Played: '第二阶段：玩家{seat} 已出牌',
    p2AllInvalid: '第二阶段：所有参与者均无效，各自拿回3张',
    p2Won: '第二阶段：玩家{seat} 以「{type}」赢 {n} 张',
    emptied: '玩家{seat} 手牌打空（第{round}回合 第{phase}阶段）',
    gameOverRemain: '游戏结束：玩家{seat} 剩余{n}张，三家平分（各{k}张）',
    gameOverNone: '游戏结束：无玩家持有手牌',
    baseScored: '基础分：{names} 各得5分',
    baseNone: '基础分：无人得基础分',
    finalScores: '最终得分：{list}',
    scoreItem: '玩家{seat} {score}（基础{base}+牌堆{pile}）',
    wonText: '玩家{seat} 以「{type}」赢 {n} 张',
    seatName: '玩家{seat}',
    listSep: '、',
    scoreSep: '；'
  },
  en: {
    typeNames: {1:'High Card', 2:'Pair', 3:'Straight', 4:'Flush', 5:'Straight Flush', 6:'Trips'},
    bigJoker: 'Big Joker', smallJoker: 'Small Joker',
    roundPrefix: 'Round {round}: ',
    p1Played: 'Phase 1: Player {seat} played face-down',
    p1Won: 'Phase 1: Player {seat} won {n} cards with {type}',
    p2NotEnough: 'Phase 2: Not opened (fewer than 2 participants)',
    p2Join: 'Phase 2: Player {seat} joins',
    p2Skip: 'Phase 2: Player {seat} skips',
    p2Open: 'Phase 2 opened: must play {type}',
    p2Played: 'Phase 2: Player {seat} played',
    p2AllInvalid: 'Phase 2: All plays invalid, everyone takes back 3 cards',
    p2Won: 'Phase 2: Player {seat} won {n} cards with {type}',
    emptied: 'Player {seat} emptied hand (Round {round}, Phase {phase})',
    gameOverRemain: 'Game over: Player {seat} had {n} cards left, split equally ({k} each)',
    gameOverNone: 'Game over: no player holds cards',
    baseScored: 'Base score: {names} each get 5 points',
    baseNone: 'Base score: no one gets the bonus',
    finalScores: 'Final scores: {list}',
    scoreItem: 'Player {seat} {score} (base {base}+pile {pile})',
    wonText: 'Player {seat} won {n} cards with {type}',
    seatName: 'Player {seat}',
    listSep: ', ',
    scoreSep: '; '
  }
};
let _lang = 'zh';
function setLang(l){ if (I18N[l]) _lang = l; }
function getLang(){ return _lang; }
function fmt(k, p){
  const dict = I18N[_lang] || I18N.zh;
  let s = dict[k] !== undefined ? dict[k] : (I18N.zh[k] !== undefined ? I18N.zh[k] : k);
  if (p) for (const key of Object.keys(p)) s = s.split('{' + key + '}').join(String(p[key]));
  return s;
}
function typeName(t){ return (I18N[_lang].typeNames)[t] || ''; }

function isJoker(c){ return !!c && typeof c.w === 'number'; }

function makeDeck(){
  const deck = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) deck.push({r, s});
  deck.push({w:1}); // 大王
  deck.push({w:2}); // 小王
  return deck;
}

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function cardName(c){
  if (c.w === 1) return I18N[_lang].bigJoker;
  if (c.w === 2) return I18N[_lang].smallJoker;
  return RANK_STR[c.r] + SUIT_CHARS[c.s];
}

function cardIsRed(c){
  if (c.w === 1) return true;
  if (c.w === 2) return false;
  return c.s === 1 || c.s === 3;
}

function cardKey(c){ return c.w ? ('w'+c.w) : (c.r + '-' + c.s); }

function compareCards(a, b){
  // 展示排序：大小王最左（大王在小王左边），然后从大到小：A, K, ..., 2；同点数按花色（黑桃>红桃>梅花>方块）
  const key = c => {
    if (c.w === 1) return 0;
    if (c.w === 2) return 1;
    return 16 - c.r; // A(14)→2, K(13)→3, ..., 2→14
  };
  const ka = key(a), kb = key(b);
  if (ka !== kb) return ka - kb;
  const sa = isJoker(a) ? 0 : a.s;
  const sb = isJoker(b) ? 0 : b.s;
  return sa - sb;
}

/* ================= 三张牌评估 ================= */

function effRank(c, aLow){ return (aLow && c.r === 14) ? 1 : c.r; }

function isA23(cs){
  const ranks = cs.map(c => c.r).sort((x, y) => x - y);
  return ranks.length === 3 && ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 14;
}

// 评估3张自然牌（无王），返回 {type, points, suitSeq}
function evalNatural3(cs){
  const aLow = isA23(cs);
  const cards = cs.slice().sort((a, b) => {
    const ea = effRank(a, aLow), eb = effRank(b, aLow);
    return eb - ea || a.s - b.s;
  });
  const ranks = cards.map(c => effRank(c, aLow));
  const flush = cs.every(c => c.s === cs[0].s);
  const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const straight = ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1;

  let type, points, suitSeq;
  if (trips){
    type = 6; points = [ranks[0]];
    suitSeq = cards.map(c => c.s);
  } else if (straight && flush){
    type = 5; points = [ranks[0]];
    suitSeq = cards.map(c => c.s);
  } else if (flush){
    type = 4; points = ranks.slice();
    suitSeq = cards.map(c => c.s);
  } else if (straight){
    type = 3; points = [ranks[0]];
    suitSeq = cards.map(c => c.s);
  } else if (ranks[0] === ranks[1] || ranks[1] === ranks[2]){
    type = 2;
    const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[2];
    const kicker = ranks[0] === ranks[1] ? ranks[2] : ranks[0];
    points = [pairRank, kicker];
    const pairCards = cards.filter(c => effRank(c, aLow) === pairRank).sort((a, b) => a.s - b.s);
    const kickCard = cards.find(c => effRank(c, aLow) === kicker);
    suitSeq = pairCards.map(c => c.s).concat(kickCard.s);
  } else {
    type = 1; points = ranks.slice();
    suitSeq = cards.map(c => c.s);
  }
  return { type, points, suitSeq };
}

// 是否非同花235（2、3、5，花色不全相同，且无王）
function isSpecial235(cs){
  if (cs.length !== 3) return false;
  if (cs.some(isJoker)) return false;
  const ranks = cs.map(c => c.r).sort((a, b) => a - b);
  if (!(ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 5)) return false;
  return !(cs[0].s === cs[1].s && cs[1].s === cs[2].s);
}

// 从数组里取 k 个下标组合
function subsetsIdx(n, k){
  const res = [];
  const idx = [];
  (function rec(start){
    if (idx.length === k){ res.push(idx.slice()); return; }
    for (let i = start; i <= n - (k - idx.length); i++){
      idx.push(i); rec(i + 1); idx.pop();
    }
  })(0);
  return res;
}

function combosOf(arr, k){
  return subsetsIdx(arr.length, k).map(idxs => idxs.map(i => arr[i]));
}

// a 是否优于 b（仅按牌型+点数，用于王的选择）
function betterEval(a, b){
  if (a.type !== b.type) return a.type > b.type;
  for (let i = 0; i < Math.max(a.points.length, b.points.length); i++){
    const pa = a.points[i] || 0, pb = b.points[i] || 0;
    if (pa !== pb) return pa > pb;
  }
  return false;
}

// 评估3张牌（可含王），返回完整比较信息
function evalHand3(cards){
  const jokers = cards.filter(isJoker);
  const naturals = cards.filter(c => !isJoker(c));
  if (jokers.length === 0){
    const e = evalNatural3(naturals);
    e.special235 = isSpecial235(naturals);
    e.hasBig = false; e.hasSmall = false;
    e.invalid = false;
    return e;
  }
  const used = new Set();
  naturals.forEach(c => used.add(c.r * 4 + c.s));
  const cands = [];
  for (let r = 2; r <= 14; r++)
    for (let s = 0; s < 4; s++)
      if (!used.has(r * 4 + s)) cands.push({r, s});
  let best = null;
  for (const combo of combosOf(cands, jokers.length)){
    const e = evalNatural3(naturals.concat(combo));
    e.special235 = false; // 王不能组成235
    if (!best || betterEval(e, best)) best = e;
  }
  best.hasBig = jokers.some(c => c.w === 1);
  best.hasSmall = jokers.some(c => c.w === 2);
  best.invalid = false;
  return best;
}

/* ================= 比较 ================= */

function cmpPoints(a, b){
  for (let i = 0; i < Math.max(a.points.length, b.points.length); i++){
    const pa = a.points[i] || 0, pb = b.points[i] || 0;
    if (pa !== pb) return pa - pb;
  }
  return 0;
}

// >0 表示 a 花色更大
function cmpSuits(a, b){
  const n = Math.max(a.suitSeq.length, b.suitSeq.length);
  for (let i = 0; i < n; i++){
    const sa = i < a.suitSeq.length ? a.suitSeq[i] : 3;
    const sb = i < b.suitSeq.length ? b.suitSeq[i] : 3;
    if (sa !== sb) return sa < sb ? 1 : -1;
  }
  return 0;
}

// >0 表示 a 含王更优
function cmpJokers(a, b){
  if (a.hasBig !== b.hasBig) return a.hasBig ? 1 : -1;
  if (a.hasSmall !== b.hasSmall) return a.hasSmall ? 1 : -1;
  return 0;
}

// 常规比较：牌型 → 点数 → 含王 → 花色；>0 表示 a 更强
function cmpHands(a, b){
  if (a.type !== b.type) return a.type - b.type;
  const p = cmpPoints(a, b); if (p) return p;
  const j = cmpJokers(a, b); if (j) return j;
  return cmpSuits(a, b);
}

// 完整比较（含235特殊位置）：>0 表示 a 更强
function cmpFull(a, b){
  if (a.special235 && b.special235) return cmpSuits(a, b);
  if (a.special235) return -1; // 235 输给一切非235
  if (b.special235) return 1;
  return cmpHands(a, b);
}

// 多人排序：返回从强到弱；组内同时有235与三条时，235最大
function rankHands(list){
  const any235 = list.some(h => h.special235);
  const anyTrips = list.some(h => h.type === 6);
  if (any235 && anyTrips){
    const s235 = list.filter(h => h.special235).sort((a, b) => cmpSuits(b, a));
    const rest = list.filter(h => !h.special235).sort((a, b) => cmpHands(b, a));
    return s235.concat(rest);
  }
  return list.slice().sort((a, b) => cmpFull(b, a));
}

/* ================= 游戏流程 ================= */

class Game {
  constructor(seatTypes){
    this.seatTypes = (seatTypes || ['human','human','human']).slice();
  }

  start(botStrategies){
    this.deck = shuffle(makeDeck());
    this.hands = [[], [], []];
    // 每个电脑座位使用开局设置指定的策略；未指定或为 random 时随机抽取（不对外显示）
    this.seatStrategies = this.seatTypes.map((t, s) => {
      if (t !== 'ai') return null;
      const pick = botStrategies && botStrategies[s];
      return (pick && pick !== 'random' && STRATEGY_LIB[pick]) ? pick : randomStrategyKey();
    });
    this.lastRoundP1 = [null, null, null];
    for (let i = 0; i < 54; i++) this.hands[i % 3].push(this.deck[i]);
    this.piles = [0, 0, 0];
    this.round = 0;
    this.phase = 'p1_select';
    this.currentSeat = 0;
    this.pending = [];
    this.p1Sel = [null, null, null];
    this.p1Locked = [false, false, false];
    this.playedP1 = [null, null, null];
    this.p1Ranked = null;
    this.p1Winner = -1;
    this.requiredType = null;
    this.p2Decided = [false, false, false];
    this.p2Joins = [false, false, false];
    this.p2Sel = [null, null, null];
    this.p2Locked = [false, false, false];
    this.playedP2 = [null, null, null];
    this.p2Ranked = null;
    this.p2Winner = -1;
    this.p2Refund = false;
    this.p2Skipped = false;
    this.emptiedAt = [null, null, null];
    this.firstEmpty = null;
    this.base = [0, 0, 0];
    this.gameOver = false;
    this.finalScores = null;
    this.log = [];
    this.awardText = '';
    this.seen = [];
    this._setupPhase1();
  }

  _holders(){ return [0, 1, 2].filter(s => this.hands[s].length > 0); }

  _setupPhase1(){
    this.phase = 'p1_select';
    this.pending = this._holders();
    this.currentSeat = this.pending.length ? this.pending[0] : 0;
  }

  selectP1(seat, indices){
    if (this.phase !== 'p1_select' || this.p1Locked[seat]) return;
    this.p1Sel[seat] = indices.slice();
  }

  confirmP1(seat){
    if (this.phase !== 'p1_select' || this.p1Locked[seat]) return;
    const sel = this.p1Sel[seat];
    if (!sel || sel.length !== 3) return;
    this.playedP1[seat] = sel.map(i => this.hands[seat][i]);
    this.p1Locked[seat] = true;
    this._log(fmt('p1Played', {seat: seat + 1}));
    const next = this.pending.find(s => !this.p1Locked[s]);
    if (next !== undefined) this.currentSeat = next;
    else this._resolvePhase1();
  }

  _resolvePhase1(){
    const entries = [];
    for (const seat of this.pending){
      const played = this.playedP1[seat];
      const sel = this.p1Sel[seat];
      this.hands[seat] = this.hands[seat].filter((c, i) => !sel.includes(i));
      const ev = evalHand3(played);
      entries.push({seat, ev});
      this.seen.push(...played);
      if (this.hands[seat].length === 0) this._markEmpty(seat, 1);
    }
    // 从强到弱
    let ranked = entries.slice().sort((a, b) => cmpFull(b.ev, a.ev));
    const any235 = entries.some(e => e.ev.special235);
    const anyTrips = entries.some(e => e.ev.type === 6);
    if (any235 && anyTrips){
      const s235 = entries.filter(e => e.ev.special235).sort((a, b) => cmpSuits(b.ev, a.ev));
      const rest = entries.filter(e => !e.ev.special235).sort((a, b) => cmpHands(b.ev, a.ev));
      ranked = s235.concat(rest);
    }
    this.p1Ranked = ranked;
    this.p1Winner = ranked[0].seat;
    this.piles[this.p1Winner] += this.pending.length * 3;
    this.requiredType = ranked[0].ev.special235 ? 1 : ranked[ranked.length - 1].ev.type;
    const wname = typeName(ranked[0].ev.type);
    this.awardText = fmt('wonText', {seat: this.p1Winner + 1, type: wname, n: this.pending.length * 3});
    this._log(fmt('p1Won', {seat: this.p1Winner + 1, type: wname, n: this.pending.length * 3}));

    const canJoin = this._holders();
    if (canJoin.length < 2){
      this.p2Skipped = true;
      this._log(fmt('p2NotEnough'));
      this.phase = 'round_end';
      return;
    }
    this.p2Skipped = false;
    this.phase = 'p2_choose';
    this.pending = canJoin;
    this.currentSeat = canJoin[0];
  }

  chooseP2(seat, join){
    if (this.phase !== 'p2_choose') return;
    this.p2Joins[seat] = !!join;
    this.p2Decided[seat] = true;
    this._log(fmt(join ? 'p2Join' : 'p2Skip', {seat: seat + 1}));
    const next = this.pending.find(s => !this.p2Decided[s]);
    if (next !== undefined){ this.currentSeat = next; return; }
    const joiners = this.pending.filter(s => this.p2Joins[s]);
    if (joiners.length < 2){
      this.p2Skipped = true;
      this._log(fmt('p2NotEnough'));
      this.phase = 'round_end';
      return;
    }
    this.phase = 'p2_select';
    this.pending = joiners;
    this.currentSeat = joiners[0];
    this._log(fmt('p2Open', {type: typeName(this.requiredType)}));
  }

  selectP2(seat, indices){
    if (this.phase !== 'p2_select' || this.p2Locked[seat]) return;
    this.p2Sel[seat] = indices.slice();
  }

  confirmP2(seat){
    if (this.phase !== 'p2_select' || this.p2Locked[seat]) return;
    const sel = this.p2Sel[seat];
    if (!sel || sel.length !== 3) return;
    this.playedP2[seat] = sel.map(i => this.hands[seat][i]);
    this.p2Locked[seat] = true;
    this._log(fmt('p2Played', {seat: seat + 1}));
    const next = this.pending.find(s => !this.p2Locked[s]);
    if (next !== undefined) this.currentSeat = next;
    else this._resolvePhase2();
  }

  _resolvePhase2(){
    const entries = [];
    for (const seat of this.pending){
      const played = this.playedP2[seat];
      const sel = this.p2Sel[seat];
      this.hands[seat] = this.hands[seat].filter((c, i) => !sel.includes(i));
      const ev = evalHand3(played);
      ev.invalid = ev.type !== this.requiredType;
      entries.push({seat, ev});
      this.seen.push(...played);
      if (this.hands[seat].length === 0) this._markEmpty(seat, 2);
    }
    const valid = entries.filter(e => !e.ev.invalid);
    const invalid = entries.filter(e => e.ev.invalid);
    let ranked;
    if (valid.length === 0){
      this.p2Refund = true;
      this.p2Winner = -1;
      ranked = entries.slice();
      for (const e of entries) this.piles[e.seat] += 3;
      this.awardText = fmt('p2AllInvalid');
      this._log(fmt('p2AllInvalid'));
    } else {
      this.p2Refund = false;
      let vrank = valid.slice().sort((a, b) => cmpHands(b.ev, a.ev));
      const any235 = valid.some(e => e.ev.special235);
      const anyTrips = valid.some(e => e.ev.type === 6);
      if (any235 && anyTrips){
        const s235 = valid.filter(e => e.ev.special235).sort((a, b) => cmpSuits(b.ev, a.ev));
        const rest = valid.filter(e => !e.ev.special235).sort((a, b) => cmpHands(b.ev, a.ev));
        vrank = s235.concat(rest);
      }
      ranked = vrank.concat(invalid);
      this.p2Winner = vrank[0].seat;
      this.piles[this.p2Winner] += entries.length * 3;
      this.awardText = fmt('wonText', {seat: this.p2Winner + 1, type: typeName(vrank[0].ev.type), n: entries.length * 3});
      this._log(fmt('p2Won', {seat: this.p2Winner + 1, type: typeName(vrank[0].ev.type), n: entries.length * 3}));
    }
    this.p2Ranked = ranked;
    this.phase = 'round_end';
  }

  _markEmpty(seat, phase){
    this.emptiedAt[seat] = {r: this.round, p: phase};
    if (!this.firstEmpty ||
        this.firstEmpty.r > this.round ||
        (this.firstEmpty.r === this.round && this.firstEmpty.p > phase)){
      this.firstEmpty = {r: this.round, p: phase};
    }
    this._log(fmt('emptied', {seat: seat + 1, round: this.round + 1, phase}));
  }

  nextRound(){
    if (this.phase !== 'round_end') return;
    const holders = this._holders();
    if (holders.length <= 1){
      if (holders.length === 1){
        const last = holders[0];
        const k = this.hands[last].length / 3;
        for (let i = 0; i < 3; i++) this.piles[i] += k;
        this._log(fmt('gameOverRemain', {seat: last + 1, n: this.hands[last].length, k}));
        this.hands[last] = [];
      } else {
        this._log(fmt('gameOverNone'));
      }
      if (this.firstEmpty){
        for (let s = 0; s < 3; s++){
          const e = this.emptiedAt[s];
          if (e && e.r === this.firstEmpty.r && e.p === this.firstEmpty.p) this.base[s] = 5;
        }
      }
      const got = this.base.map((b, s) => b ? fmt('seatName', {seat: s + 1}) : null).filter(Boolean);
      this._log(got.length ? fmt('baseScored', {names: got.join(fmt('listSep'))}) : fmt('baseNone'));
      this.finalScores = this.base.map((b, s) => b + this.piles[s]);
      this._log(fmt('finalScores', {list: this.finalScores.map((v, s) =>
        fmt('scoreItem', {seat: s + 1, score: v, base: this.base[s], pile: this.piles[s]})).join(fmt('scoreSep'))}));
      this.gameOver = true;
      this.phase = 'game_over';
      return;
    }
    this.round++;
    this.lastRoundP1 = this.playedP1.map(p => (p && p.length ? p.slice() : null));
    this.p1Sel = [null, null, null];
    this.p1Locked = [false, false, false];
    this.playedP1 = [null, null, null];
    this.p1Ranked = null;
    this.p1Winner = -1;
    this.requiredType = null;
    this.p2Decided = [false, false, false];
    this.p2Joins = [false, false, false];
    this.p2Sel = [null, null, null];
    this.p2Locked = [false, false, false];
    this.playedP2 = [null, null, null];
    this.p2Ranked = null;
    this.p2Winner = -1;
    this.p2Refund = false;
    this.p2Skipped = false;
    this.awardText = '';
    this._setupPhase1();
  }

  _log(t){ this.log.push(fmt('roundPrefix', {round: this.round + 1}) + t); }
}

/* ================= 电脑AI（简单启发式） ================= */

function scoreEval(e){
  let sc = e.type * 1000000;
  const w = [10000, 100, 1];
  for (let i = 0; i < e.points.length; i++) sc += (e.points[i] || 0) * (w[i] || 0);
  return sc;
}

/* ================= 电脑AI：策略库 ================= */

// 单次枚举手牌全部组合：235、非235最优、完整列表
function analyzeHand(hand){
  const combos = [];
  let s235 = null, best = null;
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evalHand3(idx.map(i => hand[i]));
    const sc = scoreEval(ev);
    if (ev.special235){
      if (!s235 || sc < s235.sc) s235 = {idx, ev, sc};
    } else if (!best || sc > best.sc){
      best = {idx, ev, sc};
    }
    combos.push({idx, ev, sc});
  }
  return {combos, s235, best};
}

// 未知牌池：整副牌 − 所有已亮牌 − 自己手牌
function poolOf(game, hand){
  const seenSet = new Set((game.seen || []).map(cardKey));
  const mine = new Set(hand.map(cardKey));
  const pool = [];
  for (const c of makeDeck()){
    const k = cardKey(c);
    if (!seenSet.has(k) && !mine.has(k)) pool.push(c);
  }
  return pool;
}

// 两张自然牌 + 一张王：王按最大牌力取值（三条→同花顺→同花→顺子→对子）
function bestWithJoker(a, b, j){
  const flags = {hasBig: j.w === 1, hasSmall: j.w === 2};
  if (a.r === b.r){
    return {type: 6, points: [a.r], suitSeq: [a.s, b.s, 0], special235: false, invalid: false, ...flags};
  }
  const lo = Math.min(a.r, b.r), hi = Math.max(a.r, b.r);
  const d = hi - lo;
  let straightTop = 0;
  if (d === 1){
    straightTop = hi === 14 ? 14 : Math.min(14, hi + 1);
  } else if (d === 2){
    straightTop = hi;
  } else if (lo === 2 && hi === 14){
    straightTop = 3; // A、2 → A23
  } else if (lo === 3 && hi === 14){
    straightTop = 3; // A、3 → A23
  }
  const sameSuit = a.s === b.s;
  if (straightTop && sameSuit){
    return {type: 5, points: [straightTop], suitSeq: [a.s, a.s, a.s], special235: false, invalid: false, ...flags};
  }
  if (straightTop){
    return {type: 3, points: [straightTop], suitSeq: [a.s, b.s, 0], special235: false, invalid: false, ...flags};
  }
  if (sameSuit){
    const used = new Set([a.r, b.r]);
    let jr = 14;
    while (used.has(jr)) jr--;
    const pts = [a.r, b.r, jr].sort((x, y) => y - x);
    return {type: 4, points: pts, suitSeq: [a.s, a.s, a.s], special235: false, invalid: false, ...flags};
  }
  return {type: 2, points: [hi, lo], suitSeq: [hi === a.r ? a.s : b.s, hi === a.r ? b.s : a.s, 0], special235: false, invalid: false, ...flags};
}

// 未知牌池中能组成的最大牌力；exclude235 为真时忽略非同花235的特殊地位
function bestComboInPool(pool, exclude235){
  const naturals = pool.filter(c => !isJoker(c));
  const jokers = pool.filter(isJoker);
  let best = null;
  for (const idx of subsetsIdx(naturals.length, 3)){
    const cards = idx.map(i => naturals[i]);
    const ev = evalNatural3(cards);
    ev.special235 = isSpecial235(cards);
    ev.hasBig = false;
    ev.hasSmall = false;
    if (exclude235 && ev.special235) continue;
    if (!best || cmpHands(ev, best) > 0) best = ev;
  }
  for (const j of jokers){
    for (const idx of subsetsIdx(naturals.length, 2)){
      const ev = bestWithJoker(naturals[idx[0]], naturals[idx[1]], j);
      if (!best || cmpHands(ev, best) > 0) best = ev;
    }
  }
  if (jokers.length === 2){
    for (const c of naturals){
      const ev = {type: 6, points: [c.r], suitSeq: [c.s, 0, 0], hasBig: true, hasSmall: true, special235: false, invalid: false};
      if (!best || cmpHands(ev, best) > 0) best = ev;
    }
  }
  return best;
}

// 受保护牌（原则上不拆分）：最大手牌、三条牌、A♠；从中挑最弱且少拆保护牌的组合
function weakestPreserving(hand, A){
  const protectedSet = new Set(A.best ? A.best.idx : []);
  const rankCount = {};
  hand.forEach((c, i) => { if (!isJoker(c)) rankCount[c.r] = (rankCount[c.r] || 0) + 1; });
  hand.forEach((c, i) => {
    if (!isJoker(c) && rankCount[c.r] >= 3) protectedSet.add(i);
    if (c.r === 14 && c.s === 0) protectedSet.add(i);
  });
  let pick = null, bestU = Infinity;
  for (const c of A.combos){
    const uses = c.idx.reduce((n, i) => n + (protectedSet.has(i) ? 1 : 0), 0);
    const u = c.sc + 3000000 * uses;
    if (u < bestU){ bestU = u; pick = c; }
  }
  return pick;
}

/* ================= 电脑AI：策略 2-2 辅助 ================= */

function combosOfHand(hand){
  const list = [];
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evalHand3(idx.map(i => hand[i]));
    list.push({idx, ev, sc: scoreEval(ev)});
  }
  return list;
}

// 未知牌池能否组成非同花235（对手存在235的可能）
function poolCan235(pool){
  const twos = pool.filter(c => c.r === 2);
  const threes = pool.filter(c => c.r === 3);
  const fives = pool.filter(c => c.r === 5);
  if (!twos.length || !threes.length || !fives.length) return false;
  for (const t of twos) for (const h of threes) for (const f of fives){
    if (!(t.s === h.s && h.s === f.s)) return true;
  }
  return false;
}

// 不拆分的保护组合：最强 三条 / 同花顺 / 同花（按需），返回索引键集合
function protectedSetsOf(hand, wantSF, wantFlush){
  const sets = [];
  const want = [6, wantSF ? 5 : null, wantFlush ? 4 : null].filter(v => v !== null);
  for (const tp of want){
    let best = null;
    for (const idx of subsetsIdx(hand.length, 3)){
      const ev = evalHand3(idx.map(i => hand[i]));
      if (ev.type !== tp) continue;
      if (!best || scoreEval(ev) > scoreEval(best.ev)) best = {idx, ev};
    }
    if (best) sets.push(best.idx.slice().sort((a, b) => a - b).join(','));
  }
  return sets;
}

const idxKey = idx => idx.slice().sort((a, b) => a - b).join(',');

// 是否部分拆用了某个保护组合（完全等于保护组合或完全不使用都允许）
function splitsProtection(idx, sets){
  for (const key of sets){
    const set = key.split(',').map(Number);
    const inter = idx.filter(i => set.includes(i)).length;
    if (inter > 0 && inter < set.length) return true;
  }
  return false;
}

function bestAllowedOfType(list, tp, sets){
  let best = null;
  for (const c of list){
    if (c.ev.type !== tp || splitsProtection(c.idx, sets)) continue;
    if (!best || c.sc > best.sc) best = c;
  }
  return best;
}

function weakestAllowedOfType(list, tp, sets){
  let pick = null;
  for (const c of list){
    if (c.ev.type !== tp || splitsProtection(c.idx, sets)) continue;
    if (!pick || c.sc < pick.sc) pick = c;
  }
  return pick;
}

function weakestAllowedAny(list, sets){
  let pick = null;
  for (const c of list){
    if (splitsProtection(c.idx, sets)) continue;
    if (!pick || c.sc < pick.sc) pick = c;
  }
  return pick || list[0];
}

function bestAllowedAny(list, sets){
  let pick = null;
  for (const c of list){
    if (splitsProtection(c.idx, sets)) continue;
    if (!pick || c.sc > pick.sc) pick = c;
  }
  return pick;
}

// 手牌是否全部由三条/同花顺的牌组成
function allTripsOrSF(hand){
  const inSets = new Set();
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evalHand3(idx.map(i => hand[i]));
    if (ev.type === 6 || ev.type === 5) idx.forEach(i => inSets.add(i));
  }
  return inSets.size === hand.length;
}

// 第二大单张牌：以非保护牌中第二大单张为顶牌的最弱单张组合
function secondLargestSingle(hand, sets){
  const free = hand.map((c, i) => ({c, i}))
    .filter(o => !sets.some(key => key.split(',').map(Number).includes(o.i)));
  free.sort((a, b) => compareCards(a.c, b.c));
  const target = free[1] || free[0];
  if (!target) return null;
  let pick = null;
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evalHand3(idx.map(i => hand[i]));
    if (ev.type !== 1 || splitsProtection(idx, sets)) continue;
    if (!idx.includes(target.i)) continue;
    const sorted = idx.slice().sort((a, b) => compareCards(hand[a], hand[b]));
    if (sorted[0] !== target.i) continue; // 顶牌必须是选中的第二大单张
    if (!pick || scoreEval(ev) < scoreEval(pick.ev)) pick = {idx, ev};
  }
  return pick ? pick.idx : null;
}

// 未知牌池按牌型的最佳组合（忽略235特殊地位）
function poolBestByType(pool){
  const naturals = pool.filter(c => !isJoker(c));
  const jokers = pool.filter(isJoker);
  const byType = {};
  let overall = null;
  const add = ev => {
    if (!ev) return;
    if (!byType[ev.type] || cmpHands(ev, byType[ev.type]) > 0) byType[ev.type] = ev;
    if (!overall || cmpHands(ev, overall) > 0) overall = ev;
  };
  for (const idx of subsetsIdx(naturals.length, 3)){
    const cards = idx.map(i => naturals[i]);
    const ev = evalNatural3(cards);
    if (isSpecial235(cards)) continue;
    ev.special235 = false; ev.hasBig = false; ev.hasSmall = false;
    add(ev);
  }
  for (const j of jokers){
    for (const idx of subsetsIdx(naturals.length, 2)){
      add(bestWithJoker(naturals[idx[0]], naturals[idx[1]], j));
    }
  }
  if (jokers.length === 2){
    for (const c of naturals){
      add({type: 6, points: [c.r], suitSeq: [c.s, 0, 0], hasBig: true, hasSmall: true, special235: false, invalid: false});
    }
  }
  return {byType, overall};
}

// 剩3张的追加阶段参与（策略2-1与2-2共用）
function joinThreeCards(hand, game){
  const me = game.currentSeat;
  const lens = [0, 1, 2].filter(s => s !== me).map(s => game.hands[s].length);
  if (lens.some(n => n === 3)) return true;
  if (lens.every(n => n > 3)){
    const mine = evalHand3(hand);
    const pb = poolBestByType(poolOf(game, hand));
    if (!pb.overall || cmpFull(mine, pb.overall) > 0) return false;
    return true;
  }
  return true;
}

// 绝对大→控牌型核心（策略2-2规则2-4、策略3-1情况1共用）：
// 有绝对大打最大；否则在不拆三条/同花顺下，找其他牌型内绝对大并出较小的牌，争取第二阶段获胜
function controlChooseP1(hand, game){
  const pool = poolOf(game, hand);
  const sets = protectedSetsOf(hand, true, false);
  const mine = combosOfHand(hand);
  const best = mine.reduce((a, b) => a.sc >= b.sc ? a : b);
  const pb = poolBestByType(pool);
  if (!pb.overall || cmpFull(best.ev, pb.overall) > 0) return best.idx;
  for (const tp of [4, 3, 2, 1]){
    const strong = bestAllowedOfType(mine, tp, sets);
    if (!strong) continue;
    if (!pb.byType[tp] || cmpFull(strong.ev, pb.byType[tp]) > 0){
      const weak = weakestAllowedOfType(mine, tp, sets);
      if (weak && idxKey(weak.idx) !== idxKey(strong.idx)) return weak.idx;
      for (const t2 of [4, 3, 2, 1]){
        const s2 = bestAllowedOfType(mine, t2, sets);
        const w2 = weakestAllowedOfType(mine, t2, sets);
        if (s2 && w2 && idxKey(s2.idx) !== idxKey(w2.idx)) return w2.idx;
      }
    }
  }
  return weakestAllowedAny(mine, sets).idx;
}

/* ================= 电脑AI：策略 ai-1（量化专家） ================= */

// 二阶段胜率静态表：手牌数 × 牌型 → “最强有效组合牌力”的分位值（0%,5%,...,100%）。
// 由 gen-p2-table.js 离线生成后内嵌；值为 -1 表示该牌型无法组成。
const P2_TABLE = {"3":{"1":[-1,-1,-1,-1,-1,-1,-1,1050302,1080504,1090704,1100803,1110605,1111005,1120806,1121106,1130802,1131007,1140402,1140903,1141110,1141311],"2":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2060300,2100900,2141300],"3":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3050000,3140000],"4":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4121004,4141311],"5":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5140000],"6":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6140000]},"6":{"1":[-1,1100503,1110504,1110908,1120704,1121005,1121105,1121109,1130907,1131102,1131110,1131208,1131210,1140905,1141008,1141109,1141208,1141211,1141307,1141310,1141311],"2":[-1,-1,-1,-1,-1,-1,-1,-1,2021300,2031400,2051000,2061100,2071200,2081100,2091200,2101300,2111200,2121100,2131100,2140900,2141300],"3":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3030000,3050000,3060000,3080000,3090000,3100000,3110000,3120000,3130000,3140000,3140000],"4":[-1,-1,-1,-1,-1,-1,-1,4080403,4100302,4110604,4120504,4121007,4130803,4131109,4140702,4140905,4141103,4141204,4141303,4141309,4141311],"5":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5030000,5080000,5120000,5140000],"6":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6020000,6060000,6110000,6140000]},"9":{"1":[1080703,1111006,1121006,1121108,1121109,1131009,1131110,1131208,1131210,1131210,1141009,1141109,1141208,1141210,1141211,1141307,1141309,1141310,1141311,1141311,1141311],"2":[-1,-1,2021400,2041400,2051400,2061400,2071400,2081300,2091100,2091400,2101300,2101400,2111300,2120800,2121300,2121400,2131200,2131400,2141200,2141300,2141300],"3":[-1,-1,-1,-1,3040000,3050000,3070000,3080000,3090000,3100000,3100000,3110000,3120000,3120000,3130000,3130000,3140000,3140000,3140000,3140000,3140000],"4":[-1,4100403,4110603,4111007,4120807,4121106,4130805,4131008,4131204,4140602,4140807,4141006,4141106,4141204,4141209,4141302,4141306,4141309,4141310,4141311,4141311],"5":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5050000,5070000,5090000,5100000,5120000,5130000,5140000,5140000],"6":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6040000,6060000,6080000,6100000,6110000,6130000,6130000,6140000]},"12":{"1":[1080705,1121009,1121109,1131108,1131110,1131209,1131210,1131210,1141109,1141208,1141211,1141211,1141308,1141310,1141310,1141310,1141311,1141311,1141311,1141311,1141311],"2":[-1,2051400,2071300,2081300,2091300,2091400,2101400,2111200,2111400,2111400,2121300,2121400,2121400,2131200,2131400,2131400,2141100,2141200,2141300,2141300,2141300],"3":[-1,3040000,3060000,3080000,3090000,3100000,3110000,3110000,3120000,3120000,3130000,3130000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000],"4":[4090604,4120805,4121109,4131006,4131110,4131210,4140807,4141007,4141108,4141203,4141209,4141211,4141304,4141307,4141308,4141309,4141310,4141311,4141311,4141311,4141311],"5":[-1,-1,-1,-1,-1,-1,-1,-1,5040000,5060000,5080000,5100000,5110000,5120000,5120000,5130000,5140000,5140000,5140000,5140000],"6":[-1,-1,-1,-1,-1,-1,-1,-1,6030000,6050000,6070000,6080000,6090000,6100000,6110000,6120000,6130000,6130000,6140000,6140000,6140000]},"15":{"1":[1100807,1121109,1131110,1131209,1131210,1131210,1141110,1141210,1141211,1141211,1141309,1141310,1141310,1141311,1141311,1141311,1141311,1141311,1141311,1141311,1141311],"2":[2031300,2081400,2091400,2101400,2111200,2111400,2111400,2121300,2121400,2121400,2131200,2131200,2131400,2131400,2141000,2141200,2141300,2141300,2141300,2141300,2141300],"3":[-1,3080000,3100000,3110000,3110000,3120000,3130000,3130000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000],"4":[4090605,4130807,4131205,4140705,4141008,4141108,4141206,4141210,4141211,4141305,4141308,4141309,4141309,4141310,4141311,4141311,4141311,4141311,4141311,4141311,4141311],"5":[-1,-1,-1,-1,-1,5050000,5070000,5090000,5100000,5110000,5120000,5120000,5130000,5130000,5140000,5140000,5140000,5140000,5140000,5140000],"6":[-1,-1,-1,-1,6030000,6050000,6070000,6080000,6090000,6100000,6110000,6110000,6120000,6120000,6130000,6130000,6130000,6140000,6140000,6140000,6140000]},"18":{"1":[1111008,1131110,1131210,1131210,1141209,1141211,1141211,1141309,1141310,1141310,1141311,1141311,1141311,1141311,1141311,1141311,1141311,1141311,1141311,1141311,1141311],"2":[2051400,2101300,2111000,2111400,2121100,2121400,2121400,2131200,2131200,2131400,2131400,2131400,2141000,2141200,2141300,2141300,2141300,2141300,2141300,2141300,2141300],"3":[-1,3100000,3110000,3120000,3130000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000,3140000],"4":[4110706,4131208,4140905,4141108,4141207,4141210,4141211,4141306,4141308,4141309,4141310,4141310,4141311,4141311,4141311,4141311,4141311,4141311,4141311,4141311,4141311],"5":[-1,-1,5040000,5070000,5080000,5100000,5110000,5120000,5130000,5130000,5140000,5140000,5140000,5140000,5140000,5140000,5140000,5140000,5140000,5140000,5140000],"6":[-1,6020000,6050000,6070000,6080000,6100000,6100000,6110000,6120000,6120000,6130000,6130000,6130000,6130000,6140000,6140000,6140000,6140000,6140000,6140000,6140000]}};

// 牌池中“非同花235”的可能组合数（对手可组成；不含己方手牌）
function countPossible235(pool){
  const twos = [], threes = [], fives = [];
  for (const c of pool){
    if (c.r === 2) twos.push(c);
    else if (c.r === 3) threes.push(c);
    else if (c.r === 5) fives.push(c);
  }
  let n = 0;
  for (const t of twos) for (const h of threes) for (const f of fives){
    if (!(t.s === h.s && h.s === f.s)) n++;
  }
  return n;
}

// 一组牌能否组成三条：自然三条 / 对子+王 / 单张+双王
function partCanTrips(cards){
  const rankCount = {};
  let nJ = 0;
  for (const c of cards){
    if (isJoker(c)) nJ++;
    else rankCount[c.r] = (rankCount[c.r] || 0) + 1;
  }
  if (nJ >= 2 && cards.length >= 3) return true;
  const ranks = Object.keys(rankCount).map(Number);
  for (const r of ranks){
    if (rankCount[r] >= 3) return true;
    if (rankCount[r] === 2 && nJ >= 1) return true;
  }
  return false;
}

// 蒙特卡洛估算“至少一个对手当前手牌能组成三条”的概率（235狙击用）。
// 未知牌池恰好是其余玩家手牌的并集，每次随机划分后检查各部分。
function probAnyOpponentTrips(game, hand){
  const me = game.currentSeat !== undefined ? game.currentSeat : 0;
  const opps = [0, 1, 2].filter(s => s !== me && game.hands[s].length > 0);
  const pool = poolOf(game, hand);
  const sizes = opps.map(s => game.hands[s].length);
  if (!opps.length || pool.length < 3) return 0;
  const N = 100;
  let hits = 0;
  for (let t = 0; t < N; t++){
    const sh = shuffle(pool);
    let offset = 0, found = false;
    for (const n of sizes){
      if (partCanTrips(sh.slice(offset, offset + n))){ found = true; break; }
      offset += n;
    }
    if (found) hits++;
  }
  return hits / N;
}

// 三个点数是否构成顺子（A23 视为最小顺子）
function isStraightRanks(rs){
  const sorted = rs.slice().sort((x, y) => x - y);
  const low = sorted.map(r => r === 14 ? 1 : r).sort((x, y) => x - y);
  return (sorted[2] === sorted[1] + 1 && sorted[1] === sorted[0] + 1) ||
         (low[2] === low[1] + 1 && low[1] === low[0] + 1);
}

// 一组牌中指定牌型的最强组合的牌力评分（scoreEval 口径），无法组成则返回 null。
// 用于离线生成胜率表与后续调参；王按能构成的最大牌型取值。
function bestPowerOfType(cards, type){
  const naturals = cards.filter(c => !isJoker(c));
  const jokers = cards.filter(isJoker);
  const nJ = jokers.length;
  const rankCount = {};
  const suitRanks = [[], [], [], []];
  for (const c of naturals){
    rankCount[c.r] = (rankCount[c.r] || 0) + 1;
    suitRanks[c.s].push(c.r);
  }
  const ranks = Object.keys(rankCount).map(Number);
  for (let s = 0; s < 4; s++) suitRanks[s].sort((a, b) => b - a);

  if (type === 6){
    let bestRank = 0;
    for (const r of ranks){
      if (rankCount[r] >= 3 || (rankCount[r] >= 2 && nJ >= 1)) bestRank = Math.max(bestRank, r);
    }
    if (nJ >= 2 && naturals.length) bestRank = Math.max(bestRank, Math.max(...naturals.map(c => c.r)));
    return bestRank ? scoreEval({type: 6, points: [bestRank]}) : null;
  }

  if (type === 2){
    let bestSc = null;
    for (const r of ranks){
      if (rankCount[r] < 2) continue;
      let kicker = 0;
      for (const k of ranks) if (k !== r) kicker = Math.max(kicker, k);
      if (!kicker) continue; // 该点数之外没有散牌 → 不成对子
      const sc = scoreEval({type: 2, points: [r, kicker]});
      if (bestSc === null || sc > bestSc) bestSc = sc;
    }
    return bestSc;
  }

  if (type === 3){
    for (let top = 14; top >= 3; top--){
      const need = top === 3 ? [3, 2, 14] : [top, top - 1, top - 2];
      const present = need.filter(r => (rankCount[r] || 0) >= 1);
      const missing = 3 - present.length;
      if (missing > nJ) continue;
      if (missing === 0){
        // 三种点数都有自然牌：若每种都只有同一花色，则只会组成同花顺而非顺子
        const sets = need.map(r => suitRanks.map((arr, s) => arr.includes(r) ? s : -1).filter(s => s >= 0));
        const single = sets.map(arr => arr.length === 1 ? arr[0] : -1);
        if (single.every(s => s !== -1) && new Set(single).size === 1) continue;
      }
      return scoreEval({type: 3, points: [top]});
    }
    return null;
  }

  if (type === 5){
    let bestTop = 0;
    for (let s = 0; s < 4; s++){
      const rs = suitRanks[s];
      if (rs.length + nJ < 3) continue;
      const rsSet = new Set(rs);
      for (let top = 14; top >= 3; top--){
        const need = top === 3 ? [3, 2, 14] : [top, top - 1, top - 2];
        const present = need.filter(r => rsSet.has(r)).length;
        if (3 - present <= nJ){ bestTop = Math.max(bestTop, top); break; }
      }
    }
    return bestTop ? scoreEval({type: 5, points: [bestTop]}) : null;
  }

  if (type === 4){
    let bestSc = null;
    const consider = pts => {
      const sc = scoreEval({type: 4, points: pts});
      if (bestSc === null || sc > bestSc) bestSc = sc;
    };
    for (let s = 0; s < 4; s++){
      const rs = suitRanks[s];
      if (rs.length + nJ < 3) continue;
      // 无王：从高到低找第一个非顺子的三张同花自然牌
      outerNat:
      for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++)
          for (let k = j + 1; k < rs.length; k++){
            const pts = [rs[i], rs[j], rs[k]];
            if (!isStraightRanks(pts)){ consider(pts); break outerNat; }
          }
      // 1张王：两张同花自然牌 + 王补一个点数
      if (nJ >= 1){
        outerJ1:
        for (let i = 0; i < rs.length; i++)
          for (let j = i + 1; j < rs.length; j++){
            for (let r = 14; r >= 2; r--){
              if (r === rs[i] || r === rs[j]) continue;
              const pts = [rs[i], rs[j], r].sort((x, y) => y - x);
              if (!isStraightRanks(pts)){ consider(pts); break outerJ1; }
            }
          }
      }
      // 2张王：一张同花自然牌 + 双王补两个点数
      if (nJ >= 2 && rs.length){
        outerJ2:
        for (let r1 = 14; r1 >= 2; r1--){
          if (r1 === rs[0]) continue;
          for (let r2 = r1 - 1; r2 >= 2; r2--){
            if (r2 === rs[0]) continue;
            const pts = [rs[0], r1, r2].sort((x, y) => y - x);
            if (!isStraightRanks(pts)){ consider(pts); break outerJ2; }
          }
        }
      }
    }
    return bestSc;
  }

  // type 1 单张：王会提升为对子以上牌型，不参与单张组合
  let bestSc = null;
  const sorted = naturals.slice().sort((a, b) => b.r - a.r || a.s - b.s);
  const scan = arr => {
    for (const idx of subsetsIdx(arr.length, 3)){
      const ev = evalNatural3(idx.map(i => arr[i]));
      if (ev.type === 1){
        const sc = scoreEval(ev);
        if (bestSc === null || sc > bestSc) bestSc = sc;
      }
    }
  };
  scan(sorted.slice(0, 8)); // 通常前8张即含最优单张
  if (bestSc === null && sorted.length >= 3) scan(sorted); // 极端情况全量枚举
  return bestSc;
}

// 静态表查分位：牌力 < power 在分布中的占比（0..1）
function percentileBelow(dist, power){
  if (!dist || !dist.length) return 0.5;
  if (power <= dist[0]) return 0;
  if (power > dist[dist.length - 1]) return 1;
  for (let i = 1; i < dist.length; i++){
    if (power <= dist[i]){
      const lo = dist[i - 1], hi = dist[i];
      const f = hi > lo ? (power - lo) / (hi - lo) : 1;
      return Math.min(1, (i - 1 + f) / (dist.length - 1));
    }
  }
  return 1;
}

// 二阶段胜率估算：查静态表，各对手“最强有效组合 < 我的牌力”的概率相乘
function estimateWinRate(myEval, game, hand){
  const me = game.currentSeat !== undefined ? game.currentSeat : 0;
  const opps = [0, 1, 2].filter(s => s !== me && game.hands[s].length > 0);
  if (!opps.length) return 1;
  const myPower = scoreEval(myEval);
  let p = 1;
  for (const s of opps){
    const cell = P2_TABLE[game.hands[s].length];
    p *= cell ? percentileBelow(cell[myEval.type], myPower) : 0.5;
  }
  return p;
}

// 牌池中指定牌型可能组合数（数到 limit 即停；用于无效回收赌博判断）
function countPossibleValid(pool, type, limit){
  limit = limit || 2;
  let n = 0;
  for (const idx of subsetsIdx(pool.length, 3)){
    const ev = evalHand3(idx.map(i => pool[i]));
    if (ev.type === type && ++n >= limit) return n;
  }
  return n;
}

// 手牌中最优（花色最大）的非同花235
function best235Idx(hand){
  let best = null;
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evalHand3(idx.map(i => hand[i]));
    if (!ev.special235) continue;
    if (!best || cmpSuits(ev, best.ev) > 0) best = {idx, ev};
  }
  return best ? best.idx : null;
}

// 移除某组合后，剩余手牌的最强牌型与强牌组合数（牌型≥顺子）。
// evCache 可传入本决策内的三张牌评估缓存，剩余手牌组合通常是已评估过的子集。
function removalPotential(hand, idx, evCache){
  const keep = hand.filter((c, i) => !idx.includes(i));
  const keyOf = cs => cs.map(cardKey).sort().join('|');
  const evOf = cs => {
    const k = keyOf(cs);
    if (evCache){
      let ev = evCache.get(k);
      if (!ev){ ev = evalHand3(cs); evCache.set(k, ev); }
      return ev;
    }
    return evalHand3(cs);
  };
  let maxType = 0, strong = 0;
  for (const c of subsetsIdx(keep.length, 3)){
    const ev = evOf(c.map(i => keep[i]));
    if (ev.type > maxType) maxType = ev.type;
    if (ev.type >= 3) strong++;
  }
  return {maxType, strong};
}

// 手牌中指定牌型的所有组合
function combosOfType(hand, type){
  const list = [];
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evalHand3(idx.map(i => hand[i]));
    if (ev.type === type) list.push({idx, ev, sc: scoreEval(ev)});
  }
  return list;
}

// 必出阶段：量化决策
function ai1ChooseP1(hand, game){
  if (!game) return combosOfHand(hand).reduce((a, b) => a.sc >= b.sc ? a : b).idx;
  const me = game.currentSeat !== undefined ? game.currentSeat : 0;
  // 决策内三张牌评估缓存：组合枚举与拆牌代价共用，避免重复评估
  const evCache = new Map();
  const keyOf = cs => cs.map(cardKey).sort().join('|');
  const evOf = cs => {
    const k = keyOf(cs);
    let ev = evCache.get(k);
    if (!ev){ ev = evalHand3(cs); evCache.set(k, ev); }
    return ev;
  };
  // 终局加速：手牌≤6且不大于任何对手 → 出牌力最弱组合加速打空
  const otherLens = [0, 1, 2].filter(s => s !== me).map(s => game.hands[s].length);
  if (hand.length <= 6 && hand.length <= Math.min(...otherLens)){
    return combosOfHand(hand).reduce((a, b) => a.sc <= b.sc ? a : b).idx;
  }
  // 枚举全部候选（含235标记），等价于 analyzeHand，但结果写入 evCache
  const combos = [];
  let has235 = false;
  for (const idx of subsetsIdx(hand.length, 3)){
    const ev = evOf(idx.map(i => hand[i]));
    const sc = scoreEval(ev);
    if (ev.special235) has235 = true;
    combos.push({idx, ev, sc});
  }
  const pool = poolOf(game, hand);
  // 235狙击：对手可能出三条 且 自己落后
  if (has235){
    const probThree = probAnyOpponentTrips(game, hand);
    const myScore = game.piles[me] || 0;
    const maxScore = Math.max(...game.piles);
    const trailing = myScore < maxScore;
    const needSnipe = (myScore < maxScore - 10) || (trailing && hand.length <= 9);
    if (probThree >= 0.20 && needSnipe){
      const idx = best235Idx(hand);
      if (idx) return idx;
    }
  }
  // 三条安全过滤：对手仍可能持235且进入中后期 → 剔除三条候选（除非只剩三条可选）
  let candidates = combos;
  if (countPossible235(pool) > 0 && pool.length <= 30){
    const nonTrips = candidates.filter(c => c.ev.type !== 6);
    if (nonTrips.length) candidates = nonTrips;
  }
  candidates = candidates.slice().sort((a, b) => b.sc - a.sc);
  // 保底：过滤后全为对子/单张 → 直接出牌力最大组合
  if (candidates.every(c => c.ev.type <= 2)) return candidates[0].idx;
  // 择优与拆牌代价：前3名中，牌力相差不超过5%时优先选拆牌后潜力更好的
  const top = candidates.slice(0, 3);
  const topSc = top[0].sc;
  let best = null, bestPot = null;
  for (const c of top){
    if (c.sc < topSc * 0.95) continue;
    const pot = removalPotential(hand, c.idx, evCache);
    const better = bestPot === null ||
      pot.maxType > bestPot.maxType ||
      (pot.maxType === bestPot.maxType && pot.strong > bestPot.strong) ||
      (pot.maxType === bestPot.maxType && pot.strong === bestPot.strong && c.sc > best.sc);
    if (better){ best = c; bestPot = pot; }
  }
  return best ? best.idx : candidates[0].idx;
}

// 追加阶段：参与决策
function ai1ChooseP2Join(hand, game){
  const me = game.currentSeat !== undefined ? game.currentSeat : 0;
  const others = [0, 1, 2].filter(s => s !== me);
  const race = !game.firstEmpty && hand.length <= Math.min(...others.map(s => game.hands[s].length));
  const valid = combosOfType(hand, game.requiredType);
  if (valid.length){
    const myBest = valid.reduce((a, b) => a.sc >= b.sc ? a : b);
    const winProb = estimateWinRate(myBest.ev, game, hand);
    if (winProb >= 0.50) return true;
    if (hand.length <= 6 && race && winProb >= 0.30) return true;
    return false;
  }
  // 无有效组合：无效回收赌博（同花/顺子/同花顺 且几乎无人有 且 可能率先打空）
  const t = game.requiredType;
  if ((t === 3 || t === 4 || t === 5) &&
      countPossibleValid(poolOf(game, hand), t, 2) <= 1 &&
      hand.length <= 6 && race){
    return true;
  }
  return false;
}

// 追加阶段：出牌（有效组合出最强；否则出最不破坏强牌的废牌）
function ai1ChooseP2Cards(hand, game){
  const valid = combosOfType(hand, game.requiredType);
  if (valid.length) return valid.reduce((a, b) => a.sc >= b.sc ? a : b).idx;
  const sets = protectedSetsOf(hand, true, false);
  return weakestAllowedAny(combosOfHand(hand), sets).idx;
}

/* ================= 电脑AI：策略 ai-2（Bot Strategy Guide v1.0） ================= */

// 含王组合（核武器A）：牌力最大者（combos 由调用方预先枚举一次）
function ai2BestJokerCombo(combos, hand){
  let best = null;
  for (const c of combos){
    if (!c.idx.some(i => isJoker(hand[i]))) continue;
    if (!best || c.sc > best.sc) best = c;
  }
  return best;
}

// 含王三条（核武器A 的三条形态）
function ai2BestJokerTrip(combos, hand){
  let best = null;
  for (const c of combos){
    if (c.ev.type !== 6 || !c.idx.some(i => isJoker(hand[i]))) continue;
    if (!best || c.sc > best.sc) best = c;
  }
  return best;
}

// 非同花235（核武器B）：花色最优者
function ai2Best235(combos){
  let best = null;
  for (const c of combos){
    if (!c.ev.special235) continue;
    if (!best || cmpSuits(c.ev, best.ev) > 0) best = c;
  }
  return best;
}

// 不含王的普通三条：牌力最大者
function ai2NaturalTrip(combos, hand){
  let best = null;
  for (const c of combos){
    if (c.ev.type !== 6 || c.idx.some(i => isJoker(hand[i]))) continue;
    if (!best || c.sc > best.sc) best = c;
  }
  return best;
}

// 垫牌（指南A4/B5）：常规牌组（无王、非同花235）中价值最低的单张。
// 常规列表已排除235组合，天然避免意外打出235；若无单张可用则退回最弱组合。
function ai2DiscardLowest(combos, hand){
  const normal = combos.filter(c =>
    !c.ev.special235 && !c.idx.some(i => isJoker(hand[i])));
  const singles = normal.filter(c => c.ev.type === 1);
  if (singles.length){
    singles.sort((a, b) => a.sc - b.sc);
    return singles[0].idx;
  }
  const noJoker = combos.filter(c => !c.idx.some(i => isJoker(hand[i])));
  if (noJoker.length) return noJoker.reduce((a, b) => a.sc <= b.sc ? a : b).idx;
  return combos.reduce((a, b) => a.sc <= b.sc ? a : b).idx;
}

// 必出阶段：按指南阶段一/二决策
function ai2ChooseP1(hand, game){
  if (!game) return combosOfHand(hand).reduce((a, b) => a.sc >= b.sc ? a : b).idx;
  const combos = combosOfHand(hand); // 一次性枚举，各判定共用
  const s235 = ai2Best235(combos);
  const jokerTrip = ai2BestJokerTrip(combos, hand);
  const natTrip = ai2NaturalTrip(combos, hand);

  if (game.round === 0){
    // 步骤A：第一回合
    if (s235) return s235.idx;                        // A2：直接打235
    const joker = ai2BestJokerCombo(combos, hand);
    if (joker) return joker.idx;                      // A3：王组成最强组合打出
    return ai2DiscardLowest(combos, hand);            // A4：垫牌
  }

  // 步骤B：非第一回合
  if (s235){
    if (hand.length === 3) return ai2DiscardLowest(combos, hand); // B2：最后一回合不打235
    return s235.idx;                                      // B2：直接打出
  }
  // B3：含王三条只在“点数严格高于”最大自然三条时打出；
  // 同点数时保留王、打自然三条（对应指南“拆开王”的意图，避免浪费王）。
  if (jokerTrip && (!natTrip || jokerTrip.ev.points[0] > natTrip.ev.points[0])){
    return jokerTrip.idx;
  }
  // B3 失败：保留王（王组合留待后续回合/二阶段），继续处理普通三条
  if (natTrip){
    // B4：普通三条。中期（手牌>6）直接打；后期若对手仍可能持235则拆掉垫牌
    const can235 = countPossible235(poolOf(game, hand)) > 0;
    if (hand.length > 6 || !can235) return natTrip.idx; // B4a：收益大于风险 / 安全
    return ai2DiscardLowest(combos, hand);              // B4b：拆三条垫牌
  }
  return ai2DiscardLowest(combos, hand); // B5：垫牌
}

// 追加阶段：参与决策
function ai2ChooseP2Join(hand, game){
  const me = game.currentSeat !== undefined ? game.currentSeat : 0;
  const others = [0, 1, 2].filter(s => s !== me);
  const race = !game.firstEmpty && hand.length <= Math.min(...others.map(s => game.hands[s].length));
  const valid = combosOfType(hand, game.requiredType);
  if (valid.length){
    const myBest = valid.reduce((a, b) => a.sc >= b.sc ? a : b);
    if (hand.length === 3) return true; // 例外：只剩3张且符合牌型 → 必参与
    // 条件1：输掉3张不会严重破坏后续牌型（不拆保护组合）
    if (splitsProtection(myBest.idx, protectedSetsOf(hand, true, false))) return false;
    // 条件2：符合requiredType的最强组合能排进该牌型前50%（按对手分布分位）
    return estimateWinRate(myBest.ev, game, hand) >= 0.50;
  }
  // 无有效组合：极差手牌参与无效出牌（手牌=3可打空抢基础分；或可能率先打空）
  if (hand.length === 3) return true;
  return hand.length <= 6 && race;
}

// 追加阶段：出牌（有效组合出最强；无有效组合出最不破坏强牌的废牌）
function ai2ChooseP2Cards(hand, game){
  const valid = combosOfType(hand, game.requiredType);
  if (valid.length) return valid.reduce((a, b) => a.sc >= b.sc ? a : b).idx;
  const sets = protectedSetsOf(hand, true, false);
  return weakestAllowedAny(combosOfHand(hand), sets).idx;
}

const STRATEGY_LIB = {
  '1-1': {
    name: '策略1-1（原启发式）',
    desc: '必出阶段出牌力最强组合；追加阶段能组要求牌型时60%参与',
    chooseP1(hand){
      const combos = subsetsIdx(hand.length, 3);
      let bestIdx = [], bestSc = -1;
      for (const idx of combos){
        const e = evalHand3(idx.map(i => hand[i]));
        const sc = scoreEval(e);
        if (sc > bestSc){ bestSc = sc; bestIdx = [idx]; }
        else if (sc === bestSc) bestIdx.push(idx);
      }
      return bestIdx[Math.floor(Math.random() * bestIdx.length)];
    },
    chooseP2Join(hand, game){
      if (hand.length === 3){
        if (!game.firstEmpty) return true;
        return aiBestValid(hand, game.requiredType) !== null && Math.random() < 0.5;
      }
      const idx = aiBestValid(hand, game.requiredType);
      if (!idx) return false;
      return Math.random() < 0.6;
    },
    chooseP2Cards(hand, game){ return aiChooseP2Cards(hand, game.requiredType); }
  },
  '2-1': {
    name: '策略2-1（用户定义）',
    desc: '235优先→绝对大判断→前三回合保守→三回合外出最大；剩3张按局面参与',
    chooseP1(hand, game){
      const A = analyzeHand(hand);
      if (A.s235) return A.s235.idx;                       // 规则1：有非同花235先出235
      if (!game || !A.best) return A.best ? A.best.idx : (A.combos[0] && A.combos[0].idx);
      if (game.round + 1 > 3) return A.best.idx;           // 规则4：三回合外直接出最大手牌
      const pool = poolOf(game, hand);
      // 池子≥29张时必有某点数出现3张（三条），我的牌若不是三条则不可能绝对大
      if (pool.length >= 29 && A.best.ev.type <= 5){
        return weakestPreserving(hand, A).idx;             // 规则3：前三回合保守出牌
      }
      const poolBest = bestComboInPool(pool, true);        // 规则2：绝对大判断（排除235）
      if (!poolBest || cmpFull(A.best.ev, poolBest) > 0) return A.best.idx;
      return weakestPreserving(hand, A).idx;               // 规则3：前三回合保守出牌
    },
    chooseP2Join(hand, game){
      if (hand.length === 3) return joinThreeCards(hand, game);
      const idx = aiBestValid(hand, game.requiredType);
      if (!idx) return false;
      return Math.random() < 0.6;
    },
    chooseP2Cards(hand, game){ return aiChooseP2Cards(hand, game.requiredType); }
  },
  '2-2': {
    name: '策略2-2（用户定义）',
    desc: '对手可能235时出第二大单张；否则绝对大打最大，不确定时控牌型争取第二阶段；追加阶段顺位≥10才参与',
    chooseP1(hand, game){
      if (!game){
        return combosOfHand(hand).reduce((a, b) => a.sc >= b.sc ? a : b).idx;
      }
      const pool = poolOf(game, hand);
      const sets = protectedSetsOf(hand, true, false);       // 保护：三条+同花顺
      // 规则1：对手可能有非同花235 → 出第二大单张
      if (poolCan235(pool)){
        const idx = secondLargestSingle(hand, sets);
        if (idx) return idx;
      }
      return controlChooseP1(hand, game);                    // 规则2-4
    },
    chooseP2Join(hand, game){
      if (hand.length === 3) return joinThreeCards(hand, game);
      const sets = protectedSetsOf(hand, false, true);       // 保护：三条+同花
      const mine = combosOfHand(hand);
      const best = bestAllowedOfType(mine, game.requiredType, sets);
      return !!best && best.ev.points[0] >= 10;              // 顺位≥10的符合牌型才参与
    },
    chooseP2Cards(hand, game){
      const sets = protectedSetsOf(hand, false, true);
      const mine = combosOfHand(hand);
      const best = bestAllowedOfType(mine, game.requiredType, sets);
      return best ? best.idx : aiChooseP2Cards(hand, game.requiredType);
    }
  },
  '3-1': {
    name: '策略3-1（用户定义）',
    desc: '第一回合出第二大单张并必参与二阶段；之后按上回合对手必出牌型分情况：强牌控牌型争二阶段，弱牌出最大',
    chooseP1(hand, game){
      if (!game){
        return combosOfHand(hand).reduce((a, b) => a.sc >= b.sc ? a : b).idx;
      }
      const sets = protectedSetsOf(hand, true, false);       // 保护：三条+同花顺
      if (game.round === 0){
        // 第一回合：出第二顺位大的单张（不拆三条/同花顺）
        const idx = secondLargestSingle(hand, sets);
        return idx || weakestAllowedAny(combosOfHand(hand), sets).idx;
      }
      // 后续回合：按上回合第一阶段其他两位玩家的出牌分情况
      const others = [0, 1, 2].filter(s => s !== game.currentSeat);
      const prev = game.lastRoundP1 || [];
      const prevCards = others.map(s => prev[s]).filter(Boolean);
      let case1 = false, case2 = false;
      if (prevCards.length){
        const types = prevCards.map(cs => evalHand3(cs).type);
        case1 = types.some(t => t === 6 || t === 5);         // 有人出三条或同花顺
        case2 = types.every(t => t === 2 || t === 1);        // 都是对子或单张
      }
      if (case1 || !case2){
        // 情况1（或数据缺失/出现顺子同花等中间牌型）：绝对大→控牌型
        return controlChooseP1(hand, game);
      }
      // 情况2：出非三条/同花顺中顺位最大的牌；手牌全为三条/同花顺则出全局最大
      const mine = combosOfHand(hand);
      if (allTripsOrSF(hand)) return mine.reduce((a, b) => a.sc >= b.sc ? a : b).idx;
      let bestAllowed = null;
      for (const tp of [4, 3, 2, 1]){
        const b = bestAllowedOfType(mine, tp, sets);
        if (b && (!bestAllowed || b.sc > bestAllowed.sc)) bestAllowed = b;
      }
      return bestAllowed ? bestAllowed.idx : mine.reduce((a, b) => a.sc >= b.sc ? a : b).idx;
    },
    chooseP2Join(hand, game){
      if (hand.length === 3) return joinThreeCards(hand, game);
      if (game.round === 0) return true;                     // 第一回合必参与第二阶段
      const sets = protectedSetsOf(hand, true, false);       // 保护：三条+同花顺
      const mine = combosOfHand(hand);
      const best = bestAllowedOfType(mine, game.requiredType, sets);
      return !!best && best.ev.points[0] > 10;               // 牌型大于10才参与
    },
    chooseP2Cards(hand, game){
      const sets = protectedSetsOf(hand, true, false);
      const mine = combosOfHand(hand);
      const best = bestAllowedOfType(mine, game.requiredType, sets);
      return best ? best.idx : aiChooseP2Cards(hand, game.requiredType);
    }
  },
  'ai-1': {
    name: '策略ai-1（量化专家）',
    desc: '235狙击/三条过滤/拆牌代价；二阶段胜率静态表估算参与',
    chooseP1: ai1ChooseP1,
    chooseP2Join: ai1ChooseP2Join,
    chooseP2Cards: ai1ChooseP2Cards
  },
  'ai-2': {
    name: '策略ai-2（Bot指南）',
    desc: '核武器(王/235)优先、首回合垫牌、三条分阶段处理；二阶段按前50%参与',
    chooseP1: ai2ChooseP1,
    chooseP2Join: ai2ChooseP2Join,
    chooseP2Cards: ai2ChooseP2Cards
  }
};

function getStrategy(key){ return STRATEGY_LIB[key] || STRATEGY_LIB['2-1']; }
function randomStrategyKey(){
  const keys = Object.keys(STRATEGY_LIB);
  return keys[Math.floor(Math.random() * keys.length)];
}

// 调度器：按该座位本局随机抽到的策略执行；座位缺省取当前行动座位
function aiChooseP1(hand, game, seat){
  const s = seat !== undefined ? seat : (game ? game.currentSeat : 0);
  const key = game && game.seatStrategies ? game.seatStrategies[s] : '2-1';
  return getStrategy(key).chooseP1(hand, game);
}

function aiChooseP2Join(hand, game, seat){
  const s = seat !== undefined ? seat : (game ? game.currentSeat : 0);
  const key = game && game.seatStrategies ? game.seatStrategies[s] : '2-1';
  return getStrategy(key).chooseP2Join(hand, game);
}

function aiBestValid(hand, requiredType){
  let bestIdx = null, bestSc = -1;
  for (const idx of subsetsIdx(hand.length, 3)){
    const e = evalHand3(idx.map(i => hand[i]));
    if (e.type !== requiredType) continue;
    const sc = scoreEval(e);
    if (sc > bestSc){ bestSc = sc; bestIdx = idx; }
  }
  return bestIdx;
}

function aiChooseP2Cards(hand, requiredType){
  const idx = aiBestValid(hand, requiredType);
  if (idx) return idx;
  const all = subsetsIdx(hand.length, 3);
  return all[Math.floor(Math.random() * all.length)];
}

/* ================= 导出 ================= */

const api = {
  RANK_STR, SUIT_CHARS, TYPE_NAMES, TYPE_NUMS,
  isJoker, makeDeck, shuffle, cardName, cardIsRed, cardKey, compareCards,
  evalNatural3, isSpecial235, evalHand3,
  cmpHands, cmpFull, rankHands,
  subsetsIdx, scoreEval, bestComboInPool,
  Game, aiChooseP1, aiBestValid, aiChooseP2Join, aiChooseP2Cards,
  countPossible235, bestPowerOfType, estimateWinRate, probAnyOpponentTrips,
  countPossibleValid, combosOfType,
  STRATEGY_LIB, getStrategy, randomStrategyKey,
  setLang, getLang, typeName
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.GameEngine = api;
