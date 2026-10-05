// 面板：漆（黑漆描金回纹框）与纸（笺纸）。题头一朵云头领起，右边可带小字注。
import { h } from '../../core/dom.js';

// 题头：qiTitle('人物图志', '天启朝 · 二百零三人')
export function panelTitle(text, note, { ink = false } = {}) {
  return h('h3.q-ti' + (ink ? '.ink' : ''), h('span' + (ink ? '' : '.q-gold'), text), note ? h('small', note) : null);
}

// 漆面板：qiPanel({ title, note, thin, className }, ...children)
export function qiPanel({ title, note, thin = false, className = '', tag = 'section' } = {}, ...children) {
  return h(`${tag}.q-qi${thin ? '.thin' : ''}`, { class: className }, title ? panelTitle(title, note) : null, children);
}

// 纸面板：zhiPanel({ title, note, old, className }, ...children)
export function zhiPanel({ title, note, old = false, className = '', tag = 'section' } = {}, ...children) {
  return h(`${tag}.q-zhi${old ? '.old' : ''}`, { class: className }, title ? panelTitle(title, note, { ink: true }) : null, children);
}

// 金字（渐变字要单包一层，不能和带底色的元素同一层）
export function gold(text, tag = 'span') {
  return h(`${tag}.q-gold`, text);
}

export function rule({ zhu = false } = {}) {
  return h('hr.q-rule' + (zhu ? '.zhu' : ''));
}
