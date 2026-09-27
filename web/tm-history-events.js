// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-history-events.js — 历史事件系统 + 时间工具
//
// R93 从 tm-endturn.js §A 抽出·原 L1997-2387 (391 行)
// 9 函数：
//   历史事件框架：checkHistoryEvents / showHistoryEventModal / applyEventBranch
//   刚性触发器：   checkRigidTriggers / triggerRigidEvent
//   路径工具：     getValueByPath / setValueByPath
//   时间工具：     getCurrentYear (外部 6 处调用) / getCurrentMonth (2 处)
//
// 外部调用：getCurrentYear 6 处·getCurrentMonth 2 处·其他 0
// 依赖外部：GM / P / openGenericModal / _dbg / addEB（均 window 全局）
//
// 加载顺序：必须在 tm-endturn.js 之前（而 getCurrentYear 调用方也必须在此之后）
// ============================================================

// ============================================================
//  历史事件系统 - 通用时间触发+分支选择框架
// ============================================================

/**
 * 检查并触发历史事件
 * 框架特性：
 * - 基于年月的时间触发
 * - 多分支选择系统
 * - 影响自动应用
 * - 事件去重（已触发不再触发）
 */
function checkHistoryEvents() {
  // historical-agency-v21: player-driven scenarios do not replay scheduled historical outcomes.
  if (typeof TM !== 'undefined' && TM.HistoricalAgency && TM.HistoricalAgency.isPlayerDriven()) return;
  // 剧本隔离根治：gameplay 只读当前局 GM.rigidHistoryEvents(doActualStart 已建的单剧本干净副本)·
  // 绝不读跨剧本累积的 P.rigidHistoryEvents 库(官方天启快照常驻·会让绍宋触发天启的「魏忠贤自缢」等)。
  // 旧存档无 GM.rigidHistoryEvents 时按当前 sid 过滤 P 兜底(纵深防御)。
  var _rigids = (GM && Array.isArray(GM.rigidHistoryEvents)) ? GM.rigidHistoryEvents
    : (typeof _tmActiveScenarioRows==='function'?_tmActiveScenarioRows(P.rigidHistoryEvents):(P.rigidHistoryEvents||[]));
  if (!_rigids || _rigids.length === 0) return;
  if (!GM.triggeredHistoryEvents) GM.triggeredHistoryEvents = {};

  var currentYear = getCurrentYear();
  var currentMonth = getCurrentMonth();

  _rigids.forEach(function(event) {
    // 跳过已触发事件
    if (GM.triggeredHistoryEvents[event.id]) return;

    // 触发回合门槛(刚性史事剧本写 triggerTurn:N·如魏忠贤自缢 triggerTurn:3)·未到回合不触发
    // 原 bug:triggerTurn 从不读·且 string 型 trigger(如「阉党权势值 < 50 且 皇威 > 50」)被当对象→
    //   trigger.year/.month 恒 undefined → year/monthMatch 恒 true → 开局第一回合即无条件触发(魏忠贤开局自缢·破坏史实代入)
    if (typeof event.triggerTurn === 'number' && (GM.turn || 0) < event.triggerTurn) return;

    // 仅当 trigger 为结构化对象时按 year/month/condition 判定;字符串/缺省 trigger 不构成时间门(其文本是设计者条件注记·交 triggerTurn 把关)
    var trigger = (event.trigger && typeof event.trigger === 'object') ? event.trigger : {};
    var yearMatch = trigger.year === undefined || trigger.year === currentYear;
    var monthMatch = trigger.month === undefined || trigger.month === currentMonth;

    // 自定义条件检查（可选·函数型·注:存档 deepClone 会剥函数·剧本宜用 triggerTurn/year/month 数据型门槛）
    var customMatch = true;
    if (typeof trigger.condition === 'function') {
      try {
        customMatch = trigger.condition(GM, P);
      } catch (e) {
        customMatch = false;
      }
    }

    // 门槛防御:既无 triggerTurn 又无任何结构化 trigger(year/month/condition 全缺)→不每回合无条件触发(原 string-trigger 事件即此情形被误开局触发)
    var hasGate = (typeof event.triggerTurn === 'number') || trigger.year !== undefined || trigger.month !== undefined || typeof trigger.condition === 'function';
    if (!hasGate) return;

    if (yearMatch && monthMatch && customMatch) {
      // ★ 刚性史实事件·触发门 + 结构化死亡（2026-07-08）治三症：
      //   ①晚一回合/永不死：死亡原靠下游叙事词库扫描兜底(漏"杖毙"等即永不死)→带 deathTarget 者触发时当场结构化置死。
      //   ②演义也照旧硬弹：与"由玩家改写历史"调性冲突→演义按结构化条件触发·可全关；轻度/严格史实维持现状。
      //   ③写好的 trigger 从不生效：字符串 trigger 被当注记→改用通用结构化条件(triggerCondAll/requiresDead)求值。
      // (0) 注定之死已由玩家以别法了结(如提前处决)→记为已了结·不重复弹/不重复级联
      if ((event.deathTargetId||event.deathTarget) && _rigidDeathTargetAlreadyDead(event.deathTargetId||event.deathTarget)) {
        GM.triggeredHistoryEvents[event.id] = { turn: GM.turn, resolved: 'already-dead' }; // arch-ok 本文件自有触发记录表·同 line 85 既有写口
        return;
      }
      // (1) 触发门：演义按条件/可全关；轻度·严格史实照旧到点即弹(时间门上方已把关)
      if (!_rigidHistoryEventShouldFire(event)) return; // 条件不成立/被玩家关闭·本回合不弹(不标记·局势后续变了可再判)

      // 标记为已触发
      GM.triggeredHistoryEvents[event.id] = {
        turn: GM.turn,
        year: currentYear,
        month: currentMonth
      };

      // (2) 结构化"史实注定死亡"：当场置死 + 全级联(复用 applyOneDeath)·不再等下游叙事扫描兜底
      _applyRigidHistoryDeath(event);
      if (typeof TM!=='undefined'&&TM.NativeWorld&&TM.NativeWorld.enabled(GM)) {
        if(!TM.NativeWorld.eventVisible(GM,event))return;
        if(!TM.NativeWorld.eventChoiceAllowed(GM,event)){if(typeof addEB==='function')addEB('史事',event.name||event.title||'世界事件');return;}
      }

      // 显示事件选择界面（v0.2·事件并入御案时政:开关开 → 收编进 currentIssues·关 → 原独立事件框·零回归）
      if (typeof _eventAdjudicationOn === 'function' && _eventAdjudicationOn() && typeof _pushHistoryEventToIssues === 'function') {
        _pushHistoryEventToIssues(event);
      } else {
        showHistoryEventModal(event);
      }
    }
  });
}

