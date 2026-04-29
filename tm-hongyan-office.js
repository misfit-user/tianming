// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-hongyan-office.js — 鸿雁传书 + 官制 (R127 从 tm-player-actions.js L3304-end 拆出)
// 姊妹: tm-player-settings.js + tm-player-core.js
// 包含: 信件系统+品级体系+官制双层模型+官阶/职事/勋贵工具
//
// R159 章节导航 (2587 行)：
//   §1 [L10]   鸿雁传书系统 (信件传递+回复+结算+NPC 来书+信使可见化)
//   §2 [L500]  品级体系工具 (rank · 散官/职事/勋贵分层)
//   §3 [L900]  官制双层模型 (officeTree·部门/职位)
//   §4 [L1300] 官阶/职事/勋贵 工具函数 + 兼任规则
//   §5 [L1700] 任免流程钩子 (onAppointment/onDismissal 联动)
//   §6 [L2100] 鸿雁信件 UI 渲染 + 玩家撰写
//   §7 [L2400] 收尾·NPC 主动写信 trigger + 回信 AI
// ============================================================

// ============================================================
// 鸿雁传书系统 — 信件传递+回复+结算+NPC来书+信使可见化
// ============================================================

/** 信件类型定义 */
// ============================================================
// 品级体系（结构化官阶——通用中国古代18级制）
// ============================================================
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

var LETTER_TYPES = {
  // 玩家发信类型
  secret_decree: { label: '密旨', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 3, needsToken: 'seal', formal: false },
  military_order: { label: '征调令', css: 'lt-type-military', icon: 'troops', interceptWeight: 3, needsToken: 'tally', formal: true },
  greeting: { label: '问安函', css: 'lt-type-greeting', icon: 'person', interceptWeight: 0.5, needsToken: false, formal: false },
  personal: { label: '私函', css: 'lt-type-personal', icon: 'dialogue', interceptWeight: 1, needsToken: false, formal: false },
  proclamation: { label: '檄文', css: 'lt-type-proclamation', icon: 'event', interceptWeight: 0, needsToken: false, formal: false },
  formal_edict: { label: '正式诏令', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 2, needsToken: 'seal', formal: true },
  // NPC来信类型
  report: { label: '奏报', css: 'lt-type-military', icon: 'memorial', interceptWeight: 2, formal: true },
  plea: { label: '陈情', css: 'lt-type-personal', icon: 'person', interceptWeight: 1, formal: false },
  warning: { label: '急报', css: 'lt-type-military', icon: 'troops', interceptWeight: 2.5, formal: false },
  intelligence: { label: '密信', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 3, formal: false },
  // R: AI prompt + tm-endturn-ai-infer.js emoMap 生产以下 4 种 type·此前未在字典里声明·UI 退化为"私函"
  thanks: { label: '谢恩', css: 'lt-type-personal', icon: 'memorial', interceptWeight: 0.8, formal: true },
  recommend: { label: '荐表', css: 'lt-type-personal', icon: 'person', interceptWeight: 1.2, formal: true },
  impeach: { label: '密告', css: 'lt-type-secret', icon: 'memorial', interceptWeight: 2.5, formal: false },
  condolence: { label: '吊唁', css: 'lt-type-personal', icon: 'memorial', interceptWeight: 0.5, formal: true },
  // 新增：馈赠、外交国书
  gift: { label: '附礼', css: 'lt-type-greeting', icon: 'treasury', interceptWeight: 0.5, formal: false },
  diplomatic: { label: '国书', css: 'lt-type-proclamation', icon: 'scroll', interceptWeight: 2, formal: true },
  // 跨势力自动诏令（tm-endturn-prep 给 _crossFaction 诏令派发）·走使节传递·和 diplomatic 同语义
  diplomatic_dispatch: { label: '外交文书', css: 'lt-type-proclamation', icon: 'scroll', interceptWeight: 2, formal: true }
};

/** 信物凭证系统 */
var LETTER_TOKENS = {
  seal: { label: '玺印', desc: '加盖玺印，彰显正统', icon: 'scroll' },
  tally: { label: '虎符', desc: '调兵凭证，无符不从', icon: 'troops' },
  gold_tablet: { label: '金牌', desc: '八百里加急专用信物', icon: 'treasury' }
};

/** 加密方式 */
var LETTER_CIPHERS = {
  none: { label: '不加密', interceptReadChance: 1.0, cost: 0 },
  yinfu: { label: '阴符', desc: '预设暗号体系', interceptReadChance: 0.2, cost: 0 },
  yinshu: { label: '阴书', desc: '拆分三份交不同信使', interceptReadChance: 0.05, cost: 0 },
  wax_ball: { label: '蜡丸', desc: '蜡封密函藏于身', interceptReadChance: 0.4, cost: 0 },
  silk_sewn: { label: '帛书缝衣', desc: '缝入衣裳夹层', interceptReadChance: 0.3, cost: 0 }
};

/** 估算两地信件传递天数（改进版） */
function calcLetterDays(fromLoc, toLoc, urgency) {
  if (!fromLoc || !toLoc || fromLoc === toLoc) return 1;
  // 古代驿站速度（里/天）：普通50里，加急300里，八百里加急800里
  var liPerDay = { normal: 50, urgent: 300, extreme: 800 };
  var speed = liPerDay[urgency] || 50;
  // 估算距离（里）——基于行政区划层级推断
  var li = 1000; // 默认中等距离
  if (_ltCheckSameProvince(fromLoc, toLoc)) li = 200;
  // 若两地名有共同前缀（同区域），距离近
  if (fromLoc.length >= 2 && toLoc.length >= 2 && fromLoc.slice(0,2) === toLoc.slice(0,2)) li = 150;
  return Math.max(1, Math.ceil(li / speed));
}
/** 检查两地是否在同一顶级行政区
 * R: 优先读 GM.adminHierarchy（运行时·会反映领土得失/侨置等动态变迁）·
 *    回退 P.adminHierarchy（剧本静态）·与 _renderDifangPanel 等模块一致
 */
function _ltCheckSameProvince(loc1, loc2) {
  var src = (typeof GM !== 'undefined' && GM.adminHierarchy) ? GM.adminHierarchy
          : (typeof P !== 'undefined' && P.adminHierarchy) ? P.adminHierarchy
          : null;
  if (!src) return false;
  var ah = src.player ? src.player : src[Object.keys(src)[0]];
  if (!ah || !ah.divisions) return false;
  var p1 = '', p2 = '';
  ah.divisions.forEach(function(d) {
    var _names = [d.name];
    if (d.children) d.children.forEach(function(c){ _names.push(c.name); if(c.children) c.children.forEach(function(gc){ _names.push(gc.name); }); });
    if (_names.indexOf(loc1) >= 0) p1 = d.name;
    if (_names.indexOf(loc2) >= 0) p2 = d.name;
  });
  return p1 && p1 === p2;
}

/** 渲染鸿雁传书面板 */
function renderLetterPanel() {
  var capital = GM._capital || '京城';
  var _filter = GM._ltFilter || 'all';

  // ── 驿路状态 ──
  var routeBar = _$('letter-route-bar');
  if (routeBar) {
    var disruptions = GM._routeDisruptions || [];
    var active = disruptions.filter(function(d) { return !d.resolved; });
    if (active.length > 0) {
      var _rHtml = '<span class="hy-route-warn-lbl">\u26A0 \u9A7F\u8DEF\u544A\u6025\uFF1A</span>';
      _rHtml += active.map(function(d) {
        return '<span class="hy-route-warn-item">' + escHtml(d.route||'') + (d.reason ? ' \u00B7 ' + escHtml(d.reason) : '') + '</span>';
      }).join('');
      routeBar.innerHTML = _rHtml;
      routeBar.style.display = 'flex';
    } else { routeBar.style.display = 'none'; routeBar.innerHTML = ''; }
  }

  // 更新 multi button 状态
  var _mbtn = _$('lt-multi-toggle');
  if (_mbtn) _mbtn.classList.toggle('active', !!GM._ltMultiMode);
  // 更新 compose target 提示
  var _ctgt = _$('lt-compose-target');
  if (_ctgt) {
    if (GM._ltMultiMode && GM._ltMultiTargets && GM._ltMultiTargets.length > 0) _ctgt.textContent = '（\u7FA4\u53D1' + GM._ltMultiTargets.length + '\u4EBA\uFF09';
    else if (GM._pendingLetterTo) _ctgt.textContent = '\u2192 \u81F4 ' + GM._pendingLetterTo;
    else _ctgt.textContent = '\uFF08\u9009\u62E9\u53D7\u4FE1\u4EBA\uFF09';
  }

  // ── 人物分组·按地域粗分 ──
  function _regionOf(loc) {
    // R: \u65E7\u7248\u542B IME \u8BEF\u7801\u5B57\uFF08\u8FA3\u9633/\u5384\u95E8/\u6280\u6E7E/\u4EAC\u7B7B/\u8468/\u7B07/\u6E29\u90FD/\u7518\u590F/\u77F3\u5BAB/\u6CBF\u5DDE/\u96A9/\u8367/\u5BA7/\u7518\u76F4\uFF09
    //    \u4E14 L457/L458 \u4E24\u6761\u90FD\u8FD4\u56DE"\u8FBD\u4E1C\u00B7\u5317\u5883"\u00B7\u628A"\u5BA3\u5927\u00B7\u5C71\u897F"\u8BEF\u5E76\u5165\u8FBD\u4E1C\u00B7\u6B64\u5904\u7EDF\u4E00\u66F4\u6B63\u5E76\u62C6\u51FA\u72EC\u7ACB\u7EC4
    if (!loc) return '\u5176\u4ED6';
    // \u8FBD\u4E1C\u00B7\u5317\u5883
    if (/\u8FBD|\u5B81\u8FDC|\u9526|\u84DF|\u76DB\u4EAC|\u8FBD\u9633|\u6C88\u9633|\u5C71\u6D77\u5173|\u76AE\u5C9B/.test(loc)) return '\u8FBD\u4E1C\u00B7\u5317\u5883';
    // \u5BA3\u5927\u00B7\u5C71\u897F\uFF08\u72EC\u7ACB\u51FA\u6765\uFF09
    if (/\u5927\u540C|\u5BA3\u5E9C|\u5BA3\u9547|\u592A\u539F|\u4EE3\u5DDE|\u84B2\u5DDE|\u5C71\u897F|\u5F52\u5316/.test(loc)) return '\u5BA3\u5927\u00B7\u5C71\u897F';
    // \u897F\u9672\u00B7\u8FB9\u9547
    if (/\u9655|\u897F\u5B89|\u5EF6|\u7518|\u5B81\u590F|\u5170\u5DDE|\u4E09\u8FB9|\u51C9|\u6986\u6797|\u56FA\u539F|\u7C73\u8102|\u5B89\u585E|\u5E9C\u8C37/.test(loc)) return '\u897F\u9677\u00B7\u8FB9\u9547';
    // \u897F\u5357\u00B7\u5DF4\u8700
    if (/\u56DB\u5DDD|\u91CD\u5E86|\u4E91|\u8D35|\u8700|\u5DF4|\u77F3\u67F1|\u6210\u90FD/.test(loc)) return '\u897F\u5357\u00B7\u5DF4\u8700';
    // \u5357\u65B9\u00B7\u6D77\u7586\uFF08\u542B\u5916\u85E9\uFF09
    if (/\u798F\u5EFA|\u5E7F\u4E1C|\u5E7F\u897F|\u6D77|\u53A6\u95E8|\u53F0\u6E7E|\u743C|\u5E73\u6237|\u6C49\u57CE|\u671D\u9C9C/.test(loc)) return '\u5357\u65B9\u00B7\u6D77\u7586';
    // \u6C5F\u5357\u00B7\u6C5F\u6D59
    if (/\u6C5F|\u676D|\u5357\u4EAC|\u82CF|\u6E56\u5E7F|\u6D59|\u5357\u76F4|\u6B66\u9675|\u8861\u5DDE|\u5B89\u5E86/.test(loc)) return '\u6C5F\u5357\u00B7\u6C5F\u6D59';
    // \u4E2D\u539F\u00B7\u9C81\u8C6B
    if (/\u6CB3\u5357|\u5C71\u4E1C|\u6CB3\u5317|\u5317\u76F4|\u9C81|\u8C6B|\u4FDD\u5B9A|\u5927\u540D|\u957F\u5C71|\u5546\u4E18/.test(loc)) return '\u4E2D\u539F\u00B7\u9C81\u8C6B';
    return '\u5176\u4ED6';
  }

  // ── NPC 卡片列表 ──
  var el = _$('letter-chars');
  if (el) {
    var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && !_isSameLocation(c.location, capital) && !c.isPlayer; });
    if (remote.length === 0) {
      el.innerHTML = '<div style="color:var(--color-foreground-muted);font-size:12px;padding:20px 14px;text-align:center;font-family:var(--font-serif);letter-spacing:0.12em;line-height:1.8;">\u767E\u5B98\u5747\u5728\u4EAC\u57CE\u00B7\u65E0\u9700\u4F20\u4E66</div>';
    } else {
      // 按地域分组
      var _groups = {};
      remote.forEach(function(ch) {
        var r = _regionOf(ch.location);
        if (!_groups[r]) _groups[r] = [];
        _groups[r].push(ch);
      });
      // \u987A\u5E8F\uFF1A\u8FBD\u4E1C\u00B7\u5317\u5883 / \u5BA3\u5927\u00B7\u5C71\u897F / \u897F\u9677\u00B7\u8FB9\u9547 / \u4E2D\u539F\u00B7\u9C81\u8C6B / \u6C5F\u5357\u00B7\u6C5F\u6D59 / \u897F\u5357\u00B7\u5DF4\u8700 / \u5357\u65B9\u00B7\u6D77\u7586 / \u5176\u4ED6
      var _grpOrder = ['\u8FBD\u4E1C\u00B7\u5317\u5883','\u5BA3\u5927\u00B7\u5C71\u897F','\u897F\u9677\u00B7\u8FB9\u9547','\u4E2D\u539F\u00B7\u9C81\u8C6B','\u6C5F\u5357\u00B7\u6C5F\u6D59','\u897F\u5357\u00B7\u5DF4\u8700','\u5357\u65B9\u00B7\u6D77\u7586','\u5176\u4ED6'];

      function _cardClass(ch) {
        var t = (ch.title||'') + (ch.officialTitle||'');
        if (/\u5C06|\u603B\u5175|\u7763|\u6307\u6325|\u6307\u6325\u4F7F/.test(t)) return 'hy-c-mili';
        if ((ch.loyalty||50) >= 75) return 'hy-c-loyal';
        if (/\u5B66\u58EB|\u4FA8|\u5C1A\u4E66|\u90CE\u4E2D|\u4FA8\u5B66|\u7AE5\u5B9E|\u4F5B|\u5FB4\u58EB|\u6559\u6388|\u4FA8\u516C|\u84DD\u77E5/.test(t)) return 'hy-c-scholar';
        return 'hy-c-normal';
      }

      var cardsHtml = '';
      _grpOrder.forEach(function(g) {
        if (!_groups[g] || _groups[g].length === 0) return;
        cardsHtml += '<div class="hy-group-sep">' + escHtml(g) + '</div>';
        _groups[g].forEach(function(ch) {
          var isMulti = (GM._ltMultiTargets||[]).indexOf(ch.name) >= 0;
          var sel = (GM._ltMultiMode ? (isMulti ? ' active' : '') : (GM._pendingLetterTo === ch.name ? ' active' : ''));
          var safeName = ch.name.replace(/'/g, "\\'");
          var _cls = _cardClass(ch);
          var unreadCount = _ltCountUnread(ch.name);
          var transitCount = _ltCountTransit(ch.name);
          var lostCount = _ltCountLost(ch.name);
          var npcNewCount = _ltCountNpcNew(ch.name);
          var _isRouteBlocked = _ltIsRouteBlocked(capital, ch.location);
          var _inds = '';
          if (unreadCount > 0) _inds += '<div class="hy-ind hy-ind-unread" title="' + unreadCount + ' \u5C01\u672A\u8BFB">' + unreadCount + '</div>';
          if (npcNewCount > 0) _inds += '<div class="hy-ind hy-ind-new" title="' + npcNewCount + ' \u5C01\u6765\u51FD">' + npcNewCount + '</div>';
          if (transitCount > 0) _inds += '<div class="hy-ind hy-ind-transit" title="' + transitCount + ' \u5C01\u5728\u9014">' + transitCount + '</div>';
          if (lostCount > 0) _inds += '<div class="hy-ind hy-ind-lost" title="\u4FE1\u4F7F\u903E\u671F">?</div>';
          if (_isRouteBlocked) _inds += '<div class="hy-ind hy-ind-blocked" title="\u9A7F\u8DEF\u963B\u65AD">\u2715</div>';

          var _initial = escHtml(String(ch.name||'?').charAt(0));
          var _portrait = ch.portrait ? '<img src="' + escHtml(ch.portrait) + '">' : _initial;
          var _travel = '';
          if (ch._travelTo) {
            var _rd4 = (typeof ch._travelRemainingDays === 'number' && ch._travelRemainingDays > 0) ? ch._travelRemainingDays : 0;
            _travel = '<span class="travel-arrow">\u2192</span>' + escHtml(ch._travelTo) + (_rd4 ? '<span style="font-size:0.85em;opacity:0.7;"> \u00B7' + _rd4 + '\u65E5</span>' : '');
          }

          cardsHtml += '<div class="hy-npc-card ' + _cls + sel + '" onclick="_ltSelectTarget(\'' + safeName + '\')">';
          cardsHtml += '<div class="hy-npc-portrait">' + _portrait + '</div>';
          cardsHtml += '<div class="hy-npc-info">';
          cardsHtml += '<div class="hy-npc-name">' + escHtml(ch.name) + '</div>';
          cardsHtml += '<div class="hy-npc-title">' + escHtml(ch.officialTitle || ch.title || ch.role || '') + '</div>';
          cardsHtml += '<div class="hy-npc-loc">' + escHtml(ch.location || '') + _travel + '</div>';
          cardsHtml += '</div>';
          cardsHtml += '<div class="hy-npc-indicators">' + _inds + '</div>';
          cardsHtml += '</div>';
        });
      });
      el.innerHTML = cardsHtml;
    }
  }

  // ── 信件记录区 ──
  var hist = _$('letter-history');
  if (!hist) return;
  var target = GM._pendingLetterTo || '';
  if (!target) {
    var _npcCorr = GM._npcCorrespondence || [];
    var _recentCorr = _npcCorr.filter(function(c) { return (GM.turn - c.turn) <= 5; });
    var overviewHtml = '<div class="hy-hist-body"><div class="hy-hist-empty">\u9009\u62E9\u4E00\u4F4D\u8FDC\u65B9\u81E3\u5B50\u00B7\u4EE5\u89C1\u4E66\u4FE1\u5F80\u6765</div>';
    if (_recentCorr.length > 0) {
      overviewHtml = '<div class="hy-hist-head"><div class="hy-hist-title-wrap"><div class="hy-hist-portrait" style="background:linear-gradient(135deg,var(--vermillion-400),var(--ink-100));border-color:var(--vermillion-400);">\u5BC6</div><div><div class="hy-hist-name">\u622A\u83B7\u7684 NPC \u5BC6\u4FE1</div><div class="hy-hist-sub">\u8FD1 5 \u56DE\u5408\u00B7\u5171 ' + _recentCorr.length + ' \u5C01</div></div></div></div>';
      overviewHtml += '<div class="hy-hist-body">';
      _recentCorr.forEach(function(c) {
        overviewHtml += '<div class="hy-msg hy-msg-intercept"><span class="hy-msg-tag"></span>';
        overviewHtml += '<div class="hy-letter">';
        overviewHtml += '<div class="header"><span class="type-pill">\u5BC6\u51FD</span><span>' + escHtml(c.from) + ' \u2192 ' + escHtml(c.to) + '</span><span class="date">T' + (c.turn||'?') + '</span></div>';
        overviewHtml += '<div class="body">' + escHtml(c.content || c.summary || '') + '</div>';
        if (c.implication) overviewHtml += '<div class="hy-intercept-imply">\u6697\u542B\uFF1A' + escHtml(c.implication) + '</div>';
        overviewHtml += '</div></div>';
      });
      overviewHtml += '</div>';
    } else {
      overviewHtml += '</div>';
    }
    hist.innerHTML = overviewHtml;
    return;
  }

  var ch = findCharByName(target);
  var allLetters = (GM.letters||[]).filter(function(l) { return l.to === target || l.from === target; });
  var letters = allLetters;
  if (_filter === 'unread') letters = allLetters.filter(function(l) { return !l._playerRead; });
  else if (_filter === 'transit') letters = allLetters.filter(function(l) { return l.status === 'traveling' || l.status === 'replying'; });
  else if (_filter === 'lost') letters = allLetters.filter(function(l) { return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1); });

  // 新头部
  var _initial = escHtml(String(target||'?').charAt(0));
  var _portraitHtml = (ch && ch.portrait) ? '<img src="' + escHtml(ch.portrait) + '">' : _initial;
  var html = '<div class="hy-hist-head"><div class="hy-hist-title-wrap">';
  html += '<div class="hy-hist-portrait">' + _portraitHtml + '</div>';
  html += '<div><div class="hy-hist-name">\u4E0E ' + escHtml(target) + ' \u7684\u4E66\u4FE1</div>';
  html += '<div class="hy-hist-sub">' + escHtml(ch ? ch.location : '?') + '\u3000\u5171 ' + allLetters.length + ' \u5C01\u5F80\u6765</div></div>';
  html += '</div><div class="hy-filter-btns">';
  var _filterBtns = [{k:'all',l:'\u5168\u90E8'},{k:'unread',l:'\u672A\u8BFB'},{k:'transit',l:'\u5728\u9014'},{k:'lost',l:'\u5931\u8E2A'}];
  _filterBtns.forEach(function(f) {
    html += '<button class="hy-filter-btn' + (_filter===f.k?' active':'') + '" onclick="GM._ltFilter=\'' + f.k + '\';renderLetterPanel();">' + f.l + '</button>';
  });
  html += '</div></div>';

  // 信件列表容器
  html += '<div class="hy-hist-body">';
  if (letters.length === 0) {
    html += '<div class="hy-hist-empty">' + (_filter==='all' ? '\u5C1A\u65E0\u5F80\u6765\u4E66\u4FE1' : '\u65E0\u5339\u914D\u4FE1\u4EF6') + '</div>';
  } else {
    letters.sort(function(a,b) { return (a.sentTurn||0) - (b.sentTurn||0); });
    letters.forEach(function(l) { html += _ltRenderLetterCard(l, target); });
  }
  html += '</div>';

  hist.innerHTML = html;
  var _body = hist.querySelector('.hy-hist-body');
  if (_body) _body.scrollTop = _body.scrollHeight;
}

