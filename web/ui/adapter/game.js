// 对界面的门面：新前端只经这里读状态、交动作、听变化。
//   await game.boot()                       等内核就绪、装上表现函数的替身
//   game.scenarios()                        剧本目录
//   await game.newGame(sid, opts)           开新局（途中发 game:opening，界面演完调 begin()）
//   await game.advance({ court })           过回合（推演）；进度走 game:advance-progress
//   game.saves.list() / save(name) / load(key)
//   game.select.date() …                    读数快照
//   game.config.saveAi(tier, 草稿) …        典章：AI 连接、体检、玩法开关、音量（adapter/config.js）
//   game.edict.setDraft({ political }) …    诏书草稿、议事清册、私行、润色（adapter/edict.js）；推演前自动写进内核
//   game.letters.contacts() / thread(人) / send({…}) …  书札：远方名册、往来、遣使与信上动作（adapter/letters.js）
//   game.audience.roster() / open(人, 体) / say(话, 语气) …  召对问对（adapter/audience.js）
//   game.offices.departments(廷, 组) / department(路径) / appoint(职, 人) …  官制（adapter/offices.js）
//   game.fiscal.account(库) / census() / loans() …  财计（adapter/fiscal.js）
//   game.court.begin(体) / snapshot() / press(签) …  朝议（adapter/court.js，镜老流程）
//   game.army.roster() / detail(键) / battles() …     军务（adapter/army.js）
//   game.guoshi.detail(吏治|民心|皇权|皇威)          国势四项（adapter/guoshi.js）
//   game.realm.factions() / faction(键)              朝野：势力（adapter/realm.js）
//   game.social.parties() / party / classes / klass  朝野：党派、阶层（adapter/social.js）
//   game.bio.person(名) / sources / note / setNote     列传（adapter/bio.js）
//   game.mizhao.open(诸臣, 议题) / ask / end …         独召密问（adapter/mizhao.js 镜老流程）
//   game.archive.catalog() / annotate / star         史馆：四库旧档（adapter/archive.js）
//   game.wenyuan.works() / stats / act(篇, 动作)       文苑：诗文总集（adapter/wenyuan.js）
//   game.keju.overview() / selectExaminer / answer …  科举：制度、本科各阶段、阅卷放榜（adapter/keju.js）
//   game.keyi.snapshot() / speak / toVote / decide …  科议（adapter/keyi.js 照 KEYI_STATE 读）
//   game.wentian.snapshot() / send / confirm …        问天（adapter/wentian.js，老管线照用）
//   game.gongwei.court() / proposeRank / designate …  宫闱：后妃、尊长、皇嗣、宫苑（adapter/gongwei.js）
//   game.help.topics()                                帮助：内核帮助里与界面无关的几卷（adapter/help.js）
//   game.perspective()                      视角人物（身份、官职、辖区）；game.setViewAs(人) 借视角（开发用）
//   game.act.memorial(id, action, reply)    交动作
//   game.on(事件, fn)                       事件见 kernel.js
import { bus } from '../core/bus.js';
import { waitKernel, installKernelBridge, disableLegacyStyles, setGameSurface } from './kernel.js';
import * as select from './select.js';
import * as config from './config.js';
import * as edict from './edict.js';
import * as letters from './letters.js';
import * as audience from './audience.js';
import * as offices from './offices.js';
import * as fiscal from './fiscal.js';
import * as court from './court.js';
import * as army from './army.js';
import * as guoshi from './guoshi.js';
import * as realm from './realm.js';
import * as social from './social.js';
import * as bio from './bio.js';
import * as mizhao from './mizhao.js';
import * as archive from './archive.js';
import * as wenyuan from './wenyuan.js';
import * as keju from './keju.js';
import * as keyi from './keyi.js';
import * as wentian from './wentian.js';
import * as gongwei from './gongwei.js';
import * as help from './help.js';
import * as gaizhi from './gaizhi.js';
import * as turn from './turn.js';
import * as battle from './battle.js';
import * as prison from './prison.js';
import * as endgame from './endgame.js';

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
  const before = g.turn;
  edict.inject();                                   // 新前端的诏书草稿此刻才写进内核读取处
  try {
    const run = w._endTurnInternal({ postTurnCourt: !!court });
    // 后朝与推演并行：内核在推演前快照之后才起后朝之态（GM._isPostTurnCourt），时长不定——每 200ms 看一次，
    // 起了就让新前端的朝议页接过去（老界面是 200ms 后径开）；推演先了结（出错回滚）就不开
    if (court) {
      let settled = false;
      run.then(() => { settled = true; }, () => { settled = true; });
      const t0 = Date.now();
      const poll = () => {
        if (w.GM && w.GM._isPostTurnCourt) { bus.emit('game:post-turn-court', {}); return; }
        if (!settled && Date.now() - t0 < 60000) setTimeout(poll, 200);
      };
      setTimeout(poll, 200);
    }
    await run;
  } finally {
    if (w.GM && w.GM.turn > before) edict.clearDraft();   // 推进成功即已颁行；没推进（出错回滚）草稿留着
    bus.emit('game:advanced', { turn: w.GM && w.GM.turn });
  }
}

