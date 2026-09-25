// 在 VM 里真开官方剧本，开局后按一年（360 天）强制征一次税，输出玩家势力分税目的应纳、实收与中央/地方分成。
// 用来比较剧本数据改动前后运行时的财政松紧。
// 用法：node fiscal-probe.js <sid> <剧本 json 路径> <输出 json>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKTREE = process.env.TM_AUDIT_WORKTREE || path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(WORKTREE, 'web/scripts');
const HELPER_FILE = path.join(SCRIPTS_DIR, 'smoke-start-game-data-integrity.js');

const [sid, scenarioFile, outFile] = process.argv.slice(2);
if (!sid || !scenarioFile || !outFile) {
  console.error('用法：node fiscal-probe.js <sid> <剧本 json 路径> <输出 json>');
  process.exit(2);
}

function loadHelpers() {
  const text = fs.readFileSync(HELPER_FILE, 'utf8').replace(/^#![^\n]*\n/, '');
  const end = text.indexOf('(async function main()');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
    text.slice(0, end) + '\nreturn { loadGame };');
  return factory(require, process, SCRIPTS_DIR, HELPER_FILE, { exports: {} }, {});
}

(async function main() {
  const context = loadHelpers().loadGame(null);
  context.__source = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
  vm.runInContext(
    'P.scenarios=(P.scenarios||[]).filter(function(s){return s.id!==__source.id;});' +
    'P.scenarios.push(__source); P.ai.key=""; P.ai.url=""; P.ai.model="";', context);
  vm.runInContext('doActualStart(' + JSON.stringify(sid) + ')', context, { timeout: 600000 });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const result = vm.runInContext(`(function(){
    var before = { money: GM.guoku && GM.guoku.money, grain: GM.guoku && GM.guoku.grain, cloth: GM.guoku && GM.guoku.cloth };
    var r = CascadeTax.collect({ force: true, turnDays: 360 });
    var after = { money: GM.guoku && GM.guoku.money, grain: GM.guoku && GM.guoku.grain, cloth: GM.guoku && GM.guoku.cloth };
    return JSON.stringify({ before: before, after: after, result: r, summary: GM._lastCascadeSummary || null });
  })()`, context, { timeout: 600000 });
  fs.writeFileSync(outFile, JSON.stringify(JSON.parse(result), null, 1));
  console.log(result.slice(0, 1500));
  process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
