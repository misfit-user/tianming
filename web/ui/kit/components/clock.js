// 时间件：日期（年号、干支、季、月日）＋调速（停、一、二、三）＋「推演」键。
// 内核眼下是回合制：调速诸签禁用，推演键＝过回合。将来「即时＋结算」上线后，调速签启用、推演键＝推演结算。
// clock({ onSettle, onSpeed }) → el；el.update({ era, year, month, day, speed, speedEnabled, settling, label })
import { h } from '../../core/dom.js';
import { ganzhi, monthName, season, dayName } from '../../core/numerals.js';

const SPEEDS = [[0, '停'], [1, '一'], [2, '二'], [3, '三']];

export function clock({ onSettle, onSpeed } = {}) {
  const era = h('b.q-gold');
  const sub = h('span');
  const speed = h('div.speed', { role: 'radiogroup', 'aria-label': '时速' },
    SPEEDS.map(([v, ch]) => h('button', { type: 'button', dataset: { v }, title: v ? `${ch}速` : '暂停', onclick: () => onSpeed?.(v) }, ch)));
  const go = h('button.tuiyan', { type: 'button', onclick: () => onSettle?.() }, '推演');
  const el = h('div.q-clock', h('div.date', era, sub), speed, go);
  el.update = ({ era: e, year, month, day, speed: sp = 0, speedEnabled = false, settling = false, label = '推演' } = {}) => {
    era.textContent = e || '';
    const parts = [];
    if (year) parts.push(ganzhi(year));
    if (month) parts.push(season(month), monthName(month) + (day ? dayName(day) : ''));
    sub.textContent = parts.join(' · ');
    for (const b of speed.children) {
      b.disabled = !speedEnabled;
      b.classList.toggle('on', speedEnabled && +b.dataset.v === sp);
    }
    go.disabled = settling;
    go.textContent = settling ? '推演中' : label;
  };
  return el;
}
