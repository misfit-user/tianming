// 进局时：第一回合展一卷「天下大势」（势力格局、显著矛盾、本人处境；初次还附「临朝须知」）；
// 没配推演之器（AI 密钥）时提醒一次，给个开典章的口子。须知的条目取身份档 guide。
import { h } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';
import { openSettings } from './settings.js';
import { homeMode } from '../core/settings.js';
import { guideOf } from '../model/identity.js';

const DIM = { political: '政', economic: '财', military: '军', social: '民' };
const SEEN_KEY = 'tm_ui_seen_guide';                         // 新前端自己的已读标记（老界面的首日引导进局时一弹就写了它自己的，那一张在新前端里看不见）
let shownFor = '';

// 势力名：「·」后、括注前可折行；没有这两处可折的长名（大越黎郑阮格局、虾夷地与松前氏），一段七字的收小一号、八字以上再收一号，不从词中间断开
function nameEl(name) {
  const parts = String(name).split(/(?<=·)|\s*(?=[（(])/);
  const longest = Math.max(...parts.map((x) => [...x].length));
  return h('b' + (longest >= 8 ? '.longer' : longest >= 7 ? '.long' : ''), parts.map((x) => h('span', x)));
}

export function showWelcome({ game, profile }) {
  const d = game.select.date();
  const configured = game.config.aiConfig('primary').configured;
  const nokey = () => {
    if (configured) return;
    juan({
      // 签上不写「AI」：题字体里拉丁字母是花体，竖排更认不得
      title: '密钥未配', note: '推演之器', width: '32rem',
      content: h('div', { style: { lineHeight: 2 } },
        h('p', { style: { margin: '0 0 .5rem' } }, '推演、来文、史记、问对都要靠 AI，眼下尚未配置密钥。'),
        h('p', { style: { margin: 0, color: 'var(--ink-soft)' } }, '此时可先翻看各册、批阅案牍、熟悉局势；到典章「推演之器」一卷填好密钥，即可推演。')),
      actions: [{ label: '开典章', onclick: ({ close }) => { close('ok'); openSettings({ tab: 'ai' }); } }]
    });
  };
  const key = `${d.turn}@${(game.perspective() || {}).name}`;
  if (d.turn !== 1 || shownFor === key) { nokey(); return; }
  shownFor = key;
  const s = game.select.situation();
  let firstTime = false;
  try { firstTime = !localStorage.getItem(SEEN_KEY); if (firstTime) localStorage.setItem(SEEN_KEY, '1'); } catch (_e) { firstTime = false; }
  const max = Math.max(100, ...s.factions.map((f) => f.strength));
  const guide = profile() ? guideOf(profile(), homeMode()) : [];
  const j = juan({
    title: '天下大势', note: d.text || '', width: '50rem', height: 'min(42rem, 84vh)',
    content: h('div.wel',
      s.player.name ? h('section.wel-me', h('b', s.player.name), h('span', [s.player.title, s.player.faction].filter(Boolean).join(' · ')), s.player.goal ? h('p', `所志：${s.player.goal}`) : null) : null,
      s.factions.length ? h('section', h('h5', '势力格局'), h('div.wel-facs', s.factions.map((f) => h('div.wel-fac' + (f.isPlayer ? '.me' : ''),
        // 名长的（瞿折罗·波罗底诃罗、荷兰·台海(东印度公司)）在「·」后、括注前折行，不从词中间断；首领名长的收成省略号，悬停看全
        nameEl(f.name), h('i', h('em', { style: { width: `${Math.round(f.strength / max * 100)}%` } })),
        h('small', { title: f.leader || '' }, `实力${num(f.strength)}${f.leader ? ' · ' + f.leader : ''}`))))) : null,
      s.contradictions.length ? h('section', h('h5', '显著矛盾'), s.contradictions.map((c) => h('p.wel-con', c.dimension ? h('em.' + c.dimension, DIM[c.dimension] || '事') : null, c.title, c.parties ? h('small', `（${c.parties}）`) : null))) : null,
      firstTime && guide.length ? h('section.wel-guide', h('h5', (profile() && profile().guideTitle) || '须知'), guide.map(([t, x], i) => h('p', h('b', `${'一二三四五六'[i]} · ${t}`), x))) : null),
    actions: [{ label: '开卷理事', onclick: ({ close }) => close('ok') }]
  });
  j.closed.then(nokey);
}
