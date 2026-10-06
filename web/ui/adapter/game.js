// 对界面的门面：新前端只经这里读状态、交动作、听变化。
//   await game.boot()                       等内核就绪、装上表现函数的替身
//   game.scenarios()                        剧本目录
//   await game.newGame(sid, opts)           开新局（途中发 game:opening，界面演完调 begin()）
//   await game.advance({ court })           过回合（推演）；进度走 game:advance-progress
//   game.saves.list() / save(name) / load(key)
//   game.select.date() …                    读数快照
//   game.config.saveAi(tier, 草稿) …        典章：AI 连接、体检、玩法开关、音量（adapter/config.js）
//   game.perspective()                      视角人物（身份、官职、辖区）；game.setViewAs(人) 借视角（开发用）
//   game.act.memorial(id, action, reply)    交动作
//   game.on(事件, fn)                       事件见 kernel.js
import { bus } from '../core/bus.js';
import { waitKernel, installKernelBridge, disableLegacyStyles } from './kernel.js';
import * as select from './select.js';
import * as config from './config.js';

const w = window;
let ready = null;

async function boot() {
  if (!ready) {
    ready = (async () => {
      await waitKernel();
      disableLegacyStyles();
      installKernelBridge();
      const loader = w.TMOfficialScenarioLoader;
      if (loader && typeof loader.ready === 'function') await loader.ready();
      bus.emit('kernel:ready', {});
    })();
  }
  return ready;
}

// 剧本目录（官方剧本懒加载，目录元数据先就绪）
function scenarios() {
  return ((w.P && w.P.scenarios) || []).map((s) => ({
    id: s.id, name: s.name || '', era: s.era || '', role: s.role || '', background: String(s.background || ''),
    official: !!s._lazyOfficial || /官方/.test(s.name || ''), workshop: !!s._workshopPackId, nativeStart: !!s.nativeStart
  }));
}

// 等某个事件，或超时、或内核报错（toast）时失败
function until(event, { timeoutMs = 120000, failOn = null } = {}) {
  return new Promise((resolve, reject) => {
    const offs = [];
    const done = (fn, v) => { offs.forEach((off) => off()); fn(v); };
    offs.push(bus.on(event, (p) => done(resolve, p)));
    if (failOn) offs.push(bus.on('kernel:toast', (t) => { if (failOn.test(t.text)) done(reject, new Error(t.text)); }));
    const timer = setTimeout(() => done(reject, new Error(`等 ${event} 超时`)), timeoutMs);
    offs.push(() => clearTimeout(timer));
  });
}

