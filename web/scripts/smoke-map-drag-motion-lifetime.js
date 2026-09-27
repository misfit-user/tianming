'use strict';
// Run the real scheduler: a held drag must not oscillate vector-effect/compositor state at the idle deadline.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {functionSource}=require('./lib-perf-round1');const code=functionSource(fs.readFileSync(path.join(__dirname,'../phase8-formal-map.js'),'utf8'),'scheduleMapTransform');
const classes=new Set(),timers=new Map(),stage={classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},__phase8ViewportRect:{width:800}};let id=0,paints=0;
const c={state:{drag:{pointerId:1}},mapStage:()=>stage,_mapTransformRaf:0,_mapMotionTimer:0,applyMapTransform:()=>paints++,setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:n=>timers.delete(n),window:{requestAnimationFrame:fn=>{c.frame=fn;return 99;}}};
vm.createContext(c);vm.runInContext(code,c);c.scheduleMapTransform();assert(classes.has('tmf-map-moving'));assert.equal(timers.size,1);c.frame();assert.equal(paints,1);
function tick(){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();}
tick();assert(classes.has('tmf-map-moving'),'held pointer retains moving mode');assert.equal(timers.size,1);assert(stage.__phase8ViewportRect);
c.state.drag=null;tick();assert(!classes.has('tmf-map-moving'));assert.equal(stage.__phase8ViewportRect,null);assert.equal(timers.size,0);
c.scheduleMapTransform();c.scheduleMapTransform();assert.equal(timers.size,1,'movement replaces the idle timer');c.frame();assert.equal(paints,2,'same-frame inputs coalesce');tick();assert(!classes.has('tmf-map-moving'));
console.log('PASS map drag motion lifetime: held input, post-release cleanup and same-frame coalescing');
