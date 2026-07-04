// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-office-system.js — 官制 system (R161·R6·从 tm-hongyan-office.js 拆出)
// Domain: 官制 (品级/任免/officeTree/wealth init/权限判定)
// Status: active · Last Updated: 2026-05-03 (Phase 3 R6·从 tm-hongyan-office.js carve out)
// Owner: TM 团队
// Imports: GM·SettlementPipeline·findCharByName·CharEconEngine·callAI·extractJSON·toast·addEB·renderOfficeTree·findScenarioById
// Exports: 17 top-level functions·1 var (RANK_HIERARCHY)
//   - _offMigratePosition·_offMigrateTree·_offMaterializedCount·_offAllHolders
//   - _offAppointPerson·_offDismissPerson·_offVacateByCharName·_offSweepGhostHolders
//   - _offDeptStats·_offTreeStats·_offMaterialize·_settleOfficeMourning
//   - RANK_HIERARCHY·getRankLevel·getRankInfo·calcOfficialSatisfaction
//   - _inferPublicTreasuryByRank·_initOfficePublicTreasury·_parseRankNumber
//   - _inferPrivateWealthByRank·_parseWealthString·_initCharacterPrivateWealth
//   - _findPositionByCharName·canPerformAction
// Used by: tm-hongyan-office·tm-game-loop·tm-keju·tm-renwu-ui·tm-memorials·tm-tinyi-v3·tm-chaoyi-tinyi·tm-chaoyi-yuqian·tm-endturn-*·tm-save-lifecycle·tm-office-runtime·tm-office-panel·tm-office-editor·tm-ai-apply-deaths
// Side effects: 全局 functions·SettlementPipeline.register('office_mourning')·officeTree mutation·GM.chars wealth init
// Test: smoke-office-dynastification (33)
// Notes: R161 R6·从 tm-hongyan-office.js (jumbled domain) carve out 官制 部分·留 letter+render+edict 在原文件 (待 next slice 再拆)
//        - 原 L46-380: office helpers + RANK_HIERARCHY (~335 行)
//        - 原 L1953-1996: _offMaterialize (~44 行·async AI gen)
//        - 原 L1998-2033: _settleOfficeMourning (~36 行·SettlementPipeline)
//        - 原 L2938-3158: 公库/私产 init 体系 (~221 行)
//        - 原 L3160-3229: canPerformAction 权限判定 (~70 行)
//        - 原 L3236: SettlementPipeline.register('office_mourning', ...)
// ============================================================

// 官制双层模型——数据迁移与工具
// ============================================================

/** 迁移并双向同步 position 数据：老模型(headCount/actualCount/holder+additionalHolders) ↔ 新模型(establishedCount/vacancyCount/actualHolders) */
function _offMigratePosition(pos) {
  if (!pos || typeof pos !== 'object') return;

  // ── Step 1: 规范老字段 ──
  if (pos.headCount === undefined || pos.headCount === null || pos.headCount === '') pos.headCount = 1;
  if (typeof pos.headCount === 'string') { var _hc = parseInt(pos.headCount, 10); pos.headCount = isNaN(_hc) || _hc < 1 ? 1 : _hc; }
  if (!Array.isArray(pos.additionalHolders)) pos.additionalHolders = [];
  var _matCount = (pos.holder ? 1 : 0) + pos.additionalHolders.length;
  if (pos.actualCount === undefined) pos.actualCount = _matCount;

  // ── Step 2: 新字段——若已存在则以新字段为权威 ──
  if (pos.establishedCount == null) {
    pos.establishedCount = pos.headCount;
  } else {
    // 新字段已设 → 反向同步到老字段
    pos.headCount = pos.establishedCount;
  }
  if (pos.vacancyCount == null) {
    // 从老字段派生：缺员 = 编制 - 实有
    pos.vacancyCount = Math.max(0, pos.headCount - pos.actualCount);
  } else {
    // 新字段已设 → 反向同步 actualCount
    var _derivedActual = Math.max(0, pos.establishedCount - pos.vacancyCount);
    if (pos.actualCount < _derivedActual) pos.actualCount = _derivedActual;
    else if (pos.actualCount > _derivedActual && _matCount <= _derivedActual) pos.actualCount = _derivedActual;
  }

  // ── Step 3: actualHolders——若未存在则从老字段(holder + additionalHolders)构建 ──
  if (!Array.isArray(pos.actualHolders)) {
    var ah = [];
    if (pos.holder) ah.push({ name: pos.holder, generated: true });
    pos.additionalHolders.forEach(function(nm) {
      if (nm && !ah.some(function(h){return h.name===nm;})) ah.push({ name: nm, generated: true });
    });
    // 补占位到 actualCount 长度
    while (ah.length < pos.actualCount) {
      ah.push({ name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8) });
    }
    pos.actualHolders = ah;
  } else {
    // 新字段已存在——反向同步到老字段（holder + additionalHolders）
    var namedArr = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
    pos.holder = namedArr[0] || '';
    pos.additionalHolders = namedArr.slice(1);
    // 反向同步 actualCount
    if (pos.actualHolders.length > pos.actualCount) pos.actualCount = pos.actualHolders.length;
  }

  // 单人俸禄兼容
  if (!pos.perPersonSalary && pos.salary) pos.perPersonSalary = pos.salary;
  if (!pos.salary && pos.perPersonSalary) pos.salary = pos.perPersonSalary;

  pos._migrated = true;
}

/** 迁移整棵官制树 */
function _offMigrateTree(tree) {
  if (!tree) return;
  _offWalkOfficeTree(tree, function(n) {
    (n.positions||[]).forEach(function(p) { _offMigratePosition(p); });
  });
}

/** 获取职位的具象人数——优先新模型 actualHolders，降级老模型 */
function _offMaterializedCount(pos) {
  if (Array.isArray(pos.actualHolders)) {
    return pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).length;
  }
  return (pos.holder ? 1 : 0) + (pos.additionalHolders ? pos.additionalHolders.length : 0);
}

/** 获取职位的所有具象角色名列表——优先新模型 */
function _offAllHolders(pos) {
  if (Array.isArray(pos.actualHolders)) {
    return pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  }
  var arr = [];
  if (pos.holder) arr.push(pos.holder);
  if (pos.additionalHolders) arr = arr.concat(pos.additionalHolders);
  return arr;
}

function _offWalkOfficeTree(nodes, visitor, chain) {
  for (var i = 0; i < (nodes || []).length; i++) {
    var n = nodes[i];
    if (!n) continue;
    var curChain = chain ? (chain + '·' + (n.name || '')) : (n.name || '');
    if (visitor(n, curChain) === false) return false;
    if (n.subs && _offWalkOfficeTree(n.subs, visitor, curChain) === false) return false;
  }
  return true;
}

function _offNormalizeTitleName(title) {
  var t = String(title == null ? '' : title).replace(/\s+/g, '').replace(/^[·、，,。；;]+|[·、，,。；;]+$/g, '');
  return /^(无|无职|未任|布衣|—|-|null|undefined)$/i.test(t) ? '' : t;
}

function _offUniqueTitles(list) {
  var out = [];
  (list || []).forEach(function(t) {
    t = _offNormalizeTitleName(t);
    if (t && out.indexOf(t) < 0) out.push(t);
  });
  return out;
}

// 官职后缀（识别 title 段是否真官职·防吸收描述/状态垃圾）
var _OFF_TITLE_SUFFIX = /(尚书|侍郎|大学士|学士|都御史|通政使|寺卿|少卿|祭酒|司业|总督|总制|经略|督师|提督|巡抚|总兵|副总兵|参将|游击|布政使|按察使|参政|参议|知府|同知|知州|知县|给事中|詹事|洗马|修撰|编修|检讨|监正|监副|院使|宗人令|宗正|都督|都指挥|指挥使|镇抚|太师|太傅|太保|少师|少傅|少保)/;
function _offGetCharOfficeTitles(ch) {
  if (!ch) return [];
  var arr = [];
  if (ch.officialTitle) arr.push(ch.officialTitle);
  if (Array.isArray(ch.officialTitles)) arr = arr.concat(ch.officialTitles);
  if (Array.isArray(ch.concurrentTitles)) arr = arr.concat(ch.concurrentTitles);
  if (ch.concurrentTitle) String(ch.concurrentTitle).split(/[、,，;；\s]+/).forEach(function(t){ arr.push(t); });
  // 补：title 字段里 officialTitle 缺的官职段（剧本完整描述常落 title·治兼职丢高职，如张瑞图 title 含礼部尚书）。
  //   保留 officialTitle 原项不拆（保状态）；官职后缀过滤防垃圾；跳含罢/致仕等状态段。
  if (ch.title && ch.title !== ch.officialTitle && !/罢|致仕|削籍|闲住|闲居|告归|乞休|夺职|守制|丁忧/.test(ch.officialTitle || '')) {
    String(ch.title).split(/[·、，,；;]/).forEach(function(seg){
      var raw = String(seg || '').trim();
      if (!raw || /罢|致仕|丁忧|守制|削籍|闲住|闲居|告归|养病|候起|候简|前任|原任/.test(raw)) return;
      var clean = raw.replace(/[（(].*?[)）]/g, '').replace(/^(前|原|署理?|权|试|兼署?|兼理|兼管|兼|加授?|加衔|加|赠|追|带管|协理)/, '').trim();
      if (clean.length >= 2 && _OFF_TITLE_SUFFIX.test(clean) && !arr.some(function(x){ return String(x).indexOf(clean) >= 0; })) arr.push(clean);
    });
  }
  return _offUniqueTitles(arr);
}

// 显示用·把某人全部官职(主职⊕兼职)拼为一行供 UI 显示多职(非仅主职)·主兼以「兼」连·兼职间顿号
// opts.fallback: 无规范官职时兜底文案(默认 '')
function _offFormatCharTitles(ch, opts) {
  opts = opts || {};
  var titles = _offGetCharOfficeTitles(ch);
  if (!titles.length) return (opts.fallback != null) ? opts.fallback : '';
  if (titles.length === 1) return titles[0];
  return titles[0] + '　兼　' + titles.slice(1).join('、');
}

function _offIsConcurrentAppointment(spec, text) {
  spec = spec || {};
  if (spec.concurrent === true || spec.keepExisting === true || spec.keepCurrentOffice === true || spec.keepCurrent === true) return true;
  if (spec.mode === 'concurrent' || spec.appointmentMode === 'concurrent' || spec.action === 'concurrent') return true;
  var flag = String(spec.concurrent == null ? '' : spec.concurrent).toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes' || flag === 'y' || flag === '是' || flag === '兼任') return true;
  var raw = [
    text || '',
    spec.reason || '',
    spec.note || '',
    spec.raw || '',
    spec.mode || '',
    spec.action || '',
    spec.verb || ''
  ].join(' ');
  return /兼任|兼职|加兼|兼领|兼署|兼管|兼摄|兼差|兼掌|兼督|兼理/.test(raw);
}

