// 召对（「见」一渠道的问对部分）：召见名单、开一场问对、发话（流式）、仪式、屏退、差遣、交办、摘入、对质、赏罚、纳谏、使节决断、退下。
// 内核（tm-wendui.js）一场问对要靠它自己建的弹窗（#wendui-modal）才走得下去：发话函数读其中的语气与输入框，
// 流式回话、旁注（疲态、屏退、似有隐情、仪式）都往其中的聊天区写。新前端下那张弹窗照样建出来、只是藏着；
// 这里替它填输入、按发话，再盯着它的聊天区，把流式回话与旁注实时转给新画面（总线 audience:stream / audience:note）。
// 落定的对话一律以 GM.wenduiHistory 为准。赏罚、差遣等落账函数不读 DOM，直接调；差遣读两个输入框，临时补隐形的给它读。
import { bus } from '../core/bus.js';

const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
function call(name, ...args) {
  const f = fn(name);
  if (!f) throw new Error('内核缺 ' + name);
  return f(...args);
}
const $ = (id) => document.getElementById(id);
const findChar = (name) => (fn('findCharByName') ? w.findCharByName(name) : (G().chars || []).find((c) => c && c.name === name)) || null;

export const TONES = [['direct', '直问', '开门见山'], ['probing', '旁敲侧击', '迂回探问'], ['pressing', '施压逼问', '令其惶恐，易露实情'], ['flattering', '虚与委蛇', '示以宽和，令其松懈'], ['silence', '沉默以对', '不发一言，审视其人']];
export const MODES = [['formal', '朝堂问对', '起居注官在侧，言皆入档'], ['private', '私下叙谈', '屏退左右，可言私事']];
export const CEREMONIES = { formal: [['seat', '赐座'], ['stand', '不赐座']], private: [['tea', '赐茶'], ['wine', '赐酒'], ['none', '直入正题']] };
export const REWARDS = [['gold', '赐金', '忠+5·耗内帑'], ['robe', '赐衣', '忠+3·威望+1'], ['feast', '赐宴', '忠+4·压力-10'], ['promote', '加官', '录入议事清册']];
export const PUNISHES = [['fine', '罚俸', '忠-3'], ['demote', '降职', '录入议事清册'], ['cane', '杖责', '忠-8·压力+15'], ['imprison', '下狱', '忠-15·压力+30·入狱']];
export const DEADLINES = [1, 2, 3, 5, 8];

// ---------- 召见名单 ----------
const sideOf = (c) => { const f = fn('_wdIsPlayerSideChar'); return f ? !!f(c) : !!c && c.alive !== false && !c.isPlayer; };
const atCourt = (c) => { const f = fn('_wdIsAtCapital'); return f ? !!f(c) : true; };
const agenda = (c) => { const f = fn('_wdDeriveAudienceAgenda'); try { return f ? f(c) : null; } catch (_e) { return null; } };
const owedLetter = (c) => (G().letters || []).some((l) => l && l._npcInitiated && l.from === c.name && l._replyExpected && !l._playerReplied && l.status === 'returned');
const card = (c) => ({ name: c.name, title: c.officialTitle || c.title || '', portrait: c.portrait || '', loyalty: Math.round(Number(c.loyalty) || 50), party: c.party || '',
  consort: !!(fn('_wdIsPlayerConsort') && w._wdIsPlayerConsort(c)), met: !!((G().wenduiHistory || {})[c.name] || []).length });
// 阶下待见（使节、外藩、特请）、有臣求见、在朝诸臣、远方（只能传书）——照老名册的分法
export function roster() {
  const g = G();
  try { if (fn('_wdPrepareAudienceRenderState')) w._wdPrepareAudienceRenderState(); } catch (_e) { /* 清洗失败不碍列名 */ }
  const pending = (g._pendingAudiences || []).filter((q) => q && q.name).map((q) => ({ qid: q._qid || '', name: q.name, reason: String(q.reason || ''), envoy: !!q.isEnvoy, faction: q.fromFaction || '' }));
  const people = (g.chars || []).filter((c) => c && sideOf(c));
  const here = people.filter(atCourt);
  const away = people.filter((c) => !atCourt(c));
  const seeking = here.filter((c) => {
    if (c.isPlayer || c._mourning || c._lastMetTurn === g.turn || c._lastAudienceDeniedTurn === g.turn) return false;
    const a = agenda(c);
    return !!(a && a.seek) || owedLetter(c);
  });
  const reasonOf = (c) => {
    if (owedLetter(c)) return '前日来函未获回复，亲至求见';
    const a = agenda(c);
    if (a && a.brief) return a.brief;
    if ((c.stress || 0) > 60) return '面带忧色，似有为难之事';
    if ((c.loyalty || 50) > 90 && (c.stress || 0) > 30) return '神色凝重，欲进忠言';
    if ((c.ambition || 50) > 80) return '精神抖擞，欲呈策论';
    return '候于殿外，请求面圣';
  };
  return {
    pending,
    seeking: seeking.map((c) => ({ ...card(c), reason: reasonOf(c) })),
    court: here.filter((c) => !seeking.includes(c)).map(card),
    away: away.map((c) => ({ name: c.name, title: c.officialTitle || c.title || '', location: c.location || '', travel: typeof c._travelTo === 'string' ? c._travelTo : (c._travelTo && c._travelTo.toLocation) || '' }))
  };
}
export function canAudience(name) {
  const c = findChar(name);
  const f = fn('_wdCanDirectAudience');
  return !!(c && (f ? f(c) : true));
}
export const dismissQueue = (qid) => call('_wdDismissPending', qid);
export const deny = (name) => call('_wdDenyAudience', name);

