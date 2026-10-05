// 载入：一方朱印「春秋」、一道金线由中间向两边长、一行小字报步（研墨、张灯、展图……）。
import { h } from '../core/dom.js';
import { sealCanvas, loadFonts } from '../kit/brush.js';

export function loadingScreen(root) {
  const seal = h('div.seal');
  const bar = h('i');
  const cap = h('div.cap', '');
  const sub = h('div.sub', '');
  const el = h('div.scr.scr-load', h('div.box', seal, h('div.line', bar), cap, sub));
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
