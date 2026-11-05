// 国势：国势册。左叶四方印（吏治、民心、皇权、皇威），各标九品与刻度；右叶为所选一项的详情——总览、色谱、分维、源降两账、
// 警示、名目诸列，次序照老抽屉。真值能否见由适配层定（奏报失真层、监察之律），封存时右叶只给朝廷视野并注明。
// 色谱上真值与朝廷所见各一枚标记（只在真值可见时才有第二枚）；源降两账只列动过的，并排对看；历代案例默认收起。
// 四方印下另有「时运」签：朝代阶段、气运警兆、典章祖制。
// 名目里可直达的去处（批阅、撰写、召对、朝议）经 onGo 交书案去开。经 game.guoshi、game.select.gauges。
import { h, replaceChildren } from '../core/dom.js';
import { num, numText, roundSig, grade, gradeIndex } from '../core/numerals.js';
import { provinceShort } from '../core/places.js';

const amt = (v) => num(roundSig(Math.abs(v || 0), 3));
// 内核写好的警兆文字里夹着阿拉伯数字（「满意 10」），按记数设置改写
const digits = numText;
// 源降账的累计是小数，记数只写整数；不足半点的说不足一，写成「零」看着像没动
const tally = (v) => (Math.abs(v) < 0.5 ? '不足一' : num(Math.abs(v)));
const clamp = (v) => Math.max(0, Math.min(100, v));
// 一段小注按「 · 」分成几截，每截不折行；折行也折在截与截之间，不留一个孤零零的点
const pieces = (text) => h('small', String(text || '').split(' · ').filter(Boolean).map((t) => h('span', digits(t))));
// 名字栏按这一列最长的名字给宽（字数），再长就省略，全名放 title
const nameWidth = (labels, cap = 9) => `${Math.min(cap, Math.max(2, ...labels.map((t) => t.length))) + 0.5}em`;
const shortName = (t) => String(t).split(/\s*[（(]/)[0];

const GO_NAME = { docket: '去批阅', edict: '去撰写', audience: '去召对', court: '去朝议' };
// 案例不足这个数就直接摊开（时局、现任职掌只有一两段），多了才收起来
const FOLD_OVER = 3;

export function createGuoshi({ root, game, onGo }) {
  const S = game.guoshi;
  let sel = 'minxin';
  let opened = false;
  const unfolded = new Set();

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
      return h('button.gs-seal' + (key === sel ? '.on' : ''), { type: 'button', onclick: () => pickSeal(key) },
        h('b.ch', ch), h('span.name', label), h('span.grade', grade(v)),
        h('ol', Array.from({ length: 9 }, (_, i) => h('li' + (i < gi ? '.f' : i === gi ? '.n' : '')))),
        pieces(sub));
    }), shiyunCard());
    renderDetail(S.detail(sel), vals[sel]);
  }
  function pickSeal(key) {
    sel = key;
    render();
    right.scrollTop = 0;
  }

  function shiyunCard() {
    let c = null;
    try { c = S.detail('shiyun').card; } catch (_e) { return null; }
    return h('button.gs-seal.gs-yun' + (sel === 'shiyun' ? '.on' : ''), { type: 'button', onclick: () => pickSeal('shiyun') },
      h('b.ch', '运'), h('span.name', '时运'), h('span.grade', c.phase),
      pieces([c.warns ? `气运警兆${num(c.warns)}条` : c.veiled ? '据奏未见警兆' : '眼下无警兆', c.statutes ? `祖制${num(c.statutes)}典` : ''].filter(Boolean).join(' · ')));
  }

  // ---------- 右叶 ----------
  const dots = (n) => h('span.gs-dots', Array.from({ length: 4 }, (_, i) => h('i' + (i < n ? '.f' : ''))));
  function renderDetail(d, value) {
    replaceChildren(right,
      // 数和势都在下面的总览里，抬头只留顶栏那一个品第，和顶栏对得上
      h('header.gs-title', h('h3', d.title), value != null ? h('b.gs-grade', grade(value)) : null),
      // 数是数、注是注：注另起一行写在数下面，窄页上两栏也不折
      h('div.gs-rows', d.rows.map((x) => h('p' + (x.big ? '.big' : ''), h('span.k', x.label),
        h('span.v', x.dots != null ? dots(x.dots) : null, h('b.' + (x.tone || 'plain'), digits(x.value)), x.note ? h('small', digits(x.note)) : null)))),
      d.sealed ? h('p.gs-sealed', d.sealedNote) : null,
      d.spectrum ? spectrum(d.spectrum) : null,
      sectionsEl(d.sections));
  }
  // 标记在色带之外，不压字。真值和朝廷所见差得近时两枚字往外让，不叠在一起
  function spectrum({ bands, mark, seen }) {
    const two = seen != null && Math.round(seen) !== Math.round(mark);
    const pin = (v, cls, label, side) => h('em.' + cls + side, { style: { left: `${clamp(v)}%` } }, label ? h('span', label) : null);
    return h('section.gs-sec', h('div.gs-specbox',
      h('div.gs-pins' + (two ? '' : '.solo'), two
        ? [pin(mark, 'truth', '真', mark < seen ? '.l' : '.r'), pin(seen, 'seen', '视', mark < seen ? '.r' : '.l')]
        : pin(mark, 'truth', '', '')),
      h('div.gs-spec', bands.map(([label, from, to, tone]) => h('i.' + tone, { style: { flexGrow: String(to - from) } }, h('span', label))))));
  }
  function head(s) {
    return h('h4' + (s.tone ? '.' + s.tone : ''), h('span', s.title), s.badge ? h('small', digits(s.badge)) : null,
      s.go && onGo ? h('button.gs-go', { type: 'button', onclick: (e) => { e.preventDefault(); hide(); onGo(s.go); } }, GO_NAME[s.go] || '前往') : null);
  }
  // 连着的两本账（源、降）并排对看
  function sectionsEl(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i], next = list[i + 1];
      if (s.kind === 'ledger' && next && next.kind === 'ledger') { out.push(h('div.gs-pair', section(s), section(next))); i++; } else out.push(section(s));
    }
    return out;
  }
  function ledgerEl(s) {
    const moved = s.items.filter((x) => Math.abs(x.n) >= 0.05).sort((a, b) => Math.abs(b.n) - Math.abs(a.n));
    if (!moved.length) return [h('p.gs-empty', s.still || '开局以来未动过'), h('p.gs-names', s.items.map((x) => h('span', x.label)))];
    const max = Math.max(...moved.map((x) => Math.abs(x.n)));
    const idle = s.items.length - moved.length;
    return [h('div.gs-ledger', moved.map((x) => h('p', h('span', x.label), h('i', h('u.' + (x.tone || (x.n < 0 ? 'bad' : 'good')), { style: { width: `${(Math.abs(x.n) / max) * 100}%` } })),
      h('b.' + (x.tone || (x.n < 0 ? 'bad' : 'good')), `${x.n < 0 ? '减' : '增'}${tally(x.n)}`)))),
    idle ? h('p.gs-names', { title: s.items.filter((x) => Math.abs(x.n) < 0.05).map((x) => x.label).join('　') }, `余${num(idle)}项未动`) : null];
  }
  function casesEl(s) {
    const body = h('div.gs-cases', s.items.map((t) => h('p', digits(t))));
    if (s.items.length <= FOLD_OVER) return h('section.gs-sec.cases', head(s), body);
    const fold = h('details.gs-sec.cases.gs-fold', { open: unfolded.has(s.title) }, h('summary', head(s)), body);
    fold.addEventListener('toggle', () => { if (fold.open) unfolded.add(s.title); else unfolded.delete(s.title); });
    return fold;
  }
  function section(s) {
    const box = (...body) => h('section.gs-sec.' + s.kind, head(s), ...body);
    switch (s.kind) {
      case 'meter': return box(h('div.gs-meter', h('i', { style: { width: `${clamp(s.value)}%` } })), h('p.gs-note', digits(s.note)));
      case 'tax': {
        const max = Math.max(1, s.nominal, s.received, s.paid);
        const versus = (v) => {
          const d = Math.round(((v - s.nominal) / (s.nominal || 1)) * 100);
          return d ? `${d > 0 ? '多' : '少'}${num(Math.abs(d))}%` : '持平';
        };
        const line = (label, v, cls) => h('div.gs-tax-row.' + cls, h('span', label), h('i', h('b', { style: { width: `${(v / max) * 100}%` } })), h('em', amt(v)),
          h('small', cls === 'nom' ? '基准' : versus(v)));
        return box(h('p.gs-note', s.label),
          line('应征（名义）', s.nominal, 'nom'), line('官府实收', s.received, 'rec'), line('民间实缴', s.paid, 'paid'),
          s.loss > 0 ? h('div.gs-gaps', h('p.gs-note', `差额去向（${amt(s.loss)}${s.unit}）`), s.gaps.map((g) => h('p', h('span', g.label), h('b', amt(g.value)), h('small', `${num(g.share)}%`)))) : null,
          s.notes.map((t) => h('p.gs-note', digits(t))));
      }
      case 'depts': return box(h('div.gs-depts', s.items.map((x) => h('p', h('span', x.label), dots(x.dots), h('b.' + (x.tone || 'plain'), digits(x.value)), h('em', x.trend)))));
      case 'list': return box(s.lead ? h('p.gs-note', digits(s.lead)) : null,
        s.items.length ? h('div.gs-list', s.items.map((x) => h('div' + (x.tone ? '.' + x.tone : ''), h('b', x.title), x.meta ? h('span', digits(x.meta)) : null, x.side ? h('small', digits(x.side)) : null)))
          : h('p.gs-empty', s.empty || '无'));
      case 'alert': return box(h('div.gs-alert', s.lead ? h('b', digits(s.lead)) : null, s.lines.map((t) => h('p', digits(t))), s.note ? h('small', digits(s.note)) : null));
      case 'hints': return box(h('div.gs-hints', s.items.map(([t, go]) => h('button', { type: 'button', onclick: () => { if (onGo) { hide(); onGo(go); } } }, t))), s.note ? h('p.gs-note', s.note) : null);
      case 'ledger': return box(...ledgerEl(s));
      // 阶层民心：低的排前头，和民情图一个次序
      case 'bars': return box(h('div.gs-bars', { '--k': nameWidth(s.items.map((x) => shortName(x.label))) }, s.items.slice().sort((a, b) => a.value - b.value).map((x) => h('div',
        h('p', h('span', { title: x.label }, shortName(x.label)), h('i', h('b.' + x.tone, { style: { width: `${clamp(x.value)}%` } })), h('em.' + x.tone, `${num(Math.round(x.value))}${x.trend}`)),
        x.note ? h('small', digits(x.note)) : null))));
      // 民情图：低的排前头，一眼看到哪里最坏；全名放 title
      case 'tiles': return box(h('div.gs-tiles', s.items.slice().sort((a, b) => a.value - b.value).map((x) => h('span.' + x.tone, { title: `${x.label}　${num(x.value)}` }, h('b', provinceShort(x.label)), h('em', num(x.value))))));
      case 'chain': return box(h('div.gs-chain', s.levels.map((lv) => h('div' + (lv.count ? '.on' : ''), { title: lv.note }, h('span', lv.label), h('b', num(lv.count))))),
        s.items.length ? h('div.gs-list', s.items.map((x) => h('div.bad', h('b', x.title), x.meta ? h('span', digits(x.meta)) : null))) : null);
      case 'dims': return box(h('div.gs-dims', s.items.map((x) => h('div', h('span', x.label), h('b.' + x.tone, `${num(x.value)}${x.trend || ''}`), h('i', h('u.' + x.tone, { style: { width: `${clamp(x.value)}%` } }))))));
      case 'quotes': return box(h('div.gs-quotes', s.items.map((t) => h('p', `「${t}」`))));
      case 'cases': return casesEl(s);
      default: return null;
    }
  }

  function show(key) {
    if (key) sel = key;
    render();
    right.scrollTop = 0;
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