function _offAddCharOfficeTitle(ch, title, opts) {
  if (!ch) return [];
  opts = opts || {};
  title = _offNormalizeTitleName(title);
  if (!title) return _offGetCharOfficeTitles(ch);

  var existing = _offGetCharOfficeTitles(ch);
  var currentMain = _offNormalizeTitleName(ch.officialTitle || '');
  var titles;

  if (opts.concurrent && currentMain && currentMain !== title) {
    titles = _offUniqueTitles([currentMain].concat(existing).concat([title]));
    ch.officialTitle = currentMain;
    if (!ch.position) ch.position = currentMain;
  } else {
    titles = _offUniqueTitles([title].concat(opts.keepConcurrent ? existing.filter(function(t){ return t !== title; }) : []));
    ch.officialTitle = title;
    ch.position = title;
  }

  var main = _offNormalizeTitleName(ch.officialTitle || '');
  var concurrent = titles.filter(function(t) { return t && t !== main; });
  ch.officialTitles = _offUniqueTitles([main].concat(concurrent));
  ch.concurrentTitles = concurrent;
  ch.concurrentTitle = concurrent.join('、');
  return ch.officialTitles;
}

function _offRemoveCharOfficeTitle(ch, title) {
  if (!ch) return [];
  title = _offNormalizeTitleName(title);
  if (!title) return _offGetCharOfficeTitles(ch);
  var titles = _offGetCharOfficeTitles(ch).filter(function(t) { return t !== title; });
  if (_offNormalizeTitleName(ch.officialTitle || '') === title) {
    ch.officialTitle = titles[0] || '';
  }
  if (_offNormalizeTitleName(ch.position || '') === title) {
    ch.position = ch.officialTitle || '';
  }
  var main = _offNormalizeTitleName(ch.officialTitle || '');
  var concurrent = titles.filter(function(t) { return t && t !== main; });
  ch.officialTitles = _offUniqueTitles((main ? [main] : []).concat(concurrent));
  ch.concurrentTitles = concurrent;
  ch.concurrentTitle = concurrent.join('、');
  // 同步描述性 title·否则卸任后 title 仍是旧官职·廷议等 137 处 `officialTitle||title` 回退会显示已失之职
  ch.title = main;
  return ch.officialTitles;
}

function _offFindPositionByName(positionName, deptHint, tree) {
  if (!positionName) return null;
  tree = tree || (typeof GM !== 'undefined' && GM.officeTree) || [];
  var found = null;
  var target = String(positionName || '').trim();
  var hint = String(deptHint || '').trim();
  function _matchDept(chain, nodeName) {
    if (!hint) return true;
    return chain.indexOf(hint) >= 0 || String(nodeName || '').indexOf(hint) >= 0;
  }
  function _matchPos(posName, strict) {
    if (!posName) return false;
    if (posName === target) return true;
    if (strict) return false;
    return target.indexOf(posName) >= 0 || posName.indexOf(target) >= 0;
  }
  function _search(strict, requireDept) {
    _offWalkOfficeTree(tree, function(n, curChain) {
      if (found || !n) return false;
      if (!requireDept || _matchDept(curChain, n.name)) {
        (n.positions || []).forEach(function(p) {
          if (found || !p) return;
          if (_matchPos(p.name || '', strict)) found = { pos: p, node: n, dept: n.name || '', deptPath: curChain };
        });
      }
      return found ? false : true;
    });
  }
  _search(true, !!hint);
  if (!found && hint) _search(true, false);
  if (!found) _search(false, !!hint);
  if (!found && hint) _search(false, false);
  return found;
}

function _offSeatPersonInPosition(pos, person, opts) {
  opts = opts || {};
  if (!pos || !person) return { ok: false, reason: 'missing position/person' };
  _offMigratePosition(pos);
  var namedBefore = _offAllHolders(pos);
  var oldHolder = opts.oldHolder;
  if (oldHolder == null) oldHolder = pos.holder || namedBefore[0] || '';
  if (opts.replace !== false && oldHolder && oldHolder !== person) {
    if (typeof _offDismissPerson === 'function') _offDismissPerson(pos, oldHolder);
    else if (pos.holder === oldHolder) pos.holder = '';
  }
  if (typeof _offAppointPerson === 'function') _offAppointPerson(pos, person);
  else pos.holder = person;
  if (pos.publicTreasury) pos.publicTreasury.currentHead = person;
  if (!pos.holder) pos.holder = person;
  return { ok: true, oldHolder: oldHolder || '', holders: _offAllHolders(pos) };
}

/** 任命：把 person 装入 position 的 actualHolders（优先填占位；无占位则扩展） */
function _offAppointPerson(pos, person) {
  if (!pos || !person) return;
  _offMigratePosition(pos);
  if (!Array.isArray(pos.actualHolders)) pos.actualHolders = [];
  // ── 幽灵 holder 净化 ── 老剧本/老存档 holder 字段写了名字但 GM.chars 无此人·
  // 这种 ghost 占据 primary 位·新任会被挤为次席·导致 UI 渲染仍显「空缺」。
  // 任命前一律将 ghost 名转为占位·让新任能登 primary。
  try {
    if (typeof GM !== 'undefined' && Array.isArray(GM.chars)) {
      var charSet = {};
      GM.chars.forEach(function(c) { if (c && c.name) charSet[c.name] = true; });
      pos.actualHolders.forEach(function(h) {
        if (h && h.name && h.generated !== false && !charSet[h.name]) {
          // 名字存在但 chars 无此人 → ghost·转为空占位
          h._ghostPurged = h.name;
          h.name = '';
          h.generated = false;
          if (!h.placeholderId) h.placeholderId = 'ph_' + Math.random().toString(36).slice(2,8);
        }
      });
    }
  } catch(_){}
  // 若已有同名条目，跳过
  if (pos.actualHolders.some(function(h){return h && h.name === person && h.generated!==false;})) return;
  // 找第一个 generated:false 占位
  var slot = pos.actualHolders.find(function(h){return h && h.generated===false;});
  if (slot) {
    slot.name = person;
    slot.generated = true;
    slot.appointedTurn = (typeof GM!=='undefined' && GM.turn) || 0;
  } else {
    // 无占位——扩展一个（编制可能因此增加）
    pos.actualHolders.push({ name: person, generated: true, appointedTurn: (typeof GM!=='undefined' && GM.turn) || 0 });
    if (pos.actualHolders.length > pos.establishedCount) pos.establishedCount = pos.actualHolders.length;
    if (pos.actualHolders.length > pos.headCount) pos.headCount = pos.actualHolders.length;
    pos.actualCount = pos.actualHolders.length;
  }
  // 同步老字段
  var named = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  pos.holder = named[0] || '';
  pos.additionalHolders = named.slice(1);
  pos.actualCount = named.length + pos.actualHolders.filter(function(h){return h && h.generated===false;}).length;
  // vacancyCount 同步：编制 - 已任 (而非旧值)
  if (typeof pos.establishedCount === 'number') {
    pos.vacancyCount = Math.max(0, pos.establishedCount - named.length);
  }
}

/** 罢免：从 actualHolders 中移除 person，留下 generated:false 占位（不变更编制） */
function _offDismissPerson(pos, person) {
  if (!pos || !person) return;
  _offMigratePosition(pos);
  if (!Array.isArray(pos.actualHolders)) pos.actualHolders = [];
  var idx = pos.actualHolders.findIndex(function(h){return h && h.name === person;});
  if (idx >= 0) {
    // 替换为占位（保持位置计数）
    pos.actualHolders[idx] = { name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8), vacatedBy: person, vacatedTurn: (typeof GM!=='undefined' && GM.turn) || 0 };
  }
  var named = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  pos.holder = named[0] || '';
  pos.additionalHolders = named.slice(1);
}

/** 扫遍官制树·清除指定姓名的所有 holder 登记（死亡/贬谪/退隐级联）
 * 返回 { vacated: [{dept, pos, rank}...] } 供事件日志使用
 * reason: 'death' | 'demote' | 'retire' | 'exile' | 'execute'
 */
function _offVacateByCharName(charName, reason, tree) {
  if (!charName) return { vacated: [] };
  tree = tree || (typeof GM !== 'undefined' && GM.officeTree) || [];
  var vacated = [];
  _offWalkOfficeTree(tree, function(n, curChain) {
    (n.positions || []).forEach(function(p) {
      if (!p) return;
      // 新模型 actualHolders
      if (Array.isArray(p.actualHolders)) {
        var hitNew = p.actualHolders.some(function(h){ return h && h.name === charName && h.generated !== false; });
        if (hitNew) {
          _offDismissPerson(p, charName);
          vacated.push({ dept: n.name, pos: p.name, rank: p.rank || '', chain: curChain, reason: reason || '' });
        }
      }
      // 老模型 holder 直接匹配（即使已做 dismiss 也做兜底）
      if (p.holder === charName) {
        if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
        p.holderHistory.push({ name: charName, until: (typeof GM !== 'undefined' && GM.turn) || 0, reason: reason || '身故级联' });
        p.holder = '';
        p.holderSinceTurn = 0;
        // 公库头衔同步
        if (p.publicTreasury && p.publicTreasury.currentHead === charName) {
          p.publicTreasury.previousHead = charName;
          p.publicTreasury.currentHead = null;
        }
        vacated.push({ dept: n.name, pos: p.name, rank: p.rank || '', chain: curChain, reason: reason || '' });
      }
      // additionalHolders 兼容
      if (Array.isArray(p.additionalHolders)) {
        var ai = p.additionalHolders.indexOf(charName);
        if (ai >= 0) p.additionalHolders.splice(ai, 1);
      }
    });
  });
  return { vacated: vacated };
}

/** 扫全局·清除所有 alive===false 或找不到的 holder（endturn 兜底 sweep）
 * 用于捕获未发 character:death 事件但实际已死的角色遗留
 */
function _offSweepGhostHolders() {
  if (typeof GM === 'undefined' || !GM.officeTree) return { swept: [] };
  var swept = [];
  var _findCh = (typeof findCharByName === 'function') ? findCharByName : function(n){
    return (GM.chars||[]).find(function(c){ return c && c.name === n; });
  };
  _offWalkOfficeTree(GM.officeTree, function(n) {
    (n.positions || []).forEach(function(p) {
      if (!p) return;
      var names = [];
      if (p.holder) names.push(p.holder);
      if (Array.isArray(p.actualHolders)) {
        p.actualHolders.forEach(function(h){ if (h && h.name && h.generated !== false) names.push(h.name); });
      }
      var seen = {};
      names.forEach(function(nm){
        if (seen[nm]) return; seen[nm] = 1;
        var ch = _findCh(nm);
        if (!ch || ch.alive === false || ch.dead) {
          _offVacateByCharName(nm, 'ghost-sweep');
          swept.push({ name: nm, dept: n.name, pos: p.name });
        }
      });
    });
  });
  return { swept: swept };
}

