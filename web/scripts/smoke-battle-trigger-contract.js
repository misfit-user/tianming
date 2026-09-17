#!/usr/bin/env node
'use strict';
// Live producers/consumers, not a separate battle simulator. Iframe rendering has its own native gate.
const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
let passed = 0, failed = 0;
function ok(value, message) { if (value) passed++; else { failed++; console.error('FAIL ' + message); } }
function make() {
  const c = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, String, Number, Boolean, Array, Object, RegExp, Error, Promise, parseInt, parseFloat, isNaN, isFinite,
    document: { addEventListener() {} }, SettlementPipeline: { register() {} }, _dbg() {}, addEB() {}, recordSubcallError() {} };
  c.window=c; c.global=c; c.globalThis=c; c.TM={};
  c.P={playerInfo:{factionName:'蜀汉'},conf:{deterministicCasualties:false},battleConfig:{},ai:{}};
  c.GM={turn:10,_yujiaQinzheng:true,chars:[{name:'刘备',role:'皇帝',alive:true,isPlayer:true}],facs:[{id:'shu',name:'蜀汉'},{id:'wei',name:'曹魏'}],armies:[
    {id:'pa',name:'御营',faction:'蜀汉',commander:'刘备',soldiers:3000,morale:60,training:55,supply:80,quality:'普通',location:'汉中',composition:[{type:'步兵',count:3000}],_battleStance:'always'},
    {id:'ea',name:'魏军',faction:'曹魏',commander:'敌将',soldiers:2500,morale:60,training:55,supply:80,quality:'普通',location:'汉中',composition:[{type:'步兵',count:2500}]}]};
  vm.createContext(c);
  for(const file of ['tm-utils.js','tm-military.js','tm-battle-contract.js','tm-guoku-engine.js','tm-army-units.js','tm-battle-adapter.js','tm-battle-resolve.js','tm-battle-turn.js']) vm.runInContext(read(file),c,{filename:file});
  c.launches=[];c.TMBattleEmbed={launch(cfg){c.launches.push(cfg);return Promise.resolve(c.tacticalResponse || null);}};
  return c;
}
function battle(id='battle-test') {return {battleId:id,winnerFactionId:'蜀汉',loserFactionId:'曹魏',attackerArmyId:'pa',defenderArmyId:'ea',casualties:{attacker:300,defender:500},affectedArmies:[{armyId:'pa',side:'attacker',loss:300},{armyId:'ea',side:'defender',loss:500}]};}
function extract(src,predicate) {let found;function walk(n){if(!n||typeof n!=='object'||found)return;if(predicate(n)){found=n;return;}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(acorn.parse(src,{ecmaVersion:'latest'}));if(!found)throw Error('missing production AST');return src.slice(found.start,found.end);}
async function main(){
  for(const kind of ['id','army-name','name-field','top-level']) {
    const c=make(),br=battle();
    if(kind==='army-name')br.affectedArmies.forEach((x,i)=>{x.armyId=i?'魏军':'御营';});
    if(kind==='name-field')br.affectedArmies.forEach((x,i)=>{delete x.armyId;x.name=i?'魏军':'御营';});
    if(kind==='top-level')delete br.affectedArmies;
    const receipt=c.MilitarySystems.applyBattleResult(br,c.GM);
    ok(receipt&&receipt.deferred===true,kind+': honest deferred receipt');
    ok(c.TMBattleTurn._pending().length===1&&c.GM.armies[0].soldiers===3000,kind+': no losses before choice');
    await c.TMBattleTurn.runPending(c.GM);
    ok(c.launches.length===1,kind+': tactical entry reached');
    ok(c.GM.armies[0].soldiers===2700&&c.GM.armies[1].soldiers===2000,kind+': delegated loss applied exactly once');
    ok(c.GM.guoku&&c.GM.guoku._battleCasualtyBonus===1500,kind+': actual player loss feeds funeral allowance');
  }
  const d=make(),br=battle('unique');d.MilitarySystems.applyBattleResult(br,d.GM);d.MilitarySystems.applyBattleResult(JSON.parse(JSON.stringify(br)),d.GM);
  ok(d.TMBattleTurn._pending().length===1,'duplicate battle ID does not prompt twice');await d.TMBattleTurn.runPending(d.GM);
  d.MilitarySystems.applyBattleResult(JSON.parse(JSON.stringify(br)),d.GM);await d.TMBattleTurn.runPending(d.GM);
  ok(d.GM.armies[0].soldiers===2700&&(d.GM.battleHistory||[]).length===1,'settled battle retry is idempotent');
  ok(d.GM.guoku&&d.GM.guoku._battleCasualtyBonus===1500,'retry does not double funeral allowance');
  if(d.GuokuEngine.syncBattleCasualtyBonus){d.GM.turn++;d.GuokuEngine.syncBattleCasualtyBonus(d.GM);ok(d.GM.guoku._battleCasualtyBonus===0,'new turn with no battle clears prior allowance');}else ok(false,'canonical allowance sync exists');
  const off=make();off.GM.settings={yujiaQinzheng:true};off._tmSetYujiaQinzheng(false);off.MilitarySystems.applyBattleResult(battle(),off.GM);
  ok(off.TMBattleTurn._pending().length===0,'explicit master false overrides legacy true');
  const pf=make();delete pf.P.playerInfo;pf.GM.playerFactionName='蜀汉';pf.MilitarySystems.applyBattleResult(battle(),pf.GM);ok(pf.TMBattleTurn._pending().length===1,'restored playerFactionName resolves');
  const ids=make();ids.P.playerInfo.factionName='shu';ids.MilitarySystems.applyBattleResult(battle(),ids.GM);ok(ids.TMBattleTurn._pending().length===1,'faction ID/name aliases resolve');
  const bad=make();bad.tacticalResponse={error:'test startup error'};bad.MilitarySystems.applyBattleResult(battle(),bad.GM);await bad.TMBattleTurn.runPending(bad.GM);ok(bad.GM.armies[0].soldiers===2700,'iframe error delegates instead of inventing zero-loss defeat');
  const canon=make(),ab=battle('aliases');ab.winnerFactionId='shu';ab.loserFactionId='wei';ab.attackerArmyId='御营';ab.defenderArmyId='魏军';ab.occupiedCityIds=['测试城'];
  const converted=canon.TMBattleResolve.tacticalToBattleResult({outcome:'win',units:[{parentArmyId:'pa',survivors:2800},{parentArmyId:'ea',survivors:2100}],commanders:[{name:'刘备',fate:'wounded'},{name:'敌将',fate:'captured'}]}, {GM:canon.GM,playerArmies:[canon.GM.armies[0]],enemyArmies:[canon.GM.armies[1]],band:{winner:'player',swing:true},playerFactionName:'蜀汉',enemyFactionName:'曹魏',abstractBr:ab});
  ok(converted.occupiedCityIds&&converted.occupiedCityIds[0]==='测试城'&&converted.attackerArmyId==='pa','faction IDs/army names preserve matching strategic result');
  ok(converted.affectedArmies.filter(e=>e.commanderFate).length===2,'all commander fates attach to their own army entries');
  ok(canon.TMBattleTurn.emperorName({chars:[{name:'另一国君',role:'皇帝'},{name:'玩家',isPlayer:true}]})==='玩家','player sovereign has priority over other factions rulers');
  const multiple=make();const one=battle('one'),two=battle('two');const batch=multiple.MilitarySystems.consumeBattleResults({battleResult:one,battleResults:[JSON.parse(JSON.stringify(one)),two]},multiple.GM);
  ok(batch.accepted.length===2&&multiple.TMBattleTurn._pending().length===2,'multiple battles supported; legacy + array duplicate not counted twice');
  await multiple.TMBattleTurn.runPending(multiple.GM);ok(multiple.GM.battleHistory.length===2&&multiple.GM.armies[0].soldiers===2400,'two actual meetings settle each exactly once');
  const concurrent=make();let finishBattle;concurrent.TMBattleEmbed.launch=()=>new Promise(r=>{finishBattle=r;});concurrent.MilitarySystems.applyBattleResult(battle(),concurrent.GM);
  const p1=concurrent.TMBattleTurn.runPending(concurrent.GM),p2=concurrent.TMBattleTurn.runPending(concurrent.GM);ok(p1===p2,'reentrant meeting calls share the active promise');
  for(let i=0;i<15&&!finishBattle;i++)await Promise.resolve();ok(typeof finishBattle==='function','first meeting really waiting for tactical choice');
  concurrent.TMBattleTurn.recoverPending(concurrent.GM);ok(concurrent.GM.armies[0].soldiers===3000,'recover cannot apply active tactical battle early');
  finishBattle(null);await p1;ok(concurrent.GM.armies[0].soldiers===2700&&concurrent.GM.battleHistory.length===1,'reentrant meeting completes once');
  const switched=make();let release;const old=switched.GM;switched.TMBattleEmbed.launch=()=>new Promise(r=>{release=r;});switched.MilitarySystems.applyBattleResult(battle(),old);const active=switched.TMBattleTurn.runPending(old);
  for(let i=0;i<15&&!release;i++)await Promise.resolve();switched.GM={armies:[],turn:20};release(null);await active;
  ok(!switched.GM.battleHistory&&!old.battleHistory&&old._pendingAbstractBattles.length===1,'loading another game cannot consume old asynchronous battle or lose recovery mirror');
  for(const structured of [false,true]){
    const c=make();c.P.battleConfig.enabled=true;c.GM.activeBattles=[{id:'active',phase:'battle',location:'汉中',attackerArmy:'御营',defenderArmy:'魏军',...(structured?{battleResult:battle('active')}:{})}];
    c.BattleEngine.resolveAllBattles();ok(c.TMBattleTurn._pending().length===1&&c.GM.armies[0].soldiers===3000,'active '+structured+': engine also defers');
    await c.TMBattleTurn.runPending(c.GM);const before=c.GM.armies[0].soldiers;c.BattleEngine.resolveAllBattles();
    ok(c.TMBattleTurn._pending().length===0&&c.GM.activeBattles.length===0&&c.GM.armies[0].soldiers===before,'active '+structured+': settled once, removed, not requeued');
  }
  const runSubcall=extract(read('tm-endturn-ai.js'),n=>n.type==='FunctionDeclaration'&&n.id&&n.id.name==='_runSubcall');
  for(const on of [true,false])for(const depth of ['lite','standard','full']){
    const c=make();c.GM._yujiaQinzheng=on;c._aiDepth=depth;c.ns={getCallPolicy:()=>({subcallRetries:0})};c.ctx={};c.GM._aiDispatchStats={byId:{},totalCalls:0,totalTime:0};c.GM._subcallTimings={};vm.runInContext(runSubcall,c);
    let calls=0;await c._runSubcall('sc18','军事态势','full',async()=>{calls++;});ok(calls===((on||depth==='full')?1:0),'SC18 depth '+depth+' master '+on+' preserves battle producer');
  }
  const liteDecl=extract(read('tm-endturn-followup.js'),n=>n.type==='VariableDeclarator'&&n.id&&n.id.name==='_sc18Lite');
  for(const on of [true,false]){const c=make();c.GM._yujiaQinzheng=on;c.P.ai.sc18Lite=true;vm.runInContext('var '+liteDecl,c);ok(c._sc18Lite===!on,'lite analysis cannot drop enabled combat events '+on);}
  const a=make();for(const file of ['tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-endturn-agent-write-tools.js'])vm.runInContext(read(file),a,{filename:file});a.applyAIArmyChange=a.TM.AIChange.Army.applyAIArmyChange;
  const tools=a.TM.Endturn.AgentWriteTools;
  let r=await tools.handle('command_army',{armyName:'御营',soldiersDelta:-300},{GM:a.GM});ok(r.ok&&a.GM.armies[0].soldiers===2700,'Agent soldiersDelta uses canonical delta');
  r=await tools.handle('command_army',{armyName:'御营',soldiers:2400},{GM:a.GM});ok(r.ok&&a.GM.armies[0].soldiers===2400,'Agent absolute soldiers actually sets existing army');
  r=await tools.handle('command_army',{armyName:'御营',soldiers:2400},{GM:a.GM});ok(r.ok&&!r.changed,'Agent no-op does not claim changed');
  ok(a.TMBattleTurn._pending().length===0,'ordinary troop attrition is not fabricated into battle');
  r=await tools.handle('resolve_battle',{battleResult:battle('agent-battle')},{GM:a.GM});ok(r.ok&&a.TMBattleTurn._pending().length===1,'Agent battle registers via same military entry');
  r=await tools.handle('resolve_battle',{battleResult:{...battle('bad'),attackerArmyId:'不存在',affectedArmies:[{armyId:'不存在',loss:100}]}},{GM:a.GM});ok(!r.ok,'Agent invalid battle refs rejected');
  const classic=make();for(const file of ['tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js'])vm.runInContext(read(file),classic,{filename:file});
  let glory=0;classic.AuthorityEngines={adjustHuangwei(_kind,n){glory+=n;return{delta:n};}};
  const anonymous=battle();delete anonymous.battleId;const applied={semantic:{},failed:[]};classic._applyBattleResult(classic.GM,{battleResult:anonymous},applied);
  ok(applied.failed.length===0&&applied.semantic.battleResultDeferred===1&&glory===0,'classic applier reports pending, not failed or an early victory');
  ok(!!anonymous.battleId,'legacy anonymous battle gets a stable ID before persistence');
  classic.TMBattleTurn._clear();classic.GM._pendingAbstractBattles=JSON.parse(JSON.stringify(classic.GM._pendingAbstractBattles));await classic.TMBattleTurn.runPending(classic.GM);
  ok(classic.GM.armies[0].soldiers===2700&&glory===2,'recovered classic battle applies actual casualty and victory aftermath once');
  classic._applyBattleResult(classic.GM,{battleResult:anonymous},{semantic:{},failed:[]});await classic.TMBattleTurn.runPending(classic.GM);
  ok(glory===2&&classic.GM.battleHistory.length===1,'classic battle retry cannot duplicate political rewards');
  console.log('smoke-battle-trigger-contract: '+passed+' PASS / '+failed+' FAIL');process.exitCode=failed?1:0;
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
