// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-scandal.js
 * 科举·Phase J·Slice J4·科场弊案 (跨朝代通用)
 *
 * 命题·科场舞弊——请托关节 / 漏泄考题 / 枪替冒名 / 阿私取士——被检举
 *      → 常朝议政 (查办 / 罢免 / 庇护) → 罢黜·削籍·流放 后果。
 *      隋唐至明清通用·引擎不含任何朝代专属机构。
 *
 * ★ 跨朝代通用红线 (见 memory tianming-engine-cross-dynasty)·
 *   - 触发只用通用量·当前考试 examinerView / 党争 GM._factionTension / 吏治 corruption
 *   - 「特务/监察机构干预阅卷」是朝代特例·不进引擎·改剧本声明的中立 hook：
 *     P.keju.scandalOversight = { label:'<剧本填·该朝监察机构名>', biasWeight, triggerCorruption }
 *     引擎只认 P.keju.scandalOversight 这个中立字段·机构专名一律由剧本数据提供。
 *
 * red line (沿 G1/F 系列)·
 *   - flag gate·P.conf.useNewKejuScandal 默认 off (undefined→off·显式 true 才开)
 *   - 不发 modal·不发邸报·走 _cc2_collectAgendaSources source pool (常朝)
 *   - 触发自然政治·禁玄幻
 *
 * 章节 (grep 跳转·行号会漂)·
 *   §1 配置 + flag + 取值 helper
 *   §2 init namespace
 *   §3 触发检测 (endTurn)
 *   §4 spawn + 消费队列 (常朝 source)
 *   §5 议政回调 _kjScandalKeyiCallback (三路径)
 *   §6 后果应用 (惩处·复用标准状态字段)
 *   §7 暴露
 *
 * 集成点·
 *   - endTurn·tm-endturn-pipeline-steps.js (跟 G1 _kjCheckSpecialExamTriggers 同位)
 *   - source pool·tm-chaoyi.js _cc2_collectAgendaSources (跟 G1 _kjConsumeSpecialExamForAgenda 同位)
 *   - init·tm-keju-runtime.js initKejuSystem 尾部
 *   - keyi 路由·tm-keju-topic-router.js scandal 议题 (callback 名 _kjScandalKeyiCallback)
 *
 * Public API·
 *   _kjInitScandalState()                  — init GM.keju._scandal (幂等)
 *   _kjCheckScandalTriggers()              — endTurn 调·检测·spawn
 *   _kjConsumeScandalForAgenda()           — 常朝 source 消费 (MAX 1)
 *   _kjSpawnScandal(type, reason, detail)  — 手动 spawn
 *   _kjScandalKeyiCallback(method, ctx)    — 议政表决通过·三路径处置
 */
