// Canonical creation of runtime parties and social classes; never synthesizes people or troops.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  function arr(v) { return Array.isArray(v) ? v : []; }
  function text(v) { return typeof v === 'string' ? v.trim() : ''; }
  function valid(v) { return !!v && v.length <= 100 && !/[\x00-\x1f<>]/.test(v) && !['__proto__','prototype','constructor'].includes(v); }
  function live(c) { return !!c && c.alive !== false && c.dead !== true; }
  function value(v, fallback, min, max) {
    if (v == null || v === '') return fallback;
    var n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }
  function exact(list, ref) {
    ref = typeof ref === 'object' && ref ? (ref.id || ref.name) : ref;
    ref = text(ref); if (!ref) return null;
    var ids = arr(list).filter(function (x) { return x && x.id === ref; });
    var found = ids.length ? ids : arr(list).filter(function (x) { return x && text(x.name) === ref; });
    return found.length === 1 ? found[0] : null;
  }
  function fail(g, kind, name, reason) {
    if (!Array.isArray(g._entityFormationFailures)) g._entityFormationFailures = [];
    var row = { kind:kind, name:name, reason:reason, turn:Number(g.turn)||0 };
    var last = g._entityFormationFailures[g._entityFormationFailures.length - 1];
    if (!last || JSON.stringify(last) !== JSON.stringify(row)) g._entityFormationFailures.push(row);
    if (g._entityFormationFailures.length > 100) g._entityFormationFailures.splice(0, g._entityFormationFailures.length - 100);
    try { if (root.addEB) root.addEB('新建未落地', name + '：' + reason); } catch (_) {}
    return { ok:false, changed:false, reason:reason, kind:kind, name:name };
  }
  function idFor(g, kind, name, list, requested) {
    var h = 2166136261, key = kind + '/' + (g.sid || '') + '/' + name;
    for (var i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    var base = requested || kind + '_' + (h >>> 0).toString(36), id = base, n = 1;
    if (requested && (!valid(requested) || list.some(function (x) { return x.id === requested; }))) return '';
    while (list.some(function (x) { return x.id === id; })) id = base + '_' + n++;
    return id;
  }
  function references(g, refs, field, opts) {
    var found = [], seen = new Set();
    for (var ref of arr(refs)) {
      var c = exact(g.chars, ref);
      if (!live(c)) return { error:field + '必须引用唯一在册活人：' + String(typeof ref === 'object' ? ref.id || ref.name : ref) };
      if (c.isPlayer && !(opts && opts.authoritative)) return { error:'不得借群体创建替玩家改变党籍或阶层身份' };
      if (!seen.has(c)) { seen.add(c); found.push(c); }
    }
    return { chars:found };
  }
  function emit(g, kind, entity, reason, opts) {
    opts = opts || {}; var turn = Number(g.turn) || 0, key = kind === 'party' ? 'parties' : 'classes';
    if (!Array.isArray(g._turnReport)) g._turnReport = [];
    g._turnReport.push({type:kind + '_create', entityId:entity.id, name:entity.name, field:'created', old:false, new:true, reason:reason, turn:turn, source:opts.source || 'social-formation'});
    g.turnChanges = g.turnChanges || {}; if (!Array.isArray(g.turnChanges[key])) g.turnChanges[key] = [];
    g.turnChanges[key].push({id:entity.id,name:entity.name,changes:[{field:'新建',oldValue:'未成立',newValue:'已成立',reason:reason}]});
    g._continuityRevision = (Number(g._continuityRevision)||0) + 1;
    try { if (TM.Indices && TM.Indices.invalidate) TM.Indices.invalidate(g, opts.preview ? null : root.P); } catch (_) {}
    try { if (!opts.preview && root.addEB) root.addEB(kind === 'party' ? '新党形成' : '新阶层形成', entity.name + '：' + reason); } catch (_) {}
    if(g===root.GM){
      try { if(TM.Qiju && TM.Qiju.recordEntry) TM.Qiju.recordEntry({turn:turn,content:'【'+(kind==='party'?'新党':'新阶层')+'形成】'+entity.name+'：'+reason,category:'社会',entityId:entity.id}); } catch (_) {}
      if(root.NpcMemorySystem && root.NpcMemorySystem.remember) arr(kind==='party'?entity.members:entity.representativeNpcs).forEach(function(n){
        try { root.NpcMemorySystem.remember(n,'本局'+entity.name+'形成：'+reason,'平',7,'',{type:'social_formation',source:'witnessed',sourceRefs:[{type:kind,id:entity.id,turn:turn}]}); } catch (_) {}
      });
    }
    return {ok:true,changed:true,created:true,entity:entity,path:key + '/' + entity.id};
  }
  function createParty(g, raw, opts) {
    raw = raw || {}; opts = opts || {};
    var name = text(raw.name || raw.partyName || raw.party);
    if (!g) return {ok:false,reason:'没有当前世界'};
    if (!valid(name)) return fail(g,'party',name,'名称无效');
    if (g.parties != null && !Array.isArray(g.parties)) return fail(g,'party',name,'名册格式无效，保留旧数据');
    var list = arr(g.parties), old = exact(list,name);
    if (old) return {ok:true,changed:false,duplicate:true,entity:old,path:'parties/' + (old.id || name)};
    var reason = text(raw.reason || raw.trigger || opts.reason);
    if (!reason) return fail(g,'party',name,'须给出本局形成依据');
    var leaderRef = raw.leaderId || raw.leader || raw.head;
    var members = references(g, arr(raw.members || raw.memberNames).concat(leaderRef ? [leaderRef] : []), '创始成员', opts);
    if (members.error) return fail(g,'party',name,members.error);
    arr(g.chars).forEach(function(c) {
      if(live(c) && !c.isPlayer && c.party === name && !members.chars.includes(c)) members.chars.push(c);
    });
    var bases = [];
    for (var sb of arr(raw.socialBase)) {
      if (typeof sb === 'string') sb = {class:sb};
      var cls = sb && exact(g.classes,sb.classId || sb.class || sb.name);
      if (!cls) return fail(g,'party',name,'社会基础必须引用已存在的阶层');
      bases.push({class:cls.name,classId:cls.id || '',affinity:value(sb.affinity,.5,-1,1)});
    }
    if (!members.chars.length && !bases.length && !opts.authoritative) return fail(g,'party',name,'至少需要在册创始成员或可核对的社会基础');
    var id = idFor(g,'party',name,list,text(raw.id));
    if(!id) return fail(g,'party',name,'ID无效或已被占用');
    var leader = leaderRef ? exact(g.chars,leaderRef) : null;
    var p = {id:id,sid:g.sid || '',name:name,ideology:text(raw.ideology),
      leader:leader ? leader.name : '',head:leader ? leader.name : '',leaderId:leader ? leader.id || '' : '',
      members:members.chars.map(function(c){return c.name;}),memberIds:members.chars.map(function(c){return c.id || c.name;}),memberCount:members.chars.length,
      influence:value(raw.influence,20,0,100),cohesion:value(raw.cohesion,70,0,100),status:text(raw.status) || '活跃',crossFaction:raw.crossFaction === true,
      currentAgenda:text(raw.currentAgenda),socialBase:bases,agenda_history:[{turn:Number(g.turn)||0,agenda:'形成新党',outcome:reason}],
      focal_disputes:[],officePositions:[],description:reason,_createdTurn:Number(g.turn)||0};
    g.parties = list; list.push(p);
    members.chars.forEach(function(c) { c.party = name; c.partyId = id; c.partyRank = c === leader ? '党魁' : '成员'; });
    list.forEach(function(other){
      if(other===p)return;
      if(Array.isArray(other.members))other.members=other.members.filter(function(n){return !members.chars.some(function(c){return c.name===n||c.id===n;});});
      if(Array.isArray(other.memberIds))other.memberIds=other.memberIds.filter(function(n){return !members.chars.some(function(c){return c.id===n||c.name===n;});});
      if(members.chars.some(function(c){return other.leader===c.name||other.head===c.name;})){other.leader='';other.head='';other.leaderId='';}
      other.memberCount = arr(g.chars).filter(function(c){return live(c) && c.party===other.name;}).length;
    });
    return emit(g,'party',p,reason,opts);
  }
  function classPopulation(g, raw, id) {
    var pop = g.population, by = pop && pop.byClass;
    var keys = arr(raw.populationKeys).map(text).filter(Boolean);
    if (keys.length && raw.populationCount != null && Number(raw.populationCount) !== 0) return {error:'绑定已有分类与转移人口须择一明确，未重复计人口'};
    if (keys.length) {
      if (!by || keys.some(function(k){return !valid(k) || !Object.prototype.hasOwnProperty.call(by,k);})) return {error:'人口分类键不存在，未创建虚构人口'};
      return {keys:keys};
    }
    var count = raw.populationCount != null ? Number(raw.populationCount) : null;
    var source = raw.fromClass || raw.originClass;
    if (count === 0 && !source) return {keys:[id],pending:true,by:by};
    if (count != null) {
      if (!Number.isSafeInteger(count) || count < 0) return {error:'转入人口必须是明确的非负整数'};
      var oldClass = exact(g.classes,source), from = oldClass && Array.from(new Set(arr(oldClass.populationKeys)));
      if (!oldClass || !by || !from || !from.length) return {error:'人口重分类需要已有来源阶层及人口账'};
      var available = from.reduce(function(n,k){return n + Math.max(0,Number(by[k] && by[k].mouths)||0);},0);
      if (count > available) return {error:'来源阶层人口不足，未凭空增加总人口'};
      return {keys:[id],count:count,from:from,by:by};
    }
    return {keys:[id],pending:true,by:by};
  }
  function commitPopulation(plan, id, turn) {
    if (!plan.by) return;
    var by=plan.by, remaining=plan.count || 0, cell={mouths:0,households:0,ding:0,_emergedCell:true,_emergeTurn:turn};
    arr(plan.from).forEach(function(k){
      var old=by[k]; if(!old || remaining<=0)return;
      var take=Math.min(remaining,Math.max(0,Number(old.mouths)||0)),ratio=old.mouths>0?take/old.mouths:0;
      ['households','ding'].forEach(function(field){if(typeof old[field]==='number'){var moved=Math.floor(old[field]*ratio);old[field]-=moved;cell[field]+=moved;}});
      old.mouths-=take;cell.mouths+=take;remaining-=take;
    });
    by[id]=cell;
  }
  function adjudicateDescriptor(g, c) {
    if (!c.descriptor || !c.descriptor._needsAdjudication || typeof root.callAI !== 'function' || g !== root.GM) return;
    var player = root.P, generation = root._tmLoadGen, turn = g.turn;
    var identity = [g._campaignId,g._timelineId].join('|'), stamp = JSON.stringify(c.descriptor);
    function current() { return root.GM === g && root.P === player && root._tmLoadGen === generation && g.turn === turn &&
      [g._campaignId,g._timelineId].join('|') === identity && arr(g.classes).includes(c) && JSON.stringify(c.descriptor) === stamp; }
    var prompt = '【阶层定性·归一】新兴阶层「' + c.name + '」(治生:' + c.economicRole + '·特权:' + String(c.privileges || '无').slice(0,30) +
      ')现有描述符' + stamp + '。保留原词，归一通用词表。只输出 JSON：stratum(上/中/下)、fiscalStatus(优免/编户/受饷/法外)、unrestArchetype(暴烈/撤离/不合作/哗变/倒戈)。';
    // Keep the existing one-shot secondary adjudication, but never write into another world or a rolled-back class.
    Promise.resolve().then(function () { if (!current()) return null; return root.callAI(prompt,300,undefined,'secondary',{priority:'low',timeoutMs:40000,maxRetries:1}); })
      .then(function (reply) {
        if (reply == null || !current()) return;
        var verdict = JSON.parse(String(reply).replace(/```json|```/g,'').trim());
        if (TM.SocialFoundation && TM.SocialFoundation.applyAdjudicatedDescriptor && TM.SocialFoundation.applyAdjudicatedDescriptor(c,verdict)) {
          g._continuityRevision = (Number(g._continuityRevision)||0) + 1;
          if (typeof root.addEB === 'function') root.addEB('阶层','【定性】' + c.name + '·' + c.descriptor.stratum + '/' + c.descriptor.fiscalStatus);
        }
      }).catch(function () { /* Preserve reconciled raw descriptors; failed adjudication never invents a result. */ });
  }

  function createClass(g, raw, opts) {
    raw=raw||{};opts=opts||{};var name=text(raw.name||raw.className||raw.class);
    if(!g)return {ok:false,reason:'没有当前世界'};
    if(!valid(name))return fail(g,'class',name,'阶层名称无效');
    if(g.classes!=null&&!Array.isArray(g.classes))return fail(g,'class',name,'阶层名册格式无效，保留旧数据');
    var list=arr(g.classes),old=exact(list,name);
    if(old)return {ok:true,changed:false,duplicate:true,entity:old,path:'classes/'+(old.id||name)};
    var reason=text(raw.reason||raw.origin||opts.reason);
    if(!reason)return fail(g,'class',name,'须给出本局经济或社会演化依据');
    var reps=references(g,arr(raw.representativeNpcs||raw.members).concat(arr(raw.leaders)),'阶层代表',opts);
    if(reps.error)return fail(g,'class',name,reps.error);
    var id=idFor(g,'class',name,list,text(raw.id));
    if(!id)return fail(g,'class',name,'ID无效或已被占用');
    if(g.population&&g.population.byClass&&Object.prototype.hasOwnProperty.call(g.population.byClass,id))return fail(g,'class',name,'人口分类ID已存在，请明确 populationKeys');
    var plan=classPopulation(g,raw,id);if(plan.error)return fail(g,'class',name,plan.error);
    var c={id:id,sid:g.sid||'',name:name,size:raw.size==null?'尚待核计':String(raw.size),mobility:text(raw.mobility)||'中',
      economicRole:text(raw.economicRole)||'其他',status:text(raw.status)||'良民',privileges:text(raw.privileges),obligations:text(raw.obligations),
      satisfaction:value(raw.satisfaction,50,0,100),influence:value(raw.influence,15,0,100),demands:text(raw.demands),unrestThreshold:value(raw.unrestThreshold,30,0,100),
      representativeNpcs:reps.chars.map(function(x){return x.name;}),leaders:arr(raw.leaders).map(function(x){return exact(g.chars,x).name;}),
      supportingParties:[],regionalVariants:[],internalFaction:[],unrestLevels:{grievance:60,petition:70,strike:80,revolt:90},
      economicIndicators:{wealth:40,taxBurden:40,landHolding:20},description:reason,_origin:raw.origin||'',_emergeTurn:Number(g.turn)||0,
      populationKeys:plan.keys,_populationPending:!!plan.pending};
    if(raw.descriptor&&typeof raw.descriptor==='object')c.descriptor=JSON.parse(JSON.stringify(raw.descriptor));
    commitPopulation(plan,id,Number(g.turn)||0);g.classes=list;list.push(c);
    if(TM.SocialFoundation&&TM.SocialFoundation.reconcileClassDescriptor)try{TM.SocialFoundation.reconcileClassDescriptor(c,g);}catch(_){}
    var result = emit(g,'class',c,reason,opts);
    adjudicateDescriptor(g,c);
    return result;
  }
  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    var aliases = {party_create:['partyCreate','new_parties','party_creations'],class_emerge:['classEmerge','classCreate','class_create','new_classes']};
    Object.keys(aliases).forEach(function(key) {
      if (Array.isArray(payload[key])) return;
      var found=aliases[key].find(function(alias){return Array.isArray(payload[alias]);});
      if(found)payload[key]=payload[found];
    });
    return payload;
  }
  function apply(g,payload,opts) {
    payload=normalizePayload(payload||{});var result={parties:[],classes:[]};
    arr(payload.class_emerge).forEach(function(row){result.classes.push(createClass(g,row,opts));});
    arr(payload.party_create).forEach(function(row){result.parties.push(createParty(g,row,opts));});
    return result;
  }
  function context(g) {
    var lines=['【新群体形成】当本局人物结盟、共同利益或经济结构变化已有依据时，使用 party_create 或 class_emerge 登记新群体；不必局限于开局名册。没有形成则说明尚缺条件，勿虚报成立。',
      '人物与来源阶层必须引用在册对象。人口数需注明转出阶层与转入数量；仅有规模估计不等于增加人口。'];
    arr(g._entityFormationFailures).filter(function(x){return Number(g.turn)-x.turn<=2;}).slice(-5).forEach(function(x){lines.push('未落地：'+x.kind+' '+x.name+'；'+x.reason);});
    return lines.join('\n');
  }
  TM.SocialFormation={createParty:createParty,createClass:createClass,apply:apply,normalizePayload:normalizePayload,context:context};
})(typeof window!=='undefined'?window:globalThis);
