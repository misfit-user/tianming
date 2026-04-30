// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-ai-output-validator.js — AI 推演输出校验器
 *
 * 目的：在 AI 返回 p1 JSON 后，检查字段形状与废弃字段使用。
 *       非阻断——只打 console.warn 并记录到 window.TM._lastValidation。
 *       不修改任何业务逻辑，仅提供可观测性。
 *
 * 调用：extractJSON 得到 p1 之后，TM.validateAIOutput(p1, 'subcall1')
 * 关闭：window.TM_VALIDATOR_OFF = true
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};

  // 优先从 TM_AI_SCHEMA 读取字段列表（单一真源），fallback 用内置副本
  function _loadFromSchema(mode) {
    if (!window.TM_AI_SCHEMA) return null;
    try {
      return {
        KNOWN: TM_AI_SCHEMA.toKnownFields(mode),
        DEPRECATED: TM_AI_SCHEMA.toDeprecatedFields(),
        REQUIRED: TM_AI_SCHEMA.toRequiredSubfields()
      };
    } catch(e) { console.warn('[ai-validator] schema load failed, use fallback', e); return null; }
  }

  // ─── 内置 fallback（Schema 未加载时兜底） ───
  var KNOWN_FIELDS_FALLBACK = {
    // 叙事类
    narrative: 'string', shilu_text: 'string', shizhengji: 'string',
    event: 'object',
    // 数值 delta
    era_state_delta: 'object', global_state_delta: 'object',
    // 数组字段
    character_deaths: 'array', new_characters: 'array',
    char_updates: 'array', relations: 'array',
    faction_changes: 'array', faction_events: 'array', faction_relation_changes: 'array', faction_updates: 'array',
    party_changes: 'array', party_updates: 'array',
    class_changes: 'array', class_updates: 'array',
    army_changes: 'array', item_changes: 'array',
    office_changes: 'array', office_assignments: 'array', office_spawn: 'array',
    personnel_changes: 'array',
    vassal_changes: 'array', title_changes: 'array', building_changes: 'array',
    admin_changes: 'array', admin_division_updates: 'array',
    harem_events: 'array', tech_civic_unlocks: 'array', policy_changes: 'array',
    scheme_actions: 'array', timeline_triggers: 'array',
    current_issues_update: 'array',
    // 生灭周期
    party_create: 'array', party_splinter: 'array', party_merge: 'array', party_dissolve: 'array',
    faction_create: 'array', faction_succession: 'array', faction_dissolve: 'array',
    class_emerge: 'array', class_revolt: 'array', class_dissolve: 'array',
    // 行动类
    npc_actions: 'array', npc_interactions: 'array',
    npc_letters: 'array', npc_correspondence: 'array', cultural_works: 'array',
    directive_compliance: 'array',
    fiscal_adjustments: 'array', region_updates: 'array', project_updates: 'array',
    edict_feedback: 'array', edict_lifecycle_update: 'array',
    route_disruptions: 'array', foreshadowing: 'array', map_changes: 'object',
    faction_interactions_advanced: 'array', npc_schemes: 'array',
    hidden_moves: 'array', fengwen_snippets: 'array', call_court_works: 'array',
    anyPathChanges: 'array', events: 'array', changes: 'array',
    appointments: 'array', institutions: 'array', regions: 'array', localActions: 'array',
    // 其他
    geoData: 'object', memorials: 'array', letters: 'array',
    bigyear: 'object', bigYearEvent: 'object'
  };

  // ─── 已废弃字段（fallback） ───
  var DEPRECATED_FIELDS_FALLBACK = {};

  // ─── 关键子字段必填检查（fallback） ───
  var REQUIRED_SUBFIELDS_FALLBACK = {
    character_deaths: ['name'],
    new_characters: ['name'],
    office_changes: ['action'],
    admin_division_updates: ['action'],
    harem_events: ['type'],
    current_issues_update: ['action'],
    party_changes: ['name'],
    class_changes: ['name'],
    faction_changes: ['name']
  };

  // ─── 实际使用的 map（每次 validate 时解析，保证 schema 热更生效） ───
  function getMaps(mode) {
    var fromSchema = _loadFromSchema(mode);
    if (fromSchema) {
      return { KNOWN: fromSchema.KNOWN, DEPRECATED: fromSchema.DEPRECATED, REQUIRED: fromSchema.REQUIRED };
    }
    return { KNOWN: KNOWN_FIELDS_FALLBACK, DEPRECATED: DEPRECATED_FIELDS_FALLBACK, REQUIRED: REQUIRED_SUBFIELDS_FALLBACK };
  }

  function _typeOf(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function validate(output, tag, mode) {
    tag = tag || 'unknown';
    mode = mode || 'turn-full';
    if (!output || typeof output !== 'object') {
      return { ok: false, tag: tag, mode: mode, errors: ['output 不是对象'], warnings: [] };
    }
    var maps = getMaps(mode);
    var KNOWN_FIELDS = maps.KNOWN;
    var DEPRECATED_FIELDS = maps.DEPRECATED;
    var REQUIRED_SUBFIELDS = maps.REQUIRED;
    var errors = [];
    var warnings = [];
    var stats = { knownKeys: 0, unknownKeys: 0, deprecatedKeys: 0, itemCount: 0 };

    // 对话模式特殊：reply 是核心，若缺失直接标 error
    if (mode === 'dialogue' && (output.reply === undefined || output.reply === null || output.reply === '')) {
      errors.push('[dialogue] 缺失 reply 字段（对话返回最关键字段）');
    }

    Object.keys(output).forEach(function(key) {
      // 下划线前缀的私有字段、以及 _raw 不检查
      if (key.charAt(0) === '_') return;

      // 废弃字段
      if (DEPRECATED_FIELDS[key]) {
        if (Array.isArray(output[key]) ? output[key].length > 0 : !!output[key]) {
          warnings.push('[deprecated] `' + key + '` 已废弃 → ' + DEPRECATED_FIELDS[key]);
          stats.deprecatedKeys++;
        }
        return;
      }

      var expected = KNOWN_FIELDS[key];
      if (!expected) {
        warnings.push('[unknown] 未识别顶层字段 `' + key + '`（AI 可能幻觉，或 schema 需扩展）');
        stats.unknownKeys++;
        return;
      }
      stats.knownKeys++;

      var actual = _typeOf(output[key]);
      if (expected === 'array' && actual !== 'array') {
        errors.push('[type] `' + key + '` 应为 array，实际为 ' + actual);
        return;
      }
      if (expected === 'object' && actual !== 'object') {
        errors.push('[type] `' + key + '` 应为 object，实际为 ' + actual);
        return;
      }
      if (expected === 'string' && actual !== 'string' && actual !== 'null') {
        warnings.push('[type] `' + key + '` 应为 string，实际为 ' + actual);
        return;
      }

      // 子字段检查
      if (expected === 'array' && REQUIRED_SUBFIELDS[key]) {
        var required = REQUIRED_SUBFIELDS[key];
        output[key].forEach(function(item, idx) {
          if (!item || typeof item !== 'object') {
            warnings.push('[shape] ' + key + '[' + idx + '] 不是对象');
            return;
          }
          required.forEach(function(sub) {
            if (item[sub] === undefined || item[sub] === null || item[sub] === '') {
              warnings.push('[missing] ' + key + '[' + idx + '].' + sub + ' 缺失');
            }
          });
          stats.itemCount++;
        });
      } else if (expected === 'array') {
        stats.itemCount += output[key].length;
      }
    });

    var result = {
      ok: errors.length === 0,
      tag: tag,
      mode: mode,
      timestamp: Date.now(),
      stats: stats,
      errors: errors,
      warnings: warnings
    };

    // 记录到全局以便玩家查询
    window.TM._lastValidation = result;
    if (!window.TM._validationHistory) window.TM._validationHistory = [];
    window.TM._validationHistory.push(result);
    if (window.TM._validationHistory.length > 20) window.TM._validationHistory.shift();

    // 输出日志
    if (errors.length > 0) {
      console.error('[ai-validator][' + tag + '] ' + errors.length + ' 错误，' + warnings.length + ' 警告');
      errors.forEach(function(e){ console.error('  ✗ ' + e); });
      warnings.forEach(function(w){ console.warn('  ⚠ ' + w); });
    } else if (warnings.length > 0) {
      console.warn('[ai-validator][' + tag + '] ' + warnings.length + ' 警告（' + stats.knownKeys + ' 已知字段，' + stats.itemCount + ' 条目）');
      warnings.forEach(function(w){ console.warn('  ⚠ ' + w); });
    } else {
      console.log('[ai-validator][' + tag + '] 通过（' + stats.knownKeys + ' 已知字段，' + stats.itemCount + ' 条目）');
    }
    return result;
  }

  function safeValidate(output, tag, mode) {
    if (window.TM_VALIDATOR_OFF) return null;
    try {
      return validate(output, tag, mode);
    } catch(e) {
      console.warn('[ai-validator] 自身异常，已跳过：', e);
      if (window.TM && TM.errors) TM.errors.capture(e, 'ai-validator', { tag: tag, mode: mode });
      return null;
    }
  }

  window.TM.validateAIOutput = safeValidate;
  window.TM.getLastValidation = function() { return window.TM._lastValidation; };
  window.TM.getValidationHistory = function() { return (window.TM._validationHistory||[]).slice(); };
})();
