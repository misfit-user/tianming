// 帮助册：前三卷按身份档现写（这一档的须知、案前诸物——五渠道、书目、器物、顶栏，回合与推演，键位），
// 后几卷照用内核帮助里与界面无关的（概览与模式、诏书问对、游戏系统、技巧、AI 密钥、历代典范；adapter/help.js）。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';

const BOOK_NOTE = { map: '天下府州，七种看法', people: '人人一卷，可读列传', offices: '衙署职官，任免补缺', fiscal: '帑廪户口，收支借贷', army: '诸军名册，战事流寇',
  realm: '势力、党派、阶层', wenyuan: '诗文总集，品评查禁', keju: '开科取士，读卷放榜', gongwei: '后妃、皇嗣、宫苑', annals: '史记、起居、纪事、编年四库',
  gazette: '四方消息', registry: '辖区册籍', family: '家族谱系', estate: '田宅产业' };

export function createHelp({ root, game, profile }) {
  let key = 'guide';
  let opened = false;
  const title = h('h2', '帮助');
  const list = h('nav.hp-list');
  const left = h('section.ce-leaf.left.hp-left', h('header.ce-head', title, h('small', '须知与说明')), list);
  const right = h('section.ce-leaf.right.hp-right');
  const shut = h('button.ce-close.q-yapai', { type: 'button', onclick: () => hide() }, '合册');
  const book = h('div.ce-book', h('div.ce-ling'), left, h('div.ce-gutter'), right, shut);
  const ov = h('div.ce-ov.hp-ov', { role: 'dialog', 'aria-label': '帮助' }, book);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) hide(); });
  root.append(ov);

  function own() {
    const p = profile();
    const ch = Object.fromEntries(p.channels.map((c) => [c.key, c]));
    const tags = p.tags || {};
    return [
      { key: 'guide', title: p.guideTitle || '入局须知', body: () => [
        h('ol.hp-guide', (p.guide || []).map(([t, s]) => h('li', h('b', t), h('p', s)))),
        h('h4', '案底五牌'), h('dl.hp-dl', p.channels.map((c) => [h('dt', c.title), h('dd', c.sub)])),
        h('h4', '右列书目'), h('dl.hp-dl', p.books.map(([g, name, k]) => [h('dt', h('i.hp-g', g), name), h('dd', BOOK_NOTE[k] || '')])),
        h('h4', '案上器物'), h('dl.hp-dl', [['memorials', ch.pi && ch.pi.title], ['tray', '此刻待决的要务'], ['letterbox', ch.shu && ch.shu.title], ['writing', ch.ling && ch.ling.title], ['books', p.annals.archive], ['seal', p.seal.note]]
          .filter(([k]) => tags[k]).map(([k, v]) => [h('dt', tags[k]), h('dd', v || '')])),
        h('h4', '顶栏'), h('dl.hp-dl', [['年月', '今日几何；「推演」过此一回合'], ['账簿', '钱粮户口，点开即见细账'], ['四品', '九品刻度看大势，点开见详'],
          ['存', '案卷目录：存档读档'], ['典', '典章：AI 连接、玩法开关、音量'], ['问', '问天：局外与推演 AI 直言'], ['总', '全部变量']].map(([k, v]) => [h('dt', k), h('dd', v)]))
      ] },
      { key: 'turn', title: '回合与推演', body: () => [
        h('p', `一回合之内：看时政花笺知此刻要务，${ch.pi ? `批阅${p.docket.name}，` : ''}召人问对、付朝议，拟定${p.annals.decree}；${p.seal.title}即把本回所拟交出，推演 AI 据之演绎天下。`),
        h('p', `推演毕，${p.annals.title}记下本回，邸报传来四方消息。所拟之事未必如愿——各方各有打算，天下也有它自己的惯性。`),
        h('p', '许多举措（钱粮、军务、文事、宫中之事……）点了不会立刻生效，而是写进议事清册，待拟入正文颁行后由推演落地，并在下回合回报执行情形。'),
        h('p', '严格史实模式下，许多数字只是据奏之数：实情须厂卫、推问、查案方得掀见，册中以封记标出。')
      ] },
      { key: 'keys', title: '键位', body: () => [h('dl.hp-dl', [
        ['Esc', '收卷、合册；书案上按则暂停；舆图里起身离图'], ['Ctrl+Enter', '问对、朝议、密问、科议里递话；问天里问天'],
        ['← →', `批阅${p.docket.name}时翻折；人物图志里翻页；史官实录里翻回`], ['PageUp / PageDown', `批阅${p.docket.name}时换一件`],
        ['1～9、0', '案前开右侧书目第几册（舆图、人物图志……依次）'], ['F1', '开此帮助册']].map(([k, v]) => [h('dt', h('kbd', k)), h('dd', v)]))] }
    ];
  }
  function all() {
    let kernel = [];
    try { kernel = game.help.topics(); } catch (_e) { kernel = []; }
    return own().concat(kernel.map((t) => ({ key: t.key, title: t.title, html: t.html })));
  }
  function render() {
    const topics = all();
    if (!topics.some((t) => t.key === key)) key = topics[0].key;
    replaceChildren(list, topics.map((t, i) => h('button' + (t.key === key ? '.on' : ''), { type: 'button', onclick: () => { key = t.key; render(); } }, h('i', num(i + 1)), t.title)));
    const t = topics.find((x) => x.key === key);
    const body = h('div.hp-body');
    if (t.body) replaceChildren(body, t.body());
    else body.innerHTML = t.html || '';           // 内核帮助卷：写死的 HTML，已去行内样式
    replaceChildren(right, h('h3.hp-title', t.title), body);
    right.scrollTop = 0;
  }
  function show(k) {
    if (k) key = k;
    render();
    ov.classList.add('on');
    opened = true;
  }
  function hide() { ov.classList.remove('on'); opened = false; }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  }, true);
  return { show, hide, get opened() { return opened; } };
}
