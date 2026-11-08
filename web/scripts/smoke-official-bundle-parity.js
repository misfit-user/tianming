#!/usr/bin/env node
// Official scenario single-source guard.
// The root scenarios/*（官方）.json files are the only truth source. This smoke
// checks the compatibility entrypoint and the generated builtin scripts
// (web/scenarios/*.js — the one shipped copy, which also feeds the desktop
// seeder and the editor preview) against the unified synchronizer without
// reintroducing an independent serializer or a second data bundle.
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const syncer = require('./sync-official-scenarios.js');
const compatibilityBuilder = require('./rebuild-official-scenario-bundle.js');
const { loadBuiltins } = require('./lib-official-builtins.js');

let assertions = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

ok(typeof compatibilityBuilder.build === 'function',
  'compatibility entrypoint must expose build()');
ok(compatibilityBuilder.ENTRIES === syncer.ENTRIES,
  'compatibility entrypoint must reuse the unified source registry');
ok(!Object.prototype.hasOwnProperty.call(compatibilityBuilder, 'serialize'),
  'compatibility entrypoint must not own a second serializer');

const built = syncer.buildArtifacts();
ok(Array.isArray(built.entries) && built.entries.length === syncer.ENTRIES.length,
  'unified build must include every registered official scenario');

const seederBundle = path.join(syncer.WEB_ROOT, 'tm-official-scenario-bundle.js');
ok(!built.files.has(seederBundle) && !fs.existsSync(seederBundle),
  'no second seeder bundle: the builtins are the only shipped copy');

built.entries.forEach((entry) => {
  const out = path.join(syncer.WEB_ROOT, entry.builtin);
  const current = fs.readFileSync(out, 'utf8');
  ok(current === built.files.get(out),
    entry.key + ' builtin must be byte-identical to the unified root-JSON artifact');
  ok(current.indexOf('/* GENERATED FILE.') === 0,
    entry.key + ' builtin must retain the generated-file marker');
});

// Executed-consumer parity for both registration modes, one scenario at a time to bound memory.
built.entries.forEach((entry) => {
  const standalone = loadBuiltins({ ids: [entry.id] });
  const registered = standalone.TMOfficialScenarioBuiltins && standalone.TMOfficialScenarioBuiltins[entry.id];
  ok(!!registered && registered.id === entry.id,
    entry.key + ' must register into TMOfficialScenarioBuiltins when the page has no P');
  ok(JSON.stringify(registered) === JSON.stringify(entry.data),
    entry.key + ' builtin payload must structurally equal its root JSON');

  const game = loadBuiltins({ ids: [entry.id], seed: { P: { scenarios: [] } } });
  ok(game.P.scenarios.length === 1 && game.P.scenarios[0].id === entry.id,
    entry.key + ' must register into P.scenarios in the game');
  ok(game.TMOfficialScenarioBuiltins === undefined,
    entry.key + ' must not keep a second reference when P exists (the loader must be able to free it)');
});

console.log('smoke-official-bundle-parity PASS: ' + assertions
  + ' assertions, ' + built.entries.length + ' root-sourced scenarios');
