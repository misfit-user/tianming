'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');let checks=0;function ok(v,m){assert(v,m);checks++;}
const c={console,P:{},GM:{},findCharByName:n=>c.GM.chars.find(x=>x.name===n)};c.window=c;vm.createContext(c);
const mil=fs.readFileSync(path.join(root,'tm-military.js'),'utf8');vm.runInContext(mil.slice(mil.indexOf('var MilitarySystems ='),mil.indexOf('var BattleEngine =')),c);
const helper=fs.readFileSync(path.join(root,'tm-endturn-helpers.js'),'utf8');vm.runInContext(helper.slice(helper.indexOf('function _walkOfficeTree'),helper.indexOf('/**\r\n * 获取官制职能摘要')>0?helper.indexOf('/**\r\n * 获取官制职能摘要'):helper.indexOf('/**\n * 获取官制职能摘要')),c);
const edict=fs.readFileSync(path.join(root,'tm-endturn-edict.js'),'utf8');vm.runInContext(edict.slice(edict.indexOf('function computeExecutionPipeline'),edict.indexOf('// ============================================================',edict.indexOf('function computeExecutionPipeline'))),c);
c.P={engineConstants:{militarySystems:[{id:'a',name:'甲军',recruitmentType:'paid',loyaltyAttribution:'leader'},{id:'b',name:'乙军',recruitmentType:'paid',loyaltyAttribution:'local'}]}};
ok(c.MilitarySystems.getMilitarySystemForArmy({systemId:'b',type:'甲军'},{}).id==='b','explicit id wins over type');
ok(c.MilitarySystems.getMilitarySystemForArmy({systemId:'typo',type:'甲军'},{}).id==='unclassified','invalid explicit id never silently rebinds');
ok(c.MilitarySystems.getMilitarySystemForArmy({type:'paid'},{}).id==='a','unbound legacy recruitment keeps its existing behavior');
ok(c.MilitarySystems.getMilitarySystemForArmy({type:'infantry'},{}).id==='a','old saves without explicit binding are not silently migrated');
c.P.engineConstants.militarySystems.pop();ok(c.MilitarySystems.getMilitarySystemForArmy({},{}).id==='a','legacy single system remains usable');
const scenario=path.join(root,'../scenarios/晚唐·开成五年（官方）.json');
if(fs.existsSync(scenario)){const s=JSON.parse(fs.readFileSync(scenario));c.P=s;c.GM={officeTree:s.officeTree,chars:s.characters};const found=new Set();for(const a of s.military.initialTroops){const system=c.MilitarySystems.getMilitarySystemForArmy(a,c.GM);ok(system.id===a.militarySystemId&&system.id!=='unclassified','every Tang army resolves explicitly');found.add(system.id);}ok(found.size>=8,'different institutional roles are retained');const e=c.computeExecutionPipeline('令有司核查收支','经济');ok(e.stages.length===4,'four configured stages');ok(e.stages[0].officer==='杨嗣复','current court official found');ok(e.stages[2].officer==='杜悰'&&e.stages[2].note!=='空缺','documented Tang fiscal incumbent Du Cong resolves: '+JSON.stringify(e.stages[2]));}
c.P={mechanicsConfig:{executionPipeline:[{name:'承办',functionKey:'military'}]}};c.GM={officeTree:[{name:'军务机关',functions:['military'],positions:[{name:'军务长官',holder:'甲',rank:1}]}],chars:[{name:'甲',military:0,ability:90,loyalty:0}]};let e=c.computeExecutionPipeline('调兵','军令');ok(e.stages[0].ability===0&&e.stages[0].loyalty===0,'legitimate zero attributes are not replaced with defaults');
c.P={mechanicsConfig:{executionPipeline:[{name:'承办',functionKey:'财计收支'}]}};c.GM.officeTree=[{name:'议政机关',positions:[{name:'议政官',holder:'甲',duties:'参与财计收支议论'}]},{name:'财计机关',functions:['财计收支'],positions:[{name:'财计官',holder:''}]}];e=c.computeExecutionPipeline('拨款','经济');ok(e.stages[0].note==='空缺'&&!e.stages[0].officer,'explicit vacant department wins over incidental text on a filled office');
console.log('PASS military-execution-binding '+checks+' checks');