/** 获取部门的聚合统计 */
function _offDeptStats(dept) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, vacant: 0, unmaterialized: 0, holders: [] };
  _offWalkOfficeTree([dept], function(n) {
    (n.positions||[]).forEach(function(p) {
      _offMigratePosition(p);
      stats.headCount += (p.headCount||1);
      stats.actualCount += (p.actualCount||0);
      var m = _offMaterializedCount(p);
      stats.materialized += m;
      _offAllHolders(p).forEach(function(h) { stats.holders.push(h); });
    });
  });
  stats.vacant = stats.headCount - stats.actualCount;
  stats.unmaterialized = stats.actualCount - stats.materialized;
  return stats;
}

/** 获取整棵树的聚合统计 */
function _offTreeStats(tree) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, depts: 0 };
  _offWalkOfficeTree(tree||[], function(n) {
    stats.depts++;
    (n.positions||[]).forEach(function(p) {
      _offMigratePosition(p);
      stats.headCount += (p.headCount||1);
      stats.actualCount += (p.actualCount||0);
      stats.materialized += _offMaterializedCount(p);
    });
  });
  return stats;
}

var RANK_HIERARCHY = [
  {id:'z1',label:'正一品',level:1,salary:100,color:'var(--gold-400)'},
  {id:'c1',label:'从一品',level:2,salary:90,color:'var(--gold-400)'},
  {id:'z2',label:'正二品',level:3,salary:80,color:'var(--gold-400)'},
  {id:'c2',label:'从二品',level:4,salary:72,color:'var(--gold-400)'},
  {id:'z3',label:'正三品',level:5,salary:65,color:'var(--amber-400)'},
  {id:'c3',label:'从三品',level:6,salary:58,color:'var(--amber-400)'},
  {id:'z4',label:'正四品',level:7,salary:50,color:'var(--amber-400)'},
  {id:'c4',label:'从四品',level:8,salary:44,color:'var(--amber-400)'},
  {id:'z5',label:'正五品',level:9,salary:38,color:'var(--celadon-400)'},
  {id:'c5',label:'从五品',level:10,salary:33,color:'var(--celadon-400)'},
  {id:'z6',label:'正六品',level:11,salary:28,color:'var(--celadon-400)'},
  {id:'c6',label:'从六品',level:12,salary:24,color:'var(--celadon-400)'},
  {id:'z7',label:'正七品',level:13,salary:20,color:'var(--color-foreground-secondary)'},
  {id:'c7',label:'从七品',level:14,salary:17,color:'var(--color-foreground-secondary)'},
  {id:'z8',label:'正八品',level:15,salary:14,color:'var(--ink-300)'},
  {id:'c8',label:'从八品',level:16,salary:12,color:'var(--ink-300)'},
  {id:'z9',label:'正九品',level:17,salary:10,color:'var(--ink-300)'},
  {id:'c9',label:'从九品',level:18,salary:8,color:'var(--ink-300)'}
];

// S6·品级表剧本可 override（跨朝代）：剧本可经 GM.rankHierarchy / P.engineConstants.rankHierarchy 提供本朝品阶
//   （如秦汉秩禄「万石/二千石/比二千石」·宋寄禄官阶），各项需含 {label, level}（level 越小越高）。
//   无 override（或无效）→ 返明清九品十八级默认 RANK_HIERARCHY ＝ 字节级零回归。
function _activeRankHierarchy() {
  try {
    var ov = (typeof GM !== 'undefined' && GM && GM.rankHierarchy)
      || (typeof P !== 'undefined' && P && P.engineConstants && P.engineConstants.rankHierarchy) || null;
    if (Array.isArray(ov) && ov.length && ov[0] && ov[0].label != null && ov[0].level != null) return ov;
  } catch (e) {}
  return RANK_HIERARCHY;
}

/** 根据品级文本获取level（数字越小品级越高）·走 _activeRankHierarchy（剧本可 override·跨朝代） */
function getRankLevel(rankStr) {
  if (!rankStr) return 99;
  var H = _activeRankHierarchy();
  for (var i = 0; i < H.length; i++) {
    if (rankStr.indexOf(H[i].label) >= 0) return H[i].level;
  }
  return 99;
}

/** 获取品级信息·走 _activeRankHierarchy（剧本可 override·跨朝代） */
function getRankInfo(rankStr) {
  if (!rankStr) return null;
  var H = _activeRankHierarchy();
  for (var i = 0; i < H.length; i++) {
    if (rankStr.indexOf(H[i].label) >= 0) return H[i];
  }
  return null;
}

/** 计算官员满意度（大材小用/小材大用检测） */
function calcOfficialSatisfaction(charName, posRank, deptName) {
  var ch = findCharByName(charName);
  if (!ch) return { score: 50, label: '未知' };
  // 能力综合分
  var abilityScore = ((ch.intelligence||50) + (ch.administration||50) + (ch.military||50)) / 3;
  var rankLevel = getRankLevel(posRank);
  // 品级越高(level越小)→需要越高能力
  var expectedAbility = Math.max(30, 90 - rankLevel * 3.5);
  var diff = abilityScore - expectedAbility;
  // 野心影响：野心高的人在低品级更不满
  var ambitionPenalty = rankLevel > 10 ? (ch.ambition||50) * 0.3 : 0;
  var satisfaction = 50 + diff * 0.8 - ambitionPenalty;
  satisfaction = Math.max(0, Math.min(100, Math.round(satisfaction)));
  var label = satisfaction > 75 ? '志得意满' : satisfaction > 55 ? '安于其位' : satisfaction > 35 ? '郁郁不得志' : '怀才不遇';
  return { score: satisfaction, label: label };
}


/** 按需具象化——为未具象的在任官员生成角色 */
async function _offMaterialize(deptName, posName) {
  if (!P.ai || !P.ai.key) { toast('需要AI密钥'); return; }
  // 找到职位
  var _pos = null, _dept = null;
  (function _f(ns) { ns.forEach(function(n) { if (n.name === deptName) { (n.positions||[]).forEach(function(p) { if (p.name === posName) { _pos = p; _dept = n; } }); } if (n.subs) _f(n.subs); }); })(GM.officeTree||[]);
  if (!_pos) { toast('找不到职位'); return; }
  if (typeof _offMigratePosition === 'function') _offMigratePosition(_pos);
  var _m = _offMaterializedCount(_pos);
  if (_m >= (_pos.actualCount||0)) { toast('此职位所有在任者已具象'); return; }
  var _dynasty = '';
  var _sc4 = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
  if (_sc4) _dynasty = (_sc4.era||'') + (_sc4.dynasty||'');
  var _existNames = (GM.chars||[]).map(function(c) { return c.name; });
  try {
    toast('正在生成角色...');
    var prompt = '背景：' + (_dynasty||'中国古代') + '。为' + deptName + '的' + posName + '（' + (_pos.rank||'') + '）生成1名任职者。\n'
      + '优先用真实历史人物，找不到则虚构。\n'
      + '已有角色：' + _existNames.slice(0,15).join('、') + '\n'
      + '返回JSON：{"name":"人名","personality":"性格","intelligence":60,"administration":60,"military":40,"loyalty":60,"ambition":50}';
    var c = await callAI(prompt, 500, null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined);  // 【降本2026-06-19】角色具象化(机械生成)走次 API
    var parsed = extractJSON(c);
    if (parsed && parsed.name) {
      if (!GM.chars) GM.chars = [];
      if (!GM.chars.find(function(ch){ return ch.name === parsed.name; })) {
        (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })({
          name: parsed.name, title: posName, officialTitle: posName,
          personality: parsed.personality||'', intelligence: parsed.intelligence||55,
          administration: parsed.administration||55, military: parsed.military||40,
          loyalty: parsed.loyalty||55, ambition: parsed.ambition||45,
          location: GM._capital||'京城', alive: true,
          valor: parsed.valor||40, diplomacy: parsed.diplomacy||50, stress: 0
        });
      }
      // 加入holders
      if (!_pos.additionalHolders) _pos.additionalHolders = [];
      if (!_pos.holder) { _pos.holder = parsed.name; }
      else { _pos.additionalHolders.push(parsed.name); }
      toast('已生成：' + parsed.name);
      if (typeof renderOfficeTree === 'function') renderOfficeTree();
    }
  } catch(e) { toast('生成失败'); }
}

/** 丁忧/考课/任期结算 */
function _settleOfficeMourning() {
  // 1. 丁忧中的官员——在丁忧期间从官制树中标记空缺（但不删除holder，保留恢复）
  (GM.chars||[]).forEach(function(c) {
    if (!c._mourning || c.alive === false) return;
    if (GM.turn >= c._mourning.until) {
      // 丁忧期满——可复职
      c._mourning = null;
      if (typeof addEB === 'function') addEB('人事', c.name + '丁忧期满，可重新起用');
    } else if (c._mourning.since === GM.turn) {
      // 刚进入丁忧——从官制树中暂离（AI已在office_changes中dismiss）
      // 如果AI没有dismiss，这里补上
      (function _checkMourn(nodes) {
        nodes.forEach(function(n) {
          (n.positions||[]).forEach(function(p) {
            if (p.holder === c.name && !c._mourningDismissed) {
              c._mourningOldPost = { dept: n.name, pos: p.name, rank: p.rank };
              // 不直接清除holder——让AI在office_changes中处理
              // 但标记以便AI prompt知道
              c._mourningDismissed = true;
            }
          });
          if (n.subs) _checkMourn(n.subs);
        });
      })(GM.officeTree||[]);
    }
  });

  // 2. 考课周期提醒（在AI prompt中已注入，此处记录触发状态）
  if (GM.turn > 0 && GM.turn % 5 === 0) {
    var evalInterval = (typeof turnsForMonths === 'function') ? turnsForMonths(3) : 3;
    if (!GM._lastEvalTurn || GM._lastEvalTurn < GM.turn - evalInterval) {
      GM._lastEvalTurn = GM.turn;
      if (typeof addEB === 'function') addEB('官制', '考课之期——吏部应对百官考评');
    }
  }
}

