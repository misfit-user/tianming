import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-start-game-data-integrity.js',(s,r)=>{
 s=r(s,'function loadGame() {','function loadGame(selectedSid = SID) {');
 s=r(s,'  const scripts = helpers.parseIndexHtmlScripts();','  const scripts = helpers.parseIndexHtmlScripts({ includeLazyScenarios: false });');
 return r(s,'  const loadScripts = cutoff >= 0 ? scripts.slice(0, cutoff) : scripts;',`  const loadScripts = cutoff >= 0 ? scripts.slice(0, cutoff) : scripts;
  // A browser lazy-loads the complete selected world, not every unrelated official scenario.
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'bundled-scenarios/manifest.json'), 'utf8'));
  const selected = catalog.entries.find(entry => entry.id === selectedSid);
  assert(selected && selected.scriptUrl, 'selected official scenario is required');
  const data = fs.readFileSync(path.join(ROOT, selected.scriptUrl));
  assert(data.length === selected.bytes && require('crypto').createHash('sha256').update(data).digest('hex') === selected.sha256, 'entire selected scenario must match its pinned source');
  if (!loadScripts.includes(selected.scriptUrl)) loadScripts.push(selected.scriptUrl);`);
});
edit('web/scripts/smoke-tang840-opening-ledgers.js',(s,r)=>r(s,'const c=h.loadGame(),sc=',"const c=h.loadGame('sc-tang840-840'),sc="));
edit('web/scripts/smoke-perf-save-preparation.js',(s,r)=>{
 s=r(s,"const assert = require('assert/strict'), path = require('path');","const assert = require('assert/strict'), path = require('path'), fs = require('fs'), cp = require('child_process');");
 const anchor="let passed = 0, failed = 0;";
 s=r(s,anchor,`const names = ['绍宋·建炎元年八月（官方）.json', '天启七年·九月（官方）.json'];
const caseAt = process.argv.indexOf('--case'), selectedCase = caseAt < 0 ? null : Number(process.argv[caseAt + 1]);
if (selectedCase === null) {
  let passed = 0, failed = 0;
  for (let i = 0; i < 5; i++) {
    const child = cp.spawnSync(process.execPath, [__filename, '--repo', root, '--case', String(i)], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    process.stdout.write(child.stdout || ''); process.stderr.write(child.stderr || '');
    const result = (child.stdout || '').trim().split(/\\r?\\n/).filter(line => line.startsWith('{')).map(line => { try { return JSON.parse(line); } catch (_) { return null; } }).filter(Boolean).at(-1);
    if (child.status !== 0 || !result) failed++; if (result) { passed += result.passed; failed += result.failed; }
  }
  assert.equal(passed, 13, 'both full official scenarios, short/long history, both formats, restore and failure checks must all execute');
  console.log(JSON.stringify({ passed, failed, isolatedCases: 5 })); process.exit(failed ? 1 : 0);
}
assert(Number.isInteger(selectedCase) && selectedCase >= 0 && selectedCase < 5);
function scenario(index) { return { name: names[index], data: JSON.parse(fs.readFileSync(path.join(root, 'scenarios', names[index]), 'utf8')) }; }
${anchor}`);
 s=r(s,'for (const s of officialScenarios(root)) for (const long of [false, true]) {','for (const s of (selectedCase < 4 ? [scenario(Math.floor(selectedCase / 2))] : [])) for (const long of [selectedCase % 2 === 1]) {');
 s=r(s,"check('normalization failure rejects without changing live; subsequent valid world recovers',", "if (selectedCase === 4) check('normalization failure rejects without changing live; subsequent valid world recovers',");
 return r(s,'controlledWorld(officialScenarios(root)[0].data)','controlledWorld(scenario(0).data)');
});
