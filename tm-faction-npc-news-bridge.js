// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-news-bridge.js — NPC 事件 → 近事快报桥 (Phase H1+H2·2026-05-10)
 *
 * 把 NPC 5 系统产出的重要事件 push 到 GM.qijuHistory·让 player 在"近事快报" panel 看到。
 * importance filter:
 *   memorial  仅 approved/rejected (留中/批转隐于内政详情)
 *   edict     全 (NPC 公开诏令 player 应能听闻)
 *   chaoyi    仅 attack/cooperate (infight/compromise 内部琐事)
 *   office    全 (人事变动公开)
 *   fiscal    仅 crisis 转折 (财政由健→危·或由危→健)
 *
 * 都加 [势力名] prefix·让 player 知道是哪国之事。
 */
(function(global) {
  'use strict';

  function _now() {
    var GM = global.GM;
    if (!GM) return '';
    // 取剧本日历·若无 → "第 N 回"
    var date = GM.currentDate || GM.date || '';
    if (date) return String(date);
    return '回' + (GM.turn || 1);
  }

  function _push(category, facName, content) {
    if (typeof global.GM === 'undefined') return false;
    if (!Array.isArray(global.GM.qijuHistory)) global.GM.qijuHistory = [];
    var item = {
      category: category,
      content: '【' + facName + '】' + content,
      time: _now(),
      turn: (global.GM.turn || 1),
      _source: 'npc-bridge',
      _facName: facName
    };
    global.GM.qijuHistory.unshift(item);
    // cap 200·近事快报只读前 30·这里多保留些供其它系统
    if (global.GM.qijuHistory.length > 200) global.GM.qijuHistory = global.GM.qijuHistory.slice(0, 200);
    return true;
  }

  // ── 5 类 push ──

  function pushMemorial(fac, mem) {
    if (!fac || !mem) return false;
    var statusMap = {
      approved: '准',
      rejected: '驳',
      annotated: '留中',
      referred: '批转',
      pending: '待决'
    };
    var statusWord = statusMap[mem.status] || String(mem.status || '记');
    var content = mem.from + '上' + mem.type + '·' + statusWord + '。'
                 + (mem.ruling ? ' 朱批: ' + String(mem.ruling).slice(0, 24) : '');
    return _push('奏疏', fac.name, content);
  }

  function pushEdict(fac, edict) {
    if (!fac || !edict) return false;
    var brief = (edict.content || '').slice(0, 36);
    var content = (edict.issuer || '主君') + '诏[' + edict.type + ']: ' + brief + (edict.content && edict.content.length > 36 ? '…' : '');
    return _push('诏令', fac.name, content);
  }

  function pushChaoyi(fac, chaoyi) {
    if (!fac || !chaoyi) return false;
    var typeMap = {
      cooperate: '协同',
      attack: '攻讦',
      compromise: '妥协',
      infight: '内争',
      null: '无议'
    };
    var typeLabel = typeMap[chaoyi.type] || String(chaoyi.type || '议');
    var content = '朝议[' + typeLabel + ']: ' + (chaoyi.summary || '');
    return _push('朝议', fac.name, content);
  }

  function pushOffice(fac, action) {
    if (!fac || !action) return false;
    var verb = action.action === 'promote' ? '擢' : '罢';
    var posChange = '';
    if (action.effect) {
      var pf = action.effect.positionFrom || '';
      var pt = action.effect.positionTo || '';
      if (pt) posChange = ' (' + pf + '→' + pt + ')';
    }
    var content = (action.ruler || '主君') + verb + action.target + posChange;
    return _push('人事', fac.name, content);
  }

  // 每回合财政账本都入快报；危机/脱危会额外带状态词。
  function pushFiscalCrisis(fac, ledger) {
    if (!fac || !ledger) return false;
    var prevCrisis = fac._lastFiscalCrisisFlag;
    var nowCrisis = !!ledger.crisis;
    fac._lastFiscalCrisisFlag = nowCrisis;
    var net = Number(ledger.net || 0);
    var status = '';
    if (prevCrisis !== nowCrisis && nowCrisis) status = '太仓告罄·';
    else if (prevCrisis !== nowCrisis && !nowCrisis) status = '财政转危为安·';
    else status = nowCrisis ? '财政危局·' : '财政常计·';
    return _push('财政', fac.name, status + '入' + ledger.monthlyIncome + '·支' + ledger.monthlyExpense + '·净' + (net >= 0 ? '+' : '') + net + '·库' + ledger.treasuryAfter);
  }

  // 干预动作 push (player 自己干预 NPC·入快报让记录可查)
  function pushIntervention(rec) {
    if (!rec) return false;
    var actionMap = {
      bribe: '暗结',
      sponsorRebellion: '资助派系',
      spreadRumor: '散播谣言',
      espionage: '间谍策反'
    };
    var verb = actionMap[rec.action] || rec.action;
    var content = '本朝' + verb + '·目标·' + (rec.targetChar || rec.targetFac || '?');
    if (rec.effects && rec.effects.defected) content += '·已策反归朝';
    if (rec.effects && rec.effects.bribed) content += '·已收买';
    return _push('鸿雁', rec.targetFac || '?', content);
  }

  function pushMilitaryAction(fac, action) {
    if (!fac || !action) return false;
    var content = '调军·' + (action.army || action.name || '?');
    if (action.commanderFrom || action.commanderTo) content += '·帅 ' + (action.commanderFrom || '?') + '→' + (action.commanderTo || '?');
    if (action.reason) content += '·' + String(action.reason).slice(0, 32);
    return _push('军务', fac.name, content);
  }

  function pushDiplomacyAction(fac, action) {
    if (!fac || !action) return false;
    var content = '外交·' + (action.to || action.targetFaction || '?');
    if (action.relationFrom !== undefined || action.relationTo !== undefined) content += '·关系 ' + (action.relationFrom !== undefined ? action.relationFrom : '?') + '→' + (action.relationTo !== undefined ? action.relationTo : '?');
    if (action.reason) content += '·' + String(action.reason).slice(0, 32);
    return _push('外交', fac.name, content);
  }

  function pushProvincePolicy(fac, action) {
    if (!fac || !action) return false;
    var content = '地政·' + (action.province || '?');
    if (action.ownerFrom || action.ownerTo) content += '·归属 ' + (action.ownerFrom || '?') + '→' + (action.ownerTo || '?');
    if (action.reason) content += '·' + String(action.reason).slice(0, 32);
    return _push('地政', fac.name, content);
  }

  function pushFiscalPolicy(fac, action) {
    if (!fac || !action) return false;
    var content = '财计·' + (action.resource || 'money') + ' ' + ((action.delta || 0) >= 0 ? '+' : '') + (action.delta || 0);
    if (action.reason) content += '·' + String(action.reason).slice(0, 32);
    return _push('财计', fac.name, content);
  }

  function pushIntrigue(fac, action) {
    if (!fac || !action) return false;
    var content = '间谍·' + (action.targetFaction || '?') + '·' + (action.intrigue || action.policy || 'covert');
    if (action.pressure) content += '·压力+' + action.pressure;
    if (action.reason) content += '·' + String(action.reason).slice(0, 32);
    return _push('间谍', fac.name, content);
  }

  function pushRebellionPolicy(fac, action) {
    if (!fac || !action) return false;
    var content = '叛乱·' + (action.targetFaction || '?') + '·' + (action.policy || 'incite');
    if (action.support) content += '·声势+' + action.support;
    if (action.reason) content += '·' + String(action.reason).slice(0, 32);
    return _push('叛乱', fac.name, content);
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcNewsBridge = {
    pushMemorial: pushMemorial,
    pushEdict: pushEdict,
    pushChaoyi: pushChaoyi,
    pushOffice: pushOffice,
    pushFiscalCrisis: pushFiscalCrisis,
    pushIntervention: pushIntervention,
    pushMilitaryAction: pushMilitaryAction,
    pushDiplomacyAction: pushDiplomacyAction,
    pushProvincePolicy: pushProvincePolicy,
    pushFiscalPolicy: pushFiscalPolicy,
    pushIntrigue: pushIntrigue,
    pushRebellionPolicy: pushRebellionPolicy
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.TM.FactionNpcNewsBridge;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
