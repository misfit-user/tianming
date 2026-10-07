// 史馆：四库旧档合成一册。左叶分四库（史记、起居注、纪事、编年），可检字、按事类筛，点人名地名则跨库互见；
// 右叶展开所选一卷：史记分卷（实录、时政记、正文……）与国势升降、人事、本回所令；起居注可加批；纪事是一问一对，可标要事；
// 编年是进行中的事势（进度）与年史。卷尾列涉及人物、势力地域与同回合他库之档。数据经 game.archive。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';
import { EDICT_LABEL } from './annals.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const PAGE = 120;

export function createArchive({ root, game, profile, onPerson }) {
  const A = game.archive;
  let all = [];
  let cat = 'shiji';
  let sel = '';
  let q = '';
  let type = '';
  let who = '';
  let where = '';
  let limit = PAGE;
  let opened = false;
  let rows = [];

  const title = h('h2');
  const tally = h('small');
  const cats = h('div.sg-cats');
  const search = h('input.ce-search', { type: 'search', placeholder: '检人名、事目、字句', oninput: (e) => { q = e.target.value.trim(); limit = PAGE; renderLeft(); } });
  const types = h('div.sg-types');
  const filters = h('div.sg-filters');
  const list = h('div.sg-list');
  const left = h('section.ce-leaf.left.sg-left', h('header.ce-head', title, tally), cats, h('div.ce-tools', search), types, filters, list);
  const right = h('section.ce-leaf.right.sg-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.sg-ov', { role: 'dialog' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  // 人、地两筛跨库；字与事类只筛本库
  const crossOk = (x) => (!who || x.persons.includes(who)) && (!where || x.factions.includes(where) || x.regions.includes(where));
  function filtered() {
    return all.filter((x) => x.cat === cat && crossOk(x) && (!type || x.type === type) && (!q || x.needle.includes(q)));
  }

  function renderLeft() {
    const prof = profile();
    const pool = all.filter(crossOk);
    replaceChildren(cats, A.CATS.map((c) => h('button.sg-cat.' + c.key + (c.key === cat ? '.on' : ''), { type: 'button', onclick: () => { cat = c.key; type = ''; limit = PAGE; sel = ''; renderLeft(); renderFolio(); } },
      h('i', c.glyph), h('b', c.label), h('small', num(pool.filter((x) => x.cat === c.key).length)))));
    // 事类：本库前十，按条数
    const count = new Map();
    for (const x of pool) if (x.cat === cat) count.set(x.type, (count.get(x.type) || 0) + 1);
    const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 10);
    replaceChildren(types, top.length > 1 ? [h('button' + (!type ? '.on' : ''), { type: 'button', onclick: () => { type = ''; renderLeft(); } }, '全部'),
      ...top.map(([t, n]) => h('button' + (t === type ? '.on' : ''), { type: 'button', onclick: () => { type = type === t ? '' : t; limit = PAGE; renderLeft(); } }, t, h('small', num(n))))] : []);
    replaceChildren(filters,
      who ? h('span', '人　', h('b', who), onPerson ? h('button.link', { type: 'button', onclick: () => onPerson(who) }, '图志') : null, h('button', { type: 'button', title: '撤去', onclick: () => { who = ''; renderLeft(); } }, '×')) : null,
      where ? h('span', '地　', h('b', where), h('button', { type: 'button', title: '撤去', onclick: () => { where = ''; renderLeft(); } }, '×')) : null);
    filters.hidden = !who && !where;
    rows = filtered();
    const was = sel;
    if (!rows.some((x) => x.id === sel)) sel = (rows[0] || {}).id || '';
    const items = [];
    let day = null;
    for (const x of rows.slice(0, limit)) {
      if (x.when !== day) { day = x.when; items.push(h('p.sg-day', day || '未系年月')); }
      items.push(h('button.sg-item' + (x.id === sel ? '.on' : ''), { type: 'button', dataset: { id: x.id }, onclick: () => { sel = x.id; markSel(); renderFolio(); } },
        h('i.sg-g.' + x.cat, x.glyph || A.CATS.find((c) => c.key === x.cat).glyph),
        h('b', x.title),
        h('span.meta', [x.type, x.cat === 'biannian' && x.sub === 'affair' ? `${x.status} ${num(x.progress)}%` : ''].filter(Boolean).join(' · ')),
        h('span.marks', x.auth !== 'faith' ? h('em.auth.' + x.auth, A.AUTH[x.auth]) : null,
          x.starred ? h('em.star', '要') : null, x.note ? h('em.note', '批') : null)));
    }
    if (rows.length > limit) items.push(h('button.sg-more', { type: 'button', onclick: () => { limit += PAGE; renderLeft(); } }, `余${num(rows.length - limit)}卷　续看`));
    replaceChildren(list, items.length ? items : [h('p.ce-unk', q || type || who || where ? '无合此检之档' : `${A.CATS.find((c) => c.key === cat).label}尚无一卷`)]);
    title.textContent = prof.annals.archive;
    tally.textContent = `馆藏${num(all.length)}卷 · 信史${num(all.filter((x) => x.auth === 'faith').length)}`;
    if (sel !== was && opened) renderFolio();
  }
  function markSel() { list.querySelectorAll('.sg-item').forEach((b) => b.classList.toggle('on', b.dataset.id === sel)); }

  // ---------- 右叶 ----------
  const para = (t) => h('div.sg-text', t);
  function renderFolio() {
    const prof = profile();
    const x = all.find((e) => e.id === sel);
    if (!x) { replaceChildren(right, h('p.ce-unk', '择一卷以观')); return; }
    const c = A.CATS.find((k) => k.key === x.cat);
    const head = h('header.sg-head',
      h('div.sg-seal.' + x.cat, x.glyph || c.glyph),
      h('div', h('h3', x.title), h('p.sg-meta', [c.label, x.type, x.when, x.turn ? `第${num(x.turn)}回合` : ''].filter(Boolean).join(' · '),
        x.auth !== 'faith' ? h('em.auth.' + x.auth, A.AUTH[x.auth]) : null, x.starred ? h('em.star', '要事') : null)));
    const body = [];
    if (x.cat === 'shiji') {
      if (x.summary && x.summary !== x.title) body.push(h('p.sg-lead', x.summary));
      if (x.delta.length) body.push(h('div.sg-delta', h('span', '国势'), x.delta.map((d) => h('em.' + (d.d > 0 ? 'up' : 'dn'), d.label, h('b', `${d.d > 0 ? '+' : ''}${num(d.d)}`)))));
      if (x.vols.length > 1) {
        const nav = h('nav.sg-nav', x.vols.map(([k]) => h('button', { type: 'button', onclick: () => { const t = right.querySelector(`[data-vol="${k}"]`); if (t) right.scrollTo({ top: t.offsetTop - nav.offsetHeight - 8, behavior: 'smooth' }); } }, k)));
        body.push(nav);
      }
      for (const [k, v] of x.vols) body.push(h('section.sg-vol', { dataset: { vol: k } }, h('h5', k), para(v)));
      if (x.personnel.length) body.push(h('section.sg-vol', h('h5', '人事'), h('ol.sg-ol', x.personnel.map((t) => h('li', t)))));
      if (x.edicts.length) body.push(h('section.sg-vol', h('h5', prof.annals.ownOrders), x.edicts.map(([k, t]) => h('p.sg-edict', h('b', EDICT_LABEL[k] || k), t))));
      if (x.reports.length) body.push(h('section.sg-vol', h('h5', prof.annals.echo), h('ol.sg-ol', x.reports.map((t) => h('li', t)))));
    } else if (x.cat === 'qiju') {
      if (x.draft) body.push(h('p.sg-draft', x.draft));
      if (x.edicts.length) body.push(h('div.sg-edicts', x.edicts.map(([k, t]) => h('p.sg-edict', h('b', EDICT_LABEL[k] || k), t))));
      if (x.conduct) body.push(h('p.sg-edict', h('b', prof.ling.conduct), x.conduct));
      if (x.body) body.push(para(x.body));
      body.push(h('div.sg-note' + (x.note ? '' : '.empty'), h('span', prof.annals.note), x.note ? h('p', x.note) : h('p', '未加')));
    } else if (x.cat === 'jishi') {
      if (x.topic) body.push(h('p.sg-topic', h('span', '议题'), x.topic));
      if (x.said) body.push(h('div.sg-say.me', h('b', prof.audience.me), para(x.said)));
      if (x.reply) body.push(h('div.sg-say', h('b', x.who || '对方'), para(x.reply)));
      if (x.outcome) body.push(h('p.sg-topic.out', h('span', '结论'), x.outcome));
    } else {
      if (x.sub === 'affair') {
        body.push(h('div.sg-affair', h('p', h('span', '现状'), h('b', x.status)), x.actor ? h('p', h('span', '主事'), h('b', x.actor)) : null,
          h('p', h('span', '起于'), h('b', x.when || `第${num(x.turn)}回合`)), x.endTurn ? h('p', h('span', '预期'), h('b', `第${num(x.endTurn)}回合`)) : null,
          h('div.sg-prog', h('div.track', h('i', { style: { width: `${x.progress}%` } })), h('small', `${num(x.progress)}%`))));
      }
      if (x.body) body.push(para(x.body));
      if (x.afterword) body.push(h('section.sg-vol', h('h5', '后记'), para(x.afterword)));
    }
    // 卷尾：人物、势力地域、同回合他库
    const tail = [];
    const chip = (label, on, click) => h('button' + (on ? '.on' : ''), { type: 'button', onclick: click }, label);
    if (x.persons.length) tail.push(h('div.sg-chips.who', h('span', '涉及人物'), h('div', x.persons.map((p) => chip(p, p === who, () => { who = who === p ? '' : p; refilter(); })))));
    const places = [...new Set([...x.factions, ...x.regions])];
    if (places.length) tail.push(h('div.sg-chips.where', h('span', '势力地域'), h('div', places.map((p) => chip(p, p === where, () => { where = where === p ? '' : p; refilter(); })))));
    const xref = x.turn ? all.filter((y) => y.id !== x.id && y.turn === x.turn && y.cat !== x.cat).slice(0, 6) : [];
    if (xref.length) tail.push(h('div.sg-xref', h('span', '同回互见'), h('div', xref.map((y) => h('button', { type: 'button', onclick: () => jump(y) },
      h('i.sg-g.' + y.cat, y.glyph || A.CATS.find((k) => k.key === y.cat).glyph), y.title)))));
    const acts = [];
    if (x.cat === 'qiju') acts.push(h('button.q-yapai', { type: 'button', onclick: () => annotate(x) }, x.note ? `改${prof.annals.note}` : prof.annals.note));
    if (x.cat === 'jishi') acts.push(h('button.q-yapai', { type: 'button', onclick: () => star(x) }, x.starred ? '撤要事' : '标为要事'));
    acts.push(h('button.q-yapai', { type: 'button', onclick: copyOut }, '抄录本库'));
    replaceChildren(right, head, ...body, tail.length ? h('footer.sg-tail', tail) : null, h('div.sg-acts', acts));
    right.scrollTop = 0;
  }
  // 卷尾点人名地名：左叶跨库只列涉此人此地之档，右叶不动
  function refilter() {
    limit = PAGE;
    renderLeft();
    markSel();
    right.querySelectorAll('.sg-chips.who button').forEach((b) => b.classList.toggle('on', b.textContent === who));
    right.querySelectorAll('.sg-chips.where button').forEach((b) => b.classList.toggle('on', b.textContent === where));
  }
  function jump(y) {
    cat = y.cat; type = ''; limit = PAGE;
    if (q && !y.needle.includes(q)) { q = ''; search.value = ''; }
    if (!crossOk(y)) { who = ''; where = ''; }
    sel = y.id;
    renderLeft();
    renderFolio();
    const b = list.querySelector(`[data-id="${y.id}"]`);
    if (b) b.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 动作 ----------
  function annotate(x) {
    const prof = profile();
    const ta = h('textarea.sg-ta', { rows: 4, placeholder: `${prof.annals.note}于此条……（留空即撤）` });
    ta.value = x.note || '';
    juan({ title: prof.annals.note, width: '32rem', content: ta, actions: [{ label: '落笔', onclick: ({ close }) => {
      close('ok');
      try { const v = A.annotate(x.id, ta.value); toast(v ? `${prof.annals.note}已写入` : `${prof.annals.note}已撤`); } catch (e) { toast(e.message); }
      reload();
    } }] });
    setTimeout(() => ta.focus(), 400);
  }
  function star(x) {
    try { toast(A.star(x.id) ? '已标为要事' : '已撤要事'); } catch (e) { toast(e.message); }
    reload();
  }
  // 抄录：把左叶眼下所列（本库、合检者）写成一份文本存下
  function copyOut() {
    const prof = profile();
    const c = A.CATS.find((k) => k.key === cat);
    const scope = [c.label, type, who && `人：${who}`, where && `地：${where}`, q && `检：${q}`].filter(Boolean).join(' · ');
    const lines = [`${prof.annals.archive}抄录　${scope}　共${rows.length}卷`, ''];
    for (const x of rows) {
      lines.push(`【${x.title}】${[x.type, x.when].filter(Boolean).join(' · ')}${x.auth !== 'faith' ? `（${A.AUTH[x.auth]}）` : ''}`);
      lines.push(x.text || '');
      if (x.note) lines.push(`〔${prof.annals.note}〕${x.note}`);
      lines.push('');
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = h('a', { href: url, download: `${prof.annals.archive}抄录-${c.label}.txt` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`已抄录${num(rows.length)}卷`);
  }

  function reload() {
    try { all = A.catalog(); } catch (e) { all = []; toast(e.message); }
    renderLeft();
    renderFolio();
  }
  // id：直开某卷（如「史记」某回合）
  function show(id) {
    try { all = A.catalog(); } catch (e) { all = []; toast(e.message); }
    if (id) {
      const x = all.find((e) => e.id === id);
      if (x) { cat = x.cat; sel = x.id; type = ''; q = ''; who = ''; where = ''; search.value = ''; }
    }
    renderLeft();
    renderFolio();
    ov.setAttribute('aria-label', profile().annals.archive);
    ov.classList.add('on');
    opened = true;
    const b = list.querySelector(`[data-id="${sel}"]`);
    if (b) b.scrollIntoView({ block: 'nearest' });
  }
  function hide() {
    ov.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened) reload(); });
  return { show, hide, get opened() { return opened; } };
}
