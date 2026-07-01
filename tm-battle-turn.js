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

  /* 收一场战的玩家军战报(整编归伍·informational):战损=战前快照-现兵·历练=effectiveVet·主将命运取该战 commanderFate(挂首军) */
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
        reports.push({ name: a.name || '某军', loss: Math.max(0, pre - now), soldiers: now, vet: vet, destroyed: now <= 0, fate: first ? (fate || null) : null });
        first = false;
      });
    } catch (e) {}
  }
  /* 会战阶段收尾:弹战报小结(整编归伍)·无 DOM(headless)→resolve 跳过·无战报→跳过 */
  function showBattleReport(reports) {
    return new Promise(function (resolve) {
      var w = W();
      if (!w || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function' || !reports || !reports.length) { resolve(); return; }
      var FATE_CN = { survived: '全身而退', safe: '全身而退', wounded: '负伤', captured: '被俘', killed: '阵殁', routed: '溃走', fled: '溃走' };
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:rgba(8,6,4,.78);display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'max-width:460px;max-height:80vh;overflow:auto;background:linear-gradient(#1c140c,#241a10);border:1px solid #8a6a2a;border-radius:8px;padding:22px 26px;color:#ecdcc4;font-family:serif;box-shadow:0 12px 40px rgba(0,0,0,.6);';
      var html = '<div style="font:18px serif;color:#e8c87a;text-align:center;margin-bottom:14px;border-bottom:1px solid #5a4420;padding-bottom:10px;">⚔ 会战战报 · 整编归伍</div>';
      reports.forEach(function (r) {
        var body = r.destroyed ? '<span style="color:#c0563a;">全军覆没</span>'
          : ('损 <b style="color:#d8956a;">' + r.loss + '</b> 人 · 余 ' + r.soldiers + ' · 历练 <b style="color:#7fb46a;">' + r.vet + '</b>');
        html += '<div style="margin:7px 0;font-size:14px;line-height:1.5;"><b>' + esc(r.name) + '</b>：' + body;
        if (r.fate && r.fate.name) { html += '<br><span style="opacity:.8;font-size:13px;">　主将 ' + esc(r.fate.name) + '：' + esc(FATE_CN[r.fate.outcome] || r.fate.outcome || '') + '</span>'; }
        html += '</div>';
      });
      box.innerHTML = html;
      var b = mkBtn('整编归伍 · 继续', '#6a4424'); b.style.width = '100%'; b.style.marginTop = '14px';
      b.onclick = function () { try { ov.remove(); } catch (e) {} resolve(); };
      box.appendChild(b); ov.appendChild(box); document.body.appendChild(ov);
    });
  }

  /* 会战阶段:逐场处理延后队列(管线 step 调·flag 关时 pending 恒空=no-op) */
  function runPending(GM) {
    GM = GM || (W() && W().GM);
    if (!pending.length) { recoverPending(GM); return Promise.resolve(); }   // 无新战仍排空持久化残留(上回合中断+存档遗留)→抽象兜底
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
          return promptCombatChoice(item, band).then(function (pick) {
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
                playerFactionName: pf, enemyFactionName: ef
              });
              (br.affectedArmies || []).forEach(function (aa) { var a = findArmy(GM, aa.armyId); if (a) a._battleResultTurn = undefined; });   // 清防双扣标→强制应用战术战果
              applyReal(br, GM);
            });
          });
        }).catch(function (e) {
          try { applyDelegate(item, null, GM); } catch (_) {}            // ★单场出错→抽象兜底落地·该战绝不丢
        }).then(function () { dropPersisted(GM, item.battleResult); _collectReport(reports, item, preS, GM); });  // 结算完→撤持久化镜像 + 收战报
      });
    }, _learn).then(function () { return showBattleReport(reports); }).then(function () { recoverPending(GM); });     // ★seed=_learn(会战前补学生僻兵种·完成后逐场打) + 战报小结(整编归伍) + 末了排空残留→抽象兜底
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
    involvesPlayer: involvesPlayer, _gainPostBattleVeterancy: _gainPostBattleVeterancy, _collectReport: _collectReport, _pending: function () { return pending; }, _clear: function () { pending.length = 0; }
  };
  /* 设置面板「御驾亲征·战术战斗」开关处理器(tm-patches.js 设置渲染调·切 GM._yujiaQinzheng·本局存档生效) */
  function setYujiaQinzheng(on, btn) {
    on = !!on;
    try { var w = W(); if (w && w.GM) w.GM._yujiaQinzheng = on; } catch (e) {}
    try { if (btn && btn.parentNode) { var bs = btn.parentNode.querySelectorAll('button[data-yjqz]'); for (var i = 0; i < bs.length; i++) { var want = bs[i].getAttribute('data-yjqz') === '1'; bs[i].className = 'bt ' + (want === on ? 'bp' : 'bs') + ' bsm'; } } } catch (e) {}
    try { var w2 = W(); if (w2 && typeof w2.toast === 'function') w2.toast(on ? '御驾亲征已开启 · 直辖军接敌可亲操此战' : '御驾亲征已关闭 · 一律庙算决之'); } catch (e) {}
  }

  if (typeof window !== 'undefined') { window.TMBattleTurn = API; window._tmSetYujiaQinzheng = setYujiaQinzheng; try { installHook(); } catch (e) {} if (document && document.addEventListener) document.addEventListener('DOMContentLoaded', function () { try { installHook(); } catch (e) {} }); }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
