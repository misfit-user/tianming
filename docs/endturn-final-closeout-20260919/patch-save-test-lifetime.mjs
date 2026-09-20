import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-perf-save-preparation.js',(s,r)=>{
 s=r(s,"const assert = require('assert/strict'), path = require('path');",`const assert = require('assert/strict'), path = require('path');
// This isolated Node test compares multiple complete worlds. Collect only discarded comparison
// graphs between assertions; preserve every fixture, both formats, and the existing hard deadline.
require('v8').setFlagsFromString('--expose_gc');
const collectComparisonGarbage = require('vm').runInNewContext('gc');`);
 return r(s,"function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }","function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } finally { fn = null; collectComparisonGarbage(); } }");
});
