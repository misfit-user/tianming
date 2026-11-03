// 出班：殿上正在说话的那一位，立轴和名牌挂在朝班与实录之间。朝议、科议共用。
// 换人时旧轴淡出、新轴淡入（图解码完才换，免得先闪一张白）；有所主张才盖一方印（中立不盖），正说着时名牌上写「奏对中」。
import { h, replaceChildren } from '../core/dom.js';
import { num } from '../core/numerals.js';
import { zhou } from '../kit/index.js';

const STAMP_CLS = { 支持: 'sup', 赞成: 'sup', 反对: 'opp', 折中: 'med', 观望: 'neu', 另议: 'alt' };

export function createPresenter({ onPerson, word = '奏对', idle = '入班候奏，尚无人出班' } = {}) {
  const stage = h('div.ct-pres-stage');
  const nameEl = h('h3');
  const sub = h('p.ct-pres-sub');
  const meta = h('p.ct-pres-meta');
  const liveEl = h('small.ct-pres-live', h('i'), `${word}中`);
  const plate = h('div.ct-pres-plate.q-qi', liveEl, nameEl, sub, meta);
  const el = h('aside.ct-pres', stage, plate);

  let current = '';
  let stampOf = '';
  let token = 0;

  function swap(fig) {
    for (const old of [...stage.children]) {
      old.classList.remove('in');
      old.classList.add('out');
      setTimeout(() => old.remove(), 340);
    }
    fig.classList.add('in');
    stage.append(fig);
  }
  function paintStamp(raw) {
    const stance = STAMP_CLS[raw] ? raw : '';
    if (stance === stampOf) return;
    stampOf = stance;
    const fig = stage.lastElementChild;
    if (!fig) return;
    fig.querySelector('.ct-pres-stamp')?.remove();
    if (stance) fig.append(h('b.ct-pres-stamp.' + (STAMP_CLS[stance] || 'neu'), stance));
  }
  function paintPlate(p, note) {
    nameEl.textContent = p.name;
    sub.textContent = p.title || '';
    sub.title = p.title || '';
    const bits = [p.party, p.rank, note, p.loyalty == null ? '' : `忠${num(p.loyalty)}`].filter(Boolean);
    replaceChildren(meta, bits.map((b) => h('span', b)));
    el.classList.remove('idle');
  }
  // p：adapter 的 person(name)。stance、note（御前的坦率）、live 随时可变
  function show(p, { stance = '', note = '', live = false } = {}) {
    if (p.name !== current) {
      current = p.name;
      stampOf = '';
      const mine = ++token;
      const fig = zhou({ name: p.name, src: p.portrait, onclick: onPerson ? () => onPerson(p.name) : undefined });
      fig.removeAttribute('title');
      const img = fig.querySelector('img');
      if (img) {
        img.loading = 'eager';
        // 图坏了 zhou 只写首字；这里补成全名
        img.addEventListener('error', () => { const f = fig.querySelector('.face'); if (f) replaceChildren(f, h('span', p.name)); }, { once: true });
      } else {
        const f = fig.querySelector('.face');
        if (f) replaceChildren(f, h('span', p.name));
      }
      const ready = img && img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      ready.then(() => {
        if (mine !== token) return;
        swap(fig);
        const s = stampOf;
        stampOf = '\0';
        paintStamp(s);
        paintPlate(p, note);
      });
      stampOf = stance;
    } else {
      paintStamp(stance);
      paintPlate(p, note);
    }
    setLive(live);
  }
  function setLive(on) { el.classList.toggle('live', !!on); }
  // 还没人开口：一张空轴，写「待奏」
  function clear() {
    current = '';
    stampOf = '';
    token++;
    replaceChildren(stage, h('figure.q-zhou.ct-pres-empty.in', h('div.face', h('span', '待奏'))));
    nameEl.textContent = '待奏';
    sub.textContent = idle;
    sub.removeAttribute('title');
    replaceChildren(meta);
    el.classList.add('idle');
    setLive(false);
  }
  clear();
  return { el, show, setLive, clear, get current() { return current; } };
}
