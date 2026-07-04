// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-wendui-prison.js — 狱中问对·prison dialogue (2026-05-21)
 *
 * 触发·tm-wendui.js callWendui() 检测到 char._imprisoned·跳到这里
 *
 * 6 动作·询问 / 慰问 / 严讯 / 赦免 / 释放 / 加刑
 *   每动作·硬效果 (state mutation) + AI 解析叙事 (callAIMessagesStream)
 *
 * 频率代价·
 *   单回合同人 ≤ 2 次·超出 toast 阻
 *   累计同人 5 次·触发 _palaceFavoritism 奏疏 (民心 -2·皇威 -3·党争 +1)
 */
(function(global) {
  'use strict';

  var STATE = {
    currentTarget: null,    // char ref
    currentAction: null,    // 'inquire'|'comfort'|'interrogate'|'pardon'|'release'|'addPunishment'
    historyKey: 'wenduiPrisonHistory'  // GM[historyKey][charName] = []
  };

  // 2026-05-21·政治后果只用 minxin / huangwei / loyalty / health (官方剧本都初始化的字段)
  //   不用 partyStrife — 官方剧本未初始化·写入会 silently noop·UI 显示却误导玩家
  //   严讯/赦免原"党争 +1"的代价·换成多扣 1 民心 (政治不公·朝野有议)
  var ACTIONS = {
    chat: {
      label: '对话',
      desc: '与罪臣自由对话·像问对一样·不动状态·只送文字给 AI',
      energy: 5,
      effects: { minxin: 0, huangwei: 0, loyalty: 0, health: 0 },
      requiresConfirm: false,
      requiresText: true   // 必须有 textarea 文字·才能送
    },
    inquire: {
      label: '询问',
      desc: '与罪臣对话·询其情其罪',
      energy: 10,
      effects: { minxin: 0, huangwei: 0, loyalty: 0, health: 0 },
      requiresConfirm: false
    },
    comfort: {
      label: '慰问',
      desc: '抚慰罪臣·或可宽其心',
      energy: 15,
      effects: { minxin: -1, huangwei: 0, loyalty: 5, health: 2 },
      reasonTag: '陛下慰问罪臣',
      requiresConfirm: false
    },
    interrogate: {
      label: '严讯',
      desc: '逼供以图情报·恐伤罪臣',
      energy: 15,
      effects: { minxin: -2, huangwei: 0, loyalty: -15, health: -10 },
      reasonTag: '陛下亲讯',
      requiresConfirm: true
    },
    pardon: {
      label: '赦免',
      desc: '免其罪·恢复身份 (政治代价重)',
      energy: 20,
      effects: { minxin: -4, huangwei: -5, loyalty: 20, health: 0 },
      reasonTag: '陛下赦免',
      requiresConfirm: true,
      clearImprisoned: true,
      clearReason: '陛下亲临诏狱·赦免出狱'  // 必须含 "赦免|出狱" 关键词·让 applier release path 也认
    },
    release: {
      label: '释放',
      desc: '释而戴罪·不洗罪名',
      energy: 15,
      effects: { minxin: -1, huangwei: -3, loyalty: 10, health: 0 },
      reasonTag: '陛下释放',
      requiresConfirm: true,
      clearImprisoned: true,
      clearReason: '陛下亲临诏狱·释放戴罪'
    },
    addPunishment: {
      label: '加刑',
      desc: '严惩示众·有损宽仁',
      energy: 15,
      effects: { minxin: -1, huangwei: 0, loyalty: -20, health: -20 },
      reasonTag: '陛下加刑',
      requiresConfirm: true
    }
  };

  // ── 帮助·一回合内同人狱中问对计数 ──
  function _turnVisitCount(charName) {
    var GM = global.GM;
    if (!GM || !GM._prisonVisits) return 0;
    var rec = GM._prisonVisits[charName];
    if (!rec) return 0;
    if (rec.turn !== (GM.turn || 0)) return 0;
    return rec.count || 0;
  }
  function _incTurnVisit(charName) {
    var GM = global.GM;
    if (!GM) return;
    if (!GM._prisonVisits) GM._prisonVisits = {};
    var rec = GM._prisonVisits[charName];
    if (!rec || rec.turn !== (GM.turn || 0)) {
      rec = { turn: GM.turn || 0, count: 0 };
      GM._prisonVisits[charName] = rec;
    }
    rec.count = (rec.count || 0) + 1;
  }
  function _totalVisits(charName) {
    var GM = global.GM;
    if (!GM || !GM._prisonVisitsTotal) return 0;
    return (GM._prisonVisitsTotal[charName] || 0);
  }
  function _incTotalVisit(charName) {
    var GM = global.GM;
    if (!GM) return;
    if (!GM._prisonVisitsTotal) GM._prisonVisitsTotal = {};
    GM._prisonVisitsTotal[charName] = (GM._prisonVisitsTotal[charName] || 0) + 1;
  }

  // ── 打开 prompt·让玩家确认要不要赴诏狱 ──
  function openPrompt(charName, ch, mode) {
    if (!ch) return;
    var visitsTurn = _turnVisitCount(charName);
    var visitsTotal = _totalVisits(charName);
    var imprisonReason = ch._imprisonReason || '原因不详';
    var imprisonedTurn = ch._imprisonedTurn || 0;
    var heldTurns = Math.max(0, (global.GM && global.GM.turn || 0) - imprisonedTurn);

    var msg = '【诏狱·提示】\n' +
      charName + ' 目下下狱·\n' +
      '  · 罪名: ' + imprisonReason + '\n' +
      '  · 已羁押 ' + heldTurns + ' 回合\n' +
      '  · 本回合已狱中问对 ' + visitsTurn + ' 次 (上限 2)\n' +
      '  · 累计狱中问对 ' + visitsTotal + ' 次 (≥5 朝议有非议)\n\n' +
      '常朝召对不便。可改赴诏狱探问 (狱中问对)·或鸿雁传书。';

    if (visitsTurn >= 2) {
      if (typeof global.toast === 'function') global.toast(charName + ' 本回合已亲狱 2 次·过密。请下回合再赴。');
      return;
    }

    if (typeof global.confirm === 'function') {
      if (!global.confirm(msg + '\n\n确认赴诏狱?')) return;
    }

    _openPrisonModal(charName, ch, mode);
  }

  // ── 打开 prison modal·6 动作按钮 ──
  function _openPrisonModal(charName, ch, mode) {
    STATE.currentTarget = ch;
    STATE.currentAction = null;
    var GM = global.GM;
    if (!GM[STATE.historyKey]) GM[STATE.historyKey] = {};
    if (!GM[STATE.historyKey][charName]) GM[STATE.historyKey][charName] = [];

    if (typeof global.document === 'undefined') return;  // node test env
    var d = global.document;

    // 移除旧 modal
    var old = d.getElementById('wd-prison-modal');
    if (old) old.remove();

    var modal = d.createElement('div');
    modal.id = 'wd-prison-modal';
    modal.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:640px;max-height:80vh;background:#1a0e08;border:2px solid #6b2e2a;border-radius:6px;padding:0;z-index:9999;color:#d9c8a8;font-family:var(--font-serif);box-shadow:0 0 40px rgba(0,0,0,0.8);overflow:hidden;display:flex;flex-direction:column;';

    var imprisonReason = ch._imprisonReason || '原因不详';
    var imprisonedTurn = ch._imprisonedTurn || 0;
    var heldTurns = Math.max(0, (GM.turn || 0) - imprisonedTurn);
    var health = (typeof ch.health === 'number') ? ch.health : 80;

    var hdr = '<div style="background:linear-gradient(to right,#3a1a14,#2a1208);padding:10px 14px;border-bottom:1px solid #6b2e2a;">' +
      '<div style="font-size:16px;color:#c98a55;letter-spacing:0.15em;">【诏狱】' + _esc(charName) + '</div>' +
      '<div style="font-size:12px;color:#8a6a4a;margin-top:3px;">罪名·' + _esc(imprisonReason) + ' · 羁押 ' + heldTurns + ' 月 · 体魄 ' + health + '/100</div>' +
      '</div>';

    // 动作按钮·chat 单独抽出到 textarea 旁边 (跟 wendui 的发送按钮位置一致)
    var actionBtns = Object.keys(ACTIONS).filter(function(k){ return k !== 'chat'; }).map(function(k) {
      var a = ACTIONS[k];
      var e = a.effects;
      var costParts = [];
      if (a.energy) costParts.push('精力 -' + a.energy);
      if (e.minxin) costParts.push('民心 ' + (e.minxin > 0 ? '+' : '') + e.minxin);
      if (e.huangwei) costParts.push('皇威 ' + (e.huangwei > 0 ? '+' : '') + e.huangwei);
      if (e.loyalty) costParts.push('忠诚 ' + (e.loyalty > 0 ? '+' : '') + e.loyalty);
      if (e.health) costParts.push('体魄 ' + (e.health > 0 ? '+' : '') + e.health);
      var costStr = costParts.length ? '<div style="font-size:11px;color:#7a5a3a;margin-top:3px;">' + costParts.join(' · ') + '</div>' : '';
      return '<button class="wdp-btn" data-action="' + k + '" style="display:block;width:100%;text-align:left;padding:8px 12px;margin:4px 0;background:#2a1610;border:1px solid #5a3a2a;color:#c9a55a;cursor:pointer;border-radius:3px;font-family:inherit;">' +
        '<div style="font-size:14px;">' + a.label + '</div>' +
        '<div style="font-size:12px;color:#8a7a5a;margin-top:2px;">' + a.desc + '</div>' +
        costStr +
        '</button>';
    }).join('');

    var historyHtml = '<div id="wd-prison-history" style="flex:1;overflow-y:auto;padding:10px 14px;border-top:1px solid #4a2a20;font-size:13px;line-height:1.7;">' +
      (GM[STATE.historyKey][charName].length === 0
        ? '<div style="color:#5a4a3a;font-style:italic;">(自由对话·或选上方动作)</div>'
        : GM[STATE.historyKey][charName].map(function(h) {
            var who = h.role === 'sovereign' ? '陛下' : (h.role === 'prisoner' ? charName : '【' + (h.tag || '记') + '】');
            var color = h.role === 'sovereign' ? '#c98a55' : (h.role === 'prisoner' ? '#a8a8a8' : '#7a9a7a');
            return '<div style="margin-bottom:6px;"><span style="color:' + color + ';">' + who + '·</span>' + _esc(h.content) + '</div>';
          }).join('')) +
      '</div>';

    // 输入区·与 wendui 一致·textarea + 发送 + Enter送 (Shift+Enter 换行)
    var footerInput = '<div style="padding:8px 14px;border-top:1px solid #4a2a20;background:#0e0805;">' +
      '<textarea id="wd-prison-input" placeholder="对罪臣说什么…  (Enter 送·Shift+Enter 换行)" style="width:100%;min-height:50px;background:#1a0e08;color:#d9c8a8;border:1px solid #5a3a2a;padding:6px;font-family:inherit;resize:vertical;"></textarea>' +
      '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:6px;">' +
      '<span style="font-size:11px;color:#5a4a3a;flex:1;">对话·精力 -5·不动状态。或上方动作 (动作会用此文本作旁白)。</span>' +
      '<button id="wd-prison-send" style="padding:5px 16px;background:#3a2a1a;border:1px solid #8a6a3a;color:#c9a55a;cursor:pointer;font-family:inherit;">发送</button>' +
      '<button id="wd-prison-close" style="padding:5px 12px;background:transparent;border:1px solid #5a3a2a;color:#8a7a5a;cursor:pointer;">退出</button>' +
      '</div></div>';

    modal.innerHTML = hdr +
      '<div style="padding:10px 14px;background:#180a06;border-bottom:1px solid #4a2a20;">' + actionBtns + '</div>' +
      historyHtml + footerInput;
    d.body.appendChild(modal);

    var closeBtn = d.getElementById('wd-prison-close');
    if (closeBtn) closeBtn.onclick = function() { modal.remove(); };

    // 发送按钮 → 走 chat action·与点 chat 按钮等价
    var sendBtn = d.getElementById('wd-prison-send');
    if (sendBtn) sendBtn.onclick = function() {
      _executeAction(charName, ch, 'chat', modal);
    };

    // Enter 送·Shift+Enter 换行 (与 wendui 一致)
    var inputEl = d.getElementById('wd-prison-input');
    if (inputEl) {
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _executeAction(charName, ch, 'chat', modal);
        }
      });
      // auto-focus 进 modal 即可打字
      setTimeout(function() { try { inputEl.focus(); } catch(_) {} }, 50);
    }

    modal.querySelectorAll('.wdp-btn').forEach(function(btn) {
      btn.onclick = function() {
        var actionKey = btn.getAttribute('data-action');
        _executeAction(charName, ch, actionKey, modal);
      };
    });
  }

  function _esc(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── 执行动作·硬效果 + AI 解析叙事 ──
  async function _executeAction(charName, ch, actionKey, modal) {
    var action = ACTIONS[actionKey];
    if (!action) return;
    var GM = global.GM;
    if (!GM) return;

    // chat 模式需先校验文字 (避免空送)
    if (action.requiresText) {
      var d0 = typeof global.document !== 'undefined' ? global.document : null;
      var txt0 = (d0 && d0.getElementById('wd-prison-input')) ? d0.getElementById('wd-prison-input').value.trim() : '';
      if (!txt0) {
        if (typeof global.toast === 'function') global.toast('对话需输入话语·下方文本框写');
        return;
      }
    }

    if (action.requiresConfirm && typeof global.confirm === 'function') {
      var cmsg = '【确认】' + action.label + ' ' + charName + '?\n' + action.desc;
      var eff = action.effects;
      var effParts = [];
      if (eff.minxin) effParts.push('民心 ' + eff.minxin);
      if (eff.huangwei) effParts.push('皇威 ' + eff.huangwei);
      if (eff.loyalty) effParts.push('罪臣忠诚 ' + (eff.loyalty > 0 ? '+' : '') + eff.loyalty);
      if (effParts.length) cmsg += '\n影响·' + effParts.join('·');
      if (!global.confirm(cmsg)) return;
    }

    // chat 不算正式"亲狱"·跳频率 + 跳 _incTotalVisit (避免无限聊提升 favoritism)
    // 频率检查须在扣精力之前——旧序第 3 次动作精力白扣不回滚(2026-07-04 审查定罪)
    if (actionKey !== 'chat') {
      var visitsTurn = _turnVisitCount(charName);
      if (visitsTurn >= 2) {
        if (typeof global.toast === 'function') global.toast(charName + ' 本回合已亲狱 2 次·过密');
        return;
      }
    }

    // 精力检查
    if (action.energy && typeof global._spendEnergy === 'function') {
      if (!global._spendEnergy(action.energy, '狱中问对·' + action.label + '·' + charName)) return;
    }

    if (actionKey !== 'chat') {
      _incTurnVisit(charName);
      _incTotalVisit(charName);
    }

    // 硬效果·应用 state mutations
    _applyEffects(action.effects, ch);

    // 状态变迁·赦免/释放清 _imprisoned (走 onDismissal release path)
    if (action.clearImprisoned) {
      if (typeof global.AIChangeApplier !== 'undefined' && global.AIChangeApplier && typeof global.AIChangeApplier.onDismissal === 'function') {
        // 不真 dismiss·只触发 release path 清状态
        // 走 release regex 路径·避免重复清官职等副作用
        ch._imprisoned = false;
        ch._releasedTurn = GM.turn || 0;
        ch._releaseReason = action.clearReason || '陛下狱中释放';
      } else {
        ch._imprisoned = false;
      }
    }

    // history 记录
    if (!GM[STATE.historyKey]) GM[STATE.historyKey] = {};
    if (!GM[STATE.historyKey][charName]) GM[STATE.historyKey][charName] = [];
    var d = typeof global.document !== 'undefined' ? global.document : null;
    var freeText = (d && d.getElementById('wd-prison-input')) ? d.getElementById('wd-prison-input').value.trim() : '';

    GM[STATE.historyKey][charName].push({
      role: 'sovereign',
      action: actionKey,
      tag: action.label,
      content: action.label + (freeText ? '·' + freeText : ''),
      turn: GM.turn || 0
    });

    // 频率事件·累计 ≥5 触发 _palaceFavoritism (chat 不计)
    if (actionKey !== 'chat' && _totalVisits(charName) >= 5) {
      _triggerFavoritismEvent(charName, ch);
    }

    // 近事快报·chat 不入 (太频繁会刷屏)
    if (actionKey !== 'chat' && typeof global.GM !== 'undefined' && global.GM.qijuHistory) {
      var qjContent = '【诏狱】陛下亲临·' + action.label + ' ' + charName + (freeText ? '·谕示:「' + freeText.slice(0, 32) + '」' : '');
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
        category: '人事',
        content: qjContent,
        time: typeof global.getTSText === 'function' ? global.getTSText(GM.turn) : 'T' + (GM.turn || 0),
        turn: GM.turn || 0,
        _source: 'prison-dialogue'
      });
    }

    // 渲染中间反馈
    _appendToHistory(modal, charName, '【系统】' + action.label + (freeText ? '·' + freeText : '') + ' — 已执行');

    // 清空 textarea (chat 模式必须清·其他动作也清·下次输入不混)
    var inputEl2 = d ? d.getElementById('wd-prison-input') : null;
    if (inputEl2) inputEl2.value = '';

    // AI 解析·生成 prisoner 反应
    await _generateAIResponse(charName, ch, action, freeText, modal);

    // 释放后关闭 modal (避免继续点)
    if (action.clearImprisoned) {
      setTimeout(function() {
        if (modal && typeof modal.remove === 'function') modal.remove();
        if (typeof global.toast === 'function') global.toast(charName + ' 已' + action.label + '·出狱');
      }, 1500);
    }
  }

  function _applyEffects(eff, ch) {
    var GM = global.GM;
    if (!GM) return;
    // 民心走 MinxinLedger 总闸(2026-07-04 收口)·直写 trueIndex 会被 aggregateTrue 冲掉·value 镜像随之退役
    if (eff.minxin && typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
      try { TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'wendui-prison', kind: 'judicialFairness', delta: eff.minxin, reason: '狱案处置·朝野所感' }); } catch (_e) {}
    }
    if (eff.huangwei) {
      // 皇威走 AuthorityEngines 写口(按源封顶+sources/drains 台账+phase 迁移)——直写曾令台账与 phase 发散(2026-07-04 审查定罪)
      if (global.AuthorityEngines && typeof global.AuthorityEngines.adjustHuangwei === 'function') {
        try { global.AuthorityEngines.adjustHuangwei('judicialAction', eff.huangwei, '狱案处置', { source: 'wendui-prison' }); } catch (_e) {}
      } else if (GM.huangwei) { // 沙箱兜底
        if (typeof GM.huangwei.index === 'number') GM.huangwei.index = Math.max(0, Math.min(100, GM.huangwei.index + eff.huangwei));
        if (typeof GM.huangwei.value === 'number') GM.huangwei.value = GM.huangwei.index;
      }
    }
    if (eff.loyalty && ch && typeof global.adjustCharacterLoyalty === 'function') {
      global.adjustCharacterLoyalty(ch, eff.loyalty, '狱中问对', { source: 'wendui-prison', ai: true });
    } else if (eff.loyalty && ch && typeof ch.loyalty === 'number') {
      ch.loyalty = Math.max(0, Math.min(100, ch.loyalty + eff.loyalty));
    }
    if (eff.health && ch) {
      // 2026-05-21·用游戏现有 ch.health (char-economy-engine 维护)·非新造 _imprisonHealth
      if (typeof ch.health !== 'number') ch.health = 80;
      ch.health = Math.max(0, Math.min(100, ch.health + eff.health));
      // polish 2·体魄归 0 → 狱中卒
      if (ch.health <= 0 && ch.alive !== false) {
        _triggerPrisonDeath(ch);
      }
    }
  }

  // ── 狱中卒·体魄 ≤ 0 自动死亡 + 朝议反应 ──
  function _triggerPrisonDeath(ch) {
    var GM = global.GM;
    if (!ch || !GM) return;
    ch.alive = false;
    ch._deathCause = '狱中卒于' + (ch._imprisonReason || '严讯');
    ch._deathTurn = GM.turn || 0;
    ch._imprisoned = false;  // 既已死·清入狱标记
    // 接正典死亡管道(与 tm-ai-apply-deaths 同契约·2026-07-04 审查定罪)：只写 alive/私有字段曾绕过
    // 已殁名单(filter deathTurn!=null)/图志死因/官职统帅级联——死人挂职·AI 继续当活人写
    ch.dead = true;
    ch.deathTurn = GM.turn || 0;
    ch.deathReason = ch._deathCause;
    if (typeof global.recordCharacterArc === 'function') { try { global.recordCharacterArc(ch.name, 'death', ch._deathCause); } catch (_e) {} }
    if (global.PostTransfer && typeof global.PostTransfer.cascadeVacate === 'function') { try { global.PostTransfer.cascadeVacate(ch.name); } catch (_e) {} }
    if (GM.officeTree && typeof global._offDismissPerson === 'function') {
      try {
        (function _clearDead(ns) {
          ns.forEach(function(n) {
            if (n.positions) n.positions.forEach(function(p) {
              if (p.holder === ch.name || (Array.isArray(p.actualHolders) && p.actualHolders.some(function(h) { return h && h.name === ch.name; }))) global._offDismissPerson(p, ch.name);
            });
            if (n.subs) _clearDead(n.subs);
          });
        })(GM.officeTree);
      } catch (_e) {}
    }

    // 近事快报
    if (GM.qijuHistory) {
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
        category: '人事',
        content: '【诏狱】' + ch.name + '体魄不支·瘐死狱中。罪名·' + (ch._imprisonReason || '原因不详'),
        time: typeof global.getTSText === 'function' ? global.getTSText(GM.turn) : 'T' + (GM.turn || 0),
        turn: GM.turn || 0,
        _source: 'prison-death'
      });
    }

    // 都察院弹劾奏疏 (诏狱毙命惯例上奏)
    if (!GM.memorials) GM.memorials = [];
    GM.memorials.push({
      from: '都察院',
      type: '风纪',
      content: ch.name + '瘐死狱中·朝臣议论·恐有酷吏之嫌·伏乞陛下察。',
      status: 'pending',
      turn: GM.turn || 0,
      _source: 'prison-death-impeach'
    });

    // 民心 -3·皇威 -2 (酷吏之名)
    _applyEffects({ minxin: -3, huangwei: -2 }, null);

    if (typeof global.toast === 'function') {
      global.toast('【诏狱】' + ch.name + ' 体魄不支·瘐死狱中。民心 -3·皇威 -2·都察院上疏。');
    }
  }

  function _triggerFavoritismEvent(charName, ch) {
    var GM = global.GM;
    if (!GM) return;
    // 一旦触发·标记·避免重复 (每 N 次再触发·N=5)
    if (!GM._palaceFavoritism) GM._palaceFavoritism = {};
    var last = GM._palaceFavoritism[charName] || 0;
    var cur = _totalVisits(charName);
    if (cur - last < 5) return;  // 5 次一档
    GM._palaceFavoritism[charName] = cur;

    // 副作用·民心 -3 + 皇威 -3 (原"党争 +1"换成多扣 1 民心)
    _applyEffects({ minxin: -3, huangwei: -3 }, null);

    // 朝议奏疏 (memorial)·让朝臣议论
    if (!GM.memorials) GM.memorials = [];
    GM.memorials.push({
      from: '都察院',
      type: '风纪',
      content: '陛下亲狱 ' + charName + ' 已 ' + cur + ' 次·朝臣议论·恐损宽仁·偏私之嫌。',
      status: 'pending',
      turn: GM.turn || 0,
      _source: 'prison-favoritism-trigger'
    });

    if (typeof global.toast === 'function') {
      global.toast('【朝议风波】陛下亲狱 ' + charName + ' 已 ' + cur + ' 次·都察院上疏议论·民心 -2·皇威 -3');
    }
  }

  function _appendToHistory(modal, charName, content) {
    if (!modal || typeof global.document === 'undefined') return;
    var histEl = modal.querySelector('#wd-prison-history');
    if (!histEl) return;
    var GM = global.GM;
    if (GM && GM[STATE.historyKey] && GM[STATE.historyKey][charName]) {
      // re-render from history
      histEl.innerHTML = GM[STATE.historyKey][charName].map(function(h) {
        var who = h.role === 'sovereign' ? '陛下' : (h.role === 'prisoner' ? charName : '【' + (h.tag || '记') + '】');
        var color = h.role === 'sovereign' ? '#c98a55' : (h.role === 'prisoner' ? '#a8a8a8' : '#7a9a7a');
        return '<div style="margin-bottom:6px;"><span style="color:' + color + ';">' + who + '·</span>' + _esc(h.content) + '</div>';
      }).join('');
      histEl.scrollTop = histEl.scrollHeight;
    }
  }

  async function _generateAIResponse(charName, ch, action, freeText, modal) {
    var GM = global.GM;
    if (!GM) return;
    if (!(typeof global.P !== 'undefined' && global.P.ai && global.P.ai.key && typeof global.callAIMessagesStream === 'function')) {
      // 无 AI·留下 fallback 文本
      var fallback = '(无 AI key·' + charName + ' 闭目不语)';
      if (action.clearImprisoned) fallback = '(已' + action.label + '·' + charName + ' 叩首谢恩)';
      GM[STATE.historyKey][charName].push({
        role: 'prisoner',
        content: fallback,
        turn: GM.turn || 0
      });
      _appendToHistory(modal, charName, fallback);
      return;
    }

    var imprisonReason = ch._imprisonReason || '原因不详';
    var imprisonedTurn = ch._imprisonedTurn || 0;
    var heldTurns = Math.max(0, (GM.turn || 0) - imprisonedTurn);
    var health = (typeof ch.health === 'number') ? ch.health : 80;
    var healthDesc = health > 70 ? '体魄尚健' : (health > 40 ? '形容憔悴' : (health > 20 ? '骨瘦如柴' : '气息奄奄'));

    var sysP = '你扮演古代中国 (' + (GM.dynastyName || '本朝') + ') 朝廷罪臣·身陷诏狱。\n' +
      '人物·' + charName + ' (原职 ' + (ch.position || '未知') + '·派系 ' + (ch.faction || '中立') + ')\n' +
      '罪名·' + imprisonReason + '\n' +
      '已羁押·' + heldTurns + ' 月\n' +
      '体况·' + healthDesc + ' (' + health + '/100)\n' +
      '心境·根据罪名严重程度·已羁押时长·原忠诚 (' + (ch.loyalty || 50) + ')·决定 求情/控诉/抗辩/绝望/沉默 哪一种基调\n' +
      '陛下刚才的动作·【' + action.label + '】' + action.desc + '\n' +
      (freeText ? '陛下还说·「' + freeText + '」\n' : '') +
      '请用古白话写罪臣的反应 (≤ 80 字)·只回正文·不要任何元注释。';

    var msgs = [
      { role: 'system', content: sysP },
      { role: 'user', content: '罪臣' + charName + '·答' }
    ];

    try {
      var reply = await global.callAIMessagesStream(msgs, 200, { temperature: 0.8, tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined });  // 【降本2026-06-19】狱中对话走次 API(对齐问对/廷议)
      if (typeof reply === 'string') reply = reply.trim();
      else if (reply && reply.text) reply = reply.text.trim();
      else reply = '(罪臣沉默良久·不应)';

      GM[STATE.historyKey][charName].push({
        role: 'prisoner',
        content: reply,
        turn: GM.turn || 0
      });
      _appendToHistory(modal, charName, reply);
    } catch (e) {
      try { console.warn('[wendui-prison] AI failed:', e); } catch(_) {}
      var errFallback = '(' + charName + ' 似有所言·却被狱卒打断)';
      GM[STATE.historyKey][charName].push({
        role: 'prisoner',
        content: errFallback,
        turn: GM.turn || 0
      });
      _appendToHistory(modal, charName, errFallback);
    }
  }

  // ── polish 3·每回合自动事件 (stub·先支持 4 类事件·按权重选 0-1 个) ──
  // 在 endturn 'after' hook 调·遍历所有入狱角色·按 weighted random 触发
  var EVENTS = {
    hunger: {
      label: '绝食',
      weight: function(ch, heldMonths) { return (ch.health || 80) < 50 ? 8 : 4; },  // 体魄低更倾向
      apply: function(ch, GM) {
        ch.health = Math.max(0, (typeof ch.health === 'number' ? ch.health : 80) - 8);
        return { qiju: '【诏狱】' + ch.name + ' 绝食抗议·体魄 -8 (当前 ' + Math.round(ch.health) + ')。' };
      }
    },
    illness: {
      label: '疾病',
      weight: function(ch, heldMonths) { return heldMonths > 3 ? 8 : 3; },  // 关久了易病
      apply: function(ch, GM) {
        ch.health = Math.max(0, (typeof ch.health === 'number' ? ch.health : 80) - 12);
        return { qiju: '【诏狱】' + ch.name + ' 染病·体魄 -12 (当前 ' + Math.round(ch.health) + ')。' };
      }
    },
    familyLetter: {
      label: '家书',
      weight: function(ch, heldMonths) { return ch.loyalty > 50 ? 6 : 3; },
      apply: function(ch, GM) {
        if (typeof global.adjustCharacterLoyalty === 'function') global.adjustCharacterLoyalty(ch, 3, '狱中得家书', { source: 'wendui-prison' }); // 走口·镜像同步+台账(2026-07-04 审查定罪)
        else ch.loyalty = Math.min(100, (ch.loyalty || 50) + 3);
        return { qiju: '【诏狱】' + ch.name + ' 得家书·暂忘忧·忠诚 +3。' };
      }
    },
    accomplice: {
      label: '同党告发',
      weight: function(ch, heldMonths) { return ch.loyalty < 40 ? 6 : 2; },
      apply: function(ch, GM) {
        if (typeof global.adjustCharacterLoyalty === 'function') global.adjustCharacterLoyalty(ch, -5, '狱中遭同党告发', { source: 'wendui-prison' }); // 走口(2026-07-04 审查定罪)
        else ch.loyalty = Math.max(0, (ch.loyalty || 50) - 5);
        // 2026-05-21·原"党争 +1"·官方剧本未初始化 partyStrife·改民心 -1 (朝野非议)
        if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
          try { TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'wendui-prison', kind: 'judicialFairness', delta: -1, reason: '诏狱攀供·朝野非议' }); } catch (_e) {}
        }
        return { qiju: '【诏狱】' + ch.name + ' 为攀供·咬出同党·朝野有议·忠诚 -5·民心 -1。' };
      }
    }
  };

  function _runTurnEvents(GM) {
    GM = GM || global.GM;
    if (!GM || !Array.isArray(GM.chars)) return { triggered: 0 };
    var triggered = 0;
    GM.chars.forEach(function(ch) {
      if (!ch || ch.alive === false) return;
      if (!(ch._imprisoned || ch.imprisoned)) return;
      var heldMonths = Math.max(0, (GM.turn || 0) - (ch._imprisonedTurn || 0));
      if (heldMonths < 1) return;  // 刚入狱不触发
      // 1/3 概率触发一个事件·避免太频繁
      if (Math.random() > 0.34) return;
      // weighted pick
      var pool = [];
      Object.keys(EVENTS).forEach(function(k) {
        var e = EVENTS[k];
        var w = typeof e.weight === 'function' ? e.weight(ch, heldMonths) : 1;
        for (var i = 0; i < w; i++) pool.push(k);
      });
      if (!pool.length) return;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      var ev = EVENTS[pick];
      try {
        var res = ev.apply(ch, GM) || {};
        triggered++;
        if (res.qiju && GM.qijuHistory) {
          if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
            category: '人事', content: res.qiju,
            time: typeof global.getTSText === 'function' ? global.getTSText(GM.turn) : 'T' + (GM.turn || 0),
            turn: GM.turn || 0, _source: 'prison-event-' + pick, _facName: ch.name
          });
        }
        // 触发后立即查·若体魄归 0 → 狱中卒
        if ((ch.health || 80) <= 0 && ch.alive !== false) _triggerPrisonDeath(ch);
      } catch (e) {
        try { console.warn('[wendui-prison] event ' + pick + ' failed:', e); } catch (_) {}
      }
    });
    return { triggered: triggered };
  }

  // 自动 register endturn hook (in browser)
  if (typeof global.EndTurnHooks !== 'undefined' && typeof global.EndTurnHooks.register === 'function') {
    try {
      global.EndTurnHooks.register('after', function() { _runTurnEvents(global.GM); }, 'wendui-prison-turn-events');
    } catch (_) {}
  }

  global.WenduiPrison = {
    openPrompt: openPrompt,
    _executeAction: _executeAction,
    _turnVisitCount: _turnVisitCount,
    _totalVisits: _totalVisits,
    _runTurnEvents: _runTurnEvents,
    _triggerPrisonDeath: _triggerPrisonDeath,
    ACTIONS: ACTIONS,
    EVENTS: EVENTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.WenduiPrison;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
