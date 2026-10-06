// 启幕：窗前低机位，西墙中堂「奉天承運 治亂由人」；左侧黑漆描金卷目（開卷、續卷、著卷、典章），右下传世诸卷。
// 開卷：选卷 → 开场白 → 落座（按身份：臨朝、视事……；内核开局）→ 镜头走到案后落座。續卷：选存档 → 读档 → 落座。
import { h } from '../core/dom.js';
import { juan, yapai, qianzi, zhou, loadFonts } from '../kit/index.js';
import { num } from '../core/numerals.js';
import { SHOTS, TITLE_TO_DESK } from '../scene/study/shots.js';
import { profileOf } from '../model/identity.js';
import { openSettings } from './settings.js';

const BOARD = [
  { key: 'new', label: '開卷', note: '另起新篇', primary: true },
  { key: 'load', label: '續卷', note: '接续前篇' },
  { key: 'author', label: '著卷', note: '自撰史卷' },
  { key: 'rules', label: '典章', note: '规制条例' }
];

export function createTitle({ root, stage, study, game, onEnter }) {
  const board = h('nav.q-qi.board', { 'aria-label': '卷目' });
  const foot = h('div.foot', h('span', '传世诸卷'));
  const el = h('section.scr.scr-title', h('div.shade'), board, foot);
  root.append(el);
  let busy = false;

  for (const b of BOARD) {
    board.append(h('button' + (b.primary ? '.primary' : ''), { type: 'button', onclick: () => act(b.key) }, h('b.q-gold', b.label), h('small', b.note)));
  }
  const fill = () => {
    const list = game.scenarios().filter((s) => s.official);
    foot.replaceChildren(h('span', list.length === 3 ? '传世三卷' : '传世诸卷'),
      ...list.map((s) => h('button.ce', { type: 'button', title: s.name, onclick: () => pickScenario(s.id) }, h('b', shortName(s.name)))));
  };

  // 镜头极慢地往里推、微微抬头
  let drift = true;
  study.onFrame((t, camera) => {
    if (!drift || study.flightProgress != null) return;
    const base = SHOTS.title;
    const k = Math.min(1, t / 70), e = k * k * (3 - 2 * k);
    camera.position.set(base.pos[0] - e * 220, base.pos[1] - e * 30, base.pos[2] - e * 260);
    camera.lookAt(...base.look);
  });

  function act(key) {
    if (busy) return;
    if (key === 'new') pickScenario();
    else if (key === 'load') pickSave();
    else if (key === 'rules') openSettings();
    else juan({ title: '著卷', note: '剧本工坊', width: '34rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '剧本工坊沿用旧版界面，不在此番重做之列；新前端整体切换时由此处直通旧版工坊。') });
  }

  // ---------- 開卷：选卷 ----------
  function pickScenario(preset) {
    const list = game.scenarios();
    let chosen = preset || (list.find((s) => s.official) || list[0])?.id;
    let mode = 'yanyi';
    const items = list.map((s) => {
      const item = h('button.pick-item' + (s.id === chosen ? '.on' : ''), { type: 'button', onclick: () => { chosen = s.id; items.forEach((x) => x.classList.toggle('on', x === item)); } },
        h('div.ce', h('b', shortName(s.name))),
        h('div', h('h4', s.name), h('div.era', [s.era, s.role].filter(Boolean).join(' · ')), s.background ? h('p', s.background.slice(0, 120) + (s.background.length > 120 ? '……' : '')) : null));
      return item;
    });
    const modes = qianzi([{ value: 'yanyi', label: '演义' }, { value: 'strict_hist', label: '史实' }], { value: mode, onchange: (v) => { mode = v; } });
    const j = juan({
      title: '開卷', note: '择一段时日入其世', width: '52rem', height: 'min(44rem, 80vh)',
      content: h('div', h('div.pick-list', items), h('div.pick-opts', h('span', '推演之法'), modes, h('small', { style: { color: 'var(--ink-faint)' } }, '演义任 AI 铺陈；史实依史料约束推演'))),
      actions: [{ label: '展卷', onclick: ({ close }) => { close('ok'); startNew(chosen, mode); } }]
    });
    return j;
  }

  // 开新局：开场白由内核在开局途中交来（game:opening），演完调 begin() 继续
  async function startNew(sid, gameMode) {
    if (!sid || busy) return;
    busy = true;
    el.classList.remove('on');
    const off = game.once('game:opening', (o) => showOpening(o));
    try {
      await game.newGame(sid, { gameMode });
      await enterDesk();
    } catch (err) {
      off();
      busy = false;
      el.classList.add('on');
      juan({ title: '未能開卷', width: '30rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, String(err && err.message || err)) });
    }
  }

  async function showOpening(o) {
    await loadFonts({ 'TM-WenKai': o.opening + (o.player && o.player.bio || ''), 'TM-MaShanZheng': o.name + (o.player && o.player.clean || '') });
    const who = h('div.who',
      zhou({ name: o.player.clean || o.player.name, src: o.player.portrait || '' }),
      h('h4', o.player.clean || o.player.name), o.player.title ? h('small', o.player.title) : null,
      o.player.bio ? h('small', { style: { textAlign: 'left', lineHeight: 1.7 } }, o.player.bio) : null,
      o.eyes && o.eyes.length ? h('ul.eyes', o.eyes.map((e) => h('li', h('b', e.ti), e.ds ? h('div', e.ds) : null))) : null);
    juan({
      title: o.name.split(/——|—/)[0] || o.name, note: o.name.split(/——|—/)[1] || '', width: '58rem', height: 'min(40rem, 80vh)', closable: false,
      content: h('div.opening', h('div.text', o.opening), who),
      actions: [{ label: profileOf(o.perspective || game.perspective()).enter, onclick: ({ close }) => { close('ok'); o.begin(); } }]
    });
  }

  // ---------- 續卷：选存档 ----------
  async function pickSave() {
    const list = await game.saves.list();
    const rows = list.length
      ? list.map((s) => h('button.pick-item', { type: 'button', onclick: () => { j.close('ok'); startLoad(s.key); } },
        h('div.ce', h('b', s.auto ? '自动' : shortName(s.name))),
        h('div', h('h4', s.name || '无名'), h('div.era', [s.scenario, s.turn ? `第${num(s.turn)}回合` : '', s.time].filter(Boolean).join(' · ')),
          s.modified ? h('p', new Date(s.modified).toLocaleString('zh-CN', { hour12: false })) : null)))
      : [h('p', { style: { margin: 0 } }, '尚无封存之卷。')];
    const j = juan({ title: '續卷', note: '启封旧卷，承续前局', width: '46rem', height: 'min(40rem, 80vh)', content: h('div.pick-list', rows) });
  }

  async function startLoad(key) {
    if (busy) return;
    busy = true;
    el.classList.remove('on');
    try {
      await game.saves.load(key);
      await enterDesk();
    } catch (err) {
      busy = false;
      el.classList.add('on');
      juan({ title: '未能启封', width: '30rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, String(err && err.message || err)) });
    }
  }

  // 从窗前走到案后、落座俯看
  async function enterDesk() {
    drift = false;
    for (const leg of TITLE_TO_DESK) await study.flyTo({ pos: leg.pos, look: leg.look, fov: leg.fov }, leg.duration);
    study.setShot('desk');
    busy = false;
    onEnter();
  }

  return {
    async show() {
      fill();
      drift = true;
      study.setShot('title');
      el.classList.add('on');
    },
    hide() { el.classList.remove('on'); drift = false; }
  };
}

// 题签上写简名：「天启七年·九月——君王初立，权阉当国」→「天启七年」
function shortName(name) {
  return String(name || '').split(/[·—（(]/)[0].slice(0, 6);
}
