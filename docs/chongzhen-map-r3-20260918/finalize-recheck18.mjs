// Final continuation check. Reads the installed source; writes evidence only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]);
const doc=path.join(root,'docs/chongzhen-map-r3-20260918'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(w,n),'utf8'));
const source=fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json')),s=JSON.parse(source),sha=hash(source);
const geo=read('geometry-verification.json'),native=read('native-installed-verification.json'),ui=read('native-ui-r3-pointer18/report.json'),reg=read('recheck18/regressions.json'),baseline=read('baseline.json');
assert.equal(sha,hash(fs.readFileSync(path.join(w,'candidate.json'))));
for(const r of [geo,native]){assert.equal(r.candidateSha256,sha);assert.equal(r.failed,0);}
assert.equal(ui.sourceSha256,sha);assert.equal(ui.complete,true);assert.equal(ui.exitCode,0);assert.ok(ui.checks.every(c=>c.passed));
assert.equal(ui.pointerChecks.length,3);assert.equal(reg.complete,true);
assert.ok(reg.results.filter(r=>r.name!=='lint-arch-all.js').every(r=>r.passed));
for(const f of baseline.otherSources)if(f.file!==baseline.source)assert.equal(hash(fs.readFileSync(path.join(root,f.file))),f.sha256,'Other official source changed');
assert.equal(s.map.regions.length,307);assert.equal(s.map.circuitRegistry.length,43);
const reportPath=path.join(doc,'验收结果.json'),prior=fs.readFileSync(reportPath);
fs.mkdirSync(path.join(w,'recheck18'),{recursive:true});
fs.writeFileSync(path.join(w,'recheck18/prior-delivery-report.json'),prior);
const final=JSON.parse(prior);final.verifiedAt=new Date().toISOString();final.sourceSha256=sha;
final.checks.geometry={passed:geo.passed,failed:geo.failed};final.checks.native={passed:native.passed,failed:native.failed};
final.checks.browser={passed:ui.checks.length,failed:0,includesRealPointerChecks:true};
final.checks.pointer={passed:3,failed:0,regions:ui.pointerChecks.map(r=>r.target.name),note:'Subset of browser checks; not additional test totals'};
final.checks.regressionScripts=reg.results;final.architecturePassed=reg.results.find(r=>r.name==='lint-arch-all.js').passed;
final.releaseReady=false;final.officialMapApplied=true;
const images=[['map-realm.png','天下全景.png'],['map-region.png','省道全景.png'],['map-prefecture.png','府州全景.png'],['map-liaodong-detail.png','关宁防线方志.png'],['map-pidao-dossier.png','皮岛与东江方志.png']];
final.screenshots=[];
for(const [file,name]of images){
 const b=fs.readFileSync(path.join(w,'native-ui-r3-pointer18',file));assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(b.length>10000);
 const target=path.join(doc,'screenshots',name);fs.writeFileSync(target,b);assert.equal(hash(fs.readFileSync(target)),hash(b));
 final.screenshots.push({file:path.relative(root,target).replaceAll('\\','/'),sha256:hash(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20)});
}
const copies=[['geometry-verification.json','geometry-recheck18.json'],['native-installed-verification.json','native-recheck18.json'],['native-ui-r3-pointer18/report.json','native-pointer-recheck18.json'],['recheck18/regressions.json','regressions-recheck18.json'],['recheck18/regressions/lint-arch-all.js.log','architecture-recheck18.log'],['recheck18/regressions/verify-official-scenario-parity.js.log','official-parity-recheck18.log']];
for(const [from,to]of copies)fs.copyFileSync(path.join(w,from),path.join(doc,'reports',to));
final.lastContinuation={time:final.verifiedAt,sourceUnchanged:true,scope:'Finish interrupted R3; rerun installed tests and real pointer input; refresh screenshots and evidence; no new polity or financial changes',pointerReport:'reports/native-pointer-recheck18.json'};
fs.writeFileSync(reportPath,JSON.stringify(final,null,2));
fs.writeFileSync(path.join(w,'recheck18/final-verification.json'),JSON.stringify(final,null,2));
const note='\n## 续作收口复验\n\n本轮继续完成中断的R3验收，未另起一个只有编号变化的R4。重新核对已安装官方源与候选逐字节相同，950项几何、31项原生适配、25项浏览器检查通过。浏览器检查包含对锦州城、觉华岛、皮岛三个地块发送实际鼠标输入，并核实方志对应ID；不是只调用打开面板函数。\n\n9个地图相关回归及官方派生对账均通过；全仓架构门禁仍未全绿。最新三级截图及两张局部方志图已覆盖本目录同名生成图，旧尝试记录仍保留于工作目录。未执行Git提交、推送、发布或用户存档改写。\n';
const manual=path.join(doc,'使用与修订说明.md');let text=fs.readFileSync(manual,'utf8');if(!text.includes('## 续作收口复验'))fs.appendFileSync(manual,note);
console.log(JSON.stringify({verifiedAt:final.verifiedAt,sourceSha256:sha,geometry:final.checks.geometry,native:final.checks.native,browser:final.checks.browser,pointer:final.checks.pointer,architecturePassed:final.architecturePassed,screenshots:final.screenshots},null,2));
