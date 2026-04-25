// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-d-patches.js — D 阶段补丁（权威系统深化）
 *
 * 补完：
 *  D2 异象系统 · 谶纬库 + 天人感应联动强化（补 AuthorityComplete 只有天象/祥瑞的空缺）
 *  D3 TYRANT_AWAKENING_TRIGGERS 5 种具名触发
 *  D4 权臣反击策略 7 种（密诏/轮换党羽/绑军权等）+ 诏书五要素检查
 *  D5 民变干预 UI 4 选项（派员/赈灾/招安/弹压）+ 粉饰文本生成 + 风闻录事接入
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  D2 · 谶纬库（Prophecies） + 天人感应强化
  // ═══════════════════════════════════════════════════════════════════

  var PROPHECY_LIBRARY = [
    { id:'dong_nan',     text:'东南有天子气',      implies:'rebellion_south',   credibility:0.6, minxinDelta:-4, huangweiDelta:-3 },
    { id:'chan_hou',     text:'圣人出河洛',         implies:'new_mandate',        credibility:0.55,minxinDelta:-5, huangweiDelta:-4 },
    { id:'hu_wang',      text:'胡人十八年必乱华',  implies:'foreign_unrest',     credibility:0.5, minxinDelta:-3, huangweiDelta:-2 },
    { id:'chang_an',     text:'望气者言长安气弱',    implies:'capital_weak',       credibility:0.5, minxinDelta:-4, huangweiDelta:-5 },
    { id:'hu_luo',       text:'白衣狼烟自北来',      implies:'invasion',           credibility:0.6, minxinDelta:-5, huangweiDelta:-3 },
    { id:'gu_shen',      text:'九鼎现于山野',        implies:'dynastic_change',    credibility:0.7, minxinDelta:-8, huangweiDelta:-6 },
    { id:'ying_zi',      text:'婴孩哭声应圣',        implies:'new_heir',           credibility:0.45,minxinDelta:+3, huangweiDelta:+2 },
    { id:'huang_tian',   text:'苍天已死黄天当立',    implies:'rebellion_critical', credibility:0.8, minxinDelta:-12,huangweiDelta:-10 },
    { id:'fei_ye',       text:'夜飞三光',            implies:'regicide',           credibility:0.6, minxinDelta:-6, huangweiDelta:-8 },
    { id:'tian_li',      text:'天裂地动',            implies:'catastrophe',        credibility:0.7, minxinDelta:-8, huangweiDelta:-7 },
    { id:'jin_long',     text:'真龙现世',            implies:'new_emperor',        credibility:0.6, minxinDelta:-10,huangweiDelta:-12 },
    { id:'bai_gu',       text:'白骨露于野',          implies:'plague_war',         credibility:0.65,minxinDelta:-7, huangweiDelta:-3 }
  ];

  function spawnProphecy(ctx) {
    var G = global.GM;
    if (!G.minxin) return null;
    if (!G.minxin.prophecy) G.minxin.prophecy = { intensity: 0, pendingTriggers: [] };
    var mxLow = (G.minxin.trueIndex || 60) < 40;
    var crisisOn = (G.huangwei && G.huangwei.lostAuthorityCrisis && G.huangwei.lostAuthorityCrisis.active) ||
                   (G.huangquan && G.huangquan.powerMinister);
    var pool = PROPHECY_LIBRARY.filter(function(p) {
      if (crisisOn) return true;
      return mxLow ? p.credibility > 0.55 : p.credibility < 0.6;
    });
    if (pool.length === 0) pool = PROPHECY_LIBRARY;
    var p = pool[Math.floor(Math.random() * pool.length)];
    var entry = {
      id: 'proph_' + (ctx.turn || 0) + '_' + Math.floor(Math.random()*10000),
      prophecyId: p.id,
      text: p.text,
      spreadTurn: ctx.turn || 0,
      credibility: p.credibility,
      implies: p.implies
    };
    G.minxin.prophecy.pendingTriggers.push(entry);
    G.minxin.prophecy.intensity = Math.min(1.0, G.minxin.prophecy.intensity + p.credibility * 0.3);
    // 效应
    if (typeof global.AuthorityEngines !== 'undefined') {
      global.AuthorityEngines.adjustMinxin('heavenSign', p.minxinDelta, '谶纬：' + p.text);
      global.AuthorityEngines.adjustHuangwei(p.minxinDelta < 0 ? 'heavenlySign' : 'auspicious', p.huangweiDelta, p.text);
    }
    if (global.addEB) global.addEB('谶纬', '童谣起：' + p.text);
    // 风闻录事
    _addFengwen({ type:'谶', text: p.text, credibility: p.credibility, turn: ctx.turn });
    return entry;
  }

  /** 天人感应强化：若民心暴跌/大灾 → 必触发天象 */
  function _tianrenGanying(ctx, mr) {
    var G = global.GM;
    if (!G.minxin) return;
    var mx = G.minxin.trueIndex || 60;
    var criticalDisaster = G.vars && G.vars.disasterLevel > 0.5;
    // 民心骤降
    var priorMx = G._priorMxForGanying || mx;
    var mxFall = priorMx - mx;
    G._priorMxForGanying = mx;
    // 触发强度
    var ganyingIntensity = 0;
    if (mx < 30) ganyingIntensity += 0.3;
    if (mxFall > 5) ganyingIntensity += 0.2;
    if (criticalDisaster) ganyingIntensity += 0.3;
    if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active) ganyingIntensity += 0.2;
    if (ganyingIntensity < 0.3) return;
    // 按概率触发
    if (Math.random() < ganyingIntensity * mr) {
      if (Math.random() < 0.5) {
        // 天象
        var AC = global.AuthorityComplete;
        if (AC && AC._tickHeavenSigns) {} // will trigger via natural tick
        // 自己触发一次天象
        _forceHeavenSign('bad');
      } else {
        // 谶纬
        spawnProphecy(ctx);
      }
    }
  }

  function _forceHeavenSign(type) {
    if (typeof global.AuthorityComplete === 'undefined') return;
    var AC = global.AuthorityComplete;
    var pool = type === 'good' ? AC.AUSPICIOUS_SIGNS : AC.HEAVEN_SIGNS;
    if (!pool || !pool.length) return;
    var sign = pool[Math.floor(Math.random() * pool.length)];
    var G = global.GM;
    if (!G.heavenSigns) G.heavenSigns = [];
    G.heavenSigns.push({ id: sign.id, name: sign.name, type: sign.type, turn: G.turn });
    if (typeof global.AuthorityEngines !== 'undefined') {
      if (sign.minxinDelta) global.AuthorityEngines.adjustMinxin(sign.type === 'good' ? 'auspicious' : 'heavenSign', sign.minxinDelta, sign.name);
      if (sign.hwDelta) global.AuthorityEngines.adjustHuangwei(sign.type === 'good' ? 'auspicious' : 'heavenlySign', sign.hwDelta, sign.name);
    }
    if (global.addEB) global.addEB(sign.type === 'good' ? '祥瑞' : '天象', sign.name + '（天人感应）');
    _addFengwen({ type: sign.type === 'good' ? '瑞' : '象', text: sign.name, credibility: 0.7, turn: G.turn });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D3 · TYRANT_AWAKENING_TRIGGERS 5 种具名触发
  // ═══════════════════════════════════════════════════════════════════

  var TYRANT_AWAKENING_TRIGGERS = [
    {
      id: 'bold_remonstrance',
      name: '骨鲠大臣死谏',
      test: function(G, ctx) {
        var recentExec = (G._abductions || []).filter(function(a){return a.status==='execute' && (ctx.turn - a.turn) < 3;});
        return recentExec.length > 0;
      },
      effect: function(G, ctx) {
        // 重臣赴死撼动皇心
        return { hwDelta: -20, eventName: '骨鲠之谏震动朝野', exposeHidden: true };
      }
    },
    {
      id: 'empty_treasury',
      name: '国库空虚诏令失效',
      test: function(G) {
        return G.guoku && G.guoku.money < 0 && G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active;
      },
      effect: function(G) {
        return { hwDelta: -15, eventName: '帑廪告罄，颂圣破产', exposeHidden: true };
      }
    },
    {
      id: 'rebellion_overwhelming',
      name: '民变压境警钟',
      test: function(G) {
        return (G.minxin && (G.minxin.revolts || []).filter(function(r){return r.level>=4 && r.status==='ongoing';}).length > 0);
      },
      effect: function(G) {
        return { hwDelta: -25, eventName: '四海鼎沸，暴政终悟', exposeHidden: true };
      }
    },
    {
      id: 'heaven_fury',
      name: '天象连续示警',
      test: function(G, ctx) {
        var recentBad = (G.heavenSigns || []).filter(function(s){return s.type === 'bad' && (ctx.turn - s.turn) < 6;});
        return recentBad.length >= 3;
      },
      effect: function(G) {
        return { hwDelta: -18, eventName: '天象频见，帝心动摇', exposeHidden: true };
      }
    },
    {
      id: 'heir_death',
      name: '太子/皇子夭折触心',
      test: function(G) {
        return (G.chars || []).some(function(c) { return c.alive === false && c.role === 'heir' && (G.turn - (c._deathTurn || 0)) < 2; });
      },
      effect: function(G) {
        return { hwDelta: -12, eventName: '储君夭折，暴君渐悟', exposeHidden: true };
      }
    }
  ];

  function _checkTyrantAwakening(ctx, mr) {
    var G = global.GM;
    var hw = G.huangwei;
    if (!hw || !hw.tyrantSyndrome || !hw.tyrantSyndrome.active) return;
    var ts = hw.tyrantSyndrome;
    if (ts._awakened) return;
    for (var i = 0; i < TYRANT_AWAKENING_TRIGGERS.length; i++) {
      var trig = TYRANT_AWAKENING_TRIGGERS[i];
      try {
        if (trig.test(G, ctx)) {
          var eff = trig.effect(G, ctx);
          _applyAwakening(G, ts, hw, eff, trig);
          return trig;
        }
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'awaken') : console.error('[awaken]', trig.id, e); }
    }
  }

  function _applyAwakening(G, ts, hw, eff, trig) {
    ts._awakened = true;
    ts._awakenTrigger = trig.id;
    ts._awakenTurn = G.turn || 0;
    hw.index = Math.max(0, hw.index + (eff.hwDelta || -20));
    if (eff.exposeHidden) {
      if (G.minxin) G.minxin.trueIndex = Math.max(0, G.minxin.trueIndex - (ts.hiddenDamage.unreportedMinxinDrop || 0));
      if (G.corruption && typeof G.corruption === 'object') G.corruption.overall = Math.min(100, (G.corruption.overall || 30) + (ts.hiddenDamage.concealedCorruption || 0));
      ts.hiddenDamage = {};
      ts.flatteryMemorialRatio = 0;
    }
    ts.active = false;
    if (global.addEB) global.addEB('皇威', eff.eventName + '（暴君觉醒：' + trig.name + '）');
    _addFengwen({ type:'廷议', text: eff.eventName, credibility: 0.9, turn: G.turn });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D4 · 权臣反击策略 + 诏书五要素检查
  // ═══════════════════════════════════════════════════════════════════

  /** 诏书五要素检查（专制段专用） */
  function checkDecreeFiveElements(text) {
    var missing = [];
    if (!/(春|夏|秋|冬|月|日|岁|限|期|即日|立)/.test(text)) missing.push('时日');
    if (!/(京|省|府|县|道|路|州|全国|天下|边|畿|江南|河北)/.test(text)) missing.push('地点');
    if (!/(尚书|侍郎|令|丞|御史|将军|总督|巡抚|知|提督|宣抚|节度)/.test(text)) missing.push('执行人');
    if (!/(帑|银|钱|粮|布|万|石|支|拨|出|由.*出|从.*支)/.test(text)) missing.push('经费');
    if (!/(限|考|核|验|察|赏|罚|功|过|黜陟|迁)/.test(text)) missing.push('考核');
    return { ok: missing.length === 0, missing: missing };
  }

  /** 玩家 7 种反击策略（当权臣段时） */
  var COUNTER_STRATEGIES = {
    secret_edict: {
      name: '密诏', description: '绕过权臣直发信得过的官员',
      cost: { huangquan: -2 },
      effect: function(G, target) {
        var pm = G.huangquan && G.huangquan.powerMinister;
        if (!pm) return { ok: false, reason: '无权臣可反' };
        // 成功概率 = 0.5 + (100 - pm.controlLevel * 100) / 200
        var successRate = 0.5 + (1 - pm.controlLevel) * 0.4;
        if (Math.random() < successRate) {
          pm.controlLevel = Math.max(0, pm.controlLevel - 0.1);
          if (typeof G.huangquan === 'object') G.huangquan.index = Math.min(100, G.huangquan.index + 5);
          if (global.addEB) global.addEB('密诏', '密诏见效，权臣 ' + pm.name + ' 控制力 -0.1');
          return { ok: true, successRate: successRate };
        } else {
          pm.controlLevel = Math.min(1, pm.controlLevel + 0.05);
          if (global.addEB) global.addEB('密诏', '密诏泄露，权臣 ' + pm.name + ' 反扑');
          return { ok: false, leaked: true };
        }
      }
    },
    rotate_officials: {
      name: '官员轮换', description: '削权臣党羽的中枢位',
      cost: { huangquan: -3, partyStrife: 5 },
      effect: function(G) {
        var pm = G.huangquan && G.huangquan.powerMinister;
        if (!pm || !pm.faction) return { ok: false };
        // 随机调走 2 名党羽
        var movedCount = 0;
        pm.faction.slice(0, 2).forEach(function(name) {
          var ally = (G.chars || []).find(function(c){return c.name===name;});
          if (ally) {
            ally.officialTitle = (ally.officialTitle || '') + '(外调)';
            ally._tenureMonths = 0;
            movedCount++;
          }
        });
        pm.faction = pm.faction.slice(movedCount);
        pm.controlLevel = Math.max(0, pm.controlLevel - 0.08 * movedCount);
        if (global.addEB) global.addEB('官员轮换', '外调权臣党羽 ' + movedCount + ' 人');
        return { ok: true, moved: movedCount };
      }
    },
    military_reform_against_pm: {
      name: '兵权回收', description: '重新组建禁军直属皇帝，剥离权臣军权',
      cost: { guoku: 500000, huangquan: 5 },
      effect: function(G) {
        if (G.guoku && G.guoku.money < 500000) return { ok: false, reason: '帑廪不足' };
        if (G.guoku) G.guoku.money -= 500000;
        var pm = G.huangquan && G.huangquan.powerMinister;
        if (pm) pm.controlLevel = Math.max(0, pm.controlLevel - 0.15);
        if (typeof G.huangquan === 'object' && G.huangquan.subDims) {
          G.huangquan.subDims.military.value = Math.min(100, G.huangquan.subDims.military.value + 15);
        }
        if (global.addEB) global.addEB('兵权', '重建禁军，权臣军权受挫');
        return { ok: true };
      }
    },
    court_spy: {
      name: '密探监视', description: '派厂卫侦察权臣动静',
      cost: { guoku: 100000 },
      effect: function(G) {
        if (G.guoku && G.guoku.money < 100000) return { ok: false, reason: '帑廪不足' };
        if (G.guoku) G.guoku.money -= 100000;
        // 派出 → 若有 investigate 存在也可链式
        G._courtSpyActive = true;
        G._courtSpyExpire = (G.turn || 0) + 12;
        if (global.addEB) global.addEB('密探', '厂卫侦察权臣，一年内必有所得');
        return { ok: true };
      }
    },
    marriage_alliance: {
      name: '联姻拉拢', description: '嫁宗女/娶权臣女，换一时安稳',
      cost: { huangwei: -3 },
      effect: function(G) {
        var pm = G.huangquan && G.huangquan.powerMinister;
        if (!pm) return { ok: false };
        pm.appeasement = (pm.appeasement || 0) + 0.3;
        if (pm.controlLevel < 0.7) pm.controlLevel = Math.max(0, pm.controlLevel - 0.05);
        if (global.addEB) global.addEB('联姻', '与权臣结亲，暂得安稳');
        return { ok: true };
      }
    },
    public_humiliation: {
      name: '朝堂羞辱', description: '公开斥责权臣削其威',
      cost: { huangwei: 3, partyStrife: 10 },
      effect: function(G) {
        var pm = G.huangquan && G.huangquan.powerMinister;
        if (!pm) return { ok: false };
        // 若皇威高则奏效，若低则反噬
        var hwIndex = G.huangwei && G.huangwei.index || 50;
        if (hwIndex > 60) {
          pm.controlLevel = Math.max(0, pm.controlLevel - 0.1);
          if (global.addEB) global.addEB('朝堂', '陛下当廷斥 ' + pm.name + '，威加海内');
          return { ok: true };
        } else {
          pm.controlLevel = Math.min(1, pm.controlLevel + 0.1);
          if (typeof G.huangwei === 'object') G.huangwei.index = Math.max(0, G.huangwei.index - 8);
          if (global.addEB) global.addEB('朝堂', '斥责反遭顶撞，皇威更挫');
          return { ok: false, backfire: true };
        }
      }
    },
    execute_power_minister: {
      name: '清洗权臣', description: '极端手段：赐死或抄家',
      cost: { huangquan: 10, huangwei: 5, partyStrife: 20 },
      effect: function(G) {
        var pm = G.huangquan && G.huangquan.powerMinister;
        if (!pm) return { ok: false };
        // 需皇权足够
        if (G.huangquan.index < 50) {
          return { ok: false, reason: '皇权不足，冒险行事恐生变' };
        }
        var target = (G.chars || []).find(function(c){return c.name===pm.name;});
        if (target) target.alive = false;
        G.huangquan.powerMinister = null;
        if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.triggerHuangquanEvent) {
          global.AuthorityComplete.triggerHuangquanEvent('executePM');
        }
        if (global.addEB) global.addEB('清洗', '诛权臣 ' + pm.name + '，朝廷为之肃然');
        return { ok: true };
      }
    }
  };

  function invokeCounterStrategy(strategyId, opts) {
    var G = global.GM;
    var strat = COUNTER_STRATEGIES[strategyId];
    if (!strat) return { ok: false, reason: '未知策略' };
    // 扣成本
    if (strat.cost) {
      Object.keys(strat.cost).forEach(function(k) {
        if (k === 'guoku' && G.guoku) G.guoku.money -= strat.cost[k];
        else if (k === 'huangquan' && global._adjAuthority) global._adjAuthority('huangquan', strat.cost[k]);
        else if (k === 'huangwei' && global._adjAuthority) global._adjAuthority('huangwei', strat.cost[k]);
        else if (k === 'partyStrife') G.partyStrife = Math.min(100, (G.partyStrife || 30) + strat.cost[k]);
      });
    }
    var result = strat.effect(G, opts);
    return Object.assign({ strategyId: strategyId }, result);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D5 · 民变干预 UI + 粉饰 AI + 风闻录事
  // ═══════════════════════════════════════════════════════════════════

  function openRevoltInterventionPanel(revoltId) {
    var G = global.GM;
    if (!G.minxin || !G.minxin.revolts) {
      if (global.toast) global.toast('无民变信息');
      return;
    }
    var ongoing = G.minxin.revolts.filter(function(r){return r.status==='ongoing';});
    if (ongoing.length === 0) {
      if (global.toast) global.toast('天下太平');
      return;
    }
    var revolt = revoltId ? ongoing.find(function(r){return r.id===revoltId;}) : ongoing[0];
    if (!revolt) return;
    var levelDef = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.REVOLT_LEVELS) ?
                   global.AuthorityComplete.REVOLT_LEVELS[revolt.level - 1] : { name: '民变', scale: revolt.scale };
    var body = '<div style="max-width:560px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--vermillion-300);margin-bottom:0.4rem;letter-spacing:0.1em;">⚔ 民变干预</div>';
    body += '<div style="padding:10px;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:4px;margin-bottom:0.8rem;">';
    body += '<div style="font-size:0.84rem;color:var(--vermillion-300);">' + (revolt.region || '某地') + ' · ' + levelDef.name + '</div>';
    body += '<div style="font-size:0.76rem;color:var(--ink-300);margin-top:4px;">规模 ' + (revolt.scale || 0).toLocaleString() + ' · 起于 ' + (revolt.turn || 0) + ' 回合前</div>';
    body += '<div style="font-size:0.72rem;color:#d4be7a;margin-top:4px;">' + (levelDef.description || '') + '</div>';
    body += '</div>';
    // 四干预
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    body += _interventionButton('investigate', '派员查访', '遣御史/按察使查实情 · 5 万钱', revolt.id);
    body += _interventionButton('relief', '赈济绥民', '发帑赈粥抚怀 · 20 万钱 · 民心 +3', revolt.id);
    body += _interventionButton('pacify', '招安赦免', '许以官职或免罪 · 皇威 -2 但民心 +5', revolt.id);
    body += _interventionButton('suppress', '强力镇压', '发兵剿灭 · 需兵力 · 民心 -6 但皇威 +4', revolt.id);
    body += '</div>';
    body += '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19015;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--vermillion);border-radius:6px;padding:1.0rem;width:92%;max-width:580px;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  function _interventionButton(action, label, hint, revoltId) {
    return '<button class="btn" style="font-size:0.74rem;padding:10px;text-align:left;" onclick="PhaseD._interveneRevolt(\''+revoltId+'\',\''+action+'\');this.parentNode.parentNode.parentNode.remove();">' +
      '<div style="color:var(--gold-300);font-size:0.8rem;">' + label + '</div>' +
      '<div style="color:#d4be7a;font-size:0.7rem;margin-top:2px;">' + hint + '</div>' +
    '</button>';
  }

  function interveneRevolt(revoltId, action) {
    var G = global.GM;
    if (!G.minxin || !G.minxin.revolts) return { ok: false };
    var r = G.minxin.revolts.find(function(x){return x.id===revoltId;});
    if (!r) return { ok: false };
    if (action === 'investigate') {
      if (G.guoku && G.guoku.money < 50000) return { ok: false, reason: '帑廪不足' };
      if (G.guoku) G.guoku.money -= 50000;
      r._investigated = true;
      // 查访可能发现真实原因
      r._realCause = (G.vars && G.vars.disasterLevel > 0.3) ? '灾荒' :
                     (G.corruption && G.corruption.overall > 55) ? '贪官' :
                     (G.population && G.population.corvee && G.population.corvee.recentDeaths > 5000) ? '苛役' : '税重';
      if (global.addEB) global.addEB('民变', '御史查访 ' + (r.region || '某地') + '，果为 ' + r._realCause);
      return { ok: true, cause: r._realCause };
    }
    if (action === 'relief') {
      if (G.guoku && G.guoku.money < 200000) return { ok: false, reason: '帑廪不足' };
      if (G.guoku) G.guoku.money -= 200000;
      if (global._adjAuthority) global._adjAuthority('minxin', 3);
      r._suppressed = true;
      r.status = 'suppressed';
      if (global.addEB) global.addEB('赈济', '赈 ' + (r.region || '某地') + ' 民变自散');
      _addFengwen({ type:'赈', text:(r.region||'某地') + '赈济既罢', credibility: 0.9, turn: G.turn });
      return { ok: true };
    }
    if (action === 'pacify') {
      if (global._adjAuthority) { global._adjAuthority('huangwei', -2); global._adjAuthority('minxin', 5); }
      r._pacified = true;
      r.status = 'pacified';
      if (global.addEB) global.addEB('招安', '招抚 ' + (r.region || '某地') + ' 民变头目，授以小官');
      // 风闻录事：招安换苟安
      _addFengwen({ type:'招', text: '招抚 ' + (r.region || '某地') + '，首领授官', credibility: 0.8, turn: G.turn });
      return { ok: true };
    }
    if (action === 'suppress') {
      // 需兵力估算
      var requiredTroops = (r.scale || 1000) * 2;
      // 调兵（简化）
      r._suppressionOrder = { strength: requiredTroops, turn: G.turn || 0 };
      if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.suppressRevolt) {
        global.AuthorityComplete.suppressRevolt(r.id, requiredTroops);
      }
      if (global._adjAuthority) { global._adjAuthority('minxin', -6); global._adjAuthority('huangwei', 4); }
      if (global.addEB) global.addEB('镇压', '发兵 ' + requiredTroops + ' 讨 ' + (r.region || '某地'));
      _addFengwen({ type:'兵', text:'征伐 ' + (r.region||'某地') + ' 民变', credibility: 0.85, turn: G.turn });
      return { ok: true, troops: requiredTroops };
    }
    return { ok: false };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  粉饰文本生成（暴君段地方官上奏时的"粉饰话术"）
  // ═══════════════════════════════════════════════════════════════════

  var FLATTERY_PHRASES = [
    '陛下圣明，臣望尘莫及',
    '四海升平，万邦来仪',
    '民风淳厚，歌颂圣德',
    '州府无事，阴阳调和',
    '田野丰登，牛马衔毛',
    '天象祥瑞，庆云屡现',
    '边陲安靖，朝贡络绎',
    '刑狱清省，路不拾遗',
    '陛下一诏，万民景从',
    '德比尧舜，泽被苍生'
  ];

  function generateFlatteryMemorial(ctx) {
    var G = global.GM;
    var hw = G.huangwei;
    if (!hw || !hw.tyrantSyndrome || !hw.tyrantSyndrome.active) return null;
    // 随机 3 条粉饰语
    var picks = [];
    var pool = FLATTERY_PHRASES.slice();
    while (picks.length < 3 && pool.length > 0) {
      picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    var memorial = {
      id: 'flattery_' + (ctx.turn || 0) + '_' + Math.floor(Math.random()*10000),
      turn: ctx.turn || 0,
      drafter: _randomOfficial(),
      text: picks.join('；') + '。',
      _isFlattery: true,
      type: 'peace_report'
    };
    if (!G._memorialNotifications) G._memorialNotifications = [];
    G._memorialNotifications.push({ id: memorial.id, drafter: memorial.drafter, summary: memorial.text.slice(0, 40) + '…', isFlattery: true });
    return memorial;
  }

  function _randomOfficial() {
    var G = global.GM;
    var officials = (G.chars || []).filter(function(c){return c.alive !== false && c.officialTitle;});
    if (officials.length === 0) return '地方官';
    return officials[Math.floor(Math.random() * officials.length)].name + (officials[0].officialTitle ? '(' + officials[0].officialTitle + ')' : '');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  风闻录事入口
  // ═══════════════════════════════════════════════════════════════════

  function _addFengwen(entry) {
    var G = global.GM;
    if (!G._fengwenRecord) G._fengwenRecord = [];
    entry.id = entry.id || 'fw_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000);
    entry.turn = entry.turn || G.turn || 0;
    G._fengwenRecord.push(entry);
    if (G._fengwenRecord.length > 100) G._fengwenRecord.splice(0, G._fengwenRecord.length - 100);
    // 通过 addEB 输出
    if (global.addEB) global.addEB('风闻', '[' + entry.type + '] ' + entry.text);
  }

  function getFengwenRecent(limit) {
    var G = global.GM;
    if (!G._fengwenRecord) return [];
    return G._fengwenRecord.slice(-Math.abs(limit || 20)).reverse();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tianrenGanying(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseD] ganying:') : console.error('[phaseD] ganying:', e); }
    try { _checkTyrantAwakening(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseD] awaken:') : console.error('[phaseD] awaken:', e); }
    // 暴君段每回合 20% 概率产生粉饰奏疏
    try {
      var G = global.GM;
      if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active && Math.random() < 0.2 * mr) {
        generateFlatteryMemorial(ctx);
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseD] flattery:') : console.error('[phaseD] flattery:', e); }
    // 民心暴跌 + 高压下 1% 概率出谶纬
    try {
      var G2 = global.GM;
      if (G2.minxin && G2.minxin.trueIndex < 35 && Math.random() < 0.01 * mr) {
        spawnProphecy(ctx);
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseD] prophecy:') : console.error('[phaseD] prophecy:', e); }
  }

  function init() {
    // 无需专门 init
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseD = {
    init: init,
    tick: tick,
    spawnProphecy: spawnProphecy,
    checkTyrantAwakening: _checkTyrantAwakening,
    checkDecreeFiveElements: checkDecreeFiveElements,
    invokeCounterStrategy: invokeCounterStrategy,
    openRevoltInterventionPanel: openRevoltInterventionPanel,
    _interveneRevolt: interveneRevolt,
    generateFlatteryMemorial: generateFlatteryMemorial,
    addFengwen: _addFengwen,
    getFengwenRecent: getFengwenRecent,
    PROPHECY_LIBRARY: PROPHECY_LIBRARY,
    TYRANT_AWAKENING_TRIGGERS: TYRANT_AWAKENING_TRIGGERS,
    COUNTER_STRATEGIES: COUNTER_STRATEGIES,
    FLATTERY_PHRASES: FLATTERY_PHRASES,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
