const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),inputs=JSON.parse(fs.readFileSync(path.join(__dirname,'inputs.json')));
function edit(file,fn){const p=path.join(root,file),old=fs.readFileSync(p,'utf8');if(!inputs.some(x=>x.file===file)){const b=Buffer.from(old),dest=path.join(__dirname,'before',file+'.bak');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);inputs.push({file,sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length,crlf:(old.match(/\r\n/g)||[]).length});}let text=old;function r(a,b){if(!text.includes(a))throw Error(file+': missing '+a);text=text.split(a).join(b);}fn(r,text);fs.writeFileSync(p,text);}
edit('web/tm-office-runtime.js',r=>{
 r("!p.holder&&p.occupancyStatus!=='unrecorded'",'!_offOccupancy(p).occupied');
 r("!!p.holder||p.occupancyStatus==='unrecorded'",'_offOccupancy(p).occupied');
 r("!fi.node.holder&&fi.node.occupancyStatus!=='unrecorded'",'!_offOccupancy(fi.node).occupied');
 r("!!fi.node.holder||fi.node.occupancyStatus==='unrecorded'",'_offOccupancy(fi.node).occupied');
 r('if (!p.holder)', 'if (!_offOccupancy(p).occupied)');
 r('var _holder = nd.holder ? findCharByName(nd.holder) : null;', 'var _holder = _offOccupancy(nd).primary;');
 r("var _unrecorded=nd.occupancyStatus==='unrecorded'&&!_holder;",'var _unrecorded=_offOccupancy(nd).occupied&&!_holder;');
 r('var _isVacant = !_holder;', 'var _isVacant = !_offOccupancy(nd).occupied;');
 for(const f of ['_mourning','_sickLeave','_actingPos','_demoted','_retirePending'])r('else if (_holder.'+f+')','else if (_holder && _holder.'+f+')');
 r("  } else {\r\n    // 在任者行", "  } else if (!_holder) {\r\n    html += '<div class=\"og-v10-pos-holder\">' + escHtml(_offOccupancy(nd).label) + '</div>';\r\n  } else {\r\n    // 在任者行");
 r('var _pc = findCharByName(p.holder);','var _pc = _offOccupancy(p).primary;');
 r('var ch = _officeFindCharByName(pos.holder, root);','var ch = _offOccupancy(pos, root).primary;');
});
edit('web/tm-office-runtime-summary-appoint.js',r=>{
 r('if (!p.holder)', 'if (!_offOccupancy(p).occupied)');
 r('if (!p.holder && _vacNames.length < 5)', 'if (_offOccupancy(p).vacancyCount > 0 && _vacNames.length < 5)');
 r('var _fc = findCharByName(p.holder);','var _fc = _offOccupancy(p).primary;');
 r('var _pc = findCharByName(p.holder);','var _pc = _offOccupancy(p).primary;');
});
edit('web/index.html',(r,text)=>{for(const name of ['tm-office-runtime.js','tm-office-runtime-summary-appoint.js']){const m=text.match(new RegExp(name.replace(/\./g,'\\.')+'\\?v=[^"\\s]+'));if(m)r(m[0],name+'?v=20260927-office-duty');}});
fs.writeFileSync(path.join(__dirname,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
console.log('occupancy UI consumers patched');