// ============================================================
//  刚性史实事件·触发门 + 结构化死亡（2026-07-08）
//  跨朝代通用：引擎只认通用字段(deathTarget/deathReason/requiresDead/requiresAlive/triggerCondAll/路径)·
//    朝代专名(魏忠贤/客氏/皇威 等)全落在剧本数据·引擎不预设任何单朝特例。
// ============================================================

/** 该注定死者是否已死（玩家可能已用别法了结·避免重复弹与重复死亡级联） */
function _rigidDeathTargetAlreadyDead(name) {
  if (!name) return false;
  var c = _rigidFindChar(name);
  return !!(c && c.alive === false);
}

/** 触发门：本回合该刚性事件是否应当触发 */
function _rigidHistoryEventShouldFire(event) {
  var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
  // 轻度/严格史实：维持现状——时间门过了就弹(不加条件门·历史照旧推进)
  if (event.conditionPolicy === 'always') return _rigidHistoryConditionHolds(event);
  if (mode === 'light_hist' || mode === 'strict_hist') return true;
  // 演义：玩家可一键全关这类"注定事件"(由我改写历史)
  if (typeof P !== 'undefined' && P.conf && P.conf.rigidHistEventsOff) return false;
  // 演义：按结构化条件触发(局势已被玩家改写、条件不再成立则不弹)
  return _rigidHistoryConditionHolds(event);
}

/** 结构化条件求值(通用)：requiresDead / requiresAlive / triggerCondAll[{path,op,val}] 全满足才 true；无条件→true */
function _rigidHistoryConditionHolds(event) {
  if (event && event.executionGuards && typeof TM !== 'undefined' && TM.ScenarioEffects && !TM.ScenarioEffects.guard(event)) return false;
  if (!event) return true;
  // 依赖：指定角色须已死(如"客氏杖毙"须"魏忠贤已死")
  if (Array.isArray(event.requiresDead)) {
    for (var i = 0; i < event.requiresDead.length; i++) {
      var cd = _rigidFindChar(event.requiresDead[i]);
      if (!(cd && cd.alive === false)) return false; // 目标不存在或仍在世 → 条件不成立
    }
  }
  // 依赖：指定角色须在世
  if (Array.isArray(event.requiresAlive)) {
    for (var j = 0; j < event.requiresAlive.length; j++) {
      var ca = _rigidFindChar(event.requiresAlive[j]);
      if (!ca || ca.alive === false) return false;
    }
  }
  // 数值门：全部子句成立(路径解析不到数值→该子句判不成立·保守·演义倾向"不硬弹")
  if (Array.isArray(event.triggerCondAll)) {
    for (var k = 0; k < event.triggerCondAll.length; k++) {
      var cl = event.triggerCondAll[k];
      if (!cl || !cl.path) continue;
      var v = _rigidResolvePath(cl.path);
      if (typeof v !== 'number' || !_rigidCmp(v, cl.op, cl.val)) return false;
    }
  }
  return true;
}

/** 通用比较器 */
function _rigidCmp(v, op, val) {
  switch (op) {
    case '<': return v < val;
    case '<=': return v <= val;
    case '>': return v > val;
    case '>=': return v >= val;
    case '==': case '===': return v === val;
    case '!=': case '!==': return v !== val;
    default: return false;
  }
}

/** 通用路径解析：'fac:名.字段' 走 GM.facs 按名查势力字段；其余复用 getValueByPath(GM.x.y / vars.x / 对象.value|.index) */
function _rigidResolvePath(path) {
  if (!path) return undefined;
  if (path.indexOf('fac:') === 0) {
    var rest = path.slice(4);
    var dot = rest.indexOf('.');
    var fname = dot >= 0 ? rest.slice(0, dot) : rest;
    var field = dot >= 0 ? rest.slice(dot + 1) : 'power';
    var facs = (typeof GM !== 'undefined' && Array.isArray(GM.facs)) ? GM.facs : [];
    var f = facs.find(function (x) { return x && x.name === fname; });
    return f ? f[field] : undefined;
  }
  if (typeof getValueByPath === 'function') return getValueByPath(path);
  return undefined;
}

/** 按名找角色(复用运行时全局·模糊+精确·测试环境缺省时回落 GM.chars 线性查) */
function _rigidFindChar(name) {
  if (!name) return null;
  if(typeof TM!=='undefined'&&TM.NativeWorld&&TM.NativeWorld.enabled(GM))return TM.NativeWorld.resolveCharacter(GM,name);
  if (typeof _fuzzyFindChar === 'function') { var c = _fuzzyFindChar(name); if (c) return c; }
  if (typeof findCharByName === 'function') { var c2 = findCharByName(name); if (c2) return c2; }
  var arr = (typeof GM !== 'undefined' && Array.isArray(GM.chars)) ? GM.chars : [];
  return arr.find(function (x) { return x && x.name === name; }) || null;
}

/** 结构化史实死亡：deathTarget 当场置死 + 全级联(复用 applyOneDeath)·治"死亡靠下游叙事扫描·晚一回合/漏词永不死" */
function _applyRigidHistoryDeath(event) {
  if (!event || (!event.deathTarget&&!event.deathTargetId)) return;
  var reason = event.deathReason || event.name || '史实注定'; // 史实注定
  try {
    if (typeof applyOneDeath === 'function') {
      applyOneDeath({ name: event.deathTarget, characterId:event.deathTargetId, reason: reason });
    } else {
      // 极端回落(applyOneDeath 缺位)：至少置死·免"注定死者仍活蹦乱跳"的尸政
      var c = _rigidFindChar(event.deathTargetId||event.deathTarget);
      if (c && c.alive !== false) { c.alive = false; c.dead = true; c.deathReason = reason; c.deathTurn = (typeof GM !== 'undefined' && GM.turn) || 0; }
    }
  } catch (e) {
    try { console.warn('[刚性史实死亡] 应用失败:', (e && e.message) || e); } catch (_) {}
  }
}
if (typeof window !== 'undefined') {
  window._rigidHistoryEventShouldFire = _rigidHistoryEventShouldFire;
  window._rigidHistoryConditionHolds = _rigidHistoryConditionHolds;
  window._applyRigidHistoryDeath = _applyRigidHistoryDeath;
}

