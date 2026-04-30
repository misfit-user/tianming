// @ts-check
// ============================================================
// tm-memory-tables.js — 12 表结构化记忆系统（2026-04-30 Phase 1）
//
// 设计来源：综合参考五种酒馆插件——
//   · LSR 表格预设：12 表频率分层 + 思考-动作绑定 + 后置强调
//   · 蚀心入魔：每表 5 段触发说明 + append-only + 长字段周期压缩
//   · 全自动总结：10 维事件评分（在 sc25 后台异步打分，本模块仅提供 schema）
//   · ST-Prompt-Template：装饰器条件激活、变量树（在快照系统中实现）
//   · memos：本地语义检索（在 Phase 2 实现）
//
// 关键决策（与作者讨论后确定）：
//   1. 软对齐而非硬对齐：编码 T<turn>-<seq>·AI 给的优先采信·缺失系统补
//   2. 一致性哨兵警告而非双写锁定·允许单边写入
//   3. append-only 表保留 editor_force_delete 调试通道
//   4. 12 表围绕"皇帝-朝廷-诏令-改革-危机"语境，而非通用 RPG
//
// 数据落点：GM._memTables（每表一个键，对应 SHEET_DEFS）
// ============================================================

(function(global) {
  'use strict';

  // ────────────────────────────────────────────────────────────
  // §1 表 schema 定义（12 张表）
  // 每表字段：
  //   name        表名
  //   columns     列名数组（colIndex=0 是表头第 0 列）
  //   keyCol      逻辑主键列号（同主键则 update 而非 insert）
  //   freq        high/mid/low/readonly  影响 AI 写入策略
  //   appendOnly  true 则禁止 AI 的 update/delete（仅 editor_force_delete）
  //   maxLen      单条记录某列长度上限·超出由 AI 触发压缩
  //   note        给 AI 看的本表用途说明
  //   initNode    AI 在表为空时的初始化策略
  //   insertNode  AI 决定何时增加新行
  //   updateNode  AI 决定何时更新现有行
  //   deleteNode  AI 决定何时删除行（appendOnly 时为"禁止"）
  //   coded       是否使用 T<turn>-<seq> 软对齐编码
  //   alignWith   与哪张表通过编码对齐（一致性哨兵检查）
  // ────────────────────────────────────────────────────────────
  var SHEET_DEFS = [
    {
      idx: 0, key: 'curStatus', name: '当前局势',
      columns: ['国号', '帝号', '当前年号', '当前回合', '主要矛盾', '态势'],
      keyCol: 0, freq: 'high', appendOnly: false,
      note: '记录大局摘要·有且仅有一行·每回合更新',
      initNode: '游戏开始第一回合·根据剧本生成此表唯一一行',
      insertNode: '禁止操作·此表只允许唯一一行',
      updateNode: '每回合必更新当前回合数·态势随国势变迁更新·主要矛盾随局势变化',
      deleteNode: '禁止删除',
      coded: false
    },
    {
      idx: 1, key: 'courtNpc', name: '在朝NPC',
      columns: ['姓名', '品级', '官职', '党派', '势力', '忠诚', '地位'],
      keyCol: 0, freq: 'high', appendOnly: false,
      note: '记录现任在朝官员·一二三品按品级排序·致仕/死亡/罢黜则删除',
      initNode: '游戏开始第一回合·根据剧本初始百官生成',
      insertNode: '新晋拜相/拜将/任命入朝时插入',
      updateNode: '升迁/降职/换党/忠诚变化时更新对应行',
      deleteNode: '致仕/死亡/罢黜出朝时删除',
      coded: false
    },
    {
      idx: 2, key: 'charProfile', name: '角色档案',
      columns: ['姓名', '性别年龄', '出身', '历职', '性格', '能力素描', '生平要事', '死亡说明'],
      keyCol: 0, freq: 'low', appendOnly: false,
      note: '所有重要角色的稳定档案·区别于在朝NPC（流动）·此表是长期身份',
      initNode: '游戏开始第一回合·根据剧本生成所有 importance>=60 角色档案',
      insertNode: '出现新重要角色（例：某皇子成年、外族首领崭露头角）时插入',
      updateNode: '历职新增/重要事件后追加生平要事·死后填死亡说明',
      deleteNode: '禁止删除·死亡角色保留档案并标注死亡说明',
      maxLen: { '生平要事': 300 },
      coded: false
    },
    {
      idx: 3, key: 'edictsActive', name: '进行中诏令',
      columns: ['编码', '诏令名', '颁布回合', '类型', '当前阶段', '阻力', '关键人物', '预计完成'],
      keyCol: 0, freq: 'mid', appendOnly: false,
      note: '诏令生命周期跟踪·完成/废止后归档到大事记摘要表并从此表删除',
      initNode: '游戏开始时此表通常为空·除非剧本有未完成诏令',
      insertNode: '玩家颁布新诏令时·sc1 同步插入',
      updateNode: '阶段推进/阻力变化/关键人物变化时更新',
      deleteNode: '诏令完成/废止/搁置时·先归档到大事记摘要再删除',
      coded: true
    },
    {
      idx: 4, key: 'specialMeans', name: '特殊能力/手段',
      columns: ['能力名', '拥有人', '类型', '作用', '限制', '获得回合'],
      keyCol: 0, freq: 'mid', appendOnly: false,
      note: '记录角色掌握的特殊手段（密谍网/兵权/绝技/秘传）·区别于素质点',
      initNode: '游戏开始时根据剧本生成（如锦衣卫指挥使掌缇骑、督师有节钺）',
      insertNode: '获得新能力/手段时插入',
      updateNode: '能力增强/受限/转移持有人时更新',
      deleteNode: '失去/解除/能力终止时删除',
      coded: false
    },
    {
      idx: 5, key: 'importantItems', name: '重要物品',
      columns: ['物品名', '当前持有人', '所在地', '类型', '作用', '来源'],
      keyCol: 0, freq: 'mid', appendOnly: false,
      note: '记录传国玉玺/虎符/密信/宝器等关键物品流转',
      initNode: '游戏开始时根据剧本生成传国宝器、信物',
      insertNode: '新物品出现（贡品/铸造/出土/赏赐）时插入',
      updateNode: '物品流转时更新持有人/所在地·状态变化时更新',
      deleteNode: '物品被毁/遗失/化整为零时删除',
      coded: false
    },
    {
      idx: 6, key: 'organizations', name: '重要组织',
      columns: ['组织名', '类型', '首领', '已知核心成员', '宗旨', '影响范围'],
      keyCol: 0, freq: 'low', appendOnly: false,
      note: '党派/学派/秘社/教派/帮会等组织的稳定档案',
      initNode: '游戏开始时根据剧本生成主要党派和势力',
      insertNode: '新组织成立/秘社显形时插入',
      updateNode: '首领更替/核心成员变动/宗旨调整时更新',
      deleteNode: '组织瓦解/被剿灭/合并时删除',
      maxLen: { '宗旨': 200 },
      coded: false
    },
    {
      idx: 7, key: 'importantPlaces', name: '重要地点',
      columns: ['地名', '所属', '类型', '战略价值', '当前状态', '驻守'],
      keyCol: 0, freq: 'low', appendOnly: false,
      note: '关隘/京畿/边镇/府邸/陵寝等关键地点的当前状态',
      initNode: '游戏开始时根据剧本生成京畿要地、边关重镇',
      insertNode: '新建/被占领/侨置改隶时插入',
      updateNode: '所属变更/驻守换防/战略价值变化时更新',
      deleteNode: '失陷不复或并入他省·谨慎删除',
      coded: false
    },
    {
      idx: 8, key: 'majorEventsBrief', name: '大事记摘要',
      columns: ['编码', '回合', '时间', '地点', '主体', '事件摘要', '后果'],
      keyCol: 0, freq: 'mid', appendOnly: true,
      note: '已完成大事的append-only史官档案·与事件历史表通过编码对齐',
      initNode: '游戏开始时初始为空',
      insertNode: '诏令完成/重大改革落地/关键死亡/王朝大事时·与事件历史表同时新增',
      updateNode: '禁止更新（append-only）',
      deleteNode: '禁止删除（append-only）',
      maxLen: { '事件摘要': 300, '后果': 200 },
      coded: true,
      alignWith: 'eventHistory'
    },
    {
      idx: 9, key: 'eventHistory', name: '事件历史(加权)',
      columns: ['编码', '回合', '事件描述', '权重', '维度标签', '关联人物', '未来约束'],
      keyCol: 0, freq: 'high', appendOnly: true,
      note: '本回合事件流·权重由 sc25 10维评分写入(0.0-1.0)·未来约束=true 的事件会进入"长期约束"段·AI 必须遵循',
      initNode: '游戏开始时初始为空',
      insertNode: '每回合 sc1 完成后由系统从 evtLog 自动转写·AI 也可显式插入重要事件',
      updateNode: '禁止更新（append-only）·权重与"未来约束"由后台异步打分覆盖',
      deleteNode: '禁止删除（append-only）',
      maxLen: { '事件描述': 80 },
      coded: true,
      alignWith: 'majorEventsBrief'
    },
    {
      idx: 10, key: 'relationNet', name: '关系网络',
      columns: ['A方', 'B方', '关系类型', '亲疏', '近期事件', '是否冻结'],
      keyCol: 0, freq: 'mid', appendOnly: false,
      note: '记录重要双向关系·一方死亡则关系冻结而非删除·便于追溯',
      initNode: '游戏开始时根据剧本生成核心关系（君臣/师生/政敌/世交）',
      insertNode: '新关系建立时插入·主键为(A,B)规范化字符串',
      updateNode: '亲疏变化/类型转变（如盟变敌）时更新·近期事件追加',
      deleteNode: '原则上不删除·一方死亡时改是否冻结=是·仅在编辑器调试时硬删',
      coded: false
    },
    {
      idx: 11, key: 'imperialEdict', name: '皇命专用',
      columns: ['优先级', '皇命内容', '生效条件', '颁布回合', '隐藏'],
      keyCol: 1, freq: 'readonly', appendOnly: false,
      note: '玩家在编辑器锁定的钉子条目·AI 永读不写·每回合必投到 sc1 prompt 顶部·"隐藏"列填 true 的为天机条目仅 sc1 见 sc15/sc2 不见',
      initNode: '玩家手动添加·初始为空',
      insertNode: '禁止 AI 操作·仅编辑器 UI 添加',
      updateNode: '禁止 AI 操作·仅编辑器 UI 修改',
      deleteNode: '禁止 AI 操作·仅编辑器 UI 删除',
      coded: false
    }
  ];

  // 索引：通过 idx 快速取定义
  var SHEET_BY_IDX = {};
  var SHEET_BY_KEY = {};
  SHEET_DEFS.forEach(function(d) {
    SHEET_BY_IDX[d.idx] = d;
    SHEET_BY_KEY[d.key] = d;
  });

  // ────────────────────────────────────────────────────────────
  // §2 GM._memTables 初始化
  // 数据形态：
  //   GM._memTables = {
  //     curStatus: { rows: [['大明','...']], _meta: {} },
  //     courtNpc:  { rows: [...], _meta: {} },
  //     ...
  //     _sentinelLog: [{ turn, level, msg }, ...],
  //     _editorLocks: { sheetKey: { rows:[], cols:[], cells:[] } }
  //   }
  // ────────────────────────────────────────────────────────────
  function _ensureInit() {
    if (typeof GM === 'undefined' || !GM) return false;
    if (!GM._memTables) GM._memTables = {};
    SHEET_DEFS.forEach(function(d) {
      if (!GM._memTables[d.key]) {
        GM._memTables[d.key] = { rows: [], _meta: { lastWriteTurn: 0 } };
      } else {
        var t = GM._memTables[d.key];
        if (!Array.isArray(t.rows)) t.rows = [];
        if (!t._meta) t._meta = { lastWriteTurn: 0 };
        t.rows.forEach(function(r) {
          if (!Array.isArray(r)) return;
          while (r.length < d.columns.length) r.push('');
        });
      }
    });
    if (!GM._memTables._sentinelLog) GM._memTables._sentinelLog = [];
    if (!GM._memTables._editorLocks) GM._memTables._editorLocks = {};
    if (!GM._memTables._pendingDeletes) GM._memTables._pendingDeletes = {};
    return true;
  }

  function _t(sheetKey) {
    if (!_ensureInit()) return null;
    return GM._memTables[sheetKey] || null;
  }

  // ────────────────────────────────────────────────────────────
  // §3 编码生成（T<turn>-<seq> 软对齐）
  // ────────────────────────────────────────────────────────────
  function _genCode(sheetKey, prefix) {
    var t = _t(sheetKey);
    if (!t) return '';
    var turn = (typeof GM !== 'undefined' && GM.turn) ? GM.turn : 1;
    var maxSeq = 0;
    var rePref = new RegExp('^T' + turn + '-' + prefix + '(\\d+)$');
    t.rows.forEach(function(r) {
      var c = r && r[0];
      if (typeof c === 'string') {
        var m = c.match(rePref);
        if (m) { var n = parseInt(m[1], 10); if (n > maxSeq) maxSeq = n; }
      }
    });
    return 'T' + turn + '-' + prefix + (maxSeq + 1);
  }

  function _codePrefix(sheetKey) {
    if (sheetKey === 'edictsActive') return 'E';
    if (sheetKey === 'eventHistory') return 'E';
    if (sheetKey === 'majorEventsBrief') return 'S';
    return 'X';
  }

  // ────────────────────────────────────────────────────────────
  // §4 CRUD API
  // ────────────────────────────────────────────────────────────
  function _findRowByKey(t, def, keyValue) {
    var kc = def.keyCol || 0;
    for (var i = 0; i < t.rows.length; i++) {
      if (t.rows[i] && String(t.rows[i][kc]) === String(keyValue)) return i;
    }
    return -1;
  }

  function _normalizeRow(def, obj) {
    var row = [];
    for (var i = 0; i < def.columns.length; i++) {
      var v = obj[i];
      if (v == null && def.columns[i] in obj) v = obj[def.columns[i]];
      row[i] = (v == null) ? '' : String(v);
    }
    return row;
  }

  function _isLocked(sheetKey, rowIdx, colIdx) {
    if (!GM._memTables || !GM._memTables._editorLocks) return false;
    var L = GM._memTables._editorLocks[sheetKey];
    if (!L) return false;
    if (L.rows && L.rows.indexOf(rowIdx) >= 0) return true;
    if (L.cols && L.cols.indexOf(colIdx) >= 0) return true;
    if (L.cells) {
      for (var i = 0; i < L.cells.length; i++) {
        if (L.cells[i][0] === rowIdx && L.cells[i][1] === colIdx) return true;
      }
    }
    return false;
  }

  function insertRow(idxOrKey, valueObj, opts) {
    opts = opts || {};
    if (!_ensureInit()) return { ok: false, reason: 'GM not ready' };
    var def = (typeof idxOrKey === 'number') ? SHEET_BY_IDX[idxOrKey] : SHEET_BY_KEY[idxOrKey];
    if (!def) return { ok: false, reason: 'unknown sheet ' + idxOrKey };
    if (def.freq === 'readonly' && !opts.editorOverride) {
      return { ok: false, reason: 'readonly sheet ' + def.key + '·只允许编辑器写入' };
    }
    var t = _t(def.key);
    var row = _normalizeRow(def, valueObj || {});
    // 软对齐编码：缺失/无效则系统补
    if (def.coded) {
      var hasCode = row[0] && /^T\d+-[A-Z]\d+$/.test(row[0]);
      if (!hasCode) row[0] = _genCode(def.key, _codePrefix(def.key));
    }
    // 同主键则视为 upsert
    var existIdx = _findRowByKey(t, def, row[def.keyCol || 0]);
    if (existIdx >= 0) {
      if (def.appendOnly && !opts.editorOverride) {
        return { ok: false, reason: 'append-only·重复主键被拒绝' };
      }
      // 走 update 路径
      return updateRow(def.key, existIdx, valueObj, opts);
    }
    // 长字段压缩标记（等异步处理）
    if (def.maxLen) {
      Object.keys(def.maxLen).forEach(function(colName) {
        var ci = def.columns.indexOf(colName);
        if (ci >= 0 && row[ci] && row[ci].length > def.maxLen[colName]) {
          if (!t._meta._compressQueue) t._meta._compressQueue = [];
          t._meta._compressQueue.push({ row: t.rows.length, col: ci, len: row[ci].length });
        }
      });
    }
    t.rows.push(row);
    t._meta.lastWriteTurn = (GM && GM.turn) || 0;
    return { ok: true, idx: t.rows.length - 1, code: def.coded ? row[0] : null };
  }

  function updateRow(idxOrKey, rowIdx, valueObj, opts) {
    opts = opts || {};
    if (!_ensureInit()) return { ok: false, reason: 'GM not ready' };
    var def = (typeof idxOrKey === 'number') ? SHEET_BY_IDX[idxOrKey] : SHEET_BY_KEY[idxOrKey];
    if (!def) return { ok: false, reason: 'unknown sheet ' + idxOrKey };
    if (def.appendOnly && !opts.editorOverride) {
      return { ok: false, reason: 'append-only·禁止 update' };
    }
    if (def.freq === 'readonly' && !opts.editorOverride) {
      return { ok: false, reason: 'readonly sheet' };
    }
    var t = _t(def.key);
    if (rowIdx < 0 || rowIdx >= t.rows.length) {
      return { ok: false, reason: 'row index out of range: ' + rowIdx };
    }
    var row = t.rows[rowIdx];
    var nowTurn = (typeof GM !== 'undefined' && GM && GM.turn) || 0;
    var actor = opts.editorOverride ? 'editor' : (opts.actor || 'ai');
    if (!t._meta.cellHistory) t._meta.cellHistory = [];
    Object.keys(valueObj || {}).forEach(function(k) {
      var ci = (typeof k === 'string' && /^\d+$/.test(k)) ? parseInt(k, 10) : def.columns.indexOf(k);
      if (ci < 0 || ci >= def.columns.length) return;
      if (_isLocked(def.key, rowIdx, ci) && !opts.editorOverride) return;
      var v = valueObj[k];
      var newVal = (v == null) ? '' : String(v);
      var oldVal = row[ci] == null ? '' : String(row[ci]);
      if (oldVal !== newVal) {
        t._meta.cellHistory.push({
          row: rowIdx, col: ci, oldVal: oldVal, newVal: newVal,
          turn: nowTurn, ts: Date.now(), actor: actor
        });
      }
      row[ci] = newVal;
    });
    // 历史长度上限·LRU 截断（每表 500 条）
    if (t._meta.cellHistory.length > 500) {
      t._meta.cellHistory = t._meta.cellHistory.slice(-400);
    }
    t._meta.lastWriteTurn = nowTurn;
    return { ok: true, idx: rowIdx };
  }

  // 查询某 cell 的修改历史
  function getCellHistory(sheetKey, rowIdx, colIdx) {
    var t = _t(sheetKey);
    if (!t || !t._meta.cellHistory) return [];
    return t._meta.cellHistory.filter(function(h) {
      return h.row === rowIdx && (colIdx == null || h.col === colIdx);
    });
  }

  function deleteRow(idxOrKey, rowIdx, opts) {
    opts = opts || {};
    if (!_ensureInit()) return { ok: false, reason: 'GM not ready' };
    var def = (typeof idxOrKey === 'number') ? SHEET_BY_IDX[idxOrKey] : SHEET_BY_KEY[idxOrKey];
    if (!def) return { ok: false, reason: 'unknown sheet ' + idxOrKey };
    if (def.appendOnly && !opts.editorOverride) {
      return { ok: false, reason: 'append-only·禁止 delete (editor_force_delete 走 opts.editorOverride)' };
    }
    if (def.freq === 'readonly' && !opts.editorOverride) {
      return { ok: false, reason: 'readonly sheet' };
    }
    var t = _t(def.key);
    if (rowIdx < 0 || rowIdx >= t.rows.length) {
      return { ok: false, reason: 'row index out of range: ' + rowIdx };
    }
    // 软删除：放入 pendingDeletes·等编辑器二次确认
    if (opts.soft) {
      if (!GM._memTables._pendingDeletes[def.key]) GM._memTables._pendingDeletes[def.key] = [];
      if (GM._memTables._pendingDeletes[def.key].indexOf(rowIdx) < 0) {
        GM._memTables._pendingDeletes[def.key].push(rowIdx);
      }
      return { ok: true, soft: true };
    }
    t.rows.splice(rowIdx, 1);
    t._meta.lastWriteTurn = (GM && GM.turn) || 0;
    return { ok: true };
  }

  // 编辑器走的硬接口（无视 readonly/appendOnly）
  function editorWrite(sheetKey, op, args) {
    args = args || {};
    args.editorOverride = true;
    if (op === 'insert') return insertRow(sheetKey, args.values, args);
    if (op === 'update') return updateRow(sheetKey, args.rowIdx, args.values, args);
    if (op === 'delete') return deleteRow(sheetKey, args.rowIdx, args);
    return { ok: false, reason: 'unknown op: ' + op };
  }

  // 提交软删除
  function commitPendingDeletes(sheetKey) {
    if (!GM._memTables._pendingDeletes[sheetKey]) return { ok: true, count: 0 };
    var idxs = GM._memTables._pendingDeletes[sheetKey].slice().sort(function(a, b) { return b - a; });
    var t = _t(sheetKey);
    if (!t) return { ok: false };
    idxs.forEach(function(i) { if (i >= 0 && i < t.rows.length) t.rows.splice(i, 1); });
    GM._memTables._pendingDeletes[sheetKey] = [];
    return { ok: true, count: idxs.length };
  }

  // ────────────────────────────────────────────────────────────
  // §5 AI 输出协议解析（<tableEdit> 块 + 思考块吞掉）
  // 容错正则（参考蚀心入魔）：单边缺失也能识别
  // 支持格式：
  //   <tableEdit>
  //   <!--
  //   insertRow(3, {"0":"...","1":"..."})
  //   updateRow(1, 2, {"3":"..."})
  //   deleteRow(0, 1)
  //   -->
  //   </tableEdit>
  // ────────────────────────────────────────────────────────────
  function parseTableEdit(text, opts) {
    opts = opts || {};
    if (!text || typeof text !== 'string') return { ops: [], cleanedText: text || '' };
    var ops = [];

    // 1. 先剥 <tableEdit> ... </tableEdit>·允许单边缺失
    var blockRe = /<tableEdit>([\s\S]*?)<\/tableEdit>|<tableEdit>([\s\S]*?)$|^([\s\S]*?)<\/tableEdit>/gi;
    var blocks = [];
    var m;
    while ((m = blockRe.exec(text)) !== null) {
      blocks.push(m[1] || m[2] || m[3] || '');
    }
    // 如果没找到块·尝试直接在全文里找 insertRow/updateRow/deleteRow（再宽松一档）
    if (blocks.length === 0) blocks = [text];

    // 2. 每块里抽指令·允许 HTML 注释包裹与否
    var cmdRe = /(insertRow|updateRow|deleteRow)\s*\(\s*([^)]*?)\s*\)/g;
    blocks.forEach(function(blk) {
      var content = blk.replace(/<!--/g, '').replace(/-->/g, '');
      var c;
      while ((c = cmdRe.exec(content)) !== null) {
        var cmd = c[1];
        var argsStr = c[2];
        var op = _parseOpArgs(cmd, argsStr, content, c.index);
        if (op) ops.push(op);
      }
    });

    // 3. 清洗：吞 <tableEdit> 与 <thought>...
    var cleaned = text
      .replace(/<tableEdit>[\s\S]*?<\/tableEdit>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<tableThink>[\s\S]*?<\/tableThink>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '');

    return { ops: ops, cleanedText: cleaned };
  }

  function _parseOpArgs(cmd, argsStr, fullContent, atIdx) {
    // 解析逻辑：
    //   insertRow: tableIdx, jsonObj
    //   updateRow: tableIdx, rowIdx, jsonObj
    //   deleteRow: tableIdx, rowIdx
    // 因为括号里嵌 {} 复杂·这里用更稳健的方式：从 atIdx 重新找完整括号
    var open = fullContent.indexOf('(', atIdx);
    if (open < 0) return null;
    var depth = 0, close = -1;
    for (var i = open; i < fullContent.length; i++) {
      var ch = fullContent[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close < 0) return null;
    var raw = fullContent.substring(open + 1, close);

    // 拆"第一个逗号之外的"·因为后面是 JSON
    var firstComma = raw.indexOf(',');
    if (firstComma < 0) return null;
    var tableIdx = parseInt(raw.substring(0, firstComma).trim(), 10);
    if (isNaN(tableIdx)) return null;

    if (cmd === 'deleteRow') {
      var rowIdx = parseInt(raw.substring(firstComma + 1).trim(), 10);
      if (isNaN(rowIdx)) return null;
      return { cmd: 'delete', tableIdx: tableIdx, rowIdx: rowIdx };
    }

    if (cmd === 'updateRow') {
      var sec = raw.substring(firstComma + 1);
      var sec2 = sec.indexOf(',');
      if (sec2 < 0) return null;
      var rIdx2 = parseInt(sec.substring(0, sec2).trim(), 10);
      if (isNaN(rIdx2)) return null;
      var jsonU = sec.substring(sec2 + 1).trim();
      var objU = _safeJSONParse(jsonU);
      if (!objU) return null;
      return { cmd: 'update', tableIdx: tableIdx, rowIdx: rIdx2, values: objU };
    }

    if (cmd === 'insertRow') {
      var jsonI = raw.substring(firstComma + 1).trim();
      var objI = _safeJSONParse(jsonI);
      if (!objI) return null;
      return { cmd: 'insert', tableIdx: tableIdx, values: objI };
    }

    return null;
  }

  function _safeJSONParse(s) {
    if (!s) return null;
    try { return JSON.parse(s); } catch(_e1) {}
    // 容错：把中文引号转 ASCII，把单引号转双引号，去尾逗号
    var fixed = s
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/(\w+)\s*:/g, '"$1":')      // 无引号 key
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch(_e2) {}
    return null;
  }

  // 应用解析后的 ops（默认 AI 上下文）
  function applyAIOps(ops, opts) {
    opts = opts || {};
    var stats = { insert: 0, update: 0, delete: 0, rejected: [] };
    if (!Array.isArray(ops)) return stats;
    ops.forEach(function(op) {
      var def = SHEET_BY_IDX[op.tableIdx];
      if (!def) { stats.rejected.push({ op: op, reason: '未知表索引' }); return; }
      var r;
      if (op.cmd === 'insert') r = insertRow(def.key, op.values || {}, opts);
      else if (op.cmd === 'update') r = updateRow(def.key, op.rowIdx, op.values || {}, opts);
      else if (op.cmd === 'delete') r = deleteRow(def.key, op.rowIdx, opts);
      else { stats.rejected.push({ op: op, reason: '未知指令' }); return; }
      if (r && r.ok) stats[op.cmd]++;
      else stats.rejected.push({ op: op, reason: (r && r.reason) || '未知失败' });
    });
    return stats;
  }

  // ────────────────────────────────────────────────────────────
  // §6 表注入到 prompt（参考蚀心入魔的 [Idx:Name] 风格）
  // ────────────────────────────────────────────────────────────
  function _serializeSheet(def, t, opts) {
    opts = opts || {};
    var lines = [];
    lines.push('[' + def.idx + ':' + def.name + ']');
    var colsHeader = def.columns.map(function(c, i) { return '[' + i + ':' + c + ']'; }).join(', ');
    lines.push('  Columns: ' + colsHeader);
    if (def.note) lines.push('  - Note: ' + def.note);
    lines.push('  - Insert: ' + def.insertNode);
    lines.push('  - Update: ' + def.updateNode);
    lines.push('  - Delete: ' + def.deleteNode);
    if (!t.rows.length) {
      lines.push('  (该表为空·请按 Init 策略进行初始化：' + def.initNode + ')');
      return lines.join('\n');
    }
    // 行数控制：append-only 表只取最近 N 行
    var rows = t.rows;
    if (def.appendOnly) {
      var cap = (def.key === 'eventHistory') ? 30 : 12;
      rows = rows.slice(-cap);
    }
    // P4.3 隐藏天机：hideSecret=true 时·过滤 imperialEdict 表内"隐藏"列=true 的行
    if (opts.hideSecret && def.key === 'imperialEdict') {
      var secretCol = def.columns.indexOf('隐藏');
      if (secretCol >= 0) {
        rows = rows.filter(function(r) {
          var v = r[secretCol];
          return !(v === 'true' || v === true || v === '是' || v === '1');
        });
      }
    }
    rows.forEach(function(r, i) {
      var realIdx = def.appendOnly ? (t.rows.length - rows.length + i) : i;
      lines.push('  [' + realIdx + '] ' + r.map(function(v) { return (v == null) ? '' : String(v); }).join(' | '));
    });
    return lines.join('\n');
  }

  // 单独提取 affects_future=true 事件作为"长期约束"段（Phase 4.2 ReNovel-AI 范式）
  function buildFutureConstraints() {
    if (!_ensureInit()) return '';
    var t = _t('eventHistory');
    if (!t || !t.rows.length) return '';
    var def = SHEET_BY_KEY.eventHistory;
    var futureColIdx = def.columns.indexOf('未来约束');
    if (futureColIdx < 0) return '';
    var hits = t.rows.filter(function(r) {
      var v = r[futureColIdx];
      return v === 'true' || v === true || v === '1' || v === '是';
    });
    if (!hits.length) return '';
    var nowTurn = (typeof GM !== 'undefined' && GM && GM.turn) || 1;
    var lines = ['=== 长期约束（affects_future·禁止违反） ==='];
    hits.slice(-15).forEach(function(r) {
      var rTurn = parseInt(r[1], 10) || 0;
      var rel = (typeof _formatRelativeTime === 'function') ? _formatRelativeTime(rTurn, nowTurn) : '';
      lines.push('· [' + r[0] + (rel ? '·' + rel : '') + '] ' + r[2] + (r[5] ? ' (涉:' + r[5] + ')' : ''));
    });
    lines.push('=== 此后推演不得违反·人物不得提前死/被遗忘·事件不得被改写 ===');
    return lines.join('\n') + '\n';
  }

  // 主注入入口·分级开关
  function buildTablesInjection(opts) {
    opts = opts || {};
    if (!_ensureInit()) return '';
    var include = opts.include || null;        // 数组·指定显示哪几张
    var exclude = opts.exclude || [];          // 数组·排除哪几张
    var blocks = [];
    SHEET_DEFS.forEach(function(def) {
      if (include && include.indexOf(def.key) < 0 && include.indexOf(def.idx) < 0) return;
      if (exclude.indexOf(def.key) >= 0 || exclude.indexOf(def.idx) >= 0) return;
      var t = _t(def.key);
      if (!t) return;
      blocks.push(_serializeSheet(def, t, opts));
    });
    if (!blocks.length) return '';
    var header = '<dataTable>\n以下是当前推演必须基于的结构化记忆表（共 ' + blocks.length + ' 张）：\n\n';
    var footer = '\n</dataTable>\n';
    return header + blocks.join('\n\n') + footer;
  }

  // 后置强调（depth=0 等价物·投在 user prompt 末尾）
  function buildTableRulePostscript() {
    var lines = [];
    lines.push('<dataTable_rule>');
    lines.push('在你的 JSON 回复中必须额外提供 tableEdit 字段·字段值为 <tableEdit>...</tableEdit> 块；若当前模型不受 JSON 格式约束，也可在回复末尾追加该块。');
    lines.push('tableEdit 块内用 HTML 注释包裹三类指令：');
    lines.push('  insertRow(tableIdx, {"colIdx":"value"})       // 新增一行');
    lines.push('  updateRow(tableIdx, rowIdx, {"colIdx":"value"}) // 更新指定行的指定列');
    lines.push('  deleteRow(tableIdx, rowIdx)                    // 删除指定行');
    lines.push('');
    lines.push('格式约束：');
    lines.push('  · key 必须用双引号·value 字符串内禁止内嵌双引号（用 / 分隔）');
    lines.push('  · 表索引 [tableIdx] 来自上方 [Idx:Name] 标题·严禁重新编号');
    lines.push('  · 行索引 [rowIdx] 是上方表中显示的行号（带 [n] 前缀的那个）');
    lines.push('  · 编码 T<turn>-<seq> 列由系统补全·你写"" 或缺失即可');
    lines.push('  · append-only 表（事件历史/大事记摘要）禁止 update/delete·只允许 insert');
    lines.push('');
    lines.push('冲突解决层级（高优先级覆盖低优先级）：');
    lines.push('  当前局势 > 在朝NPC > 角色档案 > 关系网络 > 事件历史 > 大事记摘要');
    lines.push('');
    lines.push('禁止：');
    lines.push('  · 让已死要员复活（参看 [DeadPin] 块）');
    lines.push('  · 重新虚构编码（系统会强行覆盖）');
    lines.push('  · 修改皇命专用表（只读）');
    lines.push('  · 修改被锁定的单元格（_editorLocks）');
    lines.push('</dataTable_rule>');
    return lines.join('\n');
  }

  // ────────────────────────────────────────────────────────────
  // §7 一致性哨兵（每回合扫描 alignWith 表对·检查编码缺失/重复）
  // ────────────────────────────────────────────────────────────
  function runConsistencySentinel(turn) {
    if (!_ensureInit()) return [];
    turn = turn || (GM.turn || 0);
    var warnings = [];

    // 1. 编码重复检查
    SHEET_DEFS.forEach(function(def) {
      if (!def.coded) return;
      var t = _t(def.key);
      var seen = {};
      t.rows.forEach(function(r, i) {
        var c = r && r[0];
        if (!c) {
          warnings.push({ turn: turn, level: 'warn', msg: '[' + def.name + '] row ' + i + ' 缺失编码' });
          return;
        }
        if (seen[c] != null) {
          warnings.push({ turn: turn, level: 'error', msg: '[' + def.name + '] 编码重复: ' + c + ' (rows ' + seen[c] + ',' + i + ')' });
        }
        seen[c] = i;
      });
    });

    // 2. 跨表对齐检查（majorEventsBrief ↔ eventHistory 通过编码集合的差集）
    SHEET_DEFS.forEach(function(def) {
      if (!def.alignWith) return;
      var partner = SHEET_BY_KEY[def.alignWith];
      if (!partner) return;
      var t1 = _t(def.key), t2 = _t(partner.key);
      var s1 = {}, s2 = {};
      t1.rows.forEach(function(r) { if (r && r[0]) s1[r[0]] = 1; });
      t2.rows.forEach(function(r) { if (r && r[0]) s2[r[0]] = 1; });
      Object.keys(s1).forEach(function(c) {
        if (!s2[c]) warnings.push({ turn: turn, level: 'warn', msg: '编码 ' + c + ' 在 [' + def.name + '] 有·[' + partner.name + '] 缺失' });
      });
    });

    // 3. 长字段超限提示
    SHEET_DEFS.forEach(function(def) {
      if (!def.maxLen) return;
      var t = _t(def.key);
      Object.keys(def.maxLen).forEach(function(colName) {
        var ci = def.columns.indexOf(colName);
        if (ci < 0) return;
        t.rows.forEach(function(r, ri) {
          var v = r && r[ci];
          if (v && v.length > def.maxLen[colName]) {
            warnings.push({ turn: turn, level: 'info', msg: '[' + def.name + '] row ' + ri + ' 列 ' + colName + ' 超长 ' + v.length + ' > ' + def.maxLen[colName] + '·待 AI 压缩' });
          }
        });
      });
    });

    GM._memTables._sentinelLog = (GM._memTables._sentinelLog || []).concat(warnings);
    if (GM._memTables._sentinelLog.length > 200) {
      GM._memTables._sentinelLog = GM._memTables._sentinelLog.slice(-200);
    }
    // P6.5 修：高严重度 toast 弹·中等记入 evtLog 给玩家看·低仅控制台
    // 频率限制：本回合至多 3 条 toast
    var nowTurn = (typeof GM !== 'undefined' && GM && GM.turn) || 0;
    if (!GM._memTables._toastBudget || GM._memTables._toastBudget.turn !== nowTurn) {
      GM._memTables._toastBudget = { turn: nowTurn, count: 0 };
    }
    var budget = GM._memTables._toastBudget;
    var maxToastsPerTurn = 3;
    warnings.forEach(function(w) {
      if (w.level === 'error') {
        if (budget.count < maxToastsPerTurn && typeof toast === 'function') {
          try { toast('🚨 哨兵: ' + w.msg); } catch(_t){}
          budget.count++;
        }
        if (typeof addEB === 'function') {
          try { addEB('哨兵', w.msg); } catch(_e){}
        }
      } else if (w.level === 'warn') {
        if (typeof addEB === 'function') {
          try { addEB('哨兵', w.msg); } catch(_e){}
        }
      }
      // info 级仅控制台·不打扰玩家
    });
    return warnings;
  }

  // ────────────────────────────────────────────────────────────
  // §8 同步桥（从已有 GM 状态自动同步到表·首次启用时全量·后续增量）
  // ────────────────────────────────────────────────────────────
  function syncFromGM(opts) {
    opts = opts || {};
    if (!_ensureInit()) return { ok: false };
    var turn = (GM && GM.turn) || 1;
    var stats = { tables: 0, rows: 0 };

    // 0. 当前局势：唯一一行
    (function() {
      var def = SHEET_BY_KEY.curStatus;
      var t = _t('curStatus');
      var sc = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      var row = [
        sc ? (sc.dynasty || sc.name || '') : '',
        (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '',
        (GM.vars && GM.vars['年号'] && GM.vars['年号'].value) || (sc ? sc.era : '') || '',
        String(turn),
        '', // 主要矛盾 待 AI 写
        ''
      ];
      if (t.rows.length === 0) { t.rows.push(row); stats.rows++; }
      else { t.rows[0][3] = String(turn); }
      stats.tables++;
    })();

    // 1. 在朝NPC：从 GM.chars 同步 officialTitle 非空的（仅在表为空时全量·避免覆盖 AI 增量）
    (function() {
      if (opts.skipCourtSync) return;
      var t = _t('courtNpc');
      if (t.rows.length > 0 && !opts.forceFull) return;
      var seen = {};
      t.rows.forEach(function(r) { if (r[0]) seen[r[0]] = 1; });
      (GM.chars || []).forEach(function(c) {
        if (!c || c.alive === false || !c.officialTitle || c.officialTitle === '无') return;
        if (seen[c.name]) return;
        var rank = (c.officialRank ? String(c.officialRank) + '品' : '');
        t.rows.push([c.name, rank, c.officialTitle, c.party || '', c.faction || '', String(c.loyalty || 50), '']);
        stats.rows++;
      });
      stats.tables++;
    })();

    // 2. 角色档案：从 GM.chars 同步 importance >= 60 的（仅初始化）
    (function() {
      if (opts.skipProfileSync) return;
      var t = _t('charProfile');
      if (t.rows.length > 0 && !opts.forceFull) return;
      var seen = {};
      t.rows.forEach(function(r) { if (r[0]) seen[r[0]] = 1; });
      (GM.chars || []).forEach(function(c) {
        if (!c || (c.importance || 0) < 60) return;
        if (seen[c.name]) return;
        var birth = (c.gender || '') + (c.age ? '·' + c.age + '岁' : '');
        var bio = (c.bio || c.background || '').substring(0, 250);
        t.rows.push([c.name, birth, c.origin || '', c.officialTitle || '', c.personality || '', '', bio, c.alive === false ? '已逝' : '']);
        stats.rows++;
      });
      stats.tables++;
    })();

    // 3. 进行中诏令：从 GM._edictTracker 同步未完成
    (function() {
      var t = _t('edictsActive');
      if (!Array.isArray(GM._edictTracker)) return;
      var seenCodes = {};
      t.rows.forEach(function(r) { if (r[0]) seenCodes[r[0]] = 1; });
      GM._edictTracker.forEach(function(e) {
        if (!e || e.status === 'completed' || e.status === 'aborted') return;
        var code = 'T' + (e.startTurn || 1) + '-E' + ((e.id || '').slice(-3) || '?');
        if (seenCodes[code]) return;
        t.rows.push([
          code,
          e.title || e.name || '',
          String(e.startTurn || 1),
          e.type || '',
          e.currentPhase || e.status || '',
          (e.resistance != null ? String(e.resistance) : ''),
          (e.keyPersons || []).join('、'),
          e.eta || ''
        ]);
        stats.rows++;
      });
      stats.tables++;
    })();

    // 9. 事件历史：从 evtLog 增量同步本回合事件
    (function() {
      var t = _t('eventHistory');
      var lastSyncedTurn = (t._meta && t._meta._lastEvtSyncTurn) || 0;
      if (turn <= lastSyncedTurn) return;
      var evts = (GM.evtLog || []).filter(function(e) { return e && (e.turn || 0) > lastSyncedTurn; });
      evts.forEach(function(e, i) {
        var code = 'T' + (e.turn || turn) + '-E' + (i + 1);
        t.rows.push([
          code,
          String(e.turn || turn),
          (e.text || e.event || '').substring(0, 80),
          '0.5', // 默认权重·待 sc25 后台打分覆盖
          e.tag || '',
          (e.actor || e.target || ''),
          ''
        ]);
        stats.rows++;
      });
      t._meta._lastEvtSyncTurn = turn;
      stats.tables++;
    })();

    return { ok: true, stats: stats };
  }

  // ────────────────────────────────────────────────────────────
  // §8.5 事件溯源·从历史反向重建关键表（Phase 5.2 Horae 轻版 chat[0]）
  // 用途：_memTables 损坏/丢失/迁移老存档时·用 shijiHistory + evtLog + ChronicleTracker 反推
  //   curStatus / eventHistory / majorEventsBrief 三张可重建·其他表保持手工
  // ────────────────────────────────────────────────────────────
  function rebuildFromHistory(opts) {
    opts = opts || {};
    if (!_ensureInit()) return { ok: false, reason: 'no GM' };
    var stats = { curStatus: 0, eventHistory: 0, majorEventsBrief: 0 };
    var nowTurn = (GM && GM.turn) || 1;

    if (opts.clear !== false) {
      _t('curStatus').rows = [];
      _t('eventHistory').rows = [];
      _t('majorEventsBrief').rows = [];
    }

    // 1. curStatus 单行重建
    (function() {
      var sc = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      var row = [
        sc ? (sc.dynasty || sc.name || '') : '',
        (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '',
        (GM.vars && GM.vars['年号'] && GM.vars['年号'].value) || (sc ? sc.era : '') || '',
        String(nowTurn),
        '',
        ''
      ];
      _t('curStatus').rows.push(row);
      stats.curStatus++;
    })();

    // 2. eventHistory 从 evtLog 重建
    if (Array.isArray(GM.evtLog)) {
      var byTurn = {};
      GM.evtLog.forEach(function(e) {
        if (!e) return;
        var t = e.turn || 0;
        if (!byTurn[t]) byTurn[t] = 0;
        byTurn[t]++;
        var seq = byTurn[t];
        _t('eventHistory').rows.push([
          'T' + t + '-E' + seq,
          String(t),
          (e.text || e.event || '').substring(0, 80),
          '0.5',
          e.tag || '',
          (e.actor || e.target || ''),
          ''
        ]);
        stats.eventHistory++;
      });
    }

    // 3. majorEventsBrief 从 shijiHistory + ChronicleTracker
    if (Array.isArray(GM.shijiHistory)) {
      var seqByTurn = {};
      GM.shijiHistory.forEach(function(sh) {
        if (!sh || !sh.turn) return;
        var t = sh.turn;
        seqByTurn[t] = (seqByTurn[t] || 0) + 1;
        var summary = (sh.shilu || sh.shizhengji || '').substring(0, 250);
        if (!summary.trim()) return;
        _t('majorEventsBrief').rows.push([
          'T' + t + '-S' + seqByTurn[t],
          String(t),
          '',
          '',
          '',
          summary,
          ''
        ]);
        stats.majorEventsBrief++;
      });
    }
    if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAll) {
      try {
        var allChron = ChronicleTracker.getAll({}) || [];
        allChron.forEach(function(c) {
          if (!c || c.status !== 'completed') return;
          var t = c.completedTurn || c.startTurn || 0;
          var sq = ((c.id || '').slice(-2) || '?');
          _t('majorEventsBrief').rows.push([
            'T' + t + '-C' + sq,
            String(t),
            c.location || '',
            '',
            c.title || '',
            (c.description || c.summary || '').substring(0, 250),
            c.result || ''
          ]);
          stats.majorEventsBrief++;
        });
      } catch(_re){}
    }

    return { ok: true, stats: stats, totalRows: stats.curStatus + stats.eventHistory + stats.majorEventsBrief };
  }

  // ────────────────────────────────────────────────────────────
  // §9 暴露 API
  // ────────────────────────────────────────────────────────────
  global.MemTables = {
    SHEET_DEFS: SHEET_DEFS,
    SHEET_BY_IDX: SHEET_BY_IDX,
    SHEET_BY_KEY: SHEET_BY_KEY,
    ensureInit: _ensureInit,
    insertRow: insertRow,
    updateRow: updateRow,
    deleteRow: deleteRow,
    editorWrite: editorWrite,
    commitPendingDeletes: commitPendingDeletes,
    parseTableEdit: parseTableEdit,
    applyAIOps: applyAIOps,
    buildTablesInjection: buildTablesInjection,
    buildTableRulePostscript: buildTableRulePostscript,
    buildFutureConstraints: buildFutureConstraints,
    runConsistencySentinel: runConsistencySentinel,
    syncFromGM: syncFromGM,
    findRowByKey: function(sheetKey, keyValue) {
      var def = SHEET_BY_KEY[sheetKey];
      var t = _t(sheetKey);
      if (!def || !t) return -1;
      return _findRowByKey(t, def, keyValue);
    },
    getSheet: function(sheetKey) { return _t(sheetKey); },
    getCellHistory: getCellHistory,
    rebuildFromHistory: rebuildFromHistory
  };

  // 兼容裸函数调用
  global._mtInsert = insertRow;
  global._mtUpdate = updateRow;
  global._mtDelete = deleteRow;
  global._mtParse = parseTableEdit;
  global._mtApply = applyAIOps;
  global._mtBuildInjection = buildTablesInjection;
  global._mtBuildRule = buildTableRulePostscript;
  global._mtBuildFuture = buildFutureConstraints;
  global._mtSentinel = runConsistencySentinel;
  global._mtSync = syncFromGM;

})(typeof window !== 'undefined' ? window : this);
