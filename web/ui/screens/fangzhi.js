// 方志：一府一州的志书，绫裱册页。左叶：页头（路径、名目、状态小签、隶属主官上官地形税级诸签、描述）、读数带、本道排名、六卷检签、页脚动作；
// 右叶：所检之卷——户役（并役政一节）、财赋、军备（在驻之师）、职官、风物（物产格）、营造（工役卡）。
// 据奏之数标「据奏」或「据报」。入口：入图后点府州小签。数据与动作经 game.fangzhi（adapter/fangzhi.js）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
// 内核写好的说明文字里夹着阿拉伯数字（「民心 37 忧」），按记数设置改写
const digits = (t) => String(t).replace(/(?<![\d.])\d+(?![\d.])/g, (m) => num(Number(m)));   // 只改整数，小数（执行率 +1.5%）照旧
// 数：大数取四位有效，按记数设置写；负数前加「−」；字照原样
const fmt = (v, unit) => (typeof v === 'number' ? `${v < 0 ? '−' : ''}${num(Math.abs(v) >= 1e4 ? roundSig(Math.abs(v), 4) : Math.round(Math.abs(v) * 10) / 10)}${unit || ''}` : `${v}${unit ? unit : ''}`);

export function createFangzhi({ root, game, onPerson, onFaction }) {
  const F = game.fangzhi;
  let cur = null;          // 当前方志数据
  let vol = 'huyi';
  let mode = 'region';     // region 方志 | circuit 通志
  let curC = null;         // 当前通志数据
  let cvol = 'xiajing';
  let opened = false;

  const left = h('section.ce-leaf.left.fz-left');
  const right = h('section.ce-leaf.right.fz-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.fz-ov', { role: 'dialog', 'aria-label': '方志' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

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
    const band = h('div.fz-band', d.band.map((x) => h('div.fz-stat' + (x.warn ? '.warn' : ''),
      h('small', x.k, x.reported ? h('em', '据奏') : null), h('b', typeof x.v === 'number' && Math.abs(x.v) >= 1e4 ? num(roundSig(x.v, 3)) : fmt(x.v)),   // 读数带只看个大数：三位有效
      x.subN != null ? h('span', `${x.subPre || ''}${fmt(x.subN)}${x.subPost || ''}`, x.subTag ? h('em', x.subTag) : null) : x.sub ? h('span', x.sub) : null)));
    const rank = d.rank ? h('p.fz-rank', h('a.fz-circ', { title: '展其通志', onclick: () => showCircuit(d.rank.circuit.key) }, d.rank.circuit.label), h('small', `本方${num(d.rank.of)}州中`),
      d.rank.items.map((it) => h('span' + (it.low ? '.low' : ''), `${it.label}第${num(it.rank)}`))) : null;
    const slips = h('div.fz-slips', d.vols.map((v) => h('button.fz-slip' + (v.key === vol ? '.on' : ''), { type: 'button', onclick: () => { vol = v.key; renderLeft(); renderRight(); } },
      h('i', v.seal), h('b', v.name))));
    const acts = d.acts.length || d.canReassign ? h('div.fz-acts',
      d.acts.map((a) => h('button.q-yapai', { type: 'button', title: '录入议事清册，候诏颁行', onclick: () => doAct(a) }, a)),
      d.canReassign ? h('button.q-yapai', { type: 'button', title: '改隶他道（入议事清册，回合末落地）', onclick: () => reassign() }, '改隶') : null) : null;
    replaceChildren(left,
      h('header.fz-head', h('span.fz-seal', '方志'), h('div', crumbs, h('h2', hd.name), hd.level ? h('small.fz-level', hd.level) : null)),
      status, pills.length ? h('div.fz-pills', pills) : null,
      hd.desc ? h('p.fz-desc', hd.desc) : null,
      band, rank, slips, acts);
  }

  function rowsEl(rows) {
    return h('dl.fz-rows', rows.map((r) => [h('dt', r.k, r.tag ? h('em', r.tag) : null), h('dd.' + (r.tone || 'plain'), fmt(r.v, r.unit), r.note ? h('small', r.note) : null)]));
  }
  function renderRight() {
    const v = cur.vols.find((x) => x.key === vol) || cur.vols[0];
    if (!v) { replaceChildren(right); return; }
    const head = h('header.fz-vhead', h('span.fz-vseal', v.seal), h('h3', v.name), h('small', v.sub));
    const body = [];
    if (v.armies && v.armies.length) body.push(h('div.fz-armies', v.armies.map((a) => h('div.fz-army', h('b', a.name), h('span', fmt(a.soldiers), a.reported ? h('em', '据奏') : null),
      a.commander ? who(a.commander, true) : null, a.morale != null ? h('small' + (a.morale < 45 ? '.low' : ''), `气${num(a.morale)}`) : null))));
    if (v.grid && v.grid.length) body.push(h('div.fz-grid', v.grid.map((g) => h('div', h('small', g.k), h('b', fmt(g.v, g.unit))))));
    if (v.rows && v.rows.length) body.push(rowsEl(v.rows));
    if (v.note) body.push(h('p.fz-note', v.note));
    if (v.sub2) body.push(h('section.fz-sub', h('h4', v.sub2.title, h('small', v.sub2.note)), rowsEl(v.sub2.rows)));
    if (v.key === 'yingzao') {
      body.push(v.works.length
        ? h('div.fz-works', v.works.map((wk) => h('div.fz-work.' + wk.tone,
            h('p.fz-wk-head', h('b', wk.name), h('small', wk.level), h('em', wk.status)),
            wk.desc ? h('p', wk.desc) : null,
            wk.fx.length ? h('p.fz-fx', wk.fx.map((x) => h('span', x))) : null,
            wk.applied.length ? h('p.fz-wk-note', `实入账：${wk.applied.join(' · ')}`) : null,
            wk.flowPct > 0 ? h('p.fz-wk-note', `工成之利：地方岁入每回合+${wk.flowPct}%`) : null,
            wk.progress != null ? h('div.fz-prog', h('i', { style: { width: `${wk.progress}%` } }), h('small', `余${num(wk.left)}回合`)) : null)))
        : h('p.fz-note', '此地尚无在册工役。'));
    }
    replaceChildren(right, head, h('div.fz-vbody.q-scroll.ink', body));
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
    const band = h('div.fz-band', c.band.map((x) => h('div.fz-stat' + (x.warn ? '.warn' : ''), h('small', x.k),
      h('b', typeof x.v === 'number' && Math.abs(x.v) >= 1e4 ? num(roundSig(x.v, 3)) : fmt(x.v)),
      x.subN != null ? h('span', `${x.subPre || ''}${fmt(x.subN)}${x.subPost || ''}`) : x.sub ? h('span', x.sub) : null)));
    const live = CVOLS.filter(([k]) => (k === 'xingshi') || (c[k] && (Array.isArray(c[k]) ? c[k].length : true)));
    if (!live.some(([k]) => k === cvol)) cvol = live[0] ? live[0][0] : 'xingshi';
    const slips = h('div.fz-slips', live.map(([k, seal, name]) => h('button.fz-slip' + (k === cvol ? '.on' : ''), { type: 'button', onclick: () => { cvol = k; renderCircuitLeft(); renderCircuitRight(); } }, h('i', seal), h('b', name))));
    const acts = c.acts.length ? h('div.fz-acts', c.acts.map((a) => h('button.q-yapai', { type: 'button', title: '录入议事清册，候诏颁行', onclick: () => doCircuitAct(a) }, a))) : null;
    replaceChildren(left,
      h('header.fz-head', h('span.fz-seal', '通志'), h('div',
        h('p.fz-crumbs', c.owner ? (onFaction ? h('a', { onclick: () => onFaction(c.ownerKey || c.owner) }, c.owner) : h('span', c.owner)) : null, h('i', '›'), h('b', c.name)),
        h('h2', c.name), h('small.fz-level', `省道 · 辖${num(c.members)}府州`))),
      pills.length ? h('div.fz-pills', pills) : null, c.desc ? h('p.fz-desc', c.desc) : null, official, band, slips, acts);
  }
  function renderCircuitRight() {
    const c = curC;
    const meta = CVOLS.find(([k]) => k === cvol) || CVOLS[1];
    const head = h('header.fz-vhead', h('span.fz-vseal', meta[1]), h('h3', meta[2]), h('small', meta[3]));
    const body = [];
    const reg = (x) => h('a.fz-who', { onclick: () => show(x.id) }, x.name);
    if (cvol === 'xiajing' && c.xiajing) {
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
    replaceChildren(right, head, h('div.fz-vbody.q-scroll.ink', body));
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
    curC = c;
    mode = 'circuit';
    renderCircuitLeft();
    renderCircuitRight();
    ov.classList.add('on');
    opened = true;
  }

  async function show(id) {
    try { await F.ensureCircuits(); } catch (_e) { /* 无省道分组照样开 */ }
    let d = null;
    try { d = F.region(id); } catch (e) { toast(e.message); return; }
    if (!d) { toast('此地无志可展'); return; }
    cur = d;
    mode = 'region';
    if (!cur.vols.some((v) => v.key === vol)) vol = cur.vols[0] ? cur.vols[0].key : 'huyi';
    renderLeft();
    renderRight();
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
  game.on('game:changed', () => {
    if (!opened) return;
    try {
      if (mode === 'circuit' && curC) { const c = F.circuit(curC.key); if (c) { curC = c; renderCircuitLeft(); renderCircuitRight(); } }
      else if (cur) { const d = F.region(cur.id); if (d) { cur = d; renderLeft(); renderRight(); } }
    } catch (_e) { /* 照旧 */ }
  });
  return { show, showCircuit, hide, get opened() { return opened; } };
}
