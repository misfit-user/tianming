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
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) { _offMigratePosition(p); });
      if (n.subs) _walk(n.subs);
    });
  })(tree);
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

function _offGetCharOfficeTitles(ch) {
  if (!ch) return [];
  var arr = [];
  if (ch.officialTitle) arr.push(ch.officialTitle);
  if (Array.isArray(ch.officialTitles)) arr = arr.concat(ch.officialTitles);
  if (Array.isArray(ch.concurrentTitles)) arr = arr.concat(ch.concurrentTitles);
  if (ch.concurrentTitle) String(ch.concurrentTitle).split(/[、,，;；\s]+/).forEach(function(t){ arr.push(t); });
  return _offUniqueTitles(arr);
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
  function _walk(nodes, chain, strict, requireDept) {
    (nodes || []).forEach(function(n) {
      if (found || !n) return;
      var curChain = chain ? (chain + '·' + (n.name || '')) : (n.name || '');
      if (!requireDept || _matchDept(curChain, n.name)) {
        (n.positions || []).forEach(function(p) {
          if (found || !p) return;
          if (_matchPos(p.name || '', strict)) found = { pos: p, node: n, dept: n.name || '', deptPath: curChain };
        });
      }
      if (!found && n.subs) _walk(n.subs, curChain, strict, requireDept);
    });
  }
  _walk(tree, '', true, !!hint);
  if (!found && hint) _walk(tree, '', true, false);
  if (!found) _walk(tree, '', false, !!hint);
  if (!found && hint) _walk(tree, '', false, false);
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
  (function _walk(nodes, deptChain) {
    (nodes || []).forEach(function(n) {
      if (!n) return;
      var curChain = deptChain ? (deptChain + '·' + n.name) : n.name;
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
      if (n.subs) _walk(n.subs, curChain);
    });
  })(tree, '');
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
  (function _walk(nodes) {
    (nodes || []).forEach(function(n) {
      if (!n) return;
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
      if (n.subs) _walk(n.subs);
    });
  })(GM.officeTree);
  return { swept: swept };
}

/** 获取部门的聚合统计 */
function _offDeptStats(dept) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, vacant: 0, unmaterialized: 0, holders: [] };
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        _offMigratePosition(p);
        stats.headCount += (p.headCount||1);
        stats.actualCount += (p.actualCount||0);
        var m = _offMaterializedCount(p);
        stats.materialized += m;
        _offAllHolders(p).forEach(function(h) { stats.holders.push(h); });
      });
      if (n.subs) _walk(n.subs);
    });
  })([dept]);
  stats.vacant = stats.headCount - stats.actualCount;
  stats.unmaterialized = stats.actualCount - stats.materialized;
  return stats;
}

/** 获取整棵树的聚合统计 */
function _offTreeStats(tree) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, depts: 0 };
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      stats.depts++;
      (n.positions||[]).forEach(function(p) {
        _offMigratePosition(p);
        stats.headCount += (p.headCount||1);
        stats.actualCount += (p.actualCount||0);
        stats.materialized += _offMaterializedCount(p);
      });
      if (n.subs) _walk(n.subs);
    });
  })(tree||[]);
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

/** 根据品级文本获取level（数字越小品级越高） */
function getRankLevel(rankStr) {
  if (!rankStr) return 99;
  for (var i = 0; i < RANK_HIERARCHY.length; i++) {
    if (rankStr.indexOf(RANK_HIERARCHY[i].label) >= 0) return RANK_HIERARCHY[i].level;
  }
  return 99;
}

/** 获取品级信息 */
function getRankInfo(rankStr) {
  if (!rankStr) return null;
  for (var i = 0; i < RANK_HIERARCHY.length; i++) {
    if (rankStr.indexOf(RANK_HIERARCHY[i].label) >= 0) return RANK_HIERARCHY[i];
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
    var c = await callAI(prompt, 500);
    var parsed = extractJSON(c);
    if (parsed && parsed.name) {
      if (!GM.chars) GM.chars = [];
      if (!GM.chars.find(function(ch){ return ch.name === parsed.name; })) {
        GM.chars.push({
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
  function _walk(nodes) {
    if (!Array.isArray(nodes) || found) return;
    nodes.forEach(function(n) {
      if (!n || found) return;
      (n.positions || []).forEach(function(p) {
        if (found) return;
        if (p && p.holder === charName) {
          found = { pos: p, dept: n.name };
        }
      });
      if (!found && n.subs) _walk(n.subs);
    });
  }
  _walk(GM.officeTree);
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

if (typeof window !== 'undefined') {
  window.canPerformAction = canPerformAction;
  window._findPositionByCharName = _findPositionByCharName;
  window._offFindPositionByName = _offFindPositionByName;
  window._offSeatPersonInPosition = _offSeatPersonInPosition;
  window._offIsConcurrentAppointment = _offIsConcurrentAppointment;
  window._offAddCharOfficeTitle = _offAddCharOfficeTitle;
  window._offRemoveCharOfficeTitle = _offRemoveCharOfficeTitle;
  window._offGetCharOfficeTitles = _offGetCharOfficeTitles;
}

// ============================================================
// 注册结算步骤 — 丁忧/考课结算 (perturn priority 45)
// 历史问题同 letters：放在 startGame 内会漏掉 loadFromSlot/fullLoadGame
// ============================================================
if (typeof SettlementPipeline !== 'undefined') {
  SettlementPipeline.register('office_mourning', '丁忧/考课结算', function() { _settleOfficeMourning(); }, 45, 'perturn');
}
