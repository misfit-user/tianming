'use strict';
// Validate the real large official source without deleting map data to satisfy the preparer.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const compiler=require('../tm-start-compiler.js'),file=path.resolve(__dirname,'../../scenarios/绍宋·建炎元年八月（官方）.json');
const bytes=fs.readFileSync(file),digest=crypto.createHash('sha256').update(bytes).digest('hex'),source=JSON.parse(bytes);
assert(bytes.length<=compiler.maxBytes,'official source fits the advertised byte budget');
assert.doesNotThrow(()=>compiler.assertData(source));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),digest);
const leaf=Array(1024).fill(0),over=Array(8192).fill(leaf);
assert.throws(()=>compiler.assertData(over),e=>e.code==='source-complexity'&&e.diagnostics[0].nodes>e.diagnostics[0].maxNodes,'dense small-byte data still meets a finite expanded-node guard');
let deep=null;for(let i=0;i<130;i++)deep={child:deep};assert.throws(()=>compiler.assertData(deep),e=>e.code==='source-complexity');
let getterCalls=0;const accessor={};Object.defineProperty(accessor,'value',{enumerable:true,get(){getterCalls++;return 1;}});
assert.throws(()=>compiler.assertData(accessor),e=>e.code==='source-accessor');assert.equal(getterCalls,0);
console.log('PASS official source accepted unchanged; expanded-node/depth/accessor safeguards remain enforced');