// 离局回启幕：走内核 backToLaunch（作废未完的开局、收拾运行壳），发 game:left 由应用壳切回启幕
async function leave() {
  await boot();
  if (w.GM && w.GM.busy) throw new Error('推演进行中，不能离开');
  if (typeof w.backToLaunch !== 'function') throw new Error('内核缺 backToLaunch');
  const r = w.backToLaunch();
  if (r === false) throw new Error('此刻不能离开');
  bus.emit('game:left', {});
}

// ---------- 存读档 ----------
const desktop = () => !!(w.tianming && w.tianming.isDesktop !== false && typeof w.tianming.listSaves === 'function');
// 案卷目录与老界面同口径（tm-save-manager.js openSaveManager）：TM_SaveDB 的槽位——0 自动、1～9 手存——与已落档的过回合前快照，
// 兼容老的本机索引；桌面端另有按名存的卷宗（tianming.listSaves）与桌面自动存档。卷的键：slot:N、pre、desk:名、deskauto
const saveMeta = (s, key, slot) => ({
  key, slot, name: s.name || '', turn: s.turn, time: s.eraName || s.date || '', scenario: s.scenarioName || '', phase: s.dynastyPhase || '',
  modified: s.timestamp || 0, auto: slot === 0
});
const saves = {
  async list() {
    await boot();
    const out = { slots: [], pre: null, desktop: [], desktopAuto: false };
    const sm = w.SaveManager || {};
    const max = sm.maxSlots || 10;
    const bySlot = {};
    try {
      const rows = w.TM_SaveDB && typeof w.TM_SaveDB.list === 'function' ? await w.TM_SaveDB.list() : [];
      for (const s of rows || []) {
        if (!s) continue;
        if (s.id === 'autosave') bySlot[0] = s;
        else if (/^slot_\d+$/.test(s.id || '')) bySlot[+s.id.slice(5)] = s;
        else if (s.id === 'pre_endturn' && s.commitState === 'committed' && s.snapshotId && s.turn) out.pre = saveMeta(s, 'pre', null);
      }
    } catch (err) {
      console.warn('[newui] 读案卷目录出错，退回本机索引', err);
    }
    const idx = typeof w._getSaveIndex === 'function' ? w._getSaveIndex() || {} : {};
    for (const [k, info] of Object.entries(idx)) { const n = parseInt(String(k).replace('slot_', ''), 10); if (!Number.isNaN(n) && !bySlot[n]) bySlot[n] = info; }
    for (let i = 0; i < max; i++) if (bySlot[i]) out.slots.push(saveMeta(bySlot[i], 'slot:' + i, i));
    if (desktop()) {
      try {
        const r = await w.tianming.listSaves();
        out.desktop = (r && r.success ? r.files : []).filter((f) => f.name !== '__autosave__').map((f) => ({ key: 'desk:' + f.name, name: f.name, turn: f.turn, time: f.time || '', scenario: f.scenario || '', modified: f.modified || 0 }));
      } catch (err) { console.warn('[newui] 读桌面卷宗出错', err); }
      out.desktopAuto = typeof w.desktopLoadAutoSave === 'function' && (typeof w._tmHasNativeFs !== 'function' || w._tmHasNativeFs());
    }
    return out;
  },
  // 封存：给了槽就存那一槽（重新封缄）；不给就取最早的空手存槽，满了覆盖最旧的手存
  async save(name, { slot } = {}) {
    await boot();
    const sm = w.SaveManager;
    if (!sm || typeof sm.saveToSlot !== 'function') throw new Error('内核缺 SaveManager');
    let target = slot;
    if (target == null) {
      const { slots } = await saves.list();
      const max = sm.maxSlots || 10;
      const used = new Map(slots.map((s) => [s.slot, s]));
      target = null;
      for (let i = 1; i < max; i++) if (!used.has(i)) { target = i; break; }
      if (target == null) target = slots.filter((s) => s.slot > 0).sort((a, b) => a.modified - b.modified)[0]?.slot ?? 1;
    }
    return sm.saveToSlot(target, String(name));
  },
  async load(key) {
    await boot();
    const entered = until('game:entered', { timeoutMs: 600000, failOn: /读档失败|存档损坏|失败|校验失败/ });
    const k = String(key);
    if (k.startsWith('slot:')) await w.SaveManager.loadFromSlot(+k.slice(5));
    else if (k === 'pre') {
      const rec = await w.TM_SaveDB.load('pre_endturn');
      const chk = typeof w._validatePreEndturnSnapshot === 'function' ? w._validatePreEndturnSnapshot(rec, null, false) : { ok: false, reason: 'validator-missing' };
      if (!chk.ok) throw new Error(`过回合前快照校验失败（${chk.reason}）`);
      await w.fullLoadGame({ gameState: rec.gameState }, { source: 'pre-endturn' });
      try { localStorage.removeItem('tm_pre_endturn_mark'); } catch (_e) { /* 标记清不掉不碍 */ }
    } else if (k.startsWith('desk:')) await w.desktopLoadSave(k.slice(5));
    else if (k === 'deskauto') await w.desktopLoadAutoSave();
    else await w.SaveManager.loadFromSlot(+k);       // 旧调用：直接给槽号
    return entered;
  },
  async remove(slot) {
    await boot();
    return w.SaveManager.deleteSlot(slot);
  },
  // 抄送副本：导出为本机文件（内核会剥掉 API 密钥）
  exportSlot(slot) {
    return w.SaveManager.exportSave(slot);
  },
  // 调入外卷：把一个存档文件放进某槽
  async importFile(file, slot) {
    await boot();
    return w.SaveManager.importSave(file, slot);
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
  // 侨置：mode 为 none（撤销）、nominal（纯名义）、allocated（划出治所，须给宿主 host）。
  // 内核 doQiaozhi 划治所时从 #qiaozhi-host 下拉取宿主——临时垫一个，用毕撤去
  qiaozhi(name, mode, host) {
    if (typeof w.doQiaozhi !== 'function') throw new Error('内核缺 doQiaozhi');
    let pad = null;
    if (mode === 'allocated') {
      pad = document.createElement('select');
      pad.id = 'qiaozhi-host';
      pad.hidden = true;
      const o = document.createElement('option');
      o.value = String(host || '');
      o.selected = true;
      pad.append(o);
      document.body.append(pad);
    }
    try {
      w.doQiaozhi(name, mode);
    } finally {
      if (pad) pad.remove();
    }
    const done = !((w.GM && w.GM._lostTerritories) || {})[name];
    bus.emit('game:changed', { what: 'qiaozhi', name });
    return done;
  },
  // 时政决断：选第 index 项。异步——开关开着时内核先请 AI 据国势裁定后果（数秒），失败回落固定后果。
  // 返回内核的结果（{ ok:false, code } 表示没办成，例如世局已变、事件不许此选）
  async issue(id, index) {
    if (typeof w._chooseIssueOption !== 'function') throw new Error('内核缺 _chooseIssueOption');
    bus.emit('game:changed', { what: 'issue', id, resolving: true });
    // 内核决断末尾「关闭并重开面板」会摘掉页面上第一个 .modal-bg——新前端下那可能是别处藏在画外、还在用的老弹层；
    // 垫一个空的在最前头让它摘
    const decoy = document.createElement('div');
    decoy.className = 'modal-bg';
    decoy.hidden = true;
    document.body.prepend(decoy);
    try {
      return await w._chooseIssueOption(id, index);
    } finally {
      decoy.remove();
      bus.emit('game:changed', { what: 'issue', id });
    }
  },
  // 摘入：把页面上划选的奏疏文字摘进诏书建议库（内核读 window.getSelection）
  excerpt(id) {
    if (typeof w._memExcerptToEdict !== 'function') throw new Error('内核缺 _memExcerptToEdict');
    w._memExcerptToEdict(id);
    bus.emit('game:changed', { what: 'edict-suggestion', id });
  },
  // 退位：把玩家之位传给 heirId。落位走内核 _confirmAbdication（移交玩家控制、记事、记忆）；
  // 它自带一问 window.confirm，新前端已先问过，这里临时代答「是」
  abdicate(heirId) {
    if (typeof w._confirmAbdication !== 'function') throw new Error('内核缺 _confirmAbdication');
    const ask = w.confirm;
    w.confirm = () => true;
    let ok;
    try { ok = w._confirmAbdication(heirId); } finally { w.confirm = ask; }
    if (ok) bus.emit('game:changed', { what: 'abdicate', heirId });
    return !!ok;
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
  boot, scenarios, newGame, advance, leave, saves, act, select, config, edict, letters, audience, offices, fiscal, court, army, guoshi, realm, social, archive, bio, mizhao, prison, endgame, wenyuan, keju, gaizhi, turn, battle, keyi, wentian, gongwei, help, perspective, setViewAs,
  // 书案显隐时告知内核「是否在局中的案前」（内核的 Esc 暂停、Ctrl+S 案卷等快捷键据此生效）
  setSurface: setGameSurface,
  get viewAs() { return viewAs; },
  on: (name, fn) => bus.on(name, fn),
  once: (name, fn) => bus.once(name, fn),
  get running() { return !!(w.GM && w.GM.running); }
};
