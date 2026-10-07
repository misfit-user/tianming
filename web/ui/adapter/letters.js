// 书札（「书」一渠道）：远方人物名册、往来书札、截获密函、驿路告急、拟稿与遣使、信上诸动作。
// 往来书札都在 GM.letters（tm-hongyan-office.js）；遣使走内核 sendLetter 的参数接缝（不读老面板的输入框），
// 信上动作（追回、改用密旨、重发、存疑、遣使核实、摘入、标记）直接调老面板同名函数——它们不读 DOM。
// 名册不照老面板的地名正则分组（那套只认得明代地名），改按人物所在地的上级区划分；外方人物按所属势力分。
const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const dict = (name) => (w[name] && typeof w[name] === 'object' ? w[name] : {});

export const URGENCY = [['normal', '驿递', '日行五十里'], ['urgent', '加急', '日行三百里'], ['extreme', '八百里加急', '日行八百里']];
export const SEND_MODES = [['multi_courier', '多路信使', '数路并发，截获者难尽'], ['secret_agent', '密使', '不走驿站，慢而稳']];

const label = (table, key) => (dict(table)[key] || {}).label || '';
export function typeLabel(key) { return label('LETTER_TYPES', key) || '书札'; }
export function ciphers() {
  return Object.entries(dict('LETTER_CIPHERS')).map(([key, c]) => ({ key, label: c.label || key, note: c.desc || '' }));
}
// 文书种类：只列身份档许可的几种（keys），名目取内核字典
export function types(keys) {
  const T = dict('LETTER_TYPES');
  return keys.filter((k) => T[k]).map((k) => {
    const t = T[k];
    const token = typeof t.needsToken === 'string' ? t.needsToken : '';
    return { key: k, label: t.label || k, formal: !!t.formal, token, tokenLabel: token ? label('LETTER_TOKENS', token) : '', tokenHeld: token ? holds(token) : true };
  });
}
function holds(token) {
  const name = label('LETTER_TOKENS', token);
  return (G().items || []).some((it) => it && (it.type === token || it.name === name));
}

// ---------- 名册 ----------
const capital = () => G()._capital || '京城';
const same = (a, b) => { const f = fn('_isSameLocation'); return f ? !!f(a, b) : a === b; };
function player(g) {
  const pc = w.TM && w.TM.Player && typeof w.TM.Player.getCharacter === 'function' ? w.TM.Player.getCharacter(g) : null;
  return pc || (g.chars || []).find((c) => c && c.isPlayer) || null;
}
// 人物该归哪一片：地图块的简称（circuitName，如「广东」）优先，其次区划树的顶层名（省、路、道……）；
// 没绑地图块的，按所在地的地名去区划名里找（长名先配）。按剧本与读档代次缓存
let placeCache = { key: '', byRegion: null, names: null };
function places() {
  const g = G();
  const key = `${g.sid || ''}@${w._tmLoadGen || 0}`;
  if (placeCache.key === key && placeCache.byRegion) return placeCache;
  const circuit = new Map();                       // 地图块 id → 简称
  const map = (typeof w.peekMapSource === 'function' && w.peekMapSource()) || g.mapData || (w.P && (w.P.mapData || w.P.map)) || null;
  for (const r of (map && map.regions) || []) if (r && r.id && r.circuitName) circuit.set(String(r.id), r.circuitName);
  // 区划树：每个节点记下顶层名；顶层若有地图块能给出简称，就用简称
  const ah = g.adminHierarchy || (w.P && w.P.adminHierarchy) || {};
  const nodes = [];
  const short = new Map();
  const walk = (list, top) => {
    for (const d of list || []) {
      if (!d) continue;
      const t = top || d.name || '';
      const ids = [d.id, d.mapRegionId, ...(Array.isArray(d.mappedRegions) ? d.mappedRegions : [])].filter(Boolean).map(String);
      for (const id of ids) if (circuit.has(id) && !short.has(t)) short.set(t, circuit.get(id));
      nodes.push([ids, d.name || '', t]);
      walk(d.children || d.divisions, t);
    }
  };
  for (const k of Object.keys(ah)) walk(ah[k] && ah[k].divisions, '');
  const byRegion = new Map(circuit);
  const names = [];
  for (const [ids, name, t] of nodes) {
    const label = short.get(t) || t;
    for (const id of ids) if (!byRegion.has(id)) byRegion.set(id, label);
    const bare = name.replace(/(府|州|县|厅|卫|所|司|道|路|军)$/, '');
    if (bare.length >= 2) names.push([bare, label]);
  }
  names.sort((x, y) => y[0].length - x[0].length);
  placeCache = { key, byRegion, names };
  return placeCache;
}
function placeOf(c) {
  const P = places();
  const hit = P.byRegion.get(String(c.mapRegionId || c.regionId || ''));
  if (hit) return hit;
  const loc = String(c.location || '');
  const m = loc ? P.names.find(([n]) => loc.includes(n)) : null;
  return m ? m[1] : '';
}
// 驿路告急：内核记在 GM._routeDisruptions，未平者
export function routeAlerts() {
  return (G()._routeDisruptions || []).filter((d) => d && !d.resolved).map((d) => ({ route: d.route || [d.from, d.to].filter(Boolean).join('—'), reason: d.reason || '' }));
}
const routeBlocked = (loc) => { const f = fn('_ltIsRouteBlocked'); return f ? !!f(capital(), loc) : false; };
const lateTurns = () => { const f = fn('_hyTurnsForMonths'); return f ? f(1) : 1; };

