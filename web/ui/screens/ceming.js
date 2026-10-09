// 策名·敕召贤良：一卷两页——档案（五百余位历史人物，按名号、朝代、类型检）与检索（配了模型时请史官按名查访）。
// 点一人先看身份卡，确为此人再召；召入只入名册，不授官（授官另走任命）。召成翻其列传。经 game.ceming。入口：人物图志卷首「策名」。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, yearNum } from '../core/numerals.js';
import { juan, qianzi } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
// 年份：公元前记「前」，按记数设置写
const yr = (y) => { const n = Number(y); return Number.isFinite(n) && n ? `${n < 0 ? '前' : ''}${yearNum(Math.abs(n))}` : '？'; };

export function openCeming({ game, onBio }) {
  const M = game.ceming;
  let tab = 'library', q = '', dynasty = '', role = '', busy = false;
  const body = h('div.cm-body');
  const tabs = qianzi([{ value: 'library', label: '档案' }, { value: 'search', label: '检索' }], { value: tab, onchange: (v) => { tab = v; render(); } });

  // ---------- 档案 ----------
  const input = h('input.cm-in', { type: 'search', placeholder: '检姓名、字号、官至、谥号……', spellcheck: false, oninput: (e) => { q = e.target.value; renderList(); } });
  const dynSel = h('select.cm-in.cm-sel', { onchange: (e) => { dynasty = e.target.value; renderList(); } });
  const roles = qianzi([{ value: '', label: '全部' }, ...M.ROLES.map(([value, label]) => ({ value, label }))], { value: '', onchange: (v) => { role = v; renderList(); } });
  const count = h('small.cm-count');
  const grid = h('div.cm-grid');
  function renderLib() {
    const d = M.library({ q, dynasty, role });
    replaceChildren(dynSel, h('option', { value: '' }, '全部朝代'), d.dynasties.map((x) => h('option', { value: x.name, selected: x.name === dynasty }, `${x.name}（${num(x.n)}）`)));
    replaceChildren(body, h('div.cm-tools', input, dynSel), h('div.cm-roles', roles), count, grid);
    renderList(d);
  }
  function renderList(d0) {
    const d = d0 || M.library({ q, dynasty, role });
    count.textContent = `${num(d.count)}／${num(d.total)}人${d.count > d.rows.length ? `，列前${num(d.rows.length)}` : ''}`;
    replaceChildren(grid, d.rows.length ? d.rows.map((r) => h('button.cm-card' + (r.ok ? '' : '.off'), { type: 'button', disabled: !r.ok, title: r.reason || '看身份卡', onclick: () => showCard(M.profileCard(r.id), r.id) },
      h('b', r.name, r.zi ? h('small', `字${r.zi}`) : null), h('span', [r.dynasty, r.era].filter(Boolean).join(' · ')), r.title ? h('span', r.title) : null,
      r.role ? h('em', r.role) : null, r.reason ? h('i', r.reason) : null)) : h('p.ce-unk', '此筛之下无人'));
  }

  // ---------- 检索 ----------
  const sIn = h('input.cm-in', { type: 'search', placeholder: '姓名，如：沈括／范蠡／上官婉儿', spellcheck: false, onkeydown: (e) => { if (e.key === 'Enter') doSearch(); } });
  const sOut = h('div.cm-sout');
  function renderSearch() {
    replaceChildren(body, h('p.cm-note', '输入历史人物姓名，史官查阅典籍：先呈身份卡，确为其人再撰全档。须配模型。'),
      h('div.cm-tools', sIn, h('button.q-yapai', { type: 'button', onclick: () => doSearch() }, '查阅')), sOut);
  }
  async function doSearch() {
    const n = sIn.value.trim();
    if (!n) { toast('请输入姓名'); return; }
    if (busy) return;
    busy = true;
    replaceChildren(sOut, h('p.cm-wait', '史官查阅典籍……'));
    try {
      const r = await M.search(n);
      if (!body.isConnected) return;
      if (r.ok) showCard(r.card);
      else replaceChildren(sOut, h('p.cm-warn', r.message), r.inRoster && onBio ? h('button.q-yapai', { type: 'button', onclick: () => { j.close('ok'); onBio(n); } }, '翻其列传') : null);
    } catch (e) { replaceChildren(sOut, h('p.cm-warn', e.message || String(e))); } finally { busy = false; }
  }

  // ---------- 身份卡与召入 ----------
  function showCard(c, id) {
    if (!c) return;
    const facts = [['类型', c.role], ['背景', c.background], ['名言', c.quote ? `「${c.quote}」` : ''], ['结局', c.fate]].filter(([, v]) => v);
    replaceChildren(body, h('div.cm-id',
      h('header', h('h3', c.name, c.zi ? h('small', `字${c.zi}`) : null, c.doubtful ? h('em', '存疑待考') : null),
        h('p', [c.dynasty, c.era, c.birth || c.death ? `${yr(c.birth)}—${yr(c.death)}` : ''].filter(Boolean).join(' · ')), c.title ? h('p', c.title) : null),
      h('dl.cm-facts', facts.map(([k, v]) => [h('dt', k), h('dd', v)])),
      c.anchors.length ? h('section.cm-anchors', h('h5', '相似锚定'), c.anchors.map((a) => h('p', `${a.dim}　${a.name}${a.why ? `·${a.why}` : ''}`))) : null,
      c.ambiguity ? h('p.cm-warn', c.ambiguity) : null,
      h('div.cm-acts', h('button.q-yapai', { type: 'button', onclick: () => render() }, '另寻'),
        c.kind === 'card' ? h('button.q-yapai.danger', { type: 'button', title: '记入疑名，此后不再检索', onclick: () => { M.markFake(c.name); toast(`已记入疑名：${c.name}`); render(); } }, '疑非真人') : null,
        h('button.q-yapai', { type: 'button', onclick: () => summon(c, id) }, '确为此人·策名'))));
  }
  async function summon(c, id) {
    if (busy) return;
    busy = true;
    replaceChildren(body, h('p.cm-wait', c.kind === 'card' ? '史官撰其履历……（模型生成全档，稍候）' : '史官撰其履历……'));
    try {
      const r = await M.summon(c.kind, id);
      toast(r.existed ? `${r.name}已在册` : `${r.name}${r.note}，已入名册（授官另行任命）`);
      j.close('ok');
      if (onBio) onBio(r.name);
    } catch (e) {
      replaceChildren(body, h('p.cm-warn', e.message || String(e)), h('div.cm-acts', h('button.q-yapai', { type: 'button', onclick: () => render() }, '返回')));
    } finally { busy = false; }
  }

  function render() { if (tab === 'library') renderLib(); else renderSearch(); }
  render();
  const j = juan({ title: '策名', note: '敕召贤良 · 召入只入名册，不授官', width: '52rem', height: 'min(44rem, 86vh)', content: h('div.cm', tabs, body) });
  return j;
}
