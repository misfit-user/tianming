// tm-turn-ledger-facts.js — 本回合账目实变：交给史官成文（实录、时政记）的数目依据。
//
// 第一回合盲读（11-06）同志批：两组的时政记都「缺乏直接明确的数据和情况变化」。
// 史官成文是在主写回之后才写的，这时账上已经知道钱粮、指标、人事实际变成了什么样，只是没交给史官。
//
// 只读，不写任何状态：
//   期初：回合开始时的快照（GM._prevGuoku / GM._prevNeitang，ctx.input.oldVars）；
//   现值：写回之后的世界；
//   本回合已落账的收支、指标、人事、兵马、势力变动：GM._turnReport、GM.turnChanges；
//   没落地的声明：GM._unappliedChanges（明告史官不得写成已发生）。
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var MAX_CHARS = 2600;
  var RESOURCES = [['money', '银', '两'], ['grain', '粮', '石'], ['cloth', '布', '匹']];
  var PERSON_FIELDS = { officialTitle: '官职', title: '身份', alive: '存亡', location: '所在', faction: '所属', rank: '品级', loyalty: '忠诚', exile: '流放', retired: '致仕', mourning: '守丧' };
  var GROUPS = [
    ['military', '兵马', { soldiers: '兵', morale: '士气', commander: '主将', quality: '战力' }],
    ['factions', '势力', { strength: '实力', attitude: '态度', leader: '首领', relation: '关系' }],
    ['parties', '党派', { influence: '势', status: '状况', leader: '党魁', satisfaction: '向背' }],
    ['classes', '阶层', { satisfaction: '向背', influence: '势', status: '状况' }],
    ['map', '地方', { minxin: '民心', unrest: '乱势', control: '控制', corruption: '吏治' }]
  ];
  // 史官成文在过回合的推演步骤里，月终常例收支（岁入、俸饷）在其后的结算步骤才入账：
  // 此刻的库存是半途数，写进时政记会和玩家回合末看到的结余对不上。所以只给期初与本回合动用，不给「至某数」。
  var RULE = '写实录、时政记：凡钱粮、兵马、任免、人心有变动的，写出数目和去向（如「发太仓银十二万两赈陕西」「添募辽兵一万二千」）；'
    + '本回合的变动数以上面这份为准，这里没有的变动不写成已发生；库存只写期初之数与本回合动用之数，月终结余此时未定，不写；没落地的声明不写成已发生。';

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function trim2(x) { return String(Math.round(x * 100) / 100); }
  function fmt(n) {
    if (!isNum(n)) return String(n == null || n === '' ? '无' : n).slice(0, 24);
    var abs = Math.abs(n);
    if (abs >= 100000000) return trim2(n / 100000000) + '亿';
    if (abs >= 10000) return trim2(n / 10000) + '万';
    return String(Math.round(n * 10) / 10);
  }
  function signed(n) { return (n > 0 ? '+' : '−') + fmt(Math.abs(n)); }
  function show(v) {
    if (v === true) return '是';
    if (v === false) return '否';
    return fmt(v);
  }

  function stockOf(acc, res) {
    if (!acc || typeof acc !== 'object') return null;
    if (acc.ledgers && acc.ledgers[res] && isNum(acc.ledgers[res].stock)) return acc.ledgers[res].stock;
    if (isNum(acc[res])) return acc[res];
    if (res === 'money' && isNum(acc.balance)) return acc.balance;
    return null;
  }
  function unitOf(acc, res, fallback) {
    var u = acc && acc.unit;
    return (u && typeof u === 'object' && u[res]) ? String(u[res]) : fallback;
  }

  function treasuryLines(G) {
    var out = [];
    [['国库', G._prevGuoku, G.guoku], ['内帑', G._prevNeitang, G.neitang]].forEach(function (row) {
      var before = row[1], now = row[2];
      if (!now) return;
      var start = [], moved = [];
      RESOURCES.forEach(function (r) {
        var b = stockOf(before, r[0]), n = stockOf(now, r[0]);
        var unit = unitOf(now, r[0], r[2]);
        if (b == null) { if (n != null) start.push(r[1] + fmt(n) + unit); return; }
        start.push(r[1] + fmt(b) + unit);
        if (n != null && Math.round(b) !== Math.round(n)) moved.push(r[1] + signed(n - b) + unit);
      });
      if (!start.length) return;
      if (!before) { out.push(row[0] + '：现存' + start.join('、') + '（期初未记）'); return; }
      out.push(row[0] + '：期初' + start.join('、') + '；' + (moved.length ? '本回合至此' + moved.join('、') : '本回合至此未动'));
    });
    if (out.length) out.push('（月终常例岁入、俸饷此时尚未结算，月终结余未定）');
    return out;
  }

  // 库账流水（ledgers[res].sinkDetails / sourceDetails，按条有 id、名目、数额）里本回合新落的：
  // 与回合开始的快照按 id 相减。诏令确定性执行的补饷、捐纳等不经 AI 写回、不进 _turnReport，只在这里有名目；
  // AI 写回的收支同名已在 _turnReport 那几行列过，不重复。名目「补饷·京营·五军营」按「·」前归并。
  function ledgerFlowLines(G, skipNames) {
    var out = [];
    [['国库', G._prevGuoku, G.guoku], ['内帑', G._prevNeitang, G.neitang]].forEach(function (row) {
      var before = row[1], now = row[2];
      if (!before || !now || !now.ledgers) return;   // 没有期初快照就分不出哪些是本回合的
      [['sinkDetails', '出'], ['sourceDetails', '入']].forEach(function (dir) {
        var groups = {}, order = [];
        RESOURCES.forEach(function (r) {
          var cur = now.ledgers[r[0]] && now.ledgers[r[0]][dir[0]];
          if (!cur || typeof cur !== 'object') return;
          var old = (before.ledgers && before.ledgers[r[0]] && before.ledgers[r[0]][dir[0]]) || {};
          Object.keys(cur).forEach(function (key) {
            (Array.isArray(cur[key]) ? cur[key] : []).forEach(function (e) {
              if (!e || !isNum(e.amount) || skipNames[e.name]) return;
              var prev = (Array.isArray(old[key]) ? old[key] : []).filter(function (x) { return x && x.id === e.id; })[0];
              var d = e.amount - (prev && isNum(prev.amount) ? prev.amount : 0);
              if (d < 0.5) return;
              var name = String(e.name || key), cut = name.indexOf('·');
              var head = cut > 0 ? name.slice(0, cut) : name, member = cut > 0 ? name.slice(cut + 1) : '';
              var gr = groups[head];
              if (!gr) { gr = groups[head] = { sums: {}, members: [] }; order.push(head); }
              gr.sums[r[0]] = (gr.sums[r[0]] || 0) + d;
              if (member && gr.members.indexOf(member) < 0) gr.members.push(member);
            });
          });
        });
        order.forEach(function (head) {
          var gr = groups[head];
          var amounts = RESOURCES.filter(function (r) { return gr.sums[r[0]]; }).map(function (r) { return r[1] + fmt(gr.sums[r[0]]) + unitOf(now, r[0], r[2]); });
          var where = gr.members.length ? '（' + gr.members.slice(0, 3).join('、') + (gr.members.length > 3 ? '等 ' + gr.members.length + ' 处' : '') + '）' : '';
          out.push('· ' + dir[1] + row[0] + '·' + head + '：' + amounts.join('、') + where);
        });
      });
    });
    return out;
  }

  function postingLines(G, turn) {
    var out = [], aiNames = {};
    (Array.isArray(G._turnReport) ? G._turnReport : []).forEach(function (r) {
      if (!r || Number(r.turn) !== turn) return;
      if (r.type === 'fiscal_adj') {
        if (r.name) aiNames[r.name] = true;
        var res = RESOURCES.filter(function (x) { return x[0] === (r.resource || 'money'); })[0] || RESOURCES[0];
        var acc = r.target === 'neitang' ? '内帑' : r.target === 'guoku' ? '国库' : String(r.target || '').replace(/^province:/, '');
        var line = '· ' + (r.kind === 'income' ? '入' : '出') + acc;
        if (isNum(r.amount) && r.amount) line += ' ' + res[1] + fmt(r.amount) + res[2];
        line += '：' + String(r.name || r.reason || '').slice(0, 40);
        if (r.recurring && r.annualAmount) line += '（年例 ' + fmt(r.annualAmount) + res[2] + '，下回合起）';
        else if (!r.amount && isNum(r.requested) && r.requested) line += '（请 ' + fmt(r.requested) + res[2] + '，未拨出）';
        if (isNum(r.shortfall) && r.shortfall > 0) line += '（短 ' + fmt(r.shortfall) + res[2] + '）';
        out.push(line);
      } else if (r.type === 'aiPolicyAction' && r.field === 'central_local_actions') {
        out.push('· 央地调拨：' + String(r.text || '').replace(/^诏令：/, '').slice(0, 60));
      }
    });
    return out.concat(ledgerFlowLines(G, aiNames)).slice(0, 12);
  }

  function reasonsOf(v) {
    var rs = Array.isArray(v && v.reasons) ? v.reasons.slice() : [];
    rs.sort(function (a, b) { return Math.abs(Number(b && b.amount) || 0) - Math.abs(Number(a && a.amount) || 0); });
    var words = rs.map(function (r) { return r && r.desc; }).filter(Boolean).slice(0, 2);
    if (!words.length && v && v.reason) words.push(v.reason);
    return words.map(function (w) { return String(w).slice(0, 24); }).join('、');
  }

  function metricLines(G, oldVars) {
    var out = [], seen = {};
    ((G.turnChanges && G.turnChanges.variables) || []).forEach(function (v) {
      if (!v) return;
      var d = isNum(v.delta) ? v.delta : (isNum(v.newValue) && isNum(v.oldValue) ? v.newValue - v.oldValue : 0);
      var name = v.label || v.name;
      if (!name || Math.abs(d) < 0.5) return;
      seen[v.name] = seen[name] = true;
      var why = reasonsOf(v);
      out.push(name + '：期初' + fmt(v.oldValue) + '，本回合' + signed(d) + (why ? '（因' + why + '）' : ''));
    });
    var vars = G.vars || {};
    Object.keys(oldVars || {}).forEach(function (k) {
      var cur = vars[k];
      if (seen[k] || !cur || !isNum(cur.value) || !isNum(oldVars[k])) return;
      var d = cur.value - oldVars[k];
      if (Math.abs(d) < 0.5) return;
      out.push(k + '：期初' + fmt(oldVars[k]) + (cur.unit || '') + '，本回合' + signed(d) + (cur.unit || ''));
    });
    return out.slice(0, 14);
  }

  function peopleLines(G) {
    var out = [];
    ((G.turnChanges && G.turnChanges.characters) || []).forEach(function (c) {
      if (!c || !c.name) return;
      var bits = [], why = '';
      (c.changes || []).forEach(function (ch) {
        var label = ch && PERSON_FIELDS[ch.field];
        if (!label) return;
        if (ch.field === 'loyalty') {
          var d = Number(ch.newValue) - Number(ch.oldValue);
          if (!isFinite(d) || Math.abs(d) < 5) return;
          bits.push('忠诚' + signed(d));
        } else if (ch.field === 'alive') {
          if (ch.newValue === false) bits.push('身故');
          else return;
        } else {
          bits.push(label + ' ' + show(ch.oldValue) + '→' + show(ch.newValue));
        }
        if (!why && ch.reason) why = String(ch.reason).slice(0, 30);
      });
      if (bits.length) out.push('· ' + c.name + '：' + bits.join('；') + (why ? '（' + why + '）' : ''));
    });
    return out.slice(0, 14);
  }

  function groupLines(G) {
    var out = [];
    GROUPS.forEach(function (g) {
      var rows = [];
      ((G.turnChanges && G.turnChanges[g[0]]) || []).forEach(function (item) {
        if (!item || !item.name) return;
        var bits = [];
        (item.changes || []).forEach(function (ch) {
          var label = ch && g[2][ch.field];
          if (!label || bits.length >= 2) return;
          var both = isNum(ch.oldValue) && isNum(ch.newValue);
          if (both && Math.abs(ch.newValue - ch.oldValue) < 0.5) return;
          bits.push(both ? label + signed(ch.newValue - ch.oldValue) + '（期初' + fmt(ch.oldValue) + '）' : label + ' ' + show(ch.oldValue) + '→' + show(ch.newValue));
        });
        if (bits.length) rows.push(item.name + '：' + bits.join('；'));
      });
      if (rows.length) out.push(g[1] + '：' + rows.slice(0, 6).join('｜'));
    });
    return out;
  }

  // 写回剔掉的条目按原字段名记（tm-endturn-apply-stages.js 把 applied.failed 逐条存进 GM._unappliedChanges）
  var UNLANDED_KINDS = [
    ['fiscal_adjustment', '收支'], ['personnel_change', '任免'], ['office_assignment', '任官'],
    ['character_death', '身故'], ['char_update', '人物'], ['faction_update', '势力'],
    ['party_update', '党派'], ['class_update', '阶层'], ['region_update', '地方'],
    ['localAction', '地方举措'], ['taxReform', '税制'], ['validator', '核验']
  ];
  // 按批字段名记的条目：政令类落不了地时记 {field, text, reason}（ai-change-applier/core.js 结构化政令段），
  // 严格预检剔掉的记 {field, target, item, droppedBy}
  var FIELD_LABELS = {
    central_local_actions: '央地调拨', currency_adjustments: '币制', population_adjustments: '户口',
    environment_actions: '环境', institution_changes: '官制',
    fiscal_adjustments: '收支', office_assignments: '任官', personnel_changes: '任免', character_deaths: '身故',
    char_updates: '人物', faction_updates: '势力', party_updates: '党派', class_updates: '阶层',
    region_updates: '地方', admin_changes: '地方', army_changes: '兵马', npc_letters: '来信', affinity_changes: '人情'
  };
  function accountName(t) {
    return t === 'guoku' ? '国库' : t === 'neitang' ? '内帑' : String(t || '').replace(/^province:/, '');
  }
  function describe(v) {
    if (v == null) return '';
    if (typeof v !== 'object') return String(v);
    var bits = [v.name || v.subject || v.char || v.npc || v.content || v.text || '', v.post || v.office || v.position || '', accountName(v.region || v.target), v.change || ''];
    if (isNum(v.amount) && v.amount) bits.push(fmt(v.amount));
    return bits.filter(Boolean).join(' ');
  }
  // 一致性校验（ai-change-applier/reconcile.js _collectValidatorFailures）按校验账的键名记
  var VALIDATOR_LABELS = {
    _fiscalValidatorLog: '钱粮核对', _militaryValidatorLog: '兵马核对', _revoltValidatorLog: '民变核对',
    _disasterValidatorLog: '灾异核对', _constructionValidatorLog: '营造核对', _currencyValidatorLog: '币制核对'
  };
  // before：主写回之前已有的条目（同回合早先失败那次留下的），不算这次的。
  // 主写回中途会把 GM._unappliedChanges 整个深拷贝换掉，按对象本身认不出；按写出来的那一行比、按次数抵：
  // 旧的几条抵掉，这次又出一模一样的失败时，多出来的那条照列。
  function unlandedLines(G, turn, before) {
    var sameTurn = function (u) { return u && Number(u.turn) === turn; };
    var old = {};
    (before || []).filter(sameTurn).forEach(function (u) { var l = unlandedLine(u); old[l] = (old[l] || 0) + 1; });
    return (Array.isArray(G._unappliedChanges) ? G._unappliedChanges : []).filter(sameTurn).map(unlandedLine).filter(function (l) {
      if (!old[l]) return true;
      old[l]--;
      return false;
    }).slice(-10);
  }
  function unlandedLine(u) {
    var label = '', target = '';
    for (var i = 0; i < UNLANDED_KINDS.length; i++) {
      if (u[UNLANDED_KINDS[i][0]] == null) continue;
      label = UNLANDED_KINDS[i][1];
      target = UNLANDED_KINDS[i][0] === 'validator' ? '' : describe(u[UNLANDED_KINDS[i][0]]);
      if (UNLANDED_KINDS[i][0] === 'validator') label = VALIDATOR_LABELS[u.validator] || label;
      break;
    }
    if (!label) {
      label = FIELD_LABELS[u.field] || u.field || u.path || u.source || '';
      target = describe(u.item) || describe(u.target) || String(u.text || '');
    }
    var what = [label, target.replace(/^诏令：/, '').replace(/[。；;，,\s]+$/, '')].filter(Boolean).join('·');
    return '· ' + what.slice(0, 60) + '：' + String(u.reason || u.code || '未落地').slice(0, 60);
  }

  /**
   * @param {object} G  GM
   * @param {{turn?:number, oldVars?:object, before?:Array}} opts
   *   oldVars 为回合开始时 GM.vars 的数值快照（ctx.input.oldVars）；
   *   before 为主写回之前 GM._unappliedChanges 的条目（按写出的那行抵；不给就按回合数取，同回合早先失败那次留下的也会算进来）
   * @returns {string} 交给史官的一段；没有可说的就返回空串
   */
  function block(G, opts) {
    G = G || global.GM;
    opts = opts || {};
    if (!G) return '';
    var turn = Number(opts.turn != null ? opts.turn : G.turn) || 0;
    var sections = [];
    var add = function (head, lines) { if (lines.length) sections.push((head ? head + '\n' : '') + lines.join('\n')); };
    add('', treasuryLines(G));
    add('本回合收支（已落账）：', postingLines(G, turn));
    add('指标变动：', metricLines(G, opts.oldVars));
    add('人事：', peopleLines(G));
    add('', groupLines(G));
    var unlanded = unlandedLines(G, turn, Array.isArray(opts.before) ? opts.before : null);
    if (!sections.length && !unlanded.length) return '';
    var body = sections.join('\n');
    if (unlanded.length) body += '\n【没落地的声明（账上没有，不得写成已发生）】\n' + unlanded.join('\n');
    var room = MAX_CHARS - RULE.length - 40;
    if (body.length > room) body = body.slice(0, room) + '\n（下略）';
    return '\n【本回合账目实变（成文依据·数目以此为准）】\n' + body + '\n' + RULE + '\n';
  }

  TM.TurnLedgerFacts = {
    block: block,
    _parts: { treasuryLines: treasuryLines, postingLines: postingLines, ledgerFlowLines: ledgerFlowLines, metricLines: metricLines, peopleLines: peopleLines, groupLines: groupLines, unlandedLines: unlandedLines, fmt: fmt }
  };
})(typeof window !== 'undefined' ? window : globalThis);
