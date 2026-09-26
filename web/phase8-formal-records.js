// phase8-formal-records.js·history records surface (史/记/注/编年)
// split from phase8-formal-bridge.js·2026-05-26·Wave 1
// paradigm·head alias 块 / body 0 改动 / 跨闭包 helper 通过 bridge._xxx 引

(function(){
  'use strict';

  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-records] TMPhase8FormalBridge not init·bridge.js 必须先 load');
    return;
  }

  var state = bridge._state || window.TM_PHASE8_FORMAL;

  // ── alias 块·从主 bridge 引入 helper (body 0 改动 paradigm) ────────
  var esc = bridge._esc;
  var attr = bridge._attr;
  var getTurnText = bridge._getTurnText;
  var firstArray = bridge._firstArray;
  var actionBtn = bridge._actionBtn;
  var actionChip = bridge._actionChip;
  var renderActionStats = bridge._renderActionStats;
  var collectRecentEvents = bridge._collectRecentEvents;

  // ── records-private helpers (body 0 改动 from bridge.js) ─────────

  function fullRecordText(s, fallback, cls){
    var text = String(s == null ? '' : s).replace(/\r\n/g, '\n').trim();
    if (!text) text = String(fallback || '');
    return '<span class="records-fulltext-v5 ' + attr(cls || '') + '">' + esc(text) + '</span>';
  }

  function formalGroupBy(rows, fn){
    return rows.reduce(function(out, row){
      var key = fn(row) || '未分组';
      (out[key] || (out[key] = [])).push(row);
      return out;
    }, {});
  }

  function formalRecordText(x){
    if (!x) return '';
    if (typeof x === 'string') return x;
    return x.fullText || x.rawText || x.sourceText || x.zhengwen || x.content || x.text || x.detail || x.body || x.summary || x.desc || x.description || x.narrative || x.result || '';
  }

  function formalRecordDate(x, turn){
    x = x || {};
    return x.time || x.date || x.raisedDate || x.resolvedDate || x.year || getTurnText(turn || x.turn || ((window.GM && GM.turn) || 1));
  }

  function formalLooseText(x){
    return String(x || '').replace(/\s|　/g, '');
  }

  function formalRowNeedle(row){
    return [row.title, row.type, row.source, row.actor, row.date, row.text, (row.tags || []).join(' '), row.status].filter(Boolean).join(' ');
  }

  function formalFilterRows(rows){
    var q = String(state.recordSearch || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(function(row){ return formalRowNeedle(row).toLowerCase().indexOf(q) >= 0; });
  }

  function formalRecordSort(rows){
    return rows.sort(function(a, b){
      var dt = Number(b.turn || 0) - Number(a.turn || 0);
      if (dt) return dt;
      return Number(b.seq || 0) - Number(a.seq || 0);
    });
  }

  function formalShijiType(sj){
    var txt = [sj.shizhengji, sj.shilu, sj.szjTitle, sj.turnSummary, sj.szjSummary].join(' ');
    if (/战|兵|军|边|攻城|受陷|大捷|出师/.test(txt)) return '战事';
    if (/崩|薨|卒|病死|自尽|遇害/.test(txt)) return '人物';
    if (/旱|洪|疫|灾|异|地震|雪|蝗/.test(txt)) return '灾异';
    if (/党|弹劾|阉党|东林|朋党/.test(txt)) return '党争';
    if (/赋|税|银|钱|粮|财政|国库/.test(txt)) return '财政';
    return '时政';
  }

  function formalShijiTags(sj){
    var tags = [formalShijiType(sj)];
    var txt = [sj.shizhengji, sj.shilu, sj.szjTitle, sj.turnSummary, sj.szjSummary].join(' ');
    if (/战|兵|军|边/.test(txt)) tags.push('军务');
    if (/官|任|罢|升|贬|人物/.test(txt) || (Array.isArray(sj.personnel) && sj.personnel.length)) tags.push('人事');
    if (/灾|疫|旱|洪|蝗|异/.test(txt)) tags.push('灾异');
    if (/党|弹劾/.test(txt)) tags.push('党争');
    return tags.filter(function(t, i, arr){ return t && arr.indexOf(t) === i; });
  }

  function formalShijiRows(){
    var gm = window.GM || {};
    var rows = [];
    if (Array.isArray(gm.shijiHistory)) {
      gm.shijiHistory.forEach(function(sj, i){
        sj = sj || {};
        var turn = Number(sj.turn || (i + 1));
        var parts = [
          sj.turnSummary || sj.szjSummary || '',
          sj.shizhengji || '',
          sj.shilu || '',
          sj.shizhengji2 || '',
          sj.qijuHistory || '',
          sj.yupiHuiting || ''
        ].filter(Boolean);
        rows.push({
          id: 'shiji-' + i,
          kind: 'shiji',
          rawIndex: i,
          raw: sj,
          turn: turn,
          seq: i,
          date: formalRecordDate(sj, turn),
          type: formalShijiType(sj),
          title: sj.szjTitle || sj.turnSummary || ('第 ' + turn + ' 回合史记'),
          text: parts.join('\n\n') || formalRecordText(sj),
          tags: formalShijiTags(sj),
          source: '史记',
          seal: '史'
        });
      });
    }
    return formalRecordSort(rows);
  }

  function formalQijuNormalize(r){
    r = r || {};
    var fullDirect = r.fullText || r.rawText || r.sourceText || '';
    if (fullDirect) return { text: fullDirect, cat: r.category || r.type || '叙事' };
    if (typeof window._qijuNormalize === 'function') {
      try {
        var old = window._qijuNormalize(r);
        if (old && old.text) return old;
      } catch(_) {}
    }
    var text = '';
    var cat = r.category || '';
    if (r.edicts) {
      var parts = [];
      if (r.edicts.political) parts.push('政：' + r.edicts.political);
      if (r.edicts.military) parts.push('军：' + r.edicts.military);
      if (r.edicts.diplomatic) parts.push('外：' + r.edicts.diplomatic);
      if (r.edicts.economic) parts.push('经：' + r.edicts.economic);
      if (r.edicts.other) parts.push('其余：' + r.edicts.other);
      if (parts.length) { text += parts.join('\n'); cat = cat || '诏令'; }
      if (r.xinglu) { text += (text ? '\n' : '') + '【行止】' + r.xinglu; cat = cat || '行止'; }
    }
    if (!text && r.zhengwen) { text = r.zhengwen; cat = cat || '叙事'; }
    if (!text) text = formalRecordText(r);
    if (!cat) {
      if (/【鸿雁|【驿递|书信/.test(text)) cat = '鸿雁';
      else if (/【朝议|【常朝|廷议|经筵/.test(text)) cat = '朝议';
      else if (/【奏疏|批复|朱批/.test(text)) cat = '奏疏';
      else if (/【诏令|【敕令|诏曰/.test(text)) cat = '诏令';
      else if (/【行止|起居/.test(text)) cat = '行止';
      else if (/【任命|【启程|【赴任|人物|召见/.test(text)) cat = '人事';
      else cat = '叙事';
    }
    return { text: text || '暂无内容', cat: cat || '叙事' };
  }

  function formalQijuRows(){
    var gm = window.GM || {};
    return formalRecordSort((Array.isArray(gm.qijuHistory) ? gm.qijuHistory : []).map(function(r, i){
      var n = formalQijuNormalize(r);
      var turn = Number(r.turn || 0);
      return {
        id: 'qiju-' + i,
        kind: 'qiju',
        rawIndex: i,
        raw: r,
        turn: turn,
        seq: i,
        date: formalRecordDate(r, turn),
        type: n.cat,
        title: n.cat + ' · 第 ' + (turn || '?') + ' 回合',
        text: n.text,
        annotation: r._annotation || '',
        tags: [n.cat].concat(r.tags || []),
        source: '起居注',
        seal: '注'
      };
    }));
  }

  function formalJishiSource(r){
    if (typeof window._jishiSource === 'function') {
      try { return window._jishiSource(r); } catch(_) {}
    }
    var mode = r && r.mode || '';
    var ps = r && r.playerSaid || '';
    if (mode === 'changchao') return { key:'changchao', label:'常朝', icon:'朝' };
    if (mode === 'yuqian') return { key:'yuqian', label:'御前会议', icon:'御' };
    if (mode === 'tinyi' || mode === 'tingyi') return { key:'tingyi', label:'廷议', icon:'廷' };
    if (mode === 'keyi') return { key:'keyi', label:'科议', icon:'科' };
    if (mode === 'jingyan') return { key:'jingyan', label:'经筵', icon:'经' };
    if (mode === 'private') return { key:'private', label:'问对·私下', icon:'私' };
    if (mode === 'formal') return { key:'formal', label:'问对·正式', icon:'殿' };
    if (/抗疏/.test(ps)) return { key:'kangshu', label:'抗疏', icon:'抗' };
    if (/奏疏/.test(ps)) return { key:'memo', label:'奏疏', icon:'奏' };
    if (/鸿雁|书函|来函|书信/.test(ps)) return { key:'letter', label:'鸿雁', icon:'雁' };
    if (/密报|东厂|侦询/.test(ps)) return { key:'mibao', label:'密报', icon:'密' };
    if (/求见/.test(ps)) return { key:'audience', label:'求见', icon:'见' };
    return { key:'record', label:'杂录', icon:'录' };
  }

  function formalJishiRows(){
    var gm = window.GM || {};
    return formalRecordSort((Array.isArray(gm.jishiRecords) ? gm.jishiRecords : []).map(function(r, i){
      r = r || {};
      var src = formalJishiSource(r);
      var turn = Number(r.turn || 0);
      var parts = [];
      if (r.topic) parts.push('议题：' + r.topic);
      if (r.playerSaid) parts.push('上：' + r.playerSaid);
      if (r.npcSaid) parts.push((r.char || '对方') + '：' + r.npcSaid);
      if (r.outcome || r.finalRuling || r.decree || r.approval) parts.push('结论：' + (r.outcome || r.finalRuling || r.decree || r.approval));
      return {
        id: 'jishi-' + i,
        kind: 'jishi',
        rawIndex: i,
        raw: r,
        turn: turn,
        seq: i,
        date: formalRecordDate(r, turn),
        type: src.label,
        title: (r.char || r.from || '纪事') + (r.topic ? ' · ' + r.topic : ''),
        text: parts.join('\n') || formalRecordText(r),
        actor: r.char || r.from || '',
        mood: r.mood || '',
        starred: !!r._starred,
        tags: [src.label].concat(r._starred ? ['要事'] : []),
        source: src.label,
        seal: src.icon || '录'
      };
    }));
  }

  /* 编年 active 行 type 英文枚举→中文(原 changchao_pending/scheme/project 等英文当 chip 显示且致中文筛选失配·category 优先·镜像永久编年 c.category||c.type 范式) */
  var CHRONICLE_TYPE_CN={keju:'科举',edict:'诏令',scheme:'阴谋',project:'工程',pending_memorial:'奏疏留中',faction_treaty:'势力约期',npc_action:'长期行动',tingyi_pending:'廷议待落实',chaoyi_pending:'朝议待执行',changchao_pending:'常朝待落实',dynasty_event:'朝代大事',other:'长期事势'};
  function _chronicleTypeCN(t){return (t&&t.category)||(t&&CHRONICLE_TYPE_CN[t.type])||(t&&t.type)||'长期事势';}
  function formalBiannianActiveRows(){
    var gm = window.GM || {};
    var rows = [];
    try {
      if (window.ChronicleTracker && typeof window.ChronicleTracker.getVisible === 'function') {
        rows = rows.concat((window.ChronicleTracker.getVisible() || []).map(function(t, i){
          t = t || {};
          return {
            id: t.id || ('bn-track-' + i),
            kind: 'biannian-active',
            turn: Number(t.startTurn || t.turn || 0),
            date: formalRecordDate(t, t.startTurn || t.turn),
            type: _chronicleTypeCN(t),
            title: t.title || t.name || '长期事势',
            text: t.narrative || t.content || t.desc || '',
            actor: t.actor || t.owner || '',
            status: t.currentStage || t.stage || t.status || '推进中',
            progress: Math.max(0, Math.min(100, Number(t.progress || t.progressPercent || 0) || 0)),
            tags: [_chronicleTypeCN(t)],
            source: '编年',
            seal: '势'
          };
        }));
      }
    } catch(_) {}
    (Array.isArray(gm.biannianItems) ? gm.biannianItems : []).forEach(function(item, i){
      item = item || {};
      var start = Number(item.startTurn || item.turn || gm.turn || 1);
      var duration = Number(item.duration || item.expectedTurns || 1) || 1;
      var elapsed = Math.max(0, Number(gm.turn || start) - start);
      if (item._resolved || item.completed || elapsed >= duration) return;
      rows.push({
        id: item.id || ('bn-active-' + i),
        kind: 'biannian-active',
        turn: start,
        date: formalRecordDate(item, start),
        type: item.type || item.category || '长期事项',
        title: item.title || item.name || '长期事项',
        text: item.content || item.desc || item.description || '',
        actor: item.actor || item.owner || item.assignee || '',
        status: item.stage || item.status || '进行中',
        progress: Math.max(0, Math.min(100, Number(item.progress || item.progressPercent || Math.round(elapsed / duration * 100)) || 0)),
        tags: [item.type || item.category || '长期事项'],
        source: '编年',
        seal: '势'
      });
    });
    return formalRecordSort(rows);
  }

  function formalBiannianRows(){
    var gm = window.GM || {};
    var rows = [];
    (Array.isArray(gm._chronicle) ? gm._chronicle : []).forEach(function(c, i){
      c = c || {};
      var turn = Number(c.turn || 0);
      rows.push({
        id: c.id || ('bn-chronicle-' + i),
        kind: 'biannian',
        raw: c,
        turn: turn,
        seq: i,
        date: formalRecordDate(c, turn),
        type: c.category || c.type || '史册',
        title: c.title || c.name || '编年条目',
        text: c.content || c.text || c.desc || '',
        tags: [c.category || c.type || '史册'],
        source: '永久编年',
        seal: '年'
      });
    });
    return formalRecordSort(rows);
  }

  // ── render functions (body 0 改动 from bridge.js) ────────────────

  function renderRecordCard(row, archiveKind){
    var id = row.id || row.title || '';
    var active = String(id) === String(state.recordId || '');
    var tags = (row.tags || []).filter(Boolean).slice(0, 6);
    var hot = /灾|败|危|急|乱|崩|战|叛|死|降/.test([row.type, row.title, row.text].join(''));
    var meta = [row.date, row.type, row.actor, row.status, row.source].filter(Boolean).join(' · ');
    var actions = actionBtn('展阅', 'select-record-desk', { id:id }, 'tm-mini-btn green');
    if (row.kind === 'shiji') actions += actionBtn('打开原卷', 'record-open-shiji-desk', { id:id }, 'tm-mini-btn');
    if (row.kind === 'qiju') actions += actionBtn('御批', 'record-annotate-desk', { id:id }, 'tm-mini-btn');
    if (row.kind === 'jishi') actions += actionBtn(row.starred ? '取消星标' : '标为要事', 'record-star-desk', { id:id }, 'tm-mini-btn');
    actions += actionBtn(archiveKind === 'jishi' ? '编入纪事' : archiveKind === 'biannian' ? '转为编年' : '收入实录', 'record-archive-desk', { record:archiveKind || 'shilu' }, 'tm-mini-btn');
    return '<article class="records-entry-v5 ' + (active ? 'active ' : '') + (hot ? 'hot' : '') + '" data-record-search-text="' + attr(formalRowNeedle(row)) + '">' +
      '<header><span class="records-seal-v5">' + esc(row.seal || '史') + '</span><span class="records-entry-main-v5"><b>' + fullRecordText(row.title || '未题', '未题', 'records-title-full-v5') + '</b><em>' + fullRecordText(meta || '未署年月', '未署年月', 'records-meta-full-v5') + '</em></span></header>' +
      '<div class="records-entry-body-v5">' + fullRecordText(row.text || '暂无详情。', '暂无详情。', 'records-body-full-v5') + '</div>' +
      (row.annotation ? '<div class="records-annot-v5"><b>御批</b><p>' + fullRecordText(row.annotation, '暂无御批。', 'records-annotation-full-v5') + '</p></div>' : '') +
      (tags.length ? '<div class="tm-chip-row">' + tags.map(function(t){ return actionChip(t, /要事|灾|危|急|战|乱/.test(String(t)) ? 'hot' : ''); }).join('') + '</div>' : '') +
      '<div class="records-card-actions">' + actions + '</div></article>';
  }

  function renderRecordGroup(title, rows, archiveKind, note){
    if (!rows.length) return '';
    return '<section class="records-section-v5" data-record-group><h3 class="records-section-title-v5"><span>' + esc(title) + '</span><small>' + esc(note || (rows.length + ' 条')) + '</small></h3>' + rows.map(function(r){ return renderRecordCard(r, archiveKind); }).join('') + '</section>';
  }

  function renderRecordFilterButtons(options, key, current){
    return '<div class="records-filter-v5">' + options.map(function(t){
      return '<button type="button" class="' + (current === t ? 'active' : '') + '" data-desk-action="record-filter-desk" data-key="' + attr(key) + '" data-value="' + attr(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
  }

  function renderFormalRecordShiji(){
    var events = formalShijiRows();
    var type = state.recordTypeFilter || '全部';
    var types = ['全部','时政','战事','党争','灾异','人物','财政'];
    var rows = formalFilterRows(events).filter(function(r){ return type === '全部' || String(r.type).indexOf(type) >= 0 || (r.tags || []).indexOf(type) >= 0; });
    var groups = formalGroupBy(rows, function(r){ return getTurnText(r.turn); });
    var body = Object.keys(groups).sort(function(a,b){ return Number((groups[b][0] || {}).turn || 0) - Number((groups[a][0] || {}).turn || 0); }).map(function(g){
      return renderRecordGroup(g, groups[g], 'shilu');
    }).join('');
    return renderActionStats([['史记回合', firstArray((window.GM || {}).shijiHistory).length], ['当前显示', rows.length], ['战事', events.filter(function(x){ return /战|军|兵|边/.test((x.type || '') + (x.tags || []).join('')); }).length], ['人事', events.filter(function(x){ return /人|官|任|升|罢/.test((x.type || '') + (x.tags || []).join('')); }).length], ['数据源', 'GM.shijiHistory']]) + renderRecordFilterButtons(types, 'recordTypeFilter', type) + (body || '<div class="records-empty-v5">无匹配史记。史记只收录过回合后的回合推演结果。</div>');
  }

  function renderFormalRecordQiju(){
    var events = formalQijuRows();
    var cats = ['全部','诏令','奏疏','朝议','鸿雁','人事','行止','叙事'];
    var cat = state.qijuCat || '全部';
    var sort = state.qijuSort || '近前';
    var annotOnly = state.qijuAnnotOnly === '只看御批';
    var rows = formalFilterRows(events).filter(function(r){ return cat === '全部' || r.type === cat || (r.tags || []).indexOf(cat) >= 0; });
    if (annotOnly) rows = rows.filter(function(r){ return !!r.annotation; });
    if (sort === '从旧到新') rows = rows.slice().reverse();
    if (sort === '御批优先') rows = rows.slice().sort(function(a, b){ return (b.annotation ? 1 : 0) - (a.annotation ? 1 : 0) || Number(b.turn || 0) - Number(a.turn || 0); });
    var groups = formalGroupBy(rows, function(r){ return '第 ' + (r.turn || '?') + ' 回合' + (r.date ? ' · ' + r.date : ''); });
    var body = Object.keys(groups).map(function(g){
      return renderRecordGroup(g, groups[g], 'shilu', '按日列注');
    }).join('');
    return renderActionStats([['起居注', events.length], ['当前显示', rows.length], ['诏令', events.filter(function(x){ return x.type === '诏令'; }).length], ['奏疏', events.filter(function(x){ return x.type === '奏疏'; }).length], ['御批', events.filter(function(x){ return x.annotation; }).length]]) + renderRecordFilterButtons(cats, 'qijuCat', cat) + renderRecordFilterButtons(['近前','从旧到新','御批优先'], 'qijuSort', sort) + renderRecordFilterButtons(['全部条目','只看御批'], 'qijuAnnotOnly', annotOnly ? '只看御批' : '全部条目') + (body || '<div class="records-empty-v5">无匹配起居注。调整筛选或搜索后再试。</div>');
  }

  function renderFormalRecordJishi(){
    var events = formalJishiRows();
    var sources = ['全部','常朝','御前会议','廷议','科议','经筵','问对·正式','问对·私下','奏疏','抗疏','鸿雁','求见','密报','杂录'];
    var source = state.jishiSource || '全部';
    var view = state.jishiView || '按时间';
    var rows = formalFilterRows(events).filter(function(r){ return source === '全部' || formalLooseText(r.source) === formalLooseText(source) || formalLooseText(r.type) === formalLooseText(source); });
    var groups = formalGroupBy(rows, function(r){
      if (view === '按人物') return r.actor || '未署人物';
      if (view === '按事类') return r.source || r.type || '杂录';
      return '第 ' + (r.turn || '?') + ' 回合' + (r.date ? ' · ' + r.date : '');
    });
    var body = Object.keys(groups).map(function(g){
      return renderRecordGroup(g, groups[g], 'jishi');
    }).join('');
    var uniqueChars = {};
    events.forEach(function(r){ if (r.actor) uniqueChars[r.actor] = 1; });
    return renderActionStats([['纪事', events.length], ['当前显示', rows.length], ['涉及人物', Object.keys(uniqueChars).length], ['星标要事', events.filter(function(x){ return x.starred; }).length], ['来源类', Object.keys(formalGroupBy(events, function(r){ return r.source; })).length]]) + renderRecordFilterButtons(['按时间','按人物','按事类'], 'jishiView', view) + renderRecordFilterButtons(sources, 'jishiSource', source) + (body || '<div class="records-empty-v5">无匹配纪事。调整来源或搜索后再试。</div>');
  }

  function renderBiannianActiveCard(row){
    var progress = Math.max(0, Math.min(100, Number(row.progress || 0) || 0));
    return '<article class="bn-affair-v5" data-record-search-text="' + attr(formalRowNeedle(row)) + '"><header><span class="records-seal-v5">' + esc(row.seal || '势') + '</span><span><b>' + fullRecordText(row.title || '长期事势', '长期事势', 'records-bn-title-full-v5') + '</b><em>' + fullRecordText([row.actor || '有司', row.status || '推进中', row.date].filter(Boolean).join(' · '), '推进中', 'records-bn-meta-full-v5') + '</em></span></header><p>' + fullRecordText(row.text || '此事仍在推进，后续回合会继续影响朝野局势。', '此事仍在推进，后续回合会继续影响朝野局势。', 'records-bn-body-full-v5') + '</p><div class="bn-progress-v5"><i style="width:' + progress + '%"></i></div><div class="tm-chip-row">' + actionChip('进度 ' + progress + '%', progress >= 70 ? 'green' : '') + (row.type ? actionChip(row.type) : '') + '</div></article>';
  }

  function renderFormalRecordBiannian(){
    var activeRows = formalFilterRows(formalBiannianActiveRows());
    var events = formalBiannianRows();
    var filter = state.biannianFilter || '全部';
    var filters = ['全部','进行中','已毕','长期事项','史册','朝代事件'];
    var rows = formalFilterRows(events).filter(function(r){ return filter === '全部' || String((r.tags || []).join(' ') + r.type + r.status + r.source).indexOf(filter) >= 0; });
    var activeHtml = activeRows.length ? activeRows.map(renderBiannianActiveCard).join('') : '<article class="bn-affair-v5"><header><span class="records-seal-v5">势</span><span><b>暂无进行中事势</b><em>工程、军务、财赋改革、外交、暗线会在此处延续</em></span></header><p>当诏令、奏疏、朝议或 AI 推演形成跨回合事项后，会进入编年长期追踪。</p><div class="bn-progress-v5"><i style="width:0%"></i></div></article>';
    var groups = formalGroupBy(rows, function(r){ return r.date || getTurnText(r.turn); });
    var chronicle = Object.keys(groups).map(function(g){
      return renderRecordGroup(g, groups[g], 'biannian');
    }).join('');
    return renderActionStats([['长期事势', activeRows.length], ['编年条目', events.length], ['当前显示', rows.length], ['进行中', events.filter(function(x){ return (x.tags || []).indexOf('进行中') >= 0; }).length], ['永久史册', events.filter(function(x){ return x.source === '永久编年'; }).length]]) + renderRecordFilterButtons(filters, 'biannianFilter', filter) + '<section class="records-section-v5" data-record-group><h3 class="records-section-title-v5"><span>长期事势</span><small>' + esc(activeRows.length) + ' 件</small></h3><div class="bn-active-grid-v5">' + activeHtml + '</div></section>' + (chronicle || '<div class="records-empty-v5">暂无编年条目。</div>');
  }

  function installShiguanYuanStyles(){
    var st = document.getElementById('tm-shiguan-yuan-style');
    if (!st) { st = document.createElement('style'); st.id = 'tm-shiguan-yuan-style'; document.head.appendChild(st); }
    var __css = 'body.tm-phase8-formal .shi-yuan{--desk-1:#dccca6;--desk-2:#c6b083;--desk-3:#a78f68;  --silk-hi:#fffdf3;--silk:#f6efda;--silk-lo:#ece1c6;--silk-edge:#dcc99c;  --paper:#fcf7ec;--ink:#241d15;--ink-soft:#574733;--ink-faint:#9c8b6b;  --gold-hi:#d8b96a;--gold:#a8833a;--gold-d:#7d5e22;  --cinnabar:#a83228;--cinnabar-hi:#c64a3e;--cinnabar-d:#7a2018;  --jade:#557f6f;--jade-hi:#6fa291;--indigo:#4a5e8a;--indigo-hi:#6a7eaa;--violet:#7c6a90;--amber:#b98b2f;  --vermilion:#b83a2b;--seal-faith:#a83228;--seal-doubt:#5c4a2e;--seal-rumor:#9c8b6b;  --rule-red:rgba(168,50,40,0.16);--rule-ink:rgba(80,60,36,0.1);  --font:"STKaiti","KaiTi","楷体","Noto Serif SC","STSong",serif;  --font-doc:"FangSong","STFangsong","仿宋","Noto Serif SC",serif;}body.tm-phase8-formal .shi-yuan *{box-sizing:border-box;margin:0;padding:0;}body.tm-phase8-formal .shi-yuan{font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased;overflow:hidden;  background:radial-gradient(46% 36% at 50% -4%,rgba(255,238,196,0.5),transparent 70%),radial-gradient(60% 50% at 18% 24%,rgba(120,100,70,0.13),transparent 60%),radial-gradient(52% 60% at 86% 76%,rgba(80,60,40,0.16),transparent 55%),radial-gradient(120% 120% at 50% 28%,var(--desk-1),var(--desk-2) 54%,var(--desk-3) 100%);;height:100%;display:flex;flex-direction:column;padding:13px 18px;}body.tm-phase8-formal .shi-yuan::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0.55;background:radial-gradient(66% 48% at 50% -2%,rgba(255,239,196,0.38),transparent 60%),radial-gradient(150% 130% at 50% 50%,transparent 58%,rgba(48,34,18,0.46) 100%);}body.tm-phase8-formal .shi-yuan .shi-titlebar{flex:0 0 auto;position:relative;display:flex;align-items:center;justify-content:center;padding:3px 0 10px;margin-bottom:8px;}body.tm-phase8-formal .shi-yuan .shi-titlebar::after{content:"";position:absolute;left:6%;right:6%;bottom:2px;height:1px;background:linear-gradient(90deg,transparent,rgba(216,185,106,0.75) 22%,rgba(216,185,106,0.75) 78%,transparent);}body.tm-phase8-formal .shi-yuan .shi-titlebar::before{content:"";position:absolute;left:6%;right:6%;bottom:5px;height:1px;background:linear-gradient(90deg,transparent,rgba(168,131,58,0.32) 30%,rgba(168,131,58,0.32) 70%,transparent);}body.tm-phase8-formal .shi-yuan .st-main{font-size:calc(23 * var(--tm-px, 1px));font-weight:bold;letter-spacing:0.32em;color:var(--ink);text-shadow:0 1px 0 rgba(255,255,255,0.7),0 2px 4px rgba(120,90,36,0.26),0 0 16px rgba(216,185,106,0.24);}body.tm-phase8-formal .shi-yuan .st-main::before,body.tm-phase8-formal .shi-yuan .st-main::after{content:"";display:inline-block;width:26px;height:1px;vertical-align:0.34em;margin:0 14px;background:linear-gradient(90deg,transparent,var(--gold));}body.tm-phase8-formal .shi-yuan .st-main::after{background:linear-gradient(90deg,var(--gold),transparent);}body.tm-phase8-formal .shi-yuan .st-sub{font-size:calc(11.5 * var(--tm-px, 1px));color:var(--ink-faint);letter-spacing:0.3em;margin-top:4px;}body.tm-phase8-formal .shi-yuan .st-sub::before,body.tm-phase8-formal .shi-yuan .st-sub::after{content:"❖";font-size:calc(9 * var(--tm-px, 1px));color:var(--gold);opacity:0.62;vertical-align:0.22em;margin:0 9px;}body.tm-phase8-formal .shi-yuan .shi-chips{position:absolute;right:2px;top:5px;display:flex;gap:7px;}body.tm-phase8-formal .shi-yuan .chip{font-size:calc(12 * var(--tm-px, 1px));letter-spacing:0.05em;padding:3px 10px;border-radius:11px;border:1px solid var(--gold-d);background:rgba(255,250,235,0.7);color:var(--ink-soft);white-space:nowrap;}body.tm-phase8-formal .shi-yuan .chip.hot{border-color:var(--cinnabar);color:#fff;background:linear-gradient(160deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .shi-yuan .chip.green{border-color:var(--jade);color:#23463a;background:rgba(111,162,145,0.22);}body.tm-phase8-formal .shi-yuan .global-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;margin-bottom:9px;}body.tm-phase8-formal .shi-yuan .gsearch{position:relative;flex:1;}body.tm-phase8-formal .shi-yuan .gsearch input{width:100%;font-family:var(--font);font-size:calc(13 * var(--tm-px, 1px));color:var(--ink);padding:9px 13px 9px 36px;border:1px solid rgba(168,131,58,0.36);border-radius:9px;background:rgba(255,252,242,0.78);outline:none;transition:border-color .15s,box-shadow .15s;}body.tm-phase8-formal .shi-yuan .gsearch input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(168,131,58,0.1);}body.tm-phase8-formal .shi-yuan .gsearch input::placeholder{color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .gsearch::before{content:"⌕";position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:calc(17 * var(--tm-px, 1px));color:var(--gold-d);}body.tm-phase8-formal .shi-yuan .gsearch .gs-scope{position:absolute;right:11px;top:50%;transform:translateY(-50%);font-size:calc(11.5 * var(--tm-px, 1px));color:var(--ink-faint);letter-spacing:0.04em;}body.tm-phase8-formal .shi-yuan .gbtn{font-family:var(--font);font-size:calc(12 * var(--tm-px, 1px));letter-spacing:0.04em;cursor:pointer;padding:8px 15px;border-radius:9px;border:1px solid rgba(168,131,58,0.4);background:rgba(255,252,243,0.6);color:var(--ink-soft);transition:all .15s;white-space:nowrap;}body.tm-phase8-formal .shi-yuan .gbtn:hover{background:#fffdf6;border-color:var(--gold);color:var(--ink);}body.tm-phase8-formal .shi-yuan .shi-body{flex:1;min-height:0;display:flex;gap:13px;}body.tm-phase8-formal .shi-yuan .panel{min-height:0;border:1px solid rgba(168,131,58,0.2);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(255,253,243,0.46),rgba(245,236,210,0.24));box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 16px 36px -22px rgba(50,32,14,0.44);}body.tm-phase8-formal .shi-yuan .panel-hd{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:12px 14px 10px;border-bottom:1px solid rgba(168,131,58,0.18);}body.tm-phase8-formal .shi-yuan .panel-hd .seal{width:29px;height:29px;flex:0 0 auto;display:grid;place-items:center;border-radius:7px;font-size:calc(14 * var(--tm-px, 1px));color:#fff;font-weight:bold;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));border:1px solid rgba(122,32,24,0.55);box-shadow:0 2px 6px rgba(122,32,24,0.36);}body.tm-phase8-formal .shi-yuan .panel-hd b{font-size:calc(13.5 * var(--tm-px, 1px));letter-spacing:0.1em;color:var(--ink);display:block;}body.tm-phase8-formal .shi-yuan .panel-hd span{font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .nav{flex:0 0 198px;}body.tm-phase8-formal .shi-yuan .nav-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:10px 11px 8px;}body.tm-phase8-formal .shi-yuan .nav-scroll::-webkit-scrollbar{width:0;}body.tm-phase8-formal .shi-yuan .nav-sect{font-size:calc(11 * var(--tm-px, 1px));letter-spacing:0.16em;color:var(--ink-faint);margin:4px 0 7px 3px;}body.tm-phase8-formal .shi-yuan .gv{position:relative;display:flex;align-items:center;gap:9px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);padding:8px 10px;border-radius:8px;border:1px solid transparent;background:transparent;margin-bottom:3px;transition:all .15s;}body.tm-phase8-formal .shi-yuan .gv:hover{background:rgba(255,253,243,0.66);}body.tm-phase8-formal .shi-yuan .gv.active{border-color:rgba(168,50,40,0.26);background:linear-gradient(180deg,#fffdf6,#fbf4e2);box-shadow:0 6px 15px -9px rgba(60,40,20,0.4);}body.tm-phase8-formal .shi-yuan .gv-g{width:26px;height:26px;flex:0 0 auto;border-radius:6px;display:grid;place-items:center;font-size:calc(13 * var(--tm-px, 1px));font-weight:bold;color:#fff;background:linear-gradient(155deg,var(--gold-hi),var(--gold-d));box-shadow:inset 0 1px 0 rgba(255,255,255,0.28);}body.tm-phase8-formal .shi-yuan .gv.active .gv-g{background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));}body.tm-phase8-formal .shi-yuan .gv b{font-size:calc(13 * var(--tm-px, 1px));letter-spacing:0.08em;color:var(--ink);flex:1;}body.tm-phase8-formal .shi-yuan .gv-n{font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .nav-div{height:1px;background:linear-gradient(90deg,transparent,rgba(168,131,58,0.3),transparent);margin:11px 2px;}body.tm-phase8-formal .shi-yuan .libcat{position:relative;display:flex;align-items:center;gap:8px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);padding:7px 10px 7px 11px;border-radius:7px;border:1px solid rgba(168,131,58,0.24);background:linear-gradient(100deg,var(--silk-hi),var(--silk) 75%,var(--silk-lo));margin-bottom:5px;transition:all .16s;overflow:hidden;}body.tm-phase8-formal .shi-yuan .libcat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--cc,var(--gold));}body.tm-phase8-formal .shi-yuan .libcat:hover{transform:translateX(2px);border-color:var(--gold);}body.tm-phase8-formal .shi-yuan .libcat.active{border-color:var(--cinnabar);box-shadow:-2px 0 0 var(--cinnabar);background:linear-gradient(100deg,#fffef7,#fbf4e0);}body.tm-phase8-formal .shi-yuan .libcat-g{width:24px;height:28px;flex:0 0 auto;border-radius:4px;display:grid;place-items:center;font-size:calc(13 * var(--tm-px, 1px));font-weight:bold;color:#fff;background:linear-gradient(160deg,var(--cc,var(--gold)),color-mix(in srgb,var(--cc,var(--gold)) 62%,#000));}body.tm-phase8-formal .shi-yuan .libcat-m{flex:1;min-width:0;}body.tm-phase8-formal .shi-yuan .libcat-m b{font-size:calc(12.5 * var(--tm-px, 1px));letter-spacing:0.08em;color:var(--ink);display:block;}body.tm-phase8-formal .shi-yuan .libcat-n{font-size:calc(11 * var(--tm-px, 1px));color:var(--gold-d);background:rgba(168,131,58,0.14);border-radius:8px;padding:0 6px;}body.tm-phase8-formal .shi-yuan .libcat.active .libcat-n{color:#fff;background:var(--cinnabar);}body.tm-phase8-formal .shi-yuan .facet{margin:10px 0 0;}body.tm-phase8-formal .shi-yuan .facet-t{font-size:calc(11 * var(--tm-px, 1px));letter-spacing:0.12em;color:var(--ink-faint);margin:0 0 5px 2px;}body.tm-phase8-formal .shi-yuan .facet-opts{display:flex;flex-wrap:wrap;gap:4px;}body.tm-phase8-formal .shi-yuan .fopt{font-family:var(--font);font-size:calc(11.5 * var(--tm-px, 1px));cursor:pointer;padding:2px 8px;border-radius:10px;border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,242,0.55);color:var(--ink-soft);transition:all .14s;display:inline-flex;align-items:center;gap:4px;}body.tm-phase8-formal .shi-yuan .fopt:hover{border-color:var(--gold);}body.tm-phase8-formal .shi-yuan .fopt.active{color:#fff;background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));border-color:var(--cinnabar-d);}body.tm-phase8-formal .shi-yuan .fopt .fn{font-size:calc(10 * var(--tm-px, 1px));opacity:0.7;}body.tm-phase8-formal .shi-yuan .nav-stat{flex:0 0 auto;border-top:1px solid rgba(168,131,58,0.2);padding:10px 13px;font-size:calc(11 * var(--tm-px, 1px));line-height:1.7;color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .nav-stat b{color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .nav-stat .ss-row{display:flex;justify-content:space-between;}body.tm-phase8-formal .shi-yuan .main{flex:1;min-width:0;}body.tm-phase8-formal .shi-yuan .main-tools{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 15px;border-bottom:1px solid rgba(168,131,58,0.16);}body.tm-phase8-formal .shi-yuan .main-title{font-size:calc(14 * var(--tm-px, 1px));letter-spacing:0.1em;color:var(--ink);font-weight:bold;}body.tm-phase8-formal .shi-yuan .main-title small{font-size:calc(11.5 * var(--tm-px, 1px));color:var(--ink-faint);font-weight:normal;margin-left:8px;letter-spacing:0.02em;}body.tm-phase8-formal .shi-yuan .cat-sort{display:flex;gap:4px;margin-left:auto;}body.tm-phase8-formal .shi-yuan .sortb{font-family:var(--font);font-size:calc(11.5 * var(--tm-px, 1px));cursor:pointer;padding:5px 10px;border-radius:7px;border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,242,0.5);color:var(--ink-soft);transition:all .14s;}body.tm-phase8-formal .shi-yuan .sortb.active{color:#fff;background:linear-gradient(150deg,var(--gold),var(--gold-d));border-color:var(--gold-d);}body.tm-phase8-formal .shi-yuan .tbtn{font-family:var(--font);font-size:calc(11.5 * var(--tm-px, 1px));cursor:pointer;padding:5px 11px;border-radius:7px;border:1px solid rgba(168,131,58,0.36);background:rgba(255,252,243,0.5);color:var(--ink-soft);transition:all .14s;white-space:nowrap;}body.tm-phase8-formal .shi-yuan .tbtn:hover{background:#fffdf6;border-color:var(--gold);}body.tm-phase8-formal .shi-yuan .cat-active{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 15px 0;}body.tm-phase8-formal .shi-yuan .cat-active:empty{display:none;}body.tm-phase8-formal .shi-yuan .afilter{font-size:calc(11 * var(--tm-px, 1px));padding:2px 8px 2px 9px;border-radius:10px;background:rgba(168,50,40,0.08);border:1px solid rgba(122,32,24,0.3);color:var(--cinnabar-d);display:inline-flex;align-items:center;gap:5px;cursor:pointer;}body.tm-phase8-formal .shi-yuan .afilter::after{content:"✕";font-size:calc(9 * var(--tm-px, 1px));opacity:0.7;}body.tm-phase8-formal .shi-yuan .cat-count{margin-left:auto;font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .main-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:9px 13px 13px;}body.tm-phase8-formal .shi-yuan .main-scroll::-webkit-scrollbar{width:0;}body.tm-phase8-formal .shi-yuan .cat-group-t{font-size:calc(11 * var(--tm-px, 1px));letter-spacing:0.14em;color:var(--ink-faint);margin:11px 2px 6px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .shi-yuan .cat-group-t:first-child{margin-top:2px;}body.tm-phase8-formal .shi-yuan .cat-group-t::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(168,131,58,0.26),transparent);}body.tm-phase8-formal .shi-yuan .entry{position:relative;display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);padding:9px 11px;border-radius:8px;border:1px solid transparent;background:transparent;margin-bottom:3px;transition:all .15s;}body.tm-phase8-formal .shi-yuan .entry:hover{background:rgba(255,253,243,0.66);transform:translateX(2px);}body.tm-phase8-formal .shi-yuan .entry.active{border-color:rgba(168,50,40,0.26);background:linear-gradient(180deg,#fffdf6,#fbf4e2);box-shadow:0 8px 20px -11px rgba(60,40,20,0.42);}body.tm-phase8-formal .shi-yuan .e-badge{flex:0 0 auto;width:32px;height:32px;border-radius:7px;display:grid;place-items:center;font-size:calc(10.5 * var(--tm-px, 1px));font-weight:bold;line-height:1.1;text-align:center;color:#fff;margin-top:1px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 2px 5px -2px rgba(60,40,20,0.4);}body.tm-phase8-formal .shi-yuan .e-badge.turn{flex-direction:column;gap:1px;}body.tm-phase8-formal .shi-yuan .e-badge.turn b{font-size:calc(12 * var(--tm-px, 1px));line-height:1;}body.tm-phase8-formal .shi-yuan .e-badge.turn span{font-size:calc(9 * var(--tm-px, 1px));opacity:0.9;}body.tm-phase8-formal .shi-yuan .e-main{flex:1;min-width:0;}body.tm-phase8-formal .shi-yuan .e-title{font-size:calc(13 * var(--tm-px, 1px));color:var(--ink);letter-spacing:0.02em;line-height:1.4;font-weight:bold;display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .shi-yuan .e-title .et-star{font-size:calc(11.5 * var(--tm-px, 1px));color:var(--gold-hi);}body.tm-phase8-formal .shi-yuan .e-meta{font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);margin-top:3px;display:flex;flex-wrap:wrap;align-items:center;gap:3px 7px;}body.tm-phase8-formal .shi-yuan .e-meta .etag{font-size:calc(10 * var(--tm-px, 1px));padding:0 6px;border-radius:7px;color:#fff;line-height:1.6;letter-spacing:0.04em;box-shadow:0 1px 3px -1px rgba(60,40,20,0.3);}body.tm-phase8-formal .shi-yuan .e-meta .src{color:var(--indigo);}body.tm-phase8-formal .shi-yuan .e-meta .dot{opacity:0.4;}body.tm-phase8-formal .shi-yuan .e-excerpt{font-family:var(--font-doc);font-size:calc(12 * var(--tm-px, 1px));color:var(--ink-faint);line-height:1.5;margin-top:3px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}body.tm-phase8-formal .shi-yuan .e-delta{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;}body.tm-phase8-formal .shi-yuan .dchip{font-size:calc(10 * var(--tm-px, 1px));padding:0 6px;border-radius:7px;border:1px solid;}body.tm-phase8-formal .shi-yuan .dchip.up{color:#2d5848;border-color:rgba(85,127,111,0.4);background:rgba(111,162,145,0.12);}body.tm-phase8-formal .shi-yuan .dchip.dn{color:var(--cinnabar-d);border-color:rgba(168,50,40,0.36);background:rgba(168,50,40,0.08);}body.tm-phase8-formal .shi-yuan .empty{padding:48px 18px;text-align:center;color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .empty b{font-size:calc(15 * var(--tm-px, 1px));letter-spacing:0.16em;color:var(--ink-soft);display:block;margin-bottom:8px;}body.tm-phase8-formal .shi-yuan .empty p{font-size:calc(12 * var(--tm-px, 1px));line-height:1.7;}body.tm-phase8-formal .shi-yuan .ov-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}body.tm-phase8-formal .shi-yuan .ov-card{border:1px solid rgba(168,131,58,0.24);border-radius:10px;padding:14px 16px;background:linear-gradient(180deg,rgba(255,253,243,0.7),rgba(246,239,218,0.5));box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 8px 18px -12px rgba(60,40,20,0.3);}body.tm-phase8-formal .shi-yuan .ov-card.wide{grid-column:1 / -1;}body.tm-phase8-formal .shi-yuan .ov-card h4{font-size:calc(12 * var(--tm-px, 1px));letter-spacing:0.12em;color:var(--ink-soft);margin-bottom:11px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .shi-yuan .ov-card h4::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--gold);}body.tm-phase8-formal .shi-yuan .ov-libs{display:flex;gap:9px;}body.tm-phase8-formal .shi-yuan .ov-lib{flex:1;text-align:center;padding:9px 4px;border-radius:8px;border:1px solid rgba(168,131,58,0.2);background:rgba(255,250,235,0.5);cursor:pointer;transition:all .15s;}body.tm-phase8-formal .shi-yuan .ov-lib:hover{border-color:var(--gold);transform:translateY(-2px);}body.tm-phase8-formal .shi-yuan .ov-lib b{display:block;font-size:calc(22 * var(--tm-px, 1px));color:var(--cinnabar-d);line-height:1;}body.tm-phase8-formal .shi-yuan .ov-lib span{font-size:calc(12 * var(--tm-px, 1px));color:var(--ink-soft);letter-spacing:0.06em;margin-top:5px;display:block;}body.tm-phase8-formal .shi-yuan .era-bars{display:flex;flex-direction:column;gap:8px;}body.tm-phase8-formal .shi-yuan .era-row{display:flex;align-items:center;gap:9px;font-size:calc(12 * var(--tm-px, 1px));}body.tm-phase8-formal .shi-yuan .era-row .er-lbl{flex:0 0 70px;color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .era-row .er-track{flex:1;height:14px;border-radius:7px;background:rgba(120,90,40,0.1);overflow:hidden;}body.tm-phase8-formal .shi-yuan .era-row .er-fill{height:100%;border-radius:7px;background:linear-gradient(90deg,var(--gold-d),var(--gold-hi));}body.tm-phase8-formal .shi-yuan .era-row .er-n{flex:0 0 auto;color:var(--ink-faint);font-size:calc(11 * var(--tm-px, 1px));}body.tm-phase8-formal .shi-yuan .auth-ring{display:flex;align-items:center;gap:16px;}body.tm-phase8-formal .shi-yuan .ring{width:84px;height:84px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;position:relative;}body.tm-phase8-formal .shi-yuan .ring::before{content:"";position:absolute;inset:9px;border-radius:50%;background:var(--paper);}body.tm-phase8-formal .shi-yuan .ring b{position:relative;font-size:calc(20 * var(--tm-px, 1px));color:var(--cinnabar-d);}body.tm-phase8-formal .shi-yuan .auth-leg{flex:1;display:flex;flex-direction:column;gap:6px;font-size:calc(12 * var(--tm-px, 1px));}body.tm-phase8-formal .shi-yuan .auth-leg .al{display:flex;align-items:center;gap:7px;color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .auth-leg .al i{width:11px;height:11px;border-radius:3px;}body.tm-phase8-formal .shi-yuan .auth-leg .al .n{margin-left:auto;color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .hot-persons{display:flex;flex-wrap:wrap;gap:7px;}body.tm-phase8-formal .shi-yuan .hotp{font-family:var(--font);font-size:calc(11.5 * var(--tm-px, 1px));cursor:pointer;padding:5px 12px;border-radius:14px;border:1px solid rgba(74,94,138,0.3);background:rgba(74,94,138,0.07);color:var(--indigo);transition:all .14s;display:inline-flex;align-items:center;gap:6px;}body.tm-phase8-formal .shi-yuan .hotp:hover{background:rgba(74,94,138,0.16);transform:translateY(-1px);}body.tm-phase8-formal .shi-yuan .hotp b{font-size:calc(11 * var(--tm-px, 1px));color:var(--gold-d);background:rgba(168,131,58,0.16);border-radius:8px;padding:0 6px;}body.tm-phase8-formal .shi-yuan .tl-era{margin-bottom:6px;}body.tm-phase8-formal .shi-yuan .tl-era-h{font-size:calc(13 * var(--tm-px, 1px));letter-spacing:0.14em;color:var(--cinnabar-d);font-weight:bold;margin:13px 0 9px;display:flex;align-items:center;gap:9px;}body.tm-phase8-formal .shi-yuan .tl-era-h::before{content:"";width:9px;height:9px;border-radius:50%;background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));box-shadow:0 0 0 3px rgba(168,50,40,0.14);}body.tm-phase8-formal .shi-yuan .tl-era-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(168,50,40,0.3),transparent);}body.tm-phase8-formal .shi-yuan .tl-item{display:flex;flex-direction:column;padding:2px 0 6px 13px;margin-left:6px;border-left:2px solid rgba(168,131,58,0.28);}body.tm-phase8-formal .shi-yuan .tl-item-in{display:flex;align-items:flex-start;gap:9px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);padding:7px 11px;border-radius:8px;border:1px solid transparent;margin:2px 0 2px -7px;transition:all .15s;}body.tm-phase8-formal .shi-yuan .tl-item-in:hover{background:rgba(255,253,243,0.66);}body.tm-phase8-formal .shi-yuan .tl-item-in.active{border-color:rgba(168,50,40,0.24);background:linear-gradient(180deg,#fffdf6,#fbf4e2);}body.tm-phase8-formal .shi-yuan .tl-date{flex:0 0 auto;font-size:calc(11 * var(--tm-px, 1px));color:var(--gold-d);background:rgba(168,131,58,0.12);border-radius:8px;padding:1px 8px;margin-top:2px;white-space:nowrap;}body.tm-phase8-formal .shi-yuan .tl-dot2{flex:0 0 auto;width:9px;height:9px;border-radius:50%;margin-top:5px;border:2px solid;}body.tm-phase8-formal .shi-yuan .tl-tx{flex:1;min-width:0;}body.tm-phase8-formal .shi-yuan .tl-tx b{font-size:calc(12.5 * var(--tm-px, 1px));color:var(--ink);font-weight:bold;}body.tm-phase8-formal .shi-yuan .tl-tx .tt-meta{font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);margin-top:2px;}body.tm-phase8-formal .shi-yuan .tl-tx .tt-meta .etag{font-size:calc(10 * var(--tm-px, 1px));padding:0 6px;border-radius:7px;color:#fff;}body.tm-phase8-formal .shi-yuan .who-list{display:flex;flex-direction:column;gap:5px;}body.tm-phase8-formal .shi-yuan .who-card{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);padding:10px 13px;border-radius:9px;border:1px solid rgba(168,131,58,0.22);background:linear-gradient(180deg,rgba(255,253,243,0.66),rgba(246,239,218,0.46));transition:all .15s;}body.tm-phase8-formal .shi-yuan .who-card:hover{border-color:var(--gold);transform:translateX(2px);box-shadow:0 6px 15px -9px rgba(60,40,20,0.34);}body.tm-phase8-formal .shi-yuan .who-card.active{border-color:var(--cinnabar);box-shadow:-2px 0 0 var(--cinnabar);}body.tm-phase8-formal .shi-yuan .who-face{width:38px;height:44px;flex:0 0 auto;border-radius:6px;display:grid;place-items:center;font-size:calc(18 * var(--tm-px, 1px));font-weight:bold;color:var(--ink-soft);background:linear-gradient(160deg,#efe3c4,#dcca9f);border:1px solid rgba(168,131,58,0.34);}body.tm-phase8-formal .shi-yuan .who-card.fac .who-face{color:#2d5848;background:linear-gradient(160deg,rgba(111,162,145,0.3),rgba(85,127,111,0.18));}body.tm-phase8-formal .shi-yuan .who-card.reg .who-face{color:var(--gold-d);background:linear-gradient(160deg,rgba(216,185,106,0.3),rgba(168,131,58,0.18));}body.tm-phase8-formal .shi-yuan .who-m{flex:1;min-width:0;}body.tm-phase8-formal .shi-yuan .who-m b{font-size:calc(14 * var(--tm-px, 1px));color:var(--ink);letter-spacing:0.04em;display:block;}body.tm-phase8-formal .shi-yuan .who-m span{font-size:calc(11.5 * var(--tm-px, 1px));color:var(--ink-faint);display:block;margin-top:2px;}body.tm-phase8-formal .shi-yuan .who-n{font-size:calc(12 * var(--tm-px, 1px));color:var(--gold-d);background:rgba(168,131,58,0.14);border:1px solid rgba(168,131,58,0.28);border-radius:10px;padding:1px 9px;}body.tm-phase8-formal .shi-yuan .lz-head{text-align:center;padding-bottom:13px;border-bottom:1px solid rgba(168,131,58,0.2);margin-bottom:13px;}body.tm-phase8-formal .shi-yuan .lz-face{width:56px;height:64px;margin:0 auto 9px;border-radius:7px;display:grid;place-items:center;font-size:calc(26 * var(--tm-px, 1px));font-weight:bold;color:var(--ink);background:linear-gradient(160deg,#efe3c4,#d9c79d);border:1px solid var(--gold-d);box-shadow:inset 0 0 0 2px rgba(255,253,243,0.55),0 3px 9px rgba(60,40,20,0.22);}body.tm-phase8-formal .shi-yuan .lz-name{font-size:calc(19 * var(--tm-px, 1px));letter-spacing:0.1em;color:var(--ink);font-weight:bold;}body.tm-phase8-formal .shi-yuan .lz-sub{font-size:calc(12 * var(--tm-px, 1px));color:var(--ink-faint);margin-top:5px;letter-spacing:0.04em;}body.tm-phase8-formal .shi-yuan .lz-grp{font-size:calc(11.5 * var(--tm-px, 1px));letter-spacing:0.14em;color:var(--ink-faint);margin:14px 0 7px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .shi-yuan .lz-grp::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--gold);}body.tm-phase8-formal .shi-yuan .lz-grp::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(168,131,58,0.26),transparent);}body.tm-phase8-formal .shi-yuan .lz-rec{display:flex;gap:9px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);padding:8px 11px;border-radius:8px;border:1px solid rgba(168,131,58,0.2);background:rgba(255,252,242,0.5);margin-bottom:5px;transition:all .14s;}body.tm-phase8-formal .shi-yuan .lz-rec:hover{border-color:var(--gold);background:#fffdf6;}body.tm-phase8-formal .shi-yuan .lz-rec .lzr-k{flex:0 0 auto;font-size:calc(10 * var(--tm-px, 1px));color:#fff;padding:1px 6px;border-radius:5px;height:fit-content;margin-top:2px;}body.tm-phase8-formal .shi-yuan .lz-rec .lzr-t{flex:1;min-width:0;font-size:calc(12 * var(--tm-px, 1px));color:var(--ink);}body.tm-phase8-formal .shi-yuan .lz-rec .lzr-t small{display:block;font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);margin-top:2px;}body.tm-phase8-formal .shi-yuan .folio{flex:0 0 400px;}body.tm-phase8-formal .shi-yuan .folio-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:17px 19px 20px;}body.tm-phase8-formal .shi-yuan .folio-scroll::-webkit-scrollbar{width:0;}body.tm-phase8-formal .shi-yuan .fo-head{display:flex;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(168,131,58,0.2);margin-bottom:13px;position:relative;}body.tm-phase8-formal .shi-yuan .fo-seal{flex:0 0 auto;width:48px;height:48px;border-radius:7px;display:grid;place-items:center;position:relative;transform:rotate(-5deg);font-size:calc(11.5 * var(--tm-px, 1px));font-weight:bold;line-height:1.1;text-align:center;}body.tm-phase8-formal .shi-yuan .fo-seal.faith{color:#fff;background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));border:1px solid rgba(122,32,24,0.5);box-shadow:0 2px 7px rgba(122,32,24,0.4);}body.tm-phase8-formal .shi-yuan .fo-seal.faith::after{content:"";position:absolute;inset:3px;border:1px solid rgba(255,255,255,0.4);border-radius:5px;}body.tm-phase8-formal .shi-yuan .fo-seal.doubt{color:var(--seal-doubt);background:rgba(92,74,46,0.07);border:1.5px solid var(--seal-doubt);box-shadow:inset 0 0 0 2px rgba(92,74,46,0.1);}body.tm-phase8-formal .shi-yuan .fo-seal.rumor{color:var(--seal-rumor);background:rgba(156,139,107,0.05);border:1.5px dashed var(--seal-rumor);box-shadow:inset 0 0 0 2px rgba(156,139,107,0.08);}body.tm-phase8-formal .shi-yuan .fo-htext{flex:1;min-width:0;}body.tm-phase8-formal .shi-yuan .fo-title{font-size:calc(17 * var(--tm-px, 1px));color:var(--ink);letter-spacing:0.03em;line-height:1.34;font-weight:bold;}body.tm-phase8-formal .shi-yuan .fo-sub{font-size:calc(11.5 * var(--tm-px, 1px));color:var(--ink-faint);margin-top:6px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;}body.tm-phase8-formal .shi-yuan .fo-sub .ftag{font-size:calc(10.5 * var(--tm-px, 1px));padding:1px 8px;border-radius:8px;color:#fff;}body.tm-phase8-formal .shi-yuan .fo-star{position:absolute;right:0;top:0;font-size:calc(16 * var(--tm-px, 1px));cursor:pointer;color:var(--gold);background:none;border:none;opacity:0.55;transition:.15s;}body.tm-phase8-formal .shi-yuan .fo-star:hover{opacity:1;transform:scale(1.1);}body.tm-phase8-formal .shi-yuan .fo-star.on{opacity:1;color:var(--gold-hi);text-shadow:0 0 8px rgba(216,185,106,0.6);}body.tm-phase8-formal .shi-yuan .tiwen{margin-bottom:11px;border-radius:8px;overflow:hidden;border:1px solid rgba(168,131,58,0.2);}body.tm-phase8-formal .shi-yuan .tiwen-lbl{display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:calc(12 * var(--tm-px, 1px));letter-spacing:0.18em;font-weight:bold;border-left:3px solid var(--tlc,var(--gold));background:rgba(255,250,236,0.72);color:var(--tlc-d,var(--ink-soft));}body.tm-phase8-formal .shi-yuan .tiwen-lbl small{margin-left:auto;font-weight:normal;font-size:calc(11 * var(--tm-px, 1px));color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .tiwen-body{font-family:var(--font-doc);font-size:calc(13 * var(--tm-px, 1px));line-height:1.95;color:var(--ink);text-align:justify;padding:12px 15px;background:rgba(255,253,247,0.5);}body.tm-phase8-formal .shi-yuan .tiwen.shilu{border-color:rgba(168,50,40,0.3);}body.tm-phase8-formal .shi-yuan .tiwen.shilu .tiwen-lbl{background:linear-gradient(100deg,var(--cinnabar),var(--cinnabar-d));color:#fff;border-left:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.18);}body.tm-phase8-formal .shi-yuan .tiwen.shilu .tiwen-body{background:repeating-linear-gradient(0deg,transparent 0 calc(1.95em - 1px),var(--rule-red) calc(1.95em - 1px) 1.95em),rgba(255,252,247,0.62);}body.tm-phase8-formal .shi-yuan .tiwen.szj .tiwen-lbl{--tlc:var(--gold);--tlc-d:var(--gold-d);}body.tm-phase8-formal .shi-yuan .tiwen.zhengwen .tiwen-lbl{--tlc:var(--indigo);--tlc-d:#33456a;}body.tm-phase8-formal .shi-yuan .tiwen.houren .tiwen-lbl{--tlc:#8a7a5c;--tlc-d:#5c4a2e;}body.tm-phase8-formal .shi-yuan .tiwen.houren .tiwen-body{font-style:italic;color:var(--ink-soft);opacity:0.92;}body.tm-phase8-formal .shi-yuan .fo-sect{margin-top:17px;}body.tm-phase8-formal .shi-yuan .fo-sect-t{font-size:calc(12 * var(--tm-px, 1px));letter-spacing:0.14em;color:var(--ink-faint);margin-bottom:8px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .shi-yuan .fo-sect-t::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--gold);}body.tm-phase8-formal .shi-yuan .fo-sect-t::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(168,131,58,0.26),transparent);}body.tm-phase8-formal .shi-yuan .personnel{display:flex;flex-direction:column;gap:5px;}body.tm-phase8-formal .shi-yuan .prow{display:flex;align-items:center;gap:9px;font-size:calc(12 * var(--tm-px, 1px));padding:5px 10px;border-radius:6px;background:rgba(255,250,235,0.5);border:1px solid rgba(168,131,58,0.2);}body.tm-phase8-formal .shi-yuan .prow .pn{font-weight:bold;color:var(--ink);}body.tm-phase8-formal .shi-yuan .prow .pc{margin-left:auto;font-size:calc(12 * var(--tm-px, 1px));padding:1px 9px;border-radius:9px;color:#fff;background:var(--indigo);}body.tm-phase8-formal .shi-yuan .delta-grid{display:flex;flex-wrap:wrap;gap:6px;}body.tm-phase8-formal .shi-yuan .dbig{display:flex;align-items:center;gap:6px;font-size:calc(11.5 * var(--tm-px, 1px));padding:4px 11px;border-radius:8px;border:1px solid;}body.tm-phase8-formal .shi-yuan .dbig.up{color:#2d5848;border-color:rgba(85,127,111,0.4);background:rgba(111,162,145,0.1);}body.tm-phase8-formal .shi-yuan .dbig.dn{color:var(--cinnabar-d);border-color:rgba(168,50,40,0.34);background:rgba(168,50,40,0.07);}body.tm-phase8-formal .shi-yuan .edict-line{font-family:var(--font-doc);font-size:calc(12 * var(--tm-px, 1px));line-height:1.7;color:var(--ink-soft);padding:6px 11px;border-radius:6px;border-left:3px solid var(--cinnabar);background:rgba(168,50,40,0.05);margin-bottom:5px;}body.tm-phase8-formal .shi-yuan .edict-line b{color:var(--cinnabar-d);font-family:var(--font);margin-right:5px;}body.tm-phase8-formal .shi-yuan .qjblock{font-family:var(--font-doc);font-size:calc(13.5 * var(--tm-px, 1px));line-height:1.95;color:var(--ink);text-align:justify;padding:12px 15px;border-radius:6px;background:repeating-linear-gradient(0deg,transparent 0 calc(1.95em - 1px),var(--rule-ink) calc(1.95em - 1px) 1.95em),rgba(255,253,247,0.55);}body.tm-phase8-formal .shi-yuan .qj-memo{margin-top:11px;padding:10px 13px;border-radius:6px;border:1px solid rgba(168,131,58,0.26);background:rgba(255,250,235,0.5);}body.tm-phase8-formal .shi-yuan .qj-memo .qm-from{font-size:calc(11.5 * var(--tm-px, 1px));color:var(--ink-soft);font-weight:bold;margin-bottom:5px;}body.tm-phase8-formal .shi-yuan .qj-memo .qm-from b{color:var(--cinnabar-d);}body.tm-phase8-formal .shi-yuan .qj-memo .qm-reply{font-family:var(--font);font-size:calc(12.5 * var(--tm-px, 1px));color:var(--vermilion);margin-top:6px;padding-top:6px;border-top:1px dashed rgba(168,131,58,0.3);}body.tm-phase8-formal .shi-yuan .dialog{display:flex;flex-direction:column;gap:11px;}body.tm-phase8-formal .shi-yuan .dline{display:flex;flex-direction:column;gap:4px;}body.tm-phase8-formal .shi-yuan .dl-who{font-size:calc(11.5 * var(--tm-px, 1px));font-weight:bold;letter-spacing:0.08em;display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .shi-yuan .dl-who::before{content:"";width:7px;height:7px;border-radius:50%;}body.tm-phase8-formal .shi-yuan .dline.q .dl-who{color:var(--cinnabar-d);}body.tm-phase8-formal .shi-yuan .dline.q .dl-who::before{background:var(--cinnabar);box-shadow:0 0 0 2px rgba(168,50,40,0.14);}body.tm-phase8-formal .shi-yuan .dline.a .dl-who{color:var(--indigo);}body.tm-phase8-formal .shi-yuan .dline.a .dl-who::before{background:var(--indigo);box-shadow:0 0 0 2px rgba(74,94,138,0.14);}body.tm-phase8-formal .shi-yuan .dl-text{font-family:var(--font-doc);font-size:calc(13.5 * var(--tm-px, 1px));line-height:1.82;color:var(--ink);padding:9px 13px;border-radius:9px;}body.tm-phase8-formal .shi-yuan .dline.q .dl-text{background:rgba(168,50,40,0.05);border:1px solid rgba(168,50,40,0.16);}body.tm-phase8-formal .shi-yuan .dline.a .dl-text{background:rgba(74,94,138,0.05);border:1px solid rgba(74,94,138,0.15);}body.tm-phase8-formal .shi-yuan .dl-ruling{margin-top:11px;padding:10px 13px;border-radius:6px;border-left:3px solid var(--jade);background:rgba(111,162,145,0.08);font-size:calc(13 * var(--tm-px, 1px));line-height:1.7;color:#23463a;}body.tm-phase8-formal .shi-yuan .dl-ruling b{font-family:var(--font);color:#1d6b54;margin-right:5px;}body.tm-phase8-formal .shi-yuan .dialog-mood{margin-top:9px;font-size:calc(12 * var(--tm-px, 1px));color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .dialog-mood b{color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .who-card .who-face.has-portrait{padding:0;overflow:hidden;}body.tm-phase8-formal .shi-yuan .who-face .pt-img,body.tm-phase8-formal .shi-yuan .pn-face .pt-img,body.tm-phase8-formal .shi-yuan .dl-face .pt-img{width:100%;height:100%;object-fit:cover;display:block;}body.tm-phase8-formal .shi-yuan .who-face.has-portrait.fallback .pt-img,body.tm-phase8-formal .shi-yuan .pn-face.fallback .pt-img,body.tm-phase8-formal .shi-yuan .dl-face.fallback .pt-img{display:none;}body.tm-phase8-formal .shi-yuan .who-face.has-portrait.fallback::after{content:attr(data-glyph);font-size:calc(18 * var(--tm-px, 1px));font-weight:bold;color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .prow .pn-face{width:26px;height:30px;flex:0 0 auto;border-radius:5px;overflow:hidden;background:linear-gradient(160deg,#efe3c4,#dcca9f);border:1px solid rgba(168,131,58,0.34);display:grid;place-items:center;}body.tm-phase8-formal .shi-yuan .prow .pn-face.fallback::after{content:attr(data-glyph);font-size:calc(12 * var(--tm-px, 1px));font-weight:bold;color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .dl-who.has-face::before{display:none;}body.tm-phase8-formal .shi-yuan .dl-who .dl-face{width:22px;height:26px;flex:0 0 auto;border-radius:4px;overflow:hidden;background:linear-gradient(160deg,#efe3c4,#dcca9f);border:1px solid rgba(168,131,58,0.3);display:grid;place-items:center;}body.tm-phase8-formal .shi-yuan .dl-who .dl-face.fallback::after{content:attr(data-glyph);font-size:calc(12 * var(--tm-px, 1px));font-weight:bold;color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .annal{font-family:var(--font-doc);font-size:calc(14 * var(--tm-px, 1px));line-height:2.05;color:var(--ink);text-align:justify;text-indent:2em;padding:14px 16px;border-radius:6px;background:repeating-linear-gradient(0deg,transparent 0 calc(2.05em - 1px),var(--rule-ink) calc(2.05em - 1px) 2.05em),rgba(255,253,247,0.55);}body.tm-phase8-formal .shi-yuan .afterword{margin-top:13px;padding:11px 14px 11px 15px;border-radius:6px;position:relative;border:1px solid rgba(168,131,58,0.3);background:rgba(168,131,58,0.06);}body.tm-phase8-formal .shi-yuan .afterword::before{content:"史 论";position:absolute;left:-1px;top:-10px;font-size:calc(11 * var(--tm-px, 1px));letter-spacing:0.1em;color:#fff;background:linear-gradient(150deg,var(--gold),var(--gold-d));padding:2px 8px;border-radius:4px;}body.tm-phase8-formal .shi-yuan .afterword p{font-family:var(--font-doc);font-size:calc(13 * var(--tm-px, 1px));line-height:1.85;color:var(--ink-soft);font-style:italic;margin-top:3px;}body.tm-phase8-formal .shi-yuan .timeline2{position:relative;height:40px;margin:13px 4px 0;}body.tm-phase8-formal .shi-yuan .timeline2::before{content:"";position:absolute;left:0;right:0;top:12px;height:3px;border-radius:2px;background:rgba(120,90,40,0.16);}body.tm-phase8-formal .shi-yuan .tl2-done{position:absolute;left:0;top:12px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--gold-d),var(--gold-hi));box-shadow:0 0 6px rgba(216,185,106,0.5);}body.tm-phase8-formal .shi-yuan .tl2-node{position:absolute;top:7px;transform:translateX(-50%);}body.tm-phase8-formal .shi-yuan .tl2-node .tn-dot{width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid rgba(120,90,40,0.3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.6);}body.tm-phase8-formal .shi-yuan .tl2-node.reached .tn-dot{background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));border-color:var(--gold-d);}body.tm-phase8-formal .shi-yuan .tl2-node.now .tn-dot{background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));border-color:var(--cinnabar-d);box-shadow:0 0 0 3px rgba(168,50,40,0.18);}body.tm-phase8-formal .shi-yuan .tl2-node .tn-lbl{position:absolute;top:15px;left:50%;transform:translateX(-50%);font-size:calc(10 * var(--tm-px, 1px));color:var(--ink-faint);white-space:nowrap;}body.tm-phase8-formal .shi-yuan .fo-annot{margin-top:13px;padding:10px 13px 10px 14px;border-radius:6px;position:relative;border:1px solid rgba(184,58,43,0.28);background:linear-gradient(180deg,rgba(184,58,43,0.05),rgba(184,58,43,0.02));}body.tm-phase8-formal .shi-yuan .fo-annot::before{content:"御 批";position:absolute;left:-1px;top:-10px;font-size:calc(11 * var(--tm-px, 1px));letter-spacing:0.1em;color:#fff;background:linear-gradient(150deg,var(--vermilion),var(--cinnabar-d));padding:2px 8px;border-radius:4px;}body.tm-phase8-formal .shi-yuan .fo-annot p{font-family:var(--font);font-size:calc(13.5 * var(--tm-px, 1px));line-height:1.75;color:var(--vermilion);margin-top:3px;}body.tm-phase8-formal .shi-yuan .refnote{font-family:var(--font-doc);font-size:calc(11.5 * var(--tm-px, 1px));line-height:1.7;color:var(--ink-soft);padding:7px 11px;border-radius:6px;border-left:3px solid rgba(120,90,40,0.3);background:rgba(168,131,58,0.06);}body.tm-phase8-formal .shi-yuan .refnote .rn-lbl{color:var(--gold-d);margin-right:4px;font-family:var(--font);}body.tm-phase8-formal .shi-yuan .refnote div+div{margin-top:2px;}body.tm-phase8-formal .shi-yuan .xref{display:flex;align-items:center;gap:8px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);margin-bottom:5px;padding:7px 11px;border-radius:7px;border:1px solid rgba(168,131,58,0.24);background:rgba(255,252,242,0.5);transition:all .14s;}body.tm-phase8-formal .shi-yuan .xref:hover{border-color:var(--gold);background:#fffdf6;transform:translateX(2px);}body.tm-phase8-formal .shi-yuan .xref .xr-kind{flex:0 0 auto;font-size:calc(10.5 * var(--tm-px, 1px));color:#fff;padding:1px 7px;border-radius:6px;}body.tm-phase8-formal .shi-yuan .xref .xr-t{flex:1;min-width:0;font-size:calc(12 * var(--tm-px, 1px));color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.tm-phase8-formal .shi-yuan .xref .xr-go{flex:0 0 auto;font-size:calc(12 * var(--tm-px, 1px));color:var(--gold-d);}body.tm-phase8-formal .shi-yuan .assoc{display:flex;flex-wrap:wrap;gap:6px;}body.tm-phase8-formal .shi-yuan .atag{font-family:var(--font);font-size:calc(12 * var(--tm-px, 1px));cursor:pointer;padding:3px 11px;border-radius:11px;border:1px solid rgba(74,94,138,0.34);background:rgba(74,94,138,0.07);color:var(--indigo);transition:all .14s;}body.tm-phase8-formal .shi-yuan .atag:hover{background:rgba(74,94,138,0.16);}body.tm-phase8-formal .shi-yuan .atag.fac{border-color:rgba(85,127,111,0.36);background:rgba(111,162,145,0.1);color:#2d5848;}body.tm-phase8-formal .shi-yuan .atag.reg{border-color:rgba(184,139,47,0.36);background:rgba(184,139,47,0.1);color:var(--gold-d);}body.tm-phase8-formal .shi-yuan .fo-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(168,131,58,0.18);}body.tm-phase8-formal .shi-yuan .fact{font-family:var(--font);font-size:calc(12 * var(--tm-px, 1px));cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid rgba(168,131,58,0.36);background:rgba(255,252,243,0.5);color:var(--ink-soft);transition:all .14s;}body.tm-phase8-formal .shi-yuan .fact:hover{background:#fffdf6;border-color:var(--gold);transform:translateY(-1px);}body.tm-phase8-formal .shi-yuan .fact.red{border-color:rgba(184,58,43,0.4);color:var(--cinnabar-d);}body.tm-phase8-formal .shi-yuan .folio-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:40px;text-align:center;color:var(--ink-faint);}body.tm-phase8-formal .shi-yuan .folio-empty .fe-seal{width:56px;height:56px;display:grid;place-items:center;border-radius:9px;font-size:calc(26 * var(--tm-px, 1px));font-weight:bold;color:#fff;background:linear-gradient(155deg,var(--gold-hi),var(--gold-d));opacity:0.8;margin-bottom:6px;}body.tm-phase8-formal .shi-yuan .folio-empty b{font-size:calc(14 * var(--tm-px, 1px));letter-spacing:0.16em;color:var(--ink-soft);}body.tm-phase8-formal .shi-yuan .folio-empty p{font-size:calc(12 * var(--tm-px, 1px));line-height:1.7;}@keyframes zsh-fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}body.tm-phase8-formal .shi-yuan .main-scroll>*,body.tm-phase8-formal .shi-yuan .folio-scroll>*{animation:zsh-fadeUp .32s ease both;}'; if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  // ════════════════════════════════════════════════════════════════
  // 史册库 v4·多视图史料数据库 (御案米金)·落地 2026-06-03 刀2
  // 复用行模型 formal*Rows 当数据源·四类详情读 row.raw 真实字段·史记 Delta 从 GM._metricHistory 前端算
  // 交互全走 data-desk-action(单词属性) + openShiluPreviewPanel 重渲·CSS 由 installShiguanYuanStyles 注入
  // 立绘(史记/纪事人物·人物列传头像)留刀3·此刀头像用字形
  // ════════════════════════════════════════════════════════════════

  var SHI_CATS = [
    { key:'shiji', label:'史记', sub:'回合全景', g:'记', c:'#a83228' },
    { key:'qiju', label:'起居注', sub:'政务日志', g:'居', c:'#a8833a' },
    { key:'jishi', label:'纪事', sub:'议政对话', g:'纪', c:'#4a5e8a' },
    { key:'biannian', label:'编年', sub:'事势·年史', g:'编', c:'#557f6f' }
  ];
  var SHI_VIEWS = [
    ['overview','馆藏概览','览'], ['library','四库浏览','库'],
    ['timeline','时间轴总览','轴'], ['persons','人物列传','传'], ['realms','势力地域','疆']
  ];
  var SHI_AUTH = { faith:{ label:'信史', g:'信史' }, doubt:{ label:'存疑', g:'存疑' }, rumor:{ label:'风闻', g:'风闻' } };
  var SHI_TYPE_C = {'战事':'#7a2018','人事':'#8e6aa8','人物':'#8e6aa8','灾异':'#b98b2f','党争':'#a83228','边务':'#4a5e8a','财赋':'#557f6f','财政':'#557f6f','礼制':'#a8833a','外交':'#4a5e8a','工程':'#557f6f','军务':'#7a2018','时政':'#a8833a'};
  var SHI_QJ_CAT = {'诏令':'#a83228','奏疏':'#a8833a','朝议':'#4a5e8a','鸿雁':'#557f6f','人事':'#8e6aa8','行止':'#7d5e22','叙事':'#9c8b6b','人物':'#8e6aa8','行政':'#7d5e22'};
  var SHI_SRC = { changchao:{l:'常朝',g:'朝'}, yuqian:{l:'御前',g:'御'}, tingyi:{l:'廷议',g:'廷'}, tingyi2:{l:'廷议',g:'廷'}, keyi:{l:'科议',g:'科'}, jingyan:{l:'经筵',g:'经'}, private:{l:'问对·私',g:'私'}, formal:{l:'问对·殿',g:'殿'}, mibao:{l:'密报',g:'密'}, mizou:{l:'密报',g:'密'}, audience:{l:'求见',g:'见'}, qiujian:{l:'求见',g:'见'}, letter:{l:'鸿雁',g:'雁'}, memo:{l:'奏疏',g:'奏'}, kangshu:{l:'抗疏',g:'抗'}, record:{l:'杂录',g:'录'} };

  function shiCatDef(k){ for (var i=0;i<SHI_CATS.length;i++) if (SHI_CATS[i].key===k) return SHI_CATS[i]; return SHI_CATS[0]; }
  function shiTypeColor(t){ return SHI_TYPE_C[t] || '#a8833a'; }
  function shiSrcDef(s){ return SHI_SRC[s] || { l:'杂录', g:'录' }; }
  function shiAuthDef(a){ return SHI_AUTH[a] || SHI_AUTH.faith; }
  function shiTitleOf(x){ return x.szjTitle || x.title || (x.char ? (x.char + (x.topic ? ' · ' + x.topic : '')) : '') || '未题'; }
  function shiArr(v){ if (!v) return []; if (Array.isArray(v)) return v.filter(Boolean); return [v]; }
  function shiJoin(v){ if (!v) return ''; if (Array.isArray(v)) return v.filter(Boolean).join('、'); return String(v); }

  // 纪年 → era/date 拆分 (getTurnText → "天启七年三月" → era/date)
  function shiEraDate(turn){
    var full = '';
    try { full = String(getTurnText(turn) || ''); } catch(_) { full = ''; }
    var m = full.match(/^(.*?年)(.*)$/);
    if (m) return { era: m[1], date: (m[2] || '').trim() };
    return { era: '', date: full };
  }

  // authorityLevel/confidence → faith/doubt/rumor (史料权威级)
  function shiAuthority(raw){
    if (!raw) return 'faith';
    var lv = String(raw.authorityLevel || raw.authority || '');
    var conf = (typeof raw.confidence === 'number') ? raw.confidence : null;
    if (/rumor|风闻|fengwen|hearsay/i.test(lv)) return 'rumor';
    if (/doubt|存疑|unverified/i.test(lv)) return 'doubt';
    if (raw.leaked || raw.secret) return 'doubt';
    if (conf != null) { if (conf < 0.6) return 'rumor'; if (conf < 0.72) return 'doubt'; }
    return 'faith';
  }

  // 史记国势 Delta·从 GM._metricHistory 取本回与上回快照差·取|d|最大前4 (引擎不存 delta 对象·前端算)
  function shiDelta(turn){
    var gm = window.GM || {};
    var hist = (gm._metricHistory && gm._metricHistory.length) ? gm._metricHistory : [];
    if (!hist.length) return [];
    function snapOf(t){ for (var i = hist.length - 1; i >= 0; i--) { if (Number(hist[i].turn) === Number(t)) return hist[i]; } return null; }
    var cur = snapOf(turn), prev = snapOf(turn - 1);
    if (!cur || !prev) return [];
    var labels = (typeof CORE_METRIC_LABELS === 'object' && CORE_METRIC_LABELS) ? CORE_METRIC_LABELS : {};
    var out = [];
    Object.keys(labels).forEach(function(k){
      if (typeof cur[k] === 'number' && typeof prev[k] === 'number') {
        var d = cur[k] - prev[k];
        if (Math.abs(d) >= 1) out.push({ k: labels[k] || k, raw: d, v: (d > 0 ? '+' : '') + d, dir: d > 0 ? 'up' : 'dn' });
      }
    });
    out.sort(function(a, b){ return Math.abs(b.raw) - Math.abs(a.raw); });
    return out.slice(0, 4);
  }

  // 诏令字段归一 (史记/起居注 edicts 对象或数组 → [{k,t}])
  function shiEdictList(e){
    var out = [];
    if (Array.isArray(e)) { e.forEach(function(x){ if (x) out.push({ k: x.k || x.type || '诏', t: x.t || x.text || x.content || String(x) }); }); }
    else if (e && typeof e === 'object') {
      var map = [['political','政'],['military','军'],['diplomatic','外'],['economic','经'],['personnel','人'],['other','余']];
      map.forEach(function(p){ if (e[p[0]]) out.push({ k: p[1], t: e[p[0]] }); });
    }
    return out;
  }
  // 起居注无结构化人物·从剧本 GM.chars 名在文本里轻量匹配 (只匹配已定义人物名·避免误报)
  function shiPersonsFromText(text){
    var gm = window.GM || {}; var out = [];
    var people = (gm.chars && Array.isArray(gm.chars)) ? gm.chars : [];
    var t = String(text || ''); if (!t) return out;
    for (var i = 0; i < people.length && out.length < 5; i++) {
      var nm = people[i] && people[i].name;
      if (nm && String(nm).length >= 2 && t.indexOf(nm) >= 0) out.push(nm);
    }
    return out;
  }

  // ── 立绘 (复用 bridge._tmfRenwuPortrait·名字先查 GM.chars 取真实 portrait·否则按身份 6 fallback) ──
  function shiPortraitSrc(person){
    var p = (typeof person === 'string') ? null : (person || null);
    if (!p) {
      var nm = String(person == null ? '' : person);
      var gm = window.GM || {};
      var chars = (gm.chars && Array.isArray(gm.chars)) ? gm.chars : [];
      for (var i = 0; i < chars.length; i++) { if (chars[i] && chars[i].name === nm) { p = chars[i]; break; } }
      if (!p) p = { name: nm };
    }
    try { if (bridge && bridge._tmfRenwuPortrait) return bridge._tmfRenwuPortrait(p) || ''; } catch(_) {}
    return '';
  }
  function shiFaceImg(person, cls){
    var nm = (typeof person === 'string') ? person : ((person && person.name) || '佚名');
    var glyph = esc(String(nm).slice(-2, -1) || String(nm).slice(0, 1) || '史');
    var src = shiPortraitSrc(person);
    return '<span class="' + attr(cls || 'who-face') + ' has-portrait" data-glyph="' + glyph + '"><img class="pt-img" loading="lazy" decoding="async" src="' + attr(src) + '" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'fallback\');"></span>';
  }

  // 势力/地域·从涉及人物所属聚合 (引擎史记不写 factions/regions·按 personnel/char 在 GM.chars 查 faction/region)
  function shiFactionRegionOfPersons(names){
    var gm = window.GM || {};
    var chars = (gm.chars && Array.isArray(gm.chars)) ? gm.chars : [];
    var fset = {}, rset = {};
    (names || []).forEach(function(nm){
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        if (c && c.name === nm) {
          if (c.faction) fset[c.faction] = 1;
          var rg = c.region || c.location || c.place;
          if (rg) rset[rg] = 1;
          break;
        }
      }
    });
    return { factions: Object.keys(fset), regions: Object.keys(rset) };
  }

  // ── 合并四库行模型 → 统一 archive (v4 ARCHIVE-like·带 raw 真实字段) ──
  function shiBuildArchive(){
    var arc = [];
    var gm = window.GM || {};
    // ① 史记
    formalShijiRows().forEach(function(r){
      var raw = r.raw || {};
      var ed = shiEraDate(r.turn);
      var persons = [];
      if (Array.isArray(raw.personnel)) raw.personnel.forEach(function(p){ if (p && p.name) persons.push(p.name); });
      arc.push({
        id: r.id, cat: 'shiji', turn: r.turn, seq: r.seq,
        era: ed.era, date: ed.date, type: r.type,
        authority: shiAuthority(raw), starred: !!raw._starred,
        persons: persons, factions: shiArr(raw.factions || raw.faction), regions: shiArr(raw.regions || raw.region),
        annotation: raw._annotation || r.annotation || '',
        sources: shiArr(raw.sourceRefs || raw.sources), basis: shiJoin(raw.basisRefs || raw.basis), evidence: shiJoin(raw.evidenceRefs || raw.evidence),
        needle: formalRowNeedle(r) + ' ' + [raw.shilu, raw.shizhengji, raw.zhengwen, raw.houren, raw.turnSummary, raw.szjSummary].filter(Boolean).join(' '),
        szjTitle: raw.szjTitle || r.title, turnSummary: raw.turnSummary || raw.szjSummary || '',
        shilu: raw.shilu || '', shizhengji: raw.shizhengji || '', zhengwen: raw.zhengwen || '', houren: raw.houren || '',
        personnel: Array.isArray(raw.personnel) ? raw.personnel : [],
        edicts: shiEdictList(raw.edicts), delta: shiDelta(r.turn),
        text: r.text, _row: r
      });
    });
    // ② 起居注
    formalQijuRows().forEach(function(r){
      var raw = r.raw || {};
      var ed = shiEraDate(r.turn);
      arc.push({
        id: r.id, cat: 'qiju', turn: r.turn, seq: r.seq,
        era: ed.era, date: r.date || ed.date, category: r.type, type: r.type,
        authority: shiAuthority(raw), starred: !!raw._starred,
        persons: shiPersonsFromText(r.text), factions: shiArr(raw.factions || raw.faction), regions: shiArr(raw.regions || raw.region),
        annotation: r.annotation || raw._annotation || '', sources: shiArr(raw.sourceRefs || raw.sources), basis: '', evidence: '',
        needle: formalRowNeedle(r),
        title: r.title, body: r.text, edicts: shiEdictList(raw.edicts), // memo 死字段已删·edicts 空时 return 前从同回合史记关联
        text: r.text, _row: r
      });
    });
    // ③ 纪事
    formalJishiRows().forEach(function(r){
      var raw = r.raw || {};
      var ed = shiEraDate(r.turn);
      var src = formalJishiSource(raw);
      arc.push({
        id: r.id, cat: 'jishi', turn: r.turn, seq: r.seq,
        era: ed.era, date: r.date || ed.date, type: r.type, source: src.key,
        authority: shiAuthority(raw), starred: !!r.starred,
        persons: raw.char ? [raw.char] : [], factions: shiArr(raw.factions || raw.faction), regions: shiArr(raw.regions || raw.region),
        annotation: raw._annotation || r.annotation || '', sources: shiArr(raw.sourceRefs || raw.sources), basis: '', evidence: '',
        needle: formalRowNeedle(r),
        char: raw.char || r.actor || '', topic: raw.topic || '', playerSaid: raw.playerSaid || '', npcSaid: raw.npcSaid || '',
        outcome: raw.outcome || raw.finalRuling || raw.decree || raw.approval || '', // mood 死字段已删·outcome 由引擎补写
        text: r.text, _row: r
      });
    });
    // ④ 编年·进行中事势
    formalBiannianActiveRows().forEach(function(r){
      var raw = r.raw || {};
      var ed = shiEraDate(r.turn);
      arc.push({
        id: r.id, cat: 'biannian', sub: 'affair', turn: r.turn, seq: r.seq,
        era: ed.era, date: r.date || ed.date, category: r.type, type: r.type,
        authority: shiAuthority(raw), starred: false,
        persons: shiArr(raw.persons), factions: shiArr(raw.factions || raw.faction), regions: shiArr(raw.regions || raw.region),
        actor: r.actor || '', status: r.status || '推进中', progress: r.progress || 0,
        startTurn: Number(raw.startTurn || raw.turn || r.turn), nowTurn: Number(gm.turn || r.turn), endTurn: Number(raw.endTurn || 0),
        annotation: '', sources: [], needle: formalRowNeedle(r), body: r.text, text: r.text, _row: r
      });
    });
    // ④ 编年·永久编年 / 年度正史
    formalBiannianRows().forEach(function(r){
      var raw = r.raw || {};
      var ed = shiEraDate(r.turn);
      var isAnnal = !!(raw.afterword || raw.annal || /编年|年正史|岁纪/.test(String(r.title || '')));
      arc.push({
        id: r.id, cat: 'biannian', sub: isAnnal ? 'annal' : 'chronicle', turn: r.turn, seq: r.seq,
        era: ed.era || raw.year || '', date: r.date || ed.date, year: raw.year || ed.era || '',
        category: r.type, type: r.type, authority: shiAuthority(raw), starred: !!raw._starred,
        persons: shiArr(raw.persons), factions: shiArr(raw.factions || raw.faction), regions: shiArr(raw.regions || raw.region),
        title: r.title, body: r.text, annal: raw.annal || raw.content || r.text, afterword: raw.afterword || '',
        annotation: '', sources: shiArr(raw.sourceRefs || raw.sources), needle: formalRowNeedle(r), text: r.text, _row: r
      });
    });
    // 势力/地域回填:史记/纪事/起居注 raw 多无 factions/regions·从涉及人物所属聚合补 (2026-06-03)
    arc.forEach(function(x){
      if (!x.factions || !x.factions.length || !x.regions || !x.regions.length) {
        var fr = shiFactionRegionOfPersons(x.persons || []);
        if (!x.factions || !x.factions.length) x.factions = fr.factions;
        if (!x.regions || !x.regions.length) x.regions = fr.regions;
      }
    });
    // 起居注诏令:起居注本身不存 edicts·从同回合史记本回诏令关联 (2026-06-03 混合·补有价值)
    var _sjEdicts = {};
    arc.forEach(function(x){ if (x.cat === 'shiji' && x.edicts && x.edicts.length) _sjEdicts[x.turn] = x.edicts; });
    arc.forEach(function(x){ if (x.cat === 'qiju' && (!x.edicts || !x.edicts.length) && _sjEdicts[x.turn]) x.edicts = _sjEdicts[x.turn]; });
    return arc;
  }

  // ── archive 查询/聚合 helper ──
  function shiById(arc, id){ for (var i=0;i<arc.length;i++) if (arc[i].id === id) return arc[i]; return null; }
  function shiCatRows(arc, k){ return arc.filter(function(x){ return x.cat === k; }); }
  function shiAggr(rows, field){
    var m = {};
    rows.forEach(function(x){ var v = x[field]; if (Array.isArray(v)) v.forEach(function(o){ if (o) m[o] = (m[o]||0)+1; }); else if (v) m[v] = (m[v]||0)+1; });
    return m;
  }
  function shiAggrPersons(arc){ var m = shiAggr(arc, 'persons'); return Object.keys(m).filter(function(p){ return p; }).sort(function(a,b){ return m[b]-m[a]; }).map(function(p){ return { name:p, n:m[p] }; }); }
  function shiAggrRealms(arc){
    var f = shiAggr(arc, 'factions'), r = shiAggr(arc, 'regions'), out = [];
    Object.keys(f).forEach(function(k){ out.push({ name:k, n:f[k], kind:'fac' }); });
    Object.keys(r).forEach(function(k){ out.push({ name:k, n:r[k], kind:'reg' }); });
    return out.sort(function(a,b){ return b.n-a.n; });
  }
  function shiRecsOfPerson(arc, p){ return arc.filter(function(x){ return (x.persons||[]).indexOf(p) >= 0; }); }
  function shiRecsOfRealm(arc, name, kind){ var f = kind==='fac'?'factions':'regions'; return arc.filter(function(x){ return (x[f]||[]).indexOf(name) >= 0; }); }
  // 互见·同回合其它库条目 (引擎无显式 refs·按回合相关聚合)
  function shiCrossRefs(arc, x){
    if (!x || !x.turn) return [];
    return arc.filter(function(y){ return y.id !== x.id && Number(y.turn) === Number(x.turn); }).slice(0, 6);
  }

  // ── facet 维度 (按当前库自适应) ──
  function shiFacetDims(){
    var k = state.recordTab;
    if (k === 'shiji') return [['type','事类','type'],['authority','权威','authority']];
    if (k === 'qiju') return [['category','政类','category']];
    if (k === 'jishi') return [['source','来源','source'],['person','人物','persons']];
    if (k === 'biannian') return [['category','事类','category']];
    return [];
  }
  function shiLibRows(arc){
    var rows = shiCatRows(arc, state.recordTab);
    var facet = state.recordFacet || {};
    Object.keys(facet).forEach(function(k){
      var vs = facet[k] || []; if (!vs.length) return;
      rows = rows.filter(function(x){
        if (k === 'person') return vs.some(function(v){ return (x.persons||[]).indexOf(v) >= 0; });
        return vs.indexOf(x[k]) >= 0;
      });
    });
    rows = rows.slice();
    if (state.recordSort === 'ref') rows.sort(function(a,b){ return (shiCrossRefs(arc,b).length) - (shiCrossRefs(arc,a).length); });
    else rows.sort(function(a,b){ return (b.turn||0) - (a.turn||0); });
    return rows;
  }
  function shiLibHint(k){ return ({shiji:'每回合正史全景 · 四层文体',qiju:'逐日政务日志 · 八类',jishi:'议政对话 · 多来源',biannian:'长期事势 + 年度正史'})[k] || ''; }

  // ── 左·导航 ──
  function shiHdChips(arc){
    var faith = arc.filter(function(x){ return x.authority==='faith'; }).length;
    return '<div class="shi-chips"><span class="chip green">馆藏 ' + arc.length + ' 卷</span><span class="chip hot">信史 ' + faith + '</span></div>';
  }
  function shiNav(arc){
    var html = '<div class="nav-sect">检索视图</div>';
    SHI_VIEWS.forEach(function(v){
      var n = v[0]==='library' ? arc.length : (v[0]==='persons' ? shiAggrPersons(arc).length : (v[0]==='realms' ? shiAggrRealms(arc).length : ''));
      html += '<button type="button" class="gv ' + (state.recordView===v[0]?'active':'') + '" data-desk-action="record-view-desk" data-view="' + attr(v[0]) + '"><span class="gv-g">' + esc(v[2]) + '</span><b>' + esc(v[1]) + '</b>' + (n!==''?'<span class="gv-n">'+n+'</span>':'') + '</button>';
    });
    if (state.recordView === 'library') {
      html += '<div class="nav-div"></div><div class="nav-sect">四库分卷</div>';
      SHI_CATS.forEach(function(c){
        html += '<button type="button" class="libcat ' + (state.recordTab===c.key?'active':'') + '" data-desk-action="record-tab-desk" data-tab="' + attr(c.key) + '" style="--cc:' + c.c + '"><span class="libcat-g" style="--cc:' + c.c + '">' + esc(c.g) + '</span><span class="libcat-m"><b>' + esc(c.label) + '</b></span><span class="libcat-n">' + shiCatRows(arc,c.key).length + '</span></button>';
      });
      shiFacetDims().forEach(function(d){
        var rows = shiCatRows(arc, state.recordTab), m = shiAggr(rows, d[2]);
        var opts = Object.keys(m).sort(function(a,b){ return m[b]-m[a]; });
        if (d[0]==='authority') opts = ['faith','doubt','rumor'].filter(function(a){ return m[a]; });
        if (!opts.length) return;
        var facet = state.recordFacet || {};
        html += '<div class="facet"><div class="facet-t">' + esc(d[1]) + '(可多选)</div><div class="facet-opts">' + opts.map(function(o){
          var lbl = d[0]==='authority' ? shiAuthDef(o).label : (d[0]==='source' ? shiSrcDef(o).l : o);
          var on = (facet[d[0]]||[]).indexOf(o) >= 0;
          return '<button type="button" class="fopt ' + (on?'active':'') + '" data-desk-action="record-facet-desk" data-dim="' + attr(d[0]) + '" data-val="' + attr(o) + '">' + esc(lbl) + '<span class="fn">' + m[o] + '</span></button>';
        }).join('') + '</div></div>';
      });
    }
    return html;
  }
  function shiNavStat(arc){
    var faith = arc.filter(function(x){ return x.authority==='faith'; }).length;
    var stars = arc.filter(function(x){ return x.starred; }).length;
    var pct = arc.length ? Math.round(faith/arc.length*100) : 0;
    return '<div class="ss-row"><span>馆藏总卷</span><b>' + arc.length + '</b></div><div class="ss-row"><span>信史占比</span><b>' + pct + '%</b></div><div class="ss-row"><span>星标</span><b>' + stars + '</b></div>';
  }

  // ── 列表条目 ──
  function shiEntry(x, showCat){
    var act = (state.recordId === x.id) ? ' active' : '';
    var sel = ' data-desk-action="select-record-desk" data-id="' + attr(x.id) + '"';
    var star = x.starred ? '<span class="et-star">★</span>' : '';
    var catTag = showCat ? '<span class="etag" style="background:' + shiCatDef(x.cat).c + '">' + esc(shiCatDef(x.cat).label) + '</span>' : '';
    if (x.cat === 'shiji') {
      var delta = (x.delta||[]).slice(0,3).map(function(d){ return '<span class="dchip ' + d.dir + '">' + esc(d.k) + ' ' + esc(d.v) + '</span>'; }).join('');
      return '<button type="button" class="entry' + act + '"' + sel + '><span class="e-badge turn" style="background:linear-gradient(155deg,var(--gold-hi),var(--gold-d))"><b>' + esc(x.turn) + '</b><span>回</span></span><span class="e-main"><span class="e-title">' + star + esc(shiTitleOf(x)) + '</span><span class="e-meta">' + catTag + '<span class="etag" style="background:' + shiTypeColor(x.type) + '">' + esc(x.type) + '</span><span>' + esc(x.era) + (x.date?'·'+esc(x.date):'') + '</span></span><span class="e-excerpt">' + esc(x.turnSummary || x.text || '') + '</span><span class="e-delta">' + delta + '</span></span></button>';
    }
    if (x.cat === 'qiju') {
      var col = SHI_QJ_CAT[x.category] || '#a8833a';
      var ex = x.body || (x.edicts && x.edicts[0] && x.edicts[0].t) || (x.memo && x.memo.text) || '';
      return '<button type="button" class="entry' + act + '"' + sel + '><span class="e-badge" style="background:' + col + '">' + esc(x.category) + '</span><span class="e-main"><span class="e-title">' + esc(x.title) + '</span><span class="e-meta">' + catTag + '<span>' + esc(x.date) + '</span></span><span class="e-excerpt">' + esc(ex) + '</span></span></button>';
    }
    if (x.cat === 'jishi') {
      var sd = shiSrcDef(x.source);
      return '<button type="button" class="entry' + act + '"' + sel + '><span class="e-badge" style="background:linear-gradient(155deg,#4a5e8a,#33456a)">' + esc(sd.g) + '</span><span class="e-main"><span class="e-title">' + star + esc(x.char || '纪事') + (x.topic?' · '+esc(x.topic):'') + '</span><span class="e-meta">' + catTag + '<span class="etag" style="background:#4a5e8a">' + esc(sd.l) + '</span><span>' + esc(x.date) + '</span></span><span class="e-excerpt">' + esc(x.playerSaid ? ('问：' + String(x.playerSaid).slice(0,24) + '…') : (x.text||'')) + '</span></span></button>';
    }
    if (x.sub === 'annal') {
      return '<button type="button" class="entry' + act + '"' + sel + '><span class="e-badge" style="background:linear-gradient(155deg,var(--gold-hi),var(--gold-d))">年史</span><span class="e-main"><span class="e-title">' + esc(x.title) + '</span><span class="e-meta">' + catTag + '<span>年度编年正史</span></span><span class="e-excerpt">' + esc(x.annal || x.body || '') + '</span></span></button>';
    }
    if (x.sub === 'affair') {
      var span = (x.endTurn - x.startTurn) || 1;
      var pct = Math.max(4, Math.min(100, x.progress || Math.round((x.nowTurn - x.startTurn)/span*100)));
      return '<button type="button" class="entry' + act + '"' + sel + '><span class="e-badge" style="background:' + shiTypeColor(x.category) + '">' + esc(x.category) + '</span><span class="e-main"><span class="e-title">' + esc(x.title) + '</span><span class="e-meta">' + catTag + '<span>' + esc(x.actor||'有司') + '</span><span class="dot">·</span><span>进行中 ' + pct + '%</span></span><span class="e-excerpt">' + esc(x.body||'') + '</span></span></button>';
    }
    return '<button type="button" class="entry' + act + '"' + sel + '><span class="e-badge" style="background:' + shiTypeColor(x.category) + '">' + esc(x.category||'编') + '</span><span class="e-main"><span class="e-title">' + esc(x.title) + '</span><span class="e-meta">' + catTag + '<span>' + esc(x.date||'') + '</span></span><span class="e-excerpt">' + esc(x.body||x.text||'') + '</span></span></button>';
  }

  // ── 馆藏概览 ──
  function shiOverview(arc){
    var libs = SHI_CATS.map(function(c){ return '<button type="button" class="ov-lib" data-desk-action="record-tab-desk" data-tab="' + attr(c.key) + '"><b>' + shiCatRows(arc,c.key).length + '</b><span>' + esc(c.label) + '</span></button>'; }).join('');
    var eras = shiAggr(arc, 'era'); var eraKeys = Object.keys(eras).filter(Boolean);
    var maxE = eraKeys.length ? Math.max.apply(null, eraKeys.map(function(k){ return eras[k]; })) : 1;
    var eraBars = eraKeys.length ? eraKeys.map(function(e){ return '<div class="era-row"><span class="er-lbl">' + esc(e) + '</span><span class="er-track"><span class="er-fill" style="width:' + Math.round(eras[e]/maxE*100) + '%"></span></span><span class="er-n">' + eras[e] + ' 卷</span></div>'; }).join('') : '<div class="empty-mini">暂无纪年分布</div>';
    var fa = arc.filter(function(x){ return x.authority==='faith'; }).length, du = arc.filter(function(x){ return x.authority==='doubt'; }).length, ru = arc.filter(function(x){ return x.authority==='rumor'; }).length;
    var faPct = arc.length ? Math.round(fa/arc.length*100) : 0, duPct = arc.length ? Math.round(du/arc.length*100) : 0;
    var ring = '<div class="ring" style="background:conic-gradient(var(--cinnabar) 0 ' + faPct + '%,var(--seal-doubt) ' + faPct + '% ' + (faPct+duPct) + '%,var(--seal-rumor) 0)"><b>' + faPct + '%</b></div>';
    var pm = shiAggr(arc, 'persons'); var hot = Object.keys(pm).filter(function(p){ return p; }).sort(function(a,b){ return pm[b]-pm[a]; }).slice(0,8);
    var hotp = hot.length ? hot.map(function(p){ return '<button type="button" class="hotp" data-desk-action="record-person-desk" data-person="' + attr(p) + '">' + esc(p) + '<b>' + pm[p] + '</b></button>'; }).join('') : '<div class="empty-mini">暂无人物聚合</div>';
    return '<div class="ov-grid">' +
      '<div class="ov-card wide"><h4>四库藏卷</h4><div class="ov-libs">' + libs + '</div></div>' +
      '<div class="ov-card"><h4>纪年分布</h4><div class="era-bars">' + eraBars + '</div></div>' +
      '<div class="ov-card"><h4>史料权威</h4><div class="auth-ring">' + ring + '<div class="auth-leg"><div class="al"><i style="background:var(--cinnabar)"></i>信史<span class="n">' + fa + ' 卷</span></div><div class="al"><i style="background:var(--seal-doubt)"></i>存疑<span class="n">' + du + ' 卷</span></div><div class="al"><i style="background:var(--seal-rumor)"></i>风闻<span class="n">' + ru + ' 卷</span></div></div></div></div>' +
      '<div class="ov-card wide"><h4>热点人物</h4><div class="hot-persons">' + hotp + '</div></div></div>';
  }

  // ── 时间轴总览 ──
  function shiTimeline(arc){
    var rows = arc.filter(function(x){ return x.sub !== 'annal'; }).slice().sort(function(a,b){ return (a.turn||0)-(b.turn||0); });
    if (!rows.length) return '<div class="empty"><b>暂无可贯通的纪年条目</b><p>过回合、议政、诏令后，四库条目会按时序汇于此。</p></div>';
    var byEra = {}; rows.forEach(function(x){ var k = x.era || ('第'+x.turn+'回'); (byEra[k]||(byEra[k]=[])).push(x); });
    return Object.keys(byEra).map(function(era){
      return '<div class="tl-era"><div class="tl-era-h">' + esc(era) + '</div><div class="tl-item">' + byEra[era].map(function(x){
        var c = x.cat==='biannian' ? shiTypeColor(x.category) : shiTypeColor(x.type);
        return '<button type="button" class="tl-item-in ' + (state.recordId===x.id?'active':'') + '" data-desk-action="select-record-desk" data-id="' + attr(x.id) + '"><span class="tl-date">' + esc(x.date || ('第'+x.turn+'回')) + '</span><span class="tl-dot2" style="border-color:' + c + '"></span><span class="tl-tx"><b>' + esc(shiTitleOf(x)) + '</b><span class="tt-meta"><span class="etag" style="background:' + shiCatDef(x.cat).c + '">' + esc(shiCatDef(x.cat).label) + '</span> ' + esc(shiAuthDef(x.authority).label) + '</span></span></button>';
      }).join('') + '</div></div>';
    }).join('');
  }

  // ── 人物列传 ──
  function shiPersonsView(arc){
    if (state.recordPerson) {
      var recs = shiRecsOfPerson(arc, state.recordPerson); var byCat = {};
      recs.forEach(function(x){ (byCat[x.cat]||(byCat[x.cat]=[])).push(x); });
      var h = '<button type="button" class="tbtn" data-desk-action="record-back-desk" data-back="person" style="margin-bottom:11px">‹ 返列传名录</button>';
      if (!recs.length) h += '<div class="empty"><b>此人暂无史档</b></div>';
      SHI_CATS.forEach(function(c){ if (!byCat[c.key]) return; h += '<div class="cat-group-t">' + c.label + ' · ' + byCat[c.key].length + ' 卷</div>' + byCat[c.key].map(function(x){ return shiEntry(x); }).join(''); });
      return h;
    }
    var ps = shiAggrPersons(arc);
    if (!ps.length) return '<div class="empty"><b>暂无人物档案</b><p>史记人事、纪事问对中的人物会汇为列传。</p></div>';
    return '<div class="who-list">' + ps.map(function(p){
      return '<button type="button" class="who-card" data-desk-action="record-person-desk" data-person="' + attr(p.name) + '">' + shiFaceImg(p.name, 'who-face') + '<span class="who-m"><b>' + esc(p.name) + '</b><span>四库史档</span></span><span class="who-n">' + p.n + ' 卷</span></button>';
    }).join('') + '</div>';
  }

  // ── 势力地域 ──
  function shiRealmsView(arc){
    if (state.recordRealm) {
      var rk = String(state.recordRealm).split('|');
      var recs = shiRecsOfRealm(arc, rk[1], rk[0]); var byCat = {};
      recs.forEach(function(x){ (byCat[x.cat]||(byCat[x.cat]=[])).push(x); });
      var h = '<button type="button" class="tbtn" data-desk-action="record-back-desk" data-back="realm" style="margin-bottom:11px">‹ 返势力地域</button>';
      if (!recs.length) h += '<div class="empty"><b>暂无相关史料</b></div>';
      SHI_CATS.forEach(function(c){ if (!byCat[c.key]) return; h += '<div class="cat-group-t">' + c.label + ' · ' + byCat[c.key].length + ' 卷</div>' + byCat[c.key].map(function(x){ return shiEntry(x); }).join(''); });
      return h;
    }
    var rs = shiAggrRealms(arc);
    if (!rs.length) return '<div class="empty"><b>暂无势力 / 疆域聚合</b><p>史料标注势力、疆域后，会按此聚合。当前四库条目尚未携带势力/地域标注。</p></div>';
    return '<div class="who-list">' + rs.map(function(r){
      var glyph = esc(String(r.name).slice(0,1));
      return '<button type="button" class="who-card ' + r.kind + '" data-desk-action="record-realm-desk" data-realm="' + attr(r.kind + '|' + r.name) + '"><span class="who-face">' + glyph + '</span><span class="who-m"><b>' + esc(r.name) + '</b><span>' + (r.kind==='fac'?'势力':'疆域') + '</span></span><span class="who-n">' + r.n + ' 卷</span></button>';
    }).join('') + '</div>';
  }

  // ── 跨库全局检索 ──
  function shiSearchView(arc){
    var q = String(state.recordSearch || '').trim().toLowerCase();
    var rows = arc.filter(function(x){ return String(x.needle || '').toLowerCase().indexOf(q) >= 0; });
    if (!rows.length) return { count:0, html:'<div class="empty"><b>四库无所获</b><p>另换检索词试试。</p></div>' };
    var byCat = {}; rows.forEach(function(x){ (byCat[x.cat]||(byCat[x.cat]=[])).push(x); });
    var h = ''; SHI_CATS.forEach(function(c){ if (!byCat[c.key]) return; h += '<div class="cat-group-t">' + c.label + ' · ' + byCat[c.key].length + ' 卷</div>' + byCat[c.key].map(function(x){ return shiEntry(x, true); }).join(''); });
    return { count: rows.length, html: h };
  }

  // ── 中·主区分发 ──
  function shiMain(arc){
    var titleHtml = '', sortHtml = '', activeHtml = '', scrollHtml = '';
    // 跨库检索优先
    if (String(state.recordSearch || '').trim()) {
      var sr = shiSearchView(arc);
      titleHtml = '跨库检索<small>“' + esc(state.recordSearch) + '” · 遍检四库</small>';
      activeHtml = '<span class="cat-count">命中 ' + sr.count + ' 卷</span>';
      scrollHtml = sr.html;
    } else if (state.recordView === 'overview') {
      titleHtml = '馆藏概览<small>史册库总目 · 一览四库</small>'; scrollHtml = shiOverview(arc);
    } else if (state.recordView === 'timeline') {
      titleHtml = '时间轴总览<small>编年贯通 · 大事如绘</small>'; scrollHtml = shiTimeline(arc);
    } else if (state.recordView === 'persons') {
      titleHtml = state.recordPerson ? ('人物列传<small>' + esc(state.recordPerson) + ' · 四库史档汇览</small>') : '人物列传<small>点其名 · 汇出此人在四库的全部史档</small>';
      scrollHtml = shiPersonsView(arc);
    } else if (state.recordView === 'realms') {
      titleHtml = state.recordRealm ? ('势力地域<small>' + esc(String(state.recordRealm).split('|')[1]||'') + ' · 史料汇聚</small>') : '势力地域<small>按势力 / 疆域聚合史料</small>';
      scrollHtml = shiRealmsView(arc);
    } else {
      // library
      titleHtml = shiCatDef(state.recordTab).label + '<small>' + shiLibHint(state.recordTab) + '</small>';
      sortHtml = [['era','年序'],['ref','引征']].map(function(o){ return '<button type="button" class="sortb ' + (state.recordSort===o[0]?'active':'') + '" data-desk-action="record-sort-desk" data-sort="' + attr(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('');
      var chips = []; var facet = state.recordFacet || {};
      Object.keys(facet).forEach(function(k){ (facet[k]||[]).forEach(function(v){ var lbl = k==='authority'?shiAuthDef(v).label:(k==='source'?shiSrcDef(v).l:v); chips.push('<button type="button" class="afilter" data-desk-action="record-facet-desk" data-dim="' + attr(k) + '" data-val="' + attr(v) + '">' + esc(lbl) + ' ✕</button>'); }); });
      var rows = shiLibRows(arc);
      if (!rows.length) { scrollHtml = '<div class="empty"><b>未检得此类档案</b><p>调整检索维度或关键词。</p></div>'; }
      else if (state.recordTab === 'biannian') {
        var aff = rows.filter(function(x){ return x.sub==='affair'; }), ann = rows.filter(function(x){ return x.sub==='annal'; }), chr = rows.filter(function(x){ return x.sub==='chronicle'; });
        var hh = '';
        if (aff.length) hh += '<div class="cat-group-t">进行中事势</div>' + aff.map(function(x){ return shiEntry(x); }).join('');
        if (ann.length) hh += '<div class="cat-group-t">年度正史</div>' + ann.map(function(x){ return shiEntry(x); }).join('');
        if (chr.length) hh += '<div class="cat-group-t">永久编年</div>' + chr.map(function(x){ return shiEntry(x); }).join('');
        scrollHtml = hh;
      } else { scrollHtml = rows.map(function(x){ return shiEntry(x); }).join(''); }
      chips.push('<span class="cat-count">共 ' + rows.length + ' 卷</span>');
      activeHtml = chips.join('');
    }
    return '<div class="main-tools"><div class="main-title">' + titleHtml + '</div><div class="cat-sort">' + sortHtml + '</div></div><div class="cat-active">' + activeHtml + '</div><div class="main-scroll">' + scrollHtml + '</div>';
  }

  // ── 右·卷宗详阅 (四类各异) ──
  function shiCommonTail(arc, x){
    var html = '';
    if (x.annotation) html += '<div class="fo-annot"><p>' + esc(x.annotation) + '</p></div>';
    var rr = '';
    if (x.sources && x.sources.length) rr += '<div><span class="rn-lbl">来源</span>' + esc(x.sources.join('、')) + '</div>';
    if (x.basis) rr += '<div><span class="rn-lbl">依据</span>' + esc(x.basis) + '</div>';
    if (x.evidence) rr += '<div><span class="rn-lbl">佐证</span>' + esc(x.evidence) + '</div>';
    if (rr) html += '<div class="fo-sect"><div class="fo-sect-t">引征</div><div class="refnote">' + rr + '</div></div>';
    var seen = shiCrossRefs(arc, x);
    if (seen.length) html += '<div class="fo-sect"><div class="fo-sect-t">互见 · 同期相关卷宗</div>' + seen.map(function(r){ return '<button type="button" class="xref" data-desk-action="record-xref-desk" data-id="' + attr(r.id) + '" data-cat="' + attr(r.cat) + '"><span class="xr-kind" style="background:' + shiCatDef(r.cat).c + '">' + esc(shiCatDef(r.cat).g) + '</span><span class="xr-t">' + esc(shiTitleOf(r)) + '</span><span class="xr-go">详阅 ›</span></button>'; }).join('') + '</div>';
    var assoc = '';
    (x.persons||[]).forEach(function(p){ assoc += '<button type="button" class="atag" data-desk-action="record-person-desk" data-person="' + attr(p) + '">▣ ' + esc(p) + '</button>'; });
    (x.factions||[]).forEach(function(f){ assoc += '<button type="button" class="atag fac" data-desk-action="record-realm-desk" data-realm="' + attr('fac|'+f) + '">' + esc(f) + '</button>'; });
    (x.regions||[]).forEach(function(r){ assoc += '<button type="button" class="atag reg" data-desk-action="record-realm-desk" data-realm="' + attr('reg|'+r) + '">' + esc(r) + '</button>'; });
    if (assoc) html += '<div class="fo-sect"><div class="fo-sect-t">关联(可跳检)</div><div class="assoc">' + assoc + '</div></div>';
    var exportFn = x.cat==='qiju'?'_qijuExport':(x.cat==='jishi'?'_jishiExport':(x.cat==='biannian'?'_bnExport':'_sjlExport'));
    html += '<div class="fo-acts"><button type="button" class="fact red" data-desk-action="record-annotate-desk" data-id="' + attr(x.id) + '">' + (x.annotation?'改御批':'御批') + '</button><button type="button" class="fact" data-desk-action="record-archive-desk" data-record="shilu">摘录</button><button type="button" class="fact" onclick="if(window.' + exportFn + ')window.' + exportFn + '()">导出</button></div>';
    return html;
  }
  function shiFolio(arc){
    if (!state.recordId) return '<div class="folio-empty"><span class="fe-seal">阅</span><b>择卷详阅</b><p>检索或择一卷宗，<br>此处展其全文、引征与关联。</p></div>';
    var x = shiById(arc, state.recordId);
    if (!x) return '<div class="folio-empty"><span class="fe-seal">阅</span><b>择卷详阅</b><p>该卷已不在当前库中，<br>另择一卷查阅。</p></div>';
    var starBtn = '<button type="button" class="fo-star' + (x.starred?' on':'') + '" data-desk-action="record-star-desk" data-id="' + attr(x.id) + '">' + (x.starred?'★':'☆') + '</button>';
    var head = '<div class="fo-head"><span class="fo-seal ' + x.authority + '">' + esc(shiAuthDef(x.authority).g) + '</span><div class="fo-htext"><div class="fo-title">' + fullRecordText(shiTitleOf(x), '未题', 'records-detail-title-full-v5') + '</div><div class="fo-sub">';
    var html = '';
    if (x.cat === 'shiji') {
      head += '<span class="ftag" style="background:' + shiTypeColor(x.type) + '">' + esc(x.type) + '</span><span>史记·第 ' + esc(x.turn) + ' 回</span><span>·</span><span>' + esc(x.era) + (x.date?'·'+esc(x.date):'') + '</span></div></div>' + starBtn + '</div>';
      html = head;
      if (x.shilu) html += '<div class="tiwen shilu"><div class="tiwen-lbl">实 录<small>正史体</small></div><div class="tiwen-body">' + fullRecordText(x.shilu, '', 'records-detail-body-full-v5') + '</div></div>';
      if (x.shizhengji) html += '<div class="tiwen szj"><div class="tiwen-lbl">时政记<small>' + esc(x.szjTitle||'') + '</small></div><div class="tiwen-body">' + fullRecordText(x.shizhengji, '', 'records-detail-body-full-v5') + '</div></div>';
      if (x.zhengwen) html += '<div class="tiwen zhengwen"><div class="tiwen-lbl">政 文<small>推演纪实</small></div><div class="tiwen-body">' + fullRecordText(x.zhengwen, '', 'records-detail-body-full-v5') + '</div></div>';
      if (x.houren) html += '<div class="tiwen houren"><div class="tiwen-lbl">后人戏说<small>稗野·参考</small></div><div class="tiwen-body">' + fullRecordText(x.houren, '', 'records-detail-body-full-v5') + '</div></div>';
      if (!x.shilu && !x.shizhengji && !x.zhengwen && !x.houren && x.text) html += '<div class="qjblock">' + fullRecordText(x.text, '', 'records-detail-body-full-v5') + '</div>';
      if (x.personnel && x.personnel.length) html += '<div class="fo-sect"><div class="fo-sect-t">人事变动</div><div class="personnel">' + x.personnel.map(function(p){ return '<div class="prow">' + shiFaceImg(p.name || '', 'pn-face') + '<span class="pn">' + esc(p.name||'') + '</span><span class="pc">' + esc(p.change||p.to||p.office||'') + '</span></div>'; }).join('') + '</div></div>';
      if (x.edicts && x.edicts.length) html += '<div class="fo-sect"><div class="fo-sect-t">本回诏令</div>' + x.edicts.map(function(e){ return '<div class="edict-line"><b>' + esc(e.k) + '</b>' + esc(e.t) + '</div>'; }).join('') + '</div>';
      if (x.delta && x.delta.length) html += '<div class="fo-sect"><div class="fo-sect-t">国势变化</div><div class="delta-grid">' + x.delta.map(function(d){ return '<span class="dbig ' + d.dir + '">' + esc(d.k) + ' ' + esc(d.v) + '</span>'; }).join('') + '</div></div>';
      html += shiCommonTail(arc, x);
    } else if (x.cat === 'qiju') {
      var col = SHI_QJ_CAT[x.category] || '#a8833a';
      head += '<span class="ftag" style="background:' + col + '">' + esc(x.category) + '</span><span>起居注·' + esc(x.date) + '</span></div></div>' + starBtn + '</div>';
      html = head;
      if (x.body) html += '<div class="qjblock">' + fullRecordText(x.body, '', 'records-detail-body-full-v5') + '</div>';
      if (x.edicts && x.edicts.length) html += '<div class="fo-sect"><div class="fo-sect-t">本回诏令</div>' + x.edicts.map(function(e){ return '<div class="edict-line"><b>' + esc(e.k) + '</b>' + esc(e.t) + '</div>'; }).join('') + '</div>';
      html += shiCommonTail(arc, x);
    } else if (x.cat === 'jishi') {
      var sd = shiSrcDef(x.source);
      head += '<span class="ftag" style="background:#4a5e8a">' + esc(sd.l) + '</span><span>纪事·' + esc(x.date) + '</span></div></div>' + starBtn + '</div>';
      html = head;
      if (x.topic) html += '<div class="fo-sect"><div class="fo-sect-t">议题</div><div class=" js-topic">' + esc(x.topic) + '</div></div>';
      html += '<div class="fo-sect"><div class="fo-sect-t">问对</div><div class="dialog"><div class="dline q"><div class="dl-who">朕</div><div class="dl-text">' + esc(x.playerSaid || '（未录）') + '</div></div><div class="dline a"><div class="dl-who has-face">' + shiFaceImg(x.char || '对方', 'dl-face') + '<span>' + esc(x.char || '对方') + '</span></div><div class="dl-text">' + esc(x.npcSaid || '（未录）') + '</div></div></div>';
      if (x.outcome) html += '<div class="dl-ruling"><b>结论</b>' + esc(x.outcome) + '</div>';
      html += '</div>' + shiCommonTail(arc, x);
    } else if (x.sub === 'annal') {
      head += '<span class="ftag" style="background:var(--gold-d)">年度正史</span><span>' + esc(x.year||x.era||'') + '</span></div></div>' + starBtn + '</div>';
      html = head + '<div class="annal">' + fullRecordText(x.annal || x.body || '', '', 'records-detail-body-full-v5') + '</div>' + (x.afterword?'<div class="afterword"><p>' + fullRecordText(x.afterword, '', 'records-detail-body-full-v5') + '</p></div>':'') + shiCommonTail(arc, x);
    } else {
      // affair / chronicle
      head += '<span class="ftag" style="background:' + shiTypeColor(x.category) + '">' + esc(x.category||'编年') + '</span><span>编年·' + (x.sub==='affair'?'长期事势':'永久编年') + '</span></div></div>' + starBtn + '</div>';
      html = head + '<div class="qjblock">' + fullRecordText(x.body || x.text || '', '', 'records-detail-body-full-v5') + '</div>';
      if (x.sub === 'affair') {
        var span = (x.endTurn - x.startTurn) || 1;
        var pct = Math.max(4, Math.min(100, x.progress || Math.round((x.nowTurn - x.startTurn)/span*100)));
        html += '<div class="fo-sect"><div class="fo-sect-t">事势进程</div><div class="timeline2"><span class="tl2-done" style="width:' + pct + '%"></span></div><div class="bn-elapsed">' + (x.startTurn?('第 ' + x.startTurn + ' 回起 · 已历 <b>' + Math.max(0,x.nowTurn-x.startTurn) + '</b> 回 · '):'') + pct + '%</div></div>';
      }
      html += shiCommonTail(arc, x);
    }
    return html;
  }

  // ── 导出按钮 (按当前库·复用现成 _sjlExport/_qijuExport/_jishiExport/_bnExport) ──
  // ── 导出·按当前视图/检索范围 (而非固定整库·复用 clipboard/download) ──
  function shiScopeLabel(){
    if (String(state.recordSearch||'').trim()) return '检索“' + state.recordSearch.trim() + '”';
    if (state.recordView === 'library') return shiCatDef(state.recordTab).label;
    if (state.recordView === 'persons' && state.recordPerson) return '人物·' + state.recordPerson;
    if (state.recordView === 'realms' && state.recordRealm) return '势力地域·' + (String(state.recordRealm).split('|')[1] || '');
    if (state.recordView === 'timeline') return '时间轴总览';
    if (state.recordView === 'overview') return '馆藏全览';
    if (state.recordView === 'persons') return '人物列传名录';
    if (state.recordView === 'realms') return '势力地域名录';
    return '史册库';
  }
  function shiCollectScopeRows(arc){
    if (String(state.recordSearch||'').trim()) {
      var q = state.recordSearch.trim().toLowerCase();
      return arc.filter(function(x){ return String(x.needle||'').toLowerCase().indexOf(q) >= 0; });
    }
    if (state.recordView === 'library') return shiLibRows(arc);
    if (state.recordView === 'persons' && state.recordPerson) return shiRecsOfPerson(arc, state.recordPerson);
    if (state.recordView === 'realms' && state.recordRealm) { var rk = String(state.recordRealm).split('|'); return shiRecsOfRealm(arc, rk[1], rk[0]); }
    if (state.recordView === 'timeline') return arc.filter(function(x){ return x.sub !== 'annal'; });
    return arc;
  }
  function shiFormatScopeText(rows, label){
    var lines = rows.map(function(x){
      var head = '【' + shiCatDef(x.cat).label + '·' + shiTitleOf(x) + '】';
      var meta = [x.era, x.date, x.type, shiAuthDef(x.authority).label].filter(Boolean).join(' · ');
      var body = [];
      if (x.cat === 'shiji') {
        if (x.shilu) body.push('实录：' + x.shilu);
        if (x.shizhengji) body.push('时政记：' + x.shizhengji);
        if (x.zhengwen) body.push('政文：' + x.zhengwen);
        if (x.houren) body.push('后人戏说：' + x.houren);
        if (!body.length && x.text) body.push(x.text);
      } else if (x.cat === 'jishi') {
        if (x.topic) body.push('议题：' + x.topic);
        if (x.playerSaid) body.push('上：' + x.playerSaid);
        if (x.npcSaid) body.push((x.char || '对方') + '：' + x.npcSaid);
        if (x.outcome) body.push('结论：' + x.outcome);
      } else if (x.sub === 'annal') {
        body.push(x.annal || x.body || ''); if (x.afterword) body.push('史臣曰：' + x.afterword);
      } else { body.push(x.body || x.text || ''); }
      if (x.annotation) body.push('御批：' + x.annotation);
      return head + '\n' + meta + '\n' + body.filter(Boolean).join('\n');
    });
    return '史册库·' + label + '\n共 ' + rows.length + ' 卷\n\n' + lines.join('\n\n———\n\n');
  }
  function shiExportDownload(txt){
    try {
      var a = document.createElement('a');
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
      a.download = 'shice_' + (((window.GM||{}).saveName) || 'export') + '.txt';
      a.click();
      if (window.toast) window.toast('已导出');
    } catch(_) {}
  }
  function shiExportCurrentScope(){
    var arc = shiBuildArchive();
    var rows = shiCollectScopeRows(arc) || [];
    var label = shiScopeLabel();
    if (!rows.length) { if (window.toast) window.toast('当前范围无可导出的卷宗'); return; }
    var txt = shiFormatScopeText(rows, label);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function(){ if (window.toast) window.toast('已复制 ' + rows.length + ' 卷（' + label + '）'); }).catch(function(){ shiExportDownload(txt); });
      } else { shiExportDownload(txt); }
    } catch(_) { shiExportDownload(txt); }
  }
  function shiExportButton(){
    var label = String(state.recordSearch||'').trim() ? '导出检索结果' : (state.recordView === 'library' ? '导出本库' : '导出此卷');
    return '<button type="button" class="gbtn" onclick="var b=window.TMPhase8FormalBridge;if(b&&b.records&&b.records.exportCurrentScope)b.records.exportCurrentScope()">' + esc(label) + '</button>';
  }

  // ── 主入口·组装 .shi-yuan 三栏多视图 ──
  function renderFormalRecordsPanel(){
    installShiguanYuanStyles();
    if (!state.recordView) state.recordView = 'library';
    if (!state.recordTab || state.recordTab === 'shilu') state.recordTab = state.recordTab === 'shilu' ? 'qiju' : (state.recordTab || 'shiji');
    if (!state.recordSort) state.recordSort = 'era';
    state.recordFacet = state.recordFacet || {};
    var arc = shiBuildArchive();
    var titlebar = '<div class="shi-titlebar"><div class="st-center"><div class="st-main">史 册 库</div><div class="st-sub">史官实录　稽古考献　博征旁稽</div></div>' + shiHdChips(arc) + '</div>';
    var globalbar = '<div class="global-bar"><div class="gsearch"><input data-desk-record-search value="' + attr(state.recordSearch || '') + '" placeholder="跨库全检 —— 题名、人物、地域、事类、年月、正文……"><span class="gs-scope">遍检四库</span></div>' + shiExportButton() + '</div>';
    var nav = '<aside class="panel nav"><div class="panel-hd"><span class="seal">史</span><div><b>史册书库</b><span>视图 · 四库 · 检索</span></div></div><div class="nav-scroll">' + shiNav(arc) + '</div><div class="nav-stat">' + shiNavStat(arc) + '</div></aside>';
    var main = '<main class="panel main">' + shiMain(arc) + '</main>';
    var folio = '<aside class="panel folio"><div class="panel-hd"><span class="seal" style="background:linear-gradient(155deg,var(--gold-hi),var(--gold-d))">阅</span><div><b>卷宗详阅</b><span>正文 · 引征 · 关联</span></div></div><div class="folio-scroll">' + shiFolio(arc) + '</div></aside>';
    return '<section class="shi-yuan">' + titlebar + globalbar + '<div class="shi-body">' + nav + main + folio + '</div></section>';
  }


  // ── public API attach (供 bridge / 其他 module 用) ────────────────
  bridge.records = bridge.records || {};
  bridge.records.renderFormalRecordsPanel = renderFormalRecordsPanel;
  bridge.records.exportCurrentScope = shiExportCurrentScope;
  bridge.records.renderFormalRecordShiji = renderFormalRecordShiji;
  bridge.records.renderFormalRecordQiju = renderFormalRecordQiju;
  bridge.records.renderFormalRecordJishi = renderFormalRecordJishi;
  bridge.records.renderFormalRecordBiannian = renderFormalRecordBiannian;
})();
