// 读模型：从内核取数，返回纯数据快照（不带内核对象引用）。界面上显示的一律是「据奏」口径——
// 奏报失真层开着时玩家看到的是有司上报的数，这里调内核自己的 _barReported / _barFlipToPerceived，与老顶栏同源。
const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function reported(key, val, dir, domain) {
  const f = fn('_barReported');
  return f ? f(key, val, dir, domain).shown : val;
}
function stock(account, res) {
  const f = fn('_barAccountStock');
  if (f) return f(account, res);
  return num(account && account.ledgers && account.ledgers[res] && account.ledgers[res].stock);
}

// 日期：年号纪年（年号、在位第几年）、公历年、月日（剧本历法：农历剧本取农历月日）、干支、季、回合。
// 取内核 calcDateFromTurn：eraInfo = { era 年号, ry 年数, month, day }；gzYearStr / gzDayStr 年日干支
export function date() {
  const g = G();
  const turn = num(g.turn, 1);
  const out = { turn, running: !!g.running, busy: !!g.busy };
  const calc = fn('calcDateFromTurn');
  try {
    const c = calc ? calc(turn) : null;
    if (c) {
      const e = c.eraInfo || {};
      out.year = c.adYear;
      out.era = e.era || g.eraName || '';
      out.reignYear = num(e.ry, 0) || null;
      out.month = num(e.month, 0) || (c.calendar === 'lunar' ? c.lunarMonth : c.solarMonth);
      out.day = num(e.day, 0) || (c.calendar === 'lunar' ? c.lunarDay : c.solarDay);
      out.ganzhi = c.gzYearStr || '';
      out.dayGanzhi = c.gzDayStr || '';
      out.season = c.season || '';
    }
  } catch (err) {
    console.warn('[newui] 取日期出错', err);
  }
  const txt = fn('getTSText');
  out.text = txt ? String(txt(turn)) : '';
  out.daysPerTurn = num(w.P && w.P.time && w.P.time.daysPerTurn, 30);
  return out;
}

// 玩家身份
export function player() {
  const g = G();
  const pi = g.playerInfo || {};
  const id = pi.characterId || g.playerCharacterId;
  const ch = (g.chars || []).find((c) => c && (c.id === id || c.isPlayer)) || null;
  return {
    id: id || (ch && ch.id) || null,
    name: pi.characterName || (ch && ch.name) || '',
    title: pi.characterTitle || (ch && (ch.officialTitle || ch.title)) || '',
    faction: pi.factionName || (ch && ch.faction) || '',
    portrait: (ch && ch.portrait) || '',
    location: (ch && ch.location) || ''
  };
}

// ---------- 视角人物：界面按谁的身份长出来（官本位设计稿第九章「案头即身份」） ----------
// 身份现算，不看头衔文字：
//   元首：玩家看剧本的玩家定位（君主／emperor）或「玩家即势力之主」；别人看是不是某势力的首领
//   官职：官制在任记录（TM.OfficeHolderState.activeAssignments），差使、出缺、丁忧不算
//   辖区：区划上主官是此人的那几块（GM.adminHierarchy 的 governorId／governor）
// 档：sovereign 元首、minister 京官、provincial 地方官、gentry 不在官。
// as：开发用「借视角」，给人名或 id；不给就是玩家本人。
const LOCAL_POST = /督抚|总督|巡抚|经略|督师|布政|按察|都指挥|总兵|知府|知州|知县|府尹|节度|观察|刺史|安抚|转运|提刑|道$/;

