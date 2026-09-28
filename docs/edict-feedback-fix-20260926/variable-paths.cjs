'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-ai-change-pathutils.js',s=>{
 s=R(s,"    p = p.replace(/^(vars|variables|var|变量|變量|七变量|七變量)\\./i, '');", "    var variablePrefix = /^(vars|variables|var|变量|變量|七变量|七變量)\\./i.test(p);\n    p = p.replace(/^(vars|variables|var|变量|變量|七变量|七變量)\\./i, '');");
 const a=s.indexOf('  function _normalizeCoreVarPath('),b=s.indexOf('\n  function ',a+10);let part=s.slice(a,b);
 const ret=part.split(/\r?\n/).find(l=>l.includes('return aliases['));if(!ret)throw Error('normalize path return');part=R(part,ret,"    return aliases[p] || (variablePrefix && !/^(guoku|neitang|huangwei|huangquan|minxin|corruption)\\./.test(p) ? 'vars.' + p : p);");return s.slice(0,a)+part+s.slice(b);
});
edit('web/tm-endturn-ai-infer.js',s=>R(s,'          if (TM.EdictEffects) TM.EdictEffects.cancel(GM);\n          if (TM.EdictOutcomes) TM.EdictOutcomes.receive(GM,{edict_feedback:[]},ctx.input.edicts||{},GM.turn,[]);',`          var partialEdictEffects=TM.EdictEffects?TM.EdictEffects.fail(GM,ctx):[];
          if (TM.EdictOutcomes) TM.EdictOutcomes.receive(GM,ctx.results.sc1||{edict_feedback:[]},ctx.input.edicts||{},GM.turn,partialEdictEffects);`));
