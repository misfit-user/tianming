// 整套界面的尺度：html 字号随窗口定，界面一律用 rem，于是整页等比缩放。
// 以 1920×1080 为准（1rem = 16px）；取宽高两向较紧的那一个。窄高的手机横屏另走 compact 版式。

const BASE_W = 1920, BASE_H = 1080;
let current = { k: 1, compact: false };
const listeners = new Set();

function measure() {
  const w = window.innerWidth, h = window.innerHeight;
  const compact = h < 560;                    // 手机横屏、很矮的窗口
  const floor = compact ? 0.62 : 0.68;
  const k = Math.max(floor, Math.min(2.2, Math.min(w / BASE_W, h / BASE_H)));
  return { k, compact, w, h };
}

function apply() {
  current = measure();
  const root = document.documentElement;
  root.style.fontSize = (16 * current.k).toFixed(3) + 'px';
  root.dataset.layout = current.compact ? 'compact' : 'full';
  listeners.forEach((fn) => fn(current));
}

export function installViewport() {
  apply();
  window.addEventListener('resize', apply);
  return current;
}

export function viewport() {
  return current;
}

export function onViewport(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// rem → 像素（给场景层定位 DOM 小签用）
export const rem = (n) => n * 16 * current.k;