function charById(g, ref) {
  const chars = g.chars || [];
  return chars.find((c) => c && c.id != null && String(c.id) === String(ref)) || chars.find((c) => c && c.name === ref) || null;
}
function playerChar(g) {
  const pi = g.playerInfo || {};
  const chars = g.chars || [];
  const id = pi.characterId || g.playerCharacterId;
  return (id != null && chars.find((c) => c && String(c.id) === String(id))) || chars.find((c) => c && c.isPlayer) ||
    chars.find((c) => c && pi.characterName && c.name === pi.characterName) || null;
}
function postsOf(g, ch) {
  const ohs = w.TM && w.TM.OfficeHolderState;
  if (!ch || !ohs || typeof ohs.activeAssignments !== 'function') return [];
  try {
    return ohs.activeAssignments(g, ch).map((a) => ({
      dept: a.dept || '', title: (a.pos && a.pos.name) || '', rank: (a.pos && a.pos.rank) || '',
      organizationId: a.organizationId || '', local: (a.pos && a.pos.bindingHint) === 'region', delegated: !!a.delegated
    }));
  } catch (err) {
    console.warn('[newui] 取官职出错', err);
    return [];
  }
}
function governedBy(g, ch) {
  const out = [];
  if (!ch) return out;
  const ah = g.adminHierarchy || (w.P && w.P.adminHierarchy) || {};
  const walk = (list, depth) => {
    for (const d of list || []) {
      if (!d) continue;
      const mine = d.governorId != null && d.governorId !== '' ? String(d.governorId) === String(ch.id) : !!d.governor && d.governor === ch.name;
      if (mine) out.push({ d, depth });
      walk(d.children || d.divisions, depth + 1);
    }
  };
  for (const k of Object.keys(ah)) walk(ah[k] && ah[k].divisions, 0);
  return out;
}

export function perspective(as) {
  const g = G();
  // 运行态的玩家信息为准；开局途中（开场白时）它还空着，缺的项退回剧本模板
  const gpi = g.playerInfo || {};
  const pi = { ...((w.P && w.P.playerInfo) || {}), ...Object.fromEntries(Object.entries(gpi).filter(([, v]) => v !== '' && v != null)) };
  const me = playerChar(g);
  const ch = as ? charById(g, as) : me;
  const isPlayer = !!ch && ch === me;
  const facs = g.facs || [];
  const fac = ch ? facs.find((f) => f && ((ch.factionId && f.id === ch.factionId) || f.name === ch.faction)) || null : null;
  const pfac = facs.find((f) => f && ((pi.factionId && f.id === pi.factionId) || f.name === pi.factionName)) || null;
  const role = isPlayer || !ch ? String(pi.playerRole || '') : '';
  const leads = (f) => !!f && !!ch && (f.leader === ch.name || (f.leaderId != null && String(f.leaderId) === String(ch.id)));
  const ruler = isPlayer || !ch
    ? /^(emperor|君主)$/i.test(role) || (!role && pi.leaderIsPlayer === true) || leads(pfac) || leads(fac)
    : facs.some(leads);
  const posts = postsOf(g, ch);
  const governs = governedBy(g, ch).sort((a, b) => a.depth - b.depth).map(({ d }) => ({
    id: d.id, name: d.name || '', level: d.level || '', mapRegionId: d.mapRegionId || d.regionId || '',
    regionIds: Array.isArray(d.mappedRegions) ? d.mappedRegions.slice() : []
  }));
  const tier = tierOf(ruler, posts, governs);
  return {
    id: ch ? ch.id : pi.characterId || null,
    name: ch ? ch.name : pi.characterName || '',
    title: ch ? ch.officialTitle || ch.title || '' : pi.characterTitle || '',
    portrait: (ch && ch.portrait) || '',
    faction: (fac && fac.name) || (ch && ch.faction) || pi.factionName || '',
    role, ruler, tier, posts, governs,
    location: (ch && ch.location) || '',
    capital: pi.capital || (fac && fac.capital) || '',
    isPlayer, previewing: !!as && !isPlayer
  };
}

function tierOf(ruler, posts, governs) {
  if (ruler) return 'sovereign';
  if (!posts.length && !governs.length) return 'gentry';
  return governs.length > 0 || posts.some((p) => p.local || LOCAL_POST.test(p.dept + p.title)) ? 'provincial' : 'minister';
}

