// 记事的器物：账目、九品刻度、人物小立轴、邸报刻本、朱丝栏小笺。
import { h, replaceChildren } from '../../core/dom.js';
import { num, delta, grade, gradeIndex } from '../../core/numerals.js';
import { tiao } from './tiao.js';

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

// 九品刻度：pin('民心', 31) → 「下上」，九格刻度落到第几品；text 换掉品第字，note 换掉悬停签条上的「品第 数」（调用方可再 tiao 换整张签）
export function pin(label, value, { text, note } = {}) {
  const gi = gradeIndex(value);
  return tiao(h('div.q-pin',
    h('div', h('span', label), h('b.q-gold', text ?? grade(value))),
    h('ol', Array.from({ length: 9 }, (_, i) => h('li' + (i < gi ? '.f' : i === gi ? '.n' : ''))))), { title: label, text: note || `${text ?? grade(value)}　${num(value)}` });
}

// 小圆像：先放姓的首字，立绘载到了才换上（缺图不露破图标；已在缓存里的当场换，免得每次重绘闪一下首字）。
// 给了 onPerson 就能点开人物窗、悬停出小签、右键出可为单
export function faceDot(cls, c, onPerson) {
  const attrs = onPerson ? { dataset: { person: c.name }, onclick: (e) => { e.stopPropagation(); onPerson(c.name); } } : {};
  const box = h('span.' + cls, attrs, [...(c.name || '？')][0]);
  if (c.portrait) {
    const img = new Image();
    img.alt = '';
    img.onload = () => replaceChildren(box, img);
    img.src = c.portrait;
    if (img.complete && img.naturalWidth) replaceChildren(box, img);
  }
  return box;
}

// 人物小立轴：zhou({ name, src, dead, onclick })；没有立像时以名字首字作像
export function zhou({ name, src, dead = false, onclick, title }) {
  const initial = () => h('div.face', { style: { display: 'grid', placeItems: 'center', font: '400 2rem var(--f-title)', color: 'rgba(40,24,14,.6)' } }, [...(name || '？')][0]);
  let face = initial();
  if (src) {
    face = h('img', { src, alt: name, loading: 'lazy', decoding: 'async' });
    face.addEventListener('error', () => face.replaceWith(initial()), { once: true });   // 立像缺失：以名字首字作像
  }
  // data-person：右键即出此人的「可为」单（screens/desk.js 统一接）
  return h('figure.q-zhou' + (dead ? '.dead' : ''), { onclick, title: title || name, tabIndex: onclick ? 0 : null, dataset: { person: name || '' } }, face, h('figcaption', name));
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
