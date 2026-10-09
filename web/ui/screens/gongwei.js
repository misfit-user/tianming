// 宫闱册：左叶四签（后妃、宫中尊长、皇嗣、宫苑），右叶展开一人或一处；未择时看宫规（位分阶梯、后宫之制、外戚之制、继承法）。
// 后妃可召幸（私下叙谈）、晋封降位（拟入议事清册，推演落地）、看列传；尊长可问安；皇子可立为储君；
// 宫苑照剧本的宫殿名录（殿宇、居者），修缮、移居、新建拟入议事清册；第五签「宝」列文物奇珍（内府所藏在前，散在臣民在后）。
// 数据与动作经 game.gongwei；叫法取 profile().gongwei。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, zhou } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const TABS = [['consorts', '后'], ['elders', '尊'], ['heirs', '嗣'], ['palaces', '宫'], ['treasures', '宝']];
const RARITY_CLS = ['r0', 'r1', 'r2', 'r3', 'r3'];
// 印上的字：书名号、括号不算
const glyph = (name) => String(name).replace(/^[《「『〈（(\s]+/, '').charAt(0);

export function createGongwei({ root, game, profile, onPerson, onAudience }) {
  const Q = game.gongwei;
  let data = null;
  let tab = 'consorts';
  let sel = '';
  let opened = false;

  const title = h('h2');
  const sub = h('small');
  const tabs = h('div.gw-tabs');
  const list = h('div.gw-list');
  const left = h('section.ce-leaf.left.gw-left', h('header.ce-head', title, sub), tabs, list);
  const right = h('section.ce-leaf.right.gw-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.gw-ov', { role: 'dialog' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  const T = () => profile().gongwei || {};
  const label = (k) => ({ consorts: T().consorts || '后妃', elders: T().elders || '宫中尊长', heirs: T().heirs || '皇嗣', palaces: T().palaces || '宫苑', treasures: T().treasures || '文物奇珍' })[k];
  const favorBar = (v) => (v == null ? null : h('span.gw-fav', h('i', h('u', { style: { width: `${Math.max(0, Math.min(100, v))}%` } })), h('small', num(v))));

  // ---------- 左叶 ----------
  function renderLeft() {
    const t = T();
    title.textContent = t.title || '宫闱';
    sub.textContent = t.sub || '';
    const counts = { consorts: data.consorts.length, elders: data.elders.length, heirs: data.heirs.length, palaces: data.palaces ? data.palaces.list.length : 0, treasures: data.treasures.length };
    replaceChildren(tabs, TABS.map(([k, g]) => h('button' + (k === tab ? '.on' : ''), { type: 'button', onclick: () => { tab = k; sel = ''; renderLeft(); renderRight(); } },
      h('i', g), h('b', label(k).slice(-2)), h('small', num(counts[k])))));
    let items = [];
    if (tab === 'consorts') {
      let rank = null;
      for (const c of data.consorts) {
        if (c.rank !== rank) { rank = c.rank; items.push(h('p.gw-grp', rank)); }
        items.push(row(c.name, [c.residence, c.age != null ? `${num(c.age)}岁` : ''].filter(Boolean).join(' · '), c.portrait,
          h('span.marks', c.pregnant ? h('em.preg', '孕') : null, c.proposed ? h('em.pend', '拟') : null, favorBar(c.favor))));
      }
      if (!items.length) items = [h('p.ce-unk', '后宫无人')];
    } else if (tab === 'elders') {
      items = data.elders.map((c) => row(c.name, [c.title, c.residence].filter(Boolean).join(' · '), c.portrait));
      if (!items.length) items = [h('p.ce-unk', '宫中无尊长遗眷')];
    } else if (tab === 'heirs') {
      items = data.heirs.map((c) => row(c.name, [c.title, c.age != null ? `${num(c.age)}岁` : '', c.mother && `母${c.mother}`].filter(Boolean).join(' · '), c.portrait,
        c.designated ? h('span.marks', h('em.heir', '储')) : null));
      if (data.pending.length) items.push(h('p.gw-grp', '有孕'), ...data.pending.map((p) => h('p.gw-note', `${p.mother} · 第${num(p.since)}回合诊出`)));
      if (!items.length) items = [h('p.ce-unk', '尚无皇嗣')];
    } else if (tab === 'treasures') {
      let grp = null;
      for (const it of data.treasures) {
        const g2 = it.mine ? '内府所藏' : '散在臣民';
        if (g2 !== grp) { grp = g2; items.push(h('p.gw-grp', g2)); }
        items.push(h('button.gw-item.pal' + (it.id === sel ? '.on' : ''), { type: 'button', dataset: { id: it.id }, onclick: () => pick(it.id) },
          h('i.gw-pal.gw-bao.' + RARITY_CLS[it.rank], glyph(it.name)), h('b', it.name), h('span.meta', [it.type, it.mine ? '' : it.owner].filter(Boolean).join(' · ')),
          it.rarity ? h('span.marks', h('em.' + RARITY_CLS[it.rank], it.rarity)) : null));
      }
      if (!items.length) items = [h('p.ce-unk', '尚无文物在册')];
    } else {
      const pl = data.palaces;
      if (!pl) items = [h('p.ce-unk', '本剧本未载宫殿之序')];
      else {
        let ty = null;
        for (const p of pl.list) {
          if (p.typeLabel !== ty) { ty = p.typeLabel; items.push(h('p.gw-grp', ty)); }
          items.push(h('button.gw-item.pal' + (p.id === sel ? '.on' : ''), { type: 'button', dataset: { id: p.id }, onclick: () => pick(p.id) },
            h('i.gw-pal', p.name.charAt(0)), h('b', p.name), h('span.meta', [p.use.slice(0, 18), p.residents.length ? `居${num(p.residents.length)}人` : ''].filter(Boolean).join(' · ')),
            p.status !== 'intact' ? h('span.marks', h('em.bad', p.statusLabel)) : null));
        }
      }
    }
    replaceChildren(list, items);
  }
  function row(name, meta, portrait, marks) {
    return h('button.gw-item' + (name === sel ? '.on' : ''), { type: 'button', dataset: { id: name }, onclick: () => pick(name) },
      h('i.gw-av.' + tab, name.charAt(0)), h('b', name), h('span.meta', meta), marks || null);
  }
  function pick(id) {
    sel = id;
    list.querySelectorAll('.gw-item').forEach((b) => b.classList.toggle('on', b.dataset.id === sel));
    renderRight();
  }

  // ---------- 右叶 ----------
  function facts(rows) { return h('dl.gw-facts', rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => [h('dt', k), h('dd', v)])); }
  function acts(list2) { const a = list2.filter(Boolean); return a.length ? h('div.gw-acts', a.map(([lb, f, cls]) => h('button.q-yapai' + (cls ? '.' + cls : ''), { type: 'button', onclick: f }, lb))) : null; }
  function head(name, portrait, seal, sub2) {
    return h('header.gw-head', zhou({ name, src: portrait }), h('div', h('h3', name, seal ? h('em.gw-seal', seal) : null), sub2 ? h('p', sub2) : null));
  }
  function consortDoc(c) {
    const t = T();
    const turnNote = c.lastVisit != null ? `第${num(c.lastVisit)}回合${c.idle ? `（已${num(c.idle)}回合未召）` : ''}` : '未有召幸之记';
    return [head(c.name, c.portrait, c.rank, c.title !== c.rank ? c.title : ''),
      facts([['年齿', c.age != null ? `${num(c.age)}岁` : ''], ['居所', c.residence], ['母家', c.family], ['宠', c.favor != null ? favorBar(c.favor) : '未详'],
        ['忠', c.loyalty != null ? num(c.loyalty) : ''], ['子嗣', c.children.length ? c.children.join('、') : '无'], ['有孕', c.pregnant ? `第${num(c.pregnant.since)}回合诊出${c.pregnant.detail ? '·' + c.pregnant.detail : ''}` : ''],
        [t.visit || '召幸', turnNote], ['所拟', c.proposed ? '晋降之议已入议事清册，待颁' : '']]),
      c.bio ? h('p.gw-bio', c.bio) : null,
      acts([[t.visit || '召幸', () => visit(c.name), 'main'], [t.promote || '晋封', () => rankJuan(c, true)], [t.demote || '降位', () => rankJuan(c, false)],
        onPerson ? ['列传', () => person(c.name)] : null])];
  }
  function elderDoc(c) {
    const t = T();
    return [head(c.name, c.portrait, '', c.title), facts([['年齿', c.age != null ? `${num(c.age)}岁` : ''], ['居所', c.residence], ['母家', c.family], ['与上', c.relation || c.spouse && `${c.spouse}之配`], ['忠', c.loyalty != null ? num(c.loyalty) : '']]),
      c.bio ? h('p.gw-bio', c.bio) : null,
      acts([[t.greet || '问安', () => visit(c.name), 'main'], onPerson ? ['列传', () => person(c.name)] : null])];
  }
  function heirDoc(c) {
    const t = T();
    return [head(c.name, c.portrait, c.designated ? '储' : '', c.title), facts([['年齿', c.age != null ? `${num(c.age)}岁` : ''], ['生母', c.mother]]),
      c.designated ? h('p.gw-bio', '已立为储君：驾崩、禅让时由其继统。') : null,
      acts([c.male && !c.designated ? [t.crown || '立为储君', () => crown(c), 'main'] : null, onPerson ? ['列传', () => person(c.name)] : null])];
  }
  function palaceDoc(p) {
    const t = T();
    return [h('header.gw-head.pal', h('i.gw-pal.big', p.name.charAt(0)), h('div', h('h3', p.name, h('em.gw-seal', p.typeLabel)), h('p', [p.location, p.statusLabel].filter(Boolean).join(' · ')))),
      facts([['功用', p.use], ['始建', p.built ? `${p.built}年` : ''], ['岁修', p.cost ? `${num(p.cost)}两` : ''], ['上次修缮', p.lastRenovation ? `第${num(p.lastRenovation)}回合` : '']]),
      p.description ? h('p.gw-bio', p.description) : null,
      p.halls.length ? h('section.gw-halls', h('h5', '殿宇'), p.halls.map((sh) => h('p', h('b', sh.name), h('small', `${sh.role} ${num(sh.occupants.length)}／${num(sh.capacity)}`), sh.occupants.join('、')))) : null,
      p.residents.length ? h('section.gw-halls', h('h5', '今居'), h('p', p.residents.map((n, i) => [i ? '、' : null, onPerson ? h('button.link', { type: 'button', onclick: () => person(n) }, n) : n]))) : null,
      acts([[t.renovate || '修缮', () => renovateJuan(p), 'main'], [t.move || '移居', () => moveJuan(p)], [t.build || '修建新宫殿', () => buildJuan()]])];
  }
  function treasureDoc(it) {
    return [h('header.gw-head.pal', h('i.gw-pal.big.gw-bao.' + RARITY_CLS[it.rank], glyph(it.name)), h('div', h('h3', it.name, h('em.gw-seal', it.type)), h('p', [it.rarity, it.era].filter(Boolean).join(' · ')))),
      facts([['所在', it.ownerIsChar && onPerson ? h('button.link', { type: 'button', onclick: () => person(it.ownerName) }, it.owner) : (it.owner || '未详')],
        ['数量', it.quantity > 1 ? num(it.quantity) : ''], ['估值', it.value ? `${num(it.value)}${it.unit}` : ''], ['来历', it.provenance]]),
      it.description ? h('p.gw-bio', it.description) : null,
      it.effect ? h('section.gw-rule', h('h5', '效用'), h('p', it.effect)) : null];
  }
  function treasureSummary() {
    const L = data.treasures;
    const byRank = ['传说', '珍贵', '精良', '普通'].map((r) => [r, L.filter((x) => x.rarity === r).length]).filter(([, c]) => c);
    const byType = [...new Set(L.map((x) => x.type))].map((t) => [t, L.filter((x) => x.type === t).length]);
    return [h('header.gw-head.rules', h('div', h('h3', label('treasures')), h('p', '宝玺、兵器、符节、典籍、珍宝诸物'))),
      h('section.gw-rule', h('h5', '总目'), h('p', `在册${num(L.length)}件：内府所藏${num(L.filter((x) => x.mine).length)}，散在臣民${num(L.filter((x) => !x.mine).length)}。`)),
      byRank.length ? h('section.gw-ladder', h('h5', '品第'), h('ol', byRank.map(([r, c]) => h('li', h('b', r), h('small', `${num(c)}件`))))) : null,
      byType.length ? h('section.gw-ladder', h('h5', '门类'), h('ol', byType.map(([t, c]) => h('li', h('b', t), h('small', `${num(c)}件`))))) : null];
  }
  function rules() {
    const t = T();
    return [h('header.gw-head.rules', h('div', h('h3', '宫规'), h('p', '位分之序、后宫之制、外戚之制与继承之法'))),
      data.ranks.length ? h('section.gw-ladder', h('h5', '位分'), h('ol', data.ranks.map((r) => h('li', h('b', r.name), h('small', num(data.consorts.filter((c) => c.rank === r.name).length) + '人'))))) : null,
      data.description ? h('section.gw-rule', h('h5', '后宫之制'), h('p', data.description)) : null,
      data.clan ? h('section.gw-rule', h('h5', '外戚之制'), h('p', data.clan)) : null,
      data.succession ? h('section.gw-rule', h('h5', '继承之法'), h('p', data.succession)) : null,
      tab === 'palaces' && data.palaces ? h('section.gw-rule', h('h5', data.palaces.capital), h('p', data.palaces.description || '')) : null,
      tab === 'palaces' && data.palaces ? acts([[t.build || '修建新宫殿', () => buildJuan(), 'main']]) : null];
  }
  function renderRight() {
    let out;
    const c = tab === 'consorts' ? data.consorts.find((x) => x.name === sel) : tab === 'elders' ? data.elders.find((x) => x.name === sel) : tab === 'heirs' ? data.heirs.find((x) => x.name === sel) : null;
    const p = tab === 'palaces' && data.palaces ? data.palaces.list.find((x) => x.id === sel) : null;
    const it = tab === 'treasures' ? data.treasures.find((x) => x.id === sel) : null;
    if (tab === 'treasures') out = it ? treasureDoc(it) : treasureSummary();
    else if (tab === 'consorts' && c) out = consortDoc(c);
    else if (tab === 'elders' && c) out = elderDoc(c);
    else if (tab === 'heirs' && c) out = heirDoc(c);
    else if (p) out = palaceDoc(p);
    else out = rules();
    replaceChildren(right, out.filter(Boolean));
    right.scrollTop = 0;
  }

  // ---------- 动作 ----------
  function reload() {
    try { data = Q.court(); } catch (e) { toast(e.message); return; }
    renderLeft();
    renderRight();
  }
  function person(name) { hide(); onPerson(name); }
  function visit(name) { hide(); onAudience(name); }
  function rankJuan(c, up) {
    const t = T();
    const cur = data.ranks.find((r) => r.name === c.rank);
    const options = data.ranks.filter((r) => (cur ? (up ? r.level < cur.level : r.level > cur.level) : true));
    if (!options.length) { toast(up ? '已位极后宫' : '已无可降'); return; }
    let to = up ? options[options.length - 1].name : options[0].name;
    const btns = h('div.gw-ranks', options.map((r) => h('button' + (r.name === to ? '.on' : ''), { type: 'button', onclick: (e) => { to = r.name; btns.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, r.name)));
    const why = h('textarea.gw-ta', { rows: 3, placeholder: '缘由（可空）：如诞育有功、侍奉勤谨……' });
    juan({ title: `${up ? t.promote || '晋封' : t.demote || '降位'}·${c.name}`, note: `今为${c.rank}`, width: '30rem', content: h('div.gw-form', btns, why),
      actions: [{ label: '拟入议事清册', onclick: ({ close }) => { try { Q.proposeRank(c.name, to, why.value.trim()); close('ok'); toast('已拟入议事清册，颁诏后由推演落地'); } catch (e) { toast(e.message); } reload(); } }] });
  }
  function crown(c) {
    const t = T();
    juan({ title: t.crown || '立为储君', note: c.name, width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, `立${c.name}为储君？国本一定，中外瞩目；驾崩、禅让时由其继统。`),
      actions: [{ label: '立之', onclick: ({ close }) => { try { Q.designate(c.name); close('ok'); toast(`已立${c.name}为储君`); } catch (e) { toast(e.message); } reload(); } }] });
  }
  function renovateJuan(p) {
    const ta = h('textarea.gw-ta', { rows: 3, placeholder: p.status === 'ruined' ? '如：荒废重建，恢复规制' : '如：整修正殿屋瓦、重绘彩绘、重铺砖石' });
    juan({ title: `修缮·${p.name}`, note: `今${p.statusLabel}`, width: '30rem', content: h('div.gw-form', h('label', '修缮意图（告知推演）', ta)),
      actions: [{ label: '拟入议事清册', onclick: ({ close }) => { act(() => Q.renovate(p.name, ta.value)); close('ok'); toast('已拟入议事清册'); } }] });
  }
  function moveJuan(p) {
    const people = [...new Set([...p.halls.flatMap((sh) => sh.occupants), ...p.residents, ...data.consorts.map((c) => c.name)])];
    if (!people.length) { toast('无人可迁'); return; }
    const targets = data.palaces.list.filter((x) => Q.DWELLING.includes(x.type)).sort((a, b) => Q.DWELLING.indexOf(a.type) - Q.DWELLING.indexOf(b.type))
      .flatMap((x) => (x.halls.length ? x.halls.map((sh) => ({ pal: x.name, hall: sh.name, full: sh.occupants.length >= sh.capacity, note: `${sh.role} ${sh.occupants.length}/${sh.capacity}` })) : [{ pal: x.name, hall: '', full: false, note: x.typeLabel }]));
    let who = people[0], to = targets.find((x) => !x.full) || targets[0];
    const whoBox = h('div.gw-ranks', people.map((n) => h('button' + (n === who ? '.on' : ''), { type: 'button', onclick: (e) => { who = n; whoBox.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, n)));
    const toBox = h('div.gw-targets', targets.map((x) => h('button' + (x === to ? '.on' : ''), { type: 'button', disabled: x.full, onclick: (e) => { to = x; toBox.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } },
      h('b', x.pal + (x.hall ? '·' + x.hall : '')), h('small', x.full ? '已满' : x.note))));
    const why = h('textarea.gw-ta', { rows: 2, placeholder: '缘由：如晋位移居某宫正殿；或失宠迁出……' });
    juan({ title: `移居·${p.name}`, width: '40rem', height: 'min(36rem, 84vh)', content: h('div.gw-form', h('label', '迁谁', whoBox), h('label', '迁往', toBox), h('label', '缘由', why)),
      actions: [{ label: '拟入议事清册', onclick: ({ close }) => { act(() => Q.move(who, to && to.pal, to && to.hall, why.value.trim())); close('ok'); toast('已拟入议事清册'); } }] });
  }
  function buildJuan() {
    const nm = h('input.gw-ta', { placeholder: '新宫殿名' });
    const ta = h('textarea.gw-ta', { rows: 3, placeholder: '用途、规模、位置（告知推演）' });
    juan({ title: T().build || '修建新宫殿', width: '30rem', content: h('div.gw-form', h('label', '宫名', nm), h('label', '用途规模', ta)),
      actions: [{ label: '拟入议事清册', onclick: ({ close }) => { try { Q.build(nm.value, ta.value); close('ok'); toast('已拟入议事清册，颁诏后由推演判定'); } catch (e) { toast(e.message); } } }] });
  }
  function act(f) { try { f(); } catch (e) { toast(e.message); } reload(); }

  function show(what) {
    if (what) { tab = what; sel = ''; }
    reload();
    ov.setAttribute('aria-label', T().title || '宫闱');
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
  game.on('game:changed', () => { if (opened) reload(); });
  return { show, hide, get opened() { return opened; } };
}
