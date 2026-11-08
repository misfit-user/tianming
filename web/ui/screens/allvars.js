// 全部变量（顶栏「总」）：剧本编辑器定义的诸般数目与运行时另起的，一卷列尽，可检。
// 顶栏已列的国势、钱粮、户口不在此重出。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

export function openAllVars({ game }) {
  const { scenario, runtime } = game.select.allVariables();
  const body = h('div.av-body');
  const search = h('input.av-search', { type: 'search', placeholder: '检变量名', oninput: () => render(search.value.trim()) });
  // 读数按记数设置写（默认汉字）：负数前加「−」（同人物页）；零点几照原样写，免得四舍五入成「零」；算不出的写「无考」；不是数的照原样
  const reading = (r) => {
    const s = String(r.value);
    const n = typeof r.value === 'number' ? r.value : /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
    if (n === null) return s + r.unit;
    if (!Number.isFinite(n)) return '无考';
    const a = Math.abs(n);
    return (n < 0 ? '−' : '') + (a > 0 && a < 1 ? String(Number(a.toFixed(3))) : num(a)) + r.unit;
  };
  const group = (title, rows) => rows.length ? h('section.av-group', h('h4', title, h('small', `${num(rows.length)}项`)),
    h('div.av-grid', rows.map((r) => h('div.av-card', h('b', r.label), h('span', reading(r)), r.desc ? h('small', r.desc) : null)))) : null;
  function render(q) {
    const hit = (r) => !q || r.label.includes(q) || r.key.includes(q);
    const a = scenario.filter(hit), b = runtime.filter(hit);
    replaceChildren(body, a.length || b.length ? [group('剧本所定', a), group('推演所生', b)] : [h('p.av-none', q ? '无此变量' : '此卷无另设之数')]);
  }
  render('');
  return juan({ title: '诸般数目', note: '顶栏已列者不重出', width: '56rem', height: 'min(42rem, 82vh)', content: h('div.av', search, body) });
}
