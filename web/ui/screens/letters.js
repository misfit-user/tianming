// 书：书札往来（元首一档即鸿雁传书）。镜头俯到案上摊开的一张花笺，字层以单应变换贴在笺面，竖写、朱丝栏随字。
// 左列分四页：来函（新到、待复；以信为准，写信人回了京、故去了也读得到）、在途（告急在上）、名册（按上级区划、外方按势力分组，可检索、可群发）、截获。
// 有新信时一打开就把最要紧的一封摊到笺上，读完按「下一封」往下走，不必一个一个人去找。
// 右列是此人的往来书札，点一封摊到笺上读。案底：拟书时是文书种类、缓急、封缄、递送与「遣使」，读信时是这封信上能做的事。
// 自己写的用行书，来函、回书用楷书。名目取身份档 letters。拟稿按收信人随写随存本机（adapter/letters.js）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { homography } from '../core/homography.js';
import { qianzi, faceDot as avatar, loadFonts } from '../kit/index.js';

const FOLD_W = 1180, FOLD_H = 780;
const PAD_X = 84, PAD_Y = 72, COL = 46;                   // 版心边距与行距：朱丝栏每 46px 一道，版心正好 22 行
const SHEET = { w: 680, h: 450, x: 0, z: -14, rot: -0.012, surface: 'letter', frame: [PAD_X / FOLD_W, PAD_Y / FOLD_H, PAD_X / FOLD_W, PAD_Y / FOLD_H] };
const toast = (text) => bus.emit('kernel:toast', { text });
const MULTI = '\u0000群发';                               // 群发稿的存稿键（不会与人名相撞）
const WAITING_MAX = 12;                                   // 待复只列最近几封：放着不回的旧信不该把列表撑满

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

