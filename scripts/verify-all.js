#!/usr/bin/env node
// scripts/verify-all.js - run all local safety gates.
//
// Order:
//   syntax-check -> encoding-check -> ref-check -> find-orphans -> official-scenario-smoke
//   -> smoke-engine-phase0 -> smoke-office-dynastification -> smoke-military-systems -> smoke-influence-groups -> smoke-class-engine -> smoke-class-party-bidirectional
//   -> smoke-letter-full -> smoke-letter-intercept-react -> smoke-tinyi-fix
//   -> smoke-tinyi-impeachment -> headless-smoke -> smoke-chaoyi-v3
//
// Usage:
//   node scripts/verify-all.js
//
// This is fail-fast and prints a short baseline summary at the end.

'use strict';

const cp = require('child_process');
const path = require('path');

const SCRIPTS = path.resolve(__dirname);

// Current clean baseline: 212 passing tests, 0 real failures.
const SMOKE_BASELINE = { minPass: 212, maxFail: 0 };

const checks = [
  { name: 'syntax-check', file: 'syntax-check.js', estSec: 17, expectExit: 0 },
  { name: 'encoding-check', file: 'smoke-encoding-check.js', estSec: 1, expectExit: 0 },
  { name: 'ref-check', file: 'ref-check.js', estSec: 1, expectExit: 0 },
  { name: 'find-orphans', file: 'find-orphans.js', estSec: 1, expectExit: 0 },
  { name: 'official-scenario', file: 'official-scenario-smoke.js', estSec: 1, expectExit: 0 },
  { name: 'engine-phase0', file: 'smoke-engine-phase0.js', estSec: 1, expectExit: 0 },
  { name: 'office-dynastification', file: 'smoke-office-dynastification.js', estSec: 1, expectExit: 0 },
  { name: 'military-systems', file: 'smoke-military-systems.js', estSec: 1, expectExit: 0 },
  { name: 'influence-groups', file: 'smoke-influence-groups.js', estSec: 1, expectExit: 0 },
  { name: 'class-engine', file: 'smoke-class-engine.js', estSec: 1, expectExit: 0 },
  { name: 'class-party-bidi', file: 'smoke-class-party-bidirectional.js', estSec: 1, expectExit: 0 },
  { name: 'letter-full', file: 'smoke-letter-full.js', estSec: 1, expectExit: 0 },
  { name: 'letter-intercept', file: 'smoke-letter-intercept-react.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-fix', file: 'smoke-tinyi-fix.js', estSec: 1, expectExit: 0 },
  { name: 'tinyi-impeach', file: 'smoke-tinyi-impeachment.js', estSec: 1, expectExit: 0 },
  { name: 'smoke', file: 'headless-smoke.js', estSec: 30, expectExit: null },
  { name: 'cc3-smoke', file: 'smoke-chaoyi-v3.js', estSec: 1, expectExit: 0 }
];

let totalSec = 0;
const results = [];

for (const c of checks) {
  process.stdout.write(`[verify-all] run ${c.name} (~${c.estSec}s)... `);
  const t0 = Date.now();
  const r = cp.spawnSync('node', [path.join(SCRIPTS, c.file)], { encoding: 'utf8' });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  totalSec += parseFloat(dt);

  let ok;
  if (c.name === 'smoke') {
    const m = (r.stdout || '').match(/"passed"\s*:\s*(\d+)\s*,\s*"failed"\s*:\s*(\d+)/);
    if (m) {
      const passed = +m[1];
      const failed = +m[2];
      ok = passed >= SMOKE_BASELINE.minPass && failed <= SMOKE_BASELINE.maxFail;
      if (!ok) {
        process.stderr.write(
          '\n[smoke] baseline regression (expected >= ' + SMOKE_BASELINE.minPass
          + ' pass / <= ' + SMOKE_BASELINE.maxFail
          + ' fail; actual ' + passed + '/' + failed + ')\n'
        );
      }
    } else {
      ok = false;
      process.stderr.write('\n[smoke] cannot parse passed/failed JSON\n');
    }
  } else {
    ok = r.status === 0;
  }

  process.stdout.write((ok ? '\x1b[32mPASS' : '\x1b[31mFAIL') + '\x1b[0m  ' + dt + 's\n');
  results.push({ name: c.name, ok, dt, stdout: r.stdout, stderr: r.stderr });
  if (!ok) {
    process.stderr.write('\n[verify-all] ' + c.name + ' failed; aborting remaining checks\n\n');
    process.stderr.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    process.exit(1);
  }
}

console.log('\n[verify-all] all ' + checks.length + ' checks passed; total ' + totalSec.toFixed(1) + 's\n');
for (const r of results) {
  const lines = (r.stdout || '').split('\n').filter(Boolean);
  const tail = lines.slice(-2).filter(function(l) {
    return /PASS|pass|fail|valid|no issues|returned/.test(l);
  }).slice(-1)[0] || lines.slice(-1)[0] || '';
  console.log('  - ' + r.name.padEnd(18) + tail.trim());
}
process.exit(0);
