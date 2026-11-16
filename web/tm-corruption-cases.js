// ═══ 巨石拆分(20260706)：corruption 案件库/风闻/巨额支出(原 P2·B 子 IIFE) ═══
// 依赖 tm-corruption-engine.js(须先装载)。跨 IIFE 裸名 syncIndexFromSubDepts 已加 CorruptionEngine. 前缀。 装载序契约见 lint-split-contracts。原 tm-corruption-engine.js 2490 行·R9 三 IIFE 合并已倒回三片。
// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 腐败系统 P2 扩展
// 依赖：tm-corruption-engine.js
//
// ⚠ 补丁分类（2026-04-24 R12 评估）：MIXED
//   · APPEND 部分：EXPOSURE_CASES/generateExposureCase/applyCaseHandling
//                  /pushLumpSumIncident/markAsRecentAppointment/snapshotHistory
//   · OVERRIDE 部分：CorruptionEngine.tick（覆盖 engine 原 tick）
//   覆盖链：engine v1 → p2 v2 → p4 v3（最终版）
//   合并指引见 PATCH_CLASSIFICATION.md · Corruption 段
//
// 实现：
//   - §6.1 揭发事件库（25 条历史案件 + handlingOptions）
//   - §2.9 接口 pushLumpSumIncident（供诏令系统推入巨额支出）
//   - §9.7 风闻四类（风议/密札/耳报）的补全
//   - 新官 isRecentAppointment 标记 + 自动衰减
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof CorruptionEngine === 'undefined') {
    console.warn('[corruption-p2] CorruptionEngine 未加载，P2 跳过');
    return;
  }

  function safe(v, def) { return (v === undefined || v === null) ? (def || 0) : v; }

  // 民心走 MinxinLedger 总闸(2026-07-04 收口)·同 p1 的 _mxApply(多 IIFE 各一份·作用域隔离)
  function _mxApply(delta, reason, kind) {
    if (!delta) return;
    try {
      var L = (typeof TM !== 'undefined' && TM.MinxinLedger) || global.MinxinLedger;
      if (L && L.recordAndApply) L.recordAndApply(global.GM, { sourceSystem: 'corruption-engine', kind: kind || 'corruption', delta: delta, reason: reason });
    } catch (_e) {}
  }

  // ═════════════════════════════════════════════════════════════
  // §6.1 揭发事件库（25 条）
  // ═════════════════════════════════════════════════════════════

  // 标准处置选项模板（省代码）
  function _optStrict() {
    return { id:'strict', label:'三法司严审',
             cost:{ partyStrife:+20, stress:+15 },
             benefit:{ corruption:-10, minxin:+3, huangwei:+4 },
             historical:'交三法司会审，以儆效尤' };
  }
  function _optModerate() {
    return { id:'moderate', label:'查办首恶',
             cost:{ partyStrife:+8 },
             benefit:{ corruption:-5, minxin:+1 },
             historical:'惩首不及众' };
  }
  function _optCoverUp() {
    return { id:'cover', label:'下不为例',
             cost:{ huangwei:-5, huangquan:-3 },
             benefit:{ partyStrife:-5 },
             historical:'以朝局为重，和光同尘' };
  }
  function _optLeaveItAlone() {
    return { id:'leave', label:'留中不发',
             cost:{ huangwei:-2 },
             benefit:{},
             historical:'扣压奏疏，不予处置' };
  }

  // 案件库
  var EXPOSURE_CASES = [
    // ── 地方类 ──
    { id:'riverWork', name:'河工银被侵案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:50 }, severity:'major',
      evidence:'堤坝决口、账册亏缺、工匠口供',
      suspects:['workMinister','regionalOfficial'],
      textFn:function(d){ return '河工案：' + d.amount + '两工银被克，堤坝甫就即溃'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'magistrateExtortion', name:'知府勒索案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:55 }, severity:'moderate',
      evidence:'民告状、账册、证人',
      suspects:['prefect'],
      textFn:function(d){ return '某府知府岁敛民财' + d.amount + '两，百姓告至京师'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'reliefDiverted', name:'赈灾截留案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:55, hasFamine:true }, severity:'major',
      evidence:'赈银账册、灾民证词、仓粮实核',
      suspects:['regionalOfficial','granaryOfficer'],
      textFn:function(d){ return '灾区赈银' + d.amount + '两被层层截留，饥民呼号'; },
      options:[_optStrict(),
        { id:'dispatch', label:'遣钦差赈济', cost:{ guoku:-80000 },
          benefit:{ corruption:-8, minxin:+10 }, historical:'钦差复赈，以安民心' },
        _optCoverUp()] },

    { id:'fuShouOverage', name:'浮收加派案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:55 }, severity:'moderate',
      evidence:'税单对照、民间实缴凭证',
      suspects:['regionalOfficial'],
      textFn:function(d){ return '某省浮收加派，民实缴' + d.amount + '两，官府仅入三成'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'frontierPostBully', name:'驿站敲诈案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:50 }, severity:'minor',
      evidence:'过客申诉、驿马账',
      suspects:['postmaster'],
      textFn:function(d){ return '驿站敲诈过往官差' + d.amount + '文，商旅不行'; },
      options:[_optModerate(), _optLeaveItAlone(),
        { id:'replace', label:'更换驿官', cost:{}, benefit:{ corruption:-2 } }] },

    // ── 中央类 ──
    { id:'examBribery', name:'科场贿赂案', dept:'central',
      trigger:{ dept:'central', minTrue:50, examYear:true }, severity:'major',
      evidence:'考生笔迹、主考家宅查抄',
      suspects:['examMinister','hanlin'],
      textFn:function(d){ return '科场案：举子行贿' + d.amount + '两得第，京师哗然'; },
      options:[
        { id:'behead', label:'两主考斩决', cost:{ huangwei:-3, partyStrife:+10 },
          benefit:{ corruption:-15, minxin:+5, huangwei:+8 },
          historical:'清丁酉、咸丰顺天科场案均有主考斩决' },
        _optModerate(), _optCoverUp()] },

    { id:'sellOffice', name:'卖官鬻爵案', dept:'central',
      trigger:{ dept:'central', minTrue:50, hasSellOffice:true }, severity:'major',
      evidence:'授官名录、收银账册',
      suspects:['nepotist','courtFavorite'],
      textFn:function(d){ return '朝中有卖官案，某员鬻银' + d.amount + '两授某职'; },
      options:[_optStrict(),
        { id:'stop', label:'立即罢捐纳', cost:{ guoku:-50000 },
          benefit:{ corruption:-10, minxin:+5 }, historical:'停办捐纳' },
        _optCoverUp()] },

    { id:'workshopLoss', name:'工部营造损耗案', dept:'central',
      trigger:{ dept:'central', minTrue:50 }, severity:'moderate',
      evidence:'物料账与实核差距、督工口供',
      suspects:['workMinister'],
      textFn:function(d){ return '工部营造损耗' + d.amount + '两，虚报冒领'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'examSelling', name:'学政卖题案', dept:'central',
      trigger:{ dept:'central', minTrue:55, hasJudicial:true }, severity:'major',
      evidence:'试题流出、考生证词',
      suspects:['examMinister'],
      textFn:function(d){ return '学政鬻题' + d.amount + '两，士林哗然'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'bribedInvestigator', name:'钦差贪污案', dept:'central',
      trigger:{ dept:'central', minTrue:60 }, severity:'major',
      evidence:'同行供词、行李察验',
      suspects:['imperialCommissioner'],
      textFn:function(d){ return '钦差巡抚受贿' + d.amount + '两，反助地方掩饰'; },
      options:[
        { id:'execute', label:'立斩钦差', cost:{ partyStrife:+15 },
          benefit:{ corruption:-12, huangwei:+5 } },
        _optStrict(), _optCoverUp()] },

    // ── 军事类 ──
    { id:'militaryPayCut', name:'军饷克扣案', dept:'military',
      trigger:{ dept:'military', minTrue:50 }, severity:'major',
      evidence:'士卒喧哗、营中告举',
      suspects:['militaryMinister','general'],
      textFn:function(d){ return '某营军饷被克' + d.amount + '两，士气动摇'; },
      options:[_optStrict(),
        { id:'makeup', label:'补发饷银', cost:{ guoku:-100000 },
          benefit:{ corruption:-6, armyMorale:+10 }, historical:'迅速补发以安军心' },
        _optCoverUp()] },

    { id:'ghostMuster', name:'卫所吃空额案', dept:'military',
      trigger:{ dept:'military', minTrue:55 }, severity:'moderate',
      evidence:'点兵实核、粮饷账',
      suspects:['weisoCommander'],
      textFn:function(d){ return '某卫名册五千，实员不及三千，冒支饷银' + d.amount + '两'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'borderPayCut', name:'边饷克扣案', dept:'military',
      trigger:{ dept:'military', minTrue:60, hasWar:true }, severity:'major',
      evidence:'戍卒哗变、账目查勘',
      suspects:['borderGeneral'],
      textFn:function(d){ return '九边饷银被克' + d.amount + '两，戍卒几欲哗变'; },
      options:[
        { id:'urgent', label:'急发帑银', cost:{ guoku:-200000 },
          benefit:{ corruption:-10, armyMorale:+15, huangwei:+5 } },
        _optStrict(), _optCoverUp()] },

    { id:'weaponFraud', name:'军械伪劣案', dept:'military',
      trigger:{ dept:'military', minTrue:50 }, severity:'moderate',
      evidence:'战场遗器、匠人供词',
      suspects:['workMinister','armorer'],
      textFn:function(d){ return '所进军械多为伪劣，工部侵银' + d.amount + '两'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    // ── 税司类 ──
    { id:'saltGangCollusion', name:'盐商勾结案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:55 }, severity:'major',
      evidence:'盐引簿册、商账相校',
      suspects:['saltCommissioner','merchant'],
      textFn:function(d){ return '盐政与商勾连，漏税' + d.amount + '两'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'tollPostGreased', name:'钞关私肥案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:50 }, severity:'moderate',
      evidence:'过关账目、商队证言',
      suspects:['tollOfficer'],
      textFn:function(d){ return '某钞关私收' + d.amount + '两，过商不收印'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'grainTransportFraud', name:'漕运舞弊案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:55 }, severity:'major',
      evidence:'漕船察验、仓粮实核',
      suspects:['grainCommissioner'],
      textFn:function(d){ return '漕运舞弊，缺粮' + d.amount + '石'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'mintEmbezzle', name:'铸局贪墨案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:55 }, severity:'moderate',
      evidence:'铜铅出入账、钱样实验',
      suspects:['mintOfficer'],
      textFn:function(d){ return '宝泉/宝源局贪墨铜铅' + d.amount + '斤，铸钱成色不足'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'treasuryShortage', name:'府库亏空案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:60 }, severity:'major',
      evidence:'历年账簿盘点',
      suspects:['fiscalMinister','regionalOfficial'],
      textFn:function(d){ return '某府库亏空' + d.amount + '两，历任累积'; },
      options:[
        { id:'pursue', label:'追究历任',
          cost:{ partyStrife:+15 }, benefit:{ corruption:-8, guoku:+50000 } },
        _optModerate(), _optCoverUp()] },

    // ── 司法类 ──
    { id:'wrongfulDeath', name:'冤狱血案', dept:'judicial',
      trigger:{ dept:'judicial', minTrue:50 }, severity:'major',
      evidence:'翻案供词、尸检复勘',
      suspects:['prefect','judge'],
      textFn:function(d){ return '某冤案枉死' + d.amount + '人，尸骨未寒'; },
      options:[
        { id:'rehab', label:'平反昭雪',
          cost:{ partyStrife:+10 }, benefit:{ corruption:-6, minxin:+8, huangwei:+6 } },
        _optModerate(), _optCoverUp()] },

    { id:'barmanBribe', name:'讼师贿买案', dept:'judicial',
      trigger:{ dept:'judicial', minTrue:55 }, severity:'minor',
      evidence:'讼师账、当事人证词',
      suspects:['barman'],
      textFn:function(d){ return '讼师行贿' + d.amount + '两买通刑房'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'judgeFavoritism', name:'提刑徇私案', dept:'judicial',
      trigger:{ dept:'judicial', minTrue:55 }, severity:'moderate',
      evidence:'判决对照、受贿账',
      suspects:['judge'],
      textFn:function(d){ return '提刑司徇私枉法，轻纵要犯' + d.amount + '人'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    // ── 内廷类 ──
    { id:'eunuchLand', name:'宦官侵田案', dept:'imperial',
      trigger:{ dept:'imperial', minTrue:55 }, severity:'major',
      evidence:'田亩登记、佃户告举',
      suspects:['dominantEunuch'],
      textFn:function(d){ return '宦官某侵占田' + d.amount + '亩，民失其业'; },
      options:[
        { id:'execute', label:'诛之抄其家',
          cost:{ huangquan:-3, partyStrife:+5 },
          benefit:{ corruption:-12, huangwei:+10, guoku:+500000 },
          historical:'明代对宦官侵田者抄家追田' },
        _optModerate(), _optCoverUp()] },

    { id:'imperialRelativeEstate', name:'外戚侵占案', dept:'imperial',
      trigger:{ dept:'imperial', minTrue:55 }, severity:'major',
      evidence:'田契比对、亲友指证',
      suspects:['imperialRelative'],
      textFn:function(d){ return '外戚某侵占良田' + d.amount + '亩，百姓流离'; },
      options:[_optStrict(),
        { id:'redeem', label:'逼令退田', cost:{ huangquan:-2 },
          benefit:{ corruption:-8, minxin:+5 } },
        _optCoverUp()] },

    { id:'innerTreasuryTheft', name:'内帑侵吞案', dept:'imperial',
      trigger:{ dept:'imperial', minTrue:60 }, severity:'major',
      evidence:'内府账目查审',
      suspects:['chiefEunuch','consortFather'],
      textFn:function(d){ return '内府盘点，内帑被侵' + d.amount + '两'; },
      options:[
        { id:'purge', label:'尽逐宦官外戚',
          cost:{ huangquan:-5, partyStrife:+10 },
          benefit:{ corruption:-15, neitang:+200000, huangwei:+8 } },
        _optStrict(), _optCoverUp()] }
  ];

  // 从库中选合适案件
  function pickExposureCase() {
    if (typeof GM === 'undefined' || !GM.corruption) return null;
    var c = GM.corruption;
    var candidates = EXPOSURE_CASES.filter(function(tpl) {
      if (!tpl.trigger) return true;
      var t = tpl.trigger;
      var dept = c.subDepts[t.dept];
      if (!dept) return false;
      if (t.minTrue && dept.true < t.minTrue) return false;
      if (t.hasFamine && !(GM.activeDisasters && GM.activeDisasters.length > 0)) return false;
      if (t.hasWar && !(GM.activeWars && GM.activeWars.length > 0)) return false;
      if (t.hasSellOffice && !(GM.juanna && GM.juanna.active)) return false;
      if (t.examYear && !GM.currentExamYear) return false;
      if (t.hasJudicial && c.subDepts.judicial.true < 40) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 生成具体案件
  function generateExposureCase() {
    var tpl = pickExposureCase();
    if (!tpl) return null;
    var amount = Math.floor(10000 + Math.random() * 200000);
    var caseObj = {
      id: tpl.id + '_' + GM.turn + '_' + Math.random().toString(36).slice(2, 5),
      templateId: tpl.id,
      name: tpl.name,
      dept: tpl.dept,
      severity: tpl.severity,
      evidence: tpl.evidence,
      suspects: tpl.suspects || [],
      amount: amount,
      text: tpl.textFn ? tpl.textFn({ amount: amount }) : tpl.name,
      options: tpl.options,
      status: 'pending',
      turn: GM.turn,
      // 6 月后过期（按当前刻度换算）
      expireTurn: GM.turn + ((typeof turnsForMonths === 'function') ? turnsForMonths(6) : 6)
    };
    GM.corruption.activeCases = GM.corruption.activeCases || [];
    GM.corruption.activeCases.push(caseObj);

    // 记入风闻录事（告状类）
    if (typeof addEB === 'function') {
      var cred = caseObj.severity === 'major' ? 'high' :
                 caseObj.severity === 'moderate' ? 'medium' : 'low';
      addEB('告状', caseObj.text, {
        credibility: cred,
        ref: caseObj.id
      });
    }
    return caseObj;
  }

  // 应用处置选项
  function applyCaseHandling(caseId, optionId) {
    var cases = (GM.corruption && GM.corruption.activeCases) || [];
    var cIdx = -1;
    for (var i = 0; i < cases.length; i++) {
      if (cases[i].id === caseId) { cIdx = i; break; }
    }
    if (cIdx < 0) return { success: false, reason: '案件已结或不存在' };
    var caseObj = cases[cIdx];
    var opt = (caseObj.options || []).find(function(o) { return o.id === optionId; });
    if (!opt) return { success: false, reason: '选项不存在' };

    var cost = opt.cost || {};
    var ben = opt.benefit || {};

    // 应用代价（扣）
    if (cost.partyStrife && GM.partyStrife !== undefined) GM.partyStrife = Math.min(100, GM.partyStrife + cost.partyStrife);
    if (cost.huangquan && GM.huangquan) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('factionConsuming', -Math.abs(cost.huangquan), '\u6574\u8083\u4ee3\u4ef7');
      } else {
        GM.huangquan.index = Math.max(0, GM.huangquan.index - Math.abs(cost.huangquan));
      }
    }
    if (cost.huangwei && GM.huangwei) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('courtScandal', -Math.abs(cost.huangwei), '整肃代价·朝局震动');
      } else GM.huangwei.index = Math.max(0, GM.huangwei.index - Math.abs(cost.huangwei)); // 沙箱回退
    }
    if (cost.minxin) _mxApply(-Math.abs(cost.minxin), '惩贪行动波及地方');
    if (cost.guoku && typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) FiscalEngine.spendFromGuoku({ money: Math.abs(cost.guoku) }, '惩贪行动'); // 收口·走真账
    if (cost.stress) { /* player stress — hook */ }

    // 应用收益
    if (ben.corruption && caseObj.dept && GM.corruption.subDepts[caseObj.dept]) {
      GM.corruption.subDepts[caseObj.dept].true = Math.max(0,
        GM.corruption.subDepts[caseObj.dept].true + ben.corruption);
    }
    if (ben.minxin) _mxApply(ben.minxin, '惩贪见效·民心称快');
    if (ben.huangwei && GM.huangwei) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('executeRebelMinister', ben.huangwei, '惩贪奏效·朝纲肃然');
      } else GM.huangwei.index = Math.min(100, GM.huangwei.index + ben.huangwei); // 沙箱回退
    }
    if (ben.huangquan && GM.huangquan) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('personalRule', ben.huangquan, '\u6574\u8083\u594f\u6548');
      } else {
        GM.huangquan.index = Math.min(100, GM.huangquan.index + ben.huangquan);
      }
    }
    if (ben.guoku && typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) FiscalEngine.addToGuoku({ money: ben.guoku }, '追赃入库'); // 收口·走真账
    if (ben.neitang && GM.neitang) {
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToNeitang) FiscalEngine.addToNeitang({ money: ben.neitang }, '追赃入帑'); // 收口·走真账
      else GM.neitang.balance += ben.neitang; // 沙箱兜底
    }
    if (ben.partyStrife && GM.partyStrife !== undefined) GM.partyStrife = Math.max(0, GM.partyStrife + ben.partyStrife);
    if (ben.armyMorale && GM.armies) {
      GM.armies.forEach(function(a) { a.morale = Math.min(100, (a.morale || 50) + ben.armyMorale); });
    }

    // 关闭案件，挪入历史
    caseObj.status = 'resolved';
    caseObj.resolvedTurn = GM.turn;
    caseObj.resolvedAction = optionId;
    cases.splice(cIdx, 1);
    GM.corruption.history.exposedCases.push(caseObj);
    if (GM.corruption.history.exposedCases.length > 160) GM.corruption.history.exposedCases = GM.corruption.history.exposedCases.slice(-160); // 完整案件对象·单条体积最大·封顶
    CorruptionEngine.syncIndexFromSubDepts('\u8150\u8d25\u6848\u5904\u7f6e');

    if (typeof addEB === 'function') {
      addEB('朝代', '「' + caseObj.name + '」：' + opt.label, {
        credibility: 'high', ref: caseObj.id
      });
    }
    return { success: true, case: caseObj, option: opt };
  }

  // 案件过期处理（玩家不理）
  function expireOldCases() {
    if (!GM.corruption || !GM.corruption.activeCases) return;
    var active = GM.corruption.activeCases;
    var remaining = [];
    for (var i = 0; i < active.length; i++) {
      var c = active[i];
      if (c.expireTurn && GM.turn > c.expireTurn) {
        c.status = 'expired';
        c.resolvedTurn = GM.turn;
        // 不处理的后果：民心 -2，皇威 -1，腐败略升
        _mxApply(-2, '贪案悬而不决·民怨积');
        if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
          global.AuthorityEngines.adjustHuangwei('idleGovern', -1, '贪案悬而不决');
        } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 1); // 沙箱回退
        if (c.dept && GM.corruption.subDepts[c.dept]) {
          GM.corruption.subDepts[c.dept].true = Math.min(100, GM.corruption.subDepts[c.dept].true + 3);
        }
        GM.corruption.history.exposedCases.push(c);
        if (GM.corruption.history.exposedCases.length > 160) GM.corruption.history.exposedCases = GM.corruption.history.exposedCases.slice(-160);
        if (typeof addEB === 'function') {
          addEB('朝代', '「' + c.name + '」久未处置，民心离散', { credibility: 'medium' });
        }
      } else {
        remaining.push(c);
      }
    }
    GM.corruption.activeCases = remaining;
  }

  // ═════════════════════════════════════════════════════════════
  // §2.9 lumpSumIncident 推入 API（供诏令系统调用）
  // ═════════════════════════════════════════════════════════════

  var LUMP_TYPE_MULT = {
    infrastructure: 1.2, military: 1.15, reward: 0.8,
    relief: 1.1, ritual: 1.0, diplomacy: 0.9
  };
  var LUMP_DEPT_DIST = {
    infrastructure: { central:0.35, provincial:0.50, fiscal:0.15 },
    military:       { military:0.50, central:0.25, fiscal:0.25 },
    reward:         { imperial:0.50, central:0.30, fiscal:0.20 },
    relief:         { provincial:0.55, fiscal:0.30, central:0.15 },
    ritual:         { imperial:0.40, central:0.40, fiscal:0.20 },
    diplomacy:      { central:0.50, imperial:0.30, fiscal:0.20 }
  };

  function pushLumpSumIncident(spec) {
    CorruptionEngine.ensureModel();
    var annualIncome = (GM.guoku && GM.guoku.annualIncome) || 1e6;
    var ratio = (spec.amount || 0) / annualIncome;
    if (ratio < 0.05) return null;

    var base = 10 * Math.pow(Math.max(0.01, ratio - 0.04), 1.3);
    var layers = spec.executionLayers || 3;
    if (layers > 3) base *= (1 + (layers - 3) * 0.15);
    if (spec.urgent) base *= 1.25;
    base *= LUMP_TYPE_MULT[spec.type] || 1.0;

    var audit = safe(GM.corruption.supervision.level, 40);
    if (spec.hasDedicatedAudit)  audit += 25;
    if (spec.decreeHasOversight) audit += 15;
    if (spec.stagedApproval)     audit += 10;
    if (spec.publicTally)        audit += 10;
    var auditMult = Math.max(0.25, 1 - audit / 150);
    var totalCorr = base * auditMult;

    var deptDist = LUMP_DEPT_DIST[spec.type] || { central:0.4, provincial:0.3, fiscal:0.3 };
    var depts = {};
    for (var d in deptDist) depts[d] = totalCorr * deptDist[d];

    var incident = {
      id: 'incident_' + GM.turn + '_' + Math.random().toString(36).slice(2, 6),
      decreeId: spec.decreeId || null,
      name: spec.name || '某项大工',
      type: spec.type || 'infrastructure',
      amount: spec.amount,
      ratioToAnnual: ratio,
      peakCorruption: totalCorr,
      currentCorruption: totalCorr * 0.3,
      depts: depts,
      startTurn: GM.turn,
      expectedDuration: spec.durationMonths || 12,
      executionLayers: layers,
      urgent: spec.urgent || false,
      hasDedicatedAudit: spec.hasDedicatedAudit || false,
      decreeHasOversight: spec.decreeHasOversight || false,
      stagedApproval: spec.stagedApproval || false,
      publicTally: spec.publicTally || false,
      directPeopleBurden: spec.directPeopleBurden || false,
      status: 'active'
    };

    GM.corruption.lumpSumIncidents.push(incident);

    if (incident.directPeopleBurden) {
      _mxApply(-(ratio * 15), '贪弊直取于民');
    }

    if (typeof addEB === 'function') {
      addEB('事件', '大举兴工：' + incident.name + '（费银 ' + Math.round(incident.amount/10000) + ' 万两）', {
        credibility: 'high'
      });
    }
    return incident;
  }

  // ═════════════════════════════════════════════════════════════
  // §9.7 风闻录事四类自动生成（补全风议/密札/耳报）
  // ═════════════════════════════════════════════════════════════

  function _maybeGenerateRumor() {
    var c = GM.corruption;
    if (!c) return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);
    // 触发条件：中央腐败高 / 党争激烈 / 有名臣处于危机
    var prob = 0;
    if (c.subDepts.central.true > 50) prob += 0.1;
    if ((c.countermeasures.factionFeud || 0) > 0.3) prob += 0.15;
    if (c.entrenchedFactions.length > 0) prob += 0.1;
    prob *= mr;  // 月概率 → 回合概率
    if (prob <= 0 || Math.random() > prob) return;

    var templates = [
      '翰林私语：近日部堂某某家门若市',
      '士林风议：朝堂忠直者寥寥',
      '文苑讥评：奏疏多颂圣少言事',
      '清流叹息：今日之事不可言也',
      '坊间物议：某部堂近来与盐商往来甚密'
    ];
    var t = templates[Math.floor(Math.random() * templates.length)];
    if (typeof addEB === 'function') {
      addEB('风议', t, { credibility: 'low' });
    }
  }

  function _maybeGeneratePrivateLetter() {
    var chars = GM.chars || [];
    if (chars.length < 2) return;
    var rels = GM.rels || {};
    var relKeys = Object.keys(rels);
    if (relKeys.length === 0) return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);
    if (Math.random() > 0.1 * mr) return;

    var templates = [
      '御史某私札：恩师近因河工事忧虑不安',
      '门生私书：近日见恩相气色不佳',
      '同年私语：朝中风向不明，宜谨言慎行',
      '姻亲私书：家严闻陛下近事，卧病数日',
      '旧故私笺：同年之中敢进谏者几何？'
    ];
    var t = templates[Math.floor(Math.random() * templates.length)];
    if (typeof addEB === 'function') {
      addEB('密札', t, { credibility: 'medium' });
    }
  }

  function _maybeGenerateEavesdrop() {
    var insts = ((GM.corruption && GM.corruption.supervision && GM.corruption.supervision.institutions) || []);
    var spyInsts = insts.filter(function(i) {
      return i.name === '锦衣卫' || i.name === '东厂' || i.name === '西厂' || i.name === '提督太监';
    });
    if (spyInsts.length === 0) return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);

    // 每机构本回合尝试生成条数（与 radius 和 mr 成正比）
    spyInsts.forEach(function(inst) {
      var baseCount = Math.floor((inst.radius || 50) / 30) + 1;
      // 长回合应多生成
      var count = Math.min(10, Math.ceil(baseCount * Math.max(0.5, mr)));
      for (var i = 0; i < count; i++) {
        if (Math.random() > 0.35) continue;
        var templates = [
          '东厂呈：兵部侍郎某家中近添姬妾数人，园亭日盛',
          '锦衣卫启：户部尚书夜宴巨商，疑有勾结',
          '内监私启：某某私下通书外邦，可疑',
          '密探禀：吏部员外郎蓄养门客数十，动静不明',
          '侦缉报：某将领营中豪奢，疑克扣军饷自肥',
          '厂卫密启：某员近日频访宫闱外戚，意图不明'
        ];
        var t = templates[Math.floor(Math.random() * templates.length)];
        if (typeof addEB === 'function') {
          addEB('耳报', '[' + (inst.name || '厂卫') + '] ' + t, {
            credibility: 'biased',
            source: inst.id
          });
        }
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 新官 isRecentAppointment 标记
  // ═════════════════════════════════════════════════════════════

  function _appointmentFailure(reason, value) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[corruption-p2] 新官保护期参数无效:', reason, value);
    }
    return { ok: false, reason: reason };
  }

  function markCharAsRecentAppointment(ch) {
    if (!ch || typeof ch !== 'object') return _appointmentFailure('character-object-required', ch);
    if (!ch.id || typeof ch.id !== 'string') return _appointmentFailure('stable-id-required', ch);
    var roster = (GM && Array.isArray(GM.chars)) ? GM.chars : [];
    if (roster.indexOf(ch) < 0) return _appointmentFailure('character-not-in-world', ch.id);
    ch.isRecentAppointment = true;
    ch.appointedTurn = GM.turn;
    return { ok: true, charId: ch.id, appointedTurn: ch.appointedTurn };
  }

  function markAsRecentAppointmentById(charId) {
    if (typeof charId !== 'string' || !charId.trim()) return _appointmentFailure('stable-id-required', charId);
    var ch = (GM.chars || []).find(function(c) { return c && c.id === charId; });
    if (!ch) return _appointmentFailure('character-not-found', charId);
    return markCharAsRecentAppointment(ch);
  }

  function markAsRecentAppointment(charOrId) {
    if (typeof charOrId === 'string') return markAsRecentAppointmentById(charOrId);
    return markCharAsRecentAppointment(charOrId);
  }

  function decayRecentAppointments() {
    var chars = GM.chars || [];
    // 24 月 → 对应回合数（长回合少，短回合多）
    var decayTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(24) : 24;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch.isRecentAppointment && ch.appointedTurn !== undefined) {
        if (GM.turn - ch.appointedTurn > decayTurns) {
          ch.isRecentAppointment = false;
        }
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // §10.6 历史快照（供趋势图）
  // 每回合记录一次，保留最近 120 条
  // ═════════════════════════════════════════════════════════════

  function snapshotCorruptionHistory() {
    if (!GM.corruption) return;
    if (!GM.corruption.history) GM.corruption.history = {};
    if (!GM.corruption.history.snapshots) GM.corruption.history.snapshots = [];
    var sd = GM.corruption.subDepts;
    GM.corruption.history.snapshots.push({
      turn: GM.turn,
      trueIndex: Math.round(GM.corruption.trueIndex * 10) / 10,
      perceivedIndex: Math.round(GM.corruption.perceivedIndex * 10) / 10,
      depts: {
        central:    Math.round(sd.central.true),
        provincial: Math.round(sd.provincial.true),
        military:   Math.round(sd.military.true),
        fiscal:     Math.round(sd.fiscal.true),
        judicial:   Math.round(sd.judicial.true),
        imperial:   Math.round(sd.imperial.true)
      },
      supervision: Math.round((GM.corruption.supervision || {}).level || 0)
    });
    // 保留最近 120 条
    if (GM.corruption.history.snapshots.length > 120) {
      GM.corruption.history.snapshots = GM.corruption.history.snapshots.slice(-120);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 扩展 CorruptionEngine.tick
  // 保持原 tick 所有行为，追加 P2 动作
  // ═════════════════════════════════════════════════════════════

  var _origTick = CorruptionEngine.tick;
  CorruptionEngine.tick = function(context) {
    _origTick.call(this, context);

    // 过期案件处理
    try { expireOldCases(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] expireOldCases:') : console.error('[corruption-p2] expireOldCases:', e); }

    // 概率生成新案件（月概率 × 回合月数）
    try {
      var c = GM.corruption;
      var sup = safe(c.supervision.level, 40);
      var maxCorr = 0;
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
        if (c.subDepts[k].true > maxCorr) maxCorr = c.subDepts[k].true;
      });
      var _mr = (context && context._monthRatio) || (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1);
      var prob = (maxCorr - 40) / 100 * (sup / 100) * 0.4 * _mr;
      var activeCount = (c.activeCases || []).length;
      if (prob > 0 && activeCount < 5 && Math.random() < prob) {
        generateExposureCase();
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] case generation:') : console.error('[corruption-p2] case generation:', e); }

    // 风闻四类
    try { _maybeGenerateRumor(); }           catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] rumor:') : console.error('[corruption-p2] rumor:', e); }
    try { _maybeGeneratePrivateLetter(); }   catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] letter:') : console.error('[corruption-p2] letter:', e); }
    try { _maybeGenerateEavesdrop(); }       catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] eavesdrop:') : console.error('[corruption-p2] eavesdrop:', e); }

    // 新官标记衰减
    try { decayRecentAppointments(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] decayAppointments:') : console.error('[corruption-p2] decayAppointments:', e); }
    try { snapshotCorruptionHistory(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] snapshot:') : console.error('[corruption-p2] snapshot:', e); }
  };

  // ═════════════════════════════════════════════════════════════
  // 导出到 CorruptionEngine
  // ═════════════════════════════════════════════════════════════
  CorruptionEngine.EXPOSURE_CASES = EXPOSURE_CASES;
  CorruptionEngine.generateExposureCase = generateExposureCase;
  CorruptionEngine.applyCaseHandling = applyCaseHandling;
  CorruptionEngine.pushLumpSumIncident = pushLumpSumIncident;
  CorruptionEngine.markAsRecentAppointment = markAsRecentAppointment;
  CorruptionEngine.markAsRecentAppointmentById = markAsRecentAppointmentById;
  CorruptionEngine.markCharAsRecentAppointment = markCharAsRecentAppointment;
  CorruptionEngine.snapshotHistory = snapshotCorruptionHistory;

  console.log('[corruption-p2] 已加载：' + EXPOSURE_CASES.length + ' 条案件库 + lumpSum API + 风闻四类 + 新官标记');

})(typeof window !== 'undefined' ? window : this);
