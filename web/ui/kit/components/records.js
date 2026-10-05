// 记事的器物：账目、九品刻度、人物小立轴、邸报刻本、朱丝栏小笺。
import { h } from '../../core/dom.js';
import { num, delta, grade, gradeIndex } from '../../core/numerals.js';

// 账：zhang('帑廪', [{ k: '银', v: 1230000, d: -820000, unit: '两' }, …])
export function zhang(label, rows) {
  return h('div.q-zhang',
    h('em.q-gold', label),
    h('ol', rows.map((r) => h('li',
      h('i', r.k),
      h('b', r.text ?? num(r.v)),
      r.unit ? h('u', r.unit) : null,
      r.d ? h('s' + (r.d > 0 ? '.up' : ''), delta(r.d)) : null
    ))));
}

// 九品刻度：pin('民心', 31) → 「下上」，九格刻度落到第几品
export function pin(label, value, { text } = {}) {
  const gi = gradeIndex(value);
  return h('div.q-pin', { title: `${label} ${num(value)}` },
    h('div', h('span', label), h('b.q-gold', text ?? grade(value))),
    h('ol', Array.from({ length: 9 }, (_, i) => h('li' + (i < gi ? '.f' : i === gi ? '.n' : '')))));
}

// 人物小立轴：zhou({ name, src, dead, onclick })；没有立像时以名字首字作像
export function zhou({ name, src, dead = false, onclick, title }) {
  const initial = () => h('div.face', { style: { display: 'grid', placeItems: 'center', font: '400 2rem var(--f-title)', color: 'rgba(40,24,14,.6)' } }, [...(name || '？')][0]);
  let face = initial();
  if (src) {
    face = h('img', { src, alt: name, loading: 'lazy', decoding: 'async' });
    face.addEventListener('error', () => face.replaceWith(initial()), { once: true });   // 立像缺失：以名字首字作像
  }
  return h('figure.q-zhou' + (dead ? '.dead' : ''), { onclick, title: title || name, tabIndex: onclick ? 0 : null }, face, h('figcaption', name));
}

// 邸报刻本一叶：keben('邸报', [{ tag: '急', text: '…', soft }, …])
export function keben(title, items) {
  return h('article.q-keben.q-zhi', h('h3', title), items.map((it) => h('p' + (it.soft ? '.soft' : ''), it.tag ? h('em', it.tag) : null, it.text)));
}

// 朱丝栏小笺：jian({ title, sub, rows: [['民心','下上','bad'], …], warn })
export function jian({ title, sub, rows = [], warn }) {
  return h('div.q-jian.q-zhi',
    title ? h('div.c.t', title) : null,
    sub ? h('div.c.s', sub) : null,
    rows.map(([k, v, cls]) => h('div.c' + (cls ? '.' + cls : ''), h('i', k), '　', v)),
    warn ? h('div.c.w', warn) : null);
}
