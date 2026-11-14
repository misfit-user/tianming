/* ============================================================
 * tm-region-status.js — 地块状态系统（2026-06-12）
 *
 * 「状态」= 落在一块地上的持续性境况：奇观(wonder)/灾异(disaster)/圣裁(player·玩家操作)/
 * 风云(event·特殊事件)/营造(building·建筑之利)。每条状态：
 *   { id, kind, name, desc, econPct, minxinPerTurn, startTurn, expiresTurn|null(永续), source }
 *
 * 三面齐备（编辑器=宪法/游戏=演绎/AI=感知 铁律）：
 *   引擎面：econMult(div)=Π(1+econPct) 夹 [0.5,1.6] → cascade computeTaxAmount 乘子（状态→经济闭环）；
 *           tick 每回合：过期清除 + minxinPerTurn 摊民心叶（合计夹 ±2/回合）+ 繁荣度缓变
 *           （Δ=f(民心,状态乘子,战乱) 夹 [-2,+1]·地板 5 顶 95——economyBase 之外的「治势」活账）。
 *   写渠道：AI region_status_changes 通道（apply 硬闸：econPct 夹 ±25%·民心 ±2·工期 ≤24 回合·每地 ≤12 条）；
 *           建筑工役（完工投「工成之利」流量小加成·失修撤·拆毁撤）；玩家诏书后果由 AI 经同通道落状态。
 *   认知面：方志「状态」卷逐卡列效（kind 印·效果徽签·余 N 回合/永续·来源）+ _fieldLedger 近账。
 *
 * 铁律：乘子收口在 cascade 读取点（不直改聚合值）；零状态 = 乘子 1 = 行为不变。
 * ============================================================ */
