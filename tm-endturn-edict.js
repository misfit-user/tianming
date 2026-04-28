// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-edict.js — 诏令处理子系统
//
// R88 从 tm-endturn.js §B 抽出·2 个 cluster：
//   Cluster 1 (原 L3497-3869): extractEdictActions / _findPositionInOfficeTree /
//                              applyEdictActions / extractCustomPolicies /
//                              applyCustomPolicies / getCustomPolicyContext
//   Cluster 2 (原 L4081-4190): computeExecutionPipeline / processEdictEffects
//
// 所有函数保持 function xxx() 顶级声明·挂在 window 上·调用方无需改
//
// 加载顺序：必须在 tm-endturn.js 之前（index.html 顺序已调整）
// ============================================================

function extractEdictActions(edictText) {
  if (!edictText || edictText.length < 4) return { appointments: [], dismissals: [], deaths: [] };
  var actions = { appointments: [], dismissals: [], deaths: [] };
  var text = edictText.replace(/\s+/g, '');

  // 预构建已知姓名集（含字号）——用于扫名优先
  var knownChars = [];
  var knownMap = {};
  (GM.chars || []).forEach(function(c) {
    if (!c || !c.name) return;
    if (!knownMap[c.name]) { knownMap[c.name] = c.name; knownChars.push(c.name); }
    ['zi','haoName','milkName'].forEach(function(k){
      if (c[k] && c[k].length >= 2 && !knownMap[c[k]]) { knownMap[c[k]] = c.name; knownChars.push(c[k]); }
    });
    if (Array.isArray(c.aliases)) c.aliases.forEach(function(a){
      if (a && a.length >= 2 && !knownMap[a]) { knownMap[a] = c.name; knownChars.push(a); }
    });
  });
  // 长名优先避免"张惟" 遮挡 "张惟贤"
  knownChars.sort(function(a,b){ return b.length - a.length; });
  var knownRx = knownChars.length ? new RegExp('(' + knownChars.map(function(n){return n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|') + ')', 'g') : null;

  // 已知职位（从 officeTree 收集）——用于更精确的 position 边界识别
  var knownPosts = [];
  function _collectPosts(nodes) {
    (nodes||[]).forEach(function(n){
      if (!n) return;
      (n.positions||[]).forEach(function(p){ if (p && p.name && knownPosts.indexOf(p.name)<0) knownPosts.push(p.name); });
      if (n.subs) _collectPosts(n.subs);
    });
  }
  _collectPosts(GM.officeTree || []);
  knownPosts.sort(function(a,b){ return b.length - a.length; });

  function _findKnownPosition(raw) {
    if (!raw) return null;
    // 先找含已知职位的最长子串
    for (var i=0; i<knownPosts.length; i++) {
      if (raw.indexOf(knownPosts[i]) >= 0) return knownPosts[i];
    }
    // 否则返回首尾剥掉标点的原串
    return raw.replace(/[，。、的之至]/g, '');
  }

  // ═══ 任命模式（扩展动词表 + 非贪婪 + 已知名字锚定） ═══
  // 动词：任/命/擢/拜/召/授/令/起用/起复/加/封/册/迁/进/升/改任/转/除
  var appointVerbs = '(?:任命|擢升|擢任|擢拜|改任|起用|起复|授任|着任|特命|特授|授|命|令|擢|拜|召|迁|进|升|加|封|册封|册立|加封|除授|除|转)';
  var appointLinks = '(?:为|任|出任|担任|兼任|兼|领|主|掌|督|统|行|权|摄)';
  var appointPatterns = [
    // V + 名 + 连接词 + 职
    new RegExp(appointVerbs + '([\\u4e00-\\u9fa5]{2,6}?)' + appointLinks + '([\\u4e00-\\u9fa5]{2,14})', 'g'),
    // 着/令 + 名 + 职（无连接词·如"着韩爌内阁首辅"）
    new RegExp('(?:着|令|使)([\\u4e00-\\u9fa5]{2,6}?)((?:内阁|翰林|都察|五军|六部|中书|礼部|户部|吏部|兵部|刑部|工部|司礼|锦衣|光禄|太仆|鸿胪|国子)[\\u4e00-\\u9fa5]{2,12})', 'g'),
    // 名 + 连接词 + 职（"韩爌出任首辅"）
    new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:出任|担任|兼任|调任|迁任|转任|就任)([\\u4e00-\\u9fa5]{2,14})', 'g')
  ];
  var _appointSet = {};
  appointPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、的]/g, '');
      var rawPos = m[2].replace(/[，。、]/g, '');
      // 已知名字匹配 — 若原 regex 截长了·取最末的已知名
      var char = rawName;
      if (knownChars.length) {
        var best = null;
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { best = knownChars[i]; break; }
        }
        if (best) char = knownMap[best]; // 字号→主名
      }
      // 已知职位匹配
      var pos = _findKnownPosition(rawPos);
      if (char.length < 2 || pos.length < 2) continue;
      var key = char + '→' + pos;
      if (_appointSet[key]) continue;
      _appointSet[key] = true;
      actions.appointments.push({ character: char, position: pos });
    }
  });

  // ═══ 免职模式 ═══
  var dismissVerbs = '(?:免去|罢免|革去|撤去|免职|撤职|革职|削职|黜|罢|削|贬|黜陟|谪|戍|贬谪|着革|着免)';
  var dismissPatterns = [
    new RegExp(dismissVerbs + '([\\u4e00-\\u9fa5]{2,6}?)(?:的|之)?([\\u4e00-\\u9fa5]{0,14})', 'g'),
    new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:免职|去职|撤职|革职|削职|下狱)', 'g')
  ];
  var _dismissSet = {};
  dismissPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、的之]/g, '');
      var char = rawName;
      if (knownChars.length) {
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { char = knownMap[knownChars[i]]; break; }
        }
      }
      if (char.length < 2 || _dismissSet[char]) continue;
      _dismissSet[char] = true;
      actions.dismissals.push({ character: char, position: m[2] ? m[2].replace(/[，。、]/g, '') : '' });
    }
  });

  // ═══ 赐死模式 ═══
  var deathPatterns = [
    /(?:赐死|赐予自尽|处死|处斩|斩首|诛杀|赐鸩|赐自尽|磔死|弃市|斩于市|着自尽|令自裁)([\u4e00-\u9fa5]{2,6}?)(?:[。，、！]|$)/g,
    /(?:赐死|赐予自尽|处死|处斩|斩首|诛杀|赐鸩)([\u4e00-\u9fa5]{2,6})/g
  ];
  var _deathSet = {};
  deathPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、]/g, '');
      var char = rawName;
      if (knownChars.length) {
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { char = knownMap[knownChars[i]]; break; }
        }
      }
      if (char.length < 2 || _deathSet[char]) continue;
      _deathSet[char] = true;
      actions.deaths.push({ character: char });
    }
  });

  if (actions.appointments.length || actions.dismissals.length || actions.deaths.length) {
    _dbg('[Edict] 从诏令提取:', JSON.stringify(actions));
  }
  return actions;
}

