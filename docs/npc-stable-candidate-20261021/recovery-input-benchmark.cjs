'use strict';
// Optional-response-recovery microbenchmark, not an Electron/gameplay gate.
// Each measurement gets a fresh Node process; native GC runs before timing.
// Prints fresh results to stdout and never overwrites the retained JSON report.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const baseline = '7c6525075d3f07ab435562e21a8d3d74c0e9b413';
const runtimeFile = 'web/tm-endturn-response-recovery.js';
const currentHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, runtimeFile))).digest('hex');
const child = String.raw`
const cp=require('node:child_process'),vm=require('node:vm');
const {fixture}=require('./web/scripts/lib-turn-response-recovery');
const mode=process.argv[1],kind=process.argv[2],baseline=process.argv[3],f=fixture();
if(mode==='old'){
  delete f.c.TM.Endturn.ResponseRecovery;
  vm.runInContext(cp.execFileSync('git',['show',baseline+':web/tm-endturn-response-recovery.js'],{encoding:'utf8'}),f.c,{filename:'baseline:tm-endturn-response-recovery.js'});
}
const R=f.c.TM.Endturn.ResponseRecovery,txn=f.capture();let tailVisits=0;
const count=kind==='small-numbers'?100000:kind==='large-numbers'?8000000:96000000;
txn.gm.data.large={values:kind==='large-string'?'x'.repeat(count):new Array(count).fill(1234567890.125),tail:{toJSON(){tailVisits++;return 'tail';}}};
if(global.gc)global.gc();const before=process.memoryUsage(),t=process.hrtime.bigint();
R.begin(txn,{}).then(ok=>{
  const after=process.memoryUsage();
  console.log(JSON.stringify({mode,kind,count,ok,state:R.status(),tailVisits,elapsedMs:Number(process.hrtime.bigint()-t)/1e6,heapBefore:before.heapUsed,heapAfter:after.heapUsed,rssBefore:before.rss,rssAfter:after.rss,peakRssKB:process.resourceUsage().maxRSS,node:process.version}));
  f.dispose();
}).catch(e=>{console.error(e);f.dispose();process.exitCode=1;});
`;
const results = [];
for (const kind of ['small-numbers', 'large-numbers', 'large-string']) {
  for (const mode of ['old', 'new']) {
    const run = cp.spawnSync(process.execPath, ['--expose-gc', '-e', child, mode, kind, baseline], {
      cwd: root, encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 2 * 1024 * 1024
    });
    if (run.status !== 0) throw new Error('Benchmark failed: ' + mode + '/' + kind + '\n' + (run.stderr || '') + (run.stdout || ''));
    results.push(JSON.parse(run.stdout.trim()));
  }
}
process.stdout.write(JSON.stringify({
  scope: 'Optional recovery fingerprint only; not official gameplay, Electron OOM or full-world acceptance.',
  baseline, runtimeFile, currentHash, node: process.version, platform: process.platform,
  limitChars: 32000000,
  memoryNotes: 'heap and rss are bytes at the measured boundary; peakRssKB is the whole isolated child-process high-water mark, including fixture/input setup.',
  results
}, null, 2) + '\n');
