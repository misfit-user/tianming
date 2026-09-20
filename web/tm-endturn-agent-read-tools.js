// @ts-check
// ============================================================
// tm-endturn-agent-read-tools.js — 模式 b · S2 · 只读工具集(全局按需取数)
//
// 让 agent **主动 pull 整局存档任意内容**(接收「只多不少」的按需侧:基线 prompt 是地板·这些工具是超集)。
// 范本=tm-faction-decision-tools.js(势力按需取数)·范围从「单势力视角」扩到「全局 GM」。
// 铁律:**纯只读·绝不 mutate**·缺失/超大优雅兜底·返回文本(回喂 LLM 下一轮)。
// 详设 docs/agent-mode-design.md §4.1。S3 再建守护写工具。
//
// 9 工具:get_overview(看局面) / get_field(读任意路径·万能兜底) / list_entities(纵览某类)
//        / inspect_entity(细查单个) / search_save(全局检索) / recall_history(查历史先例·复用②)
//   高阶聚合(一调抓全·少调用·零生成不降质·想充分掌握时优先):
//        get_dossier(一调抓全一维度) / read_chronicle(编年长期事势) / read_records(回顾往事·史记/御批回听)
// ============================================================

(function (root) {
  'use strict';
  var TM = root.TM || (root.TM = {});
  TM.Endturn = TM.Endturn || {};

  function _GM(ctx) { return (ctx && ctx.GM) || root.GM || null; }
  function _unsafeSegment(s) { return s === '__proto__' || s === 'prototype' || s === 'constructor'; }

  // kind → 候选 GM 键(取第一个是数组/对象的)·容忍剧本/版本差异
  var KIND_KEYS = {
    chars:     ['chars', 'allCharacters', 'characters'],
    factions:  ['facs', 'factions'],
    provinces: ['provinces', 'regions'],
    armies:    ['armies'],
    events:    ['evtLog', 'events', 'activeEvents'],
    memorials: ['memorials'],
    edicts:    ['activeEdicts', 'edicts'],
    wars:      ['activeWars'],
    relations: ['relations', 'relationships'],
    classes:   ['classes', 'shehui', 'socialClasses'],     // 阶层
    parties:   ['parties', 'dangpai'],                      // 党派(与 factions/势力 两套·党派偏朝堂朋党)
    letters:   ['letters'],                                 // 鸿雁书信
    qiju:      ['qijuHistory']                              // 起居注(含御批回听)
  };

  function _resolveCollection(gm, kind) {
    var keys = KIND_KEYS[kind];
    if (!keys) return { key: null, val: null };
    for (var i = 0; i < keys.length; i++) {
      var v = gm[keys[i]];
      if (v && (Array.isArray(v) ? v.length >= 0 : typeof v === 'object')) return { key: keys[i], val: v };
    }
    return { key: keys[0], val: null };
  }

  // 安全读路径:"guoku" / "GM.guoku" / "chars.0.name"·返回 {ok, value} 或 {ok:false}
  function _readPath(gm, path) {
    if (!gm || path == null) return { ok: false };
    var p = String(path).replace(/^GM\./, '').replace(/^\$\.?/, '');
    var parts = p.split('.').filter(function (s) { return s !== ''; });
    if (parts.some(_unsafeSegment)) return { ok: false };
    var cur = gm;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return { ok: false };
      if (!Object.prototype.hasOwnProperty.call(cur, parts[i])) return { ok: false };
      cur = cur[parts[i]];
    }
    if (cur === undefined) return { ok: false };
    return { ok: true, value: cur };
  }

  // 序列化·截断巨型防爆 token·防循环引用·可选略过 _ 内部字段(digest 用·get_field 不略以保「想看什么看什么」)
  function _dump(v, opts) {
    opts = opts || {};
    var maxLen = opts.maxLen || 1800;
    var skipUnder = !!opts.skipUnderscore;
    var s;
    if (typeof v === 'string') { s = v; }
    else {
      try {
        var seen = [];
        s = JSON.stringify(v, function (k, val) {
          if (skipUnder && typeof k === 'string' && k.charAt(0) === '_') return undefined;
          if (val && typeof val === 'object') {
            if (seen.indexOf(val) >= 0) return '(循环引用)';
            seen.push(val);
            if (Array.isArray(val) && val.length > 50) return val.slice(0, 50).concat(['…(+' + (val.length - 50) + ' 项)']);
          }
          return val;
        }, 2);
      } catch (e) { try { s = String(v); } catch (_) { s = '(无法序列化)'; } }
    }
    if (s == null) s = String(v);
    if (s.length > maxLen) s = s.slice(0, maxLen) + '\n…(截断 · 共 ' + s.length + ' 字符 · 用更具体的 get_field 路径细查)';
    return s;
  }

  function _label(item, idx) {
    if (item == null) return '#' + idx;
    if (typeof item !== 'object') return String(item);
    return String(item.name || item.id || item.title || ('#' + idx));
  }

  // ───────── 工具实现(全部纯读) ─────────

  function _getOverview(gm) {
    if (!gm) return '(无存档)';
    var L = [];
    L.push('【局面速览】回合 ' + (gm.turn != null ? gm.turn : '?') + (gm.eraName ? ' · ' + gm.eraName : ''));
    if (gm.guoku != null) L.push('国库 ' + _dump(gm.guoku, { maxLen: 120 }));
    if (gm.neitang != null) L.push('内帑 ' + _dump(gm.neitang, { maxLen: 120 }));
    if (gm.population != null) L.push('人口 ' + _dump(gm.population, { maxLen: 120 }));
    ['chars', 'facs', 'armies', 'activeWars', 'memorials', 'activeEdicts'].forEach(function (k) {
      var v = gm[k];
      if (Array.isArray(v)) L.push(k + ' 计 ' + v.length + ' 项');
    });
    var ev = gm.evtLog || gm.events;
    if (Array.isArray(ev) && ev.length) {
      L.push('近期大事:');
      ev.slice(-5).forEach(function (e) { L.push('  · ' + ((e && (e.text || e.title)) || _dump(e, { maxLen: 80 }))); });
    }
    L.push('(细查用 get_field/list_entities/inspect_entity/search_save)');
    return L.join('\n');
  }

  function _getField(gm, path) {
    var r = _readPath(gm, path);
    if (!r.ok) return '(未找到路径:' + path + ')';
    return path + ' =\n' + _dump(r.value, { maxLen: 2200 });  // get_field 不略 _·保「想看什么看什么」
  }

  function _listEntities(gm, kind, limit) {
    if (!gm) return '(无存档)';
    var rc = _resolveCollection(gm, kind);
    if (rc.val == null) return '(无此类或为空:' + kind + (rc.key ? ' → GM.' + rc.key : '') + ')';
    var arr = Array.isArray(rc.val) ? rc.val : Object.keys(rc.val).map(function (k) { return rc.val[k]; });
    var lim = (limit && limit > 0) ? Math.min(limit, 200) : 60;
    var L = ['【' + kind + ' · GM.' + rc.key + ' · 共 ' + arr.length + ' 项' + (arr.length > lim ? '·示前 ' + lim : '') + '】'];
    arr.slice(0, lim).forEach(function (item, i) {
      var extra = '';
      if (item && typeof item === 'object') {
        var bits = [];
        ['office', 'post', 'title', 'strength', 'troops', 'status', 'factionId', 'from'].forEach(function (f) {
          if (item[f] != null && typeof item[f] !== 'object') bits.push(f + ':' + item[f]);
        });
        extra = bits.length ? ' (' + bits.slice(0, 3).join(' ') + ')' : '';
      }
      L.push('  ' + i + '. ' + _label(item, i) + extra);
    });
    return L.join('\n');
  }

  function _inspectEntity(gm, kind, id) {
    if (!gm) return '(无存档)';
    var rc = _resolveCollection(gm, kind);
    if (rc.val == null) return '(无此类:' + kind + ')';
    var arr = Array.isArray(rc.val) ? rc.val : Object.keys(rc.val).map(function (k) { return rc.val[k]; });
    var key = String(id);
    var found = null, foundIdx = -1;
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (it && typeof it === 'object' && (String(it.id) === key || String(it.name) === key || String(it.title) === key)) { found = it; foundIdx = i; break; }
    }
    if (!found && /^\d+$/.test(key) && arr[+key] != null) { found = arr[+key]; foundIdx = +key; }
    if (!found) return '(在 ' + kind + ' 中未找到:' + id + ' · 可先 list_entities 看索引)';
    return '【' + kind + ' #' + foundIdx + ' · ' + _label(found, foundIdx) + '】\n' + _dump(found, { maxLen: 2600 });
  }

  function _searchSave(gm, query) {
    if (!gm) return '(无存档)';
    var q = String(query || '').trim();
    if (!q) return '(空查询)';
    var ql = q.toLowerCase();
    var hits = [];
    Object.keys(KIND_KEYS).forEach(function (kind) {
      if (hits.length >= 20) return;
      var rc = _resolveCollection(gm, kind);
      if (rc.val == null) return;
      var arr = Array.isArray(rc.val) ? rc.val : Object.keys(rc.val).map(function (k) { return rc.val[k]; });
      for (var i = 0; i < arr.length && hits.length < 20; i++) {
        var blob;
        try { blob = JSON.stringify(arr[i]); } catch (_) { blob = String(arr[i]); }
        if (blob && blob.toLowerCase().indexOf(ql) >= 0) {
          hits.push('· [' + kind + ' #' + i + '] ' + _label(arr[i], i) + ' — ' + _dump(arr[i], { maxLen: 160, skipUnderscore: true }).replace(/\n/g, ' '));
        }
      }
    });
    if (!hits.length) return '(全局未检索到「' + q + '」· 可换关键词或 recall_history 查记忆)';
    return '【检索「' + q + '」命中 ' + hits.length + ' 条】\n' + hits.join('\n');
  }

  async function _recallHistory(gm, query) {
    var q = String(query || '').trim();
    if (!q) return '(空查询)';
    var M = TM.MemoryAgentTools;
    if (!M || typeof M.exec !== 'function') return '(记忆检索②未加载)';
    var r;
    try { r = await M.exec('recall_by_term', { terms: [q], limit: 8 }, gm); }
    catch (e) { return '(记忆检索异常:' + (e && e.message) + ')'; }
    var hits = (r && Array.isArray(r.hits)) ? r.hits : [];
    if (!hits.length) return '(无「' + q + '」相关历史先例/记忆)';
    var L = ['【历史先例/记忆「' + q + '」' + hits.length + ' 条】'];
    hits.slice(0, 8).forEach(function (h) {
      var t = (h && (h.text || h.summary || h.content)) || _dump(h, { maxLen: 120 });
      L.push('· ' + String(t).slice(0, 200));
    });
    return L.join('\n');
  }

  function _brief(v, n) { n = n || 100; var s = (typeof v === 'string') ? v : _dump(v, { maxLen: n + 20, skipUnderscore: true }); return s.length > n ? s.slice(0, n) + '…' : s; }

  // ───────── 高阶聚合工具(一次调用充分掌握一个维度·少调用·零生成不降质)──────

  // get_dossier(dimension):一调抓全某维度(财政/军事/外交势力/人事/朝局党争/民生/辽东等)·替代多次原子读
  var _DIM_SPEC = {
    fiscal:    { label: '财政全貌', kw: /财|税|库|银|饷|钱|赋|贸|盐|矿|漕|fiscal|salt|debt|coin|tax|trade/, top: ['guoku', 'neitang'], kinds: [], evt: /饷|税|赈|财|库|银|赋|盐|矿/ },
    military:  { label: '军事边防', kw: /军|战|兵|边|防|镇|war|army|troop|border|garrison|mil/, top: [], kinds: ['armies', 'wars'], evt: /战|军|兵|边|攻|守|寇|镇|哗变|掠|犯|扰|陷|堡|关|虏|围|袭/ },
    diplomacy: { label: '势力外交', kw: /势力|外交|盟|邦|藩|蕃|diplo|faction|treaty/, top: [], kinds: ['factions'], evt: /盟|使|战和|邦交|势力|藩|蕃/, special: 'factions' },
    personnel: { label: '人事铨选', kw: /官|任|缺|迁|黜|赏|罚|铨|office|appoint|vacan/, top: [], kinds: [], evt: /任|起复|罢|黜|升|迁|缺|劾/, special: 'officials' },
    court:     { label: '朝局党争', kw: /党|阉|东林|清流|党争|阁|厂卫/, top: [], kinds: [], evt: /党|阉|劾|构陷|阁|厂卫|入狱/, special: 'court' },
    minsheng:  { label: '民心民生', kw: /民|灾|荒|疫|流民|minxin|population|disaster/, top: ['minxin', 'population'], kinds: [], evt: /民|灾|荒|疫|变|乱|流/ }
  };
  function _getDossier(gm, dim) {
    if (!gm) return '(无存档)';
    var d = String(dim || '').toLowerCase();
    var spec = null;
    if (/fisc|财|税|库|银|饷/.test(d)) spec = _DIM_SPEC.fiscal;
    else if (/mil|军|战|兵|边|防/.test(d)) spec = _DIM_SPEC.military;
    else if (/diplo|势力|外交|盟|邦|藩/.test(d)) spec = _DIM_SPEC.diplomacy;
    else if (/person|人事|官|任|铨/.test(d)) spec = _DIM_SPEC.personnel;
    else if (/court|党|阉|朝局|阁/.test(d)) spec = _DIM_SPEC.court;
    else if (/民|灾|荒|minsheng|民生/.test(d)) spec = _DIM_SPEC.minsheng;
    if (!spec) {
      // 未识别维度 → 当作主题词全局深查(search_save 增强)
      return '(维度「' + dim + '」未预置·改用主题深查)\n' + _searchSave(gm, dim);
    }
    var L = ['【' + spec.label + ' · 一览(get_dossier)】'];
    spec.top.forEach(function (k) { if (gm[k] != null) L.push('· ' + k + ':' + _dump(gm[k], { maxLen: 160, skipUnderscore: true })); });
    // gm.vars 里按维度关键词筛(robust·容忍未知确切键名)
    try { if (gm.vars && typeof gm.vars === 'object') { var vk = Object.keys(gm.vars).filter(function (k) { return spec.kw.test(k); }); if (vk.length) L.push('· 相关变量:' + vk.slice(0, 24).map(function (k) { var v = gm.vars[k]; return k + '=' + ((v && v.value != null) ? v.value : (typeof v === 'object' ? _brief(v, 30) : v)); }).join(' ')); } } catch (e) {}
    // 顶层数值字段里按关键词筛(有些变量在 GM 顶层非 vars)
    try { Object.keys(gm).forEach(function (k) { if (k.charAt(0) === '_') return; if (spec.top.indexOf(k) >= 0) return; var v = gm[k]; if ((typeof v === 'number' || typeof v === 'string') && spec.kw.test(k)) L.push('· ' + k + ':' + v); }); } catch (e) {}
    // 相关实体集
    (spec.kinds || []).forEach(function (kind) { var rc = _resolveCollection(gm, kind); if (rc.val) { var arr = Array.isArray(rc.val) ? rc.val : Object.keys(rc.val).map(function (x) { return rc.val[x]; }); if (arr.length) L.push('· ' + kind + '(' + arr.length + '):' + arr.slice(0, 12).map(function (it, i) { return _label(it, i) + (it && (it.strength || it.troops) ? '(' + (it.strength || it.troops) + ')' : ''); }).join('、')); } });
    // 维度专项
    if (spec.special === 'factions') { var fc = _resolveCollection(gm, 'factions').val; if (Array.isArray(fc)) fc.slice(0, 14).forEach(function (f) { L.push('  ◦ ' + (f.name || '') + ' 权势' + (f.power != null ? f.power : (f.strength != null ? f.strength : '?')) + (f.stance || f.posture || f.toPlayer ? ' 态度:' + (f.stance || f.posture || f.toPlayer) : '') + (f.intent ? ' 图:' + _brief(f.intent, 30) : '')); }); }
    if (spec.special === 'officials') { var ch = _resolveCollection(gm, 'chars').val; if (Array.isArray(ch)) { var off = ch.filter(function (c) { return c && c.alive !== false && (c.officialTitle || c.position || c.office || c.title); }).slice(0, 18); off.forEach(function (c) { L.push('  ◦ ' + c.name + ' · ' + (c.officialTitle || c.position || c.office || c.title || '') + ' 忠' + (c.loyalty != null ? c.loyalty : '?') + (c.ambition != null ? '野' + c.ambition : '')); }); } }
    if (spec.special === 'court') { var ch2 = _resolveCollection(gm, 'chars').val; if (Array.isArray(ch2)) { var key = ch2.filter(function (c) { return c && c.alive !== false && (c.loyalty != null || c.ambition != null); }).sort(function (a, b) { return (b.ambition || 0) - (a.ambition || 0); }).slice(0, 12); key.forEach(function (c) { L.push('  ◦ ' + c.name + ' 忠' + (c.loyalty != null ? c.loyalty : '?') + '野' + (c.ambition != null ? c.ambition : '?') + (c.factionId ? ' [' + c.factionId + ']' : '')); }); } }
    // 相关近期事件
    try { var ev = gm.evtLog || gm.events; if (Array.isArray(ev) && spec.evt) { var rel = ev.filter(function (e) { var t = (e && (e.text || e.title)) || ''; return spec.evt.test(t); }).slice(-6); if (rel.length) { L.push('· 相关近期事:'); rel.forEach(function (e) { L.push('  - ' + _brief((e.text || e.title || ''), 80)); }); } } } catch (e) {}
    return L.join('\n');
  }

  // read_chronicle:编年长期事势表(跨回合大事:科举/诏令/工程/条约等·进行中+近完成)
  function _readChronicle(gm) {
    if (!gm) return '(无存档)';
    var ct = gm._chronicleTracks || gm.biannianItems;
    if (!Array.isArray(ct) || !ct.length) return '(编年暂无长期事势)';
    var active = ct.filter(function (t) { return t && t.status !== 'completed' && t.status !== 'aborted'; });
    var done = ct.filter(function (t) { return t && t.status === 'completed'; }).slice(-8);
    var L = ['【编年 · 长期事势表(跨回合)】'];
    L.push('进行中(' + active.length + '):');
    active.slice(0, 30).forEach(function (t) { L.push('· [' + (t.type || '') + '] ' + (t.title || '') + (t.currentStage ? '(' + t.currentStage + ')' : '') + (t.progress != null ? ' ' + t.progress + '%' : '') + (t.actor ? ' 主:' + t.actor : '') + (t.narrative ? ':' + _brief(t.narrative, 60) : '')); });
    if (done.length) { L.push('近完成(' + done.length + '):'); done.forEach(function (t) { L.push('· ' + (t.title || '') + (t.result ? '→' + _brief(t.result, 40) : '')); }); }
    return L.join('\n');
  }

  // read_records(kind,count):回顾往事·过往史记(实录/时政)或起居注+御批回听·几回合按需
  function _readRecords(gm, kind, count, fromTurn, toTurn) {
    if (!gm) return '(无存档)';
    var n = Math.min(Math.max(parseInt(count, 10) || 5, 1), 50);
    var k = String(kind || 'shiji').toLowerCase();
    // ④ kind=memory:深取固化记忆(超窗的压缩≠删·可主动查全·支持 fromTurn/toTurn 查特定旧时段)
    if (/memory|记忆|往昔|旧事|远期/.test(k)) {
      var cm = gm._consolidatedMemory;
      if (!Array.isArray(cm) || !cm.length) return '(无固化记忆)';
      var sel = cm;
      var ft = parseInt(fromTurn, 10), tt = parseInt(toTurn, 10);
      if (!isNaN(ft) || !isNaN(tt)) { sel = cm.filter(function (m) { var t = m && m.turn; if (t == null) return false; if (!isNaN(ft) && t < ft) return false; if (!isNaN(tt) && t > tt) return false; return true; }); }
      else { sel = cm.slice(-n); }
      var saga = (gm._sagaMemory && gm._sagaMemory.text) ? ('\n【多回合综合脉络】' + gm._sagaMemory.text + '\n') : '';
      if (!sel.length) return '(该时段无固化记忆)' + saga;
      return '【固化记忆·深取 ' + sel.length + ' 回(压缩≠删·此为可主动调取的全量)】' + saga + sel.map(function (m) { return '第' + (m && m.turn != null ? m.turn : '?') + '回:' + _brief((m && (m.summary || m.text)) || '', 140); }).join('\n');
    }
    if (/qiju|起居|御批|annot/.test(k)) {
      var qj = (gm.qijuHistory || []).slice(-n);
      if (!qj.length) return '(无起居注/御批记录)';
      return '【起居注 + 御批回听 · 近' + qj.length + '回】\n' + qj.map(function (r) { return '〔第' + (r.turn != null ? r.turn : '?') + '回〕' + _brief(r.text || r.content || '', 150) + (r._annotation ? (' 【御批】' + _brief(r._annotation, 110)) : ''); }).join('\n');
    }
    var sj = (gm.shijiHistory || []).slice(-n);
    if (!sj.length) return '(无史记记录)';
    return '【史记 · 实录/时政 · 近' + sj.length + '回】\n' + sj.map(function (s) { return '〔第' + (s.turn != null ? s.turn : '?') + '回' + (s.szjTitle ? '·' + s.szjTitle : '') + '〕\n  实录:' + _brief(s.shilu || s.shiluText || '', 200) + '\n  时政:' + _brief(s.shizhengji || '', 200) + (s.playerInner ? '\n  君心:' + _brief(s.playerInner, 70) : ''); }).join('\n');
  }

  // get_relations(name):查某人/某势力的关系网(人际关系 + 势力邦交)·推演社会/朋党/邦交动态时一把抓
  function _getRelations(gm, name) {
    if (!gm) return '(无存档)';
    if (!name) return '(缺 name·人物名或势力名)';
    var L = [];
    try {
      var ch = (gm.chars || []).find(function (c) { return c && (c.name === name || String(c.id) === String(name)); });
      if (ch && ch.relations) {
        var rel = ch.relations;
        if (Array.isArray(rel) && rel.length) L.push('【' + name + ' · 人际关系】\n' + rel.slice(0, 18).map(function (r) { return '· ' + (r.target || r.name || r.to || '?') + ':' + (r.type || r.label || r.relation || '') + (r.value != null ? '(' + r.value + ')' : '') + (r.hostility != null ? '·敌意' + r.hostility : ''); }).join('\n'));
        else if (typeof rel === 'object') { var ks = Object.keys(rel); if (ks.length) L.push('【' + name + ' · 人际关系】\n' + ks.slice(0, 18).map(function (k) { var r = rel[k]; return '· ' + k + ':' + (r && typeof r === 'object' ? ((r.type || r.label || '') + (r.value != null ? '(' + r.value + ')' : '')) : r); }).join('\n')); }
      }
    } catch (e) {}
    try {
      var frm = gm.factionRelationsMap;
      if (frm && frm[name] && typeof frm[name] === 'object') { var tos = Object.keys(frm[name]); if (tos.length) L.push('【' + name + ' · 势力邦交】\n' + tos.slice(0, 18).map(function (to) { var r = frm[name][to]; return '· 对' + to + ':' + ((r && (r.type || r.desc)) || '') + (r && r.value != null ? '(' + r.value + ')' : ''); }).join('\n')); }
    } catch (e) {}
    if (!L.length) return '(' + name + ' 暂无结构化关系数据·可 inspect_entity 看其完整记录)';
    return L.join('\n\n');
  }

  // ───────── 工具定义 + 派发 ─────────

  var DEFS = [
    { name: 'get_overview', description: '速览当前局面(回合/国库/人口/各类实体数/近期大事)。开局先看它把握大局。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'get_field', description: '读取存档任意字段(按路径·万能兜底)。路径如 "guoku"/"chars.0.name"/"facs"。要确认某个具体数值/字段时调用。', parameters: { type: 'object', properties: { path: { type: 'string', description: 'GM 下的字段路径' } }, required: ['path'] } },
    { name: 'list_entities', description: '列出某类实体的索引(每条一行摘要)。kind: chars/factions/provinces/armies/events/memorials/edicts/wars/relations。要纵览某一类时调用。', parameters: { type: 'object', properties: { kind: { type: 'string' }, limit: { type: 'number' } }, required: ['kind'] } },
    { name: 'inspect_entity', description: '细查单个实体的完整记录。要深挖某人/某势力/某地详情时调用。', parameters: { type: 'object', properties: { kind: { type: 'string' }, id: { type: 'string', description: '实体 id / 名称 / 下标' } }, required: ['kind', 'id'] } },
    { name: 'search_save', description: '全局关键词检索存档(跨人物/势力/地块/事件/奏疏…)。不确定相关内容在哪时调用。', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'recall_history', description: '按关键词检索历史先例与永久记忆,为推演找依据(复用记忆检索②)。', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    // ── 高阶聚合:一次调用充分掌握一整个维度/层面(替代多次原子读·想深入掌握时优先用) ──
    { name: 'get_dossier', description: '【一调抓全一个维度】给定 dimension·一次性汇总该维度的全部关键数据(变量+实体+相关近事)·替代多次 get_field/inspect。dimension: fiscal财政/military军事/diplomacy势力外交/personnel人事/court朝局党争/minsheng民心民生·或任意主题词(辽东/科举…会全局深查)。想充分掌握某方面时优先调它。', parameters: { type: 'object', properties: { dimension: { type: 'string', description: '维度或主题词' } }, required: ['dimension'] } },
    { name: 'read_chronicle', description: '【编年长期事势】读跨回合的长期大事表(进行中+近完成:科举/诏令/工程/条约/势力博弈等)·把握有哪些跨回合的线在推进·须续接勿当没发生。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'read_records', description: '【回顾往事·深取记忆】读过往记录。kind=shiji 史记(实录/时政/君心);kind=qiju 起居注+御批回听;kind=memory **深取固化记忆**(超出默认窗口的早期回合·压缩≠删·可主动查全·支持 fromTurn/toTurn 查特定旧时段)。count=条数(默认5·memory 默认更多)。要承接前文/查早期主线/体察君上往昔意志时调。', parameters: { type: 'object', properties: { kind: { type: 'string', description: 'shiji / qiju / memory' }, count: { type: 'number' }, fromTurn: { type: 'number', description: 'memory:起始回合(查旧时段)' }, toTurn: { type: 'number', description: 'memory:结束回合' } }, required: [] } },
    { name: 'get_relations', description: '【关系网】查某人/某势力的关系网(人际关系 + 势力邦交)·一把抓其盟友/敌对/恩怨。推演社会/朋党/邦交动态、谁会帮谁、谁会反谁时调。', parameters: { type: 'object', properties: { name: { type: 'string', description: '人物名或势力名' } }, required: ['name'] } }
  ];

  DEFS.push({ name: 'read_memory', description: '根据记忆 ID 展开证据与来源，不得编造 ID。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 } }, required: ['ids'] } },
    { name: 'recall_related', description: '沿记忆因果、解决与矛盾关系追查一跳关联证据。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 } }, required: ['ids'] } });
  var SPECS = DEFS.map(function (d) { return Object.assign({}, d, { effect: 'read', domain: 'runtime-observe', pack: 'runtime-read', risk: 'low', idempotent: true }); });
  var REGISTRY = (TM.AgentKernel && TM.AgentKernel.createRegistry) ? TM.AgentKernel.createRegistry(SPECS) : null;
  var TOOL_SET = {};
  SPECS.forEach(function (d) { TOOL_SET[d.name] = true; });

  // handle(name, input, ctx) → {ok, name, text}·async(recall 复用②是异步)
  async function handle(name, input, ctx) {
    input = input || {};
    var gm = _GM(ctx);
    try {
      if (TM.MemoryModeBridge && TM.MemoryModeBridge.isRead(name)) return await TM.MemoryModeBridge.read(name, input, ctx);
      switch (name) {
        case 'get_overview':   return { ok: true, name: name, text: _getOverview(gm) };
        case 'get_field':      return { ok: true, name: name, text: _getField(gm, input.path) };
        case 'list_entities':  return { ok: true, name: name, text: _listEntities(gm, input.kind, input.limit) };
        case 'inspect_entity': return { ok: true, name: name, text: _inspectEntity(gm, input.kind, input.id) };
        case 'search_save':    return { ok: true, name: name, text: _searchSave(gm, input.query) };
        case 'recall_history': return { ok: true, name: name, text: await _recallHistory(gm, input.query) };
        case 'get_dossier':    return { ok: true, name: name, text: _getDossier(gm, input.dimension) };
        case 'read_chronicle': return { ok: true, name: name, text: _readChronicle(gm) };
        case 'read_records':   return { ok: true, name: name, text: _readRecords(gm, input.kind, input.count, input.fromTurn, input.toTurn) };
        case 'get_relations':  return { ok: true, name: name, text: _getRelations(gm, input.name) };
        default:               return { ok: false, name: name, text: '(未知只读工具:' + name + ')' };
      }
    } catch (e) {
      return { ok: false, name: name, text: '(只读工具异常:' + (e && e.message) + ')' };
    }
  }

  function defs() { return REGISTRY ? REGISTRY.defs() : DEFS.slice(); }
  function specs() { return REGISTRY ? REGISTRY.list() : SPECS.slice(); }
  function isToolName(name) { return Object.prototype.hasOwnProperty.call(TOOL_SET, name); }

  TM.Endturn.AgentReadTools = {
    defs: defs,
    DEFS: DEFS,
    SPECS: SPECS,
    specs: specs,
    registry: REGISTRY,
    handle: handle,
    isToolName: isToolName,
    KIND_KEYS: KIND_KEYS
  };
})(typeof window !== 'undefined' ? window : globalThis);
