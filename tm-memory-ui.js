// @ts-check
// ============================================================
// tm-memory-ui.js — 12 表可视化 + 细粒度锁 + 软删除 + 皇命 CRUD
//                   （2026-04-30 Phase 3.1/3.2/3.3 合一）
//
// 设计来源：蚀心入魔三层结构（导航条 + 仪表盘 + 表格卡片）·最小可用版
// 风格：游戏 UI 内的"记忆"标签页·按需打开
// 键位：调试期可全局热键 Ctrl+M 切换
// ============================================================

(function(global) {
  'use strict';

  var PANEL_ID = 'tm-mem-panel';
  var STYLE_ID = 'tm-mem-style';
  var STATE = {
    open: false,
    activeKey: 'curStatus',
    prevSnapshot: null,    // 上次渲染时的快照·用于 diff 高亮
    showLocked: true
  };

  function _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + PANEL_ID + '{position:fixed;right:20px;top:60px;width:720px;max-height:80vh;',
      'background:#1a1410;color:#d4c5a9;border:1px solid #6a5635;box-shadow:0 4px 24px rgba(0,0,0,0.6);',
      'z-index:99999;display:none;font-family:"Source Han Serif SC","Noto Serif",serif;font-size:13px;}',
      '#' + PANEL_ID + '.open{display:flex;flex-direction:column;}',
      '#' + PANEL_ID + ' .mem-hdr{padding:8px 12px;background:#2a1f17;border-bottom:1px solid #6a5635;',
      'display:flex;align-items:center;justify-content:space-between;}',
      '#' + PANEL_ID + ' .mem-hdr h3{margin:0;font-size:15px;color:#e3cb95;}',
      '#' + PANEL_ID + ' .mem-hdr button{background:#3a2a1f;color:#d4c5a9;border:1px solid #6a5635;',
      'padding:3px 10px;cursor:pointer;font-size:12px;}',
      '#' + PANEL_ID + ' .mem-hdr button:hover{background:#4a3525;}',
      '#' + PANEL_ID + ' .mem-nav{display:flex;flex-wrap:wrap;padding:6px;background:#221912;',
      'border-bottom:1px solid #4a3525;}',
      '#' + PANEL_ID + ' .mem-nav button{margin:2px;padding:3px 8px;background:transparent;',
      'color:#a89878;border:1px solid #4a3525;cursor:pointer;font-size:11px;}',
      '#' + PANEL_ID + ' .mem-nav button.active{background:#5a4025;color:#fff8e0;border-color:#9a7855;}',
      '#' + PANEL_ID + ' .mem-nav button:hover{background:#3a2a1f;}',
      '#' + PANEL_ID + ' .mem-body{flex:1;overflow:auto;padding:10px;}',
      '#' + PANEL_ID + ' .mem-meta{margin-bottom:8px;padding:6px;background:#251a13;',
      'border-left:3px solid #9a7855;font-size:11px;color:#a89878;}',
      '#' + PANEL_ID + ' table.mem-tbl{width:100%;border-collapse:collapse;font-size:12px;}',
      '#' + PANEL_ID + ' table.mem-tbl th{background:#3a2a1f;color:#e3cb95;padding:4px 6px;',
      'text-align:left;border:1px solid #4a3525;}',
      '#' + PANEL_ID + ' table.mem-tbl td{padding:3px 6px;border:1px solid #2a1f17;',
      'vertical-align:top;max-width:200px;word-break:break-word;}',
      '#' + PANEL_ID + ' table.mem-tbl tr.changed{background:#3a3520;}',
      '#' + PANEL_ID + ' table.mem-tbl tr.pending-delete{background:#3a1a1a;text-decoration:line-through;}',
      '#' + PANEL_ID + ' table.mem-tbl tr:hover{background:#2a2018;}',
      '#' + PANEL_ID + ' td.locked{background:#1a3a2a;}',
      '#' + PANEL_ID + ' td.editable{cursor:pointer;}',
      '#' + PANEL_ID + ' td.editable:hover{background:#3a2a1f;}',
      '#' + PANEL_ID + ' .mem-empty{padding:20px;text-align:center;color:#7a6855;font-style:italic;}',
      '#' + PANEL_ID + ' .mem-foot{padding:6px 12px;background:#221912;border-top:1px solid #4a3525;',
      'display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#a89878;}',
      '#' + PANEL_ID + ' .mem-foot button{margin-left:6px;background:#3a2a1f;color:#d4c5a9;',
      'border:1px solid #6a5635;padding:3px 10px;cursor:pointer;font-size:11px;}',
      '#' + PANEL_ID + ' .mem-foot button.alert{background:#5a1a1a;color:#fff;animation:mem-shake 0.5s infinite alternate;}',
      '@keyframes mem-shake{0%{transform:translateX(0);}100%{transform:translateX(2px);}}',
      '#' + PANEL_ID + ' .sentinel-info{color:#5a8a5a;}',
      '#' + PANEL_ID + ' .sentinel-warn{color:#a8a058;}',
      '#' + PANEL_ID + ' .sentinel-error{color:#d85858;}',
      // 皇命专用编辑器
      '#' + PANEL_ID + ' .imperial-editor{padding:8px;background:#251a13;border-left:3px solid #d4a85a;}',
      '#' + PANEL_ID + ' .imperial-editor input,#' + PANEL_ID + ' .imperial-editor textarea{',
      'background:#1a1410;color:#d4c5a9;border:1px solid #4a3525;padding:3px 6px;',
      'font-family:inherit;font-size:12px;width:100%;box-sizing:border-box;margin-bottom:4px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function _buildPanel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<div class="mem-hdr">' +
        '<h3>📜 12 表结构化记忆</h3>' +
        '<div>' +
          '<button id="mem-snapshot-btn" title="生成穿越快照">📸 快照</button> ' +
          '<button id="mem-timetravel-btn" title="穿越回某回合">⏪ 穿越</button> ' +
          '<button id="mem-semantic-btn" title="启用本地语义检索">🔍 语义</button> ' +
          '<button id="mem-rebuild-btn" title="从 shijiHistory/evtLog/Chronicle 反向重建关键表（损坏修复用）">🔧 重建</button> ' +
          '<button id="mem-close-btn">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="mem-nav" id="mem-nav"></div>' +
      '<div class="mem-body" id="mem-body"></div>' +
      '<div class="mem-foot">' +
        '<span id="mem-sentinel-summary"></span>' +
        '<span><button id="mem-commit-deletes-btn">提交待删除</button></span>' +
      '</div>';
    document.body.appendChild(panel);
    // 事件绑定
    panel.querySelector('#mem-close-btn').addEventListener('click', closePanel);
    panel.querySelector('#mem-snapshot-btn').addEventListener('click', _onSnapshot);
    panel.querySelector('#mem-timetravel-btn').addEventListener('click', _onTimeTravel);
    panel.querySelector('#mem-semantic-btn').addEventListener('click', _onSemanticToggle);
    var _rb = panel.querySelector('#mem-rebuild-btn');
    if (_rb) _rb.addEventListener('click', _onRebuild);
    panel.querySelector('#mem-commit-deletes-btn').addEventListener('click', _onCommitDeletes);
    return panel;
  }

  function _onRebuild() {
    if (!window.MemTables || !MemTables.rebuildFromHistory) { alert('重建模块不可用'); return; }
    if (!confirm('从 shijiHistory + evtLog + ChronicleTracker 反向重建『当前局势』『事件历史』『大事记摘要』三张表？\n\n此操作会清空这三张表的当前数据再用历史重建·其他 9 张表保持不变。\n\n（用于：旧存档迁移 / 表损坏 / 想重新基线化时）')) return;
    var r = MemTables.rebuildFromHistory({ clear: true });
    if (r.ok) {
      alert('重建完成：\n  当前局势 ' + r.stats.curStatus + ' 行\n  事件历史 ' + r.stats.eventHistory + ' 行\n  大事记摘要 ' + r.stats.majorEventsBrief + ' 行\n\n共 ' + r.totalRows + ' 行');
      _renderBody();
    } else {
      alert('重建失败：' + (r.reason || ''));
    }
  }

  function _renderNav() {
    if (!window.MemTables) return;
    var nav = document.getElementById('mem-nav');
    if (!nav) return;
    nav.innerHTML = '';
    MemTables.SHEET_DEFS.forEach(function(d) {
      var btn = document.createElement('button');
      btn.textContent = '[' + d.idx + '] ' + d.name;
      btn.dataset.key = d.key;
      if (d.key === STATE.activeKey) btn.classList.add('active');
      btn.addEventListener('click', function() {
        STATE.activeKey = d.key;
        _renderNav();
        _renderBody();
      });
      nav.appendChild(btn);
    });
  }

  function _renderBody() {
    if (!window.MemTables) return;
    var body = document.getElementById('mem-body');
    if (!body) return;
    var def = MemTables.SHEET_BY_KEY[STATE.activeKey];
    if (!def) { body.innerHTML = '<div class="mem-empty">未知表</div>'; return; }
    var t = MemTables.getSheet(STATE.activeKey);
    if (!t) { body.innerHTML = '<div class="mem-empty">表未初始化</div>'; return; }

    var html = '';
    // Meta 头：表说明
    html += '<div class="mem-meta">';
    html += '<b>用途</b>：' + (def.note || '') + '<br>';
    html += '<b>频率</b>：' + (def.freq || '') + (def.appendOnly ? '·<span style="color:#d8a858">append-only</span>' : '') + '·<b>记录</b>：' + t.rows.length + ' 行';
    html += '</div>';

    // 皇命表特殊·走 imperialEditor
    if (def.key === 'imperialEdict') {
      html += _renderImperialEditor(def, t);
      body.innerHTML = html;
      _bindImperialEvents();
      return;
    }

    if (!t.rows.length) {
      html += '<div class="mem-empty">该表为空。Init 策略：' + (def.initNode || '') + '</div>';
      body.innerHTML = html;
      return;
    }

    // 表格
    var pendingDel = (GM._memTables._pendingDeletes && GM._memTables._pendingDeletes[def.key]) || [];
    var locks = (GM._memTables._editorLocks && GM._memTables._editorLocks[def.key]) || { rows: [], cols: [], cells: [] };
    var prev = STATE.prevSnapshot && STATE.prevSnapshot[def.key];

    html += '<table class="mem-tbl">';
    html += '<thead><tr><th>#</th>';
    def.columns.forEach(function(c, i) {
      var locked = locks.cols && locks.cols.indexOf(i) >= 0;
      html += '<th title="colIdx=' + i + '">' + c + (locked ? ' 🔒' : '') + '</th>';
    });
    html += '<th>操作</th></tr></thead><tbody>';
    t.rows.forEach(function(row, ri) {
      var classes = [];
      if (pendingDel.indexOf(ri) >= 0) classes.push('pending-delete');
      // diff 高亮
      if (prev && prev.rows && prev.rows[ri] && JSON.stringify(prev.rows[ri]) !== JSON.stringify(row)) {
        classes.push('changed');
      }
      html += '<tr class="' + classes.join(' ') + '"><td>' + ri + '</td>';
      row.forEach(function(v, ci) {
        var cellLocked = (locks.rows && locks.rows.indexOf(ri) >= 0) ||
                         (locks.cols && locks.cols.indexOf(ci) >= 0) ||
                         (locks.cells && locks.cells.some(function(c){ return c[0]===ri && c[1]===ci; }));
        var safeVal = String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        html += '<td class="' + (cellLocked ? 'locked' : 'editable') + '" data-row="' + ri + '" data-col="' + ci + '">' + safeVal + '</td>';
      });
      html += '<td>' +
        '<button class="mem-lock-row" data-row="' + ri + '" title="锁定本行">🔒</button>' +
        '<button class="mem-row-history" data-row="' + ri + '" title="查看本行修改历史">史</button>' +
        '<button class="mem-soft-del" data-row="' + ri + '" title="标记软删除">🗑</button>' +
        '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;

    // 绑定单元格点击编辑
    body.querySelectorAll('td.editable').forEach(function(td) {
      td.addEventListener('click', function() { _editCell(def, parseInt(td.dataset.row, 10), parseInt(td.dataset.col, 10)); });
    });
    body.querySelectorAll('.mem-lock-row').forEach(function(btn) {
      btn.addEventListener('click', function() { _toggleRowLock(def.key, parseInt(btn.dataset.row, 10)); });
    });
    body.querySelectorAll('.mem-soft-del').forEach(function(btn) {
      btn.addEventListener('click', function() { _softDelete(def.key, parseInt(btn.dataset.row, 10)); });
    });
    body.querySelectorAll('.mem-row-history').forEach(function(btn) {
      btn.addEventListener('click', function() { _showRowHistory(def, parseInt(btn.dataset.row, 10)); });
    });
  }

  function _showRowHistory(def, ri) {
    if (!MemTables.getCellHistory) { alert('cellHistory 不可用'); return; }
    var hist = MemTables.getCellHistory(def.key, ri);
    if (!hist || hist.length === 0) { alert('该行无修改历史（仍为原始值或未变更）'); return; }
    var lines = hist.slice().reverse().map(function(h) {
      var col = def.columns[h.col] || ('列' + h.col);
      return 'T' + h.turn + ' [' + (h.actor || 'ai') + '] ' + col + ': "' + (h.oldVal || '∅') + '" → "' + (h.newVal || '∅') + '"';
    });
    alert('[' + def.name + '] 行 ' + ri + ' 修改历史（最近在前·共 ' + hist.length + ' 条）：\n\n' + lines.join('\n'));
  }

  // 皇命表专用渲染
  function _renderImperialEditor(def, t) {
    var html = '<div class="imperial-editor">';
    html += '<div style="margin-bottom:8px;color:#d4a85a;font-weight:bold;">📜 皇命专用 · AI 永读不写·每回合必投</div>';
    html += '<div style="font-size:11px;color:#a89878;margin-bottom:8px;">玩家在此处添加的钉子条目（如"祖训不可改""礼部尚书必由王某担任"）会被注入到每回合 sc1 prompt 顶部·AI 严格遵循。<b>勾选"天机"</b>则为隐藏伏笔·仅 sc1 可见 sc15/sc2 不见。</div>';
    html += '<table class="mem-tbl"><thead><tr><th>#</th><th>优先级</th><th>皇命内容</th><th>生效条件</th><th>颁布回合</th><th>天机</th><th>操作</th></tr></thead><tbody>';
    t.rows.forEach(function(r, i) {
      var isSecret = (r[4] === 'true' || r[4] === true || r[4] === '是' || r[4] === '1');
      html += '<tr' + (isSecret ? ' style="background:#2a1a3a;"' : '') + '>';
      html += '<td>' + i + '</td>';
      html += '<td><input type="number" min="1" max="10" value="' + (r[0] || '5') + '" data-row="' + i + '" data-col="0" class="imp-edit"></td>';
      html += '<td><textarea rows="2" data-row="' + i + '" data-col="1" class="imp-edit">' + (r[1] || '') + '</textarea></td>';
      html += '<td><input type="text" value="' + (r[2] || '') + '" data-row="' + i + '" data-col="2" class="imp-edit"></td>';
      html += '<td><input type="text" value="' + (r[3] || '') + '" data-row="' + i + '" data-col="3" class="imp-edit"></td>';
      html += '<td style="text-align:center;"><input type="checkbox"' + (isSecret ? ' checked' : '') + ' data-row="' + i + '" data-col="4" class="imp-edit-secret" title="勾选=隐藏天机·仅 sc1 可见"></td>';
      html += '<td><button class="imp-del" data-row="' + i + '">删</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '<div style="margin-top:8px;"><button id="imp-add-btn">+ 新增皇命</button></div>';

    // P13.4: 候选审批列表（AI 推断的待审皇命候选）
    var pending = (typeof GM !== 'undefined' && GM && Array.isArray(GM._imperialCandidates)) ? GM._imperialCandidates.filter(function(c){return c.status==='pending';}) : [];
    if (pending.length > 0) {
      html += '<div style="margin-top:16px;padding:8px;background:#1a2a3a;border-left:3px solid #6b9eff;">';
      html += '<div style="margin-bottom:6px;color:#9bbfff;font-weight:bold;">🔍 AI 推断的皇命候选 (待审 ' + pending.length + ' 条·KokoroMemo auto_review 范式)</div>';
      html += '<div style="font-size:11px;color:#a89878;margin-bottom:8px;">sc25 后台推断的"应有皇命"·importance≥0.8 && confidence≥0.85 的已自动批准·imp<0.3 的已自动拒绝·中间态在此等审。</div>';
      html += '<table class="mem-tbl"><thead><tr><th>内容</th><th>优先</th><th>条件</th><th>imp</th><th>conf</th><th>提议回合</th><th>操作</th></tr></thead><tbody>';
      pending.forEach(function(c, i) {
        html += '<tr>';
        html += '<td>' + (c.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</td>';
        html += '<td>' + c.priority + '</td>';
        html += '<td>' + c.condition + '</td>';
        html += '<td>' + Math.round(c.importance * 100) / 100 + '</td>';
        html += '<td>' + Math.round(c.confidence * 100) / 100 + '</td>';
        html += '<td>T' + c.proposedTurn + '</td>';
        html += '<td><button class="imp-cand-approve" data-idx="' + i + '">批准</button> <button class="imp-cand-reject" data-idx="' + i + '">拒绝</button></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function _bindImperialEvents() {
    var body = document.getElementById('mem-body');
    if (!body) return;
    var def = MemTables.SHEET_BY_KEY.imperialEdict;
    body.querySelectorAll('.imp-edit').forEach(function(el) {
      el.addEventListener('change', function() {
        var ri = parseInt(el.dataset.row, 10);
        var ci = parseInt(el.dataset.col, 10);
        var v = el.value;
        var values = {}; values[ci] = v;
        MemTables.editorWrite('imperialEdict', 'update', { rowIdx: ri, values: values });
      });
    });
    body.querySelectorAll('.imp-edit-secret').forEach(function(el) {
      el.addEventListener('change', function() {
        var ri = parseInt(el.dataset.row, 10);
        var ci = parseInt(el.dataset.col, 10);
        var values = {}; values[ci] = el.checked ? 'true' : '';
        MemTables.editorWrite('imperialEdict', 'update', { rowIdx: ri, values: values });
        _renderBody();
      });
    });
    body.querySelectorAll('.imp-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!confirm('删除此条皇命？')) return;
        MemTables.editorWrite('imperialEdict', 'delete', { rowIdx: parseInt(btn.dataset.row, 10) });
        _renderBody();
      });
    });
    var addBtn = body.querySelector('#imp-add-btn');
    if (addBtn) addBtn.addEventListener('click', function() {
      MemTables.editorWrite('imperialEdict', 'insert', {
        values: { 0: '5', 1: '（在此输入皇命内容·勾选天机列即变伏笔）', 2: '永久生效', 3: String((typeof GM !== 'undefined' && GM && GM.turn) || 1), 4: '' }
      });
      _renderBody();
    });

    // P13.4 候选审批按钮
    body.querySelectorAll('.imp-cand-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx, 10);
        var pending = GM._imperialCandidates.filter(function(c){return c.status==='pending';});
        var c = pending[idx];
        if (!c) return;
        MemTables.editorWrite('imperialEdict', 'insert', {
          values: {
            0: String(c.priority || 5),
            1: c.content,
            2: c.condition || '永久生效',
            3: String(c.proposedTurn || GM.turn || 1),
            4: ''
          }
        });
        c.status = 'approved';
        c.reviewedTurn = GM.turn || 1;
        _renderBody();
      });
    });
    body.querySelectorAll('.imp-cand-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx, 10);
        var pending = GM._imperialCandidates.filter(function(c){return c.status==='pending';});
        var c = pending[idx];
        if (!c) return;
        c.status = 'rejected';
        c.reviewedTurn = GM.turn || 1;
        _renderBody();
      });
    });
  }

  function _editCell(def, ri, ci) {
    var t = MemTables.getSheet(def.key);
    if (!t || !t.rows[ri]) return;
    var oldVal = String(t.rows[ri][ci] || '');
    var newVal = prompt('编辑 [' + def.name + '] 行 ' + ri + ' · 列 ' + def.columns[ci] + '：', oldVal);
    if (newVal == null) return;
    var values = {}; values[ci] = newVal;
    var r = MemTables.editorWrite(def.key, 'update', { rowIdx: ri, values: values });
    if (!r.ok) alert('编辑失败：' + r.reason);
    _renderBody();
  }

  function _toggleRowLock(sheetKey, ri) {
    if (typeof GM === 'undefined' || !GM || !GM._memTables) return;
    if (!GM._memTables._editorLocks[sheetKey]) GM._memTables._editorLocks[sheetKey] = { rows: [], cols: [], cells: [] };
    var L = GM._memTables._editorLocks[sheetKey];
    var idx = L.rows.indexOf(ri);
    if (idx >= 0) L.rows.splice(idx, 1);
    else L.rows.push(ri);
    _renderBody();
  }

  function _softDelete(sheetKey, ri) {
    var r = MemTables.deleteRow(sheetKey, ri, { soft: true });
    if (!r.ok) alert('软删除失败：' + r.reason);
    _renderBody();
    _updateFooter();
  }

  function _onCommitDeletes() {
    if (!confirm('真的要永久删除所有标记的待删除行？此操作不可撤销。')) return;
    var mem = (typeof GM !== 'undefined' && GM && GM._memTables) ? GM._memTables : null;
    Object.keys((mem && mem._pendingDeletes) || {}).forEach(function(k) {
      MemTables.commitPendingDeletes(k);
    });
    _renderBody();
    _updateFooter();
  }

  function _updateFooter() {
    var foot = document.getElementById('mem-sentinel-summary');
    if (!foot) return;
    var mem = (typeof GM !== 'undefined' && GM && GM._memTables) ? GM._memTables : null;
    var warns = (mem && mem._sentinelLog) || [];
    var recent = warns.slice(-1)[0];
    var pendingCount = 0;
    Object.keys((mem && mem._pendingDeletes) || {}).forEach(function(k) {
      pendingCount += (mem._pendingDeletes[k] || []).length;
    });
    foot.innerHTML = '哨兵：' + warns.length + ' 条警告' +
      (recent ? ' · 最新：<span class="sentinel-' + recent.level + '">' + recent.msg + '</span>' : '');
    var btn = document.getElementById('mem-commit-deletes-btn');
    if (btn) {
      if (pendingCount > 0) {
        btn.classList.add('alert');
        btn.textContent = '提交待删除 (' + pendingCount + ')';
      } else {
        btn.classList.remove('alert');
        btn.textContent = '提交待删除';
      }
    }
  }

  // ────── 工具按钮 ──────
  function _onSnapshot() {
    if (!window.StateSnapshot) { alert('快照模块未加载'); return; }
    StateSnapshot.save().then(function(r) {
      alert(r.ok ? '已保存第 ' + r.turn + ' 回合快照' : '保存失败：' + (r.reason || r.error));
    });
  }

  function _onTimeTravel() {
    if (!window.StateSnapshot) { alert('快照模块未加载'); return; }
    StateSnapshot.list().then(function(arr) {
      if (!arr.length) { alert('尚无可穿越的快照'); return; }
      var picks = arr.map(function(s) { return 'T' + s.turn + '（' + new Date(s.ts).toLocaleString() + '）'; }).join('\n');
      var t = prompt('选择穿越目标回合：\n\n' + picks + '\n\n输入回合数：');
      if (!t) return;
      var tn = parseInt(t, 10);
      if (isNaN(tn)) return;
      if (!confirm('确认穿越回 T' + tn + '？\n（当前状态会先自动存档·可日后再穿越回来。shijiHistory/evtLog 会回滚到该回合）')) return;
      StateSnapshot.timeTravel(tn).then(function(r) {
        if (r.ok) {
          alert('已穿越到 T' + r.restoredTurn + '·当前状态保存于 T' + r.savedFromTurn);
          if (typeof rerenderAll === 'function') try { rerenderAll(); } catch(_e){}
          _renderBody();
        } else {
          alert('穿越失败：' + r.reason);
        }
      });
    });
  }

  function _onSemanticToggle() {
    if (!window.SemanticRecall) { alert('语义检索模块未加载'); return; }
    var st = SemanticRecall.status();
    var lines = ['🔍 本地语义检索状态'];
    lines.push('  启用: ' + (st.enabled ? '✓' : '✗'));
    lines.push('  模型就绪: ' + (st.modelReady ? '✓' : (st.modelLoading ? '⏳ 加载中...' : '✗')));
    if (st.modelLoading || st.modelReady) {
      lines.push('  加载源: ' + (st.loadSource || '?'));
      if (st.downloadProgress > 0 && st.downloadProgress < 100) {
        lines.push('  下载进度: ' + Math.round(st.downloadProgress) + '%' + (st.downloadFile ? ' (' + st.downloadFile + ')' : ''));
      }
    }
    lines.push('  索引条目: ' + (st.indexSize || 0));
    lines.push('  最后索引 T: ' + (st.lastIndexedTurn || 0));
    if (st.error) lines.push('  ❌ 错误: ' + st.error);
    lines.push('');
    if (st.enabled) {
      lines.push('当前已启用·点确定可关闭·点取消保留。');
      if (confirm(lines.join('\n'))) {
        SemanticRecall.disable();
        alert('已关闭');
      }
    } else {
      lines.push('当前未启用·点确定启用并加载模型（约 23 MB·首次需 1-5 分钟）·点取消保留关闭。');
      lines.push('Electron 端若已用 npm run prepare-vendor 预下载·秒开。');
      if (!confirm(lines.join('\n'))) return;
      SemanticRecall.enable();
      alert('已启用·模型加载中...完成后会在 SC_RECALL 第 5 源生效。\n再点 🔍 按钮查看进度。');
    }
  }

  // ────── 暴露 API ──────
  function openPanel() {
    _injectStyle();
    var p = _buildPanel();
    p.classList.add('open');
    STATE.open = true;
    _renderNav();
    _renderBody();
    _updateFooter();
  }
  function closePanel() {
    var p = document.getElementById(PANEL_ID);
    if (p) p.classList.remove('open');
    STATE.open = false;
  }
  function togglePanel() { STATE.open ? closePanel() : openPanel(); }

  // 全局热键 Ctrl+M
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', function(e) {
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        togglePanel();
      }
    });
  }

  global.MemoryUI = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    refresh: function() { if (STATE.open) { _renderNav(); _renderBody(); _updateFooter(); } }
  };
})(typeof window !== 'undefined' ? window : this);
