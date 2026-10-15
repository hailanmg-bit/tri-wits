/* 经典风牌面。尺寸由 width 决定，内部全部用 em 缩放（1em = 宽度 / 4）。 */
import { Card as CardT, RANK_STR, isJoker } from '../engine';

export const SUIT_PATHS = [
  'M12 2C9 6 3.5 9.2 3.5 13.3c0 2.6 2 4.6 4.5 4.6 1.4 0 2.5-.6 3.2-1.5-.3 2.2-1.2 3.7-2.7 5.1h7c-1.5-1.4-2.4-2.9-2.7-5.1.7.9 1.8 1.5 3.2 1.5 2.5 0 4.5-2 4.5-4.6C20.5 9.2 15 6 12 2z',
  'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.7 1.3 5.4 3.3 1.7-2 3.2-3.3 5.4-3.3 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z',
  'M12 2.5a4.2 4.2 0 0 0-3.9 5.8A4.2 4.2 0 1 0 10.9 15c-.3 2.6-1.2 4.3-2.9 6h8c-1.7-1.7-2.6-3.4-2.9-6a4.2 4.2 0 1 0 2.8-6.7A4.2 4.2 0 0 0 12 2.5z',
  'M12 2l7.5 10L12 22 4.5 12z'
];
const STAR = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z';
const SUIT_NAMES = ['spades', 'hearts', 'clubs', 'diamonds'];

export function cardLabel(c: CardT): string {
  if (isJoker(c)) return c.w === 1 ? 'Big joker' : 'Small joker';
  return RANK_STR[c.r] + ' of ' + SUIT_NAMES[c.s];
}

interface Props {
  card?: CardT | null;
  width: number;
  faceDown?: boolean;
  selected?: boolean;
  dim?: boolean;
  class?: string;
  style?: Record<string, string | number>;
}

export function CardView({ card, width, faceDown, selected, dim, class: cls, style }: Props) {
  const base = {
    width: width + 'px',
    height: Math.round(width * 1.4375) + 'px',
    fontSize: width / 4 + 'px',
    ...style
  };
  if (faceDown || !card) {
    return <div class={'card back ' + (cls || '')} style={base} aria-hidden="true"><i /></div>;
  }
  const red = isJoker(card) ? card.w === 1 : card.s === 1 || card.s === 3;
  const classes = ['card', 'face', red ? 'red' : 'black', selected ? 'sel' : '', dim ? 'dim' : '', cls || ''].join(' ');
  if (isJoker(card)) {
    return (
      <div class={classes + ' joker'} style={base}>
        <span class="jk-word">JOKER</span>
        <svg class="pip-big" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} /></svg>
      </div>
    );
  }
  return (
    <div class={classes} style={base}>
      <span class="rank">{RANK_STR[card.r]}</span>
      <svg class="pip-sm" viewBox="0 0 24 24" aria-hidden="true"><path d={SUIT_PATHS[card.s]} /></svg>
      <svg class="pip-big" viewBox="0 0 24 24" aria-hidden="true"><path d={SUIT_PATHS[card.s]} /></svg>
    </div>
  );
}
