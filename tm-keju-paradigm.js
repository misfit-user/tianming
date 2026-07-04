// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-paradigm.js — Stage 2·Phase L·Slice L1·科举 paradigm 主 module
 *
 * 职责·建 GM._kejuParadigm namespace·把"什么是科举"全 field 化·11 类 30+ 字段
 *      未来 L2-L50 改革面板 / 议政 / apply diff·全读写这个对象
 *
 * 暴露·_kjpInitParadigm / _kjpMigrate / _kjpResetToPreset
 *      _kjpExport / _kjpImport / _kjpValidateParadigm
 *      _kjpGetSubject / _kjpGetTier / _kjpHasSubject
 *      _kjpDescribeParadigm (debug 用)
 *
 * 集成点·
 *   - init·tm-keju-runtime.js initKejuSystem 尾部调 _kjpInitParadigm
 *   - load·tm-save-lifecycle.js fullLoadGame 后调 _kjpMigrate
 *   - save·_kjpSerialize 自动包含·_prepareGMForSave 复制
 *
 * red line·
 *   - L1 是 dormant 数据·不改 game behavior·Stage 1 进士流程不读
 *   - flag gate·L1 无 flag (因纯 namespace + migration·0 风险)·L2+ 加 P.conf.useNewKejuL
 *   - Stage 1 兼容·P.keju.tiers 不变·KejuTier 不破·migration 容错
 *   - 跟 tm-keju-presets.js 复用·避免 600 行 duplication
 *   - 9 朝代 paradigm-specific 字段走 tm-keju-paradigm-presets.js (_kjpGetParadigmAddonByEra)
 *
 * Schema·见 web/docs/keju-stage2-plan.md §7.1
 * Sub-phases·L1 (本文件)·L2-L50 (后续) 均依本 schema
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·常量
  // ════════════════════════════════════════════════════════════════

  var PARADIGM_VERSION = 2;   // L8·v2·_reformChronicle [year]→[histId][year]
  var VALID_IDEOLOGIES = ['traditional', 'reformist', 'practical', 'modern'];
  var VALID_RETAKE = ['no', 'allow_3x', 'unlimited'];
  var VALID_RANKING = ['by_score', 'by_origin', 'by_party', 'by_recommendation'];
  var VALID_SCHOOL_INTEGRATION = ['required', 'optional', 'none', 'alternative'];
  var VALID_SHADOW = ['high', 'low', 'none'];

  // ════════════════════════════════════════════════════════════════
  // §1·辅助·从 base preset (tm-keju-presets.js) 派生 tier paradigm 字段
  // ════════════════════════════════════════════════════════════════

  /**
   * 把 KejuTier (Stage 1) 升级为 paradigm tier (加 id / type / exemptionConditions / alternativePaths)
   * 复用·不破·KejuTier 原字段全保留
   */
  function _kjpUpgradeTierToParadigm(tier, idx) {
    if (!tier || typeof tier !== 'object') return null;
    var name = tier.name || '';
    // 生成 canonical id·去除标点 + 转拼音·若无 trans 用 idx
    var id = _kjpGenTierId(name, idx);
    var scope = tier.level || tier.scope || 'local';
    var type = 'test';
    if (/殿试|御前/.test(name)) type = 'ceremony';
    else if (/复试|审|阅/.test(name)) type = 'review';
    return {
      // === 复用 KejuTier 字段 ===
      name: name,
      level: scope,
      scope: scope,                   // alias
      interactive: !!tier.interactive,
      daysCost: parseInt(tier.daysCost, 10) || 30,
      tierKind: tier.tierKind || 'selection',
      examinerLevel: tier.examinerLevel || scope,
      contentType: tier.contentType || 'classics',
      passRate: typeof tier.passRate === 'number' ? tier.passRate : 0.2,
      desc: tier.desc || '',
      // === paradigm-specific 新加字段 ===
      id: id,
      frequency: tier.frequency || 3,             // 年/科·default 3
      durationDays: parseInt(tier.daysCost, 10) || 30,
      type: type,                                 // 'test' / 'review' / 'ceremony'
      exemptionConditions: tier.exemptionConditions || [],   // L20 三舍法
      alternativePaths: tier.alternativePaths || []          // 恩荫 / 荐举
    };
  }

  function _kjpGenTierId(name, idx) {
    var map = {
      '童试': 'tongshi', '县试': 'xianshi', '府试': 'fushi', '院试': 'yuanshi',
      '州试': 'zhoushi', '解试': 'jieshi', '乡试': 'xiangshi', '省试': 'shengshi',
      '会试': 'huishi',  '殿试': 'dianshi', '复试': 'fushi_review'
    };
    if (map[name]) return map[name];
    return 'tier_' + (idx != null ? idx : Math.random().toString(36).slice(2, 8));
  }

  // ════════════════════════════════════════════════════════════════
  // §2·主 init·_kjpInitParadigm
  //    从 P.keju + base preset + paradigm addon 合成 paradigm
  // ════════════════════════════════════════════════════════════════

  /**
   * init paradigm·幂等·已 init 不重做
   * @param {object} opts - { force: bool·强制重 init·破坏 history }
   */
  function _kjpInitParadigm(opts) {
    opts = opts || {};
    if (typeof GM === 'undefined' || !GM) return null;
    if (GM._kejuParadigm && GM._kejuParadigm.version >= PARADIGM_VERSION && !opts.force) {
      return GM._kejuParadigm;
    }
    if (!(P && P.keju)) return null;
    // keju 未启用·跳过 init·留 namespace 为 undefined
    if (!P.keju.enabled) return null;

    var era = _kjpResolveEra();
    var basePreset = null;
    var addon = null;
    try {
      if (typeof _kjGetPresetByEra === 'function') basePreset = _kjGetPresetByEra(era);
    } catch (_) { basePreset = null; }
    try {
      if (typeof _kjpGetParadigmAddonByEra === 'function') addon = _kjpGetParadigmAddonByEra(era);
    } catch (_) { addon = null; }
    if (!addon) {
      try { console.warn('[L1] paradigm addon 未加载·fallback 默认 (明)'); } catch(_){}
      addon = _kjpDefaultAddon();
    }

    // tiers·复用 P.keju.tiers (已经过 _kjUpgradeTier·Stage 1 升级)
    var rawTiers = Array.isArray(P.keju.tiers) ? P.keju.tiers : (basePreset ? basePreset.tiers : []);
    var paradigmTiers = rawTiers.map(_kjpUpgradeTierToParadigm).filter(function(t) { return !!t; });

    var paradigm = {
      // ===== Meta =====
      version: PARADIGM_VERSION,
      initYear: GM.year || (P.time && P.time.year) || 0,
      initBy: opts.initBy || 'init',
      initEra: era,

      // ===== A·题目层 =====
      subjects: _kjpCloneSubjects(addon.subjects || []),

      // ===== B·tier 层 =====
      tiers: paradigmTiers,
      examInterval: addon.examInterval != null ? addon.examInterval : (P.keju.examInterval || 3),
      retakePolicy: addon.retakePolicy || 'allow_3x',

      // ===== C·考生层 =====
      candidateRules: _deepClone(addon.candidateRules || _kjpDefaultCandidateRules()),

      // ===== D·主考层 =====
      examinerRules: _deepClone(addon.examinerRules || _kjpDefaultExaminerRules()),

      // ===== E·录取层 =====
      quota: _deepClone(addon.quota || _kjpDefaultQuota()),
      rankingRule: addon.rankingRule || 'by_score',

      // ===== F·授官层 =====
      allocationRules: _deepClone(addon.allocationRules || _kjpDefaultAllocationRules()),

      // ===== G·身份层 =====
      graduateTitle: addon.graduateTitle || '进士',
      cohortBondStrength: addon.cohortBondStrength || 'strong',
      mentorLineage: addon.mentorLineage != null ? !!addon.mentorLineage : true,

      // ===== H·联动层 =====
      schoolIntegration: addon.schoolIntegration || 'optional',
      taxPrivilege: _deepClone(addon.taxPrivilege || { jinshi: true, juren: true, xiucai: false }),
      shadow: addon.shadow || 'low',
      clanPrivilege: !!addon.clanPrivilege,

      // ===== I·仪轨层 =====
      ceremony: _deepClone(addon.ceremony || _kjpDefaultCeremony()),

      // ===== J·惩罚层 =====
      penalties: _deepClone(addon.penalties || _kjpDefaultPenalties()),

      // ===== K·语言层 =====
      language: addon.language || 'classical_chinese',

      // ===== L·元 paradigm 层 =====
      ideology: addon.ideology || 'traditional',

      // ===== History + 改革 (空·待 L2-L50 填) =====
      history: [],
      _reformChronicle: {},
      _applyDelay: 0,
      _reformInProgress: null,

      // ===== 跟 base preset 联动·特科 / 书院 / 宦官 / 门生 (Stage 2·G/H/I/F·复用 base) =====
      _basePresetSnapshot: basePreset ? {
        specialExamCalendar: basePreset.specialExamCalendar,
        schoolNetworkInit: basePreset.schoolNetworkInit,
        eunuchInterferenceInit: basePreset.eunuchInterferenceInit,
        discipleGraphSeed: basePreset.discipleGraphSeed
      } : null
    };

    // L11·C5·force=true 时·清 _inheritance 旧 cache·防 load 新剧本仍见前剧本的 inheritance toast
    if (opts.force && GM._kejuParadigm && GM._kejuParadigm._inheritance) {
      try { GM._kejuParadigm._inheritance = null; } catch(_){}
    }
    GM._kejuParadigm = paradigm;

    // chronicle entry·user 可见 baseline 立
    // C3/C4 修·按 initBy 差异化 text·区分 init/migration/reset
    try {
      if (Array.isArray(GM._chronicle)) {
        var ib = paradigm.initBy || 'init';
        var verb = (ib === 'migration') ? '已迁 (旧存档自动升级)' :
                   (ib === 'reset')     ? '已重置' :
                                          '立';
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
          type: 'keju-paradigm-' + (ib === 'init' ? 'init' : ib),
          text: (era || '本朝') + ' 科举 paradigm ' + verb + '·' + paradigm.subjects.length + ' 科·' +
                paradigm.tiers.length + ' tier·' + paradigm.quota.total + ' 名',
          tags: ['科举', 'paradigm', ib, era]
        });
      }
    } catch (_) {}

    try { console.log('[L1] paradigm init·era=' + era + '·subjects=' + paradigm.subjects.length + '·tiers=' + paradigm.tiers.length + '·quota=' + paradigm.quota.total); } catch(_){}
    return paradigm;
  }

  function _kjpResolveEra() {
    try {
      if (typeof P !== 'undefined' && P) {
        if (P.scenario && P.scenario.era) return String(P.scenario.era);
        if (P.keju && P.keju.era) return String(P.keju.era);
      }
    } catch(_) {}
    return '';
  }

  function _kjpCloneSubjects(subjects) {
    if (!Array.isArray(subjects)) return [];
    return subjects.map(function(s, i) {
      if (!s || typeof s !== 'object') return null;
      return {
        id: s.id || ('subject_' + i),
        name: s.name || '未名',
        nameVariants: _deepClone(s.nameVariants || {}),
        weight: typeof s.weight === 'number' ? s.weight : 0,
        ideology: s.ideology || 'traditional',
        format: s.format || '',
        maxScore: typeof s.maxScore === 'number' ? s.maxScore : 100,
        introducedYear: s.introducedYear != null ? s.introducedYear : null,
        introducedBy: s.introducedBy != null ? s.introducedBy : null,
        parentSubject: s.parentSubject || null,
        examinerBias: _deepClone(s.examinerBias || {}),
        candidateBias: _deepClone(s.candidateBias || {}),
        textbookRef: s.textbookRef || null,
        trainingCenterRef: s.trainingCenterRef || null,
        cohortGen: s.cohortGen || ('g1-' + (s.id || 'unknown')),
        regionalWeight: s.regionalWeight || null,
        customFields: _deepClone(s.customFields || {})
      };
    }).filter(function(s) { return !!s; });
  }

  // ════════════════════════════════════════════════════════════════
  // §3·default·fallback 字段
  // ════════════════════════════════════════════════════════════════

  function _kjpDefaultAddon() {
    var addon = (typeof _kjpGetParadigmAddonByEra === 'function')
      ? _kjpGetParadigmAddonByEra('明') : null;
    if (addon) return addon;
    return {
      subjects: [{ id:'unknown', name:'未知科', weight:100, ideology:'traditional', format:'', maxScore:100 }],
      examInterval: 3, retakePolicy: 'allow_3x',
      candidateRules: _kjpDefaultCandidateRules(),
      examinerRules: _kjpDefaultExaminerRules(),
      quota: _kjpDefaultQuota(),
      rankingRule: 'by_score',
      allocationRules: _kjpDefaultAllocationRules(),
      graduateTitle: '进士', cohortBondStrength: 'strong', mentorLineage: true,
      schoolIntegration: 'optional',
      taxPrivilege: { jinshi:true, juren:true, xiucai:false },
      shadow: 'low', clanPrivilege: false,
      ceremony: _kjpDefaultCeremony(),
      penalties: _kjpDefaultPenalties(),
      language: 'classical_chinese',
      ideology: 'traditional'
    };
  }

  function _kjpDefaultCandidateRules() {
    return {
      excludedClasses: ['僧道', '商贾子', '倡优'],
      requirePrefecture: true,
      requireRecommendation: false,
      minAge: 15, maxAge: 60,
      allowForeigner: false,
      allowMinority: false,
      feeReimbursement: 'self'
    };
  }

  function _kjpDefaultExaminerRules() {
    return {
      type: ['scholar'],
      partyQuota: null,
      minYears: 10,
      avoidanceRules: {
        avoid_kin: true, avoid_native: true, avoid_disciple: false,
        avoid_recent: false, avoid_party: false, avoid_age: false
      },
      blindScoring: true,
      blindCopying: true,
      inspectionLevel: 'high',
      mentorBondStrength: 'strong',
      leakPenalty: 'banish'
    };
  }

  function _kjpDefaultQuota() {
    return {
      total: 50,
      ratios: {
        geo:        { enabled: false, strategy: 'none', values: {}, strictness: 'guidance' },
        class:      { enabled: false, strategy: 'none', values: {}, strictness: 'guidance' },
        party:      { enabled: false, strategy: 'none', values: {}, strictness: 'guidance' },
        prefecture: { enabled: false, strategy: 'none', values: {}, strictness: 'guidance' },
        minority:   { enabled: false, strategy: 'none', values: {}, strictness: 'guidance' }
      }
    };
  }

  function _kjpDefaultAllocationRules() {
    return {
      firstClass:  { count:3,  positions:['翰林'], ranks:{ default:'从六品' }, privileges:{} },
      secondClass: { count:20, positions:['六部'], ranks:{ default:'正七品' }, privileges:{} },
      thirdClass:  { count:27, positions:['地方'], ranks:{ default:'从七品' }, privileges:{} },
      waitingYears: 1,
      imperialReviewRequired: true,
      posthumousAdjustment: false
    };
  }

  function _kjpDefaultCeremony() {
    return {
      palaceTest: '御前策问',
      rosterRelease: '黄榜张挂',
      flowerRiding: false,
      nameStele: false,
      bondingBanquet: false,
      kowtowRound: 5,
      customRituals: []
    };
  }

  function _kjpDefaultPenalties() {
    return {
      cheating: 'banish',
      leak: 'death',
      taboo: 'demote',
      bribery: 'individual'
    };
  }

  // ════════════════════════════════════════════════════════════════
  // §4·migration·版本框架·v0 (无 _kejuParadigm) → v1
  // ════════════════════════════════════════════════════════════════

  /**
   * MIGRATIONS dict·按 version 升级
   * key 是 from version·value 是升级函数 (paradigm) → new paradigm
   * 新增 L2-L50 字段时·加 entry·version bump
   */
  var MIGRATIONS = {
    // 0 → 1·真升级·若 oldOrEmpty 有 (v0 paradigm 已存)·从现 preset 重 init·保留 history
    // (caller 路径·_kjpMigrate 已处理 oldOrEmpty=null 走 _kjpInitParadigm·此 migrator 只处理 oldOrEmpty 有 但 ver<1)
    0: function(oldOrEmpty) {
      // A3 修·v0 paradigm 已存时真升级·非占位
      if (typeof GM === 'undefined' || !GM) return null;
      var oldHistory = (oldOrEmpty && oldOrEmpty.history) || [];
      var oldChronicle = (oldOrEmpty && oldOrEmpty._reformChronicle) || {};
      GM._kejuParadigm = null;
      _kjpInitParadigm({ force: true, initBy: 'migration' });
      if (GM._kejuParadigm) {
        GM._kejuParadigm.history = oldHistory;
        GM._kejuParadigm._reformChronicle = oldChronicle;
      }
      return GM._kejuParadigm;
    },
    // L8·1 → 2·_reformChronicle schema·year-keyed → histId-keyed
    // v1·{year: {histId, text, ...}}·v2·{histId: {year: {text, ...}}}
    // 走 tm-keju-reform-evolution.js 的 _kjpMigrateReformChronicleV1 helper
    1: function(p) {
      if (!p) return null;
      try {
        if (typeof _kjpMigrateReformChronicleV1 === 'function') {
          _kjpMigrateReformChronicleV1(p);
        } else if (typeof window !== 'undefined' && typeof window._kjpMigrateReformChronicleV1 === 'function') {
          window._kjpMigrateReformChronicleV1(p);
        }
      } catch (e) {
        try { console.warn('[L1·migrate v1→2·_reformChronicle]', e); } catch(_){}
      }
      p.version = 2;
      return p;
    }
  };

  /**
   * migrate·load 后调·若无 _kejuParadigm 或 version 旧·升级
   * 容错·any error 不抛·log warn·避免 break Stage 1
   */
  function _kjpMigrate() {
    try {
      if (typeof GM === 'undefined' || !GM) return;
      if (!P || !P.keju || !P.keju.enabled) return;

      var current = GM._kejuParadigm;
      if (!current) {
        // v0·没 paradigm·init from scratch
        _kjpInitParadigm({ initBy: 'migration' });
        try { console.log('[L1·migrate] v0→v1·init from preset'); } catch(_){}
        return;
      }
      var ver = current.version || 0;
      while (ver < PARADIGM_VERSION) {
        var migrator = MIGRATIONS[ver];
        if (!migrator) break;
        try {
          var newP = migrator(current);
          if (newP) GM._kejuParadigm = newP;
        } catch (e) {
          try { console.warn('[L1·migrate] version ' + ver + ' → ' + (ver+1) + ' failed·', e); } catch(_){}
          break;
        }
        ver++;
      }
    } catch (e) {
      try { console.warn('[L1·migrate] fatal·', e); } catch(_){}
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §5·reset·_kjpResetToPreset
  //    保留 history + _reformChronicle·只重置 paradigm 字段
  // ════════════════════════════════════════════════════════════════

  /**
   * reset paradigm 到指定朝代 preset
   * @param {string} era - 朝代字符串
   * @returns {boolean} 成功
   */
  function _kjpResetToPreset(era) {
    if (typeof GM === 'undefined' || !GM) return false;
    if (!era) return false;
    var oldP = GM._kejuParadigm || {};
    var oldHistory = oldP.history || [];
    var oldChronicle = oldP._reformChronicle || {};

    // force re-init from preset
    GM._kejuParadigm = null;
    // A2 修·try-finally + typeof guard·避免 init throw 时 P.scenario.era 被破·或空字符串原值被 skip
    var hasScenario = !!(typeof P !== 'undefined' && P && P.scenario);
    var saved_era;
    if (hasScenario) {
      saved_era = P.scenario.era;
      P.scenario.era = era;
    }
    try {
      _kjpInitParadigm({ force: true, initBy: 'reset' });
    } finally {
      if (hasScenario) {
        P.scenario.era = saved_era;
      }
    }

    // 恢复 history + chronicle (reset 不破坏)
    // C3/C4 修后·_kjpInitParadigm 已写 differentiated chronicle (type=keju-paradigm-reset·text 含"已重置")
    // 此处不再重复 push·避免双 entry
    if (GM._kejuParadigm) {
      GM._kejuParadigm.history = oldHistory;
      GM._kejuParadigm._reformChronicle = oldChronicle;
      return true;
    }
    return false;
  }

  // ════════════════════════════════════════════════════════════════
  // §6·export / import·跟跨剧本 (L50) 联动
  // ════════════════════════════════════════════════════════════════

  /**
   * export paradigm 为 JSON·跨剧本 / 分享
   * @returns {string} JSON
   */
  function _kjpExport() {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return null;
    try {
      return JSON.stringify(GM._kejuParadigm);
    } catch (e) {
      try { console.warn('[L1·export] failed·', e); } catch(_){}
      return null;
    }
  }

  /**
   * import paradigm·跟 export 配对·version 不匹配 warn 但仍 import
   * @param {string|object} json
   * @returns {boolean} 成功
   */
  function _kjpImport(json) {
    if (typeof GM === 'undefined' || !GM) return false;
    var p = null;
    try {
      p = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      try { console.warn('[L1·import] parse failed·', e); } catch(_){}
      return false;
    }
    if (!p || typeof p !== 'object') return false;
    if (!p.version) {
      try { console.warn('[L1·import] no version·skip'); } catch(_){}
      return false;
    }
    var versionMismatch = (p.version !== PARADIGM_VERSION);
    if (versionMismatch) {
      try { console.warn('[L1·import] version mismatch·imported=' + p.version + '·current=' + PARADIGM_VERSION + '·auto-migrate'); } catch(_){}
    }
    GM._kejuParadigm = _deepClone(p);
    // A4 修·import 后 auto-migrate·确保 version up-to-date
    if (versionMismatch) {
      try { _kjpMigrate(); } catch(eM) {
        try { console.warn('[L1·import] auto-migrate failed', eM); } catch(_){}
      }
    }

    try {
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          date: GM._gameDate || '',
          type: 'keju-paradigm-import',
          text: '科举 paradigm 从外部 import' + (versionMismatch ? ' (auto-migrated)' : ''),
          tags: ['科举', 'paradigm', 'import']
        });
      }
    } catch(_) {}
    return true;
  }

  // ════════════════════════════════════════════════════════════════
  // §7·validate·字段类型 / 范围检验
  // ════════════════════════════════════════════════════════════════

  /**
   * validate paradigm·返 {ok, errors}
   */
  function _kjpValidateParadigm(p) {
    // 显式 null/undefined 走 fail·只 undefined 走 fallback
    if (p === null) {
      return { ok: false, errors: ['paradigm is null'] };
    }
    if (typeof p === 'undefined') {
      p = (typeof GM !== 'undefined' && GM ? GM._kejuParadigm : null);
    }
    var errors = [];
    if (!p) {
      errors.push('paradigm is null');
      return { ok: false, errors: errors };
    }
    if (!Array.isArray(p.subjects)) errors.push('subjects must be array');
    else {
      var totalWeight = 0;
      var ids = {};
      p.subjects.forEach(function(s, i) {
        if (!s.id) errors.push('subjects[' + i + '].id missing');
        else if (ids[s.id]) errors.push('subjects[' + i + '].id duplicate: ' + s.id);
        else ids[s.id] = true;
        if (typeof s.weight !== 'number') errors.push('subjects[' + i + '].weight not number');
        else totalWeight += s.weight;
        if (s.ideology && VALID_IDEOLOGIES.indexOf(s.ideology) < 0) {
          errors.push('subjects[' + i + '].ideology invalid: ' + s.ideology);
        }
      });
      if (totalWeight > 100.01) errors.push('subjects weight total > 100: ' + totalWeight);
    }
    if (!Array.isArray(p.tiers)) errors.push('tiers must be array');
    else {
      var tierIds = {};
      p.tiers.forEach(function(t, i) {
        if (!t.id) errors.push('tiers[' + i + '].id missing');
        else if (tierIds[t.id]) errors.push('tiers[' + i + '].id duplicate: ' + t.id);
        else tierIds[t.id] = true;
        if (!t.name) errors.push('tiers[' + i + '].name missing');
      });
    }
    if (p.retakePolicy && VALID_RETAKE.indexOf(p.retakePolicy) < 0) {
      errors.push('retakePolicy invalid: ' + p.retakePolicy);
    }
    if (p.rankingRule && VALID_RANKING.indexOf(p.rankingRule) < 0) {
      errors.push('rankingRule invalid: ' + p.rankingRule);
    }
    if (p.ideology && VALID_IDEOLOGIES.indexOf(p.ideology) < 0) {
      errors.push('ideology invalid: ' + p.ideology);
    }
    if (p.schoolIntegration && VALID_SCHOOL_INTEGRATION.indexOf(p.schoolIntegration) < 0) {
      errors.push('schoolIntegration invalid: ' + p.schoolIntegration);
    }
    if (p.shadow && VALID_SHADOW.indexOf(p.shadow) < 0) {
      errors.push('shadow invalid: ' + p.shadow);
    }
    if (!p.examinerRules) errors.push('examinerRules missing');
    if (!p.candidateRules) errors.push('candidateRules missing');
    if (!p.quota) errors.push('quota missing');
    if (!p.allocationRules) errors.push('allocationRules missing');
    if (!p.ceremony) errors.push('ceremony missing');
    if (!p.penalties) errors.push('penalties missing');

    return { ok: errors.length === 0, errors: errors };
  }

  // ════════════════════════════════════════════════════════════════
  // §8·lint·stub·L7 实现 (paradigm vs Stage 1 一致性 check)
  // ════════════════════════════════════════════════════════════════

  /**
   * lint paradigm vs Stage 1·检测两边不一致·L7 真填 (本 sprint)
   * @param {object} paradigm - 当前 GM._kejuParadigm (可省·走 global)
   * @param {object} diff - _kjpComputeDiff 输出 (可省·只校验 paradigm 自身)
   * @returns {{ok:boolean, warnings:Array}}
   */
  function _kjpLintAgainstStage1(paradigm, diff) {
    paradigm = paradigm || (typeof GM !== 'undefined' && GM ? GM._kejuParadigm : null);
    var warnings = [];
    if (!paradigm) return { ok: true, warnings: warnings };

    // Inv 1·D4 殿试代主 6 身份硬码男·准女子卷需 _timeAnomaly
    if (diff && diff.candidateRules && diff.candidateRules.excludedClasses &&
        Array.isArray(diff.candidateRules.excludedClasses.removed) &&
        diff.candidateRules.excludedClasses.removed.indexOf('女子') >= 0) {
      var hasAnomaly = (typeof P !== 'undefined' && P && P.scenario && P.scenario._timeAnomaly);
      if (!hasAnomaly) {
        warnings.push({
          code: 'D4_GENDER_BREAK', severity: 'fatal',
          msg: 'D4 殿试 6 身份硬码男·准女子卷需 _timeAnomaly·否则 chars filter 崩'
        });
      } else {
        warnings.push({
          code: 'D4_GENDER_ANOMALY', severity: 'warn',
          msg: '准女子卷·走 _timeAnomaly·D4 chars filter 需 reimagined 配合'
        });
      }
    }

    // Inv 2·ideology→modern·但 allocationRules.firstClass 仍 hardcode 翰林·E2 党派派生 mismatch
    if (diff && diff.ideology && diff.ideology.new === 'modern' &&
        paradigm.allocationRules && paradigm.allocationRules.firstClass) {
      var positions = paradigm.allocationRules.firstClass.positions || [];
      var posStr = '';
      try { posStr = JSON.stringify(positions); } catch(_){}
      if (posStr.indexOf('翰林') >= 0) {
        warnings.push({
          code: 'E2_MODERN_HANLIN', severity: 'warn',
          msg: 'modern ideology·但一甲仍授翰林·建议同步改授新派职'
        });
      }
    }

    // Inv 3·mentorLineage=false·但 GM._discipleGraph 已有数据·F1 孤儿
    if (diff && diff.mentorLineage === false &&
        typeof GM !== 'undefined' && GM && GM._discipleGraph && GM._discipleGraph.byMentor) {
      var mentorCount = Object.keys(GM._discipleGraph.byMentor).length;
      if (mentorCount > 0) {
        warnings.push({
          code: 'F1_DISCIPLE_ORPHAN', severity: 'warn',
          msg: '禁 mentor lineage·但 GM._discipleGraph 已有 ' + mentorCount + ' mentor·历史关系保留 read-only'
        });
      }
    }

    // Inv 4·tiers 改·L3 panel readonly·建议走 L20 国子监
    if (diff && diff.tiers && diff.tiers.changed) {
      warnings.push({
        code: 'L20_TIER_CHANGE', severity: 'warn',
        msg: 'tier 增删 L3 panel readonly·建议走 L20 国子监·diff.tiers 不 apply'
      });
    }

    // Inv 5·subjects 总权重 sum·过 200 → B3 题目算法溢出
    if (diff && diff.subjects && Array.isArray(paradigm.subjects)) {
      var added = diff.subjects.added || [];
      var weightChanged = diff.subjects.weightChanged || [];
      var removed = diff.subjects.removed || [];
      if (added.length || weightChanged.length || removed.length) {
        var removedIds = {};
        removed.forEach(function(r) { if (r && r.id) removedIds[r.id] = 1; });
        var changedMap = {};
        weightChanged.forEach(function(c) { if (c && c.id) changedMap[c.id] = c.newW; });
        var sum = 0;
        paradigm.subjects.forEach(function(s) {
          if (!s || removedIds[s.id]) return;
          if (changedMap[s.id] != null) sum += parseInt(changedMap[s.id], 10) || 0;
          else sum += parseInt(s.weight, 10) || 0;
        });
        added.forEach(function(a) { if (a) sum += parseInt(a.weight, 10) || 0; });
        if (sum > 200) {
          warnings.push({
            code: 'B3_WEIGHT_OVERFLOW', severity: 'fatal',
            msg: 'subjects 总权重 ' + sum + '% > 200·B3 题目选择算法不可预测·请调权重'
          });
        }
      }
    }

    // Inv 6·examinerRules.minYears>30·剧本若无 senior NPC·主考算法 fall to null
    if (diff && diff.examinerRules && typeof diff.examinerRules.minYears === 'number' &&
        diff.examinerRules.minYears > 30) {
      warnings.push({
        code: 'C1_EXAMINER_NONE_RISK', severity: 'warn',
        msg: '主考 minYears>30·若剧本无足资历 NPC·考试 abort'
      });
    }

    // Inv 7·quota.total=0·E3 选官分配崩
    if (diff && diff.quota && diff.quota.total && diff.quota.total.new === 0) {
      warnings.push({
        code: 'E3_ZERO_QUOTA', severity: 'fatal',
        msg: '录取 quota=0·废科举·建议走 intent=restoration 专路径'
      });
    }

    // Inv 8·candidateRules.minAge>50·候选池可能 0 人
    if (diff && diff.candidateRules && typeof diff.candidateRules.minAge === 'number' &&
        diff.candidateRules.minAge > 50) {
      warnings.push({
        code: 'CANDIDATE_NONE_RISK', severity: 'warn',
        msg: '最小年龄>50·候选池可能 0 人·会试 abort'
      });
    }

    // Inv 9·ceremony 全禁·D5 簪花跨马叙事缺·non-fatal
    if (diff && diff.ceremony && diff.ceremony.palaceTest === false && diff.ceremony.rosterRelease === false) {
      warnings.push({
        code: 'D5_NO_CEREMONY', severity: 'warn',
        msg: '禁殿试 + 放榜·D5 簪花跨马叙事缺·建议留 1-2 ceremony'
      });
    }

    var hasFatal = false;
    for (var i = 0; i < warnings.length; i++) {
      if (warnings[i].severity === 'fatal') { hasFatal = true; break; }
    }
    return { ok: !hasFatal, warnings: warnings };
  }

  // ════════════════════════════════════════════════════════════════
  // §9·辅助·query 函数
  // ════════════════════════════════════════════════════════════════

  function _kjpGetSubject(idOrName) {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return null;
    var subjects = GM._kejuParadigm.subjects || [];
    for (var i = 0; i < subjects.length; i++) {
      if (subjects[i].id === idOrName || subjects[i].name === idOrName) return subjects[i];
    }
    return null;
  }

  function _kjpGetTier(idOrName) {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return null;
    var tiers = GM._kejuParadigm.tiers || [];
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].id === idOrName || tiers[i].name === idOrName) return tiers[i];
    }
    return null;
  }

  function _kjpHasSubject(idOrName) {
    return _kjpGetSubject(idOrName) !== null;
  }

  function _kjpDescribeParadigm(p) {
    p = p || (typeof GM !== 'undefined' && GM ? GM._kejuParadigm : null);
    if (!p) return '(no paradigm)';
    var lines = [];
    lines.push('paradigm v' + p.version + ' (era=' + (p.initEra || '?') + '·ideology=' + p.ideology + ')');
    lines.push('  subjects (' + p.subjects.length + '): ' +
      p.subjects.map(function(s) { return s.name + ':' + s.weight + '%' + '[' + s.ideology + ']'; }).join('·'));
    lines.push('  tiers (' + p.tiers.length + '): ' +
      p.tiers.map(function(t) { return t.name; }).join(' → '));
    lines.push('  quota: ' + p.quota.total + ' (geo=' + p.quota.ratios.geo.enabled + ')');
    // 营建解额入闱(2026-07-03·死账接活)：叶 economyBase.kejuQuota(剧本解额+书院/学宫营建所增)原全 runtime
    // 无消费者——建了书院不影响取士。科举取中为范式+AI 驱动·quota 的唯一消费链=本描述喂 AI，
    // 故把地域解额分布写进范式描述(南北中桶用书院网络 §19 同款地域正则·两处保持一致)。
    try {
      var _geoQ = _kjpGeoQuotaFromDivisions();
      if (_geoQ) lines.push('  regionQuota(解额·含营建): 南' + _geoQ['南'] + '·北' + _geoQ['北'] + '·中' + _geoQ['中']);
    } catch (_e) {}
    lines.push('  graduateTitle: ' + p.graduateTitle);
    lines.push('  mentorBond: ' + p.examinerRules.mentorBondStrength);
    lines.push('  history: ' + (p.history.length) + ' reform(s)');
    return lines.join('\n');
  }

  // 地域解额分布：走 player 子树叶 economyBase.kejuQuota 按南北中桶累加(总和为 0 → null 不出行)
  function _kjpGeoQuotaFromDivisions() {
    var GMx = (typeof GM !== 'undefined' && GM) ? GM : ((typeof window !== 'undefined' && window.GM) ? window.GM : null);
    var ahp = GMx && GMx.adminHierarchy && GMx.adminHierarchy.player;
    if (!ahp || !ahp.divisions) return null;
    var south = /南|江|杭|无锡|苏|长沙|庐山|商丘/;
    var north = /北|京|燕|蓟|关中|西安|登封/;
    var acc = { '南': 0, '北': 0, '中': 0 };
    var total = 0;
    ahp.divisions.forEach(function (top) {
      var tn = String((top && (top.name || top.id)) || '');
      var bucket = south.test(tn) ? '南' : (north.test(tn) ? '北' : '中');
      (function walk(d) {
        if (!d) return;
        var kids = d.children || d.divisions;
        if (kids && kids.length) { kids.forEach(walk); return; }
        var q = Number(d.economyBase && d.economyBase.kejuQuota);
        if (isFinite(q) && q > 0) { acc[bucket] += Math.round(q); total += q; }
      })(top);
    });
    return total > 0 ? acc : null;
  }

  // ════════════════════════════════════════════════════════════════
  // §10·辅助·_deepClone (Stage 1 已有·但避免依赖·内 copy)
  // ════════════════════════════════════════════════════════════════

  function _deepClone(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(_deepClone);
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        out[k] = _deepClone(obj[k]);
      }
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════
  // §11·暴露
  // ════════════════════════════════════════════════════════════════

  global._kjpInitParadigm       = _kjpInitParadigm;
  global._kjpMigrate            = _kjpMigrate;
  global._kjpResetToPreset      = _kjpResetToPreset;
  global._kjpExport             = _kjpExport;
  global._kjpImport             = _kjpImport;
  global._kjpValidateParadigm   = _kjpValidateParadigm;
  global._kjpLintAgainstStage1  = _kjpLintAgainstStage1;
  global._kjpGetSubject         = _kjpGetSubject;
  global._kjpGetTier            = _kjpGetTier;
  global._kjpHasSubject         = _kjpHasSubject;
  global._kjpDescribeParadigm   = _kjpDescribeParadigm;

  if (!global.TM) global.TM = {};
  if (!global.TM.Keju) global.TM.Keju = {};
  if (!global.TM.Keju.Paradigm) global.TM.Keju.Paradigm = {};
  global.TM.Keju.Paradigm.init       = _kjpInitParadigm;
  global.TM.Keju.Paradigm.migrate    = _kjpMigrate;
  global.TM.Keju.Paradigm.reset      = _kjpResetToPreset;
  global.TM.Keju.Paradigm.export     = _kjpExport;
  global.TM.Keju.Paradigm.import     = _kjpImport;
  global.TM.Keju.Paradigm.validate   = _kjpValidateParadigm;
  global.TM.Keju.Paradigm.lint       = _kjpLintAgainstStage1;
  global.TM.Keju.Paradigm.getSubject = _kjpGetSubject;
  global.TM.Keju.Paradigm.getTier    = _kjpGetTier;
  global.TM.Keju.Paradigm.describe   = _kjpDescribeParadigm;
  global.TM.Keju.Paradigm.VERSION    = PARADIGM_VERSION;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjpInitParadigm: _kjpInitParadigm,
      _kjpMigrate: _kjpMigrate,
      _kjpResetToPreset: _kjpResetToPreset,
      _kjpExport: _kjpExport,
      _kjpImport: _kjpImport,
      _kjpValidateParadigm: _kjpValidateParadigm,
      _kjpLintAgainstStage1: _kjpLintAgainstStage1,
      _kjpGetSubject: _kjpGetSubject,
      _kjpGetTier: _kjpGetTier,
      _kjpHasSubject: _kjpHasSubject,
      _kjpDescribeParadigm: _kjpDescribeParadigm,
      PARADIGM_VERSION: PARADIGM_VERSION
    };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
