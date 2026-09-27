'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-endturn-ai.js',s=>{
 s=R(s,String.raw`\"edict_feedback\":[{\"content\":`,String.raw`\"edict_feedback\":[{\"edictId\":\"原诏令编号\",\"effectRefs\":[],\"clauses\":[],\"nextStep\":\"后续安排\",\"content\":`);
 return R(s,String.raw`\"party_changes\":[{\"name\":`,String.raw`\"party_changes\":[{\"cohesion_delta\":0,\"name\":`);
});