// ---------- 一场问对 ----------
let watcher = null;
function watch() {
  unwatch();
  const chat = $('wd-modal-chat');
  if (!chat) return;
  let raf = 0;
  const flushStream = () => {
    raf = 0;
    const s = $('wd-stream-text');
    if (s) bus.emit('audience:stream', { text: s.textContent || '' });
  };
  watcher = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1 || r.target !== chat) continue;
        const cls = String(n.className || '');
        if (n.id === 'wd-stream-active' || n.id === 'wd-ceremony' || /wendui-player/.test(cls)) continue;
        // 另一枚 NPC 气泡（不是流式那枚）：对质者当庭之言
        if (/wendui-npc/.test(cls)) {
          const who = ((n.querySelector('.wendui-npc-name') || {}).textContent || '').replace(/·对质.*$/, '').trim();
          const said = ((n.querySelector('.wendui-npc-bubble') || {}).textContent || '').trim();
          if (who && said) bus.emit('audience:aside', { who, text: said });
          continue;
        }
        if (/wendui-msg/.test(cls)) continue;
        const text = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) bus.emit('audience:note', { text });
      }
    }
    if (!raf) raf = requestAnimationFrame(flushStream);
  });
  watcher.observe(chat, { childList: true, subtree: true, characterData: true });
}
function unwatch() {
  if (watcher) watcher.disconnect();
  watcher = null;
}
// 开场：内核先过诸关（不在京、下狱、精力不足……不过关时以 toast 说明，并可能转去传书），过了才建弹窗、设 GM.wenduiTarget
function opened(name) {
  if (G().wenduiTarget !== name || !$('wendui-modal')) return false;
  watch();
  bus.emit('audience:open', { name });
  return true;
}
export function open(name, mode = 'formal') {
  call('openWenduiModal', name, mode);
  return opened(name);
}
// 有臣求见：接见即正式问对，且由对方先开口（内核稍候即流式说出来意）
export function openSeeking(name) {
  call('_wdOpenAudience', name);
  return opened(name);
}
// 阶下待见：使节等（内核为使节临时立人）
export function openQueue(qid) {
  const q = (G()._pendingAudiences || []).find((x) => x && x._qid === qid);
  call('_wdOpenAudienceQueue', qid);
  return q ? opened(q.name) : false;
}

// 这一场的情形
export function session() {
  const g = G();
  const name = g.wenduiTarget;
  if (!name) return null;
  const c = findChar(name) || {};
  const st = (g._wdState || {})[name] || {};
  let counterable = false;
  try {
    const N = w.TM && w.TM.Negotiation;
    const cs = c._negotiationId && N && N.get ? N.get(c._negotiationId) : null;
    counterable = !!(cs && cs.status === 'open' && cs.round < N.MAX_ROUND);
  } catch (_e) { counterable = false; }
  const chat = $('wd-modal-chat');
  const recap = chat && chat.firstElementChild && !/wendui-msg/.test(chat.firstElementChild.className || '') && /上次问对要点/.test(chat.firstElementChild.textContent || '') ? chat.firstElementChild.textContent : '';
  return {
    name, mode: w._wenduiMode || 'formal', title: c.officialTitle || c.title || '', portrait: c.portrait || '', loyalty: Math.round(Number(c.loyalty) || 50),
    emotion: st.emotion || 3, turns: st.turns || 0, ceremony: !!$('wd-ceremony'), screened: !!w._wdScreened, sending: !!w._wenduiSending,
    envoy: !!(c._envoy || c.fromFaction), faction: c.fromFaction || c.faction || '', mission: c.envoyMission || '', counterable,
    topics: [...document.querySelectorAll('#wd-topics button')].map((b) => b.textContent.trim()).filter(Boolean),
    recap: recap.replace(/^上次问对要点：/, ''), greeting: greetingIn(chat),
    confronters: Array.isArray(w._wdConfronters) ? w._wdConfronters.slice() : []
  };
}
// 开场白：内核开场时随机生成、只画进它的聊天区首个气泡（不入史），从那里读
function greetingIn(chat) {
  const b = chat && chat.querySelector('.wendui-npc .wendui-npc-bubble');
  if (!b) return '';
  const copy = b.cloneNode(true);
  copy.querySelectorAll('.wd-ts').forEach((x) => x.remove());
  return (copy.textContent || '').trim();
}
// 落定的往来（最近 60 条）
export function transcript(name = G().wenduiTarget) {
  const all = ((G().wenduiHistory || {})[name] || []).filter(Boolean);
  const shown = all.slice(-60);
  return {
    elided: all.length - shown.length,
    rows: shown.map((m) => ({
      role: m.role === 'player' ? 'me' : m.role === 'system' ? 'note' : 'them',
      text: String(m.content || ''), loyaltyDelta: Number(m.loyaltyDelta) || 0, tone: m.toneEffect ? String(m.toneEffect) : '',
      suggestions: (Array.isArray(m.suggestions) ? m.suggestions : []).map((s) => (typeof s === 'string' ? s : s && s.content ? (s.topic ? `〔${s.topic}〕${s.content}` : s.content) : s && s.text ? s.text : '')).filter(Boolean),
      confront: m._confrontWith || ''
    }))
  };
}

