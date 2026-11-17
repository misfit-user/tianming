// ============================================================
// Module: editor-schema-adapter.js
// Domain: Editor / schema 转换
// Owns:
//   - editor scriptData ↔ scenario.json schema 双向 adapter
//   - importScenario / exportScenario / roundtripCheck
//   - classifyVariable / classifyEventBucket / deepDiff
//   - EVENT_TYPE_MAP (13 详 → 5 bucket·historical/random/conditional/story/chain)
// Does not own:
//   - 业务 form 编辑 UI (见 editor-form-* Phase 3 后)
//   - AI 生成 (editor-ai-gen.js / editor-ai-multipass.js)
//   - 通用 CRUD (editor-crud.js)
// Public API:
//   - global.importScenario(rawJson) → editor scriptData
//   - global.exportScenario(scriptData) → runtime-shape JSON
//   - global.roundtripCheck(scriptData) → diff report
// Depends on:
//   - global scriptData (editor-core.js)
//   - none·pure adapter (no DOM·no network)
// Used by:
//   - editor-crud.js (导入/导出 button)
//   - editor.html script include
// Tests:
//   - syntax-check
//   - render-smoke (boot loads OK)
// Refactor notes:
//   - Phase 0 implemented (sc18 schema unify·event/variable bucket-ize)
//   - Phase 5 namespace·TM.Editor.SchemaAdapter
//   - 见 Desktop/剧本/notes/editor-engine-adapter-contract.md
// ============================================================

