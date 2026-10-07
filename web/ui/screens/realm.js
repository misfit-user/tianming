// 朝野：朝野册。「势力」页左叶列天下诸势力（本朝居首，敌对者标朱），右叶为所选势力的谱牒：印、名、类、述，
// 一排要数（领地、总兵、户口、实力、人物），下分六卷（君臣、版图、军略、财计、邦交、史略），卷首一排小签可跳卷。经 game.realm。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig } from '../core/numerals.js';
import { qianzi } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const amt = (v) => num(roundSig(Math.abs(v || 0), 3));
const TABS = [['factions', '势力']];
const JUAN_MARK = { 君臣: '君', 版图: '图', 军略: '军', 财计: '财', 邦交: '交', 史略: '史' };
const NUM_WORD = ['一', '二', '三', '四', '五', '六'];
const REL = { meng: '盟好', di: '敌对', zhong: '中立' };

export function createRealm({ root, game }) {
  const R = game.realm;
  let tab = 'factions';
  let sel = '';
  let opened = false;
  let facList = [];

  const tabs = qianzi(TABS.map(([value, label]) => ({ value, label })), { value: tab, onchange: (v) => { tab = v; render(); } });
  const leftBody = h('div.rm-lbody');
  const left = h('section.ce-leaf.left.rm-left', h('header.ce-head', h('h2', '朝野'), h('small', '天下之势')), h('div.fi-tabs', tabs), leftBody);
  const right = h('section.ce-leaf.right.rm-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.rm-ov', { role: 'dialog', 'aria-label': '朝野册' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  function render() {
    const list = facList = R.factions();
    if (!list.some((f) => f.key === sel)) sel = (list[0] || {}).key || '';
    const max = Math.max(1, ...list.map((f) => f.strength));
    replaceChildren(leftBody, list.length ? list.map((f) => h('button.rm-fac' + (f.key === sel ? '.on' : '') + (f.hostile ? '.hostile' : '') + (f.mine ? '.mine' : ''),
      { type: 'button', onclick: () => { sel = f.key; renderFaction(); markSel(); } },
      h('b', f.name), f.mine ? h('em.mine', '本朝') : f.attitude ? h('em', f.attitude.slice(0, 6)) : null,
      h('span.meta', [f.type, f.leader].filter(Boolean).join(' · ')),
      h('i.bar', h('b', { style: { width: `${(f.strength / max) * 100}%` } })), h('small', f.soldiers ? `兵${amt(f.soldiers)}` : '')))
      : [h('p.ce-unk', '天下无势力在册')]);
    if (sel) renderFaction(); else replaceChildren(right);
  }
  function markSel() { leftBody.querySelectorAll('.rm-fac').forEach((b, i) => b.classList.toggle('on', !!facList[i] && facList[i].key === sel)); }

  // ---------- 谱牒 ----------
  function renderFaction() {
    let d;
    try { d = R.faction(sel); } catch (e) { toast(e.message); replaceChildren(right); return; }
    const juans = d.juan.filter(([, , body]) => hasBody(body));
    const nav = h('nav.rm-nav', juans.map(([title], i) => h('button', { type: 'button', title, onclick: () => { const t = right.querySelector(`[data-juan="${title}"]`); if (t) right.scrollTo({ top: t.offsetTop - nav.offsetHeight - 8, behavior: 'smooth' }); } }, JUAN_MARK[title] || title.charAt(0))));
    replaceChildren(right,
      h('header.rm-head' + (d.hostile ? '.hostile' : ''),
        h('div.rm-seal', d.short),
        h('div.rm-id', h('h3', d.name, h('small', d.type)), d.pills.length ? h('div.rm-pills', d.pills.map((p) => h('span' + (/敌/.test(p) ? '.hostile' : ''), p))) : null,
          d.desc ? h('p.rm-desc', d.desc) : null)),
      d.stats.length ? h('div.rm-stats', d.stats.map(([k, v]) => h('div', h('span', k), h('b', v)))) : null,
      nav,
      juans.map(([title, sub, body], i) => h('section.rm-juan', { dataset: { juan: title } },
        h('h4', h('span.no', `卷${NUM_WORD[i]}`), h('span', title), h('small', sub)), juanBody(title, body))));
    right.scrollTop = 0;
  }
  function hasBody(b) {
    return ['people', 'rows', 'chips', 'places', 'breakdown', 'relations', 'strengths', 'weaknesses', 'texts'].some((k) => Array.isArray(b[k]) && b[k].length);
  }
  const rows = (list) => (list && list.length ? h('div.rm-rows', list.map((r) => h('p' + (r.tone === 'zhu' ? '.zhu' : ''), h('span', r.k), h('b', r.v)))) : null);
  const chipGroups = (groups) => (groups || []).map((g) => h('div.rm-chips', h('span', g.title), h('div', g.items.map((c) => h('em' + (c.warn ? '.warn' : ''), c.label, h('b', c.value))))));
  function juanBody(title, b) {
    const parts = [];
    if (b.people && b.people.length) parts.push(h('div.rm-people', b.people.map((p) => h('div' + (p.main ? '.main' : ''),
      h('i', String(p.name).replace(/[\s（）()]/g, '').charAt(0)), h('div', h('b', `${p.title} · ${p.name}`), p.meta ? h('span', p.meta) : null, p.bio ? h('p', p.bio) : null)))));
    if (b.breakdown && b.breakdown.length) {
      const total = b.breakdown.reduce((s, x) => s + x.value, 0) || 1;
      parts.push(h('div.rm-break', h('div.bar', b.breakdown.map((x, i) => h('i.c' + i, { style: { flexGrow: String(x.value) }, title: `${x.label} ${amt(x.value)}` }))),
        h('div.legend', b.breakdown.map((x, i) => h('span', h('i.c' + i), `${x.label} ${amt(x.value)}`)), h('small', `总 ${amt(total)}`))));
    }
    if (b.places && b.places.length) parts.push(h('div.rm-places', h('span', `所辖 ${num(b.places.length)} 块`), h('div', b.places.slice(0, 80).map((p) => h('em', p)), b.places.length > 80 ? h('small', `余${num(b.places.length - 80)}块`) : null)));
    if (b.relations && b.relations.length) parts.push(h('div.rm-rel', b.relations.map((r) => h('p.' + r.kind, h('i'), h('b', r.name), h('em', REL[r.kind]), r.note ? h('small', r.note) : null))));
    parts.push(rows(b.rows));
    parts.push(...chipGroups(b.chips));
    if ((b.strengths && b.strengths.length) || (b.weaknesses && b.weaknesses.length)) parts.push(h('div.rm-youlie',
      b.strengths.length ? h('div.you', h('b', '所长'), b.strengths.map((s) => h('span', s))) : null,
      b.weaknesses.length ? h('div.lie', h('b', '所短'), b.weaknesses.map((s) => h('span', s))) : null));
    if (b.texts && b.texts.length) parts.push(h('div.rm-texts', b.texts.map(([k, t]) => h('p', h('b', `【${k}】`), t))));
    return parts.filter(Boolean);
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
