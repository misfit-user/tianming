'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const queueSrc = fs.readFileSync(path.join(ROOT, 'tm-change-queue.js'), 'utf8');
const systemsSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-systems.js'), 'utf8');

assert(/failedCount/.test(queueSrc), 'ChangeQueue.applyAll reports failedCount');
assert(/errors/.test(queueSrc), 'ChangeQueue.applyAll reports errors');
assert(/ok\s*:/.test(queueSrc), 'ChangeQueue.applyAll reports ok flag');
assert(/failedChanges/.test(queueSrc), 'ChangeQueue preserves failedChanges for retry/diagnostics');
assert(/queue\s*=\s*failedChanges/.test(queueSrc), 'ChangeQueue retains only failed changes after partial failure');

const applyPos = systemsSrc.indexOf('ChangeQueue.applyAll()');
const clearPos = systemsSrc.indexOf('ChangeQueue.clear()');
const guardPos = systemsSrc.indexOf('queueResult.ok');
assert(applyPos >= 0 && clearPos > applyPos, 'systems applies then clears ChangeQueue');
assert(guardPos > applyPos && guardPos < clearPos, 'systems checks queueResult.ok before clearing');

console.log('[smoke-changequeue-apply-safety] pass assertions=' + passed.value);