// 开局途中（开场白时）内核还没装好人物与官制，身份按剧本本身算（同一套规则，只读剧本数据）
export function scenarioPerspective(sc) {
  const pi = (sc && sc.playerInfo) || {};
  const name = pi.characterName || '';
  const role = String(pi.playerRole || '');
  const ruler = /^(emperor|君主)$/i.test(role) || (!role && pi.leaderIsPlayer === true) ||
    ((sc && sc.factions) || []).some((f) => f && name && f.leader === name && (f.name === pi.factionName || (pi.factionId && f.id === pi.factionId)));
  const posts = [];
  const walkOffice = (nodes) => {
    for (const n of nodes || []) {
      if (!n) continue;
      for (const p of n.positions || []) {
        const holders = Array.isArray(p.actualHolders) ? p.actualHolders.map((x) => x && x.name) : [p.holder];
        if (p && name && holders.includes(name)) posts.push({ dept: n.name || '', title: p.name || '', rank: p.rank || '', local: p.bindingHint === 'region' });
      }
      walkOffice((n.subs || []).concat(n.children || []));
    }
  };
  walkOffice(sc && sc.officeTree);
  const governs = [];
  const walkDiv = (list) => { for (const d of list || []) { if (!d) continue; if (name && d.governor === name) governs.push({ id: d.id, name: d.name || '' }); walkDiv(d.children || d.divisions); } };
  const ah = (sc && sc.adminHierarchy) || {};
  for (const k of Object.keys(ah)) walkDiv(ah[k] && ah[k].divisions);
  return { id: pi.characterId || null, name, title: pi.characterTitle || '', role, ruler, tier: tierOf(ruler, posts, governs), posts, governs, isPlayer: true, previewing: false };
}

// 人物自身的读数：名望、贤能、康健、心绪（100−压力）；家产（私财）与公费（所掌公库）
export function person(ref) {
  const g = G();
  const ch = ref ? charById(g, ref) : playerChar(g);
  const r = (ch && ch.resources) || {};
  const pw = r.privateWealth || {}, pp = r.publicPurse || r.publicTreasury || {};
  const fame = r.fame != null ? r.fame : ch && ch.fame;
  return {
    gauges: [
      { key: 'fame', label: '名望', value: Math.round(num(fame)) },
      { key: 'xianneng', label: '贤能', value: Math.round(num(ch && ch.xianneng, num(r.xianneng))) },
      { key: 'health', label: '康健', value: Math.round(num(r.health, num(ch && ch.health, 80))) },
      { key: 'mood', label: '心绪', value: Math.round(100 - num(r.stress, num(ch && ch.stress, 0))) }
    ],
    wealth: [{ k: '银', v: num(pw.money), unit: '两' }, { k: '粮', v: num(pw.grain), unit: '石' }, { k: '布', v: num(pw.cloth), unit: '匹' }],
    purse: [{ k: '银', v: num(pp.money), unit: '两' }, { k: '粮', v: num(pp.grain), unit: '石' }, { k: '布', v: num(pp.cloth), unit: '匹' }]
  };
}

// 辖区读数：所辖首块区划的户口（据册）、民心、吏治（100−地方浊度）
export function jurisdiction(divisionId) {
  const ah = G().adminHierarchy || (w.P && w.P.adminHierarchy) || {};
  let hit = null;
  const walk = (list) => { for (const d of list || []) { if (hit) return; if (d && d.id === divisionId) hit = d; else if (d) walk(d.children || d.divisions); } };
  for (const k of Object.keys(ah)) walk(ah[k] && ah[k].divisions);
  if (!hit) return null;
  const pd = hit.populationDetail || {};
  const pop = typeof hit.population === 'object' && hit.population ? hit.population : {};
  const corr = typeof hit.corruptionLocal === 'object' && hit.corruptionLocal ? num(hit.corruptionLocal.value, num(hit.corruptionLocal.index)) : num(hit.corruptionLocal);
  const mx = typeof hit.minxinLocal === 'object' && hit.minxinLocal ? num(hit.minxinLocal.value, num(hit.minxinLocal.index)) : num(hit.minxinLocal);
  return {
    id: hit.id, name: hit.name || '',
    rows: [{ k: '口', v: num(pd.mouths, num(pop.mouths, typeof hit.population === 'number' ? hit.population : 0)) }, { k: '丁', v: num(pd.ding, num(pop.ding)) }],
    minxin: Math.round(mx), lizhi: Math.round(100 - corr)
  };
}

