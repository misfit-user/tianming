// 官制创建的纯契约/预检：不改 GM/P，不任命，不扣费；实际落树仍由 office-reform owner 执行。
(function (root) {
  'use strict';
  var ADD = /^(增设|新设|设立|设置|新增|增置|创设|添设|建立|add|create)/i;
  var DEPT_ACTION = /^(create_department|add_department|new_department|设立部门|增设部门)$/;
  var POS_ACTION = /^(create_position|add_position|new_position|设立官职|增设官职)$/;
  var POWER_KEYS = ['taxCollect', 'militaryCommand', 'appointment', 'impeach', 'supervise', 'yinBu', 'judicial', 'works', 'drafting'];
  function name(value) { return typeof value === 'string' ? value.trim() : ''; }
  function isCreation(row) {
    return !!(row && typeof row === 'object' && (DEPT_ACTION.test(row.action) || POS_ACTION.test(row.action) ||
      (row.action === 'reform' && ADD.test(name(row.reformDetail))) || (!row.action && ADD.test(name(row.reformDetail)))));
  }
  function normalize(row) {
    if (!isCreation(row)) return null;
    var out = Object.assign({}, row, { action: 'reform', reformDetail: '增设' });
    out.dept = name(row.dept || row.department || (DEPT_ACTION.test(row.action) ? row.name : ''));
    out.position = name(row.position || row.positionName || (POS_ACTION.test(row.action) ? row.name : ''));
    out.newDept = name(row.newDept);
    if (DEPT_ACTION.test(row.action) && row.parentDept) { out.newDept = out.dept || out.newDept; out.dept = name(row.parentDept); }
    if (row.rank != null && row.newRank == null) out.newRank = row.rank;
    return out;
  }
  function refusal(message) { return { ok: false, code: 'office-creation-invalid', summary: message }; }
  function validName(value) { return !!value && value.length <= 100 && !/[\x00-\x1f<>]/.test(value) && ['__proto__', 'prototype', 'constructor'].indexOf(value) < 0; }
  function list(tree) {
    var rows = [], seen = new Set();
    function walk(ns, path) {
      if (!Array.isArray(ns)) throw Error('官制子树不是数组');
      ns.forEach(function (node) {
        if (!node || typeof node !== 'object' || seen.has(node) || rows.length >= 4000 || path.length > 32) throw Error('官制树含循环或超出检查预算');
        seen.add(node); var next = path.concat([name(node.name)]); rows.push({ node: node, siblings: ns, path: next });
        if (node.subs != null) walk(node.subs, next);
      });
    }
    walk(tree, []); return rows;
  }
  function rank(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9) return '正' + '一二三四五六七八九'[value - 1] + '品';
    if (typeof value !== 'string' || value.length > 80) throw Error('官职品级无效');
    return value;
  }
  function count(row) {
    var value = row.establishedCount != null ? row.establishedCount : row.headCount != null ? row.headCount : row.count != null ? row.count : 1;
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) value = Number(value);
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000) throw Error('官职编制须为 1 至 10000 的整数');
    return value;
  }
  function position(row, fallback) {
    if (typeof row === 'string') row = { name: row };
    if (!row || typeof row !== 'object' || !validName(name(row.name))) throw Error('官职名称缺失或无效');
    var n = count(row), result = { name: name(row.name), rank: rank(row.rank != null ? row.rank : fallback.newRank), holder: '',
      desc: name(row.desc || row.duties || fallback.reason), headCount: n, actualCount: 0, additionalHolders: [],
      establishedCount: n, vacancyCount: n, actualHolders: [] };
    if (row.salary != null) { if (typeof row.salary !== 'number' || !Number.isFinite(row.salary) || row.salary < 0) throw Error('官职俸禄无效'); result.salary = row.salary; }
    if (typeof row.perPersonSalary === 'string') result.perPersonSalary = row.perPersonSalary.slice(0, 80);
    if (['money', 'grain', 'cloth'].indexOf(row.salaryKind) >= 0) result.salaryKind = row.salaryKind;
    if (row.duties) result.duties = name(row.duties);
    if (row.authority) result.authority = name(row.authority);
    if (row.powers) {
      result.powers = {};
      POWER_KEYS.forEach(function (key) { if (Array.isArray(row.powers) ? row.powers.indexOf(key) >= 0 : row.powers[key] === true) result.powers[key] = true; });
    }
    return result;
  }
  function stableId(key, taken) {
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    var base = 'office_' + (h >>> 0).toString(36), id = base, suffix = 1;
    while (taken.has(id)) id = base + '_' + suffix++;
    taken.add(id); return id;
  }
  function prepare(tree, change, charterPositions) {
    try {
      var r = normalize(change);
      if (!r) return refusal('未识别的官制创建动作');
      if (!Array.isArray(tree)) return refusal('官制树结构无效，未执行创建');
      if (!validName(r.dept) || (r.newDept && !validName(r.newDept)) || (r.position && !validName(r.position))) return refusal('部门或官职名称缺失/无效，未执行创建');
      var rows = list(tree), parent = null, siblings = tree, path = [], targetName = r.newDept || r.dept;
      var postOnly = !!r.position && !r.newDept;
      if (r.newDept || postOnly) {
        var matched = rows.filter(function (entry) {
          if (r.deptId) return entry.node.id === r.deptId;
          if (Array.isArray(r.deptPath)) return JSON.stringify(entry.path) === JSON.stringify(r.deptPath);
          return entry.node.name === r.dept;
        });
        if (matched.length !== 1) return refusal(matched.length ? '同名部门不唯一，请提供 deptId 或完整 deptPath；未执行创建' : '未找到部门「' + r.dept + '」，未执行创建');
        parent = matched[0].node; path = matched[0].path;
        if (postOnly) targetName = parent.name;
        else { siblings = parent.subs || []; }
      }
      var nodes = postOnly ? [parent] : siblings.filter(function (n) { return n && n.name === targetName; });
      if (nodes.length > 1) return refusal('目标部门同名冲突，未执行创建');
      var existing = nodes[0] || null;
      var sourceRows = charterPositions || r.positions || (r.position ? [Object.assign({}, r, { name: r.position, rank: r.newRank })] : []);
      if (!Array.isArray(sourceRows) || sourceRows.length > 100) return refusal('新设官职表无效或超过 100 项');
      var positions = [], names = new Set();
      sourceRows.forEach(function (row) { var p = position(row, r); if (names.has(p.name)) throw Error('同一创建案重复列出官职「' + p.name + '」'); names.add(p.name); positions.push(p); });
      var oldPositions = existing && existing.positions || [];
      if (!Array.isArray(oldPositions)) return refusal('现有官职表不是数组，未执行创建');
      var additions = positions.filter(function (p) {
        var matches = oldPositions.filter(function (old) { return old && old.name === p.name; });
        if (matches.length > 1) throw Error('现有同名官职不唯一，未执行创建');
        if (!matches.length) return true;
        var prior = matches[0];
        if (count(prior) !== p.establishedCount || (p.rank && prior.rank && p.rank !== prior.rank)) throw Error('「' + p.name + '」已经存在且品级/编制不同；请明确提交调整，未重复创建');
        return false;
      });
      var taken = new Set(); rows.forEach(function (entry) { if (entry.node.id) taken.add(entry.node.id); (entry.node.positions || []).forEach(function (p) { if (p.id) taken.add(p.id); }); });
      var fullPath = postOnly ? path : path.concat([targetName]);
      additions.forEach(function (p) { p.id = stableId('position/' + fullPath.join('/') + '/' + p.name, taken); });
      var node = existing || { id: stableId('department/' + fullPath.join('/'), taken), name: targetName, desc: name(r.reason), positions: [], subs: [], functions: [] };
      return { ok: true, existing: !!existing, unchanged: !!existing && !additions.length, node: node, parent: parent, siblings: siblings,
        additions: additions, path: fullPath, postOnly: postOnly, reform: r, summary: (postOnly ? parent.name + '增设' + r.position : (r.newDept ? r.dept + '下增设' : '增设') + targetName) };
    } catch (error) { return refusal(error.message || '官制创建校验失败'); }
  }
  // 只识别明确的设署/设职句式；职责中的“税/水利/监察”不应盖过主动作。
  function fromEdict(text, tree) {
    text = String(text || '');
    if (text.length > 40000) return null;
    var verb = '(?:设立|增设|新设|增置|创设|添设|建立|设置|新增|设|立|置)';
    var dept = '([^，。、；;\\s「」《》“”]{1,30}?(?:司|部|院|监|处|局|署|府|所|馆|台|寺|卫|厂|科))';
    var role = '([^，。、；;\\s「」《》“”0-9一二两三四五六七八九十百千]{1,30}?(?:郎中|主事|尚书|侍郎|御史|少卿|员外郎|官|郎|卿|吏|丞|使|书|尉|监))';
    var quantity = '(?:\\s*([0-9零〇一二两三四五六七八九十百千]+)\\s*(?:人|员|名))?';
    var suffix = '(?=[，。；;、\\s「」《》“”]|$)';
    function re(pattern) { return new RegExp(pattern); }
    function escape(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function numeral(value) {
      if (!value) return 1;
      if (/^\d+$/.test(value)) return Number(value);
      var total = 0, current = 0, digits = '零一二三四五六七八九';
      for (var i = 0; i < value.length; i++) {
        var ch = value[i], n = ch === '两' ? 2 : ch === '〇' ? 0 : digits.indexOf(ch);
        if (n >= 0) current = n;
        else { var unit = { 十: 10, 百: 100, 千: 1000 }[ch]; if (!unit) return NaN; total += (current || 1) * unit; current = 0; }
      }
      return total + current;
    }
    var clean = text.replace(/^\s*(?:诏令|诏书|诏曰|圣旨|诏)\s*[:：]?\s*/, '').replace(/^\s*(?:今|兹|特|决定)\s*/, '');
    if (re('^(?:暂不|不得|不要|勿|暂缓|拟议|考虑|研究|讨论).{0,12}' + verb).test(clean)) return { blocked: true, changes: [], reason: '尚未决定设立或明确要求暂缓，未执行创建' };
    var clauses = clean.split(/[。；;\n]/), changes = [], currentDept = null, primary = false;
    var existing;
    try { existing = Array.isArray(tree) ? list(tree).sort(function (a, b) { return b.node.name.length - a.node.name.length; }) : []; } catch (_) { existing = []; }
    clauses.forEach(function (clause, clauseIndex) {
      clause = clause.trim(); if (!clause) return;
      var pieces = clause.split(/[，,]/), r = null;
      var rankMatch = clause.match(/(?:正|从)?[一二三四五六七八九]品/), rankValue = rankMatch ? rankMatch[0] : '';
      var main = pieces[0].trim(), m;
      for (var i = 0; i < existing.length && !r; i++) {
        var parent = existing[i], prefix = '^(?:在|于)?' + escape(parent.node.name) + '(?:之下|之内|下|内)?\\s*' + verb + '\\s*[「《“]?';
        m = re(prefix + dept + '[」》”]?' + suffix).exec(main);
        if (m) r = { action: 'reform', reformDetail: '增设', dept: parent.node.name, newDept: m[1], reason: clause };
        else {
          m = re(prefix + '(?:官职)?' + role + '[」》”]?' + quantity + suffix).exec(main);
          if (m) r = { action: 'reform', reformDetail: '增设', dept: parent.node.name, position: m[1], establishedCount: numeral(m[2]), newRank: rankValue, reason: clause };
        }
      }
      if (!r) {
        m = re('^' + verb + '\\s*[「《“]?' + dept + '[」》”]?' + suffix).exec(main);
        if (m) r = { action: 'reform', reformDetail: '增设', dept: m[1], newRank: rankValue, reason: clause };
      }
      if (r) {
        changes.push(r); currentDept = r.position ? null : r; if (clauseIndex === 0) primary = true;
        // 同一诏书的后句可引用前句刚设立的衙门；这里只增补解析上下文，不提前写树。
        if (!r.position && !existing.some(function (entry) { return entry.node.name === (r.newDept || r.dept); })) {
          existing.push({ node: { name: r.newDept || r.dept } });
          existing.sort(function (a, b) { return b.node.name.length - a.node.name.length; });
        }
      }
      if (currentDept) {
        pieces.slice(r ? 1 : 0).forEach(function (piece, pieceIndex) {
          var post = re('^\\s*(?:下)?' + verb + '\\s*' + role + quantity + suffix).exec(piece);
          if (!post) return;
          if (!currentDept.positions) currentDept.positions = [];
          var nextPiece = pieces[pieceIndex + (r ? 2 : 1)] || '';
          var postRank = (piece + '，' + nextPiece).match(/(?:正|从)?[一二三四五六七八九]品/);
          currentDept.positions.push({ name: post[1], rank: postRank ? postRank[0] : '', count: numeral(post[2]) });
        });
      }
    });
    return primary && changes.length ? { changes: changes, blocked: false } : null;
  }
  function preflight(tree, changes) {
    try {
      if (!Array.isArray(changes) || !changes.length || changes.length > 100) return refusal('官制创建案数量无效');
      list(tree); var copy = JSON.parse(JSON.stringify(tree));
      for (var i = 0; i < changes.length; i++) {
        var p = prepare(copy, changes[i]); if (!p.ok) return p;
        if (!p.existing) { if (p.parent) { if (!p.parent.subs) p.parent.subs = []; p.parent.subs.push(p.node); } else copy.push(p.node); }
        if (!p.node.positions) p.node.positions = []; p.additions.forEach(function (item) { p.node.positions.push(item); });
      }
      return { ok: true };
    } catch (error) { return refusal(error.message || '官制预检失败'); }
  }
  var api = { isCreation: isCreation, normalize: normalize, prepare: prepare, preflight: preflight, fromEdict: fromEdict, rank: rank };
  root.TM = root.TM || {};
  root.TM.OfficeCreation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
