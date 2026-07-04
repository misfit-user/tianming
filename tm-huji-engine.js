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

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

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
      _ensureDeepDemographics(G.population);
      return;
    }

    var dynasty = _inferDynasty(sc);
    var config = (sc && sc.populationConfig) || {};

    var initial = config.initial || {};
    var households = initial.nationalHouseholds || 1000000;
    var mouthsPerHh = DYNASTY_MOUTHS_PER_HOUSEHOLD[dynasty] || DYNASTY_MOUTHS_PER_HOUSEHOLD.default;
    var mouths = initial.nationalMouths || Math.round(households * mouthsPerHh);
    var dingRatio = DYNASTY_DING_PER_MOUTHS[dynasty] || DYNASTY_DING_PER_MOUTHS.default;
    var ding = initial.nationalDing || Math.round(mouths * dingRatio);

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
      migrationEvents: []       // 触发的迁徙事件
    };
    _ensureDeepDemographics(G.population);
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
    var keys = Object.keys(template || obj || {});
    if (!keys.length) return {};
    var current = _sumObj(obj);
    var out = {};
    var assigned = 0;
    keys.forEach(function(k, idx) {
      var base = current > 0 ? Number(obj[k] || 0) / current : Number(template[k] || 0);
      var val = idx === keys.length - 1 ? Math.max(0, total - assigned) : Math.round(total * base);
      out[k] = val;
      assigned += val;
    });
    return out;
  }

  function _ensureRegionDeepFields(r) {
    if (!r) return;
    var mouths = Math.max(0, Math.round(r.mouths || 0));
    var ageTemplate = {
      age_0_10:0.20, age_11_20:0.18, age_21_30:0.15, age_31_40:0.13,
      age_41_50:0.11, age_51_60:0.10, age_61_70:0.08, age_71_plus:0.05
    };
    r.byAge = _scaleBucketsToTotal(r.byAge || r.ageLayers, mouths, ageTemplate);
    var gender = r.byGender || r.gender || {};
    r.byGender = _scaleBucketsToTotal(gender, mouths, { male:0.52, female:0.48 });
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
      byAge = _scaleBucketsToTotal({}, P.national.mouths || 0, {
        age_0_10:0.20, age_11_20:0.18, age_21_30:0.15, age_31_40:0.13,
        age_41_50:0.11, age_51_60:0.10, age_61_70:0.08, age_71_plus:0.05
      });
      byGender = _scaleBucketsToTotal({}, P.national.mouths || 0, { male:0.52, female:0.48 });
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
      byType[k] = { daysPerDing: CORVEE_TYPES[k].daysPerDing, totalDays: 0, fulfilled: 0, commutedRate: 0, deaths: 0 };
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
      burdenThreshold: 0.40
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
      registrationCost: { money: 0, grain: 0 }
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
    // S1·人口自下而上(P.conf.populationBottomUpEnabled·默认关)：增长发生在叶·按本地民心·写叶 populationDetail·
    // national 增量同步、maintain(bridge:377) 之后从 Σ叶 精确重建。详设 docs/population-bottom-up-redesign-2026-06.md
    if (global.P && global.P.conf && global.P.conf.populationBottomUpEnabled) {
      return _tickPopulationLeafGrowth(ctx, mr);
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
    var births = Math.round(P.national.mouths * birthRate * mr / 12);
    var deaths = Math.round(P.national.mouths * deathRate * mr / 12);
    var net = births - deaths;
    P.national.mouths = Math.max(100000, P.national.mouths + net);
    // 丁同比变化
    var dingRatio = P.national.ding / Math.max(1, P.national.mouths);
    P.national.ding = Math.round(P.national.mouths * dingRatio);
    // 户同比变化
    var mphh = P.national.mouths / Math.max(1, P.national.households);
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
    d.lastYearNet = net * 12;
  }

  // S1-S4·人口自下而上 取叶(2026-06-20 真机修)：getLeafDivisions(ah) 默认只取 'player' faction
  // (getTopLevelDivisions: ah[factionId||'player'])·须遍历所有 faction·否则 NPC 势力地块人口静止。
  function _allLeafDivisions(G) {
    var ah = G && G.adminHierarchy;
    if (!ah) return [];
    var IB = global.IntegrationBridge;
    if (!IB || typeof IB.getLeafDivisions !== 'function') return [];
    var leaves = [];
    Object.keys(ah).forEach(function(facId) {
      var fl = IB.getLeafDivisions(ah, facId) || [];
      for (var i = 0; i < fl.length; i++) { if (leaves.indexOf(fl[i]) < 0) leaves.push(fl[i]); }
    });
    return leaves;
  }

  // S1·人口自下而上：叶级增长(先只接本地民心)·写叶 populationDetail·national = Σ叶 增量同步。
  // 详设 docs/population-bottom-up-redesign-2026-06.md §2.1-2.2。S2 再接粮食供需/生活/赋役，S3 调粮。
  function _tickPopulationLeafGrowth(ctx, mr) {
    var P = global.GM.population;
    var G = global.GM;
    var d = P.dynamics;
    // 全国基准率(年景因子全国级·作各叶基准·与原逻辑同源)
    var environmentLoad = (G.environment && G.environment.nationalLoad) || 0.5;
    var disaster = (G.vars && G.vars.disasterLevel) || 0;
    var war = (G.activeWars || []).length;
    var baseBirth = d.birthRateBase + (d.prosperityBonus || 0) - Math.max(0, environmentLoad - 1) * 0.005;
    if (disaster > 0.3) baseBirth -= 0.01;
    var baseDeath = d.deathRateBase + (d.agingPenalty || 0) + (d.diseaseBoost || 0);
    if (disaster > 0.3) baseDeath += disaster * 0.05;
    if (war > 0) baseDeath += Math.min(0.03, war * 0.01);
    if (environmentLoad > 1.2) baseDeath += (environmentLoad - 1.2) * 0.02;
    // 丁/户比例(叶级先共享全国比例·S2 视需叶级化)
    var dingRatio = P.national.ding / Math.max(1, P.national.mouths);
    var mphh = P.national.mouths / Math.max(1, P.national.households);
    // 遍历叶(2026-06-20 真机修：遍历所有 faction·非仅 player)·各叶按本地民心算生死·写叶 populationDetail
    var leaves = _allLeafDivisions(G);
    var totBirths = 0, totDeaths = 0, totNet = 0;
    leaves.forEach(function(leaf) {
      var pd = leaf && leaf.populationDetail;
      if (!pd) return;
      var mouths = Number(pd.mouths) || 0;
      if (mouths <= 0) return;
      var minxin = Number(leaf.minxin);
      if (!isFinite(minxin)) minxin = Number(leaf.minxinLocal);
      if (!isFinite(minxin)) minxin = 50;
      // S2·粮食供需(马尔萨斯核心·接 renli)：载力 load = 口粮需求/粮食供给(含调入)·>1 缺粮
      var rid = String(leaf.id || leaf.name || '');
      var rg = (G.renli && G.renli.byRegion) ? (G.renli.byRegion[rid] || (leaf.name ? G.renli.byRegion[leaf.name] : null)) : null;
      var load = 1;  // 无 renli 账(未种子)→中性·走民心/生活驱动
      if (rg) {
        var grainSupply = (Number(rg.grainOutput) || 0) + (Number(leaf._grainInflowThisTurn) || 0);  // +调入(S3 填)
        var grainDemand = Number(rg.foodNeed) || 0;  // renli:282 = mouths×SUBSIST·随人口(马尔萨斯闭环)
        if (grainDemand > 0) load = grainSupply > 0 ? grainDemand / grainSupply : 2;
      }
      // S2·生活水平(prosperity→生育)·灾异(death↑)·赋役(corvee→少生)
      var prosperity = Number(leaf.prosperity); if (!isFinite(prosperity)) prosperity = 50;
      var lifeLv = (prosperity - 50) / 100;
      var rd = leaf.recentDisasters;
      var hasDis = Array.isArray(rd) ? rd.length > 0 : !!rd;
      var corvee = rg ? Math.max(0, Math.min(1, Number(rg.corveeRate) || 0)) : 0;
      var localBirth = baseBirth
        * (1 + (minxin - 50) / 100 * 0.4)                  // 民心高→生育↑
        * (1 + lifeLv * 0.3)                               // 生活好→生育↑
        * Math.max(0.3, Math.min(1.1, 1.1 - load * 0.3))   // 粮紧(load高)→生育↓
        * (1 - corvee * 0.2);                              // 役重→生育↓
      var localDeath = baseDeath
        * (1 - (minxin - 50) / 100 * 0.25)                 // 民心高→死亡↓
        * (1 + (hasDis ? 0.5 : 0))                         // 灾异→死亡↑
        * (1 + Math.max(0, load - 1) * 0.6);               // 缺粮(load>1)→饥荒死亡↑
      var births = Math.round(mouths * localBirth * mr / 12);
      var deaths = Math.round(mouths * localDeath * mr / 12);
      var net = births - deaths;
      pd.mouths = Math.max(0, mouths + net);                         // 写叶(增长落点)
      pd.households = Math.round(pd.mouths / mphh);
      pd.ding = Math.round(pd.mouths * dingRatio);
      leaf.yearlyBirths = (leaf.yearlyBirths || 0) + births;
      leaf.yearlyDeaths = (leaf.yearlyDeaths || 0) + deaths;
      totBirths += births; totDeaths += deaths; totNet += net;
      if (leaf._grainInflowThisTurn) leaf._grainInflowThisTurn = 0;  // S3·调粮用后清零(下回合 local action 重计)
    });
    // national 增量同步(maintain:377 之后从 Σ叶 精确重建·守恒 Σ叶 = national)
    P.national.mouths = Math.max(100000, P.national.mouths + totNet);
    P.national.ding = Math.round(P.national.mouths * dingRatio);
    P.national.households = Math.round(P.national.mouths / mphh);
    // 年度日志(复用原·全国口径)
    if (!d._yearlyAccumBirths) d._yearlyAccumBirths = 0;
    if (!d._yearlyAccumDeaths) d._yearlyAccumDeaths = 0;
    d._yearlyAccumBirths += totBirths;
    d._yearlyAccumDeaths += totDeaths;
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
    d.lastYearNet = totNet * 12;
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
    var activeWar = Array.isArray(G.activeWars) && G.activeWars.length > 0;

    Object.keys(P.byRegion).forEach(function(rid) {
      var r = P.byRegion[rid];
      _ensureRegionDeepFields(r);

      if (activeWar && r.byGender && typeof r.byGender.male === 'number') {
        var maleLoss = Math.round(r.byGender.male * 0.002 * mr);
        if (maleLoss > 0) {
          r.byGender.male = Math.max(0, r.byGender.male - maleLoss);
          r.yearlyDeaths = (r.yearlyDeaths || 0) + maleLoss;
          ledger.push({ kind:'gender-war-loss', regionId:rid, maleLoss:maleLoss });
        }
      }

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

  function _tickCorvee(ctx, mr) {
    var P = global.GM.population;
    if (!P || !P.corvee || !P.corvee.enabled) return;
    var c = P.corvee;
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
      type.totalDays += req;
      type.fulfilled += req * (1 - (global.GM.population.fugitives || 0) / Math.max(1, totalDing));
      // 死亡
      var dyingDing = effectiveDing * t.deathRate * mr / 12 * (CATEGORY_TEMPLATES[k] ? CATEGORY_TEMPLATES[k].corveeLevel || 1 : 1);
      type.deaths += dyingDing;
      // 汇入全国死亡
      P.national.ding = Math.max(0, P.national.ding - dyingDing);
      P.national.mouths = Math.max(0, P.national.mouths - dyingDing);
    });
    // 逃役——burden 超过阈值
    var corveeBurden = c.byType.junyi.totalDays + c.byType.gongyi.totalDays;
    corveeBurden = corveeBurden / Math.max(1, effectiveDing * 365);
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
      a.totalDeaths += deathsThisMonth;
      P.national.ding = Math.max(0, P.national.ding - deathsThisMonth);
      P.national.mouths = Math.max(0, P.national.mouths - deathsThisMonth);
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
    // 京畿虹吸（S4·人口自下而上：开关开走叶级 populationDetail·否则原 byRegion）
    var capital = global.GM._capital || '京城';
    if (global.P && global.P.conf && global.P.conf.populationBottomUpEnabled) {
      _tickMigrationLeaf(ctx, mr, capital);
    } else if (P.byRegion && P.byRegion[capital]) {
      Object.keys(P.byRegion).forEach(function(rid) {
        if (rid === capital) return;
        var r = P.byRegion[rid];
        var pullRate = 0.0001 * mr; // 月千分之一流入京畿
        var flow = Math.round(r.mouths * pullRate);
        if (flow > 0 && r.mouths > 10000) {
          r.mouths -= flow;
          P.byRegion[capital].mouths += flow;
          r.yearlyNetMigration -= flow;
          P.byRegion[capital].yearlyNetMigration = (P.byRegion[capital].yearlyNetMigration || 0) + flow;
        }
      });
    }
    // 历史大迁徙事件——按 turn/century 触发
    var currentYear = global.GM.year || 1;
    var century = Math.floor(currentYear / 100);
    MIGRATION_EVENTS.forEach(function(e) {
      if (e._triggered) return;
      if (century >= e.century && !e._triggered && currentYear % 100 < 30) {
        // 触发
        e._triggered = true;
        _executeMigrationEvent(e);
      }
    });
  }

  // S4·人口自下而上：京畿虹吸叶级化(非首都叶 → 首都叶·守恒叶间转移·写 populationDetail·与增长同源)
  function _tickMigrationLeaf(ctx, mr, capital) {
    var G = global.GM;
    var P = G.population;
    var leaves = _allLeafDivisions(G);  // (2026-06-20 真机修：遍历所有 faction)
    if (!leaves.length) return;
    var dingRatio = P.national.ding / Math.max(1, P.national.mouths);
    var mphh = P.national.mouths / Math.max(1, P.national.households);
    var capLeaf = null;
    for (var i = 0; i < leaves.length; i++) {
      var lid = String(leaves[i].id || leaves[i].name || '');
      if (lid === capital || leaves[i].name === capital) { capLeaf = leaves[i]; break; }
    }
    if (!capLeaf) return;  // 无首都叶→不虹吸(避免流出无接收·破坏守恒·对齐原 byRegion 的 if(P.byRegion[capital]) 守卫)
    var pullRate = 0.0001 * mr;  // 月千分之一流入京畿(与原 byRegion 逻辑同率)
    var totalFlow = 0;
    leaves.forEach(function(l) {
      if (l === capLeaf) return;
      var pd = l.populationDetail; if (!pd) return;
      var mouths = Number(pd.mouths) || 0;
      if (mouths <= 10000) return;
      var flow = Math.round(mouths * pullRate);
      if (flow > 0) {
        pd.mouths = mouths - flow;
        pd.households = Math.round(pd.mouths / mphh);
        pd.ding = Math.round(pd.mouths * dingRatio);
        l.yearlyNetMigration = (l.yearlyNetMigration || 0) - flow;
        totalFlow += flow;
      }
    });
    if (capLeaf && capLeaf.populationDetail && totalFlow > 0) {
      var cpd = capLeaf.populationDetail;
      cpd.mouths = (Number(cpd.mouths) || 0) + totalFlow;
      cpd.households = Math.round(cpd.mouths / mphh);
      cpd.ding = Math.round(cpd.mouths * dingRatio);
      capLeaf.yearlyNetMigration = (capLeaf.yearlyNetMigration || 0) + totalFlow;
    }
  }

  function _executeMigrationEvent(e) {
    var P = global.GM.population;
    if (!P || !P.byRegion) return;
    // 找对应区域
    var fromKey = Object.keys(P.byRegion).find(function(k) { return k.indexOf(e.fromRegion) >= 0; });
    var toKey = Object.keys(P.byRegion).find(function(k) { return k.indexOf(e.toRegion) >= 0; });
    if (!fromKey || !toKey) return;
    var from = P.byRegion[fromKey];
    var to = P.byRegion[toKey];
    var scale = Math.min(e.scale, from.mouths * 0.3);
    from.mouths -= scale;
    to.mouths += scale;
    P.migrationEvents.push({ id: e.id, name: e.name, turn: global.GM.turn, scale: scale });
    if (global.addEB) global.addEB('迁徙', e.name + '：' + e.fromRegion + ' → ' + e.toRegion + ' 约 ' + Math.round(scale/10000) + ' 万口');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  造册登记
  // ═══════════════════════════════════════════════════════════════════

  function _tickRegistration(ctx) {
    var P = global.GM.population;
    if (!P || !P.meta) return;
    var turnsSince = (ctx.turn || 0) - (P.meta.lastRegistrationTurn || 0);
    if (turnsSince < P.meta.registrationCycle * 12) return;
    // 触发造册
    var cost = Math.round(P.national.households * 0.05);
    if (global.GM.guoku && global.GM.guoku.money !== undefined && global.GM.guoku.money >= cost) {
      // 造册经费走 FiscalEngine 真账(2026-07-04 收口)
      if (global.FiscalEngine && global.FiscalEngine.spendFromGuoku) global.FiscalEngine.spendFromGuoku({ money: cost }, '户籍造册');
      P.meta.lastRegistrationTurn = ctx.turn || 0;
      // 更新准确度——腐败降低
      var corrObj = global.GM.corruption;
      var corrRaw = corrObj && typeof corrObj === 'object'
        ? (typeof corrObj.trueIndex === 'number' ? corrObj.trueIndex : corrObj.overall)
        : corrObj;
      var corrupt = typeof corrRaw === 'number' && isFinite(corrRaw) ? corrRaw : 30;
      P.meta.registrationAccuracy = Math.max(0.5, 1.0 - corrupt / 100 * 0.5);
      // 发现隐户（部分）
      var discovered = Math.round(P.hiddenCount * 0.3);
      P.hiddenCount = Math.max(0, P.hiddenCount - discovered);
      if (P.byLegalStatus.huangji) P.byLegalStatus.huangji.households += discovered;
      if (global.addEB) global.addEB('户口', '大造黄册，发现隐户 ' + discovered + ' 户（准确度 ' + (P.meta.registrationAccuracy*100).toFixed(0) + '%）');
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
    var mr = ctx.monthRatio || 1;
    try { _tickPopulationDynamics(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] dynamics:') : console.error('[huji] dynamics:', e); }
    try { _tickDeepFieldLinkages(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] deepFields:') : console.error('[huji] deepFields:', e); }
    try { _tickCorvee(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] corvee:') : console.error('[huji] corvee:', e); }
    try { _tickLargeCorvee(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] largeCorvee:') : console.error('[huji] largeCorvee:', e); }
    try { _tickMilitary(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] military:') : console.error('[huji] military:', e); }
    try { _tickMigration(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] migration:') : console.error('[huji] migration:', e); }
    try { _tickRegistration(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'huji] registration:') : console.error('[huji] registration:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.HujiEngine = {
    init: init,
    tick: tick,
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
