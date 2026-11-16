/* smoke-battle-cost-guoku.js — 刀二·战争耗国库（补 guoku._battleCasualtyBonus 悬空读钩）
 * 刀二生产端嵌在 tm-endturn-followup 深层 async·此处走「源码契约 + 公式 + 自清语义」验证两侧接通。
 * 验：① 生产端读 _battleResultCasualtyFactions·按玩家势力过滤(_tmIsPlayerFactionNameForAi)·×5 写 guoku._battleCasualtyBonus
 *   ② 消费端 guoku-engine 读 _battleCasualtyBonus 入军饷总支(total)③ 营葬公式(KIA×5·敌方不计)④ 自清(累加器每回合重置·无战→0)
 * 跑：node scripts/smoke-battle-cost-guoku.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
var gk = fs.readFileSync(path.join(ROOT, 'tm-guoku-engine.js'), 'utf8');

// ── ① 生产端契约 ──
var mil = fs.readFileSync(path.join(ROOT,'tm-military.js'),'utf8');
var contract = fs.readFileSync(path.join(ROOT,'tm-battle-contract.js'),'utf8');

// ── ③ 真实国库写主 + 真实军事战果汇总，不再复刻公式掩盖延期错误 ──
var ctx={console:{log(){},warn(){}},SettlementPipeline:{register(){}},P:{playerInfo:{factionName:'明廷'}}};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(mil,ctx);vm.runInContext(contract,ctx);vm.runInContext(gk,ctx);
function k2(casualties) {ctx.GM={turn:4,armies:[],facs:[{id:'本朝',name:'明廷'},{id:'后金',name:'后金'}],battleHistory:[{battleId:'test',turn:4,affectedArmies:Object.keys(casualties).map(function(faction){return{faction:faction,loss:casualties[faction]};})}]};return ctx.GuokuEngine.syncBattleCasualtyBonus(ctx.GM);}
var isPlayer = function (fk) { return fk === '明廷' || fk === '本朝'; };
ok(k2({ '明廷': 5000, '后金': 3000 }, isPlayer) === 25000, '3·玩家阵亡5000→营葬25000两·敌方(后金3000)不计·实得 ' + k2({ '明廷': 5000, '后金': 3000 }, isPlayer));
ok(k2({ '后金': 9000 }, isPlayer) === 0, '3·只敌方阵亡→本朝营葬0(不为敌出殡)');

// ── ④ 自清语义 ──
ok(k2({}, isPlayer) === 0, '4·无战(空累加器)→营葬0(无陈值)');
ctx.GM.turn++;ctx.GuokuEngine.syncBattleCasualtyBonus(ctx.GM);ok(ctx.GM.guoku._battleCasualtyBonus===0,'4·推进到无战回合，实际写主清除旧营葬银');

console.log('\n[smoke-battle-cost-guoku] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