/** 在 officeTree 中按职位名（模糊/后缀）找到第一个 position 对象（并返回其父节点路径用于记录）*/
function _findPositionInOfficeTree(posName) {
  if (!posName || !GM.officeTree) return null;
  var found = null;
  function walk(nodes, deptPath) {
    (nodes || []).forEach(function(n) {
      if (found) return;
      if (!n) return;
      var dp = (deptPath ? deptPath + '·' : '') + (n.name || '');
      (n.positions || []).forEach(function(p) {
        if (found || !p || !p.name) return;
        // 精确匹配
        if (p.name === posName) { found = { pos: p, deptPath: dp }; return; }
      });
      // 再做一次模糊匹配（包含关系）
      if (!found) {
        (n.positions || []).forEach(function(p) {
          if (found || !p || !p.name) return;
          if (p.name.indexOf(posName) >= 0 || posName.indexOf(p.name) >= 0) {
            found = { pos: p, deptPath: dp };
          }
        });
      }
      if (!found && n.subs) walk(n.subs, dp);
    });
  }
  walk(GM.officeTree, '');
  return found;
}

/** 执行从诏令中提取的操作（在AI推演前执行，确保状态一致） */
function applyEdictActions(actions) {
  if (!actions) return;
  // 任命——双路径查找：postSystem.posts（动态岗位）+ officeTree（静态官制）
  actions.appointments.forEach(function(a) {
    var char = findCharByName(a.character);
    if (!char) {
      addEB('人事', '诏欲任' + a.character + '为' + a.position + '·然朝无此人（待甄进）');
      return;
    }
    var done = false;
    // Path 1: postSystem 动态岗位（地方封疆大员等）
    if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts && GM.postSystem.posts.length) {
      var post = null;
      GM.postSystem.posts.forEach(function(p) { if (!post && p.name === a.position) post = p; });
      if (post) {
        PostTransfer.seat(post.id, a.character, '玩家诏令');
        if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'appointment', '奉诏就任' + a.position);
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
          if (char) CorruptionEngine.markAsRecentAppointment(char);
        }
        addEB('人事', a.character + '奉诏就任' + a.position, { credibility: 'high' });
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
        done = true;
      }
    }
    // Path 2: 主路径 — officeTree 中找 position.name 并直接改 holder（这是游戏内官制的真正来源）
    if (!done) {
      var hit = _findPositionInOfficeTree(a.position);
      if (hit) {
        var prevHolder = hit.pos.holder || '';
        hit.pos.holder = a.character;
        // 更新 char 元数据
        char.officialTitle = a.position;
        char.position = a.position;
        if (!char.careerHistory) char.careerHistory = [];
        char.careerHistory.push({ turn: GM.turn, event: '奉诏就任 ' + a.position + '（' + hit.deptPath + '）' });
        // 前任记录
        if (prevHolder && prevHolder !== a.character) {
          var prevCh = findCharByName(prevHolder);
          if (prevCh) {
            prevCh._displaced = { from: a.position, by: a.character, turn: GM.turn };
            if (prevCh.officialTitle === a.position) prevCh.officialTitle = '';
          }
        }
        // 官职公库 currentHead 跟着换
        if (hit.pos.publicTreasury) hit.pos.publicTreasury.currentHead = a.character;
        if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'appointment', '奉诏就任' + a.position);
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) CorruptionEngine.markAsRecentAppointment(char);
        addEB('人事', a.character + '奉诏就任' + a.position + '（' + hit.deptPath + '）', { credibility: 'high' });
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
        // ★ 远地角色启动赴任行程
        if (char.location) {
          var _capE = GM._capital || '京师';
          var _destE = _capE;
          var _regE = (hit.deptPath + a.position).match(/([\u4e00-\u9fa5]{2,4})(?:\u5DE1\u629A|\u603B\u5175|\u603B\u7763|\u5E03\u653F\u4F7F|\u6309\u5BDF\u4F7F|\u7ECF\u7565|\u8282\u5EA6)/);
          if (_regE && _regE[1]) _destE = _regE[1];
          if (!_isSameLocation(char.location, _destE) && !char._travelTo) {
            var _daysE = 20;
            try { if (typeof calcLetterDays === 'function') _daysE = calcLetterDays(char.location, _destE, 'normal') || 20; } catch(_){}
            var _dpvE = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
            char._travelFrom = char.location;
            char._travelTo = _destE;
            char._travelStartTurn = GM.turn;
            char._travelRemainingDays = _daysE;
            char._travelArrival = GM.turn + Math.max(1, Math.ceil(_daysE / _dpvE));
            char._travelReason = '奉诏赴任 ' + a.position;
            char._travelAssignPost = (hit.deptPath || '') + '/' + a.position;
            if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
            GM._chronicle.unshift({
              turn: GM.turn, date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
              type: '赴任启程', title: a.character + ' 赴 ' + _destE,
              content: a.character + ' 自' + char.location + ' 启程赴' + _destE + '·就任 ' + a.position + '·预计 ' + _daysE + ' 日抵任。',
              category: '人事', tags: ['人事', '赴任', '启程', a.character]
            });
            if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
            GM.qijuHistory.unshift({
              turn: GM.turn, date: GM._gameDate || '',
              content: '【启程】' + a.character + ' 自' + char.location + ' 赴 ' + _destE + ' 就任 ' + a.position
            });
          }
        }
        done = true;
      }
    }
    // Path 3: 即使都找不到·也要更新角色字段 + 记录（让 AI 至少知道玩家意图已生效）
    if (!done) {
      char.officialTitle = a.position;
      char.position = a.position;
      if (!char.careerHistory) char.careerHistory = [];
      char.careerHistory.push({ turn: GM.turn, event: '奉诏就任 ' + a.position + '（官制中暂未立此衙门·视同特设）' });
      addEB('人事', a.character + '奉诏就任' + a.position + '（特设）', { credibility: 'medium' });
      if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
    }
  });
  // 免职——双路径：postSystem + officeTree
  actions.dismissals.forEach(function(a) {
    var char = findCharByName(a.character);
    var didAny = false;
    if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts && GM.postSystem.posts.length) {
      try { PostTransfer.cascadeVacate(a.character); didAny = true; } catch(e){ if(window.TM&&TM.errors) TM.errors.capture(e,'endturn.cascadeVacate'); }
    }
    // 同时扫 officeTree 把所有 holder===name 的 position 清空
    if (GM.officeTree) {
      function walkD(nodes) {
        (nodes||[]).forEach(function(n) {
          if (!n) return;
          (n.positions||[]).forEach(function(p) {
            if (p && p.holder === a.character) { p.holder = ''; didAny = true; }
          });
          if (n.subs) walkD(n.subs);
        });
      }
      walkD(GM.officeTree);
    }
    if (char) {
      char.officialTitle = '';
      char.position = '';
      if (!char.careerHistory) char.careerHistory = [];
      char.careerHistory.push({ turn: GM.turn, event: '奉诏免职' });
    }
    if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'dismissal', '奉诏免职');
    addEB('人事', a.character + '被免职', { credibility: didAny ? 'high' : 'medium' });
    if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', -10, '被免职');
  });
  // 赐死
  actions.deaths.forEach(function(a) {
    var char = findCharByName(a.character);
    if (!char) return;
    char.alive = false;
    char.dead = true;
    char.deathTurn = GM.turn;
    char.deathReason = '赐死';
    if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'death', '被赐死');
    addEB('人事', a.character + '被赐死');
        // 赐死某人会让其亲近者对玩家产生怨恨
        if (typeof AffinityMap !== 'undefined') {
          var deadRels = AffinityMap.getRelations(a.character);
          deadRels.forEach(function(r) { if (r.value > 20) AffinityMap.add(r.name, P.playerInfo.characterName || '玩家', -15, '赐死' + a.character); });
        }
  });
}

