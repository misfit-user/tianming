// 提示条：内核的 toast 一律改成一张纸签，从顶上淡入、数秒后淡出；同一句话连发只留一张。内核话里夹的阿拉伯数字照记数设置写；程序报错的英文原话换成中文（core/plain.js）。
import { h } from '../core/dom.js';
import { numText } from '../core/numerals.js';
import { plainError } from '../core/plain.js';

export function installToasts(root, game) {
  const box = h('div.toasts');
  root.append(box);
  const recent = new Map();
  game.on('kernel:toast', ({ text }) => {
    if (!text) return;
    const now = performance.now();
    if (recent.has(text) && now - recent.get(text) < 2500) return;
    recent.set(text, now);
    const slip = h('div', numText(plainError(text)));
    box.append(slip);
    setTimeout(() => slip.remove(), 4300);
    while (box.children.length > 3) box.firstChild.remove();
  });
}
