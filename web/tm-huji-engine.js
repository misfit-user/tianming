// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-huji-engine.js — 户口引擎
 *
 * 实施以下 3 个设计文档：
 *  - 设计方案-在籍户口.md（八决策 + 七详方）
 *  - 设计方案-户口系统深化.md（模块 A/B/C/D）
 *  - 设计方案-户口系统深化·历史加固.md（历史预设）
 *
 * 核心内容：
 *  Ⅰ 户+口+丁 三元模型（丁年龄朝代可配）
 *  Ⅱ 色目户计 10 类（编户/军/匠/儒/僧道/乐/疍/奴婢/皇庄/投下）
 *  Ⅲ 户籍状态 5 态（黄籍/白籍/侨置/逃户/隐户）
 *  Ⅳ 户等制（唐9/宋5/明10/清无）
 *  Ⅴ 徭役 10 类细分 + 死亡率 + 逃役 + 折银
 *  Ⅵ 兵役 5 种（禁军/府兵/厢军/募兵/军户）
 *  Ⅶ 人口动态（出生/死亡/迁徙/饥荒/战争）
 *  Ⅷ 造册登记（黄册/白册/保甲）
 *
 * 25 大徭役预设 + 8 大卫所预设 + 6 大迁徙事件预设
 */
(function(global) {
  'use strict';

  function _populationSchemaFailure(code, field, value) {
    return { ok:false, code:code || 'invalid-population-value', field:field || '', value:value };
  }

  function _finiteNonNegativePopulation(value, field, options) {
    options = options || {};
    var candidate = value;
    if (typeof candidate === 'string') {
      if (options.allowLegacyNumericStrings !== true || candidate.trim() === '') {
        return _populationSchemaFailure('invalid-population-value', field, value);
      }
      candidate = Number(candidate);
    }
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) {
      return _populationSchemaFailure('invalid-population-value', field, value);
    }
    return { ok:true, value:Math.floor(candidate), changed:candidate !== value };
  }

  function _populationSchemaError(failure, source) {
    var error = new Error('人口 schema 无法安全迁移：' + failure.field);
    error.code = failure.code || 'population-schema-invalid';
    error.field = failure.field;
    error.value = failure.value;
    error.source = source || '';
    return error;
  }

  function _populationInitialDefaults(gm, p) {
    var config = p && p.populationConfig;
    if (!config && p && p.scenario && p.scenario.populationConfig) config = p.scenario.populationConfig;
    if (!config && typeof global.findScenarioById === 'function' && gm && gm.sid) {
      try {
        var scenario = global.findScenarioById(gm.sid);
        config = scenario && scenario.populationConfig;
      } catch (_) {}
    }
    return (config && config.initial && typeof config.initial === 'object') ? config.initial : {};
  }

  function _recordPopulationSchemaDiagnostics(gm, diagnostics) {
    if (!gm || !diagnostics || !diagnostics.length) return;
    if (!Array.isArray(gm._schemaNormalizationDiagnostics)) gm._schemaNormalizationDiagnostics = [];
    Array.prototype.push.apply(gm._schemaNormalizationDiagnostics, diagnostics.map(function(row) {
      return {
        turn:Number(gm.turn) || 0,
        field:row.field,
        action:row.action,
        source:row.source || 'population-schema'
      };
    }));
    if (gm._schemaNormalizationDiagnostics.length > 50) {
      gm._schemaNormalizationDiagnostics = gm._schemaNormalizationDiagnostics.slice(-50);
    }
  }

  function _normalizePopulationSchema(gm, options) {
    options = options || {};
    if (!gm || typeof gm !== 'object' || Array.isArray(gm)) {
      throw _populationSchemaError(_populationSchemaFailure('population-schema-invalid', 'GM', gm), options.source);
    }
    var diagnostics = [];
    var defaults = options.defaults || _populationInitialDefaults(gm, options.p);
    var population = gm.population;
    if (population === undefined || population === null) {
      population = gm.population = {};
      diagnostics.push({ field:'population', action:'default-object', source:options.source });
    } else if (typeof population !== 'object' || Array.isArray(population)) {
      throw _populationSchemaError(_populationSchemaFailure('population-schema-invalid', 'population', population), options.source);
    }

    var byCategory = population.byCategory;
    if (byCategory === undefined || byCategory === null) {
      byCategory = population.byCategory = {};
      diagnostics.push({ field:'population.byCategory', action:'default-object', source:options.source });
    } else if (typeof byCategory !== 'object' || Array.isArray(byCategory)) {
      throw _populationSchemaError(_populationSchemaFailure('population-schema-invalid', 'population.byCategory', byCategory), options.source);
    }

    var categoryMouths = 0;
    var categoryHouseholds = 0;
    var categoryKeys = Object.keys(byCategory);
    categoryKeys.forEach(function(key) {
      var row = byCategory[key];
      var baseField = 'population.byCategory.' + key;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw _populationSchemaError(_populationSchemaFailure('population-schema-invalid', baseField, row), options.source);
      }
      if (row.mouths === undefined || row.mouths === null) {
        row.mouths = 0;
        diagnostics.push({ field:baseField + '.mouths', action:'default-zero', source:options.source });
      } else {
        var mouthsResult = _finiteNonNegativePopulation(row.mouths, baseField + '.mouths', options);
        if (!mouthsResult.ok) throw _populationSchemaError(mouthsResult, options.source);
        if (row.mouths !== mouthsResult.value) {
          row.mouths = mouthsResult.value;
          diagnostics.push({ field:baseField + '.mouths', action:'normalize-number', source:options.source });
        }
      }
      categoryMouths += row.mouths;
      if (row.households !== undefined && row.households !== null) {
        var householdsResult = _finiteNonNegativePopulation(row.households, baseField + '.households', options);
        if (!householdsResult.ok) throw _populationSchemaError(householdsResult, options.source);
        if (row.households !== householdsResult.value) {
          row.households = householdsResult.value;
          diagnostics.push({ field:baseField + '.households', action:'normalize-number', source:options.source });
        }
        categoryHouseholds += row.households;
      }
    });

    var national = population.national;
    if (national === undefined || national === null) {
      national = population.national = {};
      diagnostics.push({ field:'population.national', action:'default-object', source:options.source });
    } else if (typeof national !== 'object' || Array.isArray(national)) {
      throw _populationSchemaError(_populationSchemaFailure('population-schema-invalid', 'population.national', national), options.source);
    }

    function normalizeRequired(target, key, field, fallback) {
      if (target[key] === undefined || target[key] === null) {
        var fallbackResult = _finiteNonNegativePopulation(fallback, field, { allowLegacyNumericStrings:true });
        target[key] = fallbackResult.ok ? fallbackResult.value : 0;
        diagnostics.push({ field:field, action:'default-number', source:options.source });
        return;
      }
      var result = _finiteNonNegativePopulation(target[key], field, options);
      if (!result.ok) throw _populationSchemaError(result, options.source);
      if (target[key] !== result.value) {
        target[key] = result.value;
        diagnostics.push({ field:field, action:'normalize-number', source:options.source });
      }
    }

    var fallbackMouths = categoryKeys.length ? categoryMouths : defaults.nationalMouths;
    normalizeRequired(national, 'mouths', 'population.national.mouths', fallbackMouths || 0);
    var fallbackHouseholds = categoryHouseholds || defaults.nationalHouseholds;
    if (fallbackHouseholds === undefined || fallbackHouseholds === null) {
      fallbackHouseholds = Math.floor(national.mouths / 5.2);
    }
    normalizeRequired(national, 'households', 'population.national.households', fallbackHouseholds);
    normalizeRequired(population, 'hiddenCount', 'population.hiddenCount', defaults.hiddenPopulation || 0);
    normalizeRequired(population, 'fugitives', 'population.fugitives', defaults.nationalFugitives || 0);
    _recordPopulationSchemaDiagnostics(gm, diagnostics);
    return { ok:true, population:population, diagnostics:diagnostics };
  }

  function _validatePopulationSchema(gm, options) {
    options = options || {};
    var failures = [];
    var population = gm && gm.population;
    if (!population || typeof population !== 'object' || Array.isArray(population)) {
      failures.push(_populationSchemaFailure('population-missing', 'population', population));
    } else {
      var national = population.national;
      if (!national || typeof national !== 'object' || Array.isArray(national)) {
        failures.push(_populationSchemaFailure('population-national-missing', 'population.national', national));
      } else {
        ['mouths', 'households'].forEach(function(key) {
          var result = _finiteNonNegativePopulation(national[key], 'population.national.' + key, options);
          if (!result.ok) failures.push(result);
        });
      }
      ['hiddenCount', 'fugitives'].forEach(function(key) {
        var result = _finiteNonNegativePopulation(population[key], 'population.' + key, options);
        if (!result.ok) failures.push(result);
      });
      if (!population.byCategory || typeof population.byCategory !== 'object' || Array.isArray(population.byCategory)) {
        failures.push(_populationSchemaFailure('population-categories-invalid', 'population.byCategory', population.byCategory));
      } else {
        Object.keys(population.byCategory).forEach(function(key) {
          var row = population.byCategory[key];
          if (!row || typeof row !== 'object' || Array.isArray(row)) {
            failures.push(_populationSchemaFailure('population-category-invalid', 'population.byCategory.' + key, row));
            return;
          }
          var result = _finiteNonNegativePopulation(row.mouths, 'population.byCategory.' + key + '.mouths', options);
          if (!result.ok) failures.push(result);
          if (row.households !== undefined && row.households !== null) {
            var householdsResult = _finiteNonNegativePopulation(
              row.households,
              'population.byCategory.' + key + '.households',
              options
            );
            if (!householdsResult.ok) failures.push(householdsResult);
          }
        });
      }
    }
    return { ok:failures.length === 0, population:failures.length ? null : population, failures:failures };
  }

  function _reportPopulationSchemaFailure(gm, operation, validation) {
    if (!validation || validation.ok) return;
    var first = validation.failures && validation.failures[0] || validation;
    var diagnostic = {
      turn:Number(gm && gm.turn) || 0,
      operation:String(operation || 'runtime'),
      code:first.code || 'population-schema-invalid',
      field:first.field || ''
    };
    if (gm) {
      if (!Array.isArray(gm._populationSchemaDiagnostics)) gm._populationSchemaDiagnostics = [];
      gm._populationSchemaDiagnostics.push(diagnostic);
      if (gm._populationSchemaDiagnostics.length > 50) gm._populationSchemaDiagnostics = gm._populationSchemaDiagnostics.slice(-50);
    }
    try {
      if (global.TM && global.TM.errors && typeof global.TM.errors.capture === 'function') {
        global.TM.errors.capture(_populationSchemaError(first, operation), 'population-schema.' + diagnostic.operation, diagnostic);
      }
    } catch (_) {}
  }

  function _transferCategoryPopulation(population, options) {
    options = options || {};
    if (!population || typeof population !== 'object' || Array.isArray(population) ||
        !population.byCategory || typeof population.byCategory !== 'object' || Array.isArray(population.byCategory)) {
      return _populationSchemaFailure('population-categories-invalid', 'population.byCategory', population && population.byCategory);
    }
    var from = String(options.from || '');
    var to = String(options.to || '');
    var sourceRow = population.byCategory[from];
    var targetRow = population.byCategory[to];
    if (!sourceRow || typeof sourceRow !== 'object' || Array.isArray(sourceRow)) {
      return _populationSchemaFailure('population-category-not-found', 'population.byCategory.' + from, sourceRow);
    }
    if (!targetRow || typeof targetRow !== 'object' || Array.isArray(targetRow)) {
      return _populationSchemaFailure('population-category-not-found', 'population.byCategory.' + to, targetRow);
    }
    var readOptions = { allowLegacyNumericStrings:options.allowLegacyNumericStrings === true };
    var source = _finiteNonNegativePopulation(sourceRow.mouths, 'population.byCategory.' + from + '.mouths', readOptions);
    var target = _finiteNonNegativePopulation(targetRow.mouths, 'population.byCategory.' + to + '.mouths', readOptions);
    var requested = _finiteNonNegativePopulation(options.count, 'count', readOptions);
    if (!source.ok || !target.ok || !requested.ok) {
      return {
        ok:false,
        code:'invalid-category-transfer-data',
        failures:[source, target, requested].filter(function(result) { return !result.ok; })
      };
    }
    if (from === to) return { ok:true, changed:false, requested:requested.value, actual:0, limitedBySource:false };
    var actual = Math.min(source.value, requested.value);
    sourceRow.mouths = source.value - actual;
    targetRow.mouths = target.value + actual;
    return {
      ok:true,
      changed:actual > 0,
      requested:requested.value,
      actual:actual,
      limitedBySource:actual < requested.value,
      from:from,
      to:to
    };
  }

  global.TM = global.TM || {};
  global.TM.PopulationSchema = {
    finiteNonNegative:_finiteNonNegativePopulation,
    normalize:_normalizePopulationSchema,
    validate:_validatePopulationSchema,
    reportRuntimeFailure:_reportPopulationSchemaFailure,
    transferCategory:_transferCategoryPopulation
  };

  // ═══════════════════════════════════════════════════════════════════
  //  朝代默认参数
  // ═══════════════════════════════════════════════════════════════════

  var DYNASTY_DING_AGE = {
    '汉':[15,56],'唐':[21,59],'宋':[20,60],'元':[20,59],'明':[16,60],'清':[16,60],'default':[16,60]
  };
  var DYNASTY_MOUTHS_PER_HOUSEHOLD = {
    '汉':5.8,'唐':5.3,'宋':5.2,'元':4.5,'明':5.0,'清':5.2,'default':5.0
  };
  var DYNASTY_DING_PER_MOUTHS = { 'default':0.30 };

  var DYNASTY_GRADE_SYSTEM = {
    '唐':'tang_9','宋':'song_5','明':'ming_10','清':'none','default':'tang_9'
  };

  // Ⅴ 徭役 10 类
  var CORVEE_TYPES = {
    junyi:      { name:'兵役',     daysPerDing:15, deathRate:0.02,  canCommute:false },
    gongyi:     { name:'工役',     daysPerDing:10, deathRate:0.008, canCommute:true },
    caoyi:      { name:'漕役',     daysPerDing:5,  deathRate:0.005, canCommute:true },
    zhuzao:     { name:'筑造',     daysPerDing:8,  deathRate:0.015, canCommute:true },
    tunken:     { name:'屯垦',     daysPerDing:12, deathRate:0.006, canCommute:false },
    yuanzheng:  { name:'远征劳役', daysPerDing:20, deathRate:0.04,  canCommute:false },
    yizhan:     { name:'驿站',     daysPerDing:6,  deathRate:0.003, canCommute:true },
    zahu:       { name:'杂户',     daysPerDing:5,  deathRate:0.002, canCommute:true },
    lingli:     { name:'吏力',     daysPerDing:3,  deathRate:0.001, canCommute:true },
    baojia:     { name:'保甲',     daysPerDing:2,  deathRate:0.0,   canCommute:false }
  };

  // Ⅱ 色目户计 10 类
  var CATEGORY_TEMPLATES = {
    bianhu:      { name:'编户',   taxExempt:false, corveeLevel:1.0, hereditary:false, socialClass:'common' },
    junhu:       { name:'军户',   taxExempt:true,  corveeLevel:0,   hereditary:true,  socialClass:'military', hereditaryMilitary:true },
    jianghu:     { name:'匠户',   taxExempt:true,  corveeLevel:0,   hereditary:true,  socialClass:'craft' },
    ruhu:        { name:'儒户',   taxExempt:false, corveeLevel:0.5, hereditary:false, socialClass:'gentry' },
    sengdao:     { name:'僧道户', taxExempt:true,  corveeLevel:0,   hereditary:false, socialClass:'religious' },
    yuehu:       { name:'乐户',   taxExempt:false, corveeLevel:1.0, hereditary:true,  socialClass:'debased' },
    danhu:       { name:'疍户',   taxExempt:false, corveeLevel:1.0, hereditary:true,  socialClass:'debased', regionRestricted:['南方'] },
    nubi:        { name:'奴婢',   taxExempt:true,  corveeLevel:0,   hereditary:true,  socialClass:'slave' },
    huangzhuang: { name:'皇庄',   taxExempt:true,  corveeLevel:0,   hereditary:false, socialClass:'imperial', belongsTo:'neicang' },
    touxia:      { name:'投下',   taxExempt:true,  corveeLevel:0,   hereditary:false, socialClass:'vassal',   belongsTo:'prince' }
  };

  // Ⅵ 兵役 5 类
  var MILITARY_TYPES = {
    jinjun:   { name:'禁军',   source:'募兵', paymentModel:'wage',  profession:true,  dynasties:['宋','明','清'] },
    fubing:   { name:'府兵',   source:'均田', paymentModel:'self',  profession:false, dynasties:['唐初','西魏','北周'] },
    xiangjun: { name:'厢军',   source:'签役', paymentModel:'grain', profession:false, dynasties:['宋'] },
    mubing:   { name:'募兵',   source:'自愿', paymentModel:'wage',  profession:true,  dynasties:['宋中晚','明','清晚'] },
    junhu:    { name:'军户',   source:'世袭', paymentModel:'tundian', profession:true, dynasties:['明','元'] },
    baqi:     { name:'八旗',   source:'世袭', paymentModel:'wage',  profession:true,  dynasties:['清'] },
    luying:   { name:'绿营',   source:'募兵', paymentModel:'wage',  profession:true,  dynasties:['清'] }
  };

  // 25 大徭役预设
  var LARGE_CORVEE_PRESETS = [
    { id:'qin_changcheng',    name:'秦筑长城',  dynasty:'秦',   duration:10, laborDemand:300000, deathRate:0.18, legitimacyImpact:-15, techBoost:{ defense:5 } },
    { id:'qin_afang',         name:'秦建阿房宫',dynasty:'秦',   duration:8,  laborDemand:700000, deathRate:0.25, legitimacyImpact:-30 },
    { id:'han_liuhuang',      name:'汉修河渠',  dynasty:'汉',   duration:5,  laborDemand:100000, deathRate:0.05, legitimacyImpact:0, techBoost:{ irrigation:8 } },
    { id:'sui_dayunhe',       name:'隋开大运河',dynasty:'隋',   duration:6,  laborDemand:500000, deathRate:0.15, legitimacyImpact:-20, techBoost:{ transport:10 } },
    { id:'tang_luoyang',      name:'唐营洛阳',  dynasty:'唐',   duration:3,  laborDemand:200000, deathRate:0.04, legitimacyImpact:5 },
    { id:'song_xiheyuan',     name:'宋浚黄河',  dynasty:'宋',   duration:4,  laborDemand:150000, deathRate:0.03, legitimacyImpact:8, techBoost:{ floodControl:6 } },
    { id:'yuan_dadou',        name:'元营大都',  dynasty:'元',   duration:8,  laborDemand:280000, deathRate:0.08, legitimacyImpact:0 },
    { id:'ming_changcheng',   name:'明重修长城',dynasty:'明',   duration:15, laborDemand:400000, deathRate:0.10, legitimacyImpact:-8, techBoost:{ defense:8 } },
    { id:'ming_yonglegong',   name:'明营永乐宫',dynasty:'明',   duration:4,  laborDemand:100000, deathRate:0.05, legitimacyImpact:3 },
    { id:'ming_zijincheng',   name:'明建紫禁城',dynasty:'明',   duration:14, laborDemand:200000, deathRate:0.06, legitimacyImpact:0 },
    { id:'ming_dayunhe',      name:'明疏通运河',dynasty:'明',   duration:6,  laborDemand:120000, deathRate:0.04, legitimacyImpact:5, techBoost:{ transport:5 } },
    { id:'qing_yuanmingyuan', name:'清营圆明园',dynasty:'清',   duration:30, laborDemand:80000,  deathRate:0.02, legitimacyImpact:-5 },
    { id:'qing_chengde',      name:'清建承德',  dynasty:'清',   duration:20, laborDemand:60000,  deathRate:0.02, legitimacyImpact:-2 },
    { id:'qing_zhihe',        name:'清治河',    dynasty:'清',   duration:6,  laborDemand:80000,  deathRate:0.03, legitimacyImpact:6, techBoost:{ floodControl:4 } },
    { id:'tang_shuifa',       name:'唐修水利',  dynasty:'唐',   duration:3,  laborDemand:80000,  deathRate:0.02, legitimacyImpact:5, techBoost:{ irrigation:5 } },
    { id:'song_xiyi',         name:'宋修西夷军寨',dynasty:'宋', duration:4,  laborDemand:60000,  deathRate:0.05, legitimacyImpact:-2 },
    { id:'tang_jiangling',    name:'唐修江陵城',dynasty:'唐',   duration:2,  laborDemand:50000,  deathRate:0.03, legitimacyImpact:2 },
    { id:'song_jiangnan_yun', name:'宋营江南运河',dynasty:'宋', duration:5,  laborDemand:70000,  deathRate:0.03, legitimacyImpact:5, techBoost:{ transport:4 } },
    { id:'ming_junzhen',      name:'明建军镇',  dynasty:'明',   duration:8,  laborDemand:150000, deathRate:0.06, legitimacyImpact:-3, techBoost:{ defense:6 } },
    { id:'qing_xibei_tun',    name:'清新疆屯田',dynasty:'清',   duration:10, laborDemand:80000,  deathRate:0.04, legitimacyImpact:5 },
    { id:'han_changan_water', name:'汉修长安漕渠',dynasty:'汉', duration:4,  laborDemand:90000,  deathRate:0.035,legitimacyImpact:4, techBoost:{ irrigation:5, transport:3 } },
    { id:'sui_luoyang_city',  name:'隋营东都洛阳',dynasty:'隋', duration:5,  laborDemand:300000, deathRate:0.12, legitimacyImpact:-18, techBoost:{ transport:4 } },
    { id:'tang_bianqu_repair',name:'唐修汴渠', dynasty:'唐',   duration:3,  laborDemand:70000,  deathRate:0.025,legitimacyImpact:3, techBoost:{ transport:5, floodControl:3 } },
    { id:'song_bianliang_dike',name:'宋筑汴梁堤防',dynasty:'宋',duration:4, laborDemand:90000, deathRate:0.035,legitimacyImpact:4, techBoost:{ floodControl:5 } },
    { id:'ming_liaodong_wall',name:'明筑辽东边墙',dynasty:'明', duration:7,  laborDemand:180000, deathRate:0.07, legitimacyImpact:-4, techBoost:{ defense:7 } }
  ];

  // 8 大卫所预设
  var GARRISON_PRESETS = [
    { id:'shanhaiguan', name:'山海关',  region:'辽东', strength:30000, role:'关防' },
    { id:'jiayuguan',   name:'嘉峪关',  region:'河西', strength:15000, role:'关防' },
    { id:'nanjing_wei', name:'南京卫',  region:'江南', strength:50000, role:'京畿' },
    { id:'liaodong_du', name:'辽东都司',region:'辽东', strength:100000,role:'边防' },
    { id:'yunnan_wei',  name:'云南卫',  region:'云南', strength:60000, role:'边疆' },
    { id:'xiangyang',   name:'襄阳卫',  region:'荆湖', strength:25000, role:'腹地' },
    { id:'guangdong',   name:'广东都司',region:'岭南', strength:40000, role:'海防' },
    { id:'sichuan',     name:'四川都司',region:'四川', strength:30000, role:'山防' }
  ];

  // 6 大迁徙事件
  var MIGRATION_EVENTS = [
    { id:'yongjia_nandu',  name:'永嘉南渡', century:4,  scale:1000000, fromRegion:'中原', toRegion:'江南' },
    { id:'anshi_nanbian',  name:'安史南迁', century:8,  scale:2000000, fromRegion:'河北', toRegion:'江南' },
    { id:'jingkang_nandu', name:'靖康南迁', century:12, scale:5000000, fromRegion:'中原', toRegion:'江南' },
    { id:'mingchu_yi',     name:'明初迁徙', century:14, scale:3000000, fromRegion:'山西', toRegion:'华北' },
    { id:'huguang_tian',   name:'湖广填四川',century:17,scale:2000000, fromRegion:'湖广', toRegion:'四川' },
    { id:'chuang_guandong',name:'闯关东',   century:19, scale:8000000, fromRegion:'山东', toRegion:'东北' }
  ];
  // 迁徙预设是进程级常量，不得承载某一战役的触发状态。
  // 旧实现向预设写 _triggered，导致同进程跨档抑制、重启后重复触发。
  if (typeof Object.freeze === 'function') {
    MIGRATION_EVENTS.forEach(function(eventPreset) { Object.freeze(eventPreset); });
    Object.freeze(MIGRATION_EVENTS);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

  function _initialPopulationNumber(value, fallback, field) {
    if (value === undefined || value === null) return Math.floor(Number(fallback) || 0);
    var schema = global.TM && global.TM.PopulationSchema;
    var result = schema && typeof schema.finiteNonNegative === 'function'
      ? schema.finiteNonNegative(value, field, { allowLegacyNumericStrings: true })
      : { ok: typeof value === 'number' && Number.isFinite(value) && value >= 0, value: Math.floor(Number(value)) };
    if (!result.ok) {
      var error = new Error('户籍初始人口字段非法：' + field);
      error.code = 'population-schema-invalid';
      error.field = field;
      throw error;
    }
    return result.value;
  }

  function _normalizePopulationBoundary(G, source, sc) {
    var schema = global.TM && global.TM.PopulationSchema;
    if (!schema || typeof schema.normalize !== 'function') return null;
    return schema.normalize(G, {
      source: source,
      allowLegacyNumericStrings: true,
      defaults: sc && sc.populationConfig && sc.populationConfig.initial || {}
    });
  }

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    if (G.population && G.population._inited) {
      // 补齐缺失字段
      if (!G.population.byCategory) G.population.byCategory = {};
      if (!G.population.byLegalStatus) G.population.byLegalStatus = {};
      if (!G.population.byRegion) G.population.byRegion = {};
      if (!G.population.dynamics) G.population.dynamics = _defaultDynamics();
      if (!G.population.corvee) G.population.corvee = _defaultCorvee();
      if (!G.population.military) G.population.military = _defaultMilitary();
      if (!G.population.meta) G.population.meta = _defaultMeta();
      if (!Array.isArray(G.population.migrationEvents)) G.population.migrationEvents = []; // arch-ok: 户籍权威写口迁移战役事件账本
      if (!G.population.migrationEventStates || typeof G.population.migrationEventStates !== 'object' || Array.isArray(G.population.migrationEventStates)) {
        G.population.migrationEventStates = {}; // arch-ok: 户籍权威写口迁移战役事件状态
      }
      if (!Array.isArray(G.population.triggeredMigrationEventIds)) G.population.triggeredMigrationEventIds = []; // arch-ok: 户籍权威写口迁移已触发事件集合
      G.population.migrationEvents.forEach(function(record) {
        if (!record || !record.id) return;
        if (G.population.triggeredMigrationEventIds.indexOf(record.id) < 0) G.population.triggeredMigrationEventIds.push(record.id); // arch-ok: 户籍权威写口迁移已触发事件集合
        if (!G.population.migrationEventStates[record.id]) {
          G.population.migrationEventStates[record.id] = { status:'triggered', turn:record.turn, scale:record.scale }; // arch-ok: 户籍权威写口迁移事件状态
        }
      });
      _ensureDeepDemographics(G.population);
      _normalizePopulationBoundary(G, 'huji-existing-world', sc);
      return;
    }

    var dynasty = _inferDynasty(sc);
    var config = (sc && sc.populationConfig) || {};

    var initial = config.initial || {};
    var households = _initialPopulationNumber(initial.nationalHouseholds, 1000000, 'populationConfig.initial.nationalHouseholds');
    var mouthsPerHh = DYNASTY_MOUTHS_PER_HOUSEHOLD[dynasty] || DYNASTY_MOUTHS_PER_HOUSEHOLD.default;
    var mouths = _initialPopulationNumber(initial.nationalMouths, Math.round(households * mouthsPerHh), 'populationConfig.initial.nationalMouths');
    var dingRatio = DYNASTY_DING_PER_MOUTHS[dynasty] || DYNASTY_DING_PER_MOUTHS.default;
    var ding = _initialPopulationNumber(initial.nationalDing, Math.round(mouths * dingRatio), 'populationConfig.initial.nationalDing');

    var dingAge = config.dingAgeRange || DYNASTY_DING_AGE[dynasty] || DYNASTY_DING_AGE.default;

    G.population = {
      _inited: true,
      dynasty: dynasty,
      national: { households: households, mouths: mouths, ding: ding },
      byCategory: _initByCategory(config, households, mouths, ding),
      byLegalStatus: _initByLegalStatus(households, mouths, ding),
      gradeSystem: config.gradeSystem || DYNASTY_GRADE_SYSTEM[dynasty] || DYNASTY_GRADE_SYSTEM.default,
      byGrade: {},
      byRegion: _initByRegion(config, households, mouths, ding),
      dynamics: _defaultDynamics(),
      corvee: _initCorvee(config, dingAge, dynasty),
      military: _initMilitary(config, dynasty),
      meta: _initMeta(config, dynasty),
      fugitives: 0,
      hiddenCount: 0,
      largeCorveeActive: [],    // 正在进行的大徭役
      garrisons: [],            // 卫所
      migrationEvents: [],      // 已成功触发的迁徙事件
      migrationEventStates: {}, // 战役内的 pending/triggered 状态
      triggeredMigrationEventIds: []
    };
    _ensureDeepDemographics(G.population);
    _normalizePopulationBoundary(G, 'huji-new-game', sc);
  }

  function _inferDynasty(sc) {
    if (!sc) return 'default';
    var name = (sc.name || sc.dynasty || '').toString();
    var keys = Object.keys(DYNASTY_DING_AGE).filter(function(k) { return k !== 'default'; });
    for (var i = 0; i < keys.length; i++) {
      if (name.indexOf(keys[i]) >= 0) return keys[i];
    }
    return 'default';
  }

  function _initByCategory(config, households, mouths, ding) {
    var out = {};
    var enabled = (config.categoryEnabled || ['bianhu','junhu','jianghu','sengdao','yuehu']);
    // 编户是主力（80-90%）
    var remaining = { households: households, mouths: mouths, ding: ding };
    enabled.forEach(function(cat) {
      if (!CATEGORY_TEMPLATES[cat]) return;
      var tmpl = CATEGORY_TEMPLATES[cat];
      var share = cat === 'bianhu' ? 0.85 : 0.03;
      if (cat === 'junhu') share = 0.05;
      if (cat === 'jianghu') share = 0.02;
      if (cat === 'sengdao') share = 0.02;
      if (cat === 'yuehu') share = 0.005;
      if (cat === 'nubi') share = 0.03;
      if (cat === 'huangzhuang') share = 0.005;
      var h = Math.round(households * share);
      var m = Math.round(mouths * share);
      var d = Math.round(ding * share);
      out[cat] = Object.assign({}, tmpl, { households: h, mouths: m, ding: d });
    });
    return out;
  }

  function _initByLegalStatus(households, mouths, ding) {
    return {
      huangji:  { households: Math.round(households * 0.90), mouths: Math.round(mouths * 0.90), ding: Math.round(ding * 0.90) },
      baiji:    { households: Math.round(households * 0.05), mouths: Math.round(mouths * 0.05), ding: Math.round(ding * 0.05) },
      qiaozhi:  { households: 0, mouths: 0, ding: 0, qiaoFrom: {} },
      taoohu:   { households: Math.round(households * 0.03), mouths: Math.round(mouths * 0.03), ding: Math.round(ding * 0.03), taoFromRegion: {} },
      yinhu:    { households: Math.round(households * 0.02), mouths: Math.round(mouths * 0.02), ding: Math.round(ding * 0.02), harboredBy: {} }
    };
  }

  function _initByRegion(config, totalH, totalM, totalD) {
    var out = {};
    var regions = (global.GM && global.GM.regions) || [];
    var initRegionData = config.initial && config.initial.byRegion;
    if (initRegionData) {
      Object.keys(initRegionData).forEach(function(rid) {
        out[rid] = Object.assign(_defaultRegionPop(), initRegionData[rid]);
      });
      return out;
    }
    // 按区域均摊
    if (regions.length > 0) {
      var weight = 1.0 / regions.length;
      regions.forEach(function(r) {
        if (!r || !r.id) return;
        out[r.id] = _defaultRegionPop();
        out[r.id].households = Math.round(totalH * weight);
        out[r.id].mouths = Math.round(totalM * weight);
        out[r.id].ding = Math.round(totalD * weight);
      });
    }
    return out;
  }

  function _defaultRegionPop() {
    return {
      households: 0, mouths: 0, ding: 0,
      byCategory: {}, byLegalStatus: {}, byGrade: {},
      fugitives: 0, hidden: 0,
      corveeAvailable: 0, militaryEligible: 0,
      yearlyBirths: 0, yearlyDeaths: 0, yearlyNetMigration: 0,
      // 深化模块：族群/宗教/保甲/里甲
      byAge: {}, byGender: {}, byEthnicity: {}, byFaith: {},
      ethnicity: { han:0.95, other:0.05 },
      religion: { confucian:0.6, buddhist:0.2, taoist:0.15, other:0.05 },
      baojiaUnits: 0, lijiaUnits: 0,
      // 深化模块：屯田/卫所/羁縻
      tunTianAcres: 0, garrisonStrength: 0, jimiAutonomy: 0
    };
  }

  function _sumObj(obj) {
    var total = 0;
    Object.keys(obj || {}).forEach(function(k) {
      var v = Number(obj[k]);
      if (isFinite(v)) total += v;
    });
    return total;
  }

  // 将一个非负整数按权重精确分配；任何时候分项之和都严格等于 total。
  // limits 可选，用于“从现有存量中扣除”这类不能超过各项库存的场景。
  function _allocateExactIntegers(total, weights, limits) {
    total = Math.max(0, Math.round(Number(total) || 0));
    weights = Array.isArray(weights) ? weights.map(function(value) {
      return Math.max(0, Number(value) || 0);
    }) : [];
    limits = Array.isArray(limits) ? limits.map(function(value) {
      return Math.max(0, Math.round(Number(value) || 0));
    }) : null;
    var out = weights.map(function() { return 0; });
    if (!weights.length || !total) return out;
    if (limits) {
      var capacity = limits.reduce(function(sum, value) { return sum + value; }, 0);
      total = Math.min(total, capacity);
    }
    var weightTotal = weights.reduce(function(sum, value, index) {
      if (limits && limits[index] <= 0) return sum;
      return sum + value;
    }, 0);
    if (!(weightTotal > 0)) {
      weights = weights.map(function(_, index) { return !limits || limits[index] > 0 ? 1 : 0; });
      weightTotal = weights.reduce(function(sum, value) { return sum + value; }, 0);
    }
    var ranked = [];
    var assigned = 0;
    weights.forEach(function(weight, index) {
      var quota = weightTotal > 0 ? total * weight / weightTotal : 0;
      var value = Math.floor(quota);
      if (limits) value = Math.min(value, limits[index]);
      out[index] = value;
      assigned += value;
      ranked.push({ index:index, fraction:quota - Math.floor(quota) });
    });
    ranked.sort(function(a, b) { return b.fraction - a.fraction || a.index - b.index; });
    var remaining = total - assigned;
    while (remaining > 0) {
      var progressed = false;
      for (var i = 0; i < ranked.length && remaining > 0; i++) {
        var index = ranked[i].index;
        if (limits && out[index] >= limits[index]) continue;
        out[index]++;
        remaining--;
        progressed = true;
      }
      if (!progressed) break;
    }
    return out;
  }

  function _maxShare(obj) {
    var total = _sumObj(obj);
    var max = 0;
    Object.keys(obj || {}).forEach(function(k) {
      var v = Number(obj[k]);
      if (isFinite(v)) max = Math.max(max, v);
    });
    if (total <= 1.5) return Math.max(0, Math.min(1, max));
    return max / Math.max(1, total);
  }

  function _scaleBucketsToTotal(obj, total, template) {
    obj = obj || {};
    total = Math.max(0, Math.round(total || 0));
    var keys = Object.keys(template || {});
    Object.keys(obj || {}).forEach(function(key) {
      if (keys.indexOf(key) < 0) keys.push(key);
    });
    if (!keys.length) return {};
    var current = _sumObj(obj);
    var weights = {};
    var weightTotal = 0;
    keys.forEach(function(key) {
      var weight = current > 0 ? Math.max(0, Number(obj[key]) || 0) : Math.max(0, Number(template && template[key]) || 0);
      weights[key] = weight;
      weightTotal += weight;
    });
    if (!(weightTotal > 0)) {
      keys.forEach(function(key) { weights[key] = key === keys[0] ? 1 : 0; });
      weightTotal = 1;
    }
    var out = {};
    var assigned = 0;
    var ranked = [];
    keys.forEach(function(key, index) {
      var quota = total * weights[key] / weightTotal;
      var value = Math.floor(quota);
      out[key] = value;
      assigned += value;
      ranked.push({ key:key, fraction:quota - value, index:index });
    });
    ranked.sort(function(a, b) { return b.fraction - a.fraction || a.index - b.index; });
    for (var remaining = total - assigned, i = 0; remaining > 0; remaining--, i++) {
      out[ranked[i % ranked.length].key]++;
    }
    return out;
  }

  var AGE_BUCKET_TEMPLATE = {
    age_0_10:0.20, age_11_20:0.18, age_21_30:0.15, age_31_40:0.13,
    age_41_50:0.11, age_51_60:0.10, age_61_70:0.08, age_71_plus:0.05
  };
  var GENDER_BUCKET_TEMPLATE = { male:0.52, female:0.48 };

  function _ensureRegionDeepFields(r) {
    if (!r) return;
    var mouths = Math.max(0, Math.round(r.mouths || 0));
    r.byAge = _scaleBucketsToTotal(r.byAge || r.ageLayers, mouths, AGE_BUCKET_TEMPLATE);
    var gender = r.byGender || r.gender || {};
    r.byGender = _scaleBucketsToTotal(gender, mouths, GENDER_BUCKET_TEMPLATE);
    if (!r.byEthnicity || !Object.keys(r.byEthnicity).length) r.byEthnicity = Object.assign({}, r.ethnicity || { han:0.95, other:0.05 });
    if (!r.byFaith || !Object.keys(r.byFaith).length) r.byFaith = Object.assign({}, r.religion || r.byReligion || { confucian:0.6, buddhist:0.2, taoist:0.15, folk:0.05 });
    r.ethnicity = Object.assign({}, r.byEthnicity);
    r.religion = Object.assign({}, r.byFaith);
    if (typeof r.baojiaUnits !== 'number') r.baojiaUnits = Math.max(0, Math.round((r.households || 0) / 10 * 0.2));
    if (typeof r.lijiaUnits !== 'number') r.lijiaUnits = Math.max(0, Math.round((r.households || 0) / 110 * 0.2));
  }

  function _computeDeepServiceDing(P) {
    if (!P || !P.byRegion) return P && P.national ? P.national.ding || 0 : 0;
    var total = 0;
    Object.keys(P.byRegion).forEach(function(rid) {
      var r = P.byRegion[rid];
      _ensureRegionDeepFields(r);
      var age = r.byAge || {};
      var gender = r.byGender || {};
      var genderTotal = Math.max(1, _sumObj(gender));
      var maleShare = Math.max(0.25, Math.min(0.75, (gender.male || genderTotal * 0.52) / genderTotal));
      var serviceAge = (age.age_21_30 || 0) + (age.age_31_40 || 0) + (age.age_41_50 || 0) + (age.age_51_60 || 0) + (age.age_11_20 || 0) * 0.4;
      total += serviceAge * maleShare * 0.85;
    });
    return Math.max(0, Math.round(Math.min(P.national.ding || total, total)));
  }

  function _ensureDeepDemographics(P) {
    if (!P) return;
    Object.keys(P.byRegion || {}).forEach(function(rid) { _ensureRegionDeepFields(P.byRegion[rid]); });
    var byAge = {}, byGender = {}, ledger = [];
    Object.keys(P.byRegion || {}).forEach(function(rid) {
      var r = P.byRegion[rid];
      Object.keys(r.byAge || {}).forEach(function(k) { byAge[k] = (byAge[k] || 0) + (r.byAge[k] || 0); });
      Object.keys(r.byGender || {}).forEach(function(k) { byGender[k] = (byGender[k] || 0) + (r.byGender[k] || 0); });
    });
    if (!Object.keys(byAge).length && P.national) {
      byAge = _scaleBucketsToTotal({}, P.national.mouths || 0, AGE_BUCKET_TEMPLATE);
      byGender = _scaleBucketsToTotal({}, P.national.mouths || 0, GENDER_BUCKET_TEMPLATE);
    }
    P.byAge = byAge;
    P.byGender = byGender;
    if (!P.deepFieldEffects) P.deepFieldEffects = {};
    P.deepFieldEffects.serviceAgeDing = _computeDeepServiceDing(P);
    if (!Array.isArray(P.deepFieldEffects.ledger)) P.deepFieldEffects.ledger = ledger;
  }

  function _defaultDynamics() {
    return {
      birthRateBase: 0.035, deathRateBase: 0.025,
      prosperityBonus: 0, agingPenalty: 0,
      diseaseBoost: 0, famineBoost: 0, warBoost: 0,
      migrationFlow: {},
      lastYearNet: 0, yearlyLog: []
    };
  }

  function _defaultCorvee() {
    var byType = {};
    Object.keys(CORVEE_TYPES).forEach(function(k) {
      byType[k] = {
        daysPerDing: CORVEE_TYPES[k].daysPerDing,
        totalDays: 0, fulfilled: 0, commutedRate: 0, deaths: 0,
        currentYearDays: 0, currentYearFulfilled: 0, currentYearDeaths: 0
      };
    });
    return {
      enabled: true,
      dingAgeMin: 16, dingAgeMax: 60,
      annualCorveeDays: 30,
      byType: byType,
      exemptions: [
        { group:'官员', multiplier:0 },
        { group:'僧道', multiplier:0 },
        { group:'生员', multiplier:0.5 },
        { group:'军户', multiplier:0 },
        { group:'孝廉', multiplier:0.3 }
      ],
      commutationRate: 0.5,
      fullyCommuted: false,
      proxyRate: 0,
      burdenThreshold: 0.40,
      currentYear: null,
      currentYearBurden: 0
    };
  }

  function _initCorvee(config, dingAge, dynasty) {
    var c = _defaultCorvee();
    c.dingAgeMin = dingAge[0];
    c.dingAgeMax = dingAge[1];
    if (config.corveeRules) Object.assign(c, config.corveeRules);
    // 清雍正摊丁入亩后役银合一
    if (dynasty === '清') c.fullyCommuted = true;
    return c;
  }

  function _defaultMilitary() {
    var types = {};
    Object.keys(MILITARY_TYPES).forEach(function(k) {
      types[k] = { strength: 0, source: MILITARY_TYPES[k].source, yearlyQuota: 0, paymentModel: MILITARY_TYPES[k].paymentModel, enabled: false };
    });
    return { enabled: true, types: types, totalPool: 0, maxExpansionRate: 0.1, casualties: { yearly: 0, cumulative: 0 } };
  }

  function _initMilitary(config, dynasty) {
    var m = _defaultMilitary();
    // 朝代启用对应兵种
    Object.keys(MILITARY_TYPES).forEach(function(k) {
      var t = MILITARY_TYPES[k];
      if (t.dynasties && t.dynasties.some(function(d) { return d.indexOf(dynasty) >= 0 || dynasty.indexOf(d) >= 0; })) {
        m.types[k].enabled = true;
      }
    });
    if (config.militaryRules) Object.assign(m, config.militaryRules);
    return m;
  }

  function _defaultMeta() {
    return {
      registrationCycle: 10,
      lastRegistrationTurn: 0,
      registrationAccuracy: 0.85,
      registrationCost: { money: 0, grain: 0 },
      minimumPopulation: 0
    };
  }

  function _initMeta(config, dynasty) {
    var m = _defaultMeta();
    if (dynasty === '明') m.registrationCycle = 10;
    else if (dynasty === '清') m.registrationCycle = 5;
    else if (dynasty === '汉') m.registrationCycle = 1;
    else if (dynasty === '唐') m.registrationCycle = 3;
    return m;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅶ 人口动态
  // ═══════════════════════════════════════════════════════════════════

  function _tickPopulationDynamics(ctx, mr) {
    var P = global.GM.population;
    if (!P) return;
    _ensureDeepDemographics(P);
    // 行政区叶子是人口运行态的唯一真值。无论是否启用“自下而上”细算，
    // 只要叶级户口存在，都必须在叶子上推进；否则先改 national/byRegion，
    // 随后的 runtime bridge 又从未变化的叶子重建全国账，会把本次增长抹掉。
    // 选项只决定是否采用地方民心/粮食/灾异修正，不再决定写入哪套账。
    var groups = _factionLeafGroups(global.GM);
    var leaves = _allLeafDivisions(global.GM, groups);
    var hasLeafPopulation = leaves.some(function(leaf) {
      return !!(leaf && leaf.populationDetail && Number(leaf.populationDetail.mouths) > 0);
    });
    if (hasLeafPopulation) {
      var useLocalFactors = !!(global.P && global.P.conf && global.P.conf.populationBottomUpEnabled);
      return _tickPopulationLeafGrowth(ctx, mr, useLocalFactors, groups);
    }
    var d = P.dynamics;
    // 年景因子
    var G = global.GM;
    var environmentLoad = (G.environment && G.environment.nationalLoad) || 0.5;
    var disaster = (G.vars && G.vars.disasterLevel) || 0;
    var war = (G.activeWars || []).length;
    // 出生率
    var birthRate = d.birthRateBase + (d.prosperityBonus || 0) - Math.max(0, environmentLoad - 1) * 0.005;
    if (disaster > 0.3) birthRate -= 0.01;
    // 死亡率
    var deathRate = d.deathRateBase + (d.agingPenalty || 0) + (d.diseaseBoost || 0);
    if (disaster > 0.3) deathRate += disaster * 0.05;
    if (war > 0) deathRate += Math.min(0.03, war * 0.01);
    if (environmentLoad > 1.2) deathRate += (environmentLoad - 1.2) * 0.02;
    // 年度净增长 → 月度化
    var oldMouths = Number(P.national.mouths) || 0;
    var oldHouseholds = Number(P.national.households) || 0;
    var oldDing = Number(P.national.ding) || 0;
    var dingRatio = oldDing / Math.max(1, oldMouths);
    var mphh = oldMouths / Math.max(1, oldHouseholds);
    var births = Math.round(oldMouths * birthRate * mr / 12);
    var deaths = Math.round(oldMouths * deathRate * mr / 12);
    var net = births - deaths;
    P.national.mouths = Math.max(_minimumPopulation(P), oldMouths + net);
    // 丁同比变化
    P.national.ding = Math.round(P.national.mouths * dingRatio);
    // 户同比变化
    P.national.households = Math.round(P.national.mouths / mphh);
    // 按区域分配同比
    Object.keys(P.byRegion || {}).forEach(function(rid) {
      var r = P.byRegion[rid];
      var regWeight = r.mouths / Math.max(1, P.national.mouths - net);
      r.yearlyBirths = (r.yearlyBirths || 0) + births * regWeight;
      r.yearlyDeaths = (r.yearlyDeaths || 0) + deaths * regWeight;
      r.mouths = Math.max(0, r.mouths + Math.round(net * regWeight));
      r.households = Math.round(r.mouths / mphh);
      r.ding = Math.round(r.mouths * dingRatio);
    });
    // 年度日志（每 12 回合写一条，兼容任意 daysPerTurn）
    if (!d._yearlyAccumBirths) d._yearlyAccumBirths = 0;
    if (!d._yearlyAccumDeaths) d._yearlyAccumDeaths = 0;
    d._yearlyAccumBirths += births;
    d._yearlyAccumDeaths += deaths;
    if (!d._lastLogTurn) d._lastLogTurn = ctx.turn || 0;
    var yearlyLogTurns = (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(12) : 12;
    if (((ctx.turn || 0) - d._lastLogTurn) >= yearlyLogTurns) {
      var logYear = (typeof global.calcDateFromTurn === 'function') ? global.calcDateFromTurn(ctx.turn || 1).adYear
        : ((G.year || ((global.P && global.P.time && global.P.time.year) || 0)) + Math.floor(Math.max(0, (ctx.turn || 1) - 1) * ((typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30) / 365));
      d.yearlyLog.push({ year: logYear, birth: d._yearlyAccumBirths, death: d._yearlyAccumDeaths, net: d._yearlyAccumBirths - d._yearlyAccumDeaths });
      if (d.yearlyLog.length > 50) d.yearlyLog.splice(0, d.yearlyLog.length - 50);
      d._lastLogTurn = ctx.turn || 0;
      d._yearlyAccumBirths = 0;
      d._yearlyAccumDeaths = 0;
    }
    d.lastYearNet = _annualizePopulationNet(net, mr);
  }

  function _annualizePopulationNet(net, monthRatio) {
    var mr = Number(monthRatio);
    return mr > 0 && isFinite(mr) ? net * 12 / mr : net * 12;
  }

  function _minimumPopulation(P) {
    var configured = Number(P && P.meta && P.meta.minimumPopulation);
    return configured >= 0 && isFinite(configured) ? configured : 0;
  }

  function _walkAdminLeaves(nodes, out, seen) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node) {
      if (!node || typeof node !== 'object') return;
      if (seen && seen.indexOf(node) >= 0) return;
      if (seen) seen.push(node);
      var childGroups = [node.children, node.divisions, node.subdivisions, node.subs]
        .filter(function(children, index, all) {
          return Array.isArray(children) && children.length && all.indexOf(children) === index;
        });
      if (childGroups.length) {
        childGroups.forEach(function(children) { _walkAdminLeaves(children, out, seen); });
      } else out.push(node);
    });
  }

  function _normPopulationName(value) {
    return String(value == null ? '' : value).replace(/[\s·（）()\-—_]/g, '').toLowerCase();
  }

  function _playerPopulationAliases(G) {
    var aliases = [];
    function add(value) {
      var normalized = _normPopulationName(value);
      if (normalized && aliases.indexOf(normalized) < 0) aliases.push(normalized);
    }
    add(global.P && global.P.playerInfo && global.P.playerInfo.factionId);
    add(global.P && global.P.playerInfo && global.P.playerInfo.factionName);
    add(global.P && global.P.playerFactionId);
    add(global.P && global.P.playerFaction);
    add(G && G.playerFactionId);
    add(G && G.playerFaction);
    (G && Array.isArray(G.facs) ? G.facs : []).forEach(function(faction) {
      if (faction && faction.isPlayer) {
        add(faction.id); add(faction.name); add(faction.key); add(faction.factionName);
      }
    });
    return aliases;
  }

  function _hasExplicitPlayerIdentity(G, hierarchy) {
    if (!hierarchy || typeof hierarchy !== 'object') return false;
    if (Array.isArray(hierarchy.divisions)) return true;
    var branchKeys = Object.keys(hierarchy).filter(function(key) {
      var branch = hierarchy[key];
      return Array.isArray(branch) || (branch && Array.isArray(branch.divisions));
    });
    if (!branchKeys.length) return false;
    if (Object.prototype.hasOwnProperty.call(hierarchy, 'player')) return true;
    return _playerPopulationAliases(G).length > 0;
  }

  function _playerAdminKey(G, hierarchy) {
    if (hierarchy && Object.prototype.hasOwnProperty.call(hierarchy, 'player')) return 'player';
    try {
      if (typeof global._tmResolvePlayerAdminKey === 'function') {
        var resolved = global._tmResolvePlayerAdminKey(hierarchy, global.P || null, { allowSoleBranchFallback:false });
        if (resolved && resolved !== 'divisions') return resolved;
      }
    } catch (_) {}
    var keys = Object.keys(hierarchy || {}).filter(function(key) {
      var branch = hierarchy[key];
      return Array.isArray(branch) || (branch && Array.isArray(branch.divisions));
    });
    var playerNames = _playerPopulationAliases(G);
    for (var i = 0; i < keys.length; i++) {
      var branch = hierarchy[keys[i]] || {};
      if (branch && branch.isPlayer) return keys[i];
      var aliases = [keys[i], branch.factionId, branch.factionName, branch.name, branch.key, branch.id];
      if (aliases.some(function(alias) { return playerNames.indexOf(_normPopulationName(alias)) >= 0; })) return keys[i];
    }
    return null;
  }

  function _factionForAdminBranch(G, key, branch) {
    var factions = G && Array.isArray(G.facs) ? G.facs : [];
    var aliases = [key, branch && branch.factionId, branch && branch.factionName, branch && branch.name]
      .map(_normPopulationName).filter(Boolean);
    for (var i = 0; i < factions.length; i++) {
      var faction = factions[i] || {};
      var values = [faction.id, faction.key, faction.name, faction.factionName].map(_normPopulationName);
      if (values.some(function(value) { return value && aliases.indexOf(value) >= 0; })) return faction;
    }
    return null;
  }

  // 每个势力独立持有叶级人口、统计和迁徙范围。玩家 national 仅由玩家分支聚合；
  // NPC 的人口摘要写入 worldPopulationSummary，不再混进玩家户籍账本。
  function _factionLeafGroups(G) {
    var hierarchy = G && G.adminHierarchy;
    if (!hierarchy || typeof hierarchy !== 'object') return [];
    if (Array.isArray(hierarchy.divisions)) hierarchy = { player: hierarchy };
    var playerKey = _playerAdminKey(G, hierarchy);
    var groups = [];
    Object.keys(hierarchy).forEach(function(key) {
      var branch = hierarchy[key];
      var roots = Array.isArray(branch) ? branch : (branch && branch.divisions);
      if (!Array.isArray(roots)) return;
      var leaves = [];
      _walkAdminLeaves(roots, leaves, []);
      if (!leaves.length && key !== playerKey) return;
      var faction = _factionForAdminBranch(G, key, branch || {});
      groups.push({
        key: key,
        branch: branch || {},
        leaves: leaves,
        isPlayer: key === playerKey,
        faction: faction,
        factionId: String((faction && faction.id) || (branch && branch.factionId) || key),
        factionName: String((faction && faction.name) || (branch && (branch.factionName || branch.name)) || key)
      });
    });
    // Old saves and focused subsystem tests may expose the player leaves only
    // through IntegrationBridge while their hierarchy shell has not yet been
    // normalized. Preserve that compatibility without ever using it to infer
    // NPC ownership or combine multiple factions.
    if (!groups.length && global.IntegrationBridge && typeof global.IntegrationBridge.getLeafDivisions === 'function') {
      var bridgedLeaves = [];
      try { bridgedLeaves = global.IntegrationBridge.getLeafDivisions(hierarchy, 'player') || []; } catch (_) {}
      if (bridgedLeaves.length) {
        groups.push({
          key:'player', branch:{}, leaves:bridgedLeaves, isPlayer:true, faction:null,
          factionId:'player', factionName:String(global.P && global.P.playerInfo && global.P.playerInfo.factionName || 'player')
        });
      }
    }
    return groups;
  }

  function _allLeafDivisions(G, suppliedGroups) {
    var leaves = [];
    (suppliedGroups || _factionLeafGroups(G)).forEach(function(group) {
      (group.leaves || []).forEach(function(leaf) { if (leaves.indexOf(leaf) < 0) leaves.push(leaf); });
    });
    return leaves;
  }

  function _leafPopulationTotals(leaves) {
    var totals = { mouths:0, households:0, ding:0 };
    (leaves || []).forEach(function(leaf) {
      var detail = leaf && leaf.populationDetail;
      if (!detail) return;
      totals.mouths += Math.max(0, Number(detail.mouths) || 0);
      totals.households += Math.max(0, Number(detail.households) || 0);
      totals.ding += Math.max(0, Number(detail.ding) || 0);
    });
    totals.mouths = Math.round(totals.mouths);
    totals.households = Math.round(totals.households);
    totals.ding = Math.round(totals.ding);
    return totals;
  }

  function _ensureWorldPopulationSummary(G) {
    if (!G.worldPopulationSummary || typeof G.worldPopulationSummary !== 'object' || Array.isArray(G.worldPopulationSummary)) {
      G.worldPopulationSummary = { byFaction:{}, national:{ mouths:0, households:0, ding:0 } }; // arch-ok: 户籍权威写口创建世界人口只读汇总
    }
    if (!G.worldPopulationSummary.byFaction || typeof G.worldPopulationSummary.byFaction !== 'object') {
      G.worldPopulationSummary.byFaction = {}; // arch-ok: 户籍权威写口修复世界人口分势力汇总
    }
    return G.worldPopulationSummary;
  }

  function _factionSummaryKey(group) {
    return String(group && (group.factionId || group.key) || 'unknown');
  }

  function _factionPopulationEntry(G, group) {
    var world = _ensureWorldPopulationSummary(G);
    var key = _factionSummaryKey(group);
    var entry = world.byFaction[key];
    var legacyKey = String(group && group.key || '');
    if (!entry && legacyKey && legacyKey !== key && world.byFaction[legacyKey]) {
      entry = world.byFaction[legacyKey];
      delete world.byFaction[legacyKey];
    }
    if (!entry) {
      Object.keys(world.byFaction).some(function(existingKey) {
        var existing = world.byFaction[existingKey];
        if (!existing || _normPopulationName(existing.factionId) !== _normPopulationName(group && group.factionId)) return false;
        entry = existing;
        if (existingKey !== key) delete world.byFaction[existingKey];
        return true;
      });
    }
    if (!entry || typeof entry !== 'object') entry = world.byFaction[key] = {};
    else world.byFaction[key] = entry;
    entry.factionId = group.factionId;
    entry.factionName = group.factionName;
    entry.branchKey = group.key;
    if (!entry.dynamics || typeof entry.dynamics !== 'object') entry.dynamics = _defaultDynamics();
    return entry;
  }

  function _refreshWorldPopulationSummary(G, groups) {
    var world = _ensureWorldPopulationSummary(G);
    var aliveKeys = Object.create(null);
    var total = { mouths:0, households:0, ding:0 };
    (groups || []).forEach(function(group) {
      var entry = _factionPopulationEntry(G, group);
      var national = _leafPopulationTotals(group.leaves);
      var demographic = _leafDemographicTotals(group.leaves);
      entry.national = national;
      entry.byAge = demographic.byAge;
      entry.byGender = demographic.byGender;
      entry.isPlayer = !!group.isPlayer;
      aliveKeys[_factionSummaryKey(group)] = true;
      total.mouths += national.mouths;
      total.households += national.households;
      total.ding += national.ding;
    });
    Object.keys(world.byFaction).forEach(function(key) {
      if (!aliveKeys[key]) delete world.byFaction[key];
    });
    world.national = total;
    world.updatedTurn = Number(G && G.turn) || 0;
    return world;
  }

  // S1·人口自下而上：叶级增长(先只接本地民心)·写叶 populationDetail·national = Σ叶 增量同步。
  // 详设 docs/population-bottom-up-redesign-2026-06.md §2.1-2.2。S2 再接粮食供需/生活/赋役，S3 调粮。
  function _syncLeafPopulationMirrors(leaf, detail) {
    if (!leaf || !detail) return;
    if (typeof leaf.population === 'number') {
      leaf.population = detail.mouths;
    } else if (leaf.population && typeof leaf.population === 'object' && leaf.population !== detail) {
      leaf.population.mouths = detail.mouths;
      leaf.population.households = detail.households;
      leaf.population.ding = detail.ding;
      leaf.population.hiddenCount = Math.max(0, Math.round(Number(detail.hiddenCount != null ? detail.hiddenCount : detail.hidden) || 0));
      leaf.population.fugitives = Math.max(0, Math.round(Number(detail.fugitives) || 0));
    }
    detail.hiddenCount = Math.max(0, Math.round(Number(detail.hiddenCount != null ? detail.hiddenCount : detail.hidden) || 0));
    detail.hidden = detail.hiddenCount;
    detail.fugitives = Math.max(0, Math.round(Number(detail.fugitives) || 0));
    leaf.hiddenCount = detail.hiddenCount;
    leaf.hidden = detail.hiddenCount;
    leaf.fugitives = detail.fugitives;
    if (leaf.isQiaozhi || leaf.regionType === 'qiaozhi') {
      leaf.byLegalStatus = leaf.byLegalStatus && typeof leaf.byLegalStatus === 'object' ? leaf.byLegalStatus : {};
      leaf.byLegalStatus.qiaozhi = {
        households:detail.households,
        mouths:detail.mouths,
        ding:detail.ding
      };
      detail.byLegalStatus = leaf.byLegalStatus;
    }
    var env = leaf.environment && typeof leaf.environment === 'object' ? leaf.environment : null;
    var carrying = leaf.carryingCapacity;
    var cap = Number(env && env.carrying) ||
      Number(carrying && typeof carrying === 'object' && carrying.historicalCap) ||
      (typeof carrying === 'number' ? Number(carrying) : 0);
    if (cap > 0) {
      var load = Math.max(0, Math.min(1.5, detail.mouths / cap));
      if (env) env.currentLoad = load;
      if (carrying && typeof carrying === 'object') carrying.currentLoad = load;
    }
  }

  function _legacyPopulationRowForLeaf(P, leaf) {
    if (!P || !P.byRegion || !leaf) return null;
    var aliases = [leaf.id, leaf.name, leaf.mapRegionId, leaf.regionId].filter(function(value) {
      return value !== undefined && value !== null && String(value) !== '';
    });
    for (var i = 0; i < aliases.length; i++) {
      if (P.byRegion[String(aliases[i])]) return P.byRegion[String(aliases[i])];
    }
    return null;
  }

  function _ensureLeafDemographicBuckets(leaf, detail) {
    detail = detail || (leaf && leaf.populationDetail);
    if (!leaf || !detail) return { byAge:{}, byGender:{} };
    var mouths = Math.max(0, Math.round(Number(detail.mouths) || 0));
    var legacy = _legacyPopulationRowForLeaf(global.GM && global.GM.population, leaf);
    var byAge = _scaleBucketsToTotal(
      detail.byAge || leaf.byAge || (legacy && legacy.byAge) || {},
      mouths,
      AGE_BUCKET_TEMPLATE
    );
    var byGender = _scaleBucketsToTotal(
      detail.byGender || leaf.byGender || (legacy && legacy.byGender) || {},
      mouths,
      GENDER_BUCKET_TEMPLATE
    );
    detail.byAge = byAge;
    detail.byGender = byGender;
    leaf.byAge = byAge;
    leaf.byGender = byGender;
    if (legacy) {
      legacy.byAge = byAge;
      legacy.byGender = byGender;
    }
    return { byAge:byAge, byGender:byGender };
  }

  function _resizeLeafDemographicBuckets(leaf, detail, mouths) {
    var buckets = _ensureLeafDemographicBuckets(leaf, detail);
    var nextAge = _scaleBucketsToTotal(buckets.byAge, mouths, AGE_BUCKET_TEMPLATE);
    var nextGender = _scaleBucketsToTotal(buckets.byGender, mouths, GENDER_BUCKET_TEMPLATE);
    detail.byAge = nextAge;
    detail.byGender = nextGender;
    leaf.byAge = nextAge;
    leaf.byGender = nextGender;
    var legacy = _legacyPopulationRowForLeaf(global.GM && global.GM.population, leaf);
    if (legacy) {
      legacy.byAge = nextAge;
      legacy.byGender = nextGender;
    }
    return { byAge:nextAge, byGender:nextGender };
  }

  function _advanceLeafDemographicBuckets(leaf, detail, births, deaths, mr) {
    // The caller has already normalized these buckets against the pre-growth
    // population. Do not normalize them again after detail.mouths changes or
    // births would be counted once by resizing and a second time below.
    var age = Object.assign({}, detail.byAge || leaf.byAge || {});
    var gender = Object.assign({}, detail.byGender || leaf.byGender || {});
    var ageKeys = Object.keys(AGE_BUCKET_TEMPLATE);
    var fractionMove = Math.max(0, Number(mr) || 0) / 120;
    var newlyAdult = Math.round((Number(age.age_11_20) || 0) * fractionMove);
    var leavingDing = Math.round((Number(age.age_51_60) || 0) * fractionMove);
    for (var i = ageKeys.length - 1; i > 0; i--) {
      var move = Math.min(Number(age[ageKeys[i - 1]]) || 0, Math.round((Number(age[ageKeys[i - 1]]) || 0) * fractionMove));
      age[ageKeys[i - 1]] = Math.max(0, (Number(age[ageKeys[i - 1]]) || 0) - move);
      age[ageKeys[i]] = (Number(age[ageKeys[i]]) || 0) + move;
    }
    age.age_0_10 = (Number(age.age_0_10) || 0) + Math.max(0, Math.round(Number(births) || 0));
    var maleBirths = Math.round(Math.max(0, Number(births) || 0) * 0.52);
    gender.male = (Number(gender.male) || 0) + maleBirths;
    gender.female = (Number(gender.female) || 0) + Math.max(0, Math.round(Number(births) || 0)) - maleBirths;
    // Natural and explicit mortality already changed detail.mouths. Scaling the
    // buckets to that authoritative total removes deaths without inventing a
    // second population producer.
    age = _scaleBucketsToTotal(age, detail.mouths, AGE_BUCKET_TEMPLATE);
    gender = _scaleBucketsToTotal(gender, detail.mouths, GENDER_BUCKET_TEMPLATE);
    var maleShare = (Number(gender.male) || 0) / Math.max(1, _sumObj(gender));
    detail.ding = Math.max(0, Math.min(detail.mouths,
      Math.round((Number(detail.ding) || 0) + (newlyAdult - leavingDing) * maleShare)));
    detail.byAge = age;
    detail.byGender = gender;
    leaf.byAge = age;
    leaf.byGender = gender;
    leaf._newlyAdult = newlyAdult;
    leaf._leavingDing = leavingDing;
    var legacy = _legacyPopulationRowForLeaf(global.GM && global.GM.population, leaf);
    if (legacy) {
      legacy.byAge = age;
      legacy.byGender = gender;
      legacy.ding = detail.ding;
    }
  }

  function _leafDemographicTotals(leaves) {
    var out = { byAge:{}, byGender:{}, newlyAdult:0, leavingDing:0 };
    (leaves || []).forEach(function(leaf) {
      if (!leaf || !leaf.populationDetail) return;
      var buckets = _ensureLeafDemographicBuckets(leaf, leaf.populationDetail);
      Object.keys(buckets.byAge).forEach(function(key) {
        out.byAge[key] = (Number(out.byAge[key]) || 0) + (Number(buckets.byAge[key]) || 0);
      });
      Object.keys(buckets.byGender).forEach(function(key) {
        out.byGender[key] = (Number(out.byGender[key]) || 0) + (Number(buckets.byGender[key]) || 0);
      });
      out.newlyAdult += Number(leaf._newlyAdult) || 0;
      out.leavingDing += Number(leaf._leavingDing) || 0;
    });
    return out;
  }

  function syncDemographicViews() {
    var G = global.GM;
    var P = G && G.population;
    if (!P) return { ok:false, reason:'population-unavailable' };
    var groups = _factionLeafGroups(G);
    var playerGroup = groups.find(function(group) { return group.isPlayer; });
    if (!playerGroup) {
      if (_hasExplicitPlayerIdentity(G, G && G.adminHierarchy)) {
        _zeroPlayerPopulationViews(P);
        _refreshWorldPopulationSummary(G, groups);
        return { ok:true, national:{ mouths:0, households:0, ding:0 }, byAge:{}, byGender:{}, territorialExtinction:true };
      }
      _ensureDeepDemographics(P);
      return { ok:true, legacy:true };
    }
    if (!playerGroup.leaves.length) {
      _zeroPlayerPopulationViews(P);
      _refreshWorldPopulationSummary(G, groups);
      return { ok:true, national:{ mouths:0, households:0, ding:0 }, byAge:{}, byGender:{}, territorialExtinction:true };
    }
    var totals = _leafPopulationTotals(playerGroup.leaves);
    var demographic = _leafDemographicTotals(playerGroup.leaves);
    P.national.mouths = totals.mouths; // arch-ok: 叶级人口结构聚合玩家全国人口
    P.national.households = totals.households; // arch-ok: 叶级人口结构聚合玩家全国户数
    P.national.ding = totals.ding; // arch-ok: 叶级人口结构聚合玩家全国丁口
    P.byAge = demographic.byAge; // arch-ok: 叶级人口结构派生全国年龄视图
    P.ageLayers = Object.assign({}, demographic.byAge); // arch-ok: 叶级人口结构派生兼容年龄视图
    P.agePyramidFine = Object.assign({}, demographic.byAge, { // arch-ok: 叶级人口结构派生精细年龄视图
      _newlyAdult:demographic.newlyAdult,
      _leavingDing:demographic.leavingDing
    }); // arch-ok: 叶级人口结构派生精细年龄视图
    P.byGender = demographic.byGender; // arch-ok: 叶级人口结构派生全国性别视图
    P.gender = { // arch-ok: 叶级人口结构派生兼容性别视图
      male:Number(demographic.byGender.male) || 0,
      female:Number(demographic.byGender.female) || 0,
      total:_sumObj(demographic.byGender),
      ratio:(Number(demographic.byGender.male) || 0) / Math.max(1, Number(demographic.byGender.female) || 0)
    }; // arch-ok: 叶级人口结构派生兼容性别视图
    return { ok:true, national:totals, byAge:demographic.byAge, byGender:demographic.byGender };
  }

  function _zeroPlayerPopulationViews(P) {
    if (!P.national || typeof P.national !== 'object') P.national = {};
    P.national.mouths = 0; // arch-ok: 领土灭失时清零玩家全国人口真值
    P.national.households = 0; // arch-ok: 领土灭失时清零玩家全国户数真值
    P.national.ding = 0; // arch-ok: 领土灭失时清零玩家全国丁口真值
    P.byRegion = {}; // arch-ok: 领土灭失时清除旧地区人口代理
    P.byAge = {}; // arch-ok: 领土灭失时清零玩家年龄视图
    P.ageLayers = {}; // arch-ok: 领土灭失时清零兼容年龄视图
    P.agePyramidFine = { _newlyAdult:0, _leavingDing:0 }; // arch-ok: 领土灭失时清零精细年龄视图
    P.byGender = {}; // arch-ok: 领土灭失时清零玩家性别视图
    P.gender = { male:0, female:0, total:0, ratio:0 }; // arch-ok: 领土灭失时清零兼容性别视图
    if (!P.deepFieldEffects || typeof P.deepFieldEffects !== 'object') P.deepFieldEffects = {};
    P.deepFieldEffects.serviceAgeDing = 0;
  }

  function _recordPopulationDynamics(d, ctx, G, births, deaths, mr) {
    if (!d || typeof d !== 'object') return;
    if (!Array.isArray(d.yearlyLog)) d.yearlyLog = []; // arch-ok: 户籍权威写口维护分势力人口年账
    d._yearlyAccumBirths = Number(d._yearlyAccumBirths) || 0; // arch-ok: 户籍权威写口维护分势力人口年账
    d._yearlyAccumDeaths = Number(d._yearlyAccumDeaths) || 0; // arch-ok: 户籍权威写口维护分势力人口年账
    d._yearlyAccumBirths += births; // arch-ok: 户籍权威写口维护分势力人口年账
    d._yearlyAccumDeaths += deaths; // arch-ok: 户籍权威写口维护分势力人口年账
    if (d._lastLogTurn == null) d._lastLogTurn = ctx.turn || 0; // arch-ok: 户籍权威写口维护分势力人口年账
    var yearlyLogTurns = (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(12) : 12;
    if (((ctx.turn || 0) - d._lastLogTurn) >= yearlyLogTurns) {
      var logYear = _calendarYearForTurn(ctx.turn || 1, G);
      d.yearlyLog.push({ year:logYear, birth:d._yearlyAccumBirths, death:d._yearlyAccumDeaths, net:d._yearlyAccumBirths - d._yearlyAccumDeaths }); // arch-ok: 户籍权威写口维护分势力人口年账
      if (d.yearlyLog.length > 50) d.yearlyLog.splice(0, d.yearlyLog.length - 50); // arch-ok: 户籍权威写口裁剪分势力人口年账
      d._lastLogTurn = ctx.turn || 0; // arch-ok: 户籍权威写口维护分势力人口年账
      d._yearlyAccumBirths = 0; // arch-ok: 户籍权威写口滚动分势力人口年账
      d._yearlyAccumDeaths = 0; // arch-ok: 户籍权威写口滚动分势力人口年账
    }
    d.lastYearNet = _annualizePopulationNet(births - deaths, mr); // arch-ok: 户籍权威写口维护分势力人口年账
  }

  function _calendarYearForTurn(turn, G) {
    try {
      if (typeof global.calcDateFromTurn === 'function') {
        var date = global.calcDateFromTurn(turn || 1);
        var year = Number(date && (date.adYear != null ? date.adYear : date.year));
        if (isFinite(year)) return year;
      }
    } catch (_) {}
    var startYear = Number(G && G.year);
    if (!isFinite(startYear)) startYear = Number(global.P && global.P.time && global.P.time.year) || 0;
    var days = (typeof global._getDaysPerTurn === 'function') ? Number(global._getDaysPerTurn()) : 30;
    if (!(days > 0)) days = 30;
    return startYear + Math.floor(Math.max(0, Number(turn || 1) - 1) * days / 365);
  }

  function _syncPlayerLegacyRow(P, leaf, detail) {
    if (!P || !P.byRegion || !leaf || !detail) return;
    var rid = String(leaf.id || leaf.name || '');
    var legacyRow = P.byRegion[rid] || (leaf.name ? P.byRegion[leaf.name] : null);
    if (legacyRow && legacyRow !== detail) {
      legacyRow.mouths = detail.mouths;
      legacyRow.households = detail.households;
      legacyRow.ding = detail.ding;
      legacyRow.hiddenCount = Math.max(0, Math.round(Number(detail.hiddenCount != null ? detail.hiddenCount : detail.hidden) || 0));
      legacyRow.hidden = legacyRow.hiddenCount;
      legacyRow.fugitives = Math.max(0, Math.round(Number(detail.fugitives) || 0));
    }
  }

  function _tickPopulationLeafGrowth(ctx, mr, useLocalFactors, suppliedGroups) {
    var P = global.GM.population;
    var G = global.GM;
    var groups = suppliedGroups || _factionLeafGroups(G);
    groups.forEach(function(group) {
      var entry = _factionPopulationEntry(G, group);
      var d = group.isPlayer ? P.dynamics : entry.dynamics;
      var beforeTotals = group.isPlayer && P.national
        ? {
            mouths:Math.max(0, Number(P.national.mouths) || 0),
            households:Math.max(0, Number(P.national.households) || 0),
            ding:Math.max(0, Number(P.national.ding) || 0)
          }
        : ((entry.national && Number(entry.national.mouths) > 0) ? entry.national : _leafPopulationTotals(group.leaves));
      var dingRatio = beforeTotals.ding / Math.max(1, beforeTotals.mouths);
      var mphh = beforeTotals.mouths / Math.max(1, beforeTotals.households);
      var environmentLoad = group.isPlayer
        ? ((G.environment && G.environment.nationalLoad) || 0.5)
        : Number(group.branch && group.branch.environmentLoad);
      if (!isFinite(environmentLoad)) environmentLoad = 0.5;
      var disaster = Number(group.branch && group.branch.disasterLevel);
      if (!isFinite(disaster)) disaster = group.isPlayer ? Number(G.vars && G.vars.disasterLevel) || 0 : 0;
      var war = (G.activeWars || []).filter(function(activeWar) {
        return _warAffectsFaction(activeWar, group);
      }).length;
      var baseBirth = Number(d.birthRateBase); if (!isFinite(baseBirth)) baseBirth = 0.035;
      baseBirth += Number(d.prosperityBonus) || 0;
      baseBirth -= Math.max(0, environmentLoad - 1) * 0.005;
      if (disaster > 0.3) baseBirth -= 0.01;
      var baseDeath = Number(d.deathRateBase); if (!isFinite(baseDeath)) baseDeath = 0.025;
      baseDeath += (Number(d.agingPenalty) || 0) + (Number(d.diseaseBoost) || 0);
      if (disaster > 0.3) baseDeath += disaster * 0.05;
      if (war > 0) baseDeath += Math.min(0.03, war * 0.01);
      if (environmentLoad > 1.2) baseDeath += (environmentLoad - 1.2) * 0.02;

      var totBirths = 0, totDeaths = 0;
      group.leaves.forEach(function(leaf) {
        var pd = leaf && leaf.populationDetail;
        if (!pd) return;
        var mouths = Number(pd.mouths) || 0;
        if (mouths <= 0) return;
        _ensureLeafDemographicBuckets(leaf, pd);
        var minxin = Number(leaf.minxin);
        if (!isFinite(minxin)) minxin = Number(leaf.minxinLocal);
        if (!isFinite(minxin)) minxin = 50;
        var rid = String(leaf.id || leaf.name || '');
        var rg = G.renli && G.renli.byRegion
          ? (G.renli.byRegion[rid] || (leaf.name ? G.renli.byRegion[leaf.name] : null)) : null;
        var load = 1;
        if (rg) {
          var grainSupply = (Number(rg.grainOutput) || 0) + (Number(leaf._grainInflowThisTurn) || 0);
          var grainDemand = Number(rg.foodNeed) || 0;
          if (grainDemand > 0) load = grainSupply > 0 ? grainDemand / grainSupply : 2;
        }
        var prosperity = Number(leaf.prosperity); if (!isFinite(prosperity)) prosperity = 50;
        var lifeLv = (prosperity - 50) / 100;
        var recentDisasters = leaf.recentDisasters;
        var hasDisaster = Array.isArray(recentDisasters) ? recentDisasters.length > 0 : !!recentDisasters;
        var corvee = rg ? Math.max(0, Math.min(1, Number(rg.corveeRate) || 0)) : 0;
        var localBirth = baseBirth;
        var localDeath = baseDeath;
        if (useLocalFactors) {
          localBirth = baseBirth
            * (1 + (minxin - 50) / 100 * 0.4)
            * (1 + lifeLv * 0.3)
            * Math.max(0.3, Math.min(1.1, 1.1 - load * 0.3))
            * (1 - corvee * 0.2);
          localDeath = baseDeath
            * (1 - (minxin - 50) / 100 * 0.25)
            * (1 + (hasDisaster ? 0.5 : 0))
            * (1 + Math.max(0, load - 1) * 0.6);
        }
        var births = Math.round(mouths * localBirth * mr / 12);
        var deaths = Math.round(mouths * localDeath * mr / 12);
        var leafDingRatio = Number(pd.ding) > 0 ? Number(pd.ding) / mouths : dingRatio;
        var leafMouthsPerHousehold = Number(pd.households) > 0 ? mouths / Number(pd.households) : mphh;
        pd.mouths = Math.max(0, mouths + births - deaths);
        pd.households = Math.round(pd.mouths / Math.max(1, leafMouthsPerHousehold));
        pd.ding = Math.round(pd.mouths * leafDingRatio);
        _advanceLeafDemographicBuckets(leaf, pd, births, deaths, mr);
        _syncLeafPopulationMirrors(leaf, pd);
        if (group.isPlayer) _syncPlayerLegacyRow(P, leaf, pd);
        leaf.yearlyBirths = (Number(leaf.yearlyBirths) || 0) + births;
        leaf.yearlyDeaths = (Number(leaf.yearlyDeaths) || 0) + deaths;
        totBirths += births;
        totDeaths += deaths;
        if (leaf._grainInflowThisTurn) leaf._grainInflowThisTurn = 0;
      });

      var afterTotals = _leafPopulationTotals(group.leaves);
      entry.national = afterTotals;
      _recordPopulationDynamics(d, ctx, G, totBirths, totDeaths, mr);
      if (group.isPlayer) {
        // 叶级行政区是运行真值；national 必须始终与叶级合计严格相等。
        // 可配置下限只约束损失账本，不得凭空在汇总层造人口。
        P.national.mouths = afterTotals.mouths; // arch-ok: 户籍权威写口由玩家叶级真值聚合全国人口
        P.national.households = afterTotals.households; // arch-ok: 户籍权威写口由玩家叶级真值聚合全国户数
        P.national.ding = afterTotals.ding; // arch-ok: 户籍权威写口由玩家叶级真值聚合全国丁口
      }
    });
    _refreshWorldPopulationSummary(G, groups);
    syncDemographicViews();
  }

  function _populationGroupAliases(group) {
    return [group && group.key, group && group.factionId, group && group.factionName,
      group && group.faction && group.faction.key, group && group.faction && group.faction.id,
      group && group.faction && group.faction.name]
      .map(_normPopulationName).filter(Boolean);
  }

  function _appendWarParticipantRefs(out, value) {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(function(item) { _appendWarParticipantRefs(out, item); });
      return;
    }
    if (typeof value === 'object') {
      [value.id, value.key, value.name, value.factionId, value.factionName].forEach(function(item) {
        _appendWarParticipantRefs(out, item);
      });
      return;
    }
    var normalized = _normPopulationName(value);
    if (normalized && out.indexOf(normalized) < 0) out.push(normalized);
  }

  function _warAffectsFaction(activeWar, group) {
    if (!activeWar || !group) return false;
    var refs = [];
    ['factionId', 'attackerId', 'defenderId', 'sourceFactionId', 'targetFactionId',
      'attacker', 'defender', 'sourceFaction', 'targetFaction', 'attackerFaction',
      'defenderFaction', 'faction', 'participants', 'participantIds'].forEach(function(field) {
      _appendWarParticipantRefs(refs, activeWar[field]);
    });
    var aliases = _populationGroupAliases(group);
    if (refs.some(function(ref) { return aliases.indexOf(ref) >= 0; })) return true;
    // A small set of legacy player-war rows stored only an enemy/opponent label.
    // Treat those as player wars only when no participant fields exist; never
    // turn an explicitly NPC-vs-NPC war into a player war.
    return !!(group.isPlayer && refs.length === 0 && (activeWar.enemy || activeWar.opponent));
  }

  function _hasExplicitFactionTarget(options) {
    return ['factionKey', 'factionId', 'factionName'].some(function(field) {
      return options && options[field] !== undefined && options[field] !== null && String(options[field]).trim() !== '';
    });
  }

  function _leafPopulationAliases(leaf) {
    return [leaf && leaf.id, leaf && leaf.name, leaf && leaf.mapRegionId, leaf && leaf.regionId]
      .map(_normPopulationName).filter(Boolean);
  }

  function _resolvePopulationTarget(G, options, groups) {
    options = options || {};
    groups = groups || _factionLeafGroups(G);
    var explicitFaction = _hasExplicitFactionTarget(options);
    var wanted = [_normPopulationName(options.factionKey), _normPopulationName(options.factionId), _normPopulationName(options.factionName)].filter(Boolean);
    var factionGroup = null;
    if (wanted.length) {
      factionGroup = groups.find(function(group) {
        return _populationGroupAliases(group).some(function(alias) { return wanted.indexOf(alias) >= 0; });
      }) || null;
      if (!factionGroup) return { ok:false, reason:'faction-not-found', group:null, leaf:null };
    }

    var directRegion = _normPopulationName(options.regionId || options.regionName);
    var candidateRegions = (Array.isArray(options.regionCandidates) ? options.regionCandidates : [])
      .map(_normPopulationName).filter(Boolean);
    if (directRegion || candidateRegions.length) {
      var searchGroups = factionGroup ? [factionGroup] : groups;
      var matches = [];
      searchGroups.forEach(function(regionGroup) {
        (regionGroup.leaves || []).forEach(function(leaf) {
          var aliases = _leafPopulationAliases(leaf);
          var exact = directRegion && aliases.indexOf(directRegion) >= 0;
          var candidate = candidateRegions.some(function(wantedRegion) {
            return aliases.some(function(alias) {
              return alias === wantedRegion || alias.indexOf(wantedRegion) >= 0 || wantedRegion.indexOf(alias) >= 0;
            });
          });
          if (exact || candidate) matches.push({ group:regionGroup, leaf:leaf });
        });
      });
      if (!matches.length) return { ok:false, reason:'region-not-found', group:factionGroup, leaf:null };
      if (matches.length > 1) {
        var exactMatches = directRegion ? matches.filter(function(match) {
          return _leafPopulationAliases(match.leaf).indexOf(directRegion) >= 0;
        }) : [];
        if (exactMatches.length === 1) matches = exactMatches;
        else return { ok:false, reason:'region-ambiguous', group:factionGroup, leaf:null };
      }
      return { ok:true, group:matches[0].group, leaf:matches[0].leaf };
    }
    if (factionGroup) return { ok:true, group:factionGroup, leaf:null };
    var playerGroup = groups.find(function(group) { return group.isPlayer; }) || null;
    if (playerGroup) return { ok:true, group:playerGroup, leaf:null };
    if (explicitFaction) return { ok:false, reason:'faction-not-found', group:null, leaf:null };
    return { ok:groups.length === 0, reason:groups.length ? 'player-faction-not-found' : '', group:null, leaf:null };
  }

  function _applyPopulationLossToLeaves(group, mouthsRequested, dingRequested, cause, regionId) {
    var wantedRegion = _normPopulationName(regionId);
    var groupLeaves = (group && group.leaves || []).filter(function(leaf) {
      return leaf && leaf.populationDetail && Number(leaf.populationDetail.mouths) > 0;
    });
    var leaves = wantedRegion ? groupLeaves.filter(function(leaf) {
      return [leaf.id, leaf.name, leaf.mapRegionId, leaf.regionId]
        .map(_normPopulationName).some(function(alias) { return alias && alias === wantedRegion; });
    }) : groupLeaves;
    if (!leaves.length) return { mouths:0, ding:0 };
    var totals = _leafPopulationTotals(leaves);
    var groupTotals = wantedRegion ? _leafPopulationTotals(groupLeaves) : totals;
    var minimum = group.isPlayer ? _minimumPopulation(global.GM.population) : 0;
    var mouthTarget = Math.min(
      Math.max(0, Math.round(Number(mouthsRequested) || 0)),
      totals.mouths,
      Math.max(0, groupTotals.mouths - minimum)
    );
    var dingTarget = Number(dingRequested);
    if (!(dingTarget >= 0) || !isFinite(dingTarget)) dingTarget = mouthTarget * totals.ding / Math.max(1, totals.mouths);
    dingTarget = Math.min(Math.max(0, Math.round(dingTarget)), totals.ding);
    var remainingMouthLoss = mouthTarget;
    var remainingDingLoss = dingTarget;
    var remainingMouthPool = totals.mouths;
    var remainingDingPool = totals.ding;
    var appliedMouths = 0;
    var appliedDing = 0;
    leaves.forEach(function(leaf, index) {
      var detail = leaf.populationDetail;
      var mouthsBefore = Math.max(0, Math.round(Number(detail.mouths) || 0));
      var dingBefore = Math.max(0, Math.round(Number(detail.ding) || 0));
      var mouthsPerHousehold = mouthsBefore / Math.max(1, Number(detail.households) || 0);
      var mouthLoss = index === leaves.length - 1
        ? Math.min(mouthsBefore, remainingMouthLoss)
        : Math.min(mouthsBefore, Math.round(remainingMouthLoss * mouthsBefore / Math.max(1, remainingMouthPool)));
      var dingLoss = index === leaves.length - 1
        ? Math.min(dingBefore, remainingDingLoss)
        : Math.min(dingBefore, Math.round(remainingDingLoss * dingBefore / Math.max(1, remainingDingPool)));
      detail.mouths = Math.max(0, mouthsBefore - mouthLoss);
      detail.ding = Math.max(0, dingBefore - dingLoss);
      detail.households = detail.mouths > 0 ? Math.round(detail.mouths / Math.max(1, mouthsPerHousehold)) : 0;
      _resizeLeafDemographicBuckets(leaf, detail, detail.mouths);
      leaf.yearlyDeaths = (Number(leaf.yearlyDeaths) || 0) + mouthLoss;
      if (!Array.isArray(leaf.populationLossLedger)) leaf.populationLossLedger = [];
      if (mouthLoss || dingLoss) {
        leaf.populationLossLedger.push({ turn:Number(global.GM.turn) || 0, cause:String(cause || 'unknown'), mouths:mouthLoss, ding:dingLoss });
        if (leaf.populationLossLedger.length > 40) leaf.populationLossLedger.splice(0, leaf.populationLossLedger.length - 40);
      }
      _syncLeafPopulationMirrors(leaf, detail);
      if (group.isPlayer) _syncPlayerLegacyRow(global.GM.population, leaf, detail);
      remainingMouthLoss -= mouthLoss;
      remainingDingLoss -= dingLoss;
      remainingMouthPool -= mouthsBefore;
      remainingDingPool -= dingBefore;
      appliedMouths += mouthLoss;
      appliedDing += dingLoss;
    });
    return { mouths:appliedMouths, ding:appliedDing };
  }

  function _applyPopulationLossLegacy(P, mouthsRequested, dingRequested) {
    var oldMouths = Math.max(0, Math.round(Number(P.national && P.national.mouths) || 0));
    var oldDing = Math.max(0, Math.round(Number(P.national && P.national.ding) || 0));
    var oldHouseholds = Math.max(0, Math.round(Number(P.national && P.national.households) || 0));
    var mouthLoss = Math.min(Math.max(0, Math.round(Number(mouthsRequested) || 0)), Math.max(0, oldMouths - _minimumPopulation(P)));
    var requestedDing = Number(dingRequested);
    if (!(requestedDing >= 0) || !isFinite(requestedDing)) requestedDing = mouthLoss * oldDing / Math.max(1, oldMouths);
    var dingLoss = Math.min(oldDing, Math.max(0, Math.round(requestedDing)));
    var mouthsPerHousehold = oldMouths / Math.max(1, oldHouseholds);
    P.national.mouths = oldMouths - mouthLoss; // arch-ok: 无叶级旧档的人口损失兼容写口
    P.national.ding = oldDing - dingLoss; // arch-ok: 无叶级旧档的丁口损失兼容写口
    P.national.households = P.national.mouths > 0 ? Math.round(P.national.mouths / Math.max(1, mouthsPerHousehold)) : 0; // arch-ok: 无叶级旧档的户数损失兼容写口
    return { mouths:mouthLoss, ding:dingLoss };
  }

  function _appendPopulationLossLedger(owner, row) {
    if (!owner || typeof owner !== 'object') return;
    if (!Array.isArray(owner.mortalityLedger)) owner.mortalityLedger = [];
    owner.mortalityLedger.push(row);
    if (owner.mortalityLedger.length > 120) owner.mortalityLedger.splice(0, owner.mortalityLedger.length - 120);
  }

  // 所有人口损失的唯一落点：先写叶级人口真值，再汇总 national。
  // 供徭役、工程、气候、瘟疫等系统复用，避免“只扣 national 后被 RuntimeBridge 抹掉”。
  function applyPopulationLoss(options) {
    options = options || {};
    var G = global.GM;
    var P = G && G.population;
    if (!P || !P.national) return { ok:false, reason:'population-unavailable', mouths:0, ding:0 };
    var groups = _factionLeafGroups(G);
    var target = _resolvePopulationTarget(G, options, groups);
    if (!target.ok) return { ok:false, reason:target.reason || 'population-target-not-found', mouths:0, ding:0 };
    var group = target.group;
    var regionLeaf = target.leaf;
    var requestedMouths = options.mouths;
    if (!(Number(requestedMouths) >= 0) && Number(options.mortalityRate) >= 0) {
      var baseMouths = regionLeaf && regionLeaf.populationDetail
        ? Number(regionLeaf.populationDetail.mouths) || 0
        : (group ? _leafPopulationTotals(group.leaves).mouths : Number(P.national.mouths) || 0);
      requestedMouths = Math.round(baseMouths * Math.max(0, Number(options.mortalityRate) || 0));
    }
    var applied;
    var entry = null;
    if (group && group.leaves.length) {
      var resolvedRegion = regionLeaf && (regionLeaf.id || regionLeaf.name || regionLeaf.mapRegionId || regionLeaf.regionId);
      applied = _applyPopulationLossToLeaves(group, requestedMouths, options.ding, options.cause, resolvedRegion || options.regionId || options.regionName);
      var totals = _leafPopulationTotals(group.leaves);
      entry = _factionPopulationEntry(G, group);
      entry.national = totals;
      if (group.isPlayer) {
        P.national.mouths = totals.mouths; // arch-ok: 死亡账本由玩家叶级真值聚合全国人口
        P.national.households = totals.households; // arch-ok: 死亡账本由玩家叶级真值聚合全国户数
        P.national.ding = totals.ding; // arch-ok: 死亡账本由玩家叶级真值聚合全国丁口
        if (P.dynamics) P.dynamics._yearlyAccumDeaths = (Number(P.dynamics._yearlyAccumDeaths) || 0) + applied.mouths; // arch-ok: 死亡账本同步玩家年度死亡统计
      } else if (entry.dynamics) {
        entry.dynamics._yearlyAccumDeaths = (Number(entry.dynamics._yearlyAccumDeaths) || 0) + applied.mouths;
      }
      _refreshWorldPopulationSummary(G, groups);
      syncDemographicViews();
    } else {
      applied = _applyPopulationLossLegacy(P, requestedMouths, options.ding);
      if (P.dynamics) P.dynamics._yearlyAccumDeaths = (Number(P.dynamics._yearlyAccumDeaths) || 0) + applied.mouths; // arch-ok: 旧档死亡账本同步玩家年度死亡统计
    }
    var ledgerRow = {
      turn:Number(G.turn) || 0,
      factionId:group ? group.factionId : String(options.factionId || 'player'),
      cause:String(options.cause || 'unknown'),
      mouths:applied.mouths,
      ding:applied.ding
    };
    _appendPopulationLossLedger(group && !group.isPlayer ? entry : P, ledgerRow);
    return {
      ok:true,
      mouths:applied.mouths,
      ding:applied.ding,
      factionId:group && group.factionId,
      regionId:regionLeaf && String(regionLeaf.id || regionLeaf.name || ''),
      regionName:regionLeaf && String(regionLeaf.name || regionLeaf.id || '')
    };
  }

  function _deepFieldDiversityPressure(r) {
    var ethPressure = 1 - _maxShare(r.byEthnicity || r.ethnicity || {});
    var faithPressure = 1 - _maxShare(r.byFaith || r.religion || {});
    return Math.max(0, Math.min(1, ethPressure + faithPressure * 0.5));
  }

  // A2a 激活·逃亡单一权威：取 Renli（已种子地域逃亡由 Renli 叶子独占·huji 此处让出）
  function _renli() {
    if (typeof TM !== 'undefined' && TM && TM.Renli) return TM.Renli;
    if (typeof window !== 'undefined' && window.TM && window.TM.Renli) return window.TM.Renli;
    if (typeof global !== 'undefined' && global.TM && global.TM.Renli) return global.TM.Renli;
    return null;
  }
  function _tickDeepFieldLinkages(ctx, mr) {
    var G = global.GM;
    var P = G && G.population;
    if (!P || !P.byRegion) return;
    _ensureDeepDemographics(P);
    var ledger = [];
    var serviceAgeDing = _computeDeepServiceDing(P);
    var totalPressure = 0;
    var totalHiddenDelta = 0;
    var totalFugitiveDelta = 0;
    var _rlSeeded = (function(){ var rl = _renli(); return (rl && rl.seededRegionKeySet) ? rl.seededRegionKeySet() : {}; })(); // 已种子地域逃亡归 Renli·deep-field 此处让出（A2a）
    var minxin = G.minxin && typeof G.minxin === 'object' ? (G.minxin.trueIndex || G.minxin.index || 50) : (G.minxin || 50);
    var huangquan = G.huangquan && typeof G.huangquan === 'object' ? (G.huangquan.index || 50) : (G.huangquan || 50);
    Object.keys(P.byRegion).forEach(function(rid) {
      var r = P.byRegion[rid];
      _ensureRegionDeepFields(r);

      var households = Math.max(1, r.households || Math.round((r.mouths || 0) / 5));
      var baojiaCoverage = Math.max(0, Math.min(1, (r.baojiaUnits || 0) * 10 / households));
      if (baojiaCoverage > 0.25) {
        var hiddenBefore = Math.max(0, Math.round(r.hiddenCount != null ? r.hiddenCount : (r.hidden || 0)));
        var fugitivesBefore = Math.max(0, Math.round(r.fugitives || 0));
        var hiddenReduced = Math.round(hiddenBefore * baojiaCoverage * 0.05 * mr / 12);
        var fugitiveReduced = Math.round(fugitivesBefore * baojiaCoverage * 0.04 * mr / 12);
        if (hiddenReduced || fugitiveReduced) {
          r.hidden = Math.max(0, hiddenBefore - hiddenReduced);
          r.hiddenCount = r.hidden;
          r.fugitives = Math.max(0, fugitivesBefore - fugitiveReduced);
          totalHiddenDelta -= hiddenReduced;
          totalFugitiveDelta -= fugitiveReduced;
          ledger.push({ kind:'baojia-registration', regionId:rid, coverage:baojiaCoverage, hiddenReduced:hiddenReduced, fugitiveReduced:fugitiveReduced });
        }
      }

      var pressure = _deepFieldDiversityPressure(r);
      totalPressure += pressure;
      if (!_rlSeeded[rid] && pressure > 0.35 && (minxin < 50 || huangquan < 45)) {
        var stress = pressure * (50 - Math.min(minxin, huangquan)) / 50;
        var newFugitives = Math.round((r.mouths || 0) * stress * 0.001 * mr);
        if (newFugitives > 0) {
          r.fugitives = Math.max(0, (r.fugitives || 0) + newFugitives);
          totalFugitiveDelta += newFugitives;
          ledger.push({ kind:'ethnicity-faith-fugitive-pressure', regionId:rid, pressure:pressure, newFugitives:newFugitives });
        }
      }
    });

    P.hiddenCount = Math.max(0, Math.round((P.hiddenCount || 0) + totalHiddenDelta));
    P.fugitives = Math.max(0, Math.round((P.fugitives || 0) + totalFugitiveDelta));
    if (P.meta && totalHiddenDelta < 0) {
      P.meta.registrationAccuracy = Math.max(P.meta.registrationAccuracy || 0.5, Math.min(1, (P.meta.registrationAccuracy || 0.85) + Math.abs(totalHiddenDelta) / Math.max(1, P.national.households || 1) * 0.5));
    }
    _ensureDeepDemographics(P);
    P.deepFieldEffects.serviceAgeDing = serviceAgeDing;
    P.deepFieldEffects.ethnicityFaithPressure = Object.keys(P.byRegion).length ? totalPressure / Object.keys(P.byRegion).length : 0;
    P.deepFieldEffects.hiddenDelta = totalHiddenDelta;
    P.deepFieldEffects.fugitiveDelta = totalFugitiveDelta;
    P.deepFieldEffects.ledger = (P.deepFieldEffects.ledger || []).concat(ledger);
    if (P.deepFieldEffects.ledger.length > 80) P.deepFieldEffects.ledger.splice(0, P.deepFieldEffects.ledger.length - 80);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅴ 徭役征发 + 死亡率 + 逃役
  // ═══════════════════════════════════════════════════════════════════

  function _ensureCorveeAnnualWindow(c, ctx) {
    var year = _calendarYearForTurn(ctx && ctx.turn || global.GM.turn || 1, global.GM);
    var firstBinding = c.currentYear === undefined || c.currentYear === null;
    var changed = !firstBinding && Number(c.currentYear) !== Number(year);
    Object.keys(c.byType || {}).forEach(function(key) {
      var type = c.byType[key];
      if (!type || typeof type !== 'object') return;
      if (changed || firstBinding) {
        type.currentYearDays = 0;
        type.currentYearFulfilled = 0;
        type.currentYearDeaths = 0;
      } else {
        if (!isFinite(Number(type.currentYearDays))) type.currentYearDays = 0;
        if (!isFinite(Number(type.currentYearFulfilled))) type.currentYearFulfilled = 0;
        if (!isFinite(Number(type.currentYearDeaths))) type.currentYearDeaths = 0;
      }
    });
    c.currentYear = year; // arch-ok: 户籍权威写口滚动年度徭役窗口
    return year;
  }

  function _tickCorvee(ctx, mr) {
    var P = global.GM.population;
    if (!P || !P.corvee || !P.corvee.enabled) return;
    var c = P.corvee;
    _ensureCorveeAnnualWindow(c, ctx);
    // 计算有效丁
    var totalDing = P.national.ding || 0;
    var serviceAgeDing = P.deepFieldEffects && P.deepFieldEffects.serviceAgeDing ? P.deepFieldEffects.serviceAgeDing : _computeDeepServiceDing(P);
    var effectiveDing = Math.min(totalDing, serviceAgeDing || totalDing);
    c.exemptions.forEach(function(ex) {
      // 按 group 估算免除人数（简化）
      if (ex.group === '官员') effectiveDing -= (global.GM.chars || []).filter(function(ch){ return ch.alive!==false && ch.officialTitle; }).length;
      if (ex.group === '僧道' && P.byCategory.sengdao) effectiveDing -= P.byCategory.sengdao.ding || 0;
      if (ex.group === '军户' && P.byCategory.junhu) effectiveDing -= P.byCategory.junhu.ding || 0;
    });
    effectiveDing = Math.max(0, effectiveDing);
    c.deepFieldEffects = {
      source: 'age-gender-service-ding',
      totalDing: totalDing,
      serviceAgeDing: serviceAgeDing,
      effectiveDing: effectiveDing
    };
    // 折银
    if (c.fullyCommuted) {
      // 一条鞭法后：所有役折银
      var commuteMoney = effectiveDing * c.annualCorveeDays * c.commutationRate * mr / 12;
      // 役折银入库走 FiscalEngine 真账(2026-07-04 收口)
      if (global.FiscalEngine && global.FiscalEngine.addToGuoku) global.FiscalEngine.addToGuoku({ money: commuteMoney }, '役折银');
      return;
    }
    // 常役按 10 类分配
    Object.keys(CORVEE_TYPES).forEach(function(k) {
      var t = CORVEE_TYPES[k];
      var type = c.byType[k];
      if (!type) return;
      var req = effectiveDing * t.daysPerDing * mr / 12;
      var fulfilled = req * (1 - (global.GM.population.fugitives || 0) / Math.max(1, totalDing));
      type.totalDays = (Number(type.totalDays) || 0) + req;
      type.fulfilled = (Number(type.fulfilled) || 0) + fulfilled;
      type.currentYearDays = (Number(type.currentYearDays) || 0) + req;
      type.currentYearFulfilled = (Number(type.currentYearFulfilled) || 0) + fulfilled;
      // 死亡
      var dyingDing = effectiveDing * t.deathRate * mr / 12 * (CATEGORY_TEMPLATES[k] ? CATEGORY_TEMPLATES[k].corveeLevel || 1 : 1);
      var mortality = applyPopulationLoss({ cause:'corvee:' + k, mouths:dyingDing, ding:dyingDing });
      type.deaths = (Number(type.deaths) || 0) + mortality.ding;
      type.currentYearDeaths = (Number(type.currentYearDeaths) || 0) + mortality.ding;
    });
    // 逃役——burden 超过阈值
    var corveeBurden = (Number(c.byType.junyi && c.byType.junyi.currentYearDays) || 0)
      + (Number(c.byType.gongyi && c.byType.gongyi.currentYearDays) || 0);
    corveeBurden = corveeBurden / Math.max(1, effectiveDing * 365);
    c.currentYearBurden = corveeBurden; // arch-ok: 户籍权威写口记录本年徭役压力
    if (corveeBurden > c.burdenThreshold) {
      var _rlShare = (function(){ var rl = _renli(); return (rl && rl.seededDingShare) ? rl.seededDingShare() : 0; })(); // 已种子地域逃役归 Renli·按未种子丁占比缩减（A2a）
      var newFugitives = Math.round(effectiveDing * (corveeBurden - c.burdenThreshold) * 0.1 * mr * (1 - _rlShare));
      P.fugitives = (P.fugitives || 0) + newFugitives;
      if (P.byLegalStatus.taoohu) {
        P.byLegalStatus.taoohu.households += Math.round(newFugitives / 5);
        P.byLegalStatus.taoohu.mouths += newFugitives;
        P.byLegalStatus.taoohu.ding += Math.round(newFugitives * 0.3);
      }
      if (newFugitives > 1000 && global.addEB) {
        global.addEB('户口', '役负过重，新增逃户 ' + newFugitives + ' 口');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  大徭役工程
  // ═══════════════════════════════════════════════════════════════════

  function startLargeCorvee(presetId, opts) {
    opts = opts || {};
    var P = global.GM.population;
    if (!P) return { ok: false };
    var preset = LARGE_CORVEE_PRESETS.find(function(p) { return p.id === presetId; });
    if (!preset) return { ok: false, reason: '未知大徭役' };
    var startTurn = global.GM.turn || 0;
    var durationTurns = (typeof global.turnsForMonths === 'function')
      ? global.turnsForMonths(preset.duration * 12)
      : preset.duration * 12;
    var active = {
      id: 'large_' + (global.GM.turn || 0) + '_' + Math.floor(Math.random() * 10000),
      presetId: presetId,
      name: preset.name,
      startTurn: startTurn,
      endTurn: startTurn + durationTurns,
      laborDemand: preset.laborDemand,
      duration: preset.duration,
      deathRate: preset.deathRate,
      legitimacyImpact: preset.legitimacyImpact,
      techBoost: preset.techBoost || {},
      progress: 0,
      totalDeaths: 0,
      status: 'ongoing'
    };
    P.largeCorveeActive.push(active);
    // 初始负面效果
    if (typeof global.GM.legitimacy === 'number' && preset.legitimacyImpact < 0) {
      global.GM.legitimacy = Math.max(0, global.GM.legitimacy + preset.legitimacyImpact * 0.2);
    }
    if (global.addEB) global.addEB('徭役', '开工 ' + preset.name + '（征调 ' + preset.laborDemand + ' 丁）');
    return { ok: true, id: active.id };
  }

  function _tickLargeCorvee(ctx, mr) {
    var P = global.GM.population;
    if (!P || !P.largeCorveeActive) return;
    var completed = [];
    P.largeCorveeActive.forEach(function(a) {
      if (a.status !== 'ongoing') return;
      var progressPerMonth = 1 / Math.max(1, a.duration * 12);
      a.progress += progressPerMonth * mr;
      var deathsThisMonth = a.laborDemand * a.deathRate * progressPerMonth * mr;
      var mortality = applyPopulationLoss({ cause:'large-corvee:' + String(a.presetId || a.id || 'unknown'), mouths:deathsThisMonth, ding:deathsThisMonth });
      a.totalDeaths += mortality.ding;
      // 完工
      if (a.progress >= 1.0) {
        a.status = 'completed';
        completed.push(a.id);
        // 技术加成
        if (a.techBoost && global.GM.environment && global.GM.environment.byRegion) {
          Object.keys(a.techBoost).forEach(function(tech) {
            Object.values(global.GM.environment.byRegion).forEach(function(r) {
              if (r.techLevel) r.techLevel[tech] = (r.techLevel[tech] || 0) + a.techBoost[tech];
            });
          });
        }
        if (global.addEB) global.addEB('徭役', a.name + ' 告竣（死亡 ' + Math.round(a.totalDeaths) + ' 丁）');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅵ 兵役
  // ═══════════════════════════════════════════════════════════════════

  function _tickMilitary(ctx, mr) {
    var P = global.GM.population;
    if (!P || !P.military || !P.military.enabled) return;
    var m = P.military;
    // 总可征兵基数
    var serviceAgeDing = P.deepFieldEffects && P.deepFieldEffects.serviceAgeDing ? P.deepFieldEffects.serviceAgeDing : _computeDeepServiceDing(P);
    var pool = (serviceAgeDing || P.national.ding || 0) - (P.fugitives || 0);
    // 军户 = 世袭
    if (m.types.junhu && m.types.junhu.enabled && P.byCategory.junhu) {
      m.types.junhu.strength = Math.round((P.byCategory.junhu.ding || 0) * 0.6);
    }
    // 府兵 = 府兵户 × 抽样
    if (m.types.fubing && m.types.fubing.enabled) {
      var fubingHouseholds = Math.round(P.national.households * 0.05);
      m.types.fubing.strength = fubingHouseholds; // 一户一丁
    }
    // 募兵/禁军 = 按军饷开支上限
    if (m.types.mubing && m.types.mubing.enabled) {
      var wageBudget = (global.GM.guoku && global.GM.guoku.money) || 0;
      var maxMubing = Math.floor(wageBudget / 20); // 每人每月 20 文
      if (m.types.mubing.strength < maxMubing * 0.6) {
        var recruit = Math.min(m.types.mubing.strength * m.maxExpansionRate * mr / 12, maxMubing - m.types.mubing.strength);
        m.types.mubing.strength += recruit;
      }
    }
    m.totalPool = pool;
    m.deepFieldEffects = {
      source: 'age-gender-service-ding',
      serviceAgeDing: serviceAgeDing,
      fugitives: P.fugitives || 0,
      totalPool: pool
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  迁徙（含六大历史事件）
  // ═══════════════════════════════════════════════════════════════════

  function _tickMigration(ctx, mr) {
    var P = global.GM.population;
    if (!P) return;
    // 行政叶是运行真值时，每个势力只在自己的叶级人口和首都之间迁徙。
    var groups = _factionLeafGroups(global.GM);
    var hasLeafPopulation = groups.some(function(group) {
      return group.leaves.some(function(leaf) { return leaf && leaf.populationDetail && Number(leaf.populationDetail.mouths) > 0; });
    });
    if (hasLeafPopulation) {
      _tickMigrationLeaf(ctx, mr, groups);
    } else {
      var capital = global.GM._capital || '京城';
      if (P.byRegion && P.byRegion[capital]) {
      Object.keys(P.byRegion).forEach(function(rid) {
        if (rid === capital) return;
        var r = P.byRegion[rid];
        var pullRate = 0.0001 * mr; // 月千分之一流入京畿
        var flow = Math.round(r.mouths * pullRate);
        if (flow > 0 && r.mouths > 10000) {
          _transferLegacyPopulationRows(r, P.byRegion[capital], flow, rid, capital);
        }
      });
      }
    }
    // 历史大迁徙事件——按 turn/century 触发
    if (!P.migrationEventStates || typeof P.migrationEventStates !== 'object' || Array.isArray(P.migrationEventStates)) P.migrationEventStates = {}; // arch-ok: 户籍权威写口创建战役迁徙状态
    if (!Array.isArray(P.triggeredMigrationEventIds)) P.triggeredMigrationEventIds = []; // arch-ok: 户籍权威写口创建已触发迁徙集合
    (P.migrationEvents || []).forEach(function(record) {
      if (record && record.id && P.triggeredMigrationEventIds.indexOf(record.id) < 0) P.triggeredMigrationEventIds.push(record.id); // arch-ok: 户籍权威写口迁移旧事件收据
    });
    var currentYear = _calendarYearForTurn(ctx.turn || global.GM.turn || 1, global.GM);
    var century = Math.floor((currentYear - 1) / 100) + 1;
    MIGRATION_EVENTS.forEach(function(e) {
      var state = P.migrationEventStates[e.id];
      if ((state && state.status === 'triggered') || P.triggeredMigrationEventIds.indexOf(e.id) >= 0) return;
      if (!(century >= e.century && currentYear % 100 < 30)) return;
      var result = _executeMigrationEvent(e, groups);
      if (result && result.ok) {
        P.migrationEventStates[e.id] = { status:'triggered', turn:Number(global.GM.turn) || 0, scale:result.scale }; // arch-ok: 户籍权威写口提交战役迁徙状态
        if (P.triggeredMigrationEventIds.indexOf(e.id) < 0) P.triggeredMigrationEventIds.push(e.id); // arch-ok: 户籍权威写口提交已触发迁徙 ID
      } else {
        P.migrationEventStates[e.id] = { // arch-ok: 户籍权威写口记录待处理迁徙状态
          status:'pending',
          lastAttemptTurn:Number(global.GM.turn) || 0,
          reason:String(result && result.reason || 'region-match-failed')
        };
      }
    });
  }

  function _capitalCandidatesForGroup(group) {
    var G = global.GM;
    var P = G.population;
    var values = [];
    function add(value) {
      var text = String(value == null ? '' : value).trim();
      if (text && values.indexOf(text) < 0) values.push(text);
    }
    if (group.isPlayer) {
      add(G._capital); add(G.capital); add(global.P && global.P.playerInfo && global.P.playerInfo.capital);
      add(global.P && global.P.playerInfo && global.P.playerInfo.capitalName);
      add(P && P.capital);
    }
    add(group.branch && group.branch.capital);
    add(group.branch && group.branch.capitalName);
    add(group.branch && group.branch.capitalChildId);
    add(group.faction && group.faction.capital);
    add(group.faction && group.faction.capitalName);
    return values;
  }

  function _findCapitalLeaf(group) {
    var candidates = _capitalCandidatesForGroup(group).map(_normPopulationName).filter(Boolean);
    for (var i = 0; i < group.leaves.length; i++) {
      var leaf = group.leaves[i];
      if (leaf && (leaf.isCapital || leaf.regionType === 'capital' || leaf.type === 'capital')) return leaf;
    }
    for (var j = 0; j < group.leaves.length; j++) {
      var current = group.leaves[j];
      var aliases = [current && current.id, current && current.name, current && current.capital, current && current.mapRegionId]
        .map(_normPopulationName).filter(Boolean);
      if (aliases.some(function(alias) {
        return candidates.some(function(candidate) { return alias === candidate || alias.indexOf(candidate) >= 0 || candidate.indexOf(alias) >= 0; });
      })) return current;
    }
    return null;
  }

  // S4·京畿虹吸按 faction 分账；任何来源与目标都必须属于同一 group。
  function _tickMigrationLeaf(ctx, mr, suppliedGroups) {
    var G = global.GM;
    var P = G.population;
    var groups = suppliedGroups || _factionLeafGroups(G);
    groups.forEach(function(group) {
      var capLeaf = _findCapitalLeaf(group);
      if (!capLeaf || !capLeaf.populationDetail) return;
      var pullRate = 0.0001 * mr;
      group.leaves.forEach(function(leaf) {
        if (leaf === capLeaf) return;
        var detail = leaf && leaf.populationDetail;
        if (!detail) return;
        var mouths = Number(detail.mouths) || 0;
        if (mouths <= 10000) return;
        var flow = Math.round(mouths * pullRate);
        if (flow > 0) {
          _transferPopulationBetweenLeaves(group, [leaf], capLeaf, flow, 'capital-pull');
        }
      });
    });
    var playerGroup = groups.find(function(group) { return group.isPlayer; });
    if (playerGroup) {
      var playerTotals = _leafPopulationTotals(playerGroup.leaves);
      P.national.mouths = playerTotals.mouths; // arch-ok: 户籍权威写口由玩家叶级真值聚合全国人口
      P.national.households = playerTotals.households; // arch-ok: 户籍权威写口由玩家叶级真值聚合全国户数
      P.national.ding = playerTotals.ding; // arch-ok: 户籍权威写口由玩家叶级真值聚合全国丁口
    }
    _refreshWorldPopulationSummary(G, groups);
    syncDemographicViews();
  }

  function _leafMatchesPopulationCandidates(leaf, candidates) {
    var aliases = _leafPopulationAliases(leaf);
    return (candidates || []).map(_normPopulationName).filter(Boolean).some(function(candidate) {
      return aliases.some(function(alias) {
        return alias === candidate || alias.indexOf(candidate) >= 0 || candidate.indexOf(alias) >= 0;
      });
    });
  }

  function _populationDivisionContainer(group) {
    if (!group) return null;
    if (Array.isArray(group.branch)) return group.branch;
    if (group.branch && Array.isArray(group.branch.divisions)) return group.branch.divisions;
    return null;
  }

  function _emptyPopulationBundle() {
    return { mouths:0, households:0, ding:0, byAge:{}, byGender:{} };
  }

  function _addBucketDelta(target, before, after) {
    Object.keys(before || {}).forEach(function(key) {
      var delta = Math.max(0, (Number(before[key]) || 0) - (Number(after && after[key]) || 0));
      target[key] = (Number(target[key]) || 0) + delta;
    });
  }

  function _removePopulationForTransfer(leaves, requested) {
    var bundle = _emptyPopulationBundle();
    var total = _leafPopulationTotals(leaves).mouths;
    var remaining = Math.min(Math.max(0, Math.round(Number(requested) || 0)), total);
    var remainingPool = total;
    (leaves || []).forEach(function(leaf, index) {
      var detail = leaf && leaf.populationDetail;
      if (!detail || remaining <= 0) return;
      var mouthsBefore = Math.max(0, Math.round(Number(detail.mouths) || 0));
      if (!mouthsBefore) return;
      var householdsBefore = Math.max(0, Math.round(Number(detail.households) || 0));
      var dingBefore = Math.max(0, Math.round(Number(detail.ding) || 0));
      var bucketsBefore = _ensureLeafDemographicBuckets(leaf, detail);
      var ageBefore = Object.assign({}, bucketsBefore.byAge);
      var genderBefore = Object.assign({}, bucketsBefore.byGender);
      var flow = index === leaves.length - 1
        ? Math.min(mouthsBefore, remaining)
        : Math.min(mouthsBefore, Math.round(remaining * mouthsBefore / Math.max(1, remainingPool)));
      var householdFlow = Math.min(householdsBefore, Math.round(householdsBefore * flow / Math.max(1, mouthsBefore)));
      var dingFlow = Math.min(dingBefore, Math.round(dingBefore * flow / Math.max(1, mouthsBefore)));
      detail.mouths = mouthsBefore - flow;
      detail.households = householdsBefore - householdFlow;
      detail.ding = dingBefore - dingFlow;
      var resized = _resizeLeafDemographicBuckets(leaf, detail, detail.mouths);
      _syncLeafPopulationMirrors(leaf, detail);
      leaf.yearlyNetMigration = (Number(leaf.yearlyNetMigration) || 0) - flow;
      bundle.mouths += flow;
      bundle.households += householdFlow;
      bundle.ding += dingFlow;
      _addBucketDelta(bundle.byAge, ageBefore, resized.byAge);
      _addBucketDelta(bundle.byGender, genderBefore, resized.byGender);
      remaining -= flow;
      remainingPool -= mouthsBefore;
    });
    bundle.byAge = _scaleBucketsToTotal(bundle.byAge, bundle.mouths, AGE_BUCKET_TEMPLATE);
    bundle.byGender = _scaleBucketsToTotal(bundle.byGender, bundle.mouths, GENDER_BUCKET_TEMPLATE);
    return bundle;
  }

  function _addPopulationBundleToLeaf(leaf, bundle) {
    var detail = leaf && leaf.populationDetail;
    if (!detail || !bundle) return { ok:false, reason:'target-region-invalid' };
    var buckets = _ensureLeafDemographicBuckets(leaf, detail);
    var bundleAge = _scaleBucketsToTotal(bundle.byAge || {}, bundle.mouths, AGE_BUCKET_TEMPLATE);
    var bundleGender = _scaleBucketsToTotal(bundle.byGender || {}, bundle.mouths, GENDER_BUCKET_TEMPLATE);
    detail.mouths = Math.max(0, Math.round(Number(detail.mouths) || 0)) + Math.max(0, Math.round(Number(bundle.mouths) || 0));
    detail.households = Math.max(0, Math.round(Number(detail.households) || 0)) + Math.max(0, Math.round(Number(bundle.households) || 0));
    detail.ding = Math.max(0, Math.round(Number(detail.ding) || 0)) + Math.max(0, Math.round(Number(bundle.ding) || 0));
    detail.byAge = Object.assign({}, buckets.byAge);
    detail.byGender = Object.assign({}, buckets.byGender);
    Object.keys(bundleAge).forEach(function(key) { detail.byAge[key] = (Number(detail.byAge[key]) || 0) + bundleAge[key]; });
    Object.keys(bundleGender).forEach(function(key) { detail.byGender[key] = (Number(detail.byGender[key]) || 0) + bundleGender[key]; });
    leaf.byAge = detail.byAge;
    leaf.byGender = detail.byGender;
    _syncLeafPopulationMirrors(leaf, detail);
    return { ok:true, detail:detail };
  }

  function _transferPopulationBetweenLeaves(group, sourceLeaves, targetLeaf, requested, cause) {
    sourceLeaves = (sourceLeaves || []).filter(function(leaf) {
      return leaf && leaf !== targetLeaf && leaf.populationDetail && Number(leaf.populationDetail.mouths) > 0;
    });
    if (!targetLeaf || !targetLeaf.populationDetail) return { ok:false, reason:'target-region-not-found' };
    if (!sourceLeaves.length) return { ok:false, reason:'source-region-not-found' };
    var bundle = _removePopulationForTransfer(sourceLeaves, requested);
    if (!bundle.mouths) return { ok:false, reason:'source-population-empty' };
    var added = _addPopulationBundleToLeaf(targetLeaf, bundle);
    if (!added.ok) return added;
    sourceLeaves.forEach(function(leaf) {
      if (group && group.isPlayer) _syncPlayerLegacyRow(global.GM.population, leaf, leaf.populationDetail);
    });
    if (group && group.isPlayer) _syncPlayerLegacyRow(global.GM.population, targetLeaf, targetLeaf.populationDetail);
    targetLeaf.yearlyNetMigration = (Number(targetLeaf.yearlyNetMigration) || 0) + bundle.mouths;
    return {
      ok:true,
      cause:String(cause || 'migration'),
      factionId:group && group.factionId,
      targetRegionId:String(targetLeaf.id || targetLeaf.name || ''),
      mouths:bundle.mouths,
      households:bundle.households,
      ding:bundle.ding,
      byAge:bundle.byAge,
      byGender:bundle.byGender
    };
  }

  function _transferLegacyPopulationRows(source, target, requested, sourceId, targetId) {
    if (!source || !target) return { ok:false, reason:'region-match-failed' };
    var sourceLeaf = { id:String(sourceId || 'legacy-source'), populationDetail:source, byAge:source.byAge, byGender:source.byGender };
    var targetLeaf = { id:String(targetId || 'legacy-target'), populationDetail:target, byAge:target.byAge, byGender:target.byGender };
    var result = _transferPopulationBetweenLeaves(null, [sourceLeaf], targetLeaf, requested, 'legacy-migration');
    source.byAge = sourceLeaf.populationDetail.byAge;
    source.byGender = sourceLeaf.populationDetail.byGender;
    target.byAge = targetLeaf.populationDetail.byAge;
    target.byGender = targetLeaf.populationDetail.byGender;
    source.yearlyNetMigration = (Number(source.yearlyNetMigration) || 0) - (result.ok ? result.mouths : 0);
    target.yearlyNetMigration = (Number(target.yearlyNetMigration) || 0) + (result.ok ? result.mouths : 0);
    return result;
  }

  function transferPopulation(options) {
    options = options || {};
    var G = global.GM;
    var groups = _factionLeafGroups(G);
    var factionTarget = _resolvePopulationTarget(G, options, groups);
    if (!factionTarget.ok || !factionTarget.group) return { ok:false, reason:factionTarget.reason || 'player-faction-not-found' };
    var group = factionTarget.group;
    var targetWanted = _normPopulationName(options.targetRegionId || options.targetRegionName);
    var targetLeaf = group.leaves.find(function(leaf) { return _leafPopulationAliases(leaf).indexOf(targetWanted) >= 0; }) || null;
    if (!targetLeaf) return { ok:false, reason:'target-region-not-found' };
    var sourceWanted = (Array.isArray(options.sourceRegionIds) ? options.sourceRegionIds : [options.sourceRegionId])
      .concat(Array.isArray(options.sourceRegionNames) ? options.sourceRegionNames : [options.sourceRegionName])
      .map(_normPopulationName).filter(Boolean);
    var sources = group.leaves.filter(function(leaf) {
      if (leaf === targetLeaf || !leaf || !leaf.populationDetail) return false;
      if (!sourceWanted.length) return true;
      return _leafPopulationAliases(leaf).some(function(alias) { return sourceWanted.indexOf(alias) >= 0; });
    });
    if (sourceWanted.length && sources.length !== sourceWanted.length) return { ok:false, reason:'source-region-not-found' };
    return _transferPopulationBetweenLeaves(group, sources, targetLeaf, options.mouths, options.cause);
  }

  function _takeExactBucketShare(state, total) {
    total = Math.max(0, Math.min(Math.round(Number(total) || 0), state.total));
    var keys = Object.keys(state.values);
    var out = {};
    if (!keys.length || !state.total || !total) {
      keys.forEach(function(key) { out[key] = 0; });
      return out;
    }
    var ranked = [];
    var assigned = 0;
    keys.forEach(function(key) {
      var available = Math.max(0, Math.round(Number(state.values[key]) || 0));
      var quota = available * total / state.total;
      var value = Math.min(available, Math.floor(quota));
      out[key] = value;
      assigned += value;
      ranked.push({ key:key, fraction:quota - value, available:available });
    });
    ranked.sort(function(a, b) { return b.fraction - a.fraction || String(a.key).localeCompare(String(b.key)); });
    var remaining = total - assigned;
    for (var i = 0; remaining > 0 && ranked.length; i = (i + 1) % ranked.length) {
      var row = ranked[i];
      if (out[row.key] >= row.available) continue;
      out[row.key]++;
      remaining--;
    }
    keys.forEach(function(key) { state.values[key] = Math.max(0, Number(state.values[key]) - out[key]); });
    state.total -= total;
    return out;
  }

  function _bundleShare(bundle, index, scalarShares, bucketState) {
    var share = {};
    ['mouths', 'households', 'ding'].forEach(function(field) {
      share[field] = scalarShares[field][index] || 0;
    });
    share.byAge = _takeExactBucketShare(bucketState.byAge, share.mouths);
    share.byGender = _takeExactBucketShare(bucketState.byGender, share.mouths);
    return share;
  }

  function materializeQiaozhiResettlement(options) {
    options = options || {};
    var G = global.GM;
    var groups = _factionLeafGroups(G);
    var target = _resolvePopulationTarget(G, options, groups);
    if (!target.ok || !target.group) return { ok:false, reason:target.reason || 'player-faction-not-found' };
    var group = target.group;
    var container = _populationDivisionContainer(group);
    if (!container) return { ok:false, reason:'division-container-unavailable' };
    var eventId = String(options.eventId || '').trim();
    var targetNames = (Array.isArray(options.targetNames) ? options.targetNames : [])
      .map(function(value) { return String(value || '').trim(); }).filter(Boolean);
    if (!eventId || !targetNames.length) return { ok:false, reason:'qiaozhi-spec-invalid' };
    var plannedIds = targetNames.map(function(name) {
      return 'tm_qiaozhi_' + _tmPopulationHash(String(group.factionId || group.key) + '|' + eventId + '|' + name);
    });
    if (plannedIds.some(function(id, index) { return plannedIds.indexOf(id) !== index; })) {
      return { ok:false, reason:'qiaozhi-spec-duplicate-target' };
    }
    var existing = group.leaves.filter(function(leaf) { return leaf && leaf.parentHistoric === eventId; });
    if (existing.length) {
      var actualIds = existing.map(function(leaf) { return String(leaf.id || ''); });
      var complete = actualIds.length === plannedIds.length && plannedIds.every(function(id) {
        return actualIds.filter(function(actualId) { return actualId === id; }).length === 1;
      });
      if (complete) return { ok:true, alreadyMaterialized:true, scale:_leafPopulationTotals(existing).mouths, factionId:group.factionId };
      return { ok:false, reason:'qiaozhi-target-conflict' };
    }
    var sourceCandidates = Array.isArray(options.sourceCandidates) ? options.sourceCandidates : [];
    var sourceLeaves = group.leaves.filter(function(leaf) {
      return leaf && leaf.populationDetail && Number(leaf.populationDetail.mouths) > 0 &&
        (!sourceCandidates.length || _leafMatchesPopulationCandidates(leaf, sourceCandidates));
    });
    if (!sourceLeaves.length) return { ok:false, reason:'source-region-not-found' };
    var sourceTotal = _leafPopulationTotals(sourceLeaves).mouths;
    var requested = Math.min(Math.max(0, Math.round(Number(options.mouths) || 0)), Math.round(sourceTotal * 0.3));
    if (!requested) return { ok:false, reason:'source-population-empty' };
    var existingIds = Object.create(null);
    groups.forEach(function(populationGroup) {
      populationGroup.leaves.forEach(function(leaf) {
        if (leaf && leaf.id != null) existingIds[String(leaf.id)] = true;
      });
    });
    if (plannedIds.some(function(stableId) { return existingIds[stableId]; })) {
      return { ok:false, reason:'qiaozhi-target-conflict' };
    }
    plannedIds.forEach(function(stableId) { existingIds[stableId] = true; });
    var bundle = _removePopulationForTransfer(sourceLeaves, requested);
    if (!bundle.mouths) return { ok:false, reason:'source-population-empty' };
    var scalarShares = {
      mouths:_allocateExactIntegers(bundle.mouths, targetNames.map(function() { return 1; })),
      households:_allocateExactIntegers(bundle.households, targetNames.map(function() { return 1; })),
      ding:_allocateExactIntegers(bundle.ding, targetNames.map(function() { return 1; }))
    };
    var bucketState = {
      byAge:{ values:Object.assign({}, bundle.byAge), total:bundle.mouths },
      byGender:{ values:Object.assign({}, bundle.byGender), total:bundle.mouths }
    };
    var created = targetNames.map(function(name, index) {
      var share = _bundleShare(bundle, index, scalarShares, bucketState);
      var stableId = plannedIds[index];
      var detail = {
        households:share.households,
        mouths:share.mouths,
        ding:share.ding,
        byAge:share.byAge,
        byGender:share.byGender
      };
      return {
        id:stableId,
        name:name,
        level:'qiaozhi',
        regionType:'qiaozhi',
        isQiaozhi:true,
        parentHistoric:eventId,
        factionId:group.factionId,
        populationDetail:detail,
        population:{ households:detail.households, mouths:detail.mouths, ding:detail.ding },
        byAge:detail.byAge,
        byGender:detail.byGender,
        byLegalStatus:{ qiaozhi:{ households:detail.households, mouths:detail.mouths, ding:detail.ding } },
        yearlyNetMigration:detail.mouths
      };
    });
    created.forEach(function(division) { container.push(division); }); // arch-ok: 户籍权威写口创建侨置叶级行政区
    groups = _factionLeafGroups(G);
    _refreshWorldPopulationSummary(G, groups);
    syncDemographicViews();
    return {
      ok:true,
      scale:bundle.mouths,
      households:bundle.households,
      ding:bundle.ding,
      factionId:group.factionId,
      regionIds:created.map(function(division) { return division.id; })
    };
  }

  function _tmPopulationHash(text) {
    var hash = 2166136261;
    text = String(text || '');
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = typeof Math.imul === 'function' ? Math.imul(hash, 16777619) : hash * 16777619;
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function _executeMigrationEvent(e, suppliedGroups) {
    var P = global.GM.population;
    if (!P) return { ok:false, reason:'population-unavailable' };
    if (!Array.isArray(P.migrationEvents)) P.migrationEvents = [];
    var groups = suppliedGroups || _factionLeafGroups(global.GM);
    var playerGroup = groups.find(function(group) { return group.isPlayer; });
    var from = null, to = null;
    if (playerGroup) {
      from = playerGroup.leaves.find(function(leaf) { return _normPopulationName(leaf && (leaf.name || leaf.id)).indexOf(_normPopulationName(e.fromRegion)) >= 0; });
      to = playerGroup.leaves.find(function(leaf) { return _normPopulationName(leaf && (leaf.name || leaf.id)).indexOf(_normPopulationName(e.toRegion)) >= 0; });
    }
    if (from && to && from.populationDetail && to.populationDetail) {
      var fromMouths = Math.max(0, Number(from.populationDetail.mouths) || 0);
      var scale = Math.max(0, Math.round(Math.min(e.scale, fromMouths * 0.3)));
      if (!scale) return { ok:false, reason:'source-population-empty' };
      var moved = _transferPopulationBetweenLeaves(playerGroup, [from], to, scale, e.id);
      if (!moved.ok) return moved;
      scale = moved.mouths;
    } else {
      if (!P.byRegion) return { ok:false, reason:'regions-unavailable' };
      var fromKey = Object.keys(P.byRegion).find(function(k) { return _normPopulationName(k).indexOf(_normPopulationName(e.fromRegion)) >= 0; });
      var toKey = Object.keys(P.byRegion).find(function(k) { return _normPopulationName(k).indexOf(_normPopulationName(e.toRegion)) >= 0; });
      if (!fromKey || !toKey) return { ok:false, reason:'region-match-failed' };
      from = P.byRegion[fromKey];
      to = P.byRegion[toKey];
      var scale = Math.max(0, Math.round(Math.min(e.scale, (Number(from.mouths) || 0) * 0.3)));
      if (!scale) return { ok:false, reason:'source-population-empty' };
      var legacyMoved = _transferLegacyPopulationRows(from, to, scale, fromKey, toKey);
      if (!legacyMoved.ok) return legacyMoved;
      scale = legacyMoved.mouths;
    }
    P.migrationEvents.push({ id: e.id, name: e.name, turn: global.GM.turn, scale: scale });
    if (global.addEB) global.addEB('迁徙', e.name + '：' + e.fromRegion + ' → ' + e.toRegion + ' 约 ' + Math.round(scale/10000) + ' 万口');
    return { ok:true, scale:scale };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  造册登记
  // ═══════════════════════════════════════════════════════════════════

  function _leafHiddenMouths(leaf) {
    var detail = leaf && leaf.populationDetail;
    if (!detail) return 0;
    return Math.max(0, Math.round(Number(detail.hiddenCount != null ? detail.hiddenCount : detail.hidden) || 0));
  }

  function _setLeafHiddenMouths(leaf, value) {
    if (!leaf || !leaf.populationDetail) return;
    var hidden = Math.max(0, Math.round(Number(value) || 0));
    leaf.populationDetail.hiddenCount = hidden;
    leaf.populationDetail.hidden = hidden;
    _syncLeafPopulationMirrors(leaf, leaf.populationDetail);
  }

  function _registrationHiddenTarget(P, group) {
    var leafTotal = (group && group.leaves || []).reduce(function(sum, leaf) {
      return sum + _leafHiddenMouths(leaf);
    }, 0);
    if (P && P._leafPopulationAuxAuthoritative === true) return leafTotal;
    return Math.max(leafTotal, Math.max(0, Math.round(Number(P && P.hiddenCount) || 0)));
  }

  function _materializeHiddenPopulation(P, group, target) {
    var leaves = (group && group.leaves || []).filter(function(leaf) {
      return leaf && leaf.populationDetail;
    });
    var current = leaves.reduce(function(sum, leaf) { return sum + _leafHiddenMouths(leaf); }, 0);
    target = Math.max(current, Math.max(0, Math.round(Number(target) || 0)));
    if (target > current && leaves.length) {
      var additions = _allocateExactIntegers(target - current, leaves.map(function(leaf) {
        return Math.max(0, Math.round(Number(leaf.populationDetail.mouths) || 0));
      }));
      leaves.forEach(function(leaf, index) {
        _setLeafHiddenMouths(leaf, _leafHiddenMouths(leaf) + additions[index]);
      });
    }
    P._leafPopulationAuxAuthoritative = true; // arch-ok: 户籍权威写口确认叶级隐口账本已物化
    P.hiddenCount = leaves.reduce(function(sum, leaf) { return sum + _leafHiddenMouths(leaf); }, 0); // arch-ok: 叶级隐口聚合全国视图
    return P.hiddenCount;
  }

  function registerHiddenPopulation(options) {
    options = options || {};
    var G = global.GM;
    var P = G && G.population;
    if (!P) return { ok:false, reason:'population-unavailable', mouths:0, households:0, ding:0 };
    var groups = _factionLeafGroups(G);
    var target = _resolvePopulationTarget(G, options, groups);
    if (!target.ok || !target.group || !target.group.leaves.length) {
      return { ok:false, reason:target.reason || 'player-faction-not-found', mouths:0, households:0, ding:0 };
    }
    var group = target.group;
    var available = _materializeHiddenPopulation(P, group, options.availableHidden);
    var requested = Math.min(available, Math.max(0, Math.round(Number(options.mouths) || 0)));
    var leaves = group.leaves.filter(function(leaf) { return _leafHiddenMouths(leaf) > 0; });
    var hiddenBefore = leaves.map(_leafHiddenMouths);
    var discoveries = _allocateExactIntegers(requested, hiddenBefore, hiddenBefore);
    var registered = { mouths:0, households:0, ding:0 };
    leaves.forEach(function(leaf, index) {
      var discoveredMouths = discoveries[index] || 0;
      if (!discoveredMouths) return;
      var detail = leaf.populationDetail;
      var localMouths = Math.max(0, Math.round(Number(detail.mouths) || 0));
      var localHouseholds = Math.max(0, Math.round(Number(detail.households) || 0));
      var localDing = Math.max(0, Math.round(Number(detail.ding) || 0));
      var mouthsPerHousehold = localMouths / Math.max(1, localHouseholds);
      if (!(mouthsPerHousehold > 0) || !isFinite(mouthsPerHousehold)) mouthsPerHousehold = 5;
      var dingRatio = localDing / Math.max(1, localMouths);
      var discoveredHouseholds = Math.min(localHouseholds, Math.round(discoveredMouths / mouthsPerHousehold));
      var discoveredDing = Math.min(localDing, Math.round(discoveredMouths * dingRatio));
      var legal = detail.byLegalStatus && typeof detail.byLegalStatus === 'object' ? detail.byLegalStatus : {};
      var yinhu = legal.yinhu && typeof legal.yinhu === 'object' ? legal.yinhu : {
        mouths:hiddenBefore[index],
        households:Math.round(hiddenBefore[index] / mouthsPerHousehold),
        ding:Math.round(hiddenBefore[index] * dingRatio)
      };
      var huangji = legal.huangji && typeof legal.huangji === 'object' ? legal.huangji : { mouths:0, households:0, ding:0 };
      yinhu.mouths = Math.max(0, Math.round(Number(yinhu.mouths) || 0) - discoveredMouths);
      yinhu.households = Math.max(0, Math.round(Number(yinhu.households) || 0) - discoveredHouseholds);
      yinhu.ding = Math.max(0, Math.round(Number(yinhu.ding) || 0) - discoveredDing);
      huangji.mouths = Math.max(0, Math.round(Number(huangji.mouths) || 0)) + discoveredMouths;
      huangji.households = Math.max(0, Math.round(Number(huangji.households) || 0)) + discoveredHouseholds;
      huangji.ding = Math.max(0, Math.round(Number(huangji.ding) || 0)) + discoveredDing;
      legal.yinhu = yinhu;
      legal.huangji = huangji;
      detail.byLegalStatus = legal;
      leaf.byLegalStatus = legal;
      _setLeafHiddenMouths(leaf, hiddenBefore[index] - discoveredMouths);
      if (!Array.isArray(leaf.populationRegistrationLedger)) leaf.populationRegistrationLedger = [];
      leaf.populationRegistrationLedger.push({
        turn:Number(G.turn) || 0,
        cause:String(options.cause || 'census-registration'),
        mouths:discoveredMouths,
        households:discoveredHouseholds,
        ding:discoveredDing
      });
      if (leaf.populationRegistrationLedger.length > 40) {
        leaf.populationRegistrationLedger.splice(0, leaf.populationRegistrationLedger.length - 40);
      }
      registered.mouths += discoveredMouths;
      registered.households += discoveredHouseholds;
      registered.ding += discoveredDing;
    });
    P.hiddenCount = group.leaves.reduce(function(sum, leaf) { return sum + _leafHiddenMouths(leaf); }, 0); // arch-ok: 造册后由叶级隐口聚合全国视图
    if (!P.meta || typeof P.meta !== 'object') P.meta = _defaultMeta();
    if (!Array.isArray(P.meta.registrationLedger)) P.meta.registrationLedger = [];
    P.meta.registrationLedger.push({
      turn:Number(G.turn) || 0,
      factionId:group.factionId,
      cause:String(options.cause || 'census-registration'),
      mouths:registered.mouths,
      households:registered.households,
      ding:registered.ding
    });
    if (P.meta.registrationLedger.length > 80) P.meta.registrationLedger.splice(0, P.meta.registrationLedger.length - 80);
    return Object.assign({ ok:true, factionId:group.factionId, hiddenRemaining:P.hiddenCount }, registered);
  }

  function _tickRegistration(ctx) {
    var P = global.GM.population;
    if (!P || !P.meta) return;
    var turnsSince = (ctx.turn || 0) - (P.meta.lastRegistrationTurn || 0);
    var cycleMonths = Math.max(0, Number(P.meta.registrationCycle) || 0) * 12;
    var cycleTurns = (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(cycleMonths) : cycleMonths;
    if (turnsSince < Math.max(1, Number(cycleTurns) || 1)) return;
    // 触发造册。hiddenCount 的单位是“口”，不能直接写进黄籍“户”。
    var cost = Math.round(P.national.households * 0.05);
    if (global.GM.guoku && global.GM.guoku.money !== undefined && global.GM.guoku.money >= cost) {
      // 造册经费走 FiscalEngine 真账(2026-07-04 收口)
      if (!global.FiscalEngine || typeof global.FiscalEngine.spendFromGuoku !== 'function') {
        throw new Error('户籍造册失败：财政写口不可用');
      }
      var groups = _factionLeafGroups(global.GM);
      var playerGroup = groups.find(function(group) { return group.isPlayer; });
      if (!playerGroup || !playerGroup.leaves.length) return;
      var availableHidden = _registrationHiddenTarget(P, playerGroup);
      var discoveredMouths = Math.round(availableHidden * 0.3);
      var payment = cost > 0 ? global.FiscalEngine.spendFromGuoku({ money: cost }, '户籍造册') : { ok:true };
      var deficit = payment && payment.deducted && payment.deducted.money && Number(payment.deducted.money.deficit) || 0;
      if (payment === false || (payment && payment.ok === false) || deficit > 0) {
        throw new Error('户籍造册失败：财政扣款未完成');
      }
      var registered = registerHiddenPopulation({
        factionId:playerGroup.factionId,
        mouths:discoveredMouths,
        availableHidden:availableHidden,
        cause:'census-registration'
      });
      if (!registered.ok) throw new Error('户籍造册失败：' + registered.reason);
      // 更新准确度——腐败降低
      var corrObj = global.GM.corruption;
      var corrRaw = corrObj && typeof corrObj === 'object'
        ? (typeof corrObj.trueIndex === 'number' ? corrObj.trueIndex : corrObj.overall)
        : corrObj;
      var corrupt = typeof corrRaw === 'number' && isFinite(corrRaw) ? corrRaw : 30;
      P.meta.registrationAccuracy = Math.max(0.5, 1.0 - corrupt / 100 * 0.5);
      P.meta.lastRegistrationTurn = ctx.turn || 0;
      if (global.addEB) global.addEB('户口', '大造黄册，核出隐口 ' + registered.mouths + ' 口、约 ' + registered.households + ' 户（准确度 ' + (P.meta.registrationAccuracy*100).toFixed(0) + '%）');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文
  // ═══════════════════════════════════════════════════════════════════

  function getAIContext() {
    var P = global.GM && global.GM.population;
    if (!P) return '';
    var lines = ['【户口】'];
    lines.push('朝代：' + P.dynasty + '；全国：户 ' + _fmt(P.national.households) + '，口 ' + _fmt(P.national.mouths) + '，丁 ' + _fmt(P.national.ding));
    if (P.fugitives > 10000) lines.push('逃户：' + _fmt(P.fugitives));
    if (P.hiddenCount > 10000) lines.push('隐户：' + _fmt(P.hiddenCount));
    if (P.deepFieldEffects && P.deepFieldEffects.serviceAgeDing) {
      lines.push('适役丁口：' + _fmt(P.deepFieldEffects.serviceAgeDing) + '；族教压力 ' + Math.round((P.deepFieldEffects.ethnicityFaithPressure || 0) * 100) + '%');
    }
    if (P.corvee && P.corvee.fullyCommuted) lines.push('役法：役银合一（一条鞭法后）');
    if (P.military && P.military.types) {
      var milLines = [];
      Object.keys(P.military.types).forEach(function(k) {
        if (P.military.types[k].enabled && P.military.types[k].strength > 1000) {
          milLines.push((MILITARY_TYPES[k] ? MILITARY_TYPES[k].name : k) + ' ' + _fmt(P.military.types[k].strength));
        }
      });
      if (milLines.length) lines.push('兵：' + milLines.join('，'));
    }
    if (P.largeCorveeActive && P.largeCorveeActive.length > 0) {
      lines.push('进行中大役：' + P.largeCorveeActive.filter(function(a){return a.status==='ongoing';}).map(function(a){return a.name + '(' + (a.progress*100).toFixed(0) + '%)';}).join('，'));
    }
    return lines.join('\n');
  }

  function _fmt(v) {
    v = Math.abs(v || 0);
    if (v >= 10000) return (v/10000).toFixed(1) + '万';
    return Math.round(v).toLocaleString();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    if (!global.GM || !global.GM.population) {
      var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null;
      init(sc);
    }
    var rawMr = Number(ctx.monthRatio);
    var mr = rawMr > 0 && isFinite(rawMr) ? rawMr : 1;
    var strict = ctx.strict === true;
    var failures = [];
    function runStep(label, fn) {
      try {
        fn();
      } catch(e) {
        (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] ' + label + ':') : console.error('[huji] ' + label + ':', e);
        if (strict) throw e;
        failures.push({ step: label, error: String(e && e.message || e) });
      }
    }
    runStep('dynamics', function() { _tickPopulationDynamics(ctx, mr); });
    runStep('deepFields', function() { _tickDeepFieldLinkages(ctx, mr); });
    runStep('corvee', function() { _tickCorvee(ctx, mr); });
    runStep('largeCorvee', function() { _tickLargeCorvee(ctx, mr); });
    runStep('military', function() { _tickMilitary(ctx, mr); });
    runStep('migration', function() { _tickMigration(ctx, mr); });
    runStep('registration', function() { _tickRegistration(ctx); });
    return { ok: failures.length === 0, failures: failures };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.HujiEngine = {
    init: init,
    tick: tick,
    applyPopulationLoss: applyPopulationLoss,
    transferPopulation: transferPopulation,
    registerHiddenPopulation: registerHiddenPopulation,
    materializeQiaozhiResettlement: materializeQiaozhiResettlement,
    syncDemographicViews: syncDemographicViews,
    startLargeCorvee: startLargeCorvee,
    getAIContext: getAIContext,
    CATEGORY_TEMPLATES: CATEGORY_TEMPLATES,
    CORVEE_TYPES: CORVEE_TYPES,
    MILITARY_TYPES: MILITARY_TYPES,
    LARGE_CORVEE_PRESETS: LARGE_CORVEE_PRESETS,
    GARRISON_PRESETS: GARRISON_PRESETS,
    MIGRATION_EVENTS: MIGRATION_EVENTS,
    DYNASTY_DING_AGE: DYNASTY_DING_AGE,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
