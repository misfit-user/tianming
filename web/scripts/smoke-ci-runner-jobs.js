'use strict';
const assert=require('node:assert/strict'),{parseJobs}=require('./ci-smokes');
assert.deepEqual(parseJobs([]),[]);
assert.deepEqual(parseJobs(['--jobs','2']),['--jobs','2']);
assert.deepEqual(parseJobs(['--jobs','8']),['--jobs','8']);
for(const value of [undefined,'0','-1','9','2.5','bad'])assert.throws(()=>parseJobs(['--jobs',value]),/integer/);
console.log('PASS local CI may reduce only scheduling concurrency; invalid concurrency fails closed');
