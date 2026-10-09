// 可为：对一个人（或一处、一事）能做什么——照 CK3 右键人物弹出的交互单：按门类分组，做不了的灰着并写明差什么，
// 有代价的把代价写在后头。点外头、按 Esc、滚轮、窗口变化都收起。同一时刻只开一张。
// kewei({ title, sub, x, y, groups: [{ label, items: [{ label, cost, off: '缘由', note, onclick }] }] }) → close()
import { h } from '../../core/dom.js';

let current = null;
// Esc 只收这张单，别让底下的册页、书案（暂停、起身）跟着走：监听在模块载入时就挂上，排在各页之前
window.addEventListener('keydown', (e) => {
  if (!current || e.key !== 'Escape') return;
  e.stopImmediatePropagation();
  e.preventDefault();
  current();
}, true);

export function kewei({ title, sub = '', x, y, groups }) {
  if (current) current();
  const host = document.getElementById('tm-newui-root') || document.body;
  const shown = (groups || []).filter((g) => g && g.items && g.items.length);
  const el = h('div.q-kewei', { role: 'menu', 'aria-label': title },
    h('header', h('b', title), sub ? h('small', sub) : null),
    shown.map((g) => h('section',
      h('h4', g.label),
      g.items.map((it) => h('button' + (it.off ? '.off' : ''), {
        type: 'button', role: 'menuitem', 'aria-disabled': it.off ? 'true' : 'false', title: it.off || it.note || '',
        onclick: () => { if (it.off) return; close(); it.onclick(); }
      }, h('span', it.label), it.cost ? h('em', it.cost) : null, it.off ? h('small', it.off) : null)))));
  host.append(el);
  // 落在指针右下；出界就翻到左边、上边
  const r = el.getBoundingClientRect();
  const left = x + r.width + 12 > innerWidth ? Math.max(8, x - r.width - 4) : x + 4;
  const top = y + r.height + 12 > innerHeight ? Math.max(8, innerHeight - r.height - 12) : y + 4;
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  requestAnimationFrame(() => el.classList.add('on'));

  const away = (e) => { if (!el.contains(e.target)) close(); };
  setTimeout(() => {
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('resize', close);
  }, 0);
  function close() {
    if (current !== close) return;
    current = null;
    window.removeEventListener('pointerdown', away, true);
    window.removeEventListener('wheel', close);
    window.removeEventListener('resize', close);
    el.classList.remove('on');
    setTimeout(() => el.remove(), 180);
  }
  current = close;
  return close;
}
