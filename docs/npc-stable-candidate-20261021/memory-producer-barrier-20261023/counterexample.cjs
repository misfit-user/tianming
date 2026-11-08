'use strict';
// Runs one unchanged production-source regression against either the current
// review implementation or TM_REVIEW_SOURCE_OVERRIDE. No simulated algorithm.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const assert = require('assert/strict');
const file = path.resolve(__dirname, '../../../web/scripts/smoke-emergency-recovery-review.js');
const source = fs.readFileSync(file, 'utf8');
assert.equal(source.split('run(tests);').length, 2);
const name = 'an already saved pending receipt cannot bypass the unresolved original memory producer';
const selected = source.replace('run(tests);', 'const selected=tests.filter(t=>t.name===' + JSON.stringify(name) + ');assert.equal(selected.length,1);run(selected);');
new Function('require', '__dirname', '__filename', selected)(createRequire(file), path.dirname(file), file);
