// 问天：局外之言——与推演 AI 直接对话。夜空为景（出了书房、出了局），左列在册指令（推演每回合回报遵否）与注入记忆，
// 中间是对话与 AI 的解读卷（拟落实什么、改哪个字段、确认后会不会被拒、有无歧义可点选澄清），底下分类（自动、叙事、设定、直改、诏令、天意）与问天。
// 一切经 game.wentian（adapter/wentian.js，老管线照用）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });

// 星图：一圈二十八宿刻度，几组星官连线（只作景）
function skyChart() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200');
  svg.classList.add('wt-chart');
  const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.append(n); return n; };
  for (const r of [96, 88, 62, 30]) add('circle', { cx: 0, cy: 0, r, class: 'ring' });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    add('line', { x1: Math.cos(a) * 88, y1: Math.sin(a) * 88, x2: Math.cos(a) * 96, y2: Math.sin(a) * 96, class: 'tick' });
  }
  const groups = [[[-40, -52], [-28, -60], [-14, -55], [-6, -66]], [[38, -20], [50, -8], [46, 8], [60, 16], [70, 6]], [[-58, 22], [-46, 34], [-50, 50], [-34, 56]], [[8, 40], [20, 52], [34, 46], [28, 66]], [[-12, -8], [0, 0], [12, -6]]];
  for (const g of groups) {
    add('polyline', { points: g.map((p) => p.join(',')).join(' '), class: 'xiu' });
    for (const [x, y] of g) add('circle', { cx: x, cy: y, r: 1.4, class: 'star' });
  }
  return svg;
}

