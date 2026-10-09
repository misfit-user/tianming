// 书案：俯看案面。顶栏一条账簿、四品读数、时间件与推演；左列人物图志、舆图签、邸报刻本；右列瓦当书目；
// 案底五渠道漆牌（令、批、书、见、行）与本档的印；案上器物各系牙牌。点案上绢图俯身入图（立体青绿舆图）。
// 案上陈设、名目、读数、舆图视野一律从身份档取（ui/model/identity.js）：同一副骨架，看书案就知道你是谁。
// 数据一律经 game（适配层）取；动作未接上的牌子先展一卷「在建」说明。
// 主画面两种（典章「主画面」，?home=map|desk 开发时临时改）：御案为家（入图要俯身）；舆图为家（同志 10-10 定：舆图铺满为家，
// 御案作升华——落座后入图，批阅、撰写、传书、召对这些案上之事一片云过升起书房，事毕回图）。舆图为家的格局照 CK3：
// 左下立像与一圈圆钮（五渠道、回案），左上待办与邸报，右上读数，右缘书目，右下时钟与舆图看法。
import { h, replaceChildren } from '../core/dom.js';
import { getSetting } from '../core/settings.js';
import { bus } from '../core/bus.js';
import { num, yearNum } from '../core/numerals.js';
import { pinned, pinnedFirst, togglePin } from '../core/pins.js';
import { juan, qianzi, wadang, pai, sealButton, zhang, pin, zhou, keben, jian, btn, clock, qiPanel, tag, tiao, kaiguan, kewei } from '../kit/index.js';
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
import { createArchive } from './archive.js';
import { createWenyuan } from './wenyuan.js';
import { createKeju } from './keju.js';
import { createGaizhi } from './gaizhi.js';
import { createTurnVeil } from './turnveil.js';
import { createBattle } from './battle.js';
import { createKeyi } from './keyi.js';
import { createWentian } from './wentian.js';
import { createGongwei } from './gongwei.js';
import { createHelp } from './help.js';
import { createBio } from './bio.js';
import { createMizhao } from './mizhao.js';
import { createPrison } from './prison.js';
import { createEndgame } from './endgame.js';
import { createFangzhi } from './fangzhi.js';
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

const sig4 = (v) => { const n = Number(v) || 0; if (Math.abs(n) < 1e4) return n; const p = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 3); return Math.round(n / p) * p; };
// 顶栏账簿：身份档的 ledger 列哪几本，这里就按键取
const row = (r) => ({ k: r.label || r.k, v: r.value ?? r.v, d: r.delta ?? r.d, unit: r.unit });
const LEDGERS = {
  treasury: (s) => zhang('帑廪', s.treasury().rows.map(row)),
  privy: (s) => zhang('内帑', s.privy().rows.map(row)),
  // 户口在顶栏只看个大数：取四位有效数字（二千四百六十三万八千六百 → 二千四百六十四万），细数在度支册
  census: (s) => { const c = s.census(); return zhang('户口', [{ k: '口', v: sig4(c.mouths) }, { k: '丁', v: sig4(c.ding) }]); },
  jurisdiction: (s, p) => {
    const j = p.governs[0] && s.jurisdiction(p.governs[0].id);
    if (!j) return null;
    const el = zhang('辖区', j.rows);
    el.title = j.name;
    return el;
  },
  purse: (s, p, st) => { const rows = st ? st.purse : s.person(p.id).purse; return rows.some((r) => r.v) ? zhang('公费', rows) : null; },
  wealth: (s, p, st) => zhang('私财', st ? st.wealth : s.person(p.id).wealth),
  // 所掌之账（通用一套）：辖区读户口、实征、驻军（据奏口径同方志）；本镇读兵与欠饷；本衙门读在任与缺员
  charge: (s, p, st) => {
    const c = st && st.charges.find((x) => x.kind !== 'household');
    if (!c) return null;
    let rows = [];
    if (c.kind === 'region' || c.kind === 'circuit') {
      const b = (k) => (c.band || []).find((x) => x.k === k);
      rows = [['口', '户口'], ['征', '实征'], ['兵', '驻军']].map(([k, key]) => b(key) && { k, v: sig4(b(key).v) }).filter(Boolean);
    } else if (c.kind === 'army') rows = [{ k: '兵', v: c.soldiers }, { k: '欠饷', text: c.arrears ? `${num(c.arrears)}月` : '无' }];
    else if (c.kind === 'office') rows = [{ k: '在任', v: c.staff }, { k: '缺员', v: c.vacant }];
    if (!rows.length) return null;
    // 账名竖写只容三字：辖区去「布政使司」，本镇写「所统」，衙门名过三字写「本署」
    const short = c.kind === 'army' ? '所统' : c.kind === 'office' ? (c.name.length <= 3 ? c.name : '本署') : c.name.replace(/布政使司$|承宣布政使司$/, '').slice(0, 3);
    const el = zhang(short, rows);
    el.title = `所掌：${c.name}`;
    return el;
  }
};