/** 渲染单封信笺卡片 */
function _ltRenderLetterCard(l, target) {
  var html = '';
  var isOutgoing = (l.from === '玩家');
  var sentDate = (typeof getTSText === 'function') ? getTSText(l.sentTurn) : '第' + l.sentTurn + '回合';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeInfo = LETTER_TYPES[l.letterType] || LETTER_TYPES.personal;
  // R: intercepted_forging（敌方伪造回信中）应视觉伪装为"在途"·不能用红色截获样式·
  //    否则玩家一眼看出被截·破坏伪造剧情·真相靠存疑/遣使核实流程后续暴露
  var _intercepted = (l.status === 'intercepted');
  var _inTransit = (l.status === 'traveling' || l.status === 'replying' || l.status === 'intercepted_forging');
  var _lost = (l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1));

  // 外层 msg 类
  var msgCls = 'hy-msg ';
  if (_lost) msgCls += 'hy-msg-lost';
  else if (_intercepted) msgCls += 'hy-msg-intercept';
  else if (_inTransit) msgCls += 'hy-msg-transit';
  else if (isOutgoing) msgCls += 'hy-msg-player';
  else msgCls += 'hy-msg-npc';

  // 印章类
  var sealCls = 'personal';
  if (/secret|decree/.test(l.letterType||'')) sealCls = 'secret';
  else if (/military|army|order/.test(l.letterType||'')) sealCls = 'military';
  var sealChar = typeInfo.label ? String(typeInfo.label).charAt(0) : (isOutgoing ? '\u8C15' : '\u62A5');

  // 标记已读
  if (!isOutgoing && !l._playerRead) l._playerRead = true;

  html += '<div class="' + msgCls + '"><span class="hy-msg-tag"></span>';
  html += '<div class="hy-letter">';
  html += '<div class="seal ' + sealCls + '">' + sealChar + '</div>';
  html += '<div class="header">';
  html += '<span class="type-pill">' + escHtml(typeInfo.label || '\u4E66\u51FD') + '</span>';
  html += '<span>' + escHtml(urgLabels[l.urgency] || '\u9A7F\u9012') + '</span>';
  if (l._cipher && l._cipher !== 'none') html += '<span>' + escHtml((LETTER_CIPHERS[l._cipher]||{}).label || l._cipher) + '</span>';
  if (l._tokenUsed) html += '<span>' + escHtml((LETTER_TOKENS[l._tokenUsed]||{}).label || l._tokenUsed) + '</span>';
  if (l._sendMode === 'multi_courier') html += '<span>\u591A\u8DEF</span>';
  if (l._sendMode === 'secret_agent') html += '<span>\u5BC6\u4F7F' + (l._agentName ? '(' + escHtml(l._agentName) + ')' : '') + '</span>';
  if (l._multiRecipients) html += '<span>\u7FA4\u53D1' + l._multiRecipients + '\u4EBA</span>';
  html += '<span class="date">' + escHtml(sentDate) + '</span>';
  html += '</div>';
  // 正文
  html += '<div class="body wd-selectable">' + escHtml(l.content || '') + '</div>';
  // 署名
  var _sig = isOutgoing ? '\u6731\u624B\u4E66' : ('\u81E3 ' + escHtml(l.from||target) + ' \u987F\u9996');
  html += '<div class="signature">' + escHtml(sentDate) + '\u00B7' + _sig + '</div>';
  // 回信（朱笔批注/来回信内容）
  if (l.reply && (l.status === 'returned' || l.status === 'intercepted_forging') && isOutgoing) {
    var replyDate = (typeof getTSText === 'function') ? getTSText(l.replyTurn||GM.turn) : '';
    html += '<div class="reply">';
    html += '<div class="reply-label">\u56DE \u4E66 \u00B7 ' + escHtml(l.to||target) + (replyDate ? '\u00B7' + escHtml(replyDate) : '') + '</div>';
    html += escHtml(l.reply);
    if (l._isForged && (GM._letterSuspects||[]).indexOf(l.id) >= 0) {
      html += '<div style="font-size:11px;color:var(--amber-400);margin-top:4px;font-style:normal;">\u26A0 \u5DF2\u6807\u8BB0\u5B58\u7591\u2014\u2014\u6B64\u4FE1\u5185\u5BB9\u771F\u4F2A\u5F85\u6838</div>';
    }
    if (l._forgedRevealed) {
      html += '<div style="font-size:11px;color:var(--vermillion-400);margin-top:4px;font-weight:bold;font-style:normal;">\u26A0 \u5DF2\u8BC1\u5B9E\u4E3A\u4F2A\u9020\uFF01</div>';
    }
    html += '</div>';
  }
  html += '</div>'; // .hy-letter

  // 操作按钮（信件动作）
  var acts = '';
  if (l.status === 'blocked' && isOutgoing) {
    acts += '<button class="hy-filter-btn" style="color:var(--vermillion-400);border-color:var(--vermillion-400);" onclick="_ltBypassBlock(\'' + l.id + '\')" title="\u7ED5\u8FC7\u4E2D\u4E66\uFF0C\u6539\u7528\u5BC6\u65E8\u76F4\u53D1">\u6539\u7528\u5BC6\u65E8</button>';
  }
  if (l.status === 'traveling' && isOutgoing && !l._recallSent) {
    acts += '<button class="hy-filter-btn" onclick="_ltRecall(\'' + l.id + '\')" title="\u6D3E\u5FEB\u9A6C\u8FFD\u56DE\u4FE1\u4F7F">\u8FFD\u3000\u56DE</button>';
  }
  // \u622A\u83B7/\u88AB\u52AB\u00B7\u5E94\u5BF9\u624B\u6BB5\uFF1A\u53E6\u6D3E\u5BC6\u4F7F\u91CD\u53D1 / \u516B\u767E\u91CC\u52A0\u6025\u518D\u4F20
  if ((l.status === 'intercepted' || l.status === 'intercepted_forging') && isOutgoing && !l._resendIssued) {
    acts += '<button class="hy-filter-btn" style="color:var(--gold-400);border-color:var(--gold-400);" onclick="_ltResend(\'' + l.id + '\',\'secret_agent\')" title="\u6539\u7528\u5BC6\u4F7F\u91CD\u53D1\u00B7\u622A\u83B7\u7387\u5927\u964D\uFF08\u00D70.3\uFF09">\u91CD\u53D1\u00B7\u5BC6\u4F7F</button>';
    acts += '<button class="hy-filter-btn" style="color:var(--vermillion-400);border-color:var(--vermillion-400);" onclick="_ltResend(\'' + l.id + '\',\'multi_courier\')" title="\u591A\u8DEF\u516B\u767E\u91CC\u52A0\u6025\u00B7\u81F3\u5C11\u4E00\u8DEF\u5FC5\u8FBE">\u91CD\u53D1\u00B7\u591A\u8DEF\u52A0\u6025</button>';
  }
  if ((l.status === 'returned' || l.status === 'intercepted_forging') && l.reply && isOutgoing) {
    if ((GM._letterSuspects||[]).indexOf(l.id) < 0) {
      acts += '<button class="hy-filter-btn" onclick="_ltSuspect(\'' + l.id + '\')" title="\u6807\u8BB0\u6B64\u56DE\u4FE1\u53EF\u7591">\u5B58\u3000\u7591</button>';
    }
    acts += '<button class="hy-filter-btn" onclick="_ltVerify(\'' + l.id + '\')" title="\u518D\u9063\u4FE1\u4F7F\u6838\u5B9E">\u9063\u4F7F\u6838\u5B9E</button>';
  }
  if (!isOutgoing && l.status === 'returned' && l._npcInitiated) {
    if (!l._playerReplied) {
      acts += '<button class="hy-filter-btn active" onclick="_ltReplyToNpc(\'' + l.id + '\')" title="\u56DE\u590D\u6B64\u51FD">\u56DE\u3000\u4E66</button>';
    }
    acts += '<button class="hy-filter-btn" onclick="_ltExcerptToEdict(\'' + l.id + '\')" title="\u5212\u9009\u4FE1\u4E2D\u6587\u5B57\u540E\u70B9\u6B64\uFF0C\u6458\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93">\u6458\u3000\u5165</button>';
  }
  acts += '<button class="hy-filter-btn' + (l._starred?' active':'') + '" onclick="_ltStar(\'' + l.id + '\')" title="\u6807\u8BB0\u91CD\u8981">' + (l._starred ? '\u2605' : '\u2606') + '</button>';

  if (acts) {
    html += '<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;' + (isOutgoing?'justify-content:flex-end;':'') + '">' + acts + '</div>';
  }

  // 信使状态条
  if (l.status === 'traveling' || l.status === 'delivered' || l.status === 'replying' || l.status === 'blocked') {
    var _cTxt = _ltGetStatusText(l);
    html += '<div style="font-size:10.5px;color:var(--ink-300);margin-top:4px;font-style:italic;letter-spacing:0.08em;' + (isOutgoing?'text-align:right;':'') + '">\u21A3 ' + escHtml(_cTxt) + '</div>';
  }
  html += '</div>'; // .hy-msg
  return html;
}

/** 信件状态文本（日制） */
function _ltGetStatusText(l) {
  if (l.status === 'traveling') {
    var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : 0;
    var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var arrDay = (typeof l._deliveryDay === 'number') ? l._deliveryDay
                : (typeof l.deliveryTurn === 'number') ? (l.deliveryTurn-1)*dpv : null;
    var arrDate = (typeof getTSText === 'function' && typeof l.deliveryTurn === 'number') ? getTSText(l.deliveryTurn) : '';
    if (l._recallSent) return '追回信使已派出';
    if (arrDay !== null && nowDay > arrDay + 15) return '⚠ 信使逾期未归（已超 ' + Math.round(nowDay - arrDay) + ' 天）';
    if (arrDay !== null) {
      var _rem = arrDay - nowDay;
      if (_rem <= 0) return '信使在途…… 即将抵达';
      return '信使在途…… 约 ' + Math.ceil(_rem) + ' 天后送达' + (arrDate ? '（' + arrDate + '）' : '');
    }
    return '信使在途……';
  }
  if (l.status === 'delivered') return '已送达，等待回函……';
  if (l.status === 'replying') return '回函在途……';
  if (l.status === 'intercepted') return '⚠ 信使失踪' + (l.interceptedBy ? '·疑为' + l.interceptedBy + '所为' : '');
  if (l.status === 'intercepted_forging') return '回函在途……（按：原信使疑被' + (l.interceptedBy||'敌方') + '所截·此回函真伪存疑）';
  if (l.status === 'recalled') return '信使已追回';
  if (l.status === 'blocked') return '⚠ 中书门下阻止，未能下达';
  if (l.status === 'returned') {
    var note = (GM._courierStatus||{})[l.id];
    return note || '信使已归';
  }
  return l.status || '';
}

/** NPC选择（单选/多选模式） */
function _ltSelectTarget(name) {
  if (GM._ltMultiMode) {
    if (!GM._ltMultiTargets) GM._ltMultiTargets = [];
    var idx = GM._ltMultiTargets.indexOf(name);
    if (idx >= 0) GM._ltMultiTargets.splice(idx, 1);
    else GM._ltMultiTargets.push(name);
  } else {
    GM._pendingLetterTo = name;
  }
  renderLetterPanel();
}

/** 统计辅助函数 */
function _ltCountUnread(name) {
  return (GM.letters||[]).filter(function(l) { return l.from === name && !l._playerRead; }).length;
}
function _ltCountTransit(name) {
  return (GM.letters||[]).filter(function(l) { return l.to === name && (l.status === 'traveling' || l.status === 'replying'); }).length;
}
function _ltCountLost(name) {
  return (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'intercepted'; }).length
    + (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'traveling' && GM.turn > l.deliveryTurn + 1; }).length;
}
function _ltCountNpcNew(name) {
  return (GM.letters||[]).filter(function(l) { return l.from === name && !l._playerRead && l.status === 'returned'; }).length;
}

/** 检查驿路是否阻断 */
function _ltIsRouteBlocked(from, to) {
  var disruptions = GM._routeDisruptions || [];
  return disruptions.some(function(d) {
    if (d.resolved) return false;
    // 检查方向是否匹配（任一端点匹配即视为阻断）
    return (d.from === from || d.to === from || d.from === to || d.to === to || d.route === from + '-' + to || d.route === to + '-' + from);
  });
}

/** 标记回信存疑 */
function _ltSuspect(letterId) {
  if (!GM._letterSuspects) GM._letterSuspects = [];
  if (GM._letterSuspects.indexOf(letterId) < 0) GM._letterSuspects.push(letterId);
  toast('已标记此信存疑，AI推演将据此判断');
  renderLetterPanel();
}

/** 标记/取消重要 */
function _ltStar(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (l) l._starred = !l._starred;
  renderLetterPanel();
}

/** 追回信使 */
function _ltRecall(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l || l.status !== 'traveling') { toast('此信已无法追回'); return; }
  // 追回概率基于已过时间——刚发出容易追回，接近送达则难
  var elapsed = GM.turn - l.sentTurn;
  var total = l.deliveryTurn - l.sentTurn;
  var recallChance = total > 0 ? Math.max(0.1, 1 - (elapsed / total) * 0.8) : 0.5;
  l._recallSent = true;
  // 追回结果在下回合结算中处理
  l._recallChance = recallChance;
  toast('已派快马追回（成功率约' + Math.round(recallChance * 100) + '%），下回合见分晓');
  renderLetterPanel();
}

/** 回复NPC来函 */
function _ltReplyToNpc(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  // 守卫：仅 NPC 来函可调此函·防止误传玩家信件 id 把发信目标设成"玩家"自己
  if (!l._npcInitiated || !l.from || l.from === '玩家') return;
  // 设置当前目标为该NPC，并在textarea中预填回复提示
  GM._pendingLetterTo = l.from;
  GM._ltReplyingTo = letterId;
  renderLetterPanel();
  var ta = _$('letter-textarea');
  if (ta) { ta.focus(); ta.placeholder = '回复' + l.from + '的来函……'; }
}

/** 绕过中书门下阻止——改为密旨发出 */
function _ltBypassBlock(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  l.status = 'traveling';
  l.letterType = 'secret_decree';
  l.sentTurn = GM.turn;
  var days = calcLetterDays(l.fromLocation, l.toLocation, l.urgency || 'normal');
  var dpv = _getDaysPerTurn();
  l.deliveryTurn = GM.turn + Math.max(1, Math.ceil(days / dpv));
  l.replyTurn = l.deliveryTurn + Math.max(1, Math.ceil(days / dpv));
  toast('已改密旨直发——绕过中书门下');
  renderLetterPanel();
}

/** 摘入建议库（划选来函文字后点击，同问对流程） */
function _ltExcerptToEdict(letterId) {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('请先在来函中划选要摘录的文字'); return; }
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  var from = l ? (l.from || '?') : '?';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '鸿雁', from: from, content: text, turn: GM.turn, used: false });
  toast('已摘入诏书建议库');
  // 如果诏令tab可见则刷新
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/** 重发被截获的信件——选用更安全的传递方式（密使/多路加急）
 *  · 不删除原 letter（保留情报泄露记录）·新建一封"重发"信
 *  · 自动转为加急·可选 secret_agent / multi_courier·享受截获率折扣
 */
function _ltResend(letterId, mode) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  if (l._resendIssued) { toast('此信已重发过·请到新条目操作'); return; }
  var capital = GM._capital || '京城';
  var ch = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
  var toLoc = ch ? (ch.location || capital) : (l.toLocation || capital);
  var _newUrgency = mode === 'multi_courier' ? 'extreme' : 'urgent';
  var days = (typeof calcLetterDays === 'function') ? calcLetterDays(capital, toLoc, _newUrgency) : 5;
  var dpv = _getDaysPerTurn();
  var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
  var _nowDayR = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  var newLetter = {
    id: (typeof uid === 'function') ? uid() : 'rs_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    from: '玩家', to: l.to,
    fromLocation: capital, toLocation: toLoc,
    content: '【重发·前函疑被劫】' + (l.content||''),
    sentTurn: GM.turn,
    deliveryTurn: GM.turn + deliveryTurns,
    replyTurn: GM.turn + deliveryTurns + 1,
    _sentDay: _nowDayR,
    _deliveryDay: _nowDayR + days,
    _replyDay: _nowDayR + days * 2 + 3,
    _travelDays: days,
    reply: '', status: 'traveling',
    urgency: _newUrgency, letterType: l.letterType,
    _cipher: 'cipher_substitution', // 重发自动加密·防再次被读
    _sendMode: mode,
    _replyExpected: true,
    _resentFrom: letterId
  };
  if (!Array.isArray(GM.letters)) GM.letters = [];
  GM.letters.push(newLetter);
  l._resendIssued = true;
  // 起居注 + 编年
  var _date = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  if (Array.isArray(GM.qijuHistory)) {
    GM.qijuHistory.unshift({
      turn: GM.turn, date: _date,
      content: '【鸿雁重发】致' + l.to + '的前函疑被劫·改' + (mode === 'secret_agent' ? '密使暗递' : '多路八百里加急') + '重发。'
    });
  }
  if (typeof addEB === 'function') addEB('传书', '致' + l.to + '的信改' + (mode === 'secret_agent' ? '密使' : '多路加急') + '重发');
  toast('已遣' + (mode === 'secret_agent' ? '密使' : '多路加急') + '重发·约' + days + '天可达');
  if (typeof renderLetterPanel === 'function') renderLetterPanel();
}

