// 案卷目录：自动、手存诸卷、过回合前快照、桌面卷宗与桌面自动存档。每卷一枚书衣卷签：启封、重新封缄、抄送副本、付之丙火；
// 卷末封存此卷、调入外卷。启幕「續卷」与书案「存」都开此卷（启幕时不能封存）。存读经 game.saves。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const when = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '');
const short = (name) => String(name || '').split(/[·—（(\s]/)[0].slice(0, 6) || '案卷';

function confirmScroll({ title, text, ok, danger }) {
  return new Promise((resolve) => {
    let yes = false;
    const j = juan({ title, width: '30rem', content: h('p', { style: { margin: 0, lineHeight: 2, color: danger ? '#8a2a1c' : '' } }, text),
      actions: [{ label: ok, onclick: ({ close }) => { yes = true; close('ok'); } }] });
    j.closed.then(() => resolve(yes));
  });
}
function askName(defaultName) {
  return new Promise((resolve) => {
    let name = null;
    const input = h('input.st-in', { type: 'text', value: defaultName, style: { width: '100%' } });
    const j = juan({ title: '为此卷命名', width: '30rem', content: input,
      actions: [{ label: '封存', onclick: ({ close }) => { name = input.value.trim() || defaultName; close('ok'); } }] });
    setTimeout(() => { input.focus(); input.select(); }, 400);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { name = input.value.trim() || defaultName; j.close('ok'); } });
    j.closed.then(() => resolve(name));
  });
}

export function openSaves({ game, inGame = false, onLoaded }) {
  const body = h('div.sv');
  let j = null;
  let busy = false;

  async function render() {
    replaceChildren(body, h('p.sv-none', '检阅案卷……'));
    const L = await game.saves.list();
    const card = (s, opts = {}) => h('div.sv-card' + (s.auto ? '.auto' : ''),
      h('div.ce', h('b', s.auto ? '自动' : short(s.name))),
      h('div.sv-info',
        h('h4', s.name || '无名之卷'),
        h('div.sv-meta', [s.scenario, s.time, s.turn ? `第${num(s.turn)}回合` : ''].filter(Boolean).join(' · ')),
        s.modified ? h('small', `封存于 ${when(s.modified)}`) : null),
      h('div.sv-acts',
        h('button.q-yapai', { type: 'button', onclick: () => load(s) }, '启封'),
        inGame && s.slot != null ? h('button.q-yapai', { type: 'button', onclick: () => resave(s) }, '重新封缄') : null,
        s.slot != null ? h('button.q-yapai', { type: 'button', onclick: () => exportSlot(s) }, '抄送副本') : null,
        s.slot != null && !s.auto ? h('button.q-yapai.danger', { type: 'button', onclick: () => burn(s) }, '付之丙火') : null,
        opts.extra || null));
    const autos = L.slots.filter((s) => s.auto), manual = L.slots.filter((s) => !s.auto);
    replaceChildren(body,
      !L.slots.length && !L.pre && !L.desktop.length ? h('p.sv-none', '尚无封存之卷。') : null,
      autos.length ? h('section', h('h5', '自动封存'), autos.map((s) => card(s))) : null,
      manual.length ? h('section', h('h5', `手存诸卷 · ${num(manual.length)}`), manual.map((s) => card(s))) : null,
      L.pre ? h('section', h('h5', '过回合前快照'), h('p.sv-note', '回到本回合推演开始前：所拟所批、对话调动都在，推演须重来。'), card({ ...L.pre, slot: null })) : null,
      L.desktop.length || L.desktopAuto ? h('section', h('h5', '桌面卷宗'),
        L.desktopAuto ? h('div.sv-row', h('button.q-yapai', { type: 'button', onclick: () => load({ key: 'deskauto', name: '桌面自动存档' }) }, '读取桌面自动存档'), h('small', '最近一次桌面定时备份，读取不删原档')) : null,
        L.desktop.map((s) => card({ ...s, slot: null }))) : null);
  }

  async function load(s) {
    if (busy) return;
    if (inGame && !(await confirmScroll({ title: '启封此卷？', text: '一经启封，当前推演进度将被覆盖（若未封存）。', ok: '启封' }))) return;
    busy = true;
    toast('史官正在抄录副本……');
    try {
      await game.saves.load(s.key);
      j && j.close('ok');
      onLoaded && onLoaded();
    } catch (err) {
      toast(String(err && err.message || err));
    } finally { busy = false; }
  }
  async function resave(s) {
    const name = await askName(s.name || '案卷');
    if (name == null) return;
    const ok = await game.saves.save(name, { slot: s.slot });
    toast(ok ? '已封存' : '封存未成');
    render();
  }
  function exportSlot(s) {
    try { game.saves.exportSlot(s.slot); toast('副本已抄出'); } catch (err) { toast(String(err && err.message || err)); }
  }
  async function burn(s) {
    if (!(await confirmScroll({ title: '付之丙火？', text: '此举不可逆。卷成灰烬，再难追寻。', ok: '付之丙火', danger: true }))) return;
    const ok = await game.saves.remove(s.slot);
    toast(ok ? '已焚' : '未能焚毁');
    render();
  }
  async function saveNew() {
    const d = game.select.date();
    const name = await askName(`${d.text || '案卷'} 纪要`);
    if (name == null) return;
    const ok = await game.saves.save(name);
    toast(ok ? '已封存' : '封存未成');
    render();
  }
  function importFile() {
    const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const { slots } = await game.saves.list();
      const used = new Set(slots.map((s) => s.slot));
      let slot = 1;
      while (used.has(slot) && slot < 9) slot++;
      const ok = await game.saves.importFile(file, slot);
      toast(ok ? `外卷已归入第${num(slot)}槽` : '外卷未能调入');
      render();
    });
    document.body.append(input);
    input.click();
  }

  render();
  j = juan({
    title: '案卷目录', note: inGame ? '封存与启封' : '启封旧卷，承续前局', width: '54rem', height: 'min(42rem, 84vh)', content: body,
    actions: [...(inGame ? [{ label: '封存此卷', onclick: () => saveNew() }] : []), { label: '调入外卷', onclick: () => importFile() }]
  });
  return j;
}