// ============================================================
// 自定义国策提取（借鉴 ChongzhenSim coreGameplaySystem）
// 从诏令中识别"定为国策""纳入国策"等语句，创建持久化政策
// 国策跨回合生效，影响 AI 推演上下文
// ============================================================
/** @param {string} edictText @returns {Array<{id:string, name:string, category:string, turn:number}>} */
function extractCustomPolicies(edictText) {
  if (!edictText || edictText.length < 6) return [];
  var policies = [];
  // 匹配模式：将XX定为国策 / 推行XX之策 / 颁布XX令
  var patterns = [
    /(?:将|以|把)?[「「"]?([\u4e00-\u9fa5A-Za-z0-9]{2,20})[」」"]?(?:定为|列为|纳入|确立为)(?:国策|基本国策|长期国策)/g,
    /(?:颁布|推行|施行|实行)[「「"]?([\u4e00-\u9fa5A-Za-z0-9]{2,20})[」」"]?(?:令|法|制|策|之策|之令)/g,
    /(?:永为|永定|定为)(?:祖制|成法|国典)[：:]*[「「"]?([\u4e00-\u9fa5A-Za-z0-9]{2,20})[」」"]?/g
  ];
  patterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(edictText)) !== null) {
      var name = (m[1] || m[2] || m[3] || '').replace(/[，。、！？]/g, '').trim();
      if (name.length >= 2 && name.length <= 20) {
        // 自动分类
        var category = 'general';
        if (/军|兵|边|防|武|战/.test(name)) category = 'military';
        else if (/农|粮|赈|田|仓|水利/.test(name)) category = 'agriculture';
        else if (/税|财|商|工|海|贸/.test(name)) category = 'fiscal';
        else if (/吏|政|法|察|廉|监|科举/.test(name)) category = 'governance';
        else if (/外|使|盟|朝贡|通商/.test(name)) category = 'diplomacy';
        policies.push({ id: 'custom_' + uid(), name: name, category: category, turn: GM.turn });
      }
    }
  });
  return policies;
}

