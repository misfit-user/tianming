// Explicit native account contracts projected onto the existing treasury ledgers.
// This adapter owns no second stock balance: account.balance and treasury scalars are views.
(function (root) {
  'use strict';
  var resources = ['money', 'grain', 'cloth'],
    arr = function (x) {
      return Array.isArray(x) ? x : [];
    };
  var own = function (x, k) {
    return !!x && Object.prototype.hasOwnProperty.call(x, k);
  };
  function enabled(g) {
    return !!(root.TM && root.TM.NativeWorld && root.TM.NativeWorld.enabled(g));
  }
  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    throw e;
  }
  function number(v, label) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail('native-finance-value', label + ' 须为非负有限数');
    return v;
  }
  function accounts(g) {
    return arr(g.nativeWorld && g.nativeWorld.accounts);
  }
  function byId(g, id) {
    var a = accounts(g).find(function (a) {
      return a.id === id;
    });
    if (!a) fail('native-finance-account', '支付账户不存在：' + id);
    return a;
  }
  function treasury(g, a) {
    var f = arr(g.facs).find(function (f) {
      return f.id === a.ownerFactionId;
    });
    if (!f) fail('native-finance-owner', '账户势力不存在：' + a.ownerFactionId);
    var key = a.kind === 'private' ? 'privateTreasury' : 'treasury';
    if (a.ownerFactionId === g.startContext.playerFactionId) {
      var mirror = a.kind === 'private' ? 'neitang' : 'guoku';
      g[mirror] = g[mirror] || {};
      f[key] = g[mirror];
    }
    return f[key] || (f[key] = {});
  }
  function ledger(g, a) {
    var t = treasury(g, a);
    if (!t.ledgers || !t.ledgers[a.resource]) fail('native-finance-ledger', '存档缺少账户账本：' + a.id);
    return t.ledgers[a.resource];
  }
  function alias(o, key, get, set) {
    Object.defineProperty(o, key, { enumerable: true, configurable: true, get: get, set: set });
  }
  function bind(g, seed) {
    if (!enabled(g)) return;
    var rows = accounts(g),
      models = [];
    rows.forEach(function (a) {
      var t = treasury(g, a);
      if (models.indexOf(t) < 0) models.push(t);
      t.ledgers = t.ledgers || {};
      if (seed)
        t.ledgers[a.resource] = Object.assign({}, t.ledgers[a.resource], {
          stock: number(a.balance, a.id),
          deficit: 0,
          sources: {},
          sinks: {},
        });
      else number(ledger(g, a).stock, a.id + ' stock');
      t.unit = t.unit || {};
      t.unit[a.resource] = a.unit;
    });
    // Empty private/public models remain explicit zero views, never dynasty defaults.
    ['guoku', 'neitang'].forEach(function (key) {
      g[key] = g[key] || {};
      if (models.indexOf(g[key]) < 0) models.push(g[key]);
    });
    models.forEach(function (t) {
      t.ledgers = t.ledgers || {};
      resources.forEach(function (r) {
        var configured = rows.some(function (a) {
          return a.resource === r && treasury(g, a) === t;
        });
        if (!configured) t.ledgers[r] = { stock: 0, deficit: 0, sources: {}, sinks: {} };
        alias(
          t,
          r,
          function () {
            return t.ledgers[r].stock;
          },
          function (v) {
            number(v, r);
            if (!configured && v !== 0) fail('native-finance-unconfigured', '未配置的 ' + r + ' 账户不能隐式入账');
            t.ledgers[r].stock = v;
          },
        );
      });
      alias(
        t,
        'balance',
        function () {
          return t.ledgers.money.stock;
        },
        function (v) {
          t.money = v;
        },
      );
    });
    rows.forEach(function (a) {
      alias(
        a,
        'balance',
        function () {
          return ledger(g, a).stock;
        },
        function (v) {
          ledger(g, a).stock = number(v, a.id);
        },
      );
    });
    alias(
      g,
      'stateTreasury',
      function () {
        return g.guoku.money;
      },
      function (v) {
        g.guoku.money = v;
      },
    );
    alias(
      g,
      'privateTreasury',
      function () {
        return g.neitang.money;
      },
      function (v) {
        g.neitang.money = v;
      },
    );
    if (seed) g.nativeWorld.financeReady = true;
    if (g.nativeWorld.financeReady) refreshMetrics(g);
  }
  function days(g, ctx) {
    var v = ctx && ctx.turnDays;
    if (v == null && typeof root._getDaysPerTurn === 'function') v = root._getDaysPerTurn();
    if (v == null) v = g.time && g.time.daysPerTurn;
    if (v == null) v = 30;
    number(v, '回合天数');
    if (v <= 0) fail('native-finance-days', '回合天数必须大于零');
    return v;
  }
  function officeRows(g) {
    var result = [],
      seen = new Set();
    function walk(nodes) {
      arr(nodes).forEach(function (d) {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        result.push(d);
        walk(d.subs);
        walk(d.children);
      });
    }
    walk(g.officeTree);
    Object.keys(g.nativeWorld.offices || {}).forEach(function (k) {
      walk(g.nativeWorld.offices[k]);
    });
    walk(g.nativeWorld.baseOfficeTree);
    return result;
  }
  function charges(g, ctx) {
    var out = [],
      d = days(g, ctx);
    officeRows(g).forEach(function (dept) {
      arr(dept.positions).forEach(function (pos) {
        var holderIds = Array.isArray(pos.actualHolders)
          ? pos.actualHolders
              .filter(function (h) {
                return h.generated !== false;
              })
              .map(function (h) {
                return h.characterId;
              })
          : pos.holderId
            ? [pos.holderId]
            : [];
        if (new Set(holderIds).size !== holderIds.length) fail('native-finance-holder', '同一职位重复任职：' + pos.id);
        if (!holderIds.length) return; // Vacancies and ungenerated placeholders never draw pay.
        if (!Array.isArray(pos.salaryPayments))
          fail('native-finance-salary', '在任职位须明确 salaryPayments（无俸禄填写空数组）：' + pos.id);
        holderIds.forEach(function (hid) {
          var ch = arr(g.chars).find(function (c) {
            return c.id === hid;
          });
          if (!ch) fail('native-finance-holder', '任职人物不存在：' + pos.id);
          if (!root.TM.StartContracts.isAlive(ch)) return;
          pos.salaryPayments.forEach(function (p) {
            var a = byId(g, p.accountId);
            out.push({
              accountId: a.id,
              resource: a.resource,
              amount: (number(p.amountPer30Days, pos.id + ' 俸禄') * d) / 30,
              category: 'salary',
              targetId: pos.id,
              characterId: hid,
              departmentId: dept.id,
            });
          });
        });
      });
    });
    arr(g.armies || (g.military && g.military.initialTroops)).forEach(function (army) {
      if (army.destroyed) return;
      var soldiers = number(army.soldiers, army.id + ' 兵额');
      if (!soldiers) return;
      resources.forEach(function (resource) {
        var key = 'monthly' + resource[0].toUpperCase() + resource.slice(1) + 'PayPerSoldier';
        var rate = number(army[key], army.id + ' ' + key);
        if (!rate) return;
        var payers = arr(army.payerShares).filter(function (p) {
          return byId(g, p.accountId).resource === resource;
        });
        var sum = payers.reduce(function (n, p) {
          return n + number(p.share, '支付份额');
        }, 0);
        if (Math.abs(sum - 1) > 1e-9) fail('native-finance-shares', army.id + ' ' + resource + ' 支付份额合计必须为一');
        var units = new Set(
          payers.map(function (p) {
            return byId(g, p.accountId).unit;
          }),
        );
        if (
          units.size !== 1 ||
          (army.payUnits &&
            army.payUnits[resource] !==
              payers.map(function (p) {
                return byId(g, p.accountId).unit;
              })[0])
        )
          fail('native-finance-unit', army.id + ' 支付单位不一致，不能静默兑换');
        payers.forEach(function (p) {
          out.push({
            accountId: p.accountId,
            resource: resource,
            amount: ((soldiers * rate * d) / 30) * p.share,
            category: 'army',
            targetId: army.id,
            soldiers: soldiers,
          });
        });
      });
    });
    return out;
  }
  function taxTerms(a) {
    var f = a.flowModel,
      period = number(f.periodDays, a.id + ' 税期'),
      rate = number(f.rate, a.id + ' 税率');
    if (!period || rate > 1 || a.kind !== 'public')
      fail('native-tax-model', '地块税收须使用公共账户、正数周期及 0 到 1 的明确税率：' + a.id);
    return { period: period, rate: rate };
  }
  // Economic base, political ownership and control are not authority to collect tax.
  // Only an explicitly typed base and taxAuthorityFactionId may feed a region-tax account.
  function taxReceipts(g, d) {
    var result = [],
      ids = new Set(), policyContext = {game:g, turnDays:d};
    var map = g.mapData || g.map;
    arr(map && map.regions).forEach(function (r) {
      var declared = own(r, 'taxBaseResource') || own(r, 'taxBaseUnit');
      if (!declared && !(own(r, 'taxBase') && r.taxAuthorityFactionId != null)) return;
      if (!r.id || ids.has(r.id)) fail('native-tax-region', '税基地块须有唯一稳定 ID');
      ids.add(r.id);
      var base = number(r.taxBase, r.id + ' 税基');
      if (resources.indexOf(r.taxBaseResource) < 0 || typeof r.taxBaseUnit !== 'string' || !r.taxBaseUnit.trim())
        fail('native-tax-unit', '税基须明确资源与单位，不将钱粮互换：' + r.id);
      if (!own(r, 'taxAuthorityFactionId')) fail('native-tax-authority', '税基未配置税权方：' + r.id);
      if (r.taxAuthorityFactionId === null) return; // Explicitly suspended/exempt, not inferred from a colour.
      if (
        !arr(g.facs).some(function (f) {
          return f.id === r.taxAuthorityFactionId;
        })
      )
        fail('native-tax-authority', '税权势力不存在：' + r.id);
      var rows = accounts(g).filter(function (a) {
        return a.ownerFactionId === r.taxAuthorityFactionId && a.kind === 'public' && a.resource === r.taxBaseResource;
      });
      if (rows.length !== 1 || !rows[0].flowModel || rows[0].flowModel.type !== 'region-tax')
        fail('native-tax-account', '税权方须明确配置该资源的唯一地块税收账户：' + r.id);
      var a = rows[0],
        terms = taxTerms(a);
      if (root.TM && root.TM.TaxPolicy) terms.rate = root.TM.TaxPolicy.effectiveTax(g, r, {id:a.id,name:a.name||a.id,base:a.flowModel.taxBase||'',rate:terms.rate}, policyContext).rate;
      if (a.unit !== r.taxBaseUnit) fail('native-tax-unit', '税基与税收账户单位不一致：' + r.id);
      result.push({
        category: 'region-tax',
        regionId: r.id,
        regionName: r.name || r.id,
        taxAuthorityFactionId: r.taxAuthorityFactionId,
        accountId: a.id,
        resource: a.resource,
        unit: a.unit,
        base: base,
        rate: terms.rate,
        amount: number((base * terms.rate * d) / terms.period, r.id + ' 本期税额'),
      });
    });
    return result;
  }
  function flow(a, phase, d, taxes) {
    var f = a.flowModel;
    if (!f || ['none', 'fixed', 'region-tax'].indexOf(f.type) < 0)
      fail('native-finance-flow', '账户 ' + a.id + ' 的 flowModel 未实现或未配置');
    if (f.type === 'none') return 0;
    var period = number(f.periodDays, a.id + ' 周期');
    if (!period) fail('native-finance-period', '结算周期须大于零');
    if (f.type === 'region-tax') {
      taxTerms(a);
      if (phase === 'income')
        return arr(taxes)
          .filter(function (r) {
            return r.accountId === a.id;
          })
          .reduce(function (sum, r) {
            return sum + r.amount;
          }, 0);
    }
    return (number(f[phase], a.id + ' ' + phase) * d) / period;
  }
  function inspect(s) {
    var errors = [];
    arr(s.nativeStart && s.nativeStart.accounts).forEach(function (a) {
      try {
        flow(a, 'income', 30);
        flow(a, 'expense', 30);
      } catch (e) {
        errors.push({ code: e.code, message: e.message });
      }
    });
    try {
      taxReceipts(
        { map: s.map, facs: s.factions, nativeWorld: { accounts: arr(s.nativeStart && s.nativeStart.accounts) } },
        30,
      );
    } catch (e) {
      errors.push({ code: e.code, message: e.message });
    }
    try {
      charges(
        {
          nativeWorld: {
            accounts: arr(s.nativeStart && s.nativeStart.accounts),
            offices: s.officeRegistryByFaction || {},
            baseOfficeTree: s.officeTree,
          },
          officeTree: s.officeTree,
          chars: s.characters,
          armies: s.military && s.military.initialTroops,
        },
        { turnDays: 30 },
      );
    } catch (e) {
      errors.push({ code: e.code, message: e.message });
    }
    return errors;
  }
  function quote(g, ctx, factionId) {
    var list = charges(g, ctx).filter(function (c) {
      return byId(g, c.accountId).ownerFactionId === (factionId || g.startContext.playerFactionId);
    });
    var q = {
      salary: { money: 0, grain: 0, cloth: 0 },
      royal: { money: 0, grain: 0, cloth: 0 },
      army: { money: 0, grain: 0, cloth: 0 },
      imperial: { money: 0, grain: 0, cloth: 0 },
      totalMoney: 0,
      totalGrain: 0,
      totalCloth: 0,
      _salaryByDept: {},
      _armyByArmy: {},
      payments: list,
    };
    list.forEach(function (c) {
      q[c.category][c.resource] += c.amount;
      if (c.category === 'salary') q._salaryByDept[c.departmentId] = (q._salaryByDept[c.departmentId] || 0) + c.amount;
      else {
        var a =
          q._armyByArmy[c.targetId] ||
          (q._armyByArmy[c.targetId] = { money: 0, grain: 0, cloth: 0, soldiers: c.soldiers });
        a[c.resource] += c.amount;
      }
    });
    var d = days(g, ctx),
      taxes = taxReceipts(g, d);
    q.turnDays = d;
    q.taxReceipts = taxes.filter(function (r) {
      return r.taxAuthorityFactionId === (factionId || g.startContext.playerFactionId);
    });
    q.accountRows = accounts(g)
      .filter(function (a) {
        return a.ownerFactionId === (factionId || g.startContext.playerFactionId);
      })
      .map(function (a) {
        return {
          id: a.id,
          name: a.name || a.id,
          kind: a.kind,
          resource: a.resource,
          unit: a.unit,
          balance: a.balance,
          income: flow(a, 'income', d, taxes),
          expense:
            flow(a, 'expense', d) +
            list
              .filter(function (c) {
                return c.accountId === a.id;
              })
              .reduce(function (n, c) {
                return n + c.amount;
              }, 0),
        };
      });
    resources.forEach(function (r) {
      q['total' + r[0].toUpperCase() + r.slice(1)] = q.accountRows
        .filter(function (a) {
          return a.resource === r;
        })
        .reduce(function (n, a) {
          return n + a.expense;
        }, 0);
    });
    return q;
  }
  function refreshMetrics(g, ctx) {
    var q = quote(g, ctx),
      d = q.turnDays;
    ['public', 'private'].forEach(function (kind) {
      var t = g[kind === 'public' ? 'guoku' : 'neitang'];
      if (!t) return;
      t.turnDays = d;
      resources.forEach(function (resource) {
        var rows = q.accountRows.filter(function (a) {
            return a.kind === kind && a.resource === resource;
          }),
          income = rows.reduce(function (n, a) {
            return n + a.income;
          }, 0),
          expense = rows.reduce(function (n, a) {
            return n + a.expense;
          }, 0),
          prefix = resource === 'money' ? '' : resource[0].toUpperCase() + resource.slice(1);
        t['turn' + prefix + 'Income'] = income;
        t['turn' + prefix + 'Expense'] = expense;
        if (resource === 'money') {
          t.monthlyIncome = (income * 30) / d;
          t.monthlyExpense = (expense * 30) / d;
          t.annualIncome = (income * 365) / d;
          t.annualExpense = (expense * 365) / d;
        }
      });
    });
    return q;
  }
  function settle(g, phase, ctx, factionId, kind) {
    if (!enabled(g)) return null;
    if (!g.nativeWorld.financeReady) return { ok: true, skipped: 'initial-stock-not-seeded', receipts: [] };
    bind(g, false);
    var d = days(g, ctx),
      fac = factionId || g.startContext.playerFactionId,
      rows = accounts(g).filter(function (a) {
        return a.ownerFactionId === fac && (!kind || a.kind === kind);
      });
    var items = phase === 'expense' ? charges(g, ctx) : taxReceipts(g, d),
      journal = g.nativeWorld.fiscalOperations || (g.nativeWorld.fiscalOperations = {});
    var frontier = g.nativeWorld.fiscalFrontier || (g.nativeWorld.fiscalFrontier = {});
    var todo = rows.filter(function (a) {
      return !journal[phase + ':' + g.turn + ':' + a.id] && !(frontier[phase + ':' + a.id] >= Number(g.turn));
    });
    if (!todo.length) return { ok: true, skipped: 'already-collected-this-turn', receipts: [] };
    var plan = todo.map(function (a) {
      var value = flow(a, phase, d, items),
        payments = items.filter(function (c) {
          return c.accountId === a.id;
        });
      if (phase === 'expense')
        value += payments.reduce(function (n, c) {
          return n + c.amount;
        }, 0);
      number(value, '本期总额');
      return { a: a, amount: value, payments: payments, before: JSON.parse(JSON.stringify(ledger(g, a))) };
    });
    var receipts = [];
    try {
      plan.forEach(function (p) {
        var l = ledger(g, p.a),
          before = number(l.stock, p.a.id),
          paid = phase === 'income' ? p.amount : Math.min(before, p.amount),
          deficit = phase === 'expense' ? p.amount - paid : 0;
        l.stock = phase === 'income' ? before + paid : before - paid;
        l.deficit = number(l.deficit == null ? 0 : l.deficit, '欠额') + deficit;
        l[phase === 'income' ? 'lastTurnIn' : 'lastTurnOut'] = paid;
        l[phase === 'income' ? 'thisTurnIn' : 'thisTurnOut'] = paid;
        l.turnDelta = (l.thisTurnIn || 0) - (l.thisTurnOut || 0);
        var field = phase === 'income' ? 'sources' : 'sinks';
        l[field] = l[field] || {};
        l[field]['native:' + g.turn] = p.amount;
        receipts.push({
          accountId: p.a.id,
          resource: p.a.resource,
          unit: p.a.unit,
          before: before,
          after: l.stock,
          requested: p.amount,
          paid: paid,
          deficit: deficit,
          payments: p.payments,
        });
      });
      if (ctx && typeof ctx._faultInjector === 'function') ctx._faultInjector('after-deductions', receipts);
      receipts.forEach(function (r) {
        journal[phase + ':' + g.turn + ':' + r.accountId] = r;
        frontier[phase + ':' + r.accountId] = Number(g.turn);
      });
      // Keep the durable idempotency frontier bounded, without removing this or the previous turn.
      Object.keys(journal).forEach(function (k) {
        if (Number(k.split(':')[1]) < Number(g.turn) - 2) delete journal[k];
      });
      return { ok: true, receipts: receipts, turnDays: d };
    } catch (e) {
      plan.forEach(function (p) {
        var l = ledger(g, p.a);
        Object.keys(l).forEach(function (k) {
          delete l[k];
        });
        Object.assign(l, p.before);
      });
      throw e;
    }
  }
  function collect(g, ctx) {
    if (!g.nativeWorld.financeReady) return { ok: true, skipped: 'initial-stock-not-seeded' };
    var q = quote(g, ctx),
      r = settle(g, 'expense', ctx);
    g._lastFixedExpense = q;
    g._lastFixedExpenseTurn = g.turn;
    return Object.assign(r, {
      turnExpense: q,
      salary: { total: q.salary },
      army: { total: q.army },
      royal: { total: q.royal },
      imperial: { total: q.imperial },
    });
  }
  function npc(g, ctx) {
    var run = 0;
    arr(g.facs).forEach(function (f) {
      if (f.id === g.startContext.playerFactionId) return;
      var ownAccounts = accounts(g).filter(function (a) {
        return a.ownerFactionId === f.id;
      });
      if (!ownAccounts.length) {
        f.nativeFiscalStatus = 'unconfigured';
        return;
      }
      var income = settle(g, 'income', ctx, f.id),
        expense = settle(g, 'expense', ctx, f.id);
      if (income.skipped && expense.skipped) return;
      f.npcFiscalLedger = arr(f.npcFiscalLedger).slice(-29);
      f.npcFiscalLedger.push({
        id: 'native-npc:' + g.turn + ':' + f.id,
        turn: g.turn,
        income: income.receipts,
        expense: expense.receipts,
      });
      run++;
    });
    return { run: run };
  }
  function tick(g, ctx, kind) {
    return settle(g, 'income', ctx, g.startContext.playerFactionId, kind);
  }
  function transfer(g, fromKind, toKind, amount) {
    if (!root.TM.NativeWorld.allowed(g, 'treasury', g.startContext.playerFactionId))
      return { success: false, code: 'native-treasury-authority-denied', reason: '当前政治授权不允许调拨账款' };
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
      return { success: false, code: 'native-transfer-amount', reason: '调拨数额须为非负有限数，不使用默认金额' };
    var ownRows = accounts(g).filter(function (a) {
        return a.ownerFactionId === g.startContext.playerFactionId && a.resource === 'money';
      }),
      from = ownRows.find(function (a) {
        return a.kind === fromKind;
      }),
      to = ownRows.find(function (a) {
        return a.kind === toKind;
      });
    if (!from || !to)
      return { success: false, code: 'native-transfer-account', reason: '未配置所需公私账户，不能隐式创建内帑' };
    if (from.unit !== to.unit)
      return { success: false, code: 'native-transfer-unit', reason: '公私账户单位不同，需要明确兑换契约' };
    bind(g, false);
    if (from.balance < amount)
      return { success: false, code: 'native-transfer-insufficient', reason: '账户余额不足，未扣款' };
    var a = ledger(g, from),
      b = ledger(g, to);
    a.stock -= amount;
    b.stock += amount;
    a.sinks = a.sinks || {};
    b.sources = b.sources || {};
    a.sinks['transfer:' + to.id] = (a.sinks['transfer:' + to.id] || 0) + amount;
    b.sources['transfer:' + from.id] = (b.sources['transfer:' + from.id] || 0) + amount;
    return { success: true, amount: amount, unit: from.unit, fromAccountId: from.id, toAccountId: to.id };
  }
  function actionSupport(g) {
    return root.TM.NativeWorld.allowed(g, 'treasury', g.startContext.playerFactionId)
      ? {
          success: false,
          code: 'native-flow-action-unsupported',
          reason: '此开局的固定流量契约未实现这类临时财政动作；未套用默认帝国数值',
        }
      : { success: false, code: 'native-treasury-authority-denied', reason: '当前政治授权不允许该财政动作' };
  }
  root.TM = root.TM || {};
  root.TM.NativeFiscal = {
    enabled: enabled,
    inspect: inspect,
    bind: bind,
    quote: quote,
    settle: settle,
    collect: collect,
    npc: npc,
    tick: tick,
    charges: charges,
    taxReceipts: taxReceipts,
    transfer: transfer,
    actionSupport: actionSupport,
    refreshMetrics: refreshMetrics,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.NativeFiscal;
})(typeof window !== 'undefined' ? window : globalThis);