// 发话：替内核填语气与输入框，再按它的发话（异步，流式回话期间经总线 audience:stream 推送）
export async function say(text, tone = 'direct') {
  const toneEl = $('wd-tone'), input = $('wd-modal-input');
  if (!toneEl || !input) throw new Error('问对未开');
  if (w._wenduiSending) throw new Error('对方尚在回话');
  toneEl.value = tone;
  input.value = tone === 'silence' ? '' : String(text || '');
  bus.emit('audience:stream', { text: '' });
  await call('sendWendui');
  bus.emit('audience:settled', { name: G().wenduiTarget });
}
export const ceremony = (type) => call('_wdCeremony', type);
export const toggleScreen = () => call('_wdToggleScreen');
export const reward = (type) => call('_wdDoReward', type);
export const punish = (type) => call('_wdDoPunish', type);
export const adopt = () => call('_wdAdoptCounsel');
export const excerpt = () => call('_wdAddToEdict');           // 读页面上的划选
export const envoy = (kind) => call('_wdEnvoyDecision', kind);
export const counter = () => call('_wdEnvoyCounter');          // 回价：内核自开一卷（老通用弹窗，经兜底挪进新前端）
// 面谕差遣：内核读 #wd-order-task 与 #wd-order-deadline，临时补两个隐形的
export function order(task, deadline = 3) {
  const made = [];
  const put = (id, value, tag) => {
    let el = $(id);
    if (!el) { el = document.createElement(tag); el.id = id; el.style.display = 'none'; document.body.append(el); made.push(el); }
    if (tag === 'select' && !el.querySelector(`option[value="${value}"]`)) el.append(new Option(String(value), String(value)));
    el.value = String(value);
  };
  try {
    put('wd-order-task', task, 'textarea');
    put('wd-order-deadline', deadline, 'select');
    return !!call('_wdDoDirectOrder');
  } finally {
    made.forEach((el) => el.remove());
  }
}
// 交办：内核按承办中、逾期、已复命、失诺分好的四堆
export function commitments() {
  const f = fn('_wdCommitBuckets');
  const b = f ? f() : { active: [], overdue: [], done: [], failed: [] };
  const turn = G().turn || 0;
  const label = (c) => { try { return w.TM && w.TM.ImperialOrders ? w.TM.ImperialOrders.label(c) : ''; } catch (_e) { return ''; } };
  const row = (r, kind) => {
    const c = r.c || {};
    const due = (Number(c.assignedTurn) || 0) + (c.deadline || 3);
    return { kind, name: r.nm, task: String(c.task || ''), progress: Math.max(0, Math.min(100, parseInt(c.progress, 10) || 0)), left: due - turn, status: label(c),
      promise: c.npcPromise ? String(c.npcPromise) : '', feedback: c.feedback ? String(c.feedback) : '', reason: c._failReason ? String(c._failReason) : '' };
  };
  return { overdue: b.overdue.map((r) => row(r, 'overdue')), active: b.active.map((r) => row(r, 'active')), done: b.done.slice(-10).map((r) => row(r, 'done')), failed: b.failed.slice(-10).map((r) => row(r, 'failed')) };
}
// 对质：可召入者（在朝、本方、非当前对象、未在场）；最多三人
export function confrontable() {
  const g = G();
  const cur = g.wenduiTarget;
  const here = Array.isArray(w._wdConfronters) ? w._wdConfronters : [];
  const can = fn('_wdCanDirectAudience');
  let list = (g.chars || []).filter((c) => c && c.alive !== false && c.name !== cur && !here.includes(c.name) && (can ? can(c) : true));
  if (w._wenduiMode === 'cedui') list = list.filter((c) => (c.loyalty || 50) >= 60);
  return list.slice(0, 20).map((c) => ({ name: c.name, title: c.title || c.officialTitle || '', loyalty: Math.round(Number(c.loyalty) || 50) }));
}
export const confront = (name) => call('_wdAddConfronter', name);
// 退下：内核收场（它的收场函数已在 kernel.js 接了一道，发 audience:closed）
export function close() {
  if (G().wenduiTarget || $('wendui-modal')) call('closeWenduiModal');
  else bus.emit('audience:closed', {});
}
bus.on('audience:closed', unwatch);
