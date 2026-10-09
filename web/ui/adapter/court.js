// 朝议（「见」之朝议）：常朝、廷议、御前会议。三套老流程都边跑边往页面挂老弹层、塞按钮与发言气泡（tm-chaoyi*.js）。
// 这里做「镜」：内核流程一步不改，老弹层照样建（藏着）；盯住它们，把发言气泡读成「谁·何立场·说了什么」、
// 把按钮读成「叫什么」，交给新画面画；新画面点哪枝签，就替它点那颗老按钮。要讨文字的（朕欲先言、深问、自定裁决）
// 用 prompt()——新画面先收好文字，按时临时代答。筹备层（议题、类型、与会者、记录方式）读成表单，填回去再按开议。
// 认的老标识（见勘察账 report-p5）：常朝 #cy-stage（#cy-stage-main 气泡、#cy-action-bar 按钮、#cy-player-input 插言）；
// 廷议、御前 #chaoyi-modal（#cy-body 气泡、#cy-footer 按钮、#cy-input-row 插言）、#ty2-setup-bg、#yq2-setup-bg；
// 浮层 .cy-popover / #strict-queue-popover，二级输入 .cy-input-modal（#modal-input、#modal-ok），散朝 .cy-summary-mask；
// 其余朝议期间临时挂上的遮罩（如御前深问选人）一并认作「择一」的浮层。
import { bus } from '../core/bus.js';
import { claimOverlays, legacyMutation } from './kernel.js';

const w = window;
const G = () => w.GM || {};
const $ = (id) => document.getElementById(id);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}]/gu;
// 去表情、并空白；汉字之间的空格（老界面为排版插的，如「准 奏」）去掉
const clean = (s) => String(s || '').replace(EMOJI, '').replace(/\s+/g, ' ').replace(/(?<=[\u3400-\u9fff\u3000-\u303f\uff00-\uffef·])\s+(?=[\u3400-\u9fff\u3000-\u303f\uff00-\uffef·])/g, '').trim();
const hidden = (el) => !!el.closest('[style*="display:none"], [style*="display: none"]');

export const MODES = [['changchao', '常朝', '例行朝参，多事并奏', 10], ['tinyi', '廷议', '集议一桩大政，群臣各陈可否', 15], ['yuqian', '御前会议', '屏退宫人，密召心腹议机要', 10]];

// ---------- 认老元素：给每个元素一个稳定的号 ----------
const ids = new WeakMap();
const byId = new Map();
let seq = 0;
function idOf(el) {
  let id = ids.get(el);
  if (!id) { id = 'k' + (++seq); ids.set(el, id); }
  byId.set(id, el);
  return id;
}
const CONTAINERS = ['cy-stage', 'chaoyi-modal', 'ty2-setup-bg', 'yq2-setup-bg'];
let active = false;              // 朝议进行中（新画面开着）
const extras = new Set();        // 朝议期间临时挂上的遮罩
function isCourtNode(n) {
  if (!(n instanceof HTMLElement)) return false;
  if (CONTAINERS.includes(n.id) || n.id === 'strict-queue-popover') return true;
  if (n.matches('.cy-popover, .cy-input-modal, .cy-summary-mask')) return true;
  return active && n.querySelector && !!n.querySelector('button');
}
// 让内核桥的老浮层兜底别把这些挪进新前端（那会以无样式的老弹层露出来）
claimOverlays((n) => {
  if (!isCourtNode(n)) return false;
  if (!CONTAINERS.includes(n.id) && !n.matches('.cy-popover, .cy-input-modal, .cy-summary-mask') && n.id !== 'strict-queue-popover') extras.add(n);
  return true;
});

