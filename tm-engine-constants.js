// @ts-check
// ============================================================
// tm-engine-constants.js
// 6 系统翻新 phase 0: 剧本自包含引擎常量读取层。
//
// 规则：
// - 引擎不藏默认值。read/get 只读取 source.engineConstants。
// - 模板只能由编辑器/维护者显式 apply，不在加载时自动写入剧本。
// - 返回对象一律深拷贝，避免调用方误改模板本体。
// ============================================================
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};

  function clone(v) {
    if (v === undefined || v === null) return v;
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) {
      if (Array.isArray(v)) return v.slice();
      if (typeof v === 'object') {
        var out = {};
        Object.keys(v).forEach(function(k){ out[k] = v[k]; });
        return out;
      }
      return v;
    }
  }

  function pickSource(source) {
    if (source) return source;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    if (global.P && typeof global.P === 'object') return global.P;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    return {};
  }

  function constantsOf(source) {
    var root = pickSource(source);
    return root && root.engineConstants && typeof root.engineConstants === 'object'
      ? root.engineConstants : null;
  }

  function getPath(obj, path) {
    if (!obj || !path) return obj;
    var cur = obj;
    String(path).split('.').forEach(function(part) {
      if (cur === undefined || cur === null) return;
      cur = cur[part];
    });
    return cur;
  }

  function read(path, source) {
    var root = constantsOf(source);
    var value = getPath(root, path);
    return value === undefined ? undefined : clone(value);
  }

  function has(path, source) {
    return read(path, source) !== undefined;
  }

  function requirePaths(paths, source) {
    var missing = [];
    (paths || []).forEach(function(path) {
      if (!has(path, source)) missing.push(path);
    });
    return { ok: missing.length === 0, missing: missing };
  }

  var COMMON_OFFICE_SUBTABS = [
    { id:'central', label:'中枢', patterns:['内阁','中书','门下','尚书','军机','政事堂'] },
    { id:'six_boards', label:'六部', patterns:['吏部','户部','礼部','兵部','刑部','工部'] },
    { id:'censorate', label:'台谏监察', patterns:['御史','都察院','谏','台'] },
    { id:'military', label:'军府武职', patterns:['都督','总兵','将军','节度','兵马'] },
    { id:'local', label:'地方', patterns:['巡抚','总督','布政','按察','知府','知县','刺史','太守'] },
    { id:'imperial', label:'宫廷近侍', patterns:['司礼监','内侍','内务府','翰林','詹事府'] }
  ];

  var COMMON_TACTICS = [
    { id:'hold_fortified_line', name:'据险固守' },
    { id:'night_raid', name:'夜袭' },
    { id:'feigned_retreat', name:'佯退诱敌' },
    { id:'supply_cut', name:'断粮截运' },
    { id:'river_crossing', name:'乘流渡河' },
    { id:'cavalry_flank', name:'骑兵侧击' },
    { id:'siege_encircle', name:'围城困守' },
    { id:'field_artillery', name:'火器压阵' },
    { id:'scorched_earth', name:'坚壁清野' },
    { id:'relief_column', name:'分兵救援' },
    { id:'ambush_pass', name:'伏击隘口' },
    { id:'morale_assault', name:'鼓噪冲阵' }
  ];

  function CLASS_POPULATION_MAP_BASE() {
    return {
      imperial: ['imperial'],
      '皇族/宗室': ['imperial'],
      gentry_high: ['gentry_high', 'gentry_low'],
      '士绅': ['gentry_high', 'gentry_low'],
      landlord: ['landlord'],
      '地主': ['landlord'],
      merchant: ['merchant'],
      '商贾': ['merchant'],
      peasant_self: ['peasant_self', 'bianhu'],
      '自耕农': ['peasant_self', 'bianhu'],
      peasant_tenant: ['peasant_tenant'],
      '佃农': ['peasant_tenant'],
      craftsman: ['craftsman', 'jianghu'],
      '工匠': ['craftsman', 'jianghu'],
      clergy: ['clergy', 'sengdao'],
      '僧道': ['clergy', 'sengdao'],
      military: ['military', 'junhu'],
      '军户': ['military', 'junhu'],
      debased: ['debased', 'yuehu', 'danhu', 'nubi'],
      '贱民': ['debased', 'yuehu', 'danhu', 'nubi']
    };
  }

  function CLASS_TAG_DELTA_MATRIX_BASE() {
    return {
      tax: {
        imperial: { satisfaction: -2, influence: -1 },
        gentry_high: { satisfaction: -6, influence: -2 },
        gentry_low: { satisfaction: -5, influence: -1 },
        landlord: { satisfaction: -8, influence: -1 },
        merchant: { satisfaction: -6, influence: -2 },
        peasant_self: { satisfaction: -12, influence: 0 },
        peasant_tenant: { satisfaction: -15, influence: 0 },
        craftsman: { satisfaction: -8, influence: -1 },
        clergy: { satisfaction: -3, influence: 0 },
        military: { satisfaction: -4, influence: -1 },
        debased: { satisfaction: -7, influence: 0 },
        default: { satisfaction: -4, influence: -1 }
      },
      corvee: {
        imperial: { satisfaction: -1, influence: 0 },
        gentry_high: { satisfaction: -4, influence: -1 },
        gentry_low: { satisfaction: -4, influence: -1 },
        landlord: { satisfaction: -5, influence: -1 },
        merchant: { satisfaction: -3, influence: -1 },
        peasant_self: { satisfaction: -10, influence: 0 },
        peasant_tenant: { satisfaction: -13, influence: 0 },
        craftsman: { satisfaction: -9, influence: -1 },
        clergy: { satisfaction: -2, influence: 0 },
        military: { satisfaction: -7, influence: -1 },
        debased: { satisfaction: -5, influence: 0 },
        default: { satisfaction: -3, influence: 0 }
      },
      privilege: {
        imperial: { satisfaction: 4, influence: 2 },
        gentry_high: { satisfaction: 5, influence: 3 },
        gentry_low: { satisfaction: 2, influence: 1 },
        landlord: { satisfaction: 2, influence: 1 },
        merchant: { satisfaction: 1, influence: 1 },
        peasant_self: { satisfaction: -8, influence: -1 },
        peasant_tenant: { satisfaction: -10, influence: -1 },
        craftsman: { satisfaction: -6, influence: -1 },
        clergy: { satisfaction: 1, influence: 1 },
        military: { satisfaction: 1, influence: 0 },
        debased: { satisfaction: -5, influence: 0 },
        default: { satisfaction: 0, influence: 0 }
      },
      religion: {
        imperial: { satisfaction: 0, influence: 0 },
        gentry_high: { satisfaction: -1, influence: 0 },
        gentry_low: { satisfaction: -2, influence: 0 },
        landlord: { satisfaction: -1, influence: 0 },
        merchant: { satisfaction: -1, influence: 0 },
        peasant_self: { satisfaction: -2, influence: 0 },
        peasant_tenant: { satisfaction: -2, influence: 0 },
        craftsman: { satisfaction: -1, influence: 0 },
        clergy: { satisfaction: 6, influence: 2 },
        military: { satisfaction: -1, influence: 0 },
        debased: { satisfaction: 0, influence: 0 },
        default: { satisfaction: 0, influence: 0 }
      },
      military: {
        imperial: { satisfaction: -1, influence: 0 },
        gentry_high: { satisfaction: 1, influence: 1 },
        gentry_low: { satisfaction: 0, influence: 0 },
        landlord: { satisfaction: 1, influence: 0 },
        merchant: { satisfaction: -3, influence: -1 },
        peasant_self: { satisfaction: -4, influence: 0 },
        peasant_tenant: { satisfaction: -5, influence: 0 },
        craftsman: { satisfaction: -2, influence: 0 },
        clergy: { satisfaction: -1, influence: 0 },
        military: { satisfaction: 5, influence: 2 },
        debased: { satisfaction: -2, influence: 0 },
        default: { satisfaction: 0, influence: 0 }
      },
      law: {
        imperial: { satisfaction: 1, influence: 1 },
        gentry_high: { satisfaction: -2, influence: 0 },
        gentry_low: { satisfaction: -2, influence: 0 },
        landlord: { satisfaction: -2, influence: 0 },
        merchant: { satisfaction: -1, influence: 0 },
        peasant_self: { satisfaction: -6, influence: 0 },
        peasant_tenant: { satisfaction: -8, influence: 0 },
        craftsman: { satisfaction: -4, influence: 0 },
        clergy: { satisfaction: -1, influence: 0 },
        military: { satisfaction: -1, influence: 0 },
        debased: { satisfaction: -3, influence: 0 },
        default: { satisfaction: -1, influence: 0 }
      },
      foreign_trade: {
        imperial: { satisfaction: 0, influence: 0 },
        gentry_high: { satisfaction: 1, influence: 1 },
        gentry_low: { satisfaction: 0, influence: 0 },
        landlord: { satisfaction: -1, influence: 0 },
        merchant: { satisfaction: 7, influence: 3 },
        peasant_self: { satisfaction: -1, influence: 0 },
        peasant_tenant: { satisfaction: -1, influence: 0 },
        craftsman: { satisfaction: 3, influence: 1 },
        clergy: { satisfaction: 0, influence: 0 },
        military: { satisfaction: 0, influence: 0 },
        debased: { satisfaction: 1, influence: 0 },
        default: { satisfaction: 0, influence: 0 }
      }
    };
  }

  function INFLUENCE_GROUP_CATALOG_BASE() {
    return {
      eunuch: {
        name: '\u5ba6\u5b98',
        type: 'eunuch',
        titleKeywords: [
          '\u592a\u76d1', '\u53f8\u793c\u76d1', '\u4e1c\u5382', '\u897f\u5382',
          '\u9526\u8863\u536b', '\u5185\u5ef7', '\u79c9\u7b14', '\u638c\u5370',
          '\u5fa1\u9a6c\u76d1', '\u5185\u4f8d'
        ],
        occupationKeywords: ['\u5ba6\u5b98', '\u592a\u76d1', '\u5185\u4f8d'],
        keyOffices: [
          '\u53f8\u793c\u76d1\u638c\u5370', '\u53f8\u793c\u76d1\u79c9\u7b14',
          '\u4e1c\u5382\u63d0\u7763', '\u9526\u8863\u536b\u6307\u6325\u4f7f'
        ],
        influenceBaseline: 30,
        officeWeight: 4
      },
      waiqi: {
        name: '\u5916\u621a',
        type: 'waiqi',
        relationKeywords: ['empress_family', 'consort_family', '\u7687\u540e\u6bcd\u5bb6', '\u540e\u65cf'],
        titleKeywords: ['\u56fd\u8205', '\u627f\u6069\u516c', '\u9a78\u9a6c', '\u5916\u621a', '\u540e\u65cf'],
        keyOffices: ['\u627f\u6069\u516c', '\u56fd\u8205', '\u9a78\u9a6c'],
        influenceBaseline: 25,
        officeWeight: 3
      },
      consort: {
        name: '\u540e\u5bab',
        type: 'consort',
        relationKeywords: ['empress', 'consort', 'former_empress', 'emperor_spouse', '\u7687\u540e', '\u540e\u5983'],
        titleKeywords: [
          '\u7687\u540e', '\u8d35\u5983', '\u5983', '\u5ad4', '\u9009\u4f8d',
          '\u592a\u540e', '\u7687\u592a\u540e', '\u61ff\u5b89\u7687\u540e'
        ],
        keyOffices: ['\u7687\u540e', '\u592a\u540e', '\u7687\u592a\u540e'],
        influenceBaseline: 20,
        officeWeight: 3
      }
    };
  }

  function mergeInfluenceGroupCatalog(base, patch) {
    var out = {};
    Object.keys(base || {}).forEach(function(key) {
      out[key] = clone(base[key]);
    });
    Object.keys(patch || {}).forEach(function(key) {
      var next = clone(patch[key]);
      if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key]) && next && typeof next === 'object' && !Array.isArray(next)) {
        out[key] = Object.assign({}, out[key], next);
      } else {
        out[key] = next;
      }
    });
    return out;
  }

  function INFLUENCE_GROUP_CATALOG_HAN() {
    return mergeInfluenceGroupCatalog(INFLUENCE_GROUP_CATALOG_BASE(), {
      eunuch: {
        titleKeywords: ['\u4e2d\u5e38\u4f8d', '\u9ec4\u95e8\u4ee4', '\u6399\u5ead\u4ee4', '\u5c0f\u9ec4\u95e8', '\u4e2d\u9ec4\u95e8', '\u5c1a\u65b9\u4ee4', '\u592a\u76d1'],
        occupationKeywords: ['\u5b98\u5bb6', '\u5ba6\u5b98', '\u9ec4\u95e8'],
        keyOffices: ['\u4e2d\u5e38\u4f8d', '\u9ec4\u95e8\u4ee4', '\u6399\u5ead\u4ee4']
      },
      waiqi: {
        relationKeywords: ['empress_family', 'consort_family', '\u540e\u65cf', '\u7687\u540e\u6bcd\u5bb6'],
        titleKeywords: ['\u56fd\u8205', '\u5916\u621a', '\u9a7e\u9a6c', '\u5927\u5c06\u519b', '\u9a84\u9a91\u5c06\u519b', '\u8f66\u9a91\u5c06\u519b'],
        keyOffices: ['\u5927\u5c06\u519b', '\u9a84\u9a91\u5c06\u519b', '\u8f66\u9a91\u5c06\u519b']
      },
      consort: {
        relationKeywords: ['empress', 'consort', 'former_empress', 'emperor_spouse', '\u7687\u540e', '\u540e\u5983'],
        titleKeywords: ['\u7687\u540e', '\u7687\u592a\u540e', '\u662d\u5100', '\u5a4f\u5983', '\u592b\u4eba', '\u7f8e\u4eba', '\u826f\u4eba'],
        keyOffices: ['\u7687\u540e', '\u592a\u540e']
      }
    });
  }

  function INFLUENCE_GROUP_CATALOG_TANG() {
    return mergeInfluenceGroupCatalog(INFLUENCE_GROUP_CATALOG_BASE(), {
      eunuch: {
        titleKeywords: ['\u5185\u4f7f\u76d1', '\u795e\u7b56\u519b\u4e2d\u5c09', '\u67a2\u5bc6\u4f7f', '\u5185\u5e38\u4f8d', '\u5185\u7ed9\u4e8b', '\u9ad8\u529b\u58eb', '\u674e\u8f85\u56fd'],
        occupationKeywords: ['\u5ba6\u5b98', '\u5185\u4f7f'],
        keyOffices: ['\u5185\u4f7f\u76d1', '\u795e\u7b56\u519b\u4e2d\u5c09', '\u67a2\u5bc6\u4f7f']
      },
      waiqi: {
        relationKeywords: ['empress_family', 'consort_family', '\u540e\u65cf', '\u7687\u540e\u6bcd\u5bb6'],
        titleKeywords: ['\u56fd\u8205', '\u5916\u621a', '\u53f3\u76f8', '\u540c\u4e2d\u4e66\u95e8\u4e0b\u5e73\u7ae0\u4e8b', '\u8282\u5ea6\u4f7f', '\u9e3f\u80ea\u537f', '\u5c11\u76d1', '\u9a78\u9a6c'],
        keyOffices: ['\u53f3\u76f8', '\u540c\u4e2d\u4e66\u95e8\u4e0b\u5e73\u7ae0\u4e8b', '\u8282\u5ea6\u4f7f', '\u9e3f\u80ea\u537f']
      },
      consort: {
        relationKeywords: ['empress', 'consort', 'former_empress', 'emperor_spouse', '\u7687\u540e', '\u540e\u5983'],
        titleKeywords: ['\u7687\u540e', '\u8d35\u5983', '\u662d\u5100', '\u5b9d\u6797', '\u5a4f\u5983', '\u7f8e\u4eba', '\u592b\u4eba'],
        keyOffices: ['\u7687\u540e', '\u592a\u540e']
      }
    });
  }

  function INFLUENCE_GROUP_CATALOG_MING() {
    return mergeInfluenceGroupCatalog(INFLUENCE_GROUP_CATALOG_BASE(), {
      eunuch: {
        titleKeywords: ['\u53f8\u793c\u76d1\u638c\u5370', '\u53f8\u793c\u76d1\u79c9\u7b14', '\u4e1c\u5382\u63d0\u7763', '\u9526\u8863\u536b\u6307\u6325\u4f7f', '\u5185\u5b98\u76d1', '\u638c\u5370\u592a\u76d1', '\u79c9\u7b14\u592a\u76d1'],
        occupationKeywords: ['\u5ba6\u5b98', '\u592a\u76d1', '\u5185\u5b98'],
        keyOffices: ['\u53f8\u793c\u76d1\u638c\u5370', '\u53f8\u793c\u76d1\u79c9\u7b14', '\u4e1c\u5382\u63d0\u7763', '\u9526\u8863\u536b\u6307\u6325\u4f7f']
      },
      waiqi: {
        relationKeywords: ['empress_family', 'consort_family', '\u540e\u65cf', '\u7687\u540e\u6bcd\u5bb6'],
        titleKeywords: ['\u627f\u6069\u516c', '\u9a7e\u9a6c', '\u56fd\u8205', '\u5916\u621a', '\u9526\u8863\u536b\u90fd\u6307\u6325\u4f7f'],
        keyOffices: ['\u627f\u6069\u516c', '\u9a7e\u9a6c']
      },
      consort: {
        relationKeywords: ['empress', 'consort', 'former_empress', 'emperor_spouse', '\u7687\u540e', '\u540e\u5983'],
        titleKeywords: ['\u7687\u540e', '\u8d35\u5983', '\u9009\u4f8d', '\u5a4f\u5983', '\u5983', '\u592a\u540e', '\u61ff\u5b89\u7687\u540e'],
        keyOffices: ['\u7687\u540e', '\u592a\u540e']
      }
    });
  }

  function INFLUENCE_GROUP_CATALOG_QING() {
    return mergeInfluenceGroupCatalog(INFLUENCE_GROUP_CATALOG_BASE(), {
      eunuch: {
        titleKeywords: ['\u603b\u7ba1\u592a\u76d1', '\u526f\u603b\u7ba1\u592a\u76d1', '\u517b\u5fc3\u6bbf\u9996\u9886', '\u656c\u4e8b\u623f\u592a\u76d1', '\u9996\u9886\u592a\u76d1', '\u592a\u76d1'],
        occupationKeywords: ['\u5ba6\u5b98', '\u592a\u76d1', '\u5185\u76d1'],
        keyOffices: ['\u603b\u7ba1\u592a\u76d1', '\u526f\u603b\u7ba1\u592a\u76d1', '\u517b\u5fc3\u6bbf\u9996\u9886']
      },
      waiqi: {
        relationKeywords: ['empress_family', 'consort_family', '\u540e\u65cf', '\u7687\u540e\u6bcd\u5bb6'],
        titleKeywords: ['\u627f\u6069\u516c', '\u989d\u9a74', '\u56fd\u8205', '\u5916\u621a'],
        keyOffices: ['\u627f\u6069\u516c', '\u989d\u9a74']
      },
      consort: {
        relationKeywords: ['empress', 'consort', 'former_empress', 'emperor_spouse', '\u7687\u540e', '\u540e\u5983'],
        titleKeywords: ['\u7687\u8d35\u5983', '\u8d35\u5983', '\u8d35\u4eba', '\u5e38\u5728', '\u7b54\u5e94', '\u5a4f\u5983', '\u5983', '\u592a\u540e'],
        keyOffices: ['\u7687\u540e', '\u592a\u540e', '\u7687\u8d35\u5983']
      }
    });
  }

  var TEMPLATES = {
    generic: {
      label: '通用古制',
      basedOn: '通用古制兜底',
      officialRanks: [
        '正一品','从一品','正二品','从二品','正三品','从三品',
        '正四品','从四品','正五品','从五品','正六品','从六品',
        '正七品','从七品','正八品','从八品','正九品','从九品'
      ],
      officeSubtabs: COMMON_OFFICE_SUBTABS,
      militarySystems: [
        { id:'recruited_army', name:'募兵', recruitmentType:'paid', salaryType:'central', peacetimeRole:'garrison', mobilizationDelay:2, loyaltyAttribution:'commander' }
      ],
      tactics: COMMON_TACTICS,
      militaryPayArrearsBaseline: { moralePerMonth: -10, loyaltyPerMonth: -5, routeMoraleBelow: 10 },
      militaryPayArrearsClamp: 0.3,
      battleResultSchemaVersion: 1,
      classPopulationMap: CLASS_POPULATION_MAP_BASE(),
      classTagDeltaMatrix: CLASS_TAG_DELTA_MATRIX_BASE(),
      classToPartyWeight: 1,
      classPartyDefaultAffinity: 0.5,
      partyToClassWeight: 1,
      recentPolicyDecay: 0.2,
      influenceGroupCatalog: INFLUENCE_GROUP_CATALOG_BASE(),
      influenceGroupAiClamp: 0.3,
      influenceGroupReissueLimit: 3,
      influenceGroupSplinterCohesionMax: 10,
      groupOutcomeWeight: 1,
      regentTriggerAgeMin: 14,
      regentTriggerHealthMax: 30,
      regentForceAgeMax: 10,
      regentForceTurnMax: 6,
      tinyiFollowUpDelay: 6,
      tinyiPolicySanctionByGrade: { S: 16, A: 12, B: 9, C: 6, D: 3 },
      tinyiSealBlock: {
        base: 0.08,
        officeControlBonus: 0.16,
        eunuchSealBonus: 0.15,
        mingMultiplier: 1.15,
        qingMultiplier: 0.25
      },
      inquiryBodyCatalog: {
        default: {
          bodies: [
            { id: 'censorate', name: '都察院', dept: 'judicial', role: '监察台', weight: 5, keywords: ['都察院', '御史', '监察', '弹劾'] },
            { id: 'six_boards_joint', name: '六部会审', dept: 'central', role: '会审', weight: 4, keywords: ['六部', '会审', '部议', '吏部', '刑部'] },
            { id: 'provincial_review', name: '巡按会审', dept: 'provincial', role: '外察', weight: 3, keywords: ['巡按', '巡抚', '地方', '外察'] }
          ]
        },
        tang: {
          bodies: [
            { id: 'tang_censorate', name: '御史台', dept: 'judicial', role: '风闻弹劾', weight: 5, keywords: ['御史台', '御史', '风闻', '弹劾'] },
            { id: 'tang_menxia', name: '门下省', dept: 'central', role: '封驳', weight: 4, keywords: ['门下省', '封驳', '谏', '封还'] },
            { id: 'tang_zhongshu', name: '中书门下', dept: 'central', role: '合议', weight: 3, keywords: ['中书', '门下', '合议', '政事堂'] }
          ]
        },
        song: {
          bodies: [
            { id: 'song_taijian', name: '台谏', dept: 'judicial', role: '言路', weight: 5, keywords: ['台谏', '谏官', '言路', '御史'] },
            { id: 'song_sanshiyuan', name: '三司', dept: 'finance', role: '清核', weight: 4, keywords: ['三司', '转运', '盐铁', '钱粮'] },
            { id: 'song_zhongshu', name: '政事堂', dept: 'central', role: '复核', weight: 3, keywords: ['政事堂', '同平章事', '参知政事'] }
          ]
        },
        ming: {
          bodies: [
            { id: 'ming_duchayuan', name: '都察院', dept: 'judicial', role: '科道', weight: 5, keywords: ['都察院', '御史', '科道', '监察'] },
            { id: 'ming_neige', name: '内阁', dept: 'central', role: '票拟复核', weight: 4, keywords: ['内阁', '票拟', '阁臣', '首辅'] },
            { id: 'ming_lijian', name: '司礼监', dept: 'imperial', role: '批红', weight: 3, keywords: ['司礼监', '批红', '秉笔', '内廷'] }
          ]
        },
        qing: {
          bodies: [
            { id: 'qing_junjichu', name: '军机处', dept: 'central', role: '密议', weight: 5, keywords: ['军机处', '军机大臣', '军机'] },
            { id: 'qing_douchayuan', name: '都察院', dept: 'judicial', role: '科道', weight: 4, keywords: ['都察院', '御史', '科道', '监察'] },
            { id: 'qing_neiwufu', name: '内务府', dept: 'imperial', role: '内廷会核', weight: 3, keywords: ['内务府', '包衣', '内廷'] }
          ]
        }
      },
      quanxuan: [
        { id:'recommendation', name:'荐举', initialScreen:'资望乡评', refinedSelection:'吏部覆核', finalDecision:'君主/中枢裁决' }
      ],
      concurrentTitleCatalog: [
        { id:'grand_tutor', name:'太师', politicalWeight:8 },
        { id:'grand_preceptor', name:'太傅', politicalWeight:7 },
        { id:'grand_guardian', name:'太保', politicalWeight:7 }
      ],
      aiAdjustClamp: 0.3,
      influenceGroupCatalog: INFLUENCE_GROUP_CATALOG_BASE()
    },
    han: {
      label: '汉',
      basedOn: '汉武帝以后',
      officialRanks: ['万石','中二千石','真二千石','二千石','比二千石','千石','比千石','六百石','比六百石','四百石','比四百石','三百石','比三百石','二百石','比二百石','百石','斗食','佐史'],
      officeSubtabs: [
        { id:'sangong', label:'三公', patterns:['丞相','太尉','御史大夫','司徒','司空'] },
        { id:'jiuqing', label:'九卿', patterns:['太常','光禄勋','卫尉','太仆','廷尉','大鸿胪','宗正','大司农','少府'] }
      ].concat(COMMON_OFFICE_SUBTABS),
      militarySystems: [
        { id:'jun_guo_bing', name:'郡国兵', recruitmentType:'registered', salaryType:'local', peacetimeRole:'local_defense', mobilizationDelay:3, loyaltyAttribution:'local' },
        { id:'mu_bing', name:'募兵', recruitmentType:'paid', salaryType:'central', peacetimeRole:'campaign', mobilizationDelay:2, loyaltyAttribution:'commander' }
      ],
      tactics: COMMON_TACTICS,
      quanxuan: [{ id:'chaju', name:'察举', initialScreen:'郡国举荐', refinedSelection:'公府考察', finalDecision:'尚书/君主任命' }],
      concurrentTitleCatalog: [{ id:'shizhong', name:'侍中', politicalWeight:7 }, { id:'shangshu_ling', name:'尚书令', politicalWeight:8 }],
      aiAdjustClamp: 0.3,
      influenceGroupCatalog: INFLUENCE_GROUP_CATALOG_HAN()
    },
    tang: {
      label: '唐',
      basedOn: '开元以后',
      officialRanks: clone(TEMPLATES_PLACEHOLDER_RANKS()),
      officeSubtabs: [
        { id:'three_departments', label:'三省', patterns:['中书省','门下省','尚书省','侍中','中书令'] },
        { id:'six_boards', label:'六部', patterns:['吏部','户部','礼部','兵部','刑部','工部'] },
        { id:'jiedushi', label:'节镇', patterns:['节度使','观察使','防御使'] }
      ].concat(COMMON_OFFICE_SUBTABS),
      militarySystems: [
        { id:'fubing', name:'府兵', recruitmentType:'household', salaryType:'land', peacetimeRole:'militia', mobilizationDelay:4, loyaltyAttribution:'state' },
        { id:'tang_mu_bing', name:'募兵', recruitmentType:'paid', salaryType:'central_local_mix', peacetimeRole:'frontier', mobilizationDelay:2, loyaltyAttribution:'commander' },
        { id:'jiedushi_private', name:'\u8282\u5ea6\u4f7f\u4eb2\u5175', recruitmentType:'paid', salaryType:'commander', peacetimeRole:'frontier', mobilizationDelay:1, loyaltyAttribution:'commander' }
      ],
      tactics: COMMON_TACTICS,
      quanxuan: [{ id:'keju_tang', name:'科举与门荫并行', initialScreen:'礼部试/门荫', refinedSelection:'吏部铨选', finalDecision:'中书门下覆奏' }],
      concurrentTitleCatalog: [{ id:'tong_zhongshu_menxia', name:'同中书门下平章事', politicalWeight:10 }, { id:'jiedushi_title', name:'节度使加衔', politicalWeight:8 }],
      aiAdjustClamp: 0.3,
      influenceGroupCatalog: INFLUENCE_GROUP_CATALOG_TANG()
    },
    ming: {
      label: '明',
      basedOn: '永乐以后',
      officialRanks: clone(TEMPLATES_PLACEHOLDER_RANKS()),
      officeSubtabs: [
        { id:'cabinet', label:'内阁', patterns:['内阁','大学士','票拟'] },
        { id:'six_boards', label:'六部', patterns:['吏部','户部','礼部','兵部','刑部','工部'] },
        { id:'censorate', label:'都察院/科道', patterns:['都察院','御史','给事中','科道'] },
        { id:'eunuch', label:'内廷厂卫', patterns:['司礼监','东厂','锦衣卫'] }
      ].concat(COMMON_OFFICE_SUBTABS),
      militarySystems: [
        { id:'weisuo', name:'卫所', recruitmentType:'hereditary', salaryType:'land', peacetimeRole:'garrison', mobilizationDelay:3, loyaltyAttribution:'state' },
        { id:'ming_mu_bing', name:'募兵', recruitmentType:'paid', salaryType:'central', peacetimeRole:'campaign', mobilizationDelay:1, loyaltyAttribution:'commander' },
        { id:'jiading', name:'\u5bb6\u4e01', recruitmentType:'paid', salaryType:'commander_local', peacetimeRole:'campaign', mobilizationDelay:1, loyaltyAttribution:'commander' }
      ],
      tactics: COMMON_TACTICS,
      quanxuan: [{ id:'keju_ming', name:'完整科举', initialScreen:'乡试会试', refinedSelection:'殿试定甲', finalDecision:'吏部铨选/廷推' }],
      concurrentTitleCatalog: [{ id:'daxueshi', name:'大学士', politicalWeight:10 }, { id:'taizi_taibao', name:'太子太保', politicalWeight:6 }, { id:'jinyiwei_zhihui', name:'锦衣卫指挥使', politicalWeight:8 }],
      aiAdjustClamp: 0.3,
      influenceGroupCatalog: INFLUENCE_GROUP_CATALOG_MING()
    },
    qing: {
      label: '清',
      basedOn: '雍正以后',
      officialRanks: clone(TEMPLATES_PLACEHOLDER_RANKS()),
      officeSubtabs: [
        { id:'grand_council', label:'军机处', patterns:['军机处','军机大臣','军机章京'] },
        { id:'six_boards', label:'六部', patterns:['吏部','户部','礼部','兵部','刑部','工部'] },
        { id:'neiwufu', label:'内务府', patterns:['内务府','包衣','郎中'] },
        { id:'banners', label:'八旗', patterns:['八旗','都统','参领','佐领'] }
      ].concat(COMMON_OFFICE_SUBTABS),
      militarySystems: [
        { id:'banner_army', name:'八旗', recruitmentType:'hereditary', salaryType:'banner_stipend', peacetimeRole:'capital_garrison', mobilizationDelay:2, loyaltyAttribution:'banner' },
        { id:'green_standard', name:'绿营', recruitmentType:'paid', salaryType:'provincial', peacetimeRole:'local_garrison', mobilizationDelay:3, loyaltyAttribution:'state' },
        { id:'xiangyong', name:'乡勇', recruitmentType:'local_militia', salaryType:'local', peacetimeRole:'emergency', mobilizationDelay:1, loyaltyAttribution:'commander' }
      ],
      tactics: COMMON_TACTICS,
      quanxuan: [{ id:'keju_qing', name:'科举与旗缺并行', initialScreen:'科举/旗员资序', refinedSelection:'部院引见', finalDecision:'军机/皇帝裁决' }],
      concurrentTitleCatalog: [{ id:'junji_dachen', name:'军机大臣', politicalWeight:10 }, { id:'yizheng_wang', name:'议政王', politicalWeight:9 }, { id:'nanshufang', name:'南书房行走', politicalWeight:7 }],
      aiAdjustClamp: 0.3,
      influenceGroupCatalog: INFLUENCE_GROUP_CATALOG_QING()
    }
  };

  function TEMPLATES_PLACEHOLDER_RANKS() {
    return ['正一品','从一品','正二品','从二品','正三品','从三品','正四品','从四品','正五品','从五品','正六品','从六品','正七品','从七品','正八品','从八品','正九品','从九品'];
  }

  function OFFICE_SUBTABS_PHASE4(key) {
    var generic = {
      central: [
        { key:'all', name:'\u5168\u90e8', desc:'\u4e2d\u67a2\u767e\u53f8' },
        { key:'shuji', name:'\u67a2\u673a\u8f85\u653f', desc:'\u76f8\u8f85\u3001\u4e2d\u4e66\u3001\u95e8\u4e0b\u3001\u5185\u9601\u3001\u519b\u673a' },
        { key:'liucao', name:'\u516d\u66f9\u767e\u53f8', desc:'\u540f\u6237\u793c\u5175\u5211\u5de5\u53ca\u5c1a\u4e66\u4f8d\u90ce' },
        { key:'taijian', name:'\u53f0\u8c0f\u98ce\u5baa', desc:'\u5fa1\u53f2\u53f0\u3001\u90fd\u5bdf\u9662\u3001\u79d1\u9053' },
        { key:'sijian', name:'\u5bfa\u76d1\u4e5d\u537f', desc:'\u793c\u4e50\u533b\u535c\u3001\u8f66\u9a6c\u3001\u4ed3\u50a8\u8bf8\u53f8' },
        { key:'xunqi', name:'\u52cb\u621a\u52a0\u8854', desc:'\u4e09\u516c\u4e09\u5b64\u3001\u5b97\u5ba4\u52cb\u621a' }
      ],
      inner: [
        { key:'all', name:'\u5168\u90e8', desc:'\u5185\u5ef7\u8fd1\u4f8d' },
        { key:'zhongchao', name:'\u4e2d\u671d\u673a\u8981', desc:'\u8fd1\u4f8d\u6279\u9605\u4e0e\u5185\u5ef7\u673a\u8981' },
        { key:'tiqi', name:'\u7f07\u9a91\u8033\u76ee', desc:'\u7f09\u6355\u3001\u4fa6\u7f09\u3001\u8bcf\u72f1' },
        { key:'suwei', name:'\u5bbf\u536b\u7981\u519b', desc:'\u4f8d\u536b\u3001\u7981\u519b\u3001\u5bbf\u536b' },
        { key:'gongyu', name:'\u4f9b\u5fa1\u5bab\u52a1', desc:'\u5185\u52a1\u3001\u5c11\u5e9c\u3001\u5bab\u52a1' }
      ],
      region: [
        { key:'all', name:'\u5168\u90e8', desc:'\u5730\u65b9\u804c\u5b98' },
        { key:'fengjiang', name:'\u5c01\u7586\u7763\u629a', desc:'\u65b9\u9762\u5927\u5458\u3001\u8282\u5ea6\u3001\u7763\u629a' },
        { key:'fannie', name:'\u85e9\u81ec\u4e09\u53f8', desc:'\u5e03\u653f\u3001\u6309\u5bdf\u3001\u90fd\u53f8' },
        { key:'junxian', name:'\u90e1\u53bf\u7267\u5b88', desc:'\u90e1\u53bf\u3001\u5dde\u5e9c\u3001\u7267\u5b88' },
        { key:'bianzhen', name:'\u8fb9\u9547\u8282\u5e05', desc:'\u8fb9\u519b\u3001\u603b\u5175\u3001\u5c06\u519b' }
      ]
    };
    if (key === 'han') {
      generic.central.splice(1, 0,
        { key:'sangong', name:'\u4e09\u516c', desc:'\u4e1e\u76f8\u3001\u592a\u5c09\u3001\u5fa1\u53f2\u5927\u592b' },
        { key:'jiuqing', name:'\u4e5d\u537f', desc:'\u592a\u5e38\u3001\u5ef7\u5c09\u3001\u5927\u53f8\u519c\u3001\u5c11\u5e9c' }
      );
    } else if (key === 'tang') {
      generic.central.splice(1, 0,
        { key:'three_departments', name:'\u4e09\u7701', desc:'\u4e2d\u4e66\u7701\u3001\u95e8\u4e0b\u7701\u3001\u5c1a\u4e66\u7701' }
      );
      generic.region.splice(1, 0,
        { key:'jiedushi', name:'\u8282\u9547', desc:'\u8282\u5ea6\u4f7f\u3001\u89c2\u5bdf\u4f7f\u3001\u9632\u5fa1\u4f7f' }
      );
    } else if (key === 'ming') {
      generic.central.splice(1, 0,
        { key:'cabinet', name:'\u5185\u9601', desc:'\u5927\u5b66\u58eb\u3001\u7968\u62df\u3001\u9601\u81e3' }
      );
      generic.inner.splice(1, 0,
        { key:'eunuch', name:'\u5185\u5ef7\u5382\u536b', desc:'\u53f8\u793c\u76d1\u3001\u4e1c\u5382\u3001\u9526\u8863\u536b' }
      );
    } else if (key === 'qing') {
      generic.inner.splice(1, 0,
        { key:'grand_council', name:'\u519b\u673a\u5904', desc:'\u519b\u673a\u5927\u81e3\u3001\u519b\u673a\u7ae0\u4eac' },
        { key:'neiwufu', name:'\u5185\u52a1\u5e9c', desc:'\u5185\u52a1\u3001\u5305\u8863\u3001\u5bab\u52a1' },
        { key:'banners', name:'\u516b\u65d7', desc:'\u516b\u65d7\u3001\u90fd\u7edf\u3001\u53c2\u9886\u3001\u4f50\u9886' }
      );
    }
    return generic;
  }

  function OFFICE_CLASSIFIER_PATTERNS_PHASE4(key) {
    var common = [
      { pattern:'\\u90fd\\u5bdf\\u9662|\\u5fa1\\u53f2|\\u516d\\u79d1|\\u7ed9\\u4e8b\\u4e2d', court:'central', group:'taijian' },
      { pattern:'\\u540f\\u90e8|\\u6237\\u90e8|\\u793c\\u90e8|\\u5175\\u90e8|\\u5211\\u90e8|\\u5de5\\u90e8|\\u5c1a\\u4e66|\\u4f8d\\u90ce', court:'central', group:'liucao' },
      { pattern:'\\u603b\\u7763|\\u5de1\\u629a|\\u7ecf\\u7565|\\u6309\\u5bdf|\\u5e03\\u653f', court:'region', group:'fengjiang' },
      { pattern:'\\u603b\\u5175|\\u8fb9\\u9547|\\u536b\\u6240|\\u5c06\\u519b', court:'region', group:'bianzhen' }
    ];
    var byDynasty = {
      han: [
        { pattern:'\\u4e1e\\u76f8|\\u592a\\u5c09|\\u5fa1\\u53f2\\u5927\\u592b|\\u53f8\\u5f92|\\u53f8\\u7a7a', court:'central', group:'sangong' },
        { pattern:'\\u592a\\u5e38|\\u5ef7\\u5c09|\\u5927\\u53f8\\u519c|\\u5c11\\u5e9c|\\u5927\\u9e3f\\u80ea', court:'central', group:'jiuqing' },
        { pattern:'\\u4e2d\\u5e38\\u4f8d|\\u5c1a\\u4e66\\u53f0', court:'inner', group:'zhongchao' }
      ],
      tang: [
        { pattern:'\\u4e2d\\u4e66\\u7701|\\u95e8\\u4e0b\\u7701|\\u5c1a\\u4e66\\u7701|\\u653f\\u4e8b\\u5802|\\u540c\\u4e2d\\u4e66\\u95e8\\u4e0b', court:'central', group:'three_departments' },
        { pattern:'\\u8282\\u5ea6\\u4f7f|\\u89c2\\u5bdf\\u4f7f|\\u9632\\u5fa1\\u4f7f', court:'region', group:'jiedushi' },
        { pattern:'\\u795e\\u7b56\\u519b|\\u5185\\u4f8d\\u7701', court:'inner', group:'suwei' }
      ],
      ming: [
        { pattern:'\\u5185\\u9601|\\u5927\\u5b66\\u58eb|\\u7968\\u62df', court:'central', group:'cabinet' },
        { pattern:'\\u53f8\\u793c\\u76d1|\\u4e1c\\u5382|\\u9526\\u8863\\u536b', court:'inner', group:'eunuch' }
      ],
      qing: [
        { pattern:'\\u519b\\u673a\\u5904|\\u519b\\u673a\\u5927\\u81e3|\\u519b\\u673a\\u7ae0\\u4eac', court:'inner', group:'grand_council' },
        { pattern:'\\u5185\\u52a1\\u5e9c|\\u5305\\u8863', court:'inner', group:'neiwufu' },
        { pattern:'\\u516b\\u65d7|\\u90fd\\u7edf|\\u53c2\\u9886|\\u4f50\\u9886', court:'inner', group:'banners' }
      ]
    };
    return (byDynasty[key] || []).concat(common);
  }

  function OFFICIAL_RANKS_PHASE4(key) {
    if (key === 'tang') {
      return ['\u6b63\u4e00\u54c1','\u4ece\u4e00\u54c1','\u6b63\u4e8c\u54c1','\u4ece\u4e8c\u54c1','\u6b63\u4e09\u54c1','\u4ece\u4e09\u54c1','\u6b63\u56db\u54c1\u4e0a','\u6b63\u56db\u54c1\u4e0b','\u4ece\u56db\u54c1\u4e0a','\u4ece\u56db\u54c1\u4e0b','\u6b63\u4e94\u54c1\u4e0a','\u6b63\u4e94\u54c1\u4e0b','\u4ece\u4e94\u54c1\u4e0a','\u4ece\u4e94\u54c1\u4e0b','\u6b63\u516d\u54c1\u4e0a','\u6b63\u516d\u54c1\u4e0b','\u4ece\u516d\u54c1\u4e0a','\u4ece\u516d\u54c1\u4e0b','\u6b63\u4e03\u54c1\u4e0a','\u6b63\u4e03\u54c1\u4e0b','\u4ece\u4e03\u54c1\u4e0a','\u4ece\u4e03\u54c1\u4e0b','\u6b63\u516b\u54c1\u4e0a','\u6b63\u516b\u54c1\u4e0b','\u4ece\u516b\u54c1\u4e0a','\u4ece\u516b\u54c1\u4e0b','\u6b63\u4e5d\u54c1\u4e0a','\u6b63\u4e5d\u54c1\u4e0b','\u4ece\u4e5d\u54c1\u4e0a','\u4ece\u4e5d\u54c1\u4e0b'];
    }
    if (key === 'ming' || key === 'qing') return TEMPLATES_PLACEHOLDER_RANKS().concat(['\u672a\u5165\u6d41']);
    return null;
  }

  function installPhase4OfficeCatalogs() {
    Object.keys(TEMPLATES).forEach(function(key) {
      var tpl = TEMPLATES[key];
      if (!tpl) return;
      if (!tpl.officeSubtabs || Array.isArray(tpl.officeSubtabs)) tpl.officeSubtabs = OFFICE_SUBTABS_PHASE4(key);
      if (!tpl.officeClassifierPatterns || !tpl.officeClassifierPatterns.length) tpl.officeClassifierPatterns = OFFICE_CLASSIFIER_PATTERNS_PHASE4(key);
      var ranks = OFFICIAL_RANKS_PHASE4(key);
      if (ranks) tpl.officialRanks = ranks;
    });
  }
  installPhase4OfficeCatalogs();

  function getTemplate(key) {
    var tpl = TEMPLATES[key || 'generic'];
    if (!tpl) return null;
    var out = clone(tpl);
    if (key && key !== 'generic' && TEMPLATES.generic) {
      out = mergeMissing(out, clone(TEMPLATES.generic));
    }
    return out;
  }

  function listTemplates() {
    return Object.keys(TEMPLATES).map(function(key) {
      return { key: key, label: TEMPLATES[key].label, basedOn: TEMPLATES[key].basedOn };
    });
  }

  var OWNED_TOP_LEVEL_CONSTANTS = {
    influenceGroupCatalog: true,
    officeSubtabs: true,
    officeClassifierPatterns: true,
    officialRanks: true,
    concurrentTitleCatalog: true,
    inquiryBodyCatalog: true,
    militarySystems: true,
    tactics: true,
    militaryPayArrearsBaseline: true,
    militaryPayArrearsClamp: true,
    battleResultSchemaVersion: true
  };

  function hasDeclaredValue(value) {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return value !== '';
  }

  function mergeMissing(target, source, path) {
    Object.keys(source || {}).forEach(function(key) {
      var nextPath = path ? path + '.' + key : key;
      if (target[key] === undefined) target[key] = clone(source[key]);
      else if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key]) && source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!path && OWNED_TOP_LEVEL_CONSTANTS[key] && hasDeclaredValue(target[key])) return;
        mergeMissing(target[key], source[key], nextPath);
      }
    });
    return target;
  }

  function applyTemplate(target, key, options) {
    options = options || {};
    if (!target || typeof target !== 'object') throw new Error('applyTemplate 需要传入剧本/scriptData 对象');
    var tpl = getTemplate(key || 'generic');
    if (!tpl) throw new Error('未知引擎常量模板: ' + key);
    if (!target.engineConstants || typeof target.engineConstants !== 'object') target.engineConstants = {};
    if (options.overwrite) target.engineConstants = tpl;
    else mergeMissing(target.engineConstants, tpl);
    target.engineConstants._templateKey = key || 'generic';
    target.engineConstants._templateAppliedAt = options.appliedAt || (new Date()).toISOString();
    return target.engineConstants;
  }

  var api = {
    currentVersion: 1,
    constantsOf: constantsOf,
    read: read,
    get: read,
    has: has,
    requirePaths: requirePaths,
    getTemplate: getTemplate,
    listTemplates: listTemplates,
    applyTemplate: applyTemplate,
    clone: clone
  };

  TM.EngineConstants = api;
  global.EngineConstants = api;
})(typeof window !== 'undefined' ? window : globalThis);
