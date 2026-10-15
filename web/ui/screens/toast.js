// 提示条：内核的 toast 一律改成一张纸签，从顶上淡入、数秒后淡出；同一句话连发只留一张。内核话里夹的阿拉伯数字照记数设置写。
import { h } from '../core/dom.js';
import { numText } from '../core/numerals.js';

// 程序报错（适配层查不到内核某函数、内核里的运行时错）不把英文原话亮给玩家：纸签上写一句中文，原话记到控制台。
// 前头有中文引子（「未成：」「召对未成：」）的照留。服务商回的话（HTTP 401、模型名）不在此列，照原样，玩家要凭它查密钥
const MISSING = /内核缺\s*[\w.$]+/;
const RUNTIME = /\b(?:TypeError|ReferenceError|RangeError|SyntaxError)\b|Cannot (?:read|set) propert|is not (?:a function|defined|iterable)|Maximum call stack|\[object Object\]/;
function plain(text) {
  const s = String(text);
  const missing = MISSING.test(s);
  if (!missing && !RUNTIME.test(s)) return s;
  console.warn('[提示条] 程序报错原话：', s);
  const lead = /^([^A-Za-z]*[\u4e00-\u9fff][^A-Za-z]*?[：:])/.exec(s);
  const why = missing ? '游戏内核未备此项' : '内核出了差错';
  return `${lead ? lead[1] + why : `此事没有办成，${why}`}（原话记在控制台）`;
}

export function installToasts(root, game) {
  const box = h('div.toasts');
  root.append(box);
  const recent = new Map();
  game.on('kernel:toast', ({ text }) => {
    if (!text) return;
    const now = performance.now();
    if (recent.has(text) && now - recent.get(text) < 2500) return;
    recent.set(text, now);
    const slip = h('div', numText(plain(text)));
    box.append(slip);
    setTimeout(() => slip.remove(), 4300);
    while (box.children.length > 3) box.firstChild.remove();
  });
}