// 帑廪（国库）与内帑：库存（据奏）、本期增减、单位、状态；老顶栏的视图模型（_renderGuoku/_renderNeitang）提供增减与状态
function ledger(kind) {
  const g = G();
  const account = kind === 'guoku' ? g.guoku || {} : g.neitang || {};
  const view = (() => {
    const f = fn(kind === 'guoku' ? '_renderGuoku' : '_renderNeitang');
    try { return f ? f() : null; } catch (err) { console.warn(`[newui] ${kind} 视图模型出错`, err); return null; }
  })();
  const rows = ['money', 'grain', 'cloth'].map((res, i) => {
    const raw = stock(account, res);
    const shown = kind === 'guoku' ? reported(`guoku.${res}`, raw, 'good') : raw;
    const sub = view && view.subItems && view.subItems[i];
    const st = view && view.tip && view.tip.stocks && view.tip.stocks[i];
    return { key: res, label: sub ? sub.k : ['银', '粮', '布'][i], value: shown, delta: sub && typeof sub.d === 'number' ? sub.d : 0, unit: (st && st.unit) || ['两', '石', '匹'][i] };
  });
  return {
    rows,
    state: view && view.tip && view.tip.state ? { ...view.tip.state } : null,
    flows: view && view.tip && view.tip.flows ? view.tip.flows.map((f) => ({ label: f.label, text: f.val, unit: f.unit })) : [],
    distorted: !!(view && view.tip && /据奏/.test(view.tip.subtitle || ''))
  };
}
export const treasury = () => ledger('guoku');
export const privy = () => ledger('neitang');

// 户口（据奏：黄册口算历来少报）
export function census() {
  const g = G();
  let pop = (g.population && g.population.national) || {};
  const hj = w.HujiEngine;
  try { if (hj && typeof hj.getPopulationView === 'function') pop = hj.getPopulationView({ root: g }); } catch (_e) { pop = (g.population && g.population.national) || {}; }
  const legacy = g.hukou || {};
  const mouths = pop.displayBasis === 'registered' ? pop.mouths : (pop.mouths || legacy.registeredTotal || 0);
  return {
    mouths: reported('national.mouths', num(mouths), 'bad', 'renli'),
    households: reported('national.households', num(pop.households), 'bad', 'renli'),
    ding: reported('national.ding', num(pop.ding), 'bad', 'renli'),
    fugitives: reported('national.fugitives', num(g.population && g.population.fugitives), 'bad', 'renli'),
    registered: pop.displayBasis === 'registered'
  };
}

// 四项国势：吏治（清明度＝100−浊度）、民心、皇权、皇威。与老顶栏 powerSealData 同一取法：
// 失真层开着且未揭真时显示朝廷所见（perceived），否则真值；seen 是朝廷所见，供「真伪双值」用
export function gauges() {
  const g = G();
  const flip = fn('_barFlipToPerceived');
  const c = g.corruption || {};
  const ct = num(c.trueIndex, num(c.overall));
  const cp = c.perceivedIndex !== undefined ? c.perceivedIndex : ct;
  const lz = flip && flip('corruption', 'index') ? cp : ct;
  const m = g.minxin || {};
  const mt = num(m.trueIndex, num(m.index, num(m.value)));
  const mp = m.perceivedIndex !== undefined ? m.perceivedIndex : mt;
  const mx = flip && flip('minxin', 'index') ? mp : mt;
  const h = g.huangquan || {};
  const hi = num(h.index);
  const wv = g.huangwei || {};
  const wi = num(wv.index);
  return [
    { key: 'lizhi', label: '吏治', value: Math.round(100 - lz), seen: Math.round(100 - cp) },
    { key: 'minxin', label: '民心', value: Math.round(mx), seen: Math.round(mp) },
    { key: 'huangquan', label: '皇权', value: Math.round(hi), seen: Math.round(h.perceivedIndex !== undefined ? h.perceivedIndex : hi) },
    { key: 'huangwei', label: '皇威', value: Math.round(wi), seen: Math.round(wv.perceivedIndex !== undefined ? wv.perceivedIndex : wi) }
  ];
}

// 奏疏：本回合待批的（与老奏疏面板同口径：pending / pending_review）
export function memorials() {
  const g = G();
  const turn = num(g.turn, 1);
  return (g.memorials || []).filter((m) => m && (m.status === 'pending' || m.status === 'pending_review') && (m.turn == null || m.turn <= turn)).map((m) => ({
    id: m.id, from: m.from || '', title: m.title || m.subjectLine || '', body: String(m.content || m.body || ''),
    priority: m.priority || m.urgency || '', turn: m.turn, status: m.status, reply: m.reply || ''
  }));
}

