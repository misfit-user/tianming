// 问天：玩家与推演 AI 直接对话（局外）——指令解读、确认入库、直改数值、改写诏令、天意至高。老流程在 tm-game-loop.js
// （openWentian / _wtSend / _wtShowPendingConfirmation / _wtConfirmPending）与 tm-game-loop-wentian-hardchange.js（直改引擎、导入、清空、撤销）。
// 状态：GM._playerDirectives（在册指令）、GM._importedMemories（注入记忆）、GM._wentianHistory（对话）、window._wtPending（待确认的解读）。
// 老函数读写几个固定元素（#wt-input 输入、#wt-chat 历史与「解读中」气泡、#wt-mem-target/#wt-mem-content 注入记忆），
// 老弹层不开：这里在画外备一个影子宿主装这几个元素，替它填、读；#wt-chat 一变（老函数重绘历史、查证进度）就发 wentian:changed。
// 「改写诏令」一类：老函数直接填进老诏令框，而新前端的诏书草稿在推演前才写进那里、会盖掉它——这里改填进新前端的诏书草稿。
// 清空对话、清除指令自带 window.confirm：新前端已先问过，代答「是」。
import { bus } from '../core/bus.js';
import * as edict from './edict.js';
import { claimOverlays } from './kernel.js';

const w = window;
const G = () => w.GM || {};
const $ = (id) => document.getElementById(id);
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
function call(name, ...args) {
  const f = fn(name);
  if (!f) throw new Error('内核缺 ' + name);
  return f(...args);
}

// 分类：键同内核 _wtForceCategory
export const CATS = [
  ['', '自动', '由推演 AI 判定'], ['narrative', '叙事', '保护某人、促成某事、约束 AI 行为'], ['setting', '设定', '注入背景或状态'],
  ['hardChange', '直改', '立即写入具体字段'], ['edictSubstitute', '诏令', '改写为诏令草稿'], ['absolute', '天意', '世界法则强制生效，无推辞']
];
const CAT_META = {
  narrative: ['叙事控制', '注入下回合推演，令 AI 叙事时遵从'], setting: ['世界设定', '作为剧本背景注入'],
  hardChange: ['直改数值', '立即写入 GM/P 具体字段'], edictSubstitute: ['该走诏令', '已改写为诏令草稿，确认即填入诏书草稿'],
  absolute: ['天意·至高', '世界法则直接生效，AI 无推辞，必字面落实']
};
const TYPE = { rule: '持久规则', correction: '纠正', content: '背景补充', directive: '一次性指令' };
const CHANNEL = { pol: ['political', '政事'], mil: ['military', '军事'], dip: ['diplomatic', '外交'], eco: ['economic', '经济'], oth: ['other', '其他'] };
const CONFIRM = { absolute: '降下天意', hardChange: '立即写入', edictSubstitute: '填入诏令' };

// ---------- 影子宿主 ----------
claimOverlays((n) => n.id === 'tm-wentian-shadow');
let host = null, mo = null, raf = 0;
function ensureHost() {
  if (host && host.isConnected) return host;
  host = document.createElement('div');
  host.id = 'tm-wentian-shadow';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-300vw;top:0;width:900px;height:600px;opacity:0;pointer-events:none;';
  host.innerHTML = '<textarea id="wt-input"></textarea><div id="wt-chat"></div><div id="wt-cat-bar"></div><input id="wt-mem-target"><textarea id="wt-mem-content"></textarea>';
  document.body.append(host);
  mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; bus.emit('wentian:changed', {}); }); });
  mo.observe($('wt-chat'), { childList: true, subtree: true, characterData: true });
  return host;
}
const changed = () => bus.emit('wentian:changed', {});

