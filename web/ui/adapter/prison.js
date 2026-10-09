// 狱中问对：召对一位下狱者时，内核（tm-wendui-prison.js）先弹原生 confirm「确认赴诏狱?」，再挂一层居中的 #wd-prison-modal
// ——不铺满，新前端下隐形，玩家点了确认就再无下文。这里接过来：
//   · 赴狱前的提示改由新前端的卷来问（WenduiPrison.openPrompt 包一层，问过再代答内核的 confirm）；
//   · 狱中那一层认领下来、照建照藏，名目与六动作、代价读内核导出的 WenduiPrison.ACTIONS，问答读 GM.wenduiPrisonHistory；
//   · 动作转点老层的钮，文字先写进老层的输入框（内核从那里取话）；有代价的动作新前端先问过，内核那道 confirm 代答。
// 释放、赦免后内核 1.5 秒自撤老层，这里随之发 prison:closed。
import { bus } from '../core/bus.js';
import { claimOverlays } from './kernel.js';

const w = window;
const P = () => w.WenduiPrison;
const G = () => w.GM || {};
let current = null;          // { name, node, mo }

function charOf(name) {
  return typeof w.findCharByName === 'function' ? w.findCharByName(name) : null;
}
function info(name) {
  const ch = charOf(name) || {};
  const p = P();
  return {
    name,
    reason: ch._imprisonReason || '原因不详',
    held: Math.max(0, (G().turn || 0) - (ch._imprisonedTurn || 0)),
    health: typeof ch.health === 'number' ? Math.round(ch.health) : 80,
    visitsTurn: p ? p._turnVisitCount(name) : 0,
    visitsTotal: p ? p._totalVisits(name) : 0,
    imprisoned: !!(ch._imprisoned || ch.imprisoned)
  };
}
// 代答内核的原生 confirm（新前端已先问过）
function withYes(fn) {
  const conf = w.confirm;
  w.confirm = () => true;
  try { return fn(); } finally { w.confirm = conf; }
}

// ---------- 赴狱前 ----------
function installPrompt() {
  const p = P();
  if (!p || typeof p.openPrompt !== 'function' || p.openPrompt.__newui) return;
  const orig = p.openPrompt;
  const wrapped = function (charName) {
    const args = arguments;
    const self = this;
    const i = info(charName);
    if (i.visitsTurn >= 2) return orig.apply(self, args);       // 过密：内核自以提示告知
    bus.emit('prison:prompt', { ...i, proceed: () => withYes(() => orig.apply(self, args)) });
  };
  wrapped.__newui = true;
  p.openPrompt = wrapped;
}
installPrompt();
bus.on('kernel:ready', installPrompt);

// ---------- 狱中 ----------
claimOverlays((n) => {
  if (n.id !== 'wd-prison-modal') return false;
  attach(n);
  return true;
});
function attach(node) {
  if (current && current.mo) current.mo.disconnect();
  const head = node.firstElementChild ? node.firstElementChild.textContent : '';
  const m = /【诏狱】\s*(\S+)/.exec(head || '');
  const name = m ? m[1].replace(/罪名.*$/, '') : (G().wenduiTarget || '');
  const mo = new MutationObserver(() => {
    if (!node.isConnected) { detach(); return; }
    bus.emit('prison:changed', { name });
  });
  mo.observe(node, { childList: true, subtree: true, characterData: true });
  // 老层被撤（退出、释放后自撤）：盯 body 的子节点
  const gone = new MutationObserver(() => { if (!node.isConnected) detach(); });
  gone.observe(document.body, { childList: true });
  current = { name, node, mo, gone };
  bus.emit('prison:open', { name });
}
function detach() {
  if (!current) return;
  const { name, mo, gone } = current;
  mo.disconnect();
  gone.disconnect();
  current = null;
  bus.emit('prison:closed', { name });
}

// 此刻狱中的情形：其人、六动作（不含自由对话）、问答
export function session() {
  if (!current) return null;
  const p = P();
  const acts = p && p.ACTIONS ? Object.keys(p.ACTIONS).filter((k) => k !== 'chat').map((k) => {
    const a = p.ACTIONS[k];
    const e = a.effects || {};
    return { key: k, label: a.label, desc: a.desc, energy: a.energy || 0, confirm: !!a.requiresConfirm, release: !!a.clearImprisoned,
      effects: { minxin: e.minxin || 0, huangwei: e.huangwei || 0, loyalty: e.loyalty || 0, health: e.health || 0 } };
  }) : [];
  const chat = p && p.ACTIONS && p.ACTIONS.chat ? { energy: p.ACTIONS.chat.energy || 0 } : { energy: 0 };
  const log = ((G().wenduiPrisonHistory || {})[current.name] || []).map((x) => ({ role: x.role || '', tag: x.tag || '', text: String(x.content || '') }));
  const last = log[log.length - 1];
  return { ...info(current.name), acts, chat, log, waiting: !!(last && last.role === 'sovereign') };
}
// 行一动作（key 为 chat 即自由对话）；text 为旁白或话语
export function act(key, text) {
  if (!current) return false;
  const node = current.node;
  const input = node.querySelector('#wd-prison-input');
  if (input) input.value = String(text || '');
  const btn = key === 'chat' ? node.querySelector('#wd-prison-send') : node.querySelector(`.wdp-btn[data-action="${key}"]`);
  if (!btn) return false;
  withYes(() => btn.click());
  return true;
}
export function leave() {
  if (!current) return;
  const b = current.node.querySelector('#wd-prison-close');
  if (b) b.click(); else current.node.remove();
}
export const opened = () => !!current;
