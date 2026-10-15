// 方志、通志：一府一州（一道）的志书。照 CK3、EU5 的地块页靠左展开、舆图露着（同志 10-11：原先摊成整本册页盖住舆图，不如老界面的方志）：
//   卷首一幅此地小景（从活舆图斜看此地，本块描金，scenery 回调给图），其上压志名、路径、名目；右上是图上、退回、收起；
//   其下纸面一叶接着往下读：状态小签、隶属主官上官地形税级诸签、描述、读数带、本道排名；一排检签（户役、财赋……）点哪卷读哪卷；
//   卷底是动作（照身份）与展通志、展势力。舆图开着时点别的府州，志窗就换成那一处；与人物窗同占左边一扇，开一扇收一扇。
// 所检之卷——户役（并役政一节）、财赋、军备（在驻之师）、职官、风物（物产格）、营造（工役卡）、账本（赋税核算、公库、实绩、灾异）。
// 据奏之数标「据奏」或「据报」。入口：入图后点府州小签。数据与动作经 game.fangzhi（adapter/fangzhi.js）。
// 本方府州的营造卷可「兴造」：剧本工籍点选，或自拟营造（配了模型可先请有司核议），录入议事清册，颁行后由回合推演核办（game.yingzao）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, numText, roundSig } from '../core/numerals.js';
import { juan, qianzi, shu, yapaiOff } from '../kit/index.js';
import { plainError } from '../core/plain.js';

const toast = (text) => bus.emit('kernel:toast', { text });
// 内核写好的说明文字里夹着阿拉伯数字（「民心 37 忧」「3.6万」「1627年」），按记数设置改写（core/numerals numText）
const digits = numText;
// 数：大数取四位有效，按记数设置写；负数前加「−」；字里夹的整数也按记数设置改写
const PUBLIC_VOLS = new Set(['fengwu', 'yingzao']);
const BAND_VOL = { 户口: 'huyi', 实征: 'caifu', 驻军: 'junbei', 吏治: 'zhiguan' };
const roughOf = (v) => (typeof v === 'number' ? (Math.abs(v) < 10 ? '寥寥' : `约${num(roundSig(Math.abs(v), 1))}`) : v);
// 读数带一格：大略时民心吏治写等第，余者写约数
const roughStat = (x) => h('div.fz-stat.rough', h('small', x.k, h('em', '大略')), h('b', /民心|吏治/.test(x.k) && x.sub ? x.sub : roughOf(x.v)));
const fmt = (v, unit) => (typeof v === 'number' ? `${v < 0 ? '−' : ''}${num(Math.abs(v) >= 1e4 ? roundSig(Math.abs(v), 4) : Math.round(Math.abs(v) * 10) / 10)}${unit || ''}` : `${digits(v)}${unit ? unit : ''}`);