(function() {
  'use strict';

  // §1 ───────────── 配置 + flag + 取值 helper ─────────────
  var COOLDOWN_YEARS = 4;          // 弊案 cooldown·避免连年弊案
  var MAX_CONSUME_PER_AGENDA = 1;

  // 通用触发阈值 (剧本可覆盖 P.keju.scandalThreshold)·3 因子任 2 命中即触发
  var DEFAULT_THRESH = { corruption: 50, tension: 8, factionBias: 0.6 };

  // 四类弊案·跨朝代通用 (无朝代专名)
  var SCANDAL_TYPES = {
    bribery:       { label: '请托关节', blurb: '举子赂买主考·暗通关节' },
    leak:          { label: '漏泄考题', blurb: '考题预泄·有司鬻题' },
    impersonation: { label: '枪替冒名', blurb: '倩人代试·冒籍顶名' },
    favoritism:    { label: '阿私取士', blurb: '主考徇其所好·黜陟不公' }
  };

  function _scEnabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuScandal !== false; // 默认开启，依附正式考试且保留显式关闭。
  }

  function _scGM() { return (typeof GM !== 'undefined' && GM) ? GM : null; }

  function _scFiniteNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function _scCaptureError(error, label) {
    if (typeof TM !== 'undefined' && TM && TM.errors && typeof TM.errors.capture === 'function') {
      TM.errors.capture(error, label);
      return;
    }
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      console.warn('[科举·弊案] ' + label, error);
    }
  }

  function _getCurYear() {
    var g = _scGM();
    if (!g) return 0;
    return g.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  function _scThresh() {
    var t = {
      corruption: DEFAULT_THRESH.corruption,
      tension: DEFAULT_THRESH.tension,
      factionBias: DEFAULT_THRESH.factionBias
    };
    var ov = (typeof P !== 'undefined' && P && P.keju && P.keju.scandalThreshold) || null;
    if (ov) {
      if (typeof ov.corruption === 'number') t.corruption = ov.corruption;
      if (typeof ov.tension === 'number') t.tension = ov.tension;
      if (typeof ov.factionBias === 'number') t.factionBias = ov.factionBias;
    }
    return t;
  }

  // 吏治腐败·多源防御取值 (不假设单一路径·取不到降级 0)
  function _scGetCorruption() {
    var g = _scGM(); if (!g) return 0;
    if (typeof g.corruption === 'number') return g.corruption;
    if (g.corruption && typeof g.corruption === 'object') {
      var fields = ['trueIndex', 'overall', 'index'];
      for (var i = 0; i < fields.length; i++) {
        var value = g.corruption[fields[i]];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
    }
    if (g.vars && g.vars['吏治'] && typeof g.vars['吏治'].value === 'number') return g.vars['吏治'].value;
    if (g.keju && typeof g.keju.corruption === 'number') return g.keju.corruption;
    return 0;
  }

  function _scGetTension() {
    var g = _scGM(); if (!g) return 0;
    if (typeof _kjCalcTotalPartyTension === 'function') {
      try {
        var calculated = _kjCalcTotalPartyTension();
        if (Number.isFinite(calculated)) return calculated;
      } catch (error) {
        _scCaptureError(error, '读取党争总张力失败');
      }
    }
    if (g._factionTension && typeof g._factionTension === 'object') {
      var keys = Object.keys(g._factionTension);
      var total = 0;
      var hasFinite = false;
      keys.forEach(function(key) {
        var value = Number(g._factionTension[key]);
        if (!Number.isFinite(value)) return;
        total += value;
        hasFinite = true;
      });
      if (hasFinite) return total;
    }
    return (g.keju && Number.isFinite(g.keju.tension)) ? g.keju.tension : 0;
  }

  function _scFindCharacterById(id) {
    var g = _scGM();
    if (!g || !Array.isArray(g.chars) || id === undefined || id === null || String(id).trim() === '') return null;
    var wanted = String(id);
    return g.chars.find(function(character) {
      return character && character.id !== undefined && character.id !== null && String(character.id) === wanted;
    }) || null;
  }

  function _scFindCharactersByName(name) {
    var g = _scGM();
    if (!g || !Array.isArray(g.chars) || !name) return [];
    return g.chars.filter(function(character) {
      return character && character.name === name;
    });
  }

  /** 正式考试状态唯一解析入口；仅为旧档缺 ID 时按姓名迁移一次。 */
  function resolveScandalExamContext() {
    var p = (typeof P !== 'undefined' && P) ? P : null;
    var exam = p && p.keju && p.keju.currentExam;
    var stage = exam && typeof exam.stage === 'string' ? exam.stage : 'idle';
    var examiner = null;
    var examinerId = exam && exam.chiefExaminerId != null ? String(exam.chiefExaminerId).trim() : '';
    var examinerName = exam && exam.chiefExaminer ? String(exam.chiefExaminer) : '';

    if (examinerId) {
      examiner = _scFindCharacterById(examinerId);
    } else if (examinerName) {
      var nameMatches = _scFindCharactersByName(examinerName);
      if (nameMatches.length === 1 && nameMatches[0].id != null && String(nameMatches[0].id).trim()) {
        examiner = nameMatches[0];
        examinerId = String(examiner.id);
        exam.chiefExaminerId = examinerId;
      }
    }
    if (examiner && !examinerName) {
      examinerName = examiner.name || '';
      exam.chiefExaminer = examinerName;
    }

    var examinerView = exam && exam.examinerView && typeof exam.examinerView === 'object'
      ? exam.examinerView
      : null;
    if ((!examinerView || !Number.isFinite(Number(examinerView.factionBias)))
        && examiner && typeof _kejuExaminerView === 'function') {
      try {
        examinerView = _kejuExaminerView(examiner) || null;
      } catch (error) {
        _scCaptureError(error, '派生主考视角失败');
      }
    }
    var factionBias = examinerView
      ? _scFiniteNumber(examinerView.factionBias, 0)
      : 0;
    return {
      exam: exam || null,
      stage: stage,
      examiner: examiner,
      examinerId: examinerId,
      examinerName: examinerName,
      examinerView: examinerView,
      factionBias: factionBias,
      tension: _scGetTension()
    };
  }

  // 科举须办过 (有稳定主考且未在 idle/finished)·弊案依附一场科举
  function _scExamActive() {
    var context = resolveScandalExamContext();
    return !!(context.examiner && context.examinerId
      && context.stage !== 'idle' && context.stage !== 'finished');
  }

  // 朝代中立监察 hook·剧本声明才生效·引擎不认任何朝代专名
  function _scOversight() {
    return (typeof P !== 'undefined' && P && P.keju && P.keju.scandalOversight) || null;
  }
  // 监察机构对主考偏私的加权增量 (剧本声明 + 腐败达标时)·返 0 表示无干预
  function _scOversightBiasBoost(corruption) {
    var ov = _scOversight();
    if (!ov) return 0;
    var trig = (typeof ov.triggerCorruption === 'number') ? ov.triggerCorruption : 40;
    if (corruption < trig) return 0;
    var w = (typeof ov.biasWeight === 'number') ? ov.biasWeight : 1;
    return (w > 1) ? (w - 1) : 0;
  }

  // §2 ───────────── init namespace ─────────────
  function _kjInitScandalState() {
    if (!_scEnabled()) return;
    var g = _scGM(); if (!g) return;
    if (!g.keju) g.keju = {};
    if (g.keju._scandal) return; // 幂等
    g.keju._scandal = {
      spawned: [],   // 待常朝消费的弊案检举
      history: [],   // 已处置弊案
      cooldown: 0,   // 上次弊案年份
      coveredUp: []  // 被庇护压下的 (日后败露风险·后续 slice 可用)
    };
  }

  function _scState() {
    var g = _scGM(); if (!g || !g.keju) return null;
    if (!g.keju._scandal) _kjInitScandalState();
    return g.keju._scandal || null;
  }

  function _scCooldownOk() {
    var s = _scState(); if (!s) return false;
    if (!s.cooldown) return true;
    return (_getCurYear() - s.cooldown) >= COOLDOWN_YEARS;
  }

  // §3 ───────────── 触发检测 (endTurn) ─────────────
  // 综合 3 通用因子·任 2 达阈即触发·并算 severity
  function _scAssess() {
    var context = resolveScandalExamContext();
    var examiner = context.examiner;
    if (!examiner || !context.examinerId) return null;
    var corruption = _scGetCorruption();
    var tension = context.tension;
    var bias = context.factionBias;
    bias += _scOversightBiasBoost(corruption); // 剧本监察 hook 加权 (中立)
    var th = _scThresh();
    var hits = 0;
    if (corruption >= th.corruption) hits++;
    if (tension >= th.tension) hits++;
    if (bias >= th.factionBias) hits++;
    if (hits < 2) return null;
    // severity 0-1·三因子归一平均
    var sev = (Math.min(1, corruption / 100) + Math.min(1, tension / 100) + Math.min(1, bias)) / 3;
    return {
      corruption: corruption, tension: tension, bias: bias,
      hits: hits, severity: sev, examiner: examiner,
      examinerId: context.examinerId,
      examinerName: context.examinerName,
      examId: context.exam && context.exam.id != null ? String(context.exam.id) : ''
    };
  }

  // 按因子结构选弊案类型 (偏私高→阿私·腐败高→请托/泄题·否则轮替)
  function _scPickType(a, seedIdx) {
    if (a.bias >= 0.75) return 'favoritism';
    if (a.corruption >= 65) return (seedIdx % 2 === 0) ? 'bribery' : 'leak';
    var keys = ['bribery', 'leak', 'impersonation', 'favoritism'];
    return keys[seedIdx % keys.length];
  }

  function _scReasonText(type, examiner) {
    var t = SCANDAL_TYPES[type] || { label: '科场弊案', blurb: '' };
    var who = (examiner && examiner.name) ? examiner.name : '主考';
    return '有言官劾' + who + '典试不公·' + t.blurb;
  }

  function _kjCheckScandalTriggers() {
    if (!_scEnabled()) return 0;
    if (!_scExamActive()) return 0;
    if (!_scCooldownOk()) return 0;
    var a = _scAssess();
    if (!a) return 0;
    var g = _scGM();
    var seedIdx = _getCurYear() + ((g && g.turn) || 0);
    var type = _scPickType(a, seedIdx);
    var reason = _scReasonText(type, a.examiner);
    return _kjSpawnScandal(type, reason, {
      examinerId: a.examinerId,
      examinerName: a.examinerName || (a.examiner && a.examiner.name) || '',
      examId: a.examId,
      severity: a.severity,
      bias: a.bias,
      corruption: a.corruption,
      tension: a.tension
    }) ? 1 : 0;
  }

  // §4 ───────────── spawn + 消费队列 ─────────────
  function _scSeverityName(sev) {
    if (sev >= 0.66) return 'high';
    if (sev >= 0.4) return 'mid';
    return 'low';
  }

  function _kjSpawnScandal(type, reason, detail) {
    if (!_scEnabled()) return false;
    var s = _scState(); if (!s) return false;
    if (!SCANDAL_TYPES[type]) return false;
    if (!_scCooldownOk()) return false;
    var g = _scGM();
    var curY = _getCurYear();
    var sev = (detail && typeof detail.severity === 'number') ? detail.severity : 0;
    var entry = {
      type: type,
      label: SCANDAL_TYPES[type].label,
      reason: reason || '',
      detail: detail || {},
      examinerId: (detail && detail.examinerId != null) ? String(detail.examinerId) : '',
      examinerName: (detail && detail.examinerName) || '',
      examId: (detail && detail.examId != null) ? String(detail.examId) : '',
      severity: sev,
      severityTier: _scSeverityName(sev),
      spawnedTurn: (g && g.turn) || 0,
      spawnedYear: curY
    };
    s.spawned.push(entry);
    s.cooldown = curY;
    return true;
  }

  function _kjConsumeScandalForAgenda() {
    if (!_scEnabled()) return [];
    var s = _scState(); if (!s || !s.spawned || !s.spawned.length) return [];
    var out = s.spawned.slice(0, MAX_CONSUME_PER_AGENDA);
    s.spawned = s.spawned.slice(MAX_CONSUME_PER_AGENDA);
    return out;
  }

  // endTurn render-finalize 调·结算渲染后从队列拉起一桩弊案的 keyi 议政
  // (对齐 wuju abolition 的 openKeyiSession 拉起·检测在 deferred·弹窗在此·避开结算中途)
  function _kjMaybeRaiseScandalKeyi() {
    if (!_scEnabled()) return false;
    if (typeof openKeyiSession !== 'function') return false;
    var state = _scState();
    if (!state || !Array.isArray(state.spawned) || !state.spawned.length) return false;
    var entry = state.spawned[0];
    try {
      var opened = openKeyiSession({ topicType: 'scandal', topicData: entry });
      if (opened !== true) return false;
      // 只消费本次实际打开的同一条记录；失败/取消/重入均保留原队列。
      if (state.spawned[0] === entry) state.spawned.shift();
      else {
        var entryIndex = state.spawned.indexOf(entry);
        if (entryIndex < 0) return false;
        state.spawned.splice(entryIndex, 1);
      }
      return true;
    } catch (error) {
      _scCaptureError(error, '打开科场弊案议政失败');
      return false;
    }
  }

  // §5 ───────────── 议政回调 (三路径) ─────────────
  // _kjScandalKeyiCallback(method, ctx)·method = investigate / dismiss / protect
  //   (council/edict 等议政方式 fallback 视作查办)
  function _scResolveTopicExaminer(td) {
    td = td || {};
    var examiner = null;
    var examinerId = td.examinerId != null ? String(td.examinerId).trim() : '';
    var examinerName = td.examinerName || td.accused || '';
    if (examinerId) {
      examiner = _scFindCharacterById(examinerId);
      if (!examiner) return { ok: false, reason: 'examiner-not-found' };
    } else if (examinerName) {
      var matches = _scFindCharactersByName(examinerName);
      if (matches.length > 1) return { ok: false, reason: 'examiner-name-ambiguous' };
      examiner = matches[0] || null;
      if (!examiner) return { ok: false, reason: 'examiner-not-found' };
      if (examiner.id == null || !String(examiner.id).trim()) {
        return { ok: false, reason: 'examiner-missing-stable-id' };
      }
      examinerId = String(examiner.id);
      td.examinerId = examinerId;
      if (!td.examinerName) td.examinerName = examiner.name || examinerName;
    } else {
      return { ok: false, reason: 'examiner-identity-missing' };
    }
    if (examiner.alive === false || examiner.dead === true) {
      return { ok: false, reason: 'examiner-unavailable' };
    }
    return {
      ok: true,
      examiner: examiner,
      examinerId: examinerId,
      examinerName: examiner.name || examinerName || '主考'
    };
  }

  function _kjScandalKeyiCallback(method, ctx) {
    if (!_scEnabled()) return { ok: false, reason: 'feature-disabled' };
    ctx = ctx || {};
    var td = ctx.topicData || {};
    var s = _scState();
    var resolved = _scResolveTopicExaminer(td);
    if (!resolved.ok) return resolved;
    var examiner = resolved.examiner;
    var examinerId = resolved.examinerId;
    var examinerName = resolved.examinerName;
    var tier = td.severityTier || _scSeverityName(td.severity || 0);
    var curY = _getCurYear();

    // 议政未通过·不了了之 (主考无事·吏治受损)
    if (ctx.passed === false) {
      _scChron('keju_scandal_dropped', curY + '·' + examinerName + '弊案之议未决·不了了之', ['科举', '弊案']);
      _scResolveHistory(td, 'unresolved', examinerId, examinerName);
      _scAdjust('corruption', +3);
      return { ok: true, outcome: 'unresolved', examinerId: examinerId };
    }

    var outcome = _scNormalizeMethod(method);

    if (outcome === 'protect') {
      // 庇护·压下·主考保全·吏治民心受损·留败露隐患
      _scChron('keju_scandal_protected', curY + '·诏宥' + examinerName + '·科场之事寝议', ['科举', '弊案', '庇护']);
      if (s) s.coveredUp.push({ examinerId: examinerId, examinerName: examinerName, year: curY, type: td.type || '', tier: tier });
      _scAdjust('corruption', +6);
      _scAdjust('minxin', -4);
      _scAdjustTension(+3, examiner);
      _scResolveHistory(td, 'protected', examinerId, examinerName);
      return { ok: true, outcome: 'protected', examinerId: examinerId };
    }

    if (outcome === 'dismiss') {
      // 罢免·仅去主考之职·不深究
      var dismissResult = _scPunish(examiner, 'dismiss', '坐科场不谨·罢职');
      if (!dismissResult.ok) return dismissResult;
      _scChron('keju_scandal_dismissed', curY + '·罢' + examinerName + '典试之任', ['科举', '弊案', '罢免']);
      _scAdjust('corruption', -3);
      _scAdjustTension(+2, examiner);
      _scResolveHistory(td, 'dismissed', examinerId, examinerName);
      return { ok: true, outcome: 'dismissed', examinerId: examinerId };
    }

    // investigate (查办·默认)·按 severity 定罪
    var kind, reasonStr, chronText;
    if (tier === 'high') {
      kind = 'exile'; reasonStr = '坐科场鬻题纳贿·削籍流放';
      chronText = curY + '·穷治' + examinerName + '科场大狱·削籍·流';
    } else if (tier === 'mid') {
      kind = 'dismiss'; reasonStr = '坐典试阿私·革职';
      chronText = curY + '·按' + examinerName + '阿私之罪·革职';
    } else {
      kind = 'demote'; reasonStr = '坐校士不谨·夺俸记过';
      chronText = curY + '·议' + examinerName + '失察·夺俸记过';
    }
    var punishResult = _scPunish(examiner, kind, reasonStr);
    if (!punishResult.ok) return punishResult;
    _scChron('keju_scandal_investigated', chronText, ['科举', '弊案', '查办']);
    _scAdjust('corruption', -8);   // 肃贪
    _scAdjust('minxin', +3);       // 大快人心
    _scAdjustTension(+5, examiner);          // 牵连树敌
    _scResolveHistory(td, 'investigated:' + kind, examinerId, examinerName);
    return { ok: true, outcome: 'investigated:' + kind, examinerId: examinerId };
  }

  function _scNormalizeMethod(method) {
    var m = String(method || '').toLowerCase();
    if (m === 'protect' || m === 'protect_examiner' || m === 'defy' || m === '庇护') return 'protect';
    if (m === 'dismiss' || m === 'dismiss_only' || m === '罢免') return 'dismiss';
    // investigate / council / edict / 其他 → 查办
    return 'investigate';
  }

  // §6 ───────────── 后果应用 (复用标准状态字段·不自造) ─────────────
  // 复用 tm-ai-change-applier 的状态语义：execute→alive=false·exile→_exiled·dismiss→去职·demote→记过
  function _scPunish(ch, kind, reason) {
    var g = _scGM();
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
      return { ok: false, reason: 'invalid-examiner-object' };
    }
    if (ch.id == null || !String(ch.id).trim()) {
      return { ok: false, reason: 'examiner-missing-stable-id' };
    }
    if (!g || !Array.isArray(g.chars) || g.chars.indexOf(ch) < 0) {
      return { ok: false, reason: 'examiner-not-in-current-world' };
    }
    if (ch.alive === false || ch.dead === true) {
      return { ok: false, reason: 'examiner-unavailable' };
    }
    var turn = (g && g.turn) || 0;
    if (!Array.isArray(ch.careerHistory)) ch.careerHistory = [];
    if (kind === 'execute') {
      ch.alive = false;
      ch._deathCause = reason; ch._deathTurn = turn;
    } else if (kind === 'exile') {
      ch._exiled = true; ch._exileTurn = turn; ch._exileReason = reason;
      ch._degraded = true; // 削籍·夺功名 (通用标记)
    } else if (kind === 'dismiss') {
      if (ch.officialTitle && !ch._origOfficialTitle) ch._origOfficialTitle = ch.officialTitle;
      ch._dismissed = true; ch._dismissedTurn = turn;
    } else { // demote·夺俸记过·留任
      ch._demerit = (ch._demerit || 0) + 1;
    }
    ch.careerHistory.push({ turn: turn, event: '科场案·' + reason });
    return { ok: true, examinerId: String(ch.id), kind: kind };
  }

  // 通用变量安全调整 (多源·改不动则 noop·不崩)
  function _scAdjust(key, delta) {
    var g = _scGM(); if (!g) return;
    if (key === 'corruption') {
      if (typeof g.corruption === 'number') { g.corruption = _clamp(g.corruption + delta, 0, 100); return; }
      if (g.vars && g.vars['吏治'] && typeof g.vars['吏治'].value === 'number') { g.vars['吏治'].value = _clamp(g.vars['吏治'].value + delta, 0, 100); return; }
    } else if (key === 'minxin') {
      if (typeof g.minxin === 'number') { g.minxin = _clamp(g.minxin + delta, 0, 100); return; }
      if (g.vars && g.vars['民心'] && typeof g.vars['民心'].value === 'number') { g.vars['民心'].value = _clamp(g.vars['民心'].value + delta, 0, 100); return; }
    }
  }

  function _scAdjustTension(delta, examiner) {
    var g = _scGM(); if (!g) return;
    var party = examiner && examiner.party;
    if (party && typeof _kjUpdateFactionTension === 'function') {
      _kjUpdateFactionTension({ party: party, delta: delta, reason: '科场弊案处置' });
      return;
    }
    if (party && g._factionTension && Number.isFinite(Number(g._factionTension[party]))) {
      g._factionTension[party] = _clamp(Number(g._factionTension[party]) + delta, 0, 20);
      return;
    }
    if (g.keju && Number.isFinite(g.keju.tension)) {
      g.keju.tension = _clamp(g.keju.tension + delta, 0, 100);
    }
  }

  function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function _scChron(type, text, tags) {
    var g = _scGM(); if (!g) return;
    if (!Array.isArray(g._chronicle)) return; // 无编年史则跳过 (不崩)
    g._chronicle.push({ turn: (g.turn || 0), type: type, text: text, tags: tags || [] });
  }

  function _scResolveHistory(td, resolution, examinerId, examinerName) {
    var s = _scState(); if (!s) return;
    s.history.push({
      type: (td && td.type) || '',
      examinerId: examinerId || '',
      examinerName: examinerName || '',
      resolution: resolution,
      year: _getCurYear()
    });
  }

  // §7 ───────────── 暴露 ─────────────
  if (typeof window !== 'undefined') {
    window._kjInitScandalState        = _kjInitScandalState;
    window._kjCheckScandalTriggers    = _kjCheckScandalTriggers;
    window._kjConsumeScandalForAgenda = _kjConsumeScandalForAgenda;
    window._kjSpawnScandal            = _kjSpawnScandal;
    window._kjScandalKeyiCallback     = _kjScandalKeyiCallback;
    window._kjMaybeRaiseScandalKeyi   = _kjMaybeRaiseScandalKeyi;
    window.resolveScandalExamContext  = resolveScandalExamContext;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjInitScandalState: _kjInitScandalState,
      _kjCheckScandalTriggers: _kjCheckScandalTriggers,
      _kjConsumeScandalForAgenda: _kjConsumeScandalForAgenda,
      _kjSpawnScandal: _kjSpawnScandal,
      _kjScandalKeyiCallback: _kjScandalKeyiCallback,
      _kjMaybeRaiseScandalKeyi: _kjMaybeRaiseScandalKeyi,
      // test 用
      resolveScandalExamContext: resolveScandalExamContext,
      _scAssess: _scAssess,
      _scPunish: _scPunish,
      _scNormalizeMethod: _scNormalizeMethod,
      _scSeverityName: _scSeverityName,
      SCANDAL_TYPES: SCANDAL_TYPES
    };
  }
})();