// ---------- 读：气泡 ----------
const STANCE = { support: '支持', oppose: '反对', neutral: '中立', mediate: '折中', sup: '支持', opp: '反对', med: '折中', alt: '另议', neu: '中立' };
function playerNames() {
  const pi = (w.P && w.P.playerInfo) || {};
  return new Set(['皇帝', '陛下', '朕', pi.characterName].filter(Boolean));
}
// 常朝：#cy-stage-main 下 .cy-bubble-row（npc / player / system）与 .round-divider
function ccEntries(stage) {
  const main = stage.querySelector('#cy-stage-main');
  if (!main) return [];
  return [...main.children].map((row) => {
    const id = idOf(row);
    if (row.classList.contains('round-divider')) return { id, role: 'divider', text: clean(row.textContent) };
    const textEl = row.querySelector('.cy-bubble-text');
    const text = clean(textEl ? textEl.textContent : row.textContent);
    if (!row.classList.contains('cy-bubble-row') || row.classList.contains('system')) return text ? { id, role: 'note', text } : null;
    const meta = row.querySelector('.cy-bubble-meta');
    const st = meta && meta.querySelector('.stance');
    const stance = st ? (String(st.className).match(/stance-(\w+)/) || [])[1] || '' : '';
    let who = '';
    if (meta) { const first = [...meta.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); who = clean(first ? first.textContent : meta.textContent); }
    const [name, title] = who.split(/\s*·\s*/);
    return { id, role: row.classList.contains('player') ? 'me' : 'them', name: name || '', title: title || '', stance: STANCE[stance] || '', streaming: text === '…' || text === '...', text };
  }).filter(Boolean);
}
// 廷议、御前：#cy-body 下 addCYBubble 的老气泡（名字一行 + .cy-bubble）与居中的旁白
function cyEntries(modal) {
  const body = modal.querySelector('#cy-body');
  if (!body) return [];
  const me = playerNames();
  return [...body.children].map((row) => {
    if (row.id === 'yq2-inner-board' || row.id === 'ty2-stance-board' || row.id === 'ty3-continue-btn' || row.querySelector('[onclick*="_cy_pickMode"]')) return null;
    const id = idOf(row);
    const bubble = row.querySelector('.cy-bubble');
    if (!bubble) { const t = clean(row.textContent); return t ? { id, role: 'note', text: t } : null; }
    const nameEl = bubble.previousElementSibling;
    const first = nameEl ? [...nameEl.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()) : null;
    const name = clean(first ? first.textContent : nameEl ? nameEl.textContent : '');
    const sp = nameEl && nameEl.querySelector('.ty-fb-sp');
    const stance = sp ? (String(sp.className).match(/\b(sup|opp|med|alt|neu)\b/) || [])[1] || '' : '';
    const cand = nameEl && nameEl.querySelector('.yq-cand-sp');
    const text = clean(bubble.textContent);
    return { id, role: me.has(name) ? 'me' : 'them', name, title: '', stance: STANCE[stance] || '', candor: cand ? clean(cand.textContent) : '', guarded: row.classList.contains('yq-guard'),
      streaming: text === '…' || text === '...', text };
  }).filter(Boolean);
}

