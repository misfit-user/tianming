#!/usr/bin/env node
'use strict';
// Runtime consistency smoke: unified save builder + cross-load write leases + pre_endturn validation + settings persistence.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok - ' + msg); } else { fail++; console.error('  FAIL - ' + msg); } }
function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return '';
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}' && --depth === 0) { j++; break; } }
  return src.slice(a, j);
}

const lifecycle = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');
const render = fs.readFileSync(path.join(ROOT, 'tm-endturn-render.js'), 'utf8');
const pipeline = fs.readFileSync(path.join(ROOT, 'tm-endturn-pipeline-steps.js'), 'utf8');
const manager = fs.readFileSync(path.join(ROOT, 'tm-save-manager.js'), 'utf8');
const storage = fs.readFileSync(path.join(ROOT, 'tm-storage.js'), 'utf8');
const office = fs.readFileSync(path.join(ROOT, 'tm-office-editor.js'), 'utf8');
const patches = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
const playerSettings = fs.readFileSync(path.join(ROOT, 'tm-player-settings.js'), 'utf8');
const utils = fs.readFileSync(path.join(ROOT, 'tm-utils.js'), 'utf8');
const launch = fs.readFileSync(path.join(ROOT, 'tm-launch.js'), 'utf8');
const resume = fs.readFileSync(path.join(ROOT, 'tm-resume-point.js'), 'utf8');
const mainImpl = fs.readFileSync(path.join(ROOT, '..', 'main-impl.js'), 'utf8');
const preloadImpl = fs.readFileSync(path.join(ROOT, '..', 'preload-impl.js'), 'utf8');
const startPatch = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');

