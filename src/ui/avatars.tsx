/*
 * 头像库：全部用代码绘制的 SVG（viewBox 100×100，圆形裁切）。
 * 四种风格混排：人物肖像、动物、像素、徽章。电脑对手各有固定头像，玩家在建角色时挑选。
 */
import { JSX } from 'preact';

export type AvatarStyle = 'portrait' | 'animal' | 'pixel' | 'emblem';

interface Portrait {
  bg: string; skin: string; hair: string; shirt: string;
  cut: 'short' | 'buzz' | 'long' | 'bun' | 'curly' | 'side' | 'bald' | 'cap' | 'hood' | 'bob';
  glasses?: 'round' | 'shades'; beard?: boolean; brows?: 'calm' | 'sharp'; mouth?: 'smile' | 'grin' | 'flat';
  accent?: string; blush?: boolean;
}

const INK = '#1A1C22';

function portrait(p: Portrait): JSX.Element {
  const skinShade = shade(p.skin, -0.12);
  const hairBack = p.cut === 'long' || p.cut === 'bob' ? (
    p.cut === 'long'
      ? <path d="M28 46C28 24 38 17 50 17s22 7 22 29v36H28z" fill={p.hair} />
      : <path d="M29 48C29 26 38 19 50 19s21 7 21 29v14c0 4-3 6-6 6H35c-3 0-6-2-6-6z" fill={p.hair} />
  ) : p.cut === 'hood' ? <path d="M22 100V52C22 28 34 16 50 16s28 12 28 36v48z" fill={p.accent || p.shirt} /> : null;
  const hairTop = {
    short: <path d="M30 45C29 26 39 19 51 19c12 0 20 8 19 26-3-9-9-13-19-13-9 0-16 4-21 13z" fill={p.hair} />,
    buzz: <path d="M31 42c0-15 8-22 19-22s19 7 19 22c-4-7-11-10-19-10s-15 3-19 10z" fill={p.hair} />,
    long: <path d="M29 46c0-18 9-27 21-27s21 9 21 27c-6-10-12-14-21-14-7 0-14 5-21 14z" fill={p.hair} />,
    bun: <g fill={p.hair}><circle cx="50" cy="15" r="9" /><path d="M30 45C29 27 39 21 50 21s21 6 20 24c-4-9-10-13-20-13s-16 4-20 13z" /></g>,
    curly: <g fill={p.hair}>{[[34, 32], [42, 24], [51, 21], [60, 24], [67, 32], [31, 41], [69, 41]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.5" />)}</g>,
    side: <path d="M30 46C28 26 38 19 51 19c11 0 19 6 19 18-9-1-20 1-30 9-4 3-7 6-10 0z" fill={p.hair} />,
    bald: null,
    cap: <g><path d="M29 42c0-14 9-22 21-22s21 8 21 22z" fill={p.accent || '#C8323F'} /><path d="M50 40h27c3 0 3 4 0 4H50z" fill={shade(p.accent || '#C8323F', -0.2)} /><circle cx="50" cy="21" r="2.2" fill={shade(p.accent || '#C8323F', -0.2)} /></g>,
    hood: <path d="M30 48c0-16 8-25 20-25s20 9 20 25c-5-8-12-11-20-11s-15 3-20 11z" fill={p.hair} />,
    bob: <path d="M29 47c0-18 9-27 21-27s21 9 21 27c-5-7-9-10-13-11-3 4-10 6-17 6-5 0-9 2-12 5z" fill={p.hair} />
  }[p.cut];
  const eyes = p.glasses === 'shades'
    ? <g><rect x="35" y="43" width="13" height="8" rx="3" fill={INK} /><rect x="52" y="43" width="13" height="8" rx="3" fill={INK} /><path d="M48 46h4" stroke={INK} stroke-width="1.6" /></g>
    : <g fill={INK}><ellipse cx="42.5" cy="47.5" rx="2.2" ry="2.6" /><ellipse cx="57.5" cy="47.5" rx="2.2" ry="2.6" /></g>;
  const brows = p.glasses === 'shades' ? null : p.brows === 'sharp'
    ? <path d="M38 41.5l8 1.5M62 41.5l-8 1.5" stroke={shade(p.hair, -0.1)} stroke-width="2.2" stroke-linecap="round" />
    : <path d="M38.5 42.5c2-1.6 5-1.8 7.5-.8M54 41.7c2.5-1 5.5-.8 7.5.8" stroke={shade(p.hair, -0.1)} stroke-width="2" stroke-linecap="round" fill="none" />;
  const mouth = p.mouth === 'grin'
    ? <path d="M43 57c3 4 11 4 14 0z" fill={INK} />
    : p.mouth === 'flat'
      ? <path d="M45 58.5h10" stroke={INK} stroke-width="2" stroke-linecap="round" />
      : <path d="M44 56.5c3 3 9 3 12 0" stroke={INK} stroke-width="2" stroke-linecap="round" fill="none" />;
  return (
    <g>
      <rect width="100" height="100" fill={p.bg} />
      {hairBack}
      <path d="M14 100c0-20 15-30 36-30s36 10 36 30z" fill={p.shirt} />
      <path d="M43 60h14v12c0 4-14 4-14 0z" fill={skinShade} />
      <circle cx="31" cy="49" r="4.5" fill={skinShade} /><circle cx="69" cy="49" r="4.5" fill={skinShade} />
      <ellipse cx="50" cy="46" rx="19" ry="21.5" fill={p.skin} />
      {p.beard && <path d="M31.5 48c1 16 9 22 18.5 22s17.5-6 18.5-22c-3 6-7 7-10 7-3-2-5.5-2.5-8.5-2.5s-5.5.5-8.5 2.5c-3 0-7-1-10-7z" fill={p.hair} />}
      {p.blush && <g fill="#E8837A" opacity=".35"><circle cx="38" cy="54" r="3.5" /><circle cx="62" cy="54" r="3.5" /></g>}
      {eyes}{brows}{mouth}
      {p.glasses === 'round' && <g fill="none" stroke={INK} stroke-width="1.6"><circle cx="42.5" cy="47.5" r="6" /><circle cx="57.5" cy="47.5" r="6" /><path d="M48.5 47.5h3" /></g>}
      {hairTop}
    </g>
  );
}

/* ---------- 动物：几何扁平 ---------- */
const ANIMALS: Record<string, (bg: string) => JSX.Element> = {
  fox: bg => (
    <g><rect width="100" height="100" fill={bg} />
      <path d="M22 22l16 18M78 22L62 40" stroke="#C4572A" stroke-width="12" stroke-linecap="round" />
      <path d="M20 40c4-8 16-12 30-12s26 4 30 12L50 84z" fill="#E07A3F" />
      <path d="M20 40l30 44V58c-8-2-20-8-30-18zM80 40L50 84V58c8-2 20-8 30-18z" fill="#FBF1E6" />
      <circle cx="40" cy="48" r="3" fill={INK} /><circle cx="60" cy="48" r="3" fill={INK} /><circle cx="50" cy="80" r="4" fill={INK} /></g>
  ),
  owl: bg => (
    <g><rect width="100" height="100" fill={bg} />
      <path d="M22 30l10 8M78 30l-10 8" stroke="#6B4E3D" stroke-width="7" stroke-linecap="round" />
      <ellipse cx="50" cy="60" rx="30" ry="32" fill="#8A6A55" /><ellipse cx="50" cy="70" rx="17" ry="20" fill="#D9C2A5" />
      <circle cx="38" cy="46" r="11" fill="#FBF8F1" /><circle cx="62" cy="46" r="11" fill="#FBF8F1" />
      <circle cx="38" cy="46" r="5" fill={INK} /><circle cx="62" cy="46" r="5" fill={INK} />
      <path d="M46 56l4 7 4-7z" fill="#E2A33B" /></g>
  ),
  cat: bg => (
    <g><rect width="100" height="100" fill={bg} />
      <path d="M24 46L28 18l18 16M76 46L72 18 54 34" fill="#3B3F4A" />
      <ellipse cx="50" cy="56" rx="28" ry="25" fill="#3B3F4A" />
      <ellipse cx="40" cy="53" rx="4" ry="5" fill="#E9D36A" /><ellipse cx="60" cy="53" rx="4" ry="5" fill="#E9D36A" />
      <rect x="39" y="50" width="2" height="7" rx="1" fill={INK} /><rect x="59" y="50" width="2" height="7" rx="1" fill={INK} />
      <path d="M47 62h6l-3 3z" fill="#E8837A" />
      <path d="M30 63h-12M30 67l-11 3M70 63h12M70 67l11 3" stroke="#C9CCD3" stroke-width="1.4" stroke-linecap="round" /></g>
  ),
  panda: bg => (
    <g><rect width="100" height="100" fill={bg} />
      <circle cx="27" cy="30" r="10" fill={INK} /><circle cx="73" cy="30" r="10" fill={INK} />
      <ellipse cx="50" cy="56" rx="30" ry="27" fill="#FBF8F1" />
      <ellipse cx="38" cy="52" rx="7" ry="9" fill={INK} transform="rotate(-25 38 52)" /><ellipse cx="62" cy="52" rx="7" ry="9" fill={INK} transform="rotate(25 62 52)" />
      <circle cx="39" cy="51" r="2.3" fill="#FBF8F1" /><circle cx="61" cy="51" r="2.3" fill="#FBF8F1" />
      <ellipse cx="50" cy="65" rx="5" ry="3.5" fill={INK} /><path d="M45 71c3 3 7 3 10 0" stroke={INK} stroke-width="2" fill="none" stroke-linecap="round" /></g>
  ),
  bear: bg => (
    <g><rect width="100" height="100" fill={bg} />
      <circle cx="26" cy="32" r="11" fill="#7A4E32" /><circle cx="74" cy="32" r="11" fill="#7A4E32" /><circle cx="26" cy="32" r="5" fill="#B9845D" /><circle cx="74" cy="32" r="5" fill="#B9845D" />
      <ellipse cx="50" cy="56" rx="29" ry="27" fill="#8F5D3D" /><ellipse cx="50" cy="66" rx="13" ry="10" fill="#D7AE85" />
      <circle cx="39" cy="51" r="3" fill={INK} /><circle cx="61" cy="51" r="3" fill={INK} /><ellipse cx="50" cy="62" rx="5" ry="3.6" fill={INK} /></g>
  ),
  rabbit: bg => (
    <g><rect width="100" height="100" fill={bg} />
      <ellipse cx="38" cy="22" rx="7" ry="20" fill="#F1ECE4" /><ellipse cx="62" cy="22" rx="7" ry="20" fill="#F1ECE4" />
      <ellipse cx="38" cy="22" rx="3" ry="14" fill="#EDB3AE" /><ellipse cx="62" cy="22" rx="3" ry="14" fill="#EDB3AE" />
      <ellipse cx="50" cy="60" rx="26" ry="24" fill="#F1ECE4" />
      <circle cx="41" cy="56" r="3" fill={INK} /><circle cx="59" cy="56" r="3" fill={INK} /><path d="M47 64h6l-3 3z" fill="#E8837A" />
      <g fill="#E8837A" opacity=".35"><circle cx="35" cy="65" r="4" /><circle cx="65" cy="65" r="4" /></g></g>
  )
};

/* ---------- 像素：12×12 网格，字符映射颜色 ---------- */
const PIXEL: Record<string, { bg: string; pal: Record<string, string>; rows: string[] }> = {
  knight: { bg: '#2B3A55', pal: { a: '#C9CCD3', b: '#8C93A1', c: '#1A1C22', r: '#C8323F' }, rows: [
    '.....rr.....', '....rrr.....', '...aaaaaa...', '..aaaaaaaa..', '..abbbbbba..', '..accaacca..',
    '..abbbbbba..', '..aaaaaaaa..', '...abbbba...', '..aaaaaaaa..', '.aaaaaaaaaa.', '.aaaaaaaaaa.'] },
  robot: { bg: '#1F4F4A', pal: { a: '#E2C27E', b: '#9C7D3E', c: '#1A1C22', g: '#6FE3C1' }, rows: [
    '.....aa.....', '.....bb.....', '..aaaaaaaa..', '..abbbbbba..', '..abggbgga..', '..abbbbbba..',
    '..abcccbba..', '..aaaaaaaa..', '....abba....', '.aaaaaaaaaa.', '.abbaaaabba.', '.aaaaaaaaaa.'] },
  ghost: { bg: '#3D2E55', pal: { a: '#F3EEE2', c: '#1A1C22', p: '#E8837A' }, rows: [
    '............', '....aaaa....', '...aaaaaa...', '..aaaaaaaa..', '..acaaacaa..', '..acaaacaa..',
    '..aaaaaaaa..', '..apaaaapa..', '..aaaccaaa..', '..aaaaaaaa..', '..aaaaaaaa..', '..a.aa.aa.a.'] },
  frog: { bg: '#2E4A2A', pal: { a: '#7BC66A', b: '#4E9443', w: '#FBF8F1', c: '#1A1C22', p: '#C8323F' }, rows: [
    '............', '..ww....ww..', '.wccw..wccw.', '.wwww..wwww.', '.aaaaaaaaaa.', 'aaaaaaaaaaaa',
    'aaaaaaaaaaaa', 'abaaaaaaaaba', 'aappppppppaa', 'aaaaaaaaaaaa', '.bbbbbbbbbb.', '............'] }
};

function pixel(id: string): JSX.Element {
  const p = PIXEL[id];
  const cells: JSX.Element[] = [];
  p.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') cells.push(<rect key={x + '-' + y} x={14 + x * 6} y={16 + y * 6} width="6.2" height="6.2" fill={p.pal[ch]} />);
  }));
  return <g shape-rendering="crispEdges"><rect width="100" height="100" fill={p.bg} />{cells}</g>;
}