(function () {
  'use strict';

  var KIND_CN = { wonder: '奇观', disaster: '灾异', player: '圣裁', event: '风云', building: '营造' };
  var MAX_PER_DIV = 12;

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function round2(n) { return Math.round(num(n) * 100) / 100; }
  function round4(n) { return Math.round(num(n) * 10000) / 10000; } // 比例账 4 位精度（0.5% 档不被抹平）

  function list(div) {
    return (div && Array.isArray(div.statusEffects)) ? div.statusEffects : [];
  }

  // 规整一条状态（apply 硬闸：白名单字段+幅度封顶——AI/玩家/建筑通道共用）
  function normalize(raw, GM) {
    if (!raw || typeof raw !== 'object') return null;
    var name = String(raw.name || '').trim();
    if (!name) return null;
    var kind = KIND_CN[raw.kind] ? raw.kind : 'event';
    var econPct = clamp(num(raw.econPct, 0), -0.25, 0.25);
    var minxinPerTurn = clamp(num(raw.minxinPerTurn, 0), -2, 2);
    if (!econPct && !minxinPerTurn && !raw.desc) return null; // 全空效果且无叙述 = 不立账
    var turn = (GM && num(GM.turn, 0)) || 0;
    var dur = num(raw.durationTurns, NaN);
    return {
      id: raw.id || ('zt_' + turn + '_' + name.replace(/\s/g, '').slice(0, 8) + '_' + Math.floor(Math.abs(econPct * 10000) + Math.abs(minxinPerTurn * 100))),
      kind: kind,
      name: name.slice(0, 24),
      desc: String(raw.desc || '').slice(0, 120),
      econPct: round4(econPct),
      minxinPerTurn: round2(minxinPerTurn),
      startTurn: turn,
      expiresTurn: isFinite(dur) && dur > 0 ? turn + Math.min(24, Math.round(dur)) : null,
      source: String(raw.source || '').slice(0, 30)
    };
  }

  function add(div, raw, GM) {
    if (!div) return null;
    var fx = normalize(raw, GM);
    if (!fx) return null;
    if (!Array.isArray(div.statusEffects)) div.statusEffects = [];
    // 同源同名替换（建筑修缮复用/事件刷新不重复立账）
    div.statusEffects = div.statusEffects.filter(function (e) {
      return !(e && e.name === fx.name && (e.source || '') === (fx.source || ''));
    });
    div.statusEffects.push(fx);
    while (div.statusEffects.length > MAX_PER_DIV) div.statusEffects.shift();
    ledger(div, fx.econPct >= 0 ? 1 : -1, '状态「' + fx.name + '」立', GM);
    return fx;
  }

  function remove(div, idOrName, source, GM) {
    if (!div || !Array.isArray(div.statusEffects)) return false;
    var before = div.statusEffects.length;
    div.statusEffects = div.statusEffects.filter(function (e) {
      if (!e) return false;
      var hit = e.id === idOrName || e.name === idOrName;
      if (hit && source !== undefined && source !== null && String(e.source || '') !== String(source)) hit = false;
      return !hit;
    });
    var removed = div.statusEffects.length < before;
    if (removed) ledger(div, 0, '状态「' + String(idOrName).slice(0, 16) + '」除', GM);
    return removed;
  }

  function ledger(div, delta, why, GM) {
    try {
      var FP = (typeof TM !== 'undefined' && TM.FieldPipes) || (typeof window !== 'undefined' && window.TM && window.TM.FieldPipes);
      if (FP && typeof FP.ledgerPush === 'function') FP.ledgerPush(div, 'status', delta, why, GM);
    } catch (_) {}
  }

  // 地方经济乘子：cascade computeTaxAmount 的读取点。零状态 = 1（行为不变）。
  function econMult(div) {
    var fx = list(div);
    if (!fx.length) return 1;
    var m = 1;
    for (var i = 0; i < fx.length; i += 1) {
      if (fx[i] && isFinite(Number(fx[i].econPct))) m *= (1 + clamp(Number(fx[i].econPct), -0.25, 0.25));
    }
    return round4(clamp(m, 0.5, 1.6));
  }

  // 每回合确定性步（endturn-core·BuildingWorks.tick 之后·final aggregate 之前）：
  // ①过期状态清除 ②minxinPerTurn 摊民心叶（合计夹 ±2）③繁荣度缓变（有 prosperity 字段才动）
  // 扫两份区划、同一州只结一次（11-14 改，同志定「乙」）：游戏里那份 GM.adminHierarchy——开局、读档都是剧本库那份的深拷贝
  //   （tm-patches-start.js、tm-save-lifecycle.js），游戏里挂的状态都在这份上——与剧本库那份 P.adminHierarchy。
  //   原先只扫剧本库那份：游戏里挂的状态从不过期（「民变扰攘」「流寇劫掠」挂上就一直压征收）、状态的民心从不落、繁荣从不漂。
  //   营建 tick 07-03 修过同一毛病（tm-building-works.js：两份都扫、按对象去重），这里照办。
  function tick(GM, P) {
    var stat = { expired: 0, minxinTouched: 0, prosperityDrift: 0, activeTotal: 0 };
    if (!GM) return stat;
    var turn = num(GM.turn, 0);
    var trees = [], seen = typeof Set !== 'undefined' ? new Set() : null;
    [GM.adminHierarchy, P && P.adminHierarchy].forEach(function (AH, i) {
      if (!AH || typeof AH !== 'object' || (i === 1 && AH === GM.adminHierarchy)) return;
      Object.keys(AH).forEach(function (fk) { trees.push(AH[fk]); });
    });
    trees.forEach(function (fh) {
      if (!fh || !fh.divisions) return;
      (function walk(ds) {
        ds.forEach(function (div) {
          if (!div) return;
          if (seen) { if (seen.has(div)) return; seen.add(div); }
          var kids = div.children || div.divisions;
          if (Array.isArray(div.statusEffects) && div.statusEffects.length) {
            // ① 过期
            var keep = div.statusEffects.filter(function (e) {
              if (!e) return false;
              if (e.expiresTurn != null && turn >= e.expiresTurn) {
                stat.expired += 1;
                ledger(div, 0, '状态「' + e.name + '」终（期满）', GM);
                return false;
              }
              return true;
            });
            div.statusEffects = keep;
            stat.activeTotal += keep.length;
            // ② 民心摊叶（状态合计·夹 ±2/回合·地板 20 顶 100）
            //   地板、顶只拦往那一头走：本就低于 20 的州，负的状态不再把它抬回 20（天启陕西各州民心十一，
            //   一条「民变扰攘」−0.4 会把它一下抬到 20）；本就高于 100 的同理不往下拽。
            var mxSum = 0;
            keep.forEach(function (e) { mxSum += num(e.minxinPerTurn, 0); });
            mxSum = clamp(mxSum, -2, 2);
            if (mxSum && (div.minxin !== undefined || div.minxinLocal !== undefined)) {
              var cur = num(div.minxin, num(div.minxinLocal, 60));
              var next = round2(mxSum < 0 ? Math.max(cur + mxSum, Math.min(cur, 20)) : Math.min(cur + mxSum, Math.max(cur, 100)));
              if (next !== cur) {
                if (div.minxin !== undefined) div.minxin = next;
                if (div.minxinLocal !== undefined) div.minxinLocal = next;
                stat.minxinTouched += 1;
                try {
                  var FP = (typeof TM !== 'undefined' && TM.FieldPipes) || null;
                  if (FP) FP.ledgerPush(div, 'minxin', next - cur, '地方状态所致', GM);
                } catch (_) {}
              }
            }
          }
          // ③ 繁荣度缓变（仅当字段已存在——不凭空造字段；taxBase('prosperity') 读它=经济联动闭环）
          var isLeaf = !(kids && kids.length);
          if (isLeaf && isFinite(num(div.prosperity, NaN))) {
            var mx = num(div.minxin, num(div.minxinLocal, NaN));
            var drift = 0;
            if (isFinite(mx)) drift += (mx - 55) * 0.02;
            drift += (econMult(div) - 1) * 4;
            if (div._warZone) drift -= 1;
            if (div._revoltActive) drift -= 1.5;
            drift = clamp(drift, -2, 1);
            if (Math.abs(drift) >= 0.05) {
              var pNext = round2(clamp(num(div.prosperity) + drift, 5, 95));
              if (pNext !== num(div.prosperity)) {
                try {
                  var FP2 = (typeof TM !== 'undefined' && TM.FieldPipes) || null;
                  if (FP2) FP2.ledgerPush(div, 'prosperity', round2(pNext - num(div.prosperity)), '治势缓变（民心/状态/兵燹）', GM);
                } catch (_) {}
                div.prosperity = pNext;
                stat.prosperityDrift += 1;
              }
            }
          }
          if (kids && kids.length) walk(kids);
        });
      })(fh.divisions);
    });
    return stat;
  }

  var api = {
    KIND_CN: KIND_CN,
    list: list,
    normalize: normalize,
    add: add,
    remove: remove,
    econMult: econMult,
    tick: tick
  };

  if (typeof window !== 'undefined') {
    window.TM = window.TM || {};
    window.TM.RegionStatus = api;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.TM = globalThis.TM || {};
    globalThis.TM.RegionStatus = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
