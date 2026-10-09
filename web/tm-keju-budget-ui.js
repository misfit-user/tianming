// tm-keju-budget-ui.js
// C4·经费 UI 显示·_kjRenderBudgetRow(exam) → HTML string
//
// 数据·
//   exam.costsPaid·{ central: 数, local: 数, provincial: 数 } — 累计本科已扣
//   exam.costShortfall·boolean — true 时显流产警示
//   GM.guoku.money / GM.neitang.money — 当前余额
//
// red line #8·绝不简化经费三级 fallback (国库 → 内帑 → 流产)·本文件仅作只读 view·paradigm 0 改动
//
// 浏览器 + Node 双兼容·纯函数无副作用·零依赖

(function () {
  'use strict';

  // 安全取 GM
  function _kjGM() {
    try {
      if (typeof GM !== 'undefined' && GM) return GM;
      if (typeof global !== 'undefined' && global.GM) return global.GM;
      if (typeof window !== 'undefined' && window.GM) return window.GM;
    } catch (e) { /* silent */ }
    return null;
  }

  /**
   * _kjRenderBudgetRow(exam) → HTML string
   *   显本科经费已扣·国库余·内帑余·若低于警戒线显警示
   *   若 exam.costShortfall = true 显流产警告
   */
  function _kjRenderBudgetRow(exam) {
    if (!exam) return '';
    var costs = exam.costsPaid || {};
    var central = costs.central || 0;
    var local = costs.local || 0;
    var provincial = costs.provincial || 0;
    var totalSpent = central + local + provincial;

    var gm = _kjGM();
    var guokuMoney = (gm && gm.guoku && gm.guoku.money) || 0;
    var neitangMoney = (gm && gm.neitang && gm.neitang.money) || 0;
    var totalReserve = guokuMoney + neitangMoney;

    // 预估殿试经费需求 (最贵阶段·~4000 两)·若两库相加都 < 4000·示警将流产
    var shortfallWarn = '';
    if (exam.costShortfall) {
      shortfallWarn = '<div style="color:var(--vermillion-400);font-size:0.78rem;margin-top:4px;font-weight:700;">'
        + '⚠ 经费断粮·本科流产'  // ⚠ 经费断粮·本科流产
        + '</div>';
    } else if (totalReserve < 4000) {
      shortfallWarn = '<div style="color:var(--amber-400);font-size:0.78rem;margin-top:4px;">'
        + '⚠ 两库合计余 ' + totalReserve + ' 两·不足 4000 两·殿试可能流产'  // ⚠ 两库合计余 X 两·不足 4000 两·殿试可能流产
        + '</div>';
    }

    // 按 stage 给细分 hint·童试 / 乡试 / 会试 / 殿试 已扣
    var breakdown = '';
    if (local > 0)      breakdown += '<span>地方 (童/府/院) ·<strong>' + local + '</strong> 两</span>';
    if (provincial > 0) breakdown += '<span>乡试 ·<strong>' + provincial + '</strong> 两</span>';
    if (central > 0)    breakdown += '<span>中央 (会/殿) ·<strong>' + central + '</strong> 两</span>';

    return '<div class="kj-budget-row" style="margin-bottom:0.6rem;padding:0.55rem 0.85rem;background:var(--bg-2);border-radius:6px;font-size:0.85rem;line-height:1.7;border-left:3px solid var(--gold);">'
      + '<div style="color:var(--gold);font-weight:700;margin-bottom:0.3rem;display:flex;justify-content:space-between;align-items:center;">'
      +   '<span>📜 本科经费</span>'  // 📜 本科经费
      +   '<span style="font-size:0.78rem;color:var(--txt-d);font-weight:400;">累扣 <strong style="color:var(--txt-s);">' + totalSpent + '</strong> 两</span>'  // 累扣 X 两
      + '</div>'
      + (breakdown
        ? '<div style="display:flex;gap:1rem;flex-wrap:wrap;color:var(--txt-s);font-size:0.78rem;margin-bottom:3px;">' + breakdown + '</div>'
        : '')
      + '<div style="display:flex;gap:1rem;flex-wrap:wrap;color:var(--txt-s);">'
      +   '<span>国库余·<strong>' + guokuMoney + '</strong> 两</span>'  // 国库余
      +   '<span>内帑余·<strong>' + neitangMoney + '</strong> 两</span>'  // 内帑余
      + '</div>'
      + shortfallWarn
      + '</div>';
  }

  // 暴露
  if (typeof window !== 'undefined') {
    window._kjRenderBudgetRow = _kjRenderBudgetRow;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _kjRenderBudgetRow: _kjRenderBudgetRow };
  }
})();
