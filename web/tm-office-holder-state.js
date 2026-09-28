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
  function assignments(G, ch) {
    var out=[];
    walk(G && G.officeTree,function(p,n,path) {
      read(G,p).holders.forEach(function(h) { if(h.char===ch) out.push({ pos:p, dept:n.name || '', node:n, key:path, holder:h.row,
        appointmentId:key(h.row.appointmentId || p.appointmentId), positionId:key(p.id), jurisdiction:key(p.jurisdictionId || p.jurisdiction || n.jurisdictionId || n.jurisdiction || n.id || n.name) }); });
    });
    return out;
  }
  function select(G,ch,ref) {
    ref=ref || {};
    var matches=assignments(G,ch), aid=key(ref.appointmentId), pid=key(ref.positionId || ref.officeId), name=key(ref.position || ref.positionName), dept=key(ref.dept || ref.department), power=key(ref.power);
    if(aid) matches=matches.filter(function(a){return a.appointmentId===aid;});
    if(pid) matches=matches.filter(function(a){return a.positionId===pid;});
    if(name) matches=matches.filter(function(a){return a.pos.name===name;});
    if(dept) matches=matches.filter(function(a){return a.dept===dept || key(a.node.id)===dept;});
    if(power) matches=matches.filter(function(a){return a.pos.powers && a.pos.powers[power];});
    return matches.length===1 ? matches[0] : null;
  }
  function availability(G,ch,p,day) {
    if(!ch) return {char:null,capacity:null,approved:false};
    var leave=p.officeLeave || p.leave || ch.officeLeave || ch.leave || {};
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
  var api={key:key,number:number,identity:identity,read:read,walk:walk,assignments:assignments,select:select,availability:availability};
  global.TM=global.TM || {}; global.TM.OfficeHolderState=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
