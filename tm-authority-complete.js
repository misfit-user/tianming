// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-authority-complete.js — 皇威/皇权/民心 全补完（P0+P1+P2）
 *
 * 补完 设计方案-皇威系统/皇权系统/民心系统/变量联动总表 中所有未实施或部分实施部分：
 *
 * P0:
 *  1. 权臣 NPC 系统（选定/诏书拦截/反击/终局）
 *  2. 民变 5 级升级链（流言→聚啸→暴动→起义→改朝）
 *  3. 暴君综合症深化（奏疏颂圣过滤/诏书过度执行/隐藏代价）
 *  4. 失威危机深化（抗疏暴增/地方观望/外邦蠢动）
 *  5. 民心 byRegion/byClass 矩阵
 * P1:
 *  6. 14 皇威源触发 hook
 *  7. 8 皇权源触发 hook
 *  8. 民心 7 源补完（judicialFairness/security/socialMobility/culturalPolicy/heavenSign/auspicious/socialMobility）
 *  9. 民心 6 后果补完（征税效率/征兵/逃亡率/地方叛附/士人投效/改革容忍）
 *  10. 皇权 3 后果（进谏自由/奏疏质量/改革难度）
 *  11. 执行度皇威乘数
 *  12. 皇权×皇威四象限判定
 *  13. 天象/祥瑞/天人感应
 *  14. 皇权 subDims 四维
 * P2:
 *  15. 42 联动矩阵补剩 19 项
 *  16. 民心感知随机偏差
 */