// 案头待批（元首一档即奏疏）：本回合的与未结的，与老奏疏面板同口径（tm-memorials.js renderMemorials）。
// 分四组：urgent 急奏待批、pending 百官启奏、held 留中之折、done 已批（本回合可再改）
const MEM_TYPE = { minxin: '民情', pressure: '积压', impeachment: '弹劾', minxin_accountability: '民情问责', report: '题本', intelligence: '密折', warning: '军务', policy: '政务', personnel: '人事', local: '地方', accountability: '问责' };
const MEM_DONE = ['approved', 'rejected', 'annotated', 'referred', 'court_debate'];
const memType = (v) => {
  if (v == null || v === '') return '';
  const s = String(v);
  return MEM_TYPE[s] || MEM_TYPE[s.toLowerCase()] || (/^[A-Za-z_ ]+$/.test(s) ? '' : s);
};
export function docket() {
  const g = G();
  const turn = num(g.turn, 1);
  const illegal = fn('_memMarkIllegalPresenter');
  const yanyi = !!(w.P && w.P.conf && w.P.conf.gameMode === 'yanyi');
  const ts = fn('getTSText');
  const list = g.memorials || [];
  return list.filter((m) => m && !(illegal && illegal(m, 'render')) && (m.turn === turn || m.status === 'pending' || m.status === 'pending_review')).map((m) => {
    if (!m.id) m.id = typeof w.uid === 'function' ? w.uid() : 'mem_' + list.indexOf(m);   // 与老面板一样：没有 id 的补一个稳定 id
    const system = !m.from || m.from === '有司';
    const ch = system ? null : charById(g, m.from);
    const type = memType(m.type);
    return {
      id: m.id, from: m.from || '有司', system,
      fromTitle: ch ? ch.officialTitle || ch.title || '' : '', portrait: (ch && ch.portrait) || '',
      title: m.title || m.subjectLine || '', body: String(m.content || m.body || ''),
      type: type + (m.subtype ? '·' + (memType(m.subtype) || m.subtype) : ''),
      urgent: m.priority === 'urgent', reliability: yanyi ? m.reliability || '' : '',
      remoteFrom: m._remoteFrom || '', replySent: !!m._replyLetterSent, replyArrived: !!(m._replyDeliveryTurn && turn >= m._replyDeliveryTurn),
      status: m.status || 'pending', reply: m.reply || '', referredTo: m._referredTo || '',
      group: m.status === 'pending_review' ? 'held' : MEM_DONE.includes(m.status) ? 'done' : m.priority === 'urgent' ? 'urgent' : 'pending',
      turn: m.turn, date: ts && m.turn != null ? String(ts(m.turn)) : ''
    };
  });
}

// 交部议：可批转之人——在侧的本朝臣工，按品级。筛法同老面板 _referMemorial，另加一条：须是官制上在任之人
// （老面板只看头衔，后妃、白身也会列进来；头衔≠官职）
function officeHolders(g) {
  const ohs = w.TM && w.TM.OfficeHolderState;
  if (!ohs || typeof ohs.positions !== 'function') return null;
  const out = new Set();
  try {
    // read() 交回的人物对象未必就是 GM.chars 里那一个，按 id 与名字认
    for (const row of ohs.positions(g)) for (const c of ohs.read(g, row.pos).characters) { if (c.id != null) out.add('id:' + c.id); if (c.name) out.add('name:' + c.name); }
  } catch (err) {
    console.warn('[newui] 取在任官员出错', err);
    return null;
  }
  return out;
}
export function referCandidates(id) {
  const g = G();
  const m = (g.memorials || []).find((x) => x && x.id === id);
  if (!m) return [];
  const here = fn('_getPlayerLocation') ? fn('_getPlayerLocation')() : g._capital || '京城';
  const same = fn('_isSameLocation'), foreign = fn('_tmIsForeignCourtChar'), rank = fn('getRankLevel');
  const lv = (c) => (rank ? rank(c.officialTitle || '') : 99);
  const holders = officeHolders(g);
  const holds = (c) => !holders || holders.has('id:' + c.id) || holders.has('name:' + c.name);
  return (g.chars || []).filter((c) => c && holds(c) && !(foreign && foreign(c)) && c.alive !== false && !c.isPlayer && c.name !== m.from && (!c.location || !same || same(c.location, here)))
    .sort((a, b) => lv(a) - lv(b)).slice(0, 15)
    .map((c) => ({ id: c.id, name: c.name, title: c.officialTitle || c.title || '', portrait: c.portrait || '' }));
}

