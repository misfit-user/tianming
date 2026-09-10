(function(global) {
  'use strict';

  var STORAGE_KEY = 'tm.scenarioEditorReset.formalSandbox.v1';
  var RETURN_STORAGE_KEY = 'tm.scenarioEditorReset.runtimeReturn.v1';
  var RETURN_DB_NAME = 'tm-scenario-editor-reset-projects';
  var RETURN_DB_STORE = 'projectBodies';
  var RETURN_DB_PREFIX = 'runtimeReturn:';
  var SANDBOX_FLAG = '_scenarioEditorSandbox';
  var ROW_KEYS = ['characters', 'factions', 'classes', 'parties', 'items', 'relations', 'families', 'events', 'rigidHistoryEvents', 'timeline'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function query() {
    try {
      return new URLSearchParams(global.location.search || '');
    } catch (_) {
      return { get: function() { return ''; } };
    }
  }

  function returnDbId(id) {
    return RETURN_DB_PREFIX + String(id || 'latest');
  }

  function openReturnDb() {
    return new Promise(function(resolve) {
      if (!global.indexedDB) {
        resolve(null);
        return;
      }
      try {
        var request = global.indexedDB.open(RETURN_DB_NAME, 1);
        request.onupgradeneeded = function(event) {
          var db = event.target.result;
          if (!db.objectStoreNames.contains(RETURN_DB_STORE)) db.createObjectStore(RETURN_DB_STORE, { keyPath: 'id' });
        };
        request.onsuccess = function(event) { resolve(event.target.result); };
        request.onerror = function() { resolve(null); };
      } catch (_) { resolve(null); }
    });
  }

  function getReturnPayloadFromDb(key) {
    return openReturnDb().then(function(db) {
      if (!db) return null;
      return new Promise(function(resolve) {
        try {
          var tx = db.transaction(RETURN_DB_STORE, 'readonly');
          var request = tx.objectStore(RETURN_DB_STORE).get(key);
          request.onsuccess = function() {
            db.close();
            resolve(request.result && request.result.runtimeReturn ? request.result.runtimeReturn : null);
          };
          request.onerror = function() { db.close(); resolve(null); };
        } catch (_) { resolve(null); }
      });
    }).catch(function() { return null; });
  }

  function deleteReturnPayloadFromDb(key) {
    openReturnDb().then(function(db) {
      if (!db) return;
      try {
        var tx = db.transaction(RETURN_DB_STORE, 'readwrite');
        tx.objectStore(RETURN_DB_STORE).delete(key);
        tx.oncomplete = function() { db.close(); };
        tx.onerror = function() { db.close(); };
      } catch (_) {}
    }).catch(function() {});
  }

  function readPayload() {
    var params = query();
    var id = params.get('tmScenarioSandbox');
    if (!id) return null;
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var payload = JSON.parse(raw);
      if (!payload || !payload.scenario) return null;
      if (payload.id && payload.id !== id) return null;
      return payload;
    } catch (err) {
      console.error('[ScenarioSandboxBridge] read failed', err);
      return null;
    }
  }

  function readReturnPayload() {
    var params = query();
    var id = params.get('tmScenarioEditorReturn');
    if (!id) return Promise.resolve(null);
    try {
      var raw = global.localStorage && global.localStorage.getItem(RETURN_STORAGE_KEY);
      if (!raw) return Promise.resolve(null);
      var payload = JSON.parse(raw);
      if (!payload) return Promise.resolve(null);
      if (payload.scenario) {
        if (payload.id && payload.id !== id) return Promise.resolve(null);
        return Promise.resolve(payload);
      }
      if (payload.storage === 'indexedDB' || payload.dbKey) {
        return getReturnPayloadFromDb(payload.dbKey || returnDbId(id)).then(function(dbPayload) {
          if (!dbPayload || !dbPayload.scenario) return null;
          if (dbPayload.id && dbPayload.id !== id) return null;
          return dbPayload;
        });
      }
      return Promise.resolve(null);
    } catch (err) {
      console.error('[ScenarioSandboxBridge] return read failed', err);
      return Promise.resolve(null);
    }
  }

  function ensureP() {
    if (!global.P) global.P = {};
    if (!Array.isArray(global.P.scenarios)) global.P.scenarios = [];
    ROW_KEYS.forEach(function(key) {
      if (!Array.isArray(global.P[key])) global.P[key] = [];
    });
    if (!global.P.conf) global.P.conf = {};
    if (!global.P.ai) global.P.ai = {};
    if (!global.P.time) global.P.time = {};
  }

  function removeSandboxRows() {
    if (!global.P) return false;
    var changed = false;
    if (Array.isArray(global.P.scenarios)) {
      var scenarios = global.P.scenarios.filter(function(row) { return !(row && row[SANDBOX_FLAG]); });
      changed = changed || scenarios.length !== global.P.scenarios.length;
      global.P.scenarios = scenarios;
    }
    ROW_KEYS.forEach(function(key) {
      if (!Array.isArray(global.P[key])) return;
      var rows = global.P[key].filter(function(row) { return !(row && row[SANDBOX_FLAG]); });
      changed = changed || rows.length !== global.P[key].length;
      global.P[key] = rows;
    });
    return changed;
  }

  function normalizeScenario(input, id) {
    var sc = clone(input || {});
    sc.id = id || sc.id || ('scenario-editor-sandbox-' + Date.now().toString(36));
    sc.name = sc.name || '预览沙盒剧本';
    sc.era = sc.era || (sc.gameSettings && sc.gameSettings.eraName) || '';
    sc.role = sc.role || (sc.playerInfo && sc.playerInfo.playerRole) || '沙盒测试';
    sc.background = sc.background || sc.overview || '来自新剧本编辑器的正式运行时沙盒测试。';
    if (!sc.opening || String(sc.opening).length < 80) {
      sc.opening = sc.background + '\n\n当前剧本由新剧本编辑器注入正式游戏沙盒，用于验证开局运行与数据读取。';
    }
    sc.active = true;
    sc[SANDBOX_FLAG] = true;
    ROW_KEYS.forEach(function(key) {
      if (!Array.isArray(sc[key])) return;
      // 与 normalizeRuntimeScenario/installRows 同款：先归一（字符串条目 parse·垃圾丢弃）再赋 sid·防污染草稿炸沙盒启动
      sc[key] = _sanitizeRowEntries(sc[key]).map(function(row) {
        var next = clone(row);
        next.sid = sc.id;
        next[SANDBOX_FLAG] = true;
        return next;
      });
    });
    return sc;
  }

  // 与编辑器侧 jsonCandidateFromText 同款容错：剥 ```json 围栏/截取首尾括号（对象优先于数组）
  function jsonCandidateFromText(text) {
    var trimmed = String(text == null ? '' : text).trim();
    var fenced = trimmed.match(/^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) return fenced[1].trim();
    var firstObject = trimmed.indexOf('{');
    var lastObject = trimmed.lastIndexOf('}');
    var firstArray = trimmed.indexOf('[');
    var lastArray = trimmed.lastIndexOf(']');
    if (firstObject >= 0 && lastObject > firstObject && (firstArray < 0 || firstObject < firstArray)) return trimmed.slice(firstObject, lastObject + 1);
    if (firstArray >= 0 && lastArray > firstArray) return trimmed.slice(firstArray, lastArray + 1);
    return trimmed;
  }

  // 写回/沙盒载荷条目归一：污染草稿数组字段可能混入 JSON 字符串条目（编辑器侧同源 bug），
  // 旧代码 clone(字符串) 后赋 next.sid 同步抛 TypeError 导致整个写回/安装中断。
  // 对象→原样；字符串→走 jsonCandidateFromText 容错后 JSON.parse，parse 出对象→用之；否则丢弃。绝不抛错。
  function _sanitizeRowEntries(arr) {
    var rows = [], repaired = 0, dropped = 0;
    (Array.isArray(arr) ? arr : []).forEach(function(row) {
      if (isObject(row) || Array.isArray(row)) { rows.push(row); return; }
      if (typeof row === 'string') {
        try {
          var parsed = JSON.parse(jsonCandidateFromText(row));
          if (isObject(parsed)) { rows.push(parsed); repaired++; return; }
        } catch (_) {}
      }
      dropped++;
    });
    if (repaired || dropped) {
      console.warn('[ScenarioSandboxBridge] 条目归一：自动修复 ' + repaired + ' 条/跳过 ' + dropped + ' 条');
    }
    return rows;
  }

  function normalizeRuntimeScenario(input, id) {
    var sc = clone(input || {});
    sc.id = id || sc.id || ('scenario-editor-return-' + Date.now().toString(36));
    sc.name = sc.name || '未命名剧本';
    sc.era = sc.era || (sc.gameSettings && sc.gameSettings.eraName) || '';
    sc.role = sc.role || (sc.playerInfo && sc.playerInfo.playerRole) || '';
    sc.background = sc.background || sc.overview || sc.desc || '';
    sc.active = sc.active !== false;
    delete sc[SANDBOX_FLAG];
    ROW_KEYS.forEach(function(key) {
      if (!Array.isArray(sc[key])) return;
      sc[key] = _sanitizeRowEntries(sc[key]).map(function(row) {
        var next = clone(row);
        next.sid = sc.id;
        delete next[SANDBOX_FLAG];
        return next;
      });
    });
    return sc;
  }

  function installRows(key, rows, sid, options) {
    if (!Array.isArray(rows) || !rows.length) return;
    var opts = options || {};
    global.P[key] = (global.P[key] || []).filter(function(row) {
      return row && row.sid !== sid && !row[SANDBOX_FLAG];
    });
    global.P[key] = global.P[key].concat(_sanitizeRowEntries(rows).map(function(row) {
      var next = clone(row);
      next.sid = sid;
      if (opts.sandbox !== false) next[SANDBOX_FLAG] = true;
      else delete next[SANDBOX_FLAG];
      return next;
    }));
  }

  function persistReturnedScenarioToDesktop(sc) {
    if (!sc || !(global.tianming && global.tianming.isDesktop && typeof global.tianming.saveScenario === 'function')) return;
    var filename = sc.name || sc.title || sc.id || 'scenario';
    try {
      var result = global.tianming.saveScenario(filename, sc);
      if (result && typeof result.then === 'function') {
        result.catch(function(err) {
          console.warn('[ScenarioSandboxBridge] desktop scenario save failed', err);
        });
      }
    } catch (err2) {
      console.warn('[ScenarioSandboxBridge] desktop scenario save failed', err2);
    }
  }

  function installSandboxScenario(payload) {
    ensureP();
    removeSandboxRows();
    var sc = normalizeScenario(payload.scenario, payload.id);
    global.P.scenarios.unshift(sc);
    ROW_KEYS.forEach(function(key) {
      installRows(key, sc[key], sc.id);
    });
    try {
      if (typeof global.buildIndices === 'function') global.buildIndices();
    } catch (err) {
      console.warn('[ScenarioSandboxBridge] buildIndices failed', err);
    }
    global.TM_SCENARIO_EDITOR_SANDBOX = {
      id: sc.id,
      scenario: sc,
      payload: payload,
      installedAt: new Date().toISOString(),
      aiPausedForAutostart: false
    };
    return sc;
  }

  function installReturnedScenario(payload, options) {
    var opts = options || {};
    ensureP();
    var sc = normalizeRuntimeScenario(payload.scenario, payload.id || (payload.scenario && payload.scenario.id));
    global.P.scenarios = (global.P.scenarios || []).filter(function(row) {
      return row && row.id !== sc.id && !row[SANDBOX_FLAG];
    });
    global.P.scenarios.unshift(sc);
    ROW_KEYS.forEach(function(key) {
      installRows(key, sc[key], sc.id, { sandbox: false });
    });
    try {
      if (typeof global.buildIndices === 'function') global.buildIndices();
    } catch (err) {
      console.warn('[ScenarioSandboxBridge] return buildIndices failed', err);
    }
    try {
      if (typeof global.saveP === 'function') global.saveP();
    } catch (err2) {
      console.warn('[ScenarioSandboxBridge] return saveP failed', err2);
    }
    persistReturnedScenarioToDesktop(sc);
    global.TM_SCENARIO_EDITOR_RETURN = {
      id: sc.id,
      scenario: sc,
      payload: payload,
      installedAt: new Date().toISOString()
    };
    try {
      if (!opts.silent && typeof global.toast === 'function') global.toast('新版剧本工坊已写回：' + (sc.name || sc.id));
    } catch (_) {}
    return sc;
  }

  function refreshReturnedScenarioView() {
    setTimeout(function() {
      if (typeof global.showScnManage === 'function') global.showScnManage();
      else if (typeof global.showScnSelect === 'function') global.showScnSelect();
    }, 0);
  }

  function clearReturnPayload(payload) {
    var id = payload && payload.id;
    try {
      if (global.localStorage) global.localStorage.removeItem(RETURN_STORAGE_KEY);
    } catch (_) {}
    deleteReturnPayloadFromDb(returnDbId(id));
  }

  function handleReturnedScenario(payload) {
    var settled = false;
    installReturnedScenario(payload);
    refreshReturnedScenarioView();

    function reapplyAfterRestore() {
      if (settled) return;
      installReturnedScenario(payload, { silent: true });
      refreshReturnedScenarioView();
    }

    if (global.addEventListener) global.addEventListener('tm:p-restored', reapplyAfterRestore);
    // 2.5s 兜底重装一次（旧档同步恢复多在此前完成）
    setTimeout(reapplyAfterRestore, 2500);
    // 治竞态：旧档异步恢复（tm:p-restored）可能晚于 2.5s。listener 保留到 60s，
    // 期间每次 restore 都幂等重装，写回结果不再被慢恢复覆盖；之后才摘 listener、清暂存。
    setTimeout(function() {
      settled = true;
      if (global.removeEventListener) global.removeEventListener('tm:p-restored', reapplyAfterRestore);
      clearReturnPayload(payload);
    }, 60000);
  }

  // ── 刀④乙(2026-07-10 国师智能升级A·owner 拍板)：快测·首回合真跑 ─────────────
  //   带 key 启动沙盒 → 等 boot 安定 → _endTurnInternal 真跑一回合(真 AI 推演·烧玩家 key·故只由玩家显式按钮触发) →
  //   报告(boot/回合统计+错误清单)写回编辑器同一 IndexedDB·国师 readQuickTestReport 工具读取。
  // ── 扩建(2026-07-16 刀A/B·playtest 前一键体检)：默认连跑 3 回合(同一局·世界连续·非三局各跑一回合)·
  //   每回合结束跑四类确定性体检(死人任职/幽灵键/账面守恒/叙事错名·全部「调既有校验器取结果」不新造检测)·
  //   逐回合累积进报告·末尾给总判(绿/黄/红 + 异常清单带回合号与原句/原账摘录)·
  //   单回合抛错记录后继续跑后续·超时则安全中止后续(防 _endTurnInternal 异步与下一回合争抢)·
  //   格式向后兼容(schema:2·仍保留旧 turn/turnOk/turnRan 字段·新增字段不删旧字段)。
  var QUICKTEST_DB_ID = 'quickTestReport:latest';
  function writeQuickTestReport(report) {
    return openReturnDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(RETURN_DB_STORE, 'readwrite');
          tx.objectStore(RETURN_DB_STORE).put({ id: QUICKTEST_DB_ID, quickTest: report });
          tx.oncomplete = function () { db.close(); resolve(true); };
          tx.onerror = function () { db.close(); resolve(false); };
        } catch (_) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  // 四类确定性体检·全部「调既有校验器取结果」·不新造检测逻辑：
  //   死人任职 + 幽灵键 ← TM.invariants.check()（tm-invariants.js·GM 结构快照·随叫随跑）
  //   账面守恒        ← GM._fiscalValidatorLog（tm-ai-change-applier-validators.js:_validateFiscalConsistency 回合内产出）
  //   叙事错名        ← GM._personnelValidatorLog（同上:_validatePersonnelConsistency 回合内产出）
  //   logBaseline={fiscal,narrative}=本回合开跑前各 log 长度·slice(baseline)=只归本回合新增·确定性归因。
  function quickTestHealthChecks(logBaseline) {
    var GM = global.GM || {};
    var out = { deadOffice: null, ghostKey: null, fiscal: null, narrative: null };
    // ① 死人任职 + ② 幽灵键：一次 TM.invariants.check() 取两面
    try {
      if (global.TM && global.TM.invariants && typeof global.TM.invariants.check === 'function') {
        var inv = global.TM.invariants.check();
        var res = inv.results || {};
        var chd = (res.chars && res.chars.details) || {};
        var otd = (res.officeTree && res.officeTree.details) || {};
        var fcd = (res.factions && res.factions.details) || {};
        var deadViol = [];
        ((res.chars && res.chars.violations) || []).forEach(function (v) { if (/占职/.test(v)) deadViol.push(v); });
        ((res.officeTree && res.officeTree.violations) || []).forEach(function (v) { if (/死亡/.test(v)) deadViol.push(v); });
        out.deadOffice = { count: (chd.deadButBusy || 0) + (otd.deadHolders || 0), charsDeadButBusy: chd.deadButBusy || 0, officeDeadHolders: otd.deadHolders || 0, violations: deadViol };
        var ghostViol = [];
        ((res.officeTree && res.officeTree.violations) || []).forEach(function (v) { if (/不存在/.test(v)) ghostViol.push(v); });
        ((res.factions && res.factions.violations) || []).forEach(function (v) { ghostViol.push(v); });
        out.ghostKey = { count: (otd.phantomHolders || 0) + (fcd.orphanFacRefs || 0), phantomHolders: otd.phantomHolders || 0, orphanFacRefs: fcd.orphanFacRefs || 0, violations: ghostViol };
      } else {
        out.deadOffice = { count: 0, unavailable: 'TM.invariants 未加载' };
        out.ghostKey = { count: 0, unavailable: 'TM.invariants 未加载' };
      }
    } catch (e) {
      var em = String((e && e.message) || e);
      out.deadOffice = { count: 0, error: em }; out.ghostKey = { count: 0, error: em };
    }
    // ③ 账面守恒：本回合新增的 _fiscalValidatorLog（叙事金额↔fiscal_adjustments 脱节告警）
    try {
      var fNew = (GM._fiscalValidatorLog || []).slice((logBaseline && logBaseline.fiscal) || 0);
      var fWarns = [], fSamples = [];
      fNew.forEach(function (entry) {
        (entry.warnings || []).forEach(function (w) { fWarns.push(w); });
        (entry.samples || []).forEach(function (s) { if (fSamples.length < 5 && s && s.raw) fSamples.push(s.raw); });
      });
      out.fiscal = { count: fWarns.length, warnings: fWarns.slice(0, 8), samples: fSamples };
    } catch (e2) { out.fiscal = { count: 0, error: String((e2 && e2.message) || e2) }; }
    // ④ 叙事错名：本回合新增的 _personnelValidatorLog.missing（叙事提及死亡/去职但 AI 未结构化上报）
    try {
      var pNew = (GM._personnelValidatorLog || []).slice((logBaseline && logBaseline.narrative) || 0);
      var miss = [], patched = 0, skipped = 0;
      pNew.forEach(function (entry) {
        (entry.missing || []).forEach(function (m) { miss.push({ name: m.name, verb: m.verb || m.action || '', raw: String(m.raw || '').slice(0, 120) }); });
        patched += (entry.patched || 0);
        skipped += (entry.skipped || []).length;
      });
      out.narrative = { count: miss.length, missing: miss.slice(0, 8), patched: patched, skipped: skipped };
    } catch (e3) { out.narrative = { count: 0, error: String((e3 && e3.message) || e3) }; }
    return out;
  }

  // 总判：结构性损坏(死人任职/幽灵键/回合抛错/未推进/启动失败)=红；
  //       内容脱节(账面守恒/叙事错名·校验器已自动补录·属内容质量告警)或运行时错误=黄；全清=绿。
  function quickTestVerdict(report) {
    var anomalies = [], red = false, yellow = false;
    if (!report.bootOk) { red = true; anomalies.push({ category: 'boot', turn: 0, detail: '启动失败·GM 未就绪' }); }
    (report.turns || []).forEach(function (t) {
      if (t.skipped) { yellow = true; anomalies.push({ category: 'turn-skipped', turn: t.n, detail: t.reason || '回合被跳过' }); return; }
      if (t.threw) { red = true; anomalies.push({ category: 'turn-error', turn: t.n, detail: t.error || '回合抛错' }); }
      else if (!t.ok) { red = true; anomalies.push({ category: 'turn-stall', turn: t.n, detail: '回合数未推进·疑中途失败' }); }
      var h = t.health || {};
      if (h.deadOffice && h.deadOffice.count > 0) { red = true; anomalies.push({ category: 'dead-office', turn: t.n, detail: h.deadOffice.count + ' 例死人占职', excerpt: (h.deadOffice.violations || []).join('；') }); }
      if (h.ghostKey && h.ghostKey.count > 0) { red = true; anomalies.push({ category: 'ghost-key', turn: t.n, detail: h.ghostKey.count + ' 例幽灵引用', excerpt: (h.ghostKey.violations || []).join('；') }); }
      if (h.fiscal && h.fiscal.count > 0) { yellow = true; anomalies.push({ category: 'fiscal-drift', turn: t.n, detail: h.fiscal.count + ' 项账面脱节(叙事金额↔fiscal_adjustments)', excerpt: (h.fiscal.samples || []).join(' / ') }); }
      if (h.narrative && h.narrative.count > 0) { yellow = true; anomalies.push({ category: 'narrative-name', turn: t.n, detail: h.narrative.count + ' 例叙事错名(提及死亡/去职未结构化)', excerpt: (h.narrative.missing || []).map(function (m) { return m.name + '·' + m.raw; }).join(' / ') }); }
    });
    if (report.errors && report.errors.length) { if (!red) yellow = true; anomalies.push({ category: 'runtime-error', turn: null, detail: report.errors.length + ' 条运行时错误', excerpt: report.errors.slice(0, 3).join(' / ') }); }
    var level = red ? 'red' : (yellow ? 'yellow' : 'green');
    var summary;
    if (!report.bootOk) summary = '启动未通过·无法体检';
    else if (report.turnsRan === 0) summary = '仅验启动(回合未跑' + (report.note ? '·' + report.note : '') + ')';
    else summary = report.turnsRan + '/' + report.turnsRequested + ' 回合跑通·' + (level === 'green' ? '四类体检全清' : (level === 'red' ? ('发现结构性异常 ' + anomalies.filter(function (a) { return ['dead-office', 'ghost-key', 'turn-error', 'turn-stall', 'boot'].indexOf(a.category) >= 0; }).length + ' 项') : ('内容告警 ' + anomalies.length + ' 项(校验器已自动补录)')));
    return { level: level, summary: summary, anomalies: anomalies };
  }

  function runQuickTestFirstTurn(sc, opts) {
    opts = opts || {};
    // 必须在开局规范化/回合推进前冻结原始测试输入；旧报告没有此字段则只能作历史参考。
    var sourceFingerprint = global.TM && global.TM.AgentKernel && global.TM.AgentKernel.fingerprintScenario
      ? global.TM.AgentKernel.fingerprintScenario(sc).catch(function(){return null;}) : Promise.resolve(null);
    var turnsWanted = Math.max(1, Math.min(10, parseInt(opts.turns, 10) || 3));
    var perTurnTimeoutMs = opts.perTurnTimeoutMs != null ? opts.perTurnTimeoutMs : 90000;
    var bootWaitMs = opts.bootWaitMs != null ? opts.bootWaitMs : 2000;
    var report = {
      id: 'quicktest-' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      scenarioId: sc.id, scenarioName: sc.name || '',
      phase: 'boot', bootOk: false, turnRan: false, turnOk: false,
      errors: [], boot: null, turn: null, note: '',
      // ── 多回合体检扩展(2026-07-16·向后兼容) ──
      schema: 2, turnsRequested: turnsWanted, turnsRan: 0, aiTier: 'primary',
      turns: [], verdict: null
    };
    function errCap(msg) { if (report.errors.length < 20) report.errors.push(String(msg == null ? '?' : msg).slice(0, 300)); }
    function onWinErr(ev) { errCap((ev && (ev.message || (ev.reason && (ev.reason.message || ev.reason)))) || ev); }
    if (global.addEventListener) { global.addEventListener('error', onWinErr); global.addEventListener('unhandledrejection', onWinErr); }
    function gmStats() {
      var GM = global.GM || {};
      return {
        turn: GM.turn || 0,
        chars: (GM.chars || []).length,
        facs: (GM.facs || []).length,
        guoku: GM.guoku ? GM.guoku.money : null,
        minxin: (GM.minxin && GM.minxin.trueIndex != null) ? Math.round(GM.minxin.trueIndex) : null,
        huangwei: GM.huangwei ? GM.huangwei.index : null,
        huangquan: GM.huangquan ? GM.huangquan.index : null
      };
    }
    // 刀C·快档路由：次要 API(快模型)配置完整且启用时·快测全程临时把 P.ai 指向 secondary——
    //   整条回合推演链(主推演+全部子调用·无论内部 tier 传参)统一走快档·省玩家主 quota。
    //   手法沿用本文件 startWithPausedAi 先例(临时改 P.ai·跑完必还原)·不碰 endturn 引擎本体。
    //   key 真源在 localStorage('tm_api')·此处只动内存态·还原后不 saveP(避免快档配置被持久化)。
    var _origAi = null;
    function engageFastTier() {
      try {
        if (typeof global._useSecondaryTier !== 'function' || !global._useSecondaryTier()) return false;
        var sec = global.P && global.P.ai && global.P.ai.secondary;
        if (!sec || !sec.key || !sec.url) return false;
        _origAi = { key: global.P.ai.key, url: global.P.ai.url, model: global.P.ai.model };
        global.P.ai.key = sec.key;
        global.P.ai.url = sec.url;
        if (sec.model) global.P.ai.model = sec.model;
        report.aiTier = 'secondary';
        return true;
      } catch (_) { return false; }
    }
    function restoreAiTier() {
      if (!_origAi) return;
      try {
        if (global.P && global.P.ai) {
          global.P.ai.key = _origAi.key;
          global.P.ai.url = _origAi.url;
          global.P.ai.model = _origAi.model;
        }
      } catch (_) {}
      _origAi = null;
    }
    function freezeTimedOutState(root) {
      // 超时后专用：冻结这扇正式沙盒窗口的世界对象，使已经捕获 GM/子对象引用的晚到任务也无法继续落账。
      if (!root || typeof root !== 'object') return;
      var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : [];
      var stack = [root];
      while (stack.length) {
        var cur = stack.pop();
        if (!cur || typeof cur !== 'object') continue;
        if (seen instanceof Array) {
          if (seen.indexOf(cur) >= 0) continue;
          seen.push(cur);
        } else {
          if (seen.has(cur)) continue;
          seen.add(cur);
        }
        try {
          Object.keys(cur).forEach(function(k) {
            var child;
            try { child = cur[k]; } catch (_) { child = null; }
            if (child && typeof child === 'object') stack.push(child);
          });
          Object.freeze(cur);
        } catch (_) {}
      }
    }
    function quarantineTimedOutRun() {
      report._teardownRequired = true;
      freezeTimedOutState(global.GM);
      // 绝不在晚到 _endTurnInternal 仍存活时恢复主 key。关闭失败的降级态也只保留空凭据。
      try {
        if (global.P && global.P.ai) {
          global.P.ai.key = '';
          global.P.ai.url = '';
          global.P.ai.model = '';
          if (global.P.ai.secondary) {
            global.P.ai.secondary.key = '';
            global.P.ai.secondary.url = '';
            global.P.ai.secondary.model = '';
          }
        }
      } catch (_) {}
      freezeTimedOutState(global.P);
      _origAi = null;
    }
    function teardownTimedOutSandbox() {
      report.teardown = 'window-close';
      try { if (typeof global.stop === 'function') global.stop(); } catch (_) {}
      try { if (typeof global.close === 'function') global.close(); } catch (_) {}
    }
    function finish(phaseNote) {
      if (!report._teardownRequired) restoreAiTier();
      else report.teardown = 'window-close';
      if (phaseNote) report.note = report.note ? (report.note + '；' + phaseNote) : phaseNote;
      if (global.removeEventListener) { global.removeEventListener('error', onWinErr); global.removeEventListener('unhandledrejection', onWinErr); }
      report.verdict = quickTestVerdict(report);
      return sourceFingerprint.then(function(fp){report.sourceFingerprint=fp;return writeQuickTestReport(report);}).then(function (ok) {
        try {
          if (typeof global.toast === 'function') {
            var v = report.verdict || {};
            var badge = v.level === 'green' ? '绿·健康' : (v.level === 'yellow' ? '黄·内容告警' : '红·须修');
            global.toast(ok ? ('快测报告已写回工坊[' + badge + ']：' + (v.summary || '')) : '快测报告写回失败(IndexedDB 不可用)');
          }
        } catch (_) {}
        if (report._teardownRequired) teardownTimedOutSandbox();
      });
    }
    // 单回合真跑：捕获同步/异步抛错(记录后不中断后续)·超时中止后续(防异步争抢)·跑完做四类体检。
    function runOneTurn(n) {
      if (report._aborted) { report.turns.push({ n: n, ok: false, skipped: true, reason: report._abortReason || '前序中断' }); return Promise.resolve(); }
      var t1 = Date.now();
      var GM = global.GM || {};
      var fBase = (GM._fiscalValidatorLog || []).length;
      var pBase = (GM._personnelValidatorLog || []).length;
      var prevTurn = GM.turn || 0;
      var rec = { n: n, ok: false, threw: false, ms: 0, error: '', turnBefore: prevTurn, stats: null, health: null };
      if (GM.busy) { rec.threw = true; rec.error = 'GM.busy·回合未跑'; errCap('回合 ' + n + ' 未跑: GM.busy'); rec.ms = 0; rec.stats = gmStats(); report.turns.push(rec); return Promise.resolve(); }
      var turnP;
      try { turnP = Promise.resolve(global._endTurnInternal()); }
      catch (eSync) {
        rec.threw = true; rec.error = '同步抛错: ' + ((eSync && eSync.message) || eSync); errCap('回合 ' + n + ' ' + rec.error);
        rec.ms = Date.now() - t1; rec.stats = gmStats(); rec.health = quickTestHealthChecks({ fiscal: fBase, narrative: pBase });
        report.turnsRan++; report.turnRan = true; report.turn = { ms: rec.ms, stats: rec.stats }; if (n === 1) report.turnOk = false;
        report.turns.push(rec); return Promise.resolve();
      }
      var timeoutP = new Promise(function (res) { setTimeout(function () { res('__timeout__'); }, perTurnTimeoutMs); });
      var racedP = turnP.then(function () { return '__ok__'; }).catch(function (eT) { rec.threw = true; rec.error = '回合异常: ' + ((eT && eT.message) || eT); errCap('回合 ' + n + ' ' + rec.error); return '__err__'; });
      return Promise.race([racedP, timeoutP]).then(function (outcome) {
        rec.ms = Date.now() - t1;
        if (outcome === '__timeout__') {
          rec.threw = true; rec.error = '回合超时(' + perTurnTimeoutMs + 'ms)'; errCap('回合 ' + n + ' 超时');
          report._aborted = true; report._abortReason = '回合 ' + n + ' 超时·冻结状态并销毁沙盒';
          quarantineTimedOutRun();
        }
        rec.stats = gmStats();
        rec.ok = !rec.threw && (rec.stats.turn > prevTurn);
        rec.health = quickTestHealthChecks({ fiscal: fBase, narrative: pBase });
        report.turnsRan++;
        report.turnRan = true;
        report.turn = { ms: rec.ms, stats: rec.stats };   // 旧字段：turn=最后一回合(向后兼容)
        if (n === 1) report.turnOk = rec.ok;               // 旧语义 turnOk=首回合是否跑通
        report.turns.push(rec);
      });
    }
    var t0 = Date.now();
    return Promise.resolve()
      .then(function () { engageFastTier(); return global.startGame(sc.id); })   // 快档在 startGame 前接管·boot 期 AI 调用亦走快档
      .then(function () { return new Promise(function (r) { setTimeout(r, bootWaitMs); }); })   // 等 boot 渲染/异步装载安定
      .then(function () {
        report.bootOk = !!(global.GM && Array.isArray(global.GM.chars));
        report.boot = { ms: Date.now() - t0, stats: gmStats() };
        report.phase = 'turn';
        if (!(global.P && global.P.ai && global.P.ai.key && String(global.P.ai.key).trim())) return finish('未配 API 密钥·只验启动·回合推演未跑');
        if (typeof global._endTurnInternal !== 'function') return finish('运行时无 _endTurnInternal·回合未跑');
        // 顺序连跑 N 回合(同一局·世界连续)
        var chain = Promise.resolve();
        for (var i = 1; i <= turnsWanted; i++) { (function (n) { chain = chain.then(function () { return runOneTurn(n); }); })(i); }
        return chain.then(function () {
          report.phase = 'done';
          var advanced = report.turns.filter(function (t) { return t.ok; }).length;
          return finish(advanced === turnsWanted ? '' : (advanced + '/' + turnsWanted + ' 回合推进·余者失败或中止'));
        });
      })
      .catch(function (eB) { errCap('启动异常: ' + ((eB && eB.message) || eB)); return finish('startGame 抛错'); });
  }

  // 快测能力对外句柄(程序化触发 + smoke 可测·运行器/校验器包装器本在闭包内不可达)。
  //   console 一键入口(刀C)：TM_SCENARIO_QUICKTEST.runById('剧本id', { turns: 3 })——
  //   对 P.scenarios 里任一已装剧本跑体检·与编辑器工作台按钮同一运行器·报告同写 quickTestReport:latest。
  function runQuickTestById(id, opts) {
    var sc = (global.P && Array.isArray(global.P.scenarios)) ? global.P.scenarios.find(function (s) { return s && s.id === id; }) : null;
    if (!sc) { console.warn('[快测] 剧本不存在: ' + id + '（P.scenarios 未找到）'); return Promise.resolve(null); }
    console.log('[快测] 开始一键体检: ' + (sc.name || sc.id) + '·' + ((opts && opts.turns) || 3) + ' 回合·报告写 IndexedDB quickTestReport:latest');
    return runQuickTestFirstTurn(sc, opts);
  }
  global.TM_SCENARIO_QUICKTEST = {
    run: runQuickTestFirstTurn,
    runById: runQuickTestById,
    healthChecks: quickTestHealthChecks,
    verdict: quickTestVerdict,
    DB_ID: QUICKTEST_DB_ID
  };

  function startWithPausedAi(sc) {
    if (!sc || typeof global.startGame !== 'function') return false;
    var originalKey = global.P && global.P.ai ? global.P.ai.key : '';
    var hadKey = !!originalKey;
    if (hadKey) {
      global.P.ai.key = '';
      global.TM_SCENARIO_EDITOR_SANDBOX.aiPausedForAutostart = true;
    }
    try {
      var result = global.startGame(sc.id);
      Promise.resolve(result).finally(function() {
        if (hadKey && global.P && global.P.ai) {
          global.P.ai.key = originalKey;
          try {
            if (typeof global.saveP === 'function') global.saveP();
          } catch (_) {}
        }
      });
      return true;
    } catch (err) {
      if (hadKey && global.P && global.P.ai) global.P.ai.key = originalKey;
      console.error('[ScenarioSandboxBridge] autostart failed', err);
      return false;
    }
  }

  function boot() {
    ensureP();
    readReturnPayload().then(function(returned) {
      if (returned) {
        handleReturnedScenario(returned);
        return;
      }
      var payload = readPayload();
      if (!payload) {
        if (removeSandboxRows()) {
          try {
            if (typeof global.buildIndices === 'function') global.buildIndices();
            if (typeof global.saveP === 'function') global.saveP();
          } catch (_) {}
        }
        return;
      }
      var sc = installSandboxScenario(payload);
      var params = query();
      if (params.get('tmScenarioQuickTest') === '1') {
        // 刀④乙：快测·一键体检（带 key·玩家显式触发·报告写回工坊）·turns 可经 URL 调(默认 3)
        var qtTurns = parseInt(params.get('tmScenarioQuickTestTurns'), 10);
        setTimeout(function() { runQuickTestFirstTurn(sc, qtTurns > 0 ? { turns: qtTurns } : undefined); }, 0);
      } else if (params.get('tmScenarioAutoStart') === '1') {
        setTimeout(function() { startWithPausedAi(sc); }, 0);
      } else if (typeof global.showScnSelect === 'function') {
        setTimeout(function() { global.showScnSelect(); }, 0);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})(window);
