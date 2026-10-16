/* 音效：全部用 WebAudio 实时合成，不依赖音频文件；震动走 navigator.vibrate（打包后换成 Capacitor Haptics） */
import { store } from './store';
import { nativeBuzz } from './native';

export type Sfx =
  | 'select' | 'deselect' | 'button' | 'deal' | 'play' | 'botPlay' | 'flip'
  | 'winMe' | 'winOther' | 'phase2' | 'invalid' | 'tick' | 'tickLast' | 'out' | 'gameWin' | 'gameLose';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** 浏览器要求在用户手势里恢复音频；在第一次点击时调用 */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

interface ToneOpts { f: number; f2?: number; dur: number; at?: number; type?: OscillatorType; gain?: number; attack?: number }

function tone(c: AudioContext, { f, f2, dur, at = 0, type = 'sine', gain = 0.3, attack = 0.005 }: ToneOpts) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master!);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** 带通噪声：纸牌摩擦、落桌 */
function swish(c: AudioContext, { at = 0, dur = 0.08, freq = 1800, q = 0.9, gain = 0.35 }: { at?: number; dur?: number; freq?: number; q?: number; gain?: number }) {
  const t0 = c.currentTime + at;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t0);
  bp.frequency.exponentialRampToValueAtTime(freq * 0.6, t0 + dur);
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bp).connect(g).connect(master!);
  s.start(t0, Math.random() * 0.3);
  s.stop(t0 + dur + 0.02);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

const RECIPES: Record<Sfx, (c: AudioContext) => void> = {
  select: c => { tone(c, { f: 900, f2: 1250, dur: 0.06, type: 'triangle', gain: 0.18 }); swish(c, { dur: 0.04, freq: 3000, gain: 0.12 }); },
  deselect: c => tone(c, { f: 700, f2: 480, dur: 0.07, type: 'triangle', gain: 0.14 }),
  button: c => tone(c, { f: 520, f2: 640, dur: 0.06, type: 'triangle', gain: 0.16 }),
  deal: c => { for (let i = 0; i < 9; i++) swish(c, { at: i * 0.045, dur: 0.05, freq: 2200 + Math.random() * 800, gain: 0.16 }); },
  play: c => { [0, 0.05, 0.1].forEach(at => swish(c, { at, dur: 0.09, freq: 1400, gain: 0.32 })); tone(c, { f: 160, f2: 90, dur: 0.12, at: 0.1, gain: 0.25 }); },
  botPlay: c => { swish(c, { dur: 0.08, freq: 1300, gain: 0.18 }); tone(c, { f: 140, f2: 90, dur: 0.1, gain: 0.12 }); },
  flip: c => { [0, 0.07, 0.14].forEach(at => swish(c, { at, dur: 0.05, freq: 2800, q: 1.4, gain: 0.22 })); },
  winMe: c => { [C5, E5, G5].forEach((f, i) => { tone(c, { f, dur: 0.22, at: i * 0.08, type: 'triangle', gain: 0.22 }); tone(c, { f: f * 2, dur: 0.18, at: i * 0.08, gain: 0.06 }); }); },
  winOther: c => { tone(c, { f: 392, dur: 0.16, type: 'triangle', gain: 0.14 }); tone(c, { f: 330, dur: 0.22, at: 0.1, type: 'triangle', gain: 0.14 }); },
  phase2: c => {
    [392, 523.25].forEach((f, i) => { tone(c, { f, dur: 0.32, at: i * 0.12, type: 'sawtooth', gain: 0.07, attack: 0.02 }); tone(c, { f, dur: 0.32, at: i * 0.12, type: 'triangle', gain: 0.18, attack: 0.02 }); });
    tone(c, { f: C6, dur: 0.5, at: 0.24, gain: 0.07 });
  },
  invalid: c => { tone(c, { f: 220, f2: 150, dur: 0.18, type: 'square', gain: 0.08 }); tone(c, { f: 180, f2: 120, dur: 0.22, at: 0.12, type: 'square', gain: 0.08 }); },
  tick: c => tone(c, { f: 1250, dur: 0.035, type: 'sine', gain: 0.14 }),
  tickLast: c => tone(c, { f: 1700, dur: 0.05, type: 'sine', gain: 0.2 }),
  out: c => { [G5, C6, E5 * 2].forEach((f, i) => tone(c, { f, dur: 0.2, at: i * 0.06, gain: 0.1 })); },
  gameWin: c => { [C5, E5, G5, C6].forEach((f, i) => tone(c, { f, dur: i === 3 ? 0.6 : 0.2, at: i * 0.11, type: 'triangle', gain: 0.22 })); tone(c, { f: G5 * 2, dur: 0.6, at: 0.33, gain: 0.05 }); },
  gameLose: c => { [392, 311.13, 261.63].forEach((f, i) => tone(c, { f, dur: i === 2 ? 0.55 : 0.24, at: i * 0.16, type: 'triangle', gain: 0.18 })); }
};

export function sfx(name: Sfx, delayMs = 0): void {
  if (!store.get().sound) return;
  const run = () => {
    const c = audio();
    if (!c || c.state !== 'running') return;
    try { RECIPES[name](c); } catch { /* 音频节点异常不影响游戏 */ }
  };
  if (delayMs > 0) setTimeout(run, delayMs); else run();
}

export function buzz(pattern: number | number[]): void {
  if (!store.get().haptics) return;
  if (nativeBuzz(pattern)) return;
  try { navigator.vibrate?.(pattern); } catch { /* 不支持震动 */ }
}
