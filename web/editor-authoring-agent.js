// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   剧本 authoring agent · S1 沙箱 + 工具层（暴露 TM.AuthoringAgent）
//   §1 draft 沙箱   makeDraft / applyEdit·Push / validateDraft（旁路 PathUtils 运行时副作用）
//   §2 provider     conversation → provider 消息抽象
//   §3 刀C gemini   gemini 原生 provider（第三方中转走 openai-compat 不受影响）
//   §4 刀A 规划     懂规格·知缺口
//   §5 Export       TM.AuthoringAgent 对外接口
// ─────────────────────────────────────────────
/**
 * editor-authoring-agent.js — 剧本 authoring agent · S1 沙箱 + 工具层
 *
 * 目标：给"玩家在编辑器里用自然语言驱动 AI 生成/编辑剧本"提供安全的工具底座。
 * 本文件只含 S1（无 LLM）：
 *   makeDraft      —— scope 沙箱：深拷贝 scriptData 作为 draft，agent 只拿到这一个对象
 *   applyEdit/Push —— 在 draft 上做结构化编辑，旁路 PathUtils 的运行时副作用（坑 B）
 *   validateDraft  —— 3 条 draft-scoped 不变量校验器（不读 global GM）
 *
 * 安全模型（见 memory: agent 权限按作用范围非类型）：
 *   - 结构边界：所有工具只接受传入的 draft 对象，PathUtils.resolvePath 只在 draft 内部
 *     导航，物理上够不到 window / GM / 文件系统。
 *   - draft 内完整性：applyEdit 带 blocklist；validateDraft 守数据一致性。
 *
 * 关键设计（坑 B）：PathUtils.applyPathSet 带三条 global.GM 副作用通道
 *   （_syncCoreVarSideEffects / _recordToTurnChanges / loyalty 拦截）。本模块**不调用**它，
 *   只用下面内联的纯函数 _resolvePath 做导航，赋值由本模块自己完成 —— 零运行时副作用。
 *   （editor.html 不加载 tm-ai-change-pathutils.js，故按 copy-pure-helper paradigm 内联一份 resolvePath。）
 *
 * 双环境：浏览器（editor）+ node（smoke 测试）均可加载。
 */