/* ---------- 徽章：花色与金环 ---------- */
const SUITS = [
  'M12 2C9 6 3.5 9.2 3.5 13.3c0 2.6 2 4.6 4.5 4.6 1.4 0 2.5-.6 3.2-1.5-.3 2.2-1.2 3.7-2.7 5.1h7c-1.5-1.4-2.4-2.9-2.7-5.1.7.9 1.8 1.5 3.2 1.5 2.5 0 4.5-2 4.5-4.6C20.5 9.2 15 6 12 2z',
  'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.7 1.3 5.4 3.3 1.7-2 3.2-3.3 5.4-3.3 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z',
  'M12 2.5a4.2 4.2 0 0 0-3.9 5.8A4.2 4.2 0 1 0 10.9 15c-.3 2.6-1.2 4.3-2.9 6h8c-1.7-1.7-2.6-3.4-2.9-6a4.2 4.2 0 1 0 2.8-6.7A4.2 4.2 0 0 0 12 2.5z',
  'M12 2l7.5 10L12 22 4.5 12z'
];

function emblem(suit: number, bg: string, fg: string): JSX.Element {
  return (
    <g><rect width="100" height="100" fill={bg} />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#E2C27E" stroke-width="3" />
      <circle cx="50" cy="50" r="28" fill="none" stroke="#E2C27E" stroke-width="1" stroke-dasharray="2 3" />
      <path d={SUITS[suit]} fill={fg} transform="translate(26 26) scale(2)" /></g>
  );
}

