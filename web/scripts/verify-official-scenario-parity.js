#!/usr/bin/env node
// Memory-bounded parity gate for every official-scenario consumer.
// sync({check:true}) first byte-compares every derived artifact against the
// root JSON serializer; the assertions below also verify each consumer shape
// and the loader manifest's content-addressed contract.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const syncer = require('./sync-official-scenarios.js');
const { serializeScenarioExpression } = require('./official-scenario-expression.js');
const { spawnSync } = require('child_process');

let assertions = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  assertions++;
  console.log('  ok·' + label);
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function main() {
  // One build only: the old verifier constructed and executed several copies
  // of 7–16 MB objects at once, which could exceed Windows' commit limit.
  const built = syncer.sync({ check: true });
  const artifact = (relative) => built.files.get(path.join(syncer.REPO_ROOT, ...relative.split('/')))
    || built.files.get(path.join(syncer.WEB_ROOT, ...relative.replace(/^web\//, '').split('/')));

  const seeder = artifact('web/tm-official-scenario-bundle.js');
  const preview = artifact('web/preview/official-scenarios-bundle.js');
  const reset = artifact('web/preview/scenario-editor-reset-data.js');
  ok(typeof seeder === 'string' && typeof preview === 'string' && typeof reset === 'string', 'seeder/preview/reset artifacts registered');

  built.entries.forEach((entry) => {
    const compact = JSON.stringify(entry.data);
    const builtin = artifact('web/' + entry.builtin);
    ok(builtin.includes('var scenario = ' + serializeScenarioExpression(entry.data) + ';'), entry.key + ' builtin embeds the complete lossless root expression');
    ok(builtin.split('\n').length <= 20, entry.key + ' builtin remains reviewable compact output');
    const expression = serializeScenarioExpression(entry.data);
    ok(seeder.includes('"data":' + expression), entry.key + ' seeder includes lossless root expression');
    ok(preview.includes('"' + entry.key + '":' + expression), entry.key + ' editor preview includes lossless root expression');
    if (entry.key === 'tianqi7') {
      const marker = '"scenario":';
      const start = reset.lastIndexOf(marker) + marker.length;
      const end = reset.lastIndexOf('};\n})(typeof window');
      const embedded = start >= marker.length && end > start ? reset.slice(start, end) : '';
      let differences = [];
      if (embedded !== compact && embedded) {
        const resetScenario = JSON.parse(embedded);
        const keys = new Set(Object.keys(resetScenario).concat(Object.keys(entry.data)));
        differences = Array.from(keys).filter((key) => JSON.stringify(resetScenario[key]) !== JSON.stringify(entry.data[key]));
      }
      ok(
        embedded === compact,
        'editor reset embeds the complete Tianqi root JSON'
          + ' (embedded=' + embedded.length + '/' + sha256(embedded)
          + ', root=' + compact.length + '/' + sha256(compact)
          + ', differingKeys=' + differences.join(',') + ')'
      );
    }

    const bundledPath = path.join(syncer.WEB_ROOT, 'bundled-scenarios', entry.filename);
    if (fs.existsSync(bundledPath)) {
      const bundled = fs.readFileSync(bundledPath);
      ok(bundled.equals(Buffer.from(entry.raw, 'utf8')), entry.key + ' bundled JSON is byte-identical to root JSON');
    } else {
      ok(artifact('web/bundled-scenarios/' + entry.filename) === entry.raw, entry.key + ' bundled JSON is ready for release staging');
    }
  });

  const manifestPath = path.join(syncer.WEB_ROOT, 'bundled-scenarios', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const context = { window: null, globalThis: null };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(syncer.WEB_ROOT, 'bundled-scenarios', 'manifest.js'), 'utf8'), context);
  ok(JSON.stringify(context.TMOfficialScenarioManifest) === JSON.stringify(manifest), 'manifest.js equals manifest.json');

  built.entries.forEach((entry) => {
    const meta = manifest.entries.find((row) => row.id === entry.id);
    ok(!!meta, entry.key + ' metadata exists');
    const builtinBytes = fs.readFileSync(path.join(syncer.WEB_ROOT, entry.builtin));
    ok(meta.sha256 === sha256(builtinBytes), entry.key + ' metadata script sha256 is correct');
    ok(meta.bytes === builtinBytes.length, entry.key + ' metadata script bytes is correct');
    ok(meta.sourceSha256 === sha256(Buffer.from(entry.raw, 'utf8')), entry.key + ' metadata source sha256 is correct');
    ok(meta.sourceBytes === entry.bytes, entry.key + ' metadata source bytes is correct');
    ok(meta.scriptUrl === entry.builtin, entry.key + ' metadata loader path is correct');
    ok(meta.counts.characters === (entry.data.characters || []).length, entry.key + ' metadata counts are correct');
  });

  // Format checks above supplement, never replace, full executed-consumer parity.
  for (const mode of ['seeder','preview']) {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'verify-official-aggregate-worker.js'), mode],
      { encoding:'utf8', timeout:180000, maxBuffer:1024*1024 });
    if (child.status !== 0) throw new Error(mode + ' complete consumer parity failed: ' + (child.stderr || child.error || child.stdout));
    const result = JSON.parse(child.stdout.trim());
    ok(result.ok && result.checks >= built.entries.length, mode + ' all executed values and object isolation verified');
  }
  console.log('PASS assertions=' + assertions);
}

try { main(); }
catch (error) { console.error('FAIL ' + (error && error.stack || error)); process.exit(1); }
