// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-onboard-tools.js — Onboarding 演示 + 剧本校验 + 版本查询
 *
 * 合并三个小工具到一个文件：
 *   R80: TM.onboard()          新维护者 5 分钟演示
 *   R81: TM.validateScenario   剧本 JSON 结构校验
 *   R82: TM.version            index.html cache 版本号查询
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};

  // ============================================================
  // R80: TM.onboard — 新维护者 5 分钟演示
  // ============================================================
  if (!TM.onboard) {
    TM.onboard = function() {
      console.log('%c══════════════════════════════════════════════════════════', 'color:#e8c66e');
      console.log('%c  天命 · 维护者工具演示（5 步）', 'color:#e8c66e;font-size:14px;font-weight:bold');
      console.log('%c══════════════════════════════════════════════════════════', 'color:#e8c66e');

      console.log('\n%c第 1 步·查数据（DA.*）', 'color:#9ac870;font-weight:bold');
      try {
        var player = DA.chars.player();
        console.log('  DA.chars.player() →', player ? player.name : '(未开局)');
        console.log('  DA.turn.current() →', DA.turn.current());
        console.log('  DA.guoku.allStocks() →', DA.guoku.allStocks());
      } catch(e) { console.log('  (未开局或 DA 未就绪)'); }

      console.log('\n%c第 2 步·查不变量（TM.invariants）', 'color:#9ac870;font-weight:bold');
      try {
        var iv = TM.invariants.check();
        var color = iv.ok ? 'color:#7a7' : 'color:#c66';
        console.log('  %cstats: ' + iv.stats.passed + '/' + iv.stats.checked + ' passed', color);
        if (!iv.ok) iv.violations.slice(0, 3).forEach(function(v){ console.log('    ✗', v); });
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '异常') : console.log('  (异常)', e.message); }

      console.log('\n%c第 3 步·查错误（TM.errors）', 'color:#9ac870;font-weight:bold');
      try {
        var errs = TM.errors.getLog();
        console.log('  累计错误:', errs.length);
        if (errs.length > 0) {
          var sum = TM.errors.getSummary();
          console.log('  按模块:', Object.keys(sum).map(function(k){ return k + '(' + sum[k].count + ')'; }).join(' '));
          console.log('  详情请按 Ctrl+Shift+E 打开面板');
        }
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-onboard-tools');}catch(_){}}

      console.log('\n%c第 4 步·查性能（TM.perf）', 'color:#9ac870;font-weight:bold');
      try {
        var pr = TM.perf.report();
        var keys = Object.keys(pr);
        console.log('  已采样指标:', keys.length);
        if (keys.length > 0) {
          console.log('  详情请按 Ctrl+Shift+P 打开面板或用 TM.perf.print()');
        }
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-onboard-tools');}catch(_){}}

      console.log('\n%c第 5 步·跑测试（TM.test.run）', 'color:#9ac870;font-weight:bold');
      try {
        var suites = TM.test.listSuites();
        console.log('  已注册 ' + suites.length + ' 个 suite·执行 TM.test.run() 跑全部');
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-onboard-tools');}catch(_){}}

      console.log('\n%c══════════════════════════════════════════════════════════', 'color:#e8c66e');
      console.log('%c  更多工具：Ctrl+Shift+/ 速查卡  ·  Ctrl+Shift+D 仪表板', 'color:#888');
      console.log('%c══════════════════════════════════════════════════════════\n', 'color:#e8c66e');

      return {
        note: '演示完成·下一步建议：按 Ctrl+Shift+/ 打开速查卡 或 读 INDEX.md'
      };
    };
  }

  // ============================================================
  // R81: TM.scenarioSchema + TM.validateScenario — 剧本结构校验
  // ============================================================
  if (!TM.scenarioSchema) {
    // 剧本顶层必需/常见字段（基于 scenarios/tianqi7-1627.js 观察）
    var SCENARIO_SCHEMA = {
      required: ['id', 'name', 'era'],
      optional: [
        'dynasty', 'emperor', 'year', 'startYear', 'background', 'opening',
        'role', 'scnStyle', 'refText', 'customPrompt', 'winCond', 'loseCond',
        'suggestions', 'characters', 'factions', 'parties', 'classes', 'items',
        'military', 'techTree', 'civicTree', 'variables', 'rules', 'events',
        'timeline', 'map', 'worldSettings', 'government', 'adminHierarchy',
        'officeTree', 'authorityConfig', 'initialValues', 'resources',
        'fiscalConfig', 'currencyRules', 'populationConfig', 'environmentConfig',
        'openingEvents', 'openingLetters', 'isOpeningEvent', 'families',
        'regions', 'territories', 'relations', 'playerInfo',
        'aiAutoEnrich', 'isFullyDetailed'
      ],
      arrayTypes: [
        'characters', 'factions', 'parties', 'classes', 'items',
        'variables', 'rules', 'events', 'openingEvents', 'openingLetters',
        'families', 'regions', 'territories', 'relations', 'suggestions'
      ]
    };
    TM.scenarioSchema = SCENARIO_SCHEMA;

    TM.validateScenario = function(sc) {
      if (!sc || typeof sc !== 'object') {
        return { ok: false, errors: ['剧本不是对象'], warnings: [] };
      }
      var errors = [];
      var warnings = [];
      var stats = { knownFields: 0, unknownFields: 0 };

      // 必填检查
      SCENARIO_SCHEMA.required.forEach(function(f){
        if (sc[f] === undefined || sc[f] === null || sc[f] === '') {
          errors.push('[required] 缺少 ' + f);
        }
      });

      // 已知字段类型检查
      Object.keys(sc).forEach(function(k){
        if (k.charAt(0) === '_') return; // 跳过私有
        var isRequired = SCENARIO_SCHEMA.required.indexOf(k) >= 0;
        var isOptional = SCENARIO_SCHEMA.optional.indexOf(k) >= 0;
        if (isRequired || isOptional) {
          stats.knownFields++;
          // 数组字段类型检查
          if (SCENARIO_SCHEMA.arrayTypes.indexOf(k) >= 0) {
            if (!Array.isArray(sc[k])) {
              errors.push('[type] `' + k + '` 应为数组，实际 ' + typeof sc[k]);
            }
          }
        } else {
          stats.unknownFields++;
          warnings.push('[unknown] 未识别字段 `' + k + '`');
        }
      });

      // 数组元素必填检查
      if (Array.isArray(sc.characters)) {
        var noName = sc.characters.filter(function(c){ return !c || !c.name; }).length;
        if (noName > 0) warnings.push('[characters] ' + noName + ' 个角色缺 name');
      }
      if (Array.isArray(sc.factions)) {
        var noFacName = sc.factions.filter(function(f){ return !f || !f.name; }).length;
        if (noFacName > 0) warnings.push('[factions] ' + noFacName + ' 个势力缺 name');
      }

      // 玩家角色必须存在
      if (Array.isArray(sc.characters)) {
        var players = sc.characters.filter(function(c){ return c && c.isPlayer; });
        if (players.length === 0 && !sc.playerInfo) warnings.push('[player] 无 isPlayer 角色且无 playerInfo');
        if (players.length > 1) warnings.push('[player] ' + players.length + ' 个 isPlayer 角色（应只有 1 个）');
      }

      return {
        ok: errors.length === 0,
        errors: errors,
        warnings: warnings,
        stats: stats,
        scenarioId: sc.id || '(无 id)',
        scenarioName: sc.name || '(无 name)'
      };
    };

    /** 校验所有 P.scenarios */
    TM.validateAllScenarios = function() {
      if (typeof P === 'undefined' || !Array.isArray(P.scenarios)) {
        return { error: 'P.scenarios 未加载' };
      }
      var results = P.scenarios.map(function(sc, i){
        var r = TM.validateScenario(sc);
        r.index = i;
        return r;
      });
      var okCount = results.filter(function(r){ return r.ok; }).length;
      console.log('[scenario-check] ' + okCount + '/' + results.length + ' 通过');
      results.forEach(function(r){
        if (!r.ok || r.warnings.length > 0) {
          var color = r.ok ? 'color:#d99' : 'color:#c66';
          console.log('%c[' + r.index + '] ' + r.scenarioName + ': ' + r.errors.length + ' 错 / ' + r.warnings.length + ' 警', color);
          r.errors.forEach(function(e){ console.log('    ✗', e); });
          r.warnings.slice(0, 5).forEach(function(w){ console.log('    ⚠', w); });
        }
      });
      return { total: results.length, ok: okCount, results: results };
    };
  }

  // ============================================================
  // R82: TM.version — cache 版本号查询
  // ============================================================
  // 强制覆盖：某处可能把 TM.version 设为字符串（游戏版本号之类），会和我们的对象冲突
  // 检查 typeof 确保挂载 object 形态，保留旧字符串值到 TM._appVersion
  if (typeof TM.version !== 'object' || typeof TM.version.list !== 'function') {
    if (typeof TM.version === 'string') {
      TM._appVersion = TM.version;  // 保留可能的应用版本号字符串
    }
    TM.version = {
      /** 扫描 document 里所有 <script src="?v=xxx"> 的版本号 */
      list: function() {
        var scripts = document.querySelectorAll('script[src*="?v="]');
        var out = [];
        for (var i = 0; i < scripts.length; i++) {
          var src = scripts[i].getAttribute('src');
          var m = src.match(/^([^?]+)\?v=([^&]+)/);
          if (m) {
            out.push({ file: m[1], version: m[2] });
          }
        }
        return out;
      },
      /** 按日期分组汇总 */
      summary: function() {
        var list = TM.version.list();
        var byDate = {};
        list.forEach(function(e){
          // 版本号通常 yyyyMMdda 格式
          var m = e.version.match(/^(\d{8})([a-z]*)?/);
          var date = m ? m[1] : 'unknown';
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push(e);
        });
        return byDate;
      },
      /** 列出有多个版本号的文件（版本不同步嫌疑） */
      inconsistent: function() {
        var list = TM.version.list();
        var byFile = {};
        list.forEach(function(e){
          if (!byFile[e.file]) byFile[e.file] = [];
          if (byFile[e.file].indexOf(e.version) < 0) byFile[e.file].push(e.version);
        });
        var out = [];
        Object.keys(byFile).forEach(function(f){
          if (byFile[f].length > 1) out.push({ file: f, versions: byFile[f] });
        });
        return out;
      },
      /** 打印汇总报告 */
      report: function() {
        var list = TM.version.list();
        var summ = TM.version.summary();
        var inc = TM.version.inconsistent();
        console.log('[version] 共 ' + list.length + ' 个带版本号的 script');
        Object.keys(summ).sort().forEach(function(d){
          console.log('  ' + d + ': ' + summ[d].length + ' 文件');
        });
        if (inc.length > 0) {
          console.warn('[version] 版本号不一致的文件:');
          inc.forEach(function(i){
            console.warn('  ' + i.file + ': ' + i.versions.join(' / '));
          });
        } else {
          console.log('[version] 所有文件版本号一致 ✓');
        }
        return { total: list.length, byDate: summ, inconsistent: inc };
      }
    };
  }
})();
