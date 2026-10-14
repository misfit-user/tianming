// 载入：一方朱印「春秋」、一道金线由中间向两边长、一行小字报步（研墨、张灯、展图……）。
import { h } from '../core/dom.js';
import { sealCanvas, loadFonts } from '../kit/brush.js';

// veil：半透的一层，压在书房上（开局、启封时用），书房隐约还在
export function loadingScreen(root, { veil = false } = {}) {
  const seal = h('div.seal');
  const bar = h('i');
  const cap = h('div.cap', '');
  const sub = h('div.sub', '');
  const el = h('div.scr.scr-load' + (veil ? '.veil' : ''), h('div.box', seal, h('div.line', bar), cap, sub));
  root.append(el);
  loadFonts({ 'TM-Seal': '春秋', 'TM-WenKai': '研墨张灯展图启卷就绪' }).then(() => {
    seal.style.backgroundImage = `url(${sealCanvas({ chars: ['春', '秋'], style: 'zhu', w: 144, seed: 11 }).toDataURL()})`;
  });
  return {
    set(text, k) {
      cap.textContent = text;
      if (typeof k === 'number') bar.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 22)}rem`;
    },
    sub(text) { sub.textContent = text || ''; },
    async done() {
      el.classList.add('out');
      await new Promise((r) => setTimeout(r, 950));
      el.remove();
    }
  };
}

// 开局、启封这几段长等（读剧本到开场白、临朝到落座、启封旧卷）：内核要独占主线程好一阵，原先画面就僵在那里、点了像没点。
// 铺一层墨幕，报内核的进度（showLoading 转来的 kernel:loading）；painted 等这一帧真画出来，再把主线程交给内核
export function cover(root, game, cap, sub = '') {
  const ld = loadingScreen(root, { veil: true });
  ld.set(cap, 0.04);
  ld.sub(sub);
  loadFonts({ 'TM-WenKai': cap + sub }).catch(() => { /* 字未到就用楷体垫着 */ });
  const off = game.on('kernel:loading', ({ text, pct }) => {
    if (text) ld.sub(text);
    if (pct != null) ld.set(cap, Math.max(0.04, pct / 100));
  });
  const painted = new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let closed = false;
  return { painted, done: () => { if (closed) return Promise.resolve(); closed = true; off(); return ld.done(); } };
}
