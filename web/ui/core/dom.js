// 新前端的 DOM 小工具。
// 界面上的字很多来自 AI 推演，一律走 textContent，不拼 innerHTML。
// h('div.q-qi.panel', { title: '…', onclick }, '字', child, [更多子节点]) → HTMLElement

const PROP_KEYS = new Set(['value', 'checked', 'disabled', 'hidden', 'tabIndex', 'id', 'title', 'lang', 'dir']);

export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k.startsWith('--')) el.style.setProperty(k, v);
    else if (PROP_KEYS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// 换掉一个节点的全部子节点
export function replaceChildren(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// 样式表只装一次（组件各自带一小段样式时用）
const installed = new Set();
export function installStyle(id, css) {
  if (installed.has(id)) return;
  installed.add(id);
  document.head.append(h('style', { 'data-ui': id }, css));
}
