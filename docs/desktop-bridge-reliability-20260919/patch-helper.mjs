import fs from 'node:fs';
import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-reliability.js',(s,r)=>{
  s=r(s,'  function snapshot() {',fs.readFileSync('docs/desktop-bridge-reliability-20260919/bridge.fragment.txt','utf8')+'  function snapshot() {');
  s=r(s,'    assertReady: function(p)', '    callTurnBridge: callTurnBridge, bridgeDiagnostics: bridgeDiagnostics,\n    assertReady: function(p)');
  return s;
});
