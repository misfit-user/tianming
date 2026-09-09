// @ts-check
// 履行单是既有文书/账本的只读投影，不是新的发令、扣款或结算入口。
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var tokens = new WeakMap();
  var channels = { edict: '诏书', memorial: '奏疏批复', letter: '鸿雁传书', court: '朝会廷议' };
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 2000) : ''; }
  function rows(v) { return Array.isArray(v) ? v : []; }
  function finite(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
  function unique(list, id) {
    if (id === undefined || id === null || id === '') return null;
    var hits = rows(list).filter(function(x) { return x && x.id === id; });
    return hits.length === 1 ? hits[0] : null;
  }
  function identity(G) { return { gm:G, p:global.P, load:global._tmLoadGen || 0, campaign:G._campaignId, timeline:G._timelineId }; }
  function current(s) { return s && s.gm === global.GM && s.p === global.P && s.load === (global._tmLoadGen || 0) && s.campaign === s.gm._campaignId && s.timeline === s.gm._timelineId; }
  function channel(e) {
    if (e.letterId || e.source === 'letter') return 'letter';
    if (/^(tinyi|tingyi|chaoyi|changchao)/.test(e.source || '')) return 'court';
    if (e.source === 'memorial') return 'memorial';
    return 'edict';
  }
  function letterState(letter) {
    if (!letter) return '原函缺失或身份有歧义';
    var names = {traveling:'驿传在途',pending:'待发送',blocked:'流转受阻',intercepted:'途中被截',lost:'途中失联',
      delivered:'已送达，待执行回报',replied:'已回函',read:'已阅函'};
    return names[letter.status] || ('原函状态：' + str(letter.status,60));
  }
  function status(source, kind, letter) {
    if (kind === 'letter') return letterState(letter);
    if (kind === 'memorial') {
      var labels = {approved:'准奏',rejected:'驳回',annotated:'朱批',referred:'批转有司',court_debate:'发交廷议',pending_review:'留中',modified:'改议',drafted:'待朱批',pending_draft:'待具奏'};
      var label = labels[source.status] || '待处置';
      return label + (source._commitApplied === false ? ' · 待过回合提交' : source._commitApplied === true ? ' · 已提交，非已办成' : ' · 依原奏流程');
    }
    var names = {pending:'已录旨，待推演',pending_delivery:'驿传在途',executing:'执行中',partial:'部分执行',stalled:'进展停滞',sabotaged:'执行受阻',
      obstructed:'执行受阻',blocked:'流转受阻',ignored:'未见执行',done:'已有完成回报',executed:'已有执行记录',completed:'已有完成回报',abandoned:'已撤回',terminated:'已终止',failed:'已有失败回报'};
    return names[source.status] || ('原记录：' + str(source.status,60));
  }
  function project(G, source, collection, index, kind) {
    var letter = kind === 'letter' ? unique(G.letters, source.letterId) : null;
    var text = str(source.content || source.draftText || source.originalEdictText || source.text || source.topic);
    var reply = str(source.reply || source.feedback,1200);
    var title = str(source.title || source.subject || source.topic,120) || text.slice(0,70) || '未题文书';
    var result = { key:collection + ':' + index, sourceId:source.id || source.letterId || '', collection:collection,
      channel:kind, channelLabel:channels[kind], title:title, text:text, reply:reply,
      turn:finite(source.turn != null ? source.turn : source.sentTurn),
      actor:str(source.assignee || source.target || source.from || source.presenter,120), status:status(source,kind,letter),
      progress:finite(source.progressPercent), advice:str(source._nextAdvice,400),
      reliefRelated:/赈|救灾|灾民|灾户|救济/.test(text + title + reply),
      history:rows(source._chainEffects).slice(-12).map(function(h){return {turn:finite(h.turn),text:str(h.effect,400)};}) };
    if (collection === '_courtRecords') {
      var d = source.decision || {};
      result.text = text + (d.actualDirection || d.direction ? '\n裁决：' + str(d.actualDirection || d.direction,400) : '');
      result.status = d.mode === 'defer' ? '留待再议，未颁行' : '已记录议事裁决；颁行与执行以原流程为准';
      result.progress = null;
    }
    if (letter) { result.reply = str(letter.reply || reply,1200); result.status = letterState(letter); }
    var execution = source._policyExecution || source.executionResult || (letter && letter._policyExecution);
    if (execution) {
      result.execution = { ok:execution.ok === true, reason:str(execution.reason,400), pathway:str(execution.pathway,60) };
      // Explicit IDs only: matching prose/region names is not a financial receipt.
      var body = execution.executionResult || execution.result || execution;
      if (body.ok === false || body.success === false) result.execution.ok = false;
      var orderId = body.orderId || (body.order && body.order.id);
      var orders = rows(G.transferOrders).concat(rows(G._transferOrders));
      var order = unique(orders,orderId);
      if (order) result.transfer = { id:order.id, amount:finite(order.amount), delivered:finite(order.deliveredAmount), status:str(order.status,80) };
    }
    tokens.set(result,{identity:identity(G),source:source,collection:collection,index:index,
      content:source.content,reply:source.reply,status:source.status,letter:letter,letterStatus:letter && letter.status});
    return result;
  }
  function list(G, options) {
    if (!G || G !== global.GM) return { entries:[],total:0,warnings:['世界已变更，请重新打开。'] };
    options = options || {}; var all = [], warnings = [];
    function scan(collection, kind) {
      var sourceRows = rows(G[collection]);
      sourceRows.forEach(function(source,index) {
        if (!source || typeof source !== 'object' || source._reliefCaseId) return; // Old unpublished standalone pilot, never adopt it.
        if (collection === 'edicts' && source.status !== 'promulgated') return;
        if (collection === 'memorials' && !/^(approved|rejected|annotated|referred|court_debate|pending_review)$/.test(source.status || '')) return;
        var entry = project(G,source,collection,index,kind || channel(source));
        if (options.reliefOnly !== false && !entry.reliefRelated) return;
        all.push(entry);
      });
    }
    scan('_edictTracker'); scan('edicts','edict'); scan('memorials','memorial'); scan('_pendingMemorials','memorial'); scan('_courtRecords','court');
    all.sort(function(a,b){return (b.turn || 0)-(a.turn || 0);});
    if (rows(G.currentIssues).some(function(i){return i && i.relief && i.relief.version === 1;}) || rows(G.transferOrders).some(function(o){return o && o.protocol === 'relief-cash-v1';})) {
      warnings.push('此档含旧版独立试验案。原案与流水保留，未自动归入正式文书、扣款、退款或结案；需另行核对，不能重复拨同笔钱。');
    }
    var offset = Math.max(0,Math.floor(Number(options.offset) || 0)), limit = Math.min(50,Math.max(1,Math.floor(Number(options.limit) || 20)));
    return { entries:all.slice(offset,offset+limit),total:all.length,offset:offset,limit:limit,warnings:warnings };
  }
  function resolve(G, entry) {
    var t = entry && tokens.get(entry);
    if (!t || !current(t.identity) || G !== t.identity.gm) return {ok:false,code:'stale-world'};
    var live = rows(G[t.collection])[t.index];
    if (live !== t.source || live.content !== t.content || live.reply !== t.reply || live.status !== t.status ||
      (t.letter && (unique(G.letters,live.letterId) !== t.letter || t.letter.status !== t.letterStatus))) return {ok:false,code:'source-updated'};
    return {ok:true,entry:project(G,live,t.collection,t.index,entry.channel)};
  }
  TM.ReliefGovernance = { list:list, resolve:resolve, channels:channels };
})(typeof window !== 'undefined' ? window : globalThis);