// ---------- 读 ----------
function statusOf(d) {
  if (d._lastStatus === 'followed') return ['ok', '已遵'];
  if (d._lastStatus === 'partial') return ['mid', '部分'];
  if (d._lastStatus === 'ignored') return ['bad', `忽略×${d._ignoredCount || 1}`];
  if (d._lastStatus === 'unchecked') return ['dim', '未核'];
  return ['new', '新录'];
}
export function snapshot() {
  const g = G();
  const undoOn = !!(w.P && w.P.conf && w.P.conf.wentianUndo === true);
  const directives = (g._playerDirectives || []).map((d, i) => {
    const [tone, status] = statusOf(d);
    const s = d.structured || {};
    return {
      i, id: d.id, turn: d.turn, text: String(d.content || ''), kind: TYPE[d.type] || '指令', absolute: !!d._absolute, category: d.category || '',
      tone, status, reason: d._lastReason || '', evidence: d._lastEvidence || '', checkTurn: d._lastCheckTurn,
      structured: [['对象', s.target], ['动作', s.action], ['范围', s.scope], ['禁', s.forbidden]].filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(' · '),
      watch: d._watchClosed ? '已核销' : d._watch && d._watch.items && d._watch.items.length ? `对账${d._watch.items.length}` : '',
      stale: d._lastStatus === 'ignored' && (d._ignoredCount || 0) >= 3,
      canUndo: undoOn && !!d._undoSnapshot && !d._undone && g.turn === d._undoSnapshot.turn
    };
  });
  const memories = (g._importedMemories || []).map((m, i) => ({ i, title: String(m.title || '').slice(0, 40) || String(m.content || '').slice(0, 40), type: m.type || '', target: m.target || '' }));
  const history = (g._wentianHistory || []).map((x, i) => ({ i, me: x.role === 'player', text: String(x.content || '') }));
  const thinking = $('wt-thinking');
  return {
    directives, memories, history,
    thinking: thinking ? (thinking.textContent || '').replace(/\s+/g, ' ').trim() : '',
    pending: pendingOf(), category: w._wtForceCategory || '', hasAi: !!(w.P && w.P.ai && w.P.ai.key)
  };
}
function pendingOf() {
  const p = w._wtPending;
  if (!p) return null;
  const cat = CAT_META[p.category] || CAT_META.narrative;
  const s = p.structured || {};
  const list = p.hardChanges && p.hardChanges.length ? p.hardChanges : p.hardChange && p.hardChange.path ? [p.hardChange] : [];
  const changes = (p.category === 'hardChange' || p.category === 'absolute') ? list.filter((hc) => hc && hc.path).map((hc) => {
    let dr = hc._dryRun;
    if (!dr && fn('_wtDryRunHardChange')) { try { const d0 = w._wtDryRunHardChange(hc.path); dr = d0 ? { ok: !!d0.ok, reason: d0.reason || '' } : null; } catch (_e) { dr = null; } }
    const ghost = dr && !dr.ok && p.category !== 'absolute' && /实体名解析失败/.test(String(dr.reason || ''));
    return { path: hc.path, op: hc.op || 'set', value: String(hc.value), note: hc.note ? String(hc.note).slice(0, 30) : '',
      ok: dr ? dr.ok : null, reason: dr && !dr.ok ? (p.category === 'absolute' ? `天意造物：${dr.reason || '将创建新字段'}` : `确认后将被拒：${dr.reason || '解析不到真实字段'}`) : '',
      ghost: ghost ? '问天不造新实体·新人物请走诏令征召引入' : '' };
  }) : [];
  const ch = CHANNEL[p.edictChannel] || CHANNEL.pol;
  return {
    category: p.category, label: cat[0], hint: cat[1], kind: TYPE[p.type] || p.type || '', forced: !!p._forcedByPlayer, absolute: p.category === 'absolute',
    interpretation: p.interpretation || '', plan: p.plan || '', ambiguity: p.ambiguity || [],
    structured: [['对象', s.target], ['动作', s.action], ['范围', s.scope], ['禁', s.forbidden], ['评判', s.measurable], ['条件', s.condition]].filter(([, v]) => v),
    changes, trace: p._agentTrace || [], operations: (p.operations || []).map((op) => op.reason || p.interpretation || '游戏内容修改'),
    edict: p.category === 'edictSubstitute' && p.edictText ? { label: `诏令草稿·${ch[1]}`, text: p.edictText } : null,
    clarify: p.clarify && p.clarify.question && Array.isArray(p.clarify.options) ? { question: String(p.clarify.question), options: p.clarify.options.slice(0, 4).map(String) } : null,
    confirm: CONFIRM[p.category] || '确认入库'
  };
}