/** 将提取的国策存入 GM 并注入 AI 上下文 */
function applyCustomPolicies(policies) {
  if (!policies || policies.length === 0) return;
  if (!GM.customPolicies) GM.customPolicies = [];
  policies.forEach(function(p) {
    // 去重（同名国策不重复添加）
    var exists = GM.customPolicies.some(function(ep) { return ep.name === p.name; });
    if (!exists) {
      GM.customPolicies.push(p);
      addEB('国策', '颁布国策：' + p.name + '（' + p.category + '）');
      if (typeof recordPlayerDecision === 'function') recordPlayerDecision('policy', '立' + p.name + '为国策');
      _dbg('[Policy] 新国策:', p.name, p.category);
    }
  });
  // 上限30条
  if (GM.customPolicies.length > 30) GM.customPolicies = GM.customPolicies.slice(-30);
}

/** 获取国策上下文（供 AI prompt） */
function getCustomPolicyContext() {
  if (!GM.customPolicies || GM.customPolicies.length === 0) return '';
  var ctx = '【当前国策】\n';
  var byCat = {};
  GM.customPolicies.forEach(function(p) {
    if (!byCat[p.category]) byCat[p.category] = [];
    byCat[p.category].push(p.name);
  });
  var catNames = { military: '军事', agriculture: '农政', fiscal: '财政', governance: '政务', diplomacy: '外交', general: '其他' };
  Object.keys(byCat).forEach(function(cat) {
    ctx += '  ' + (catNames[cat] || cat) + '：' + byCat[cat].join('、') + '\n';
  });
  ctx += '  ※ 以上为已颁布的长期国策，请在推演中持续体现其影响。\n';
  return ctx;
}

