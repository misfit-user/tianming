'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..');
function edit(rel,from,to){const p=path.join(root,rel),s=fs.readFileSync(p,'utf8'),nl=s.includes('\r\n')?'\r\n':'\n';from=from.replace(/\n/g,nl);to=to.replace(/\n/g,nl);if(!s.includes(from)||s.indexOf(from)!==s.lastIndexOf(from))throw Error('anchor '+rel);const backup=path.join(__dirname,'before',rel);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(p,backup);fs.writeFileSync(p,s.replace(from,()=>to));}
edit('web/tm-office-system.js',
 '    if (Array.isArray(n.subs) && _offWalkOfficeTree(n.subs, visitor, curChain) === false) return false;',
 '    var branches = Array.isArray(n.subs) ? n.subs.slice() : [];\n    (Array.isArray(n.children) ? n.children : []).forEach(function(child) { if (branches.indexOf(child) < 0) branches.push(child); });\n    if (_offWalkOfficeTree(branches, visitor, curChain) === false) return false;');
edit('web/modules/ai-change-applier/core.js',
 "      if (!changeText) return;\n      // 动作识别",
 "      if (!changeText) return;\n      if (/^(?:留任|原职留任|原职照旧|暂不|尚未|未予|不予|拟议|建议)/.test(changeText)) return;\n      // 动作识别");
edit('web/modules/ai-change-applier/validators.js',
 '    var judicial = /下狱|',
 "    var judicial = (typeof global._tmReasonIsImprison === 'function' && global._tmReasonIsImprison(changeText)) || /下狱|");
