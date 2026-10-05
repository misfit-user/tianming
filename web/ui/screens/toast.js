// 提示条：内核的 toast 一律改成一张纸签，从顶上淡入、数秒后淡出；同一句话连发只留一张。
import { h } from '../core/dom.js';

export function installToasts(root, game) {
  const box = h('div.toasts');
  root.append(box);
  const recent = new Map();
  game.on('kernel:toast', ({ text }) => {
    if (!text) return;
    const now = performance.now();
    if (recent.has(text) && now - recent.get(text) < 2500) return;
    recent.set(text, now);
    const slip = h('div', text);
    box.append(slip);
    setTimeout(() => slip.remove(), 4300);
    while (box.children.length > 3) box.firstChild.remove();
  });
}
