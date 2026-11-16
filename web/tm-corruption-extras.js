// ═══ 巨石拆分(20260706)：corruption 模式/卖官/AI/地图热力/编辑器(原 P4·C 子 IIFE) ═══
// 依赖 tm-corruption-engine.js + tm-corruption-cases.js。跨 IIFE 裸名 syncIndexFromSubDepts 已加 CorruptionEngine. 前缀。 装载序契约见 lint-split-contracts。原 tm-corruption-engine.js 2490 行·R9 三 IIFE 合并已倒回三片。
// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 腐败系统 · P4 完善模块
// 依赖：tm-corruption-engine.js + tm-corruption-p2.js
//
// ⚠ 补丁分类（2026-04-24 R12 评估）：LAYERED（叠加链终端）
//   · APPEND 部分：getGameMode/getModeMultipliers/openJuanna/closeJuanna
//                  /enrichCaseWithAI/toggleMapCorruptionOverlay/getCorruptionColor
//                  /renderEditorPanel/aiPurgeAdvisor
//   · OVERRIDE 部分（覆盖 p2 的）：
//       · CorruptionEngine.tick （最终版·覆盖 p2 的 tick）
//       · CorruptionEngine.generateExposureCase （覆盖 p2）
//       · CorruptionEngine.updatePerceived （覆盖 engine 或 p2）
//   合并指引见 PATCH_CLASSIFICATION.md · Corruption 段（预计工时 30h）
//
// 实现：
//   - §9.6 游戏模式调节（严格史实/轻度史实/演义）
//   - §13 官员轮换过频副作用量化
//   - 卖官鬻爵（juanna）子系统激活
//   - §9 AI 真赋能（案件文本 / 风闻文本异步增强）
//   - §10.5 地图污浊热力层
//   - §8 编辑器面板（可嵌入式 HTML 渲染器）
//   - §7.8 腐败 → 制度设计 反向：新设机构腐败继承环境
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof CorruptionEngine === 'undefined') {
    console.warn('[corruption-p4] CorruptionEngine 未加载，P4 跳过');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ═════════════════════════════════════════════════════════════
  // §9.6 游戏模式调节
  // ═════════════════════════════════════════════════════════════

  function getGameMode() {
    if (typeof P !== 'undefined' && P.conf && P.conf.gameMode) return P.conf.gameMode;
    return 'light-history';  // 默认轻度史实
  }

  function getModeMultipliers() {
    var mode = getGameMode();
    if (mode === 'strict')  return { visibilityPenalty: 0.6, exposureFreq: 0.7, backlashMult: 1.5, floateryGap: 1.3 };
    if (mode === 'romance') return { visibilityPenalty: 1.4, exposureFreq: 1.3, backlashMult: 0.6, floateryGap: 0.7 };
    return { visibilityPenalty: 1.0, exposureFreq: 1.0, backlashMult: 1.0, floateryGap: 1.0 };
  }

  // ═════════════════════════════════════════════════════════════
  // §13 轮换过频副作用
  // ═════════════════════════════════════════════════════════════

  function applyRotationSideEffects(context) {
    var cm = GM.corruption.countermeasures;
    if (!cm || !cm.rotation) return;
    var mr = (context && context._monthRatio) ||
             (typeof CorruptionEngine.getMonthRatio === 'function' ? CorruptionEngine.getMonthRatio()
              : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1));
    if (cm.rotation > 0.6) {
      var severity = cm.rotation - 0.5;
      if (GM._corrStats) GM._corrStats.policyInaccuracy = (GM._corrStats.policyInaccuracy || 0) + severity * mr;
      // 每月小概率 → 按月数
      if (Math.random() < severity * 0.1 * mr) {
        if (typeof addEB === 'function') {
          addEB('朝代', '地方官频调，政令下达而无人详察，百事生疏', { credibility: 'medium' });
        }
        GM.corruption.subDepts.provincial.true = Math.min(100,
          GM.corruption.subDepts.provincial.true + severity * 2);
      }
    } else {
      if (GM._corrStats && GM._corrStats.policyInaccuracy > 0) {
        GM._corrStats.policyInaccuracy = Math.max(0, GM._corrStats.policyInaccuracy - 0.05 * mr);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 卖官鬻爵（juanna）子系统
  // ═════════════════════════════════════════════════════════════

  function ensureJuannaModel() {
    if (!GM.juanna) {
      GM.juanna = {
        active: false,
        startTurn: null,
        monthlyIncome: 0,           // 每月捐纳收入
        cumulativeSold: 0,           // 累计售出官衔
        tier: 'standard'              // 'open-any'|'standard'|'restricted'
      };
    }
  }

  function openJuanna(tier) {
    ensureJuannaModel();
    var j = GM.juanna;
    j.active = true;
    j.startTurn = GM.turn;
    j.tier = tier || 'standard';
    // 月收入 = 帑廪月入的比例
    var baseMonthly = (GM.guoku && GM.guoku.monthlyIncome) || 50000;
    j.monthlyIncome = tier === 'open-any'   ? baseMonthly * 0.25 :
                      tier === 'standard'   ? baseMonthly * 0.12 :
                                              baseMonthly * 0.05;
    if (typeof addEB === 'function') {
      addEB('朝代', '诏开捐纳：售官' + (tier==='open-any'?'不限级'
                                       : tier==='standard'?'有序捐纳'
                                       :'限捐低阶')
                   + '，月入约 ' + Math.round(j.monthlyIncome/1000) + ' 千两',
            { credibility: 'high' });
    }
    return j;
  }

  function closeJuanna() {
    ensureJuannaModel();
    if (!GM.juanna.active) return;
    GM.juanna.active = false;
    GM.juanna.monthlyIncome = 0;
    if (typeof addEB === 'function') {
      addEB('朝代', '诏罢捐纳，清流拭目', { credibility: 'high' });
    }
  }

  function applyJuannaMonthly(context) {
    ensureJuannaModel();
    if (!GM.juanna.active) return;
    var j = GM.juanna;
    var mr = (context && context._monthRatio) ||
             (typeof CorruptionEngine.getMonthRatio === 'function' ? CorruptionEngine.getMonthRatio()
              : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1));
    // monthlyIncome 是月入 → 按月数入账·走 FiscalEngine 真账(2026-07-04 收口)
    if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) FiscalEngine.addToGuoku({ money: j.monthlyIncome * mr }, '鬻爵月入');
    j.cumulativeSold = (j.cumulativeSold || 0) + mr;
    // 按月速率加剧部门腐败
    if (GM.corruption) {
      GM.corruption.subDepts.central.true = Math.min(100,
        GM.corruption.subDepts.central.true + 0.05 * mr);
      GM.corruption.subDepts.fiscal.true = Math.min(100,
        GM.corruption.subDepts.fiscal.true + 0.03 * mr);
    }
    // 士人民心按月扣
    if (GM.minxin && GM.minxin.byClass && GM.minxin.byClass.shi) {
      GM.minxin.byClass.shi.true = Math.max(0, GM.minxin.byClass.shi.true - 0.2 * mr);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // §9 AI 文本增强（异步、非阻塞、有回退）
  // ═════════════════════════════════════════════════════════════

  function isAIAvailable() {
    return (typeof callAI === 'function')
        && (typeof P !== 'undefined') && P.ai && P.ai.key;
  }

  // §9.3 肃贪决策 AI 参议
  async function aiPurgeAdvisor() {
    if (!isAIAvailable()) {
      return {
        available: false,
        analysis: _ruleBasedPurgeAdvisor()
      };
    }
    try {
      var c = GM.corruption;
      var h = (GM.huangquan || {}).index || 50;
      var w = (GM.huangwei || {}).index || 50;
      var m = (GM.minxin || {}).trueIndex || 50;
      var guoku = (GM.guoku && GM.guoku.balance) || 0;
      var sup = (c.supervision && c.supervision.level) || 0;
      var factions = (c.entrenchedFactions || []).map(function(f){return f.name;}).join('、') || '无';
      var maxDept = 'central', maxVal = 0;
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
        if (c.subDepts[d].true > maxVal) { maxVal = c.subDepts[d].true; maxDept = d; }
      });
      var deptLabel = CorruptionEngine._deptName(maxDept);

      var prompt = '你扮演明察秋毫的辅政大臣，为陛下参议肃贪。' +
        '用奏疏体（200字内，文言雅训），分析三项并给建议：' +
        '1) 是否当行大计；2) 若行，当从何处入手；3) 副作用预警。' +
        '\n\n当前时局：' +
        '\n- 全局腐败：' + Math.round(c.trueIndex) + '/100（最重：' + deptLabel + ' ' + Math.round(maxVal) + '）' +
        '\n- 皇权：' + Math.round(h) + '；皇威：' + Math.round(w) + '；民心：' + Math.round(m) +
        '\n- 监察力度：' + Math.round(sup) + '/100' +
        '\n- 帑廪：' + Math.round(guoku) + ' 两' +
        '\n- 盘根集团：' + factions +
        '\n\n直接输出奏疏（"臣某某谨奏……"），不含解释。';

      var text = await callAI(prompt, 500);
      return {
        available: true,
        analysis: (text || '').trim()
      };
    } catch(e) {
      console.warn('[corruption-p4] aiPurgeAdvisor:', e.message);
      return {
        available: false,
        analysis: _ruleBasedPurgeAdvisor(),
        error: e.message
      };
    }
  }

  // 规则版后备：基于当前状态给出固定建议
  function _ruleBasedPurgeAdvisor() {
    var c = GM.corruption;
    var h = (GM.huangquan || {}).index || 50;
    var w = (GM.huangwei || {}).index || 50;
    var m = (GM.minxin || {}).trueIndex || 50;
    var sup = (c.supervision && c.supervision.level) || 0;
    var guoku = (GM.guoku && GM.guoku.balance) || 0;
    var annual = (GM.guoku && GM.guoku.annualIncome) || 1e6;

    var maxDept = 'central', maxVal = 0;
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
      if (c.subDepts[d].true > maxVal) { maxVal = c.subDepts[d].true; maxDept = d; }
    });

    var lines = [];
    lines.push('【时局】腐败' + Math.round(c.trueIndex) + '，最甚' + CorruptionEngine._deptName(maxDept) + '（' + Math.round(maxVal) + '）。');

    // 判定：当行大计 vs 分部整顿 vs 缓行
    if (maxVal > 70 && sup > 50 && h > 55 && guoku > annual * 0.3) {
      lines.push('【臣议】吏治颓靡，陛下可行大计——六部门并肃。皇权足以震慑，帑廪支撑，监察有力。');
      lines.push('【入手】从最重之' + CorruptionEngine._deptName(maxDept) + '始，诛首恶、宥胁从。');
    } else if (maxVal > 60 && sup > 40 && h > 40) {
      lines.push('【臣议】可行分部整顿，专清一处。全域肃贪恐力有不逮。');
      lines.push('【入手】专清' + CorruptionEngine._deptName(maxDept) + '部门，遣钦差专项稽查。');
    } else {
      lines.push('【臣议】时机未至。');
      var reasons = [];
      if (sup < 40) reasons.push('监察力度不足（当前 ' + Math.round(sup) + '），恐沦为形式');
      if (h < 40) reasons.push('皇权不足以震慑反弹（当前 ' + Math.round(h) + '）');
      if (guoku < annual * 0.3) reasons.push('帑廪不足以支撑朝政瘫痪期');
      if (m < 40) reasons.push('民心动摇（当前 ' + Math.round(m) + '），此时肃贪恐激民变');
      lines.push('【阻因】' + reasons.join('；'));
      lines.push('【建议】先设监察机构、养廉银并用，徐图之。');
    }

    // 副作用预警
    var warnings = [];
    if (c.entrenchedFactions.length > 0) warnings.push('盘根集团' + c.entrenchedFactions.length + '个，清算必激烈反噬');
    if ((c.countermeasures.harshPunishment || 0) > 0.3) warnings.push('酷吏已滥，再行恐致冤狱');
    if (m < 40) warnings.push('民心低迷，肃贪激烈处或激民变');
    if (warnings.length > 0) lines.push('【副作用】' + warnings.join('；'));

    return lines.join('\n\n');
  }

  async function enrichCaseWithAI(caseObj) {
    if (!isAIAvailable()) return null;
    try {
      var deptName = CorruptionEngine._deptName(caseObj.dept);
      var sevLbl = caseObj.severity === 'major' ? '大案' :
                   caseObj.severity === 'moderate' ? '中案' : '小案';
      var prompt = '写一道古代奏疏体的揭发案文（60-120字），格式："臣XX谨奏……"。' +
                   '案件：' + caseObj.name + '。涉及部门：' + deptName + '。' +
                   '严重程度：' + sevLbl + '。涉案金额约 ' + caseObj.amount + ' 两。' +
                   '证据：' + caseObj.evidence + '。只输出奏疏正文，不含解释。';
      var text = await callAI(prompt, 300);
      if (text && text.length > 20) {
        // 更新事件日志
        var el = (GM.evtLog || []).find(function(e) { return e.ref === caseObj.id; });
        if (el) {
          el.text = text.trim().replace(/\n+/g, ' ').substring(0, 200);
          // 刷新面板
          var panel = document.getElementById('lizhi-body');
          if (panel && typeof renderCorruptionPanel === 'function') renderCorruptionPanel();
        }
        return text;
      }
    } catch (e) {
      console.warn('[corruption-p4] enrichCaseWithAI:', e.message);
    }
    return null;
  }

  // 包装原 generateExposureCase：生成后异步让 AI 润色
  var _origGenExpCase = CorruptionEngine.generateExposureCase;
  CorruptionEngine.generateExposureCase = function() {
    var caseObj = _origGenExpCase.apply(this, arguments);
    if (caseObj && isAIAvailable()) {
      // 异步增强（不阻塞）
      setTimeout(function() { enrichCaseWithAI(caseObj); }, 100);
    }
    return caseObj;
  };

  // ═════════════════════════════════════════════════════════════
  // §10.5 地图污浊热力层
  // ═════════════════════════════════════════════════════════════

  function updateRegionalCorruption() {
    if (!GM.mapData || !GM.mapData.cities) return;
    if (!GM.corruption) return;
    if (!GM.corruption.byRegion) GM.corruption.byRegion = {};
    var pc = (GM.corruption.subDepts.provincial || {}).true || 30;

    // 本回合代表的月数
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1);
    // 每月 8% 回归 → 按月数幂次
    var retainMonthly = 0.92;
    var regressMonthly = 0.08;
    var retain = Math.pow(retainMonthly, mr);
    var regress = 1 - retain;

    Object.keys(GM.mapData.cities).forEach(function(cityId) {
      if (GM.corruption.byRegion[cityId] === undefined) {
        var hash = 0;
        for (var i = 0; i < cityId.length; i++) hash = ((hash << 5) - hash) + cityId.charCodeAt(i);
        var variance = ((hash % 41) - 20);
        GM.corruption.byRegion[cityId] = { value: clamp(pc + variance, 0, 100), variance: variance };
      } else {
        var r = GM.corruption.byRegion[cityId];
        r.value = clamp(r.value * retain + (pc + r.variance) * regress, 0, 100);
      }
    });
  }

  // 叶级吏治连账（2026-07-03）：CorruptionEngine 动态原只写 GM.corruption.byRegion(城账·mapData.cities 键)，
  // 而区划叶 div.corruption 有读(aggregate 上汇/官守图层/实征输入)无常写——「活树上的静叶」。
  // 修：与城账同驱动源的确定性漂移——目标=全国吏治基线+本叶稳定 variance(名字哈希)+豪强抬升(勾结州县)，
  // 每月 6% 收敛(略缓于城账 8%)。肃贪诏令降基线→叶子跟着收敛·两账同源演化不再脱钩。只走 player 子树(外邦不吃明廷吏治基线)。
  function updateLeafCorruption() {
    if (!GM || !GM.adminHierarchy) return;
    var pcNow = GM.corruption && GM.corruption.subDepts && (GM.corruption.subDepts.provincial || {}).true;
    if (typeof pcNow !== 'number') return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);
    var retain = Math.pow(0.94, mr);
    var regress = 1 - retain;
    var ps = GM.provinceStats || {};
    function provinceMagnate(topName) {
      if (!topName) return 0;
      var hit = ps[topName];
      if (hit && typeof hit.magnatePower === 'number') return hit.magnatePower;
      var keys = Object.keys(ps);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k && (k.indexOf(topName) >= 0 || String(topName).indexOf(k) >= 0)) {
          var v = ps[k] && ps[k].magnatePower;
          if (typeof v === 'number') return v;
        }
      }
      return 0;
    }
    function hashVar(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i); return (h % 31) - 15; }
    var root = GM.adminHierarchy.player;
    var tops = (root && root.divisions) || [];
    tops.forEach(function (top) {
      var mag = provinceMagnate(top && (top.name || top.id));
      (function walk(d) {
        if (!d) return;
        var kids = d.children || d.divisions;
        if (kids && kids.length) { kids.forEach(walk); return; }
        var target = clamp(pcNow + hashVar(d.name || d.id) + Math.min(10, mag * 0.1), 0, 100);
        var cur = (typeof d.corruption === 'number') ? d.corruption
                : (typeof d.corruptionLocal === 'number' ? d.corruptionLocal : target);
        d.corruption = clamp(cur * retain + target * regress, 0, 100);
      })(top);
    });
  }

  function getCorruptionColor(value) {
    // 0-25 清明：青玉
    // 25-50 尚可：金
    // 50-70 渐弊：暗金
    // 70-85 颓靡：朱红
    // 85+  积重：深赤
    if (value < 25) return 'rgba(106,168,138,0.55)';
    if (value < 50) return 'rgba(184,154,83,0.55)';
    if (value < 70) return 'rgba(138,109,43,0.65)';
    if (value < 85) return 'rgba(192,64,48,0.65)';
    return 'rgba(139,46,37,0.8)';
  }

  function toggleMapCorruptionOverlay(on) {
    if (!GM.mapData) return;
    if (!GM.mapData.state) GM.mapData.state = {};
    GM.mapData.state.showCorruption = (on === undefined) ? !GM.mapData.state.showCorruption : !!on;
    if (typeof renderMap === 'function') renderMap();
  }

  // 钩入 renderPolygons——若 showCorruption 开启，覆盖颜色为腐败色
  function installMapHook() {
    if (typeof renderPolygons !== 'function') return;
    if (renderPolygons._corrHookInstalled) return;
    var _origRender = renderPolygons;
    window.renderPolygons = function(ctx) {
      _origRender.call(this, ctx);
      if (!GM.mapData || !GM.mapData.state || !GM.mapData.state.showCorruption) return;
      if (!GM.corruption || !GM.corruption.byRegion) return;
      // 覆盖一层腐败色
      Object.values(GM.mapData.polygons || {}).forEach(function(polygon) {
        var cityId = polygon.cityId;
        var reg = GM.corruption.byRegion[cityId];
        if (!reg) return;
        ctx.beginPath();
        polygon.points.forEach(function(p, i) {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = getCorruptionColor(reg.value);
        ctx.fill();
      });
    };
    window.renderPolygons._corrHookInstalled = true;
  }

  // ═════════════════════════════════════════════════════════════
  // §7.8 腐败 → 制度设计 反向：新设机构继承环境腐败
  // ═════════════════════════════════════════════════════════════

  function getInstitutionInitialCorruption() {
    // 新设机构自带腐败 = 其所属部门腐败的 30%（机构总比部门清廉）
    // 若环境整体腐败严重，新机构也难独善其身
    var avg = 0, n = 0;
    ['central','provincial','fiscal','judicial'].forEach(function(d) {
      avg += (GM.corruption.subDepts[d] || {}).true || 0;
      n++;
    });
    avg = n > 0 ? avg / n : 20;
    return Math.round(avg * 0.3);
  }

  // 包装 setupSecretPolice，让新设机构继承环境腐败
  var _origSetupSP = CorruptionEngine.Actions.setupSecretPolice;
  CorruptionEngine.Actions.setupSecretPolice = function(type) {
    var r = _origSetupSP.call(this, type);
    if (r && r.success) {
      // 修正最后一个新增的机构的 corruption
      var insts = GM.corruption.supervision.institutions;
      if (insts.length > 0) {
        var last = insts[insts.length - 1];
        var envCorr = getInstitutionInitialCorruption();
        last.corruption = Math.max(last.corruption, envCorr);
      }
    }
    return r;
  };

  // ═════════════════════════════════════════════════════════════
  // §8 编辑器腐败配置面板（HTML 渲染器）
  // 返回可嵌入到编辑器的 HTML + 提供保存回调
  // ═════════════════════════════════════════════════════════════

  function renderEditorCorruptionPanel(targetScenario) {
    var sc = targetScenario || {};
    var cc = sc.corruption || {};
    var sd = cc.subDepts || {};
    var sv = cc.supervision || {};
    var html = '<div class="editor-corruption-panel">';
    html += '<h3 style="color:var(--gold);letter-spacing:0.1em;margin-bottom:0.6rem;">腐败初始配置（覆盖朝代预设）</h3>';

    html += '<div style="display:grid;grid-template-columns:140px 1fr;gap:6px 12px;align-items:center;font-size:0.82rem;">';

    function numRow(label, id, val, min, max) {
      return '<label>' + label + '</label>'+
        '<input type="number" id="corrEd_' + id + '" value="' + (val !== undefined ? val : '') +
        '" min="' + (min || 0) + '" max="' + (max || 100) +
        '" placeholder="留空则按朝代预设" style="padding:4px 6px;font-family:inherit;">';
    }

    html += numRow('全局指数', 'trueIndex', cc.trueIndex);
    html += numRow('中央', 'central',    (sd.central||{}).true);
    html += numRow('地方', 'provincial', (sd.provincial||{}).true);
    html += numRow('军队', 'military',   (sd.military||{}).true);
    html += numRow('税司', 'fiscal',     (sd.fiscal||{}).true);
    html += numRow('司法', 'judicial',   (sd.judicial||{}).true);
    html += numRow('内廷', 'imperial',   (sd.imperial||{}).true);
    html += numRow('监察力度', 'supLevel', sv.level);

    html += '</div>';

    // 初始机构列表（简化：文本域 JSON）
    html += '<div style="margin-top:0.8rem;font-size:0.78rem;">'+
      '<label style="display:block;margin-bottom:4px;color:var(--gold);">预设机构（JSON 数组，可选）</label>'+
      '<textarea id="corrEd_institutions" rows="4" style="width:100%;font-family:monospace;font-size:0.72rem;padding:6px;" placeholder=\'[{"name":"都察院","coverage":["central","provincial"],"radius":70,"independence":50,"corruption":20,"vacancies":0.15}]\'>'+
      JSON.stringify(sv.institutions || [], null, 2) + '</textarea></div>';

    // 初始腐败集团
    html += '<div style="margin-top:0.8rem;font-size:0.78rem;">'+
      '<label style="display:block;margin-bottom:4px;color:var(--gold);">盘根错节集团（JSON 数组，可选）</label>'+
      '<textarea id="corrEd_factions" rows="4" style="width:100%;font-family:monospace;font-size:0.72rem;padding:6px;" placeholder=\'[{"name":"严党","dept":"central","strength":75,"years":5}]\'>'+
      JSON.stringify(cc.entrenchedFactions || [], null, 2) + '</textarea></div>';

    html += '<button class="bt bp" style="margin-top:0.6rem;" onclick="window._corrEditorSave()">保存到剧本</button>';
    html += '<p style="font-size:0.7rem;color:var(--txt-d);margin-top:0.4rem;">未填字段将用朝代预设（见 `CorruptionEngine.DYNASTY_PRESETS`）。</p>';
    html += '</div>';
    return html;
  }

  // 保存回调（在页面上下文里由编辑器集成点调用）
  window._corrEditorSave = function() {
    if (typeof P === 'undefined') return;
    var cur = (typeof window.currentEditingScenario !== 'undefined') ? window.currentEditingScenario : P;
    if (!cur) return;
    if (!cur.corruption) cur.corruption = {};
    var cc = cur.corruption;
    function getNum(id) {
      var el = document.getElementById('corrEd_' + id);
      if (!el) return undefined;
      var v = el.value;
      if (v === '') return undefined;
      return Number(v);
    }
    var ti = getNum('trueIndex');
    if (ti !== undefined) cc.trueIndex = ti;

    if (!cc.subDepts) cc.subDepts = {};
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
      var v = getNum(d);
      if (v !== undefined) {
        if (!cc.subDepts[d]) cc.subDepts[d] = {};
        cc.subDepts[d].true = v;
      }
    });

    var sl = getNum('supLevel');
    if (sl !== undefined) {
      if (!cc.supervision) cc.supervision = {};
      cc.supervision.level = sl;
    }

    var instEl = document.getElementById('corrEd_institutions');
    if (instEl && instEl.value.trim()) {
      try {
        if (!cc.supervision) cc.supervision = {};
        cc.supervision.institutions = JSON.parse(instEl.value);
      } catch(e) { alert('机构 JSON 解析失败：' + e.message); return; }
    }
    var facEl = document.getElementById('corrEd_factions');
    if (facEl && facEl.value.trim()) {
      try {
        cc.entrenchedFactions = JSON.parse(facEl.value);
      } catch(e) { alert('集团 JSON 解析失败：' + e.message); return; }
    }

    if (typeof toast === 'function') toast('腐败配置已保存');
    else alert('已保存');
  };

  // ═════════════════════════════════════════════════════════════
  // 接入 tick（追加 P4 逻辑）
  // ═════════════════════════════════════════════════════════════

  var _origTick = CorruptionEngine.tick;
  CorruptionEngine.tick = function(context) {
    _origTick.call(this, context);
    try { applyRotationSideEffects(context); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] rotation:') : console.error('[corruption-p4] rotation:', e); }
    try { applyJuannaMonthly(context); }       catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] juanna:') : console.error('[corruption-p4] juanna:', e); }
    try { CorruptionEngine.syncIndexFromSubDepts('\u8150\u8d25\u540e\u7eed\u8054\u52a8', { record: false }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] sync:') : console.error('[corruption-p4] sync:', e); }
    try { updateRegionalCorruption(); }        catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] region:') : console.error('[corruption-p4] region:', e); }
    try { updateLeafCorruption(); }            catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] leaf:') : console.error('[corruption-p4] leaf:', e); }
  };

  // 扩展 updatePerceived 以应用模式调节
  var _origUpdatePerc = CorruptionEngine.updatePerceived;
  CorruptionEngine.updatePerceived = function() {
    _origUpdatePerc.call(this);
    // 根据模式调整感知值偏差
    var mult = getModeMultipliers();
    var c = GM.corruption;
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      var sd = c.subDepts[k];
      var gap = sd.true - sd.perceived;
      sd.perceived = clamp(sd.true - gap * mult.floateryGap, 0, 100);
    });
  };

  // 首次启动时尝试安装地图钩子
  if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
      setTimeout(installMapHook, 200);
    });
    if (document.readyState === 'complete') setTimeout(installMapHook, 200);
  }

  // ═════════════════════════════════════════════════════════════
  // 暴露接口
  // ═════════════════════════════════════════════════════════════

  CorruptionEngine.getGameMode = getGameMode;
  CorruptionEngine.getModeMultipliers = getModeMultipliers;
  CorruptionEngine.openJuanna = openJuanna;
  CorruptionEngine.closeJuanna = closeJuanna;
  CorruptionEngine.isAIAvailable = isAIAvailable;
  CorruptionEngine.enrichCaseWithAI = enrichCaseWithAI;
  CorruptionEngine.toggleMapCorruptionOverlay = toggleMapCorruptionOverlay;
  CorruptionEngine.updateRegionalCorruption = updateRegionalCorruption;
  CorruptionEngine.updateLeafCorruption = updateLeafCorruption;
  CorruptionEngine.getCorruptionColor = getCorruptionColor;
  CorruptionEngine.renderEditorPanel = renderEditorCorruptionPanel;
  CorruptionEngine.applyJuannaMonthly = applyJuannaMonthly;
  CorruptionEngine.aiPurgeAdvisor = aiPurgeAdvisor;

  console.log('[corruption-p4] 已加载：模式调节 / 轮换副作用 / 卖官 / AI增强 / 地图热力 / 编辑器面板');

})(typeof window !== 'undefined' ? window : this);
