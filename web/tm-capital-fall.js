// @ts-check
// ============================================================
// tm-capital-fall.js — 京师陷落（破京）：京城所在的地块归了朝廷以外的势力，就走破京裁决，谁攻下的都一样
//   （民变重做·成势，11-18）
//
// 同志 11-15：「民4 占城成势和民7 打到京师，这不是一个东西吗」——民变成了势力以后，打到京师就是普通的势力战争，
//   攻下京师走现成的破京裁决（终局＝所扮之人被杀；有储君继统续玩）。11-18 定「甲」：归了朝廷以外的任何势力都算。
// 原先破京只挂在旧五级梯第 5 级（旧三件套 tm-revolt-entity.js 的三拍，11-21 连梯带三件套删了），五级梯 11-08 冻住后，新开的局里京师根本破不了：
//   不论民变还是外敌，打下京城所在的州什么都不发生。这一刀把破京挪到这里，按易主后的状态看，旧梯那条链删掉。
//
// 每回合一次（过回合 6.1456，民变成势之后）：京城（GM._capital）所在的地块现归谁（FactionMembership.regionInfo，
//   与易主写口同一套认法）——朝廷（玩家一方）守着的记下「守着」（G._capitalHeld）；守过、现在归了别家，就破京：
//   G._capitalFallen（皇威 capitalFall 等既有消费端认这个），定命三择其一，场景与择命交 AI 演（callAI 在才演，演不出按殉国）：
//     death    殉国或城破被弑 → 玩家之死裁决器（kind=regicide；有储君继统续玩，无嗣终局）；裁决器缺席回落经典终局信号；
//     captured 被执 → player._captured（社稷悬议、赎还等既有消费端认）；
//     escaped  乘乱出走 → 驻跸于外诏勤王。
//   菜单外的一律按殉国。没见朝廷守过的不判（开局就不在手里、迁都后还没守过、易主到无主）。
// 收复京城（11-22，同志「按你推荐来」甲）：京城回到朝廷手里，破京标记清掉、这次陷落连同光复记进 G._capitalFallHistory、
//   事件栏「光复京师」；破京判定与皇威那次 −30 都重新上膛（再丢再判、再扣）。被执的君上不随之回来（回来走 tm-captive-court.js 放还）。
// 未做：总纲的「无人可承可另选一人」（换人那边接）。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var FATES = { death: 1, captured: 1, escaped: 1 };

  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function eb(text) {
    if (typeof global.addEB !== 'function') return;
    try { global.addEB('国变', text, { credibility: 'high' }); } catch (_) { /* 事件流写不进只少一行字，状态已落 */ }
  }
  function captureErr(e, where) {
    try { if (TM.errors && typeof TM.errors.captureSilent === 'function') TM.errors.captureSilent(e, where); } catch (_) { /* 记错本身失败：只是少一条错误记录 */ }
  }

  function playerFactionName(G) {
    var MS = global.MilitarySystems, name = '';
    if (MS && typeof MS.battlePlayerFaction === 'function') { try { name = str(MS.battlePlayerFaction(G)); } catch (_) { name = ''; } }
    if (!name) { var pi = (G && G.playerInfo) || (global.P && global.P.playerInfo) || {}; name = str(pi.factionName || pi.factionId); }
    if (!name) { var own = arr(G && G.facs).filter(function (f) { return f && f.isPlayer; })[0]; name = own ? str(own.name) : ''; }
    var fac = arr(G && G.facs).filter(function (f) { return f && (f.name === name || (f.id != null && str(f.id) === name)); })[0];
    return fac ? str(fac.name) : name;
  }
  function playerChar(G) { return arr(G && G.chars).filter(function (c) { return c && c.isPlayer && c.alive !== false; })[0] || null; }
  function conquerorLeader(G, facName) {
    var fac = arr(G && G.facs).filter(function (f) { return f && f.name === facName; })[0], name = fac ? str(fac.leader) : '';
    if (!name) return null;
    return arr(G.chars).filter(function (c) { return c && c.name === name; })[0] || { name: name };
  }

  // 京城所在的地块（认不出返回 null：京城名在地图与区划里对不上，就不判）。
  // 京城名直认得的直认（晚唐「京兆府·长安」、绍宋「应天府」）；认不出的走全游戏的地名解析（tm-map-locations.js：
  //   天启写「北京」，地图上这块叫顺天府）；旧档的旧图上没有这块地，再按同一处的别称（tm-utils.js 的别称表）挨个认区划。
  //   认出不止一处的不判（两可）。11-18 天启干跑查出：只直认时天启的京城认不出，破京永远不发
  function capitalInfo(G) {
    var cap = str(G && (G._capital || G.capital)).trim(), FM = TM.FactionMembership;
    if (!cap || !FM || typeof FM.regionInfo !== 'function') return null;
    var info = FM.regionInfo(cap);
    if (info) return info;
    var ML = global.TMMapLocations;
    if (ML && typeof ML.placeRegionIds === 'function') {
      var ids = [];
      try { ids = arr(ML.placeRegionIds(cap, G)); } catch (e) { captureErr(e, 'capital-fall.place'); }
      if (ids.length > 1) return null;
      if (ids.length === 1 && (info = FM.regionInfo(ids[0]))) return info;
    }
    var aliases = global._LOC_ALIASES, group = typeof global._locAliasOf === 'function' && aliases ? global._locAliasOf(cap.split(/[·・]/)[0].trim()) : '';
    if (!group) return null;
    var hits = [];
    Object.keys(aliases).forEach(function (k) {
      if (aliases[k] !== group) return;
      var r = FM.regionInfo(k);
      if (r && !hits.some(function (h) { return h.id === r.id; })) hits.push(r);
    });
    return hits.length === 1 ? hits[0] : null;
  }

  // 每回合一次：看京城还归不归朝廷
  function check(G) {
    G = G || global.GM;
    if (!G) return null;
    var info = capitalInfo(G), pf = playerFactionName(G);
    if (!info || !pf) return null;
    if (info.owner === pf) {
      G._capitalHeld = { regionId: info.id, name: info.name, turn: num(G.turn, 0) };
      return G._capitalFallen ? recover(G, info, pf) : null;
    }
    if (G._capitalFallen) return null;
    var held = G._capitalHeld;
    if (!held || held.regionId !== info.id || !info.owner) return null;
    return fall(G, { by: info.owner, regionId: info.id, regionName: info.name, capital: str(G._capital || G.capital) });
  }

  // 收复京城：清破京标记，这次陷落连同光复记一笔，重新上膛。皇威不另加：打回来的那一仗自有战报接皇威；
  //   皇威那次 −30 的「已扣」由 tm-authority-complete.js 见京城不再陷落自己复位。
  //   怎么回来的（打回、议和归还、占城的一方没了）这里不知道，事件栏只写「前为谁所陷」，不写「败走」
  function recover(G, info, pf) {
    var cf = G._capitalFall || {}, turn = num(G.turn, 0);
    if (!Array.isArray(G._capitalFallHistory)) G._capitalFallHistory = [];
    G._capitalFallHistory.push({
      fellTurn: num(cf.turn, 0), by: str(cf.by), fate: str(cf.fate), regionName: str(info.name || cf.regionName),
      recoveredTurn: turn, recoveredBy: str(pf)
    });
    G._capitalFallen = false;
    delete G._capitalFall;
    eb('光复京师！' + (str(G._capital || G.capital) || str(info.name) || '京城') + '重归朝廷' + (cf.by ? '（前为「' + str(cf.by) + '」所陷）' : ''));
    return { recovered: true, turn: turn };
  }

  // 破京：落旗、记下谁打下的；定命交 AI 场景（callAI 在才演），否则当场按殉国落
  function fall(G, info) {
    if (!G || G._capitalFallen) return null;
    info = info || {};
    G._capitalFallen = true;
    G._capitalFall = { turn: num(G.turn, 0), by: str(info.by), regionId: str(info.regionId), regionName: str(info.regionName), capital: str(info.capital) };
    eb('京师陷落！「' + (str(info.by) || '乱军') + '」入据' + (str(info.capital) || str(info.regionName) || '京城') + '·社稷倾覆在即');
    if (typeof global.callAI === 'function') { scheduleScene(G, info); return { scheduled: true }; }
    return applyOutcome(G, info, { fate: 'death' });
  }

  function scheduleScene(G, info) {
    var cf = G._capitalFall || (G._capitalFall = {});
    if (cf.scenePending != null) return;
    cf.scenePending = num(G.turn, 0);
    var job = function () { return scene(G, info); };
    if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('capitalFallScene', job);
    else job();
  }

  // 定命一幕：AI 演场景、三择其一；结构化结果交 applyOutcome 落账（死亡仍只走裁决器）
  async function scene(G, info) {
    info = info || {};
    var player = playerChar(G), leader = conquerorLeader(G, str(info.by)), PS = TM.Person;
    function who(ch) {
      if (!ch) return '?';
      try { if (PS && typeof PS.brief === 'function' && ch.id != null) return PS.brief(ch, { detail: 'line' }) || str(ch.name); } catch (_) { /* 人物简述取不到就只给名字 */ }
      return str(ch.name) || '?';
    }
    var prompt = '你是天命推演引擎的国变演绎官。京城' + str(info.capital) + '已陷——「' + str(info.by) + '」'
      + (leader ? '（为首者：' + who(leader) + '）' : '') + '入据宫阙。君上：' + who(player) + '，身在城中·' + str(G.eraName) + '。\n'
      + '按入城一方的来历性情与君上处境，演绎君上定命一幕（乱军之中何去何从，入城者如何处置）。三择其一：\n'
      + 'death=殉国或城破被弑；captured=被执（受辱而生·社稷仍悬）；escaped=乘乱出走·驻跸于外诏勤王。\n'
      + '只返回 JSON：{"fate":"death|captured|escaped","scene":"定命场景≤120字·据实而书如史笔"}';
    var outcome = { fate: 'death' };
    try {
      var resp = await global.callAI(prompt, 500, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'breach-scene' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      if (j && FATES[j.fate]) outcome = { fate: j.fate, narrative: String(j.scene || '').slice(0, 160) };
    } catch (e) { captureErr(e, 'CapitalFall.scene'); }   // 演不出按殉国（与原破京链同）
    try { return applyOutcome(G, info, outcome); }
    catch (e2) { captureErr(e2, 'CapitalFall.applyOutcome'); return applyOutcome(G, info, { fate: 'death' }); }
  }

  // 定命落账：三择其一，菜单外按殉国；死亡只走玩家之死裁决器
  function applyOutcome(G, info, o) {
    o = o || {}; info = info || {};
    var turn = num(G.turn, 0), by = str(info.by) || '乱军', fate0 = FATES[o.fate] ? String(o.fate) : 'death';
    if (o.narrative) {
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.push({ turn: turn, date: G._gameDate || '', type: '国变', text: String(o.narrative).slice(0, 160), tags: ['破京', 'AI演绎'] });
    }
    var player = playerChar(G), leader = conquerorLeader(G, by);
    if (G._capitalFall) G._capitalFall.fate = fate0;
    function fallInfo(f) {
      G._dynastyFallInfo = {   // 终局富屏、本纪增强
        revolt: str(info.revoltId), turn: turn, region: str(info.regionName),
        leader: leader ? str(leader.name) : '', facName: by, breach: true, fate: f
      };
    }
    if (player && fate0 === 'captured') {
      player._captured = true; player._capturedBy = by;   // 被执：花名册、推演、社稷悬议既有消费
      player._capturedLocation = by + '军中';
      fallInfo('captured');
      eb('君上蒙尘·为「' + by + '」所执·社稷存亡悬于一线');
      return { fate: 'captured' };
    }
    if (player && fate0 === 'escaped') {
      fallInfo('escaped');
      eb('君上乘乱出走·驻跸于外·诏天下兵马勤王');
      return { fate: 'escaped' };
    }
    var fate = null;
    try {
      if (player && typeof global.adjudicatePlayerDeath === 'function') {
        fate = global.adjudicatePlayerDeath(player, '京师陷落·殁于社稷', { kind: 'regicide', deadReason: '京师陷落·殁于社稷' });
      }
    } catch (e) { captureErr(e, 'CapitalFall.adjudicate'); }
    fallInfo(fate ? fate.outcome : 'no-adjudicator');
    if (fate && fate.outcome === 'succession') {
      eb('嗣君于乱军之外继统·社稷不绝如线·天下事犹未可知');
      return { fate: 'death', outcome: 'succession' };
    }
    if (fate) return { fate: 'death', outcome: fate.outcome };   // 裁决器已定终局（_playerDead 信号独家收场，绝不双发）
    // 裁决器缺席（裸跑、装载序）：回落经典终局信号，字段照旧契约（_consumeDynastyEndSignal）
    G._gameOver = {
      type: 'dynasty_change', revolt: str(info.revoltId), turn: turn,
      region: str(info.regionName), level: 5, levelName: '改朝',
      leader: leader ? str(leader.name) : '', breach: true, capitalFallen: true
    };
    eb('改朝换代！天命已移');
    return { fate: 'death', outcome: 'game-over' };
  }

  TM.CapitalFall = { check: check, fall: fall, recover: recover, applyOutcome: applyOutcome, scheduleScene: scheduleScene, scene: scene, capitalInfo: capitalInfo };
})(typeof window !== 'undefined' ? window : globalThis);
