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

// 老界面的样式表一律停用（新前端不受其全局选择器影响）
export function disableLegacyStyles() {
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    if (!link.dataset.newui) link.disabled = true;
  }
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
  swap('showTurnResult', (orig) => function () {
    bus.emit('game:turn-result', { args: [...arguments].map((a) => (typeof a === 'string' ? a : null)) });
    return orig.apply(this, arguments);
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

// 开发期守望：老界面若自己弹出了浮层（新前端还没接管的那些），记下来并发事件，免得流程卡在看不见的弹窗上
function watchLegacyOverlays() {
  const known = new Set(['tm-newui-root']);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement) || known.has(n.id) || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK') continue;
        const desc = { id: n.id || '', className: String(n.className || '').slice(0, 80), text: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
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
  watchLegacyOverlays();
}
