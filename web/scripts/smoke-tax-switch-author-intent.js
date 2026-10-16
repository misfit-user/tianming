#!/usr/bin/env node
'use strict';
// 作者税种开关（2026-10-17）
//   案：编辑器「税种启用」取消勾选后照样征税。编辑器存 {国库大类: false}；FiscalEngine.enableTaxesByDynasty
//       的 normalizeTaxMap 只收对象值，布尔开关被丢掉、按默认重开，再把整张表改写成对象表写回 taxesEnabled；
//       级联征税的过滤只认 === false，于是永远放行。getFiscalConfig 又是整字段覆盖，GM 层对象表把 P/剧本里的布尔开关整张盖掉。
//   根治：布尔开关整理时保留为 authorDisabled；getFiscalConfig 按层单独收集作者开关；过滤按 id、标签、国库大类三层认；
//         标签归类表收进 FiscalStatement，国库册页与征税过滤共用。朝代推断出的 enabled:false 不算作者开关。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
const clone = v => JSON.parse(JSON.stringify(v));
function makeSandbox(files) {
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    Math, Date, JSON, RegExp, Error, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
    setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; }, clearTimeout() {}, addEB() {}, toast() {},
    GM: null, P: {}
  };
  sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
  sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
  sandbox.IntegrationBridge = {
    getLeafDivisions(adminHierarchy) {
      const out = [];
      (function walk(nodes) {
        (Array.isArray(nodes) ? nodes : []).forEach(node => {
          if (!node || typeof node !== 'object') return;
          const kids = node.children || node.divisions || node.subs || [];
          if (kids.length) walk(kids); else out.push(node);
        });
      })(Object.keys(adminHierarchy || {}).map(k => (adminHierarchy[k] || {}).divisions || []).flat());
      return out;
    }
  };
  vm.createContext(sandbox);
  files.forEach(name => vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), sandbox, { filename: name }));
  return sandbox;
}
const ENGINE = ['tm-patches-start.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js'];
function catalogIds(sb) { return sb.FiscalEngine.taxPolicyCatalog(sb.GM).map(t => t.id); }
function tax(id, sourceTag) { return { id, name: id, base: 'arableLand', baseFactor: 1, rate: 0.01, storeAs: 'money', sourceTag, annual: true }; }
const LIST = [tax('land', 'tianfu'), tax('salt', 'salt_iron'), tax('yk', 'yanke'), tax('tea', 'chake'), tax('sea', 'maritime'), tax('zongzhi', 'jingzongzhi')];

console.log('[smoke-tax-switch-author-intent]');

{ // ① 整理税表：作者的布尔开关保留为 authorDisabled；作者打开的也算数；朝代推断的关不带标记
  const sb = makeSandbox(ENGINE);
  sb.GM = { turn: 3, dynasty: '明', fiscalConfig: { taxesEnabled: { yanlizhuan: false, juanNa: true } } };
  const result = sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  ok(result.yanlizhuan.enabled === false && result.yanlizhuan.authorDisabled === true, '作者关掉的盐利整理后仍是关，并带 authorDisabled');
  ok(result.tianfu.enabled === true && !result.tianfu.authorDisabled, '作者没动的田赋照旧开');
  ok(result.juanNa.enabled === true, '作者明确打开的捐纳压过默认关');
  ok(sb.GM.fiscalConfig.taxesEnabled === result, '整理结果照旧写回 taxesEnabled（形态不变，只多了标记）');
  const again = sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  ok(again.yanlizhuan.enabled === false && again.yanlizhuan.authorDisabled === true, '再整理一次（读档重跑）作者开关不丢');
  const tang = makeSandbox(ENGINE);
  tang.GM = { turn: 3, dynasty: '唐', fiscalConfig: {} };
  const tangResult = tang.FiscalEngine.enableTaxesByDynasty(tang.GM);
  ok(tangResult.shipaiShui.enabled === false && !tangResult.shipaiShui.authorDisabled, '唐代市舶按朝代表推断为关，但不是作者开关');
}