export function createDesk({ root, stage, study, map, game, labels, clouds }) {
  let per = game.perspective();
  let prof = profileOf(per);
  const homeQS = new URLSearchParams(location.search).get('home');
  const homeMap = () => (homeQS || getSetting('home')) === 'map';

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
    btn('问', { title: '问天', onclick: () => { if (!readOnly()) wentianPage.show(); } }),
    btn('总', { title: '全部变量', onclick: () => openAllVars({ game }) }),
    btn('暂', { title: '暂停', onclick: () => pause() }));        // 触屏没有 Esc，暂停卷（帮助、退位、回启幕）要有个可点的门
  const topbar = h('header.topbar', dyn, time, ledger, gauges, tools);

  // ---------- 左列 ----------
  const faces = h('div.faces');
  const renwu = qiPanel({ title: '人物图志', note: '…' }, faces);
  const chips = qianzi(LAYERS, { value: '势力', onchange: (v) => setLayer(v) });
  const legendDesk = h('div.legend');
  const maptools = qiPanel({ title: '舆图', note: '七种看法' }, chips, legendDesk);
  const dibao = h('div.dibao', { onclick: () => openGazette({ game }), title: '展邸报全卷', style: { cursor: 'pointer' } });
  let dibaoShut = (() => { try { return localStorage.getItem('tm_ui_dibao') === '0'; } catch (_e) { return false; } })();
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

  // ---------- 舆图为家：立像与圆钮、待办、右下一角（时钟、工具） ----------
  const selfFace = h('div.hm-face');
  const selfSeal = h('div.q-yin.hm-seal');
  const selfName = h('b');
  const selfTitle = h('small');
  const selfUp = h('small.hm-up');
  const selfEnergy = h('div.hm-energy');
  const selfBadges = h('div.hm-badges');
  const ring = h('nav.hm-ring');
  const selfBox = h('section.hm-me',
    h('button.hm-xiang', { type: 'button', title: '本人列传', onclick: () => bioPage.show(per.name), dataset: { person: '' } }, selfFace, selfSeal),
    h('div.hm-side', h('div.hm-plate', h('div.hm-namerow', selfName, selfBadges), selfTitle, selfUp, selfEnergy), ring));
  const alerts = h('nav.hm-alerts');
  const corner = h('div.hm-corner');
  // 提纲（照 CK3 的 Outliner）：钉选之人、所掌（通用一套）、诸军；可收起，收放记在本机
  const outline = h('aside.hm-outline');
  let outlineOpen = (() => { try { return localStorage.getItem('tm_ui_outline') !== '0'; } catch (_e) { return true; } })();
  el.append(selfBox, alerts, corner, outline);
  let ringBtns = {}, deskBtn = null, diveReady = false;
  // 两种主画面各自的摆法：舆图为家时时钟、工具挪到右下，顶栏只留读数
  function arrange() {
    const on = homeMap();
    el.classList.toggle('home-map', on);
    mapEl.classList.toggle('home-map', on);
    if (on) { replaceChildren(topbar, ledger, gauges); replaceChildren(corner, tools, time); }
    else { replaceChildren(topbar, dyn, time, ledger, gauges, tools); replaceChildren(corner); }
    paintDeskBtn();
  }

  // ---------- 舆图模式 ----------
  const mapChips = qianzi(LAYERS, { value: '势力', onchange: (v) => setLayer(v) });
  const mapNote = h('small', '');
  const legendMap = h('div.legend');
  // 检府州：输入或下拉择名，镜头缓移其上（同点选出小签）
  let mapRegionList = [];
  const regionDl = h('datalist', { id: 'tm-map-regions' });
  const regionSearch = h('input.map-search', { type: 'search', placeholder: '检府州', list: 'tm-map-regions', spellcheck: false, autocomplete: 'off',
    onkeydown: (e) => { if (e.key === 'Enter') seekRegion(regionSearch.value); }, onchange: () => seekRegion(regionSearch.value) });
  // 诸道：翻本方谱牒的版图卷——各道户口、民心、吏治一览，区划预警，点道开通志、点州开方志
  const openDao = () => { let key = ''; try { key = (game.realm.factions().find((f) => f.mine) || {}).key || ''; } catch (_e) { /* 无势力册 */ } realmPage.show({ tab: 'factions', key, juan: '版图' }); };
  const mappanel = h('section.q-qi.mappanel', h('h3.q-ti', h('span.q-gold', '舆图'), mapNote),
    h('div.map-seek', regionSearch, regionDl, h('button.q-yapai', { type: 'button', title: '本方诸道一览：区划预警、各道读数', onclick: openDao }, '诸道')), mapChips, legendMap);
  const card = h('div.card.hide');
  const backLabel = h('b.q-gold', '');
  const back = h('button.q-qi.q-pai.back', { type: 'button', onclick: () => dive.rise() }, backLabel, h('small', '起身离图'));
  const mapEl = h('section.scr.scr-map', mappanel, back, card);

  root.append(el, mapEl);
  const turnVeil = createTurnVeil({ root, game });   // 推演幕：过回合时铺满全屏（screens/turnveil.js）
  createBattle({ game });                             // 战事三卷：会战阶段的请旨、战报、旁观（推演中弹出，压在推演幕上）

  function furnish() {
    replaceChildren(rail, prof.books.map(([ch, name, key], i) => { const b = wadang({ ch, name, onclick: () => onBook(key, name) }); if (i < 10) b.title = `${name}（数字键${(i + 1) % 10}）`; return b; }));
    plaques = {};
    for (const c of prof.channels) plaques[c.key] = pai({ title: c.title, sub: c.sub, onclick: () => onChannel(c) });
    replaceChildren(dock, ...Object.values(plaques), sealButton({ chars: prof.seal.chars, title: prof.seal.title, onclick: () => onSeal() }));
    // 立像旁一圈圆钮：五渠道各一字（字取渠道本义，不随身份），末一枚回案或入图
    const CH = { ling: '令', pi: '批', shu: '书', jian: '见', xing: '行' };
    ringBtns = {};
    for (const c of prof.channels) ringBtns[c.key] = h('button.hm-btn', { type: 'button', 'aria-label': c.title, onclick: () => onChannel(c) }, h('b', CH[c.key]), h('small', c.title));
    deskBtn = h('button.hm-btn.hm-desk', { type: 'button', onclick: () => toggleDesk() }, h('b'), h('small'));
    replaceChildren(ring, ...Object.values(ringBtns), deskBtn);
    paintDeskBtn();
    tagEls = Object.entries(prof.tags).map(([k, t]) => { const n = tag(t); n.dataset.k = k; n.dataset.label = t; return n; });
    replaceChildren(tags, tagEls);
    backLabel.textContent = '回' + prof.desk;
    ribbon.classList.toggle('hide', !per.previewing);
    const KIND = { sovereign: '元首', minister: '京官', provincial: '地方', gentry: '不在官' };
    replaceChildren(ribbon, h('b', '借视角'), `${per.name} · ${KIND[per.tier] || prof.name}${per.posts[0] ? ' · ' + per.posts[0].title : ''}`, h('small', '只换所见，内核照旧；案上动作只读'));
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
      paintDeskBtn();
    }
  });
  diveReady = true;
  // 回案钮：在图上是「回某案」，在案前是「入图」（镜头建好之前 furnish 先摆一次，那时不画）
  function paintDeskBtn() {
    if (!deskBtn || !diveReady) return;
    const inMap = dive.mode === 'map';
    deskBtn.querySelector('b').textContent = inMap ? '案' : '图';
    deskBtn.querySelector('small').textContent = inMap ? '回' + prof.desk : '入图';
  }
  // 舆图为家：主动回案的那一趟（deskVisit）不自动回图，再点「入图」才回
  let deskVisit = false;
  function toggleDesk() {
    if (dive.busy) return;
    if (dive.mode === 'map') { deskVisit = true; dive.rise(); } else { deskVisit = false; enterMap(); }
  }
  // 案上之事（批阅、撰写、传书、召对、朝议……）：在图上就快切升起书房；事毕书案重亮、别无他景接手时回图
  // 案上之事的页面看到的身份档：舆图为家、从图上来的，「回某」写回舆图
  function sceneProfile() { return homeMap() && !deskVisit ? { ...prof, desk: '舆图' } : prof; }
  // 正在回图的半途（busy）又点了案上之事：等这一程走完再升起书房，免得页面开在看不见的书房里
  async function toStudyIfHome() {
    if (!homeMap()) return;
    homeTok++;                                       // 撤掉待发的回图
    while (dive.busy) await new Promise((r) => setTimeout(r, 50));
    if (dive.mode === 'map') await dive.toStudy();
  }
  let homeTok = 0;
  function backHome() {
    if (!homeMap() || deskVisit) return;
    const tok = ++homeTok;
    setTimeout(() => { if (tok === homeTok && el.classList.contains('on') && dive.mode === 'desk' && !dive.busy) dive.toMap(); }, 250);
  }
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
    showRegionCard(r, ev.clientX, ev.clientY);
  });
  stage.canvas.addEventListener('contextmenu', (ev) => {
    if (dive.mode !== 'map' || dive.busy) return;
    ev.preventDefault();
    const r = map.pickScreen(ev.clientX, ev.clientY);
    if (!r) return;
    map.select(r.index);
    card.classList.add('hide');
    regionMenu(r, ev.clientX, ev.clientY);
  });
  function regionMenu(r, x, y) {
    let info = null;
    try { info = game.fangzhi.region(r.id); } catch (_e) { info = null; }
    const ro = per.previewing ? '借视角时只读' : '';
    const fac = r.faction && factions[r.faction];
    const acts = (info && info.acts) || [];
    const NOTE = { 安民: '拟一条安民之策入议事清册', 巡按: '拟遣员巡按此地入议事清册', 调粮: '拟调粮接济入议事清册', 拟诏: '就此地拟一条入议事清册' };
    kewei({
      title: r.name, sub: [r.circuit, fac && fac.name].filter(Boolean).join(' · '), x, y,
      groups: [
        { label: '观', items: [
          { label: '展方志', onclick: () => fangzhiPage.show(r.id) },
          r.circuit ? { label: '展通志', note: r.circuit, onclick: () => fangzhiPage.showCircuit(r.id) } : null,
          { label: '镜头移至此地', onclick: () => flyMapTo(r.center, Math.min(map.pose().dist, 520)) }].filter(Boolean) },
        { label: (prof.channels.find((c) => c.key === 'ling') || {}).title || '令',
          items: (acts.length ? acts : ['安民', '巡按', '调粮', '拟诏']).map((k) => ({ label: k, note: NOTE[k], off: ro || (acts.length ? '' : '非本方州县'),
            onclick: () => { try { if (game.fangzhi.act(r.id, k)) bus.emit('kernel:toast', { text: `${r.name}·${k}，已拟入议事清册` }); } catch (err) { bus.emit('kernel:toast', { text: String(err && err.message || err) }); } } })) }
      ]
    });
  }
  // 府州小签：点选与检府州共用
  function showRegionCard(r, x, y) {
    const fac = r.faction && factions[r.faction];
    const lv = layer && layer.byId[r.id];
    replaceChildren(card, jian({ title: r.name, sub: [r.circuit, fac && fac.name].filter(Boolean).join(' · '), rows: [r.parent ? ['上隶', r.parent] : ['地形', r.terrain || '—'], ...(lv ? [[layerLabel, lv.mark + (typeof lv.score === 'number' ? '　' + num(Math.round(lv.score)) : '')]] : [])] }));
    card.append(h('small.fz-cardhint', '点签展方志'));
    card.onclick = () => fangzhiPage.show(r.id);
    card.style.transform = `translate(${Math.min(window.innerWidth - 300, x + 24)}px, ${Math.max(90, y - 60)}px)`;
    card.classList.remove('hide');
  }
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || dive.mode !== 'map') return;
    if (!homeMap()) return dive.rise();
    if (!document.querySelector('.q-juan-veil, .ce-ov.on')) pause();
  });
  // 数字键一至九、〇：开右侧书目第几册（案前、无卷无册开着、不在输入时）
  window.addEventListener('keydown', (e) => {
    if (!/^[0-9]$/.test(e.key) || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!el.classList.contains('on') && dive.mode !== 'map') return;
    if (document.querySelector('.ce-ov.on, .q-juan-veil') || game.select.date().busy) return;
    const book = prof.books[(Number(e.key) + 9) % 10];
    if (!book) return;
    e.preventDefault();
    onBook(book[2], book[1]);
  });
  // 检府州：先全名、再包含；镜头沿当前俯角与朝向缓移到其治所上空（约 0.9 秒），落定后点亮并出小签
  function seekRegion(q) {
    const name = String(q || '').trim();
    if (!name || dive.mode !== 'map' || dive.busy) return;
    const i = mapRegionList.findIndex((r) => r.name === name) >= 0 ? mapRegionList.findIndex((r) => r.name === name) : mapRegionList.findIndex((r) => r.name && r.name.includes(name));
    if (i < 0) { bus.emit('kernel:toast', { text: `舆图上无「${name}」` }); return; }
    const r = mapRegionList[i];
    flyMapTo(r.center, Math.min(map.pose().dist, 520), () => {
      map.select(i);
      const [sx, sy] = map.worldToScreen(r.center[0], r.center[1]);
      showRegionCard({ index: i, ...r }, sx, sy);
    });
    regionSearch.blur();
  }
  // 镜头沿当前俯角与朝向缓移到某处上空（约 0.9 秒）
  function flyMapTo(center, dist, then) {
    const from = map.pose();
    const to = { ...from, target: [center[0], 0, center[1]], dist };
    const t0 = performance.now();
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 900);
      const e = ease(k);
      map.setPose({ target: from.target.map((v, j) => v + (to.target[j] - v) * e), dist: from.dist + (to.dist - from.dist) * e, polar: from.polar, az: from.az });
      if (k < 1) { requestAnimationFrame(step); return; }
      if (then) then();
    };
    requestAnimationFrame(step);
  }

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
    } else if (prof.map === 'charge') {
      const st = game.standing();
      const c = st && st.charges.find((x) => x.kind !== 'household');
      const ids = new Set(c && c.mapRegionIds ? c.mapRegionIds : []);
      if (ids.size) marked = regionList().map((r, i) => (ids.has(String(r.id)) ? i : -1)).filter((i) => i >= 0);
      if (!marked.length) marked = byPlace(c && c.kind === 'army' ? c.location : per.location);
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
    const covered = [left, rail, dock, topbar, selfBox, alerts, corner, outline].map((n) => n.getBoundingClientRect());
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
    standing = per.tier === 'sovereign' ? null : game.standing();
    replaceChildren(ledger, prof.ledger.map((k) => {
      const el = LEDGERS[k] && LEDGERS[k](s, per, standing);
      if (el && FISCAL_TAB[k] && !per.previewing) { el.classList.add('link'); el.addEventListener('click', () => fiscalPage.show(FISCAL_TAB[k])); }
      return el;
    }).filter(Boolean));
    const gs = prof.gauges === 'realm' ? s.gauges() : chargeGauges(s);
    // 国势四项点开即翻到国势册的那一项（元首档）
    // 精力居首（本人之数，与其后的国势或身家四项隔开）：召对、批阅等动作皆耗，原先只见耗费不见余量
    const en = per.previewing ? null : s.energy();
    const enPin = en && !homeMap() ? pin('精力', Math.round(en.value / en.max * 100), { text: num(en.value) }) : null;
    if (enPin) { enPin.classList.add('energy'); enPin.title = `精力 ${num(en.value)} / ${num(en.max)}`; }
    replaceChildren(gauges, enPin, ...gs.map((g) => {
      const el = pin(g.label, g.value, g.text ? { text: g.text } : {});
      if (prof.gauges === 'realm' && g.key && !per.previewing) { el.classList.add('link'); el.addEventListener('click', () => guoshiPage.show(g.key)); }
      return el;
    }));
    // 人物图志：元首看有立像的近臣；余者先看同地之人，不够再补有立像的
    const people = s.characters();
    const me = people.find((c) => c.id === per.id) || people.find((c) => c.isPlayer);
    const place = String(per.location || '').split('·')[0];
    const near = per.tier === 'sovereign' ? [] : people.filter((c) => c !== me && place && String(c.location || '').split('·')[0] === place);
    // 钉选之人排在近臣之前（core/pins，与老正式界面同一份）
    const pins = pinnedFirst(people.filter((c) => c !== me && c.alive !== false)).filter((c) => pinned(c));
    const shown = [...new Set([me, ...pins, ...near, ...people.filter((c) => c !== me && c.portrait && !near.includes(c))].filter(Boolean))].slice(0, 4);
    replaceChildren(faces, shown.map((c) => zhou({ name: c.name, src: c.portrait, title: [c.name, c.title].filter(Boolean).join(' · '), onclick: () => atlas.show(c.name) })));
    renwu.querySelector('.q-ti small').textContent = `${num(people.length)}人`;
    const news = s.news ? s.news(8) : [];
    replaceChildren(dibao, keben('邸报', news.length ? news.map((n, i) => ({ tag: n.tag, text: n.text, soft: i > 2 })) : [{ tag: '闻', text: '今日无报', soft: true }]),
      // 舆图为家时邸报可收成一条（只露报头），让出舆图；收放记在本机
      h('button.hm-fold', { type: 'button', title: dibaoShut ? '展开邸报' : '收起邸报', onclick: (e) => { e.stopPropagation(); dibaoShut = !dibaoShut; try { localStorage.setItem('tm_ui_dibao', dibaoShut ? '0' : '1'); } catch (_e) { /* 只这一回 */ } refresh(); } }, dibaoShut ? '展' : '收'));
    dibao.classList.toggle('shut', dibaoShut);
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
    // 科举有待定夺之事（选主考、定题、拟策问、钦定三甲……）：书目「科」挂一枝签
    const kb = prof.books.find((b) => b[2] === 'keju');
    const kw = kb && [...rail.children].find((b) => b.dataset.name === kb[1]);
    if (kw) {
      const due = per.previewing ? '' : game.keju.pending();
      const tagEl = kw.querySelector('.q-qian');
      if (due && !tagEl) kw.append(h('span.q-qian', '待'));
      if (!due && tagEl) tagEl.remove();
      kw.title = due ? `${kb[1]} · ${game.keju.STAGES_NEED[due] || '待定夺'}` : '';
    }
    if (homeMap()) paintHome({ me, en, docket, fresh, open, due: kw && !per.previewing ? game.keju.pending() : '' });
    gaizhiPage.inheritance();                        // 新朝承前一卷若被换场收掉而未阅，回到书案再展
  }
  let standing = null;
  function chargeGauges(s) {
    const self = standing ? standing.gauges : s.person(per.id).gauges;
    const c = standing && standing.charges.find((x) => x.kind === 'region' || x.kind === 'circuit');
    const b = (k) => c && (c.band || []).find((x) => x.k === k);
    const mood = b('民心'), office = b('吏治');
    if (!mood && !office) return self;
    // 方志读数带里吏治是浊度（越高越浊），刻度按清浊翻过来；字照方志的等第
    return [mood && { label: '民心', value: mood.v, text: mood.sub }, office && { label: '吏治', value: 100 - office.v, text: office.sub }]
      .filter(Boolean).concat(self.filter((g) => g.key === 'fame' || g.key === 'xianneng'));
  }
  // 舆图为家：立像（本人）、印（元首是国号，余者是姓）、职衔、精力；圆钮上记待批之数、来函之数；左上待办
  function paintHome({ me, en, docket, fresh, open, due }) {
    const initial = () => h('i', [...(per.name || '？')][0]);
    if (selfFace.dataset.src !== String((me && me.portrait) || '')) {
      selfFace.dataset.src = String((me && me.portrait) || '');
      replaceChildren(selfFace, me && me.portrait ? h('img', { src: me.portrait, alt: per.name, decoding: 'async', onerror: () => replaceChildren(selfFace, initial()) }) : initial());
    }
    selfSeal.textContent = dyn.textContent;
    selfName.textContent = per.name || '';
    selfBox.querySelector('.hm-xiang').dataset.person = per.name || '';
    const sub = (a, b) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length; };   // a 的字依次见于 b
    const titles = standing ? [...new Set(standing.posts.map((x) => x.title).filter(Boolean))] : [];
    const posts = titles.filter((t) => !titles.some((o) => o !== t && o.length > t.length && sub(t, o)));
    const ranks = standing ? standing.posts.map((x) => /([正从][一二三四五六七八九]品)/.exec(x.rank || '')).filter(Boolean).map((m) => m[1]) : [];
    const lv = (r) => '一二三四五六七八九'.indexOf(r[1]) * 2 + (r[0] === '正' ? 0 : 1);
    replaceChildren(selfBadges, ranks.length ? h('span', ranks.sort((x, y) => lv(x) - lv(y))[0]) : null);
    selfTitle.textContent = posts.length ? posts.join('、') : per.title || '';
    selfTitle.title = selfTitle.textContent;
    selfUp.textContent = standing && standing.superiors.length ? `上：${standing.superiors.map((u) => u.name).join(' › ')}` : '';
    selfUp.title = standing ? standing.superiors.map((u) => `${u.title} ${u.name}`).join('\n') : '';
    replaceChildren(selfEnergy, en ? [h('span', '精力'), h('i', h('u', { style: { width: `${Math.max(0, Math.min(100, en.value / en.max * 100))}%` } })), h('b', num(en.value))] : []);
    selfEnergy.title = en ? `精力 ${num(en.value)} / ${num(en.max)}` : '';
    const badge = (btn, n) => { const old = btn && btn.querySelector('.hm-n'); if (old) old.remove(); if (btn && n) btn.append(h('span.hm-n', num(n))); };
    badge(ringBtns.pi, docket);
    badge(ringBtns.shu, fresh);
    const items = [
      ['批', `${prof.docket.name}待批`, docket, () => readOnly() || openDocket(), 'zhu'],
      ['政', prof.issues.title, open.length, () => readOnly() || issues.open(), 'qing'],
      ['函', '新到来函', fresh, () => openLetters(), 'lv'],
      ['科', game.keju.STAGES_NEED[due] || '科举待定夺', due ? 1 : 0, () => readOnly() || kejuPage.show(), 'jin']
    ].filter((x) => x[2]);
    replaceChildren(alerts, items.map(([ch, title, n, go, tone]) => tiao(h(`button.hm-alert.t-${tone}`, { type: 'button', 'aria-label': title, onclick: go }, h('b', ch), ch !== '科' ? h('span', num(n)) : null),
      () => ({ title, text: ch === '科' ? '点开科举册定夺' : `${num(n)}件，点开即办` }))));
    paintOutline();
  }
  // 提纲：三段，空段不列；人可右键出可为单
  function paintOutline() {
    const face = (c) => h('i.hm-oface', c.portrait ? h('img', { src: c.portrait, alt: '', decoding: 'async', onerror: (e) => e.target.remove() }) : null, [...(c.name || '？')][0]);
    const people = game.select.characters().filter((c) => pinned(c)).slice(0, 8).map((c) =>
      h('button.hm-row', { type: 'button', dataset: { person: c.name }, title: [c.name, c.title, c.location].filter(Boolean).join(' · '), onclick: () => atlas.show(c.name) },
        face(c), h('b', c.name), h('small', c.title || c.location || '')));
    const KIND = { region: '地', circuit: '道', army: '兵', office: '署', household: '家' };
    const charges = standing ? standing.charges.map((c) => h('button.hm-row', { type: 'button', title: c.name, onclick: () => openChargeOf(c) },
      h('i.hm-oicon', KIND[c.kind] || '掌'), h('b', c.name.replace(/布政使司$/, '')), h('small', c.kind === 'army' ? `${num(c.soldiers)}人` : c.kind === 'office' ? `在任${num(c.staff)}` : ''))) : [];
    let armies = [];
    try { armies = game.army.roster().groups.flatMap((g) => g.rows); } catch (_e) { armies = []; }
    armies = (standing ? armies.filter((a) => a.commander === per.name) : armies.filter((a) => a.hot || a.march)).slice(0, 6);
    const armyRows = standing && standing.charges.some((c) => c.kind === 'army') ? [] : armies.map((a) => h('button.hm-row', { type: 'button', title: [a.name, a.commander, a.location].filter(Boolean).join(' · '), onclick: () => armyPage.show(a.key) },
      h('i.hm-oicon' + (a.hot ? '.hot' : ''), '兵'), h('b', a.name), h('small', [a.hot ? '告急' : '', a.march ? '行军' : '', `${num(a.soldiers)}人`].filter(Boolean).join(' · '))));
    const sec = (title, rows, empty) => (rows.length || empty ? h('section', h('h4', title, rows.length ? h('small', num(rows.length)) : null), rows.length ? rows : h('p', empty)) : null);
    const toggle = () => { outlineOpen = !outlineOpen; try { localStorage.setItem('tm_ui_outline', outlineOpen ? '1' : '0'); } catch (_e) { /* 只这一回 */ } paintOutline(); };
    outline.classList.toggle('shut', !outlineOpen);
    replaceChildren(outline, h('header', h('button', { type: 'button', title: outlineOpen ? '收起提纲' : '展开提纲', onclick: toggle }, h('b', '提纲'), h('i', outlineOpen ? '收' : '展'))),
      outlineOpen ? [sec('钉选之人', people, '右键人像可钉选'), standing ? sec('所掌', charges, '') : null, sec(standing ? '所统之兵' : '告急行军', armyRows, '')] : null);
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
    mapRegionList = (mr && mr.regions) || [];
    replaceChildren(regionDl, mapRegionList.map((r) => h('option', { value: r.name }, [r.circuit, r.parent].filter(Boolean).join(' · '))));
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
    let court = false;                               // 后朝：只元首档有（内核的朝会是君前之会）
    const courtRow = t.postCourt && !game.viewAs
      ? h('div', { style: { marginTop: '.75rem' } }, kaiguan(t.postCourt, { checked: false, onchange: (on) => { court = on; } }), line(t.postCourtNote, true))
      : null;
    juan({
      title: '推演', note: `第${num(d.turn)}回合`, width: '36rem',
      content: h('div', { style: { lineHeight: 2 } },
        h('p', { style: { margin: 0, font: '400 var(--fs-5) var(--f-title)', letterSpacing: '.1em' } }, lead),
        filled.length ? line(`已拟：${filled.join('、')}`) : null,
        done ? line(`${t.done}：${num(done)}道，整篇并入`) : null,
        priv.length ? line(`${t.private}：${priv.join('、')}`) : null,
        dr.xinglu && dr.xinglu.trim() ? line(`${t.conduct}：${dr.xinglu.trim().slice(0, 40)}${dr.xinglu.trim().length > 40 ? '……' : ''}`) : null,
        docket ? line(`尚有${num(docket)}件${prof.docket.name}未批`, true) : null,
        line(`自${d.text || '今日'}起，${num(d.daysPerTurn)}日之间天下之变，由推演落定。推演一回约需数分钟（视 AI 应答快慢）。`, true),
        courtRow),
      actions: [{ label: t.promulgate, onclick: ({ close }) => { close('ok'); runAdvance(court); } }]
    });
  }
  async function runAdvance(court = false) {
    turnVeil.begin();
    try {
      await game.advance({ court });
    } catch (err) {
      if (!(err && err.shown)) bus.emit('kernel:toast', { text: String(err && err.message || err) });
    } finally {
      turnVeil.end();
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
    if (key === 'map') {
      if (homeMap() && dive.mode === 'map') return focus && focus.center ? flyMapTo(focus.center, 820) : null;
      return dive.mode === 'desk' ? enterMap() : dive.rise();
    }
    if (key === 'people') return atlas.show();
    if (key === 'charge') return openCharge();
    // 家：本人列传的家族一卷（照 CK3 角色窗口的家人页：父母、配偶、子女、兄弟、族中统览）；族谱另在朝野册「家族」
    if (key === 'family') return bioPage.show(per.name, 'family');
    if (key === 'gazette') return openGazette({ game });
    // 史：元首翻史馆（实录、起居注……）；通用一套是本人年谱——列传的纪传一卷（履历与近事），国史非其所能翻
    if (key === 'annals') return per.tier === 'sovereign' ? archivePage.show() : bioPage.show(per.name, 'career');
    if (key === 'offices') return officesPage.show();
    if (key === 'fiscal') return fiscalPage.show();
    if (key === 'army') return armyPage.show();
    if (key === 'realm') return realmPage.show();
    if (key === 'wenyuan') return wenyuanPage.show();
    if (key === 'keju') return kejuPage.show();
    if (key === 'gongwei') return gongweiPage.show();
    building(name, '');
  }
  // ---------- 可为：右键人像（立轴、图志、列传、立像）出一张交互单，照 CK3 右键人物——按五渠道分组，做不了的灰着、写明差什么 ----------
  root.addEventListener('contextmenu', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-person]') : null;
    if (!t || !t.dataset.person) return;
    e.preventDefault();
    personMenu(t.dataset.person, e.clientX, e.clientY);
  });
  function personMenu(name, x, y) {
    const c = game.select.characters().find((p) => p.name === name);
    const self = !!c && String(c.id) === String(per.id);
    const ro = per.previewing ? '借视角时只读' : '';
    const ch = (k) => (prof.channels.find((x) => x.key === k) || {}).title || '';
    const groups = [];
    if (c && !self) {
      const near = (() => { try { return game.audience.canAudience(name); } catch (_e) { return false; } })();
      const far = new Set(game.letters.contacts().map((p) => p.name));
      groups.push({ label: ch('jian'), items: [{ label: prof.audience.title, note: '择正式问对或私下叙谈', off: ro || (near ? '' : '人不在近处，宜传书'), onclick: () => audiencePage.summon(name) }] });
      groups.push({ label: ch('shu'), items: [{ label: prof.letters.compose, off: ro || (far.has(name) ? '' : prof.letters.atCourt), onclick: () => openLetters(name) }] });
      if (prof.tier === 'sovereign') groups.push({ label: ch('ling'), items: [{ label: '任官', note: '按其才具看各职适配，点一职走官制册的任命', off: ro, onclick: () => bioPage.show(name, 'office') }] });
    }
    groups.push({ label: '观', items: [
      { label: '详传', onclick: () => bioPage.show(name) },
      { label: '人物图志', onclick: () => atlas.show(name) },
      c && !self ? { label: pinned(c) ? '撤钉选' : '钉选', note: '钉选之人排在图志与案前诸人之首', onclick: () => togglePin(c) } : null].filter(Boolean) });
    kewei({ title: name, sub: c ? [c.title, c.location].filter(Boolean).join(' · ') : '已故', x, y, groups });
  }
  // 「辖」：所掌那一块——辖区开方志或通志，本镇开军务，本衙门开官制
  function openCharge() {
    const c = standing && standing.charges.find((x) => x.kind !== 'household');
    if (c) openChargeOf(c);
  }
  function openChargeOf(c) {
    if (c.kind === 'household') return c.key ? realmPage.show({ tab: 'families', key: c.key }) : null;
    if (c.kind === 'circuit' && c.key) return fangzhiPage.showCircuit(c.key);
    if (c.kind === 'region' && c.key) return fangzhiPage.show(c.key);
    if (c.kind === 'army') return armyPage.show(c.key);
    return officesPage.show();
  }
  function onChannel(c) {
    if (readOnly()) return;
    if (c.key === 'pi' && per.tier === 'sovereign') return openDocket();   // 案头待批：眼下内核只有元首的奏疏
    if (c.key === 'ling' && per.tier === 'sovereign') return openEdict();   // 撰写：眼下内核只收元首的诏令
    if (c.key === 'shu') return openLetters();                             // 书札往来各档皆有（内核以玩家本人收发）
    if (c.key === 'jian') return audiencePage.openRoster();                // 召对：问对名单，常朝、廷议由此起
    if (c.key === 'xing' && per.tier === 'sovereign') return openEdict('conduct');   // 行止：与诏书同期付推演，落笔在诏书页右栏
    building(c.title, c.sub);
  }
  function onProp(name) {
    const ch = (k) => prof.channels.find((c) => c.key === k);
    if (name === 'memorials') return onChannel(ch('pi'));
    if (name === 'writing') return onChannel(ch('ling'));
    if (name === 'letterbox') return onChannel(ch('shu'));
    if (name === 'books') return archivePage.show();
    if (name === 'seal') return onSeal();
    if (name === 'tray') return readOnly() || issues.open();
  }
  // 批阅：书案让位，镜头俯到摊开的折子上；收折回来再亮书案
  // 召对、廷议两页建在后头；这里的回调用到时才取
  const docket = createDocket({ root, study, game, profile: () => sceneProfile(), onClose: () => { el.classList.add('on'); refresh(); backHome(); },
    onSummon: (name) => { el.classList.add('on'); audiencePage.summon(name); } });
  const issues = createIssues({ game, profile: () => prof, onConvene: (id) => { if (!readOnly()) courtPage.convene(id); }, onSecret: (id) => { if (!readOnly()) mizhaoPage.pick(id); } });
  const atlas = createAtlas({ root, game, onLetter: (name) => openLetters(name), onAudience: (name) => { if (!readOnly()) audiencePage.summon(name); }, onBio: (name) => bioPage.show(name) });
  // 列传：召对、传书、官制、追赠（开撰写）、回图志
  const bioPage = createBio({ root, game, profile: () => prof, onAudience: (name) => { if (!readOnly()) audiencePage.summon(name); }, onLetter: (name) => openLetters(name),
    onOffices: () => officesPage.show(), onEdict: () => { if (!readOnly() && per.tier === 'sovereign') openEdict(); }, onAtlas: (name) => atlas.show(name),
    viewer: () => per.name });
  const edictPage = createEdict({ root, study, game, profile: () => sceneProfile(), onClose: () => { el.classList.add('on'); refresh(); backHome(); }, onPromulgate: () => confirmAdvance() });
  function openEdict(at) {
    el.classList.remove('on');
    toStudyIfHome();
    edictPage.open(at);
  }
  // 书札：书案让位，镜头俯到摊开的花笺上
  const lettersPage = createLetters({ root, study, game, profile: () => sceneProfile(), onClose: () => { el.classList.add('on'); refresh(); backHome(); } });
  function openLetters(name) {
    if (readOnly()) return;
    el.classList.remove('on');
    toStudyIfHome();
    lettersPage.open(name);
  }
  // 召对：名单一卷；择人择体后，书房换景、书案让位
  const audiencePage = createAudience({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); gaizhiPage.resume(); backHome(); }, onLetter: (name) => openLetters(name), onCourt: (mode) => courtPage.begin(mode),
    onExternal: () => { kejuPage.hide(); wenyuanPage.hide(); gongweiPage.hide(); } });
  // 朝议：镜老流程；筹备卷、实录页都跟着内核的快照走
  const courtPage = createCourt({ root, study, game, profile: () => prof, onClose: () => { el.classList.add('on'); refresh(); backHome(); } });
  game.on('court:entered', () => { el.classList.remove('on'); toStudyIfHome(); });
  // 独召密问：选人选题一卷，入对后景同朝议
  createPrison({ game, profile: () => prof });     // 狱中问对：召对下狱之人时自起，不占书案
  // 终局：一局到头时自起满屏一幅；回启幕不再问「未封存的进度将会失去」（局已终）
  createEndgame({ root, game, onSaves: () => openSaves({ game, inGame: true }),
    onLeave: () => game.leave().catch((err) => bus.emit('kernel:toast', { text: String(err && err.message || err) })) });
  const mizhaoPage = createMizhao({ root, study, game, profile: () => prof, onOpen: () => { el.classList.remove('on'); toStudyIfHome(); }, onClose: () => { el.classList.add('on'); refresh(); backHome(); } });
  game.on('audience:open', () => { el.classList.remove('on'); toStudyIfHome(); });
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
  // 朝野册：人名翻人物图志；召党魁、召代表转召对；付廷议即开廷议、带上议题
  // 方志：入图后点府州小签展开；人名翻列传、势力翻朝野谱牒
  const fangzhiPage = createFangzhi({ root, game, profile: () => prof, onPerson: (name) => { fangzhiPage.hide(); bioPage.show(name); }, onFaction: (key) => { fangzhiPage.hide(); realmPage.show(key); } });
  const realmPage = createRealm({ root, game, profile: () => prof, onPerson: (name) => { realmPage.hide(); atlas.show(name); },
    onRegion: (id) => fangzhiPage.show(id), onCircuit: (key) => fangzhiPage.showCircuit(key),
    onAudience: (name) => { if (!readOnly()) audiencePage.summon(name); }, onCourt: (topic) => { if (!readOnly()) courtPage.begin('tinyi', { topic }); } });
  // 史馆：四库旧档；一回实录卷的「入史馆」翻到这一回的史记；卷尾人名可翻人物图志
  const archivePage = createArchive({ root, game, profile: () => prof, onPerson: (name) => { archivePage.hide(); atlas.show(name); } });
  const wenyuanPage = createWenyuan({ root, game, profile: () => prof, onPerson: (name) => bioPage.show(name) });
  // 科举册；科议画在殿上，开议时收册，散议后若是从册里起的便回册
  const kejuPage = createKeju({ root, game, profile: () => prof, onPerson: (name) => bioPage.show(name), onReform: () => { if (!readOnly()) gaizhiPage.show(); } });
  // 改制册叠在科举册之上：开时收起科举册，合时（含付科议）再展开——科议开成则由科议场景收放
  // 召史策对时改制册暂收、不展科举册（召对场景接手，问毕 audiencePage 的 onClose 里 resume 复开改制册）
  const gaizhiPage = createGaizhi({ root, game, profile: () => prof, seated: () => el.classList.contains('on'), onPerson: (name) => bioPage.show(name), onOpen: () => kejuPage.hide(), onClose: (why) => { if (why !== 'cedui') kejuPage.show(); } });
  let keyiFromBook = false;
  const keyiPage = createKeyi({ root, study, game, profile: () => prof,
    onOpen: () => { keyiFromBook = kejuPage.opened; kejuPage.hide(); el.classList.remove('on'); toStudyIfHome(); },
    onClose: () => { el.classList.add('on'); refresh(); if (keyiFromBook) kejuPage.show(); backHome(); } });
  bus.on('ui:keju', () => { if (!readOnly()) kejuPage.show(); });
  const wentianPage = createWentian({ root, game });
  const helpPage = createHelp({ root, game, profile: () => prof });
  const gongweiPage = createGongwei({ root, game, profile: () => prof, onPerson: (name) => bioPage.show(name), onAudience: (name) => { if (!readOnly()) audiencePage.summon(name, 'private'); } });
  const annals = (idx) => openAnnals({ game, profile: () => prof, idx, onArchive: (id) => archivePage.show(id) });
  const armyPage = createArmy({ root, game, onCourt: (topic) => { if (!readOnly()) courtPage.begin('tinyi', { topic }); }, onFiscal: () => fiscalPage.show(),
    scope: () => (per.tier === 'sovereign' ? null : per.name) });
  const officesPage = createOffices({ root, game, profile: () => prof, onPerson: (name) => { officesPage.hide(); atlas.show(name); } });
  function openDocket(id) {
    el.classList.remove('on');
    toStudyIfHome();
    docket.open(id);
  }
  function onSeal() {
    if (readOnly()) return;
    if (per.tier === 'sovereign') return confirmAdvance();             // 用印即交出本期所拟、付诸推演
    building(prof.seal.title, prof.seal.note);
  }


  // ---------- 暂停（Esc，或内核的暂停入口改道而来）：续、案卷、典章、实录、帮助、退位、回启幕 ----------
  let pausing = false;
  function pause() {
    if (pausing || !el.classList.contains('on') || (dive.mode !== 'desk' && !homeMap()) || dive.busy || docket.opened || edictPage.opened || lettersPage.opened || audiencePage.opened || courtPage.opened || mizhaoPage.opened || keyiPage.opened || document.querySelector('.q-juan-veil')) return;
    pausing = true;
    const item = (label, fn) => h('button.q-yapai.pz-item', { type: 'button', onclick: () => { j.close('ok'); fn(); } }, label);
    const j = juan({
      title: '天命', note: '暂停', width: '22rem',
      content: h('div.pz',
        item('续', () => {}),
        item('案卷目录', () => openSaves({ game, inGame: true })),
        item('典章', () => openSettings()),
        item(prof.annals.title, () => annals()),
        item('帮助', () => helpPage.show()),
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
      arrange();
      deskVisit = false;
      await loadWorld();
      refresh();
      el.classList.add('on');
      game.setSurface(true);
      offs.push(game.on('game:changed', refresh), game.on('game:advanced', refresh), game.on('view:changed', refresh),
        game.on('game:turn-result', (r) => annals(r && r.idx)),
        game.on('ui:pause', pause), game.on('ui:saves', () => { if (el.classList.contains('on')) openSaves({ game, inGame: true }); }),
        game.on('ui:help', () => { if (el.classList.contains('on')) helpPage.show(); }),
        bus.on('pins:changed', refresh),
        bus.on('settings:changed', ({ key }) => { if (key === 'home') { arrange(); refresh(); } }),
        game.on('game:entered', () => loadWorld().then(refresh)));
      gaizhiPage.inheritance();                      // 开局幕里就断下的新朝承前，落座后展
    },
    // 舆图为家：落座片刻后俯身入图（开局的升华：先在御案前坐定，再入天下）
    async home() {
      if (!homeMap() || dive.mode !== 'desk') return;
      await new Promise((r) => setTimeout(r, 700));
      // 元首看全境；通用一套落到所掌上空近些
      await dive.dive(focus && focus.center, prof.tier === 'sovereign' ? undefined : 460);
    },
    hide() {
      if (dive.mode === 'map') dive.toStudy();
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
