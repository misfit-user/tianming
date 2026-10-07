// 诏书（「令」一渠道，元首档）：草稿、议事清册、帝王私行、已颁之诏、往期诏令档案、有司润色。
// 内核过回合时从老界面五个诏令框（#edict-pol/mil/dip/eco/oth）与行止框（#xinglu-pub）读诏令（tm-endturn-prep.js _endTurn_collectInput），
// 读之前还会先把「正式草稿」同步进这些框。老界面每次重绘都整个重建这些框，所以新前端不拿它们当存稿处：
// 草稿存本机（按剧本、回合、读档代次，换局即作废），推演前一刻才写进去（inject），并先清掉正式草稿免得旧稿回灌。
const w = window;
const G = () => w.GM || {};

export const CATS = [['political', 'edict-pol', '政令'], ['military', 'edict-mil', '军令'], ['diplomatic', 'edict-dip', '外交'], ['economic', 'edict-eco', '经济'], ['other', 'edict-oth', '其他']];
const KEY = 'tm_ui_edict_draft';
const stamp = () => `${G().sid || ''}@${G().turn || 0}@${w._tmLoadGen || 0}`;
const empty = () => ({ political: '', military: '', diplomatic: '', economic: '', other: '', xinglu: '' });

export function draft() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.stamp === stamp()) return { ...empty(), ...d.text };
  } catch (_e) { /* 读不出就当空稿 */ }
  return empty();
}
export function setDraft(patch) {
  const next = { ...draft(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify({ stamp: stamp(), text: next })); } catch (_e) { /* 本机存不下：只在本页内存里 */ }
  return next;
}
export function clearDraft() {
  try { localStorage.removeItem(KEY); } catch (_e) { /* 无妨 */ }
}
export function hasAny(d = draft()) {
  return Object.values(d).some((v) => String(v || '').trim());
}

// 老界面的框不在（还没重绘出来）就补一个隐形的，内核照样读得到（官制任命等也经此读写政令框）
export function legacyInput(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('textarea');
    el.id = id;
    el.dataset.newuiEdict = '1';
    el.style.display = 'none';
    document.body.append(el);
  }
  return el;
}
export function inject() {
  const d = draft();
  const bridge = w.TMPhase8FormalBridge;
  try { if (bridge && typeof bridge.clearEdictDrafts === 'function') bridge.clearEdictDrafts(); } catch (_e) { /* 清不掉不碍：正式草稿为空时不会回灌 */ }
  for (const [key, id] of CATS) legacyInput(id).value = d[key] || '';
  legacyInput('xinglu-pub').value = d.xinglu || '';
  return d;
}

// 诏书起首：按剧本朝代——明清「奉天承运 皇帝诏曰」，唐宋制书「门下」，其余「诏曰」
export function header() {
  const P = w.P || {};
  const sc = typeof w.findScenarioById === 'function' ? w.findScenarioById(G().sid) : null;
  const dyn = String((sc && (sc.dynasty || sc.era)) || P.dynasty || '');
  if (/明|清/.test(dyn)) return ['奉天承運', '皇帝詔曰'];
  if (/唐|宋/.test(dyn)) return ['門下'];
  return ['詔曰'];
}

// 议事清册：奏疏、问对、朝议等处摘来、尚未用过的建言
export function suggestions() {
  return (G()._edictSuggestions || []).map((s, i) => ({ i, source: s.source || '', from: s.from || '', content: String(s.content || s.text || ''), turn: s.turn, used: !!s.used, topic: s.topic || '' }))
    .filter((s) => !s.used && s.content);
}
export function useSuggestion(i) {
  const s = (G()._edictSuggestions || [])[i];
  if (s) s.used = true;
}

// 帝王私行：至多三项（TyrantActivitySystem 自己管上限并提示）
export function privateActs() {
  const defs = w.TYRANT_ACTIVITIES || [];
  const sel = (w.TyrantActivitySystem && w.TyrantActivitySystem.selectedActivities) || [];
  return defs.map((a) => ({ id: a.id, name: a.name || a.id, category: a.category || '', desc: a.desc || '', on: sel.includes(a.id) }));
}
export function togglePrivate(id) {
  if (!w.TyrantActivitySystem || typeof w.TyrantActivitySystem.toggle !== 'function') throw new Error('内核缺 TyrantActivitySystem');
  w.TyrantActivitySystem.toggle(id);
}

// 本回合已颁行的整篇诏书（有司润色后「颁行天下」者），会整体并入推演
export function promulgated() {
  const turn = G().turn;
  return (Array.isArray(G().edicts) ? G().edicts : []).filter((e) => e && e.turn === turn && e.status === 'promulgated').map((e) => ({ id: e.id, text: String(e.text || ''), style: e.styleLabel || '' }));
}

// 往期诏令档案：已下诏令的执行情况
const STATUS = { pending: '待办', executing: '施行中', partial: '部分施行', obstructed: '受阻', completed: '已成', failed: '未成', pending_delivery: '驿递中', cancelled: '已罢' };
export function archive(limit = 80) {
  const turn = G().turn;
  return (G()._edictTracker || []).filter((e) => e && e.turn < turn).slice(-limit).reverse().map((e) => ({
    turn: e.turn, category: e.category || '', content: String(e.content || ''), status: STATUS[e.status] || e.status || '', feedback: String(e.feedback || ''),
    progress: typeof e.progressPercent === 'number' ? e.progressPercent : null, assignee: e.assignee || ''
  }));
}

// 有司润色：借老面板的流程（它从诏令框取字、等 AI、把结果写进 #edict-polished-text），取回润色稿给新前端改；
// 颁行或入档时把改定的字放回去再调它的 _applyPolishedEdict。没有密钥时内核直接把合并稿当润色稿
export const STYLES = [['elegant', '典雅骈文'], ['concise', '简洁明快'], ['ornate', '华丽文藻'], ['plain', '白话文言']];
export async function polish(style = 'elegant') {
  if (typeof w._polishEdicts !== 'function') throw new Error('内核缺 _polishEdicts');
  inject();
  const sel = document.getElementById('edict-polish-style');
  if (sel) sel.value = style;
  await w._polishEdicts();
  const ta = document.getElementById('edict-polished-text');
  return ta ? String(ta.value || '') : '';
}
export function applyPolished(text, mode) {
  const ta = document.getElementById('edict-polished-text');
  if (!ta || typeof w._applyPolishedEdict !== 'function') throw new Error('润色稿已失，请重新润色');
  ta.value = text;
  w._applyPolishedEdict(mode === 'keep' ? 'keep' : 'replace');
}
