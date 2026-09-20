'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.env.TM_MINIMAP_SOURCE||path.join(__dirname,'../map-editor-minimap.js'),'utf8');
let passed=0,failed=0;function check(n,f){try{f();passed++;console.log('PASS '+n);}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}}
function harness(){
 const events={},timers=[],frames=[],counts={lines:0,paints:0,blits:0};let hidden=false;
 function element(tag){
  const node={tag,style:{},children:[],isConnected:true,width:200,height:122,addEventListener(){},appendChild(c){this.children.push(c);},getClientRects(){return hidden?[]:[{}];},getBoundingClientRect(){return{left:0,top:0};},querySelector(){return this.toggle||(this.toggle=element('button'));}};
  if(tag==='canvas')node.getContext=()=>node.ctx||(node.ctx={fillRect(){counts.paints++;},strokeRect(){counts.paints++;},beginPath(){},moveTo(){},lineTo(){counts.lines++;},closePath(){},fill(){counts.paints++;},stroke(){counts.paints++;},save(){},restore(){},drawImage(){counts.blits++;}});
  return node;
 }
 const document={hidden:false,body:element('body'),createElement:element,querySelector(){return this.body;},addEventListener(){}};
 const divisions=Array.from({length:20},(_,id)=>({id,polygon:[[id,0],[id+1,0],[id+1,1],[id,1]],bbox:{x:id,y:0,w:1,h:1},colorKey:0x123456}));
 const ME={EDITOR:{map:{bitmapWidth:1280,bitmapHeight:800,divisions},selectedIds:[],canvas:{width:1200,height:720},camera:{x:0,y:0,zoom:1}},on(n,f){events[n]=f;},requestRender(){}};
 const window={TM:{MapEditor:ME},addEventListener(){}};
 vm.runInNewContext(source,{window,document,console,localStorage:{getItem(){return null;},setItem(){}},setInterval(f){timers.push(f);return timers.length;},requestAnimationFrame(f){frames.push(f);return frames.length;}});
 const api=ME.minimap;api.init();return{api,ME,events,counts,document,hide(v){hidden=v;},poll(){timers.forEach(f=>f());},flush(){while(frames.length)frames.shift()();}};
}
check('60 idle polls perform no drawing',()=>{const h=harness(),before={...h.counts};for(let i=0;i<60;i++)h.poll();assert.deepEqual(h.counts,before);});
check('camera changes redraw only the viewport and reuse base geometry',()=>{const h=harness(),n=h.counts.lines,b=h.counts.blits;for(let i=0;i<10;i++){h.ME.EDITOR.camera.x++;h.poll();}assert.equal(h.counts.lines-n,20);assert.equal(h.counts.blits-b,10);});
check('mutations coalesce and refresh the base once',()=>{const h=harness(),n=h.counts.lines;for(let i=0;i<20;i++)h.events.mutation();h.flush();assert.equal(h.counts.lines-n,20*3+2);const after=h.counts.lines;h.poll();assert.equal(h.counts.lines,after);});
check('selection, replacement map and layout changes invalidate the base',()=>{const h=harness();for(const edit of [()=>{h.ME.EDITOR.selectedIds=[2];h.events['selection-change']();h.flush();},()=>{h.ME.EDITOR.map={...h.ME.EDITOR.map};h.poll();},()=>{h.ME.EDITOR.map.bitmapWidth=2048;h.poll();}]){const n=h.counts.lines;edit();assert.equal(h.counts.lines-n,62);}});
check('hidden or collapsed minimap does not draw and catches up on reveal',()=>{const h=harness(),before={...h.counts};h.document.hidden=true;h.ME.EDITOR.camera.x=20;h.poll();assert.deepEqual(h.counts,before);h.document.hidden=false;h.hide(true);h.poll();assert.deepEqual(h.counts,before);h.hide(false);h.api.setEnabled(false);h.events.mutation();h.poll();assert.deepEqual(h.counts,before);h.api.setEnabled(true);h.flush();assert(h.counts.lines>before.lines);});
check('public render still honors in-place geometry edits',()=>{const h=harness(),n=h.counts.lines;h.ME.EDITOR.map.divisions[0].polygon[1][0]=99;h.api.render();assert.equal(h.counts.lines-n,62);});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
