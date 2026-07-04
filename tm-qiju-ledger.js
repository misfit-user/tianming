// @ts-check
/*
 * tm-qiju-ledger.js — 起居注单一写口（2026-07-04 gm:qijuHistory 收口）
 *
 * 此前 25 个文件 69 处直写 GM.qijuHistory：形状高度统一但——
 *   - cap 三处散装互搏（phase8-drafts 240 / in-turn-driver 200 / news-bridge 200·其余 22 写手裸写）
 *   - hongyan-office 有一处 push 破坏 newest-first 序（注释写着「即时可见」·push 恰恰塞到最不可见的末尾）
 *   - turn/date 兜底逻辑逐处复制
 * 收口后：唯一入口·永远 unshift(newest-first)·cap 归一·turn/date 自动兜底·扩展字段透传。
 *
 * API：
 *   TM.Qiju.record(content, opts)   便捷形·opts 可带 {turn,date,time,category,_edictRef,...} 透传
 *   TM.Qiju.recordEntry(entry)      透传形·entry 即原对象字面量({turn,date,content,category,...})·缺省字段自动补
 *   TM.Qiju.CAP                     240（原 UI 上限·单一真相）
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var CAP = 240; // cap 归一：取原 UI 上限 240·三处散装 trim 已随收口退役

  function recordEntry(entry) {
    var GM = global.GM;
    if (!GM || !entry || typeof entry !== 'object') return null;
    // 空拒门只拒真空条目：结构化记录(edicts/xinglu/memorials=每回合主记录·zhengwen=官修正文)无 content 也是合法条目
    // ——2026-07-04 收口时此门曾把 prep/render 两大写手每回合整条吞掉(审查抓获·勿再收紧)
    var hasBody = (entry.content != null && entry.content !== '') ||
                  entry.zhengwen != null || entry.edicts != null ||
                  entry.xinglu != null || entry.memorials != null;
    if (!hasBody) return null;
    if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
    if (entry.turn == null) entry.turn = Number(GM.turn) || 0;
    // date 兜底：调用方给了 date 或 time（诏书条目用 time）就尊重·否则 getTSText
    if (entry.date == null && entry.time == null) {
      entry.date = (typeof getTSText === 'function') ? getTSText(entry.turn) : '';
    }
    GM.qijuHistory.unshift(entry); // 永远 newest-first
    if (GM.qijuHistory.length > CAP) GM.qijuHistory.length = CAP;
    return entry;
  }

  function record(content, opts) {
    var entry = {};
    if (opts && typeof opts === 'object') {
      for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) entry[k] = opts[k]; }
    }
    entry.content = content;
    return recordEntry(entry);
  }

  TM.Qiju = { record: record, recordEntry: recordEntry, CAP: CAP };
  global.QijuLedger = TM.Qiju;

  /* ── TM.Chronicle — 编年史(GM._chronicle)单一写口（2026-07-04 gm:_chronicle 收口）──
   * 与 qiju 不同的契约·收口时逐读者核过：
   *   - push 时序(旧在前)·读者全是 filter/find 全量扫（keju-reformer-bio 按 reformId 反查老条目）
   *   - 【无 cap·忠实现状】——截老条目会弄断 reformId 反查·无界增长的归档策略属 owner 设计题(见 docs/arch-guards.md)
   * 条目形状 {turn, type, text, tags, ...扩展字段(reformId 等)透传}·turn 缺省自动补。 */
  function chronicleRecord(entry) {
    var GM = global.GM;
    if (!GM || !entry || typeof entry !== 'object') return null;
    if (entry.text == null && entry.content == null) return null;
    if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
    if (entry.turn == null) entry.turn = Number(GM.turn) || 0;
    GM._chronicle.push(entry); // 时序 push·契约与 qiju(unshift) 相反·勿改
    return entry;
  }
  TM.Chronicle = { record: chronicleRecord };
  global.ChronicleLedger = TM.Chronicle;
// globalThis 优先：浏览器 globalThis≡window 零差异·node/vm 沙箱不被 window mock 劫走绑定(smoke-h-school 之鉴)
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
