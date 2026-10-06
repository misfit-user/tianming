// 批：案头待批之件（元首一档即百官奏疏）。镜头俯到摊开的奏折上，字以单应变换贴在 3D 纸面上（纸色、折痕、窗光都来自场景）。
// 一件一件批：右列折目（分急、常、留中、已批）；案底几枝签（按身份档：准、驳、批、留中、交部议、付廷议、召对）；
// 批语写在折子左幅；长折按折翻页（← 下一折、→ 上一折，PageUp/PageDown 换一件）；划选正文可摘入建议库。
// 批过的折子钤一方小印，随后自动翻到下一件未批的。名目一律取身份档（ui/model/identity.js）的 docket。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { homography } from '../core/homography.js';
import { juan, zhou, yapai, loadFonts } from '../kit/index.js';

const FOLD_W = 1180, FOLD_H = 780;                       // 字层的版面（像素），贴到纸面四角
const PAPER = { w: 760, h: 500, x: 0, z: 0, rot: 0.02, panels: 6 };   // 摊开的折子（毫米）
const COL = 44;                                          // 正文一竖行的宽（像素）
const ORDER = ['urgent', 'pending', 'held', 'done'];

export function createDocket({ root, study, game, profile, onClose }) {
  let items = [];
  let cur = 0;
  let page = 0, pages = 1;
  let opened = false;
  let prof = profile();

  // ---------- 字层：贴在纸上 ----------
  const hdrFrom = h('span.from');
  const hdrUrg = h('span.urg');
  const hdrType = h('span.type');
  const hdrDate = h('span.date');
  const hdrNote = h('span.note');
  const hdr = h('div.col.hdr', hdrFrom, hdrUrg, hdrType, hdrNote, hdrDate);
  const subject = h('div.col.subject');
  const flow = h('div.flow');
  const bodyBox = h('div.body', flow);
  const replyLabel = h('span.lab');
  const reply = h('textarea.ink', { rows: 1, spellcheck: false, 'aria-label': '批语' });
  const mark = h('span.mark');
  const pizhu = h('div.pizhu', replyLabel, reply, mark);
  const emptyNote = h('div.empty');
  const fold = h('article.dk-fold', hdr, subject, bodyBox, h('div.rule'), pizhu, emptyNote);

  // ---------- 屏上：题头、折目、签、翻折、摘入 ----------
  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const back = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => close() }, h('b.q-gold', ''), h('small', '收折'));
  const list = h('div.mlist.q-scroll');
  const listBox = h('nav.mbox.q-qi', h('h3.q-ti', h('span.q-gold', '折目')), list);
  const slips = h('div.slips');
  const prev = h('button.turn.prev', { type: 'button', title: '上一折', onclick: () => turnPage(-1) }, '›');
  const next = h('button.turn.next', { type: 'button', title: '下一折', onclick: () => turnPage(1) }, '‹');
  const pageNote = h('div.pagenote');
  const pick = yapai('', { onclick: () => doExcerpt() });
  pick.classList.add('excerpt');
  const el = h('section.scr.scr-docket', crumb, back, listBox, slips, prev, next, pageNote, pick);
  root.append(fold, el);           // 字层直接挂根节点下，与舞台同一合成组，正片叠底才叠得到纸上

  // 字层每帧贴到纸面四角
  study.onFrame(() => {
    if (!opened) return;
    const q = study.paperCorners();
    if (q) fold.style.transform = homography(FOLD_W, FOLD_H, q);
  });

  // ---------- 正文排版：段落、抬头 ----------
  function bodyNodes(text, taitou) {
    const words = [...(taitou.double || []), ...(taitou.single || [])];
    const re = words.length ? new RegExp(`(${words.join('|')})`) : null;
    const lift = (w) => ((taitou.double || []).includes(w) ? 'tai2' : 'tai1');
    const out = [];
    for (const para of String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
      if (!re) { out.push(h('p', para)); continue; }
      const parts = para.split(re);                       // [前文, 词, 后文, 词, 后文…]
      if (parts[0]) out.push(h('p', parts[0]));
      for (let i = 1; i < parts.length; i += 2) out.push(h('p.' + lift(parts[i]), parts[i] + (parts[i + 1] || '')));
    }
    return out;
  }
  const fill = (tpl, m) => tpl.replace('{title}', m.fromTitle || '').replace('{name}', m.from || '');

  // ---------- 一件 ----------
  function render() {
    const d = prof.docket;
    const m = items[cur];
    fold.classList.toggle('none', !m);
    emptyNote.textContent = d.empty;
    replyLabel.textContent = d.reply;
    reply.placeholder = d.hint + '……';
    if (m) {
      hdrFrom.textContent = fill(m.system ? d.signBare : d.sign, m);
      hdrUrg.textContent = m.urgent ? '急' : '';
      hdrUrg.hidden = !m.urgent;
      hdrType.textContent = m.type || '';
      hdrType.hidden = !m.type;
      hdrNote.textContent = [m.reliability === 'low' ? '存疑' : m.reliability === 'medium' ? '待证' : '', m.remoteFrom ? '驿递自' + m.remoteFrom : ''].filter(Boolean).join(' · ');
      hdrNote.hidden = !hdrNote.textContent;
      hdrDate.textContent = m.date || '';
      subject.textContent = m.title || '';
      subject.hidden = !m.title;
      replaceChildren(flow, bodyNodes(m.body, d.taitou || {}));
      reply.value = m.reply || '';
      const v = d.verdicts.find(([k]) => k === m.status);
      mark.textContent = v && m.status !== 'pending' ? v[1] : '';
      mark.hidden = !mark.textContent;
    }
    layoutPages();
    renderList();
    renderSlips();
    renderCrumb();
  }

  // 长折分折：正文区宽取整到整行，按版心宽翻
  function layoutPages() {
    const avail = bodyBox.parentElement ? bodyBox.clientWidth : 0;
    const wcols = Math.max(COL, Math.floor(avail / COL) * COL);
    flow.style.width = '';
    const total = flow.scrollWidth || flow.offsetWidth;
    pages = Math.max(1, Math.ceil((total - 2) / wcols));
    page = Math.min(page, pages - 1);
    flow.style.transform = `translateX(${page * wcols}px)`;
    const many = pages > 1 && !!items[cur];
    prev.hidden = next.hidden = !many;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1;
    pageNote.textContent = many ? `第${num(page + 1)}折 · 共${num(pages)}折` : '';
  }
  function turnPage(dir) {
    const to = page + dir;
    if (to < 0 || to >= pages) return go(cur + dir);
    page = to;
    layoutPages();
    renderCrumb();
  }

  function renderCrumb() {
    const pending = items.filter((m) => m.group === 'urgent' || m.group === 'pending').length;
    crumbName.textContent = (prof.channels.find((c) => c.key === 'pi') || {}).title || prof.docket.name;
    crumbNote.textContent = items.length ? `今日${num(items.length)}件 · 未批${num(pending)}件 · 第${num(cur + 1)}件` : '今日无';
    back.querySelector('b').textContent = '回' + prof.desk;
  }

  function renderList() {
    const d = prof.docket;
    const groups = ORDER.map((g) => [g, items.map((m, i) => [m, i]).filter(([m]) => m.group === g)]).filter(([, xs]) => xs.length);
    replaceChildren(list, groups.map(([g, xs]) => h('section',
      h('h4', h('span', d.groups[g]), h('small', `${num(xs.length)}件`)),
      xs.map(([m, i]) => {
        const v = d.verdicts.find(([k]) => k === m.status);
        return h('button.mi' + (i === cur ? '.on' : '') + (m.urgent ? '.urgent' : ''), { type: 'button', onclick: () => go(i), title: m.title || m.body.slice(0, 40) },
          h('b', m.from), h('small', m.type || m.title.slice(0, 8) || ''), v && m.status !== 'pending' ? h('em', v[1]) : null);
      }))));
    list.querySelector('.mi.on')?.scrollIntoView({ block: 'nearest' });
  }

  function renderSlips() {
    const m = items[cur];
    replaceChildren(slips, prof.docket.verdicts.map(([key, label, note], i) =>
      h('button.slip' + (i === 0 ? '.go' : '') + (m && m.status === key ? '.on' : ''), {
        type: 'button', title: note, disabled: !m, onclick: () => decide(key, label)
      }, label)));
  }

  // ---------- 批 ----------
  async function decide(key, label) {
    const m = items[cur];
    if (!m) return;
    const text = reply.value.trim();
    if (key === 'summon') {
      juan({ title: label, note: m.from, width: '28rem', content: h('p', { style: { margin: 0, lineHeight: 2 } }, '召对一页随后接上；眼下请先以别的签批之。') });
      return;
    }
    if (key === 'annotated' && !text) {
      reply.focus();
      pizhu.classList.remove('want');
      void pizhu.offsetWidth;
      pizhu.classList.add('want');
      bus.emit('kernel:toast', { text: `先写${prof.docket.reply}，再批` });
      return;
    }
    if (key === 'referred') {
      const who = await chooseReferee(m);
      if (!who) return;
      return commit(m, key, text, { _referredTo: who });
    }
    return commit(m, key, text);
  }
  function commit(m, key, text, extra) {
    try {
      game.act.memorial(m.id, key, text, extra);
    } catch (err) {
      bus.emit('kernel:toast', { text: String(err && err.message || err) });
      return;
    }
    reload(m.id);
    fold.classList.remove('stamped');
    void fold.offsetWidth;
    fold.classList.add('stamped');
    // 批完自动翻到下一件未批的（留中、已批的不算）
    const nextIdx = items.findIndex((x, i) => i !== cur && (x.group === 'urgent' || x.group === 'pending'));
    if (nextIdx >= 0) setTimeout(() => { if (opened && items[cur] && items[cur].id === m.id) go(nextIdx); }, 900);
    else bus.emit('kernel:toast', { text: `今日${prof.docket.name}俱已批阅` });
  }
  function chooseReferee(m) {
    const people = game.select.referCandidates(m.id);
    return new Promise((resolve) => {
      let chosen = null;
      const rows = people.length
        ? people.map((c) => h('button.pick-item', { type: 'button', onclick: () => { chosen = c.name; j.close('ok'); } },
          zhou({ name: c.name, src: c.portrait }), h('div', h('h4', c.name), h('div.era', c.title || ''))))
        : [h('p', { style: { margin: 0 } }, '身边无可批转之人。')];
      const j = juan({ title: '交部议', note: '批转此折予——', width: '34rem', height: 'min(36rem, 76vh)', content: h('div.pick-list.refer', rows) });
      j.closed.then(() => resolve(chosen));
    });
  }

  // ---------- 摘入：划选正文 ----------
  bodyBox.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text || !items[cur]) { pick.classList.remove('on'); return; }
    pick.textContent = prof.docket.excerpt;
    pick.style.transform = `translate(${Math.min(window.innerWidth - 160, e.clientX + 14)}px, ${e.clientY - 46}px)`;
    pick.classList.add('on');
  });
  document.addEventListener('selectionchange', () => { if (!String(window.getSelection() || '').trim()) pick.classList.remove('on'); });
  function doExcerpt() {
    const m = items[cur];
    if (!m) return;
    try { game.act.excerpt(m.id); } catch (err) { bus.emit('kernel:toast', { text: String(err && err.message || err) }); }
    window.getSelection()?.removeAllRanges();
    pick.classList.remove('on');
  }

  // ---------- 翻件 ----------
  function go(i) {
    if (!items.length) return;
    const to = Math.max(0, Math.min(items.length - 1, i));
    if (to === cur && opened) return;
    saveDraft();
    cur = to;
    page = 0;
    fold.classList.remove('stamped');
    render();
  }
  // 批语草稿：换件前把未落的批语记回（只在本页，不进内核；落签时才交）
  const drafts = new Map();
  function saveDraft() {
    const m = items[cur];
    if (m && reply.value !== (m.reply || '')) drafts.set(m.id, reply.value);
  }
  function reload(keepId) {
    items = game.select.docket().sort((a, b) => ORDER.indexOf(a.group === 'done' ? 'done' : a.group) - ORDER.indexOf(b.group === 'done' ? 'done' : b.group));
    for (const m of items) if (drafts.has(m.id) && m.status === 'pending') m.reply = drafts.get(m.id);
    const at = keepId ? items.findIndex((m) => m.id === keepId) : -1;
    cur = at >= 0 ? at : Math.min(cur, Math.max(0, items.length - 1));
    render();
  }

  window.addEventListener('keydown', (e) => {
    if (!opened || e.target === reply || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); turnPage(1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); turnPage(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  // ---------- 开合 ----------
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });

  async function open(id) {
    if (opened) return;
    prof = profile();
    items = [];
    await fade(true);
    study.setMemorialPaper(PAPER);
    study.setShot('memorial');
    reload();
    if (id) { const i = items.findIndex((m) => m.id === id); if (i >= 0) cur = i; }
    else { const i = items.findIndex((m) => m.group === 'urgent' || m.group === 'pending'); cur = i >= 0 ? i : 0; }
    await loadFonts({ 'TM-WenKai': items.map((m) => m.from + m.title + m.body + m.date).join('') + prof.docket.empty, 'TM-Xing': items.map((m) => m.reply).join('') + prof.docket.hint });
    opened = true;
    render();
    fold.classList.add('on');
    el.classList.add('on');
    await fade(false);
  }
  async function close() {
    if (!opened) return;
    saveDraft();
    await fade(true);
    opened = false;
    fold.classList.remove('on');
    el.classList.remove('on');
    pick.classList.remove('on');
    study.setMemorialPaper(null);
    study.setShot('desk');
    onClose?.();
    await fade(false);
  }

  return { open, close, get opened() { return opened; } };
}
