#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-game-loop.js'), 'utf8');
let passed = 0;
function ok(v, label) { if (!v) throw new Error('[smoke-startup-health-gate] ' + label); passed++; console.log('  ok - ' + label); }

function makeContext(failCurrency) {
  const els = { E: { style: {} }, G: { style: {} } };
  const c = {
    console, Date, Math, JSON, Object, Array, Number, String, RegExp, isFinite,
    window: null,
    addEventListener() {},
    document: { addEventListener() {}, querySelectorAll() { return []; } },
    P: { time: { daysPerTurn: 30 } },
    GM: { turn: 2, sid: 's1', chars: [], officeTree: [], adminHierarchy: {}, regions: [], running: true },
    TM: { errors: { capture() {} } },
    _$(id) { return els[id] || { style: {}, classList: { add() {}, remove() {} } }; },
    makeEntitiesReactive() {},
    _initOfficePublicTreasury() {}, _initCharacterPrivateWealth() {},
    findScenarioById() { return {}; },
    GuokuEngine: { ensureModel() {} }, NeitangEngine: { ensureModel() {} },
    CurrencyEngine: { init() { if (failCurrency) throw new Error('currency init fault'); } },
    CentralLocalEngine: { init() {} }, HujiEngine: { init() {} },
    CascadeTax: { collect() { return { ok: true }; }, _ensureEconomyBase() {} },
    FixedExpense: { collect() { return { ok: true }; }, preview() { return {}; } },
    IntegrationBridge: { init() {}, aggregateRegionsToVariables() {} },
    EconomyGapFill: { init() {}, buildHierarchyFromAdminDepth() {} },
    AuthorityEngines: { init() {} },
    _tmRefreshFactionDerivedRuntime() {},
    renderGameState() { c.rendered = true; },
    GameHooks: { run() {} }, hideLoading() {}, toast(msg) { c.lastToast = msg; },
    setTimeout() {}, clearTimeout() {}
  };
  c.window = c;
  c.globalThis = c;
  c.els = els;
  vm.createContext(c);
  vm.runInContext(source, c, { filename: 'tm-game-loop.js' });
  return c;
}

const bad = makeContext(true);
let threw = false;
try { bad.enterGame(); } catch (_) { threw = true; }
ok(threw, '关键子系统失败向入口抛出');
ok(!bad.rendered, 'fatal 初始化失败时不渲染游戏世界');
ok(bad.els.G.style.display === 'none' && bad.els.E.style.display === 'block', 'fatal 初始化失败退回启动界面');
ok(bad.TM.StartupHealth.status === 'fatal' && bad.TM.StartupHealth.fatal.some(x => /CurrencyEngine/.test(x.system)), 'StartupHealth 记录 fatal 系统与错误');

const good = makeContext(false);
good.enterGame();
ok(good.rendered === true, '关键初始化全部成功后才渲染');
ok(good.TM.StartupHealth.status === 'ok', '健康启动标记为 ok');

console.log('[smoke-startup-health-gate] pass=' + passed);