{ // ② 级联征税过滤：按 id、标签、国库大类三层认作者的「关」
  const sb = makeSandbox(ENGINE);
  sb.GM = { turn: 3, dynasty: '宋', fiscalConfig: { taxList: clone(LIST), taxesEnabled: { yanlizhuan: false } } };
  sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  ok(JSON.stringify(catalogIds(sb)) === JSON.stringify(['land', 'tea', 'sea', 'zongzhi']), '关掉盐利后 salt_iron 与 yanke 两个标签都不再征（修前全部照征）');
  sb.GM.fiscalConfig = { taxList: clone(LIST), taxesEnabled: { quanShui: false, tea: true } };
  ok(JSON.stringify(catalogIds(sb)) === JSON.stringify(['land', 'salt', 'yk', 'sea', 'zongzhi']), '关掉榷税后茶课按大类归入榷税被停征');
  sb.GM.fiscalConfig = { taxList: clone(LIST), taxesEnabled: { qita: false } };
  ok(JSON.stringify(catalogIds(sb)) === JSON.stringify(['land', 'salt', 'yk', 'tea', 'sea']), '关掉其他杂税后，国库册页归入「其他」的经总制钱一并停征');
  sb.GM.fiscalConfig = { taxList: clone(LIST), taxesEnabled: { salt: false } };
  ok(catalogIds(sb).indexOf('salt') < 0 && catalogIds(sb).indexOf('yk') >= 0, '按税种 id 单独关一项仍然有效');
}

{ // ③ 朝代推断的关不误伤作者明写的税表（官方晚唐明写市舶）
  const sb = makeSandbox(ENGINE);
  sb.GM = { turn: 3, dynasty: '唐', fiscalConfig: { taxList: clone(LIST) } };
  sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  ok(catalogIds(sb).length === LIST.length, '没有作者开关时，朝代表推断的关一项也不过滤');
}

{ // ④ 旧档自愈：GM 层早被旧代码整理成无标记对象表，P 里作者的布尔开关仍在
  const sb = makeSandbox(ENGINE);
  sb.GM = { turn: 40, dynasty: '宋', fiscalConfig: { taxList: clone(LIST), taxesEnabled: { yanlizhuan: { enabled: true, name: '盐利专卖' }, tianfu: { enabled: true } } } };
  sb.P = { fiscalConfig: { taxesEnabled: { yanlizhuan: false } } };
  ok(catalogIds(sb).indexOf('salt') < 0 && catalogIds(sb).indexOf('yk') < 0, '旧档：GM 层对象表不再把 P 里作者关掉的盐利盖掉');
  // getFiscalConfig 不对外导出，只随 helpers 交给 FiscalStatement.previewRevenue；临时接住那一下取来核对
  let helpers = null;
  const realPreview = sb.FiscalStatement.previewRevenue;
  sb.FiscalStatement.previewRevenue = (_opts, h) => { helpers = h; return null; };
  sb.CascadeTax.previewRevenue({ game: sb.GM, faction: 'player' });
  sb.FiscalStatement.previewRevenue = realPreview;
  const cfg = helpers && helpers.getFiscalConfig ? helpers.getFiscalConfig(sb.GM) : null;
  ok(!!cfg, '取到 getFiscalConfig 的合并结果');
  if (cfg) {
    ok(Object.keys(cfg).indexOf('_taxSwitches') < 0 && JSON.stringify(cfg).indexOf('_taxSwitches') < 0, '收集出的开关表不可枚举，不进快照与存档');
    ok(cfg._taxSwitches && cfg._taxSwitches.yanlizhuan === false, '收集出的开关表认得 P 层布尔开关');
  }
}

