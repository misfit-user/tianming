// Existing faction proposal queues and GM.treaties remain the canonical records.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{},TYPES={alliance:1,nonaggression:1,joint_action:1,peace:1,deal:1,ultimatum:1};
  var TYPE_CN={alliance:'结盟',nonaggression:'互不侵犯',joint_action:'联手',peace:'媾和',deal:'交易',ultimatum:'最后通牒'};
  function G(){return global.GM;}
  function A(x){return Array.isArray(x)?x:[];}
  function S(x){return x==null?'':String(x);}
  function copy(x){return JSON.parse(JSON.stringify(x));}
  function P(){return TM.PoliticalActions;}
  function L(){return TM.NPC&&TM.NPC.ActionLedger;}
  function result(s,r,refs,extra){return L().result(s,r,refs,extra);}
  function fac(ref,g){return P()&&P().resolve('organization',ref,g||G());}
  function person(id,g){return P()&&P().resolve('character',{id:id},g||G());}
  function all(g){var rows=[];A((g||G()).facs).forEach(function(f){A(f._incomingProposals).forEach(function(p){if(p&&!p.proposalRef)rows.push(p);});});return rows;}
  function get(id,g){var rows=all(g).filter(function(p){return p.id===id;});return rows.length===1?rows[0]:null;}
  function version(p,n){return A(p.versions).find(function(v){return v.version===(n==null?p.version:n);});}
  function terminal(p){return /^(accepted|rejected|cancelled|lapsed)$/.test(p.status);}
  function log(row){var g=G();if(!Array.isArray(g._factionDiplomacyLog))g._factionDiplomacyLog=[];g._factionDiplomacyLog.push(row);if(g._factionDiplomacyLog.length>80)g._factionDiplomacyLog.splice(0,g._factionDiplomacyLog.length-80);}
  function notice(text){try{if(typeof global.addEB==='function')global.addEB('外交',text);}catch(e){if(global.console)console.warn('[diplomacy notification]',e.message);}}
  function terms(raw){
    var text=S(raw.terms!=null?raw.terms:raw.treaty||raw.treatyName||raw.content),n=raw.durationTurns;
    if(!text.trim()||text.length>12000||raw.obligations!=null&&!Array.isArray(raw.obligations)||A(raw.obligations).length>20||n!=null&&(!Number.isInteger(n)||n<0||n>1200))return null;
    return {text:text,durationTurns:n==null?36:n,effectiveRule:'both_signatures',obligations:copy(raw.obligations||[])};
  }
  function hasPower(ch,org,power,ref){return P().authority(ch,Object.assign({},ref||{},{organizationId:org.id}),power);}
  function representative(org,explicit,requireSign){
    if(!org)return null;
    var rows=A(G().chars).filter(function(c){return P().live(c)&&(!explicit||S(c.id)===S(explicit))&&
      (role(c,org,{},!!requireSign)||TM.OfficeHolderState.activeAssignments(G(),c,{organizationId:org.id}).some(function(a){return hasPower(c,org,'treatySign',{actingPositionId:a.pos.id})||!requireSign&&hasPower(c,org,'diplomacy',{actingPositionId:a.pos.id});}));});
    rows.sort(function(a,b){return S(a.id).localeCompare(S(b.id));});return rows[0]||null;
  }
  function councilRole(ch,org,ref){
    if(!P().live(ch))return null;var rows=[];
    A(org.politicalRules).filter(function(r){return r&&r.kind==='treaty_council'&&r.status==='active'&&r.source&&r.id&&Number.isInteger(r.version)&&Number.isInteger(r.quorum)&&r.quorum>0&&r.quorum<=A(r.positionIds).length&&(!r.expiresTurn||G().turn<r.expiresTurn)&&(!ref.treatyType||!r.treatyTypes||r.treatyTypes.indexOf(ref.treatyType)>=0);}).forEach(function(rule){
      TM.OfficeHolderState.activeAssignments(G(),ch,{organizationId:org.id}).forEach(function(a){
        var principal=a.delegated?TM.OfficeHolderState.identity(G(),a.principalCharacterId).char:ch,av=TM.OfficeHolderState.availability(G(),principal,a.pos);
        if(rule.positionIds.indexOf(a.pos.id)<0||ref.actingPositionId&&a.pos.id!==ref.actingPositionId||av.char!==ch||!av.capacity||a.pos.enabled===false||a.pos.status==='abolished'||a.holder&&a.holder.expiresTurn!=null&&G().turn>=a.holder.expiresTurn)return;
        rows.push({pos:a.pos,positionId:a.pos.id,appointmentId:a.appointmentId,delegated:a.delegated,collectiveRule:rule});
      });
    });return rows.length===1?rows[0]:null;
  }
  function nextCouncilMember(p,org,rule){
    return A(G().chars).find(function(ch){var r=councilRole(ch,org,{treatyType:p.type});return r&&r.collectiveRule.id===rule.id&&!A(p.collectiveVotes).some(function(v){return v.actorId===ch.id&&v.version===p.version&&v.ruleVersion===rule.version;});})||null;
  }
  function role(ch,org,ref,sign){
    return hasPower(ch,org,sign?'treatySign':'diplomacy',ref)||(!sign&&hasPower(ch,org,'treatySign',ref))||councilRole(ch,org,ref||{});
  }
  function signed(p,orgId){return A(p.decisions).find(function(d){return d.organizationId===orgId&&d.version===p.version&&d.choice==='sign';});}
  function entry(p,d,kind,extra){
    var e=Object.assign({id:d.actionId,actionId:d.actionId,actorId:d.actorId,organizationId:d.organizationId,kind:kind,version:p.version,termsSignature:P().signature(version(p).terms),turn:G().turn},extra||{});
    p.history.push(e);if(!p.knownState)p.knownState={};p.knownState[d.actorId]={version:p.version,status:p.status,history:p.history.length,turn:G().turn,needsResponse:false};return e;
  }
  function consent(p,ch,org,d){
    var auth=role(ch,org,Object.assign({},d,{treatyType:p.type}),true);if(!auth)return false;
    var collective=null;
    if(auth.collectiveRule){
      var rule=auth.collectiveRule;if(!p.collectiveVotes)p.collectiveVotes=[];
      if(!p.collectiveVotes.some(function(v){return v.actorId===ch.id&&v.version===p.version&&v.ruleId===rule.id&&v.ruleVersion===rule.version;}))p.collectiveVotes.push({actorId:ch.id,positionId:auth.positionId,appointmentId:auth.appointmentId,organizationId:org.id,actionId:d.actionId,ruleId:rule.id,ruleVersion:rule.version,version:p.version,termsSignature:P().signature(version(p).terms),turn:G().turn});
      var seen={},votes=p.collectiveVotes.filter(function(v){var current=councilRole(person(v.actorId),org,{actingPositionId:v.positionId,treatyType:p.type});if(v.version!==p.version||v.ruleId!==rule.id||v.ruleVersion!==rule.version||!current||current.appointmentId!==v.appointmentId||seen[v.positionId])return false;seen[v.positionId]=true;return true;});
      if(votes.length<rule.quorum)return true;
      collective={ruleId:rule.id,ruleVersion:rule.version,source:rule.source,quorum:rule.quorum,participants:copy(votes)};
    }
    if(!signed(p,org.id))p.decisions.push({organizationId:org.id,actorId:ch.id,version:p.version,choice:'sign',actionId:d.actionId,
      collective:collective,basis:{positionId:auth.positionId||auth.pos&&auth.pos.id,appointmentId:auth.appointmentId,authorityRef:auth.authorityRef,delegated:!!auth.delegated},termsSignature:P().signature(version(p).terms),turn:G().turn});
    return true;
  }
  function enqueue(p,from,to,kind){
    var m={id:'dipmsg:'+ (++L().state(G()).sequence),proposalId:p.id,version:p.version,fromId:from.id,toId:to&&to.id||'',kind:kind,sentTurn:G().turn,
      deliveryTurn:G().turn+(to&&from.location&&from.location===to.location?0:1),deliveredTurn:null,state:p.status,history:p.history.length};
    p.messages.push(m);p.recipientId=m.toId;p.nextTurn=m.deliveryTurn;return m;
  }
  function remember(ch,m,p,text){if(!ch||!global.NpcMemorySystem)return;
    global.NpcMemorySystem.remember(ch.name,text,'平',5,'',{characterId:ch.id,_noMirror:true,relationshipHandled:true,sourceId:m.id,sourceRefs:[{kind:'diplomacy_message',id:m.id,proposalId:p.id,version:m.version}],factStatus:'received_document'});
  }
  function audience(p,m){
    var g=G(),v=version(p,m.version),from=fac({id:v.fromId});
    if(!Array.isArray(g._pendingAudiences))g._pendingAudiences=[];
    if(g._pendingAudiences.some(function(a){return a._diplomacyMessageId===m.id;}))return;
    var ng=TM.Negotiation&&TM.Negotiation.enabled()&&TM.Negotiation.open({topic:'diplomacy',initiator:from.name,sourceRef:{kind:'proposal',refId:p.id},offer:{by:'them',terms:v.terms.text},turn:g.turn});
    g._pendingAudiences.push({name:from.name+'使节',reason:'【'+TYPE_CN[p.type]+'】'+v.terms.text,turn:g.turn,isEnvoy:true,fromFaction:from.name,
      interactionType:'faction_proposal',_fromFactionId:from.id,_factionProposalId:p.id,_proposalVersion:m.version,_diplomacyType:p.type,_diplomacyMessageId:m.id,_negotiationId:ng?ng.id:undefined});
    if(!Array.isArray(g._pendingFactionProposalsToPlayer))g._pendingFactionProposalsToPlayer=[];
    if(!g._pendingFactionProposalsToPlayer.some(function(x){return x.id===p.id;}))g._pendingFactionProposalsToPlayer.push({id:p.id,proposalRef:p.id,toId:p.toId});
  }
  function advance(){
    if(!P()||!G())return;all().forEach(function(p){if(p.schemaVersion!==2)return;
      A(p.messages).forEach(function(m){if(m.deliveredTurn!=null||m.deliveryTurn>G().turn)return;var to=person(m.toId);
        if(!P().live(to))return;m.deliveredTurn=G().turn;p.knowledge[to.id]=Math.max(p.knowledge[to.id]||0,m.version);
        if(!p.knownState)p.knownState={};var known=p.knownState[to.id];
        if(!known||m.version>known.version||m.version===known.version&&m.history>=known.history)p.knownState[to.id]={version:m.version,status:m.state==='in_transit'?'pending':m.state,history:m.history,turn:G().turn,needsResponse:m.state!=='accepted'&&['proposal','private_suggestion','counter','signed_draft','handoff','replanned_draft'].indexOf(m.kind)>=0};
        if(!terminal(p)&&m.version===p.version)p.status=p.status==='draft'?'draft':'pending';
        remember(to,m,p,'收到'+(person(m.fromId)&&person(m.fromId).name||'使者')+'关于'+TYPE_CN[p.type]+'的第'+m.version+'版文书：'+version(p,m.version).terms.text);
        if(P().controlled(to,G()))audience(p,m);
      });
    });refreshCaches(G());
  }
  function create(org,ch,d){
    var target=fac({id:d.toFactionId||d.targetOrganizationId||d.targetId,name:d.toFaction||d.targetFaction||d.target}),t=terms(d),type=d.proposalType||d.treatyType||(TYPES[d.type]?d.type:d.relationType);
    if(!target||target===org||!TYPES[type]||!t)return result('blocked','specific_parties_type_and_terms_required');
    d.treatyType=type;var negotiating=role(ch,org,d,false),receiver=representative(negotiating?target:org,d.recipientId,!negotiating);
    var p={schemaVersion:2,id:'dp:'+ (++L().state(G()).sequence),from:org.name,fromId:org.id,to:target.name,toId:target.id,type:type,terms:t.text,
      version:1,versions:[{version:1,fromId:org.id,toId:target.id,terms:t,createdTurn:G().turn}],turn:G().turn,status:negotiating?'in_transit':'draft',
      initiatorId:ch.id,recipientOrganizationId:negotiating?target.id:org.id,decisions:[],messages:[],history:[],knowledge:{}};
    p.knowledge[ch.id]=1;
    if(!Array.isArray(target._incomingProposals))target._incomingProposals=[];
    target._incomingProposals.push(p);
    if(negotiating)consent(p,ch,org,d);
    enqueue(p,ch,receiver,negotiating?'proposal':'private_suggestion');entry(p,d,negotiating?'propose':'suggest');
    remember(ch,{id:d.actionId},p,'提出'+TYPE_CN[type]+'文书：'+t.text);
    return result('submitted',negotiating?'提案已签发，等待实际送达与对方决定':'私人建议已送交有权代表，尚无国家签署',
      [{kind:'diplomacy_step',id:d.actionId,proposalId:p.id,version:p.version}],{proposalId:p.id,proposalVersion:p.version});
  }
  function lodge(p,d){
    var a=fac({id:p.fromId}),b=fac({id:p.toId}),v=version(p),prior=A(G().treaties).find(function(t){return t.proposalId===p.id&&t.proposalVersion===p.version;});
    if(prior)return result('failed','treaty_already_exists_without_action_receipt');
    var sa=signed(p,a.id),sb=signed(p,b.id),sig=P().signature(v.terms);
    if(!sa||!sb||sa.termsSignature!==sig||sb.termsSignature!==sig)return result('blocked','both_current_terms_signatures_required');
    if(!global.TreatySystem||typeof global.TreatySystem.createTreaty!=='function')return result('blocked','treaty_domain_unavailable');
    var type=p.type==='peace'?'truce':p.type,treaty=global.TreatySystem.createTreaty(type,{id:a.id,name:a.name},{id:b.id,name:b.name},copy(v.terms));
    if(!treaty)return result('blocked','treaty_type_not_supported');
    Object.assign(treaty,{from:a.name,to:b.name,fromId:a.id,toId:b.id,status:'active',active:true,startTurn:G().turn,effectiveTurn:G().turn,
      durationTurns:v.terms.durationTurns,expiryTurn:v.terms.durationTurns?G().turn+v.terms.durationTurns:0,expiresTurn:v.terms.durationTurns?G().turn+v.terms.durationTurns:null,
      proposalId:p.id,proposalVersion:p.version,sourceActionId:d.actionId,signatures:copy([sa,sb]),termsSignature:sig,sourceStatus:'verified_decision'});
    if(p.type==='peace'){
      if(!global.CasusBelliSystem)throw Error('war_domain_unavailable');
      A(G().activeWars).slice().filter(function(w){return w.attacker===a.name&&w.defender===b.name||w.attacker===b.name&&w.defender===a.name;}).forEach(function(w){global.CasusBelliSystem.endWar(w.id);});
    }
    p.status='accepted';p.effectiveTurn=G().turn;p.treatyId=treaty.id;
    p.obligations=copy(v.terms.obligations).map(function(o,i){return Object.assign({},o,{id:p.id+':obligation:'+i,status:'unfulfilled'});});
    entry(p,d,'effective',{treatyId:treaty.id});
    var otherOrg=fac({id:d.organizationId===p.fromId?p.toId:p.fromId}),receiver=representative(otherOrg);
    enqueue(p,person(d.actorId),receiver,'effective');
    log({id:d.actionId,kind:'effective',turn:G().turn,fromId:p.fromId,toId:p.toId,type:p.type,proposalId:p.id,treatyId:treaty.id,sourceKind:'verified_result'});refreshCaches(G());
    return result('completed','双方当前条款已生效；约定的资源义务另待实际履行',[{kind:'treaty',id:treaty.id,proposalId:p.id,version:p.version}],{proposalId:p.id,treatyId:treaty.id,unfulfilledObligations:p.obligations.length});
  }
  function respond(org,ch,d){
    var p=get(d.proposalId),choice=d.response||d.decision;
    if(!p)return result('blocked','unknown_proposal');
    if(p.schemaVersion!==2) {
      if(choice!=='replan'||!role(ch,org,d,false)||!d.terms)return result('blocked','legacy_proposal_requires_authorized_replan');
      var from=fac({id:p.fromId,name:p.from}),to=fac({id:p.toId,name:p.to}),t=terms(d);
      if(!from||!to||org.id!==from.id||!t||!TYPES[p.type])return result('blocked','legacy_parties_or_terms_unresolved');
      var legacy=copy(p),id=p.id;
      Object.assign(p,{schemaVersion:2,sourceStatus:'replanned',legacy:legacy,fromId:from.id,toId:to.id,version:1,
        versions:[{version:1,fromId:from.id,toId:to.id,terms:t,createdTurn:G().turn}],terms:t.text,status:'in_transit',decisions:[],history:[],messages:[],knowledge:{},initiatorId:ch.id,recipientOrganizationId:to.id});
      p.knowledge[ch.id]=1;consent(p,ch,org,d);entry(p,d,'replan');enqueue(p,ch,representative(to),'replanned_draft');
      return result('submitted','旧事项原位重拟，未补造旧签署或旧效果',[{kind:'diplomacy_step',id:d.actionId,proposalId:id,version:1}],{proposalId:id,proposalVersion:1});
    }
    if(d.proposalVersion!==p.version)return result('blocked','proposal_version_mismatch');
    if(terminal(p)&&!(p.status==='accepted'&&choice==='handoff'))return result('noop','proposal_already_resolved');
    if(p.knowledge[ch.id]!==p.version)return result('blocked','current_terms_not_received');
    if([p.fromId,p.toId].indexOf(org.id)<0)return result('blocked','not_a_party');
    d.treatyType=p.type;var current=version(p),other=fac({id:org.id===p.fromId?p.toId:p.fromId}),negotiating=role(ch,org,d,false);
    if(!negotiating)return result('blocked','current_representative_authority_required');
    if(choice==='handoff'){
      var successor=representative(org,d.successorId)||person(d.successorId);if(!P().live(successor))return result('blocked','successor_identity_unresolved');
      enqueue(p,ch,successor,'handoff');entry(p,d,'handoff');
    }else if(choice==='cancel'||choice==='reject'){
      p.status=choice==='cancel'?'cancelled':'rejected';entry(p,d,choice);enqueue(p,ch,representative(other),'response');
    }else if(choice==='defer'||choice==='temporize'){
      p.status='pending';p.nextTurn=G().turn+1;entry(p,d,'defer');
    }else if(choice==='counter'){
      var next=terms(Object.assign({},d,{terms:d.counterTerms!=null?d.counterTerms:d.terms}));if(!next)return result('blocked','counter_terms_required');
      p.version++;p.versions.push({version:p.version,fromId:org.id,toId:other.id,terms:next,createdTurn:G().turn});p.terms=next.text;
      if(TM.Negotiation&&TM.Negotiation.findOpenByRef){var ng=TM.Negotiation.findOpenByRef('proposal',p.id);if(ng){ng.offers.push({by:P().controlled(ch,G())?'player':'them',terms:next.text.slice(0,80),proposalVersion:p.version,turn:G().turn});ng.round++;ng.expireTurn=G().turn+4;}}
      p.knowledge[ch.id]=p.version;p.recipientOrganizationId=other.id;p.status='in_transit';consent(p,ch,org,d);entry(p,d,'counter');enqueue(p,ch,representative(other),'counter');
    }else if(choice==='accept'||choice==='approve'){
      if(!consent(p,ch,org,d))return result('blocked','final_signature_authority_required');
      if(signed(p,p.fromId)&&signed(p,p.toId))return lodge(p,d);
      var ownRule=councilRole(ch,org,Object.assign({},d,{treatyType:p.type})),next=!signed(p,org.id)&&ownRule&&nextCouncilMember(p,org,ownRule.collectiveRule);
      p.status='in_transit';p.recipientOrganizationId=next?org.id:other.id;entry(p,d,next?'vote':'sign');enqueue(p,ch,next||representative(other,null,true),'signed_draft');
    }else return result('blocked','explicit_response_required');
    return result('submitted','本次答复已记录，后续按送达、双方签署和实际履行推进',[{kind:'diplomacy_step',id:d.actionId,proposalId:p.id,version:p.version}],{proposalId:p.id,proposalVersion:p.version});
  }
  function submit(org,raw,context,index){
    if(!P()||!L())return {outcome:'blocked',reason:'political_boundary_unavailable'};
    org=fac({id:org&&org.id});if(!org)return result('blocked','organization_unresolved');
    advance();var d=Object.assign({},raw,{behaviorType:'diplomacy',targetType:'organization'});
    return P().execute(context,d,function(ch,target,x){return x.diplomacyAction?unilateral(org,ch,x):x.proposalId?respond(org,ch,x):create(org,ch,x);},index);
  }
  function unilateral(org,ch,d){
    if(d.diplomacyAction!=='withdraw_treaty')return result('blocked','unilateral_operation_not_supported');
    if(!role(ch,org,d,true))return result('blocked','current_treaty_authority_required');
    var hits=A(G().treaties).filter(function(t){return t.id===d.treatyId;}),t=hits.length===1&&hits[0],p=t&&get(t.proposalId);
    if(!t||t.active===false||!A(t.parties).some(function(x){return x&&x.id===org.id;}))return result('blocked','active_party_treaty_required');
    if(!p||!p.knownState||!p.knownState[ch.id]||p.knownState[ch.id].status!=='accepted')return result('blocked','effective_agreement_not_yet_known');
    if(!global.TreatySystem||!global.TreatySystem.breakTreaty)return result('blocked','treaty_domain_unavailable');
    global.TreatySystem.breakTreaty(t.id,org.name);t.terminationActionId=d.actionId;t.terminatedTurn=G().turn;
    if(t.active!==false)throw Error('treaty_termination_postcondition');
    log({id:d.actionId,kind:'withdraw',turn:G().turn,fromId:org.id,treatyId:t.id,sourceKind:'verified_result'});refreshCaches(G());
    return result('completed','本方退出已生效协议；既有交付与历史继续保留',[{kind:'treaty_termination',id:t.id}],{treatyId:t.id});
  }
  function refreshCaches(g){
    A(g.facs).forEach(function(f){
      var strategy=f.aiStrategy;if(!strategy||typeof strategy!=='object'||Array.isArray(strategy))strategy=f.aiStrategy={legacyText:typeof strategy==='string'?strategy:''};var previous=A(strategy.treatyAllianceIds),current=[];
      A(g.treaties).filter(function(t){return t.active!==false&&t.type==='alliance'&&(!t.expiryTurn||t.expiryTurn>g.turn);}).forEach(function(t){
        var parties=A(t.parties).map(function(p){return typeof p==='object'?fac(p,g):fac(p,g);}).filter(Boolean);
        if(!parties.some(function(p){return p.id===f.id;}))return;parties.forEach(function(p){if(p.id!==f.id&&current.indexOf(p.id)<0)current.push(p.id);});
      });
      strategy.allianceIds=A(strategy.allianceIds).filter(function(id){return previous.indexOf(id)<0;});current.forEach(function(id){if(strategy.allianceIds.indexOf(id)<0)strategy.allianceIds.push(id);});
      var oldNames=previous.map(function(id){var x=fac({id:id},g);return x&&x.name;});strategy.alliances=A(strategy.alliances).filter(function(name){return oldNames.indexOf(name)<0;});
      current.forEach(function(id){var x=fac({id:id},g);if(x&&strategy.alliances.indexOf(x.name)<0)strategy.alliances.push(x.name);});strategy.treatyAllianceIds=current;
    });
  }
  function recordProposals(from,rows,turn,opts){
    opts=opts||{};var org=fac(from),out={recorded:0,toPlayer:0,results:[]};if(!org)return out;
    A(rows).slice(0,4).forEach(function(p,i){var r=submit(org,p,opts.binding,'proposal:'+i);out.results.push(r);if(r.outcome==='submitted')out.recorded++;});return out;
  }
  function applyResponses(org,rows,turn,opts){
    opts=opts||{};var out={resolved:0,submitted:0,results:[]};A(rows).slice(0,6).forEach(function(r,i){var res=submit(org,Object.assign({},r,{proposalId:r.proposalId||r.id}),opts.binding,'response:'+i);out.results.push(res);if(res.outcome==='completed')out.resolved++;else if(res.outcome==='submitted')out.submitted++;});return out;
  }
  function visible(ch,org){var old=all().filter(function(p){return p.schemaVersion!==2&&[p.fromId,p.toId].indexOf(org.id)>=0&&!terminal(p)&&role(ch,org,{},false);}).map(function(p){return {id:p.id,version:0,type:p.type,terms:{text:S(p.terms)},fromId:p.fromId,toId:p.toId,status:'needs_replan',sourceStatus:'legacy_unbound',recipientId:ch.id};});return old.concat(all().filter(function(p){return p.schemaVersion===2&&p.knowledge[ch.id]&&[p.fromId,p.toId].indexOf(org.id)>=0;}).map(function(p){
    var known=p.knownState&&p.knownState[ch.id],v=version(p,p.knowledge[ch.id]);
    return {id:p.id,version:v.version,type:p.type,terms:copy(v.terms),fromId:p.fromId,toId:p.toId,status:known&&known.status||'pending',recipientId:known&&known.needsResponse?ch.id:null,
      obligations:known&&known.status==='accepted'?copy(p.obligations||[]):undefined};
  })).sort(function(a,b){function priority(x){return x.recipientId?0:A(x.obligations).some(function(o){return o.status==='unfulfilled';})?1:/^(accepted|rejected|cancelled)$/.test(x.status)?3:2;}return priority(a)-priority(b);});}
  function due(ch,org){return all().some(function(p){if([p.fromId,p.toId].indexOf(org.id)<0)return false;var known=p.knownState&&p.knownState[ch.id];return !!known&&(known.needsResponse||known.status==='accepted'&&A(p.obligations).some(function(o){return o.status==='unfulfilled';}));});}
  function inputView(ch,org){var rows=visible(ch,org),active=rows.filter(function(p){return p.recipientId||A(p.obligations).some(function(o){return o.status==='unfulfilled';});}),rest=rows.filter(function(p){return active.indexOf(p)<0;}),offset=active.length?(G().turn*12)%active.length:0;return active.slice(offset).concat(active.slice(0,offset),rest).slice(0,12);}
  function formatIncomingProposals(org,turn,actor){return actor?visible(actor,org).map(function(p){return JSON.stringify(p);}):[];}
  function verify(ref,d,g,before){
    if(ref.kind==='treaty_termination')return A(before.treaties).some(function(t){return t.id===ref.id&&t.active!==false;})&&A(g.treaties).some(function(t){return t.id===ref.id&&t.active===false&&t.terminationActionId===d.actionId;});
    var p=get(ref.proposalId,g),old=get(ref.proposalId,before),v=p&&version(p,ref.version),sig=v&&P().signature(v.terms);
    if(!p||!v)return false;
    if(ref.kind==='diplomacy_step')return !A(old&&old.history).some(function(e){return e.id===ref.id;})&&A(p.history).some(function(e){return e.id===d.actionId&&e.id===ref.id&&e.actorId===d.actorId&&e.organizationId===d.organizationId&&e.version===ref.version&&e.termsSignature===sig;});
    if(ref.kind==='treaty')return !A(before.treaties).some(function(t){return t.id===ref.id;})&&A(g.treaties).some(function(t){return t.id===ref.id&&t.sourceActionId===d.actionId&&t.proposalId===p.id&&t.proposalVersion===ref.version&&t.termsSignature===sig&&t.active===true&&p.status==='accepted'&&
      [p.fromId,p.toId].every(function(id){return A(t.signatures).some(function(s){return s.organizationId===id&&s.version===ref.version&&s.termsSignature===sig;});});});
    return false;
  }
  function resourceObligation(d,actor,g){
    var p=get(d.proposalId,g),o=p&&A(p.obligations).find(function(o){return o.id===d.obligationId;});
    if(!p||p.schemaVersion!==2||p.status!=='accepted'||p.version!==d.proposalVersion||!o||o.kind!=='public_transfer')return {ok:false,reason:'current_typed_obligation_required'};
    if(o.status==='fulfilled')return {ok:false,reason:'obligation_already_fulfilled',duplicate:true,operationRefs:o.operationRefs};
    if(p.knowledge[actor.id]!==p.version)return {ok:false,reason:'obligation_terms_not_received'};
    if(o.fromAccount!==d.fromAccount||o.toAccount!==d.toAccount||P().signature(o.amounts)!==P().signature(d.amounts))return {ok:false,reason:'obligation_transfer_mismatch'};
    return {ok:true,obligation:o};
  }
  function fulfillResourceObligation(d,ref){var p=get(d.proposalId),o=p&&A(p.obligations).find(function(o){return o.id===d.obligationId;});if(!o||o.status!=='unfulfilled')throw Error('obligation_changed_during_transfer');o.status='fulfilled';o.fulfilledTurn=G().turn;o.fulfilledActionId=d.actionId;o.operationRefs=[copy(ref)];}
  function recordPlayerProposal(org,raw,origin){
    var players=A(G().chars).filter(function(c){return P().controlled(c,G());});org=fac(org);
    if(!org||players.length!==1||!origin)return result('blocked','player_and_stable_source_required');
    var st=L().state(G());if(!st.playerProposalSources)st.playerProposalSources={};
    var key=JSON.stringify([org.id,String(origin)]);if(!st.playerProposalSources[key])st.playerProposalSources[key]='human-proposal:'+ (++st.sequence);
    var d=Object.assign({},raw,{actorId:players[0].id,organizationId:org.id,actionId:st.playerProposalSources[key],phase:'execute',behaviorType:'diplomacy',targetType:'organization'});
    return L().executeHuman(players[0],d,null,function(ch,target,x){return create(org,ch,x);});
  }
  function recordPlayerResponse(from,info){
    var p=get(info&&info.id),ch=A(G().chars).filter(function(c){return P().controlled(c,G());});
    if(!p||ch.length!==1||!L().executeHuman)return result('blocked','player_identity_or_proposal_unresolved');
    advance();var st=L().state(G()),key=JSON.stringify([p.id,info.proposalVersion,info.outcome]);if(!st.playerDiplomacySources)st.playerDiplomacySources={};
    if(!st.playerDiplomacySources[key])st.playerDiplomacySources[key]='player-diplomacy:'+ (++st.sequence);
    var org=fac({id:p.recipientOrganizationId}),d={actionId:st.playerDiplomacySources[key],phase:'execute',actorId:ch[0].id,organizationId:org&&org.id,proposalId:p.id,proposalVersion:info.proposalVersion,
      behaviorType:'diplomacy',targetType:'organization',response:({accepted:'accept',rejected:'reject',countered:'counter',temporized:'defer'})[info.outcome],counterTerms:info.counterTerms,terms:info.terms,obligations:info.obligations,actingPositionId:info.actingPositionId};
    return org?L().executeHuman(ch[0],d,null,function(actor,target,x){return respond(org,actor,x);}):result('blocked','player_party_unresolved');
  }
  function migrate(g){
    if(!P())return;var changes=[];
    A(g._pendingFactionProposalsToPlayer).forEach(function(old){
      if(!old||old.proposalRef)return;var target=fac({id:old.toId||g.playerInfo&&g.playerInfo.factionId,name:old.to},g);
      if(!target){old.sourceStatus=old.sourceStatus||'legacy_unbound';return;}
      var matches=all(g).filter(function(p){return p.id===old.id;});if(matches.length>1)throw Error('ambiguous_legacy_proposal');
      if(!matches.length){if(!Array.isArray(target._incomingProposals))target._incomingProposals=[];target._incomingProposals.push(copy(old));}
      old.proposalRef=old.id;
    });A(g.facs).forEach(function(f){A(f._incomingProposals).forEach(function(p){if(!p||p.schemaVersion===2||p.sourceStatus==='legacy_unbound')return;var n=copy(p);n.sourceStatus='legacy_unbound';n.legacyStatus=n.status;changes.push({target:p,next:n});});});
    A(g.treaties).forEach(function(t){if(!t||t.sourceStatus)return;var n=copy(t);n.sourceStatus='legacy_unattributed';if(!n.parties&&n.from&&n.to){var a=fac(n.from,g),b=fac(n.to,g);if(a&&b)n.parties=[{id:a.id,name:a.name},{id:b.id,name:b.name}];}
      if(n.active==null)n.active=!/^(expired|broken|cancelled|inactive)$/.test(n.status||'');if(n.status==null)n.status=n.active?'active':'inactive';if(n.expiryTurn==null&&n.expiresTurn!=null)n.expiryTurn=n.expiresTurn;changes.push({target:t,next:n});});
    changes.forEach(function(x){Object.assign(x.target,x.next);});
  }
  if(global.TreatySystem)global.TreatySystem.onChange=function(){refreshCaches(G());};
  function diplomacyLog(g){return A((g||G())._factionDiplomacyLog);}
  TM.FactionDiplomacy={recordProposals:recordProposals,applyResponses:applyResponses,submit:submit,advance:advance,visible:visible,inputView:inputView,due:due,get:get,verifyEvidence:verify,migrate:migrate,refreshCaches:refreshCaches,
    resourceObligation:resourceObligation,fulfillResourceObligation:fulfillResourceObligation,recordPlayerProposal:recordPlayerProposal,recordPlayerResponse:recordPlayerResponse,formatIncomingProposals:formatIncomingProposals,formatPlayerProposalOutcomes:function(org,turn,actor){return actor?visible(actor,org).filter(function(p){return /^(accepted|rejected|cancelled)$/.test(p.status);}).map(function(p){return JSON.stringify(p);}):[];},diplomacyLog:diplomacyLog,
    summarize:function(g){return {recentEvents:diplomacyLog(g).length,pending:all(g).filter(function(p){return !terminal(p);}).length};},TYPE_CN:TYPE_CN};
})(typeof window!=='undefined'?window:globalThis);
