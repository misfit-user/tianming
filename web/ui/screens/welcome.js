// 进局时：第一回合展一卷「天下大势」（势力格局、显著矛盾、本人处境；初次还附「临朝须知」）；
// 没配推演之器（AI 密钥）时提醒一次，给个开典章的口子。须知的条目取身份档 guide。
import { h } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';
import { openSettings } from './settings.js';

const DIM = { political: '政', economic: '财', military: '军', social: '民' };
const SEEN_KEY = 'tm_ui_seen_guide';                         // 新前端自己的已读标记（老界面的首日引导进局时一弹就写了它自己的，那一张在新前端里看不见）
let shownFor = '';

export function showWelcome({ game, profile }) {
  const d = game.select.date();
  const configured = game.config.aiConfig('primary').configured;
  const nokey = () => {
    if (configured) return;
    juan({
      title: '推演之器未备', note: 'AI 密钥', width: '32rem',
      content: h('p', { style: { margin: 0, lineHeight: 2 } }, '推演、来文、史记都要靠 AI。眼下尚未配置密钥：可以先翻看各卷、批阅案牍，配好之后再推演。'),
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
  const guide = (profile() && profile().guide) || [];
  const j = juan({
    title: '天下大势', note: d.text || '', width: '50rem', height: 'min(42rem, 84vh)',
    content: h('div.wel',
      s.player.name ? h('section.wel-me', h('b', s.player.name), h('span', [s.player.title, s.player.faction].filter(Boolean).join(' · ')), s.player.goal ? h('p', `所志：${s.player.goal}`) : null) : null,
      s.factions.length ? h('section', h('h5', '势力格局'), h('div.wel-facs', s.factions.map((f) => h('div.wel-fac' + (f.isPlayer ? '.me' : ''),
        h('b', f.name), h('i', h('em', { style: { width: `${Math.round(f.strength / max * 100)}%` } })), h('small', `实力${num(f.strength)}${f.leader ? ' · ' + f.leader : ''}`))))) : null,
      s.contradictions.length ? h('section', h('h5', '显著矛盾'), s.contradictions.map((c) => h('p.wel-con', c.dimension ? h('em.' + c.dimension, DIM[c.dimension] || '事') : null, c.title, c.parties ? h('small', `（${c.parties}）`) : null))) : null,
      firstTime && guide.length ? h('section.wel-guide', h('h5', (profile() && profile().guideTitle) || '须知'), guide.map(([t, x], i) => h('p', h('b', `${'一二三四五六'[i]} · ${t}`), x))) : null),
    actions: [{ label: '开卷理事', onclick: ({ close }) => close('ok') }]
  });
  j.closed.then(nokey);
}