// ============================================================
//  史实锚点·分歧账(V1)——「强制剧情死」(rigidHistoryEvents 注定死)从官方剧本删除后·
//  史实知识转存 GM.histAnchors(认知背景数据)。本函数把「史载已故而本局仍在世」的分歧喂给
//  AI 时空约束(_buildTemporalConstraint·tm-ai-infra.js 运行时按 window 全局调用)。读锚点·不杀人。
//  跨朝代通用：引擎只认通用字段(kind/histTurn/histDate/fate/name)·朝代专名全落剧本数据。
//  (安家于史实域文件·避免 tm-ai-infra.js 巨石破 3000 行阈——动巨石按 alias+内联范式往外搬。)
// ============================================================
/** 把本局与史实的已知分歧(V1)追加进时空约束 lines。
 *  凡 kind=death 且已到史实原线之回合(GM.turn>=histTurn) 且当事人本局仍在世 → 记一条(史载已故·本局仍活·一切以本局为准)。
 *  查无此人/已按别法了结→不出条目(V1 从简)。cap 8。文案中立·不指责玩家·不剧透 fate 外细节。
 *  clauseOnly=true(省 token·防大名单干扰结构化 JSON)只压成一句总纲·不列名单；false 逐条列出。
 *  工坊老剧本无 histAnchors→静默零条目零报错。 */
function _tcAppendDivergence(lines, clauseOnly) {
  var anchors = (typeof GM !== 'undefined' && Array.isArray(GM.histAnchors)) ? GM.histAnchors : [];
  if (!anchors.length) return;
  var turn = (typeof GM !== 'undefined' && GM.turn) || 1;
  var rows = [];
  for (var i = 0; i < anchors.length && rows.length < 8; i++) {
    var a = anchors[i];
    if (!a || a.kind !== 'death' || !a.name) continue;
    if (typeof a.histTurn === 'number' && turn < a.histTurn) continue; // 未到史实原线之时·尚不构成分歧
    var c = null;
    if (typeof findCharByName === 'function') { try { c = findCharByName(a.name); } catch (_) {} }
    if (!c && typeof _rigidFindChar === 'function') c = _rigidFindChar(a.name);
    if (!c && typeof GM !== 'undefined') c = (GM.chars || []).filter(function (x) { return x && x.name === a.name; })[0] || null;
    if (!c) continue;                          // 查无此人·不臆断·不出条目
    if (c.alive === false || c.dead) continue; // 本局已按别法了结(与史实同向)·V1 不出条目
    rows.push(a);
  }
  if (!rows.length) return;
  if (clauseOnly) {
    // 计数中立(不列名单·省 token·防干扰结构化 JSON)·「N 名…」对单/复数皆自洽·避免「多名」在单条时失真。
    lines.push('★ 本局已偏离史实原线：有 ' + rows.length + ' 名史载此前已故之人于本局仍在世；人物存殁一律以本局 GM 游戏态为准，不得据史书卒年补其死亡。');
    return;
  }
  lines.push('【本局与史实的已知分歧（史实锚点·仅背景素养，一切以本局为准）】');
  rows.forEach(function (a) {
    var when = a.histDate || ('第' + a.histTurn + '回合前后');
    var fate = a.fate || '身故';
    lines.push('· ' + a.name + '：史实原线于' + when + fate + '；本局现实仍在世——以本局为准');
  });
}
if (typeof window !== 'undefined') { window._tcAppendDivergence = _tcAppendDivergence; }

/**
 * v0.2·史实事件收编御案时政:rigidHistoryEvent → currentIssues 的 issue
 * branch{name,description,impact} → choice{text,desc,effect,aiHint}·effect=impact(固定·_chooseIssueOption 兜底)·开关开则 AI 据局面裁
 */
function _historyEventToIssue(event) {
  var issue = {
    id: 'hist_' + (event.id || 'x'),
    _scenarioEventId: event.runtimePolicy === 'tm-scenario-decision/1' ? event.id : '',
    _scenarioSid: (typeof GM !== 'undefined' && GM.sid) || '',
    title: event.name || '历史事件',
    description: event.narrative || event.description || '',
    category: '史实',
    status: 'pending',
    raisedTurn: (typeof GM !== 'undefined' && GM.turn) || 1,
    raisedDate: (typeof GM !== 'undefined' && GM._gameDate) || '',
    historicalNote: event.historicalNote || '',
    choices: (event.branches || []).map(function (b) {
      return { text: b.name || '应对', desc: b.description || '', effect: b.impact || null, aiHint: b.aiHint || '' };
    })
  };
  if(typeof TM!=='undefined'&&TM.NativeWorld&&TM.NativeWorld.enabled(GM))issue.sourceHistoryEventId=event.id;
  return issue;
}
function _pushHistoryEventToIssues(event) {
  try {
    if (typeof GM === 'undefined' || !GM) return;
    if (!Array.isArray(GM.currentIssues)) GM.currentIssues = [];
    var issue = _historyEventToIssue(event);
    if (!GM.currentIssues.some(function (i) { return i && i.id === issue.id; })) {
      GM.currentIssues.push(issue);
      if (typeof addEB === 'function') { try { addEB('要务', '史事临御案：' + issue.title); } catch (_) {} }
    }
  } catch (e) { try { console.warn('[史实收编] push currentIssues 失败:', (e && e.message) || e); } catch (_) {} }
}
if (typeof window !== 'undefined') { window._pushHistoryEventToIssues = _pushHistoryEventToIssues; }

/**
 * 显示历史事件选择模态框
 */
