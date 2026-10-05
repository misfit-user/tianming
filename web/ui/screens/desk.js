// 御案：俯看书案。顶栏一条账簿（帑廪、内帑、户口、九品国势、时间件与推演），左列人物图志、舆图签、邸报刻本，
// 右列瓦当圆章，案底一排漆牌与「诏付有司」印，案上器物各系牙牌。点案上绢图俯身入图（立体青绿舆图）。
// 数据一律经 game（适配层）取；动作未接上的牌子先展一卷「在建」说明。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, qianzi, wadang, pai, sealButton, zhang, pin, zhou, keben, jian, btn, clock, qiPanel, tag } from '../kit/index.js';
import { LOOK_QINGLV_AGED } from '../scene/map/looks.js';
import { createDive } from '../scene/transitions.js';
import { openSettings } from './settings.js';

const LAYERS = ['民情', '阶层', '财赋', '军务', '官守', '役政', '势力'];
const RAIL = [['舆', '舆图'], ['奏', '百官奏疏'], ['人', '人物图志'], ['官', '官制'], ['财', '财计'], ['军', '军务'], ['史', '史官实录']];
const DOCK = [['御案时政', '案头花笺', true], ['撰写诏书', '起草政令'], ['百官奏疏', '御览奏报'], ['鸿雁传书', '遣使通信'], ['史官实录', '回合档案']];
const TAGS = [['memorials', '奏折'], ['tray', '时政花笺'], ['letterbox', '信匣'], ['writing', '笔砚'], ['books', '史册'], ['seal', '玉玺']];

