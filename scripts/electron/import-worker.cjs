'use strict';
// Deterministic fault/timing wrapper around the actual production Worker entry.
const { workerData } = require('worker_threads');
if (workerData.testCrash) throw new Error('injected-real-worker-crash');
if (workerData.testWait) {
  const gate = new Int32Array(workerData.testWait);
  Atomics.store(gate, 0, 1);
  Atomics.wait(gate, 1, 0, 60000);
}
require(workerData.testEntry);
