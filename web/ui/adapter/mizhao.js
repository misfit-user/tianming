// 独召密问（时政「独召密问」）：择几位在侧之臣、一桩待议之事，诸臣依次流式进言（初两轮，每垂询一次再续两轮），
// 可归总「建言要点」择一入议事清册，可划选一段摘入；退下时内核记入 NPC 记忆、纪事（mode:mizhao）与起居注。
// 老流程在 tm-shizheng-panel.js（openMiZhaoPicker → _mzProceed → _openMiZhaoDialogue），这里做「镜」，与朝议同一手法：
// 老弹层照建（挪到画外，见 screens/mizhao.css），盯住 #mz-dlg-body 读成实录，新画面的垂询、要点、退下替它按老钮。
// 认的老标识：#mizhao-picker（选人选题层，开了即由 _mzProceed 收掉）、#mizhao-dialog（#mz-dlg-body 发言、#mz-dlg-input 垂询、
// #mz-send-btn），#mz-summary-panel（#mz-summary-body 下每人一块：mz-sum-* 归纳、*-act 显出即可纳入）。
import { bus } from '../core/bus.js';
import { claimOverlays } from './kernel.js';
import { suggest } from './edict.js';

const w = window;
const G = () => w.GM || {};
const $ = (id) => document.getElementById(id);
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const OWN = ['mizhao-picker', 'mizhao-dialog', 'mz-summary-panel'];
claimOverlays((n) => OWN.includes(n.id));

// 可召：与玩家同在一地、在世在任、无羁绊（同老选人层）
export function candidates() {
  const g = G();
  const here = typeof w._getPlayerLocation === 'function' ? w._getPlayerLocation() : g._capital || '京师';
  const same = typeof w._isSameLocation === 'function' ? w._isSameLocation : (a, b) => a === b;
  return (g.chars || []).filter((c) => {
    if (!c || c.isPlayer || c.alive === false) return false;
    if (c.imprisoned || c.exiled || c.retired || c.mourning || c.fled || c.missing || c._travelTo) return false;
    if (!same(c.location || here, here)) return false;
    return !!(c.officialTitle || c.title);
  }).sort((a, b) => ((b.importance || 0) + (b.loyalty || 0) * 0.15) - ((a.importance || 0) + (a.loyalty || 0) * 0.15))
    .map((c) => ({ name: c.name, title: c.officialTitle || c.title || '', party: c.party || '', portrait: c.portrait || '' }));
}
export function issues() {
  const ts = typeof w.getTSText === 'function' ? w.getTSText : null;
  return (G().currentIssues || []).filter((i) => i && i.status !== 'resolved').sort((a, b) => (b.raisedTurn || 0) - (a.raisedTurn || 0))
    .map((i) => ({ id: String(i.id), title: i.title || '', date: i.raisedDate || (ts ? String(ts(i.raisedTurn || 1)) : `第${i.raisedTurn || 1}回合`) }));
}

