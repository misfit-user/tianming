'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-endturn-apply.js',s=>{
 s=R(s,"            if (GM.parties) GM.parties.forEach(function(p) { if (p.name === pc.name) party = p; });","            if (TM.EdictEffects) party=TM.EdictEffects.entity(GM,'parties',pc.id||pc.partyId||pc.name);\n            else if (GM.parties) GM.parties.forEach(function(p) { if (p.name === pc.name) party = p; });");
 return R(s,"            if (GM.classes) GM.classes.forEach(function(c) { if (c.name === cc.name) cls = c; });","            if (TM.EdictEffects) cls=TM.EdictEffects.entity(GM,'classes',cc.id||cc.classId||cc.name);\n            else if (GM.classes) GM.classes.forEach(function(c) { if (c.name === cc.name) cls = c; });");
});
edit('web/tm-endturn-render.js',s=>R(s,'  if (TM.EdictOutcomes) TM.EdictOutcomes.finalizeTurn(GM,GM.turn-1);',"  if (TM.EdictOutcomes) { TM.EdictOutcomes.receive(GM,{edict_feedback:[]},edicts||{},GM.turn-1,[]); TM.EdictOutcomes.finalizeTurn(GM,GM.turn-1); }"));
