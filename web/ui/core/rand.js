// 可复现的随机数：同一个种子每次画出的纸纹、印泥斑驳都一样（截图回归要稳定）
export function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 字符串 → 种子（同一个名字的器物总是同一种斑驳）
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