// 远方人物：在世、非玩家、不在京（在京者内核会剔除，宜召对面陈）；附各人的未读、来函、在途、失踪之数
export function contacts() {
  const g = G();
  const me = player(g);
  const myFaction = me ? me.faction : '';
  const cap = capital();
  const late = lateTurns();
  const cnt = {};
  const bump = (name) => cnt[name] || (cnt[name] = { unread: 0, fresh: 0, transit: 0, lost: 0 });
  for (const l of g.letters || []) {
    if (!l) continue;
    if (l.from && l.from !== '玩家' && !l._playerRead) { const c = bump(l.from); c.unread++; if (l.status === 'returned') c.fresh++; }
    if (l.to && l.from === '玩家') {
      const c = bump(l.to);
      if (l.status === 'traveling' || l.status === 'replying') c.transit++;
      if (l.status === 'intercepted' || (l.status === 'traveling' && g.turn > l.deliveryTurn + late)) c.lost++;
    }
  }
  const out = [];
  for (const c of g.chars || []) {
    if (!c || c.alive === false || c.isPlayer || !c.name) continue;
    const atCap = !c.location || same(c.location, cap);
    if (atCap && !c._travelTo) continue;
    const foreign = !!(myFaction && c.faction && c.faction !== myFaction);
    const region = foreign ? c.faction : placeOf(c);
    const travel = c._travelTo ? (typeof c._travelTo === 'string' ? c._travelTo : c._travelTo.toLocation || '') : '';
    out.push({
      id: c.id, name: c.name, title: c.officialTitle || c.title || c.role || '', location: c.location || '', portrait: c.portrait || '',
      group: region || (foreign ? '外方' : '四方'), foreign, travel, travelDays: c._travelRemainingDays > 0 ? c._travelRemainingDays : 0,
      blocked: routeBlocked(c.location), ...(cnt[c.name] || { unread: 0, fresh: 0, transit: 0, lost: 0 })
    });
  }
  return out;
}
// 密使人选：在京、在世、非玩家
export function agents() {
  const cap = capital();
  return (G().chars || []).filter((c) => c && c.alive !== false && !c.isPlayer && (!c.location || same(c.location, cap)))
    .map((c) => ({ name: c.name, title: c.officialTitle || c.title || '' }));
}

// ---------- 往来书札 ----------
const URG = Object.fromEntries(URGENCY.map(([k, l]) => [k, l]));
const dateOf = (turn) => { const f = fn('getTSText'); return f && turn != null ? f(turn) : turn != null ? `第${turn}回合` : ''; };
function view(l) {
  const g = G();
  const out = l.from === '玩家';
  const inFlight = !out && l.status === 'traveling';
  const lost = l.status === 'intercepted' || (l.status === 'traveling' && g.turn > l.deliveryTurn + lateTurns());
  const suspects = g._letterSuspects || [];
  const replied = (l.status === 'returned' || l.status === 'intercepted_forging') && !!l.reply && out;
  const st = fn('_ltGetStatusText');
  const showStatus = ['traveling', 'delivered', 'replying', 'blocked', 'intercepted', 'intercepted_forging', 'recalled'].includes(l.status);
  return {
    id: l.id, out, from: l.from, to: l.to, typeKey: l.letterType || 'personal', type: typeLabel(l.letterType || 'personal'),
    urgency: URG[l.urgency] || '驿递', cipher: l._cipher && l._cipher !== 'none' ? label('LETTER_CIPHERS', l._cipher) || '' : '',
    token: l._tokenUsed ? label('LETTER_TOKENS', l._tokenUsed) : '',
    mode: l._sendMode === 'secret_agent' ? `密使${l._agentName ? '·' + l._agentName : ''}` : l._sendMode === 'multi_courier' ? '多路' : '',
    multi: l._multiRecipients || 0, date: dateOf(l.sentTurn), day: typeof l._sentDay === 'number' ? l._sentDay : (l.sentTurn || 0) * 1000,
    content: inFlight ? '' : String(l.content || ''), inFlight,
    reply: replied ? String(l.reply) : '', replyDate: replied ? dateOf(l.replyTurn || g.turn) : '',
    suspected: replied && suspects.includes(l.id), forged: !!l._forgedRevealed,
    status: l.status || '', statusText: showStatus && st ? st(l) : '', lost,
    unread: !out && !l._playerRead, starred: !!l._starred, plan: !!l.npcPlanId, local: !!l._localActivity,
    can: {
      bypass: l.status === 'blocked' && out,
      recall: l.status === 'traveling' && out && !l._recallSent,
      resend: (l.status === 'intercepted' || l.status === 'intercepted_forging') && out && !l._resendIssued,
      suspect: replied && !suspects.includes(l.id),
      verify: replied,
      reply: !out && l.status === 'returned' && !!l._npcInitiated && !l._playerReplied && !l._localActivity,
      excerpt: !out && l.status === 'returned' && !!l._npcInitiated
    }
  };
}
export function thread(name) {
  return (G().letters || []).filter((l) => l && (l.to === name || l.from === name)).map(view).sort((a, b) => a.day - b.day);
}
export function letter(id) {
  const l = (G().letters || []).find((x) => x && x.id === id);
  return l ? view(l) : null;
}
// 截获的他人密函（内核在推演里记的 NPC 私下往来），近五个月
export function intercepted() {
  const g = G();
  const f = fn('_hyTurnsForMonths');
  const span = f ? f(5) : 5;
  return (g._npcCorrespondence || []).filter((c) => c && g.turn - c.turn <= span)
    .map((c) => ({ from: c.from || '', to: c.to || '', date: dateOf(c.turn), content: String(c.content || c.summary || ''), implication: c.implication || '' })).reverse();
}
export function unreadTotal() {
  return (G().letters || []).filter((l) => l && l.from !== '玩家' && !l._playerRead && l.status !== 'traveling').length;
}
// 读过：来函一经摊开即算已读（在途者不算——信使未到）
export function markRead(id) {
  const l = (G().letters || []).find((x) => x && x.id === id);
  if (l && l.from !== '玩家' && l.status !== 'traveling') l._playerRead = true;
}

