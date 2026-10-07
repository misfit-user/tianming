// 科议：科举诸事（筹办开科、礼部议题、改制、弊案……）付在京诸臣公议。老流程在 tm-keju-runtime-keyi.js：
// openKeyiSession 召集在京在任之臣、择六人上台，自动流式议两轮（可插圣谕、再议一轮），付表决（AI 推众臣立场），陛下裁决
// （依议／下诏强推／逆众议强推／暂缓），按议题回调落地。状态全在全局 KEYI_STATE，这里照它读；老弹层 #keyi-modal 照建、
// 挪到画外（screens/keyi.css），流式中的半句只在老气泡里（#<_streamId> .keyi-bubble-text），从那里读。
// openKeyiSession 自带一问 window.confirm（人数、议题、耗精力十五）：换成新前端的卷——先空跑一遍取问话（代答「否」，内核此前无副作用），
// 发 keyi:ask，玩家应允后再真开（代答「是」）。弊案议政按「真开了才出队」记账：应允真开后由这里把那桩弊案出队。
import { bus } from '../core/bus.js';
import { claimOverlays, legacyMutation } from './kernel.js';

const w = window;
const G = () => w.GM || {};
const S = () => w.KEYI_STATE || null;
const $ = (id) => document.getElementById(id);
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
claimOverlays((n) => n.id === 'keyi-modal');

export const STANCE = { support: '赞成', oppose: '反对', abstain: '观望' };

// ---------- 读 ----------
function speechText(sp) {
  if (!sp._streaming) return String(sp.line || '');
  const el = sp._streamId && $(sp._streamId);
  const t = el && el.querySelector('.keyi-bubble-text');
  const v = clean(t && t.textContent);
  return v === '…' ? '' : v;
}
function libu() {
  try { return typeof w._kejuQueryLibuStance === 'function' ? w._kejuQueryLibuStance() : null; } catch (_e) { return null; }
}
export function snapshot() {
  const st = S();
  if (!st || !$('keyi-modal')) return { open: false };
  const stances = st.stances || {};
  const lastSaid = {};
  for (const sp of st.speeches || []) if (!sp._isPlayer && !sp._streaming) lastSaid[sp.name] = sp.stance || 'abstain';
  const bd = st._breakdown || {};
  const base = Math.round(((st._topicThreshold || 0.5) * 100));
  const lb = libu();
  const threshold = st._threshold != null ? st._threshold : lb === 'support' ? Math.max(30, base - 20) : lb === 'oppose' ? Math.min(85, base + 20) : base;
  const labels = typeof w._keyiMethodLabels === 'function' ? w._keyiMethodLabels(st._topicType || 'kaike') : {};
  return {
    open: true, title: String(st._topicTitle || '科议').replace(/^科?议[·・]/, ''), type: st._topicType || 'kaike', phase: st.phase, round: st.round || 1,
    busy: !!st._busy, busyText: st._busyText || '', discussDone: !!st._discussDone,
    attendees: (st.attendees || []).length,
    speakers: (st.speakers || []).map((a) => ({ name: a.name, title: a.title || '', party: a.party || '',
      stance: (stances[a.name] && stances[a.name].stance) || lastSaid[a.name] || '', said: (st.speeches || []).filter((x) => x.name === a.name && !x._streaming).length })),
    speeches: (st.speeches || []).map((sp, i) => ({ id: sp._streamId || `ky-${i}`, me: !!sp._isPlayer, name: sp.name, title: sp.title || '',
      stance: sp._streaming ? '' : sp.stance || 'abstain', text: speechText(sp), streaming: !!sp._streaming })),
    vote: st.phase === 'discuss' ? null : {
      done: !!st._voteDone, progress: Math.round(st._voteProgress || 0),
      support: bd.support || 0, oppose: bd.oppose || 0, abstain: bd.abstain || 0, total: bd.total || 0,
      pct: Math.round((st.support || 0) * 100), threshold, passed: st._passed != null ? !!st._passed : Math.round((st.support || 0) * 100) >= threshold,
      libu: lb === 'support' ? '礼部支持' : lb === 'oppose' ? '礼部反对' : '礼部无态',
      list: Object.keys(stances).map((k) => ({ name: k, stance: stances[k].stance || 'abstain', reason: stances[k].reason || '' }))
    },
    methods: { council: labels.council || '依议', edict: labels.edict || '下诏强推', defy: labels.defy || '逆众议强推' }
  };
}

