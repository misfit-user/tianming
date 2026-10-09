// 钉选臣僚：玩家想盯着的人。存本机 localStorage 的 tm_phase8_pinned_people（与老正式界面同一键，两边钉的人互通）；
// 不进存档、不写内核。键取人物 id，没有 id 的取名；查时 id、名都认。变了发 pins:changed。
import { bus } from './bus.js';

const KEY = 'tm_phase8_pinned_people';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(Boolean).map(String) : [];
  } catch (_e) {
    return [];
  }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set(list)])); } catch (_e) { /* 存不下就只这一回有效 */ }
  bus.emit('pins:changed', {});
}
const keyOf = (p) => String((p && (p.id || p.name)) || p || '');

export function pinned(p) {
  const list = load();
  return !!p && (list.includes(keyOf(p)) || (p.name && list.includes(String(p.name))));
}
export function togglePin(p) {
  const list = load();
  const keys = [keyOf(p), p && p.name ? String(p.name) : ''].filter(Boolean);
  const on = keys.some((k) => list.includes(k));
  save(on ? list.filter((k) => !keys.includes(k)) : [...list, keys[0]]);
  return !on;
}
// 按钉选在前排序（稳定：其余次序不变）
export function pinnedFirst(list) {
  const keys = new Set(load());
  if (!keys.size) return list;
  const hit = (c) => keys.has(String(c.id || '')) || keys.has(String(c.name || ''));
  return [...list.filter(hit), ...list.filter((c) => !hit(c))];
}