(function(global) {
  'use strict';
  // ═══ 巨石拆分(20260706)：Provider 簇(D·原992-1343)迁出 editor-authoring-agent-provider.js·须紧接【前】装载 ═══
  if (typeof require === 'function' && typeof module !== 'undefined') { try { require('./editor-authoring-agent-provider.js'); } catch (e) {} }
  var __aaP = ((global.TM = global.TM || {}).__aaParts = global.TM.__aaParts || {}),
      callWithTools = __aaP.callWithTools, testConnection = __aaP.testConnection,
      _delay = __aaP._delay, _fetchJSON = __aaP._fetchJSON, _OVERFLOW_RE = __aaP._OVERFLOW_RE,
      _parseOpenAI = __aaP._parseOpenAI, _parseAnthropic = __aaP._parseAnthropic, _parseGemini = __aaP._parseGemini,
      _toOpenAI = __aaP._toOpenAI, _toAnthropic = __aaP._toAnthropic, _toGemini = __aaP._toGemini;
  __aaP.loadEditorApiConfig = loadEditorApiConfig; // 反向发布(函数声明已提升)

  // 内联的纯路径解析器（复制自 tm-ai-change-pathutils.js 的 _resolvePath·纯函数·无副作用）
  // 支持 a.b、a[0]、以及在数组上按 name/id 取元素（如 chars.张三.loyalty）。
  // 安全边界：模型提供的路径永远不得穿过原型链；constructor/prototype/__proto__ 即使 force 也拒绝。
  var _UNSAFE_PATH_SEGMENTS = { '__proto__': 1, 'prototype': 1, 'constructor': 1 };
  function _hasOwn(obj, key) { return obj != null && Object.prototype.hasOwnProperty.call(obj, key); }
  function _hasUnsafePathSegment(path) {
    return String(path == null ? '' : path).split('.').some(function(raw) {
      var seg = String(raw).replace(/\[\d+\]$/, '').toLowerCase();
      return !!_UNSAFE_PATH_SEGMENTS[seg];
    });
  }
  function _resolvePath(obj, path) {
    if (!obj || !path || _hasUnsafePathSegment(path)) return { parent: null, key: null, exists: false, value: undefined };
    var keys = String(path).split('.');
    var parent = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      var m = k.match(/^(\w+)\[(\d+)\]$/);
      if (m) {
        if (!_hasOwn(parent, m[1]) || !parent[m[1]]) return { parent: null, key: null, exists: false, value: undefined };
        parent = parent[m[1]][Number(m[2])];
      } else if (Array.isArray(parent) && isNaN(Number(k))) {
        var nextParent = parent.find(function(it) { return it && ((_hasOwn(it, 'name') && it.name === k) || (_hasOwn(it, 'id') && it.id === k)); });
        if (!nextParent) return { parent: null, key: null, exists: false, value: undefined };
        parent = nextParent;
      } else if (Array.isArray(parent) && !isNaN(Number(k))) {
        if (!_hasOwn(parent, Number(k))) return { parent: null, key: null, exists: false, value: undefined };
        parent = parent[Number(k)];
      } else {
        if (!_hasOwn(parent, k) || parent[k] === undefined || parent[k] === null) return { parent: null, key: null, exists: false, value: undefined };
        parent = parent[k];
      }
      if (parent === undefined || parent === null) return { parent: null, key: null, exists: false, value: undefined };
    }
    var lastKey = keys[keys.length - 1];
    var lastIndexed = lastKey.match(/^(\w+)\[(\d+)\]$/);
    if (lastIndexed) {
      if (!_hasOwn(parent, lastIndexed[1]) || !Array.isArray(parent[lastIndexed[1]])) return { parent: null, key: null, exists: false, value: undefined };
      var lastArray = parent[lastIndexed[1]], lastIndex = Number(lastIndexed[2]);
      return { parent: lastArray, key: lastIndex, exists: _hasOwn(lastArray, lastIndex), value: lastArray[lastIndex] };
    }
    if (Array.isArray(parent) && isNaN(Number(lastKey))) {
      var target = parent.find(function(it) { return it && ((_hasOwn(it, 'name') && it.name === lastKey) || (_hasOwn(it, 'id') && it.id === lastKey)); });
      if (target !== undefined) {
        return { parent: parent, key: parent.indexOf(target), exists: true, value: target };
      }
    }
    var resolvedKey = (Array.isArray(parent) && !isNaN(Number(lastKey))) ? Number(lastKey) : lastKey;
    return { parent: parent, key: resolvedKey, exists: _hasOwn(parent, resolvedKey), value: _hasOwn(parent, resolvedKey) ? parent[resolvedKey] : undefined };
  }

  function _agentClone(x) {
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; }
  }
  function _replaceObjectContents(target, source) {
    if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return false;
    Object.keys(target).forEach(function(k) { delete target[k]; });
    Object.keys(source).forEach(function(k) { target[k] = source[k]; });
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  scope 沙箱
  // ═══════════════════════════════════════════════════════════════════

  /** 深拷贝 scriptData（或传入对象）作为 draft。与 editor 持久化的 _cloneForPersistence 同法。 */
  function makeDraft(source) {
    var src = source || global.scriptData || {};
    return JSON.parse(JSON.stringify(src));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  draft 内编辑保护（within-draft blocklist，非安全边界——边界是 draft 本身）
  // ═══════════════════════════════════════════════════════════════════
  //  agent 不应改的字段：剧本唯一 ID、下划线内部字段、API/AI 配置、通用 conf、meta
  var BLOCKED = [
    /^id$/,              // 剧本唯一 ID
    /(^|\.)_/,           // 任意下划线开头的段（内部态）
    /(^|\.)ai(\.|$)/i,   // API / AI 配置
    /(^|\.)conf(\.|$)/i, // 通用配置
    /(^|\.)meta(\.|$)/i  // 元信息
  ];

  function isBlocked(path) {
    if (!path) return true;
    var p = String(path);
    return _hasUnsafePathSegment(p) || BLOCKED.some(function(re) { return re.test(p); });
  }

  /**
   * parse-or-reject 归一（写工具入参 value 用·2026-08-10 堵双编码洞）。
   *   LLM 偶把实体 JSON 双编码成字符串（甚至套 ```json 围栏）传给写工具，原样落进
   *   classes/families 等数组集合会污染剧本数据、下游写回链崩。
   *   字符串→容错剥围栏后 JSON.parse：出对象/数组→{ok:true,value}；
   *   无法解析/解析出标量→{ok:false}，由调用方返回工具错误喂回模型，下轮改传结构化 JSON 自纠。
   *   非字符串原样放行（{ok:true,value} 原引用）。
   */
  function _coerceEntityValue(value) {
    if (typeof value !== 'string') return { ok: true, value: value };
    var s = value.trim();
    var m = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (m) s = m[1].trim();
    try {
      var p = JSON.parse(s);
      if (p && typeof p === 'object') return { ok: true, value: p };
    } catch (e) {}
    return { ok: false };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  applyEdit / applyPush —— 旁路 PathUtils 副作用
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 在 draft 上按 path 设值。只用 PathUtils.resolvePath 纯导航 + 自己赋值，
   * 不触发任何 global.GM 副作用 / loyalty 拦截 / turnChanges 记录。
   * @returns {{ok:boolean, path?:string, old?:*, new?:*, created?:boolean, reason?:string}}
   */
  function applyEdit(draft, path, value, opts) {
    opts = opts || {};
    if (!draft || typeof draft !== 'object') return { ok: false, reason: 'no draft' };
    if (!path) return { ok: false, reason: 'empty path' };
    if (_hasUnsafePathSegment(path)) return { ok: false, reason: 'unsafe path: ' + path };
    if (!opts.force && isBlocked(path)) return { ok: false, reason: 'blocked path: ' + path };

    // 顶层数组集合被整个设成非数组（agent 偶把 relations/events 这类整集合设成对象/单条）→ 转数组，
    //   否则应用/校验/渲染处的 forEach 会炸（applyPush 早有此保护，applyEdit 之前缺）。
    var _ARR_COLLS = { characters: 1, factions: 1, parties: 1, classes: 1, items: 1, events: 1, families: 1, relations: 1, factionRelations: 1, rigidHistoryEvents: 1, timeline: 1, openingLetters: 1, goals: 1 };
    // 整集合被设成字符串：多为 LLM 双编码的实体 JSON → parse-or-reject；出对象/数组交下方既有归一，
    //   无法解析→工具错误喂回模型下轮自纠（此前 else 分支把字符串原样包成数组元素·静默落坏数据）
    if (_ARR_COLLS[String(path)] && typeof value === 'string') {
      var _cv = _coerceEntityValue(value);
      if (!_cv.ok) return { ok: false, reason: '集合 ' + path + ' 的值须为对象或数组，收到无法解析的字符串；请直接传结构化 JSON（对象/数组），不要把 JSON 字符串化后再传' };
      value = _cv.value;
    }
    if (_ARR_COLLS[String(path)] && value != null && !Array.isArray(value)) {
      if (typeof value === 'object') {
        var _ks = Object.keys(value);
        // 数字键对象 {0:..,1:..}（JSON 化的伪数组）→ 还原数组；命名对象（单条实体漏包数组）→ 包成 [实体]
        value = (_ks.length && _ks.every(function (k) { return /^\d+$/.test(k); })) ? _ks.map(function (k) { return value[k]; }) : [value];
      } else { value = [value]; }
    }

    var r = _resolvePath(draft, path);
    if (!r.parent) {
      // 创建缺失路径（仅纯对象路径；数组按名创建不支持）
      var keys = String(path).split('.');
      var cur = draft;
      for (var i = 0; i < keys.length - 1; i++) {
        var k = keys[i];
        if (/[\[\]]/.test(k)) return { ok: false, reason: '无法创建数组索引路径: ' + path };
        if (!_hasOwn(cur, k) || cur[k] === undefined || cur[k] === null) cur[k] = {};
        if (!cur[k] || typeof cur[k] !== 'object') return { ok: false, reason: '路径中间段不是对象: ' + k };
        cur = cur[k];
      }
      var last = keys[keys.length - 1];
      var oldCreated = cur[last];
      cur[last] = value;
      return { ok: true, path: path, old: oldCreated, new: value, created: true };
    }
    var old = r.exists ? r.value : undefined;
    r.parent[r.key] = value;
    return { ok: true, path: path, old: old, new: value };
  }

  /** 在 draft 上按 path 向数组追加元素（同样旁路副作用）。 */
  function applyPush(draft, path, value, opts) {
    opts = opts || {};
    if (!draft || typeof draft !== 'object') return { ok: false, reason: 'no draft' };
    if (!path) return { ok: false, reason: 'empty path' };
    if (_hasUnsafePathSegment(path)) return { ok: false, reason: 'unsafe path: ' + path };
    if (!opts.force && isBlocked(path)) return { ok: false, reason: 'blocked path: ' + path };

    // value 的 schema 本就是 object：字符串入参多为 LLM 双编码的实体 JSON → parse-or-reject（同 applyEdit），
    //   无法解析→工具错误喂回模型下轮自纠（此前原样 push 成字符串元素·污染集合）
    if (typeof value === 'string') {
      var _cv = _coerceEntityValue(value);
      if (!_cv.ok) return { ok: false, reason: 'push 到 ' + path + ' 的值须为对象或数组，收到无法解析的字符串；请直接传结构化 JSON（对象/数组），不要把 JSON 字符串化后再传' };
      value = _cv.value;
    }
    var _vals = Array.isArray(value) ? value : [value];   // 出数组→逐条入列（LLM 常把整批塞进一个值·不当单元素嵌套）

    var r = _resolvePath(draft, path);
    if (!r.parent) {
      var keys = String(path).split('.');
      var cur = draft;
      for (var i = 0; i < keys.length - 1; i++) {
        if (!_hasOwn(cur, keys[i]) || cur[keys[i]] === undefined || cur[keys[i]] === null) cur[keys[i]] = {};
        if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') return { ok: false, reason: '路径中间段不是对象: ' + keys[i] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = _vals.slice();
      return { ok: true, path: path, pushed: value, pushedCount: _vals.length, created: true };
    }
    if (!Array.isArray(r.parent[r.key])) r.parent[r.key] = [];
    for (var _pi = 0; _pi < _vals.length; _pi++) r.parent[r.key].push(_vals[_pi]);
    return { ok: true, path: path, pushed: value, pushedCount: _vals.length };
  }

  /** 删除 draft 某路径的元素（数组按索引 splice·对象 delete）。同样旁路副作用。 */
  function applyRemove(draft, path, opts) {
    opts = opts || {};
    if (!draft || typeof draft !== 'object') return { ok: false, reason: 'no draft' };
    if (!path) return { ok: false, reason: 'empty path' };
    if (_hasUnsafePathSegment(path)) return { ok: false, reason: 'unsafe path: ' + path };
    if (!opts.force && isBlocked(path)) return { ok: false, reason: 'blocked path: ' + path };
    var r = _resolvePath(draft, path);
    if (!r.parent) return { ok: false, reason: 'path not found: ' + path };
    if (Array.isArray(r.parent) && typeof r.key === 'number') {
      var removed = r.parent.splice(r.key, 1);
      return { ok: true, path: path, removed: removed[0] };
    }
    var old = r.parent[r.key];
    if (old === undefined) return { ok: false, reason: 'path not found: ' + path };
    delete r.parent[r.key];
    return { ok: true, path: path, removed: old };
  }

  /** 在 draft 某数组集合里按关键词查实体（读工具·让 agent 不盲改）。 */
  function _searchEntities(draft, collection, query) {
    var arr = draft && draft[collection];
    // 虚拟集合：地图地块不在顶层数组，映射到 map.regions（mapData.regions 为镜像）
    if (!Array.isArray(arr) && (collection === 'regions' || collection === '省' || collection === '地块')) {
      var _m = (draft && draft.map) || (draft && draft.mapData) || {};
      if (Array.isArray(_m.regions)) { arr = _m.regions; collection = 'map.regions'; }
    }
    if (!Array.isArray(arr)) return { ok: false, reason: collection + ' 不是数组或不存在' };
    var q = String(query == null ? '' : query).trim();
    var matches = [];
    arr.forEach(function(it, i) {
      if (!it || typeof it !== 'object') return;
      var hay = [it.name, it.faction, it.id, it.title, it.leader, it.adminBinding].filter(Boolean).join(' ');
      if (!q || hay.indexOf(q) >= 0) matches.push({ index: i, name: it.name, faction: it.faction, fields: Object.keys(it).slice(0, 8) });
    });
    return { ok: true, collection: collection, count: matches.length, matches: matches.slice(0, 40) };
  }

  // 方向C · 全局检索：深 walk 整棵 draft 找任意字符串命中（真·全剧本 grep·含 map.regions/adminHierarchy 等嵌套结构）
  function _globalSearch(draft, query, opts) {
    opts = opts || {};
    var q = String(query == null ? '' : query).trim().toLowerCase();
    if (!q) return { ok: false, reason: '需要 query' };
    var limit = Math.min(60, Number(opts.limit) || 30);
    var labelKeys = ['name', 'id', 'title', 'leader', 'faction', 'adminBinding'];
    var hits = [], capped = false;
    function labelOf(node) {
      for (var li = 0; li < labelKeys.length; li++) { if (node[labelKeys[li]]) return String(node[labelKeys[li]]); }
      return '';
    }
    function walk(node, path, ownerLabel) {
      if (capped) return;
      if (hits.length >= limit) { capped = true; return; }
      if (node == null) return;
      if (typeof node === 'string') {
        if (node.toLowerCase().indexOf(q) >= 0) hits.push({ path: path, label: ownerLabel || '', snippet: node.slice(0, 60) });
        return;
      }
      if (typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length && !capped; i++) walk(node[i], path + '[' + i + ']', ownerLabel);
        return;
      }
      var lbl = labelOf(node) || ownerLabel;
      var keys = Object.keys(node);
      for (var k = 0; k < keys.length && !capped; k++) {
        var ck = keys[k], cv = node[ck], p = path ? path + '.' + ck : ck;
        // 键控映射（adminHierarchy / map.factions 等）的条目键往往就是实体名/id——容器键命中也算；
        // 但只认「值是对象/数组」的键，叶子字段名（name/type…）不算，避免搜「name」炸噪声。
        if (cv && typeof cv === 'object' && ck.toLowerCase().indexOf(q) >= 0) {
          if (hits.length >= limit) { capped = true; break; }
          hits.push({ path: p, label: ck, snippet: '(键) ' + ck });
        }
        walk(cv, p, lbl);
      }
    }
    walk(draft, '', '');
    return { ok: true, query: query, total: hits.length, hits: hits, truncated: capped };
  }

  // 方向C · 引用感知：深walk 整个剧本，找出所有引用某实体名的位置（改名/删除前查死链）
  // 方向W · 实体捆绑：把一个势力 + 它的人物 + 相关关系打成可跨剧本复用的包（纯函数·确定性）。
  function buildEntityBundle(scenario, factionName) {
    var sc = scenario || {};
    var fname = String(factionName || '').trim();
    if (!fname) return null;
    var faction = (sc.factions || []).filter(function(f) { return f && f.name === fname; })[0] || null;
    var characters = (sc.characters || []).filter(function(c) { return c && c.faction === fname; });
    var charNames = {}; characters.forEach(function(c) { if (c && c.name) charNames[c.name] = true; });
    var relations = (sc.relations || []).filter(function(r) {
      if (!r) return false;
      return (r.from && charNames[r.from]) || (r.to && charNames[r.to]) || (r.a && charNames[r.a]) || (r.b && charNames[r.b]);
    });
    return { type: 'tm-entity-bundle', version: 1, faction: fname, factionData: faction ? _agentClone(faction) : null, characters: _agentClone(characters), relations: _agentClone(relations) };
  }
  // 把捆绑包合并进目标剧本（返回新剧本·势力去重·人物重名自动改名·关系按改名重映射）。
  function mergeEntityBundle(targetScenario, bundle) {
    var sc = _agentClone(targetScenario || {});
    if (!bundle || bundle.type !== 'tm-entity-bundle') return { scenario: sc, added: { factions: 0, characters: 0, relations: 0 }, error: '不是有效的实体捆绑包' };
    sc.factions = sc.factions || []; sc.characters = sc.characters || []; sc.relations = sc.relations || [];
    var added = { factions: 0, characters: 0, relations: 0 }, rename = {};
    if (bundle.factionData && bundle.factionData.name) {
      if (!sc.factions.some(function(f) { return f && f.name === bundle.factionData.name; })) { sc.factions.push(_agentClone(bundle.factionData)); added.factions++; }
    }
    var existing = {}; sc.characters.forEach(function(c) { if (c && c.name) existing[c.name] = true; });
    (bundle.characters || []).forEach(function(c) {
      if (!c || !c.name) return;
      var nc = _agentClone(c), name = nc.name;
      if (existing[name]) { var n = 2; while (existing[name + '（' + n + '）']) n++; nc.name = name + '（' + n + '）'; rename[name] = nc.name; }
      existing[nc.name] = true; sc.characters.push(nc); added.characters++;
    });
    (bundle.relations || []).forEach(function(r) {
      if (!r) return;
      var nr = _agentClone(r);
      ['from', 'to', 'a', 'b'].forEach(function(k) { if (nr[k] && rename[nr[k]]) nr[k] = rename[nr[k]]; });
      sc.relations.push(nr); added.relations++;
    });
    return { scenario: sc, added: added, renamed: rename };
  }

  function _findReferences(draft, name, opts) {
    opts = opts || {};
    var target = String(name == null ? '' : name).trim();
    if (!target) return { ok: false, reason: '需要 name' };
    var limit = Math.min(120, Number(opts.limit) || 60);
    var exact = [], mentions = [];
    function walk(node, path) {
      if (exact.length + mentions.length >= limit) return;
      if (node == null) return;
      if (typeof node === 'string') {
        if (node === target) exact.push(path);
        else if (node.indexOf(target) >= 0) mentions.push({ path: path, snippet: node.slice(0, 50) });
        return;
      }
      if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) walk(node[i], path + '[' + i + ']'); return; }
      if (typeof node === 'object') { Object.keys(node).forEach(function(kk) { walk(node[kk], path ? path + '.' + kk : kk); }); }
    }
    walk(draft, '');
    return { ok: true, name: target, exactCount: exact.length, mentionCount: mentions.length, exact: exact.slice(0, 40), mentions: mentions.slice(0, 20), truncated: (exact.length + mentions.length) >= limit };
  }

  // 方向C · 引用感知改名：把整个剧本里所有「精确等于 oldName」的字符串值改为 newName（含实体自身的 name + 一切引用）。
  // 只动精确等值（"明"不会误伤"明朝"），安全联动。
  function _renameEntity(draft, oldName, newName) {
    var from = String(oldName == null ? '' : oldName), to = String(newName == null ? '' : newName);
    if (!from || !to) return { ok: false, reason: '需要 oldName 和 newName' };
    if (from === to) return { ok: false, reason: 'oldName 与 newName 相同' };
    var changed = 0, samplePaths = [];
    function walk(node, path) {
      if (node == null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          if (node[i] === from) { node[i] = to; changed++; if (samplePaths.length < 30) samplePaths.push(path + '[' + i + ']'); }
          else walk(node[i], path + '[' + i + ']');
        }
        return;
      }
      Object.keys(node).forEach(function(k) {
        var p = path ? path + '.' + k : k;
        if (node[k] === from) { node[k] = to; changed++; if (samplePaths.length < 30) samplePaths.push(p); }
        else walk(node[k], p);
      });
    }
    walk(draft, '');
    return { ok: changed > 0, oldName: from, newName: to, changed: changed, samplePaths: samplePaths, note: changed ? ('已把 ' + changed + ' 处精确等于「' + from + '」的值改为「' + to + '」（含引用联动）') : ('没找到精确等于「' + from + '」的值') };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  校验器（draft-scoped 纯函数·返回 {ok, violations, details}）
  //  约定与 tm-invariants.js 对齐，但接收 draft 参数、不读 global GM。
  // ═══════════════════════════════════════════════════════════════════

  // 区划人口读取器（字段在不同剧本可能略有出入·单点防御）
  // TODO(确认): 对真实剧本(绍宋/天启)确认末级区划是否带 population.mouths
  function _getPop(node) {
    if (!node) return null;
    var p = node.population;
    if (p && typeof p === 'object' && typeof p.mouths === 'number') return p.mouths;
    if (typeof p === 'number') return p;
    if (typeof node.mouths === 'number') return node.mouths;
    if (typeof node.pop === 'number') return node.pop;
    return null; // 未知人口·跳过比较·不误报
  }

  /** ① 行政区划：父级人口 >= 子级人口之和（adminHierarchy 树·递归 .divisions） */
  function vAdminPopulation(draft) {
    var v = [];
    var h = draft && draft.adminHierarchy;
    if (!h || typeof h !== 'object' || Array.isArray(h)) {
      return { ok: true, violations: [], details: { skipped: '无 adminHierarchy' } };
    }
    var comparisons = 0;
    Object.keys(h).forEach(function(fac) {
      var root = h[fac];
      var divs = root && root.divisions;
      if (!Array.isArray(divs)) return;
      (function walk(nodes) {
        nodes.forEach(function(n) {
          if (!n) return;
          var kids = Array.isArray(n.divisions) ? n.divisions : [];
          if (kids.length) {
            var parentPop = _getPop(n);
            var sum = 0, allKnown = true;
            kids.forEach(function(k) {
              var kp = _getPop(k);
              if (kp == null) allKnown = false; else sum += kp;
            });
            if (parentPop != null && allKnown) {
              comparisons++;
              if (parentPop < sum) {
                v.push('[' + fac + '] ' + (n.name || '?') + ' 人口 ' + parentPop + ' < 子级之和 ' + sum);
              }
            }
            walk(kids);
          }
        });
      })(divs);
    });
    return { ok: v.length === 0, violations: v, details: { comparisons: comparisons } };
  }

  /** ② 势力引用合法性：人物/军队/地点引用的势力必须在 factions 中存在 */
  function vFactionRefs(draft) {
    var v = [];
    var facs = (draft && draft.factions) || [];
    if (!Array.isArray(facs) || !facs.length) {
      return { ok: true, violations: [], details: { skipped: '无 factions' } };
    }
    var legal = {}, legalId = {};
    facs.forEach(function(f) { if (f && f.name) legal[f.name] = true; if (f && f.id) legalId[f.id] = true; });
    function check(ref, who) {
      if (ref == null || ref === '') return;
      if (!legal[ref]) v.push(who + ' 引用不存在的势力「' + ref + '」');
    }
    // 人物势力关联：优先认 factionId（稳定真相·势力改名/编辑器细化命名后人物不沦孤儿）·factionId 合法即放行；
    // 无 factionId 的人物回退查 faction 名串（兼容旧剧本）。国师 agent 生成/编辑人物时应同步维护 factionId（见 ensureCharFactionId）。
    (draft.characters || []).forEach(function(c) {
      if (!c) return;
      if (c.factionId != null && c.factionId !== '') {
        if (!legalId[c.factionId]) v.push('人物 ' + (c.name || '?') + ' 的 factionId「' + c.factionId + '」不在 factions');
      } else {
        check(c.faction, '人物 ' + (c.name || '?'));
      }
    });
    var troops = (draft.military && draft.military.initialTroops) || [];
    troops.forEach(function(t) {
      if (!t) return;
      var ref = (t.faction != null) ? t.faction : ((t.owner != null) ? t.owner : t.side);
      check(ref, '军队 ' + (t.name || '?'));
    });
    var mapItems = [];
    if (draft.map) {
      mapItems = [].concat(draft.map.city || [], draft.map.strategic || [], draft.map.geo || [], draft.map.items || []);
    }
    mapItems.forEach(function(m) {
      if (!m) return;
      check(m.owner, '地点 ' + (m.name || '?') + '(owner)');
      check(m.controller, '地点 ' + (m.name || '?') + '(controller)');
    });
    return { ok: v.length === 0, violations: v, details: { legalFactions: Object.keys(legal).length } };
  }

  /** ③ 区划↔地图覆盖：末级区划应在 mapData.regions 中有对应区域 */
  function vRegionCoverage(draft) {
    var v = [];
    var regions = draft && draft.mapData && draft.mapData.regions;
    var h = draft && draft.adminHierarchy;
    if (!Array.isArray(regions) || !regions.length) {
      return { ok: true, violations: [], details: { skipped: '无 mapData.regions' } };
    }
    if (!h || typeof h !== 'object' || Array.isArray(h)) {
      return { ok: true, violations: [], details: { skipped: '无 adminHierarchy' } };
    }
    var regionNames = {};
    regions.forEach(function(r) { if (r && r.name) regionNames[r.name] = true; });
    var orphans = [];
    Object.keys(h).forEach(function(fac) {
      var divs = h[fac] && h[fac].divisions;
      if (!Array.isArray(divs)) return;
      (function walk(nodes) {
        nodes.forEach(function(n) {
          if (!n) return;
          var kids = Array.isArray(n.divisions) ? n.divisions : [];
          if (!kids.length && n.name && !regionNames[n.name]) orphans.push(n.name);
          if (kids.length) walk(kids);
        });
      })(divs);
    });
    if (orphans.length) {
      v.push(orphans.length + ' 个末级区划在地图中无对应区域: '
        + orphans.slice(0, 8).join('、') + (orphans.length > 8 ? '…' : ''));
    }
    return { ok: v.length === 0, violations: v, details: { orphanLeaves: orphans.length } };
  }

  // 方向E · 真实运行时校验（把 tm-invariants 的运行时不变量按剧本 schema draft 化，agent 改完跑真体检并自修）
  /** ④ 角色完整性（对齐 tm-invariants 'chars'）：缺名/重名/死人占职 */
  function vRuntimeChars(draft) {
    var v = [];
    var chars = (draft && draft.characters) || [];
    if (!Array.isArray(chars) || !chars.length) return { ok: true, violations: [], details: { skipped: '无 characters' } };
    var noName = 0, seen = {}, dup = [], players = 0;
    chars.forEach(function(c) {
      if (!c) return;
      if (!c.name) { noName++; return; }
      if (seen[c.name]) dup.push(c.name); else seen[c.name] = true;
      if (c.isPlayer) players++;
    });
    // 注：officialTitle 是角色的描述性字段（可能记历史官职），不代表实际任职；"死人占职"由 runtime-office（holder 须在世）抓，此处不据 officialTitle 误报。
    if (noName) v.push(noName + ' 个角色缺 name（运行时会渲染异常）');
    if (dup.length) v.push('重名角色（运行时按名索引会冲突）: ' + dup.slice(0, 5).join('/') + (dup.length > 5 ? '…' : ''));
    return { ok: v.length === 0, violations: v, details: { total: chars.length, dup: dup.length, noName: noName, players: players } };
  }
  /** ⑤ 官制 holder 一致性（对齐 tm-invariants 'officeTree'）：holder 须为存在且在世的角色 */
  function vRuntimeOffice(draft) {
    var v = [];
    var tree = draft && draft.officeTree;
    if (!Array.isArray(tree) || !tree.length) return { ok: true, violations: [], details: { skipped: '无 officeTree' } };
    var charByName = {};
    (draft.characters || []).forEach(function(c) { if (c && c.name) charByName[c.name] = c; });
    var phantom = [], dead = [];
    (function walk(nodes) {
      (nodes || []).forEach(function(n) {
        if (!n) return;
        (n.positions || []).forEach(function(p) {
          if (p && p.holder && p.holder !== '空缺' && p.holder !== '') {
            var ch = charByName[p.holder];
            if (!ch) phantom.push(p.holder);
            else if (ch.alive === false) dead.push(p.holder);
          }
        });
        if (Array.isArray(n.subs)) walk(n.subs);
        if (Array.isArray(n.children)) walk(n.children);
      });
    })(tree);
    if (phantom.length) v.push(phantom.length + ' 个官职 holder 指向不存在的角色: ' + phantom.slice(0, 5).join('/') + (phantom.length > 5 ? '…' : ''));
    if (dead.length) v.push(dead.length + ' 个官职 holder 已故: ' + dead.slice(0, 5).join('/'));
    return { ok: v.length === 0, violations: v, details: { phantomHolders: phantom.length, deadHolders: dead.length } };
  }
  /** ⑥ 启动必备（运行时能否 boot）：名称/至少一势力一角色/有玩家角色 */
  function vRuntimeBoot(draft) {
    var v = [];
    if (!draft || typeof draft !== 'object') return { ok: false, violations: ['剧本为空'] };
    if (!draft.name) v.push('缺剧本名称 name（运行时标题/存档名依赖）');
    var facs = Array.isArray(draft.factions) ? draft.factions : [];
    var chars = Array.isArray(draft.characters) ? draft.characters : [];
    if (!facs.length) v.push('没有任何势力 factions（运行时无从加载势力面）');
    if (!chars.length) v.push('没有任何角色 characters');
    else if (!chars.some(function(c) { return c && c.isPlayer; })) v.push('没有标记 isPlayer 的玩家角色（运行时无主角入口）');
    return { ok: v.length === 0, violations: v, details: { factions: facs.length, characters: chars.length } };
  }

  // ── 时点合规（平行时空·跨剧本）：人物 bio/记忆/履历 + 开局内容(书信/议题/奏疏/已发生事件) 不应出现晚于
  //    startYear 的纪年。剧本始于某时点·人物此刻不知未来(2026-06 绍宋整局教训：bio 通史式写到死后封谥)。
  //    避开未来触发的 rigidHistoryEvents(triggerTurn≥2·设计上描述将来·不扫)。
  function vTimelineCompliance(draft) {
    var v = [];
    if (!draft) return { ok: true, violations: [] };
    var startYear = parseInt(draft.startYear || (draft.engineConstants && draft.engineConstants.startYear) || 0, 10);
    if (!startYear) return { ok: true, violations: [], details: { skipped: '无 startYear·无法判时点' } };
    function scan(text, who) {
      if (!text || v.length >= 40) return;
      var m = ('' + text).match(/(?:1[0-9]{3}|20[0-9]{2})/g);
      if (!m) return;
      for (var i = 0; i < m.length; i++) { var y = parseInt(m[i], 10); if (y > startYear) { v.push(who + ' 含晚于开始年(' + startYear + ')的纪年「' + y + '」——平行时空·此刻不应记将来'); break; } }
    }
    (draft.characters || draft.chars || []).forEach(function (c) {
      if (!c) return;
      scan(c.bio, '人物「' + (c.name || '?') + '」bio');
      if (Array.isArray(c._memory)) c._memory.forEach(function (mm) { scan(mm && (mm.event || mm.text), '人物「' + (c.name || '?') + '」记忆'); });
      if (Array.isArray(c.career)) scan(c.career.join(' '), '人物「' + (c.name || '?') + '」履历');
    });
    (draft.openingLetters || []).forEach(function (x) { scan(x && (x.content || x.body), '开场书信「' + (x && (x.title || x.id) || '?') + '」'); });
    (draft.currentIssues || []).forEach(function (x) { scan(x && JSON.stringify(x), '御案时政「' + (x && x.title || '?') + '」'); });
    (draft.memorials || []).forEach(function (x) { scan(x && (x.content || x.body), '奏疏「' + (x && x.title || '?') + '」'); });
    // 仅扫「已发生」事件(triggerTurn 0/_alreadyHappened)·未来触发事件按设计描述将来不扫
    (draft.rigidHistoryEvents || draft.events || []).forEach(function (x) { if (x && (x._alreadyHappened || x.triggerTurn === 0)) scan(x.narrative || x.description, '已发生事件「' + (x.name || '?') + '」'); });
    return { ok: v.length === 0, violations: v, details: { startYear: startYear, hits: v.length } };
  }

  // ── 人物完整性（跨剧本）：史实人物应有五常(wuchangOverride 仁义礼智信·履职系统消费)；能力值应 0-100。
  //    2026-06 绍宋整局教训：五常 0/501 全缺(履职靠兜底)·能力本就符史实——故重点查五常缺失。
  function vCharCompleteness(draft) {
    var v = [];
    var chars = (draft && (draft.characters || draft.chars)) || [];
    if (!Array.isArray(chars) || !chars.length) return { ok: true, violations: [] };
    // 虚构/架空世界：人物全是原创，没有「史实人物」之说——豁免「五常」要求（仍查能力越界与势力绑定一致性）。
    var fictionWorld = !!(draft && draft.worldKind === 'fictional');
    var histNoWC = fictionWorld ? [] : chars.filter(function (c) { return c && (c.isHistorical !== false) && !c.isFictional && !(c.wuchangOverride && typeof c.wuchangOverride === 'object'); });
    if (histNoWC.length) v.push('史实人物缺五常(wuchangOverride 仁义礼智信) ' + histNoWC.length + ' 人——履职系统消费·史实人物须定位。例：' + histNoWC.slice(0, 6).map(function (c) { return c.name || '?'; }).join('、'));
    var abil = ['intelligence', 'military', 'administration', 'charisma', 'diplomacy', 'valor', 'management'], oob = 0, oobName = '';
    chars.forEach(function (c) { if (!c) return; abil.forEach(function (f) { var x = c[f]; if (typeof x === 'number' && (x < 0 || x > 100)) { oob++; if (!oobName) oobName = (c.name || '?') + '.' + f + '=' + x; } }); });
    if (oob) v.push('能力值越界(应 0-100) ' + oob + ' 处，例：' + oobName);
    // 势力绑定一致性：有 factionId 但与 faction 名串对不上(canonical resolver 会修但剧本宜先一致)
    var facById = {}; ((draft && draft.factions) || []).forEach(function (f) { if (f && f.id) facById[f.id] = f.name; });
    // 容忍子势力前缀(如 faction「宋朝廷·内廷」factionId 指向「宋朝廷」)——前缀一致即视为同源·非错绑。
    var mismatch = chars.filter(function (c) { return c && c.factionId && facById[c.factionId] && c.faction && ('' + c.faction).indexOf(facById[c.factionId]) !== 0; }).length;
    if (mismatch) v.push('人物 factionId 与 faction 名串不一致 ' + mismatch + ' 人(绑定双锚应对齐·非子势力前缀)');
    return { ok: v.length === 0, violations: v, details: { histNoWuchang: histNoWC.length, abilityOob: oob, factionMismatch: mismatch } };
  }

  // 刀①(2026-07-10 智能升级B)：关系网一致性——无自环/无全重；显式 strictRefs 的人物边才检查名册引用。
  // 顶层 relations 在官方剧本中也是开放图（党派/阶层/已故或未出场人物均可作节点），不能把所有未知端点都当坏外键。
  function vRelationConsistency(draft) {
    var v = [];
    var rels = (draft && draft.relations) || [];
    if (!Array.isArray(rels) || !rels.length) return { ok: true, violations: [] };
    var names = {};
    ((draft && (draft.characters || draft.chars)) || []).forEach(function (c) { if (c && c.name) names[c.name] = 1; });
    var danglingMap = {}, danglingEdges = 0, selfLoop = 0, dupes = 0, seen = {};
    rels.forEach(function (r) {
      if (!r) return;
      var f = r.from, t = r.to, bad = false;
      var strictRefs = r.strictRefs === true;
      if (strictRefs && f && !names[f]) { danglingMap[f] = 1; bad = true; }
      if (strictRefs && t && !names[t]) { danglingMap[t] = 1; bad = true; }
      if (bad) danglingEdges++;
      if (f && f === t) selfLoop++;
      var k = String(f) + '→' + String(t) + '·' + String(r.type || '');
      if (seen[k]) dupes++; else seen[k] = 1;
    });
    var danglingNames = Object.keys(danglingMap);
    if (danglingNames.length) v.push('严格人物关系边悬空引用 ' + danglingEdges + ' 条（strictRefs=true 且 from/to 不在人物名册）：' + danglingNames.slice(0, 6).join('、') + (danglingNames.length > 6 ? ' 等' : '') + '——人物改名用 renameEntity 联动·删人前 findReferences 清关系');
    if (selfLoop) v.push('关系自环(from=to) ' + selfLoop + ' 条');
    if (dupes) v.push('完全重复关系边(from+to+type 同) ' + dupes + ' 条');
    // gateScore=边级计数（违规消息按类聚合·消息数对「多了一条悬空」不敏感·质量闸按此比对基线）
    return { ok: v.length === 0, violations: v, gateScore: danglingEdges + selfLoop + dupes, details: { danglingEdges: danglingEdges, danglingNames: danglingNames.length, selfLoop: selfLoop, dupes: dupes } };
  }

  var _checks = {
    'admin-population': vAdminPopulation,
    'faction-refs': vFactionRefs,
    'region-coverage': vRegionCoverage,
    'timeline-compliance': vTimelineCompliance,
    'char-completeness': vCharCompleteness,
    'relation-consistency': vRelationConsistency,
    'runtime-chars': vRuntimeChars,
    'runtime-office': vRuntimeOffice,
    'runtime-boot': vRuntimeBoot
  };
  // validateDraft 默认跑这几个结构检查（轻量·供频繁自查）；运行时检查(runtime-*)只在 preflight 跑（finish 前体检）。
  // timeline-compliance(平行时空时点) + char-completeness(史实人物五常/绑定) 是 2026-06 绍宋整局教训沉淀的关。
  var _defaultChecks = ['admin-population', 'faction-refs', 'region-coverage', 'timeline-compliance', 'char-completeness'];

  /** 聚合校验·返回 {ok, violations, results, stats}（沿用 tm-invariants 报告形状） */
  function validateDraft(draft, groupName) {
    var groups = groupName ? [groupName] : _defaultChecks;
    var all = [];
    var results = {};
    groups.forEach(function(g) {
      var fn = _checks[g];
      if (!fn) {
        results[g] = { ok: false, violations: ['未知 group'] };
        all.push('[' + g + '] 未知 group');
        return;
      }
      try {
        var r = fn(draft) || { ok: true, violations: [] };
        results[g] = r;
        (r.violations || []).forEach(function(m) { all.push('[' + g + '] ' + m); });
      } catch (e) {
        results[g] = { ok: false, violations: ['检查异常: ' + (e.message || e)] };
        all.push('[' + g + '] 检查异常: ' + (e.message || e));
      }
    });
    return {
      ok: all.length === 0,
      violations: all,
      results: results,
      stats: {
        checked: groups.length,
        passed: groups.filter(function(g) { return results[g] && results[g].ok; }).length,
        failed: groups.filter(function(g) { return results[g] && !results[g].ok; }).length
      }
    };
  }

  // 方向E · 运行时体检裁决：跑全部检查，把"会影响运行"的归为 blockers、其余为 warnings，给"能否加载"verdict。
  var _BOOT_CRITICAL = ['runtime-boot', 'faction-refs', 'runtime-office', 'runtime-chars'];
  // 人物 factionId ↔ faction 名串 双向同步（确定性·国师 agent 读改 factionId 的兜底）。
  // factionId 为稳定真相：有 factionId 则用 factions[id].name 校正名串（势力改名/编辑器细化命名后人物不沦孤儿）；
  // 无 factionId 则用名串回填 factionId。国师 agent 生成/编辑人物、preflight 体检前都应调用，避免名串脱节。
  function ensureCharFactionId(draft) {
    if (!draft || !Array.isArray(draft.characters) || !Array.isArray(draft.factions)) return { corrected: 0, backfilled: 0 };
    var byId = {}, byName = {};
    draft.factions.forEach(function(f) { if (f && f.id) byId[f.id] = f; if (f && f.name) byName[f.name] = f; });
    var corrected = 0, backfilled = 0;
    draft.characters.forEach(function(c) {
      if (!c) return;
      if (c.factionId != null && c.factionId !== '' && byId[c.factionId]) {
        if (c.faction !== byId[c.factionId].name) { c.faction = byId[c.factionId].name; corrected++; }   // 有 id → 校正名串
      } else if (c.faction && byName[c.faction]) {
        c.factionId = byName[c.faction].id; backfilled++;                                                  // 有名 → 回填 id
      }
    });
    return { corrected: corrected, backfilled: backfilled };
  }

  // 时间字段同步（跨剧本·国师 agent 死字段修复）：引擎读 gameSettings.startYear/startMonth 为权威，
  // 但 schema 顶层亦列 startYear，国师 AI 常只写顶层 → 引擎读不到 gameSettings → 进游戏显示公元前。
  // 双向兜底：顶层 ↔ gameSettings 互补，确保 gameSettings 有值（引擎权威源），并回填顶层保持一致。
  function ensureTimeFields(draft) {
    if (!draft || typeof draft !== 'object') return;
    if (!draft.gameSettings || typeof draft.gameSettings !== 'object') draft.gameSettings = {};
    var gs = draft.gameSettings;
    var hasTop = (draft.startYear != null && draft.startYear !== '');
    var hasGs  = (gs.startYear != null && gs.startYear !== '');
    if (!hasGs && hasTop) gs.startYear = Number(draft.startYear);        // 顶层 → gameSettings（引擎权威源）
    else if (!hasTop && hasGs) draft.startYear = gs.startYear;            // 反向回填，两处一致
    if ((gs.startMonth == null || gs.startMonth === '') && draft.startMonth != null && draft.startMonth !== '') gs.startMonth = Number(draft.startMonth);
    else if ((draft.startMonth == null || draft.startMonth === '') && gs.startMonth != null && gs.startMonth !== '') draft.startMonth = gs.startMonth;
    if (draft.era != null && draft.era !== '' && (gs.era == null || gs.era === '')) gs.era = draft.era;  // 年号顶层 → gameSettings
  }

  // 体检必须是纯读：列出原先会被 ensure* 静默补齐的运行时契约，让玩家/国师显式修复。
  function _canonicalFieldFindings(draft) {
    var blockers = [], warnings = [];
    if (!draft || typeof draft !== 'object') return { blockers: ['[canonical-fields] 剧本为空'], warnings: [] };
    var gs = draft.gameSettings;
    var topYear = draft.startYear, runtimeYear = gs && gs.startYear;
    if (!gs || typeof gs !== 'object') {
      blockers.push('[canonical-fields] 缺 gameSettings（运行时读取开局时间的权威容器）');
    } else if (runtimeYear == null || runtimeYear === '') {
      blockers.push('[canonical-fields] 缺 gameSettings.startYear（只写顶层 startYear 会让运行时纪年失真）');
    }
    if ((topYear == null || topYear === '') && (runtimeYear == null || runtimeYear === '')) {
      blockers.push('[canonical-fields] 顶层 startYear 与 gameSettings.startYear 均缺失');
    } else if (topYear != null && topYear !== '' && runtimeYear != null && runtimeYear !== '' && Number(topYear) !== Number(runtimeYear)) {
      blockers.push('[canonical-fields] 顶层 startYear 与 gameSettings.startYear 不一致（' + topYear + ' / ' + runtimeYear + '）');
    } else if ((topYear == null || topYear === '') && runtimeYear != null && runtimeYear !== '') {
      warnings.push('[canonical-fields] 顶层 startYear 缺失；运行时可启动，但时点校验与编辑器摘要会跳过');
    }
    if (gs && typeof gs === 'object' && (gs.startMonth == null || gs.startMonth === '') && draft.startMonth != null && draft.startMonth !== '') {
      warnings.push('[canonical-fields] 顶层 startMonth 尚未同步到 gameSettings.startMonth');
    }
    var facByName = {};
    (Array.isArray(draft.factions) ? draft.factions : []).forEach(function(f) { if (f && f.name && f.id) facByName[f.name] = f.id; });
    var missingFactionIds = 0;
    (Array.isArray(draft.characters) ? draft.characters : []).forEach(function(c) {
      if (c && c.faction && facByName[c.faction] && (c.factionId == null || c.factionId === '')) missingFactionIds++;
    });
    if (missingFactionIds) warnings.push('[canonical-fields] ' + missingFactionIds + ' 个人物可由 faction 名回填 factionId；体检未自动改动原剧本');
    return { blockers: blockers, warnings: warnings };
  }

  function preflight(draft) {
    var groups = Object.keys(_checks);   // 体检跑全部检查（结构 + 运行时）
    var results = {}, blockers = [], warnings = [];
    groups.forEach(function(g) {
      var r;
      try { r = _checks[g](draft) || { ok: true, violations: [] }; }
      catch (e) { r = { ok: false, violations: ['检查异常: ' + (e.message || e)] }; }
      results[g] = r;
      if (r.violations && r.violations.length) {
        var bucket = _BOOT_CRITICAL.indexOf(g) >= 0 ? blockers : warnings;
        r.violations.forEach(function(m) { bucket.push('[' + g + '] ' + m); });
      }
    });
    var canonical = _canonicalFieldFindings(draft);
    blockers = blockers.concat(canonical.blockers);
    warnings = warnings.concat(canonical.warnings);
    var rep = { results: results, ok: blockers.length === 0 && warnings.length === 0 };
    var bootable = blockers.length === 0;
    var summary = bootable
      ? (warnings.length ? '可运行，但有 ' + warnings.length + ' 处建议改进' : '✓ 运行时体检通过，可正常加载')
      : '✗ 有 ' + blockers.length + ' 处会影响运行的问题，建议先修';
    return { ok: rep.ok, bootable: bootable, blockers: blockers, warnings: warnings, normalizations: canonical, summary: summary, results: rep.results };
  }

  /** 注册自定义校验（供后续 slice 扩展） */
  function addCheck(name, fn) {
    if (!name || typeof fn !== 'function') return false;
    _checks[name] = fn;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  S2 · 推理 client（自包含·读编辑器自己的 localStorage.tm_api·坑 A 消解）
  //  editor.html 不加载 tm-ai-infra.js，故不复用 callAIWithTools；
  //  这里移植其多 provider tool-calling 分支，精简为编辑器已支持的两路 + 兜底。
  // ═══════════════════════════════════════════════════════════════════

  /** 读编辑器 BYOK 配置（与 callAIEditor 同源：localStorage.tm_api）。 */
  // 与正式游戏同步：游戏把主 API 存在 P.ai（落 localStorage 的 tm_P 全量 / tm_P_lite 精简），
  // 编辑器/agent 历史上读独立的 tm_api → 不同步。此处优先读游戏 P.ai（用户在游戏里配的一份），
  // 游戏无配置时回退编辑器 tm_api。保存侧（编辑器）会同时写回游戏 P.ai，达成双向同步。
  function _readGameAi() {
    function readJson(k) { try { var r = global.localStorage && global.localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
    var pl = readJson('tm_P_lite'); if (pl && pl.ai && (pl.ai.key || pl.ai.url)) return pl.ai;
    var pf = readJson('tm_P'); if (pf && pf.ai && (pf.ai.key || pf.ai.url)) return pf.ai;
    return null;
  }
  function loadEditorApiConfig() {
    var tm = {};
    try { tm = JSON.parse((global.localStorage && global.localStorage.getItem('tm_api')) || '{}') || {}; } catch (e) { tm = {}; }
    var g = _readGameAi() || {};
    // 游戏 P.ai 有 key → 以游戏为准（全游戏通用主 API）；否则用编辑器 tm_api
    var src = g.key ? g : tm;
    return {
      key: src.key || '',
      url: (src.url || '').replace(/\/+$/, ''),
      model: src.model || 'gpt-4o',
      model2: src.model2 || '',   // 次要模型(杂活分工:会审两官/前情摘要等·空=同主模型)
      temp: (src.temp != null) ? src.temp : 0.7
    };
  }
  // 生图 API 配置(全游戏共用 tm_api_image·与工坊生图面板同源)——agent 的 generateImage 工具用
  // Key 留空复用主 API 的 Key（与游戏侧 ImageAPI.getConfig 同约·2026-07-10）
  function _loadImageApiConfig() {
    try {
      var t = JSON.parse((global.localStorage && global.localStorage.getItem('tm_api_image')) || '{}') || {};
      var k = t.key || '';
      if (!k && t.url) { try { k = loadEditorApiConfig().key || ''; } catch (e2) {} }
      return { key: k, url: (t.url || '').replace(/\/+$/, ''), model: t.model || 'dall-e-3' };
    } catch (e) { return { key: '', url: '', model: 'dall-e-3' }; }
  }
  // 次要模型配置：同 API 换便宜模型干杂活(三堂会审的史官/谏官·宏压缩摘要)——未配则返回 null(用主模型)
  function _secondaryCfg() {
    try {
      var c = loadEditorApiConfig();
      if (!c.model2 || c.model2 === c.model) return null;
      return { key: c.key, url: c.url, model: c.model2, temp: c.temp };
    } catch (e) { return null; }
  }

  // 方向B · 剧本记忆：持久「剧本约定」（玩家写的创作偏好·等价 CLAUDE.md），每次 run 注入提示词。
  var CONVENTIONS_KEY = 'tm_aa_conventions';
  function loadConventions() {
    try { return String((global.localStorage && global.localStorage.getItem(CONVENTIONS_KEY)) || '').slice(0, 4000); }
    catch (e) { return ''; }
  }
  function saveConventions(text) {
    try { global.localStorage && global.localStorage.setItem(CONVENTIONS_KEY, String(text == null ? '' : text).slice(0, 4000)); return true; }
    catch (e) { return false; }
  }

  /* ═══════════════════════════════════════════════════════════════════
     CC 对照移植 · 记忆 / 技能 / 能力包 三件套（2026-07-03）
     - 记忆(≈CC memdir)：四型条目(user/feedback/project/reference)·localStorage 当
       文件系统·清单≈MEMORY.md 索引·run 首轮用次要模型按需求召回≤5条(失败回退关键词)。
       与「约定」分工：约定=显式规范·每轮全文注入；记忆=背景上下文·按需召回。
     - 技能(≈CC SkillTool)：{name,description,whenToUse,body} 指令包·清单注入系统词·
       agent 经 useSkill 按需展开全文照做·saveSkill 沉淀可复用做法。
     - 能力包(≈CC plugin)：技能+约定的打包分发单元·可启停·JSON 导入导出(像剧本包
       一样跨玩家分享)。启停/装卸=玩家权限·不设 agent 工具·只挂 API 供 UI/console。
     ═══════════════════════════════════════════════════════════════════ */
  var MEMDIR_KEY = 'tm_aa_memdir';
  var MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'];
  function _loadMemories() {
    try { var a = JSON.parse((global.localStorage && global.localStorage.getItem(MEMDIR_KEY)) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function _saveMemoriesArr(arr) {
    try { global.localStorage && global.localStorage.setItem(MEMDIR_KEY, JSON.stringify(arr.slice(0, 60))); return true; }
    catch (e) { return false; }
  }
  function _prepareMemoryEntry(m) {
    m = m || {};
    var name = String(m.name || '').trim().slice(0, 60);
    var type = MEMORY_TYPES.indexOf(m.type) >= 0 ? m.type : 'project';
    var description = String(m.description || '').trim().slice(0, 160);
    var body = String(m.body || '').trim().slice(0, 1500);
    if (!name || !description || !body) return { ok: false, error: 'name/description/body 均必填' };
    return { ok: true, value: { name: name, type: type, description: description, body: body } };
  }
  function saveMemoryEntry(m) {
    var prepared = _prepareMemoryEntry(m);
    if (!prepared.ok) return prepared;
    var v = prepared.value;
    var arr = _loadMemories();
    var i = arr.findIndex(function (x) { return x && x.name === v.name; });
    var entry = { id: i >= 0 ? arr[i].id : ('mem_' + Date.now().toString(36)), name: v.name, type: v.type, description: v.description, body: v.body, ts: Date.now() };
    if (i >= 0) arr[i] = entry; else arr.unshift(entry);
    if (!_saveMemoriesArr(arr)) return { ok: false, error: '记忆存储失败' };
    return { ok: true, saved: v.name, type: v.type, total: Math.min(arr.length, 60), updated: i >= 0 };
  }
  function deleteMemory(idOrName) {
    var arr = _loadMemories(), n = arr.length;
    arr = arr.filter(function (x) { return x && x.id !== idOrName && x.name !== idOrName; });
    _saveMemoriesArr(arr);
    return { ok: arr.length < n, removed: n - arr.length };
  }
  var _RECALL_TOOL = [{
    name: 'selectMemories',
    description: '从记忆清单中选出对处理当前需求明确有用的记忆名（≤5 个；不确定就不选；没有就传空数组）。',
    parameters: { type: 'object', properties: { names: { type: 'array', items: { type: 'string' } } }, required: ['names'] }
  }];
  /* 关键词回退：次要模型不可用/失败时·按需求词面在 name/description 上计分取 top */
  function _recallByKeywords(query, mems) {
    var terms = [];
    String(query || '').replace(/[一-鿿]{2,}|[A-Za-z]{3,}/g, function (w) {
      if (/[一-鿿]/.test(w)) { for (var i = 0; i + 1 < w.length && i < 8; i++) terms.push(w.slice(i, i + 2)); }
      else terms.push(w.toLowerCase());
      return w;
    });
    if (!terms.length) return [];
    return mems.map(function (m) {
      var hay = (m.name + ' ' + m.description).toLowerCase(), score = 0;
      terms.forEach(function (t) { if (hay.indexOf(t) >= 0) score++; });
      return { m: m, score: score };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 5).map(function (x) { return x.m; });
  }
  function _memBlock(sel) {
    if (!sel.length) return '';
    return '【相关记忆·你此前与该玩家/剧本共事时存下的背景】（参考用·非当前指令；与玩家当前要求冲突时以当前要求为准）\n'
      + sel.map(function (m) { return '· [' + m.type + '] ' + m.name + '：' + m.body; }).join('\n');
  }
  /* 召回：≤3 条全注入免调用；>3 条用次要模型(未配则主模型)选≤5；调用失败回退关键词。
     callerFn 可注入(mock 测试·与 runAuthoringLoop 的 opts.caller 同型)。 */
  function _recallMemories(query, cfgMain, callerFn, signal) {
    var mems = _loadMemories();
    if (!mems.length) return Promise.resolve('');
    if (mems.length <= 3) return Promise.resolve(_memBlock(mems));
    var manifest = mems.map(function (m) { return '- ' + m.name + ' [' + m.type + '] ' + m.description; }).join('\n');
    var sys = '你在为一个剧本编辑 agent 挑选背景记忆。根据用户需求，从清单中选出明确有用的记忆名（≤5 个）。拿不准的不选；没有就空数组。只调用 selectMemories 工具。';
    var ask = '【用户需求】\n' + String(query || '').slice(0, 600) + '\n\n【记忆清单】\n' + manifest;
    return Promise.resolve((callerFn || callWithTools)([{ role: 'user', text: ask }], _RECALL_TOOL, { maxTok: 300, maxRetries: 1, cfg: _secondaryCfg() || cfgMain, system: sys, signal: signal }))
      .then(function (r) {
        var call = r && r.toolCalls && r.toolCalls[0];
        var names = (call && call.input && Array.isArray(call.input.names)) ? call.input.names : null;
        if (!names) return _memBlock(_recallByKeywords(query, mems));
        var sel = mems.filter(function (m) { return names.indexOf(m.name) >= 0; }).slice(0, 5);
        return _memBlock(sel);
      })
      .catch(function () { return _memBlock(_recallByKeywords(query, mems)); });
  }

  /* ── 技能：内置 + 用户 + 启用能力包（同名后者不覆盖先者·builtin 最先） ── */
  var SKILLS_KEY = 'tm_aa_skills';
  var BUILTIN_SKILLS = [
    {
      name: '人物塑造章法', builtin: true,
      description: '把人物做成有血肉、可入局的完整实体',
      whenToUse: '新增人物或丰满既有人物时',
      body: [
        '1. 先 searchEntities 看 1-2 个剧本已有同类人物，以其字段集与丰满度为基线（勿低于官方实体）。',
        '2. 身份链：姓名/表字/官衔/品级/所属势力(用已存在势力)/年龄/籍贯，一个不缺。',
        '3. 数值：能力(智谋/武勇/军事/政务/管理/魅力等)+忠诚/野心，按人物定位落在设定区间内、彼此自洽（权臣≠全能，名将常短于政务）。',
        '4. 血肉：小传 100-200 字（出身→关键经历→当下处境）、性格、外貌、言辞风格。',
        '5. 关系网：至少 2 条与既有人物的关系（同党/政敌/师生/姻亲），双向自洽。',
        '6. AI 人格：核心动机+底线+处世方式，让 NPC 行为可预期且有个性。',
        '7. 史实人物先 checkHistory 核生卒/官衔；虚构人物名字要贴时代（避免现代感用字）。'
      ].join('\n')
    }
  ];
  function _loadUserSkills() {
    try { var a = JSON.parse((global.localStorage && global.localStorage.getItem(SKILLS_KEY)) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function _saveUserSkills(arr) {
    try { global.localStorage && global.localStorage.setItem(SKILLS_KEY, JSON.stringify(arr.slice(0, 40))); return true; }
    catch (e) { return false; }
  }
  function _prepareSkillEntry(s) {
    s = s || {};
    var name = String(s.name || '').trim().slice(0, 60);
    var description = String(s.description || '').trim().slice(0, 160);
    var whenToUse = String(s.whenToUse || '').trim().slice(0, 120);
    var body = String(s.body || '').trim().slice(0, 4000);
    if (!name || !body) return { ok: false, error: 'name/body 必填' };
    if (BUILTIN_SKILLS.some(function (b) { return b.name === name; })) return { ok: false, error: '「' + name + '」是内置技能，换个名字' };
    return { ok: true, value: { name: name, description: description, whenToUse: whenToUse, body: body } };
  }
  function saveSkillEntry(s) {
    var prepared = _prepareSkillEntry(s);
    if (!prepared.ok) return prepared;
    var v = prepared.value;
    var arr = _loadUserSkills();
    var i = arr.findIndex(function (x) { return x && x.name === v.name; });
    var entry = { name: v.name, description: v.description, whenToUse: v.whenToUse, body: v.body, ts: Date.now() };
    if (i >= 0) arr[i] = entry; else arr.unshift(entry);
    if (!_saveUserSkills(arr)) return { ok: false, error: '技能存储失败' };
    return { ok: true, saved: v.name, updated: i >= 0 };
  }

  // 工具在运行期只暂存外部副作用；玩家真正“应用到剧本”后才原子提交。
  // 任一条失败会把两份 localStorage 恢复到提交前，避免草稿被放弃却留下记忆/技能。
  function commitSideEffects(effects) {
    effects = Array.isArray(effects) ? effects : [];
    if (!effects.length) return { ok: true, committed: 0 };
    for (var vi = 0; vi < effects.length; vi++) {
      var fx = effects[vi] || {};
      var check = fx.type === 'memory' ? _prepareMemoryEntry(fx.input) : (fx.type === 'skill' ? _prepareSkillEntry(fx.input) : { ok: false, error: '未知副作用类型:' + fx.type });
      if (!check.ok) return { ok: false, committed: 0, error: check.error };
    }
    var beforeMem = null, beforeSkill = null;
    try {
      beforeMem = global.localStorage && global.localStorage.getItem(MEMDIR_KEY);
      beforeSkill = global.localStorage && global.localStorage.getItem(SKILLS_KEY);
      var results = [];
      effects.forEach(function (fx) {
        var r = fx.type === 'memory' ? saveMemoryEntry(fx.input) : saveSkillEntry(fx.input);
        if (!r || r.ok === false) throw new Error((r && r.error) || '副作用提交失败');
        results.push(r);
      });
      return { ok: true, committed: results.length, results: results };
    } catch (e) {
      try {
        if (global.localStorage) {
          if (beforeMem == null) global.localStorage.removeItem(MEMDIR_KEY); else global.localStorage.setItem(MEMDIR_KEY, beforeMem);
          if (beforeSkill == null) global.localStorage.removeItem(SKILLS_KEY); else global.localStorage.setItem(SKILLS_KEY, beforeSkill);
        }
      } catch (_) {}
      return { ok: false, committed: 0, error: (e && e.message) || String(e) };
    }
  }
  function deleteSkill(name) {
    var arr = _loadUserSkills(), n = arr.length;
    arr = arr.filter(function (x) { return x && x.name !== name; });
    _saveUserSkills(arr);
    return { ok: arr.length < n };
  }
  function listAllSkills() {
    var seen = {}, out = [];
    BUILTIN_SKILLS.concat(_enabledPackSkills(), _loadUserSkills()).forEach(function (s) {
      if (!s || !s.name || seen[s.name]) return;
      seen[s.name] = 1; out.push(s);
    });
    return out;
  }
  function _skillsBlock() {
    var all = listAllSkills();
    if (!all.length) return '';
    return '【可用技能】以下技能是打磨过的操作指令包。做对应事情时，先调 useSkill(name) 展开全文再照做：\n'
      + all.slice(0, 14).map(function (s) { return '- ' + s.name + '：' + (s.whenToUse || s.description || ''); }).join('\n')
      + '\n（做完某类事发现值得沉淀的做法，可 saveSkill 存成技能供下次复用。）';
  }

  /* ── 能力包：技能+约定打包·启停·导入导出（启停装卸=玩家权限·无 agent 工具） ── */
  var PACKS_KEY = 'tm_aa_packs';
  var PACKS_STATE_KEY = 'tm_aa_packs_state';
  var BUILTIN_PACKS = [
    {
      name: '立绘工坊', version: '1.0', builtin: true,
      description: '人物立绘/势力旗徽的生成规范与提示词模板（配合 generateImage）',
      conventions: '立绘统一写 characters.N.portrait；剧本里已有的有效立绘视为玩家资产，除非玩家明确要求替换，绝不覆盖。',
      skills: [{
        name: '人物立绘生成规范',
        description: '历史向人物立绘的提示词章法与安全边界',
        whenToUse: '给人物生成立绘/画像或给势力生成旗徽时',
        body: [
          '1. 先 getField 读该人物的 age/gender/faction/role/officialTitle/appearance/bio——立绘必须长在人设上。',
          '2. 用 generateImage 写入 characters.N.portrait。提示词按此模板填充：',
          '   「历史策略游戏人物立绘·竖版3:4·单人·腰部以上四分之三侧身·<年龄><性别><族属>·<官职/身份/势力处境>·外貌：<appearance>·<时代>考据服饰：<按身份定>·背景：<身份相称场景·无他人>·写实中国历史插画·工笔线条·墨彩质感·宣纸色调·电影感自然光·五官与织物高细节」。',
          '3. 一律追加禁则：无文字/无水印/无现代物/无奇幻元素。',
          '4. 北族(女真/契丹/党项/草原)人物追加：避免清代辫发剃额、避免无据的蒙元装束、避免角盔与奇幻甲。',
          '5. 女性/未成年/俘虏等人物追加：庄重肖像、不性化、不羞辱、不血腥。',
          '6. 剧本已有有效立绘的绝不覆盖（除非玩家点名要换）；玩家未配生图 API 时报错即停，改为把 appearance 文字描述写丰满。',
          '7. 生成后按需复用：同一图要用到别处（势力 leaderPortrait、事件配图等）用 copyField(from,to) 直拷——图不过上下文、不重新生成、不重复扣费。'
        ].join('\n')
      }]
    },
    {
      name: '疆域工坊', version: '1.0', builtin: true,
      description: '地图疆域/归属/名称调整的稳妥操作法',
      conventions: '',
      skills: [{
        name: '疆域与地图调整法',
        description: '改地块归属/疆域/省名的标准流程',
        whenToUse: '划地块给某势力、调整疆域归属、地块或省改名时',
        body: [
          '1. 先 mapOverview 看清现有地块/归属/势力全局，再动手；大批调整先 todoWrite 列清单逐块核对。',
          '2. 改归属用 mapAssignOwner(地块名+势力名)——自动上色并同步 map/mapData 双镜像，别绕道 applyEdit 拼路径。',
          '3. 地块/省改名用 renameRegion（同步双镜像）；若剧本其他文字还引用旧名，再补 renameEntity(旧名,新名) 联动。',
          '4. 行政区划(adminHierarchy)与地图是两层：区划改了归属/名称，要检查地图侧是否呼应，反之亦然。',
          '5. 收尾 validateDraft + 抽查 2-3 个改过的地块归属确认落地。'
        ].join('\n')
      }]
    }
  ];
  function _loadUserPacks() {
    try { var a = JSON.parse((global.localStorage && global.localStorage.getItem(PACKS_KEY)) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function _packsState() {
    try { return JSON.parse((global.localStorage && global.localStorage.getItem(PACKS_STATE_KEY)) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function _packEnabled(name) {
    var st = _packsState();
    return st[name] !== false;   /* 默认启用·显式 false 才停 */
  }
  function listPacks() {
    return BUILTIN_PACKS.concat(_loadUserPacks()).map(function (p) {
      return { name: p.name, version: p.version || '', description: p.description || '', builtin: !!p.builtin, enabled: _packEnabled(p.name), skills: (p.skills || []).length };
    });
  }
  function setPackEnabled(name, on) {
    var st = _packsState(); st[name] = !!on;
    try { global.localStorage && global.localStorage.setItem(PACKS_STATE_KEY, JSON.stringify(st)); } catch (e) {}
    return { ok: true, name: name, enabled: !!on };
  }
  function _enabledPacks() {
    return BUILTIN_PACKS.concat(_loadUserPacks()).filter(function (p) { return p && _packEnabled(p.name); });
  }
  function _enabledPackSkills() {
    var out = [];
    _enabledPacks().forEach(function (p) { (p.skills || []).forEach(function (s) { out.push(s); }); });
    return out;
  }
  function _packsConventions() {
    return _enabledPacks().map(function (p) { return String(p.conventions || '').trim(); })
      .filter(Boolean).join('\n');
  }
  function importPackJSON(json) {
    try {
      var p = typeof json === 'string' ? JSON.parse(json) : json;
      if (!p || !p.name || !Array.isArray(p.skills)) return { ok: false, error: '能力包需含 name 与 skills[]' };
      if (BUILTIN_PACKS.some(function (b) { return b.name === p.name; })) return { ok: false, error: '与内置包同名' };
      var clean = { name: String(p.name).slice(0, 60), version: String(p.version || '1.0').slice(0, 20), description: String(p.description || '').slice(0, 200), conventions: String(p.conventions || '').slice(0, 1500), skills: p.skills.slice(0, 10).map(function (s) { return { name: String(s.name || '').slice(0, 60), description: String(s.description || '').slice(0, 160), whenToUse: String(s.whenToUse || '').slice(0, 120), body: String(s.body || '').slice(0, 4000) }; }).filter(function (s) { return s.name && s.body; }) };
      var arr = _loadUserPacks();
      var i = arr.findIndex(function (x) { return x && x.name === clean.name; });
      if (i >= 0) arr[i] = clean; else arr.unshift(clean);
      try { global.localStorage && global.localStorage.setItem(PACKS_KEY, JSON.stringify(arr.slice(0, 20))); } catch (e2) {}
      return { ok: true, imported: clean.name, skills: clean.skills.length };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }
  function exportPackJSON(name) {
    var p = BUILTIN_PACKS.concat(_loadUserPacks()).find(function (x) { return x && x.name === name; });
    if (!p) return null;
    return JSON.stringify({ name: p.name, version: p.version || '1.0', description: p.description || '', conventions: p.conventions || '', skills: p.skills || [] }, null, 2);
  }
  function removePack(name) {
    var arr = _loadUserPacks(), n = arr.length;
    arr = arr.filter(function (x) { return x && x.name !== name; });
    try { global.localStorage && global.localStorage.setItem(PACKS_KEY, JSON.stringify(arr)); } catch (e) {}
    return { ok: arr.length < n };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  S2 · agent 工具定义 + 派发 + loop
  // ═══════════════════════════════════════════════════════════════════

  var AGENT_TOOLS = [
    {
      name: 'mapOverview',
      description: '查看当前剧本地图：返回各地块的 名称/当前归属势力/行政绑定 + 可用势力列表。改地图归属、回答"某地归谁"前先用它看清有哪些地块、现在归谁、有哪些势力。',
      parameters: { type: 'object', properties: { limit: { type: 'number', description: '最多返回多少地块（默认80）' } } }
    },
    {
      name: 'mapAssignOwner',
      description: '把某地块划归某势力（改地图归属，预览会按新势力上色）。region 传地块名/id（如"青州"/"ming-03"，模糊匹配名称与行政绑定）；owner 传势力名或键（如"朝廷"/"明朝廷"/"fac-ming"，自动解析为 ownerKey）；可选 adminBinding 改行政绑定。会同步 map/mapData。先用 mapOverview 确认地块与势力名。',
      parameters: { type: 'object', properties: {
        region: { type: 'string', description: '地块名或 id（模糊匹配 name/adminBinding）' },
        owner: { type: 'string', description: '势力名或键（自动解析为 ownerKey）' },
        adminBinding: { type: 'string', description: '可选·行政绑定名' }
      }, required: ['region', 'owner'] }
    },
    {
      name: 'renameRegion',
      description: '给地图地块改名（改 map.regions 里某地块的显示 name，并同步 map/mapData 双镜像）。region 传现在的地块名/id/行政绑定（模糊匹配定位）；newName 传新名。专改地图地块/省名用它，比绕道 applyEdit 拼路径稳。注意：这只改这一块的 name；若还想把剧本里其他引用旧名的字符串一并联动改掉，改完再用 renameEntity(oldName,newName)。',
      parameters: { type: 'object', properties: {
        region: { type: 'string', description: '现地块名或 id（模糊匹配 name/adminBinding）' },
        newName: { type: 'string', description: '新地块名' }
      }, required: ['region', 'newName'] }
    },
    {
      name: 'applyEdit',
      description: '在剧本草稿上按 path 设值。path 形如 "name" / "factions.明.leader" / "playerInfo.factionName"。',
      parameters: { type: 'object', properties: {
        path: { type: 'string', description: '字段路径' },
        value: { type: ['string', 'number', 'boolean', 'object', 'array', 'null'], description: '要设置的值' },
        reason: { type: 'string', description: '简短理由（可选）' }
      }, required: ['path', 'value'] }
    },
    {
      name: 'applyPush',
      description: '向草稿里的数组追加一个元素，如 path="characters" value={name:"张三",...}。',
      parameters: { type: 'object', properties: {
        path: { type: 'string' },
        value: { type: 'object' }
      }, required: ['path', 'value'] }
    },
    {
      name: 'getField',
      description: '读取草稿某路径的当前值（改前先查看，避免盲改）。path 如 "factions" / "characters.张三" / "playerInfo"。',
      parameters: { type: 'object', properties: { path: { type: 'string', description: '字段路径' } }, required: ['path'] }
    },
    {
      name: 'getFields',
      description: '一次读取多个路径的当前值（批量版 getField·省往返）。paths 传路径数组，如 ["name","factions","playerInfo.factionName"]。过大值会截断为预览+规模。需同时核对多处状态时优先用它，别一个个 getField。',
      parameters: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' }, description: '路径数组（最多 40 个）' } }, required: ['paths'] }
    },
    {
      name: 'searchEntities',
      description: '在某集合按关键词查实体。collection 如 characters/factions/parties；query 匹配 name/faction/id/title 包含（留空=全部）。',
      parameters: { type: 'object', properties: {
        collection: { type: 'string' }, query: { type: 'string' }
      }, required: ['collection'] }
    },
    {
      name: 'globalSearch',
      description: '深度检索整棵剧本里任意字符串（真·全剧本 grep，深 walk 所有嵌套结构，含 map.regions 地块名 / adminHierarchy 行政层级 / 各集合的深层字段）。不知道东西在哪、或顶层集合里查不到（如地图省名/地块名）时用它。返回命中的完整点路径 path（可直接拿去 getField/applyEdit）+ 所属对象标签 label + 命中片段。大剧本里先 globalSearch 定位再动手。',
      parameters: { type: 'object', properties: {
        query: { type: 'string', description: '关键词' }, limit: { type: 'number', description: '最多返回多少条（默认 30）' }
      }, required: ['query'] }
    },
    {
      name: 'findReferences',
      description: '查整个剧本里有哪些地方引用了某实体名（势力/人物/物品名等）。改名或删除前必查，避免留下死链。返回 exact（精确等于该名的位置）与 mentions（文本里提到的位置）。',
      parameters: { type: 'object', properties: {
        name: { type: 'string', description: '实体名（精确）' }, limit: { type: 'number' }
      }, required: ['name'] }
    },
    {
      name: 'renameEntity',
      description: '引用感知改名：把整个剧本里所有【精确等于 oldName】的值改成 newName（含该实体自身的 name 字段 + 一切引用它的地方），一步联动不留死链。只动精确等值（不会误伤子串）。改名优先用它而非逐处 applyEdit。',
      parameters: { type: 'object', properties: {
        oldName: { type: 'string' }, newName: { type: 'string' }
      }, required: ['oldName', 'newName'] }
    },
    {
      name: 'removeEntity',
      description: '删除草稿某路径的元素（数组按名/索引，对象按键）。path 如 "characters.张三" / "factions.明"。',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
    },
    {
      name: 'validateDraft',
      description: '校验当前草稿（人口/势力引用/区划覆盖/角色/官制/启动必备），返回违规列表。每改完一批应调用以自查。',
      parameters: { type: 'object', properties: {
        group: { type: 'string', description: '可选：只跑某组 admin-population/faction-refs/region-coverage/timeline-compliance/char-completeness/relation-consistency(严格人物边悬空/自环/重复)/runtime-chars/runtime-office/runtime-boot' }
      } }
    },
    {
      name: 'preflight',
      description: '运行时体检：检查剧本能否被游戏正常加载（启动必备/角色完整/官制 holder/势力引用），区分会影响运行的 blockers 与建议性 warnings。改完、finish 之前应跑一次；有 blockers 就继续修到 bootable。',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'listGaps',
      description: '列出"游戏运行时必需但剧本里缺失"的字段（规格缺口）。改之前先 listGaps 看缺什么，与用户需求相关的缺口顺手补齐，让剧本完整可玩。',
      parameters: { type: 'object', properties: {
        includeOptional: { type: 'boolean', description: '是否一并列出可选缺口（默认只列必需缺口）' }
      } }
    },
    {
      name: 'fieldContract',
      description: '\u67e5\u201c\u6b63\u5f0f\u6e38\u620f\u8fd0\u884c\u65f6\u600e\u4e48\u8bfb\u67d0\u5b57\u6bb5\u201d\u7684\u5951\u7ea6\uff1a\u4f20 field \u8fd4\u56de\u8be5\u5b57\u6bb5\u4e2d\u6587\u540d/\u662f\u5426\u5fc5\u9700/\u6240\u5c5e\u6a21\u5757/\u6e38\u620f\u600e\u4e48\u7528\u5b83(detail)/\u54ea\u4e9b\u5b98\u65b9\u5267\u672c\u7528\uff1b\u4e0d\u4f20 field \u8fd4\u56de\u5168\u90e8\u6e38\u620f\u4f1a\u8bfb\u5b57\u6bb5\u7684\u7d22\u5f15\u3002\u5199\u6216\u6539\u5185\u5bb9\u524d\u60f3\u786e\u8ba4\u201c\u6e38\u620f\u771f\u8bfb\u4e0d\u8bfb\u8fd9\u4e2a\u5b57\u6bb5\u3001\u600e\u4e48\u8bfb\u201d\u65f6\u7528\u5b83\uff0c\u907f\u514d\u5199\u6e38\u620f\u8bfb\u4e0d\u5230\u7684\u5b57\u6bb5\u3002',
      parameters: { type: 'object', properties: { field: { type: 'string', description: '\u5b57\u6bb5\u540d\uff08\u53ef\u9009\uff0c\u4e0d\u586b\u8fd4\u56de\u5168\u5b57\u6bb5\u7d22\u5f15\uff09' } } }
    },
    {
      name: 'genReference',
      description: '\u67e5\u8001\u5267\u672c\u7f16\u8f91\u5668\u5bf9\u67d0\u90e8\u5206\u7684 AI \u751f\u6210\u8303\u5f0f\uff08\u53c2\u8003"\u8be5\u90e8\u5206\u597d\u5185\u5bb9\u5e94\u6709\u4ec0\u4e48"\uff1a\u8981\u6c42/\u5b57\u6bb5\u5f62\u72b6/\u671d\u4ee3\u7279\u5b9a\u903b\u8f91/\u53c2\u6570\u533a\u95f4\uff09\u3002part \u4f20 key(characters/factions/military/economyConfig/worldSettings/officeTree/vassalSystem...) \u6216\u4e2d\u6587\u6807\u7b7e(\u4eba\u7269/\u52bf\u529b/\u519b\u4e8b/\u7ecf\u6d4e...)\uff1b\u4e0d\u4f20\u8fd4\u56de\u6240\u6709\u53ef\u53c2\u8003\u90e8\u5206\u5217\u8868\u3002\u751f\u6210\u6216\u5927\u6539\u67d0\u90e8\u5206\u524d\u5148 genReference \u770b\u4e00\u773c\u8001\u8303\u5f0f\uff0c\u501f\u9274\u5176\u8bbe\u5b9a\u6df1\u5ea6\uff08\u4f60\u662f\u5de5\u5177\u6d41\uff0c\u522b\u7167\u6284"\u53ea\u8f93\u51faJSON"\u683c\u5f0f\uff09\u3002',
      parameters: { type: 'object', properties: { part: { type: 'string', description: '\u90e8\u5206 key \u6216\u4e2d\u6587\u6807\u7b7e\uff08\u53ef\u9009\uff0c\u4e0d\u586b\u8fd4\u56de\u90e8\u5206\u5217\u8868\uff09' } } }
    },
    {
      name: 'readSource',
      description: '\u8bfb\u53d6\u6b63\u5f0f\u6e38\u620f/\u7f16\u8f91\u5668\u7684\u6e90\u7801\u6587\u4ef6\uff08\u6309 path\uff0c\u8fd4\u56de\u5e26\u884c\u53f7\u7247\u6bb5\uff09\u3002\u60f3\u786e\u8ba4\u6e38\u620f UI/\u903b\u8f91\u600e\u4e48\u7528\u67d0\u5b57\u6bb5\u3001\u67d0\u673a\u5236\u600e\u4e48\u5b9e\u73b0\u65f6\u76f4\u63a5\u8bfb\u6e90\u7801\u3002path \u5982 "tm-endturn.js" / "phase8-formal-modules.js"\u3002\u6587\u4ef6\u5927\u65f6\u7528 offset/limit \u7ffb\u9875\u3002',
      parameters: { type: 'object', properties: { path: { type: 'string', description: '\u6587\u4ef6\u76f8\u5bf9\u8def\u5f84' }, offset: { type: 'number', description: '\u8d77\u59cb\u884c(\u4ece0,\u9ed8\u8ba40)' }, limit: { type: 'number', description: '\u8bfb\u591a\u5c11\u884c(\u9ed8\u8ba4250,\u4e0a\u9650400)' } }, required: ['path'] }
    },
    {
      name: 'listSource',
      description: '\u5217\u51fa\u4ee3\u7801\u5e93\u91cc\u7684\u6e90\u7801\u6587\u4ef6\u6e05\u5355\uff08\u53ef\u7528 filter \u5b50\u4e32\u8fc7\u6ee4\uff0c\u5982 "tm-" / "phase8" / ".html"\uff09\u3002\u4e0d\u77e5\u9053\u67d0\u529f\u80fd\u5728\u54ea\u4e2a\u6587\u4ef6\u65f6\u5148 listSource \u627e\uff0c\u518d readSource \u8bfb\u3002',
      parameters: { type: 'object', properties: { filter: { type: 'string', description: '\u6587\u4ef6\u540d\u5b50\u4e32\u8fc7\u6ee4(\u53ef\u9009)' } } }
    },
    {
      name: 'grepSource',
      description: '\u5728\u6e90\u7801\u91cc\u5168\u5c40\u641c\u5b57\u7b26\u4e32\uff08\u8de8\u6587\u4ef6 grep\uff09\uff0c\u8fd4\u56de\u547d\u4e2d\u7684 \u6587\u4ef6+\u884c\u53f7+\u8be5\u884c\u5185\u5bb9\u3002\u627e"\u67d0\u5b57\u6bb5\u5728\u54ea\u88ab\u8bfb\u3001\u67d0\u51fd\u6570\u5728\u54ea\u5b9a\u4e49"\u65f6\u7528\u3002\u53ef\u7528 glob \u9650\u5b9a\u6587\u4ef6\u5b50\u4e32\u3001maxFiles \u9650\u626b\u63cf\u6570\u3002',
      parameters: { type: 'object', properties: { query: { type: 'string', description: '\u8981\u641c\u7684\u5b57\u7b26\u4e32' }, glob: { type: 'string', description: '\u53ea\u641c\u6587\u4ef6\u540d\u542b\u6b64\u5b50\u4e32\u7684\u6587\u4ef6(\u53ef\u9009)' }, maxFiles: { type: 'number', description: '\u6700\u591a\u626b\u51e0\u4e2a\u6587\u4ef6(\u9ed8\u8ba440,\u4e0a\u965080)' } }, required: ['query'] }
    },
    {
      name: 'listCollection',
      description: '总览某集合（紧凑列出名字+关键字段，不返回完整对象避免刷屏）。collection 如 characters/factions/parties；adminHierarchy 等对象映射返回键列表。',
      parameters: { type: 'object', properties: {
        collection: { type: 'string' }, limit: { type: 'number', description: '最多列几条（默认 40）' }
      }, required: ['collection'] }
    },
    {
      name: 'describeSchema',
      description: '查某类实体的完整字段形状（不填 kind 则列出所有可用类型）。kind 如 character/faction/troop/division/office/officePosition/event/variable；官制/官署/officeTree/官职图会自动映射到官方 officeTree 形状。',
      parameters: { type: 'object', properties: { kind: { type: 'string' } } }
    },
    {
      name: 'bulkAdd',
      description: '一次向集合批量追加多个实体（省往返，适合"生成 30 名人物"这类）。collection + items[]。',
      parameters: { type: 'object', properties: {
        collection: { type: 'string' }, items: { type: 'array', items: { type: 'object' } }
      }, required: ['collection', 'items'] }
    },
    {
      name: 'generateImage',
      description: '调用玩家配置的生图 API（tm_api_image·全游戏共用）生成一张图并写入指定字段（data URL）。适合人物画像（characters.N.portrait）、势力旗徽、场景意象。玩家未配生图 API 时会明确报错并引导配置——届时改用文字描述代替。',
      parameters: { type: 'object', properties: {
        path: { type: 'string', description: '写入路径·如 characters.3.portrait' },
        prompt: { type: 'string', description: '画面描述（中文可·写清人物气质/服制/构图）' },
        size: { type: 'string', description: '尺寸·默认 1024x1024' }
      }, required: ['path', 'prompt'] }
    },
    {
      name: 'copyField',
      description: '把一个字段的值原样复制到另一个字段（值不经过你的上下文·专治立绘/旗徽等大图 data URL 的复用挪移——generateImage 生成一次·copyField 多处复用零成本零重生）。享 applyEdit 同套权限/落账/回读。',
      parameters: { type: 'object', properties: {
        from: { type: 'string', description: '源字段路径·如 characters.3.portrait' },
        to: { type: 'string', description: '目标字段路径·如 factions.2.leaderPortrait' },
        reason: { type: 'string', description: '为何复制(短句·落历史)' }
      }, required: ['from', 'to'] }
    },
    {
      name: 'bulkUpdate',
      description: '按条件批量改一批实体的同一字段（「辽东诸将武力+5」「忠诚<30 的人物全+10」一步到位·免逐条拼路径）。where 多键=AND 全中才改·享 applyEdit 同套权限/落账。先小 limit 试敏感改动。',
      parameters: { type: 'object', properties: {
        collection: { type: 'string', description: '集合名·如 characters/factions/troops' },
        where: { type: 'object', description: '筛选条件·{字段:值}全等·值可为 {op:">|<|>=|<=|!=|contains", value:...} 比较对象·多键 AND·必填(空对象=全集·慎用)' },
        field: { type: 'string', description: '要改的字段(支持点路径如 attributes.morale)' },
        op: { type: 'string', enum: ['set', 'add', 'mul'] },
        value: { description: 'set=写入值·add/mul=数值增量/倍率(仅对数值字段生效·非数值项跳过并计数)' },
        limit: { type: 'number', description: '最多改多少条(可先 limit:3 试跑核对)' },
        reason: { type: 'string', description: '为何批改(落历史)' }
      }, required: ['collection', 'where', 'field', 'op'] }
    },
    {
      name: 'statsAggregate',
      description: '确定性数值聚合（不要 LLM 目测账本）：按 groupBy 分组·对 metrics 数值字段算 count/sum/avg/min/max。平衡审/配数值前先用它读真账（如按 faction 聚合 troops.soldiers·按势力算人物均武力）。',
      parameters: { type: 'object', properties: {
        collection: { type: 'string' },
        groupBy: { type: 'string', description: '分组字段(如 faction)·不填=整集合一组' },
        metrics: { type: 'array', items: { type: 'string' }, description: '数值字段名列表·支持点路径' },
        where: { type: 'object', description: '可选筛选·语法同 bulkUpdate.where' }
      }, required: ['collection', 'metrics'] }
    },
    {
      name: 'readQuickTestReport',
      description: '读最新一次「快测·playtest 前一键体检」报告（玩家在快测工作台点按钮后·真游戏带 key 启动+默认连跑 3 回合·每回合跑四类确定性体检:死人任职/幽灵键/账面守恒/叙事错名·逐回合累积）。报告新形态(schema:2)：verdict.level=绿/黄/红总判·verdict.anomalies[]带 turn 回合号与 excerpt 原句/原账摘录·turns[]每回合含 health 四检结果·同时保留旧字段(bootOk/turnOk/turn/errors)向后兼容。大改后建议玩家跑一次快测·你据 verdict 与 anomalies 修真问题——这是唯一的运行时真后果来源(preflight 只是静态预测)。报告不存在=玩家尚未跑过。',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'multiEdit',
      description: '一次施加多处改动（省往返）。edits[]，每项 {path, value, reason?}。',
      parameters: { type: 'object', properties: {
        edits: { type: 'array', items: { type: 'object' } }
      }, required: ['edits'] }
    },
    {
      name: 'note',
      description: '记录一条计划/进度备注（不改剧本，只写进过程记录，便于多步任务自我规划、也让用户看到思路）。单条杂感用这个；≥3 步的任务改用 todoWrite。',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
    },
    {
      name: 'saveMemory',
      description: '存一条跨会话记忆（背景上下文·下次共事按需召回）。只存从当前剧本/对话推导不出来的信息：user=玩家是谁与偏好；feedback=玩家给过的做法反馈(含为什么)；project=创作中的长线目标/未尽事宜；reference=玩家提过的外部资料指引。剧本里本来就有的数据、本次改动明细(有历史记录)不要存。与 recordConvention 分工：约定=每次都要遵守的显式规范；记忆=帮下次更懂上下文的背景。',
      parameters: { type: 'object', properties: {
        name: { type: 'string', description: '短横线风格短名(≤60字)·同名覆盖更新' },
        type: { type: 'string', enum: ['user', 'feedback', 'project', 'reference'] },
        description: { type: 'string', description: '一行摘要(召回时据此判断相关性·≤160字)' },
        body: { type: 'string', description: '记忆正文(≤1500字·写清事实与来龙去脉)' }
      }, required: ['name', 'type', 'description', 'body'] }
    },
    {
      name: 'useSkill',
      description: '展开一个技能(打磨过的操作指令包)的全文。系统提示里列了可用技能清单——要做对应事情时先展开再照做，别凭印象。',
      parameters: { type: 'object', properties: { name: { type: 'string', description: '技能名(照清单原文)' } }, required: ['name'] }
    },
    {
      name: 'saveSkill',
      description: '把一套可复用的做法沉淀成技能（下次同类任务可 useSkill 直接展开）。body 写成可照做的分步指令；只在做法确实打磨成型、值得复用时存，别把一次性方案存进来。',
      parameters: { type: 'object', properties: {
        name: { type: 'string' },
        description: { type: 'string', description: '一行说明这技能做什么' },
        whenToUse: { type: 'string', description: '什么时候该用它(清单里显示这句)' },
        body: { type: 'string', description: '分步操作指令全文(≤4000字)' }
      }, required: ['name', 'body'] }
    },
    {
      name: 'todoWrite',
      description: '结构化任务表（整表替换·不改剧本）。≥3 步的任务先用它列计划，每完成一步立即把该项标 completed（勿囤到最后一起标），恰保持一项 in_progress。全部 completed 时表自动清空。计划有变直接重写整表。单步小事别用。',
      parameters: { type: 'object', properties: {
        todos: { type: 'array', description: '整张任务表(替换式)', items: { type: 'object', properties: {
          content: { type: 'string', description: '祈使句·做什么(如「补齐辽东三将的属性」)' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
          activeForm: { type: 'string', description: '进行时短语(如「正在补齐辽东三将」)·选填' }
        }, required: ['content', 'status'] } }
      }, required: ['todos'] }
    },
    {
      name: 'askClarification',
      description: '当用户需求含糊到无法动手（缺关键信息：放哪个势力 / 侧重什么属性 / 数量 / 风格 / 时代背景等）时，提出 1-3 个具体问题让玩家先回答，再继续。需求已经清楚就别用、直接做，别没事找事问。',
      parameters: { type: 'object', properties: {
        questions: { type: 'array', items: { type: 'string' }, description: '1-3 个具体、好回答的问题' }
      }, required: ['questions'] }
    },
    {
      name: 'remonstrate',
      description: '进谏：当玩家需求确有硬伤（明显违背史实／会致某势力开局即崩盘或数值严重失衡／把某朝专名当通用机制违反朝代中立）时，先说清利害＋给一个可一键采纳的替代方案，停下来等玩家定夺，别默默照做。只在确有硬伤时用，别动辄劝阻；玩家坚持的尊重其最终决定。',
      parameters: { type: 'object', properties: {
        concern: { type: 'string', description: '这个需求的硬伤是什么、会导致什么后果（一两句，具体到实体/字段）' },
        severity: { type: 'string', enum: ['史实', '平衡', '机制'], description: '硬伤类型：史实存疑／数值平衡／跨朝代机制' },
        suggestion: { type: 'string', description: '一个可行的替代方案（玩家可一键采纳）' }
      }, required: ['concern', 'suggestion'] }
    },
    {
      name: 'flagUncertain',
      description: '当你某处改动没把握（史实存疑、玩家可能想要别的、靠推测填充的内容）时，标记该路径，提醒玩家重点复核。只标真没把握的，别滥用。',
      parameters: { type: 'object', properties: {
        path: { type: 'string', description: '没把握的改动路径，如 characters[3].bio 或 factions[1].leader' },
        reason: { type: 'string', description: '为什么没把握（一句话）' }
      }, required: ['path', 'reason'] }
    },
    {
      name: 'checkHistory',
      description: '自查证：在写入涉及具体史实的内容（年号纪年、人物生卒/年龄、职官名称品级、重大事件时间地点）前，先把你将依据的关键史实逐条列出并自评把握。把握高的照写；把握低/拿不准的，落字用保守措辞（约/相传/据载）并对该路径 flagUncertain，别编成确定口吻。无外部资料时这是自我审视，治"自信地编"，但变不出你本就不知道的事。',
      parameters: { type: 'object', properties: {
        facts: { type: 'array', description: '要核验的史实声明清单', items: { type: 'object', properties: {
          claim: { type: 'string', description: '一条具体史实，如"张居正卒于1582年"' },
          verdict: { type: 'string', enum: ['确信', '存疑', '不确定'], description: '你对这条的把握' },
          note: { type: 'string', description: '依据或存疑点（可选）' }
        }, required: ['claim', 'verdict'] } }
      }, required: ['facts'] }
    },
    {
      name: 'recordConvention',
      description: '当你发现这个玩家/剧本有一条值得长期沿用的约定（命名规律、文风、设定惯例等）时记一条，供以后所有编辑参考。仅在确有发现时调用，别凑数。',
      parameters: { type: 'object', properties: { convention: { type: 'string', description: '一句话约定，如"人名统一用明代官话""势力名带地名后缀"' } }, required: ['convention'] }
    },
    {
      name: 'finish',
      description: '剧本已按要求改好且校验通过时调用，结束本次编辑。',
      parameters: { type: 'object', properties: {
        summary: { type: 'string', description: '向玩家说清「改了什么、为什么这么改」：点出关键实体/字段，2-4 句中文，别只写"完成"' }
      } }
    }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  S5 · prompt 资产：实体骨架 + schema 速查（让 agent 用对字段名、守约束）
  // ═══════════════════════════════════════════════════════════════════

  var ENTITY_TEMPLATES = {
    character: { name: '', faction: '', factionId: '', officialTitle: '', loyalty: 80, ambition: 50, intelligence: 70, administration: 60, military: 50, age: 40, gender: '男', personality: '', bio: '' },
    faction: { name: '', leader: '', territory: '', strength: '', culture: '', goal: '', desc: '' },
    party: { name: '', leader: '', members: '', desc: '' },
    class: { name: '', desc: '' },
    troop: { name: '', commander: '', faction: '', location: '', soldiers: 10000, type: '' },
    division: { name: '', level: '', governor: '', population: { mouths: 0, households: 0 }, divisions: [] },
    // 官制节点是 officeTree[] 的元素，不是行政区划 division。官方天启剧本的
    // 形状以「部门 → positions[] → subs[]」为主，position 的 holder/员额/权责
    // 也属于可编辑数据；把它单列出来，避免模型把官制误套成 division。
    office: {
      id: '', name: '', desc: '',
      positions: [{
        name: '', rank: '', holder: '', establishedCount: 1, vacancyCount: 0,
        authority: '', succession: 'appointment', duties: '',
        perPersonSalary: '', salary: 0,
        bindingHint: '',
        publicTreasuryInit: { money: 0, grain: 0, cloth: 0, quotaMoney: 0, quotaGrain: 0, quotaCloth: 0 },
        privateIncome: { bonusType: '', illicitRisk: '' },
        powers: { appointment: false, impeach: false, supervise: false }
      }],
      subs: []
    },
    officePosition: {
      name: '', rank: '', holder: '', establishedCount: 1, vacancyCount: 0,
      authority: '', succession: 'appointment', duties: '',
      perPersonSalary: '', salary: 0,
      bindingHint: '',
      publicTreasuryInit: { money: 0, grain: 0, cloth: 0, quotaMoney: 0, quotaGrain: 0, quotaCloth: 0 },
      privateIncome: { bonusType: '', illicitRisk: '' },
      powers: { appointment: false, impeach: false, supervise: false }
    },
    event: { name: '', type: 'historical', trigger: '', desc: '' },
    variable: { name: '', defaultValue: 0, min: 0, max: 100, description: '' }
  };

  // 模型常把用户说的「官职图/官制」压缩成 office，或把 officeTree 当作实体
  // 类型传给 describeSchema。保留原始 kind 供 UI 显示，但统一映射到可用形状。
  var ENTITY_KIND_ALIASES = {
    office: 'office', offices: 'office', officetree: 'office', officeTree: 'office',
    department: 'office', departments: 'office',
    '官制': 'office', '官署': 'office', '官职图': 'office', '部门': 'office',
    position: 'officePosition', officeposition: 'officePosition',
    '官职': 'officePosition', '官位': 'officePosition', '职位': 'officePosition'
  };
  function _resolveEntityKind(kind) {
    var raw = String(kind == null ? '' : kind).trim();
    if (!raw) return '';
    if (ENTITY_TEMPLATES[raw]) return raw;
    var lower = raw.toLowerCase();
    return ENTITY_KIND_ALIASES[raw] || ENTITY_KIND_ALIASES[lower] || '';
  }

  // fieldContract 的输入是运行时字段名，而不是实体 kind。对常见官制说法做
  // 保守别名，只在原字段不存在时落到权威的 officeTree，避免把自定义 office
  // 字段静默改写掉。
  var FIELD_ALIASES = {
    office: 'officeTree', offices: 'officeTree', officetree: 'officeTree',
    '官制': 'officeTree', '官署': 'officeTree', '官职图': 'officeTree', '官职树': 'officeTree'
  };
  function _fieldCandidates(field) {
    var raw = String(field == null ? '' : field).trim();
    if (!raw) return [];
    var out = [raw], lower = raw.toLowerCase(), alias = FIELD_ALIASES[raw] || FIELD_ALIASES[lower];
    if (alias && out.indexOf(alias) < 0) out.push(alias);
    return out;
  }

  /** 剧本结构速查（注入 loop prompt·让模型用对字段名与形状、守硬约束）。 */
  function buildSchemaGuide(worldKind) {
    var T = ENTITY_TEMPLATES;
    var fiction = worldKind === 'fictional';
    // 顶层字段说明：虚构世界把 dynasty/emperor 解读为「自拟政权/时代名」与「该世界最高统治者」，不要求真实朝代帝王。
    var topLine = fiction
      ? '- 顶层：name(剧本名) dynasty(时代/政权名·虚构世界填自拟名，如「天元历」「苍穹帝国」「魔历三千年」) emperor(最高统治者/主君·填该世界的君主或领袖名) overview(世界观概述) startYear playerInfo gameSettings'
      : '- 顶层：name(剧本名) dynasty(朝代) emperor(帝王) overview(概述) startYear playerInfo gameSettings';
    return [
      '【剧本结构速查】（applyEdit/applyPush 时遵循这些字段名与形状）',
      topLine,
      '  ※ 时间务必写入 gameSettings.startYear / gameSettings.startMonth（引擎权威读此·只写顶层 startYear 会导致进游戏显示公元前）' + (fiction ? '。虚构世界亦可用自拟纪年，但 startYear 仍填一个数字年份作引擎锚点（纪年显示名走 gameSettings.eraNames）。' : ''),
      // 世界观容器（朝代中立·原本不在速查里·虚构/架空世界尤需用它承载背景设定）
      '- world{history,politics,economy,military,culture,glossary,entries,rules} / worldSettings{culture,weather,religion,economy,technology,diplomacy}（世界观容器·把时代背景、地理山川、势力源流、力量/科技体系、特殊规则等写这里' + (fiction ? '——虚构世界的设定主要落在这两处，先把世界观立住再填人物势力' : '') + '）',
      '- factions[]（势力）: ' + JSON.stringify(T.faction),
      '- characters[]（人物）: ' + JSON.stringify(T.character) + '  ← faction 必须等于某个 factions[].name' + (fiction ? '；虚构世界人物请置 isFictional:true（标记为原创人物）' : ''),
      '- parties[]（党派）: ' + JSON.stringify(T.party) + ' / classes[]（阶层）: ' + JSON.stringify(T['class']),
      '- military.initialTroops[]（开局部队）: ' + JSON.stringify(T.troop) + '  ← commander=人物名, faction=势力名',
      '- adminHierarchy{ "势力名":{ divisions:[ 区划 ] } }，区划递归含 .divisions；区划形如 ' + JSON.stringify(T.division),
      '- officeTree[]（官制部门）: 每项是 ' + JSON.stringify(T.office) + '；官方天启格式以 .positions[]（官职，含 holder/rank/员额/俸禄/bindingHint/公帑/私入/权责）和 .subs[]（下级部门）递归，官制节点不要套用 division',
      '- mapData.regions[]（地图区域，每个有 .name）；末级区划的 name 应能对上某个 region.name',
      '- variables.base[]（变量）: ' + JSON.stringify(T.variable),
      '- events.historical[]/random[]（事件）: ' + JSON.stringify(T.event),
      '【硬约束】① 中文显示名（人物/势力/地名）保持中文，禁止英译。',
      '② 人物/军队/地点引用的势力名必须在 factions 中存在。',
      '③ 行政区划父级 population.mouths 必须 >= 各子级 population.mouths 之和。'
    ].join('\n');
  }

  // ── 刀A · 懂规格·知缺口 ──
  // 读"游戏运行时要什么"的规格：新编辑器 RUNTIME_FIELD_SURFACES（{field,moduleId,required,title}）。
  // 优先 opts.fieldSurfaces；否则读运行时全局；都没有则空（旧编辑器 / node 下优雅降级）。
  function _getFieldSurfaces(opts) {
    if (opts && Array.isArray(opts.fieldSurfaces)) return opts.fieldSurfaces;
    try {
      var app = global.TM_SCENARIO_EDITOR_RESET_APP;
      if (app && Array.isArray(app.runtimeFieldSurfaces)) return app.runtimeFieldSurfaces;
    } catch (e) {}
    return [];
  }

  // 算规格缺口：规格里标 required/optional 的顶层字段，在草稿里缺失的。
  function _computeGaps(draft, surfaces) {
    draft = draft || {};
    var reqMiss = [], optMiss = [];
    (surfaces || []).forEach(function(s) {
      if (!s || !s.field || (s.field in draft)) return;
      var label = s.title ? (s.field + '(' + s.title + ')') : s.field;
      if (s.required) reqMiss.push(label); else optMiss.push(label);
    });
    return { requiredMissing: reqMiss, optionalMissing: optMiss };
  }

  /** 派发单个工具调用到 S1 工具，返回喂回模型的结果对象。 */
  // C2 · 源码读取（双通道：桌面 Electron 走 readWebFile IPC·浏览器走相对路径 fetch；node/无通道优雅降级）。让国师能读整个代码库。
  function _safeSrcPath(p) {
    // 拆 path 段、丢掉 '..'/'.'/空段再重组：堵路径穿越 + 前导 '//' 协议相对 URL 逃逸，保留合法文件名。
    return String(p || '').replace(/\\/g, '/').split('/').filter(function (x) { return x && x !== '..' && x !== '.'; }).join('/');
  }
  // 双通道「伪 Response」：桌面有 preload 桥（window.tianming.readWebFile·主进程代读热更感知的 web 根）就走 IPC
  // （编辑器跑在 file:// origin·Chromium fetch 机制性失败）；浏览器走相对路径 fetch（兼治 Pages 子路径托管 404）。
  // 返回 { ok, status, text(), json() } 最小 Response 形状，四个源码工具内部逻辑两通道共用。
  // 注意：新版剧本工坊在 preview/ 子目录。浏览器通道不能直接 fetch(rel)，否则
  // 会请求 preview/<rel>；先探测当前目录，再逐级回到 web 根。桌面端若 preload
  // 与 renderer 版本暂时不一致，也会在 IPC 失败后尝试浏览器通道，避免整组工具装死。
  var _sourceRootPrefix = null;
  var _sourceRootContext = '';
  function _sourceHasChannel() {
    return (typeof window !== 'undefined' && window.tianming && typeof window.tianming.readWebFile === 'function') || typeof fetch === 'function';
  }
  function _sourcePageBase() {
    try {
      if (typeof document !== 'undefined' && document.baseURI) return String(document.baseURI);
      if (typeof location !== 'undefined' && location.href) return String(location.href);
    } catch (_) {}
    return '';
  }
  function _sourcePageContext() {
    var base = _sourcePageBase();
    try {
      var u = new URL(base);
      u.search = '';
      u.hash = '';
      u.pathname = u.pathname.replace(/[^/]*$/, '');
      return u.toString();
    } catch (_) { return base; }
  }
  function _sourceBrowserPrefixes() {
    var out = [];
    var context = _sourcePageContext();
    if (_sourceRootPrefix != null && _sourceRootContext === context) return [_sourceRootPrefix];
    var base = _sourcePageBase();
    var pathName = '';
    try { pathName = new URL(base).pathname || ''; } catch (_) {}
    // 当前页面文件所在目录的深度；最多回退 4 层，避免把任意用户路径当作源码根。
    var depth = pathName.split('/').filter(Boolean).length;
    var maxUp = Math.min(4, Math.max(0, depth - 1));
    // 剧本工坊固定在 preview/ 下，源码清单在 web 根；优先试父目录，避免每次
    // 先请求一个必然不存在的 preview/source-manifest.json。其它托管布局仍保留
    // 当前目录与逐级回退候选。
    var preferredUp = pathName.indexOf('/preview/') >= 0 ? 1 : 0;
    if (preferredUp <= maxUp) out.push(new Array(preferredUp + 1).join('../'));
    for (var i = 0; i <= maxUp; i++) {
      var prefix = new Array(i + 1).join('../');
      if (out.indexOf(prefix) < 0) out.push(prefix);
    }
    if (!out.length) out.push('');
    return out;
  }
  function _sourceUnavailable(rel, causes) {
    var protocol = '';
    try { protocol = (new URL(_sourcePageBase()).protocol || '').toLowerCase(); } catch (_) {}
    var msg = protocol === 'file:'
      ? '源码读取不可用：当前工坊以 file:// 打开且桌面源码桥未加载。请从天命桌面客户端进入剧本工坊，或用 HTTP(S) 站点打开。'
      : '源码读取不可用：请检查工坊页面是否完整加载 source-manifest.json，以及当前网络/站点路径。';
    var e = new Error(msg + (causes ? '（' + causes + '）' : ''));
    e.code = 'TM_SOURCE_UNAVAILABLE';
    e.path = rel;
    return e;
  }
  function _sourceBrowserUrl(prefix, rel) {
    var base = _sourcePageBase();
    try { return new URL(prefix + rel, base || undefined).toString(); } catch (_) { return prefix + rel; }
  }
  function _sourceFetchBrowser(rel) {
    if (typeof fetch !== 'function') return Promise.reject(_sourceUnavailable(rel, '浏览器 fetch 不存在'));
    var prefixes = _sourceBrowserPrefixes(), failures = [];
    function attempt(i) {
      if (i >= prefixes.length) return Promise.reject(_sourceUnavailable(rel, failures.slice(0, 3).join('；')));
      var prefix = prefixes[i], url = _sourceBrowserUrl(prefix, rel);
      return Promise.resolve().then(function () { return fetch(url); }).then(function (r) {
        if (r && r.ok) { _sourceRootPrefix = prefix; _sourceRootContext = _sourcePageContext(); return r; }
        failures.push(url + ' HTTP ' + (r && r.status || 0));
        return attempt(i + 1);
      }, function (e) {
        failures.push((e && e.message) || String(e));
        return attempt(i + 1);
      });
    }
    return attempt(0);
  }
  function _sourceBridgeResponse(rel, res) {
    var ok = !!(res && res.success), text = ok ? String(res.text || '') : '';
    return {
      ok: ok,
      status: ok ? 200 : Number(res && res.status) || 404,
      error: ok ? '' : String((res && (res.error || res.reason)) || '桌面源码桥未返回文件'),
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); }
    };
  }
  function _srcFetchLike(rel) {
    if (typeof window !== 'undefined' && window.tianming && typeof window.tianming.readWebFile === 'function') {
      return Promise.resolve().then(function () { return window.tianming.readWebFile(rel); }).then(function (res) {
        var bridged = _sourceBridgeResponse(rel, res);
        // 404/旧 preload handler 缺失时再试浏览器通道；真实成功直接走 IPC，
        // 避免读取热更目录时相对 URL 指向错误。
        if (bridged.ok) return bridged;
        return _sourceFetchBrowser(rel).catch(function () { return bridged; });
      }).catch(function (bridgeError) {
        return _sourceFetchBrowser(rel).catch(function (browserError) {
          throw _sourceUnavailable(rel, [bridgeError && bridgeError.message, browserError && browserError.message].filter(Boolean).join('；'));
        });
      });
    }
    return _sourceFetchBrowser(rel);
  }
  function _readSourceTool(p, offset, limit) {
    if (!_sourceHasChannel()) return Promise.resolve({ ok: false, reason: '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u8bfb\u6e90\u7801\uff08\u8bf7\u5728\u684c\u9762\u5ba2\u6237\u7aef\u6216 HTTP(S) \u5de5\u574a\u4e2d\u6253\u5f00\uff09' });
    var safe = _safeSrcPath(p);
    if (!safe) return Promise.resolve({ ok: false, reason: '\u9700\u8981 path' });
    return _srcFetchLike(safe).then(function (r) {
      if (!r.ok) return { ok: false, reason: '\u8bfb\u53d6\u5931\u8d25 HTTP ' + r.status + '\uff1a' + safe + (r.error ? '（' + r.error + '）' : '') };
      return r.text().then(function (txt) {
        var lines = txt.split('\n');
        var off = Math.max(0, Number(offset) || 0);
        var lim = Math.min(400, Math.max(1, Number(limit) || 250));
        var slice = lines.slice(off, off + lim);
        return { ok: true, path: safe, totalLines: lines.length, from: off + 1, to: Math.min(lines.length, off + lim), content: slice.map(function (l, i) { return (off + i + 1) + '\t' + l; }).join('\n'), truncated: lines.length > off + lim };
      });
    }).catch(function (e) { return { ok: false, reason: '\u8bfb\u53d6\u51fa\u9519\uff1a' + ((e && e.message) || e) }; });
  }
  function _listSourceTool(filter) {
    if (!_sourceHasChannel()) return Promise.resolve({ ok: false, reason: '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u8bfb\u6e90\u7801\uff08\u8bf7\u5728\u684c\u9762\u5ba2\u6237\u7aef\u6216 HTTP(S) \u5de5\u574a\u4e2d\u6253\u5f00\uff09' });
    return _srcFetchLike('source-manifest.json').then(function (r) {
      if (!r.ok) return { ok: false, reason: '\u65e0\u6e90\u7801\u6e05\u5355\uff08source-manifest.json \u7f3a\u5931\uff1a' + (r.error || 'HTTP ' + r.status) + '\uff09' };
      return r.json().then(function (m) {
        var files = (m && m.files) || [];
        if (filter) { var lf = String(filter).toLowerCase(); files = files.filter(function (f) { return f.toLowerCase().indexOf(lf) >= 0; }); }
        return { ok: true, total: ((m && m.files) || []).length, matched: files.length, files: files.slice(0, 300) };
      });
    }).catch(function (e) { return { ok: false, reason: '\u6e05\u5355\u8bfb\u53d6\u51fa\u9519\uff1a' + ((e && e.message) || e) }; });
  }
  function _sourceIsDevPath(file) {
    return /^(?:dev-tools|scripts|tools)\//i.test(String(file || ''));
  }
  function _sourceIsReleaseExcludedPath(file) {
    var f = String(file || '');
    return _sourceIsDevPath(f) || /^test-results\//i.test(f) || /^(?:detect_globals|scan_globals|tm-test)\.js$/i.test(f);
  }
  function _sourceCandidateScore(file, query) {
    var f = String(file || '').toLowerCase();
    var rawQuery = String(query || '');
    var q = rawQuery.toLowerCase();
    var score = 0;
    if (!f || !q) return 0;
    if (f.indexOf(q) >= 0) score += 100;
    // camelCase/标点查询（如 GM.officeTree）按词拆开，优先能从文件名判断
    // 相关性的运行时代码；避免按 manifest 的历史字母序先扫大量旧工具脚本。
    var tokens = rawQuery.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean);
    tokens.forEach(function (token) {
      if (f.indexOf(token) >= 0) score += 20;
    });
    if (f.indexOf('editor-authoring-agent') >= 0) score += 8;
    if (_sourceIsDevPath(String(file))) score -= 90;
    return score;
  }
  function _grepSourceTool(query, opts) {
    opts = opts || {};
    if (!_sourceHasChannel()) return Promise.resolve({ ok: false, reason: '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u8bfb\u6e90\u7801\uff08\u8bf7\u5728\u684c\u9762\u5ba2\u6237\u7aef\u6216 HTTP(S) \u5de5\u574a\u4e2d\u6253\u5f00\uff09' });
    if (!query) return Promise.resolve({ ok: false, reason: '\u9700\u8981 query' });
    var maxFiles = Math.min(80, Math.max(1, Number(opts.maxFiles) || 40));
    var glob = opts.glob ? String(opts.glob).toLowerCase() : '';
    var q = String(query);
    return _srcFetchLike('source-manifest.json').then(function (r) {
      if (!r.ok) return Promise.reject(new Error('\u65e0\u6e90\u7801\u6e05\u5355\uff1a' + (r.error || 'HTTP ' + r.status)));
      return r.json();
    }).then(function (m) {
      var files = ((m && m.files) || []).filter(function (f) {
        return typeof f === 'string' && !!_safeSrcPath(f);
      });
      if (glob) files = files.filter(function (f) { return f.toLowerCase().indexOf(glob) >= 0; });
      var explicitExcludedGlob = /^(?:dev-tools|scripts|tools|test-results)\//i.test(glob);
      var scanFiles = explicitExcludedGlob ? files : files.filter(function (f) { return !_sourceIsReleaseExcludedPath(f); });
      // 兼容只含开发文件的定制清单：过滤后为空才回退全清单，不让工具失去可读性。
      if (!scanFiles.length) scanFiles = files;
      var ranked = scanFiles.map(function (f, index) {
        return { file: f, index: index, score: _sourceCandidateScore(f, q) };
      });
      var preferred = ranked.some(function (row) { return row.score > 0 && !_sourceIsDevPath(row.file); });
      ranked.sort(function (a, b) {
        var as = a.score, bs = b.score;
        if (preferred) {
          if (_sourceIsDevPath(a.file)) as -= 25;
          if (_sourceIsDevPath(b.file)) bs -= 25;
        }
        return bs - as || a.index - b.index;
      });
      var scan = ranked.slice(0, maxFiles).map(function (row) { return row.file; });
      var hits = [], attemptedFiles = 0, scannedFiles = 0, failedFiles = [];
      return scan.reduce(function (chain, f) {
        return chain.then(function () {
          if (hits.length >= 50) return;
          attemptedFiles++;
          return _srcFetchLike(f).then(function (rr) {
            if (!rr || !rr.ok) { failedFiles.push(f); return ''; }
            scannedFiles++;
            return rr.text();
          }).then(function (txt) {
            var ls = txt.split('\n');
            for (var i = 0; i < ls.length && hits.length < 50; i++) { if (ls[i].indexOf(q) >= 0) hits.push({ file: f, line: i + 1, text: ls[i].trim().slice(0, 180) }); }
          }).catch(function () {
            if (failedFiles.indexOf(f) < 0) failedFiles.push(f);
          });
        });
      }, Promise.resolve()).then(function () {
        if (!scannedFiles && attemptedFiles) {
          var unavailable = _sourceUnavailable('source-manifest.json', '清单中的源码文件均无法读取');
          return { ok: false, errorCode: unavailable.code, query: q, attemptedFiles: attemptedFiles, failedFiles: failedFiles, reason: unavailable.message };
        }
        return { ok: true, query: q, scannedFiles: scannedFiles, attemptedFiles: attemptedFiles, failedFiles: failedFiles, matchedTotal: files.length, candidateFiles: scanFiles.length, hits: hits };
      });
    }).catch(function (e) { return { ok: false, reason: 'grep \u51fa\u9519\uff1a' + ((e && e.message) || e) }; });
  }

  // D1 \u00b7 \u8001\u7f16\u8f91\u5668\u5404\u90e8\u5206 AI \u751f\u6210\u8303\u5f0f\uff08\u5b9e\u65f6\u8bfb editor-fullgen.js \u7684 33 \u4e2a\u751f\u6210\u6b65\uff0c\u96f6\u590d\u5236\u96f6\u6f02\u79fb\uff09\u3002
  function _genReferenceTool(part, worldKind) {
    if (!_sourceHasChannel()) {
      var unavailable = _sourceUnavailable('source-manifest.json', '当前页面没有可用的桌面文件桥或 HTTP(S) 源码通道');
      return Promise.resolve({ ok: false, errorCode: unavailable.code, path: unavailable.path, reason: unavailable.message });
    }
    // \u865a\u6784/\u67b6\u7a7a\u4e16\u754c\u89c2\uff1a\u8001\u7f16\u8f91\u5668\u8303\u5f0f\u6309\u53f2\u5b9e\u5267\u672c\u5199\u5c31\uff0c\u4ec5\u501f\u9274\u5b57\u6bb5\u5f62\u72b6/\u8bbe\u5b9a\u6df1\u5ea6\uff0c\u53f2\u5b9e\u8003\u636e\u8981\u6c42\u987b\u4e2d\u548c\u3002
    var fictionNote = worldKind === 'fictional'
      ? '\uff08\u6ce8\u610f\uff1a\u672c\u5267\u672c\u662f\u3010\u865a\u6784/\u67b6\u7a7a\u4e16\u754c\u89c2\u3011\u3002\u4ee5\u4e0a\u8303\u5f0f\u6309\u53f2\u5b9e\u5267\u672c\u5199\u5c31\uff0c\u4f60\u53ea\u501f\u9274\u5176\u5b57\u6bb5\u5f62\u72b6\u3001\u8bbe\u5b9a\u6df1\u5ea6\u3001\u6570\u503c\u533a\u95f4\uff1b\u5176\u4e2d\u300c\u51e1\u300a\u4e8c\u5341\u56db\u53f2\u300b\u6709\u4f20\u2192type\u5fc5\u987bhistorical\u300d\u300cbio\u987b\u5f15\u6b63\u53f2\u53f2\u6599\u300d\u300c\u6570\u503c\u5fc5\u987b\u57fa\u4e8e\u53f2\u5b9e\u300d\u7b49\u771f\u5b9e\u5386\u53f2\u8003\u636e\u8981\u6c42\u4e00\u5f8b\u5ffd\u7565\u2014\u2014\u4eba\u7269\u6309\u539f\u521b\u521b\u4f5c\u3001type \u4e00\u5f8b\u586b "fictional"\u3001\u6570\u503c\u6309\u8be5\u4e16\u754c\u8bbe\u5b9a\u81ea\u6d3d\u8bc4\u4f30\u3001bio \u5199\u539f\u521b\u5c0f\u4f20\u4e0d\u5fc5\u5f15\u53f2\u6599\u3002\uff09'
      : '';
    function deU(x) { return String(x == null ? '' : x).replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }); }
    return _srcFetchLike('editor-fullgen.js').then(function (r) { return r.ok ? r.text() : ''; }).then(function (text) {
      if (!text) return { ok: false, reason: '\u8bfb\u4e0d\u5230 editor-fullgen.js' };
      var re = /\{\s*key\s*:\s*['"]([^'"]+)['"]\s*,\s*label\s*:\s*['"]([^'"]+)['"]/g, m, steps = [];
      while ((m = re.exec(text))) steps.push({ key: m[1], label: deU(m[2]), idx: m.index });
      if (!steps.length) return { ok: false, reason: 'editor-fullgen.js \u7ed3\u6784\u5df2\u53d8\uff0c\u672a\u627e\u5230\u751f\u6210\u6b65' };
      if (!part) return { ok: true, note: '\u8001\u7f16\u8f91\u5668\u5168\u91cf\u751f\u6210\u7684\u5404\u90e8\u5206\u8303\u5f0f\uff08\u4f20 part=key \u6216\u4e2d\u6587\u6807\u7b7e\u53d6\u8be5\u90e8\u5206\u63d0\u793a\u8bcd\u53c2\u8003\uff09', parts: steps.map(function (x) { return x.key + '\uff08' + x.label + '\uff09'; }) };
      var lp = String(part).toLowerCase();
      var hit = steps.filter(function (x) { return x.key.toLowerCase() === lp || x.label === part; })[0]
        || steps.filter(function (x) { return x.key.toLowerCase().indexOf(lp) >= 0 || x.label.indexOf(part) >= 0; })[0]
        || steps.filter(function (x) { return lp.indexOf(x.key.toLowerCase()) >= 0; })[0];
      if (!hit) return { ok: true, found: false, note: '\u6ca1\u627e\u5230\u300c' + part + '\u300d\uff0c\u53ef\u9009\u90e8\u5206\u89c1 parts', parts: steps.map(function (x) { return x.key + '(' + x.label + ')'; }) };
      var nextIdx = steps.filter(function (x) { return x.idx > hit.idx; }).map(function (x) { return x.idx; }).sort(function (a, b) { return a - b; })[0];
      var end = nextIdx || Math.min(text.length, hit.idx + 3500);
      var block = text.slice(hit.idx, Math.min(end, hit.idx + 3500));
      return { ok: true, found: true, part: hit.key, label: hit.label, file: 'editor-fullgen.js', guide: '\u8001\u7f16\u8f91\u5668\u751f\u6210\u300c' + hit.label + '\u300d\u7684\u63d0\u793a\u8bcd+\u6821\u9a8c\u53c2\u8003\u2014\u2014\u501f\u9274\u5176\u8bbe\u5b9a\u6df1\u5ea6/\u5b57\u6bb5\u5f62\u72b6/\u671d\u4ee3\u903b\u8f91/\u53c2\u6570\u533a\u95f4\uff1b\u4f60\u662f\u5de5\u5177\u6d41\uff0c\u522b\u7167\u6284"\u53ea\u8f93\u51faJSON"\u3002' + fictionNote, reference: deU(block) };
    }).catch(function (e) { return { ok: false, reason: '\u8bfb\u53d6\u51fa\u9519\uff1a' + ((e && e.message) || e) }; });
  }

  // 地图 op 辅助（刀5）：解析势力名→键、模糊定位地块、镜像同步
  function _mapResolveFaction(draft, q) {
    var key = String(q == null ? '' : q).trim();
    if (!key) return { key: '', label: '' };
    var map = (draft && draft.map) || {};
    var facs = map.factions;
    if (facs && typeof facs === 'object' && !Array.isArray(facs)) {
      if (facs[key]) return { key: key, label: (facs[key] && facs[key].name) || key };
      for (var k in facs) { if (facs[k] && facs[k].name === key) return { key: k, label: key }; }
    }
    var arr = Array.isArray(draft && draft.factions) ? draft.factions : [];
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i]; if (!f) continue;
      if (f.id === key || f.key === key || f.sid === key || f.stableId === key || f.name === key) {
        return { key: f.stableId || f.key || f.id || f.sid || f.name, label: f.name || key };
      }
    }
    return { key: key, label: key };
  }
  function _mapFindRegionIndex(regions, q) {
    q = String(q == null ? '' : q).trim();
    if (!q) return -1;
    var i, r;
    for (i = 0; i < regions.length; i++) { r = regions[i]; if (r && (r.id === q || r.name === q || r.adminBinding === q || r.mapRegionId === q)) return i; }
    for (i = 0; i < regions.length; i++) {
      r = regions[i]; if (!r) continue;
      var nm = String(r.name || ''), ab = String(r.adminBinding || '');
      if (nm && (nm.indexOf(q) >= 0 || q.indexOf(nm) >= 0)) return i;
      if (ab && (ab.indexOf(q) >= 0 || q.indexOf(ab) >= 0)) return i;
    }
    return -1;
  }
  function _mapSyncMirror(draft) {
    try { if (draft && draft.map && typeof draft.map === 'object' && draft.mapData && typeof draft.mapData === 'object') draft.mapData = JSON.parse(JSON.stringify(draft.map)); } catch (e) {}
  }

  // 截断过大值给 LLM 看(原始小值原样返回·大对象/数组转成截断预览+规模提示·控上下文)
  function _truncForLLM(v, max) {
    max = max || 600;
    if (v == null || typeof v !== 'object') return v;
    try {
      var s = JSON.stringify(v);
      if (s.length <= max) return v;
      if (Array.isArray(v)) return { _truncated: true, length: v.length, preview: s.slice(0, max) + '…' };
      return { _truncated: true, keys: Object.keys(v).slice(0, 20), preview: s.slice(0, max) + '…' };
    } catch (e) { return String(v).slice(0, max); }
  }

  // 工具C · 容错自纠：未知工具名 → 推最接近的合法工具名(子串/编辑距离)·让 agent 一轮自纠不空耗
  function _editDist(a, b) {
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var prev = []; for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var cur = [i];
      for (var k = 1; k <= n; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function _suggestTool(name) {
    var n = String(name || '').toLowerCase();
    var names = AGENT_TOOLS.map(function (t) { return t.name; });
    var near = names.filter(function (t) { var lt = t.toLowerCase(); return n && (lt.indexOf(n) >= 0 || n.indexOf(lt) >= 0); });
    if (!near.length && n) near = names.map(function (t) { return { t: t, d: _editDist(n, t.toLowerCase()) }; }).sort(function (a, b) { return a.d - b.d; }).filter(function (x) { return x.d <= 5; }).slice(0, 2).map(function (x) { return x.t; });
    return near.slice(0, 3);
  }

  // 工具D · 上下文瘦身：把"早先轮次"的工具结果内容压成占位·只留最近 keepRecent 轮详尽·控上下文窗口(保 id/name·provider 配对不破)
  // 刀G2(2026-07-02·CC microcompact 对照)：同界限内连 assistant 的 toolCalls.input 一并压——
  //   bulkAdd(造30人)/multiEdit/大 applyEdit 的巨型入参此前永驻上下文·恰是最占体量的部分没被清。
  //   改动早已落进草稿·入参占位后如需现值 getField 即可·id/name 保留 provider 配对不破。
  function _compactOldToolResults(conv, keepRecent, inputMax) {
    if (!Array.isArray(conv)) return;
    inputMax = inputMax || 200;
    var idxs = []; for (var i = 0; i < conv.length; i++) if (conv[i] && conv[i].role === 'tool') idxs.push(i);
    var cut = idxs.length - keepRecent;
    if (cut <= 0) return;
    for (var j = 0; j < cut; j++) {
      var trs = conv[idxs[j]].toolResults || [];
      for (var k = 0; k < trs.length; k++) {
        var tr = trs[k];
        if (tr && typeof tr.content === 'string' && tr.content.length > 80 && tr.content.indexOf('[已省略') !== 0) tr.content = '[已省略·早先轮次结果·需要可重新查询]';
      }
    }
    var keepFrom = idxs[cut];   // 首个保留详尽的 tool 消息
    if (conv[keepFrom - 1] && conv[keepFrom - 1].role === 'assistant') keepFrom = keepFrom - 1;   // 其配对 assistant 入参一并保留(压结果与压入参界限对齐)
    for (var a = 0; a < keepFrom; a++) {
      var m = conv[a];
      if (!m || m.role !== 'assistant' || !Array.isArray(m.toolCalls)) continue;
      for (var b = 0; b < m.toolCalls.length; b++) {
        var tc = m.toolCalls[b];
        if (!tc || !tc.input || typeof tc.input !== 'object' || tc.input._compacted) continue;
        try {
          var sIn = JSON.stringify(tc.input);
          if (sIn.length > inputMax) tc.input = { _compacted: '[已省略·早先轮次入参·原' + sIn.length + '字·改动已落草稿·需要现值可 getField 查询]' };
        } catch (eIn) {}
      }
    }
  }

  // 刀G8(CC autocompact 对照) · 宏压缩两助手（微压缩不够/上下文超窗时·把旧对话换成结构化前情摘要）
  // 尾部保留切片：从末尾保 keepMsgs 条·起点对齐轮边界(落在 tool 消息上就前挪含入其配对 assistant·不孤儿化)
  function _compactTailSlice(conv, keepMsgs) {
    if (!Array.isArray(conv)) return [];
    if (keepMsgs <= 0) return [];
    if (conv.length <= keepMsgs) return conv.slice();
    var start = conv.length - keepMsgs;
    while (start > 0 && conv[start] && conv[start].role === 'tool') start--;
    return conv.slice(start);
  }
  // 拍平对话供摘要请求：逐条限长(防单条巨型)·超预算时保头 25% + 尾 75%(近事优先)·frac=相对当前体量的目标比例
  function _flattenForSummary(conv, frac) {
    var lines = [];
    for (var i = 0; i < (conv || []).length; i++) {
      var m = conv[i]; if (!m) continue;
      if (m.role === 'user') lines.push('[用户] ' + String(m.text || '').slice(0, 1500));
      else if (m.role === 'assistant') {
        var cs = (m.toolCalls || []).map(function (c) { var inp = ''; try { inp = JSON.stringify(c.input).slice(0, 280); } catch (e2) {} return c.name + inp; }).join(' · ');
        lines.push('[助手] ' + String(m.text || '').slice(0, 1200) + (cs ? ' 【调用】' + cs : ''));
      } else if (m.role === 'tool') {
        lines.push('[工具结果] ' + (m.toolResults || []).map(function (tr) { return String((tr && tr.content) || '').slice(0, 500); }).join(' | '));
      }
    }
    var s = lines.join('\n');
    var budget = Math.max(20000, Math.floor(s.length * (frac || 0.45)));
    if (s.length > budget) {
      var headKeep = Math.floor(budget * 0.25), tailKeep = budget - headKeep;
      s = s.slice(0, headKeep) + '\n……【中段 ' + (s.length - budget) + ' 字已略·以头尾与摘要要求为准】……\n' + s.slice(s.length - tailKeep);
    }
    return s;
  }

  // 工具B · 所有致变工具的唯一注册表。权限、指纹、写后回读共用，新增工具不会再漏过范围沙箱。
  var _MUT_TOOLS = { applyEdit: 1, applyPush: 1, multiEdit: 1, bulkAdd: 1, bulkUpdate: 1, removeEntity: 1, mapAssignOwner: 1, renameRegion: 1, renameEntity: 1, generateImage: 1, copyField: 1 };
  var _WRITE_TOOLS = _MUT_TOOLS;   // 兼容旧内部命名；不得另建第二份名单
  // 刀G3(2026-07-02·CC 对照) · 只读/致变工具表：重复读去重与"纯勘察打转"检测共用。
  //   validateDraft/preflight 亦只读——结果随草稿变·但去重有"期间零写入"守卫·天然安全。
  var _READ_TOOLS = { getField: 1, getFields: 1, searchEntities: 1, globalSearch: 1, findReferences: 1, listCollection: 1, describeSchema: 1, listGaps: 1, fieldContract: 1, genReference: 1, readSource: 1, listSource: 1, grepSource: 1, mapOverview: 1, checkHistory: 1, validateDraft: 1, preflight: 1, statsAggregate: 1, readQuickTestReport: 1 };
  var _TOOL_PACK_BY_NAME = {
    mapOverview: 'map', mapAssignOwner: 'map', renameRegion: 'map',
    genReference: 'history', readSource: 'history', listSource: 'history', grepSource: 'history', checkHistory: 'history',
    generateImage: 'media', copyField: 'media',
    bulkAdd: 'bulk', bulkUpdate: 'bulk', multiEdit: 'bulk', statsAggregate: 'bulk',
    readQuickTestReport: 'sandbox',
    saveMemory: 'knowledge', saveSkill: 'knowledge'
  };
  function _toolPack(name) { return _TOOL_PACK_BY_NAME[name] || 'core'; }
  function selectToolPacks(request, opts) {
    opts = opts || {};
    if (Array.isArray(opts.toolPacks)) return ['core'].concat(opts.toolPacks).filter(function(v, i, a) { return a.indexOf(v) === i; });
    var q = String(request || '').toLowerCase(), packs = ['core'];
    function add(p) { if (packs.indexOf(p) < 0) packs.push(p); }
    if ((opts.worldKind || '') === 'historical' || /史实|史料|考据|年代|年号|生卒|官职|历史|正史/.test(q)) add('history');
    if (/地图|地块|疆域|归属|版图|行政绑定|省份|州县/.test(q)) add('map');
    if (/图片|图像|立绘|头像|肖像|生图|插画|portrait/.test(q)) add('media');
    if (/批量|全部|统一|聚合|平均|统计|平衡数值|成批/.test(q)) add('bulk');
    if (/快测|沙盒|实跑|运行报告|回合测试/.test(q)) add('sandbox');
    if (/记住|记忆|沉淀|技能|以后都|下次/.test(q)) add('knowledge');
    return packs;
  }
  function _filterToolsByPacks(tools, request, opts) {
    if (opts && opts.toolPacks === false) return tools.slice();
    var packs = selectToolPacks(request, opts), allowed = {};
    packs.forEach(function(p) { allowed[p] = 1; });
    return tools.filter(function(t) { return !t || !t.name || !AGENT_TOOLS.some(function(a) { return a.name === t.name; }) || !!allowed[_toolPack(t.name)]; });
  }
  var AUTHORING_TOOL_SPECS = AGENT_TOOLS.map(function(t) {
    var effect = t.name === 'generateImage' ? 'external' : (_MUT_TOOLS[t.name] ? 'draft-write' : ((t.name === 'saveMemory' || t.name === 'saveSkill') ? 'memory-write' : (_READ_TOOLS[t.name] ? 'read' : 'control')));
    return Object.assign({}, t, {
      effect: effect, domain: _toolPack(t.name), pack: _toolPack(t.name),
      risk: /removeEntity|renameEntity|renameRegion/.test(t.name) ? 'high' : (effect === 'read' || effect === 'control' ? 'low' : 'medium'),
      idempotent: effect === 'read', rollback: effect === 'draft-write' ? 'draft-snapshot' : (effect === 'memory-write' ? 'staged-commit' : 'none')
    });
  });
  var AUTHORING_TOOL_REGISTRY = (global.TM && global.TM.AgentKernel && global.TM.AgentKernel.createRegistry)
    ? global.TM.AgentKernel.createRegistry(AUTHORING_TOOL_SPECS) : null;
  // 刀G4(2026-07-02·CC read-before-edit 新鲜度对照) · 外部修改防护:agent 运行期间用户可能在编辑器里
  //   手改草稿——按顶层区段留指纹·写前对照·外部改过则拒写要求重读(agent 自己的读/写都会刷新指纹)。
  //   注:CC 的"先读后写"门有意不搬——国师初始消息自带草稿摘要+写后有 nowValue 回读·硬加会拦正常流程。
  function _pathRoot(p) { return String(p || '').split('.')[0].split('[')[0]; }
  function _fpOf(v) {
    if (v === undefined) return '∅';
    try {
      var s = JSON.stringify(v); if (s == null) return '∅';
      var h = 0, stepN = Math.max(1, Math.floor(s.length / 97));
      for (var i = 0; i < s.length; i += stepN) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
      return s.length + ':' + h;
    } catch (e) { return 'err'; }
  }
  function _mutRoots(name, input) {
    input = input || {};
    var roots;
    switch (name) {
      case 'applyEdit': case 'applyPush': case 'removeEntity': case 'generateImage': roots = [_pathRoot(input.path)]; break;
      case 'copyField': roots = [_pathRoot(input.to)]; break;
      case 'multiEdit': roots = (Array.isArray(input.edits) ? input.edits : []).map(function (e) { return _pathRoot(e && e.path); }); break;
      case 'bulkAdd': case 'bulkUpdate': roots = [_pathRoot(input.collection)]; break;
      case 'mapAssignOwner': case 'renameRegion': roots = ['map', 'mapData']; break;
      default: return null;   // renameEntity 等跨区段·不做写前对照(写后全量刷新)
    }
    // map↔mapData 同步镜像:写一个连带另一个(_mapSyncMirror)·指纹须成双·否则自家写误报外部修改
    if (roots.indexOf('map') >= 0 || roots.indexOf('mapData') >= 0) { if (roots.indexOf('map') < 0) roots.push('map'); if (roots.indexOf('mapData') < 0) roots.push('mapData'); }
    return roots;
  }
  function _toolStateHash(draft, name, input) {
    if (!_MUT_TOOLS[name]) return null;
    var roots = _mutRoots(name, input);
    if (!roots) return _fpOf(draft);   // renameEntity 等跨区段工具用全草稿指纹
    var seen = {}, state = {};
    roots.forEach(function(r) { if (r && !seen[r]) { seen[r] = 1; state[r] = draft && draft[r]; } });
    return _fpOf(state);
  }
  function _readRootsOf(name, input) {
    input = input || {};
    switch (name) {
      case 'getField': return [_pathRoot(input.path)];
      case 'getFields': return (Array.isArray(input.paths) ? input.paths : []).map(_pathRoot);
      case 'listCollection': return [_pathRoot(input.collection || input.path)];
      case 'mapOverview': return ['map', 'mapData'];
      default: return [];
    }
  }
  function _attachWriteVerify(draft, name, input, result) {
    if (!result || result.ok === false || !_WRITE_TOOLS[name]) return result;
    try {
      if (name === 'applyEdit' || name === 'applyPush') {
        var rr = _resolvePath(draft, input.path);
        result.nowValue = _truncForLLM(rr && rr.value, 300);
      } else if (name === 'multiEdit') {
        var eds = Array.isArray(input.edits) ? input.edits : [];
        result.nowValues = eds.slice(0, 20).map(function (e) { var rr2 = (e && e.path) ? _resolvePath(draft, e.path) : null; return { path: e && e.path, value: _truncForLLM(rr2 && rr2.value, 140) }; });
      } else if (name === 'bulkAdd') {
        var rrc = _resolvePath(draft, input.collection);
        if (rrc && Array.isArray(rrc.value)) result.collectionLength = rrc.value.length;
      } else if (name === 'copyField') {
        var rcp = _resolvePath(draft, input.to);
        result.nowValue = _truncForLLM(rcp && rcp.value, 120);
      }
    } catch (e) {}
    return result;
  }

  // 刀②(2026-07-10 智能升级C)：bulkUpdate/statsAggregate 共用——where 匹配({k:v}全等·{op,value}比较·多键AND)与点路径取值
  function _bulkWhereMatch(item, where) {
    if (!item || !where || typeof where !== 'object') return false;
    return Object.keys(where).every(function (k) {
      if (_hasUnsafePathSegment(k)) return false;
      var cond = where[k];
      var val = _dottedValue(item, k);
      if (cond && typeof cond === 'object' && cond.op) {
        var cv = cond.value;
        switch (cond.op) {
          case '>': return Number(val) > Number(cv);
          case '<': return Number(val) < Number(cv);
          case '>=': return Number(val) >= Number(cv);
          case '<=': return Number(val) <= Number(cv);
          case '!=': return val !== cv;
          case 'contains': return String(val == null ? '' : val).indexOf(String(cv)) >= 0;
          default: return false;
        }
      }
      return val === cond;
    });
  }
  function _dottedValue(obj, path) {
    if (_hasUnsafePathSegment(path)) return undefined;
    var parts = String(path || '').split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) { if (cur == null || !_hasOwn(cur, parts[i])) return undefined; cur = cur[parts[i]]; }
    return cur;
  }

  function dispatchTool(draft, name, input, surfaces, runCtx) {
    input = input || {};
    switch (name) {
      case 'applyEdit': return applyEdit(draft, input.path, input.value, { reason: input.reason });
      case 'applyPush': return applyPush(draft, input.path, input.value);
      case 'removeEntity': return applyRemove(draft, input.path);
      case 'generateImage': {   // S4 · 生图模型为国师工作:tm_api_image 生成 → 复用 applyEdit 写回(享权限/指纹/回读全套)
        var _icfg = _loadImageApiConfig();
        if (!_icfg.key || !_icfg.url) return { ok: false, errorCode: 'image-api-missing', reason: '生图 API 未配置：请玩家在「API 设置 → 生图」里填好（存 tm_api_image）后再试；当前请改用文字描述该形象并写入相邻描述字段。' };
        if (!input.path || !input.prompt) return { ok: false, reason: '需要 path（写入字段·如 characters.3.portrait）与 prompt（画面描述）' };
        // 端点归一化：基址补 /v1/images/generations·完整端点原样用（与 tm-ai-infra ImageAPI.normalizeUrl 同规·勿漂移·治「填完整端点→双拼 /v1 → 404」）
        var _ibase = String(_icfg.url).replace(/\/+$/, '');
        if (!/\/images\/(generations|edits|variations)$/i.test(_ibase)) {
          if (!/\/v\d+(beta)?$/i.test(_ibase)) _ibase += '/v1';
          _ibase += '/images/generations';
        }
        return _fetchJSON(_ibase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _icfg.key },
          body: JSON.stringify({ model: _icfg.model || 'dall-e-3', prompt: String(input.prompt).slice(0, 1800), n: 1, size: input.size || '1024x1024', response_format: 'b64_json' })
        }, { maxRetries: 1, timeoutMs: 150000, signal: runCtx && runCtx.signal }).then(function (d) {
          var _it = d && d.data && d.data[0];
          var _val = (_it && _it.b64_json) ? ('data:image/png;base64,' + _it.b64_json) : (_it && _it.url);
          if (!_val) return { ok: false, reason: '生图 API 未返回图片（b64_json/url 皆空）' };
          var _w = applyEdit(draft, input.path, _val, { reason: '生图：' + String(input.prompt).slice(0, 40) });
          if (_w && _w.ok === false) return _w;
          return { ok: true, path: input.path, image: (_it && _it.b64_json) ? ('base64·约' + Math.round(_it.b64_json.length * 3 / 4 / 1024) + 'KB') : ('url·' + String(_it.url).slice(0, 60)), model: _icfg.model || 'dall-e-3' };
        }).catch(function (eG) { return { ok: false, reason: '生图失败：' + ((eG && eG.message) || eG) + '（可稍后重试或改用文字描述）' }; });
      }
      case 'copyField': {   // 生图复用（2026-07-10）：大值(立绘 data URL)经路径直拷·不过 LLM 上下文·复用 applyEdit 享权限/指纹/落账
        if (!input.from || !input.to) return { ok: false, reason: '需要 from（源字段路径）与 to（目标字段路径）' };
        var _cfr = _resolvePath(draft, input.from);
        if (!_cfr.parent || _cfr.value === undefined) return { ok: false, reason: 'from 字段不存在或为空: ' + input.from };
        var _cfw = applyEdit(draft, input.to, _cfr.value, { reason: input.reason || ('复制自 ' + input.from) });
        if (_cfw && _cfw.ok === false) return _cfw;
        var _cfsz = (typeof _cfr.value === 'string') ? _cfr.value.length : JSON.stringify(_cfr.value || '').length;
        var _cfimg = (typeof _cfr.value === 'string' && _cfr.value.indexOf('data:image') === 0);
        return { ok: true, from: input.from, to: input.to, copied: _cfimg ? ('图像·约' + Math.round(_cfsz * 3 / 4 / 1024) + 'KB') : ('值·' + _cfsz + '字符') };
      }
      case 'bulkUpdate': {   // 刀②(2026-07-10 智能升级C)：按条件批量改·逐条复用 applyEdit 享权限/指纹/落账
        var _buDraft = _agentClone(draft);
        var _buArr = _buDraft ? _buDraft[input.collection] : null;
        if (!Array.isArray(_buArr)) return { ok: false, reason: '集合不存在或非数组: ' + input.collection };
        if (!input.where || typeof input.where !== 'object') return { ok: false, reason: '需要 where 筛选条件(全集也须显式给空对象·防误伤)' };
        if (!input.field || ['set', 'add', 'mul'].indexOf(input.op) < 0) return { ok: false, reason: '需要 field 与合法 op(set/add/mul)' };
        var _buLimit = (typeof input.limit === 'number' && input.limit > 0) ? input.limit : 500;
        var _buWhereAll = Object.keys(input.where).length === 0;
        var _buChanged = [], _buSkipped = 0, _buMatched = 0, _buBlocked = null;
        for (var _bi = 0; _bi < _buArr.length; _bi++) {
          var _bit = _buArr[_bi];
          if (!_bit) continue;
          if (!_buWhereAll && !_bulkWhereMatch(_bit, input.where)) continue;
          _buMatched++;
          if (_buChanged.length >= _buLimit) continue;
          var _bOld = _dottedValue(_bit, input.field);
          var _bNew;
          if (input.op === 'set') { _bNew = input.value; }
          else {
            var _bBase = Number(_bOld), _bDelta = Number(input.value);
            if (!isFinite(_bBase) || !isFinite(_bDelta)) { _buSkipped++; continue; }
            _bNew = (input.op === 'add') ? (_bBase + _bDelta) : (_bBase * _bDelta);
          }
          var _bw = applyEdit(_buDraft, input.collection + '.' + _bi + '.' + input.field, _bNew, { reason: input.reason || ('批改 ' + input.field) });
          if (_bw && _bw.ok === false) { _buBlocked = _bw.reason || 'blocked'; break; }
          _buChanged.push({ name: (_bit.name || _bit.id || ('#' + _bi)), old: _bOld, next: _bNew });
        }
        if (_buBlocked) return { ok: false, atomic: true, reason: '批改中止(写入被拦): ' + _buBlocked + '·整批未落地', attemptedBeforeAbort: _buChanged.length };
        _replaceObjectContents(draft, _buDraft);
        var _buCapped = _buMatched - _buChanged.length - _buSkipped;
        return { ok: true, atomic: true, matched: _buMatched, changed: _buChanged.length, skippedNonNumeric: _buSkipped, cappedByLimit: _buCapped > 0 ? _buCapped : 0, sample: _buChanged.slice(0, 8) };
      }
      case 'readQuickTestReport': {   // 刀④乙(2026-07-10 智能升级A·2026-07-16 扩多回合体检)：读沙盒快测报告(★DB名/store/id='quickTestReport:latest' 与 scenario-editor-sandbox-bridge.js 镜像·改须同步·报告 schema:2 整体透传·加字段天然向后兼容)
        if (typeof global.indexedDB === 'undefined' || !global.indexedDB) return { ok: false, reason: '当前环境无 IndexedDB(需在编辑器页运行)·无法读快测报告' };
        return new Promise(function (resolve) {
          try {
            var _qtReq = global.indexedDB.open('tm-scenario-editor-reset-projects', 1);
            _qtReq.onupgradeneeded = function (ev) { var db = ev.target.result; if (!db.objectStoreNames.contains('projectBodies')) db.createObjectStore('projectBodies', { keyPath: 'id' }); };
            _qtReq.onsuccess = function (ev) {
              var db = ev.target.result;
              try {
                var tx = db.transaction('projectBodies', 'readonly');
                var g = tx.objectStore('projectBodies').get('quickTestReport:latest');
                g.onsuccess = function () {
                  db.close();
                  var rep = g.result && g.result.quickTest;
                  if (!rep) return resolve({ ok: false, reason: '尚无快测报告——请玩家在「正式沙盒测试」工作台点「快测·一键体检」(会真实消耗数轮 AI 调用·默认连跑 3 回合)·跑完再来读。' });
                  resolve({ ok: true, report: rep, ageHint: '报告生成于 ' + (rep.createdAt || '?') + '·若你之后又改过草稿·报告反映的是旧版本' });
                };
                g.onerror = function () { db.close(); resolve({ ok: false, reason: '快测报告读取失败' }); };
              } catch (eTx) { try { db.close(); } catch (_) {} resolve({ ok: false, reason: '快测报告读取异常: ' + ((eTx && eTx.message) || eTx) }); }
            };
            _qtReq.onerror = function () { resolve({ ok: false, reason: 'IndexedDB 打开失败' }); };
          } catch (eOpen) { resolve({ ok: false, reason: '快测报告读取异常: ' + ((eOpen && eOpen.message) || eOpen) }); }
        });
      }
      case 'statsAggregate': {   // 刀②：确定性数值聚合·平衡审读真账而非 LLM 目测
        var _saArr = draft ? draft[input.collection] : null;
        if (!Array.isArray(_saArr)) return { ok: false, reason: '集合不存在或非数组: ' + input.collection };
        var _saMetrics = Array.isArray(input.metrics) ? input.metrics.slice(0, 8) : [];
        if (!_saMetrics.length) return { ok: false, reason: '需要 metrics 数值字段列表' };
        var _saGroups = {};
        _saArr.forEach(function (it) {
          if (!it) return;
          if (input.where && typeof input.where === 'object' && Object.keys(input.where).length && !_bulkWhereMatch(it, input.where)) return;
          var _gv = input.groupBy ? _dottedValue(it, input.groupBy) : null;
          var g = input.groupBy ? String(_gv == null || _gv === '' ? '(空)' : _gv) : '(全部)';
          var slot = _saGroups[g] || (_saGroups[g] = { count: 0, metrics: {} });
          slot.count++;
          _saMetrics.forEach(function (mf) {
            var mv = Number(_dottedValue(it, mf));
            if (!isFinite(mv)) return;
            var ms = slot.metrics[mf] || (slot.metrics[mf] = { n: 0, sum: 0, min: Infinity, max: -Infinity });
            ms.n++; ms.sum += mv; if (mv < ms.min) ms.min = mv; if (mv > ms.max) ms.max = mv;
          });
        });
        var _saOut = {};
        Object.keys(_saGroups).slice(0, 40).forEach(function (g) {
          var slot = _saGroups[g]; var m = {};
          _saMetrics.forEach(function (mf) { var ms = slot.metrics[mf]; if (ms && ms.n) m[mf] = { n: ms.n, sum: Math.round(ms.sum * 100) / 100, avg: Math.round((ms.sum / ms.n) * 100) / 100, min: ms.min, max: ms.max }; });
          _saOut[g] = { count: slot.count, metrics: m };
        });
        return { ok: true, collection: input.collection, groupBy: input.groupBy || null, groups: Object.keys(_saGroups).length, stats: _saOut };
      }
      case 'getField': {
        var rr = _resolvePath(draft, input.path);
        if (!rr.parent) return { ok: false, reason: 'path not found: ' + input.path };
        return { ok: true, path: input.path, value: rr.value };
      }
      case 'getFields': {
        var _gpaths = Array.isArray(input.paths) ? input.paths : [];
        if (!_gpaths.length) return { ok: false, reason: '需要非空 paths[]（路径数组）' };
        var _gvals = _gpaths.slice(0, 40).map(function (p) {
          var rr2 = _resolvePath(draft, p);
          if (!rr2.parent) return { path: p, found: false };
          return { path: p, found: true, value: _truncForLLM(rr2.value, 600) };
        });
        return { ok: true, count: _gvals.length, values: _gvals };
      }
      case 'searchEntities': return _searchEntities(draft, input.collection, input.query);
      case 'globalSearch': return _globalSearch(draft, input.query, { limit: input.limit });
      case 'findReferences': return _findReferences(draft, input.name, { limit: input.limit });
      case 'renameEntity': return _renameEntity(draft, input.oldName, input.newName);
      case 'validateDraft': return validateDraft(draft, input.group);
      case 'preflight': { var pf = preflight(draft); return { ok: pf.ok, bootable: pf.bootable, summary: pf.summary, blockers: pf.blockers, warnings: pf.warnings.slice(0, 12) }; }
      case 'listGaps': {
        var gaps = _computeGaps(draft, surfaces || _getFieldSurfaces());
        if (!gaps.requiredMissing.length && !gaps.optionalMissing.length) {
          return { ok: true, requiredMissing: [], note: '无可用规格或无缺口（剧本必需字段已齐）' };
        }
        var out = { ok: true, requiredMissing: gaps.requiredMissing };
        if (input.includeOptional) out.optionalMissing = gaps.optionalMissing;
        return out;
      }
      case 'fieldContract': {
        var sv = surfaces || _getFieldSurfaces();
        if (!sv.length) return { ok: false, reason: '\u5f53\u524d\u73af\u5883\u65e0\u6e38\u620f\u5b57\u6bb5\u5951\u7ea6\uff08RUNTIME_FIELD_SURFACES \u672a\u66b4\u9732\uff09' };
        if (input.field) {
          var requestedField = String(input.field).trim();
          var candidates = _fieldCandidates(requestedField);
          var canonicalField = candidates.filter(function (f) { return sv.some(function (s) { return s && s.field === f; }); })[0] || requestedField;
          var hit = sv.filter(function (s) { return s && s.field === canonicalField; });
          if (!hit.length) return { ok: true, field: requestedField, inContract: false, note: '\u5b57\u6bb5\u300c' + requestedField + '\u300d\u4e0d\u5728\u6e38\u620f\u5b57\u6bb5\u5951\u7ea6\u4e2d\u2014\u2014\u53ef\u80fd\u662f\u81ea\u5b9a\u4e49/\u6269\u5c55\u5b57\u6bb5\uff0c\u6b63\u5f0f\u6e38\u620f\u4e0d\u76f4\u63a5\u8bfb\u53d6\u3002' };
          return { ok: true, field: canonicalField, requestedField: requestedField, canonicalField: canonicalField, inContract: true, contracts: hit.map(function (s) { return { name: s.title, required: !!s.required, module: s.moduleId, gameUse: s.detail || '', usedByScenarios: s.sources || [] }; }) };
        }
        return { ok: true, count: sv.length, fields: sv.map(function (s) { return s.field + (s.title ? '(' + s.title + ')' : '') + (s.required ? '\u00b7\u5fc5\u9700' : ''); }) };
      }
      case 'readSource': return _readSourceTool(input.path, input.offset, input.limit);
      case 'genReference': return _genReferenceTool(input.part, (draft && draft.worldKind === 'fictional') ? 'fictional' : 'historical');
      case 'mapOverview': {
        var _m = (draft && draft.map) || (draft && draft.mapData) || {};
        var _rg = Array.isArray(_m.regions) ? _m.regions : [];
        if (!_rg.length) return { ok: true, regions: [], note: '当前剧本没有 map.regions（可先去地图编辑器或新建地图）' };
        var _facList = [];
        if (_m.factions && typeof _m.factions === 'object' && !Array.isArray(_m.factions)) {
          _facList = Object.keys(_m.factions).map(function(k) { return k + (_m.factions[k] && _m.factions[k].name ? '(' + _m.factions[k].name + ')' : ''); });
        } else if (Array.isArray(draft.factions)) {
          _facList = draft.factions.slice(0, 40).map(function(f) { return (f.stableId || f.key || f.id || f.name) + (f.name ? '(' + f.name + ')' : ''); });
        }
        var _lim = Math.min(120, Number(input.limit) || 80);
        var _rows = _rg.slice(0, _lim).map(function(r, i) {
          return { i: i, id: r.id || '', name: r.name || '', owner: r.ownerKey || r.currentOwnerKey || r.controllerKey || '', adminBinding: r.adminBinding || '' };
        });
        return { ok: true, count: _rg.length, shown: _rows.length, factions: _facList.slice(0, 40), regions: _rows };
      }
      case 'mapAssignOwner': {
        var _mp = draft && draft.map;
        if (!_mp || !Array.isArray(_mp.regions) || !_mp.regions.length) return { ok: false, reason: '当前剧本没有 map.regions，无法改归属' };
        var _idx = _mapFindRegionIndex(_mp.regions, input.region);
        if (_idx < 0) return { ok: false, reason: '没找到地块「' + (input.region || '') + '」（用 mapOverview 看可用地块名）' };
        var _fac = _mapResolveFaction(draft, input.owner);
        var _region = _mp.regions[_idx];
        var _before = _region.ownerKey || _region.currentOwnerKey || '';
        _region.ownerKey = _fac.key;
        _region.currentOwnerKey = _fac.key;
        _region.controllerKey = _fac.key;
        _region.stableFactionId = _fac.key;
        if (_fac.label) { _region.factionName = _fac.label; _region.ownerName = _fac.label; }
        if (input.adminBinding != null && String(input.adminBinding).trim()) _region.adminBinding = String(input.adminBinding).trim();
        _mapSyncMirror(draft);
        return { ok: true, region: _region.name || _region.id || ('#' + _idx), from: _before, to: _fac.key + (_fac.label && _fac.label !== _fac.key ? '(' + _fac.label + ')' : ''), note: '已改归属（地图预览会按新势力上色）' };
      }
      case 'renameRegion': {
        var _mpr = draft && draft.map;
        if (!_mpr || !Array.isArray(_mpr.regions) || !_mpr.regions.length) return { ok: false, reason: '当前剧本没有 map.regions，无法改地块名' };
        var _to = String(input.newName == null ? '' : input.newName).trim();
        if (!_to) return { ok: false, reason: '需要 newName（新地块名）' };
        var _ridx = _mapFindRegionIndex(_mpr.regions, input.region);
        if (_ridx < 0) return { ok: false, reason: '没找到地块「' + (input.region || '') + '」（用 mapOverview 看可用地块名）' };
        var _rg2 = _mpr.regions[_ridx];
        var _oldNm = _rg2.name || '';
        _rg2.name = _to;
        var _abSynced = false;
        // 行政绑定原与显示名同名 → 一并更新保持一致
        if (_rg2.adminBinding != null && String(_rg2.adminBinding) === _oldNm) { _rg2.adminBinding = _to; _abSynced = true; }
        _mapSyncMirror(draft);
        return { ok: true, region: _rg2.id || ('#' + _ridx), from: _oldNm, to: _to, adminBinding: _rg2.adminBinding || '', note: '已改地块名并同步 map/mapData' + (_abSynced ? '（行政绑定一并更新）' : '') + '。如需把剧本里所有引用旧名「' + _oldNm + '」处都联动改掉，再用 renameEntity。' };
      }
      case 'listSource': return _listSourceTool(input.filter);
      case 'grepSource': return _grepSourceTool(input.query, { maxFiles: input.maxFiles, glob: input.glob });
      case 'listCollection': {
        var rrc = _resolvePath(draft, input.collection);
        var arr = rrc && rrc.value;
        if (Array.isArray(arr)) {
          var lim = Math.min(80, Number(input.limit) || 40);
          var rows = arr.slice(0, lim).map(function(it, i) {
            if (it && typeof it === 'object') {
              var label = it.name || it.id || it.title || ('#' + i);
              var extra = [];
              ['faction', 'leader', 'role', 'officialTitle', 'type', 'level'].forEach(function(k) { if (it[k] != null && it[k] !== '') extra.push(k + '=' + it[k]); });
              return label + (extra.length ? ' (' + extra.slice(0, 3).join(', ') + ')' : '');
            }
            return String(it);
          });
          return { ok: true, collection: input.collection, count: arr.length, shown: rows.length, items: rows };
        }
        if (arr && typeof arr === 'object') return { ok: true, collection: input.collection, count: Object.keys(arr).length, keys: Object.keys(arr).slice(0, 80) };
        return { ok: false, reason: '不是集合（数组/对象映射）: ' + input.collection };
      }
      case 'describeSchema': {
        if (!input.kind) return { ok: true, availableKinds: Object.keys(ENTITY_TEMPLATES) };
        var requestedKind = String(input.kind).trim();
        var canonicalKind = _resolveEntityKind(requestedKind);
        var tmpl = canonicalKind && ENTITY_TEMPLATES[canonicalKind];
        if (!tmpl) return { ok: false, reason: '未知实体类型: ' + requestedKind + '（可选: ' + Object.keys(ENTITY_TEMPLATES).join('/') + '；官制可用 office/officeTree/官职图）' };
        var note = canonicalKind === 'office'
          ? 'officeTree 是数组；此处返回一个官方部门节点形状，positions[] 是官职，subs[] 是下级部门。'
          : (canonicalKind === 'officePosition' ? 'officeTree[].positions[] 的官方官职条目形状。' : '');
        var outSchema = { ok: true, kind: requestedKind, canonicalKind: canonicalKind, template: tmpl, fields: Object.keys(tmpl) };
        if (note) outSchema.note = note;
        return outSchema;
      }
      case 'bulkAdd': {
        var items = Array.isArray(input.items) ? input.items : [];
        if (!input.collection || !items.length) return { ok: false, reason: '需要 collection 和非空 items[]' };
        var _baDraft = _agentClone(draft);
        var added = 0, addErrs = [];
        items.forEach(function(it, i) {
          var r = applyPush(_baDraft, input.collection, it);
          if (r && r.ok !== false) added++; else addErrs.push('#' + i + ': ' + ((r && r.reason) || 'fail'));
        });
        if (addErrs.length) return { ok: false, atomic: true, collection: input.collection, added: 0, attempted: added, errors: addErrs.slice(0, 5) };
        _replaceObjectContents(draft, _baDraft);
        return { ok: true, atomic: true, collection: input.collection, added: added, errors: [] };
      }
      case 'multiEdit': {
        var edits = Array.isArray(input.edits) ? input.edits : [];
        if (!edits.length) return { ok: false, reason: '需要非空 edits[]（每项 {path,value}）' };
        var _meDraft = _agentClone(draft);
        var done = 0, fails = [];
        edits.forEach(function(e, i) {
          if (!e || !e.path) { fails.push('#' + i + ': 缺 path'); return; }
          var r = applyEdit(_meDraft, e.path, e.value, { reason: e.reason });
          if (r && r.ok !== false) done++; else fails.push('#' + i + '(' + e.path + '): ' + ((r && r.reason) || 'fail'));
        });
        if (fails.length) return { ok: false, atomic: true, applied: 0, attempted: done, failures: fails.slice(0, 5) };
        _replaceObjectContents(draft, _meDraft);
        return { ok: true, atomic: true, applied: done, failures: [] };
      }
      case 'note': return { ok: true, note: String(input.text || '').slice(0, 500) };
      case 'saveMemory': {
        var _pm = _prepareMemoryEntry(input);
        if (!_pm.ok) return _pm;
        if (runCtx && Array.isArray(runCtx.sideEffects)) {
          runCtx.sideEffects.push({ type: 'memory', input: _agentClone(input) });
          return { ok: true, staged: true, saved: _pm.value.name, note: '将在玩家应用草稿时提交' };
        }
        return saveMemoryEntry(input);
      }
      case 'saveSkill': {
        var _ps = _prepareSkillEntry(input);
        if (!_ps.ok) return _ps;
        if (runCtx && Array.isArray(runCtx.sideEffects)) {
          runCtx.sideEffects.push({ type: 'skill', input: _agentClone(input) });
          return { ok: true, staged: true, saved: _ps.value.name, note: '将在玩家应用草稿时提交' };
        }
        return saveSkillEntry(input);
      }
      case 'useSkill': {
        var _sk = listAllSkills().find(function (s) { return s.name === String(input.name || '').trim(); });
        if (!_sk) return { ok: false, error: '无此技能', available: listAllSkills().map(function (s) { return s.name; }) };
        return { ok: true, skill: _sk.name, instructions: '【技能·' + _sk.name + '】以下是该技能的操作指令，按步骤照做：\n' + _sk.body };
      }
      case 'todoWrite': {   // 刀G5(2026-07-02·CC TodoWrite 对照) · 结构化任务表:整表替换·全完成自动清·成功消息自带用法再教育
        var _tds = Array.isArray(input.todos) ? input.todos : null;
        if (!_tds) return { ok: false, reason: 'todos 必须是数组(整表替换)·每项 {content, status, activeForm?}' };
        var _norm = [], _inProg = 0;
        for (var _ti = 0; _ti < _tds.length && _ti < 20; _ti++) {
          var _td = _tds[_ti];
          if (!_td || !_td.content || !_td.status) return { ok: false, reason: '第 ' + (_ti + 1) + ' 项缺 content/status·status 只能是 pending/in_progress/completed' };
          if (['pending', 'in_progress', 'completed'].indexOf(_td.status) < 0) return { ok: false, reason: '第 ' + (_ti + 1) + ' 项 status 非法「' + _td.status + '」·只能是 pending/in_progress/completed' };
          if (_td.status === 'in_progress') _inProg++;
          _norm.push({ content: String(_td.content).slice(0, 120), status: _td.status, activeForm: _td.activeForm ? String(_td.activeForm).slice(0, 60) : '' });
        }
        var _allDone = _norm.length > 0 && _norm.every(function (t) { return t.status === 'completed'; });
        _todoState.list = _allDone ? [] : _norm;
        var _tdMsg = _allDone
          ? '任务表全部完成·已自动清空。'
          : ('任务表已更新(' + _norm.length + ' 项·' + _inProg + ' 项进行中)。继续用它跟踪进度：每完成一步立即标 completed(勿囤批)·恰保持一项 in_progress。'
            + (_inProg > 1 ? '⚠ 当前 ' + _inProg + ' 项同时 in_progress·请收敛为一项。' : (_inProg === 0 ? '⚠ 没有 in_progress 项·请把正在做的那项标上。' : '')));
        return { ok: true, todos: _todoState.list.length, message: _tdMsg };
      }
      case 'askClarification': return { ok: true, clarify: true, questions: (Array.isArray(input.questions) ? input.questions : []).filter(Boolean).slice(0, 3) };
      case 'remonstrate': return { ok: true, remonstrate: true, concern: String(input.concern || ''), severity: String(input.severity || ''), suggestion: String(input.suggestion || '') };
      case 'flagUncertain': return { ok: true, flagged: String(input.path || ''), reason: String(input.reason || '') };
      case 'checkHistory': { var _hf = Array.isArray(input.facts) ? input.facts : []; var _hlow = _hf.filter(function (f) { return f && f.verdict && f.verdict !== '确信'; }).length; return { ok: true, checked: _hf.length, lowConfidence: _hlow, note: _hf.length ? ('已自核 ' + _hf.length + ' 条史实' + (_hlow ? '；其中 ' + _hlow + ' 条把握不足，落字请用保守措辞并对该路径 flagUncertain' : '；均有把握，可照写')) : '未提供史实清单' }; }
      case 'recordConvention': return { ok: true, recorded: String(input.convention || '').slice(0, 200) };
      case 'proposePlan': return { ok: true, plan: true, steps: Array.isArray(input.steps) ? input.steps : [], summary: input.summary || '' };
      case 'submitReview': return { ok: true, review: true, findings: Array.isArray(input.findings) ? input.findings : [], summary: input.summary || '' };
      case 'submitAnswer': return { ok: true, answered: true, answer: String(input.answer || '') };
      case 'submitExplanation': return { ok: true, explained: true, summary: input.summary || '', points: Array.isArray(input.points) ? input.points : [] };
      case 'finish': return { ok: true, finish: true, summary: input.summary || '' };
      default: {
        var _sug = _suggestTool(name);
        return { ok: false, reason: '未知工具: ' + name + (_sug.length ? '·你是否想用 ' + _sug.join(' / ') + '？' : '') + '（只能调用工具清单内的工具·勿臆造工具名）' };
      }
    }
  }

  /** 草稿顶层摘要（给模型看当前状态·避免塞整个对象） */
  function _draftSummary(draft) {
    var keys = Object.keys(draft || {});
    var counts = [];
    ['characters', 'factions', 'parties', 'classes', 'items'].forEach(function(k) {
      if (Array.isArray(draft[k])) counts.push(k + ':' + draft[k].length);
    });
    return '顶层字段: ' + keys.join(', ') + (counts.length ? '\n数组规模: ' + counts.join(' / ') : '');
  }

  // 方向J · 从（官方）剧本学习：抽取剧本现有实体作 few-shot 范例，锚定新内容的笔法与字段丰满度。
  // 编辑官方剧本(天启/绍宋)时这些即官方范例。开关式·空 scenario 返 ''。
  function buildExemplars(scenario, opts) {
    opts = opts || {};
    var perColl = opts.perColl || 1;
    var capEach = opts.capEach || 700;
    var colls = opts.collections || ['characters', 'factions', 'events'];
    var sc = scenario || {};
    var blocks = [];
    colls.forEach(function(coll) {
      var arr = sc[coll];
      if (!Array.isArray(arr) || !arr.length) return;
      var samples = [];
      for (var i = 0; i < arr.length && samples.length < perColl; i++) {
        var it = arr[i];
        if (!it || typeof it !== 'object') continue;
        var s = ''; try { s = JSON.stringify(it); } catch (e) { s = ''; }
        if (s) samples.push(s.length > capEach ? s.slice(0, capEach) + '…' : s);
      }
      if (samples.length) blocks.push('▸ ' + coll + ' 范例：\n' + samples.join('\n'));
    });
    return blocks.join('\n\n');
  }

  /** tool_result 内容文本（喂回模型）。带违规时明列，让 agent 知道修什么。 */
  function _resultToText(result) {
    if (!result) return '';
    if (result.violations && result.violations.length) return 'ok:false ' + (result.errorCode ? '[' + result.errorCode + '] ' : '') + (result.reason ? result.reason + ' · ' : '') + '违规: ' + result.violations.slice(0, 8).join('; ');   // 刀①·errorCode/reason 不再被违规清单挤掉(质量闸的「基线→现值」教学语要让模型看见)
    if (result.ok === false) return 'ok:false ' + (result.errorCode ? '[' + result.errorCode + '] ' : '') + (result.reason || '');   // 刀G9 · errorCode 让模型可见(错误分类可模式化自纠)
    return JSON.stringify(result).slice(0, 1200);
  }

  /** 稳定 system（规则 + schema 速查）——多轮间字节稳定，供 prompt caching。 */
  // 维度 · 计划模式：只读工具 + proposePlan（产出编号计划，不动手）
  var PROPOSE_PLAN_TOOL = {
    name: 'proposePlan',
    description: '提出改动计划：给出编号步骤（每步一句话，具体到字段/实体），结束计划阶段交玩家批准。计划模式下不要调用任何修改工具。',
    parameters: { type: 'object', properties: {
      summary: { type: 'string', description: '一句话总述' },
      steps: { type: 'array', items: { type: 'string' }, description: '编号步骤（字符串数组）' }
    }, required: ['steps'] }
  };
  function _planTools() {
    var readNames = { getField: 1, getFields: 1, fieldContract: 1, genReference: 1, readSource: 1, listSource: 1, grepSource: 1, searchEntities: 1, globalSearch: 1, findReferences: 1, listGaps: 1, listCollection: 1, describeSchema: 1, mapOverview: 1, statsAggregate: 1, readQuickTestReport: 1, validateDraft: 1, preflight: 1 };
    return AGENT_TOOLS.filter(function(t) { return readNames[t.name]; }).concat([PROPOSE_PLAN_TOOL]);
  }
  // 方向D · 审阅模式：只读工具 + submitReview（产出结构化体检报告，不动剧本）
  var SUBMIT_REVIEW_TOOL = {
    name: 'submitReview',
    description: '提交剧本审阅报告：给出总评 + 逐条问题（维度/严重度/定位/问题/建议），结束审阅。审阅模式下绝不调用任何修改工具。',
    parameters: { type: 'object', properties: {
      summary: { type: 'string', description: '一句话总评（整体成色 + 最该先修的点）' },
      findings: { type: 'array', description: '问题清单', items: { type: 'object', properties: {
        dimension: { type: 'string', description: '维度：平衡性/史实合理性/可玩性/死局风险/内容缺口/叙事 之一' },
        severity: { type: 'string', description: '严重度：高/中/低' },
        location: { type: 'string', description: '定位：涉及的实体/字段，如"势力·东林党"或"characters[3].aiPersona"' },
        issue: { type: 'string', description: '问题是什么' },
        suggestion: { type: 'string', description: '怎么改的建议' }
      } } }
    }, required: ['findings'] }
  };
  function _reviewTools() {
    // S11 · recordConvention 入审阅工具集：只产建议不动剧本·「/初始化约定」(Codex /init 对照)靠它总结剧本惯例
    var readNames = { getField: 1, getFields: 1, fieldContract: 1, genReference: 1, readSource: 1, listSource: 1, grepSource: 1, searchEntities: 1, globalSearch: 1, findReferences: 1, listGaps: 1, listCollection: 1, describeSchema: 1, mapOverview: 1, statsAggregate: 1, readQuickTestReport: 1, validateDraft: 1, preflight: 1, recordConvention: 1 };
    return AGENT_TOOLS.filter(function(t) { return readNames[t.name]; }).concat([SUBMIT_REVIEW_TOOL]);
  }
  // 方向L · 剧本问答：只读工具 + submitAnswer（查清后直接回答，不动剧本）
  var SUBMIT_ANSWER_TOOL = {
    name: 'submitAnswer',
    description: '用查到的事实回答玩家关于本剧本的问题，结束问答。问答模式下绝不调用任何修改工具。',
    parameters: { type: 'object', properties: {
      answer: { type: 'string', description: '基于剧本事实的回答（中文·具体·可点名相关实体/数字）' }
    }, required: ['answer'] }
  };
  function _qaTools() {
    var readNames = { getField: 1, getFields: 1, fieldContract: 1, genReference: 1, readSource: 1, listSource: 1, grepSource: 1, searchEntities: 1, globalSearch: 1, findReferences: 1, listGaps: 1, listCollection: 1, describeSchema: 1, mapOverview: 1, statsAggregate: 1, readQuickTestReport: 1 };
    return AGENT_TOOLS.filter(function(t) { return readNames[t.name]; }).concat([SUBMIT_ANSWER_TOOL]);
  }
  // 方向N · 解释/教学：只读工具 + submitExplanation（讲解剧本设计意图与机制脉络，不动剧本）
  var SUBMIT_EXPLANATION_TOOL = {
    name: 'submitExplanation',
    description: '把对本剧本的讲解（设计意图、机制脉络、新手该懂什么）按主题给出，结束讲解。讲解模式下绝不调用任何修改工具。',
    parameters: { type: 'object', properties: {
      summary: { type: 'string', description: '一段总览：这是个什么剧本、玩家扮演谁、核心看点' },
      points: { type: 'array', description: '逐主题讲解', items: { type: 'object', properties: {
        topic: { type: 'string', description: '主题，如"玩家处境""核心矛盾""关键人物""机制要点""上手建议"' },
        detail: { type: 'string', description: '该主题的讲解（具体、可点名实体）' }
      } } }
    }, required: ['points'] }
  };
  function _explainTools() {
    var readNames = { getField: 1, getFields: 1, fieldContract: 1, genReference: 1, readSource: 1, listSource: 1, grepSource: 1, searchEntities: 1, globalSearch: 1, findReferences: 1, listGaps: 1, listCollection: 1, describeSchema: 1, mapOverview: 1, statsAggregate: 1, readQuickTestReport: 1 };
    return AGENT_TOOLS.filter(function(t) { return readNames[t.name]; }).concat([SUBMIT_EXPLANATION_TOOL]);
  }
  // 方向B · 把玩家的「剧本约定」拼成系统提示词里的一段（空则不注入）
  function _conventionsBlock(conventions) {
    var c = String(conventions || '').trim();
    var pc = _packsConventions();   /* P刀 · 启用能力包自带的约定并入(所有模式统一生效) */
    if (pc) c = (c ? c + '\n' : '') + pc;
    if (!c) return '';
    return '\n【玩家的剧本创作约定·务必遵守】\n' + c.slice(0, 4600) + '\n（以上是该玩家一贯的创作偏好/规范，本次编辑须始终遵循；与具体需求冲突时以本次需求为准。）';
  }

  function _buildPlanSystemPrompt(conventions) {
    return [
      '你是历史策略游戏「天命」的剧本编辑助手，现在处于【计划模式】：只规划、不动手。',
      '步骤：① 用 getField/searchEntities/listGaps/listCollection/describeSchema 了解现状与规格缺口；',
      '② 然后调用 proposePlan，列出你打算怎么改的编号步骤（每步一句话、具体到字段/实体）；',
      '③ 这一步绝不调用任何修改工具、绝不直接改剧本——只产出计划，交玩家批准。',
      _conventionsBlock(conventions),
      '',
      buildSchemaGuide()
    ].join('\n');
  }

  // focus（刀3 · 对抗式三角色）：'history'=史官只查史实硬伤·'balance'=谏官只批平衡死局可玩性·空=通用六维审阅官
  function _buildReviewSystemPrompt(conventions, focus, worldKind) {
    var fiction = worldKind === 'fictional';
    var head, dims;
    if (focus === 'history') {
      if (fiction) {
        // 虚构世界没有「正史」可对：史官改任「设定核查官」，查的是世界观自洽而非真实史实。
        head = '你是策略游戏「天命」的【设定核查官】，现在为这个【虚构/架空世界观】剧本做自洽核查：把世界观设定逐一比对，只诊断前后矛盾、不修改。';
        dims = [
          '· 设定自洽性（本职·重点）：势力国号/称谓/源流、纪年与前史、地理建置与地名、力量/科技/修行体系、人物身世与时间线，前后是否一致；有无自相矛盾、设定破例（如已立的规则被无故打破）、张冠李戴；',
          '· 旁及：凡落了确定口吻的设定都应与已确立的世界观相容；拿不准是否冲突的，应标存疑交玩家定夺。不要用真实历史去挑这个原创世界的「错」。'
        ];
      } else {
        head = '你是历史策略游戏「天命」的【史官】，现在为剧本做史实核查：把涉及史实处逐一核对，只诊断硬伤、不修改。';
        dims = [
          '· 史实合理性（本职·重点）：人物生卒与年龄、年号与纪年、官职名称与品级、地理建置与地名、势力存废时间，是否与设定时代相符；有无张冠李戴、时代错置、把虚构当定论、把孤证当信史；',
          '· 旁及：凡落了确定口吻的具体史实都该经得起推敲，拿不准的应改保守措辞或标存疑。'
        ];
      }
    } else if (focus === 'balance') {
      head = '你是历史策略游戏「天命」的【谏官】，现在为剧本批可玩性与平衡：只挑失衡、死局与无趣，不修改。批数值失衡前先用 statsAggregate 读真账（按势力聚合兵力/人口/能力均值）——用确定性统计说话，不要目测清单。';
      dims = [
        '· 平衡性（本职·重点）：势力强弱/资源/兵力是否失衡，是否某方碾压或开局即崩；',
        '· 死局风险：是否存在玩家无论如何都赢不了/活不过的结构性死局；',
        '· 可玩性：玩家开局目标是否清晰、有无可操作抓手、节奏是否合理、忠奸是否脸谱化。'
      ];
    } else {
      head = (fiction ? '你是策略游戏「天命」的剧本审阅官，现在为这个【虚构/架空世界观】剧本做体检' : '你是历史策略游戏「天命」的剧本审阅官，现在处于【审阅模式】：把剧本当作品做体检') + '，只诊断、不修改。';
      dims = [
        '· 平衡性：势力强弱/资源/兵力是否失衡，是否某方碾压或开局即崩；',
        (fiction
          ? '· 设定自洽性：人物/势力/时间/地理/力量体系前后是否一致，有无自相矛盾或设定破例（不要用真实历史挑这个原创世界的错）；'
          : '· 史实合理性：人物/势力/时间/官职/地理是否与设定时代相符，有无硬伤；'),
        '· 可玩性：玩家开局目标是否清晰、是否有可操作的抓手、节奏是否合理；',
        '· 死局风险：是否存在玩家无论如何都赢不了/活不过的结构性死局；',
        '· 内容缺口：运行时必需但缺失的字段（listGaps）、缺关键人物/事件/关系；',
        '· 叙事：动机是否成立、忠奸是否脸谱化、开场是否抓人。'
      ];
    }
    return [head, '用 getField/searchEntities/listGaps/listCollection/describeSchema/validateDraft 充分了解剧本后，从这些维度找问题：']
      .concat(dims)
      .concat([
        '逐条要可定位（指出具体实体/字段）、给可执行建议、按严重度（高/中/低）标注；只报本职范围内最值得修的问题，别凑数。充分查证后调用 submitReview 提交报告；绝不调用任何修改工具、绝不改剧本。',
        _conventionsBlock(conventions),
        '',
        buildSchemaGuide(worldKind)
      ]).join('\n');
  }

  function _buildQaSystemPrompt(conventions) {
    return [
      '你是历史策略游戏「天命」的剧本问答助手，现在处于【问答模式】：用剧本里的事实回答玩家的问题，只读、绝不修改剧本。',
      '用 globalSearch（全局检索）/searchEntities/findReferences（查引用）/listCollection/getField/describeSchema 查清后再答；',
      '回答要基于剧本真实数据、具体（点名相关实体/给出数字）、诚实（查不到就说没有/不确定，别编）。查证后调用 submitAnswer 给出回答；绝不调用任何修改工具。',
      _conventionsBlock(conventions),
      '',
      buildSchemaGuide()
    ].join('\n');
  }

  function _buildExplainSystemPrompt(conventions) {
    return [
      '你是历史策略游戏「天命」的剧本讲解员，现在处于【讲解模式】：给接手这个剧本的作者/玩家做 onboarding，只读、绝不修改剧本。',
      '用 globalSearch/searchEntities/findReferences/listCollection/getField/describeSchema 充分了解剧本后，讲清楚：',
      '· 这是个什么剧本、设定在什么时代、玩家扮演谁、处境如何；· 核心矛盾/冲突与各方势力格局；· 关键人物及其立场动机；· 上手该先关注什么、机制怎么联动、有哪些坑或看点。',
      '讲解要基于剧本真实数据、点名具体实体、像老师带新人那样有条理；诚实（查不到的别编）。查证后调用 submitExplanation 按主题提交；绝不调用任何修改工具。',
      _conventionsBlock(conventions),
      '',
      buildSchemaGuide()
    ].join('\n');
  }

  // ── 刀G8/S10 共用 · 宏压缩文案构件：循环内自动压缩与「/压缩前情」手动压缩同一套（勿两处漂移） ──
  var _MACRO_SUM_TOOLS = [{ name: 'submitSummary', description: '提交结构化前情摘要', parameters: { type: 'object', properties: { summary: { type: 'string', description: '按七段结构写全的摘要正文' } }, required: ['summary'] } }];
  var _MACRO_SUM_SYS = '你是对话压缩器：只输出忠实、具体、结构化的前情摘要，不评论不建议。';
  function _macroSummaryAsk(flat) {
    return '以下是一段「剧本编辑 agent」与用户/工具的工作对话记录。请把它压缩成结构化前情摘要，供同一 agent 在新上下文里无缝续作。必须涵盖七段：\n'
      + '①用户各轮请求与意图(逐条·含意图变化与纠偏) ②已完成的改动(实体/字段级·关键新值) ③任务表现状(未完项) ④已查明的关键事实(字段结构/约定/引用关系) ⑤遇到的错误与修正 ⑥正在进行的工作 ⑦下一步(必须与用户最近请求直接一致·勿开新任务)\n'
      + '要具体：实体名/字段路径/关键值逐一点名，宁详勿略。调用 submitSummary 提交；若无法调用工具，直接以纯文本输出摘要正文。\n\n【对话记录】\n' + flat;
  }
  // U1(Codex COMPACT_USER_MESSAGE_MAX_TOKENS 对照) · 压缩时逐字保留用户各轮原话：摘要难免失真·
  //   玩家的具体指令/设定是续作的地面真值。从后往前收(最新优先·tail 已保留的不重复)·剥构建附文
  //   (【用户需求】标记头/草稿现状等)只留原话·每条截 600 字·总额 userKeep(默认 6000)字。
  function _macroUserLines(conv, tailLen, userKeep) {
    userKeep = userKeep || 6000;
    var upto = Math.max(0, (conv || []).length - (tailLen || 0));
    var out = [], used = 0;
    for (var i = upto - 1; i >= 0; i--) {
      var m = conv[i]; if (!m || m.role !== 'user') continue;
      var t = String(m.text || '').replace(/^【曾附图 \d+ 张】/, '').trim();
      if (!t || /^【前情摘要/.test(t) || /^（预算提示/.test(t) || /^⚠ 已连续/.test(t)) continue;   // 注入类消息非玩家原话
      var mm = t.match(/^【[^】]{1,14}】\n?([\s\S]*)$/);
      var body = mm ? mm[1] : t;
      var cut = body.search(/\n【|\n（在上面已改|\n（当前编辑上下文|\n（提示：/);
      if (cut > 0) body = body.slice(0, cut);
      body = body.trim().slice(0, 600);
      if (!body) continue;
      if (used + body.length > userKeep) break;
      used += body.length;
      out.push(body);
    }
    return out.reverse();
  }
  function _macroHead(summary, draft, surfaces, tailLen, userLines) {
    var gaps = null; try { gaps = _computeGaps(draft, surfaces || []); } catch (eG) {}
    return '【前情摘要·上下文已压缩】此前对话过长已压缩为以下摘要（覆盖此前全部工作）：\n\n' + summary
      + ((userLines && userLines.length) ? '\n\n【用户各轮原话·逐字保留（时间序·地面真值·摘要与此冲突以此为准）】\n' + userLines.map(function (u, i) { return (i + 1) + '. ' + u; }).join('\n') : '')
      + '\n\n【当前草稿最新状态·压缩后重读】\n' + _draftSummary(draft)
      + ((gaps && gaps.requiredMissing.length) ? '\n（仍有必需缺口 ' + gaps.requiredMissing.length + ' 项：' + gaps.requiredMissing.slice(0, 12).join('、') + '）' : '')
      + '\n\n请从中断处直接继续当前任务：不要复述摘要、不要重新确认、不要说「我继续」——当中断从未发生。任务表(todoWrite)与已落地的草稿改动均仍有效'
      + (tailLen ? '；最近 ' + tailLen + ' 条原始消息保留在后。' : '。');
  }
  function _macroPickSummary(r) {
    try { var tc0 = ((r && r.toolCalls) || []).filter(function (t) { return t && t.name === 'submitSummary'; })[0]; return String((tc0 && tc0.input && tc0.input.summary) || (r && r.text) || ''); }
    catch (eS) { return String((r && r.text) || ''); }
  }
  /** S10(Codex /compact·CC /compact 对照) · 手动前情压缩：跑的间隙把会话线程压成七段摘要+近尾原文。
   *  一次小结调用（优先次要模型）·摘要太薄按失败处理（原对话不动）。返回 {ok, conversation?, before, after, reason?}。 */
  function compactConversation(conversation, draft, opts) {
    opts = opts || {};
    if (!Array.isArray(conversation) || conversation.length < 4) return Promise.resolve({ ok: false, reason: 'too-small' });
    var beforeN = conversation.length;
    var flat = _flattenForSummary(conversation, opts.frac != null ? opts.frac : 0.45);
    var cfg = opts.cfg || loadEditorApiConfig();
    return callWithTools([{ role: 'user', text: _macroSummaryAsk(flat) }], _MACRO_SUM_TOOLS, { maxTok: 4000, maxRetries: 1, cfg: opts.cfg2 || _secondaryCfg() || cfg, system: _MACRO_SUM_SYS })
      .then(function (r) {
        var s = _macroPickSummary(r);
        if (s.length < 200) return { ok: false, reason: 'thin' };
        var tail = _compactTailSlice(conversation, opts.keepTail != null ? opts.keepTail : 6);
        var out = [{ role: 'user', text: _macroHead(s, draft, opts.surfaces || [], tail.length, _macroUserLines(conversation, tail.length, opts.userKeep)) }].concat(tail);
        return { ok: true, conversation: out, before: beforeN, after: out.length, summaryChars: s.length };
      });
  }

  function _buildSystemPrompt(conventions, worldKind, microPlanOn) {
    var fiction = worldKind === 'fictional';
    // 世界类型分支：虚构世界观（奇幻/武侠/未来/异世界/架空历史等原创设定）下，去掉「违背史实即硬伤」的史实锚定，
    // 改以「世界观自洽性」为判据；史实世界保持原有考据铁律不变。
    var head = fiction
      ? '你是策略游戏「天命」的剧本编辑助手。当前剧本是【虚构/架空世界观】——可为奇幻、武侠、仙侠、未来、异世界、架空历史等原创设定，不受真实历史约束。你的职责是帮玩家把这个原创世界建得自洽、丰满、可玩。通过调用工具编辑剧本草稿，满足用户需求。'
      : '你是历史策略游戏「天命」的剧本编辑助手。通过调用工具编辑剧本草稿，满足用户需求。';
    var ruleRemonstrate = fiction
      ? '⑪【遇硬伤先进谏·别默默照做】虚构世界不存在「与正史不符」这种错（这是原创设定，玩家说了算）。你进谏的依据只有三类：世界观自洽性（前后设定自相矛盾，如同一势力两处国号不一、力量体系破例）、平衡（某方碾压/开局即崩/数值严重失衡）、可玩性（结构性死局/无操作抓手）。遇这三类才调 remonstrate：一句话说清利害＋给一个可一键采纳的替代方案，停下等玩家定夺。severity 用「设定/平衡/机制」（虚构世界不要用「史实」）。别为风格口味打断；玩家听谏后仍坚持的，尊重其设定、照办。'
      : '⑪【遇硬伤先进谏·别默默照做】当玩家需求确有硬伤——明显违背史实（年号/生卒/职官/事件与正史冲突）、会致某势力开局即崩盘或数值严重失衡、或把某朝专名当通用机制（违反朝代中立）——先调 remonstrate 进谏：一句话说清利害＋给一个可一键采纳的替代方案，停下来等玩家定夺，别默默照做。这是「国师」的本分：给硬核可信的判断而非有求必应。但只在确有硬伤时进谏，别动辄劝阻、别为小事打断；玩家听谏后仍坚持的，尊重玩家最终决定、照办。';
    var ruleSelfCheck = fiction
      ? '⑫【设定自洽·建档自查】虚构世界不要用 checkHistory 纠结真实史实（这是原创世界，没有「正史」可对）。改用 note 把你为这个世界确立的设定逐条记下来——地理山川、势力源流与恩怨、力量/科技/修行体系、纪年与重大前史、关键名物——后续新增内容都要与已记设定保持一致、不自相矛盾。把世界观背景写进 world / worldSettings / overview。真拿不准某处会不会和既有设定冲突时，用 flagUncertain 标出来交玩家定夺。'
      : '⑫【先核后写·自查证】新增/改写涉及具体史实的内容（年号纪年、人物生卒与年龄、职官名称品级、重大事件时间地点）前，先用 checkHistory 把你将依据的关键史实逐条列出并自评把握：把握高的照写；把握低/拿不准的，落字用保守措辞（约/相传/据载）并对该路径 flagUncertain，绝不把存疑当确定口吻硬写。这是「国师」对硬核可信的本分。注意：无外部资料时这是自我审视，治"自信地编"，但变不出你本就不知道的事——真拿不准就老实标出来交玩家定夺。';
    return [
      head,
      '⓪ ≥3 步的任务先用 todoWrite 列任务表再动手（每完成一步立即标 completed·恰保持一项 in_progress·计划变了重写整表）；finish 前任务表要么全部完成、要么如实更新掉确不需要的项（带着未完项收尾会被顶回）。单条杂感用 note。若需求含糊到无法动手（缺关键信息），先用 askClarification 问 1-3 个具体问题再继续；需求清楚就直接做。'
        + (microPlanOn ? '\n⓪½【歧义先对齐·微计划】需求有多解、或影响面大（批量改/删除/结构性重构）而你对玩家真意把握不足时——别硬猜：第一轮就用 askClarification·questions 只放一条「我准备这么做：〈2-3 句具体到实体/字段的做法〉。回复"继续"即照此执行·或直接说你要的改法」。仅限新需求的第一轮；对话延续、玩家已确认过方向、或需求明确的单点小改一律不问直接做——此机制治的是"猜错方向白干一场"，不是让你事事请示。' : ''),
      '规则：① 只用工具修改/查询，不要直接输出 JSON 剧本正文。② 中文显示名（人物/势力/地名）保持中文，禁止英译。',
      '③【勘察】先查后改：getField（单路径）/getFields（批量·一次读多个路径省往返，需同时核对多处时优先用它）/listCollection/describeSchema 看清现状与字段；searchEntities/listGaps 查实体与规格缺口；不确定东西在哪个集合时用 globalSearch 全局检索定位。想确认正式游戏怎么读某字段、读不读它，用 fieldContract 查契约（按需查，别凭印象）；想看游戏 UI/逻辑的源码实现，用 listSource 找文件、readSource 读、grepSource 全局搜——可直接读整个代码库。生成或大改某部分(人物/势力/经济/官制/封臣…)前，先 genReference 看老编辑器对该部分的生成范式(设定深度/字段形状/朝代逻辑/参数区间)，借鉴后再动手。',
      '④【落改】bulkAdd/multiEdit 一次多改提效；同一字段按条件成批调（「辽东诸将武力+5」类）用 bulkUpdate 一步到位（先 limit:3 试跑核对再放开）；配平数值前先 statsAggregate 读真账。改名优先 renameEntity（联动所有引用、不留死链）；地图地块/省名改名用 renameRegion（同步 map/mapData 双镜像·如需联动其他引用再补 renameEntity）；删除实体前先 findReferences 查谁引用了它，再 removeEntity。改地图归属（把某地块划给某势力、调整疆域）先 mapOverview 看清地块/归属/势力，再 mapAssignOwner 按地块名+势力名改（自动上色、同步双镜像）。玩家配了生图 API 时，可用 generateImage 给人物立绘(characters.N.portrait)/势力旗徽生成图像（未配置会明确报错，届时用文字描述代替，不要反复重试）；生成的图要复用/挪到别的字段用 copyField(from,to) 直拷——图片值极大，绝不要 getField 读出来再 applyEdit 写回。与用户需求相关的必需缺口顺手补齐，让剧本完整可玩。',
      '⑤【自查与收尾】每改完一批用 validateDraft 自查，有违规继续修（写类工具的返回已回挂变更后的当前值 nowValue/nowValues/collectionLength，据此确认改动已落地，无需再 getField 重读确认）。改好后用 preflight 跑运行时体检（确保游戏能正常加载），有 blockers 继续修到 bootable，再调用 finish——summary 要向玩家说清「改了什么、为什么这么改」（具体到关键实体/字段，2-4 句中文），不要只写"完成"。finish 有质量闸：运行时必崩项与关系一致性不得比开工时更糟（quality-gate-worse 被顶回=你本次改动引入了新问题·按提示修掉再收尾）。relations 是开放关系图（党派/阶层/未出场人物可作节点）；只有确需绑定 characters 名册的边才设 strictRefs:true。动过人物名/删过人后仍须 findReferences 并跑 validateDraft {group:"relation-consistency"}。大改（结构性重构/批量数值/新系统）收尾时在 summary 里建议玩家点「快测·首回合真跑」；下次协作先 readQuickTestReport 看有无报告——报告里的错误/异常是运行时真后果·优先修它。',
      '⑥ 若发现该玩家/剧本有值得长期沿用的约定（命名规律、文风、设定惯例），可调 recordConvention 记一条（仅在确有发现时，别凑数）；从对话中了解到**推导不出来的背景**（玩家是谁与偏好/玩家给的做法反馈/创作长线目标/外部资料指引），用 saveMemory 存对应类型的记忆供下次共事召回——剧本里本就有的数据与本次改动明细不要存。⑦ 用户消息可能附图（编辑器截图/史料素材/手绘草图）——图即需求的一部分，按图中信息办。⑧ 对没把握的改动（史实存疑、靠推测填充）调 flagUncertain 标一下路径，提醒玩家重点复核（只标真没把握的）；运行中若在工具结果里收到「（插话）」注入，那是玩家的实时补充指令——完成当前一步后必须优先处理它，勿忽略。',
      '⑨【填实·禁空内容·铁律】新增或改写实体必须填到可直接用的质量，绝不留空：先用 listCollection / searchEntities 看一两个剧本里已有的同类实体（或 genReference 看生成范式），照着它们的字段集与丰满度，把新实体的所有相关字段都填上有意义的中文内容——身份/官衔/数值(能力/人口/兵力等)/背景小传/性格/目标/关系/履历等该有的都要有，数值要符合设定区间、彼此自洽。禁止留空字符串、0 占位（除非数值确为 0）、"待补/TODO/未知/暂无"之类占位词，也禁止只填 name 就交差。createEntity 模板只是最小骨架，拿到后必须逐字段补全。宁可少加一个实体，也要把加的每个都填实、达到与官方实体同等的完整度。',
      '⑩【高权限·可写任意字段】你对剧本草稿有完全的写入权限：applyEdit/applyPush 可以创建任意新字段、新嵌套结构，包括剧本编辑器当前没有专门面板/不在结构速查/fieldContract 查不到的"非标准/自定义"字段——编辑器会自动吸收并展示这些字段，不会丢。fieldContract 返回"不在游戏字段契约中"只表示它是扩展/自定义字段（正式游戏不直接读），并不代表禁止写；只要对实现用户需求有用就大胆写。唯一不可改的是：剧本唯一 id、下划线开头的内部字段、ai/conf/meta 等配置（改这些会损坏剧本）。其余一切随需求自由创建与修改。',
      ruleRemonstrate,
      ruleSelfCheck,
      _conventionsBlock(conventions),
      _skillsBlock(),   /* S刀 · 技能清单(useSkill 按需展开·≈CC SkillTool 的技能目录注入) */
      '',
      buildSchemaGuide(worldKind)
    ].join('\n');
  }

  function _buildInitialUser(draft, userRequest, surfaces, editorContext, exemplars, memory, runHistory) {
    var lines = [
      '【用户需求】\n' + (userRequest || '')
    ];
    if (memory) {   // 跨会话记忆：你在与该玩家之前的对话里做过什么（延续上下文·避免重复/冲突）
      lines.push('\n【跨会话记忆·你在之前的对话里对本剧本做过这些】（供延续，不要重复已做的，注意与之前改动保持一致；这是历史记录非当前需求）\n' + String(memory).slice(0, 2200));
    }
    if (runHistory) {   // 刀③(2026-07-10 智能升级D2)：运行教训回喂——此前审计日志与上下文完全割裂·每次从零
      lines.push('\n【前情·最近几次协作的结局】（未完成/被顶回的注意原因·若与本次相关吸取教训别重蹈；已应用的勿重复做）\n' + String(runHistory).slice(0, 1200));
    }
    if (exemplars) {   // 方向J · few-shot 范例：参考其笔法与字段丰满度（编辑官方剧本时即官方范例）
      lines.push('\n【参考范例·新增/改写内容请贴近这些范例的笔法、字段完整度与设定风格】\n' + String(exemplars).slice(0, 6000));
    }
    if (editorContext) {   // 上下文感知：玩家在编辑器里正看着什么，指代优先指它
      lines.push('\n【当前编辑上下文】\n玩家正在编辑器中查看：' + editorContext
        + '\n（若需求中有"他/她/它/这个/当前/这名/此"等指代而未点名，优先理解为上述当前选中项。）');
    }
    lines.push('\n【草稿现状】\n' + _draftSummary(draft));
    var gaps = _computeGaps(draft, surfaces || []);
    if (gaps.requiredMissing.length) {
      lines.push('\n【规格缺口·游戏运行时必需但当前缺失】(' + gaps.requiredMissing.length + ' 项)\n'
        + gaps.requiredMissing.slice(0, 30).join('、')
        + '\n→ 与用户需求相关的缺口请顺手补齐；listGaps 可随时复查。');
    }
    lines.push('\n开始：先按需 getField/searchEntities/listGaps 查看，再用 applyEdit/applyPush/removeEntity 修改，validateDraft 自查，最后 finish。');
    return lines.join('\n');
  }

  // 方向D · 审阅模式的初始 user：把审阅重点（或玩家指定的关注点）+ 草稿现状 + 缺口喂给审阅官
  function _buildReviewUser(draft, userRequest, surfaces, editorContext) {
    var focus = String(userRequest || '').trim();
    var lines = [focus ? ('【本次审阅重点】\n' + focus + '\n（在全面体检基础上，重点关注以上方面。）') : '【任务】对整个剧本做一次全面体检。'];
    if (editorContext) lines.push('\n【当前编辑上下文】玩家正在查看：' + editorContext + '（如有相关问题可优先点到）。');
    lines.push('\n【草稿现状】\n' + _draftSummary(draft));
    var gaps = _computeGaps(draft, surfaces || []);
    if (gaps.requiredMissing.length) {
      lines.push('\n【已知规格缺口·运行时必需但缺失】(' + gaps.requiredMissing.length + ' 项)\n' + gaps.requiredMissing.slice(0, 30).join('、'));
    }
    lines.push('\n开始：先用读工具充分查证，再调用 submitReview 提交结构化报告。不要修改剧本。');
    return lines.join('\n');
  }

  // 方向L · 问答模式的初始 user：玩家的问题 + 草稿现状
  function _buildQaUser(draft, question, surfaces, editorContext) {
    var lines = ['【玩家的问题】\n' + (String(question || '').trim() || '（未给出问题）')];
    if (editorContext) lines.push('\n【当前编辑上下文】玩家正在查看：' + editorContext + '（指代未点名时优先指它）。');
    lines.push('\n【剧本现状】\n' + _draftSummary(draft));
    lines.push('\n开始：先用 globalSearch/searchEntities/findReferences/listCollection 等查清，再调用 submitAnswer 回答。不要修改剧本。');
    return lines.join('\n');
  }

  // 方向N · 讲解模式的初始 user：玩家关注点（可空）+ 剧本现状
  function _buildExplainUser(draft, focus, surfaces, editorContext) {
    var f = String(focus || '').trim();
    var lines = [f ? ('【本次讲解侧重】\n' + f + '\n（在整体讲解基础上重点讲以上方面。）') : '【任务】给接手这个剧本的人做一次全面 onboarding 讲解。'];
    if (editorContext) lines.push('\n【当前编辑上下文】玩家正在查看：' + editorContext + '（可优先讲到）。');
    lines.push('\n【剧本现状】\n' + _draftSummary(draft));
    lines.push('\n开始：先用读工具充分了解剧本，再调用 submitExplanation 按主题讲解。不要修改剧本。');
    return lines.join('\n');
  }

  // 维度1 · 对话式追问：在已改草稿基础上继续（agent 已有上文，提示从简）。
  function _buildFollowUpUser(draft, userRequest, surfaces, editorContext) {
    var lines = ['【追加需求】\n' + (userRequest || '') + '\n（在上面已改的草稿基础上继续；需要时可 listGaps/validateDraft 复查，改好后调用 finish。）'];
    if (editorContext) lines.push('（当前编辑上下文：' + editorContext + '；指代未点名时优先指它。）');
    var gaps = _computeGaps(draft, surfaces || []);
    if (gaps.requiredMissing.length) {
      lines.push('（提示：仍有必需缺口 ' + gaps.requiredMissing.length + ' 项，如与本次需求相关可一并补。）');
    }
    return lines.join('\n');
  }

  // 简易 token 估算（CJK≈1.3/字·其余≈0.25/字符·与 tm-ai-infra estimateTokens 同启发式）
  function _estimateTokens(text) {
    if (!text) return 0;
    var s = String(text), cjk = 0, other = 0;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3040 && code <= 0x30FF)) cjk++;
      else other++;
    }
    return Math.ceil(cjk * 1.3 + other * 0.25);
  }

  // 跑前估算：按和 runAuthoringLoop 完全相同的构建路径，算「首发请求」与「整轮范围」的 token 粗估。
  // 仅供玩家心里有数（像 Claude code 跑前看上下文体量）；实际取决于改动复杂度与轮数，标注为估算。
  function estimateRun(draft, userRequest, opts) {
    opts = opts || {};
    var planOnly = !!opts.planOnly;
    var tools = planOnly ? _planTools() : (opts.tools || AGENT_TOOLS);
    var conventions = (opts.conventions != null ? opts.conventions : loadConventions()) || '';   // 方向B · 剧本约定
    var system = planOnly ? _buildPlanSystemPrompt(conventions) : _buildSystemPrompt(conventions);
    tools = _filterToolsByPacks(tools, userRequest, { worldKind: (draft && draft.worldKind) === 'fictional' ? 'fictional' : 'historical', toolPacks: opts.toolPacks });
    var surfaces = _getFieldSurfaces(opts);
    var continuing = !!(Array.isArray(opts.priorConversation) && opts.priorConversation.length);
    var editorContext = opts.editorContext || '';
    var exemplars = opts.exemplars || '';   // 方向J · few-shot 范例
    var userText = continuing ? _buildFollowUpUser(draft, userRequest, surfaces, editorContext) : _buildInitialUser(draft, userRequest, surfaces, editorContext, exemplars);
    var priorTokens = 0;
    if (continuing) { try { priorTokens = _estimateTokens(JSON.stringify(opts.priorConversation)); } catch (e) {} }
    var toolsTokens = 0; try { toolsTokens = _estimateTokens(JSON.stringify(tools)); } catch (e) {}   // tools schema 每轮都发
    var perCallInput = _estimateTokens(system) + toolsTokens + priorTokens + _estimateTokens(userText);
    var maxTokens = opts.maxTokens || 120000;
    // 多轮会重发增长中的对话：按典型轮数 × 增长因子粗估，封顶于预算上限。计划模式只读+提案、轮数更少。
    var lowRounds = planOnly ? 1 : (continuing ? 1 : 2);
    var highRounds = planOnly ? 2 : 8;
    var rnd = function(n) { return Math.round(Math.min(maxTokens, n) / 100) * 100; };
    return {
      perCallInput: perCallInput,
      low: rnd(perCallInput * lowRounds * 1.1),
      high: rnd(perCallInput * highRounds * 1.25),
      maxTokens: maxTokens,
      planOnly: planOnly,
      continuing: continuing
    };
  }

  // 刀①(2026-07-10 智能升级B)：finish 质量闸·增量基线——run 起点各「运行时必崩组+关系一致性」的违规数快照。
  // 闸语义=「不得比开工时更糟」：存量坏账不逼 agent 顺手修完（否则小任务也被整局旧病闸死）·但绝不许带新病收尾。
  var _GATE_GROUPS = ['runtime-boot', 'faction-refs', 'runtime-office', 'runtime-chars', 'relation-consistency'];
  function _gateCounts(draft) {
    var counts = {};
    _GATE_GROUPS.forEach(function (g) {
      try {
        var r = _checks[g] ? (_checks[g](draft) || { violations: [] }) : { violations: [] };
        // 优先 gateScore（细粒度·如关系检查按边计数——违规消息按类聚合·对「多了一条悬空」不敏感）
        counts[g] = (typeof r.gateScore === 'number' && isFinite(r.gateScore)) ? r.gateScore : (r.violations || []).length;
      } catch (_) { counts[g] = 0; }
    });
    return counts;
  }

  // 取指定 group 的违规（finish 门控只拦 agent 能改的硬不变量·见 blockingChecks 默认值）
  function _blockingViolations(report, blockingChecks) {
    var v = [];
    blockingChecks.forEach(function(g) {
      var r = report.results && report.results[g];
      if (r && r.violations) r.violations.forEach(function(m) { v.push('[' + g + '] ' + m); });
    });
    return v;
  }

  /**
   * 运行 authoring loop（B：真多轮 conversation·tool_use/tool_result 线程·system 缓存）。
   * S3：finish 门控（blocking 违规拒绝结束、喂回逼自修）+ maxIterations + token 预算闸。
   * @param {object} draft
   * @param {string} userRequest
   * @param {{caller?:Function, maxIterations?:number, maxTokens?:number, maxFinishAttempts?:number,
   *          blockingChecks?:string[], maxTok?:number, cfg?:object, onStep?:Function, onText?:Function}} [opts]
   *   caller(conversation, tools, {maxTok,cfg,system}) → Promise<{text,toolCalls:[{id,name,input}]}>；默认 callWithTools，测试可注入。
   * @returns {Promise<{draft, transcript, conversation, iterations, finished, finalValidation, stopReason, tokensUsed, finishAttempts}>}
   */
  // 方向F · 权限闸：所有 _MUT_TOOLS 都受 allowedCollections(范围沙箱) + allowDestructive(危险操作开关) 约束。
  var _DESTRUCTIVE_TOOLS = { removeEntity: 1, renameEntity: 1, renameRegion: 1 };
  function _topOf(path) { return String(path == null ? '' : path).split(/[.\[]/)[0]; }
  function _toolCollections(name, input) {   // 该工具会改的顶层集合；null=全局(无法限定·如 renameEntity 跨集合联动)
    input = input || {};
    switch (name) {
      case 'applyEdit': case 'applyPush': case 'removeEntity': case 'generateImage': return [_topOf(input.path)];
      case 'copyField': return [_topOf(input.to)];
      case 'bulkAdd': case 'bulkUpdate': return [_topOf(input.collection)];
      case 'multiEdit': return (Array.isArray(input.edits) ? input.edits : []).map(function(e) { return _topOf(e && e.path); });
      case 'mapAssignOwner': case 'renameRegion': return ['map', 'mapData'];
      case 'renameEntity': return null;
      default: return [];
    }
  }
  function _permCheck(name, input, perms) {   // 返回拦截原因(字符串)或 null(放行)
    if (!perms || !_MUT_TOOLS[name]) return null;
    if (_DESTRUCTIVE_TOOLS[name] && perms.allowDestructive === false) {
      return '危险操作保护已开启：删除/改名（' + name + '）被禁用。如确需请玩家在权限里允许危险操作。';
    }
    var allowed = perms.allowedCollections;
    if (Array.isArray(allowed) && allowed.length) {
      var cols = _toolCollections(name, input);
      if (cols === null) return '范围沙箱：renameEntity 跨集合联动、超出限定范围，已拦截（请在范围内逐处改，或扩大范围）。';
      var outside = cols.filter(function(c) { return c && allowed.indexOf(c) < 0; });
      if (outside.length) return '范围沙箱：本次只允许修改 [' + allowed.join('、') + ']，已拦截对 [' + outside.join('、') + '] 的修改。';
    }
    return null;
  }

  // 刀E · 可中断：允许会审并行注册多个运行句柄；停止必须覆盖全部在途评审，不能只停最后一个。
  var _activeRun = null, _activeRuns = [];
  function _registerRun(control) {
    _activeRuns.push(control);
    _activeRun = control;
  }
  function _releaseRun(control) {
    var i = _activeRuns.indexOf(control);
    if (i >= 0) _activeRuns.splice(i, 1);
    if (_activeRun === control) _activeRun = _activeRuns.length ? _activeRuns[_activeRuns.length - 1] : null;
  }
  function abort() {
    var runs = _activeRuns.slice();
    runs.forEach(function(control) {
      if (control && typeof control.abort === 'function') control.abort('player-stop');
      else if (control) control.aborted = true;
    });
    return runs.length > 0;
  }
  // 刀G9(CC message queue 对照) · 运行中插话：agent 跑着时用户可继续发话——排队·本轮工具结果落定后
  //   作为 user 消息注入(下一轮模型即见)·不打断当前轮(CC "先干完手头这步·必须处理·勿忽略"语义)。
  function steer(text) {
    var t = String(text == null ? '' : text).trim();
    if (!_activeRun || _activeRun.aborted || !t) return false;
    _activeRun.steers.push(t);
    return true;
  }
  // 刀G5 · todoWrite 任务表(模块级·每次 runAuthoringLoop 起跑重置·dispatch 写入·loop 读它做节流提醒)
  var _todoState = { list: [] };

  function runAuthoringLoop(draft, userRequest, opts) {
    opts = opts || {};
    var caller = opts.caller || callWithTools;
    var maxIterations = opts.maxIterations || 48;     // 刀D · 自主度：放宽到 48 轮·持续调用直到完成（UI 还会自动续接）
    var maxTokens = opts.maxTokens || 260000;         // 刀D · 自主度：token 预算放宽·覆盖长任务一次跑完
    var maxFinishAttempts = opts.maxFinishAttempts || 3;
    var blockingChecks = opts.blockingChecks || ['admin-population', 'faction-refs'];
    var _gateBaseline = _gateCounts(draft);   // 刀①·finish 质量闸基线（增量语义·opts.qualityGate===false 可关）
    var qualityGateOn = opts.qualityGate !== false;
    var perms = { allowedCollections: opts.allowedCollections || null, allowDestructive: opts.allowDestructive !== false };   // 方向F · 权限（默认无限制·全放行）
    var planOnly = !!opts.planOnly;   // 计划模式：只读 + proposePlan，不动手
    var reviewOnly = !!opts.reviewOnly;   // 方向D · 审阅模式：只读 + submitReview，不动剧本
    var qaOnly = !!opts.qaOnly;   // 方向L · 问答模式：只读 + submitAnswer，不动剧本
    var explainOnly = !!opts.explainOnly;   // 方向N · 讲解模式：只读 + submitExplanation，不动剧本
    var tools = explainOnly ? _explainTools() : (qaOnly ? _qaTools() : (reviewOnly ? _reviewTools() : (planOnly ? _planTools() : (opts.tools || AGENT_TOOLS))));
    var conventions = (opts.conventions != null ? opts.conventions : loadConventions()) || '';   // 方向B · 剧本约定（每次 run 注入·等价 CLAUDE.md）
    // 世界类型：史实(默认) / 虚构(架空·奇幻·武侠·未来·异世界等)。优先 opts.worldKind(UI 显式声明)，否则读剧本持久字段 draft.worldKind；
    // 虚构档去史实锚定、点出 world/worldSettings 容器、校验豁免「五常」。非 'fictional' 一律归史实。
    var worldKind = (opts.worldKind || (draft && draft.worldKind) || 'historical') === 'fictional' ? 'fictional' : 'historical';
    tools = _filterToolsByPacks(tools, userRequest, { worldKind: worldKind, toolPacks: opts.toolPacks });
    var system = explainOnly ? _buildExplainSystemPrompt(conventions) : (qaOnly ? _buildQaSystemPrompt(conventions) : (reviewOnly ? _buildReviewSystemPrompt(conventions, opts.reviewFocus, worldKind) : (planOnly ? _buildPlanSystemPrompt(conventions) : _buildSystemPrompt(conventions, worldKind, opts.microPlanConfirm !== false))));   // 刀③D1·微计划规则默认注入(opts.microPlanConfirm=false 关)
    var surfaces = _getFieldSurfaces(opts);   // 刀A · 规格（游戏运行时要什么）
    var editorContext = opts.editorContext || '';   // 上下文感知：编辑器当前焦点（模块/集合/选中实体）
    var exemplars = opts.exemplars || '';   // 方向J · few-shot 范例（开关式·编辑官方剧本时即官方范例）
    var conversation, _priorTokens = 0;   // 维度1 · 对话式追问：有 priorConversation 则接着上轮线程改
    var _turnImages = (Array.isArray(opts.images) && opts.images.length) ? opts.images.slice(0, 4) : null;   // S2 · 本轮视觉附件(截图/图片·dataURL)
    if (Array.isArray(opts.priorConversation) && opts.priorConversation.length) {
      conversation = opts.priorConversation.slice();
      var _fu = { role: 'user', text: _buildFollowUpUser(draft, userRequest, surfaces, editorContext) };
      if (_turnImages) _fu.images = _turnImages;
      conversation.push(_fu);
      try { _priorTokens = _estimateTokens(JSON.stringify(opts.priorConversation)); } catch (e) {}
    } else {
      var _iu = { role: 'user', text: explainOnly ? _buildExplainUser(draft, userRequest, surfaces, editorContext) : (qaOnly ? _buildQaUser(draft, userRequest, surfaces, editorContext) : (reviewOnly ? _buildReviewUser(draft, userRequest, surfaces, editorContext) : _buildInitialUser(draft, userRequest, surfaces, editorContext, exemplars, opts.memory || '', opts.runHistory || ''))) };
      if (_turnImages) _iu.images = _turnImages;
      conversation = [_iu];
    }
    var transcript = [];
    var iterations = 0, finishAttempts = 0;
    // 刀G1(2026-07-02·CC QueryEngine 对照) · 预算核算修真：tokensUsed = 「下一次请求的真实上下文体量」
    //   = system + 工具schema(每轮全量重发·旧口径从不计入) + 全对话(含 assistant 的 toolCalls 入参·旧口径漏算)。
    //   旧口径只零星累加响应文本与工具结果 ≈ 真实体量的零头 → 260k 闸与 70/90% 提醒形同虚设、压缩触发迟到。
    var _sysTok = _estimateTokens(system);
    var _toolsTok = 0; try { _toolsTok = _estimateTokens(JSON.stringify(tools)); } catch (eTt) {}
    var _convTok = 0;
    function _convRecount() { try { _convTok = _estimateTokens(JSON.stringify(conversation)); } catch (eCr) {} }
    function _reqTokens() { return _sysTok + _toolsTok + _convTok; }
    _convRecount();
    var tokensUsed = _reqTokens();
    var finished = false, stopReason = 'maxIterations';
    var _planResult = null;   // 计划模式产出（proposePlan 的步骤）
    var _reviewResult = null;   // 方向D · 审阅模式产出（submitReview 的报告）
    var _qaResult = null;   // 方向L · 问答模式产出（submitAnswer 的回答）
    var _explainResult = null;   // 方向N · 讲解模式产出（submitExplanation）
    var _clarifyResult = null;   // 方向K · 交互式澄清产出（askClarification 的问题）
    var _remonstrateResult = null;   // 刀1 · 国师进谏产出（remonstrate 的异议+替代方案）
    var _finishSummary = '';   // 改动说明：finish 时 agent 给的"做了什么+为什么"
    var _kernelRun = (global.TM && global.TM.AgentKernel && typeof global.TM.AgentKernel.createRun === 'function')
      ? global.TM.AgentKernel.createRun({ meta: { surface: 'authoring', mode: planOnly ? 'plan' : (reviewOnly ? 'review' : (qaOnly ? 'qa' : (explainOnly ? 'explain' : 'edit'))) }, budget: { maxCalls: maxIterations + 4, maxTokens: maxTokens, reserveCalls: 1 } })
      : null;
    var _localCtrl = !_kernelRun && typeof global.AbortController === 'function' ? new global.AbortController() : null;
    var control = {
      aborted: false, steers: [], sideEffects: [], toolReceipts: [],
      signal: _kernelRun ? _kernelRun.signal : (_localCtrl ? _localCtrl.signal : null),
      abort: function(reason) {
        if (control.aborted) return;
        control.aborted = true;
        if (_kernelRun) _kernelRun.abort(reason || 'aborted');
        else if (_localCtrl && !_localCtrl.signal.aborted) _localCtrl.abort(reason || 'aborted');
      }
    };   // 刀E · 真 AbortSignal 中断在途 fetch；外部副作用只暂存到 sideEffects
    _registerRun(control);
    // 刀G9 · 排空插话队列 → 包装成一条 user 消息注入(CC wrapCommandText 语义:必须处理·勿忽略)
    var _steeredCount = 0;
    function _drainSteers() {
      if (!control.steers.length || control.aborted) return false;
      var _stB = control.steers.splice(0, control.steers.length);
      conversation.push({ role: 'user', text: '【用户在你工作期间发来新指示】\n' + _stB.map(function (s, si) { return (_stB.length > 1 ? (si + 1) + '. ' : '') + s; }).join('\n') + '\n（必须处理：完成当前这一步后立即按上述指示调整——它可能改变或追加原需求；处理完再 finish，勿忽略。）' });
      _steeredCount += _stB.length;
      record('steer', { texts: _stB }, { ok: true, queued: _stB.length });
      return true;
    }
    // 方向A · 鲁棒自愈：noToolCalls 先 nudge 再放弃；caller 瞬态错误退避重试
    var noToolNudges = 0, maxNoToolNudges = (opts.maxNoToolNudges != null ? opts.maxNoToolNudges : 2);
    var stepRetries = 0, maxStepRetries = (opts.maxStepRetries != null ? opts.maxStepRetries : 2);
    var retryBaseMs = opts.retryBaseMs || 800;
    var _curMaxTok = 0, _tokBumps = 0;   // 刀H1 · 输出截断自愈:检测到腰斩则输出上限×2重试(≤2次·bump后全程沿用)
    var _budgetWarned = 0;   // 工具D · 预算反馈：分级提醒收尾(70%/90%)·避免硬撞 tokenBudget 半途而废
    // 刀G3(CC「File unchanged since last read」对照) · 重复读去重 + 纯勘察防打转
    var _seenReads = {};        // key=name|JSON(input) → {iter, writes}(写世代号=新鲜度)
    var _writeCount = 0;        // 累计成功写入笔数·任何写入即令全部旧读记录过期
    var _readOnlyStreak = 0, _spinWarned = 0;
    var _editingMode = !planOnly && !reviewOnly && !qaOnly && !explainOnly;   // 只读模式纯勘察是本分·豁免
    // 刀G5(CC TodoWrite 对照) · 任务表:起跑重置·节流提醒(≥3轮未更新且有未完项·折叠进工具结果不伪造独立轮)
    _todoState.list = [];
    if (Array.isArray(opts.initialTodos)) {   // 刀H3(CC resume 恢复 TodoWrite 对照) · 会话恢复:续接时回灌上次任务表(未完项接着干)
      _todoState.list = opts.initialTodos.filter(function (t0) { return t0 && t0.content && /^(pending|in_progress|completed)$/.test(t0.status || ''); }).slice(0, 20).map(function (t0) { return { content: String(t0.content).slice(0, 200), status: t0.status }; });
    }
    var _todoLastRound = 0, _todoRemindedAt = 0;
    var _todoFinishBounced = false;   // 刀G7(CC verification nudge 对照) · finish 时任务表有未完项→顶回一次(仅一次·防死循环)
    // 刀G4 · 外部修改防护:起跑对全部顶层区段留指纹·agent 读/写都刷新·写前对照揪外部改动
    var _extSnap = {};
    try { Object.keys(draft || {}).forEach(function (rk) { _extSnap[rk] = _fpOf(draft[rk]); }); } catch (eSn) {}
    function _refreshSnap(roots) {
      if (!roots) { try { Object.keys(draft || {}).forEach(function (rk2) { _extSnap[rk2] = _fpOf(draft[rk2]); }); } catch (eR) {} return; }
      roots.forEach(function (r0) { if (r0) { try { _extSnap[r0] = _fpOf(draft[r0]); } catch (eR2) {} } });
    }
    // 刀G8(CC autocompact 对照) · 宏压缩:微压缩不够(预算高水位)或上下文超窗时·让模型把旧对话写成
    //   七段结构化前情摘要·替换旧对话(保留近尾原文)·续跑对话(priorConversation 无限增长)与小窗口模型最受益。
    //   熔断:每次运行最多 2 次尝试·失败不重试不阻断(继续不压)。对话太小(压了也救不了)不尝试。
    var _macroTries = 0, _macroDone = 0;
    var _macroAt = (opts.macroCompactAt != null ? opts.macroCompactAt : 0.85);   // 主动触发水位(×maxTokens)
    var _macroKeepTail = (opts.macroKeepTail != null ? opts.macroKeepTail : 6);  // 压缩后保留的近尾原文条数
    function _applyMacroResult(summary, reasonTag) {
      var tail = _compactTailSlice(conversation, _macroKeepTail);
      var head = _macroHead(summary, draft, surfaces, tail.length, _macroUserLines(conversation, tail.length, opts.macroUserKeep));
      conversation.length = 0;
      conversation.push({ role: 'user', text: head });
      for (var ti = 0; ti < tail.length; ti++) conversation.push(tail[ti]);
      _seenReads = {};   // "与第N轮相同"的轮次引用随压缩失效·全部作废
      _convRecount(); tokensUsed = _reqTokens();
      _macroDone++;
      record('macroCompact', { trigger: reasonTag, attempt: _macroTries }, { ok: true, summaryChars: summary.length, keptTail: tail.length, tokensAfter: tokensUsed });
    }
    function _macroCompact(reasonTag) {
      if (_macroTries >= 2 || _convTok < 6000) return Promise.resolve(false);   // 熔断 + 对话太小不救
      _macroTries++;
      var flat = _flattenForSummary(conversation, _macroTries === 1 ? 0.45 : 0.2);   // 二次尝试再砍半(摘要请求自身超限的退路)
      if (typeof opts.onText === 'function') { try { opts.onText('（上下文过长，正在压缩前情摘要…）', iterations); } catch (eOt) {} }
      return Promise.resolve(caller([{ role: 'user', text: _macroSummaryAsk(flat) }], _MACRO_SUM_TOOLS, { maxTok: Math.max(4000, opts.maxTok || 0), maxRetries: 1, cfg: opts.cfg2 || _secondaryCfg() || opts.cfg, system: _MACRO_SUM_SYS, signal: control.signal }))   // 刀H1 · 后台请求不放大重试(CC 对照)·S3 · 摘要=杂活走次要模型
        .then(function (r) {
          var s = _macroPickSummary(r);
          if (s.length < 200) return false;   // 摘要太薄不可信·按失败处理(不替换对话)
          _applyMacroResult(s, reasonTag);
          return true;
        })
        .catch(function (eM) {
          try { console.warn('[authoring-agent] 宏压缩失败(继续不压)', eM); } catch (eW) {}
          return false;
        });
    }
    // 刀G8 · 终局失败保留已完成工作(CC「错误不炸掉会话」对照):reject 前把过程状态挂上错误对象·调用方可续
    function _fail(e) {
      try { e.partial = { conversation: conversation, transcript: transcript, todos: _todoState.list.slice(), draft: draft, tokensUsed: tokensUsed, iterations: iterations }; } catch (eP) {}
      throw e;
    }

    function record(name, input, result) {
      transcript.push({ name: name, input: input, result: result });
      if (typeof opts.onStep === 'function') {
        try { opts.onStep({ name: name, input: input, result: result, iteration: iterations, tokensUsed: tokensUsed, budget: maxTokens }); } catch (e) {}   // S10 · budget=预算上限(UI 上下文余量表)
      }
    }

    function step() {
      if (control.aborted) { stopReason = 'aborted'; return Promise.resolve(); }   // 刀E · 轮间中断
      if (iterations >= maxIterations) { stopReason = 'maxIterations'; return Promise.resolve(); }
      _convRecount(); tokensUsed = _reqTokens();   // 刀G1 · 每轮真算(体量小·全量重估防漂移)
      if (tokensUsed > maxTokens * 0.5) {   // 工具D · 半程后压旧工具结果+旧入参·控窗口(压后重算)
        try { _compactOldToolResults(conversation, 6); _convRecount(); tokensUsed = _reqTokens(); } catch (e) {}
      }
      // 刀G8 · 预算高水位主动宏压缩:微压缩后仍超水位 → 压成前情摘要后重入本轮(硬撞 tokenBudget 前自救)。
      //   条件与 _macroCompact 内部守卫严格一致(压必推进 _macroTries)·不会无限重入。
      if (tokensUsed >= maxTokens * _macroAt && _macroTries < 2 && _convTok >= 6000) {
        return _macroCompact('budget-high').then(step);
      }
      if (tokensUsed >= maxTokens) { stopReason = 'tokenBudget'; return Promise.resolve(); }   // 刀G8 · 硬停挪到压缩之后(先自救再认命)
      iterations++;
      return Promise.resolve(caller(conversation, tools, { maxTok: _curMaxTok || opts.maxTok, cfg: opts.cfg, system: system, signal: control.signal }))
        .then(function(resp) {
          stepRetries = 0;   // 成功一轮即重置：每个停顿点各容忍 maxStepRetries 次抖动
          var text = (resp && resp.text) || '';
          var calls = (resp && resp.toolCalls) || [];
          // 刀H1(CC max_tokens 动态调整对照) · 输出截断自愈:被 maxTok 腰斩(没调成工具/入参 JSON 斩断)
          //   → 输出上限×2重试本轮。斩断的响应整体弃置(完好的调用也未执行·重试无双跑)。
          if (resp && resp.truncated && (!calls.length || resp.badToolJson) && _tokBumps < 2 && !control.aborted) {
            _tokBumps++;
            _curMaxTok = Math.min(16000, (_curMaxTok || opts.maxTok || 3000) * 2);
            if (typeof opts.onText === 'function') { try { opts.onText('（输出被截断·提升输出上限至 ' + _curMaxTok + ' 重试本轮…）', iterations); } catch (eB) {} }
            iterations--;
            return step();
          }
          // 刀G1 · 不再零星累加(响应文本随消息入对话后由 _reqTokens 全量重估)
          if (text && typeof opts.onText === 'function') { try { opts.onText(text, iterations); } catch (e) {} }
          if (control.aborted) { conversation.push({ role: 'assistant', text: text, toolCalls: [] }); stopReason = 'aborted'; return; }   // 刀E · API 返回后即停，不再施改
          if (!calls.length) {
            conversation.push({ role: 'assistant', text: text, toolCalls: [] });
            // 刀G9 · 卡壳时若有用户插话:新指示本身就是推动力·直接注入重启(不耗 nudge 配额)
            if (_drainSteers()) return step();
            // 韧性：没调工具不直接放弃，先 nudge 推一把（卡住 → 重新发起）
            if (noToolNudges < maxNoToolNudges && !control.aborted) {
              noToolNudges++;
              // 刀G7 · nudge 感知任务表:有未完项就点名(比泛泛"继续"更有的放矢)
              var _pNt = _todoState.list.filter(function (t) { return t.status !== 'completed'; });
              var _pNtTxt = _pNt.length ? '任务表尚有 ' + _pNt.length + ' 项未完成（如「' + _pNt[0].content + '」）。' : '';
              conversation.push({ role: 'user', text: '你刚才没有调用任何工具。' + _pNtTxt + '若已按要求改完，请调用 finish 并写明改动说明；若还没改完，请继续用工具（applyEdit/applyPush/multiEdit/...）修改后再 finish。' });
              if (typeof opts.onText === 'function') { try { opts.onText('（未检测到工具调用，正在提示 agent 继续…）', iterations); } catch (e) {} }
              return step();
            }
            stopReason = 'noToolCalls';
            return;
          }
          var toolResults = [];
          var finishAccepted = false;
          var _ci = 0;
          function _procCall() {
            if (_ci >= calls.length || finishAccepted) return Promise.resolve();
            var c = calls[_ci++];
            return Promise.resolve().then(function () {
              c._stateBefore = _toolStateHash(draft, c.name, c.input);
              if (c.name === 'finish') {
                // 刀G9 · 有未处理的用户插话 → 不许收尾(新指示可能改变需求·队列随轮末注入·处理完自然放行)
                if (control.steers.length) {
                  return { ok: false, finish: false, errorCode: 'steer-pending', reason: '用户在你工作期间发来了新指示（见下一条消息）。请先按新指示处理，再重新 finish。' };
                }
                // 刀G7 · 收尾闸:任务表尚有未完项 → 顶回一次(完成或先 todoWrite 更新表·仅顶一次不计入 finishAttempts)
                var _pTd = _todoState.list.filter(function (t) { return t.status !== 'completed'; });
                if (_pTd.length && !_todoFinishBounced) {
                  _todoFinishBounced = true;
                  return { ok: false, finish: false, errorCode: 'todos-pending', reason: '任务表尚有 ' + _pTd.length + ' 项未完成：' + _pTd.slice(0, 3).map(function (t) { return '「' + t.content + '」'; }).join('、') + (_pTd.length > 3 ? ' 等' : '') + '。请逐项完成并用 todoWrite 标 completed 后再 finish；若某项经查确实不需要做，先用 todoWrite 更新任务表（移除或改写该项）再 finish。' };
                }
                var blocking = _blockingViolations(validateDraft(draft), blockingChecks);
                if (blocking.length) { finishAttempts++; return { ok: false, finish: false, reason: '\u8349\u7a3f\u4ecd\u6709 ' + blocking.length + ' \u9879\u5fc5\u4fee\u8fdd\u89c4\uff0c\u7981\u6b62\u7ed3\u675f\uff0c\u8bf7\u5148\u4fee\u590d', violations: blocking }; }
                // \u5200\u2460(2026-07-10 \u667a\u80fd\u5347\u7ea7B)\uff1a\u8d28\u91cf\u95f8\u2014\u2014\u8fd0\u884c\u65f6\u5fc5\u5d29\u7ec4+\u5173\u7cfb\u4e00\u81f4\u6027\u4e0d\u5f97\u6bd4\u5f00\u5de5\u65f6\u66f4\u7cdf\uff08\u5b58\u91cf\u4e0d\u8ffd\u8d23\u00b7\u65b0\u75c5\u4e0d\u653e\u884c\u00b7\u6cbb\u5e26\u75c5\u6536\u5c3e\uff09
                if (qualityGateOn) {
                  var _gNow = _gateCounts(draft);
                  var _gWorse = _GATE_GROUPS.filter(function (g) { return (_gNow[g] || 0) > (_gateBaseline[g] || 0); });
                  if (_gWorse.length) {
                    finishAttempts++;
                    var _gDetail = [];
                    _gWorse.forEach(function (g) {
                      try { ((_checks[g](draft) || {}).violations || []).slice(0, 2).forEach(function (m) { _gDetail.push('[' + g + '] ' + m); }); } catch (_) {}
                    });
                    return { ok: false, finish: false, errorCode: 'quality-gate-worse',
                      reason: '\u8d28\u91cf\u95f8\uff1a\u4ee5\u4e0b\u68c0\u67e5\u6bd4\u5f00\u5de5\u65f6\u66f4\u7cdf\u00b7\u7981\u6b62\u6536\u5c3e\uff08\u628a\u672c\u6b21\u6539\u52a8\u5f15\u5165\u7684\u65b0\u95ee\u9898\u4fee\u6389\u518d finish\u00b7\u7528 validateDraft(group)/preflight \u5b9a\u4f4d\uff09\uff1a'
                        + _gWorse.map(function (g) { return g + '(' + (_gateBaseline[g] || 0) + '\u2192' + (_gNow[g] || 0) + ')'; }).join('\u3001'),
                      violations: _gDetail.slice(0, 8) };
                  }
                }
                _finishSummary = (c.input && c.input.summary) || ''; finishAccepted = true; return { ok: true, finish: true, summary: _finishSummary };
              }
              var deny = _permCheck(c.name, c.input, perms);
              if (deny) return { ok: false, reason: deny };
              // \u5200G3 \u00b7 \u91cd\u590d\u8bfb\u53bb\u91cd:\u540c\u540d\u540c\u53c2\u4e14\u671f\u95f4\u96f6\u5199\u5165 \u2192 \u77ed\u5b58\u6839(\u7701\u4e0a\u4e0b\u6587\u00b7\u9632\u539f\u5730\u6253\u8f6c\u00b7\u4e0d\u91cd\u8dd1)
              if (_READ_TOOLS[c.name]) {
                var _rk = c.name + '|' + (function () { try { return JSON.stringify(c.input || {}); } catch (eRk) { return String(c.input); } })();
                var _prevRead = _seenReads[_rk];
                if (_prevRead && _prevRead.writes === _writeCount) {
                  return { ok: true, unchanged: true, seenAtIteration: _prevRead.iter, reason: '\u7ed3\u679c\u4e0e\u7b2c ' + _prevRead.iter + ' \u8f6e\u5b8c\u5168\u76f8\u540c(\u671f\u95f4\u65e0\u4efb\u4f55\u5199\u5165)\u00b7\u8bf7\u76f4\u63a5\u5f15\u7528\u5148\u524d\u7ed3\u679c\u00b7\u52ff\u91cd\u590d\u67e5\u8be2' };
                }
                c._readKey = _rk;
              }
              // \u5200G4 \u00b7 \u5199\u524d\u65b0\u9c9c\u5ea6\u5bf9\u7167:\u76ee\u6807\u533a\u6bb5\u6307\u7eb9\u2260\u4e0a\u6b21\u6240\u89c1 \u2192 \u5916\u90e8(\u7f16\u8f91\u5668/\u7528\u6237)\u6539\u8fc7\u00b7\u62d2\u5199\u8981\u6c42\u91cd\u8bfb(\u52ff\u8986\u76d6\u7528\u6237\u6539\u52a8)
              if (_MUT_TOOLS[c.name]) {
                var _mr = _mutRoots(c.name, c.input);
                if (_mr) {
                  for (var _mi = 0; _mi < _mr.length; _mi++) {
                    var _r0 = _mr[_mi];
                    if (_r0 && _extSnap[_r0] !== undefined && _extSnap[_r0] !== _fpOf(draft[_r0])) {
                      return { ok: false, errorCode: 'external-modified', reason: '\u533a\u6bb5\u300c' + _r0 + '\u300d\u5728\u4f60\u4e0a\u6b21\u67e5\u770b\u540e\u88ab\u5916\u90e8\u4fee\u6539(\u5f88\u53ef\u80fd\u662f\u7528\u6237\u6b63\u5728\u7f16\u8f91\u5668\u91cc\u6539\u52a8)\u3002\u672c\u6b21\u5199\u5165\u5df2\u4e2d\u6b62\u2014\u2014\u8bf7\u5148 getFields \u91cd\u65b0\u8bfb\u53d6\u8be5\u533a\u6bb5\u6700\u65b0\u503c\u00b7\u5728\u65b0\u503c\u57fa\u7840\u4e0a\u518d\u6539\u00b7\u52ff\u8986\u76d6\u7528\u6237\u6539\u52a8\u3002' };
                    }
                  }
                }
              }
              return Promise.resolve().then(function () { return dispatchTool(draft, c.name, c.input, surfaces, control); }).catch(function (te) {
                if (control.aborted || (te && te.aborted)) return { ok: false, aborted: true, reason: '玩家已停止' };
                return { ok: false, reason: '\u5de5\u5177\u6267\u884c\u51fa\u9519\uff1a' + ((te && te.message) || te) + '\uff08\u8bf7\u68c0\u67e5\u53c2\u6570\u540e\u91cd\u8bd5\uff0c\u6216\u6362\u4e2a\u5de5\u5177/\u65b9\u5f0f\uff09' };
              });
            }).then(function (result) {
              result = result || { ok: false, reason: '工具未返回结果' };
              result = _attachWriteVerify(draft, c.name, c.input, result);   // 工具B · 写后回读：回挂变更后当前值
              var _stateAfter = _toolStateHash(draft, c.name, c.input);
              var _ok = result.ok !== false;
              var _spec = AUTHORING_TOOL_REGISTRY && AUTHORING_TOOL_REGISTRY.get ? AUTHORING_TOOL_REGISTRY.get(c.name) : null;
              if (!_spec) _spec = { name: c.name, effect: _MUT_TOOLS[c.name] ? 'draft-write' : (_READ_TOOLS[c.name] ? 'read' : 'control'), risk: 'low', version: '1' };
              var _changed = _MUT_TOOLS[c.name] ? (_ok && c._stateBefore !== _stateAfter) : (_ok && result.staged === true);
              var _verified = _ok && (_spec.effect === 'read' || _spec.effect === 'control' || _spec.effect === 'memory-write' || !_MUT_TOOLS[c.name] || c._stateBefore === _stateAfter || _changed);
              if (_MUT_TOOLS[c.name] && result.changed == null) result.changed = _changed;
              var _receipt = global.TM && global.TM.AgentKernel && typeof global.TM.AgentKernel.makeReceipt === 'function'
                ? global.TM.AgentKernel.makeReceipt(_spec, Object.assign({}, result, { ok: _ok }), { changed: _changed, verified: _verified, beforeHash: c._stateBefore, afterHash: _stateAfter, paths: _mutRoots(c.name, c.input) || [], provenance: 'authoring-draft' })
                : { tool: c.name, attempted: true, ok: _ok, changed: _changed, verified: _verified, beforeHash: c._stateBefore, afterHash: _stateAfter };
              control.toolReceipts.push(_receipt);
              if (_kernelRun && _kernelRun.trace && typeof _kernelRun.trace.add === 'function') _kernelRun.trace.add('tool_receipt', _receipt);
              // 模型只需紧凑回执；完整 ToolReceipt 留在本轮结果/trace，避免每轮上下文膨胀。
              result.receipt = { id: _receipt.id || '', tool: _receipt.tool, ok: _receipt.ok, changed: _receipt.changed, verified: _receipt.verified };
              // \u5200G3 \u00b7 \u8bfb/\u5199\u8bb0\u8d26:\u6210\u529f\u8bfb\u8bb0\u5165 _seenReads(\u5e26\u5f53\u524d\u5199\u4e16\u4ee3)\u00b7\u6210\u529f\u5199\u63a8\u8fdb\u4e16\u4ee3\u53f7(\u5176\u540e\u540c\u53c2\u8bfb\u653e\u884c)
              if (result && result.ok !== false) {
                if (c._readKey && !result.unchanged) _seenReads[c._readKey] = { iter: iterations, writes: _writeCount };
                if (_MUT_TOOLS[c.name] && _receipt.changed) _writeCount++;
                // \u5200G4 \u00b7 \u6307\u7eb9\u5237\u65b0:\u8bfb\u5230\u4ec0\u4e48/\u5199\u6210\u4ec0\u4e48\u90fd\u7b97"\u6700\u65b0\u6240\u89c1"(renameEntity \u8de8\u533a\u6bb5\u2192\u5168\u91cf\u5237\u65b0)
                if (_MUT_TOOLS[c.name]) _refreshSnap(c.name === 'renameEntity' ? null : _mutRoots(c.name, c.input));
                else if (_READ_TOOLS[c.name] && !result.unchanged) { var _rr0 = _readRootsOf(c.name, c.input); if (_rr0.length) _refreshSnap(_rr0); }
              }
              if (c.name === 'proposePlan' && result && result.plan) { _planResult = { steps: result.steps, summary: result.summary }; finishAccepted = true; }
              if (c.name === 'submitReview' && result && result.review) { _reviewResult = { findings: result.findings, summary: result.summary }; finishAccepted = true; }
              if (c.name === 'submitAnswer' && result && result.answered) { _qaResult = { answer: result.answer }; finishAccepted = true; }
              if (c.name === 'submitExplanation' && result && result.explained) { _explainResult = { summary: result.summary, points: result.points }; finishAccepted = true; }
              if (c.name === 'askClarification' && result && result.clarify) { _clarifyResult = { questions: result.questions }; finishAccepted = true; }
              if (c.name === 'remonstrate' && result && result.remonstrate) { _remonstrateResult = { concern: result.concern, severity: result.severity, suggestion: result.suggestion }; finishAccepted = true; }
              record(c.name, c.input, result);
              toolResults.push({ id: c.id, name: c.name, content: _resultToText(result) });
              return _procCall();
            });
          }
          return _procCall().then(function () {
            conversation.push({ role: 'assistant', text: text, toolCalls: calls });
            conversation.push({ role: 'tool', toolResults: toolResults });
            _convRecount(); tokensUsed = _reqTokens();   // 刀G1 · 本轮消息已入对话·重算真实体量(70/90%提醒按真口径)
            // 刀G9 · 运行中插话:本轮工具结果落定后注入(下一轮模型即见)。finish 刚被接受的瞬间来了新话
            //   → 撤回收尾继续处理(收尾后的新指示等价"追问"·同一循环内直接续·不丢话)
            if (control.steers.length && !control.aborted) {
              _drainSteers();
              if (finishAccepted) finishAccepted = false;
            }
            // 工具D · 预算反馈：接近上限分级提醒收尾(让 agent 自控节奏·别非必要检索)
            if (!finishAccepted && !control.aborted) {
              var _frac = tokensUsed / maxTokens;
              if (_frac >= 0.9 && _budgetWarned < 2) { _budgetWarned = 2; conversation.push({ role: 'user', text: '⚠ 预算已用约 ' + Math.round(_frac * 100) + '%·即将耗尽。请立刻完成最关键的改动并调用 finish·停止一切非必要的检索/校验。' }); }
              else if (_frac >= 0.7 && _budgetWarned < 1) { _budgetWarned = 1; conversation.push({ role: 'user', text: '（预算提示：已用约 ' + Math.round(_frac * 100) + '%·剩余有限。请优先收尾核心改动·非必要的 globalSearch/preflight 可省·尽快 finish。）' }); }
            }
            // 刀G3 · 防打转:编辑模式连续纯勘察(无写/无澄清/无计划) → 3/6 轮两级催动手(只读模式豁免)
            if (!finishAccepted && !control.aborted && _editingMode) {
              var _hadProgress = calls.some(function (cc) { return cc && (_MUT_TOOLS[cc.name] || cc.name === 'note' || cc.name === 'todoWrite' || cc.name === 'askClarification' || cc.name === 'remonstrate' || cc.name === 'flagUncertain' || cc.name === 'recordConvention'); });
              if (_hadProgress) { _readOnlyStreak = 0; _spinWarned = 0; }
              else {
                _readOnlyStreak++;
                if (_readOnlyStreak >= 6 && _spinWarned < 2) { _spinWarned = 2; conversation.push({ role: 'user', text: '⚠ 已连续 ' + _readOnlyStreak + ' 轮纯勘察·零改动。立即停止检索：要么用 applyEdit/multiEdit/bulkAdd 落实修改·要么 askClarification 说明卡在哪·要么 finish。' }); }
                else if (_readOnlyStreak >= 3 && _spinWarned < 1) { _spinWarned = 1; conversation.push({ role: 'user', text: '（你已连续 ' + _readOnlyStreak + ' 轮纯勘察未动手。信息应已足够——请开始落实修改；确有疑问用 askClarification·认为不该改用 remonstrate·勿再重复检索。）' }); }
              }
            }
            // 刀G5 · todo 节流提醒:任务表有未完项且 ≥3 轮没更新 → 折叠进本轮末条工具结果(CC 对照:不独立成消息·不伪造轮边界)
            if (!finishAccepted && !control.aborted) {
              if (calls.some(function (cc) { return cc && cc.name === 'todoWrite'; })) { _todoLastRound = iterations; }
              else {
                var _pendTd = _todoState.list.filter(function (t) { return t.status !== 'completed'; });
                if (_pendTd.length && toolResults.length && iterations - _todoLastRound >= 3 && iterations - _todoRemindedAt >= 3) {
                  _todoRemindedAt = iterations;
                  toolResults[toolResults.length - 1].content += '\n<系统提醒>任务表已 ' + (iterations - _todoLastRound) + ' 轮未更新·尚有 ' + _pendTd.length + ' 项未完(如「' + _pendTd[0].content + '」)。完成即标 completed·计划变了就重写整表·此提醒勿向用户提及。</系统提醒>';
                }
              }
            }
            if (finishAccepted) { finished = true; stopReason = _clarifyResult ? 'needsClarification' : (_remonstrateResult ? 'needsConfirmation' : (_explainResult ? 'explained' : (_qaResult ? 'answered' : (_reviewResult ? 'reviewed' : (_planResult ? 'planned' : 'finish'))))); return; }
            if (finishAttempts >= maxFinishAttempts) { stopReason = 'finishBlocked'; return; }
            return step();
          });
        })
        .catch(function(e) {
          if (control.aborted) { stopReason = 'aborted'; return; }
          if (e && e.overflow) {   // 刀G8 · 超限自愈(CC 两层恢复的层二):压缩前情后重试本轮·不计迭代
            iterations--;
            return _macroCompact('overflow').then(function (did) {
              if (did) return step();
              iterations++;   // 压不成(熔断/对话太小/摘要失败) → 恢复计数走原失败路径
              return _fail(e);
            });
          }
          if (e && e.transient && stepRetries < maxStepRetries) {   // 韧性：瞬态错误（429/5xx/网络）退避重试本轮
            stepRetries++;
            if (typeof opts.onText === 'function') { try { opts.onText('（网络/服务抖动，正在重试 ' + stepRetries + '/' + maxStepRetries + '…）', iterations); } catch (er) {} }
            iterations--;   // 重试不计入迭代预算
            return _delay(retryBaseMs * Math.pow(2, stepRetries - 1), control.signal).then(step).catch(function(delayErr) {
              if (control.aborted || (delayErr && delayErr.aborted)) { stopReason = 'aborted'; return; }
              throw delayErr;
            });
          }
          return _fail(e);   // 非瞬态 / 重试耗尽 → 维持 reject 语义(UI 显示失败)·刀G8:partial 挂已完成工作供调用方续
        });
    }

    return Promise.resolve().then(function () {
      /* M刀(CC memdir 对照) · 记忆召回：仅新会话首轮·6s 超时·失败静默跳过不阻塞主流程 */
      if (Array.isArray(opts.priorConversation) && opts.priorConversation.length) return '';
      if (opts.noMemoryRecall) return '';
      var _recallCtrl = typeof global.AbortController === 'function' ? new global.AbortController() : null;
      var _recallSignal = _recallCtrl ? _recallCtrl.signal : control.signal;
      var _parentAbort = null;
      if (_recallCtrl && control.signal && control.signal.addEventListener) {
        _parentAbort = function() { try { _recallCtrl.abort(control.signal.reason || 'aborted'); } catch (_) {} };
        control.signal.addEventListener('abort', _parentAbort, { once: true });
      }
      var _recallTimeout = _delay(6000, control.signal).then(function() { if (_recallCtrl) _recallCtrl.abort('memory-recall-timeout'); return ''; });
      return Promise.race([_recallMemories(userRequest, opts.cfg, opts.caller, _recallSignal), _recallTimeout])
        .catch(function () { return ''; })
        .then(function(v) {
          if (_parentAbort && control.signal && control.signal.removeEventListener) control.signal.removeEventListener('abort', _parentAbort);
          return v;
        });
    }).then(function (memBlk) {
      if (memBlk && conversation.length && conversation[0] && conversation[0].role === 'user') {
        conversation[0].text += '\n\n' + memBlk;
        _convRecount(); tokensUsed = _reqTokens();
      }
    }).then(step).then(function() {
      _releaseRun(control);   // 刀E · 成功/正常中止均注销本运行，不影响并行会审的其他句柄
      return {
        draft: draft, transcript: transcript, conversation: conversation,
        iterations: iterations, finished: finished, plan: _planResult, review: _reviewResult, answer: _qaResult, explanation: _explainResult, clarification: _clarifyResult, remonstrance: _remonstrateResult,
        finalValidation: validateDraft(draft), stopReason: stopReason,
        tokensUsed: tokensUsed, finishAttempts: finishAttempts,
        tokensBreakdown: { system: _sysTok, tools: _toolsTok, conversation: _convTok },   // 刀G1 · 真口径构成(UI/诊断用)
        macroCompactions: _macroDone,   // 刀G8 · 本次运行发生的宏压缩次数(诊断/UI 可提示"前情已压缩")
        steered: _steeredCount,   // 刀G9 · 本次运行注入的用户插话条数
        sideEffects: control.sideEffects.slice(),   // 记忆/技能等待玩家应用草稿后再提交
        toolReceipts: control.toolReceipts.slice(),   // attempted/ok/changed/verified 标准回执
        runTrace: _kernelRun ? _kernelRun.snapshot() : null,
        todos: _todoState.list.slice(),   // 刀G5 · 收尾时的任务表(全完成则已自动清空·UI 可渲染)
        summary: _finishSummary,   // 改动说明：做了什么+为什么
        notes: transcript.filter(function(t) { return t.name === 'note'; }).map(function(t) { return (t.input && t.input.text) || ''; }).filter(Boolean),
        // 方向B · agent 回写：发现的可长期沿用约定（交玩家「记住」）
        suggestedConventions: transcript.filter(function(t) { return t.name === 'recordConvention'; }).map(function(t) { return (t.input && t.input.convention) || ''; }).filter(Boolean),
        // 置信度标注：agent 没把握的改动（path + reason），UI 在 diff 里高亮
        uncertainties: transcript.filter(function(t) { return t.name === 'flagUncertain' && t.input && t.input.path; }).map(function(t) { return { path: t.input.path, reason: t.input.reason || '' }; }),
        // 刀2 · 自查证轨迹：国师写入前自核的史实声明（供玩家审 + 后续史官重点复核低把握项）
        historyChecks: transcript.filter(function(t) { return t.name === 'checkHistory'; }).reduce(function(acc, t) { return acc.concat((t.input && t.input.facts) || []); }, [])
      };
    }, function(err) {
      _releaseRun(control);
      throw err;
    });
  }

  /**
   * 方向H · 子代理 / 任务分解编排：大需求先分解成有序子任务（只读计划阶段），
   * 再逐个子任务在【同一 draft】上聚焦执行（共享可变 draft = 自动合并）。
   * 取代单 agent 线性硬啃——每个子任务范围小、不易超迭代上限/跑偏。
   * @param {object} draft @param {string} userRequest
   * @param {object} [opts] 透传 runAuthoringLoop 的 opts（editorContext/conventions/allowedCollections/allowDestructive/onStep/onText…）
   *   额外：opts.onSubtask({phase,index,total,task})·opts.subMaxIterations(每子任务迭代上限·默认 10)·opts.maxSubtasks(默认 12)
   * @returns {Promise<{orchestrated, steps, subResults, draft, finalValidation, summary, stopReason}>}
   */
  function runOrchestrated(draft, userRequest, opts) {
    opts = opts || {};
    var notify = function(p) { if (typeof opts.onSubtask === 'function') { try { opts.onSubtask(p); } catch (e) {} } };
    // Phase 1 · 分解：只读计划模式产出子任务步骤
    notify({ phase: 'decompose' });
    var planOpts = Object.assign({}, opts, { planOnly: true, onSubtask: undefined });
    return runAuthoringLoop(draft, userRequest, planOpts).then(function(planRes) {
      var steps = ((planRes.plan && planRes.plan.steps) || []).filter(function(s) { return s && String(s).trim(); });
      var maxSub = opts.maxSubtasks || 12;
      if (steps.length > maxSub) steps = steps.slice(0, maxSub);
      // 退化：没分解出多步 → 单次普通执行（不值得编排）
      if (steps.length <= 1) {
        notify({ phase: 'single' });
        var oneOpts = Object.assign({}, opts, { planOnly: false, reviewOnly: false, onSubtask: undefined });
        return runAuthoringLoop(draft, userRequest, oneOpts).then(function(r) {
          return { orchestrated: false, steps: steps, subResults: [r], draft: draft, finalValidation: r.finalValidation, summary: r.summary, stopReason: r.stopReason, sideEffects: (r.sideEffects || []).slice() };
        });
      }
      notify({ phase: 'plan', steps: steps });
      var subResults = [], i = 0, aborted = false;
      function next() {
        if (aborted || i >= steps.length) return Promise.resolve();
        var idx = i++; var task = String(steps[idx]);
        notify({ phase: 'subtask', index: idx + 1, total: steps.length, task: task });
        var subOpts = Object.assign({}, opts, {
          planOnly: false, reviewOnly: false,
          maxIterations: opts.subMaxIterations || 10,
          onSubtask: undefined,
          priorConversation: null   // 每子任务独立聚焦线程（共享 draft 即合并）
        });
        var prompt = '【子任务 ' + (idx + 1) + '/' + steps.length + '】' + task
          + '\n（这是大任务的一步，只完成这一步、别越界做其它步骤；完成后用 validateDraft 自查并 finish。整体目标："' + userRequest + '"）';
        return runAuthoringLoop(draft, prompt, subOpts).then(function(r) {
          subResults.push({ task: task, result: r });
          if (r.stopReason === 'aborted') aborted = true;   // 中断则停止后续子任务
          return next();
        });
      }
      return next().then(function() {
        var doneN = subResults.filter(function(s) { return s.result.finished; }).length;
        var summary = '已分解为 ' + steps.length + ' 个子任务，完成 ' + doneN + ' 个'
          + (aborted ? '（已中断）' : '') + '：' + steps.map(function(s, k) { return (k + 1) + '. ' + s; }).join('；');
        return {
          orchestrated: true, steps: steps, subResults: subResults, draft: draft,
          finalValidation: validateDraft(draft), summary: summary,
          stopReason: aborted ? 'aborted' : 'finish',
          sideEffects: subResults.reduce(function(all, s) { return all.concat((s.result && s.result.sideEffects) || []); }, [])
        };
      });
    });
  }

  // ───────────────────────────────────────────────
  //  刀3 · 对抗式三角色：国师拟稿 → 史官查史 + 谏官批平衡 → 国师据谏修订
  //  复用 reviewOnly 审阅模式（史官/谏官＝两种 reviewFocus 人格）+ 同一可变 draft。
  //  可选编排·不默认；一次跑 = 拟稿+史官+谏官+(修订) ≥3~4 次调用，比单 agent 贵，UI 侧按需触发。
  // ───────────────────────────────────────────────
  function _formatCritiques(histReview, balReview) {
    function fmt(title, rev) {
      if (!rev || !rev.findings || !rev.findings.length) return title + '：未发现需修订的问题。';
      var lines = rev.findings.map(function (f, i) {
        return (i + 1) + '. [' + (f.severity || '?') + '·' + (f.dimension || '') + '] '
          + (f.location ? ('〔' + f.location + '〕') : '') + (f.issue || '') + ' → 建议：' + (f.suggestion || '');
      });
      return title + (rev.summary ? ('（总评：' + rev.summary + '）') : '') + '\n' + lines.join('\n');
    }
    return fmt('◆ 史官·史实核查', histReview) + '\n\n' + fmt('◆ 谏官·平衡可玩', balReview);
  }

  function runWithCritics(draft, userRequest, opts) {
    opts = opts || {};
    var notify = function (p) { if (typeof opts.onCritique === 'function') { try { opts.onCritique(p); } catch (e) {} } };
    var steps = [];
    var baseClean = function (extra) {
      return Object.assign({}, opts,
        { reviewOnly: false, reviewFocus: null, planOnly: false, priorConversation: null, onCritique: undefined, onSubtask: undefined },
        extra || {});
    };
    // 1 · 国师拟稿（作者模式）
    notify({ phase: 'draft' });
    return runAuthoringLoop(draft, userRequest, baseClean()).then(function (authorRes) {
      steps.push({ role: '国师·拟稿', result: authorRes });
      // 拟稿被进谏/澄清打断（需玩家先定夺）→ 不进会审，原样交回
      if (authorRes.stopReason === 'needsConfirmation' || authorRes.stopReason === 'needsClarification') {
        return { draft: draft, critiqued: false, revised: false, steps: steps, findings: [],
          summary: '拟稿阶段国师有异议/待澄清，先交玩家定夺再会审', stopReason: authorRes.stopReason,
          remonstrance: authorRes.remonstrance, clarification: authorRes.clarification, authorConversation: authorRes.conversation,
          sideEffects: (authorRes.sideEffects || []).slice() };
      }
      // 2+3 · 史官 + 谏官 并行审（对已改 draft 只读，互不影响）
      notify({ phase: 'review' });
      var lowConf = (authorRes.historyChecks || []).filter(function (f) { return f && f.verdict && f.verdict !== '确信'; });
      var histReq = userRequest + (lowConf.length
        ? '\n\n【国师自核时把握不足、请你重点查证的史实】：\n' + lowConf.map(function (f) { return '· ' + f.claim + (f.note ? '（' + f.note + '）' : ''); }).join('\n')
        : '');
      var _c2 = opts.cfg2 || _secondaryCfg();   // S3 · 两官审阅=杂活·配了次要模型就分工给它(省主模型钱)
      return Promise.all([
        runAuthoringLoop(draft, histReq, baseClean(_c2 ? { reviewOnly: true, reviewFocus: 'history', cfg: _c2 } : { reviewOnly: true, reviewFocus: 'history' })),
        runAuthoringLoop(draft, userRequest, baseClean(_c2 ? { reviewOnly: true, reviewFocus: 'balance', cfg: _c2 } : { reviewOnly: true, reviewFocus: 'balance' }))
      ]).then(function (revs) {
        var histR = revs[0], balR = revs[1];
        steps.push({ role: '史官·史实审', result: histR });
        steps.push({ role: '谏官·平衡审', result: balR });
        var hf = (histR.review && histR.review.findings) || [];
        var bf = (balR.review && balR.review.findings) || [];
        var findings = [].concat(hf, bf);
        // 无问题 → 拟稿即终稿，省下修订那次调用
        if (!findings.length) {
          return { draft: draft, critiqued: true, revised: false, steps: steps, findings: findings,
            critiques: { history: histR.review, balance: balR.review },
            summary: '三堂会审：史官/谏官均未发现需修订的问题，拟稿即终稿', stopReason: 'finish',
            sideEffects: (authorRes.sideEffects || []).slice() };
        }
        // 4 · 国师据谏修订（审阅意见回灌进需求，作者模式）
        notify({ phase: 'revise', findings: findings });
        var reviseReq = '【三堂会审·修订】史官与谏官对你的拟稿提了以下意见，请逐条复核并修订当前剧本：采纳合理的；某条你判断不该改可以保留，但要在 finish 说明里言之有据。\n\n'
          + _formatCritiques(histR.review, balR.review)
          + '\n\n（原始需求："' + userRequest + '"）';
        return runAuthoringLoop(draft, reviseReq, baseClean()).then(function (revRes) {
          steps.push({ role: '国师·修订', result: revRes });
          return { draft: draft, critiqued: true, revised: true, steps: steps, findings: findings,
            critiques: { history: histR.review, balance: balR.review },
            summary: '三堂会审：拟稿 → 史官查史(' + hf.length + '条)+谏官批平衡(' + bf.length + '条) → 国师据谏修订',
            stopReason: revRes.stopReason,
            sideEffects: (authorRes.sideEffects || []).concat(revRes.sideEffects || []) };
        });
      });
    });
  }

  // 玩家手动选择的「自动选择工作模式」：只负责在本次请求里挑一条既有执行路线，
  // 绝不与权限模式混同，也不会成为默认后台行为。
  function selectWorkMode(userRequest, draft, opts) {
    opts = opts || {};
    var q = String(userRequest || '').trim();
    var perm = opts.permissionMode || 'review';
    var result = { mode: 'direct', label: '直接执行', risk: 'low', reason: '范围清楚，可由单一作者流程完成' };
    if (perm === 'plan') return { mode: 'plan', label: '先出计划', risk: 'low', reason: '玩家当前权限模式为「问策」' };

    var historicalRisk = /史实|考据|正史|年号|生卒|官制|历史人物/.test(q);
    var balanceRisk = /平衡|数值体系|经济系统|战斗系统|财政|人口模型|全局规则/.test(q);
    var destructiveRisk = /删除|清空|重置|重做|改名联动|迁移|合并势力|拆除/.test(q);
    var criticIntent = /三堂会审|会审|史官|谏官|严格复核|对抗审/.test(q);
    if (criticIntent || ((historicalRisk || balanceRisk) && destructiveRisk)) {
      return { mode: 'critics', label: '三堂会审', risk: 'high', reason: criticIntent ? '请求明确要求多角色复核' : '高影响改动同时涉及史实或平衡，先拟稿再双重审查' };
    }

    var stepSignals = (q.match(/并且|同时|以及|然后|再把|分别|逐个|全部|全面|一并|从头|重构|系统性/g) || []).length;
    var scopeSignals = (q.match(/人物|势力|地图|区划|关系|事件|时间线|官制|经济|军事|剧本/g) || []).length;
    if (/分解|编排|分步骤|多阶段/.test(q) || stepSignals >= 2 || (q.length >= 100 && scopeSignals >= 2)) {
      return { mode: 'orchestrate', label: '分解编排', risk: destructiveRisk ? 'high' : 'medium', reason: '需求跨多个步骤或剧本领域，拆成有序子任务更稳' };
    }

    var vague = q.length < 16 && /优化|完善|调整|改一下|处理一下|看看|继续/.test(q);
    if (!q || vague) return { mode: 'plan', label: '先出计划', risk: 'medium', reason: '目标较含混，先只读勘察并让玩家确认边界' };
    if ((historicalRisk && balanceRisk) || /高风险|不能出错|正式发布/.test(q)) {
      result = { mode: 'critics', label: '三堂会审', risk: 'high', reason: '史实与平衡同时受影响，需要独立复核' };
    }
    return result;
  }

  function runAutoSelected(draft, userRequest, opts) {
    opts = opts || {};
    var selection = selectWorkMode(userRequest, draft, opts);
    var runOpts = Object.assign({}, opts); delete runOpts.permissionMode;
    var p;
    if (selection.mode === 'plan') p = runAuthoringLoop(draft, userRequest, Object.assign(runOpts, { planOnly: true }));
    else if (selection.mode === 'orchestrate') p = runOrchestrated(draft, userRequest, runOpts);
    else if (selection.mode === 'critics') p = runWithCritics(draft, userRequest, runOpts);
    else p = runAuthoringLoop(draft, userRequest, runOpts);
    return Promise.resolve(p).then(function(res) {
      res = res || {};
      res.autoSelected = true; res.selectedMode = selection.mode; res.selection = selection;
      return res;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  S4 · diff + 编辑器 adapter（取剧本 / 提交保存）
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 深 diff：返回 before→after 的变更路径列表（用于批准前预览 agent 改了什么）。
   * @returns {Array<{path:string, type:'added'|'removed'|'changed', before?:*, after?:*}>}
   */
  function computeDiff(before, after, opts) {
    opts = opts || {};
    // 默认必须返回完整改动集；只有调用方显式给上限时才截断，并把 truncated 标志带回，提交端据此 fail closed。
    var maxEntries = opts.maxEntries == null ? Infinity : Math.max(0, Number(opts.maxEntries) || 0);
    var out = [];
    var truncated = false;
    function isObj(x) { return x && typeof x === 'object'; }
    function walk(a, b, path) {
      if (a === b) return;
      if (out.length >= maxEntries) { truncated = true; return; }
      if (a === undefined) { out.push({ path: path, type: 'added', after: b }); return; }
      if (b === undefined) { out.push({ path: path, type: 'removed', before: a }); return; }
      if (isObj(a) && isObj(b)) {
        var keys = Object.create(null);
        Object.keys(a).forEach(function(k) { keys[k] = 1; });
        Object.keys(b).forEach(function(k) { keys[k] = 1; });
        Object.keys(keys).forEach(function(k) {
          walk(a[k], b[k], path ? path + '.' + k : k);
        });
        return;
      }
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: path, type: 'changed', before: a, after: b });
    }
    walk(before, after, '');
    try { Object.defineProperty(out, 'truncated', { value: truncated, enumerable: false, configurable: true }); }
    catch (_) { out.truncated = truncated; }
    return out;
  }

  // UI·X · 从【实时 current】起只落接受的 hunk；拒绝项与国师运行期间的用户改动原样保留。
  // 若 current 在同一路径已偏离 diff.before，则判为并行冲突并拒绝整次应用，禁止旧草稿静默覆盖。
  function applySelectedDiffs(current, draft, diffs, isAccepted, opts) {
    opts = opts || {};
    function segs(path) { return String(path || '').split('.').filter(function(s) { return s !== ''; }); }
    function getAt(root, path) {
      if (_hasUnsafePathSegment(path)) return undefined;
      var ss = segs(path), o = root;
      for (var i = 0; i < ss.length; i++) { if (o == null || !_hasOwn(o, ss[i])) return undefined; o = o[ss[i]]; }
      return o;
    }
    function setAt(root, path, val) {
      if (_hasUnsafePathSegment(path)) throw new Error('unsafe diff path: ' + path);
      var ss = segs(path); if (!ss.length) return;
      var o = root;
      for (var i = 0; i < ss.length - 1; i++) {
        var k = ss[i];
        if (!_hasOwn(o, k) || o[k] == null || typeof o[k] !== 'object') { o[k] = /^\d+$/.test(ss[i + 1]) ? [] : {}; }
        o = o[k];
      }
      o[ss[ss.length - 1]] = val;
    }
    function delAt(root, path) {
      if (_hasUnsafePathSegment(path)) throw new Error('unsafe diff path: ' + path);
      var ss = segs(path); if (!ss.length) return;
      var o = root;
      for (var i = 0; i < ss.length - 1; i++) { if (o == null || !_hasOwn(o, ss[i])) return; o = o[ss[i]]; }
      if (o == null) return;
      var last = ss[ss.length - 1];
      if (Array.isArray(o) && /^\d+$/.test(last)) { o[+last] = undefined; }   // 留洞·稍后 compact
      else { try { delete o[last]; } catch (e) {} }
    }
    function parentArrayPath(path) {   // 若该路径末段是数组数字索引，返回父数组路径，否则 ''
      var ss = segs(path); if (ss.length < 1) return '';
      var last = ss[ss.length - 1]; if (!/^\d+$/.test(last)) return '';
      return ss.slice(0, ss.length - 1).join('.');
    }
    function sameValue(a, b) {
      if (a === b) return true;
      try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
    }
    var accept = (typeof isAccepted === 'function') ? isAccepted : function() { return true; };
    if (diffs && diffs.truncated) {
      var truncErr = new Error('改动预览不完整，已拒绝应用；请重新生成完整 diff');
      truncErr.code = 'diff-truncated';
      throw truncErr;
    }
    var accepted = (diffs || []).filter(function(d) { return accept(d); });
    var conflicts = [];
    accepted.forEach(function(d) {
      var path = String(d.path || '');
      if (_hasUnsafePathSegment(path)) { conflicts.push({ path: path, reason: 'unsafe-path' }); return; }
      var live = getAt(current, path);
      var expected = d.type === 'added' ? undefined : d.before;
      // 用户已手工改成与国师相同结果，视为幂等，不报冲突。
      if (!sameValue(live, expected) && !sameValue(live, d.after)) conflicts.push({ path: path, before: expected, current: live, after: d.after });
    });
    if (conflicts.length && !opts.allowConflicts) {
      var conflictErr = new Error('当前剧本有 ' + conflicts.length + ' 处与国师草稿并行冲突，未应用任何改动');
      conflictErr.code = 'edit-conflict';
      conflictErr.conflicts = conflicts;
      throw conflictErr;
    }
    var result = _agentClone(current);
    var touched = {};
    accepted.forEach(function(d) {
      var path = String(d.path || ''), pa = parentArrayPath(path);
      if (pa) touched[pa] = 1;
      if (d.type === 'removed') delAt(result, path);
      else setAt(result, path, _agentClone(d.after));
    });
    Object.keys(touched).forEach(function(pp) {
      var arr = getAt(result, pp);
      if (Array.isArray(arr)) setAt(result, pp, arr.filter(function(x) { return x !== undefined; }));
    });
    return result;
  }

  /** 旧编辑器（editor.html）：body = 全局 scriptData。 */
  function makeOldEditorAdapter(g) {
    g = g || global;
    // S5 · 文件身份（CC session↔cwd 对照）：旧编辑器一页一剧本·无库可切，openFile 仅同键命中。
    function _fileKey() { try { var sc = g.scriptData; return 'file:' + String((sc && (sc.id || sc.name)) || 'default'); } catch (e) { return 'file:default'; } }
    return {
      id: 'legacy-editor',
      label: '剧本编辑器',
      isAvailable: function() { return typeof g.scriptData !== 'undefined' && g.scriptData && typeof g.saveScript === 'function'; },
      getScenario: function() { return g.scriptData; },
      getFileKey: _fileKey,
      getFileLabel: function() { try { var sc = g.scriptData; return String((sc && sc.name) || '当前剧本'); } catch (e) { return '当前剧本'; } },
      openFile: function(key) { return Promise.resolve(String(key || '') === _fileKey()); },
      getContext: function() { return ''; },   // 旧编辑器 state 结构不同·暂不提供焦点上下文
      commit: function(draft) {
        var sd = g.scriptData;
        // 就地替换（保留引用·所有闭包仍指向它）；draft 是完整深拷贝·不会洗字段
        Object.keys(sd).forEach(function(k) { delete sd[k]; });
        Object.keys(draft).forEach(function(k) { sd[k] = draft[k]; });
        if (typeof g.renderAll === 'function') g.renderAll();
        if (typeof g.saveScript === 'function') g.saveScript();
        return { ok: true };
      }
    };
  }

  /** 新编辑器（scenario-editor-reset）：body = TM_SCENARIO_EDITOR_RESET_APP.state.scenario。 */
  function makeResetEditorAdapter(g) {
    g = g || global;
    function app() { return g.TM_SCENARIO_EDITOR_RESET_APP; }
    // S5 · 文件身份（CC session↔cwd 对照）：入库案卷用 proj:<案卷id>（改名不漂移·可按键重开）；
    //   未入库/官方直载的用 name:<剧本名>（弱键·只有恰好还开着才命中）。
    function _fileKey() {
      try {
        var a = app(), st = a && a.state;
        if (st && st.currentProjectId) return 'proj:' + String(st.currentProjectId);
        var sc = st && st.scenario;
        return 'name:' + String((sc && sc.name) || '未命名剧本');
      } catch (e) { return 'name:未命名剧本'; }
    }
    return {
      id: 'scenario-editor-reset',
      label: '剧本编辑器（新）',
      isAvailable: function() { var a = app(); return !!(a && a.state && typeof a.applyImportedScenario === 'function'); },
      getScenario: function() { return app().state.scenario; },
      getFileKey: _fileKey,
      getFileLabel: function() { try { var sc = app().state.scenario; return String((sc && sc.name) || '未命名剧本'); } catch (e) { return '未命名剧本'; } },
      // 会话切剧本（CC resume 切项目对照）：proj: 键走案卷库真载入；载不到（已删/库不可用）返回 false 交 UI 降级只读。
      openFile: function(key) {
        key = String(key || '');
        if (key === _fileKey()) return Promise.resolve(true);
        if (/^proj:/.test(key)) {
          var a = app();
          if (!a || typeof a.loadProjectSnapshot !== 'function') return Promise.resolve(false);
          try { return Promise.resolve(a.loadProjectSnapshot(key.slice(5))).then(function(snap) { return !!snap; }).catch(function() { return false; }); }
          catch (e) { return Promise.resolve(false); }
        }
        return Promise.resolve(false);
      },
      // 上下文感知（像 Claude code 知道你打开的文件）：读编辑器当前焦点——模块/集合/选中实体。
      getContext: function() {
        try {
          var a = app(); if (!a || !a.state) return '';
          var st = a.state, sc = st.scenario || {}, parts = [];
          if (st.selectedModuleId && Array.isArray(st.modules)) {
            var mod = st.modules.filter(function(m) { return m && m.id === st.selectedModuleId; })[0];
            if (mod && (mod.title || mod.name)) parts.push('当前模块：' + (mod.title || mod.name));
          }
          var field = st.selectedField;
          if (field && isBlocked(field)) {
            var candidates = (mod && Array.isArray(mod.topLevelKeys) ? mod.topLevelKeys : Object.keys(sc)).filter(function(k) { return !isBlocked(k); });
            field = candidates[0] || '';
          }
          if (field) {
            parts.push('当前集合/字段：' + field);
            var coll = sc[field], idx = st.selectedEntityIndex;
            if (Array.isArray(coll) && idx != null && coll[idx]) {
              var e = coll[idx], nm = e && (e.name || e.id || e.title);
              parts.push('选中第 ' + idx + ' 项' + (nm ? '「' + nm + '」' : ''));
            }
          }
          return parts.join('，');
        } catch (e) { return ''; }
      },
      commit: function(draft) {
        app().applyImportedScenario(draft, 'AI 助手生成', { preserveFocus: true });
        return { ok: true };
      }
    };
  }

  /** 自动探测当前页面所属编辑器。 */
  function detectAdapter(g) {
    g = g || global;
    var reset = makeResetEditorAdapter(g);
    if (reset.isAvailable()) return reset;
    var legacy = makeOldEditorAdapter(g);
    if (legacy.isAvailable()) return legacy;
    return null;
  }

  // ── Export ──
  var TM = global.TM = global.TM || {};
  TM.AuthoringAgent = {
    // S1
    makeDraft: makeDraft,
    isBlocked: isBlocked,
    applyEdit: applyEdit,
    applyPush: applyPush,
    applyRemove: applyRemove,
    _coerceEntityValue: _coerceEntityValue,   // 写工具入参 parse-or-reject 归一（onApply 元素级兜底/smoke）
    validateDraft: validateDraft,
    addCheck: addCheck,
    _checks: _checks,
    // S2
    loadEditorApiConfig: loadEditorApiConfig,
    loadConventions: loadConventions,
    saveConventions: saveConventions,
    callWithTools: callWithTools,
    // CC 对照三件套（2026-07-03）：记忆/技能/能力包——启停装卸=玩家权限走此 API(非 agent 工具)
    memories: { list: _loadMemories, save: saveMemoryEntry, remove: deleteMemory, recall: _recallMemories },
    skills: { list: listAllSkills, save: saveSkillEntry, remove: deleteSkill, builtin: BUILTIN_SKILLS },
    packs: { list: listPacks, setEnabled: setPackEnabled, importJSON: importPackJSON, exportJSON: exportPackJSON, remove: removePack },
    commitSideEffects: commitSideEffects,
    testConnection: testConnection,
    abort: abort,
    steer: steer,   // 刀G9 · 运行中插话(排队·下一轮注入·无活跃运行返回 false)
    estimateRun: estimateRun,
    AGENT_TOOLS: AGENT_TOOLS,
    TOOL_SPECS: AUTHORING_TOOL_SPECS,
    toolRegistry: AUTHORING_TOOL_REGISTRY,
    selectToolPacks: selectToolPacks,
    dispatchTool: dispatchTool,
    _compactOldToolResults: _compactOldToolResults,
    _compactTailSlice: _compactTailSlice,   // 刀G8 · 宏压缩尾部切片(smoke)
    _flattenForSummary: _flattenForSummary,   // 刀G8 · 摘要请求拍平(smoke)
    _OVERFLOW_RE: _OVERFLOW_RE,   // 刀G8 · 超限文案识别(smoke)
    _parseOpenAI: _parseOpenAI, _parseAnthropic: _parseAnthropic, _parseGemini: _parseGemini,   // 刀H1 · 截断 surfacing(smoke)
    _toOpenAI: _toOpenAI, _toAnthropic: _toAnthropic, _toGemini: _toGemini,   // S2 · 多模态映射(smoke)
    compactConversation: compactConversation,   // S10 · 手动前情压缩(Codex·CC /compact 对照)
    computeGaps: _computeGaps,
    preflight: preflight,
    ensureCharFactionId: ensureCharFactionId,
    ensureTimeFields: ensureTimeFields,
    buildExemplars: buildExemplars,
    buildEntityBundle: buildEntityBundle,
    mergeEntityBundle: mergeEntityBundle,
    applySelectedDiffs: applySelectedDiffs,
    runAuthoringLoop: runAuthoringLoop,
    runOrchestrated: runOrchestrated,
    runWithCritics: runWithCritics,   // 刀3 · 对抗式三角色：拟稿→史官+谏官→修订
    selectWorkMode: selectWorkMode,
    runAutoSelected: runAutoSelected,
    // S5
    ENTITY_TEMPLATES: ENTITY_TEMPLATES,
    buildSchemaGuide: buildSchemaGuide,
    // S4
    computeDiff: computeDiff,
    makeOldEditorAdapter: makeOldEditorAdapter,
    makeResetEditorAdapter: makeResetEditorAdapter,
    detectAdapter: detectAdapter
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.AuthoringAgent;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