let mo = null, raf = 0;
function emit() {
  raf = 0;
  const s = snapshot();
  if (!s.open) { stop(); return; }
  bus.emit('keyi:changed', s);
}
function watch() {
  if (mo) return;
  mo = new MutationObserver((list) => { if (!raf && legacyMutation(list)) raf = requestAnimationFrame(emit); });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  emit();
}
function stop() {
  if (mo) mo.disconnect();
  mo = null;
  bus.emit('keyi:closed', {});
}

// ---------- 开议：先问后开 ----------
let bypass = false;
function openReal(orig, args) {
  const ask = w.confirm;
  w.confirm = () => true;
  bypass = true;
  let r;
  try { r = orig.apply(w, args); } finally { w.confirm = ask; bypass = false; }
  if (r === true) {
    // 弊案议政：内核只在真开时出队；这里先代它问过、它见的是「未开」，真开了就由这里出队
    const opts = args[0];
    const data = opts && typeof opts === 'object' ? opts.topicData : null;
    const sc = G().keju && G().keju._scandal;
    if (opts && opts.topicType === 'scandal' && sc && Array.isArray(sc.spawned)) {
      const i = sc.spawned.indexOf(data);
      if (i >= 0) sc.spawned.splice(i, 1);
    }
    watch();
  }
  return r;
}
function install() {
  const orig = w.openKeyiSession;
  if (typeof orig !== 'function' || orig.__newui) return;
  const wrapped = function (...args) {
    if (bypass) return orig.apply(this, args);
    let msg = '';
    const ask = w.confirm;
    w.confirm = (m) => { msg = String(m || ''); return false; };
    let r;
    try { r = orig.apply(this, args); } finally { w.confirm = ask; }
    if (!msg) return r;                              // 人不足三、已有科议在开：内核自会提示
    const people = (msg.match(/召集\s*(\d+)/) || [])[1] || '';
    const topic = (msg.match(/「([^」]+)」/) || [])[1] || '';
    bus.emit('keyi:ask', { message: msg, people: Number(people) || 0, topic, accept: () => openReal(orig, args) });
    return false;
  };
  wrapped.__newui = true;
  w.openKeyiSession = wrapped;
}
install();
bus.on('kernel:ready', install);

// ---------- 议中动作 ----------
function need() {
  const st = S();
  if (!st) throw new Error('科议已散');
  return st;
}
export function speak(text) {
  const st = need();
  const v = String(text || '').trim();
  if (!v) throw new Error('请先写下圣谕');
  if (st.phase !== 'discuss') throw new Error('已付表决');
  const inp = $('keyi-player-input');
  if (!inp) throw new Error('议席未开');
  inp.value = v;
  return w._keyiPlayerSpeak();
}
export function extraRound() {
  const st = need();
  if (st._busy) throw new Error('诸臣议论中，稍候');
  return w._keyiExtraRound();
}
export function toVote() {
  const st = need();
  if (st._busy) throw new Error('诸臣议论中，稍候');
  return w._keyiProceedToVote();
}
export function toDecide() { need(); w._keyiProceedToDecide(); }
export function decide(method) {
  const st = need();
  if (st.phase !== 'decide') { w._keyiProceedToDecide(); }
  w._keyiConfirmStart(method);
}
export function shelve() { need(); w._keyiAbort(); }
export function isOpen() { return !!(S() && $('keyi-modal')); }
