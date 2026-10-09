// 内核桥：老内核（index.html 里四百多个经典脚本）照旧载入；这里等它就绪，再把它的「表现函数」换成新前端的——
// 内核流程一步不改，只是该弹窗、该进度条、该开场仪典的地方，改成在总线上发事件，由新前端来画。
// 新前端只有 adapter/ 这一层碰内核全局（GM、P、老函数），其余各层一律经 game.js。
import { bus } from '../core/bus.js';
import { scenarioPerspective } from './select.js';

const w = window;

// 等老内核就绪：页面载完（defer 脚本、DOMContentLoaded 处理都已跑过）且开局、过回合的入口都在
export async function waitKernel({ timeoutMs = 120000 } = {}) {
  if (document.readyState !== 'complete') await new Promise((r) => w.addEventListener('load', r, { once: true }));
  const t0 = performance.now();
  while (!(typeof w.startGame === 'function' && typeof w.doActualStart === 'function' && typeof w._endTurnInternal === 'function' && w.GM && w.P)) {
    if (performance.now() - t0 > timeoutMs) throw new Error('老内核没有就绪：缺 startGame / doActualStart / _endTurnInternal');
    await new Promise((r) => setTimeout(r, 50));
  }
}

// 老界面的样式一律停用（新前端不受其全局选择器影响）：外链样式表，以及老代码插进页面的 <style>（主题配色、正文字体等，常带 !important）。
// 新前端自己的认得出：外链带 data-newui，内联带 data-ui；index.html 开关那段隐去老 DOM 的样式以 html.tm-newui 起头，也留着。
// 老代码换主题时会改写同一个 <style> 的内容（内容一改样式表重建、停用标记随之失效），所以盯着 <head> 随改随停
const ours = (el) => !!(el.dataset.newui || el.dataset.ui || (el.tagName === 'STYLE' && /html\.tm-newui/.test(el.textContent || '')));
function quiet(el) {
  if (ours(el)) return;
  if (el.tagName === 'STYLE' || (el.tagName === 'LINK' && el.rel === 'stylesheet')) {
    el.disabled = true;
    if (el.sheet) el.sheet.disabled = true;
  }
}
let styleWatch = null;
export function disableLegacyStyles() {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(quiet);
  if (styleWatch) return;
  styleWatch = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (target && target.tagName === 'STYLE') quiet(target);
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        quiet(n);
        if (n.querySelectorAll) n.querySelectorAll('link[rel="stylesheet"], style').forEach(quiet);
      }
    }
  });
  styleWatch.observe(document.head, { childList: true, subtree: true, characterData: true });
}

// ---------- 换表现函数 ----------
const originals = {};
function swap(name, make) {
  const orig = w[name];
  if (typeof orig !== 'function') {
    console.warn(`[newui] 内核里没有 ${name}，未接管`);
    return;
  }
  originals[name] = orig;
  w[name] = make(orig);
}
export function legacy(name) {
  return originals[name] || w[name];
}

// 开场仪典：剧本、身份、开局戏眼、开场白交给新前端；新前端演完调 begin() 继续内核原流程（doActualStart）
function installOpening() {
  swap('_tmShowOpeningCeremony', () => function (sc, sid, token) {
    if (typeof w._tmStartRequestCurrent === 'function' && !w._tmStartRequestCurrent(token)) return;
    const data = typeof w._tmOpeningCeremonyData === 'function' ? w._tmOpeningCeremonyData(sc) : { name: sc && sc.name, opening: String((sc && sc.opening) || '') };
    let done = false;
    const cleanup = () => {
      done = true;
      if (w._tmStartOpeningCleanup === cleanup) w._tmStartOpeningCleanup = null;
    };
    w._tmStartOpeningCleanup = cleanup;            // 内核另起一局时会调它作废这一场
    bus.emit('game:opening', {
      sid, ...data,
      perspective: scenarioPerspective(sc),           // 开场时内核还没装好人物，身份按剧本算
      begin() {
        if (done) return;
        cleanup();
        w.doActualStart(sid, token);
      }
    });
  });
}

