/* tm-battle-turn.js — 御驾亲征接入 · Phase 2「活线:咽喉拦截 + 会战阶段」
 * 与每回合军事推演 AI 调用挂钩:AI step 产出的 battleResult 走单一咽喉 MilitarySystems.applyBattleResult,
 * 此处包裹该咽喉——涉玩家势力军 + 御驾亲征开启 → 延后(不立即抽象结算),回合末「会战阶段」让玩家亲征/委之。
 * ★安全:整套挂 flag(GM._yujiaQinzheng·默认 OFF)→ 涉玩家判定恒 false → 包裹透传 = 零行为变更。
 * ★bulletproof:拦截逻辑任何报错 → 退回原咽喉(原抽象结算·绝不因接入弄坏战斗)。
 */
(function () {
  'use strict';
  var pending = [];   // 本回合延后的玩家势力战斗

  function W() { return (typeof window !== 'undefined') ? window : null; }
  function enabled(GM) { return !!(GM && (GM._yujiaQinzheng || (GM.settings && GM.settings.yujiaQinzheng))); }
  function playerFaction(GM) {
    var w = W(), P = w && w.P;
    return (P && P.playerInfo && P.playerInfo.factionName) || (GM && GM.playerFaction) || null;
  }
  function findArmy(GM, id) {
    if (!GM || !Array.isArray(GM.armies)) return null;
    for (var i = 0; i < GM.armies.length; i++) if (GM.armies[i] && GM.armies[i].id === id) return GM.armies[i];
    return null;
  }
  function involvesPlayer(br, GM) {
    if (!br || !enabled(GM)) return false;
    if (br._fromTactical) return false;                          // 战术回填的不再拦(防环)
    var pf = playerFaction(GM); if (!pf) return false;
    var aa = br.affectedArmies || [];
    for (var i = 0; i < aa.length; i++) { var a = findArmy(GM, aa[i].armyId); if (a && a.faction === pf) return true; }
    return (br.winnerFactionId === pf || br.loserFactionId === pf);
  }

  /* 包裹咽喉调用:涉玩家+开启→stash 延后·返 true(咽喉跳过立即应用) */
  function maybeDefer(br, GM) {
    if (!involvesPlayer(br, GM)) return false;
    var pf = playerFaction(GM), pArmies = [], eArmies = [];
    (br.affectedArmies || []).forEach(function (aa) { var a = findArmy(GM, aa.armyId); if (a) { (a.faction === pf ? pArmies : eArmies).push(a); } });
    if (!pArmies.length) return false;                           // 没解析到玩家军→不拦(安全)
    var prov = (pArmies[0] && (pArmies[0].location || pArmies[0].garrison)) || '';
    pending.push({ battleResult: br, playerArmies: pArmies, enemyArmies: eArmies, provinceName: prov });
    try { GM._pendingAbstractBattles = GM._pendingAbstractBattles || []; GM._pendingAbstractBattles.push(br); } catch (e) {}   // ★持久化镜像(随存档)·会战阶段中断也不丢→recoverPending 抽象兜底
    return true;
  }
  function dropPersisted(GM, br) { try { var arr = GM && GM._pendingAbstractBattles; if (Array.isArray(arr)) { var i = arr.indexOf(br); if (i >= 0) arr.splice(i, 1); } } catch (e) {} }
  function recoverPending(GM) {   /* 排空持久化残留(上回合会战阶段中断遗留)→抽象兜底落地·该战不丢 */
    try { var arr = GM && GM._pendingAbstractBattles; if (Array.isArray(arr) && arr.length) { arr.splice(0).forEach(function (br) { try { applyReal(br, GM); } catch (e) {} }); } } catch (e) {}
  }

  /* 会战缴获:战果应用后一次(防双扣 _spoilsDone)·胜方从败方参战部队装备缴获入武库(玩家败则己方折损) */
  function _spoils(br, GM) {
    try { if (!br || br._spoilsDone) return; br._spoilsDone = true; var w = W(), AR = w && w.TMArmory; if (AR && typeof AR.battleSpoils === 'function') AR.battleSpoils(GM || (w && w.GM), br); } catch (e) {}
  }
  /* 战后历练增长(§12.3·整编屏地基刀1的活线接入):玩家军按本战减员率获历练(走 TMArmyUnits.gainBattleVeterancy)。
   * 仅御驾亲征流程(runPending/recoverPending→applyReal)调→天然 flag-gated·不泄漏全局战斗·永不崩。NPC 军不动(v1 无整编屏)。 */
  function _gainPostBattleVeterancy(br, GM) {
    try {
      if (!br || !GM) return;
      var w = W(), AU = w && w.TMArmyUnits;
      if (!AU || typeof AU.gainBattleVeterancy !== 'function') return;
      var pf = playerFaction(GM);
      (br.affectedArmies || []).forEach(function (aa) {
        if (!aa) return;
        var a = findArmy(GM, aa.armyId);
        if (!a || (pf && a.faction !== pf)) return;             // 仅玩家军
        var loss = Math.max(0, +aa.loss || 0);
        var nowS = Math.max(0, +(a.soldiers || a.strength || 0));
        var pre = nowS + loss;                                   // 战前 = 战后 + 本战损
        AU.gainBattleVeterancy(a, pre > 0 ? loss / pre : 0);     // 标脏→下次 ensure 重派 units[] 历练
      });
    } catch (e) {}
  }
  function applyReal(br, GM) {
    var w = W(), MS = w && w.MilitarySystems;
    var fn = MS && (MS._origApplyBattleResult || MS.applyBattleResult);
    if (typeof fn === 'function') { try { fn.call(MS, br, GM); } catch (e) {} }
    _spoils(br, GM);
    _gainPostBattleVeterancy(br, GM);   // 战后历练(玩家军·按减员率·仅御驾亲征流程→flag-gated)
    _postBattleRetreat(br, GM);         // O2 战后溃退(败方退最近友控邻省/被围重损请降·仅御驾亲征流程→flag-gated)
  }

  /* ── O2 撤退/追击(v2·§9):败方军沿邻接退最近友控邻省·无路可退=被围(重损/低士气请降)。
   * 追击战损已由夹带覆盖(tacticalToBattleResult 把败方损失落带内·战术实况定落点·清退低/被堵高);
   * 主将突围/被俘已由战术 commanders fate 流入 commanderFate——本函数只补「空间后果」(位置移动/被围)。
   * 邻接数据:GM.mapData/P.map/P.mapData/MING_MAP_REGIONS 的 regions[].neighbors(region id 空间)映射回省名;
   * 无邻接数据的剧本→优雅降级不移动(永不崩·审计:tianqi-ming2 邻接对称干净·7 边陲空邻接)。 */
  function _mapRegions() {
    var w = W(); if (!w) return null;
    var cands = [w.GM && w.GM.mapData, w.P && w.P.map, w.P && w.P.mapData, { regions: w.MING_MAP_REGIONS }];
    for (var i = 0; i < cands.length; i++) { var m = cands[i]; if (m && Array.isArray(m.regions) && m.regions.length) return m.regions; }
    return null;
  }
  function _provOwner(GM, name) {
    try {
      var m = GM && GM._provinceToFaction; if (m && m[name] != null && String(m[name])) return String(m[name]);
      var ps = GM && GM.provinceStats; if (ps && ps[name] && ps[name].owner != null) return String(ps[name].owner);
    } catch (e) {}
    return null;
  }
  function _regionOf(regions, provName) {
    var key = String(provName || '').trim(); if (!key) return null;
    var i, r;
    for (i = 0; i < regions.length; i++) { r = regions[i]; if (r && String(r.name || '').trim() === key) return r; }
    for (i = 0; i < regions.length; i++) { r = regions[i]; var n = String((r && r.name) || '').trim(); if (n && (n.indexOf(key) >= 0 || key.indexOf(n) >= 0)) return r; }
    return null;
  }
  /* 军的撤退去向:{kind:'hold'本省友控就地收拢|'retreat',to友控邻省|'surrounded'四面无路|'none'数据不足降级} */
  function retreatTarget(GM, army) {
    try {
      var loc = (army && (army.garrison || army.location)) || '';
      var fac = String((army && army.faction) || '');
      if (!loc || !fac) return { kind: 'none' };
      var curOwner = _provOwner(GM, loc);
      if (curOwner == null) return { kind: 'none' };                    // 归属判不出→降级不动
      if (curOwner === fac) return { kind: 'hold' };                    // 本省仍友控→退守本省
      var regions = _mapRegions(); if (!regions) return { kind: 'none' };
      var cur = _regionOf(regions, loc); if (!cur) return { kind: 'none' };
      var byId = {}; regions.forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
      var nb = Array.isArray(cur.neighbors) ? cur.neighbors : [];
      for (var i = 0; i < nb.length; i++) {                             // 邻省顺序确定性(数据序)→首个友控
        var r2 = byId[nb[i]];
        if (r2 && r2.name && _provOwner(GM, r2.name) === fac) return { kind: 'retreat', to: String(r2.name) };
      }
      return { kind: 'surrounded' };
    } catch (e) { return { kind: 'none' }; }
  }
  function _postBattleRetreat(br, GM) {
    try {
      if (!br || !GM || br._retreatDone) return; br._retreatDone = true;   // 防双跑(applyReal 幂等护)
      var loser = String(br.loserFactionId || br.loserFaction || br.loser || ''); if (!loser) return;
      var w = W(), eb = (w && typeof w.addEB === 'function') ? w.addEB : (typeof addEB !== 'undefined' ? addEB : null);
      function note(msg) { try { if (eb) eb('军事', msg); } catch (e) {} }
      (br.affectedArmies || []).forEach(function (aa) {
        var a = aa && findArmy(GM, aa.armyId); if (!a) return;
        if (String(a.faction || '') !== loser || a.disbanded) return;
        var s0 = Math.max(0, Math.round(+(a.soldiers || a.strength || 0) || 0)); if (s0 <= 0) return;
        var t = retreatTarget(GM, a);
        if (t.kind === 'retreat') {
          a.location = a.garrison = t.to;                                // 溃退位移(spec O2·沿邻接退最近友控省)
          note((a.name || '败军') + '兵败·沿路溃退至友控之地 ' + t.to);
        } else if (t.kind === 'surrounded') {
          var mor = +(a.morale || 0);
          if (mor < 30 || s0 < 800) {                                    // 势穷力孤→被围请降(全军瓦解·主将命运以战术为准不覆写)
            a.soldiers = 0; if (a.size != null) a.size = 0; if (a.strength != null) a.strength = 0;
            a.disbanded = true; a.state = 'surrendered';
            note((a.name || '败军') + '败退无路·四面被围·势穷请降（全军瓦解）');
          } else {                                                       // 犹有战力→血战突围·重损(试玩调 25%)
            var loss = Math.round(s0 * 0.25);
            a.soldiers = s0 - loss; if (a.size != null) a.size = a.soldiers; if (a.strength != null) a.strength = a.soldiers;
            a.morale = Math.max(0, Math.min(100, (+(a.morale || 50)) - 12));
            a._unitsStale = true;
            note((a.name || '败军') + '败退无路·被围血战突围·折兵 ' + loss);
          }
        }                                                                // hold/none→不移动(本省友控退守/数据不足降级)
      });
    } catch (e) {}
  }
  function emperorName(GM) {   /* 皇帝角色(朝代中立:role/officialTitle==='皇帝'·不锁单朝) */
    if (!GM || !Array.isArray(GM.chars)) return null;
    for (var i = 0; i < GM.chars.length; i++) { var c = GM.chars[i]; if (c && !c.dead && (c.role === '皇帝' || c.officialTitle === '皇帝')) return c.name || c['姓名'] || null; }
    return null;
  }
  function emperorArmyId(GM, pArmies) {
    /* 御营=御驾亲征者所在军:① 皇帝亲领(commander===皇帝名) ② 标御营/亲军名 ③ 御驾随最大军(兜底) */
    var en = emperorName(GM), i, a;
    if (en) for (i = 0; i < pArmies.length; i++) { a = pArmies[i]; if (a && a.commander === en) return a.id; }
    for (i = 0; i < pArmies.length; i++) { a = pArmies[i]; if (a && (a._imperial || a.isImperial || /御营|亲军|禁卫|羽林|宿卫/.test(a.name || ''))) return a.id; }
    var best = null, bs = -1; for (i = 0; i < pArmies.length; i++) { a = pArmies[i]; var s = a && (a.soldiers || a.strength || 0) || 0; if (s > bs) { bs = s; best = a; } }
    return best && best.id;
  }

  /* 会参其事 / 直陈其要 抉择 + 战前情报 + 方略三档(返 Promise<{choice:'fight'|'delegate', strategy}>) */
  function promptCombatChoice(item, band) {
    return new Promise(function (resolve) {
      var w = W(); if (!w || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') { resolve({ choice: 'delegate', strategy: null }); return; }
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:rgba(8,6,4,.78);display:flex;align-items:center;justify-content:center;';
      var pn = (item.playerArmies[0] && (item.playerArmies[0].location || item.playerArmies[0].garrison)) || '前线';
      var pStr = band ? band.strA : 0, eStr = band ? band.strB : 0, wp = band ? Math.round(band.winProb * 100) : 50;
      var pMen = band ? band.playerSoldiers : sumSoldiers(item.playerArmies), eMen = band ? band.enemySoldiers : sumSoldiers(item.enemyArmies);
      var situ = !band ? '势均' : (band.winProb >= 0.7 ? '我据上风' : band.winProb <= 0.3 ? '敌势占优' : '势在两可');
      var sCol = !band ? '#caa23c' : (band.winProb >= 0.7 ? '#6ea84a' : band.winProb <= 0.3 ? '#c0563a' : '#caa23c');
      var box = document.createElement('div');
      box.style.cssText = 'max-width:472px;background:linear-gradient(#1c140c,#241a10);border:1px solid #8a6a2a;border-radius:8px;padding:22px 26px;color:#ecdcc4;font-family:serif;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.6);';
      box.innerHTML = '<div style="font-size:19px;color:#edc97a;margin-bottom:10px;">⚔ 兵 临 ' + esc(pn) + '</div>'
        + '<div style="display:flex;justify-content:space-between;font-size:12.5px;background:rgba(0,0,0,.25);border-radius:5px;padding:8px 12px;margin-bottom:6px;">'
        + '<span>我军 <b style="color:#d6a04a;">' + pMen + '</b>众 · 战力 ' + pStr + '</span>'
        + '<span>敌军 <b style="color:#7f97ad;">' + eMen + '</b>众 · 战力 ' + eStr + '</span></div>'
        + '<div style="font-size:13px;margin-bottom:13px;">庙算把握 <b style="color:' + sCol + ';">' + wp + '%</b> · 局势 <b style="color:' + sCol + ';">' + situ + '</b></div>'
        + '<div style="font-size:12.5px;opacity:.82;line-height:1.6;margin-bottom:12px;"><b>御驾亲征</b>亲操此战（实时战术）；<b>委之偏裨</b>庙算决之，定方略——<b>主攻</b>更决定性、<b>持重</b>保实力、<b>速决</b>高方差赌速胜。</div>';
      var bf = mkBtn('🐎 御驾亲征 · 会参其事', '#a8342a'); bf.style.width = '100%'; bf.style.marginBottom = '10px';
      var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:7px;justify-content:center;';
      var ba = mkBtn('委之 · 主攻', '#6a4424'), bc = mkBtn('委之 · 持重', '#3f5a3a'), bsw = mkBtn('委之 · 速决', '#4a3a5a');
      [ba, bc, bsw].forEach(function (b) { b.style.flex = '1'; b.style.fontSize = '13px'; b.style.padding = '8px 4px'; });
      row.appendChild(ba); row.appendChild(bc); row.appendChild(bsw);
      box.appendChild(bf); box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
      function done(c, s) { try { ov.remove(); } catch (e) {} resolve({ choice: c, strategy: s }); }
      bf.onclick = function () { done('fight', null); };
      ba.onclick = function () { done('delegate', 'aggressive'); };
      bc.onclick = function () { done('delegate', 'cautious'); };
      bsw.onclick = function () { done('delegate', 'swift'); };
    });
  }
  function sumSoldiers(armies) { var t = 0; (armies || []).forEach(function (a) { if (a) t += Math.max(0, Math.round(a.soldiers || a.strength || 0)); }); return t; }

  /* 委之·方略(§12.5):拨原 abstract battleResult 损失(主攻血/持重省/速决赌)→走原咽喉 */
  var STRAT = { aggressive: { p: 1.12, e: 1.15 }, cautious: { p: 0.85, e: 0.92 } };
  function applyDelegate(item, strategy, GM) {
    var br = item.battleResult;
    if (!strategy || !(br && br.affectedArmies)) { applyReal(br, GM); return; }
    var pIds = {}; item.playerArmies.forEach(function (a) { if (a) pIds[a.id] = true; });
    var swift = (strategy === 'swift'), good = swift && (Math.random() < 0.5);
    var f = STRAT[strategy] || { p: 1, e: 1 };
    var scaled = {}; for (var k in br) if (br.hasOwnProperty(k)) scaled[k] = br[k];
    scaled.affectedArmies = (br.affectedArmies || []).map(function (aa) {
      var isP = !!pIds[aa.armyId], mul = swift ? (isP ? (good ? 0.9 : 1.3) : (good ? 1.4 : 0.8)) : (isP ? f.p : f.e);
      var o = {}; for (var k2 in aa) if (aa.hasOwnProperty(k2)) o[k2] = aa[k2];
      o.loss = Math.max(0, Math.round((aa.loss || 0) * mul)); return o;
    });
    scaled._strategy = strategy;
    scaled.affectedArmies.forEach(function (aa) { var a = findArmy(GM, aa.armyId); if (a) a._battleResultTurn = undefined; });
    applyReal(scaled, GM);
  }
  function mkBtn(t, c) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'font:14px serif;color:#fff;background:' + c + ';border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:9px 14px;cursor:pointer;'; return b; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  /* ── 战后补员双源(§7/§12.4/O7·整编屏交互) ──
   * 丁口征募(免费):走 TM.FieldPipes.capRecruitDelta(现成征兵池·封顶/扣池/同回合共享记账)·报价先按 effCap 夹想募数,避免强征过池扣民心。
   * 花钱募兵(即时):走 TM.AIChange.Army.chargeRecruitment(单一扣费点·银粮/防双扣/武库支取)·报价先按国库夹可负担数,避免欠饷士气挫。
   * 落地:soldiers/size/strength 三标量 += n(composition 由派生视图签名自愈按比例放大重切)·新兵历练15稀释走 diluteVeterancy。 */
  function _pipes() { var w = W(); return (w && w.TM && w.TM.FieldPipes) || null; }
  function _armyChargeApi() { var w = W(); return (w && w.TM && w.TM.AIChange && w.TM.AIChange.Army) || null; }
  function _guokuStock(GM, key) {
    var g = (GM && GM.guoku) || {};
    var led = g.ledgers && g.ledgers[key];
    var v = (led && led.stock != null) ? led.stock : g[key];
    return Math.max(0, Math.round(+v || 0));
  }
  /* 补员报价:gap=缺员数 → {ding:{n}, recruit:{n,silver,grain}}(n=0=该源当下不可用·纯读不落账) */
  function replenishQuote(GM, army, gap) {
    gap = Math.max(0, Math.round(+gap || 0));
    var q = { ding: { n: 0 }, recruit: { n: 0, silver: 0, grain: 0 } };
    if (!army || gap <= 0) return q;
    try {
      var FP = _pipes(), w = W(), P = w && w.P;
      var div = (FP && P) ? FP.findDivisionByName(P, army.garrison || army.location || '') : null;
      var cap = div ? FP.recruitCap(div) : null;
      if (cap != null) {
        var eff = (GM && typeof GM._conscriptEffMult === 'number' && isFinite(GM._conscriptEffMult)) ? Math.max(0.3, Math.min(1.3, GM._conscriptEffMult)) : 1;   // 与 capRecruitDelta 同口径(征兵效率)
        q.ding.n = Math.min(gap, Math.max(0, Math.round(cap * eff)));
      }
    } catch (e) {}
    try {
      var AC = _armyChargeApi();
      var unit = (AC && typeof AC.recruitUnitCost === 'function') ? AC.recruitUnitCost(army, null) : { money: 2, grain: 1 };
      var afford = Math.min(
        unit.money > 0 ? Math.floor(_guokuStock(GM, 'money') / unit.money) : gap,
        unit.grain > 0 ? Math.floor(_guokuStock(GM, 'grain') / unit.grain) : gap
      );
      var n = Math.max(0, Math.min(gap, afford));
      q.recruit = { n: n, silver: Math.round(n * unit.money), grain: Math.round(n * unit.grain) };
    } catch (e) {}
    return q;
  }
  /* 落地一笔补员(source='ding'|'recruit')·返 {added, vet}·永不崩 */
  function applyReplenish(GM, army, want, source) {
    try {
      want = Math.max(0, Math.round(+want || 0));
      if (!army || want <= 0) return { added: 0 };
      var w = W(), AU = w && w.TMArmyUnits;
      var n = 0;
      if (source === 'ding') {
        var FP = _pipes(), P = w && w.P;
        var r = (FP && P) ? FP.capRecruitDelta(GM, P, army.garrison || army.location || '', want) : null;
        n = r ? Math.max(0, Math.round(r.approved || 0)) : 0;
      } else {
        var AC = _armyChargeApi();
        if (!AC || typeof AC.chargeRecruitment !== 'function') return { added: 0 };
        AC.chargeRecruitment(GM, army, want, null, '战后补员', 'battle-replenish');
        n = want;
      }
      if (n <= 0) return { added: 0 };
      var old = Math.max(0, Math.round(+(army.soldiers != null ? army.soldiers : (army.strength != null ? army.strength : army.size)) || 0));
      army.soldiers = army.size = army.strength = old + n;   // 三标量同步(同 tm-ai-change-army 增兵写法)·composition 派生自愈放大
      var vet = null;
      if (AU && typeof AU.diluteVeterancy === 'function') vet = AU.diluteVeterancy(army, old, n);   // 新兵历练15稀释·标 _unitsStale
      try { var eb = (w && w.addEB) || (typeof addEB !== 'undefined' ? addEB : null); if (typeof eb === 'function') eb('军事', (army.name || '某军') + '·战后补员 ' + n + ' 人（' + (source === 'ding' ? '丁口征募' : '花钱募兵') + '）'); } catch (e2) {}
      return { added: n, vet: vet };
    } catch (e) { return { added: 0 }; }
  }

  /* ── O12 旁观(v2·战况重演):他方战事抽象战果照常即时落地(v1 语义不变)·旁观纯视觉——
   * 咽喉透传前快照双方名册(变异前拷贝)→会战阶段末「他方战事」列表→iframe observe 模式重演·战果丢弃。
   * flag GM._yujiaObserve 默认 OFF(独立于亲征 flag)·每回合至多 4 场防弹窗轰炸·不持久化(当回合 flavor)。 */
  var observePending = [];
  function observeOn(GM) { return !!(GM && GM._yujiaObserve); }
  function _isNpcBattle(br, GM) {
    var pf = playerFaction(GM); if (!pf) return true;
    if (br.winnerFactionId === pf || br.loserFactionId === pf) return false;
    var aa = br.affectedArmies || [];
    for (var i = 0; i < aa.length; i++) { var a = findArmy(GM, aa[i].armyId); if (a && a.faction === pf) return false; }
    return true;
  }
  function _cloneArmyForObserve(a) {
    return { id: a.id, name: a.name, faction: a.faction, commander: a.commander,
      morale: a.morale, training: a.training, supply: a.supply, quality: a.quality, veterancy: a.veterancy,
      soldiers: Math.max(0, Math.round(+(a.soldiers || a.strength || 0) || 0)),
      location: a.location, garrison: a.garrison,
      composition: Array.isArray(a.composition) ? JSON.parse(JSON.stringify(a.composition)) : [],
      equipment: Array.isArray(a.equipment) ? a.equipment.slice() : undefined };
  }
  function _snapshotObserve(br, GM) {
    try {
      if (!br || br._fromTactical || !observeOn(GM) || observePending.length >= 4) return;
      if (!_isNpcBattle(br, GM)) return;
      var armies = []; (br.affectedArmies || []).forEach(function (aa) { var a = aa && findArmy(GM, aa.armyId); if (a && !a.disbanded) armies.push(a); });
      if (armies.length < 2) return;
      var facA = String(armies[0].faction || ''); if (!facA) return;
      var A = [], B = [], facB = '';
      armies.forEach(function (a) { if (String(a.faction || '') === facA) A.push(_cloneArmyForObserve(a)); else { if (!facB) facB = String(a.faction || ''); B.push(_cloneArmyForObserve(a)); } });
      if (!A.length || !B.length) return;
      observePending.push({ facA: facA, facB: facB, sideA: A, sideB: B,
        provinceName: (armies[0].location || armies[0].garrison) || '',
        menA: A.reduce(function (s, x) { return s + x.soldiers; }, 0), menB: B.reduce(function (s, x) { return s + x.soldiers; }, 0) });
    } catch (e) {}
  }
  /* 会战阶段末:他方战事列表→逐场 observe 重演(战果丢弃·抽象已落地)·headless/无件→即返 */
  function _offerObserve(GM) {
    return new Promise(function (resolve) {
      var w = W();
      var list = observePending.splice(0);
      if (!w || !list.length || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') { resolve(); return; }
      if (!(w.TMBattleAdapter && w.TMBattleEmbed)) { resolve(); return; }
      function show() {
        var todo = list.filter(function (x) { return !x._watched; });
        if (!todo.length) { resolve(); return; }
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:rgba(8,6,4,.78);display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'max-width:470px;background:linear-gradient(#1c140c,#241a10);border:1px solid #8a6a2a;border-radius:8px;padding:20px 24px;color:#ecdcc4;font-family:serif;box-shadow:0 12px 40px rgba(0,0,0,.6);';
        box.innerHTML = '<div style="font:18px serif;color:#e8c87a;text-align:center;margin-bottom:6px;">👁 他方战事 · 可遣人观之</div>'
          + '<div style="font-size:12px;opacity:.75;text-align:center;margin-bottom:12px;">战局天命自定·观之不改其果（有司战报已录）</div>';
        todo.forEach(function (item) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0;font-size:13.5px;';
          var span = document.createElement('span');
          span.innerHTML = '<b>' + esc(item.facA) + '</b> 战 <b>' + esc(item.facB) + '</b> · ' + esc(item.provinceName || '不知何地') + ' · ' + item.menA + ' 对 ' + item.menB;
          var b = mkBtn('旁观', '#3f5a3a'); b.style.fontSize = '12.5px'; b.style.padding = '6px 12px';
          b.onclick = function () {
            item._watched = true; try { ov.remove(); } catch (e) {}
            Promise.resolve().then(function () {
              var cfg = w.TMBattleAdapter.buildBattleConfig(item.sideA, item.sideB, { GM: GM, playerFactionName: item.facA, enemyFactionName: item.facB, provinceName: item.provinceName });
              cfg.observe = true;                                        // 原型封指挥(ctrlSel空)·纯观战
              return w.TMBattleEmbed.launch(cfg);
            }).catch(function () {}).then(function () { show(); });      // 战果丢弃·回列表续观
          };
          row.appendChild(span); row.appendChild(b); box.appendChild(row);
        });
        var done = mkBtn('散朝 · 不复观', '#6a4424'); done.style.width = '100%'; done.style.marginTop = '12px';
        done.onclick = function () { try { ov.remove(); } catch (e) {} resolve(); };
        box.appendChild(done); ov.appendChild(box); document.body.appendChild(ov);
      }
      show();
    });
  }

  /* 收一场战的玩家军战报(整编归伍):战损=战前快照-现兵·历练=effectiveVet·主将命运取该战 commanderFate(挂首军)·armyId 供补员交互 */
  function _collectReport(reports, item, preS, GM) {
    try {
      var w = W(), AU = w && w.TMArmyUnits;
      var fate = item && item.battleResult && item.battleResult.commanderFate;
      var first = true;
      (item && item.playerArmies || []).forEach(function (a) {
        if (!a) return;
        var pre = (preS && preS[a.id]) || 0;
        var now = Math.max(0, +(a.soldiers || a.strength || 0) || 0);
        var vet = (AU && AU.effectiveVet) ? Math.round(AU.effectiveVet(a)) : Math.round(a.veterancy || 0);
        reports.push({ armyId: a.id, name: a.name || '某军', loss: Math.max(0, pre - now), soldiers: now, vet: vet, destroyed: now <= 0, fate: first ? (fate || null) : null });
        first = false;
      });
    } catch (e) {}
  }
  /* 会战阶段收尾:弹战报小结(整编归伍·含补员双源交互)·无 DOM(headless)→resolve 跳过·无战报→跳过 */
  function showBattleReport(reports, GM) {
    return new Promise(function (resolve) {
      var w = W();
      if (!w || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function' || !reports || !reports.length) { resolve(); return; }
      var FATE_CN = { survived: '全身而退', safe: '全身而退', wounded: '负伤', captured: '被俘', killed: '阵殁', routed: '溃走', fled: '溃走' };
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:rgba(8,6,4,.78);display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'max-width:490px;max-height:80vh;overflow:auto;background:linear-gradient(#1c140c,#241a10);border:1px solid #8a6a2a;border-radius:8px;padding:22px 26px;color:#ecdcc4;font-family:serif;box-shadow:0 12px 40px rgba(0,0,0,.6);';
      box.innerHTML = '<div style="font:18px serif;color:#e8c87a;text-align:center;margin-bottom:14px;border-bottom:1px solid #5a4420;padding-bottom:10px;">⚔ 会战战报 · 整编归伍</div>';
      function rowBody(r) {
        return r.destroyed ? '<span style="color:#c0563a;">全军覆没</span>'
          : ('损 <b style="color:#d8956a;">' + r.loss + '</b> 人 · 余 ' + r.soldiers + ' · 历练 <b style="color:#7fb46a;">' + r.vet + '</b>');
      }
      reports.forEach(function (r) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:7px 0;font-size:14px;line-height:1.5;';
        var html = '<b>' + esc(r.name) + '</b>：<span data-rb>' + rowBody(r) + '</span>';
        if (r.fate && r.fate.name) { html += '<br><span style="opacity:.8;font-size:13px;">　主将 ' + esc(r.fate.name) + '：' + esc(FATE_CN[r.fate.outcome] || r.fate.outcome || '') + '</span>'; }
        row.innerHTML = html;
        box.appendChild(row);
        if (!r.destroyed && r.loss > 0 && r.armyId != null && GM) _attachReplenish(row, r, GM);
      });
      var b = mkBtn('整编归伍 · 继续', '#6a4424'); b.style.width = '100%'; b.style.marginTop = '14px';
      b.onclick = function () { try { ov.remove(); } catch (e) {} resolve(); };
      box.appendChild(b); ov.appendChild(box); document.body.appendChild(ov);
    });
  }
  /* 战报行下挂补员交互条(丁口免费/募兵花钱·两键各自报价·点击落地并刷新·缺口清零即收) */
  function _attachReplenish(row, r, GM) {
    try {
      var w = W(), AU = w && w.TMArmyUnits;
      var army = findArmy(GM, r.armyId); if (!army) return;
      var left = r.loss;                                    // 剩余缺口=本战战损(§12.4 补员对账本战减员)
      var bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0 2px;';
      var bd = mkBtn('', '#3f5a3a'), bm = mkBtn('', '#6a4424');
      [bd, bm].forEach(function (btn) { btn.style.fontSize = '12px'; btn.style.padding = '5px 9px'; });
      var info = document.createElement('span'); info.style.cssText = 'font-size:12px;opacity:.82;';
      function refresh() {
        var q = replenishQuote(GM, army, left);
        bd.textContent = '丁口补员 +' + q.ding.n + '（免费）';
        bm.textContent = '募兵补员 +' + q.recruit.n + '（银' + q.recruit.silver + (q.recruit.grain ? '·粮' + q.recruit.grain : '') + '）';
        bd.disabled = q.ding.n <= 0; bm.disabled = q.recruit.n <= 0;
        bd.style.opacity = bd.disabled ? '.45' : '1'; bm.style.opacity = bm.disabled ? '.45' : '1';
        info.textContent = left > 0 ? '缺员 ' + left : '已补齐 ✓';
        if (left <= 0) { bd.style.display = 'none'; bm.style.display = 'none'; }
        var rb = row.querySelector('[data-rb]');
        if (rb) {
          var now = Math.max(0, Math.round(+(army.soldiers || army.strength || 0) || 0));
          var vet = (AU && AU.effectiveVet) ? Math.round(AU.effectiveVet(army)) : Math.round(army.veterancy || 0);
          rb.innerHTML = '损 <b style="color:#d8956a;">' + r.loss + '</b> 人 · 余 ' + now + ' · 历练 <b style="color:#7fb46a;">' + vet + '</b>';
        }
      }
      function doFill(src) {
        var q = replenishQuote(GM, army, left);
        var want = src === 'ding' ? q.ding.n : q.recruit.n;
        var res = applyReplenish(GM, army, want, src);
        left = Math.max(0, left - ((res && res.added) || 0));
        refresh();
      }
      bd.onclick = function () { doFill('ding'); };
      bm.onclick = function () { doFill('recruit'); };
      refresh();
      bar.appendChild(bd); bar.appendChild(bm); bar.appendChild(info);
      row.appendChild(bar);
    } catch (e) {}
  }

  /* 会战阶段:逐场处理延后队列(管线 step 调·flag 关时 pending 恒空=no-op) */
  function runPending(GM) {
    GM = GM || (W() && W().GM);
    if (!pending.length) { recoverPending(GM); return _offerObserve(GM); }   // 无新战仍排空持久化残留→抽象兜底·再offer他方战事旁观(O12)
    var queue = pending.splice(0);
    var w = W();
    var reports = [];   // 会战战报小结(整编归伍·informational)累计
    var _learn = (w && w.TMArmyUnits && typeof w.TMArmyUnits.learnUnknownTypes === 'function')
      ? Promise.resolve().then(function () { return w.TMArmyUnits.learnUnknownTypes(GM); }).catch(function () {})   // ★第4层:会战前补学生僻兵种(次级LLM记忆化·flag-gated·无key/无生僻则no-op)→兵牌tacClass精确
      : Promise.resolve();
    return queue.reduce(function (chain, item) {
      return chain.then(function () {
        var preS = {}; (item.playerArmies || []).forEach(function (a) { if (a) preS[a.id] = Math.max(0, +(a.soldiers || a.strength || 0) || 0); });   // 战前兵力快照→算战损
        return Promise.resolve().then(function () {
          var pf = playerFaction(GM), ef = (item.enemyArmies[0] && item.enemyArmies[0].faction) || '敌军';
          var band = (w.TMBattleResolve) ? w.TMBattleResolve.predictBattleBand(item.playerArmies, item.enemyArmies, { GM: GM }) : null;
          /* O11 出兵预勾:领军(御驾所在/首军)军卡「若接战」三态——always→免临场请旨径入战术·delegate→径庙算·未设→临场 modal */
          var _lead = findArmy(GM, emperorArmyId(GM, item.playerArmies)) || item.playerArmies[0];
          var _stance = _lead && _lead._battleStance;
          var _pick = _stance === 'always' ? Promise.resolve({ choice: 'fight', strategy: null })
            : _stance === 'delegate' ? Promise.resolve({ choice: 'delegate', strategy: null })
            : promptCombatChoice(item, band);
          return _pick.then(function (pick) {
            var choice = (pick && pick.choice) || 'delegate', strategy = pick && pick.strategy;
            if (choice !== 'fight' || !w.TMBattleAdapter || !w.TMBattleEmbed || !w.TMBattleResolve) {
              applyDelegate(item, strategy, GM); return;                 // 委之(方略拨原结果)/件缺→落地
            }
            var cfg = w.TMBattleAdapter.buildBattleConfig(item.playerArmies, item.enemyArmies, {
              provinceName: item.provinceName, playerFactionName: pf, enemyFactionName: ef, GM: GM,
              emperorArmyId: emperorArmyId(GM, item.playerArmies)
            });
            return w.TMBattleEmbed.launch(cfg).then(function (tac) {
              if (!tac) { applyDelegate(item, null, GM); return; }        // 放弃→委之(原结果)
              var br = w.TMBattleResolve.tacticalToBattleResult(tac, {
                playerArmies: item.playerArmies, enemyArmies: item.enemyArmies, band: band,
                playerFactionName: pf, enemyFactionName: ef,
                abstractBr: item.battleResult              // 抽象原产战果→战略字段透传(占城翻省/战后效应·胜负一致才承接·翻盘剥除)
              });
              (br.affectedArmies || []).forEach(function (aa) { var a = findArmy(GM, aa.armyId); if (a) a._battleResultTurn = undefined; });   // 清防双扣标→强制应用战术战果
              applyReal(br, GM);
            });
          });
        }).catch(function (e) {
          try { applyDelegate(item, null, GM); } catch (_) {}            // ★单场出错→抽象兜底落地·该战绝不丢
        }).then(function () { dropPersisted(GM, item.battleResult); _collectReport(reports, item, preS, GM); });  // 结算完→撤持久化镜像 + 收战报
      });
    }, _learn).then(function () { return showBattleReport(reports, GM); }).then(function () { return _offerObserve(GM); }).then(function () { recoverPending(GM); });     // ★seed=_learn(会战前补学生僻兵种) + 战报小结(整编归伍·补员交互) + 他方战事旁观(O12) + 末了排空残留→抽象兜底
  }

  /* 包裹单一咽喉 MilitarySystems.applyBattleResult(bulletproof·幂等) */
  function installHook() {
    var w = W(), MS = w && w.MilitarySystems;
    if (!MS || typeof MS.applyBattleResult !== 'function' || MS._battleHookInstalled) return false;
    var orig = MS.applyBattleResult;
    MS._origApplyBattleResult = orig;
    MS.applyBattleResult = function (br, root) {
      try {
        var GM = root || (W() && W().GM) || null;
        if (maybeDefer(br, GM)) return undefined;                   // 涉玩家+开启→延后·跳过立即抽象结算
        _snapshotObserve(br, GM);                                   // O12:纯NPC战·旁观开启→变异前快照名册(抽象照常落地·会战阶段可重演)
      } catch (e) { /* 拦截出错→退回原咽喉·绝不弄坏战斗 */ }
      var _r = orig.call(this, br, root);
      _spoils(br, root || (W() && W().GM));                         // 透传战(flag关/非玩家)→战果应用后缴获
      return _r;
    };
    MS._battleHookInstalled = true;
    return true;
  }

  var API = {
    runPending: runPending, installHook: installHook, maybeDefer: maybeDefer, applyDelegate: applyDelegate,
    recoverPending: recoverPending, emperorArmyId: emperorArmyId, emperorName: emperorName,
    replenishQuote: replenishQuote, applyReplenish: applyReplenish,
    retreatTarget: retreatTarget, _postBattleRetreat: _postBattleRetreat,
    _snapshotObserve: _snapshotObserve, _observePending: function () { return observePending; }, _clearObserve: function () { observePending.length = 0; },
    involvesPlayer: involvesPlayer, _gainPostBattleVeterancy: _gainPostBattleVeterancy, _collectReport: _collectReport, _pending: function () { return pending; }, _clear: function () { pending.length = 0; }
  };
  /* 设置面板「御驾亲征·战术战斗」开关处理器(tm-patches.js 设置渲染调·切 GM._yujiaQinzheng·本局存档生效) */
  function setYujiaQinzheng(on, btn) {
    on = !!on;
    try { var w = W(); if (w && w.GM) w.GM._yujiaQinzheng = on; } catch (e) {}
    try { if (btn && btn.parentNode) { var bs = btn.parentNode.querySelectorAll('button[data-yjqz]'); for (var i = 0; i < bs.length; i++) { var want = bs[i].getAttribute('data-yjqz') === '1'; bs[i].className = 'bt ' + (want === on ? 'bp' : 'bs') + ' bsm'; } } } catch (e) {}
    try { var w2 = W(); if (w2 && typeof w2.toast === 'function') w2.toast(on ? '御驾亲征已开启 · 直辖军接敌可亲操此战' : '御驾亲征已关闭 · 一律庙算决之'); } catch (e) {}
  }
  /* 「他方战事旁观」开关处理器(O12·切 GM._yujiaObserve·战况重演不改战果) */
  function setYujiaObserve(on, btn) {
    on = !!on;
    try { var w = W(); if (w && w.GM) w.GM._yujiaObserve = on; } catch (e) {}
    try { if (btn && btn.parentNode) { var bs = btn.parentNode.querySelectorAll('button[data-yjob]'); for (var i = 0; i < bs.length; i++) { var want = bs[i].getAttribute('data-yjob') === '1'; bs[i].className = 'bt ' + (want === on ? 'bp' : 'bs') + ' bsm'; } } } catch (e) {}
    try { var w2 = W(); if (w2 && typeof w2.toast === 'function') w2.toast(on ? '他方战事旁观已开启 · 回合末可遣人观之' : '他方战事旁观已关闭'); } catch (e) {}
  }

  if (typeof window !== 'undefined') { window.TMBattleTurn = API; window._tmSetYujiaQinzheng = setYujiaQinzheng; window._tmSetYujiaObserve = setYujiaObserve; try { installHook(); } catch (e) {} if (document && document.addEventListener) document.addEventListener('DOMContentLoaded', function () { try { installHook(); } catch (e) {} }); }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
