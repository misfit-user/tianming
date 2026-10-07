// 书案：俯看案面。顶栏一条账簿、四品读数、时间件与推演；左列人物图志、舆图签、邸报刻本；右列瓦当书目；
// 案底五渠道漆牌（令、批、书、见、行）与本档的印；案上器物各系牙牌。点案上绢图俯身入图（立体青绿舆图）。
// 案上陈设、名目、读数、舆图视野一律从身份档取（ui/model/identity.js）：同一副骨架，看书案就知道你是谁。
// 数据一律经 game（适配层）取；动作未接上的牌子先展一卷「在建」说明。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, yearNum } from '../core/numerals.js';
import { juan, qianzi, wadang, pai, sealButton, zhang, pin, zhou, keben, jian, btn, clock, qiPanel, tag, tiao } from '../kit/index.js';
import { LOOK_QINGLV_AGED } from '../scene/map/looks.js';
import { createDive } from '../scene/transitions.js';
import { profileOf } from '../model/identity.js';
import { openSettings } from './settings.js';
import { createDocket } from './docket.js';
import { createEdict } from './edict.js';
import { createLetters } from './letters.js';
import { createAudience } from './audience.js';
import { createOffices } from './offices.js';
import { createFiscal } from './fiscal.js';
import { createArmy } from './army.js';
import { createGuoshi } from './guoshi.js';
import { createRealm } from './realm.js';
import { createCourt } from './court.js';
import { createIssues } from './issues.js';
import { createAtlas } from './atlas.js';
import { openAllVars } from './allvars.js';
import { openGazette } from './gazette.js';
import { openAnnals } from './annals.js';
import { openSaves } from './saves.js';

const LAYERS = ['民情', '阶层', '财赋', '军务', '官守', '役政', '势力'];
// 七种看法对应老舆图的计分（adapter mapLayer）；势力即本色，不另染
const LAYER_MODE = { 民情: 'mood', 阶层: 'classPressure', 财赋: 'tax', 军务: 'army', 官守: 'office', 役政: 'yizheng', 势力: 'owner' };

// 顶栏账簿：身份档的 ledger 列哪几本，这里就按键取
const row = (r) => ({ k: r.label || r.k, v: r.value ?? r.v, d: r.delta ?? r.d, unit: r.unit });
const LEDGERS = {
  treasury: (s) => zhang('帑廪', s.treasury().rows.map(row)),
  privy: (s) => zhang('内帑', s.privy().rows.map(row)),
  census: (s) => { const c = s.census(); return zhang('户口', [{ k: '口', v: c.mouths }, { k: '丁', v: c.ding }]); },
  jurisdiction: (s, p) => {
    const j = p.governs[0] && s.jurisdiction(p.governs[0].id);
    if (!j) return null;
    const el = zhang('辖区', j.rows);
    el.title = j.name;
    return el;
  },
  purse: (s, p) => zhang('公费', s.person(p.id).purse),
  wealth: (s, p) => zhang('家产', s.person(p.id).wealth)
};

