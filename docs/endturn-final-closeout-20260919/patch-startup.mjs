import fs from 'node:fs';
import {edit} from './patch-utils.mjs';
const base=JSON.parse(fs.readFileSync('docs/endturn-final-closeout-20260919/baseline-full-tests.json','utf8'));if(!base.complete)throw Error('Wait for immutable baseline');
edit('web/index.html',(s,r)=>{
 function tag(name){const t=s.match(new RegExp('<script[^>]+src="'+name.replaceAll('.','\\.')+'[^\"]*"[^>]*><\\/script>'));if(!t)throw Error('Missing anchor '+name);return t[0];}
 function add(anchor,names,before=true){const t=tag(anchor),fresh=names.filter(n=>!s.includes('src="'+n));fresh.forEach(n=>{if(!fs.existsSync('web/'+n))throw Error('Missing provider '+n);});if(fresh.length){const block=fresh.map(n=>'<script src="'+n+'?v=20260919-complete"></script>').join('\n');s=r(s,t,before?block+'\n'+t:t+'\n'+block);}}
 add('tm-utils.js',['tm-start-contracts.js']);
 add('tm-ai-infra-json.js',['tm-ai-request-options.js','tm-api-models.js','tm-api-settings.js']);
 add('tm-indices.js',['tm-start-world.js','tm-native-fiscal-adapter.js','tm-native-scope.js','tm-native-fiscal-ui.js']);
 add('tm-office-reform.js',['tm-office-creation.js']);
 add('tm-custom-build-agent.js',['tm-building-orders.js'],false);
 add('tm-fiscal-engine.js',['tm-char-economy-ledger.js','tm-fiscal-statements.js']);
 add('tm-public-treasury.js',['tm-military-arrears.js','tm-command-authority.js'],false);
 add('tm-patches-start.js',['libs/polygon-clipping-0.15.7.min.js','tm-map-workbench.js','tm-map-workbench-client.js','tm-start-compiler.js','tm-start-preparation-document.js','tm-start-preparation.js','tm-start-commit.js','tm-start-selector.js']);
 return s;
});
