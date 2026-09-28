'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..');
function edit(file,fn){const p=path.join(root,file),s=fs.readFileSync(p,'utf8'),backup=path.join(__dirname,'before',file);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(p,backup);const next=fn(s);if(next===s)throw Error('No edit '+file);fs.writeFileSync(p,next);}
function one(s,from,to){if(s.indexOf(from)<0||s.indexOf(from)!==s.lastIndexOf(from))throw Error('Nonunique anchor '+from.slice(0,100));return s.replace(from,()=>to);}
edit('web/modules/ai-change-applier/core.js',s=>{
 const nl=s.includes('\r\n')?'\r\n':'\n';
 s=one(s,"    var ch = _findChar(charName);"+nl+"    if (!ch) return { ok: false, reason: '未找到 ' + charName };",[
 "    var identity = typeof global._offResolveCharacterIdentity === 'function' ? global._offResolveCharacterIdentity(charName, G) : null;",
 "    if (identity && !identity.ok && identity.reason !== 'character-stable-id-missing') return { ok:false, reason:identity.reason };",
 "    var ch = identity && identity.ok ? identity.char : _findChar(charName);",
 "    if (!ch) return { ok: false, reason: '未找到 ' + charName };",
 "    charName = ch.name;"
 ].join(nl));
 s=one(s,'    // ★ 清 officeTree 里所有此人 holder + actualHolders'+nl+'    (function _clearAll(nodes){',[
 '    // Stable-ID office owner clears all seats, mirrors and treasury heads together.',
 "    if (ch.id && typeof global._offVacateByCharId === 'function') {",
 "      var vacated = global._offVacateByCharId(ch.id, reason || '免职', G.officeTree, { world:G, leaveVacancy:true });",
 '      if (!vacated.ok) return { ok:false, reason:vacated.reason };',
 '    } else (function _clearAll(nodes){'
 ].join(nl));
 s=one(s,"    ch.position = '';"+nl+"    ch.title = '';", "    ch.position = '';"+nl+"    if (ch.currentPosition && typeof ch.currentPosition === 'object') ch.currentPosition.title = '';"+nl+"    ch.title = '';");
 s=one(s,'      var changeText = String(pc.change || \'\').trim();',"      var changeText = String(pc.change || pc.desc || '').trim();");
 s=one(s,'if (/\\u4E0B\\u72F1|\\u5165\\u72F1|\\u7CFB\\u72F1|\\u6349\\u62FF|\\u902E\\u6355|\\u6293\\u6355|\\u7F09\\u62FF/.test(changeText))', 'if (_tmReasonIsImprison(changeText))');
 s=one(s,'} else if (/\\u62C4\\u5BB6|\\u62C4\\u6CA1|\\u7C4D\\u6CA1|\\u67E5\\u62C4|\\u6CA1\\u5B98/.test(changeText))', '} else if (/抄家|抄没|籍没|查抄|没官/.test(changeText))');
 s=one(s,'} else if (/(\\u514D\\u804C|', '} else if (/(革职|革除|撤职|褫职|削职|夺职|解职|\\u514D\\u804C|');
 s=one(s,"        action = 'dismiss';"+nl+"      } else if (/(\\u65A9", "        action = 'dismiss'; reason = changeText + (pc.reason ? '；' + pc.reason : '');"+nl+"      } else if (/(\\u65A9");
 s=one(s,"if (!post && pc.former && changeText.indexOf(pc.former) < 0)", "if (!post && pc.former && changeText.indexOf(pc.former) < 0 && _isKnownOfficeType(G, changeText))");
 s=one(s,"else if (action === 'dismiss') r = onDismissal(pc.name, reason, aiOutput);", "else if (action === 'dismiss') r = onDismissal(pc.characterId || pc.charId || pc.name, reason, aiOutput);");
 return s;
});
