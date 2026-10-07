// 书：书札往来（元首一档即鸿雁传书）。镜头俯到案上摊开的一张花笺，字层以单应变换贴在笺面，竖写、朱丝栏随字。
// 左列远方人物（按上级区划、外方按势力分组，可检索、可群发）；右列与此人的往来书札，点一封摊到笺上读；
// 未选人时右列是截获的他人密函。案底：拟书时是文书种类、缓急、封缄、递送与「遣使」，读信时是这封信上能做的事。
// 自己写的用行书，来函、回书用楷书。名目取身份档 letters。拟稿按收信人随写随存本机（adapter/letters.js）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { homography } from '../core/homography.js';
import { qianzi, loadFonts } from '../kit/index.js';

const FOLD_W = 1180, FOLD_H = 780;
const PAD_X = 84, PAD_Y = 72, COL = 46;                   // 版心边距与行距：朱丝栏每 46px 一道，版心正好 22 行
const SHEET = { w: 680, h: 450, x: 0, z: -14, rot: -0.012, surface: 'letter', frame: [PAD_X / FOLD_W, PAD_Y / FOLD_H, PAD_X / FOLD_W, PAD_Y / FOLD_H] };
const toast = (text) => bus.emit('kernel:toast', { text });
const MULTI = '\u0000群发';                               // 群发稿的存稿键（不会与人名相撞）

// 头像：先放姓的首字，立绘在后台载到了才换上（缺图不露破图标）
function avatar(cls, c) {
  const box = h('span.' + cls, c.name.slice(0, 1));
  if (c.portrait) {
    const img = new Image();
    img.alt = '';
    img.onload = () => replaceChildren(box, img);
    img.src = c.portrait;
  }
  return box;
}

// 卷动后对齐到整行：字与朱丝栏不错位
function snapColumns(el) {
  let t = 0;
  el.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const s = Math.round(el.scrollLeft / COL) * COL;
      if (Math.abs(s - el.scrollLeft) > 0.5) el.scrollTo({ left: s, behavior: 'smooth' });
    }, 140);
  });
  // 竖写的字往左读：滚轮下拨即往左翻
  el.addEventListener('wheel', (e) => {
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft -= e.deltaY || e.deltaX;
  }, { passive: false });
}