// ============================================================
// S1d·才不配位反哺：能臣不得其位(大材小用·才高位卑) → 怨望离心 + 累积求去信号。flag 默认关。
//   注：旧 calcOfficialSatisfaction(L502) 的「满意度」实为「能力-品级匹配度」·语义与标签倒置
//   (大材小用→高分/志得意满)·且仅供面板/runtime 展示零机制后果。此处不动其展示·按正确语义
//   (才高位卑→真不满)自建机械反哺：忠诚渐降(渐进可预见)·久郁萌求去(交 AI/S4 致仕·绝不自动罢官)。
//   启用：P.conf.officeSatisfactionFeedbackEnabled = true（或 P.ai.同名）。关 → 字节级零回归。
// ============================================================
function _officeSatisfactionFeedbackOn() {
  try {
    var ai = (typeof P !== 'undefined' && P && P.ai) || {}, conf = (typeof P !== 'undefined' && P && P.conf) || {};
    return !!(ai.officeSatisfactionFeedbackEnabled || conf.officeSatisfactionFeedbackEnabled);
  } catch (e) { return false; }
}
function _offMonthRatio() {
  try {
    if (typeof GuokuEngine !== 'undefined' && GuokuEngine.getMonthRatio) return GuokuEngine.getMonthRatio() || 1;
    if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.getMonthRatio) return CorruptionEngine.getMonthRatio() || 1;
    if (typeof turnsForMonths === 'function') { var t = turnsForMonths(1); return (t > 0) ? 1 / t : 1; }
  } catch (e) {}
  return 1;
}
function _tickOfficialDisaffection() {
  if (!_officeSatisfactionFeedbackOn()) return;
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.officeTree) || !Array.isArray(GM.chars)) return;
  var mr = _offMonthRatio();
  var seen = {};
  (function walk(nodes) {
    (nodes || []).forEach(function (n) {
      (n.positions || []).forEach(function (p) {
        var holder = p && p.holder;
        if (!holder || holder === '空缺' || holder === '(空缺)' || seen[holder]) return;
        var c = findCharByName(holder);
        if (!c || c.isPlayer || c.alive === false) return;
        if (_OFF_HAREM_RE.test(c.officialTitle || '')) return;   // 后宫封号不入才不配位反哺
        seen[holder] = true;
        var ability = ((c.intelligence || 50) + (c.administration || 50) + (c.military || 50)) / 3;
        var lv = (typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 0) || 9;
        var expected = Math.max(30, 90 - lv * 3.5);
        var gap = ability - expected;            // 大材小用(才高位卑) → gap 大正
        var amb = c.ambition || 50;
        if (gap >= 18 && amb >= 45) {
          // 怀才不遇·能臣不得其位 → 怨望离心(量随才位落差 × 野心·渐进)
          var intensity = Math.min(1, (gap - 18) / 40) * Math.min(1.4, amb / 60);
          var drop = (0.6 + intensity * 1.6) * mr;
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(c, -drop, '怀才不遇·大材小用', { source: 'official-disaffection' });
          else c.loyalty = Math.max(0, (c.loyalty || 50) - drop);
          c.stress = Math.min(100, (c.stress || 0) + drop * 0.4);
          c._disaffectTurns = (c._disaffectTurns || 0) + 1;
          if (c._disaffectTurns >= 3 && !c._seeksRemoval) {
            c._seeksRemoval = { since: GM.turn || 0, reason: '怀才不遇' };
            if (typeof addEB === 'function') addEB('人事', holder + ' 才高位卑·久郁不得志·萌生求去之意');
          }
        } else if (gap <= 12 && gap >= -12) {
          // 位得其人 → 微增忠诚·渐消郁结
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(c, Math.min(1, 0.4 * mr), '位得其人', { source: 'official-content' });
          c._disaffectTurns = 0;
          if (c._seeksRemoval) c._seeksRemoval = null;
        } else if (c._disaffectTurns) {
          c._disaffectTurns = Math.max(0, c._disaffectTurns - 1);
        }
      });
      if (n.subs) walk(n.subs);
    });
  })(GM.officeTree);
}

// 按品级推算官职 publicTreasuryInit 默认值（当 scenario 未提供时）
// 设计原则：中央高位官库厚·州县中等·杂职寡薄·虚衔/无品级近零
// 史实基准：户部/内阁年支度银百万级·六部尚书署衙银十万级·州县几千两·七品以下千两以下
function _inferPublicTreasuryByRank(p, deptName) {
  var rankStr = (typeof p.rank === 'string' ? p.rank : '') + '|' + (p.name || '');
  var numMap = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
  var m = rankStr.match(/(正|从)([一二三四五六七八九])品/);
  var rank = m ? numMap[m[2]] : 0;
  // 部门类型加成：户部/工部/兵部 库银厚·礼部/翰林清要薄·御史言官中等
  var deptBoost = 1;
  var dn = (deptName || '') + (p.name || '');
  if (/户部|度支|太仓|工部|营造|河道|节慎库|宝泉|宝源/.test(dn)) deptBoost = 2.0;
  else if (/兵部|京营|武库|马政/.test(dn)) deptBoost = 1.5;
  else if (/礼部|翰林|国子|詹事/.test(dn)) deptBoost = 0.4;
  else if (/御史|都察|按察|科道/.test(dn)) deptBoost = 0.6;
  else if (/吏部|刑部|大理寺/.test(dn)) deptBoost = 1.0;
  // 内阁特殊：辅臣有票拟权·公库不大但贵
  if (/首辅|次辅|大学士|阁臣/.test(p.name || '')) deptBoost = 0.3;
  // 按品级查表（年用度 → 摊到当前库存约 1/4 ≈ 当季可用）
  var moneyTier = {
    1: 200000,  2: 100000, 3: 50000,  4: 20000,
    5: 8000,    6: 3000,   7: 1500,   8: 600,    9: 300
  };
  var grainTier = { 1: 50000, 2: 25000, 3: 12000, 4: 5000, 5: 2000, 6: 800, 7: 400, 8: 150, 9: 60 };
  var clothTier = { 1: 8000,  2: 4000,  3: 2000,  4: 800,  5: 300,  6: 120, 7: 60,  8: 30,  9: 15 };
  if (!rank || rank < 1) {
    // 无品级·杂职/吏员/未入流·寡薄
    return { money: 100, grain: 30, cloth: 10 };
  }
  return {
    money: Math.round((moneyTier[rank] || 300) * deptBoost),
    grain: Math.round((grainTier[rank] || 60) * deptBoost),
    cloth: Math.round((clothTier[rank] || 15) * deptBoost),
    quotaMoney: Math.round((moneyTier[rank] || 300) * deptBoost * 4),  // 年配额 ≈ 当前 × 4
    quotaGrain: Math.round((grainTier[rank] || 60) * deptBoost * 4),
    quotaCloth: Math.round((clothTier[rank] || 15) * deptBoost * 4)
  };
}

// 官职公库初始化：walk officeTree，从 publicTreasuryInit 建立 live publicTreasury
// 若无 publicTreasuryInit 则按品级+部门自动推算·保证所有官职都有公库显示
function _initOfficePublicTreasury(nodes, deptName) {
  (nodes || []).forEach(function(n) {
    if (!n) return;
    var dn = deptName ? (deptName + '·' + (n.name || '')) : (n.name || '');
    (n.positions || []).forEach(function(p) {
      if (!p) return;
      // 若已有 live publicTreasury 则跳过（保存加载时不覆盖）
      if (p.publicTreasury && p.publicTreasury.money && p.publicTreasury.money.stock != null) return;
      var init = p.publicTreasuryInit;
      // ★ 若 scenario 没显式写 publicTreasuryInit·按品级+部门自动推算·避免 stock=0 显示
      if (!init || (init.money == null && init.grain == null && init.cloth == null)) {
        init = _inferPublicTreasuryByRank(p, dn);
        p._publicTreasuryInferred = true;  // 标记自动推算·UI 可显示『推算』tag
      }
      p.publicTreasury = {
        money: { stock: init.money || 0, quota: init.quotaMoney || 0, used: 0, available: init.money || 0, deficit: 0 },
        grain: { stock: init.grain || 0, quota: init.quotaGrain || 0, used: 0, available: init.grain || 0, deficit: 0 },
        cloth: { stock: init.cloth || 0, quota: init.quotaCloth || 0, used: 0, available: init.cloth || 0, deficit: 0 },
        currentHead: p.holder || null,
        previousHead: null,
        handoverLog: []
      };
    });
    if (n.subs) _initOfficePublicTreasury(n.subs, dn);
  });
}

// 按品级推算角色私产初始值（当剧本未给定 wealthInit 且 wealth 为字符串描述时）
// 兼容从 rank(数字) 和 officialTitle(如"从四品"/"正二品") 两种输入
function _parseRankNumber(ch) {
  // 1. 直接用 rank 数字
  if (typeof ch.rank === 'number' && ch.rank >= 1 && ch.rank <= 9) return ch.rank;
  // 2. 从 officialTitle/rank 字符串解析"正X品/从X品"
  var rankStr = (typeof ch.rank === 'string' ? ch.rank : '') + '|' + (ch.officialTitle || '') + '|' + (ch.title || '');
  var numMap = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
  var m = rankStr.match(/(正|从)([一二三四五六七八九])品/);
  if (m) {
    var r = numMap[m[2]];
    // 从品加 0.5 档，但结果仍取整数档位（1-9）
    return r;
  }
  // 3. 无品级 → 0（平民/未入仕）
  return 0;
}
function _inferPrivateWealthByRank(ch) {
  var r = _parseRankNumber(ch);
  // 品级越高私产越丰（明清历史参照·单位 两/亩）
  var tiers = {
    1:  { money: 50000, land: 10000, treasure: 30000, slaves: 200, commerce: 20000 },  // 正一品
    2:  { money: 30000, land:  8000, treasure: 20000, slaves: 150, commerce: 15000 },  // 正二品
    3:  { money: 15000, land:  5000, treasure: 10000, slaves: 100, commerce:  8000 },  // 正三品
    4:  { money:  8000, land:  3000, treasure:  5000, slaves:  60, commerce:  4000 },  // 正四品
    5:  { money:  4000, land:  1500, treasure:  2500, slaves:  30, commerce:  2000 },  // 正五品
    6:  { money:  2000, land:   800, treasure:  1200, slaves:  15, commerce:  1000 },  // 正六品
    7:  { money:  1000, land:   400, treasure:   600, slaves:   8, commerce:   500 },  // 正七品
    8:  { money:   500, land:   200, treasure:   300, slaves:   4, commerce:   200 },  // 正八品
    9:  { money:   200, land:   100, treasure:   150, slaves:   2, commerce:   100 }   // 正九品
  };
  // 无品级 → 平民/未入仕基准（很低）
  if (!r || r < 1) return { money: 100, land: 50, treasure: 50, slaves: 0, commerce: 50 };
  return tiers[Math.min(9, r)] || tiers[9];
}

