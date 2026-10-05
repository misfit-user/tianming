// 签条：悬停提示。元素上写 data-tiao="正文"（可加 data-tiao-title="题"），或用 tiao(el, { title, text })。
// 全页只有一张签条，跟着指针走，靠近屏边时翻到另一侧。
import { h, overlayHost } from '../../core/dom.js';

let slip = null;
let current = null;
let showTimer = 0;

function ensure() {
  if (!slip) {
    slip = h('div.q-tiao', { role: 'tooltip' });
    overlayHost().append(slip);
  }
  return slip;
}

function contentOf(el) {
  if (el._tiao) return typeof el._tiao === 'function' ? el._tiao() : el._tiao;
  return { title: el.dataset.tiaoTitle, text: el.dataset.tiao };
}

function place(x, y) {
  const r = slip.getBoundingClientRect();
  const pad = 14;
  let left = x + pad, top = y + pad + 6;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - pad;
  slip.style.left = `${Math.max(8, left)}px`;
  slip.style.top = `${Math.max(8, top)}px`;
}

function show(el, x, y) {
  const c = contentOf(el);
  if (!c || (!c.text && !c.title)) return;
  ensure();
  slip.replaceChildren(c.title ? h('b', c.title) : '', c.text || '');
  place(x, y);
  slip.classList.add('on');
}

function hide() {
  clearTimeout(showTimer);
  current = null;
  slip?.classList.remove('on');
}

export function tiao(el, content) {
  el._tiao = content;
  return el;
}

export function installTiao(root = document) {
  root.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-tiao],[data-tiao-title]') || findTiao(e.target);
    if (!el || el === current) return;
    current = el;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => current === el && show(el, e.clientX, e.clientY), 380);
  });
  root.addEventListener('pointermove', (e) => { if (current && slip?.classList.contains('on')) place(e.clientX, e.clientY); });
  root.addEventListener('pointerout', (e) => { if (current && !current.contains(e.relatedTarget)) hide(); });
  root.addEventListener('pointerdown', hide);
}

function findTiao(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) if (n._tiao) return n;
  return null;
}