export function createLetters({ root, study, game, profile, onClose }) {
  const L = game.letters;
  let prof = profile();
  let opened = false;
  let person = null;              // 选中的人（名册里的一条）
  let multi = false;              // 群发
  const picked = new Set();       // 群发选中的人名
  let mode = 'idle';              // idle 未选人 · read 读信 · compose 拟书
  let current = null;             // 正摊着读的那封（id）
  let replyTo = null;             // 正在回的那封（id）
  let query = '';
  let roster = [];

  // ---------- 字层：贴在笺面上 ----------
  const toCol = h('div.lt-to');
  const ta = h('textarea.lt-ta', { spellcheck: false, 'aria-label': '书札正文', oninput: () => L.setDraft(draftKey(), ta.value) });
  ta._refBtnAttached = true;
  const signCol = h('div.lt-sign');
  const compose = h('div.lt-compose', toCol, ta, signCol);
  const flow = h('div.lt-flow');
  const idle = h('div.lt-idle');
  const fold = h('article.lt-fold', compose, flow, idle);
  snapColumns(ta);
  snapColumns(flow);

  // ---------- 屏上 ----------
  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const back = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => close() }, h('b.q-gold', ''), h('small', '收卷'));
  const route = h('div.lt-route');
  // 左列：名册
  const farTitle = h('span.q-gold');
  const farCount = h('small');
  const search = h('input.lt-search', { type: 'search', placeholder: '检索姓名、官职、地点……', oninput: () => { query = search.value.trim(); renderRoster(); } });
  const multiBtn = h('button.lt-multi', { type: 'button', onclick: () => toggleMulti() }, '群发');
  const list = h('div.lt-list.q-scroll');
  const left = h('nav.lt-left.q-qi', h('h3.q-ti', farTitle, farCount), h('div.lt-tools', search, multiBtn), list);
  // 右列：往来
  const right = h('aside.lt-right.q-qi');
  // 笺下一行：这封信的种类、缓急、封缄、递送与下落
  const meta = h('div.lt-meta');
  // 案底
  const bar = h('div.lt-bar');
  const el = h('section.scr.scr-letters', crumb, back, route, left, right, meta, bar);
  root.append(fold, el);

  study.onFrame(() => {
    if (!opened) return;
    const q = study.paperCorners();
    if (q) fold.style.transform = homography(FOLD_W, FOLD_H, q);
  });

  // ---------- 名册 ----------
  function renderRoster() {
    const t = prof.letters;
    farTitle.textContent = t.far;
    farCount.textContent = `${num(roster.length)}人`;
    multiBtn.classList.toggle('on', multi);
    multiBtn.textContent = multi ? `群发·${num(picked.size)}` : '群发';
    const q = query.toLowerCase();
    const hit = q ? roster.filter((c) => `${c.name}　${c.title}　${c.location}　${c.group}`.toLowerCase().includes(q)) : roster;
    const groups = new Map();
    for (const c of hit) {
      if (!groups.has(c.group)) groups.set(c.group, []);
      groups.get(c.group).push(c);
    }
    // 本方各区划按人数多寡，外方殿后
    const order = [...groups.entries()].sort((a, b) => (a[1][0].foreign - b[1][0].foreign) || (b[1].length - a[1].length));
    if (!order.length) { replaceChildren(list, h('p.lt-none', q ? `无人合「${query}」` : '四方无可传书之人')); return; }
    replaceChildren(list, order.map(([g, people]) => h('section',
      h('h4', h('span', g), h('small', `${num(people.length)}人`)),
      people.map((c) => {
        const on = multi ? picked.has(c.name) : person && person.name === c.name;
        const marks = [
          c.fresh ? h('em.fresh', { title: '新到来函' }, num(c.fresh)) : null,
          c.transit ? h('em.transit', { title: '在途' }, num(c.transit)) : null,
          c.lost ? h('em.lost', { title: '信使逾期或失踪' }, '失') : null,
          c.blocked ? h('em.lost', { title: '驿路阻断' }, '阻') : null
        ];
        return h('button.lt-pi' + (on ? '.on' : ''), { type: 'button', onclick: () => choose(c) },
          avatar('av', c),
          h('span.who', h('b', c.name), h('small', c.title || c.location)),
          h('span.loc', c.travel ? `→${c.travel}` : c.location),
          h('span.marks', marks));
      }))));
  }
  function toggleMulti() {
    multi = !multi;
    picked.clear();
    if (multi) { mode = 'compose'; replyTo = null; }
    else { mode = person ? (L.thread(person.name).length ? 'read' : 'compose') : 'idle'; }
    render();
  }
  function choose(c) {
    if (multi) {
      if (picked.has(c.name)) picked.delete(c.name); else picked.add(c.name);
      render();
      return;
    }
    person = c;
    replyTo = null;
    const th = L.thread(c.name);
    if (th.length) {
      const fresh = [...th].reverse().find((v) => v.unread && !v.inFlight);
      current = (fresh || th[th.length - 1]).id;
      mode = 'read';
    } else {
      current = null;
      mode = 'compose';
    }
    render();
  }

  // ---------- 右列 ----------
  const MARK = { traveling: '在途', delivered: '已达', replying: '回函在途', intercepted_forging: '回函在途', intercepted: '失踪', blocked: '受阻', recalled: '已追回' };
  function markOf(v) {
    if (v.out) return v.reply ? '有回书' : MARK[v.status] || '';
    if (v.inFlight) return '在途';
    return v.unread ? '新' : '';
  }
  function renderRight() {
    const t = prof.letters;
    if (!person || multi) {
      const got = L.intercepted();
      replaceChildren(right, h('h3.q-ti', h('span.q-gold', t.intercepted), h('small', got.length ? `近五月${num(got.length)}件` : '')),
        h('div.lt-thread.q-scroll', got.length ? got.map((c) => h('article.lt-intc',
          h('header', h('b', `${c.from} → ${c.to}`), h('small', c.date)), h('p', c.content), c.implication ? h('p.imp', c.implication) : null))
          : h('p.lt-none', multi ? '群发：在左列点选收信人，再于笺上拟书。' : t.idle)));
      return;
    }
    const th = L.thread(person.name);
    const head = h('div.lt-who',
      avatar('av', person),
      h('div', h('b', person.name), h('small', person.title), h('small', person.travel ? `${person.location} → ${person.travel}${person.travelDays ? `（${num(person.travelDays)}日）` : ''}` : person.location)));
    const newBtn = h('button.q-yapai.lt-new', { type: 'button', onclick: () => { replyTo = null; mode = 'compose'; render(); } }, t.compose);
    replaceChildren(right, head, h('div.lt-rbtn', newBtn, h('small', th.length ? `往来${num(th.length)}封` : t.empty)),
      h('div.lt-thread.q-scroll', [...th].reverse().map((v) => h('button.lt-mi' + (mode === 'read' && v.id === current ? '.on' : '') + (v.out ? '.out' : '.in'), {
        type: 'button', onclick: () => { current = v.id; mode = 'read'; render(); }
      }, h('b', `${v.out ? '去函' : '来函'}·${v.type}`), h('small', v.date), markOf(v) ? h('em' + (markOf(v) === '新' ? '.fresh' : ''), markOf(v)) : null,
      v.starred ? h('i', '★') : null))));
  }

  // ---------- 笺面 ----------
  const col = (cls, text) => h('p.' + cls, text);
  function paragraphs(text, cls = 'body') {
    return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).map((s) => col(cls, s));
  }
  function renderPaper() {
    const t = prof.letters;
    fold.dataset.mode = mode;
    if (mode === 'idle') {
      replaceChildren(idle, h('span', t.idle));
      return;
    }
    if (mode === 'compose') {
      const plan = replyTo ? L.planChoices(replyTo) : null;
      const names = multi ? [...picked] : person ? [person.name] : [];
      toCol.textContent = !names.length ? t.to('……') : names.length > 3 ? t.to(`群发${num(names.length)}人`) : t.to(names.join('、'));
      if (replyTo) toCol.textContent = `${t.reply}　${names[0] || ''}`;
      signCol.textContent = t.mine;
      ta.placeholder = plan ? '附言（可略）……' : t.hint;
      const key = draftKey();
      if (ta.dataset.key !== key) { ta.value = L.draft(key); ta.dataset.key = key; }
      return;
    }
    // 读信
    const v = current && L.letter(current);
    if (!v) { mode = 'compose'; renderPaper(); return; }
    if (!v.out && !v.inFlight) L.markRead(v.id);
    const foreign = !!(person && person.foreign);
    const blocks = [];
    if (v.out) {
      blocks.push(col('head', t.to(v.to)), ...paragraphs(v.content, 'body mine'), col('sign mine', `${v.date}　${t.mine}`));
    } else {
      blocks.push(col('head', v.type), ...(v.inFlight ? [col('veiled', '〔信使在途　尚未送抵〕')] : paragraphs(v.content)), col('sign', `${t.theirs(v.from, foreign)}　${v.date}`));
    }
    if (v.reply) {
      blocks.push(h('p.gap'), h('p.lab', h('span', t.reply)), ...paragraphs(v.reply), col('sign', `${t.theirs(v.to, foreign)}　${v.replyDate}`));
      if (v.forged) blocks.push(col('note', '此回书已证实为伪造'));
      else if (v.suspected) blocks.push(col('note', '已存疑：此回书真伪待核'));
    }
    replaceChildren(flow, blocks);
    flow.scrollLeft = 0;
  }
  function draftKey() { return multi ? MULTI : person ? person.name : ''; }

  // ---------- 笺下与案底 ----------
  function renderMeta() {
    if (mode !== 'read') { meta.textContent = ''; return; }
    const v = current && L.letter(current);
    if (!v) { meta.textContent = ''; return; }
    meta.textContent = [v.type, v.urgency, v.cipher, v.token, v.mode, v.multi ? `群发${num(v.multi)}人` : '', v.statusText].filter(Boolean).join('　·　');
  }
  // 拟书的几组签：在 open 时按身份档建好
  let typePick = null, urgPick = null, cipherPick = null, modePick = null, planPick = null;
  const agentSel = h('select.lt-agent', { 'aria-label': '密使人选' });
  const tokenNote = h('small.lt-token');
  function group(label, ctl, extra) { return h('div.lt-grp', h('span.lab', label), ctl, extra || null); }
  function buildPickers() {
    const types = L.types(prof.letters.types);
    typePick = qianzi(types.map((x) => ({ value: x.key, label: x.label, title: x.token ? `须${x.tokenLabel}` : '' })), { value: prof.letters.dflt, onchange: () => renderBar() });
    urgPick = qianzi(L.URGENCY.map(([value, label, title]) => ({ value, label, title })), { value: 'normal' });
    cipherPick = qianzi(L.ciphers().map((c) => ({ value: c.key, label: c.label, title: c.note })), { value: 'none' });
    modePick = qianzi(L.SEND_MODES.map(([value, label, title]) => ({ value, label, title })), { value: 'multi_courier', onchange: () => renderBar() });
  }
  function slip(label, onclick, cls = '') { return h('button.slip' + cls, { type: 'button', onclick }, label); }
  function renderBar() {
    const t = prof.letters;
    if (mode === 'idle') { replaceChildren(bar); return; }
    if (mode === 'compose') {
      const plan = replyTo ? L.planChoices(replyTo) : null;
      if (plan) {
        if (!planPick || planPick.dataset.for !== replyTo) { planPick = qianzi(plan.map(([value, label]) => ({ value, label })), { value: plan[0][0] }); planPick.dataset.for = replyTo; }
        replaceChildren(bar, group('回应', planPick), slip(t.send, () => send(), '.go'));
        return;
      }
      const type = L.types(prof.letters.types).find((x) => x.key === typePick.getValue());
      tokenNote.textContent = type && type.token && !type.tokenHeld ? `未持${type.tokenLabel}，对方或疑而不从` : '';
      const secret = modePick.getValue() === 'secret_agent';
      if (secret && !agentSel.options.length) replaceChildren(agentSel, L.agents().map((a) => h('option', { value: a.name }, a.title ? `${a.name}（${a.title}）` : a.name)));
      replaceChildren(bar, group('文书', typePick, tokenNote), group('缓急', urgPick), group('封缄', cipherPick), group('递送', modePick, secret ? agentSel : null),
        slip(t.send, () => send(), '.go'));
      return;
    }
    const v = current && L.letter(current);
    if (!v) { replaceChildren(bar); return; }
    const run = (fn, ...args) => () => { try { fn(...args); } catch (e) { toast(e.message); } refreshAll(); };
    replaceChildren(bar,
      v.can.reply ? slip(t.reply, () => { replyTo = v.id; mode = 'compose'; render(); }, '.go') : null,
      v.can.excerpt ? slip(t.excerpt, run(L.act.excerpt, v.id)) : null,
      v.can.suspect ? slip('存疑', run(L.act.suspect, v.id)) : null,
      v.can.verify ? slip('遣使核实', run(L.act.verify, v.id)) : null,
      v.can.recall ? slip('追回', run(L.act.recall, v.id)) : null,
      v.can.bypass ? slip(`改用${L.typeLabel('secret_decree')}`, run(L.act.bypass, v.id)) : null,
      v.can.resend ? slip('重发·密使', run(L.act.resend, v.id, 'secret_agent')) : null,
      v.can.resend ? slip('重发·加急', run(L.act.resend, v.id, 'multi_courier')) : null,
      slip(v.starred ? '去标记' : '标记', run(L.act.star, v.id)));
  }

  // ---------- 遣使 ----------
  function send() {
    const names = multi ? [...picked] : person ? [person.name] : [];
    if (!names.length) { toast('请先在左列择定收信人'); return; }
    const plan = replyTo ? L.planChoices(replyTo) : null;
    const content = ta.value.trim() || (plan ? '谨复。' : '');
    if (!content) { toast('请写下信函内容'); ta.focus(); return; }
    const opts = plan
      ? { content, targets: names, replyingTo: replyTo, planChoice: planPick.getValue() }
      : { content, targets: names, replyingTo: replyTo || undefined, letterType: typePick.getValue(), urgency: urgPick.getValue(), cipher: cipherPick.getValue(),
        sendMode: modePick.getValue(), agent: modePick.getValue() === 'secret_agent' ? agentSel.value : '' };
    let r;
    try { r = L.send(opts); } catch (e) { toast(e.message); return; }
    if (!r.ok) return;                                    // 内核已以 toast 说明缘故
    L.setDraft(draftKey(), '');
    ta.value = '';
    replyTo = null;
    if (multi) { multi = false; picked.clear(); mode = person ? 'read' : 'idle'; }
    if (person) {
      const th = L.thread(person.name);
      current = th.length ? th[th.length - 1].id : null;
      mode = current ? 'read' : 'compose';
    }
    refreshAll();                                         // 成功与否内核都已 toast 告知
  }

  // ---------- 总绘 ----------
  function render() {
    renderRoster();
    renderRight();
    renderPaper();
    renderMeta();
    renderBar();
  }
  function refreshAll() {
    roster = L.contacts();
    if (person) person = roster.find((c) => c.name === person.name) || person;
    render();
  }
  function fill() {
    const date = game.select.date();
    crumbName.textContent = (prof.channels.find((c) => c.key === 'shu') || {}).title || '';
    crumbNote.textContent = date.text || '';
    back.querySelector('b').textContent = '回' + prof.desk;
    const alerts = L.routeAlerts();
    replaceChildren(route, alerts.length ? [h('b', '驿路告急'), ...alerts.map((a) => h('span', a.reason ? `${a.route}·${a.reason}` : a.route))] : []);
    route.classList.toggle('on', alerts.length > 0);
    ta.dataset.key = '';
  }

  // ---------- 开合 ----------
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });
  async function open(name) {
    if (opened) return;
    prof = profile();
    await fade(true);
    study.setMemorialPaper(SHEET);
    study.setShot('memorial');
    buildPickers();
    replaceChildren(agentSel);
    roster = L.contacts();
    multi = false;
    picked.clear();
    person = name ? roster.find((c) => c.name === name) || null : null;
    mode = 'idle';
    current = null;
    replyTo = null;
    fill();
    if (person) choose(person); else render();
    const text = roster.map((c) => c.name + c.title + c.location + c.group).join('') + (person ? L.thread(person.name).map((v) => v.content + v.reply + v.type + v.date).join('') : '');
    const t = prof.letters;
    await loadFonts({ 'TM-WenKai': text + t.idle + t.hint + '〔信使在途尚未送抵〕', 'TM-Xing': text + t.mine + t.hint, 'TM-MaShanZheng': text });
    opened = true;
    fold.classList.add('on');
    el.classList.add('on');
    await fade(false);
  }
  async function close() {
    if (!opened) return;
    if (mode === 'compose') L.setDraft(draftKey(), ta.value);
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