export function createWentian({ root, game }) {
  const W = game.wentian;
  let opened = false;
  let cat = '';
  let busy = '';
  let snap = null;

  const side = h('aside.wt-side');
  const flow = h('div.wt-flow');
  const cats = h('div.wt-cats');
  const input = h('textarea.wt-in', { rows: 3, spellcheck: false, placeholder: '对推演 AI 说……（纠正推演、加入规则、补充内容；Ctrl+Enter 问天）',
    onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } } });
  const sendBtn = h('button.wt-go', { type: 'button', onclick: () => send() }, '问天');
  const tally = h('small.wt-tally');
  const tools = h('div.wt-tools',
    h('button', { type: 'button', onclick: () => importDoc() }, '导入文档'),
    h('button', { type: 'button', onclick: () => importMemory() }, '注入记忆'),
    h('button', { type: 'button', onclick: () => clearChat() }, '清空对话'),
    h('button.warn', { type: 'button', onclick: () => clearDirectives() }, '清除指令'), tally);
  const close = h('button.wt-close', { type: 'button', onclick: () => hide() }, '归', h('small', '回案'));
  const el = h('section.wt-ov', { role: 'dialog', 'aria-label': '问天' },
    h('div.wt-sky'), skyChart(),
    h('header.wt-head', h('h2', '问天'), h('p', '与推演 AI 直言 · 局外之言，下回合生效'), close),
    h('div.wt-body', side, h('main.wt-main', flow)),
    h('footer.wt-foot', cats, h('div.wt-say', input, sendBtn), tools));
  root.append(el);

  // ---------- 左列 ----------
  function renderSide(s) {
    const dirs = s.directives.length ? s.directives.map((d) => h('div.wt-dir.' + d.tone + (d.absolute ? '.abs' : ''),
      h('p.top', h('b', `第${num(d.turn || 0)}回合`), h('span', d.kind), d.absolute ? h('em.abs', '天意') : null, h('em.' + d.tone, { title: d.reason || '' }, d.status),
        d.watch ? h('em.dim', d.watch) : null, d.stale ? h('em.bad', '久未遵·宜裁撤') : null,
        h('span.ops', d.canUndo ? h('button', { type: 'button', title: '回滚本条直改（仅限当回合）', onclick: () => act(() => W.undo(d.id)) }, '撤') : null,
          h('button', { type: 'button', title: '裁撤此条', onclick: () => act(() => W.removeDirective(d.i)) }, '✕'))),
      h('p.txt', d.text), d.structured ? h('p.st', d.structured) : null, d.evidence ? h('p.ev', `上回合执行：${d.evidence.slice(0, 60)}`) : null,
      d.reason && d.tone !== 'new' ? h('p.why', d.reason) : null)) : [h('p.wt-none', '尚无在册指令')];
    const mems = s.memories.map((m) => h('div.wt-mem', h('span', m.type === 'document' ? '文档' : m.target ? `记·${m.target}` : '背景'), h('b', m.title),
      h('button', { type: 'button', title: '撤去', onclick: () => act(() => W.removeMemory(m.i)) }, '✕')));
    replaceChildren(side, h('h5', '在册指令', h('small', num(s.directives.length))), h('div.wt-dirs', dirs),
      s.memories.length ? [h('h5', '注入记忆', h('small', num(s.memories.length))), h('div.wt-mems', mems)] : null);
    tally.textContent = `指令${num(s.directives.length)} · 记忆${num(s.memories.length)}`;
  }

  // ---------- 对话与解读卷 ----------
  function pendingCard(p) {
    const c = h('div.wt-pend.' + (p.category || 'narrative'),
      h('p.head', h('span', 'AI 解读'), h('b', p.label), h('small', [p.kind, p.forced ? '玩家指定' : 'AI 自定'].filter(Boolean).join(' · '))),
      h('p.hint', p.hint),
      p.interpretation ? h('p.int', p.interpretation) : null,
      p.structured.length ? h('p.st', p.structured.map(([k, v]) => h('span', h('b', k), v))) : null,
      p.changes.length ? h('div.chg', p.changes.map((x) => h('p' + (x.ok === false ? (p.absolute ? '.warn' : '.bad') : x.ok ? '.ok' : ''),
        h('i', x.ok === true ? '✓' : x.ok === false ? (p.absolute ? '⚠' : '✗') : '·'), h('code', x.path), h('em', x.op), h('code', x.value), x.note ? h('small', x.note) : null,
        x.reason ? h('span.r', x.reason) : null, x.ghost ? h('span.r', x.ghost) : null))) : null,
      p.trace.length ? h('p.trace', `已查证：${p.trace.join(' → ')}`) : null,
      p.operations.map((o) => h('p.op', `拟落实：${o}`)),
      p.edict ? h('p.edict', h('span', p.edict.label), `「${p.edict.text}」`) : null,
      p.ambiguity.length ? h('div.amb', h('span', '有歧义'), p.ambiguity.map((q) => h('p', q))) : null,
      p.clarify ? h('div.clar', h('p', `？${p.clarify.question}`), p.clarify.options.map((o, i) => h('button', { type: 'button', onclick: () => run(() => W.clarify(i), '带澄清重问') }, o))) : null,
      p.plan ? h('p.plan', `→ ${p.plan}`) : null,
      h('div.acts',
        h('button.go' + (p.absolute ? '.abs' : ''), { type: 'button', onclick: () => act(() => W.confirm()) }, p.confirm),
        !p.absolute ? h('button.abs', { type: 'button', title: '标为天意·世界法则强制生效', onclick: () => run(() => W.promote(), '升为天意') }, '标为至高') : null,
        h('button', { type: 'button', onclick: () => act(() => { const v = W.revise(); input.value = v; input.focus(); }) }, '再议'),
        h('button.warn', { type: 'button', onclick: () => act(() => W.cancel()) }, '取消')));
    return c;
  }
  function renderFlow(s) {
    const items = [h('p.wt-intro', '问天——AI 解读你的话，确认后入库；在册指令每回合回报执行状况。')];
    for (const x of s.history) items.push(h('div.wt-msg' + (x.me ? '.me' : ''), h('p', x.text)));
    if (busy || s.thinking) items.push(h('div.wt-msg.think', h('p', s.thinking || `${busy}……`), h('i.au-brush')));
    if (s.pending && !busy) items.push(pendingCard(s.pending));
    replaceChildren(flow, items);
    requestAnimationFrame(() => { flow.scrollTop = flow.scrollHeight; });
  }
  function renderCats() {
    replaceChildren(cats, h('span', '分类'), W.CATS.map(([k, label, note]) => h('button.' + (k || 'auto') + (k === cat ? '.on' : ''), { type: 'button', title: note, onclick: () => { cat = k; try { W.setCategory(k); } catch (e) { toast(e.message); } renderCats(); } }, label)));
  }
  function render() {
    try { snap = W.snapshot(); } catch (e) { toast(e.message); return; }
    renderSide(snap);
    renderFlow(snap);
    renderCats();
    sendBtn.disabled = !!busy || !!snap.pending;
  }
  bus.on('wentian:changed', () => { if (opened) render(); });

  // ---------- 动作 ----------
  function act(f) { try { f(); } catch (e) { toast(e.message); } render(); }
  async function run(f, label) {
    if (busy) return;
    busy = label;
    render();
    try { await f(); } catch (e) { toast(e.message); } finally { busy = ''; render(); }
  }
  function send() {
    const v = input.value.trim();
    if (!v) return;
    if (snap && snap.pending) { toast('上一条尚待确认或取消'); return; }
    input.value = '';
    run(() => W.send(v, cat), 'AI 正在解读');
  }
  function importDoc() {
    const f = h('input', { type: 'file', accept: '.txt,.md,.json,.log' });
    f.addEventListener('change', () => {
      const file = f.files && f.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => { act(() => W.importDoc(file.name, String(r.result || ''))); toast(`文档已导入：${file.name}`); };
      r.readAsText(file);
    });
    f.click();
  }
  function importMemory() {
    const target = h('input.wt-field', { placeholder: '角色名（留空＝全局背景）' });
    const content = h('textarea.wt-field', { rows: 8, placeholder: '粘贴对话记录或背景文字……' });
    juan({ title: '注入记忆', note: '作为人物记忆或全局背景注入推演', width: '34rem',
      content: h('div.wt-form', h('label', '目标人物', target), h('label', '记忆内容', content)),
      actions: [{ label: '注入', onclick: ({ close: c }) => { try { W.importMemory(target.value.trim(), content.value); c('ok'); } catch (e) { toast(e.message); } render(); } }] });
  }
  function ask(title, text, f) {
    juan({ title, width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, text),
      actions: [{ label: '确定', onclick: ({ close: c }) => { c('ok'); act(f); } }] });
  }
  function clearChat() { ask('清空对话', '清空问天对话记录？已注入的指令与记忆原样保留。', () => W.clearChat()); }
  function clearDirectives() { ask('清除指令', '清除所有在册指令？此后推演不再参照。', () => W.clearDirectives()); }

  function show() {
    try { W.open(); } catch (e) { toast(e.message); }
    cat = '';
    try { W.setCategory(''); } catch (_e) { /* 内核未就绪 */ }
    render();
    el.classList.add('on');
    opened = true;
    setTimeout(() => input.focus(), 300);
  }
  function hide() {
    el.classList.remove('on');
    opened = false;
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape' && (document.activeElement !== input || !input.value.trim())) { e.stopPropagation(); hide(); }
  }, true);
  game.on('game:changed', () => { if (opened && !busy) render(); });
  return { show, hide, get opened() { return opened; } };
}
