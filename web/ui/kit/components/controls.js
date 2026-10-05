// 可点的器物：漆牌、牙牌、小方钮、签子、瓦当圆章、印、开关、镇尺、书写笺、朱签角标。
import { h } from '../../core/dom.js';
import { num } from '../../core/numerals.js';
import { sealCanvas } from '../brush.js';
import { seedOf } from '../../core/rand.js';

// 朱签角标：竖写数目；n 为 0 或空时不出
export function qian(n) {
  if (!n) return null;
  return h('span.q-qian', typeof n === 'number' ? num(n) : n);
}

// 漆牌按钮：pai({ title: '百官奏疏', sub: '今日十三件', badge: 13, onclick, aside, disabled })
export function pai({ title, sub, badge = 0, onclick, aside = false, disabled = false, className = '' }) {
  return h('button.q-qi.q-pai' + (aside ? '.aside' : ''), {
    type: 'button', class: className, onclick: disabled ? null : onclick, 'aria-disabled': disabled ? 'true' : null
  }, h('b.q-gold', title), sub ? h('small', sub) : null, qian(badge));
}

// 牙牌：小签按钮或标签
export function yapai(text, { onclick, title } = {}) {
  return h(onclick ? 'button.q-yapai' : 'span.q-yapai', { type: onclick ? 'button' : null, onclick, title }, text);
}

// 系在器物上的牙牌小签（一截红绳一个盘长结），场景层按锚点定位
export function tag(text) {
  return h('div.q-tag', h('i'), h('span.q-yapai', text));
}

// 小方钮：顶栏的「总」「问」「典」
export function btn(ch, { title, onclick } = {}) {
  return h('button.q-btn', { type: 'button', title, 'aria-label': title, onclick }, h('b.q-gold', ch));
}

// 签子：一排竖签，选中的那枝朱红。qianzi(['民情','阶层',…], { value, onchange, big })
export function qianzi(items, { value, onchange, big = false } = {}) {
  const el = h('div.q-qianzi' + (big ? '.big' : ''), { role: 'tablist' });
  const opts = items.map((it) => (typeof it === 'string' ? { value: it, label: it } : it));
  const set = (v, fire) => {
    value = v;
    [...el.children].forEach((b) => {
      const on = b.dataset.value === String(v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (fire && onchange) onchange(v);
  };
  for (const o of opts) {
    el.append(h('button', { type: 'button', role: 'tab', dataset: { value: o.value }, title: o.title, onclick: () => set(o.value, true) }, o.label));
  }
  set(value ?? opts[0]?.value, false);
  el.setValue = (v) => set(v, false);
  el.getValue = () => value;
  return el;
}

// 瓦当圆章：wadang({ ch: '奏', name: '百官奏疏', badge, on, onclick })
export function wadang({ ch, name, badge = 0, on = false, onclick }) {
  return h('button.q-wadang' + (on ? '.on' : ''), { type: 'button', 'aria-label': name, onclick, dataset: { name } },
    h('b.q-gold', ch), h('small', name), qian(badge));
}

// 印按钮：sealButton({ chars: ['诏','付','有','司'], size: '6.75rem', title, onclick })
export function sealButton({ chars, style = 'bai', size = '6.75rem', title, onclick, family = 'TM-MaShanZheng', rotate = -3 }) {
  const el = h('button.q-seal', { type: 'button', title, 'aria-label': title || chars.join(''), onclick,
    style: { width: size, height: size, border: '0', padding: '0', background: 'none', rotate: `${rotate}deg` } });
  const paint = () => {
    const c = sealCanvas({ chars, style, w: 216, seed: seedOf(chars.join('')), family });
    el.style.backgroundImage = `url(${c.toDataURL()})`;
    el.style.backgroundSize = '100% 100%';
  };
  document.fonts.load(`100px "${family}"`, chars.join('')).then(paint, paint);
  return el;
}

// 开关：kaiguan('自动存档', { checked, onchange })
export function kaiguan(label, { checked = false, onchange } = {}) {
  const input = h('input', { type: 'checkbox', checked, onchange: () => onchange?.(input.checked) });
  return h('label.q-kaiguan', input, h('span.cao', h('i')), label ? h('span', label) : null);
}

// 镇尺：chi({ min, max, step, value, format, onchange })
export function chi({ min = 0, max = 1, step = 0.01, value = 0, format = (v) => Math.round(v * 100) + '%', oninput, onchange } = {}) {
  const out = h('output', format(value));
  const input = h('input', { type: 'range', min, max, step, value,
    oninput: () => { out.textContent = format(+input.value); oninput?.(+input.value); },
    onchange: () => onchange?.(+input.value) });
  return h('label.q-chi', input, out);
}

// 书写笺：shu({ placeholder, vertical, value, oninput })
export function shu({ placeholder = '', vertical = false, value = '', oninput, rows } = {}) {
  return h('textarea.q-shu' + (vertical ? '.v' : ''), { placeholder, value, rows, oninput: (e) => oninput?.(e.target.value), spellcheck: 'false' });
}