// 进度、提示、回合史记：照旧调原函数（写进隐去的老 DOM，不碍事），同时发事件
function installFeedback() {
  swap('showLoading', (orig) => function (text, pct) {
    bus.emit('kernel:loading', { text: String(text ?? ''), pct: typeof pct === 'number' ? pct : null });
    return orig.apply(this, arguments);
  });
  swap('hideLoading', (orig) => function () {
    bus.emit('kernel:loaded', {});
    return orig.apply(this, arguments);
  });
  swap('toast', (orig) => function (msg) {
    bus.emit('kernel:toast', { text: String(msg ?? '') });
    return orig.apply(this, arguments);
  });
  // 回合史记：内核在「尚未落档」「朝会进行中」时只暂存、过后再调；真正显示时才给 #turn-modal 加 show。只在真显示时发事件。
  // 发完随即替老弹窗收起（closeTurnResult 只摘 show）：不然它隐着仍算「开着」，Esc、←→ 与快捷键都先被它吃掉
  swap('showTurnResult', (orig) => function () {
    const modal = document.getElementById('turn-modal');
    if (modal) modal.classList.remove('show');
    const r = orig.apply(this, arguments);
    if (!modal || modal.classList.contains('show')) {
      if (modal) modal.classList.remove('show');
      bus.emit('game:turn-result', { idx: w.GM && typeof w.GM._trCurrentIdx === 'number' ? w.GM._trCurrentIdx : null });
    }
    return r;
  });
  // 内核每次「该重画了」都会调 renderGameState：新前端据此刷新读数（合并成一帧一次）
  let pending = false;
  swap('renderGameState', (orig) => function () {
    if (!pending) {
      pending = true;
      requestAnimationFrame(() => { pending = false; bus.emit('game:changed', {}); });
    }
    return orig.apply(this, arguments);
  });
}

// 生命周期与世界事件转到总线
function installLifecycle() {
  const hooks = w.GameHooks;
  if (hooks && typeof hooks.on === 'function') {
    hooks.on('startGame:after', (sid) => bus.emit('game:started', { sid }));
    hooks.on('enterGame:after', () => bus.emit('game:entered', {}));
  } else if (hooks && typeof hooks.register === 'function') {
    hooks.register('startGame:after', (sid) => bus.emit('game:started', { sid }));
    hooks.register('enterGame:after', () => bus.emit('game:entered', {}));
  }
  const progress = w.TM && w.TM.Endturn && w.TM.Endturn.Progress;
  if (progress && typeof progress.on === 'function') {
    progress.on((type, payload) => bus.emit('game:advance-progress', { type, ...plain(payload) }));
  }
  const geb = w.GameEventBus;
  if (geb && typeof geb.emit === 'function') {
    const emit = geb.emit.bind(geb);
    geb.emit = function (name, payload) {
      bus.emit('world:' + name, plain(payload));
      return emit(name, payload);
    };
  }
}

// 只取可序列化的浅层字段：总线载荷不带内核对象引用
function plain(v) {
  if (v == null || typeof v !== 'object') return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (x == null || ['string', 'number', 'boolean'].includes(typeof x)) out[k] = x;
  }
  return out;
}

// 急报与驻留提示：老界面挂全屏遮罩「朕已知晓」、角落提示条；新前端接过来自己画（kernel:urgent / kernel:notice）。
// 仍先调原函数（它要记一笔通知史），再把它挂上去的老节点摘掉
function installNotices() {
  const ns = w.NotificationSystem;
  if (!ns) { console.warn('[newui] 内核里没有 NotificationSystem，急报未接管'); return; }
  const urgent = ns.urgent, persist = ns.persist;
  ns.urgent = function (title, detail, onConfirm) {
    const before = new Set(document.querySelectorAll('.notify-urgent'));
    urgent.apply(this, arguments);
    document.querySelectorAll('.notify-urgent').forEach((n) => { if (!before.has(n)) n.remove(); });
    let done = false;
    bus.emit('kernel:urgent', { title: String(title ?? ''), detail: String(detail ?? ''), confirm() { if (done) return; done = true; if (typeof onConfirm === 'function') onConfirm(); } });
  };
  ns.persist = function (msg) {
    const box = document.getElementById('notify-container');
    const before = box ? new Set(box.children) : new Set();
    persist.apply(this, arguments);
    const after = document.getElementById('notify-container');
    if (after) [...after.children].forEach((n) => { if (!before.has(n)) n.remove(); });
    bus.emit('kernel:notice', { text: String(msg ?? '') });
  };
}

// 老界面的几个入口改道到新前端：它的键盘快捷键（Esc 暂停、Ctrl+S 案卷、无局时 Esc 设置）与别处的调用都还在，
// 不改道就会去开看不见的老面板，或被兜底挪进来、与新前端的同名页打架。切标签（switchGTab）照常执行，另发 ui:tab 供新前端跟进。
// 内核凭老 DOM（#G 可见、启动页不可见）判断「正在局中」，新前端下老 DOM 全隐着、永远判否（Esc 就成了开设置）：
// 改问新前端此刻是否在局中的案前（setGameSurface，由书案显隐时告知）
let surface = false;
export function setGameSurface(on) {
  surface = !!on;
}
function installRouting() {
  swap('_tmPlayerGameSurfaceActive', () => function () { return !!(w.GM && w.GM.running) && surface; });
  swap('openPause', () => function () {
    if (!surface || (w.GM && w.GM.busy)) return;
    bus.emit('ui:pause', {});
  });
  swap('openSaveManager', () => function () { bus.emit('ui:saves', {}); });
  swap('openSettings', () => function () { bus.emit('ui:settings', {}); });
  swap('openHelp', () => function () { bus.emit('ui:help', {}); });     // F1：老帮助浮层会被兜底挪进来，改开新帮助册
  // 时政决断后内核会重开老「时局要务」面板来刷新——新前端的时政页自己刷新，这张老面板不必再出（不改道就压在时政页上）
  swap('openQuarterlyAgenda', () => function () { bus.emit('ui:agenda', {}); });
  // 问对收场：玩家退下、使节准驳后内核自行收场，都经此函数；新前端据 audience:closed 收卷
  swap('closeWenduiModal', (orig) => function () {
    const r = orig.apply(this, arguments);
    bus.emit('audience:closed', {});
    return r;
  });
  swap('switchGTab', (orig) => function (btn, id) {
    const r = orig.apply(this, arguments);
    bus.emit('ui:tab', { id: String(id || '') });
    return r;
  });
}

