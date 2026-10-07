// 科议：科举诸事付在京诸臣公议，景同朝议（望宝座）。左列上台陈词的六臣与其立场，右展竖写实录（诸臣流式陈词、上之插言），
// 案底随阶段换：议论时可插言、再议一轮、付表决；表决时看赞成观望反对之潮与门槛，可展众臣立场；裁决时依议／强推／暂缓。
// 开议前先展一卷问可否（人数、议题、耗精力）。一切经 game.keyi（adapter/keyi.js 照 KEYI_STATE 读）；叫法取 profile().keyi 与 audience。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, loadFonts, closeScrolls } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const CLS = { support: 'sup', oppose: 'opp', abstain: 'neu' };

export function createKeyi({ root, study, game, profile, onOpen, onClose }) {
  const Y = game.keyi;
  let opened = false;
  let snap = null;
  const nodes = new Map();

  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const leaveLabel = h('b.q-gold');
  const leave = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => run(() => Y.shelve()) }, leaveLabel, h('small', '散议'));
  const topicEl = h('div.ct-topic');
  const rosterList = h('div.ct-roster-list.q-scroll');
  const rosterTitle = h('span.q-gold');
  const roster = h('aside.ct-roster.q-qi', h('h3.q-ti', rosterTitle), rosterList);
  const flow = h('div.au-flow.ct-flow');
  const rec = h('article.au-rec.ct-rec', flow);
  const statusEl = h('p.ct-status');
  const slips = h('div.ct-slips');
  const say = h('textarea.au-in.ct-in', { rows: 2, spellcheck: false, onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); speak(); } } });
  const sayBtn = h('button.slip.go', { type: 'button', onclick: () => speak() });
  const sayBox = h('div.ct-say', say, sayBtn);
  const tide = h('div.ky-tide');
  const bar = h('div.ct-bar', h('div.ct-ctl', statusEl, slips), sayBox, tide);
  const el = h('section.scr.scr-court.scr-keyi', crumb, leave, topicEl, roster, rec, bar);
  root.append(el);
  flow.addEventListener('wheel', (e) => {
    if (flow.scrollWidth <= flow.clientWidth) return;
    e.preventDefault();
    flow.scrollLeft -= e.deltaY || e.deltaX;
  }, { passive: false });

  const T = () => profile().keyi || {};
  const A = () => profile().audience;

  // ---------- 实录 ----------
  function entryEl(e) {
    if (e.me) return h('p.au-me', h('b', A().me + A().ask, '：'), h('span.au-text', e.text));
    const tag = e.stance ? h('em.ct-st.' + CLS[e.stance], Y.STANCE[e.stance]) : null;
    const waiting = e.streaming && !e.text;
    return h('p.au-them' + (e.streaming ? '.live' : ''), h('b', e.name, e.title ? h('small', `（${e.title}）`) : null, tag, '：'),
      h('span.au-text', waiting ? '……' : e.text), e.streaming ? h('i.au-brush') : null);
  }
  function renderEntries(list) {
    let grew = false;
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      const key = `${e.text}|${e.stance}|${e.streaming ? 1 : 0}`;
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
    const live = s.speeches.find((e) => e.streaming);
    rosterTitle.textContent = `上台${num(s.speakers.length)}人`;
    replaceChildren(rosterList, s.speakers.map((c) => h('div.ct-mem' + (live && live.name === c.name ? '.speaking' : ''), h('b', c.name), c.title ? h('small', c.title) : null,
      c.stance ? h('em.ct-st.' + CLS[c.stance], Y.STANCE[c.stance]) : null)));
  }
  function renderControls(s) {
    const t = T();
    const slip = (label, f, on = true, cls = '') => h('button.slip' + (cls ? '.' + cls : ''), { type: 'button', disabled: !on, onclick: () => run(f) }, label);
    sayBox.hidden = s.phase !== 'discuss';
    tide.hidden = s.phase === 'discuss';
    if (s.phase === 'discuss') {
      statusEl.textContent = s.busy ? (s.busyText || '诸臣议论中……') : s.discussDone ? `已议${num(s.round)}轮 · 可付表决或再议` : '议论将起……';
      replaceChildren(slips, slip(t.again || '再议一轮', () => Y.extraRound(), s.discussDone && !s.busy), slip(t.vote || '付表决', () => Y.toVote(), s.discussDone && !s.busy, 'go'));
      say.disabled = false;
      say.placeholder = `${t.hint || '插言……'}（Ctrl+Enter ${t.speak || '插言'}）`;
      sayBtn.textContent = t.speak || '插言';
      return;
    }
    const v = s.vote || {};
    if (!v.done) {
      statusEl.textContent = '众臣付表决……';
      replaceChildren(slips);
      replaceChildren(tide, h('div.track', h('i', { style: { width: `${v.progress}%` } })), h('small', `${num(v.progress)}%`));
      return;
    }
    statusEl.textContent = `赞成${num(v.support)} · 观望${num(v.abstain)} · 反对${num(v.oppose)} · 支持率${num(v.pct)}%／门槛${num(v.threshold)}%（${v.libu}）· ${v.passed ? '通过' : '未通过'}`;
    const total = Math.max(1, v.support + v.abstain + v.oppose);
    replaceChildren(tide, h('div.ct-tide', [['sup', v.support, '赞成'], ['neu', v.abstain, '观望'], ['opp', v.oppose, '反对']].filter(([, n]) => n > 0)
      .map(([k, n, label]) => h('i.' + k, { style: { flexGrow: n } }, `${label}${num(n)}`)), h('b.ky-line', { style: { left: `${v.threshold}%` }, title: `门槛${v.threshold}%` })),
      h('small', `${num(Math.round((v.support * 100) / total))}%`));
    if (s.phase === 'vote') {
      replaceChildren(slips, slip('众臣立场', () => showStances(v)), slip(t.decide || '继续裁决', () => Y.toDecide(), true, 'go'));
    } else {
      replaceChildren(slips, slip('众臣立场', () => showStances(v)),
        ...(v.passed ? [slip(s.methods.council, () => Y.decide('council'), true, 'go')] : [slip(s.methods.edict, () => Y.decide('edict'), true, 'go'), slip(s.methods.defy, () => Y.decide('defy'), true, 'warn')]));
    }
  }
  function showStances(v) {
    juan({ title: '众臣立场', note: `${num(v.total)}人`, width: '36rem', height: 'min(34rem, 80vh)',
      content: h('div.ky-stances', v.list.map((x) => h('p', h('em.ct-st.' + CLS[x.stance], Y.STANCE[x.stance]), h('b', x.name), x.reason ? h('span', x.reason) : null))) });
  }
  function render(s) {
    snap = s;
    const t = T();
    crumbName.textContent = t.title || '科议';
    crumbNote.textContent = s.title;
    leaveLabel.textContent = t.shelve || '暂缓';
    replaceChildren(topicEl, h('b', s.title), h('p', `在京${num(s.attendees)}人与议 · 第${num(s.round)}轮`));
    renderEntries(s.speeches);
    renderRoster(s);
    renderControls(s);
  }
  bus.on('keyi:changed', (s) => { if (!s.open) return; if (!opened) enter(s); else render(s); });
  bus.on('keyi:closed', () => { if (opened) finish(); });
  // 开议前一问
  bus.on('keyi:ask', (q) => {
    const t = T();
    let began = false;
    const j = juan({ title: t.title || '科议', note: q.topic, width: '30rem',
      content: h('p', { style: { margin: 0, lineHeight: 2 } }, `召集在京${num(q.people)}名官员，议「${q.topic}」。`, h('br'), h('small', { style: { color: 'var(--ink-faint)' } }, t.cost || '耗精力十五')),
      actions: [{ label: t.ask || '开议', onclick: ({ close }) => { close('ok'); try { began = q.accept() === true; if (!began) toast('科议未开'); } catch (e) { toast(e.message); } } }] });
    // 没开成（收卷，或开不起来）：告知发起处——改制册据此把草稿还给玩家
    j.closed.then(() => { if (!began) bus.emit('keyi:declined', { topic: q.topic }); });
  });

  // ---------- 动作 ----------
  async function run(f) { try { await f(); } catch (e) { toast(e.message); } }
  function speak() {
    const v = say.value.trim();
    if (!v) return;
    say.value = '';
    run(() => Y.speak(v));
  }

  async function enter(s) {
    opened = true;
    nodes.clear();
    replaceChildren(flow);
    closeScrolls();
    await fade(true);
    onOpen?.();
    study.setShot('court');
    render(s);
    await loadFonts({ 'TM-WenKai': s.title + s.speakers.map((c) => c.name + c.title).join(''), 'TM-MaShanZheng': (T().title || '科议') });
    el.classList.add('on');
    await fade(false);
  }
  async function finish() {
    if (!opened) return;
    opened = false;
    await fade(true);
    el.classList.remove('on');
    study.setShot('desk');
    onClose?.();
    await fade(false);
  }
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });
  return { get opened() { return opened; } };
}
