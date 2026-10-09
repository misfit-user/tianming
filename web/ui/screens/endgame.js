// 终局页：一局到头（崩而无嗣、亡国之兆、败局之标，或大业已成）——满屏一幅。
// 左侧竖写「天命已绝／天命已成」与时日；右侧一卷：败因或所成、史上国祚对照、太史公曰，
// 下分四签：帝王本纪（逐卷修成）、诸项升降、大事、人物结局。卷尾：软终局可「续理残局」，否则「封存此局」「回启幕」。
// 数据经 game.endgame（adapter/endgame.js 镜内核 _showEndgameScreen）；太史公、本纪由 AI 慢慢写来，页随之刷新。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { qianzi, yapai, loadFonts } from '../kit/index.js';

const SVG = 'http://www.w3.org/2000/svg';
function spark(values) {
  const W = 220, H = 36;
  const max = Math.max(...values), min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const pts = values.map((v, i) => `${((i / Math.max(values.length - 1, 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / range) * (H - 4)).toFixed(1)}`).join(' ');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const line = document.createElementNS(SVG, 'polyline');
  line.setAttribute('points', pts);
  svg.append(line);
  return svg;
}

export function createEndgame({ root, game, onSaves, onLeave }) {
  const E = game.endgame;
  const title = h('h1.eg-title');
  const meta = h('div.eg-meta');
  const head = h('div.eg-head');
  const tsg = h('div.eg-tsg');
  const tabBox = h('div.eg-tabs');
  const pane = h('div.eg-pane.q-scroll.ink');
  const foot = h('footer.eg-foot');
  const el = h('section.scr-endgame', { role: 'dialog', 'aria-label': '终局' },
    h('div.eg-side', title, meta), h('div.eg-sheet', head, tsg, tabBox, pane, foot));
  root.append(el);
  let tab = 'benji';
  let shown = false;

  const TABS = [['benji', '帝王本纪'], ['realm', '终局国势'], ['events', '大事'], ['people', '人物结局']];
  const tabs = qianzi(TABS.map(([value, label]) => ({ value, label })), { value: tab, onchange: (v) => { tab = v; renderPane(); } });
  tabBox.append(tabs);

  function render() {
    const d = E.data();
    if (!d) return;
    el.classList.toggle('won', d.victory);
    replaceChildren(title, ...(d.victory ? '天命已成' : '天命已绝').split('').map((c) => h('span', c)));
    replaceChildren(meta, h('span', d.date), h('span', `凡${num(d.turns)}回合`), d.scenario ? h('span', d.scenario) : null);
    replaceChildren(head,
      d.fail ? h('div.eg-fail', h('b', d.fail.title), d.fail.desc ? h('p', d.fail.desc) : null) : null,
      d.goals.length ? h('ul.eg-goals', d.goals.map((g) => h('li', g))) : null,
      d.fall ? h('p.eg-fall', d.fall) : null);
    replaceChildren(tsg, h('b.eg-tsg-h', '太史公曰'),
      d.tsg ? h('div.eg-tsg-body', d.tsg.map((s) => h('p', s.head ? h('em', `【${s.head}】`) : null, s.text)))
        : h('p.eg-wait', d.hasAI ? '太史公正在撰写评语……' : '（未配推演之器，太史公阙评）'));
    const b = (label, fn) => yapai(label, { onclick: fn });
    replaceChildren(foot, d.running
      ? [b('续理残局', () => close()), b('封存此局', () => onSaves())]
      : [b('封存此局', () => onSaves()), b('回启幕', () => { close(); onLeave(); })]);
    renderPane(d);
  }

  function renderPane(d = E.data()) {
    if (!d) return;
    if (tab === 'benji') {
      replaceChildren(pane, d.benji.length
        ? [d.benjiStatus ? h('p.eg-note', d.benjiStatus) : null, ...d.benji.map((s, i) => h('section.eg-vol',
            h('h4', `卷${num(i + 1)}`, h('small', `起${s.from} · 迄${s.to}`)), h('p', s.text)))]
        : h('p.eg-note', d.benjiStatus || (d.hasAI ? '史馆修纂中……' : '本纪须推演之器修纂。')));
    } else if (tab === 'realm') {
      replaceChildren(pane,
        h('div.eg-realm', d.realm.map((x) => h('div.eg-gauge', h('b', x.label),
          h('i', h('u', { style: { width: `${Math.max(0, Math.min(100, x.value))}%` } })), h('span', num(x.value)),
          x.seen !== null ? h('small', `朝廷所闻${num(x.seen)}`) : h('small', '')))),
        h('p.eg-note', '局已终，所列皆为实数。'),
        d.metrics.length ? h('div.eg-metrics', d.metrics.map((m) => h('div.eg-metric', h('b', m.label), spark(m.values), h('span', num(Math.round(m.values[m.values.length - 1])))))) : null);
    } else if (tab === 'events') {
      replaceChildren(pane, d.events.length
        ? h('ol.eg-events', d.events.map((e) => h('li.' + e.tone, h('small', e.when), h('span', e.text))))
        : h('p.eg-note', '无大事可纪。'));
    } else {
      replaceChildren(pane, h('div.eg-people', d.people.map((c) => h('div.eg-man' + (c.alive ? '' : '.dead'),
        h('b', c.name), h('small', c.title || '—'), h('span', c.alive ? `忠${num(c.loyalty)}` : (c.death || '殁'))))));
    }
  }

  async function open() {
    tab = 'benji';
    render();
    const d = E.data();
    if (d) await loadFonts({ 'TM-MaShanZheng': '天命已成绝' });
    el.classList.add('on');
    shown = true;
  }
  function close() {
    el.classList.remove('on');
    shown = false;
    E.dismiss();
  }

  game.on('game:endgame', () => open());
  game.on('endgame:changed', () => { if (shown) render(); });
  return { get opened() { return shown; } };
}
