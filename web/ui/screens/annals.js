// 史官实录：一回合一卷。卷首记第几回合、何时、本回总括；分卷翻看——实录、时政记、正文、后人戏说、人事、诏令与回响。
// 推演之后自动展开最新一回；右列「史」、案上史册也开此卷。可前后翻回合。数据经 game.select.annal(idx)。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

export const EDICT_LABEL = { political: '政令', military: '军令', diplomatic: '外交', economic: '经济', personnel: '人事', other: '其他', pol: '政令', mil: '军令', dip: '外交', eco: '经济', oth: '其他', xinglu: '行止' };

// onArchive(id)：卷尾「入史馆」，在四库总册里打开这一回的史记
export function openAnnals({ game, profile, idx = null, onArchive }) {
  const t = profile().annals;
  let cur = game.select.annal(idx);
  const body = h('div.an');
  let vol = 'shilu';
  let j = null;

  function vols(a) {
    return [
      ['shilu', '实录', a.shilu],
      ['shizhengji', '时政记', a.shizhengji],
      ['zhengwen', '正文', a.zhengwen],
      ['houren', '后人戏说', a.houren],
      ['personnel', '人事', a.personnel.length ? a.personnel : ''],
      ['edicts', t.orders, a.edicts.length || a.edictReports.length ? 1 : '']
    ].filter(([, , v]) => v && (typeof v !== 'string' || v.trim()));
  }

  function render() {
    if (!cur) { replaceChildren(body, h('p.an-none', '史馆尚无一卷。推演一回之后，此处便有实录。')); return; }
    const a = cur;
    const vs = vols(a);
    if (!vs.find(([k]) => k === vol)) vol = vs.length ? vs[0][0] : '';
    const tabs = h('div.an-tabs', vs.map(([k, label]) => h('button' + (k === vol ? '.on' : ''), { type: 'button', onclick: () => { vol = k; render(); } }, label)));
    let page;
    if (vol === 'personnel') page = h('ol.an-list', a.personnel.map((t) => h('li', t)));
    else if (vol === 'edicts') page = h('div',
      a.edicts.length ? h('section', h('h5', t.ownOrders), a.edicts.map(([k, v]) => h('p.an-edict', h('b', (k === 'decree' ? t.decree : EDICT_LABEL[k] || k) + '　'), v))) : null,
      a.edictReports.length ? h('section', h('h5', t.echo), h('ol.an-list', a.edictReports.map((x) => h('li', x)))) : null);
    else page = prose((vs.find(([k]) => k === vol) || [, , ''])[2], vol);
    replaceChildren(body,
      h('header.an-head', h('b', a.title || a.time), a.title ? h('small', a.time) : null, a.summary ? h('p', a.summary) : null),
      a.playerInner ? h('p.an-inner', a.playerInner) : null,
      tabs, h('div.an-page.q-scroll.ink', page));
    if (j) j.body.querySelector('.tiantou small') && (j.body.querySelector('.tiantou small').textContent = `第${num(a.turn)}回合 · 第${num(a.idx + 1)}卷共${num(a.total)}卷`);
    edges();
  }
  // 一段一段：段首【某事】提作朱色小题（时政记按事分段，原先方括号连着正文挤在一处）
  function prose(text, cls) {
    return h('div.an-text.' + cls, String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).map((s) => {
      const m = s.match(/^【([^】]{1,16})】\s*/);
      return h('p', m ? [h('b.an-tag', m[1]), s.slice(m[0].length)] : s);
    }));
  }
  // 翻到头、翻到尾，前一回／后一回灰着（原先只一卷也照样亮着，点了没反应）
  function edges() {
    if (!j) return;
    const [prev, next] = j.el.querySelectorAll('footer .q-yapai');
    if (prev) prev.disabled = !cur || cur.idx <= 0;
    if (next) next.disabled = !cur || cur.idx >= cur.total - 1;
  }
  function go(d) {
    if (!cur) return;
    const n = game.select.annal(cur.idx + d);
    if (n && n.idx !== cur.idx) { cur = n; render(); }
  }
  render();
  j = juan({
    title: t.title, note: cur ? `第${num(cur.turn)}回合 · 第${num(cur.idx + 1)}卷共${num(cur.total)}卷` : '', width: '60rem', height: 'min(46rem, 86vh)', content: body,
    actions: [{ label: '前一回', onclick: () => go(-1) }, { label: '后一回', onclick: () => go(1) },
      ...(onArchive ? [{ label: `入${t.archive}`, onclick: ({ close }) => { const id = cur ? `shiji-${cur.idx}` : ''; close('ok'); onArchive(id); } }] : [])]
  });
  edges();
  // ←→ 翻前后一回（照老史记弹窗）：只在本卷居最上、且不在输入框里时
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    if ([...document.querySelectorAll('.q-juan-veil')].pop() !== j.el) return;
    e.preventDefault();
    go(e.key === 'ArrowLeft' ? -1 : 1);
  };
  window.addEventListener('keydown', onKey);
  j.closed.then(() => window.removeEventListener('keydown', onKey));
  return j;
}