function showHistoryEventModal(event) {
  var html = '<div style="padding: 1rem;">';
  html += '<div style="margin-bottom: 1rem; color: var(--gold); font-size: 1.1rem; font-weight: 700;">' + (event.name || '历史事件') + '</div>';

  // 正文优先取 narrative(刚性史事剧本字段)·回退 description·原 bug:只读 description→剧本 narrative 文本被丢弃·弹窗正文空白
  var _body = event.narrative || event.description;
  if (_body) {
    html += '<div style="margin-bottom: 1.5rem; color: var(--txt-s); line-height: 1.6;">' + _body + '</div>';
  }

  html += '<div style="margin-bottom: 1rem; color: var(--txt-d); font-size: 0.9rem;">请选择应对方式：</div>';

  // 渲染分支选项
  if (event.branches && event.branches.length > 0) {
    event.branches.forEach(function(branch, idx) {
      html += '<div style="margin-bottom: 0.8rem; padding: 0.8rem; background: var(--bg-2); border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;" ';
      html += 'onmouseover="this.style.borderColor=\'var(--gold)\'" ';
      html += 'onmouseout="this.style.borderColor=\'transparent\'" ';
      html += 'onclick="applyEventBranch(\'' + event.id + '\', ' + idx + ')">';
      html += '<div style="font-weight: 700; color: var(--gold-l); margin-bottom: 0.3rem;">' + (branch.name || '选项' + (idx + 1)) + '</div>';

      if (branch.description) {
        html += '<div style="font-size: 0.85rem; color: var(--txt-d); margin-bottom: 0.5rem;">' + branch.description + '</div>';
      }

      // 显示影响预览
      if (branch.impact && !(event.runtimePolicy === "tm-scenario-decision/1" && branch.runtimeActions)) {
        html += '<div style="font-size: 0.8rem; color: var(--txt-s);">影响：';
        var impacts = [];
        Object.keys(branch.impact).forEach(function(key) {
          var val = branch.impact[key];
          var sign = val > 0 ? '+' : '';
          impacts.push(({strength:'国力',morale:'士气',population:'人口',treasury:'国库',money:'国库',stability:'稳定',legitimacy:'法统',military:'兵力',economy:'经济',minxin:'民心',authority:'威权',corruption:'贪腐',satisfaction:'满意度',influence:'影响力',unrest:'动荡',loyalty:'忠诚',prestige:'威望'}[key]||key) + ' ' + sign + val);
        });
        html += impacts.join(', ');
        html += '</div>';
      }

      html += '</div>';
    });
  } else {
    html += '<div style="text-align: center; color: var(--txt-d); padding: 1rem;">此事件无可选分支</div>';
    html += '<button class="bt bp" onclick="closeModal()" style="width: 100%; margin-top: 1rem;">确认</button>';
  }

  html += '</div>';

  openGenericModal('历史事件', html, null);
}

/**
 * 应用事件分支效果
 */
function applyEventBranch(eventId, branchIdx) {
  // 剧本隔离根治：从当前局 GM.rigidHistoryEvents 找(单剧本)·不在多剧本 P 库里找·旧档按 sid 过滤兜底
  var _rigids = (GM && Array.isArray(GM.rigidHistoryEvents)) ? GM.rigidHistoryEvents
    : (typeof _tmActiveScenarioRows==='function'?_tmActiveScenarioRows(P.rigidHistoryEvents):(P.rigidHistoryEvents||[]));
  var event = _rigids.find(function(e) { return e.id === eventId; });
  if (!event || !event.branches || !event.branches[branchIdx]) {
    closeModal();
    return;
  }

  var branch = event.branches[branchIdx];
  var nativeEvent=typeof TM!=='undefined'&&TM.NativeWorld&&TM.NativeWorld.enabled(GM),eventRecord=nativeEvent&&GM.triggeredHistoryEvents&&GM.triggeredHistoryEvents[eventId],claim=null;
  if(nativeEvent){
    if(!eventRecord||!TM.NativeWorld.eventChoiceAllowed(GM,event))return{ok:false,code:'native-event-choice-denied'};
    if(eventRecord.branchApplied)return{ok:true,noChange:true};
    claim=TM.NativeWorld.claimEvent(GM,eventId);if(!claim)return{ok:false,code:'native-event-choice-busy'};
  }
  try {

  var _scenarioOutcome = null;
  if (event.runtimePolicy === 'tm-scenario-decision/1') {
    if (typeof TM === 'undefined' || !TM.ScenarioEffects) { toast('本剧本执行接口尚未就绪'); return {ok:false}; }
    _scenarioOutcome = TM.ScenarioEffects.apply(event, branch);
    if (!_scenarioOutcome.ok) { toast(_scenarioOutcome.error); return _scenarioOutcome; }
    if (_scenarioOutcome.duplicate) return _scenarioOutcome;
  }
  // 应用影响
  if(nativeEvent){
    if(typeof branch.effect==='function')throw new Error('原生资料事件不执行嵌入脚本');
    Object.keys(branch.impact||{}).forEach(function(k){if(['__proto__','prototype','constructor'].indexOf(k)>=0||typeof branch.impact[k]!=='number'||!Number.isFinite(branch.impact[k]))throw new Error('原生事件影响字段无效：'+k);});
  }
  if (branch.impact && !_scenarioOutcome) {
    Object.keys(branch.impact).forEach(function(key) {
      var val = branch.impact[key];

      // 尝试应用到变量
      if (GM.vars[key]) {
        GM.vars[key].value = Math.max(0, Math.min(100, (GM.vars[key].value || 0) + val));
      }

      // 尝试应用到 GM 直接属性
      if (GM[key] !== undefined && typeof GM[key] === 'number') {
        GM[key] = Math.max(0, Math.min(100, GM[key] + val));
      }
    });
  }

  // 执行自定义效果
  if (typeof branch.effect === 'function') {
    try {
      branch.effect(GM, P);
    } catch (e) {
      console.error('Event branch effect error:', e);
    }
  }
  if(nativeEvent)eventRecord.branchApplied={index:branchIdx,turn:GM.turn};

  // 记录到编年
  if (GM.biannianItems) {
    GM.biannianItems.push({
      turn: GM.turn,
      year: getCurrentYear(),
      month: getCurrentMonth(),
      title: event.name + '：' + branch.name,
      content: (branch.description || '') + (_scenarioOutcome ? TM.ScenarioEffects.formatReceipt(_scenarioOutcome.receipt) : ''),
      type: 'history_event'
    });
  }

  // 创建记忆锚点
  createMemoryAnchor('event', event.name, branch.name + '：' + (branch.description || ''), {
    eventId: eventId,
    branchId: branch.id || branchIdx
  });

  if (typeof recordPlayerDecision === 'function') recordPlayerDecision('event', event.name + ':' + branch.name, branch.description || '');
  if (typeof recordCharacterArc === 'function' && event.actors) {
    event.actors.forEach(function(actor) { recordCharacterArc(actor, 'event', event.name + '：' + branch.name); });
  }

  toast('✅ ' + branch.name);
  closeModal();
  return _scenarioOutcome || undefined;
  } finally {if(nativeEvent)TM.NativeWorld.releaseEvent(GM,claim);}
}

