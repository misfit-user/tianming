// 军：军籍册。左叶「诸军」按兵种分组列各军（兵额为奏报之数），标出告急、欠饷、在途、缺帅；「战事」列进行中的战事与流寇。
// 右叶为所选一军的全貌：统帅、驻地、军质、器械、动态，士气训练忠诚控制补给与兵变之险，兵种构成、编制、饷给、军令；
// 案底：核饷点验、补饷、整训、调防、易将、付廷议、接战预勾。「战事」页右叶为近来战录。经 game.army。
// 通用一套（非元首坐下）只看所统之兵：scope() 交回统帅名，诸军只列其人所统，册题写「所统」（所知之律：他军之数非其所能知）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig } from '../core/numerals.js';
import { qianzi, juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const amt = (v) => num(roundSig(Math.abs(v || 0), 3));
const TABS = [['armies', '诸军'], ['war', '战事']];

export function createArmy({ root, game, onCourt, onFiscal, scope = () => null }) {
  const A = game.army;
  let tab = 'armies';
  let sel = '';
  let opened = false;

  const tabs = qianzi(TABS.map(([value, label]) => ({ value, label })), { value: tab, onchange: (v) => { tab = v; render(); } });
  const sumEl = h('p.ar-sum');
  const leftBody = h('div.ar-lbody');
  const left = h('section.ce-leaf.left.ar-left', h('header.ce-head', h('h2', '军务'), h('small', '军籍')), h('div.fi-tabs', tabs), sumEl, leftBody);
  const right = h('section.ce-leaf.right.ar-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.ar-ov', { role: 'dialog', 'aria-label': '军籍册' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  function run(f) { try { return f(); } catch (e) { toast(e.message); return null; } }
  // 所统口径：只留此人所统诸军，合计照留下的重算
  function scoped(R) {
    const who = scope();
    left.querySelector('.ce-head small').textContent = who ? '所统' : '军籍';
    if (!who) return R;
    const groups = R.groups.map((g) => ({ ...g, rows: g.rows.filter((r) => r.commander === who) })).filter((g) => g.rows.length).map((g) => ({ ...g, soldiers: g.rows.reduce((s, r) => s + r.soldiers, 0) }));
    const rows = groups.flatMap((g) => g.rows);
    return { groups, count: rows.length, total: rows.reduce((s, r) => s + r.soldiers, 0), hot: rows.filter((r) => r.hot).length, arrears: rows.filter((r) => r.arrears).length, marching: rows.filter((r) => r.march).length };
  }
  function render() {
    const R = scoped(A.roster());
    replaceChildren(sumEl, `在册${num(R.count)}支 · 兵${amt(R.total)}`,
      R.hot ? h('em.hot', `告急${num(R.hot)}`) : null, R.arrears ? h('em', `欠饷${num(R.arrears)}`) : null, R.marching ? h('em.go', `在途${num(R.marching)}`) : null);
    if (tab === 'war') return renderWar();
    const all = R.groups.flatMap((g) => g.rows);
    if (!all.some((r) => r.key === sel)) sel = (all.find((r) => r.hot) || all[0] || {}).key || '';
    replaceChildren(leftBody, R.groups.length ? R.groups.map((g) => h('section.ar-grp',
      h('h4', h('span', g.type), h('small', `${num(g.rows.length)}支 · ${amt(g.soldiers)}`)),
      g.rows.map((r) => h('button.ar-row' + (r.key === sel ? '.on' : '') + (r.hot ? '.hot' : ''), { type: 'button', onclick: () => { sel = r.key; render(); } },
        h('b', r.name),
        h('span.who', [r.vacant ? h('em', '缺帅') : r.commander, r.location].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
        h('span.n', amt(r.soldiers)),
        h('span.marks', r.march ? h('i.go', '行') : null, r.arrears ? h('i', '欠') : null, r.hot ? h('i.hot', '急') : null)))))
      : [h('p.ce-unk', scope() ? '麾下无兵' : '本朝无兵在册')]);
    if (sel) renderArmy(sel); else replaceChildren(right, h('p.ce-unk', '择一军观之'));
  }

  // ---------- 右叶：一军全貌 ----------
  function renderArmy(key) {
    const d = run(() => A.detail(key));
    if (!d) { replaceChildren(right); return; }
    const cmd = d.commanderState === 'vacant' ? h('b.warn', '空缺') : d.commanderState === 'dead' ? h('b.warn', `${d.commander}（已殁）`) : h('b', d.commander, d.commanderTitle ? h('small', d.commanderTitle) : null);
    const act = d.march ? `行军 · 趋${d.march.to || '？'} ${num(d.march.progress)}/${num(d.march.total)}回合 · 余${num(Math.max(0, d.march.total - d.march.progress))}` : d.activity;
    const bar = (label, v, bad) => h('div.ar-bar' + (bad ? '.bad' : ''), h('span', label), h('i', h('b', { style: { width: `${v}%` } })), h('em', num(Math.round(v))));
    const compMax = Math.max(1, ...d.composition.map((c) => c.count));
    replaceChildren(right,
      h('header.ar-title', h('h3', d.name), h('small', `${d.type} · ${amt(d.soldiers)}兵`), d.hot ? h('em.hot', '军情告急') : null),
      h('div.ar-grid',
        h('div', h('span', '统帅'), cmd), h('div', h('span', '驻地'), h('b', d.location || '未置')),
        h('div', h('span', '军质'), h('b', d.quality || '未录')), h('div', h('span', '器械'), h('b', d.equipment.condition || '未录'))),
      h('div.ar-lines',
        h('p', h('span', '动态'), act),
        d.faction ? h('p', h('span', '所属'), d.faction) : null,
        d.desc ? h('p.desc', h('span', '军情'), d.desc) : null),
      h('div.ar-bars',
        bar('士气', d.morale, d.morale < 45), bar('训练', d.training), bar('忠诚', d.loyalty), bar('控制', d.control),
        bar('补给', d.supply, d.supply < 35), bar('兵变之险', d.mutiny, d.mutiny >= 55)),
      h('div.ar-cols',
        d.composition.length ? h('section.fi-sec', h('h4', '兵种构成'), d.composition.map((c) => h('div.fi-bar.in', h('span.k', c.type), h('span.v', h('i', { style: { width: `${(c.count / compMax) * 100}%` } })), h('span.n', c.count ? amt(c.count) : ''), h('small')))) : null,
        d.units.length ? h('section.fi-sec', h('h4', '编制'), d.units.map((u) => {
          // 满编之队并作「几队×几人」，未满的零队另列
          const full = u.sizes.filter((n) => n >= 1000), part = u.sizes.filter((n) => n < 1000);
          const text = [full.length ? `${num(full.length)}队×${num(full[0])}` : '', part.map((n) => num(n)).join('、')].filter(Boolean).join(' ＋ ');
          return h('p.ar-unit', h('b', { title: u.name }, u.name), h('em', u.tac), h('span', text), h('small', `历练${num(u.vet)}`));
        })) : null),
      h('div.ar-cols',
        d.equipment.list.length ? h('section.fi-sec', h('h4', '器械'), d.equipment.list.map((e) => h('p.ar-kv', h('span', e.name), h('b', e.count ? amt(e.count) : ''), e.condition ? h('small', e.condition) : null))) : null,
        h('section.fi-sec', h('h4', '饷给'), d.pay.length ? d.pay.map((p) => h('p.ar-kv', h('span', p.label), h('b', amt(p.amount)), h('small', [p.unit, p.period].filter(Boolean).join('／')))) : h('p.ce-unk', '未录'),
          d.arrears ? h('p.ar-arrears', `欠饷${num(d.arrears)}月`) : null,
          d.logistics ? h('p.ar-kv', h('span', '军需'), h('b', d.logistics)) : null)),
      d.command ? h('section.fi-sec', h('h4', '军令'), h('div.ar-command', d.command)) : null,
      actions(d));
  }
  function actions(d) {
    const go = (f) => () => { const r = run(f); if (typeof r === 'string' && r) toast(r); render(); };
    return h('section.fi-sec.ar-acts', h('h4', '处置'),
      h('div.fi-btns',
        h('button.q-yapai', { type: 'button', title: '点验名册，掀出实额', onclick: () => inspect(d) }, '核饷点验'),
        d.arrears ? h('button.q-yapai', { type: 'button', title: `欠饷${d.arrears}月，自国库实付`, onclick: go(() => A.settle(d.key)) }, '补饷') : null,
        h('button.q-yapai', { type: 'button', title: '拟入议事清册', onclick: go(() => A.train(d.key)) }, '整训'),
        run(() => A.marchable(d.key))
          ? h('button.q-yapai', { type: 'button', title: '下军令移防（行军系统）', onclick: () => marchTo(d) }, '移防')
          : h('button.q-yapai', { type: 'button', title: '拟入议事清册', onclick: go(() => A.redeploy(d.key)) }, '调防'),
        d.own ? h('button.q-yapai', { type: 'button', onclick: () => pickCommander(d) }, '易将') : null,
        onCourt ? h('button.q-yapai', { type: 'button', onclick: () => { const t = run(() => A.courtTopic(d.key)); if (t) { hide(); onCourt(t); } } }, '付廷议') : null,
        d.own ? h('button.q-yapai' + (d.stance !== 'ask' ? '.on' : ''), { type: 'button', onclick: go(() => A.cycleStance(d.key)) }, A.STANCES[d.stance]) : null));
  }
  // 移防：择目的地（可输可选），下确定性军令
  function marchTo(d) {
    const list = run(() => A.destinations()) || [];
    const id = 'ar-march-dests';
    const inp = h('input.st-in', { type: 'text', placeholder: '目的地', list: id, style: { width: '100%' } });
    const j = juan({
      title: '移防', note: d.name, width: '30rem',
      content: h('div', { style: { lineHeight: 2 } },
        h('p', { style: { margin: '0 0 .5rem' } }, `现驻：${d.location || '不明'}。指定目的地：`), inp,
        h('datalist', { id }, list.map((n) => h('option', { value: n })))),
      actions: [{ label: '发军令', onclick: ({ close }) => { const r = run(() => A.march(d.key, inp.value)); if (r) { toast(r); close('ok'); render(); } } }]
    });
    setTimeout(() => inp.focus(), 60);
    return j;
  }
  // 核饷：失真层开着则当场掀出实额、留在本册；没开就去度支册看饷
  function inspect(d) {
    const r = run(() => A.inspect(d.key));
    if (!r) return;
    if (r.revealed) { toast(r.text); render(); return; }
    if (onFiscal) { hide(); onFiscal(); }
  }
  function pickCommander(d) {
    const list = run(() => A.candidates(d.key)) || [];
    let j = null;
    j = juan({
      title: '易将', note: d.name, width: '34rem', height: 'min(38rem, 80vh)',
      content: h('div.ar-pick',
        h('p.fi-note', d.commanderState === 'vacant' ? '现主帅空缺，此军无人统御。' : d.commanderState === 'dead' ? `现主帅${d.commander}已殁，亟待补任。` : `现主帅${d.commander}。拜将后此军忠诚略降。`),
        list.length ? h('div.au-pick', list.map((c) => h('button.au-pick-row', { type: 'button', onclick: () => {
          j.close('ok');
          run(() => A.appoint(d.key, c.name));
          render();
        } }, h('b', c.name), h('small', [`武${num(c.mil)} 智${num(c.intel)}`, c.title, c.same ? '' : c.faction || '无属'].filter(Boolean).join(' · ')))))
          : h('p.ce-unk', '暂无可调遣之在世将才'))
    });
  }

  // ---------- 战事 ----------
  function renderWar() {
    const B = A.battles();
    const R = A.rebels();
    replaceChildren(leftBody,
      h('section.ar-grp', h('h4', h('span', '进行中'), h('small', `${num(B.active.length)}处`)),
        B.active.length ? B.active.map((b) => h('div.ar-war', h('b', `${b.attacker} 对 ${b.defender}`), h('span', [b.location, b.phase].filter(Boolean).join(' · '))))
          : h('p.ce-unk', '四境暂无交锋')),
      h('section.ar-grp', h('h4', h('span', '流寇'), h('small', R.length ? `${num(R.length)}股 · 众${amt(R.reduce((s, r) => s + r.strength, 0))}` : '')),
        R.length ? R.map((r) => h('div.ar-war.hot', h('b', r.name, h('em', r.tier)), h('span', `众${amt(r.strength)}${r.regions.length ? ` · 流窜${r.regions.join('、')}` : ''}`)))
          : h('p.ce-unk', '境内无流寇')));
    replaceChildren(right, h('header.ar-title', h('h3', '战录'), h('small', '近来交锋，新者在前')),
      B.history.length ? h('div.ar-history', B.history.map((r) => h('p',
        h('span.when', r.when),
        h('b', `${r.attacker} 对 ${r.defender}`),
        h('span', r.winner ? `${r.winner}胜` : ''),
        h('small', r.attackerLoss || r.defenderLoss ? `折损 攻${amt(r.attackerLoss)} · 守${amt(r.defenderLoss)}` : ''))))
        : h('p.ce-unk', '尚无战录'));
  }

  function show(key) {
    if (key) { sel = key; tab = 'armies'; tabs.setValue('armies'); }
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