// 从 wealth 字符串中解析数字线索（如"田 4 万顷"→ land = 40000*100, "家丁 3000"→ slaves = 3000）
function _parseWealthString(s) {
  if (!s || typeof s !== 'string') return {};
  var out = {};
  // 田 N 万顷
  var m1 = s.match(/田\s*(\d+(?:\.\d+)?)\s*万?顷/);
  if (m1) {
    var qing = parseFloat(m1[1]);
    if (s.indexOf('万顷') >= 0) qing *= 10000;
    out.land = Math.round(qing * 100);  // 1 顷 = 100 亩
  } else {
    var m2 = s.match(/田\s*(\d+(?:\.\d+)?)\s*万?亩/);
    if (m2) {
      var mu = parseFloat(m2[1]);
      if (s.indexOf('万亩') >= 0) mu *= 10000;
      out.land = Math.round(mu);
    }
  }
  // 家丁 N
  var m3 = s.match(/家丁\s*(\d+(?:\.\d+)?)\s*(千|万)?/);
  if (m3) {
    var n = parseFloat(m3[1]);
    var mu2 = m3[2] === '万' ? 10000 : m3[2] === '千' ? 1000 : 1;
    out.slaves = Math.round(n * mu2);
  }
  // 富甲天下 / 抄没 X 万两
  var m4 = s.match(/(?:抄没估?|家?产)\s*(\d+)\s*万?两/);
  if (m4) {
    var v = parseInt(m4[1]);
    if (s.indexOf('万两') >= 0 || s.indexOf('万') >= 0) v *= 10000;
    out.money = v;
  }
  // 富甲天下 / 豪富 关键词
  if (/富甲天下|豪富|巨富/.test(s)) {
    out._rich = true;  // rank-based * 5
  } else if (/家境殷实|小有资产/.test(s)) {
    out._rich = false;
  } else if (/清贫|贫困|寒素/.test(s)) {
    out._poor = true;  // rank-based * 0.3
  }
  return out;
}

// 初始化所有角色的 privateWealth
function _initCharacterPrivateWealth(chars) {
  var _isLeader = function(c){
    if (!c) return false;
    // 皇帝
    if (c.role === '皇帝' || c.officialTitle === '皇帝') return true;
    if (c.isPlayer && c.royalRelation === 'emperor_family' && c.isRoyal) return true;
    if (c.title && /明思宗|崇祯帝|庄烈帝|皇帝/.test(c.title)) return true;
    // 势力领袖
    var facs = (GM && GM.facs) || [];
    for (var i = 0; i < facs.length; i++) {
      var f = facs[i]; if (!f) continue;
      if (f.leader === c.name) return true;
      if (f.leadership && f.leadership.ruler === c.name) return true;
    }
    return false;
  };
  (chars || []).forEach(function(ch) {
    if (!ch || ch.alive === false) return;
    if (!ch.resources) ch.resources = {};
    // 领袖：跳过五大类赋值，其私产=内帑/领袖私库 镜像（由 updatePublicTreasuryMirror 同步）
    if (_isLeader(ch)) {
      if (typeof CharEconEngine !== 'undefined') {
        try { CharEconEngine.ensureCharResources(ch); } catch(_){}
        try { CharEconEngine.updatePublicTreasuryMirror(ch); } catch(_){}
      }
      return;
    }
    // 若 resources.privateWealth 已有有效数据（存档加载）·补齐 4 缺字段(land/treasure/slaves/commerce)再跳过
    // scenario 多数 chars 只写 {money,grain,cloth} 3 字段·缺 4 字段会导致 UI 田亩/珍宝/僮仆/商铺 全显示 0
    if (ch.resources.privateWealth && (ch.resources.privateWealth.money > 0 || ch.resources.privateWealth.land > 0)) {
      var pw = ch.resources.privateWealth;
      // 跳过领袖私库(已是内帑镜像)
      if (!pw.isNeitang) {
        // 任一字段缺失则按品级补齐(money 已有则保留)
        if (pw.land == null || pw.treasure == null || pw.slaves == null || pw.commerce == null) {
          var inferred = _inferPrivateWealthByRank(ch);
          if (pw.land == null) pw.land = inferred.land;
          if (pw.treasure == null) pw.treasure = inferred.treasure;
          if (pw.slaves == null) pw.slaves = inferred.slaves;
          if (pw.commerce == null) pw.commerce = inferred.commerce;
        }
      }
      return;
    }
    // 剧本可直接提供 wealthInit 覆盖全部
    if (ch.wealthInit && typeof ch.wealthInit === 'object') {
      ch.resources.privateWealth = {
        money: ch.wealthInit.money || 0,
        land: ch.wealthInit.land || 0,
        treasure: ch.wealthInit.treasure || 0,
        slaves: ch.wealthInit.slaves || 0,
        commerce: ch.wealthInit.commerce || 0
      };
      if (ch.wealthInit.hidden != null) ch.hiddenWealth = ch.wealthInit.hidden;
      return;
    }
    // 按品级推算基准
    var base = _inferPrivateWealthByRank(ch);
    // 从 wealth 字符串解析线索叠加
    var parsed = _parseWealthString(ch.wealth || '');
    if (parsed._rich) {
      ['money','land','treasure','slaves','commerce'].forEach(function(k){ base[k] = Math.round(base[k] * 5); });
    }
    if (parsed._poor) {
      ['money','land','treasure','slaves','commerce'].forEach(function(k){ base[k] = Math.round(base[k] * 0.3); });
    }
    // 具体数字线索覆盖
    ['money','land','treasure','slaves','commerce'].forEach(function(k){
      if (parsed[k] != null && parsed[k] > 0) base[k] = parsed[k];
    });
    ch.resources.privateWealth = base;
  });
}

// ═══════════════════════════════════════════════════════════════════
// B.6 · 官制最小权限判定 · canPerformAction
// 让 scenario position.powers 配置(appointment/impeach/taxCollect/militaryCommand/supervise/yinBu)
// 真正参与运行时权限判定·不再仅作 prompt 描述
// ═══════════════════════════════════════════════════════════════════
function _findPositionByCharName(charName) {
  if (!charName || !GM.officeTree) return null;
  var found = null;
  _offWalkOfficeTree(GM.officeTree, function(n) {
    (n.positions || []).forEach(function(p) {
      if (found) return;
      if (p && p.holder === charName) {
        found = { pos: p, dept: n.name };
      }
    });
    return found ? false : true;
  });
  return found;
}

/**
 * 检查 charName 是否有 action 权限·返回 {can:bool, reason:string}
 * action ∈ 'appointment'(辟署/任免) | 'impeach'(弹劾) | 'taxCollect'(征税/加派) |
 *         'militaryCommand'(调兵) | 'supervise'(监察) | 'yinBu'(荫补)
 * 皇帝/势力领袖/未在职者特例处理
 */
function canPerformAction(charName, action) {
  // 皇帝绝对权
  var ch = (GM.chars || []).find(function(c) { return c.name === charName; });
  if (!ch) return { can: false, reason: '人不存' };
  if (ch.role === '皇帝' || ch.officialTitle === '皇帝' ||
      (ch.title && /明思宗|崇祯帝|庄烈帝|皇帝/.test(ch.title))) {
    return { can: true, reason: '帝王至尊' };
  }
  // 势力领袖在自境内有权
  var facs = (GM && GM.facs) || [];
  for (var i = 0; i < facs.length; i++) {
    var f = facs[i]; if (!f) continue;
    if (f.leader === charName || (f.leadership && f.leadership.ruler === charName)) {
      return { can: true, reason: '势力领袖' };
    }
  }
  // 普通官员·查 officeTree 找其在职位置
  var hit = _findPositionByCharName(charName);
  if (!hit) return { can: false, reason: charName + ' 未在职' };
  var p = hit.pos;
  var powers = p.powers || {};
  if (powers[action] === true) {
    return { can: true, reason: hit.dept + '·' + p.name + ' 有 ' + action + ' 之权' };
  }
  // 内阁辅臣特例：首辅次辅有 appointment/impeach/supervise
  if (/首辅|次辅|大学士|阁臣/.test(p.name) && /appointment|impeach|supervise/.test(action)) {
    return { can: true, reason: '阁臣辅政' };
  }
  // 都察院特例：御史有 impeach/supervise
  if (/御史|都察|按察/.test(p.name) && /impeach|supervise/.test(action)) {
    return { can: true, reason: hit.dept + '·风宪之臣' };
  }
  return { can: false, reason: hit.dept + '·' + p.name + ' 无 ' + action + ' 之权' };
}

// ============================================================
// 单一真相源:从人物 officialTitle 派生官制树任职者 (2026-06-12)
// ------------------------------------------------------------
// 病根:GM.officeTree 的 holder/actualHolders 与人物 officialTitle 双源各自维护、
//   靠精确匹配双写同步,长期漂移→树不同步实际官职、官员莫名变布衣、图志不反映推演。
// 治本:人物 officialTitle 为唯一真相;每次渲染前+endturn后从人物**派生**树任职者。
//   树结构(部门/职位/编制/世袭)仍以 GM.officeTree 为权威,只有"谁坐哪个位子"被重算。
//   编制外的本朝活跃官员→按分类器挂动态部门,使树"展开包含全部任职者"(owner语义)。
// ============================================================

// 致仕/罢归/待罪等"已离职"特征——不进活跃官制树
var _OFF_RETIRE_RE = /已罢|罢归|罢居|罢闲|致仕|乞休|乞骸|告归|告病|养病|削籍|闲住|闲居|夺职|去职|待召还|待罪|起复待|先朝|前朝/;
// 后宫封号——非官僚职、不进官制树(仍在人物图志)
var _OFF_HAREM_RE = /皇后|皇贵妃|贵妃|淑妃|德妃|贤妃|庄妃|宸妃|选侍|嫔|婕妤|才人|昭仪|贵人|奉圣夫人|乳母|宫女|尚宫/;

