// 文苑：诗文总集一册。左叶总录诸数、检字、按缘起与文体筛、仅传世／隐查禁、排序，下列篇目（作者题签、题名、体裁、印禁险）；
// 右叶展开一篇：诗词曲歌行誊在朱丝栏笺上竖写，文赋横排；传世钤印、查禁加戳；品第、政险、创作背景、弦外之意、赠答次韵与唱和；
// 剧本预置的典籍只有提要，画成线装书衣加题签。卷底动作（赏析、题序、追和、传抄、查禁、解禁）拟入议事清册，叫法取 profile().wenyuan。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const SORTS = [['recent', '近作'], ['quality', '品第'], ['author', '作者']];

export function createWenyuan({ root, game, profile, onPerson }) {
  const W = game.wenyuan;
  let all = [];
  let sel = '';
  let q = '';
  let cat = '';
  let genre = '';
  let onlyKept = false;
  let hideBanned = false;
  let sort = 'recent';
  let opened = false;

  const title = h('h2');
  const tally = h('small');
  const statsEl = h('div.wy-stats');
  const search = h('input.ce-search', { type: 'search', placeholder: '检作者、题名、字句', oninput: (e) => { q = e.target.value.trim(); renderLeft(); } });
  const cats = h('div.wy-chips.cats');
  const genres = h('div.wy-chips.genres');
  const tools = h('div.wy-tools');
  const list = h('div.wy-list');
  const left = h('section.ce-leaf.left.wy-left', h('header.ce-head', title, tally), statsEl, h('div.ce-tools', search), cats, genres, tools, list);
  const right = h('section.ce-leaf.right.wy-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.wy-ov', { role: 'dialog' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  const T = () => profile().wenyuan || { title: '文苑', sub: '', acts: [] };

  function rows() {
    const out = all.filter((x) => (!cat || x.cat === cat) && (!genre || x.genre === genre) && (!onlyKept || x.preserved) && (!hideBanned || !x.forbidden) && (!q || x.needle.includes(q)));
    if (sort === 'quality') out.sort((a, b) => b.quality - a.quality);
    else if (sort === 'author') out.sort((a, b) => a.author.localeCompare(b.author, 'zh'));
    else out.sort((a, b) => (a.preset - b.preset) || ((b.turn ?? -1) - (a.turn ?? -1)) || (b.idx - a.idx));
    return out;
  }

  // ---------- 左叶 ----------
  function chipRow(el, label, pairs, cur, set) {
    replaceChildren(el, pairs.length > 1 ? [h('span', label), h('button' + (!cur ? '.on' : ''), { type: 'button', onclick: () => set('') }, '全部'),
      ...pairs.map(([k, name, n]) => h('button' + (k === cur ? '.on' : ''), { type: 'button', onclick: () => set(k === cur ? '' : k) }, name, h('small', num(n))))] : []);
  }
  function renderLeft() {
    const t = T();
    const s = W.stats(all);
    title.textContent = t.title;
    tally.textContent = t.sub || '';
    replaceChildren(statsEl, [['总录', s.all], ['传世', s.preserved], ['查禁', s.forbidden], ['政险', s.risky], ['近作', s.recent], ['文魁', s.authors]]
      .map(([k, v]) => h('div', h('b', num(v)), h('span', k))), s.lost ? h('p', `另有${num(s.lost)}篇年久散佚，不复可考`) : null);
    const pool = all.filter((x) => (!onlyKept || x.preserved) && (!hideBanned || !x.forbidden));
    const count = (key) => { const m = new Map(); for (const x of pool) m.set(x[key], (m.get(x[key]) || 0) + 1); return m; };
    const cm = count('cat');
    chipRow(cats, '缘起', W.CATS.filter(([k]) => cm.get(k)).map(([k, name]) => [k, name, cm.get(k)]), cat, (v) => { cat = v; renderLeft(); });
    const gm = new Map();
    for (const x of pool) if (!x.preset && x.genre) gm.set(x.genre, (gm.get(x.genre) || 0) + 1);
    chipRow(genres, '文体', [...gm].filter(([g]) => g).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([g, n]) => [g, g, n]), genre, (v) => { genre = v; renderLeft(); });
    replaceChildren(tools,
      h('button' + (onlyKept ? '.on' : ''), { type: 'button', onclick: () => { onlyKept = !onlyKept; renderLeft(); } }, '仅传世'),
      h('button' + (hideBanned ? '.on' : ''), { type: 'button', onclick: () => { hideBanned = !hideBanned; renderLeft(); } }, '隐查禁'),
      h('span.sorts', h('small', '排'), SORTS.map(([k, name]) => h('button' + (k === sort ? '.on' : ''), { type: 'button', onclick: () => { sort = k; renderLeft(); } }, name))));
    const rs = rows();
    const was = sel;
    if (!rs.some((x) => x.id === sel)) sel = (rs[0] || {}).id || '';
    replaceChildren(list, rs.length ? rs.map(item) : [h('p.ce-unk', all.length ? '篇帙寂寂　无合此检之作' : '暂无文事作品——士大夫因境遇、际遇、心境而作，随推演自然生成')]);
    if (sel !== was && opened) renderFolio();
  }
  function item(x) {
    return h('button.wy-item.' + x.cat + (x.id === sel ? '.on' : ''), { type: 'button', dataset: { id: x.id }, onclick: () => { sel = x.id; markSel(); renderFolio(); } },
      h('i.wy-tab', x.author.replace(/\s+/g, '').slice(0, 3)),
      h('b', x.preset || /《/.test(x.title) ? x.title : `《${x.title}》`),
      h('span.meta', [x.genre, x.subtype !== x.genre ? x.subtype : '', x.date].filter(Boolean).join(' · ')),
      h('span.marks', x.preserved ? h('em.kept', '印') : null, x.forbidden ? h('em.ban', '禁') : null, x.risk === 'high' && !x.forbidden ? h('em.risk', '险') : null,
        x.pending.size ? h('em.pend', '拟') : null));
  }
  function markSel() { list.querySelectorAll('.wy-item').forEach((b) => b.classList.toggle('on', b.dataset.id === sel)); }

  // ---------- 右叶 ----------
  const nameLink = (n) => (W.known(n) && onPerson ? h('button.wy-who', { type: 'button', title: '看列传', onclick: () => person(n) }, n) : h('span', n));
  function author(x) {
    const out = [];
    const parts = x.author.split(/([/、，,])/);
    for (const p of parts) out.push(x.authors.includes(p.trim()) ? nameLink(p.trim()) : h('span', p));
    return out;
  }
  // 诗词：按原有分行；一行写不下整首的（没有换行的），按句读断开
  function verseLines(text) {
    const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (lines.length > 1) return lines;
    return (text.match(/[^。！？；]+[。！？；]?/g) || [text]).map((s) => s.trim()).filter(Boolean);
  }
  function paper(x) {
    const stamps = [x.preserved ? h('i.wy-stamp.kept', '传世') : null, x.forbidden ? h('i.wy-stamp.ban', '查禁') : null];
    if (x.waiting) return h('div.wy-paper.prose', h('p.wy-wait', `${x.genre || '诗'}一首，题名与正文待下回合补录`), ...stamps);
    if (!x.content) return null;
    if (x.verse) {
      const sign = [x.date, x.location && `于${x.location}`].filter(Boolean).join(' ');
      return h('div.wy-paper.verse', h('div.wy-jian',
        h('p.t', x.title),
        h('p.a', x.author, x.subtype && x.subtype !== x.genre ? h('small', x.subtype) : null),
        ...verseLines(x.content).map((l) => h('p', l)),
        sign ? h('p.sign', sign) : null), ...stamps);
    }
    return h('div.wy-paper.prose', ...x.content.split(/\n+/).filter((s) => s.trim()).map((l) => h('p', l.trim())), ...stamps);
  }
  // 典籍：线装书衣加题签，一旁提要
  function cover(x) {
    return h('div.wy-preset',
      h('div.wy-cover', h('i.wy-slip', x.title.replace(/[《》]/g, '')), x.preserved ? h('i.wy-stamp.kept', '传世') : null, x.forbidden ? h('i.wy-stamp.ban', '查禁') : null),
      h('div.wy-tiyao', h('h5', '提要'),
        h('dl', x.genre ? [h('dt', '门类'), h('dd', x.genre)] : null, x.date ? [h('dt', '成书'), h('dd', x.date)] : null, x.status ? [h('dt', '版本'), h('dd', x.status)] : null),
        x.desc ? h('p', x.desc) : null, x.note ? h('p.note', x.note) : null));
  }
  function grade(x) {
    const marks = Math.max(1, Math.min(5, Math.round(x.quality / 20)));
    return h('div.wy-grade',
      x.rated ? h('span.q', h('small', '品'), h('i', '●'.repeat(marks)), h('i.d', '●'.repeat(5 - marks)), h('b', num(x.quality))) : h('span.q', h('small', '品'), h('b', '未品')),
      h('span.risk.' + x.risk, '政险 · ' + W.RISK[x.risk]),
      ...[...new Set([x.elegance, x.motive, x.theme, x.mood].filter(Boolean))].map((v) => h('span', v)));
  }
  function renderFolio() {
    const x = all.find((y) => y.id === sel);
    if (!x) { replaceChildren(right, h('p.ce-unk', '择一篇以观')); return; }
    const t = T();
    const head = h('header.wy-head',
      h('h3', x.preset || /《/.test(x.title) ? x.title : `《${x.title}》`),
      h('p.wy-meta', author(x), x.date ? h('span', x.date) : null, x.location ? h('span', `于${x.location}`) : null, x.genre ? h('span', [x.genre, x.subtype !== x.genre ? x.subtype : ''].filter(Boolean).join('·')) : null));
    const body = [];
    if (x.preset) body.push(cover(x));
    else {
      const p = paper(x);
      if (p) body.push(p);
      if (!x.waiting) body.push(grade(x));
    }
    if (x.context) body.push(h('p.wy-ctx', h('span', '创作背景'), x.context));
    if (x.implication || x.satire || x.praise) body.push(h('div.wy-imp', h('span', '弦外之意'), h('div', x.implication ? h('p', x.implication) : null,
      x.satire ? h('p.t', '所讽　', nameLink(x.satire)) : null, x.praise ? h('p.t', '所颂　', nameLink(x.praise)) : null)));
    const facts = [];
    if (!x.preset && (x.catLabel || x.trigger)) facts.push(['缘起', [x.catLabel, x.trigger].filter(Boolean).join(' · ')]);
    if (x.stage) facts.push(['作者境况', x.stage]);
    if (x.consort && x.motive) facts.push(['动机', x.motive]);
    if (x.dedicated.length) facts.push(['赠', x.dedicated.flatMap((n, i) => [i ? '、' : null, nameLink(n)])]);
    if (x.commissioned) facts.push(['受命于', nameLink(x.commissioned)]);
    const src = x.inspiredBy && all.find((y) => y.id === x.inspiredBy || y.title.replace(/[《》]/g, '') === x.inspiredBy.replace(/[《》]/g, ''));
    if (x.inspiredBy) facts.push(['次韵', src ? h('button.wy-ref', { type: 'button', onclick: () => jump(src.id) }, `${src.author}《${src.title.replace(/[《》]/g, '')}》`) : x.inspiredBy]);
    if (x.echoes.length) facts.push(['唱和', x.echoes.map((id) => all.find((y) => y.id === id)).filter(Boolean).map((y) => h('button.wy-ref', { type: 'button', onclick: () => jump(y.id) }, `${y.author}《${y.title.replace(/[《》]/g, '')}》`))]);
    if (x.circulation) facts.push(['传写', x.circulation]);
    if (x.appreciated.length) facts.push(['赏阅', x.appreciated.join('、')]);
    if (facts.length) body.push(h('dl.wy-facts', facts.map(([k, v]) => [h('dt', k), h('dd', v)])));
    const acts = (t.acts || []).filter(([k]) => (k === 'unban' ? x.forbidden : k === 'ban' || k === 'circulate' ? !x.forbidden : true)).map(([k, label]) => {
      const done = x.pending.has(k);
      return h('button.q-yapai' + (k === 'ban' ? '.danger' : ''), { type: 'button', disabled: done, title: done ? `已入${profile().ling.suggest}，待颁行` : '', onclick: () => doAct(x, k, label) }, done ? `${label}·已拟` : label);
    });
    replaceChildren(right, head, ...body, acts.length ? h('div.wy-acts', acts) : null);
    right.scrollTop = 0;
  }
  function jump(id) {
    const y = all.find((e) => e.id === id);
    if (!y) return;
    if (!rows().some((e) => e.id === id)) { cat = ''; genre = ''; onlyKept = false; hideBanned = false; q = ''; search.value = ''; }
    sel = id;
    renderLeft();
    renderFolio();
    const b = list.querySelector(`[data-id="${id}"]`);
    if (b) b.scrollIntoView({ block: 'nearest' });
  }
  function person(n) {
    hide();
    onPerson(n);
  }

  // ---------- 动作 ----------
  function doAct(x, k, label) {
    try {
      if (!W.act(x.id, k)) toast(`${label}未成`);
    } catch (e) { toast(e.message); }
    reload();
  }

  function reload() {
    try { all = W.works(); } catch (e) { all = []; toast(e.message); }
    renderLeft();
    renderFolio();
  }
  function show(id) {
    try { all = W.works(); } catch (e) { all = []; toast(e.message); }
    if (id && all.some((x) => x.id === id)) { sel = id; cat = ''; genre = ''; q = ''; search.value = ''; }
    renderLeft();
    renderFolio();
    ov.setAttribute('aria-label', T().title);
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
