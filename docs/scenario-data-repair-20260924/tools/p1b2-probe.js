// VM 真开局，沿真实 CascadeTax.collect 征 360 天；不运行 AI、人口推演、战争或支出。
// node tools/p1b2-probe.js tianqi|shaosong|tang <报告.json> [--baseline <git ref>]
// 探针只在 VM 中插入观察钩子，记录 legacy 税目分账；运行时代码不导出调试 API。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const SCENARIOS = { tianqi: '天启七年·九月（官方）.json', shaosong: '绍宋·建炎元年八月（官方）.json', tang: '晚唐·开成五年（官方）.json' };
const FIELDS = ['saltProduction', 'saltOutput', 'mineralProduction', 'horseProduction', 'fishingProduction', 'maritimeTradeVolume', 'imperialFarmland'];
function read(rel, ref) {
  return ref ? execFileSync('git', ['show', ref + ':' + rel], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 }).toString('utf8') : fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function helpers() {
  const dir = path.join(ROOT, 'web/scripts'), file = path.join(dir, 'smoke-start-game-data-integrity.js');
  const text = fs.readFileSync(file, 'utf8').replace(/^#![^\n]*\n/, '');
  return new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
    text.slice(0, text.indexOf('(async function main()')) + '\nreturn { loadGame, disposeGame };')
    (require, process, dir, file, { exports: {} }, {});
}
function production(tree) {
  const sums = Object.fromEntries(FIELDS.map(k => [k, 0])), missing = Object.fromEntries(FIELDS.map(k => [k, 0]));
  (function walk(nodes) { for (const d of nodes || []) {
    if (d.children && d.children.length) walk(d.children);
    else for (const k of FIELDS) { if (typeof (d.economyBase || {})[k] === 'number') sums[k] += d.economyBase[k]; else missing[k]++; }
  } })(tree.divisions);
  return { sums, missing };
}
function authoredValues(tree) {
  const out = new Map();
  (function walk(nodes) { for (const d of nodes || []) {
    if (d.children && d.children.length) walk(d.children);
    else out.set(d.id, { name: d.name, values: Object.fromEntries(FIELDS.filter(k => typeof (d.economyBase || {})[k] === 'number').map(k => [k, d.economyBase[k]])) });
  } })(tree.divisions);
  return out;
}
async function probe(key, out, ref) {
  if (!SCENARIOS[key] || !out) throw Error('需要剧本键与输出文件');
  const source = JSON.parse(read('scenarios/' + SCENARIOS[key], ref));
  const sourceProduction = production(source.adminHierarchy.player), authored = authoredValues(source.adminHierarchy.player);
  const h = helpers(), context = h.loadGame(null);
  // 使用每次相同的随机序列；仅约束开局生成，不改财政函数。
  vm.runInContext('var __seed=840; Math.random=function(){__seed=(Math.imul(__seed,1664525)+1013904223)>>>0;return __seed/4294967296;};', context);
  let code = read('web/tm-fiscal-engine.js', ref);
  const hook = 'var split = splitCascadeAmount(div, tax, amount, ctx);';
  if (code.split(hook).length !== 2) throw Error('财政观察点不唯一');
  code = code.replace(hook, hook + '\nif(global.__p1b2Rows) global.__p1b2Rows.push({id:tax.id,name:tax.name,base:tax.base,resource:storeAs,nominal:taxBase(div,tax)*safeNumber(tax.baseFactor,1)*safeNumber(tax.rate,0)*(tax.annual?ctx.turnFracOfYear:1),assessed:amount,central:split.toCentral,local:split.cunliu,skimmed:split.skimmed,transit:split.lostInTransit});');
  vm.runInContext(code, context);
  context.__source = source;
  vm.runInContext('P.scenarios=(P.scenarios||[]).filter(function(s){return s.id!==__source.id;});P.scenarios.push(__source);P.ai.key="";P.ai.url="";P.ai.model="";', context);
  vm.runInContext('doActualStart(' + JSON.stringify(source.id) + ')', context, { timeout: 600000 });
  await new Promise(resolve => setTimeout(resolve, 2500));
  if (!context.__entered || context.GM.sid !== source.id) throw Error('未完成真实开局');
  const opening = production(context.GM.adminHierarchy.player);
  const loaded = authoredValues(context.GM.adminHierarchy.player), retention = { compared: 0, mismatches: [] };
  for (const [id, d] of authored) for (const [field, value] of Object.entries(d.values)) {
    retention.compared++;
    const actual = loaded.get(id) && loaded.get(id).values[field];
    if (actual !== value) retention.mismatches.push({ id, name: d.name, field, authored: value, opening: actual });
  }
  if (!ref && retention.mismatches.length) throw Error('开局仍改写剧本产量：' + JSON.stringify(retention.mismatches.slice(0,5)));
  const result = vm.runInContext('(function(){window.__p1b2Rows=[];var r=CascadeTax.collect({force:true,turnDays:360});return JSON.stringify({ok:r.ok,totals:r.totals,rows:r.budget?r.budget.regions.reduce(function(a,x){return a.concat(x.taxes);},[]):window.__p1b2Rows});})()', context, { timeout: 600000 });
  const parsed = JSON.parse(result); if (!parsed.ok) throw Error('未实际征收');
  const taxes = {};
  for (const r of parsed.rows) {
    const t = taxes[r.id] || (taxes[r.id] = { name: r.name, base: r.base, resource: r.resource, nominal: 0, central: 0, local: 0, skimmed: 0, transit: 0 });
    for (const k of ['nominal', 'central', 'local', 'skimmed', 'transit']) t[k] += r[k] || 0;
  }
  for (const t of Object.values(taxes)) for (const k of ['nominal', 'central', 'local', 'skimmed', 'transit']) t[k] = Math.round(t[k] * 1e4) / 1e4;
  const report = { scenario: source.id, sourceRef: ref || 'working-tree', method: 'doActualStart + CascadeTax.collect(force,360 days); fiscal-only; legacy year=365, ledger/2 year=360; excludes AI, demographic evolution and spending',
    unit: source.fiscalConfig.unit, sourceProduction, openingProduction: opening, authoredRetention: retention,
    settledProduction: production(context.GM.adminHierarchy.player), taxes, central: parsed.totals.central, local: parsed.totals.localRetain };
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log('PASS ' + key + ': ' + Object.keys(taxes).length + ' taxes; ' + out);
  // loadGame's timers are captured internally; terminate this standalone audit process below.
  return report;
}
if (require.main === module) {
  const args = process.argv.slice(2), i = args.indexOf('--baseline');
  probe(args[0], args[1], i >= 0 ? args[i + 1] : null).then(() => process.exit(0)).catch(e => { console.error(e.stack); process.exit(1); });
}
module.exports = { probe, production };