console.log('=== 1. unified save snapshot builder ===');
const snapshotSrc = sliceFn(lifecycle, 'function _autoSaveSnapshotGM(');
const builderSrc = sliceFn(lifecycle, 'function _buildSaveState(');
const desktopResultSrc = sliceFn(lifecycle, 'function _tmDesktopAutoSaveResultOk(');
ok(!!snapshotSrc && !!builderSrc, '_autoSaveSnapshotGM + _buildSaveState 可抽取');
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(desktopResultSrc, ctx);
  ok(ctx._tmDesktopAutoSaveResultOk({ success: true }) && ctx._tmDesktopAutoSaveResultOk(true)
    && !ctx._tmDesktopAutoSaveResultOk({ success: false }) && !ctx._tmDesktopAutoSaveResultOk(undefined), 'Electron autoSave 显式区分业务成功与 resolve({success:false})');
}
{
  const ctx = {
    GM: { turn: 8, chars: [{ name: '甲', loyalty: 50 }], qijuHistory: [{ t: 1 }], _aiTelemetry: { huge: true } },
    P: { ai: { key: 'primary-secret', secondary: { key: 'secondary-secret', url: 'x' } }, conf: { a: 1 } },
    deepClone: v => JSON.parse(JSON.stringify(v)),
    _tmStripAiKeyInPlace: p => { if (p.ai) { delete p.ai.key; if (p.ai.secondary) delete p.ai.secondary.key; } return p; },
    _prepareGMForSave() {}, window: {}
  };
  vm.createContext(ctx);
  vm.runInContext(snapshotSrc + '\n' + builderSrc + '\nthis.IDB=_buildSaveState({format:"idb",prepare:false});this.PROJ=_buildSaveState({format:"project",prepare:false});', ctx);
  ok(ctx.IDB.GM.turn === 8 && ctx.IDB.P.conf.a === 1, 'IDB 外壳保持 {GM,P}');
  ok(ctx.PROJ.gameState.turn === 8 && ctx.PROJ.conf.a === 1, 'project 外壳保持 P+gameState');
  ok(!ctx.IDB.P.ai.key && !ctx.IDB.P.ai.secondary.key && !ctx.PROJ.ai.key, '两种外壳均剥离主/次 API key');
  ok(!('_aiTelemetry' in ctx.IDB.GM) && !('_aiTelemetry' in ctx.PROJ.gameState), '两种外壳复用 selective GM snapshot');
}
ok(/saveData2=_buildSaveState\(\{format:'project'\}\)/.test(lifecycle), '浏览器导出走统一纯 builder');
ok(/saveData=_buildSaveState\(\{format:'project'\}\)/.test(lifecycle), '桌面手动存档走统一纯 builder');
ok(/_preState = _buildSaveState\(\{ format: 'idb', gm: _preSaveGM, p: _preSaveP \}\)/.test(core), 'pre_endturn 走统一纯 builder');
ok(/global\._buildSaveState\(\{ format: 'idb', detach: true, gm: GM, p: P \|\| \{\} \}\)/.test(resume), '残局发布以 detached 模式复用统一 builder');
ok(!/gameState\s*=\s*deepClone\(GM\)|GM\s*:\s*deepClone\(GM\)/.test(lifecycle + '\n' + core + '\n' + manager), '生产存档写口无裸 deepClone(GM)');
ok(!/SaveManager\.autoSave\(\)/.test(render), '端回合不再重复调用 SaveManager.autoSave 覆盖 slot_0');
ok(/TM_SaveDB\.save\('autosave',[\s\S]*?if\s*\(ok\s*!==\s*true\)\s*throw[\s\S]*?Promise\.all\(\[_autoWrite, _slotWrite\]\)[\s\S]*?_clearPreEndturnMarkerAfterSave\(_endturnSavePreId\)/.test(render), 'autosave resolve(false) 保留 pre_endturn 恢复标记');
ok(/TM_SaveDB\.save\('slot_0',[\s\S]*?if\s*\(ok\s*!==\s*true\)\s*throw[\s\S]*?Promise\.all\(\[_autoWrite, _slotWrite\]\)[\s\S]*?_updateSaveIndex/.test(render), 'slot_0 resolve(false) 不伪造案卷索引');
{
  const autosaveAt = render.indexOf("TM_SaveDB.save('autosave'");
  const slotAt = render.indexOf("TM_SaveDB.save('slot_0'");
  const writesDoneAt = render.indexOf('var _writeResults = await Promise.all', slotAt);
  const markerAt = render.indexOf("localStorage.setItem('tm_autosave_mark'", autosaveAt);
  ok(markerAt > writesDoneAt && writesDoneAt > slotAt && /turn:\s*_autoMeta\.turn/.test(render.slice(markerAt, markerAt + 300)), 'tm_autosave_mark 仅在两个槽位成功后写入并锚定快照 turn');
}
ok(/_autoSaveResult\s*=\s*await window\.tianming\.autoSave\(saveData\);[\s\S]*?if\s*\(!_tmDesktopAutoSaveResultOk\(_autoSaveResult\)\)\s*throw[\s\S]*?_autoSaveLastDoneMs=Date\.now\(\)/.test(lifecycle), '60s Electron autoSave 仅在业务成功后推进成功时钟');
ok(/_autoSaveLastSavedTurn=\(saveData\._saveMeta[\s\S]*?saveData\._saveMeta\.turn/.test(lifecycle), 'Electron 闲置跳存基线锚定已写快照 turn');
ok(!/window\.tianming\.autoSave\(/.test(render), '端回合删除重复 Electron autoSave·崩溃恢复档只留 60s 写口');
ok(/var _endturnSaveGM = GM;[\s\S]*?var _endturnSaveP = P;[\s\S]*?_endturnSaveLoadGen[\s\S]*?_endturnSavePreId/.test(render), '端回合 detached save 捕获 GM/P/loadGen/pre snapshotId');
ok(/await _awaitPostTurnJobsForSave[\s\S]*?if \(!_endturnSaveStillCurrent\(\)\) return false;[\s\S]*?_buildSaveState\(\{format:'idb',gm:_endturnSaveGM,p:_endturnSaveP\}\)/.test(render), '后台等待后先验租约·builder 在 detached snapshot 上准备');
ok(/TM_SaveDB\.save\('autosave', _autoState, _autoMeta, _autoWriteOptions\)/.test(render)
  && /TM_SaveDB\.save\('slot_0', _autoState, _autoMeta, _autoWriteOptions\)/.test(render), 'autosave/slot_0 写事务共用代际租约');
{
  const renderFn = sliceFn(render, 'function _endTurn_render(');
  const barrierStepAt = pipeline.indexOf("name: 'prepare-commit-barrier'");
  const normalIndicatorAt = pipeline.indexOf('_kjUpdateIndicators(ctx)');
  const deferredOpenersAt = pipeline.indexOf('await _runPostRenderTurnOpeners(ctx)');
  const deferredSaveAt = pipeline.indexOf('_endTurn_saveSnapshot()', deferredOpenersAt);
  ok(!/_endTurn_saveSnapshot\s*\(/.test(renderFn), '_endTurn_render 只渲染·不再在 Phase5 前启动存档');
  ok(barrierStepAt > normalIndicatorAt && normalIndicatorAt >= 0 && /finalSaveRequired\s*=\s*true/.test(pipeline.slice(barrierStepAt)), 'normal 路径在 Phase5/J1 后只声明提交屏障');
  ok(deferredSaveAt > deferredOpenersAt && /await ctx\.meta\.endTurnSavePromise\s*!==\s*true/.test(pipeline.slice(deferredOpenersAt, deferredSaveAt + 500)), 'deferred 路径在 Phase5/openers 后等待存档成功');
  ok(/ctx\.meta\.deferEndTurnSave\s*=\s*true/.test(pipeline) && /if \(ctx\.meta\.deferEndTurnSave\) return true;/.test(core), 'deferred 路径显式阻止 core 提前落库');
  ok(/!ctx\.meta\.endTurnSavePromise && typeof _endTurn_saveSnapshot/.test(core)
    && /!ctx\.meta\.endTurnSavePromise && typeof _endTurn_saveSnapshot/.test(pipeline), 'normal/deferred 两条路径各自复用同一幂等存档 promise');
  ok(/var saved = await ctx\.meta\.endTurnSavePromise;[\s\S]*?saved !== true[\s\S]*?_tmCommitEndTurnTransaction/.test(core), 'normal 提交屏障严格等待最终存档后才 commit');
}
ok(/function save\(id, gameState, meta, options\)[\s\S]*?_writeStillAllowed\(\)[\s\S]*?SaveCompression\.compress[\s\S]*?if \(!_writeStillAllowed\(\)\) return false;[\s\S]*?return _put/.test(storage), 'SaveDB 在压缩前及真正 put 前复验 writeGuard');
ok(/_autoSaveSourceLoadGen[\s\S]*?_autoSaveResult=await window\.tianming\.autoSave\(saveData\);[\s\S]*?写盘完成时已跨档[\s\S]*?return;[\s\S]*?_autoSaveLastDoneMs=Date\.now\(\)/.test(lifecycle), '60s Electron IPC 跨档回包不推进闲置跳存基线');
ok(/let autoSaveWriteQueue = Promise\.resolve\(\);[\s\S]*?const task = autoSaveWriteQueue\.then[\s\S]*?autoSaveWriteQueue = task\.then/.test(mainImpl), '主进程串行化固定 .tmp 的所有 auto-save IPC');
ok(/auto-save-session-rotate/.test(mainImpl) && /autoSaveSessionMatches\(requestToken\)/.test(mainImpl)
  && /writeFile[\s\S]*?autoSaveSessionMatches\(requestToken\)[\s\S]*?rename/.test(mainImpl), 'Electron canonical auto-save 在 write/rename 间按 session token 复验');
ok(/rotateAutoSaveSession/.test(preloadImpl) && /_tmRotateDesktopAutoSaveSession\('full-load'/.test(lifecycle)
  && /_tmRotateDesktopAutoSaveSession\('new-game'/.test(startPatch), 'preload + 读档 + 新局共同切换 auto-save session');
ok(/writeTurnData\([\s\S]*?\.then\(function\(result\)[\s\S]*?result\.success === true[\s\S]*?throw new Error\('回合分卷写入失败'/.test(render), 'writeTurnData resolve({success:false}) 显式报错');

console.log('=== 2. pre_endturn two-phase + strict validator ===');
ok(/commitState:\s*'pending'/.test(core) && /_livePreMark\.commitState = 'committed'/.test(core), 'marker pending -> committed 两阶段');
ok(/snapshotId:\s*_preSnapshotId/.test(core) && /snapshotId: \(meta && meta\.snapshotId\)/.test(storage), 'snapshotId 同时进入 marker/state/IDB record');
ok(/TM_SaveDB\.save\('pre_endturn',[\s\S]*?writeGuard:\s*_preWriteStillCurrent/.test(core)
  && /GM === _preSaveGM && P === _preSaveP[\s\S]*?_preSaveLoadGen[\s\S]*?GM\.turn === _preTurn[\s\S]*?GM\.sid === _preSid[\s\S]*?_preSnapshotId/.test(core),
  'pre_endturn 写事务绑定 GM/P/loadGen/turn/sid/snapshotId lease');
ok(storage.indexOf('jsonStr = JSON.stringify(gameState)') < storage.indexOf('return _ensureOpen().then(function()'), 'SaveDB 在异步 open/gzip 前同步固化 snapshot JSON');
ok(/_validatePreEndturnSnapshot\(record, preInfo, true\)/.test(office), '启动恢复要求 marker 严格校验');
ok(/_tryLoadAutosave\(autoInfo\)/.test(office), '校验/读取失败保留 autosave 安全回退');
{
  const validatorSrc = sliceFn(manager, 'function _validatePreEndturnSnapshot(');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(validatorSrc, ctx);
  const rec = {
    turn: 8, snapshotId: 'snap-8', commitState: 'committed',
    gameState: { GM: { turn: 8 }, P: {}, _preEndturn: { turn: 8, snapshotId: 'snap-8', commitState: 'committed' } }
  };
  const mark = { turn: 8, snapshotId: 'snap-8', commitState: 'committed' };
  ok(ctx._validatePreEndturnSnapshot(rec, mark, true).ok, '完全匹配 committed 三方可恢复');
  ok(!ctx._validatePreEndturnSnapshot(rec, { ...mark, snapshotId: 'old' }, true).ok, 'marker snapshotId 错配拒绝');
  ok(!ctx._validatePreEndturnSnapshot({ ...rec, turn: 7 }, mark, true).ok, 'record turn 错配拒绝');
  ok(!ctx._validatePreEndturnSnapshot(rec, { ...mark, commitState: 'pending' }, true).ok, 'pending marker 拒绝');
}

console.log('=== 3. sSaveAll atomic API persistence ===');
ok(!/function sSaveAll\(\)\{\s*sSaveAPI\(\)/.test(patches), 'sSaveAll 不再提前调用 sSaveAPI 写旧 secondary');
ok(!/tianming\.autoSave\(_tmStripAiKeyView\(P\)\)/.test(patches + '\n' + playerSettings), 'API 单项保存不再以纯 P 覆盖对局中的桌面恢复档');
ok(/function sSaveAPI\(\)[\s\S]*?localStorage\.setItem\("tm_api"[\s\S]*?saveP\(\)/.test(patches), '主 API 单项保存统一 tm_api + saveP');
ok(/function sSaveSecondaryAPI\(\)[\s\S]*?localStorage\.setItem\("tm_api"[\s\S]*?saveP\(\)/.test(patches), '次 API 单项保存统一 tm_api + saveP');
const savePSrc = sliceFn(utils, 'function saveP(');
const saveAndBackSrc = sliceFn(launch, 'function saveAndBack(');
ok(!/tianming\.autoSave\(/.test(savePSrc + '\n' + saveAndBackSrc), 'saveP / 编辑器返回不再以纯 P 覆盖 Electron canonical 恢复档');
ok(/setInterval\(async function\(\)\{[\s\S]*?if\(!GM \|\| !GM\.running\) return;/.test(lifecycle)
  && ((lifecycle + '\n' + utils + '\n' + launch + '\n' + patches + '\n' + playerSettings).match(/tianming\.autoSave\(/g) || []).length === 1,
  'Electron autoSave 生产写口只剩运行局 60s 完整 P+GM 快照');
{
  const applySrc = sliceFn(patches, 'function _sApplyPrimaryApiFields(');
  const allSrc = sliceFn(patches, 'function sSaveAll(');
  const values = {
    's-key': 'new-primary', 's-url': 'https://new-primary/v1', 's-model': 'main', 's-prov': 'openai',
    's-sec-key': 'new-secondary', 's-sec-url': 'https://new-secondary/v1', 's-sec-model': 'fast', 's-sec-prov': 'openai'
  };
  const writes = [];
  const ctx = {
    P: { ai: { secondary: { key: 'old-secondary' } }, conf: {} },
    _$: id => Object.prototype.hasOwnProperty.call(values, id) ? { value: values[id] } : null,
    document: { querySelectorAll: () => [] },
    localStorage: { setItem: (k, v) => writes.push([k, JSON.parse(v)]) },
    saveP() {}, toast() {}, tmApplyInsecureTlsConfig() {},
    console: { warn() {} }, parseInt, parseFloat, isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(applySrc + '\n' + allSrc + '\nsSaveAll();', ctx);
  const apiWrites = writes.filter(w => w[0] === 'tm_api');
  ok(apiWrites.length === 1, '保存全部只原子写 tm_api 一次');
  ok(apiWrites[0][1].key === 'new-primary' && apiWrites[0][1].secondary.key === 'new-secondary', '同一次持久化包含新主 key + 新 secondary key');
}

async function runDynamicLeaseSmokes() {
  console.log('=== 4. dynamic write lease regressions ===');
  {
    const writes = [], order = [];
    const ls = new Map([['tm_pre_endturn_mark', JSON.stringify({ snapshotId: 'pre-9' })]]);
    const ctx = {
      GM: { turn: 9, sid: 's1', phase5Value: 'after', eraName: '某年号' }, P: { marker: 'p1' },
      window: { _tmLoadGen: 2, _tmActivePreEndturnSnapshotId: 'pre-9', TM: { errors: { capture() {}, captureSilent() {} } } },
      TM: { errors: { capture() {}, captureSilent() {} } }, console, Promise, Date, JSON, Math, Error, setTimeout,
      localStorage: { getItem: k => ls.get(k) || null, setItem: (k, v) => ls.set(k, v), removeItem: k => ls.delete(k) },
      _awaitPostTurnJobsForSave: async () => { order.push('jobs'); }, _prepareGMForSave: () => { order.push('prepare'); },
      _buildSaveState: opts => { order.push('snapshot:' + opts.gm.phase5Value); return { GM: { phase5Value: opts.gm.phase5Value }, P: opts.p }; },
      findScenarioById: () => ({ name: '测试剧本' }), getTSText: () => '某日',
      TM_SaveDB: { save: async (id, state) => { writes.push([id, state.GM.phase5Value]); return true; } }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); vm.runInContext(render, ctx);
    order.push('phase5');
    const saved = await ctx._endTurn_saveSnapshot();
    ok(saved === true && order.indexOf('phase5') < order.indexOf('snapshot:after') && writes.length === 2 && writes.every(w => w[1] === 'after'), '真实 save helper 只快照 Phase5 后状态并同时写 autosave/slot_0');
  }
  {
    let src = storage;
    const bootAt = src.lastIndexOf('\nTM_SaveDB.open().then');
    src = src.slice(0, bootAt);
    let allowed = true, writeAttempts = 0, committed = 0, deletes = 0;
    const db = {
      objectStoreNames: { contains: () => true },
      transaction() {
        const tx = {};
        tx.objectStore = () => ({
          put() {
            writeAttempts++;
            if (writeAttempts === 1) setTimeout(() => tx.onerror({ target: { error: { name: 'QuotaExceededError' } } }), 0);
            else { committed++; setTimeout(() => tx.oncomplete(), 0); }
          },
          getAll() {
            const req = {};
            setTimeout(() => { allowed = false; req.result = [{ id: 'older-auto', type: 'auto', timestamp: 1 }]; req.onsuccess(); }, 0);
            return req;
          },
          delete() { deletes++; setTimeout(() => tx.oncomplete(), 0); }
        });
        return tx;
      },
      close() {}
    };
    const indexedDB = { open() { const req = {}; setTimeout(() => req.onsuccess({ target: { result: db } }), 0); return req; }, deleteDatabase() {} };
    const localStorage = { length: 0, setItem() {}, getItem() { return null; }, removeItem() {}, key() { return null; } };
    const ctx = { window: { indexedDB }, indexedDB, localStorage, navigator: { storage: {} }, console, setTimeout, clearTimeout, Promise, Date, JSON, Math, Blob, Response, CompressionStream: undefined, DecompressionStream: undefined };
    Object.assign(ctx.window, { window: ctx.window, localStorage, navigator: ctx.navigator, console });
    vm.createContext(ctx); vm.runInContext(src, ctx);
    await ctx.TM_SaveDB.open();
    const result = await ctx.TM_SaveDB.save('autosave', { GM: { turn: 8 }, P: {} }, { type: 'auto', turn: 8 }, { writeGuard: () => allowed });
    ok(result === false && allowed === false && writeAttempts === 1 && committed === 0 && deletes === 0, 'stale quota recovery neither deletes an older autosave nor retries put');
  }
  {
    const a = core.indexOf('var _preSaveGM = GM;');
    const b = core.indexOf('\n    } else {', a);
    const src = '(async function(){\n' + core.slice(a, b) + '\n})();';
    const store = new Map(), ls = new Map();
    let releaseSave, rawSave;
    const ctx = {
      GM: { running: true, sid: 'old-sid', turn: 8, eraName: 'old', saveName: 'old-save' },
      P: { id: 'old-p' },
      window: { _tmLoadGen: 3, TM: { errors: { capture() {}, captureSilent() {} } } },
      crypto: { randomUUID: () => 'pre-snapshot-old' }, Date, Math, JSON, Error, Promise, console,
      _prepareGMForSave() {},
      _buildSaveState() { return { GM: { turn: 8 }, P: { id: 'old-p' } }; },
      findScenarioById() { return { name: 'old' }; }, getTSText() { return 'T8'; },
      localStorage: { setItem(k, v) { ls.set(k, v); }, getItem(k) { return ls.get(k) || null; } },
      TM_SaveDB: {
        save(id, state, meta, options) {
          rawSave = new Promise(resolve => {
            releaseSave = () => {
              const current = options.writeGuard() === true;
              if (current) store.set(id, state);
              resolve(current);
            };
          });
          return rawSave;
        }
      }
    };
    ctx.window.window = ctx.window;
    vm.createContext(ctx); const preSaveRun = vm.runInContext(src, ctx);
    await Promise.resolve();
    ls.set('tm_pre_endturn_mark', JSON.stringify({ turn: 21, snapshotId: 'pre-snapshot-new', commitState: 'pending' }));
    ctx.window._tmActivePreEndturnSnapshotId = 'pre-snapshot-new';
    ctx.window._tmLoadGen = 4;
    ctx.GM = { running: true, sid: 'new-sid', turn: 21 };
    ctx.P = { id: 'new-p' };
    releaseSave();
    await rawSave;
    let preSaveError = null;
    try { await preSaveRun; } catch (e) { preSaveError = e; }
    const marker = JSON.parse(ls.get('tm_pre_endturn_mark'));
    ok(!!preSaveError && !store.has('pre_endturn') && marker.snapshotId === 'pre-snapshot-new' && marker.commitState === 'pending', 'stale pre_endturn completion fails closed and cannot overwrite the newer record or marker');
  }
  {
    const a = mainImpl.indexOf('const AUTO_SAVE_FILE =');
    const b = mainImpl.indexOf('// --- 系统对话框：导出 ---', a);
    const src = mainImpl.slice(a, b);
    const files = new Map(), handles = {}, syncHandles = {};
    let releaseFirstWrite, firstWriteStarted;
    const firstStarted = new Promise(resolve => { firstWriteStarted = resolve; });
    let delayFirst = true, autoRenames = 0;
    const fakeFs = {
      writeFileSync(file, data) { files.set(file, String(data)); },
      readFileSync(file) { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file); },
      renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
      existsSync(file) { return files.has(file); },
      promises: {
        async writeFile(file, data) {
          if (delayFirst && /__autosave__\.json\.tmp$/.test(file)) {
            delayFirst = false; firstWriteStarted(); await new Promise(resolve => { releaseFirstWrite = resolve; });
          }
          files.set(file, String(data));
        },
        async rename(from, to) { if (/__autosave__\.json$/.test(to)) autoRenames++; files.set(to, files.get(from)); files.delete(from); },
        async unlink(file) { files.delete(file); }
      }
    };
    const ipcMain = { handle(name, fn) { handles[name] = fn; }, on(name, fn) { syncHandles[name] = fn; } };
    const ctx = { ipcMain, fs: fakeFs, path: { join: (...parts) => parts.join('/') }, SAVE_DIR: 'mem', ensureSaveDir() {}, crypto: { randomUUID: () => 'generated-session-token-0001' }, Promise, JSON, String, Error };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const rotate = token => { const event = {}; syncHandles['auto-save-session-rotate'](event, token); return event.returnValue; };
    const current = () => { const event = {}; syncHandles['auto-save-session-current'](event); return event.returnValue; };
    const tokenA = 'session-token-A-00000001', tokenB = 'session-token-B-00000002';
    const oldWrite = handles['auto-save'](null, { __tmAutoSaveEnvelope: 1, sessionToken: tokenA, data: { gameState: { turn: 8 } } });
    await firstStarted;
    ok(current().token === tokenA, 'first wrapped request atomically adopts its token when sidecar is absent');
    ok(rotate(tokenB).success === true, 'full-load/new-game synchronously invalidates an in-flight session');
    releaseFirstWrite();
    const oldResult = await oldWrite;
    ok(oldResult.success === false && oldResult.stale === true && autoRenames === 0, 'invalidated old IPC cannot rename over canonical auto-save');
    const newResult = await handles['auto-save'](null, { __tmAutoSaveEnvelope: 1, sessionToken: tokenB, data: { gameState: { turn: 21 } } });
    const loaded = await handles['load-auto-save']();
    ok(newResult.success === true && autoRenames === 1 && loaded.success === true && loaded.sessionToken === tokenB && loaded.data.gameState.turn === 21, 'current session writes and reloads the canonical envelope');
  }
}

runDynamicLeaseSmokes().then(function() {
  console.log('\n[smoke-runtime-save-consistency] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch(function(err) {
  fail++;
  console.error('  FAIL - dynamic lease smoke crashed:', err && err.stack || err);
  console.log('\n[smoke-runtime-save-consistency] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(1);
});
