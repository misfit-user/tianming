// Shared identity and submission adapters. Domain owners keep their own facts.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{},bindings=new WeakSet(),issuedDomainActions=new WeakSet();
  function G(){return global.GM;}
  function A(x){return Array.isArray(x)?x:[];}
  function S(x){return x==null?'':String(x);}
  function publicOrganization(f){return !!f&&!f.hidden&&!f._hidden&&!f.isHidden&&!/^(private|secret|hidden)$/.test(f.visibility||'');}
  function ledger(){return TM.NPC&&TM.NPC.ActionLedger;}
  function result(outcome,reason,refs,extra){return ledger().result(outcome,reason,refs,extra);}
  function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object'){var o={};Object.keys(x).sort().forEach(function(k){if(k!=='__proto__'&&k!=='constructor'&&k!=='prototype')o[k]=stable(x[k]);});return o;}return x;}
  function signature(x){return JSON.stringify(stable(x));}
  function resolve(type,ref,world){
    var g=world||G(),id=typeof ref==='object'&&ref?S(ref.id||ref.characterId||ref.factionId||ref.organizationId):'',name=typeof ref==='string'?ref:S(ref&&ref.name);
    var rows=type==='character'?A(g.chars):type==='organization'?A(g.facs):type==='army'?A(g.armies):[];
    if(type==='region'){
      var seen=[];function walk(nodes){A(nodes).forEach(function(n){if(!n||seen.indexOf(n)>=0)return;seen.push(n);if(n.id&&n.name)rows.push(n);['children','divisions','subs','subRegions'].forEach(function(k){walk(n[k]);});});}
      if(g.nativeWorld)walk(g.nativeWorld.regions);walk(g.provinces);walk(g.provs);
      if(Array.isArray(g.adminHierarchy))walk(g.adminHierarchy);else Object.keys(g.adminHierarchy||{}).forEach(function(k){var v=g.adminHierarchy[k];walk(Array.isArray(v)?v:[v]);});
    }
    if(typeof ref==='string'){var ids=rows.filter(function(x){return x&&S(x.id)===ref;});if(ids.length)return ids.length===1?ids[0]:null;}
    var hits=rows.filter(function(x){return x&&(id?S(x.id)===id:name&&x.name===name);});return hits.length===1?hits[0]:null;
  }
  function controlled(ch,g){
    if(!ch)return false;var pi=g.playerInfo||g.startContext||{},p=g===G()&&global.P&&global.P.playerInfo||{},id=pi.currentPlayerCharacterId||pi.playerCharacterId||pi.characterId||p.characterId;
    return !!(ch.isPlayer||ch.playerControlled||ch.controlledBy==='player'||id&&S(ch.id)===S(id));
  }
  function live(ch){return !!ch&&ch.alive!==false&&!ch.dead&&!ch._missing&&!ch._imprisoned&&!ch.imprisoned;}
  function nativeState(g){return g&&g.startContext&&g.startContext.schemaVersion==='tm-start-context/1'?g.nativeWorld:null;}
  function authority(actor,d,power,subject,world){
    var g=world||G(),hs=TM.OfficeHolderState,org=resolve('organization',{id:d.organizationId},g);
    if(!live(actor)||!org||!hs)return null;
    var rows=d.authorityRef?[]:hs.activeAssignments(g,actor,{organizationId:org.id});
    if(d.actingPositionId)rows=rows.filter(function(a){return S(a.pos.id)===S(d.actingPositionId);});
    if(d.appointmentId)rows=rows.filter(function(a){return a.appointmentId===S(d.appointmentId);});
    rows=rows.filter(function(a){
      var p=a.pos,h=a.holder||{},scope=p.authorityScope||{};
      if(!p.powers||p.powers[power]!==true||p.status==='abolished'||p.enabled===false||h.expiresTurn!=null&&g.turn>=h.expiresTurn||p.expiresTurn!=null&&g.turn>=p.expiresTurn)return false;
      var principal=a.delegated?hs.identity(g,a.principalCharacterId).char:actor,available=hs.availability(g,principal,p);
      if(!available.capacity||available.char!==actor)return false;
      if(subject&&subject.organizationId!==a.organizationId)return false;
      if(subject&&Array.isArray(scope.positionIds)&&scope.positionIds.indexOf(subject.pos.id)<0)return false;
      if(d.treatyType&&Array.isArray(scope.treatyTypes)&&scope.treatyTypes.indexOf(d.treatyType)<0)return false;
      if(subject&&subject.node!==a.node&&A(scope.positionIds).indexOf(subject.pos.id)<0&&A(scope.departmentIds).indexOf(subject.node.id)<0)return false;
      if(d.targetOrganizationId&&Array.isArray(scope.organizationIds)&&scope.organizationIds.indexOf(d.targetOrganizationId)<0)return false;
      return true;
    });
    if(rows.length===1)return Object.assign({},rows[0],{actorId:actor.id,power:power,organizationId:org.id,basisSource:rows[0].pos.authoritySource||'current_office_powers'});
    if(rows.length>1||!d.authorityRef&&(d.actingPositionId||d.appointmentId))return null;
    var aliases={appointment:['appoint'],treasurySpend:['public_transfer','treasury'],diplomacy:['negotiate','diplomacy'],treatySign:['treaty_sign'],militaryCommand:['military_order'],declareWar:['declare_war']};
    var n=nativeState(g),grants=n&&A(n.authorities).filter(function(a){
      return a&&S(a.characterId)===S(actor.id)&&a.status==='active'&&(!d.authorityRef||a.id===d.authorityRef)&&
        (a.expiresTurn==null||g.turn<a.expiresTurn)&&(!a.fromTurn||g.turn>=a.fromTurn)&&(aliases[power]||[power]).some(function(v){return A(a.grants).indexOf(v)>=0;})&&
        A(a.jurisdiction&&a.jurisdiction.factionIds).indexOf(org.id)>=0&&A(n.revokedAuthorityCharacters).indexOf(actor.id)<0;
    });
    return grants&&grants.length===1?{actorId:actor.id,organizationId:org.id,authorityRef:grants[0].id,nativeAuthority:grants[0],power:power}:null;
  }
  function principals(fac,power,world){
    var g=world||G(),out=[];A(g.chars).forEach(function(ch){if(!live(ch)||controlled(ch,g))return;
      TM.OfficeHolderState.activeAssignments(g,ch,{organizationId:fac.id}).forEach(function(a){var d={organizationId:fac.id,actingPositionId:a.pos.id},principal=a.delegated?TM.OfficeHolderState.identity(g,a.principalCharacterId).char:ch,av=TM.OfficeHolderState.availability(g,principal,a.pos);
        if(a.pos.status==='abolished'||a.pos.enabled===false||a.pos.expiresTurn!=null&&g.turn>=a.pos.expiresTurn||a.holder&&a.holder.expiresTurn!=null&&g.turn>=a.holder.expiresTurn||av.char!==ch||!av.capacity)return;
        if(!power||authority(ch,d,power,null,g))out.push({actor:ch,assignment:a});});
      A(nativeState(g)&&nativeState(g).authorities).filter(function(a){return a.characterId===ch.id&&a.status==='active'&&A(a.jurisdiction&&a.jurisdiction.factionIds).indexOf(fac.id)>=0&&(a.expiresTurn==null||g.turn<a.expiresTurn);}).forEach(function(a){
        if(!out.some(function(x){return x.actor===ch;})&&(!power||authority(ch,{organizationId:fac.id,authorityRef:a.id},power,null,g)))out.push({actor:ch,assignment:{authorityRef:a.id}});
      });
    });return out;
  }
  function choose(fac,power){
    var rows=principals(fac,power),st=ledger().state(G());if(!st.politicalSchedule)st.politicalSchedule={};
    var plans=ledger().ensurePlans(G());function waiting(ch){return plans.some(function(p){return p.actorId===ch.id&&p.kind==='political_candidate'&&p.status==='active';})||TM.FactionDiplomacy&&TM.FactionDiplomacy.due(ch,fac);}
    rows.sort(function(a,b){return Number(waiting(b.actor))-Number(waiting(a.actor))||(st.politicalSchedule[a.actor.id]||0)-(st.politicalSchedule[b.actor.id]||0);});
    if(!rows.length)return null;var chosen=rows[0];st.politicalSchedule[chosen.actor.id]=++st.sequence;return chosen;
  }
  function proposalKnowledge(actor,org){
    var out=Object.create(null);if(TM.FactionDiplomacy)TM.FactionDiplomacy.inputView(actor,org).forEach(function(p){out[p.id]={version:p.version,signature:signature(p.terms)};});return out;
  }
  function proposalInputError(context,d,g){
    if(!d.proposalId)return '';var prior=ledger().state(g).receipts[JSON.stringify([d.actionId,d.phase||'execute'])];if(prior&&prior.result.actorId===context.actorId)return '';
    var p=TM.FactionDiplomacy&&TM.FactionDiplomacy.get(d.proposalId,g);if(!p)return 'unknown_proposal';
    var expected=(d.decision||d.response)==='replan'?0:d.proposalVersion;
    if(p.schemaVersion===2&&expected!==p.version)return 'proposal_version_mismatch';
    var known=context.knownProposals&&Object.prototype.hasOwnProperty.call(context.knownProposals,d.proposalId)&&context.knownProposals[d.proposalId];
    if(!known||known.version!==expected)return 'proposal_not_in_decision_input';
    var terms=p.schemaVersion===2&&A(p.versions).find(function(v){return v.version===expected;});
    return terms&&signature(terms.terms)!==known.signature?'proposal_terms_changed_since_input':'';
  }
  function bind(fac,actorId,opts){
    opts=opts||{};var g=G(),org=resolve('organization',{id:fac&&fac.id},g),actor=resolve('character',{id:actorId},g);
    if(!org||!live(actor)||controlled(actor,g))return null;
    if(opts.actingPositionId&&TM.OfficeHolderState.activeAssignments(g,actor,{organizationId:org.id}).filter(function(a){return a.pos.id===opts.actingPositionId;}).length!==1)return null;
    var context={actorId:actor.id,organizationId:org.id,actingPositionId:opts.actingPositionId||'',authorityRef:opts.authorityRef||'',
      knownProposals:JSON.parse(JSON.stringify(opts.knownProposals||proposalKnowledge(actor,org))),_npcLease:ledger().capture(),source:opts.source||'political-candidate',sourceId:opts.sourceId||'pol:'+ (++ledger().state(g).sequence)};
    bindings.add(context);return Object.freeze(context);
  }
  function valid(context){
    if(!context||!bindings.has(context)||!ledger().current(context._npcLease))return false;
    var ch=resolve('character',{id:context.actorId});
    if(!live(ch))return false;
    var nativeValid=!context.authorityRef||A(nativeState(G())&&nativeState(G()).authorities).some(function(a){return a.id===context.authorityRef&&a.characterId===ch.id&&a.status==='active'&&(a.expiresTurn==null||G().turn<a.expiresTurn);});
    return live(ch)&&!controlled(ch,G())&&nativeValid&&(!context.actingPositionId||TM.OfficeHolderState.activeAssignments(G(),ch,{organizationId:context.organizationId}).filter(function(a){return a.pos.id===context.actingPositionId;}).length===1);
  }
  function action(context,raw,index){
    var d=Object.assign({},raw),g=G();
    if(!valid(context))return null;
    if(d.actorId&&S(d.actorId)!==S(context.actorId)||d.organizationId&&S(d.organizationId)!==S(context.organizationId))return null;
    d.actorId=context.actorId;d.organizationId=context.organizationId;
    d.actingPositionId=d.actingPositionId||context.actingPositionId;
    if(d.actingPositionId&&TM.OfficeHolderState.activeAssignments(g,resolve('character',{id:context.actorId}),{organizationId:context.organizationId}).filter(function(a){return a.pos.id===d.actingPositionId;}).length!==1)return null;
    d.authorityRef=d.authorityRef||context.authorityRef;
    if(d.behaviorType==='military_order'){
      var army=resolve('army',{id:d.armyId,name:d.army||d.armyName});if(!army)return null;d.armyId=army.id;
      if(d.commandHandoverTo){var successor=resolve('character',d.commandHandoverTo);if(!successor)return null;d.commandHandoverTo=successor.id;}
      if(d.commanderId||d.commander){var commander=resolve('character',{id:d.commanderId,name:d.commander});if(!commander)return null;d.commanderId=commander.id;delete d.commander;}
      if(d.destinationId||d.destination||d.location||d.garrison){var region=resolve('region',{id:d.destinationId,name:d.destination||d.location||d.garrison});if(!region)return null;d.destinationId=region.id;d.destination=region.name;}
      delete d.location;delete d.garrison;
    }
    // The caller's source survives model retries; model-generated IDs cannot replace it.
    var plan=d.sourcePlanId&&ledger().ensurePlans(g).find(function(p){return p.id===d.sourcePlanId&&p.kind==='political_candidate';});
    if(d.sourcePlanId&&(!plan||plan.actorId!==context.actorId||plan.organizationId!==context.organizationId))return null;
    var supplied=d.actionId,sourceKey=plan&&d.behaviorType!=='political_review'?'political-plan:'+plan.id:context.sourceId+':'+S(index==null?0:index),st=ledger().state(g);
    if(!st.politicalSources)st.politicalSources={};
    if(!Object.prototype.hasOwnProperty.call(st.politicalSources,sourceKey))st.politicalSources[sourceKey]={actionId:supplied&&ledger().state(g).receipts[JSON.stringify([supplied,d.phase||'execute'])]?supplied:sourceKey};
    d.actionId=st.politicalSources[sourceKey].actionId;d.source=context.source;d.targetType=d.targetType||'character';d._politicalInputError=proposalInputError(context,d,g);
    return d;
  }
  function execute(context,raw,handler,index){
    var d=action(context,raw,index);if(!d)return result('expired','unbound_actor_or_world_changed');if(d._politicalInputError)return result('blocked',d._politicalInputError);
    var actor=resolve('character',{id:context.actorId}),scope=Object.assign({},context);
    return ledger().execute(actor,d,scope,handler);
  }
  function submit(fac,operation,opts){
    opts=opts||{};var ctx=opts.binding||bind(fac,opts.actorId,opts),p=Object.assign({},operation.payload||operation),type=operation.type;
    if(!valid(ctx))return result('blocked','person_decision_binding_required');
    if(p.sourcePlanId&&/^(reject|defer)$/.test(p.decision||''))return execute(ctx,Object.assign({},p,{behaviorType:'political_review'}),function(ch,target,d){
      var plan=ledger().ensurePlans(G()).find(function(x){return x.id===d.sourcePlanId;});
      if(!plan||plan.actorId!==ch.id||plan.status==='done'||plan.status==='cancelled')return result('blocked','reviewable_candidate_required');
      plan.status=d.decision==='reject'?'cancelled':'active';plan.nextTurn=G().turn+1;plan.reviewReason=S(d.reason||d.content);plan.lastReviewActionId=d.actionId;
      return result('submitted','人物已明确评估候选',[{kind:'political_review',id:plan.id}]);
    },opts.index);
    if(['memorial','edict','court_alignment'].indexOf(type)>=0){
      var recipient=resolve('character',{id:p.targetId,name:p.target});
      if(!recipient||!(p.content||p.summary))return result('blocked','specific_document_and_recipient_required');
      var document=action(ctx,Object.assign({},p,{behaviorType:'private_correspondence',targetId:recipient.id,target:recipient.name,documentType:type,
        intent:p.content||p.summary,task:{kind:'document'}}),opts.index);
      return document?global.NpcBehaviorRegistry.execute(resolve('character',{id:ctx.actorId}),document,{_npcLease:ctx._npcLease}):result('blocked','document_source_invalid');
    }
    var maps={office_change:({dismiss:'dismiss',demote:'dismiss',transfer:'transfer'})[p.kind]||'appoint',fiscal_policy:'office_duty'};
    if(type==='office_change'||type==='fiscal_policy'){
      p.behaviorType=maps[type];p.targetId=p.targetId||p.characterId;p.target=p.target||p.char;
      if(type==='fiscal_policy'){if(!p.fromAccount||!p.toAccount||!p.amounts)return result('blocked','specific_public_transfer_required');p.step='transfer';}
      var d=action(ctx,p,opts.index);if(!d)return result('expired','actor_changed');if(d._politicalInputError)return result('blocked',d._politicalInputError);
      return global.NpcBehaviorRegistry?global.NpcBehaviorRegistry.execute(resolve('character',{id:d.actorId}),d,{_npcLease:ctx._npcLease}):result('blocked','npc_registry_unavailable');
    }
    if(type==='diplomacy')return TM.FactionDiplomacy&&TM.FactionDiplomacy.submit?TM.FactionDiplomacy.submit(fac,p,ctx,opts.index):result('blocked','diplomacy_domain_unavailable');
    if(type==='military_order')return execute(ctx,Object.assign({},p,{behaviorType:'military_order',targetType:'army'}),military,opts.index);
    if(type==='declare_war'||type==='join_war')return execute(ctx,Object.assign({},p,{behaviorType:type,targetType:'organization'}),function(ch,target,d){return performWar(ch,d,type);},opts.index);
    return result('blocked','political_operation_not_adapted');
  }
  function performWar(actor,d,type){
    var org=d.organizationId&&resolve('organization',{id:d.organizationId}),enemy=resolve('organization',{id:d.targetOrganizationId||d.targetId,name:d.targetFaction||d.target||d.against||d.enemy});
    if(!org){var eligible=A(G().facs).filter(function(f){return authority(actor,Object.assign({},d,{organizationId:f.id}),'declareWar');});if(eligible.length===1)org=eligible[0];}
    if(!org||!enemy||org===enemy||!authority(actor,Object.assign({},d,{organizationId:org.id}),'declareWar'))return result('blocked','current_war_authority_and_parties_required');
    if(A(G().facs).filter(function(f){return f.name===org.name;}).length!==1||A(G().facs).filter(function(f){return f.name===enemy.name;}).length!==1)return result('blocked','war_domain_requires_unambiguous_faction_names');
    var engine=TM.FactionActionEngine,fn=engine&&(type==='join_war'?engine._applyJoinWar:engine._applyDeclareWar);if(!fn)return result('blocked','war_domain_unavailable');
    var action={actionId:d.actionId,decisionId:d.actionId,turn:G().turn,type:type,payload:Object.assign({},d,{targetFaction:enemy.name,casusBelli:d.casusBelliId||d.casusBelli||d.cb})};
    issuedDomainActions.add(action);var r;try{r=fn(org,action);}finally{issuedDomainActions.delete(action);}
    if(!r||!r.ok)return result('blocked',r&&r.reason||'war_not_started');
    var war=A(G().activeWars).find(function(w){return w.id===r.detail.warId;});if(!war)throw Error('war_domain_receipt_missing');
    war.sourceActionId=d.actionId;war.decisionActorId=actor.id;war.attackerId=org.id;war.defenderId=enemy.id;
    return result('started','战争领域已登记有效决定',[{kind:'war',id:war.id}],{organizationId:org.id,worldEvent:r.worldEvent});
  }
  function military(actor,target,d){
    var g=G(),army=resolve('army',{id:d.armyId,name:d.army||d.armyName}),cmd=TM.CommandAuthority,api=TM.AIChange&&TM.AIChange.Army;
    if(!army||!cmd||!api)return result('blocked','military_domain_unavailable');
    var owner=resolve('organization',army.factionId||army.faction||army.owner,g);
    if(!owner||owner.id!==d.organizationId)return result('blocked','army_organization_mismatch');
    d.armyId=army.id;
    var authorityNow=authority(actor,d,'militaryCommand'),isCustodian=cmd.holders(army).some(function(h){return S(h.id)===S(actor.id);});
    if(!authorityNow&&!(d.commandReceipt&&isCustodian))return result('blocked','military_authority_required');
    var scope=authorityNow&&authorityNow.pos&&authorityNow.pos.authorityScope||{};
    if(Array.isArray(scope.armyIds)&&scope.armyIds.indexOf(army.id)<0)return result('blocked','army_scope_denied');
    if(['soldiersDelta','troopsDelta','moraleDelta','trainingDelta','soldiers','troops','morale','training'].some(function(k){return d[k]!=null&&Number(d[k])!==0;}))return result('blocked','command_cannot_supply_process_deltas');
    if(d.commandReceipt){var by=A(d.commandReceipt.by);if(!by.length||by.some(function(id){return id!==actor.id&&id!==actor.name;}))return result('blocked','cannot_reply_for_other_custodians');}
    var change={name:army.id,reason:d.reason||d.intent||'军令',commandReceipt:d.commandReceipt},commander=d.commanderId?resolve('character',{id:d.commanderId}):d.commander?resolve('character',d.commander):null;
    if((d.commanderId||d.commander)&&!commander)return result('blocked','commander_identity_unresolved');
    if(commander){d.commanderId=commander.id;change.commander=commander.name;}
    if(d.commandHandoverTo){var handover=resolve('character',d.commandHandoverTo);if(!handover)return result('blocked','handover_identity_unresolved');change.commandHandoverTo=handover.id;}
    var destination=d.destination||d.location||d.garrison;
    if(destination&&(commander||change.commandHandoverTo))return result('blocked','specify_separate_handover_and_march_steps');
    var oldOrders=A(g.commandOrders).map(function(o){return {id:o.id,status:o.status};}),r;
    if(destination){
      d.destination=destination;
      if(!global.MarchSystem||!global.MarchSystem._getConfig().enabled)return result('blocked','march_domain_unavailable_or_disabled');
      var m=global.MarchSystem.createMarchOrder(army,army.location||army.garrison,destination,{commandReceipt:d.commandReceipt});
      if(m){m.sourceActionId=d.actionId;return result('started','已登记真实行军过程',[{kind:'march',id:m.id,armyId:army.id}]);}
      r={pending:true};
    }else r=api.applyAIArmyChange(change,{armyId:army.id,commanderId:commander&&commander.id,actorId:actor.id,factionId:army.factionId||army.faction,source:'political-command'});
    var order=A(g.commandOrders).find(function(o){return o.armyId===army.id&&(!oldOrders.some(function(x){return x.id===o.id;})||d.commandReceipt&&o.id===d.commandReceipt.orderId);});
    if(r&&r.pending){
      if(!order)return result('blocked',r.reason||'march_not_started');
      var old=oldOrders.find(function(o){return o.id===order.id;});if(old&&old.status===order.status)return result('noop','command_already_waiting');
      order.sourceActionId=order.sourceActionId||d.actionId;order.lastResponseActionId=d.actionId;
      return result('waiting',r.reason||'已发令，等待实际掌兵者回应',[{kind:'command',id:order.id,armyId:army.id}]);
    }
    if(!r||!r.ok||!r.changed)return result(r&&r.duplicate?'noop':'blocked',r&&r.reason||'no_military_operation');
    army._lastPoliticalActionId=d.actionId;
    return result('completed','军令领域操作已核验',[{kind:'army_operation',id:army.id}]);
  }
  function verifyEvidence(ref,d,g,before){
    var army=resolve('army',{id:d.armyId},g),old=resolve('army',{id:d.armyId},before);if(!army||!old)return false;
    if(ref.kind==='march')return !A(before.marchOrders).some(function(m){return m.id===ref.id;})&&A(g.marchOrders).some(function(m){return m.id===ref.id&&m.sourceActionId===d.actionId&&m.to===d.destination;})&&army.location===old.location;
    if(ref.kind==='command'){
      var o=A(g.commandOrders).find(function(x){return x.id===ref.id&&x.armyId===army.id;}),was=A(before.commandOrders).find(function(x){return x.id===ref.id;});
      return !!o&&o.lastResponseActionId===d.actionId&&(!was||was.status!==o.status);
    }
    if(ref.kind==='army_operation')return ref.id===army.id&&army._lastPoliticalActionId===d.actionId&&old._lastPoliticalActionId!==d.actionId&&army.soldiers===old.soldiers&&army.location===old.location&&
      (army.commanderId!==old.commanderId||army.commander!==old.commander||signature(army.commandChain)!==signature(old.commandChain));
    return false;
  }
  function candidateView(actor,fac,g){
    var rows=ledger().ensurePlans(g).filter(function(p){return p.kind==='political_candidate'&&p.actorId===actor.id&&p.organizationId===fac.id&&p.status==='active'&&(!p.nextTurn||p.nextTurn<=g.turn);});
    var start=rows.length?(g.turn*8)%rows.length:0;return rows.slice(start).concat(rows.slice(0,start)).slice(0,8).map(function(p){return {id:p.id,intent:p.intent,operation:p.operation,sourceKind:'proposal'};});
  }
  function view(fac,context){
    if(!valid(context))return null;var actor=resolve('character',{id:context.actorId}),g=G(),d={organizationId:fac.id,actingPositionId:context.actingPositionId};
    var known=proposalKnowledge(actor,fac);Object.keys(context.knownProposals).forEach(function(k){delete context.knownProposals[k];});Object.assign(context.knownProposals,known);
    var offices=TM.OfficeHolderState.positions(g,{organizationId:fac.id}).filter(function(a){return !a.pos.hidden&&a.pos.visibility!=='private'||TM.OfficeHolderState.read(g,a.pos).characters.some(function(h){return h.char===actor;});}).map(function(a){return {id:a.pos.id,departmentId:a.node.id,name:a.pos.name,holders:TM.OfficeHolderState.read(g,a.pos).characters.map(function(h){return {id:h.characterId,name:h.name};}),vacancies:TM.OfficeHolderState.read(g,a.pos).vacancyCount};});
    var finance=authority(actor,d,'treasurySpend'),binding=finance&&(finance.pos&&finance.pos.treasuryBinding||finance.nativeAuthority&&finance.nativeAuthority.treasuryBinding)||{},refs=binding.accountRefs||(binding.accountRef?[binding.accountRef]:[]);
    var own=typeof global.buildNpcBehaviorContext==='function'?global.buildNpcBehaviorContext(actor,{privateActorId:actor.id,omitPublic:true,publicAccountRefs:refs}):{};
    return {actorId:actor.id,organizationId:fac.id,organization:fac.name,actingPositionId:context.actingPositionId,person:own,
      organizations:A(g.facs).filter(function(f){return f.id===fac.id||publicOrganization(f);}).map(function(f){return {type:'organization',id:f.id,name:f.name};}),
      offices:offices,candidates:candidateView(actor,fac,g),authority:TM.OfficeHolderState.activeAssignments(g,actor,{organizationId:fac.id}).filter(function(a){var principal=a.delegated?TM.OfficeHolderState.identity(g,a.principalCharacterId).char:actor,av=TM.OfficeHolderState.availability(g,principal,a.pos);return av.char===actor&&av.capacity&&a.pos.enabled!==false&&a.pos.status!=='abolished'&&(a.pos.expiresTurn==null||g.turn<a.pos.expiresTurn)&&(!a.holder||a.holder.expiresTurn==null||g.turn<a.holder.expiresTurn);}).map(function(a){return {positionId:a.pos.id,basis:'current_office',delegated:!!a.delegated,appointmentId:a.appointmentId,powers:a.pos.powers||{},scope:a.pos.authorityScope||{},expiresTurn:a.pos.expiresTurn};}),
      collectiveRules:A(fac.politicalRules).filter(function(r){return r.status==='active'&&(!r.expiresTurn||g.turn<r.expiresTurn)&&TM.OfficeHolderState.activeAssignments(g,actor,{organizationId:fac.id}).some(function(a){var principal=a.delegated?TM.OfficeHolderState.identity(g,a.principalCharacterId).char:actor,av=TM.OfficeHolderState.availability(g,principal,a.pos);return A(r.positionIds).indexOf(a.pos.id)>=0&&av.char===actor&&av.capacity;});}).map(function(r){return {id:r.id,version:r.version,kind:r.kind,quorum:r.quorum,positionIds:r.positionIds,treatyTypes:r.treatyTypes};}),
      accounts:finance&&TM.PublicTreasury?refs.map(function(ref){return TM.PublicTreasury.getAccountView({game:g,ref:ref});}):null,
      recentResults:A(ledger().state(g).politicalPending).filter(function(p){return p.actorId===actor.id&&p.organizationId===fac.id&&p.result;}).slice(-4).map(function(p){return {sourceId:p.sourceId,turn:p.turn,status:p.status,results:A(p.result.results).concat(A(p.result.responses&&p.result.responses.results),A(p.result.proposals&&p.result.proposals.results)).map(function(r){return {actionId:r.actionId,outcome:r.outcome,reason:r.reason,operationRefs:r.operationRefs};})};}),
      proposals:TM.FactionDiplomacy&&TM.FactionDiplomacy.inputView?TM.FactionDiplomacy.inputView(actor,fac):[]};
  }
  function defer(context,decision){
    if(!valid(context))return result('expired','world_changed');var st=ledger().state(G());if(!st.politicalPending)st.politicalPending=[];
    var prior=st.politicalPending.find(function(p){return p.sourceId===context.sourceId;});if(prior)return result('waiting','candidate_already_queued',[],{duplicate:true});
    st.politicalPending.push({sourceId:context.sourceId,actorId:context.actorId,organizationId:context.organizationId,actingPositionId:context.actingPositionId,authorityRef:context.authorityRef,knownProposals:JSON.parse(JSON.stringify(context.knownProposals)),
      turn:G().turn,readyTurn:G().turn+1,status:'waiting',decision:JSON.parse(JSON.stringify(decision)),worldId:S(G()._campaignId||G().sid)});
    return result('waiting','候选已保存，待明确模拟边界复核');
  }
  function applyPacket(fac,decision,context){
    if(!valid(context))return {actions:0,expired:true};
    var summary=TM.FactionActionEngine?TM.FactionActionEngine.applyDecision(fac,decision,{binding:context,decisionId:context.sourceId}):{actions:0,failed:true};
    if(TM.FactionDiplomacy){
      summary.responses=TM.FactionDiplomacy.applyResponses(fac,decision.proposalResponses,G().turn,{binding:context});
      summary.proposals=TM.FactionDiplomacy.recordProposals(fac,decision.proposals,G().turn,{binding:context});
      summary.actions+=(summary.responses.resolved||0);
    }
    return summary;
  }
  function offer(fac,actor,operation,origin){
    if(!fac||!actor||!origin||controlled(actor,G()))return null;
    var existing=ledger().ensurePlans(G()).find(function(p){return p.kind==='political_candidate'&&p.actorId===actor.id&&p.organizationId===fac.id&&p.operation&&p.operation.type===operation.type&&p.status==='active'&&!operation.positionId;});if(existing)return existing;
    var id='candidate:'+origin,known=ledger().ensurePlans(G()).find(function(p){return p.id===id;});if(known)return known;
    var p=ledger().recordPlan({id:id,actor:actor.name,actorId:actor.id,type:'political_candidate',intent:operation.intent||operation.content||'请按现职评估具体事项'},{GM:G()});
    if(p)Object.assign(p,{kind:'political_candidate',organizationId:fac.id,operation:JSON.parse(JSON.stringify(operation)),sourceKind:'proposal',sourceId:origin,status:'active',nextTurn:G().turn});return p;
  }
  function localCandidates(kind){
    var out={actions:0,issued:0,run:0,generated:0};
    A(G()&&G().facs).forEach(function(f){
      var selected=choose(f,kind==='office_change'?'appointment':null);if(!selected)return;
      if(kind==='office_change'){
        var seats=TM.OfficeHolderState.positions(G(),{organizationId:f.id}).filter(function(a){return TM.OfficeHolderState.read(G(),a.pos).vacancyCount>0&&authority(selected.actor,{organizationId:f.id,actingPositionId:selected.assignment.pos&&selected.assignment.pos.id,authorityRef:selected.assignment.authorityRef},'appointment',a);});
        if(!seats.length)return;var seat=seats[0],origin='vacancy:'+S(f.id)+':'+S(seat.pos.id)+':'+A(seat.pos.holderHistory).length;
        if(offer(f,selected.actor,{type:kind,kind:'appoint',positionId:seat.pos.id,actingPositionId:selected.assignment.pos&&selected.assignment.pos.id,authorityRef:selected.assignment.authorityRef,intent:'本署有实际空缺，请选择合适人选或说明暂缓'},origin))out.generated++;
      }else if(offer(f,selected.actor,{type:kind,intent:kind==='memorial'?'按本人所知决定是否提出文书':kind==='edict'?'评估本机构是否有需形成命令的具体事项':'评估是否需要与其他人员协商'},'local:'+kind+':'+S(f.id)+':'+G().turn))out.generated++;
    });return out;
  }
  function onReceipt(d,r,g){
    if(d.documentType&&r.planId){
      var org=resolve('organization',{id:d.organizationId},g),field=({memorial:'npcMemorials',edict:'npcEdicts',court_alignment:'npcChaoyi'})[d.documentType];
      if(!org||!field)throw Error('document_organization_changed');if(!Array.isArray(org[field]))org[field]=[];
      var sender=resolve('character',{id:r.actorId},g),recipient=resolve('character',{id:d.targetId},g),seat=d.actingPositionId&&TM.OfficeHolderState.position(g,{organizationId:org.id,positionId:d.actingPositionId});
      org[field].push({id:r.actionId,sourceActionId:r.actionId,sourceKind:'narrative',planId:r.planId,fromId:r.actorId,from:sender.name,fromRole:seat&&seat.pos.name||'本人',to:recipient&&recipient.name,issuer:sender.name,targetId:d.targetId,type:d.documentType,content:d.intent,summary:d.intent,ruling:'等待对方回应',effects:{},status:r.outcome,applied:false,turn:g.turn});
    }
    if(!d.sourcePlanId||d.behaviorType==='political_review')return;var p=ledger().ensurePlans(g).find(function(x){return x.id===d.sourcePlanId&&x.kind==='political_candidate';});
    if(!p||p.actorId!==d.actorId||p.organizationId!==d.organizationId)throw Error('candidate_source_changed');
    p.lastActionId=r.actionId;p.receiptPhase=r.phase;p.status=/^(completed|started|partial)$/.test(r.outcome)?'done':'waiting';if(r.proposalId)p.linkedProposalId=r.proposalId;if(r.planId)p.linkedPlanId=r.planId;
  }
  function verifyReview(ref,d,g,before){
    var p=ledger().ensurePlans(g).find(function(x){return x.id===ref.id;}),old=A(before._npcPlans).find(function(x){return x.id===ref.id;});
    return !!p&&!!old&&p.actorId===d.actorId&&p.lastReviewActionId===d.actionId&&old.lastReviewActionId!==d.actionId&&p.status===(d.decision==='reject'?'cancelled':'active');
  }
  function flush(){
    var g=G();A(g.facs).forEach(function(f){['npcMemorials','npcEdicts','npcChaoyi'].forEach(function(k){A(f[k]).forEach(function(r){var p=r.planId&&ledger().ensurePlans(g).find(function(x){return x.id===r.planId;});if(p){r.status=p.status==='done'?'completed':p.status;r.ruling=p.status==='done'?'文书往返已核收':/^(rejected|cancelled)$/.test(p.status)?'交涉已结束':'等待后续送达或办理';}});});});ledger().ensurePlans(g).filter(function(p){return p.kind==='political_candidate'&&p.status==='waiting';}).forEach(function(p){
      var linked=p.linkedProposalId&&TM.FactionDiplomacy&&TM.FactionDiplomacy.get(p.linkedProposalId)||p.linkedPlanId&&ledger().ensurePlans(g).find(function(x){return x.id===p.linkedPlanId;});
      if(linked&&/^(done|effective|accepted|rejected|cancelled|failed)$/.test(linked.status))p.status=/^(effective|accepted)$/.test(linked.status)?'done':linked.status;
    });var st=ledger().state(g),rows=A(st.politicalPending).filter(function(p){return p.status==='waiting'&&p.readyTurn<=g.turn;});
    rows.forEach(function(p){
      if(p.worldId!==S(g._campaignId||g.sid)){p.status='expired';return;}
      var org=resolve('organization',{id:p.organizationId},g),ctx=org&&bind(org,p.actorId,{sourceId:p.sourceId,actingPositionId:p.actingPositionId,authorityRef:p.authorityRef,knownProposals:p.knownProposals||{},source:'simulation-boundary'});
      if(!ctx){p.status='needs_replan';p.reason='actor_or_organization_unavailable';return;}
      var settled=applyPacket(org,p.decision,ctx),current=A(ledger().state(g).politicalPending).find(function(x){return x.sourceId===p.sourceId;});
      if(current){current.result=settled;current.status=settled.actions?'completed':'evaluated';}
    });return rows.length;
  }
  function prompt(fac,context){
    var input=context&&valid(context)?view(fac,context):{organization:{id:fac.id,name:fac.name},publicOnly:true};
    return {system:'你是当前绑定的真实人物，以列出的本次职任思考。你可以建议、拒绝、还价、履行或等待。组织不是另一个全知人格。仅用已知材料；战略建议不等于已成立命令。无具体权限和材料时不要声称完成。collectiveRules 列出本人参与的议事程序；accept/approve 是本人的一票，达到程序条件后才可能形成组织签署。输出 JSON。',
      user:JSON.stringify(input)+'\n输出 {rationale,actions,proposals,proposalResponses}；各不超过 4 项，也可为空。actions 支持 office_change {kind, targetId, positionId, actingPositionId}、fiscal_policy {fromAccount,toAccount,amounts,purpose,actingPositionId}；履行 proposals 的 public_transfer 义务时，还须引用 proposalId、proposalVersion、obligationId，与原条款完全一致、diplomacy {toFactionId,proposalType,terms,durationTurns,actingPositionId}；memorial/edict/court_alignment {targetId,content} 表示提交文书或协商，不能自行通过命令。actions 也支持 military_order {armyId,commanderId或destinationId,actingPositionId}、declare_war/join_war {targetOrganizationId,casusBelliId,actingPositionId,warId}，须具备对应权限。对 candidates 可填 sourcePlanId、decision(reject/defer)、reason 明确拒绝或暂缓。若采纳 candidates 中的事项，填对应 sourcePlanId，并补充自己选择的人选或办法。proposalResponses 须含 proposalId、proposalVersion、decision(accept/reject/counter/defer/approve)、actingPositionId；counter 须含完整 counterTerms。只是材料，不得填写完成凭据或财政/人数差额。'};
  }
  function tools(fac,context){
    var out={fac:{id:fac.id,name:fac.name},formatters:{}},keys=['opponentMindModel','allyMindModel','courtDebate','worldDirective','lastTurnFailures','lastTurnCompliance','decisionStyleTrend','factionTrajectory','recentWorld','playerRecent','worldStatus','ownAdminHierarchy','militaryContext','fiscalContext','recall','officeQuery'];
    keys.forEach(function(key){out.formatters[key]=function(query){if(!valid(context))return '';var v=view(fac,context),x=key==='recall'?v.person.memories:key==='officeQuery'?v.offices:key==='fiscalContext'?v.accounts:v.person;
      if((key==='recall'||key==='officeQuery')&&typeof query==='string'&&query.trim())x=A(x).filter(function(r){return JSON.stringify(r).indexOf(query)>=0;});return JSON.stringify(x||[]);};});return out;
  }
  function prepareMigration(g){
    ledger().migrate(g);var st=g._npcActionState;
    if(st.politicalVersion===1)return {changed:false};
    if(st.politicalVersion!=null)throw Error('unsupported_political_state_version');
    var ids={};TM.OfficeHolderState.scopes(g).forEach(function(scope){
      TM.OfficeHolderState.walk(scope.tree,function(pos,node,path){
        var org=S(pos.authorityFactionId||node.authorityFactionId||scope.organizationId),id=S(pos.id)||'political-office:'+encodeURIComponent(org)+':'+encodeURIComponent(path);
        var key=org+':'+id;if(ids[key]&&ids[key]!==pos)throw Error('ambiguous_position_migration:'+key);ids[key]=pos;
        if(!pos.id){pos.id=id;pos._identitySource='legacy-office-path';}
        if(!pos.holderId&&pos.holder){var ch=resolve('character',{name:pos.holder},g);if(ch)pos.holderId=ch.id;}
        A(pos.actualHolders).forEach(function(h){if(h&&h.generated!==false&&!h.characterId&&h.name){var ch=resolve('character',{name:h.name},g);if(ch)h.characterId=ch.id;}});
      });
    });
    if(TM.FactionDiplomacy)TM.FactionDiplomacy.migrate(g);
    st.politicalVersion=1;return {changed:true};
  }
  function migrate(g,opts){
    g=g||G();opts=opts||{};
    if(g._npcActionState&&g._npcActionState.politicalVersion===1)return {ok:true,changed:false};
    if(g!==G()) {var copy=JSON.parse(JSON.stringify(g));prepareMigration(copy);return {ok:true,game:copy,changed:true};}
    var guards=TM.AIChange&&TM.AIChange.WriteGuards;if(!guards)return {ok:false,reason:'migration_writer_unavailable'};
    return guards.runAtomicMutation(function(){var r=prepareMigration(g);if(opts.fault)opts.fault();return {ok:true,changed:r.changed};});
  }
  function strategicPrompt(){
    var g=G(),factions=A(g.facs).filter(publicOrganization).map(function(f){return {id:f.id,name:f.name};});
    var wars=A(g.activeWars).filter(function(w){return w&&!w.hidden&&w.visibility!=='private';}).map(function(w){return {id:w.id,attacker:w.attacker,defender:w.defender,startTurn:w.startTurn};});
    return {system:'根据公开的组织和战争事实整理战略候选。候选是供具体人物判断的建议，不是命令、既定结果或他人内心。不得推知隐秘通信、私财、未送达回应。',
      user:JSON.stringify({turn:g.turn,factions:factions,wars:wars})+'\n返回 JSON {faction_priorities:[{factionId,priority,reason}],faction_actions:[{factionId,action,targetId}],diplomatic_shifts:[{fromId,toId,new_relation,reason}],power_balance_shift}。只列少量值得评估的公开问题；不会因此直接改变外交、资产或职任。'};
  }
  function strategicCandidates(data,sourceId){
    var rows=A(data&&data.faction_actions).concat(A(data&&data.diplomatic_shifts).map(function(x){return {factionId:x.fromId,faction:x.from,targetId:x.toId,target:x.to,action:'评估外交建议：'+S(x.new_relation),reason:x.reason};})),out=[];
    rows.slice(0,12).forEach(function(r,i){var org=resolve('organization',{id:r.factionId,name:r.faction}),selected=org&&choose(org);
      if(!selected)return;var p=offer(org,selected.actor,{type:'diplomacy',targetOrganizationId:r.targetId,intent:S(r.action||r.strategic_intent),factStatus:'suggestion'},sourceId+':'+i);if(p)out.push(p.id);
    });return out;
  }
  TM.PoliticalActions={resolve:resolve,controlled:controlled,live:live,authority:authority,principals:principals,choose:choose,bind:bind,valid:valid,action:action,execute:execute,submit:submit,view:view,signature:signature,defer:defer,flush:flush,applyPacket:applyPacket,prompt:prompt,tools:tools,offer:offer,localCandidates:localCandidates,onReceipt:onReceipt,verifyEvidence:verifyEvidence,migrate:migrate,strategicPrompt:strategicPrompt,strategicCandidates:strategicCandidates,performWar:performWar,verifyReview:verifyReview,verifyIssued:function(a){return issuedDomainActions.has(a);}};
})(typeof window!=='undefined'?window:globalThis);
