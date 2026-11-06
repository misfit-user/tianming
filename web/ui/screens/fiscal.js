// 财：度支册。左叶择帑廪、内帑、户口：两库各列银粮布——库存、本期收支与净数、欠项总数；户口列全国户、口、丁、逃户、隐户，另点出告急之省。
// 右叶：两库先是本期总览（收、支、净，亏空时算尚可支几期），再是收支名目（结账后可展开细目）、欠项；
// 帑廪另有收支史、借贷、户部条陈（加派、开仓赈济拟入清册；减重改铸、财政改革当场办）；
// 内帑另有两库对照与宫中条陈（两库互拨、大典，拟入清册）；户口为各省（汇总叶子）户口、民心、吏治，可排序，点省名翻通志。经 game.fiscal。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig, yearNum } from '../core/numerals.js';
import { provinceShort } from '../core/places.js';
import { qianzi, juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const amt = (v) => num(roundSig(Math.abs(v || 0), 3));
const amt2 = (v) => num(roundSig(Math.abs(v || 0), 2));
const signed = (v) => (v > 0 ? '盈' : v < 0 ? '亏' : '') + amt(v);
// 库存可以是负数（库空了还得付），amt 只写大小，这里写明
const stockAmt = (v) => (v < 0 ? '亏空' : '') + amt(v);
// 记数只写整数：不足半成的说不足一，写成「零%」像没有
const pct = (v) => { const p = (v || 0) * 100; return p > 0 && p < 0.5 ? '不足一%' : `${num(p)}%`; };
const TABS = [['guoku', '帑廪'], ['neitang', '内帑'], ['census', '户口']];
const ACCOUNT_NAME = { guoku: '帑廪', neitang: '内帑' };
const CENSUS_COLS = [['name', '省'], ['mouths', '口'], ['households', '户'], ['ding', '丁'], ['fugitives', '逃'], ['minxin', '民心'], ['lizhi', '吏治']];
// 按亏空算：库存够再支几期；不亏或库已空的另说。开局还没拨存的，先从库里减掉
const runwayOf = (r) => {
  const net = r.inn - r.out;
  const stock = r.stock - (r.heldPending ? r.held : 0);
  return net < 0 && stock > 0 ? Math.floor(stock / -net) : null;
};
// 拨存给谁：一处写名字，多处写「某某等几处」
const heldWho = (r) => (r.heldNames.length > 1 ? `${r.heldNames[0]}等${num(r.heldNames.length)}处` : r.heldNames[0] || '各署');
// 只有一条「其他」等于没分目：开局账目就是这样，画一条百分之百的长条是假装有细目
const itemized = (list) => list.length > 1 || (list.length === 1 && !/^(其他|qita|other)$/.test(list[0].label));
const moodTone = (v) => (v == null ? '' : v < 40 ? '.bad' : v < 60 ? '.mid' : '.good');

export function createFiscal({ root, game, onCircuit }) {
  const F = game.fiscal;
  let tab = 'guoku';
  let res = 'money';
  let opened = false;
  let debtsOpen = false;
  let sortKey = 'mouths';
  let sortDir = -1;

  const tabs = qianzi(TABS.map(([value, label]) => ({ value, label })), { value: tab, onchange: (v) => { tab = v; render(); right.scrollTop = 0; } });
  const leftBody = h('div.fi-lbody');
  const left = h('section.ce-leaf.left.fi-left', h('header.ce-head', h('h2', '度支'), h('small', '量入为出')), h('div.fi-tabs', tabs), leftBody);
  const right = h('section.ce-leaf.right.fi-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.fi-ov', { role: 'dialog', 'aria-label': '度支册' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  function card(r) {
    const runway = runwayOf(r);
    return h('article.fi-card' + (r.key === res ? '.on' : ''), { onclick: () => { res = r.key; render(); } },
      h('header', h('b', r.label), runway != null ? h('small' + (runway <= 3 ? '.bad' : ''), runway ? `可支${num(runway)}期` : '不足一期') : null),
      h('div.stock' + (r.stock < 0 ? '.neg' : ''), stockAmt(r.stock), h('small', r.unit)),
      h('div.flow', h('span.in', `收 ${amt(r.inn)}`), h('span.out', `支 ${amt(r.out)}`), h('span.net' + (r.inn - r.out < 0 ? '.neg' : ''), `净 ${signed(r.inn - r.out)}`)),
      r.held ? h('div.held', `${r.heldPending ? '将拨存' : '已拨存'} ${amt(r.held)}`) : null,
      r.deficit ? h('div.deficit', `欠 ${amt(r.deficit)}${r.unit}`) : null);
  }

  function render() {
    if (tab === 'census') return renderCensus();
    const a = F.account(tab);
    if (!a) { replaceChildren(leftBody, h('p.ce-unk', '此账未具')); replaceChildren(right); return; }
    replaceChildren(leftBody,
      a.forecast ? h('p.fi-note', '本期尚未结账，所列为预估') : null,
      a.distorted ? h('p.fi-note', `库存与${F.money().noun}之收支皆据有司所奏，未经核实`) : null,
      a.res.map(card));
    const r = a.res.find((x) => x.key === res) || a.res[0];
    replaceChildren(right,
      h('header.fi-title', h('h3', `${ACCOUNT_NAME[tab]}·${r.label}`), a.forecast ? h('small', '本期预估') : null),
      summaryEl(r),
      namesEl(r, a),
      debtsEl(r),
      tab === 'guoku' && r.key === 'money' ? historyEl(r.unit) : null,
      tab === 'guoku' ? guokuActions() : [compareEl(r), palaceActions(a)]);
  }

  // 本期总览：收、支、净三个大数，下面两条同一把尺子的长条，亏空时点明还撑得了多久
  function summaryEl(r) {
    if (!r.inn && !r.out) return null;
    const net = r.inn - r.out;
    const max = Math.max(1, r.inn, r.out);
    const runway = runwayOf(r);
    // 拨存是期初分割，不算收支；收有余而拨存更多，库中之数照样少
    const verdict = net >= 0 ? (net - r.held < 0 ? '本期收有余，拨存之后库中之数仍减' : net > 0 ? `本期盈余，库中之数渐增` : '收支相抵')
      : r.stock <= 0 ? '库已空竭，又入不敷出'
      : runway ? `入不敷出，按此收支，库中之数尚可支${num(runway)}期` : '入不敷出，库中之数已不足支一期';
    const stat = (label, text, cls) => h('p.' + cls, h('span', label), h('b', text), h('small', r.unit));
    return h('section.fi-sum',
      h('div.fi-sum-nums', stat('本期收', amt(r.inn), 'in'), stat('本期支', amt(r.out), 'out'), stat('净', signed(net), net < 0 ? 'neg' : 'pos')),
      h('div.fi-sum-bars',
        h('i.in', h('u', { style: { width: `${(r.inn / max) * 100}%` } })),
        h('i.out', h('u', { style: { width: `${(r.out / max) * 100}%` } }))),
      h('p.fi-sum-note' + (net < 0 && (r.stock <= 0 || (runway != null && runway <= 3)) ? '.bad' : ''), verdict),
      r.held ? h('p.fi-sum-held', r.heldPending
        ? `开局将从库中拨存${heldWho(r)}待支钱物${amt(r.held)}${r.unit}。这是期初分割，不算本期支用，库中之数另减此数。`
        : `本期开局已从库中拨存${heldWho(r)}待支钱物${amt(r.held)}${r.unit}。这是期初分割，不算支用，库中之数另减了此数。`) : null);
  }

  function namesEl(r, a) {
    if (!r.inn && !r.out) return h('p.fi-note', '本期无出入。');
    if (!itemized(r.sources) && !itemized(r.sinks)) return h('p.fi-note', a.forecast ? '账目尚未分目，结账后列出岁入名目与支用科目。' : '本期账目未分细目。');
    return h('div.fi-cols', bars('岁入名目', r.sources, r.inn, 'in'), bars('支用科目', r.sinks, r.out, 'out'));
  }

  function debtsEl(r) {
    if (!r.deficits.length) return null;
    const list = debtsOpen ? r.deficits : r.deficits.slice(0, 12);
    return h('section.fi-sec', h('h4', `欠项 · ${amt(r.deficit)}${r.unit}`),
      h('div.fi-debts', list.map((d) => h('p', { title: d.kind || '' }, h('span', d.name || d.kind), h('b', amt(d.amount))))),
      r.deficits.length > 12 ? h('button.fi-more', { type: 'button', onclick: () => { debtsOpen = !debtsOpen; render(); } }, debtsOpen ? '收起' : `还有${num(r.deficits.length - 12)}项，展开`) : null);
  }

  // 帑廪·银：近十二期收支（收支对柱、期末库银）与近五年决算
  function historyEl(unit) {
    let H = null;
    try { H = F.history(); } catch (_e) { return null; }
    if (H.sealed) return h('section.fi-sec', h('h4', '收支史'), h('p.fi-note', '往年账目皆有司所奏，未经核实，不列。'));
    if (!H.months.length && !H.years.length) return null;
    const max = Math.max(1, ...H.months.flatMap((m) => [m.inn, m.out]));
    return h('section.fi-sec.fi-hist',
      H.months.length ? [h('h4', `近${num(H.months.length)}期收支`),
        h('div.fi-hbars', H.months.map((m) => h('div', { title: `第${num(m.turn)}回合　收${amt(m.inn)} 支${amt(m.out)} 净${signed(m.net)}　期末库${F.money().noun}${stockAmt(m.balance)}${unit}` },
          h('i.in', { style: { height: `${(m.inn / max) * 100}%` } }), h('i.out', { style: { height: `${(m.out / max) * 100}%` } }), h('small', num(m.turn))))),
        h('p.fi-note', '左柱收、右柱支；悬停见当期之数。')] : null,
      H.years.length ? [h('h4', '年度决算'), H.years.map((y) => h('details.fi-year',
        h('summary', h('b', `${yearNum(y.year)}年`), h('span', `入${amt(y.inn)} · 出${amt(y.out)}`), h('em' + (y.net < 0 ? '.neg' : ''), signed(y.net)), y.bankrupt ? h('small.neg', `破产${num(y.bankrupt)}月`) : null),
        h('p', `年终库${F.money().noun}${stockAmt(y.balance)}${unit}`),
        y.regions.length ? h('div.fi-debts', y.regions.map((x) => h('p', h('span', x.name), h('b', `${signed(x.net)}`)))) : null))] : null);
  }

  function bars(title, list, total, cls) {
    const max = Math.max(1, ...list.map((x) => x.amount));
    const row = (x, tag) => h(tag + '.fi-bar.' + cls,
      h('span.k', x.label), h('span.v', h('i', { style: { width: `${(x.amount / max) * 100}%` } })), h('span.n', amt(x.amount)), h('small', total ? pct(x.amount / total) : ''));
    return h('section.fi-sec', h('h4', title), list.length ? list.map((x) => (x.details.length > 1
      ? h('details.fi-item', row(x, 'summary'), h('div.fi-debts.sub', x.details.slice(0, 16).map((d) => h('p', h('span', d.name), h('b', amt(d.amount))))),
        x.details.length > 16 ? h('p.fi-note', `余${num(x.details.length - 16)}目`) : null)
      : row(x, 'div')))
      : h('p.ce-unk', '本期无'));
  }

  // ---------- 帑廪：借贷与户部条陈 ----------
  function guokuActions() {
    const L = F.loans();
    return h('div.fi-acts',
      h('section.fi-sec', h('h4', `借贷 · 在借${num(L.list.length)}笔`),
        L.list.map((x) => h('p.fi-loan', h('b', x.source), `本金${amt(x.principal)}${F.money().unit} · 月息${num(Math.round(x.rate * 1000) / 10)}% · 月付${amt(x.monthly)} · 余${num(x.left)}/${num(x.term)}月`)),
        h('button.q-yapai', { type: 'button', onclick: () => openLoan(L.sources) }, '新借一笔')),
      h('section.fi-sec', h('h4', '户部条陈'), h('p.fi-note', '加派、开仓拟入议事清册，下旨方行；改铸、改制当场施行。'),
        h('div.fi-btns',
          h('button.q-yapai', { type: 'button', onclick: () => pick('加派赋税', F.MEASURES.extraTax, (v) => F.extraTax(v), '拟入清册') }, '加派赋税'),
          h('button.q-yapai', { type: 'button', onclick: () => pick('开仓赈济', F.MEASURES.granary, (v) => F.granary(v), '拟入清册') }, '开仓赈济'),
          h('button.q-yapai.danger', { type: 'button', onclick: () => pick('减重改铸', F.MEASURES.coin, (v) => { const r = F.lightCoin(v); toast(r && r.success === false ? `未成：${r.reason || ''}` : '已减重改铸'); }, '施行') }, '减重改铸'),
          h('button.q-yapai', { type: 'button', onclick: () => openReforms() }, '财政改制'))));
  }
  function pick(title, rows, act, verb) {
    const j = juan({
      title, width: '30rem',
      content: h('div.au-pick', rows.map(([v, label, note]) => h('button.au-pick-row', { type: 'button', onclick: () => {
        j.close('ok');
        try { act(v); } catch (e) { toast(e.message); }
        render();
      } }, h('b', label), h('small', note)))),
      note: verb
    });
  }
  function openLoan(sources) {
    let j = null;
    j = juan({
      title: '借贷', note: '择来源', width: '32rem',
      content: h('div.au-pick', sources.map((s) => h('button.au-pick-row' + (s.foreign ? '.danger' : ''), { type: 'button', onclick: () => { j.close('ok'); loanForm(s); } },
        h('b', s.name), h('small', `月息${num(Math.round(s.rate * 1000) / 10)}% · 上限${amt(s.max)}${F.money().unit} · ${s.note}`))))
    });
  }
  function loanForm(s) {
    const sizes = [0.3, 0.5, 1].map((k) => Math.round(s.max * k / 10000) * 10000);
    const size = qianzi(sizes.map((v) => ({ value: v, label: `${amt(v)}${F.money().unit}` })), { value: sizes[1] });
    const term = qianzi([6, 12, 24, 36].map((v) => ({ value: v, label: `${num(v)}月` })), { value: 12 });
    juan({
      title: s.name, note: `月息${num(Math.round(s.rate * 1000) / 10)}%`, width: '30rem',
      content: h('div.fi-form', h('p.fi-note', s.note), h('div', h('span', '借数'), size), h('div', h('span', '期限'), term)),
      actions: [{ label: '借', onclick: ({ close }) => {
        let r = null;
        try { r = F.takeLoan(s.id, Number(size.getValue()), Number(term.getValue())); } catch (e) { toast(e.message); return; }
        close('ok');
        toast(r && r.success !== false ? `已向${s.name}借${F.money().noun}${amt(Number(size.getValue()))}${F.money().unit}` : `未成：${(r && r.reason) || ''}`);
        render();
      } }]
    });
  }
  function openReforms() {
    const list = F.reforms();
    const j = juan({
      title: '财政改制', width: '36rem',
      content: list.length ? h('div.au-pick', list.map((r) => h('button.au-pick-row' + (r.enacted ? '.done' : ''), { type: 'button', disabled: r.enacted, onclick: () => {
        juan({ title: r.name, width: '30rem', content: h('div', h('p.fi-note', r.desc), r.effects.length ? h('p.fi-note', r.effects.join('　')) : null),
          actions: [{ label: '推行', onclick: ({ close }) => {
            close('ok');
            j.close('ok');
            let res2 = null;
            try { res2 = F.enactReform(r.id); } catch (e) { toast(e.message); return; }
            toast(res2 && res2.success ? `已颁行：${r.name}` : `未成：${(res2 && res2.reason) || ''}`);
            render();
          } }] });
      } }, h('b', r.name, r.enacted ? h('small', '　已行') : null), h('small', r.desc)))) : h('p.ce-unk', '无可行之制')
    });
  }

  // ---------- 内帑：两库对照与宫中条陈 ----------
  // 互拨之前先看两边各有多少；帑廪在失真层下是据奏之数，和左叶、顶栏同一口径
  function compareEl(r) {
    const g = F.account('guoku');
    const other = g && g.res.find((x) => x.key === r.key);
    if (!other) return null;
    const max = Math.max(1, other.stock, r.stock);
    const row = (label, v, cls) => h('div.fi-bar.fi-two.' + cls, h('span.k', label), h('span.v', h('i', { style: { width: `${(Math.max(0, v) / max) * 100}%` } })), h('span.n', stockAmt(v)));
    return h('section.fi-sec', h('h4', `两库对照 · ${r.label}（${r.unit}）`), row('帑廪', other.stock, 'out'), row('内帑', r.stock, 'in'));
  }
  function palaceActions(a) {
    const amount = qianzi(F.TRANSFER_AMOUNTS.map((v) => ({ value: v, label: amt(v) })), { value: F.TRANSFER_AMOUNTS[1] });
    const draft = (f) => () => { try { f(); toast('已拟入议事清册'); } catch (e) { toast(e.message); } };
    const silver = (a.res.find((x) => x.key === 'money') || {}).stock || 0;
    return h('section.fi-sec', h('h4', '宫中条陈'), h('p.fi-note', '两库互拨、举行大典，拟入议事清册，下旨方行。'),
      h('div.fi-rows',
        h('div.fi-row.xfer', h('b', '两库互拨'), amount,
          h('span.btns',
            h('button.q-yapai', { type: 'button', onclick: draft(() => F.transferDraft('toPalace', Number(amount.getValue()))) }, '帑廪拨入内帑'),
            h('button.q-yapai', { type: 'button', onclick: draft(() => F.transferDraft('toState', Number(amount.getValue()))) }, '发内帑济国用'))),
        F.CEREMONIES.map(([k, label, cost]) => h('div.fi-row', h('b', label),
          h('small' + (cost > silver ? '.bad' : ''), `约费${amt(cost)}${F.money().unit}${cost > silver ? '，内帑不足' : ''}`),
          h('button.q-yapai', { type: 'button', onclick: draft(() => F.ceremonyDraft(k)) }, '拟举')))));
  }

  // ---------- 户口 ----------
  function sorted(list) {
    return list.slice().sort((a, b) => {
      if (sortKey === 'name') return sortDir * String(a.name).localeCompare(String(b.name), 'zh');
      const x = a[sortKey], y = b[sortKey];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return sortDir * (x - y);
    });
  }
  function worstOf(list, key, dir) {
    const rows = list.filter((p) => p[key] != null && (dir < 0 || p[key] > 0));
    if (rows.length < 2 || rows.every((p) => p[key] === rows[0][key])) return null;   // 各省一样就没有谁最坏
    return rows.reduce((m, p) => (dir * p[key] > dir * m[key] ? p : m));
  }
  function renderCensus() {
    const c = F.census();
    const low = worstOf(c.provinces, 'minxin', -1), dirty = worstOf(c.provinces, 'lizhi', -1), fled = worstOf(c.provinces, 'fugitives', 1);
    const alert = [
      low && low.minxin < 60 ? ['民心最低', low, num(low.minxin)] : null,
      dirty && dirty.lizhi < 60 ? ['吏治最浊', dirty, num(dirty.lizhi)] : null,
      fled ? ['逃户最多', fled, amt2(fled.fugitives)] : null
    ].filter(Boolean);
    replaceChildren(leftBody,
      h('article.fi-card.on.flat', h('header', h('b', '全国'), h('small', c.accuracy != null ? `黄册准确${pct(c.accuracy)}` : '')),
        h('div.fi-cen', [['户', c.households], ['口', c.mouths], ['丁', c.ding], ['逃户', c.fugitives], ['隐户', c.hidden]].filter(([, v]) => v).map(([k, v]) => h('p', h('span', k), h('b', amt(v))))),
        c.households && c.mouths ? h('div.last', `户均${num(Math.round((c.mouths / c.households) * 10) / 10)}口`) : null),
      alert.length ? h('article.fi-card.flat', h('header', h('b', '告急之省')),
        h('div.fi-cen', alert.map(([k, p, v]) => h('p', h('span', k), h('em', provinceShort(p.name)), h('b.bad', v))))) : null);
    const max = Math.max(1, ...c.provinces.map((p) => p.mouths));
    const th = ([key, label]) => h('button.k-' + key + (sortKey === key ? '.on' : ''), { type: 'button', onclick: () => {
      if (sortKey === key) sortDir = -sortDir;
      else { sortKey = key; sortDir = key === 'name' ? 1 : (key === 'minxin' || key === 'lizhi') ? 1 : -1; }
      render();
    } }, label, sortKey === key ? h('i', sortDir < 0 ? '▾' : '▴') : null);
    const go = (p) => {
      const id = F.provinceRegion ? F.provinceRegion(p.name) : null;
      if (!id || !onCircuit) { toast('此省未隶舆图省道'); return; }
      hide();
      onCircuit(id);
    };
    replaceChildren(right, h('header.fi-title', h('h3', '各省户口'), h('small', `${num(c.provinces.length)}省 · 合下辖府州之数 · 点表头排序`)),
      c.distorted || c.sealedMood ? h('p.fi-note', [c.distorted ? '全国与各省户口皆据有司所奏，未经核实' : '', c.sealedMood ? '各省民心、吏治未经核实，不列（据奏之数见舆图分州）' : ''].filter(Boolean).join('；')) : null,
      h('div.fi-prov', h('div.hd', CENSUS_COLS.map(th)),
        sorted(c.provinces).map((p) => h('div.row',
          h('button.n', { type: 'button', title: `${p.name}　翻通志`, onclick: () => go(p) }, provinceShort(p.name)),
          h('span.bar', h('i', { style: { width: `${(p.mouths / max) * 100}%` } }), h('b', amt(p.mouths))),
          h('span.k-households', amt2(p.households)), h('span.k-ding', amt2(p.ding)), h('span', p.fugitives ? amt2(p.fugitives) : '无'),
          h('span.chip' + moodTone(p.minxin), p.minxin != null ? num(p.minxin) : '未核'), h('span.chip' + moodTone(p.lizhi), p.lizhi != null ? num(p.lizhi) : '未核')))));
  }

  function show(which) {
    if (which) { tab = which; tabs.setValue(which); }
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
