/* Military command receipts. Scenario data names the actual custodians; a decree,
 * a nominal appointment and the delivery of an army are different facts.
 * Owns GM.commandOrders and its linked issues only. Physical changes still use
 * AIChange.Army / MarchSystem. No random refusal, free payment or automatic coup.
 */
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var FIELDS = ['commander','commanderName','commanderDisplayName','commander_name','newCommander','general','generalName','newGeneral','leader','leaderName','commandingOfficer','chiefCommander','chiefGeneral','mainGeneral','统帅','主帅','主将','将领','将帅','destination','location','garrison','faction','owner','factionName','commandHandoverTo'];
  var LABELS = { pending:'候军中回报', delayed:'请缓行', refused:'未奉行', executed:'已奉行', superseded:'须重议' };
  function game() { return global.GM || {}; }
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function live(c) { return c && c.alive !== false && !c.dead && !c.imprisoned && !c.captured && !c._imprisoned && !c._captured; }
  function person(key) { return (game().chars || []).find(function(c) { return c && (c.id === key || c.name === key); }); }
  function facOf(a) { return a && (a.faction || a.factionId); }
  function sameFaction(ch, a) {
    var f = (game().facs || []).find(function(f) { return f && [f.id,f.name].indexOf(facOf(a)) >= 0; });
    return ch && [facOf(a), f && f.id, f && f.name].indexOf(ch.factionId || ch.faction) >= 0;
  }
  function enabled(a) { return !!(a && !a.destroyed && a.commandChain && a.commandChain.mode === 'receipt'); }
  function holders(a) {
    if (!enabled(a)) return [];
    var out = [];
    (a.commandChain.custodians || []).forEach(function(b) {
      var c = person(b.characterId || b.name);
      if (live(c) && sameFaction(c,a) && !out.some(function(x) { return x.id === (c.id || c.name); })) out.push({id:c.id || c.name,name:c.name,officeId:b.officeId || '',title:b.title || c.officialTitle || ''});
    });
    // A dead/captured custodian cannot issue a reply. The serving commander is
    // the fallback witness; never silently replace him with the player.
    if (!out.length) {
      var c = person(a.commanderId || a.commander);
      if (live(c) && sameFaction(c,a)) out.push({id:c.id || c.name,name:c.name,title:'军中主将',acting:true});
    }
    return out;
  }
  function basis(a) { return JSON.stringify([facOf(a),holders(a).map(function(c) { return c.id; }),a.commander || '',a.destination || '',a.location || a.garrison || '']); }
  function orders() { return Array.isArray(game().commandOrders) ? game().commandOrders : []; }
  function writeOrders() {
    var G = game();
    if (!Array.isArray(G.commandOrders)) G.commandOrders = []; // arch-ok: command-receipt ledger owner, persisted with GM.
    return G.commandOrders;
  }
  function active(o) { return o && ['pending','delayed','refused'].indexOf(o.status) >= 0; }
  function intent(change) {
    var out = {};
    FIELDS.forEach(function(k) {
      if (change[k] == null) return;
      var key = ['faction','owner','factionName'].indexOf(k) >= 0 ? 'faction' : ['destination','location','garrison','commandHandoverTo'].indexOf(k) >= 0 ? k : 'commander';
      var value = String(change[k]).trim(), c = (key === 'commander' || key === 'commandHandoverTo') && person(value);
      out[key] = c ? c.name : value;
    });
    return out;
  }
  function deltaIntent(a, change) {
    var out = intent(change);
    Object.keys(out).forEach(function(k) {
      var current = k === 'commander' ? a.commander : a[k];
      if (k !== 'commandHandoverTo' && String(current || '') === out[k]) delete out[k];
    });
    return out;
  }
  function issueText(o) {
    var todo = o.requested || {}, lines = [];
    if (todo.commander !== undefined) lines.push('拟以' + (todo.commander || '另员') + '领军');
    if (todo.destination) lines.push('拟调往' + todo.destination);
    if (todo.location || todo.garrison) lines.push('拟改驻' + (todo.location || todo.garrison));
    if (todo.commandHandoverTo) lines.push('拟向' + todo.commandHandoverTo + '交出军令、籍簿');
    if (todo.faction) lines.push('拟改隶' + todo.faction);
    return lines.join('，') || o.text;
  }
  function publish(o) {
    var G = game(), a = (G.armies || []).find(function(a) { return a && (a.id || a.name) === o.armyId; });
    var who = a ? holders(a).map(function(c) { return c.name; }).join('、') : '';
    var desc = issueText(o) + '。' + (who ? '军令现经' + who + '传达，' : '军中承命之人尚待查明，') + (o.status === 'executed' ? '已有回报。' : '须问清是否接令、何时点军。') + (o.report ? '\n\n回报：' + o.report : '');
    if (!Array.isArray(G.currentIssues)) G.currentIssues = []; // arch-ok: command-receipt ledger publishes its own issue through the existing issue store.
    var q = G.currentIssues.find(function(q) { return q.id === 'command-issue:' + o.id; });
    if (!q) { q = {id:'command-issue:' + o.id,category:'军政',raisedTurn:G.turn || 1,linkedChars:[],severity:'medium',commandOrderId:o.id}; G.currentIssues.push(q); }
    q.title = o.armyName + '：' + (LABELS[o.status] || LABELS.pending);
    q.description = desc; q.narrative = desc; q.status = ['executed','superseded'].indexOf(o.status) >= 0 ? 'resolved' : 'pending';
    q.linkedChars = a ? holders(a).map(function(c) { return c.name; }) : [];
    if (o._announcedStatus !== o.status) {
      if (typeof global.addEB === 'function') global.addEB('军报', q.title + '。' + (o.report || issueText(o)));
      o._announcedStatus = o.status;
    }
  }
  function request(a, change, opts) {
    opts = opts || {};
    if (!enabled(a)) return null;
    var wanted = intent(change || {}), text = String(opts.text || opts.reason || '军令待复');
    var previous = orders().find(function(o) { return active(o) && o.armyId === (a.id || a.name) && o.basis === basis(a) && (JSON.stringify(o.requested) === JSON.stringify(wanted) || (!Object.keys(o.requested || {}).length && o.text === text)); });
    if (previous) return previous;
    var list = writeOrders(), seq = list.reduce(function(n,o) { return Math.max(n,Number(o.sequence) || 0); },0) + 1;
    var turnDays = typeof global.getTurnDays === 'function' ? global.getTurnDays() : Number(global.P && global.P.time && global.P.time.daysPerTurn) || 30;
    var o = {id:'command:' + String(game().sid || '') + ':' + seq,sequence:seq,armyId:a.id || a.name,armyName:a.name,factionId:facOf(a),requested:wanted,text:text,status:'pending',issuedTurn:game().turn || 1,replyNotBeforeTurn:(game().turn || 1) + Math.ceil(Math.max(0,Number(a.commandChain.dispatchDays) || 0) / Math.max(1,turnDays)),basis:basis(a),custodians:holders(a)};
    list.push(o); publish(o); return o;
  }
  function reject(o, status, report) { o.status = status; o.report = report; publish(o); return {allowed:false,pending:true,orderId:o.id,reason:report}; }
  function prepare(a, change, opts) {
    opts = opts || {};
    if (!enabled(a)) return {allowed:true};
    var wanted = deltaIntent(a,change), receipt = change.commandReceipt;
    var o = receipt && orders().find(function(x) { return x.id === receipt.orderId && x.armyId === (a.id || a.name); });
    if (receipt && !o) return {allowed:false,pending:true,reason:'未见本军此前所奉之令，不能凭新回报径作交割'};
    if (o && o.status === 'executed') return {allowed:false,duplicate:true,reason:'此份军中回报已经办理'};
    if (!Object.keys(wanted).length && !receipt) return {allowed:true};
    if (wanted.commander && !live(person(wanted.commander))) return {allowed:false,pending:true,reason:'拟任主将尚不能到军履职'};
    // Actual NPC orders from the owning faction still need the named actor to
    // be an actual custodian. The source string alone grants no authority.
    var acting = opts.actorId && holders(a).find(function(c) { return c.id === opts.actorId || c.name === opts.actorId; });
    if (acting && holders(a).length === 1 && opts.factionId === facOf(a) && !wanted.commandHandoverTo && !wanted.faction) return {allowed:true};
    if (!o) o = orders().find(function(x) { return active(x) && x.armyId === (a.id || a.name) && x.basis === basis(a) && (!Object.keys(x.requested || {}).length || JSON.stringify(x.requested) === JSON.stringify(wanted)); });
    if (!o) o = request(a,wanted,{text:change.reason || opts.reason || '请军中覆报所奉军令'});
    if (o.basis !== basis(a)) return reject(o,'superseded','军中掌兵或驻防已有变动，旧回报不能径行援用。');
    if (!Object.keys(o.requested || {}).length && Object.keys(wanted).length) {
      // Interpretation of an incomplete instruction is a separate pending step;
      // a reply may not both invent its terms and approve them in the same call.
      if (receipt) return {allowed:false,pending:true,orderId:o.id,reason:'原令调发细节尚未定明，须先具报拟办之事'};
      if (wanted.commandHandoverTo) return {allowed:false,pending:true,orderId:o.id,reason:'接领军籍须另有明令，不能附在本次调发回报内'};
      o.requested = copy(wanted); publish(o);
      return {allowed:false,pending:true,orderId:o.id,reason:'拟办之事已列入候复，尚未得到军中承诺'};
    }
    if (!receipt || receipt.orderId !== o.id) return {allowed:false,pending:true,orderId:o.id,reason:'军令已发，候实际掌兵者回报'};
    if (!(receipt.decision !== 'accepted' && !Object.keys(wanted).length) && JSON.stringify(wanted) !== JSON.stringify(o.requested)) return {allowed:false,pending:true,orderId:o.id,reason:'回报与原令所指的调动不符，须另议'};
    if (Number(game().turn || 1) < Number(o.replyNotBeforeTurn)) return {allowed:false,pending:true,orderId:o.id,reason:'使者尚在途中，未到覆报之期'};
    var required = holders(a), replies = Array.isArray(receipt.by) ? receipt.by : [receipt.by];
    var recovery = !required.length && reconstitution(a,o,wanted,receipt,replies);
    if ((!required.length && !recovery) || !required.every(function(c) { return replies.indexOf(c.id) >= 0 || replies.indexOf(c.name) >= 0; })) return {allowed:false,pending:true,orderId:o.id,reason:'回报未经现掌兵者确认'};
    if (typeof receipt.report !== 'string' || receipt.report.trim().length < 4) return {allowed:false,pending:true,orderId:o.id,reason:'须有军中具体回报'};
    if (receipt.decision === 'refused' || receipt.decision === 'delayed') return reject(o,receipt.decision,receipt.report.trim().slice(0,1200));
    if (receipt.decision !== 'accepted') return {allowed:false,pending:true,orderId:o.id,reason:'军中尚未明确奉行'};
    if (wanted.commander && !live(person(wanted.commander))) return {allowed:false,pending:true,orderId:o.id,reason:'拟任主将尚不能到军履职'};
    if (wanted.commandHandoverTo && (!live(person(wanted.commandHandoverTo)) || !sameFaction(person(wanted.commandHandoverTo),a))) return {allowed:false,pending:true,orderId:o.id,reason:'受领军籍之人已不具备交接条件'};
    return {allowed:true,orderId:o.id,report:receipt.report.trim().slice(0,1200),handoverTo:wanted.commandHandoverTo || ''};
  }
  function reconstitution(a,o,wanted,receipt,replies) {
    if (receipt.reconstitution !== true || !wanted.commandHandoverTo || Number(game().turn || 1) <= Number(o.issuedTurn)) return false;
    var old = a.commandChain.custodians || [];
    if (!old.length || !old.every(function(b) { var c=person(b.characterId || b.name); return c && (c.alive === false || c.dead || c.captured || c._captured || !sameFaction(c,a)); })) return false;
    var c = person(wanted.commandHandoverTo), f = (game().facs || []).find(function(f) { return f && [f.id,f.name].indexOf(facOf(a)) >= 0; });
    var leader = f && person(f.leaderId || f.leader), held = false;
    if (!live(c) || !live(leader) || c === leader || !sameFaction(c,a) || c._travelTo || c.location !== (a.location || a.garrison)) return false;
    var player = (game().chars || []).find(function(ch) { return ch && ch.isPlayer; });
    var tree = player && sameFaction(player,a) ? game().officeTree : f.officeTree;
    (function walk(ns) { (ns || []).forEach(function(n) { (n.positions || []).forEach(function(p) { if (p.powers && p.powers.militaryCommand && (p.holderId === c.id || p.holder === c.name)) held=true; }); walk(n.subs); }); })(tree);
    return held && [c,leader].every(function(ch) { return replies.indexOf(ch.id) >= 0 || replies.indexOf(ch.name) >= 0; });
  }
  function commit(a, ticket) {
    if (!ticket || !ticket.allowed || !ticket.orderId) return;
    var o = orders().find(function(x) { return x.id === ticket.orderId; });
    if (!o || o.status === 'executed') return;
    if (ticket.handoverTo) {
      var c = person(ticket.handoverTo);
      a.commandChain.custodians = [{characterId:c.id || c.name,title:c.officialTitle || '领军',acceptedTurn:game().turn || 1}];
      a.commandChain.lastHandover = {from:o.custodians.map(function(c) { return c.name; }),to:c.name,turn:game().turn || 1,orderId:o.id};
    }
    o.status = 'executed'; o.report = ticket.report; o.executedTurn = game().turn || 1; publish(o);
  }
  function withoutCommand(change) { var c = Object.assign({},change); FIELDS.forEach(function(k) { delete c[k]; }); delete c.commandReceipt; return c; }
  function prepareMarch(a, to, data) { return enabled(a) ? prepare(a,{destination:to,commandReceipt:data && data.commandReceipt},{}) : null; }
  function requestMarch(a, to) {
    if (!enabled(a)) return null;
    var o = request(a,{destination:to},{text:'调' + a.name + '赴' + to});
    return {ok:true,pending:true,orderId:o.id,reason:'军令已发，候军中回报'};
  }
  function applyNpcOrder(a,fac,p,source) {
    if (!enabled(a)) return null;
    if (typeof global.applyAIArmyChange !== 'function') return {ok:false,reason:'军令交接尚不能核实，暂缓记作奉行'};
    try {
      var r = global.applyAIArmyChange({name:a.name,commander:p.commander || p.commanderName || p.general || p.leader || p.newCommander || p.newGeneral || undefined,destination:p.destination,location:p.location,garrison:p.garrison,commandReceipt:p.commandReceipt,commandHandoverTo:p.commandHandoverTo,reason:p.reason || p.rationale || ''},{source:source,actorId:p.issuerId || (fac && fac.leader),factionId:fac && (fac.id || fac.name)});
      if (!r || r.pending || r.duplicate || !r.ok) return {ok:false,pending:!!(r && r.pending),reason:r && r.reason || '此份军中回报尚未办成或已经办理'};
      return r;
    } catch(e) { return {ok:false,reason:'军令交接未成，须复核原报'}; }
  }
  function matchedArmies(text) {
    // A generic alias embedded in a more specific unit name must not order the
    // other wing as well. Explicit mentions elsewhere in the sentence survive.
    var matches = [];
    (game().armies || []).filter(enabled).forEach(function(a) { [a.name].concat(a.commandChain.aliases || []).forEach(function(n) {
      if (!n || String(n).length < 2) return;
      var start = text.indexOf(n);
      while (start >= 0) { matches.push({army:a,start:start,end:start+n.length}); start = text.indexOf(n,start+1); }
    }); });
    return (game().armies || []).filter(function(a) {
      return enabled(a) && matches.some(function(m) { return m.army === a && !matches.some(function(other) { return other.start <= m.start && other.end >= m.end && other.end-other.start > m.end-m.start; }); });
    });
  }
  function clauses(text) { return String(text || '').split(/[。；;\n]/).filter(function(t) { return /调|出营|出兵|拔营|移防|统领|节制|易将|换帅|军籍|交兵/.test(t) && !/暂不|不得|不许|勿|毋|切莫|缓调|停止|不调|不必/.test(t) && !/可否|是否|何以|如何|[？?]/.test(t); }); }
  function observeEdict(text) {
    var seen = {}, out = [];
    clauses(text).forEach(function(t) { matchedArmies(t).forEach(function(a) {
      if (seen[a.id || a.name]) return;
      var wanted = {}, destination = t.match(/(?:调往|开赴|移驻|赴)\s*([^，。；;\s]{1,24})/);
      if (destination) wanted.destination = destination[1];
      // These are roster-anchored explicit words of transfer, not the ordinary
      // appointment of a field commander. Unclear intentions stay pending.
      if (/交兵|交出军令|交付军籍|交出军籍|接收军籍|接管军籍|交接兵权|收回兵权/.test(t)) {
        var recipients = (game().chars || []).filter(live).filter(function(ch) {
          if (!ch.name) return false;
          return ['交予','交给','交由','付与','交兵予','交兵给','军籍交予','军籍交给'].some(function(pre) { return t.indexOf(pre+ch.name)>=0; }) || ['接掌','接管','接收'].some(function(post) { return t.indexOf(ch.name+post)>=0; });
        });
        if (recipients.length === 1) wanted.commandHandoverTo=recipients[0].name;
      }
      out.push(request(a,wanted,{text:t.trim()})); seen[a.id || a.name] = true;
    }); });
    return out;
  }
  function describe(a) {
    if (!enabled(a)) return '';
    var cs = holders(a), s = cs.length ? '传令掌兵：' + cs.map(function(c) { return c.name + (c.title ? '（' + c.title + '）' : ''); }).join('、') : '掌兵者失联，须重定承命之人';
    var o = orders().filter(function(o) { return o.armyId === (a.id || a.name); }).slice(-1)[0];
    if (o) s += '\n' + (LABELS[o.status] || '') + '：' + issueText(o) + (o.report ? '\n' + o.report : '');
    if (a.commandChain.note) s += '\n' + a.commandChain.note;
    return s;
  }
  function pipeline(text) {
    return matchedArmies(String(text || '')).map(function(a) {
      var officers=holders(a),cs=officers.map(function(c) { return person(c.id); }).filter(Boolean);
      function mean(field) { var values=cs.map(function(c) { return c[field]; }).filter(function(v) { return typeof v === 'number' && isFinite(v); }); return values.length ? values.reduce(function(n,v) { return n+v; },0)/values.length : null; }
      var who=officers.map(function(c) { return c.name; }).join('、');
      return {name:a.name + '接令',officer:who,note:describe(a),ability:mean('military'),loyalty:mean('loyalty'),authoritySummary:a.name+'接令（'+(who?'由'+who+'传令，须核军中回报':'承命者待查，尚不能径行调动')+'）'};
    });
  }
  function prompt() {
    var as = (game().armies || []).filter(enabled);
    if (!as.length) return '';
    var lines = ['【军令承接与交割】'];
    as.forEach(function(a) { lines.push(a.name + '：' + describe(a)); });
    var pending = orders().filter(active);
    if (pending.length) lines.push('待复军令：' + JSON.stringify(pending.map(function(o) { return {orderId:o.id,armyName:o.armyName,requested:o.requested,text:o.text,by:o.custodians.map(function(c) { return c.name; }),replyNotBeforeTurn:o.replyNotBeforeTurn,status:o.status}; })));
    lines.push('调动/换帅必须先有发令与军中回报；军中尚未答复，不得叙述为已出营或已交兵。给饷只结给饷之账，任官只记所授官职。动机须按每人的旧交、职责与利害判断，可奉行、请缓或拒绝，不强制抗命。');
    lines.push('在 army_changes 对应军队内附 commandReceipt:{orderId:"上述军令ID",decision:"accepted|delayed|refused",by:["现掌兵者姓名"],report:"本军具体回报"}。同条 commander/destination/location/garrison 必须与原令一致；不能只用叙事跳过回执。新指令先产生候复记录，下次再覆报。只同意部分兵额时不得把全营写成出动。');
    lines.push('转交实际掌兵权另写 commandHandoverTo:"受领者姓名" 并取得交接回报；只换主将不自动撤走中尉、监军或军府的传令关系。异地军府回报须等使程；没有回书不算同意。不得把批准一次出兵当作永久交出本军。');
    lines.push('旧掌兵者与现主将均已死、俘而无人承命时，可另任到营军官接管：其须实际持有调兵职权、抵达驻地，至少下一回合由本势力领袖与该军官共同回报（commandReceipt.reconstitution:true），并列 commandHandoverTo。未到营、只下任命、无人验交时仍候复。');
    return lines.join('\n');
  }
  TM.CommandAuthority = {enabled:enabled,holders:holders,request:request,prepare:prepare,commit:commit,withoutCommand:withoutCommand,prepareMarch:prepareMarch,requestMarch:requestMarch,applyNpcOrder:applyNpcOrder,observeEdict:observeEdict,pipeline:pipeline,describe:describe,getPrompt:prompt};
})(typeof window !== 'undefined' ? window : globalThis);
