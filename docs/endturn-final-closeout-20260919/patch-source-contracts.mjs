import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-endturn-baseline-helpers.js',(s,r)=>r(s,"  'tm-endturn-ai.js',", "  'tm-endturn-ai-sc1-budget.js', // Shared exact schema providers precede their consumers.\n  'tm-endturn-ai.js',"));
edit('web/scripts/smoke-sc1q-sc19-upgrade.js',(s,r)=>r(s,"const ai = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai.js'), 'utf8');","const ai = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai.js'), 'utf8') + '\\n' + fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai-sc1-budget.js'), 'utf8');"));
edit('web/scripts/smoke-search-empty-state.js',(s,r)=>{
 const line=s.split('\n').find(l=>l.startsWith('ok(/host\\.innerHTML = rows\\.length'));
 if(!line)throw Error('Expected legacy search assignment assertion');
 return r(s,line,"ok(/var resultsHtml = rows\\.length \\?/.test(mapSrc) && /if \\(host\\.innerHTML !== resultsHtml\\) host\\.innerHTML = resultsHtml;/.test(mapSrc), '① 保留空结果与非空结果逻辑，仅跳过相同 HTML 的重复赋值');");
});
