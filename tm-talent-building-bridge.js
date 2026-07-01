/* tm-talent-building-bridge.js — S2 桥接:建筑完工 -> 人才范式渗透引擎
 * 详设 institutional-building-talent-penetration-design-2026-06.md · 进度 talent-cohorts-PROGRESS-2026-06-30.md
 * 建筑 effectsStructured.talentSource = { paradigm:"label或id", graduates:年毕业数, newParadigm?:{label,influenceProfile,absorptionKind,maturityTurns} }
 * 由 building-works 的 applyCompletion/revertBuilding 末尾 hook 调用。flag talentCohortEnabled 默认关 -> no-op。
 */
(function(root){
  "use strict";
  var TM = root.TM || (root.TM = {});
  function num(v,d){var n=Number(v);return isFinite(n)?n:(d||0);}
  function conf(P){return (P&&P.conf)||(root.P&&root.P.conf)||{};}
  function enabled(P){return conf(P).talentCohortEnabled===true;}
  // 费效封顶:年毕业数按造价档(十两银办不出大学堂)
  function capGraduates(raw,cost){
    cost=num(cost,0); var n=num(raw,0); if(n<=0) return 0;
    var cap; if(cost>=100000)cap=8000; else if(cost>=20000)cap=3000; else if(cost>=5000)cap=1000; else if(cost>=500)cap=300; else cap=50;
    return Math.min(n,cap);
  }
  function readSpec(bld,typeDef){
    var es=bld&&bld.effectsStructured;
    var ts=(es&&es.talentSource)||(typeDef&&typeDef.effects&&typeDef.effects.talentSource);
    return (ts&&typeof ts==="object")?ts:null;
  }
  function onComplete(div,bld,typeDef,P,GM){
    if(!enabled(P)||!bld||!GM) return false;
    var TC=root.TM&&root.TM.TalentCohorts; if(!TC) return false;
    var spec=readSpec(bld,typeDef); if(!spec) return false;
    if(bld._talentSrcId) return false; // 幂等
    var pid=null;
    if(spec.paradigm){ var f=TC.findParadigm(GM,spec.paradigm); if(f) pid=f.id; }
    if(!pid){
      var np=spec.newParadigm||{};
      var p=TC.registerParadigm(GM,{label:np.label||spec.paradigm||"新学",kind:"emergent",influenceProfile:np.influenceProfile||{},absorptionKind:np.absorptionKind||[],maturityTurns:np.maturityTurns});
      pid=p.id;
    }
    var grads=capGraduates(spec.graduates,num(bld.costActual,typeDef&&typeDef.baseCost));
    var srcId="bld_"+((div&&div.name)||"")+"_"+((bld&&bld.name)||"")+"_"+num(bld.startTurn);
    TC.registerSource(GM,srcId,pid,grads);
    bld._talentSrcId=srcId; bld._talentParadigmId=pid;
    return true;
  }
  function onRevert(div,bld,GM){
    var TC=root.TM&&root.TM.TalentCohorts;
    if(!TC||!bld||!bld._talentSrcId) return false;
    TC.revokeSource(GM,bld._talentSrcId,bld._talentParadigmId);
    delete bld._talentSrcId; delete bld._talentParadigmId;
    return true;
  }
  TM.TalentBuildingBridge={onComplete:onComplete,onRevert:onRevert,capGraduates:capGraduates,readSpec:readSpec,version:"0.1.0-S2"};
  if(typeof module!=="undefined"&&module.exports) module.exports=TM.TalentBuildingBridge;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:this));