// ---------- 读 ----------
function entries() {
  const body = $('mz-dlg-body');
  if (!body) return [];
  const d = w._mzDlg;
  const live = d && d.speaking ? `mz-reply-${(d.slotIdx || 1) - 1}` : '';
  return [...body.children].map((el, i) => {
    const reply = el.querySelector('[id^="mz-reply-"]');
    if (reply) {
      const meta = clean((el.querySelector('span') || {}).textContent).replace(/^·\s*/, '');
      const text = clean(reply.textContent);
      return { id: reply.id, role: 'them', name: clean((el.querySelector('b') || {}).textContent), title: meta.split('·')[0].trim(), round: (meta.match(/第(\d+)/) || [])[1] || '',
        text, streaming: reply.id === live };
    }
    const right = el.style && el.style.textAlign === 'right';
    // 老气泡给君上之言冠了「陛下曰：」，新画面自有「上曰」
    return { id: `mz-${i}`, role: right ? 'me' : 'note', text: right ? clean(el.textContent).replace(/^(陛下|朕)\s*曰?\s*[:：]?\s*/, '') : clean(el.textContent) };
  }).filter((e) => e.text || e.role === 'them');
}
function summaryOf() {
  const body = $('mz-summary-body');
  if (!body || !$('mz-summary-panel')) return null;
  return [...body.querySelectorAll('[id^="mz-sum-"]')].filter((x) => !/-act$/.test(x.id)).map((x) => {
    const block = x.parentElement;
    const act = $(`${x.id}-act`);
    return { id: x.id, name: clean((block.querySelector('b') || {}).textContent), text: clean(x.dataset.summary || x.textContent),
      ready: !!(act && act.style.display !== 'none'), picked: !!(act && /已\s*纳/.test(act.textContent)) };
  });
}
export function snapshot() {
  const d = w._mzDlg;
  const dlg = $('mizhao-dialog');
  if (!d || !dlg) return { open: false };
  const inp = $('mz-dlg-input');
  return {
    open: true, issue: { id: String(d.issue && d.issue.id || ''), title: d.issue && d.issue.title || '', desc: String(d.issue && d.issue.description || '') },
    chars: (d.chars || []).map((c) => ({ name: c.name, title: c.officialTitle || c.title || '', party: c.party || '', said: ((d.perMinisterReplies || {})[c.name] || []).length })),
    entries: entries(), speaking: !!d.speaking, canAsk: !!(inp && !inp.disabled), summary: summaryOf()
  };
}

// ---------- 盯 ----------
let mo = null, raf = 0;
function emit() {
  raf = 0;
  const s = snapshot();
  bus.emit('mizhao:changed', s);
  if (!s.open) stop();
}
function watch() {
  if (mo) return;
  mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(emit); });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'disabled'] });
}
function stop() {
  if (mo) mo.disconnect();
  mo = null;
  bus.emit('mizhao:closed', {});
}

// ---------- 动作 ----------
export function open(names, issueId) {
  if (typeof w.openMiZhaoPicker !== 'function' || typeof w._mzProceed !== 'function') throw new Error('内核缺独召密问');
  if (!names.length) throw new Error('未择一臣');
  if (!issueId) throw new Error('未择议题');
  w.openMiZhaoPicker(issueId);
  const st = w._mzState;
  if (!st) { const pk = $('mizhao-picker'); if (pk) pk.remove(); throw new Error('选人层未开'); }
  st.selectedChars = names.slice();
  st.selectedIssue = issueId;
  watch();
  w._mzProceed();
  if (!$('mizhao-dialog')) { stop(); throw new Error('议题已失效或无可召之臣'); }
  return snapshot();
}
export function ask(text) {
  const d = w._mzDlg;
  if (!d) throw new Error('密问已散');
  if (d.speaking) throw new Error('诸臣奏对中，稍候');
  const inp = $('mz-dlg-input');
  if (!inp) throw new Error('密问已散');
  inp.disabled = false;
  inp.value = String(text || '').trim();
  if (!inp.value) return;
  w._mzSendQuery();
}
export function showSummary() {
  const d = w._mzDlg;
  if (!d) throw new Error('密问已散');
  if (d.speaking) throw new Error('诸臣奏对中，稍候');
  if (!Object.values(d.perMinisterReplies || {}).some((l) => l && l.length)) throw new Error('尚无进言可归');
  w._mzShowSummary();
}
export function closeSummary() { const p = $('mz-summary-panel'); if (p) p.remove(); }
export function pick(id, name) {
  if (typeof w._mzPickToEdict !== 'function') throw new Error('内核缺 _mzPickToEdict');
  w._mzPickToEdict(id, name);
}
// 划选摘入：同老「划入」的写法（source 独召·划选）
export function excerpt(text, who) {
  const d = w._mzDlg;
  const t = String(text || '').trim();
  if (!t) throw new Error('请先划选一段大臣发言');
  suggest('独召·划选', who || '独召群臣', (d && d.issue && d.issue.title) || '议题', t.slice(0, 800));
  return t.length;
}
export function end() {
  if (typeof w._mzEndDialogue !== 'function') throw new Error('内核缺 _mzEndDialogue');
  const d = w._mzDlg;
  if (d && d.speaking) throw new Error('诸臣奏对中，稍候');
  closeSummary();
  w._mzEndDialogue();
}
