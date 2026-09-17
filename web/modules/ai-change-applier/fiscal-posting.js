// The existing fiscal_adjustments protocol posts stock and its period ledger together.
// The enclosing AI applier owns the rollback boundary, including these account fields.
export function createFiscalPosting(global) {
  'use strict';
  var RES = ['money', 'grain', 'cloth'], pending = [];
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function round(v) { return Math.round(v * 1e8) / 1e8; }
  function isBox(a) { return a && (a.stock !== undefined || a.available !== undefined || a.quota !== undefined || a.deficit !== undefined); }
  function readStock(a, resource) {
    if (!a) return 0;
    if (isBox(a)) return a.stock !== undefined ? num(a.stock) : num(a.available);
    var led = a.ledgers && a.ledgers[resource];
    if (led && led.stock !== undefined) return num(led.stock);
    return resource === 'money' && a.money === undefined ? num(a.balance) : num(a[resource]);
  }
  function regionResource(region, resource) {
    if (!region.publicTreasury) {
      region.publicTreasury = {};
      var priorPeriod = region.fiscal && (region.fiscal.accounting || region.fiscal.period);
      if (priorPeriod) region.publicTreasury.accounting = clone(priorPeriod);
    }
    var account = region.publicTreasury, previous = region.fiscal && region.fiscal.ledgers && region.fiscal.ledgers[resource];
    if (!account[resource]) {
      account[resource] = previous ? clone(previous) : { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 };
    } else if (account[resource].stock === undefined && previous && previous.stock !== undefined) {
      account[resource].stock = previous.stock;
    }
    return account[resource];
  }
  function factionFor(G, region) {
    var player = G.playerInfo || (global.P || {}).playerInfo || {}, key = player.factionId || player.factionName || 'player';
    if (region) {
      var sc = G.scenario || G.scriptData || {}, cfg = G.publicTreasuryConfig || sc.publicTreasuryConfig || {};
      var def = (cfg.accounts || []).find(function(a) { return a.source && a.source.kind === 'region' && a.source.id === region.id; });
      var owner = region.currentOwner || region.owner || region.factionId || def && def.factionId;
      if (!owner) {
        function contains(nodes) { return (nodes || []).some(function(n) { return n === region || ['children','subs','divisions','subRegions'].some(function(k) { return Array.isArray(n[k]) && contains(n[k]); }); }); }
        if (!Array.isArray(G.adminHierarchy)) Object.keys(G.adminHierarchy || {}).some(function(id) {
          var root = G.adminHierarchy[id];
          if (!contains(Array.isArray(root) ? root : root && root.divisions)) return false;
          owner = root.factionId || (id === 'player' ? key : id); return true;
        });
      }
      if (owner) key = owner;
    }
    return (G.facs || []).find(function(f) { return f.id === key || f.name === key; }) || { id: key };
  }
  function periodFor(G, account, scope, faction) {
    var p = global.P || {}, cfg = Object.assign({}, p.fiscalConfig, (G.scenario || G.scriptData || {}).fiscalConfig, G.fiscalConfig, faction.fiscalConfig);
    var old = account.accounting || account.period, key = String(G.sid || '') + ':' + String(G.turn || 0);
    // A same-turn manual posting must keep the period of the already posted tax/payroll book.
    if (old && old.turnKey === key && old.days > 0) return clone(old);
    var days = num(G.turnDays) || num(cfg.daysPerTurn) || num(p.turnDays) || num((p.fiscalConfig || {}).daysPerTurn);
    if (!days && typeof global._getDaysPerTurn === 'function') days = num(global._getDaysPerTurn());
    var unified = global.CascadeTax && typeof global.CascadeTax.isUnified === 'function' ? global.CascadeTax.isUnified(G, faction.id) : cfg.accounting && cfg.accounting.schema === 'tm-fiscal-ledger/2';
    var result = { turn: G.turn || 0, turnKey: key, days: days || 30, daysPerMonth: 30, daysPerYear: unified || scope === 'internal' ? 360 : 365 };
    if (cfg.unit || account.unit) result.unit = clone(cfg.unit || account.unit);
    return result;
  }
  function ensureLedgers(account, region) {
    if (!region && !account.ledgers) account.ledgers = {};
    var books = region ? account : account.ledgers;
    RES.forEach(function(k) {
      var stock = region ? readStock(regionResource(region, k), k) : readStock(account, k);
      if (!books[k]) books[k] = {};
      var b = books[k];
      if (b.stock === undefined) b.stock = stock;
      ['thisTurnIn', 'thisTurnOut', 'lastTurnIn', 'lastTurnOut', 'deficit'].forEach(function(f) { if (b[f] === undefined) b[f] = 0; });
      ['sources', 'sinks', 'sourceDetails', 'sinkDetails', 'deficitDetails'].forEach(function(f) { if (!b[f]) b[f] = {}; });
      if (b.available === undefined) b.available = b.stock;
    });
    return books;
  }
  function roll(account, books, period) {
    var old = account.accounting || account.period;
    if (old && old.turnKey != null && old.turnKey !== period.turnKey) RES.forEach(function(k) {
      var b = books[k]; b.lastTurnIn = num(b.thisTurnIn); b.lastTurnOut = num(b.thisTurnOut);
      b.thisTurnIn = 0; b.thisTurnOut = 0; b.sources = {}; b.sinks = {}; b.sourceDetails = {}; b.sinkDetails = {};
    });
    account.accounting = clone(period);
  }
  function tagFor(entry, scope, direction) {
    var S = global.FiscalStatement;
    var labels = S ? S.labels(scope, direction) : (scope === 'internal' ? { other: '其他' } : { qita: '其他' });
    var candidate = entry.sourceTag || entry.category || '';
    var key = Object.keys(labels).find(function(k) { return k === candidate || labels[k] === candidate; });
    if (!key && direction === 'out' && S) key = S.expenseKey({ sourceTag: candidate, category: entry.category }, scope);
    key = key || (scope === 'internal' ? 'other' : 'qita');
    return { key: key, label: labels[key] || '其他' };
  }
  function addDetail(ledger, field, key, entry, amount) {
    if (!amount) return;
    if (!ledger[field][key]) ledger[field][key] = [];
    var row = ledger[field][key].find(function(r) { return r.id === entry.id; });
    if (!row) { row = { id: entry.id, name: entry.name, amount: 0 }; ledger[field][key].push(row); }
    row.amount = round(row.amount + amount);
  }
  function mirrorRegion(region) {
    if (!region.fiscal) region.fiscal = {};
    if (!region.fiscal.ledgers) region.fiscal.ledgers = {};
    var a = region.publicTreasury, f = region.fiscal;
    RES.forEach(function(k) {
      if (!f.ledgers[k]) f.ledgers[k] = {};
      ['stock', 'available', 'deficit', 'thisTurnIn', 'thisTurnOut', 'lastTurnIn', 'lastTurnOut', 'sources', 'sinks', 'sourceDetails', 'sinkDetails', 'deficitDetails'].forEach(function(field) {
        if (a[k][field] !== undefined) f.ledgers[k][field] = clone(a[k][field]);
      });
    });
    f.accounting = clone(a.accounting); f.flowBasis = a.flowBasis;
  }
  function postStock(target, resource, value, meta) {
    if (!target || !meta || !meta.game || !meta.entry) throw Error('fiscal posting metadata required');
    if (!isFinite(value)) throw Error('non-finite fiscal stock');
    var G = meta.game, region = meta.region || null, scope = meta.target === 'neitang' ? 'internal' : 'central', faction = factionFor(G, region);
    var account = region ? region.publicTreasury : target, books = ensureLedgers(account, region);
    var before = num(books[resource].stock), delta = round(value - before), unpaid = Math.max(0, num(meta.shortfall));
    if (meta.kind === 'income' ? delta < 0 : delta > 0) throw Error('fiscal posting direction mismatch');
    roll(account, books, periodFor(G, account, scope, faction));
    var led = books[resource], paid = Math.abs(delta), direction = meta.kind === 'income' ? 'in' : 'out';
    var tag = tagFor(meta.entry, scope, direction), field = direction === 'in' ? 'sources' : 'sinks', key = direction === 'in' ? tag.key : tag.label;
    led.stock = value;
    led.available = direction === 'in' ? round(num(led.available) + paid) : Math.max(0, round(num(led.available) - paid));
    led[direction === 'in' ? 'thisTurnIn' : 'thisTurnOut'] = round(num(led[direction === 'in' ? 'thisTurnIn' : 'thisTurnOut']) + paid);
    if (paid) led[field][key] = round(num(led[field][key]) + paid);
    var S = global.FiscalStatement;
    if (direction === 'out') {
      if (unpaid) { led.deficit = round(num(led.deficit) + unpaid); led.sinks[key + '_欠'] = round(num(led.sinks[key + '_欠']) + unpaid); }
      if (S) S.recordExpense(led, { expenseId: meta.entry.id, name: meta.entry.name, sourceTag: tag.key, funding: scope === 'internal' ? 'internal' : 'central' }, paid, unpaid);
      else { addDetail(led, 'sinkDetails', tag.key, meta.entry, paid); addDetail(led, 'deficitDetails', tag.key, meta.entry, unpaid); }
    } else if (S) S.recordFlow(led, scope, direction, tag.key, meta.entry.id, meta.entry.name, paid);
    else addDetail(led, 'sourceDetails', tag.key, meta.entry, paid);
    account.flowBasis = 'actual';
    if (region) mirrorRegion(region);
    else { account[resource] = value; if (resource === 'money') account.balance = value; }
    if (!pending.some(function(r) { return r.account === account; })) pending.push({ game: G, account: account, region: region, scope: scope, faction: faction });
  }
  function writeStock(target, resource, value, meta) {
    try { return postStock(target, resource, value, meta); }
    catch (error) { error.fiscalPosting = true; throw error; }
  }
  function signature(fa) {
    return JSON.stringify([fa.target, fa.kind, fa.resource || 'money', fa.name || '', fa.category || '', fa.sourceTag || '', num(fa.amount), !!fa.recurring, fa.reason || '', fa.stopAfterTurn || null]);
  }
  function hash(text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function identity(G, fa, index, namespace) {
    var sig = signature(fa), prefix = (namespace || 'fa') + ':' + String(G.sid || '') + ':' + String(G.turn || 0) + ':';
    return { id: fa.id ? String(fa.id) : prefix + String(index) + ':' + hash(sig), resource: fa.resource || 'money', signature: sig };
  }
  function findPosted(list, posting) {
    var previous = (list || []).find(function(e) { return e && e.id === posting.id && (e.resource || 'money') === posting.resource && e._postingSignature; });
    if (previous && previous._postingSignature !== posting.signature) { var error = Error('fiscal posting id conflict: ' + posting.id); error.fiscalPosting = true; throw error; }
    return previous || null;
  }
  function syncStatements(G) {
    var engine = global.FiscalEngine, S = global.FiscalStatement, budgets = {}, player = factionFor(G);
    if (!engine || typeof engine.syncAccountStatement !== 'function' || !S) { pending = []; return; }
    pending.filter(function(r) { return r.game === G; }).forEach(function(row) {
      var account = row.region ? row.region.fiscal : row.account;
      var id = row.faction.id, budget = budgets[id] || (id === player.id ? G.guoku && G.guoku.budgetPreview : row.faction.budgetPreview);
      var result = engine.syncAccountStatement({ game: G, faction: id, account: account, scope: row.scope, budget: budget, actual: true });
      if (result && result.budget) budgets[id] = result.budget;
      if (row.region && result && result.budget) {
        // The region's public box and fiscal ledger refer to the same physical funds.
        ['unit', 'turnDays', 'lastDelta', 'flowBasis', 'accounting', 'sources', 'expenses', 'sourcesDetail', 'expensesDetail'].forEach(function(k) { row.account[k] = clone(account[k]); });
        RES.forEach(function(k) { var suffix = k === 'money' ? '' : k.charAt(0).toUpperCase() + k.slice(1); ['turn', 'monthly', 'annual'].forEach(function(p) { ['Income', 'Expense'].forEach(function(d) { var field = p + suffix + d; row.account[field] = account[field]; }); }); });
      }
    });
    pending = [];
  }
  return { begin: function() { pending = []; }, readStock: readStock, writeStock: writeStock, regionResource: regionResource, identity: identity, findPosted: findPosted, syncStatements: syncStatements };
}