/** 最长公共子串长度(用于"锦衣卫北镇抚使"∩"北镇抚使专理诏狱"类重叠匹配) */
function _offLongestCommonSub(a, b) {
  var best = 0;
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      var k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

// 职位"核心后缀"——去左/右/前/后/中等方位序数前缀后的可比对核
var _OFF_CORE_SUFFIXES = ['大学士','尚书','侍郎','都御史','副都御史','佥都御史','都督','总兵','副总兵','参将','给事中','御史','布政使','按察使','都指挥使','学士','祭酒','司业','寺卿','少卿','寺丞','监正','监副','掌印','秉笔','随堂','指挥使','镇抚使','巡抚','总督','经略','知府','府尹','詹事','主事','员外郎','郎中','太监','寺人'];
function _offCoreOfPos(posName) {
  var n = _offNormalizeTitleName(posName);
  for (var i = 0; i < _OFF_CORE_SUFFIXES.length; i++) {
    if (n.indexOf(_OFF_CORE_SUFFIXES[i]) >= 0) return _OFF_CORE_SUFFIXES[i];
  }
  return n;
}
// 部门归属 token(判断诉求是否属于该部门,避免"兵部尚书"误配"吏部尚书")
function _offDeptTokens(deptName) {
  var n = _offNormalizeTitleName(deptName);
  var toks = {}; toks[n] = 1;
  var m = n.match(/^(吏|户|礼|兵|刑|工)部/); if (m) toks[m[0]] = 1;
  ['内阁','都察院','大理寺','通政使司','司礼监','锦衣卫','五军都督府','翰林院','詹事府','国子监','钦天监','太医院','宗人府','六科','顺天府','应天府','御马监','光禄寺','太仆寺','鸿胪寺','太常寺','上林苑','尚宝司','内官监'].forEach(function(d){ var nd=_offNormalizeTitleName(d); if (n.indexOf(nd) >= 0) toks[nd] = 1; });
  return Object.keys(toks).filter(Boolean);
}

/** 人物某官职诉求 vs 职位槽 评分 (claimTitle, dept名, pos名, 是否既有holder) */
function _offTitleSlotScore(claimTitle, deptName, posName, prevHolder) {
  var ct = _offNormalizeTitleName(claimTitle);
  var np = _offNormalizeTitleName(posName);
  var nd = _offNormalizeTitleName(deptName);
  if (!ct || !np) return 0;
  var sc = 0;
  if (ct === np) sc = 100;
  else if (ct === nd + np) sc = 98;
  else if (np.indexOf(ct) >= 0 && ct.length >= 3) sc = 88;
  else if (ct.indexOf(np) >= 0 && np.length >= 3) sc = 86;
  else if (_offLongestCommonSub(ct, np) >= 4) sc = 76;
  else {
    var core = _offCoreOfPos(posName);
    if (core && ct.indexOf(core) >= 0) {
      var dtoks = _offDeptTokens(deptName);
      var deptHit = dtoks.some(function(d){ return d && ct.indexOf(d) >= 0; });
      var posEmbedsDept = dtoks.some(function(d){ return d && np.indexOf(d) >= 0; });
      if (deptHit) sc = 72;
      else if (posEmbedsDept) sc = 40;
      else sc = 30; // 通用后缀无部门对应——低于阈值,不匹配
    }
  }
  if (prevHolder && sc > 0) sc += 50; // 既有座位优先(稳定)
  return sc;
}

/** 解析玩家本朝 faction(用于 realm 过滤·敌国/外藩封号不进本朝官制树) */
function _offResolveRealmFaction(chars) {
  try {
    if (typeof GM !== 'undefined' && GM) {
      if (GM.playerFaction) return GM.playerFaction;
      var pid = GM.playerCharacterId;
      var pc = (chars || []).find(function(c){ return c && (c.isPlayer || (pid && (c.id === pid || c.name === pid))); });
      if (pc && pc.faction) return pc.faction;
    }
  } catch (_) {}
  // 兜底:取人数最多的 faction(通常是本朝)
  var cnt = {};
  (chars || []).forEach(function(c){ if (c && c.faction) cnt[c.faction] = (cnt[c.faction] || 0) + 1; });
  var best = '', bn = -1;
  Object.keys(cnt).forEach(function(f){ if (cnt[f] > bn) { bn = cnt[f]; best = f; } });
  return best;
}
function _offCharInRealm(c, realm) {
  if (!realm) return true;
  if (!c.faction) return true; // 无faction的(旧档/通用)默认本朝
  if (c.faction === realm) return true;
  // 容忍朝代名变体(明朝廷/大明朝廷/明)·但敌国(后金/日本幕府等)不会互含
  return c.faction.indexOf(realm) >= 0 || realm.indexOf(c.faction) >= 0;
}

/** 按名去重 chars(应对存档重复人物·保留含officialTitle且alive的最佳条目) */
function _offDedupCharsByName(chars) {
  var byName = {}, order = [];
  (chars || []).forEach(function(c){
    if (!c || !c.name) return;
    var ex = byName[c.name];
    var sc = (c.officialTitle ? 2 : 0) + (c.alive !== false ? 1 : 0) + (c.id ? 1 : 0);
    var exsc = ex ? ((ex.officialTitle ? 2 : 0) + (ex.alive !== false ? 1 : 0) + (ex.id ? 1 : 0)) : -1;
    if (!ex) order.push(c.name);
    if (!ex || sc > exsc) byName[c.name] = c;
  });
  return order.map(function(n){ return byName[n]; });
}

/**
 * 全局去重 GM.chars(同名重复人物·存档/剧本补全合并的副作用)。
 * 保留最丰富条目为 canonical·把 drop 的非空字段补进 canonical 缺失处(只补不覆盖)·删除多余条目。
 * 重要:dup chars 致 findCharByName 返回残桩(无officialTitle)→AI写官职写错条目、图志显布衣。
 */
function _offDedupGMChars() {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return 0;
  var byName = {}, orderNames = [], anon = [], removed = 0;
  var richness = function(x){ return (x.id ? 4 : 0) + (x.officialTitle ? 2 : 0) + (x.alive !== false ? 1 : 0) + (Object.keys(x).length * 0.01); };
  GM.chars.forEach(function(c){
    if (!c || !c.name) { anon.push(c); return; }
    if (!byName[c.name]) { byName[c.name] = c; orderNames.push(c.name); return; }
    removed++;
    var ex = byName[c.name], canonical, drop;
    if (richness(c) > richness(ex)) { canonical = c; drop = ex; } else { canonical = ex; drop = c; }
    Object.keys(drop).forEach(function(k){
      var cv = canonical[k];
      if (cv === undefined || cv === null || cv === '') {
        var dv = drop[k];
        if (dv !== undefined && dv !== null && dv !== '') canonical[k] = dv;
      }
    });
    byName[c.name] = canonical;
  });
  if (removed > 0) {
    GM.chars = orderNames.map(function(n){ return byName[n]; }).concat(anon.filter(Boolean));
    try { if (typeof buildIndices === 'function') buildIndices(); } catch (_) {}
  }
  return removed;
}

/** title 是否皇帝/帝王(已是树根·不重复挂) */
function _offIsSovereign(c) {
  if (!c) return false;
  if (c.role === '皇帝' || c.isEmperor) return true;
  var t = _offNormalizeTitleName(c.officialTitle || '');
  return t === '皇帝' || /^(皇帝|天子|大汗|可汗)$/.test(t);
}

/** title → {court,group} 分类(复用 runtime 分类器·兜底 central/sijian) */
function _offClassifyTitle(title) {
  try {
    if (typeof _officeGetClassifierPatterns === 'function') {
      var pats = _officeGetClassifierPatterns();
      for (var i = 0; i < pats.length; i++) { if (pats[i][0].test(title)) return pats[i][1]; }
    } else if (typeof _OFFICE_CLASSIFIER_PATTERNS !== 'undefined') {
      for (var j = 0; j < _OFFICE_CLASSIFIER_PATTERNS.length; j++) { if (_OFFICE_CLASSIFIER_PATTERNS[j][0].test(title)) return _OFFICE_CLASSIFIER_PATTERNS[j][1]; }
    }
  } catch (_) {}
  return { court: 'central', group: 'sijian' };
}
// 动态部门标签(按 group)
var _OFF_DYN_DEPT_LABEL = {
  zhongchao:'（编制外）中朝近侍', tiqi:'（编制外）缇骑耳目', suwei:'（编制外）宿卫禁军', gongyu:'（编制外）供御宫务',
  bianzhen:'（编制外）边镇将帅', fengjiang:'（编制外）封疆督抚', fannie:'（编制外）藩臬监司',
  shuji:'（编制外）枢辅词臣', taijian:'（编制外）台谏风宪', liucao:'（编制外）部院属官', sijian:'（编制外）寺监杂职', xunqi:'（编制外）勋戚加衔'
};

/** 部门名是否相容(AI 写的 oc.dept vs 树节点名·容忍含/被含) */
function _offDeptCompatible(deptN, nodeName) {
  var nn = _offNormalizeTitleName(nodeName);
  if (!deptN || !nn) return false;
  return deptN === nn || nn.indexOf(deptN) >= 0 || deptN.indexOf(nn) >= 0;
}

/**
 * 把 AI 写的(部门,官职)字符串解析到官制树的正式座位。
 * 病根:AI 的官衔常啰嗦(如"内阁首辅·建极殿大学士"·而树座名"首辅·建极殿大学士"),
 *   endturn-apply 旧靠 pos.name===oc.position 精确相等→对不上→旧任职者不让位、新官溢出编制外。
 * 治本:用与派生同一套评分(_offTitleSlotScore)找最佳座·使任免可靠落到正座。
 * 返回 {node, pos, score} 或 null(解析不到→视为编制外职·不入正座·此为正确兜底)。
 */
function _offResolveSeat(dept, position) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.officeTree)) return null;
  var claim = _offNormalizeTitleName(position);
  var deptN = _offNormalizeTitleName(dept);
  if (!claim) return null;
  var best = null;
  _offWalkOfficeTree(GM.officeTree, function(n) {
    if (!n || n._offDynamic) return true;            // 不往动态(编制外)部门解析
    var dc = _offDeptCompatible(deptN, n.name);
    (n.positions || []).forEach(function(p) {
      if (!p || !p.name) return;
      var s = _offTitleSlotScore(position, n.name, p.name, false);
      if (deptN) { var s2 = _offTitleSlotScore(deptN + claim, n.name, p.name, false); if (s2 > s) s = s2; }  // 容 AI 只写"尚书"靠 dept 补全
      if (s < 60 && p.name.indexOf('·') > 0) {        // 容 AI 写简衔(首辅/次辅/右侍郎)命中座名"·"前的衔头
        var head = _offNormalizeTitleName(String(p.name).split('·')[0]);
        if (head && (claim === head || (head.indexOf(claim) >= 0 && claim.length >= 2))) s = Math.max(s, 82);
      }
      if (s > 0 && deptN) s += dc ? 6 : -30;          // dept 提示:符则微升·不符重罚(防"尚书"跨部门误解析)
      var vac = Math.max(0, (p.establishedCount || p.headCount || 1) - _offMaterializedCount(p));
      if (vac > 0 && s > 0) s += 1;                    // 同分优先空座(勿把现任挤去占同名空缺)
      if (s >= 60 && (!best || s > best.score)) best = { node: n, pos: p, score: s };
    });
    return true;
  });
  return best;
}

/**
 * 把某人从"映射到该座位"的官衔上撤下(robust·治啰嗦官衔旧任职者清不掉的 ghost 病)。
 * 删除该人所有评分>=阈值映射到此座的衔·重建主/兼职·同步描述性 title(防 137 处 officialTitle||title 回退显旧职)。
 * 返回是否真撤了衔。
 */
