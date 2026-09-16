// Entity public treasuries, read-only pools and custody bindings. Declared scenarios only.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{}, RES=['money','grain','cloth'];
  function game(o){return o&&o.game||global.GM||{};}
  function clone(x){return x==null?x:JSON.parse(JSON.stringify(x));}
  function round(x){return Math.round((x+Number.EPSILON)*10000)/10000;}
  function turnDays(G){return number(G.turnDays)||number(G.fiscalConfig&&G.fiscalConfig.daysPerTurn)||number(G.scenario&&G.scenario.fiscalConfig&&G.scenario.fiscalConfig.daysPerTurn)||(typeof global._getDaysPerTurn==='function'?number(global._getDaysPerTurn()):null)||30;}
  function restore(target,snapshot){Object.keys(target).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(snapshot,k))delete target[k];});Object.keys(snapshot).forEach(function(k){var v=snapshot[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&target[k]&&typeof target[k]==='object'&&!Array.isArray(target[k]))restore(target[k],v);else target[k]=clone(v);});}
  function number(x){if(x==null||x===''||typeof x==='string'&&!x.trim())return null;var n=Number(x);return isFinite(n)?n:null;}
  function config(G){return G.publicTreasuryConfig||G.scenario&&G.scenario.publicTreasuryConfig||G.scriptData&&G.scriptData.publicTreasuryConfig||null;}
  function declared(G){var c=config(G);return !!(c&&c.schema==='tm-public-treasury/2');}
  function walk(nodes,visitor){(nodes||[]).forEach(function(n){if(!n)return;visitor(n);['children','subs','divisions','subRegions'].forEach(function(k){if(Array.isArray(n[k]))walk(n[k],visitor);});});}
  function nodes(G,kind){
    var out=[],seen={};function put(n){var k=String(n.id||'');if(k&&!seen[k]){seen[k]=true;out.push(n);}}
    if(kind==='region'){if(Array.isArray(G.adminHierarchy))walk(G.adminHierarchy,put);else Object.keys(G.adminHierarchy||{}).forEach(function(k){var b=G.adminHierarchy[k];walk(Array.isArray(b)?b:b&&b.divisions,put);});}
    else {walk(G.officeTree,put);(G.facs||G.factions||[]).forEach(function(f){walk(f&&f.officeTree,put);});}
    return out;
  }
  function definitions(G){var c=config(G);return c&&Array.isArray(c.accounts)?c.accounts:[];}
  function definition(G,ref){
    var hit=definitions(G).find(function(a){return a&&a.id===ref;});if(hit)return hit;
    if(ref==='guoku'||ref==='neitang')return {id:ref,name:ref==='guoku'?'国库':'内府',kind:'physical',scope:ref==='guoku'?'central':'palace',source:{kind:ref}};
    return null;
  }
  function faction(G,id){return (G.facs||G.factions||[]).find(function(f){return f&&(f.id===id||f.name===id);});}
  function playerId(G){var p=G.playerInfo||G.player||{},ruler=(G.chars||G.characters||[]).find(function(c){return c&&c.isPlayer;}),sc=G.scenario||G.scriptData||{},fallback=sc.playerInfo||(G===global.GM&&global.P&&global.P.playerInfo)||{};return p.factionId||p.factionName||p.faction||G.playerFactionId||ruler&&(ruler.factionId||ruler.faction)||fallback.factionId||fallback.factionName||'';}
  function sameFaction(G,a,b){if(a===b)return true;var f=faction(G,a);return !!f&&(f.id===b||f.name===b);}
  function getFactionAccountRef(o){var G=game(o),fid=o.factionId||playerId(G),internal=o.kind==='internal',found=definitions(G).find(function(a){var s=a.source||{};return a.kind!=='pool'&&sameFaction(G,a.factionId||s.id,fid)&&(internal?s.kind==='neitang'||s.kind==='innerTreasury':s.kind==='guoku'||s.kind==='faction');});return found?found.id:(!declared(G)&&sameFaction(G,fid,playerId(G))?(internal?'neitang':'guoku'):null);}
  function getRegionAccountRefs(o){var G=game(o),out={};definitions(G).forEach(function(a){var s=a&&a.source||{};if(a&&a.kind!=='pool'&&s.kind==='region'&&s.id&&(!o.factionId||sameFaction(G,a.factionId,o.factionId)))out[s.id]=a.id;});return out;}
  function locate(G,a,lookup){
    var s=a&&a.source||{},target=null,kind=s.kind,fid=a.factionId||s.id||playerId(G),key='';
    if(s.kind==='guoku'||s.kind==='neitang'||s.kind==='innerTreasury'||s.kind==='faction'){
      if(s.kind==='faction'&&a.factionId&&s.id&&!sameFaction(G,a.factionId,s.id))return null;
      var inner=s.kind==='neitang'||s.kind==='innerTreasury',f=faction(G,fid);kind=inner?'neitang':'guoku';
      target=sameFaction(G,fid,playerId(G))?G[inner?'neitang':'guoku']:f&&f[inner?'innerTreasury':'treasury'];
      key=(inner?'internal:':'central:')+String(f&&f.id||fid);
    }
    else if(s.kind==='region'||s.kind==='department')target=lookup&&lookup[s.kind]?lookup[s.kind][s.id]:nodes(G,s.kind).find(function(n){return n.id===s.id;});
    if(!target)return null;
    if(s.kind==='region'&&['children','divisions','subRegions'].some(function(k){return target[k]&&target[k].length;}))return null;
    if((s.kind==='region'||s.kind==='department')&&a.factionId&&target.factionId&&!sameFaction(G,a.factionId,target.factionId))return null;
    return {id:a.id,name:a.name||a.id,definition:a,kind:kind,target:target,key:key||s.kind+':'+(s.id||''),source:s};
  }
  function expand(G,ref,stack){
    var a=definition(G,ref);if(!a)return {entries:[],missing:['account:'+ref]};
    stack=stack||[];if(stack.indexOf(ref)>=0)return {entries:[],missing:['account-cycle:'+ref]};
    if(a.kind!=='pool'){var loc=locate(G,a);return {entries:loc?[loc]:[],missing:loc?[]:['source:'+ref]};}
    var out={entries:[],missing:[]},seen={};
    (a.members||[]).forEach(function(member){var next=expand(G,typeof member==='string'?member:member.ref,stack.concat(ref));Array.prototype.push.apply(out.missing,next.missing);next.entries.forEach(function(e){if(!seen[e.key]){seen[e.key]=true;out.entries.push(e);}});});
    if(!out.entries.length&&!out.missing.length)out.missing.push('empty-pool:'+ref);
    return out;
  }
  function account(loc){if(loc.kind==='faction')return loc.target.treasury;return loc.kind==='region'||loc.kind==='department'?loc.target.publicTreasury:loc.target;}
  function box(loc,k){var a=account(loc);return a&&(loc.kind==='region'||loc.kind==='department'?a[k]:a.ledgers&&a.ledgers[k]);}
  function resource(loc,k){
    var a=account(loc),b=box(loc,k),stock=number(b&&b.stock);
    if(stock==null&&a&&loc.kind!=='region'&&loc.kind!=='department')stock=number(a[k]);
    if(stock==null&&a&&k==='money'&&loc.kind!=='region'&&loc.kind!=='department')stock=number(a.balance);
    var available=loc.kind==='region'||loc.kind==='department'?number(b&&b.available):stock;if(available==null)available=stock;
    return {stock:stock,available:available==null?null:Math.min(stock==null?available:stock,available),quota:number(b&&b.quota),used:number(b&&b.used),deficit:number(b&&b.deficit),thisTurnIn:number(b&&b.thisTurnIn),thisTurnOut:number(b&&b.thisTurnOut),known:stock!=null};
  }
  function combined(entries){var out={};RES.forEach(function(k){var rows=entries.map(function(e){return resource(e,k);}),r={};['stock','available','quota','used','deficit','thisTurnIn','thisTurnOut'].forEach(function(f){r[f]=rows.length&&rows.every(function(x){return x[f]!=null;})?round(rows.reduce(function(n,x){return n+x[f];},0)):null;});r.known=rows.length>0&&rows.every(function(x){return x.known;});out[k]=r;});return out;}
  function getAccountView(o){
    var G=game(o),a=definition(G,o&&o.ref),e=expand(G,o&&o.ref);
    var resources=combined(e.entries);return {known:!!a&&!e.missing.length&&RES.every(function(k){return resources[k].known;}),exists:!!a&&!e.missing.length,id:o&&o.ref,name:a&&(a.name||a.id)||'',kind:a&&a.kind||'unknown',scope:a&&a.scope,factionId:a&&a.factionId,physicalAccountIds:e.entries.map(function(x){return x.id;}),resources:resources,period:e.entries.length&&account(e.entries[0])&&(account(e.entries[0]).accounting||account(e.entries[0]).period)||null,missing:e.missing,isReadOnly:true};
  }
  function listAccountViews(o){var G=game(o),defs=definitions(G).filter(function(a){return a&&(o.includePools||a.kind!=='pool')&&(!o.scope||a.scope===o.scope)&&(!o.factionId||a.factionId===o.factionId);});return {known:declared(G),accounts:defs.map(function(a){return getAccountView({game:G,ref:a.id});})};}
  function getConsolidatedView(o){var G=game(o),views=listAccountViews(o),entries=[],seen={},missing=[];views.accounts.forEach(function(v){var e=expand(G,v.id);Array.prototype.push.apply(missing,e.missing);e.entries.forEach(function(x){if(!seen[x.key]){seen[x.key]=true;entries.push(x);}});});var ids=entries.map(function(e){return e.id;}),resources=combined(entries),period=entries.length&&account(entries[0])&&account(entries[0]).accounting||null,flowTurn=period&&period.turn!=null?period.turn:G.turn;(G._publicTreasuryTransfers||[]).filter(function(t){return !t.opening&&t.turn===flowTurn;}).forEach(function(t){RES.forEach(function(k){var debit=(t.result.debits||[]).filter(function(x){return x.resource===k&&(x.physicalKey?seen[x.physicalKey]:ids.indexOf(x.accountId)>=0);}).reduce(function(n,x){return n+x.amount;},0),credit=(t.result.credits||[]).filter(function(x){return x.resource===k&&(x.physicalKey?seen[x.physicalKey]:ids.indexOf(x.accountId)>=0);}).reduce(function(n,x){return n+x.amount;},0),internal=Math.min(debit,credit);if(resources[k].thisTurnIn!=null)resources[k].thisTurnIn=Math.max(0,resources[k].thisTurnIn-internal);if(resources[k].thisTurnOut!=null)resources[k].thisTurnOut=Math.max(0,resources[k].thisTurnOut-internal);});});return {known:views.known&&!missing.length&&views.accounts.every(function(v){return v.known;}),accounts:views.accounts,physicalAccountIds:ids,resources:resources,period:period,missing:missing,isReadOnly:true};}
  function positionRows(G){var out=[],seen={};nodes(G,'department').forEach(function(n){(n.positions||[]).forEach(function(p){if(p&&p.id&&!seen[p.id]){seen[p.id]=true;out.push({position:p,department:n});}});});return out;}
  function holderIds(G,p){
    var ids=[];function add(id,name){if(!id&&name){var cs=(G.chars||G.characters||[]).filter(function(c){return c&&c.name===name;});if(cs.length===1)id=cs[0].id;}if(id&&ids.indexOf(String(id))<0)ids.push(String(id));}
    add(p.holderId,p.holder);(p.actualHolders||[]).forEach(function(h){if(h&&h.generated!==false)add(h.characterId,h.name);});return ids;
  }
  function bindingRefs(p){var b=p&&p.treasuryBinding||{};return b.role==='none'?[]:(b.accountRefs|| (b.accountRef?[b.accountRef]:[]));}
  function getCharacterPublicAccounts(o){
    var G=game(o),id=String(o.characterId||''),byRef={},all=[],seen={},missing=[];
    positionRows(G).forEach(function(row){var p=row.position,b=p.treasuryBinding;if(!b||holderIds(G,p).indexOf(id)<0)return;bindingRefs(p).forEach(function(ref){if(!byRef[ref]){byRef[ref]=getAccountView({game:G,ref:ref});byRef[ref].bindings=[];}byRef[ref].bindings.push({positionId:p.id,title:p.name,role:b.role||'oversight'});});});
    var character=(G.chars||G.characters||[]).find(function(c){return c&&String(c.id)===id;});if(character&&character.treasuryBinding)bindingRefs(character).forEach(function(ref){if(!byRef[ref]){byRef[ref]=getAccountView({game:G,ref:ref});byRef[ref].bindings=[];}byRef[ref].bindings.push({characterId:id,title:character.officialTitle||character.title||character.role||'',role:character.treasuryBinding.role||'oversight'});});
    var accounts=Object.keys(byRef).map(function(k){var e=expand(G,k);Array.prototype.push.apply(missing,e.missing);e.entries.forEach(function(loc){if(!seen[loc.key]){seen[loc.key]=true;all.push(loc);}});return byRef[k];});
    return {known:declared(G)&&!missing.length&&accounts.every(function(a){return a.known;}),accounts:accounts,resources:combined(all),physicalAccountIds:all.map(function(e){return e.id;}),missing:missing,isReadOnly:true};
  }
  function sync(loc){
    var a=account(loc);if(!a)return;
    RES.forEach(function(k){var b=box(loc,k);if(!b||number(b.stock)==null)return;
      if(loc.kind==='region'){var f=loc.target.fiscal;if(f&&f.ledgers&&f.ledgers[k]){var copy=f.ledgers[k];['stock','available','deficit','thisTurnIn','thisTurnOut','lastTurnIn','lastTurnOut','sources','sinks','sourceDetails','sinkDetails','deficitDetails'].forEach(function(field){if(Object.prototype.hasOwnProperty.call(b,field))copy[field]=clone(b[field]);});}}
      if(loc.kind!=='region'&&loc.kind!=='department'){a[k]=b.stock;if(k==='money')a.balance=b.stock;}
    });
  }
  function ensureKnownBox(loc,k){
    var known=resource(loc,k);if(!known.known)throw Error('balance-unknown:'+loc.id+':'+k);
    var a=account(loc);if(loc.kind==='region'||loc.kind==='department'){if(!a[k])a[k]={};}
    else {if(!a.ledgers)a.ledgers={};if(!a.ledgers[k])a.ledgers[k]={};}
    var b=box(loc,k);if(number(b.stock)==null)b.stock=known.stock;if(number(b.available)==null||loc.kind!=='region'&&loc.kind!=='department')b.available=known.available;
    if(!b.sources)b.sources={};if(!b.sinks)b.sinks={};return b;
  }
  function rollPeriod(loc,period){
    var a=account(loc);if(!a)return;if(a.accounting&&a.accounting.turnKey===period.turnKey){var posted=a.flowBasis==='actual'||RES.some(function(k){var b=box(loc,k);return b&&(number(b.thisTurnIn)||number(b.thisTurnOut));});if(!posted)a.accounting=Object.assign({},a.accounting,clone(period));return;}
    if(a.accounting&&a.accounting.turnKey!=null)RES.forEach(function(k){var b=box(loc,k);if(!b)return;b.lastTurnIn=number(b.thisTurnIn)||0;b.lastTurnOut=number(b.thisTurnOut)||0;b.thisTurnIn=0;b.thisTurnOut=0;b.sources={};b.sinks={};b.sourceDetails={};b.sinkDetails={};});
    a.accounting=clone(period);
  }
  function distribute(amount,entries,k,credit){
    var weights=entries.map(function(e){var r=resource(e,k);return credit?Math.max(0,r.stock||0):Math.max(0,r.available||0);}),total=weights.reduce(function(n,x){return n+x;},0),left=amount;
    var rows=entries.map(function(e,i){var n=i===entries.length-1?left:Math.min(left,round(amount*(total>0?weights[i]/total:1/entries.length)));if(!credit)n=Math.min(n,Math.max(0,resource(e,k).available||0));left=round(left-n);return {entry:e,amount:n};});
    if(left>0&&!credit)rows.forEach(function(r){var extra=Math.min(left,Math.max(0,resource(r.entry,k).available-r.amount));r.amount=round(r.amount+extra);left=round(left-extra);});return rows;
  }
  function transact(o){
    o=o||{};var G=game(o),from=o.from||o.ref,to=o.to||null,amounts={},bad=null;
    if(!o.amounts||typeof o.amounts!=='object')return {ok:false,reason:'amounts-required'};
    Object.keys(o.amounts).forEach(function(k){if(RES.indexOf(k)<0)bad='resource-unknown:'+k;});
    RES.forEach(function(k){var v=o.amounts[k]===undefined?0:number(o.amounts[k]);if(v==null||v<0)bad='amount-invalid:'+k;amounts[k]=v==null?0:round(v);});
    if(bad)return {ok:false,reason:bad};
    var src=expand(G,from),dst=to?expand(G,to):{entries:[],missing:[]};
    if(src.missing.length||dst.missing.length)return {ok:false,reason:'account-missing',missing:src.missing.concat(dst.missing)};
    var overlap=dst.entries.some(function(d){return src.entries.some(function(s){return d.key===s.key;});});
    if(overlap)return {ok:false,reason:'source-destination-overlap'};
    var signature=JSON.stringify({from:src.entries.map(function(e){return e.key;}).sort(),to:dst.entries.map(function(e){return e.key;}).sort(),amounts:amounts});
    var prior=o.opening&&G._publicTreasuryOpeningTransfers&&G._publicTreasuryOpeningTransfers[o.transactionId]||(G._publicTreasuryTransfers||[]).find(function(x){return o.transactionId&&x.id===o.transactionId;});
    if(prior&&o.opening&&prior.signature===signature&&!(G._publicTreasuryOpeningTransfers&&G._publicTreasuryOpeningTransfers[o.transactionId])){
      if(!G._publicTreasuryOpeningTransfers)G._publicTreasuryOpeningTransfers={}; // arch-ok fiscal initialization migrates completed opening receipts to its durable ledger
      G._publicTreasuryOpeningTransfers[o.transactionId]=clone(prior);
    }
    if(prior)return prior.signature===signature?Object.assign({duplicate:true},clone(prior.result)):{ok:false,reason:'transaction-id-conflict'};
    var paid={},shortfall={},debits=[],credits=[];
    RES.forEach(function(k){
      if(!amounts[k]){paid[k]=0;shortfall[k]=0;return;}
      if(src.entries.concat(dst.entries).some(function(e){return !resource(e,k).known;})){bad='balance-unknown:'+k;return;}
      var have=src.entries.reduce(function(n,e){return n+Math.max(0,resource(e,k).available||0);},0);
      if(have<amounts[k]&&!o.allowPartial){bad='insufficient-resources:'+k;return;}
      paid[k]=round(Math.min(have,amounts[k]));shortfall[k]=round(amounts[k]-paid[k]);
      distribute(paid[k],src.entries,k,false).forEach(function(r){if(r.amount)debits.push({entry:r.entry,resource:k,amount:r.amount});});
      if(to)distribute(paid[k],dst.entries,k,true).forEach(function(r){if(r.amount)credits.push({entry:r.entry,resource:k,amount:r.amount});});
    });
    if(bad)return {ok:false,reason:bad,shortfall:shortfall};
    if(!debits.length)return {ok:true,noOp:true,paid:paid,shortfall:shortfall};
    var affected=[],seen={};debits.concat(credits).forEach(function(r){if(!seen[r.entry.key]){seen[r.entry.key]=true;var a=account(r.entry);affected.push({entry:r.entry,account:a,before:clone(a),fiscal:r.entry.target.fiscal&&clone(r.entry.target.fiscal)});}});
    var id=o.transactionId||'public-'+(G.turn||0)+'-'+((G._publicTreasuryTransfers||[]).length+1),reason=String(o.reason||'公库收支');
    var centralOut=src.entries.every(function(e){return e.definition.scope==='central';}),palaceOut=src.entries.every(function(e){return e.definition.scope==='palace';});
    var palaceIn=to&&dst.entries.every(function(e){return e.definition.scope==='palace';}),centralIn=to&&dst.entries.every(function(e){return e.definition.scope==='central';});
    var sinkTag=o.sinkTag||(centralOut&&palaceIn?'内廷转运':palaceOut&&centralIn?'接济帑廪':reason),sourceTag=o.sourceTag||(centralOut&&palaceIn?'guokuTransfer':reason);
    try{
      if(!o.opening)affected.forEach(function(x){rollPeriod(x.entry,{turn:G.turn||0,turnKey:String(G.sid||'')+':'+String(G.turn||0),days:turnDays(G),daysPerMonth:30,daysPerYear:360});});
      debits.forEach(function(r){var b=ensureKnownBox(r.entry,r.resource);b.stock=round(b.stock-r.amount);b.available=round(b.available-r.amount);if(!o.opening){b.thisTurnOut=round((number(b.thisTurnOut)||0)+r.amount);var sink=sinkTag;b.sinks[sink]=round((number(b.sinks[sink])||0)+r.amount);if(global.FiscalStatement)global.FiscalStatement.recordFlow(b,r.entry.definition.scope==='palace'?'internal':'central','out',sink,id,reason,r.amount);}sync(r.entry);});
      if(o._faultInjector)o._faultInjector('after-debit');
      credits.forEach(function(r){var b=ensureKnownBox(r.entry,r.resource);b.stock=round(b.stock+r.amount);b.available=round(b.available+r.amount);if(!o.opening){b.thisTurnIn=round((number(b.thisTurnIn)||0)+r.amount);var source=sourceTag;b.sources[source]=round((number(b.sources[source])||0)+r.amount);if(global.FiscalStatement)global.FiscalStatement.recordFlow(b,r.entry.definition.scope==='palace'?'internal':'central','in',source,id,reason,r.amount);}sync(r.entry);});
      var result={ok:true,transactionId:id,paid:paid,shortfall:shortfall,debits:debits.map(function(r){return {accountId:r.entry.id,physicalKey:r.entry.key,resource:r.resource,amount:r.amount};}),credits:credits.map(function(r){return {accountId:r.entry.id,physicalKey:r.entry.key,resource:r.resource,amount:r.amount};})};
      if(!G._publicTreasuryTransfers)G._publicTreasuryTransfers=[]; // arch-ok public treasury transaction entry owns its receipt history
      var receipt={id:id,turn:G.turn||0,opening:!!o.opening,reason:reason,signature:signature,result:clone(result)};
      G._publicTreasuryTransfers.push(receipt);
      if(o.opening){
        if(!G._publicTreasuryOpeningTransfers)G._publicTreasuryOpeningTransfers={}; // arch-ok opening allocations have durable idempotence independent of daily history retention
        G._publicTreasuryOpeningTransfers[id]=clone(receipt);
      }
      if(G._publicTreasuryTransfers.length>500)G._publicTreasuryTransfers.splice(0,G._publicTreasuryTransfers.length-500);
      return result;
    }catch(e){affected.forEach(function(x){restore(x.account,x.before);if(x.fiscal)restore(x.entry.target.fiscal,x.fiscal);});return {ok:false,reason:'transaction-rolled-back',error:e.message};}
  }
  function initialize(o){
    var G=game(o),sc=o&&o.scenario;if(sc&&sc.publicTreasuryConfig&&!G.publicTreasuryConfig)G.publicTreasuryConfig=clone(sc.publicTreasuryConfig); // arch-ok explicit scenario public treasury initialization
    if(!declared(G))return {ok:true,legacy:true};
    var report={ok:true,initialized:0,transfers:[],missing:[]};
    definitions(G).filter(function(a){return a&&a.kind!=='pool';}).forEach(function(a){
      var loc=locate(G,a);if(!loc){report.missing.push('source:'+a.id);return;}
      if((loc.kind==='department'||loc.kind==='region')&&!loc.target.publicTreasury){
        var initial=loc.target.publicTreasuryInit;
        if(!initial&&a.openingTransfer)initial={money:0,grain:0,cloth:0};
        if(initial){loc.target.publicTreasury={handoverLog:[]};RES.forEach(function(k){var v=number(initial[k]);loc.target.publicTreasury[k]={stock:v,available:v,quota:number(initial['quota'+k.charAt(0).toUpperCase()+k.slice(1)]),used:0,deficit:0,thisTurnIn:0,thisTurnOut:0,sources:{},sinks:{}};});report.initialized++;}
      }
    });
    definitions(G).forEach(function(a){if(!a||!a.openingTransfer)return;var t=a.openingTransfer,result=transact({game:G,from:t.from,to:a.id,amounts:t.amounts,reason:t.reason||('拨给'+a.name+'周转'),transactionId:'opening:'+String(G.sid||'')+':'+a.id,opening:true});report.transfers.push(result);if(!result.ok){report.ok=false;report.missing.push(result.reason+':'+a.id);}});
    positionRows(G).forEach(function(row){var b=row.position.treasuryBinding;if(!b)return;bindingRefs(row.position).forEach(function(ref){var e=expand(G,ref);Array.prototype.push.apply(report.missing,e.missing);});});
    report.ok=report.ok&&!report.missing.length;return report;
  }
  function officeAssignmentChanged(o){
    var G=game(o);if(!declared(G))return {ok:true,legacy:true};var row=positionRows(G).find(function(r){return r.position.id===o.positionId;});if(!row)return {ok:false,reason:'position-missing'};
    var refs=bindingRefs(row.position),entries=[],seen={};refs.forEach(function(ref){expand(G,ref).entries.forEach(function(e){if(!seen[e.key]){seen[e.key]=true;entries.push(e);}});});
    entries.forEach(function(e){var a=account(e);if(!a)return;if(!a.handoverLog)a.handoverLog=[];a.handoverLog.push({turn:G.turn||0,positionId:o.positionId,fromCharacterId:o.fromCharacterId||null,toCharacterId:o.toCharacterId||null,reason:o.reason||'任官交接',balance:combined([e])});if(a.handoverLog.length>40)a.handoverLog.shift();});
    return {ok:true,accounts:entries.map(function(e){return e.id;})};
  }
  function beginPeriod(o){
    var G=game(o),period=o.period||{},fid=o.factionId||playerId(G),refs=declared(G)?definitions(G).filter(function(a){return a.kind!=='pool'&&sameFaction(G,a.factionId,fid);}).map(function(a){return a.id;}):[getFactionAccountRef({game:G,factionId:fid,kind:'central'}),getFactionAccountRef({game:G,factionId:fid,kind:'internal'})],seen={};
    refs.filter(Boolean).forEach(function(ref){expand(G,ref).entries.forEach(function(loc){if(seen[loc.key])return;seen[loc.key]=true;rollPeriod(loc,period);sync(loc);});});return {ok:true};
  }
  function payrollItems(o){
    var G=game(o),rows=[],best={};walk(o.tree,function(d){(d.positions||[]).forEach(function(p){
      var ids=holderIds(G,p),count=number(p.salaryHeadcount),pay=clone(p.monthlyPay||{});
      if(o.characterId!=null&&ids.indexOf(String(o.characterId))<0)return;
      if(count==null)count=p.occupancyStatus==='unrecorded'?number(p.establishedCount!=null?p.establishedCount:p.headCount)||1:ids.length;
      count=p.occupancyStatus==='vacant'&&!ids.length?0:Math.max(0,count);if(!p.monthlyPay)pay[p.salaryKind||'money']=number(p.salary!=null?p.salary:p.perPersonSalary)||0;
      var base={name:p.name||d.name||'官俸',monthly:pay,funding:p.fiscalFunding||'central',regionId:p.regionId||'',category:'salary',positionId:p.id,position:p};
      ids.slice(0,Math.floor(count)).forEach(function(id){if(o.characterId!=null&&id!==String(o.characterId))return;var row=Object.assign({},base,{count:1,characterId:id}),score=[number(p.salaryPriority)||0,number(pay.money)||0,number(pay.grain)||0,number(pay.cloth)||0];row._score=score;rows.push(row);if(p.salaryStacking==='additional')return;var prior=best[id],higher=!prior;for(var i=0;prior&&i<score.length;i++){if(score[i]!==prior._score[i]){higher=score[i]>prior._score[i];break;}}if(higher)best[id]=row;});
      if(o.characterId==null&&count>ids.length)rows.push(Object.assign({},base,{count:count-ids.length,characterId:null}));
    });});
    return rows.filter(function(r){return !r.characterId||r.position.salaryStacking==='additional'||best[r.characterId]===r;}).map(function(r){delete r.position;delete r._score;return r;});
  }
  function recordSalaryPayments(o){
    var G=game(o),receipts=[];if(!G._salaryPaymentReceipts)G._salaryPaymentReceipts=[]; // arch-ok paid salary receipt ledger owned by the fiscal settlement
    (o.payments||[]).forEach(function(p){if(!p.characterId||!RES.some(function(k){return p.amount[k]>0;}))return;var id='salary:'+String(G.sid||'')+':'+String(o.turn==null?G.turn:o.turn)+':'+o.factionId+':'+p.positionId+':'+p.characterId+':'+(p.fundId||'');var prior=G._salaryPaymentReceipts.find(function(x){return x.id===id;});if(prior){receipts.push(prior);return;}var r={id:id,turn:o.turn==null?G.turn:o.turn,period:clone(o.period),payerId:o.factionId,fundId:p.fundId,positionId:p.positionId,characterId:p.characterId,amount:clone(p.amount),due:clone(p.due),paid:true};G._salaryPaymentReceipts.push(r);receipts.push(r);});
    if(G._salaryPaymentReceipts.length>6000)G._salaryPaymentReceipts.splice(0,G._salaryPaymentReceipts.length-6000);
    receipts.forEach(function(r){var ch=(G.chars||G.characters||[]).find(function(x){return x&&String(x.id)===String(r.characterId);});if(ch&&global.CharEconEngine&&typeof global.CharEconEngine.receiveSalaryPayment==='function'){try{global.CharEconEngine.receiveSalaryPayment(ch,r);}catch(e){/* The paid receipt remains available for idempotent delivery. */}}});return {ok:true,receipts:clone(receipts)};
  }
  function getCharacterPayroll(o){
    var G=game(o),id=String(o.characterId||''),due={money:0,grain:0,cloth:0},paid={money:0,grain:0,cloth:0},plan=global.FixedExpense&&global.FixedExpense.characterPayrollItems?global.FixedExpense.characterPayrollItems({game:G,characterId:id,days:o.days||turnDays(G)}):{known:false,items:[]};
    var receipts=getCharacterSalaryReceipts({game:G,characterId:id,turn:o.turn==null?G.turn:o.turn}).receipts;
    (plan.items||[]).forEach(function(x){RES.forEach(function(k){due[k]=round(due[k]+x.amounts[k]);});});
    receipts.forEach(function(r){RES.forEach(function(k){paid[k]=round(paid[k]+r.amount[k]);});});return {known:plan.known,due:due,paid:paid,items:plan.items,receipts:receipts};
  }
  function getCharacterSalaryReceipts(o){var G=game(o),id=String(o.characterId||'');return {known:declared(G)||Array.isArray(G._salaryPaymentReceipts),receipts:clone((G._salaryPaymentReceipts||[]).filter(function(r){return r&&r.paid===true&&String(r.characterId)===id&&(o.turn==null||r.turn===o.turn);})),isReadOnly:true};}
  // Liabilities use the existing deficit and deficitDetails books. Registration receipts
  // retain the original obligation and its payer identities, never a second running balance.
  function liabilityEntries(G){
    var defs=definitions(G).filter(function(a){return a&&a.kind!=='pool';}),lookup={region:Object.create(null),department:Object.create(null)},seen={},out=[];
    if(!declared(G))defs=['guoku','neitang'].map(function(id){return definition(G,id);});
    ['region','department'].forEach(function(k){if(defs.some(function(a){return a.source&&a.source.kind===k;}))nodes(G,k).forEach(function(n){lookup[k][n.id]=n;});});
    defs.forEach(function(a){var loc=locate(G,a,lookup);if(loc&&!seen[loc.key]){seen[loc.key]=true;out.push(loc);}});return out;
  }
  function getLiabilities(o){
    o=o||{};var G=game(o),registry=G._publicLiabilityRegistrations||{},groups={},missing=[],entries=liabilityEntries(G);
    entries.forEach(function(loc){RES.forEach(function(k){var b=box(loc,k),details=b&&b.deficitDetails||{};
      Object.keys(details).forEach(function(category){(Array.isArray(details[category])?details[category]:[]).forEach(function(row){
        if(!row||!row.id||number(row.amount)==null||row.amount<0)return;
        var reg=Object.prototype.hasOwnProperty.call(registry,row.id)?registry[row.id]:null,subject=row.subject||reg&&reg.subject||null;
        if(o.id&&String(row.id)!==String(o.id))return;
        if(o.subject&&!(subject&&subject.kind===o.subject.kind&&String(subject.id)===String(o.subject.id))&&!(o.subject.kind==='army'&&category==='junxiang'&&String(row.armyId||row.id)===String(o.subject.id)))return;
        var key=category+':'+row.id,item=groups[key];if(!item)item=groups[key]={id:row.id,name:row.name||reg&&reg.name||row.id,category:category,subject:subject||(o.subject?clone(o.subject):null),manualSettlement:!!(row.manualSettlement||reg&&reg.manualSettlement),amounts:{money:0,grain:0,cloth:0},originalAmounts:reg?clone(reg.originalAmounts):null,allocations:[],metadata:reg?clone(reg.metadata||{}):{}};
        var allocation=item.allocations.find(function(a){return a.physicalKey===loc.key;});if(!allocation){allocation={ref:loc.id,physicalKey:loc.key,amounts:{money:0,grain:0,cloth:0}};item.allocations.push(allocation);}allocation.amounts[k]=round(allocation.amounts[k]+row.amount);item.amounts[k]=round(item.amounts[k]+row.amount);
      });});
    });});
    Object.keys(registry).forEach(function(id){var reg=registry[id];if(o.id&&String(o.id)!==id)return;if(o.subject&&(!reg.subject||reg.subject.kind!==o.subject.kind||String(reg.subject.id)!==String(o.subject.id)))return;
      var item=groups[reg.category+':'+id];if(!item)missing.push('liability-rows:'+id);
      (reg.allocations||[]).forEach(function(a){var loc=entries.find(function(e){return e.key===a.physicalKey;});if(!loc){missing.push('liability-account:'+a.ref);return;}RES.forEach(function(k){if(!(a.amounts[k]>0))return;var b=box(loc,k),rows=b&&b.deficitDetails&&b.deficitDetails[reg.category]||[];if(!rows.some(function(r){return r.id===id;}))missing.push('liability-row:'+id+':'+a.ref+':'+k);});});
    });
    return {known:missing.length===0,items:Object.keys(groups).map(function(k){return groups[k];}),missing:missing,isReadOnly:true};
  }
  function liabilityCategory(category){var labels={junxiang:'军饷',fenglu:'俸禄',gongting:'宫廷',gongcheng:'工程',qita:'其他'};return labels[category]||'其他';}
  function recordLiability(o){
    o=o||{};var G=game(o),id=String(o.id||''),category=o.category||'qita',plans=[],seen={},original={money:0,grain:0,cloth:0},invalid=null;
    if(!id||id==='__proto__'||id==='constructor'||id==='prototype'||!Array.isArray(o.allocations)||!o.allocations.length)return {ok:false,reason:'liability-definition-invalid'};
    o.allocations.forEach(function(a){var e=expand(G,a.ref);if(e.missing.length||e.entries.length!==1){invalid='liability-physical-account-required:'+a.ref;return;}var loc=e.entries[0];if(seen[loc.key]){invalid='liability-duplicate-account:'+a.ref;return;}seen[loc.key]=true;var amounts={};RES.forEach(function(k){var v=number(a.amounts&&a.amounts[k]!=null?a.amounts[k]:0);if(v==null||v<0)invalid='liability-amount-invalid:'+k;amounts[k]=round(v||0);original[k]=round(original[k]+amounts[k]);if(amounts[k]>0&&!resource(loc,k).known)invalid='liability-balance-unknown:'+loc.id+':'+k;});plans.push({loc:loc,amounts:amounts});});
    if(invalid)return {ok:false,reason:invalid};if(!RES.some(function(k){return original[k]>0;}))return {ok:true,skipped:true,reason:'no-liability'};
    var registration={id:id,name:String(o.name||'应付旧欠'),category:category,subject:clone(o.subject||null),manualSettlement:o.manualSettlement===true,originalAmounts:original,allocations:plans.map(function(p){return {ref:p.loc.id,physicalKey:p.loc.key,amounts:p.amounts};}),metadata:clone(o.metadata||{})};
    var signature=JSON.stringify(registration),registry=G._publicLiabilityRegistrations||{},prior=Object.prototype.hasOwnProperty.call(registry,id)?registry[id]:null;
    if(prior)return prior.signature===signature?{ok:true,duplicate:true,id:id,liability:getLiabilities({game:G,id:id})}:{ok:false,reason:'liability-id-conflict'};
    var saved=plans.map(function(p){return {loc:p.loc,account:clone(account(p.loc)),fiscal:p.loc.target.fiscal&&clone(p.loc.target.fiscal)};});
    try{
      plans.forEach(function(p){RES.forEach(function(k){var amount=p.amounts[k];if(!amount)return;var b=ensureKnownBox(p.loc,k);if(!b.deficitDetails)b.deficitDetails={};if(!Array.isArray(b.deficitDetails[category]))b.deficitDetails[category]=[];
        if(b.deficitDetails[category].some(function(r){return r.id===id;}))throw Error('liability-row-already-exists:'+id);
        b.deficit=round((number(b.deficit)||0)+amount);b.deficitDetails[category].push({id:id,name:registration.name,amount:amount,subject:clone(registration.subject),manualSettlement:registration.manualSettlement,incurredTurn:G.turn||0});
      });sync(p.loc);});
      if(o._faultInjector)o._faultInjector('after-liability-registration');
      if(!G._publicLiabilityRegistrations)G._publicLiabilityRegistrations={}; // arch-ok the public liability owner persists registration receipts without adding stock
      registration.signature=signature;Object.defineProperty(G._publicLiabilityRegistrations,id,{value:registration,enumerable:true,writable:true,configurable:true});
      return {ok:true,id:id,amounts:original,liability:getLiabilities({game:G,id:id})};
    }catch(e){saved.forEach(function(s){restore(account(s.loc),s.account);if(s.fiscal)restore(s.loc.target.fiscal,s.fiscal);});return {ok:false,reason:'liability-registration-rolled-back',error:e.message};}
  }
  function repayLiability(o){
    o=o||{};var G=game(o),id=String(o.id||''),paymentId=String(o.transactionId||''),signature=JSON.stringify({id:id,amounts:o.amounts||null,allowPartial:o.allowPartial!==false}),receipts=G._publicLiabilityPayments||{},prior=paymentId&&Object.prototype.hasOwnProperty.call(receipts,paymentId)?receipts[paymentId]:null;
    if(prior)return prior.signature===signature?Object.assign({duplicate:true},clone(prior.result)):{ok:false,reason:'liability-payment-id-conflict'};
    var view=getLiabilities({game:G,id:id});if(!view.known||view.items.length!==1)return {ok:false,reason:'liability-unresolved',missing:view.missing};var claim=view.items[0],request={},paid={money:0,grain:0,cloth:0},plans=[],invalid=null;
    RES.forEach(function(k){var v=o.amounts&&o.amounts[k]!=null?number(o.amounts[k]):(o.amounts?0:claim.amounts[k]);if(v==null||v<0)invalid='liability-payment-invalid:'+k;request[k]=round(Math.min(Math.max(0,v||0),claim.amounts[k]));});
    if(invalid)return {ok:false,reason:invalid};if(!paymentId||paymentId==='__proto__'||paymentId==='constructor'||paymentId==='prototype')return {ok:false,reason:'liability-payment-id-required'};
    claim.allocations.forEach(function(a){var e=expand(G,a.ref);if(e.missing.length||e.entries.length!==1){invalid='liability-payment-account-missing:'+a.ref;return;}plans.push({loc:e.entries[0],remaining:a.amounts,amounts:{money:0,grain:0,cloth:0}});});
    RES.forEach(function(k){var left=request[k],eligible=plans.filter(function(p){return p.remaining[k]>0;});eligible.forEach(function(p,i){var portion=i===eligible.length-1?left:Math.min(left,round(request[k]*p.remaining[k]/Math.max(.0001,claim.amounts[k])));p.amounts[k]=portion;left=round(left-portion);var b=box(p.loc,k),r=resource(p.loc,k);if(portion>0&&(!r.known||number(b&&b.deficit)==null||b.deficit+.0001<p.remaining[k]))invalid='liability-book-inconsistent:'+p.loc.id+':'+k;if(o.allowPartial===false&&portion>(r.available||0))invalid='liability-funds-insufficient:'+p.loc.id+':'+k;});});
    if(invalid)return {ok:false,reason:invalid};var saved=plans.map(function(p){return {loc:p.loc,account:clone(account(p.loc)),fiscal:p.loc.target.fiscal&&clone(p.loc.target.fiscal)};}),hadTransfers=Object.prototype.hasOwnProperty.call(G,'_publicTreasuryTransfers'),oldTransfers=clone(G._publicTreasuryTransfers),hadPayments=Object.prototype.hasOwnProperty.call(G,'_publicLiabilityPayments'),oldPayments=clone(G._publicLiabilityPayments);
    try{
      plans.forEach(function(p,i){if(!RES.some(function(k){return p.amounts[k]>0;}))return;var result=transact({game:G,from:p.loc.id,amounts:p.amounts,allowPartial:o.allowPartial!==false,transactionId:'liability:'+paymentId+':'+i,reason:o.reason||claim.name,sinkTag:liabilityCategory(claim.category)});if(!result.ok)throw Error(result.reason);
        RES.forEach(function(k){var amount=number(result.paid[k])||0;if(!amount)return;var b=box(p.loc,k),row=(b.deficitDetails[claim.category]||[]).find(function(r){return r.id===id;});if(!row||row.amount+.0001<amount)throw Error('liability-over-repayment');row.amount=round(Math.max(0,row.amount-amount));b.deficit=round(Math.max(0,b.deficit-amount));paid[k]=round(paid[k]+amount);});sync(p.loc);
      });
      if(o._faultInjector)o._faultInjector('after-liability-payment');
      var remaining=getLiabilities({game:G,id:id}),result={ok:true,id:id,transactionId:paymentId,paid:paid,requested:request,shortfall:{money:round(request.money-paid.money),grain:round(request.grain-paid.grain),cloth:round(request.cloth-paid.cloth)},remaining:remaining.items[0].amounts};
      if(!G._publicLiabilityPayments)G._publicLiabilityPayments={}; // arch-ok the public liability transaction owns its persistent payment receipts
      Object.defineProperty(G._publicLiabilityPayments,paymentId,{value:{signature:signature,result:clone(result)},enumerable:true,writable:true,configurable:true});return result;
    }catch(e){saved.forEach(function(s){restore(account(s.loc),s.account);if(s.fiscal)restore(s.loc.target.fiscal,s.fiscal);});if(hadTransfers)G._publicTreasuryTransfers=oldTransfers;else delete G._publicTreasuryTransfers;if(hadPayments)G._publicLiabilityPayments=oldPayments;else delete G._publicLiabilityPayments;return {ok:false,reason:'liability-payment-rolled-back',error:e.message};}
  }

  function receivePrivateRecovery(o){
    var G=game(o),ch=(G.chars||G.characters||[]).find(function(c){return c&&String(c.id)===String(o.characterId);}),pw=ch&&ch.resources&&ch.resources.privateWealth,amount={},total={},bad=null,hidden=number(o.hiddenMoney==null?0:o.hiddenMoney);
    if(!o.id||!pw||!o.amount)return {ok:false,reason:'recovery-source-missing'};
    RES.forEach(function(k){amount[k]=number(o.amount[k]==null?0:o.amount[k]);if(amount[k]==null||amount[k]<0)bad='recovery-amount-invalid';total[k]=amount[k];});
    if(hidden==null||hidden<0)bad='recovery-hidden-invalid';if(bad)return {ok:false,reason:bad};total.money=round(total.money+hidden);
    var signature=JSON.stringify({characterId:o.characterId,destination:o.destination,amount:amount,hiddenMoney:hidden}),prior=(G._privateRecoveryReceipts||[]).find(function(r){return r.id===o.id;});
    if(prior)return prior.signature===signature?Object.assign({duplicate:true},clone(prior.result)):{ok:false,reason:'transaction-id-conflict'};
    RES.forEach(function(k){if(amount[k]>0&&(number(pw[k])==null||pw[k]<amount[k]))bad='private-resources-insufficient:'+k;});
    if(hidden>0&&(number(ch.resources.hiddenWealth)==null||ch.resources.hiddenWealth<hidden))bad='private-hidden-insufficient';
    var dst=expand(G,o.destination);if(dst.missing.length)bad='recovery-destination-missing';RES.forEach(function(k){if(total[k]>0&&dst.entries.some(function(e){return !resource(e,k).known;}))bad='recovery-balance-unknown:'+k;});if(bad)return {ok:false,reason:bad};
    var saved=clone(ch.resources),affected=dst.entries.map(function(e){return {entry:e,before:clone(account(e)),fiscal:e.target.fiscal&&clone(e.target.fiscal)};}),reason=o.reason||'追缴实得';
    try{
      RES.forEach(function(k){if(amount[k])pw[k]=round(pw[k]-amount[k]);});if(hidden)ch.resources.hiddenWealth=round(ch.resources.hiddenWealth-hidden);
      if(o._faultInjector)o._faultInjector('after-private-debit');
      affected.forEach(function(x){rollPeriod(x.entry,{turn:G.turn||0,turnKey:String(G.sid||'')+':'+String(G.turn||0),days:turnDays(G),daysPerMonth:30,daysPerYear:360});});
      RES.forEach(function(k){if(!total[k])return;distribute(total[k],dst.entries,k,true).forEach(function(r){if(!r.amount)return;var b=ensureKnownBox(r.entry,k);b.stock=round(b.stock+r.amount);b.available=round(b.available+r.amount);b.thisTurnIn=round((number(b.thisTurnIn)||0)+r.amount);b.sources[reason]=round((number(b.sources[reason])||0)+r.amount);sync(r.entry);});});
      var result={ok:true,id:o.id,amount:total};if(!G._privateRecoveryReceipts)G._privateRecoveryReceipts=[]; // arch-ok atomic fiscal recovery owns its conserved private-to-public receipts
      G._privateRecoveryReceipts.push({id:o.id,signature:signature,result:clone(result)});return result;
    }catch(e){restore(ch.resources,saved);affected.forEach(function(x){restore(account(x.entry),x.before);if(x.fiscal)restore(x.entry.target.fiscal,x.fiscal);});return {ok:false,reason:'recovery-rolled-back',error:e.message};}
  }
  TM.PublicTreasury={isDeclared:declared,initialize:initialize,getAccountView:getAccountView,getFactionAccountRef:getFactionAccountRef,getRegionAccountRefs:getRegionAccountRefs,listAccountViews:listAccountViews,getConsolidatedView:getConsolidatedView,getCharacterPublicAccounts:getCharacterPublicAccounts,transfer:transact,spend:transact,officeAssignmentChanged:officeAssignmentChanged,beginPeriod:beginPeriod,payrollItems:payrollItems,recordSalaryPayments:recordSalaryPayments,getCharacterPayroll:getCharacterPayroll,getCharacterSalaryReceipts:getCharacterSalaryReceipts,receivePrivateRecovery:receivePrivateRecovery,recordLiability:recordLiability,repayLiability:repayLiability,getLiabilities:getLiabilities};
})(typeof window!=='undefined'?window:globalThis);