{ // ⑤ 端到端：作者关掉田赋，一回合征收确实一文不进
  function leaf(id) {
    return { id, name: id, minxin: 60, minxinLocal: 60, population: 100000,
      populationDetail: { households: 20000, mouths: 100000, ding: 40000, hiddenCount: 0, fugitives: 0 },
      fiscalDetail: { claimedRevenue: 200000, actualRevenue: 180000, remittedToCenter: 120000, skimmingRate: 0.1 },
      economyBase: { farmland: 1000000 }, corruptionLocal: 30, minxinDetails: { trueIndex: 60 } };
  }
  function run(taxesEnabled) {
    const sb = makeSandbox(ENGINE);
    sb.GM = { turn: 1, dynasty: '明', guoku: { money: 100000, grain: 80000 }, military: { reserves: 6000 },
      corruption: { trueIndex: 40, perceivedIndex: 40, subDepts: { provincial: { true: 40 } } },
      minxin: { trueIndex: 60, perceivedIndex: 60, byRegion: {}, byClass: {}, sources: {} }, classes: [],
      adminHierarchy: { player: { divisions: [leaf('a'), leaf('b')] } },
      // 用 taxList：enableTaxesByDynasty 会把 taxes 数组改写成原子税对象表，征收随之退回默认税表（既有行为，与本案无关）
      fiscalConfig: Object.assign({ taxList: [tax('land', 'tianfu')] }, taxesEnabled ? { taxesEnabled } : {}) };
    sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
    const before = Number(sb.GM.guoku.money) || 0;
    sb.CascadeTax.collect({ faction: 'player', turnDays: 30, force: true });
    return (Number(sb.GM.guoku.money) || 0) - before;
  }
  const control = run(null), disabled = run({ tianfu: false });
  ok(control > 0, '对照：田赋开着时本回合国库有进项（' + Math.round(control) + '）');
  ok(disabled === 0, '作者关掉田赋后本回合国库进项为 0（修前与对照相同）');
}

{ // ⑥ 官方剧本不受影响：天启只关了本来就默认关、税表里也没有的捐纳；晚唐、绍宋没写开关
  [['天启七年·九月（官方）.json', '明'], ['晚唐·开成五年（官方）.json', '唐'], ['绍宋·建炎元年八月（官方）.json', '宋']].forEach(([file, dynasty]) => {
    const scenario = JSON.parse(fs.readFileSync(path.join(REPO, 'scenarios', file), 'utf8'));
    const sb = makeSandbox(ENGINE);
    sb.GM = { turn: 1, dynasty, fiscalConfig: clone(scenario.fiscalConfig) };
    sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
    const ids = catalogIds(sb);  // 目录 = 税表 + 剧本自定义税（天启另有 4 项），这里只核税表本身一项不少
    ok(scenario.fiscalConfig.taxList.every(t => ids.indexOf(t.id) >= 0), file + '：税表 ' + scenario.fiscalConfig.taxList.length + ' 项一项不少');
  });
}