function _offVacateCharFromSeat(ch, dept, posName) {
  if (!ch) return false;
  var titles = _offGetCharOfficeTitles(ch);
  if (!titles.length) return false;
  var deptN = _offNormalizeTitleName(dept);
  var kept = [], removed = false;
  titles.forEach(function(t) {
    var s = _offTitleSlotScore(t, dept, posName, false);
    if (deptN) { var s2 = _offTitleSlotScore(deptN + _offNormalizeTitleName(t), dept, posName, false); if (s2 > s) s = s2; }
    if (s >= 60) { removed = true; return; }          // 该衔即此座→撤
    kept.push(t);
  });
  if (!removed) return false;
  var main = kept[0] || '';
  ch.officialTitles = _offUniqueTitles(kept);
  ch.officialTitle = main;
  ch.concurrentTitles = ch.officialTitles.slice(1);
  ch.concurrentTitle = ch.concurrentTitles.join('、');
  ch.position = main;
  ch.title = main;
  return true;
}

/**
 * 从人物 officialTitle 派生官制树任职者(holder/actualHolders)。
 * opts.importSeats: 同时把树既有 holder 回填到缺 officialTitle 的人物(load/init 用)。
 * 幂等:重复调用结果稳定(既有座位硬锁)。
 */
function _offSyncHoldersFromChars(opts) {
  opts = opts || {};
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.officeTree)) return { ok: false };
  // 签名守卫:渲染高频调用·状态未变则跳过重算(perf)
  if (opts.ifChanged && !opts.dedupChars) {
    var sig = (GM.turn || 0) + '|' + (GM.chars || []).length + '|' + (GM.playerFaction || '') + '|';
    var h = 0, src = GM.chars || [];
    for (var _i = 0; _i < src.length; _i++) {
      var _c = src[_i]; if (!_c) continue;
      var _s = (_c.name || '') + '#' + (_c.officialTitle || '') + '#' + (_c.concurrentTitle || '') + '#' + (_c.alive === false ? 0 : 1) + '#' + (_c.faction || '');
      for (var _k = 0; _k < _s.length; _k++) { h = ((h << 5) - h + _s.charCodeAt(_k)) | 0; }
    }
    sig += h;
    if (GM._officeDerivedSig === sig) return { ok: true, skipped: true };
    GM._officeDerivedSig = sig;
  } else {
    GM._officeDerivedSig = null; // 强制路径后清签名·确保下次渲染守卫不误跳
  }
  if (opts.dedupChars) _offDedupGMChars();
  var chars = _offDedupCharsByName(GM.chars || []);
  var realm = _offResolveRealmFaction(chars);

  // 先移除上轮派生的动态部门(每次重建)
  GM.officeTree = GM.officeTree.filter(function(d){ return !d || !d._offDynamic; });

  // 收集正式职位槽(并迁移)
  var slots = [];
  _offWalkOfficeTree(GM.officeTree, function(n){
    if (!n) return true;
    (n.positions || []).forEach(function(p){
      if (!p) return;
      _offMigratePosition(p);
      slots.push({
        node: n, pos: p, dept: n.name || '', posName: p.name || '',
        cap: Math.max(1, p.establishedCount || p.headCount || 1),
        prev: _offAllHolders(p), fill: []
      });
    });
    return true;
  });

  var findCh = function(nm){ for (var i = 0; i < chars.length; i++) if (chars[i].name === nm) return chars[i]; return null; };

  // ── Pass 0: 导入——树 holder 回填到缺 officialTitle 的人物 ──
  if (opts.importSeats) {
    slots.forEach(function(sl){
      sl.prev.forEach(function(nm){
        var ch = findCh(nm);
        if (ch && !_offNormalizeTitleName(ch.officialTitle || '')) {
          _offAddCharOfficeTitle(ch, sl.posName, { concurrent: false });
        }
      });
    });
  }

  // ── 收集本朝活跃官职诉求(每个官职一条 claim) ──
  var claims = [];               // {name, ch, title, primary}
  var claimsByChar = {};         // name -> [claim index]
  chars.forEach(function(c){
    if (!c || c.alive === false) return;
    if (!_offCharInRealm(c, realm)) return;
    if (_offIsSovereign(c)) return;
    var titles = _offGetCharOfficeTitles(c);
    titles.forEach(function(t, i){
      var nt = _offNormalizeTitleName(t);
      if (!nt) return;
      if (_OFF_RETIRE_RE.test(String(t))) return;
      if (_OFF_HAREM_RE.test(String(t))) return;
      var idx = claims.length;
      claims.push({ name: c.name, ch: c, title: t, primary: i === 0 });
      (claimsByChar[c.name] = claimsByChar[c.name] || []).push(idx);
    });
  });

  var used = new Array(claims.length).fill(false);
  var claimSlot = {}; // ci -> 所坐正式 slot(供同衔重复幽灵清理按座撤衔)

  // ── Pass 1: 硬锁既有座位(既有 holder 活着且仍 claim 兼容→原地保留) ──
  slots.forEach(function(sl){
    sl.prev.forEach(function(nm){
      if (sl.fill.length >= sl.cap) return;
      var cis = claimsByChar[nm] || [];
      var bestCi = -1, bestSc = 0;
      cis.forEach(function(ci){
        if (used[ci]) return;
        var s = _offTitleSlotScore(claims[ci].title, sl.dept, sl.posName, true);
        if (s >= 40 && s > bestSc) { bestSc = s; bestCi = ci; }
      });
      if (bestCi >= 0) { used[bestCi] = true; claimSlot[bestCi] = sl; sl.fill.push(claims[bestCi].name); }
    });
  });

  // ── Pass 2: 贪心填空(余 claims × 余槽容量·按分高优先) ──
  var pairs = [];
  for (var ci = 0; ci < claims.length; ci++) {
    if (used[ci]) continue;
    for (var si = 0; si < slots.length; si++) {
      if (slots[si].fill.length >= slots[si].cap) continue;
      var s = _offTitleSlotScore(claims[ci].title, slots[si].dept, slots[si].posName, false);
      if (s >= 40) pairs.push({ ci: ci, si: si, s: s });
    }
  }
  pairs.sort(function(a, b){ return b.s - a.s; });
  pairs.forEach(function(pr){
    if (used[pr.ci]) return;
    var sl = slots[pr.si];
    if (sl.fill.length >= sl.cap) return;
    used[pr.ci] = true; claimSlot[pr.ci] = sl; sl.fill.push(claims[pr.ci].name);
  });

  // ── 同衔重复幽灵清理(治"任命未让位→同一官衔多人持·cap=1 正式座只坐一人·余者被 Pass3 甩进编制外显幽灵同衔·过回合越积越多·图志/树双误显官职掉") ──
  // 不变量:同一精确官衔(对应某正式座)只应一人持有。已坐正式座者=canonical(真holder)·撤其余「非在座 且 与在座者精确同衔」者的陈旧重复衔。
  // 安全:①只清非在座者·绝不动在座者(座由 Pass1/2 既定)②须有在座者持同精确衔才清(无在座者的同名=多个总督等编制外职·各自有地·不误伤)③幂等(清完无重复·下次空跑)。
  (function _healDupSeatTitles(){
    var seatedByTitle = {};                       // 精确衔 -> 所坐正式 slot
    for (var di = 0; di < claims.length; di++) {
      if (!used[di] || !claimSlot[di]) continue;
      var sk = _offNormalizeTitleName(claims[di].title);
      if (sk && !seatedByTitle[sk]) seatedByTitle[sk] = claimSlot[di];
    }
    for (var dj = 0; dj < claims.length; dj++) {
      if (used[dj] || !claims[dj].primary) continue; // 已在座/兼衔不动
      var ch = claims[dj].ch; if (!ch) continue;
      var k = _offNormalizeTitleName(claims[dj].title);
      var slot = k && seatedByTitle[k];
      if (!slot) continue;                          // 无在座者持同精确衔→非重复幽灵(编制外职)→保留
      if (typeof _offVacateCharFromSeat === 'function' && _offVacateCharFromSeat(ch, slot.dept, slot.posName)) used[dj] = true;
    }
  })();

  // ── 应用:把 fill 写回职位的 holder/actualHolders(保结构/编制/元数据) ──
  slots.forEach(function(sl){
    var p = sl.pos, named = sl.fill;
    var keepPlaceholders = (Array.isArray(p.actualHolders) ? p.actualHolders : []).filter(function(h){ return h && h.generated === false; });
    var ah = named.map(function(nm){ return { name: nm, generated: true }; });
    var estab = Math.max(named.length, p.establishedCount || p.headCount || 1);
    var ki = 0;
    while (ah.length < estab) {
      ah.push(keepPlaceholders[ki++] || { name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2, 8) });
    }
    p.actualHolders = ah;
    p.holder = named[0] || '';
    p.additionalHolders = named.slice(1);
    // 保留 office_aggregate 的匿名填充占位(generated:false 且有 filledTurn)计入实有
    var anonFilled = ah.filter(function(h){ return h && h.generated === false && h.filledTurn; }).length;
    p.actualCount = named.length + anonFilled;
    p.vacancyCount = Math.max(0, estab - p.actualCount);
  });

  // ── Pass 3: 编制外本朝活跃官→动态部门(按分类器归庭) ──
  var dynByGroup = {};
  for (var ci2 = 0; ci2 < claims.length; ci2++) {
    if (used[ci2]) continue;
    var cl = claims[ci2];
    if (!cl.primary) continue; // 兼任未匹配的不单列(避免重复)
    // 自重复抑制(治一人主衔/兼衔同指一座→既坐正式座又被甩进编制外双列·如 officialTitle="礼部侍郎"+concurrentTitle="左侍郎"同指礼部左侍郎):
    // 若此 claim 最佳匹配的正式座正由本人(经另一衔)坐着·则不再 phantom·消除一人双列(非"掉职"·但视觉冗余)。
    var _selfBest = null, _selfSc = 0;
    for (var _ssi = 0; _ssi < slots.length; _ssi++) {
      var _ssc = _offTitleSlotScore(cl.title, slots[_ssi].dept, slots[_ssi].posName, false);
      if (_ssc > _selfSc) { _selfSc = _ssc; _selfBest = slots[_ssi]; }
    }
    if (_selfBest && _selfSc >= 40 && _selfBest.fill.indexOf(cl.name) >= 0) { used[ci2] = true; continue; }
    var cls = _offClassifyTitle(cl.title);
    var gkey = cls.court + ':' + cls.group;
    if (!dynByGroup[gkey]) {
      dynByGroup[gkey] = {
        name: _OFF_DYN_DEPT_LABEL[cls.group] || '（编制外）其他职官',
        court: cls.court, group: cls.group, _offDynamic: true,
        desc: '从人物实际官职动态归集·非正式编制', positions: [], subs: [], functions: []
      };
    }
    dynByGroup[gkey].positions.push({
      name: _offNormalizeTitleName(cl.title) || cl.title, rank: cl.ch.rank || '', holder: cl.name,
      desc: '', headCount: 1, actualCount: 1, additionalHolders: [],
      establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: cl.name, generated: true }],
      _offDynamicPos: true
    });
    used[ci2] = true;
  }
  var dynDepts = Object.keys(dynByGroup).map(function(k){ return dynByGroup[k]; });
  // 动态部门追加到树末(渲染按 court 分庭,顺序不敏感)
  dynDepts.forEach(function(d){ GM.officeTree.push(d); });

  return { ok: true, slots: slots.length, dynamicDepts: dynDepts.length, realm: realm,
           seated: claims.filter(function(_, i){ return used[i]; }).length, claims: claims.length };
}