/** 遣使核实 */
function _ltVerify(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  var capital = GM._capital || '京城';
  var ch = findCharByName(l.to);
  var toLoc = ch ? (ch.location || capital) : capital;
  var days = calcLetterDays(capital, toLoc, 'urgent');
  var dpv = _getDaysPerTurn();
  var _nowDayV = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  var verifyLetter = {
    id: uid(), from: '玩家', to: l.to,
    fromLocation: capital, toLocation: toLoc,
    content: '核实前函——朕遣使复核，卿是否曾收到前日来函并亲笔回书？',
    sentTurn: GM.turn, deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
    replyTurn: GM.turn + Math.max(2, Math.ceil(days * 2 / dpv)),
    _sentDay: _nowDayV,
    _deliveryDay: _nowDayV + days,
    _replyDay: _nowDayV + days * 2 + 3,
    _travelDays: days,
    reply: '', status: 'traveling', urgency: 'urgent',
    letterType: 'secret_decree', _verifyTarget: letterId,
    _sendMode: 'multi_courier', _replyExpected: true
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(verifyLetter);
  toast('已遣快马核实，约' + days + '天可知真伪');
  renderLetterPanel();
}

/** 发送信件（支持单发/群发/密使/多路/加密/信物） */
function sendLetter() {
  var textarea = _$('letter-textarea');
  var content = textarea ? textarea.value.trim() : '';
  if (!content) { toast('请写下信函内容'); return; }
  var urgency = _$('letter-urgency') ? _$('letter-urgency').value : 'normal';
  var letterType = _$('letter-type') ? _$('letter-type').value : 'personal';
  var cipher = _$('letter-cipher') ? _$('letter-cipher').value : 'none';
  var sendMode = _$('letter-sendmode') ? _$('letter-sendmode').value : 'normal';

  // 确定收信人列表
  var targets = [];
  if (GM._ltMultiMode && GM._ltMultiTargets && GM._ltMultiTargets.length > 0) {
    targets = GM._ltMultiTargets.slice();
  } else if (GM._pendingLetterTo) {
    targets = [GM._pendingLetterTo];
  }
  if (targets.length === 0) { toast('请先选择收信人'); return; }
  // 自检·剔除自己 + 在京者
  try {
    var _selfNm2 = (P.playerInfo && P.playerInfo.characterName) || '';
    var _capSelf = GM._capital || '京师';
    var _drop = [];
    targets = targets.filter(function(tn) {
      if (_selfNm2 && tn === _selfNm2) { _drop.push(tn + '(自己)'); return false; }
      var _ch = (typeof findCharByName === 'function') ? findCharByName(tn) : null;
      if (_ch) {
        // 用 _isSameLocation·走规范化别名表（京师/紫禁城/顺天府=京城）·
        // 避免硬编码 /京/ 误伤 南京/京口/京广路 等含"京"字异地
        var _atCap = !_ch.location || (typeof _isSameLocation === 'function' && _isSameLocation(_ch.location, _capSelf));
        if (_atCap && !_ch._travelTo) { _drop.push(tn + '(在京)'); return false; }
      }
      return true;
    });
    if (_drop.length > 0) toast('已剔除：' + _drop.join('·') + '·宜面陈或召对');
    if (targets.length === 0) return;
  } catch(_){}

  var capital = GM._capital || '京城';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeLabel = (LETTER_TYPES[letterType]||{}).label || '书信';
  var sentDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  var dpv = _getDaysPerTurn();
  var multiCount = targets.length > 1 ? targets.length : 0;

  // 信物检查（征调令需虎符等）
  // _tokenUsed 只在实际持有时填充——表示"此函确已加盖/附带此信物"·UI 据此显示徽标·
  // 投递时 NPC 视角的"未见信物可拒"判断改由 letterType→needsToken 派生·见 _settleLettersAndTravel
  var tokenNeeded = (LETTER_TYPES[letterType]||{}).needsToken;
  var tokenUsed = '';
  if (tokenNeeded && typeof tokenNeeded === 'string') {
    var _hasToken = (GM.items||[]).some(function(it) { return it.type === tokenNeeded || it.name === (LETTER_TOKENS[tokenNeeded]||{}).label; });
    if (!_hasToken) {
      toast('⚠ 未持有' + ((LETTER_TOKENS[tokenNeeded]||{}).label||'凭证') + '——对方可能疑诏不从');
    } else {
      tokenUsed = tokenNeeded;
    }
  }

  // 密使模式：选择一个NPC作为信使
  var agentName = '';
  if (sendMode === 'secret_agent') {
    var _agentSel = _$('letter-agent');
    agentName = _agentSel ? _agentSel.value : '';
  }

  // 正式诏令经中书门下（权臣可能阻挠）
  var _formalBlocked = false;
  if ((LETTER_TYPES[letterType]||{}).formal) {
    // 检查是否有权臣把控中书——通过官制系统
    var _primeMin = _ltFindPrimeMinister();
    if (_primeMin && (_primeMin.loyalty||50) < 30 && (_primeMin.ambition||50) > 70) {
      _formalBlocked = true;
      toast('⚠ ' + _primeMin.name + '阻挠此诏令流转——可改用密旨绕过');
    }
  }

  // 默认多路信使——更真实（古代正式公文常派 2-3 路）·享受截获率折扣
  if (!sendMode || sendMode === 'normal') sendMode = 'multi_courier';
  var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;

  targets.forEach(function(target) {
    var ch = findCharByName(target);
    var toLoc = ch ? (ch.location || capital) : capital;
    var days = calcLetterDays(capital, toLoc, urgency);
    // 密使模式速度更慢但更安全
    if (sendMode === 'secret_agent') days = Math.ceil(days * 1.5);
    // 回合数仍计算·UI/兼容用·但所有判定走 day
    var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
    var replyDays = days * 2 + 3;
    var replyTurns = Math.max(deliveryTurns + 1, Math.ceil(replyDays / dpv));

    var letter = {
      id: uid(), from: '玩家', to: target,
      fromLocation: capital, toLocation: toLoc,
      content: content, sentTurn: GM.turn,
      deliveryTurn: GM.turn + deliveryTurns,
      replyTurn: GM.turn + replyTurns,
      // 时间制字段（权威·跨剧本一致）
      _sentDay: nowDay,
      _deliveryDay: nowDay + days,
      _replyDay: nowDay + replyDays,
      _travelDays: days,
      reply: '', status: _formalBlocked ? 'blocked' : 'traveling',
      urgency: urgency, letterType: letterType,
      _cipher: cipher, _sendMode: sendMode,
      _tokenUsed: tokenUsed, _agentName: agentName,
      _multiRecipients: multiCount > 0 ? multiCount : undefined,
      _replyingTo: GM._ltReplyingTo || undefined,
      _replyExpected: true
    };

    // 如果是回复NPC来函，标记原函已回复
    if (GM._ltReplyingTo) {
      var origLetter = (GM.letters||[]).find(function(x){ return x.id === GM._ltReplyingTo; });
      if (origLetter) origLetter._playerReplied = true;
    }

    // 征调令/密旨→自动注册诏令追踪
    if (letterType === 'military_order' || letterType === 'secret_decree' || letterType === 'formal_edict') {
      if (!GM._edictTracker) GM._edictTracker = [];
      GM._edictTracker.push({
        content: content, category: letterType === 'military_order' ? '军令' : '政令',
        turn: GM.turn, status: 'pending', source: 'letter',
        target: target, letterId: letter.id
      });
    }

    if (!GM.letters) GM.letters = [];
    GM.letters.push(letter);
  });

  if (GM.qijuHistory) {
    var _targetNames = targets.join('、');
    GM.qijuHistory.unshift({ turn: GM.turn, date: sentDate, content: '【鸿雁传书】遣' + (urgLabels[urgency]||'驿递') + '致' + _targetNames + '（' + typeLabel + (cipher !== 'none' ? '·' + (LETTER_CIPHERS[cipher]||{}).label : '') + '）。内容：' + content });
  }

  if (textarea) textarea.value = '';
  GM._ltReplyingTo = undefined;
  GM._ltMultiMode = false;
  GM._ltMultiTargets = [];
  toast(targets.length > 1 ? '已群发' + targets.length + '函' : '信函已发出（' + (urgLabels[urgency]||'驿递') + '）');
  renderLetterPanel();
}

/** 查找宰相/中书令 */
function _ltFindPrimeMinister() {
  if (!P.officeConfig) return null;
  var _depts = P.officeConfig.departments || [];
  for (var i = 0; i < _depts.length; i++) {
    var d = _depts[i];
    if (d.name && (d.name.indexOf('中书') >= 0 || d.name.indexOf('宰') >= 0 || d.name.indexOf('丞相') >= 0)) {
      var _pos = d.positions || [];
      for (var j = 0; j < _pos.length; j++) {
        if (_pos[j].holder) return findCharByName(_pos[j].holder);
      }
    }
  }
  return null;
}

/** 每回合结算信件传递+角色赶路 (注册到SettlementPipeline)
 *  R: 时间制重构——所有"已等多久"判定均以"实际天数"为标尺·跨剧本一致
 *     dpv=90 的剧本和 dpv=7 的剧本·"信件 30 天内焦虑续问"是同一行为
 */
function _settleLettersAndTravel() {
  var dpv = _getDaysPerTurn();
  if (!Array.isArray(GM.letters)) GM.letters = [];
  if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
  if (!GM._courierStatus) GM._courierStatus = {};
  if (!GM._npcCorrespondence) GM._npcCorrespondence = [];

  var _gMode = (P.conf && P.conf.gameMode) || '';
  var _canIntercept = _gMode === 'strict_hist' || _gMode === 'light_hist';
  var _hostileFacs = (GM.facs||[]).filter(function(f){ return !f.isPlayer && (f.playerRelation||0) < -50; });
  // 当前累计天数（跨剧本统一标尺）
  var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  // 取信件的"实际到达天"·兼容旧存档（仅有 deliveryTurn）
  function _ltArrivalDay(l) {
    if (typeof l._deliveryDay === 'number') return l._deliveryDay;
    if (typeof l.deliveryTurn === 'number') return (l.deliveryTurn - 1) * dpv;
    return Infinity; // 数据不全·永不到达·让自愈段兜底
  }
  function _ltReplyArrivalDay(l) {
    if (typeof l._replyDay === 'number') return l._replyDay;
    if (typeof l.replyTurn === 'number') return (l.replyTurn - 1) * dpv;
    return _ltArrivalDay(l) + Math.max(7, dpv); // 兜底
  }
  function _ltInterceptDay(l) {
    if (typeof l._interceptedDay === 'number') return l._interceptedDay;
    if (typeof l._interceptedTurn === 'number') return (l._interceptedTurn - 1) * dpv;
    return null;
  }

  // 0a·重度逾期自愈——超过到达日 30 天仍 traveling 视为驿递事故·强制送达
  // （日制·跨剧本一致：dpv=7 的剧本里也是 30 天而非"4 回合 = 28 天"）
  // intercepted 久未消化阈值：60 天
  GM.letters.forEach(function(l) {
    if (!l) return;
    var _arr = _ltArrivalDay(l);
    if (l.status === 'traveling' && nowDay > _arr + 30) {
      l._autoHealed = true;
      l._deliveryDay = nowDay; // 触发本轮 Section 1/Section 3 处理
      l.deliveryTurn = GM.turn; // 同步保留兼容字段
      if (typeof addEB === 'function') addEB('传书', '逾期信件自愈：致' + (l.to||l.from) + '的信件强制送达（驿递晚到）');
    }
    if (l.status === 'intercepted' && nowDay > _arr + 60) {
      l._autoHealed = true;
      l.status = 'returned';
      if (!l.reply) l.reply = '（信使遗失多日·辗转送达·原文已部分残缺）';
      GM._courierStatus[l.id] = '信使辗转归来·原信物大部完好';
      if (Array.isArray(GM._undeliveredLetters)) {
        GM._undeliveredLetters = GM._undeliveredLetters.filter(function(u){
          return !(u && u.from === l.from && u.to === l.to && u.content === l.content);
        });
      }
      if (typeof addEB === 'function') addEB('传书', '失踪信使归来：致' + (l.to||l.from) + '的旧信终于送达');
    }
  });

  // 0. 处理追回信使
  (GM.letters||[]).forEach(function(l) {
    if (l._recallSent && l.status === 'traveling' && !l._recallResolved) {
      l._recallResolved = true;
      if (Math.random() < (l._recallChance||0.5)) {
        l.status = 'recalled';
        if (typeof addEB === 'function') addEB('传书', '致' + l.to + '的信使已追回');
        toast('信使已追回——致' + l.to + '的函未送达');
      } else {
        if (typeof addEB === 'function') addEB('传书', '追回信使失败——致' + l.to + '的函仍在途');
      }
    }
  });

  // 1. 推进玩家信件（日制判定·跨剧本一致）
  (GM.letters||[]).forEach(function(l) {
    if (l.status === 'blocked') return; // 被中书阻挠
    if (l.status === 'recalled') return;
    if (l.status === 'traveling' && nowDay >= _ltArrivalDay(l)) {
      // 截获判定
      if (_canIntercept && !l._interceptChecked) {
        l._interceptChecked = true;
        var _rate = _ltCalcInterceptRate(l, _hostileFacs);
        if (Math.random() < _rate) {
          _ltDoIntercept(l, _hostileFacs);
          return;
        }
      }
      // NPC 来函不在此推进状态——交给下方 Section 3（_npcInitiated 专属流水线）
      // 否则状态会被改成 'delivered'·导致 Section 3 的 status==='traveling' 守卫失效·
      // 进而漏发到达 toast/邸报/起居·并漏推 _suggestion 到诏书建议库
      if (l._npcInitiated) return;
      l.status = 'delivered';
      if (typeof addEB === 'function') addEB('传书', '致' + (l.to||l.from) + '的信已送达' + (l.toLocation||''));
      // 收信者记忆（玩家→NPC 的信件，无论是否回信都记入记忆）
      if (!l._npcInitiated && l.to) {
        try {
          if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
            var _rcvCh = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
            if (_rcvCh && _rcvCh.alive !== false) {
              var _typeLabel = (typeof LETTER_TYPES !== 'undefined' && LETTER_TYPES[l.letterType]) ? LETTER_TYPES[l.letterType].label : '来函';
              var _urgLabel = l.urgency === 'extreme' ? '八百里加急' : l.urgency === 'urgent' ? '加急' : '驿递';
              var _subj = l.subjectLine ? ('《' + String(l.subjectLine).slice(0,20) + '》') : '';
              var _body = String(l.content || '').replace(/<[^>]+>/g, '').slice(0, 80);
              var _memTxt = '收天子亲笔' + _typeLabel + '(' + _urgLabel + ')' + _subj + '：' + _body;
              // 情绪依据信件类型与称谓
              var _emoMap = {
                edict: '敬', secret_edict: '惧', military_order: '惧', summons: '敬',
                inquiry: '平', encouragement: '喜', reprimand: '惧',
                personal: '喜', consolation: '哀', condolence: '哀',
                appointment: '敬', promotion: '喜', dismissal: '怒'
              };
              var _emo = _emoMap[l.letterType] || '敬';
              var _weight = l.urgency === 'extreme' ? 8 : l.urgency === 'urgent' ? 7 : 6;
              NpcMemorySystem.remember(l.to, _memTxt, _emo, _weight, '天子', {
                type: 'dialogue',
                source: 'witnessed',
                credibility: 100
              });
            }
          }
        } catch(_memE) {}
      }
      if (!l._npcInitiated) _generateLetterReply(l);
    }
    if (l.status === 'replying' && nowDay >= _ltReplyArrivalDay(l)) {
      l.status = 'returned';
      var _replyNpc = findCharByName(l.to);
      var _dem = _replyNpc ? (_replyNpc.loyalty > 80 ? '恭敬拜读' : _replyNpc.loyalty < 30 ? '面色凝重' : _replyNpc.stress > 70 ? '神色疲惫' : '速具回书') : '已收函';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + _dem + '。';
      // 兜底：AI 异步未返回时·按 NPC 性格态度合成简短回信·避免空白回信
      if (!l.reply || !String(l.reply).trim()) {
        var _toneTxt = '臣' + (l.to||'') + '叩首拜读圣函。';
        if (_replyNpc) {
          var _favorR = 0;
          try { if (_replyNpc._impressions && _replyNpc._impressions['玩家']) _favorR = _replyNpc._impressions['玩家'].favor || 0; } catch(_){}
          if ((_replyNpc.loyalty||50) >= 75 && _favorR >= 0) {
            _toneTxt = '臣' + _replyNpc.name + '谨奉圣函·披沥肝胆·当尽心承命。容臣详察具复·必不负圣意。';
          } else if ((_replyNpc.loyalty||50) < 35 || _favorR <= -10) {
            _toneTxt = '臣' + _replyNpc.name + '已得圣函·容臣三思后再行回奏。圣意所指·臣自当揣度·然事有缓急·不敢轻断。';
          } else if ((_replyNpc.stress||0) > 70) {
            _toneTxt = '臣' + _replyNpc.name + '俯读圣函·近日忧劳形于心·容臣定神后详禀。';
          } else {
            _toneTxt = '臣' + _replyNpc.name + '拜领圣函·谨当详察·不日具复。';
          }
        }
        l.reply = _toneTxt;
        l._fallbackReply = true;
      }
      // 核实信处理
      if (l._verifyTarget) {
        var _orig = (GM.letters||[]).find(function(x){ return x.id === l._verifyTarget; });
        if (_orig && _orig._isForged) {
          l.reply = '臣' + l.to + '惶恐顿首——臣从未收到前日来函，更未曾回书！此前所谓回信必是伪造！请陛下明察！';
          _orig._forgedRevealed = true;
          if (typeof addEB === 'function') addEB('传书', '⚠ ' + l.to + '证实前函回信系伪造！');
        }
      }
      // 征调令未附信物→NPC可能不从
      // 改以信件类型派生"是否需要虎符"·而非依赖 _tokenUsed（后者已改为"实际附带"语义）
      var _needsTally = (LETTER_TYPES[l.letterType]||{}).needsToken === 'tally';
      if (_needsTally && l.letterType === 'military_order' && l._tokenUsed !== 'tally') {
        if (_replyNpc && (_replyNpc.loyalty||50) < 60) {
          l.reply = (l.reply||'') + '\n（按：' + l.to + '以未见虎符为由，暂未奉行征调。）';
        }
      }
      var replyDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: replyDate, content: '【鸿雁传书】' + l.to + '回函到达。' + (l.reply||'') });
    }
    // 伪造回信
    if (l.status === 'intercepted_forging' && nowDay >= _ltReplyArrivalDay(l)) {
      l.status = 'returned'; l._isForged = true;
      l.reply = '臣谨奉诏。诸事安好，请陛下放心。臣当继续勉力。';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + '已收函。';
      var _fd = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: _fd, content: '【鸿雁传书】' + l.to + '回函到达。' + l.reply });
      if (!GM._interceptedIntel) GM._interceptedIntel = [];
      GM._interceptedIntel.push({ turn: GM.turn, interceptor: l.interceptedBy||'敌方', from: '伪造', to: '皇帝', content: '敌方已伪造' + l.to + '的回信欺骗玩家', urgency: 'forged' });
    }
  });

  // 2. NPC主动来书入队（日制·默认多路驿递）
  // R: 用 try/catch 隔离每条 nl·防止单条数据异常（缺 from/content/type）卡死整批
  if (GM._pendingNpcLetters && GM._pendingNpcLetters.length > 0) {
    var capital = GM._capital || '京城';
    var _enqueued = 0, _skipped = 0;
    GM._pendingNpcLetters.forEach(function(nl) {
      try {
        if (!nl || !nl.from) { _skipped++; return; }
        var fromCh = findCharByName(nl.from);
        var fromLoc = fromCh ? (fromCh.location || '远方') : '远方';
        var days = (typeof calcLetterDays === 'function') ? calcLetterDays(fromLoc, capital, nl.urgency || 'normal') : 5;
        if (!isFinite(days) || days < 1) days = 5;
        var letter = {
          id: uid(), from: nl.from, to: '玩家', fromLocation: fromLoc, toLocation: capital,
          content: nl.content||'', sentTurn: GM.turn,
          deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
          // 时间制·权威字段
          _sentDay: nowDay,
          _deliveryDay: nowDay + days,
          _travelDays: days,
          reply: '', status: 'traveling', urgency: nl.urgency||'normal',
          letterType: nl.type||'report', _npcInitiated: true,
          _replyExpected: nl.replyExpected !== false, _playerRead: false,
          _suggestion: nl.suggestion || '',
          _sendMode: 'multi_courier' // NPC 默认多路驿递（更真实·享 ×0.15 截获折扣）
        };
        if (_canIntercept && nl.type !== 'proclamation') {
          var _r2 = _ltCalcInterceptRate(letter, _hostileFacs);
          if (Math.random() < _r2) { _ltDoIntercept(letter, _hostileFacs); }
        }
        // NPC记住自己写了什么（防止续奏/来函前后矛盾）
        if (nl.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          var _typeLabels = {report:'奏报',plea:'陈情',warning:'急报',intelligence:'密信',personal:'私函'};
          NpcMemorySystem.remember(nl.from, '向天子上' + (_typeLabels[nl.type]||'书') + '：' + (nl.content||'').slice(0,60), '平', 5);
        }
        if (!GM.letters) GM.letters = [];
        GM.letters.push(letter);
        _enqueued++;
      } catch(_nlE) {
        _skipped++;
        try { (window.TM && TM.errors && TM.errors.captureSilent) && TM.errors.captureSilent(_nlE, 'pendingNpcLetter enqueue'); } catch(_){}
      }
    });
    if (_skipped > 0) console.warn('[settleLetters] NPC pending 队列：入队 ' + _enqueued + '·跳过 ' + _skipped);
    GM._pendingNpcLetters = [];
  }

  // 2b. NPC 焦虑续问：被截"皇帝→NPC"信件·15 天后 NPC 主动来函询问
  // 设计意图：让"截获"成为真正的双向事件——NPC 等不到旨意会焦虑·会续问
  // 触发条件：letter._npcInitiated=false（皇帝→NPC）+ status=intercepted + 截获已 15 天 + 未触发过续问
  // 日制·跨剧本一致（dpv=7 的剧本里也是 15 天而非"2 回合 = 14 天"）
  (GM.letters||[]).forEach(function(l) {
    if (!l || l._npcInitiated) return;
    var _icpDay = _ltInterceptDay(l);
    if (_icpDay === null) return;
    if (l.status !== 'intercepted' && l.status !== 'intercepted_forging') return;
    if (l._followupSent) return;
    var _waited = nowDay - _icpDay;
    if (_waited < 15) return;
    // 该 NPC 是否已收到玩家其他指令（同期送达的别的信）·是则不续问
    var _hasOtherDelivered = (GM.letters||[]).some(function(o) {
      return o && o !== l && o.from === '玩家' && o.to === l.to
        && (o.status === 'delivered' || o.status === 'returned' || o.status === 'replying')
        && o.sentTurn >= l._interceptedTurn;
    });
    if (_hasOtherDelivered) { l._followupSent = true; return; }
    // 让该 NPC 写来函·内容由 letterType 决定语气
    var _ch = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
    if (!_ch || _ch.alive === false) { l._followupSent = true; return; }
    var _loyalty = _ch.loyalty || 50;
    var _stress = _ch.stress || 0;
    var _typeWord = (LETTER_TYPES[l.letterType]||{}).label || '前函';
    var _txt;
    if (_loyalty >= 70 && _stress < 60) {
      _txt = '臣' + l.to + '惶恐顿首：闻陛下曾遣使示下，然臣久候不至。或途中有变。臣谨守本职，未敢轻擅，伏望陛下复降明诏，臣即奉行。';
    } else if (_loyalty < 35 || _stress >= 70) {
      _txt = '臣' + l.to + '冒死陈奏：陛下前所遣' + _typeWord + '迄未见达，臣进退失据·此地形势万变，臣不得不暂依旧例处置·若所行违陛下意，伏乞早赐明示。';
    } else {
      _txt = '臣' + l.to + '谨奏：闻有圣谕颁下，然驿信迟迟未到，恐有阻滞·臣暂仍按前旨守职·伏乞陛下复降明诏，以释臣心。';
    }
    if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
    GM._pendingNpcLetters.push({
      from: l.to, type: 'plea', urgency: l.urgency === 'extreme' ? 'urgent' : 'normal',
      content: _txt,
      suggestion: '速降复诏·或召' + l.to + '面陈',
      replyExpected: true,
      _triggeredByIntercept: true, _origLetterId: l.id
    });
    l._followupSent = true;
    if (typeof addEB === 'function') addEB('传书', l.to + '久不见旨·遣使来京续问');
  });

  // 3. NPC来信到达 → 自动推入诏书建议库
  // 同时认 traveling/delivered 两种入口·后者用于自愈历史存档（旧版 Section 1 误吞了状态推进·
  // 把 NPC 来函卡死在 delivered 上·导致整条到达流水线静默断掉）
  var _npcArrived = 0;
  (GM.letters||[]).forEach(function(l) {
    if (l._npcInitiated && (l.status === 'traveling' || l.status === 'delivered') && nowDay >= _ltArrivalDay(l)) {
      l.status = 'returned';
      _npcArrived++;
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.from + '的来函已送达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: ad, content: '【鸿雁传书】收到' + l.from + '自' + (l.fromLocation||'远方') + '来函。' });
      // NPC来函附带的可操作建议 → 自动推入诏书建议库（同问对/朝议流程）
      // 只推AI提炼的suggestion摘要，不推整封信原文
      if (l._suggestion) {
        if (!GM._edictSuggestions) GM._edictSuggestions = [];
        var _dup = GM._edictSuggestions.some(function(s) { return s.from === l.from && s.content === l._suggestion; });
        if (!_dup) {
          GM._edictSuggestions.push({
            source: '鸿雁', from: l.from, content: l._suggestion,
            turn: GM.turn, used: false
          });
        }
      }
    }
  });
  if (_npcArrived > 0) {
    try { if (typeof toast === 'function') toast('鸿雁：' + _npcArrived + ' 封新来函已抵达'); } catch(_){}
    try { if (typeof renderLetterPanel === 'function' && document.getElementById('letter-history')) renderLetterPanel(); } catch(_){}
  }

  // 4. NPC间通信（由AI推演，暂存在GM._pendingNpcCorrespondence）
  if (GM._pendingNpcCorrespondence && GM._pendingNpcCorrespondence.length > 0) {
    GM._pendingNpcCorrespondence.forEach(function(nc) {
      // 玩家的密探有概率截获
      var spyChance = 0.15; // 基础截获率
      if (GM._spyNetwork) spyChance += GM._spyNetwork * 0.01; // 情报网加成
      if (Math.random() < spyChance) {
        GM._npcCorrespondence.push({
          turn: GM.turn, from: nc.from, to: nc.to,
          content: nc.content||'', summary: nc.summary||'',
          implication: nc.implication||'', type: nc.type||'secret'
        });
        if (typeof addEB === 'function') addEB('情报', '截获' + nc.from + '致' + nc.to + '的密信');
      }
    });
    GM._pendingNpcCorrespondence = [];
  }

  // 5. 远方奏疏驿递到达
  if (GM._pendingMemorialDeliveries && GM._pendingMemorialDeliveries.length > 0) {
    var _arrivedMems = [];
    GM._pendingMemorialDeliveries = GM._pendingMemorialDeliveries.filter(function(mem) {
      if (mem.status === 'intercepted') return true; // 被截获的留在队列中（不到达）
      if (GM.turn >= mem._deliveryTurn) {
        mem.status = 'pending'; // 改为可批复
        mem.turn = GM.turn; // 更新为到达回合（让renderMemorials显示）
        mem._arrivedTurn = GM.turn;
        if (!GM.memorials) GM.memorials = [];
        GM.memorials.push(mem);
        _arrivedMems.push(mem);
        return false; // 从队列移除
      }
      return true; // 继续等待
    });
    _arrivedMems.forEach(function(mem) {
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('奏疏', mem.from + '自' + (mem._remoteFrom||'远方') + '的奏疏到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: ad, content: '【驿递奏疏】收到' + mem.from + '自' + (mem._remoteFrom||'远方') + '所上奏疏。' });
    });
    if (_arrivedMems.length > 0 && typeof renderMemorials === 'function') renderMemorials();
  }

  // 6. 角色赶路统一交 advanceCharTravelByDays 处理
  // (R: 此处旧实现会先清 _travelTo·导致 advanceCharTravelByDays 跳过·自动就任丢失·
  //  且未清 _travelAssignPost/_travelRemainingDays·留下脏字段·
  //  统一由 tm-endturn-core.js Phase 4.6 advanceCharTravelByDays 处理)
}

