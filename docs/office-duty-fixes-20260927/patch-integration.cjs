const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'), inputs=JSON.parse(fs.readFileSync(path.join(__dirname,'inputs.json')));
function edit(file,fn) {
  const p=path.join(root,file), old=fs.readFileSync(p,'utf8');
  if(!inputs.some(x=>x.file===file)){const b=Buffer.from(old), dest=path.join(__dirname,'before',file+'.bak');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);inputs.push({file,sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length,crlf:(old.match(/\r\n/g)||[]).length});}
  let text=old;
  function r(a,b){if(!text.includes(a))throw Error('Missing in '+file+': '+a.slice(0,95));text=text.replace(a,b);}
  fn(r,text);fs.writeFileSync(p,text);
}
edit('web/tm-endturn-apply.js',r=>{
  r('if (!act.name || !act.action) return;', "if (!act || !act.action) return;\r\n            var _officeIdentity = global.TM && global.TM.OfficeHolderState;\r\n            if (_officeIdentity && (act.characterId != null || act.actorId != null)) {\r\n              var _stableActor = _officeIdentity.identity(GM, act.characterId != null ? act.characterId : act.actorId, '').char;\r\n              if (!_stableActor) return;\r\n              act.name = _stableActor.name;\r\n            }\r\n            if (!act.name) return;");
  r("Math.min(20, Number(mc.amount) || 8), mc.reason || '立功'", "Math.min(20, mc.amount == null ? 8 : Number(mc.amount)), mc.reason || '立功', mc");
  r("var _mch = (typeof findCharByName === 'function') ? findCharByName(mc.name) : null;", "var _mch = global.TM && global.TM.OfficeHolderState ? global.TM.OfficeHolderState.identity(GM, mc.characterId, mc.name).char : ((typeof findCharByName === 'function') ? findCharByName(mc.name) : null);");
});
edit('web/tm-endturn-apply-stages.js',r=>{
  r("p1.npc_actions.forEach(function(act) {\r\n          if (act.name", "p1.npc_actions.forEach(function(act) {\r\n          if (global.TM && global.TM.OfficeHolderState && (act.characterId != null || act.actorId != null)) {\r\n            var stableActor = global.TM.OfficeHolderState.identity(GM, act.characterId != null ? act.characterId : act.actorId, '').char;\r\n            if (!stableActor || stableActor.alive === false || stableActor.dead) { act._hallucinated = true; return; }\r\n            act.name = stableActor.name; return;\r\n          }\r\n          if (act.name");
});
edit('web/tm-ai-schema.js',r=>{
  r("desc: 'NPC 自主行动（兼容旧 prompt；endturn 仍消费）'", "desc: 'NPC 自主行动：name/characterId 指行动者，actionId 标识同一行动；兼任须填 positionId 或 appointmentId，power 指此次事务。dutyEvidence={actorId,subjectId,kind:investigation|work|misconduct|leave,status:confirmed|observed|rumor|denied|planned,negated,approved,capacity,delegateId}。调查对象与行为人分开；未经证实、否定和合法休假不算失职；reason 只说明缘由'");
});
edit('web/modules/ai-change-applier/fiscal-posting.js',r=>{
  r("return { id: fa.id ? String(fa.id) : prefix + String(index) + ':' + hash(sig), resource:", "var stable = fa.id != null ? String(fa.id) : (fa.operationId || fa.actionId) ? JSON.stringify([fa.operationId || fa.actionId, fa.target, fa.kind, fa.resource || 'money']) : '';\n    return { id: stable || prefix + String(index) + ':' + hash(sig), resource:");
});
edit('web/index.html',(r,text)=>{
  const names=['tm-office-powermap.js','tm-office-dutystate.js','tm-office-authority.js','tm-endturn-helpers.js','tm-endturn-apply.js','tm-endturn-apply-stages.js','tm-char-economy-engine.js','tm-ai-schema.js','generated/tm-ai-change-applier.bundle.js'];
  for(const name of names){const m=text.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?v=[^"\\s]+'));if(m)r(m[0],name+'?v=20260927-office-duty');}
});
fs.writeFileSync(path.join(__dirname,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
console.log('integration patched preserving original line endings');
