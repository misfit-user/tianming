// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-ai-npc-memorials.js v3 —— 朝堂场景描述器（仅构造 AI 上下文，不硬触发）
 *
 * ───────── 重要设计修订（2026-04-18）─────────
 *
 * 旧版错误：系统"扫描"事件并把它们硬塞进 GM._pendingEventReactions 队列，
 * 然后 AI 被动地按清单响应——本质上还是"系统判定，AI 打工"。
 *
 * 新版哲学：
 *   · 系统**不**扫描事件、**不**维护队列、**不**硬触发
 *   · AI 推演时直接看当前 七变量 + NPC + 区划 + 派系 状态
 *   · 是否有"权臣""民变""异象""灾荒""瘟疫"—— AI 看了数据自己判断
 *   · AI 通过现有 p1.npc_interactions[] schema 产出 NPC 行为
 *     （已由 tm-endturn.js 的 _dispatchNpcActionToPlayer 路由到 奏疏/问对/鸿雁/起居注/风闻）
 *
 * 本文件只保留两个职责：
 *   1. buildNpcSceneContext() —— 构造"当前朝堂场景"文字供 AI prompt 注入
 *   2. _summarizeCandidateNpcs() —— 列出候选 NPC（含深化字段）供 AI 扮演参考
 *
 * 不再有 scanAndEnqueueEvents / _pendingEventReactions / 11 类硬触发 / 冷却表。
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  构造"朝堂现况"场景文字 —— 纯数据陈述，无触发、无引导、无预判
  // ═══════════════════════════════════════════════════════════════════

  function buildNpcSceneContext() {
    var G = global.GM;
    if (!G) return '';
    var lines = [];

    // ── 1. 当前朝堂观察（纯数据陈述） ──
    var obs = _observeCurrentState(G);
    if (obs.length > 0) {
      lines.push('——当前观察到的局面（陈述事实，不是任务清单）——');
      obs.forEach(function(o) { lines.push('  · ' + o); });
      lines.push('');
    }

    // ── 2. 扮演指引（anti-tool-person）──
    lines.push('——扮演指引——');
    lines.push('你要让每个重要 NPC 根据其人格/派系/恩怨/能力/信息面，自主决定本回合要不要有动作、做什么。');
    lines.push('可能的行为（请按 NPC 个性选择，不要按职位套模板）：');
    lines.push('  · 上奏疏、抗疏、弹劾、举荐、担保、联名陈情');
    lines.push('  · 求见密陈、私访、宴请、诗酒切磋');
    lines.push('  · 鸿雁密信、通报情报、馈赠');
    lines.push('  · 构陷、背叛、告密、结党营私、暗通款曲');
    lines.push('  · 袖手不言、明哲保身、借机牟利');
    lines.push('  · 能力不足把事办砸、信息不全判断失误');
    lines.push('  · 正人被小人构陷、忠良被冷落、奸佞得势');
    lines.push('');
    lines.push('禁忌：');
    lines.push('  × 不要"御史必谏、将军必请战、清流必劾宦官"这种工具人模板');
    lines.push('  × 不要所有人对同一件事都响应 —— 多数人观望，少数人介入');
    lines.push('  × 不要只产奏疏 —— 私人活动、党争、旁观都是正当反应');
    lines.push('  × 不要被历史锁死 —— 架空策略只要合理就可产出');
    lines.push('');

    // ── 3. 候选 NPC 清单（含深化字段） ──
    try {
      var npcsBrief = _summarizeCandidateNpcs(G);
      if (npcsBrief) {
        lines.push('——候选 NPC（含人设/派系/权力/关系，供你扮演参考）——');
        lines.push(npcsBrief);
        lines.push('');
      }
    } catch (_e) {}

    // ── 4. 输出引导（走现有 schema） ──
    lines.push('——产出方式——');
    lines.push('用 p1.npc_interactions[] 数组（已有 schema）：');
    lines.push('  { actor, target, type, description, involvedOthers?, publicKnown? }');
    lines.push('type 支持：impeach/slander/expose_secret/recommend/guarantee/petition_jointly');
    lines.push('          /private_visit/invite_banquet/duel_poetry/gift_present');
    lines.push('          /correspond_secret/share_intelligence/frame_up/betray 等');
    lines.push('系统自动路由到 奏疏/问对/鸿雁/起居注/风闻。');

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  观察当前状态 —— 把"现在是什么局面"用自然语言陈述，不定性 NPC 行为
  // ═══════════════════════════════════════════════════════════════════

  function _observeCurrentState(G) {
    var obs = [];

    // 权臣
    if (G.huangquan && G.huangquan.powerMinister) {
      var pm = G.huangquan.powerMinister;
      obs.push('权臣：' + pm.name + '（权重 ' + Math.round(pm.weight||0) + '），皇权指数 ' + Math.round(G.huangquan.index||0));
    }
    // 民心
    if (G.minxin) {
      var mx = G.minxin.trueIndex||0;
      if (mx < 40) obs.push('民心低迷：真 ' + Math.round(mx) + '/视 ' + Math.round(G.minxin.perceivedIndex||mx));
      if (G.minxin.revolts && G.minxin.revolts.length > 0) {
        var ongoing = G.minxin.revolts.filter(function(r){return r.status==='ongoing';});
        if (ongoing.length > 0) {
          obs.push('进行中民变：' + ongoing.length + ' 起（' + ongoing.slice(0,3).map(function(r){return (r.region||'某地')+'L'+r.level;}).join('、') + '）');
        }
      }
    }
    // 皇威
    if (G.huangwei) {
      if (G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active) {
        obs.push('君威段：暴君（阿谀 ' + Math.round((G.huangwei.tyrantSyndrome.flatteryMemorialRatio||0)*100) + '%）');
      } else if (G.huangwei.lostAuthorityCrisis && G.huangwei.lostAuthorityCrisis.active) {
        obs.push('君威段：失威危机（皇威 ' + Math.round(G.huangwei.index||0) + '）');
      }
    }
    // 天象（只陈述，不触发）—— 若现有 GM.heavenSigns 有近期记录
    if (Array.isArray(G.heavenSigns)) {
      var recentSigns = G.heavenSigns.filter(function(s){return (G.turn||0) - (s.turn||0) < 3;});
      if (recentSigns.length > 0) {
        obs.push('近期天象：' + recentSigns.slice(0,3).map(function(s){return (s.name||s.type||'?');}).join('、'));
      }
    }
    // 灾害/瘟疫
    if (G.population && Array.isArray(G.population.plagueEvents)) {
      var recentPlg = G.population.plagueEvents.filter(function(p){return (G.turn||0) - (p.turn||0) < 3;});
      if (recentPlg.length > 0) obs.push('近期瘟疫：' + recentPlg.length + ' 起');
    }
    // 战事
    if (Array.isArray(G.activeWars) && G.activeWars.length > 0) {
      obs.push('进行中战事：' + G.activeWars.length + ' 场（' + G.activeWars.slice(0,2).map(function(w){return (w.name||w.enemy||'?');}).join('、') + '）');
    }
    // 财政
    if (G.guoku && G.guoku.money !== undefined) {
      var mn = G.guoku.money;
      if (mn < 100000) obs.push('国库告罄：银 ' + Math.round(mn/10000) + ' 万两');
    }
    // 腐败 6 部门
    if (G.corruption && (G.corruption.byDept || G.corruption.subDepts)) {
      var hi = [];
      var deptSource = G.corruption.byDept || G.corruption.subDepts || {};
      Object.keys(deptSource).forEach(function(d){
        var v = deptSource[d];
        if (typeof v === 'object') v = v.true || v.overall;
        if (typeof v === 'number' && v > 60) hi.push(d + '=' + Math.round(v));
      });
      if (hi.length > 0) obs.push('腐败高位：' + hi.join('、'));
    }
    // 过载区划
    if (G.adminHierarchy) {
      var overload = [];
      Object.keys(G.adminHierarchy).forEach(function(fk){
        var divs = G.adminHierarchy[fk] && G.adminHierarchy[fk].divisions || [];
        divs.forEach(function(d){
          if (d.environment && d.environment.currentLoad > 0.9) overload.push(d.name);
        });
      });
      if (overload.length > 0) obs.push('区划过载：' + overload.slice(0,4).join('、'));
    }

    return obs;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  候选 NPC 清单（含深化字段）
  // ═══════════════════════════════════════════════════════════════════

  function _summarizeCandidateNpcs(G) {
    if (!Array.isArray(G.chars)) return '';
    var posByName = {};
    (function _w(ns){ (ns||[]).forEach(function(n){
      (n.positions||[]).forEach(function(p){ if (p && p.name) posByName[p.name] = p; });
      if (n.subs) _w(n.subs);
    }); })(G.officeTree || []);

    var list = G.chars.filter(function(c) {
      if (!c || c.alive === false || !(c.officialTitle || (c.rank && c.rank <= 5))) return false;
      // 受限者不列为"可上奏/可弹劾"候选喂给 AI(玩家报:下狱/罢官者仍上奏)
      if (c._imprisoned || c.imprisoned || c._inPrison || c._exiled || c.exiled ||
          c._banished || c._fled || c.fled || c._missing || c._retired || c.retired) return false;
      return true;
    }).slice(0, 20);
    var lines = [];
    list.forEach(function(c) {
      var parts = [c.name];
      if (c.officialTitle) parts.push(c.officialTitle);
      if (c.faction) parts.push('[' + c.faction + ']');
      parts.push('忠' + (c.loyalty||'?') + '·志' + (c.ambition||'?') + '·廉' + (c.integrity||'?'));
      var pm = posByName[c.officialTitle];
      if (pm) {
        var powerStr = [];
        if (pm.powers) {
          if (pm.powers.appointment) powerStr.push('辟署');
          if (pm.powers.impeach) powerStr.push('弹劾');
          if (pm.powers.taxCollect) powerStr.push('征税');
          if (pm.powers.militaryCommand) powerStr.push('调兵');
        }
        if (powerStr.length) parts.push('权{' + powerStr.join('·') + '}');
        if (pm.privateIncome && pm.privateIncome.illicitRisk === 'high') parts.push('肥缺');
      }
      if (c.resources && c.resources.private) {
        var pw = c.resources.private;
        if (pw.money > 100000) parts.push('富' + Math.round(pw.money/10000) + '万');
      }
      if (typeof global.getTopRelations === 'function') {
        var rels = global.getTopRelations(c.name, 2) || [];
        if (rels.length) {
          var rstr = rels.map(function(r){ return r.type + r.target; }).join('·');
          parts.push('~' + rstr);
        }
      }
      lines.push('  · ' + parts.join(' '));
    });
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出 + 兼容性 stub
  // ═══════════════════════════════════════════════════════════════════

  // 兼容旧 API —— 外部可能还在调 tick / scanAndEnqueueEvents / buildEventReactionPrompt
  //  · tick: no-op（不再维护事件队列）
  //  · scanAndEnqueueEvents: no-op
  //  · buildEventReactionPrompt: 别名 → buildNpcSceneContext

  function tick(ctx) { /* no-op in v3 */ }
  function scanAndEnqueueEvents(ctx) { /* no-op in v3 */ }

  global.NpcMemorials = {
    tick: tick,
    scanAndEnqueueEvents: scanAndEnqueueEvents,
    buildEventReactionPrompt: buildNpcSceneContext,  // 别名
    buildNpcSceneContext: buildNpcSceneContext,
    VERSION: 3
  };

  global.buildEventReactionPrompt = buildNpcSceneContext;
  global.buildNpcSceneContext = buildNpcSceneContext;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