// ─── cluster 1 / 2 分隔 ──────────────────────────────────

function computeExecutionPipeline(edictText, edictCategory) {
  var mc = (typeof P !== 'undefined' && P.mechanicsConfig) ? P.mechanicsConfig : {};
  var pipeline = mc.executionPipeline;
  if (!pipeline || !pipeline.length) return { stages: [], summary: '' };
  var stages = [];

  for (var i = 0; i < pipeline.length; i++) {
    var stage = pipeline[i];
    var officerName = '';
    var ability = 0, loyalty = 0;
    var note = '';

    // 确定functionKey——如果为null，根据诏令类别动态匹配
    var fKey = stage.functionKey;
    if (!fKey && edictCategory) {
      var catMap = { '政令': 'central_admin', '军令': 'military', '外交': 'diplomacy', '经济': 'finance' };
      fKey = catMap[edictCategory] || null;
    }

    // 查找对口官员——仅收集信息，不计算通过率
    if (fKey && typeof findOfficeByFunction === 'function') {
      var officer = findOfficeByFunction(fKey);
      if (officer && officer.holder) {
        var ch = (typeof findCharByName === 'function') ? findCharByName(officer.holder) : null;
        if (ch) {
          officerName = ch.name;
          ability = ch.ability || ch.intelligence || 50;
          loyalty = ch.loyalty || 50;
        }
      } else {
        note = '空缺';
      }
    }

    stages.push({
      name: stage.name,
      officer: officerName,
      ability: ability,
      loyalty: loyalty,
      note: note
    });
  }

  // 生成摘要字符串——纯信息，供AI判断
  var summary = stages.map(function(s) {
    var desc = s.name + '(';
    if (s.officer) desc += s.officer + ' 能力' + s.ability + ' 忠诚' + s.loyalty;
    else if (s.note) desc += s.note;
    else desc += '未配置';
    desc += ')';
    return desc;
  }).join('→');

  return { stages: stages, summary: summary };
}

