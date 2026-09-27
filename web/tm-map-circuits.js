/* tm-map-circuits.js — 省道（通志）数据层
 *
 * 从地图上的府州地块推出「省道」这一级：分组、成员、按归属切分、开局档案、实时汇总、问题轻重排序。
 *
 * 约定：
 * - 纯函数：不读写 DOM，不写 GM / P，不调 AI。地图模块把现成的取数函数作为参数（hooks）传进来。
 * - 分组与地图同源：省道 key 一律取 TMMapRealmLayout.administrativeGroups 给出的 key，
 *   所以通志列出的州与地图上描出的省道边界、省名标签完全一致。
 * - 数字只从下辖府州实时汇总：引擎每回合只更新叶子节点，省级节点自带的数字开局后就冻结了，这里绝不读。
 * - 档案只取文字：长官、官衔、治所、战略价值、威胁等来自剧本的开局描述。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.TM = root.TM || {};
    root.TM.MapCircuits = api;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ── 小工具 ──────────────────────────────────────────────

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  // 读出一个数：接受数字、纯数字字符串，以及 { mouths } / { total } 这类人口对象。其余一律视为缺失。
  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
    if (value && typeof value === 'object') {
      if (value.mouths != null) return toNumber(value.mouths);
      if (value.total != null) return toNumber(value.total);
    }
    return null;
  }

  function regionText(region, key) {
    if (!region) return '';
    return text(region[key]) || text(region.data && region.data[key]);
  }

  // 成员里第一个带该文字字段的值（晚唐的官衔逐块抄在地块上）
  function firstMemberText(regions, key) {
    for (var i = 0; i < regions.length; i += 1) {
      var value = regionText(regions[i], key);
      if (value) return value;
    }
    return '';
  }

  function textList(value) {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    return list(value).map(function (item) {
      return typeof item === 'string' ? item.trim() : text(item && (item.name || item.title));
    }).filter(Boolean);
  }

  // ── 分组 ────────────────────────────────────────────────

  /**
   * 建立省道索引。
   * @param {object} map 当前地图（含 regions、circuitRegistry）
   * @param {{ layout: object, ownerOf: function }} options
   *   layout：TMMapRealmLayout（取其 administrativeGroups）；ownerOf(region)：返回该地块现归属势力的 key
   * @returns {{ circuits: Map, byRegion: Map, byRegionId: Map }}
   */
  function indexCircuits(map, options) {
    var regions = list(map && map.regions);
    var layout = options && options.layout;
    var ownerOf = (options && typeof options.ownerOf === 'function') ? options.ownerOf : function () { return ''; };
    var circuits = new Map();
    var byRegion = new Map();
    var byRegionId = new Map();
    if (!regions.length || !layout || typeof layout.administrativeGroups !== 'function') {
      return { circuits: circuits, byRegion: byRegion, byRegionId: byRegionId };
    }

    var registry = new Map();
    list(map.circuitRegistry).forEach(function (entry) {
      if (entry && (entry.key || entry.id)) registry.set(String(entry.key || entry.id), entry);
    });

    var owners = regions.map(function (region) { return String(ownerOf(region) || 'unowned'); });
    var rows = layout.administrativeGroups(map, owners) || [];
    rows.forEach(function (row) {
      if (!row || !row.region) return;
      var key = String(row.key);
      var circuit = circuits.get(key);
      if (!circuit) {
        var entry = registry.get(key) || null;
        circuit = {
          key: key,
          label: text(row.label) || text(entry && entry.name) || key,
          entry: entry,
          members: []
        };
        circuits.set(key, circuit);
      }
      circuit.members.push({ region: row.region, owner: String(row.owner) });
      byRegion.set(row.region, key);
      if (row.region.id != null) byRegionId.set(String(row.region.id), key);
    });
    return { circuits: circuits, byRegion: byRegion, byRegionId: byRegionId };
  }

  // 地块所属的省道；找不到返回 null
  function circuitOf(index, region) {
    if (!index || !region) return null;
    var key = index.byRegion.get(region);
    if (key == null && region.id != null) key = index.byRegionId.get(String(region.id));
    return key == null ? null : (index.circuits.get(key) || null);
  }

  // 值得单独成页的省道：有分组登记，或下辖不止一块。
  // 没有层级数据的旧地图里，每块地会自成一「组」，这种不开通志，交给方志。
  function isRealCircuit(circuit) {
    return !!circuit && (!!circuit.entry || circuit.members.length > 1);
  }

  // ── 按归属切分 ──────────────────────────────────────────

  /**
   * 以观察者势力为「本方」，把一道的成员切成本方实控与他属两部分。
   * @returns {{ own: object[], others: { owner: string, regions: object[] }[] }}
   */
  function partitionByOwner(circuit, viewerOwner) {
    var own = [];
    var others = new Map();
    var viewer = viewerOwner == null ? null : String(viewerOwner);
    list(circuit && circuit.members).forEach(function (member) {
      if (viewer !== null && member.owner === viewer) {
        own.push(member.region);
        return;
      }
      if (!others.has(member.owner)) others.set(member.owner, []);
      others.get(member.owner).push(member.region);
    });
    return {
      own: own,
      others: Array.from(others, function (pair) { return { owner: pair[0], regions: pair[1] }; })
    };
  }

  // ── 开局档案 ────────────────────────────────────────────

  var UPPER_LEVEL = /^(province|circuit|state|dao|lu|省|道|路)$/i;

  // 行政节点是否像省级：有下辖或层级标记为省道。按名称兜底查到的节点必须过这一关，免得撞上同名府州。
  function looksProvincial(node) {
    if (!node) return false;
    if (list(node.children).length || list(node.divisions).length || list(node.prefectures).length) return true;
    return UPPER_LEVEL.test(String(node.level || ''));
  }

  function capitalName(node, regions) {
    var capitalId = node && text(node.capitalChildId);
    if (capitalId) {
      var children = list(node.prefectures).concat(list(node.children), list(node.divisions));
      for (var i = 0; i < children.length; i += 1) {
        if (children[i] && String(children[i].id) === capitalId && text(children[i].name)) return text(children[i].name);
      }
    }
    for (var j = 0; j < regions.length; j += 1) {
      var region = regions[j];
      var flagged = region && (region.capital === true || (region.data && region.data.capital === true));
      if (flagged) return text(region.name) || text(region.title);
    }
    return '';
  }

  /**
   * 省道的开局档案（只取文字）。
   * @param {object} circuit indexCircuits 给出的省道
   * @param {{ findAdmin: function }} options findAdmin({ id, name }) → 行政树节点（由地图模块用 findLiveAdminDivision 实现）
   *   查找顺序：分组登记的 sourceAdminId（天启）→ 登记 key / 省道 key（晚唐道节点的 id 就是它）→ 省道名称（须像省级节点）。
   */
  function profileOf(circuit, options) {
    var entry = (circuit && circuit.entry) || {};
    var regions = list(circuit && circuit.members).map(function (member) { return member.region; });
    var findAdmin = options && typeof options.findAdmin === 'function' ? options.findAdmin : null;

    var node = null;
    if (findAdmin) {
      var ids = [text(entry.sourceAdminId), text(entry.key) || text(entry.id), text(circuit && circuit.key)];
      for (var i = 0; i < ids.length && !node; i += 1) {
        if (ids[i]) node = findAdmin({ id: ids[i], name: '' }) || null;
      }
      if (!node && circuit && text(circuit.label)) {
        var byName = findAdmin({ id: '', name: circuit.label }) || null;
        if (looksProvincial(byName)) node = byName;
      }
    }

    return {
      title: text(node && node.historicalTitle) || text(entry.title) || firstMemberText(regions, 'circuitTitle'),
      description: text(node && node.description),
      commandType: text(entry.commandType) || text(node && node.commandType),
      governor: text(node && node.governor) || firstMemberText(regions, 'circuitGovernor'),
      officialPosition: text(node && node.officialPosition),
      capital: capitalName(node, regions),
      strategicValue: text(node && node.strategicValue),
      threats: textList(node && node.threats),
      gentry: textList(node && node.leadingGentry),
      academies: textList(node && node.academies),
      custodyNote: text(node && node.custodyNote),
      note: text(entry.note),
      adminId: node && node.id != null ? String(node.id) : '',
      source: node ? 'admin' : (circuit && circuit.entry ? 'registry' : 'regions')
    };
  }

  // ── 实时汇总 ────────────────────────────────────────────

  /**
   * 汇总下辖府州的实时数字，口径与方志一致。
   * @param {object[]} regions 参与汇总的府州（通常是本方实控部分）
   * @param {{ bundle: function, mood: function, office: function }} hooks
   *   bundle(region) → regionBundle 结果；mood / office(region, bundle) → 0-100 评分（与方志读数带同源）
   */
  function summarize(regions, hooks) {
    var sum = {
      count: 0,
      population: 0,
      ding: 0,
      actualRevenue: 0,
      claimedRevenue: 0,
      remittedToCenter: 0,
      retainedBudget: 0,
      compliance: null,
      troops: 0,
      garrisoned: 0,
      treasury: { money: 0, grain: 0 },
      mood: null,
      office: null,
      missing: { population: 0, revenue: 0, troops: 0 }
    };
    var weightedMood = 0, moodWeight = 0;
    var weightedOffice = 0, officeWeight = 0;
    var weightedCompliance = 0, complianceWeightSum = 0;

    list(regions).forEach(function (region) {
      var bundle = (hooks && typeof hooks.bundle === 'function' ? hooks.bundle(region) : null) || {};
      var data = bundle.data || {};
      var pop = bundle.pop || {};
      var fiscal = bundle.fiscal || {};
      var army = bundle.army || {};
      sum.count += 1;

      var population = toNumber(data.population);
      if (population === null) population = toNumber(pop.mouths);
      if (population === null) sum.missing.population += 1; else sum.population += population;
      var ding = toNumber(pop.ding);
      if (ding !== null) sum.ding += ding;

      var revenue = toNumber(fiscal.actualRevenue);
      if (revenue === null) sum.missing.revenue += 1; else sum.actualRevenue += revenue;
      var claimed = toNumber(fiscal.claimedRevenue);
      if (claimed !== null && revenue !== null) sum.claimedRevenue += claimed;
      // 合规与方志同口径：取各州财赋的 compliance，按名义应征加权（没有应征数的州按权重 1）
      var compliance = toNumber(fiscal.compliance);
      if (compliance !== null) {
        var complianceWeight = claimed !== null && claimed > 0 ? claimed : 1;
        weightedCompliance += compliance * complianceWeight;
        complianceWeightSum += complianceWeight;
      }
      var remitted = toNumber(fiscal.remittedToCenter);
      if (remitted !== null) sum.remittedToCenter += remitted;
      var retained = toNumber(fiscal.retainedBudget);
      if (retained !== null) sum.retainedBudget += retained;

      var troops = toNumber(data.garrison);
      if (troops === null) troops = toNumber(army.troops);
      if (troops === null) troops = toNumber(region && region.troops);
      if (troops === null) sum.missing.troops += 1; else sum.troops += troops;
      if (troops !== null && troops > 0) sum.garrisoned += 1;

      // 公帑：各州地方库藏（叶子记账），与方志财赋志同源
      var treasury = (bundle.liveDivision && bundle.liveDivision.publicTreasury) || data.publicTreasury || null;
      var money = toNumber(treasury && treasury.money && treasury.money.stock);
      if (money !== null) sum.treasury.money += money;
      var grain = toNumber(treasury && treasury.grain && treasury.grain.stock);
      if (grain !== null) sum.treasury.grain += grain;

      // 民心、吏治按人口加权；没有人口数的州按权重 1 计，免得被整个忽略
      var weight = population && population > 0 ? population : 1;
      var mood = hooks && typeof hooks.mood === 'function' ? toNumber(hooks.mood(region, bundle)) : null;
      if (mood !== null) { weightedMood += mood * weight; moodWeight += weight; }
      var office = hooks && typeof hooks.office === 'function' ? toNumber(hooks.office(region, bundle)) : null;
      if (office !== null) { weightedOffice += office * weight; officeWeight += weight; }
    });

    if (moodWeight > 0) sum.mood = Math.round(weightedMood / moodWeight);
    if (officeWeight > 0) sum.office = Math.round(weightedOffice / officeWeight);
    if (complianceWeightSum > 0) sum.compliance = weightedCompliance / complianceWeightSum;
    return sum;
  }

  // ── 问题轻重排序 ────────────────────────────────────────

  // 参与排序的地图评分：模式名与 phase8-formal-map 的 modeScore 一致
  var PROBLEM_MODES = [
    { mode: 'mood', label: '民心' },
    { mode: 'army', label: '军务' },
    { mode: 'office', label: '吏治' },
    { mode: 'tax', label: '财赋' },
    { mode: 'yizheng', label: '役政' },
    { mode: 'classPressure', label: '阶层压力' }
  ];

  /**
   * 按问题轻重给府州排序。规则固定、可复现，不调 AI。
   * 每项评分进入预警档记 2 分，再加上灾异状态与民变信号；分数相同时按名称排，保证顺序稳定。
   * @param {object[]} regions
   * @param {{ score: function, grade: function, isWarn: function, statusOf: function, unrestOf: function }} hooks
   *   score(region, mode) → 该项评分；grade(mode, score) → 档位对象（含 mark）；isWarn(mode, grade) → 是否预警档；
   *   statusOf(region) → 状态数组（可选）；unrestOf(region) → 民变或不稳数值（可选）
   * @returns {{ region: object, score: number, reasons: string[], issues: object[] }[]}
   *   issues 与 reasons 一一对应，是结构化的同一批问题：{ key, weight, text }，key 相同即同一种问题（供 liftCommonProblems 比对）
   */
  function rankProblems(regions, hooks) {
    hooks = hooks || {};
    var rows = list(regions).map(function (region) {
      var issues = [];
      PROBLEM_MODES.forEach(function (item) {
        if (typeof hooks.score !== 'function') return;
        var value = hooks.score(region, item.mode);
        if (value === '' || value === null || value === undefined) return;
        var grade = typeof hooks.grade === 'function' ? hooks.grade(item.mode, value) : null;
        var warn = typeof hooks.isWarn === 'function' ? !!hooks.isWarn(item.mode, grade) : false;
        if (warn) {
          var mark = grade && grade.mark ? String(grade.mark) : '';
          // 同一评分落在同一档位，才算同一种问题；数值差几分不影响归并
          issues.push({ key: 'mode:' + item.mode + ':' + mark, label: item.label, mark: mark, weight: 2,
            text: item.label + ' ' + Math.round(Number(value)) + (mark ? ' ' + mark : '') });
        }
      });

      var statuses = typeof hooks.statusOf === 'function' ? list(hooks.statusOf(region)) : [];
      statuses.forEach(function (effect) {
        if (effect && effect.kind === 'disaster') {
          var name = text(effect.name) || '灾异';
          issues.push({ key: 'disaster:' + name, label: name, mark: '', weight: 1, text: name });
        }
      });

      var unrest = typeof hooks.unrestOf === 'function' ? toNumber(hooks.unrestOf(region)) : null;
      if (unrest !== null && unrest >= 60) {
        issues.push({ key: 'unrest', label: '不稳', mark: '', weight: 1, text: '不稳 ' + Math.round(unrest) });
      }

      var score = issues.reduce(function (total, issue) { return total + issue.weight; }, 0);
      return { region: region, score: score, reasons: issues.map(function (issue) { return issue.text; }), issues: issues };
    });

    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var an = text(a.region && (a.region.name || a.region.title));
      var bn = text(b.region && (b.region.name || b.region.title));
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return rows;
  }

  function nameOf(region) {
    return text(region && (region.name || region.title));
  }

  /**
   * 共性上提：全道每个州都有、且落在同一档位的问题，提到道一级说一次；各州只留独有的问题，并据此重排。
   * 独有问题同分时按人口多少排（大州在前），再按名称，保证顺序稳定。不足两州时不归并。
   * @param {object[]} ranked rankProblems 的结果
   * @param {{ populationOf: function }} options populationOf(region) → 人口（可缺）
   * @returns {{ common: { key: string, label: string, mark: string, count: number }[], rows: object[] }}
   */
  function liftCommonProblems(ranked, options) {
    var rows = list(ranked);
    var populationOf = options && typeof options.populationOf === 'function' ? options.populationOf : function () { return null; };
    var common = [];
    if (rows.length >= 2) {
      list(rows[0].issues).forEach(function (issue) {
        var everywhere = rows.every(function (row) {
          return list(row.issues).some(function (other) { return other.key === issue.key; });
        });
        var seen = common.some(function (item) { return item.key === issue.key; });
        if (everywhere && !seen) common.push({ key: issue.key, label: issue.label, mark: issue.mark, count: rows.length });
      });
    }
    var commonKeys = common.map(function (item) { return item.key; });

    var lifted = rows.map(function (row) {
      var own = list(row.issues).filter(function (issue) { return commonKeys.indexOf(issue.key) < 0; });
      return {
        region: row.region,
        score: own.reduce(function (total, issue) { return total + issue.weight; }, 0),
        reasons: own.map(function (issue) { return issue.text; }),
        issues: own
      };
    });
    lifted.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var ap = toNumber(populationOf(a.region)) || 0;
      var bp = toNumber(populationOf(b.region)) || 0;
      if (bp !== ap) return bp - ap;
      var an = nameOf(a.region), bn = nameOf(b.region);
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return { common: common, rows: lifted };
  }

  // ── 营造汇总 ────────────────────────────────────────────

  /**
   * 汇总下辖各州的建筑：只作展示，不改任何账。
   * @param {object[]} regions 参与汇总的府州
   * @param {{ buildingsOf: function, categoryOf: function }} hooks
   *   buildingsOf(region) → 该州建筑数组（与方志营造志同源）；categoryOf(building) → 类别（取剧本建筑类型表）
   * @returns {{ total: number, byStatus: object, byCategory: object, byRegion: { region: object, buildings: object[] }[] }}
   */
  function summarizeBuildings(regions, hooks) {
    var result = { total: 0, byStatus: { intact: 0, building: 0, neglected: 0, damaged: 0 }, byCategory: {}, byRegion: [] };
    list(regions).forEach(function (region) {
      var items = list(hooks && typeof hooks.buildingsOf === 'function' ? hooks.buildingsOf(region) : []).filter(Boolean);
      if (!items.length) return;
      items.forEach(function (building) {
        result.total += 1;
        var status = building.status === 'building' || building.status === 'neglected' || building.status === 'damaged' ? building.status : 'intact';
        result.byStatus[status] += 1;
        var category = text(hooks && typeof hooks.categoryOf === 'function' ? hooks.categoryOf(building) : '') || 'other';
        result.byCategory[category] = (result.byCategory[category] || 0) + 1;
      });
      result.byRegion.push({ region: region, buildings: items });
    });
    result.byRegion.sort(function (a, b) {
      if (b.buildings.length !== a.buildings.length) return b.buildings.length - a.buildings.length;
      var an = nameOf(a.region), bn = nameOf(b.region);
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return result;
  }

  return {
    version: 1,
    indexCircuits: indexCircuits,
    circuitOf: circuitOf,
    isRealCircuit: isRealCircuit,
    partitionByOwner: partitionByOwner,
    profileOf: profileOf,
    summarize: summarize,
    rankProblems: rankProblems,
    liftCommonProblems: liftCommonProblems,
    summarizeBuildings: summarizeBuildings,
    PROBLEM_MODES: PROBLEM_MODES.map(function (item) { return item.mode; })
  };
});