// ---------- 动作 ----------
export function setCategory(cat) {
  ensureHost();
  if (fn('_wtPickCat')) w._wtPickCat(cat || '');
  else w._wtForceCategory = cat || '';
}
export async function send(text, cat) {
  const v = String(text || '').trim();
  if (!v) throw new Error('先写下要问的话');
  if (w._wtPending) throw new Error('上一条尚待确认或取消');
  ensureHost();
  if (!G()._playerDirectives) G()._playerDirectives = [];
  if (!G()._importedMemories) G()._importedMemories = [];
  if (!G()._wentianHistory) G()._wentianHistory = [];
  setCategory(cat);
  $('wt-input').value = v;
  const r = call('_wtSend');
  changed();
  await r;
  changed();
}
function needPending() {
  if (!w._wtPending) throw new Error('无待确认之事');
  return w._wtPending;
}
export function confirm() {
  const p = needPending();
  ensureHost();
  if (p.category === 'edictSubstitute' && p.edictText) {
    if (p._world && (p._world !== w.GM || p.turn !== G().turn)) throw new Error('当前存档或回合已改变，请重新核对这条问天指令');
    const [key, label] = CHANNEL[p.edictChannel] || CHANNEL.pol;
    const d = edict.draft();
    edict.setDraft({ [key]: d[key] && d[key].trim() ? `${d[key].trimEnd()}\n${p.edictText}` : p.edictText });
    if (!G()._wentianHistory) G()._wentianHistory = [];
    G()._wentianHistory.push({ role: 'system', content: `✉︎ 诏令已填入诏书草稿·${label}栏：「${p.edictText}」` });
    w._wtPending = null;
    if (fn('toast')) w.toast('诏令草稿已填入');
    changed();
    return;
  }
  call('_wtConfirmPending');
  changed();
}
export function promote() { needPending(); ensureHost(); const r = call('_wtPromoteAbsolute'); changed(); return r; }
export function revise() {
  needPending();
  ensureHost();
  call('_wtReviseFromPending');
  const v = ($('wt-input') || {}).value || '';
  changed();
  return v;
}
export function cancel() { needPending(); call('_wtCancelPending'); changed(); }
export async function clarify(i) { needPending(); ensureHost(); const r = call('_wtClarifyPending', i); changed(); await r; changed(); }
export function removeDirective(i) { const a = G()._playerDirectives || []; if (a[i]) a.splice(i, 1); changed(); }
export function removeMemory(i) { const a = G()._importedMemories || []; if (a[i]) a.splice(i, 1); changed(); }
export function undo(id) { call('_wtUndoHardChange', id); changed(); }
// 导入文档（同老 _wtImportDoc 落账）
export function importDoc(name, text) {
  const g = G();
  if (!g._importedMemories) g._importedMemories = [];
  g._importedMemories.push({ title: name, content: text, type: 'document', turn: g.turn });
  if (!g._wentianHistory) g._wentianHistory = [];
  g._wentianHistory.push({ role: 'player', content: `【导入文档】${name} (${Math.round(text.length / 1000)}KB)`, turn: g.turn });
  g._wentianHistory.push({ role: 'system', content: '✅ 文档已导入为推演上下文。AI将在推演时参考此文档内容。' });
  changed();
}
export function importMemory(target, content) {
  if (!String(content || '').trim()) throw new Error('请输入记忆内容');
  ensureHost();
  $('wt-mem-target').value = target || '';
  $('wt-mem-content').value = content;
  call('_wtDoImportMemory');
  changed();
}
function withYes(f) {
  const ask = w.confirm;
  w.confirm = () => true;
  try { return f(); } finally { w.confirm = ask; }
}
export function clearChat() { ensureHost(); withYes(() => call('_wtClearChatLog')); changed(); }
export function clearDirectives() { ensureHost(); withYes(() => call('_wtClearDirectives')); changed(); }
export function open() { ensureHost(); setCategory(w._wtForceCategory || ''); if (fn('_wtRenderHistory')) w._wtRenderHistory(); return snapshot(); }