export function createDesk({ root, stage, study, map, game, labels, clouds }) {
  let per = game.perspective();
  let prof = profileOf(per);

  // ---------- 顶栏 ----------
  const dyn = h('div.q-yin.dyn', '');
  const time = clock({ onSettle: () => confirmAdvance() });
  // 时历小笺：指到日期上展开——主历、公元、岁次、时令、日辰、节气、物候、天象、回合
  tiao(time.querySelector('.date'), () => {
    const d = game.select.date();
    const rows = [['主历', d.text], ['公元', d.year != null ? `${d.year < 0 ? '前' : ''}${yearNum(d.year)}年` : ''], ['岁次', d.ganzhi && d.ganzhi + '年'],
      ['时令', d.season], ['日辰', d.dayGanzhi && d.dayGanzhi + '日'], ['节气', d.term], ['物候', d.phenology], ['天象', d.omen || '风调雨顺'], ['回合', `第${num(d.turn)}回合`]];
    return { title: '时历', text: rows.filter(([, v]) => v).map(([k, v]) => `${k}　${v}`).join('\n') };
  });
  const ledger = h('div.ledger');
  const gauges = h('div.gauges');
  const tools = h('div.tools',
    btn('存', { title: '案卷目录', onclick: () => { if (!readOnly()) openSaves({ game, inGame: true }); } }),
    btn('典', { title: '典章', onclick: () => openSettings() }),
    btn('问', { title: '问天', onclick: () => building('问天', '问天控制台') }),
    btn('总', { title: '全部变量', onclick: () => openAllVars({ game }) }));
  const topbar = h('header.topbar', dyn, time, ledger, gauges, tools);

  // ---------- 左列 ----------
  const faces = h('div.faces');
  const renwu = qiPanel({ title: '人物图志', note: '…' }, faces);
  const chips = qianzi(LAYERS, { value: '势力', onchange: (v) => setLayer(v) });
  const legendDesk = h('div.legend');
  const maptools = qiPanel({ title: '舆图', note: '七种看法' }, chips, legendDesk);
  const dibao = h('div.dibao', { onclick: () => openGazette({ game }), title: '展邸报全卷', style: { cursor: 'pointer' } });
  const left = h('div.left', renwu, maptools, dibao);

  // ---------- 右列书目、案底五渠道与印、器物牙牌：按身份档摆（furnish） ----------
  const rail = h('nav.rail');
  const dock = h('section.dock');
  const tags = h('div.tags');
  let plaques = {};
  let tagEls = [];
  const ribbon = h('div.viewas.q-zhi.hide');
  const hint = h('div.hint', '点案上舆图 · 俯身入图');
  const el = h('section.scr.scr-desk', tags, topbar, left, rail, dock, hint, ribbon);

  // ---------- 舆图模式 ----------
  const mapChips = qianzi(LAYERS, { value: '势力', onchange: (v) => setLayer(v) });
  const mapNote = h('small', '');
  const legendMap = h('div.legend');
  const mappanel = h('section.q-qi.mappanel', h('h3.q-ti', h('span.q-gold', '舆图'), mapNote), mapChips, legendMap);
  const card = h('div.card.hide');
  const backLabel = h('b.q-gold', '');
  const back = h('button.q-qi.q-pai.back', { type: 'button', onclick: () => dive.rise() }, backLabel, h('small', '起身离图'));
  const mapEl = h('section.scr.scr-map', mappanel, back, card);

  const veil = h('div.advancing', h('div.box.q-qi', h('b.q-gold', '推 演'), h('span', '')));
  root.append(el, mapEl, veil);

  function furnish() {
    replaceChildren(rail, prof.books.map(([ch, name, key]) => wadang({ ch, name, onclick: () => onBook(key, name) })));
    plaques = {};
    for (const c of prof.channels) plaques[c.key] = pai({ title: c.title, sub: c.sub, onclick: () => onChannel(c) });
    replaceChildren(dock, ...Object.values(plaques), sealButton({ chars: prof.seal.chars, title: prof.seal.title, onclick: () => onSeal() }));
    tagEls = Object.entries(prof.tags).map(([k, t]) => { const n = tag(t); n.dataset.k = k; n.dataset.label = t; return n; });
    replaceChildren(tags, tagEls);
    backLabel.textContent = '回' + prof.desk;
    ribbon.classList.toggle('hide', !per.previewing);
    replaceChildren(ribbon, h('b', '借视角'), `${per.name} · ${prof.name}${per.posts[0] ? ' · ' + per.posts[0].title : ''}`, h('small', '只换所见，内核照旧；案上动作只读'));
    study.dress(prof.room, prof.props);
  }
  furnish();

  // ---------- 入图 ----------
  const dive = createDive({
    stage, study, map, clouds,
    onMode: (m) => {
      // 辖区在立体舆图上慢慢浮出（起山时），起身前淡去（绢图上不描）
      if (m === 'map') fadeFocus(focus && focus.marked.length ? (prof.map === 'home' ? 0.6 : 1) : 0, 1.6);
      if (m === 'flying' && dive.mode === 'map') fadeFocus(0, 0.6);
      el.classList.toggle('flying', m === 'flying');
      if (m === 'flying') { mapEl.classList.remove('on'); card.classList.add('hide'); }
      if (m === 'settled') { mapEl.classList.add('on'); el.classList.add('inmap'); }
      if (m === 'desk' || m === 'desk-settled') el.classList.remove('flying', 'inmap');
    }
  });
  // 点案上：绢图俯身入图；器物即功能（奏折批阅、笔砚拟令、信匣书信、史册实录、印）
  const atDesk = () => el.classList.contains('on') && dive.mode === 'desk' && !dive.busy;
  stage.canvas.addEventListener('click', (ev) => {
    if (!atDesk()) return;
    const p = study.pickMap(ev.clientX, ev.clientY);
    if (p) return dive.dive(p);
    const prop = study.pickProp(ev.clientX, ev.clientY, Object.keys(prof.tags));
    if (prop) onProp(prop);
  });
  stage.canvas.addEventListener('pointermove', (ev) => {
    const ok = atDesk();
    const overMap = ok && !!study.pickMap(ev.clientX, ev.clientY);
    const prop = ok && !overMap ? study.pickProp(ev.clientX, ev.clientY, Object.keys(prof.tags)) : null;
    stage.canvas.style.cursor = overMap ? 'zoom-in' : prop ? 'pointer' : '';
    for (const t of tagEls) t.classList.toggle('hot', t.dataset.k === prop);
  });
  let down = null;
  stage.canvas.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
  stage.canvas.addEventListener('pointerup', (ev) => {
    if (dive.mode !== 'map' || dive.busy || !down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
    const r = map.pickScreen(ev.clientX, ev.clientY);
    if (!r) { card.classList.add('hide'); map.select(null); return; }
    map.select(r.index);
    const fac = r.faction && factions[r.faction];
    const lv = layer && layer.byId[r.id];
    replaceChildren(card, jian({ title: r.name, sub: [r.circuit, fac && fac.name].filter(Boolean).join(' · '), rows: [['府治', r.parent ? '属' + r.parent : '—'], ...(lv ? [[layerLabel, lv.mark + (typeof lv.score === 'number' ? '　' + num(Math.round(lv.score)) : '')]] : [])] }));
    card.style.transform = `translate(${Math.min(window.innerWidth - 300, ev.clientX + 24)}px, ${Math.max(90, ev.clientY - 60)}px)`;
    card.classList.remove('hide');
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dive.mode === 'map') dive.rise(); });

  // 舆图看法：民情、阶层、财赋、军务、官守、役政按老舆图的计分分档淡染；势力为本色。书案上的绢图随之重画
  let layer = null, layerLabel = '势力', layerTok = 0;
  function legendOf(l) {
    return l ? [h('small', l.note), h('div.sw', l.legend.map((b) => h('span', h('i', { style: { background: b.color } }), b.mark)))] : [h('small', '按势力归属着色')];
  }
  async function setLayer(label) {
    const tok = ++layerTok;
    layerLabel = label;
    chips.setValue(label);
    mapChips.setValue(label);
    const mode = LAYER_MODE[label];
    if (mode === 'owner') layer = null;
    else {
      replaceChildren(legendDesk, h('small', '勘算中……'));
      replaceChildren(legendMap, h('small', '勘算中……'));
      const l = await game.select.mapLayer(mode);
      if (tok !== layerTok) return;
      layer = l;
    }
    map.setLayer(layer ? (map.regions || []).map((r) => (layer.byId[r.id] || {}).color) : []);
    map.uniforms.uLayer.value = layer ? 1 : 0;
    replaceChildren(legendDesk, legendOf(layer));
    replaceChildren(legendMap, legendOf(layer));
    if (dive.mode === 'desk') study.setMapSheet(await map.renderSheet({ look: LOOK_QINGLV_AGED }));
  }

  // 舆图视野按身份：元首看全境；京官京师居中；地方官辖区描金边、居中；不在官本籍描边、居中。
  // 辖区要在画案上绢图之前定下（绢图与立体舆图同一套着色，俯身入图时才接得上）
  let focus = null;
  const regionList = () => map.regions || [];
  function byPlace(text) {
    const segs = String(text || '').split(/[·・,，\s]+/).filter(Boolean).reverse();
    for (const seg of segs) {
      const i = regionList().findIndex((r) => r.name && (r.name === seg || seg.startsWith(r.name) || (seg.length >= 2 && r.name.startsWith(seg))));
      if (i >= 0) return [i];
    }
    return [];
  }
  function focusOf() {
    let marked = [], centerOnly = [];
    if (prof.map === 'jurisdiction') {
      for (const g of per.governs) {
        const ids = new Set([g.mapRegionId, ...g.regionIds].filter(Boolean).map(String));
        const hit = regionList().map((r, i) => (ids.has(String(r.id)) ? i : -1)).filter((i) => i >= 0);
        marked = marked.concat(hit.length ? hit : byPlace(g.name));
      }
      if (!marked.length) marked = byPlace(per.location);
    } else if (prof.map === 'home') marked = byPlace(per.location);
    else if (prof.map === 'seat') centerOnly = byPlace(per.capital).length ? byPlace(per.capital) : byPlace(per.location);
    const pts = (marked.length ? marked : centerOnly).map((i) => regionList()[i].center).filter(Boolean);
    if (!pts.length) return { marked: [], center: null };
    return { marked, center: [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] };
  }
  async function applyFocus() {
    focus = focusOf();
    map.setFocus(focus.marked);
    study.setMapSheet(await map.renderSheet({ look: LOOK_QINGLV_AGED }));
  }
  function enterMap() {
    dive.dive(focus && focus.center);
  }
  let fadeTok = 0;
  function fadeFocus(to, seconds) {
    const u = map.uniforms.uFocus, from = u.value, t0 = performance.now(), tok = ++fadeTok;
    const step = (now) => {
      if (tok !== fadeTok) return;
      const k = Math.min(1, (now - t0) / (seconds * 1000));
      u.value = from + (to - from) * k * k * (3 - 2 * k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

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
    const next = game.perspective();
    const changed = next.id !== per.id || next.tier !== per.tier || next.previewing !== per.previewing;
    per = next;
    if (changed) { prof = profileOf(per); furnish(); applyFocus(); }
    const d = s.date();
    time.update({ era: `${d.era || ''}${d.reignYear ? num(d.reignYear) + '年' : ''}`, year: d.year, month: d.month, day: d.day, settling: d.busy });
    // 左上那方印：元首是国号，余者是本人的姓
    dyn.textContent = (per.tier === 'sovereign' ? (per.faction || '').replace(/朝廷$/, '') : per.name).charAt(0) || '天';
    // 帑廪、内帑、户口点开即翻到度支册的那一叶
    const FISCAL_TAB = { treasury: 'guoku', privy: 'neitang', census: 'census' };
    replaceChildren(ledger, prof.ledger.map((k) => {
      const el = LEDGERS[k] && LEDGERS[k](s, per);
      if (el && FISCAL_TAB[k] && !per.previewing) { el.classList.add('link'); el.addEventListener('click', () => fiscalPage.show(FISCAL_TAB[k])); }
      return el;
    }).filter(Boolean));
    const gs = prof.gauges === 'realm' ? s.gauges() : s.person(per.id).gauges;
    // 国势四项点开即翻到国势册的那一项（元首档）
    replaceChildren(gauges, gs.map((g) => {
      const el = pin(g.label, g.value);
      if (prof.gauges === 'realm' && g.key && !per.previewing) { el.classList.add('link'); el.addEventListener('click', () => guoshiPage.show(g.key)); }
      return el;
    }));
    // 人物图志：元首看有立像的近臣；余者先看同地之人，不够再补有立像的
    const people = s.characters();
    const me = people.find((c) => c.id === per.id) || people.find((c) => c.isPlayer);
    const place = String(per.location || '').split('·')[0];
    const near = per.tier === 'sovereign' ? [] : people.filter((c) => c !== me && place && String(c.location || '').split('·')[0] === place);
    const shown = [me, ...near, ...people.filter((c) => c !== me && c.portrait && !near.includes(c))].filter(Boolean).slice(0, 4);
    replaceChildren(faces, shown.map((c) => zhou({ name: c.name, src: c.portrait, title: [c.name, c.title].filter(Boolean).join(' · '), onclick: () => atlas.show(c.name) })));
    renwu.querySelector('.q-ti small').textContent = `${num(people.length)}人`;
    const news = s.news ? s.news(8) : [];
    replaceChildren(dibao, keben('邸报', news.length ? news.map((n, i) => ({ tag: n.tag, text: n.text, soft: i > 2 })) : [{ tag: '闻', text: '今日无报', soft: true }]));
    // 案头待批：眼下内核只有元首的奏疏；别的身份的案头（申文、书札）等官本位玩法接上
    const docket = per.tier === 'sovereign' && !per.previewing ? s.memorials().length : 0;
    const chan = prof.channels.find((c) => c.key === 'pi');
    replaceChildren(plaques.pi, h('b.q-gold', chan.title), h('small', docket ? `今日${num(docket)}件` : chan.sub));
    if (docket) plaques.pi.append(h('span.q-qian', num(docket)));
    for (const t of tagEls) if (t.dataset.k === 'memorials') t.querySelector('.q-yapai').textContent = docket ? `${t.dataset.label} · ${num(docket)}` : t.dataset.label;
    // 书札：新到来函之数记在「书」牌与信匣牙牌上
    const fresh = per.previewing ? 0 : game.letters.unreadTotal();
    const shu = prof.channels.find((c) => c.key === 'shu');
    replaceChildren(plaques.shu, h('b.q-gold', shu.title), h('small', fresh ? `来函${num(fresh)}封` : shu.sub));
    if (fresh) plaques.shu.append(h('span.q-qian', num(fresh)));
    for (const t of tagEls) if (t.dataset.k === 'letterbox') t.querySelector('.q-yapai').textContent = fresh ? `${t.dataset.label} · ${num(fresh)}` : t.dataset.label;
    // 时政：托盘上的花笺换成此刻待决的几件；牙牌记待决之数
    const open = per.previewing ? [] : s.issueList().filter((i) => i.group === 'open');
    for (const t of tagEls) if (t.dataset.k === 'tray') t.querySelector('.q-yapai').textContent = open.length ? `${t.dataset.label} · ${num(open.length)}` : t.dataset.label;
    const notes = open.slice(0, 3).map(noteOf);
    const sig = JSON.stringify(notes);
    if (sig !== notesSig) { notesSig = sig; study.setNotes(notes); }
    mapNote.textContent = `${d.era || ''} · ${num((map.regions || []).length)}府州`;
  }

  // 一件时政写成一张花笺：题取首句（至多六字），正文拆成三短行（每行至多八字）
  let notesSig = '';
  function noteOf(it) {
    const clauses = (t) => String(t || '').replace(/【[^】]*】/g, '').split(/[，。；、：！？,.;:!?\s]+/).filter(Boolean);
    const title = (clauses(it.title)[0] || it.title).slice(0, 6);
    const lines = clauses(it.description).filter((c) => c.length >= 2).slice(0, 3).map((c) => c.slice(0, 8));
    return [title, lines];
  }

  // 开局、读档后：舆图换上本剧本的府州，案上绢图重画（带势力名）
  async function loadWorld() {
    const mr = game.select.mapRegions();
    factions = (mr && mr.factions) || {};
    map.setRegions(mr || { regions: [], factions: {} });
    await applyFocus();
  }

  // ---------- 推演（过回合） ----------
  function confirmAdvance() {
    if (readOnly()) return;
    const d = game.select.date();
    const t = prof.ling;
    const E = game.edict;
    const dr = E.draft();
    const filled = E.CATS.filter(([k]) => String(dr[k] || '').trim()).map(([, , label]) => label);
    const priv = E.privateActs().filter((a) => a.on).map((a) => a.name);
    const done = E.promulgated().length;
    const docket = per.tier === 'sovereign' ? game.select.memorials().length : 0;
    const lead = filled.length || done ? t.ready : priv.length && t.idle ? t.idle : t.empty;
    const line = (text, faint) => h('p', { style: { margin: '.375rem 0 0', ...(faint ? { color: 'var(--ink-faint)', fontSize: 'var(--fs-2)' } : {}) } }, text);
    juan({
      title: '推演', note: `第${num(d.turn)}回合`, width: '36rem',
      content: h('div', { style: { lineHeight: 2 } },
        h('p', { style: { margin: 0, font: '400 var(--fs-5) var(--f-title)', letterSpacing: '.1em' } }, lead),
        filled.length ? line(`已拟：${filled.join('、')}`) : null,
        done ? line(`${t.done}：${num(done)}道，整篇并入`) : null,
        priv.length ? line(`${t.private}：${priv.join('、')}`) : null,
        dr.xinglu && dr.xinglu.trim() ? line(`${t.conduct}：${dr.xinglu.trim().slice(0, 40)}${dr.xinglu.trim().length > 40 ? '……' : ''}`) : null,
        docket ? line(`尚有${num(docket)}件${prof.docket.name}未批`, true) : null,
        line(`自${d.text || '今日'}起，${num(d.daysPerTurn)}日之间天下之变，由推演落定。推演一回约需数分钟（视 AI 应答快慢）。`, true)),
      actions: [{ label: t.promulgate, onclick: ({ close }) => { close('ok'); runAdvance(); } }]
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
  function readOnly() {
    if (!per.previewing) return false;
    bus.emit('kernel:toast', { text: '借视角时只读' });
    return true;
  }
  function building(title, note) {
    juan({ title, note, width: '30rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '此卷正在营建，地基落成后逐一开张。') });
  }
  function onBook(key, name) {
    if (key === 'map') return dive.mode === 'desk' ? enterMap() : dive.rise();
    if (key === 'people') return atlas.show();
    if (key === 'annals') return openAnnals({ game, profile: () => prof });
    if (key === 'offices') return officesPage.show();
    if (key === 'fiscal') return fiscalPage.show();
    if (key === 'army') return armyPage.show();
    if (key === 'realm') return realmPage.show();
    building(name, '');
  }
  function onChannel(c) {
    if (readOnly()) return;
    if (c.key === 'pi' && per.tier === 'sovereign') return openDocket();   // 案头待批：眼下内核只有元首的奏疏
    if (c.key === 'ling' && per.tier === 'sovereign') return openEdict();   // 撰写：眼下内核只收元首的诏令
    if (c.key === 'shu') return openLetters();                             // 书札往来各档皆有（内核以玩家本人收发）
    if (c.key === 'jian') return audiencePage.openRoster();                // 召对：问对名单（朝议随后接上）
    building(c.title, c.sub);
  }
  function onProp(name) {
    const ch = (k) => prof.channels.find((c) => c.key === k);
    if (name === 'memorials') return onChannel(ch('pi'));
    if (name === 'writing') return onChannel(ch('ling'));
    if (name === 'letterbox') return onChannel(ch('shu'));
    if (name === 'books') return openAnnals({ game, profile: () => prof });
    if (name === 'seal') return onSeal();
    if (name === 'tray') return readOnly() || issues.open();
  }
  // 批阅：书案让位，镜头俯到摊开的折子上；收折回来再亮书案
  // 召对、廷议两页建在后头；这里的回调用到时才取
  const docket = createDocket({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); },
    onSummon: (name) => { el.classList.add('on'); audiencePage.summon(name); } });
  const issues = createIssues({ game, profile: () => prof, onConvene: (id) => { if (!readOnly()) courtPage.convene(id); } });
  const atlas = createAtlas({ root, game, onLetter: (name) => openLetters(name), onAudience: (name) => { if (!readOnly()) audiencePage.summon(name); } });
  const edictPage = createEdict({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); }, onPromulgate: () => confirmAdvance() });
  function openEdict() {
    el.classList.remove('on');
    edictPage.open();
  }
  // 书札：书案让位，镜头俯到摊开的花笺上
  const lettersPage = createLetters({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); } });
  function openLetters(name) {
    if (readOnly()) return;
    el.classList.remove('on');
    lettersPage.open(name);
  }
  // 召对：名单一卷；择人择体后，书房换景、书案让位
  const audiencePage = createAudience({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); }, onLetter: (name) => openLetters(name), onCourt: (mode) => courtPage.begin(mode) });
  // 朝议：镜老流程；筹备卷、实录页都跟着内核的快照走
  const courtPage = createCourt({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); } });
  game.on('court:entered', () => el.classList.remove('on'));
  game.on('audience:open', () => el.classList.remove('on'));
  // 职官志：册页浮在书案上；点任职者名字翻到人物图志
  const fiscalPage = createFiscal({ root, game });
  // 军籍册：付廷议即开廷议、带上议题；核饷（失真层未开时）转去度支册
  // 国势册：名目里的去处（批阅、撰写、召对、朝议）交书案去开
  const guoshiPage = createGuoshi({ root, game, onGo: (k) => {
    if (readOnly()) return;
    if (k === 'docket') return openDocket();
    if (k === 'edict') return openEdict();
    return audiencePage.openRoster();
  } });
  const realmPage = createRealm({ root, game });
  const armyPage = createArmy({ root, game, onCourt: (topic) => { if (!readOnly()) courtPage.begin('tinyi', { topic }); }, onFiscal: () => fiscalPage.show() });
  const officesPage = createOffices({ root, game, profile: () => prof, onPerson: (name) => { officesPage.hide(); atlas.show(name); } });
  function openDocket(id) {
    el.classList.remove('on');
    docket.open(id);
  }
  function onSeal() {
    if (readOnly()) return;
    if (per.tier === 'sovereign') return confirmAdvance();             // 用印即交出本期所拟、付诸推演
    building(prof.seal.title, prof.seal.note);
  }


  // ---------- 暂停（Esc，或内核的暂停入口改道而来）：续、案卷、典章、实录、退位、回启幕 ----------
  let pausing = false;
  function pause() {
    if (pausing || !el.classList.contains('on') || dive.mode !== 'desk' || dive.busy || docket.opened || edictPage.opened || lettersPage.opened || audiencePage.opened || courtPage.opened || document.querySelector('.q-juan-veil')) return;
    pausing = true;
    const item = (label, fn) => h('button.q-yapai.pz-item', { type: 'button', onclick: () => { j.close('ok'); fn(); } }, label);
    const j = juan({
      title: '天命', note: '暂停', width: '22rem',
      content: h('div.pz',
        item('续', () => {}),
        item('案卷目录', () => openSaves({ game, inGame: true })),
        item('典章', () => openSettings()),
        item(prof.annals.title, () => openAnnals({ game, profile: () => prof })),
        prof.abdicate && !game.viewAs ? item(prof.abdicate.name, () => openAbdicate()) : null,
        item('回启幕', () => leaveGame()))
    });
    j.closed.then(() => { pausing = false; });
  }
  function openAbdicate() {
    const ab = prof.abdicate;
    const list = game.select.heirs();
    const pick = async (c) => {
      const sure = await new Promise((resolve) => {
        let yes = false;
        const q = juan({ title: ab.name, width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, ab.ask(c.name)),
          actions: [{ label: ab.ok, onclick: ({ close }) => { yes = true; close('ok'); } }] });
        q.closed.then(() => resolve(yes));
      });
      if (!sure) return;
      let ok = false;
      try { ok = game.act.abdicate(c.id); } catch (err) { bus.emit('kernel:toast', { text: String(err && err.message || err) }); return; }
      if (ok) { j.close('ok'); bus.emit('kernel:toast', { text: ab.done(c.name) }); }
    };
    const j = juan({
      title: ab.name, note: ab.note, width: '30rem',
      content: list.length
        ? h('div.ab', list.map((c) => h('button.ab-row', { type: 'button', onclick: () => pick(c) },
            h('b', c.name, c.kin ? h('em', `【${ab.tags[c.kin]}】`) : null),
            h('small', [c.title, `智${num(c.intelligence)}`, `政${num(c.administration)}`].filter(Boolean).join(' · ')))))
        : h('p.sv-none', '无合适继承人。')
    });
  }
  async function leaveGame() {
    const sure = await new Promise((resolve) => {
      let yes = false;
      const c = juan({ title: '回启幕', width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '离开此局，回到启幕。未封存的进度将会失去。'),
        actions: [{ label: '先封存', onclick: ({ close }) => { close('ok'); openSaves({ game, inGame: true }); } }, { label: '离开', onclick: ({ close }) => { yes = true; close('ok'); } }] });
      c.closed.then(() => resolve(yes));
    });
    if (!sure) return;
    try { await game.leave(); } catch (err) { bus.emit('kernel:toast', { text: String(err && err.message || err) }); }
  }

  const offs = [];
  return {
    async show() {
      await loadWorld();
      refresh();
      el.classList.add('on');
      game.setSurface(true);
      offs.push(game.on('game:changed', refresh), game.on('game:advanced', refresh), game.on('view:changed', refresh),
        game.on('game:turn-result', (r) => openAnnals({ game, profile: () => prof, idx: r && r.idx })),
        game.on('ui:pause', pause), game.on('ui:saves', () => { if (el.classList.contains('on')) openSaves({ game, inGame: true }); }),
        game.on('game:entered', () => loadWorld().then(refresh)));
    },
    hide() {
      el.classList.remove('on');
      game.setSurface(false);
      notesSig = '';                                  // 下回落座重写花笺（离局时启幕换回了自己的）
      mapEl.classList.remove('on');
      offs.splice(0).forEach((off) => off());
    },
    refresh,
    docket,
    get profile() { return prof; }
  };
}
