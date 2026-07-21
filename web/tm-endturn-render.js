// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// EndTurn 渲染模块（从 tm-endturn.js 拆分）
// 包含：_endTurn_render, Delta面板, 角色高亮, 信息源渲染
// Requires: tm-endturn.js (must load before this file)
//
// 2026-07-06 重做：弹窗 HTML 组装全部迁至 tm-endturn-shiji-compose.js（御览分卷）。
// 本文件保留：渲染前清洗（_unescNarr/死亡过滤/年号）·全部副作用（digest/风闻转录/shijiHistory 落账/
// 起居注/清输入/快照/自动存档/回合收尾）。组装函数纯读零写·弹窗结构见 compose 文件头。
// Domain: 回合结果展示 (战况 / 兵备 / 财政 / 起居)
// Refactor notes:
//   Phase 3·**Codex own·Claude review at merge** (我刚 #5 加 affectedArmies/militarySystems)
//   Phase 5·namespace TM.Endturn.Render
// 见 web/docs/architecture-map.md §1 行 7
//   §8 [L1300] 自动存档触发 + meta 写入
//   §9 [L1600] 角色高亮工具 + 史官弹窗
// ============================================================

function _clearPreEndturnMarkerAfterSave(expectedId) {
  try {
    if (expectedId == null) expectedId = (typeof window !== 'undefined') ? window._tmActivePreEndturnSnapshotId : '';
    var raw = localStorage.getItem('tm_pre_endturn_mark');
    var marker = raw ? JSON.parse(raw) : null;
    // 异步旧 autosave 不得清掉后起回合的 marker。
    if (expectedId && marker && marker.snapshotId && marker.snapshotId !== expectedId) return false;
    localStorage.removeItem('tm_pre_endturn_mark');
    if (typeof window !== 'undefined') window._tmActivePreEndturnSnapshotId = '';
    return true;
  } catch (_) { return false; }
}

// 世界态变更摘要——把本回合 turnChanges（已满）+ 当下势力虚实压成一小段纯文本，
// 存 GM._lastTurnDigest，供下回合 tm-endturn-prompt.js 层1 注入给 AI。
// 朝代中立：只读 name/owner/strength/morale/soldiers 等通用运行时字段，不写死任何朝代专名。
function buildWorldChangeDigest() {
  if (typeof GM === 'undefined' || !GM) return '';
  var tc = GM.turnChanges;
  var CAP = 5;
  var sections = [];

  // 1. 疆土易主（map 桶：扁平 {regionName, field, oldValue, newValue, reason}）
  if (tc && Array.isArray(tc.map) && tc.map.length) {
    var terr = [];
    tc.map.forEach(function(m) {
      if (m && m.field === 'owner') {
        terr.push('· ' + (m.regionName || m.regionId || '某地') + '：' + (m.oldValue || '无主') + '→' + (m.newValue || '无主') + (m.reason ? '（' + m.reason + '）' : ''));
      }
    });
    if (terr.length) sections.push('疆土易主：\n' + terr.slice(0, CAP).join('\n'));
  }

  // 2. 兵势骤变（military 桶：{name, changes:[{field:'soldiers', oldValue, newValue}]}）
  if (tc && Array.isArray(tc.military) && tc.military.length) {
    var troops = [];
    tc.military.forEach(function(mc) {
      if (!mc || !Array.isArray(mc.changes)) return;
      mc.changes.forEach(function(ch) {
        if (ch && ch.field === 'soldiers') {
          var d = (ch.newValue || 0) - (ch.oldValue || 0);
          if (d !== 0) troops.push({ name: mc.name, d: d });
        }
      });
    });
    troops.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    if (troops.length) {
      sections.push('兵势骤变：\n' + troops.slice(0, CAP).map(function(t) {
        return '· ' + t.name + ' 兵力' + (t.d > 0 ? '+' : '') + t.d;
      }).join('\n'));
    }
  }

  // 3. 势力消长（factions 桶：{name, changes:[{field:'strength', oldValue, newValue}]}）
  if (tc && Array.isArray(tc.factions) && tc.factions.length) {
    var facd = [];
    tc.factions.forEach(function(fc) {
      if (!fc || !Array.isArray(fc.changes)) return;
      fc.changes.forEach(function(ch) {
        if (ch && ch.field === 'strength') {
          var d = (ch.newValue || 0) - (ch.oldValue || 0);
          if (d !== 0) facd.push({ name: fc.name, d: d });
        }
      });
    });
    facd.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    if (facd.length) {
      sections.push('势力消长：\n' + facd.slice(0, CAP).map(function(f) {
        return '· ' + f.name + ' 实力' + (f.d > 0 ? '+' : '') + f.d;
      }).join('\n'));
    }
  }

  // 4. 当下虚实（运行时 GM.facs：濒崩者点名——供 AI 识别可乘之机；字段对齐 prompt 运行时态块）
  if (Array.isArray(GM.facs) && GM.facs.length) {
    var weak = [];
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      if (f._collapsing) weak.push('· ' + f.name + '【濒临崩溃】实力' + (f.strength || 0) + '·民心' + (f.morale || 0));
    });
    if (weak.length) sections.push('当下虚实：\n' + weak.slice(0, CAP).join('\n'));
  }

  if (!sections.length) return '';
  return '【上一回合天下变动】（据此判断时局与战机）\n' + sections.join('\n');
}