if (typeof window !== 'undefined') {
  window.canPerformAction = canPerformAction;
  window._findPositionByCharName = _findPositionByCharName;
  window._offFindPositionByName = _offFindPositionByName;
  window._offSeatPersonInPosition = _offSeatPersonInPosition;
  window._offIsConcurrentAppointment = _offIsConcurrentAppointment;
  window._offAddCharOfficeTitle = _offAddCharOfficeTitle;
  window._offRemoveCharOfficeTitle = _offRemoveCharOfficeTitle;
  window._offGetCharOfficeTitles = _offGetCharOfficeTitles;
  window._offFormatCharTitles = _offFormatCharTitles;
  window._offSyncHoldersFromChars = _offSyncHoldersFromChars;
  window._offTitleSlotScore = _offTitleSlotScore;
  window._offDedupGMChars = _offDedupGMChars;
  window._offResolveSeat = _offResolveSeat;
  window._offVacateCharFromSeat = _offVacateCharFromSeat;
  window._offDeptCompatible = _offDeptCompatible;
}

// ============================================================
// S4·人事新陈代谢 Slice1·致仕（年迈乞骸骨 signal → 耄耋准致仕硬底·可诏起复·flag 默认关）
//   原致仕全靠 AI·引擎无主动新陈代谢。按年(年终察老)：高龄官先乞致仕(可预见警示·可规避·君上可慰留)，
//   逾硬龄则引擎准其致仕(vacate 座·标 _retired + officialTitle 致仕·_OFF_RETIRE_RE 排出树)。
//   可规避：召回/起复(ai-change-applier 既有路径清 _retired)复出。surfaces addEB + World Reaction Bus digest 联动。
//   启用：P.conf.officePersonnelTurnoverEnabled = true（或 P.ai.同名）。关 → 字节级零回归。
// ============================================================
var _OFFICE_RETIRE_CFG = { softAge: 66, hardAge: 74 };
function _officePersonnelTurnoverOn() {
  try {
    var ai = (typeof P !== 'undefined' && P && P.ai) || {}, conf = (typeof P !== 'undefined' && P && P.conf) || {};
    return !!(ai.officePersonnelTurnoverEnabled || conf.officePersonnelTurnoverEnabled);
  } catch (e) { return false; }
}
function _officeChronLink(type, text) {
  try { if (!Array.isArray(GM._chronicle)) GM._chronicle = []; if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({ turn: GM.turn || 0, date: GM._gameDate || '', type: type, text: text, tags: ['联动', '官制'] }); } catch (e) {}
}
function _engineRetireOfficial(c, reason) {
  if (!c) return;
  c._preRetireTitle = c._preRetireTitle || c.officialTitle || '';
  c._retired = true; c.retired = true; c._retireTurn = (GM.turn || 0); c._seeksRetirement = null;
  if (c.officialTitle && !_OFF_RETIRE_RE.test(c.officialTitle)) c.officialTitle = c.officialTitle + '·致仕';
  // 数组 claim 一并撤(2026-07-04 审查定罪)：officialTitles/concurrentTitles 里未带后缀的旧衔仍是活 claim·
  // 派生同步(claims 过滤只滤带致仕后缀的 officialTitle)会把致仕者原座坐回=致仕自我还原。_preRetireTitle 已留起复凭据。
  c.officialTitles = []; c.concurrentTitles = []; c.concurrentTitle = '';
  if (typeof _offVacateByCharName === 'function') { try { _offVacateByCharName(c.name, reason); } catch (e) {} }
  if (typeof addEB === 'function') addEB('人事', c.name + ' ' + reason + '·致仕去位（官缺待补·可诏起复）');
  _officeChronLink('官制↔人事', c.name + ' ' + reason + '·准致仕去位（新陈代谢·官缺待补）');
}
// 年终察老：高龄官乞骸骨(soft·signal·可慰留) / 耄耋准致仕(hard·去位·可起复)。idempotent(已致仕者 _OFF_RETIRE_RE/_retired 跳过)。
function _tickOfficePersonnelTurnover() {
  if (!_officePersonnelTurnoverOn()) return;
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return;
  var yr = (typeof turnsForDuration === 'function') ? (turnsForDuration('year') || 12) : 12;
  if (!GM.turn || GM.turn % yr !== 0) return;     // 年终触发
  var soft = _OFFICE_RETIRE_CFG.softAge, hard = _OFFICE_RETIRE_CFG.hardAge;
  GM.chars.forEach(function (c) {
    if (!c || c.isPlayer || c.alive === false || c._retired) return;
    if (!c.officialTitle || _OFF_RETIRE_RE.test(c.officialTitle) || _OFF_HAREM_RE.test(c.officialTitle)) return;   // 非在任/已离职/后宫(后宫封号不入官制代谢)
    var age = (typeof c.age === 'number') ? c.age : null;
    if (age == null) return;
    if (age >= hard) {
      _engineRetireOfficial(c, '年逾' + age + '·耄耋');
    } else if (age >= soft && !c._seeksRetirement) {
      c._seeksRetirement = { since: GM.turn || 0, age: age };
      if (typeof addEB === 'function') addEB('人事', c.name + ' 年' + age + '·上疏乞骸骨（君上可慰留或准其致仕）');
    }
  });
}

// ============================================================
// S4-2·京察/大计（周期黜陟·flag 默认关）。消费 S1b 考课连劣 _reviewPoorStreak + S1d 才不配位 _seeksRemoval：
//   每 cycleYears 年一察 —— 黜：沉沦庸劣(连劣≥demoteStreak·已经考课屡警)→ 功名罚(driving rankLevel↓·非硬罢)，
//   陟：才高位卑之能臣(怀才不遇)→ 功名擢(人尽其才·留贤·消其求去)。皆走既有功名→runAutoPromotion 引擎(可逆·人不去职)。
//   ★保守裁示(owner 授权我定·2026-06-30)：engine 只「降/擢」(功名·可逆·角色仍在)·不擅自革职去职(硬罢仍交 AI/玩家)。
//   surfaces GM._jingchaResult + addEB + World Reaction Bus digest 联动。依赖 S1b/S1d 开(才有连劣/求去信号可消费)。
//   启用：P.conf.officeJingchaEnabled = true（或 P.ai.同名）。关 → 字节级零回归。
// ============================================================
var _JINGCHA_CFG = { cycleYears: 3, demoteStreak: 2 };
function _officeJingchaOn() {
  try {
    var ai = (typeof P !== 'undefined' && P && P.ai) || {}, conf = (typeof P !== 'undefined' && P && P.conf) || {};
    return !!(ai.officeJingchaEnabled || conf.officeJingchaEnabled);
  } catch (e) { return false; }
}
function _tickJingcha() {
  if (!_officeJingchaOn()) return;
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return;
  var yr = (typeof turnsForDuration === 'function') ? (turnsForDuration('year') || 12) : 12;
  var cyc = Math.max(1, Math.round(yr * _JINGCHA_CFG.cycleYears));
  if (!GM.turn || GM.turn % cyc !== 0) return;     // 京察周期(每 cycleYears 年)
  var SCALE = (typeof TMPromotion !== 'undefined' && TMPromotion.SCALE) || 15;
  var CE = (typeof CharEconEngine !== 'undefined' && CharEconEngine.adjustVirtueMerit) ? CharEconEngine : null;
  var demoted = [], promoted = [];
  GM.chars.forEach(function (c) {
    if (!c || c.isPlayer || c.alive === false || c._retired) return;
    if (!c.officialTitle || _OFF_RETIRE_RE.test(c.officialTitle) || _OFF_HAREM_RE.test(c.officialTitle)) return;   // 非在任/已离职/后宫
    var streak = c._reviewPoorStreak || 0;
    if (streak >= _JINGCHA_CFG.demoteStreak) {
      // 黜·沉沦庸劣（屡考劣等）→ 功名罚（rankLevel↓·可逆非硬罢），罚后清连劣计数重新起算
      if (CE) CE.adjustVirtueMerit(c, -Math.round((6 + streak * 3) * SCALE), '京察黜降·屡考劣等');
      c._reviewPoorStreak = 0; c._jingchaDemotedTurn = GM.turn || 0;
      demoted.push(c.name);
    } else if (c._seeksRemoval) {
      // 陟·才高位卑能臣（怀才不遇·S1d）→ 功名擢（人尽其才·留贤），消其求去与积郁
      if (CE) CE.adjustVirtueMerit(c, Math.round(10 * SCALE), '京察拔擢·沉才得伸');
      c._seeksRemoval = null; c._disaffectTurns = 0; c._jingchaPromotedTurn = GM.turn || 0;
      promoted.push(c.name);
    }
  });
  if (demoted.length || promoted.length) {
    GM._jingchaResult = { turn: GM.turn || 0, demoted: demoted, promoted: promoted };
    var _seg = [];
    if (demoted.length) _seg.push('黜降庸劣：' + demoted.slice(0, 8).join('、'));
    if (promoted.length) _seg.push('拔擢沉才：' + promoted.slice(0, 8).join('、'));
    if (typeof addEB === 'function') addEB('官制', '京察大计·' + _seg.join('；'));
    _officeChronLink('官制↔人事', '京察大计·' + _seg.join('；') + '（汰庸进贤·新陈代谢）');
  }
}

// ============================================================
// 注册结算步骤 — 丁忧/考课结算 (perturn priority 45)
// 历史问题同 letters：放在 startGame 内会漏掉 loadFromSlot/fullLoadGame
// ============================================================
if (typeof SettlementPipeline !== 'undefined') {
  SettlementPipeline.register('office_mourning', '丁忧/考课结算', function() { _settleOfficeMourning(); }, 45, 'perturn');
  SettlementPipeline.register('officeDisaffection', '才不配位反哺', function() { _tickOfficialDisaffection(); }, 46, 'perturn');
  SettlementPipeline.register('officePersonnelTurnover', '人事新陈代谢·致仕', function() { _tickOfficePersonnelTurnover(); }, 47, 'perturn');
  SettlementPipeline.register('officeJingcha', '京察大计·黜陟', function() { _tickJingcha(); }, 48, 'perturn');
}
