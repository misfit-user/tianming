// 财：度支册。左叶择帑廪、内帑、户口：两库各列银粮布——库存、本期收支与净数、上期、欠项总数；户口列全国户、口、丁、逃户、隐户。
// 右叶：帑廪为收支名目（择银粮布）、欠项、借贷、户部条陈（加派、开仓赈济拟入清册；减重改铸、财政改革当场办）；
// 内帑为收支名目与宫中条陈（两库互拨、大典，拟入清册）；户口为各省（汇总叶子）户口、民心、吏治。经 game.fiscal。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num, roundSig } from '../core/numerals.js';
import { qianzi, juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const amt = (v) => num(roundSig(Math.abs(v || 0), 3));
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + amt(v);
const pct = (v) => `${num(Math.round((v || 0) * 1000) / 10)}%`;
const TABS = [['guoku', '帑廪'], ['neitang', '内帑'], ['census', '户口']];

export function createFiscal({ root, game }) {
  const F = game.fiscal;
  let tab = 'guoku';
  let res = 'money';
  let opened = false;

  const tabs = qianzi(TABS.map(([value, label]) => ({ value, label })), { value: tab, onchange: (v) => { tab = v; render(); } });
  const leftBody = h('div.fi-lbody');
  const left = h('section.ce-leaf.left.fi-left', h('header.ce-head', h('h2', '度支'), h('small', '量入为出')), h('div.fi-tabs', tabs), leftBody);
  const right = h('section.ce-leaf.right.fi-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.fi-ov', { role: 'dialog', 'aria-label': '度支册' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  function render() {
    if (tab === 'census') return renderCensus();
    const a = F.account(tab);
    if (!a) { replaceChildren(leftBody, h('p.ce-unk', '此账未具')); replaceChildren(right); return; }
    replaceChildren(leftBody,
      a.forecast ? h('p.fi-note', '本期尚未结账，所列为预估') : null,
      a.res.map((r) => h('article.fi-card' + (r.key === res ? '.on' : ''), { onclick: () => { res = r.key; render(); } },
        h('header', h('b', r.label), h('small', r.unit)),
        h('div.stock', amt(r.stock), h('small', r.unit)),
        h('div.flow', h('span.in', `收 ${amt(r.inn)}`), h('span.out', `支 ${amt(r.out)}`), h('span.net' + (r.inn - r.out < 0 ? '.neg' : ''), `净 ${signed(r.inn - r.out)}`)),
        r.lastIn || r.lastOut ? h('div.last', `上期 收${amt(r.lastIn)} 支${amt(r.lastOut)}`) : null,
        r.deficit ? h('div.deficit', `欠 ${amt(r.deficit)}${r.unit}`) : null)));
    const r = a.res.find((x) => x.key === res) || a.res[0];
    replaceChildren(right,
      h('header.fi-title', h('h3', `${tab === 'guoku' ? '帑廪' : '内帑'}·${r.label}`), h('small', `本期收${amt(r.inn)} · 支${amt(r.out)}${r.unit}`)),
      h('div.fi-cols', bars('岁入名目', r.sources, r.inn, r.unit, 'in'), bars('支用科目', r.sinks, r.out, r.unit, 'out')),
      r.deficits.length ? h('section.fi-sec', h('h4', `欠项 · ${amt(r.deficit)}${r.unit}`), h('div.fi-debts', r.deficits.slice(0, 12).map((d) => h('p', h('span', d.name || d.kind), h('b', `${amt(d.amount)}`)))),
        r.deficits.length > 12 ? h('p.fi-more', `余${num(r.deficits.length - 12)}项`) : null) : null,
      tab === 'guoku' ? guokuActions() : palaceActions());
  }
  function bars(title, list, total, unit, cls) {
    const max = Math.max(1, ...list.map((x) => x.amount));
    return h('section.fi-sec', h('h4', title), list.length ? list.slice(0, 10).map((x) => h('div.fi-bar.' + cls,
      h('span.k', x.label), h('span.v', h('i', { style: { width: `${(x.amount / max) * 100}%` } })), h('span.n', amt(x.amount)), h('small', total ? pct(x.amount / total) : '')))
      : h('p.ce-unk', '本期无'));
  }

  // ---------- 帑廪：借贷与户部条陈 ----------
  function guokuActions() {
    const L = F.loans();
    return h('div.fi-acts',
      h('section.fi-sec', h('h4', `借贷 · 在借${num(L.list.length)}笔`),
        L.list.map((x) => h('p.fi-loan', h('b', x.source), `本金${amt(x.principal)}两 · 月息${num(Math.round(x.rate * 1000) / 10)}% · 月付${amt(x.monthly)} · 余${num(x.left)}/${num(x.term)}月`)),
        h('button.q-yapai', { type: 'button', onclick: () => openLoan(L.sources) }, '新借一笔')),
      h('section.fi-sec', h('h4', '户部条陈'), h('p.fi-note', '加派、开仓拟入议事清册，下旨方行；改铸、改制当场施行。'),
        h('div.fi-btns',
          h('button.q-yapai', { type: 'button', onclick: () => pick('加派赋税', F.MEASURES.extraTax, (v) => F.extraTax(v), '拟入清册') }, '加派赋税'),
          h('button.q-yapai', { type: 'button', onclick: () => pick('开仓赈济', F.MEASURES.granary, (v) => F.granary(v), '拟入清册') }, '开仓赈济'),
          h('button.q-yapai.danger', { type: 'button', onclick: () => pick('减重改铸', F.MEASURES.coin, (v) => { const r = F.lightCoin(v); toast(r && r.success === false ? `未成：${r.reason || ''}` : '已减重改铸'); }, '施行') }, '减重改铸'),
          h('button.q-yapai', { type: 'button', onclick: () => openReforms() }, '财政改制'))));
  }
  function pick(title, rows, act, verb) {
    const j = juan({
      title, width: '30rem',
      content: h('div.au-pick', rows.map(([v, label, note]) => h('button.au-pick-row', { type: 'button', onclick: () => {
        j.close('ok');
        try { act(v); } catch (e) { toast(e.message); }
        render();
      } }, h('b', label), h('small', note)))),
      note: verb
    });
  }
  function openLoan(sources) {
    let j = null;
    j = juan({
      title: '借贷', note: '择来源', width: '32rem',
      content: h('div.au-pick', sources.map((s) => h('button.au-pick-row' + (s.foreign ? '.danger' : ''), { type: 'button', onclick: () => { j.close('ok'); loanForm(s); } },
        h('b', s.name), h('small', `月息${num(Math.round(s.rate * 1000) / 10)}% · 上限${amt(s.max)}两 · ${s.note}`))))
    });
  }
  function loanForm(s) {
    const sizes = [0.3, 0.5, 1].map((k) => Math.round(s.max * k / 10000) * 10000);
    const size = qianzi(sizes.map((v) => ({ value: v, label: `${amt(v)}两` })), { value: sizes[1] });
    const term = qianzi([6, 12, 24, 36].map((v) => ({ value: v, label: `${num(v)}月` })), { value: 12 });
    juan({
      title: s.name, note: `月息${num(Math.round(s.rate * 1000) / 10)}%`, width: '30rem',
      content: h('div.fi-form', h('p.fi-note', s.note), h('div', h('span', '借数'), size), h('div', h('span', '期限'), term)),
      actions: [{ label: '借', onclick: ({ close }) => {
        let r = null;
        try { r = F.takeLoan(s.id, Number(size.getValue()), Number(term.getValue())); } catch (e) { toast(e.message); return; }
        close('ok');
        toast(r && r.success !== false ? `已向${s.name}借银${amt(Number(size.getValue()))}两` : `未成：${(r && r.reason) || ''}`);
        render();
      } }]
    });
  }
  function openReforms() {
    const list = F.reforms();
    const j = juan({
      title: '财政改制', width: '36rem',
      content: list.length ? h('div.au-pick', list.map((r) => h('button.au-pick-row' + (r.enacted ? '.done' : ''), { type: 'button', disabled: r.enacted, onclick: () => {
        juan({ title: r.name, width: '30rem', content: h('div', h('p.fi-note', r.desc), r.effects.length ? h('p.fi-note', r.effects.join('　')) : null),
          actions: [{ label: '推行', onclick: ({ close }) => {
            close('ok');
            j.close('ok');
            let res2 = null;
            try { res2 = F.enactReform(r.id); } catch (e) { toast(e.message); return; }
            toast(res2 && res2.success ? `已颁行：${r.name}` : `未成：${(res2 && res2.reason) || ''}`);
            render();
          } }] });
      } }, h('b', r.name, r.enacted ? h('small', '　已行') : null), h('small', r.desc)))) : h('p.ce-unk', '无可行之制')
    });
  }

  // ---------- 内帑：宫中条陈 ----------
  function palaceActions() {
    const amount = qianzi(F.TRANSFER_AMOUNTS.map((v) => ({ value: v, label: amt(v) })), { value: F.TRANSFER_AMOUNTS[1] });
    const draft = (f) => () => { try { f(); } catch (e) { toast(e.message); } };
    return h('section.fi-sec', h('h4', '宫中条陈'), h('p.fi-note', '两库互拨、举行大典，拟入议事清册，下旨方行。'),
      h('div.fi-form', h('div', h('span', '银数'), amount)),
      h('div.fi-btns',
        h('button.q-yapai', { type: 'button', onclick: draft(() => F.transferDraft('toPalace', Number(amount.getValue()))) }, '帑廪拨入内帑'),
        h('button.q-yapai', { type: 'button', onclick: draft(() => F.transferDraft('toState', Number(amount.getValue()))) }, '发内帑济国用')),
      h('div.fi-btns', F.CEREMONIES.map(([k, label]) => h('button.q-yapai', { type: 'button', onclick: draft(() => F.ceremonyDraft(k)) }, `举${label}`))));
  }

  // ---------- 户口 ----------
  function renderCensus() {
    const c = F.census();
    replaceChildren(leftBody,
      h('article.fi-card.on', h('header', h('b', '全国'), h('small', c.accuracy != null ? `黄册准确${pct(c.accuracy)}` : '')),
        h('div.fi-cen', [['户', c.households], ['口', c.mouths], ['丁', c.ding], ['逃户', c.fugitives], ['隐户', c.hidden]].filter(([, v]) => v).map(([k, v]) => h('p', h('span', k), h('b', amt(v)))))));
    const max = Math.max(1, ...c.provinces.map((p) => p.mouths));
    replaceChildren(right, h('header.fi-title', h('h3', '各省户口'), h('small', `${num(c.provinces.length)}省 · 合下辖府州之数`)),
      h('div.fi-prov', h('p.hd', h('span', '省'), h('span', '口'), h('span', '户'), h('span', '丁'), h('span', '逃'), h('span', '民心'), h('span', '吏治')),
        c.provinces.map((p) => h('p', h('span.n', p.name), h('span.bar', h('i', { style: { width: `${(p.mouths / max) * 100}%` } }), h('b', amt(p.mouths))),
          h('span', amt(p.households)), h('span', amt(p.ding)), h('span', p.fugitives ? amt(p.fugitives) : '—'),
          h('span' + (p.minxin != null && p.minxin < 40 ? '.bad' : ''), p.minxin != null ? num(p.minxin) : '—'), h('span' + (p.lizhi != null && p.lizhi < 40 ? '.bad' : ''), p.lizhi != null ? num(p.lizhi) : '—')))));
  }

  function show(which) {
    if (which) { tab = which; tabs.setValue(which); }
    render();
    ov.classList.add('on');
    opened = true;
  }
  function hide() {
    ov.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened) render(); });
  return { show, hide, get opened() { return opened; } };
}
