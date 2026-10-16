/* 电脑对手的性格台词，以及玩家可发的快捷语。每个场合两三句，随机挑一句。 */
import { getLang } from './i18n';

export type Moment = 'win' | 'bigWin' | 'lose' | 'join' | 'out' | 'gameWin' | 'gameLose' | 'reply';

type Lines = Record<Moment, string[]>;

/*
 * 阿凯（1-1）：阳光新手，冲动爱笑
 * 老周（2-1）：老牌友，慢条斯理，爱讲道理
 * 小豪（2-2）：嘴硬的年轻人，爱嘚瑟
 * 大壮（3-1）：大嗓门，直来直去
 * 苏博士（ai-1）：理性派，张口就是概率
 * 冷锋（ai-2）：话少，冷幽默
 */
const ZH: Record<string, Lines> = {
  '1-1': {
    win: ['嘿嘿，我的了！', '运气来了挡不住～'], bigWin: ['哇！我自己都不敢信！', '这手牌太爽了！'],
    lose: ['啊？就差一点！', '下把一定赢回来'], join: ['我也来！', '冲了冲了'],
    out: ['我出完啦！', '手里空啦，舒服～'], gameWin: ['我赢啦！再来一局？'], gameLose: ['输了…不过好好玩！'],
    reply: ['哈哈你也是！', '谢谢夸奖～', '别得意太早哦']
  },
  '2-1': {
    win: ['牌要慢慢打。', '稳一点，总没错。'], bigWin: ['老了，手气还行。', '这叫厚积薄发。'],
    lose: ['年轻人，有两下子。', '这把让你了。'], join: ['那我跟一手。', '陪你们走一趟。'],
    out: ['收工，先走一步。'], gameWin: ['姜还是老的辣。'], gameLose: ['后生可畏啊。'],
    reply: ['好，好。', '心态要稳。', '别急，慢慢来。']
  },
  '2-2': {
    win: ['就这？', '我早就看穿了。'], bigWin: ['服不服？', '这手你们拿什么接？'],
    lose: ['手气而已，别飘。', '下把让你见识见识。'], join: ['怕你啊？', '来就来！'],
    out: ['先走了，你们慢慢玩～'], gameWin: ['冠军就是我，没毛病。'], gameLose: ['今天状态不在…'],
    reply: ['少来这套', '嘴上说说谁不会', '呵呵，走着瞧']
  },
  '3-1': {
    win: ['拿来吧你！', '哈！痛快！'], bigWin: ['看见没！这才叫牌！', '吼！全都是我的！'],
    lose: ['气死我了！', '再来！我不服！'], join: ['干就完了！', '我上！'],
    out: ['哈哈，我先跑了！'], gameWin: ['赢了！今晚加鸡腿！'], gameLose: ['哎呀！下次一定！'],
    reply: ['你说啥？大点声！', '哈哈哈好！', '别光说，来真的！']
  },
  'ai-1': {
    win: ['和预期一致。', '概率站在我这边。'], bigWin: ['这种牌的出现概率不到 3%。', '数据不会说谎。'],
    lose: ['有意思，记下了。', '小概率事件而已。'], join: ['胜率过半，参与。', '这把值得算一算。'],
    out: ['计算完毕，先行离场。'], gameWin: ['结论：策略有效。'], gameLose: ['样本还不够，再来一局。'],
    reply: ['礼貌性回复：谢谢。', '情绪不影响胜率。', '有趣的观点。']
  },
  'ai-2': {
    win: ['嗯。', '归我了。'], bigWin: ['……正好。', '不意外。'],
    lose: ['可以。', '你赢了，这次。'], join: ['跟。', '来。'],
    out: ['走了。'], gameWin: ['还行。'], gameLose: ['下次。'],
    reply: ['……', '嗯。', '随你。']
  }
};

const EN: Record<string, Lines> = {
  '1-1': {
    win: ['Hehe, mine!', 'Lucky streak, baby!'], bigWin: ['Whoa, I can\'t believe it!', 'What a hand!'],
    lose: ['Aw, so close!', 'I\'ll win the next one!'], join: ['Count me in!', 'Let\'s go!'],
    out: ['I\'m out of cards!', 'Empty hand, feels great!'], gameWin: ['I won! One more?'], gameLose: ['Lost… but that was fun!'],
    reply: ['Haha, you too!', 'Thanks!', 'Don\'t get cocky!']
  },
  '2-1': {
    win: ['Slow and steady.', 'Patience pays.'], bigWin: ['Still got it.', 'Good things come to those who wait.'],
    lose: ['Not bad, youngster.', 'I\'ll let that one go.'], join: ['I\'ll follow.', 'Alright, I\'m in.'],
    out: ['I\'ll be heading off first.'], gameWin: ['Experience wins.'], gameLose: ['The young ones are sharp.'],
    reply: ['Good, good.', 'Keep calm.', 'No rush.']
  },
  '2-2': {
    win: ['That\'s it?', 'Saw it coming.'], bigWin: ['Beat that!', 'Read it and weep.'],
    lose: ['Just luck. Don\'t get used to it.', 'Watch me next round.'], join: ['Scared? Not me.', 'Bring it!'],
    out: ['Later, losers~'], gameWin: ['Champion. Obviously.'], gameLose: ['Off day, that\'s all…'],
    reply: ['Yeah, right.', 'Talk is cheap.', 'We\'ll see.']
  },
  '3-1': {
    win: ['Gimme that!', 'HA! Feels good!'], bigWin: ['See that?! THAT\'s a hand!', 'All mine!'],
    lose: ['ARGH!', 'Again! I\'m not done!'], join: ['Let\'s smash it!', 'I\'m going in!'],
    out: ['Haha, I\'m out first!'], gameWin: ['Victory! Chicken dinner!'], gameLose: ['Next time for sure!'],
    reply: ['WHAT? Louder!', 'Hahaha, yes!', 'Less talk, more cards!']
  },
  'ai-1': {
    win: ['As predicted.', 'The odds favor me.'], bigWin: ['Under 3% chance. Fascinating.', 'Data doesn\'t lie.'],
    lose: ['Interesting. Noted.', 'A low-probability event.'], join: ['Win rate above 50%. Joining.', 'Worth computing.'],
    out: ['Calculation complete. Leaving early.'], gameWin: ['Conclusion: strategy works.'], gameLose: ['Sample size too small. Again.'],
    reply: ['Polite reply: thank you.', 'Emotion doesn\'t change odds.', 'Interesting take.']
  },
  'ai-2': {
    win: ['Mm.', 'Mine.'], bigWin: ['…Right on time.', 'Not surprised.'],
    lose: ['Fine.', 'You win. This time.'], join: ['In.', 'Sure.'],
    out: ['Gone.'], gameWin: ['Not bad.'], gameLose: ['Next time.'],
    reply: ['…', 'Mm.', 'Whatever.']
  }
};

export function botLine(strategy: string | null, m: Moment, rnd: () => number = Math.random): string | null {
  const set = (getLang() === 'zh' ? ZH : EN)[strategy || ''];
  const list = set?.[m];
  return list && list.length ? list[Math.floor(rnd() * list.length)] : null;
}

/** 玩家的快捷语 */
export function quickChats(): string[] {
  return getLang() === 'zh'
    ? ['好牌！', '运气不错', '再来！', '稳了', '你们先请', '呵呵']
    : ['Nice hand!', 'Lucky!', 'Again!', 'Got this.', 'After you.', 'Heh.'];
}
