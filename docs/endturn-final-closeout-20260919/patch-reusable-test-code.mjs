import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-start-game-data-integrity.js',(s,r)=>{
 s=r(s,'let disposeGame = function() {};','const compiledScripts = new Map(); // Reuse parsed code only; every case still owns a fresh world and VM.\nlet disposeGame = function() {};');
 s=r(s,'  // A browser lazy-loads the complete selected world, not every unrelated official scenario.','  if (selectedSid !== null) {\n  // A browser lazy-loads the complete selected world, not every unrelated official scenario.');
 s=r(s,"  if (!loadScripts.includes(selected.scriptUrl)) loadScripts.push(selected.scriptUrl);","  if (!loadScripts.includes(selected.scriptUrl)) loadScripts.push(selected.scriptUrl);\n  }");
 s=r(s,"    try { vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 }); } finally { sandbox.document.currentScript = null; }",`    let compiled = compiledScripts.get(src);
    if (!compiled || compiled.source !== code) { compiled = { source: code, script: new vm.Script(code, { filename: src, displayErrors: true }) }; compiledScripts.set(src, compiled); }
    try { compiled.script.runInContext(sandbox, { displayErrors: true, timeout: 10000 }); } finally { sandbox.document.currentScript = null; }`);
 return s;
});
edit('web/scripts/smoke-tang840-opening-ledgers.js',(s,r)=>r(s,"const c=h.loadGame('sc-tang840-840'),sc=","// This native-import test installs the entire canonical JSON below; do not retain a redundant JS copy.\nconst c=h.loadGame(null),sc="));
