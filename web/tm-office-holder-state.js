/* 官制共同读模型：实际占员、资料完整度和人物身份分别表达。 */
(function (global) {
  'use strict';
  function key(v) { return v == null ? '' : String(v).trim(); }
  function number(v, fallback) { return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : fallback; }
  function identity(G, id, name) {
    var chars = G && Array.isArray(G.chars) ? G.chars : [], stable = key(id), label = key(name);
    var matches = chars.filter(function(c) { return c && (stable ? key(c.id) === stable : label && c.name === label); });
    return { char: matches.length === 1 ? matches[0] : null, status: matches.length === 1 ? 'resolved' : matches.length > 1 ? 'ambiguous' : stable ? 'invalid-id' : 'unrecorded' };
  }
  function read(G, p) {
    p = p || {};
    var rows = Array.isArray(p.actualHolders) ? p.actualHolders.slice() : [];
    // canonical holder rows take precedence; an ID-only legacy mirror is still an occupant.
    if ((!Array.isArray(p.actualHolders) || (!rows.length && key(p.holderId))) && (key(p.holderId) || key(p.holder))) rows.push({ characterId: p.holderId, name: p.holder, appointedTurn:p.appointedTurn });
    if (!Array.isArray(p.actualHolders)) (p.additionalHolders || []).forEach(function(n,i) { rows.push({ name:n, characterId:(p.additionalHolderIds || [])[i] }); });
    var seen = Object.create(null), holders = [];
    rows.forEach(function(row,i) {
      if (!row) return;
      var id=key(row.characterId), name=key(row.name), k=id?'id:'+id:name?'name:'+name:'anonymous:'+i;
      if (seen[k]) return;
      seen[k]=true;
      var ref=row.generated===false && !id ? {char:null,status:'unrecorded'} : identity(G,id,name);
      holders.push({ row:row, char:ref.char, characterId:id || key(ref.char && ref.char.id), name:ref.char ? ref.char.name : name, identityStatus:ref.status });
    });
    var established=Math.max(0, number(p.establishedCount, number(p.headCount,1)));
    var anonymous=Math.max(0,number(p.unrecordedCount,0));
    var declared=number(p.actualCount, null);
    var fromVacancy=p.vacancyCount != null ? Math.max(0,established-number(p.vacancyCount,0)) : 0;
    // Legacy seat arrays also held empty vacancy placeholders. Explicit actual
    // and vacancy counts distinguish those rows from anonymous serving people.
    if(declared!=null || p.vacancyCount!=null) {
      function definite(h){return !!h.characterId || (h.row.generated!==false && !!h.name) || number(h.row.filledTurn,null)!=null;}
      var remaining=Math.max(0,Math.max(fromVacancy,declared==null?0:declared)-anonymous-holders.filter(definite).length);
      holders=holders.filter(function(h){if(definite(h))return true;if(remaining>0){remaining--;return true;}return false;});
    }
    var actual=Math.max(holders.length+anonymous, fromVacancy, declared == null ? 0 : Math.max(0,declared));
    if (p.occupancyStatus==='unrecorded' && declared==null && p.vacancyCount==null) actual=Math.max(actual,established);
    var named=holders.filter(function(h){return !!h.char;});
    var unresolved=holders.some(function(h){return h.identityStatus==='invalid-id'||h.identityStatus==='ambiguous';});
    return { actualCount:actual, establishedCount:established, vacancyCount:Math.max(0,established-actual), occupied:actual>0,
      status:actual<=0?'vacant':unresolved?'unresolved':named.length===actual?'known':'unrecorded', holders:holders, characters:named,
      primary:named.length ? named[0].char : null, label:named.length ? named.map(function(h){return h.name;}).join('、') : actual>0 ? (unresolved?'在岗·身份待核':'在岗·姓名未详') : '出缺' };
  }
  function walk(nodes, fn, parent, visited) {
    visited=visited || [];
    (nodes || []).forEach(function(n,i) {
      if (!n || visited.indexOf(n)>=0) return;
      visited.push(n);
      var path=(parent ? parent+'/' : '')+(key(n.id)||key(n.name)||String(i));
      (n.positions || []).forEach(function(p,j){ if(p) fn(p,n,path+'/'+(key(p.id)||key(p.name)+'#'+j)); });
      walk((n.subs || []).concat(n.children || []),fn,path,visited);
    });
  }
  // Read every authoritative tree in this world; never swap GM or materialize holders.
  function scopes(G) {
    var out=[],seen=[],native=G&&G.startContext&&G.startContext.schemaVersion==='tm-start-context/1'?G.nativeWorld:null,player=key(G&&G.startContext&&G.startContext.playerFactionId || G&&G.playerInfo&&G.playerInfo.factionId || G&&G.playerFactionId);
    if(!player){var marked=(G&&G.facs||[]).filter(function(f){return f&&f.isPlayer;});if(marked.length===1)player=key(marked[0].id);}
    if(!player){
      var pi=G&&G.playerInfo||{},liveInfo=G===global.GM&&global.P&&global.P.playerInfo||{},label=pi.factionName||G&&G.playerFactionName||G&&G.playerFaction||liveInfo.factionId||liveInfo.factionName;
      var match=(G&&G.facs||[]).filter(function(f){return f&&label&&(key(f.id)===key(label)||f.name===label);});if(match.length===1)player=key(match[0].id);
    }
    function add(tree,id,source){if(!Array.isArray(tree)||seen.indexOf(tree)>=0)return;seen.push(tree);out.push({tree:tree,organizationId:key(id),source:source});}
    if(native&&native.offices)Object.keys(native.offices).forEach(function(id){add(native.offices[id],id,'native');});
    if(!native||!native.offices||!native.offices[player])add(G&&G.officeTree,player,'world');
    (G&&G.facs||[]).forEach(function(f){if(f&&!(native&&native.offices&&native.offices[key(f.id)])&&!(key(f.id)===player&&Array.isArray(G.officeTree)&&G.officeTree.length))add(f.officeTree,f.id,'faction');});
    if(native)add(native.baseOfficeTree,'','native-base');
    return out;
  }
  function positions(G,ref) {
    ref=ref||{};var out=[],seen=[],id=key(ref.positionId||ref.id),org=key(ref.organizationId||ref.factionId);
    scopes(G).forEach(function(s){walk(s.tree,function(p,n,path){
      var owner=key(p.authorityFactionId||n.authorityFactionId||s.organizationId);
      if(seen.indexOf(p)>=0||id&&key(p.id)!==id||org&&owner!==org)return;
      seen.push(p);out.push({pos:p,node:n,key:owner+':'+path,organizationId:owner,source:s.source});
    });});return out;
  }
  function position(G,ref){var rows=positions(G,ref);return rows.length===1?rows[0]:null;}
  function assignments(G,ch,ref) {
    var out=[];
    positions(G,ref).forEach(function(a){read(G,a.pos).holders.forEach(function(h){
      var availabilityNow=h.char&&availability(G,h.char,a.pos);
      if(h.char!==ch&&!(availabilityNow&&availabilityNow.delegated&&availabilityNow.char===ch))return;
      out.push(Object.assign({},a,{dept:a.node.name||'',holder:h.row,principalCharacterId:h.characterId,delegated:h.char!==ch,
        appointmentId:key(h.row.appointmentId||a.pos.appointmentId),positionId:key(a.pos.id),jurisdiction:key(a.pos.jurisdictionId||a.pos.jurisdiction||a.node.jurisdictionId||a.node.jurisdiction||a.node.id||a.node.name)}));
    });});return out;
  }
  function activeAssignments(G,ch,ref) {
    return assignments(G,ch,ref).filter(function(a){var p=a.pos,h=a.holder||{},principal=a.delegated?identity(G,a.principalCharacterId).char:ch,av=availability(G,principal,p);
      return p.enabled!==false&&p.status!=='abolished'&&(p.expiresTurn==null||G.turn<p.expiresTurn)&&(h.expiresTurn==null||G.turn<h.expiresTurn)&&av.char===ch&&av.capacity>0;
    });
  }
  function select(G,ch,ref) {
    ref=ref||{};
    var matches=assignments(G,ch,{organizationId:ref.organizationId||ref.factionId}),aid=key(ref.appointmentId),pid=key(ref.positionId||ref.officeId),name=key(ref.position||ref.positionName),dept=key(ref.dept||ref.department),power=key(ref.power);
    if(aid)matches=matches.filter(function(a){return a.appointmentId===aid;});
    if(pid)matches=matches.filter(function(a){return a.positionId===pid;});
    if(name)matches=matches.filter(function(a){return a.pos.name===name;});
    if(dept)matches=matches.filter(function(a){return a.dept===dept||key(a.node.id)===dept;});
    if(power)matches=matches.filter(function(a){return a.pos.powers&&a.pos.powers[power];});
    return matches.length===1?matches[0]:null;
  }
  function availability(G,ch,p,day) {
    if(!ch) return {char:null,capacity:null,approved:false};
    if(day==null&&global.TM&&global.TM.TaxPolicy&&global.TM.TaxPolicy.now)day=global.TM.TaxPolicy.now(G);
    var leave=p.officeLeave || p.leave || ch.officeLeave || ch.leave || {};
    if(leave.startTurn!=null&&G.turn<Number(leave.startTurn)||leave.endTurn!=null&&G.turn>=Number(leave.endTurn))leave={};
    if(leave.characterId!=null && key(leave.characterId)!==key(ch.id)) leave={};
    if(day!=null && ((leave.startDay!=null && day<Number(leave.startDay)) || (leave.endDay!=null && day>=Number(leave.endDay)))) leave={};
    var approved=leave.approved===true || leave.status==='approved';
    var capacity=number(leave.capacity, number(ch.dutyCapacity,null));
    if(capacity==null) capacity=ch.dead===true || ch.alive===false || ch._imprisoned || ch.imprisoned || ch._missing || ch._exiled || ch._mourning ? 0 : ch.health!=null && number(ch.health,100)<=25 ? 0.4 : 1;
    if(leave.canPerform===false) capacity=0;
    var delegate=identity(G,leave.delegateId || p.actingHolderId,leave.delegate || p.actingHolder).char;
    if(delegate && delegate!==ch && approved && delegate.alive!==false && !delegate.dead && !delegate._imprisoned && !delegate.imprisoned) return {char:delegate,capacity:1,approved:approved,delegated:true};
    return {char:ch,capacity:Math.max(0,Math.min(1,capacity)),approved:approved,delegated:false};
  }
  var api={key:key,number:number,identity:identity,read:read,walk:walk,scopes:scopes,positions:positions,position:position,assignments:assignments,activeAssignments:activeAssignments,select:select,availability:availability};
  global.TM=global.TM || {}; global.TM.OfficeHolderState=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