(function(global) {
  'use strict';

  var EVENT_BUCKETS = ['historical', 'random', 'conditional', 'story', 'chain'];

  // 1.6 细分 event.type → 5 类 bucket·evt.type 字段保留 (downstream sc18 仍可读细分)
  var EVENT_TYPE_MAP = {
    'historical': 'historical',
    'random': 'random',
    'conditional': 'conditional',
    'story': 'story',
    'chain': 'chain',
    'startup_forced': 'story',
    'startup_choice': 'story',
    'turn_choice': 'conditional',
    'turn_event': 'random',
    'turn_event_critical': 'story',
    'turn_event_warning': 'conditional',
    'recurrent': 'random',
    'latent_hook': 'chain',
    'easter_egg': 'historical'
  };

  function classifyEventBucket(evtType) {
    return EVENT_TYPE_MAP[evtType] || 'historical';
  }

  var VAR_BASE_KEYWORDS = [
    'var_treasury', 'var_food', 'var_population', 'var_morale',
    'var_loyalty', 'var_military', 'var_administration', 'var_legitimacy',
    'var_economy', 'var_stability', 'var_unity'
  ];

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  // 旧格式军事数据迁移·值域映射表
  // 旧 military.troops[].type 值域（取自官方剧本与历史数据）→ 军务面板部队编辑表单的 armyType 七枚举。
  // 表单枚举：禁军 / 边军 / 藩镇军 / 地方守备 / 水师 / 乡勇/民兵 / 自定义。
  // 映射不到的未知值不在此表——迁移时保留原字符串（表单侧补动态选项显示，不静默改值）。
  var ARMY_TYPE_MAP = {
    '中央军': '禁军',        // 京营等中央/京畿军 → 禁军
    '边军': '边军',
    '海岛边军': '边军',      // 海岛驻防的边军（如东江/皮岛）仍属边军
    '地方军': '地方守备',
    '特殊兵': '自定义',      // 无对应枚举
    '后勤': '自定义'         // 辎重/后勤·无对应枚举
  };
  var ARMY_TYPE_ENUMS = ['禁军', '边军', '藩镇军', '地方守备', '水师', '乡勇/民兵', '自定义'];

  // troops → initialTroops：深克隆(隔离 equipment/composition 等嵌套数组引用)，补 armyType。
  function migrateLegacyTroop(t) {
    var o = clone(t);
    if (!o || typeof o !== 'object') return { name: String(t == null ? '' : t) };
    if (o.description === undefined && o.desc !== undefined) o.description = o.desc;
    if (o.armyType === undefined && o.type !== undefined) {
      o.armyType = Object.prototype.hasOwnProperty.call(ARMY_TYPE_MAP, o.type) ? ARMY_TYPE_MAP[o.type] : o.type;
    }
    return o;
  }

  // organization → militarySystem：深克隆。militarySystem 表单 type 是自由文本，值域无需映射。
  function migrateLegacySystem(o) {
    var out = clone(o);
    if (!out || typeof out !== 'object') return { name: String(o == null ? '' : o) };
    if (out.description === undefined && out.desc !== undefined) out.description = out.desc;
    return out;
  }

  // 军务面板运行时渲染器只读 initialTroops / militarySystem。旧剧本/旧 AI 生成把内容落进
  // troops / organization，导致面板显示为空。此处在数据入口层做一次性基线迁移（会话前的
  // schema 变换·与本文件 events/variables/relations 各节同范式，无需 EditHistory）。
  // 守卫：_legacyMigratedV1 标记 + 目标新字段为空双守卫（官方剧本新字段已有数据→零触发）。
  // 非破坏：保留旧桶原样（troops/organization/facilities/campaigns 均不删）——runtime 的
  //   游戏内军务 UI（tm-military-ui.js）仍读 P.military.troops/organization，且官方剧本本就
  //   新旧字段并存；删键会让迁移后的剧本与官方结构不一致、并可能回归游戏内军务显示。深克隆隔离嵌套引用。
  // 复活环封堵：标记「仅在确有迁移时」落且随导出持久化（exportScenario 不剥离）——玩家删光
  //   initialTroops 后导出再导入，标记在→migrateMilitary 早退→不重迁→已删内容不复活。
  //   官方剧本无迁移→不落标记→export(import(raw)).military 与原 military byte 等价。
  function needsMilitaryMigration(sd) {
    var mil = sd && sd.military;
    if (!mil || typeof mil !== 'object' || mil._legacyMigratedV1) return false;
    var troopsPending = (!Array.isArray(mil.initialTroops) || mil.initialTroops.length === 0) &&
      Array.isArray(mil.troops) && mil.troops.length > 0;
    var orgPending = (!Array.isArray(mil.militarySystem) || mil.militarySystem.length === 0) &&
      Array.isArray(mil.organization) && mil.organization.length > 0;
    return troopsPending || orgPending;
  }

  function migrateMilitary(sd, warnings) {
    var mil = sd && sd.military;
    if (!mil || typeof mil !== 'object' || mil._legacyMigratedV1) return;
    var migrated = false;
    if ((!Array.isArray(mil.initialTroops) || mil.initialTroops.length === 0) &&
        Array.isArray(mil.troops) && mil.troops.length) {
      mil.initialTroops = mil.troops.map(migrateLegacyTroop);
      migrated = true;
      if (warnings) warnings.push('military: 旧 troops(' + mil.troops.length + ') 迁入 initialTroops');
    }
    if ((!Array.isArray(mil.militarySystem) || mil.militarySystem.length === 0) &&
        Array.isArray(mil.organization) && mil.organization.length) {
      mil.militarySystem = mil.organization.map(migrateLegacySystem);
      migrated = true;
      if (warnings) warnings.push('military: 旧 organization(' + mil.organization.length + ') 迁入 militarySystem');
    }
    if (migrated) mil._legacyMigratedV1 = true; // 仅确有迁移时落·官方剧本不落→byte 等价
  }

  function classifyVariable(v) {
    // 显式·剧本作者标 v.kind / v.category·强制归类·跳过启发式
    if (v.kind === 'base' || v.category === 'base') {
      return { kind: 'base', confidence: 1, reason: 'explicit kind/category' };
    }
    if (v.kind === 'other' || v.category === 'other') {
      return { kind: 'other', confidence: 1, reason: 'explicit kind/category' };
    }
    if (v.kind === 'formulas' || v.category === 'formulas') {
      return { kind: 'formulas', confidence: 1, reason: 'explicit kind/category' };
    }
    if (v.formula || v.expr || v.calc) {
      return { kind: 'formulas', confidence: 1, reason: 'has formula/expr/calc' };
    }
    var id = (v.id || '').toLowerCase();
    for (var i = 0; i < VAR_BASE_KEYWORDS.length; i++) {
      if (id.indexOf(VAR_BASE_KEYWORDS[i]) >= 0) {
        return { kind: 'base', confidence: 0.9, reason: 'id matched base keyword "' + VAR_BASE_KEYWORDS[i] + '"' };
      }
    }
    if (id.indexOf('_jin_') >= 0 || id.indexOf('_song_') >= 0 ||
        id.indexOf('_jianyan') >= 0 || id.indexOf('_shaosong') >= 0 ||
        id.indexOf('_tang_') >= 0 || id.indexOf('_ming_') >= 0 ||
        id.indexOf('_qing_') >= 0 || id.indexOf('_han_') >= 0) {
      return { kind: 'other', confidence: 0.85, reason: 'era-specific id prefix' };
    }
    return { kind: 'other', confidence: 0.5, reason: 'fallback default (no clear signal)' };
  }

  function renameNpcRelation(rel, dir) {
    var out = clone(rel);
    if (dir === 'import') {
      if (out.from !== undefined && out.charA === undefined) { out.charA = out.from; delete out.from; }
      if (out.to !== undefined && out.charB === undefined) { out.charB = out.to; delete out.to; }
    } else {
      if (out.charA !== undefined && out.from === undefined) { out.from = out.charA; delete out.charA; }
      if (out.charB !== undefined && out.to === undefined) { out.to = out.charB; delete out.charB; }
    }
    return out;
  }

  function renameFactionRelation(rel, dir) {
    var out = clone(rel);
    if (dir === 'import') {
      if (out.from !== undefined && out.facA === undefined) { out.facA = out.from; delete out.from; }
      if (out.to !== undefined && out.facB === undefined) { out.facB = out.to; delete out.to; }
    } else {
      if (out.facA !== undefined && out.from === undefined) { out.from = out.facA; delete out.facA; }
      if (out.facB !== undefined && out.to === undefined) { out.to = out.facB; delete out.facB; }
    }
    return out;
  }

  function adaptCharAlias(c, dir) {
    if (!c || typeof c !== 'object') return c;
    var out = c;
    if (dir === 'import') {
      // birthYear → birthTime alias·两者都保留·editor UI 用 birthTime·1.6 原 birthYear 不动
      if (out.birthYear !== undefined && out.birthTime === undefined) {
        out.birthTime = String(out.birthYear);
      }
    } else {
      // export·若 birthYear 已有·删 birthTime (alias·非持久化)
      if (out.birthTime !== undefined) {
        var y = parseInt(out.birthTime, 10);
        if (!isNaN(y)) out.birthYear = y;
        delete out.birthTime;
      }
    }
    return out;
  }

  function importScenario(raw, options) {
    options = options || {};
    var warnings = [];
    var sd = clone(raw);

    if (Array.isArray(sd.events)) {
      var bucket = { historical: [], random: [], conditional: [], story: [], chain: [] };
      sd.events.forEach(function(evt) {
        var t = evt.type || 'historical';
        var b = classifyEventBucket(t);
        bucket[b].push(evt);
        if (!EVENT_TYPE_MAP[t]) {
          warnings.push('event ' + (evt.id || evt.name || '?') + ': unknown type "' + t + '" → bucket "' + b + '"');
        }
      });
      sd.events = bucket;
      sd._eventsWasArray = true;
    }

    if (Array.isArray(sd.variables)) {
      var vbucket = { base: [], other: [], formulas: [] };
      sd.variables.forEach(function(v) {
        var c = classifyVariable(v);
        vbucket[c.kind].push(v);
        if (c.confidence < 0.7) {
          warnings.push('variable ' + (v.id || v.name || '?') + ': classified as "' + c.kind + '" (' + c.reason + ')');
        }
      });
      sd.variables = vbucket;
      sd._variablesWasArray = true;
    }

    var npcRels = (Array.isArray(sd.relations) ? sd.relations : []).map(function(r) {
      return renameNpcRelation(r, 'import');
    });
    var facRels = (Array.isArray(sd.factionRelations) ? sd.factionRelations : []).map(function(r) {
      return renameFactionRelation(r, 'import');
    });
    if (npcRels.length || facRels.length) {
      sd.presetRelations = sd.presetRelations || { npc: [], faction: [] };
      if (npcRels.length) sd.presetRelations.npc = npcRels;
      if (facRels.length) sd.presetRelations.faction = facRels;
      delete sd.relations;
      delete sd.factionRelations;
    }

    if (Array.isArray(sd.characters)) {
      sd.characters = sd.characters.map(function(c) { return adaptCharAlias(c, 'import'); });
    }

    migrateMilitary(sd, warnings);

    return { scriptData: sd, warnings: warnings };
  }

  function exportScenario(sd, options) {
    options = options || {};
    var sc = clone(sd);

    // events·若已是 object 5 类·保持·若 array·按 classifyEventBucket 分
    if (Array.isArray(sc.events)) {
      var bucket = { historical: [], random: [], conditional: [], story: [], chain: [] };
      sc.events.forEach(function(evt) {
        var b = classifyEventBucket(evt.type || 'historical');
        bucket[b].push(evt);
      });
      sc.events = bucket;
    }

    if (Array.isArray(sc.variables)) {
      var vbucket = { base: [], other: [], formulas: [] };
      sc.variables.forEach(function(v) {
        var c = classifyVariable(v);
        vbucket[c.kind].push(v);
      });
      sc.variables = vbucket;
    }

    if (sc.presetRelations) {
      if (Array.isArray(sc.presetRelations.npc) && sc.presetRelations.npc.length) {
        sc.relations = sc.presetRelations.npc.map(function(r) { return renameNpcRelation(r, 'export'); });
      }
      if (Array.isArray(sc.presetRelations.faction) && sc.presetRelations.faction.length) {
        sc.factionRelations = sc.presetRelations.faction.map(function(r) { return renameFactionRelation(r, 'export'); });
      }
    }

    delete sc.presetRelations;
    delete sc._eventsWasArray;
    delete sc._variablesWasArray;
    // 注意：military._legacyMigratedV1 故意「不剥离」随导出持久化——它是断「删光→导出→导入
    // 复活环」的关键（见 migrateMilitary 注释）。仅在确有迁移时才存在，官方剧本无此键。

    if (Array.isArray(sc.characters)) {
      sc.characters = sc.characters.map(function(c) { return adaptCharAlias(c, 'export'); });
    }

    return sc;
  }

  function deepDiff(a, b, base, out) {
    out = out || [];
    base = base || '$';
    if (a === b) return out;
    if (typeof a !== typeof b) {
      out.push(base + ': type ' + typeof a + ' vs ' + typeof b);
      return out;
    }
    if (a === null || b === null) {
      if (a !== b) out.push(base + ': ' + a + ' vs ' + b);
      return out;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) {
        out.push(base + ': array shape mismatch');
        return out;
      }
      if (a.length !== b.length) out.push(base + '.length: ' + a.length + ' vs ' + b.length);
      var len = Math.max(a.length, b.length);
      for (var i = 0; i < len; i++) {
        if (i >= a.length) out.push(base + '[' + i + ']: extra in b');
        else if (i >= b.length) out.push(base + '[' + i + ']: missing in b');
        else deepDiff(a[i], b[i], base + '[' + i + ']', out);
      }
      return out;
    }
    if (typeof a === 'object') {
      var keys = {};
      Object.keys(a).forEach(function(k) { keys[k] = true; });
      Object.keys(b).forEach(function(k) { keys[k] = true; });
      Object.keys(keys).forEach(function(k) {
        if (!(k in a)) out.push(base + '.' + k + ': extra in b');
        else if (!(k in b)) out.push(base + '.' + k + ': missing in b');
        else deepDiff(a[k], b[k], base + '.' + k, out);
      });
      return out;
    }
    out.push(base + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
    return out;
  }

  // 二次 export 稳定性·import → export → import → export·两 export 应 0 diff
  function roundtripCheck(raw) {
    var imp1 = importScenario(raw);
    var exp1 = exportScenario(imp1.scriptData);
    var imp2 = importScenario(exp1);
    var exp2 = exportScenario(imp2.scriptData);
    var stableDiffs = deepDiff(exp1, exp2);
    var migrationDiffs = deepDiff(raw, exp1);
    return {
      ok: stableDiffs.length === 0,
      stableDiffs: stableDiffs,
      migrationDiffs: migrationDiffs,
      warnings: imp1.warnings.concat(imp2.warnings)
    };
  }

  global.SchemaAdapter = {
    importScenario: importScenario,
    exportScenario: exportScenario,
    roundtripCheck: roundtripCheck,
    deepDiff: deepDiff,
    classifyVariable: classifyVariable,
    classifyEventBucket: classifyEventBucket,
    migrateMilitary: migrateMilitary,
    needsMilitaryMigration: needsMilitaryMigration,
    ARMY_TYPE_MAP: ARMY_TYPE_MAP,
    ARMY_TYPE_ENUMS: ARMY_TYPE_ENUMS,
    EVENT_BUCKETS: EVENT_BUCKETS,
    EVENT_TYPE_MAP: EVENT_TYPE_MAP
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SchemaAdapter;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