// 邸报：近事编年（GM._chronicle）由新到旧，取标题（首个【…】或前二十余字）；重要者标「急」，要务标「议」，余为「闻」
export function news(limit = 8) {
  const list = (G()._chronicle || []).filter((e) => e && e.text && !/paradigm|scenario|^system/i.test(String(e.type || '')));
  return list.slice(-limit * 2).reverse().slice(0, limit).map((e) => {
    const text = String(e.text);
    const m = text.match(/【([^】]{2,24})】/);
    const tags = Array.isArray(e.tags) ? e.tags : [];
    return {
      turn: e.turn, type: e.type || '',
      tag: tags.includes('重要') || /急|变|乱/.test(e.type || '') ? '急' : /要务|议/.test(e.type || '') ? '议' : '闻',
      text: m ? m[1] : text.replace(/\s+/g, ' ').slice(0, 22)
    };
  });
}

// 时局要务（案头花笺）：未结的几件，题与摘要
export function issues(limit = 3) {
  return (G().currentIssues || []).filter((i) => i && i.status !== 'resolved').slice(0, limit).map((i) => ({
    id: i.id, title: i.title || '', summary: String(i.description || '').replace(/【[^】]*】/g, '').replace(/\s+/g, ' ').slice(0, 60)
  }));
}

// 时政（御案时政／案头要事）全账：待决、省览（信息卡，无须拍板）、已决。与老面板 openShizhengTasks 同口径
const SEVERITY = { urgent: '紧急', high: '重要', warn: '警戒', info: '平常' };
export function issueList() {
  const g = G();
  const ts = fn('getTSText');
  const norm = fn('_tmNormIssueChoices');
  const when = (turn, date) => date || (ts ? String(ts(turn || 1)) : `第${turn || 1}回合`);
  return (g.currentIssues || []).filter(Boolean).map((i) => {
    if (norm && Array.isArray(i.choices)) { try { norm(i); } catch (_e) { /* 归一失败照原样显示 */ } }
    const resolved = i.status === 'resolved';
    return {
      id: i.id, title: i.title || '（未详）', description: String(i.description || ''), narrative: i.narrative && i.narrative !== i.description ? String(i.narrative) : '',
      category: i.category || '', severity: SEVERITY[i.severity] || i.severity || '', region: i.affectedRegion || '',
      group: resolved ? 'done' : i._info ? 'info' : 'open', resolving: !!i._resolving,
      raised: when(i.raisedTurn, i.raisedDate), raisedTurn: i.raisedTurn || 1, resolvedOn: resolved && i.resolvedTurn ? when(i.resolvedTurn, i.resolvedDate) : '',
      chars: Array.isArray(i.linkedChars) ? i.linkedChars.slice() : [], factions: Array.isArray(i.linkedFactions) ? i.linkedFactions.slice() : [],
      consequences: i.longTermConsequences && typeof i.longTermConsequences === 'object' ? Object.entries(i.longTermConsequences).map(([k, v]) => [k, String(v)]) : [],
      history: i.historicalNote || '', chosen: i.chosenText || '',
      choices: Array.isArray(i.choices) ? i.choices.map((c, k) => ({ index: k, text: (c && (c.text || c.label)) || `选项${k + 1}`, desc: (c && (c.desc || c.consequence)) || '' })) : [],
      legacyRelief: !!(i.relief && i.relief.version === 1)
    };
  });
}

// 人物（在世），供图志与小立轴
export function characters({ limit = 0 } = {}) {
  const list = (G().chars || []).filter((c) => c && c.alive !== false && !c.dead).map((c) => ({
    id: c.id, name: c.name, title: c.officialTitle || c.title || '', faction: c.faction || '', party: c.party || '',
    portrait: c.portrait || '', age: c.age, location: c.location || '', isPlayer: !!c.isPlayer
  }));
  return limit ? list.slice(0, limit) : list;
}