// ---------- 读：按钮 ----------
const PROMPTS = /_ty2_playerInterject|_yq2_askAdvisor|_yq2_decide\(\s*['"]custom/;
const callOf = (on) => { const m = String(on || '').replace(/if\s*\(typeof\s+\w+\s*===?\s*['"]function['"]\)/g, '').match(/([A-Za-z_$][\w$]*)\s*\(([^()]*)\)/); return m ? `${m[1]}(${m[2].replace(/\s+/g, '')})` : ''; };
function control(b) {
  const on = b.getAttribute('onclick') || '';
  const cls = String(b.className || '');
  const kids = [...b.children].filter((k) => clean(k.textContent));
  const label = kids.length > 1 ? clean(kids[0].textContent) : clean(b.textContent);
  const note = kids.length > 1 ? kids.slice(1).map((k) => clean(k.textContent)).filter(Boolean).join('·') : '';
  return { id: idOf(b), label, key: callOf(on) || label, title: clean([note, b.title || ''].filter(Boolean).join('　')), go: /\bprimary\b|\bbp\b|\bkey\b/.test(cls), danger: /danger|vermillion/.test(cls + (b.getAttribute('style') || '')),
    muted: /\bmuted\b/.test(cls), prompts: PROMPTS.test(on), ask: (on.match(/_yq2_askAdvisor\(\s*'([^']+)'/) || [])[1] || '' };
}
const usable = (b) => b && !b.disabled && !hidden(b) && clean(b.textContent) && !b.closest('.cy-popover:not(.show)') && !/\.focus\(\)/.test((b.getAttribute('onclick') || '').replace(/_\w+\(/g, 'X'));
function controlsOf(kind, root) {
  const sel = kind === 'changchao' ? '#cy-action-bar button, #cy-jinkou-btn' : '#cy-footer button, .yq-acts button, #yq2-inner-board button, #ty3-continue-btn button';
  const seen = new Set();
  return [...root.querySelectorAll(sel)].filter(usable).map(control).filter((c) => !seen.has(c.key) && seen.add(c.key));
}
function statusOf(kind, root) {
  const box = root.querySelector(kind === 'changchao' ? '#cy-action-bar' : '#cy-footer');
  if (!box) return '';
  const copy = box.cloneNode(true);
  copy.querySelectorAll('button').forEach((b) => b.remove());
  return clean(copy.textContent);
}

// ---------- 读：筹备层 ----------
function setupOf(bg, pre) {
  const val = (sel) => { const el = bg.querySelector(sel); return el ? el.value : ''; };
  const radios = (name) => [...bg.querySelectorAll(`input[type=radio][name="${name}"]`)].map((r) => ({ value: r.value, label: clean((r.closest('label') || r.parentElement || {}).textContent), checked: r.checked }));
  const checks = (cls, group) => [...bg.querySelectorAll(`input[type=checkbox].${cls}`)].map((c) => {
    const lab = c.closest('label');
    const text = clean(lab ? lab.textContent : c.value);
    return { id: idOf(c), value: c.value, label: c.value, note: clean(text.replace(c.value, '')), checked: c.checked, group };
  });
  const pending = bg.querySelector(`#${pre}-pending-pick`);
  return {
    kind: pre === 'ty2' ? 'tinyi' : 'yuqian',
    topic: val(`#${pre}-topic`), placeholder: (bg.querySelector(`#${pre}-topic`) || {}).placeholder || '',
    pending: pending ? [...pending.options].filter((o) => o.value !== '').map((o) => ({ value: o.value, label: clean(o.textContent) })) : [],
    types: radios(`${pre}-type`), custom: val(`#${pre}-type-custom`),
    people: pre === 'ty2' ? [...checks('ty2-attendee', 'default'), ...checks('ty2-extra', 'extra')] : checks('yq2-advisor', 'default'),
    record: pre === 'yq2' ? radios('yq2-record') : [],
    max: pre === 'yq2' ? 8 : 0
  };
}

// ---------- 读：浮层（菜单、二级输入、散朝总结） ----------
function overlayOf() {
  const modal = document.querySelector('.cy-input-modal');
  if (modal) {
    const field = modal.querySelector('#modal-input');
    const title = clean((modal.querySelector('h3, h4, .title, .cy-input-title') || {}).textContent || modal.textContent.split('\n')[0]);
    return {
      type: 'input', id: idOf(modal), title,
      field: field ? { tag: field.tagName.toLowerCase(), value: field.value || '', placeholder: field.placeholder || '', options: field.tagName === 'SELECT' ? [...field.options].map((o) => ({ value: o.value, label: clean(o.textContent) })) : [] } : null,
      ok: $('modal-ok') ? idOf($('modal-ok')) : '', cancel: $('modal-cancel') ? idOf($('modal-cancel')) : ''
    };
  }
  const sum = document.querySelector('.cy-summary-mask');
  if (sum) {
    const copy = sum.cloneNode(true);
    copy.querySelectorAll('button').forEach((b) => b.remove());
    return { type: 'summary', id: idOf(sum), text: String(copy.innerText || copy.textContent || '').replace(/\n{3,}/g, '\n\n').trim(), buttons: [...sum.querySelectorAll('button')].filter((b) => clean(b.textContent)).map(control) };
  }
  const pop = document.querySelector('.cy-popover.show, #strict-queue-popover');
  if (pop && pop.querySelector('button')) {
    const btns = [...pop.querySelectorAll('button')].filter((b) => clean(b.textContent));
    const copy = pop.cloneNode(true);
    copy.querySelectorAll('button').forEach((b) => b.remove());
    return { type: 'menu', id: idOf(pop), title: clean(copy.textContent).slice(0, 40), buttons: btns.map(control) };
  }
  const layers = [...document.querySelectorAll('body > div[id^="ty3-"][id$="-bg"]'), ...[...extras].filter((n) => n.isConnected)];
  const layer = layers[layers.length - 1];
  if (layer && layer.id === 'ty3-seating-bg' && w.CY && w.CY._ty3 && w.CY._ty3.bench) return seatingOf(layer, w.CY._ty3);
  return layer ? formOf(layer) : null;
}
// 起议站班：三班站位直接取 CY._ty3.bench（老层把名字连排、班头还夹英文），按党分组；潮汐取 tide
function seatingOf(bg, t) {
  const side = (k, label) => {
    const items = Array.isArray(t.bench[k]) ? t.bench[k] : [];
    const groups = new Map();
    for (const it of items) {
      const party = it && it.party ? String(it.party) : '';
      if (!groups.has(party)) groups.set(party, []);
      groups.get(party).push(String(it.name || ''));
    }
    return { side: k, label, count: items.length, groups: [...groups].map(([party, names]) => ({ party, names })) };
  };
  const btn = (re) => [...bg.querySelectorAll('button')].find((b) => re.test(clean(b.textContent)));
  const proposer = bg.querySelector('.ty3-st-proposer');
  return {
    type: 'seating', id: idOf(bg), topic: String(t.topic || ''),
    proposer: proposer ? clean(proposer.textContent).replace(/^主奏者[:：]\s*/, '') : '',
    tide: { left: +(t.tide && t.tide.left) || 0, center: +(t.tide && t.tide.center) || 0, right: +(t.tide && t.tide.right) || 0 },
    benches: [side('left', t.proposerParty ? `同·${t.proposerParty}及其盟` : '同'), side('center', '中立'), side('right', '异')],
    go: btn(/开议/) ? control(btn(/开议/)) : null, cancel: btn(/罢/) ? control(btn(/罢/)) : null
  };
}
// 表单卷：一段说明、几个输入、一排可点项（按钮，或带 onclick 的候选块；内层按钮已算则外层不再算）
const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select';
function formOf(bg) {
  const labels = [];
  const fields = [...bg.querySelectorAll(FIELDS)].filter((f) => f.id && !hidden(f)).map((f) => {
    const prev = f.previousElementSibling && /LABEL|DIV|SPAN/.test(f.previousElementSibling.tagName) && !f.previousElementSibling.querySelector(FIELDS) ? f.previousElementSibling : null;
    const lab = f.closest('label') || prev;
    if (lab) labels.push(lab);
    return {
      id: f.id, tag: f.tagName.toLowerCase(), value: f.value || '', placeholder: f.placeholder || '',
      label: clean(lab ? lab.textContent : '').slice(0, 24),
      options: f.tagName === 'SELECT' ? [...f.options].map((o) => ({ value: o.value, label: clean(o.textContent) })) : []
    };
  });
  const clicks = [...bg.querySelectorAll('button, [onclick]')].filter((el) => el !== bg && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && usable(el));
  const inner = clicks.filter((el) => !clicks.some((o) => o !== el && el.contains(o)));
  const buttons = inner.map(control);
  const x = [...bg.querySelectorAll('button, [onclick]')].find((el) => /^[✕×✖]$/.test(String(el.textContent || '').trim()) && !el.disabled && !hidden(el));
  if (x && !buttons.some((b) => /取消|关闭|^罢/.test(b.label))) buttons.push({ ...control(x), label: '关闭', key: 'close' });
  buttons.forEach((b, i) => {
    // 廷推候选：名后的「*」是内核标的党魁；候选按党分块，党名补进注里
    const block = inner[i].closest('.ty3-tj-party-block');
    if (block) {
      const head = block.querySelector('.ty3-tj-party-head');
      const party = head ? clean((head.firstChild && head.firstChild.nodeType === 3 ? head.firstChild.textContent : head.textContent)) : '';
      const lead = /\*$/.test(b.label);
      b.label = b.label.replace(/\s*\*$/, '');
      b.title = [party, lead ? '党魁' : '', b.title].filter(Boolean).join('·');
      return;
    }
    if (b.title || buttons.filter((o) => o.label === b.label).length < 2) return;
    const row = inner[i].parentElement;
    b.title = row ? clean(row.textContent.replace(inner[i].textContent, '')).slice(0, 40) : '';
  });
  // 标签与正文分开：克隆前给标签打个记号（不在所盯的属性之列），克隆后连记号带标签一并去掉
  labels.forEach((l) => l.setAttribute('data-tm-lab', ''));
  const copy = bg.cloneNode(true);
  labels.forEach((l) => l.removeAttribute('data-tm-lab'));
  copy.querySelectorAll('[data-tm-lab], button, [onclick], input, textarea, select, script, style').forEach((n) => n.remove());
  copy.querySelectorAll('div, p, li, h1, h2, h3, h4, h5, tr, br').forEach((n) => n.append('\n'));
  const lines = String(copy.textContent || '').split('\n').map(clean).filter(Boolean);
  return { type: 'form', id: idOf(bg), title: (lines[0] || '择一').replace(/^〔\s*|\s*〕$/g, ''), text: lines.slice(1).join('\n'), fields, buttons };
}
// 表单卷里边写边同步：把这几项填进老层（触发它自己的 oninput / onchange，如预审的党派风向随议题即时更新），回报老层眼下各项的值
export function fill(values) {
  for (const [id, v] of Object.entries(values || {})) {
    const f = $(id);
    if (!f || f.value === v) continue;
    f.value = v;
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const ov = overlayOf();
  return ov && ov.type === 'form' ? Object.fromEntries(ov.fields.map((f) => [f.id, ($(f.id) || {}).value || ''])) : {};
}
// 表单卷递交：先填输入，再按那一项
export function submit(values, buttonId, text) {
  fill(values);
  press(buttonId, text);
}

// ---------- 快照 ----------
export function snapshot() {
  const stage = $('cy-stage'), modal = $('chaoyi-modal'), ty = $('ty2-setup-bg'), yq = $('yq2-setup-bg');
  // 廷议八阶段的层（草诏、用印、补述……）可能在主朝议层收起后仍待处置：有它在，朝议就还没散
  const ty3 = document.querySelector('body > div[id^="ty3-"][id$="-bg"]');
  if (!stage && !modal && !ty && !yq && !ty3) return { open: false };
  const CY = w.CY || {};
  const kind = stage ? 'changchao' : CY.mode === 'yuqian' ? 'yuqian' : 'tinyi';
  const root = stage || modal;
  const setup = ty ? setupOf(ty, 'ty2') : yq ? setupOf(yq, 'yq2') : null;
  let topic = '', progress = '', roster = [];
  if (kind === 'changchao') {
    const cur = root.querySelector('#cc-agenda .cc-ag-item.cur .cc-ag-ti');
    topic = cur ? clean(cur.textContent) : '';
    const head = root.querySelector('#cc-agenda .cc-ag-h');
    progress = head ? clean(head.textContent).replace(/^本日议程·?/, '') : '';
    roster = [...root.querySelectorAll('.bench-avatar[data-name]')].filter((a) => !a.classList.contains('absent')).map((a) => {
      const t = String(a.getAttribute('title') || '');
      return { name: a.dataset.name, title: clean(t.split('·').slice(1).join('·').replace(/\(.*\)$/, '')) };
    });
  } else if (CY._ty2) {
    topic = CY._ty2.topic || '';
    progress = CY._ty2.roundNum ? `第${CY._ty2.roundNum}轮` : '';
    roster = (CY._ty2.attendees || []).map((n) => ({ name: n, stance: STANCE[((CY._ty2.stances || {})[n] || {}).current] || ((CY._ty2.stances || {})[n] || {}).current || '' }));
  } else if (CY._yq2) {
    topic = CY._yq2.topic || '';
    roster = (CY._yq2.advisors || []).map((n) => ({ name: n, stance: ((CY._yq2.opinions || {})[n] || {}).stance || '', candor: Math.round(((CY._yq2.opinions || {})[n] || {}).candor || 0) }));
  }
  const inputOpen = kind === 'changchao' ? !!(root && root.querySelector('#cy-player-input')) : !!($('cy-input-row') && !/none/.test($('cy-input-row').style.display || ''));
  return {
    open: true, lingering: !root && !setup, kind, setup, topic, progress, roster,
    entries: root && !setup ? (kind === 'changchao' ? ccEntries(root) : cyEntries(root)) : [],
    controls: root && !setup ? controlsOf(kind, root) : [],
    status: root && !setup ? statusOf(kind, root) : '',
    input: inputOpen, overlay: overlayOf()
  };
}

// ---------- 盯 ----------
let mo = null, raf = 0;
function emit() {
  raf = 0;
  const s = snapshot();
  bus.emit('court:changed', s);
  if (!s.open) stop();
}
function watch() {
  if (mo) return;
  mo = new MutationObserver((list) => { if (!raf && legacyMutation(list)) raf = requestAnimationFrame(emit); });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'disabled'] });
}
function stop() {
  if (mo) mo.disconnect();
  mo = null;
  active = false;
  extras.clear();
  byId.clear();
  bus.emit('court:closed', {});
}

// ---------- 动作 ----------
// 开议：同老卡片的路子（openChaoyi 建宿主，_cy_pickMode 过精力、次数关）
export function begin(mode, { topic = '' } = {}) {
  if (typeof w.openChaoyi !== 'function' || typeof w._cy_pickMode !== 'function') throw new Error('内核缺 openChaoyi / _cy_pickMode');
  active = true;
  watch();
  if (!$('chaoyi-modal') && !$('cy-stage')) w.openChaoyi();
  w._cy_pickMode(mode);
  const s = snapshot();
  // 被精力或次数关挡回：老宿主还停在择体卡片上，收掉（廷议走八阶段，先出预审层，那不算挡回）
  if (s.open && !s.setup && mode !== 'changchao' && !(w.CY && (w.CY._ty2 || w.CY._yq2 || w.CY._ty3)) && !document.querySelector('body > div[id^="ty3-"][id$="-bg"]')) { close(); return false; }
  if (mode === 'changchao' && !$('cy-stage')) { setTimeout(() => { if (!$('cy-stage')) close(); }, 1500); }
  // 带议题开廷议（如军务「付廷议」）：填进预审的议题框，触发它自己的风向预估
  const pa = $('ty3-pa-topic');
  if (topic && pa && !pa.value) fill({ 'ty3-pa-topic': topic });
  bus.emit('court:changed', snapshot());
  return true;
}
// 后朝：推演之际另召群臣（同老 _postTurnCourtChoose 的开法：v3 常朝 _cc3_open 带 isPostTurn，不受当回合朝会次数之限）。
// 须在内核已进后朝之态（_beginPostTurnCourtState 置 GM._isPostTurnCourt）后再开，否则推演没起来就别开朝
export function postTurn() {
  const g = w.GM;
  if (!g || !g._isPostTurnCourt) return false;
  if (typeof w._cc3_open !== 'function') throw new Error('内核缺 _cc3_open');
  active = true;
  watch();
  if (!g._chaoyiCount) g._chaoyiCount = {};
  if (!g._chaoyiCount[g.turn]) g._chaoyiCount[g.turn] = 0;
  w._cc3_open({ isPostTurn: true, source: 'post-turn-court' });
  if (w.CY) { w.CY.mode = 'changchao'; w.CY.topic = ''; }
  bus.emit('court:changed', snapshot());
  return true;
}
// 点一颗老按钮；要讨文字的先给文字（临时代答 prompt）
export function press(id, text) {
  const el = byId.get(id);
  if (!el || !el.isConnected) throw new Error('此项已不可用');
  if (text == null) { el.click(); return; }
  const ask = w.prompt;
  w.prompt = () => String(text);
  try { el.click(); } finally { w.prompt = ask; }
}
// 二级输入：填 #modal-input 再按确定
export function answer(value) {
  const field = $('modal-input');
  if (field) field.value = value;
  const ok = $('modal-ok');
  if (!ok) throw new Error('输入卷已收');
  ok.click();
}
// 插言：常朝走 onPlayerSpeak，廷议御前走 _cySubmitPlayerLine
export function speak(text) {
  const t = String(text || '').trim();
  if (!t) return;
  if ($('cy-stage')) {
    if (typeof w.onPlayerSpeak !== 'function') throw new Error('内核缺 onPlayerSpeak');
    w.onPlayerSpeak(t);
    return;
  }
  const inp = $('cy-player-input');
  if (!inp || typeof w._cySubmitPlayerLine !== 'function') throw new Error('此刻不能插言');
  inp.value = t;
  w._cySubmitPlayerLine();
}
// 筹备：填表再开议
export function startSetup(form) {
  const bg = $('ty2-setup-bg') || $('yq2-setup-bg');
  if (!bg) throw new Error('筹备卷已收');
  const pre = bg.id.startsWith('ty2') ? 'ty2' : 'yq2';
  const set = (sel, v) => { const el = bg.querySelector(sel); if (el) el.value = v; };
  if (form.pending != null && form.pending !== '' && pre === 'ty2') {
    const pick = bg.querySelector('#ty2-pending-pick');
    if (pick) { pick.value = String(form.pending); if (typeof w._ty2_pickPending === 'function') w._ty2_pickPending(pick); }
  }
  set(`#${pre}-topic`, form.topic || '');
  bg.querySelectorAll(`input[type=radio][name="${pre}-type"]`).forEach((r) => { r.checked = r.value === form.type; });
  set(`#${pre}-type-custom`, form.custom || '');
  if (pre === 'yq2') bg.querySelectorAll('input[type=radio][name="yq2-record"]').forEach((r) => { r.checked = r.value === (form.record || 'keep'); });
  const want = new Set(form.people || []);
  bg.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = want.has(c.value); });
  const start = [...bg.querySelectorAll('button')].find((b) => /startSession/.test(b.getAttribute('onclick') || ''));
  if (!start) throw new Error('筹备卷缺开议');
  start.click();
}
export function cancelSetup() {
  if ($('ty2-setup-bg') && typeof w._ty2_cancelSetup === 'function') w._ty2_cancelSetup();
  const yq = $('yq2-setup-bg');
  if (yq) yq.remove();
  close();
}
// 退朝：常朝 _cc3_close，廷议御前 closeChaoyi
export function close() {
  if ($('cy-stage') && typeof w._cc3_close === 'function') w._cc3_close();
  if ($('chaoyi-modal') && typeof w.closeChaoyi === 'function') w.closeChaoyi();
  ['ty2-setup-bg', 'yq2-setup-bg'].forEach((id) => { const el = $(id); if (el) el.remove(); });
  for (const n of extras) n.remove();
  emit();
}
// 今日朝议次数（常朝、廷议一日至多两次；御前不限）
export function todayCount() {
  const g = G();
  return ((g._chaoyiCount || {})[g.turn]) || 0;
}
// 时政「御前召对群臣」：内核把议题记入待议，开廷议筹备并填好议题（_shizhengConvene）
export function convene(issueId) {
  if (typeof w._shizhengConvene !== 'function') throw new Error('内核缺 _shizhengConvene');
  active = true;
  watch();
  w._shizhengConvene(issueId);
  const s = snapshot();
  bus.emit('court:changed', s);
  return s.open;
}
