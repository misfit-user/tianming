import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.TM_RENDER_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {functionSource}= (await import(pathToFileURL(path.join(root,'web/scripts/lib-perf-round1.js')))).default;
const map=fs.readFileSync(process.env.TM_MAP_CANDIDATE||path.join(root,'web/phase8-formal-map.js'),'utf8'),wd=fs.readFileSync(process.env.TM_WD_CANDIDATE||path.join(root,'web/tm-wendui.js'),'utf8');
let passed=0,failed=0;function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}}
function bubbleHarness(){let text='已有正文',scroll=900,reads=0,writes=0,scrollWrites=0,color='gray';
 const bubble={isConnected:true,style:{get color(){return color;},set color(v){color=v;}},get textContent(){return text;},set textContent(v){text=v;writes++;}};
 const chat={isConnected:true,contains:n=>n===bubble,get scrollHeight(){reads++;return 1000+Math.max(0,text.length-4)*10;},get scrollTop(){reads++;return scroll;},set scrollTop(v){scroll=v;scrollWrites++;},get clientHeight(){reads++;return 100;}};
 const c={};vm.createContext(c);vm.runInContext(functionSource(wd,'_wdPaintStreamBubble'),c);return{c,bubble,chat,metrics:()=>({reads,writes,scrollWrites,scroll,text,color}),scrollTo(v){scroll=v;}};
}
check('unchanged reply for 60 updates performs zero text writes and zero layout reads',()=>{
 const h=bubbleHarness();for(let i=0;i<60;i++)assert.equal(h.c._wdPaintStreamBubble(h.chat,h.bubble,'已有正文',true),false);
 assert.deepEqual(h.metrics(),{reads:0,writes:0,scrollWrites:0,scroll:900,text:'已有正文',color:''});
});
check('following the bottom survives a reply growing by more than the follow threshold',()=>{
 const h=bubbleHarness();h.c._wdPaintStreamBubble(h.chat,h.bubble,'一段很长且正在持续增长的完整回复正文',true);const m=h.metrics();assert.equal(m.writes,1);assert.equal(m.scrollWrites,1);assert(m.scroll>1000);
});
check('reading older conversation never forces the player back to the bottom',()=>{
 const h=bubbleHarness();h.scrollTo(120);h.c._wdPaintStreamBubble(h.chat,h.bubble,'已经更新的回复',false);assert.equal(h.metrics().scroll,120);assert.equal(h.metrics().scrollWrites,0);
});
check('closed or replaced chat nodes receive no layout work or text updates',()=>{
 const h=bubbleHarness();h.chat.isConnected=false;assert.equal(h.c._wdPaintStreamBubble(h.chat,h.bubble,'新回复',true),false);h.chat.isConnected=true;h.chat.contains=()=>false;assert.equal(h.c._wdPaintStreamBubble(h.chat,h.bubble,'新回复',true),false);assert.equal(h.metrics().reads,0);assert.equal(h.metrics().writes,0);
});
check('empty streaming preview retains the existing ellipsis convention and text safety',()=>{
 const h=bubbleHarness();h.c._wdPaintStreamBubble(h.chat,h.bubble,'',false);assert.equal(h.metrics().text,'…');h.c._wdPaintStreamBubble(h.chat,h.bubble,'<img src=x onerror=alert(1)>',false);assert.equal(h.metrics().text,'<img src=x onerror=alert(1)>');
});
check('toolbar lookup preserves order but never visits heavy SVG subtrees',()=>{
 const first={},second={},third={};let vectorQueries=0;const vector={id:'ming-map-layer',querySelectorAll(){vectorQueries++;throw Error('heavy-svg-visited');}};
 const a={id:'toolbar-a',matches:()=>false,querySelectorAll:()=>[first,second]},b={id:'toolbar-b',matches:()=>true,querySelectorAll:()=>[third]};
 const wrap={children:[a,vector,b]},c={document:{getElementById:()=>wrap,querySelectorAll(){throw Error('global-scan');}}};vm.createContext(c);vm.runInContext(functionSource(map,'mapChromeQuery'),c);
 assert.deepEqual(Array.from(c.mapChromeQuery('.map-layer')),[first,second,b,third]);assert.equal(vectorQueries,0);
 wrap.children=[b,vector];assert.deepEqual(Array.from(c.mapChromeQuery('.map-layer')),[b,third]);
});
check('toolbar lookup falls back safely before the formal map shell exists',()=>{
 const found=[{},{}],c={document:{getElementById:()=>null,querySelectorAll:()=>found}};vm.createContext(c);vm.runInContext(functionSource(map,'mapChromeQuery'),c);assert.equal(c.mapChromeQuery('.map-layer'),found);
});
check('same-scale camera transform does not emit a redundant class mutation',()=>{
 const fn=functionSource(map,'applyMapTransform');assert.match(fn,/classList\.contains\('zoomed'\) !== \(v\.scale > 1\.35\)/);
 const line=fn.split('\n').find(s=>s.includes("classList.contains('zoomed')"));let on=true,writes=0;const c={stage:{classList:{contains:()=>on,toggle(_,v){on=v;writes++;}}},v:{scale:3}};vm.createContext(c);
 for(let i=0;i<60;i++)vm.runInContext(line,c);assert.equal(writes,0);c.v.scale=1;vm.runInContext(line,c);assert.equal(writes,1);assert.equal(on,false);
});
check('both opening and regular dialogue streams call the guarded renderer',()=>{
 assert.match(wd,/_wdPaintStreamBubble\(chatEl, bubble, _wdVisibleReplyPreview\(txt\), false\)/);assert.match(wd,/_wdPaintStreamBubble\(chat, streamBubble, _wdVisibleReplyPreview\(txt\), true\)/);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