// ============================================================
//  刚性触发系统 - 通用阈值触发框架
// ============================================================

/**
 * 检查刚性触发器
 * 框架特性：
 * - 基于阈值的自动触发
 * - 支持多级触发（如：罢工三级）
 * - 硬性下限（防止过度优化）
 * - 可配置触发条件
 */
function checkRigidTriggers() {
  if (!GM.rigidTriggers || Object.keys(GM.rigidTriggers).length === 0) return;

  var triggers = GM.rigidTriggers;

  // 检查单一阈值触发器
  Object.keys(triggers).forEach(function(key) {
    if (key === 'hardFloors' || key === 'levels') return; // 跳过特殊配置

    var config = triggers[key];
    if (typeof config !== 'object' || !config.threshold) return;

    var currentValue = getValueByPath(config.valuePath || key);
    if (currentValue === undefined) return;

    // 检查是否超过阈值
    if (currentValue >= config.threshold) {
      // 检查是否已触发（避免重复）
      var triggerKey = key + '_' + GM.turn;
      if (GM._triggeredThisTurn && GM._triggeredThisTurn[triggerKey]) return;

      if (!GM._triggeredThisTurn) GM._triggeredThisTurn = {};
      GM._triggeredThisTurn[triggerKey] = true;

      // 触发事件
      triggerRigidEvent(key, config, currentValue);
    }
  });

  // 检查多级触发器（如罢工等级）
  if (triggers.levels && Array.isArray(triggers.levels)) {
    triggers.levels.forEach(function(level) {
      if (!level.valuePath || !level.threshold) return;

      var currentValue = getValueByPath(level.valuePath);
      if (currentValue === undefined) return;

      if (currentValue >= level.threshold) {
        var triggerKey = 'level_' + level.id + '_' + GM.turn;
        if (GM._triggeredThisTurn && GM._triggeredThisTurn[triggerKey]) return;

        if (!GM._triggeredThisTurn) GM._triggeredThisTurn = {};
        GM._triggeredThisTurn[triggerKey] = true;

        triggerRigidEvent(level.id, level, currentValue);
      }
    });
  }

  // 应用硬性下限
  if (triggers.hardFloors) {
    Object.keys(triggers.hardFloors).forEach(function(key) {
      var floor = triggers.hardFloors[key];
      var currentValue = getValueByPath(key);

      if (currentValue !== undefined && currentValue < floor) {
        setValueByPath(key, floor);
      }
    });
  }

  // 清空本回合触发记录（下回合重新检查）
  if (GM._triggeredThisTurn) {
    delete GM._triggeredThisTurn;
  }
}

/**
 * 触发刚性事件
 */
function triggerRigidEvent(id, config, currentValue) {
  var html = '<div style="padding: 1rem;">';
  html += '<div style="margin-bottom: 1rem; color: var(--red); font-size: 1.1rem; font-weight: 700;">';
  html += '⚠️ ' + (config.name || '触发事件');
  html += '</div>';

  html += '<div style="margin-bottom: 1rem; color: var(--txt-s); line-height: 1.6;">';
  html += config.description || ('当前值 ' + currentValue + ' 已达到阈值 ' + config.threshold);
  html += '</div>';

  // 显示影响
  if (config.impact) {
    html += '<div style="margin-top: 1rem; padding: 0.8rem; background: var(--bg-2); border-radius: 6px;">';
    html += '<div style="font-weight: 700; color: var(--gold); margin-bottom: 0.5rem;">影响：</div>';
    Object.keys(config.impact).forEach(function(key) {
      var val = config.impact[key];
      var sign = val > 0 ? '+' : '';
      html += '<div style="font-size: 0.9rem; color: var(--txt-d);">' + ({strength:'国力',morale:'士气',population:'人口',treasury:'国库',money:'国库',stability:'稳定',legitimacy:'法统',military:'兵力',economy:'经济',minxin:'民心',authority:'威权',corruption:'贪腐',satisfaction:'满意度',influence:'影响力',unrest:'动荡',loyalty:'忠诚',prestige:'威望'}[key]||key) + ': ' + sign + val + '</div>';
    });
    html += '</div>';
  }

  html += '<button class="bt bp" onclick="closeModal()" style="width: 100%; margin-top: 1rem;">确认</button>';
  html += '</div>';

  // 应用影响
  if (config.impact) {
    Object.keys(config.impact).forEach(function(key) {
      var val = config.impact[key];

      if (GM.vars[key]) {
        GM.vars[key].value = Math.max(0, Math.min(100, (GM.vars[key].value || 0) + val));
      }

      if (GM[key] !== undefined && typeof GM[key] === 'number') {
        GM[key] = Math.max(0, Math.min(100, GM[key] + val));
      }
    });
  }

  // 执行自定义效果
  if (typeof config.effect === 'function') {
    try {
      config.effect(GM, P);
    } catch (e) {
      console.error('Rigid trigger effect error:', e);
    }
  }

  // 记录到编年
  if (GM.biannianItems) {
    GM.biannianItems.push({
      turn: GM.turn,
      year: getCurrentYear(),
      month: getCurrentMonth(),
      title: config.name || '触发事件',
      content: config.description || '',
      type: 'rigid_trigger'
    });
  }

  // v0.2·事件并入御案时政:阈值刚性事件无决断分支·属"近事警讯"(按正式面板架构「近事归事件栏·御案时政只承接待裁议题」·故不进 currentIssues 待决)。
  //   开关开 → 走事件栏 addEB 统一播报(消灭独立"系统事件"modal·应 owner「不要独立事件框 ui」)·关 → 原 openGenericModal(零回归)。
  //   上方 impact / 编年已照常落地(刚性阈值后果·与开关无关)。
  if (typeof _eventAdjudicationOn === 'function' && _eventAdjudicationOn() && typeof addEB === 'function') {
    var _ebMsg = (config.name || '刚性触发') + (config.description ? ('·' + config.description) : '');
    try { addEB(config.ebCategory || '警讯', _ebMsg); } catch (_) { openGenericModal('系统事件', html, null); }
  } else {
    openGenericModal('系统事件', html, null);
  }
}

