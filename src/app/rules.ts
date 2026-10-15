import type { Lang } from './i18n';

export const RULES: Record<Lang, { title: string; body: string }[]> = {
  en: [
    { title: 'Goal', body: 'Score = cards in your pile + a 5-point bonus for the first player to empty their hand.' },
    { title: 'Setup', body: '3 players, one 54-card deck with two jokers, 18 cards each.' },
    { title: 'Phase 1 — everyone plays', body: 'Each player with cards plays 3 face-down. All reveal at once; the strongest hand takes every card played.' },
    { title: 'Phase 2 — optional', body: 'Players choose to join; it opens with 2 or more. You must play the same type as the weakest Phase 1 hand. A different type is invalid. If every play is invalid, each player banks their own 3.' },
    { title: 'Hand types', body: 'Trips > Straight Flush > Flush > Straight > Pair > High Card. A-2-3 is the lowest straight, Q-K-A the highest; K-A-2 is not a straight.' },
    { title: 'Jokers', body: 'Wild: they become whatever makes the strongest hand. On a tie, Big Joker > Small Joker > none.' },
    { title: 'Off-suit 2-3-5', body: 'Counts as High Card. If Trips are in the same showdown, 2-3-5 beats everything; otherwise it is the weakest hand. If it wins Phase 1 this way, Phase 2 requires High Card.' },
    { title: 'Ties', body: 'Compare type, then ranks, then jokers, then suits: ♠ > ♥ > ♣ > ♦.' },
    { title: 'End', body: 'The game ends when one player or none holds cards. The last player’s remaining cards are split evenly into all three piles.' }
  ],
  zh: [
    { title: '目标', body: '得分 = 自己牌堆的张数 + 基础分；最先打空手牌的玩家得 5 分基础分（同一回合同一阶段打空可并列）。' },
    { title: '准备', body: '3 名玩家，一副 54 张（含大小王），每人 18 张。' },
    { title: '第一阶段（必出）', body: '有手牌的玩家各出 3 张盖牌，同时翻开，牌力最大者赢走全部出牌。' },
    { title: '第二阶段（自愿）', body: '玩家选择是否参与，2 人以上才开启。必须出与第一阶段最弱一手相同的牌型，牌型不符为无效；全部无效时，各家出的 3 张计入自己的牌堆。' },
    { title: '牌型', body: '三条 > 同花顺 > 同花 > 顺子 > 对子 > 单张。A23 是最小的顺子，QKA 最大，K-A-2 不算顺子。' },
    { title: '大小王', body: '万能牌，自动组成最大牌型。同牌型同点数时：大王 > 小王 > 无王。' },
    { title: '非同花 235', body: '属于单张。与三条同场时 235 最大（胜过一切），否则最小。若 235 以此在第一阶段获胜，第二阶段改为需出单张。' },
    { title: '比牌顺序', body: '牌型 → 点数 → 含王 → 花色（♠ > ♥ > ♣ > ♦）。' },
    { title: '结束', body: '只剩 1 人或无人持牌时结束；最后一人的剩余手牌平分进三家牌堆。' }
  ]
};
