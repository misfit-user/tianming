import { parse } from 'acorn';
import { edit } from './patch-utils.mjs';
edit('web/tm-state-snapshot.js',(s,r)=>{
  const scopes={_putRecord:'write',_getTimelineRecordKeys:'keys',_getTimelineRecords:'list',_getLineageRecord:'lineage-read',_getExactRecord:'read',recordTimeline:'lineage-write',_enforceLRU:'cleanup',deleteSnapshot:'delete'};
  const found=[];
  function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id&&scopes[n.id.name])found.push(n);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
  visit(parse(s,{ecmaVersion:'latest'}));if(found.length!==8)throw Error('Expected eight snapshot transaction owners');
  for(const n of found.sort((a,b)=>b.start-a.start)){
    const before=s.slice(n.start,n.end);const m=before.match(/([ \t]*)return new Promise\(function\(resolve, reject\) \{\r?\n[ \t]*var tx;/);
    if(!m||before.match(/return new Promise\(/g).length!==1)throw Error('Unexpected transaction shape: '+n.id.name);
    let after=r(before,m[0],m[1]+'var tx;\n'+m[1]+"return _snapshotOperation('"+scopes[n.id.name]+"', function() { return tx; }, function(resolve, reject, alive) {");
    if(n.id.name==='_getTimelineRecordKeys')after=r(after,'            cursorReq.onsuccess = function() {','            cursorReq.onsuccess = function() {\n              if (!alive()) return;');
    s=r(s,before,after);
  }
  return s;
});