// 开新局。opts：difficulty、useMap（用剧本地图，默认是）、gameMode（yanyi 演义 / strict_hist 严格史实）、refText、saveName。
// 与老界面开局弹窗一样先把选项放进内核约定的几处，再调内核 startGame；进入游戏（enterGame 之后）时兑现
async function newGame(sid, { difficulty, useMap = true, gameMode = 'yanyi', refText = '', saveName } = {}) {
  await boot();
  if (difficulty !== undefined) w._pendingDifficulty = difficulty;
  w._pendingUseMap = useMap;
  w._pendingMapModeSid = sid;
  w._pendingMapModeAt = Date.now();
  w.P.conf = w.P.conf || {};
  w.P.conf.gameMode = gameMode;
  w.P.conf.refText = gameMode === 'strict_hist' ? refText : '';
  const sc = typeof w.findScenarioById === 'function' ? w.findScenarioById(sid) : null;
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : n);
  const name = saveName || `${(sc && sc.name) || '新纪元'}·${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  if (w.GM) w.GM.saveName = name;
  w._pendingSaveName = name;
  const entered = until('game:entered', { timeoutMs: 600000, failOn: /未找到|剧本错误|剧本加载失败|剧本校验失败|已取消/ });
  await w.startGame(sid);
  return entered;
}

// 过回合（推演）。court：推演后是否召集朝会（老界面在此弹「召集朝会／静候有司」）
async function advance({ court = false } = {}) {
  await boot();
  const g = w.GM;
  if (!g || !g.running) throw new Error('尚未开局');
  if (g.busy) throw new Error('推演进行中');
  if (!(w.P && w.P.ai && w.P.ai.key)) {
    bus.emit('kernel:toast', { text: '未设置 AI 密钥，不能推演' });
    throw Object.assign(new Error('未设置 AI 密钥'), { shown: true });   // 已提示过，调用方不必再报
  }
  bus.emit('game:advance-start', { turn: g.turn });
  try {
    await w._endTurnInternal({ postTurnCourt: !!court });
  } finally {
    bus.emit('game:advanced', { turn: w.GM && w.GM.turn });
  }
}

// ---------- 存读档 ----------
const desktop = () => !!(w.tianming && w.tianming.isDesktop !== false && typeof w.tianming.listSaves === 'function');
const saves = {
  // [{ key, name, turn, time, scenario, modified }]
  async list() {
    await boot();
    if (desktop()) {
      const r = await w.tianming.listSaves();
      return (r && r.success ? r.files : []).map((f) => ({ key: f.name, name: f.name, turn: f.turn, time: f.time || '', scenario: f.scenario || '', modified: f.modified || 0, auto: f.name === '__autosave__' }));
    }
    const sm = w.SaveManager;
    const all = sm && typeof sm.getAllSaves === 'function' ? sm.getAllSaves() : [];
    return (all || []).filter(Boolean).map((s) => ({ key: s.slotId, name: s.name || '', turn: s.turn, time: s.eraName || '', scenario: s.scenarioName || '', modified: s.timestamp || 0, auto: s.slotId === 0 }));
  },
  // 桌面：按名存一卷；网页：存进空着的或指定的槽
  async save(name, { slot } = {}) {
    await boot();
    if (desktop()) return w.desktopDoSave(String(name));
    const sm = w.SaveManager;
    let target = slot;
    if (target == null) {
      const used = new Set(((sm.getAllSaves && sm.getAllSaves()) || []).filter(Boolean).map((s) => s.slotId));
      target = 1;                                   // 第 0 槽是自动存档
      while (used.has(target) && target < (sm.maxSlots || 10) - 1) target++;
    }
    return sm.saveToSlot(target, name);
  },
  async load(key) {
    await boot();
    const entered = until('game:entered', { timeoutMs: 600000, failOn: /读档失败|存档损坏|失败/ });
    if (desktop()) await w.desktopLoadSave(key);
    else await w.SaveManager.loadFromSlot(key);
    return entered;
  }
};

// ---------- 动作 ----------
const act = {
  // 奏疏批复：approved 准 / rejected 驳 / annotated 批（附朱批）/ referred 交部议（extra._referredTo 人名）/ court_debate 付廷议 / held 留中。
  // 只改奏疏状态，后果在过回合推演前由内核 _commitMemorialDecisions 落地。
  // 付廷议、留中、交部议走老面板同名函数（它们另有排廷议议题、改留中状态等），批语经接缝参数直接给
  memorial(id, action, reply = '', extra) {
    const m = ((w.GM && w.GM.memorials) || []).find((x) => x && x.id === id);
    if (!m) throw new Error('没有这件奏疏：' + id);
    const need = (name) => {
      if (typeof w[name] !== 'function') throw new Error('内核缺 ' + name);
      return w[name];
    };
    let r;
    if (action === 'court_debate') r = need('_courtDebateMemorial')(id, reply);
    else if (action === 'held') r = need('_holdMemorial')(id, reply);
    else if (action === 'referred') r = need('_doReferMemorial')(id, extra && extra._referredTo, reply);
    else r = need('_stageMemorialDecision')(m, action, reply, extra);
    bus.emit('game:changed', { what: 'memorial', id });
    return r;
  },
  // 时政决断：选第 index 项。异步——开关开着时内核先请 AI 据国势裁定后果（数秒），失败回落固定后果。
  // 返回内核的结果（{ ok:false, code } 表示没办成，例如世局已变、事件不许此选）
  async issue(id, index) {
    if (typeof w._chooseIssueOption !== 'function') throw new Error('内核缺 _chooseIssueOption');
    bus.emit('game:changed', { what: 'issue', id, resolving: true });
    try {
      return await w._chooseIssueOption(id, index);
    } finally {
      bus.emit('game:changed', { what: 'issue', id });
    }
  },
  // 摘入：把页面上划选的奏疏文字摘进诏书建议库（内核读 window.getSelection）
  excerpt(id) {
    if (typeof w._memExcerptToEdict !== 'function') throw new Error('内核缺 _memExcerptToEdict');
    w._memExcerptToEdict(id);
    bus.emit('game:changed', { what: 'edict-suggestion', id });
  },
  // 履职：回应一件公事（官制面板里的「应对」）
  duty(planId, response, opts) {
    const ledger = w.TM && w.TM.NPC && w.TM.NPC.ActionLedger;
    if (!ledger || typeof ledger.playerRespond !== 'function') throw new Error('内核缺 TM.NPC.ActionLedger.playerRespond');
    const r = ledger.playerRespond(planId, response, opts);
    bus.emit('game:changed', { what: 'duty', planId });
    return r;
  }
};

// ---------- 视角 ----------
// 界面按「视角人物」的身份长出来（ui/model/identity.js）。默认是玩家本人。
// 借视角（开发用，?as=人名）：只换界面所见，内核照旧以玩家身份运转；借视角时案上动作一律只读。
let viewAs = null;
function perspective() {
  return select.perspective(viewAs || undefined);
}
function setViewAs(ref) {
  viewAs = ref || null;
  bus.emit('view:changed', perspective());
}

export const game = {
  boot, scenarios, newGame, advance, saves, act, select, config, perspective, setViewAs,
  get viewAs() { return viewAs; },
  on: (name, fn) => bus.on(name, fn),
  once: (name, fn) => bus.once(name, fn),
  get running() { return !!(w.GM && w.GM.running); }
};
