// 推演幕：过回合时铺满全屏。幕后是三十四幅场景画轮换（墨晕换景），左立本组大题与诗行，右垂起居注一条——每过一拍添一行竖书，
// 底下九枚组印连成一线（起、牍、驿、推、演、令、司、笔、卷），已过者金、现行者朱。到末拍盖「成」字大印后收幕。
// 朝会等横插时内核报 pause，幕让开；下一拍再出。数据经 game.turn（adapter/turn.js）的 turn:progress。
// 回合复核与应急恢复（turn:review）：幕在时写在幕底，幕收后挂在书案右下一枚小签（可止之）；「失败后询问」一式出卷问可否。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

// 拍名与诗行：内核拍表的 id 一一对应（tm-endturn-progress.js 的 BEATS、AGENT_BEATS）。名目改作局中之语，不提 AI、NPC
const BEAT = {
  'core-start': ['时移事去', '风雨入阁，诸司回奏。'], 'step-1': ['整理本回所行', '案牍先清，旧事归档。'], 'step-2': ['预调旁证', '旁证先行，静候主推。'],
  'step-3': ['天下推演', '朝野脉络，归入一问。'], 'infer-db': ['检索故牍', '故牍翻检，史料就位。'], 'infer-pack': ['封函待发', '诸司案卷，封函待发。'],
  'ai-think': ['沉吟未落笔', '天下在抱，未遽落笔。'], 'ai-stream': ['落笔成文', '笔走龙蛇，万言将成。'], 'ai-review': ['复盘前事', '复盘前事，查漏补缺。'],
  'ai-text': ['时政记成', '时政记成，初稿付梓。'], 'ai-parallel': ['诸路并演', '诸路并发，各演其势。'], 'fu-npc': ['群臣各行其志', '群臣各行其志，暗流自生。'],
  'fu-faction': ['诸方自谋', '诸方势力，自谋其局。'], 'fu-econ': ['钱粮流转', '钱粮流转，市易自衡。'], 'fu-military': ['兵机自演', '烽燧相望，兵机自演。'],
  'fu-memory': ['恩怨入心', '人各有记，恩怨入心。'], 'fu-tale': ['稗官野史', '稗官野史，后人妄议。'], 'fu-quality': ['史笔覆核', '史笔有失，覆核再三。'],
  'fu-cognition': ['众见归一', '众人所见，归于一史。'], 'fu-history': ['史事比对', '史事比对，毫厘必究。'], 'fu-parse': ['条理成形', '条理成形，变更可施。'],
  'step-4': ['政令落地', '政令落地，官军随动。'], 'step-5': ['诸司结算', '日月折算，诸司分层推进。'], 'sys-update': ['诸司更簿', '诸司账簿，逐项更易。'],
  'sys-npc-engine': ['群机运转', '群机运转，编年自进。'], 'sys-territory': ['田亩仓廪', '田亩仓廪，岁入有数。'], 'sys-fiscal': ['钱粮归簿', '钱粮出入，俸饷归簿。'],
  'sys-changes': ['变动落定', '变动排队，逐项落定。'], 'sys-history': ['史事将临', '史事将临，先验其期。'], 'sys-tenure': ['宦海寿数', '宦海浮沉，寿数有时。'],
  'sys-listeners': ['余波渐平', '余波未平，人情自衰。'], 'sys-cache': ['故纸归匣', '故纸归匣，明日再启。'], 'step-6': ['史官缀词', '史官缀词，卷轴将开。'],
  'render-shiji': ['一笔定章', '万事归卷，一笔定章。'],
  'agent-engine': ['钱粮兵甲入账', '硬账先定，钱粮兵甲入账。'], 'agent-perceive': ['遍览局面', '目之所及，天下尽收。'],
  'agent-loop': ['逐事落子', '一事一断，逐事落子。'], 'agent-narrate': ['撰史定章', '诸事既定，史册自成。']
};
// 九组：题、印、短名
const GROUP = {
  entry: ['时移事去', '起', '起'], prep: ['整理案牍', '牍', '整理'], prefetch: ['史料先行', '驿', '预取'], ai: ['朝野推演', '推', '推演'],
  deepsim: ['诸方并演', '演', '并演'], edict: ['政令落地', '令', '政令'], systems: ['诸司运转', '司', '诸司'], render: ['史官缀笔', '笔', '缀史'], final: ['成卷待阅', '卷', '成卷']
};
const SWAP_MS = 14000;    // 同组久推（AI 落笔常数十秒）时也换景

