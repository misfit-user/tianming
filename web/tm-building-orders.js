// Internal owner for construction intents submitted through the existing edict UI.
// Proposals are not commands. Only a collected/promulgated reference may be adjudicated.
(function(root) {
  'use strict';
  var TM = root.TM;
  if (!TM) throw new Error('building-orders requires the canonical TM provider');
  var writing = new WeakSet();
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function id() { return 'build-' + (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)); }
  function book(game) { return Array.isArray(game && game._buildingOrders) ? game._buildingOrders : []; }
  function identity(game) { return { campaign: String(game._campaignId || ''), timeline: String(game._timelineId || '') }; }
  function ordersById(game, key) { var matches = book(game).filter(function(o) { return o && o.id === key; }); return matches.length === 1 ? matches[0] : null; }
  function regionEntries(game, project, mirrors) {
    var entries = [], objects = new Set(), keys = new Set();
    [project && project.adminHierarchy, game && game.adminHierarchy].forEach(function(tree) {
      Object.keys(tree || {}).forEach(function(faction) {
        function walk(nodes, names) {
          (Array.isArray(nodes) ? nodes : []).forEach(function(d) {
            if (!d || objects.has(d)) return;
            objects.add(d);
            var path = names.concat(String(d.name || '')), regionId = d.id == null ? '' : String(d.id), key = JSON.stringify([faction, path, regionId]);
            // P/GM may hold mirrors; same semantic path/id denotes the same region.
            if (mirrors || !keys.has(key)) { entries.push({ div: d, ref: { id: regionId, faction: faction, path: path } }); keys.add(key); }
            walk(d.divisions || d.children, path);
          });
        }
        var branch = tree[faction]; walk(branch && (branch.divisions || branch.children), []);
      });
    });
    return entries;
  }
  function resolve(game, project, ref) {
    var rows = regionEntries(game, project).filter(function(row) {
      return ref.id ? row.ref.id === ref.id : row.ref.faction === ref.faction && JSON.stringify(row.ref.path) === JSON.stringify(ref.path);
    });
    return rows.length === 1 ? rows[0].div : null;
  }
  function propose(game, project, regionName, req, appraisal, body) {
    if (!game || !project) return { ok: false, reason: '当前世界未就绪' };
    if (!req || typeof req.name !== 'string' || !req.name.trim() || typeof body !== 'string' || !body.trim()) return { ok: false, reason: '营造名目或正文无效' };
    if (game._buildingOrders != null && !Array.isArray(game._buildingOrders)) return { ok: false, reason: '营造案账格式损坏，未覆盖原记录' };
    var scope = identity(game);
    if (!scope.campaign || !scope.timeline) return { ok: false, reason: '当前世界缺少稳定身份，请完成开局或重新读档' };
    var hits = regionEntries(game, project).filter(function(row) { return row.div.name === regionName; });
    if (hits.length !== 1) return { ok: false, reason: '地区未找到或有重名，请先核对区划' };
    var order = { id: id(), campaign: scope.campaign, originTimeline: scope.timeline, region: hits[0].ref,
      regionName: regionName, req: copy(req), appraisal: appraisal ? copy(appraisal) : null,
      createdTurn: game.turn || 0, status: 'draft', receipt: null };
    order.content = '〔营造案 ' + order.id + '〕\n' + body;
    if (!Array.isArray(game._buildingOrders)) game._buildingOrders = [];
    game._buildingOrders.push(order);
    return { ok: true, id: order.id, content: order.content };
  }
  function draftRefs(game, text) {
    text = String(text || ''); var refs = [], errors = [];
    var seen = new Set(), re = /〔营造案 (build-[a-zA-Z0-9-]+)〕/g, match;
    while ((match = re.exec(text))) {
      if (seen.has(match[1])) continue; seen.add(match[1]);
      var order = ordersById(game, match[1]);
      if (!order || order.campaign !== identity(game).campaign) errors.push('营造案不属于当前局：' + match[1]);
      else if (text.indexOf(order.content) < 0) errors.push('「' + order.req.name + '」营造案正文已改，请重新核议/录入；不要沿用旧案号');
      else refs.push(order.id);
    }
    return { refs: refs, errors: errors };
  }
  function capturePolish(game, project, source) {
    var r = draftRefs(game, source), scope = identity(game);
    return { source: source, refs: r.refs, errors: r.errors, campaign: scope.campaign, timeline: scope.timeline,
      loadGen: root._tmLoadGen || 0, turn: game.turn || 0 };
  }
  function polishedRefs(game, binding, text, currentSource) {
    if (!binding) return draftRefs(game, text);
    if (!(binding.refs || []).length && !(binding.errors || []).length) return { refs: [], errors: [] };
    var scope = identity(game);
    if (binding.source !== currentSource || binding.text !== text || binding.campaign !== scope.campaign || binding.timeline !== scope.timeline || binding.turn !== game.turn || binding.loadGen !== (root._tmLoadGen || 0)) {
      return { refs: [], errors: ['营造所附的润色稿/原草稿或世界已变化，请重新润色后颁行'] };
    }
    var omitted = binding.refs.filter(function(key) { var o = ordersById(game, key); return !o || String(text).indexOf(o.req.name) < 0; });
    if (omitted.length) return { refs: [], errors: ['润色稿遗漏营造名目，未颁行；请重试润色或保留原文'] };
    return { refs: binding.refs.slice(), errors: binding.errors.slice() };
  }
  function announce(game, order, receipt) {
    var status = receipt.status;
    var line = '「' + order.req.name + '」' + (status === 'applied' ? '已立项开工' : status === 'rejected' ? '未准兴工' : status === 'deferred' ? '暂缓兴工' : '未开工') + '：' + receipt.reason;
    try {
      (game._edictTracker || []).forEach(function(e) { if (e && String(e.content || '').indexOf(order.id) >= 0) e.feedback = line; });
      if (!Array.isArray(game._turnReport)) game._turnReport = [];
      game._turnReport.push({ type: 'building_receipt', requestId: order.id, status: status, text: line, turn: game.turn || 0 });
      if (typeof root.addEB === 'function') root.addEB('营造核办', line);
    } catch (e) { console.warn('[building-orders] 回执已保存，日志展示失败'); }
  }
  function feedback(game, order, status, reason, extra, quiet) {
    var receipt = Object.assign({ requestId: order.id, name: order.req.name, region: order.regionName, status: status,
      reason: String(reason || ''), turn: game.turn || 0, committed: status === 'applied' }, extra || {});
    order.status = status; order.receipt = receipt;
    if (!quiet) announce(game, order, receipt);
    return { ok: status === 'applied' || status === 'rejected' || status === 'deferred', changed: status === 'applied', receipt: receipt, reason: receipt.reason };
  }
  function collect(game, project, edicts) {
    var text = ['political','military','diplomatic','economic','other'].map(function(k) { return edicts[k] || ''; }).join('\n\n');
    var parsed = draftRefs(game, text), refs = parsed.refs;
    if (parsed.errors.length) throw new Error(parsed.errors.join('；'));
    (game.edicts || []).forEach(function(e) {
      if (!e || e.status !== 'promulgated' || e.turn !== game.turn || !e.buildingOrderRefs || !String(edicts.decree || '').includes(e.text)) return;
      if (e.buildingBindingText !== e.text) throw new Error('已颁行诏书的营造绑定已变化，请重新颁行');
      refs = refs.concat(e.buildingOrderRefs);
    });
    refs = Array.from(new Set(refs));
    var scope = identity(game), batch = { id: id(), campaign: scope.campaign, timeline: scope.timeline, turn: game.turn || 0, loadGen: root._tmLoadGen || 0, ids: [] };
    Object.defineProperties(batch, { gm: { value: game }, project: { value: project } });
    refs.forEach(function(key) {
      var order = ordersById(game, key);
      if (!order || order.campaign !== scope.campaign) throw new Error('诏书所附营造案身份不符');
      if (order.status === 'recovery_required') throw new Error('营造案账务回滚未完成，禁止重复开工');
    });
    refs.forEach(function(key) {
      var order = ordersById(game, key);
      order.issue = { batchId: batch.id, campaign: batch.campaign, timeline: batch.timeline, turn: batch.turn };
      if (order.status !== 'applied') order.status = 'submitted';
      batch.ids.push(key);
    });
    return batch;
  }
  function current(game, project, batch, agent) {
    var scope = game && identity(game), turn = game && game.turn || 0;
    return !!(batch && batch.gm === game && batch.project === project && batch.campaign === scope.campaign && batch.timeline === scope.timeline && batch.loadGen === (root._tmLoadGen || 0) &&
      (turn === batch.turn || (agent && turn === batch.turn + 1)));
  }
  function issued(game, batch, key) {
    var o = ordersById(game, key);
    return o && batch.ids.indexOf(key) >= 0 && o.issue && o.issue.batchId === batch.id ? o : null;
  }
  function prompt(game, batch, agent) {
    if (!batch || !batch.ids.length) return '';
    var rows = batch.ids.map(function(key) {
      var o = issued(game, batch, key); if (!o) throw new Error('营造批次身份失效');
      return { requestId: o.id, region: o.regionName, name: o.req.name, category: o.req.category, alreadyApplied: o.status === 'applied',
        description: String(o.req.description || '').slice(0, 800), appraisal: o.appraisal };
    });
    return '\n【本回合已颁行的营造案·必须逐案核办】\n' + JSON.stringify(rows) + '\n' +
      (agent ? '每案必须调用 building_project，带 requestId 和 decision。' : '必须返回 building_decisions 数组，每案一条：{"requestId":"案号","decision":"approve|defer|reject","reason":"本回合裁定原因"}。') +
      'approve准行/defer缓行/reject驳回，实际本回合诏意优先，若取消/缓办则据实驳回/缓行，核议仅为参考，未裁定不得在叙事声称已开工。已核议的费用/工期/效果可直接引用；如调整请给 costActual、timeActual、effectsStructured；无核议者准行必须给费用与工期。案号固定地区身份，不要重新猜地名。营造造价由专用账本入口一次扣付，禁止又在 fiscal_adjustments/changes/adjust_treasury 记同笔支出。不要另报同案 building_changes/project_updates 或 record_construction_events。\n';
  }
  function matching(game, project, batch, value) {
    if (!batch) return null;
    if (value.requestId) return issued(game, batch, value.requestId) || null;
    var name = value.type || value.name, region = value.territory || value.region;
    var rows = batch.ids.map(function(key) { return issued(game, batch, key); }).filter(function(o) {
      var d = o && resolve(game, project, o.region);
      return o && name === o.req.name && region != null && region !== '' && (region === o.regionName || (d && (region === d.name || (d.id && String(region) === String(d.id)))));
    });
    return rows.length === 1 ? rows[0] : null;
  }
  function remember(obj, key) {
    var descriptor = Object.getOwnPropertyDescriptor(obj, key), original = obj[key];
    var value = original === undefined ? undefined : copy(original);
    return function() {
      if (!descriptor) { delete obj[key]; return; }
      if (original && typeof original === 'object' && value && typeof value === 'object') {
        Object.keys(original).forEach(function(k) { delete original[k]; });
        Object.keys(value).forEach(function(k) { Object.defineProperty(original, k, { value: value[k], writable: true, configurable: true, enumerable: true }); });
        if (Array.isArray(original)) original.length = value.length;
      }
      Object.defineProperty(obj, key, descriptor);
    };
  }
  function execute(game, project, batch, decision, agent) {
    if (!current(game, project, batch, agent)) return { ok: false, reason: '营造回包已过期，未写入当前世界' };
    var o = issued(game, batch, decision.requestId);
    if (!o) return { ok: false, reason: '营造案未由本回合原诏书提交' };
    function record(status, reason, extra) { return feedback(game, o, status, reason, extra, batch._quiet); }
    if (Object.isFrozen(o)) return { ok: false, reason: '营造回执只读，未开工' };
    if (o.status === 'applied') return { ok: true, changed: false, receipt: o.receipt, reason: '同案已执行，不重复扣款' };
    if (o.status === 'recovery_required') return { ok: false, reason: '营造账务待恢复，禁止重试扣款' };
    if (decision.decision === 'reject' || decision.decision === 'defer') return record(decision.decision === 'reject' ? 'rejected' : 'deferred', decision.reason || '有司未准本回合兴工');
    if (decision.decision !== 'approve') return record('unresolved', '模型未给出有效裁定，未开工');
    var div = resolve(game, project, o.region);
    if (!div) return record('unresolved', '原地区已变更或身份有歧义，未开工');
    if (div.buildings != null && !Array.isArray(div.buildings)) return record('unresolved', '该地建筑账格式损坏，未开工');
    var existing = (div.buildings || []).find(function(b) { return b && (b._buildingOrderId === o.id || b.name === o.req.name); });
    if (existing) return record('unresolved', '该地已有同名工程，未重复扣款或另建');
    var ap = copy(o.appraisal || {});
    ['costActual','timeActual','effectsStructured','judgedEffects','globalRule'].forEach(function(k) { if (decision[k] !== undefined) ap[k] = copy(decision[k]); });
    if (!['costActual','timeActual'].every(function(k) { return (typeof ap[k] === 'number' || (typeof ap[k] === 'string' && ap[k].trim())) && isFinite(Number(ap[k])) && Number(ap[k]) >= 0; })) return record('unresolved', '裁定缺少有效费用或工期，未开工');
    var CBA = TM.CustomBuildAgent, BW = TM.BuildingWorks;
    if (!CBA || !BW || typeof CBA.approveBuild !== 'function' || typeof BW.sanitizeStructuredFx !== 'function') return record('unresolved', '正式营建引擎未就绪，未开工');
    ap.costActual = Number(ap.costActual); ap.timeActual = Number(ap.timeActual); ap.feasibility = '合理';
    var talent = ap.effectsStructured && ap.effectsStructured.talentSource;
    ap.effectsStructured = BW.sanitizeStructuredFx(ap.effectsStructured || {}, ap.costActual) || {};
    if (talent && CBA._normalizeTalentSource) ap.effectsStructured.talentSource = CBA._normalizeTalentSource(talent);
    var restore = [];
    try {
      // Small domain transaction only: no whole-world clone, no live-player file access.
      restore = [remember(game, 'guoku'), remember(game, '_pendingCustomBuilds'), remember(div, 'buildings'), remember(o, 'status'), remember(o, 'receipt')];
      if (Object.isFrozen(o) || (div.buildings && Object.isFrozen(div.buildings))) throw new Error('营造账只读');
      var result = CBA.approveBuild(div.name, ap, o.req, { P: project, GM: game, div: div });
      if (!result || !result.ok || !result.building) throw new Error((result && result.reason) || '正式开工失败');
      result.building._buildingOrderId = o.id;
      if (typeof batch.fault === 'function') batch.fault('after-building'); // isolated fault injection; absent in normal batches
      var stock = game.guoku;
      if (ap.costActual > 0 && (!stock || !stock.ledgers || stock.balance !== stock.money || stock.money !== stock.ledgers.money.stock)) throw new Error('国库账本回执不一致');
      var paid = record('applied', decision.reason || '有司准行，已据正式账落款立项', { spent: result.spent, buildingName: result.building.name, regionId: o.region.id });
      try { (game._edictSuggestions || []).forEach(function(s) { if (s.buildingOrderId === o.id) s.used = true; }); }
      catch (e) { console.warn('[building-orders] 已开工；建议列表刷新失败'); }
      return paid;
    } catch (error) {
      try { restore.reverse().forEach(function(fn) { fn(); }); }
      catch (rollbackError) { return record('recovery_required', '开工失败且回滚未完成，已停止自动重试：' + rollbackError.message); }
      return record('unresolved', '开工失败，未保留本次扣款和建筑：' + error.message);
    }
  }
  function decisions(game, project, batch, output) {
    var rows = Array.isArray(output.building_decisions) ? output.building_decisions.slice() : [];
    (Array.isArray(output.building_changes) ? output.building_changes : []).forEach(function(b) {
      var o = b && matching(game, project, batch, b);
      if (!o || rows.some(function(r) { return r && r.requestId === o.id; })) return;
      if (!/^(build|custom_build|start)$/.test(b.action || '')) return;
      rows.push(Object.assign({}, b, { requestId: o.id, decision: b.feasibility === '不合理' ? 'reject' : 'approve' }));
    });
    return rows;
  }
  function missing(game, project, batch, output) {
    if (!batch || !batch.ids.length) return [];
    var rows = decisions(game, project, batch, output || {});
    return batch.ids.filter(function(key) { return issued(game, batch, key).status !== 'applied' && !rows.some(function(r) { return r && r.requestId === key && /^(approve|defer|reject)$/.test(r.decision); }); });
  }
  function protectOutput(game, project, batch, output) {
    if (!batch || !batch.ids.length || !output) return;
    // Only explicit request IDs are owned here. Unrelated fiscal actions remain untouched.
    ['fiscal_adjustments','project_updates','changes'].forEach(function(k) {
      if (Array.isArray(output[k])) output[k] = output[k].filter(function(row) { return !ownedPayment(batch, row) && !(k === 'project_updates' && row && matching(game, project, batch, row)); });
    });
  }
  function ownedPayment(batch, row) {
    return !!(batch && row && batch.ids.some(function(key) { return row.requestId === key || String(row.reason || '').indexOf(key) >= 0; }));
  }
  function apply(game, project, batch, output, agent) {
    output = output || {};
    if (!batch || !batch.ids.length) return [];
    var rows = decisions(game, project, batch, output || {}), receipts = [];
    batch.ids.forEach(function(key) {
      var choices = rows.filter(function(r) { return r && r.requestId === key; });
      receipts.push(execute(game, project, batch, choices.length === 1 ? choices[0] : { requestId: key, decision: '', reason: '' }, agent));
    });
    if (Array.isArray(output.building_changes)) output.building_changes = output.building_changes.filter(function(b) { return b && !/^build-/.test(b.requestId || '') && !(/^(build|custom_build|start)$/.test(b.action || '') && matching(game, project, batch, Object.assign({}, b, { requestId: null }))); });
    return receipts;
  }
  function manages(game, name, region, batch) {
    return !!(batch && batch.ids.some(function(key) { var o = issued(game, batch, key); return o && o.req.name === name && (!region || region === o.regionName || String(region) === o.region.id); }));
  }
  function pending(game, batch) {
    return batch ? batch.ids.filter(function(key) { var o = issued(game, batch, key); return o && o.status === 'submitted'; }) : [];
  }
  function finish(game, project, batch, agent) {
    return pending(game, batch).map(function(key) { return execute(game, project, batch, { requestId: key, decision: '' }, agent); });
  }
  function begin(game, project, batch) {
    if (!batch || !batch.ids.length) return { commit: function() {}, rollback: function() {} };
    if (!current(game, project, batch, false)) throw new Error('营造批次已过期');
    if (writing.has(game)) throw new Error('营造核办正在提交，禁止并发重入');
    var undo = ['guoku','_pendingCustomBuilds','_buildingOrders','_edictSuggestions'].map(function(k) { return remember(game, k); });
    var prior = {}, snapshots = [];
    batch.ids.forEach(function(key) {
      var o = issued(game, batch, key); prior[key] = JSON.stringify(o.receipt);
      var d = resolve(game, project, o.region); if (!d) return;
      snapshots.push({ ref: copy(o.region), exists: Object.prototype.hasOwnProperty.call(d, 'buildings'), undefinedValue: d.buildings === undefined, buildings: d.buildings == null ? null : copy(d.buildings) });
    });
    writing.add(game);
    batch._quiet = true;
    return {
      commit: function() {
        delete batch._quiet;
        writing.delete(game);
        batch.ids.forEach(function(key) { var o = ordersById(game, key); if (o && o.receipt && JSON.stringify(o.receipt) !== prior[key]) announce(game, o, o.receipt); });
      },
      rollback: function() {
        delete batch._quiet;
        try {
        undo.reverse().forEach(function(fn) { fn(); });
        // The main applier can restore cloned P/GM trees; resolve live counterparts again.
        snapshots.forEach(function(s) {
          regionEntries(game, project, true).filter(function(e) { return s.ref.id ? e.ref.id === s.ref.id : e.ref.faction === s.ref.faction && JSON.stringify(e.ref.path) === JSON.stringify(s.ref.path); }).forEach(function(e) {
            if (!s.exists) delete e.div.buildings; else e.div.buildings = s.undefinedValue ? undefined : copy(s.buildings);
          });
        });
        } catch (error) {
          batch.ids.forEach(function(key) { var o = ordersById(game, key); try { if (o) { o.status = 'recovery_required'; o.receipt = { requestId: key, status: 'recovery_required', committed: false, reason: '主写回撤销失败，需核对账务后再试' }; } } catch (markError) {} });
          throw error;
        } finally { writing.delete(game); }
      }
    };
  }
  function verifyReceipts(game, project, receipts, narrative) {
    if (!Array.isArray(receipts) || !receipts.length) return false;
    return receipts.every(function(r) {
      var o = r && ordersById(game, r.requestId);
      if (!o || !o.receipt || JSON.stringify(r) !== JSON.stringify(o.receipt)) return false;
      if (r.status === 'recovery_required') return false;
      var d = resolve(game, project, o.region), exists = d && (d.buildings || []).some(function(b) { return b._buildingOrderId === o.id; });
      if (r.committed) return !!exists;
      if (exists) return false;
      var at = String(narrative || '').indexOf(o.req.name);
      var nearby = at < 0 ? '' : String(narrative).slice(Math.max(0, at - 15), at + o.req.name.length + 25);
      return !/已(?:经|然)?(?:开工|兴工|建成|落成|竣工)/.test(nearby);
    });
  }
  TM.BuildingOrders = { propose: propose, draftRefs: draftRefs, capturePolish: capturePolish, polishedRefs: polishedRefs,
    collect: collect, current: current, prompt: prompt, matching: matching, execute: execute, missing: missing,
    protectOutput: protectOutput, ownedPayment: ownedPayment, apply: apply, manages: manages, resolve: resolve, list: book, pending: pending, finish: finish, begin: begin, verifyReceipts: verifyReceipts };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.BuildingOrders;
})(typeof window !== 'undefined' ? window : globalThis);