export interface AvatarDef { id: string; style: AvatarStyle; draw(): JSX.Element }

const P = (id: string, p: Portrait): AvatarDef => ({ id, style: 'portrait', draw: () => portrait(p) });

/** 头像库。前 6 个是电脑对手的固定头像，也开放给玩家选择 */
export const AVATARS: AvatarDef[] = [
  P('kai', { bg: '#E2C27E', skin: '#F2C9A0', hair: '#2B2420', shirt: '#2F6F8F', cut: 'side', mouth: 'grin', blush: true }),
  P('zhou', { bg: '#B9A88C', skin: '#E6B98F', hair: '#8E8A84', shirt: '#6B4E3D', cut: 'short', glasses: 'round', beard: true, mouth: 'flat' }),
  P('hao', { bg: '#7FA7C9', skin: '#E9BE93', hair: '#2B2420', shirt: '#C8323F', cut: 'cap', accent: '#1F3B5A', mouth: 'smile' }),
  P('zhuang', { bg: '#8C6BB1', skin: '#C98F63', hair: '#1A1C22', shirt: '#3E7C6B', cut: 'buzz', brows: 'sharp', mouth: 'grin' }),
  P('su', { bg: '#5E9C88', skin: '#F0C7A4', hair: '#1F1A17', shirt: '#F3EEE2', cut: 'bun', glasses: 'round', mouth: 'smile' }),
  P('frost', { bg: '#4A5160', skin: '#E3B48C', hair: '#C9CCD3', shirt: '#1A1C22', cut: 'hood', accent: '#2C3340', glasses: 'shades', mouth: 'flat' }),
  P('mei', { bg: '#E8A598', skin: '#F4CFB0', hair: '#4A2C22', shirt: '#2F6F8F', cut: 'long', mouth: 'smile', blush: true }),
  P('lena', { bg: '#C9D6A3', skin: '#8D5B3D', hair: '#1A1C22', shirt: '#E2C27E', cut: 'curly', mouth: 'grin' }),
  P('yuki', { bg: '#A8C3E0', skin: '#F6D8BE', hair: '#3B2B4F', shirt: '#C8323F', cut: 'bob', mouth: 'smile', blush: true }),
  P('omar', { bg: '#D9A55B', skin: '#B07850', hair: '#1A1C22', shirt: '#4F6D8A', cut: 'bald', beard: true, mouth: 'smile', brows: 'sharp' }),
  P('rosa', { bg: '#6E4A7E', skin: '#E7B790', hair: '#B5462E', shirt: '#F3EEE2', cut: 'long', glasses: 'round', mouth: 'smile' }),
  P('leo', { bg: '#3E7C6B', skin: '#F2C9A0', hair: '#C99A4A', shirt: '#1F3B5A', cut: 'short', mouth: 'grin' }),
  ...Object.keys(ANIMALS).map((id, i): AvatarDef => ({ id, style: 'animal', draw: () => ANIMALS[id](['#3E7C6B', '#2B3A55', '#E2C27E', '#7FA7C9', '#5E9C88', '#B9A88C'][i]) })),
  ...Object.keys(PIXEL).map((id): AvatarDef => ({ id, style: 'pixel', draw: () => pixel(id) })),
  { id: 'spade', style: 'emblem', draw: () => emblem(0, '#0F3D35', '#F3EEE2') },
  { id: 'heart', style: 'emblem', draw: () => emblem(1, '#0F3D35', '#C8323F') },
  { id: 'club', style: 'emblem', draw: () => emblem(2, '#1A1C22', '#E2C27E') },
  { id: 'diamond', style: 'emblem', draw: () => emblem(3, '#7E1F2B', '#F3EEE2') }
];

const BY_ID = new Map(AVATARS.map(a => [a.id, a]));

/** 电脑对手（按策略 key）的固定头像 */
export const BOT_AVATAR: Record<string, string> = { '1-1': 'kai', '2-1': 'zhou', '2-2': 'hao', '3-1': 'zhuang', 'ai-1': 'su', 'ai-2': 'frost' };

export const DEFAULT_AVATAR = 'leo';

export function AvatarArt({ id, size, ring }: { id: string; size: number; ring?: string }) {
  const a = BY_ID.get(id) || BY_ID.get(DEFAULT_AVATAR)!;
  const clip = 'av-' + a.id;
  return (
    <svg class="avatar-art" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}>
      <defs><clipPath id={clip}><circle cx="50" cy="50" r="50" /></clipPath></defs>
      <g clip-path={`url(#${clip})`}>{a.draw()}</g>
    </svg>
  );
}

/** 颜色明暗调整（amt -1..1） */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
