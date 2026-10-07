// 人物图志：一本绫裱册页。左页一叶叶立轴小像（可按势力、排序、搜索、显已殁筛，翻页），右页是选中之人的小传：
// 身份、处境、心性（忠诚、野心）、才具六项与五常（九品刻度）、名望贤能廉、特质、交游、生平。
// 问对、传书、详传要等问对、鸿雁、列传几页接上。数据经 game.select.people()。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { zhou, pin, qianzi, kaiguan, juan } from '../kit/index.js';

const PER_PAGE = 18;
const SORTS = [['rank', '品秩'], ['loyalty', '忠诚'], ['智', '智'], ['政', '政'], ['军', '军'], ['ambition', '野心']];

export function createAtlas({ root, game, onLetter }) {
  let all = [];
  let list = [];
  let page = 0;
  let pick = null;
  let opts = { faction: '', sort: 'rank', q: '', dead: false };

  const count = h('small');
  const search = h('input.ce-search', { type: 'search', placeholder: '检人名、官职、势力', oninput: (e) => { opts.q = e.target.value.trim(); page = 0; filter(); } });
  const sorts = qianzi(SORTS.map(([value, label]) => ({ value, label })), { value: 'rank', onchange: (v) => { opts.sort = v; page = 0; filter(); } });
  const facBox = h('div.ce-facs');
  const deadSw = kaiguan('显已殁', { onchange: (v) => { opts.dead = v; load(); } });
  const grid = h('div.ce-grid');
  const pageNote = h('span.ce-page');
  const prevBtn = h('button.ce-turn', { type: 'button', title: '上一叶', onclick: () => turn(-1) }, '‹');
  const nextBtn = h('button.ce-turn', { type: 'button', title: '下一叶', onclick: () => turn(1) }, '›');
  const left = h('section.ce-leaf.left',
    h('header.ce-head', h('h2', '人物图志'), count),
    h('div.ce-tools', search, deadSw),
    h('div.ce-sorts', h('span', '排'), sorts),
    facBox, grid,
    h('footer.ce-foot', prevBtn, pageNote, nextBtn));
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
      !p.dead && !p.isPlayer ? h('div.ce-acts',
        h('button.q-yapai', { type: 'button', onclick: p.away && onLetter ? () => { hide(); onLetter(p.name); } : later(p.away ? '传书' : '问对') }, p.away ? '传书' : '问对'),
        h('button.q-yapai', { type: 'button', onclick: later('列传') }, '详传')) : null);
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
    if (name) { const p = list.find((x) => x.name === name); if (p) { pick = p; page = Math.floor(list.indexOf(p) / PER_PAGE); } }
    renderGrid();
    renderPerson();
    ov.classList.add('on');
  }
  function hide() { ov.classList.remove('on'); }
  return { show, hide };
}