function _endTurn_render(shizhengji, zhengwen, playerStatus, playerInner, edicts, xinglu, oldVars, changeReportHtml, queueResult, suggestions, tyrantResult, turnSummary, shiluText, szjTitle, szjSummary, personnelChanges, hourenXishuo, recordLineage) {
  // 本地获取结束回合按钮（旧代码曾引用闭包外 btn，导致 ReferenceError）
  var btn = (typeof _$ === 'function' ? (_$("btn-end") || _$("btn-end-turn")) : null);
  if (!btn) btn = { textContent:'', style:{} };  // stub，防止 btn.textContent 抛错
  // 默认参数兼容（旧版调用者未传新参数时不崩）
  shiluText = shiluText || '';
  szjTitle = szjTitle || '';
  szjSummary = szjSummary || '';
  personnelChanges = personnelChanges || [];
  hourenXishuo = hourenXishuo || zhengwen || '';
  // ★2026-07-01·归一叙事里的字面转义(agent 模式常见坑):AI 把段落分隔写成字面 "\n\n"、或过度转义 \\n/\\"·
  //   JSON.parse 后仍是「字面反斜杠+n」→ 渲染直出 "\n\n"/误显英文 n·且下方时政记 split(/\n{2,}/) 按真换行
  //   分段失效→整段糊成一坨。此处统一转真换行/引号(所有来源:agent finalize/deepen、LLM 管线、史记回放共此入口)。
  //   纯文本清洗·不改结构;正常路径(已是真换行)无字面转义→全 no-op·零回归。
  var _unescNarr = function (s) {
    return String(s == null ? '' : s)
      .replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  };
  shizhengji = _unescNarr(shizhengji);
  zhengwen = _unescNarr(zhengwen);
  shiluText = _unescNarr(shiluText);
  hourenXishuo = _unescNarr(hourenXishuo);
  playerStatus = _unescNarr(playerStatus);
  playerInner = _unescNarr(playerInner);
  turnSummary = _unescNarr(turnSummary);
  szjSummary = _unescNarr(szjSummary);
  // 1.4 措施4: 死亡角色二次过滤——标记叙事中已死角色的主动行为
  if (GM.chars && zhengwen) {
    var _deadNames = GM.chars.filter(function(c) { return c.alive === false && c.dead; }).map(function(c) { return c.name; });
    _deadNames.forEach(function(dn) {
      if (dn.length < 2) return;
      // 匹配"死者+主动动词"模式并加注
      var _activePattern = new RegExp('(' + dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(说|曰|奏|上书|进言|率军|带领|发兵|下令|命令|宣布)', 'g');
      zhengwen = zhengwen.replace(_activePattern, '[$1(已故)]$2');
    });
    // 对后人戏说同样过滤
    if (hourenXishuo) {
      _deadNames.forEach(function(dn) {
        if (dn.length < 2) return;
        var _ap = new RegExp('(' + dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(说|曰|奏|上书|进言|率军|带领|发兵|下令|命令|宣布)', 'g');
        hourenXishuo = hourenXishuo.replace(_ap, '[$1(已故)]$2');
      });
    }
  }
  // 动态更新年号
  (function(){
    // 年号系统始终启用
    var t=P.time;
    var _diEra=(typeof calcDateFromTurn==='function')?calcDateFromTurn(GM.turn||1):null;
    var _dpvEra=(typeof _getDaysPerTurn==='function')?_getDaysPerTurn():30;
    var y=_diEra?_diEra.adYear:((t.year||0)+Math.floor(((GM.turn||1)-1)*_dpvEra/365));
    var mo=_diEra?_diEra.lunarMonth:(t.startMonth||1);
    var eraList=GM.eraNames||[];
    var best=null;
    eraList.forEach(function(e){
      if(!e||!e.name)return;
      var ey=e.startYear||0;var em=e.startMonth||1;
      if(y>ey||(y===ey&&mo>=em)){
        if(!best||ey>best.startYear||(ey===best.startYear&&em>best.startMonth))best=e;
      }
    });
    if(best)GM.eraName=best.name;
  })();

  // 世界态变更摘要：此刻 turnChanges 已满（reset→AI→apply 之后），压成纯文本存住，供下回合喂 AI
  try { GM._lastTurnDigest = buildWorldChangeDigest(); }
  catch (_wcdE) { GM._lastTurnDigest = ''; if (window.TM && TM.errors) TM.errors.capture(_wcdE, 'endturn.worldChangeDigest'); }

  // 一句话总曰·供弹窗头部 tr-summary-bar 与 shijiHistory.turnSummary（弹窗内容已分卷·见 tm-endturn-shiji-compose.js）
  var _summaryText = turnSummary || '';
  // 若AI未返回turn_summary，从时政记首句自动截取
  if (!_summaryText && shizhengji) {
    var _firstSentence = shizhengji.split(/[。！\n]/)[0];
    _summaryText = _firstSentence || '';
  }
  // 群臣动向→风闻录事（每条 NPC 事件写入 GM._fengwenRecord）
  // ※ 奏疏类(奏/谏/弹劾/上书/疏/表)走正常奏疏系统·不入风闻
  // ※ 只收录 4 类：密札(密谋)/耳报(私交)/军情(军事动向)/风议(舆论)
  try {
    if (GM.evtLog) {
      var _npcEvtsFw = GM.evtLog.filter(function(e) { return e.type === 'NPC自主' && e.turn === GM.turn - 1; });
      if (_npcEvtsFw.length > 0) {
        if (!GM._fengwenRecord) GM._fengwenRecord = [];
        _npcEvtsFw.forEach(function(e) {
          var _t = e.text || '';
          // 奏疏类完全跳过（已由奏疏系统处理）
          if (/奏|谏|弹劾|上书|疏|表奏|上表|题奏|参劾/.test(_t)) return;
          var _type = null;
          if (/密|暗|谋|阴|贿|收买|拉拢|勾结|串/.test(_t)) _type = '密札';
          else if (/结交|拜|宴|盟|联姻|访|攀交|门生|座师/.test(_t)) _type = '耳报';
          else if (/军|兵|战|攻|守|练|征|讨|调兵|点卯|调遣/.test(_t)) _type = '军情';
          else if (/私议|流言|传|说|闲谈|窃语/.test(_t)) _type = '风议';
          if (!_type) return; // 不分类·不收录
          GM._fengwenRecord.push({
            type: _type, text: _t,
            credibility: 0.75, turn: GM.turn - 1, source: 'npc_action'
          });
        });
      }
    }
  } catch(_fwE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fwE, 'shiji→fengwen] NPC evts 转录失败') : console.warn('[shiji→fengwen] NPC evts 转录失败', _fwE); }

  // 史记弹窗·御览分卷组装（tm-endturn-shiji-compose.js·2026-07-06 重做）——
  // 组装为纯函数（读 GM/P·零写入）·素材已经上方 _unescNarr 清洗+死亡过滤·副作用（digest/风闻/落账/存档）全留本函数
  var shijiHtml = (typeof _composeShijiHtml === 'function')
    ? _composeShijiHtml({
        shizhengji: shizhengji,
        playerStatus: playerStatus,
        playerInner: playerInner,
        oldVars: oldVars,
        tyrantResult: tyrantResult,
        shiluText: shiluText,
        szjTitle: szjTitle,
        szjSummary: szjSummary,
        personnelChanges: personnelChanges,
        hourenXishuo: hourenXishuo
      })
    : '<div style="padding:1rem;line-height:1.8;white-space:pre-wrap;">' + escHtml(shizhengji || turnSummary || '') + '</div>';

  // shijiHistory存完整HTML + 所有结构化字段（供史记回顾和后续兼容）
  var _fullHtml = shijiHtml;
  // 收集本回合玩家下的诏令（edicts 参数存的是按分类的原文）
  var _thisTurnEdicts = edicts || {};
  var _lineageBasisRefs = [];
  try {
    if (recordLineage && Array.isArray(recordLineage.basis_refs)) _lineageBasisRefs = recordLineage.basis_refs;
    else if (recordLineage && Array.isArray(recordLineage.basisRefs)) _lineageBasisRefs = recordLineage.basisRefs;
  } catch(_) { _lineageBasisRefs = []; }
  var _recordMeta = null;
  var _evidenceRefs = [];
  try {
    if (window.TM && TM.MemorySourceBound && typeof TM.MemorySourceBound.buildRecordMetadata === 'function') {
      _recordMeta = TM.MemorySourceBound.buildRecordMetadata(GM, {
        type: 'shijiHistory',
        turn: GM.turn - 1,
        text: [shizhengji, zhengwen, shiluText, szjTitle, szjSummary, turnSummary].filter(Boolean).join('\n'),
        authority: 'official_record',
        visibility: 'public',
        role: 'record',
        lane: 'L6_retrieved_evidence',
        aiBasisRefs: _lineageBasisRefs,
        maxBasisRefs: 24
      });
      _evidenceRefs = _recordMeta.basisRefs;
    } else if (window.TM && TM.MemoryEvidenceRegistry && typeof TM.MemoryEvidenceRegistry.buildBasisRefs === 'function') {
      _evidenceRefs = TM.MemoryEvidenceRegistry.buildBasisRefs(GM, { maxRefs: 16 });
    }
  } catch(_) { _evidenceRefs = []; }
  GM.shijiHistory.push({
    id: _recordMeta && _recordMeta.id,
    turn: GM.turn-1, time: getTSText(GM.turn-1),
    shizhengji: shizhengji, zhengwen: zhengwen,
    playerStatus: playerStatus, playerInner: playerInner,
    turnSummary: _summaryText,
    // 新增字段
    shilu: shiluText, szjTitle: szjTitle, szjSummary: szjSummary,
    personnel: personnelChanges, houren: hourenXishuo,
    sourceType: 'official_record',
    authorityLevel: 'official_record',
    confidence: 0.72,
    sourceRefs: _recordMeta ? _recordMeta.sourceRefs : [],
    basisRefs: _recordMeta ? _recordMeta.basisRefs : _evidenceRefs,
    evidenceRefs: _evidenceRefs,
    contentHash: _recordMeta && _recordMeta.contentHash,
    basisMaxAuthorityRank: _recordMeta && _recordMeta.basisMaxAuthorityRank,
    generatedBy: 'endturn.sc1d',
    factStatus: 'recorded_turn',
    edicts: _thisTurnEdicts,  // 保留玩家诏令全文以便史记回顾+下回合 AI 上下文
    html: _fullHtml
  });
  if (GM.shijiHistory.length > 200) GM.shijiHistory.splice(0, GM.shijiHistory.length - 200); // arch-ok·史记封顶防长局存档膨胀·生成式 cap（同文件 _factionHistory/_metricHistory）
  // 6.5: 每回合一句话摘要存入年度素材
  if (!GM._yearlyDigest) GM._yearlyDigest = [];
  GM._yearlyDigest.push({turn: GM.turn-1, summary: _summaryText || (shizhengji||'').split(/[\u3002\n]/)[0] || ''});
  // 按年度清理（只保留当年）
  var _yTurns = (typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12;
  if (GM._yearlyDigest.length > _yTurns * 2) GM._yearlyDigest = GM._yearlyDigest.slice(-_yTurns);
  // 纪传体：记录月度摘要
  // 编年史草稿：优先使用实录(正式体)+时政记；后人戏说作为辅助材料
  // 实录本就是正史体，最适合喂给编年体系统；否则回落到shizhengji+zhengwen
  var _chrSummary = shiluText || shizhengji || '';
  var _chrDetail = shizhengji || '';
  if (_chrDetail && _chrDetail === _chrSummary) _chrDetail = zhengwen || ''; // 避免重复
  ChronicleSystem.addMonthDraft(GM.turn-1, _chrSummary, _chrDetail);

  // 8. 写入起居注
  if(!GM.qijuHistory)GM.qijuHistory=[];
  var _qijuMeta = null;
  try {
    if (window.TM && TM.MemorySourceBound && typeof TM.MemorySourceBound.buildRecordMetadata === 'function') {
      _qijuMeta = TM.MemorySourceBound.buildRecordMetadata(GM, {
        type: 'qijuHistory',
        turn: GM.turn - 1,
        text: zhengwen || '',
        authority: 'official_record',
        visibility: 'public',
        role: 'record',
        lane: 'L6_retrieved_evidence',
        aiBasisRefs: _lineageBasisRefs,
        fallbackBasisRefs: _recordMeta && _recordMeta.sourceRefs || [],
        maxBasisRefs: 16
      });
    }
  } catch(_) { _qijuMeta = null; }
  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
    id: _qijuMeta && _qijuMeta.id,
    turn:GM.turn-1,time:getTSText(GM.turn-1),zhengwen:zhengwen,
    sourceType: 'official_record',
    authorityLevel: 'official_record',
    confidence: 0.72,
    sourceRefs: _qijuMeta ? _qijuMeta.sourceRefs : [],
    basisRefs: _qijuMeta ? _qijuMeta.basisRefs : [],
    evidenceRefs: _qijuMeta ? _qijuMeta.basisRefs : [],
    contentHash: _qijuMeta && _qijuMeta.contentHash,
    factStatus: 'recorded_narrative',
    generatedBy: 'endturn.render'
  });
  renderQiju();

  // 9. 清空输入
  ["edict-pol","edict-mil","edict-dip","edict-eco","edict-oth","xinglu","xinglu-pub","xinglu-prv"].forEach(function(id){var el=_$(id);if(el)el.value="";});
  try { if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.clearEdictDrafts === 'function') window.TMPhase8FormalBridge.clearEdictDrafts(); } catch(_) {}

  // 10. 问对：保留聊天记录（跨回合持久），刷新角色列表，关闭弹窗
  renderWenduiChars();
  var _wdm=_$('wendui-modal');if(_wdm)_wdm.remove();

  // 11. 新回合奏疏
  generateMemorials();

  // 11.5/11.6 自然死亡和空缺检查已在 Step 6.90-6.91 中执行，此处不再重复

  // 11b. 快照当前值用于下回合delta显示
  GM._prevVars = {};
  Object.entries(GM.vars||{}).forEach(function(e) { GM._prevVars[e[0]] = e[1].value; });
  // 动态快照所有核心指标（供 Delta 面板比较）
  var _cmlKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];

  // 9.4: 记录核心指标历史快照（供结局统计画曲线）
  if (!GM._metricHistory) GM._metricHistory = [];
  var _snap = {turn: GM.turn - 1};
  _cmlKeys.forEach(function(k) { if (typeof GM[k] === 'number') _snap[k] = Math.round(GM[k]); });
  // 同时记录vars中的核心变量
  Object.entries(GM.vars||{}).forEach(function(e) {
    if (e[1].isCore || (typeof CORE_METRIC_LABELS === 'object' && CORE_METRIC_LABELS[e[0]])) {
      _snap[e[0]] = Math.round(e[1].value);
    }
  });
  GM._metricHistory.push(_snap);
  if (GM._metricHistory.length > 500) GM._metricHistory = GM._metricHistory.slice(-500);
  _cmlKeys.forEach(function(k) { if (typeof GM[k] === 'number') GM['_prev_' + k] = GM[k]; });

  // 11b. 势力历史快照（每回合记录各势力状态，供AI分析趋势）
  if (GM.facs && GM.facs.length > 0) {
    if (!GM._factionHistory) GM._factionHistory = [];
    var _fSnapshot = { turn: GM.turn, factions: {} };
    GM.facs.forEach(function(f) {
      _fSnapshot.factions[f.name] = {
        strength: f.strength || 50,
        military: f.militaryStrength || 0,
        attitude: f.attitude || '',
        leader: f.leader || ''
      };
    });
    GM._factionHistory.push(_fSnapshot);
    // 只保留最近10回合快照
    if (GM._factionHistory.length > 10) GM._factionHistory.shift();
  }

  // 性能·_turnReport 无界增长裁剪（渲染只读当回合/上回合·见 954/1572）·防越玩越卡时 deepClone/序列化/遍历越来越重
  if (GM._turnReport && GM._turnReport.length > 600) GM._turnReport = GM._turnReport.slice(-600);
  // 性能·jishiRecords（push 尾插·读取端只取近 50）无写入端 cap·尾部环形裁剪（qijuHistory 已在 npc-driver/news-bridge slice(0,200) 受控·不重复裁）
  if (GM.jishiRecords && GM.jishiRecords.length > 400) GM.jishiRecords = GM.jishiRecords.slice(-400);
  // 史料权威补全(纪事)·议政记录皆实录→信史·confidence 按 mode/泄密分级·供史册库权威钤印/置信
  if (Array.isArray(GM.jishiRecords)) GM.jishiRecords.forEach(function(_r){ if (_r && !_r.authorityLevel){ _r.authorityLevel = 'official_record'; _r.confidence = (_r.leaked || _r.secret) ? 0.55 : (_r.mode === 'private' ? 0.68 : 0.78); } });
  // 12. 更新界面·renderBiannian/renderOfficeTree/renderShijiList 已由 renderGameState 内部重渲·去冗余整树重建（性能）
  renderGameState();

  // 13. 显示史记弹窗
  hideLoading();
  showTurnResult(shijiHtml, GM.shijiHistory.length - 1);

  // 7.2: 预加载——玩家阅读回合结果时预构建固定层prompt缓存
  setTimeout(function() {
    if (typeof PromptLayerCache !== 'undefined' && PromptLayerCache.preload) {
      PromptLayerCache.preload();
    }
  }, 500);

  // 释放延迟toast（成就等在settlement期间积攒的提示）
  if (GM._pendingToasts && GM._pendingToasts.length > 0) {
    GM._pendingToasts.forEach(function(msg, i) { setTimeout(function(){ toast(msg); }, 500 + i * 800); });
    GM._pendingToasts = [];
  }

  // 13a. 每回合自动存档到IndexedDB（静默，不弹toast）
  if (typeof TM_SaveDB !== 'undefined' && typeof _prepareGMForSave === 'function') {
    // detached save 任务必须绑定发起它的局/回合/pre_endturn 快照；读档或下一回合开始后，旧任务不得再落库/改 marker/index。
    var _endturnSaveGM = GM;
    var _endturnSaveP = P;
    var _endturnSaveLoadGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
    var _endturnSaveTurn = GM.turn;
    var _endturnSaveSid = GM.sid;
    var _endturnSavePreId = (typeof window !== 'undefined' && window._tmActivePreEndturnSnapshotId) || '';
    var _endturnSaveStillCurrent = function() {
      var _liveGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
      var _livePreId = (typeof window !== 'undefined' && window._tmActivePreEndturnSnapshotId) || '';
      return GM === _endturnSaveGM && P === _endturnSaveP
        && _liveGen === _endturnSaveLoadGen
        && GM.turn === _endturnSaveTurn && GM.sid === _endturnSaveSid
        // autosave 成功清 marker 后 active id 为空仍属本任务；后起回合会换成另一个非空 id。
        && (!_livePreId || _livePreId === _endturnSavePreId);
    };
    (async function() {
      try {
        if (typeof _awaitPostTurnJobsForSave === 'function') await _awaitPostTurnJobsForSave(typeof _postTurnSaveRequiredIds === 'function' ? _postTurnSaveRequiredIds() : ['sc25', 'sc25c']);
        if (!_endturnSaveStillCurrent()) return;
        // 问天·兑现对账（刀A·flag 默认 OFF·同回合幂等）——放推演各 pass 落定后、autosave 前·结果随档入库
        try { if (typeof _wtRunFulfillAudit === 'function') _wtRunFulfillAudit(); } catch (_wtFaHkE) {}
        _prepareGMForSave();
        if (!_endturnSaveStillCurrent()) return;
    // A-1·端回合自动封存·统一 snapshot builder·保持 IDB {GM,P} 格式
    var _autoT0 = Date.now();
    var _autoState = _buildSaveState({format:'idb',prepare:false,gm:_endturnSaveGM,p:_endturnSaveP});
    var _autoSnapMs = Date.now() - _autoT0;
    if (_autoSnapMs > 800) console.warn('[AutoSave] 端回合 snapshot 耗 '+_autoSnapMs+'ms·考虑 A-2');
    var _sc3 = typeof findScenarioById === 'function' ? findScenarioById(_endturnSaveSid) : null;
    var _autoMeta = {
      name: '自动封存·' + (typeof getTSText==='function'?getTSText(_endturnSaveTurn):'T'+_endturnSaveTurn),
      type: 'auto',
      turn: _endturnSaveTurn,
      scenarioName: _sc3 ? _sc3.name : '',
      eraName: _endturnSaveGM.eraName || ''
    };
    var _autoWriteOptions = { writeGuard: _endturnSaveStillCurrent };
    // 写入 autosave（页面刷新恢复用）+ slot_0（案卷目录显示用）
    TM_SaveDB.save('autosave', _autoState, _autoMeta, _autoWriteOptions).then(function(ok) {
      // ★ 推演成功且本回合 autosave 已落库·才清 pre_endturn 崩溃标记——旧写法在 async IIFE 外同步删·
      // 等后台 job+落库的数十秒窗口内闪退=mark 已删而新档未写·重启不弹恢复·静默回滚上一回合
      // (安卓 OOM 闪退史正踩此窗·2026-07-04 审查定罪)。写失败则 mark 留着·下次启动照常弹恢复=保守正确。
      // SaveDB 以 resolve(false) 表示 IDB/localStorage/quota/事务失败，并不会 reject；必须显式判真。
      if (ok !== true) throw new Error('autosave 未落库·保留 pre_endturn 恢复标记');
      if (!_endturnSaveStillCurrent()) return;
      if (!_clearPreEndturnMarkerAfterSave(_endturnSavePreId)) return;
      // 轻量刷新标记必须描述已经落库的 autosave，且使用本次快照元数据，不能读取晚到回调时的 live GM。
      try {
        localStorage.setItem('tm_autosave_mark', JSON.stringify({
          turn: _autoMeta.turn, timestamp: Date.now(),
          scenarioName: _autoMeta.scenarioName,
          eraName: _autoMeta.eraName
        }));
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-render');}catch(_){}}
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'AutoSave] autosave写入失败:') : console.warn('[AutoSave] autosave写入失败:', e); });
    TM_SaveDB.save('slot_0', _autoState, _autoMeta, _autoWriteOptions).then(function(ok) {
      if (ok !== true) throw new Error('slot_0 未落库·不更新案卷索引');
      if (!_endturnSaveStillCurrent()) return;
      if (typeof _updateSaveIndex === 'function') _updateSaveIndex(0, _autoMeta);
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'AutoSave] slot_0写入失败:') : console.warn('[AutoSave] slot_0写入失败:', e); });
    // ★ 推演成功完成·清除 pre_endturn 标记(标记存在=崩溃信号·见 tm-endturn-core.js)
    // IDB 中的 pre_endturn 不删·下次回合开始时自动覆盖·留作"上回合操作快照"应急
      } catch(e) { console.warn('[AutoSave] post-turn save failed:', e); }
    })();
  } else {
    // 无 IDB 环境保留旧语义：mark 在此环境本也不会被 core 设置·同步清掉防误弹
    _clearPreEndturnMarkerAfterSave();
  }

  // 13b. 写入每回合完整数据（多文件结构）
  if(window.tianming&&window.tianming.isDesktop&&GM.saveName){
    try{
      // 主上下文
      var turnCtx={turn:GM.turn-1,time:getTSText(GM.turn-1),shizhengji:shizhengji,zhengwen:zhengwen,playerStatus:playerStatus,playerInner:playerInner,vars:deepClone(GM.vars),rels:deepClone(GM.rels),chars:deepClone(GM.chars),officeTree:deepClone(GM.officeTree||[]),families:GM.families?deepClone(GM.families):null,harem:GM.harem?deepClone(GM.harem):null};
      // 玩家操作
      var playerInput={edicts:edicts,xinglu:xinglu,memorialResponses:(GM.memorials||[]).map(function(m){return{from:m.from,type:m.type,status:m.status,reply:m.reply};}),tyrantActivities:GM._turnTyrantActivities||[]};
      // AI推演全部结果（从GM临时存储中提取）
      try {
        if (window.TM && TM.MemoryTrace && typeof TM.MemoryTrace.finalizeTurnTrace === 'function') {
          var _mtTrace = TM.MemoryTrace.finalizeTurnTrace(GM);
          if (_mtTrace && _mtTrace.summary && typeof recordMemoryDiagnostic === 'function') {
            recordMemoryDiagnostic('trace', { status: 'finalized', summary: _mtTrace.summary });
          }
        }
      } catch(_mtE) {}
      var aiResults=GM._turnAiResults||{};
      // 变量变化
      var varChanges={_timeScale: P.time ? P.time.perTurn : '1m', _customDays: P.time ? P.time.customDays : null};
      Object.entries(GM.vars).forEach(function(e){
        var d=e[1].value-(oldVars[e[0]]||0);
        if(Math.abs(d)>=0.1) {
          var entry = {old:oldVars[e[0]]||0, now:e[1].value, delta:d};
          // 保留编辑者定义的单位信息
          var unit = e[1].unit || e[1].unitName || e[1].suffix || '';
          if (unit) entry.unit = unit;
          varChanges[e[0]] = entry;
        }
      });
      // 剧本快照（首回合）
      var scenarioData=null;
      var refTextData=null;
      if(GM.turn<=2){
        var _sc4=findScenarioById&&findScenarioById(GM.sid);
        if(_sc4) scenarioData=deepClone(_sc4);
        if(_sc4&&_sc4.refText) refTextData=_sc4.refText;
      }
      var turnData={context:turnCtx,playerInput:playerInput,aiResults:aiResults,varChanges:varChanges};
      if(scenarioData) turnData.scenario=scenarioData;
      if(refTextData) turnData.refText=refTextData;
      window.tianming.writeTurnData(GM.saveName,GM.turn-1,turnData).then(function(result){
        if (!(result && result.success === true)) throw new Error('回合分卷写入失败' + (result && result.error ? '：' + result.error : ''));
      }).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'catch] async:') : console.warn('[catch] async:', e); });
    }catch(e){ console.warn("[catch] \u9759\u9ED8\u5F02\u5E38:", e.message || e); }
    // Electron 崩溃恢复档只由 tm-save-lifecycle 的 60s 单写口维护；端回合不再并发写同一 __autosave__.json.tmp。
  }

  btn.textContent="\u23F3 \u9759\u5F85\u65F6\u53D8";btn.style.opacity="1";

  // 更新新UI的时间显示和变量显示
  if (typeof updateTimeDisplay === 'function') {
    updateTimeDisplay();
  }
  if (typeof updateTopVariables === 'function') {
    updateTopVariables();
  }

  // 存档写口已在 13a 统一完成；不再调用 SaveManager.autoSave 重复覆盖 slot_0。

  // 输出回合结算日志
  _dbg('========== 回合结算完成 (T' + GM.turn + ') ==========');
  _dbg('[endTurn] 财务报表:', (typeof AccountingSystem !== 'undefined' && AccountingSystem.getLedger) ? AccountingSystem.getLedger() : null);
  _dbg('[endTurn] 变动队列已清空，准备进入下一回合');
  try {
    var _aiDiag = GM._lastAIDiagnostics;
    if (_aiDiag && !_aiDiag._announced) {
      var _fw = Array.isArray(_aiDiag.failedWrites) ? _aiDiag.failedWrites.length : 0;
      var _warn = Array.isArray(_aiDiag.warnings) ? _aiDiag.warnings.length : 0;
      var _rep = Array.isArray(_aiDiag.repairedJson) ? _aiDiag.repairedJson.length : 0;
      if (_fw || _warn || _rep) {
        _dbg('[AIDiagnostics] hidden summary: write_gate=' + _fw + ', warnings=' + _warn + ', json_repair=' + _rep);
        _aiDiag._announced = true;
      }
    }
  } catch(_aiDiagE) { console.warn('[AIDiagnostics] render summary failed:', _aiDiagE); }

  // 更新地图颜色（根据占领者实时更新）
  if (P.map && P.map.enabled) {
    updateMapColors();
  }
}
