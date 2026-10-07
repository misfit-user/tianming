// 官：职官志。一本绫裱册页：左页择廷（外朝、内朝、地方）与组，列衙署（员额、实在、缺）；右页是所选衙署的职官表——
// 品级、官名、员额、在任者（忠智政军、赴任），以及任命、改换、廷推、罢免、弹劾、荫子、荐贤；本回合已下的任命挂「待下诏书」可撤。
// 任命择人一卷（胜任度、忠诚门槛、标签、警示），已有官职者另问辞旧就新或兼任。经 game.offices（adapter/offices.js）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { qianzi, juan, zhou } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const TAGS = { vacant: '无官', civil: '文', military: '武', loyal: '忠', remote: '外地' };
const FILTERS = [['all', '全部'], ['civil', '文'], ['military', '武'], ['loyal', '忠'], ['vacant', '无官'], ['remote', '外地']];

export function createOffices({ root, game, profile, onPerson }) {
  const O = game.offices;
  let court = 'central';
  let group = 'all';
  let picked = null;           // 选中的衙署路径
  let opened = false;

  const sum = h('small');
  const courts = qianzi(O.COURTS.map(([value, label]) => ({ value, label })), { value: court, onchange: (v) => { court = v; group = 'all'; picked = null; renderLeft(); } });
  const groupBox = h('div.of-groups');
  const deptList = h('div.of-depts.q-scroll.ink');
  const left = h('section.ce-leaf.left.of-left', h('header.ce-head', h('h2', '职官志'), sum), h('div.of-courts', courts), groupBox, deptList);
  const right = h('section.ce-leaf.right.of-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.of-ov', { role: 'dialog', 'aria-label': '职官志' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  // ---------- 左页 ----------
  function renderLeft() {
    const gs = O.groups(court);
    replaceChildren(groupBox, gs.map((g) => h('button' + (g.key === group ? '.on' : ''), { type: 'button', title: g.note, onclick: () => { group = g.key; picked = null; renderLeft(); } }, g.name)));
    const ds = O.departments(court, group);
    const t = ds.reduce((a, d) => ({ head: a.head + d.total.head, actual: a.actual + d.total.actual, vacant: a.vacant + d.total.vacant }), { head: 0, actual: 0, vacant: 0 });
    sum.textContent = `${num(ds.length)}署 · 员${num(t.head)} · 缺${num(t.vacant)}`;
    if (!picked || !ds.some((d) => d.path[0] === picked[0])) picked = ds[0] ? ds[0].path : null;
    replaceChildren(deptList, ds.length ? ds.map((d) => h('button.of-dept' + (picked && d.path[0] === picked[0] ? '.on' : ''), { type: 'button', title: d.desc, onclick: () => { picked = d.path; renderLeft(); } },
      h('b', d.name), h('small', `员${num(d.total.head)}　在${num(d.total.actual)}`), d.total.vacant ? h('em', `缺${num(d.total.vacant)}`) : null)) : [h('p.ce-unk', '此组无衙署')]);
    renderRight();
  }

  // ---------- 右页 ----------
  function renderRight() {
    const d = picked && O.department(picked);
    if (!d) { replaceChildren(right, h('p.ce-unk', '未择衙署')); return; }
    replaceChildren(right, h('header.of-title', h('h3', d.name), h('small', `员额${num(d.total.head)} · 实在${num(d.total.actual)} · 缺${num(d.total.vacant)}`)),
      d.desc ? h('p.of-desc', d.desc) : null, deptBody(d, 0));
  }
  function deptBody(d, depth) {
    return h('div.of-body',
      d.positions.length ? h('div.of-table', d.positions.map((p) => posRow(p))) : null,
      d.subs.map((s) => h('section.of-sub' + (depth ? '.deep' : ''), h('h4', s.name, h('small', `员${num(s.total.head)}　缺${num(s.total.vacant)}`)), s.desc ? h('p.of-desc', s.desc) : null, deptBody(s, depth + 1))));
  }
  function posRow(p) {
    const holder = p.holders[0];
    const acts = [
      h('button.q-yapai', { type: 'button', onclick: () => openPicker(p) }, holder ? '改换' : '任命'),
      p.level <= 6 ? h('button.q-yapai', { type: 'button', onclick: () => openTingtui(p) }, '廷推') : null,
      holder ? h('button.q-yapai', { type: 'button', onclick: () => run(() => O.dismiss(p, holder.name)) }, '罢免') : null,
      holder ? h('button.q-yapai.danger', { type: 'button', onclick: () => openImpeach(p, holder.name) }, '弹劾') : null,
      holder && p.level <= 6 ? h('button.q-yapai', { type: 'button', title: '三品以上荫一子入仕（候选）', onclick: () => run(() => O.menyin(holder.name)) }, '荫子') : null,
      holder && p.level <= 8 ? h('button.q-yapai', { type: 'button', title: '五品以上荐一布衣贤才（候选）', onclick: () => run(() => O.jianbi(holder.name)) }, '荐贤') : null
    ];
    return h('article.of-pos' + (p.vacant ? '.vacant' : ''),
      h('div.of-rank', p.rank || '—'),
      h('div.of-name', h('b', { title: p.duties }, p.name), h('small', `额${num(p.head)}　在${num(p.actual)}${p.vacant ? '' : ''}`), p.vacant ? h('em', `缺${num(p.vacant)}`) : null),
      h('div.of-holders', p.holders.length ? p.holders.map((x) => h('button.of-holder' + (x.travel ? '.travel' : ''), { type: 'button', onclick: () => onPerson && onPerson(x.name), title: [x.location, x.party].filter(Boolean).join(' · ') },
        h('b', x.name), x.travel ? h('em', '赴任') : null, h('small', `${x.age ? num(x.age) + '岁 ' : ''}忠${num(x.loyalty)} 智${num(x.int)} 政${num(x.adm)} 军${num(x.mil)}`)))
        : h('span.of-empty', p.unnamed ? `在岗${num(p.unnamed)}人·姓名未详` : '此职无人·政务停滞'),
        p.pending ? h('div.of-pending', h('span', `待下${profile().annals.decree}`), h('i', p.pending.line), h('button', { type: 'button', onclick: () => run(() => O.undo(p)) }, '撤销')) : null),
      h('div.of-acts', acts));
  }
  function run(f) {
    try { f(); } catch (e) { toast(e.message); }
    renderLeft();
  }

  // ---------- 任命择人 ----------
  function openPicker(p) {
    let data;
    try { data = O.candidates(p); } catch (e) { toast(e.message); return; }
    let filter = 'all', q = '';
    const list = h('div.of-cands');
    const need = data.need;
    const draw = () => {
      const rows = data.list.filter((c) => (filter === 'all' || c.tags.includes(filter)) && (!q || `${c.name}${c.title}${c.party}${c.location}`.includes(q))).slice(0, 80);
      replaceChildren(list, rows.length ? rows.map((c) => h('button.of-cand', { type: 'button', onclick: () => choose(c) },
        h('span.medal' + (c.top ? '.m' + c.top : ''), c.top ? ['', '甲', '乙', '丙'][c.top] : ''),
        h('span.who', h('b', c.name), h('small', [c.title || '无官', c.age ? `${num(c.age)}岁` : '', c.location].filter(Boolean).join(' · '))),
        h('span.match', h('i', { style: { width: `${c.match}%` } }), h('small', `胜任${num(c.match)}`)),
        h('span.stats', `忠${num(c.loyalty)} 智${num(c.int)} 政${num(c.adm)} 军${num(c.mil)}`),
        h('span.tags', c.tags.map((t) => h('em', TAGS[t] || t)), c.warnings.map((t) => h('em.warn', t)), c.travelDays ? h('em', `赴任约${num(c.travelDays)}日`) : null)))
        : [h('p.ce-unk', '无人合此')]);
    };
    const search = h('input.ce-search', { type: 'search', placeholder: '检人名、官职、党派、地点', oninput: () => { q = search.value.trim(); draw(); } });
    const fq = qianzi(FILTERS.map(([value, label]) => ({ value, label })), { value: 'all', onchange: (v) => { filter = v; draw(); } });
    let j = null;
    const choose = (c) => {
      const go = (mode) => { j.close('ok'); run(() => O.appoint(p, c.name, mode)); };
      if (c.holdsPost && c.holdsPost !== p.name) {
        const k = juan({ title: '一身两职', note: c.name, width: '28rem', content: h('div.au-pick',
          h('p.of-ask', `${c.name}现任${c.holdsPost}，新授${p.dept}${p.name}。`),
          h('button.au-pick-row', { type: 'button', onclick: () => { k.close('ok'); go('resign'); } }, h('b', '辞旧就新'), h('small', `免去原职${c.holdsPost}，全力赴任新职`)),
          h('button.au-pick-row', { type: 'button', onclick: () => { k.close('ok'); go('concurrent'); } }, h('b', '兼任两职'), h('small', '原职依旧，新职兼管；精力分散，效率打折'))) });
        return;
      }
      go('resign');
    };
    draw();
    j = juan({
      title: (p.holders[0] ? '改换' : '任命'), note: `${p.dept}·${p.name}`, width: '56rem', height: 'min(42rem, 86vh)',
      content: h('div.of-picker',
        h('p.of-need', [need.label, need.primary ? `主${need.primary}` : '', need.secondary ? `次${need.secondary}` : '', need.loyalty ? `忠诚须${num(need.loyalty)}` : ''].filter(Boolean).join('　·　')),
        h('div.of-ptools', search, fq), list)
    });
  }
  function openTingtui(p) {
    const list = O.tingtui(p);
    const j = juan({
      title: '廷推', note: `${p.dept}·${p.name}${p.rank ? '（' + p.rank + '）' : ''}`, width: '34rem',
      content: list.length ? h('div.au-pick', h('p.of-ask', '在京四品以上诸臣各举一人；点所举者录入议事清册，下旨方定。'),
        list.map((c, i) => h('button.au-pick-row' + (i === 0 ? '.top' : ''), { type: 'button', onclick: () => { j.close('ok'); run(() => O.nominate(p, c.name)); } },
          h('b', c.name, h('small', ` ${c.title}`)), h('small', `${num(c.votes)}票 · ${c.from.join('、')}　智${num(c.int)} 政${num(c.adm)} 军${num(c.mil)}`))))
        : h('p.of-ask', '无合适人选。')
    });
  }
  function openImpeach(p, name) {
    const odds = O.impeachOdds(name);
    juan({
      title: '弹劾', note: `${name}·${p.dept}${p.name}`, width: '30rem',
      content: h('div.of-impeach', h('p', `预计成算 ${num(odds)}%（${odds >= 60 ? '易下' : odds >= 35 ? '可试' : '难图'}）`),
        h('p.of-ask', `弹章并入${profile().annals.decree}，本回合推演判定成败：成则其职空出待补；败则威望受损，被劾者怀恨。`)),
      actions: [{ label: '递上弹章', onclick: ({ close }) => { close('ok'); run(() => O.impeach(p, name)); } }]
    });
  }

  // ---------- 开合 ----------
  function show() {
    renderLeft();
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
  game.on('game:changed', (x) => { if (opened && (!x || x.what !== 'office')) renderLeft(); });
  return { show, hide, get opened() { return opened; } };
}