// 计划来函（npcPlanId）的回应选项：随事项所处阶段而变（照老面板 _ltReplyToNpc）
export function planChoices(id) {
  const g = G();
  const l = (g.letters || []).find((x) => x && x.id === id);
  if (!l || !l.npcPlanId) return null;
  const ledger = w.TM && w.TM.NPC && w.TM.NPC.ActionLedger;
  const plan = (g._npcPlans || []).find((p) => p && p.id === l.npcPlanId);
  const me = player(g);
  const v = plan && me && ledger && typeof ledger.planView === 'function' ? ledger.planView(plan, me) : null;
  if (v && v.nextPhase === 'perform') return [['deliver', '提交文书']];
  if (v && v.nextPhase === 'feedback') return [['ack', '已收到'], ['satisfied', '有助于事项'], ['unsatisfied', '需要改进']];
  return [['accept', '接受'], ['reject', '拒绝'], ['conditions', '提出条件'], ['defer', '延期'], ['partial', '部分答应']];
}

// ---------- 拟稿（按收信人存本机，换局作废） ----------
const KEY = 'tm_ui_letter_draft';
const stamp = () => `${G().sid || ''}@${w._tmLoadGen || 0}`;
function drafts() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.stamp === stamp()) return d.by || {}; } catch (_e) { /* 读不出当空 */ }
  return {};
}
export function draft(name) { return drafts()[name] || ''; }
export function setDraft(name, text) {
  const by = drafts();
  if (text) by[name] = text; else delete by[name];
  try { localStorage.setItem(KEY, JSON.stringify({ stamp: stamp(), by })); } catch (_e) { /* 存不下就只在内存 */ }
}

// ---------- 遣使 ----------
// opts：{ content, targets, urgency, letterType, cipher, sendMode, agent, replyingTo, planChoice }。
// 内核成败都以 toast 告知（总线 kernel:toast）；这里按 GM.letters 是否新增（计划来函则看原函是否已回应）判成败
export function send(opts) {
  const f = fn('sendLetter');
  if (!f) throw new Error('内核缺 sendLetter');
  const g = G();
  const before = (g.letters || []).length;
  const orig = opts.replyingTo ? (g.letters || []).find((x) => x && x.id === opts.replyingTo) : null;
  f({ ...opts });
  const added = (G().letters || []).length - before;
  const ok = added > 0 || !!(orig && orig.npcPlanId && orig._playerReplied);
  if (ok) for (const t of opts.targets || []) setDraft(t, '');
  return { ok, count: added };
}

// ---------- 信上动作（老面板同名函数，不读 DOM） ----------
function call(name, ...args) {
  const f = fn(name);
  if (!f) throw new Error('内核缺 ' + name);
  return f(...args);
}
export const act = {
  recall: (id) => call('_ltRecall', id),
  bypass: (id) => call('_ltBypassBlock', id),
  resend: (id, mode) => call('_ltResend', id, mode),
  suspect: (id) => call('_ltSuspect', id),
  verify: (id) => call('_ltVerify', id),
  star: (id) => call('_ltStar', id),
  excerpt: (id) => call('_ltExcerptToEdict', id)      // 读页面上的划选
};
