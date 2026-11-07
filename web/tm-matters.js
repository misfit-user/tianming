// 事的容器（甲1a）：把诏令、承诺、要务、待议、奏疏等旧账只读地整理成「事」，存进 GM.matters，排出案单。
// 设计：docs/guanben-roleplay-20260930/design.md 3.1～3.2 节，tuiyan.md 3.1～3.3 节与第十五章「甲1a」。
//
// 本片的边界：
//   · 不产生任何世界效果。除 GM.matters 外不写 GM 的任何字段，不写 P，不调模型。
//   · 旧的十几套账照旧是真相，这里只是读进来；旧账里的条目结了或没了，对应的事跟着结。
//   · 开关 P.conf.mattersLedgerEnabled 默认关；关着时过回合不跑，也不建 GM.matters。
//   · 显著度公式里本片拿不到的项（关系强度、失真度、银粮数额）记 0，并在 parts 里写明原因。
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.Matters) return;

  var SCHEMA = 1;
  var LIMITS = {
    open: 300,               // 未结的事至多存这么多件，超出按显著度取前面的
    closed: 200,             // 已结的只留一行摘要，先进先出
    optionalPer30Days: 8,    // 择办：每 30 日 8 件〔初值，tuiyan.md 3.3〕
    optionalMax: 20,         // 择办：一次至多 20 件〔初值〕
    signalsPerFiling: 6,     // 账本信号一次至多立这么多件，免得事件日志刷屏
    summaryChars: 300,
    titleChars: 24
  };
  // 民变苗头、驿路阻断、账本信号要过这条线才立案〔初值〕。
  // 本片公式只有紧迫、交办、新异三项有值：高严重度的信号约 2.8，紧急的约 4.0，一般的约 1.9。
  var SALIENCE_LINE = 2.5;

  // 诏令追踪的未结状态，照游戏自己的表（tm-edict-outcomes.js:6）
  var EDICT_OPEN = { pending: 1, executing: 1, partial: 1, obstructed: 1, pending_delivery: 1 };
  // 其余来源的状态词五花八门，凡是这些词都算已结；其余（含没写状态）一律算未结
  var CLOSED_WORD = /^(resolved|completed?|done|closed|settled|failed|cancel+ed|expired|rejected|ruined|lapsed|applied|converted_to_memorial|succeeded|exposed|aborted|abandoned|archived|ended|finished|dismissed|fired|over)$/i;
  // 奏疏、待议里表示「玩家已经批过」的状态（批过的才进案，没批的留案头）
  var DECIDED_WORD = /^(approved|annotated|replied|forwarded|pending_review|adopted|decided|ruled|accepted|granted|准|已批|批答|朱批)$/i;

  var DRAFT_KEYS = [
    // [草稿键（过回合时的 edicts 对象 / 存档里 _savedEdictDrafts 的输入框 id）, 类别]
    [['political', 'edict-pol'], '政令'],
    [['military', 'edict-mil'], '军令'],
    [['diplomatic', 'edict-dip'], '外交'],
    [['economic', 'edict-eco'], '经济'],
    [['other', 'edict-oth'], '其他'],
    [['decree'], '诏书']
  ];
  var XINGLU_KEYS = ['xinglu', 'xinglu-pub'];

  // domain 归类：按顺序取第一个命中的
  var DOMAINS = [
    ['military', /[军兵战边营]/],
    ['revenue', /[饷银粮税赋库财盐漕商]/],
    ['relief', /[赈灾饥荒疫]/],
    ['personnel', /[任免官吏铨考]/],
    ['justice', /[刑狱案讼盗]/],
    ['rites', /[礼祀科学典]/],
    ['works', /[工河城修]|营造/],
    ['diplomacy', /[外藩使]|互市|朝贡/]
  ];

  // 账本信号：事件日志里这些说法才算；按说法定严重度。只看开头一段（标题），长文里顺带提一句的不算
  var SIGNAL_URGENT = /哗变|民变|兵变|起事|揭竿|鼓噪|围城|陷落|失陷|流寇|啸聚|燎原/;
  var SIGNAL_HIGH = /欠饷|缺饷|亏空|赤字|告罄|灾|饥|疫|蝗|旱|涝|决口|流民/;
  var SIGNAL_NORMAL = /缺官|出缺|空缺/;
  var SIGNAL_HEAD = 40;
  // 系统提示、成就、哨兵这类日志不是世事
  var SIGNAL_SKIP_TYPE = /^(系统|哨兵|成就|里程碑|策名|技术|朝代|时代演化|⚠)/;
  var SIGNAL_SKIP_TEXT = /^(达成|成就|解锁)[：:]/;
  // 传闻一类：标「风闻」（design.md 2.1 生事闸），严重度降一级，不让道听途说插到要务前面
  var RUMOR_TYPE = /风闻|边闻|耳报|风议|私讯|文讯|商情|传闻|流言/;

  // 并案用的两字常用词，照实验台原型（E:/tianming-tuiyan-lab/runner/matters-mode.cjs:104）
  var STOP_GRAMS = {};
  ['朝廷', '陛下', '天下', '不得', '以后', '同时', '所有', '一个', '可以', '必须', '其中', '一律', '如有', '大臣',
    '臣等', '皇帝', '百姓', '地方', '官员'].forEach(function (w) { STOP_GRAMS[w] = 1; });
  var MERGE_THRESHOLD = 8;   // 人名每个 3 分，两字词每个 1 分

  // ───────────────────────── 小工具 ─────────────────────────

  function str(x) { return x == null ? '' : String(x); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d == null ? 0 : d); }
  function clip(s, n) { s = str(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) : s; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // 32 位 FNV-1a，转 36 进制补足 7 位；只用来给 id 去重，不作安全用途
  function shortHash(s) {
    s = str(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    var out = h.toString(36);
    while (out.length < 7) out = '0' + out;
    return out;
  }

  function idOf(key) {
    // 中文全换成下划线后容易撞，所以总带上整键的短哈希
    var slug = str(key).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
    return 'm-' + (slug ? slug + '-' : '') + shortHash(key);
  }

  function titleOf(text) {
    var t = str(text).trim();
    var m = t.match(/^「([^」]{2,24})」/);   // 玩家习惯在诏令开头写「标题」
    if (m) return m[1];
    t = t.replace(/\s+/g, '');
    // 取第一句；第一句太长就取到第二个逗号；再长才硬截 18 字
    var first = t.split(/[。；！？]/)[0];
    if (first.length >= 4 && first.length <= 24) return first;
    var clauses = first.split('，');
    var two = clauses.slice(0, 2).join('，');
    if (clauses.length > 1 && two.length >= 4 && two.length <= 24) return two;
    return t.slice(0, 18);
  }

  function domainOf() {
    var hay = Array.prototype.slice.call(arguments).map(str).join(' ').slice(0, 200);
    for (var i = 0; i < DOMAINS.length; i++) if (DOMAINS[i][1].test(hay)) return DOMAINS[i][0];
    return 'court';
  }

  function isClosedWord(status) { return status != null && CLOSED_WORD.test(str(status).trim()); }

  function currentTurn(gm) { return num(gm && gm.turn, 0); }

  function periodDaysOf(opts) {
    if (opts && num(opts.periodDays, 0) > 0) return num(opts.periodDays);
    try { if (typeof root._getDaysPerTurn === 'function') { var d = num(root._getDaysPerTurn(), 0); if (d > 0) return d; } } catch (_) {}
    return 30;
  }

  // ───────────────────────── 人名 ─────────────────────────
  // 自己从 GM.chars 取名单，按名字从长到短扫，免得「王承」吃掉「王承恩」。不依赖 tm-ai-infra.js。

  function nameIndex(gm) {
    var seen = {}, list = [];
    arr(gm && gm.chars).forEach(function (c) {
      var n = c && str(c.name).trim();
      if (n.length >= 2 && !seen[n]) { seen[n] = 1; list.push(n); }
    });
    list.sort(function (a, b) { return b.length - a.length; });
    return list;
  }

  function namesIn(text, index) {
    var t = str(text);
    if (!t || !index.length) return [];
    var taken = [];   // 已被长名字占掉的区间
    var found = [];
    for (var i = 0; i < index.length; i++) {
      var n = index[i], from = 0, pos;
      while ((pos = t.indexOf(n, from)) >= 0) {
        var end = pos + n.length, covered = false;
        for (var j = 0; j < taken.length; j++) {
          if (pos >= taken[j][0] && end <= taken[j][1]) { covered = true; break; }
        }
        if (!covered) {
          taken.push([pos, end]);
          if (found.indexOf(n) < 0) found.push(n);
        }
        from = end;
      }
    }
    return found;
  }

  function gramsOf(text) {
    var g = {};
    str(text).replace(/[^\u4e00-\u9fa5]/g, ' ').split(/\s+/).forEach(function (seg) {
      for (var i = 0; i + 2 <= seg.length; i++) {
        var w = seg.slice(i, i + 2);
        if (!STOP_GRAMS[w]) g[w] = 1;
      }
    });
    return g;
  }

  // ───────────────────────── 候选 ─────────────────────────

  function candidate(o, nameIdx) {
    var text = str(o.text);
    var stakeholders = [];
    // 经手人一栏常写成「杨鹤、武之望、胡廷宴」一串，先拆开；只认人物名册里有的（「户部」「登莱巡抚」这类衙门不算利害人）
    var people = [];
    arr(o.people).forEach(function (p) {
      str(p).split(/[、,，;；\/\s]+/).forEach(function (n) { if (n && nameIdx.indexOf(n) >= 0) people.push(n); });
    });
    // 人名只扫标题和正文前 600 字：长奏疏全文逐名去找太费，利害人也多在开头点到
    people.concat(namesIn(str(o.title) + ' ' + text.slice(0, 600), nameIdx)).forEach(function (n) {
      n = str(n).trim();
      if (n && !stakeholders.some(function (s) { return s.ref === n; })) stakeholders.push({ ref: n, interest: '', weight: 1 });
    });
    return {
      key: o.source + ':' + str(o.ref),
      sphere: 'public',
      domain: o.domain || domainOf(o.kind, o.title, text),
      kind: str(o.kind),
      title: clip(o.title || titleOf(text), LIMITS.titleChars),
      summary: clip(text, LIMITS.summaryChars),
      origin: { kind: o.originKind, source: o.source, ref: str(o.ref) },
      must: !!o.must,
      deskOnly: !!o.deskOnly,
      deadline: o.deadline || null,
      stakeholders: stakeholders.slice(0, 12),
      subject: {},
      verification: o.verification === 'rumor' ? 'rumor' : 'confirmed',
      materials: [],
      status: o.closed ? 'settled' : 'open',
      // 以下只供本次立案用，不存进 GM.matters
      _severity: o.severity == null ? null : str(o.severity),
      _priority: o.priority,
      _handedDown: !!o.handedDown,
      _text: text,
      _order: o.order == null ? 0 : o.order
    };
  }

  // ───────────────────────── 适配器（一律只读） ─────────────────────────
  // 每个适配器返回 { items: 候选[], notFiled: [{ source, ref, title, reason }] }

  function adaptEdicts(gm, ctx) {
    var turn = currentTurn(gm), items = [], notFiled = [];
    arr(gm._edictTracker).forEach(function (t, i) {
      if (!t || typeof t !== 'object' || !str(t.content).trim()) { notFiled.push({ source: 'edictTracker', ref: str(t && t.id), title: '', reason: '条目缺内容' }); return; }
      var thisTurn = t.turn === turn || t.lastSubmittedTurn === turn;
      // 游戏建条目时一律写 pending；没写状态的（只见于人造压力样本）也当未结
      var open = t.status == null || !!EDICT_OPEN[t.status];
      items.push(candidate({
        source: 'edictTracker', ref: t.id || ('idx' + i), originKind: 'order',
        kind: '诏令·' + (str(t.category) || '诏令'), text: t.content,
        people: t.assignee ? [t.assignee] : [],
        must: thisTurn && open, handedDown: true, closed: !open && !thisTurn,
        order: i
      }, ctx.names));
      items[items.length - 1]._turn = t.turn;
    });
    // 同一回合几道诏互相包含（玩家把几段贴进了同一栏）：并案比对时用扣掉别道诏之后「本道诏自己的文字」
    items.forEach(function (a) {
      var own = a._text;
      items.forEach(function (b) {
        if (a !== b && a._turn === b._turn && b._text && b._text.length < a._text.length && own.indexOf(b._text) >= 0) own = own.replace(b._text, ' ');
      });
      if (own !== a._text) a._matchText = own;
    });
    return { items: items, notFiled: notFiled };
  }

  function draftText(src, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = src[keys[i]];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (v && typeof v === 'object' && str(v.pub || v.public || v.text).trim()) return str(v.pub || v.public || v.text).trim();
    }
    return '';
  }

  function adaptEdictDrafts(gm, ctx, opts) {
    var turn = currentTurn(gm), items = [], notFiled = [];
    var src = (opts && opts.edictDrafts) || gm._savedEdictDrafts || {};
    if (!src || typeof src !== 'object') return { items: items, notFiled: notFiled };
    // 本回合的诏令已登记进诏令追踪（过回合时就是这样），草稿就不再重复立案
    var submitted = arr(gm._edictTracker).some(function (t) { return t && (t.turn === turn || t.lastSubmittedTurn === turn); });
    var texts = DRAFT_KEYS.map(function (row) { return { keys: row[0], label: row[1], text: submitted ? '' : draftText(src, row[0]) }; });
    // 某类全文包含在另一类里（玩家把同一段贴进两栏），从长的那件扣掉，归给短的那件（同实验台原型）
    texts.forEach(function (a) {
      texts.forEach(function (b) {
        if (a === b || !a.text || !b.text) return;
        if (a.text.length < b.text.length && b.text.indexOf(a.text) >= 0) b.text = b.text.replace(a.text, '').replace(/\n{3,}/g, '\n\n').trim();
      });
    });
    texts.forEach(function (row, i) {
      if (!row.text) return;
      items.push(candidate({
        source: 'edictDraft', ref: 'T' + turn + ':' + row.keys[0], originKind: 'order',
        kind: '诏令·' + row.label, text: row.text, must: true, handedDown: true, order: i
      }, ctx.names));
    });
    var xl = (opts && opts.xinglu != null) ? opts.xinglu : null;
    var xlText = xl != null ? (typeof xl === 'string' ? xl.trim() : draftText({ x: xl }, ['x'])) : draftText(src, XINGLU_KEYS);
    if (xlText) {
      items.push(candidate({
        source: 'edictDraft', ref: 'T' + turn + ':xinglu', originKind: 'order',
        kind: '行止', text: xlText, must: true, handedDown: true, order: DRAFT_KEYS.length
      }, ctx.names));
    }
    return { items: items, notFiled: notFiled };
  }

  function adaptCommitments(gm, ctx) {
    var turn = currentTurn(gm), items = [], notFiled = [];
    var book = gm._npcCommitments;
    if (book && typeof book === 'object') {
      Object.keys(book).forEach(function (who) {
        arr(book[who]).forEach(function (c, i) {
          var task = str(c && (c.task || c.content || c.text)).trim();
          if (!task) { notFiled.push({ source: 'npcCommitment', ref: str(c && c.id), title: who, reason: '条目缺内容' }); return; }
          items.push(candidate({
            source: 'npcCommitment', ref: str(c.id) || (who + ':' + shortHash(task)), originKind: 'order',
            kind: '承诺·' + who, title: who + '：' + titleOf(task), text: task, people: [who],
            must: !isClosedWord(c.status), handedDown: true, closed: isClosedWord(c.status), order: 100 + i
          }, ctx.names));
          items[items.length - 1]._edictId = str(c.edictId || c.sourceEdictId);
        });
      });
    }
    // 问对里的赏罚：系统已当场结算（tm-endturn-prompt.js:850 起），这里每回合合成一件，让推演记得写人物的次生反应
    var rp = arr(gm._wdRewardPunish).filter(function (r) { return r && r.turn === turn && str(r.target).trim(); });
    if (rp.length) {
      var words = { gold: '赐金', robe: '赐衣', feast: '赐宴', promote: '许以加官', fine: '罚俸', demote: '降职', imprison: '下狱', cane: '杖责' };
      var lines = rp.map(function (r) { return str(r.target) + '：' + (r.type === 'reward' ? '赏' : '罚') + '·' + (words[r.detail] || str(r.detail)); });
      items.push(candidate({
        source: 'wdRewardPunish', ref: 'T' + turn, originKind: 'order', kind: '问对赏罚',
        title: '问对赏罚（' + rp.length + ' 人）', text: lines.join('；'),
        people: rp.map(function (r) { return r.target; }), must: true, handedDown: true, order: 200
      }, ctx.names));
    }
    return { items: items, notFiled: notFiled };
  }

  function adaptIssues(gm, ctx) {
    var items = [], notFiled = [];
    arr(gm.currentIssues).forEach(function (x, i) {
      if (!x || typeof x !== 'object' || !str(x.title || x.name).trim()) { notFiled.push({ source: 'currentIssue', ref: str(x && x.id), title: '', reason: '条目缺标题' }); return; }
      // 「新君观政」「边报·天下军情」「天机」这类说明性汇总带 _info 标记，是给玩家看的局势说明，不是要办的事
      if (x._info) { notFiled.push({ source: 'currentIssue', ref: str(x.id), title: str(x.title || x.name), reason: '说明性条目（_info），不是要办的事' }); return; }
      // 没写严重度的，剧本标为「关键决策」「要事」的按高算（绍宋的要务都不写严重度）
      var sev = x.severity || x.urgency || (/关键决策|要事|紧急/.test(str(x.category)) ? 'high' : null);
      items.push(candidate({
        source: 'currentIssue', ref: x.id || ('idx' + i), originKind: 'signal',
        kind: '时局要务' + (x.category ? '·' + x.category : ''), title: x.title || x.name,
        text: x.description || x.desc || '', people: arr(x.linkedChars).map(str),
        severity: sev, priority: x.priority,
        closed: isClosedWord(x.status), order: 300 + i
      }, ctx.names));
      items[items.length - 1]._issueId = str(x.id);
    });
    return { items: items, notFiled: notFiled };
  }

  function adaptTinyi(gm, ctx) {
    var items = [], notFiled = [];
    arr(gm._pendingTinyiTopics).forEach(function (x, i) {
      var title = str(x && (x.title || x.topic)).trim();
      if (!title) { notFiled.push({ source: 'tinyiTopic', ref: str(x && x.id), title: '', reason: '条目缺标题' }); return; }
      var decided = x.status != null && DECIDED_WORD.test(str(x.status));
      items.push(candidate({
        source: 'tinyiTopic', ref: x.id || ('idx' + i), originKind: 'actor',
        kind: '待议' + (x.sourceType ? '·' + x.sourceType : ''), title: title,
        text: x.demandText || x.detail || x.content || x.reason || title, priority: x.priority,
        deskOnly: !decided, closed: isClosedWord(x.status), order: 400 + i
      }, ctx.names));
      items[items.length - 1]._linkedIssue = str(x.linkedIssue || x.issueId);
    });
    return { items: items, notFiled: notFiled };
  }

  function adaptMemorials(gm, ctx) {
    var items = [], notFiled = [];
    arr(gm.memorials).forEach(function (m, i) {
      var text = str(m && (m.content || m.text)).trim();
      if (!m || !text) { notFiled.push({ source: 'memorial', ref: str(m && m.id), title: str(m && m.title), reason: '条目缺内容' }); return; }
      var decided = !!str(m.reply).trim() || (m.status != null && DECIDED_WORD.test(str(m.status)));
      items.push(candidate({
        source: 'memorial', ref: m.id || ('idx' + i), originKind: 'actor',
        kind: '奏疏' + (m.type ? '·' + m.type : '') + (m.subtype ? '·' + m.subtype : ''),
        title: (str(m.from) ? m.from + '：' : '') + str(m.title || m.topic || titleOf(text)),
        text: text + (str(m.reply).trim() ? '\n【批答】' + m.reply : ''), people: m.from ? [m.from] : [],
        priority: m.priority === 'urgent' ? 100 : m.priority === 'high' ? 60 : null,
        deskOnly: !decided, closed: isClosedWord(m.status), order: 500 + i
      }, ctx.names));
      items[items.length - 1]._relatedTo = str(m.relatedTo);
    });
    return { items: items, notFiled: notFiled };
  }

  function adaptWars(gm, ctx) {
    var items = [], notFiled = [];
    arr(gm.activeWars).forEach(function (w, i) {
      if (!w || typeof w !== 'object') return;
      var sides = [w.attacker, w.defender].map(str).filter(Boolean).join(' 对 ');
      var title = str(w.name || w.title) || sides || ('战事 ' + (i + 1));
      items.push(candidate({
        source: 'activeWar', ref: w.id || shortHash(title), originKind: 'signal', kind: '战事', domain: 'military',
        title: title, text: [sides, w.description || w.desc || w.reason || ''].filter(Boolean).join('：'),
        people: [w.attacker, w.defender].map(str).filter(Boolean), severity: 'high',
        // 游戏以 status==='ongoing' 判进行中；其余算已结
        closed: w.status != null && w.status !== 'ongoing' && w.status !== 'active', order: 600 + i
      }, ctx.names));
    });
    return { items: items, notFiled: notFiled };
  }

  function adaptSchemes(gm, ctx) {
    var items = [], notFiled = [];
    arr(gm.activeSchemes).forEach(function (s, i) {
      if (!s || typeof s !== 'object') return;
      var title = str(s.schemer) + (s.target ? '图' + s.target : '') + '·' + str(s.typeName || '密谋');
      var closed = isClosedWord(s.status);
      var due = !closed && (num(s.progressPct, 0) >= 100 || /^(ripe|due|triggered|executing)$/i.test(str(s.status)));
      if (!due && !closed) { notFiled.push({ source: 'activeScheme', ref: str(s.id), title: title, reason: '阴谋未到期（进度 ' + num(s.progressPct, 0) + '%），由当事人上场时接着谋' }); return; }
      items.push(candidate({
        source: 'activeScheme', ref: s.id || shortHash(title), originKind: 'actor', kind: '阴谋', title: title,
        text: [s.plan, s.method ? '手段：' + s.method : '', s.winCondition ? '成算：' + s.winCondition : ''].filter(Boolean).join('；'),
        people: [s.schemer, s.target].concat(str(s.allies).split(/[,，、]/)).map(str).filter(Boolean),
        severity: 'urgent', closed: closed, order: 700 + i
      }, ctx.names));
    });
    return { items: items, notFiled: notFiled };
  }

  function unrestRows(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.keys(v).map(function (k) { var x = v[k]; return x && typeof x === 'object' ? Object.assign({ _key: k }, x) : { _key: k, text: str(x) }; });
    return [];
  }

  function adaptUnrest(gm, ctx) {
    var items = [];
    [['_revoltPrecursors', 'revoltPrecursor', '民变苗头'], ['_routeDisruptions', 'routeDisruption', '驿路阻断']].forEach(function (row) {
      unrestRows(gm[row[0]]).forEach(function (x, i) {
        if (!x || typeof x !== 'object') return;
        var place = str(x.region || x.regionName || x.place || x.location || x.route || x._key);
        var text = str(x.text || x.desc || x.description || x.reason || x.cause);
        var title = row[2] + (place ? '·' + place : '');
        items.push(candidate({
          source: row[1], ref: x.id || x._key || shortHash(title + text), originKind: 'signal',
          kind: row[2], domain: row[1] === 'routeDisruption' ? 'works' : 'military', title: title, text: text || title,
          severity: x.severity || x.level || 'high', priority: x.priority, closed: isClosedWord(x.status),
          order: 800 + i
        }, ctx.names));
        items[items.length - 1]._needsLine = true;
      });
    });
    return { items: items, notFiled: [] };
  }

  function adaptForeshadows(gm, ctx) {
    var turn = currentTurn(gm), items = [], notFiled = [];
    // 游戏真实字段是 _foreshadows（tm-save-lifecycle.js 的追加型字段表里有）；设计稿写的 _foreshadowings 一并认
    arr(gm._foreshadows).concat(arr(gm._foreshadowings)).forEach(function (f, i) {
      var text = str(f && (f.content || f.text)).trim();
      if (!text) return;
      var by = f.resolveBy == null ? null : num(f.resolveBy, null);
      if (by == null || by > turn) { notFiled.push({ source: 'foreshadow', ref: str(f.id || i), title: clip(text, 24), reason: by == null ? '伏笔没写到期回合' : '伏笔未到期（第 ' + by + ' 回合）' }); return; }
      items.push(candidate({
        source: 'foreshadow', ref: f.id || ('T' + num(f.turn) + ':' + shortHash(text)), originKind: 'ai',
        kind: '伏笔·' + str(f.type || ''), text: text, severity: f.priority, deadline: { turn: by, day: null },
        order: 900 + i
      }, ctx.names));
      items[items.length - 1]._mergeOnly = true;   // 到期的伏笔只并进相关的事，并不进就不立
    });
    return { items: items, notFiled: notFiled };
  }

  // 剧本事件的触发条件只认「T<n> 自动触发」（只管第 n 回合）「T<a>-T<b> 自动触发」；带「若……」的条件本片不判
  function triggerWindow(cond) {
    var m = str(cond).match(/^\s*T\s*(\d+)(?:\s*[-–~～至到]\s*T?\s*(\d+))?\s*自动触发/);
    if (!m) return null;
    var from = num(m[1]);
    return { from: from, to: m[2] == null ? from : num(m[2]) };
  }

  function adaptScenarioEvents(gm, ctx) {
    var turn = currentTurn(gm), items = [], notFiled = [];
    arr(gm._candidateEvents).forEach(function (x, i) {
      if (!x || x._fired) return;
      var title = str(x.title || x.name || x.id);
      var win = triggerWindow(x.triggerCondition);
      if (!win) { notFiled.push({ source: 'candidateEvent', ref: str(x.id), title: title, reason: '条件触发（' + clip(x.triggerCondition, 30) + '），本片不判' }); return; }
      if (turn < win.from) { notFiled.push({ source: 'candidateEvent', ref: str(x.id), title: title, reason: '还没到触发回合（' + clip(x.triggerCondition, 30) + '）' }); return; }
      if (turn > win.to) { notFiled.push({ source: 'candidateEvent', ref: str(x.id), title: title, reason: '过了触发回合仍未触发（' + clip(x.triggerCondition, 30) + '）' }); return; }
      items.push(candidate({
        source: 'candidateEvent', ref: x.id || ('idx' + i), originKind: 'calendar',
        kind: '剧本事件' + (x.type ? '·' + x.type : ''), title: title,
        text: [x.presenter ? x.presenter + '：' : '', str(x.payload || x.description), x.rationale ? '（' + x.rationale + '）' : ''].join(''),
        people: x.presenter ? [x.presenter] : [], severity: 'high',
        deadline: { turn: win.to, day: null }, order: 1000 + i
      }, ctx.names));
    });
    return { items: items, notFiled: notFiled };
  }

  function adaptSignals(gm, ctx) {
    var turn = currentTurn(gm), items = [], seen = {};
    arr(gm.evtLog).forEach(function (e, i) {
      if (!e || num(e.turn, -1) < turn - 1) return;   // 只看这段时日：上一回合结算记下的和本回合的
      var text = str(e.text).trim();
      if (SIGNAL_SKIP_TYPE.test(str(e.type)) || SIGNAL_SKIP_TEXT.test(text)) return;
      var head = text.slice(0, SIGNAL_HEAD);
      var sev = SIGNAL_URGENT.test(head) ? 'urgent' : SIGNAL_HIGH.test(head) ? 'high' : SIGNAL_NORMAL.test(head) ? 'normal' : null;
      if (!sev) return;
      var rumor = RUMOR_TYPE.test(str(e.type));
      if (rumor) sev = sev === 'urgent' ? 'high' : 'normal';
      var sig = str(e.type) + '|' + text.slice(0, 16);
      if (seen[sig]) return;
      seen[sig] = 1;
      items.push(candidate({
        source: 'evtLog', ref: 'T' + num(e.turn) + ':' + i, originKind: 'signal',
        kind: '账本信号·' + (str(e.type) || '事件'), title: titleOf(text), text: text, severity: sev, order: 1100 + i,
        verification: rumor ? 'rumor' : 'confirmed'
      }, ctx.names));
      items[items.length - 1]._needsLine = true;
    });
    return { items: items, notFiled: [] };
  }

  var ADAPTERS = {
    edicts: adaptEdicts,
    edictDrafts: adaptEdictDrafts,
    commitments: adaptCommitments,
    issues: adaptIssues,
    tinyi: adaptTinyi,
    memorials: adaptMemorials,
    wars: adaptWars,
    schemes: adaptSchemes,
    unrest: adaptUnrest,
    foreshadow: adaptForeshadows,
    scenarioEvents: adaptScenarioEvents,
    signals: adaptSignals
  };

  // 不立案、只计数的来源：它们是人物上场时的材料（tuiyan.md 3.1 节末段）
  var COUNT_ONLY = ['_hiddenMoves', '_npcActionLedger', '_sc16FactionDirectives', '_pendingNpcLetters', '_pendingNpcCorrespondence'];

  // ───────────────────────── 显著度（design.md 3.2） ─────────────────────────

  var SEVERITY = [
    [/^(urgent|critical|紧急|极|危)/i, 1.0],
    [/^(high|severe|重|高)/i, 0.6],
    [/^(warn|warning|警)/i, 0.45],   // 晚唐剧本的要务用 warn
    [/^(normal|medium|中|一般)/i, 0.3],
    [/^(low|轻|低)/i, 0.1]
  ];

  function severityScore(sev) {
    var s = str(sev).trim();
    if (!s) return null;
    for (var i = 0; i < SEVERITY.length; i++) if (SEVERITY[i][0].test(s)) return SEVERITY[i][1];
    return null;
  }

  function part(value, weight, note) {
    return { value: value, weight: weight, score: Math.round(value * weight * 1000) / 1000, note: note || '' };
  }

  // seenKinds：本次立案里已经出现过的 domain|kind（「新异」只给头一件）
  function salience(cand, gm, seenKinds) {
    var turn = currentTurn(gm);
    var urgency, urgencyNote;
    if (cand.deadline && cand.deadline.turn != null) {
      var left = num(cand.deadline.turn) - turn;
      urgency = left <= 0 ? 1.5 : 1 / left;
      urgencyNote = left <= 0 ? '已过期' : '剩 ' + left + ' 回合';
    } else {
      var bySev = severityScore(cand._severity);
      var byPri = (cand._priority != null && isFinite(Number(cand._priority))) ? Math.min(1, Math.max(0, Number(cand._priority) / 100)) : null;
      urgency = Math.max(bySev == null ? 0 : bySev, byPri == null ? 0 : byPri);
      if (bySev == null && byPri == null) { urgency = 0.3; urgencyNote = '无限期、无严重度，取缺省 0.3'; }
      else urgencyNote = '严重度 ' + (bySev == null ? '—' : bySev) + '，priority ' + (byPri == null ? '—' : Math.round(byPri * 100) / 100) + '，取大';
    }
    var kindKey = cand.domain + '|' + cand.kind;
    var novel = !(seenKinds && seenKinds[kindKey]);
    if (!novel) {
      // 已经见过同类的，不算新异
    } else if (gm && gm.matters && gm.matters.byId) {
      var ms = gm.matters;
      var existsOpen = Object.keys(ms.byId).some(function (id) { var m = ms.byId[id]; return m && m.key !== cand.key && m.domain === cand.domain && m.kind === cand.kind; });
      var existsClosed = arr(ms.closed).some(function (m) { return m && m.domain === cand.domain && m.kind === cand.kind; });
      if (existsOpen || existsClosed) novel = false;
    }
    if (seenKinds) seenKinds[kindKey] = 1;
    var parts = {
      size: part(0, 2.0, '甲1a 不从正文猜数额，来源里也没有数额字段'),
      urgency: part(urgency, 3.0, urgencyNote),
      relation: part(0, 2.5, '甲1a 无关系数据'),
      distortion: part(0, 3.0, '甲1a 无实情与呈报对照'),
      handedDown: part(cand._handedDown ? 1 : 0, 4.0, cand._handedDown ? '皇帝交办' : ''),
      novelty: part(novel ? 1 : 0, 1.0, novel ? '同类头一件' : '同类已有')
    };
    var total = 0;
    Object.keys(parts).forEach(function (k) { total += parts[k].score; });
    return { total: Math.round(total * 1000) / 1000, parts: parts };
  }

  // ───────────────────────── 收集与并案 ─────────────────────────

  function inspect(gm, opts) {
    opts = opts || {};
    var ctx = { names: nameIndex(gm) };
    var candidates = [], notFiled = [], counts = {};
    Object.keys(ADAPTERS).forEach(function (name) {
      var out;
      try { out = ADAPTERS[name](gm || {}, ctx, opts) || { items: [], notFiled: [] }; }
      catch (e) { out = { items: [], notFiled: [{ source: name, ref: '', title: '', reason: '适配器出错：' + str(e && e.message) }] }; }
      counts[name] = { candidates: out.items.length, notFiled: out.notFiled.length };
      candidates = candidates.concat(out.items);
      notFiled = notFiled.concat(out.notFiled);
    });
    var countOnly = {};
    COUNT_ONLY.forEach(function (k) {
      var v = gm && gm[k];
      countOnly[k] = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
    });
    return { candidates: candidates, notFiled: notFiled, counts: counts, countOnly: countOnly };
  }

  function collect(gm, opts) { return inspect(gm, opts).candidates; }

  function attach(host, c, why) {
    host.materials.push({ source: c.origin.source, ref: c.origin.ref, title: c.title, why: why });
    // 它自己先前并进来的材料一起带过去（如待议先挂在要务上，要务再并进诏令），免得丢
    c.materials.forEach(function (x) {
      host.materials.push({ source: x.source, ref: x.ref, title: x.title, why: '随「' + c.title + '」并入：' + x.why });
    });
    c.materials = [];
    c._mergedInto = host.key;
  }

  // 并案：只把非必办的候选并进别的候选作材料，两件必办永不相并（tuiyan.md 3.2）
  function merge(cands) {
    var open = cands.filter(function (c) { return c.status === 'open'; });
    var must = open.filter(function (c) { return c.must; });
    var byIssue = {}, byKey = {};
    open.forEach(function (c) { byKey[c.key] = c; if (c._issueId) byIssue[c._issueId] = c; });
    var merged = 0;

    // 第一步：显式链接
    open.forEach(function (c) {
      if (c.must || c._mergedInto) return;
      var host = null, why = '';
      if (c._linkedIssue && byIssue[c._linkedIssue] && byIssue[c._linkedIssue] !== c) { host = byIssue[c._linkedIssue]; why = '待议挂在这条要务上（linkedIssue）'; }
      if (!host && c._relatedTo) {
        var rt = c._relatedTo;
        host = byIssue[rt] || byKey['edictTracker:' + rt] || null;
        if (host === c) host = null;
        if (host) why = '奏疏注明相关（relatedTo）';
      }
      if (host) { attach(host, c, why); merged++; }
    });
    // 承诺挂到它那道诏上（带诏令 id 的按 id，否则按任务文本与诏令全文相同或互相包含）。
    // 承诺是必办，但它和诏是同一件事，不算两件必办相并；那道诏若是此前没办完的，因这条待办的承诺升为必办。
    var edictsOpen = open.filter(function (m) { return m.origin.source === 'edictTracker' || m.origin.source === 'edictDraft'; });
    open.forEach(function (c) {
      if (c.origin.source !== 'npcCommitment' || c._mergedInto) return;
      var host = c._edictId ? byKey['edictTracker:' + c._edictId] : null;
      if (!host) {
        // 先找全文相同的；没有再在互相包含的里面取长度最接近的（大段诏令里常包着别道诏的原文）
        var a = c._text.trim();
        var hits = edictsOpen.filter(function (m) {
          var b = m._text.trim();
          return a && b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
        });
        hits.sort(function (x, y) {
          var ex = x._text.trim() === a ? 0 : 1, ey = y._text.trim() === a ? 0 : 1;
          if (ex !== ey) return ex - ey;
          return Math.abs(x._text.length - a.length) - Math.abs(y._text.length - a.length);
        });
        host = hits[0] || null;
      }
      if (!host) return;
      attach(host, c, '承诺的就是这道诏');
      merged++;
      if (c.must && !host.must) { host.must = true; host._promotedBy = '有待办的承诺'; }
    });
    must = open.filter(function (c) { return c.must && !c._mergedInto; });

    // 第二步：人名与词重合（人名每个 3 分，两字词每个 1 分，≥ 8 才并；同标题的跟着并）。
    // 诏令、承诺这类「令」不当材料并走：两道令各是各的事，只有上面那种显式对应才挂在一起。
    function hostOf(m) {
      var names = {};
      var own = m._matchText || m._text;
      // 本道诏自己的文字里点到的人才算（扣掉被包进来的别道诏）
      m.stakeholders.forEach(function (s) { if (!m._matchText || own.indexOf(s.ref) >= 0) names[s.ref] = 1; });
      return { m: m, names: names, grams: gramsOf(m.title + ' ' + own) };
    }
    function bestHost(c, hosts) {
      var twin = hosts.filter(function (h) { return h.m !== c && h.m.materials.some(function (x) { return x.title === c.title; }); })[0];
      if (twin) return { host: twin.m, why: '同名材料已并在这里' };
      var g = gramsOf(c.title + ' ' + c._text.slice(0, 500));
      var best = null, bestScore = 0;
      hosts.forEach(function (h) {
        if (h.m === c) return;
        var s = 0;
        c.stakeholders.forEach(function (p) { if (h.names[p.ref]) s += 3; });
        Object.keys(g).forEach(function (w) { if (h.grams[w]) s += 1; });
        if (s > bestScore) { bestScore = s; best = h; }
      });
      return best && bestScore >= MERGE_THRESHOLD ? { host: best.m, why: '人名与词重合 ' + bestScore + ' 分' } : null;
    }
    var mustHosts = must.map(hostOf);
    open.forEach(function (c) {
      if (c.must || c._mergedInto || c._mergeOnly || c.origin.kind === 'order' || !mustHosts.length) return;
      var hit = bestHost(c, mustHosts);
      if (hit) { attach(hit.host, c, hit.why); merged++; }
    });
    // 到期的伏笔并进相关的事：必办之外，没并走的要务、剧本事件等也算（留案头的不算）
    // 要过线才立的（民变苗头、驿路、信号）不当并入对象：它若没过线，并进去的伏笔会跟着丢
    var anyHosts = open.filter(function (m) { return !m._mergedInto && !m._mergeOnly && !m.deskOnly && !m._needsLine; }).map(hostOf);
    open.forEach(function (c) {
      if (!c._mergeOnly || c._mergedInto) return;
      var hit = bestHost(c, anyHosts);
      if (hit) { attach(hit.host, c, '到期伏笔·' + hit.why); merged++; }
    });
    return merged;
  }

  // ───────────────────────── 存进 GM.matters ─────────────────────────

  function ensure(gm) {
    if (!gm || typeof gm !== 'object') return null;
    var m = gm.matters;
    if (!m || typeof m !== 'object' || Array.isArray(m)) m = gm.matters = {};
    if (!m.schemaVersion) m.schemaVersion = SCHEMA;
    if (!m.byId || typeof m.byId !== 'object' || Array.isArray(m.byId)) m.byId = {};
    if (!m.byDocket || typeof m.byDocket !== 'object' || Array.isArray(m.byDocket)) m.byDocket = {};
    if (!isFinite(Number(m.seq))) m.seq = 0;
    if (!Array.isArray(m.closed)) m.closed = [];
    return m;
  }

  function playerKey(gm) {
    var me = arr(gm.chars).filter(function (c) { return c && c.isPlayer; })[0];
    if (me && (me.id || me.name)) return str(me.id || me.name);
    var pi = gm.playerInfo || {};
    return str(pi.characterId || pi.characterName) || 'player';
  }

  function charKey(gm, name) {
    var c = arr(gm.chars).filter(function (x) { return x && x.name === name; })[0];
    return c ? str(c.id || c.name) : '';
  }

  function stored(c, turn, prev) {
    return {
      id: idOf(c.key),
      key: c.key,
      sphere: c.sphere,
      domain: c.domain,
      kind: c.kind,
      organizationId: prev ? prev.organizationId : '',
      locus: prev ? prev.locus : {},
      subject: c.subject,
      facts: prev ? prev.facts : { actual: {}, reported: {} },
      deadline: c.deadline,
      precedent: prev ? prev.precedent : '',
      stakeholders: c.stakeholders,
      origin: c.origin,
      verification: c.verification,
      chain: prev ? prev.chain : [],
      status: 'open',
      must: c.must,
      deskOnly: c.deskOnly,
      salience: c.salience,
      narrative: { title: c.title, summary: c.summary },
      materials: c.materials.slice(0, 20),
      // tuiyan.md 3.1 节多出的三个字段：本片不办事，先留空
      nextDay: prev ? prev.nextDay : null,
      waitingFor: prev ? prev.waitingFor : '',
      volumes: prev ? prev.volumes : [],
      createdTurn: prev ? prev.createdTurn : turn,
      updatedTurn: turn
    };
  }

  function closeMatter(M, m, why, turn) {
    delete M.byId[m.id];
    M.closed.push({ id: m.id, title: (m.narrative && m.narrative.title) || '', domain: m.domain, kind: m.kind, closedTurn: turn, closedBy: why });
    if (M.closed.length > LIMITS.closed) M.closed.splice(0, M.closed.length - LIMITS.closed);
  }

  function rank(a, b) {
    if (a.must !== b.must) return a.must ? -1 : 1;
    if (a.must) return a._order - b._order;
    return (b.salience ? b.salience.total : 0) - (a.salience ? a.salience.total : 0);
  }

  function file(gm, opts) {
    var M = ensure(gm);
    if (!M) return null;
    var turn = currentTurn(gm);
    var seen = inspect(gm, opts);
    var cands = seen.candidates;
    var stats = { turn: turn, candidates: cands.length, merged: 0, filed: 0, updated: 0, closed: 0, skipped: 0, notes: [] };
    stats.merged = merge(cands);

    var kinds = {};
    var open = cands.filter(function (c) { return c.status === 'open' && !c._mergedInto; });
    open.forEach(function (c) { c.salience = salience(c, gm, kinds); });
    // 只并不立的（到期伏笔）、要过线才立的（民变苗头、驿路、信号）在这里筛
    var below = [], lonely = [];
    open = open.filter(function (c) {
      if (c._mergeOnly) { lonely.push(c); return false; }
      if (c._needsLine && !c.must && c.salience.total < SALIENCE_LINE) { below.push(c); return false; }
      return true;
    });
    var signals = open.filter(function (c) { return c.origin.source === 'evtLog'; }).sort(rank);
    var tooMany = signals.slice(LIMITS.signalsPerFiling);
    if (tooMany.length) open = open.filter(function (c) { return tooMany.indexOf(c) < 0; });
    open.sort(rank);
    var keep = open.slice(0, LIMITS.open), overflow = open.slice(LIMITS.open);
    stats.skipped = below.length + lonely.length + tooMany.length + overflow.length;
    var brief = function (c, reason) { return { source: c.origin.source, ref: c.origin.ref, title: c.title, reason: reason }; };
    stats.skippedItems = []
      .concat(below.map(function (c) { return brief(c, '显著度 ' + c.salience.total + ' 不过线 ' + SALIENCE_LINE); }))
      .concat(lonely.map(function (c) { return brief(c, '到期伏笔没有可并的事'); }))
      .concat(tooMany.map(function (c) { return brief(c, '账本信号超出单次上限 ' + LIMITS.signalsPerFiling); }))
      .concat(overflow.map(function (c) { return brief(c, '超出未结上限 ' + LIMITS.open); }));
    if (below.length) stats.notes.push(below.length + ' 件显著度不过线（' + SALIENCE_LINE + '）');
    if (lonely.length) stats.notes.push(lonely.length + ' 条到期伏笔没有可并的事');
    if (tooMany.length) stats.notes.push(tooMany.length + ' 条账本信号超出单次上限 ' + LIMITS.signalsPerFiling);
    if (overflow.length) stats.notes.push(overflow.length + ' 件超出未结上限 ' + LIMITS.open);

    var live = {};
    keep.forEach(function (c) {
      var id = idOf(c.key), prev = M.byId[id] || null;
      M.byId[id] = stored(c, turn, prev);
      live[id] = 1;
      if (prev) stats.updated++;
      else {
        stats.filed++;
        M.seq = num(M.seq) + 1;
        // 重新立案的，从已结摘要里拿掉
        M.closed = M.closed.filter(function (x) { return x && x.id !== id; });
      }
    });
    // 来源结了、没了、被挤出上限的，对应的事跟着结
    var settledKeys = {}, mergedKeys = {};
    cands.forEach(function (c) { if (c.status !== 'open') settledKeys[c.key] = 1; if (c._mergedInto) mergedKeys[c.key] = 1; });
    var overflowIds = {};
    overflow.concat(below, lonely, tooMany).forEach(function (c) { overflowIds[idOf(c.key)] = 1; });
    Object.keys(M.byId).forEach(function (id) {
      if (live[id]) return;
      var m = M.byId[id];
      var why = settledKeys[m.key] ? 'source-closed' : mergedKeys[m.key] ? 'merged' : overflowIds[id] ? 'overflow' : 'source-gone';
      closeMatter(M, m, why, turn);
      stats.closed++;
    });

    // 案头索引：玩家案头放全部未结的事（必办在前，再按显著度）；诏令追踪写了经手人的，也挂到经手人案头
    var me = playerKey(gm);
    M.byDocket = {};
    M.byDocket[me] = keep.map(function (c) { return idOf(c.key); });
    arr(gm._edictTracker).forEach(function (t) {
      if (!t || !t.assignee) return;
      var id = idOf('edictTracker:' + str(t.id));
      if (!M.byId[id]) return;
      var who = charKey(gm, str(t.assignee));
      if (!who || who === me) return;
      (M.byDocket[who] = M.byDocket[who] || []).push(id);
    });
    M.lastFiled = { turn: turn, stats: { candidates: stats.candidates, merged: stats.merged, filed: stats.filed, updated: stats.updated, closed: stats.closed, skipped: stats.skipped } };
    return stats;
  }

  // ───────────────────────── 案单 ─────────────────────────

  function docket(gm, opts) {
    var M = gm && gm.matters;
    var out = { must: [], optional: [], notChosen: [], desk: [], overdue: [], quota: 0 };
    if (!M || !M.byId) return out;
    var turn = currentTurn(gm);
    var all = Object.keys(M.byId).map(function (id) { return M.byId[id]; }).filter(function (m) { return m && m.status === 'open'; });
    var order = {};
    arr(M.byDocket[playerKey(gm)]).forEach(function (id, i) { order[id] = i; });
    var byOrder = function (a, b) { return (order[a.id] == null ? 1e9 : order[a.id]) - (order[b.id] == null ? 1e9 : order[b.id]); };
    var bySalience = function (a, b) { return ((b.salience && b.salience.total) || 0) - ((a.salience && a.salience.total) || 0); };
    out.must = all.filter(function (m) { return m.must; }).sort(byOrder);
    out.desk = all.filter(function (m) { return !m.must && m.deskOnly; }).sort(bySalience);
    var rest = all.filter(function (m) { return !m.must && !m.deskOnly; }).sort(bySalience);
    out.quota = Math.min(LIMITS.optionalMax, Math.ceil(LIMITS.optionalPer30Days * periodDaysOf(opts) / 30));
    // 账本信号至多占择办名额的一半：民变、哗变一回合能记出十几条，不能把要务全挤掉
    var signalCap = Math.ceil(out.quota / 2), signals = 0;
    rest.forEach(function (m) {
      var isSignal = m.origin && m.origin.source === 'evtLog';
      if (out.optional.length < out.quota && (!isSignal || signals < signalCap)) {
        out.optional.push(m);
        if (isSignal) signals++;
      } else out.notChosen.push(m);
    });
    out.overdue = out.notChosen.filter(function (m) { return m.deadline && m.deadline.turn != null && num(m.deadline.turn) < turn; });
    return out;
  }

  TM.Matters = {
    schemaVersion: SCHEMA,
    limits: LIMITS,
    salienceLine: SALIENCE_LINE,
    ensure: ensure,
    inspect: inspect,
    collect: collect,
    file: file,
    docket: docket,
    salience: function (cand, gm) { return salience(cand, gm, null); },
    adapters: ADAPTERS,
    _idOf: idOf,
    _titleOf: titleOf,
    _triggerWindow: triggerWindow,
    _namesIn: function (text, gm) { return namesIn(text, nameIndex(gm)); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