{ // ⑦ 国库册页与征税过滤共用同一张归类表
  const sb = makeSandbox(['tm-fiscal-statements.js', 'tm-guoku-engine.js']);
  sb.GM = { turn: 12 };
  const FS = sb.FiscalStatement, revenueKeys = Object.keys(sb.GuokuEngine.Sources).sort();
  ok(JSON.stringify(Object.keys(FS.labels('central', 'in')).sort()) === JSON.stringify(revenueKeys), '报表模块的收入大类与国库税源键一一对应');
  ok(revenueKeys.every(k => FS.taxCategory(k) === k), '每个国库大类归到自己');
  ok(FS.taxCategory('salt_iron') === 'yanlizhuan' && FS.taxCategory('chake') === 'quanShui' && FS.taxCategory('jingzongzhi') === 'qita' && FS.taxCategory(undefined) === 'qita', '标签按别名归类，未知标签归「其他」');
  const guokuSrc = fs.readFileSync(path.join(ROOT, 'tm-guoku-engine.js'), 'utf8');
  ok(!/var aliases = \{tianfu_money:/.test(guokuSrc) && /FiscalStatement\.taxCategory\(t\.sourceTag\)/.test(guokuSrc), '国库新税表分支不再自带一份归类表');
  sb.GuokuEngine.ensureModel();
  sb.P = { fiscalConfig: { taxesEnabled: {} } };
  const base = sb.GuokuEngine.Sources.yanlizhuan();
  sb.P.fiscalConfig.taxesEnabled = { yanlizhuan: { enabled: false, authorDisabled: true } };
  ok(base > 0 && sb.GuokuEngine.Sources.yanlizhuan() === 0, '国库旧税表分支认整理后的 authorDisabled（盐利 ' + Math.round(base) + ' → 0）');
  sb.P.fiscalConfig.taxesEnabled = { yanlizhuan: { enabled: false } };
  ok(sb.GuokuEngine.Sources.yanlizhuan() === base, '国库旧税表分支不把朝代推断的关当作者开关');
  sb.P.fiscalConfig.taxesEnabled = { yanlizhuan: false };
  ok(sb.GuokuEngine.Sources.yanlizhuan() === 0, '国库旧税表分支照旧认布尔开关');
}

{ // ⑧ 复审补（Astra 6）：自定义税同受开关约束（按 id、标签、国库大类），原来在过滤之后才追加
  const sb = makeSandbox(ENGINE);
  const custom = [{ id: 'custom-salt', name: '盐引附加', formulaType: 'perMu', rate: 0.03, sourceTag: 'salt_iron' }, { id: 'custom-cha', name: '茶马附加', formulaType: 'perMu', rate: 0.01, sourceTag: 'chake' }];
  sb.GM = { turn: 3, dynasty: '宋', fiscalConfig: { taxList: clone(LIST), customTaxes: clone(custom), taxesEnabled: { yanlizhuan: false } } };
  sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  const ids = catalogIds(sb);
  ok(ids.indexOf('custom-salt') < 0 && ids.indexOf('custom-cha') >= 0, '关掉盐利后标为 salt_iron 的自定义税一并停征，茶类自定义税照征');
  sb.GM.fiscalConfig.taxesEnabled = { 'custom-cha': false };
  ok(catalogIds(sb).indexOf('custom-cha') < 0 && catalogIds(sb).indexOf('custom-salt') >= 0, '按 id 单独关掉一项自定义税有效');
}

{ // ⑨ 复审补（Astra 6·本批新增回归）：作者显式「开」整理后仍压过下层的「关」
  const sb = makeSandbox(ENGINE);
  sb.P = { fiscalConfig: { taxesEnabled: { yanlizhuan: false } } };
  sb.GM = { turn: 3, dynasty: '宋', fiscalConfig: { taxList: clone(LIST), taxesEnabled: { yanlizhuan: true } } };
  const before = catalogIds(sb);
  sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  const after = catalogIds(sb);
  sb.FiscalEngine.enableTaxesByDynasty(sb.GM);
  ok(before.indexOf('salt') >= 0 && after.indexOf('salt') >= 0 && catalogIds(sb).indexOf('salt') >= 0, 'GM 层显式开启盐利：整理前、整理后、再整理一次，目录都保留盐税');
  ok(sb.GM.fiscalConfig.taxesEnabled.yanlizhuan.authorEnabled === true, '整理后的对象带 authorEnabled 标记');
}

{ // ⑩ 复审补（Astra 6）：国库旧税表分支与征税过滤同一套分层开关，空的上层配置不再遮住下层
  const sb = makeSandbox(['tm-patches-start.js', 'tm-guoku-engine.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js']);
  sb.GM = { turn: 12, fiscalConfig: { taxesEnabled: { yanlizhuan: { enabled: false, authorDisabled: true } } } };
  sb.GuokuEngine.ensureModel();
  sb.P = { fiscalConfig: {} };
  ok(sb.GuokuEngine.Sources.yanlizhuan() === 0, 'GM 层作者关掉盐利、P 层是空配置：国库旧分支盐利为 0（原来 250000）');
  sb.GM.fiscalConfig.taxesEnabled = {};
  ok(sb.GuokuEngine.Sources.yanlizhuan() > 0, '对照：没有开关时盐利照常');
  const lone = makeSandbox(['tm-fiscal-statements.js', 'tm-guoku-engine.js']);  // 不装财政引擎时走兜底：P / 旧配置 → GM 两层合并
  lone.GM = { turn: 12, fiscalConfig: { taxesEnabled: { yanlizhuan: { enabled: false, authorDisabled: true } } } };
  lone.GuokuEngine.ensureModel();
  lone.P = { fiscalConfig: {} };
  ok(lone.GuokuEngine.Sources.yanlizhuan() === 0, '不装财政引擎的兜底分支同样不被空的 P 配置遮住');
}

{ // ⑪ 二次复审（Astra 6·R2-4）：旧档（P 有生产税版本、GM 没有）按旧税配置的开关，装不装财政引擎结果一致
  const WITH = ['tm-patches-start.js', 'tm-guoku-engine.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js'], LONE = ['tm-fiscal-statements.js', 'tm-guoku-engine.js'];
  const legacy = (files, outer, inner) => {
    const sb = makeSandbox(files);
    sb.P = { fiscalConfig: { productionTaxVersion: 1, taxesEnabled: outer, legacyTaxConfig: { taxesEnabled: inner } } };
    sb.GM = { turn: 12, fiscalConfig: {} };
    sb.GuokuEngine.ensureModel();
    return sb.GuokuEngine.Sources.yanlizhuan();
  };
  ok(legacy(WITH, {}, { yanlizhuan: false }) === 0 && legacy(LONE, {}, { yanlizhuan: false }) === 0, '旧档的旧税配置关掉盐利：装不装财政引擎都是 0（原来装上引擎变 250000）');
  const on = legacy(WITH, { yanlizhuan: false }, { yanlizhuan: true });
  ok(on > 0 && on === legacy(LONE, { yanlizhuan: false }, { yanlizhuan: true }), '旧档的旧税配置开着、新模板外层关着：照旧配置征收，两条路一致（' + Math.round(on) + '）');
}

{ // ⑫ 三次复审（Astra 6·R3-5）：旧档作者开关也认 factionOverrides；不带生产税版本的 P 层本身是旧格式，照样生效
  const WITH = ['tm-patches-start.js', 'tm-guoku-engine.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js'];
  const run = (pCfg, gmCfg, scCfg) => {
    const sb = makeSandbox(WITH);
    sb.P = { fiscalConfig: pCfg };
    sb.GM = { turn: 12, sid: 'legacy-case', fiscalConfig: gmCfg, playerInfo: { factionId: 'own' }, facs: [{ id: 'own', name: '本朝' }] };
    if (scCfg) sb.findScenarioById = () => ({ fiscalConfig: scCfg });
    sb.GuokuEngine.ensureModel();
    return sb.GuokuEngine.Sources.yanlizhuan();
  };
  const legacyOn = { productionTaxVersion: 1, legacyTaxConfig: { taxesEnabled: { yanlizhuan: true } } }, legacyOff = { productionTaxVersion: 1, legacyTaxConfig: { taxesEnabled: { yanlizhuan: false } } };
  ok(run(legacyOn, { factionOverrides: { own: { taxesEnabled: { yanlizhuan: false } } } }) === 0, '旧档：旧税配置开、本方势力覆盖关 → 盐利 0（原来覆盖层被丢、照征 250000）');
  ok(run(legacyOff, { factionOverrides: { own: { taxesEnabled: { yanlizhuan: true } } } }) > 0, '旧档：旧税配置关、本方势力覆盖开 → 照征');
  ok(run({ taxesEnabled: { yanlizhuan: false } }, {}, legacyOn) === 0, '旧档：剧本层带旧税配置（开），P 层不带生产税版本、本身就是旧格式（关）→ P 层优先，盐利 0');
}

console.log('\n[smoke-tax-switch-author-intent] ' + pass + ' passed / ' + fail + ' failed');
if (fail) process.exit(1);