export function createLetters({ root, study, game, profile, onClose, onPerson }) {
  const L = game.letters;
  let prof = profile();
  let opened = false;
  let person = null;              // 选中的人（名册里的一条，或写过信而不在名册的人）
  let multi = false;              // 群发
  const picked = new Set();       // 群发选中的人名
  let mode = 'idle';              // idle 未选人 · read 读信 · compose 拟书 · intc 读截获的密函
  let tab = 'roster';             // inbox 来函 · transit 在途 · roster 名册 · intc 截获
  let current = null;             // 正摊着读的那封（id）
  let intcAt = -1;                // 正摊着读的截获密函（第几件）
  let replyTo = null;             // 正在回的那封（id）
  let query = '';
  let roster = [];
  let keep = new Set();           // 这一趟进来时新到的：读过了也留在列表原处，不让列表跳

  // ---------- 字层：贴在笺面上 ----------
  const toCol = h('div.lt-to');
  const ta = h('textarea.lt-ta', { spellcheck: false, 'aria-label': '书札正文', oninput: () => L.setDraft(draftKey(), ta.value) });
  ta._refBtnAttached = true;
  const signCol = h('div.lt-sign');
  const quote = h('div.lt-quote');                        // 回书时原信留在笺右，边看边回
  const compose = h('div.lt-compose', toCol, quote, ta, signCol);
  const flow = h('div.lt-flow');
  const idle = h('div.lt-idle');
  const moreCue = h('div.lt-more', h('i'), '卷未尽');     // 长信往左还有，笺面上得看得出来
  const sentSeal = h('div.lt-seal');                      // 遣使时落一方印
  const fold = h('article.lt-fold', compose, flow, idle, moreCue, sentSeal);
  snapColumns(ta);
  snapColumns(quote);
  snapColumns(flow);
  const paintMore = () => moreCue.classList.toggle('on', fold.dataset.mode === 'read' && flow.scrollWidth - flow.clientWidth - Math.abs(flow.scrollLeft) > 6);
  flow.addEventListener('scroll', paintMore, { passive: true });

  // ---------- 屏上 ----------
  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const back = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => close() }, h('b.q-gold', ''), h('small', '收卷'));
  const route = h('div.lt-route');
  // 左列：四页
  const tabs = h('nav.lt-tabs', { role: 'tablist' });
  const search = h('input.lt-search', { type: 'search', title: '姓名、官职、地点', oninput: () => { query = search.value.trim(); renderRoster(); } });
  const multiBtn = h('button.lt-multi', { type: 'button', onclick: () => toggleMulti() }, '群发');
  const tools = h('div.lt-tools', search, multiBtn);
  const list = h('div.lt-list.q-scroll');
  const left = h('nav.lt-left.q-qi', tabs, tools, list);
  // 右列：往来
  const right = h('aside.lt-right.q-qi');
  // 笺下一行：读信时是这封信的种类、缓急、封缄、递送与下落；拟书时是几日能到
  const meta = h('div.lt-meta');
  // 案底
  const bar = h('div.lt-bar');
  const el = h('section.scr.scr-letters', crumb, back, route, left, right, h('div.lt-foot', meta, bar));
  root.append(fold, el);

  study.onFrame(() => {
    if (!opened) return;
    const q = study.paperCorners();
    if (q) fold.style.transform = homography(FOLD_W, FOLD_H, q);
  });

  // ---------- 左列 ----------
  const isNew = (v) => v.unread || v.replyNew;
  function setTab(key) {
    tab = key;
    if (key !== 'roster' && multi) leaveMulti();
    else renderLeft();
    list.scrollTop = 0;
  }
  function renderLeft() {
    const box = L.inbox(keep);
    const got = L.intercepted();
    const fresh = box.fresh.filter(isNew).length;
    const item = (key, label, n, hot) => h('button.lt-tab' + (tab === key ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': tab === key ? 'true' : 'false', onclick: () => setTab(key) },
      label, n ? h('em' + (hot ? '.hot' : ''), num(n)) : null);
    replaceChildren(tabs,
      item('inbox', '来函', fresh, true),
      item('transit', '在途', box.transit.length + box.trouble.length, box.trouble.length > 0),
      item('roster', '名册'),
      item('intc', prof.letters.intercepted.slice(0, 2), got.length));
    tools.hidden = tab !== 'roster';
    if (tab === 'roster') renderRoster();
    else if (tab === 'inbox') renderInbox(box);
    else if (tab === 'transit') renderTransit(box);
    else renderIntc(got);
  }
  // 一封信一行：像、谁、什么信、标记；第二行是信首几句或还要几日
  function letterRow(v, { line, tag, tagCls = '.fresh', cls = '' } = {}) {
    return h(`button.lt-li${cls}${mode === 'read' && current === v.id ? '.on' : ''}`, { type: 'button', title: v.date, onclick: () => openLetter(v) },
      avatar('av', v.who, onPerson),
      h('span.who', h('b', v.who.name), h('small', `${v.out ? '去函·' : ''}${v.type}`)),
      h('span.tags', v.hot ? h('em.hot', '急') : null, tag ? h('em' + tagCls, tag) : null),
      h('span.ex', line ?? v.excerpt));
  }
  function section(title, note, rows) {
    return h('section', h('h4', h('span', title), note), rows);
  }
  function renderInbox(box) {
    const fresh = box.fresh.filter(isNew).length;
    const secs = [];
    if (box.fresh.length) {
      secs.push(section('新到', fresh > 1 ? h('button.lt-allread', { type: 'button', onclick: () => { L.markAllRead(); refreshAll(); } }, '全部阅讫') : h('small', fresh ? `${num(fresh)}封` : '已阅'),
        box.fresh.map((v) => letterRow(v, { tag: v.replyNew ? '回书' : v.unread ? '新' : '', cls: isNew(v) ? '.new' : '.read' }))));
    }
    if (box.waiting.length) {
      secs.push(section('待复', h('small', `${num(box.waiting.length)}封`), box.waiting.slice(0, WAITING_MAX).map((v) => letterRow(v, { tag: '待复', tagCls: '' }))));
    }
    if (box.starred.length) secs.push(section('标记', h('small', `${num(box.starred.length)}封`), box.starred.map((v) => letterRow(v, { tag: '★', tagCls: '.star' }))));
    if (box.recent.length) secs.push(section('近函', h('small', '已阅'), box.recent.map((v) => letterRow(v, { cls: '.old' }))));
    replaceChildren(list, secs.length ? secs : h('p.lt-none', '案头暂无新札。要写信，到名册里择人。'));
  }
  function renderTransit(box) {
    const secs = [];
    const troubleTag = (v) => (v.status === 'blocked' ? '受阻' : v.status === 'traveling' ? '逾期' : '失踪');
    if (box.trouble.length) secs.push(section('告急', h('small', `${num(box.trouble.length)}封`), box.trouble.map((v) => letterRow(v, { tag: troubleTag(v), tagCls: '.lost', line: v.statusText }))));
    const going = box.transit.filter((v) => v.out);
    const coming = box.transit.filter((v) => !v.out);
    if (going.length) secs.push(section('去函', h('small', `${num(going.length)}封`), going.map((v) => letterRow(v, { line: v.eta }))));
    if (coming.length) secs.push(section('来函在途', h('small', `${num(coming.length)}封`), coming.map((v) => letterRow(v, { line: v.eta }))));
    replaceChildren(list, secs.length ? secs : h('p.lt-none', '眼下没有在途的信使。'));
  }
  function renderIntc(got) {
    const t = prof.letters;
    replaceChildren(list, got.length ? got.map((c, i) => h(`button.lt-li.bare${mode === 'intc' && intcAt === i ? '.on' : ''}`, { type: 'button', title: c.date, onclick: () => openIntc(i) },
      h('span.who', h('b', `${c.from} → ${c.to}`)), h('span.ex', c.content)))
      : h('p.lt-none', `近五月未有${t.intercepted}；他人私下的往来一旦为耳目所得，便录于此处`));
  }
  // 名册
  function renderRoster() {
    search.placeholder = `检索${num(roster.length)}人……`;
    multiBtn.classList.toggle('on', multi);
    multiBtn.textContent = multi ? `群发·${num(picked.size)}` : '群发';
    if (tab !== 'roster') return;
    const q = query.toLowerCase();
    const hit = q ? roster.filter((c) => `${c.name}　${c.title}　${c.location}　${c.group}`.toLowerCase().includes(q)) : roster;
    const groups = new Map();
    for (const c of hit) {
      if (!groups.has(c.group)) groups.set(c.group, []);
      groups.get(c.group).push(c);
    }
    // 本方各区划按人数多寡，外方殿后；一片之内有新信、有信在途的人在前
    const order = [...groups.entries()].sort((a, b) => (a[1][0].foreign - b[1][0].foreign) || (b[1].length - a[1].length));
    if (!order.length) { replaceChildren(list, h('p.lt-none', q ? `无人合「${query}」` : '四方无可传书之人')); return; }
    replaceChildren(list, order.map(([g, people]) => h('section',
      h('h4', h('span', g), h('small', `${num(people.length)}人`)),
      [...people].sort((a, b) => (b.fresh - a.fresh) || (b.transit - a.transit)).map((c) => {
        const on = multi ? picked.has(c.name) : person && person.name === c.name;
        const marks = [
          c.fresh ? h('em.fresh', { title: '新到来函' }, num(c.fresh)) : null,
          c.transit ? h('em.transit', { title: '在途' }, num(c.transit)) : null,
          c.lost ? h('em.lost', { title: '信使逾期或失踪' }, '失') : null,
          c.blocked ? h('em.lost', { title: '驿路阻断' }, '阻') : null
        ];
        return h('button.lt-pi' + (on ? '.on' : ''), { type: 'button', onclick: () => choose(c) },
          avatar('av', c, onPerson),
          h('span.who', h('b', c.name), h('small', c.travel ? `→${c.travel}` : c.location)),
          h('span.loc', c.title || c.location),
          h('span.marks', marks));
      }))));
  }
  function leaveMulti() {
    multi = false;
    picked.clear();
    mode = person ? (L.thread(person.name).length ? 'read' : 'compose') : 'idle';
    render();
  }
  function toggleMulti() {
    if (multi) { leaveMulti(); return; }
    multi = true;
    picked.clear();
    mode = 'compose';
    replyTo = null;
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
      const fresh = [...th].reverse().find((v) => (v.unread && !v.inFlight) || v.replyNew);
      current = (fresh || th[th.length - 1]).id;
      mode = 'read';
    } else {
      current = null;
      mode = c.away ? 'idle' : 'compose';
    }
    render();
  }
  // 从来函、在途点一封：连人带信一起摊开
  function openLetter(v) {
    multi = false;
    picked.clear();
    person = L.person(v.out ? v.to : v.from);
    current = v.id;
    replyTo = null;
    mode = 'read';
    render();
  }
  function openIntc(i) {
    multi = false;
    picked.clear();
    person = null;
    current = null;
    replyTo = null;
    intcAt = i;
    mode = 'intc';
    render();
  }

  // ---------- 右列 ----------
  const MARK = { traveling: '在途', delivered: '已达', replying: '回函在途', intercepted_forging: '回函在途', intercepted: '失踪', blocked: '受阻', recalled: '已追回' };
  function markOf(v) {
    if (v.out) return v.replyNew ? '新回书' : v.reply ? '有回书' : MARK[v.status] || '';
    if (v.inFlight) return '在途';
    return v.unread ? '新' : '';
  }
  // 路上要走多久：人一选中就看得见，不必写了信才知道
  function reachNote(c) {
    if (c.away === 'dead') return '人已故去，不能再传书';
    if (c.away === 'near') return prof.letters.atCourt;
    if (c.blocked) return '驿路阻断，书信难达';
    const r = L.reach(c.name, 'normal');
    return r ? `驿递约${num(r.days)}日可达` : '';
  }
  function renderRight() {
    const t = prof.letters;
    if (multi) {
      replaceChildren(right, h('h3.q-ti', h('span.q-gold', '群发'), h('small', picked.size ? `${num(picked.size)}人` : '')),
        h('div.lt-thread.q-scroll', picked.size ? [...picked].map((name) => h('button.lt-mi.pick', { type: 'button', title: '点一下从收信人里去掉', onclick: () => { picked.delete(name); render(); } }, h('b', name), h('i', '×')))
          : h('p.lt-none', '在左列点选收信人，再于笺上拟书。')));
      return;
    }
    if (!person) {
      const box = L.inbox(keep);
      const stat = (label, n, go, hot) => h('button.lt-stat' + (hot && n ? '.hot' : ''), { type: 'button', onclick: () => setTab(go) }, h('b', n ? num(n) : '无'), h('small', label));
      replaceChildren(right, h('h3.q-ti', h('span.q-gold', '案头')),
        h('div.lt-stats', stat('新到', box.fresh.filter(isNew).length, 'inbox', true), stat('待复', box.waiting.length, 'inbox'), stat('在途', box.transit.length, 'transit'), stat('告急', box.trouble.length, 'transit', true)),
        h('p.lt-none', t.idle));
      return;
    }
    const th = L.thread(person.name);
    const note = reachNote(person);
    const head = h('div.lt-who',
      avatar('av', person, onPerson),
      h('div', h('b', person.name), h('small', person.title), h('small', person.travel ? `${person.location} → ${person.travel}${person.travelDays ? `（${num(person.travelDays)}日）` : ''}` : person.location),
        note ? h('small.reach' + (person.away || person.blocked ? '.bad' : ''), note) : null));
    const newBtn = person.away ? null : h('button.q-yapai.lt-new', { type: 'button', onclick: () => { replyTo = null; mode = 'compose'; render(); } }, t.compose);
    replaceChildren(right, head, h('div.lt-rbtn', newBtn, h('small', th.length ? `往来${num(th.length)}封` : t.empty)),
      h('div.lt-thread.q-scroll', [...th].reverse().map((v) => h('button.lt-mi' + (mode === 'read' && v.id === current ? '.on' : '') + (v.out ? '.out' : '.in'), {
        type: 'button', onclick: () => { current = v.id; replyTo = null; mode = 'read'; render(); }
      }, h('i.dir', v.out ? '去' : '来'),
      h('span.ttl', h('b', v.type), h('small', v.date)),
      h('span.tags', v.starred ? h('i.star', '★') : null, markOf(v) ? h('em' + (isNew(v) ? '.fresh' : ''), markOf(v)) : null),
      h('span.ex', v.excerpt)))));
  }

  // ---------- 笺面 ----------
  const col = (cls, text) => h('p.' + cls, text);
  function paragraphs(text, cls = 'body') {
    return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).map((s) => col(cls, s));
  }
  function renderPaper() {
    const t = prof.letters;
    fold.dataset.mode = mode === 'intc' ? 'read' : mode;
    if (mode === 'idle') {
      replaceChildren(idle, h('span', t.idle));
      paintMore();
      return;
    }
    if (mode === 'compose') {
      const plan = replyTo ? L.planChoices(replyTo) : null;
      const names = multi ? [...picked] : person ? [person.name] : [];
      toCol.textContent = !names.length ? t.to('……') : names.length > 3 ? t.to(`群发${num(names.length)}人`) : t.to(names.join('、'));
      if (replyTo) toCol.textContent = `${t.reply}　${names[0] || ''}`;
      const orig = replyTo ? L.letter(replyTo) : null;
      compose.classList.toggle('replying', !!orig);
      replaceChildren(quote, orig ? [col('qh', `来函　${orig.from}`), ...paragraphs(orig.content, 'q')] : []);
      quote.scrollLeft = 0;
      signCol.textContent = t.mine;
      ta.placeholder = plan ? '附言（可略）……' : t.hint;
      const key = draftKey();
      if (ta.dataset.key !== key) { ta.value = L.draft(key); ta.dataset.key = key; }
      paintMore();
      return;
    }
    if (mode === 'intc') {
      const c = L.intercepted()[intcAt];
      if (!c) { mode = 'idle'; renderPaper(); return; }
      replaceChildren(flow, col('head', `${c.from}　致　${c.to}`), ...paragraphs(c.content), col('sign', c.date), c.implication ? col('note', c.implication) : null);
      flow.scrollLeft = 0;
      paintMore();
      return;
    }
    // 读信
    const v = current && L.letter(current);
    if (!v) { mode = person && !person.away ? 'compose' : 'idle'; renderPaper(); return; }
    const foreign = !!(person && person.foreign);
    const blocks = [];
    if (v.out) {
      blocks.push(col('head', t.to(v.to)), ...paragraphs(v.content, 'body mine'), col('sign mine', `${v.date}　${t.mine}`));
    } else {
      blocks.push(h('p.head', v.hot ? h('i.urg', '急') : null, `${v.type}　${v.from}`), ...(v.inFlight ? [col('veiled', '〔信使在途　尚未送抵〕')] : paragraphs(v.content)), col('sign', `${t.theirs(v.from, foreign)}　${v.date}`));
    }
    if (v.reply) {
      blocks.push(h('p.gap'), h('p.lab', h('span', t.reply)), ...paragraphs(v.reply), col('sign', `${t.theirs(v.to, foreign)}　${v.replyDate}`));
      if (v.forged) blocks.push(col('note', '此回书已证实为伪造'));
      else if (v.suspected) blocks.push(col('note', '已存疑：此回书真伪待核'));
    }
    replaceChildren(flow, blocks);
    flow.scrollLeft = 0;
    paintMore();
  }
  function draftKey() { return multi ? MULTI : person ? person.name : ''; }

  // ---------- 笺下与案底 ----------
  function renderMeta() {
    el.dataset.mode = mode;
    if (mode === 'compose') { meta.textContent = composeNote(); return; }
    if (mode !== 'read') { meta.textContent = ''; return; }
    const v = current && L.letter(current);
    if (!v) { meta.textContent = ''; return; }
    meta.textContent = [v.type, v.urgency, v.cipher, v.token, v.mode, v.multi ? `群发${num(v.multi)}人` : '', v.statusText].filter(Boolean).join('　·　');
  }
  // 拟书时笺下写明这封信的路程，缓急、递送一换就跟着变
  function composeNote() {
    if (replyTo && L.planChoices(replyTo)) return '';
    if (multi) return picked.size ? `群发${num(picked.size)}人，各按路程送达` : '';
    if (!person || !urgPick) return '';
    const r = L.reach(person.name, urgPick.getValue(), modePick.getValue());
    if (!r) return '';
    const cipher = L.ciphers().find((c) => c.key === cipherPick.getValue());
    return [`约${num(r.days)}日送达`, `回书约${num(r.back)}日可望`, person.location ? `${person.name}在${person.location}` : '', cipher && cipher.note ? `${cipher.label}：${cipher.note}` : ''].filter(Boolean).join('　·　');
  }
  // 拟书的几组签：在 open 时按身份档建好
  let typePick = null, urgPick = null, cipherPick = null, modePick = null, planPick = null;
  const agentSel = h('select.lt-agent', { 'aria-label': '密使人选' });
  const tokenNote = h('small.lt-token');
  function group(label, ctl, extra) { return h('div.lt-grp', h('span.lab', label), ctl, extra || null); }
  function buildPickers() {
    const types = L.types(prof.letters.types);
    typePick = qianzi(types.map((x) => ({ value: x.key, label: x.label, title: x.token ? `须${x.tokenLabel}` : '' })), { value: prof.letters.dflt, onchange: () => renderBar() });
    // 八百里加急写成「八百里」：五个字的签比别的长一截，一排高低不齐；全名在悬停里
    urgPick = qianzi(L.URGENCY.map(([value, label, title]) => ({ value, label: label.length > 3 ? label.replace('加急', '') : label, title: `${label}：${title}` })), { value: 'normal', onchange: () => renderMeta() });
    cipherPick = qianzi(L.ciphers().map((c) => ({ value: c.key, label: c.label, title: c.note })), { value: 'none', onchange: () => renderMeta() });
    modePick = qianzi(L.SEND_MODES.map(([value, label, title]) => ({ value, label, title })), { value: 'multi_courier', onchange: () => { renderBar(); renderMeta(); } });
  }
  function slip(label, onclick, cls = '') { return h('button.slip' + cls, { type: 'button', onclick }, label); }
  function renderBar() {
    const t = prof.letters;
    if (mode === 'idle' || mode === 'intc') { replaceChildren(bar); return; }
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
    const rest = L.inbox(keep).fresh.filter(isNew);
    replaceChildren(bar,
      v.can.reply && !(person && person.away) ? slip(t.reply, () => { replyTo = v.id; mode = 'compose'; render(); }, '.go') : null,
      v.can.excerpt ? slip(t.excerpt, run(L.act.excerpt, v.id)) : null,
      v.can.suspect ? slip('存疑', run(L.act.suspect, v.id)) : null,
      v.can.verify ? slip('遣使核实', run(L.act.verify, v.id)) : null,
      v.can.recall ? slip('追回', run(L.act.recall, v.id)) : null,
      v.can.bypass ? slip(`改用${L.typeLabel('secret_decree')}`, run(L.act.bypass, v.id)) : null,
      v.can.resend ? slip('重发·密使', run(L.act.resend, v.id, 'secret_agent')) : null,
      v.can.resend ? slip('重发·加急', run(L.act.resend, v.id, 'multi_courier')) : null,
      slip(v.starred ? '去标记' : '标记', run(L.act.star, v.id)),
      rest.length ? h('button.slip.next', { type: 'button', onclick: () => openLetter(rest[0]) }, '下一封', h('em', num(rest.length))) : null);
  }

  // ---------- 遣使 ----------
  let sealTimer = 0;
  function stampSent() {
    sentSeal.textContent = prof.letters.send;
    fold.classList.remove('sent');
    void fold.offsetWidth;
    fold.classList.add('sent');
    clearTimeout(sealTimer);
    sealTimer = setTimeout(() => fold.classList.remove('sent'), 1500);
  }
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
    stampSent();
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
    if (mode === 'read' && current) L.markRead(current);  // 先记已读，各处的数才对得上
    renderLeft();
    renderRight();
    renderPaper();
    renderMeta();
    renderBar();
  }
  function refreshAll() {
    roster = L.contacts();
    if (person) person = L.person(person.name);
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
    if (opened) {                                         // 书札开着时从人物窗、右键单点「传书」：换个人
      if (name) { multi = false; picked.clear(); tab = 'roster'; choose(L.person(name)); }
      return;
    }
    prof = profile();
    await fade(true);
    study.setMemorialPaper(SHEET);
    study.setShot('memorial');
    buildPickers();
    replaceChildren(agentSel);
    roster = L.contacts();
    multi = false;
    picked.clear();
    query = '';
    search.value = '';
    const box = L.inbox();
    keep = new Set(box.fresh.map((v) => v.id));
    person = name ? L.person(name) : null;
    mode = 'idle';
    current = null;
    replyTo = null;
    fill();
    // 点名来的就看这个人；否则有新信直接摊开最要紧的一封，有待复的先看来函一页，都没有就是名册
    tab = !name && (box.fresh.length || box.waiting.length) ? 'inbox' : 'roster';
    if (person) choose(person);
    else if (box.fresh.length) openLetter(box.fresh[0]);
    else render();
    const rows = [...box.fresh, ...box.waiting, ...box.transit, ...box.trouble];
    const text = roster.map((c) => c.name + c.title + c.location + c.group).join('')
      + rows.map((v) => v.who.name + v.who.title + v.content + v.reply + v.type + v.date).join('')
      + (person ? L.thread(person.name).map((v) => v.content + v.reply + v.type + v.date).join('') : '');
    const t = prof.letters;
    await loadFonts({ 'TM-WenKai': text + t.idle + t.hint + '〔信使在途尚未送抵〕卷未尽', 'TM-Xing': text + t.mine + t.hint, 'TM-MaShanZheng': text });
    opened = true;
    fold.classList.add('on');
    el.classList.add('on');
    paintMore();
    list.querySelector('.on')?.scrollIntoView({ block: 'center' });
    await fade(false);
  }
  async function close() {
    if (!opened) return;
    if (mode === 'compose') L.setDraft(draftKey(), ta.value);
    await fade(true);
    opened = false;
    keep = new Set();
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
