// 见：朝议（常朝、廷议、御前会议）。书房换景（朝议望宝座，御前会议在窗前），左列朝班（与会者与其立场），右展竖写的朝议实录：
// 「上曰」与诸臣奏对，流式发言一字字落进最左一行；案底是此刻可做之事（老流程当下挂出的按钮，镜成签）与插言。
// 筹备（议题、类型、与会者、记录方式）、二级输入、择一的浮层、散朝总结都画成卷；廷议各阶段的层（预审、站班、廷推、草诏、用印、补述）
// 画成「表单卷」：说明照录，输入照填，可点项一律成选项。一切经 game.court（adapter/court.js 镜老流程）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, qianzi, loadFonts, closeScrolls } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const STANCE_CLS = { 支持: 'sup', 反对: 'opp', 中立: 'neu', 折中: 'med', 另议: 'alt' };
const CANCEL = /取消|^罢|暂不|关闭/;

export function createCourt({ root, study, game, profile, onClose }) {
  const C = game.court;
  let opened = false;
  let snap = null;
  let kind = '';
  const nodes = new Map();      // 实录条目号 → { el, text }
  let overlayJuan = null, overlayId = '', formText = null;
  let setupJuan = null;

  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const leave = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => C.close() }, h('b.q-gold', '退朝'), h('small', '收卷'));
  const topicEl = h('div.ct-topic');
  const rosterTitle = h('h3.q-ti', h('span.q-gold', '朝班'));
  const rosterList = h('div.ct-roster-list.q-scroll');
  const roster = h('aside.ct-roster.q-qi', rosterTitle, rosterList);
  const flow = h('div.au-flow.ct-flow');
  const rec = h('article.au-rec.ct-rec', flow);
  const statusEl = h('p.ct-status');
  const slips = h('div.ct-slips');
  const say = h('textarea.au-in.ct-in', { rows: 2, spellcheck: false, placeholder: '插言……（Ctrl+Enter 递上）',
    onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); speak(); } } });
  const sayBtn = h('button.slip', { type: 'button', onclick: () => speak() }, '插言');
  const sayBox = h('div.ct-say', say, sayBtn);
  const bar = h('div.ct-bar', h('div.ct-ctl', statusEl, slips), sayBox);
  const el = h('section.scr.scr-court', crumb, leave, topicEl, roster, rec, bar);
  root.append(el);
  flow.addEventListener('wheel', (e) => {
    if (flow.scrollWidth <= flow.clientWidth) return;
    e.preventDefault();
    flow.scrollLeft -= e.deltaY || e.deltaX;
  }, { passive: false });

  const T = () => profile().audience;
  const modeName = (k) => (C.MODES.find(([m]) => m === k) || [, ''])[1];
  // ---------- 实录 ----------
  function entryEl(e) {
    const t = T();
    if (e.role === 'divider') return h('p.ct-divider', e.text);
    if (e.role === 'note') return h('p.au-note', /^[（(【〔]/.test(e.text) ? e.text : `（${e.text}）`);
    if (e.role === 'me') return h('p.au-me', h('b', t.me + t.ask, '：'), h('span.au-text', e.text.replace(/^(朕|陛下)[:：]\s*/, '')));
    const tag = e.stance ? h('em.ct-st.' + (STANCE_CLS[e.stance] || 'neu'), e.stance) : null;
    return h('p.au-them' + (e.streaming ? '.live' : ''), h('b', e.name, e.title ? h('small', `（${e.title}）`) : null, tag, '：'), h('span.au-text', e.streaming ? '……' : e.text),
      e.candor ? h('span.ct-candor', `〔${e.candor}〕`) : null, e.streaming ? h('i.au-brush') : null);
  }
  function renderEntries(list) {
    let grew = false;
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      const key = `${e.text}|${e.stance || ''}|${e.streaming ? 1 : 0}`;
      const old = nodes.get(e.id);
      if (old && old.key === key) continue;
      const node = entryEl(e);
      if (old) old.el.replaceWith(node); else flow.append(node);
      nodes.set(e.id, { el: node, key });
      grew = true;
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { n.el.remove(); nodes.delete(id); }
    if (grew) requestAnimationFrame(() => { flow.scrollLeft = -flow.scrollWidth; });
  }
  function renderRoster(s) {
    let list = s.roster.map((r) => (typeof r === 'string' ? { name: r } : r));
    if (!list.length) {
      const last = new Map();
      for (const e of s.entries) if (e.role === 'them' && e.name) last.set(e.name, e.stance || (last.get(e.name) || ''));
      list = [...last].map(([name, stance]) => ({ name, stance }));
    }
    const lastSpeaker = [...s.entries].reverse().find((e) => e.role === 'them');
    rosterTitle.querySelector('span').textContent = s.kind === 'yuqian' ? '心腹' : '朝班';
    replaceChildren(rosterList, list.length ? list.map((r) => h('div.ct-mem' + (lastSpeaker && lastSpeaker.name === r.name ? '.speaking' : ''),
      h('b', r.name), r.stance ? h('em.ct-st.' + (STANCE_CLS[r.stance] || 'neu'), r.stance) : null, r.candor ? h('small', `坦${num(r.candor)}`) : null)) : [h('p.au-none', '入殿仪礼中……')]);
  }
  function renderControls(s) {
    statusEl.textContent = s.status || '';
    replaceChildren(slips, s.controls.map((c) => h('button.slip' + (c.go ? '.go' : '') + (c.danger ? '.danger' : ''), { type: 'button', title: c.title, onclick: () => pressCtl(c) }, c.label)));
    sayBox.classList.toggle('off', !s.input);
  }
  function pressCtl(c) {
    if (!c.prompts) { run(() => C.press(c.id)); return; }
    askText(c.ask ? `问${c.ask}` : c.label, c.ask ? `欲问${c.ask}何事？` : `${profile().self}欲言……`, (text) => run(() => C.press(c.id, text)));
  }
  function askText(title, hint, done) {
    const ta = h('textarea.au-order', { rows: 3, placeholder: hint });
    juan({ title, width: '32rem', content: ta, actions: [{ label: '递上', onclick: ({ close }) => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } close('ok'); done(v); } }] });
    setTimeout(() => ta.focus(), 400);
  }
  function speak() {
    const v = say.value.trim();
    if (!v) return;
    say.value = '';
    run(() => C.speak(v));
  }
  function run(f) { try { f(); } catch (e) { toast(e.message); } }

  // ---------- 浮层：菜单、二级输入、散朝、表单卷 ----------
  function renderOverlay(o) {
    const id = !o ? '' : o.type === 'form' ? `form:${o.id}:${o.fields.map((f) => f.id).join(',')}:${o.buttons.map((b) => b.key + b.label).join('|')}` : `${o.type}:${o.id}`;
    if (id === overlayId) {
      // 同一层只是说明变了（如预审的党派风向随议题更新）：就地改字，不重开卷
      if (o && o.type === 'form' && formText && formText.textContent !== o.text) { formText.textContent = o.text; formText.hidden = !o.text; }
      return;
    }
    if (overlayJuan) { const j = overlayJuan; overlayJuan = null; j.close('sync'); }
    overlayId = id;
    formText = null;
    if (!o) return;
    if (o.type === 'form') {
      overlayJuan = formJuan(o);
    } else if (o.type === 'seating') {
      overlayJuan = seatingJuan(o);
    } else if (o.type === 'menu') {
      overlayJuan = juan({ title: o.title || '择一', width: '30rem', content: h('div.au-pick', o.buttons.map((b) => h('button.au-pick-row', { type: 'button', title: b.title, onclick: () => pressCtl(b) }, h('b', b.label)))) });
    } else if (o.type === 'input') {
      const f = o.field;
      let field;
      if (f && f.tag === 'select') field = qianziOrList(f.options);
      else field = h('textarea.au-order', { rows: 3, placeholder: (f && f.placeholder) || '' }, (f && f.value) || '');
      overlayJuan = juan({ title: o.title || '输入', width: '32rem', content: field.el || field,
        actions: [{ label: '确定', onclick: ({ close }) => { const v = field.getValue ? field.getValue() : field.value; close('ok'); run(() => C.answer(v)); } }] });
    } else if (o.type === 'summary') {
      overlayJuan = juan({ title: '散朝', width: '40rem', height: 'min(34rem, 80vh)', content: h('div.ct-summary', o.text),
        actions: o.buttons.map((b) => ({ label: b.label, onclick: ({ close }) => { close('ok'); run(() => C.press(b.id)); } })) });
    }
    if (overlayJuan) {
      const mine = overlayJuan;
      mine.closed.then((why) => {
        if (why !== 'dismiss' || overlayJuan !== mine) return;
        overlayJuan = null;
        // 玩家径自收卷：菜单与输入按老流程的取消处理，散朝按第一颗（关闭）
        const s = C.snapshot();
        const ov = s.overlay;
        if (!ov) return;
        if (ov.type === 'input' && ov.cancel) run(() => C.press(ov.cancel));
        else if (ov.type === 'summary' && ov.buttons[0]) run(() => C.press(ov.buttons[0].id));
        else if (ov.type === 'menu') { const cancel = ov.buttons.find((b) => /取消|罢|免/.test(b.label)); if (cancel) run(() => C.press(cancel.id)); }
        else if (ov.type === 'form') { const cancel = ov.buttons.find((b) => CANCEL.test(b.label)); if (cancel) run(() => C.press(cancel.id)); }
        else if (ov.type === 'seating' && ov.cancel) run(() => C.press(ov.cancel.id));
      });
    }
  }
  // 下拉改成一列可点的行；value 不给则默认首项，给了而不在列中则一项不选
  function qianziOrList(options, initial, onpick) {
    let value = initial === undefined ? (options[0] ? options[0].value : '') : initial;
    const rows = options.map((o) => h('button.au-pick-row', { type: 'button', onclick: () => { setValue(o.value); onpick?.(o.value); } }, h('b', o.label)));
    function setValue(v) {
      value = v;
      rows.forEach((b, i) => b.classList.toggle('on', options[i].value === v));
    }
    setValue(value);
    return { el: h('div.au-pick', rows), getValue: () => value, setValue };
  }
  // 起议站班：上书议题与主奏，一道朝堂潮汐（同、中、异三色），下分左中右三班，各班按党列名
  const SIDE_CLS = { left: 'sup', center: 'neu', right: 'opp' };
  const SIDE_NAME = { left: '左班', center: '中班', right: '右班' };
  function seatingJuan(o) {
    const tide = h('div.ct-tide', ['left', 'center', 'right'].filter((k) => o.tide[k] > 0).map((k) =>
      h('i.' + SIDE_CLS[k], { style: { flexGrow: String(o.tide[k]) } }, o.tide[k] >= 8 ? `${{ left: '同', center: '中', right: '异' }[k]} ${num(o.tide[k])}%` : '')));
    const bench = (b) => h('section.ct-bench.' + SIDE_CLS[b.side],
      h('h4', h('b', SIDE_NAME[b.side]), h('span', b.label), h('small', `${num(b.count)}人`)),
      b.groups.length ? b.groups.map((g) => h('div.ct-bench-party', h('h5', g.party || '无党', h('small', num(g.names.length))), h('p', g.names.map((n) => h('span', n)))))
        : h('p.au-none', '无人'));
    const j = juan({
      title: '起议站班', note: o.topic, width: '60rem', closable: !!o.cancel,
      content: h('div.ct-seating',
        o.proposer ? h('p.ct-proposer', h('small', '主奏'), o.proposer) : null,
        h('div.ct-row', h('span', '朝堂潮汐'), tide),
        h('div.ct-benches', o.benches.map(bench))),
      actions: [o.go ? { label: o.go.label, onclick: () => run(() => C.press(o.go.id)) } : null,
        o.cancel ? { label: o.cancel.label, onclick: ({ close }) => { close('ok'); run(() => C.press(o.cancel.id)); } } : null].filter(Boolean)
    });
    loadFonts({ 'TM-WenKai': o.benches.map((b) => b.label + b.groups.map((g) => g.party + g.names.join('')).join('')).join('') + o.proposer });
    return j;
  }
  // 表单卷：说明（可随老层更新）、几项输入（边写边填回老层）、一列可点项；有「罢、取消、暂不」一类的项才许径自收卷，收卷即按它
  function formJuan(o) {
    const ctls = new Map();
    const rows = o.fields.map((f) => {
      let ctl;
      if (f.tag === 'select') {
        ctl = qianziOrList(f.options.filter((x) => x.value !== ''), f.value, (v) => sync({ [f.id]: v }));
      } else {
        const inp = f.tag === 'textarea' ? h('textarea.au-order', { rows: 3, placeholder: f.placeholder }) : h('input.ct-topicin', { type: 'text', placeholder: f.placeholder });
        inp.value = f.value;
        let t = 0;
        inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => sync({ [f.id]: inp.value }), 260); });
        ctl = { el: inp, getValue: () => inp.value, setValue: (v) => { if (document.activeElement !== inp) inp.value = v; } };
      }
      ctls.set(f.id, ctl);
      return h('div.ct-row.ct-field' + (f.tag === 'select' ? '.list' : '') + (f.label.length > 6 ? '.long' : ''), h('span', f.label), ctl.el);
    });
    const values = () => Object.fromEntries([...ctls].map(([id, c]) => [id, c.getValue()]));
    // 填一项，再把老层因此改动的别项读回来（如从待议册选一题，议题框随之填上）
    function sync(v) {
      let back = {};
      try { back = C.fill(v); } catch (e) { toast(e.message); }
      for (const [id, val] of Object.entries(back)) if (!(id in v)) ctls.get(id)?.setValue(val);
    }
    const cancel = o.buttons.find((b) => CANCEL.test(b.label));
    const picks = o.buttons.filter((b) => b !== cancel);
    formText = h('div.ct-formtext.q-scroll', o.text);
    formText.hidden = !o.text;
    // 要讨文字的项（如单独深言某人）先开一卷问话，再连字递交
    const go = (b) => {
      if (!b.prompts) { run(() => C.submit(values(), b.id)); return; }
      const v = values();
      askText(b.ask ? `问${b.ask}` : b.label, b.ask ? `欲问${b.ask}何事？` : `${profile().self}欲言……`, (text) => run(() => C.submit(v, b.id, text)));
    };
    const j = juan({
      title: o.title, width: '42rem', closable: !!cancel,
      content: h('div.ct-form', formText, rows.length ? h('div.ct-fields', rows) : null,
        picks.length ? h('div.au-pick', picks.map((b) => h('button.au-pick-row' + (b.danger ? '.danger' : ''), { type: 'button', onclick: () => go(b) }, h('b', b.label), b.title ? h('small', b.title) : null))) : null),
      actions: cancel ? [{ label: cancel.label, onclick: ({ close }) => { close('ok'); go(cancel); } }] : []
    });
    setTimeout(() => { const first = rows.length && rows[0].querySelector('input, textarea'); if (first) first.focus(); }, 400);
    return j;
  }

  // ---------- 筹备 ----------
  function renderSetup(st) {
    if (!st) { if (setupJuan) { const j = setupJuan; setupJuan = null; j.close('sync'); } return; }
    if (setupJuan) return;
    closeScrolls();
    const yq = st.kind === 'yuqian';
    const topic = h('input.ct-topicin', { type: 'text', value: st.topic, placeholder: st.placeholder });
    let pending = '';
    const pend = st.pending.length ? h('div.ct-pend', h('small', '待议之题'), st.pending.map((p) => h('button', { type: 'button', onclick: () => { pending = p.value; topic.value = p.label; } }, p.label))) : null;
    const types = qianzi(st.types.map((x) => ({ value: x.value, label: x.label })), { value: (st.types.find((x) => x.checked) || st.types[0] || {}).value, onchange: (v) => { custom.hidden = v !== 'other'; } });
    const custom = h('input.ct-topicin', { type: 'text', value: st.custom, placeholder: '若选其他，描述议题性质……' });
    custom.hidden = types.getValue() !== 'other';
    const picked = new Set(st.people.filter((p) => p.checked).map((p) => p.value));
    const countEl = h('small');
    const people = h('div.ct-people', st.people.map((p) => {
      const b = h('button' + (picked.has(p.value) ? '.on' : '') + (p.group === 'extra' ? '.extra' : ''), { type: 'button', title: p.note, onclick: () => {
        if (picked.has(p.value)) picked.delete(p.value);
        else { if (st.max && picked.size >= st.max) { toast(`至多${num(st.max)}人`); return; } picked.add(p.value); }
        b.classList.toggle('on', picked.has(p.value));
        countEl.textContent = `已召${num(picked.size)}人`;
      } }, p.label, p.note ? h('small', p.note) : null);
      return b;
    }));
    countEl.textContent = `已召${num(picked.size)}人`;
    const record = yq ? qianzi(st.record.map((x) => ({ value: x.value, label: x.label })), { value: (st.record.find((x) => x.checked) || st.record[0] || {}).value }) : null;
    setupJuan = juan({
      title: modeName(st.kind), note: '筹备', width: '52rem', height: 'min(44rem, 86vh)',
      content: h('div.ct-setup',
        h('label', h('span', '议题'), topic), pend,
        h('div.ct-row', h('span', '议题类型'), types), custom,
        h('div.ct-row', h('span', yq ? '心腹' : '应召官员'), countEl), people,
        record ? h('div.ct-row', h('span', '起居注'), record) : null),
      actions: [{ label: '开议', onclick: () => {
        if (!topic.value.trim()) { toast('请写明议题'); topic.focus(); return; }
        run(() => C.startSetup({ topic: topic.value.trim(), pending, type: types.getValue(), custom: custom.value.trim(), people: [...picked], record: record ? record.getValue() : 'keep' }));
      } }]
    });
    const mine = setupJuan;
    mine.closed.then((why) => { if (why === 'dismiss' && setupJuan === mine) { setupJuan = null; run(() => C.cancelSetup()); } });
    setTimeout(() => topic.focus(), 400);
  }

  // ---------- 跟随快照 ----------
  bus.on('court:changed', (s) => {
    snap = s;
    if (!s.open) { if (opened) finish(); return; }
    if (!opened && !s.setup) { enter(s); return; }
    if (!opened) { renderSetup(s.setup); return; }
    if (s.setup) renderOverlay(null);
    renderSetup(s.setup);
    if (s.setup) return;
    render(s);
  });
  function render(s) {
    crumbNote.textContent = [modeName(s.kind), s.progress].filter(Boolean).join('　');
    topicEl.textContent = s.topic ? `议题　${s.topic}` : '';
    topicEl.hidden = !s.topic;
    // 主朝议层已收、只剩廷议某阶段的层待处置：实录与朝班照旧留着，只换浮层与案底
    if (!s.lingering) { renderEntries(s.entries); renderRoster(s); }
    renderControls(s);
    renderOverlay(s.overlay);
  }

  // ---------- 开合 ----------
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });
  async function enter(s) {
    if (opened) return;
    opened = true;
    closeScrolls(setupJuan ? [setupJuan] : []);
    kind = s.kind;
    nodes.clear();
    replaceChildren(flow);
    await fade(true);
    if (setupJuan) { const j = setupJuan; setupJuan = null; j.close('sync'); }
    study.setShot(kind === 'yuqian' ? 'title' : 'court');
    crumbName.textContent = '朝议';
    rec.classList.toggle('private', kind === 'yuqian');
    await loadFonts({ 'TM-WenKai': s.entries.map((e) => e.text + (e.name || '')).join('') + s.topic });
    el.classList.add('on');
    bus.emit('court:entered', {});
    render(snap && snap.open ? snap : s);
    await fade(false);
  }
  async function finish() {
    opened = false;
    if (overlayJuan) { const j = overlayJuan; overlayJuan = null; j.close('sync'); }
    overlayId = '';
    if (setupJuan) { const j = setupJuan; setupJuan = null; j.close('sync'); }
    await fade(true);
    el.classList.remove('on');
    study.setShot('desk');
    onClose?.();
    await fade(false);
  }
  // 开议：先过内核的精力、次数关（不过则内核以 toast 说明），过了跟随快照
  function begin(mode) {
    try { return C.begin(mode); } catch (e) { toast(e.message); return false; }
  }
  function convene(issueId) {
    try { return C.convene(issueId); } catch (e) { toast(e.message); return false; }
  }
  return { begin, convene, get opened() { return opened || !!setupJuan; } };
}
