// 寻人：照 CK3 的寻人检索（Character Finder），靠右展开，舆图露着；取代原先整本的人物图志册页。
// 一行一人：小像、姓名与字、职衔品级、势力；右端是所排之项的数（品秩、忠诚、才具、野心、名望）。点一行，左边人物窗换成此人。
// 卷首：检（人名、字、官职、势力、党派）、势力几枚签（人多的前六家）、排、显已殁、只看钉选；卷首「策名」可把历史人物纳入名册。
// 对参：至多三人并排比官职、心性、才具、五常、名望诸项，每行最优者标朱（人物窗、本单行尾都可放人进来）。数据经 game.select.people()。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { bus } from '../core/bus.js';
import { pinned } from '../core/pins.js';
import { zhou, qianzi, kaiguan, juan, tiao } from '../kit/index.js';
import { openCeming } from './ceming.js';

const SORTS = [['rank', '品秩'], ['loyalty', '忠诚'], ['智', '智'], ['政', '政'], ['军', '军'], ['ambition', '野心'], ['fame', '名望']];
const STATE_GLYPH = { 诏狱: '狱', 流放: '谪', 逃亡: '逃', 赴任: '行', 丁忧: '忧', 致仕: '休', 密谋: '谋' };
const SHOW_STEP = 60;

