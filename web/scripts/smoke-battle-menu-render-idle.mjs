import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(process.env.TM_BATTLE_SOURCE||new URL('../battle/index.html',import.meta.url),'utf8');
const begin=html.indexOf('function loop(ts)'),end=html.indexOf('function step(dt)',begin);
assert(begin>=0&&end>begin,'production loop exists');const source=html.slice(begin,end);
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function harness(embedded=false,titleVisible=true,hiding=false){
 const count={draw:0,step:0,observe:0,raf:0};const title={style:{display:titleVisible?'flex':'none'},classList:{contains:()=>hiding}};
 const c={_battleTitlePrepared:true,_TM_EMBEDDED:embedded,document:{getElementById:()=>title},last:10,_rlast:10,_rdt:.016,TEMPO:.66,performance:{now:()=>100},R3D:{observeFrame(){count.observe++;}},state:{paused:false,speed:1,over:false},cam:{},keyrot:0,keypan:{x:0,y:0},step(dt){count.step++;count.dt=dt;},draw(){count.draw++;},requestAnimationFrame(){count.raf++;},clampCam(){}};
 vm.createContext(c);vm.runInContext(source,c);return{c,count,title};
}
check('warmed title menu does not render or simulate the covered battle',()=>{
 const h=harness();h.c.loop(100);assert.deepEqual(h.count,{draw:0,step:0,observe:0,raf:1});assert.equal(h.c.last,100);
});
check('leaving title resumes one loop with a fresh time baseline',()=>{
 const h=harness();h.c.loop(100);h.title.style.display='none';h.c.loop(116);assert.equal(h.count.draw,1);assert.equal(h.count.step,1);assert.equal(h.count.raf,2);assert(Math.abs(h.count.dt-.016*.66)<1e-10);
});
check('embedded game renders regardless of independent title state',()=>{const h=harness(true);h.c.loop(100);assert.equal(h.count.draw,1);assert.equal(h.count.step,1);});
check('title fade-out already permits battle rendering',()=>{const h=harness(false,true,true);h.c.loop(100);assert.equal(h.count.draw,1);});
check('paused visible battle still renders camera and HUD',()=>{const h=harness(false,false);h.c.state.paused=true;h.c.loop(100);assert.equal(h.count.draw,1);assert.equal(h.count.step,0);});
check('return to title stops rendering again without duplicating scheduler',()=>{const h=harness(false,false);h.c.loop(100);h.title.style.display='flex';h.c.loop(116);assert.equal(h.count.draw,1);assert.equal(h.count.raf,2);});
check('initial warm-up runs once and never advances simulation',()=>{const h=harness();h.c._battleTitlePrepared=false;for(let i=0;i<10;i++)h.c.loop(100+i*16);assert.equal(h.count.draw,1);assert.equal(h.count.step,0);assert.equal(h.count.raf,10);});
check('visible first frame prepares resources before returning to title',()=>{const h=harness(false,false);h.c._battleTitlePrepared=false;h.c.loop(100);h.title.style.display='flex';h.c.loop(116);assert.equal(h.count.draw,1);assert.equal(h.count.raf,2);});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