/** AI生成回信 */
/** 判定一封信是否走"安全路径"——双方均不在敌方实控区·驿路未阻·未围城
 *  在安全路径上·截获率应极低（≤5%）·只剩极小的"民间盗匪/沿途劫掠"概率
 */
function _ltIsSafePath(l) {
  var _from = l.fromLocation, _to = l.toLocation;
  // 端点检测：是否在敌方实控领土
  function _inEnemyTerr(loc) {
    if (!loc) return false;
    return (GM.facs||[]).some(function(f) {
      if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
      var _fTerr = f.territories || f.territory || [];
      if (typeof _fTerr === 'string') _fTerr = [_fTerr];
      return _fTerr.indexOf(loc) >= 0;
    });
  }
  if (_inEnemyTerr(_from) || _inEnemyTerr(_to)) return false;
  // 围城
  var _besieged = (GM._sieges||[]).some(function(s) { return s.target === _from || s.target === _to; });
  if (_besieged) return false;
  // 驿路阻断
  if (_ltIsRouteBlocked(_from, _to)) return false;
  return true;
}

/** 读取国势四象（皇权/皇威/民心/吏治·均 0-100）·多源回退·缺省 50 */
function _ltReadStateMetric(zhKey, enKey) {
  if (typeof GM === 'undefined' || !GM) return 50;
  var x = GM[enKey];
  if (x != null) {
    if (typeof x === 'number') return x;
    if (typeof x === 'object') {
      if (typeof x.index === 'number') return x.index;
      if (typeof x.value === 'number') return x.value;
    }
  }
  if (GM.vars && GM.vars[zhKey] && typeof GM.vars[zhKey].value === 'number') return GM.vars[zhKey].value;
  return 50;
}

/** 国势四象对截获率的乘数：
 *  四项均高（≥80）·驿政清明·盗匪不敢劫·乘数低至 0.4；
 *  四项均低（≤20）·吏治崩坏·盗匪横行·乘数高至 2.0；
 *  中位 50 → 1.0。设计上以"吏治+皇威"为主轴（直接影响驿政），"皇权+民心"为辅（间接威慑）
 */
function _ltStateMultiplier() {
  var _hq = _ltReadStateMetric('皇权', 'huangquan');
  var _hw = _ltReadStateMetric('皇威', 'huangwei');
  var _mx = _ltReadStateMetric('民心', 'minxin');
  var _lz = _ltReadStateMetric('吏治', 'lizhi');
  // 加权平均：吏治40% + 皇威30% + 皇权15% + 民心15%
  var _w = (_lz * 0.40) + (_hw * 0.30) + (_hq * 0.15) + (_mx * 0.15);
  // 50 → 1.0；80 → 0.55；100 → 0.4；20 → 1.55；0 → 2.0
  // 公式：(1 - (w-50)/50 × 0.6) ·下限 0.4 上限 2.0
  var _mul = 1 - ((_w - 50) / 50) * 0.6;
  return Math.max(0.4, Math.min(2.0, _mul));
}

/** 计算截获概率（基于地理、势力范围、驿路、加密、信件类型）
 *  R: 时间制 + 安全路径 + 国势调节 三重重构
 *  设计原则：
 *    1. 同省内/同地→零截获（在自家驿站网覆盖范围）
 *    2. 安全路径（无敌占区·无路阻·无围城）→ 上限 3%（仅模拟民间偶发劫掠）
 *    3. 国势四象（皇权/皇威/民心/吏治）综合调节·清明朝政可降至 0.4 倍·崩坏朝政升至 2.0 倍
 *    4. light_hist 整体 ×0.3·strict_hist 维持基础值
 *    5. formal_edict / military_order 走官方驿递·×0.6 朝廷招牌保护
 *    6. 默认 multi_courier 模式·×0.15·真实模拟"派多路信使"
 *    7. 仅在真正穿越敌占区或被围困时才有可观察的截获率（最高 30%）
 */
function _ltCalcInterceptRate(l, hostileFacs) {
  if (l.letterType === 'proclamation') return 0; // 檄文公开
  var _from = l.fromLocation, _to = l.toLocation;
  // 同省/同地·零截获（在自家驿站网内）
  if (typeof _ltCheckSameProvince === 'function' && _ltCheckSameProvince(_from, _to)) return 0;
  if (typeof _isSameLocation === 'function' && _isSameLocation(_from, _to)) return 0;

  var _safe = _ltIsSafePath(l);

  // 基础概率（降低基线·让远方信件默认能到）
  var rate = l.urgency === 'extreme' ? 0.01 : l.urgency === 'urgent' ? 0.02 : 0.03;
  // 信件类型权重
  var tw = (LETTER_TYPES[l.letterType]||{}).interceptWeight;
  if (tw !== undefined) rate *= (tw || 0.1);
  // 敌对势力存在·安全路径不加成；不安全路径才加
  if (!_safe && hostileFacs && hostileFacs.length > 0) rate += 0.02;
  // 地理因素：目标地/起点是否在敌方实控区（已在 _safe 中检测·这里再加权）
  var _inHostile = !_safe && (function(){
    var _loc = _to || _from;
    return (GM.facs||[]).some(function(f) {
      if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
      var _fTerr = f.territories || f.territory || [];
      if (typeof _fTerr === 'string') _fTerr = [_fTerr];
      return _fTerr.indexOf(_loc) >= 0;
    });
  })();
  if (_inHostile) rate += 0.10;
  // 围城（沟死）
  var _besieged = (GM._sieges||[]).some(function(s) { return s.target === _from || s.target === _to; });
  if (_besieged) rate += 0.15;
  // 驿路阻断
  if (_ltIsRouteBlocked(_from, _to)) rate += 0.06;
  // 加密降低截获内容可读性（但不降低截获率——只降低情报价值）
  // 密使模式·走暗线·截获率显著降低
  if (l._sendMode === 'secret_agent') rate *= 0.3;
  // 多路信使·至少一路成功（默认模式·真实模拟）
  if (l._sendMode === 'multi_courier') rate *= 0.15;
  // 官方驿递·朝廷招牌·驿站给优待
  if (l._sendMode === 'courier_official') rate *= 0.4;
  // formal/military_order 是国家公文·走官方驿递保护
  if (l.letterType === 'formal_edict' || l.letterType === 'military_order') rate *= 0.6;

  // 国势四象调节·吏治/皇威/皇权/民心 加权·清明 0.4× / 崩坏 2.0×
  rate *= _ltStateMultiplier();

  // 模式调节：light_hist 总体*0.3·strict_hist 维持基础值
  var _gMode = (P.conf && P.conf.gameMode) || '';
  if (_gMode === 'light_hist') rate *= 0.3;

  // 上限：安全路径 3%·有路阻/敌占区/围城 30%
  var _cap = _safe ? 0.03 : 0.30;
  return Math.min(_cap, Math.max(0, rate));
}

/** 执行截获——同步触发四条反应链：情报泄露·叙事记账·NPC 焦虑续问·UI 可知截获方 */
function _ltDoIntercept(l, hostileFacs) {
  l.status = 'intercepted';
  var _int = hostileFacs && hostileFacs.length > 0 ? hostileFacs[Math.floor(Math.random()*hostileFacs.length)].name : '不明势力';
  l.interceptedBy = _int;
  l._interceptedTurn = GM.turn; // 兼容字段
  l._interceptedDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : ((GM.turn-1)*((P.time && P.time.daysPerTurn)||30)); // 权威·NPC 焦虑/续问按天判定
  // 加密影响情报价值
  var _cipherInfo = LETTER_CIPHERS[l._cipher] || LETTER_CIPHERS.none;
  var _canRead = Math.random() < _cipherInfo.interceptReadChance;
  if (!GM._interceptedIntel) GM._interceptedIntel = [];
  GM._interceptedIntel.push({
    turn: GM.turn, interceptor: _int,
    from: l._npcInitiated ? l.from : '皇帝', to: l._npcInitiated ? '皇帝' : l.to,
    content: _canRead ? (l.content||'') : '（密函已截获但无法破译内容）',
    urgency: l.urgency||'normal', letterType: l.letterType||'personal',
    encrypted: !_canRead,
    militaryRelated: _canRead && ((l.content||'').indexOf('兵') >= 0 || (l.content||'').indexOf('军') >= 0 || l.letterType === 'military_order'),
    diplomaticRelated: _canRead && ((l.content||'').indexOf('盟') >= 0 || (l.content||'').indexOf('使') >= 0)
  });
  if (GM._interceptedIntel.length > 30) GM._interceptedIntel.shift();

  // ── 反应链 1：玩家信被截·NPC 不知旨意·进入"未送达指令"队列（AI prompt 让 NPC 按"没收到"行事）──
  if (!l._npcInitiated) {
    if (!GM._undeliveredLetters) GM._undeliveredLetters = [];
    GM._undeliveredLetters.push({ from: l.from, to: l.to, content: l.content, turn: GM.turn, interceptor: _int, letterType: l.letterType, letterId: l.id });
  }

  // ── 反应链 2：UI 状态条立即显示截获方（不再只说"失踪"）──
  GM._courierStatus[l.id] = '⚠ 信使于 ' + _int + ' 控制区遇袭·去向不明';

  // ── 反应链 3：伪造回信·让玩家可能上当（已有机制·维持）──
  if (!l._npcInitiated) {
    var _iFac = (GM.facs||[]).find(function(f){ return f.name === _int; });
    if (_iFac && Math.random() < 0.3) {
      l._forgedReply = true; l.status = 'intercepted_forging'; l.replyTurn = GM.turn + 1;
    }
  }

  // ── 反应链 4：叙事记账·让玩家通过多个渠道知情 ──
  var _isMilitary = l.letterType === 'military_order' || (_canRead && ((l.content||'').indexOf('兵') >= 0 || (l.content||'').indexOf('军') >= 0));
  var _isDiplomatic = l.letterType === 'diplomatic' || l.letterType === 'diplomatic_dispatch';
  var _date = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  // 起居注：玩家几乎一定能看到
  if (Array.isArray(GM.qijuHistory)) {
    var _qijuTxt = l._npcInitiated
      ? '【鸿雁遇险】' + l.from + '自' + (l.fromLocation||'远方') + '的来函中途被劫·疑为' + _int + '所为'
      : '【鸿雁遇险】致' + l.to + '的' + (LETTER_TYPES[l.letterType]||{label:'书函'}).label + '于驿道遇袭·疑为' + _int + '所为';
    GM.qijuHistory.unshift({ turn: GM.turn, date: _date, content: _qijuTxt });
  }
  // 重大政令/军令被截·入编年史
  if (!l._npcInitiated && (_isMilitary || l.letterType === 'formal_edict' || _isDiplomatic)) {
    if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
    GM._chronicle.unshift({
      turn: GM.turn, date: _date, type: '鸿雁遇险',
      title: '致' + l.to + '的' + (_isMilitary ? '军令' : _isDiplomatic ? '国书' : '诏令') + '被劫',
      content: '驿使于' + (l.toLocation||'远途') + '附近遇袭·疑为' + _int + '所为' + (_canRead ? '·原文已落敌方' : '·所幸密函未破译') + '。',
      tags: ['鸿雁','截获', _int, l.to]
    });
  }
  // 风闻系统：让玩家通过其他渠道在后续回合"听说"信件被劫
  try {
    if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
      PhaseD.addFengwen({
        type: '驿事', turn: GM.turn,
        text: (l._npcInitiated ? l.from + '上书' : '朝廷致' + l.to) + '之信使在' + (l.toLocation||l.fromLocation||'远方') + '失踪·或为' + _int + '所截',
        credibility: _int === '不明势力' ? 0.5 : 0.75,
        source: 'courier_loss',
        actors: [l.from, l.to, _int].filter(Boolean)
      });
    }
  } catch(_){}

  // 事件总线（旧机制·保留）
  if (typeof addEB === 'function') addEB('传书', (l._npcInitiated ? l.from + '的来函' : '致' + l.to + '的') + '信使遇袭·疑为' + _int + '所为');
}

function _generateLetterReply(letter) {
  letter.status = 'replying';
  var ch = findCharByName(letter.to);
  if (!ch) { letter.reply = '臣已拜读圣函。'; letter.status = 'returned'; return; }
  // 注：收信记忆已在 _settleLettersAndTravel 的 delivered 节点注入，此处不重复

  var typeLabel = (LETTER_TYPES[letter.letterType]||{}).label || '书信';

  if (typeof callAI === 'function' && P.ai && P.ai.key) {
    var brief = (typeof getCharacterPersonalityBrief === 'function') ? getCharacterPersonalityBrief(ch) : ch.name;
    var memCtx = (typeof NpcMemorySystem !== 'undefined') ? NpcMemorySystem.getMemoryContext(ch.name) : '';
    // 对玩家好感/积怨·影响语气
    var favor = 0;
    try { if (ch._impressions && ch._impressions['玩家']) favor = ch._impressions['玩家'].favor || 0; } catch(_){}
    var toneHint = '';
    if (favor >= 20) toneHint = '\n语气：感激温厚·愿效死力';
    else if (favor >= 5) toneHint = '\n语气：恭敬有分寸';
    else if (favor <= -15) toneHint = '\n语气：表面恭顺但暗含怨怼或疏离·可有所保留';
    else if (favor <= -5) toneHint = '\n语气：礼数不失但缺少热络';
    else toneHint = '\n语气：标准臣礼·不卑不亢';

    // 情节弧·若有
    var arcCtx = '';
    try {
      var arc = (typeof GM !== 'undefined' && GM._charArcs && GM._charArcs[ch.name]) ? GM._charArcs[ch.name] : null;
      if (arc) {
        if (arc.arcStage) arcCtx += '\n当前境：'+arc.arcStage;
        if (arc.motivation) arcCtx += '\n当前动机：'+arc.motivation;
        if (arc.emotionalState) arcCtx += '\n情绪基调：'+arc.emotionalState;
      }
    } catch(_){}

    // 近期涉该 NPC 的玩家诏令
    var recentEdictCtx = '';
    try {
      var tracker = (GM._edictTracker || []).filter(function(e) {
        if (!e || !e.content) return false;
        return e.content.indexOf(ch.name) >= 0 && (GM.turn - (e.turn||0)) <= 3;
      }).slice(-3);
      if (tracker.length > 0) {
        recentEdictCtx = '\n玩家近期涉君诏令(回信可顺带回应)：';
        tracker.forEach(function(t) { recentEdictCtx += '\n  · ' + (t.content||'').slice(0, 80); });
      }
    } catch(_){}

    // 本轮往来上下文·若此信不是第一次
    var priorHistory = '';
    try {
      var earlier = (GM.letters || []).filter(function(l) {
        return l && l !== letter && ((l.to === ch.name) || (l.from === ch.name));
      }).slice(-3);
      if (earlier.length > 0) {
        priorHistory = '\n往来背景(近 3 封)：';
        earlier.forEach(function(l) {
          var dir = (l.from === ch.name) ? (ch.name+'→帝') : ('帝→'+ch.name);
          priorHistory += '\n  · '+dir+'·'+((l.content||'').slice(0, 50))+((l.reply&&l.from!==ch.name)?'(已回:'+l.reply.slice(0,40)+')':'');
        });
      }
    } catch(_){}

    var cipherLabel = (LETTER_CIPHERS && LETTER_CIPHERS[letter._cipher] && LETTER_CIPHERS[letter._cipher].label) || '不加密';
    var prompt = '你是' + ch.name + '·' + (ch.officialTitle||ch.title||'') + '·当前在' + (ch.location||'远方') + '。\n性格：' + brief;
    if (ch.stance) prompt += '\n政治立场：' + ch.stance;
    if (ch.party) prompt += '\n党派：' + ch.party + (ch.partyRank?'·'+ch.partyRank:'');
    if (memCtx) prompt += '\n近期心绪：' + memCtx;
    if (arcCtx) prompt += arcCtx;
    if (recentEdictCtx) prompt += recentEdictCtx;
    if (priorHistory) prompt += priorHistory;
    prompt += toneHint;
    if (typeof _buildTemporalConstraint === 'function') { try { prompt += _buildTemporalConstraint(ch); } catch(_){} }
    prompt += '\n\n收到来自京城天子的' + typeLabel + '('+cipherLabel+')：\n「' + letter.content + '」';
    prompt += '\n\n【回信要求】';
    prompt += '\n1. 以该角色口吻/身份/性格·100-200 字古典中文';
    prompt += '\n2. 称谓恰当(臣/末将/罪臣/妾身/草民等)';
    prompt += '\n3. 必须针对来信具体内容回应·不得套话空泛';
    prompt += '\n4. 若来信问及某事·直接给答复或说明缘由';
    prompt += '\n5. 若来信有命令·明确接旨或婉拒(附理由)';
    prompt += '\n6. 若近期有玩家涉君诏令·可在回信中顺带回应(感激/委屈/澄清/汇报)';
    prompt += '\n7. 语气与当前境/情绪/好感一致·不割裂';
    prompt += '\n8. 不要提及未在当前游戏时间之前发生的未来史实';
    prompt += '\n\n直接输出回信正文·无前言无解释。';
    callAI(prompt, 600).then(function(reply) {
      letter.reply = (reply || '').trim() || '臣叩首拜读·容臣三思后详禀。';
      letter.status = 'returned';
      letter._fallbackReply = false;
      try { if (typeof renderLetterPanel === 'function' && document.getElementById('letter-history')) renderLetterPanel(); } catch(_){}
      try { if (typeof addEB === 'function') addEB('传书', (letter.to||'') + '的回函已落笔'); } catch(_){}
    }).catch(function(err) {
      // AI 失败兜底：按性格写一条简短回信·而非千篇一律的"已拜读"
      var _ch2 = findCharByName(letter.to);
      var _t = '臣已拜读圣函·容臣三思。';
      if (_ch2) {
        if ((_ch2.loyalty||50) >= 75) _t = '臣' + _ch2.name + '谨遵圣谕·当竭股肱以效犬马·待详察后再行具奏。';
        else if ((_ch2.loyalty||50) < 35) _t = '臣' + _ch2.name + '已得来函·此事干系甚大·容臣再三斟酌后回奏。';
        else _t = '臣' + _ch2.name + '叩首拜读圣函·谨当详察·不日具复。';
      }
      letter.reply = _t;
      letter.status = 'returned';
      letter._fallbackReply = true;
      try { if (typeof renderLetterPanel === 'function' && document.getElementById('letter-history')) renderLetterPanel(); } catch(_){}
    });
  } else {
    letter.reply = '臣' + ch.name + '叩首·拜读圣函。容臣细思·当速具回奏。';
    letter.status = 'returned';
  }
}

