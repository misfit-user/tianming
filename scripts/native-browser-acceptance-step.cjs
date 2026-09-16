'use strict';
// CLI-driven, isolated browser acceptance. Does not connect to a player's profile
// or configure/call any provider. UI clicks are recorded separately from setup.
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  phase = process.argv[2],
  out = path.join(root, 'output/playwright/native-workbench'),
  cli =
    process.env.TM_BROWSER_CLI ||
    path.join(process.env.APPDATA || '', 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe');
const source = require('./electron/native-start-entry-cases.cjs').world();
const downloadDir=path.resolve(root,process.argv[3]||'output/playwright/downloads');
assert(downloadDir.startsWith(path.join(root,'output/playwright')+path.sep),'Browser downloads must remain in isolated acceptance output');
const expressions = {
  prepare: `(async()=>{await TMOfficialScenarioLoader.ready();const source=${JSON.stringify(source)};P.scenarios.push(source);window.__nativeBrowserSource=JSON.stringify(source);await startGame(source.id);return{phase:TM.NativeStart.status().phase,bridge:typeof window.tianming,keyPresent:!!P.ai?.key};})()`,
  'verify-start': `(async()=>{const end=Date.now()+45000;while(TM.NativeStart.status().phase!=='idle'){if(Date.now()>end||TM.NativeStart.status().phase==='failed')throw Error(document.querySelector('.tm-ns-status')?.textContent||'start timed out');await new Promise(r=>setTimeout(r,50));}const saved=await TM_SaveDB.load('autosave');return{profile:GM.startContext.startProfileId,character:GM.playerCharacterId,foreign:GM.nativeWorld.classes.some(c=>c.id==='class-a'),saved:saved.gameState.GM.startContext.startProfileId,sourceUnchanged:JSON.stringify(P.scenarios.find(s=>s.id==='synthetic-world'))===__nativeBrowserSource,bridge:typeof window.tianming};})()`,
  'verify-reload': `(async()=>{await TMOfficialScenarioLoader.ready();const saved=await TM_SaveDB.load('autosave');await fullLoadGame({gameState:saved.gameState},{source:'browser-native-acceptance',preserveTimeline:true});return{profile:GM.startContext.startProfileId,character:GM.playerCharacterId,foreign:GM.nativeWorld.classes.some(c=>c.id==='class-a'),mapRegions:GM.mapData.regions.length};})()`,
  'prepare-export': `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP;a.applyImportedScenario(${JSON.stringify(source)},'浏览器隔离验收');await a.saveProjectSnapshot('浏览器隔离验收');TM.WorkbenchUI.open();Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:undefined});return{projectId:a.state.currentProjectId,bridge:typeof window.tianming,filePickerCapability:'deliberately unavailable to exercise Blob fallback'};})()`,
  'verify-download': `(async()=>{const pid=TM_SCENARIO_EDITOR_RESET_APP.state.currentProjectId,assets=await TM.ProjectAssets.listAssets(pid),zip=assets.find(a=>a.format==='zip');if(!zip)throw Error('generated ZIP missing');return{status:document.querySelector('[data-wb-status]').textContent,result:document.querySelector('[data-wb-result]').textContent,asset:zip,validation:await TM.WorkbenchArtifacts.validate(pid,zip.assetId)};})()`,
};
assert(expressions[phase], 'unknown acceptance step');
fs.mkdirSync(out, { recursive: true });
const run = cp.spawnSync(
  cli,
  ['--session', 'native-workbench-915', '--json', 'eval', '-b', Buffer.from(expressions[phase]).toString('base64')],
  {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const report = {
  phase,
  at: new Date().toISOString(),
  realApiCalls: 0,
  sourceHash: crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex'),
  command: ['agent-browser', '--session', 'native-workbench-915', '--json', 'eval', '<expressions in this script>'],
  exitCode: run.status,
  signal: run.signal,
  error: run.error?.message || null,
  output: run.stdout,
  stderr: run.stderr,
  ok: false,
};
try {
  assert.equal(run.status, 0);
  assert(!run.signal && !run.error);
  const json = JSON.parse(run.stdout);
  assert(json.success, run.stdout);
  const r = json.data.result;
  if (phase === 'prepare') {
    assert.equal(r.phase, 'choosing');
    assert.equal(r.bridge, 'undefined');
    assert(!r.keyPresent);
  }
  if (phase === 'verify-start' || phase === 'verify-reload') {
    assert.equal(r.profile, 'pb');
    assert.equal(r.character, 'cb');
    assert(r.foreign);
    if (phase === 'verify-start') {
      assert.equal(r.saved, 'pb');
      assert(r.sourceUnchanged);
      assert.equal(r.bridge, 'undefined');
    } else assert.equal(r.mapRegions, 3);
  }
  if (phase === 'verify-download') {
    assert(r.validation.ok);
    assert.match(r.result, /handed-to-browser-download/);
    assert.match(r.result, /已交给浏览器下载，不能保证用户已保存/);
    const file = path.join(downloadDir, r.asset.filename);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.length, r.validation.byteLength);
    report.downloadSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(report.downloadSha256, r.validation.contentHash);
    report.downloadPath = path.relative(root, file).replace(/\\/g, '/');
  }
  report.ok = true;
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
}
const outputFile = path.join(out, phase + '.json');
if (fs.existsSync(outputFile)) fs.copyFileSync(outputFile, path.join(out, phase + '.previous-' + Date.now() + '.json'));
fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
