// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-office-fallback.js
 * 官制占位·久悬补缺兜底(跨朝代通用)
 *
 * 背景:剧本编辑器给官制留 generated:false 占位(官多人少),运行时靠 AI 的 office_spawn
 *   实体化。但 office_spawn 全凭 AI"推演恰好涉及"才触发、无兜底——冷门官职可能长期空着,
 *   叙事里形同虚设。本兜底为确定性步:挂太久的纯空占位,引擎主动铨选一名虚拟官员补上。
 *
 * ★ 跨朝代通用:官位久悬则铨选补缺,乃中国古代通制;姓名库用通用姓氏/古意名字,不含朝代专名。
 * flag: P.conf.useOfficeFallback(默认 on,显式 false 关)。
 * 节制:前 12 回合不补(给 AI office_spawn 机会),之后每 6 回合补一批、每批至多 2 人(防造人爆发)。
 *
 * 接入: tm-endturn-core.js 确定性 tick 链(Renli.tick 之后)调 TM.OfficeFallback.tick(GM, P)。
 */
(function () {
  'use strict';
  function _num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function _enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return true; // 默认 on
    return P.conf.useOfficeFallback !== false;
  }

  var _SUR = '王李张刘陈杨赵黄周吴徐孙朱马胡郭林何高罗郑梁谢宋唐韩冯董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶'.split('');
  var _GIV = '之守正温良谦敏达远弘毅方直勉勋彦伯仲元亨贞仁义礼智信忠孝廉节文武英华昌隆景明昭晟旭'.split('');

  function _genName() {
    var find = (typeof findCharByName === 'function') ? findCharByName : function () { return null; };
    for (var t = 0; t < 24; t++) {
      var s = _SUR[Math.floor(Math.random() * _SUR.length)];
      var g1 = _GIV[Math.floor(Math.random() * _GIV.length)];
      var nm = (Math.random() < 0.6) ? (s + g1 + _GIV[Math.floor(Math.random() * _GIV.length)]) : (s + g1);
      if (!find(nm)) return nm;
    }
    return null;
  }

  // 久悬补缺·确定性步。扫 officeTree,把挂太久的纯空占位(generated:false·无 name·非匿名填充)
  // 主动铨选一名虚拟官员实体化(复用 office_spawn 同套:slot 实体化 + GM.chars 造人)。
  function tick(GM, P) {
    if (!_enabled()) return;
    if (!GM || !Array.isArray(GM.officeTree)) return;
    var turn = _num(GM.turn, 0);
    if (turn < 12) return;       // 前 12 回合让 AI office_spawn 先来
    if (turn % 6 !== 0) return;  // 每半年补一批
    var FILL = 2, filled = 0;
    (function walk(ns) {
      if (filled >= FILL || !Array.isArray(ns)) return;
      ns.forEach(function (n) {
        if (!n || filled >= FILL) return;
        if (Array.isArray(n.positions)) {
          n.positions.forEach(function (pos) {
            if (filled >= FILL || !pos || !Array.isArray(pos.actualHolders)) return;
            var slot = pos.actualHolders.find(function (h) { return h && h.generated === false && !h.name && !h.filledTurn; });
            if (!slot) return;
            var nm = _genName();
            if (!nm) return;
            // 实体化占位
            slot.name = nm; slot.generated = true; slot.spawnedTurn = turn; slot._fallback = true;
            if (!pos.holder) pos.holder = nm;
            else { if (!Array.isArray(pos.additionalHolders)) pos.additionalHolders = []; if (pos.additionalHolders.indexOf(nm) < 0) pos.additionalHolders.push(nm); }
            var tot = pos.actualHolders.length;
            if (pos.actualCount == null || pos.actualCount < tot) pos.actualCount = tot;
            // 造角色(默认属性·略低于均值的庸常之吏)
            if (!Array.isArray(GM.chars)) GM.chars = [];
            (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })({
              name: nm, title: (n.name || '') + pos.name, officialTitle: pos.name, age: 38, gender: 'male',
              faction: (P && P.playerInfo && P.playerInfo.factionName) || '', stance: '中立', loyalty: 50,
              intelligence: 48, administration: 52, military: 40, valor: 40, charisma: 48, diplomacy: 50, benevolence: 50,
              personality: '', alive: true,
              _spawnedFromOffice: { dept: n.name, position: pos.name, turn: turn, reason: '久悬补缺', fallback: true }
            });
            filled++;
            if (typeof addEB === 'function') { try { addEB('官制', '【铨选补缺】' + nm + '就任' + (n.name || '') + pos.name + '(久悬无主)'); } catch (_) {} }
          });
        }
        if (n.subs) walk(n.subs);
      });
    })(GM.officeTree);
  }

  if (typeof window !== 'undefined') { window.TM = window.TM || {}; window.TM.OfficeFallback = { tick: tick }; }
  if (typeof globalThis !== 'undefined') { globalThis.TM = globalThis.TM || {}; globalThis.TM.OfficeFallback = { tick: tick }; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { tick: tick }; }
})();
