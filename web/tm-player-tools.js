// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-f5-ui-ai.js — F 阶段 ⑤：玩家 UI + AI 赋能
 *
 * 补完：
 *  - F3 玩家 UI：军屯/改土/迁都/边疆/户口仪表盘 5 入口
 *  - F2 AI 赋能：主动奏疏/人口叙事/虚报判定/改革可行性
 *  - 诏令参考按钮集成（在诏令编辑框右下角）
 *  - 多意图拆分算法
 *  - 朝议强制触发接口
 *  - 年度赋役滑块 UI 触发时机
 *  - 制度志新 tab（史记子页）
 *  - 天时地利新 tab（史记子页）
 *  - 顶栏户口 hover 色目饼图/三分条/50年曲线
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  F3 玩家 UI 入口
  // ═══════════════════════════════════════════════════════════════════

  function openPlayerActionMenu() {
    var body = '<div style="max-width:600px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;letter-spacing:0.1em;">🎯 圣裁议题</div>';
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    body += _actionButton('military_farm',  '🌾 军屯设置',    '设立屯田卫所，自耕自食御边',  'PhaseF5.openMilitaryFarmUI()');
    body += _actionButton('gaitu_guiliu',    '🗻 改土归流',    '废土司设流官，收辖羁縻',      'PhaseF5.openGaituUI()');
    body += _actionButton('move_capital',    '🏯 迁都',         '徙国都以就要冲',              'PhaseF5.openMoveCapitalUI()');
    body += _actionButton('frontier_dev',    '🗺️ 边疆开发',    '垦荒戍边，实边固圉',          'PhaseF5.openFrontierUI()');
    body += _actionButton('huji_dashboard',  '📊 户口仪表盘',  '户籍总览+地域分布+曲线',     'PhaseF5.openHujiDashboard()');
    body += _actionButton('revolt',          '⚔ 民变干预',      '四策处置民变',               'PhaseD.openRevoltInterventionPanel()');
    body += _actionButton('annual_fuyi',     '📜 年度赋役',    '滑块调本年赋役基调',          'openAnnualFuyiPanel()');
    body += _actionButton('power_counter', _institutionalPowerCounterMode(global.GM)?'⚖️ 职掌与交接':'⚖️ 反击权臣', _institutionalPowerCounterMode(global.GM)?'拟议职掌与交割':'七策反击', 'PhaseF5.openPowerCounterUI()');
    body += '</div>';
    body += '</div>';
    _showModal(body, '圣裁议题', 620);
  }

  function _actionButton(id, label, hint, onClickExpr) {
    return '<button class="btn" style="font-size:0.78rem;padding:10px;text-align:left;border:1px solid var(--bdr);" onclick="' +
           onClickExpr + ';this.closest(\'div[style*=position]\').remove();">' +
      '<div style="color:var(--gold-300);font-size:0.86rem;">' + label + '</div>' +
      '<div style="color:#d4be7a;font-size:0.72rem;margin-top:2px;">' + hint + '</div>' +
    '</button>';
  }

  function openMilitaryFarmUI() {
    var body = '<div style="max-width:480px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">🌾 设立军屯</div>';
    body += '<div style="margin-bottom:10px;"><label>屯名：<input id="mf-name" type="text" placeholder="某屯" style="width:100%;padding:5px;"></label></div>';
    body += '<div style="margin-bottom:10px;"><label>辖区：<input id="mf-region" type="text" placeholder="陇右/河西/辽东" style="width:100%;padding:5px;"></label></div>';
    body += '<div style="margin-bottom:10px;"><label>田亩：<input id="mf-acres" type="number" placeholder="200000" value="200000" style="width:100%;padding:5px;"></label></div>';
    body += '<div style="margin-bottom:10px;"><label>戍卒：<input id="mf-garrison" type="number" placeholder="10000" value="10000" style="width:100%;padding:5px;"></label></div>';
    body += '<button class="btn" onclick="PhaseF5._submitMilitaryFarm()">立屯</button>';
    body += '</div>';
    _showModal(body, '军屯', 500);
  }

  function _submitMilitaryFarm() {
    var name = document.getElementById('mf-name').value || '新屯';
    var region = document.getElementById('mf-region').value || '某地';
    var acres = Number(document.getElementById('mf-acres').value) || 200000;
    var garrison = Number(document.getElementById('mf-garrison').value) || 10000;
    if (typeof global.PhaseB !== 'undefined') {
      global.PhaseB.registerMilitaryFarm({ name: name, region: region, acres: acres, garrison: garrison });
    }
    _closeAllF5Modals();
    if (global.toast) global.toast('已立 ' + name);
  }

  function openGaituUI() {
    var G = global.GM;
    var tusis = (G.population && G.population.jimiHoldings) || [];
    var body = '<div style="max-width:500px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">🗻 改土归流</div>';
    if (tusis.length === 0) {
      body += '<div style="color:#d4be7a;font-size:0.82rem;">当前无羁縻/土司可改流</div>';
    } else {
      body += '<div style="font-size:0.78rem;color:var(--gold-400);margin-bottom:4px;">选择欲废土司：</div>';
      tusis.forEach(function(t) {
        body += '<button class="btn" style="display:block;width:100%;padding:6px;margin-bottom:4px;text-align:left;" onclick="PhaseF5._submitGaitu(\''+t.id+'\')">';
        body += '<b>' + t.name + '</b>（' + t.mouths + ' 口，忠 ' + (t.loyalty||60) + '）';
        body += '</button>';
      });
    }
    body += '</div>';
    _showModal(body, '改土归流', 520);
  }

  function _submitGaitu(tusiId) {
    if (typeof global.EdictComplete !== 'undefined') {
      var G = global.GM;
      var tusi = (G.population && G.population.jimiHoldings || []).find(function(t){return t.id===tusiId;});
      if (tusi && typeof global.EdictComplete.P1_EDICT_TYPES !== 'undefined') {
        global.EdictComplete.P1_EDICT_TYPES.gaitu_guiliu.aiEntry({ targetTusi: tusi.name });
      }
    }
    _closeAllF5Modals();
    if (global.toast) global.toast('已推行改土归流');
  }

  function openMoveCapitalUI() {
    var body = '<div style="max-width:480px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">🏯 迁都</div>';
    body += '<div style="color:var(--vermillion-300);font-size:0.76rem;margin-bottom:8px;">⚠ 迁都影响重大，需廷议</div>';
    body += '<div style="margin-bottom:10px;"><label>新都名：<input id="mc-new" type="text" placeholder="长安/洛阳/开封/南京/北京" style="width:100%;padding:5px;"></label></div>';
    body += '<div style="margin-bottom:10px;"><label>期限（年）：<input id="mc-timeline" type="number" placeholder="5" value="5" style="width:100%;padding:5px;"></label></div>';
    body += '<button class="btn" onclick="PhaseF5._submitMoveCapital()">议迁</button>';
    body += '</div>';
    _showModal(body, '迁都', 500);
  }

  function _submitMoveCapital() {
    var newCap = document.getElementById('mc-new').value;
    if (!newCap) { if (global.toast) global.toast('未输入新都'); return; }
    var timeline = Number(document.getElementById('mc-timeline').value) || 5;
    if (typeof global.EdictComplete !== 'undefined' && global.EdictComplete.P1_EDICT_TYPES) {
      global.EdictComplete.P1_EDICT_TYPES.move_capital.aiEntry({ newCapital: newCap, timeline: timeline });
    }
    // 强制朝议
    triggerForcedCourtDiscussion('迁都', '迁都重大，廷议表决');
    _closeAllF5Modals();
  }

  function openFrontierUI() {
    var body = '<div style="max-width:480px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">🗺️ 边疆开发</div>';
    body += '<div style="margin-bottom:10px;"><label>区域：<input id="fr-region" type="text" placeholder="河西/安西/辽东/滇南" style="width:100%;padding:5px;"></label></div>';
    body += '<div style="margin-bottom:10px;"><label>类型：<select id="fr-type" style="width:100%;padding:5px;">';
    body += '<option value="tuntian">屯田</option><option value="garrison">戍军</option><option value="migration">移民实边</option>';
    body += '</select></label></div>';
    body += '<button class="btn" onclick="PhaseF5._submitFrontier()">开发</button>';
    body += '</div>';
    _showModal(body, '边疆开发', 500);
  }

  function _submitFrontier() {
    var region = document.getElementById('fr-region').value || '边疆';
    var type = document.getElementById('fr-type').value || 'tuntian';
    if (typeof global.EdictComplete !== 'undefined' && global.EdictComplete.P1_EDICT_TYPES) {
      global.EdictComplete.P1_EDICT_TYPES.frontier_dev.aiEntry({ frontierRegion: region, devType: type });
    }
    _closeAllF5Modals();
    if (global.toast) global.toast('开发 ' + region);
  }

  function openHujiDashboard() {
    var G = global.GM;
    var P = G.population;
    if (!P) { if (global.toast) global.toast('户口未初始化'); return; }
    var body = '<div style="max-width:680px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">📊 户口仪表盘</div>';
    // 总体
    if (P.national) {
      body += '<div style="background:var(--bg-2);padding:10px;border-radius:4px;margin-bottom:10px;">';
      body += '<div style="font-size:0.82rem;color:var(--gold-400);">全国</div>';
      body += '<div style="font-size:0.76rem;">户 ' + (P.national.households||0).toLocaleString() + ' | 口 ' + (P.national.mouths||0).toLocaleString() + ' | 丁 ' + (P.national.ding||0).toLocaleString() + '</div>';
      body += '</div>';
    }
    // 色目饼图
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">色目构成</div>';
    body += '<div style="background:var(--bg-2);padding:8px;border-radius:4px;margin-bottom:10px;font-size:0.74rem;">';
    Object.keys(P.byCategory || {}).forEach(function(c) {
      var v = P.byCategory[c];
      if (v && v.mouths > 0) {
        var pct = (P.national && P.national.mouths) ? (v.mouths / P.national.mouths * 100).toFixed(1) : 0;
        body += '<div style="margin:2px 0;">' + c + '：' + v.mouths.toLocaleString() + ' (' + pct + '%)</div>';
      }
    });
    body += '</div>';
    // 黄籍/逃户/隐户三分条
    var huangji = (P.byLegalStatus && P.byLegalStatus.huangji && P.byLegalStatus.huangji.mouths) || 0;
    var taoohu = (P.byLegalStatus && P.byLegalStatus.taoohu && P.byLegalStatus.taoohu.mouths) || 0;
    var hidden = P.hiddenCount || 0;
    var total = huangji + taoohu + hidden || 1;
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">户籍分布</div>';
    body += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;margin-bottom:10px;">';
    body += '<div style="background:var(--celadon-500);width:' + (huangji/total*100) + '%;" title="黄籍 ' + huangji + '"></div>';
    body += '<div style="background:var(--vermillion-400);width:' + (taoohu/total*100) + '%;" title="逃户 ' + taoohu + '"></div>';
    body += '<div style="background:var(--ink-600);width:' + (hidden/total*100) + '%;" title="隐户 ' + hidden + '"></div>';
    body += '</div>';
    body += '<div style="font-size:0.71rem;color:#d4be7a;margin-bottom:10px;">黄籍 ' + (huangji/total*100).toFixed(1) + '% | 逃户 ' + (taoohu/total*100).toFixed(1) + '% | 隐户 ' + (hidden/total*100).toFixed(1) + '%</div>';
    // 50 年曲线（若有归档）
    if (P.yearlyArchive && P.yearlyArchive.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">近 ' + P.yearlyArchive.length + ' 年人口曲线</div>';
      body += '<div style="background:var(--bg-2);padding:8px;border-radius:4px;font-size:0.71rem;">';
      P.yearlyArchive.slice(-10).forEach(function(y) {
        body += '<div>' + y.year + ': ' + (y.mouths||0).toLocaleString() + ' 口</div>';
      });
      body += '</div>';
    }
    body += '</div>';
    _showModal(body, '户口仪表盘', 700);
  }

  function _institutionalPowerCounterMode(G) {
    var pm=G&&G.huangquan&&G.huangquan.powerMinister;
    return !!(pm&&pm.mode==='institutional')||!!(global.AuthorityEngines&&global.AuthorityEngines.powerMinisterMode&&global.AuthorityEngines.powerMinisterMode(G)==='institutional');
  }
  function _powerCounterEscape(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function _renderInstitutionalPowerCounter(G) {
    var pm=G.huangquan.powerMinister,read=global.AuthorityEngines&&global.AuthorityEngines.readPowerMinisterStatus,state=read?read(pm,G):{},names=state.officeNames||[];
    var rows=[['secret_edict','密谕','另拟密谕，具明奉命之人与回报期限。'],['rotate_officials','核议任免','具名议调有关官员，查明接任与交割办法。'],['military_reform_against_pm','核议军权','按军逐一查议调发、印信与易帅交割。'],['court_spy','查问职掌','具明查问的人事与凭据，议定承办之人。'],['marriage_alliance','议婚','先议婚聘对象与礼数，再俟各方答复。'],['public_humiliation','召见申谕','拟定召见与申谕之言，听其当面陈奏。'],['execute_power_minister','勘问处置','具明案由、证据与审问办法，俟案情覆奏。']];
    var body='<div style="max-width:560px;font-family:inherit;"><div style="font-size:1rem;color:var(--gold-300);margin-bottom:0.6rem;">职掌与交接</div>';
    body+='<div style="font-size:0.82rem;line-height:1.8;margin-bottom:10px;"><b>'+_powerCounterEscape(pm.name||'掌事者')+'</b>'+(names.length?' · '+_powerCounterEscape(names.join('、')):'')+'<br>'+_powerCounterEscape(pm.description||'朝中职掌既有承袭，诏令施行须问承办，兵权更易须验交割。')+'</div>';
    body+='<div style="font-size:0.74rem;color:#d4be7a;margin-bottom:10px;">以下拟入诏意，具明承办与期限后，可再送有司议行。</div>';
    rows.forEach(function(r){body+='<button class="btn" style="display:block;width:100%;padding:8px;margin-bottom:4px;text-align:left;" onclick="PhaseD.invokeCounterStrategy(\''+r[0]+'\');"><b>'+r[1]+'</b><br><span style="color:#d4be7a;font-size:0.72rem;">'+r[2]+'</span></button>';});
    return body+'</div>';
  }

  function openPowerCounterUI() {
    var G = global.GM;
    if (!G||!G.huangquan || !G.huangquan.powerMinister) {
      if (global.toast) global.toast(_institutionalPowerCounterMode(G)?'朝中暂无待核的职掌处境':'朝中无权臣');
      return;
    }
    if(_institutionalPowerCounterMode(G)){_showModal(_renderInstitutionalPowerCounter(G),'职掌与交接',580);return;}
    var pm = G.huangquan.powerMinister;
    var COUNTER = (typeof global.PhaseD !== 'undefined' && global.PhaseD.COUNTER_STRATEGIES) || {};
    var body = '<div style="max-width:560px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.4rem;">⚖️ 反击权臣</div>';
    body += '<div style="padding:8px;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:4px;margin-bottom:10px;font-size:0.78rem;">';
    body += '权臣：<b>' + pm.name + '</b> · 控制力 ' + ((pm.controlLevel||0.3)*100).toFixed(0) + '% · 党羽 ' + (pm.faction||[]).length + ' 人';
    body += '</div>';
    Object.keys(COUNTER).forEach(function(sid) {
      var s = COUNTER[sid];
      body += '<button class="btn" style="display:block;width:100%;padding:8px;margin-bottom:4px;text-align:left;" onclick="PhaseD.invokeCounterStrategy(\''+sid+'\');this.closest(\'div[style*=position]\').remove();">';
      body += '<b>' + s.name + '</b><br>';
      body += '<span style="color:#d4be7a;font-size:0.72rem;">' + s.description + '</span>';
      body += '</button>';
    });
    body += '</div>';
    _showModal(body, '反击权臣', 580);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  制度志 tab（史记子页）
  // ═══════════════════════════════════════════════════════════════════

  function openInstitutionsChronicle() {
    var G = global.GM;
    // 形状归一：dynamicInstitutions 当前为数组表示（圣旨/AI 路径一致）；老档/异形可能存成对象池
    // {ministries,regions,militaryUnits}——与药丸条 _offDynamicInstitutionsPanel／皇权抽屉同一兜法，
    // 防对象上调 .forEach 抛错致整个弹窗空白（.length===undefined 静默消失）。
    var di = G.dynamicInstitutions;
    var insts = Array.isArray(di) ? di : (di && typeof di === 'object'
      ? ['ministries', 'regions', 'militaryUnits'].reduce(function(acc, pool) {
          var p = di[pool];
          if (p && typeof p === 'object') Object.keys(p).forEach(function(k) { if (p[k]) acc.push(p[k]); });
          return acc;
        }, [])
      : []);
    // 阶段中文化（与药丸条镜像）：避免玩家见到 proposal/running 等英文态；abolished 补「已废」
    function _stageCn(stg) {
      return stg === 'running' ? '施行' : stg === 'proposal' ? '拟议'
        : stg === 'debate' ? '廷议' : stg === 'trial' ? '试行'
        : stg === 'pendingReform' ? '待裁' : stg === 'underfunded' ? '缺饷'
        : stg === 'failed' ? '流产' : stg === 'abolished' ? '已废'
        : (stg ? ('未明（' + stg + '）') : '—');   // 未知态兜底中文·带原值便于排查(stage 非闭集·AI 旧格式可写任意串)
    }
    var body = '<div style="max-width:720px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">📜 制度志</div>';
    if (insts.length === 0) {
      body += '<div style="color:#d4be7a;font-size:0.82rem;">暂无动态设立机构</div>';
    } else {
      insts.forEach(function(inst) {
        body += '<div style="padding:10px;margin-bottom:8px;background:var(--bg-2);border-left:3px solid ' + (inst.stage === 'abolished' ? 'var(--vermillion-400)' : 'var(--gold-500)') + ';border-radius:4px;">';
        body += '<div style="font-size:0.86rem;color:var(--gold-300);">' + inst.name + ' · 品 ' + inst.rank + '</div>';
        body += '<div style="font-size:0.72rem;color:#d4be7a;">设 ' + inst.createdTurn + ' 回合 · 状态 ' + _stageCn(inst.stage) + ' · 员额 ' + (inst.staffSize||0) + ' · 岁支 ' + (inst.annualBudget||0);
        if (inst.abolishedTurn) body += ' · 废 ' + inst.abolishedTurn;
        body += '</div>';
        body += '<div style="font-size:0.72rem;color:var(--ink-300);margin-top:4px;">效率 ' + ((inst.effectiveness||0)*100).toFixed(0) + '% · 腐败 ' + (inst.corruption||0).toFixed(0) + '</div>';
        body += '</div>';
      });
    }
    // 永久改革
    if (G._permanentReforms && G._permanentReforms.length > 0) {
      body += '<div style="font-size:0.86rem;color:var(--gold-400);margin:12px 0 4px;">永制（跨朝遗产）</div>';
      G._permanentReforms.forEach(function(r) {
        body += '<div style="padding:6px 10px;background:var(--bg-2);border-radius:3px;margin-bottom:3px;font-size:0.74rem;">';
        body += '<b>' + r.id + '</b> · 立于 ' + r.enactedDynasty + ' 第 ' + r.enactedTurn + ' 回合';
        body += '</div>';
      });
    }
    body += '</div>';
    _showModal(body, '制度志', 760);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  天时地利 tab（环境史记子页）
  // ═══════════════════════════════════════════════════════════════════

  function openEnvironmentChronicle() {
    var G = global.GM;
    var E = G.environment;
    if (!E) { if (global.toast) global.toast('环境未初始化'); return; }
    var body = '<div style="max-width:680px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">🌄 天时地利</div>';
    // 总体
    body += '<div style="background:var(--bg-2);padding:10px;border-radius:4px;margin-bottom:10px;">';
    body += '<div style="font-size:0.82rem;color:var(--gold-400);">气候 · ' + (E.climatePhase || 'normal') + '</div>';
    body += '<div style="font-size:0.76rem;">全国承载 ' + ((E.nationalLoad||0)*100).toFixed(0) + '% · 生态债 ' + (E.ecoDebt||0).toFixed(0) + '</div>';
    body += '</div>';
    // 活动政策
    if (E.activePolicies && E.activePolicies.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">在行环政</div>';
      E.activePolicies.forEach(function(p) {
        body += '<div style="font-size:0.72rem;margin:2px 0;">· ' + (p.id || 'policy') + '</div>';
      });
    }
    // 危机历史
    if (E.crisisHistory && E.crisisHistory.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:10px 0 4px;">生态危机</div>';
      E.crisisHistory.slice(-10).forEach(function(c) {
        body += '<div style="font-size:0.72rem;margin:2px 0;color:var(--ink-300);">· ' + c.turn + '：' + (c.name || c.id) + '</div>';
      });
    }
    // 各区域疤痕
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:10px 0 4px;">各区生态疤痕</div>';
    body += '<div style="background:var(--bg-2);padding:8px;border-radius:4px;max-height:240px;overflow-y:auto;">';
    Object.keys(E.byRegion || {}).forEach(function(rid) {
      var r = E.byRegion[rid];
      var scars = r.ecoScars || {};
      var totalScar = Object.values(scars).reduce(function(a,b){return a+b;}, 0);
      if (totalScar > 0.3) {
        body += '<div style="font-size:0.7rem;margin:2px 0;"><b>' + rid + '</b> · 综合 ' + (totalScar).toFixed(2);
        var majorScars = Object.keys(scars).filter(function(k){return scars[k]>0.2;});
        if (majorScars.length > 0) body += ' · 主伤 ' + majorScars.join('/');
        body += '</div>';
      }
    });
    body += '</div>';
    body += '</div>';
    _showModal(body, '天时地利', 720);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  诏令参考按钮（嵌入诏令编辑框）
  // ═══════════════════════════════════════════════════════════════════

  function openEdictReferenceBar() {
    var body = '<div style="max-width:520px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">📚 诏书问对 · 速查</div>';
    body += '<div style="font-size:0.78rem;color:var(--ink-300);margin-bottom:8px;">选择类型，查看建议格式 + 历代典范：</div>';
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    ['currency','tax','huji','corvee','military','office'].forEach(function(t) {
      body += '<button class="btn" style="padding:6px;font-size:0.76rem;" onclick="openEdictHelp(\''+t+'\');this.closest(\'div[style*=position]\').remove();">' +
              ({currency:'货币', tax:'税种', huji:'户籍', corvee:'徭役', military:'兵制', office:'官制'}[t]) + '改革</button>';
    });
    body += '</div>';
    body += '</div>';
    _showModal(body, '诏书速查', 540);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  多意图拆分算法
  // ═══════════════════════════════════════════════════════════════════

  /** 识别多意图 + 拆分为多子诏令 */
  function parseMultiIntent(text) {
    var intents = [];
    // 关键词族检测
    var intentFamilies = [
      { id:'currency',  re:/铸|钱|币|钞/, text:'' },
      { id:'tax',       re:/征税|行税|立.*税|百抽/, text:'' },
      { id:'huji',      re:/清查|编审|黄册|保甲/, text:'' },
      { id:'corvee',    re:/役|征发|徭|调丁/, text:'' },
      { id:'military',  re:/募兵|府兵|卫所|发兵|整军/, text:'' },
      { id:'office',    re:/设.*司|立.*部|置.*院/, text:'' },
      { id:'env',       re:/浚|封山|植树|修渠|治河/, text:'' },
      { id:'relief',    re:/赈|救|招抚|蠲免/, text:'' },
      { id:'frontier',  re:/开.*边|垦.*边|屯.*边/, text:'' }
    ];
    // 用"兼"、"并"、"且"、逗号分号 拆句
    var segments = text.split(/[；;，,兼并且或]/);
    segments.forEach(function(seg) {
      seg = seg.trim();
      if (!seg) return;
      intentFamilies.forEach(function(f) {
        if (f.re.test(seg)) {
          intents.push({ id: f.id, text: seg, fullContext: text });
        }
      });
    });
    // 去重（同一 segment 可能触发多类）
    var seen = {};
    var deduped = intents.filter(function(i) {
      var key = i.id + '::' + i.text;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    return {
      isMultiIntent: deduped.length > 1,
      intents: deduped,
      rawText: text
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  朝议强制触发接口
  // ═══════════════════════════════════════════════════════════════════

  function triggerForcedCourtDiscussion(topic, reason) {
    var G = global.GM;
    if (!G._forcedCourtDiscussions) G._forcedCourtDiscussions = [];
    var disc = {
      id: 'fcd_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      topic: topic,
      reason: reason,
      turn: G.turn || 0,
      factions: _generateFactionStances(topic),
      votes: {},
      status: 'pending'
    };
    G._forcedCourtDiscussions.push(disc);
    if (global.addEB) global.addEB('朝议', '强制廷议：' + topic + '（' + reason + '）');
    return disc;
  }

  function _generateFactionStances(topic) {
    var G = global.GM;
    var factions = { '户部':{}, '兵部':{}, '清流':{}, '宦官':{}, '外戚':{}, '地方':{} };
    // 简化：按 topic 关键字对应立场
    Object.keys(factions).forEach(function(fkey) {
      var stance = 'neutral';
      if (/迁都|扩建/.test(topic)) stance = fkey === '户部' ? 'opposed' : fkey === '清流' ? 'opposed' : 'neutral';
      if (/改土|征讨/.test(topic)) stance = fkey === '兵部' ? 'supportive' : 'neutral';
      if (/减税|蠲免/.test(topic)) stance = fkey === '户部' ? 'opposed' : 'supportive';
      factions[fkey] = { stance: stance, reason: '' };
    });
    return factions;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 赋能：主动奏疏/人口叙事/虚报判定/改革可行性
  // ═══════════════════════════════════════════════════════════════════

  /** F2.1 主动奏疏：根据异常指标生成奏疏 */
  function generateProactiveMemorial(ctx) {
    var G = global.GM;
    var issues = [];
    // 检测异常
    if (G.population && G.population.fugitives > (G.population.national && G.population.national.mouths || 1) * 0.08) {
      issues.push({ type: 'fugitive_surge', drafter: '户部尚书', urgency: 'high', content: '逃户日增，已占丁口八分之一，请旨整饬' });
    }
    if (G.fiscal && G.fiscal._peasantBurdenAvg > 0.7) {
      issues.push({ type: 'burden_critical', drafter: '户部尚书', urgency: 'critical', content: '民负已临赤线，恐生民变' });
    }
    if (G.environment && G.environment.nationalLoad > 1.3) {
      issues.push({ type: 'eco_overload', drafter: '工部尚书', urgency: 'high', content: '天地承载几竭，宜息大工' });
    }
    var corrRaw = G.corruption && typeof G.corruption === 'object'
      ? (typeof G.corruption.trueIndex === 'number' ? G.corruption.trueIndex : G.corruption.overall)
      : G.corruption;
    var corr = typeof corrRaw === 'number' && isFinite(corrRaw) ? corrRaw : 30;
    if (corr > 70) {
      issues.push({ type: 'corruption_urgent', drafter: '御史大夫', urgency: 'high', content: '吏治大坏，请整肃朝纲' });
    }
    // 选 1 条入奏
    if (issues.length > 0 && Math.random() < 0.3) {
      var picked = issues[Math.floor(Math.random() * issues.length)];
      // 议题类型 id → 中文题名
      var _issueLabels = {
        fugitive_surge: '逃户疏',
        burden_critical: '民负临赤疏',
        eco_overload: '减徭安民疏',
        corruption_urgent: '整肃朝纲疏',
        memorial_stale: '积压奏疏疏'
      };
      var pickedLabel = _issueLabels[picked.type] || picked.type;
      var memo = {
        id: 'proactive_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
        typeKey: 'tax_reform',
        typeName: pickedLabel,
        drafter: picked.drafter,
        subject: picked.content.slice(0, 20),
        turn: ctx.turn || 0,
        status: 'drafted',
        draftText: picked.drafter + '奏：' + picked.content + '。伏乞圣裁。',
        _proactive: true,
        urgency: picked.urgency
      };
      if (!G._pendingMemorials) G._pendingMemorials = [];
      G._pendingMemorials.push(memo);
      if (global.addEB) global.addEB('奏疏', picked.drafter + ' 自主奏：《' + pickedLabel + '》——' + picked.content.slice(0, 30));
    }
  }

  /** F2.2 人口叙事 */
  function generatePopulationNarrative() {
    var G = global.GM;
    if (!G.population || !G.population.national) return '';
    var pop = G.population.national.mouths || 0;
    var fug = G.population.fugitives || 0;
    var hidden = G.population.hiddenCount || 0;
    var narrative = '口众 ' + (pop/10000).toFixed(0) + ' 万';
    if (fug > pop * 0.05) narrative += '，然逃者十之五六';
    if (hidden > pop * 0.1) narrative += '，隐户横生';
    if (G.population.cropAdoption && G.population.cropAdoption.sweet_potato > 0.3) narrative += '，红薯广布';
    return narrative;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  辅助：modal 框架
  // ═══════════════════════════════════════════════════════════════════

  function _showModal(bodyHtml, title, maxWidth) {
    var ov = document.createElement('div');
    ov.className = '_f5_modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19030;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.0rem;width:92%;max-width:' + (maxWidth||520) + 'px;max-height:88vh;overflow-y:auto;">' +
                   bodyHtml + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  function _closeAllF5Modals() {
    document.querySelectorAll('._f5_modal').forEach(function(o){o.remove();});
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    try { generateProactiveMemorial(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF5] proactive:') : console.error('[phaseF5] proactive:', e); }
  }

  function init() {}

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseF5 = {
    init: init,
    tick: tick,
    openPlayerActionMenu: openPlayerActionMenu,
    openMilitaryFarmUI: openMilitaryFarmUI,
    _submitMilitaryFarm: _submitMilitaryFarm,
    openGaituUI: openGaituUI,
    _submitGaitu: _submitGaitu,
    openMoveCapitalUI: openMoveCapitalUI,
    _submitMoveCapital: _submitMoveCapital,
    openFrontierUI: openFrontierUI,
    _submitFrontier: _submitFrontier,
    openHujiDashboard: openHujiDashboard,
    openPowerCounterUI: openPowerCounterUI,
    openInstitutionsChronicle: openInstitutionsChronicle,
    openEnvironmentChronicle: openEnvironmentChronicle,
    openEdictReferenceBar: openEdictReferenceBar,
    parseMultiIntent: parseMultiIntent,
    triggerForcedCourtDiscussion: triggerForcedCourtDiscussion,
    generateProactiveMemorial: generateProactiveMemorial,
    generatePopulationNarrative: generatePopulationNarrative,
    VERSION: 1
  };

  global.openPlayerActionMenu = openPlayerActionMenu;
  global.openInstitutionsChronicle = openInstitutionsChronicle;
  global.openEnvironmentChronicle = openEnvironmentChronicle;
  global.openEdictReferenceBar = openEdictReferenceBar;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
