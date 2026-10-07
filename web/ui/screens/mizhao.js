// 独召密问：时政一桩，择几位在侧之臣召入。先一卷选人选题；入对后景同朝议（望宝座），左列所召诸臣，
// 右展竖写实录（诸臣依次流式进言），案底垂询、建言要点、摘入。退下时内核自记纪事、起居注与诸臣记忆。
// 一切经 game.mizhao（adapter/mizhao.js 镜老流程）；版式借朝议（.scr-court、.ct-*、.au-rec）。叫法取 profile().issues 与 audience。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, zhou, loadFonts, closeScrolls } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });

export function createMizhao({ root, study, game, profile, onOpen, onClose }) {
  const M = game.mizhao;
  let opened = false;
  let snap = null;
  let sel = { text: '', who: '' };
  let sumJuan = null, sumBox = null;
  const nodes = new Map();

  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const leaveLabel = h('b.q-gold');
  const leave = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => end() }, leaveLabel, h('small', '收卷'));
  const topicEl = h('div.ct-topic');
  const rosterList = h('div.ct-roster-list.q-scroll');
  const roster = h('aside.ct-roster.q-qi', h('h3.q-ti', h('span.q-gold', '密召')), rosterList);
  const flow = h('div.au-flow.ct-flow');
  const rec = h('article.au-rec.ct-rec', flow);
  const statusEl = h('p.ct-status');
  const slips = h('div.ct-slips');
  const say = h('textarea.au-in.ct-in', { rows: 2, spellcheck: false, onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ask(); } } });
  const sayBtn = h('button.slip.go', { type: 'button', onclick: () => ask() });
  const sayBox = h('div.ct-say', say, sayBtn);
  const bar = h('div.ct-bar', h('div.ct-ctl', statusEl, slips), sayBox);
  const el = h('section.scr.scr-court.scr-mizhao', crumb, leave, topicEl, roster, rec, bar);
  root.append(el);
  flow.addEventListener('wheel', (e) => {
    if (flow.scrollWidth <= flow.clientWidth) return;
    e.preventDefault();
    flow.scrollLeft -= e.deltaY || e.deltaX;
  }, { passive: false });
  // 划选一段：记下哪位所言，案底「摘入」即可收
  flow.addEventListener('mouseup', () => setTimeout(() => {
    const s = window.getSelection();
    const text = s ? s.toString().trim() : '';
    let who = '';
    if (text && s.anchorNode) { const p = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('p.au-them'); if (p) who = p.dataset.who || ''; }
    sel = { text, who };
    if (snap) renderControls(snap);
  }, 10));

  const A = () => profile().audience;
  const I = () => profile().issues;

  // ---------- 实录 ----------
  function entryEl(e) {
    const t = A();
    if (e.role === 'note') return h('p.au-note', /^[（(【〔·]/.test(e.text) ? e.text : `（${e.text}）`);
    if (e.role === 'me') return h('p.au-me', h('b', t.me + t.ask, '：'), h('span.au-text', e.text));
    const waiting = e.streaming && (!e.text || /沉吟/.test(e.text));
    return h('p.au-them' + (e.streaming ? '.live' : ''), { dataset: { who: e.name } }, h('b', e.name, e.title ? h('small', `（${e.title}${e.round ? `·第${num(e.round)}轮` : ''}）`) : null, '：'),
      h('span.au-text', waiting ? '……' : e.text), e.streaming ? h('i.au-brush') : null);
  }
  function renderEntries(list) {
    let grew = false;
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      const key = `${e.text}|${e.streaming ? 1 : 0}`;
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
    const live = s.entries.find((e) => e.streaming);
    replaceChildren(rosterList, s.chars.map((c) => h('div.ct-mem' + (live && live.name === c.name ? '.speaking' : ''), h('b', c.name), c.title ? h('small', c.title) : null, c.said ? h('em.ct-st.neu', `言${num(c.said)}`) : null)));
  }
  function renderControls(s) {
    const t = I();
    statusEl.textContent = s.speaking ? '诸臣奏对中……' : s.canAsk ? '群臣已进言；若欲再问，垂询即续两轮' : '';
    replaceChildren(slips,
      h('button.slip', { type: 'button', disabled: s.speaking, onclick: () => run(() => M.showSummary()) }, t.secretSummary || '建言要点'),
      h('button.slip', { type: 'button', disabled: !sel.text, title: sel.text ? `摘入「${sel.text.slice(0, 20)}…」` : '先在实录里划选一段', onclick: () => excerpt() }, A().excerpt));
    say.disabled = !s.canAsk;
    say.placeholder = s.canAsk ? `${A().hint}（Ctrl+Enter ${A().send}）` : '诸臣奏对中……';
    sayBtn.disabled = !s.canAsk;
  }
  function renderSummary(list) {
    if (!list) { if (sumJuan) { const j = sumJuan; sumJuan = null; j.close('sync'); } return; }
    const body = list.length ? list.map((x) => h('div.mz-sum', h('b', x.name), h('p', x.text || '归纳中……'),
      x.picked ? h('small.done', '已纳入') : x.ready ? h('button.q-yapai', { type: 'button', onclick: () => run(() => M.pick(x.id, x.name)) }, '纳入') : null)) : [h('p.au-none', '史官归纳中……')];
    if (!sumJuan) {
      sumBox = h('div.mz-sums');
      replaceChildren(sumBox, body);
      sumJuan = juan({ title: I().secretSummary || '建言要点', note: snap && snap.issue.title, width: '40rem', content: sumBox });
      sumJuan.closed.then(() => { if (sumJuan) { sumJuan = null; M.closeSummary(); } });
    } else replaceChildren(sumBox, body);
  }
  function render(s) {
    snap = s;
    crumbName.textContent = I().secret;
    crumbNote.textContent = s.issue.title;
    leaveLabel.textContent = I().secretEnd || '退朝';
    replaceChildren(topicEl, h('b', s.issue.title), s.issue.desc ? h('p', s.issue.desc.length > 160 ? s.issue.desc.slice(0, 160) + '…' : s.issue.desc) : null);
    renderEntries(s.entries);
    renderRoster(s);
    renderControls(s);
    renderSummary(s.summary);
    sayBtn.textContent = A().send;
  }
  bus.on('mizhao:changed', (s) => { if (opened && s.open) render(s); });
  bus.on('mizhao:closed', () => { if (opened) finish(); });

  // ---------- 动作 ----------
  function run(f) { try { f(); } catch (e) { toast(e.message); } }
  function ask() {
    const v = say.value.trim();
    if (!v) return;
    run(() => { M.ask(v); say.value = ''; });
  }
  function excerpt() {
    if (!sel.text) return;
    run(() => { const n = M.excerpt(sel.text, sel.who); toast(`已摘入${n}字`); });
    try { window.getSelection().removeAllRanges(); } catch (_e) { /* 无妨 */ }
    sel = { text: '', who: '' };
    if (snap) renderControls(snap);
  }
  function end() { run(() => M.end()); }

  // ---------- 选人选题 ----------
  function pick(issueId = '') {
    const people = M.candidates();
    const list = M.issues();
    const chosen = new Set();
    let issue = list.some((x) => x.id === String(issueId)) ? String(issueId) : (list[0] || {}).id || '';
    const hint = h('small.mz-hint');
    const faces = h('div.mz-faces', people.length ? people.map((c) => {
      const b = h('button.mz-face', { type: 'button', title: [c.name, c.title, c.party].filter(Boolean).join(' · '), onclick: () => { if (chosen.has(c.name)) chosen.delete(c.name); else chosen.add(c.name); b.classList.toggle('on', chosen.has(c.name)); sync(); } },
        zhou({ name: c.name, src: c.portrait }), h('small', c.title));
      return b;
    }) : [h('p.au-none', '身边无可召之臣')]);
    const issues = h('div.mz-issues', list.length ? list.map((x) => h('button' + (x.id === issue ? '.on' : ''), { type: 'button', dataset: { id: x.id }, onclick: () => { issue = x.id; issues.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === issue)); sync(); } },
      h('b', x.title), h('small', x.date))) : [h('p.au-none', '当前无待议要务')]);
    function sync() { hint.textContent = `已择${num(chosen.size)}臣 · ${issue ? '一题' : '未择题'}`; }
    sync();
    juan({
      title: I().secret, note: '择臣择题，屏人独对', width: '60rem', height: 'min(42rem, 84vh)',
      content: h('div.mz-pick', h('section', h('h5', '召何人'), faces), h('section', h('h5', '议何事'), issues), hint),
      actions: [{ label: '召入', onclick: ({ close }) => {
        if (!chosen.size) { toast('未择一臣'); return; }
        if (!issue) { toast('未择议题'); return; }
        close('ok');
        enter([...chosen], issue);
      } }]
    });
  }
  async function enter(names, issueId) {
    let s;
    try { s = M.open(names, issueId); } catch (e) { toast(e.message); return; }
    nodes.clear();
    replaceChildren(flow);
    sel = { text: '', who: '' };
    closeScrolls();
    await fade(true);
    onOpen?.();
    study.setShot('court');
    render(s);
    await loadFonts({ 'TM-WenKai': s.issue.title + s.issue.desc + s.chars.map((c) => c.name + c.title).join(''), 'TM-MaShanZheng': I().secret });
    opened = true;
    el.classList.add('on');
    await fade(false);
  }
  async function finish() {
    if (!opened) return;
    opened = false;
    renderSummary(null);
    await fade(true);
    el.classList.remove('on');
    study.setShot('desk');
    onClose?.();
    await fade(false);
  }
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape' && document.activeElement !== say) { e.preventDefault(); end(); }
  });
  return { pick, get opened() { return opened; } };
}