// 老界面自己弹出的浮层：
//   新前端已另画的（TAKEN）照旧藏着；
//   通用弹窗（generic-modal-overlay，许多子系统共用）与内联样式的全屏遮罩（例如战前御驾／委之、战报、他方旁观——它们等玩家点了流程才往下走）
//   一律挪进新前端根节点，让玩家照样看得见、点得了（screens.css 给老弹窗的几个类配了纸卷样式），流程不至卡在看不见的弹窗上；
//   其余记一笔、发 legacy:overlay
const TAKEN = new Set(['tm-newui-root', '_situationModal', 'tm-nokey-banner', 'tm-firstturn-guide', 'tm-changelog-ov', 'notify-container', 'wendui-modal', 'off-picker-modal']);
function blocking(n) {
  if (/generic-modal-overlay|modal-overlay|-overlay\b/.test(String(n.className || ''))) return true;
  const s = n.style;
  if (!s || s.position !== 'fixed') return false;
  // 只认铺满全屏的遮罩（inset:0，或四边贴齐），别把老界面的浮钮、角落提示也挪进来
  const full = (v) => v === '100%' || v === '100vw' || v === '100vh';
  return s.inset === '0px' || (s.top === '0px' && s.left === '0px' && (s.right === '0px' || full(s.width)) && (s.bottom === '0px' || full(s.height)));
}
// 别的接管模块可以认领一类老浮层（如朝议的老弹层由 adapter/court.js 自己镜像），兜底就不挪、不报
const claims = [];
export function claimOverlays(test) {
  claims.push(test);
}
// 盯老弹层用的变动过滤：落在新前端根节点里的变动（新画面自己重画）不算
export function legacyMutation(list) {
  const root = document.getElementById('tm-newui-root');
  return list.some((m) => !root || !root.contains(m.target));
}
const claimed = (n) => claims.some((f) => { try { return f(n); } catch (_e) { return false; } });
// 桌面版本机存储打不开时，内核在页底挂一条告警横幅（不铺满，新前端下会隐形）：认领下来改发 kernel:storage，书案展成急报卷。
// 横幅常在开机时就挂上、早于新前端装好，故另记一份，急报卷装好时来取
let storageAlarm = null;
function takeStorageAlarm(n) {
  if (!n || n.id !== 'tm-storage-unavailable') return false;
  const retry = n.querySelector('button');
  storageAlarm = {
    title: (n.querySelector('strong') || n).textContent.trim() || '存储暂时不可用',
    detail: ((n.querySelector('p') || {}).textContent || '').trim(),
    retry: () => { if (retry) retry.click(); }
  };
  bus.emit('kernel:storage', storageAlarm);
  return true;
}
claims.push(takeStorageAlarm);
export function pendingStorageAlarm() {
  if (!storageAlarm) takeStorageAlarm(document.getElementById('tm-storage-unavailable'));
  return storageAlarm && document.getElementById('tm-storage-unavailable') ? storageAlarm : null;
}
function watchLegacyOverlays() {
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement) || TAKEN.has(n.id) || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK' || claimed(n)) continue;
        const desc = { id: n.id || '', className: String(n.className || '').slice(0, 80), text: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
        const root = document.getElementById('tm-newui-root');
        if (root && blocking(n)) {
          n.classList.add('tm-legacy-pass');
          root.append(n);
          bus.emit('legacy:pass', desc);
          continue;
        }
        if (!desc.text && !desc.id) continue;
        console.warn('[newui] 老界面弹出了未接管的浮层', desc);
        bus.emit('legacy:overlay', desc);
      }
    }
  });
  mo.observe(document.body, { childList: true });
}

let installed = false;
export function installKernelBridge() {
  if (installed) return;
  installed = true;
  installOpening();
  installFeedback();
  installLifecycle();
  installNotices();
  installRouting();
  watchLegacyOverlays();
}