/**
 * 辅助函数：通过路径获取值
 */
function getValueByPath(path) {
  if (!path) return undefined;

  // 支持 "GM.xxx" 或 "vars.xxx" 格式
  var parts = path.split('.');
  var obj = parts[0] === 'GM' ? GM : (parts[0] === 'vars' ? GM.vars : GM);

  for (var i = (parts[0] === 'GM' || parts[0] === 'vars' ? 1 : 0); i < parts.length; i++) {
    if (obj === undefined) return undefined;
    obj = obj[parts[i]];
  }

  // 如果是变量对象，返回 value
  if (obj && typeof obj === 'object' && obj.value !== undefined) {
    return obj.value;
  }

  return obj;
}

/**
 * 辅助函数：通过路径设置值
 */
function setValueByPath(path, value) {
  if (!path) return;

  var parts = path.split('.');
  var obj = parts[0] === 'GM' ? GM : (parts[0] === 'vars' ? GM.vars : GM);

  for (var i = (parts[0] === 'GM' || parts[0] === 'vars' ? 1 : 0); i < parts.length - 1; i++) {
    if (obj === undefined) return;
    obj = obj[parts[i]];
  }

  var lastKey = parts[parts.length - 1];

  // 如果是变量对象，设置 value
  if (obj[lastKey] && typeof obj[lastKey] === 'object' && obj[lastKey].value !== undefined) {
    obj[lastKey].value = value;
  } else {
    obj[lastKey] = value;
  }
}

/**
 * 辅助函数：获取当前年份
 */
function getCurrentYear() {
  if (!P.time) return 0;
  if (typeof calcDateFromTurn === 'function') return calcDateFromTurn(GM.turn || 1).adYear;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var yearOffset = Math.floor(((GM.turn || 1) - 1) * dpv / 365);
  return (P.time.year || 0) + yearOffset;
}

/**
 * 辅助函数：获取当前月份
 */
function getCurrentMonth() {
  if (!P.time) return 1;
  if (typeof calcDateFromTurn === 'function') return calcDateFromTurn(GM.turn || 1).solarMonth;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var monthOffset = Math.floor((((GM.turn || 1) - 1) * dpv) / 30);
  return ((P.time.startMonth || 1) - 1 + monthOffset) % 12 + 1;
}

