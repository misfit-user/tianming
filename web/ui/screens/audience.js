// 见：召对（问对）。正式问对以「望宝座」一镜为景，私下叙谈换到窗前；左立轴挂其人像，像下是忠诚、心绪与诸动作；
// 右边一卷竖写实录（正式为起居注，私下为燕闲私语）：「上曰」「某某对曰」，流式回话一字字落在最左一行；
// 案底择语气、拟问、垂询；初见先行赐座／赐茶之礼。名单（召对卷）分阶下待见、有臣求见、在朝诸臣、远方之人。
// 一切经 game.audience（adapter/audience.js）；名目取身份档 audience。
import { h, replaceChildren } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { num } from '../core/numerals.js';
import { juan, qianzi, zhou, loadFonts } from '../kit/index.js';

const toast = (text) => bus.emit('kernel:toast', { text });
const EMOTION = ['', '镇定', '从容', '拘谨', '不安', '惶恐'];

export function createAudience({ root, study, game, profile, onClose, onLetter }) {
  const A = game.audience;
  let prof = profile();
  let opened = false;
  let s = null;                 // 这一场（adapter session）
  let log = [];                 // 实录：{ role: me|them|note|head, text, … }
  let live = null;              // 正在流式写出的那一条
  let busy = false;

  // ---------- 画面 ----------
  const crumbName = h('b.q-gold');
  const crumbNote = h('small');
  const crumb = h('div.crumb.q-qi.thin', crumbName, crumbNote);
  const leave = h('button.back.q-qi.q-pai', { type: 'button', onclick: () => close() }, h('b.q-gold', ''), h('small', '收卷'));
  // 左：立轴与名牌、诸动作
  const portrait = h('div.au-zhou');
  const nameEl = h('h3');
  const sub = h('div.au-sub');
  const loyEl = h('span.au-loy');
  const emoMark = h('i');
  const emo = h('div.au-emo', h('span', '镇定'), h('div.track', emoMark), h('span', '惶恐'));
  const present = h('div.au-present');
  const acts = h('div.au-acts');
  const left = h('aside.au-left', portrait, h('div.au-plate.q-qi', nameEl, sub, h('div.au-meter', loyEl, emo), present, acts));
  // 右：实录
  const flow = h('div.au-flow');
  const rec = h('article.au-rec', flow);
  // 案底：语气、拟问、垂询；或初见之礼
  const topics = h('div.au-topics');
  const toneLabel = h('span.lab', '语气');
  const tone = qianzi(game.audience.TONES.map(([value, label, title]) => ({ value, label, title })), { value: 'direct', onchange: () => syncInput() });
  const input = h('textarea.au-in', { rows: 2, spellcheck: false, maxlength: 5000,
    onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } } });
  const sendBtn = h('button.slip.go', { type: 'button', onclick: () => send() });
  const ask = h('div.au-ask', h('div.au-tone', toneLabel, tone), h('div.au-write', topics, input), sendBtn);
  const rite = h('div.au-rite');
  const bar = h('div.au-bar', ask, rite);
  const el = h('section.scr.scr-audience', crumb, leave, left, rec, bar);
  root.append(el);
  // 竖写往左读：滚轮下拨即往左翻
  flow.addEventListener('wheel', (e) => {
    if (flow.scrollWidth <= flow.clientWidth) return;
    e.preventDefault();
    flow.scrollLeft -= e.deltaY || e.deltaX;
  }, { passive: false });

  // ---------- 实录 ----------
  const T = () => prof.audience;
  function speaker(row) {
    const t = T();
    if (row.role === 'me') return t.me + t.ask;
    return (row.who || (s && s.name) || '') + (s && s.mode === 'private' ? t.privateReply : t.reply);
  }
  function entry(row) {
    if (row.role === 'head') return [h('p.au-head', row.text), h('p.au-headsub', row.sub)];
    if (row.role === 'note') return h('p.au-note', row.text.startsWith('（') || row.text.startsWith('【') ? row.text : `（${row.text}）`);
    const extras = [];
    if (row.loyaltyDelta) extras.push(h('span.au-delta' + (row.loyaltyDelta > 0 ? '.up' : '.down'), `〔忠${row.loyaltyDelta > 0 ? '+' : ''}${num(row.loyaltyDelta)}〕`));
    const body = h('span.au-text', row.text);
    const p = h('p.au-' + row.role, h('b', speaker(row), '：'), body, ...extras);
    const more = [p];
    if (row.tone) more.push(h('p.au-tone', `【${row.tone}】`));
    for (const sg of row.suggestions || []) more.push(h('p.au-sug', h('em', '进言'), sg));
    return more;
  }
  function render() {
    replaceChildren(flow, log.flatMap((row) => entry(row)), live ? live.el : null);
    toEnd();
  }
  function toEnd() { requestAnimationFrame(() => { flow.scrollLeft = -flow.scrollWidth; }); }
  function startLive(who) {
    const text = h('span.au-text', '……');
    const p = h('p.au-them.live', h('b', speaker({ role: 'them', who }), '：'), text, h('i.au-brush'));
    live = { el: p, text, who };
    flow.append(p);
    toEnd();
  }

  bus.on('audience:stream', ({ text }) => {
    if (!opened) return;
    if (!live) startLive(s && s.name);
    live.text.textContent = text ? text.replace(/〔?[^〔〕\n]*忠诚\s*[+\-]?\d*[^〔〕\n]*〕?\s*$/, '') : '……';
    toEnd();
  });
  bus.on('audience:note', ({ text }) => {
    if (!opened) return;
    log.push({ role: 'note', text });
    if (live) { flow.insertBefore(entryNode({ role: 'note', text }), live.el); toEnd(); } else render();
    refreshPlate();
  });
  function entryNode(row) { const e = entry(row); return Array.isArray(e) ? e[0] : e; }
  // 对质者当庭之言（内核画成另一枚气泡，不经流式）
  bus.on('audience:aside', ({ who, text }) => {
    if (!opened) return;
    log.push({ role: 'them', who: `${who}（对质）`, text });
    if (!live) render();
  });
  bus.on('audience:closed', () => { if (opened) finish(); });

  // ---------- 名牌与动作 ----------
  function refreshPlate() {
    const ss = A.session();
    if (!ss) return;
    s = ss;
    loyEl.textContent = `忠${num(s.loyalty)}`;
    loyEl.className = 'au-loy' + (s.loyalty >= 70 ? ' hi' : s.loyalty < 30 ? ' lo' : '');
    emoMark.style.left = `${((Math.max(1, Math.min(5, s.emotion)) - 1) / 4) * 100}%`;
    emo.title = `心绪：${EMOTION[Math.max(1, Math.min(5, s.emotion))]}`;
    replaceChildren(present, s.confronters.length ? [h('small', '在场'), ...s.confronters.map((n) => h('span', n))] : []);
    renderActs();
  }
  function renderActs() {
    const t = T();
    const run = (f) => () => { try { f(); } catch (e) { toast(e.message); } refreshPlate(); };
    const btn = (label, onclick, cls = '') => h('button.q-yapai' + cls, { type: 'button', onclick }, label);
    const list = [
      btn(s.screened ? '已屏退' : t.screen, run(() => A.toggleScreen()), s.screened ? '.on' : ''),
      btn(t.excerpt, run(() => A.excerpt())),
      btn(t.order, () => openOrder()),
      btn(t.commits, () => openCommits()),
      btn(t.confront, () => openConfront()),
      btn(t.reward, () => openPick(t.reward, A.REWARDS, (k) => A.reward(k))),
      btn(t.punish, () => openPick(t.punish, A.PUNISHES, (k) => A.punish(k), true))
    ];
    if (s.envoy) {
      list.push(btn(t.envoy.accept, run(() => A.envoy('accept')), '.go'), btn(t.envoy.reject, run(() => A.envoy('reject'))), btn(t.envoy.temporize, run(() => A.envoy('temporize'))));
      if (s.counterable) list.push(btn(t.envoy.counter, run(() => A.counter())));
    } else {
      list.push(btn(t.adopt, run(() => A.adopt())));
    }
    replaceChildren(acts, list);
  }
  function openPick(title, rows, act, danger = false) {
    const j = juan({
      title, note: s.name, width: '26rem',
      content: h('div.au-pick', rows.map(([k, label, note]) => h('button.au-pick-row' + (danger ? '.danger' : ''), { type: 'button', onclick: () => {
        try { act(k); } catch (e) { toast(e.message); }
        j.close('ok');
        refreshPlate();
      } }, h('b', label), h('small', note))))
    });
  }
  function openOrder() {
    const t = T();
    const task = h('textarea.au-order', { rows: 3, placeholder: '面谕其办何事（如：三月内查清盐政积弊、节制蓟镇兵马）' });
    const dl = qianzi(A.DEADLINES.map((n) => ({ value: n, label: `${num(n)}回合` })), { value: 3 });
    juan({
      title: t.order, note: s.name, width: '32rem',
      content: h('div.au-orderbox', task, h('div.au-dl', h('span', '期限'), dl)),
      actions: [{ label: '下达', onclick: ({ close: done }) => {
        const text = task.value.trim();
        if (!text) { toast('请写明差遣何事'); return; }
        let ok = false;
        try { ok = A.order(text, Number(dl.getValue())); } catch (e) { toast(e.message); }
        if (ok) { done('ok'); log.push({ role: 'note', text: `【面谕】命${s.name}：${text}（限${num(Number(dl.getValue()))}回合）` }); render(); }
      } }]
    });
    setTimeout(() => task.focus(), 400);
  }
  function openCommits() {
    const b = A.commitments();
    const sec = (title, rows, cls) => (rows.length ? h('section.au-cm.' + cls, h('h5', `${title} · ${num(rows.length)}`), rows.map((r) => h('div.row',
      h('header', h('b', r.name), h('small', r.kind === 'done' ? '已履约' : r.kind === 'failed' ? '已终结' : r.left < 0 ? `逾期${num(-r.left)}回合` : r.left === 0 ? '本回合到期' : `尚余${num(r.left)}回合`)),
      h('p', r.task, r.promise ? h('em', `「${r.promise}」`) : null),
      h('div.bar', h('i', { style: { width: `${r.progress}%` } })),
      r.feedback ? h('p.fb', `复命：${r.feedback}`) : null,
      r.reason ? h('p.fb', `因由：${r.reason}`) : null))) : null);
    const any = b.overdue.length + b.active.length + b.done.length + b.failed.length;
    juan({
      title: T().commits, note: `待办${num(b.overdue.length + b.active.length)}件`, width: '40rem', height: 'min(36rem, 80vh)',
      content: any ? h('div.au-cms', sec('逾期未办', b.overdue, 'overdue'), sec('承办中', b.active, 'active'), sec('已复命', b.done, 'done'), sec('失诺搁置', b.failed, 'failed'))
        : h('p.au-none', '尚无交办事项。问对时「面谕差遣」，所交之事在此追踪进度与复命。')
    });
  }
  function openConfront() {
    const list = A.confrontable();
    if (!list.length) { toast('无可召入之人'); return; }
    const j = juan({
      title: T().confront, note: '至多三人', width: '28rem', height: 'min(32rem, 76vh)',
      content: h('div.au-pick', list.map((c) => h('button.au-pick-row', { type: 'button', onclick: () => {
        try { A.confront(c.name); } catch (e) { toast(e.message); }
        j.close('ok');
        refreshPlate();
      } }, h('b', c.name), h('small', `${c.title}　忠${num(c.loyalty)}`))))
    });
  }

  // ---------- 案底 ----------
  function syncInput() {
    const silent = tone.getValue() === 'silence';
    input.disabled = silent || busy;
    input.placeholder = silent ? '（沉默不语，目光审视）' : T().hint;
  }
  function renderBar() {
    const t = T();
    sendBtn.textContent = busy ? '…' : t.send;
    sendBtn.disabled = busy;
    syncInput();
    replaceChildren(topics, (s.topics || []).map((q) => h('button', { type: 'button', onclick: () => { input.value = q; input.focus(); } }, q)));
    const rites = s.ceremony ? (game.audience.CEREMONIES[s.mode === 'private' ? 'private' : 'formal']) : null;
    bar.classList.toggle('rite', !!rites);
    if (rites) {
      replaceChildren(rite, h('p', s.mode === 'private' ? `（${s.name}入内，左右退下。）` : `（${s.name}入殿行礼，候旨。）`),
        h('div', rites.map(([k, label]) => h('button.slip', { type: 'button', onclick: () => {
          try { A.ceremony(k); } catch (e) { toast(e.message); }
          refreshPlate();
          renderBar();
          input.focus();
        } }, label))));
    }
  }
  async function send() {
    if (busy) return;
    const tn = tone.getValue();
    const text = input.value.trim();
    if (!text && tn !== 'silence') { input.focus(); return; }
    if (s.ceremony) { try { A.ceremony(s.mode === 'private' ? 'none' : 'stand'); } catch (_e) { /* 内核自会摘掉 */ } }
    busy = true;
    log.push({ role: 'me', text: tn === 'silence' ? '（沉默以对）' : text });
    input.value = '';
    render();
    renderBar();
    try {
      await A.say(text, tn);
    } catch (e) {
      toast(e.message);
    }
    busy = false;
    settle();
  }
  // 回话落定：以史为准替换流式那一条（附忠诚增减、语气效果、进言要点）；未得回话（无密钥等）则撤去流式条
  function settle() {
    if (!opened) return;
    const tr = A.transcript();
    const last = tr.rows[tr.rows.length - 1];
    if (live) {
      if (last && last.role === 'them' && live.text.textContent && live.text.textContent !== '……') log.push({ ...last, who: s.name });
      live = null;
    }
    refreshPlate();
    render();
    renderBar();
    input.focus();
  }

  // ---------- 开合 ----------
  function begin() {
    s = A.session();
    if (!s) return false;
    const t = T();
    const formal = s.mode !== 'private';
    crumbName.textContent = t.title;
    crumbNote.textContent = `${formal ? game.audience.MODES[0][1] : game.audience.MODES[1][1]}　${game.select.date().text || ''}`;
    leave.querySelector('b').textContent = t.leave;
    replaceChildren(portrait, zhou({ name: s.name, src: s.portrait }));
    nameEl.textContent = s.name;
    sub.textContent = [s.envoy ? `${s.faction}使节` : s.title, s.envoy && s.mission ? s.mission : ''].filter(Boolean).join(' · ');
    rec.classList.toggle('private', !formal);
    const tr = A.transcript();
    log = [{ role: 'head', text: formal ? t.record : t.privateRecord, sub: `${game.select.date().text || ''}　${t.head(s.name, formal)}` }];
    if (tr.elided) log.push({ role: 'note', text: `更早${num(tr.elided)}条已收起` });
    if (s.recap) log.push({ role: 'note', text: `上次要点：${s.recap}` });
    log.push(...tr.rows.map((r) => ({ ...r, who: r.role === 'them' ? s.name : '' })));
    if (s.greeting) log.push({ role: 'them', text: s.greeting, who: s.name });
    live = null;
    busy = false;
    tone.setValue('direct');
    input.value = '';
    refreshPlate();
    render();
    renderBar();
    return true;
  }
  const veil = h('div.dk-veil');
  root.append(veil);
  const fade = (on) => new Promise((r) => { veil.classList.toggle('on', on); setTimeout(r, on ? 280 : 360); });
  // 召见某人：先过在不在朝（不在则转传书），再择问对之体
  function summon(name, how = 'pick') {
    prof = profile();
    if (!A.canAudience(name)) {
      if (onLetter) { toast(`${name}不在朝中，改遣书札`); onLetter(name); } else toast(`${name}不在朝中`);
      return;
    }
    if (how === 'formal' || how === 'private') { enter(() => A.open(name, how)); return; }
    const j = juan({
      title: T().title, note: name, width: '30rem',
      content: h('div.au-pick', game.audience.MODES.map(([k, label, note]) => h('button.au-pick-row', { type: 'button', onclick: () => { j.close('ok'); enter(() => A.open(name, k)); } },
        h('b', label), h('small', note))))
    });
  }
  async function enter(start) {
    if (opened) return;
    prof = profile();
    let ok = false;
    try { ok = start(); } catch (e) { toast(e.message); }
    if (!ok) return;                                       // 内核未放行（精力不足、不在京等）已以 toast 告知
    await fade(true);
    const ss = A.session();
    study.setShot(ss && ss.mode === 'private' ? 'title' : 'court');
    begin();
    await loadFonts({ 'TM-WenKai': log.map((r) => r.text).join('') + (s.topics || []).join(''), 'TM-MaShanZheng': s.name + T().record });
    opened = true;
    el.classList.add('on');
    await fade(false);
    if (!s.ceremony) input.focus();
  }
  async function finish() {
    if (!opened) return;
    opened = false;
    await fade(true);
    el.classList.remove('on');
    live = null;
    study.setShot('desk');
    onClose?.();
    await fade(false);
  }
  function close() {
    if (busy) { toast('对方尚在回话'); return; }
    try { A.close(); } catch (e) { toast(e.message); finish(); }
  }
  window.addEventListener('keydown', (e) => {
    if (!opened || document.querySelector('.q-juan-veil')) return;
    if (e.key === 'Escape' && document.activeElement !== input) { e.preventDefault(); close(); }
  });

  // ---------- 召对卷（名单） ----------
  function openRoster() {
    prof = profile();
    const t = T();
    const R = A.roster();
    const face = (c, onclick) => h('button.au-face', { type: 'button', onclick, title: [c.name, c.title].filter(Boolean).join(' · ') },
      zhou({ name: c.name, src: c.portrait }), h('small', c.title || ''), c.met ? h('i', '旧') : null);
    let j = null;
    const go = (f) => () => { j.close('ok'); f(); };
    const content = h('div.au-roster',
      R.pending.length ? h('section', h('h5', `${t.pending} · ${num(R.pending.length)}`), R.pending.map((q) => h('div.au-req',
        h('b', q.name, q.envoy ? h('em', '使节') : null), h('p', q.reason),
        h('div', h('button.q-yapai', { type: 'button', onclick: go(() => enter(() => A.openQueue(q.qid))) }, t.accept),
          h('button.q-yapai', { type: 'button', onclick: () => { try { A.dismissQueue(q.qid); } catch (e) { toast(e.message); } j.close('ok'); openRoster(); } }, t.dismiss))))) : null,
      R.seeking.length ? h('section', h('h5', `${t.seeking} · ${num(R.seeking.length)}`), R.seeking.map((c) => h('div.au-req',
        h('b', c.name, h('small', c.title)), h('p', c.reason),
        h('div', h('button.q-yapai', { type: 'button', onclick: go(() => enter(() => A.openSeeking(c.name))) }, t.accept),
          h('button.q-yapai', { type: 'button', onclick: () => { try { A.deny(c.name); } catch (e) { toast(e.message); } j.close('ok'); openRoster(); } }, t.refuse))))) : null,
      h('section', h('h5', `${t.court} · ${num(R.court.length)}`), R.court.length ? h('div.au-faces', R.court.map((c) => face(c, go(() => summon(c.name))))) : h('p.au-none', '朝中无人可召')),
      R.away.length ? h('section', h('h5', `${t.away} · ${num(R.away.length)}`), h('p.au-hint', '远方之人不能面对，点名即改遣书札'),
        h('div.au-away', R.away.map((c) => h('button', { type: 'button', title: c.location, onclick: go(() => onLetter && onLetter(c.name)) }, c.name, h('small', c.travel ? `→${c.travel}` : c.location))))) : null);
    j = juan({ title: t.title, note: game.select.date().text || '', width: '58rem', height: 'min(46rem, 86vh)', content });
  }

  return { openRoster, summon, get opened() { return opened; } };
}