/** AI prompt注入：角色位置+传书完整态势 */
function getLocationPromptInjection() {
  var capital = GM._capital || '京城';
  var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && !_isSameLocation(c.location, capital); });
  var allLetters = GM.letters || [];
  // 排除：returned(已回)/intercepted(已截)/recalled(已追回)/blocked(被阻于中书)
  // 这四类都不是"还在驿路上等结果"·不应作为在途态势喂给 AI prompt
  var pendingLetters = allLetters.filter(function(l) {
    return l.status !== 'returned' && l.status !== 'intercepted'
        && l.status !== 'recalled' && l.status !== 'blocked';
  });
  var suspectedIds = GM._letterSuspects || [];

  if (remote.length === 0 && allLetters.length === 0) return '';
  var lines = ['【鸿雁传书·完整态势】'];
  lines.push('京城：' + capital);

  if (remote.length > 0) {
    lines.push('不在京城的角色（不能参与朝堂对话/朝议）：');
    remote.forEach(function(c) {
      var line = '  ' + c.name + '（' + c.location + '）';
      if (c._travelTo) line += ' →正在赶往' + c._travelTo;
      if (c.title) line += ' ' + c.title;
      lines.push(line);
    });
  }

  // 在途信件
  if (pendingLetters.length > 0) {
    lines.push('当前在途信件：');
    pendingLetters.forEach(function(l) {
      var typeLabel = (LETTER_TYPES[l.letterType]||{}).label || '书信';
      var st = { traveling:'信使在途', delivered:'已送达待回信', replying:'回信在途', intercepted_forging:'回信在途' };
      if (l._npcInitiated) {
        lines.push('  ' + l.from + '→皇帝（' + typeLabel + '·' + (l.urgency==='extreme'?'八百里加急':l.urgency==='urgent'?'加急':'驿递') + '）：' + (st[l.status]||l.status));
      } else {
        lines.push('  皇帝→' + l.to + '（' + typeLabel + '·' + (l.urgency==='extreme'?'八百里加急':l.urgency==='urgent'?'加急':'驿递') + '）：' + (st[l.status]||l.status));
      }
    });
  }

  // 信使失踪（截获线索——玩家看到的是"信使逾期"）
  var lostLetters = allLetters.filter(function(l) {
    return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1);
  });
  if (lostLetters.length > 0) {
    lines.push('信使失踪（可能被截获）：');
    lostLetters.forEach(function(l) {
      var target = l._npcInitiated ? ('来自' + l.from) : ('致' + l.to);
      lines.push('  ' + target + '的信使已逾期' + (GM.turn - l.deliveryTurn) + '回合未归');
      if (l._npcInitiated) lines.push('    →' + l.from + '不知道皇帝是否收到其报告，可能焦虑或自行决断');
      else lines.push('    →' + l.to + '未收到皇帝命令，不会按旨行事');
    });
  }

  // 玩家存疑的信件
  if (suspectedIds.length > 0) {
    lines.push('玩家存疑的回信：');
    suspectedIds.forEach(function(sid) {
      var sl = allLetters.find(function(l){ return l.id === sid; });
      if (sl) lines.push('  致' + sl.to + '的回信被玩家标记存疑' + (sl._isForged ? '——【确实是伪造的】' : '——【实际是真信】'));
    });
    lines.push('  →若回信确系伪造，应在叙事中给出更多线索（如NPC行为与信中所述矛盾）');
    lines.push('  →若为真信但被存疑，NPC可能因不被信任而不满');
  }

  // NPC期望回信但未回
  var _npcWaiting = allLetters.filter(function(l) {
    return l._npcInitiated && l._replyExpected && l.status === 'returned' && !l._playerReplied && (GM.turn - l.deliveryTurn) > 2;
  });
  if (_npcWaiting.length > 0) {
    lines.push('NPC待回信（期望回复但玩家未回）：');
    _npcWaiting.forEach(function(l) {
      lines.push('  ' + l.from + '来函已等' + (GM.turn - l.deliveryTurn) + '回合未回→可能影响NPC情绪（忠诚、焦虑）');
    });
  }

  // 精确信息时差
  if (remote.length > 0) {
    lines.push('【各NPC信息时差——决定NPC基于什么信息做决策】');
    remote.forEach(function(c) {
      var lastReceived = 0;
      allLetters.forEach(function(l) {
        if (l.to === c.name && (l.status === 'delivered' || l.status === 'returned' || l.status === 'replying')) {
          lastReceived = Math.max(lastReceived, l.deliveryTurn || l.sentTurn);
        }
      });
      var lastSent = 0;
      allLetters.forEach(function(l) {
        if (l.from === c.name && l.status === 'returned') {
          lastSent = Math.max(lastSent, l.sentTurn);
        }
      });
      var delay = lastReceived > 0 ? (GM.turn - lastReceived) : '从未';
      lines.push('  ' + c.name + '（' + c.location + '）：');
      lines.push('    最后收到皇帝指令：' + (lastReceived > 0 ? delay + '回合前' : '从未') + ' → 其决策基于' + (lastReceived > 0 ? delay + '回合前的信息' : '自身判断'));
      if (lastSent > 0) lines.push('    最后来函：' + (GM.turn - lastSent) + '回合前');
      // 是否有未送达命令
      var _undel = (GM._undeliveredLetters||[]).filter(function(u) { return u.to === c.name; });
      if (_undel.length > 0) lines.push('    ⚠ 有' + _undel.length + '封命令未送达——此NPC不知道皇帝的指令');
    });
  }

  // 驿路阻断
  var _disruptions = (GM._routeDisruptions||[]).filter(function(d) { return !d.resolved; });
  if (_disruptions.length > 0) {
    lines.push('【驿路阻断】');
    _disruptions.forEach(function(d) {
      lines.push('  ' + (d.route||d.from+'-'+d.to) + '：' + (d.reason||'原因不明') + ' → 该方向信件截获率大幅提高');
    });
  }

  lines.push('');
  lines.push('【信件驱动NPC行为——核心规则】');
  lines.push('NPC收到皇帝信件后的行为必须在npc_actions中体现：');
  lines.push('  - 收到征调令+有虎符 → 执行调兵（但可能阳奉阴违）');
  lines.push('  - 收到征调令但无虎符 → 疑诏不从，或要求出示凭证');
  lines.push('  - 收到密旨 → 秘密执行（但密旨不经中书，法理性弱）');
  lines.push('  - 从未收到指令 → 按自身判断行事，可能与皇帝意图相悖');
  lines.push('  - 信使失踪多日 → NPC焦虑，可能派人来京打探');
  lines.push('NPC间也会通信——在npc_correspondence中输出重要的NPC间密信：');
  lines.push('  格式: {from,to,content,summary,implication,type:"secret/alliance/conspiracy/routine"}');
  lines.push('  只输出对剧情有影响的通信（密谋/结盟/背叛/情报交换），不必输出日常问候');
  lines.push('NPC主动来书：远方NPC遇重大事件时应在npc_letters中输出。');
  return lines.join('\n');
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
    if (!GM._lastEvalTurn || GM._lastEvalTurn < GM.turn - 3) {
      GM._lastEvalTurn = GM.turn;
      if (typeof addEB === 'function') addEB('官制', '考课之期——吏部应对百官考评');
    }
  }
}