export function createDesk({ root, stage, study, map, game, labels, clouds }) {
  // ---------- 顶栏 ----------
  const dyn = h('div.q-yin.dyn', '');
  const time = clock({ onSettle: () => confirmAdvance() });
  const ledger = h('div.ledger');
  const gauges = h('div.gauges');
  const tools = h('div.tools',
    btn('存', { title: '封存此卷', onclick: () => saveDialog() }),
    btn('典', { title: '典章', onclick: () => openSettings() }),
    btn('问', { title: '问天', onclick: () => building('问天', '问天控制台') }),
    btn('总', { title: '全部变量', onclick: () => building('全部变量', '诸般数目') }));
  const topbar = h('header.topbar', dyn, time, ledger, gauges, tools);

  // ---------- 左列 ----------
  const faces = h('div.faces');
  const renwu = qiPanel({ title: '人物图志', note: '…' }, faces);
  const chips = qianzi(LAYERS, { value: '势力' });
  const maptools = qiPanel({ title: '舆图', note: '七种看法' }, chips);
  const dibao = h('div.dibao');
  const left = h('div.left', renwu, maptools, dibao);

  // ---------- 右列瓦当、案底漆牌 ----------
  const medals = RAIL.map(([ch, name]) => wadang({ ch, name, onclick: () => onRail(name) }));
  const rail = h('nav.rail', medals);
  const plaques = DOCK.map(([title, sub, aside]) => pai({ title, sub, aside, onclick: () => onDock(title) }));
  const dock = h('section.dock', plaques, sealButton({ chars: ['诏', '付', '有', '司'], title: '诏付有司', onclick: () => building('诏付有司', '颁行已拟诏书') }));
  const tagEls = TAGS.map(([k, t]) => { const el = tag(t); el.dataset.k = k; el.dataset.label = t; return el; });
  const tags = h('div.tags', tagEls);
  const hint = h('div.hint', '点案上舆图 · 俯身入图');
  const el = h('section.scr.scr-desk', tags, topbar, left, rail, dock, hint);

  // ---------- 舆图模式 ----------
  const mapChips = qianzi(LAYERS, { value: '势力' });
  const mapNote = h('small', '');
  const mappanel = h('section.q-qi.mappanel', h('h3.q-ti', h('span.q-gold', '舆图'), mapNote), mapChips);
  const card = h('div.card.hide');
  const back = h('button.q-qi.q-pai.back', { type: 'button', onclick: () => dive.rise() }, h('b.q-gold', '回御案'), h('small', '起身离图'));
  const mapEl = h('section.scr.scr-map', mappanel, back, card);

  const veil = h('div.advancing', h('div.box.q-qi', h('b.q-gold', '推 演'), h('span', '')));
  root.append(el, mapEl, veil);

  // ---------- 入图 ----------
  const dive = createDive({
    stage, study, map, clouds,
    onMode: (m) => {
      el.classList.toggle('flying', m === 'flying');
      if (m === 'flying') { mapEl.classList.remove('on'); card.classList.add('hide'); }
      if (m === 'settled') { mapEl.classList.add('on'); el.classList.add('inmap'); }
      if (m === 'desk' || m === 'desk-settled') el.classList.remove('flying', 'inmap');
    }
  });
  stage.canvas.addEventListener('click', (ev) => {
    if (!el.classList.contains('on') || dive.mode !== 'desk' || dive.busy) return;
    const p = study.pickMap(ev.clientX, ev.clientY);
    if (p) dive.dive(p);
  });
  stage.canvas.addEventListener('pointermove', (ev) => {
    const over = el.classList.contains('on') && dive.mode === 'desk' && !dive.busy && !!study.pickMap(ev.clientX, ev.clientY);
    stage.canvas.style.cursor = over ? 'zoom-in' : '';
  });
  let down = null;
  stage.canvas.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
  stage.canvas.addEventListener('pointerup', (ev) => {
    if (dive.mode !== 'map' || dive.busy || !down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
    const r = map.pickScreen(ev.clientX, ev.clientY);
    if (!r) { card.classList.add('hide'); map.select(null); return; }
    map.select(r.index);
    const fac = r.faction && factions[r.faction];
    replaceChildren(card, jian({ title: r.name, sub: [r.circuit, fac && fac.name].filter(Boolean).join(' · '), rows: [['府治', r.parent ? '属' + r.parent : '—']] }));
    card.style.transform = `translate(${Math.min(window.innerWidth - 300, ev.clientX + 24)}px, ${Math.max(90, ev.clientY - 60)}px)`;
    card.classList.remove('hide');
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dive.mode === 'map') dive.rise(); });

  // 牙牌跟着器物走；挡在面板后面的就藏起来
  study.onFrame(() => {
    if (!el.classList.contains('on')) return;
    const covered = [left, rail, dock, topbar].map((n) => n.getBoundingClientRect());
    for (const t of tagEls) {
      const a = study.anchors[t.dataset.k];
      if (!a) continue;
      const [x, y] = study.screenOf(...a);
      const hide = x < 10 || y < 80 || x > window.innerWidth - 10 || y > window.innerHeight - 10 || covered.some((r) => x > r.left && x < r.right && y > r.top && y < r.bottom);
      t.style.opacity = hide ? 0 : 1;
      const flip = x > window.innerWidth * 0.7;
      t.style.flexDirection = flip ? 'row-reverse' : 'row';
      t.style.transform = `translate(${(flip ? x - t.offsetWidth + 4 : x - 4).toFixed(1)}px, ${(y - 36).toFixed(1)}px)`;
    }
  });

  // ---------- 读数 ----------
  let factions = {};
  function refresh() {
    const s = game.select;
    const d = s.date();
    time.update({ era: `${d.era || ''}${d.reignYear ? num(d.reignYear) + '年' : ''}`, year: d.year, month: d.month, day: d.day, settling: d.busy });
    const pl = s.player();
    dyn.textContent = (pl.faction || '').replace(/朝廷$/, '').charAt(0) || '天';
    const tr = s.treasury(), pv = s.privy(), cs = s.census();
    replaceChildren(ledger,
      zhang('帑廪', tr.rows.map((r) => ({ k: r.label, v: r.value, d: r.delta, unit: r.unit }))),
      zhang('内帑', pv.rows.map((r) => ({ k: r.label, v: r.value, d: r.delta, unit: r.unit }))),
      zhang('户口', [{ k: '口', v: cs.mouths }, { k: '丁', v: cs.ding }]));
    replaceChildren(gauges, s.gauges().map((g) => pin(g.label, g.value)));
    const people = s.characters();
    const shown = [people.find((c) => c.isPlayer), ...people.filter((c) => !c.isPlayer && c.portrait)].filter(Boolean).slice(0, 4);
    replaceChildren(faces, shown.map((c) => zhou({ name: c.name, src: c.portrait, title: [c.name, c.title].filter(Boolean).join(' · ') })));
    renwu.querySelector('.q-ti small').textContent = `${num(people.length)}人`;
    const news = s.news ? s.news(8) : [];
    replaceChildren(dibao, keben('邸报', news.length ? news.map((n, i) => ({ tag: n.tag, text: n.text, soft: i > 2 })) : [{ tag: '闻', text: '今日无报', soft: true }]));
    const mem = s.memorials();
    replaceChildren(plaques[2], h('b.q-gold', '百官奏疏'), h('small', mem.length ? `今日${num(mem.length)}件` : '御览奏报'));
    if (mem.length) plaques[2].append(h('span.q-qian', num(mem.length)));
    for (const t of tagEls) if (t.dataset.k === 'memorials') t.querySelector('.q-yapai').textContent = mem.length ? `奏折 · ${num(mem.length)}` : '奏折';
    mapNote.textContent = `${d.era || ''} · ${num((map.regions || []).length)}府州`;
  }

  // 开局、读档后：舆图换上本剧本的府州，案上绢图重画（带势力名）
  async function loadWorld() {
    const mr = game.select.mapRegions();
    factions = (mr && mr.factions) || {};
    map.setRegions(mr || { regions: [], factions: {} });
    study.setMapSheet(await map.renderSheet({ look: LOOK_QINGLV_AGED }));
  }

  // ---------- 推演（过回合） ----------
  function confirmAdvance() {
    const d = game.select.date();
    juan({
      title: '推演', note: `第${num(d.turn)}回合`, width: '34rem',
      content: h('div', { style: { lineHeight: 2 } },
        h('p', { style: { margin: 0 } }, `将此期政令付诸推演：自${d.text || '今日'}起，${num(d.daysPerTurn)}日之间天下之变，由推演落定。`),
        h('p', { style: { margin: '.5rem 0 0', color: 'var(--ink-faint)', fontSize: 'var(--fs-2)' } }, '推演一回约需数分钟（视 AI 应答快慢）。')),
      actions: [{ label: '静候有司', onclick: ({ close }) => { close('ok'); runAdvance(); } }]
    });
  }
  async function runAdvance() {
    const cap = veil.querySelector('span');
    cap.textContent = '';
    veil.classList.add('on');
    const offs = [
      game.on('kernel:loading', (p) => { if (p.text) cap.textContent = p.text; }),
      game.on('game:advance-progress', (p) => { if (p.label) cap.textContent = p.label; })
    ];
    try {
      await game.advance({ court: false });
    } catch (err) {
      if (!(err && err.shown)) bus.emit('kernel:toast', { text: String(err && err.message || err) });
    } finally {
      offs.forEach((off) => off());
      veil.classList.remove('on');
      refresh();
    }
  }

  // ---------- 牌子 ----------
  function building(title, note) {
    juan({ title, note, width: '30rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '此卷正在营建，地基落成后逐一开张。') });
  }
  function onRail(name) {
    if (name === '舆图') return dive.mode === 'desk' ? dive.dive(null) : dive.rise();
    building(name, '');
  }
  function onDock(title) { building(title, ''); }
  function saveDialog() {
    let name = '';
    const input = h('input', { type: 'text', placeholder: '为此卷题名', oninput: (e) => { name = e.target.value; },
      style: { width: '100%', padding: '.5rem .75rem', font: 'var(--fs-4) var(--f-kai)', border: '0', outline: '0', background: 'rgba(255,255,255,.4)', boxShadow: 'inset 0 0 0 1px rgba(120,90,50,.35)' } });
    juan({
      title: '封存', note: '此卷存档', width: '30rem', content: input,
      actions: [{ label: '封存', onclick: async ({ close }) => { close('ok'); const ok = await game.saves.save(name || `第${num(game.select.date().turn)}回合`); bus.emit('kernel:toast', { text: ok ? '已封存' : '封存未成' }); } }]
    });
    setTimeout(() => input.focus(), 400);
  }

  const offs = [];
  return {
    async show() {
      await loadWorld();
      refresh();
      el.classList.add('on');
      offs.push(game.on('game:changed', refresh), game.on('game:advanced', refresh), game.on('game:entered', () => loadWorld().then(refresh)));
    },
    hide() {
      el.classList.remove('on');
      mapEl.classList.remove('on');
      offs.splice(0).forEach((off) => off());
    },
    refresh
  };
}