(function(global) {
  'use strict';

  function _turnsForMonthsLocal(months) {
    return (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(months) : months;
  }

  function _corrIndex(G) {
    var c = G && G.corruption;
    if (typeof c === 'number') return c;
    if (!c || typeof c !== 'object') return 30;
    if (typeof c.trueIndex === 'number') return c.trueIndex;
    if (typeof c.overall === 'number') return c.overall;
    if (typeof c.index === 'number') return c.index;
    return 30;
  }

  function _setCorrIndex(G, value) {
    if (!G || !G.corruption || typeof G.corruption !== 'object') return;
    var next = Math.max(0, Math.min(100, Number(value) || 0));
    G.corruption.trueIndex = next;
    G.corruption.overall = next;
    if (G.corruption.perceivedIndex === undefined) G.corruption.perceivedIndex = next;
  }

  function _addCorrIndex(G, delta) {
    _setCorrIndex(G, _corrIndex(G) + (Number(delta) || 0));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P0-5 · 民心 byRegion / byClass 矩阵 — 扩展初始化
  // ═══════════════════════════════════════════════════════════════════

  function _initMinxinMatrix() {
    var mx = global.GM && global.GM.minxin;
    if (!mx) return;
    // byRegion
    if (Object.keys(mx.byRegion || {}).length === 0) {
      (global.GM.regions || []).forEach(function(r) {
        if (!r || !r.id) return;
        mx.byRegion[r.id] = { index: typeof mx.trueIndex === 'number' ? mx.trueIndex : 60, trend: 'stable', factors: {} };
      });
    }
    // byClass（对齐 HujiDeepFill.SOCIAL_CLASSES）
    if (Object.keys(mx.byClass || {}).length === 0) {
      var classes = ['imperial','gentry_high','gentry_mid','scholar','merchant','landlord','peasant_self','peasant_tenant','craftsman','debased','clergy','slave'];
      classes.forEach(function(c) {
        mx.byClass[c] = { index: typeof mx.trueIndex === 'number' ? mx.trueIndex : 60, trend: 'stable', factors: {} };
      });
    }
  }

  function _tickMinxinMatrix(ctx, mr) {
    var G = global.GM;
    var mx = G.minxin;
    if (!mx) return;
    // D·并账：各省 byRegion.index 不再独立演化 / 向全国均值回归（那套既被回合末 P-UIMX 覆盖、又跟真值打架），
    //   改为单一镜像 adminHierarchy 的 div.minxin 真值——div.minxin 才是治本/聚合/民变共同认的源。
    //   解析不到对应 division 的旧条目（命名空间对不上）按兵不动，不致误改。
    //   注：局部灾情/民怨对民心的压力，应在 adjustMinxin 端落到 div.minxin（真值源）、而非这层派生缓存——留待后续接入。
    var _PUm = global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils;
    Object.keys(mx.byRegion || {}).forEach(function(rid) {
      var reg = mx.byRegion[rid];
      if (!reg) return;
      var div = (_PUm && typeof _PUm.findDivisionByNameFuzzy === 'function') ? _PUm.findDivisionByNameFuzzy(G, rid) : ((_PUm && typeof _PUm.findDivisionByNameOrId === 'function') ? _PUm.findDivisionByNameOrId(G, rid) : null); // fuzzy 优先(认"陕西↔陕西布政使司")·OrId 兜底
      if (div && typeof div.minxin === 'number') {
        var prev = reg.index;
        reg.index = Math.max(0, Math.min(100, div.minxin));
        reg.trend = reg.index > prev ? 'rising' : reg.index < prev ? 'falling' : 'stable';
      }
    });
    // 每阶层独立演化
    Object.keys(mx.byClass || {}).forEach(function(cl) {
      var cls = mx.byClass[cl];
      var delta = 0;
      // 高阶层被打压时民心降
      if ((cl === 'gentry_high' || cl === 'landlord') && G.huangquan && G.huangquan.index > 75) delta -= 0.1 * mr;
      // 低阶层在饥荒时民心降
      if ((cl === 'peasant_self' || cl === 'peasant_tenant' || cl === 'debased') && G.vars && G.vars.disasterLevel > 0.3) delta -= 0.5 * mr;
      // 商人在货币稳定时民心升
      if (cl === 'merchant' && G.currency && G.currency.market && Math.abs(G.currency.market.inflation || 0) < 0.05) delta += 0.1 * mr;
      // 士人阶层在选贤时升
      if (cl === 'scholar' && G._recentKeju) delta += 0.3 * mr;
      delta += (mx.trueIndex - cls.index) * 0.05 * mr;
      cls.index = Math.max(0, Math.min(100, cls.index + delta));
      cls.trend = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable';
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P0-1 · 权臣 NPC 系统
  // ═══════════════════════════════════════════════════════════════════

  // S1a·权臣复活开关（默认关）。原 `_tenureMonths` 全代码从不递增——只在轮换(tm-prophecy:285)被设 0、
  //   被权臣候选(≥24月·_detectPowerMinister)与坐大 drain(>60月·tm-authority-engines)读取——故候选恒空、
  //   整套截留奏疏/自拟诏书/篡位终局形同虚设。关 → _tenureMonths 恒 0 = 零回归；
  //   开 → 任职月数按月真递增，权臣系统活起来。启用：P.conf.powerMinisterEnabled = true（或 P.ai.同名）。
  function _powerMinisterEnabled() {
    try {
      var P = global.P || {};
      var ai = P.ai || {}, conf = P.conf || {};
      return !!(ai.powerMinisterEnabled || conf.powerMinisterEnabled);
    } catch (e) { return false; }
  }

  var _OFF_TENURE_RETIRE_RE = /致仕|乞骸|休致|归田|丁忧|守制/;

  // S1a·任职月数递增（修死锁）：在任者 _tenureMonths 按月(mr)累加；失官/致仕者归零（重置权臣钟）。
  //   置于 _detectPowerMinister 之前，使本回合新增任期当回合即被候选判定读到。
  function _tickOfficeTenure(ctx, mr) {
    if (!_powerMinisterEnabled()) return;
    var G = global.GM;
    if (!G || !Array.isArray(G.chars)) return;
    var step = (mr > 0) ? mr : 1;
    for (var i = 0; i < G.chars.length; i++) {
      var c = G.chars[i];
      if (!c || c.alive === false) continue;
      var title = c.officialTitle || '';
      if (title && !_OFF_TENURE_RETIRE_RE.test(title)) {
        c._tenureMonths = (c._tenureMonths || 0) + step;
      } else if (c._tenureMonths) {
        c._tenureMonths = 0;   // 失官/致仕/守制 → 权臣资历清零
      }
    }
  }

  function _detectPowerMinister(ctx) {
    var G = global.GM;
    if (!G.huangquan || !G.chars) return null;
    // 已有权臣？
    if (G.huangquan.powerMinister && G.huangquan.powerMinister.name) {
      var existing = G.chars.find(function(c) { return c.name === G.huangquan.powerMinister.name && c.alive !== false; });
      if (existing) return G.huangquan.powerMinister;
      // 已故：清除
      G.huangquan.powerMinister = null;
    }
    // 候选：长期在宰相/首辅位，野心高；
    // 宦官专权(2026-07-02)：内廷近侍(role==='eunuch'·引擎通用字段)居高品要职(三四品以上·品级经 TMPromotion 解析·
    //   掌印/秉笔等专名归剧本数据)亦可坐大——与外朝权臣同闸(powerMinisterEnabled)同弧(截留/自拟/篡位)·事件文案区分内竖。
    var candidates = G.chars.filter(function(c) {
      if (c.alive === false) return false;
      var title = c.officialTitle || '';
      var outer = /宰相|丞相|首辅|摄政|大将军|太师/.test(title);
      var inner = false;
      if (!outer && c.role === 'eunuch' && title && !_OFF_TENURE_RETIRE_RE.test(title)) {
        try {
          var lv = (global.TMPromotion && typeof global.TMPromotion.resolveRankLevel === 'function')
            ? global.TMPromotion.resolveRankLevel(c, G) : (c.rankLevel || 0);
          inner = (lv > 0 && lv <= 4);
        } catch (e) { inner = false; }
      }
      if (!outer && !inner) return false;
      if ((c._tenureMonths || 0) < 24) return false;
      if ((c.ambition || 50) < 65) return false;
      c._pmInnerCourt = inner && !outer;   // 供事件文案与后续内廷特有机制区分
      return true;
    });
    if (candidates.length === 0) return null;
    // 选野心最高
    candidates.sort(function(a,b){ return (b.ambition||50) - (a.ambition||50); });
    var pm = candidates[0];
    G.huangquan.powerMinister = {
      name: pm.name,
      activatedTurn: ctx.turn,
      controlLevel: 0.3,
      faction: [],
      interceptions: 0,
      counterEdicts: 0,
      innerCourt: !!pm._pmInnerCourt
    };
    if (global.addEB) global.addEB('皇权', pm._pmInnerCourt ? (pm.name + ' 内竖弄权（内廷窃柄·皇权旁落征兆）') : (pm.name + ' 坐大为权臣（皇权旁落征兆）'));
    return G.huangquan.powerMinister;
  }

  function _tickPowerMinister(ctx, mr) {
    var G = global.GM;
    if (!G.huangquan) return;
    var pm = G.huangquan.powerMinister;
    if (!pm) return;
    var ch = G.chars && G.chars.find(function(c) { return c.name === pm.name; });
    if (!ch || ch.alive === false) { G.huangquan.powerMinister = null; return; }
    // controlLevel 随时间上升（若皇权弱）
    // ③·D2 余级联：缙绅离心（clout 加权合法性崩·权贵弃君）→ 权贵倒向强人·权臣坐大加速（+50%·默认 1 回归安全·纯读 _legitimacy·不碰皇权）
    var _pmLegBoost = (G._legitimacy && G._legitimacy.flag === '缙绅离心') ? 1.5 : 1;
    if (G.huangquan.index < 60) pm.controlLevel = Math.min(1.0, pm.controlLevel + 0.01 * mr * _pmLegBoost);
    else if (G.huangquan.index > 80) pm.controlLevel = Math.max(0, pm.controlLevel - 0.02 * mr);
    // 招揽党羽
    var allies = G.chars.filter(function(c) {
      if (c.alive === false) return false;
      if (c.name === pm.name) return false;
      var imp = c._impressions && c._impressions[pm.name];
      return imp && imp.favor > 10;
    });
    pm.faction = allies.slice(0, 10).map(function(c){return c.name;});
    // 拦截诏书（皇权 < 40 时，50% 拦截率）
    if (G.huangquan.index < 40 && Math.random() < pm.controlLevel * 0.5) {
      if (G._pendingMemorials && G._pendingMemorials.length > 0) {
        var targetMemo = G._pendingMemorials.filter(function(m){return m.status === 'drafted';})[0];
        if (targetMemo) {
          targetMemo.intercepted = true;
          targetMemo.interceptedBy = pm.name;
          pm.interceptions++;
          if (global.addEB) global.addEB('权臣', pm.name + ' 截留奏疏：' + (targetMemo.subject || ''));
        }
      }
    }
    // 自拟诏书（皇权 < 30）
    if (G.huangquan.index < 30 && Math.random() < pm.controlLevel * 0.3) {
      _powerMinisterCounterEdict(pm, ctx);
    }
    // 终局：权臣篡位或被清洗
    if (pm.controlLevel > 0.9 && Math.random() < 0.05 * mr) {
      _powerMinisterEndgame(pm, 'usurpation', ctx);
    }
  }

  function _powerMinisterCounterEdict(pm, ctx) {
    var G = global.GM;
    pm.counterEdicts++;
    if (!G._pendingMemorials) G._pendingMemorials = [];
    G._pendingMemorials.push({
      id: 'pm_edict_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
      typeKey: 'office_reform',
      typeName: '权臣自拟',
      subject: pm.name + ' 自拟诏命',
      drafter: pm.name,
      turn: ctx.turn,
      status: 'drafted',
      draftText: pm.name + ' 奏：臣拟起用某官…… 伏乞圣裁。',
      _fromPowerMinister: true
    });
    if (global.addEB) global.addEB('权臣', pm.name + ' 自拟诏命，架空皇权');
  }

  function _powerMinisterEndgame(pm, mode, ctx) {
    var G = global.GM;
    if (mode === 'usurpation') {
      // 篡位
      if (global.addEB) global.addEB('权臣', pm.name + ' 篡位大逆！天命倾移');
      if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.setHuangquan) {
        global.AuthorityEngines.setHuangquan(5, '\u6743\u81e3\u7be1\u4f4d', { source:'power-minister-usurpation' });
      } else if (typeof G.huangquan === 'object') G.huangquan.index = 5;
      if (typeof G.huangwei === 'object') G.huangwei.index = 10;
      if (typeof G.minxin === 'object') G.minxin.trueIndex = Math.max(0, G.minxin.trueIndex - 30);
      G._gameOver = { type: 'usurped_by_power_minister', name: pm.name, turn: ctx.turn };
    } else if (mode === 'purged') {
      if (typeof global.AuthorityEngines !== 'undefined') global.AuthorityEngines.executePurge(pm.name);
      G.huangquan.powerMinister = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P0-2 · 民变 5 级升级链
  // ═══════════════════════════════════════════════════════════════════

  var REVOLT_LEVELS = [
    { id:1, name:'流言', scale:500,     threshold:35, threat:'low',     description:'茶馆酒肆议论纷纷' },
    { id:2, name:'聚啸', scale:5000,    threshold:25, threat:'medium',  description:'山寨草寇，官军可平' },
    { id:3, name:'暴动', scale:30000,   threshold:18, threat:'high',    description:'占据城镇，威胁州府' },
    { id:4, name:'起义', scale:200000,  threshold:12, threat:'critical',description:'旗号响亮，建政授官' },
    { id:5, name:'改朝', scale:1000000, threshold:5,  threat:'doom',    description:'问鼎中原，王朝终结' }
  ];

  // 区引用 → 该省 div.minxin 真值（A·并账地基）。r.region 可能是行政区名("陕西")或 div.id，
  //   复用 PathUtils.findDivisionByNameOrId(按 name|id 深度匹配) 落到 adminHierarchy 叶子取真值源 div.minxin；
  //   解析不到（旧民变挂的 G.regions id 对不上 / 无 adminHierarchy）→ 回退全国 fallback，不致崩。
  function _localMinxinForRegion(G, regionRef, fallback) {
    try {
      var PU = global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils;
      if (PU && regionRef != null && regionRef !== '') {
        var _fn = (typeof PU.findDivisionByNameFuzzy === 'function') ? PU.findDivisionByNameFuzzy : ((typeof PU.findDivisionByNameOrId === 'function') ? PU.findDivisionByNameOrId : null); // fuzzy 优先(认"陕西↔陕西布政使司")·OrId 兜底
        var d = _fn ? _fn(G, regionRef) : null;
        if (d && typeof d.minxin === 'number') return d.minxin;
      }
    } catch (_e) {}
    return fallback;
  }

  function _tickRevoltUpgrade(ctx, mr) {
    var mx = global.GM.minxin;
    if (!mx || !mx.revolts) return;
    mx.revolts.forEach(function(r) {
      if (r.status !== 'ongoing') return;
      // C·民变判级读「该省」真值 div.minxin（解析不到回退全国 trueIndex）——每个民变按自己所在省的民心定级，不再被全国均值掩盖
      var localMx = _localMinxinForRegion(global.GM, r.region, mx.trueIndex);
      // 初次：按阈值确定起始级别
      if (!r.level) {
        var idx = localMx;
        r.level = 1;
        for (var i = 0; i < REVOLT_LEVELS.length; i++) {
          if (idx <= REVOLT_LEVELS[i].threshold) r.level = REVOLT_LEVELS[i].id;
        }
        r.scale = REVOLT_LEVELS[r.level - 1].scale;
      }
      // 升级条件：民心仍低 + 官军未剿 + 时间够长
      var currentDef = REVOLT_LEVELS[r.level - 1];
      if (r.level < 5) {
        var upgradeReady = (ctx.turn - r.turn) > _turnsForMonthsLocal(6) && localMx < currentDef.threshold && !r._suppressed;
        if (upgradeReady && Math.random() < 0.15 * mr) {
          r.level++;
          r.scale = REVOLT_LEVELS[r.level - 1].scale;
          if (global.addEB) global.addEB('民变', (r.region || '某地') + ' 升级为 ' + REVOLT_LEVELS[r.level - 1].name);
          // 高级别民变影响更大
          if (r.level >= 4) {
            if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangquan) {
              global.AuthorityEngines.adjustHuangquan('factionConsuming', -5, '\u9ad8\u7ea7\u6c11\u53d8\u5347\u7ea7');
            } else if (typeof global.GM.huangquan === 'object') global.GM.huangquan.index = Math.max(0, global.GM.huangquan.index - 5);
            if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangwei) {
              global.AuthorityEngines.adjustHuangwei('lostVirtueRumor', -8, '\u9ad8\u7ea7\u6c11\u53d8\u5347\u7ea7');
            } else if (typeof global.GM.huangwei === 'object') global.GM.huangwei.index = Math.max(0, global.GM.huangwei.index - 8);
          }
          if (r.level === 5) {
            global.GM._gameOver = { type: 'dynasty_change', revolt: r.id, turn: ctx.turn };
            if (global.addEB) global.addEB('民变', '改朝换代！天命已移');
          }
        }
      }
      // 镇压尝试：官军作战
      if (r._suppressionOrder && !r._suppressed) {
        var suppressionStrength = r._suppressionOrder.strength || 0;
        if (suppressionStrength > r.scale * 2) {
          r.status = 'suppressed';
          r._suppressed = true;
          if (global.addEB) global.addEB('民变', (r.region || '某地') + ' ' + REVOLT_LEVELS[r.level - 1].name + ' 已平');
          // P-5TK·平乱接皇威：官军确定性镇压民变成功 → 加皇威（按民变等级定量·封顶·防重复）
          if (!r._hwAwarded && typeof global.AuthorityEngines !== 'undefined' && typeof global.AuthorityEngines.adjustHuangwei === 'function') {
            var _P5TK_SUP_PER = 2, _P5TK_SUP_MIN = 2, _P5TK_SUP_CAP = 8;
            var _supGain = Math.max(_P5TK_SUP_MIN, Math.min(_P5TK_SUP_CAP, (r.level || 1) * _P5TK_SUP_PER));
            global.AuthorityEngines.adjustHuangwei('suppressRevolt', _supGain, (r.region || '某地') + ' 平乱');
            r._hwAwarded = true;
          }
        }
      }
      // 自然瓦解：若「该省」民心回升（解析不到回退全国）
      if (localMx > currentDef.threshold + 15 && Math.random() < 0.05) {
        r.status = 'dispersed';
      }
    });
    // 清理已结束的 (保留最近 30)
    mx.revolts = mx.revolts.slice(-30);
  }

  function suppressRevolt(revoltId, troops) {
    var mx = global.GM.minxin;
    if (!mx || !mx.revolts) return { ok: false };
    var r = mx.revolts.find(function(x) { return x.id === revoltId; });
    if (!r) return { ok: false };
    r._suppressionOrder = { strength: troops, turn: global.GM.turn };
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P0-3 · 暴君综合症深化
  // ═══════════════════════════════════════════════════════════════════

  function _ensureCrisisPlayerLedger() {
    var G = global.GM;
    if (!G) return null;
    if (!Array.isArray(G._crisisPlayerActions)) G._crisisPlayerActions = [];
    return G._crisisPlayerActions;
  }

  function _recordCrisisPlayerAction(type, action, ok, detail) {
    var G = global.GM;
    var ledger = _ensureCrisisPlayerLedger();
    if (!G || !ledger) return;
    var item = Object.assign({
      turn: G.turn || 0,
      type: type || '',
      action: action || '',
      ok: !!ok
    }, detail || {});
    ledger.push(item);
    if (ledger.length > 120) ledger.splice(0, ledger.length - 120);
    if (Array.isArray(G._turnReport)) G._turnReport.push(Object.assign({ type: 'crisis_player_action' }, item));
  }

  function _authorityClamp(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  function _authorityPhaseFromIndex(idx) {
    if (idx >= 90) return 'tyrant';
    if (idx >= 70) return 'majesty';
    if (idx >= 50) return 'normal';
    if (idx >= 30) return 'decline';
    return 'lost';
  }

  function _handleInterceptedEdict(action, req) {
    var G = global.GM;
    var list = (G && G._pendingMemorials) || [];
    var memo = list.find(function(m) { return m && (m.id === req.memoId || m.id === req.id); });
    if (!memo) return { ok: false, reason: 'missing intercepted memorial' };
    if (action === 'reissue' || action === 'counter_reissue') {
      memo.intercepted = false;
      memo.reissuedTurn = G.turn || 0;
      memo._reissueMode = req.mode || 'secretariat';
      memo.status = memo.status || 'drafted';
      if (!Array.isArray(G._reissuedEdicts)) G._reissuedEdicts = [];
      G._reissuedEdicts.push({ turn: G.turn || 0, memoId: memo.id, mode: memo._reissueMode, interceptedBy: memo.interceptedBy || '' });
      return { ok: true, memoId: memo.id, mode: memo._reissueMode };
    }
    return { ok: false, reason: 'unsupported edict interception action' };
  }

  function _handlePowerMinisterAction(action, req) {
    var G = global.GM;
    var hq = G && G.huangquan;
    var pm = hq && hq.powerMinister;
    var targetName = req.targetName || req.name || (pm && pm.name);
    if (!targetName) return { ok: false, reason: 'missing power minister target' };
    if (action === 'purge' || action === 'execute' || action === 'exile') {
      var ch = (G.chars || []).find(function(c) { return c && c.name === targetName; });
      if (ch) {
        ch.alive = false;
        ch.purgedTurn = G.turn || 0;
        ch.purgeReason = req.reason || 'power-minister-crisis';
      }
      if (global.AuthorityEngines && typeof global.AuthorityEngines.executePurge === 'function') {
        try { global.AuthorityEngines.executePurge(targetName); } catch(_e) {}
      }
      if (hq) {
        hq.powerMinister = null;
        hq.index = _authorityClamp((hq.index || 0) + 8);
      }
      return { ok: true, targetName: targetName };
    }
    return { ok: false, reason: 'unsupported power minister action' };
  }

  function _handleTyrantSyndromeAction(action, req) {
    var G = global.GM;
    var hw = G && G.huangwei;
    if (!hw || !hw.tyrantSyndrome) return { ok: false, reason: 'missing tyrant syndrome state' };
    var ts = hw.tyrantSyndrome;
    if (action === 'self_blame_reform' || action === 'restrain_overexecution') {
      var old = hw.index || 0;
      hw.index = _authorityClamp(old - (req.coolingDelta || 12));
      hw.phase = _authorityPhaseFromIndex(hw.index);
      ts.flatteryMemorialRatio = Math.max(0, (ts.flatteryMemorialRatio || 0) - 0.35);
      ts.overExecutionLog = [];
      ts.hiddenDamage = {};
      if (hw.index < 90) {
        ts.active = false;
        if (hw.history && Array.isArray(hw.history.tyrantPeriods)) hw.history.tyrantPeriods.push({ start: ts.activatedTurn || 0, end: G.turn || 0, resolvedBy: action });
      }
      if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
        try { TM.MinxinLedger.recordAndApply(G, { sourceSystem: 'tyrant-mitigation', kind: 'imperialVirtue', delta: (req.minxinRecovery || 5), reason: '罪己改革·民心恢复' }); } catch (_e) {}
      } else if (G.minxin && typeof G.minxin.trueIndex === 'number') G.minxin.trueIndex = _authorityClamp(G.minxin.trueIndex + (req.minxinRecovery || 5)); // 沙箱兜底·真机直写会被 aggregateTrue 冲掉
      if (!Array.isArray(G._tyrantMitigations)) G._tyrantMitigations = [];
      G._tyrantMitigations.push({ turn: G.turn || 0, action: action, oldIndex: old, newIndex: hw.index, text: req.text || '' });
      return { ok: true, oldIndex: old, newIndex: hw.index };
    }
    return { ok: false, reason: 'unsupported tyrant syndrome action' };
  }

  function _handleLostAuthorityAction(action, req) {
    var G = global.GM;
    var hw = G && G.huangwei;
    if (!hw || !hw.lostAuthorityCrisis) return { ok: false, reason: 'missing lost authority state' };
    var lc = hw.lostAuthorityCrisis;
    if (action === 'grand_audience_restore' || action === 'public_court_restore') {
      var old = hw.index || 0;
      hw.index = _authorityClamp(old + (req.recoveryDelta || 16));
      hw.phase = _authorityPhaseFromIndex(hw.index);
      lc.objectionFrequency = Math.max(1, (lc.objectionFrequency || 1) - 2);
      lc.foreignEmboldened = Math.max(0, (lc.foreignEmboldened || 0) - 0.35);
      lc.provincialWatching = false;
      if (hw.index > 35) {
        lc.active = false;
        if (hw.history && Array.isArray(hw.history.crisisPeriods)) hw.history.crisisPeriods.push({ start: lc.activatedTurn || 0, end: G.turn || 0, resolvedBy: action });
      }
      if (G.fiscal && G.fiscal.regions) {
        Object.keys(G.fiscal.regions).forEach(function(rid) {
          var rf = G.fiscal.regions[rid];
          rf.compliance = Math.min(1, (rf.compliance || 0.5) + 0.08);
        });
      }
      return { ok: true, oldIndex: old, newIndex: hw.index };
    }
    return { ok: false, reason: 'unsupported lost authority action' };
  }

  function _handleRevoltAction(action, req) {
    if (action === 'suppress' || action === 'dispatch_troops') {
      var revoltId = req.revoltId || req.id;
      var troops = req.troops || req.strength || 0;
      var ordered = suppressRevolt(revoltId, troops);
      var mx = global.GM && global.GM.minxin;
      var r = mx && Array.isArray(mx.revolts) ? mx.revolts.find(function(x) { return x && x.id === revoltId; }) : null;
      if (ordered && ordered.ok && r && troops > (r.scale || 0) * 2) {
        r.status = 'suppressed';
        r._suppressed = true;
        r.suppressedTurn = global.GM.turn || 0;
        r._suppressionOrder = { strength: troops, turn: global.GM.turn || 0, immediate: true };
      }
      return ordered;
    }
    return { ok: false, reason: 'unsupported revolt action' };
  }

  function _handleCorruptionCaseAction(action, req) {
    if (action === 'handle_case' || action === 'resolve') {
      if (!global.CorruptionEngine || typeof global.CorruptionEngine.applyCaseHandling !== 'function') return { ok: false, reason: 'missing corruption case handler' };
      var res = global.CorruptionEngine.applyCaseHandling(req.caseId || req.id, req.optionId || req.option || 'strict');
      return { ok: !!(res && res.success), result: res };
    }
    return { ok: false, reason: 'unsupported corruption case action' };
  }

  function _crisisSurfaceText(payload) {
    payload = payload || {};
    return [
      payload.text,
      payload.reply,
      payload.content,
      payload.body,
      payload.topic,
      payload.title,
      payload.decision,
      payload.target,
      payload.targetName,
      payload.to,
      payload.from
    ].filter(Boolean).join(' ');
  }

  function _crisisHasAny(text, terms) {
    text = String(text || '').toLowerCase();
    return terms.some(function(term) {
      return term && text.indexOf(String(term).toLowerCase()) >= 0;
    });
  }

  function _firstInterceptedMemoId() {
    var G = global.GM || {};
    var memo = ((G && G._pendingMemorials) || []).find(function(m) {
      return m && (m.intercepted || m.status === 'intercepted');
    });
    return memo && memo.id;
  }

  function _firstOngoingRevolt() {
    var mx = global.GM && global.GM.minxin;
    return mx && Array.isArray(mx.revolts) ? mx.revolts.find(function(r) { return r && r.status === 'ongoing'; }) : null;
  }

  function _firstActiveCorruptionCaseId() {
    var c = global.GM && global.GM.corruption;
    var row = c && Array.isArray(c.activeCases) ? c.activeCases[0] : null;
    return row && row.id;
  }

  function inferCrisisActionFromSurface(payload) {
    payload = payload || {};
    var explicit = payload.crisisAction || payload.authorityCrisisAction || payload.crisis;
    if (typeof explicit === 'string') {
      return {
        type: explicit,
        action: payload.action || payload.crisisMode || payload.mode || '',
        memoId: payload.memoId || payload.id,
        targetName: payload.targetName || payload.target,
        revoltId: payload.revoltId || payload.id,
        caseId: payload.caseId || payload.id,
        optionId: payload.optionId || payload.option,
        troops: payload.troops || payload.strength,
        text: _crisisSurfaceText(payload)
      };
    }
    if (explicit && typeof explicit === 'object') {
      return Object.assign({
        text: _crisisSurfaceText(payload),
        memoId: payload.memoId || payload.id,
        targetName: payload.targetName || payload.target,
        revoltId: payload.revoltId || payload.id,
        caseId: payload.caseId || payload.id,
        optionId: payload.optionId || payload.option,
        troops: payload.troops || payload.strength
      }, explicit);
    }

    var text = _crisisSurfaceText(payload);
    var G = global.GM || {};
    if (!text && !payload.memoId && !payload.revoltId && !payload.caseId && !payload.targetName) return null;

    if ((payload.memoId || _crisisHasAny(text, ['\u622a\u8bcf', '\u62e6\u622a', '\u91cd\u53d1', '\u518d\u9881', '\u5bc6\u53d1', '\u7ed5\u8fc7', 'intercept', 'reissue', 'bypass'])) &&
        _crisisHasAny(text, ['\u91cd\u53d1', '\u518d\u9881', '\u5bc6\u53d1', '\u7ed5\u8fc7', '\u7ed5\u5c01\u9501', 'reissue', 'bypass'])) {
      return {
        type: 'edict_interception',
        action: 'reissue',
        memoId: payload.memoId || payload.id || _firstInterceptedMemoId(),
        mode: payload.reissueMode || payload.mode || 'secretariat',
        text: text
      };
    }

    if (_crisisHasAny(text, ['\u6743\u81e3', '\u9996\u8f85', '\u9601\u81e3', '\u62ff\u95ee', '\u524a\u6743', '\u7f62\u9edc', '\u8bdb', '\u6e05\u515a', 'power minister', 'purge'])) {
      return {
        type: 'power_minister',
        action: 'purge',
        targetName: payload.targetName || payload.target || (G.huangquan && G.huangquan.powerMinister && G.huangquan.powerMinister.name) || payload.name,
        text: text
      };
    }

    if (_crisisHasAny(text, ['\u7f6a\u5df1', '\u7981\u5949\u627f', '\u7981\u8fc7\u5ea6\u5949\u627f', '\u505c\u6ee5\u5211', '\u505c\u8fc7\u5ea6\u7528\u5211', '\u5bbd\u5ba5', 'self blame', 'overexecution'])) {
      return {
        type: 'tyrant_syndrome',
        action: 'self_blame_reform',
        text: text
      };
    }

    if (_crisisHasAny(text, ['\u5fa1\u95e8\u542c\u653f', '\u5927\u671d\u4f1a', '\u6062\u590d\u5a01\u4fe1', '\u590d\u671d\u5a01', '\u9762\u8bae', 'grand audience', 'restore authority'])) {
      return {
        type: 'lost_authority',
        action: 'grand_audience_restore',
        text: text
      };
    }

    if (_crisisHasAny(text, ['\u6c11\u53d8', '\u5e73\u4e71', '\u53d1\u5175', '\u9547\u538b', '\u8ba8\u8d3c', '\u8fdb\u527f', 'revolt', 'suppress', 'dispatch troops'])) {
      var revolt = _firstOngoingRevolt();
      return {
        type: 'revolt',
        action: 'suppress',
        revoltId: payload.revoltId || payload.id || (revolt && revolt.id),
        troops: payload.troops || payload.strength || (revolt ? (revolt.scale || 10000) * 3 : 0),
        text: text
      };
    }

    if (_crisisHasAny(text, ['\u8150\u8d25', '\u8d2a\u58a8', '\u8d2a\u6c61', '\u8ffd\u8d43', '\u4e25\u529e', '\u67e5\u529e', 'corruption'])) {
      return {
        type: 'corruption_case',
        action: 'handle_case',
        caseId: payload.caseId || payload.id || _firstActiveCorruptionCaseId(),
        optionId: payload.optionId || payload.option || 'strict',
        text: text
      };
    }

    return null;
  }

  function handleCrisisAction(req, meta) {
    req = req || {};
    if (typeof req === 'string') req = { type: req };
    meta = meta || {};
    var type = req.type || req.crisisType || '';
    var action = req.action || req.mode || '';
    var result = { ok: false, reason: 'unsupported crisis action' };
    if (type === 'edict_interception') result = _handleInterceptedEdict(action, req);
    else if (type === 'power_minister') result = _handlePowerMinisterAction(action, req);
    else if (type === 'tyrant_syndrome') result = _handleTyrantSyndromeAction(action, req);
    else if (type === 'lost_authority') result = _handleLostAuthorityAction(action, req);
    else if (type === 'revolt') result = _handleRevoltAction(action, req);
    else if (type === 'corruption_case') result = _handleCorruptionCaseAction(action, req);
    _recordCrisisPlayerAction(type, action, !!(result && result.ok), {
      target: req.targetName || req.memoId || req.revoltId || req.caseId || '',
      source: meta.source || req.source || 'player',
      result: result
    });
    return result;
  }

  function _ensureCrisisSurfaceLedger() {
    var G = global.GM;
    if (!G) return null;
    if (!Array.isArray(G._crisisSurfaceResponses)) G._crisisSurfaceResponses = [];
    return G._crisisSurfaceResponses;
  }

  function handleCrisisSurfaceResponse(channelOrPayload, payload, meta) {
    var data = {};
    if (typeof channelOrPayload === 'string') {
      data = Object.assign({ channel: channelOrPayload }, payload || {});
    } else {
      data = channelOrPayload || {};
      meta = payload || meta || {};
    }
    meta = meta || {};
    var req = inferCrisisActionFromSurface(data);
    if (!req || !req.type) return { ok: false, skipped: true, reason: 'no crisis action inferred' };
    if (!req.action) {
      if (req.type === 'edict_interception') req.action = 'reissue';
      else if (req.type === 'power_minister') req.action = 'purge';
      else if (req.type === 'tyrant_syndrome') req.action = 'self_blame_reform';
      else if (req.type === 'lost_authority') req.action = 'grand_audience_restore';
      else if (req.type === 'revolt') req.action = 'suppress';
      else if (req.type === 'corruption_case') req.action = 'handle_case';
    }
    var channel = data.channel || meta.channel || 'player';
    var result = handleCrisisAction(req, Object.assign({}, meta, {
      source: meta.source || ('surface-' + channel),
      channel: channel
    }));
    var ledger = _ensureCrisisSurfaceLedger();
    if (ledger) {
      ledger.push({
        turn: (global.GM && global.GM.turn) || 0,
        channel: channel,
        type: req.type || '',
        action: req.action || '',
        ok: !!(result && result.ok),
        target: req.targetName || req.memoId || req.revoltId || req.caseId || '',
        text: _crisisSurfaceText(data).slice(0, 240),
        source: meta.source || ''
      });
      if (ledger.length > 120) ledger.splice(0, ledger.length - 120);
    }
    return Object.assign({ channel: channel, request: req }, result || {});
  }

  function _tickTyrantSyndrome(ctx, mr) {
    var G = global.GM;
    var hw = G.huangwei;
    if (!hw || !hw.tyrantSyndrome || !hw.tyrantSyndrome.active) return;
    var ts = hw.tyrantSyndrome;
    if (!ts.hiddenDamage) ts.hiddenDamage = {};
    // 颂圣奏疏比例上升
    ts.flatteryMemorialRatio = Math.min(0.95, (ts.flatteryMemorialRatio || 0.3) + 0.02 * mr);
    // 诏书过度执行：把 lumpSum 变大
    (G._pendingMemorials || []).forEach(function(m) {
      if (m.status === 'approved' && !m._overExecuted) {
        m._overExecuted = true;
        ts.overExecutionLog.push({ id: m.id, turn: ctx.turn, overScale: 1.3 });
        if (ts.overExecutionLog.length > 20) ts.overExecutionLog.splice(0, ts.overExecutionLog.length - 20);
      }
    });
    // 隐藏代价累积
    if (G.minxin && G.minxin.perceivedIndex > G.minxin.trueIndex) {
      ts.hiddenDamage.unreportedMinxinDrop = (ts.hiddenDamage.unreportedMinxinDrop || 0) + (G.minxin.perceivedIndex - G.minxin.trueIndex) * 0.1 * mr;
    }
    if (G.corruption && _corrIndex(G) > 40) {
      ts.hiddenDamage.concealedCorruption = (ts.hiddenDamage.concealedCorruption || 0) + 0.5 * mr;
    }
    if (hw.drains.memorialObjection > 0) {
      ts.hiddenDamage.accumulatedMisjudgement = (ts.hiddenDamage.accumulatedMisjudgement || 0) + hw.drains.memorialObjection * 0.1 * mr;
    }
    // 暴君觉醒事件（随机触发）
    if (ctx.turn - (ts.activatedTurn || 0) > _turnsForMonthsLocal(12) && !ts._awakened && Math.random() < 0.05 * mr) {
      _tyrantAwakeningEvent(ts, hw, ctx);
    }
  }

  function _tyrantAwakeningEvent(ts, hw, ctx) {
    ts._awakened = true;
    // 皇威骤降，隐藏代价兑现
    hw.index = Math.max(0, hw.index - 25);
    var G = global.GM;
    var _hidDrop = ts.hiddenDamage.unreportedMinxinDrop || 0;
    if (_hidDrop && typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
      try { TM.MinxinLedger.recordAndApply(G, { sourceSystem: 'tyrant-awakening', kind: 'tyrantHiddenDamage', delta: -_hidDrop, reason: '暴君觉醒·隐伤兑现' }); } catch (_e) {}
    } else if (_hidDrop && G.minxin) G.minxin.trueIndex = Math.max(0, G.minxin.trueIndex - _hidDrop); // 沙箱兜底·真机直写会被 aggregateTrue 冲掉
    if (G.corruption && typeof G.corruption === 'object') {
      _addCorrIndex(G, ts.hiddenDamage.concealedCorruption || 0);
    }
    if (global.addEB) global.addEB('皇威', '暴君觉醒！颂圣破产，隐伤兑现（皇威 -25）');
    ts.hiddenDamage = {};
    ts.flatteryMemorialRatio = 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P0-4 · 失威危机深化
  // ═══════════════════════════════════════════════════════════════════

  function _tickLostAuthorityCrisis(ctx, mr) {
    var G = global.GM;
    var hw = G.huangwei;
    if (!hw || !hw.lostAuthorityCrisis || !hw.lostAuthorityCrisis.active) return;
    var la = hw.lostAuthorityCrisis;
    // D2·缙绅离心加速失威危机：clout 加权合法性远低于人口加权民心（缙绅/权贵离心）时，
    //   地方督抚本即缙绅、外邦窥伺者亦观士心——合规流失/外邦蠢动/抗疏皆提速。
    //   纯读 §三D 已建的 GM._legitimacy（clout 加权读模型）·不碰刻意自由写的皇威·与人口加权民变线(_tickRevoltUpgrade)不双计。
    var _escMult = 1;
    var _leg = G._legitimacy;
    if (_leg && _leg.flag === '缙绅离心') {
      var _gap = Number(_leg.pop) - Number(_leg.clout);   // 缙绅离心 ⇒ 人口加权民心高于 clout 加权（>0）
      if (isFinite(_gap) && _gap > 0) _escMult = 1 + Math.min(0.6, _gap / 40);   // 离心越深越快·封顶 +60%
    }
    // 抗疏频次暴增
    la.objectionFrequency = Math.min(5, (la.objectionFrequency || 1) + 0.1 * mr * _escMult);
    // 地方观望：所有 region 合规率下降加速
    la.provincialWatching = true;
    if (G.fiscal && G.fiscal.regions) {
      Object.keys(G.fiscal.regions).forEach(function(rid) {
        G.fiscal.regions[rid].compliance = Math.max(0.1, G.fiscal.regions[rid].compliance - 0.003 * mr * _escMult);
      });
    }
    // 外邦蠢动
    la.foreignEmboldened = Math.min(1, (la.foreignEmboldened || 0) + 0.02 * mr * _escMult);
    if (la.foreignEmboldened > 0.5 && !la._tributeStopped) {
      la._tributeStopped = true;
      if (global.addEB) global.addEB('皇威', '外邦蠢动，朝贡渐稀');
      if (G.population && G.population.jimiHoldings) {
        G.population.jimiHoldings.forEach(function(h) { h.autonomy = Math.min(1, h.autonomy + 0.1); });
      }
    }
    // 抗疏自动触发
    if (Math.random() < la.objectionFrequency * 0.02 * mr) {
      _autoTriggerObjection(ctx);
    }
  }

  function _autoTriggerObjection(ctx) {
    var G = global.GM;
    if (!G._pendingMemorials || G._pendingMemorials.length === 0) return;
    var memo = G._pendingMemorials.filter(function(m){return m.status === 'drafted';})[0];
    if (!memo) return;
    if (typeof global.EdictParser !== 'undefined' && typeof global.EdictParser._checkAbduction === 'function') {
      // _checkAbduction 不直接暴露，改为构造抗疏记录
    }
    if (!G._abductions) G._abductions = [];
    G._abductions.push({
      id: 'auto_obj_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
      turn: ctx.turn,
      objector: _pickObjector(),
      target: memo.id,
      content: '臣死谏：陛下威失，此诏不可行'
    });
    if (global.addEB) global.addEB('抗疏', '失威危机诱发自动抗疏');
  }

  function _pickObjector() {
    var G = global.GM;
    var officials = (G.chars || []).filter(function(c) {
      return c.alive !== false && c.officialTitle && (c.integrity || 50) > 70;
    });
    return officials.length > 0 ? officials[Math.floor(Math.random() * officials.length)].name : '御史';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-6 · 14 皇威源 Hook API
  // ═══════════════════════════════════════════════════════════════════

  var HUANGWEI_DELTAS = {
    militaryVictory: { scale:8, personal:1.5, foreignMult:1.5 },
    territoryExpansion: 12,
    grandCeremony: 5,
    executeRebelMinister: 6,
    suppressRevolt: 8,
    auspicious: 3,
    benevolence: 4,
    selfBlame: -8,   // P-ZV7 翻正：罪己=认错示弱·降皇威（旧 +2 与新规反·改负与罪己诏机制同向）
    tribute: 4,
    imperialFuneral: 3,
    rehabilitation: 4,
    culturalAchievement: 5,
    personalCampaign: 10,
    structuralReform: 12,
    // drains
    militaryDefeat: -10,
    diplomaticHumiliation: -12,
    idleGovern: -2,
    courtScandal: -6,
    heavenlySign: -8,
    forcedAbdication: -20,
    brokenPromise: -5,
    deposeFailure: -8,
    imperialFlight: -25,
    capitalFall: -30,
    personalCampaignFail: -18,
    familyScandal: -7,
    memorialObjection: -3,
    lostVirtueRumor: -5
  };

  function triggerHuangweiEvent(source, ctx) {
    var delta = HUANGWEI_DELTAS[source];
    if (typeof delta === 'object') {
      var base = delta.scale || 5;
      if (ctx && ctx.personallyLed) base *= (delta.personal || 1);
      if (ctx && ctx.foreign) base *= (delta.foreignMult || 1);
      delta = base;
    }
    if (typeof delta !== 'number') return { ok: false };
    if (typeof global.AuthorityEngines !== 'undefined') {
      global.AuthorityEngines.adjustHuangwei(source, delta, (ctx && ctx.reason) || source || '\u7687\u5a01\u4e8b\u4ef6');
    }
    return { ok: true, delta: delta };
  }

  // 自动侦测触发器（v2：只保留"客观事实反馈"，删除 Math.random 概率触发）
  // 祥瑞/天象/朝贡等非必然发生的事件 —— 由 AI 推演看情况自己决定，不再硬 roll
  function _autoAuthorityEventDue(scope, key, cooldownTurns) {
    var G = global.GM;
    if (!G) return false;
    var turn = Number(G.turn || 0);
    var span = Math.max(1, Number(cooldownTurns || 1));
    if (!G._authorityAutoEventTurns || typeof G._authorityAutoEventTurns !== 'object') {
      G._authorityAutoEventTurns = {};
    }
    var fullKey = scope + ':' + key;
    var last = Number(G._authorityAutoEventTurns[fullKey]);
    if (isFinite(last) && turn - last < span) return false;
    G._authorityAutoEventTurns[fullKey] = turn;
    return true;
  }

  function _autoDetectHuangweiEvents(ctx, mr) {
    var G = global.GM;
    var hw = G.huangwei;
    if (!hw) return;
    // ── 客观事实反馈（已发生的实事，系统确实记录了）──
    // 军事胜负（有具体战报才反馈）
    if (G._turnBattleResults) {
      G._turnBattleResults.forEach(function(b) {
        if (b._hwChecked) return;
        b._hwChecked = true;
        if (b.win) triggerHuangweiEvent('militaryVictory', { personallyLed: b.personallyLed, foreign: b.enemyType === 'foreign', reason: '\u519b\u4e8b\u6377\u62a5' });
        else triggerHuangweiEvent('militaryDefeat', { reason: '\u519b\u4e8b\u5931\u5229' });
      });
    }
    // 都城沦陷（具体事实）
    if (G._capitalFallen && !hw._capitalFallSignaled) {
      hw._capitalFallSignaled = true;
      triggerHuangweiEvent('capitalFall', { reason: '\u90fd\u57ce\u6ca6\u9677' });
    }
    // 抗疏（已发生的抗疏数量，客观数据）
    var recentAbductions = (G._abductions || []).filter(function(a) { return (G.turn - a.turn) < _turnsForMonthsLocal(3); });
    if (recentAbductions.length > 2) {
      var objectionKey = recentAbductions.map(function(a) {
        return a.id || a.name || a.turn || '';
      }).join('|') || String(recentAbductions.length);
      if (hw._memorialObjectionAbductionKey !== objectionKey) {
        hw._memorialObjectionAbductionKey = objectionKey;
        triggerHuangweiEvent('memorialObjection', { reason: '\u8fd1\u671f\u6297\u758f\u9891\u53d1' });
      }
    }
    // 开疆拓土（territoryExpansion）·确定性反馈：本回合玩家势力净得省份 → 给皇威
    //   读 turnChanges.map 的 owner 易主记录（newValue=新归属·oldValue=旧归属）·只认"非玩家→玩家"的净得。
    //   朝代中立：只比对玩家势力的 id/name/key·不写死任何朝代专名。数值小额·上层 ±5 净封顶兜住与 AI 叠加。
    if (G.turnChanges && Array.isArray(G.turnChanges.map) && G.turnChanges.map.length && hw._territoryGainTurn !== G.turn) {
      var _pFacTx = (Array.isArray(G.facs) && G.facs.find(function(f){ return f && f.isPlayer; })) || null;
      var _pKeysTx = [];
      if (_pFacTx) { if (_pFacTx.id) _pKeysTx.push(String(_pFacTx.id)); if (_pFacTx.name) _pKeysTx.push(String(_pFacTx.name)); if (_pFacTx.ownerKey) _pKeysTx.push(String(_pFacTx.ownerKey)); }
      var _pfnTx = (global.P && global.P.playerInfo && global.P.playerInfo.factionName) || G.playerFaction || '';
      if (_pfnTx && _pKeysTx.indexOf(String(_pfnTx)) < 0) _pKeysTx.push(String(_pfnTx));
      if (_pKeysTx.length) {
        var _isPlayerOwnerTx = function(v) { return v != null && _pKeysTx.indexOf(String(v)) >= 0; };
        var _gainedTx = 0;
        G.turnChanges.map.forEach(function(m) {
          if (m && m.field === 'owner' && _isPlayerOwnerTx(m.newValue) && !_isPlayerOwnerTx(m.oldValue)) _gainedTx++;
        });
        if (_gainedTx > 0) {
          hw._territoryGainTurn = G.turn;
          if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines && typeof global.AuthorityEngines.adjustHuangwei === 'function') {
            global.AuthorityEngines.adjustHuangwei('territoryExpansion', Math.min(12, 3 * _gainedTx), '开疆拓土·本回合得 ' + _gainedTx + ' 地');
          }
        }
      }
    }
    // ── 已删除 ──
    //   · Math.random 祥瑞 / 天象 硬概率 —— 改由 AI 看局面自己产出
    //   · 朝贡按月 1 号硬触发 —— 改由 AI 看外交状态自己产出
    //
    // AI 可通过 changes[{path:'huangwei.index',delta:X,reason:'...'}] 或直接
    // 调 AuthorityComplete.triggerHuangweiEvent(source, ctx) 来反馈具体事件。
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-7 · 8 皇权源 Hook API
  // ═══════════════════════════════════════════════════════════════════

  var HUANGQUAN_DELTAS = {
    purge: 8,
    secretPolice: 5,
    personalRule: 4,
    structureReform: 10,
    militaryCentral: 6,
    tour: 3,
    heirDecision: 5,
    executePM: 12,
    trustedMinister: -3,
    eunuchsRelatives: -2,
    youngOrIllness: -5,
    factionConsuming: -3,
    idleGovern: -2,
    militaryDefeat: -6,
    cabinetization: -4,
    memorialObjection: -1
  };

  function triggerHuangquanEvent(source, ctx) {
    var delta = HUANGQUAN_DELTAS[source];
    if (typeof delta !== 'number') return { ok: false };
    if (typeof global.AuthorityEngines !== 'undefined') {
      global.AuthorityEngines.adjustHuangquan(source, delta, (ctx && ctx.reason) || source || '\u7687\u6743\u4e8b\u4ef6');
    }
    return { ok: true, delta: delta };
  }

  function _autoDetectHuangquanEvents(ctx, mr) {
    var G = global.GM;
    var hq = G.huangquan;
    if (!hq) return;
    // 年幼/病弱
    var player = (G.chars || []).find(function(c){return c.isPlayer;});
    if (player) {
      var playerKey = player.id || player.name || 'player';
      if ((player.age || 30) < 12 && _autoAuthorityEventDue('huangquan', 'young:' + playerKey, _turnsForMonthsLocal(12))) {
        triggerHuangquanEvent('youngOrIllness', { reason: '\u5e7c\u4e3b\u4e34\u671d' });
      }
      if ((player.health || 80) < 40 && _autoAuthorityEventDue('huangquan', 'ill:' + playerKey, _turnsForMonthsLocal(6))) {
        triggerHuangquanEvent('youngOrIllness', { reason: '\u541b\u4e3b\u4f53\u5f31' });
      }
    }
    // 党争
    if (G.partyStrife > 70 && _autoAuthorityEventDue('huangquan', 'partyStrifeHigh', _turnsForMonthsLocal(6))) {
      triggerHuangquanEvent('factionConsuming', { reason: '\u515a\u4e89\u8017\u653f' });
    }
    // 怠政（久不视朝 ≥ P.conf.idleGovernMonths 月·按剧本时间换算·玩家可调·默认6）
    var _idleMonths = (global.P && global.P.conf && Number(global.P.conf.idleGovernMonths)) || 6;
    var _lastCourtTurn = (G._lastChangchaoDecisionMeta && Number(G._lastChangchaoDecisionMeta.turn)) || 0;
    if (_lastCourtTurn && (ctx.turn - _lastCourtTurn) >= _turnsForMonthsLocal(_idleMonths)
        && _autoAuthorityEventDue('huangquan', 'idleGovernLong', _turnsForMonthsLocal(3))) {
      triggerHuangquanEvent('idleGovern', { reason: '久不视朝·怠政' });
    }
    // 军事惨败
    if (G._turnBattleResults) {
      G._turnBattleResults.forEach(function(b) {
        if (b._hqChecked) return;
        b._hqChecked = true;
        if (!b.win && b.scale === 'decisive') triggerHuangquanEvent('militaryDefeat', { reason: '\u51b3\u5b9a\u6027\u6218\u8d25' });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-8 · 民心 7 源补完
  // ═══════════════════════════════════════════════════════════════════

  function _tickMinxinAdditionalSources(ctx, mr) {
    var G = global.GM;
    var mx = G.minxin;
    if (!mx) return;
    var adj = typeof global.AuthorityEngines !== 'undefined' ? global.AuthorityEngines.adjustMinxin : null;
    if (!adj) return;
    // judicialFairness（冤案率）
    var corruptOfficials = (G.chars || []).filter(function(c) {
      return c.alive !== false && c.officialTitle && (c.integrity || 60) < 35;
    }).length;
    if (corruptOfficials > 5) adj('judicialFairness', -0.1 * mr * corruptOfficials / 5, '冤案多');
    else if (corruptOfficials === 0 && (G.chars || []).filter(function(c){return c.alive!==false && c.officialTitle;}).length > 10) adj('judicialFairness', 0.05 * mr, '刑政清明');
    // security（治安）
    var activeRevolts = (mx.revolts || []).filter(function(r){return r.status === 'ongoing';}).length;
    if (activeRevolts > 0) adj('security', -0.15 * mr * activeRevolts, '民变不宁');
    // socialMobility（阶层流动）
    if (G.population && G.population.classMobility) {
      var recentTrans = (G.population.classMobility.yearlyTransitions || []).filter(function(t){return (G.turn - t.turn) < _turnsForMonthsLocal(12);});
      var upward = recentTrans.filter(function(t){return t.path === 'keju_rise' || t.path === 'military_merit';}).length;
      if (upward > 5) adj('socialMobility', 0.1 * mr, '仕途通畅');
    }
    // culturalPolicy
    if (G._recentKeju) adj('culturalPolicy', 0.15 * mr, '文治');
    // heavenSign（天象）
    if (G._recentHeavenSign) {
      adj('heavenSign', -0.2 * mr, '天象异常');
      G._recentHeavenSign = false;
    }
    // auspicious（祥瑞）
    if (Math.random() < 0.005 * mr) {
      adj('auspicious', 0.3, '祥瑞现');
      if (global.addEB) global.addEB('祥瑞', '祥瑞现世，民心归附');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-9 · 民心 6 后果补完
  // ═══════════════════════════════════════════════════════════════════

  function _tickMinxinConsequences(ctx, mr) {
    var G = global.GM;
    var mx = G.minxin;
    if (!mx) return;
    // 防御:mx 存在但 trueIndex 缺失/非有限(legacy {value} 形态或 normalize 未先跑)→各乘子灌 NaN，
    // 可静默污染 _conscriptEffMult/_reformToleranceMult 等。用安全访问器兜底(同 AuthorityEngines.getMinxinValue 语义)。
    var _ti = (typeof mx.trueIndex === 'number' && isFinite(mx.trueIndex)) ? mx.trueIndex
      : ((global.AuthorityEngines && typeof global.AuthorityEngines.getMinxinValue === 'function') ? Number(global.AuthorityEngines.getMinxinValue()) : 60);
    if (!isFinite(_ti)) _ti = 60;
    // 征税效率
    var taxEff = 0.5 + (_ti / 100) * 0.7;
    G._taxEfficiencyMult = taxEff;
    // 征兵效率
    var conscriptEff = Math.max(0.3, _ti / 80);
    G._conscriptEffMult = conscriptEff;
    if (G.population && G.population.military) {
      G.population.military._conscriptEfficiency = conscriptEff;
    }
    // 逃亡率
    if (_ti < 35 && G.population) {
      var fugIncrease = Math.round(((G.population.national && G.population.national.mouths) || 0) * (0.035 - _ti / 1000) * 0.001 * mr);
      G.population.fugitives = (G.population.fugitives || 0) + Math.max(0, fugIncrease);
    }
    // 地方叛附倾向
    if (G.fiscal && G.fiscal.regions) {
      Object.keys(G.fiscal.regions).forEach(function(rid) {
        var regMx = mx.byRegion && mx.byRegion[rid];
        if (regMx && regMx.index < 30) {
          G.fiscal.regions[rid].compliance = Math.max(0.1, G.fiscal.regions[rid].compliance - 0.002 * mr);
        }
      });
    }
    // 士人投效
    if (mx.byClass && mx.byClass.scholar && mx.byClass.scholar.index > 70) {
      G._scholarRecruitmentMult = 1.3;
    } else if (mx.byClass && mx.byClass.scholar && mx.byClass.scholar.index < 30) {
      G._scholarRecruitmentMult = 0.7;
    }
    // 改革容忍度
    G._reformToleranceMult = Math.max(0.5, Math.min(1.5, _ti / 60));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-10 · 皇权 3 后果补完
  // ═══════════════════════════════════════════════════════════════════

  function _tickHuangquanConsequences(ctx, mr) {
    var G = global.GM;
    var hq = G.huangquan;
    if (!hq) return;
    // 进谏自由度（低皇权 → 大臣敢谏）
    hq.ministerFreedomToSpeak = Math.max(0.2, Math.min(1.0, 1.0 - hq.index / 200));
    // 奏疏质量（过高皇权 → 大臣只敢颂圣，质量差；过低 → 混乱，质量差；中 → 质量高）
    var dist = Math.abs(hq.index - 60);
    hq.memorialQuality = Math.max(0.3, 1.0 - dist / 80);
    // 改革难度
    hq.reformDifficulty = hq.index > 70 ? 0.6 : hq.index > 40 ? 1.0 : 1.8; // 强皇权易推，弱皇权难
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-11 · 执行度公式（皇权 × 皇威 × 诏详尽度）
  // ═══════════════════════════════════════════════════════════════════

  function computeEdictExecutionRate(edictCompleteness) {
    var G = global.GM;
    var hq = G.huangquan;
    var hw = G.huangwei;
    var hqBase = hq ? (0.5 + hq.index / 200) : 0.75;
    var hwMult = 1.0;
    if (hw) {
      if (hw.phase === 'tyrant') hwMult = 1.3;
      else if (hw.phase === 'majesty') hwMult = 1.1;
      else if (hw.phase === 'normal') hwMult = 1.0;
      else if (hw.phase === 'decline') hwMult = 0.7;
      else if (hw.phase === 'lost') hwMult = 0.35;
    }
    var completenessMult = (edictCompleteness || 0.5) * 0.5 + 0.5;
    return Math.max(0.1, Math.min(1.5, hqBase * hwMult * completenessMult));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-12 · 皇权×皇威 四象限判定
  // ═══════════════════════════════════════════════════════════════════

  var QUADRANT_PROTOTYPES = {
    tyrant_peak:   { name:'暴君顶点',     description:'朱元璋后期、隋炀帝',   hqRange:[70,100], hwRange:[80,100] },
    lonely_do:     { name:'事必躬亲无人听', description:'崇祯末',           hqRange:[70,100], hwRange:[0,40] },
    revered_puppet:{ name:'受敬傀儡',     description:'极罕见',           hqRange:[0,40],   hwRange:[70,100] },
    puppet:        { name:'汉献帝式傀儡',   description:'汉献帝',           hqRange:[0,40],   hwRange:[0,40] },
    optimal:       { name:'制衡威严',     description:'唐太宗、康熙中期',   hqRange:[40,70],  hwRange:[70,90] }
  };

  function getAuthorityQuadrant() {
    var G = global.GM;
    var hq = G.huangquan ? G.huangquan.index : 50;
    var hw = G.huangwei ? G.huangwei.index : 50;
    var keys = Object.keys(QUADRANT_PROTOTYPES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var p = QUADRANT_PROTOTYPES[k];
      if (hq >= p.hqRange[0] && hq <= p.hqRange[1] && hw >= p.hwRange[0] && hw <= p.hwRange[1]) {
        return { id: k, name: p.name, description: p.description };
      }
    }
    // 兜底
    return { id: 'normal', name: '常态', description: '—' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-13 · 天象/祥瑞/天人感应库
  // ═══════════════════════════════════════════════════════════════════

  var HEAVEN_SIGNS = [
    { id:'solar_eclipse',  name:'日食',     type:'bad',  severity:'major',  minxinDelta:-5, hwDelta:-3 },
    { id:'lunar_eclipse',  name:'月食',     type:'bad',  severity:'minor',  minxinDelta:-2, hwDelta:-1 },
    { id:'comet',          name:'彗星',     type:'bad',  severity:'major',  minxinDelta:-6, hwDelta:-4 },
    { id:'earthquake',     name:'地震',     type:'bad',  severity:'major',  minxinDelta:-8, hwDelta:-5 },
    { id:'flood_major',    name:'大水',     type:'bad',  severity:'major',  minxinDelta:-6, hwDelta:-3 },
    { id:'drought_major',  name:'大旱',     type:'bad',  severity:'major',  minxinDelta:-7, hwDelta:-3 },
    { id:'locust',         name:'蝗灾',     type:'bad',  severity:'major',  minxinDelta:-8, hwDelta:-4 }
  ];

  var AUSPICIOUS_SIGNS = [
    { id:'qilin',     name:'麒麟现',    type:'good', severity:'major',  minxinDelta:8,  hwDelta:5 },
    { id:'phoenix',   name:'凤凰现',    type:'good', severity:'major',  minxinDelta:8,  hwDelta:5 },
    { id:'sweet_dew', name:'甘露降',    type:'good', severity:'minor',  minxinDelta:3,  hwDelta:2 },
    { id:'white_deer',name:'白鹿见',    type:'good', severity:'moderate',minxinDelta:5, hwDelta:3 },
    { id:'twin_rice', name:'嘉禾',     type:'good', severity:'moderate',minxinDelta:5, hwDelta:3 },
    { id:'yellow_dragon',name:'黄龙见',type:'good', severity:'major',  minxinDelta:10, hwDelta:6 }
  ];

  function _tickHeavenSigns(ctx, mr) {
    // 天象/祥瑞随机触发（天人感应：民心低 → 天象多；民心高 → 祥瑞多）
    var G = global.GM;
    var mx = G.minxin;
    if (!mx) return;
    var badProb = Math.max(0, (60 - mx.trueIndex) / 1000) * mr;
    var goodProb = Math.max(0, (mx.trueIndex - 60) / 1500) * mr;
    if (Math.random() < badProb) {
      var sign = HEAVEN_SIGNS[Math.floor(Math.random() * HEAVEN_SIGNS.length)];
      _applyHeavenSign(sign);
      G._recentHeavenSign = true;
    }
    if (Math.random() < goodProb) {
      var asig = AUSPICIOUS_SIGNS[Math.floor(Math.random() * AUSPICIOUS_SIGNS.length)];
      _applyHeavenSign(asig);
    }
  }

  function _applyHeavenSign(sign) {
    var G = global.GM;
    if (!G.heavenSigns) G.heavenSigns = [];
    G.heavenSigns.push({ id: sign.id, name: sign.name, type: sign.type, turn: G.turn });
    if (G.heavenSigns.length > 40) G.heavenSigns.splice(0, G.heavenSigns.length - 40);
    if (typeof global.AuthorityEngines !== 'undefined') {
      if (sign.minxinDelta) global.AuthorityEngines.adjustMinxin(sign.type === 'good' ? 'auspicious' : 'heavenSign', sign.minxinDelta, sign.name);
      if (sign.hwDelta) global.AuthorityEngines.adjustHuangwei(sign.type === 'good' ? 'auspicious' : 'heavenlySign', sign.hwDelta, sign.name);
    }
    if (global.addEB) global.addEB(sign.type === 'good' ? '祥瑞' : '天象', sign.name);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1-14 · 皇权 subDims 四维
  // ═══════════════════════════════════════════════════════════════════

  function _ensureHuangquanSubDims() {
    var G = global.GM;
    var hq = G.huangquan;
    if (!hq) return;
    if (!hq.subDims) {
      hq.subDims = {
        central:    { value: hq.index, trend:'stable' },
        provincial: { value: hq.index, trend:'stable' },
        military:   { value: hq.index, trend:'stable' },
        imperial:   { value: hq.index, trend:'stable' }
      };
    }
  }

  function _tickHuangquanSubDims(mr) {
    var G = global.GM;
    var hq = G.huangquan;
    if (!hq || !hq.subDims) return;
    // central：朝廷百官敬畏度
    hq.subDims.central.value = Math.max(0, Math.min(100, hq.index * 0.9 + (hq.ministers && hq.ministers.ironGrip ? 10 : 0)));
    // provincial：地方听令度
    var avgCompl = 0.7;
    if (G.fiscal && G.fiscal.regions) {
      var total = 0, n = 0;
      Object.values(G.fiscal.regions).forEach(function(r) { total += r.compliance; n++; });
      if (n > 0) avgCompl = total / n;
    }
    hq.subDims.provincial.value = Math.max(0, Math.min(100, avgCompl * 100));
    // military：兵权归属
    hq.subDims.military.value = G.population && G.population.military && G.population.military.imperialControlLevel ?
      G.population.military.imperialControlLevel * 100 : hq.index;
    // imperial：后宫/宗室听命
    hq.subDims.imperial.value = Math.max(0, Math.min(100, hq.index - (G.population && G.population.byClass && G.population.byClass.imperial && G.population.byClass.imperial.wealth > 1000000 ? 10 : 0)));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P2-15 · 42 联动矩阵剩余 19 项补完
  // ═══════════════════════════════════════════════════════════════════

  function _allowPassiveAuthorityLinkage() {
    var G = global.GM;
    return !!(G && G.settings && G.settings.passiveAuthorityLinkage === true);
  }

  // ★变量联动 → 财政:走账本流水(同 tm-authority-engines.js _linkageFiscalFlow·治"裸改 .money 破坏 ledger.stock 镜像+下回合蒸发")。
  function _linkageFiscalFlow(container, delta, tag) {
    if (!container || !delta || !isFinite(delta)) return 0;
    if (!container.ledgers) container.ledgers = {};
    var led = container.ledgers.money;
    if (!led || typeof led !== 'object') {
      led = container.ledgers.money = { stock: Number(container.money) || Number(container.balance) || 0, sources: {}, sinks: {}, thisTurnIn: 0, thisTurnOut: 0, history: [] };
    }
    var before = Number(led.stock) || 0;
    var after = Math.max(0, before + delta);
    var applied = after - before;
    led.stock = after;
    if (applied >= 0) {
      led.thisTurnIn = (Number(led.thisTurnIn) || 0) + applied;
      if (!led.sources) led.sources = {};
      led.sources[tag] = (Number(led.sources[tag]) || 0) + applied;
    } else {
      led.thisTurnOut = (Number(led.thisTurnOut) || 0) - applied;
      if (!led.sinks) led.sinks = {};
      led.sinks[tag] = (Number(led.sinks[tag]) || 0) - applied;
    }
    container.balance = led.stock;
    container.money = led.stock;
    return applied;
  }

  function _tickFullLinkage(ctx, mr) {
    var G = global.GM;

    // 内帑 → 户口（内帑充盈可赐廪，户增）
    if (G.neitang && G.neitang.money > 3000000 && G.population && G.population.national) {
      var benefit = G.neitang.money * 0.001 * mr / 12;
      _linkageFiscalFlow(G.neitang, -benefit, '赐廪养民');
      G.population.national.mouths = Math.min(500000000, G.population.national.mouths + benefit * 0.1);
    }
    // 内帑 → 皇权（丰厚时内帑支持宦官）
    if (G.neitang && G.neitang.money > 5000000 && G.huangquan) {
      G.huangquan.drains.eunuchsRelatives = (G.huangquan.drains.eunuchsRelatives || 0) + 0.05 * mr;
    }
    // 内帑 → 民心（挥霍导致民怨）
    if (G.neitang && G.neitang.money > 10000000 && G.minxin) {
      if (typeof global.AuthorityEngines !== 'undefined') global.AuthorityEngines.adjustMinxin('imperialVirtue', -0.1 * mr, '内帑奢靡');
    }

    // 户口 → 内帑（皇庄进项）
    if (G.population && G.population.byCategory && G.population.byCategory.huangzhuang && G.neitang) {
      var huangzhuangMouths = G.population.byCategory.huangzhuang.mouths || 0;
      _linkageFiscalFlow(G.neitang, huangzhuangMouths * 0.3 * mr / 12, '皇庄进项');
    }
    // 户口 → 腐败（冗员多则腐败增）
    if (G.population && G.population.byCategory && G.population.byCategory.ruhu && G.corruption && typeof G.corruption === 'object') {
      var ruhu = G.population.byCategory.ruhu.mouths || 0;
      if (ruhu > 1000000) _addCorrIndex(G, 0.03 * mr);
    }
    // 户口 → 皇权（大人口需强管制）
    if (G.population && G.population.national && G.population.national.mouths > 200000000) {
      if (typeof global.AuthorityEngines !== 'undefined') global.AuthorityEngines.adjustHuangquan('idleGovern', -0.05 * mr, '人口繁巨');
    }

    // 腐败 → 皇威（贪腐官绅横行 → 皇威损）
    var corruptLevel = _corrIndex(G);
    if (_allowPassiveAuthorityLinkage() && corruptLevel > 70 && typeof global.AuthorityEngines !== 'undefined') {
      global.AuthorityEngines.adjustHuangwei('lostVirtueRumor', -0.1 * mr, '贪腐横行');
    }

    // 民心 → 户口（高民心 → 户口繁盛）
    if (G.minxin && G.minxin.trueIndex > 70 && G.population && G.population.national) {
      G.population.national.households = Math.round(G.population.national.households * (1 + 0.0003 * mr / 12));
    }
    // 民心 → 腐败（高民心 → 举报多 → 腐败曝光）
    if (G.minxin && G.minxin.trueIndex > 80 && G.corruption && typeof G.corruption === 'object') {
      _addCorrIndex(G, -0.05 * mr);
    }

    // 皇权 → 帑廪（强皇权 → 税收效率高）
    if (G.huangquan && G.huangquan.index > 70 && G.guoku) {
      _linkageFiscalFlow(G.guoku, Math.max(0, (G.huangquan.index - 70)) * 100 * mr / 12, '皇权·征收效率');
    }
    // 皇权 → 内帑（强皇权 → 内帑富实）
    if (G.huangquan && G.huangquan.index > 70 && G.neitang) {
      _linkageFiscalFlow(G.neitang, Math.max(0, (G.huangquan.index - 70)) * 50 * mr / 12, '皇权·内帑充实');
    }
    // 皇权 → 户口（弱皇权 → 户口失控）
    if (G.huangquan && G.huangquan.index < 40 && G.population) {
      G.population.hiddenCount = (G.population.hiddenCount || 0) + Math.round(G.population.national.households * 0.0002 * mr);
    }

    // 皇威 → 帑廪（威远 → 朝贡增）
    if (G.huangwei && G.huangwei.index > 85 && G.guoku && G.month === 1) {
      _linkageFiscalFlow(G.guoku, 50000, '万邦朝贡');
    }
    // 皇威 → 内帑（暴君段 → 内帑挥霍）
    if (G.huangwei && G.huangwei.phase === 'tyrant' && G.neitang) {
      _linkageFiscalFlow(G.neitang, -(10000 * mr), '暴君挥霍');
    }
    // 皇威 → 户口（威严 → 民附）
    if (G.huangwei && G.huangwei.index > 80 && G.population) {
      G.population.fugitives = Math.max(0, (G.population.fugitives || 0) - Math.round(G.population.national.mouths * 0.00002 * mr));
    }
    // 皇威 → 腐败（失威段 → 腐败公开化）
    if (G.huangwei && G.huangwei.phase === 'lost' && G.corruption && typeof G.corruption === 'object') {
      _addCorrIndex(G, 0.1 * mr);
    }
    // 皇威 → 皇权（威远 → 诏令更易推行，等效皇权提升）
    if (_allowPassiveAuthorityLinkage() && G.huangwei && G.huangwei.index > 85 && G.huangquan) {
      if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('personalRule', 0.02 * mr, '\u7687\u5a01\u9ad8\u6da8\u4f20\u5bfc');
      } else {
        G.huangquan.index = Math.min(100, G.huangquan.index + 0.02 * mr);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P2-16 · 民心感知随机偏差（监察弱时）
  // ═══════════════════════════════════════════════════════════════════

  function _tickPerceivedNoise(mr) {
    var G = global.GM;
    var mx = G.minxin;
    if (!mx) return;
    // 监察弱时，感知值会随机偏移
    var auditCoverage = (G.fiscal && G.fiscal.auditSystem && G.fiscal.auditSystem.coverageRatio) || 0.3;
    if (auditCoverage < 0.4) {
      var noise = (Math.random() - 0.3) * 10 * (0.4 - auditCoverage);
      mx.perceivedIndex = Math.max(0, Math.min(100, mx.perceivedIndex + noise * mr));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tickMinxinMatrix(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth-c] matrix:') : console.error('[auth-c] matrix:', e); }
    try { _tickOfficeTenure(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth-c] tenure:') : console.error('[auth-c] tenure:', e); }
    try { _detectPowerMinister(ctx); _tickPowerMinister(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth-c] pm:') : console.error('[auth-c] pm:', e); }
    try { _tickRevoltUpgrade(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth-c] revolt:') : console.error('[auth-c] revolt:', e); }
    try { _tickTyrantSyndrome(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth-c] tyrant:') : console.error('[auth-c] tyrant:', e); }
    try { _tickLostAuthorityCrisis(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth-c] lost:') : console.error('[auth-c] lost:', e); }
    try { _autoDetectHuangweiEvents(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.autoDetectHuangwei'); }
    try { _autoDetectHuangquanEvents(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.autoDetectHuangquan'); }
    try { _tickMinxinAdditionalSources(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickMinxinSources'); }
    try { _tickMinxinConsequences(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickMinxinConsequences'); }
    try { _tickHuangquanConsequences(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickHuangquanConsequences'); }
    try { _tickHeavenSigns(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickHeavenSigns'); }
    try { _tickHuangquanSubDims(mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickHuangquanSubDims'); }
    try { _tickFullLinkage(ctx, mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickFullLinkage'); }
    try { _tickPerceivedNoise(mr); } catch(e) { if(window.TM&&TM.errors) TM.errors.capture(e,'authority.tickPerceivedNoise'); }
  }

  function init() {
    _initMinxinMatrix();
    _ensureHuangquanSubDims();
  }

  // AI 上下文扩展
  function getExtendedAIContext() {
    var G = global.GM;
    if (!G) return '';
    var lines = [];
    // 四象限
    var q = getAuthorityQuadrant();
    if (q && q.id !== 'normal') lines.push('【君主原型】' + q.name + '（' + q.description + '）');
    // 权臣
    if (G.huangquan && G.huangquan.powerMinister) {
      lines.push('【权臣】' + G.huangquan.powerMinister.name + ' 控制度 ' + (G.huangquan.powerMinister.controlLevel * 100).toFixed(0) + '%');
    }
    // 民变分级
    var mx = G.minxin;
    if (mx && mx.revolts) {
      var ongoing = mx.revolts.filter(function(r){return r.status==='ongoing';});
      if (ongoing.length > 0) {
        var levels = ongoing.map(function(r){ return REVOLT_LEVELS[(r.level||1)-1].name; }).join('、');
        lines.push('【民变】进行中：' + levels);
      }
    }
    // 天象
    if (G.heavenSigns) {
      var recent = G.heavenSigns.filter(function(s){return (G.turn||0) - s.turn < _turnsForMonthsLocal(6);});
      if (recent.length > 0) lines.push('【天象】' + recent.map(function(s){return s.name;}).join('、'));
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.AuthorityComplete = {
    init: init,
    tick: tick,
    triggerHuangweiEvent: triggerHuangweiEvent,
    triggerHuangquanEvent: triggerHuangquanEvent,
    handleCrisisAction: handleCrisisAction,
    handleCrisisSurfaceResponse: handleCrisisSurfaceResponse,
    inferCrisisActionFromSurface: inferCrisisActionFromSurface,
    suppressRevolt: suppressRevolt,
    getAuthorityQuadrant: getAuthorityQuadrant,
    computeEdictExecutionRate: computeEdictExecutionRate,
    getExtendedAIContext: getExtendedAIContext,
    tickOfficeTenure: _tickOfficeTenure,
    detectPowerMinister: _detectPowerMinister,
    isPowerMinisterEnabled: _powerMinisterEnabled,
    REVOLT_LEVELS: REVOLT_LEVELS,
    HEAVEN_SIGNS: HEAVEN_SIGNS,
    AUSPICIOUS_SIGNS: AUSPICIOUS_SIGNS,
    QUADRANT_PROTOTYPES: QUADRANT_PROTOTYPES,
    HUANGWEI_DELTAS: HUANGWEI_DELTAS,
    HUANGQUAN_DELTAS: HUANGQUAN_DELTAS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