function renderGameState(){
  // ★ 财政三字段同步守卫·防 money/balance/ledgers.stock 跑偏导致顶栏与面板数值不一致
  try { if (typeof _syncFiscalScalars === 'function' && typeof GM !== 'undefined') _syncFiscalScalars(GM); } catch(_syE) { try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_syE, 'renderGameState/sync'); } catch(__){} }
  // 旧 UI
  renderLeftPanel();
  renderBarResources();

  // 中间面板（游戏主体）
  var gc=_$("gc");if(!gc)return;
  gc.innerHTML="";

  // 面包屑
  var _bc=document.createElement("div");_bc.className="gs-breadcrumb";
  _bc.innerHTML='<span>朝野要务</span><span class="sep">›</span><span>本朝纪要</span><span class="sep">›</span><span class="cur" id="gs-bc-cur">朝 政</span>'
    +'<div class="gs-breadcrumb-right">'
    +'<button class="gs-bc-btn" onclick="if(typeof openGlobalSearch===\'function\')openGlobalSearch();">搜 寻</button>'
    +'<button class="gs-bc-btn" onclick="if(typeof openHelp===\'function\')openHelp();">帮 助</button>'
    +'</div>';
  gc.appendChild(_bc);

  // 标签栏（5 组分栏：政务/问答/纪录/臣子/文考）
  var tabBar=document.createElement("div");tabBar.className="gs-tab-bar";
  var _ti = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  var tabs=[
    {id:"gt-zhaozheng",label:"\u671D\u653F",icon:'office',group:'政务'},
    {id:"gt-edict",label:"\u8BCF\u4EE4",icon:'scroll',group:'政务'},
    {id:"gt-memorial",label:"\u594F\u758F",icon:'memorial',group:'政务'},
    {id:"gt-chaoyi",label:"\u671D\u8BAE",icon:'dialogue',group:'政务',action:'openChaoyi'},
    {id:"gt-wendui",label:"\u95EE\u5BF9",icon:'dialogue',group:'问答'},
    {id:"gt-letter",label:"\u9E3F\u96C1",icon:'scroll',group:'问答'},
    {id:"gt-biannian",label:"\u7F16\u5E74",icon:'chronicle',group:'纪录'},
    {id:"gt-qiju",label:"\u8D77\u5C45\u6CE8",icon:'qiju',group:'纪录'},
    {id:"gt-jishi",label:"\u7EAA\u4E8B",icon:'event',group:'纪录'},
    {id:"gt-shiji",label:"\u53F2\u8BB0",icon:'history',group:'纪录'},
    {id:"gt-office",label:"\u5B98\u5236",icon:'office',group:'臣子'},
    {id:"gt-renwu",label:"\u4EBA\u7269\u5FD7",icon:'person',group:'臣子'},
    {id:"gt-difang",label:"\u5730\u65B9",icon:'faction',group:'臣子'},
    {id:"gt-wenyuan",label:"\u6587\u82D1",icon:'scroll',group:'文考'},
    {id:"gt-keju",label:"\u79D1\u4E3E",icon:'scroll',group:'文考',action:'openKejuPanel'}
  ];
  // 按 group 分组
  var _curGroup=null, _curGroupEl=null, _tabIdx=0;
  tabs.forEach(function(t){
    if (t.group !== _curGroup){
      _curGroupEl=document.createElement('div');
      _curGroupEl.className='gs-tab-group';
      _curGroupEl.setAttribute('data-label', t.group || '');
      tabBar.appendChild(_curGroupEl);
      _curGroup=t.group;
    }
    var btn=document.createElement("button");
    btn.className='g-tab-btn gs-tab-btn'+(_tabIdx===0?" active":"");
    btn.innerHTML=_ti(t.icon,12)+' '+t.label;
    if (t.action) {
      btn.onclick=function(){ if(typeof window[t.action]==='function') window[t.action](); };
    } else {
      (function(_t,_b){
        _b.onclick=function(){
          switchGTab(_b,_t.id);
          if(_t.id==='gt-zhaozheng'){var zp=_$('gt-zhaozheng');if(zp)zp.innerHTML=_renderZhaozhengCenter();}
          var bc=_$('gs-bc-cur'); if(bc) bc.textContent=_t.label;
        };
      })(t,btn);
    }
    _curGroupEl.appendChild(btn);
    _tabIdx++;
  });
  gc.appendChild(tabBar);

  // 2.5: 朝政中心面板
  var zzP=document.createElement("div");zzP.className="g-tab-panel";zzP.id="gt-zhaozheng";zzP.style.cssText="flex:1;overflow-y:auto;padding:1rem;display:block;";
  zzP.innerHTML=_renderZhaozhengCenter();
  gc.appendChild(zzP);

  // 诏令面板
  var edictP=document.createElement("div");edictP.className="g-tab-panel";edictP.id="gt-edict";edictP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
  // 诏令区标题——根据玩家角色身份动态调整称谓
  var _edictRole='天子';
  var _sc2=findScenarioById&&findScenarioById(GM.sid);
  if(_sc2){
    var _r=_sc2.role||'';
    if(_r.indexOf('王')>=0||_r.indexOf('侯')>=0) _edictRole=_r;
    else if(_r) _edictRole=_r;
  }
  var _ei = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  // 诏令5类·含圆形字符徽章+宋体提示词
  var _edictCats = [
    {id:'edict-pol', label:'政 令', badge:'政', cls:'ed-c-pol', hint:'改革官制·任免官员·降旨安抚',  placeholder:'诏谕天下，如：改革官制、降旨安抚、任免官员……'},
    {id:'edict-mil', label:'军 令', badge:'军', cls:'ed-c-mil', hint:'调兵遣将·加强边防·讨伐叛贼',  placeholder:'调兵遣将，如：调动军队、加强边防、讨伐叛贼……'},
    {id:'edict-dip', label:'外 交', badge:'外', cls:'ed-c-dip', hint:'遣使和亲·结盟讨伐·册封藩属',  placeholder:'纵横捭阖，如：遣使和亲、结盟讨伐、册封藩属……'},
    {id:'edict-eco', label:'经 济', badge:'经', cls:'ed-c-eco', hint:'减税轻赋·开仓放粮·兴修水利',  placeholder:'经纶民生，如：减税轻赋、开仓放粮、兴修水利……'},
    {id:'edict-oth', label:'其 他', badge:'他', cls:'ed-c-oth', hint:'大赦·科举·建造·礼仪',          placeholder:'其他旨意，如：大赦天下、科举取士、建造宫殿……'}
  ];
  var edictHTML = '<div class="ed-panel-wrap" style="padding:var(--space-4) var(--space-5);">';

  // ═══ 左右并排布局 ═══
  edictHTML += '<div style="display:flex;gap:var(--space-5);align-items:flex-start;position:relative;z-index:1;">';

  // ── 左侧：建议库 ──
  edictHTML += '<div style="width:260px;flex-shrink:0;align-self:flex-start;position:sticky;top:20px;">';
  edictHTML += '<div class="ed-sug-title-wrap"><span class="ed-sug-title">\u8BAE \u4E8B \u6E05 \u518C</span></div>';
  edictHTML += '<div id="edict-sug-sidebar" style="display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow-y:auto;padding-right:4px;"></div>';
  edictHTML += '</div>';

  // ── 右侧：诏书编辑区 ──
  edictHTML += '<div style="flex:1;min-width:0;">';

  // 御笔标题 + 朱砂印章
  edictHTML += '<div class="ed-yubi-title">';
  edictHTML += '<div class="seal">'+escHtml(_edictRole)+'</div>';
  edictHTML += '<div class="main">' + escHtml(_edictRole) + ' \u5FA1 \u7B14</div>';
  edictHTML += '<div class="sub">\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u3000\u3000\u8BCF\u66F0</div>';
  edictHTML += '</div>';

  // 5 类诏令卡片
  edictHTML += '<div class="ed-cards">';
  _edictCats.forEach(function(cat) {
    edictHTML += '<div class="ed-card '+cat.cls+'">';
    edictHTML += '<div class="ed-card-hdr">';
    edictHTML += '<span class="ed-cat-icon">'+cat.badge+'</span>';
    edictHTML += '<span class="ed-cat-label">'+cat.label+'</span>';
    edictHTML += '<span class="ed-cat-hint">'+cat.hint+'</span>';
    edictHTML += '</div>';
    edictHTML += '<textarea id="'+cat.id+'" rows="2" class="edict-input paper-texture" placeholder="'+cat.placeholder+'" oninput="_edictLiveForecast(\''+cat.id+'\')"></textarea>';
    edictHTML += '<div id="'+cat.id+'-forecast" class="ed-forecast" style="display:none;"></div>';
    edictHTML += '</div>';
  });
  edictHTML += '</div>';

  // 建议库动态渲染
  _renderEdictSuggestions();

  // 润色控制行
  edictHTML += '<div class="ed-polish-bar">';
  edictHTML += '<span class="ed-polish-label">\u6587 \u98CE \u9009 \u62E9</span>';
  edictHTML += '<select id="edict-polish-style" style="font-size:12px;padding:6px 12px;background:var(--color-elevated);border:1px solid var(--color-border-subtle);color:var(--color-foreground);border-radius:2px;font-family:var(--font-serif);cursor:pointer;">';
  edictHTML += '<option value="elegant">\u5178\u96C5\u9A88\u6587</option>';
  edictHTML += '<option value="concise">\u7B80\u6D01\u660E\u5FEB</option>';
  edictHTML += '<option value="ornate">\u534E\u4E3D\u6587\u85FB</option>';
  edictHTML += '<option value="plain">\u767D\u8BDD\u6587\u8A00</option>';
  edictHTML += '</select>';
  edictHTML += '<button class="ed-polish-btn" onclick="_polishEdicts()">\u6709 \u53F8 \u6DA6 \u8272</button>';
  edictHTML += '</div>';

  // 润色结果区
  edictHTML += '<div id="edict-polished" style="display:none;margin-top:var(--space-3);"></div>';

  // 主角行止
  edictHTML += '<div class="ed-section-divider"><span class="label">\u4E3B \u89D2 \u884C \u6B62</span></div>';
  edictHTML += '<div class="ed-xinglu-card">';
  edictHTML += '<div class="ed-xinglu-hdr">';
  edictHTML += '<span class="title">\u672C \u56DE \u5408 \u884C \u52A8</span>';
  edictHTML += '<span class="desc">\u2014\u2014\u4F60\u8FD9\u6BB5\u65F6\u95F4\u505A\u4E86\u4EC0\u4E48</span>';
  edictHTML += '</div>';
  edictHTML += '<textarea id="xinglu-pub" rows="4" class="edict-input paper-texture" placeholder="\u5982\uFF1A\u53EC\u89C1\u67D0\u81E3\u3001\u6821\u9605\u4E09\u519B\u3001\u5FAE\u670D\u79C1\u8BBF\u3001\u591C\u8BFB\u53F2\u4E66\u3001\u7956\u5E99\u796D\u7940\u3001\u5BB4\u8BF7\u7FA4\u81E3\u2026\u2026"></textarea>';

  // 行止历史
  if (GM.qijuHistory && GM.qijuHistory.length > 1) {
    var _recentXl = GM.qijuHistory.filter(function(q) { return q.xinglu && q.turn < GM.turn; }).slice(-5).reverse();
    if (_recentXl.length > 0) {
      edictHTML += '<details class="ed-xinglu-hist">';
      edictHTML += '<summary>\u8FD1\u671F\u884C\u6B62\u8BB0\u5F55 <span style="color:var(--ink-300);margin-left:6px;font-size:10px;">' + _recentXl.length + ' \u6761</span></summary>';
      edictHTML += '<div style="margin-top:10px;max-height:200px;overflow-y:auto;">';
      _recentXl.forEach(function(q) {
        edictHTML += '<div class="ed-xinglu-hist-item"><span class="turn">T' + q.turn + '</span>' + escHtml(q.xinglu) + '</div>';
      });
      edictHTML += '</div></details>';
    }
  }
  edictHTML += '</div>'; // ed-xinglu-card

  // 帝王私行
  edictHTML += '<div class="ed-tyrant-block">';
  edictHTML += '<div class="ed-tyrant-toggle" onclick="var p=_$(\'tyrant-panel\');if(p){p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.classList.toggle(\'open\');if(p.style.display!==\'none\'&&typeof TyrantActivitySystem!==\'undefined\')TyrantActivitySystem.renderPanel();}">';
  edictHTML += '\u5E1D \u738B \u79C1 \u884C';
  edictHTML += '<span class="sub">\u2014\u2014 \u70B9\u51FB\u5C55\u5F00\uFF08\u540E\u5983\u00B7\u6E38\u730E\u00B7\u4E39\u836F\u00B7\u5BC6\u8BBF\uFF09</span>';
  edictHTML += '</div>';
  edictHTML += '<div id="tyrant-panel" style="display:none;max-height:300px;overflow-y:auto;padding:var(--space-2);margin-top:var(--space-2);"></div>';
  edictHTML += '</div>';
  // 往期诏令档案
  if (GM._edictTracker && GM._edictTracker.length > 0) {
    var _allEdicts = GM._edictTracker.filter(function(e) { return e.turn < GM.turn; });
    if (_allEdicts.length > 0) {
      // 按回合分组
      var _edictByTurn = {};
      _allEdicts.forEach(function(e) { if (!_edictByTurn[e.turn]) _edictByTurn[e.turn] = []; _edictByTurn[e.turn].push(e); });
      var _edictTurns = Object.keys(_edictByTurn).sort(function(a,b){ return b-a; });
      edictHTML += '<details class="ed-archive">';
      edictHTML += '<summary>\u5F80 \u671F \u8BCF \u4EE4 \u6863 \u6848 \u00B7 ' + _allEdicts.length + ' \u6761</summary>';
      edictHTML += '<div style="margin-top:var(--space-2);max-height:400px;overflow-y:auto;">';
      _edictTurns.forEach(function(turn) {
        var edicts = _edictByTurn[turn];
        var _tsText = typeof getTSText === 'function' ? getTSText(parseInt(turn)) : 'T' + turn;
        edictHTML += '<div class="ed-archive-group">';
        edictHTML += '<div class="ed-archive-group-title">\u7B2C' + turn + '\u56DE\u5408 \u00B7 ' + _tsText + '</div>';
        edicts.forEach(function(e) {
          var _sc = e.status === 'completed' ? 'var(--celadon-400)' : e.status === 'obstructed' ? 'var(--vermillion-400)' : e.status === 'partial' ? '#e67e22' : e.status === 'pending_delivery' ? 'var(--amber-400)' : 'var(--ink-300)';
          var _sl = {completed:'\u2705', obstructed:'\u274C', partial:'\u26A0\uFE0F', executing:'\u23F3', pending:'\u2B55', pending_delivery:'\uD83D\uDCE8'}[e.status] || '';
          edictHTML += '<div style="font-size:var(--text-xs);padding:2px 0;border-bottom:1px solid var(--color-border-subtle);">';
          edictHTML += '<span style="color:' + _sc + ';">' + _sl + '</span> ';
          edictHTML += '<span style="color:var(--color-foreground-muted);">' + escHtml(e.category) + '</span> ';
          edictHTML += escHtml(e.content);
          if (e.assignee) edictHTML += ' <span style="color:var(--ink-300);">[\u6267\u884C:' + escHtml(e.assignee) + ']</span>';
          // 远方送达状态
          if (e._remoteTargets && e._remoteTargets.length > 0) {
            var _ltStatuses = (e._letterIds||[]).map(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return null;
              var _name = lt.to || '';
              if (lt.status === 'traveling') return _name + ':信使在途';
              if (lt.status === 'delivered' || lt.status === 'replying') return _name + ':已送达';
              if (lt.status === 'returned') return _name + (lt._isForged ? ':⚠回函(伪)' : ':已送达且回函');
              if (lt.status === 'intercepted') return _name + ':⚠信使失踪';
              if (lt.status === 'intercepted_forging') return _name + ':⚠信使失踪(回函伪造中)';
              if (lt.status === 'recalled') return _name + ':已追回';
              if (lt.status === 'blocked') return _name + ':⚠中书阻挠未下达';
              return _name + ':' + (lt.status||'?');
            }).filter(Boolean);
            if (_ltStatuses.length > 0) {
              edictHTML += '<div style="font-size:0.6rem;color:var(--amber-400);padding-left:1rem;">传书：' + _ltStatuses.join(' | ') + '</div>';
            }
          }
          if (e.feedback) edictHTML += '<div style="color:var(--color-foreground-secondary);padding-left:1rem;">' + escHtml(e.feedback) + '</div>';
          edictHTML += '</div>';
        });
        edictHTML += '</div>';
      });
      edictHTML += '</div></details>';
    }
  }

  // 结束回合按钮
  edictHTML += '<div class="ed-action-bar">';
  edictHTML += '<button class="bt bp" id="btn-end" onclick="confirmEndTurn()" style="padding:var(--space-3) var(--space-8);font-size:var(--text-md);letter-spacing:0.15em;border:2px solid var(--gold-400);box-shadow:0 2px 12px rgba(184,154,83,0.2);">'+_ei('end-turn',16)+' 诏付有司</button>';
  edictHTML += '<button class="bt" title="地形图·山川城池分布（决策辅助）·与【军事·地图总览】数据源不同" onclick="TM.MapSystem.open(\'terrain\')" style="padding:var(--space-3) var(--space-6);font-size:var(--text-md);">'+_ei('map',16)+' 查看地图</button>';
  edictHTML += '</div>';
  edictHTML += '</div>'; // 关闭右侧诏书编辑区
  edictHTML += '</div>'; // 关闭左右并排 flex 容器
  edictHTML += '</div>'; // 关闭 ed-panel-wrap
  edictP.innerHTML = edictHTML;
  gc.appendChild(edictP);

  // 奏疏面板
  var memP=document.createElement("div");memP.className="g-tab-panel";memP.id="gt-memorial";memP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  memP.innerHTML='<div class="mem-panel-wrap"><div class="mem-inner">'
    +'<div class="mem-title"><div class="seal">\u5949<br>\u6731</div><div class="main">\u594F \u758F \u5F85 \u89C8</div><div class="sub">\u6848\u724D\u4E4B\u53F8\u3000\u3000\u767E\u5B98\u542F\u594F</div></div>'
    +'<div id="zouyi-list"></div>'
    +'</div></div>';
  gc.appendChild(memP);

  // 问对面板（仅角色选择网格，点击打开弹窗）
  var wdP=document.createElement("div");wdP.className="g-tab-panel";wdP.id="gt-wendui";wdP.style.cssText="flex:1;overflow-y:auto;padding:0;display:flex;flex-direction:column;";
  wdP.innerHTML='<div class="wdp-panel-wrap"><div class="wdp-inner">'
    +'<div class="wdp-title"><div class="seal">\u53EC\u89C1</div><div class="main">\u5FA1 \u524D \u95EE \u5BF9</div><div class="sub">\u541B\u81E3\u4E4B\u5BF9\u3000\u3000\u9762\u5723\u8BF7\u5BF9</div></div>'
    +'<div id="wendui-chars"></div>'
    +'</div></div>';
  gc.appendChild(wdP);

  // 鸿雁传书面板
  var ltP=document.createElement("div");ltP.className="g-tab-panel";ltP.id="gt-letter";ltP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  ltP.innerHTML='<div class="hy-panel-wrap"><div class="hy-inner">'
    +'<div class="hy-title"><div class="seal">\u9C7C<br>\u96C1</div><div class="main">\u9E3F \u96C1 \u4F20 \u4E66</div><div class="sub">\u7B3A\u672D\u5F80\u6765\u3000\u3000\u9A7F\u4F7F\u4F20\u9012</div></div>'
    +'<div id="letter-route-bar" class="hy-route-warn" style="display:none;"></div>'
    +'<div class="hy-main">'
    +  '<div class="hy-left">'
    +    '<div class="hy-left-header"><span class="hy-left-title">\u8FDC \u65B9 \u81E3 \u5B50</span>'
    +      '<button class="hy-multi-btn" id="lt-multi-toggle" onclick="GM._ltMultiMode=!GM._ltMultiMode;GM._ltMultiTargets=[];renderLetterPanel();">\u7FA4 \u53D1</button>'
    +    '</div>'
    +    '<div id="letter-chars" class="hy-npc-list"></div>'
    +  '</div>'
    +  '<div class="hy-center">'
    +    '<div id="letter-history"></div>'
    +    '<div class="hy-compose-area">'
    +      '<div class="hy-compose-title">\u4E66 \u672D \u62DF \u7A3F<span class="target" id="lt-compose-target">\uFF08\u9009\u62E9\u53D7\u4FE1\u4EBA\uFF09</span></div>'
    +      '<div class="hy-compose-row">'
    +        '<select id="letter-type"><option value="secret_decree">\u5BC6\u65E8</option><option value="military_order">\u5F81\u8C03\u4EE4</option><option value="greeting">\u95EE\u5B89\u51FD</option><option value="personal" selected>\u79C1\u51FD</option><option value="proclamation">\u6A84\u6587</option></select>'
    +        '<select id="letter-urgency"><option value="normal">\u666E\u901A\u9A7F\u9012\uFF08\u65E5\u884C\u4E94\u5341\u91CC\uFF09</option><option value="urgent">\u52A0\u6025\u9A7F\u9012\uFF08\u65E5\u884C\u4E09\u767E\u91CC\uFF09</option><option value="extreme">\u516B\u767E\u91CC\u52A0\u6025</option></select>'
    +      '</div>'
    +      '<div class="hy-compose-row">'
    +        '<select id="letter-cipher"><option value="none">\u4E0D\u52A0\u5BC6</option><option value="yinfu">\u9634\u7B26\uFF08\u6697\u53F7\u4F53\u7CFB\uFF09</option><option value="yinshu">\u9634\u4E66\uFF08\u62C6\u5206\u4E09\u8DEF\uFF09</option><option value="wax_ball">\u8721\u4E38\u5BC6\u51FD</option><option value="silk_sewn">\u5E1B\u4E66\u7F1D\u8863</option></select>'
    +        '<select id="letter-sendmode"><option value="normal">\u666E\u901A\u4FE1\u4F7F</option><option value="multi_courier">\u591A\u8DEF\u4FE1\u4F7F\uFF08\u622A\u83B7\u7387\u964D\u4F4E\uFF09</option><option value="secret_agent">\u5BC6\u4F7F\uFF08\u4E0D\u8D70\u9A7F\u7AD9\uFF09</option></select>'
    +      '</div>'
    +      '<div class="hy-compose-row" id="lt-agent-row" style="display:none;"><label style="font-size:12px;color:var(--color-foreground-muted);align-self:center;">\u5BC6\u4F7F\u4EBA\u9009\uFF1A</label><select id="letter-agent"></select></div>'
    +      '<textarea id="letter-textarea" class="hy-compose-paper" placeholder="\u81F4\u4E66\u8FDC\u65B9\u81E3\u5B50\u2026\u2026" rows="4"></textarea>'
    +      '<div class="hy-compose-bot">'
    +        '<span class="hy-compose-hint">\u203B \u52A0\u5BC6/\u5BC6\u4F7F\u964D\u4F4E\u622A\u83B7\u7387\uFF1B\u516B\u767E\u91CC\u52A0\u6025\u8017\u8D39\u66F4\u591A\u90AE\u8D39</span>'
    +        '<button class="hy-send-btn" onclick="sendLetter()">\u9063 \u4F7F</button>'
    +      '</div>'
    +    '</div>'
    +  '</div>'
    +'</div>'
    +'</div></div>';
  gc.appendChild(ltP);
  // 密使选择器联动
  var _smSel = ltP.querySelector('#letter-sendmode');
  if (_smSel) _smSel.onchange = function() {
    var agRow = _$('lt-agent-row');
    if (this.value === 'secret_agent') {
      if (agRow) agRow.style.display = 'flex';
      var agSel = _$('letter-agent');
      if (agSel) {
        var _cap2 = GM._capital || '京城';
        var _inKy = (GM.chars||[]).filter(function(c){ return c.alive !== false && (!c.location || _isSameLocation(c.location, _cap2)) && !c.isPlayer; });
        agSel.innerHTML = _inKy.map(function(c){ return '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + '（' + escHtml(c.title||'') + '）</option>'; }).join('');
      }
    } else { if (agRow) agRow.style.display = 'none'; }
  };

  // 编年面板
  var bnP=document.createElement("div");bnP.className="g-tab-panel";bnP.id="gt-biannian";bnP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  bnP.innerHTML='<div class="bn-panel-wrap"><div class="bn-inner">'
    +'<div class="bn-title"><div class="seal">\u7F16<br>\u5E74</div><div class="main">\u7F16 \u5E74 \u7EAA \u4E8B</div><div class="sub">\u5929\u3000\u5B50\u3000\u7EAA\u3000\u5E74\u3000\u3000\u3000\u8BF8\u4E8B\u7ECF\u5E74\u7D2F\u8F7D</div></div>'
    +'<div id="bn-active"></div>'
    +'<div class="bn-section-hdr" style="margin-top:16px;"><span class="tag">\u7F16 \u5E74 \u68C0 \u7D22</span><span class="desc">\u2014\u2014 \u6309\u5E74\u4EFD\u00B7\u7C7B\u522B\u00B7\u5173\u952E\u5B57\u8FFD\u6EAF\u5F80\u8FF9</span></div>'
    +'<div class="bn-tools">'
    +'<span class="bn-tools-label">\u67E5\u3000\u9605\uFF1A</span>'
    +'<div class="bn-search-wrap"><input id="bn-search" class="bn-search" placeholder="\u9898\u76EE\u3001\u4EBA\u540D\u3001\u5730\u70B9\u3001\u5173\u952E\u5B57\u2026\u2026" oninput="renderBiannian()"></div>'
    +'<select id="bn-filter" class="bn-filter" onchange="renderBiannian()">'
    +'<option value="all">\u5168\u90E8\u7C7B\u522B</option><option value="\u519B\u4E8B">\u519B\u4E8B</option><option value="\u653F\u6CBB">\u653F\u4E8B</option><option value="\u7ECF\u6D4E">\u7ECF\u6D4E</option><option value="\u5916\u4EA4">\u5916\u4EA4</option><option value="\u6587\u5316">\u6587\u5316</option><option value="\u4EBA\u4E8B">\u4EBA\u4E8B</option><option value="\u707E\u5F02">\u5929\u8C61\u707E\u5F02</option></select>'
    +'<button class="bn-export-btn" onclick="_bnExport()" title="\u5BFC\u51FA\u5168\u90E8\u7F16\u5E74">\u2756 \u5BFC \u51FA</button>'
    +'<span class="bn-tools-stat" id="bn-tools-stat"></span>'
    +'</div>'
    +'<div class="bn-section-hdr"><span class="tag">\u7F16 \u5E74 \u53F2 \u518C</span><span class="desc">\u2014\u2014 \u65E2\u5F80\u4E4B\u4E8B\u00B7\u6C38\u4E45\u5B58\u5F55</span></div>'
    +'<div class="bn-chronicle-wrap"><div id="biannian-list"></div></div>'
    +'</div></div>';
  gc.appendChild(bnP);

  // 官制面板
  var offP=document.createElement("div");offP.className="g-tab-panel";offP.id="gt-office";offP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  offP.innerHTML='<div class="og-panel-wrap"><div class="og-inner">'
    +'<div class="og-title"><div class="seal">\u5B98<br>\u5236</div><div class="main">\u516D \u90E8 \u537F \u5BFA</div><div class="sub">\u8862\u3000\u95E8\u3000\u804C\u3000\u5B98\u3000\u3000\u3000\u3000\u73ED\u3000\u4F4D\u3000\u5404\u3000\u53F8\u3000\u5176\u3000\u804C</div></div>'

    // 总览区
    +'<div class="og-section-hdr">'
    +'<span class="tag">\u8862 \u95E8 \u603B \u89C8</span>'
    +'<span class="desc">\u2014\u2014 \u7F16\u5236\u00B7\u6743\u529B\u683C\u5C40\u00B7\u4FF8\u7984\u5F00\u652F</span>'
    +'<span class="act">'
    +'<button class="og-hdr-btn" onclick="_offReformToEdict(\'add_dept\',\'\')">\u589E \u8BBE \u90E8 \u95E8</button>'
    +'<button class="og-hdr-btn primary" onclick="if(typeof _offOpenZhongtui===\'function\')_offOpenZhongtui();else toast(\'\u8350\u8D24\u5EF7\u63A8\u9700\u5148\u9009\u4E2D\u804C\u4F4D\')">\u8350 \u8D24 \u5EF7 \u63A8</button>'
    +'</span>'
    +'</div>'

    // 预警 + 摘要
    +'<div id="office-alerts" class="og-alerts"></div>'
    +'<div id="office-summary" class="og-summary-grid"></div>'

    // 树
    +'<div class="og-section-hdr">'
    +'<span class="tag">\u8862 \u95E8 \u5C42 \u7EA7</span>'
    +'<span class="desc">\u2014\u2014 \u9F20\u8F6E\u7F29\u653E\u00B7\u62D6\u62FD\u5E73\u79FB\u00B7\u70B9\u51FB\u5361\u7247\u5C55\u5F00\u8BE6\u60C5</span>'
    +'</div>'
    +'<div class="og-tree-topbar">'
    +'<span class="title-bar">\u56FE \u4F8B</span>'
    +'<span style="font-size:11px;color:var(--ink-300);letter-spacing:0.05em;display:inline-flex;align-items:center;gap:8px;">'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:#e4c579;border-radius:1px;"></span>\u6B63\u4E00\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--gold-400);border-radius:1px;"></span>\u4E8C\u4E09\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--celadon-400);border-radius:1px;"></span>\u56DB\u4E94\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--ink-500);border-radius:1px;"></span>\u516D\u54C1\u4EE5\u4E0B</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--amber-400);"></span>\u4E45\u4EFB</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--vermillion-400);"></span>\u4E0D\u6EE1\u00B7\u7F3A\u5458</span>'
    +'</span>'
    +'</div>'
    +'<div id="office-tree"></div>'
    +'</div></div>';
  gc.appendChild(offP);

  // 文苑面板（文事作品库）
  var wyP=document.createElement("div");wyP.className="g-tab-panel";wyP.id="gt-wenyuan";wyP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  wyP.innerHTML='<div class="wy-panel-wrap"><div class="wy-inner">'
    +'<div class="wy-title"><div class="seal">\u6587<br>\u82D1</div><div class="main">\u6587 \u82D1 \u00B7 \u8BD7 \u6587 \u603B \u96C6</div><div class="sub">\u8BD7 \u8BCD \u6B4C \u8D4B\u3000\u3000\u5E8F \u8DCB \u8BB0 \u94ED\u3000\u3000\u7ECF \u4E16 \u98CE \u96C5</div></div>'
    +'<div id="wy-statbar" class="wy-statbar"></div>'
    +'<div class="wy-tools">'
    +'<span class="wy-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="wy-search-wrap"><input id="wy-search" class="wy-search" placeholder="\u641C\u7D22\u4F5C\u8005\u00B7\u6807\u9898\u00B7\u8BD7\u6587\u2026" oninput="renderWenyuan()"></div>'
    +'<select id="wy-cat-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">\u5168\u90E8\u89E6\u53D1</option><option value="career">\u79D1\u4E3E\u5B98\u9014</option><option value="adversity">\u9006\u5883\u8D2C\u8C2A</option><option value="social">\u793E\u4EA4\u916C\u9154</option><option value="duty">\u4EFB\u4E0A\u65BD\u653F</option><option value="travel">\u6E38\u5386\u5C71\u6C34</option><option value="private">\u5BB6\u4E8B\u79C1\u60C5</option><option value="times">\u65F6\u5C40\u5929\u4E0B</option><option value="mood">\u60C5\u611F\u5FC3\u5883</option></select>'
    +'<select id="wy-genre-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">\u5168\u90E8\u6587\u4F53</option><option value="shi">\u8BD7</option><option value="ci">\u8BCD</option><option value="fu">\u8D4B</option><option value="qu">\u66F2</option><option value="ge">\u6B4C\u884C</option><option value="wen">\u6563\u6587</option><option value="apply">\u5E94\u7528\u6587</option><option value="ji">\u8BB0\u53D9\u6587</option><option value="ritual">\u796D\u6587\u7891\u94ED</option><option value="paratext">\u5E8F\u8DCB</option></select>'
    +'<select id="wy-sort" class="wy-filter" onchange="renderWenyuan()"><option value="recent">\u6392\uFF1A\u8FD1\u4F5C</option><option value="quality">\u6392\uFF1A\u54C1\u8BC4</option><option value="author">\u6392\uFF1A\u4F5C\u8005</option><option value="date">\u6392\uFF1A\u5E74\u4EE3</option></select>'
    +'<label class="wy-chk"><input type="checkbox" id="wy-preserved-only" onchange="renderWenyuan()">\u4EC5\u4F20\u4E16</label>'
    +'<label class="wy-chk"><input type="checkbox" id="wy-hide-forbidden" onchange="renderWenyuan()">\u9690\u67E5\u7981</label>'
    +'</div>'
    +'<div id="wy-legend" class="wy-legend"></div>'
    +'<div id="wenyuan-list" class="wy-grid"></div>'
    +'</div></div>';
  gc.appendChild(wyP);

  // 起居注面板
  var qjP=document.createElement("div");qjP.className="g-tab-panel";qjP.id="gt-qiju";qjP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  qjP.innerHTML='<div class="qj-panel-wrap"><div class="qj-inner">'
    +'<div class="qj-title"><div class="seal">\u8D77<br>\u5C45<br>\u6CE8</div><div class="main">\u8D77\u3000\u5C45\u3000\u6CE8</div><div class="sub">\u4E00 \u65E5 \u4E00 \u5F55\u3000\u3000\u8D77 \u5C45 \u996E \u98DF \u8A00 \u52A8 \u5FC5 \u4E66\u3000\u3000\u85CF \u4E4B \u91D1 \u532E \u77F3 \u5BA4</div></div>'
    +'<div id="qj-statbar" class="qj-statbar"></div>'
    +'<div class="qj-tools">'
    +'<span class="qj-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="qj-search-wrap"><input id="qj-search" class="qj-search" placeholder="\u641C\u7D22\u8D77\u5C45\u6CE8\u00B7\u65E5\u671F\u00B7\u4EBA\u540D\u2026" oninput="_qijuKw=this.value;_qijuPage=0;renderQiju()"></div>'
    +'<select id="qj-cat-filter" class="qj-filter" onchange="_qijuCat=this.value;_qijuPage=0;renderQiju()">'
    +'<option value="all">\u5168\u90E8\u7C7B\u522B</option><option value="\u8BCF\u4EE4">\u8BCF\u4EE4</option><option value="\u594F\u758F">\u594F\u758F</option><option value="\u671D\u8BAE">\u671D\u8BAE</option><option value="\u9E3F\u96C1">\u9E3F\u96C1</option><option value="\u4EBA\u4E8B">\u4EBA\u4E8B</option><option value="\u884C\u6B62">\u884C\u6B62</option><option value="\u53D9\u4E8B">\u53D9\u4E8B</option></select>'
    +'<select id="qj-sort" class="qj-filter" onchange="_qijuSort=this.value;_qijuPage=0;renderQiju()"><option value="recent">\u6392\uFF1A\u8FD1\u65E5 \u2193</option><option value="old">\u6392\uFF1A\u65E7\u65E5 \u2191</option><option value="annot">\u6392\uFF1A\u5FA1\u6279\u5148</option></select>'
    +'<label class="qj-chk"><input type="checkbox" id="qj-annot-only" onchange="_qijuAnnotOnly=this.checked;_qijuPage=0;renderQiju()">\u4EC5\u5FA1\u6279</label>'
    +'<label class="qj-chk"><input type="checkbox" id="qj-collapse-narr" onchange="_qijuCollapseNarr=this.checked;renderQiju()">\u6298\u53E0\u53D9\u4E8B</label>'
    +'<button class="qj-export" onclick="_qijuExport()">\u5BFC \u51FA \u7F16 \u5E74</button>'
    +'</div>'
    +'<div id="qj-legend" class="qj-legend"></div>'
    +'<div id="qiju-history"></div>'
    +'</div></div>';
  gc.appendChild(qjP);

  // 纪事面板
  var jsP=document.createElement("div");jsP.className="g-tab-panel";jsP.id="gt-jishi";jsP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  jsP.innerHTML='<div class="ji-panel-wrap"><div class="ji-inner">'
    +'<div class="ji-title"><div class="seal">\u7EAA<br>\u4E8B</div><div class="main">\u7EAA \u4E8B \u672C \u672B</div><div class="sub">\u4EE5 \u4E8B \u7CFB \u65E5\u3000\u3000\u4EE5 \u65E5 \u7CFB \u6708\u3000\u3000\u4EE5 \u6708 \u7CFB \u65F6\u3000\u3000\u4EE5 \u65F6 \u7CFB \u5E74</div></div>'
    +'<div id="jishi-statbar" class="ji-statbar"></div>'
    +'<div class="ji-tools">'
    +'<span class="ji-tools-lbl">\u62AB\u3000\u89C8</span>'
    +'<div class="ji-view-switch">'
    +'<button class="ji-view-btn active" id="js-view-time" onclick="_jishiView=\'time\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u65F6 \u95F4 \u7EBF</button>'
    +'<button class="ji-view-btn" id="js-view-char" onclick="_jishiView=\'char\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u6309 \u4EBA \u7269</button>'
    +'<button class="ji-view-btn" id="js-view-type" onclick="_jishiView=\'type\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u6309 \u4E8B \u7C7B</button>'
    +'</div>'
    +'<div class="ji-search-wrap"><input id="jishi-kw" class="ji-search" placeholder="\u641C\u7D22\u8BAE\u9898\u00B7\u4EBA\u7269\u00B7\u5BF9\u8BDD\u2026\u2026" oninput="_jishiKw=this.value;_jishiPage=0;renderJishi();"></div>'
    +'<select id="jishi-char-filter" class="ji-filter" onchange="_jishiCharFilter=this.value;_jishiPage=0;renderJishi();"><option value="all">\u5168\u90E8\u4EBA\u7269</option></select>'
    +'<button class="ji-star-btn" onclick="_jishiToggleStarred()" id="js-star-toggle" title="\u4EC5\u770B\u661F\u6807">\u2606</button>'
    +'<button class="ji-export-btn" onclick="_jishiExport()" title="\u5BFC\u51FA\u7EB5\u7EAA\u5B8C\u6574\u8BB0\u5F55">\u5BFC \u51FA</button>'
    +'</div>'
    +'<div id="jishi-legend" class="ji-legend"></div>'
    +'<div id="jishi-list"></div>'
    +'</div></div>';
  gc.appendChild(jsP);

  // 史记面板
  var sjP=document.createElement("div");sjP.className="g-tab-panel";sjP.id="gt-shiji";sjP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  sjP.innerHTML='<div class="sj-panel-wrap"><div class="sj-inner">'
    +'<div class="sj-title"><div class="seal">\u53F2<br>\u8BB0</div><div class="main">\u53F2 \u8BB0 \u672C \u7EAA</div><div class="sub">\u7A76 \u5929 \u4EBA \u4E4B \u9645\u3000\u901A \u53E4 \u4ECA \u4E4B \u53D8\u3000\u6210 \u4E00 \u5BB6 \u4E4B \u8A00</div></div>'
    +'<div id="shiji-list"></div>'
    +'</div></div>';
  gc.appendChild(sjP);

  // 科技树面板（条件显示）
  if(P.systems && P.systems.techTree!==false){
    var _techBtn=document.createElement("button");_techBtn.className="g-tab-btn";_techBtn.innerHTML=_ti('scroll',13)+' \u79D1\u6280';
    _techBtn.onclick=function(){switchGTab(_techBtn,"gt-tech");};tabBar.appendChild(_techBtn);
    var _techP=document.createElement("div");_techP.className="g-tab-panel";_techP.id="gt-tech";_techP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
    _techP.innerHTML='<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u79D1\u6280</div><div id="g-tech"></div>';
    gc.appendChild(_techP);
  }
  // 市政树面板（条件显示）
  if(P.systems && P.systems.civicTree!==false){
    var _civicBtn=document.createElement("button");_civicBtn.className="g-tab-btn";_civicBtn.innerHTML=_ti('office',13)+' \u5E02\u653F';
    _civicBtn.onclick=function(){switchGTab(_civicBtn,"gt-civic");};tabBar.appendChild(_civicBtn);
    var _civicP=document.createElement("div");_civicP.className="g-tab-panel";_civicP.id="gt-civic";_civicP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
    _civicP.innerHTML='<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u5E02\u653F</div><div id="g-civic"></div>';
    gc.appendChild(_civicP);
  }
  // 人物志面板
  var _rwBtn=document.createElement("button");_rwBtn.className="g-tab-btn";_rwBtn.innerHTML=_ti('person',13)+' \u4EBA\u7269\u5FD7';
  _rwBtn.onclick=function(){switchGTab(_rwBtn,"gt-renwu");};tabBar.appendChild(_rwBtn);
  var _rwP=document.createElement("div");_rwP.className="g-tab-panel";_rwP.id="gt-renwu";_rwP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  _rwP.innerHTML='<div class="rw-panel-wrap"><div class="rw-inner">'
    +'<div class="rw-title"><div class="seal">\u4EBA<br>\u7269</div><div class="main">\u4EBA \u7269 \u5FD7</div><div class="sub">\u82F1 \u6770 \u5217 \u4F20\u3000\u3000\u81E7 \u5426 \u54C1 \u8BC4</div></div>'
    +'<div id="rw-statbar" class="rw-statbar"></div>'
    +'<div class="rw-tools">'
    +'<button class="bt bp" onclick="(window.TM&&TM.ceming&&TM.ceming.openDialog)?TM.ceming.openDialog():(typeof toast===\'function\'&&toast(\'策名未就绪\'))" style="padding:5px 12px;font-size:12px;margin-right:6px;" title="策名·将历史人物纳入人物志">策　名</button>'
    +'<span class="rw-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="rw-search-wrap"><input id="rw-search" class="rw-search" placeholder="\u641C\u7D22\u59D3\u540D\u00B7\u5B57\u53F7\u00B7\u5B98\u804C\u2026" oninput="_rwSearch=this.value;renderRenwu();"></div>'
    +'<select id="rw-faction" class="rw-filter" onchange="_rwFaction=this.value;renderRenwu();"><option value="all">\u5168\u90E8\u6D3E\u7CFB</option></select>'
    +'<select id="rw-role" class="rw-filter" onchange="_rwRole=this.value;renderRenwu();"><option value="all">\u5168\u90E8\u8EAB\u4EFD</option><option value="civil">\u6587\u81E3</option><option value="military">\u6B66\u5C06</option><option value="harem">\u540E\u5BAB</option><option value="none">\u5E03\u8863</option></select>'
    +'<select id="rw-sort" class="rw-filter" onchange="_rwSort=this.value;renderRenwu();"><option value="loyalty">\u6392\uFF1A\u5FE0\u8BDA</option><option value="intelligence">\u6392\uFF1A\u667A\u529B</option><option value="administration">\u6392\uFF1A\u653F\u52A1</option><option value="military">\u6392\uFF1A\u519B\u4E8B</option><option value="ambition">\u6392\uFF1A\u91CE\u5FC3</option></select>'
    +'<label class="rw-chk"><input type="checkbox" id="rw-dead" onchange="_rwShowDead=this.checked;renderRenwu();">\u663E \u5DF2 \u6B81</label>'
    +'</div>'
    +'<div id="rw-legend" class="rw-legend"></div>'
    +'<div id="rw-grid" class="rw-grid"></div>'
    +'</div></div>';
  gc.appendChild(_rwP);

  // P3: 省份民情面板（地方舆情）
  if (P.adminHierarchy) {
    var _dfBtn=document.createElement("button");_dfBtn.className="g-tab-btn";_dfBtn.innerHTML=_ti('faction',13)+' \u5730\u65B9';
    _dfBtn.onclick=function(){switchGTab(_dfBtn,"gt-difang");_renderDifangPanel();};tabBar.appendChild(_dfBtn);
    var _dfP=document.createElement("div");_dfP.className="g-tab-panel";_dfP.id="gt-difang";_dfP.style.cssText="flex:1;overflow-y:auto;padding:0;";
    _dfP.innerHTML='<div class="df-panel-wrap"><div class="df-inner">'
      +'<div class="df-title"><div class="seal">\u5730<br>\u65B9</div><div class="main">\u5730 \u65B9 \u8206 \u60C5</div><div class="sub">\u4E00 \u7701 \u4E00 \u6C11 \u60C5\u3000\u3000\u6309 \u5BDF \u629A \u6C11 \u00B7 \u5B89 \u6C11 \u4E3A \u672C</div></div>'
      +'<div id="df-statbar" class="df-statbar"></div>'
      +'<div class="df-tools">'
      +'<span class="df-tools-lbl">\u6309 \u5BDF</span>'
      +'<div class="df-search-wrap"><input id="df-search" class="df-search" placeholder="\u641C\u7D22\u5730\u540D\u00B7\u5B98\u540D\u00B7\u4E8B\u7531\u2026\u2026" oninput="_dfSearch=this.value;_renderDifangPanel();"></div>'
      +'<select id="df-sort" class="df-filter" onchange="_dfSort=this.value;_renderDifangPanel();"><option value="name">\u6392\uFF1A\u540D\u79F0</option><option value="unrest">\u6392\uFF1A\u6C11\u53D8 \u2191</option><option value="corruption">\u6392\uFF1A\u8150\u8D25 \u2191</option><option value="population">\u6392\uFF1A\u4EBA\u53E3 \u2193</option><option value="tax">\u6392\uFF1A\u7A0E\u6536 \u2193</option></select>'
      +'<label class="df-chk"><input type="checkbox" id="df-crisis" onchange="_dfCrisis=this.checked;_renderDifangPanel();">\u26A0 \u4EC5 \u5371 \u673A</label>'
      +'<button class="df-export" onclick="if(typeof openProvinceEconomy===\'function\')openProvinceEconomy();">\u8BE6 \u7EC6 \u533A \u5212</button>'
      +'</div>'
      +'<div id="df-legend" class="df-legend"></div>'
      +'<div id="df-alerts" class="df-alerts" style="display:none;"></div>'
      +'<div id="difang-grid" class="df-grid"></div>'
      +'</div></div>';
    gc.appendChild(_dfP);
  }

  // 右侧面板——增强角色卡片
  var gr=_$("gr");if(gr){
    var _charList = (GM.chars || []).filter(function(c){return c.alive!==false;});
    // 7.3: 角色列表分页——超过30人时先显示前30，可展开全部
    var _charPageLimit = 30;
    var _charShowAll = gr._showAllChars || false;
    var _charDisplayList = (!_charShowAll && _charList.length > _charPageLimit) ? _charList.slice(0, _charPageLimit) : _charList;
    gr.innerHTML="<div class=\"pt\" style=\"display:flex;align-items:center;gap:4px;\">"+tmIcon('person',12)+" \u4EBA\u7269 <span style=\"font-size:var(--text-xs);color:var(--color-foreground-muted);font-weight:400;margin-left:auto;\">"+_charList.length+"\u4EBA</span></div>"+
      _charDisplayList.map(function(ch){
        var loy=ch.loyalty||50;
        var loyColor=loy>70?"var(--green)":loy<30?"var(--red)":"var(--gold)";
        var loyDisp = (typeof _fmtNum1==='function') ? _fmtNum1(loy) : loy;
        var stressTag='';
        if(ch.stress&&ch.stress>40){
          stressTag=' <span style="font-size:0.62rem;padding:1px 4px;border-radius:3px;background:'+(ch.stress>60?'rgba(192,57,43,0.2)':'rgba(230,126,34,0.15)')+';color:'+(ch.stress>60?'var(--red)':'#e67e22')+';">'+(ch.stress>60?'\u5D29':'\u7126')+'</span>';
        }
        // 心情标记（中国古典方括号）
        var moodIcon='';
        if(ch._mood&&ch._mood!=='\u5E73'){
          var _moodColors={'\u559C':'var(--color-success)','\u6012':'var(--vermillion-400)','\u5FE7':'#e67e22','\u60E7':'var(--indigo-400)','\u6068':'var(--vermillion-400)','\u656C':'var(--celadon-400)'};
          moodIcon='<span style="font-size:0.6rem;color:'+(_moodColors[ch._mood]||'var(--txt-d)')+';">\u3014'+ch._mood+'\u3015</span> ';
        }
        // 野心标记
        var ambTag=(ch.ambition||50)>75?'<span style="font-size:0.58rem;color:var(--purple,#9b59b6);">\u91CE</span>':'';
        // 后宫/配偶标记
        var spouseTag='';
        if(ch.spouse){
          var _spIc = typeof getHaremRankIcon === 'function' ? getHaremRankIcon(ch.spouseRank) : '\u{1F490}';
          spouseTag=' <span style="font-size:0.62rem;color:#e84393;">'+_spIc+'</span>';
        }
        var factionTag=ch.faction?'<span style="font-size:0.62rem;color:var(--txt-d);">'+ch.faction+'</span>':'';
        // 立场/党派/学识标签
        var stancePartyTag='';
        if(ch.stance&&ch.stance!=='中立') stancePartyTag+='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';color:'+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';margin-right:2px;">'+ch.stance+'</span>';
        if(ch.party) stancePartyTag+='<span style="font-size:0.55rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;margin-right:2px;">'+escHtml(ch.party)+'</span>';
        var officeLine=ch.title?'<span style="font-size:0.7rem;color:var(--txt-d);">'+ch.title+'</span>':'';
        var ageTag=ch.age?'<span style="font-size:0.62rem;color:var(--txt-d);">'+ch.age+'\u5C81</span>':'';
        var _cap=GM._capital||'京城';
        var locTag='';
        if(ch._travelTo){
          var _rd5=(typeof ch._travelRemainingDays==='number'&&ch._travelRemainingDays>0)?ch._travelRemainingDays:0;
          locTag='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.18);color:var(--gold-400);margin-left:2px;" title="\u5728\u9014">'+escHtml(ch._travelFrom||ch.location||'')+'\u2192'+escHtml(ch._travelTo)+(_rd5?'\u00B7'+_rd5+'\u65E5':'')+'</span>';
        } else if(ch.location&&!_isSameLocation(ch.location,_cap)) locTag='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.1);color:var(--gold-400);margin-left:2px;">'+ch.location+'</span>';
        // 性格特质缩写
        var traitBrief='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitBrief=ch.traitIds.slice(0,2).map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;});return d?d.name:'';}).filter(Boolean).join('\u00B7');
          if(traitBrief) traitBrief='<span style="font-size:0.58rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;">'+traitBrief+'</span>';
        }
        // 目标+满足度
        var goalBrief='';
        if(ch.personalGoal) {
          var _gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : '';
          var _gsatColor = _gsat >= 60 ? 'var(--celadon-400)' : _gsat >= 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
          goalBrief='<div style="font-size:0.6rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">\u5FD7\uFF1A'+escHtml(ch.personalGoal);
          if(_gsat !== '') goalBrief += ' <span style="color:'+_gsatColor+';">'+_gsat+'%</span>';
          goalBrief += '</div>';
        }
        // 恩怨摘要（简短）
        var eyBrief='';
        if(typeof EnYuanSystem!=='undefined'){var _eyt2=EnYuanSystem.getTextForChar(ch.name);if(_eyt2)eyBrief='<div style="font-size:0.55rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">'+_eyt2+'</div>';}
        // 五常/气质/面子（新增增强）
        var wcLine='';
        if(typeof calculateWuchang==='function'){
          var _wc=calculateWuchang(ch);
          wcLine='<div style="font-size:0.6rem;color:var(--celadon-400);margin-top:0.15rem;letter-spacing:0.03em;">仁'+_wc.仁+' 义'+_wc.义+' 礼'+_wc.礼+' 智'+_wc.智+' 信'+_wc.信+' <span style="color:var(--gold-400);">'+_wc.气质+'</span></div>';
        }
        var faceLine='';
        if(typeof FaceSystem!=='undefined'&&ch._face!==undefined){
          var _fv=FaceSystem.getFace(ch);
          var _fc=_fv>=60?'var(--color-foreground-muted)':_fv>=40?'#e67e22':'var(--vermillion-400)';
          faceLine=_fv<60?' <span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+_fc+';color:'+_fc+';">'+(_fv<20?'奇耻':_fv<40?'颜面尽失':'面子低落')+'</span>':'';
        }
        // 特质色彩编码（增强）
        var traitTags='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitTags=ch.traitIds.slice(0,3).map(function(tid){
            var d=P.traitDefinitions.find(function(t){return t.id===tid;});
            if(!d)return '';
            var _tc=(d.dims&&d.dims.boldness>0.2)?'var(--vermillion-400)':(d.dims&&d.dims.compassion>0.2)?'var(--celadon-400)':(d.dims&&d.dims.rationality>0.2)?'var(--indigo-400)':'var(--gold-400)';
            return '<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+_tc+';color:'+_tc+';margin-right:2px;">'+d.name+'</span>';
          }).filter(Boolean).join('');
        }
        var _portraitThumb = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;margin-right:6px;">' : '';
        return "<div class=\"cd\" style=\"padding:0.5rem 0.6rem;margin-bottom:0.35rem;cursor:pointer;border-left:3px solid var(--gold-500);\" onclick=\"openCharDetail('"+ch.name.replace(/'/g,"\\'")+"')\">"
          +"<div style=\"display:flex;align-items:center;\">"+_portraitThumb
          +"<div style=\"flex:1;\"><div style=\"display:flex;justify-content:space-between;align-items:center;\">"
          +"<strong style=\"font-size:0.85rem;\">"+moodIcon+ch.name+locTag+spouseTag+faceLine+"</strong>"
          +"<span style=\"font-size:0.68rem;\">"+ageTag+" <span class=\"stat-number\" style=\"color:"+loyColor+";\">忠"+loyDisp+"</span>"+ambTag+stressTag+"</span>"
          +"</div>"
          +"<div style=\"display:flex;justify-content:space-between;align-items:center;margin-top:0.1rem;\">"+officeLine+"<span>"+factionTag+"</span></div>"
          +(stancePartyTag?'<div style="margin-top:0.1rem;">'+stancePartyTag+'</div>':'')
          +wcLine
          +"<div style=\"margin-top:0.1rem;\">"+traitTags+"</div>"
          +goalBrief
          +eyBrief
          +"</div></div></div>";
      }).join("")||"<div style=\"color:var(--txt-d);font-size:0.78rem;\">\u65E0</div>";
    // 7.3: 超过分页限制时添加"显示全部"按钮
    if (!_charShowAll && _charList.length > _charPageLimit) {
      gr.innerHTML += '<div style="text-align:center;padding:0.3rem;"><button class="bt bs bsm" onclick="_$(\'gr\')._showAllChars=true;renderGameState();">\u663E\u793A\u5168\u90E8' + _charList.length + '\u4EBA</button></div>';
    }
  }

  // 渲染子组件
  renderWenduiChars();renderMemorials();renderBiannian();renderOfficeTree();renderShijiList();renderJishi();
  // 地方舆情每回合同步刷新（接新 adminHierarchy 深化字段）
  if (typeof _renderDifangPanel === 'function' && P.adminHierarchy) {
    try { _renderDifangPanel(); } catch(_dfRefE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dfRefE, 'difang refresh') : console.warn('[difang refresh]', _dfRefE); }
  }
  if(typeof renderGameTech==='function')renderGameTech();
  if(typeof renderGameCivic==='function')renderGameCivic();
  if(typeof renderRenwu==='function')renderRenwu();
  if(typeof renderSidePanels==='function')renderSidePanels();
  // 触发钩子，各模块在此追加徽章/地图等
  GameHooks.run('renderGameState:after');
  // 2.8: 动态元素无障碍增强
  if (typeof _applyA11y === 'function') _applyA11y();
}

