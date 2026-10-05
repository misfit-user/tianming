// 典章：新前端自己的设置（画质分档、记数写法、动效）。AI 与游戏规则设置在做设置页时接内核。
import { h } from '../core/dom.js';
import { juan, qianzi, kaiguan } from '../kit/index.js';
import { getSetting, setSetting } from '../core/settings.js';
import { quality } from '../core/quality.js';

export function openSettings() {
  const q = quality();
  const row = (label, control, note) => h('div', { style: { display: 'grid', gridTemplateColumns: '6rem 1fr', gap: '1rem', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid rgba(120,90,50,.18)' } },
    h('div', { style: { font: '400 var(--fs-4) var(--f-title)', letterSpacing: '.2em' } }, label),
    h('div', control, note ? h('div', { style: { marginTop: '.25rem', fontSize: 'var(--fs-1)', color: 'var(--ink-faint)', letterSpacing: '.06em' } }, note) : null));
  const tier = qianzi([{ value: 'auto', label: '自定' }, { value: 'high', label: '上' }, { value: 'medium', label: '中' }, { value: 'low', label: '下' }],
    { value: getSetting('quality'), onchange: (v) => setSetting('quality', v) });
  const nums = kaiguan('汉字记数（关则用阿拉伯数字）', { checked: getSetting('numerals') !== 'arabic', onchange: (on) => setSetting('numerals', on ? 'cn' : 'arabic') });
  const motion = kaiguan('少动效（只留淡入淡出）', { checked: getSetting('motion') === 'less', onchange: (on) => setSetting('motion', on ? 'less' : 'full') });
  juan({
    title: '典章', note: '规制条例', width: '40rem',
    content: h('div',
      row('画质', tier, `本机测为「${{ high: '上', medium: '中', low: '下' }[q.detected.tier]}」档（${q.detected.reason}）。改档下次启动生效。`),
      row('记数', nums),
      row('动效', motion),
      h('p', { style: { margin: '1rem 0 0', fontSize: 'var(--fs-2)', color: 'var(--ink-faint)', lineHeight: 1.8 } }, 'AI 接入与推演规则诸项，待设置页接上内核后列于此。'))
  });
}
