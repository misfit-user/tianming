// 人物图志：一本绫裱册页。左页一叶叶立轴小像（可按势力、排序、搜索、显已殁筛，翻页），右页是选中之人的小传：
// 身份、处境、心性（忠诚、野心）、才具六项与五常（九品刻度）、名望贤能廉、特质、交游、生平。
// 问对、传书转召对、鸿雁两页，详传翻列传。卷首「策名」可把历史人物纳入名册（screens/ceming.js）。
// 「对参」把人放进对参栏（至多三人），展一卷并排比官职、心性、才具、五常、名望诸项，每行最优者标朱。数据经 game.select.people()。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { zhou, pin, qianzi, kaiguan, juan } from '../kit/index.js';
import { openCeming } from './ceming.js';

const PER_PAGE = 18;
const SORTS = [['rank', '品秩'], ['loyalty', '忠诚'], ['智', '智'], ['政', '政'], ['军', '军'], ['ambition', '野心']];

export function createAtlas({ root, game, onLetter, onAudience, onBio }) {
  let all = [];
  let list = [];
  let page = 0;
  let pick = null;
  let opts = { faction: '', sort: 'rank', q: '', dead: false };
  let cmp = [];                     // 对参栏：人名，至多三人

  const count = h('small');
  const search = h('input.ce-search', { type: 'search', placeholder: '检人名、官职、势力', oninput: (e) => { opts.q = e.target.value.trim(); page = 0; filter(); } });
  const sorts = qianzi(SORTS.map(([value, label]) => ({ value, label })), { value: 'rank', onchange: (v) => { opts.sort = v; page = 0; filter(); } });
  const facBox = h('div.ce-facs');
  const deadSw = kaiguan('显已殁', { onchange: (v) => { opts.dead = v; load(); } });
  const grid = h('div.ce-grid');
  const pageNote = h('span.ce-page');
  const prevBtn = h('button.ce-turn', { type: 'button', title: '上一叶', onclick: () => turn(-1) }, '‹');
  const nextBtn = h('button.ce-turn', { type: 'button', title: '下一叶', onclick: () => turn(1) }, '›');
  const cmpBar = h('div.ce-cmp');
  function renderCmp() {
    cmp = cmp.filter((n) => all.some((p) => p.name === n));
    cmpBar.hidden = !cmp.length;
    replaceChildren(cmpBar, h('span', '对参'), cmp.map((n) => h('button.ce-cmp-who', { type: 'button', title: '移出对参', onclick: () => { cmp = cmp.filter((x) => x !== n); renderCmp(); renderPerson(); } }, n)),
      cmp.length >= 2 ? h('button.q-yapai', { type: 'button', onclick: () => openCompare() }, '对看') : h('small', '再择一人'),
      h('button.ce-cmp-clear', { type: 'button', title: '清空对参', onclick: () => { cmp = []; renderCmp(); renderPerson(); } }, '清'));
  }
  // 对看：每列一人，每行一项；数值行最优者标朱（野心以低为优，不标）
  function openCompare() {
    const ps = cmp.map((n) => all.find((p) => p.name === n)).filter(Boolean);
    if (ps.length < 2) return;
    const best = (vals, low) => { const xs = vals.filter((v) => v != null); if (xs.length < 2) return null; const m = low ? Math.min(...xs) : Math.max(...xs); return xs.filter((v) => v === m).length === xs.length ? null : m; };
    const numRow = (label, get, opt = {}) => {
      const vals = ps.map(get);
      if (vals.every((v) => v == null)) return null;          // 诸人皆未详的项不列
      const b = opt.noMark ? null : best(vals, opt.low);
      return h('tr', h('th', label), vals.map((v) => h('td' + (v != null && v === b ? '.best' : ''), v == null ? '—' : num(v))));
    };
    const textRow = (label, get) => { const vals = ps.map(get); return vals.some(Boolean) ? h('tr', h('th', label), vals.map((v) => h('td.txt', v || '—'))) : null; };
    // 一节：节名一行，其下诸行；诸行皆空则整节不列
    const group = (title, rows) => { const rs = rows.filter(Boolean); return rs.length ? [h('tr.sep', h('th', title), ps.map(() => h('td'))), ...rs] : []; };
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
    const j = juan({ title: '对参', note: ps.map((p) => p.name).join(' · '), width: `${18 + ps.length * 13}rem`, content: h('div.ce-cmp-wrap', table, h('p.ce-cmp-note', onBio ? '每行最优者标朱；野心、年齿不标。点人名入其详传。' : '每行最优者标朱；野心、年齿不标。')) });
    if (onBio) table.querySelectorAll('th.who .q-zhou').forEach((b, i) => { b.style.cursor = 'pointer'; b.title = '入其详传'; b.addEventListener('click', () => { j.close('ok'); hide(); onBio(ps[i].name); }); });
  }
  const left = h('section.ce-leaf.left',
    h('header.ce-head', h('h2', '人物图志'), count,
      game.ceming && game.ceming.ready() ? h('button.q-yapai.ce-ceming', { type: 'button', title: '策名：把历史人物纳入名册（不授官）', onclick: () => openCeming({ game, onBio: (name) => { hide(); if (onBio) onBio(name); } }) }, '策名') : null),
    h('div.ce-tools', search, deadSw),
    h('div.ce-sorts', h('span', '排'), sorts),
    facBox, grid,
    h('footer.ce-foot', prevBtn, pageNote, nextBtn),
    cmpBar);
  const right = h('section.ce-leaf.right');
  const close = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, close);
  const ov = h('div.ce-ov', { role: 'dialog', 'aria-label': '人物图志' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

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
      h('button' + (opts.faction === f ? '.on' : ''), { type: 'button', onclick: () => { opts.faction = f; page = 0; renderFactions(); filter(); } }, label, h('small', num(n)))));
  }
  function filter() {
    const q = opts.q;
    const key = opts.sort;
    const val = (p) => (key === 'rank' ? -p.rank.level : key === 'loyalty' ? p.loyalty : key === 'ambition' ? p.ambition : (p.stats.find(([k]) => k === key) || [, 0])[1]);
    list = all.filter((p) => (!opts.faction || p.faction === opts.faction) && (!q || [p.name, p.zi, p.office, p.faction, p.party].some((s) => s && s.includes(q))))
      .sort((a, b) => (b.isPlayer - a.isPlayer) || (val(b) - val(a)) || a.name.localeCompare(b.name, 'zh'));
    count.textContent = `${num(list.length)}人`;
    if (!pick || !list.includes(pick)) pick = list.find((p) => p.name === (pick && pick.name)) || list[0] || null;
    renderGrid();
    renderPerson();
  }
  function pages() { return Math.max(1, Math.ceil(list.length / PER_PAGE)); }
  function turn(d) {
    const to = page + d;
    if (to < 0 || to >= pages()) return;
    page = to;
    renderGrid();
  }
  function renderGrid() {
    const slice = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    replaceChildren(grid, slice.length ? slice.map((p) => {
      const z = zhou({ name: p.name, src: p.portrait, dead: p.dead, title: [p.name, p.office].filter(Boolean).join(' · '), onclick: () => { pick = p; renderGrid(); renderPerson(); } });
      if (p === pick) z.classList.add('on');
      if (p.away && !p.dead) z.classList.add('away');
      return z;
    }) : [h('p.ce-none', '无人合此')]);
    pageNote.textContent = `第${num(page + 1)}叶 · 共${num(pages())}叶`;
    prevBtn.disabled = page <= 0;
    nextBtn.disabled = page >= pages() - 1;
  }

  function renderPerson() {
    const p = pick;
    if (!p) { replaceChildren(right, h('p.ce-none', '未择其人')); return; }
    const sec = (title, ...body) => h('section.ce-sec', h('h4', title), ...body);
    const pins = (rows) => { const has = rows.filter(([, v]) => v != null); return has.length ? h('div.ce-pins', has.map(([k, v]) => pin(k, v))) : h('p.ce-unk', '未详'); };
    const later = (label) => () => juan({ title: label, note: p.name, width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '此卷随后接上。') });
    replaceChildren(right,
      h('div.ce-who',
        zhou({ name: p.name, src: p.portrait, dead: p.dead }),
        h('div.ce-id',
          h('h3', p.name, p.zi ? h('small', `字${p.zi}`) : null),
          h('div.ce-line', [p.age ? `${num(p.age)}岁` : '', p.gender, p.family ? `${p.family}氏` : ''].filter(Boolean).join(' · ')),
          h('div.ce-office', p.office, p.rank.label ? h('em', p.rank.label) : null),
          h('div.ce-line', [p.faction, p.party ? `${p.party}${p.partyRank ? '·' + p.partyRank : ''}` : ''].filter(Boolean).join(' · ')),
          h('div.ce-line' + (p.away ? '.away' : ''), p.location ? `在${p.location}${p.travelTo ? ' → ' + p.travelTo : ''}` : ''),
          p.dead ? h('div.ce-dead', `已故${p.deathReason ? '：' + p.deathReason : ''}`) : null,
          p.states.length ? h('div.ce-states', p.states.map((s) => h('span', s))) : null)),
      h('div.ce-cols',
        sec('心性', pins([['忠诚', p.loyalty], ['野心', p.ambition]]),
          h('div.ce-rep', [['名望', p.fame], ['贤能', p.merit], ['廉', p.integrity]].filter(([, v]) => v != null).map(([k, v]) => h('span', h('i', k), num(v))))),
        sec('才具', pins(p.stats)),
        sec('五常', pins(p.wuchang))),
      p.traits.length ? sec('性情', h('div.ce-chips', p.traits.map((t) => h('span.' + t.tone, t.name)))) : null,
      p.relations.length ? sec('交游', h('div.ce-chips', p.relations.map((r) => h('span.' + r.tone, r.name)))) : null,
      p.personality || p.goal ? sec('志趣', p.personality ? h('p', p.personality) : null, p.goal ? h('p.goal', `所求：${p.goal}`) : null) : null,
      p.bio ? sec('生平', h('p.ce-bio.q-scroll.ink', p.bio)) : null,
      h('div.ce-acts',
        !p.dead && !p.isPlayer ? h('button.q-yapai', { type: 'button', onclick: p.away ? (onLetter ? () => { hide(); onLetter(p.name); } : later('传书')) : (onAudience ? () => { hide(); onAudience(p.name); } : later('问对')) }, p.away ? '传书' : '问对') : null,
        h('button.q-yapai', { type: 'button', onclick: onBio ? () => { hide(); onBio(p.name); } : later('列传') }, '详传'),
        h('button.q-yapai', { type: 'button', title: cmp.includes(p.name) ? '移出对参' : '放进对参栏，至多三人并排比', onclick: () => {
          if (cmp.includes(p.name)) cmp = cmp.filter((x) => x !== p.name);
          else { cmp = [...cmp, p.name].slice(-3); }
          renderCmp(); renderPerson();
        } }, cmp.includes(p.name) ? '撤对参' : '对参')));
  }

  function onKey(e) {
    if (!ov.classList.contains('on') || document.querySelector('.q-juan-veil')) return;
    if (e.target === search) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
    else if (e.key === 'ArrowRight') turn(1);
    else if (e.key === 'ArrowLeft') turn(-1);
  }
  window.addEventListener('keydown', onKey, true);

  function show(name) {
    load();
    renderCmp();
    if (name) { const p = list.find((x) => x.name === name); if (p) { pick = p; page = Math.floor(list.indexOf(p) / PER_PAGE); } }
    renderGrid();
    renderPerson();
    ov.classList.add('on');
  }
  function hide() { ov.classList.remove('on'); }
  return { show, hide };
}
