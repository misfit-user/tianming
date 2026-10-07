// 令：撰写（元首一档即诏书）。镜头俯到案上摊开的一幅黄绫诏卷，字层以单应变换贴在绫面：右起诏首（按朝代），五类各一段竖写，左端年月。
// 点哪一段，那一段就展宽来写；左列议事清册，点一条摘入正在写的那段；右列主角行止、私行、往期档案、已颁之诏；
// 案底有司润色（择文风，出润色稿可改，颁行天下或手稿入档）与「钤玺颁行」（即推演）。
// 草稿随写随存本机，推演前一刻写进内核（adapter/edict.js）。名目取身份档 ling。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { homography } from '../core/homography.js';
import { juan, qianzi, loadFonts } from '../kit/index.js';

const FOLD_W = 1180, FOLD_H = 780;
const SCROLL = { w: 690, h: 454, x: 0, z: -10, rot: 0.015 };
const PER_COL = 26;                                      // 一竖行约容几字（字层 21px 字、版心高）
const toast = (text) => bus.emit('kernel:toast', { text });

export function createEdict({ root, study, game, profile, onClose, onPromulgate }) {
  const E = game.edict;
  let opened = false;
  let focus = 'political';
  let prof = profile();

  // ---------- 字层：贴在绫面上 ----------
  const head = h('div.ed-head');
  const secBox = h('div.ed-secs');
  const dateCol = h('div.ed-date');
  const fold = h('article.ed-fold', head, secBox, dateCol);
  const secs = {};
  for (const [key, , label] of E.CATS) {
    const ta = h('textarea.ed-ta', { spellcheck: false, 'aria-label': label,
      oninput: () => { E.setDraft({ [key]: ta.value }); markFilled(); },
      onfocus: () => setFocus(key) });
    ta._refBtnAttached = true;   // 老脚本 tm-edict-thresholds 会给占位字带「诏」的框挂「速查」钮，记号在此即跳过
    const tag = h('button.ed-tag', { type: 'button', onclick: () => { setFocus(key); ta.focus(); } }, label);
    const el = h('section.ed-sec', { dataset: { key } }, tag, ta);
    secs[key] = { el, ta };
    secBox.append(el);
  }
  function setFocus(key) {
    focus = key;
    for (const [k, s] of Object.entries(secs)) s.el.classList.toggle('focus', k === key);
    fit();
  }
  function markFilled() {
    for (const s of Object.values(secs)) s.el.classList.toggle('filled', !!s.ta.value.trim());
    fit();
  }
  // 各段按字数分宽：有几行字给几行宽（不让字被截半），正在写的那段再加宽
  function fit() {
    for (const [k, s] of Object.entries(secs)) {
      const lines = s.ta.value.split('\n').reduce((n, ln) => n + Math.max(1, Math.ceil(ln.length / PER_COL)), 0);
      s.el.style.flexGrow = String(Math.max(1, s.ta.value.trim() ? lines : 1) + (k === focus ? 3 : 0));
    }
  }

  // ---------- 屏上 ----------
  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const back = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => close() }, h('b.q-gold', ''), h('small', '收卷'));
  const sugList = h('div.ed-sugs.q-scroll');
  const sugTitle = h('span.q-gold');
  const left = h('nav.ed-left.q-qi', h('h3.q-ti', sugTitle), sugList);
  const conduct = h('textarea.ed-conduct', { spellcheck: false, oninput: () => E.setDraft({ xinglu: conduct.value }) });
  const conductTitle = h('h4');
  const privTitle = h('h4');
  const privNote = h('small');
  const privBox = h('div.ed-priv');
  const doneBox = h('div.ed-done');
  const archiveBtn = h('button.q-yapai', { type: 'button', onclick: () => openArchive() });
  const right = h('aside.ed-right.q-qi', conductTitle, conduct, h('div.ed-privhead', privTitle, privNote), privBox, doneBox, h('div.ed-rbtn', archiveBtn));
  const style = qianzi(E.STYLES.map(([value, label]) => ({ value, label })), { value: 'elegant' });
  const polishBtn = h('button.slip', { type: 'button', onclick: () => polish() });
  const goBtn = h('button.slip.go', { type: 'button', onclick: () => promulgate() });
  const bar = h('div.ed-bar', h('div.ed-style', style), polishBtn, goBtn);
  const el = h('section.scr.scr-edict', crumb, back, left, right, bar);
  root.append(fold, el);

  study.onFrame(() => {
    if (!opened) return;
    const q = study.paperCorners();
    if (q) fold.style.transform = homography(FOLD_W, FOLD_H, q);
  });

  // ---------- 填 ----------
  function fill() {
    const t = prof.ling;
    const d = E.draft();
    replaceChildren(head, E.header().map((x) => h('span', x)));
    const date = game.select.date();
    dateCol.textContent = date.text || '';
    for (const [key] of E.CATS) {
      secs[key].ta.value = d[key] || '';
      secs[key].ta.placeholder = (t.hints && t.hints[key]) || '';
    }
    conduct.value = d.xinglu || '';
    conduct.placeholder = t.conductHint;
    conductTitle.textContent = t.conduct;
    privTitle.textContent = t.private;
    privNote.textContent = t.privateNote;
    sugTitle.textContent = t.suggest;
    archiveBtn.textContent = t.archive;
    polishBtn.textContent = t.polish;
    goBtn.textContent = t.promulgate;
    crumbName.textContent = (prof.channels.find((c) => c.key === 'ling') || {}).title || '';
    crumbNote.textContent = date.text || '';
    back.querySelector('b').textContent = '回' + prof.desk;
    markFilled();
    setFocus(focus);
    renderSugs();
    renderPriv();
    renderDone();
  }
  function renderSugs() {
    const list = E.suggestions();
    replaceChildren(sugList, list.length ? list.map((s) => h('div.ed-sug-row', h('button.ed-sug', { type: 'button', title: s.content, onclick: () => adopt(s) },
      h('small', [s.source, s.from].filter(Boolean).join(' · ')), h('span', s.content.length > 54 ? s.content.slice(0, 54) + '……' : s.content)),
      s.ask ? h('button.ed-sug-ask', { type: 'button', title: `${s.ask}，听其意见再定`, onclick: () => askDept(s) }, s.ask) : null))
      : [h('p.ed-none', `尚无摘录。批阅${prof.docket.name}时划选正文可摘入此处。`)]);
  }
  // 先问本部：收起诏书页，由内核开问对（召对页接过去）
  async function askDept(s) {
    await close();
    try { E.askDept(s.i); } catch (e) { toast(e.message); }
  }
  function adopt(s) {
    const ta = secs[focus].ta;
    ta.value = ta.value.trim() ? ta.value.trimEnd() + '\n' + s.content : s.content;
    E.setDraft({ [focus]: ta.value });
    E.useSuggestion(s.i);
    markFilled();
    renderSugs();
    toast(`已摘入${E.CATS.find(([k]) => k === focus)[2]}`);
  }
  function renderPriv() {
    const acts = E.privateActs();
    if (!acts.length) { replaceChildren(privBox, h('p.ed-none', '无')); return; }
    replaceChildren(privBox, acts.map((a) => h('button' + (a.on ? '.on' : ''), { type: 'button', title: a.desc, onclick: () => {
      try { E.togglePrivate(a.id); } catch (e) { toast(e.message); }
      renderPriv();
    } }, a.name)));
  }
  function renderDone() {
    const done = E.promulgated();
    replaceChildren(doneBox, done.length ? [h('h4', prof.ling.done), ...done.map((x) => h('p', x.text.length > 60 ? x.text.slice(0, 60) + '……' : x.text))] : []);
  }

  // ---------- 往期档案 ----------
  function openArchive() {
    const rows = E.archive();
    juan({
      title: prof.ling.archive, note: `${num(rows.length)}道`, width: '52rem', height: 'min(40rem, 82vh)',
      content: rows.length ? h('div.ed-arch', rows.map((r) => h('article',
        h('header', h('b', r.category), h('small', `第${num(r.turn)}回合`), r.status ? h('em', r.status) : null, r.progress != null ? h('small', `${num(r.progress)}%`) : null),
        h('p', r.content), r.feedback ? h('p.fb', r.feedback) : null, r.assignee ? h('small', `承办：${r.assignee}`) : null)))
        : h('p.ed-none', '尚无往期档案。')
    });
  }

  // ---------- 有司润色 ----------
  async function polish() {
    if (!E.hasAny()) { toast('先拟几句，再请有司润色'); return; }
    polishBtn.disabled = true;
    polishBtn.textContent = '润色中';
    let text = '';
    try { text = await E.polish(style.getValue()); } catch (e) { toast(e.message); }
    polishBtn.disabled = false;
    polishBtn.textContent = prof.ling.polish;
    if (!text) { toast('有司未呈润色稿'); return; }
    const ta = h('textarea.ed-polished', { spellcheck: false }, text);
    ta.value = text;
    juan({
      title: prof.ling.polish, note: E.STYLES.find(([v]) => v === style.getValue())[1], width: '50rem', height: 'min(40rem, 82vh)',
      content: h('div', h('p.ed-lead', '可再改定。颁行则整篇并入此回推演；入档则只存为手稿。'), ta),
      actions: [
        { label: '颁行', onclick: ({ close }) => { try { E.applyPolished(ta.value, 'replace'); close('ok'); renderDone(); toast('已颁行，此回推演整篇并入'); } catch (e) { toast(e.message); } } },
        { label: '入档', onclick: ({ close }) => { try { E.applyPolished(ta.value, 'keep'); close('ok'); toast('已存为手稿'); } catch (e) { toast(e.message); } } }
      ]
    });
  }

  function promulgate() {
    close().then(() => onPromulgate?.());
  }

  // ---------- 开合 ----------
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });
  // at='conduct'：从「行」渠道来，直接落笔在主角行止一栏
  async function open(at) {
    if (opened) return;
    prof = profile();
    await fade(true);
    study.setMemorialPaper({ ...SCROLL, surface: prof.ling.surface === 'silk' ? 'silk' : 'paper', panels: prof.ling.surface === 'silk' ? 1 : 6 });
    study.setShot('memorial');
    fill();
    const d = E.draft();
    await loadFonts({ 'TM-WenKai': Object.values(d).join('') + Object.values(prof.ling.hints || {}).join(''), 'TM-MaShanZheng': E.header().join('') });
    opened = true;
    fold.classList.add('on');
    el.classList.add('on');
    await fade(false);
    if (at === 'conduct') {
      conduct.focus();
      conduct.classList.remove('lit');
      void conduct.offsetWidth;
      conduct.classList.add('lit');
    } else secs[focus].ta.focus();
  }
  async function close() {
    if (!opened) return;
    await fade(true);
    opened = false;
    fold.classList.remove('on');
    el.classList.remove('on');
    study.setMemorialPaper(null);
    study.setShot('desk');
    onClose?.();
    await fade(false);
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  return { open, close, get opened() { return opened; } };
}
