// 全部变量（顶栏「总」）：剧本编辑器定义的诸般数目与运行时另起的，一卷列尽，可检。
// 顶栏已列的国势、钱粮、户口不在此重出。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

export function openAllVars({ game }) {
  const { scenario, runtime } = game.select.allVariables();
  const body = h('div.av-body');
  const search = h('input.av-search', { type: 'search', placeholder: '检变量名', oninput: () => render(search.value.trim()) });
  // 纯数（可带单位）按记数设置写（默认汉字），其余照原样
  const fmt = (v) => { const m = /^(-?\d+(?:\.\d+)?)(\D{0,3})$/.exec(String(v)); return m ? num(Number(m[1])) + m[2] : v; };
  const group = (title, rows) => rows.length ? h('section.av-group', h('h4', title, h('small', `${num(rows.length)}项`)),
    h('div.av-grid', rows.map((r) => h('div.av-card', h('b', r.label), h('span', fmt(r.value)), r.desc ? h('small', r.desc) : null)))) : null;
  function render(q) {
    const hit = (r) => !q || r.label.includes(q) || r.key.includes(q);
    const a = scenario.filter(hit), b = runtime.filter(hit);
    replaceChildren(body, a.length || b.length ? [group('剧本所定', a), group('推演所生', b)] : [h('p.av-none', q ? '无此变量' : '此卷无另设之数')]);
  }
  render('');
  return juan({ title: '诸般数目', note: '顶栏已列者不重出', width: '56rem', height: 'min(42rem, 82vh)', content: h('div.av', search, body) });
}
