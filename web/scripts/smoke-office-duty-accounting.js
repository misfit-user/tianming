'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch(e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
function env() {
  const c = { console, Math, JSON, setTimeout(){}, clearTimeout(){}, P:{conf:{}}, GM:{ turn:1, chars:[], officeTree:[] } };
  c.window=c; c.globalThis=c; c.getRankLevel=()=>2;
  c.findCharByName=n=>c.GM.chars.find(x=>x.name===n);
  vm.createContext(c);
  ['tm-office-holder-state.js','tm-office-action-evidence.js','tm-office-dutystate.js','tm-office-authority.js','tm-office-powermap.js'].forEach(f=>{if(fs.existsSync(path.join(root,f)))vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});});
  const ch={id:'c1',name:'甲',administration:90,military:0,management:90,intelligence:90,wuchang:{ren:90,yi:90,li:90,zhi:90,xin:90}};
  c.GM.chars.push(ch);
  c.GM.officeTree=[{id:'dept1',name:'财赋署',positions:[seat('p1',ch)]}];
  return c;
}
function seat(id,ch){return {id,name:'征税使'+id,rank:'正二品',holder:ch.name,holderId:ch.id,establishedCount:1,actualCount:1,vacancyCount:0,powers:{taxCollect:true},_dutyState:{fulfillment:50,lastTurn:null}};}
function pos(c,n=0){return c.GM.officeTree[0].positions[n];}
function near(a,b){assert(Math.abs(a-b)<1e-8, a+' != '+b);}
for(const action of ['查办受贿案','查办仓库账目','并未受贿，正在核实账册']) test('调查不被调查对象定罪: '+action,()=>{const c=env();c.applyNpcActionToDuty(c.GM,{name:'甲',action});assert(pos(c)._dutyState.fulfillment>=50);});
for(const action of ['经准告病休养','传闻甲受贿','乙受贿，正在核查','未曾结党营私','拟查办受贿案']) test('未证事实与合法请假保持中性: '+action,()=>{const c=env();c.applyNpcActionToDuty(c.GM,{name:'甲',action});near(pos(c)._dutyState.fulfillment,50);});
test('动机中的负面词不能覆盖行动事实',()=>{const c=env();c.applyNpcActionToDuty(c.GM,{name:'甲',action:'查办账目',reason:'怀疑乙受贿'});near(pos(c)._dutyState.fulfillment,55);});
test('真实自身失职仍扣分',()=>{const c=env();c.applyNpcActionToDuty(c.GM,{name:'甲',action:'结党营私、敛财避事、称疾不朝'});near(pos(c)._dutyState.fulfillment,44);});
test('匿名在岗连续两次不会变成空缺',()=>{const c=env();Object.assign(pos(c),{holder:'',holderId:'',actualHolders:[],occupancyStatus:'unrecorded'});c.tickOfficeDutyState(c.GM);c.GM.turn++;c.tickOfficeDutyState(c.GM);near(pos(c)._dutyState.fulfillment,50);assert(!c.buildOfficePowerMap(c.GM).includes('出缺'));assert(c.resolveOfficeAuthority(c.GM,'taxCollect').band!=='vacant');});
test('有效 ID 无姓名镜像仍识别任职者',()=>{const c=env();pos(c).holder='';c.tickOfficeDutyState(c.GM);assert(pos(c)._dutyState.fulfillment>50);assert(c.buildOfficePowerMap(c.GM).includes('甲'));assert(c.resolveOfficeAuthority(c.GM,'taxCollect').holder==='甲');});
test('错误 ID 不得回退同名人',()=>{const c=env();pos(c).holderId='bad';c.tickOfficeDutyState(c.GM);near(pos(c)._dutyState.fulfillment,50);assert(!c.buildOfficePowerMap(c.GM).includes('政90'));});
test('兼任同领域效果共享工作量',()=>{const c=env();pos(c)._dutyState.fulfillment=90;const one=c.tickOfficeDutyState(c.GM).compliance;const d=env();d.GM.officeTree[0].positions=Array.from({length:5},(_,i)=>Object.assign(seat('p'+i,d.GM.chars[0]),{_dutyState:{fulfillment:90,lastTurn:null}}));near(d.tickOfficeDutyState(d.GM).compliance,one);});
test('明确第二职位只改变第二职位',()=>{const c=env();c.GM.officeTree[0].positions.push(seat('p2',c.GM.chars[0]));c.applyNpcActionToDuty(c.GM,{name:'甲',positionId:'p2',action:'查办账目'});near(pos(c)._dutyState.fulfillment,50);near(pos(c,1)._dutyState.fulfillment,55);});
test('未指明兼任职位时不选首个',()=>{const c=env();c.GM.officeTree[0].positions.push(seat('p2',c.GM.chars[0]));assert.strictEqual(c.applyNpcActionToDuty(c.GM,{name:'甲',action:'查办账目'}),null);near(pos(c)._dutyState.fulfillment,50);});
test('同一行动稳定 ID 跨回合重传只记一次',()=>{const c=env();const a={actionId:'a1',name:'甲',action:'查办账目'};c.applyNpcActionToDuty(c.GM,a);c.GM.turn++;c.applyNpcActionToDuty(c.GM,JSON.parse(JSON.stringify(a)));near(pos(c)._dutyState.fulfillment,55);});
test('无 ID 旧格式同回合重传只记一次',()=>{const c=env();const a={name:'甲',action:'查办账目'};c.applyNpcActionToDuty(c.GM,a);c.applyNpcActionToDuty(c.GM,JSON.parse(JSON.stringify(a)));near(pos(c)._dutyState.fulfillment,55);});
test('军事职权不改变监察领域的能力',()=>{const c=env(),d=env();pos(c).powers={supervise:true};pos(d).powers={militaryCommand:true,supervise:true};c.tickOfficeDutyState(c.GM);d.tickOfficeDutyState(d.GM);near(c.resolveOfficeAuthority(c.GM,'supervise').fulfillment,d.resolveOfficeAuthority(d.GM,'supervise').fulfillment);});
function simulate(parts, vacant) {const c=env();if(vacant)Object.assign(pos(c),{holder:'',holderId:'',actualCount:0,vacancyCount:1});pos(c)._dutyState.fulfillment=vacant?40:65;let comp=0;parts.forEach((days,i)=>{c.GM.turn=i+1;comp+=c.tickOfficeDutyState(c.GM,{days}).compliance;});return {f:pos(c)._dutyState.fulfillment,comp};}
for(const vacant of [true,false]) test('累计时间和跨阈值效果不因拆回合变化: '+vacant,()=>{const a=simulate([30],vacant),b=simulate(Array(30).fill(1),vacant);near(a.f,b.f);near(a.comp,b.comp);});
test('零经过时间不漂移不结算',()=>{const c=env();const a=c.tickOfficeDutyState(c.GM,{days:0});near(pos(c)._dutyState.fulfillment,50);near(a.compliance,0);});
test('回合守卫仍然有效',()=>{const c=env();c.tickOfficeDutyState(c.GM);const f=pos(c)._dutyState.fulfillment;const a=c.tickOfficeDutyState(c.GM);near(pos(c)._dutyState.fulfillment,f);near(a.compliance,0);});
test('同名者通过稳定 ID 正确归责',()=>{const c=env();c.GM.chars.push({...c.GM.chars[0],id:'c2'});pos(c).holderId='c2';c.applyNpcActionToDuty(c.GM,{characterId:'c2',name:'错误镜像',action:'查办账目'});near(pos(c)._dutyState.fulfillment,55);});
test('同名歧义与错误行动 ID 不猜测',()=>{const c=env();c.GM.chars.push({...c.GM.chars[0],id:'c2'});assert.strictEqual(c.applyNpcActionToDuty(c.GM,{name:'甲',action:'查办账目'}),null);assert.strictEqual(c.applyNpcActionToDuty(c.GM,{characterId:'missing',name:'甲',action:'查办账目'}),null);near(pos(c)._dutyState.fulfillment,50);});
test('结构化调查、对象、事实和传闻独立',()=>{const c=env();const a={characterId:'c1',actionId:'structured',action:'王某受贿',dutyEvidence:{actorId:'c1',subjectId:'other',kind:'investigation',status:'confirmed'}};c.applyNpcActionToDuty(c.GM,a);near(pos(c)._dutyState.fulfillment,55);for(const status of ['rumor','denied','planned'])c.applyNpcActionToDuty(c.GM,{...a,actionId:status,dutyEvidence:{actorId:'c1',subjectId:'c1',kind:'misconduct',status}});near(pos(c)._dutyState.fulfillment,55);});
test('对象的已确认过失不扣行动者',()=>{const c=env();c.applyNpcActionToDuty(c.GM,{characterId:'c1',action:'查明乙受贿',dutyEvidence:{actorId:'c1',subjectId:'other',kind:'misconduct',status:'confirmed'}});near(pos(c)._dutyState.fulfillment,50);});
test('行动不改无关职权领域',()=>{const c=env();pos(c).powers={militaryCommand:true,supervise:true};c.tickOfficeDutyState(c.GM);const m=pos(c)._dutyState.byPower.militaryCommand,s=pos(c)._dutyState.byPower.supervise;c.applyNpcActionToDuty(c.GM,{name:'甲',power:'supervise',action:'查办受贿案'});near(pos(c)._dutyState.byPower.militaryCommand,m);near(pos(c)._dutyState.byPower.supervise,s+5);});
test('行动与领域去重保留不同辖区',()=>{const c=env();c.GM.officeTree[0].positions.push(seat('p2',c.GM.chars[0]));const a={name:'甲',positionId:'p1',actionId:'one-result',action:'查办账目'};c.applyNpcActionToDuty(c.GM,a);c.applyNpcActionToDuty(c.GM,{...a,positionId:'p2'});near(pos(c,1)._dutyState.fulfillment,50);pos(c,1).jurisdictionId='second';c.applyNpcActionToDuty(c.GM,{...a,positionId:'p2'});near(pos(c,1)._dutyState.fulfillment,55);});
test('合法零值力度可关闭奖惩和漂移',()=>{const c=env();pos(c)._dutyState.fulfillment=90;const a=c.tickOfficeDutyState(c.GM,{force:{driftRate:0,compHigh:0}});near(pos(c)._dutyState.fulfillment,90);near(a.compliance,0);});
console.log(JSON.stringify({pass,fail}));process.exitCode=fail?1:0;
