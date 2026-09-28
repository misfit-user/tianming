'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..'),rel='web/modules/ai-change-applier/validators.js',p=path.join(root,rel),s=fs.readFileSync(p,'utf8'),nl=s.includes('\r\n')?'\r\n':'\n';
const anchor='      var _hit = function(t) { return _textMentionsName(t, nm, allNames); };';if(s.indexOf(anchor)!==s.lastIndexOf(anchor)||!s.includes(anchor))throw Error('anchor');
const insert=[anchor,
 '      // Only real player submissions in this turn may authorize a judicial write.',
 '      var turn = Number(G.turn || 0);',
 "      if ((G.edicts || []).some(function(e) { return e && e.turn === turn && e.status === 'promulgated' && _hit(e.text); })) return true;",
 '      var submitted = (G._edictTracker || []).some(function(e) {',
 "        if (!e || (e.turn !== turn && e.lastSubmittedTurn !== turn) || /^(cancelled|failed|pending_delivery)$/.test(e.status || '')) return false;",
 '        if ((e._letterIds || []).some(function(id) {',
 '          var letter = (G.letters || []).find(function(l) { return l && l.id === id; });',
 "          return !letter || ['delivered','returned','replying'].indexOf(letter.status) < 0;",
 '        })) return false;',
 '        return _hit(e.content);',
 '      });',
 '      if (submitted) return true;'
].join(nl);
const backup=path.join(__dirname,'before',rel);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(p,backup);fs.writeFileSync(p,s.replace(anchor,()=>insert));
