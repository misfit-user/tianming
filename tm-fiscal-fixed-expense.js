// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-fiscal-fixed-expense.js — 固定支出自然结算（俸禄 / 军饷 / 宫廷）
 *
 * 对应设计方案：
 *   · 设计方案-财政系统.md §5.4 固定支出三类
 *   · 设计方案-央地财政.md §4 帑廪/内帑分账
 *   · 设计方案-经济系统联动总图.md §5 每回合时序
 *
 * 核心原则：
 *   1. **每回合自然扣除**（与 CascadeTax.collect 平行，不走 AI）
 *   2. **按 turnDays 缩放**（月俸 → 本回合俸 = 月俸 × turnDays/30）
 *   3. **三账扣减**：钱/粮/布各账扣减、写入 thisTurnOut + sinks
 *   4. **俸禄/军饷** 从 国库(guoku) 扣；**宫廷** 从 内帑(neitang) 扣
 *   5. 不足时记亏空(deficit)，不会让 stock 变负数
 *   6. 主官挪用（官制腐败）已在 CascadeTax 环节扣除；此处只管合法支出
 *
 * 对外 API：
 *   FixedExpense.collect([ctx])  —— endTurn 前调用
 *   FixedExpense.tick(ctx)       —— 同上（供 endTurn hook）
 *   FixedExpense.preview()       —— 仅计算不扣款，返回总额（供面板显示）
 *
 * 配置：
 *   scriptData.fiscalConfig.fixedExpense = {
 *     salaryMonthlyPerRank: { '正一品':100, '从一品':90, ... }, // 月俸，两/贯/钱
 *     armyMonthlyPay: { money:0.5, grain:0.3, cloth:0.02 },  // 每兵·月
 *     imperialMonthly: { money:20000, grain:5000, cloth:1000 } // 宫廷总月支
 *   }
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  默认参数
  // ═══════════════════════════════════════════════════════════════════

  var DEFAULT_RANK_SALARY = {
    '正一品': 100, '从一品': 90,
    '正二品': 80,  '从二品': 72,
    '正三品': 65,  '从三品': 58,
    '正四品': 50,  '从四品': 44,
    '正五品': 38,  '从五品': 33,
    '正六品': 28,  '从六品': 24,
    '正七品': 20,  '从七品': 17,
    '正八品': 14,  '从八品': 12,
    '正九品': 10,  '从九品': 8
  };
  var DEFAULT_UNRANKED_SALARY = 6;  // 未定品者月俸

  // 军饷（每兵·月）—— 历史上明清约 0.5-1 两 + 0.3-0.5 石
  var DEFAULT_ARMY_PAY = { money: 0.5, grain: 0.3, cloth: 0.02 };

  // 宫廷开支（每月 —— 帝国规模基线）
  var DEFAULT_IMPERIAL_MONTHLY = { money: 20000, grain: 5000, cloth: 1000 };

  // ═══════════════════════════════════════════════════════════════════
  //  工具
  // ═══════════════════════════════════════════════════════════════════

  function _ensureLedger(obj, key) {
    if (!obj[key]) obj[key] = {
      stock: 0,
      lastTurnIn: 0, lastTurnOut: 0,
      thisTurnIn: 0, thisTurnOut: 0,
      sources: {}, sinks: {},
      history: []
    };
    if (!obj[key].sinks) obj[key].sinks = {};
    if (!obj[key].sources) obj[key].sources = {};
    return obj[key];
  }

  function _deductFromLedger(ledger, amount, sinkTag) {
    if (!ledger || amount <= 0) return { deducted: 0, deficit: 0 };
    var have = ledger.stock || 0;
    var deducted = Math.min(have, amount);
    var deficit = amount - deducted;
    ledger.stock = have - deducted;
    ledger.thisTurnOut = (ledger.thisTurnOut || 0) + deducted;
    if (sinkTag) {
      ledger.sinks = ledger.sinks || {};
      ledger.sinks[sinkTag] = (ledger.sinks[sinkTag] || 0) + deducted;
    }
    if (deficit > 0) {
      ledger.deficit = (ledger.deficit || 0) + deficit;
      ledger.sinks = ledger.sinks || {};
      ledger.sinks[sinkTag + '_欠'] = (ledger.sinks[sinkTag + '_欠'] || 0) + deficit;
    }
    return { deducted: deducted, deficit: deficit };
  }

  function _getConfig() {
    var sd = (global.scriptData && global.scriptData.fiscalConfig && global.scriptData.fiscalConfig.fixedExpense) || null;
    var gm = (global.GM && global.GM.fiscal && global.GM.fiscal.fixedExpense) || null;
    var cfg = {};
    if (sd) Object.keys(sd).forEach(function (k) { cfg[k] = sd[k]; });
    if (gm) Object.keys(gm).forEach(function (k) { cfg[k] = gm[k]; });
    return cfg;
  }

  function _getSalaryTable(cfg) {
    var t = Object.assign({}, DEFAULT_RANK_SALARY);
    if (cfg.salaryMonthlyPerRank) {
      Object.keys(cfg.salaryMonthlyPerRank).forEach(function (k) { t[k] = cfg.salaryMonthlyPerRank[k]; });
    }
    return t;
  }

  function _getTurnDays(ctx) {
    var G = global.GM;
    if (ctx && ctx.turnDays) return ctx.turnDays;
    if (G && G.turnDays) return G.turnDays;
    if (global.scriptData && global.scriptData.turnDays) return global.scriptData.turnDays;
    return 30;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  1. 俸禄 —— 遍历 officeTree 所有有 holder 的 position
  // ═══════════════════════════════════════════════════════════════════

  // 单位侦测：剧本 salary 字段历史上多按"月米石"配置(明清惯例)·需转折银+本色双扣
  // salaryNote 含「石」/「米」 → 数字按 石/月 解读·按朝代折色比例(默认本色 30% / 折银 70%·1 石 ≈ 0.6 两)拆分
  function _detectSalaryUnit(cfg) {
    var note = (cfg && cfg.salaryNote) || '';
    if (/[石米]\b|月米石|米石/.test(note)) return 'grain_stone';   // 单位石(米)·按本色:折银 3:7 拆
    if (/[贯文]/.test(note)) return 'coin';
    return 'silver';   // 默认银
  }
  // 默认折色比例(明代天启末)·剧本可在 fiscalConfig.salaryStoneToSilver 覆盖
  var DEFAULT_GRAIN_RATIO = 0.3;          // 30% 本色米发放
  var DEFAULT_STONE_TO_SILVER = 0.6;      // 1 石折银 0.6 两(明末市价)

  function _calcSalary(ctx) {
    var G = global.GM;
    var cfg = _getConfig();
    var salaryTable = _getSalaryTable(cfg);
    var turnFracMonth = _getTurnDays(ctx) / 30;

    var unit = _detectSalaryUnit(cfg);
    var grainRatio = (cfg.salaryGrainRatio != null) ? cfg.salaryGrainRatio : DEFAULT_GRAIN_RATIO;
    var stoneToSilver = (cfg.salaryStoneToSilver != null) ? cfg.salaryStoneToSilver : DEFAULT_STONE_TO_SILVER;

    // ★ 史实 override·剧本可填 salaryAnnualOverride: { money:n, grain:n, cloth:n } 直接绕开 officeTree 累加
    // 用途·officeTree 编制不全(只填京官)时·剧本作者用此字段配史实总额·避免数据薄导致俸禄虚低
    if (cfg.salaryAnnualOverride && typeof cfg.salaryAnnualOverride === 'object') {
      var ann = cfg.salaryAnnualOverride;
      var turnFrac = _getTurnDays(ctx) / 365;
      return {
        total: {
          money: (ann.money || 0) * turnFrac,
          grain: (ann.grain || 0) * turnFrac,
          cloth: (ann.cloth || 0) * turnFrac
        },
        byDept: { '俸禄·剧本史实总额': (ann.money || 0) * turnFrac },
        unit: unit,
        _override: true
      };
    }

    var total = { money: 0, grain: 0, cloth: 0 };
    var byDept = {};

    // 兜底·若 holder 多缺(scenario 只填京官)·按 establishedCount × 实任率 估算虚拟应发俸
    // 史实明清官员含外官学官散官达 2-5 万·scenario holder 通常仅填 ~100 人·按 establishedCount × fillRate 折算
    var virtualFillRate = (cfg.virtualFillRate != null) ? cfg.virtualFillRate : 0.6;  // 60% 实任率(明末因战乱拖欠常空缺)

    function _walk(nodes, deptPath) {
      (nodes || []).forEach(function (n) {
        if (!n) return;
        var dp = (deptPath ? deptPath + '·' : '') + (n.name || '');
        (n.positions || []).forEach(function (p) {
          if (!p) return;
          // 实际填 holder 的人数
          var hasHolder = p.holder && p.holder !== '' && p.holder !== '空缺' && p.holder !== '(空缺)';
          // 编制人数(scenario 标 establishedCount·明清『定员』)
          var established = (typeof p.establishedCount === 'number' && p.establishedCount > 0) ? p.establishedCount : 1;
          // 实任人数 = max(填 holder 数, established × 实任率) — 缺失 holder 时用编制 × 0.6 兜底
          // 已填 holder=1 取 1·establishedCount 大(如 100 个县令)且 holder 仅填 1 个 → 兜底虚拟数 = max(1, established×0.6)
          var actualHeads = hasHolder ? Math.max(1, Math.floor(established * virtualFillRate)) : 0;
          if (!hasHolder && established > 5) {
            // 编制大但 holder 全空·走兜底估算(避免漏发外官俸)·只对 establishedCount 显式 > 5 的批量职位生效
            actualHeads = Math.floor(established * virtualFillRate * 0.5);  // 全空职位再折半·避免高估
          }
          if (actualHeads <= 0) return;

          // 月俸 —— 优先 position.salary，否则按 rank 表
          var monthly = 0;
          if (p.salary != null && !isNaN(+p.salary)) monthly = +p.salary;
          else if (p.perPersonSalary != null && !isNaN(+p.perPersonSalary)) monthly = +p.perPersonSalary;
          else monthly = salaryTable[p.rank] != null ? salaryTable[p.rank] : DEFAULT_UNRANKED_SALARY;

          var thisTurn = monthly * turnFracMonth * actualHeads;
          // 单位分流：明清『石』单位 → 本色米 + 折银双扣；其他单位走 salaryKind/money
          var posKind = p.salaryKind;
          if (posKind) {
            total[posKind] += thisTurn;
          } else if (unit === 'grain_stone') {
            total.grain += thisTurn * grainRatio;
            total.money += thisTurn * (1 - grainRatio) * stoneToSilver;
          } else {
            total.money += thisTurn;
          }
          byDept[dp] = (byDept[dp] || 0) + thisTurn;
        });
        if (n.subs && n.subs.length) _walk(n.subs, dp);
      });
    }

    _walk(G.officeTree || [], '');
    return { total: total, byDept: byDept, unit: unit };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  1.5 宗禄 —— 明清宗藩岁禄(郡王/将军/中尉等十级)·占俸禄大宗·剧本 neicangRules 配
  // ═══════════════════════════════════════════════════════════════════

  function _calcRoyalStipend(ctx) {
    var G = global.GM;
    var sd = global.scriptData || {};
    var rcp = (sd.fiscalConfig && sd.fiscalConfig.neicangRules && sd.fiscalConfig.neicangRules.royalClanPressure)
           || (G.fiscal && G.fiscal.royalClanPressure)
           || null;
    if (!rcp || !rcp.enabled) return { total: { money: 0, grain: 0, cloth: 0 } };
    // annualStipendPaid 单位通常是『万石』·剧本备注
    var annualStone = (rcp.annualStipendPaid || 0) * 10000;  // 万石 → 石
    if (annualStone <= 0) return { total: { money: 0, grain: 0, cloth: 0 } };
    var turnFracYear = _getTurnDays(ctx) / 365;
    var stoneThis = annualStone * turnFracYear;
    var cfg = _getConfig();
    var grainRatio = (cfg.royalGrainRatio != null) ? cfg.royalGrainRatio : 0.5;  // 宗禄本色比例略高·禄米传统
    var stoneToSilver = (cfg.salaryStoneToSilver != null) ? cfg.salaryStoneToSilver : DEFAULT_STONE_TO_SILVER;
    return {
      total: {
        money: stoneThis * (1 - grainRatio) * stoneToSilver,
        grain: stoneThis * grainRatio,
        cloth: 0
      },
      members: rcp.totalClanMembers || 0,
      arrears: rcp.cumulativeArrears || 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  2. 军饷 —— 遍历 GM.armies，按 soldier 数扣
  // ═══════════════════════════════════════════════════════════════════

  function _calcArmyPay(ctx) {
    var G = global.GM;
    var cfg = _getConfig();
    var pay = Object.assign({}, DEFAULT_ARMY_PAY, cfg.armyMonthlyPay || {});
    var turnFracMonth = _getTurnDays(ctx) / 30;

    // ★ 史实 override·剧本 armyAnnualOverride: { money, grain, cloth } 直接配年额
    // 用途·initialTroops 含全势力部队但 GM.armies 没 faction filter·或剧本只想配总军饷
    if (cfg.armyAnnualOverride && typeof cfg.armyAnnualOverride === 'object') {
      var ann = cfg.armyAnnualOverride;
      var turnFrac = _getTurnDays(ctx) / 365;
      return {
        total: {
          money: (ann.money || 0) * turnFrac,
          grain: (ann.grain || 0) * turnFrac,
          cloth: (ann.cloth || 0) * turnFrac
        },
        byArmy: { '军饷·剧本史实总额': { money: (ann.money || 0) * turnFrac, grain: (ann.grain || 0) * turnFrac, cloth: (ann.cloth || 0) * turnFrac, soldiers: ann.soldiers || 0 } },
        _override: true
      };
    }

    var total = { money: 0, grain: 0, cloth: 0 };
    var byArmy = {};

    (G.armies || []).forEach(function (a) {
      if (!a || a.destroyed) return;
      var soldiers = a.soldiers || a.strength || a.size || 0;
      if (soldiers <= 0) return;
      // 允许 army 自定义 pay rate
      var ap = {
        money: (a.monthlyMoneyPayPerSoldier != null) ? a.monthlyMoneyPayPerSoldier : pay.money,
        grain: (a.monthlyGrainPayPerSoldier != null) ? a.monthlyGrainPayPerSoldier : pay.grain,
        cloth: (a.monthlyClothPayPerSoldier != null) ? a.monthlyClothPayPerSoldier : pay.cloth
      };
      var thisTurnMoney = soldiers * ap.money * turnFracMonth;
      var thisTurnGrain = soldiers * ap.grain * turnFracMonth;
      var thisTurnCloth = soldiers * ap.cloth * turnFracMonth;
      total.money += thisTurnMoney;
      total.grain += thisTurnGrain;
      total.cloth += thisTurnCloth;
      byArmy[a.name || a.id || '军'] = { money: thisTurnMoney, grain: thisTurnGrain, cloth: thisTurnCloth, soldiers: soldiers };
    });
    return { total: total, byArmy: byArmy };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  3. 宫廷 —— 固定月支，可按 imperial 规模缩放
  // ═══════════════════════════════════════════════════════════════════

  function _calcImperialExpense(ctx) {
    var G = global.GM;
    var cfg = _getConfig();
    var base = Object.assign({}, DEFAULT_IMPERIAL_MONTHLY, cfg.imperialMonthly || {});
    var turnFracMonth = _getTurnDays(ctx) / 30;

    // 规模缩放：后宫人数 / 皇室成员 / 皇威（奢靡系数）
    var scale = 1;
    if (G.huangwei && typeof G.huangwei.index === 'number') {
      // 皇威高 → 排场大 1.0-1.3；皇威低 → 节俭 0.7-1.0
      scale = 0.7 + (G.huangwei.index / 100) * 0.6;
    }
    // 皇族人数修正（后妃/皇子数）
    var royalCount = 0;
    if (Array.isArray(G.chars)) {
      G.chars.forEach(function (c) { if (c && c.alive !== false && (c.isRoyal || c.royalRelation === 'emperor_family' || (c.tags||[]).indexOf('皇室')>=0)) royalCount++; });
    }
    if (royalCount > 10) scale *= 1 + (royalCount - 10) * 0.02;

    var total = {
      money: base.money * scale * turnFracMonth,
      grain: base.grain * scale * turnFracMonth,
      cloth: base.cloth * scale * turnFracMonth
    };
    return { total: total, scale: scale, royalCount: royalCount };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主流程：collect
  // ═══════════════════════════════════════════════════════════════════

  function collect(ctx) {
    var G = global.GM;
    if (!G || !G.running) return { ok: false, reason: 'no GM' };

    if (!G.guoku) G.guoku = { money: 0, grain: 0, cloth: 0 };
    if (!G.guoku.ledgers) G.guoku.ledgers = {};
    var gkMoney = _ensureLedger(G.guoku.ledgers, 'money');
    var gkGrain = _ensureLedger(G.guoku.ledgers, 'grain');
    var gkCloth = _ensureLedger(G.guoku.ledgers, 'cloth');
    // 将 guoku 标量同步到 ledger.stock（兼容老代码）
    gkMoney.stock = (gkMoney.stock != null ? gkMoney.stock : (G.guoku.money || 0));
    gkGrain.stock = (gkGrain.stock != null ? gkGrain.stock : (G.guoku.grain || 0));
    gkCloth.stock = (gkCloth.stock != null ? gkCloth.stock : (G.guoku.cloth || 0));

    if (!G.neitang) G.neitang = { money: 0, grain: 0, cloth: 0 };
    if (!G.neitang.ledgers) G.neitang.ledgers = {};
    var ntMoney = _ensureLedger(G.neitang.ledgers, 'money');
    var ntGrain = _ensureLedger(G.neitang.ledgers, 'grain');
    var ntCloth = _ensureLedger(G.neitang.ledgers, 'cloth');
    ntMoney.stock = (ntMoney.stock != null ? ntMoney.stock : (G.neitang.money || 0));
    ntGrain.stock = (ntGrain.stock != null ? ntGrain.stock : (G.neitang.grain || 0));
    ntCloth.stock = (ntCloth.stock != null ? ntCloth.stock : (G.neitang.cloth || 0));

    // ★ 内帑 reconciliation·吸收 tm-authority/tm-authority-engines/tm-corruption/tm-char-economy-engine
    // 等对 G.neitang.{money,grain,cloth,balance} 的旁路写入·money/balance 取偏离更大者
    function _reconNtScalar(led, scalarVal, balanceVal) {
      if (!led) return;
      if (!led.sinks) led.sinks = {};
      if (!led.sources) led.sources = {};
      var stock = led.stock || 0;
      var sd = (scalarVal != null) ? scalarVal - stock : 0;
      var bd = (balanceVal != null) ? balanceVal - stock : 0;
      var diff = Math.abs(sd) >= Math.abs(bd) ? sd : bd;
      if (Math.abs(diff) < 0.5) return;
      led.stock = stock + diff;
      if (diff < 0) {
        led.sinks['外部调整'] = (led.sinks['外部调整'] || 0) + (-diff);
        led.thisTurnOut = (led.thisTurnOut || 0) + (-diff);
      } else {
        led.sources['外部调整'] = (led.sources['外部调整'] || 0) + diff;
        led.thisTurnIn = (led.thisTurnIn || 0) + diff;
      }
    }
    _reconNtScalar(ntMoney, G.neitang.money, G.neitang.balance);
    _reconNtScalar(ntGrain, G.neitang.grain, null);
    _reconNtScalar(ntCloth, G.neitang.cloth, null);

    // 1. 俸禄
    var salary = _calcSalary(ctx);
    var salaryDed = {
      money: _deductFromLedger(gkMoney, salary.total.money, '俸禄'),
      grain: _deductFromLedger(gkGrain, salary.total.grain, '俸禄'),
      cloth: _deductFromLedger(gkCloth, salary.total.cloth, '俸禄')
    };

    // 1.5 宗禄 (royal clan stipend·明清庞大宗藩岁禄)·单独 sinkTag 便于识别
    var royal = _calcRoyalStipend(ctx);
    var royalDed = {
      money: _deductFromLedger(gkMoney, royal.total.money, '宗禄'),
      grain: _deductFromLedger(gkGrain, royal.total.grain, '宗禄'),
      cloth: _deductFromLedger(gkCloth, royal.total.cloth, '宗禄')
    };

    // 2. 军饷
    var army = _calcArmyPay(ctx);
    var armyDed = {
      money: _deductFromLedger(gkMoney, army.total.money, '军饷'),
      grain: _deductFromLedger(gkGrain, army.total.grain, '军饷'),
      cloth: _deductFromLedger(gkCloth, army.total.cloth, '军饷')
    };

    // 3. 宫廷（扣内帑；若不足则从 guoku 强行补，以防内帑长期枯竭游戏进不下去）
    var imp = _calcImperialExpense(ctx);
    var impDed = {
      money: _deductFromLedger(ntMoney, imp.total.money, '宫廷'),
      grain: _deductFromLedger(ntGrain, imp.total.grain, '宫廷'),
      cloth: _deductFromLedger(ntCloth, imp.total.cloth, '宫廷')
    };
    // 内帑不足部分 → 由 guoku 拨付（户部补内帑）
    ['money', 'grain', 'cloth'].forEach(function (k) {
      var shortfall = impDed[k].deficit;
      if (shortfall > 0) {
        var led = (k === 'money') ? gkMoney : (k === 'grain') ? gkGrain : gkCloth;
        var r = _deductFromLedger(led, shortfall, '户部补内帑');
        // 冲销已记在 neitang.deficit 的欠账
        var ntLed = (k === 'money') ? ntMoney : (k === 'grain') ? ntGrain : ntCloth;
        if (ntLed.deficit && r.deducted > 0) {
          ntLed.deficit = Math.max(0, ntLed.deficit - r.deducted);
          if (ntLed.sinks && ntLed.sinks['宫廷_欠']) {
            ntLed.sinks['宫廷_欠'] = Math.max(0, ntLed.sinks['宫廷_欠'] - r.deducted);
          }
        }
      }
    });

    // 同步标量（兼容老 panel）
    G.guoku.money = gkMoney.stock;
    G.guoku.grain = gkGrain.stock;
    G.guoku.cloth = gkCloth.stock;
    G.guoku.balance = gkMoney.stock;
    G.neitang.money = ntMoney.stock;
    G.neitang.grain = ntGrain.stock;
    G.neitang.cloth = ntCloth.stock;

    // 记录本回合总支出
    var turnExpense = {
      salary: salary.total,
      royal: royal.total,
      army: army.total,
      imperial: imp.total,
      totalMoney: salary.total.money + royal.total.money + army.total.money + imp.total.money,
      totalGrain: salary.total.grain + royal.total.grain + army.total.grain + imp.total.grain,
      totalCloth: salary.total.cloth + royal.total.cloth + army.total.cloth + imp.total.cloth,
      turnDays: _getTurnDays(ctx)
    };
    G.guoku.turnExpense = turnExpense.totalMoney;
    G.guoku.turnGrainExpense = turnExpense.totalGrain;
    G.guoku.turnClothExpense = turnExpense.totalCloth;
    G._lastFixedExpense = turnExpense;

    // 兼容老"月支"字段
    var turnFrac30 = Math.max(1, _getTurnDays(ctx)) / 30;
    G.guoku.monthlyExpense = Math.round(turnExpense.totalMoney / turnFrac30);
    G.guoku.annualExpense = Math.round(turnExpense.totalMoney * (365 / Math.max(1, _getTurnDays(ctx))));

    // ★ 标记本回合已走固定支出·下游 GuokuEngine.monthlySettle 以此判断是否需要避开 fenglu/junxiang/neiting 项
    G._lastFixedExpenseTurn = G.turn || 0;

    if (global.addEB) {
      try {
        var unit = (global.CurrencyUnit && global.CurrencyUnit.getUnit && global.CurrencyUnit.getUnit()) || { money: '两', grain: '石', cloth: '匹' };
        global.addEB('支出', '本回合固定支出 ' + Math.round(turnExpense.totalMoney) + unit.money + '（俸 ' + Math.round(salary.total.money) + ' · 饷 ' + Math.round(army.total.money) + ' · 廷 ' + Math.round(imp.total.money) + '）');
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-fixed-expense');}catch(_){}}
    }

    return {
      ok: true,
      salary: salary,
      army: army,
      imperial: imp,
      deducted: {
        salary: salaryDed, army: armyDed, imperial: impDed
      },
      turnExpense: turnExpense
    };
  }

  function tick(ctx) {
    try { return collect(ctx); } catch (e) { console.error('[FixedExpense.tick]', e); return { ok: false, error: e }; }
  }

  function preview(ctx) {
    try {
      var sal = _calcSalary(ctx);
      var roy = _calcRoyalStipend(ctx);
      var arm = _calcArmyPay(ctx);
      var imp = _calcImperialExpense(ctx);
      // 平铺成 {totalMoney/Grain/Cloth + 各项 .money/.grain/.cloth} 便于 enterGame 同步显示
      return {
        salary:   sal.total,    // {money,grain,cloth}
        royal:    roy.total,    // {money,grain,cloth}
        army:     arm.total,    // {money,grain,cloth}
        imperial: imp.total,    // {money,grain,cloth}
        totalMoney: (sal.total.money || 0) + (roy.total.money || 0) + (arm.total.money || 0) + (imp.total.money || 0),
        totalGrain: (sal.total.grain || 0) + (roy.total.grain || 0) + (arm.total.grain || 0) + (imp.total.grain || 0),
        totalCloth: (sal.total.cloth || 0) + (roy.total.cloth || 0) + (arm.total.cloth || 0) + (imp.total.cloth || 0),
        // raw 字段·panel 可深挖
        _salaryByDept: sal.byDept,
        _royalMembers: roy.members,
        _royalArrears: roy.arrears,
        _armyByArmy: arm.byArmy,
        _imperialScale: imp.scale,
        _royalCount: imp.royalCount
      };
    } catch (e) {
      console.error('[FixedExpense.preview]', e);
      return null;
    }
  }

  global.FixedExpense = {
    collect: collect,
    tick: tick,
    preview: preview,
    DEFAULT_RANK_SALARY: DEFAULT_RANK_SALARY,
    DEFAULT_ARMY_PAY: DEFAULT_ARMY_PAY,
    DEFAULT_IMPERIAL_MONTHLY: DEFAULT_IMPERIAL_MONTHLY,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