// ============================================================
// 2.2: 诏令执行情境构建（仅供AI prompt参考，不做机械效果）
// 天命核心理念：诏令效果完全由AI根据剧本背景+官制+角色判断
// 此函数只收集执行环境信息注入AI prompt，帮助AI做出更好的判断
// ============================================================
function processEdictEffects(allEdictText, edictCategory) {
  if (!allEdictText || !allEdictText.trim()) return { summary: '', executionSummary: '' };

  // v5·人物生成 A：诏令征召识别（异步 fire-and-forget）
  try {
    if (typeof handleEdictTextForRecruit === 'function') {
      handleEdictTextForRecruit(allEdictText).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '\u8BCF\u4EE4\u5F81\u8BCF] \u5F02\u5E38') : console.warn('[\u8BCF\u4EE4\u5F81\u8BCF] \u5F02\u5E38', e); });
    }
  } catch(_rE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rE, '\u8BCF\u4EE4\u5F81\u8BCF') : console.warn('[\u8BCF\u4EE4\u5F81\u8BCF]', _rE); }

  // 收集执行管线信息（如果有配置）
  var execResult = computeExecutionPipeline(allEdictText, edictCategory);

  // 保存到 GM 供 AI prompt 注入（纯信息，无机械效果）
  GM._edictMechanicalReport = '';
  GM._edictExecutionReport = execResult.summary;

  // 制度类诏令自动识别 + 分流（货币/税种/户籍/徭役/兵制/官制 + P1）
  try {
    if (typeof EdictParser !== 'undefined' && typeof EdictParser.tryExecute === 'function') {
      var edictResult = EdictParser.tryExecute(allEdictText, {}, { category: edictCategory });
      if (edictResult && edictResult.pathway) {
        GM._lastEdictClassification = edictResult;
        var typeLabel = edictResult.typeKey ? (EdictParser.EDICT_TYPES[edictResult.typeKey] ? EdictParser.EDICT_TYPES[edictResult.typeKey].name : edictResult.typeKey) : '';
        if (edictResult.pathway === 'memorial') {
          var drafter = edictResult.memo && edictResult.memo.drafter || '有司';
          var msg1 = '〔' + typeLabel + '〕旨意已下，' + drafter + ' 下回合具奏';
          if (typeof addEB === 'function') addEB('诏令', msg1);
          if (typeof toast === 'function') toast('诏令识别：' + typeLabel + ' → ' + drafter + ' 复奏');
        } else if (edictResult.pathway === 'ask') {
          var q = (edictResult.clarification && edictResult.clarification.questions && edictResult.clarification.questions[0]) || '圣意具体如何？';
          if (typeof addEB === 'function') addEB('诏令', '侍臣问疑：' + q);
          if (typeof toast === 'function') toast('诏令需细化：' + q);
        } else if (edictResult.ok && edictResult.pathway === 'direct') {
          var msg2 = '〔' + typeLabel + '〕已直断施行' + (edictResult.isP1 ? '（P1 特殊）' : '');
          if (typeof addEB === 'function') addEB('诏令', msg2);
          if (typeof toast === 'function') toast('诏令已施行：' + typeLabel);
        }
      }
    }
    // 技术类诏令识别
    if (typeof EnvRecoveryFill !== 'undefined' && typeof EnvRecoveryFill.parseTechDecree === 'function') {
      var techRes = EnvRecoveryFill.parseTechDecree(allEdictText);
      if (techRes && techRes.ok && typeof toast === 'function') toast('技术诏令：' + techRes.tech + ' 提升');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'edict] 制度分流失败:') : console.error('[edict] 制度分流失败:', e); }

  return { summary: '', executionSummary: execResult.summary };
}