export function createTurnVeil({ root, game }) {
  const T = game.turn;
  const bgs = [h('div.tv-bg'), h('div.tv-bg')];
  const seal = h('i.tv-seal');
  const title = h('h2.tv-title');
  const line = h('p.tv-line');
  const tone = h('small.tv-tone');
  const annals = h('div.tv-annals');
  const rail = h('ol.tv-rail');
  const now = h('b.tv-now');
  const next = h('span.tv-next');
  const count = h('span.tv-count');
  const extra = h('p.tv-extra');
  const review = h('p.tv-review');
  const fill = h('i');
  const stamp = h('div.tv-stamp', h('span', '成'));
  const el = h('section.tv', { 'aria-live': 'polite' }, bgs[0], bgs[1], h('div.tv-shade'),
    h('div.tv-head', seal, h('div.tv-cols', title, line), tone),
    h('aside.tv-side', h('header', '起居注'), annals),
    h('footer.tv-foot', rail, h('div.tv-status', now, next, count), extra, review, h('div.tv-bar', fill)),
    stamp);
  const chip = h('aside.tv-chip', { role: 'status' });
  root.append(el, chip);

  const scenes = T.scenes();
  let deck = [], front = 0, swapTimer = 0, hideTimer = 0;
  let beats = [], groups = [], at = -1, group = '', shown = false, running = false;

  // ---------- 换景：两层叠，新层以墨晕（径向遮罩）渐显 ----------
  function draw() {
    if (!deck.length) deck = scenes.map((_, i) => i).sort(() => Math.random() - 0.5);
    return scenes[deck.pop()];
  }
  function swapScene(instant) {
    if (!scenes.length) return;
    const sc = draw();
    const img = new Image();
    img.onload = () => {
      const nextLayer = bgs[1 - front];
      nextLayer.style.backgroundImage = `url("${sc.src}")`;
      nextLayer.classList.remove('on', 'in');
      void nextLayer.offsetWidth;
      nextLayer.classList.add('on', instant ? 'now' : 'in');
      bgs[front].classList.remove('on', 'now');
      front = 1 - front;
      tone.textContent = sc.tone;
    };
    img.onerror = () => { const i = scenes.indexOf(sc); if (i >= 0) scenes.splice(i, 1); deck = []; };
    img.src = sc.src;
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => { if (shown) swapScene(false); }, SWAP_MS);
  }

  // ---------- 画 ----------
  function setGroup(g) {
    if (g === group) return;
    group = g;
    const [t, glyph] = GROUP[g] || GROUP.entry;
    el.dataset.group = g;
    title.textContent = t;
    seal.textContent = glyph;
    el.classList.remove('retitle');
    void el.offsetWidth;
    el.classList.add('retitle');
    if (shown) swapScene(false);
  }
  function renderRail() {
    const cur = groups.indexOf(group);
    replaceChildren(rail, groups.map((g, i) => h('li' + (i < cur ? '.done' : i === cur ? '.now' : ''), h('i', (GROUP[g] || [])[1] || ''), h('small', (GROUP[g] || [])[2] || g))));
  }
  function addAnnal(id) {
    const [name, verse] = BEAT[id] || [id, ''];
    annals.querySelectorAll('p.now').forEach((p) => p.classList.remove('now'));
    annals.prepend(h('p.now', h('b', name), verse ? h('span', verse) : null));
    while (annals.children.length > 14) annals.lastElementChild.remove();
  }
  function status() {
    const b = beats[at];
    const [name, verse] = b ? (BEAT[b.id] || [b.id, '']) : BEAT['core-start'];
    now.textContent = name;
    line.textContent = verse;
    const nb = beats[at + 1];
    next.textContent = nb ? `次　${(BEAT[nb.id] || [nb.id])[0]}` : '次　成卷待阅';
    count.textContent = beats.length ? `第${num(Math.max(1, at + 1))}项／共${num(beats.length)}项` : '';
  }
  function show() {
    if (shown || T.courtHeld()) return;
    shown = true;
    clearTimeout(hideTimer);
    el.classList.remove('done', 'leaving');
    el.classList.add('on');
    chip.classList.remove('on');
    swapScene(true);
  }
  function hide(after = 0) {
    clearTimeout(swapTimer);
    clearTimeout(hideTimer);
    if (!shown) return;
    const go = () => { shown = false; el.classList.add('leaving'); hideTimer = setTimeout(() => { el.classList.remove('on', 'leaving', 'done'); if (rv) drawReview(); }, 700); };
    if (after) hideTimer = setTimeout(go, after); else go();
  }

  // ---------- 拍事件 ----------
  function start(list) {
    beats = (list || []).filter(Boolean);
    groups = [...new Set(beats.map((b) => b.group).filter(Boolean)), 'final'];
    at = 0;
    group = '';
    replaceChildren(annals);
    extra.textContent = '';
    fill.style.width = '6%';
    setGroup((beats[0] && beats[0].group) || 'entry');
    addAnnal((beats[0] && beats[0].id) || 'core-start');
    status();
    renderRail();
  }
  bus.on('turn:progress', (p) => {
    if (!running && p.type !== 'start') return;
    if (p.type === 'start') { running = true; start(p.beats); show(); return; }
    if (p.type === 'beat') {
      if (!beats.length) { const c = T.current(); if (c) start(c.beats); }
      if (!shown) show();
      if (p.pct) fill.style.width = `${Math.min(97, p.pct)}%`;
      if (p.index === at) return;                 // 流式同拍高频回调：只刷进度
      at = p.index;
      const b = beats[at] || p.beat;
      if (b && b.group) setGroup(b.group === 'render' && b.id === 'render-shiji' ? 'final' : b.group);
      if (b) addAnnal(b.id);
      status();
      renderRail();
      return;
    }
    if (p.type === 'label') { extra.textContent = p.label ? `另有　${p.label}` : ''; return; }
    if (p.type === 'pause') { hide(); return; }
    if (p.type === 'abort') { running = false; hide(); return; }
    if (p.type === 'done') {
      running = false;
      at = beats.length;
      fill.style.width = '100%';
      setGroup('final');
      renderRail();
      rail.querySelectorAll('li').forEach((li) => { li.classList.remove('now'); li.classList.add('done'); });
      now.textContent = '成卷';
      next.textContent = '次　待阅';
      el.classList.add('done');
      hide(1500);
    }
  });

  // ---------- 回合复核、应急恢复 ----------
  let rv = null, chipTimer = 0;
  const KIND = { review: '回合复核', recovery: '应急恢复' };
  function reviewLine(r) {
    return [`${KIND[r.kind]}·${r.phaseName}`, r.calls ? `调用${num(r.calls)}${r.maxCalls ? `／${num(r.maxCalls)}` : ''}` : '', r.steps ? `工步${num(r.steps)}` : '', r.repairs ? `拟修${num(r.repairs)}` : '']
      .filter(Boolean).join('　');
  }
  function stopBtn(r) {
    return r.over ? null : h('button', { type: 'button', onclick: () => { try { T.cancelReview(r.id, r.kind); } catch (e) { bus.emit('kernel:toast', { text: e.message }); } } }, '止之');
  }
  function drawReview() {
    clearTimeout(chipTimer);
    if (!rv) { replaceChildren(review); chip.classList.remove('on'); return; }
    replaceChildren(review, h('span', { title: rv.detail }, reviewLine(rv)), stopBtn(rv));
    replaceChildren(chip, h('b', KIND[rv.kind]), h('span', { title: rv.detail }, rv.over ? (rv.phase === 'verified' ? '已毕' : '已止') : reviewLine(rv).replace(/^[^·]+·/, '')), stopBtn(rv));
    chip.classList.toggle('on', !shown);
    chip.classList.toggle('over', rv.over);
    if (rv.over) chipTimer = setTimeout(() => { rv = null; chip.classList.remove('on'); replaceChildren(review); }, 5000);
  }
  bus.on('turn:review', (r) => { rv = r; drawReview(); });
  bus.on('turn:recovery-ask', (q) => {
    let answered = false;
    const j = juan({ title: '应急恢复', width: '30rem',
      content: h('p', { style: { margin: 0, lineHeight: 2 } }, '推演中有一处调用屡试不成。可另费若干调用查证、预检后修补，未经核验的改动不会落下。'),
      actions: [{ label: '查证并修补', onclick: ({ close }) => { answered = true; q.answer(true); close('ok'); } }] });
    j.closed.then(() => { if (!answered) q.answer(false); });
    const off = bus.on('turn:recovery-asked', () => { off(); if (!answered) { answered = true; j.close('sync'); } });
  });

  // 推演一开就上幕（内核的 start 稍后才到）；推演收尾时若幕还在（中止、出错），收起
  function begin() {
    running = true;
    beats = []; groups = ['entry', 'final']; at = -1; group = '';
    replaceChildren(annals);
    extra.textContent = '';
    fill.style.width = '2%';
    setGroup('entry');
    status();
    renderRail();
    show();
  }
  function end() { running = false; if (shown && !el.classList.contains('done')) hide(); }
  return { begin, end, get shown() { return shown; } };
}
