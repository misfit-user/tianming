// 见：朝议（常朝、廷议、御前会议）。书房换景（朝议望宝座，御前会议在窗前），左列朝班（分班、小像、立场，脚下一道众议之潮），
// 中间挂正在说话那位的立轴与名牌（screens/presenter.js），右展竖写的朝议实录：「上曰」与诸臣奏对，流式发言一字字落进最左一行；
// 实录上头一条议题签（常朝带本日议程）；案底是此刻可做之事（老流程当下挂出的按钮，镜成签）与插言。
// 筹备（议题、类型、与会者、记录方式）、二级输入、择一的浮层、散朝总结都画成卷；廷议各阶段的层（预审、站班、廷推、草诏、用印、补述）
// 画成「表单卷」：说明照录，输入照填，可点项一律成选项。一切经 game.court（adapter/court.js 镜老流程）。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, qianzi, tiao, loadFonts, closeScrolls } from '../kit/index.js';
import { createPresenter } from './presenter.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const STANCE_CLS = { 支持: 'sup', 反对: 'opp', 中立: 'neu', 折中: 'med', 另议: 'alt' };
const CANCEL = /取消|^罢|暂不|关闭/;
// 内核文字里夹的阿拉伯数：照记数设置写（只用于旁白、状态这些内核写的话，臣子的奏对不动）；带正负号的增减留着（「皇威 +1」写成「+一」不成话）
const dg = (t) => String(t || '').replace(/(?<![+\-\d])\d+/g, (d) => num(+d));
// 实录里的衔只取头一段（「司礼监秉笔太监·提督东厂(……)」后头的话留给名牌）
const shortTitle = (t) => String(t || '').split(/[·(（,，]/)[0].trim();

export function createCourt({ root, study, game, profile, onClose, onPerson }) {
  const C = game.court;
  let opened = false;
  let snap = null;
  let kind = '';
  const nodes = new Map();      // 实录条目号 → { el, text }
  const people = new Map();     // 名 → adapter.person（一场内只查一回）
  const firstOf = new Map();    // 名 → 他第一次开口那条的号：只在头一回写全衔
  const entryItem = new Map();  // 条目号 → 落笔时是第几事（常朝每议一事，立场重新算）
  let liveId = '', liveTimer = 0;
  let lastSpeaker = '';
  let rosterSig = '', ctlSig = '', tallySig = '';
  const rows = new Map();       // 朝班：名 → { el, st }
  let overlayJuan = null, overlayId = '', formText = null, foreBox = null;
  let setupJuan = null;

  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const leave = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => C.close() }, h('b.q-gold', '退朝'), h('small', '收卷'));
  const topicNo = h('small');
  const topicText = h('span');
  const topicPips = h('span.ct-pips');
  const topicEl = h('div.ct-topic', topicNo, topicText, topicPips);
  tiao(topicEl, () => agendaTip());
  const rosterCount = h('small');
  const rosterName = h('span.q-gold', '朝班');
  const rosterTitle = h('h3.q-ti', rosterName, rosterCount);
  const rosterList = h('div.ct-roster-list.q-scroll');
  const tally = h('div.ct-tally');
  const roster = h('aside.ct-roster.q-qi', rosterTitle, rosterList, tally);
  const presenter = createPresenter({ onPerson: (name) => onPerson?.(name) });
  const flow = h('div.au-flow.ct-flow');
  const railThumb = h('i');
  const rail = h('div.ct-rail', railThumb);
  const newer = h('button.ct-newer', { type: 'button', hidden: true, onclick: () => toEnd() }, '有新奏');
  const rec = h('article.au-rec.ct-rec', flow, rail, newer);
  const statusEl = h('p.ct-status');
  const slips = h('div.ct-slips');
  const say = h('textarea.au-in.ct-in', { rows: 2, spellcheck: false, placeholder: '插言……（Ctrl+Enter 递上）',
    onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); speak(); } } });
  const sayBtn = h('button.slip', { type: 'button', onclick: () => speak() }, '插言');
  const sayBox = h('div.ct-say', say, sayBtn);
  const bar = h('div.ct-bar', h('div.ct-ctl', statusEl, slips), sayBox);
  const el = h('section.scr.scr-court', crumb, leave, topicEl, roster, presenter.el, rec, bar);
  root.append(el);
  flow.addEventListener('wheel', (e) => {
    if (flow.scrollWidth <= flow.clientWidth) return;
    e.preventDefault();
    flow.scrollLeft -= e.deltaY || e.deltaX;
  }, { passive: false });
  // 竖写往左读：scrollLeft 从零往负走。读到最左（最新）才跟着新话走；翻回去读旧话时不抢，只亮一枚「有新奏」
  const atEnd = () => flow.scrollWidth - flow.clientWidth + flow.scrollLeft < 48;
  function toEnd() { requestAnimationFrame(() => { flow.scrollLeft = -flow.scrollWidth; newer.hidden = true; paintRail(); }); }
  function paintRail() {
    const over = flow.scrollWidth - flow.clientWidth;
    rail.hidden = over < 4;
    if (over < 4) return;
    const span = flow.clientWidth / flow.scrollWidth;
    railThumb.style.width = `${span * 100}%`;
    railThumb.style.right = `${(-flow.scrollLeft / flow.scrollWidth) * 100}%`;
  }
  flow.addEventListener('scroll', () => { paintRail(); if (atEnd()) newer.hidden = true; }, { passive: true });

  const T = () => profile().audience;
  const modeName = (k) => (C.MODES.find(([m]) => m === k) || [, ''])[1];
  // ---------- 实录 ----------
  function entryEl(e) {
    const t = T();
    if (e.role === 'divider') return h('p.ct-divider', dg(e.text));
    if (e.role === 'note') return h('p.au-note', dg(/^[（(【〔]/.test(e.text) ? e.text : `（${e.text}）`));
    // 缺朝：按缘由各一句，名单长的只列前八人，悬停看全
    if (e.role === 'absent') return h('p.au-note.ct-absent', '（缺朝',
      e.groups.map(([reason, names]) => h('span', { title: names.join('、') }, `　${reason}者${num(names.length)}人：${names.slice(0, 8).join('、')}${names.length > 8 ? '等' : ''}`)), '）');
    if (e.role === 'me') return h('p.au-me', h('b', t.me + t.ask, '：'), h('span.au-text', e.text.replace(/^(朕|陛下)[:：]\s*/, '')));
    const tag = e.stance ? h('em.ct-st.' + (STANCE_CLS[e.stance] || 'neu'), e.stance) : null;
    // 史书的写法：初见书全衔，再见只书名（一人一衔占掉小半行，议到后面满纸都是衔）
    const title = firstOf.get(e.name) === e.id ? shortTitle(e.title || personOf(e.name).title) : '';
    return h('p.au-them' + (e.streaming ? '.live' : ''), h('b', e.name, title ? h('small', `（${title}）`) : null, tag, '：'), h('span.au-text', e.streaming ? '……' : e.text),
      e.candor ? h('span.ct-candor', `〔${dg(e.candor)}〕`) : null, h('i.au-brush'));
  }
  const personOf = (name) => {
    if (!people.has(name)) people.set(name, C.person(name));
    return people.get(name);
  };
  function renderEntries(s) {
    const list = s.entries;
    const follow = atEnd();
    const itemNo = s.agenda ? s.agenda.cur : 0;
    let grew = false;
    let wrote = null;
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      if (!entryItem.has(e.id)) entryItem.set(e.id, itemNo);
      if (e.role === 'them' && e.name && !firstOf.has(e.name)) firstOf.set(e.name, e.id);
      const key = `${e.text}|${e.stance || ''}|${e.streaming ? 1 : 0}`;
      const old = nodes.get(e.id);
      if (old && old.key === key) continue;
      const node = entryEl(e);
      if (old) old.el.replaceWith(node); else flow.append(node);
      nodes.set(e.id, { el: node, key });
      grew = true;
      if (e.role === 'them' && e.name) wrote = e;
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { n.el.remove(); nodes.delete(id); }
    if (grew) { if (follow) toEnd(); else { newer.hidden = false; paintRail(); } }
    // 谁在说：最后一位开口的臣子。这一条还在长（流式）就算正在说；停笔一会儿算说完
    const last = [...list].reverse().find((e) => e.role === 'them' && e.name);
    lastSpeaker = last ? last.name : '';
    if (wrote && last && wrote.id === last.id) markLive(last);
    if (last) {
      const inRoster = s.roster.find((r) => r.name === last.name);
      presenter.show(personOf(last.name), { stance: last.stance || (inRoster && inRoster.stance) || '', note: inRoster && inRoster.candor ? `坦${num(inRoster.candor)}` : '', live: liveId === last.id });
    }
  }
  function markLive(e) {
    if (liveId && liveId !== e.id) nodes.get(liveId)?.el.classList.remove('live');
    liveId = e.id;
    nodes.get(e.id)?.el.classList.add('live');
    clearTimeout(liveTimer);
    if (e.streaming) return;           // 还在等第一个字：等着
    liveTimer = setTimeout(() => {
      nodes.get(liveId)?.el.classList.remove('live');
      liveId = '';
      presenter.setLive(false);
    }, 1400);
  }
  // 这一事里各人最后的立场（常朝的立场写在发言里；廷议、御前内核另有账，名单上已带）
  function stancesNow(s) {
    const map = new Map();
    const itemNo = s.agenda ? s.agenda.cur : 0;
    for (const e of s.entries) if (e.role === 'them' && e.name && e.stance && entryItem.get(e.id) === itemNo) map.set(e.name, e.stance);
    return map;
  }
  function memEl(r) {
    const p = personOf(r.name);
    const src = r.portrait || p.portrait;
    const initial = () => h('i', [...r.name][0] || '');
    const face = src ? h('img', { src, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.target.replaceWith(initial()) }) : initial();
    const st = h('em.ct-st');
    st.hidden = true;
    const note = h('small.ct-mem-note');
    const title = shortTitle(r.title || p.title);
    const row = h('button.ct-mem', { type: 'button', dataset: { person: r.name }, onclick: () => onPerson?.(r.name) }, h('span.ct-face', face),
      h('span.ct-mem-who', h('b', r.name), title ? h('small.ct-mem-sub', title) : null), note, st);
    rows.set(r.name, { el: row, st, note });
    return row;
  }
  function renderRoster(s) {
    let list = s.roster.map((r) => (typeof r === 'string' ? { name: r } : r));
    if (!list.length) {
      const seen = new Map();
      for (const e of s.entries) if (e.role === 'them' && e.name) seen.set(e.name, e.stance || (seen.get(e.name) || ''));
      list = [...seen].map(([name, stance]) => ({ name, stance }));
    }
    rosterName.textContent = s.kind === 'yuqian' ? '心腹' : '朝班';
    // 御前、闭门下议人少：一人一张大点的名片，写上职衔；百官齐到才排密的
    roster.classList.toggle('few', list.length > 0 && list.length <= 10);
    rosterCount.textContent = list.length ? `${num(list.length)}${s.kind === 'changchao' ? '员' : '人'}` : '';
    rosterCount.title = s.absent ? `殿中${num(list.length)}员，缺朝${num(s.absent)}员` : '';
    // 名单变了才重排：每帧重建的话小像会闪、悬停小签会掉
    const sig = list.map((r) => `${r.group || ''}/${r.name}`).join('|');
    if (sig !== rosterSig) {
      rosterSig = sig;
      rows.clear();
      if (!list.length) replaceChildren(rosterList, h('p.au-none', '入殿仪礼中……'));
      else {
        const out = [];
        let band = null;
        for (const r of list) {
          if ((r.group || '') !== band) {
            band = r.group || '';
            if (band) out.push(h('h4.ct-band', band, h('small', num(list.filter((x) => x.group === band).length))));
          }
          out.push(memEl(r));
        }
        replaceChildren(rosterList, out);
      }
    }
    const said = stancesNow(s);
    const counts = { sup: 0, med: 0, neu: 0, opp: 0 };
    let total = 0;
    for (const r of list) {
      const row = rows.get(r.name);
      const stance = r.stance || said.get(r.name) || '';
      if (stance) { const k = STANCE_CLS[stance] === 'alt' ? 'neu' : STANCE_CLS[stance] || 'neu'; counts[k]++; total++; }
      if (!row) continue;
      row.el.classList.toggle('speaking', r.name === lastSpeaker);
      row.el.classList.toggle('spoke', said.has(r.name));
      const candor = r.candor ? `坦${num(r.candor)}` : '';
      if (row.note.textContent !== candor) row.note.textContent = candor;
      // 中立不标：满列「中立」只是噪音，人数在下头那道潮里
      const show = stance && stance !== '中立' ? stance : '';
      if (row.st.textContent !== show) { row.st.textContent = show; row.st.className = 'ct-st ' + (STANCE_CLS[show] || 'neu'); row.st.hidden = !show; }
    }
    const row = rows.get(lastSpeaker);
    if (row && row.el !== rosterList._speaking) {
      rosterList._speaking = row.el;
      if (!rosterList.matches(':hover')) {
        const top = row.el.offsetTop - rosterList.offsetTop;
        rosterList.scrollTo({ top: top - rosterList.clientHeight / 2, behavior: 'smooth' });
      }
    }
    paintTally(counts, total);
  }
  // 众议之潮：朝班脚下一道，支持、折中、中立、反对各占多少（只算这一事已表态的）
  function paintTally(c, total) {
    const sig = `${c.sup}/${c.med}/${c.neu}/${c.opp}`;
    if (sig === tallySig) return;
    tallySig = sig;
    tally.hidden = !total;
    if (!total) return replaceChildren(tally);
    const segs = [['sup', '支持', c.sup], ['med', '折中', c.med], ['neu', '中立', c.neu], ['opp', '反对', c.opp]].filter((x) => x[2] > 0);
    replaceChildren(tally, h('div.ct-tide', segs.map(([k, , n]) => h('i.' + k, { style: { flexGrow: String(n) } }))),
      h('p', segs.map(([k, label, n]) => h('span.' + k, `${label}${num(n)}`))));
  }
  // 议程小签：指在议题签上看这一日要议哪几件、议到哪了
  function agendaTip() {
    const a = snap && snap.agenda;
    if (!a) return null;
    const mark = { done: '已决', cur: '在议', wait: '待议' };
    return { node: h('div.ct-agenda', h('b', `本日议程　已决${num(a.done)}／共${num(a.total)}事`),
      a.items.map((it) => h('p.' + it.state, h('em', mark[it.state]), h('span', it.title), it.urgent ? h('i', '急') : null))) };
  }
  function renderTopic(s) {
    const a = s.agenda;
    const it = a ? a.items[a.cur] : null;
    topicEl.hidden = !s.topic;
    topicNo.textContent = a ? `第${num(a.cur + 1)}事${it && it.urgent ? '·急' : ''}` : '议题';
    topicText.textContent = s.topic || '';
    const sig = a ? a.items.map((x) => x.state).join() : '';
    if (topicPips.dataset.sig !== sig) {
      topicPips.dataset.sig = sig;
      replaceChildren(topicPips, a ? a.items.map((x) => h('i.' + x.state)) : []);
    }
  }
  function renderControls(s) {
    const status = dg(s.status || (s.phase && s.phase.hint) || '');
    statusEl.textContent = status;
    statusEl.title = status;
    // 签没变就别重建：流式发言时快照每帧都来，重建会让按下与松开落在两颗按钮上，这一下就点空了
    const sig = s.controls.map((c) => [c.id, c.label, c.title, c.go, c.danger, c.muted].join('~')).join('|');
    if (sig !== ctlSig) {
      ctlSig = sig;
      replaceChildren(slips, s.controls.map((c) => h('button.slip' + (c.go ? '.go' : '') + (c.danger ? '.danger' : '') + (c.muted ? '.muted' : ''), { type: 'button', title: c.title, onclick: () => pressCtl(c) }, c.label)));
    }
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
      if (o && o.type === 'form' && formText && formText.textContent !== dg(o.text)) { formText.textContent = dg(o.text); formText.hidden = !o.text; }
      if (o && o.type === 'form' && foreBox) paintForecast(o.forecast);
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
      overlayJuan = juan({ title: o.title || '择一', width: '32rem',
        content: h('div.ct-menu',
          o.tier ? h('div.ct-tier', h('b', o.tier.name), o.tier.stats ? h('small', dg(o.tier.stats)) : null, o.tier.desc ? h('p', dg(o.tier.desc)) : null) : null,
          h('div.au-pick', o.buttons.map((b) => h('button.au-pick-row' + (b.sep ? '.sep' : '') + (b.danger ? '.danger' : ''), { type: 'button', onclick: () => pressCtl(b) }, h('b', b.label), b.title ? h('small', b.title) : null)))) });
    } else if (o.type === 'input') {
      const f = o.field;
      let field;
      // 选人的（训问、传召……）：名后写上职衔，一列认得清
      if (f && f.tag === 'select') field = qianziOrList(f.options.map((x) => ({ ...x, note: personOf(x.value).title })));
      else field = h('textarea.au-order', { rows: 3, placeholder: (f && f.placeholder) || '' }, (f && f.value) || '');
      const long = f && f.tag === 'select' && f.options.length > 8;
      overlayJuan = juan({ title: o.title || '输入', width: '34rem', height: long ? 'min(38rem, 84vh)' : undefined,
        content: h('div.ct-form', o.hint ? h('p.ct-fore-tip', o.hint) : null, field.el || field),
        actions: [{ label: '确定', onclick: ({ close }) => { const v = field.getValue ? field.getValue() : field.value; close('ok'); run(() => C.answer(v)); } }] });
    } else if (o.type === 'summary') {
      overlayJuan = juan({ title: '散朝', width: '40rem', content: summaryEl(o),
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
        else if (ov.type === 'menu') { const cancel = ov.buttons.find((b) => /取消|罢|免/.test(b.label)); if (cancel) run(() => C.press(cancel.id)); else { C.dismissMenu(); overlayId = ''; } }
        else if (ov.type === 'form') { const cancel = ov.buttons.find((b) => CANCEL.test(b.label)); if (cancel) run(() => C.press(cancel.id)); }
        else if (ov.type === 'seating' && ov.cancel) run(() => C.press(ov.cancel.id));
      });
    }
  }
  // 散朝卷：上头几枚大字（准几事、驳几事……），下头一事一行、行尾写裁处
  const VERDICT = { 准: 'sup', 驳: 'opp', 改: 'med', 部议: 'med', 廷议: 'med' };
  function summaryEl(o) {
    if (!o.pills.length && !o.items.length) return h('div.ct-summary', o.text);
    return h('div.ct-sum',
      h('div.ct-sum-pills', o.pills.map((p) => h('div.ct-sum-pill.' + (VERDICT[p.label] || 'neu'), h('b', num(p.n)), h('small', p.label)))),
      o.extra ? h('p.ct-sum-extra', dg(o.extra)) : null,
      o.items.length ? h('ol.ct-sum-list', o.items.map((it) => h('li', h('span', it.title), h('em.' + (VERDICT[it.verdict] || 'neu'), it.verdict)))) : h('p.au-none', '本朝未议任何议程。'));
  }
  // 下拉改成一列可点的行；value 不给则默认首项，给了而不在列中则一项不选
  function qianziOrList(options, initial, onpick) {
    let value = initial === undefined ? (options[0] ? options[0].value : '') : initial;
    const pickRows = options.map((o) => h('button.au-pick-row', { type: 'button', onclick: () => { setValue(o.value); onpick?.(o.value); } }, h('b', o.label), o.note ? h('small', o.note) : null));
    function setValue(v) {
      value = v;
      pickRows.forEach((b, i) => b.classList.toggle('on', options[i].value === v));
    }
    setValue(value);
    return { el: h('div.au-pick', pickRows), getValue: () => value, setValue };
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
        o.proposer ? h('p.ct-proposer', h('small', '主奏'), o.proposer.replace(/\d+/g, (d) => num(+d))) : null,
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
    formText = h('div.ct-formtext.q-scroll', dg(o.text));
    formText.hidden = !o.text;
    foreBox = o.forecast ? h('div.ct-row.ct-fore') : null;
    if (foreBox) paintForecast(o.forecast);
    // 要讨文字的项（如单独深言某人）先开一卷问话，再连字递交
    const go = (b) => {
      if (!b.prompts) { run(() => C.submit(values(), b.id)); return; }
      const v = values();
      askText(b.ask ? `问${b.ask}` : b.label, b.ask ? `欲问${b.ask}何事？` : `${profile().self}欲言……`, (text) => run(() => C.submit(v, b.id, text)));
    };
    const j = juan({
      title: o.title, width: '42rem', closable: !!cancel,
      content: h('div.ct-form', formText, rows.length ? h('div.ct-fields', rows) : null, foreBox,
        picks.length ? h('div.au-pick', picks.map((b) => h('button.au-pick-row' + (b.danger ? '.danger' : ''), { type: 'button', onclick: () => go(b) }, h('b', b.label), b.title ? h('small', dg(b.title)) : null))) : null),
      actions: cancel ? [{ label: cancel.label, onclick: ({ close }) => { close('ok'); go(cancel); } }] : []
    });
    setTimeout(() => { const first = rows.length && rows[0].querySelector('input, textarea'); if (first) first.focus(); }, 400);
    return j;
  }

  // 预审的党派风向：与站班的朝堂潮汐同一道三色条（支、中、反），下一句断语、两边各几党；议题改了随之重画
  let foreSig = '';
  function paintForecast(f) {
    const sig = JSON.stringify(f || null);
    if (sig === foreSig && foreBox.childNodes.length) return;
    foreSig = sig;
    foreBox.hidden = !f;
    if (!f) return replaceChildren(foreBox);
    const segs = [['sup', '支', f.sup], ['neu', '中', f.mid], ['opp', '反', f.opp]].filter((x) => x[2] > 0);
    replaceChildren(foreBox, h('span', '党派风向'), h('div.ct-fore-body',
      segs.length ? h('div.ct-tide', segs.map(([cls, ch, v]) => h('i.' + cls, { style: { flexGrow: String(v) } }, v >= 8 ? `${ch} ${num(v)}%` : ''))) : null,
      h('p.ct-fore-tip', f.tip || '议题未定，无从预估'),
      f.sides.length ? h('p.ct-fore-sides', f.sides.join('　')) : null));
  }

  // 名单注：老层写「顺天府尹忠88 野35」，职衔与忠、野连成一串：拆开、数照记数设置写
  function noteOf(s) {
    const t = String(s || '');
    const zhong = t.match(/忠\s*(\d+)/), ye = t.match(/野\s*(\d+)/);
    const title = t.replace(/忠\s*\d+|野\s*\d+/g, '').trim();
    return [title, zhong ? `忠${num(+zhong[1])}` : '', ye ? `野${num(+ye[1])}` : ''].filter(Boolean).join(' · ');
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
      } }, p.label, p.note ? h('small', noteOf(p.note)) : null);
      return b;
    }));
    countEl.textContent = `已召${num(picked.size)}人`;
    // 记不记起居注：两项说明都长，竖签装不下（原先截成「记」「不录（密」），排成两行可点项
    const record = yq ? qianziOrList(st.record.map((x) => ({ value: x.value, label: x.label })), (st.record.find((x) => x.checked) || st.record[0] || {}).value) : null;
    setupJuan = juan({
      title: modeName(st.kind), note: '筹备', width: '52rem', height: 'min(44rem, 86vh)',
      content: h('div.ct-setup',
        h('label', h('span', '议题'), topic), pend,
        h('div.ct-row', h('span', '议题类型'), types), custom,
        h('div.ct-row', h('span', yq ? '心腹' : '应召官员'), countEl), people,
        record ? h('div.ct-row', h('span', '起居注')) : null, record ? record.el : null),
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
    crumbNote.textContent = [modeName(s.kind), dg((s.phase && s.phase.label) || s.progress)].filter(Boolean).join('　');
    renderTopic(s);
    // 主朝议层已收、只剩廷议某阶段的层待处置：实录与朝班照旧留着，只换浮层与案底
    if (!s.lingering) { renderEntries(s); renderRoster(s); }
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
    people.clear();
    firstOf.clear();
    entryItem.clear();
    rows.clear();
    rosterSig = ctlSig = tallySig = lastSpeaker = '';
    liveId = '';
    clearTimeout(liveTimer);
    delete rosterList._speaking;
    presenter.clear();
    newer.hidden = true;
    // 上一场的案底、朝班、议题别留到这一场（预审这类层先于主朝议层出来时，名单和签都还是空的）
    replaceChildren(slips);
    replaceChildren(rosterList, h('p.au-none', '入殿仪礼中……'));
    replaceChildren(tally);
    tally.hidden = true;
    rosterCount.textContent = '';
    statusEl.textContent = '';
    topicEl.hidden = true;
    const t = T();
    replaceChildren(flow, h('p.au-head', s.secret ? t.privateRecord : t.record), h('p.au-headsub', [game.select.date().text, modeName(s.kind)].filter(Boolean).join('　')));
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
  function begin(mode, opts) {
    try { return C.begin(mode, opts); } catch (e) { toast(e.message); return false; }
  }
  function convene(issueId) {
    try { return C.convene(issueId); } catch (e) { toast(e.message); return false; }
  }
  // 后朝：推演之际另召群臣，场景照常朝
  game.on('game:post-turn-court', () => {
    if (opened) return;
    try { C.postTurn(); } catch (e) { toast(e.message); }
  });
  return { begin, convene, get opened() { return opened || !!setupJuan; } };
}