// 人物志（图志册页）：每人一条小传所需——身份、才具、五常、名望、特质、关系、处境。与老人物志卡片同取法（tm-renwu-ui.js）
// 品级：正一品=1、从一品=2 … 从九品=18；解不出为 99
const RANK_RE = /([正从])([一二三四五六七八九])品/;
const rankLevel = (s) => { const m = RANK_RE.exec(String(s || '')); return m ? '一二三四五六七八九'.indexOf(m[2]) * 2 + (m[1] === '正' ? 1 : 2) : 99; };
// 在任者的最高品级：官制上走一遍，按人记下所任职位里最高的品
function postRanks(g) {
  const ohs = w.TM && w.TM.OfficeHolderState;
  const out = new Map();
  if (!ohs || typeof ohs.positions !== 'function') return out;
  try {
    for (const row of ohs.positions(g)) {
      const lv = rankLevel(row.pos.rank);
      if (lv >= 99) continue;
      const label = RANK_RE.exec(row.pos.rank)[0];
      for (const c of ohs.read(g, row.pos).characters) {
        const k = c.id != null ? 'id:' + c.id : 'name:' + c.name;
        const had = out.get(k);
        if (!had || lv < had.level) out.set(k, { level: lv, label, title: row.pos.name || '' });
      }
    }
  } catch (err) {
    console.warn('[newui] 取品级出错', err);
  }
  return out;
}
function rankOf(c, posts) {
  const held = posts && (posts.get('id:' + c.id) || posts.get('name:' + c.name));
  if (held) return { level: held.level, label: held.label };
  const lvFn = fn('getRankLevel');
  let level = 99, label = '';
  if (c.rank) { label = c.rank; if (lvFn) level = lvFn(c.rank); }
  else if ((c.officialTitle || c.title) && lvFn) level = lvFn(c.officialTitle || c.title);
  const H = w.RANK_HIERARCHY;
  if (!label && level < 99 && Array.isArray(H)) { const r = H.find((x) => x.level === level); if (r) label = r.label; }
  return { level, label };
}
function traitsOf(c) {
  const lib = w.TRAIT_LIBRARY || {};
  return (Array.isArray(c.traits) ? c.traits : []).map((t) => {
    const id = typeof t === 'string' ? t : (t && (t.id || t.name)) || '';
    const def = lib[id];
    const sum = def && def.effects ? Object.values(def.effects).reduce((a, v) => a + (Number(v) || 0), 0) : 0;
    return { id, name: (def && def.name) || id, tone: sum >= 3 ? 'pos' : sum <= -3 ? 'neg' : 'neu' };
  }).filter((t) => t.name);
}
function relationsOf(c, limit = 6) {
  const out = [];
  for (const [other, rels] of Object.entries(c._relationships || {})) {
    for (const r of rels || []) out.push({ name: other, type: r.type || 'friend', strength: Number(r.strength) || 0 });
  }
  return out.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength)).slice(0, limit)
    .map((r) => ({ ...r, tone: r.type === 'foe' || r.type === 'rival' || r.type === 'enemy' || r.strength < -30 ? 'foe' : r.type === 'spouse' || r.type === 'lover' ? 'spouse' : 'friend' }));
}
export function people({ dead = false } = {}) {
  const g = G();
  const turn = num(g.turn, 1);
  const here = fn('_getPlayerLocation') ? fn('_getPlayerLocation')() : g._capital || '京城';
  const same = fn('_isSameLocation');
  const consort = fn('_tmIsPlayerConsort');
  const newJoin = fn('turnsForMonths') ? fn('turnsForMonths')(5) : 5;
  const posts = postRanks(g);
  return (g.chars || []).filter((c) => c && (dead || c.alive !== false)).map((c) => {
    const states = [];
    if (c._imprisoned || c.imprisoned) states.push('诏狱');
    if (c._exiled || c.exiled) states.push('流放');
    if (c._fled || c._missing) states.push('逃亡');
    if (c._mourning) states.push('丁忧');
    if (c._retired) states.push('致仕');
    if ((c.stress || 0) > 70) states.push('重压');
    if (c._travelTo) states.push('赴任');
    if (c._scheming) states.push('密谋');
    if (c.joinTurn && turn - c.joinTurn < newJoin) states.push('新晋');
    else if (c.age >= 60) states.push('老成');
    const wc = c.wuchang || {};
    const isConsort = (() => { try { return consort ? !!consort(c) : c.spouse === true; } catch (_e) { return false; } })();
    return {
      id: c.id, name: c.name || '', zi: c.zi || c.courtesy || '', hao: c.haoName || '', age: c.age || null, gender: c.gender || '',
      office: c.officialTitle || c.title || c.role || c.occupation || (isConsort ? '后宫' : '布衣'), rank: rankOf(c, posts),
      faction: c.faction || '', party: c.party || '', partyRank: c.partyRank || '', family: c.family || '',
      portrait: c.portrait || '', location: c.location || '', travelTo: (c._travelTo && c._travelTo.toLocation) || '',
      away: !!(c.location && same && !same(c.location, here)), alive: c.alive !== false, dead: c.alive === false,
      deathReason: c.deathReason || '', isPlayer: !!c.isPlayer, consort: isConsort, states,
      loyalty: Math.round(num(c.loyalty, 50)), ambition: Math.round(num(c.ambition, 50)),
      stats: [['智', num(c.intelligence)], ['政', num(c.administration)], ['军', num(c.military)], ['交', num(c.diplomacy)], ['魅', num(c.charisma)], ['勇', num(c.valor)]],
      wuchang: ['仁', '义', '礼', '智', '信'].map((k) => [k, wc[k] != null ? num(wc[k]) : null]),
      fame: c.mingwang != null ? Math.round(num(c.mingwang)) : c.reputation != null ? Math.round(num(c.reputation)) : null,
      merit: c.xianneng != null ? Math.round(num(c.xianneng)) : null, integrity: c.integrity != null ? Math.round(num(c.integrity)) : null,
      traits: traitsOf(c), relations: relationsOf(c),
      personality: c.personality || '', goal: c.personalGoal || '', bio: String(c.bio || ''), appearance: c.appearance || ''
    };
  });
}

