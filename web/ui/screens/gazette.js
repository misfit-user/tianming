// 邸报全卷：左列那叶刻本点开即此。编年由新到旧、按日期分；每条急、议、闻一字，题与全文，长的可展开。
// 另有「风闻」（朝野近事）与「告示」（内核通知史：急报、驻留提示、提示条，按回合分）两页。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const FOLD = 140;   // 过此字数先收起

export function openGazette({ game, tab = '' }) {
  const all = game.select.gazette();
  const body = h('div.gz');
  let only = tab;
  let back = 3;                                    // 风闻回看几回合（999 即全部）
  const tabs = h('div.gz-tabs');
  function renderTabs() {
    const counts = { '': all.length, 急: 0, 议: 0, 闻: 0 };
    for (const e of all) counts[e.tag]++;
    const fw = only === '风闻' ? game.select.rumors(back) : null;
    replaceChildren(tabs, [['', '全'], ['急', '急'], ['议', '议'], ['闻', '闻']].map(([k, label]) =>
      h('button' + (only === k ? '.on' : ''), { type: 'button', onclick: () => { only = k; renderTabs(); render(); } }, label, h('small', num(counts[k])))),
    h('i.gz-sep'),
    h('button' + (only === '风闻' ? '.on' : ''), { type: 'button', title: '朝野近事、势力动态、人物动向与心绪', onclick: () => { only = '风闻'; renderTabs(); render(); } },
      '风闻', fw ? h('small', num(fw.length)) : null),
    h('button' + (only === '告示' ? '.on' : ''), { type: 'button', title: '急报、驻留提示与提示条（最近五十条）', onclick: () => { only = '告示'; renderTabs(); render(); } },
      '告示', h('small', num(game.select.notices().length))),
    only === '风闻' ? h('span.gz-back', '回看', [[3, '三回合'], [6, '六回合'], [12, '十二回合'], [999, '全部']].map(([n, label]) =>
      h('button' + (back === n ? '.on' : ''), { type: 'button', onclick: () => { back = n; renderTabs(); render(); } }, label))) : null);
  }
  function rumorItem(r) {
    const long = r.text.length > FOLD;
    const p = h('p', long ? r.text.slice(0, FOLD) + '……' : r.text);
    const more = long ? h('button.gz-more', { type: 'button', onclick: () => { p.textContent = r.text; more.remove(); } }, '展全文') : null;
    return h('article.gz-item' + (r.hot ? '.hot' : ''), h('em.' + (r.hot ? 'ji' : 'wen'), r.hot ? '察' : '闻'),
      h('div', r.title ? h('b', r.title) : null, h('small', [r.type, ...r.meta].join(' · ')), p, more));
  }
  function renderRumors() {
    const rows = game.select.rumors(back);
    if (!rows.length) { replaceChildren(body, h('p.gz-none', '近来无所闻')); return; }
    const days = [];
    for (const r of rows) {
      const last = days[days.length - 1];
      if (last && last.time === r.time) last.rows.push(r);
      else days.push({ time: r.time, rows: [r] });
    }
    replaceChildren(body, days.map((d) => h('section.gz-day', h('h4', d.time || '日期未详'), d.rows.map(rumorItem))));
  }
  function item(e) {
    const long = e.text.length > FOLD;
    const p = h('p', long ? e.text.slice(0, FOLD) + '……' : e.text);
    const more = long ? h('button.gz-more', { type: 'button', onclick: () => { p.textContent = e.text; more.remove(); } }, '展全文') : null;
    return h('article.gz-item', h('em.' + ({ 急: 'ji', 议: 'yi', 闻: 'wen' })[e.tag], e.tag),
      h('div', e.title ? h('b', e.title) : null, h('small', e.type), p, more));
  }
  const LEVEL = { urgent: ['ji', '急'], persist: ['yi', '留'], flash: ['wen', '示'] };
  function renderNotices() {
    const rows = game.select.notices();
    if (!rows.length) { replaceChildren(body, h('p.gz-none', '尚无告示')); return; }
    const turns = [];
    for (const r of rows) {
      const last = turns[turns.length - 1];
      if (last && last.turn === r.turn) last.rows.push(r);
      else turns.push({ turn: r.turn, rows: [r] });
    }
    replaceChildren(body, turns.map((t) => h('section.gz-day', h('h4', t.turn ? `第${num(t.turn)}回合` : '开局之前'),
      t.rows.map((r) => h('article.gz-item' + (r.level === 'urgent' ? '.hot' : ''), h('em.' + LEVEL[r.level][0], LEVEL[r.level][1]),
        h('div', h('p', r.text)))))));
  }
  function render() {
    if (only === '风闻') { renderRumors(); return; }
    if (only === '告示') { renderNotices(); return; }
    const rows = all.filter((e) => !only || e.tag === only);
    if (!rows.length) { replaceChildren(body, h('p.gz-none', '今日无报')); return; }
    const days = [];
    for (const e of rows) {
      const last = days[days.length - 1];
      if (last && last.date === e.date) last.rows.push(e);
      else days.push({ date: e.date, rows: [e] });
    }
    replaceChildren(body, days.map((d) => h('section.gz-day', h('h4', d.date || '日期未详'), d.rows.map(item))));
  }
  renderTabs();
  render();
  return juan({ title: '邸报', note: '朝野近闻', width: '54rem', height: 'min(44rem, 84vh)', content: h('div.gz-wrap', tabs, body) });
}