export function createXunren({ root, game, current, onPick, onBio }) {
  let all = [];
  let list = [];
  let shown = SHOW_STEP;
  let opts = { faction: '', sort: 'rank', q: '', dead: false, pins: false };
  let cmp = [];

  const count = h('small');
  const search = h('input.xr-search', { type: 'search', placeholder: '检人名、字、官职、势力', oninput: (e) => { opts.q = e.target.value.trim(); filter(); } });
  const sorts = qianzi(SORTS.map(([value, label]) => ({ value, label })), { value: 'rank', onchange: (v) => { opts.sort = v; filter(); } });
  const deadSw = kaiguan('显已殁', { onchange: (v) => { opts.dead = v; load(); } });
  const pinSw = kaiguan('只看钉选', { onchange: (v) => { opts.pins = v; filter(); } });
  const facBox = h('div.xr-facs');
  const rows = h('div.xr-rows.q-scroll');
  const cmpBar = h('div.xr-cmp');
  rows.addEventListener('scroll', () => {
    if (shown < list.length && rows.scrollTop + rows.clientHeight > rows.scrollHeight - 200) { shown += SHOW_STEP; renderRows(false); }
  });
  const el = h('aside.xr', { role: 'dialog', 'aria-label': '寻人' },
    h('header.xr-head', h('h2', '寻人'), count,
      game.ceming && game.ceming.ready() ? h('button.q-yapai.xr-ceming', { type: 'button', title: '策名：把历史人物纳入名册（不授官）', onclick: () => openCeming({ game, onBio: (name) => onBio(name) }) }, '策名') : null,
      h('button.xr-shut', { type: 'button', title: '收起（Esc）', onclick: () => hide() }, '×')),
    h('div.xr-tools', search),
    facBox,
    h('div.xr-sorts', h('span', '排'), sorts),
    h('div.xr-sw', deadSw, pinSw),
    rows, cmpBar);
  root.append(el);

  function load() {
    all = game.select.people({ dead: opts.dead });
    renderFactions();
    filter();
  }
  function renderFactions() {
    const counts = new Map();
    for (const p of all) if (p.faction) counts.set(p.faction, (counts.get(p.faction) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (opts.faction && !counts.has(opts.faction)) opts.faction = '';
    replaceChildren(facBox, [['', '全部', all.length], ...top.map(([f, n]) => [f, f, n])].map(([f, label, n]) =>
      h('button' + (opts.faction === f ? '.on' : ''), { type: 'button', onclick: () => { opts.faction = f; renderFactions(); filter(); } }, label, h('small', num(n)))));
  }
  const valOf = (p, key) => (key === 'rank' ? -p.rank.level : key === 'loyalty' ? p.loyalty : key === 'ambition' ? p.ambition : key === 'fame' ? (p.fame ?? -999)
    : (p.stats.find(([k]) => k === key) || [, 0])[1]);
  function filter() {
    const q = opts.q;
    list = all.filter((p) => (!opts.faction || p.faction === opts.faction) && (!opts.pins || pinned(p))
        && (!q || [p.name, p.zi, p.office, p.faction, p.party].some((s) => s && s.includes(q))))
      .sort((a, b) => (b.isPlayer - a.isPlayer) || (valOf(b, opts.sort) - valOf(a, opts.sort)) || a.name.localeCompare(b.name, 'zh'));
    count.textContent = `${num(list.length)}人`;
    shown = SHOW_STEP;
    renderRows(true);
  }
  // 行尾那一格：按所排之项写（品秩写品级字，其余写数）
  function metric(p) {
    const k = opts.sort;
    if (k === 'rank') return p.rank.label || '';
    if (k === 'fame') { const f = game.select.fameRank(p.fame); return h('span', { title: `${f.full}（${f.value}）` }, f.text); }
    const label = SORTS.find(([key]) => key === k)[1];
    return h('span', h('i', label), num(valOf(p, k)));
  }
  function renderRows(top) {
    const on = current();
    replaceChildren(rows, list.length ? list.slice(0, shown).map((p) => {
      const states = p.dead ? ['殁'] : p.states.map((s) => STATE_GLYPH[s]).filter(Boolean);
      const row = h('div.xr-row' + (p.name === on ? '.on' : '') + (p.dead ? '.dead' : ''), { dataset: { person: p.name } },
        h('button.xr-main', { type: 'button', onclick: () => { onPick(p.name); renderRows(false); } },
          h('span.xr-face', p.portrait ? h('img', { src: p.portrait, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.target.replaceWith(h('i', [...p.name][0])) }) : h('i', [...p.name][0])),
          h('span.xr-id', h('b', p.name, p.zi ? h('small', p.zi) : null), h('small', [p.office, p.faction].filter(Boolean).join(' · '))),
          h('span.xr-val', metric(p)),
          states.length || pinned(p) ? h('span.xr-marks', pinned(p) ? h('i.pin', '钉') : null, states.slice(0, 2).map((g) => h('i', g))) : null),
        tiao(h('button.xr-add' + (cmp.includes(p.name) ? '.on' : ''), { type: 'button', 'aria-label': '对参', onclick: () => toggleCmp(p.name) }, '参'),
          () => ({ title: cmp.includes(p.name) ? '移出对参' : '放进对参', text: '至多三人并排比' })));
      return row;
    }) : [h('p.xr-none', '无人合此')]);
    if (top) rows.scrollTop = 0;
  }

  function toggleCmp(name) {
    cmp = cmp.includes(name) ? cmp.filter((x) => x !== name) : [...cmp, name].slice(-3);
    renderCmp();
    if (el.classList.contains('on')) renderRows(false);
    bus.emit('duican:changed', { names: cmp.slice() });
  }
  function renderCmp() {
    cmp = cmp.filter((n) => all.some((p) => p.name === n) || game.select.people({ dead: true }).some((p) => p.name === n));
    cmpBar.hidden = !cmp.length;
    replaceChildren(cmpBar, h('span', '对参'), cmp.map((n) => h('button.xr-cmp-who', { type: 'button', title: '移出对参', onclick: () => toggleCmp(n) }, n)),
      cmp.length >= 2 ? h('button.q-yapai', { type: 'button', onclick: () => openCompare() }, '对看') : h('small', '再择一人'),
      h('button.xr-cmp-clear', { type: 'button', title: '清空对参', onclick: () => { cmp = []; renderCmp(); renderRows(false); bus.emit('duican:changed', { names: [] }); } }, '清'));
  }
  // 对看：每列一人，每行一项；数值行最优者标朱（野心、年齿不标）
  function openCompare() {
    const everyone = game.select.people({ dead: true });
    const ps = cmp.map((n) => everyone.find((p) => p.name === n)).filter(Boolean);
    if (ps.length < 2) return;
    const best = (vals, low) => { const xs = vals.filter((v) => v != null); if (xs.length < 2) return null; const m = low ? Math.min(...xs) : Math.max(...xs); return xs.filter((v) => v === m).length === xs.length ? null : m; };
    const numRow = (label, get, opt = {}) => {
      const vals = ps.map(get);
      if (vals.every((v) => v == null)) return null;          // 诸人皆未详的项不列
      const b = opt.noMark ? null : best(vals, opt.low);
      return h('tr', h('th', label), vals.map((v) => h('td' + (v != null && v === b ? '.best' : ''), v == null ? '—' : num(v))));
    };
    const textRow = (label, get) => { const vals = ps.map(get); return vals.some(Boolean) ? h('tr', h('th', label), vals.map((v) => h('td.txt', v || '—'))) : null; };
    const group = (title, rs) => { const list = rs.filter(Boolean); return list.length ? [h('tr.sep', h('th', title), ps.map(() => h('td'))), ...list] : []; };
    const table = h('table.ce-cmp-table',
      h('thead', h('tr', h('th'), ps.map((p) => h('th.who', zhou({ name: p.name, src: p.portrait, dead: p.dead }))))),
      h('tbody',
        textRow('官职', (p) => [p.office, p.rank.label].filter(Boolean).join(' · ')),
        textRow('所属', (p) => [p.faction, p.party ? `${p.party}${p.partyRank ? '·' + p.partyRank : ''}` : ''].filter(Boolean).join(' · ')),
        numRow('年齿', (p) => p.age, { noMark: true }),
        textRow('处境', (p) => [p.location ? `在${p.location}` : '', ...p.states].filter(Boolean).join(' · ')),
        group('心性', [numRow('忠诚', (p) => p.loyalty), numRow('野心', (p) => p.ambition, { noMark: true })]),
        group('才具', ps[0].stats.map(([k], i) => numRow(k, (p) => (p.stats[i] ? p.stats[i][1] : null)))),
        group('五常', ps[0].wuchang.map(([k], i) => numRow(k, (p) => (p.wuchang[i] ? p.wuchang[i][1] : null)))),
        group('声望', [numRow('名望', (p) => p.fame), numRow('贤能', (p) => p.merit), numRow('廉', (p) => p.integrity)]),
        textRow('性情', (p) => p.traits.map((t) => t.name).join('、'))));
    const j = juan({ title: '对参', note: ps.map((p) => p.name).join(' · '), width: `${18 + ps.length * 13}rem`, content: h('div.ce-cmp-wrap', table, h('p.ce-cmp-note', '每行最优者标朱；野心、年齿不标。点人像入其人物窗。')) });
    table.querySelectorAll('th.who .q-zhou').forEach((b, i) => { b.style.cursor = 'pointer'; b.title = '入其人物窗'; b.addEventListener('click', () => { j.close('ok'); onPick(ps[i].name); }); });
  }

  function show(name) {
    load();
    renderCmp();
    el.classList.add('on');
    // 带名进来：滚到此人那一行
    if (name) {
      const i = list.findIndex((p) => p.name === name);
      if (i >= shown) { shown = i + SHOW_STEP; renderRows(false); }
      const row = [...rows.children].find((r) => r.dataset && r.dataset.person === name);
      if (row) row.scrollIntoView({ block: 'center' });
    }
    setTimeout(() => search.focus({ preventScroll: true }), 60);
  }
  function hide() { el.classList.remove('on'); }
  // 人物窗换人：高亮那一行
  bus.on('renwu:shown', () => { if (el.classList.contains('on')) renderRows(false); });
  bus.on('renwu:hidden', () => { if (el.classList.contains('on')) renderRows(false); });
  bus.on('game:advanced', () => { if (el.classList.contains('on')) load(); });

  return {
    show, hide,
    get open() { return el.classList.contains('on'); },
    compare: { has: (n) => cmp.includes(n), toggle: (n) => toggleCmp(n) }
  };
}