// ---------- 舆图府州：剧本地图坐标 → 舆图世界坐标（用内核山河境的同一套投影） ----------
export function mapRegions() {
  const g = G();
  const P = w.P || {};
  const map = (typeof w.peekMapSource === 'function' && w.peekMapSource()) || g.mapData || g.map || P.mapData || P.map;
  if (!map || !Array.isArray(map.regions) || !map.regions.length) return null;
  const rt = w.TMShanheRuntime;
  const prof = rt && typeof rt.projection === 'function' ? (() => { try { return rt.projection(map); } catch (err) { console.warn('[newui] 地图投影不可用', err); return null; } })() : null;
  if (!prof) return null;
  const m = prof.world;                         // DOMMatrix：地图坐标 → 世界坐标
  const toWorld = (p) => {
    const q = Array.isArray(p) ? { x: p[0], y: p[1] } : p;
    const r = m.transformPoint(new DOMPoint(q.x, q.y));
    return [Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100];
  };
  const ringOf = (r) => {
    if (Array.isArray(r.points) && r.points.length >= 3) return r.points;
    const geo = r.geometry;
    if (geo && geo.type === 'Polygon' && geo.coordinates && geo.coordinates[0]) return geo.coordinates[0];
    if (geo && geo.type === 'MultiPolygon' && geo.coordinates && geo.coordinates[0]) return geo.coordinates[0][0];
    return null;
  };
  const factions = {};
  const ownerOf = (r) => r.factionId || r.owner || '';
  const facInfo = map.factions || {};
  const regions = [];
  for (const r of map.regions) {
    const ring = ringOf(r);
    if (!ring || ring.length < 3) continue;
    const fid = ownerOf(r);
    if (fid && !factions[fid]) {
      const f = facInfo[fid] || {};
      factions[fid] = { name: f.name || r.factionName || r.ownerName || fid, color: f.color || r.factionColor || r.color || '#999999', short: f.shortName || f.short || '' };
    }
    const center = r.referenceSeat || r.center || r.centroid;
    regions.push({
      id: r.id, name: r.name || '', circuit: r.circuitName || '', parent: r.parentId || '', faction: fid,
      poly: ring.map(toWorld), center: center ? toWorld(center) : toWorld(ring[0])
    });
  }
  return { mapId: map.id, regions, factions };
}
