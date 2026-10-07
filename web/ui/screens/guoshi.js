// 国势：国势册。左叶四方印（吏治、民心、皇权、皇威），各标九品与刻度；右叶为所选一项的详情——总览、色谱、分维、源降两账、
// 警示、名目诸列，次序照老抽屉。真值能否见由适配层定（奏报失真层、监察之律），封存时右叶只给朝廷视野并注明。
// 名目里可直达的去处（批阅、撰写、召对、朝议）经 onGo 交书案去开。经 game.guoshi、game.select.gauges。
import { h, replaceChildren } from '../core/dom.js';
import { num, roundSig, grade, gradeIndex } from '../core/numerals.js';

const amt = (v) => num(roundSig(Math.abs(v || 0), 3));

const GO_NAME = { docket: '去批阅', edict: '去撰写', audience: '去召对', court: '去朝议' };

export function createGuoshi({ root, game, onGo }) {
  const S = game.guoshi;
  let sel = 'minxin';
  let opened = false;

  const cards = h('div.gs-seals');
  const left = h('section.ce-leaf.left.gs-left', h('header.ce-head', h('h2', '国势'), h('small', '四柱')), cards);
  const right = h('section.ce-leaf.right.gs-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.gs-ov', { role: 'dialog', 'aria-label': '国势册' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  function render() {
    const vals = Object.fromEntries(game.select.gauges().map((g) => [g.key, g.value]));
    replaceChildren(cards, S.GAUGES.map(([key, label, ch]) => {
      const v = vals[key] ?? 50;
      const gi = gradeIndex(v);
      let sub = '';
      try { sub = S.detail(key).sub; } catch (_e) { sub = ''; }
      return h('button.gs-seal' + (key === sel ? '.on' : ''), { type: 'button', onclick: () => { sel = key; render(); } },
        h('b.ch', ch), h('span.name', label), h('span.grade', grade(v)),
        h('ol', Array.from({ length: 9 }, (_, i) => h('li' + (i < gi ? '.f' : i === gi ? '.n' : '')))),
        h('small', sub));
    }));
    renderDetail(S.detail(sel));
  }

  // ---------- 右叶 ----------
  const dots = (n) => h('span.gs-dots', Array.from({ length: 4 }, (_, i) => h('i' + (i < n ? '.f' : ''))));
  function renderDetail(d) {
    replaceChildren(right,
      h('header.gs-title', h('h3', d.title), h('small', d.sub)),
      h('div.gs-rows', d.rows.map((x) => h('p' + (x.big ? '.big' : ''), h('span', x.label),
        x.dots != null ? dots(x.dots) : null, h('b.' + (x.tone || 'plain'), x.value), x.note ? h('small', x.note) : null))),
      d.sealed ? h('p.gs-sealed', d.sealedNote) : null,
      d.spectrum ? spectrum(d.spectrum) : null,
      d.sections.map(section));
    right.scrollTop = 0;
  }
  function spectrum({ bands, mark }) {
    const m = Math.max(0, Math.min(100, mark));
    return h('section.gs-sec', h('div.gs-spec',
      bands.map(([label, from, to, tone]) => h('i.' + tone, { style: { flexGrow: String(to - from) } }, h('span', label))),
      h('em', { style: { left: `${m}%` } })));
  }
  function head(s) {
    return h('h4' + (s.tone ? '.' + s.tone : ''), h('span', s.title), s.badge ? h('small', s.badge) : null,
      s.go && onGo ? h('button.gs-go', { type: 'button', onclick: () => { hide(); onGo(s.go); } }, GO_NAME[s.go] || '前往') : null);
  }
  function section(s) {
    const box = (...body) => h('section.gs-sec.' + s.kind, head(s), ...body);
    switch (s.kind) {
      case 'meter': return box(h('div.gs-meter', h('i', { style: { width: `${Math.max(0, Math.min(100, s.value))}%` } })), h('p.gs-note', s.note));
      case 'tax': {
        const max = Math.max(1, s.nominal, s.received, s.paid);
        const line = (label, v, cls) => h('div.gs-tax-row.' + cls, h('span', label), h('i', h('b', { style: { width: `${(v / max) * 100}%` } })), h('em', amt(v)),
          h('small', cls === 'nom' ? '基准' : `${v - s.nominal >= 0 ? '+' : ''}${Math.round(((v - s.nominal) / (s.nominal || 1)) * 100)}%`));
        return box(h('p.gs-note', s.label),
          line('应征（名义）', s.nominal, 'nom'), line('官府实收', s.received, 'rec'), line('民间实缴', s.paid, 'paid'),
          s.loss > 0 ? h('div.gs-gaps', h('p.gs-note', `差额去向（${amt(s.loss)}两）`), s.gaps.map((g) => h('p', h('span', g.label), h('b', amt(g.value)), h('small', `${num(g.share)}%`)))) : null,
          s.notes.map((t) => h('p.gs-note', t)));
      }
      case 'depts': return box(h('div.gs-depts', s.items.map((x) => h('p', h('span', x.label), dots(x.dots), h('b', x.value), h('em', x.trend)))));
      case 'list': return box(s.lead ? h('p.gs-note', s.lead) : null,
        s.items.length ? h('div.gs-list', s.items.map((x) => h('div' + (x.tone ? '.' + x.tone : ''), h('b', x.title), x.meta ? h('span', x.meta) : null, x.side ? h('small', x.side) : null)))
          : h('p.gs-empty', s.empty || '无'));
      case 'alert': return box(h('div.gs-alert', s.lead ? h('b', s.lead) : null, s.lines.map((t) => h('p', t)), s.note ? h('small', s.note) : null));
      case 'hints': return box(h('div.gs-hints', s.items.map(([t, go]) => h('button', { type: 'button', onclick: () => { if (onGo) { hide(); onGo(go); } } }, t))), s.note ? h('p.gs-note', s.note) : null);
      case 'ledger': return box(h('div.gs-ledger', s.items.map((x) => h('p', h('span', x.label), h('b.' + (x.tone || 'plain'), x.value)))));
      case 'bars': return box(h('div.gs-bars', s.items.map((x) => h('div', h('p', h('span', x.label), h('i', h('b.' + x.tone, { style: { width: `${Math.max(0, Math.min(100, x.value))}%` } })), h('em.' + x.tone, `${num(Math.round(x.value))}${x.trend}`)),
        x.note ? h('small', x.note) : null))));
      case 'tiles': return box(h('div.gs-tiles', s.items.map((x) => h('span.' + x.tone, { title: x.label }, h('b', x.label.replace(/(承宣)?布政使司$/, '')), num(x.value)))));
      case 'chain': return box(h('div.gs-chain', s.levels.map((lv) => h('div' + (lv.count ? '.on' : ''), { title: lv.note }, h('span', lv.label), h('b', num(lv.count))))),
        s.items.length ? h('div.gs-list', s.items.map((x) => h('div.bad', h('b', x.title), x.meta ? h('span', x.meta) : null))) : null);
      case 'dims': return box(h('div.gs-dims', s.items.map((x) => h('div', h('span', x.label), h('b.' + x.tone, `${num(x.value)}${x.trend || ''}`)))));
      case 'quotes': return box(h('div.gs-quotes', s.items.map((t) => h('p', `「${t}」`))));
      case 'cases': return box(h('div.gs-cases', s.items.map((t) => h('p', t))));
      default: return null;
    }
  }

  function show(key) {
    if (key) sel = key;
    render();
    ov.classList.add('on');
    opened = true;
  }
  function hide() {
    ov.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened) render(); });
  return { show, hide, get opened() { return opened; } };
}