// ── 建议库动态渲染 ──
// 纳入诏书的下拉菜单——以 body 级 fixed 定位呈现，避免被侧栏 overflow 裁切
function _showEdictAdoptMenu(evt, realIdx) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  // 移除旧菜单
  var _old = document.getElementById('_edictAdoptMenu'); if (_old) _old.remove();
  var _btn = evt && evt.currentTarget ? evt.currentTarget : (evt && evt.target);
  if (!_btn) return;
  var rect = _btn.getBoundingClientRect();
  var cats = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var menu = document.createElement('div');
  menu.id = '_edictAdoptMenu';
  // 计算位置——优先向下；若下方空间不足则向上
  var menuH = cats.length * 28 + 6;
  var vh = window.innerHeight;
  var top = rect.bottom + 4;
  if (top + menuH > vh - 10) top = Math.max(10, rect.top - menuH - 4);
  menu.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + top + 'px;z-index:9999;background:var(--color-elevated,#1a1a2e);border:1px solid var(--color-border-subtle,#444);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:90px;padding:3px 0;';
  cats.forEach(function(cat) {
    var item = document.createElement('div');
    item.textContent = cat.label;
    item.style.cssText = 'padding:5px 12px;font-size:0.8rem;cursor:pointer;color:' + cat.color + ';transition:background 0.12s;';
    item.onmouseover = function() { this.style.background = 'var(--color-surface,rgba(255,255,255,0.06))'; };
    item.onmouseout = function() { this.style.background = ''; };
    item.onclick = function(ev) {
      ev.stopPropagation();
      var sg = GM._edictSuggestions && GM._edictSuggestions[realIdx];
      if (sg) {
        var ta = _$(cat.id);
        if (ta) {
          // 纳入时保留问题背景：先写 topic，再写 content
          var prefix = '';
          if (sg.topic) prefix += '〔' + sg.topic + '〕';
          if (sg.from) prefix += '（' + sg.from + '言）';
          var block = (prefix ? prefix + '\n' : '') + sg.content;
          ta.value += (ta.value ? '\n\n' : '') + block;
        }
        if (typeof toast === 'function') toast('\u5DF2\u7EB3\u5165' + cat.label + (sg.topic?'（含问题背景）':''));
      }
      menu.remove();
      document.removeEventListener('click', _closeEdictMenu);
    };
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  // 点击外部关闭
  setTimeout(function() { document.addEventListener('click', _closeEdictMenu); }, 0);
}
function _closeEdictMenu(e) {
  var m = document.getElementById('_edictAdoptMenu');
  if (m && !m.contains(e.target)) {
    m.remove();
    document.removeEventListener('click', _closeEdictMenu);
  }
}

function _renderEdictSuggestions() {
  var container = _$('edict-sug-sidebar');
  if (!container) return;
  var _edictCatIds = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var _unused = (GM._edictSuggestions || []).filter(function(s) { return !s.used; });
  // 按回合倒序（本回合最上·以往回合依次下排·同回合按原入库顺序）
  _unused.sort(function(a, b) {
    var ta = a.turn || 0, tb = b.turn || 0;
    if (tb !== ta) return tb - ta;
    // 同回合：保持插入顺序·取原数组索引
    return (GM._edictSuggestions || []).indexOf(a) - (GM._edictSuggestions || []).indexOf(b);
  });
  // 按来源映射 src 类
  var _srcClsMap = {
    '\u671D\u8BAE': 'ed-src-chaoyi',
    '\u95EE\u5BF9': 'ed-src-wendui',
    '\u9E3F\u96C1': 'ed-src-letter',
    '\u594F\u758F': 'ed-src-memorial',
    '\u5B98\u5236': 'ed-src-office',
    '\u5730\u65B9': 'ed-src-local',
    '\u72EC\u53EC': 'ed-src-wendui',
    '\u72EC\u53EC\u00B7\u5212\u9009': 'ed-src-wendui',
    '\u72EC\u53EC\u00B7\u5EFA\u8A00\u8981\u70B9': 'ed-src-wendui'
  };
  var html = '';
  if (_unused.length === 0) {
    html += '<div style="font-size:11.5px;color:var(--color-foreground-muted);line-height:1.7;padding:12px 10px;text-align:center;font-family:var(--font-serif);font-style:italic;">\u8BF8\u4E8B\u6682\u5B81\u3002\u53EC\u5F00\u300C\u671D\u8BAE\u300D\u6216\u300C\u95EE\u5BF9\u300D\uFF0C\u5176\u8FDB\u8A00\u5C06\u6536\u5165\u6B64\u5904\u3002</div>';
  } else {
    var _curTurn = (GM.turn || 1);
    var _lastTurnHeader = null;
    _unused.forEach(function(s) {
      var _realIdx = (GM._edictSuggestions || []).indexOf(s);
      var _srcCls = _srcClsMap[s.source] || 'ed-src-default';
      var _srcLine = '\u3010' + escHtml(s.source || '?') + (s.from ? '\u00B7' + escHtml(s.from) : '') + '\u3011';
      // 插入回合分组 header
      var _sTurn = s.turn || 0;
      if (_sTurn !== _lastTurnHeader) {
        _lastTurnHeader = _sTurn;
        var _turnLabel;
        if (_sTurn === _curTurn) _turnLabel = '\u672C\u56DE\u5408';
        else if (_sTurn === _curTurn - 1) _turnLabel = '\u4E0A\u56DE\u5408';
        else if (_sTurn > 0) _turnLabel = '\u7B2C ' + _sTurn + ' \u56DE\u5408';
        else _turnLabel = '\u5F80\u65E5';
        var _dateStr = (typeof getTSText === 'function' && _sTurn > 0) ? getTSText(_sTurn) : '';
        html += '<div style="font-size:10.5px;color:var(--gold,#c9a84c);letter-spacing:0.3em;padding:6px 8px 3px;border-bottom:1px dashed rgba(201,168,76,0.2);margin-top:4px;font-family:var(--font-serif);">\u00B7 ' + _turnLabel + (_dateStr ? ' \u00B7 ' + escHtml(_dateStr) : '') + ' \u00B7</div>';
      }
      html += '<div class="ed-sug-item ' + _srcCls + '" onclick="_showEdictAdoptMenu(event,' + _realIdx + ')">';
      html += '<div class="src">' + _srcLine + '</div>';
      if (s.topic) html += '<div class="topic">\u3014' + escHtml(s.topic) + '\u3015</div>';
      html += '<div class="txt">' + escHtml(s.content) + '</div>';
      html += '<span class="act">\u6458\u5165</span>';
      html += '<button class="del" onclick="event.stopPropagation();GM._edictSuggestions[' + _realIdx + '].used=true;_renderEdictSuggestions();" title="\u5220\u9664">\u2715</button>';
      html += '</div>';
    });
  }
  container.innerHTML = html;
}

// ── 有司润色：将各类诏令合并为正式诏书 ──
async function _polishEdicts() {
  var cats = [
    { id: 'edict-pol', label: '\u653F\u4EE4' },
    { id: 'edict-mil', label: '\u519B\u4EE4' },
    { id: 'edict-dip', label: '\u5916\u4EA4' },
    { id: 'edict-eco', label: '\u7ECF\u6D4E' },
    { id: 'edict-oth', label: '\u5176\u4ED6' }
  ];
  var parts = [];
  cats.forEach(function(cat) {
    var el = _$(cat.id);
    var val = el ? el.value.trim() : '';
    if (val) parts.push({ label: cat.label, content: val });
  });
  if (parts.length === 0) { toast('\u8BF7\u5148\u5728\u5404\u7C7B\u8BCF\u4EE4\u4E2D\u586B\u5199\u5185\u5BB9'); return; }

  var panel = _$('edict-polished');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);padding:var(--space-4);">\u6709\u53F8\u6B63\u5728\u6DA6\u8272\u8BCF\u4E66\u2026\u2026</div>';

  // 读取风格选择
  var styleEl = _$('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleDesc = {
    elegant: '\u5178\u96C5\u5E84\u91CD\u7684\u6587\u8A00\uFF0C\u5584\u7528\u5BF9\u5076\u9A88\u53E5',
    concise: '\u7B80\u6D01\u660E\u5FEB\uFF0C\u76F4\u5165\u4E3B\u9898\uFF0C\u4E0D\u7528\u5197\u957F\u8F9E\u85FB',
    ornate: '\u534E\u4E3D\u6587\u85FB\uFF0C\u6587\u91C7\u98DE\u626C\uFF0C\u5927\u91CF\u4F7F\u7528\u5178\u6545\u3001\u8F9E\u8D4B\u3001\u6392\u6BD4',
    plain: '\u767D\u8BDD\u6587\u8A00\uFF0C\u534A\u6587\u534A\u767D\uFF0C\u901A\u4FD7\u6613\u61C2\u4F46\u4FDD\u6301\u5E84\u91CD'
  }[style] || '';

  if (!P.ai.key) {
    var merged = parts.map(function(p) { return '\u3010' + p.label + '\u3011' + p.content; }).join('\n\n');
    _renderPolishedEdict(panel, merged);
    return;
  }

  var sc = findScenarioById && findScenarioById(GM.sid);
  var era = (sc && sc.era) || '';
  var dynasty = (sc && sc.dynasty) || '';
  var role = (P.playerInfo && P.playerInfo.characterName) || '\u7687\u5E1D';
  var dateText = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';

  var prompt = '\u4F60\u662F' + (dynasty || era || '\u4E2D\u56FD\u53E4\u4EE3') + '\u671D\u5EF7\u7684\u4E2D\u4E66\u820D\u4EBA/\u7FF0\u6797\u5B66\u58EB\uFF0C\u8D1F\u8D23\u8D77\u8349\u6B63\u5F0F\u8BCF\u4E66\u3002\n\n';
  prompt += '\u3010\u53D1\u5E03\u8005\u3011' + role + '\n';
  prompt += '\u3010\u65F6\u95F4\u3011' + dateText + '\n\n';
  prompt += '\u3010\u73A9\u5BB6\u8349\u62DF\u7684\u5404\u7C7B\u65E8\u610F\u3011\n';
  parts.forEach(function(p) { prompt += '\u3014' + p.label + '\u3015' + p.content + '\n'; });

  prompt += '\n\u3010\u4EFB\u52A1\u3011\u5C06\u4EE5\u4E0A\u5404\u7C7B\u65E8\u610F\u5408\u5E76\u6DA6\u8272\u4E3A\u4E00\u9053\u5B8C\u6574\u7684\u6B63\u5F0F\u8BCF\u4E66\u3002\u8981\u6C42\uFF1A\n';
  prompt += '1. \u8BCF\u4E66\u683C\u5F0F\u5FC5\u987B\u4E25\u683C\u9075\u5FAA' + (era || '\u8BE5\u671D\u4EE3') + '\u7684\u771F\u5B9E\u516C\u6587\u4F53\u5236\u2014\u2014\n';
  prompt += '   \u4E0D\u540C\u671D\u4EE3\u8BCF\u4E66\u683C\u5F0F\u5DEE\u5F02\u6781\u5927\uFF0C\u4F60\u5FC5\u987B\u6839\u636E\u5177\u4F53\u671D\u4EE3\u9009\u7528\u6B63\u786E\u683C\u5F0F\uFF1A\n';
  prompt += '   \u00B7 \u79E6\u6C49\uFF1A\u5236\u66F0/\u8BCF\u66F0\uFF0C\u65E0\u56FA\u5B9A\u8D77\u9996\u5957\u8BED\uFF0C\u7ED3\u5C3E\u201C\u5E03\u544A\u5929\u4E0B\u201D\u201C\u5176\u4EE4\u2026\u2026\u201D\u7B49\n';
  prompt += '   \u00B7 \u9B4F\u664B\u5357\u5317\u671D\uFF1A\u591A\u7528\u201C\u95E8\u4E0B\u201D\u8D77\u9996\uFF0C\u9A88\u6587\u98CE\u683C\u6D53\u90C1\n';
  prompt += '   \u00B7 \u5510\u5B8B\uFF1A\u5236\u4E66\u201C\u95E8\u4E0B\uFF1A\u201D\u8D77\u9996\uFF0C\u6555\u4E66\u201C\u6555\u67D0\u67D0\u201D\u8D77\u9996\uFF0C\u7ED3\u5C3E\u201C\u4E3B\u8005\u65BD\u884C\u201D\n';
  prompt += '   \u00B7 \u5143\u4EE3\uFF1A\u8499\u6C49\u5408\u74A7\uFF0C\u767D\u8BDD\u8BCF\u4E66\u201C\u957F\u751F\u5929\u6C14\u529B\u91CC\uFF0C\u5927\u798F\u836B\u62A4\u52A9\u91CC\uFF0C\u7687\u5E1D\u5723\u65E8\u2026\u2026\u201D\n';
  prompt += '   \u00B7 \u660E\u6E05\uFF1A\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\uFF0C\u8BCF\u66F0/\u5236\u66F0/\u6555\u66F0\u201D\u2014\u2014\u6CE8\u610F\u201C\u5949\u5929\u627F\u8FD0\u201D\u56DB\u5B57\u540E\u63A5\u201C\u7687\u5E1D\u201D\uFF0C\n';
  prompt += '     \u201C\u8BCF\u66F0\u201D\u53E6\u8D77\uFF0C\u4E2D\u95F4\u65AD\u53E5\uFF0C\u4E0D\u662F\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u8BCF\u66F0\u201D\u8FDE\u8BFB\u3002\u4E14\u6B64\u683C\u5F0F\u4EC5\u9650\u660E\u6E05\u3002\n';
  prompt += '   \u00B7 \u82E5\u975E\u5E1D\u738B\uFF08\u5982\u8BF8\u4FAF/\u738B/\u4E1E\u76F8\u7B49\uFF09\uFF0C\u5E94\u4F7F\u7528\u201C\u4EE4\u201D\u201C\u6559\u201D\u201C\u6A84\u201D\u7B49\u5BF9\u5E94\u6587\u79CD\uFF0C\u4E0D\u7528\u201C\u8BCF\u201D\n';
  prompt += '2. \u6B63\u6587\uFF1A\u5C06\u5404\u7C7B\u65E8\u610F\u6709\u673A\u878D\u5408\uFF0C\u6309\u8F7B\u91CD\u7F13\u6025\u6392\u5217\uFF0C\u884C\u6587\u6D41\u7545\n';
  prompt += '3. \u8BED\u8A00\u98CE\u683C\uFF1A' + styleDesc + '\n';
  prompt += '4. \u4FDD\u7559\u73A9\u5BB6\u6240\u6709\u65E8\u610F\u7684\u5B9E\u8D28\u5185\u5BB9\uFF0C\u4E0D\u9057\u6F0F\u4E0D\u7BE1\u6539\uFF0C\u4E0D\u51ED\u7A7A\u589E\u52A0\u65B0\u653F\u7B56\n';
  prompt += '5. \u5B57\u6570\uFF1A' + _charRangeText('zw') + '\n\n';
  prompt += '\u76F4\u63A5\u8F93\u51FA\u8BCF\u4E66\u5168\u6587\uFF0C\u4E0D\u8981\u52A0\u4EFB\u4F55\u89E3\u91CA\u3002';

  try {
    var result = await callAI(prompt, 2000);
    if (result) _renderPolishedEdict(panel, result);
    else panel.innerHTML = '<div style="color:var(--color-foreground-muted);text-align:center;">\u6DA6\u8272\u672A\u8FD4\u56DE\u5185\u5BB9</div>';
  } catch(e) {
    panel.innerHTML = '<div style="color:var(--vermillion-400);">\u6DA6\u8272\u5931\u8D25\uFF1A' + escHtml(e.message || '') + '</div>';
  }
}