// Opt-in, data-driven decision effects. All physical operations use existing subsystem APIs.
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var kinds = ['money', 'grain', 'cloth'];
  var snapshots = ['guoku','armies','classes','parties','chars','minxin','fiscalConfig','_fiscalDirty','_lastTaxReform','vars','facs','_factionDiplomacyLog','_factionDiplomacySeq','triggeredHistoryEvents'];
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function need(v, message) { if (!v) throw Error(message); }
  function rows(key) { return Array.isArray(global.GM && global.GM[key]) ? global.GM[key] : []; }
  function one(key, id) { var matches = rows(key).filter(function(x) { return x && (x.id === id || x.name === id); }); return matches.length === 1 ? matches[0] : null; }
  function living(ch) { return !!(ch && ch.alive !== false && !ch.dead); }
  function proposalFrom(eventId, factionId) {
    var G=global.GM || {}, record=G.triggeredHistoryEvents && G.triggeredHistoryEvents[eventId];
    var op=record && record.decision && (record.decision.operations || []).find(function(o){return o.type==='proposal' && o.result && o.result.targetId===factionId;});
    var fac=one('facs',factionId), prop=op && fac && (fac._incomingProposals || []).find(function(p){return p.id===op.result.proposalId;});
    return prop || null;
  }
  function playerFaction() {
    var G = global.GM || {}, pi = G.playerInfo || (global.P && global.P.playerInfo) || {};
    var pc = rows('chars').find(function(c) { return c && (c.id === G.playerCharacterId || c.isPlayer); });
    return pc && pc.faction || pi.factionId || pi.factionName;
  }
  function guard(event) {
    var G = global.GM || {}, g = event.executionGuards || {};
    if (g.playerFaction && playerFaction() !== g.playerFaction) return false;
    if (event.sid && G.sid && event.sid !== G.sid) return false;
    if (!(g.decisions || []).every(function(spec) {
      var prior=G.triggeredHistoryEvents && G.triggeredHistoryEvents[spec.eventId];
      return prior && prior.decision && (!spec.branchIds || spec.branchIds.indexOf(prior.decision.branchId)>=0);
    })) return false;
    if (!(g.proposals || []).every(function(spec) {
      var p=proposalFrom(spec.eventId,spec.factionId);
      if(!p)return false;
      var status=p.status==='pending' && Number(G.turn)>Number(p.turn)+4 ? 'expired' : p.status;
      return spec.statuses.indexOf(status)>=0;
    })) return false;
    if (!(event.requiresAlive || []).every(function(n) { return living(one('chars', n)); })) return false;
    if (!(g.offices || []).every(function(spec) {
      var c = one('chars', spec.characterId);
      var title=c && Object.prototype.hasOwnProperty.call(c,'officialTitle') ? c.officialTitle : c && (c.title || c.role);
      return living(c) && typeof title==='string' && title.indexOf(spec.includes)>=0;
    })) return false;
    if (!(g.leaders || []).every(function(spec) {
      var c = one('chars', spec.characterId), f = one('facs', spec.factionId);
      return living(c) && f && (f.leader === c.name || f.leaderId === c.id);
    })) return false;
    if (!(g.owners || []).every(function(spec) {
      var map = G.mapData || G.map || {}, rs = map.regions || [];
      var r = rs.find(function(x) { return x && x.id === spec.regionId; });
      return r && (r.controller || r.owner) === spec.factionId;
    })) return false;
    return true;
  }
  function amount(v) { need(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9, '支出数额无效'); return v; }
  function restoreObject(target, source) {
    Object.keys(target).forEach(function(k) { if (!Object.prototype.hasOwnProperty.call(source, k)) delete target[k]; });
    Object.keys(source).forEach(function(k) {
      var next = source[k];
      if (next && typeof next === 'object' && target[k] && typeof target[k] === 'object' && Array.isArray(next) === Array.isArray(target[k])) restoreObject(target[k], next);
      else target[k] = clone(next);
    });
    if (Array.isArray(source)) target.length = source.length;
  }
  function capture(G) { var s = {}; snapshots.forEach(function(k) { s[k] = { had: Object.prototype.hasOwnProperty.call(G, k), value: clone(G[k]) }; }); return s; }
  function restore(G, state) {
    snapshots.forEach(function(k) { var s = state[k]; if (!s.had) delete G[k]; else if (G[k] && typeof G[k] === 'object' && s.value && typeof s.value === 'object') restoreObject(G[k], s.value); else G[k] = clone(s.value); }); // arch-ok: 同步场景事务失败时恢复已捕获的参与子树；前向更新走各子系统写口。
  }
  function prepare(event, branch) {
    var G = global.GM, costs = { money: 0, grain: 0, cloth: 0 }, actions = branch.runtimeActions || [], plans = [];
    need(G && guard(event), '当事人、任职或管辖已变化，请重新议处');
    need(typeof global._rigidHistoryConditionHolds !== 'function' || global._rigidHistoryConditionHolds(event), '本案条件尚未满足');
    need(Array.isArray(actions) && actions.length <= 16, '分支操作清单无效');
    var seen = {};
    actions.forEach(function(a) {
      need(a && typeof a.type === 'string', '缺少操作类型');
      var p = { spec: a };
      if (a.type === 'spend') {
        need(global.FiscalEngine && typeof global.FiscalEngine.trySpendFromGuoku === 'function', '国库支出接口尚未就绪');
        p.amounts = {};
        kinds.forEach(function(k) { p.amounts[k] = amount(a.amounts && a.amounts[k] !== undefined ? a.amounts[k] : 0); costs[k] += p.amounts[k]; });
      } else if (a.type === 'armyArrears') {
        need(global.MilitarySystems && typeof global.MilitarySystems.settleArmyArrears === 'function', '军饷结算接口尚未就绪');
        var ar = one('armies', a.armyId);
        need(ar && !ar.destroyed && ar.faction === playerFaction(), '部队已撤销或不属当前玩家');
        need(!ar.commanderId || living(one('chars', ar.commanderId)), '部队指挥者已不在任');
        need(!seen['army:' + ar.id], '同一部队不能重复申请补饷'); seen['army:' + ar.id] = true;
        p.army = ar;
        p.months = Math.min(Math.max(0, Math.round(Number(ar.payArrearsMonths) || 0)), Math.round(amount(a.months)));
        p.amounts = {};
        kinds.forEach(function(k) {
          var field = 'monthly' + k.charAt(0).toUpperCase() + k.slice(1) + 'PayPerSoldier';
          var fallback = { money: 0.5, grain: 0.3, cloth: 0.02 }[k];
          var rate = ar[field] == null ? fallback : amount(Number(ar[field]));
          p.amounts[k] = Math.max(0, Math.round((Number(ar.soldiers) || 0) * rate * p.months)); costs[k] += p.amounts[k];
        });
      } else if (a.type === 'taxRate') {
        need(global.FiscalEngine && typeof global.FiscalEngine.applyPlayerTaxReform === 'function', '税制接口尚未就绪');
        var cfg = G.fiscalConfig && G.fiscalConfig.taxList ? G.fiscalConfig : global.P && global.P.fiscalConfig;
        need(cfg && (cfg.taxList || []).some(function(t) { return t.id === a.taxId; }), '对应税目已被撤销');
        need(typeof a.rate === 'number' && a.rate >= 0 && a.rate <= 1 && Number.isFinite(a.rate), '税率无效');
        need(!seen['tax:' + a.taxId], '同一税目不能重复调整'); seen['tax:' + a.taxId] = true;
      } else if (a.type === 'classChange') {
        need(TM.ClassEngine && typeof TM.ClassEngine.applyClassChange === 'function', '阶层接口尚未就绪');
        p.cls = one('classes', a.classId);
        need(p.cls && p.cls.faction === playerFaction(), '受影响阶层不属本局玩家');
        need(typeof a.satisfaction === 'number' && Math.abs(a.satisfaction) <= 12 && Number.isFinite(a.satisfaction), '阶层变化超出幅度');
      } else if (a.type === 'proposal') {
        need(TM.FactionDiplomacy && typeof TM.FactionDiplomacy.recordProposals === 'function', '交涉接口尚未就绪');
        p.from = one('facs', playerFaction()); p.to = one('facs', a.factionId);
        need(p.from && p.to && p.from.id !== p.to.id, '交涉对象无效');
        need(['deal','ultimatum','joint_action'].indexOf(a.proposalType) >= 0, '交涉类型无效');
        need(typeof a.terms === 'string' && a.terms.length > 0 && a.terms.length <= 60, '交涉条款过长或为空');
      } else if (a.type === 'factionDelivery') {
        need(TM.FactionNpcGuoku && typeof TM.FactionNpcGuoku.transferToPlayer === 'function','方镇交付接口尚未就绪');
        p.from=one('facs',a.factionId);p.proposal=proposalFrom(a.proposalEventId,a.factionId);
        need(p.from && p.from.id!==playerFaction() && p.proposal && p.proposal.status==='accepted','本次输纳尚未得到对方同意');
        need(!p.proposal._settledResourceTransferId,'同一回书已经办理交付');
        p.amounts={};kinds.forEach(function(k){p.amounts[k]=amount(a.amounts && a.amounts[k]!==undefined?a.amounts[k]:0);need(Number(p.from.treasury && p.from.treasury[k])>=p.amounts[k],'对方现有钱粮不足，交付未完成');});
      } else throw Error('不支持的操作类型：' + a.type);
      plans.push(p);
    });
    kinds.forEach(function(k) {
      if (!costs[k]) return;
      var account = G.guoku || {}, ledger = account.ledgers && account.ledgers[k], stock = ledger && Number(ledger.stock);
      need(Number.isFinite(stock) && stock >= costs[k], '国库' + ({ money:'钱',grain:'粮',cloth:'帛' }[k]) + '不足，本次操作未执行');
      if (Number.isFinite(Number(account[k]))) need(Number(account[k]) >= costs[k], '国库账目尚需同步');
    });
    Object.keys(branch.impact || {}).forEach(function(k) { need(G.vars && G.vars[k] && typeof branch.impact[k] === 'number' && Number.isFinite(branch.impact[k]), '分支进度变量无效：' + k); });
    return { costs: costs, plans: plans };
  }
  function apply(event, branch) {
    var G = global.GM || {}, record = G.triggeredHistoryEvents && G.triggeredHistoryEvents[event.id];
    if (record && record.decision) return { ok: true, duplicate: true, receipt: clone(record.decision) };
    if (!record) return { ok: false, error: '本案尚未送达，不能提前执行' };
    var state, prep;
    try {
      prep = prepare(event, branch); state = capture(G);
      var receipts = [];
      prep.plans.forEach(function(p) {
        var a = p.spec, result;
        if (a.type === 'spend') result = global.FiscalEngine.trySpendFromGuoku({ amounts: p.amounts, requireFullAmount: true, sinkTag: a.reason || event.name, gameRef: G });
        else if (a.type === 'armyArrears') result = global.MilitarySystems.settleArmyArrears(p.army, { months: p.months });
        else if (a.type === 'taxRate') result = global.FiscalEngine.applyPlayerTaxReform({ op: 'rate', taxId: a.taxId, rate: a.rate });
        else if (a.type === 'classChange') result = TM.ClassEngine.applyClassChange(G, p.cls, { name:p.cls.name, satisfaction_delta:a.satisfaction, reason:a.reason || event.name }, { source:'scenario-decision', turn:G.turn });
        else if (a.type === 'proposal') {
          result = TM.FactionDiplomacy.recordProposals(p.from, [{ toFactionId:p.to.id, toFaction:p.to.name, type:a.proposalType, terms:a.terms, rationale:a.reason || event.name }], G.turn || 1);
          need(result && result.recorded === 1, '交涉文书未送达'); result.ok = true;
          var prop=(p.to._incomingProposals || []).filter(function(x){return x.fromId===p.from.id && x.terms===a.terms && x.turn===(G.turn||1);}).pop();
          need(prop,'交涉收讫不存在');result.proposalId=prop.id;result.targetId=p.to.id;
        }
        else if(a.type==='factionDelivery')result=TM.FactionNpcGuoku.transferToPlayer({factionId:p.from.id,proposalId:p.proposal.id,amounts:p.amounts,transferId:event.id+':'+branch.id,reason:a.reason||event.name});
        need(result && result.ok === true, '操作未完成：' + a.type);
        receipts.push({ type:a.type, result:clone(result) });
      });
      Object.keys(branch.impact || {}).forEach(function(k) { var v = G.vars[k]; v.value = Math.max(v.min == null ? 0 : v.min, Math.min(v.max == null ? 100 : v.max, Number(v.value || 0) + branch.impact[k])); }); // arch-ok: 历史事件原生写口在操作成功后提交已校验的政策变量与进度。
      var decision = { schema:'tm-scenario-decision/1', branchId:branch.id, turn:G.turn || 1, costs:prep.costs, operations:receipts };
      G.triggeredHistoryEvents[event.id].decision = decision; // arch-ok: 本历史事件模块独占已触发事件的选择收讫，防重复办理。
      return { ok:true, receipt:clone(decision) };
    } catch (error) { if (state) restore(G, state); return { ok:false, error:error.message || String(error) }; }
  }
  function resolveIssue(issue, index) {
    var G = global.GM || {};
    if (!issue || issue._scenarioSid !== G.sid || issue.status === 'resolved') return { ok:false, error:'要务不属于当前局或已完成' };
    var event = (G.rigidHistoryEvents || []).find(function(e) { return e && e.id === issue._scenarioEventId; });
    if (!event || !event.branches || !event.branches[index]) return { ok:false, error:'原始分支不存在' };
    if(!guard(event)) {
      issue.status='withdrawn';issue.withdrawnTurn=G.turn||1;issue.withdrawalReason='当事人、任职或管辖已变化，原案停止照原条件办理。';
      if(typeof global.toast==='function')global.toast(issue.withdrawalReason);
      return {ok:false,withdrawn:true,error:issue.withdrawalReason};
    }
    var outcome = global.applyEventBranch(event.id, index);
    if (!outcome || !outcome.ok) return outcome;
    issue.status = 'resolved'; issue.resolvedTurn = G.turn || 1; issue.chosenOption = index; issue.chosenText = event.branches[index].name;
    issue.executionReceipt = clone(outcome.receipt); return outcome;
  }
  function formatReceipt(receipt) {
    if(!receipt)return '';
    var out=[];var costs=receipt.costs||{};
    if(kinds.some(function(k){return costs[k]>0;}))out.push('已从国库支付：'+kinds.filter(function(k){return costs[k]>0;}).map(function(k){return ({money:'钱',grain:'粮',cloth:'帛'}[k])+costs[k];}).join('、'));
    (receipt.operations||[]).forEach(function(op){var r=op.result||{};
      if(op.type==='armyArrears')out.push('已清欠饷'+r.monthsCleared+'个月');
      if(op.type==='taxRate'&&r.change)out.push(r.change.name+'已改为原税率的'+Math.round(r.change.newRate/Math.max(.000001,r.change.oldRate)*100)+'%');
      if(op.type==='classChange'&&r.applied)out.push(r.className+'满意度'+(r.applied.satisfaction>=0?'+':'')+r.applied.satisfaction);
      if(op.type==='proposal')out.push('交涉文书已送达，等待对方答复');
      if(op.type==='factionDelivery')out.push('已收到'+r.factionName+'交付的钱粮，双方库存同步扣增');
    });return out.length?'\n\n【本次办理收讫】'+out.join('；')+'。':'';
  }
  TM.ScenarioEffects = { version:1, guard:guard, prepare:prepare, apply:apply, resolveIssue:resolveIssue, formatReceipt:formatReceipt };
})(typeof window !== 'undefined' ? window : globalThis);