// role()：此身份能做什么（screens/desk.js）——元首一档照原有动作；余者只在所掌之地（无官者本籍）列与身份相符的行文、行止，灰着写缘由
// knows({ region } | { circuit })：所知之律——'full' 册籍俱见；'rough' 所掌之外只知大略：读数带的数只取一位有效冠「约」，民心吏治只写等第，
//   本道排名不列，户役财赋军备职官诸志与账本不得而见，风物、营造是人所共见；通志的辖境、财计也只写大略
// opens(志键)：京官本衙门所司的那一门册籍天下各地都见（户部户役财赋账本、兵部军备、吏部职官），读数带里对应那格也写确数
// scenery({ kind: 'region'|'circuit', id, name }) → Promise<canvas|null>：卷首小景；locate(kind, id) 舆图镜头飞去
export function createFangzhi({ root, game, profile, onPerson, onFaction, role = () => ({ sovereign: true, ro: '' }), knows = () => 'full', opens = () => false, scenery = null, locate = null }) {
  const F = game.fangzhi;
  const Y = game.yingzao;
  const suggestBook = () => { const p = typeof profile === 'function' ? profile() : profile; return (p && p.ling && p.ling.suggest) || '议事清册'; };
  let cur = null;          // 当前方志数据
  let vol = 'huyi';
  let mode = 'region';     // region 方志 | circuit 通志
  let curC = null;         // 当前通志数据
  let cvol = 'xiajing';
  let opened = false;

  let history = [];        // 看过的几处（退回）：[{ mode, key }]
  const pic = h('div.zw-pic');
  const name = h('div.zw-name');
  const flyBtn = h('button.zw-ctl', { type: 'button', title: '舆图镜头移至此地', onclick: () => locate && locate(mode, mode === 'circuit' ? curC.key : cur.id) }, '图');
  const backBtn = h('button.zw-ctl', { type: 'button', title: '退回上一处', onclick: () => goBack() }, '‹');
  const shutBtn = h('button.zw-ctl', { type: 'button', title: '收起（Esc）', onclick: () => hide() }, '×');
  const hero = h('section.zw-hero', pic, h('div.zw-ctls', flyBtn, backBtn, shutBtn), name);
  const left = h('div.zw-top');            // 页头以下、检签以上：小签、描述、读数带、排名
  const tabs = h('nav.zw-tabs');
  // 检签一排装不下（窄屏、字号放大）就去掉签前的小方字，只留卷名；排完量一下再定
  function fitTabs() {
    tabs.classList.remove('tight');
    requestAnimationFrame(() => tabs.classList.toggle('tight', tabs.scrollWidth > tabs.clientWidth + 1));
  }
  const right = h('div.zw-body');          // 所检之卷
  const foot = h('footer.zw-foot');
  const sheet = h('div.zw-sheet.q-scroll', left, tabs, right);
  const ov = h('aside.zw', { role: 'dialog', 'aria-label': '方志' }, hero, sheet, foot);
  root.append(ov);
  // 卷首小景：开窗即先铺素绢，图渲好了换上（同一处只渲一回）
  let sceneTok = 0;
  function paintScene(kind, id, label) {
    const tok = ++sceneTok;
    pic.classList.remove('ready');
    if (!scenery) return;
    requestAnimationFrame(() => Promise.resolve(scenery({ kind, id, name: label })).then((c) => {
      if (tok !== sceneTok || !c) return;
      replaceChildren(pic, c);
      pic.classList.add('ready');
    }, () => {}));
  }
  function nameplate(sealText, crumbs, title, level) {
    replaceChildren(name, h('span.zw-seal', sealText), h('div', crumbs, h('h2', title), level ? h('small', level) : null));
  }

  const who = (name, isChar) => (name && isChar && onPerson ? h('a.fz-who', { onclick: () => onPerson(name) }, name) : h('span', name || ''));

  function renderLeft() {
    const d = cur;
    const hd = d.head;
    const crumbs = h('p.fz-crumbs',
      hd.owner ? (onFaction ? h('a', { onclick: () => onFaction(hd.ownerKey || hd.owner) }, hd.owner) : h('span', hd.owner)) : null,
      hd.circuit ? [h('i', '›'), h('a', { onclick: () => showCircuit(hd.circuit.key) }, hd.circuit.label)] : null, h('i', '›'), h('b', hd.name));
    const pills = [
      hd.owner ? h('span.fz-pill', '隶　', h('b', hd.owner)) : null,
      hd.governor ? h('span.fz-pill' + (hd.governor.vacant ? '.bad' : ''), `${hd.governor.office}　`, who(hd.governor.name, hd.governor.isChar), hd.governor.adm != null ? h('small', `政${num(hd.governor.adm)}`) : null) : null,
      hd.superior ? h('span.fz-pill', '上官　', h('b', hd.superior.role), '　', who(hd.superior.who, hd.superior.isChar), hd.superior.tail ? h('small', hd.superior.tail) : null) : null,
      hd.terrain ? h('span.fz-pill', hd.terrain) : null,
      hd.tax ? h('span.fz-pill', '税　', h('b', hd.tax)) : null
    ].filter(Boolean);
    const status = hd.status.length ? h('div.fz-status', hd.status.map((s) => h('span.fz-zt.' + (s.tone || 'mid'), { title: [s.name, s.desc, s.effects.join('，')].filter(Boolean).join(' · ') },
      h('i', s.seal), s.name, h('em', s.left == null ? '永续' : `余${num(s.left)}回合`)))) : null;
    const rough = knows({ region: d.id }) === 'rough';
    const band = h('div.fz-band', d.band.map((x) => rough && !opens(BAND_VOL[x.k]) ? roughStat(x) : h('div.fz-stat' + (x.warn ? '.warn' : ''),
      h('small', x.k, x.reported ? h('em', '据奏') : null), h('b', typeof x.v === 'number' && Math.abs(x.v) >= 1e4 ? num(roundSig(x.v, 3)) : fmt(x.v)),   // 读数带只看个大数：三位有效
      x.subN != null ? h('span', `${x.subPre || ''}${fmt(x.subN)}${x.subPost || ''}`, x.subTag ? h('em', x.subTag) : null) : x.sub ? h('span', x.sub) : null)));
    const rank = d.rank && !rough ? h('p.fz-rank', h('a.fz-circ', { title: '展其通志', onclick: () => showCircuit(d.rank.circuit.key) }, d.rank.circuit.label), h('small', `本方${num(d.rank.of)}州中`),
      d.rank.items.map((it) => h('span' + (it.low ? '.low' : ''), `${it.label}第${num(it.rank)}`))) : null;
    const slips = d.vols.map((v) => h('button.fz-slip' + (v.key === vol ? '.on' : '') + (rough && !PUBLIC_VOLS.has(v.key) && !opens(v.key) ? '.lock' : ''), { type: 'button', title: v.sub, onclick: () => { vol = v.key; renderLeft(); renderRight(); } },
      h('i', v.seal), h('b', v.name.replace(/志$/, ''))));
    const R = role();
    let acts = null;
    if (R.sovereign && (d.acts.length || d.canReassign)) {
      acts = h('div.fz-acts', R.ro ? [...d.acts, ...(d.canReassign ? ['改隶'] : [])].map((a) => yapaiOff(a, R.ro)) : [
        d.acts.map((a) => h('button.q-yapai', { type: 'button', title: '录入议事清册，候诏颁行', onclick: () => doAct(a) }, a)),
        d.canReassign ? h('button.q-yapai', { type: 'button', title: '改隶他道（入议事清册，回合末落地）', onclick: () => reassign() }, '改隶') : null]);
    } else if (!R.sovereign && R.own(d.id)) {
      const tour = R.acts.tour;
      acts = h('div.fz-acts', (R.acts.own || []).map(([label, note]) => yapaiOff(label, R.off, { note })), tour ? yapaiOff(tour[0], R.off, { note: tour[1] }) : null);
    }
    nameplate('方志', crumbs, hd.name, hd.level);
    replaceChildren(left, status, pills.length ? h('div.fz-pills', pills) : null, hd.desc ? h('p.fz-desc', hd.desc) : null, band, rank);
    replaceChildren(tabs, slips);
    fitTabs();
    replaceChildren(foot, acts, h('span.zw-nav',
      hd.circuit ? h('button.q-yapai', { type: 'button', title: hd.circuit.label, onclick: () => showCircuit(hd.circuit.key) }, '展通志') : null,
      hd.owner && onFaction ? h('button.q-yapai', { type: 'button', title: hd.owner, onclick: () => onFaction(hd.ownerKey || hd.owner) }, '展势力') : null));
  }

  // rough：所掌之外只知大略，数取一位有效冠「约」
  const val = (v, unit, rough) => (rough && typeof v === 'number' ? `${roughOf(v)}${unit || ''}` : fmt(v, unit));
  function rowsEl(rows, rough = false) {
    // 一行两对；字长的一对占满一行（承载上限、保甲之类）
    return h('dl.fz-rows', rows.map((r) => {
      const v = val(r.v, r.unit, rough);
      const wide = String(v).length > 11 || (r.note && !rough && String(r.note).length > 14) ? '.wide' : '';
      return [h('dt' + wide, r.k, r.tag ? h('em', r.tag) : null), h('dd.' + (r.tone || 'plain') + wide, v, r.note && !rough ? h('small', digits(r.note)) : null)];
    }));
  }
  function renderRight() {
    const v = cur.vols.find((x) => x.key === vol) || cur.vols[0];
    if (!v) { replaceChildren(right); return; }
    const head = h('p.fz-vsub', v.sub);
    const body = [];
    if (knows({ region: cur.id }) === 'rough' && !PUBLIC_VOLS.has(v.key) && !opens(v.key)) {
      replaceChildren(right, head, h('div.fz-vbody', h('p.fz-lock', h('b', '册籍不得而见'), '此地非所掌，户口、钱粮、兵备、官守诸册都在有司手里；所知者，邸报所载与风物而已。')));
      return;
    }
    if (v.armies && v.armies.length) body.push(h('div.fz-armies', v.armies.map((a) => h('div.fz-army', h('b', a.name), h('span', fmt(a.soldiers), a.reported ? h('em', '据奏') : null),
      a.commander ? who(a.commander, true) : null, a.morale != null ? h('small' + (a.morale < 45 ? '.low' : ''), `气${num(a.morale)}`) : null))));
    const rough = knows({ region: cur.id }) === 'rough' && !opens(v.key);
    if (v.grid && v.grid.length) body.push(h('div.fz-grid', v.grid.map((g) => h('div', h('small', g.k), h('b', val(g.v, g.unit, rough))))));
    if (v.rows && v.rows.length) body.push(rowsEl(v.rows, rough));
    if (v.note) body.push(h('p.fz-note', digits(v.note)));
    if (v.sub2) body.push(h('section.fz-sub', h('h4', v.sub2.title, h('small', v.sub2.note)), rowsEl(v.sub2.rows, rough)));
    if (v.key === 'yingzao') {
      body.push(v.works.length
        ? h('div.fz-works', v.works.map((wk) => h('div.fz-work.' + wk.tone,
            h('p.fz-wk-head', h('b', wk.name), h('small', wk.level), h('em', wk.status)),
            wk.desc ? h('p', wk.desc) : null,
            wk.fx.length ? h('p.fz-fx', wk.fx.map((x) => h('span', x))) : null,
            wk.applied.length ? h('p.fz-wk-note', `实入账：${wk.applied.join(' · ')}`) : null,
            wk.flowPct > 0 ? h('p.fz-wk-note', digits(`工成之利：地方岁入每回合+${wk.flowPct}%`)) : null,
            wk.progress != null ? h('div.fz-prog', h('i', { style: { width: `${wk.progress}%` } }), h('small', `余${num(wk.left)}回合`)) : null)))
        : h('p.fz-note', '此地尚无在册工役。'));
      if (role().sovereign && !role().ro && cur.mine && cur.liveName && Y && Y.ready()) body.push(h('div.fz-acts', h('button.q-yapai', { type: 'button', title: `拟一件营造案，录入${suggestBook()}`, onclick: () => xingzao() }, '兴造')));
    }
    if (v.ledger) body.push(...ledgerEls());
    replaceChildren(right, head, h('div.fz-vbody', body));
  }
  function ledgerEls() {
    let L = null;
    try { L = F.ledger(cur.id); } catch (e) { toast(e.message); }
    if (!L) return [h('p.fz-note', '此地无账可查。')];
    const out = [];
    const sec = (title, note, ...kids) => h('section.fz-sub', h('h4', title, note ? h('small', note) : null), ...kids);
    const fs = (v, unit) => (v ? `${num(Math.abs(v) >= 1e4 ? roundSig(v, 3) : Math.round(v))}${unit || ''}` : '—');   // 表里取三位有效，零记「—」
    if (L.taxes) out.push(sec('赋税核算', '按现行税则与征收损耗预计一年；钱、粮、布分计',
      h('table.fz-table.fz-ledger', h('thead', h('tr', ['税目', '税基', '名义', '上解', '留用'].map((t) => h('th', t)))),
        h('tbody', L.taxes.rows.map((x) => h('tr', h('td', x.name), h('td', x.base == null ? '—' : [fs(x.base, x.baseUnit), h('i', x.baseKind)]),
          h('td', fs(x.nominal, x.unit)), h('td', fs(x.central, x.unit)), h('td', fs(x.local, x.unit)))))),
      L.taxes.total.length ? h('p.fz-note', `合计上解　${L.taxes.total.map((t) => fmt(t.central, t.unit)).join('　')}`) : null));
    if (L.treasury) {
      const T = L.treasury;
      out.push(sec('公库三账', '本地库藏',
        h('div.fz-books', T.books.map((bk) => h('div.fz-book' + (bk.deficit ? '.bad' : ''),
          h('p', h('small', bk.label), bk.deficit ? h('em', `亏${fmt(bk.deficit)}`) : null), h('b', fmt(bk.stock, bk.unit)),
          bk.quota ? [h('i.fz-bar', h('i', { style: { width: `${bk.fill}%` } })), h('small', `额${fmt(bk.quota)} · 实占${num(bk.fill)}%`)] : null,
          bk.inflow || bk.outflow ? h('small', [bk.inflow ? `本回合入${fmt(bk.inflow)}` : '', bk.outflow ? `出${fmt(bk.outflow)}` : ''].filter(Boolean).join('　')) : null))),
        T.head || T.prev || T.handovers ? h('p.fz-note', [T.head ? `现掌库　${T.head}` : '', T.prev ? `前任　${T.prev}` : '', T.handovers ? `交接案卷${num(T.handovers)}条` : ''].filter(Boolean).join('　·　')) : null));
    }
    out.push(sec('本回合实绩', '与上回合比',
      L.achieve.length ? h('dl.fz-rows.fz-achieve', L.achieve.map((a) => [h('dt', a.label),
        h('dd.' + (a.delta > 0 ? 'good' : 'bad'), `${fmt(a.before)} → ${fmt(a.after, a.unit)}`,
          h('small', `${a.delta > 0 ? '+' : '−'}${fmt(Math.abs(a.delta))}${a.pct != null && Math.abs(a.pct) >= 0.1 ? `（${a.delta > 0 ? '+' : '−'}${Math.abs(a.pct)}%）` : ''}${a.note ? `　${a.note}` : ''}`))]))
        : h('p.fz-note', L.firstTurn ? '尚无上回合之数可比——首回合或新近设立。' : '本回合诸数与上回合无异。')));
    if (L.disasters.length || L.loss) out.push(sec('在灾实录', '',
      L.disasters.map((d) => h('p.fz-zai', h('b', d.kind), h('em', d.sev), d.since != null ? h('small', `起于第${num(d.since)}回合`) : null, d.note ? h('span', d.note) : null)),
      L.loss ? h('p.fz-zai.bad', `本回合税基折损：田减${num(L.loss.farm)}%，商减${num(L.loss.trade)}%`) : null));
    return out;
  }

  function doAct(kind) {
    let ok = false;
    try { ok = F.act(cur.id, kind); } catch (e) { toast(e.message); return; }
    if (ok) toast(`已录入议事清册：${cur.head.name}${kind}`);
  }
  function reassign() {
    let o;
    try { o = F.reassignOptions(cur.id); } catch (e) { toast(e.message); return; }
    if (!o.ok) { toast(o.reason); return; }
    const near = o.targets.filter((t) => t.adjacent), far = o.targets.filter((t) => !t.adjacent);
    const pick = (t) => { let ok = false; try { ok = F.reassign(cur.id, t.key); } catch (e) { toast(e.message); return; } if (ok) { toast(`已录入议事清册：改隶${cur.head.name}于${t.label}`); j.close('ok'); } };
    const j = juan({
      title: '改隶', note: cur.head.name, width: '30rem',
      content: h('div.fz-reassign',
        h('p', `原隶${o.from || '本道'}。择所改隶之道（入议事清册，回合末三处同改：行政、舆图、省道）。`),
        near.length ? h('div', near.map((t) => h('button.q-yapai', { type: 'button', onclick: () => pick(t) }, t.label))) : h('p.fz-note', '无接壤之道。'),
        far.length ? h('details', h('summary', `另有${num(far.length)}道不接壤（成飞地）`), h('div', far.map((t) => h('button.q-yapai', { type: 'button', onclick: () => pick(t) }, t.label)))) : null)
    });
  }

  // ---------- 兴造 ----------
  function xingzao() {
    let o = null;
    try { o = Y.open(cur.liveName); } catch (e) { toast(e.message); return; }
    if (!o) return;
    const book = suggestBook();
    const place = o.divName;
    let busy = false;
    const done = (ok) => {
      if (!ok) return;
      j.close('ok');
      try { const d = F.region(cur.id); if (d) { cur = d; vol = 'yingzao'; renderLeft(); renderRight(); } } catch (_e) { /* 照旧 */ }
    };
    // 剧本工籍：点一件即录入
    const pick = (b) => { let ok = false; try { ok = Y.submitCatalogue(b.index); } catch (e) { toast(e.message); return; } done(ok); };
    const pre = h('div.yz-list', o.catalogue.length
      ? o.catalogue.map((b) => h('button.yz-item', { type: 'button', title: `录入${book}`, onclick: () => pick(b) },
          h('i.yz-cat', b.cat.slice(0, 2)),
          h('div.yz-main', h('b', b.name), b.desc ? h('p', b.desc.length > 110 ? `${b.desc.slice(0, 110)}…` : b.desc) : null,
            b.fx.length ? h('p.fz-fx', b.fx.map((x) => h('span', digits(String(x).replace(/\s+/g, ''))))) : null),
          h('small.yz-meta', `基费${num(b.cost)}${o.unit}`, h('br'), `工期${num(b.time)}回合`, h('br'), `至${num(b.maxLevel)}级`)))
      : h('p.fz-note', '剧本未定工籍——请转「自拟营造」。'));
    // 自拟营造：名目、类属、规制；可请有司核议
    const name = h('input.yz-in', { type: 'text', placeholder: '如：兴文馆／水车坊／义仓', maxlength: '24' });
    const result = h('div.yz-result');
    let verdict = null;            // 本稿的核议（改了规制即作废）
    const stale = () => { if (verdict || result.childElementCount) { verdict = null; replaceChildren(result, h('p.fz-note', '规制已改，旧核议不再采用；可重新核议，或径直录入。')); } };
    name.addEventListener('input', stale);
    const cat = qianzi(Y.CATEGORIES.map((c) => ({ value: c.key, label: c.label })), { value: 'economic', onchange: stale });
    const desc = shu({ placeholder: '告示有司：欲修何物、预期何效。例：修文馆以藏书刻版，供士子入内议事，以兴文风、安士心。', rows: 4, oninput: stale });
    const req = () => ({ name: name.value.trim(), category: cat.getValue(), description: desc.value.trim() });
    const filled = () => { const r = req(); if (!r.name || !r.description) { toast('请填写工役名目与规制'); return null; } return r; };
    const appraiseBtn = o.agent ? h('button.q-yapai', { type: 'button', onclick: () => appraise() }, '请有司核议') : null;
    async function appraise() {
      const r = filled();
      if (!r || busy) return;
      busy = true;
      appraiseBtn.disabled = true;
      replaceChildren(result, h('p.fz-note', '有司勘议中……'));
      let a = null;
      try { a = await Y.appraise(r); } catch (e) { a = { ok: false, reason: plainError(e.message) }; }
      busy = false;
      appraiseBtn.disabled = false;
      if (a.stale || !result.isConnected) return;
      const now = req();
      if (now.name !== r.name || now.category !== r.category || now.description !== r.description) return;   // 核议中改了规制
      if (!a.ok) { verdict = null; replaceChildren(result, h('p.yz-fail', `有司未能核议：${a.reason}。可径直录入，由回合推演核定。`)); return; }
      verdict = a.appraisal;
      const v = verdict;
      const tone = v.feasibility === '不合理' ? 'bad' : v.feasibility === '勉强' ? 'mid' : 'good';
      replaceChildren(result, h('div.yz-verdict.' + tone,
        h('p.yz-vhead', h('b', v.feasibility), v.cost != null ? h('span', `估造价${num(v.cost)}${o.unit}`) : null, v.time != null ? h('span', `工期${num(v.time)}回合`) : null),
        v.labels.length ? h('p.fz-fx', v.labels.map((x) => h('span', digits(x.replace(/\s+/g, ''))))) : v.trimmed ? h('p.yz-fail', '所拟效用越出可落之账，已削为纯叙事工役。') : null,
        v.effects ? h('p', v.effects) : null,
        v.reason ? h('p.yz-judge', `判语：${v.reason}`) : null,
        v.upkeep != null ? h('p.fz-note', `完工后地方养护约每回合${num(v.upkeep)}${o.unit}，以落账为准。`) : null,
        h('p.fz-note', v.feasibility === '不合理' ? '有司核为不合理，录入时不附核议；可改规制后重核。' : `录入时附此核议，供颁行时参考；此处不扣款、不计工期。`)));
    }
    const submit = () => { const r = filled(); if (!r || busy) return; let ok = false; try { ok = Y.submitCustom(r); } catch (e) { toast(e.message); return; } done(ok); };
    const cus = h('div.yz-cus',
      h('label.yz-field', h('small', '工役名目'), name),
      h('div.yz-field', h('small', '类属'), cat),
      h('label.yz-field', h('small', '规制与所求'), desc),
      h('p.yz-rule', '有司核定之制：颁行后由有司核其合理与否（合理、勉强、不合理），定实际造价与工期；效用只落在可记之账（田亩、商贸、盐铁、城防、驿路、解额、募兵、民心、吏治等），且以费用为度，小费小效、大费大效。变更制度风气者（如新式学堂、译书馆），可立持续全局之「国是·风气」，然必招既得之众阻挠。'),
      h('div.fz-acts', appraiseBtn, h('button.q-yapai', { type: 'button', onclick: submit }, `录入${book}`)),
      result);
    // 已立之制与学统风气：两页共见
    const rulesEl = o.rules.length ? h('section.yz-aside', h('h4', '国是 · 风气', h('small', '已立之制，持续生效')),
      o.rules.map((c) => h('div.yz-rule-card', h('p', h('b', c.name), h('em', c.status), h('small', `扎根${num(c.strength)}`)),
        h('i.yz-bar', h('i', { style: { width: `${Math.max(2, Math.min(100, c.strength))}%` } })),
        c.tends.length ? h('p.fz-fx', c.tends.map((t) => h('span', t))) : null,
        c.resist ? h('p.yz-fail', `阻力：${c.resist}`) : null))) : null;
    const tl = o.talent;
    const talentEl = tl ? h('section.yz-aside', h('h4', '人才与风气', h('small', '学统格局：学堂育才，历练渐渗')),
      tl.emergent.map((x) => h('div.yz-rule-card', h('p', h('b', x.label), h('em', x.tier), h('small', digits(`渗透${x.pct}%`))),
        h('i.yz-bar', h('i', { style: { width: `${Math.max(2, Math.min(100, x.pct))}%` } })),
        h('p.fz-note', `有效${num(x.stock)}　成熟${num(x.mature)}　在训${num(x.training)}　失业${num(x.idle)}　年招${num(x.intake)}　培养${num(x.quality)}%`))),
      tl.established.map((x) => h('p.fz-note', `既有正统　${x.label}　存量约${num(x.stock)}`)),
      tl.tends.length ? h('p.fz-fx', tl.tends.map((t) => h('span', digits(`${t.key}+${t.pct}%`)))) : null) : null;
    const panes = { pre, cus };
    const pane = h('div.yz-pane');
    const tabs = qianzi([{ value: 'pre', label: '剧本工籍' }, { value: 'cus', label: '自拟营造' }], { value: o.catalogue.length ? 'pre' : 'cus', onchange: (v) => replaceChildren(pane, panes[v]) });
    replaceChildren(pane, panes[tabs.getValue()]);
    const j = juan({
      title: '兴造', note: `于${place}营造工役 · 录入${book}，颁行后由回合推演核办`, width: '44rem',
      content: h('div.yz', tabs, pane, rulesEl, talentEl, h('p.fz-note', '此处只拟案，不扣款、不计工期。')),
      onclose: () => Y.close(o.ticket)
    });
  }

  // ---------- 通志 ----------
  const CVOLS = [['xiajing', '境', '辖境', '按问题轻重 · 点州展方志'], ['xingshi', '势', '形势', '战略边警 · 士绅书院'], ['caiji', '财', '财计', '实征起运 · 公帑'], ['yingzao', '营', '营造', '本道建筑 · 只作汇览']];
  function renderCircuitLeft() {
    const c = curC;
    const pills = [
      c.owner ? h('span.fz-pill', '隶　', h('b', c.owner)) : null,
      h('span.fz-pill', '实控　', h('b', `${num(c.held)}／${num(c.of)}`), '州'),
      c.capital ? h('span.fz-pill', '治所　', h('a.fz-who', { onclick: () => show(c.capital.id) }, c.capital.name)) : null,
      c.player ? null : h('span.fz-pill.bad', '他方所辖')
    ].filter(Boolean);
    const o = c.official;
    const official = o ? h('div.fz-official',
      h('p', h('small', o.role), '　', who(o.who, o.isChar)),
      o.ability != null ? h('p.fz-gov', h('span', `能力${num(o.ability)}`), o.band ? h('span', `履职${o.band}`) : null, h('span', o.state), o.seat ? h('span', `驻${o.seat}`) : null) : null,
      o.effect ? h('p.fz-gov-eff', '本道之效：', digits(o.effect)) : null, h('p.fz-note', o.count != null ? `统辖本道${num(o.count)}府州；${o.line}` : o.line)) : null;
    const rough = knows({ circuit: c.key }) === 'rough';
    const band = h('div.fz-band', c.band.map((x) => rough ? roughStat(x) : h('div.fz-stat' + (x.warn ? '.warn' : ''), h('small', x.k),
      h('b', typeof x.v === 'number' && Math.abs(x.v) >= 1e4 ? num(roundSig(x.v, 3)) : fmt(x.v)),
      x.subN != null ? h('span', `${x.subPre || ''}${fmt(x.subN)}${x.subPost || ''}`) : x.sub ? h('span', x.sub) : null)));
    const live = CVOLS.filter(([k]) => (k === 'xingshi') || (c[k] && (Array.isArray(c[k]) ? c[k].length : true)));
    if (!live.some(([k]) => k === cvol)) cvol = live[0] ? live[0][0] : 'xingshi';
    const slips = live.map(([k, seal, label]) => h('button.fz-slip' + (k === cvol ? '.on' : '') + (rough && (k === 'xiajing' || k === 'caiji') ? '.lock' : ''), { type: 'button', onclick: () => { cvol = k; renderCircuitLeft(); renderCircuitRight(); } }, h('i', seal), h('b', label)));
    const R = role();
    const acts = !R.sovereign || !(c.acts.length || c.canReassign) ? null : R.ro ? h('div.fz-acts', [...c.acts, ...(c.canReassign ? ['调整辖区'] : [])].map((a) => yapaiOff(a, R.ro)))
      : h('div.fz-acts', c.acts.map((a) => h('button.q-yapai', { type: 'button', title: '录入议事清册，候诏颁行', onclick: () => doCircuitAct(a) }, a)),
        c.canReassign ? h('button.q-yapai', { type: 'button', title: '州县划出划入（入议事清册，回合末落地）', onclick: () => circuitReassign() }, '调整辖区') : null);
    nameplate('通志', h('p.fz-crumbs', c.owner ? (onFaction ? h('a', { onclick: () => onFaction(c.ownerKey || c.owner) }, c.owner) : h('span', c.owner)) : null, h('i', '›'), h('b', c.name)),
      c.name, `省道 · 辖${num(c.members)}府州`);
    replaceChildren(left, pills.length ? h('div.fz-pills', pills) : null, c.desc ? h('p.fz-desc', c.desc) : null, official, band);
    replaceChildren(tabs, slips);
    fitTabs();
    replaceChildren(foot, acts, h('span.zw-nav', c.owner && onFaction ? h('button.q-yapai', { type: 'button', title: c.owner, onclick: () => onFaction(c.ownerKey || c.owner) }, '展势力') : null));
  }
  function renderCircuitRight() {
    const c = curC;
    const meta = CVOLS.find(([k]) => k === cvol) || CVOLS[1];
    const head = h('p.fz-vsub', meta[3]);
    const body = [];
    const reg = (x) => h('a.fz-who', { onclick: () => show(x.id) }, x.name);
    const rough = knows({ circuit: c.key }) === 'rough';
    if (rough && (cvol === 'xiajing' || cvol === 'caiji')) {
      body.push(h('p.fz-lock', h('b', '册籍不得而见'), '此道非所掌，各州户口、钱粮、兵数与问题都在有司手里；只见形势与营造。'));
      if (cvol === 'xiajing' && c.xiajing) body.push(h('p.fz-note', '辖下：', c.xiajing.rows.map((x, i) => [i ? '、' : '', reg(x)])));
    } else if (cvol === 'xiajing' && c.xiajing) {
      const xj = c.xiajing;
      if (xj.common) body.push(h('p.fz-common', `全道共性（${num(xj.common.count)}／${num(xj.common.of)}州）：`, h('b', xj.common.items.join(' · ')), '。下列各州只标独有的问题。'));
      body.push(h('table.fz-table', h('thead', h('tr', ['府州', '户口', '实征', '驻军', '民心', '吏治', '主因'].map((t) => h('th', t)))),
        h('tbody', xj.rows.map((x) => h('tr' + (x.warn ? '.warn' : ''), h('td', reg(x)), h('td', x.pop == null ? '—' : fmt(x.pop)), h('td', x.tax == null ? '—' : fmt(x.tax)),
          h('td', x.troops == null ? '—' : fmt(x.troops)), h('td', x.mood == null ? '—' : fmt(x.mood), h('i', x.moodMark)), h('td', x.office == null ? '—' : fmt(x.office), h('i', x.officeMark)),
          h('td.why', x.reasons.length ? digits(x.reasons.join('；')) : '—'))))));
      xj.others.forEach((o) => body.push(h('p.fz-note', `隶${o.owner}：`, o.regions.map((x, i) => [i ? '、' : '', reg(x)]))));
    } else if (cvol === 'xingshi') {
      body.push(rowsEl(c.xingshi));
    } else if (cvol === 'caiji') {
      body.push(rowsEl(c.caiji), h('p.fz-note', '本道只汇总展示，不单独记账。'));
    } else if (cvol === 'yingzao' && c.yingzao) {
      const y = c.yingzao;
      if (y.empty) body.push(h('p.fz-note', y.empty));
      else {
        body.push(h('p.fz-common', `在册${num(y.total)}座：完好${num(y.status.intact)}、在建${num(y.status.building)}、失修${num(y.status.neglected)}、半损${num(y.status.damaged)}`), h('p.fz-note', y.cats.join(' · ')));
        body.push(h('div.fz-works', y.regions.map((x) => h('p.fz-yz', reg(x), x.capital ? h('em', '首府') : null, h('span', x.items.join('、'))))));
      }
    }
    replaceChildren(right, head, h('div.fz-vbody', body));
  }
  function circuitReassign() {
    let o;
    try { o = F.circuitReassignOptions(curC.key); } catch (e) { toast(e.message); return; }
    if (!o.ok) { toast(o.reason); return; }
    const pick = (id, name, key, label) => {
      let ok = false;
      try { ok = F.reassign(id, key); } catch (e) { toast(e.message); return; }
      if (ok) { toast(`已录入议事清册：改隶${name}于${label}`); j.close('ok'); }
    };
    const j = juan({
      title: '调整辖区', note: o.name, width: '34rem',
      content: h('div.fz-reassign',
        h('p', '选定一条即录入议事清册，回合末三处同改（行政、舆图、省道）。首府不可划出。'),
        h('h4.fz-rs-sec', '划出本道'),
        o.out.length ? o.out.map((x) => h('div.fz-rs-row', h('span', x.name), h('div', x.targets.map((t) => h('button.q-yapai', { type: 'button', title: `改隶${t.label}`, onclick: () => pick(x.id, x.name, t.key, t.label) }, `入${t.label}`)))))
          : h('p.fz-note', '本道各州没有接壤的本方别道可改隶。'),
        o.into.length ? [h('h4.fz-rs-sec', '划入本道'), o.into.map((x) => h('div.fz-rs-row', h('span', x.name, h('small', `今隶${x.from}`)),
          h('div', h('button.q-yapai', { type: 'button', onclick: () => pick(x.id, x.name, o.key, o.name) }, '划入本道'))))] : null)
    });
  }
  function doCircuitAct(kind) {
    let ok = false;
    try { ok = F.circuitAct(curC.key, kind); } catch (e) { toast(e.message); return; }
    if (ok) toast(`已录入议事清册：${curC.name}${kind}`);
  }
  async function showCircuit(key) {
    try { await F.ensureCircuits(); } catch (_e) { /* 下面自会报 */ }
    let c = null;
    try { c = F.circuit(key); } catch (e) { toast(e.message); return; }
    if (!c) { toast('此地未隶正式省道'); return; }
    remember('circuit', c.key);
    curC = c;
    mode = 'circuit';
    renderCircuitLeft();
    renderCircuitRight();
    open('circuit', c.key, c.name);
  }

  async function show(id) {
    try { await F.ensureCircuits(); } catch (_e) { /* 无省道分组照样开 */ }
    let d = null;
    try { d = F.region(id); } catch (e) { toast(e.message); return; }
    if (!d) { toast('此地无志可展'); return; }
    remember('region', d.id);
    cur = d;
    mode = 'region';
    if (!cur.vols.some((v) => v.key === vol)) vol = cur.vols[0] ? cur.vols[0].key : 'huyi';
    if (knows({ region: cur.id }) === 'rough' && !PUBLIC_VOLS.has(vol) && !opens(vol)) vol = (cur.vols.find((v) => opens(v.key)) || { key: 'fengwu' }).key;   // 所掌之外先翻本衙所司或人所共见的风物志
    renderLeft();
    renderRight();
    open('region', d.id, d.head.name);
  }
  // 换一处之前记下当前这处（退回用）；同一处不记
  function remember(m, key) {
    if (!opened) { history = []; return; }
    const here = mode === 'circuit' ? curC && { mode, key: curC.key } : cur && { mode, key: cur.id };
    if (here && !(here.mode === m && String(here.key) === String(key))) history = [...history, here].slice(-12);
  }
  function open(kind, key, label) {
    backBtn.hidden = !history.length;
    flyBtn.hidden = !locate;
    sheet.scrollTop = 0;
    paintScene(kind, key, label);
    ov.classList.add('on');
    if (!opened) bus.emit('zhi:shown', { kind, key });
    opened = true;
  }
  function goBack() {
    const prev = history.pop();
    if (!prev) return;
    const keep = history;
    opened = false;                                   // 退回不再记
    (prev.mode === 'circuit' ? showCircuit(prev.key) : show(prev.key)).then(() => { history = keep; backBtn.hidden = !history.length; });
  }
  function hide() {
    if (!opened) return;
    ov.classList.remove('on');
    opened = false;
    history = [];
    bus.emit('zhi:hidden', {});
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => {
    if (!opened) return;
    try {
      if (mode === 'circuit' && curC) { const c = F.circuit(curC.key); if (c) { curC = c; renderCircuitLeft(); renderCircuitRight(); } }
      else if (cur) { const d = F.region(cur.id); if (d) { cur = d; renderLeft(); renderRight(); } }
    } catch (_e) { /* 照旧 */ }
  });
  return { show, showCircuit, hide, get opened() { return opened; }, get mode() { return opened ? mode : ''; } };
}