function _renderPolishedEdict(panel, text) {
  // 卷轴式·宣纸底+上下木轴+朱砂御玺+颁行天下
  panel.innerHTML = ''
    + '<div class="ed-scroll">'
    +   '<div class="ed-scroll-title">\u8BCF\u3000\u4E66</div>'
    +   '<textarea id="edict-polished-text" class="ed-scroll-text" rows="12">' + escHtml(text) + '</textarea>'
    +   '<div class="ed-scroll-seal"><div class="top">\u7687 \u5E1D</div><div class="main">\u5236\u5B9D</div><div class="bot">\u4E4B \u5B9D</div></div>'
    + '</div>'
    + '<div class="ed-scroll-actions">'
    +   '<button class="ed-scroll-btn" onclick="_polishEdicts()" title="\u91CD\u65B0\u7531\u6709\u53F8\u6DA6\u8272">\u91CD \u65B0 \u6DA6 \u8272</button>'
    +   '<button class="ed-scroll-btn" onclick="_applyPolishedEdict(\'keep\')" title="\u5B58\u4E3A\u8BCF\u4E66\u624B\u7A3F\u00B7\u5F52\u6863\u8D77\u5C45\u6CE8\u00B7\u672A\u9881\u884C">\u624B \u7A3F \u5165 \u6863</button>'
    +   '<button class="ed-scroll-btn primary" onclick="_applyPolishedEdict(\'replace\')" title="\u8BCF\u4E66\u9881\u884C\u5929\u4E0B\u00B7\u5F55\u5165\u653F\u4EE4\u680F\u00B7\u540C\u65F6\u5F52\u6863\u8D77\u5C45\u6CE8">\u9881 \u884C \u5929 \u4E0B</button>'
    +   '<button class="ed-scroll-btn" onclick="_$(\'edict-polished\').style.display=\'none\'">\u6536 \u8D77</button>'
    + '</div>';
}

function _applyPolishedEdict(mode) {
  var ta = _$('edict-polished-text');
  if (!ta) return;
  var text = ta.value.trim();
  if (!text) { toast('\u8BCF\u4E66\u5185\u5BB9\u4E3A\u7A7A'); return; }

  // 升级 GM.edicts 为结构化数组·兼容老字符串数据
  if (!Array.isArray(GM.edicts)) GM.edicts = [];
  for (var _i = 0; _i < GM.edicts.length; _i++) {
    if (typeof GM.edicts[_i] === 'string') {
      GM.edicts[_i] = { id: 'legacy-' + _i, turn: 0, time: '', text: GM.edicts[_i], status: 'draft', source: 'polish', style: '', styleLabel: '', polishVersion: 1, _chainEffects: [] };
    }
  }

  var styleEl = _$('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleLabel = ({elegant:'\u5178\u96C5', concise:'\u7B80\u6D01', ornate:'\u534E\u4E3D', plain:'\u767D\u8BDD'})[style] || '\u5178\u96C5';

  // 本回合已有几次润色
  var _curTurn = GM.turn || 0;
  var _thisTurnPolish = GM.edicts.filter(function(e) { return e.turn === _curTurn && e.source === 'polish'; });
  var polishVersion = _thisTurnPolish.length + 1;

  var status;
  if (mode === 'replace') {
    status = 'promulgated';
    // 同回合之前已颁行的·回落为"诏书手稿"(被后润色稿替代)
    GM.edicts.forEach(function(e) {
      if (e.turn === _curTurn && e.status === 'promulgated') e.status = 'draft';
    });
    var polEl = _$('edict-pol');
    if (polEl) polEl.value = text;
    ['edict-mil', 'edict-dip', 'edict-eco', 'edict-oth'].forEach(function(id) {
      var el = _$(id); if (el) el.value = '';
    });
    toast('\u8BCF\u4E66\u9881\u884C\u5929\u4E0B\u00B7\u5DF2\u5F55\u5165\u653F\u4EE4\u680F');
  } else {
    status = 'draft';
    toast('\u8BCF\u4E66\u5DF2\u7F16\u8BA2\u5165\u6863\u00B7\u672A\u9881\u884C\uFF08\u8BCF\u4E66\u624B\u7A3F\uFF09');
  }

  var rec = {
    id: 'edict-' + _curTurn + '-' + Date.now() + '-' + polishVersion,
    turn: _curTurn,
    time: (typeof getTSText === 'function') ? getTSText(_curTurn) : '',
    text: text,
    status: status,
    source: 'polish',
    style: style,
    styleLabel: styleLabel,
    polishVersion: polishVersion,
    _chainEffects: []
  };
  GM.edicts.push(rec);

  // 诏书入起居注（"诏令"分类·即时可见）
  if (!GM.qijuHistory) GM.qijuHistory = [];
  var _statusLabel = status === 'promulgated' ? '\u9881\u884C\u5929\u4E0B' : '\u8BCF\u4E66\u624B\u7A3F';
  var _headline = '\u3010\u8BCF\u4E66\u00B7' + _statusLabel + '\u00B7\u7B2C' + polishVersion + '\u6B21\u6DA6\u8272\u00B7' + styleLabel + '\u3011';
  GM.qijuHistory.push({
    turn: _curTurn,
    time: rec.time,
    category: '\u8BCF\u4EE4',
    content: _headline + '\n' + text,
    _edictRef: rec.id
  });

  _$('edict-polished').style.display = 'none';
  if (typeof renderQiju === 'function') renderQiju();
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
}

// 注册结算步骤（top-level·使存档加载路径也生效——
// 历史问题：原先放在 startGame 内·loadFromSlot/fullLoadGame 不会走 startGame·
// 导致存档玩家全部信件永远卡 traveling·UI 显示"信使逾期/失踪"。）
if (typeof SettlementPipeline !== 'undefined') {
  SettlementPipeline.register('letters', '鸿雁传书', function() { _settleLettersAndTravel(); }, 42, 'perturn');
  SettlementPipeline.register('office_mourning', '丁忧/考课结算', function() { _settleOfficeMourning(); }, 45, 'perturn');
}

/** 控制台·信件医生：一键修复存量卡死信件
 *  用法：在 DevTools 控制台执行 letterDoctor() 即可
 *  · 消费 _pendingNpcLetters 待入队的 NPC 来信·防止永远积压
 *  · traveling 且 GM.turn>=deliveryTurn 的所有信·立刻送达
 *  · intercepted 的信·若 deliveryTurn 已过·转 returned 并附驿递备注·同步清 _undeliveredLetters
 *  · _npcInitiated 的 delivered/traveling 已到期信·转 returned
 *  · 输出修复明细
 */
function letterDoctor() {
  if (typeof GM === 'undefined' || !GM) { console.warn('[letterDoctor] GM 未初始化'); return; }
  if (!Array.isArray(GM.letters)) GM.letters = [];
  if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
  if (!GM._courierStatus) GM._courierStatus = {};
  var fixed = { delivered: 0, replied: 0, returned: 0, npcArrived: 0, interceptedHealed: 0, pendingFlushed: 0 };
  var nowTurn = GM.turn || 0;
  var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (nowTurn-1)*_dpv;
  function _arrDay(l){ return (typeof l._deliveryDay === 'number') ? l._deliveryDay : (typeof l.deliveryTurn === 'number') ? (l.deliveryTurn-1)*_dpv : Infinity; }
  function _replyDay(l){ return (typeof l._replyDay === 'number') ? l._replyDay : (typeof l.replyTurn === 'number') ? (l.replyTurn-1)*_dpv : _arrDay(l)+_dpv; }

  // 0·先把 pending NPC 队列消费成 letters（直接 returned·跳过 traveling 周期·让玩家立即看到）
  if (GM._pendingNpcLetters.length > 0) {
    var _capital = GM._capital || '京城';
    var _nlBatch = GM._pendingNpcLetters.slice();
    GM._pendingNpcLetters = [];
    _nlBatch.forEach(function(nl) {
      try {
        if (!nl || !nl.from) return;
        var fromCh = (typeof findCharByName === 'function') ? findCharByName(nl.from) : null;
        var fromLoc = fromCh ? (fromCh.location || '远方') : '远方';
        GM.letters.push({
          id: (typeof uid === 'function') ? uid() : 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
          from: nl.from, to: '玩家', fromLocation: fromLoc, toLocation: _capital,
          content: nl.content||'', sentTurn: nowTurn, deliveryTurn: nowTurn,
          _sentDay: nowDay, _deliveryDay: nowDay, _travelDays: 0,
          reply: '', status: 'returned', urgency: nl.urgency||'normal',
          letterType: nl.type||'report', _npcInitiated: true,
          _replyExpected: nl.replyExpected !== false, _playerRead: false,
          _suggestion: nl.suggestion || '', _sendMode: 'multi_courier',
          _doctorFlushed: true
        });
        fixed.pendingFlushed++;
      } catch(_){}
    });
  }

  GM.letters.forEach(function(l) {
    if (!l) return;
    var _arr = _arrDay(l);
    var _rep = _replyDay(l);
    // 玩家信·卡 traveling 且已到期 → delivered → replying → returned
    if (!l._npcInitiated && l.status === 'traveling' && nowDay >= _arr) {
      l.status = 'delivered'; fixed.delivered++;
      try { if (typeof _generateLetterReply === 'function') _generateLetterReply(l); fixed.replied++; } catch(_){ }
    }
    // 玩家信·卡 replying 且已到期 → returned
    if (!l._npcInitiated && l.status === 'replying' && nowDay >= _rep) {
      l.status = 'returned'; fixed.returned++;
      if (!l.reply) l.reply = '臣已拜读圣函·当尽心承命·容详察具复。';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + '已收函';
    }
    // NPC 来信·卡 traveling/delivered 且已到期 → returned
    if (l._npcInitiated && (l.status === 'traveling' || l.status === 'delivered') && nowDay >= _arr) {
      l.status = 'returned'; fixed.npcArrived++;
    }
    // intercepted 已久 → returned 并附备注·同步清 _undeliveredLetters（45 天阈值）
    if (l.status === 'intercepted' && nowDay > _arr + 45) {
      l.status = 'returned'; fixed.interceptedHealed++;
      if (!l.reply) l.reply = '（信使遗失·辗转送达·原文已部分残缺）';
      GM._courierStatus[l.id] = '信使辗转归来';
      if (Array.isArray(GM._undeliveredLetters)) {
        GM._undeliveredLetters = GM._undeliveredLetters.filter(function(u){
          return !(u && u.from === l.from && u.to === l.to && u.content === l.content);
        });
      }
    }
    // intercepted_forging 久未触发回信 → 强制 returned 并标记伪造（30 天阈值）
    if (l.status === 'intercepted_forging' && nowDay > _arr + 30) {
      l.status = 'returned'; l._isForged = true; fixed.interceptedHealed++;
      if (!l.reply) l.reply = '（伪造回函·内容可疑）';
      GM._courierStatus[l.id] = '伪造回函·疑窦';
    }
  });
  if (typeof renderLetterPanel === 'function') {
    try { renderLetterPanel(); } catch(_){}
  }
  console.log('[letterDoctor] 修复完成:', fixed,
    '| 当前 letters 状态分布:',
    GM.letters.reduce(function(a, l){ a[l.status] = (a[l.status]||0) + 1; return a; }, {}));
  if (typeof toast === 'function') {
    var n = fixed.delivered + fixed.returned + fixed.npcArrived + fixed.interceptedHealed + fixed.pendingFlushed;
    toast('信件医生：修复 ' + n + ' 封'
      + (fixed.pendingFlushed ? '·NPC 待入队 ' + fixed.pendingFlushed : '')
      + (fixed.npcArrived ? '·NPC来函 ' + fixed.npcArrived : '')
      + (fixed.delivered ? '·玩家信送达 ' + fixed.delivered : '')
      + (fixed.interceptedHealed ? '·失踪信归 ' + fixed.interceptedHealed : ''));
  }
  return fixed;
}
if (typeof window !== 'undefined') window.letterDoctor = letterDoctor;

/** 控制台·信件诊断：不修改任何状态·只输出当前信件系统的健康报告
 *  用法：letterDiag()
 *  返回详细分布·让玩家自查 + 直接发开发者排错
 */
function letterDiag() {
  if (typeof GM === 'undefined' || !GM) return console.warn('[letterDiag] GM 未初始化');
  var letters = GM.letters || [];
  var nowTurn = GM.turn || 0;
  var byStatus = {}, npcInit = 0, playerSent = 0;
  var stuckTraveling = [], stuckIntercepted = [];
  letters.forEach(function(l) {
    if (!l) return;
    byStatus[l.status||'?'] = (byStatus[l.status||'?']||0) + 1;
    if (l._npcInitiated) npcInit++; else if (l.from === '玩家') playerSent++;
    if (l.status === 'traveling' && typeof l.deliveryTurn === 'number' && nowTurn > l.deliveryTurn + 1) {
      stuckTraveling.push({id:l.id, to:l.to, from:l.from, sentTurn:l.sentTurn, deliveryTurn:l.deliveryTurn, overdue: nowTurn - l.deliveryTurn});
    }
    if (l.status === 'intercepted' && typeof l.deliveryTurn === 'number' && nowTurn > l.deliveryTurn + 3) {
      stuckIntercepted.push({id:l.id, to:l.to, from:l.from, by:l.interceptedBy, deliveryTurn:l.deliveryTurn});
    }
  });
  var pipelineHasLetters = (typeof SettlementPipeline !== 'undefined') &&
    SettlementPipeline.list().some(function(s){ return s.id === 'letters'; });
  var report = {
    turn: nowTurn,
    capital: GM._capital,
    gameMode: (P.conf && P.conf.gameMode) || 'yanyi',
    canIntercept: (P.conf && (P.conf.gameMode === 'strict_hist' || P.conf.gameMode === 'light_hist')),
    pipelineHasLetters: pipelineHasLetters,
    lettersTotal: letters.length,
    byStatus: byStatus,
    npcInitiated: npcInit,
    playerSent: playerSent,
    pendingNpcLetters: (GM._pendingNpcLetters||[]).length,
    pendingMemorialDeliveries: (GM._pendingMemorialDeliveries||[]).length,
    routeDisruptions: ((GM._routeDisruptions||[]).filter(function(d){return !d.resolved;})).length,
    interceptedIntel: (GM._interceptedIntel||[]).length,
    undeliveredLetters: (GM._undeliveredLetters||[]).length,
    stuckTravelingCount: stuckTraveling.length,
    stuckInterceptedCount: stuckIntercepted.length,
    stuckTravelingSample: stuckTraveling.slice(0,3),
    stuckInterceptedSample: stuckIntercepted.slice(0,3)
  };
  console.log('═══════ 鸿雁传书诊断报告 ═══════');
  console.log(report);
  if (!pipelineHasLetters) console.warn('⚠ letters 步骤未注册到 SettlementPipeline·结算永不会跑·请重启 app');
  if (stuckTraveling.length > 0) console.warn('⚠ ' + stuckTraveling.length + ' 封信卡 traveling 已逾期·建议执行 letterDoctor()');
  if (stuckIntercepted.length > 0) console.warn('⚠ ' + stuckIntercepted.length + ' 封信卡 intercepted 久未处理·建议执行 letterDoctor()');
  if ((GM._pendingNpcLetters||[]).length > 0) console.warn('⚠ ' + GM._pendingNpcLetters.length + ' 条 NPC 来信待入队·下回合结算时入队·或执行 letterDoctor() 立即消费');
  return report;
}
if (typeof window !== 'undefined') window.letterDiag = letterDiag;
