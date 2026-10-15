// 报错话的中文化：程序报错（适配层查不到内核某函数、内核里的运行时错）不把英文原话亮给玩家，写一句中文，原话记到控制台。
// 前头有中文引子（「未成：」「召对未成：」）的照留。服务商回的话（HTTP 401、模型名）不在此列，照原样，玩家要凭它查密钥
const MISSING = /内核缺\s*[\w.$]+/;
const RUNTIME = /\b(?:TypeError|ReferenceError|RangeError|SyntaxError)\b|Cannot (?:read|set) propert|is not (?:a function|defined|iterable)|Maximum call stack|\[object Object\]/;
export function plainError(text) {
  const s = String(text);
  const missing = MISSING.test(s);
  if (!missing && !RUNTIME.test(s)) return s;
  console.warn('[新前端] 程序报错原话：', s);
  const lead = /^([^A-Za-z]*[\u4e00-\u9fff][^A-Za-z]*?[：:])/.exec(s);
  const why = missing ? '游戏内核未备此项' : '内核出了差错';
  return `${lead ? lead[1] + why : `此事没有办成，${why}`}（原话记在控制台）`;
}
