/* 将行动者、事实状态和调查对象分开；未知叙述保持中性。 */
(function(global) {
  'use strict';
  var HS=(global.TM && global.TM.OfficeHolderState) || (typeof require==='function' ? require('./tm-office-holder-state.js') : null);
  function classify(G,act,ch) {
    var e=act.dutyEvidence, name=String(ch.name || ''), text=String(act.action || '').trim();
    if(e && typeof e==='object') {
      if(e.actorId!=null && String(e.actorId)!==String(ch.id)) return null;
      if(e.negated || /^(rumor|alleged|unverified|denied|planned)$/.test(e.status || '')) return null;
      if(e.status!=='confirmed' && e.status!=='observed') return null;
      if(e.kind==='leave') return {delta:0,kind:'leave',approved:e.approved===true,capacity:HS.number(e.capacity,null),delegateId:e.delegateId};
      if(e.kind==='misconduct' && (e.subjectId==null || String(e.subjectId)===String(ch.id))) return {delta:-6,kind:'misconduct'};
      if(/^(investigation|work)$/.test(e.kind)) return {delta:5,kind:e.kind};
      return null;
    }
    // Legacy prose: recognize complete actor predicates, never keywords in reasons, objects or rumors.
    var subjectKnown=true, diligent=false, derelict=false;
    text.split(/[，,。；;、\n]/).forEach(function(raw) {
      var s=raw.trim(); if(!s) return;
      if(name && s.indexOf(name)===0) {s=s.slice(name.length).trim();subjectKnown=true;}
      if(/^(并未|并无|未曾|没有|不曾|否认|并非|从未|尚未|未|不|无|传闻|听闻|据称|据传|疑似|涉嫌|有人称|被指|拟|欲|将|计划|准备|若|如果)/.test(s)) return;
      s=s.replace(/^(正在|已然|已经|确已|亲自|主动|奉命|奉旨|着手|继续|负责|因而|遂|已|正)/,'');
      if(/^(经准|获准|奉准|批准|告病|称疾|请假|休养|挂冠|乞归)/.test(s)) return;
      if(!subjectKnown) return;
      if(/^(查办|调查|核查|核实|稽查|审查|纠劾|弹劾|肃贪|勤政|治事|整顿|赈济|巡按|巡查|巡视|革弊|清理|清丈|督办|督饷|兴修|缮城|修边|平乱|平叛|讨平|安抚|招抚|言事|上疏|进谏|考课|筹饷|理财|劝农)/.test(s)) {diligent=true;return;}
      if(/传闻|未证实|不实|否认|未曾|并未|尚未|只是计划/.test(s)) return;
      if(/^(结党营私|中饱私囊|敛财避事|钻营|推诿|怠政|无故旷职|无故缺席|故意避事)(?:$|以|并|，|公|私|政|不|而)/.test(s) || /^(受贿|纳贿|贪墨)(?:$|银|金|财物|礼物|[一二三四五六七八九十百千万\d])/.test(s)) {derelict=true;return;}
      // An unrecognized subject cannot silently become the actor in the next clause.
      subjectKnown=false;
    });
    return derelict ? {delta:-6,kind:'misconduct'} : diligent ? {delta:5,kind:'work'} : null;
  }
  function actionKey(G,act,ch,assignment) {
    var e=act.dutyEvidence || {}, id=HS.key(act.actionId || act.operationId || act.eventId || act.id || e.eventId);
    var event=id || 'legacy:'+JSON.stringify([G.turn,act.action,act.behaviorType,act.target]);
    var domain=HS.key(act.power || e.power) || Object.keys(assignment.pos.powers || {}).filter(function(k){return assignment.pos.powers[k];}).sort().join(',') || 'duty';
    return JSON.stringify([HS.key(ch.id)||ch.name,event,domain,assignment.jurisdiction]);
  }
  function tenureAchievements(G,ch) {
    var assignments=HS.assignments(G,ch), seen=Object.create(null), total=0;
    (ch._achievementEvidence || ch._meritLog || []).forEach(function(e) {
      if(!e || e.kind!=='achievement' || e.outcome!=='success' || !e.eventId || e.turn==null || Number(e.turn)>Number(G.turn)) return;
      if(e.characterId!=null && String(e.characterId)!==String(ch.id)) return;
      var hit=assignments.filter(function(a){return (e.appointmentId ? a.appointmentId===String(e.appointmentId) : e.positionId && a.positionId===String(e.positionId)) && a.holder.appointedTurn!=null && Number(e.turn)>=Number(a.holder.appointedTurn) && (a.holder.endedTurn==null || Number(e.turn)<=Number(a.holder.endedTurn));});
      if(hit.length!==1 || seen[e.eventId]) return;
      seen[e.eventId]=true; total++;
    });
    return Math.min(20,total*3);
  }
  global.TM=global.TM || {};global.TM.OfficeActionEvidence={classify:classify,actionKey:actionKey,tenureAchievements:tenureAchievements};
  if(typeof module!=='undefined' && module.exports) module.exports=global.TM.OfficeActionEvidence;
})(typeof window!=='undefined'?window:globalThis);
