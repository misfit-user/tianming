'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/scripts/smoke-startup-phase-observability.js',s=>{
 s=R(s,"const edictEfficacyModules=['tm-edict-efficacy.js'];","const edictEfficacyModules=['tm-edict-efficacy.js','tm-edict-outcomes.js','tm-edict-effects.js'];");
 const line="assert(scriptNames.indexOf('tm-edict-efficacy.js')<scriptNames.indexOf('tm-endturn-prep.js'),'edict efficacy loads before its turn-prep consumer');";
 return R(s,line,line+"\nedictEfficacyModules.forEach(name=>assert(scriptNames.indexOf(name)<scriptNames.indexOf('tm-endturn-prep.js'),name+' loads before collection and inference'));");
});
