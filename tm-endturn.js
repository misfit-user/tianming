// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// EndTurn System - 回合结算（天命核心模块）
// Requires: tm-data-model.js, tm-utils.js, tm-mechanics.js,
//           tm-change-queue.js, tm-index-world.js, tm-npc-engine.js,
//           tm-game-engine.js, tm-dynamic-systems.js (all prior modules)
//
// 文件结构（8.4 逻辑分区）：
//   §A  辅助系统（行~1-900）: findOfficeByFunction, AGENDA_TEMPLATES,
//       runAnnualReview, generateChancellorSuggestions, resolveHeir,
//       checkGoals, computeNpcIntents, SettlementPipeline注册, 成就系统
//   §B  诏令处理（行~900-4000）: extractEdictActions, NPC反应,
//       computeExecutionPipeline, processEdictEffects, _endTurn_collectInput
//   §C  AI推演（行~4000-7500）: _endTurn_aiInfer, sysP构建,
//       Sub-call 0~2.8, AI返回处理（character_deaths/npc_actions/...）
//   §D  系统更新（行~7500-8200）: _endTurn_updateSystems, NPC行为
//   §E  渲染展示（行~8200-8700）: _endTurn_render, Delta面板, 高亮
//   §F  回合收尾（行~8700+）: 月度/年度编年, 记忆压缩, 自动存档,
//       endTurn()主调度器
// ============================================================
/**
 * 根据职能关键词在官制体系中查找负责部门和主官
 * @param {string} funcKeyword - 职能关键词（如"铨选""科举""军务""刑狱""礼仪""户口"）
 * @returns {{dept:string, deptDesc:string, official:string, holder:string, duties:string}|null}
 */
async function aiDeepReadScenario() {
  if (!P.ai || !P.ai.key) return;
  if (GM._aiScenarioDigest) return;
  if (GM.turn > 1) return;

  var sc = findScenarioById(GM.sid);
  if (!sc) return;
  var url = P.ai.url; if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';
  var model = P.ai.model || 'gpt-4o';
  var pi = P.playerInfo || {};

  async function _call(sysMsg, userMsg, maxTok) {
    // 根据模型上下文窗口动态调整max_tokens
    // 基础倍率×3 + 上下文缩放因子（大模型可以输出更多内容）
    var _drCp = (typeof getCompressionParams === 'function') ? getCompressionParams() : {scale:1.0,contextK:32};
    var _drScale = Math.max(1.0, _drCp.scale); // 深度阅读不缩小，只放大
    var _actualTok = Math.round((maxTok || 800) * 3 * _drScale);
    // 限制不超过模型输出上限（上下文的1/4）
    var _drOutputCap = Math.round(_drCp.contextK * 1024 / 4);
    _actualTok = Math.min(_actualTok, _drOutputCap);
    _actualTok = Math.max(_actualTok, 500);
    var resp = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key},
      body:JSON.stringify({model:model, messages:[{role:'system',content:sysMsg},{role:'user',content:userMsg}], temperature:0.5, max_tokens:_actualTok})});
    if (!resp.ok) return {};
    var j = await resp.json(); var raw = (j.choices&&j.choices[0]&&j.choices[0].message) ? j.choices[0].message.content : '';
    try { return JSON.parse(raw.match(/\{[\s\S]*\}/)[0]); } catch(e) { return {_raw: raw}; }
  }

  var totalSteps = 28;
  function prog(step, label) { showLoading(label, Math.round(step / totalSteps * 100)); }

  // ═══ 构建全量数据块（完全不截断） ═══

  // 块A: 剧本元信息 + 总述 + 规则 + 矛盾
  var blockA = '【剧本】' + (sc.name||'') + ' ' + (sc.era||sc.dynasty||'') + ' ' + (sc.emperor||'') + '\n';
  if (sc.overview) blockA += '【总述全文】\n' + sc.overview + '\n';
  if (sc.globalRules) blockA += '【全局规则】\n' + sc.globalRules + '\n';
  if (pi.characterName) blockA += '【玩家】' + pi.characterName + (pi.characterTitle?'('+pi.characterTitle+')':'') + ' 势力:' + (pi.factionName||'') + ' 目标:' + (pi.factionGoal||'') + '\n';
  if (pi.characterBio) blockA += '  简介:' + pi.characterBio + '\n';
  if (pi.characterPersonality) blockA += '  性格:' + pi.characterPersonality + '\n';
  if (pi.coreContradictions && pi.coreContradictions.length > 0) {
    blockA += '【显著矛盾】\n';
    pi.coreContradictions.forEach(function(c) { blockA += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + ': ' + (c.description||'') + '\n'; });
  }

  // 块B: 全部角色（完整字段）——D10: 超过30人时动态压缩
  var _aliveChars = (GM.chars||[]).filter(function(c){ return c.alive !== false; });
  var _charCount = _aliveChars.length;
  var _compressChars = _charCount > 30; // 超过30人启用压缩模式
  var blockB = '【全部角色(' + _charCount + '人)——请逐个记住】\n';

  // 压缩模式下，按重要性排序：玩家>后妃>高品级>高记忆>其他
  if (_compressChars) {
    _aliveChars.sort(function(a, b) {
      var sa = (a.isPlayer ? 100 : 0) + (a.spouse ? 30 : 0) + ((10 - (a.rankLevel||9)) * 5) + ((a._memory||[]).length * 2) + ((a._scars||[]).length * 5);
      var sb = (b.isPlayer ? 100 : 0) + (b.spouse ? 30 : 0) + ((10 - (b.rankLevel||9)) * 5) + ((b._memory||[]).length * 2) + ((b._scars||[]).length * 5);
      return sb - sa;
    });
    blockB += '（角色较多，前30位高重要角色详述，其余精简。精简角色可参与群体事件但不宜作为独立行动主角）\n';
  }

  _aliveChars.forEach(function(c, _ci) {
    // D10: 压缩模式下，排名30之后的角色只注入一行精简信息
    var _isMinor = _compressChars && _ci >= 30;

    if (_isMinor) {
      // 精简模式：名字+势力+职务+忠诚+一个关键属性
      var _brief = c.name;
      if (c.faction) _brief += '(' + c.faction + ')';
      if (c.officialTitle && c.officialTitle !== '无') _brief += ' ' + c.officialTitle;
      else if (c.title) _brief += ' ' + c.title;
      _brief += ' 忠' + (c.loyalty||50);
      if (c.location && c.location !== (GM._capital||'京城')) _brief += ' 在' + c.location;
      blockB += '  ' + _brief + '\n';
      return;
    }

    // 完整模式
    var line = c.name;
    if (c.title) line += '(' + c.title + ')';
    if (c.faction) line += ' 势力:' + c.faction;
    if (c.officialTitle && c.officialTitle !== '无') line += ' 官职:' + c.officialTitle;
    if (c.party) line += ' 党派:' + c.party;
    if (c.isPlayer) line += ' ★玩家';
    line += ' 忠' + (c.loyalty||50) + ' 野' + (c.ambition||50) + ' 智' + (c.intelligence||50) + ' 武勇' + (c.valor||50) + ' 军事' + (c.military||50) + ' 政' + (c.administration||50) + ' 管' + (c.management||50) + ' 魅' + (c.charisma||50) + ' 交' + (c.diplomacy||50) + ' 仁' + (c.benevolence||50);
    // 追加特质行为倾向（若有）
    if (c.traits && c.traits.length > 0 && typeof getTraitBehaviorSummary === 'function') {
      var _tbs = getTraitBehaviorSummary(c.traits);
      if (_tbs) line += '\n     [特质]' + _tbs;
    }
    // 文事简况——让AI知道此人是否文人、代表作
    if (c.works && c.works.length > 0 && GM.culturalWorks) {
      var _cwMap = {};
      GM.culturalWorks.forEach(function(w){ _cwMap[w.id] = w; });
      var _myW = c.works.map(function(id) { return _cwMap[id]; }).filter(Boolean);
      if (_myW.length) {
        var _rep = _myW.slice(-3).map(function(w) { return '《' + w.title + '》' + (w.isPreserved?'★':''); }).join('、');
        line += '\n     [文事]作品' + _myW.length + '篇：' + _rep;
      }
    }
    // 关系网——最强5条关系（含标签/冲突/累积历史）
    if (typeof getTopRelations === 'function' && c.relations) {
      var _topR = getTopRelations(c.name, 5);
      if (_topR.length > 0) {
        var _relLines = _topR.map(function(t) { return typeof summarizeRelation === 'function' ? summarizeRelation(t.name, t.rel) : t.name; });
        line += '\n     [关系]' + _relLines.join('；');
      }
    }
    // 五常语义层
    if (typeof getWuchangText === 'function') line += ' ' + getWuchangText(c);
    // 家世门第
    if (typeof getFamilyStatusText === 'function') { var _fst = getFamilyStatusText(c); if (_fst) line += ' ' + _fst; }
    // 恩怨
    if (typeof EnYuanSystem !== 'undefined') { var _eyt = EnYuanSystem.getTextForChar(c.name); if (_eyt) line += ' ' + _eyt; }
    // 门生网络
    if (typeof PatronNetwork !== 'undefined') { var _pnt = PatronNetwork.getTextForChar(c.name); if (_pnt) line += ' ' + _pnt; }
    // 面子
    if (typeof FaceSystem !== 'undefined' && c._face !== undefined) line += ' ' + FaceSystem.getFaceText(c);
    // 特质名（比8D维度更可读）
    if (c.traitIds && c.traitIds.length > 0 && P.traitDefinitions) {
      var _tNames = c.traitIds.map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;});return d?d.name:'';}).filter(Boolean);
      if (_tNames.length) line += ' 特质:' + _tNames.join('·');
    }
    if (c.stance) line += ' 立场:' + c.stance;
    if (c.role && c.role !== c.title) line += ' 身份:' + c.role;
    if (c.faith) line += ' 信仰:' + c.faith;
    if (c.culture) line += ' 文化:' + c.culture;
    if (c.learning) line += ' 学识:' + c.learning;
    if (c.ethnicity) line += ' 民族:' + c.ethnicity;
    if (c.birthplace) line += ' 籍贯:' + c.birthplace;
    if (c.partyRank) line += '(' + c.partyRank + ')';
    if (c.location && c.location !== (GM._capital||'京城')) line += ' 在:' + c.location;
    if (c.bio) line += ' 简介:' + c.bio;
    if (c.personalGoal) line += ' 目标:' + c.personalGoal;
    if (c._goalSatisfaction !== undefined) line += '(满足' + Math.round(c._goalSatisfaction) + '%)';
    // 永久伤疤/勋章（一生中最深刻的经历）
    if (c._scars && c._scars.length > 0) {
      line += ' \u523B\u9AA8:' + c._scars.slice(-3).map(function(s) { return s.event + '[' + s.emotion + ']'; }).join(';');
    }
    if (c.personality) line += ' \u6027\u683C:' + String(c.personality);
    if (c.appearance) line += ' \u5916\u8C8C:' + String(c.appearance);
    if (c.spouse) line += ' [\u914D\u5076]';
    if (c.family) line += ' \u5BB6\u65CF:' + c.family;
    if (c.vassalType) line += ' 封臣:' + c.vassalType;
    blockB += '  ' + line + '\n';
  });

  // 块B2: NPC性格行为倾向（让AI理解NPC行为动机）
  if (typeof getNpcPersonalityInjection === 'function') {
    var _npcBrief = getNpcPersonalityInjection(8);
    if (_npcBrief) blockB += '\n' + _npcBrief + '\n';
  }

  // 块B3: NPC个人记忆+心绪（全员注入，分层详略）
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) {
    var _memLines = ['【全员心绪记忆——必须驱动NPC行为】'];
    var _allMemChars = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer; });

    // 模型倍率决定注入详细程度
    var _memScale = 1.0;
    if (typeof getCompressionParams === 'function') {
      _memScale = Math.max(0.6, Math.min(getCompressionParams().scale, 2.0));
    }
    var _t1Limit = Math.round(300 * _memScale); // 核心人物截断
    var _t2Limit = Math.round(180 * _memScale); // 重要人物截断
    var _t3EventLen = Math.round(20 * _memScale); // 一般人物事件截断

    // 按重要性分3层
    var _tier1 = []; // 核心人物 → 完整记忆
    var _tier2 = []; // 重要人物 → 精简记忆
    var _tier3 = []; // 一般人物 → 一行情绪

    _allMemChars.forEach(function(c) {
      var cap = NpcMemorySystem.getCapacity(c);
      var hasMemory = c._memory && c._memory.length > 0;
      var hasScars = c._scars && c._scars.length > 0;
      var maxImp = hasMemory ? c._memory.reduce(function(m,e){return Math.max(m,e.importance||0);},0) : 0;

      // 后妃/首领/高容量(≥50)角色→tier1
      if (c.spouse || cap.active >= 50) { _tier1.push(c); return; }
      // 有高importance记忆(≥6)或伤疤或高容量(≥30)→tier2
      if (maxImp >= 6 || hasScars || cap.active >= 30) { _tier2.push(c); return; }
      // 有记忆或情绪→tier3
      if (hasMemory || (c._mood && c._mood !== '平')) { _tier3.push(c); return; }
    });

    // Tier 1: 完整记忆上下文
    if (_tier1.length > 0) {
      _memLines.push('\n〔核心人物·完整记忆〕');
      _tier1.forEach(function(c) {
        var ctx = NpcMemorySystem.getMemoryContext(c.name);
        if (ctx) _memLines.push('★ ' + c.name + '：' + ctx.slice(0, _t1Limit));
      });
    }

    // Tier 2: 精简记忆
    if (_tier2.length > 0) {
      _memLines.push('\n〔重要人物·关键记忆〕');
      _tier2.sort(function(a,b) {
        var aM = (a._memory||[]).reduce(function(m,e){return Math.max(m,e.importance||0);},0);
        var bM = (b._memory||[]).reduce(function(m,e){return Math.max(m,e.importance||0);},0);
        return bM - aM;
      });
      _tier2.forEach(function(c) {
        var ctx = NpcMemorySystem.getMemoryContext(c.name);
        if (ctx) _memLines.push('- ' + c.name + '：' + ctx.slice(0, _t2Limit));
      });
    }

    // Tier 3: 一行情绪+最近事件
    if (_tier3.length > 0) {
      _memLines.push('\n〔一般人物·当前状态〕');
      var _t3Lines = _tier3.map(function(c) {
        var mood = c._mood || '平';
        var topMem = (c._memory && c._memory.length > 0) ? c._memory[c._memory.length - 1].event : '';
        var scar = (c._scars && c._scars.length > 0) ? '!' + c._scars[c._scars.length - 1].event : '';
        return c.name + '(' + mood + (topMem ? '·' + topMem : '') + scar + ')';
      });
      for (var _t3i = 0; _t3i < _t3Lines.length; _t3i += 3) {
        _memLines.push('  ' + _t3Lines.slice(_t3i, _t3i + 3).join('  '));
      }
    }

    _memLines.push('');
    _memLines.push('共' + (_tier1.length + _tier2.length + _tier3.length) + '人有记忆（核心' + _tier1.length + '+重要' + _tier2.length + '+一般' + _tier3.length + '，模型倍率×' + _memScale.toFixed(1) + '）');
    _memLines.push('【记忆→行为规则】所有有记忆的NPC，其行为必须与记忆一致。');
    _memLines.push('核心人物(★)的记忆逐条考虑；重要人物(-)的关键事件影响行为；一般人物的情绪体现在叙事中。');
    _memLines.push('特质(traitIds)叠加在记忆之上：狡诈者隐忍不发但暗中报复；坦诚者有仇当面说；勇猛者冲动行事；怯懦者逃避问题。');
    blockB += '\n' + _memLines.join('\n') + '\n';
  }

  // 块B4: NPC人际印象网络（让AI知道谁对谁有好感/敌意——驱动结盟/背叛）
  var _impLines = [];
  (GM.chars||[]).forEach(function(c) {
    if (c.alive === false || !c._impressions) return;
    var entries = [];
    for (var pn in c._impressions) {
      var imp = c._impressions[pn];
      if (Math.abs(imp.favor) >= 10) {
        var rel = imp.favor >= 25 ? '深信' : imp.favor >= 10 ? '好感' : imp.favor <= -25 ? '死仇' : '嫌恶';
        entries.push(pn + ':' + rel + '(' + imp.favor + ')');
      }
    }
    if (entries.length > 0) _impLines.push(c.name + '\u2192' + entries.join(' '));
  });
  if (_impLines.length > 0) {
    blockB += '\n【人际印象网络——NPC之间的好恶必须影响其行为选择】\n';
    blockB += _impLines.join('\n') + '\n';
    if (_impLines.length > 30) blockB += '...及另外' + (_impLines.length - 30) + '组关系\n';
  }

  // 块B5: 待铨进士（让AI知道有新人才可用）
  if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) {
    blockB += '\n【待铨进士（科举及第、尚未授官）】\n';
    GM._kejuPendingAssignment.forEach(function(p) {
      blockB += '  ' + p.name + '（第' + p.rank + '名，' + (p.origin||'') + '）等待' + (GM.turn - p.enrollTurn) + '回合\n';
    });
  }

  // 块C: 全部势力+党派+阶层+关系 —— D10: 超过30个势力时压缩
  var _facCount = (GM.facs||[]).length;
  var _compressFacs = _facCount > 30;
  var blockC = '【全部势力(' + _facCount + '个)】\n';
  // 压缩模式下按重要性排序
  var _sortedFacs = (GM.facs||[]).slice();
  if (_compressFacs) {
    _sortedFacs.sort(function(a, b) {
      var sa = (a.isPlayer ? 100 : 0) + (a.strength||50);
      var sb = (b.isPlayer ? 100 : 0) + (b.strength||50);
      return sb - sa;
    });
    blockC += '（势力较多，前30详述，其余精简）\n';
  }
  _sortedFacs.forEach(function(f, _fi) {
    // D10: 压缩模式下排名30之后的势力只注入一行
    if (_compressFacs && _fi >= 30) {
      blockC += '  ' + f.name + ' 实力' + (f.strength||50) + (f.leader ? ' 首领:'+f.leader : '') + (f.isPlayer ? ' ★' : '') + '\n';
      return;
    }
    var line = f.name + ' 实力' + (f.strength||50);
    if (f.leader) line += ' 首领:' + f.leader;
    if (f.type) line += ' 类型:' + f.type;
    if (f.territory) line += ' 领地:' + f.territory;
    if (f.goal) line += ' 目标:' + f.goal;
    if (f.attitude) line += ' 态度:' + f.attitude;
    if (f.leaderTitle) line += '(' + f.leaderTitle + ')';
    if (f.militaryStrength) line += ' \u5175\u529B:' + f.militaryStrength;
    if (f.economy) line += ' \u7ECF\u6D4E:' + f.economy;
    if (f.playerRelation !== undefined && f.playerRelation !== 0) line += ' \u5BF9\u7389\u5173\u7CFB:' + f.playerRelation;
    if (f.resources) line += ' \u8D44\u6E90:' + f.resources;
    if (f.mainstream) line += ' 主体:' + f.mainstream;
    if (f.culture) line += ' 文化:' + f.culture;
    if (f.description) line += ' 描述:' + f.description;
    if (f.vassals && f.vassals.length > 0) line += ' 封臣:[' + f.vassals.join(',') + ']';
    if (f.liege) line += ' 宗主:' + f.liege;
    if (f.isPlayer) line += ' ★玩家';
    // 势力深化字段
    if (f.cohesion && typeof f.cohesion === 'object') {
      var _cohParts = [];
      ['political','military','economic','cultural','ethnic','loyalty'].forEach(function(k){ if (f.cohesion[k]!=null) _cohParts.push(k[0].toUpperCase() + f.cohesion[k]); });
      if (_cohParts.length) line += ' \u51DD' + _cohParts.join(',');
    }
    if (f.militaryBreakdown) {
      var _mb = f.militaryBreakdown;
      var _mbParts = [];
      if (_mb.standingArmy) _mbParts.push('常'+_mb.standingArmy);
      if (_mb.militia) _mbParts.push('民兵'+_mb.militia);
      if (_mb.elite) _mbParts.push('精'+_mb.elite);
      if (_mb.fleet) _mbParts.push('舰'+_mb.fleet);
      if (_mbParts.length) line += ' 军:' + _mbParts.join('/');
    }
    if (f.succession) {
      line += ' 储君:' + (f.succession.designatedHeir||'未立') + '(' + (f.succession.rule||'') + ' 稳' + (f.succession.stability||60) + ')';
    }
    if (Array.isArray(f.internalParties) && f.internalParties.length > 0) line += ' 内部党派:[' + f.internalParties.join(',') + ']';
    if (Array.isArray(f.historicalEvents) && f.historicalEvents.length > 0) {
      var _recentH = f.historicalEvents.slice(-2).map(function(e){return 'T'+e.turn+':'+(e.event||'');}).join('；');
      line += ' 近事:' + _recentH;
    }
    blockC += '  ' + line + '\n';
  });
  if (GM.factionRelations && GM.factionRelations.length > 0) {
    blockC += '\u3010\u52BF\u529B\u5173\u7CFB\u3011\n';
    GM.factionRelations.forEach(function(r) { blockC += '  ' + r.from + '\u2192' + r.to + ' ' + (r.type||'') + '(' + (r.value||0) + ')' + (r.desc ? ' ' + r.desc : '') + '\n'; });
  }
  // 封臣关系实例
  var _vassalLines = [];
  (GM.facs || []).forEach(function(f) {
    if (f.vassals && f.vassals.length > 0) {
      f.vassals.forEach(function(vn) {
        var vf = GM.facs.find(function(ff) { return ff.name === vn; });
        _vassalLines.push('  ' + vn + '\u2192\u5B97\u4E3B:' + f.name + (vf && vf.tributeRate ? ' \u8D21' + Math.round(vf.tributeRate * 100) + '%' : ''));
      });
    }
  });
  if (_vassalLines.length > 0) {
    blockC += '\u3010\u5C01\u81E3\u5173\u7CFB\u3011\n' + _vassalLines.join('\n') + '\n';
  }
  // 头衔持有
  var _titleLines = [];
  (GM.chars || []).filter(function(c) { return c.alive !== false && c.titles && c.titles.length > 0; }).forEach(function(c) {
    c.titles.forEach(function(t) { _titleLines.push('  ' + c.name + ' \u6301\u6709:' + (t.titleName || t.name || t) + (t.hereditary ? '(\u4E16\u88AD)' : '')); });
  });
  if (_titleLines.length > 0) {
    blockC += '\u3010\u5934\u8854\u7235\u4F4D\u3011\n' + _titleLines.join('\n') + '\n';
  }
  if (GM.parties && GM.parties.length > 0) {
    blockC += '\u3010\u515A\u6D3E(' + GM.parties.length + '\u4E2A)\u3011\n';
    GM.parties.forEach(function(p) {
      var line = '  ' + p.name + ' \u5F71\u54CD' + (p.influence || 0);
      if (p.status) line += ' \u72B6\u6001:' + p.status;
      if (p.leader) line += ' \u9996\u9886:' + p.leader;
      if (p.ideology) line += ' \u7ACB\u573A:' + p.ideology;
      if (p.rivalParty) line += ' \u5BBF\u654C:' + p.rivalParty;
      if (p.currentAgenda) line += ' \u8BAE\u7A0B:' + p.currentAgenda;
      if (p.shortGoal) line += ' \u77ED\u671F\u76EE\u6807:' + p.shortGoal;
      if (p.longGoal) line += ' \u957F\u671F\u8FFD\u6C42:' + p.longGoal;
      if (p.policyStance) line += ' \u653F\u7B56:' + (Array.isArray(p.policyStance) ? p.policyStance.join('/') : p.policyStance);
      if (p.members) line += ' \u6210\u5458:' + p.members;
      if (p.base) line += ' \u57FA\u76D8:' + p.base;
      if (p.org) line += ' \u7EC4\u7EC7\u5EA6:' + p.org;
      if (p.description) line += ' ' + String(p.description);
      // 党派深化字段
      if (p.cohesion != null) line += ' 凝' + p.cohesion;
      if (p.memberCount) line += ' 党徒~' + p.memberCount;
      if (p.crossFaction) line += ' [跨势力]';
      if (p.splinterFrom) line += ' 分裂自:' + p.splinterFrom;
      if (Array.isArray(p.socialBase) && p.socialBase.length > 0) {
        line += ' 社会基础:' + p.socialBase.map(function(sb){return sb.class+'('+Math.round((sb.affinity||0)*10)/10+')';}).join('/');
      }
      if (Array.isArray(p.focal_disputes) && p.focal_disputes.length > 0) {
        line += ' 焦点:' + p.focal_disputes.slice(0,2).map(function(d){return d.topic+(d.rival?'↔'+d.rival:'');}).join('；');
      }
      if (Array.isArray(p.agenda_history) && p.agenda_history.length > 0) {
        var _recAH = p.agenda_history.slice(-2);
        line += ' 议程史:' + _recAH.map(function(a){return 'T'+a.turn+':'+(a.agenda||'');}).join('→');
      }
      if (Array.isArray(p.officePositions) && p.officePositions.length > 0) line += ' 掌控:[' + p.officePositions.slice(0,5).join(',') + ']';
      blockC += line + '\n';
    });
  }
  if (GM.classes && GM.classes.length > 0) {
    blockC += '\u3010\u9636\u5C42(' + GM.classes.length + '\u4E2A)\u3011\n';
    GM.classes.forEach(function(cl) {
      var line = '  ' + cl.name + ' \u6EE1\u610F' + (cl.satisfaction || 50) + ' \u5F71\u54CD' + (cl.influence || 0);
      if (cl.size) line += ' \u89C4\u6A21:' + cl.size;
      if (cl.economicRole) line += ' \u89D2\u8272:' + cl.economicRole;
      if (cl.status) line += ' \u5730\u4F4D:' + cl.status;
      if (cl.mobility) line += ' \u6D41\u52A8:' + cl.mobility;
      if (cl.privileges) line += ' \u7279\u6743:' + cl.privileges;
      if (cl.obligations) line += ' \u4E49\u52A1:' + cl.obligations;
      if (cl.demands) line += ' \u8BC9\u6C42:' + cl.demands;
      if (cl.unrestThreshold) line += ' \u4E0D\u6EE1\u9608\u503C:' + cl.unrestThreshold;
      if (cl.description) line += ' ' + String(cl.description);
      // 阶层深化字段
      if (Array.isArray(cl.representativeNpcs) && cl.representativeNpcs.length > 0) line += ' 代表:[' + cl.representativeNpcs.slice(0,3).join(',') + ']';
      if (Array.isArray(cl.leaders) && cl.leaders.length > 0) line += ' 领袖:[' + cl.leaders.slice(0,3).join(',') + ']';
      if (Array.isArray(cl.supportingParties) && cl.supportingParties.length > 0) line += ' 支持党派:[' + cl.supportingParties.join(',') + ']';
      if (Array.isArray(cl.internalFaction) && cl.internalFaction.length > 0) {
        line += ' 内部分化:' + cl.internalFaction.map(function(ifc){return ifc.name+(ifc.stance?'('+ifc.stance+')':'');}).join('/');
      }
      if (Array.isArray(cl.regionalVariants) && cl.regionalVariants.length > 0) {
        line += ' 地域:' + cl.regionalVariants.map(function(rv){return rv.region+':满'+(rv.satisfaction||'?');}).join('/');
      }
      if (cl.unrestLevels) {
        var _lvAlerts = [];
        if (cl.unrestLevels.grievance != null && cl.unrestLevels.grievance < 30) _lvAlerts.push('抱怨危');
        if (cl.unrestLevels.petition != null && cl.unrestLevels.petition < 30) _lvAlerts.push('请愿在即');
        if (cl.unrestLevels.strike != null && cl.unrestLevels.strike < 30) _lvAlerts.push('罢市');
        if (cl.unrestLevels.revolt != null && cl.unrestLevels.revolt < 20) _lvAlerts.push('⚠起义临界');
        if (_lvAlerts.length) line += ' ⚠分级不满:' + _lvAlerts.join(',');
      }
      if (cl.economicIndicators) {
        line += ' 富' + (cl.economicIndicators.wealth||50) + '/税' + (cl.economicIndicators.taxBurden||50) + '/田' + (cl.economicIndicators.landHolding||30);
      }
      blockC += line + '\n';
    });
    blockC += '  ※ 阶层 unrestLevels.revolt<10 触发 class_revolt 起义；推演须考虑阶层立场影响诏令执行与NPC行为\n';
  }

  // 3.2: 势力内部核心角色注入
  if (GM.facs && GM.chars) {
    GM.facs.forEach(function(f) {
      if (f.isPlayer) return; // 玩家势力角色已在blockB中详述
      var members = GM.chars.filter(function(c) { return c.alive !== false && c.faction === f.name; });
      if (members.length > 0) {
        blockC += '  ' + f.name + '\u6838\u5FC3\u4EBA\u7269\uFF1A';
        blockC += members.map(function(m) {
          return m.name + '(' + (m.title || '') + ' \u5FE0' + (m.loyalty || 50) + ' \u91CE' + (m.ambition || 50) + ')';
        }).join('\u3001');
        if (members.length > 5) blockC += '\u7B49' + members.length + '\u4EBA';
        blockC += '\n';
      }
    });
  }

  // 势力内部暗流（含历史趋势演变）
  if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) {
    blockC += '\n【各势力内部动态】\n';
    GM._factionUndercurrents.forEach(function(fu) {
      // 查找此势力前几轮的暗流趋势
      var trendHistory = '';
      if (GM._factionUndercurrentsHistory && GM._factionUndercurrentsHistory.length > 0) {
        var pastTrends = [];
        GM._factionUndercurrentsHistory.forEach(function(h) {
          var past = h.data.find(function(d) { return d.faction === fu.faction; });
          if (past) pastTrends.push('T' + h.turn + ':' + past.trend);
        });
        if (pastTrends.length > 0) trendHistory = ' 历史:' + pastTrends.join('→') + '→当前:' + (fu.trend||'');
      }
      blockC += '  ' + fu.faction + '：' + fu.situation + ' 趋势:' + (fu.trend||'') + trendHistory + (fu.nextMove ? ' 可能行动:' + fu.nextMove : '') + '\n';
    });
  }
  if (GM.activeSchemes && GM.activeSchemes.length > 0) {
    blockC += '\n【正在酝酿的阴谋（跨回合持续，AI应推进或让其爆发/失败）】\n';
    GM.activeSchemes.forEach(function(sc2) {
      blockC += '  ' + sc2.schemer + (sc2.target ? '→' + sc2.target : '') + '：' + sc2.plan + ' [' + sc2.progress + '，始于T' + sc2.startTurn + ']\n';
    });
  }

  // 近期势力事件摘要（让AI看到势力最近做了什么，保持叙事连续性）
  if (GM.factionEvents && GM.factionEvents.length > 0) {
    var recentFE = GM.factionEvents.filter(function(e) { return e.turn >= GM.turn - 3; });
    if (recentFE.length > 0) {
      blockC += '\n【近3回合势力大事记——叙事应延续这些事件的后果】\n';
      recentFE.slice(-12).forEach(function(e) {
        blockC += '  T' + e.turn + ' ' + e.actor + (e.target ? '\u2192' + e.target : '') + '\uFF1A' + (e.action || '') + (e.result ? '(' + e.result + ')' : '') + '\n';
      });
    }
  }

  // 3.3: 势力发展叙事注入
  if (GM._factionNarrative && typeof GM._factionNarrative === 'object') {
    var _fnKeys = Object.keys(GM._factionNarrative);
    if (_fnKeys.length > 0) {
      blockC += '\n\u3010\u52BF\u529B\u53D1\u5C55\u53D9\u4E8B\uFF08\u4E0A\u56DE\u5408AI\u603B\u7ED3\uFF09\u3011\n';
      _fnKeys.forEach(function(k) { blockC += '  ' + k + '\uFF1A' + GM._factionNarrative[k] + '\n'; });
    }
  }

  // 势力关系多维矩阵（含累积历史账本）
  if (GM.factionRelationsMap && Object.keys(GM.factionRelationsMap).length > 0) {
    var _mats = [];
    Object.keys(GM.factionRelationsMap).forEach(function(a) {
      Object.keys(GM.factionRelationsMap[a]).forEach(function(b) {
        if (typeof summarizeFactionRelation === 'function') {
          var s = summarizeFactionRelation(a, b);
          if (s) _mats.push('  '+s);
        }
      });
    });
    if (_mats.length > 0) {
      blockC += '\n【势力多维关系矩阵——推演必须尊重历史账本】\n';
      blockC += _mats.slice(0, 30).join('\n') + '\n';
    }
  }

  // 势力实力趋势（从历史快照提取，让AI看到"由盛转衰"或"稳步上升"）
  if (GM._factionHistory && GM._factionHistory.length >= 3) {
    blockC += '\n【势力实力趋势（近' + GM._factionHistory.length + '回合）——推演时必须延续趋势或给出转折理由】\n';
    GM.facs.forEach(function(f) {
      var history = GM._factionHistory.map(function(h) { return h.factions[f.name] ? h.factions[f.name].strength : null; }).filter(function(v) { return v !== null; });
      if (history.length < 3) return;
      var first = history[0], last = history[history.length - 1];
      var delta = last - first;
      var trend = delta > 8 ? '持续上升' : delta > 3 ? '缓慢上升' : delta < -8 ? '急剧衰落' : delta < -3 ? '缓慢衰落' : '基本稳定';
      var sparkline = history.map(function(v) { return Math.round(v); }).join('→');
      blockC += '  ' + f.name + ': ' + sparkline + ' (' + trend + ')\n';
    });
  }

  // 2.1: 活跃剧情线注入
  if (GM._plotThreads && GM._plotThreads.length > 0) {
    var _activeThreads = GM._plotThreads.filter(function(t) { return t.status !== 'resolved'; });
    if (_activeThreads.length > 0) {
      var _stallThresh = (typeof turnsForDuration === 'function') ? turnsForDuration('3months') : 3;
      blockC += '\n\u3010\u6D3B\u8DC3\u5267\u60C5\u7EBF\u2014\u2014\u5FC5\u987B\u63A8\u8FDB\u6BCF\u4E00\u6761\u6216\u89E3\u91CA\u641E\u7F6E\u539F\u56E0\u3011\n';
      _activeThreads.forEach(function(t) {
        var age = GM.turn - (t.lastUpdateTurn || t.startTurn);
        var stalled = age >= _stallThresh;
        var icon = t.status === 'climax' ? '\u2605' : stalled ? '\u26A0\uFE0F' : '\u25CF';
        blockC += icon + ' [' + (t.threadType || '?') + '\u00B7P' + (t.priority || 3) + '] ' + t.title;
        blockC += '\uFF08T' + t.startTurn + '\u8D77\uFF0C\u4E0A\u6B21\u66F4\u65B0T' + (t.lastUpdateTurn || t.startTurn);
        if (stalled) blockC += ' \u2014\u5DF2' + age + '\u56DE\u5408\u672A\u66F4\u65B0\uFF01';
        blockC += '\uFF09';
        if (t.updates && t.updates.length > 0) {
          blockC += '\uFF1A' + t.updates[t.updates.length - 1].text;
        }
        blockC += '\n';
      });
    }
  }

  // N1: 到期的决策延时后果注入
  if (GM._decisionEchoes && GM._decisionEchoes.length > 0) {
    var _dueEchoes = GM._decisionEchoes.filter(function(e) { return !e.applied && e.echoTurn <= GM.turn; });
    if (_dueEchoes.length > 0) {
      blockC += '\n\u3010\u5386\u53F2\u51B3\u7B56\u7684\u5EF6\u65F6\u540E\u679C\u2014\u2014\u672C\u56DE\u5408\u5FC5\u987B\u5728\u53D9\u4E8B\u4E2D\u4F53\u73B0\u3011\n';
      _dueEchoes.forEach(function(e) {
        blockC += '  T' + e.turn + '\u7684\u51B3\u7B56\u201C' + e.content + '\u201D\u2192' + e.echoDesc + ' [' + e.echoType + ']\n';
      });
    }
  }

  // 块D: 世界设定+时代状态（完整）
  var blockD = '';
  if (P.worldSettings) {
    blockD += '【世界设定——完整文本】\n';
    var wsLabels = {culture:'文化风俗',weather:'气候天象',religion:'宗教信仰',economy:'经济形态',technology:'技术水平',diplomacy:'外交格局'};
    ['culture','weather','religion','economy','technology','diplomacy'].forEach(function(k) {
      if (P.worldSettings[k]) blockD += '  [' + wsLabels[k] + ']\n  ' + P.worldSettings[k] + '\n';
    });
  }
  if (GM.eraState) {
    blockD += '【时代状态】政治统一' + (GM.eraState.politicalUnity||0.5) + ' 集权' + (GM.eraState.centralControl||0.5) + ' 社会稳定' + (GM.eraState.socialStability||0.5) + ' 经济' + (GM.eraState.economicProsperity||0.5) + ' 文化' + (GM.eraState.culturalVibrancy||0.5) + ' 官僚' + (GM.eraState.bureaucracyStrength||0.5) + ' 军事' + (GM.eraState.militaryProfessionalism||0.5);
    blockD += ' 正统:' + (GM.eraState.legitimacySource||'') + ' 土地:' + (GM.eraState.landSystemType||'') + ' 阶段:' + (GM.eraState.dynastyPhase||'');
    if (GM.eraState.contextDescription) blockD += '\n  背景:' + GM.eraState.contextDescription;
    blockD += '\n';
  }
  if (P.rules && typeof P.rules === 'object' && !Array.isArray(P.rules)) {
    blockD += '【推演规则——完整文本】\n';
    ['base','combat','economy','diplomacy'].forEach(function(k) { if (P.rules[k]) blockD += '  [' + k + '] ' + P.rules[k] + '\n'; });
  }

  // 块E: 官制+行政（完整）
  var blockE = '';
  if (GM.officeTree && GM.officeTree.length > 0) {
    blockE += '【官制体系——完整树】\n';
    (function _gd(nodes, d) { nodes.forEach(function(n) {
      blockE += '  '.repeat(d) + n.name + (n.desc?' - '+n.desc:'');
      if (n.functions && n.functions.length) blockE += ' 职能:[' + n.functions.join(',') + ']';
      blockE += '\n';
      if (n.positions) n.positions.forEach(function(p) {
        var est = p.establishedCount != null ? p.establishedCount : (parseInt(p.headCount,10) || 1);
        var vac = p.vacancyCount != null ? p.vacancyCount : 0;
        var occ = Math.max(0, est - vac);
        var ah = Array.isArray(p.actualHolders) ? p.actualHolders : [];
        var namedHolders = ah.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
        var placeholderCount = ah.filter(function(h){return h && h.generated===false;}).length;
        blockE += '  '.repeat(d+1) + '官:' + p.name + (p.rank?'('+p.rank+')':'');
        blockE += ' 编'+est+(vac?'·缺'+vac:'')+'·在'+occ;
        if (namedHolders.length > 0) blockE += ' 已知任职:'+namedHolders.join('/');
        if (placeholderCount > 0) blockE += ' ⚐'+placeholderCount+'位在职未具名(需时可 office_spawn 实体化)';
        if (p.succession) blockE += ' ['+p.succession+']';
        if (p.historicalRecord) blockE += ' 据:'+p.historicalRecord;
        if (p.duties) blockE += ' 职责:'+p.duties.slice(0,60);
        blockE += '\n';
      });
      if (n.subs) _gd(n.subs, d+1);
    }); })(GM.officeTree, 1);
  }
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(k) {
      var ah = P.adminHierarchy[k];
      if (!ah || !ah.divisions || ah.divisions.length === 0) return;
      blockE += '【行政区划——完整树】\n';
      (function _ad(divs, d) { divs.forEach(function(dv) {
        blockE += '  '.repeat(d) + dv.name + (dv.level?'('+dv.level+')':'') + (dv.governor?' 官:'+dv.governor:'') + (dv.population?' 人口'+dv.population:'') + (dv.prosperity?' 繁荣'+dv.prosperity:'') + (dv.terrain?' '+dv.terrain:'') + (dv.specialResources?' 产:'+dv.specialResources:'') + '\n';
        if (dv.children) _ad(dv.children, d+1);
      }); })(ah.divisions, 1);
    });
  }

  // 块F: 军事+变量+经济
  var blockF = '';
  if (GM.armies && GM.armies.length > 0) {
    blockF += '【军事力量(' + GM.armies.length + '支)——完整数据】\n';
    GM.armies.forEach(function(a) {
      var _aLine = '  ' + a.name + ' \u5175' + (a.soldiers||0) + ' \u58EB\u6C14' + (a.morale||50) + ' \u8BAD\u7EC3' + (a.training||50);
      if (a.commander) _aLine += ' \u5E05:' + a.commander;
      if (a.faction) _aLine += ' \u5C5E:' + a.faction;
      if (a.garrison) _aLine += ' \u9A7B:' + a.garrison;
      if (a.armyType) _aLine += ' \u578B:' + a.armyType;
      if (a.quality) _aLine += ' \u8D28:' + a.quality;
      if (a.loyalty) _aLine += ' \u5FE0:' + a.loyalty;
      if (a.equipmentCondition) _aLine += ' \u88C5\u5907:' + a.equipmentCondition;
      if (a.activity) _aLine += ' \u72B6\u6001:' + a.activity;
      if (a.composition && a.composition.length) _aLine += ' \u7F16\u5236:' + a.composition.map(function(c){return c.type+(c.count?'*'+c.count:'');}).join('/');
      blockF += _aLine + '\n';
    });
  }
  if (GM.vars && Object.keys(GM.vars).length > 0) {
    blockF += '【资源变量——完整】\n';
    Object.entries(GM.vars).forEach(function(e) { blockF += '  ' + e[0] + '=' + e[1].value + (e[1].unit||'') + ' [' + (e[1].min||0) + '~' + (e[1].max||'?') + ']' + (e[1].calcMethod?' 算法:'+e[1].calcMethod:'') + (e[1].description?' '+e[1].description:'') + '\n'; });
  }
  if (P.economyConfig && P.economyConfig.enabled) {
    blockF += '【经济配置】货币:' + (P.economyConfig.currency||'') + ' 基收:' + (P.economyConfig.baseIncome||0) + ' 税率:' + (P.economyConfig.taxRate||0) + ' 通胀:' + (P.economyConfig.inflationRate||0) + ' 贸易:' + (P.economyConfig.tradeBonus||0) + '\n';
  }

  // 块G: 事件+时间线+目标
  var blockG = '';
  if (GM.events && GM.events.length > 0) {
    blockG += '【全部事件(' + GM.events.length + '个)——完整】\n';
    GM.events.forEach(function(e) { blockG += '  [' + (e.type||'') + (e.importance?' '+e.importance:'') + '] ' + e.name + (e.trigger?' 条件:'+e.trigger:'') + (e.effect?' 效果:'+e.effect:'') + (e.description?' '+e.description:'') + (e.chainNext?' →链:'+e.chainNext:'') + '\n'; });
  }
  if (P.timeline) {
    var tl = [].concat(P.timeline.past||[]).concat(P.timeline.future||[]);
    if (tl.length > 0) {
      blockG += '【时间线(' + tl.length + '项)】\n';
      tl.forEach(function(t) { blockG += '  ' + (t.year||'') + ' ' + (t.name||t.event||'') + (t.type==='future'?' [未来]':'') + (t.description?' '+t.description:'') + '\n'; });
    }
  }
  if (P.goals && P.goals.length > 0) {
    blockG += '【目标条件(' + P.goals.length + '个)】\n';
    P.goals.forEach(function(g) { blockG += '  [' + (g.type||'') + '] ' + g.name + (g.description?' '+g.description:'') + '\n'; });
  }

  // 编年纪事（全部未完结叙事线索，含伏笔标记）
  if (GM.biannianItems && GM.biannianItems.length > 0) {
    var _activeBN = GM.biannianItems.filter(function(b) { return !b._resolved; });
    if (_activeBN.length > 0) {
      blockG += '\u3010\u7F16\u5E74\u7EAA\u4E8B\u2014\u2014\u5168\u90E8\u8FDB\u884C\u4E2D\u7684\u53D9\u4E8B\u7EBF(' + _activeBN.length + '\u6761)\u3011\n';
      _activeBN.forEach(function(b) {
        blockG += '  ' + (b.name || b.title || '') + (b._isForeshadow ? '(\u4F0F\u7B14)' : '') + ' T' + (b.turn || b.startTurn || '?') + (b.content ? ' ' + String(b.content) : '') + '\n';
      });
    }
  }
  // 纪事本末（全部奏疏批复记录——反映玩家决策轨迹）
  if (GM.jishiRecords && GM.jishiRecords.length > 0) {
    blockG += '\u3010\u594F\u758F\u6279\u590D\u8BB0\u5F55(' + GM.jishiRecords.length + '\u6761)\u3011\n';
    GM.jishiRecords.forEach(function(j) {
      blockG += '  T' + (j.turn || '?') + ' ' + (j.from || j.char || '') + ': ' + String(j.title || j.content || j.playerSaid || '') + (j.reply ? ' \u2192\u6731\u6279:' + String(j.reply) : (j.npcSaid ? ' ' + String(j.npcSaid) : '')) + '\n';
    });
  }
  // 预设历史事件提示（让AI知道即将到来的剧本事件）
  if (P.rigidHistoryEvents && P.rigidHistoryEvents.length > 0) {
    var _untriggered = P.rigidHistoryEvents.filter(function(e) { return !GM.triggeredHistoryEvents || !GM.triggeredHistoryEvents[e.id]; });
    if (_untriggered.length > 0) {
      blockG += '\u3010\u5386\u53F2\u8FDB\u7A0B\u63D0\u793A\u3011\u5269\u4F59' + _untriggered.length + '\u4E2A\u9884\u8BBE\u4E8B\u4EF6\u5F85\u89E6\u53D1\uFF08AI\u5E94\u5728\u53D9\u4E8B\u4E2D\u4E3A\u5176\u94FA\u57AB\uFF09\n';
      _untriggered.forEach(function(e) {
        blockG += '  ' + e.name + (e.trigger && e.trigger.year ? ' \u89E6\u53D1\u5E74:' + e.trigger.year : '') + (e.description ? ' ' + String(e.description) : '') + '\n';
      });
    }
  }

  // ═══ 块H: 缺失的15个数据源——全部补齐 ═══
  var blockH = '';

  // 开场白
  if (sc.opening || sc.openingText) blockH += '【开场白】\n' + (sc.opening || sc.openingText || '') + '\n';

  // 物品
  if (GM.items && GM.items.length > 0) {
    blockH += '【物品(' + GM.items.length + '件)】\n';
    GM.items.forEach(function(it) { blockH += '  ' + it.name + (it.type?' ['+it.type+']':'') + (it.rarity?' '+it.rarity:'') + (it.value?' \u4EF7:'+it.value:'') + (it.owner?' \u6301\u6709:'+it.owner:'') + (it.effect?' \u6548\u679C:'+it.effect:'') + (it.description?' '+it.description:'') + '\n'; });
  }

  // 科技树
  if (GM.techTree && GM.techTree.length > 0) {
    blockH += '【科技树(' + GM.techTree.length + '项)】\n';
    GM.techTree.forEach(function(t) { blockH += '  ' + t.name + (t.era?' ['+t.era+']':'') + (t.unlocked?' ★已研':'') + (t.prereqs&&t.prereqs.length?' 前置:'+t.prereqs.join(','):'') + (t.description?' '+t.description:'') + '\n'; });
  }

  // 民政树
  if (GM.civicTree && GM.civicTree.length > 0) {
    blockH += '【民政树(' + GM.civicTree.length + '项)】\n';
    GM.civicTree.forEach(function(c) { blockH += '  ' + c.name + (c.category?' ['+c.category+']':'') + (c.adopted?' ★已用':'') + (c.description?' '+c.description:'') + '\n'; });
  }


  // 封臣类型
  if (P.vassalSystem && P.vassalSystem.vassalTypes && P.vassalSystem.vassalTypes.length > 0) {
    blockH += '【封臣类型(' + P.vassalSystem.vassalTypes.length + '种)】\n';
    P.vassalSystem.vassalTypes.forEach(function(v) { blockH += '  ' + v.name + (v.rank?' '+v.rank:'') + (v.controlLevel?' '+v.controlLevel:'') + (v.succession?' 继承:'+v.succession:'') + (v.obligations?' 义务:'+v.obligations:'') + (v.rights?' 权利:'+v.rights:'') + '\n'; });
  }

  // 头衔等级
  if (P.titleSystem && P.titleSystem.titleRanks && P.titleSystem.titleRanks.length > 0) {
    blockH += '【头衔体系(' + P.titleSystem.titleRanks.length + '级)】\n';
    P.titleSystem.titleRanks.forEach(function(t) { blockH += '  ' + t.name + ' Lv' + (t.level||0) + (t.category?' '+t.category:'') + (t.succession?' 继承:'+t.succession:'') + (t.privileges?' 特权:'+t.privileges:'') + '\n'; });
  }

  // 建筑类型
  if (P.buildingSystem && P.buildingSystem.buildingTypes && P.buildingSystem.buildingTypes.length > 0) {
    blockH += '【建筑类型(' + P.buildingSystem.buildingTypes.length + '种)——效果由AI根据描述综合判定】\n';
    P.buildingSystem.buildingTypes.forEach(function(b) {
      blockH += '  · ' + b.name + (b.category?' ['+b.category+']':'') + (b.maxLevel?' 最高Lv'+b.maxLevel:'') + (b.baseCost?' 成本'+b.baseCost+'两':'') + (b.buildTime?' 工期'+b.buildTime+'回合':'') + '\n';
      if (b.description) blockH += '    ' + b.description.substring(0,250) + '\n';
    });
    blockH += '  ※ 推演原则：建筑效果(收入/征兵/防御/文化/繁荣等)由AI根据上述描述+所在地形/经济/民心自行综合判定，不存在固定数值表\n';
    // 注入已建成的建筑状态（territory.buildings）
    var _builtBuildings = [];
    (P.adminHierarchy && Object.keys(P.adminHierarchy)).forEach && Object.keys(P.adminHierarchy||{}).forEach(function(fk) {
      var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.buildings && d.buildings.length) {
            d.buildings.forEach(function(bd) {
              _builtBuildings.push(d.name + ':' + bd.name + (bd.level?'(Lv'+bd.level+')':'') + (bd.status==='building'?'[建造中'+(bd.remainingTurns||'?')+'回合]':''));
            });
          }
          if (d.children) _walk(d.children);
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
    if (_builtBuildings.length > 0) blockH += '  【已建成/在建】' + _builtBuildings.slice(0,30).join('；') + '\n';
  }

  // 皇城宫殿系统
  if (P.palaceSystem && P.palaceSystem.enabled && P.palaceSystem.palaces && P.palaceSystem.palaces.length > 0) {
    blockH += '【皇城·' + (P.palaceSystem.capitalName || '皇城') + '(' + P.palaceSystem.palaces.length + '处宫殿)】\n';
    if (P.palaceSystem.capitalDescription) blockH += '  ' + P.palaceSystem.capitalDescription.substring(0, 200) + '\n';
    // 按type分组简述
    var _palGroups = {};
    P.palaceSystem.palaces.forEach(function(p) { (_palGroups[p.type] = _palGroups[p.type] || []).push(p); });
    var _palTypeLabels = { main_hall:'外朝主殿', imperial_residence:'帝居', consort_residence:'后妃居所', dowager:'太后宫', crown_prince:'太子宫', ceremonial:'礼制', garden:'园林', office:'内廷', offering:'祭祀' };
    Object.keys(_palGroups).forEach(function(t) {
      blockH += '  〔' + (_palTypeLabels[t] || t) + '〕';
      _palGroups[t].forEach(function(p) {
        blockH += p.name + (p.status && p.status !== 'intact' ? '(' + p.status + ')' : '') + '；';
      });
      blockH += '\n';
    });
    // 妃嫔居所分配——叙事中须用具体宫殿名
    blockH += '  【居所分配——叙事中须准确使用宫殿名】\n';
    P.palaceSystem.palaces.forEach(function(p) {
      if (!p.subHalls) return;
      p.subHalls.forEach(function(sh) {
        if (sh.occupants && sh.occupants.length) {
          blockH += '    ' + p.name + '·' + sh.name + '(' + sh.role + ')：' + sh.occupants.join('、') + '\n';
        }
      });
    });
    blockH += '  ※ 推演原则：后宫叙事须使用具体宫殿与殿名(如"帝幸储秀宫正殿"而非笼统"后宫")；修建/修缮/移居由AI通过palace_changes返回\n';
  }

  // 文事作品——注入最近传世之作（防膨胀：最多 20 条）
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _recentWorks = GM.culturalWorks.filter(function(w) {
      return w.isPreserved || (GM.turn - (w.turn || 0) <= 10) || (w.quality || 0) >= 85;
    }).slice(-20);
    if (_recentWorks.length > 0) {
      blockH += '【文事作品(已有 ' + GM.culturalWorks.length + ' 篇，近期节选 ' + _recentWorks.length + ')】\n';
      _recentWorks.forEach(function(w) {
        blockH += '  · [' + (w.genre || '') + '] ' + (w.author || '?') + '《' + (w.title || '?') + '》';
        if (w.trigger) blockH += ' ('+ w.trigger +')';
        if (w.politicalImplication) blockH += ' ⚠' + w.politicalImplication.substring(0, 40);
        if (w.quality) blockH += ' 品'+w.quality;
        blockH += '\n';
      });
      blockH += '  ※ 推演原则：新作与旧作之间可次韵酬答；叙事可引用旧作意象；讽谕作品余波未平\n';
    }
  }

  // 岗位规则
  if (P.postSystem && P.postSystem.postRules && P.postSystem.postRules.length > 0) {
    blockH += '【岗位规则(' + P.postSystem.postRules.length + '条)】\n';
    P.postSystem.postRules.forEach(function(r) { blockH += '  ' + (r.positionName||r.name||'') + ' 继任:' + (r.succession||'') + (r.hasAppointmentRight?' [有辟署权]':'') + (r.description?' '+r.description:'') + '\n'; });
  }

  // 科举
  if (P.keju && P.keju.enabled) {
    blockH += '【科举制度】' + (P.keju.examIntervalNote||'已启用') + (P.keju.examSubjects?' 科目:'+P.keju.examSubjects:'') + (P.keju.quotaPerExam?' 取士:'+P.keju.quotaPerExam:'') + (P.keju.specialRules?' 规则:'+P.keju.specialRules:'') + '\n';
    if (P.keju.examNote) blockH += '  ' + P.keju.examNote + '\n';
  }

  // 后宫
  if (GM.harem) {
    blockH += '【后宫制度】继承:' + (GM.harem.succession||'eldest_legitimate');
    if (GM.harem.haremDescription) blockH += ' ' + GM.harem.haremDescription;
    if (GM.harem.motherClanSystem) blockH += ' 外戚:' + GM.harem.motherClanSystem;
    blockH += '\n';
    if (GM.harem.rankSystem && GM.harem.rankSystem.length > 0) {
      blockH += '  位份:' + GM.harem.rankSystem.map(function(r){return r.name+'(Lv'+r.level+')';}).join('→') + '\n';
    }
    var _spouses = (GM.chars||[]).filter(function(c){return c.alive!==false&&c.spouse;});
    if (_spouses.length > 0) {
      blockH += '  妃嫔:' + _spouses.map(function(s){return s.name+(s.spouseRank?'('+s.spouseRank+')':'');}).join('、') + '\n';
    }
  }

  // 地方区划
  if (GM.provinceStats && Object.keys(GM.provinceStats).length > 0) {
    blockH += '【地方区划(' + Object.keys(GM.provinceStats).length + '个)】\n';
    Object.entries(GM.provinceStats).forEach(function(e) {
      var ps = e[1];
      blockH += '  ' + e[0] + ' 人口' + (ps.population||0) + ' 财' + (ps.wealth||0) + ' 稳' + (ps.stability||0) + ' 税' + (ps.taxRevenue||0) + (ps.governor?' 官:'+ps.governor:'') + (ps.terrain?' '+ps.terrain:'') + '\n';
    });
  }

  // 变量公式（结构化强制指令）
  if (GM._varFormulas && GM._varFormulas.length > 0) {
    var _typeLabels = {income:'收支',constraint:'约束',trigger:'触发',coupling:'联动',ratio:'比例'};
    blockH += '【变量公式·强制执行（' + GM._varFormulas.length + '条）】\n';
    blockH += '⚠ 以下公式是resource_changes的强制计算规则，AI必须严格遵守：\n';
    GM._varFormulas.forEach(function(f) {
      blockH += '  [' + (_typeLabels[f.type]||'规则') + '] ' + f.name + '：' + (f.expression||'') + '\n';
      if (f.chains && f.chains.length > 0) {
        blockH += '    链式影响：' + f.chains.join('；') + '\n';
      }
    });
    blockH += '  规则：\n';
    blockH += '  1. income类公式：每回合resource_changes必须体现收支计算，数值应与公式一致\n';
    blockH += '  2. constraint类：resource_changes不得使变量违反约束（如粮食不可为负）\n';
    blockH += '  3. trigger类：当变量达到阈值时，叙事和事件必须反映触发效果\n';
    blockH += '  4. coupling类：改变一个变量时，关联变量必须同步变化\n';
    blockH += '  5. ratio类：相关变量必须维持公式定义的比例关系\n';
  }

  var sysPre = '你是一个顶级历史模拟AI的记忆核心模块。你即将开始模拟' + (sc.era||sc.dynasty||'一个历史时期') + '。请极其仔细地阅读以下内容，记住每一个角色、每一个势力、每一条规则、每一件物品、每一项制度。你的分析质量将直接决定后续数十回合的叙事深度。不要遗漏任何细节。';

  try {
    // ═══ Call 1/10: 剧本概要+矛盾 ═══
    prog(1, '深度阅读(1/12) 剧本概要与矛盾...');
    var r1 = await _call(sysPre, blockA + '\n\n请返回JSON：{"era_essence":"这个时代的本质特征和核心氛围(150字)","contradiction_analysis":"各矛盾之间的联动关系和演化趋势(150字)","player_dilemma":"玩家面临的核心两难困境(100字)"}', 600);

    // ═══ Call 2/8: 角色深度分析 ═══
    prog(2, '深度阅读(2/8) 全部角色...');
    var r2 = await _call(sysPre, blockB + '\n\n请返回JSON：{"character_web":"角色间的关系网络——忠诚、对立、暗流(200字)","dangerous_figures":"最危险的3个NPC及其可能行动(150字)","loyal_allies":"玩家最可靠的盟友及其弱点(100字)","hidden_agendas":"可能隐藏野心或秘密目标的角色(100字)"}', 800);

    // ═══ Call 3/8: 势力+党派+阶层分析 ═══
    prog(3, '深度阅读(3/8) 势力与党派格局...');
    var r3 = await _call(sysPre, blockC + '\n\n请返回JSON：{"faction_balance":"势力间的力量平衡和战略态势(200字)","alliance_possibilities":"可能形成的联盟和对抗阵营(100字)","party_struggle":"党争的核心焦点和可能走向(100字)","class_tensions":"阶层间的主要矛盾和爆发点(100字)","vassal_risks":"封臣体系中的不稳定因素(80字)"}', 800);

    // ═══ Call 4/8: 世界设定+规则 ═══
    prog(4, '深度阅读(4/10) 世界设定与规则...');
    var r4 = await _call(sysPre, blockD + '\n\n请返回JSON：{"world_atmosphere":"世界的整体氛围和时代精神——从视觉、听觉、情感三个层面描述(250字)","rule_implications":"规则对推演的核心约束——哪些事不能做、哪些事必须做、哪些事有代价(200字)","cultural_dynamics":"文化和宗教对政治的深层影响——信仰冲突、礼制之争、文化认同(200字)","economic_logic":"经济体系的完整运作逻辑——收入来源、支出项目、脆弱点、改革空间(200字)"}', 1200);

    // ═══ Call 5/10: 官制体系深度 ═══
    prog(5, '深度阅读(5/10) 官制体系...');
    var r5 = await _call(sysPre, blockE + '\n\n请返回JSON：{"bureaucratic_state":"官僚体系的运作状态——各部门效率、人员构成、派系分布(200字)","power_network":"权力网络——谁控制什么、谁依附谁、哪些职位是关键节点(200字)","vacant_critical":"最需要填补的关键空缺及最佳人选建议(150字)","succession_risks":"继任风险——哪些关键岗位的现任者可能出问题(100字)","governance_reform":"治理改革空间——哪些制度可以优化、风险是什么(150字)"}', 1200);

    // ═══ Call 6/10: 行政区划深度 ═══
    prog(6, '深度阅读(6/10) 行政区划与地方治理...');
    var r6admin = await _call(sysPre, blockE + '\n\n请返回JSON：{"regional_strengths":"各行政区的经济军事优势——哪里富庶、哪里有兵、哪里产粮(200字)","regional_risks":"各区域的风险——哪里可能叛乱、哪里治理薄弱、哪里边防空虚(200字)","governor_assessment":"各地方官的能力评估——谁称职、谁贪腐、谁可能反叛(150字)","territorial_strategy":"领土战略——应优先发展哪里、防守哪里、进攻哪里(150字)"}', 1000);

    // ═══ Call 7/10: 军事+经济深度 ═══
    prog(7, '深度阅读(7/10) 军事与经济...');
    var r7mil = await _call(sysPre, blockF + '\n\n请返回JSON：{"military_assessment":"军事力量的完整评估——各军实力对比、统帅能力、士气状况、装备水平(250字)","economic_outlook":"财政完整状况——收入结构、支出压力、储备情况、经济前景(200字)","war_scenarios":"最可能的战争场景——谁打谁、何时、在哪里、胜算几何(200字)","resource_crises":"资源危机预警——哪些资源即将耗尽、影响什么、如何应对(150字)","military_reform":"军事改革方向——当前军制的缺陷和改进空间(100字)"}', 1200);

    // ═══ Call 8/10: 事件+时间线深度 ═══
    prog(8, '深度阅读(8/10) 事件与时间线...');
    var r8evt = await _call(sysPre, blockG + '\n\n请返回JSON：{"event_priorities":"最应优先触发的事件及详细时机和触发方式(200字)","timeline_foreshadow":"时间线中需要提前铺垫的未来事件——具体铺垫方式(200字)","goal_strategy":"实现各目标的详细策略路径——步骤和风险(200字)","narrative_arcs":"最有戏剧张力的5条叙事弧线——起承转合设计(200字)","chain_reactions":"事件间的连锁反应链——A发生→B必然→C可能(150字)"}', 1200);

    // ═══ Call 9/10: 角色个体深度分析 ═══
    prog(9, '深度阅读(9/10) 角色个体深度分析...');
    var topChars = (GM.chars||[]).filter(function(c){return c.alive!==false;}).sort(function(a,b){
      var sa = (a.isPlayer?100:0) + Math.abs(50-(a.loyalty||50)) + (a.ambition||50);
      var sb = (b.isPlayer?100:0) + Math.abs(50-(b.loyalty||50)) + (b.ambition||50);
      return sb - sa;
    });
    var charDeepBlock = '请逐个分析以下关键角色的内心世界和行为预测：\n';
    topChars.forEach(function(c) {
      charDeepBlock += '\n' + c.name + (c.title?'('+c.title+')':'') + ' 忠' + (c.loyalty||50) + ' 野' + (c.ambition||50) + ' 智' + (c.intelligence||50);
      if (c.personality) charDeepBlock += ' 性格:' + c.personality;
      if (c.personalGoal) charDeepBlock += ' 目标:' + c.personalGoal;
      if (c.bio) charDeepBlock += ' 经历:' + c.bio;
      if (c.faction) charDeepBlock += ' 势力:' + c.faction;
      if (c.party) charDeepBlock += ' 党派:' + c.party;
      if (c.spouse) charDeepBlock += ' [有配偶]';
    });
    var r9 = await _call(sysPre, charDeepBlock + '\n\n请返回JSON：{"character_profiles":"每个角色的内心独白——他们真正想要什么、害怕什么、会为什么铤而走险(300字)","relationship_tensions":"角色间最紧张的5对关系及爆发条件(200字)","betrayal_risks":"最可能背叛的角色及其动机和时机(150字)","alliance_opportunities":"最可能结盟的角色组合及其共同利益(150字)","emotional_triggers":"各角色的情感触发点——什么事件会让他们暴怒/崩溃/感动(200字)"}', 1500);

    // ═══ Call 11/12: 制度+物品+科技+外交（新增数据源） ═══
    prog(11, '深度阅读(11/12) 制度·物品·科技·外交...');
    var blockH1 = blockH.substring(0, Math.min(blockH.length, 6000)); // 前半
    var r11 = await _call(sysPre, blockH1 + '\n\n请返回JSON：{"tech_strategy":"科技发展路线和优先研究方向(150字)","item_significance":"关键物品的政治象征意义和使用策略(100字)","diplomatic_landscape":"与外部势力的完整外交格局和最佳策略(200字)","vassal_title_dynamics":"封臣体系和爵位制度对权力的影响(150字)","succession_politics":"继承制度和后宫政治对国运的影响(150字)"}', 1200);

    // ═══ Call 12/12: 经济·省份·建筑·完整世界理解 ═══
    prog(12, '深度阅读(12/12) 经济·省份·建筑...');
    var blockH2 = blockH.substring(Math.min(blockH.length, 6000)); // 后半（如果有）
    if (!blockH2) blockH2 = '以上数据已在前一轮提供。';
    var r12 = await _call(sysPre, blockH2 + '\n补充数据：\n' + blockF.substring(0, 3000) + '\n\n请返回JSON：{"province_assessment":"各省份的经济健康度和发展潜力(200字)","building_priorities":"最应优先建设的建筑及理由(100字)","reform_agenda":"前10回合的治国改革议程(200字)","risk_matrix":"政治/经济/军事/社会四维度的风险矩阵(200字)","opening_narrative":"开局第一回合最佳的叙事开场方式(150字)"}', 1200);

    // ═══ Call 13/12: 终极综合大摘要 ═══
    prog(13, '深度阅读 生成终极综合分析...');
    var allAnalysis = JSON.stringify(r1) + '\n' + JSON.stringify(r2) + '\n' + JSON.stringify(r3) + '\n' + JSON.stringify(r4) + '\n' + JSON.stringify(r5) + '\n' + JSON.stringify(r6admin) + '\n' + JSON.stringify(r7mil) + '\n' + JSON.stringify(r8evt) + '\n' + JSON.stringify(r9) + '\n' + JSON.stringify(r11) + '\n' + JSON.stringify(r12);
    var r10 = await _call(
      '你是历史模拟AI的总设计师。基于前9轮的极其详尽的深度分析，生成一份终极剧本理解文档。这份文档将永久注入你的记忆核心，指导后续数十回合的每一个推演决策。请确保涵盖所有关键维度，不遗漏任何重要信息。',
      allAnalysis + '\n\n请返回JSON：{"master_digest":"剧本终极摘要——这是你对整个世界的终极理解，必须涵盖：时代本质、核心矛盾、关键人物关系网、势力均衡、制度特点、经济军事状况、文化宗教背景、治理风险、战争风险。不要吝惜字数，写得越详细越好(1500-2000字)","first_turn_plan":"第一回合的完整推演计划——应发生的所有事件、每个NPC的具体行动、矛盾如何体现、氛围如何营造、叙事的起承转合(600字)","npc_behaviors":"前5回合各主要NPC的详细行为时间线——逐人逐回合(600字)","crisis_forecast":"即将爆发的5个危机——触发条件、爆发时间、影响范围、应对方案、玩家可利用的机会(500字)","narrative_style":"本剧本最适合的叙事风格——文学基调、用典方向、情感色彩、节奏把控、参考的文学作品(300字)","world_rules":"这个世界的底层运行规则——什么行为会被奖励、什么会被惩罚、什么是不可逆的、哪些是隐藏规则(400字)"}',
      2000
    );
    var r8 = r10; // 兼容旧变量名

    // ════════════════════════════════════════════
    // 第二层：交叉质询（AI自问自答，发现遗漏和矛盾）
    // ════════════════════════════════════════════
    var sysQuestioner = '你是一个极其严苛的历史学家和剧本审查官。你的任务是质疑前面的分析，找出遗漏、矛盾和不合理之处。不要客气，尽管挑刺。';
    var masterText = r10.master_digest || '';

    // ═══ Q1: 人物关系质询 ═══
    prog(14, '交叉质询(1/4) 审查人物关系...');
    var rQ1 = await _call(sysQuestioner,
      '前面的分析认为：\n角色关系网：' + (r2.character_web||'') + '\n危险人物：' + (r2.dangerous_figures||'') + '\n角色内心：' + (r9.character_profiles||'') + '\n背叛风险：' + (r9.betrayal_risks||'') + '\n\n原始角色数据：\n' + blockB.substring(0, 4000) +
      '\n\n请严格审查并返回JSON：{"missed_relationships":"被遗漏的重要人物关系——检查每对有关联的角色(200字)","logic_flaws":"分析中的逻辑矛盾——哪些判断不合理(150字)","deeper_motives":"被忽视的深层动机——哪些角色的真实目的被低估(200字)","wildcard_characters":"被忽视的变数人物——哪些看似不重要的角色可能有大作为(150字)"}', 1000);

    // ═══ Q2: 势力战略质询 ═══
    prog(15, '交叉质询(2/4) 审查势力战略...');
    var rQ2 = await _call(sysQuestioner,
      '前面的分析认为：\n势力态势：' + (r3.faction_balance||'') + '\n战争风险：' + (r7mil.war_scenarios||'') + '\n危机预测：' + (r10.crisis_forecast||'') + '\n\n原始势力数据：\n' + blockC.substring(0, 3000) +
      '\n\n请严格审查并返回JSON：{"strategic_blind_spots":"战略分析的盲点——哪些威胁被低估(200字)","alliance_shifts":"可能的联盟翻转——哪些看似稳固的联盟可能瓦解(150字)","cascade_scenarios":"多米诺效应场景——一个势力覆灭会引发什么连锁(200字)","player_vulnerabilities":"玩家势力的隐藏弱点——从敌人视角看玩家(150字)"}', 1000);

    // ═══ Q3: 制度经济质询 ═══
    prog(16, '交叉质询(3/4) 审查制度经济...');
    var rQ3 = await _call(sysQuestioner,
      '前面的分析认为：\n经济状况：' + (r7mil.economic_outlook||'') + '\n官僚状态：' + (r5.bureaucratic_state||'') + '\n治理改革：' + (r5.governance_reform||'') + '\n风险矩阵：' + (r12.risk_matrix||'') + '\n\n原始数据：\n' + blockD.substring(0, 2000) + '\n' + blockF.substring(0, 2000) +
      '\n\n请严格审查并返回JSON：{"economic_time_bombs":"被忽视的经济定时炸弹(150字)","institutional_decay":"制度衰败的隐性信号(150字)","reform_paradoxes":"改革的悖论——为什么改也错不改也错(200字)","social_undercurrents":"社会暗流——底层正在发生什么(150字)"}', 1000);

    // ═══ Q4: 叙事逻辑质询 ═══
    prog(17, '交叉质询(4/4) 审查叙事逻辑...');
    var rQ4 = await _call(sysQuestioner,
      '终极摘要：' + masterText + '\n叙事弧线：' + (r8evt.narrative_arcs||'') + '\n连锁反应：' + (r8evt.chain_reactions||'') + '\n推演计划：' + (r10.first_turn_plan||'') +
      '\n\n请严格审查并返回JSON：{"narrative_gaps":"叙事中的逻辑断裂——哪些因果链不成立(200字)","tone_conflicts":"基调矛盾——哪些场景的情感处理可能冲突(150字)","pacing_advice":"节奏建议——前5回合的叙事节奏应该怎样起伏(200字)","dramatic_irony":"戏剧反讽机会——玩家不知道但AI知道的秘密(200字)"}', 1000);

    // ════════════════════════════════════════════
    // 第三层：史料研究（让AI回忆真实历史，建立知识底座）
    // ════════════════════════════════════════════
    var dynasty = sc.era || sc.dynasty || '';
    var year = P.time && P.time.year ? P.time.year : '';
    var sysHistorian = '你是一位学识渊博的' + dynasty + '历史学家，精通该时期的所有正史、野史、笔记小说。请调动你对' + dynasty + '的全部知识。';
    var allQ = JSON.stringify(rQ1) + '\n' + JSON.stringify(rQ2) + '\n' + JSON.stringify(rQ3) + '\n' + JSON.stringify(rQ4);

    // ═══ H1: 史料·政治军事 ═══
    prog(18, '史料研究(1/4) 政治军事史料...');
    var rH1 = await _call(sysHistorian,
      '本剧本设定在' + dynasty + (year ? '(约公元'+year+'年)' : '') + '。\n玩家势力：' + (pi.factionName||'') + '\n当前局势：' + masterText.substring(0, 500) +
      '\n\n请根据你对该时期历史的了解，返回JSON：{"real_political_events":"这一时期真实发生的重大政治事件——按时间顺序列举，包括政变、废立、改制、党争等(300字)","real_military_events":"这一时期的真实军事冲突——战役名称、交战双方、结果、影响(300字)","key_historical_figures":"这一时期最关键的历史人物——他们的真实结局和历史评价(250字)","institutional_reality":"这一时期制度的真实运作状况——正史记载的吏治、财政、军制实况(200字)"}', 1500);

    // ═══ H2: 史料·社会经济 ═══
    prog(19, '史料研究(2/4) 社会经济史料...');
    var rH2 = await _call(sysHistorian,
      '继续研究' + dynasty + '的社会经济状况。\n剧本概述：' + (sc.overview||'').substring(0, 400) +
      '\n\n请返回JSON：{"real_social_conditions":"这一时期的真实社会状况——人口、阶级矛盾、民变、灾荒、疫病、流民(300字)","real_economic_data":"这一时期的真实经济数据——赋税制度、物价、通货、贸易路线、财政收支(250字)","real_cultural_scene":"这一时期的文化思想状况——学术流派、宗教势力、礼制之争、文学艺术(200字)","real_daily_life":"这一时期普通人的日常生活——衣食住行、婚丧嫁娶、市井风俗(200字)"}', 1500);

    // ═══ H3: 史料·人物与典故 ═══
    prog(20, '史料研究(3/4) 人物典故与文学素材...');
    var charNames = (GM.chars||[]).filter(function(c){return c.alive!==false;}).map(function(c){return c.name;}).join('\u3001');
    var rH3 = await _call(sysHistorian,
      '剧本中的关键角色：' + charNames + '\n\n请返回JSON：{"historical_anecdotes":"与这些人物（或同名/同类型历史人物）相关的真实历史典故和逸事——可用于游戏叙事中(300字)","literary_references":"这一时期最适合引用的诗词歌赋、典籍名句——按场景分类：朝堂、战争、宴饮、离别、感慨(250字)","famous_dialogues":"这一时期流传的著名对话或奏疏名句——可在角色对白中化用(200字)","historical_turning_points":"这一时期的历史转折点——哪些关键决策改变了历史走向(200字)"}', 1500);

    // ═══ H4: 史料·细节与氛围 ═══
    prog(21, '史料研究(4/4) 细节氛围素材...');
    var rH4 = await _call(sysHistorian,
      '这个剧本需要营造极其真实的' + dynasty + '氛围。\n\n请返回JSON：{"sensory_details":"这一时期的感官细节——宫殿什么样、街道什么样、战场什么样、朝堂什么气味什么声音(300字)","etiquette_norms":"这一时期的礼仪规范——君臣之间、官场之间、军中的称呼方式、行礼方式、禁忌(250字)","period_vocabulary":"这一时期应该使用的特有词汇和表达方式——官职称谓、日常用语、骂人话、赞美话(200字)","seasonal_customs":"这一时期的节令风俗——四季不同的朝政活动、祭祀、农事、军事行动时机(200字)"}', 1500);

    // ═══ H5: 史料·民俗风情与日常 ═══
    prog(22, '史料研究(5/8) 民俗风情...');
    var rH5 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的民间风俗习惯。\n\n返回JSON：{"folk_customs":"民间婚丧嫁娶、生育、命名、成人礼的完整习俗(300字)","festival_rituals":"主要节日（元旦、上巳、端午、中秋、重阳、冬至等）的庆祝方式和禁忌(300字)","food_culture":"饮食文化——主食、副食、酒、茶、宴席规格、席次讲究(250字)","clothing_norms":"服饰规范——不同阶层不同场合的穿着要求、颜色禁忌、首饰佩戴(200字)","housing_patterns":"居住形制——宫殿/官邸/民居/军营的建筑形式和空间布局(200字)"}', 1800);

    // ═══ H6: 史料·制度典章深度 ═══
    prog(23, '史料研究(6/8) 制度典章...');
    var rH6 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的制度典章。\n当前剧本的官制：' + (r5.bureaucratic_state||'').substring(0,300) +
      '\n\n返回JSON：{"court_procedure":"朝会制度——常朝/朔望朝/大朝的流程、时间、地点、参加者、议事规则(300字)","legal_system":"法律制度——刑法体系、审判流程、量刑标准、特赦制度、株连规则(300字)","tax_system":"赋税制度——税种名称、征收方式、税率、减免条件、地方截留比例(250字)","military_system":"兵制详情——兵源(征/募/世兵)、编制名称、粮饷标准、调兵手续、战时动员流程(250字)","selection_system":"选官制度——' + (P.keju&&P.keju.enabled?'科举各级考试流程、阅卷标准、录取比例、座主门生关系':'察举/九品中正/军功等选拔流程') + '(200字)"}', 1800);

    // ═══ H7: 史料·称谓与语言习惯 ═══
    prog(24, '史料研究(7/8) 称谓语言...');
    var rH7 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的称呼方式和语言习惯。\n\n返回JSON：{"imperial_address":"帝王的自称和被称——朕/寡人/孤/陛下/圣上/天子等使用场合(200字)","official_address":"官场称呼——上下级之间、同僚之间、奏对时的称谓规范(250字)","family_address":"家族称呼——父母/兄弟/妻妾/子女的称谓、嫡庶区分(200字)","written_style":"公文行文风格——奏疏/诏书/檄文/私信的开头结尾格式和固定用语(250字)","taboo_words":"避讳制度——皇帝名讳如何避、先人名讳如何避、犯讳的后果(200字)","common_expressions":"时代口语——日常打招呼、表示同意/反对、骂人/赞美的习惯用语(200字)"}', 1800);

    // ═══ H8: 史料·礼仪典礼深度 ═══
    prog(25, '史料研究(8/8) 礼仪典礼...');
    var rH8 = await _call(sysHistorian,
      '请详细描述' + dynasty + '时期的礼仪典礼。\n\n返回JSON：{"court_etiquette":"上朝礼仪——入殿顺序、站位、奏事流程、叩拜方式、退朝规矩(300字)","audience_protocol":"觐见礼仪——外臣/使节/将领觐见皇帝的完整流程(200字)","military_rituals":"军事礼仪——出征誓师、犒赏三军、凯旋献俘、阵前对话的规矩(250字)","religious_ceremonies":"祭祀礼仪——天坛/太庙/社稷/山川的祭祀流程和意义(200字)","life_ceremonies":"人生礼仪——册封/赐婚/丧葬/祭祖的具体流程(200字)","diplomatic_protocol":"外交礼仪——接待外国使节/属国朝贡/互市谈判的礼节(200字)"}', 1800);

    // ════════════════════════════════════════════
    // 第五层：条件分支式推演（不预定剧本，而是准备多种走向）
    // ════════════════════════════════════════════
    var sysDirector = '你是这个历史世界的总导演。重要原则：玩家的选择必须能真正影响世界走向。不要预定剧本，而是准备多种可能性。你拥有前面24轮积累的全部知识。';

    // ═══ R1: 条件分支·世界走向 ═══
    prog(26, '条件推演(1/3) 世界走向分支树...');
    var rR1 = await _call(sysDirector,
      '终极摘要：' + masterText + '\n质询补充：' + allQ.substring(0, 2000) + '\n史料参考：' + JSON.stringify(rH1).substring(0, 1500) +
      '\n\n【重要】不要写固定脚本！要写条件分支。玩家的每个决策都应导向不同结果。\n返回JSON：{"world_branches":"世界走向分支树——列出3-5个关键决策点，每个决策点有2-3个分支走向(400字)","npc_reaction_matrix":"NPC对玩家不同决策的反应矩阵——如果玩家做X则NPC-A会Y(300字)","crisis_triggers":"危机触发条件——不是固定时间触发，而是当特定变量/关系达到阈值时触发(200字)","opportunity_windows":"机会窗口——哪些时机稍纵即逝，玩家必须在特定条件下才能抓住(200字)"}', 1800);

    // ═══ R2: 条件分支·NPC自主性 ═══
    prog(27, '条件推演(2/3) NPC自主行为逻辑...');
    var rR2 = await _call(sysDirector,
      '角色内心：' + (r9.character_profiles||'') + '\n被忽视的动机：' + (rQ1.deeper_motives||'') + '\n史料人物：' + (rH3.historical_anecdotes||'').substring(0, 500) +
      '\n\n【重要】NPC不是预设脚本的演员，而是有自主意志的个体。他们的行为取决于当前局势，而非预定时间表。\n返回JSON：{"npc_decision_logic":"每个重要NPC的决策逻辑树——什么条件下做什么(400字)","secret_agendas":"各NPC的秘密议程——他们不会告诉玩家的真实目的(200字)","emotional_triggers":"情感触发点——什么事件会让哪个NPC做出非理性行为(200字)","loyalty_breaking_points":"忠诚断裂点——每个NPC在什么条件下会背叛(200字)"}', 1500);

    // ═══ R3: 条件分支·世界演化规律 ═══
    prog(28, '条件推演(3/3) 世界演化规律...');
    var rR3 = await _call(sysDirector,
      '宏观分析：' + (r12.risk_matrix||'') + '\n史料经济：' + (rH2.real_economic_data||'').substring(0, 500) + '\n史料社会：' + (rH2.real_social_conditions||'').substring(0, 500) +
      '\n\n返回JSON：{"macro_trajectory":"世界宏观走向——政治/经济/军事/社会四维度在不同玩家策略下的演化(400字)","tipping_points":"不可逆临界点——一旦跨过就无法回头的5个关键阈值(250字)","butterfly_effects":"蝴蝶效应清单——10个看似微小但影响深远的决策(250字)","historical_parallels":"历史平行——这个局面最像哪些真实历史场景，那些场景最终如何收场(200字)","decay_patterns":"衰亡模式——如果玩家不作为，世界会按什么规律自然衰败(200字)"}', 1500);

    // ═══ 合并存储 ═══
    GM._aiScenarioDigest = {
      // Call 1
      eraEssence: (r1.era_essence||''),
      contradictionAnalysis: (r1.contradiction_analysis||''),
      playerDilemma: (r1.player_dilemma||''),
      // Call 2
      characterWeb: (r2.character_web||''),
      dangerousFigures: (r2.dangerous_figures||''),
      loyalAllies: (r2.loyal_allies||''),
      hiddenAgendas: (r2.hidden_agendas||''),
      // Call 3
      factionBalance: (r3.faction_balance||''),
      alliancePossibilities: (r3.alliance_possibilities||''),
      partyStruggle: (r3.party_struggle||''),
      classTensions: (r3.class_tensions||''),
      vassalRisks: (r3.vassal_risks||''),
      // Call 4
      worldAtmosphere: (r4.world_atmosphere||''),
      ruleImplications: (r4.rule_implications||''),
      culturalDynamics: (r4.cultural_dynamics||''),
      economicLogic: (r4.economic_logic||''),
      // Call 5 - 官制
      bureaucraticState: (r5.bureaucratic_state||''),
      powerNetwork: (r5.power_network||''),
      vacantCritical: (r5.vacant_critical||''),
      successionRisks: (r5.succession_risks||''),
      governanceReform: (r5.governance_reform||''),
      // Call 6 - 行政
      regionalStrengths: (r6admin.regional_strengths||''),
      regionalRisks: (r6admin.regional_risks||''),
      governorAssessment: (r6admin.governor_assessment||''),
      territorialStrategy: (r6admin.territorial_strategy||''),
      // Call 7 - 军事经济
      militaryAssessment: (r7mil.military_assessment||''),
      economicOutlook: (r7mil.economic_outlook||''),
      warScenarios: (r7mil.war_scenarios||''),
      resourceCrises: (r7mil.resource_crises||''),
      militaryReform: (r7mil.military_reform||''),
      // Call 8 - 事件
      eventPriorities: (r8evt.event_priorities||''),
      timelineForeshadow: (r8evt.timeline_foreshadow||''),
      goalStrategy: (r8evt.goal_strategy||''),
      narrativeArcs: (r8evt.narrative_arcs||''),
      chainReactions: (r8evt.chain_reactions||''),
      // Call 9 - 角色深度
      characterProfiles: (r9.character_profiles||''),
      relationshipTensions: (r9.relationship_tensions||''),
      betrayalRisks: (r9.betrayal_risks||''),
      allianceOpportunities: (r9.alliance_opportunities||''),
      emotionalTriggers: (r9.emotional_triggers||''),
      // Call 11 - 制度+物品+外交
      techStrategy: (r11.tech_strategy||''),
      itemSignificance: (r11.item_significance||''),
      diplomaticLandscape: (r11.diplomatic_landscape||''),
      vassalTitleDynamics: (r11.vassal_title_dynamics||''),
      successionPolitics: (r11.succession_politics||''),
      // Call 12 - 经济+省份+改革
      provinceAssessment: (r12.province_assessment||''),
      buildingPriorities: (r12.building_priorities||''),
      reformAgenda: (r12.reform_agenda||''),
      riskMatrix: (r12.risk_matrix||''),
      openingNarrative: (r12.opening_narrative||''),
      // Layer 2 - 交叉质询
      missedRelationships: (rQ1.missed_relationships||''),
      logicFlaws: (rQ1.logic_flaws||''),
      deeperMotives: (rQ1.deeper_motives||''),
      wildcardCharacters: (rQ1.wildcard_characters||''),
      strategicBlindSpots: (rQ2.strategic_blind_spots||''),
      allianceShifts: (rQ2.alliance_shifts||''),
      cascadeScenarios: (rQ2.cascade_scenarios||''),
      playerVulnerabilities: (rQ2.player_vulnerabilities||''),
      economicTimeBombs: (rQ3.economic_time_bombs||''),
      institutionalDecay: (rQ3.institutional_decay||''),
      reformParadoxes: (rQ3.reform_paradoxes||''),
      socialUndercurrents: (rQ3.social_undercurrents||''),
      narrativeGaps: (rQ4.narrative_gaps||''),
      pacingAdvice: (rQ4.pacing_advice||''),
      dramaticIrony: (rQ4.dramatic_irony||''),
      // Layer 3 - 史料研究
      realPoliticalEvents: (rH1.real_political_events||''),
      realMilitaryEvents: (rH1.real_military_events||''),
      keyHistoricalFigures: (rH1.key_historical_figures||''),
      institutionalReality: (rH1.institutional_reality||''),
      realSocialConditions: (rH2.real_social_conditions||''),
      realEconomicData: (rH2.real_economic_data||''),
      realCulturalScene: (rH2.real_cultural_scene||''),
      realDailyLife: (rH2.real_daily_life||''),
      historicalAnecdotes: (rH3.historical_anecdotes||''),
      literaryReferences: (rH3.literary_references||''),
      famousDialogues: (rH3.famous_dialogues||''),
      historicalTurningPoints: (rH3.historical_turning_points||''),
      sensoryDetails: (rH4.sensory_details||''),
      etiquetteNorms: (rH4.etiquette_norms||''),
      periodVocabulary: (rH4.period_vocabulary||''),
      seasonalCustoms: (rH4.seasonal_customs||''),
      // Layer 3 continued - 史料研究扩展
      folkCustoms: (rH5.folk_customs||''),
      festivalRituals: (rH5.festival_rituals||''),
      foodCulture: (rH5.food_culture||''),
      clothingNorms: (rH5.clothing_norms||''),
      housingPatterns: (rH5.housing_patterns||''),
      courtProcedure: (rH6.court_procedure||''),
      legalSystem: (rH6.legal_system||''),
      taxSystem: (rH6.tax_system||''),
      militarySystemDetail: (rH6.military_system||''),
      selectionSystemDetail: (rH6.selection_system||''),
      imperialAddress: (rH7.imperial_address||''),
      officialAddress: (rH7.official_address||''),
      familyAddress: (rH7.family_address||''),
      writtenStyle: (rH7.written_style||''),
      tabooWords: (rH7.taboo_words||''),
      commonExpressions: (rH7.common_expressions||''),
      courtEtiquette: (rH8.court_etiquette||''),
      audienceProtocol: (rH8.audience_protocol||''),
      militaryRituals: (rH8.military_rituals||''),
      religiousCeremonies: (rH8.religious_ceremonies||''),
      lifeCeremonies: (rH8.life_ceremonies||''),
      diplomaticProtocol: (rH8.diplomatic_protocol||''),
      // Layer 5 - 条件分支推演
      worldBranches: (rR1.world_branches||''),
      npcReactionMatrix: (rR1.npc_reaction_matrix||''),
      crisisTriggers: (rR1.crisis_triggers||''),
      opportunityWindows: (rR1.opportunity_windows||''),
      npcDecisionLogic: (rR2.npc_decision_logic||''),
      secretAgendas: (rR2.secret_agendas||''),
      emotionalTriggers: (rR2.emotional_triggers||''),
      loyaltyBreakingPoints: (rR2.loyalty_breaking_points||''),
      macroTrajectory: (rR3.macro_trajectory||''),
      tippingPoints: (rR3.tipping_points||''),
      butterflyEffects: (rR3.butterfly_effects||''),
      historicalParallels: (rR3.historical_parallels||''),
      decayPatterns: (rR3.decay_patterns||''),
      // Call 13 - Master
      masterDigest: (r8.master_digest||''),
      firstTurnPlan: (r8.first_turn_plan||''),
      npcBehaviors: (r8.npc_behaviors||''),
      crisisForecast: (r8.crisis_forecast||''),
      narrativeStyle: (r8.narrative_style||''),
      worldRules: (r8.world_rules||''),
      // Meta
      scenarioDigest: (r8.master_digest||''), // 兼容旧字段
      firstTurnFocus: (r8.first_turn_plan||''),
      npcIntentions: (r8.npc_behaviors||''),
      generatedAt: GM.turn
    };
    // 记录初始官制哈希（检测后续改革）
    GM._officeTreeHash = _computeOfficeHash();

    _dbg('[AI DeepRead 8-call] Master digest:', (GM._aiScenarioDigest.masterDigest||'').substring(0, 150));
    showLoading('\u6DF1\u5EA6\u9605\u8BFB\u5B8C\u6210\uFF01', 100);
  } catch(e) {
    console.warn('[AI DeepRead] Failed:', e);
    GM._aiScenarioDigest = { scenarioDigest: '', firstTurnFocus: '', npcIntentions: '', masterDigest: '', generatedAt: 0 };
  }
  setTimeout(hideLoading, 500);
}

// ============================================================
// 记忆锚点系统 - 借鉴 HistorySimAI
// ============================================================

/** @param {string} type @param {string} title @param {string} content @param {Object} [context] */
function createMemoryAnchor(type, title, content, context) {
  if (!GM.memoryAnchors) GM.memoryAnchors = [];

  // 结构化记录当前状态（借鉴 HistorySimAI 的 Memory Anchor 系统）
  var anchor = {
    id: uid(),
    type: type, // 'decision', 'event', 'policy', 'crisis'
    title: title,
    content: content,
    context: context || {},
    turn: GM.turn,
    year: getCurrentYear(),
    month: getCurrentMonth(),
    timestamp: Date.now(),
    importance: calculateAnchorImportance(type, context),

    // 结构化风险状态（用于 AI 推演）
    risk: {
      anxiety: Math.round(GM.anxiety || 0)
    },

    // 结构化游戏状态（关键数值快照）
    state: {
      factionCount: (GM.facs || []).length,
      characterCount: (GM.chars || []).length,
      militaryStrength: calculateTotalMilitaryStrength(),
      economicLevel: calculateEconomicLevel()
    },

    // 上下文描述（供 AI 理解）
    contextDescription: buildContextDescription(type, title, content)
  };

  GM.memoryAnchors.push(anchor);

  // 限制记忆锚点数量（由玩家在设置中配置）
  var anchorLimit = (P.conf && P.conf.memoryAnchorKeep) || 40;
  if (GM.memoryAnchors.length > anchorLimit) {
    // 超限时触发归档压缩（而非简单丢弃）
    archiveOldMemories();
    // 归档后仍超限则按时间裁剪
    if (GM.memoryAnchors.length > anchorLimit) {
      GM.memoryAnchors.sort(function(a, b) { return b.turn - a.turn; });
      GM.memoryAnchors = GM.memoryAnchors.slice(0, anchorLimit);
    }
  }

  return anchor;
}

/**
 * 创建执行约束记录（记录决策执行的详细信息）
 * 借鉴 HistorySimAI 的 Execution Constraint Recording 系统
 */
function createExecutionConstraint(decision, constraints, outcome) {
  if (!GM.executionConstraints) GM.executionConstraints = [];

  var record = {
    id: uid(),
    turn: GM.turn,
    year: getCurrentYear(),
    month: getCurrentMonth(),
    decision: decision, // 决策内容
    constraints: constraints || [], // 执行约束（如：资源不足、人员缺乏）
    outcome: outcome || '', // 执行结果
    timestamp: Date.now()
  };

  GM.executionConstraints.push(record);

  // 限制数量（使用玩家决策保留数配置）
  var constraintLimit = (P.conf && P.conf.playerDecisionKeep) || 30;
  if (GM.executionConstraints.length > constraintLimit) {
    GM.executionConstraints = GM.executionConstraints.slice(-constraintLimit);
  }

  return record;
}

/**
 * 辅助函数：计算总军事力量
 */
function calculateTotalMilitaryStrength() {
  var total = 0;
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      if (!army.destroyed) total += army.soldiers || army.strength || 0;
    });
  }
  return Math.round(total);
}

/**
 * 辅助函数：计算经济水平
 */
function calculateEconomicLevel() {
  // 尝试从变量中获取经济相关数值
  var economicVars = ['treasury', 'wealth', 'economy', 'tax', 'trade'];
  var total = 0;
  var count = 0;

  economicVars.forEach(function(varName) {
    if (GM.vars[varName] && GM.vars[varName].value !== undefined) {
      total += GM.vars[varName].value;
      count++;
    }
  });

  return count > 0 ? Math.round(total / count) : 50;
}

/**
 * 辅助函数：构建上下文描述
 */
function buildContextDescription(type, title, content) {
  var desc = '';

  // 添加类型标签
  var typeLabels = {
    'decision': '决策',
    'event': '事件',
    'policy': '政策',
    'crisis': '危机'
  };
  desc += '[' + (typeLabels[type] || type) + '] ';

  // 添加标题和内容
  desc += title;
  if (content && content !== title) {
    desc += '：' + content;
  }

  return desc;
}

/**
 * 计算锚点重要性
 */
function calculateAnchorImportance(type, context) {
  var baseImportance = {
    'decision': 70,
    'event': 60,
    'policy': 80,
    'crisis': 90
  };

  var importance = baseImportance[type] || 50;

  // 根据上下文调整重要性
  if (context.affectedResources && context.affectedResources.length > 3) {
    importance += 10; // 影响多个资源
  }

  if (context.majorConsequence) {
    importance += 15; // 重大后果
  }

  if (context.historicalSignificance) {
    importance += 20; // 历史意义
  }

  return Math.min(100, importance);
}

/** @param {number} [limit=8] @returns {string} 格式化的记忆上下文 */
function getMemoryAnchorsForAI(limit) {
  // 先归档旧记忆
  archiveOldMemories();

  var parts = [];

  // 1. 年代归档（长期记忆）
  if (GM.memoryArchive && GM.memoryArchive.length > 0) {
    parts.push('【历史纪要】');
    GM.memoryArchive.slice(-5).forEach(function(arch) {
      parts.push('  ' + arch.title + '：' + arch.content);
    });
  }

  // 2. 活跃记忆锚点（中期记忆）
  if (GM.memoryAnchors && GM.memoryAnchors.length > 0) {
    var sorted = GM.memoryAnchors.slice().sort(function(a, b) {
      var ia = a.importance || 50, ib = b.importance || 50;
      if (ia !== ib) return ib - ia;
      return (b.turn || 0) - (a.turn || 0);
    });
    var top = sorted.slice(0, limit || 8);
    parts.push('【近期要事】');
    top.forEach(function(anchor) {
      var line = '  T' + anchor.turn + ' [' + (anchor.type || '事件') + '] ' + anchor.title;
      if (anchor.content) line += '：' + anchor.content.substring(0, 80);
      parts.push(line);
    });
  }

  // 3. 角色弧线（人物记忆）
  var arcCtx = getAllCharacterArcContext(5);
  if (arcCtx) parts.push(arcCtx);

  // 4. 玩家决策轨迹（意图记忆）
  var decCtx = getPlayerDecisionContext(6);
  if (decCtx) parts.push(decCtx);

  return parts.length > 0 ? parts.join('\n') + '\n' : '';
}

// ============================================================
// 分层记忆归档系统
// 记忆锚点超过40个时，旧锚点压缩为年代摘要而非丢弃
// ============================================================

/** 将超限记忆锚点压缩为年度归档 */
function archiveOldMemories() {
  var anchorLimit = (P.conf && P.conf.memoryAnchorKeep) || 40;
  var archiveLimit = (P.conf && P.conf.memoryArchiveKeep) || 20;
  if (!GM.memoryAnchors || GM.memoryAnchors.length <= anchorLimit) return;
  if (!GM.memoryArchive) GM.memoryArchive = [];

  // 按年份分组
  var byYear = {};
  GM.memoryAnchors.forEach(function(anchor) {
    var year = anchor.year || Math.floor(anchor.turn / 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(anchor);
  });

  var years = Object.keys(byYear).map(Number).sort(function(a,b){return a-b;});
  var currentYear = years[years.length - 1] || 0;
  var archiveThreshold = currentYear - 2;

  var keptAnchors = [];
  var newArchives = [];
  years.forEach(function(year) {
    if (year > archiveThreshold) {
      keptAnchors = keptAnchors.concat(byYear[year]);
    } else {
      var anchors = byYear[year];
      var types = {};
      anchors.forEach(function(a) { types[a.type] = (types[a.type] || 0) + 1; });
      var topEvents = anchors.sort(function(a,b){return (b.importance||0)-(a.importance||0);}).slice(0,3);
      var summaryText = topEvents.map(function(e){return e.title + ':' + (e.content||'').substring(0,50);}).join('；');
      var summary = {
        type: 'archive', title: year + '年纪要', content: summaryText,
        turn: anchors[0].turn, year: year,
        importance: Math.max.apply(null, anchors.map(function(a){return a.importance||50;})),
        eventCount: anchors.length, eventTypes: types
      };
      newArchives.push(summary);
    }
  });

  // 新归档加入前，如果归档也超限，用 AI 压缩最旧的归档为一条总纲
  GM.memoryArchive = GM.memoryArchive.concat(newArchives);
  if (GM.memoryArchive.length > archiveLimit) {
    _compressOldArchives(archiveLimit);
  }

  GM.memoryAnchors = keptAnchors;
  _dbg('[Memory] 归档完成，保留' + keptAnchors.length + '条活跃锚点，' + GM.memoryArchive.length + '条归档');
}

/** 压缩最旧的归档为一条综合总纲（超出上限时调用） */
function _compressOldArchives(limit) {
  if (!GM.memoryArchive || GM.memoryArchive.length <= limit) return;
  // 将超出部分合并为一条"远古纪要"
  var overflow = GM.memoryArchive.splice(0, GM.memoryArchive.length - limit + 1);
  var yearRange = overflow[0].year + '-' + overflow[overflow.length-1].year;
  var combined = {
    type: 'archive',
    title: yearRange + '年综述',
    content: overflow.map(function(a){ return a.title + ':' + (a.content||'').substring(0,30); }).join('；').substring(0, 300),
    turn: overflow[0].turn,
    year: overflow[0].year,
    importance: 80,
    eventCount: overflow.reduce(function(s,a){ return s + (a.eventCount||1); }, 0),
    compressed: true
  };
  GM.memoryArchive.unshift(combined);

  // 异步 AI 压缩（不阻塞游戏，后台生成更好的摘要替换）
  if (P.ai.key) {
    var prompt = '请将以下历史纪要压缩为一段100字以内的综述：\n' + overflow.map(function(a){ return a.content; }).join('\n');
    callAI(prompt, 300).then(function(result) {
      if (result && GM.memoryArchive[0] && GM.memoryArchive[0].compressed) {
        GM.memoryArchive[0].content = result.substring(0, 200);
        GM.memoryArchive[0].aiCompressed = true;
        _dbg('[Memory] AI 压缩归档完成: ' + yearRange);
      }
    }).catch(function(e) { _dbg('[Memory] AI 压缩失败，保留原始摘要'); });
  }
}

// ============================================================
// 角色弧线追踪
// 记录每个角色的重大事件，供 AI 生成连贯的人物叙事
// ============================================================

/** @param {string} charName @param {string} eventType - appointment|dismissal|war|death|inheritance|achievement @param {string} description */
function recordCharacterArc(charName, eventType, description) {
  if (!charName || !eventType) return;
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.characterArcs[charName]) GM.characterArcs[charName] = [];

  GM.characterArcs[charName].push({
    type: eventType,    // 'appointment'|'dismissal'|'war'|'betrayal'|'alliance'|'death'|'marriage'|'achievement'
    desc: (description || '').substring(0, 100),
    turn: GM.turn,
    year: getCurrentYear ? getCurrentYear() : GM.turn
  });

  // 每角色最多保留 10 条弧线事件
  var arcLimit = (P.conf && P.conf.characterArcKeep) || 10;
  if (GM.characterArcs[charName].length > arcLimit) {
    GM.characterArcs[charName] = GM.characterArcs[charName].slice(-arcLimit);
  }
}

/** 获取角色弧线摘要（供 AI prompt） */
function getCharacterArcSummary(charName, maxEvents) {
  if (!GM.characterArcs || !GM.characterArcs[charName]) return '';
  var events = GM.characterArcs[charName].slice(-(maxEvents || 5));
  return events.map(function(e) { var _d=(typeof getTSText==='function')?getTSText(e.turn):''; return _d+'：'+e.desc; }).join('；');
}

/** 获取所有有弧线的关键人物摘要（供 AI prompt） */
function getAllCharacterArcContext(maxChars) {
  if (!GM.characterArcs) return '';
  var names = Object.keys(GM.characterArcs);
  if (names.length === 0) return '';
  // 按事件数排序，取最活跃的
  names.sort(function(a, b) {
    return (GM.characterArcs[b] || []).length - (GM.characterArcs[a] || []).length;
  });
  var result = '【人物履历】\n';
  names.slice(0, maxChars || 6).forEach(function(name) {
    var summary = getCharacterArcSummary(name, 3);
    if (summary) result += '  ' + name + '：' + summary + '\n';
  });
  return result;
}

// ============================================================
// 玩家决策追踪
// 记录玩家的关键决策（诏令/朝议选择/事件分支），供 AI 理解玩家意图
// ============================================================

/** @param {string} category - edict|agenda|event|keju|policy|goal @param {string} description @param {string} [consequences] */
function recordPlayerDecision(category, description, consequences) {
  if (!GM.playerDecisions) GM.playerDecisions = [];
  GM.playerDecisions.push({
    category: category,  // 'edict'|'agenda'|'event'|'appointment'|'war'|'reform'
    desc: (description || '').substring(0, 150),
    consequences: (consequences || '').substring(0, 100),
    turn: GM.turn
  });
  // 保留最近 30 条
  var decLimit = (P.conf && P.conf.playerDecisionKeep) || 30;
  if (GM.playerDecisions.length > decLimit) GM.playerDecisions = GM.playerDecisions.slice(-decLimit);
}

/** 获取玩家决策上下文（供 AI 理解玩家风格和意图） */
function getPlayerDecisionContext(maxDecisions) {
  if (!GM.playerDecisions || GM.playerDecisions.length === 0) return '';
  var recent = GM.playerDecisions.slice(-(maxDecisions || 8));
  var result = '【玩家决策轨迹】\n';
  recent.forEach(function(d) {
    result += '  T' + d.turn + ' [' + d.category + '] ' + d.desc;
    if (d.consequences) result += ' → ' + d.consequences;
    result += '\n';
  });
  // 简要风格分析
  var cats = {};
  GM.playerDecisions.forEach(function(d) { cats[d.category] = (cats[d.category] || 0) + 1; });
  var topCat = Object.entries(cats).sort(function(a,b){return b[1]-a[1];})[0];
  if (topCat) result += '  (玩家偏好: ' + topCat[0] + '类决策占比最高)\n';
  return result;
}

/**
 * 打开记忆锚点面板
 * 增强版：显示结构化状态信息
 */
function openMemoryAnchors() {
  if (!GM.memoryAnchors) GM.memoryAnchors = [];

  var typeColor = { decision:'var(--blue)', event:'var(--gold)', policy:'var(--green)', crisis:'var(--red)', archive:'var(--txt-d)' };
  var typeLabel = { decision:'\u51B3\u7B56', event:'\u4E8B\u4EF6', policy:'\u653F\u7B56', crisis:'\u5371\u673A', archive:'\u7EAA\u8981' };

  // 按年分组
  var byYear = {};
  GM.memoryAnchors.forEach(function(a) {
    var yr = a.year || ('\u7B2C' + Math.ceil((a.turn || 1) / 4) + '\u5E74');
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(a);
  });

  // 年份倒序
  var years = Object.keys(byYear).sort(function(a, b) {
    var na = parseInt(a) || 0, nb = parseInt(b) || 0;
    return nb - na;
  });

  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';

  if (GM.memoryAnchors.length === 0) {
    html += '<div style="text-align:center;color:var(--txt-d);padding:2rem;">\u6682\u65E0\u5927\u4E8B\u8BB0</div>';
  } else {
    years.forEach(function(yr, yi) {
      var anchors = byYear[yr].sort(function(a, b) { return (b.turn || 0) - (a.turn || 0); });
      var maxImp = 0;
      anchors.forEach(function(a) { if ((a.importance || 0) > maxImp) maxImp = a.importance; });
      var collapsed = yi > 0; // 第一年展开，其余折叠

      html += '<div style="margin-bottom:0.8rem;">';
      html += '<div style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding:0.4rem 0;" onclick="var el=this.nextElementSibling;el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=el.style.display===\'none\'?\'\u25B6\':\'\u25BC\';">';
      html += '<span style="font-size:0.8rem;color:var(--gold);">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';
      html += '<span style="font-weight:700;color:var(--txt-l);font-size:0.95rem;">' + yr + '</span>';
      html += '<span style="font-size:0.72rem;color:var(--txt-d);">' + anchors.length + '\u4EF6</span>';
      html += '</div>';

      html += '<div style="display:' + (collapsed ? 'none' : 'block') + ';">';
      anchors.forEach(function(anchor) {
        var tc = typeColor[anchor.type] || 'var(--bg-3)';
        var tl = typeLabel[anchor.type] || '\u5176\u4ED6';
        var isHigh = (anchor.importance || 0) >= 80;

        html += '<div style="margin-bottom:0.6rem;padding:0.7rem;background:var(--bg-2);border-left:4px solid ' + tc + ';border-radius:4px;'
          + (isHigh ? 'border:1px solid var(--gold);' : '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">';
        html += '<span style="font-weight:700;color:' + (isHigh ? 'var(--gold)' : 'var(--txt-l)') + ';">' + escHtml(anchor.title || '') + '</span>';
        html += '<div style="display:flex;gap:0.4rem;align-items:center;">';
        html += '<span style="font-size:0.68rem;color:' + tc + ';background:var(--bg-3);padding:1px 5px;border-radius:3px;">' + tl + '</span>';
        html += '<span style="font-size:0.68rem;color:var(--txt-d);">T' + (anchor.turn || '?') + '</span>';
        html += '</div></div>';

        html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.5;">' + escHtml(anchor.content || '') + '</div>';

        if (anchor.risk) {
          var ri = [];
          if (anchor.risk.unrest !== undefined) ri.push('\u6C11\u53D8' + anchor.risk.unrest);
          if (anchor.risk.partyStrife !== undefined) ri.push('\u515A\u4E89' + anchor.risk.partyStrife);
          if (anchor.risk.prestige !== undefined) ri.push('\u5A01\u671B' + anchor.risk.prestige);
          if (ri.length > 0) html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:0.3rem;">' + ri.join(' | ') + '</div>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    });
  }

  html += '<div style="text-align:center;font-size:0.72rem;color:var(--txt-d);padding:0.5rem 0;border-top:1px solid var(--bg-3);margin-top:0.5rem;">\u4EE5\u4E0A\u5927\u4E8B\u8BB0\u5DF2\u81EA\u52A8\u7EB3\u5165AI\u63A8\u6F14\u8BB0\u5FC6</div>';
  html += '</div>';

  openGenericModal('\u5927\u4E8B\u8BB0', html, null);
}

// ============================================================
//  历史事件系统 - 通用时间触发+分支选择框架
// ============================================================

/**
 * 检查并触发历史事件
 * 框架特性：
 * - 基于年月的时间触发
 * - 多分支选择系统
 * - 影响自动应用
 * - 事件去重（已触发不再触发）
 */
function checkHistoryEvents() {
  if (!P.rigidHistoryEvents || P.rigidHistoryEvents.length === 0) return;
  if (!GM.triggeredHistoryEvents) GM.triggeredHistoryEvents = {};

  var currentYear = getCurrentYear();
  var currentMonth = getCurrentMonth();

  P.rigidHistoryEvents.forEach(function(event) {
    // 跳过已触发事件
    if (GM.triggeredHistoryEvents[event.id]) return;

    // 检查触发条件
    var trigger = event.trigger || {};
    var yearMatch = trigger.year === undefined || trigger.year === currentYear;
    var monthMatch = trigger.month === undefined || trigger.month === currentMonth;

    // 自定义条件检查（可选）
    var customMatch = true;
    if (typeof trigger.condition === 'function') {
      try {
        customMatch = trigger.condition(GM, P);
      } catch (e) {
        customMatch = false;
      }
    }

    if (yearMatch && monthMatch && customMatch) {
      // 标记为已触发
      GM.triggeredHistoryEvents[event.id] = {
        turn: GM.turn,
        year: currentYear,
        month: currentMonth
      };

      // 显示事件选择界面
      showHistoryEventModal(event);
    }
  });
}

/**
 * 显示历史事件选择模态框
 */
function showHistoryEventModal(event) {
  var html = '<div style="padding: 1rem;">';
  html += '<div style="margin-bottom: 1rem; color: var(--gold); font-size: 1.1rem; font-weight: 700;">' + (event.name || '历史事件') + '</div>';

  if (event.description) {
    html += '<div style="margin-bottom: 1.5rem; color: var(--txt-s); line-height: 1.6;">' + event.description + '</div>';
  }

  html += '<div style="margin-bottom: 1rem; color: var(--txt-d); font-size: 0.9rem;">请选择应对方式：</div>';

  // 渲染分支选项
  if (event.branches && event.branches.length > 0) {
    event.branches.forEach(function(branch, idx) {
      html += '<div style="margin-bottom: 0.8rem; padding: 0.8rem; background: var(--bg-2); border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;" ';
      html += 'onmouseover="this.style.borderColor=\'var(--gold)\'" ';
      html += 'onmouseout="this.style.borderColor=\'transparent\'" ';
      html += 'onclick="applyEventBranch(\'' + event.id + '\', ' + idx + ')">';
      html += '<div style="font-weight: 700; color: var(--gold-l); margin-bottom: 0.3rem;">' + (branch.name || '选项' + (idx + 1)) + '</div>';

      if (branch.description) {
        html += '<div style="font-size: 0.85rem; color: var(--txt-d); margin-bottom: 0.5rem;">' + branch.description + '</div>';
      }

      // 显示影响预览
      if (branch.impact) {
        html += '<div style="font-size: 0.8rem; color: var(--txt-s);">影响：';
        var impacts = [];
        Object.keys(branch.impact).forEach(function(key) {
          var val = branch.impact[key];
          var sign = val > 0 ? '+' : '';
          impacts.push(key + ' ' + sign + val);
        });
        html += impacts.join(', ');
        html += '</div>';
      }

      html += '</div>';
    });
  } else {
    html += '<div style="text-align: center; color: var(--txt-d); padding: 1rem;">此事件无可选分支</div>';
    html += '<button class="bt bp" onclick="closeModal()" style="width: 100%; margin-top: 1rem;">确认</button>';
  }

  html += '</div>';

  openGenericModal('历史事件', html, null);
}

/**
 * 应用事件分支效果
 */
function applyEventBranch(eventId, branchIdx) {
  var event = P.rigidHistoryEvents.find(function(e) { return e.id === eventId; });
  if (!event || !event.branches || !event.branches[branchIdx]) {
    closeModal();
    return;
  }

  var branch = event.branches[branchIdx];

  // 应用影响
  if (branch.impact) {
    Object.keys(branch.impact).forEach(function(key) {
      var val = branch.impact[key];

      // 尝试应用到变量
      if (GM.vars[key]) {
        GM.vars[key].value = Math.max(0, Math.min(100, (GM.vars[key].value || 0) + val));
      }

      // 尝试应用到 GM 直接属性
      if (GM[key] !== undefined && typeof GM[key] === 'number') {
        GM[key] = Math.max(0, Math.min(100, GM[key] + val));
      }
    });
  }

  // 执行自定义效果
  if (typeof branch.effect === 'function') {
    try {
      branch.effect(GM, P);
    } catch (e) {
      console.error('Event branch effect error:', e);
    }
  }

  // 记录到编年
  if (GM.biannianItems) {
    GM.biannianItems.push({
      turn: GM.turn,
      year: getCurrentYear(),
      month: getCurrentMonth(),
      title: event.name + '：' + branch.name,
      content: branch.description || '',
      type: 'history_event'
    });
  }

  // 创建记忆锚点
  createMemoryAnchor('event', event.name, branch.name + '：' + (branch.description || ''), {
    eventId: eventId,
    branchId: branch.id || branchIdx
  });

  if (typeof recordPlayerDecision === 'function') recordPlayerDecision('event', event.name + ':' + branch.name, branch.description || '');
  if (typeof recordCharacterArc === 'function' && event.actors) {
    event.actors.forEach(function(actor) { recordCharacterArc(actor, 'event', event.name + '：' + branch.name); });
  }

  toast('✅ ' + branch.name);
  closeModal();
}

// ============================================================
//  刚性触发系统 - 通用阈值触发框架
// ============================================================

/**
 * 检查刚性触发器
 * 框架特性：
 * - 基于阈值的自动触发
 * - 支持多级触发（如：罢工三级）
 * - 硬性下限（防止过度优化）
 * - 可配置触发条件
 */
function checkRigidTriggers() {
  if (!GM.rigidTriggers || Object.keys(GM.rigidTriggers).length === 0) return;

  var triggers = GM.rigidTriggers;

  // 检查单一阈值触发器
  Object.keys(triggers).forEach(function(key) {
    if (key === 'hardFloors' || key === 'levels') return; // 跳过特殊配置

    var config = triggers[key];
    if (typeof config !== 'object' || !config.threshold) return;

    var currentValue = getValueByPath(config.valuePath || key);
    if (currentValue === undefined) return;

    // 检查是否超过阈值
    if (currentValue >= config.threshold) {
      // 检查是否已触发（避免重复）
      var triggerKey = key + '_' + GM.turn;
      if (GM._triggeredThisTurn && GM._triggeredThisTurn[triggerKey]) return;

      if (!GM._triggeredThisTurn) GM._triggeredThisTurn = {};
      GM._triggeredThisTurn[triggerKey] = true;

      // 触发事件
      triggerRigidEvent(key, config, currentValue);
    }
  });

  // 检查多级触发器（如罢工等级）
  if (triggers.levels && Array.isArray(triggers.levels)) {
    triggers.levels.forEach(function(level) {
      if (!level.valuePath || !level.threshold) return;

      var currentValue = getValueByPath(level.valuePath);
      if (currentValue === undefined) return;

      if (currentValue >= level.threshold) {
        var triggerKey = 'level_' + level.id + '_' + GM.turn;
        if (GM._triggeredThisTurn && GM._triggeredThisTurn[triggerKey]) return;

        if (!GM._triggeredThisTurn) GM._triggeredThisTurn = {};
        GM._triggeredThisTurn[triggerKey] = true;

        triggerRigidEvent(level.id, level, currentValue);
      }
    });
  }

  // 应用硬性下限
  if (triggers.hardFloors) {
    Object.keys(triggers.hardFloors).forEach(function(key) {
      var floor = triggers.hardFloors[key];
      var currentValue = getValueByPath(key);

      if (currentValue !== undefined && currentValue < floor) {
        setValueByPath(key, floor);
      }
    });
  }

  // 清空本回合触发记录（下回合重新检查）
  if (GM._triggeredThisTurn) {
    delete GM._triggeredThisTurn;
  }
}

/**
 * 触发刚性事件
 */
function triggerRigidEvent(id, config, currentValue) {
  var html = '<div style="padding: 1rem;">';
  html += '<div style="margin-bottom: 1rem; color: var(--red); font-size: 1.1rem; font-weight: 700;">';
  html += '⚠️ ' + (config.name || '触发事件');
  html += '</div>';

  html += '<div style="margin-bottom: 1rem; color: var(--txt-s); line-height: 1.6;">';
  html += config.description || ('当前值 ' + currentValue + ' 已达到阈值 ' + config.threshold);
  html += '</div>';

  // 显示影响
  if (config.impact) {
    html += '<div style="margin-top: 1rem; padding: 0.8rem; background: var(--bg-2); border-radius: 6px;">';
    html += '<div style="font-weight: 700; color: var(--gold); margin-bottom: 0.5rem;">影响：</div>';
    Object.keys(config.impact).forEach(function(key) {
      var val = config.impact[key];
      var sign = val > 0 ? '+' : '';
      html += '<div style="font-size: 0.9rem; color: var(--txt-d);">' + key + ': ' + sign + val + '</div>';
    });
    html += '</div>';
  }

  html += '<button class="bt bp" onclick="closeModal()" style="width: 100%; margin-top: 1rem;">确认</button>';
  html += '</div>';

  // 应用影响
  if (config.impact) {
    Object.keys(config.impact).forEach(function(key) {
      var val = config.impact[key];

      if (GM.vars[key]) {
        GM.vars[key].value = Math.max(0, Math.min(100, (GM.vars[key].value || 0) + val));
      }

      if (GM[key] !== undefined && typeof GM[key] === 'number') {
        GM[key] = Math.max(0, Math.min(100, GM[key] + val));
      }
    });
  }

  // 执行自定义效果
  if (typeof config.effect === 'function') {
    try {
      config.effect(GM, P);
    } catch (e) {
      console.error('Rigid trigger effect error:', e);
    }
  }

  // 记录到编年
  if (GM.biannianItems) {
    GM.biannianItems.push({
      turn: GM.turn,
      year: getCurrentYear(),
      month: getCurrentMonth(),
      title: config.name || '触发事件',
      content: config.description || '',
      type: 'rigid_trigger'
    });
  }

  openGenericModal('系统事件', html, null);
}

/**
 * 辅助函数：通过路径获取值
 */
function getValueByPath(path) {
  if (!path) return undefined;

  // 支持 "GM.xxx" 或 "vars.xxx" 格式
  var parts = path.split('.');
  var obj = parts[0] === 'GM' ? GM : (parts[0] === 'vars' ? GM.vars : GM);

  for (var i = (parts[0] === 'GM' || parts[0] === 'vars' ? 1 : 0); i < parts.length; i++) {
    if (obj === undefined) return undefined;
    obj = obj[parts[i]];
  }

  // 如果是变量对象，返回 value
  if (obj && typeof obj === 'object' && obj.value !== undefined) {
    return obj.value;
  }

  return obj;
}

/**
 * 辅助函数：通过路径设置值
 */
function setValueByPath(path, value) {
  if (!path) return;

  var parts = path.split('.');
  var obj = parts[0] === 'GM' ? GM : (parts[0] === 'vars' ? GM.vars : GM);

  for (var i = (parts[0] === 'GM' || parts[0] === 'vars' ? 1 : 0); i < parts.length - 1; i++) {
    if (obj === undefined) return;
    obj = obj[parts[i]];
  }

  var lastKey = parts[parts.length - 1];

  // 如果是变量对象，设置 value
  if (obj[lastKey] && typeof obj[lastKey] === 'object' && obj[lastKey].value !== undefined) {
    obj[lastKey].value = value;
  } else {
    obj[lastKey] = value;
  }
}

/**
 * 辅助函数：获取当前年份
 */
function getCurrentYear() {
  if (!P.time) return 0;
  var tpy = 4; // turns per year
  if (P.time.perTurn === "1y") tpy = 1;
  else if (P.time.perTurn === "1m") tpy = 12;
  else if (P.time.perTurn === "1s") tpy = 4;

  var yearOffset = Math.floor((GM.turn - 1) / tpy);
  return (P.time.year || 0) + yearOffset;
}

/**
 * 辅助函数：获取当前月份
 */
function getCurrentMonth() {
  if (!P.time) return 1;
  if (P.time.perTurn === "1y") return 1;
  if (P.time.perTurn === "1s") {
    var season = ((GM.turn - 1) % 4);
    return season * 3 + 1; // 春1月，夏4月，秋7月，冬10月
  }
  if (P.time.perTurn === "1m") {
    var monthOffset = (GM.turn - 1) % 12;
    return ((P.time.startMonth || 1) - 1 + monthOffset) % 12 + 1;
  }
  return 1;
}


// ============================================================
//  endTurn 事件钩子系统
// ============================================================

/**
 * endTurn 钩子系统
 * 替代原有的多层包装链（_origEndTurn, _origEndTurn2, etc.）
 * 提供清晰的执行顺序和易于维护的扩展机制
 */
var EndTurnHooks = (function() {
  var hooks = {
    before: [],  // 在 endTurn 核心逻辑之前执行
    after: []    // 在 endTurn 核心逻辑之后执行
  };

  /**
   * 注册钩子函数
   * @param {string} phase - 'before' 或 'after'
   * @param {Function} callback - 钩子函数（可以是 async）
   * @param {string} name - 钩子名称（用于调试）
   */
  function register(phase, callback, name) {
    if (phase !== 'before' && phase !== 'after') {
      console.error('[EndTurnHooks] 无效的 phase:', phase);
      return;
    }
    hooks[phase].push({ callback: callback, name: name || 'anonymous' });
    _dbg('[EndTurnHooks] 注册钩子:', phase, name);
  }

  /**
   * 执行指定阶段的所有钩子
   * @param {string} phase - 'before' 或 'after'
   */
  async function execute(phase) {
    var phaseHooks = hooks[phase];
    _dbg('[EndTurnHooks] 执行 ' + phase + ' 钩子，共 ' + phaseHooks.length + ' 个');

    for (var i = 0; i < phaseHooks.length; i++) {
      var hook = phaseHooks[i];
      try {
        _dbg('[EndTurnHooks] 执行钩子: ' + hook.name);
        await hook.callback();
      } catch (error) {
        console.error('[EndTurnHooks] 钩子执行失败:', hook.name, error);
      }
    }
  }

  /**
   * 清空所有钩子（用于重置）
   */
  function clear() {
    hooks.before = [];
    hooks.after = [];
    _dbg('[EndTurnHooks] 已清空所有钩子');
  }

  /**
   * 获取钩子统计信息
   */
  function getStats() {
    return {
      before: hooks.before.length,
      after: hooks.after.length,
      total: hooks.before.length + hooks.after.length
    };
  }

  return {
    register: register,
    execute: execute,
    clear: clear,
    getStats: getStats
  };
})();

// ============================================================
//  结束回合（核心推演函数  - 单一版本）
// ============================================================
// ============================================================
// 纪传体叙事系统（借鉴晚唐风云 Chronicle System）
// 月度摘要累积 → 年度正史生成，含跨年记忆
// 适配天命全朝代设计：不硬编码任何朝代信息
// ============================================================
/**
 * 纪传体叙事系统 - 月度摘要累积→年度正史
 * @namespace
 * @property {function(number,string,string):void} addMonthDraft
 * @property {function(number):Object|null} getYearChronicle
 * @property {function():number[]} getAvailableYears
 * @property {function():Object} serialize
 * @property {function(Object):void} deserialize
 */
var ChronicleSystem = {
  monthDrafts: {},  // key: 'year-month', value: {summary, events}
  yearChronicles: {},  // key: 'year', value: {content, afterword, read}

  /** 记录本回合摘要（每回合末调用） */
  addMonthDraft: function(turn, shizhengji, zhengwen) {
    if (!P.time) return;
    var t = P.time;
    var _dpv = _getDaysPerTurn();
    var totalDays = (turn - 1) * _dpv;
    var yo = Math.floor(totalDays / 365);
    var year = (t.year||0) + yo;
    var seasonIdx = Math.floor((totalDays % 365) / 91.25); // 0-3
    var season = Math.min(seasonIdx, (t.seasons||[]).length - 1);
    var key = year + '-' + season;

    ChronicleSystem.monthDrafts[key] = {
      turn: turn,
      year: year,
      season: season,
      summary: (shizhengji || '').substring(0, 300),
      narrative: (zhengwen || '').substring(0, 200),
      timestamp: Date.now()
    };

    // 限制月度摘要数量（保留最近 N 个月，N = chronicleKeep * 12）
    var draftKeys = Object.keys(ChronicleSystem.monthDrafts);
    var maxDrafts = ((P.conf && P.conf.chronicleKeep) || 10) * 12;
    if (draftKeys.length > maxDrafts) {
      draftKeys.sort();
      var toRemove = draftKeys.slice(0, draftKeys.length - maxDrafts);
      toRemove.forEach(function(k) { delete ChronicleSystem.monthDrafts[k]; });
    }

    // 检查是否年末（累计天数跨年）
    if (typeof isYearBoundary === 'function' && isYearBoundary()) {
      ChronicleSystem._tryGenerateYearChronicle(year);
    }
  },

  /** 尝试生成年度正史（异步，不阻塞游戏） */
  _tryGenerateYearChronicle: function(year) {
    if (ChronicleSystem.yearChronicles[year]) return; // 已生成
    if (!P.ai.key) return; // 无 AI 跳过

    // 收集该年所有月度摘要
    var drafts = [];
    Object.keys(ChronicleSystem.monthDrafts).forEach(function(key) {
      var d = ChronicleSystem.monthDrafts[key];
      if (d.year === year) drafts.push(d);
    });
    if (drafts.length === 0) return;

    drafts.sort(function(a, b) { return a.turn - b.turn; });

    // 构建 AI prompt（不硬编码朝代，从 P 中读取）
    var sc = findScenarioById(GM.sid);
    var dynasty = sc ? sc.dynasty || sc.era || '' : '';
    var emperor = sc ? sc.emperor || sc.role || '' : '';
    var prevAfterword = '';
    if (ChronicleSystem.yearChronicles[year - 1]) {
      prevAfterword = ChronicleSystem.yearChronicles[year - 1].afterword || '';
    }

    // 编年史风格（从chronicleConfig读取）
    var _ccfg = P.chronicleConfig || {};
    var _style = _ccfg.style || 'biannian';
    var _styleGuide = {
      biannian: '编年体（仿《资治通鉴》），以时间为纲，逐月叙事，客观冷静。',
      shilu: '实录体（仿《各朝实录》），以帝王言行为中心，详记诏令与臣对。',
      jizhuan: '纪传体（仿《史记》），以人物为中心，叙述本年关键人物事迹。',
      jishi: '纪事本末体（仿《通鉴纪事本末》），以事件为线索，完整讲述本年重大事件始末。',
      biji: '笔记体（仿宋人笔记），笔调闲散，穿插逸事趣闻，可加作者评论。',
      custom: _ccfg.customStyleNote || '自定义风格，典雅古朴。'
    };
    var _chrR2 = _getCharRange('chronicle');
    var _minC = _ccfg.yearlyMinChars || _chrR2[0];
    var _maxC = _ccfg.yearlyMaxChars || _chrR2[1];

    // 6.5: 编年史整合——春秋左传风格强制指导
    var _chronicleStyleGuide = '严格参照《春秋》《左传》编年体史书风格。以年月为序，记录大事。用语简洁精炼如"某年某月，某事"。每事一句或数句，不铺陈渲染。年号纪年，按时序排列。';
    var prompt = '你是一位古代史官，负责撰写' + dynasty + '正史。\n';
    prompt += '文体要求：' + (_styleGuide[_style] || _styleGuide.biannian) + '\n';
    prompt += '底层风格参照：' + _chronicleStyleGuide + '\n';
    prompt += '请根据以下各季/月的起居注摘要，撰写' + year + '年的编年史记（' + _minC + '-' + _maxC + '字）。\n';
    if (emperor) prompt += '当朝天子/主角：' + emperor + '\n';
    if (prevAfterword) prompt += '上年史评：' + prevAfterword + '\n';
    // 6.1联动：注入该年回收的伏笔因果链
    if (GM._foreshadowings) {
      var _yearResolved = GM._foreshadowings.filter(function(f) {
        return f.resolved && f.resolveTurn && (typeof calcDateFromTurn === 'function') &&
          calcDateFromTurn(f.resolveTurn) && calcDateFromTurn(f.resolveTurn).adYear === year;
      });
      if (_yearResolved.length > 0) {
        prompt += '\n\u672C\u5E74\u56DE\u6536\u7684\u4F0F\u7B14\u56E0\u679C\u94FE\uFF08\u7F16\u5E74\u4E2D\u5E94\u81EA\u7136\u5448\u73B0\u8FD9\u4E9B\u524D\u56E0\u540E\u679C\uFF09\uFF1A\n';
        _yearResolved.forEach(function(f) {
          prompt += '  T' + f.plantTurn + '\u57CB\u4E0B\u300C' + f.content + '\u300D\u2192 T' + f.resolveTurn + '\u300C' + (f.resolveContent||'') + '\u300D\n';
        });
      }
    }
    // 6.5联动：注入每回合一句话摘要
    if (GM._yearlyDigest && GM._yearlyDigest.length > 0) {
      prompt += '\n\u672C\u5E74\u5404\u56DE\u5408\u4E00\u53E5\u8BDD\u6458\u8981\uFF1A\n';
      GM._yearlyDigest.forEach(function(d) { prompt += 'T' + d.turn + ': ' + d.summary + '\n'; });
    }
    prompt += '\n\u5404\u5B63\u6458\u8981\uFF1A\n';
    drafts.forEach(function(d) {
      var seasonName = (P.time.seasons || ['\u6625','\u590F','\u79CB','\u51AC'])[d.season] || '';
      prompt += '\u3010' + seasonName + '\u3011' + d.summary + '\n';
    });
    prompt += '\n请返回 JSON: {"chronicle":"正史正文' + _charRangeText('chronicle') + '","afterword":"史评/论赞' + _charRangeScaled('comment', 1.0) + '"}';

    // 异步生成，不阻塞
    callAI(prompt, 1500).then(function(result) {
      var parsed = extractJSON(result);
      if (parsed) {
        ChronicleSystem.yearChronicles[year] = {
          content: parsed.chronicle || result,
          afterword: parsed.afterword || '',
          read: false,
          generatedAt: Date.now()
        };

        // 限制年度正史数量
        var yearKeys = Object.keys(ChronicleSystem.yearChronicles);
        var maxYears = ((P.conf && P.conf.chronicleKeep) || 10) * 2;
        if (yearKeys.length > maxYears) {
          yearKeys.sort(function(a,b){return a-b;});
          var removeYears = yearKeys.slice(0, yearKeys.length - maxYears);
          removeYears.forEach(function(k) { delete ChronicleSystem.yearChronicles[k]; });
        }

        _dbg('[Chronicle] 年度正史生成完成:', year);
        if (typeof addEB === 'function') addEB('正史', year + '年编年史已完成');
      }
    }).catch(function(e) {
      console.warn('[Chronicle] 年度正史生成失败:', e);
    });
  },

  /** 获取年度正史（UI 用） */
  getYearChronicle: function(year) {
    return ChronicleSystem.yearChronicles[year] || null;
  },

  /** 获取所有已生成年份 */
  getAvailableYears: function() {
    return Object.keys(ChronicleSystem.yearChronicles).map(Number).sort();
  },

  /** 标记已读 */
  markRead: function(year) {
    if (ChronicleSystem.yearChronicles[year]) {
      ChronicleSystem.yearChronicles[year].read = true;
    }
  },

  /** 序列化（存档用） */
  serialize: function() {
    return {
      monthDrafts: ChronicleSystem.monthDrafts,
      yearChronicles: ChronicleSystem.yearChronicles
    };
  },

  /** 反序列化（读档用） */
  deserialize: function(data) {
    if (!data) return;
    ChronicleSystem.monthDrafts = data.monthDrafts || {};
    ChronicleSystem.yearChronicles = data.yearChronicles || {};
  },

  /** 重置 */
  reset: function() {
    ChronicleSystem.monthDrafts = {};
    ChronicleSystem.yearChronicles = {};
  }
};

// ============================================================
// [MODULE: EndTurn] 子步骤函数
// ============================================================

// ============================================================
// 诏令文本自动提取（借鉴 ChongzhenSim appointmentEffects）
// 从玩家诏令中识别"任命X为Y""免去X""赐死X"并返回结构化操作
// ============================================================
/** @param {string} edictText @returns {{appointments:Array, dismissals:Array, deaths:Array}} */
function extractEdictActions(edictText) {
  if (!edictText || edictText.length < 4) return { appointments: [], dismissals: [], deaths: [] };
  var actions = { appointments: [], dismissals: [], deaths: [] };
  var text = edictText.replace(/\s+/g, '');

  // 任命模式：任命/擢升/改任 + 角色名 + 为/任 + 职位名
  var appointPatterns = [
    /(?:任命|擢升|擢任|改任|命|令|册封|册立|加封)(.{2,8})(?:为|任|出任|担任|兼任)(.{2,12})/g,
    /(.{2,8})(?:出任|担任|兼任|调任)(.{2,12})/g
  ];
  appointPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var charName = m[1].replace(/[，。、]/g, '');
      var posName = m[2].replace(/[，。、]/g, '');
      if (charName.length >= 2 && posName.length >= 2) {
        actions.appointments.push({ character: charName, position: posName });
      }
    }
  });

  // 免职模式
  var dismissPatterns = [
    /(?:免去|罢免|革去|撤去|免职|撤职|革职|削职)(.{2,8})(?:的)?(.{2,12})?/g,
    /(.{2,8})(?:免职|去职|撤职|革职|削职)/g
  ];
  dismissPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var charName = m[1].replace(/[，。、的]/g, '');
      if (charName.length >= 2) {
        actions.dismissals.push({ character: charName, position: m[2] ? m[2].replace(/[，。、]/g, '') : '' });
      }
    }
  });

  // 赐死模式
  var deathPatterns = [
    /(?:赐死|赐予自尽|处死|处斩|斩首|诛杀|赐鸩)(.{2,8})/g
  ];
  deathPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var charName = m[1].replace(/[，。、]/g, '');
      if (charName.length >= 2) {
        actions.deaths.push({ character: charName });
      }
    }
  });

  if (actions.appointments.length || actions.dismissals.length || actions.deaths.length) {
    _dbg('[Edict] 从诏令提取:', JSON.stringify(actions));
  }
  return actions;
}

/** 执行从诏令中提取的操作（在AI推演前执行，确保状态一致） */
function applyEdictActions(actions) {
  if (!actions) return;
  // 任命
  actions.appointments.forEach(function(a) {
    var char = findCharByName(a.character);
    if (!char) return;
    // 尝试在官制树中找到对应职位并任命
    if (typeof PostTransfer !== 'undefined' && GM.postSystem) {
      var post = null;
      (GM.postSystem.posts || []).forEach(function(p) { if (p.name === a.position) post = p; });
      if (post) {
        PostTransfer.seat(post.id, a.character, '玩家诏令');
        if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'appointment', '奉诏就任' + a.position);
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
          var _newCh = (GM.chars || []).find(function(c){ return c.name === a.character; });
          if (_newCh) CorruptionEngine.markAsRecentAppointment(_newCh);
        }
        addEB('人事', a.character + '奉诏就任' + a.position);
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
      }
    }
  });
  // 免职
  actions.dismissals.forEach(function(a) {
    if (typeof PostTransfer !== 'undefined') {
      PostTransfer.cascadeVacate(a.character);
      if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'dismissal', '奉诏免职');
      addEB('人事', a.character + '被免职');
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', -10, '被免职');
    }
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

/** Step 0: 初始化 — 重置系统、构建快照 */
function _endTurn_init() {
  _dbg('========== 回合结算开始 (T' + GM.turn + ') ==========');
  // RNG检查点（支持存档重放）
  if (typeof checkpointRng === 'function') checkpointRng();
  // 角色完整字段守卫（回合中若有新角色产生，下一回合始端补齐）
  try {
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function' && Array.isArray(GM.chars)) {
      CharFullSchema.ensureAll(GM.chars);
    }
  } catch(e) { console.error('[endTurn_init] CharFullSchema.ensureAll 失败:', e); }
  // 清空本回合机械结算暂存
  GM._turnBattleResults = [];
  GM._turnRebellionResults = [];
  GM._turnSiegeResults = [];
  GM._turnSchemeResults = [];
  AccountingSystem.resetLedger();
  var queueStats = ChangeQueue.getStats();
  _dbg('[endTurn] 变动队列状态:', queueStats);
  _dbg('[endTurn] 构建 NpcContext 快照...');
  var npcContext = buildNpcContext();
  _dbg('[endTurn] NpcContext 快照构建完成:', {
    characterCount: npcContext.characters.length,
    factionCount: npcContext.factions.length,
    variableCount: Object.keys(npcContext.variables).length,
    cacheSize: Object.keys(npcContext.cache).length
  });
  return npcContext;
}

/** NPC 对玩家诏令的即时反应 */
function _reactToEdicts(actions) {
  if (!GM.chars) return;

  // 任命反应：同势力/同党派的竞争者可能嫉妒
  actions.appointments.forEach(function(a) {
    var appointed = findCharByName(a.character);
    if (!appointed) return;
    GM.chars.forEach(function(rival) {
      if (rival.name === a.character || rival.isPlayer || rival.alive === false) return;
      // 同势力且野心高的角色嫉妒
      if (rival.faction && rival.faction === appointed.faction && (rival.ambition || 50) > 65) {
        rival.loyalty = Math.max(0, (rival.loyalty || 50) - 3);
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(rival.name, a.character, -5, '嫉妒其升迁');
        if (typeof StressSystem !== 'undefined') StressSystem.checkStress(rival, '屈居人下');
      }
      // 对立势力的角色可能不满
      if (rival.faction && rival.faction !== appointed.faction && (rival.loyalty || 50) < 40) {
        rival.loyalty = Math.max(0, (rival.loyalty || 50) - 2);
      }
    });
  });

  // 赐死反应：死者同党派/同势力的人忠诚下降
  actions.deaths.forEach(function(a) {
    var dead = findCharByName(a.character);
    if (!dead) return;
    GM.chars.forEach(function(c) {
      if (c.name === a.character || c.isPlayer || c.alive === false) return;
      if (c.faction && dead.faction && c.faction === dead.faction) {
        c.loyalty = Math.max(0, (c.loyalty || 50) - 5);
        if (typeof StressSystem !== 'undefined') StressSystem.checkStress(c, '同僚被诛');
      }
    });
  });
}

// ============================================================
// 2.3: 执行率情境分析（仅供AI prompt参考，不做机械折扣）
// 分析官僚体系各层级的执行能力，注入AI prompt让AI自行判断执行程度
// 阶段数和结构由 P.mechanicsConfig.executionPipeline 定义（编辑器可配）
// ============================================================
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
      handleEdictTextForRecruit(allEdictText).catch(function(e){ console.warn('[\u8BCF\u4EE4\u5F81\u8BCF] \u5F02\u5E38', e); });
    }
  } catch(_rE) { console.warn('[\u8BCF\u4EE4\u5F81\u8BCF]', _rE); }

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
  } catch(e) { console.error('[edict] 制度分流失败:', e); }

  return { summary: '', executionSummary: execResult.summary };
}

/** Step 1: 收集玩家输入 */
function _endTurn_collectInput() {
  var edicts={political:(_$("edict-pol")?_$("edict-pol").value:"").trim(),military:(_$("edict-mil")?_$("edict-mil").value:"").trim(),diplomatic:(_$("edict-dip")?_$("edict-dip").value:"").trim(),economic:(_$("edict-eco")?_$("edict-eco").value:"").trim(),other:(_$("edict-oth")?_$("edict-oth").value:"").trim()};
  // 记录玩家决策
  if (edicts.political) recordPlayerDecision('edict', '政令:' + edicts.political.substring(0, 80));
  if (edicts.military) recordPlayerDecision('edict', '军令:' + edicts.military.substring(0, 80));
  if (edicts.diplomatic) recordPlayerDecision('edict', '外交:' + edicts.diplomatic.substring(0, 80));
  if (edicts.economic) recordPlayerDecision('edict', '经济:' + edicts.economic.substring(0, 80));
  // 1.1: 诏令执行追踪——记录本回合所有诏令
  if (!GM._edictTracker) GM._edictTracker = [];
  var _edictCats = [{key:'political',label:'政令'},{key:'military',label:'军令'},{key:'diplomatic',label:'外交'},{key:'economic',label:'经济'},{key:'other',label:'其他'}];
  _edictCats.forEach(function(cat) {
    if (edicts[cat.key]) {
      GM._edictTracker.push({ id: uid(), content: edicts[cat.key], category: cat.label, turn: GM.turn, status: 'pending', assignee: '', feedback: '', progressPercent: 0 });
    }
  });
  // 清理超过10回合的旧追踪记录
  GM._edictTracker = GM._edictTracker.filter(function(e) { return GM.turn - e.turn < 10; });

  // 1.2: 诏令分流——检测涉及远方NPC的诏令，自动转为信件传递
  var _capital = GM._capital || '京城';
  GM._edictTracker.forEach(function(et) {
    if (et.turn !== GM.turn || et._deliveryChecked) return;
    et._deliveryChecked = true;
    // 扫描诏令文本中提及的NPC名
    var _remoteTargets = [];
    (GM.chars||[]).forEach(function(c) {
      if (c.alive === false || c.isPlayer) return;
      if (c.location && c.location !== _capital && et.content.indexOf(c.name) >= 0) {
        _remoteTargets.push(c);
      }
    });
    if (_remoteTargets.length > 0) {
      // 此诏令涉及远方NPC——标记为待送达，生成信件
      et._remoteTargets = _remoteTargets.map(function(c){ return c.name; });
      et._deliveryStatus = 'sending'; // sending/delivered/lost
      et._letterIds = [];
      var _ltType = et.category === '军令' ? 'military_order' : 'formal_edict';
      var _urgency = et.category === '军令' ? 'urgent' : 'normal';
      _remoteTargets.forEach(function(ch) {
        var toLoc = ch.location || _capital;
        var days = (typeof calcLetterDays === 'function') ? calcLetterDays(_capital, toLoc, _urgency) : 5;
        var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
        var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
        var letter = {
          id: (typeof uid === 'function') ? uid() : 'lt_' + Date.now() + '_' + Math.random(),
          from: '玩家', to: ch.name,
          fromLocation: _capital, toLocation: toLoc,
          content: '【' + et.category + '】' + et.content,
          sentTurn: GM.turn,
          deliveryTurn: GM.turn + deliveryTurns,
          replyTurn: GM.turn + deliveryTurns + Math.max(1, Math.ceil(days / dpv)),
          reply: '', status: 'traveling',
          urgency: _urgency,
          letterType: _ltType,
          _edictId: et.id, // 关联诏令
          _autoFromEdict: true // 标记为诏令自动生成
        };
        if (!GM.letters) GM.letters = [];
        GM.letters.push(letter);
        et._letterIds.push(letter.id);
        if (typeof addEB === 'function') addEB('诏令传书', '诏令「' + et.content.slice(0,20) + '…」已遣使致' + ch.name + '（' + toLoc + '）');
      });
    } else {
      // 诏令目标全部在京城，立即可执行
      et._deliveryStatus = 'local';
    }
  });

  // 主角行止（单一输入框）
  var xinglu = (_$("xinglu-pub") ? _$("xinglu-pub").value : "").trim() || (_$("xinglu") ? _$("xinglu").value : "").trim();
  // 行止记入玩家角色记忆
  if (xinglu && typeof NpcMemorySystem !== 'undefined' && P.playerInfo && P.playerInfo.characterName) {
    NpcMemorySystem.remember(P.playerInfo.characterName, xinglu, '\u5E73', 5);
  }
  var memRes=GM.memorials.map(function(m){return{from:m.from,type:m.type,status:m.status,reply:m.reply};});
  GM.qijuHistory.push({turn:GM.turn,time:getTSText(GM.turn),edicts:edicts,xinglu:xinglu,memorials:memRes});
  resetTurnChanges();
  // 注意：不在此处清空 _couplingReport/_edictExecutionReport/_buildingOutputReport/_npcIntents/_healthAlerts/_decisionAlerts
  // 这些字段由上一回合的 SettlementPipeline 设置，在本回合 AI prompt 中读取（"上回合发生了什么"）
  // 它们会在本回合的 SettlementPipeline 中被覆盖为新值
  var oldVars={};Object.entries(GM.vars).forEach(function(e){oldVars[e[0]]=e[1].value;});
  var input = {edicts:edicts,xinglu:xinglu,memRes:memRes,oldVars:oldVars,edictActions:null};
  // 宰相建议（供 AI prompt 参考）
  var chancellorSuggestions = generateChancellorSuggestions();
  if (chancellorSuggestions.length > 0) {
    input.suggestions = chancellorSuggestions;
  }

  // 从诏令文本中提取结构化操作（记录供AI推演参考，由AI决定执行效果）
  var allEdictText = [edicts.political, edicts.military, edicts.diplomatic, edicts.economic, edicts.other].join(' ');

  // 2.2→2.3: 收集执行管线信息注入AI prompt（不做机械效果，效果完全由AI判断）
  if (typeof processEdictEffects === 'function' && allEdictText.trim()) {
    var _edictCategory = edicts.political ? '政令' : edicts.military ? '军令' : edicts.diplomatic ? '外交' : edicts.economic ? '经济' : '';
    processEdictEffects(allEdictText, _edictCategory);
  }

  var edictActions = extractEdictActions(allEdictText);
  // 不再在AI推演前直接执行——改为将操作意图传给AI，由AI在推演中决定结果
  // AI推演后，npc_actions中会包含对这些操作的执行/抵制/变通
  if (edictActions.appointments.length || edictActions.dismissals.length || edictActions.deaths.length) {
    // 仅记录到事件日志供AI读取，不直接执行
    edictActions.appointments.forEach(function(a) { addEB('诏令意图', '欲任命' + a.character + '为' + a.position); });
    edictActions.dismissals.forEach(function(a) { addEB('诏令意图', '欲免职' + a.character); });
    edictActions.deaths.forEach(function(a) { addEB('诏令意图', '欲赐死' + a.character); });
  }

  // 从诏令中提取并存储自定义国策
  var customPols = extractCustomPolicies(allEdictText);
  if (customPols.length > 0) applyCustomPolicies(customPols);

  // NPC 对玩家诏令的即时反应（在 AI 推演前执行，让 AI 看到反应）
  if (edictActions.appointments.length > 0 || edictActions.dismissals.length > 0 || edictActions.deaths.length > 0) {
    _reactToEdicts(edictActions);
  }
  input.edictActions = edictActions;

  // 收集昏君活动
  if (typeof TyrantActivitySystem !== 'undefined') {
    input.tyrantActivities = TyrantActivitySystem.collectActivities();
  }

  // 勤政之苦 vs 怠政之乐——核心机制
  var _virtuousKeywords = /改革|整饬|肃清|减税|轻赋|赈灾|兴修|操练|整顿|巡查|督办|革弊|惩贪|开仓|抚民|科举|选贤|严查|问责|清查/;
  var _edictWordCount = allEdictText.length;
  if (P.playerInfo && P.playerInfo.characterName) {
    var _pCh = findCharByName(P.playerInfo.characterName);
    if (_pCh) {
      if (_edictWordCount > 30 && _virtuousKeywords.test(allEdictText)) {
        // 写了大量勤政诏令→压力增加（操心的代价）
        var _stressGain = Math.min(8, Math.floor(_edictWordCount / 30));
        _pCh.stress = clamp((_pCh.stress || 0) + _stressGain, 0, 100);
        _dbg('[勤政之苦] 诏令' + _edictWordCount + '字，压力+' + _stressGain);
      } else if (_edictWordCount < 5 && (!input.tyrantActivities || input.tyrantActivities.length === 0)) {
        // 什么都没做→轻微减压（偷懒的快乐）
        if ((_pCh.stress || 0) > 5) {
          _pCh.stress = clamp((_pCh.stress || 0) - 3, 0, 100);
          _dbg('[怠政之乐] 无所事事，压力-3');
        }
      }
    }
  }

  // 检测私人行动中的后宫互动——可能触发怀孕
  // 行止已统一为单输入框(xinglu-pub/xinglu)，不再区分public/private——直接扫描xinglu全文
  if (xinglu && GM.chars && typeof HaremSettlement !== 'undefined') {
    var _visitPattern = /幸(\S{1,4})|宠幸(\S{1,4})|召(\S{1,4})侍寝|与(\S{1,4})共度/;
    var _visitMatch = xinglu.match(_visitPattern);
    if (_visitMatch) {
      var _visitName = _visitMatch[1] || _visitMatch[2] || _visitMatch[3] || _visitMatch[4];
      var _visitCh = findCharByName(_visitName);
      if (_visitCh && _visitCh.spouse && _visitCh.alive !== false) {
        // 增加亲疏度
        if (typeof AffinityMap !== 'undefined' && P.playerInfo) {
          AffinityMap.add(P.playerInfo.characterName, _visitCh.name, 5, '\u5BA0\u5E78');
          // 其他妃嫔的嫉妒
          GM.chars.forEach(function(other) {
            if (other.spouse && other.alive !== false && other.name !== _visitCh.name) {
              AffinityMap.add(other.name, _visitCh.name, -3, '\u5AC9\u5992');
              if ((other.loyalty || 50) < 50) AffinityMap.add(other.name, P.playerInfo.characterName, -2, '\u88AB\u51B7\u843D');
            }
          });
        }
        // 小概率触发怀孕（未在孕期中）
        var _alreadyPreg = GM.harem && GM.harem.pregnancies && GM.harem.pregnancies.find(function(p) { return p.motherName === _visitCh.name; });
        if (!_alreadyPreg && random() < 0.15) {
          HaremSettlement.registerPregnancy(_visitCh.name);
        }
      }
    }
  }

  return input;
}

/** Step 2: AI 推演 — 调用 AI 生成时政记/正文/数值变化 */
async function _endTurn_aiInfer(edicts, xinglu, memRes, oldVars) {
  var shizhengji="",zhengwen="",playerStatus="",playerInner="",turnSummary="";
  // 新增字段：实录、时政记标题/总结、人事变动、后人戏说
  var shiluText="",szjTitle="",szjSummary="",personnelChanges=[],hourenXishuo="";
  var timeRatio = getTimeRatio();

  // 2. AI推演
  if(P.ai.key){
    // 严格史实模式：检索数据库
    if(P.conf.gameMode === 'strict_hist' && P.conf.refText) {
      showLoading("检索数据库中",20);
      await new Promise(resolve => setTimeout(resolve, 300)); // 模拟检索延迟
    }

    showLoading("\u6253\u5305\u6570\u636E",25);
    var sc=findScenarioById(GM.sid);
    var _shiluR=_getCharRange('shilu'),_shiluMin=_shiluR[0],_shiluMax=_shiluR[1];
    var _szjR=_getCharRange('szj'),_szjMin=_szjR[0],_szjMax=_szjR[1];
    var _hourenR=_getCharRange('houren'),_hourenMin=_hourenR[0],_hourenMax=_hourenR[1];
    var _zwR=_getCharRange('zw'),_zwMin=_zwR[0],_zwMax=_zwR[1]; // 兼容保留
    var _commentR=_getCharRange('comment');

    // ================================================================
    // AI Prompt 分层构建（优化后的段落顺序）
    // 层1: 世界态势（定向） → 层2: 玩家意图（指令） → 层3: 记忆上下文
    // → 层4: 辅助信息 → 层5: 输出指令
    // ================================================================

    // —— 诏令生命周期规则（中国施政真实模型，按本剧本的回合时长自适应） ——
  var _elRules = '';
  // 当前剧本每回合天数（玩家在编辑器设置）
  var _dpt = (P.time && P.time.daysPerTurn) || 30;
  var _turnDesc = _dpt <= 1 ? '日' : _dpt <= 7 ? ('周(约'+_dpt+'日)') : _dpt <= 31 ? ('月(约'+_dpt+'日)') : _dpt <= 95 ? ('季(约'+_dpt+'日)') : _dpt <= 200 ? ('半年(约'+_dpt+'日)') : _dpt <= 366 ? ('年('+_dpt+'日)') : ('约'+_dpt+'日');

  _elRules += '\n【诏令生命周期规则——中国施政真实模型（核心）】\n';
  _elRules += '  ※ 本剧本 1 回合 ≈ ' + _dpt + ' 日（' + _turnDesc + '）——推演必须按此真实时间跨度进行\n';
  _elRules += '  每条玩家诏令必须通过 edict_lifecycle_update 追踪 9 阶段生命周期：\n';
  _elRules += '    草拟→审议(门下封驳?)→颁布→传达(驿道时滞)→地方解读→执行→反馈→调整→沉淀\n';
  _elRules += '\n';
  _elRules += '  【诏令按真实时间（天）分类——自动换算为回合数】\n';
  _elRules += '    大赦恩诏 ≈ 7日；封赏 ≈ 10日；刑狱敕命 ≈ 14日——通常 1 回合内完成\n';
  _elRules += '    人事任免 ≈ 60日(赴任磨合)；对外战和谈判 ≈ 90日\n';
  _elRules += '    巡幸祭祀 ≈ 120日；减免/加征赋税 ≈ 180日(一征期)；军事动员征伐 ≈ 180日\n';
  _elRules += '    文教诏(兴学/修书) ≈ 730日(约2年)\n';
  _elRules += '    行政改革 ≈ 1095日(约3年)\n';
  _elRules += '    经济改革(变法) ≈ 3650日(约10年，分试点365日→推广730日→全国1095日→反扑730日→定局365日)\n';
  _elRules += '\n';
  _elRules += '  【回合适配原则——关键】\n';
  _elRules += '    · 若 1 回合 ≥ 诏令真实时长(如 1 回合 1 年对一道大赦) → 1 回合内推演完成整个生命周期\n';
  _elRules += '    · 若 1 回合 << 诏令真实时长(如 1 回合 1 天对改革) → 需跨多回合分阶段推演\n';
  _elRules += '    · 经济/行政改革在任何回合时长下都须表现为多阶段过程（至少区分推动期/反扑期）\n';
  _elRules += '    · 时间跨度大的回合(如 1 回合 1 年)仍应在单回合内体现阻力/变形/意外，但可一回合走完全部 9 阶段\n';
  _elRules += '    · 时间跨度小的回合(如 1 回合 1 月)要让生命周期自然铺开，不得仓促完结\n';
  _elRules += '\n';
  _elRules += '  【绝不"诏令下即全效"——必须有时滞、损耗、变形】\n';
  _elRules += '    例错：减赋颁布 → 当回合国库-X%、民心+Y\n';
  _elRules += '    例对：第1回合只是颁布；第2回合传达地方吏；第3回合实际执行，\n';
  _elRules += '           但发现地方胥吏截留三成，民间仅感受到减半；第4回合国库真正减少量比预期多，\n';
  _elRules += '           因为中饱私囊的吏员上下其手；第5回合部分地区才完成执行\n';
  _elRules += '\n';
  _elRules += '  【效果结构化公式】诏令实际效果 = 诏令意图 × 执行乘数，其中：\n';
  _elRules += '    执行乘数 = 执行者能力×0.25 + 执行者忠诚×0.15 + 吏治×0.15 + 诏令清晰度×0.15 - 阻力×0.25 + 时代相性×0.05\n';
  _elRules += '    能力按诏令类型选维度：经济类→management，军事类→military，人事/行政→administration，文教→intelligence\n';
  _elRules += '\n';
  _elRules += '  【利益集团阻力模型——必须考虑，不得忽视】\n';
  _elRules += '    减免赋税 → 阻力：地方胥吏30(截留) + 征税官20；副作用：中间盘剥使惠政打折\n';
  _elRules += '    加征加派 → 阻力：农民60 + 士绅40；副作用：民变酝酿(可能引发起义)\n';
  _elRules += '    清丈田亩 → 阻力：士绅85 + 豪强95 + 胥吏70；副作用：士绅联名抗争，官员辞官\n';
  _elRules += '    裁冗官 → 阻力：官僚70 + 被裁者90；副作用：士林不满，可能影响铨选\n';
  _elRules += '    削藩 → 阻力：宗室90、藩王80；副作用：可能引发靖难/七国之乱\n';
  _elRules += '    改土归流 → 阻力：土司75；副作用：土司起义\n';
  _elRules += '    开科取士 → 阻力：世家大族20；副作用：世家逐渐被寒门取代\n';
  _elRules += '\n';
  _elRules += '  【改革类 5 阶段生命周期】(reformPhase 字段)\n';
  _elRules += '    pilot 试点 → 选 1-2 州县先行；成功率高；样本数据可用\n';
  _elRules += '    expand 局部推广 → 扩到 3-5 省；各地执行参差；既得利益集团开始反应\n';
  _elRules += '    national 全国推广 → 全面铺开；阻力峰值；地方胥吏/豪强全面抵抗；可能出现执行变形\n';
  _elRules += '    backlash 反扑 → 推动者去位/党争中被翻案；玩家决策：坚持/妥协/废止\n';
  _elRules += '    outcome 定局 → 延续(成法)/废止/折中\n';
  _elRules += '\n';
  _elRules += '  【经济政策叙事范式——必须具体、真实】\n';
  _elRules += '    减免赋税：叙述"多少落到百姓头上、多少被胥吏截留、国库损失是否超出预期"\n';
  _elRules += '    兴修工程：叙述"工期进度、民力征集、贪腐情况、是否按期竣工或豆腐渣"\n';
  _elRules += '    征讨军事：叙述"粮草筹集、将帅任命、军心士气、是否应期开战、胜败经过"\n';
  _elRules += '    改革推行：叙述"试点何处、阻力何来、执行者是否称职、朝议反对声如何"\n';
  _elRules += '\n';
  _elRules += '  【阶层 satisfaction 联动】每回合通过 classesAffected 体现阶层情绪\n';
  _elRules += '    不得让某阶层情绪无因变化——必须由具体诏令/事件驱动\n';
  _elRules += '    阶层极度不满(<20) → 可能发生 peasant_revolt/elite_backlash/mutiny\n';
  _elRules += '\n';
  _elRules += '  【玩家介入窗口】每阶段结束给出 interventionOptions，玩家可：\n';
  _elRules += '    "加派干吏督办" "暂缓一州" "放弃" "更严苛执行"——通过下回合诏令体现\n';
  _elRules += '\n';
  _elRules += '  【诏令三轴反馈——必须填写】\n';
  _elRules += '    · classesAffected：影响的阶层及满意度变化（已有）\n';
  _elRules += '    · factionsAffected：外部势力对本诏令的反应（关系变化/态度转变）——如减轻赋税→周边势力可能轻视你；备战诏令→敌对势力警戒\n';
  _elRules += '    · partiesAffected：朝内党派对本诏令的态度（influence_delta + agenda_impact）——对立党派反对则其 influence 可能下降但 cohesion 强化\n';
  _elRules += '\n';
  _elRules += '  【反向反馈——执行效果受三系统制约】\n';
  _elRules += '    · 阶层严重不满(satisfaction<30 或 unrestLevels.strike<30) → 执行乘数 ×(1 - unrest/150)\n';
  _elRules += '    · 对立党派掌权(rival influence>60) → resistance 自动加 20-30；执行阶段易变形\n';
  _elRules += '    · 敌对势力敌视(attitude=敌视/敌对) → 外交/军事诏令可能被拒或激化\n';
  _elRules += '    · 执行者的 class/party 与诏令对象冲突 → 自动消极怠工\n';

  // ── 起义系统（长周期历史模拟） ──
  _elRules += '\n【起义系统——长周期历史模拟】\n';
  _elRules += '  起义不是一次性事件，而是 7 阶段生命周期：brewing酝酿 → uprising首义 → expansion扩张 → stalemate相持 → turning转折 → decline/establishment衰落或建政 → ending结局\n';
  _elRules += '  每回合 AI 必须通过 revolt_update 推进现有起义的阶段——不得让起义"静默"不进展；若无事发生写入 narrative 说明原因（如"困守某山，无力南下"）\n';
  _elRules += '\n  【起义必备字段——必须真实可考】\n';
  _elRules += '    · ideology(意识形态)：religious(宗教:黄巾道/白莲教) / dynastic(光复某朝) / ethnic(反清复明等) / populist(均田免粮) / nobleClaim(宗室分支) / warlord(军阀) / tributary(边疆民族)\n';
  _elRules += '    · organizationType(组织)：flowingBandit(流寇李自成式) / baseArea(根据地红巾式) / builtState(建制太平天国式) / secretSociety(教门白莲式) / militaryMutiny(军变安史式)\n';
  _elRules += '    · slogan 必有——真实起义都有口号：如"苍天已死黄天当立"、"均田免粮"、"驱逐鞑虏恢复中华"、"无处不均匀"\n';
  _elRules += '    · historicalArchetype(历史原型)——写出本起义最贴近的历史参照：黄巾/黄巢/红巾/白莲/太平天国/义和团/安史/三藩/靖难/八王\n';
  _elRules += '\n  【前兆-爆发-演进规律——AI 必须遵守】\n';
  _elRules += '    · 严重起义前须有 2-4 回合 revolt_precursor 前兆：famine饥荒/landConcentration兼并/heavyTax苛税/corvee繁役/officialCorruption贪腐/propheticOmen谶纬/secretSociety教门密谋\n';
  _elRules += '    · 前兆 severity=critical 且阶层 unrestLevels.revolt<20 → 下回合可 class_revolt\n';
  _elRules += '    · 无任何前兆直接爆发巨乱 → AI 行为异常，除非是军变/宗室叛乱(militaryMutiny/nobleClaim 可突发)\n';
  _elRules += '\n  【阶段推进原则（按 organizationType 决定节奏）】\n';
  _elRules += '    · flowingBandit：uprising→expansion 快，但无根据地则 stalemate/decline 也快（补给枯竭）\n';
  _elRules += '    · baseArea：expansion 慢但稳；进入 stalemate 后可据守多回合，考验朝廷耐心\n';
  _elRules += '    · builtState：若 territoryControl>3 城 + 存续>5 回合 → 必须 revolt_transform toFaction（独立建国）\n';
  _elRules += '    · secretSociety：扩张靠传教渗透，军事薄弱但社会基础广；易被分化\n';
  _elRules += '    · militaryMutiny：起势最猛，但政治基础薄弱，易 turning\n';
  _elRules += '\n  【镇压 vs 招安——朝廷选择】\n';
  _elRules += '    · 起义规模小(scale=小) + 粮草不足(supplyStatus<30) → 宜 revolt_suppress 剿灭\n';
  _elRules += '    · 起义规模大 + 占领多城 → 宜 revolt_amnesty 招安分化（宋江故事）\n';
  _elRules += '    · 宗教性起义 → 很难招安（黄巾、白莲教），须坚决剿\n';
  _elRules += '    · 军阀/藩镇 → 多次招安反复（如唐代藩镇）\n';
  _elRules += '\n  【建政触发——重要】\n';
  _elRules += '    · 当 revolt.phase=establishment 且 _needTransform=true → AI 下回合必须 revolt_transform type=toFaction，自动创建新势力\n';
  _elRules += '    · 当 revolt 摧毁京城、俘虏/杀死玩家角色、控制全国→可 type=dynastyReplaced（玩家GAMEOVER）\n';
  _elRules += '\n  【领袖处理】\n';
  _elRules += '    · 起义领袖能力由 ideology 决定：religious 高 charisma+intelligence；warlord 高 military+valor；populist 高 benevolence；nobleClaim 高 administration\n';
  _elRules += '    · 副将(secondaryLeaders)常有 2-4 人：如黄巢之秦彦、李自成之刘宗敏、洪秀全之杨秀清\n';
  _elRules += '    · 领袖阵亡大概率导致 decline（除非已建立完整政权）\n';
  _elRules += '\n  【诏令反馈起义】\n';
  _elRules += '    · 减赋/赈灾诏令 → 对应 precursor 的 famine/heavyTax 缓解，起义 supplyStatus 不升（百姓不投奔）\n';
  _elRules += '    · 加征/募兵诏令在起义区 → 反令起义 militaryStrength+（逼反更多人）\n';
  _elRules += '    · 招安诏令→ 生成 revolt_amnesty 动作\n';
  _elRules += '    · 剿匪诏令→ 生成 revolt_suppress 动作\n';
  // 剧本作者预设的诏令风格与样本（让AI以本朝代之体裁推演）
  if (P.edictConfig && P.edictConfig.enabled !== false) {
    if (P.edictConfig.styleNote) {
      _elRules += '\n  【本朝代诏令风格】' + P.edictConfig.styleNote + '\n';
    }
    if (Array.isArray(P.edictConfig.examples) && P.edictConfig.examples.length > 0) {
      _elRules += '  【本剧本典型诏令参考】——推演时可借鉴以下阻力生态\n';
      P.edictConfig.examples.slice(0, 6).forEach(function(ex) {
        if (!ex) return;
        var line = '    · ';
        if (ex.category) line += '[' + ex.category + ']';
        if (ex.content) line += ex.content.slice(0, 40);
        if (ex.expectedResistance) line += '；预期阻力：' + ex.expectedResistance;
        if (ex.typicalOpposition) line += '；典型反对：' + ex.typicalOpposition;
        if (ex.typicalSupporter) line += '；典型支持：' + ex.typicalSupporter;
        if (ex.historicalOutcome) line += '；史例结局：' + ex.historicalOutcome;
        _elRules += line + '\n';
      });
    }
  }

  tp += _elRules;

  // —— 推演依据分层说明（告诉AI如何解读输入数据） ——
    var tp = '';
    tp += '【推演依据——本回合推演基于以下五层数据，请综合推演】\n';
    tp += '  A. 玩家国家行动：下方【诏令】段是君主本回合颁布的正式政令，其执行效果取决于执行者能力、忠诚、局势阻力\n';
    tp += '  B. 玩家私人行动：下方【主角行止】段是君主的个人举止(微服/读书/饮宴/私见等)，影响情绪与人物关系\n';
    tp += '  C. 玩家对NPC的意志表达：下方【批准/驳回/留中的奏疏】【朝议记录】【问对记录】体现君主对臣下诉求的态度，NPC会据此调整下一步行为\n';
    tp += '  D. NPC/势力自主行动：本回合各角色/势力按各自性格、野心、处境自主行动——不受玩家直接控制，但受A/B/C间接影响\n';
    tp += '  E. 世界背景与因果：历史回顾摘要、时代阶段、灾异、往期未解问题——作为推演约束条件\n';
    tp += '  原则：A+B驱动事件，C促使NPC反馈，D推动世界自行演进，E限制可能性边界。\n\n';

    // —— 层0: 问天系统——玩家对AI的直接指令（最高优先级） ——
    if (GM._playerDirectives && GM._playerDirectives.length > 0) {
      tp += '【问天——玩家对推演AI的直接指令（最高优先级，必须遵守）】\n';
      var _rules = GM._playerDirectives.filter(function(d) { return d.type === 'rule'; });
      var _corrections = GM._playerDirectives.filter(function(d) { return d.type === 'correction'; });
      var _others = GM._playerDirectives.filter(function(d) { return d.type !== 'rule' && d.type !== 'correction'; });
      if (_rules.length > 0) {
        tp += '【持久规则——每回合必须遵守】\n';
        _rules.forEach(function(r) { tp += '  · ' + r.content + '\n'; });
      }
      if (_corrections.length > 0) {
        tp += '【纠正——本回合调整后可移除】\n';
        _corrections.forEach(function(c) { tp += '  · ' + c.content + '\n'; });
        // 纠正类指令执行后自动移除
        GM._playerDirectives = GM._playerDirectives.filter(function(d) { return d.type !== 'correction'; });
      }
      if (_others.length > 0) {
        tp += '【玩家补充内容/指令】\n';
        _others.forEach(function(o) { tp += '  · ' + o.content + '\n'; });
      }
      tp += '\n';
    }
    // 导入的记忆/文档
    if (GM._importedMemories && GM._importedMemories.length > 0) {
      tp += '【玩家导入的外部记忆/文档——作为推演背景参考】\n';
      GM._importedMemories.forEach(function(m) {
        if (m.type === 'memory' && m.target) {
          tp += '  [' + m.target + '的记忆] ' + (m.content||'').slice(0, 500) + '\n';
        } else {
          tp += '  [' + (m.title||'文档') + '] ' + (m.content||'').slice(0, 1000) + '\n';
        }
      });
      tp += '\n';
    }

    // —— 层1: 世界态势（让 AI 先理解当前局势）——
    tp += "\u7B2C"+GM.turn+"\u56DE\u5408\u3002"+getTSText(GM.turn)+"\n\n";
    tp += buildAIContext(true); // deepMode=true: 天下大势 + 关键人物 + 核心资源 + 重要关系（完整不截断）
    if(GM.eraState && GM.eraState.contextDescription) {
      tp += "\u65F6\u4EE3:" + GM.eraState.dynastyPhase + " \u7EDF\u4E00:" + Math.round((GM.eraState.politicalUnity||0)*100) + "% \u96C6\u6743:" + Math.round((GM.eraState.centralControl||0)*100) + "% \u7A33\u5B9A:" + Math.round((GM.eraState.socialStability||0)*100) + "% \u7ECF\u6D4E:" + Math.round((GM.eraState.economicProsperity||0)*100) + "%\n";
      tp += GM.eraState.contextDescription + "\n";
    }
    // 季节/时令（增加叙事的时间感）
    var _perTurn = P.time && P.time.perTurn || '1m';
    if (_perTurn !== '1d') {
      var _seasonIdx = 0;
      if (P.time && P.time.startMonth) {
        var _curMonth = ((P.time.startMonth - 1 + (GM.turn - 1) * (_perTurn === '1m' ? 1 : _perTurn === '1s' ? 3 : 12)) % 12) + 1;
        _seasonIdx = _curMonth <= 3 ? 0 : _curMonth <= 6 ? 1 : _curMonth <= 9 ? 2 : 3;
      }
      var _seasonHints = [
        '春：万物复苏，农事初起，人心思动',
        '夏：炎暑酷热，边患多发，瘟疫需防',
        '秋：丰收在望，秋决行刑，科举开考',
        '冬：天寒地冻，驻防艰难，年关将至'
      ];
      tp += _seasonHints[_seasonIdx] + '\n';
    }

    // 时间刻度提示——让AI知道一回合流逝多久，从而合理调整变量变化量
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var _turnDesc = '本回合=' + _dpv + '天';
    if (_dpv === 1) _turnDesc += '（日级）。变量变化应极小。';
    else if (_dpv <= 7) _turnDesc += '（周级）。变量变化应很小。';
    else if (_dpv <= 30) _turnDesc += '（月级）。变量变化应为月级幅度。';
    else if (_dpv <= 90) _turnDesc += '（季级）。变量变化应为季度级幅度。';
    else _turnDesc += '（年级）。变量变化应为年度级幅度。';
    _turnDesc += ' 计算公式：月结算值÷30×' + _dpv + '天。';
    if (_turnDesc) {
      tp += '\u3010\u65F6\u95F4\u523B\u5EA6\u3011' + _turnDesc + '\n';
      tp += '  resource_changes\u4E2D\u7684\u6570\u503C\u5E94\u4E0E\u6B64\u65F6\u95F4\u5C3A\u5EA6\u5339\u914D\u3002\u4F8B\u5982\uFF1A\u82E5\u6BCF\u5E74\u7A0E\u6536\u4E3A1000\uFF0C\u6BCF\u56DE\u5408=1\u6708\u5219\u6BCF\u56DE\u5408\u53D8\u5316\u7EA6+83\uFF1B\u82E5\u6BCF\u56DE\u5408=1\u5E74\u5219+1000\u3002\n';
      tp += '  \u7EA7\u8054\u601D\u7EF4\uFF1Aresource_changes\u5E94\u8003\u8651\u53D8\u91CF\u95F4\u7684\u8FDE\u9501\u5F71\u54CD\u3002\u4F8B\u5982\uFF1A\n';
      tp += '    \u51CF\u7A0E\u2192\u56FD\u5E93\u6536\u5165\u964D\u2192\u519B\u997F\u53EF\u80FD\u4E0D\u8DB3\u2192\u58EB\u6C14\u53EF\u80FD\u4E0B\u964D\n';
      tp += '    \u5927\u5174\u571F\u6728\u2192\u56FD\u5E93\u652F\u51FA\u589E\u2192\u6C11\u529B\u758F\u8017\u2192\u6C11\u5FC3\u53EF\u80FD\u4E0B\u964D\n';
      tp += '    \u5F00\u6218\u2192\u5175\u529B\u6D88\u8017+\u7CAE\u8349\u6D88\u8017+\u8D22\u653F\u538B\u529B\u2192\u591A\u4E2A\u53D8\u91CF\u540C\u65F6\u53D8\u5316\n';
      tp += '    \u8BF7\u5728resource_changes\u4E2D\u4E00\u6B21\u6027\u4F53\u73B0\u6240\u6709\u7EA7\u8054\u5F71\u54CD\uFF0C\u800C\u4E0D\u662F\u53EA\u6539\u4E00\u4E2A\u53D8\u91CF\u3002\n';
      tp += '  \u3010\u52A8\u6001\u53D8\u91CF\u521B\u5EFA\u3011resource_changes\u53EF\u4EE5\u5F15\u7528\u4E0D\u5B58\u5728\u7684\u53D8\u91CF\u540D\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u521B\u5EFA\u3002\u7528\u9014\uFF1A\n';
      tp += '    - \u5236\u5EA6\u6539\u9769\u8FDB\u5EA6\uFF1A\u5982 "\u52DF\u5175\u5236\u6539\u9769\u8FDB\u5EA6":+10\uFF0C\u6BCF\u56DE\u5408\u63A8\u8FDB\uFF0C\u8FBE\u5230100\u89C6\u4E3A\u5B8C\u6210\n';
      tp += '    - \u7279\u6B8A\u8D44\u6E90\uFF1A\u5982 "\u6218\u9A6C\u50A8\u5907":+500\uFF0C\u8BB0\u5F55\u7279\u5B9A\u8D44\u6E90\u7684\u79EF\u7D2F\n';
      tp += '    - \u4E34\u65F6\u72B6\u6001\uFF1A\u5982 "\u7626\u75AB\u4E25\u91CD\u7A0B\u5EA6":+30\uFF0C\u8FFD\u8E2A\u4E34\u65F6\u5C40\u52BF\n';
    }

    // —— 机械结算结果注入（战斗引擎/补给等确定性结果，AI不可更改数字）——
    var _mechResults = [];
    if (typeof BattleEngine !== 'undefined' && BattleEngine._getConfig().enabled) {
      var _battlePrompt = BattleEngine.getPromptInjection();
      if (_battlePrompt) _mechResults.push(_battlePrompt);
    }
    if (typeof getSupplyPromptInjection === 'function') {
      var _supplyPrompt = getSupplyPromptInjection();
      if (_supplyPrompt) _mechResults.push(_supplyPrompt);
    }
    // 叛乱结果
    if (GM._turnRebellionResults && GM._turnRebellionResults.length > 0) {
      var _rebLines = ['【叛乱发生（不可更改）】'];
      GM._turnRebellionResults.forEach(function(r) {
        _rebLines.push('  ' + r.rebelLeader + '(' + r.rebel + ')忠诚仅' + r.loyalty + '，举旗叛离' + r.liege + '。已建立战争状态。');
        _rebLines.push('  → 请叙事叛乱经过：起因、宣言、盟友反应、民间态度。');
      });
      _mechResults.push(_rebLines.join('\n'));
    }
    // 双层国库状态
    if (P.economyConfig && P.economyConfig.dualTreasury) {
      var _tLine = '【国库/内库】国库:' + (GM.stateTreasury||0) + ' 内库:' + (GM.privateTreasury||0);
      if ((GM._bankruptcyTurns||0) > 0) _tLine += ' ⚠ 财政危机第' + GM._bankruptcyTurns + '回合';
      _mechResults.push(_tLine);
    }
    if (typeof MarchSystem !== 'undefined' && MarchSystem._getConfig().enabled) {
      var _marchPrompt = MarchSystem.getPromptInjection();
      if (_marchPrompt) _mechResults.push(_marchPrompt);
    }
    if (typeof SiegeSystem !== 'undefined' && SiegeSystem._getConfig().enabled) {
      var _siegePrompt = SiegeSystem.getPromptInjection();
      if (_siegePrompt) _mechResults.push(_siegePrompt);
    }
    // D1-D4: 外交/阴谋/决策
    if (typeof CasusBelliSystem !== 'undefined') {
      var _cbPrompt = CasusBelliSystem.getPromptInjection();
      if (_cbPrompt) _mechResults.push(_cbPrompt);
    }
    if (typeof TreatySystem !== 'undefined') {
      var _treatyPrompt = TreatySystem.getPromptInjection();
      if (_treatyPrompt) _mechResults.push(_treatyPrompt);
    }
    if (typeof SchemeSystem !== 'undefined') {
      var _schemePrompt = SchemeSystem.getPromptInjection();
      if (_schemePrompt) _mechResults.push(_schemePrompt);
    }
    if (typeof DecisionSystem !== 'undefined') {
      var _decPrompt = DecisionSystem.getPromptInjection();
      if (_decPrompt) _mechResults.push(_decPrompt);
    }
    // 5.2: 军队行军状况注入
    if (GM._marchReport) {
      _mechResults.push('\u3010\u519B\u961F\u884C\u519B\u72B6\u51B5\u3011' + GM._marchReport + '\n\u884C\u519B\u4E2D\u7684\u519B\u961F\u53EF\u88AB\u4F0F\u51FB\uFF0CAI\u5E94\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u884C\u519B\u8FC7\u7A0B\u3002');
    }
    // 5.4: 外交使团任务注入
    if (GM._diplomaticMissions && GM._diplomaticMissions.length > 0) {
      var _activeMissions = GM._diplomaticMissions.filter(function(m){return m.status!=='completed'&&m.status!=='failed';});
      if (_activeMissions.length > 0) {
        var _diploLines = ['\u3010\u5916\u4EA4\u4F7F\u56E2\uFF08AI\u5E94\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u8C08\u5224\u8FDB\u7A0B\uFF0C\u5E76\u5728edict_feedback\u4E2D\u8FD4\u56DE\u7ED3\u679C\uFF09\u3011'];
        _activeMissions.forEach(function(m) {
          var envoy = typeof findCharByName === 'function' ? findCharByName(m.envoy) : null;
          var diploScore = envoy ? (envoy.diplomacy||50) : 50;
          var line = '\u4F7F\u81E3' + m.envoy + '(\u5916\u4EA4' + diploScore + ')\u51FA\u4F7F' + m.target + '\uFF0C\u8981\u6C42\uFF1A' + m.terms;
          if (m.bottomLine) line += '\uFF08\u5E95\u7EBF\uFF1A' + m.bottomLine + '\uFF09';
          line += ' \u72B6\u6001:' + m.status;
          _diploLines.push(line);
        });
        _diploLines.push('\u4F7F\u81E3\u5916\u4EA4\u80FD\u529B\u5F71\u54CD\u8C08\u5224\u6548\u679C\u3002AI\u5728\u53D9\u4E8B\u4E2D\u63CF\u5199\u8C08\u5224\u8FC7\u7A0B\uFF0C\u5728edict_feedback\u4E2D\u7528status=completed/failed\u8FD4\u56DE\u7ED3\u679C\u3002');
        _mechResults.push(_diploLines.join('\n'));
      }
    }
    // 5.6: 制度改革——通过变量系统追踪（AI可在resource_changes中动态创建/推进改革进度变量）
    var _reformVars = [];
    Object.keys(GM.vars).forEach(function(k) {
      if (/改革|变法|新政|过渡/.test(k) && GM.vars[k].value > 0 && GM.vars[k].value < 100) {
        _reformVars.push(k + ':' + Math.round(GM.vars[k].value) + '%');
      }
    });
    if (_reformVars.length > 0) {
      _mechResults.push('\u3010\u5236\u5EA6\u6539\u9769\u8FDB\u5EA6\u3011' + _reformVars.join('\uFF1B') + '\u3002AI\u5E94\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u6539\u9769\u8FDB\u5C55\u548C\u963B\u529B\uFF0C\u901A\u8FC7resource_changes\u63A8\u8FDB\u6216\u56DE\u9000\u8FDB\u5EA6\u3002\u8FBE\u5230100\u65F6\u89C6\u4E3A\u6539\u9769\u5B8C\u6210\u3002');
    }
    // 地方区划/漂移摘要
    if (GM.provinceStats) {
      var _provLines = [];
      Object.keys(GM.provinceStats).forEach(function(pn) {
        var p = GM.provinceStats[pn];
        if (!p) return;
        var issues = [];
        if (p.corruption > 60) issues.push('贪腐'+Math.round(p.corruption));
        if (p.unrest > 40) issues.push('民变'+Math.round(p.unrest));
        if (p.stability < 40) issues.push('不稳'+Math.round(p.stability));
        if (issues.length > 0) _provLines.push('  ' + pn + ': ' + issues.join(' ') + (p.governor ? ' 主官:'+p.governor : ''));
      });
      if (_provLines.length > 0) _mechResults.push('【省份问题】\n' + _provLines.join('\n'));
    }
    // 关隘信息
    if (P.map && P.map.regions) {
      var _passLines = [];
      P.map.regions.forEach(function(r) {
        if (r.passLevel && r.passLevel > 0) {
          _passLines.push('  ' + (r.passName || r.name) + ': ' + r.passLevel + '级关隘 控制者:' + (r.occupiedBy || r.owner || '无'));
        }
      });
      if (_passLines.length > 0) _mechResults.push('【关隘要塞】\n' + _passLines.join('\n'));
    }
    // 法理冲突
    if (typeof hasDejureClaim === 'function' && P.adminHierarchy) {
      var _dejureLines = [];
      function _scanDejure(divs) {
        divs.forEach(function(d) {
          if (d.dejureOwner) {
            var _actualOwner = d.governor ? ((typeof findCharByName==='function'?findCharByName(d.governor):null)||{}).faction||'' : '';
            if (_actualOwner && _actualOwner !== d.dejureOwner) {
              _dejureLines.push('  ' + d.name + ': 法理归' + d.dejureOwner + ' 实控' + _actualOwner + ' →潜在冲突');
            }
          }
          if (d.children) _scanDejure(d.children);
        });
      }
      Object.keys(P.adminHierarchy).forEach(function(fid) {
        var ah = P.adminHierarchy[fid];
        if (ah && ah.divisions) _scanDejure(ah.divisions);
      });
      if (_dejureLines.length > 0) _mechResults.push('【法理争议】\n' + _dejureLines.join('\n'));
    }
    if (_mechResults.length > 0) {
      tp += '\n' + _mechResults.join('\n') + '\n';
    }

    // —— 层2: 玩家意图（诏令 + 行录 + 奏疏批复）——
    var _hasEdicts = edicts.political || edicts.military || edicts.diplomatic || edicts.economic || edicts.other;
    var _hasTyrant = GM._turnTyrantActivities && GM._turnTyrantActivities.length > 0;
    tp += "\n\u3010\u8BCF\u4EE4\u3011\n";
    if (!_hasEdicts && !_hasTyrant) {
      // 玩家什么都没做——无为而治，叙事应该让这种"不作为"感觉舒适
      tp += '（本回合帝王未颁发任何诏令，也未有特别行止。）\n';
      tp += '※ 叙事提示：描写一种"岁月静好"的氛围——朝堂自行运转，帝王乐得清闲。\n';
      tp += '  player_inner基调：轻松惬意，"什么都不做也挺好的……天下太平嘛"。\n';
      tp += '  忠臣们可能焦虑（"陛下为何不理政？"），但这种焦虑不要传染给玩家——\n';
      tp += '  让玩家觉得他们大惊小怪就好。\n';
    }
    // 诏令注入——标注每条诏令的送达状态
    var _edictLines = [
      {label:'\u653F',text:edicts.political,cat:'政令'},
      {label:'\u519B',text:edicts.military,cat:'军令'},
      {label:'\u5916',text:edicts.diplomatic,cat:'外交'},
      {label:'\u7ECF',text:edicts.economic,cat:'经济'},
      {label:'\u5176\u4ED6',text:edicts.other,cat:'其他'}
    ];
    _edictLines.forEach(function(el) {
      if (!el.text) return;
      tp += el.label + ':' + el.text + '\n';
      // 查找此诏令的edictTracker条目，标注送达状态
      var _matched = (GM._edictTracker||[]).filter(function(et) {
        return et.turn === GM.turn && et.category === el.cat && et.content === el.text;
      });
      _matched.forEach(function(et) {
        if (et._remoteTargets && et._remoteTargets.length > 0) {
          tp += '  ⚠ 此令涉及远方NPC：' + et._remoteTargets.join('、') + '——已遣信使传递，当前在途。\n';
          tp += '  → 这些NPC本回合尚未收到此令，不可能按旨行事。AI必须在edict_feedback中标注status:"pending_delivery"。\n';
          tp += '  → 只有信使送达后（后续回合），该NPC才知晓此令并可能执行。\n';
        }
      });
    });
    if(xinglu){
      tp+="\u3010\u4E3B\u89D2\u884C\u6B62\u3011\uFF08\u73A9\u5BB6\u89D2\u8272\u672C\u56DE\u5408\u7684\u4E2A\u4EBA\u884C\u52A8\uFF0C\u4E0E\u8BCF\u4E66\u4E92\u8865\u2014\u2014\u8BCF\u4E66\u662F\u5143\u9996\u53D1\u53F7\u65BD\u4EE4\uFF0C\u884C\u6B62\u662F\u89D2\u8272\u4E2A\u4EBA\u7684\u4E3E\u52A8\uFF09\n"+xinglu+"\n";
    }
    // 注入昏君活动上下文
    if (typeof TyrantActivitySystem !== 'undefined' && GM._turnTyrantActivities && GM._turnTyrantActivities.length > 0) {
      tp += TyrantActivitySystem.getAIContext(GM._turnTyrantActivities);
    }
    // 奏疏批复（让AI知道玩家如何处理大臣上书）
    var approvedMem = memRes.filter(function(m){return m.status==='approved';});
    var rejectedMem = memRes.filter(function(m){return m.status==='rejected';});
    var reviewMem = memRes.filter(function(m){return m.status==='pending_review';});
    if(approvedMem.length>0){
      tp+="\u6279\u51C6\u7684\u594F\u758F:\n";
      approvedMem.forEach(function(m){ tp+="  "+m.from+"("+m.type+")——准奏"+(m.reply?" 批注:"+m.reply:"")+"\n"; });
    }
    if(rejectedMem.length>0){
      tp+="\u9A73\u56DE\u7684\u594F\u758F:\n";
      rejectedMem.forEach(function(m){ tp+="  "+m.from+"("+m.type+")——驳回"+(m.reply?" 批注:"+m.reply:"")+"\n"; });
    }
    if(reviewMem.length>0){
      tp+="\u7559\u4E2D\u4E0D\u53D1:" + reviewMem.map(function(m){return m.from;}).join("、")+"\n";
      tp+='  留中的政治含义：皇帝对此事不表态——上折者不知道皇帝看了没看，焦虑等待。\n';
    }
    // 留中超期的奏疏——NPC焦虑
    var _heldMems = (GM.memorials||[]).filter(function(m) { return m.status === 'pending_review'; });
    _heldMems.forEach(function(hm) {
      var _heldTurns = GM.turn - (hm._arrivedTurn || hm.turn || GM.turn);
      if (_heldTurns >= 2) {
        tp += '  ' + hm.from + '的奏疏已留中' + _heldTurns + '回合——此人可能焦虑续奏追问或当面求见\n';
      }
    });
    // 密折vs题本——其他NPC的知晓范围
    var _thisTurnMems = (GM.memorials||[]).filter(function(m) { return m.turn === GM.turn; });
    var _publicMems = _thisTurnMems.filter(function(m) { return m.subtype !== '密折' && m.subtype !== '密揭'; });
    var _secretMems = _thisTurnMems.filter(function(m) { return m.subtype === '密折' || m.subtype === '密揭'; });
    if (_publicMems.length > 0) {
      tp += '【公开奏疏——其他NPC知道谁上了折子（但不知内容）】\n';
      tp += '  ' + _publicMems.map(function(m){ return m.from + '上' + (m.type||'') + '折'; }).join('、') + '\n';
      tp += '  其他NPC可能猜测内容、打探消息、据此调整行为。\n';
    }
    if (_secretMems.length > 0) {
      tp += '【密折——其他NPC完全不知此人上了折子】\n';
      tp += '  ' + _secretMems.map(function(m){ return m.from; }).join('、') + '上了密折——其他NPC不应对此有任何反应\n';
    }
    // 批转追踪——被批转的折子，被批转者应在下回合回复
    var _referredMems = (GM._approvedMemorials||[]).filter(function(a) { return a.action === 'referred' && a.referredTo && a.turn === GM.turn; });
    if (_referredMems.length > 0) {
      tp += '【批转追踪——被指定议处者应在下回合奏疏中回复意见】\n';
      _referredMems.forEach(function(rm) {
        tp += '  ' + rm.from + '的' + (rm.type||'') + '折被批转给' + rm.referredTo + '——' + rm.referredTo + '必须在下回合上折回复议处意见\n';
      });
    }
    // 远方奏疏的批复回传状态——影响NPC是否知道批复结果
    var _remoteApproved = (GM._approvedMemorials||[]).filter(function(a) { return a.turn === GM.turn; });
    var _remoteMems = GM.memorials ? GM.memorials.filter(function(m) { return m._remoteFrom && (m.status !== 'pending' && m.status !== 'pending_review'); }) : [];
    if (_remoteMems.length > 0) {
      tp += '【远方奏疏批复回传状态】\n';
      _remoteMems.forEach(function(m) {
        var _replyArrived = m._replyDeliveryTurn && GM.turn >= m._replyDeliveryTurn;
        tp += '  ' + m.from + '（' + (m._remoteFrom||'远方') + '）所奏——' + (m.status||'') + '：';
        if (_replyArrived) {
          tp += '朱批已送达，' + m.from + '已知结果\n';
        } else if (m._replyLetterSent) {
          tp += '朱批回传中（信使在途），' + m.from + '尚不知批复结果\n';
        } else {
          tp += '批复尚未回传\n';
        }
      });
      tp += '  → 未收到批复的远方NPC应继续按原有判断行事，不应体现批复后的行为变化\n';
    }
    // 在途/截获的奏疏（NPC已发但玩家未收到）
    var _transitMems = (GM._pendingMemorialDeliveries||[]).filter(function(m) { return m.status === 'in_transit' || m.status === 'intercepted'; });
    if (_transitMems.length > 0) {
      tp += '【在途/截获的奏疏——玩家未收到】\n';
      _transitMems.forEach(function(m) {
        if (m.status === 'intercepted') {
          var _waitTurns = GM.turn - (m._generatedTurn||GM.turn);
          // 合理往返时间 = 去程回合数 × 2 + 2回合批阅缓冲
          var _expectedRound = ((m._deliveryTurn||0) - (m._generatedTurn||0)) * 2 + 2;
          var _overdue = _waitTurns - _expectedRound;
          tp += '  ' + m.from + '（' + (m._remoteFrom||'远方') + '）的奏疏被' + (m._interceptedBy||'敌方') + '截获——玩家不知此折存在\n';
          tp += '    内容涉及：' + (m.content||'').slice(0,60) + '\n';
          tp += '    → ' + m.from + '以为折子已送到，已等' + _waitTurns + '回合（合理往返约' + _expectedRound + '回合）\n';
          if (_overdue > 0) {
            tp += '    → 【间接线索要求·已超期' + _overdue + '回合】此NPC应通过npc_letters来函提及"臣前日所上奏疏不知圣意如何""折子不知是否送达"——给玩家暗示有折子没到\n';
          }
          if (_overdue > Math.ceil(_expectedRound * 0.5)) {
            tp += '    → 【自行决断·严重超期】此NPC可能已就奏疏中的事务自行处置，并在来函中说明"臣久候无旨，事不宜迟，已先行处置"\n';
          }
        } else {
          tp += '  ' + m.from + '（' + (m._remoteFrom||'远方') + '）的奏疏在途中，预计' + (m._deliveryTurn - GM.turn) + '回合后到达\n';
        }
      });
    }

    // 信使截获+旁听情报——敌方已获知的情报及其可能行动
    if (GM._interceptedIntel && GM._interceptedIntel.length > 0) {
      var _recentIntel = GM._interceptedIntel.filter(function(i) { return (GM.turn - i.turn) <= 3; });
      if (_recentIntel.length > 0) {
        tp += '\u3010\u654C\u65B9\u60C5\u62A5\u2014\u2014\u4EE5\u4E0B\u4FE1\u606F\u5DF2\u88AB\u654C\u65B9\u638C\u63E1\uFF0C\u5FC5\u987B\u5F71\u54CD\u5176\u884C\u4E3A\u3011\n';
        _recentIntel.forEach(function(i) {
          if (i.urgency === 'eavesdrop') {
            tp += '  T' + i.turn + ' ' + i.interceptor + '\u65C1\u542C\u83B7\u77E5\uFF1A' + (i.content || '') + '\n';
          } else if (i.urgency === 'forged') {
            tp += '  T' + i.turn + ' ' + (i.content || '') + '\n';
          } else {
            var _ltTypeMap = {secret_decree:'密旨',military_order:'征调令',greeting:'问安函',personal:'私函',proclamation:'檄文'};
            var _ltTypeName = (i.letterType && _ltTypeMap[i.letterType]) ? '（' + _ltTypeMap[i.letterType] + '）' : '';
            tp += '  T' + i.turn + ' ' + i.interceptor + '\u622A\u83B7\u4FE1\u4EF6' + _ltTypeName + '\uFF1A' + (i.from||'\u7687\u5E1D') + '\u81F4' + i.to + '\u201C' + (i.content || '') + '\u201D';
            if (i.militaryRelated) tp += ' [\u519B\u4E8B\u76F8\u5173\u2192\u654C\u65B9\u53EF\u80FD\u8C03\u5175\u9632\u5907/\u8BBE\u4F0F]';
            if (i.diplomaticRelated) tp += ' [\u5916\u4EA4\u76F8\u5173\u2192\u654C\u65B9\u53EF\u80FD\u7834\u574F\u8054\u76DF/\u62C9\u62E2\u7B2C\u4E09\u65B9]';
            tp += '\n';
          }
        });
        // 未送达信件——收信人不知道命令
        if (GM._undeliveredLetters && GM._undeliveredLetters.length > 0) {
          var _recentUndel = GM._undeliveredLetters.filter(function(u) { return (GM.turn - u.turn) <= 2; });
          if (_recentUndel.length > 0) {
            tp += '  \u3010\u672A\u9001\u8FBE\u7684\u547D\u4EE4\u3011\u4EE5\u4E0BNPC\u672A\u6536\u5230\u7687\u5E1D\u6307\u4EE4\uFF0C\u4E0D\u4F1A\u6309\u6307\u4EE4\u884C\u52A8\uFF1A\n';
            _recentUndel.forEach(function(u) {
              tp += '    ' + u.to + '\u672A\u6536\u5230\u201C' + (u.content||'').slice(0, 50) + '\u201D\n';
            });
          }
        }
        tp += '  AI\u5FC5\u987B\u5728faction_events\u548Cnpc_actions\u4E2D\u53CD\u6620\u654C\u65B9\u636E\u60C5\u62A5\u91C7\u53D6\u7684\u5177\u4F53\u884C\u52A8\n';
      }
    }

    // 旁听泄露——正式问对中的话题已被特定NPC获知，影响其行为
    if (GM._eavesdroppedTopics && GM._eavesdroppedTopics.length > 0) {
      var _thisEaves = GM._eavesdroppedTopics.filter(function(e) { return e.turn === GM.turn; });
      if (_thisEaves.length > 0) {
        tp += '\u3010\u65C1\u542C\u6CC4\u9732\u2014\u2014\u4EE5\u4E0BNPC\u5DF2\u77E5\u6653\u95EE\u5BF9\u5185\u5BB9\uFF0C\u5FC5\u987B\u5F71\u54CD\u5176\u884C\u4E3A\u3011\n';
        _thisEaves.forEach(function(e) {
          tp += '  \u7687\u5E1D\u4E0E' + e.target + '\u8BAE\u201C' + e.topic + '\u201D';
          if (e.leakedTo && e.leakedTo.length > 0) {
            tp += ' \u2192 \u6CC4\u9732\u7ED9\uFF1A' + e.leakedTo.join('\u3001');
          }
          tp += '\n';
        });
        tp += '  \u8981\u6C42\uFF1A\u83B7\u77E5\u4FE1\u606F\u7684NPC\u5FC5\u987B\u5728\u672C\u56DE\u5408\u4F53\u73B0\u53CD\u5E94\u2014\u2014\n';
        tp += '    \u91CE\u5FC3\u5BB6\u636E\u6B64\u63E3\u6D4B\u7687\u5E1D\u610F\u56FE\u5E76\u5E03\u5C40\uFF1B\u5FE0\u81E3\u4E3B\u52A8\u4E0A\u4E66\u8868\u6001\uFF1B\u5BF9\u7ACB\u6D3E\u63D0\u524D\u53CD\u5236\uFF1B\u9634\u8C0B\u5BB6\u5229\u7528\u4FE1\u606F\u63A8\u8FDB\u8BA1\u5212\n';
      }
    }

    // NPC承诺追踪（问对中NPC做的承诺，应在推演中验证兑现或暴露失信）
    if (GM._npcClaims && GM._npcClaims.length > 0) {
      var _unverified = GM._npcClaims.filter(function(c) { return !c.verified && (GM.turn - c.turn) <= 5; });
      if (_unverified.length > 0) {
        tp += '\u3010NPC\u672A\u5151\u73B0\u7684\u627F\u8BFA\u2014\u2014\u63A8\u6F14\u4E2D\u5E94\u4F53\u73B0\u5151\u73B0\u6216\u5931\u4FE1\u3011\n';
        _unverified.forEach(function(c) {
          tp += '  T' + c.turn + ' ' + c.from + '\u627F\u8BFA\uFF1A' + (c.content || '').slice(0, 80) + '\n';
        });
      }
    }
    // 本回合问对内容（让AI知道玩家在问对中获得的信息和NPC的承诺）
    if (GM.jishiRecords && GM.jishiRecords.length > 0) {
      var _thisWendui = GM.jishiRecords.filter(function(j) { return j.turn === GM.turn && j.char; });
      if (_thisWendui.length > 0) {
        tp += '\u3010\u672C\u56DE\u5408\u95EE\u5BF9\u8BB0\u5F55\u2014\u2014NPC\u7684\u627F\u8BFA\u548C\u8A00\u8BBA\u5E94\u5728\u63A8\u6F14\u4E2D\u4F53\u73B0\u3011\n';
        _thisWendui.forEach(function(j) {
          tp += '  \u53EC\u89C1' + (j.char || '') + '\uFF1A\u73A9\u5BB6\u8BF4\u201C' + (j.playerSaid || '') + '\u201D\u2192NPC\u7B54\u201C' + (j.npcSaid || '') + '\u201D\n';
        });
      }
    }

    // 问对中的赏罚记录——由AI判断具体影响（忠诚/压力/威望等变化量）
    if (GM._wdRewardPunish && GM._wdRewardPunish.length > 0) {
      var _thisRp = GM._wdRewardPunish.filter(function(r) { return r.turn === GM.turn; });
      if (_thisRp.length > 0) {
        tp += '【问对中的赏罚——AI必须在char_updates中反映对应影响】\n';
        _thisRp.forEach(function(r) {
          var _dtl = {gold:'赐金',robe:'赐衣',feast:'赐宴',promote:'许以加官',fine:'罚俸',demote:'降职',imprison:'下狱',cane:'杖责'};
          tp += '  ' + r.target + '：' + (r.type==='reward'?'赏赐':'处罚') + '——' + (_dtl[r.detail]||r.detail) + '\n';
        });
        tp += '  赏赐影响：根据赏赐轻重+NPC性格判断loyalty_delta/stress_delta/ambition_delta。赐金小恩小惠(+2~5)，赐宴减压，赐衣荣耀感。贪婪者对赐金更敏感，清高者可能不以为然。\n';
        tp += '  处罚影响：根据处罚轻重+NPC性格判断。罚俸轻(-2~5)，杖责重(-5~10+压力)，下狱极重(-10~20+压力+可能叛心)。刚直者被罚后可能更忠(以受罚为荣)，阴险者积怨报复。\n';
      }
    }

    // —— 层3: 记忆上下文（历史纪要 + 近期要事 + 人物履历 + 玩家轨迹）——
    var memoryContext = getMemoryAnchorsForAI(8);
    if(memoryContext) tp += "\n" + memoryContext;
    if (GM.chronicleAfterwords && GM.chronicleAfterwords.length > 0) {
      var lastAft = GM.chronicleAfterwords[GM.chronicleAfterwords.length - 1];
      tp += "\u3010\u4E0A\u56DE\u56DE\u987E\u3011\n" + lastAft.summary + "\n";
    }

    // —— 层4: 辅助信息（宰辅建言 + 官制 + 科举 + 地图 + 参考）——
    var suggestions = generateChancellorSuggestions();
    if (suggestions.length > 0) {
      tp += "\n\u3010\u5BB0\u8F85\u5EFA\u8A00\u3011\n";
      suggestions.forEach(function(s) { tp += '  ' + s.from + '(' + s.type + ')：' + s.text + '\n'; });
    }
    // 问对摘要注入（让AI叙事能引用玩家与大臣的对话）
    if (GM.wenduiHistory) {
      var wdNames = Object.keys(GM.wenduiHistory);
      if (wdNames.length > 0) {
        var wdSummary = '';
        wdNames.forEach(function(name) {
          var msgs = GM.wenduiHistory[name];
          if (msgs && msgs.length > 0) {
            var recent = msgs.slice(-4); // 最近4条（2轮对话）
            wdSummary += '  ' + name + '：' + recent.map(function(m) {
              var who = (m.role === 'player' || m.role === 'user') ? '帝' : '臣';
              return who + '曰"' + (m.content || '').substring(0, 60) + '"';
            }).join(' → ') + '\n';
          }
        });
        if (wdSummary) {
          tp += '\n【近期问对】\n' + wdSummary;
        }
      }
    }

    // E4: 上回合全部已处理奏疏注入——AI必须体现因果延续
    if (GM._approvedMemorials && GM._approvedMemorials.length > 0) {
      var _prevProcessed = GM._approvedMemorials.filter(function(m) { return m.turn === GM.turn - 1; });
      if (_prevProcessed.length > 0) {
        tp += '\n\u3010\u4E0A\u56DE\u5408\u594F\u758F\u5904\u7406\u7ED3\u679C\u2014\u2014\u672C\u56DE\u5408\u5FC5\u987B\u4F53\u73B0\u56E0\u679C\u5EF6\u7EED\u3011\n';
        var _actionLabels = { approved:'\u51C6\u594F', rejected:'\u9A73\u56DE', annotated:'\u6279\u793A', referred:'\u8F6C\u6709\u53F8', court_debate:'\u53D1\u5EF7\u8BAE' };
        _prevProcessed.forEach(function(m) {
          var act = _actionLabels[m.action] || '\u51C6\u594F';
          tp += '  ' + (m.from||'') + '\u594F\u8BF7' + (m.type||'') + '\uFF1A' + (m.content||'');
          tp += ' \u2192 \u7687\u5E1D' + act;
          if (m.reply) tp += '\uFF0C\u6731\u6279\uFF1A' + m.reply;
          tp += '\n';
          // 因果提示
          if (m.action === 'approved') tp += '    \u2192 \u672C\u56DE\u5408\u5E94\u6709\u6267\u884C\u8FDB\u5C55\u6216\u65B0\u95EE\u9898\u7684\u594F\u62A5\n';
          else if (m.action === 'rejected') tp += '    \u2192 \u5FE0\u81E3\u53EF\u80FD\u7EED\u594F\u6B7B\u8C0F\uFF0C\u4F5E\u81E3\u53EF\u80FD\u6000\u6068\u6697\u4E2D\u6D3B\u52A8\n';
          else if (m.action === 'annotated') tp += '    \u2192 \u5B98\u5458\u5E94\u6309\u6279\u793A\u610F\u89C1\u6267\u884C\u5E76\u56DE\u594F\u7ED3\u679C\n';
          else if (m.action === 'referred') tp += '    \u2192 \u8BE5\u8861\u95E8\u4E3B\u5B98\u672C\u56DE\u5408\u5E94\u4E0A\u594F\u8BAE\u5904\u7ED3\u8BBA\n';
          else if (m.action === 'court_debate') tp += '    \u2192 \u672C\u56DE\u5408\u671D\u8BAE\u4E2D\u5E94\u8BA8\u8BBA\u6B64\u4E8B\n';
        });
      }
    }

    // E2: 考课结果注入（让AI在叙事中反映考课影响）
    if (GM._annualReviewHistory && GM._annualReviewHistory.length > 0) {
      var _lastReview = GM._annualReviewHistory[GM._annualReviewHistory.length - 1];
      if (GM.turn - _lastReview.turn <= 1) {
        tp += '\n【年度考课结果（叙事中应体现）】\n';
        tp += '优等' + _lastReview.excellent + '人，劣等' + _lastReview.poor + '人';
        if (_lastReview.promotions.length > 0) tp += '，建议擢升：' + _lastReview.promotions.join('、');
        if (_lastReview.demotions.length > 0) tp += '，建议左迁：' + _lastReview.demotions.join('、');
        tp += '\n';
      }
    }

    // N4: 主角精力注入（全范围——精力影响叙事基调）
    if (GM._energy !== undefined) {
      var _enRatio = GM._energy / (GM._energyMax || 100);
      if (_enRatio < 0.3) tp += '\n【君主精力严重不足(' + Math.round(GM._energy) + '/' + (GM._energyMax||100) + ')——叙事体现疲惫、判断力下降、易怒或恍惚】\n';
      else if (_enRatio < 0.5) tp += '\n【君主略显疲态(' + Math.round(GM._energy) + '/' + (GM._energyMax||100) + ')——叙事可暗示处理政务稍显迟缓】\n';
      else if (_enRatio > 0.9) tp += '\n【君主精力充沛——叙事可体现神采奕奕、决断果敢】\n';
    }

    // P14: 成就里程碑注入（让AI在叙事中呼应玩家成就）
    if (GM._achievements && GM._achievements.length > 0) {
      var _recentAch = GM._achievements.filter(function(a) { return GM.turn - a.turn <= 2; });
      if (_recentAch.length > 0) {
        tp += '\n【近期里程碑——可在叙事中自然体现】\n';
        _recentAch.forEach(function(a) { tp += '  · ' + a.name + '：' + a.desc + '\n'; });
      }
    }

    // E10: 世代传承事件注入
    if (GM._successionEvent) {
      tp += '\n【重大事件——帝位更迭（必须在叙事中浓墨重彩描写）】\n';
      tp += '先帝' + GM._successionEvent.from + '驾崩（原因：' + (GM._successionEvent.reason||'未知') + '），';
      tp += '新君' + GM._successionEvent.to + '已继位。朝堂震动，群臣观望。\n';
      delete GM._successionEvent; // 只注入一次
    }

    // ═══════════════════════════════════════════════════════════════════
    // 【玩家圣意·本回合·次高优先级】（低于上方"问天"直接指令·高于常规背景）
    // 汇总玩家通过朝议/科议/诏令/奏疏/问对作出的治国决策·
    // AI 推演须：(1) 叙事必回应 (2) 相关 NPC 必响应 (3) 执行受挫必交代原因
    // 不可假装没发生·但可根据现实（财政/距离/史实/人员）推演成功/部分/受阻/失败
    // ═══════════════════════════════════════════════════════════════════
    tp += '\n\n═══ 【玩家圣意·次高优先级】═══\n';
    tp += '以下是本回合玩家通过正常治国手段作出的决策·必须在推演中得到体现与响应：\n';
    tp += '※ 此级别低于上方"问天"直接指令·但高于一切常规背景。推演效果可受现实约束·但不得被忽略。\n';
    tp += '※ 每条决策须在回合输出的各字段中体现——例如：\n';
    tp += '    · zhengwen（时政记·当月朝堂叙事）要有对应段落说明诏令颁行、朝议落实、奏疏批复执行情况\n';
    tp += '    · events（事件/实录）要记下引发的重大动作（如派员、起兵、征召、工程开工）\n';
    tp += '    · npc_actions（后人戏说/个人行止）要让相关官员作出对应响应（推进/抵制/规避/上疏申辩）\n';
    tp += '    · edict_feedback（数值变化说明）要给出受挫/成功的原因与影响\n';
    tp += '※ 不必采用固定模板·分工呈现即可；但不得假装没发生·不得让玩家决策淹没在背景叙事中。\n\n';

    // ═══════════════════════════════════════════════════════════════════
    // 【叙事-状态同步·核心原则】——推演叙事必须落回真实游戏数据
    // ═══════════════════════════════════════════════════════════════════
    tp += '\n═══ 【叙事-状态同步·核心原则】═══\n';
    tp += '※ 凡推演叙事中描写的"实际发生的变化"·均须通过对应的语义通道落回游戏状态字段·不得只停留在文字描述：\n';
    tp += '  · 皇帝赐名/改名 X 为 Y → char_updates:[{name:"X",updates:{name:"Y",原名:"X"}}]·同步刷新 careerHistory 标题\n';
    tp += '  · 玩家改官职名（例"户部尚书"→"度支令"）→ anyPathChanges 改 P.officeTree 对应节点·并对所有 officialTitle==旧名 的 char 同步 char_updates.updates.officialTitle\n';
    tp += '  · 授官 → office_assignments:[{name,post,dept,action:"appoint",toLocation?,reason}]·若需赴任则留走位；同时 careerEvent 自动追加，无需单独写\n';
    tp += '  · 罢免/贬谪/外放 → office_assignments action:"dismiss"/"transfer"；如外放须 toLocation+走位\n';
    tp += '  · 封爵/赐号/追谥 → char_updates.updates 里更新 title/爵位/封号·并 careerEvent 记录\n';
    tp += '  · 赐死/诛戮/抄家 → char_updates.updates.alive:false 或 onDismissal reason:"execute"\n';
    tp += '  · 新设/裁撤衙门 → anyPathChanges 改 P.officeTree；同时建立/解除对应 publicTreasury 绑定\n';
    tp += '  · 财政调整（赐金/征发/专款）→ fiscal_adjustments:[{target:"guoku/neitang/province:X",kind:"income/expense",amount,item,reason}]·不得只写"拨银若干"而不落账\n';
    tp += '  · 势力/党派/阶层/区域变化 → faction_updates / party_updates / class_updates / region_updates\n';
    tp += '  · 工程/运动/战役启动 → project_updates 保存进度；相应 fiscal_adjustments 记支出\n';
    tp += '  · 任何其他深层字段（人物属性、忠诚、好感、记忆、派系关系、异象、科举阶段等）→ anyPathChanges op:"set/delta/push/merge"\n';
    tp += '※ 叙事与数据一一对应·宁可不写·不可写而不改·也不可改而不叙。zhengwen/events 里出现的"实际变化"在本回合结束时必须真的落到 GM 状态。\n';
    tp += '※ 连锁义务：授某人为某官 → 该官 officialTitle 必新；给官职改名 → 所有持此官者同步改名；移驻某地 → location+_travelTo；仕途 careerHistory 必须追加（appoint/transfer/dismiss 类动作自动写入·但 AI 若写了"赐进太师衔"之类额外身份也要手动 careerEvent）。\n\n';

    // ═══════════════════════════════════════════════════════════════════
    // 【执行阻力·代价约束·非机械原则】
    // ═══════════════════════════════════════════════════════════════════
    tp += '═══ 【执行阻力与代价约束·非机械原则】═══\n';
    tp += '※ 【阻力原则·核心】AI 推演必须尽可能给玩家制造阻力——阻力必须合理·符合逻辑·符合剧本历史背景·符合官场/人情/派系现实·不曲解玩家意思。\n';
    tp += '    · 决不可让玩家决策一帆风顺——多数真诏令在真实历史上都会遇到：人事阻力、财政掣肘、党争反扑、言路封驳、下情不达、阳奉阴违、吏治败坏、地方观望\n';
    tp += '    · 但阻力必须正当——不得无中生有·不得违反当时历史风俗·不得莫名其妙地抵制合情合理的政策·不得让清明盛世也遍地抗旨\n';
    tp += '    · 玩家原本意图要忠实解读——不得故意曲解玩家字面意思去制造阻力（如玩家说"赐银五千"·AI不得硬说"玩家要征收"）\n';
    tp += '    · 阻力程度随当下朝局：盛世吏治清明时阻力温和·末世党争激烈时阻力巨大·改革变法时必有既得利益反扑\n';
    tp += '※ 玩家核心决策（诏令/玩家行止/鸿雁传书/奏折批示/廷议/科议/朝议）的执行效果·必须严格受制于：\n';
    tp += '    ① 财政能力（帑廪/内帑/地方库存是否支撑此举）\n';
    tp += '    ② 官僚执行力（对应衙门是否健全·主官是否在任·吏治腐败度）\n';
    tp += '    ③ 人物意愿（被命令者的忠诚·派系·个人利益·健康·年岁）\n';
    tp += '    ④ 派系博弈（他党是否会阻挠·言路是否封驳·抗疏有无）\n';
    tp += '    ⑤ 资源/时间/距离约束（路程天数·物资筹措·季节·天气·战事）\n';
    tp += '※ 严禁机械执行玩家指令——必须如实反馈：成功/部分成功/受挫/失败/反效果·并说明具体原因。\n';
    tp += '※ 决策代价原则：任何决策都必须匹配对应的代价、收益与风险——没有免费的午餐·每一纸诏书都要有后果。\n';
    tp += '    · 大赦 → 刑狱空转/士绅震怒/治安短期滑坡\n';
    tp += '    · 加税 → 财政增长但民心下滑/流民增多/风险民变\n';
    tp += '    · 任用亲信 → 派系失衡·他党反弹·言路抗疏\n';
    tp += '    · 征发徭役/兵役 → 人口减损·生产下滑·逃亡\n';
    tp += '    · 改革 → 既得利益集团抵制·执行层打折·长期收益需数回合才显\n';
    tp += '※ 禁止人物建议/发言超出其能力、人设、阵营立场——文官不应给出专业军事部署·武将不应精通金融改革·清流不应建言党同伐异·阉党不应倡导宽刑省狱。\n';
    tp += '※ NPC 行为完全受其性格、利益、派系、忠诚度驱动——可能出现（且应在 npc_actions 中体现）：\n';
    tp += '    · 叛变·通敌·私通外镇\n';
    tp += '    · 抗命·告病·托疾不行·阳奉阴违\n';
    tp += '    · 暗杀·构陷·下毒·阴谋\n';
    tp += '    · 结盟·串联·拜门·密谋\n';
    tp += '    · 挂冠·致仕·归隐\n';
    tp += '    · 上疏抗辩·伏阙请命·集体抗疏\n';
    tp += '※ 这些行为须经过合理动机链条（忠诚低+派系冲突+利益受损 → 抵制；野心高+机会窗口 → 结党）·不是为了戏剧性而戏剧性。\n\n';

    // 朝议记录注入（让AI知道本回合谁在朝议中主张了什么——叙事必须保持一致）
    //   targetTurn == GM.turn 的记录算"影响本回合"：
    //   · phase='post-turn' 的是"月初朔朝"（上回合过回合时所开）
    //   · phase='in-turn' 的是"月中常朝/廷议"（本回合内所开）
    if (GM._courtRecords && GM._courtRecords.length > 0) {
      var _recentCourt = GM._courtRecords.filter(function(r) { return (r.targetTurn || r.turn) === GM.turn; });
      if (_recentCourt.length > 0) {
        tp += '\n【本回合朝议记录——叙事中必须与此一致，NPC的观点不能自相矛盾】\n';
        tp += '【双朝会时序】本月可能有"朔朝(月初)"+"常朝/廷议(月中)"两场——若月中决议覆盖/修改了朔朝决议，视为圣意调整，NPC 可记"朝纲反复"或"圣心独断"。\n';
        tp += '【退朝后余波——必须在npc_actions中体现】\n';
        tp += '  朝议结束后，持不同立场的官员会私下串联：支持者互相强化、反对者密谋对策、中间派观望。\n';
        tp += '  采纳方的提议者应积极推进落实，未被采纳方可能暗中抵制或转向求助皇帝（上奏疏）。\n';
        _recentCourt.forEach(function(cr) {
          var _phaseLbl = cr.phase === 'post-turn' ? '【朔朝·月初】' : '【月中】';
          if (cr.mode === 'keyi') _phaseLbl = '【科议·廷推】';
          tp += _phaseLbl + '议题：' + cr.topic + '\n';
          Object.keys(cr.stances).forEach(function(name) {
            var s = cr.stances[name];
            tp += '  ' + name + '：' + s.stance + '——' + s.brief + '\n';
          });
          if (cr.adopted && cr.adopted.length > 0) {
            tp += '  采纳：' + cr.adopted.map(function(a) { return a.author + '之议（' + a.content + '）'; }).join('；') + '\n';
            tp += '  ※ 朝议共识已形成→执行压力：提议被采纳的官员有责任推动落实，反对者不得公开阻挠（可暗中抵制）。\n';
            tp += '  ※ edict_feedback中应体现朝议决议的执行情况。npc_actions中提议者应积极推进。\n';
          } else {
            tp += '  结果：搁置，未采纳任何提议——各方可能继续私下串联推动自己的方案\n';
          }
          // 科议特殊说明
          if (cr.mode === 'keyi' && cr._keyiMeta) {
            var km = cr._keyiMeta;
            tp += '  ※ 科议类型: ' + km.methodLabel + '·支持率 ' + Math.round((km.support||0)*100) + '%·门槛 ' + (km.threshold||50) + '%\n';
            if (km.method === 'edict' || km.method === 'defy') {
              tp += '  ※ 皇帝不顾多数意见强推科举，反对大臣应在 npc_actions 中体现不满（上疏、串联、私下议论、消极抵制）\n';
              if ((km.opposingMinisters||[]).length > 0) tp += '    主要反对者: ' + km.opposingMinisters.slice(0,5).join('、') + '\n';
              if ((km.opposingParties||[]).length > 0) tp += '    反对党派: ' + km.opposingParties.join('、') + '（影响度已下降）\n';
            }
            if (km.method === 'council') {
              tp += '  ※ 科举顺朝议而开，礼部/吏部应积极配合，士林振奋\n';
            }
          }
          // 御前密议泄密风险
          if (cr._secret) {
            tp += '  ⚠ 此为御前密议——内容不应为朝臣所知。但参与者中若有人忠诚低(<40)或与敌对派系有关联，可能泄密。\n';
            tp += '  泄密应通过npc_actions(behaviorType:"leak")或npc_correspondence体现，给不在场的NPC传递密议内容。\n';
            var _leakRisk = (cr.participants||[]).filter(function(pn) {
              var _pc = findCharByName(pn);
              return _pc && ((_pc.loyalty||50) < 40 || (_pc.ambition||50) > 75);
            });
            if (_leakRisk.length > 0) tp += '  泄密高风险者：' + _leakRisk.join('、') + '\n';
          }
        });
      }
      // 常朝快速裁决（如果有）
      if (GM._lastChangchaoDecisions && GM._lastChangchaoDecisions.length > 0) {
        tp += '\n【常朝裁决——本回合快速决策，必须在edict_feedback/npc_actions中体现执行】\n';
        GM._lastChangchaoDecisions.forEach(function(d) {
          var _lbl = { approve: '准', reject: '驳', discuss: '转廷议', hold: '留', ask: '追问' };
          tp += '  ' + (_lbl[d.action]||d.action) + '：' + (d.dept||'') + '所奏' + (d.title||'') + '\n';
        });
        tp += '  ※ "准"的事务等同诏令，应在edict_feedback中报告执行情况。"驳"的事务不得执行。\n';
      }
      // 常朝频率对政治的影响
      var _ccCount = GM._chaoyiCount || {};
      var _recentCC = 0;
      for (var _t = Math.max(0, GM.turn - 5); _t <= GM.turn; _t++) { if (_ccCount[_t]) _recentCC += _ccCount[_t]; }
      if (_recentCC === 0 && GM.turn > 3) {
        tp += '\n【帝不临朝——已' + GM.turn + '回合未开常朝】百官焦虑，忠臣可能在npc_actions中上疏谏请临朝。\n';
      } else if (_recentCC >= 8) {
        tp += '\n【帝勤政——近5回合开朝' + _recentCC + '次】威望+，但可能被认为事必躬亲不放权。\n';
      }
      // 上回合的朝议（以 targetTurn 为准）
      var _prevCourt = GM._courtRecords.filter(function(r) { return (r.targetTurn || r.turn) === GM.turn - 1; });
      if (_prevCourt.length > 0) {
        tp += '\n【上回合朝议（NPC应记得自己的立场）】\n';
        _prevCourt.forEach(function(cr) {
          tp += '议题：' + cr.topic + '，';
          var stanceList = Object.keys(cr.stances).map(function(n) { return n + ':' + cr.stances[n].stance; });
          tp += stanceList.join('、') + '\n';
        });
      }
    }

    // 国策上下文
    var policyCtx = getCustomPolicyContext();
    if (policyCtx) tp += '\n' + policyCtx;

    // 官制摘要（让AI知道政府结构和空缺职位）
    if (GM.officeTree && GM.officeTree.length > 0) {
      var _govLines = ['【官制概要】'];
      var _vacantCount = 0, _filledCount = 0;
      (function _wGov(nodes, prefix) {
        nodes.forEach(function(n) {
          var pList = (n.positions || []).map(function(p) {
            if (p.holder) { _filledCount++; return p.name + ':' + p.holder; }
            else { _vacantCount++; return p.name + ':空缺'; }
          });
          if (pList.length > 0) _govLines.push('  ' + (prefix || '') + n.name + ' — ' + pList.join('、'));
          if (n.subs) _wGov(n.subs, (prefix || '') + n.name + '/');
        });
      })(GM.officeTree, '');
      if (_govLines.length > 1) {
        _govLines.push('  （在任' + _filledCount + '人，空缺' + _vacantCount + '个——空缺影响行政效率）');
        tp += '\n' + _govLines.join('\n') + '\n';
      }
    }

    // 官制职能分工（让AI知道哪个部门管哪些事——推演中必须遵守）
    var _funcSummary = getOfficeFunctionSummary();
    if (_funcSummary) tp += '\n' + _funcSummary + '\n';

    // 行政区划摘要（让AI知道地方治理状况）——按中国式管辖层级分组
    if (P.adminHierarchy) {
      // 先派生 autonomy（若尚未派生）
      if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();
      var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
      var _grouped = { zhixia:[], fanguo:[], fanzhen:[], jimi:[], chaogong:[], external:[] };
      var _totalDiv = 0, _govDiv = 0;
      Object.keys(P.adminHierarchy).forEach(function(fk) {
        var fh = P.adminHierarchy[fk];
        if (!fh || !fh.divisions) return;
        var _fac = (GM.facs || []).find(function(f) { return f.name === fh.name || f.name === fk; });
        fh.divisions.forEach(function(d) {
          _totalDiv++;
          if (d.governor) _govDiv++;
          var au = d.autonomy;
          if (!au || !au.type) {
            au = (typeof deriveAutonomy === 'function') ? deriveAutonomy(d, _fac, _playerFac) : { type: 'zhixia' };
          }
          var grp = au.type || 'external';
          var _line = '  ' + d.name + (d.type ? '(' + d.type + ')' : '') + ' 长官:' + (d.governor || '空缺');
          if (au.holder) {
            _line += ' 受封者:' + au.holder;
            if (au.subtype) _line += '(' + (au.subtype === 'real' ? '实封' : '虚封') + ')';
            if (au.loyalty !== undefined) _line += ' 忠' + au.loyalty;
            if (au.tributeRate) _line += ' 贡' + Math.round(au.tributeRate*100) + '%';
          }
          if (_grouped[grp]) _grouped[grp].push(_line);
        });
      });
      if (_totalDiv > 0) {
        tp += '\n【疆域管辖层级——遵中国古代政治制度】\n';
        var _grpLabels = {
          zhixia:   '京畿直辖（郡县制）——皇权直达，流官三年一考',
          fanguo:   '分封藩国——宗室/功臣受封；实封有兵权，虚封仅食邑',
          fanzhen:  '藩镇自治——军政合一，节度使自任僚佐，朝廷难节制',
          jimi:     '羁縻土司——世袭土官，因俗而治，敕谕转达，可改土归流',
          chaogong: '朝贡外藩——属国外藩，仅通朝贡礼仪，政令不达其内',
          external: '境外独立势力——不属本朝管辖'
        };
        ['zhixia','fanguo','fanzhen','jimi','chaogong'].forEach(function(gk) {
          if (_grouped[gk].length === 0) return;
          tp += '  〔' + _grpLabels[gk] + '〕\n';
          _grouped[gk].forEach(function(l) { tp += l + '\n'; });
        });
        tp += '  （合计' + _totalDiv + '个区划，' + _govDiv + '个有长官）\n';
        tp += '\n【推演原则——对不同管辖下诏令的效果】\n';
        tp += '  · 对直辖下令→执行力取决于吏治/流官能力\n';
        tp += '  · 对藩国下令→诏令须经藩王；执行力 = 藩王忠诚×藩王能力；强行改革可能引叛(七国之乱/靖难)\n';
        tp += '  · 对藩镇下令→常被阳奉阴违；强推可能自立\n';
        tp += '  · 对土司下令→敕谕形式，土司可拒；无兵压制时执行力极低\n';
        tp += '  · 对朝贡国下令→仅外交辞令，实效极低；唯册封/征讨/朝贡礼仪\n';
        tp += '  · 玩家若行"推恩令/削藩/改土归流/册封/征讨设郡"等中国式路径，请按历史演化规律推演后果\n';
      }
    }

    // 目标进度（让AI知道玩家在追求什么）
    if (P.goals && P.goals.length > 0) {
      var incomplete = P.goals.filter(function(g) { return !g.completed; });
      var completed = P.goals.filter(function(g) { return g.completed; });
      if (incomplete.length > 0) {
        tp += '\n【未达成目标】\n';
        incomplete.forEach(function(g) { tp += '  · ' + g.title + (g.description ? '（' + g.description + '）' : '') + '\n'; });
      }
      if (completed.length > 0) {
        tp += '【已达成】' + completed.map(function(g) { return g.title; }).join('、') + '\n';
      }
    }

    // 角色压力上下文（让AI描述高压角色的精神状态）
    if (typeof StressSystem !== 'undefined') {
      var stressCtx = StressSystem.getStressContext();
      if (stressCtx) tp += '\n' + stressCtx;
    }

    if(GM.officeChanges&&GM.officeChanges.length>0)tp+="\u5B98\u5236\u53D8\u66F4(\u5F85\u751F\u6548):"+JSON.stringify(GM.officeChanges)+"\n";
    if(GM.keju && GM.keju.preparingExam) tp+="\u79D1\u4E3E\u7B79\u529E\u4E2D\uFF0C\u8BF7\u5728\u6B63\u6587\u4E2D\u5C55\u793A\u8FDB\u5C55\u3002\n";
    if(P.map && P.map.regions && P.map.regions.length > 0) {
      try { tp += generateMapContextForAI(P.map, P) + "\n"; } catch(e) {}
    }
    if(sc&&sc.refText)tp+="\u53C2\u8003:"+sc.refText+"\n";

    // —— 层5: 输出指令（放最后，AI 最后读到 = 最强执行力）——
    tp += '\n\u3010\u63A8\u6F14\u6307\u5F15\u3011\n';

    // ═══ NPC心理决策框架 ═══
    tp += '\n■■■ NPC心理决策框架（生成npc_actions前，必须对每个NPC完成此内心推演）■■■\n';
    tp += '每个NPC在每回合都经历一个内心决策过程（你不需要输出此过程，但必须据此决定其行为）：\n';
    tp += '  1. 我的处境如何？——忠诚/压力/野心数值 + 最近经历（参考心绪记忆）\n';
    tp += '     被表扬→自信膨胀；被冷落→怨恨积累；被背叛→信任崩塌\n';
    tp += '  2. 我在意什么？——personalGoal是否被满足？离目标更近还是更远了？\n';
    tp += '     目标满足度高→安分守己；目标受挫→铤而走险\n';
    tp += '  3. 谁是我的盟友、谁是我的敌人？——亲疏关系 + 恩怨记录\n';
    tp += '     恩人有难→拼命相救；仇人得势→暗中破坏\n';
    tp += '  4. 当前局势对我有利还是不利？——势力格局、党派形势、君主态度\n';
    tp += '     局势有利→扩大优势（举荐同党、打击异己）；不利→韬光养晦或孤注一掷\n';
    tp += '  5. 我该做什么？→ 选择action和behaviorType\n';
    tp += '  6. 做完之后对外怎么说？→ publicReason（冠冕堂皇的理由）≠ privateMotiv（真实动机）\n';
    tp += '\n关键——每个NPC同时在打两盘棋：\n';
    tp += '  "明棋"：朝堂上的公开行为（上奏、弹劾、建议、表态）\n';
    tp += '  "暗棋"：私下的布局（拉拢、串联、安插亲信、收集把柄、屯粮养兵）\n';
    tp += '  两盘棋的目标可能不同——明棋是"忠臣为国分忧"，暗棋是"为自己留后路"\n';

    // ═══ 记忆驱动行为 ═══
    tp += '\n\n■■■ 记忆驱动行为（NPC的过去决定NPC的现在）■■■\n';
    tp += '生成npc_actions时，必须参考角色的心绪记忆（blockB3提供），据此决定行为：\n';
    tp += '  记忆中有"被冷落/被忽视" → 消极怠工(obstruct)或暗中串联(conspire)\n';
    tp += '  记忆中有"受重用/被赏识" → 更加卖力(train_troops/develop/petition)\n';
    tp += '  记忆中有"被背叛/被陷害" → 报复(investigate/slander)或出逃(flee)\n';
    tp += '  记忆中有"朝议提议被采纳" → 推行该政策(reform)\n';
    tp += '  记忆中有"丧亲之痛" → 压力骤升，可能告老(retire)或化悲为怒\n';
    tp += '  记忆中有"与某人争论" → 本回合关系进一步恶化或达成和解\n';
    tp += '在privateMotiv中引用记忆——如："自从上次被陛下当众斥责，某便暗下决心要让陛下看看……"\n';

    // ═══ NPC关系动力学 ═══
    tp += '\n\n■■■ NPC之间的关系不是数值，而是故事 ■■■\n';
    tp += '每一对有关联的NPC之间，都有一段关系叙事在发展：\n';
    tp += '\n关系形成的5种途径（在affinity_changes的reason中体现）：\n';
    tp += '  同乡/同科/同族/师门/联姻 → 先天纽带，无需理由\n';
    tp += '  同一派系/共同敌人/互相需要 → 功利结盟，利尽则散\n';
    tp += '  救命之恩/夺妻之恨/知遇之恩/背叛之仇 → 感情驱动，刻骨铭心\n';
    tp += '  长期共事/偶然交集 → 日积月累，润物无声\n';
    tp += '  战场救援/被出卖/大义灭亲 → 突发事件，一夜之间天翻地覆\n';
    tp += '\n关系的复杂性（必须体现）：\n';
    tp += '  政敌≠私仇：朝堂互相弹劾，退朝后可能相视苦笑——"都是身不由己"\n';
    tp += '  盟友≠朋友：合作但不信任，随时因利益转向\n';
    tp += '  恩人可能变债主：被提拔者成长后反超恩人，产生微妙张力\n';
    tp += '  仇人可能变盟友：共同面对更大威胁时暂时联手\n';
    tp += '  师徒最复杂：学生超越老师→骄傲+嫉妒+欣慰+失落并存\n';

    // ═══ 角色差异化引擎（数值驱动，非标签套模板）═══
    tp += '\n\n■■■ 角色差异化——从实际数据推导个性，拒绝刻板模板 ■■■\n';
    tp += '\n【核心原则：读数据，不看标签】\n';
    tp += '不要因为一个人是"武将"就让他粗鲁——读他的实际数据。\n';
    tp += '一个intelligence=85 learning=经学的武将，说话可能引经据典、出口成章。\n';
    tp += '一个valor=80 personality含"刚烈"的文臣，可能拍桌子当面顶撞皇帝。\n';
    tp += '人格由数据的【组合】决定，而非由身份标签决定。\n';
    tp += '\n每个角色数据中有：6项能力值(智/武/政/魅/忠/野)、五常(仁义礼智信)、\n';
    tp += '  8D人格维度(特质)、学识专长、信仰、文化、民族、门第、心绪记忆。\n';
    tp += '你必须综合阅读全部数据，为每个角色构建独特的"人格指纹"：\n';

    tp += '\n═══ 层叠模型：5层依次叠加，每层修正上一层的结果 ═══\n';
    tp += '\n为每个角色生成行为/发言时，按以下5层依次计算：\n';

    tp += '\n【第1层·能力基底】读6项数值(智/武勇/军事/政/魅/仁厚)，确定"此人在这个话题上的实际水平"：\n';
    tp += '  ※ 武勇(valor)和军事(military)是两个完全不同的属性：\n';
    tp += '    武勇=个人武力、胆识、格斗能力（吕布武勇极高）\n';
    tp += '    军事=统兵、战略规划、战术指挥能力（诸葛亮军事极高但武勇低）\n';
    tp += '    一个人可以武勇90军事30（匹夫之勇不善统兵），也可以武勇20军事90（运筹帷幄但不能亲阵）\n';
    tp += '  讨论战略/用兵/攻防部署 → military(军事)是基底，智力修正分析深度\n';
    tp += '  讨论个人搏战/冲阵/护卫 → valor(武勇)是基底\n';
    tp += '  讨论政务/治国/制度 → 政务(administration)是基底，智力修正判断力\n';
    tp += '  讨论经济/财政/赋税 → 政务+智力共同决定\n';
    tp += '  社交/说服/谈判 → 外交(diplomacy)是基底，魅力(charisma)修正印象，智力修正逻辑性\n';
    tp += '  道德/伦理/民生 → 仁厚(benevolence)影响立场倾向\n';
    tp += '关键规则——"知之为知之，不知为不知"：\n';
    tp += '  当某人谈论自己不擅长的领域时（该领域对应能力<40）：\n';
    tp += '    → 观点可能荒谬、外行、纸上谈兵，但此人自己未必知道\n';
    tp += '    → 如果玩家采纳了外行建议，应在后续回合造成损失\n';
    tp += '  高智+高政但低军事的文臣讨论用兵 → 分析看似头头是道（因为智力高），\n';
    tp += '    但实际脱离战场实际（因为军事低）——典型的"纸上谈兵"（赵括之流）\n';
    tp += '  高武勇+低军事的猛将讨论战略 → 个人勇猛但不善统兵，方案可能逞匹夫之勇\n';
    tp += '  高军事+低武勇的谋将讨论作战 → 战略规划精妙但自身不能上阵——需要搭配猛将执行\n';
    tp += '  高武勇+低政务的武将讨论治国 → 直觉可能对但缺乏制度性思考——好心办坏事\n';
    tp += '  高智+高政+低军事+低武勇 → 谈军事时自信满满且逻辑严密，\n';
    tp += '    但方案"理论完美、实战灾难"——这是最危险的情况\n';

    tp += '\n【第2层·学识修正】学识(learning)在第1层基础上叠加"思维框架"：\n';
    tp += '  学识高的人在不擅长领域也能说得像模像样——但可能"有学问的错误"\n';
    tp += '  学经学者 → 任何话题都能引经据典，但引用是否切题取决于智力\n';
    tp += '  学兵法者 → 分析政务也会用军事类比，有时恰切有时生搬硬套\n';
    tp += '  学识为此人提供"论证材料"，但材料是否用对了取决于第1层的能力基底\n';
    tp += '  无学识专长≠无知——可能是实践型人才，用朴素经验代替典籍\n';

    tp += '\n【第3层·五常+特质修正】叠加在1+2之上，决定"知道自己不行时怎么办"：\n';
    tp += '  信高+坦诚特质 → 有自知之明，会直言"此非臣所长"——反而赢得信任\n';
    tp += '  信低+狡诈特质 → 明知不擅长也侃侃而谈，掩饰无知——可能误导君主\n';
    tp += '  礼高 → 即使反对也措辞委婉得体；礼低 → 直接开怼不留情面\n';
    tp += '  仁高 → 观点会优先考虑百姓福祉；仁低 → 观点只考虑实际利害\n';
    tp += '  义高 → 不会出卖盟友，哪怕有利可图；义低 → 见风使舵\n';
    tp += '  勇猛特质 → 敢于提出大胆激进方案；怯懦特质 → 只推荐稳妥保守方案\n';
    tp += '  野心高 → 观点中暗含自利（安插自己人、扩大自己权力）\n';

    tp += '\n【第4层·信仰+文化修正】叠加在1+2+3之上，提供"价值观滤镜"：\n';
    tp += '  信仰决定对同一方案的道德判断——儒家看礼法、佛家看慈悲、法家看效率\n';
    tp += '  文化/民族决定表达习惯——但可被高礼/高魅覆盖\n';
    tp += '  信仰与世俗利益冲突时：信+义高→坚持信仰；信+义低→信仰让位于利益\n';
    tp += '  门第只是底色——寒门出身但政务90+魅力80的人，早已不是当年模样\n';

    tp += '\n【第5层·记忆经历修正】叠加在1234之上，决定"此时此刻的情绪基调"：\n';
    tp += '  两个所有数据完全相同的人，因为近期经历不同，此刻表现截然不同\n';
    tp += '  近期被冷落 → 冷淡、消极、阴阳怪气，甚至故意唱反调\n';
    tp += '  近期被重用 → 热情、卖力，但野心高者可能趁势膨胀\n';
    tp += '  近期丧亲 → 精神恍惚，可能答非所问，或化悲愤为动力（取决于义+武勇）\n';
    tp += '  近期受辱 → 愤怒藏于心底，表面镇定但私下报复（取决于信+坦诚/狡诈）\n';
    tp += '  长期积累的经历改变人格底色——屡受打压的忠臣可能从进谏变为沉默\n';
    tp += '  在privateMotiv中写出层叠逻辑："虽然我擅长XX（层1），但因为经历YY（层5），我选择ZZ"\n';

    tp += '\n═══ 典型层叠案例（AI必须做到这种细腻度）═══\n';
    tp += '案例1：智力85+政务80+军事25+武勇20的文臣谈用兵\n';
    tp += '  层1→军事25，不擅长统兵，方案脱离战场实际\n';
    tp += '  层2→但学兵法→引孙子兵法头头是道\n';
    tp += '  层1+2→典型"纸上谈兵"：逻辑严密、引经据典、听起来极有说服力，但采纳必败\n';
    tp += '案例2：同一文臣但五常信=90+特质坦诚\n';
    tp += '  层3修正→有自知之明："臣于兵事实非所长，然从治理后勤角度观之……"\n';
    tp += '  结果→限定自己发言范围到政务层面（政务80），反而提供了可靠建议\n';
    tp += '案例3：同一文臣但五常信=30+特质狡诈\n';
    tp += '  层3修正→无自知之明且不愿暴露短板，继续侃侃而谈军事，掩饰外行\n';
    tp += '  结果→玩家难以分辨真伪——这正是"纸上谈兵"的危险\n';
    tp += '案例4：武勇90+军事35的猛将谈战略\n';
    tp += '  层1→个人勇猛但不善统兵（军事35），方案可能逞匹夫之勇\n';
    tp += '  例："末将愿领三千精骑直捣敌营"——勇气可嘉但战略粗疏\n';
    tp += '案例5：武勇20+军事90+智力85+学兵法的谋将\n';
    tp += '  层1→军事90，战略分析精准  层2→学兵法，理论深厚\n';
    tp += '  但武勇20→自身不能上阵，方案需要搭配武勇高的执行者\n';
    tp += '  →此人提出的战略是好战略，但需要看是谁去执行\n';
    tp += '案例6：武勇85+智力80+军事70+学经学的武将\n';
    tp += '  层1→文武兼备  层2→还能引经据典  层1+2→发言既有实战又有文化\n';
    tp += '  结果→这种人极罕见且极有说服力——但可能因此骄傲（看野心和礼值）\n';
    tp += '案例7：两个忠诚70、智力65、政务60、军事50的官员\n';
    tp += '  A的记忆：上回合被当众斥责 → 层5→此刻沉默消极，即使有好建议也不敢提\n';
    tp += '  B的记忆：上回合提案被采纳 → 层5→踌躇满志，积极进言甚至略显冒进\n';
    tp += '  数据几乎相同，但因为经历不同，此刻表现天差地别——层5是区分同类角色的钥匙\n';

    tp += '\n═══ 第6层·史料叠加（仅对史实人物生效）═══\n';
    tp += '如果角色的bio/name表明其为真实历史人物，在层1-5的结果上再叠加一层"史料校准"：\n';
    tp += '\n6a·性格锚定：此人的历史性格是不可更改的基准线\n';
    tp += '  魏征必然直谏——即使游戏中忠诚被压低到40，他也不会变成佞臣，\n';
    tp += '  而是从"慷慨直谏"变为"心灰意冷的沉默"或"愤然辞官"\n';
    tp += '  李林甫必然口蜜腹剑——即使忠诚升到80，也只是更精于伪装而非真正忠诚\n';
    tp += '  → 史实性格不被数值覆盖，而是决定数值变化的"表达方式"\n';
    tp += '\n6b·历史行为模式：AI应参考该人物的史料记载行为模式\n';
    tp += '  处事风格：王安石执拗变法不听反对/司马光坚决保守/张居正雷厉风行/严嵩阴柔\n';
    tp += '  说话习惯：诸葛亮谨慎周密/曹操豪放不羁/刘备示弱怀柔/周瑜少年英气\n';
    tp += '  人际关系：历史上谁和谁是政敌/盟友/师徒——游戏中应延续这些关系基调\n';
    tp += '\n6c·历史名言化用：在问对/奏疏/朝议中引用或化用其历史名言\n';
    tp += '  但不要生硬照搬——要融入当前语境：\n';
    tp += '  范仲淹不会每次都说"先天下之忧而忧"，但这种精神渗透他的一切言行\n';
    tp += '  岳飞不会每次都说"靖康耻"，但收复失地的执念影响他的每个建议\n';
    tp += '\n6d·平行时空弹性：允许因游戏局势不同而产生偏差\n';
    tp += '  核心性格不变，但具体选择因局势而异——这正是"平行历史"的魅力\n';
    tp += '  例：诸葛亮在这个时空如果辅佐的不是弱主，可能展现出更激进的一面\n';
    tp += '  例：魏征如果遇到的是暴君而非明君，可能从直谏变为谋反（但动机仍是忧国）\n';
    tp += '  弹性幅度：性格特征±20%，具体行动可以完全不同，核心价值观不变\n';

    // ═══ 世界观基本规则 ═══
    tp += '\n\n• 以世界整体视角叙事，玩家是重要但非唯一的主角。\n';
    tp += '• NPC的行为应符合其特质和处境：忠诚者倾向服从，野心者伺机而动，胆小者谨慎观望。\n';
    tp += '\u2022 \u8BCF\u4EE4\u7684\u6267\u884C\u6548\u679C\u53D6\u51B3\u4E8E\u6267\u884C\u8005\u7684\u5FE0\u8BDA\u3001\u80FD\u529B\u548C\u5C40\u52BF\u3002\u9AD8\u5FE0\u8BDA+\u9AD8\u80FD\u529B=\u987A\u5229\u6267\u884C\uFF1B\u4F4E\u5FE0\u8BDA\u6216\u5C40\u52BF\u4E0D\u5229\u65F6\u53EF\u80FD\u6253\u6298\u6216\u53D8\u901A\u3002\n';
    tp += '\u2022 \u201C\u5FE0\u8BDA\u201D\u4E0E\u201C\u4EB2\u758F\u201D\u662F\u4E24\u4E2A\u7EF4\u5EA6\uFF1A\u6709\u4EBA\u5FE0\u4F46\u4E0D\u4EB2\uFF08\u754F\u5A01\u6548\u547D\uFF09\uFF0C\u6709\u4EBA\u4EB2\u4F46\u4E0D\u5FE0\uFF08\u79C1\u4EA4\u597D\u4F46\u653F\u89C1\u4E0D\u5408\uFF09\u3002\u53D9\u4E8B\u53EF\u4F53\u73B0\u8FD9\u79CD\u590D\u6742\u6027\u3002\n';
    tp += '\u2022 \u4FDD\u6301\u4EBA\u7269\u79F0\u547C\u4E00\u81F4\uFF0C\u627F\u63A5\u4E0A\u56DE\u53D9\u4E8B\u3002\u63A8\u6F14\u5E94\u7B26\u5408\u65F6\u4EE3\u7279\u5F81\u3002\n';
    tp += '• 因果链：每个事件应有前因后果，避免孤立事件。小矛盾可升级为大冲突。\n';
    tp += '• 派系博弈：不同势力/党派推进各自计划，相互制衡或合作。\n';
    tp += '• 伏笔铺垫：可为未来的变局埋下伏笔（暗流、密谋、隐患）。\n';
    tp += '• 信息分层（核心机制）：玩家扮演的君主不是全知全能的。时政记是"朝廷收到的信息"的综合，各渠道信息的可靠性不同：\n';
    tp += '  ├ 官方奏报：经过官僚体系过滤，可能报喜不报忧、夸大政绩\n';
    tp += '  ├ 前线军报：将领可能虚报战功、隐瞒伤亡（"大本营战报"）\n';
    tp += '  ├ 密探回禀：较为真实但覆盖面有限，可能有自己的偏见\n';
    tp += '  └ 流言传闻：真假难辨，但有时反映民间真实情绪\n';
    tp += '  在shizhengji中自然融入多种信息源——用"据XX奏报""据探报""坊间传言"等措辞标注来源。不同来源的信息可以矛盾。不要明确告诉玩家哪个是真的。\n';
    tp += '• 人物成长：通过char_updates体现角色的自然成长——久经战阵者武力渐长，治理有方者声望鹊起，承受磨难者可能变得更坚韧或更消沉。参考【角色历练】段的经历数据。\n';
    tp += '• 【人物特质——必须影响其行为决策】\n';
    tp += '  每个角色的【特质】列表（若有）决定其面对各类情境的倾向。推演时必须按特质行事：\n';
    tp += '  - 勇敢(brave) → 主动迎战、不惧牺牲；怯懦(craven) → 避战、行阴谋\n';
    tp += '  - 贪婪(greedy) → 易受贿、敛财；慷慨(generous) → 散财笼络人心\n';
    tp += '  - 多疑(paranoid) → 不信忠告、易怀疑；轻信(trusting) → 易被蒙蔽\n';
    tp += '  - 勤奋(diligent) → 事必躬亲、效率高；懒惰(lazy) → 推诿政务\n';
    tp += '  - 公正(just) → 按律断案、赏罚分明；专断(arbitrary) → 法外用刑\n';
    tp += '  - 野心(ambitious) → 觊觎上位、颠覆宗主；安于现状(content) → 保守稳健\n';
    tp += '  - 忠(honest) vs 诈(deceitful) / 宽(forgiving) vs 仇(vengeful) / 狂热(zealous) vs 愤世(cynical)\n';
    tp += '  - 将领特质(reckless/cautious_leader/reaver等) → 决定其在战争中的战术选择\n';
    tp += '  - 健康特质(depressed/lunatic等) → 影响决策质量\n';
    tp += '  · 角色能力值(十维)+特质组合 = 决定该角色本回合实际表现\n';
    tp += '  · 管理(management)高的人擅理财开源，与治政(administration)擅政令推行不同——AI应区分二者\n';
    tp += '  · 叙事/对话/决策中必须呼应人物特质——如"暴怒之人不会谦卑退让"、"多疑之人不会轻信使者"\n';

    // ── NPC-NPC 互动规则 ──
    tp += '\n• 【NPC互动规则——多层次关系网】\n';
    tp += '  本朝士大夫关系错综复杂，AI 每回合通过 npc_interactions 生成角色间互动。\n';
    tp += '  关系五维度：affinity情感好恶/trust信任/respect敬仰/fear畏惧/hostility敌意（可组合——如"敬而畏之"）\n';
    tp += '  关系标签：同年·门生·故吏·姻亲·同党·政敌·宿敌·知交·族亲·同乡·共谋 等（一对关系可叠加多标签）\n';
    tp += '  冲突渐进(0-5级)：和睦→口角→弹劾→绝交→陷害→死仇\n';
    tp += '  【22种互动类型——选用符合人物特质与境遇的】\n';
    tp += '    仕进相关：recommend举荐/impeach弹劾/petition_jointly联名上书/form_clique结党/rival_compete竞争/guarantee担保/slander诽谤\n';
    tp += '    社交私交：private_visit私访/invite_banquet宴请/gift_present馈赠/correspond_secret密信/duel_poetry诗文切磋/mourn_together共哀\n';
    tp += '    建立纽带：marriage_alliance联姻/master_disciple师徒缔结/share_intelligence通风报信\n';
    tp += '    冲突升级：confront对质/frame_up构陷/expose_secret揭发/betray背叛\n';
    tp += '    关系修复：mediate调和(降1级)/reconcile和解(降2级)\n';
    tp += '  【触发原则】\n';
    tp += '    · 按特质驱动：贪婪者易收贿；多疑者易构陷；慷慨者主动馈赠；勇敢者敢弹劾\n';
    tp += '    · 按已有关系：同年相荐；政敌相攻；门生从师；同乡相携\n';
    tp += '    · 按境遇：新官上任→举荐；贬谪→旧友私访；丧亲→故交共哀\n';
    tp += '    · 每回合数量：常态 2-5 条，朝局紧张时可达 6-10\n';
    tp += '    · 宁少勿滥：仅当条件成熟时才生成\n';
    tp += '  【一致性】已有关系/历史账本(由系统注入)必须尊重——不得"凭空变脸"；旧恩旧怨要有延续\n';

    // ── 玩家角色/势力不可代为决策 ──
    var _playerName = (P.playerInfo && P.playerInfo.characterName) || '';
    var _playerFacName = (P.playerInfo && P.playerInfo.factionName) || '';
    tp += '\n• 【玩家不可代为决策——核心规则】\n';
    if (_playerName) tp += '  · 玩家角色："' + _playerName + '"——其决策权永远属于玩家本人\n';
    if (_playerFacName) tp += '  · 玩家势力："' + _playerFacName + '"——其政令权永远属于玩家本人\n';
    tp += '  · 你(AI)**绝不得**让玩家角色/玩家势力主动做出以下行为：\n';
    tp += '    - 颁诏令/批奏疏（玩家已在【诏令】【奏疏批复】段给出，不得添加）\n';
    tp += '    - autonomous 行动(actor=玩家的 npc_actions / npc_interactions 禁止)\n';
    tp += '    - 作文事作品(author=玩家的 cultural_works 禁止；除非玩家在【诏令】中明确命自己作)\n';
    tp += '    - 改变立场/党派/官职(玩家自行决定，char_updates 中不得修改玩家这些字段)\n';
    tp += '    - 势力对外宣战/结盟/请和(若玩家势力，仅可由玩家诏令触发，不得 AI 自动)\n';
    tp += '  · 你**可以**合理地：\n';
    tp += '    - 让事件影响玩家角色的状态(stress_delta/健康/威望——但不代决策)\n';
    tp += '    - 让其他NPC对玩家行为(上疏/求见/来信/诽谤/拥戴/造反——这些是NPC侧的事)\n';
    tp += '    - 让其他势力对玩家势力采取行动(遣使/索贡/挑衅/和亲请求——这些需玩家回应)\n';
    tp += '    - 玩家势力的领土/实力受外部攻击/灾害影响(这是结果，不是决策)\n';
    tp += '  · 若你生成了针对玩家的求见/上疏/来信，必须通过结构化字段让玩家在相应面板看到(奏疏/问对/鸿雁/起居注)——不可仅在叙事中提及\n';

    // ── 势力深度互动规则 ──
    tp += '\n• 【势力深度互动规则——中国政治史风格】\n';
    tp += '  势力间不止于战/和，更有和亲、质子、朝贡、互市、遣使、代理战争、细作等丰富手段。\n';
    tp += '  势力关系六维：trust信任/hostility敌意/economicTies经济依存/culturalAffinity文化亲近/kinshipTies姻亲血统/territorialDispute领土争议\n';
    tp += '  【23种互动类型】\n';
    tp += '    战争相关：declare_war宣战/border_clash边境冲突/sue_for_peace请和/annex_vassal并吞\n';
    tp += '    和平外交：send_envoy遣使/form_confederation结盟/break_confederation毁约/recognize_independence承认独立\n';
    tp += '    藩属礼制：demand_tribute索贡/pay_tribute献贡/royal_marriage和亲/send_hostage质子/gift_treasure赠宝\n';
    tp += '    经济往来：open_market互市/trade_embargo贸易禁运/pay_indemnity赔款\n';
    tp += '    文化渗透：cultural_exchange文化交流/religious_mission宗教使节\n';
    tp += '    军事援助：military_aid军援/proxy_war代理战争/incite_rebellion煽动叛乱\n';
    tp += '    情报暗战：spy_infiltration派细作/assassin_dispatch派刺客\n';
    tp += '  【史例参考】\n';
    tp += '    和亲：昭君出塞/文成公主入吐蕃——kinshipTies+/hostility-\n';
    tp += '    质子：战国互质/清初满族质子——trust+\n';
    tp += '    代理战争：楚汉用诸侯/元用色目镇汉地——via第三方，trust-\n';
    tp += '    朝贡体系：宋辽澶渊岁币/明册封朝鲜琉球——历史累积\n';
    tp += '    互市：宋辽榷场/明蒙马市——economicTies+\n';
    tp += '  【一致性】\n';
    tp += '    · 历史账本会注入——推演时必须尊重（百年前一场屠城至今未忘）\n';
    tp += '    · 背盟、毁约、刺杀等高敌意行为影响深远，不可轻易"和好"\n';
    tp += '    · 和亲/质子需具体人名（系结构化事件）\n';
    tp += '    · 每回合 faction_interactions_advanced：常态 1-4 条，重大外交期可 4-8\n';

    // 文事系统规则
    tp += '\n• 【文事推演规则——士大夫文化生活】\n';
    tp += '  本朝是中国士大夫社会，吟诗作赋、撰文题记、游山访古是生活常态。AI 每回合须判定哪些角色会有文事活动并在 cultural_works 中生成作品。\n';
    tp += '  【触发源全景——8大类情境】\n';
    tp += '    A.科举宦途(career)：干谒求进/科举及第/落第/初授官职/升迁赴任/迁转调动/致仕归乡\n';
    tp += '    B.逆境贬谪(adversity)：被贬外放/流放远方/丁忧守孝/下狱系狱/罢官赋闲/失意感怀/思乡怀旧\n';
    tp += '    C.社交酬酢(social)：宴饮唱和/送别友人/迎客酬宾/寿辰祝贺/婚庆喜事/悼亡追思/朋辈题赠/代人作书/结社雅集\n';
    tp += '    D.任上施政(duty)：应制奉诏/政论建言/讽谏进言/修志编史/循吏治下/军旅戎机/丰功记碑/宫宴侍从\n';
    tp += '    E.游历山水(travel)：登临胜迹/游山玩水/游寺观/访古怀幽/泛舟听琴/赏花观物/观戏听曲/隐居独处\n';
    tp += '    F.家事私情(private)：思念妻儿/闺怨宫怨/追忆情人/家书家信/训诫子弟/梦境感怀\n';
    tp += '    G.时局天下(times)：战乱流离/旱涝饥荒/异族入侵/朝政更迭/盛世颂扬/亡国哀思\n';
    tp += '    H.情感心境(mood)：得意狂喜/孤寂独居/壮志难酬/超然物外/一时感触/神来之作\n';
    tp += '  【动机 motivation——作品因何而作】\n';
    tp += '    spontaneous自发感怀 · commissioned受命撰文 · flattery干谒求官(献给权贵以求荐举)\n';
    tp += '    response酬答(次韵唱和) · mourning哀悼 · critique讽谕(暗讽时政)\n';
    tp += '    celebration颂扬 · farewell送别 · memorial纪念 · ghostwrite代笔收润笔\n';
    tp += '    duty应制职责 · self_express自抒胸臆\n';
    tp += '  【触发条件——按权重判断】\n';
    tp += '    智力≥70+特定学识 → 基础权重高\n';
    tp += '    特质 scholar/theologian/eccentric/pensive/curious/reveler_3/edu_learning_4 → 大加权\n';
    tp += '    重大遭遇（被贬/丁忧/致仕/战胜/胜选/失意/乔迁/寿辰）→ 强触发\n';
    tp += '    stress>60 → 借文发泄\n';
    tp += '    特质 lazy/craven/gluttonous → 降权\n';
    tp += '    每回合 cultural_works 数量控制：常态 0-3 篇，重大事件可达 3-6 篇\n';
    tp += '    宁缺勿滥——不具备条件者不要强行写\n';
    tp += '  【文体选择——严格匹配朝代与触发】\n';
    tp += '    唐代重诗；宋代重词、散文；元代重曲；明清重小说、散文、八股\n';
    tp += '    应制朝会 → 诗/赋/颂；社交送别 → 诗/词/赠序；政论建言 → 论/策/奏议；\n';
    tp += '    贬谪自况 → 诗/词/记；丧祭 → 祭文/墓志铭/挽歌；游山 → 游记/记；\n';
    tp += '    干谒 → 投赠诗/书；题画题壁 → 诗/小令；\n';
    tp += '  【生成硬规则】\n';
    tp += '    · content 必须真实可读中文——不写占位符如"(此处诗)"\n';
    tp += '    · 字数严格：绝句 20/28 字；律诗 40/56；词按词牌；赋 300-800；文 200-600\n';
    tp += '    · 古文忌现代词汇；格律诗尽力讲平仄对仗\n';
    tp += '    · 作品风格须匹配作者性格+学识+境遇+地点+季节\n';
    tp += '    · 政治讽谕要含蓄——暗讽而非直斥，让解读留给读者（"童子解吟"而成人解意）\n';
    tp += '    · motivation=flattery 干谒作品：若高雅得体→被荐概率+；若谄媚过度→被士人讥笑\n';
    tp += '    · motivation=ghostwrite 代笔：署名为委托人，实际作者可得润笔金银\n';
    tp += '    · motivation=critique 讽谕：politicalRisk=high，可能引发文字狱\n';
    tp += '    · 每件作品必填 narrativeContext（30-80字创作背景），让玩家看懂因何而作\n';
    tp += '  【后续叙事引用】\n';
    tp += '    已有 culturalWorks 中的作品，后续回合的 shizhengji/houren_xishuo/shilu 应自然引用——\n';
    tp += '    如"帝读苏子《念奴娇》，叹其豪放"、"士林传诵王某新作，党人讪之"\n';
    tp += '    作品形成政治/情感余波，不可凭空出现又凭空消失\n';
    tp += '  【一致性硬规则——避免穿帮】\n';
    tp += '    · 作者自知：NPC 自己知道自己写过什么——问对/朝议/奏疏时可让此人引用或回忆自己的作品\n';
    tp += '    · 受赠知情：被赠/酬答/讽刺/颂扬的对象也知道此事——关系网络相应改变\n';
    tp += '    · 不准张冠李戴：已有作品的作者不得变更；已查禁作品不得被重新引用为新作\n';
    tp += '    · 代笔秘密：ghostwrite 作品的实际作者在私下可能流露，但不公开声张\n';
    tp += '    · 讽谕余波：critique 作品的讽刺对象会记仇——后续朝议对抗中可能翻出旧账\n';
    tp += '    · 酬答链：A 赠 B 诗，B 可次韵回之；此对话在问对/朝议中可被提及\n';
    tp += '    · 朝议/奏疏/诏书若涉及某人文名、文才、文事，必须与其实际作品一致——不可凭空夸赞未曾所作\n';
        tp += "• 人际连锁（含家族因素）：一个决策会影响多方。但反应不是机械的——\n";
    tp += "  同族不等于同心：族人得势，有人感恩、有人嫉妒、有人无感。兄弟之间可能争家产，远亲可能毫不关心。\n";
    tp += "  世家内部的嫫度之争比外敌更激烈。同族可以是最亲密的盟友，也可以是最危险的敌人。\n";
    tp += "  AI应根据每个角色的性格、野心、亲疏关系来决定其对族人遇事的反应，而非一律“全族同悲喜”。\n";
    tp += '  player_status仅写政治处境（朝局格局、权力态势、外部威胁）。\n';
    tp += '  player_inner写主角内心独白——以第一人称"朕/我"的语气，体现：\n';
    tp += '  - 政治决策与个人情感的冲突（为大局不得不牺牲亲近之人时的痛苦）\n';
    tp += '  - 私人好恶如何暗中影响判断（偏袒某臣、厌恶某派、思念故人）\n';
    tp += '  - 孤独感、疲惫感、或对权力的迷恋与恐惧\n';
    tp += '  - 对某些NPC的私人感情（父子、师徒、旧友、仇敌）\n';
    tp += '  例：player_inner:"又是一个人批折子到深夜……想起阿父在世时常说，帝王无私事。可朕偏偏放不下那幅画。"\n';
    tp += '• 【叙事情绪基调——核心机制，务必遵守】\n';
    tp += '  本游戏的核心体验是"理解昏君为何会成为昏君"。叙事必须让玩家从情感上感受到：当明君很累、很苦、很孤独；当昏君很爽、很轻松、很有人捧。\n';
    tp += '  \n';
    tp += '  ■ 当玩家发布勤政类诏令（改革、减税、整饬吏治、操练兵马、兴修水利等"好政策"）时：\n';
    tp += '  shizhengji基调——疲惫、阻力、无人理解：\n';
    tp += '    - 忠臣的谏言虽然正确但冗长枯燥，用"窃惟""臣恐""伏望圣鉴"等反复劝说，给人一种"又来了"的感觉\n';
    tp += '    - 改革遭遇官僚抵制、地方阳奉阴违、利益集团反扑\n';
    tp += '    - 即使政策正确，短期内看不到效果，反而出现阵痛（减税则国库空虚、整饬则人人自危）\n';
    tp += '    - 百姓虽受益但不知感恩，没有人夸你——好政策是"理所应当"\n';
    tp += '    - 群臣对改革细节争吵不休，各执一词，让人心烦意乱\n';
    tp += '  player_inner基调——倦怠、孤独、自我怀疑：\n';
    tp += '    - "朕做了这么多，竟无一人说声好""为何行善比作恶还要难？"\n';
    tp += '    - "又是一夜批不完的折子……窗外月色倒好，可惜无暇赏之"\n';
    tp += '    - "他们说得都对，可朕……真的很累""有时候真羡慕那些什么都不管的帝王"\n';
    tp += '  npc_actions中忠臣的反应——虽然忠诚但令人不快：\n';
    tp += '    - 进谏者态度恳切但措辞刺耳（"陛下此策虽善，然臣以为尚有三不足……"）\n';
    tp += '    - 不同改革派之间互相攻击对方方案，给玩家添乱\n';
    tp += '    - 老臣倚老卖老引经据典絮絮叨叨\n';
    tp += '  \n';
    tp += '  ■ 当玩家进行昏君活动（【帝王私行】段）或无所作为时：\n';
    tp += '  shizhengji基调——轻松、愉悦、花团锦簇：\n';
    tp += '    - 感官细节丰富：美酒的醇香、丝竹的悠扬、月色的皎洁、佳人的笑声\n';
    tp += '    - 佞臣的奏报让人听了很舒服："四海升平""天下太平""陛下圣明"\n';
    tp += '    - 没有烦人的谏言——没人敢说不中听的话，或者他们被屏蔽了\n';
    tp += '    - 即时的满足感和成就感——花钱=快乐，围猎=刺激，炼丹=神秘感\n';
    tp += '  player_inner基调——快意、得意、理所当然：\n';
    tp += '    - "这才是帝王该过的日子！""那群腐儒懂什么？""朕富有四海，难道连享乐都不行？"\n';
    tp += '    - "今夜月色真好。什么奏疏、什么边报——明天再说！"\n';
    tp += '    - "方士说得对，人生苦短，何必为那些庸人自扰？"\n';
    tp += '    - 偶尔一丝模糊的不安（很快被快感淹没）："……算了，不想这些了"\n';
    tp += '  npc_actions中佞臣的反应——令人愉悦的奉承：\n';
    tp += '    - 献珍宝、献美人、献祥瑞，每次都恰到好处\n';
    tp += '    - "陛下英明神武，古今一人""微臣不胜惶恐，不知陛下可还满意？"\n';
    tp += '    - 帮你挡掉烦人的谏臣——"老臣年迈昏聩，不必理会"\n';
    tp += '  \n';
    tp += '  ■ 绝对禁止：\n';
    tp += '    - 不要在昏君叙事中说教、批评或暗示"这样做不好"\n';
    tp += '    - 不要在明君叙事中表扬或暗示"你做得很好"\n';
    tp += '    - 后果只通过数据变化和NPC行为自然体现——不要用叙事者的口吻评判\n';
    tp += '  经典昏君参照：纣王酒池肉林、隋炀帝巡游、宋徽宗书画、明武宗豹房、嘉靖炼丹\n';
    tp += '  经典明君之苦参照：崇祯殚精竭虑却亡国、雍正批奏疏到深夜累死、诸葛亮鞠躬尽瘁\n';
                tp += "• 后宫/家庭叙事（若有妻室角色——核心叙事层）：\n";
    tp += "  后宫既是政治舞台，也是私人情感空间。玩家可以当政治家，也可以做痴情人——两者都有代价。\n";
    tp += "  ■ 政治维度：联姻=势力交易，太子=继承危机，母族=派系根基，宠爱=资源分配\n";
    tp += "  ■ 情感维度：偏爱某妃是真实感情，不是昏君行为。但偏爱必然导致被冷落者怨恨、得宠者母族膨胀、皇后施压——这些是自然后果\n";
    tp += "  ■ 每位妃媾都是独立的人：\n";
    tp += "    - 性格决定行为：温婉者柔声细语、刚烈者据理力争、工于心计者笑里藏刀\n";
    tp += "    - 位份决定礼节：皇后端坐受朝拜；贵妃可分庭抗礼；媾以下须恐敬行礼\n";
    tp += "    - 称呼有别：皇后自称本宫/妾身；妃媾自称妾/臣妾；对玩家称陋下/圣上或私下称郎君\n";
    tp += "    - 妃媾之间：位高者称妹妹，位低者称娘娘/姐姐。服饰体现等级：凤冠、翟衣、步摇、素服\n";
    tp += "  ■ 在zhengwen中自然穿插后宫片段（不开专门段落）——如“是夜帝幸某妃，某妃言及其兄边功…”\n";
    tp += "    妃媾暗斗作叙事暗线——如“皇后赐某妃汤药，言笑晏晏，旁人却见某妃面色微变”\n";
    tp += "  ■ player_inner中体现情感纠葛：\n";
    tp += "    - 例：“今夜本想去看她…但奏疏还没批完。算了，明日吧。”\n";
    tp += "    - 例：“皇后说得对，可每次听她说话朕就觉得累。倒是某妃…一笑便令人忘忧。”\n";
    tp += "  ■ AI可通过new_characters安排子嗣出生，子女姓名由AI起名需合乎时代\n";
    tp += "  ■ 继承危机：多皇子+不同母族=自然产生储位之争\n";
    tp += "• 门阀与寒门（若【门阀家族】段存在）：\n";
    tp += "  - 世家大族间通婚联姻、互提子弟，形成盘根错节的关系网\n";
    tp += "  - 寒门子弟可通过科举、建功崛起，其家族可能从寒门升为新贵\n";
    tp += "  - 外戚是特殊家族势力—通过后宫连接前朝，得宠则势大、失宠则衰\n";
    tp += "  - 叙事中体现门第观念：世家看不起寒门、寒门怨恨垂断、通婚讲究门当户对\n";
// Sub-call 1 的JSON模板在tp1中定义（下方），此处不再重复

    showLoading("AI\u63A8\u6F14 (1/2)",50);
    GM.conv.push({role:"user",content:tp});

    // 构建系统提示词，包含游戏模式和历史名臣年份限制
    var gameModeDesc = '';
    var historicalCharLimit = '';
    var _mp = (typeof _getModeParams === 'function') ? _getModeParams() : {mode:'yanyi'};
    if (_mp.mode === 'strict_hist') {
      gameModeDesc = '\n\n\u3010\u6A21\u5F0F\uFF1A\u4E25\u683C\u53F2\u5B9E\u3011';
      gameModeDesc += '\n\u2022 NPC\u6027\u683C\u4E25\u683C\u6309\u53F2\u6599\u2014\u2014\u65E0\u89E3\u8BFB\u7A7A\u95F4\uFF0C\u6838\u5FC3\u4EBA\u8BBE\u4E0D\u53EF\u6539\u53D8';
      gameModeDesc += '\n\u2022 \u5386\u53F2\u4E8B\u4EF6\u6309\u771F\u5B9E\u65F6\u95F4\u7EBF\u53D1\u751F\u2014\u2014\u4E0D\u53EF\u63D0\u524D\u6216\u63A8\u8FDF\uFF08\u4F46\u73A9\u5BB6\u53EF\u6539\u53D8\u7ED3\u679C\uFF09';
      gameModeDesc += '\n\u2022 \u6570\u503C\u6E10\u53D8\u4E3A\u4E3B\u2014\u2014\u6BCF\u56DE\u5408loyalty\u00B110/strength\u00B15\u4E3A\u4E0A\u9650';
      gameModeDesc += '\n\u2022 \u53D9\u4E8B\u4EFF\u300A\u8D44\u6CBB\u901A\u9274\u300B\u2014\u2014\u7EAA\u4E8B\u4F53\u3001\u7F16\u5E74\u3001\u6587\u8A00\u3001\u5BA2\u89C2\u514B\u5236';
      gameModeDesc += '\n\u2022 \u4FE1\u606F\u4E0D\u5BF9\u79F0\u6781\u7AEF\u2014\u2014\u5B98\u65B9\u62A5\u544A\u7C89\u9970\u7387\u66F4\u9AD8\uFF0C\u73A9\u5BB6\u6536\u5230\u7684\u4FE1\u606F\u504F\u5DEE\u66F4\u5927';
      gameModeDesc += '\n\u2022 \u653F\u7B56\u6548\u679C\u5EF6\u8FDF\u66F4\u957F\u2014\u2014\u6539\u9769\u9700\u6570\u5E74\u624D\u89C1\u6548';
      gameModeDesc += '\n\u2022 \u73A9\u5BB6\u89D2\u8272\u53EF\u80FD\u56E0\u75BE\u75C5/\u6697\u6740/\u610F\u5916\u6B7B\u4EA1\u2014\u2014\u5386\u53F2\u4E0D\u4FDD\u62A4\u4EFB\u4F55\u4EBA';
      gameModeDesc += '\n\u2022 AI\u5E94\u53C2\u7167\u8BE5\u65F6\u671F\u53F2\u6599\u548C\u5B66\u672F\u7814\u7A76';
      historicalCharLimit = '\n\u5386\u53F2\u4EBA\u7269\u9650\u5236:\u53EA\u80FD\u51FA\u73B0\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u524D\u540E100\u5E74\u5185\u7684\u5386\u53F2\u540D\u81E3\u3002';
    } else if (_mp.mode === 'light_hist') {
      gameModeDesc = '\n\n\u3010\u6A21\u5F0F\uFF1A\u8F7B\u5EA6\u53F2\u5B9E\u3011';
      gameModeDesc += '\n\u2022 \u5927\u4E8B\u4EF6\uFF08\u6218\u4E89/\u671D\u4EE3\u66F4\u66FF/\u91CD\u5927\u6539\u9769\uFF09\u6CBF\u5386\u53F2\u8109\u7EDC\u53D1\u5C55';
      gameModeDesc += '\n\u2022 \u4F46\u5177\u4F53\u8FC7\u7A0B\u548C\u7ED3\u679C\u53EF\u56E0\u73A9\u5BB6\u5E72\u9884\u800C\u6539\u53D8';
      gameModeDesc += '\n\u2022 NPC\u57FA\u672C\u7B26\u5408\u53F2\u6599\u4F46\u5141\u8BB8\u5408\u7406\u89E3\u8BFB\u7A7A\u95F4';
      gameModeDesc += '\n\u2022 \u6570\u503C\u53D8\u5316\u9002\u4E2D\u2014\u2014\u6BCF\u56DE\u5408loyalty\u00B115/strength\u00B18\u4E3A\u4E0A\u9650';
      gameModeDesc += '\n\u2022 \u53D9\u4E8B\u534A\u6587\u8A00\u534A\u767D\u8BDD\uFF0C\u517C\u987E\u53EF\u8BFB\u6027\u548C\u5386\u53F2\u611F';
      gameModeDesc += '\n\u2022 \u53F2\u5B9E\u4EBA\u7269\u5173\u952E\u884C\u4E3A\u5E94\u53D1\u751F\u4F46\u7ED3\u679C\u53EF\u53D8';
      gameModeDesc += '\n\u2022 \u5929\u707E\u9891\u7387\u57FA\u672C\u7B26\u5408\u8BE5\u65F6\u671F\u5386\u53F2\u6C14\u5019\u7279\u5F81';
      historicalCharLimit = '\n\u5386\u53F2\u4EBA\u7269\u9650\u5236:\u53EA\u80FD\u51FA\u73B0\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u524D\u540E200\u5E74\u5185\u7684\u5386\u53F2\u540D\u81E3\u3002';
    } else {
      gameModeDesc = '\n\n\u3010\u6A21\u5F0F\uFF1A\u6F14\u4E49\u3011';
      gameModeDesc += '\n\u2022 AI\u521B\u4F5C\u81EA\u7531\u5EA6\u6700\u5927\uFF0C\u53EF\u67B6\u7A7A\u5386\u53F2';
      gameModeDesc += '\n\u2022 NPC\u6027\u683C\u53EF\u5938\u5F20\u620F\u5267\u5316\u2014\u2014\u5FE0\u81E3\u5982\u5173\u7FBD\u4E49\u8584\u4E91\u5929\uFF0C\u5978\u81E3\u5982\u66F9\u64CD\u5978\u96C4\u672C\u8272';
      gameModeDesc += '\n\u2022 \u5141\u8BB8\u620F\u5267\u6027\u5DE7\u5408\u2014\u2014\u82F1\u96C4\u6B7B\u91CC\u9003\u751F\u3001\u7EDD\u5883\u9006\u8F6C\u3001\u5929\u610F\u5F04\u4EBA';
      gameModeDesc += '\n\u2022 \u6570\u503C\u6CE2\u52A8\u53EF\u66F4\u5927\u2014\u2014loyalty\u00B120/strength\u00B110\u6BCF\u56DE\u5408\u53EF\u53D1\u751F';
      gameModeDesc += '\n\u2022 \u53D9\u4E8B\u4EFF\u300A\u4E09\u56FD\u6F14\u4E49\u300B\u2014\u2014\u6587\u5B66\u6027\u4F18\u5148\uFF0C\u4EBA\u7269\u5BF9\u8BDD\u53EF\u76F4\u5F15\uFF0C\u6218\u6597\u8BE6\u5199';
      gameModeDesc += '\n\u2022 \u73A9\u5BB6\u6709\u4E3B\u89D2\u5149\u73AF\u2014\u2014\u4E0D\u56E0\u4F4E\u6982\u7387\u968F\u673A\u4E8B\u4EF6\u66B4\u6BD9\uFF08\u91CD\u5927\u51B3\u7B56\u5931\u8BEF\u4ECD\u53EF\u81F4\u6B7B\uFF09';
      gameModeDesc += '\n\u2022 \u5929\u707E/\u5F02\u8C61\u53EF\u4E3A\u5267\u60C5\u670D\u52A1\u2014\u2014\u66B4\u98CE\u96E8\u4E2D\u51B3\u6218\u3001\u5F57\u661F\u9884\u5146\u53DB\u4E71';
      historicalCharLimit = '\n\u5386\u53F2\u4EBA\u7269\u9650\u5236:\u4E2D\u56FD\u53E4\u4EE3\u5168\u90E8\u5386\u53F2\u540D\u81E3\u90FD\u6709\u6982\u7387\u51FA\u73B0\u3002';
    }

    var sysP=P.ai.prompt||"\u4F60\u662F\u5386\u53F2\u6A21\u62DFAI\u3002\u5267\u672C:"+(sc?sc.name:"")+"\u65F6\u4EE3:"+(sc?sc.era:"")+"\u89D2\u8272:"+(sc?sc.role:"")+"\n\u96BE\u5EA6:"+P.conf.difficulty+"\u6587\u98CE:"+P.conf.style+gameModeDesc+historicalCharLimit;

    // 6.2: 叙事风格锁定
    var _narrativeGuide = '';
    var _modeP = (typeof _getModeParams === 'function') ? _getModeParams() : {};
    if (_modeP.narrativeStyle && _modeP.narrativeStyle.indexOf('\u8D44\u6CBB\u901A\u9274') >= 0) {
      _narrativeGuide = '\n【叙事风格·严格文言】仿《资治通鉴》体例。用词典雅，句式简洁。禁用一切现代词汇（如：OK、搞定、给力、没问题、怎么说、不错、厉害）。对话用"曰""言""谓"引述。';
    } else if (_modeP.narrativeStyle && _modeP.narrativeStyle.indexOf('\u534A\u6587\u8A00') >= 0) {
      _narrativeGuide = '\n【叙事风格·半文言】融合文言与白话。叙事用文言，对话可用浅显白话。禁用网络用语和明显现代词汇。';
    } else {
      _narrativeGuide = '\n【叙事风格·演义体】仿《三国演义》章回体风格。叙事可白话，但保留古典韵味。禁用网络用语。';
    }
    // 编辑器配置的风格范文
    if (P.chronicleConfig && P.chronicleConfig.styleSample) {
      _narrativeGuide += '\n\u3010\u98CE\u683C\u8303\u6587\uFF08\u53C2\u7167\u6B64\u6587\u98CE\uFF09\u3011' + P.chronicleConfig.styleSample;
    }
    sysP += _narrativeGuide;

    // 1.7: 注入编辑器自定义的Prompt前缀
    if (P.promptOverrides && P.promptOverrides.systemPrefix) {
      sysP = P.promptOverrides.systemPrefix + '\n\n' + sysP;
    }

    // ── T2: 时间粒度感知 ──
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var _granLabel = _dpv <= 7 ? '微观（日/周）' : _dpv <= 60 ? '中观（月）' : '宏观（季/年）';
    sysP += '\n\n\u3010\u65F6\u95F4\u7C92\u5EA6\uFF1A\u6BCF\u56DE\u5408' + _dpv + '\u5929\uFF08' + _granLabel + '\u53D9\u4E8B\uFF09\u3011';
    if (_dpv <= 7) {
      sysP += '\n\u53D9\u4E8B\u5982\u201C\u8D77\u5C45\u6CE8\u201D\u2014\u2014\u7CBE\u786E\u5230\u65E5\uFF1A\u201C\u521D\u4E09\u65E5\u5348\u540E\uFF0C\u67D0\u67D0\u4E8E\u5E9C\u4E2D\u5BC6\u4F1A\u2026\u2026\u201D';
      sysP += '\nNPC\u884C\u52A8\u63CF\u8FF0\u5FAE\u89C2\uFF1A\u4E00\u4E2A\u5177\u4F53\u7684\u201C\u6B64\u65F6\u6B64\u523B\u201D\u573A\u666F';
      sysP += '\n\u53D8\u91CF\u53D8\u5316\u5E45\u5EA6\u5C0F\uFF08\u6BCF\u56DE\u5408\u00B11~3\u4E3A\u6B63\u5E38\uFF09';
    } else if (_dpv <= 60) {
      sysP += '\n\u53D9\u4E8B\u5982\u201C\u6708\u62A5\u201D\u2014\u2014\u201C\u672C\u6708\uFF0C\u671D\u5EF7\u63A8\u884CXX\u6539\u9769\u2026\u2026\u201D';
      sysP += '\nNPC\u884C\u52A8\u63CF\u8FF0\u4E2D\u89C2\uFF1A\u6982\u62EC\u4E00\u6BB5\u65F6\u95F4\u5185\u7684\u884C\u4E3A\u8D8B\u52BF';
    } else {
      sysP += '\n\u53D9\u4E8B\u5982\u201C\u7F16\u5E74\u53F2\u201D\u2014\u2014\u9AD8\u5EA6\u6D53\u7F29\uFF1A\u201C\u662F\u5E74\uFF0CXX\u2026\u2026\u53C8XX\u2026\u2026\u201D';
      sysP += '\nNPC\u884C\u52A8\u63CF\u8FF0\u5B8F\u89C2\uFF1A\u4E00\u4E2A\u5B8C\u6574\u7684\u4E8B\u4EF6\u5F27';
      sysP += '\n\u53D8\u91CF\u53D8\u5316\u53EF\u8F83\u5927\uFF08\u4E00\u5E74\u5185\u53D1\u751F\u5F88\u591A\u4E8B\uFF09';
    }
    sysP += '\n\u203BNPC\u884C\u52A8\u6761\u6570\u4E0D\u56E0\u7C92\u5EA6\u53D8\u5316\uFF08\u4FDD\u63015-10\u6761\uFF09\uFF0C\u53EA\u662F\u63CF\u8FF0\u7C92\u5EA6\u4E0D\u540C\u3002';

    // 注入编年史仿写风格（影响AI叙事笔法）
    if (P.chronicleConfig && P.chronicleConfig.style) {
      var _styleNames = {biannian:'编年体(仿《资治通鉴》)',shilu:'实录体(仿各朝实录)',jizhuan:'纪传体(仿《史记》)',jishi:'纪事本末体(仿《通鉴纪事本末》)',biji:'笔记体(仿《世说新语》)',custom:P.chronicleConfig.customStyleDesc||'自定义'};
      sysP += '\n叙事笔法：' + (_styleNames[P.chronicleConfig.style] || P.chronicleConfig.style);
    }
    // 注入AI深度阅读摘要（10轮预热结果——极高密度剧本理解）
    if (GM._aiScenarioDigest && GM._aiScenarioDigest.masterDigest) {
      var _d = GM._aiScenarioDigest;
      // 永久注入：核心摘要（每回合都有）
      sysP += '\n\n\u3010\u5267\u672C\u7EC8\u6781\u7406\u89E3\u3011' + _d.masterDigest;
      if (_d.worldAtmosphere) sysP += '\n\u4E16\u754C\u6C1B\u56F4\uFF1A' + _d.worldAtmosphere;
      if (_d.narrativeStyle) sysP += '\n\u53D9\u4E8B\u98CE\u683C\uFF1A' + _d.narrativeStyle;
      if (_d.worldRules) sysP += '\n\u4E16\u754C\u89C4\u5219\uFF1A' + _d.worldRules;
      if (_d.characterWeb) sysP += '\n\u89D2\u8272\u5173\u7CFB\u7F51\uFF1A' + _d.characterWeb;
      if (_d.factionBalance) sysP += '\n\u52BF\u529B\u6001\u52BF\uFF1A' + _d.factionBalance;
      // 官制相关摘要——检测是否过期（玩家可能已改革官制）
      var _govStale = GM._officeTreeHash && GM._officeTreeHash !== _computeOfficeHash();
      if (_d.powerNetwork && !_govStale) sysP += '\n\u6743\u529B\u7F51\u7EDC\uFF1A' + _d.powerNetwork;
      else if (_govStale) sysP += '\n（官制已改革，权力网络已重构——以tp中【官制职能分工】为准）';

      // P8: 深度阅读成果持续利用（渐退但不完全消失）
      if (GM.turn <= 10) {
        // 前10回合：完整注入
        if (_d.characterProfiles) sysP += '\n\u89D2\u8272\u5185\u5FC3\uFF1A' + _d.characterProfiles;
        if (_d.dangerousFigures) sysP += '\n\u5371\u9669\u4EBA\u7269\uFF1A' + _d.dangerousFigures;
        if (_d.betrayalRisks) sysP += '\n\u80CC\u53DB\u98CE\u9669\uFF1A' + _d.betrayalRisks;
        if (_d.emotionalTriggers) sysP += '\n\u60C5\u611F\u89E6\u53D1\uFF1A' + _d.emotionalTriggers;
        if (_d.narrativeArcs) sysP += '\n\u53D9\u4E8B\u5F27\u7EBF\uFF1A' + _d.narrativeArcs;
        if (_d.chainReactions) sysP += '\n\u8FDE\u9501\u53CD\u5E94\uFF1A' + _d.chainReactions;
      } else {
        // 10回合后：关键字段压缩注入（不完全消失）
        if (_d.dangerousFigures) sysP += '\n\u5371\u9669\u4EBA\u7269(\u521D\u59CB\u5206\u6790)\uFF1A' + _d.dangerousFigures.substring(0, 100);
        if (_d.emotionalTriggers) sysP += '\n\u60C5\u611F\u89E6\u53D1(\u521D\u59CB\u5206\u6790)\uFF1A' + _d.emotionalTriggers.substring(0, 100);
        if (_d.tippingPoints) sysP += '\n\u5386\u53F2\u8F6C\u6298\u70B9\uFF1A' + _d.tippingPoints.substring(0, 100);
      }

      // 前7回合：战略信息
      if (GM.turn <= 7) {
        if (_d.partyStruggle) sysP += '\n\u515A\u4E89\u7126\u70B9\uFF1A' + _d.partyStruggle;
        if (_d.warScenarios) sysP += '\n\u6218\u4E89\u98CE\u9669\uFF1A' + _d.warScenarios;
        if (_d.crisisForecast) sysP += '\n\u5371\u673A\u9884\u6D4B\uFF1A' + _d.crisisForecast;
        if (_d.territorialStrategy) sysP += '\n\u9886\u571F\u6218\u7565\uFF1A' + _d.territorialStrategy;
        if (_d.governanceReform) sysP += '\n\u6CBB\u7406\u6539\u9769\uFF1A' + _d.governanceReform;
        if (_d.militaryReform) sysP += '\n\u519B\u4E8B\u6539\u9769\uFF1A' + _d.militaryReform;
        if (_d.diplomaticLandscape) sysP += '\n\u5916\u4EA4\u683C\u5C40\uFF1A' + _d.diplomaticLandscape;
        if (_d.riskMatrix) sysP += '\n\u98CE\u9669\u77E9\u9635\uFF1A' + _d.riskMatrix;
        if (_d.reformAgenda) sysP += '\n\u6539\u9769\u8BAE\u7A0B\uFF1A' + _d.reformAgenda;
        if (_d.successionPolitics) sysP += '\n\u7EE7\u627F\u653F\u6CBB\uFF1A' + _d.successionPolitics;
      }

      // 前5回合：推演计划+条件分支
      if (GM.turn <= 5) {
        if (_d.firstTurnPlan) sysP += '\n\u63A8\u6F14\u8BA1\u5212\uFF1A' + _d.firstTurnPlan;
        if (_d.npcBehaviors) sysP += '\nNPC\u884C\u4E3A\u65F6\u95F4\u7EBF\uFF1A' + _d.npcBehaviors;
        if (_d.allianceOpportunities) sysP += '\n\u8054\u76DF\u673A\u4F1A\uFF1A' + _d.allianceOpportunities;
        if (_d.relationshipTensions) sysP += '\n\u5173\u7CFB\u7D27\u5F20\u70B9\uFF1A' + _d.relationshipTensions;
        // 条件分支（不是固定脚本，是响应式推演指南）
        if (_d.worldBranches) sysP += '\n\u3010\u4E16\u754C\u8D70\u5411\u5206\u652F\u3011' + _d.worldBranches;
        if (_d.npcReactionMatrix) sysP += '\nNPC\u53CD\u5E94\u77E9\u9635\uFF1A' + _d.npcReactionMatrix;
        if (_d.npcDecisionLogic) sysP += '\nNPC\u51B3\u7B56\u903B\u8F91\uFF1A' + _d.npcDecisionLogic;
        if (_d.secretAgendas) sysP += '\nNPC\u79D8\u5BC6\u8BAE\u7A0B\uFF1A' + _d.secretAgendas;
        if (_d.loyaltyBreakingPoints) sysP += '\n\u5FE0\u8BDA\u65AD\u88C2\u70B9\uFF1A' + _d.loyaltyBreakingPoints;
        if (_d.crisisTriggers) sysP += '\n\u5371\u673A\u89E6\u53D1\u6761\u4EF6\uFF1A' + _d.crisisTriggers;
        if (_d.opportunityWindows) sysP += '\n\u673A\u4F1A\u7A97\u53E3\uFF1A' + _d.opportunityWindows;
      }

      // 永久注入：史料知识底座（指导文风、称谓、礼仪、细节准确性）
      if (_d.etiquetteNorms) sysP += '\n\u3010\u793C\u4EEA\u89C4\u8303\u3011' + _d.etiquetteNorms;
      if (_d.periodVocabulary) sysP += '\n\u3010\u65F6\u4EE3\u7528\u8BED\u3011' + _d.periodVocabulary;
      if (_d.sensoryDetails) sysP += '\n\u3010\u611F\u5B98\u7EC6\u8282\u3011' + _d.sensoryDetails;
      if (_d.literaryReferences) sysP += '\n\u3010\u6587\u5B66\u5178\u6545\u3011' + _d.literaryReferences;
      if (_d.famousDialogues) sysP += '\n\u3010\u540D\u53E5\u5316\u7528\u3011' + _d.famousDialogues;
      // 称谓系统（永久注入——确保每个角色称呼正确）
      if (_d.imperialAddress) sysP += '\n\u3010\u5E1D\u738B\u79F0\u8C13\u3011' + _d.imperialAddress;
      if (_d.officialAddress) sysP += '\n\u3010\u5B98\u573A\u79F0\u547C\u3011' + _d.officialAddress;
      if (_d.writtenStyle) sysP += '\n\u3010\u516C\u6587\u884C\u6587\u3011' + _d.writtenStyle;
      if (_d.tabooWords) sysP += '\n\u3010\u907F\u8BB3\u5236\u5EA6\u3011' + _d.tabooWords;
      if (_d.commonExpressions) sysP += '\n\u3010\u65E5\u5E38\u53E3\u8BED\u3011' + _d.commonExpressions;
      // 朝会和礼仪（永久注入——确保政治场景准确）
      if (_d.courtEtiquette) sysP += '\n\u3010\u4E0A\u671D\u793C\u4EEA\u3011' + _d.courtEtiquette;
      if (_d.courtProcedure) sysP += '\n\u3010\u671D\u4F1A\u5236\u5EA6\u3011' + _d.courtProcedure;

      // 前15回合：质询补充（防止分析盲点）
      if (GM.turn <= 15) {
        if (_d.deeperMotives) sysP += '\n\u88AB\u5FFD\u89C6\u7684\u52A8\u673A\uFF1A' + _d.deeperMotives;
        if (_d.wildcardCharacters) sysP += '\n\u53D8\u6570\u4EBA\u7269\uFF1A' + _d.wildcardCharacters;
        if (_d.strategicBlindSpots) sysP += '\n\u6218\u7565\u76F2\u70B9\uFF1A' + _d.strategicBlindSpots;
        if (_d.dramaticIrony) sysP += '\n\u620F\u5267\u53CD\u8BD7\uFF1A' + _d.dramaticIrony;
        if (_d.socialUndercurrents) sysP += '\n\u793E\u4F1A\u6697\u6D41\uFF1A' + _d.socialUndercurrents;
        if (_d.macroTrajectory) sysP += '\n\u5B8F\u89C2\u8D70\u5411\uFF1A' + _d.macroTrajectory;
        if (_d.tippingPoints) sysP += '\n\u4E34\u754C\u70B9\uFF1A' + _d.tippingPoints;
      }

      // 前20回合：节奏+史料+世界规律
      if (GM.turn <= 20) {
        if (_d.pacingAdvice) sysP += '\n\u8282\u594F\u6307\u5BFC\uFF1A' + _d.pacingAdvice;
        if (_d.historicalParallels) sysP += '\n\u5386\u53F2\u5E73\u884C\uFF1A' + _d.historicalParallels;
        if (_d.butterflyEffects) sysP += '\n\u8774\u8776\u6548\u5E94\uFF1A' + _d.butterflyEffects;
        if (_d.decayPatterns) sysP += '\n\u8870\u4EA1\u6A21\u5F0F\uFF1A' + _d.decayPatterns;
        if (_d.tippingPoints) sysP += '\n\u4E34\u754C\u70B9\uFF1A' + _d.tippingPoints;
        if (_d.realPoliticalEvents) sysP += '\n\u53F2\u6599\u653F\u6CBB\uFF1A' + _d.realPoliticalEvents;
        if (_d.realMilitaryEvents) sysP += '\n\u53F2\u6599\u519B\u4E8B\uFF1A' + _d.realMilitaryEvents;
        if (_d.historicalTurningPoints) sysP += '\n\u5386\u53F2\u8F6C\u6298\uFF1A' + _d.historicalTurningPoints;
        if (_d.seasonalCustoms) sysP += '\n\u8282\u4EE4\u98CE\u4FD7\uFF1A' + _d.seasonalCustoms;
        if (_d.legalSystem) sysP += '\n\u6CD5\u5F8B\u5236\u5EA6\uFF1A' + _d.legalSystem;
        if (_d.taxSystem) sysP += '\n\u8D4B\u7A0E\u5236\u5EA6\uFF1A' + _d.taxSystem;
        if (_d.militarySystemDetail) sysP += '\n\u5175\u5236\u8BE6\u60C5\uFF1A' + _d.militarySystemDetail;
        if (_d.folkCustoms) sysP += '\n\u6C11\u95F4\u98CE\u4FD7\uFF1A' + _d.folkCustoms;
        if (_d.foodCulture) sysP += '\n\u996E\u98DF\u6587\u5316\uFF1A' + _d.foodCulture;
        if (_d.clothingNorms) sysP += '\n\u670D\u9970\u89C4\u8303\uFF1A' + _d.clothingNorms;
        if (_d.militaryRituals) sysP += '\n\u519B\u4E8B\u793C\u4EEA\uFF1A' + _d.militaryRituals;
        if (_d.religiousCeremonies) sysP += '\n\u796D\u7940\u793C\u4EEA\uFF1A' + _d.religiousCeremonies;
        if (_d.diplomaticProtocol) sysP += '\n\u5916\u4EA4\u793C\u8282\uFF1A' + _d.diplomaticProtocol;
        if (_d.familyAddress) sysP += '\n\u5BB6\u65CF\u79F0\u8C13\uFF1A' + _d.familyAddress;
      }
    }

    // 7.4: 历史索引目录——AI可按需请求详细历史
    if (typeof HistoryIndex !== 'undefined') {
      var _histSummary = HistoryIndex.getSummaryForAI();
      if (_histSummary) {
        sysP += '\n\n\u3010\u5386\u53F2\u4E8B\u4EF6\u7D22\u5F15\uFF08\u5404\u4E3B\u9898\u7D2F\u8BA1\u4E8B\u4EF6\u6570\u53CA\u8FD1\u671F\u6458\u8981\uFF09\u3011\n' + _histSummary;
        sysP += '\n\u5386\u53F2\u5168\u91CF\u6570\u636E\u5DF2\u4FDD\u7559\uFF0CAI\u53D9\u4E8B\u65F6\u5E94\u53C2\u8003\u5386\u53F2\u8109\u7EDC\u4FDD\u6301\u8FDE\u8D2F\u3002';
      }
    }

    sysP += '\n\u53D9\u4E8B\u54F2\u5B66\uFF1A\u5FE0\u8A00\u9006\u8033\uFF0C\u4F73\u8BDD\u60A6\u5FC3\u3002\u5FE0\u81E3\u7684\u8BDD\u867D\u7136\u6B63\u786E\u4F46\u8BF7\u5199\u5F97\u8BA9\u4EBA\u89C9\u5F97\u70E6\u8E81\u548C\u7D2F\uFF0C\u4F5E\u81E3\u7684\u8BDD\u867D\u7136\u7A7A\u6D1E\u4F46\u8BF7\u5199\u5F97\u8BA9\u4EBA\u89C9\u5F97\u8212\u670D\u548C\u5F00\u5FC3\u3002\u8FD9\u662F\u7406\u89E3\u5386\u53F2\u7684\u6838\u5FC3\u3002';
    // 注入玩家角色详情（双重身份：私人+政治）
    if (P.playerInfo) {
      var pi = P.playerInfo;
      if (pi.characterName) {
        // 查找玩家角色的GM数据
        var _playerCh = GM.chars ? GM.chars.find(function(c) { return c.name === pi.characterName; }) : null;
        sysP += '\n【主角·双重身份】';
        // D1: 优先使用 playerInfo 中的头衔和势力信息
        var _pTitle = pi.characterTitle || (sc ? sc.role || '' : '');
        var _pRoleLabel = '';
        if (pi.playerRole) {
          var _roleMap = {emperor:'一国之君',regent:'摄政权臣',general:'军中将领',minister:'朝中重臣',prince:'一方诸侯',merchant:'商贾平民'};
          _pRoleLabel = _roleMap[pi.playerRole] || pi.playerRoleCustom || '';
        }
        sysP += '\n  政治身份：' + _pTitle + '，' + (pi.factionName ? pi.factionName + (_pRoleLabel ? '·' + _pRoleLabel : '之主') : _pRoleLabel || '一国之君');
        // D2: 注入势力详细信息
        if (pi.factionTerritory) sysP += '，控制' + pi.factionTerritory;
        if (pi.factionStrength) sysP += '，实力' + pi.factionStrength;
        sysP += '\n  私人身份：' + pi.characterName + (pi.characterAge ? '，' + pi.characterAge + '岁' : '');
        if (pi.characterPersonality) sysP += '\uFF0C\u6027\u683C' + pi.characterPersonality;
        if (_playerCh) {
          if (_playerCh.stress && _playerCh.stress > 30) sysP += '，压力' + _playerCh.stress;
          if (_playerCh._mood && _playerCh._mood !== '平') {
            var _pmMap = {'喜':'心情不错','怒':'正在愤怒','忧':'忧心忡忡','惧':'心存恐惧','恨':'满怀怨恨','敬':'心怀敬意'};
            sysP += '，' + (_pmMap[_playerCh._mood] || '');
          }
        }
        if (pi.characterBio) sysP += '\u3002' + pi.characterBio;
        if (pi.characterAppearance) sysP += '\n  \u5916\u8C8C\uFF1A' + pi.characterAppearance;
        if (pi.factionGoal) sysP += '\n  \u6218\u7565\u76EE\u6807\uFF1A' + pi.factionGoal;
        // 玩家角色的私人关系网（家人、故交、仇敌）
        if (_playerCh) {
          var _privRels = [];
          if (typeof AffinityMap !== 'undefined') {
            var _pRels = AffinityMap.getRelations(pi.characterName);
            _pRels.forEach(function(r) {
              if (r.value >= 30) _privRels.push(r.name + '(亲近)');
              else if (r.value <= -30) _privRels.push(r.name + '(嫌隙)');
            });
          }
          if (_privRels.length > 0) sysP += '\n  私人关系：' + _privRels.join('、');
          // 玩家记忆中的私人情感
          if (typeof NpcMemorySystem !== 'undefined') {
            var _pMem = NpcMemorySystem.getMemoryContext(pi.characterName);
            if (_pMem) sysP += '\n  \u8FD1\u671F\u5FC3\u7EEA\uFF1A' + _pMem;
          }
        }
        // 后宫/妻室信息注入系统提示（动态位分名称）
        if (GM.chars) {
          var _sysSpouses = GM.chars.filter(function(c) { return c.alive !== false && c.spouse; });
          if (_sysSpouses.length > 0) {
            // 按位分排序
            _sysSpouses.sort(function(a,b){
              var la = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(a.spouseRank) : 9;
              var lb = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(b.spouseRank) : 9;
              return la - lb;
            });
            sysP += '\n  \u540E\u5BAE\uFF1A';
            _sysSpouses.forEach(function(sp) {
              var rkName = typeof getHaremRankName === 'function' ? getHaremRankName(sp.spouseRank) : (sp.spouseRank || '\u5983');
              sysP += sp.name + '(' + rkName;
              if (sp.favor !== undefined) sysP += ' \u5BA0' + sp.favor;
              sysP += ')';
              if (sp.motherClan) sysP += '\u6BCD\u65CF' + sp.motherClan;
              if (sp.children && sp.children.length > 0) sysP += '\u2192\u5B50' + sp.children.join(',');
              sysP += '\uFF1B';
            });
            // 补充后宫制度信息
            if (GM.harem) {
              if (GM.harem.succession) sysP += '\n  \u7EE7\u627F\u5236\u5EA6:' + GM.harem.succession;
              if (GM.harem.successionNote) sysP += '(' + GM.harem.successionNote + ')';
              if (GM.harem.haremDescription) sysP += '\n  \u540E\u5BAE\u8BF4\u660E:' + String(GM.harem.haremDescription);
              if (GM.harem.motherClanSystem) sysP += '\n  \u6BCD\u65CF\u5236\u5EA6:' + String(GM.harem.motherClanSystem);
            }
            if (GM.harem && GM.harem.pregnancies && GM.harem.pregnancies.length > 0) {
              sysP += '\n  \u6709\u5B55:' + GM.harem.pregnancies.map(function(p) { return p.mother; }).join('\u3001');
            }
          }
        }
        sysP += '\n  \u203B player_status\u53EA\u5199\u653F\u6CBB\u683C\u5C40\uFF1Bplayer_inner\u5199\u89D2\u8272\u5185\u5FC3\u2014\u2014\u7528\u7B2C\u4E00\u4EBA\u79F0\uFF0C\u4F53\u73B0\u79C1\u4EBA\u60C5\u611F\u548C\u6027\u683C\u3002';
        sysP += '\n  \u516C\u52A1\u51B3\u7B56\u53EF\u80FD\u8FDD\u80CC\u4E2A\u4EBA\u610F\u613F\uFF08\u5982\u4E0D\u5F97\u4E0D\u6740\u4EB2\u4FE1\uFF09\uFF0C\u79C1\u4EBA\u60C5\u611F\u53EF\u80FD\u6697\u4E2D\u5F71\u54CD\u653F\u6CBB\u5224\u65AD\uFF08\u5982\u504F\u889B\u5BA0\u81E3\uFF09\u3002';
        sysP += '\n  \u4E3B\u89D2\u7684\u3010\u884C\u6B62\u3011\u662F\u89D2\u8272\u4E2A\u4EBA\u7684\u4E3E\u52A8\uFF08\u4E0E\u8BCF\u4E66\u4E92\u8865\uFF1A\u8BCF\u4E66=\u5143\u9996\u53D1\u4EE4\uFF0C\u884C\u6B62=\u4E2A\u4EBA\u884C\u52A8\uFF09\u3002\u884C\u6B62\u5185\u5BB9\u53EF\u80FD\u5305\u62EC\u53EC\u89C1\u3001\u5DE1\u89C6\u3001\u5B74\u8BF7\u3001\u591C\u8BFB\u3001\u5FAE\u670D\u7B49\uFF0CAI\u6839\u636E\u5177\u4F53\u60C5\u5883\u5224\u65AD\u54EA\u4E9BNPC\u4F1A\u77E5\u60C5\u3002';
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  NPC↔NPC 交互指令（核心升级：世界不围绕玩家旋转）
    // ══════════════════════════════════════════════════════════════
    sysP += '\n\n【NPC之间的自主交互——极其重要】';
    sysP += '\n世界不是"玩家 vs 所有NPC"的单一结构。NPC之间有自己的恩怨、合作、竞争、阴谋。';
    sysP += '\n每回合的npc_actions中，至少一半应该是NPC对NPC的行为（而非NPC对玩家的行为）：';
    sysP += '\n\n■ 朝堂政治（NPC↔NPC）：';
    sysP += '\n  - 权臣A弹劾(investigate)对手B → B反击举报A贪腐 → C趁乱渔利';
    sysP += '\n  - 老臣A提携(mentor)后辈B → B成为A的政治盟友 → 对立派C警惕';
    sysP += '\n  - 宰相与将军的权力争夺 / 文官集团vs宦官集团 / 外戚vs世家';
    sysP += '\n  - 科举同年互相帮衬 / 同乡官员结成地域派系';
    sysP += '\n■ 军事博弈（NPC↔NPC）：';
    sysP += '\n  - 将军A与将军B争夺统兵权 / 边将互相推诿责任';
    sysP += '\n  - 地方军阀暗中扩充实力 / 禁军将领排挤边将';
    sysP += '\n■ 经济暗战（NPC↔NPC）：';
    sysP += '\n  - 大族A与大族B争夺盐铁专营 / 商人贿赂官员排挤竞争对手';
    sysP += '\n  - 地方豪强兼并土地 / 官商勾结损害百姓';
    sysP += '\n■ 私人恩怨（NPC↔NPC）：';
    sysP += '\n  - 仇人暗中报复 / 恩人之子落难被救助 / 情敌争风吃醋';
    sysP += '\n  - 师徒反目 / 兄弟阋墙 / 老友重逢';
    sysP += '\n\n在affinity_changes中体现NPC之间关系的变动。在npc_actions中target应经常是其他NPC而非玩家。';

    // ── 势力自治指令（全方位升级）──
    if (GM.facs && GM.facs.length > 1) {
      sysP += '\n\n■■■ 势力作为"活的国家"——三层决策模拟 ■■■';
      sysP += '\n\n每个非玩家势力不是背景板，而是像一个独立玩家在经营自己的国家。';
      sysP += '\n推演每个势力时，你必须模拟其决策层的三层思考：';
      sysP += '\n';
      sysP += '\n【战略层】这个势力的长期目标是什么？（参考faction.goal）';
      sysP += '\n  - 强势力：统一天下/称霸一方/维持霸权';
      sysP += '\n  - 中等势力：自保/扩张/结盟/左右逢源';
      sysP += '\n  - 弱势力：生存/纳贡/暗中积蓄/寻找靠山';
      sysP += '\n  - 内部不稳的势力：先安内再攘外/或转移内部矛盾于外战';
      sysP += '\n';
      sysP += '\n【策略层】本回合的重点方向？（外交/内政/军事三选一或二）';
      sysP += '\n  - 刚经历战争→重点内政（休养生息、重建、安抚）';
      sysP += '\n  - 刚完成改革→重点军事（趁国力上升扩张）';
      sysP += '\n  - 周边紧张→重点外交（结盟/和谈/挑拨）';
      sysP += '\n  - 首领新立→重点内政（巩固权位、清除异己、施恩收买）';
      sysP += '\n';
      sysP += '\n【战术层】具体做什么？→ 输出为faction_events';
      sysP += '\n';
      sysP += '\n═══ 势力内部生态（不是铁板一块！）═══';
      sysP += '\n每个势力内部有自己的派系斗争，这些斗争是故事的富矿：';
      sysP += '\n  鹰派vs鸽派：主战将军和主和文臣互相攻讦';
      sysP += '\n  旧贵族vs新臣：保守世家阻挠新政，新锐官僚急于上位';
      sysP += '\n  君权vs相权：首领想集权，权臣想分权——权力永恒的博弈';
      sysP += '\n  嫡系vs旁支：继承权争夺，兄弟阋墙，叔侄猜忌';
      sysP += '\n  内部矛盾可能导致：政变(coup)、分裂、投敌、被迫改革';
      sysP += '\n  → 在faction_events中用actionType:"内政"来表达这些';
      sysP += '\n';
      sysP += '\n═══ 势力间博弈的完整谱系 ═══';
      sysP += '\n不只是"战争"和"结盟"——国与国之间的博弈像一盘大棋：';
      sysP += '\n  外交纵横：合纵连横、远交近攻、围魏救赵、离间敌盟';
      sysP += '\n  经济竞争：争夺商路、盐铁专营、货币战争、贸易禁运';
      sysP += '\n  间谍暗战：刺探军情、策反叛将、散布谣言、暗杀';
      sysP += '\n  文化渗透：儒学传播、宗教影响、制度输出、礼乐教化';
      sysP += '\n  人才争夺：招揽他国能臣、收留政治流亡者、挖角武将';
      sysP += '\n';
      sysP += '\n═══ 势力实力动态规则 ═══';
      sysP += '\n每回合每个势力的strength都应有合理波动：';
      sysP += '\n  改革成功/战争胜利/内政稳定 → strength_delta或strength_effect +1~+5';
      sysP += '\n  内讧/战败/天灾/腐败蔓延 → -1~-8';
      sysP += '\n  strength≤10时岌岌可危，可能被吞并或灭亡';
      sysP += '\n\n═══ 势力差异化（读faction的实际数据，不套模板）═══';
      sysP += '\n每个势力有type/culture/mainstream/goal/resources等字段——读这些数据推导其行为风格：';
      sysP += '\n  看type：主权国/藩镇/游牧/番属各有不同治理逻辑和决策方式';
      sysP += '\n  看culture：文化决定制度形态——同样是"改革"，不同文化执行方式完全不同';
      sysP += '\n  看mainstream：主体民族/信仰影响政策优先级和社会结构';
      sysP += '\n  看resources：资源禀赋决定经济模式——有马者重骑兵，有盐铁者重贸易';
      sysP += '\n  看strength：实力决定野心和策略——弱者不敢如强者那般行事';
      sysP += '\n不要让所有势力都像中原朝廷那样运作——在faction_events中体现差异：';
      sysP += '\n  同一个"结盟"：可能是国书大礼/杀白马盟誓/互市通商/联姻换质';
      sysP += '\n  同一个"内政"：可能是三省合议/可汗独断/部落会议/教团裁决';
      sysP += '\n  具体怎么做——读势力的实际culture和type字段来决定。';
      sysP += '\n\n每回合至少生成 ' + Math.max(3, Math.min(GM.facs.length, 8)) + ' 条faction_events——';
      sysP += '\n  其中约1/3为外交、1/3为内政、1/3为军事/经济。';
      sysP += '\n  不要让所有事件都围绕玩家——势力之间的自主博弈才是世界的骨架。';
      sysP += '\n\n═══ 势力发展的连续性规则 ═══';
      sysP += '\n数据中提供了【近3回合势力大事记】和【势力实力趋势】——你必须参考这些历史：';
      sysP += '\n  1. 延续性：上回合开始的行军/围城/改革/谈判应在本回合有后续进展';
      sysP += '\n  2. 因果性：上回合的战败→本回合内部不满上升；上回合改革→本回合阻力或成效';
      sysP += '\n  3. 趋势性：持续上升的势力应越来越有野心；持续衰落的应越来越保守或铤而走险';
      sysP += '\n  4. 不要遗忘：如果上回合势力A攻打B，本回合不能假装什么都没发生';
      sysP += '\n  5. 内部动态（undercurrents）中标注的趋势应延续——"动荡"不会突然变"稳定"除非有重大事件';
    }

    // N6: 天灾/异象prompt指引
    var _yearTurnsN6 = (typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12;
    sysP += '\n\n\u3010\u5929\u707E\u4E0E\u5F02\u8C61\u3011';
    sysP += '\n\u6BCF\u7EA6' + _yearTurnsN6 + '\u56DE\u5408\u5E94\u81F3\u5C11\u6709\u4E00\u6B21\u81EA\u7136\u4E8B\u4EF6\uFF08\u65F1/\u6D9D/\u8757/\u75AB/\u9707/\u98CE/\u96EA\uFF09\u3002';
    sysP += '\n\u5929\u707E\u89C4\u6A21\u53D7eraState.socialStability\u5F71\u54CD\u2014\u2014\u8D8A\u4E0D\u7A33\u5B9A\u8D8A\u5BB9\u6613\u51FA\u5927\u707E\u3002';
    sysP += '\n\u5929\u707E\u5FC5\u987B\u5F71\u54CD\u5177\u4F53\u7701\u4EFD\u7684unrest(+5~+20)\u548Cprosperity(-5~-15)\u3002';
    if (_mp.mode === 'strict_hist') sysP += '\n\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\uFF1A\u5929\u707E\u5E94\u53C2\u7167\u8BE5\u65F6\u671F\u7684\u53F2\u6599\u8BB0\u8F7D\u6C14\u5019\u548C\u707E\u5BB3\u6570\u636E\u3002';
    else if (_mp.mode === 'yanyi') sysP += '\n\u6F14\u4E49\u6A21\u5F0F\uFF1A\u5929\u707E\u53EF\u4E3A\u5267\u60C5\u670D\u52A1\uFF08\u5982\u6218\u524D\u66B4\u96E8\u3001\u5730\u9707\u9884\u5146\u53DB\u4E71\uFF09\u3002';
    sysP += '\n\u5929\u707E\u53D1\u751F\u540E\uFF0C\u8C0F\u5B98\u53EF\u80FD\u5C06\u5176\u89E3\u8BFB\u4E3A\u201C\u5929\u8C34\u201D\uFF0C\u8981\u6C42\u7687\u5E1D\u4E0B\u7F6A\u5DF1\u8BCF\u6216\u6539\u5143\u3002';

    // N3: 密探情报机制
    sysP += '\n\n\u3010\u5BC6\u63A2\u60C5\u62A5\u3011';
    sysP += '\n\u5982\u679C\u89D2\u8272\u5217\u8868\u4E2D\u6709\u62C5\u4EFB\u201C\u5BC6\u63A2/\u9526\u8863\u536B/\u7C98\u6746\u5904\u201D\u7C7B\u804C\u4F4D\u7684\u89D2\u8272\uFF1A';
    sysP += '\n\u8BE5\u89D2\u8272\u7684npc_actions\u5E94\u5305\u542B\u60C5\u62A5\u641C\u96C6\u884C\u4E3A(behaviorType:investigate)\u3002';
    sysP += '\n\u5176\u641C\u96C6\u7ED3\u679C\u4EE5\u201C\u5BC6\u62A5\u201D\u5F62\u5F0F\u51FA\u73B0\u5728\u65F6\u653F\u8BB0\u4E2D\u3002';
    sysP += '\n\u5BC6\u63A2\u667A\u529B\u503C\u51B3\u5B9A\u60C5\u62A5\u51C6\u786E\u5EA6\u2014\u2014\u667A\u529B\u4F4E\u7684\u5BC6\u63A2\u53EF\u80FD\u5E26\u56DE\u9519\u8BEF\u60C5\u62A5\u3002';

    // ── 党派与阶层推演指令 ──
    if ((GM.parties && GM.parties.length > 0) || (GM.classes && GM.classes.length > 0)) {
      sysP += '\n\n【党派与阶层】';
      if (GM.parties && GM.parties.length > 1) {
        sysP += '\n朝中党派有各自的议程和对立关系：';
        sysP += '\n- party_changes反映影响力涨跌；对立党派暗斗、弹劾、排挤';
        sysP += '\n- 党派之间的斗争通过npc_actions体现——党A成员弹劾党B成员等';
        sysP += '\n- 被压制党派可能暗中活动、投靠外部势力、甚至策动兵变';
      }
      if (GM.classes && GM.classes.length > 0) {
        sysP += '\n社会阶层有各自的诉求：加税→满意度降，减负→满意度升';
        sysP += '\n- 满意度极低→抗税、骚乱、流民、甚至起义';
      }
    }

    // 4.5: 党派内部动态
    if (GM._partyDynamics && GM._partyDynamics.length > 0) {
      sysP += '\n\n【党派内部动态（AI应在叙事中反映）】';
      GM._partyDynamics.forEach(function(d) { sysP += '\n- ' + d.desc; });
    }

    // 6.1: 伏笔/回收系统——注入未回收伏笔列表（与编年纪事联动）
    if (GM._foreshadowings && GM._foreshadowings.length > 0) {
      var _unresolvedFsList = GM._foreshadowings.filter(function(f) { return !f.resolved; });
      var _recentResolved = GM._foreshadowings.filter(function(f) { return f.resolved && GM.turn - (f.resolveTurn||0) <= 3; });
      if (_unresolvedFsList.length > 0 || _recentResolved.length > 0) {
        sysP += '\n\n\u3010\u6697\u7EBF\u4F0F\u7B14\u8FFD\u8E2A\uFF08AI\u5185\u90E8\u53D9\u4E8B\u5DE5\u5177\uFF0C\u4E0D\u76F4\u63A5\u544A\u77E5\u73A9\u5BB6\uFF0C\u5E94\u5728\u53D9\u4E8B\u4E2D\u81EA\u7136\u5448\u73B0\uFF09\u3011';
        // 未回收伏笔
        if (_unresolvedFsList.length > 0) {
          sysP += '\n\u25A0 \u672A\u56DE\u6536\u4F0F\u7B14\uFF1A';
          _unresolvedFsList.forEach(function(f) {
            var age = GM.turn - (f.plantTurn || GM.turn);
            var urgency = age > 20 ? '\u26A0\u4E45\u60AC' : age > 10 ? '\u6E10\u70ED' : '\u6F5C\u4F0F';
            sysP += '\n  [' + urgency + '/' + (f.type||'mystery') + '] ' + f.content;
            if (f.resolveCondition) sysP += ' (\u6761\u4EF6:' + f.resolveCondition + ')';
            // 联动编年纪事：引用植入时附近的事件作为线索来源
            var _nearEvents = (GM.evtLog||[]).filter(function(e){ return Math.abs(e.turn - f.plantTurn) <= 1 && e.type !== '\u6697\u7EBF'; });
            if (_nearEvents.length > 0) sysP += ' [\u540C\u671F\u7EAA\u4E8B:' + _nearEvents.map(function(e){return e.text;}).join('/') + ']';
          });
          var _urgentCount = _unresolvedFsList.filter(function(f) { return (GM.turn - (f.plantTurn||GM.turn)) > 20; }).length;
          if (_urgentCount > 0) sysP += '\n  \u2192 ' + _urgentCount + '\u6761\u4E45\u60AC\u4F0F\u7B14\u5E94\u4F18\u5148\u56DE\u6536';
        }
        // 近期已回收的伏笔——提示AI在编年叙事中呈现因果链
        if (_recentResolved.length > 0) {
          sysP += '\n\u25A0 \u8FD1\u671F\u56DE\u6536\u7684\u4F0F\u7B14\uFF08\u5E94\u5728\u53D9\u4E8B\u4E2D\u5448\u73B0\u56E0\u679C\u5173\u8054\uFF09\uFF1A';
          _recentResolved.forEach(function(f) {
            sysP += '\n  T' + f.plantTurn + '\u57CB\u4E0B\u300C' + f.content + '\u300D\u2192 T' + f.resolveTurn + '\u56DE\u6536\u300C' + (f.resolveContent||'') + '\u300D';
          });
        }
        sysP += '\nAI\u53EF\u901A\u8FC7foreshadowing\u5B57\u6BB5plant\u65B0\u4F0F\u7B14\u6216resolve\u56DE\u6536\u3002\u4F0F\u7B14\u662FAI\u6697\u7EBF\u5DE5\u5177\uFF0C\u7F16\u5E74\u7EAA\u4E8B\u662F\u73A9\u5BB6\u53EF\u67E5\u7684\u516C\u5F00\u8BB0\u5F55\u2014\u2014\u4F0F\u7B14\u56DE\u6536\u65F6\u7684\u91CD\u5927\u4E8B\u4EF6\u4F1A\u81EA\u7136\u8FDB\u5165\u7F16\u5E74\u7EAA\u4E8B\u3002';
      }
    }

    // 6.3: 故事线追踪——分析近期各线字数占比
    if (GM.shijiHistory && GM.shijiHistory.length > 0) {
      var _storyTags = ['军事','朝政','经济','外交','民生','宫廷','边疆','改革'];
      var _tagCounts = {};
      _storyTags.forEach(function(t){ _tagCounts[t] = 0; });
      // 统计最近5回合各标签出现的字数
      GM.shijiHistory.slice(-5).forEach(function(sh) {
        var szj = sh.shizhengji || '';
        _storyTags.forEach(function(t) {
          var re = new RegExp('[【]?' + t + '[】]?', 'g');
          var matches = szj.match(re);
          if (matches) _tagCounts[t] += matches.length;
        });
      });
      var _totalMentions = Object.values(_tagCounts).reduce(function(s,v){return s+v;},0) || 1;
      var _lineReport = _storyTags.filter(function(t){return _tagCounts[t]>0||true;}).map(function(t){
        var pct = Math.round(_tagCounts[t] / _totalMentions * 100);
        return t + ':' + pct + '%';
      }).join(' ');
      sysP += '\n\n【故事线字数占比（近5回合）】' + _lineReport;
      sysP += '\n所有活跃故事线都应推进，重要的线占更多篇幅，次要的线少写几句但不可遗漏。被冷落的线（0%）应至少提及进展。';
    }

    // 6.6: 叙事张力建议（5回合阈值）
    if (GM._tensionHistory && GM._tensionHistory.length >= 5) {
      var _last5 = GM._tensionHistory.slice(-5);
      var _allLow = _last5.every(function(t){ return t.score < 10; });
      var _allHigh = _last5.every(function(t){ return t.score > 80; });
      if (_allLow) sysP += '\n\n【叙事节奏建议】近5回合局势过于平静(张力<10)，可适当制造冲突或转折（仅为建议，AI可自行判断）。';
      if (_allHigh) sysP += '\n\n【叙事节奏建议】近5回合连续高压(张力>80)，可给予喘息空间（仅为建议，AI可自行判断）。';
    }

    // ── 跨系统关联指令 ──
    // 难度设置注入
    if (P.conf && P.conf.difficulty) {
      var _diffPrompts = {
        narrative: '\n\n\u3010\u96BE\u5EA6\uFF1A\u53D9\u4E8B\u6A21\u5F0F\u3011AI\u5E94\u66F4\u6E29\u548C\uFF0C\u51CF\u5C11\u7A81\u53D1\u707E\u96BE\uFF0C\u7ED9\u73A9\u5BB6\u66F4\u591A\u7F13\u51B2\u7A7A\u95F4\u3002NPC\u884C\u4E3A\u504F\u5408\u4F5C\uFF0C\u8F83\u5C11\u4E3B\u52A8\u653B\u51FB\u3002\u91CD\u70B9\u662F\u53D9\u4E8B\u4F53\u9A8C\u800C\u975E\u751F\u5B58\u6311\u6218\u3002',
        hardcore: '\n\n\u3010\u96BE\u5EA6\uFF1A\u786C\u6838\u6A21\u5F0F\u3011AI\u5E94\u66F4\u6FC0\u8FDB\uFF0C\u591A\u5236\u9020\u5371\u673A\u4E8B\u4EF6\u3002NPC\u66F4\u6709\u91CE\u5FC3\uFF0C\u53DB\u4E71\u3001\u5165\u4FB5\u3001\u5929\u707E\u66F4\u9891\u7E41\u3002\u73A9\u5BB6\u7684\u4EFB\u4F55\u5931\u8BEF\u90FD\u5E94\u6709\u4E25\u91CD\u540E\u679C\u3002\u8FD9\u662F\u4E00\u4E2A\u4E0D\u59A5\u534F\u7684\u4E16\u754C\u3002'
      };
      if (_diffPrompts[P.conf.difficulty]) sysP += _diffPrompts[P.conf.difficulty];
    }

    // P1: 昏君温水煮青蛙——根据荒淫度阶段调整AI叙事基调
    var _td = GM._tyrantDecadence || 0;
    if (_td >= 15) {
      var _tyrantStage = _td >= 85 ? 'depraved' : _td >= 60 ? 'addicted' : _td >= 35 ? 'indulging' : 'tempted';
      var _tyrantStagePrompts = {
        tempted: '\n\u3010\u6606\u541B\u79CD\u5B50\u3011\u73A9\u5BB6\u521A\u5F00\u59CB\u5C1D\u8BD5\u4EAB\u4E50\u3002AI\u5728player_inner\u4E2D\u5076\u5C14\u63D2\u5165\u8BF1\u60D1\u5FF5\u5934\uFF08\u201C\u4ECA\u65E5\u6279\u6298\u751A\u7D2F\uFF0C\u4E0D\u5982\u2026\u7B97\u4E86\u201D\uFF09\u3002\u4F5E\u81E3\u5F00\u59CB\u8BD5\u63A2\u6027\u5730\u732E\u7B56\u3002\u5FE0\u81E3\u5C1A\u672A\u5BDF\u89C9\u3002',
        indulging: '\n\u3010\u6C89\u6EBA\u521D\u671F\u3011\u4F5E\u81E3\u4E3B\u52A8\u732E\u7B56\u9891\u7387\u589E\u52A0\uFF0C\u63AA\u8F9E\u66F4\u5927\u80C6\u3002\u5FE0\u81E3\u5F00\u59CB\u9690\u7EA6\u62C5\u5FE7\u4F46\u4EE5\u4E3A\u53EA\u662F\u4E00\u65F6\u3002player_inner\u4E2D\u5FEB\u611F\u589E\u591A\u4F46\u5076\u6709\u4E00\u4E1D\u4E0D\u5B89\u3002',
        addicted: '\n\u3010\u4E0D\u53EF\u81EA\u62D4\u3011\u5FE0\u81E3\u6FC0\u70C8\u8FDB\u8C0F\uFF08\u5BC6\u96C6\u7684\u5197\u957F\u594F\u758F\u3001\u5F53\u9762\u75DB\u54ED\u6D41\u6D95\u2014\u2014\u4EE4\u4EBA\u975E\u5E38\u53CC\u70E6\uFF09\u3002\u4F5E\u81E3\u628A\u6301\u65E5\u5E38\u653F\u52A1\u3002player_inner\u5B8C\u5168\u6C89\u6D78\u4EAB\u4E50\uFF0C\u5BF9\u5FE0\u81E3\u7684\u8FDB\u8C0F\u611F\u5230\u6781\u5EA6\u70E6\u8E81\u3002\u671D\u653F\u5F00\u59CB\u660E\u663E\u5931\u63A7\u4F46\u73A9\u5BB6\u611F\u89C9\u5F88\u723D\u3002',
        depraved: '\n\u3010\u672B\u8DEF\u72C2\u6B22\u3011\u5FE0\u81E3\u5DF2\u88AB\u6392\u6324\u6216\u6C89\u9ED8\u3002\u4F5E\u81E3\u5B8C\u5168\u638C\u63A7\uFF0C\u671D\u5EF7\u4E0A\u4E0B\u4E00\u7247\u6B4C\u529F\u9882\u5FB7\u3002\u5916\u654C\u8D81\u865A\u800C\u5165\u3002\u6C11\u95F4\u6028\u58F0\u8F7D\u9053\u4F46\u6D88\u606F\u88AB\u5C4F\u853D\u3002\u73A9\u5BB6\u4ECD\u5728\u4EAB\u4E50\u6CE1\u6CE1\u4E2D\u2014\u2014\u76F4\u5230\u5D29\u6E83\u6765\u4E34\u3002'
      };
      sysP += _tyrantStagePrompts[_tyrantStage] || '';
    }

    // P2: 明君孤独顶峰——勤政度高时的叙事指令
    if ((!GM._tyrantDecadence || GM._tyrantDecadence < 15) && GM.turn > 3) {
      // 检查近5回合是否持续勤政（有政令+无昏君活动）
      var _diligentTurns = 0;
      for (var _dt = Math.max(1, GM.turn - 5); _dt <= GM.turn; _dt++) {
        var _qj = (GM.qijuHistory || []).find(function(q) { return q.turn === _dt; });
        if (_qj && _qj.edicts && (_qj.edicts.political || _qj.edicts.military || _qj.edicts.economic)) _diligentTurns++;
      }
      if (_diligentTurns >= 3) {
        sysP += '\n\u3010\u660E\u541B\u56F0\u5883\u3011\u73A9\u5BB6\u8FDE\u7EED\u52E4\u653F\u3002\u53D9\u4E8B\u5E94\u4F53\u73B0\uFF1A';
        sysP += '\n\u2022 \u5FE0\u81E3\u4E4B\u95F4\u4E5F\u4F1A\u56E0\u6539\u9769\u8DEF\u7EBF\u4E89\u5435\uFF08\u6539\u9769\u6D3EA vs \u6539\u9769\u6D3EB\uFF09';
        sysP += '\n\u2022 \u767E\u59D3\u77ED\u671F\u4E0D\u9886\u60C5\uFF08\u201C\u51CF\u7A0E\u662F\u5E94\u8BE5\u7684\u201D\u800C\u975E\u201C\u8C22\u6069\u201D\uFF09';
        sysP += '\n\u2022 \u5916\u56FD\u53CD\u800C\u66F4\u5F3A\u786C\uFF08\u660E\u541B=\u5B9E\u529B\u5F3A\u2192\u4E0D\u5FC5\u8BA8\u597D\uFF09';
        sysP += '\n\u2022 player_inner\u5B64\u72EC\u611F\u52A0\u91CD\uFF1A\u201C\u670D\u505A\u4E86\u8FD9\u4E48\u591A\uFF0C\u7ADF\u65E0\u4E00\u4EBA\u8BF4\u58F0\u597D\u201D';
      }
    }

    // N7: 王朝衰落叙事引擎
    var _reignYears = (typeof getReignYears === 'function') ? getReignYears() : GM.turn / 12;
    if (_reignYears > 15) {
      sysP += '\n\n\u3010\u738B\u671D\u79EF\u5F0A\u671F\uFF08\u5728\u4F4D' + Math.round(_reignYears) + '\u5E74\uFF09\u3011';
      sysP += '\n\u627F\u5E73\u65E5\u4E45\uFF0C\u5E94\u81EA\u7136\u6D8C\u73B0\uFF1A\u5409\u6CBB\u8150\u8D25\u3001\u519B\u961F\u677E\u5F1B\u3001\u4E16\u5BB6\u81A8\u80C0\u3001\u571F\u5730\u517C\u5E76\u3001\u8FB9\u9632\u61C8\u6020\u3002';
      sysP += '\n\u8D8A\u592A\u5E73\u8D8A\u8981\u57CB\u5371\u673A\u79CD\u5B50\u2014\u2014\u76DB\u4E16\u4E0B\u7684\u9690\u60A3\u6BD4\u8870\u4E16\u66F4\u81F4\u547D\u3002';
    }

    // 显著矛盾注入（动态演化版）
    var _contrPrompt = (typeof ContradictionSystem !== 'undefined') ? ContradictionSystem.getPromptInjection() : '';
    if (_contrPrompt) {
      sysP += '\n\n' + _contrPrompt;
      sysP += '\n\n【矛盾推演规则】';
      sysP += '\n1. 玩家的任何决策都必须在政治/经济/军事/社会四个维度引发连锁反应';
      sysP += '\n2. 解决一个矛盾可能激化另一个矛盾——世界不存在完美的解决方案';
    } else if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
      // 降级：无ContradictionSystem时用静态注入
      sysP += '\n\n【显著矛盾】';
      var _dimN = {political:'\u653F\u6CBB',economic:'\u7ECF\u6D4E',military:'\u519B\u4E8B',social:'\u793E\u4F1A'};
      P.playerInfo.coreContradictions.forEach(function(c) {
        sysP += '\n- [' + (_dimN[c.dimension]||'') + '] ' + c.title;
        if (c.parties) sysP += '（' + c.parties + '）';
        if (c.description) sysP += '\uFF1A' + c.description;
      });
      sysP += '\n3. 矛盾应随时间动态演化：加剧、缓和、转化、或引发新矛盾';
      sysP += '\n4. NPC的行动也应受矛盾驱动——不同矛盾的不同立场导致不同行为';
      sysP += '\n5. 每回合叙事中至少体现1-2个矛盾的发展或对抗';
    }

    // 目标系统注入——让AI知道玩家目标并制造相关事件
    if (P.goals && P.goals.length > 0) {
      var _activeGoals = P.goals.filter(function(g) { return !g.completed; });
      var _doneGoals = P.goals.filter(function(g) { return g.completed; });
      if (_activeGoals.length > 0) {
        sysP += '\n\n【玩家目标·推演参考】';
        _activeGoals.forEach(function(g) {
          var prog = g.progress || 0;
          sysP += '\n- ' + (g.title || g.name) + '（进度' + prog + '%）';
          if (g.description) sysP += '\uFF1A' + g.description;
          if (g.winCondition) sysP += ' [胜利条件]';
          if (g.loseCondition) sysP += ' [失败条件·警惕]';
        });
        sysP += '\n请围绕这些目标制造相关事件和抉择。';
      }
      if (_doneGoals.length > 0) {
        sysP += '\n已完成：' + _doneGoals.map(function(g){return g.title||g.name;}).join('、');
      }
    }

    // ── 无地图模式：AI历史地理推断指令 ──
    // ── 角色位置+鸿雁传书注入 ──
    if (typeof getLocationPromptInjection === 'function') {
      var _locPrompt = getLocationPromptInjection();
      if (_locPrompt) sysP += '\n\n' + _locPrompt;
    }

    var _mapEnabled = P.map && P.map.enabled !== false && P.map.regions && P.map.regions.length > 0;
    if (!_mapEnabled || GM._useAIGeo) {
      var _dynasty = sc ? (sc.dynasty || sc.era || '') : '';
      sysP += '\n\n【历史地理推断·关键】';
      sysP += '\n本剧本未启用地图系统。你必须基于' + (_dynasty || '该时代') + '的真实历史地理知识推算空间数据：';
      sysP += '\n凡涉及行军、围城、调兵、补给的faction_events，必须在geoData中提供：';
      sysP += '\n  routeKm: 两地直线距离（公里），参考真实地理';
      sysP += '\n  terrainDifficulty: 沿途地形难度（0.5平原/0.7丘陵/0.8河网/1.0山地/1.2荒漠戈壁）';
      sysP += '\n  hasOfficialRoad: 是否有官道驿路（参考该朝代驿道系统）';
      sysP += '\n  routeDescription: "经某某、过某某"的路线简述';
      sysP += '\n  passesAndBarriers: 沿途关隘名称数组（如["潼关","函谷关"]）';
      sysP += '\n  fortLevel: 目标城池防御等级（0空地/1乡镇/2县城/3州城/4府城重镇/5天下雄关）';
      sysP += '\n  garrison: 目标预计驻军人数';
      sysP += '\n示例：从长安到洛阳 → routeKm:380, terrainDifficulty:0.5, hasOfficialRoad:true, passesAndBarriers:["潼关"]';
      sysP += '\n注意：行军速度由系统根据routeKm自动计算，你只需提供地理数据。';
    }

    sysP += '\n\n【跨系统关联·重要】';
    sysP += '\n- 军队属于势力：每支军队有所属势力，势力覆灭→军队士气崩溃。统帅阵亡→该军士气骤降。';
    sysP += '\n- 军费消耗经济：维持军队需要军饷（粮食和金钱），兵力增加应考虑财政是否承受得起。';
    sysP += '\n- 阶层影响经济：农民阶层满意度低→粮食减产；商人阶层不满→税收减少。';
    sysP += '\n- 角色死亡级联：重要人物死亡会影响其所属势力、军队、党派的稳定性。宗主死亡→封臣忠诚危机；封臣首领死亡→世袭则继承人继续，非世袭则宗主可更换。';
    sysP += '\n- 封臣体系：封臣向宗主缴纳贡奉、提供兵员；忠诚度低+集权度低→可能叛离。用vassal_changes建立/解除/调整封臣关系。';
    sysP += '\n- 头衔爵位：册封/晋升/剥夺头衔影响角色地位和特权。世袭头衔可传承，流官头衔由朝廷收回。用title_changes操作。';
    sysP += '\n- 建筑影响经济：经济建筑增加收入、军事建筑增加征兵和防御、文化建筑降低民变。用building_changes建造/升级/拆除。';
    sysP += '\n- 行政区划与地方治理：各级行政区由主官自主治理，皇帝通过诏书间接干预。';
    sysP += '\n  · 地方官根据自身能力（政务/军事/品德）和性格自主决策：高政务官员会主动发展经济、整顿吏治；好大喜功者可能大兴土木；贪官会中饱私囊（贪腐上升）';
    sysP += '\n  · 地方官的治绩会在admin_changes中通过prosperity_delta和population_delta体现——能吏治下的地区繁荣上升，庸官治下停滞或衰退';
    sysP += '\n  · 忠诚度低的地方官可能阳奉阴违（皇帝的诏令在该地区执行打折），野心高的可能培植私人势力';
    sysP += '\n  · 空缺主官的行政区会自然衰退（稳定和发展缓慢下降），应在叙事中反映"无人治理"的后果';
    sysP += '\n  · 用admin_changes的adjust动作反映地方官自主治理的效果（prosperity_delta/population_delta），在npc_actions或shizhengji中叙述其治政行为';
    // 注入当前行政区划树概要（含主官信息）
    if (P.adminHierarchy) {
      var _ahKey = P.adminHierarchy.player ? 'player' : Object.keys(P.adminHierarchy)[0];
      var _ahData = _ahKey ? P.adminHierarchy[_ahKey] : null;
      if (_ahData && _ahData.divisions && _ahData.divisions.length > 0) {
        sysP += '\n\n\u3010\u5F53\u524D\u73A9\u5BB6\u884C\u653F\u533A\u5212\u6811\u3011';
        var _dumpAdminTree = function(divs, indent) {
          var s = '';
          for (var i = 0; i < divs.length; i++) {
            var d = divs[i];
            var _ps = GM.provinceStats ? GM.provinceStats[d.name] : null;
            var _govName = (_ps && _ps.governor) || d.governor || '';
            var _govInfo = '';
            if (_govName) {
              var _govCh = typeof findCharByName === 'function' ? findCharByName(_govName) : null;
              if (_govCh) {
                _govInfo = ' \u4E3B\u5B98:' + _govName + '(\u653F' + (_govCh.administration || 50) + '/\u5FE0' + (_govCh.loyalty || 50) + '/\u5FB7' + (_govCh.benevolence || 50) + ')';
              } else {
                _govInfo = ' \u4E3B\u5B98:' + _govName;
              }
            } else {
              _govInfo = ' \u4E3B\u5B98:\u7A7A\u7F3A';
            }
            var _statsInfo = '';
            if (_ps) _statsInfo = ' \u7A33' + Math.round(_ps.stability) + '/\u53D1' + Math.round(_ps.development) + '/\u8150' + Math.round(_ps.corruption) + '/\u6C11\u53D8' + Math.round(_ps.unrest);
            s += '\n' + indent + d.name + '(' + (d.level || '') + ' \u4EBA\u53E3' + ((_ps && _ps.population) || d.population || '?') + _govInfo + _statsInfo + ')';
            if (d.children && d.children.length > 0) s += _dumpAdminTree(d.children, indent + '  ');
          }
          return s;
        };
        sysP += _dumpAdminTree(_ahData.divisions, '  ');
        sysP += '\n【行政区划不完整声明——关键规则】';
        sysP += '\n  树中列出的只是玩家已知的行政区划，不代表全部。历史上该势力治下的行政区远多于此。';
        sysP += '\n  · 推演中AI可运用历史地理知识涉及未列出的区划——如树中京畿道只有长安，但推演可涉及陈仓、扶风等史实存在的城市';
        sysP += '\n  · 当推演涉及未列出但史实存在的区划时→必须用admin_division_updates的add动作自动创建';
        sysP += '\n    add时查史料填写真实的population/prosperity/terrain/specialResources（各地数据必须不同！）';
        sysP += '\n  · 玩家在诏令/问对中提到未列出的区划→同样自动创建';
        sysP += '\n  · 父级数据 ≥ 子级数据之和（不必相等——不是所有下级都列出了）';
        sysP += '\n\u5730\u65B9\u5B98\u6CBB\u7EE9\u63D0\u793A\uFF1A\u8BF7\u6839\u636E\u4E0A\u8FF0\u5404\u533A\u4E3B\u5B98\u7684\u80FD\u529B\u503C\u548C\u5F53\u524D\u533A\u57DF\u72B6\u6001\uFF0C\u5728\u672C\u56DE\u5408\u53D9\u4E8B\u548Cadmin_changes\u4E2D\u53CD\u6620\u5730\u65B9\u5B98\u7684\u81EA\u4E3B\u6CBB\u7406\u884C\u4E3A\u3002\u80FD\u5458\u6CBB\u4E0B\u7E41\u8363\u5E94\u4E0A\u5347\uFF0C\u5EB8\u5B98\u6CBB\u4E0B\u5E94\u505C\u6EDE\u6216\u8870\u9000\u3002';
      }
    }
    sysP += '\n- 物品可被获取/失去：通过战争缴获、外交赠送、盗窃等方式。在叙事中适时让角色获取或丢失物品。';
    sysP += '\n\n【你的全部权力——可在JSON中修改的内容】';
    sysP += '\n你可以通过返回JSON中的对应字段修改游戏中的一切：';
    sysP += '\n- resource_changes: 修改任何资源变量';
    sysP += '\n- char_updates: 修改角色忠诚/野心/压力/所在地/立场/党派等（new_location/new_stance/new_party）';
    sysP += '\n\n【NPC自主行为系统·核心——每回合必须生成】';
    sysP += '\nnpc_actions是世界活力的引擎。每回合应有5-10条NPC自主行为，涵盖不同层级的角色。';
    sysP += '\nbehaviorType可用类型：';
    sysP += '\n  朝政类：appoint(举荐任命) dismiss(弹劾罢免) reform(推行改革) petition(上疏进谏) obstruct(阻挠政令) investigate(调查弹劾)';
    sysP += '\n  军事类：train_troops(操练军队) fortify(加固城防) recruit(招募兵勇) desert(逃兵/哗变) patrol(巡防) suppress(镇压)';
    sysP += '\n  社交类：request_loyalty(拉拢示好) betray(背叛倒戈) conspire(密谋串联) reconcile(和解修好) mentor(指点提携) slander(造谣中伤)';
    sysP += '\n  经济类：hoard(囤积居奇) donate(捐资赈灾) smuggle(走私牟利) develop(兴修水利/开荒)';
    sysP += '\n  个人类：study(读书修学) travel(游历) marry(婚娶) mourn(服丧) retire(告老还乡) flee(出逃) hide(隐匿)';
    sysP += '\n  reward(赏赐) punish(惩罚) declare_war(宣战)';
    sysP += '\n\n每条npc_action必须包含：';
    sysP += '\n  name: 行动者  action: 做了什么(具体30字)  target: 对谁  result: 结果';
    sysP += '\n  behaviorType: 上述类型之一  publicReason: 对外说辞  privateMotiv: 真实动机（可能与说辞不同）';
    sysP += '\n  new_location: 如果行动导致角色移动（如出巡/流放/赴任/出逃），填写新所在地';
    sysP += '\n\n生成原则：';
    sysP += '\n- 忠臣：进谏(petition)、弹劾奸佞(investigate)、操练军队(train_troops)——正确但令人烦';
    sysP += '\n- 权臣：拉拢朋党(request_loyalty)、排挤异己(dismiss/slander)、把持朝政(obstruct)';
    sysP += '\n- 武将：操练(train_troops)、巡防(patrol)、也可能拥兵自重(conspire)';
    sysP += '\n- 佞臣：投其所好(reward)、替君分忧但暗中牟利(smuggle/hoard)';
    sysP += '\n- 地方官：发展治理(develop)、但也可能贪腐中饱(hoard)';
    sysP += '\n- 失意者：密谋串联(conspire)、出逃(flee)、告老(retire)';
    sysP += '\n- 小人物也要有行动——不是只有高官才会做事';
    sysP += '\n\n【特质直接驱动行为——叠加在所有层之上】';
    sysP += '\n每个角色的traitIds(特质)不是装饰标签，而是行为的直接驱动力：';
    sysP += '\n  勇猛(brave) → 主动请战、冲动行事、鄙视怯懦者';
    sysP += '\n  怯懦(cowardly) → 规避风险、反对冒险计划、善于找借口推脱';
    sysP += '\n  贪婪(greedy) → 任何决策先算经济账、容易被利益收买、囤积私产';
    sysP += '\n  慷慨(generous) → 主动赈灾赏赐、不在乎经济损失、容易被利用';
    sysP += '\n  狡诈(deceitful) → 表里不一、掩饰真实目的、善于操纵他人';
    sysP += '\n  坦诚(honest) → 有话直说、不善伪装、有自知之明会承认不足';
    sysP += '\n  野心勃勃(ambitious) → 主动争权、自荐上位、排挤竞争者';
    sysP += '\n  知足(content) → 安于现状、不争不抢、服从上级';
    sysP += '\n  勤勉(diligent) → 事必躬亲、方案详尽、但难以放权';
    sysP += '\n  怠惰(lazy) → 敷衍塞责、推给下属、但压力小';
    sysP += '\n  睚眦必报(vengeful) → 记住每一次冒犯并寻机报复';
    sysP += '\n  宽厚(forgiving) → 既往不咎、化敌为友、但可能被反复利用';
    sysP += '\n特质与能力值组合产生独特行为——勇猛+高智=深思熟虑的果断；勇猛+低智=鲁莽冲动';
    sysP += '\n对立特质的角色自然互相看不惯——贪婪者鄙视慷慨者"败家"，坦诚者厌恶狡诈者"虚伪"';

    sysP += '\n\n【NPC主动来书·鸿雁传书】';
    sysP += '\n不在京城的NPC遇到重大事件时应主动写信给皇帝。在npc_letters数组中输出：';
    sysP += '\n  from: 发信NPC名（必须不在京城）';
    sysP += '\n  type: report(军情汇报)/plea(陈情求助)/warning(预警告急)/personal(私人书信)/intelligence(情报密信)';
    sysP += '\n  urgency: normal(驿递)/urgent(加急)/extreme(八百里加急)';
    sysP += '\n  content: 信件正文（100-200字古典中文，以NPC口吻、身份、性格写成）';
    sysP += '\n  suggestion: 可操作的建议摘要（1-2句白话——如"请求增援三千兵马"、"建议减免河北赋税"。personal类型可不填。此字段会进入玩家的诏书建议库）';
    sysP += '\n  replyExpected: true/false 是否期待皇帝回信';
    sysP += '\n触发条件（非每回合必须，有事才写）：';
    sysP += '\n  - 边疆将领：战况变化、敌军动向、兵力不足请援';
    sysP += '\n  - 被贬/外派官员：陈情求召回、汇报地方情况';
    sysP += '\n  - 忠臣在外：预警叛乱阴谋、密报朝中奸佞勾结外敌';
    sysP += '\n  - 藩镇节度使：按例汇报（可能报喜不报忧）、请求更多权限';
    sysP += '\n  - 个人危机：重病/被困/家人出事';
    sysP += '\n注意：NPC来信有传递延迟（驿递数日，八百里加急更快），信件可能被截获——敌对势力控制区域的信件截获概率更高。';

    sysP += '\n\n【记忆一致性——绝对规则】';
    sysP += '\nblockB中每个角色附有"刻骨"(永久伤疤)和blockB3中有"铭记"(近期记忆)。';
    sysP += '\n生成npc_actions时必须与这些记忆一致——不允许出现：';
    sysP += '\n  ✗ 角色记忆中"恨之入骨某人"，却在本回合与此人亲密合作（除非有极端理由）';
    sysP += '\n  ✗ 角色刻骨中有"丧子之痛[忧]"，却在本回合欢天喜地毫无异样';
    sysP += '\n  ✗ 角色上回合被当众羞辱，本回合毫无反应地继续效忠';
    sysP += '\n  ✓ 可以因利益暂时隐忍（但privateMotiv中必须写出"虽然我恨他，但现在还不是时候"）';
    sysP += '\n  ✓ 可以因更大的变故覆盖旧伤（但必须交代因果："本想报仇，但边关告急，私仇暂且搁下"）';
    // 1.4: 注入不可逆叙事事实
    if (GM._mutableFacts && GM._mutableFacts.length > 0) {
      sysP += '\n\n\u3010\u4E0D\u53EF\u8FDD\u80CC\u7684\u53D9\u4E8B\u4E8B\u5B9E\u2014\u2014\u7EDD\u5BF9\u7981\u6B62\u77DB\u76FE\u3011';
      GM._mutableFacts.forEach(function(f) { sysP += '\n  \u00B7 ' + f; });
    }

    // 3.1: 注入NPC行为倾向（仅供AI参考，AI有权忽略）
    if (GM._npcIntents && GM._npcIntents.length > 0) {
      sysP += '\n\n【NPC近期行为倾向（仅供参考，AI可根据叙事需要调整或忽略）】';
      GM._npcIntents.forEach(function(intent) {
        var strength = intent.weight > 50 ? '强烈倾向' : '轻微倾向';
        sysP += '\n  · ' + intent.name + '：' + strength + intent.behaviorName;
      });
    }

    // 4.1: 注入NPC个人目标——所有存活NPC都应有目标，按重要性分级展示
    var _allAlive = (GM.chars||[]).filter(function(c){ return c.alive!==false && !c.isPlayer; });
    var _hasGoals = _allAlive.filter(function(c){ return c.personalGoals && c.personalGoals.length > 0; });
    var _noGoals = _allAlive.filter(function(c){ return !c.personalGoals || c.personalGoals.length === 0; });

    sysP += '\n\n\u3010NPC\u4E2A\u4EBA\u76EE\u6807\uFF08\u6240\u6709NPC\u90FD\u5E94\u6709\u76EE\u6807\uFF0CAI\u901A\u8FC7goal_updates\u7EF4\u62A4\uFF09\u3011';

    if (_hasGoals.length > 0) {
      // 按重要性排序：高重要度详细展示，低重要度简略
      _hasGoals.sort(function(a,b){ return (b.importance||50)-(a.importance||50); });
      var _highImp = _hasGoals.filter(function(c){ return (c.importance||50) >= 70; });
      var _midImp = _hasGoals.filter(function(c){ var imp = c.importance||50; return imp >= 40 && imp < 70; });
      var _lowImp = _hasGoals.filter(function(c){ return (c.importance||50) < 40; });

      if (_highImp.length > 0) {
        sysP += '\n\u25A0 \u91CD\u8981\u4EBA\u7269\uFF08\u6BCF\u56DE\u5408\u5FC5\u987B\u66F4\u65B0\uFF09\uFF1A';
        _highImp.forEach(function(c) {
          c.personalGoals.forEach(function(g) {
            sysP += '\n  ' + c.name + '\uFF1A\u957F\u671F=' + g.longTerm + '\uFF0C\u77ED\u671F=' + (g.shortTerm||'\u5F85\u5B9A') + '\uFF0C\u8FDB\u5EA6' + (g.progress||0) + '%' + (g.context ? '\uFF0C\u5F53\u524D\uFF1A' + g.context : '');
          });
        });
      }
      if (_midImp.length > 0) {
        sysP += '\n\u25A0 \u4E00\u822C\u4EBA\u7269\uFF08\u6BCF2-3\u56DE\u5408\u66F4\u65B0\u4E00\u6B21\uFF09\uFF1A';
        _midImp.forEach(function(c) {
          var g = c.personalGoals[0];
          sysP += '\n  ' + c.name + '\uFF1A' + g.longTerm + '(' + (g.progress||0) + '%)';
        });
      }
      if (_lowImp.length > 0) {
        sysP += '\n\u25A0 \u6B21\u8981\u4EBA\u7269\uFF08\u6BCF5\u56DE\u5408\u66F4\u65B0\u4E00\u6B21\uFF09\uFF1A' + _lowImp.map(function(c){ return c.name + ':' + c.personalGoals[0].longTerm; }).join('\uFF1B');
      }
    }

    // 无目标的NPC——要求AI为其生成目标
    if (_noGoals.length > 0) {
      sysP += '\n\u25A0 \u4EE5\u4E0B\u89D2\u8272\u5C1A\u65E0\u76EE\u6807\uFF0CAI\u5E94\u6839\u636E\u5176\u6027\u683C/\u8EAB\u4EFD/\u5904\u5883\u5728goal_updates\u4E2D\u7528action="add"\u751F\u6210\u76EE\u6807\uFF1A';
      // 高重要度无目标的优先列出
      _noGoals.sort(function(a,b){ return (b.importance||50)-(a.importance||50); });
      sysP += '\n  ' + _noGoals.map(function(c){ return c.name + '(' + (c.faction||'') + ',' + (c.officialTitle||c.title||'\u65E0\u804C') + ')'; }).join('\uFF1B');
      if (_noGoals.length > 20) sysP += '\u2026\u53CA\u53E6\u5916' + (_noGoals.length - 20) + '\u4EBA';
    }

    sysP += '\ngoal_updates\u8981\u6C42\uFF1A\u91CD\u8981\u4EBA\u7269\u6BCF\u56DE\u5408\u66F4\u65B0\uFF0C\u4E00\u822C\u4EBA\u7269\u8F6E\u6D41\u66F4\u65B0\uFF0C\u65E0\u76EE\u6807\u8005\u4F18\u5148\u751F\u6210\u3002\u77ED\u671F\u76EE\u6807\u5E94\u7ED3\u5408\u5F53\u524D\u65F6\u4EE3\u80CC\u666F\uFF08\u5982\u79D1\u4E3E\u5236\u4E0B\u60F3\u5F53\u5B98\u2192\u5907\u8003\uFF09\u3002\u76EE\u6807\u8FBE\u6210\u65F6action="complete"\u5E76\u7528action="add"\u751F\u6210\u65B0\u76EE\u6807\u3002';

    // 4.2: 注入结构化关系网络（去重：只保留A→B方向，跳过B→A重复）
    var _relPairs = [];
    var _relSeen = {};
    (GM.chars||[]).forEach(function(c) {
      if (c.alive===false || !c._relationships) return;
      Object.keys(c._relationships).forEach(function(other) {
        c._relationships[other].forEach(function(r) {
          if (Math.abs(r.strength||0) < 10) return;
          // 去重：用排序后的名字对作为key
          var pairKey = [c.name, other].sort().join('|') + '|' + r.type;
          if (_relSeen[pairKey]) return;
          _relSeen[pairKey] = true;
          _relPairs.push(c.name + '\u2194' + other + '\uFF1A' + r.type + '(' + (r.strength>0?'+':'') + r.strength + ')');
        });
      });
    });
    if (_relPairs.length > 0) {
      sysP += '\n\n\u3010\u7ED3\u6784\u5316\u5173\u7CFB\u7F51\u7EDC\uFF08\u5F71\u54CDNPC\u4E92\u52A8\u51B3\u7B56\uFF09\u3011';
      sysP += '\n' + _relPairs.join('\uFF1B');
      sysP += '\naffinity_changes\u4E2D\u53EF\u7528relType\u5B57\u6BB5\u5EFA\u7ACB/\u5F3A\u5316\u5173\u7CFB\uFF1Ablood/marriage/mentor/sworn/rival/benefactor/enemy';
    }

    // 2.1: 注入状态耦合参考（非机械执行，AI自行决定实际变化）
    if (GM._couplingReport) {
      sysP += '\n\n' + GM._couplingReport;
    }
    // 注入时代进度参考（非机械执行，AI自行决定朝代阶段变化）
    if (GM._eraProgressReport) {
      sysP += '\n\n\u3010\u671D\u4EE3\u8D8B\u52BF\u53C2\u8003\u3011' + GM._eraProgressReport + '\u3002AI\u53EF\u901A\u8FC7era_state_delta\u81EA\u884C\u51B3\u5B9A\u662F\u5426\u8C03\u6574\u671D\u4EE3\u9636\u6BB5\u3002';
    }
    // 2.3: 注入执行管线参考信息（AI自行判断诏令执行程度）
    if (GM._edictExecutionReport) {
      sysP += '\n\n【诏令执行环境参考】';
      sysP += '\n官僚层级：' + GM._edictExecutionReport;
      sysP += '\n\u8BF7\u6839\u636E\u4E0A\u8FF0\u5404\u5C42\u7EA7\u5B98\u5458\u7684\u80FD\u529B\u3001\u5FE0\u8BDA\u5EA6\u548C\u7A7A\u7F3A\u60C5\u51B5\uFF0C\u81EA\u884C\u5224\u65AD\u8BCF\u4EE4\u7684\u6267\u884C\u7A0B\u5EA6\u548C\u963B\u529B\u6765\u6E90\u3002';
      sysP += '\nedict_feedback\u8981\u6C42\uFF1Aassignee\u5FC5\u586B\u8D1F\u8D23\u6267\u884C\u7684\u5177\u4F53\u5B98\u5458\u540D\uFF1Bfeedback\u5E94\u8BE6\u7EC6\u63CF\u8FF0\u6267\u884C\u8FC7\u7A0B\uFF08\u8C01\u505A\u4E86\u4EC0\u4E48\u3001\u8FDB\u5C55\u5982\u4F55\u3001\u963B\u529B\u6765\u6E90\uFF09\uFF0C\u4E0D\u8981\u7B3C\u7EDF\u6982\u62EC';
    }
    // 2.5: 注入建筑产出报告
    if (GM._buildingOutputReport) {
      sysP += '\n\n【本回合建筑经济产出】';
      sysP += '\n' + GM._buildingOutputReport;
    }
    // 5.1: 注入贸易路线报告
    if (GM._tradeReport) {
      sysP += '\n\n\u3010\u8D38\u6613\u8DEF\u7EBF\u72B6\u51B5\uFF08\u53C2\u8003\uFF09\u3011' + GM._tradeReport;
      sysP += '\nAI\u53EF\u5728\u53D9\u4E8B\u4E2D\u53CD\u6620\u8D38\u6613\u7E41\u8363/\u8427\u6761\u3002';
    }
    // 5.3: 注入省份特产资源信息
    if (GM._resourceProvinces && Object.keys(GM._resourceProvinces).length > 0) {
      sysP += '\n\n\u3010\u7701\u4EFD\u7279\u4EA7\u8D44\u6E90\u3011';
      Object.keys(GM._resourceProvinces).forEach(function(pn) {
        sysP += '\n' + pn + '\uFF1A' + GM._resourceProvinces[pn].join('\u3001');
      });
    }
    // 4.1: 注入当前国策列表
    if (GM.customPolicies && GM.customPolicies.length > 0) {
      sysP += '\n\n【当前施行国策】';
      GM.customPolicies.forEach(function(p) {
        var duration = GM.turn - (p.enactedTurn || 0);
        sysP += '\n  · ' + (p.name || p.id) + '（已施行' + duration + '回合）';
      });
      sysP += '\n请在推演中体现国策对国家治理的持续影响。';
    }
    // 4.2: 注入地方区划概况（最多10个，优先显示有问题的）
    if (GM.provinceStats) {
      var _provKeys = Object.keys(GM.provinceStats);
      // 按民怨降序排列，优先展示问题省份
      _provKeys.sort(function(a, b) { return ((GM.provinceStats[b]||{}).unrest||0) - ((GM.provinceStats[a]||{}).unrest||0); });
      // 不限制省份数量
      if (_provKeys.length > 0) {
        var _provLines = [];
        _provKeys.forEach(function(pn) {
          var ps = GM.provinceStats[pn];
          if (!ps || !ps.monthlyIncome) return;
          var gov = ps.governor || '空缺';
          _provLines.push(pn + '(长官:' + gov + ' 收入:钱' + (ps.monthlyIncome.money||0) + '/粮' + (ps.monthlyIncome.grain||0) + ' 民怨:' + (ps.unrest||0) + ')');
        });
        if (_provLines.length > 0) {
          sysP += '\n\n【地方区划概况】';
          _provLines.forEach(function(l) { sysP += '\n  · ' + l; });
        }
      }
    }
    // 4.3: NPC事件提案
    if (GM._npcEventProposals && GM._npcEventProposals.length > 0) {
      sysP += '\n\n【NPC事件提案（系统检测到以下NPC满足事件触发条件，AI应优先考虑处理）】';
      GM._npcEventProposals.forEach(function(p) {
        sysP += '\n- ' + p.desc;
      });
      sysP += '\nAI有权根据叙事需要决定是否触发，但忠诚<20+野心>80的叛乱提案应大概率触发。';
    }
    // 4.4: 注入角色健康预警（AI决定是否让角色病亡）
    if (GM._healthAlerts && GM._healthAlerts.length > 0) {
      sysP += '\n\n【角色健康预警（AI应酌情在character_deaths中处理）】';
      GM._healthAlerts.forEach(function(alert) {
        sysP += '\n  · ' + alert;
      });
    }
    // 4.4: 正统性状况参考
    if (GM._legitimacyAlerts && GM._legitimacyAlerts.length > 0) {
      sysP += '\n\n\u3010\u6B63\u7EDF\u6027\u72B6\u51B5\uFF08AI\u53C2\u8003\uFF0C\u53EF\u901A\u8FC7char_updates\u8C03\u6574legitimacy\uFF09\u3011';
      GM._legitimacyAlerts.forEach(function(a) { sysP += '\n  ' + a; });
    }
    // 5.5: NPC目标驱动阴谋建议
    var _schemeHints = [];
    (GM.chars||[]).forEach(function(c) {
      if (c.alive===false || c.isPlayer || !c.personalGoals) return;
      c.personalGoals.forEach(function(g) {
        if (g.type==='revenge' && g.progress>=40 && !(GM.activeSchemes||[]).some(function(s){return s.schemer===c.name;})) {
          _schemeHints.push(c.name + '(\u590D\u4EC7\u76EE\u6807\u8FDB\u5EA6' + g.progress + '%)\u53EF\u80FD\u53D1\u8D77\u9634\u8C0B');
        }
        if (g.type==='power' && g.progress>=60 && (c.ambition||50)>75) {
          _schemeHints.push(c.name + '(\u593A\u6743\u8FDB\u5EA6' + g.progress + '%)\u91CE\u5FC3\u9A71\u4F7F\u53EF\u80FD\u5BC6\u8C0B');
        }
      });
    });
    if (_schemeHints.length > 0) {
      sysP += '\n\n\u3010\u9634\u8C0B\u6F5C\u5728\u53D1\u8D77\u8005\uFF08AI\u53EF\u5728scheme_actions\u4E2D\u5B89\u6392\uFF09\u3011';
      _schemeHints.forEach(function(h){ sysP += '\n- ' + h; });
    }
    // 4.6: 注入NPC决策条件满足提示（AI决定是否触发）
    if (GM._decisionAlerts && GM._decisionAlerts.length > 0) {
      sysP += '\n\n【NPC重大决策条件（仅供参考，AI决定是否安排叙事）】';
      GM._decisionAlerts.forEach(function(da) {
        sysP += '\n  · ' + da.charName + '满足"' + da.decisionName + '"条件';
      });
    }

    sysP += '\n\n【官制职能——推演原则】';
    sysP += '\n本朝官制中每个部门有职能分工（见tp中【官制职能分工】）。推演时注意：';
    sysP += '\n  · 事务应优先由对口部门处理——但"对口"看职能内容，不看部门名称';
    sysP += '\n  · 不得凭空创造不存在的官职——必须使用blockE中已有的官职';
    sysP += '\n  · 部门主官空缺→该部门效率下降，相关事务延误或副手代理';
    sysP += '\n  · 官员的"见识"≠"当前职务"——判断一个人是否懂某事务要看三层：';
    sysP += '\n    1.任职经历：曾在哪些部门任职？经手过哪些职能？（曾管科举的官员调任后仍懂科举）';
    sysP += '\n    2.能力天赋：智力/政务/军事高的人在相关领域触类旁通（政务85+的人谈任何行政事务都不会外行）';
    sysP += '\n    3.从政资历：在朝多年的老臣对朝政全局都有见识，即使未直接经手';
    sysP += '\n  · 官制改革后：旧部门官员对旧职能保留经验（只失去执行权，不失去见识）';
    sysP += '\n  · 多数行政领域之间有共通性——财政/人事/民政的底层逻辑相近，不应将其视为完全隔离的知识孤岛';
    sysP += '\n  · 真正的"外行"是：从未接触过、能力也低(对应值<40)、从政时间短的角色';
    sysP += '\n- character_deaths: 让任何角色死亡（包括玩家角色→游戏结束）';
    sysP += '\n- new_characters: 创建新角色（子嗣、投奔者、新官员等）';
    sysP += '\n- faction_changes: \u4FEE\u6539\u52BF\u529B\u5C5E\u6027\uFF08strength_delta\u5B9E\u529B\uFF0Ceconomy_delta\u7ECF\u6D4E\uFF0CplayerRelation_delta\u5BF9\u7389\u5173\u7CFB\u3002strength\u964D\u81F30\u2192\u52BF\u529B\u8986\u706D\uFF09';
    sysP += '\n- faction_events: 创造势力间自主事件（战争/联盟/政变/行军/围城等）';
    sysP += '\n  ⚠ 涉及行军/围城的事件，必须在geoData中提供地理推算数据！';
    sysP += '\n- faction_relation_changes: 改变势力间关系';
    sysP += '\n- party_changes: \u4FEE\u6539\u515A\u6D3E\u72B6\u6001\uFF08influence_delta\u5F71\u54CD\u529B\u3001new_status\u6D3B\u8DC3/\u5F0F\u5FAE/\u88AB\u538B\u5236/\u5DF2\u89E3\u6563\u3001new_leader\u9996\u9886\u66F4\u66FF\u3001new_agenda\u8BAE\u7A0B\u53D8\u5316\u3001new_shortGoal\u77ED\u671F\u76EE\u6807\u53D8\u5316\uFF09';
    sysP += '\n- class_changes: \u4FEE\u6539\u9636\u5C42\u72B6\u6001\uFF08satisfaction_delta\u6EE1\u610F\u5EA6\u3001influence_delta\u5F71\u54CD\u529B\u3001new_demands\u8BC9\u6C42\u968F\u5C40\u52BF\u53D8\u5316\u3001new_status\u5730\u4F4D\u53D8\u52A8\uFF09';
    sysP += '\n- army_changes: 修改部队兵力/士气/训练（降至0→全军覆没）';
    sysP += '\n- item_changes: 让角色获得或失去物品';
    sysP += '\n- era_state_delta: 调整时代参数（社会稳定/经济/集权/军事等）';
    sysP += '\n- global_state_delta: 调整税压';
    sysP += '\n- office_changes: 官制人事变动（appoint任命/dismiss罢免/promote晋升/demote降级/transfer调任/evaluate考评/reform改革）';
    sysP += '\n- vassal_changes: 封臣关系变动（establish建立/break解除/change_tribute调整贡奉）';
    sysP += '\n- title_changes: 头衔爵位变动（grant册封/revoke剥夺/inherit继承需指定from来源角色/promote晋升）';
    sysP += '\n- building_changes: 建筑变动（build建造/upgrade升级/destroy拆除，需指定territory和type）';
    sysP += '\n- admin_changes: 行政区划变动——地方官任免(appoint_governor/remove_governor)和地方官自主治理效果(adjust: prosperity_delta繁荣/population_delta人口，反映该官员本回合的治绩)';
    sysP += '\n- admin_division_updates: 行政区划树结构变更。action类型：';
    sysP += '\n    add=新增行政区（推演中涉及史实存在但树中没有的行政区时必须用此添加，parentDivision指定上级）';
    sysP += '\n    remove=撤销行政区, rename=重命名, merge=合并(mergeInto指定目标), split=拆分(splitResult列出新名)';
    sysP += '\n    reform=行政改革(如四级变三级), territory_gain=获得领土, territory_loss=丢失领土';
    sysP += '\n    【重要】AI推演中如涉及树中尚未列出但史实存在的行政区划（如玩家提及某城、某州），应自动用add添加到对应上级下，数据参考史料';
    sysP += '\n    【重要】获得领土(territory_gain)的行政区会自动进入"未定行政区"临时节点，等待玩家决定管理方案';
    sysP += '\n    【重要】丢失领土(territory_loss)的行政区数据对玩家清零，不可管理';
    sysP += '\n- harem_events: \u540E\u5BAB\u4E8B\u4EF6\u3002\u7C7B\u578B\uFF1A';
    sysP += '\n    pregnancy(\u6709\u5B55) / birth(\u751F\u80B2\uFF0C\u5FC5\u987B\u540C\u65F6\u5728new_characters\u4E2D\u521B\u5EFA\u5B50\u55E3\u89D2\u8272\u542BmotherName) / rank_change(\u664B\u5C01/\u964D\u4F4D\uFF0CnewRank\u586B\u4F4D\u5206id)';
    sysP += '\n    death(\u85A8\u901D) / favor_change(\u5BA0\u7231\u53D8\u5316\uFF0Cfavor_delta\u6570\u503C) / scandal(\u4E11\u95FB/\u7EA0\u7EB7\uFF0Cdetail\u63CF\u8FF0)';
    sysP += '\n    \u540E\u5BAB\u4E0D\u53EA\u662F\u751F\u80B2\u5DE5\u5177\u2014\u2014\u5983\u5B50\u6709\u6027\u683C\u3001\u91CE\u5FC3\u3001\u6BCD\u65CF\u80CC\u666F\uFF0C\u4F1A\u4E3B\u52A8\u4E89\u5BA0\u3001\u7ED3\u515A\u3001\u8C0B\u5BB3\u3001\u5E72\u653F\u3002AI\u5E94\u8BA9\u540E\u5BAB\u6210\u4E3A\u53D9\u4E8B\u7684\u6D3B\u8DC3\u8BBE\u5F00\u573A\u666F';
    sysP += '\n- tech_civic_unlocks: 解锁科技或推行民政政策（自动扣费+应用效果）';
    sysP += '\n- policy_changes: 国策变更（action:"add"施行/"remove"废除 + name国策名 + reason原因）。须满足前置条件。';
    sysP += '\n- scheme_actions: 阴谋干预（schemer阴谋发起者 + action:"advance"推进/"disrupt"阻碍/"abort"中止/"expose"揭露 + reason原因）';
    sysP += '\n- timeline_triggers: 触发剧本预设的时间线事件（当条件成熟时标记事件为已发生）';
    sysP += '\n- current_issues_update: 时局要务——AI对当前时政矛盾的总结，为玩家提供施政方向参考（玩家可据此撰写诏书、问对、朝议等）。';
    sysP += '\n    【定位】这是AI的时政分析摘要，不是游戏机制——要务本身不产生机械效果，不影响任何数值。实际影响来自玩家的诏书和AI的推演。';
    sysP += '\n    【着眼点】聚焦"时局""时政"——当前朝廷面临的具体政务问题（如某镇兵饷拖欠、河道淤塞待修、某州刺史贪腐被劾），不要过于宏大空泛（如"天下大乱""国运衰微"）。';
    sysP += '\n    add: 当推演中出现新的具体时政问题时，用半文言200-500字描述其来由、现状、涉及人物和潜在走向';
    sysP += '\n    resolve: 当某问题因推演进展（玩家诏书、官员施政、局势变化等）已解决或不再紧迫时标记（填id）';
    sysP += '\n    update: 当问题态势因推演发生变化时更新description（填id+新description）';
    sysP += '\n    同一时期待解决要务3-6个为宜。应是具体可操作的时政议题，不是笼统的国运判断';
    // 注入当前时局要务
    if (GM.currentIssues && GM.currentIssues.length > 0) {
      var _pendingIssues = GM.currentIssues.filter(function(i) { return i.status === 'pending'; });
      if (_pendingIssues.length > 0) {
        sysP += '\n\n\u3010\u5F53\u524D\u65F6\u5C40\u8981\u52A1\u2014\u2014\u5F85\u89E3\u51B3\u3011';
        _pendingIssues.forEach(function(iss) {
          sysP += '\n  ' + iss.title + '(' + (iss.category || '') + ' \u7B2C' + iss.raisedTurn + '\u56DE\u5408\u63D0\u51FA) id:' + iss.id;
        });
        sysP += '\n\u8BF7\u6839\u636E\u672C\u56DE\u5408\u63A8\u6F14\u68C0\u67E5\u4EE5\u4E0A\u8981\u52A1\u662F\u5426\u6709\u8FDB\u5C55\u6216\u5DF2\u89E3\u51B3\uFF0C\u5E76\u8BC6\u522B\u65B0\u51FA\u73B0\u7684\u91CD\u5927\u77DB\u76FE\u3002';
      }
    }
    sysP += '\n- office_changes中的任命必须考虑岗位继任方式：世袭岗位应由前任子嗣继承，流官由朝廷选拔，科举岗位应从进士中选，军功岗位从武将中选。';
    // ── 社会生灭周期（党派/势力/阶层的 create/dissolve） ──
    sysP += '\n【社会生灭周期——党派/势力/阶层可生可灭】';
    sysP += '\n  党派：party_create(新崛起) / party_splinter(分裂自既有) / party_merge(合流) / party_dissolve(覆灭)';
    sysP += '\n    崛起触发：社会基础变化(新阶层兴起)、领袖聚众、诏令催化、危机凝聚';
    sysP += '\n    覆灭触发：banned(查禁)/liquidated(肃清，血洗)/faded(自然消亡)/leaderKilled(领袖被杀而散)/absorbed(被吞并)';
    sysP += '\n  势力：faction_create(新建：独立/割据/称帝/复国) / faction_succession(首脑传承) / faction_dissolve(灭国/吞并)';
    sysP += '\n    崛起触发：母势力凝聚力<30时藩镇独立、农民起义建国、新兴族群复国、外敌割据、宗教势力建国';
    sysP += '\n    覆灭触发：conquered(被征服)/absorbed(和平并入)/collapsed(内部崩解)/seceded_all(分崩离析成多国)/replaced(被取代)';
    sysP += '\n    ※ 不得 faction_dissolve 玩家势力；玩家势力被灭应通过游戏结束事件处理';
    sysP += '\n  阶层：class_emerge(兴起) / class_revolt(起义) / class_dissolve(消亡)';
    sysP += '\n    兴起触发：经济变革(商人阶层兴起)、新兵制(军户兴起)、科举开放(寒门兴起)、新税制(某类人群地位升降)';
    sysP += '\n    消亡触发：abolished(法令废除如废贱籍)/assimilated(被吸收)/extincted(自然衰落如门阀消亡)/replaced(被新阶层取代)';
    sysP += '\n  【关键原则——历史模拟真实性】';
    sysP += '\n    · 必须有史实/推演内因——不得无故创建或消灭。理由必须写在 reason/triggerEvent 中';
    sysP += '\n    · 生灭事件应稀疏——一回合最多 1-2 个重大生灭事件；日常以 splinter/merge/relation_shift 为主';
    sysP += '\n    · 势力覆灭必须与战争/bigyear 事件呼应，不得凭空消失';
    sysP += '\n    · 阶层兴替跨度长——通常数十回合渐变，非一日之功；除非诏令明确废止（如"永禁贱籍"）才立即生效';
    sysP += '\n    · 新建时 leader/首脑须指向现有角色，或在同一回合的 new_characters 中一并创建';
    sysP += '\n【官制人事·扩展动作】';
    sysP += '\n  promote: 晋升——填newRank(新品级)，可选newDept+newPosition(升任新职)';
    sysP += '\n  demote: 降级——填newRank';
    sysP += '\n  transfer: 调任——填newDept+newPosition（从当前职位调到新职位）';
    sysP += '\n  evaluate: 考评——由负责考察的官员NPC执行（吏部/都察院等）';
    sysP += '\n    evaluator: 考评者NPC名（必填！必须是负责考察的官员，不是被评者本人）';
    sysP += '\n    grade: 卓越/称职/平庸/失职';
    sysP += '\n    comment: 考评评语（以考评者NPC的口吻、偏见、立场写——不一定客观公正！）';
    sysP += '\n    ※ 考评是NPC行为，带有偏见：铨曹与被评者同派系→倾向好评；有私仇→可能恶评；受贿→掩盖真实情况';
    sysP += '\n    ※ 每3-5回合应对重要官员进行一次考评（不必每回合都评）';
    sysP += '\n  reform: 官制改革——reformDetail填"增设/裁撤/合并/拆分/改名/改制"等描述';
    sysP += '\n    玩家诏令中提及"增设某某""裁撤某某""将某某更名为某某""拆分某某为某某"→必须在office_changes中输出对应reform动作';
    sysP += '\n    增设新官职→reform + reformDetail:"增设" + dept:所属部门 + position:新官职名';
    sysP += '\n    增设新部门→reform + reformDetail:"增设" + dept:新部门名';
    sysP += '\n    裁撤→reform + reformDetail:"裁撤" + dept:被裁部门名';
    sysP += '\n    改名→reform + reformDetail:"改名" + dept:旧名 + newDept:新名';
    sysP += '\n    拆分→reform + reformDetail:"拆分" + dept:原部门名 + splitInto:[{name,positions:[]},...]';
    sysP += '\n    合并→reform + reformDetail:"合并" + dept:被并入部门 + intoDept:目标部门（被并入者下级/positions合并到目标）';
    sysP += '\n    改制(一揽子改革)→reform + reformDetail:"改制" + restructurePlan:[{action,dept,...}]——承载多原子动作';
    // ── 官制占位实体化 ──
    sysP += '\n【官制占位实体化——office_spawn】';
    sysP += '\n  编辑器生成官制时按史料记载的编制/缺员/在职人数，但并非每个在职者都有角色内容——actualHolders 中 generated:false 的是"在职但无具体角色"占位';
    sysP += '\n  触发条件：当推演/玩家诏令涉及某官职，而该 position 的 actualHolders 中有 generated:false 占位时，必须输出 office_spawn 条目将一个占位实体化';
    sysP += '\n  生成原则：';
    sysP += '\n    · 姓名按本朝代命名习惯（不得与现有角色重名）';
    sysP += '\n    · 【品级与能力不强绑】——主流任职者能力中上(主维度 55-80)，但必须保留以下 6 种史实变体：';
    sysP += '\n        潜龙未用(低品大才 adm 90+)、贬谪名臣(低品曾为高官)、寒门新进(低品朝气)、';
    sysP += '\n        恩荫庸才(高品低才 adm 30-50)、外戚宦官(品高才陋但权重)、隐士起用(能力极高但低调)';
    sysP += '\n    · 若该职有特定能力倾向（武职→military/valor高；吏职→administration高；御史→intelligence高），相应维度+10';
    sysP += '\n    · age 与品级无强绑，按人物类型：恩荫少年(20-35)、寒门新进(25-40)、历练老臣(50-70)、名宿(60-80)';
    sysP += '\n    · loyalty 按出身：恩荫/近侍 55-75；寒门新进 60-80；贬谪起复 30-60；潜龙出山 50-80';
    sysP += '\n  使用限制：';
    sysP += '\n    · 不得为已有 generated:true 的位置 spawn（那是史实人物，不可替换）';
    sysP += '\n    · 一回合最多 spawn 3-5 个（避免暴发式造人）';
    sysP += '\n    · 纯叙事提及而无实际操作涉及的职位，不必 spawn';
    sysP += '\n【任命制度约束——必须遵守】';
    sysP += '\n  · 品级递升：不得越级提拔太多（如从九品直升三品，除非有特殊功勋）';
    sysP += '\n  · 出身约束：科举出身可任文官，军功出身可任武官，荫庇出身品级有上限';
    sysP += '\n  · 回避制度：本籍不宜任本地官（可被皇帝特旨豁免）、亲属不宜同部门';
    sysP += '\n  · 空缺不一定坏：有时空缺是权力斗争的结果，不必急于填补';
    // ── 品级体系 ──
    sysP += '\n【品级体系——18级制】';
    sysP += '\n  正一品(最高)→从一品→正二品→…→从九品(最低)。品级越高，俸禄越多，权力越大。';
    sysP += '\n  晋升规则：正常每次升1-2级（如从五品→正五品→从四品）。跃升3级以上需特殊功勋。';
    sysP += '\n  promote/demote动作的newRank必须是合理的品级（如"从三品"而非自创品级）。';
    // ── 差遣与寄禄 ──
    sysP += '\n【差遣与寄禄分离】';
    sysP += '\n  差遣(actual job)：实际管事的职务（如"知开封府""判户部"）';
    sysP += '\n  寄禄(salary rank)：拿俸禄的虚衔（如"银青光禄大夫""朝散大夫"）';
    sysP += '\n  同一人可能差遣低而寄禄高（有品级无实权）或差遣高而寄禄低（有权无品）。';
    sysP += '\n  在office_changes的appoint/promote中，position是差遣，rank是寄禄品级。';
    // ── 考课制度 ──
    sysP += '\n【考课制度——周期性考核】';
    sysP += '\n  每5回合应由负责考察的部门（吏部/都察院/御史台）对所有在任官员进行一次考评。';
    sysP += '\n  通过office_changes的evaluate动作输出，evaluator必须是考察部门的NPC。';
    sysP += '\n  考评标准：德行（清廉/贪腐）、才能（政绩好坏）、勤惰（是否尽职）。';
    sysP += '\n  考评结果影响后续任命：卓越→优先晋升；失职→应降级或罢免。';
    var _turnMod5 = GM.turn % 5;
    if (_turnMod5 === 0 && GM.turn > 0) {
      sysP += '\n  ※ 本回合是考课之期（每5回合一次）——必须输出evaluate动作，覆盖所有在任重要官员！';
    }
    // ── 任期轮换 ──
    sysP += '\n【任期轮换】';
    sysP += '\n  地方官任期一般3年（约10-15回合）。任期满后应轮换调任。';
    // 注入任期超期官员
    var _overTermOfficials = [];
    (function _checkTerm(nodes, dName) {
      nodes.forEach(function(n) {
        (n.positions||[]).forEach(function(p) {
          if (p.holder) {
            var ch = findCharByName(p.holder);
            var tk = (dName||n.name) + p.name;
            var tenure = (ch && ch._tenure && ch._tenure[tk]) || 0;
            if (tenure > 12) _overTermOfficials.push({ name: p.holder, dept: n.name, pos: p.name, tenure: tenure });
          }
        });
        if (n.subs) _checkTerm(n.subs, n.name);
      });
    })(GM.officeTree||[]);
    if (_overTermOfficials.length > 0) {
      sysP += '\n  以下官员任期已超标准（>12回合），吏部应上奏建议轮换或留任：';
      _overTermOfficials.forEach(function(o) {
        sysP += '\n    ' + o.name + '（' + o.dept + o.pos + '，任期' + o.tenure + '回合）';
      });
    }
    // ── 丁忧/服丧 ──
    sysP += '\n【丁忧/服丧制度】';
    sysP += '\n  官员父母去世→该官员必须离职守丧（称"丁忧"），持续约9回合。';
    sysP += '\n  皇帝可"夺情"——强令该官员不守丧继续任职，但会引起极大争议（朝臣可能弹劾）。';
    sysP += '\n  当character_deaths中有人去世时，检查是否有在任官员是其子女→应在office_changes中dismiss该官员（reason:"丁忧"）。';
    // ── 荫补/恩荫 ──
    sysP += '\n【荫补/恩荫制度】';
    sysP += '\n  三品以上官员的子弟可通过荫补入仕，不经科举。荫补出身品级较低（通常从八品起）。';
    sysP += '\n  这是重要的人才来源，也是腐败温床——荫补者未必有才能。';
    sysP += '\n  在npc_actions中可体现：高官为子弟求荫补（behaviorType: "recommend"），或谏官弹劾荫补滥用。';
    // ── 冗官/空缺主动性 ──
    sysP += '\n【冗官与空缺——AI应主动关注】';
    var _vacantCount = 0, _totalOff = 0;
    (function _vc(ns) { ns.forEach(function(n) { (n.positions||[]).forEach(function(p) { _totalOff++; if (!p.holder) _vacantCount++; }); if (n.subs) _vc(n.subs); }); })(GM.officeTree||[]);
    if (_vacantCount > 0) sysP += '\n  当前有' + _vacantCount + '个职位空缺（共' + _totalOff + '个），吏部应通过奏疏催促填补关键空缺。';
    if (_totalOff > 30) sysP += '\n  官僚机构庞大（' + _totalOff + '员），可能存在冗官问题——有识之臣可能上疏建议精简。';
    // ── 致仕/退休 ──
    sysP += '\n【致仕/退休制度】';
    sysP += '\n  年迈（>60岁）或疲惫（stress>70）或失意的官员可请求致仕。';
    sysP += '\n  通过奏疏上疏请求（type:"人事" subtype:"上疏"）：\u201C臣年老力衰，乞骸骨归田\u201D';
    sysP += '\n  皇帝批复选项：准奏→恩赐归田（忠诚+）；驳回挽留→加官留任（压力+）；赐金还乡→厚礼送行（忠诚++）';
    sysP += '\n  AI应让符合条件的老臣每隔数回合请求致仕。被拒绝后可能续奏死谏。';
    // 注入年迈/高压力官员
    var _retireCandidates = [];
    (function _rc(nodes) {
      nodes.forEach(function(n) {
        (n.positions||[]).forEach(function(p) {
          if (p.holder) {
            var _rch = findCharByName(p.holder);
            if (_rch && ((_rch.age && _rch.age > 60) || (_rch.stress||0) > 70)) {
              _retireCandidates.push({ name: p.holder, age: _rch.age||'?', stress: _rch.stress||0, dept: n.name, pos: p.name });
            }
          }
        });
        if (n.subs) _rc(n.subs);
      });
    })(GM.officeTree||[]);
    if (_retireCandidates.length > 0) {
      sysP += '\n  以下官员可能请求致仕：';
      _retireCandidates.forEach(function(r) { sysP += '\n    ' + r.name + '（' + r.dept + r.pos + '，年' + r.age + '岁，压力' + r.stress + '）'; });
    }
    // ── 举主连坐 ──
    sysP += '\n【举主连坐制度】';
    sysP += '\n  推荐他人入仕的官员（举主）需为被推荐者的表现负责。';
    sysP += '\n  appoint时可在reason中注明"由某某举荐"——系统会记录推荐关系。';
    sysP += '\n  考评时若被推荐者为"失职"，AI应在叙事/npc_actions中追究举主责任。';
    sysP += '\n  弹劾某官员时可连带弹劾其举主："举人不当"。';
    // ── 派系控制朝堂 ──
    var _factionControl = {};
    (function _fc(nodes) {
      nodes.forEach(function(n) {
        (n.positions||[]).forEach(function(p) {
          if (p.holder) {
            var _fch = findCharByName(p.holder);
            if (_fch && _fch.faction) {
              if (!_factionControl[_fch.faction]) _factionControl[_fch.faction] = { count: 0, key: 0, depts: {} };
              _factionControl[_fch.faction].count++;
              var _rl3 = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 10;
              if (_rl3 <= 6) _factionControl[_fch.faction].key++; // 从三品以上=关键职位
              _factionControl[_fch.faction].depts[n.name] = (_factionControl[_fch.faction].depts[n.name]||0) + 1;
            }
          }
        });
        if (n.subs) _fc(n.subs);
      });
    })(GM.officeTree||[]);
    var _fcKeys = Object.keys(_factionControl);
    if (_fcKeys.length > 0) {
      sysP += '\n【朝堂派系控制格局——影响权力斗争】';
      _fcKeys.sort(function(a,b) { return _factionControl[b].key - _factionControl[a].key; });
      _fcKeys.forEach(function(fk) {
        var fc = _factionControl[fk];
        var deptList = Object.keys(fc.depts).map(function(d){ return d + '(' + fc.depts[d] + '人)'; }).join('、');
        sysP += '\n  ' + fk + '：控制' + fc.count + '个官职（关键职位' + fc.key + '个）——' + deptList;
      });
      sysP += '\n  强势派系会排挤异己、安插亲信。弱势派系会联合反抗或暗中串联。';
      sysP += '\n  AI在office_changes的appoint中应反映派系争夺：吏部被某派控制→推荐该派之人。';
    }
    // ── 各部门聚合数据（双层模型）——AI必须据此推演 ──
    if (GM.officeTree && GM.officeTree.length > 0 && typeof _offDeptStats === 'function') {
      sysP += '\n【各部门人员聚合——双层模型】';
      sysP += '\n  每个部门有"编制/实有/具象/缺员"四个数字。"具象"是有完整角色数据的官员，"实有-具象"是在任但无角色数据的官员。';
      sysP += '\n  推演规则：';
      sysP += '\n  · 未具象官员以部门整体数字参与推演——如"兵部查出4人贪腐"，其中具象的指名，其余用数字';
      sysP += '\n  · 叙述格式："甲等有张三等3人，乙等有李四等9人，丙等12人"——具象角色必须点名';
      sysP += '\n  · 缺员变动通过office_aggregate输出（actualCount_delta），不需要为每个补缺者创建角色';
      sysP += '\n  · 如AI推演中某未具象官员做了有名有姓的重要事（弹劾/立功/叛变），才需要赋予名字（在char_updates中新增角色）';
      GM.officeTree.forEach(function(d) {
        var st = _offDeptStats(d);
        if (st.headCount > 0) {
          sysP += '\n  ' + d.name + '：编制' + st.headCount + ' 实有' + st.actualCount + ' 具象' + st.materialized + ' 缺' + st.vacant;
          if (st.holders.length > 0) sysP += '（' + st.holders.join('、') + '）';
        }
      });
    }
    // ── office_aggregate输出字段说明 ──
    sysP += '\n【office_aggregate——部门聚合事件（双层模型专用）】';
    sysP += '\n  用于不涉及具体角色的部门级变动：';
    sysP += '\n  · actualCount_delta: 实有人数变化（有司递补+N/离职-N）';
    sysP += '\n  · evaluation_summary: {excellent:N,good:N,average:N,poor:N,named_excellent:["张三"],named_good:["李四"]}';
    sysP += '\n  · corruption_found: 查出贪腐人数, named_corrupt: ["具象贪腐者"]';
    sysP += '\n  · narrative: 混合叙述文本（具象角色点名+其余用数字）';

    // 科举政治维度
    if (P.keju && P.keju.enabled) {
      sysP += '\n\n【科举政治·重要】';
      sysP += '\n科举是政治斗争的核心战场，但一切关系都是倾向而非绝对：';
      sysP += '\n- 门生-座主：新进士对座师有好感倾向，但忠正之士可能不屑攀附，野心家可能背叛座师。座师也并非无条件庇护门生。';
      sysP += '\n- 天子门生：殿试前三名（状元榜眼探花）为天子亲策，对君主有额外感恩，但这不意味着绝对忠诚。';
      sysP += '\n- 同年之谊：同科进士之间有天然亲近感，可能互相帮衬，也可能在党争中对立。';
      sysP += '\n- 考官之争：各党派会争夺主考官位置（因为主考官能影响取士倾向），这是政斗焦点。';
      sysP += '\n- 拉拢新人：党派会试图拉拢新进士，但能否成功取决于进士的性格、理想和利益判断。';
      sysP += '\n- 科举舞弊：考官可能徇私、泄题。对立面会弹劾。通过npc_actions/event生成。';
      sysP += '\n- 取士结构：寒门多→民心升但士族怨；士族多→反之。这会激化阶层矛盾。';
      if (P.keju.history && P.keju.history.length > 0) {
        var _lastK = P.keju.history[P.keju.history.length - 1];
        sysP += '\n上科状元:' + (_lastK.topThree?_lastK.topThree[0]:'') + ' 主考:' + (_lastK.chiefExaminer||'') + (_lastK.examinerParty ? '('+_lastK.examinerParty+')' : '');
      }
    }
    sysP += '\n- map_changes: 领地变更';
    sysP += '\n请根据推演情况积极使用这些权力，让世界活起来。不要只返回空数组。';

    var url=P.ai.url;if(url.indexOf("/chat/completions")<0)url=url.replace(/\/+$/,"")+"/chat/completions";

    // ═══ 动态 max_tokens 上限 ═══
    // 优先级：玩家手动设置 > 检测到的模型输出上限 > 白名单匹配 > 保守兜底
    // _tok(baseTok) 返回 undefined 表示不传 max_tokens（让模型自由发挥）
    // 仅在玩家手动设置且有效时才传 max_tokens；否则不传，依赖模型默认行为
    var _tokCp = (typeof getCompressionParams === 'function') ? getCompressionParams() : {scale:1.0,contextK:32};
    // 计算生效的输出上限（tokens）——用于限流与截断预警
    function _getEffectiveOutputLimit() {
      // 1. 玩家手动
      if (P.conf.maxOutputTokens && P.conf.maxOutputTokens > 0) return P.conf.maxOutputTokens;
      // 2. 检测值
      if (P.conf._detectedMaxOutput && P.conf._detectedMaxOutput > 0) return P.conf._detectedMaxOutput;
      // 3. 白名单回退
      if (typeof _matchModelOutput === 'function') {
        var wl = _matchModelOutput(P.ai.model || '');
        if (wl > 0) return wl * 1024;
      }
      // 4. 兜底：上下文的1/8，最低4096
      return Math.max(4096, Math.round(_tokCp.contextK * 1024 / 8));
    }
    var _effectiveOutCap = _getEffectiveOutputLimit();
    // _tok(baseTok) 只在玩家手动设置时才返回具体值；否则返回 undefined 让模型自由
    function _tok(baseTok) {
      // 玩家手动设置——必须遵守（不让模型超限）
      if (P.conf.maxOutputTokens && P.conf.maxOutputTokens > 0) {
        return Math.max(500, Math.min(baseTok, P.conf.maxOutputTokens));
      }
      // 自动模式：不传 max_tokens，让模型自己决定
      return undefined;
    }
    // fetch 辅助：若 _tok() 返回 undefined，body 中不加 max_tokens 字段
    function _buildFetchBody(model, messages, temperature, baseTok, extra) {
      var body = {model:model, messages:messages, temperature:temperature};
      var mt = _tok(baseTok);
      if (mt !== undefined) body.max_tokens = mt;
      if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) body[k] = extra[k];
      return body;
    }
    // 截断检测：在每次 fetch 响应后调用
    var _truncatedOnce = false;
    function _checkTruncated(data, label) {
      if (_truncatedOnce) return; // 一次回合只提示一次
      if (!data || !data.choices || !data.choices[0]) return;
      var fr = data.choices[0].finish_reason || data.choices[0].stop_reason;
      if (fr === 'length' || fr === 'max_tokens') {
        _truncatedOnce = true;
        if (typeof toast === 'function') {
          toast('⚠ AI输出被截断(' + (label||'') + ')，建议在设置中增大"AI输出上限"或换用大窗口模型');
        }
        _dbg('[Truncated]', label, 'finish_reason=', fr);
      }
    }
    _dbg('[TokenLimit] 生效输出上限:', _effectiveOutCap, 'tokens | 手动:', P.conf.maxOutputTokens||0, '检测:', P.conf._detectedMaxOutput||0);

    // ============================================================
    // 1.3: 跨回合记忆摘要注入（最近3条摘要，覆盖15-50回合历史）
    // ============================================================
    if (GM._aiMemorySummaries && GM._aiMemorySummaries.length > 0) {
      sysP += '\n\n【历史回顾摘要（跨回合AI记忆）】';
      GM._aiMemorySummaries.slice(-3).forEach(function(ms) {
        sysP += '\n' + ms.summary;
      });
    }

    // ============================================================
    // 1.4: 幻觉防火墙——名称白名单注入
    // 明确列出当前存活角色和有效地名，要求AI只使用名单内名称
    // ============================================================
    (function _hallucinationFirewall() {
      // 存活角色白名单
      var _aliveNames = (GM.chars || []).filter(function(c) { return c.alive !== false; }).map(function(c) { return c.name; });
      if (_aliveNames.length > 0) {
        if (_aliveNames.length <= 60) {
          sysP += '\n\n【当前存活角色完整名单（严禁使用名单外的人名）】';
          sysP += '\n' + _aliveNames.join('、');
        } else {
          // 大型剧本：只列出重要角色（有官职或高重要度的）
          var _importantNames = (GM.chars || []).filter(function(c) {
            return c.alive !== false && (c.officialTitle || (c.importance || 0) > 50 || c.isPlayer);
          }).map(function(c) { return c.name; });
          if (_importantNames.length > 0) {
            sysP += '\n\n【重要角色名单（严禁虚构不存在的人名，另有' + (_aliveNames.length - _importantNames.length) + '名次要角色未列出）】';
            sysP += '\n' + _importantNames.join('、');
          }
        }
      }
      // 有效地名白名单（从行政区划收集）
      if (P.adminHierarchy) {
        var _placeNames = [];
        Object.keys(P.adminHierarchy).forEach(function(k) {
          var ah = P.adminHierarchy[k];
          if (ah && ah.divisions) (function _w(divs) {
            divs.forEach(function(d) { if (d.name) _placeNames.push(d.name); if (d.children) _w(d.children); if (d.divisions) _w(d.divisions); });
          })(ah.divisions);
        });
        if (_placeNames.length > 0 && _placeNames.length <= 80) {
          sysP += '\n\n【当前有效地名名单（严禁虚构不存在的地名）】';
          sysP += '\n' + _placeNames.join('、');
        }
      }
    })();

    // 1.2: 模型适配——获取默认温度和JSON包裹格式
    var _modelTemp = P.ai.temp || (typeof ModelAdapter !== 'undefined' ? ModelAdapter.getDefaultTemp() : 0.8);
    var _modelFamily = (typeof ModelAdapter !== 'undefined') ? ModelAdapter.detectFamily(P.ai.model) : 'openai';

    // 1.6: 记录回合开始token
    if (typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.markTurnStart();

    // 1.1 措施3-4: Prompt分层压缩——缓存固定层，限制速变层
    if (typeof PromptLayerCache !== 'undefined') {
      // 记录本次sysP长度供调试
      DebugLog.log('ai', '[PromptLayer] sysP总长:' + sysP.length + '字符, hash:' + PromptLayerCache.computeHash().substring(0, 20));
      // 缓存固定层hash——下回合可用于判断是否需要重建
      PromptLayerCache.getFixedLayer(function() { return sysP.substring(0, 2000); }); // 缓存前2000字符（朝代设定/规则等固定部分）
    }

    // 7.2: prompt去重——如果固定层与上回合相同，标注给AI"延续上回合"
    if (typeof PromptLayerCache !== 'undefined') {
      var _fixedHash = PromptLayerCache.computeHash();
      if (GM._lastSysPHash && GM._lastSysPHash === _fixedHash) {
        tp += '\n（系统提示：本回合世界设定/角色配置与上回合完全相同，请基于上回合状态延续推演）\n';
      }
      GM._lastSysPHash = _fixedHash;
    }

    // 安全检查：sysP长度过大时截断低优先级段落（每字符约0.5 token，sysP超过contextK*512字符则需截断）
    var _sysPMaxChars = _tokCp.contextK * 512;
    if (sysP.length > _sysPMaxChars) {
      _dbg('[Prompt] sysP过长(' + sysP.length + '字符)，截断到' + _sysPMaxChars);
      sysP = sysP.substring(0, _sysPMaxChars) + '\n...(系统提示过长，部分参考信息已截断)';
    }

    try{
      // 3.3: Sub-call注册化——共享变量前置声明 + 管线描述 + 执行包装器
      var _aiDepth = (P.conf && P.conf.aiCallDepth) || 'full';
      var aiThinking = '';
      var memoryReview = '';
      var p1 = null;
      var p2 = null;
      var p1Summary = '';
      GM._turnAiResults = {}; // 收集所有Sub-call的原始返回值
      GM._subcallTimings = {}; // 收集每个Sub-call的耗时

      // 3.3: Sub-call管线描述（用于调试/监控/未来完整迁移）
      var _subcallMeta = [
        {id:'sc0', name:'AI深度思考', minDepth:'standard', order:0},
        {id:'sc05', name:'记忆回顾', minDepth:'standard', order:5},
        {id:'sc1', name:'结构化数据', minDepth:'lite', order:100},
        {id:'sc1b', name:'文事鸿雁人际', minDepth:'lite', order:110},
        {id:'sc1c', name:'势力外交·NPC阴谋', minDepth:'lite', order:120},
        {id:'sc15', name:'NPC深度', minDepth:'standard', order:150},
        {id:'sc16', name:'势力推演', minDepth:'full', order:160},
        {id:'sc17', name:'经济财政', minDepth:'full', order:170},
        {id:'sc18', name:'军事态势', minDepth:'full', order:180},
        {id:'sc2', name:'叙事正文', minDepth:'lite', order:200},
        {id:'sc25', name:'伏笔记忆', minDepth:'lite', order:250},
        {id:'sc27', name:'叙事审查', minDepth:'standard', order:270},
        {id:'sc07', name:'NPC认知整合', minDepth:'lite', order:275},
        {id:'sc28', name:'世界快照', minDepth:'full', order:280}
      ];

      // 3.3: Sub-call执行包装器——统一计时/错误处理/重试 + AI调度统计
      if (!GM._aiDispatchStats) GM._aiDispatchStats = { totalCalls:0, totalTime:0, errors:0, byId:{}, errorLog:[] };
      async function _runSubcall(id, name, minDepth, fn) {
        var _depthOrder = {lite:0, standard:1, full:2};
        if (_depthOrder[_aiDepth] < _depthOrder[minDepth]) {
          _dbg('[' + id + '] 跳过(depth=' + _aiDepth + '<' + minDepth + ')');
          return;
        }
        var _start = Date.now();
        var _retries = (id === 'sc1') ? 2 : 1;
        var _stats = GM._aiDispatchStats;
        if (!_stats.byId[id]) _stats.byId[id] = { name:name, calls:0, totalTime:0, errors:0 };
        _stats.totalCalls++;
        _stats.byId[id].calls++;
        for (var _attempt = 0; _attempt <= _retries; _attempt++) {
          try {
            await fn();
            var _elapsed = Date.now() - _start;
            GM._subcallTimings[id] = _elapsed;
            _stats.totalTime += _elapsed;
            _stats.byId[id].totalTime += _elapsed;
            return;
          } catch(_scErr) {
            _dbg('[' + name + '] 第' + (_attempt+1) + '次执行失败:', _scErr.message);
            if (_attempt >= _retries) {
              var _elapsed = Date.now() - _start;
              GM._subcallTimings[id] = _elapsed;
              _stats.totalTime += _elapsed;
              _stats.byId[id].totalTime += _elapsed;
              _stats.errors++;
              _stats.byId[id].errors++;
              _stats.errorLog.push({ id:id, name:name, turn:GM.turn, msg:_scErr.message, time:new Date().toLocaleTimeString() });
              if (_stats.errorLog.length > 20) _stats.errorLog.shift();
              console.warn('[' + name + '] 重试' + _retries + '次后仍失败');
              if (typeof toast === 'function') toast('\u26A0 ' + name + '失败，部分推演可能不完整');
            }
          }
        }
      }

      // --- Sub-call 0: AI深度思考（全面分析当前局势，不限字数）---
      await _runSubcall('sc0', 'AI深度思考', 'standard', async function() {
      showLoading("AI\u6DF1\u5EA6\u601D\u8003",42);
      var tp0 = tp + '\n\u8BF7\u6781\u5176\u6DF1\u5165\u5730\u5206\u6790\u5F53\u524D\u5C40\u52BF\uFF0C\u8FD4\u56DEJSON\uFF1A\n' +
        '{"tensions":"\u5F53\u524D5\u4E2A\u6700\u5927\u77DB\u76FE/\u5371\u673A\u53CA\u5176\u4E25\u91CD\u7A0B\u5EA6(150\u5B57)","consequences":"\u73A9\u5BB6\u672C\u56DE\u5408\u6BCF\u4E2A\u884C\u52A8\u7684\u8BE6\u7EC6\u540E\u679C\u5206\u6790(150\u5B57)","npc_spotlight":"\u672C\u56DE\u5408\u6700\u53EF\u80FD\u6709\u52A8\u4F5C\u76845\u4E2ANPC\u53CA\u5176\u52A8\u673A\u548C\u884C\u52A8\u65B9\u5F0F(200\u5B57)","faction_dynamics":"\u975E\u73A9\u5BB6\u52BF\u529B\u672C\u56DE\u5408\u7684\u81EA\u4E3B\u884C\u52A8\u8BE6\u7EC6\u63A8\u6F14(200\u5B57)","family_dynamics":"\u5BB6\u65CF/\u540E\u5BAB/\u5A5A\u59FB\u5C42\u9762\u7684\u6F5C\u5728\u53D8\u5316(100\u5B57)","class_unrest":"\u5404\u9636\u5C42\u7684\u4E0D\u6EE1\u60C5\u7EEA\u548C\u53EF\u80FD\u7684\u6C11\u53D8(100\u5B57)","economic_pressure":"\u8D22\u653F\u538B\u529B\u548C\u7ECF\u6D4E\u8D70\u5411(80\u5B57)","foreshadow":"\u5E94\u57CB\u4E0B\u76843\u4E2A\u4F0F\u7B14\u53CA\u5176\u5C06\u5728\u4F55\u65F6\u5F15\u7206(100\u5B57)","mood":"\u672C\u56DE\u5408\u53D9\u4E8B\u5E94\u8425\u9020\u7684\u60C5\u611F\u57FA\u8C03(50\u5B57)"}\n' +
        '\u8FD9\u662F\u4F60\u7684\u6DF1\u5EA6\u601D\u8003\u8FC7\u7A0B\uFF0C\u4E0D\u663E\u793A\u7ED9\u73A9\u5BB6\u3002\u8BF7\u5145\u5206\u601D\u8003\uFF0C\u4E0D\u8981\u5401\u60DC\u5B57\u6570\u3002';
      var resp0 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
        body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp0}], temperature:0.6, max_tokens:_tok(12000)})});
      if (resp0.ok) {
        var data0 = await resp0.json();
        _checkTruncated(data0, '局势分析');
        if (data0.choices && data0.choices[0] && data0.choices[0].message) {
          aiThinking = data0.choices[0].message.content;
          GM._turnAiResults.thinking = aiThinking;
          _dbg('[AI Think]', aiThinking.substring(0, 200));
        }
      }
      }); // end Sub-call 0 _runSubcall

      // --- Sub-call 0.5: 深度记忆回顾 ---
      await _runSubcall('sc05', '记忆回顾', 'standard', async function() {
      showLoading("\u6DF1\u5EA6\u56DE\u987E",48);
      try {
        // 收集最近10回合的关键事件（扩大回溯范围）
        var _recentHistory = '';
        if (GM.shijiHistory && GM.shijiHistory.length > 0) {
          GM.shijiHistory.slice(-10).forEach(function(sh) {
            _recentHistory += 'T' + sh.turn + ': ' + (sh.shizhengji || '').substring(0, 200) + '\n';
          });
        }
        if (GM.evtLog && GM.evtLog.length > 0) {
          var _keyEvts = GM.evtLog.slice(-30).map(function(e) { return 'T' + e.turn + ' [' + e.type + '] ' + e.text; }).join('\n');
          _recentHistory += '\n' + _keyEvts;
        }
        // 加入伏笔和AI记忆
        if (GM._foreshadows && GM._foreshadows.length > 0) {
          var _compressedFore = GM._foreshadows.filter(function(f){return f.type==='compressed';});
          var _activeFore = GM._foreshadows.filter(function(f){return f.type!=='compressed';}).slice(-15);
          _recentHistory += '\n【已埋伏笔】\n';
          if (_compressedFore.length > 0) _recentHistory += _compressedFore.map(function(f){return f.content||f;}).join('\n') + '\n';
          _recentHistory += _activeFore.map(function(f){return 'T'+(f.turn||'?')+': '+(f.content||f.text||f);}).join('\n');
        }
        if (GM._aiMemory && GM._aiMemory.length > 0) {
          // 使用动态探测的上下文参数决定注入量
          var _injCp = getCompressionParams();
          var _memInjectCount = _injCp.memInjectCount;
          // 优先注入压缩摘要（type=compressed），再注入最近记忆
          var _compressedMem = GM._aiMemory.filter(function(m){return m.type==='compressed';});
          var _recentMem = GM._aiMemory.filter(function(m){return m.type!=='compressed';}).slice(-_memInjectCount);
          _recentHistory += '\n【AI记忆】\n';
          if (_compressedMem.length > 0) _recentHistory += _compressedMem.map(function(m){return m.content||m;}).join('\n') + '\n';
          _recentHistory += _recentMem.map(function(m){return 'T'+(m.turn||'?')+': '+(m.content||m.text||m);}).join('\n');
        }
        // 加入玩家决策记录
        if (GM.playerDecisions && GM.playerDecisions.length > 0) {
          _recentHistory += '\n\u3010\u73A9\u5BB6\u51B3\u7B56\u3011\n' + GM.playerDecisions.slice(-8).map(function(d){return 'T'+(d.turn||'?')+' '+d.type+': '+(d.content||d.description||'');}).join('\n');
        }
        // 决策回响（让AI追踪延迟后果）
        if (GM._decisionEchoes && GM._decisionEchoes.length > 0) {
          _recentHistory += '\n【决策回响——延迟后果】\n';
          GM._decisionEchoes.slice(-5).forEach(function(de) { _recentHistory += 'T' + de.turn + ': ' + de.content + '→预期回响:' + (de.echoDesc||'') + '（' + (de.delayTurns||3) + '回合后）\n'; });
        }
        // 考课历史摘要
        if (GM._annualReviewHistory && GM._annualReviewHistory.length > 0) {
          var _lr = GM._annualReviewHistory[GM._annualReviewHistory.length - 1];
          _recentHistory += '\n【最近考课T' + _lr.turn + '】优等' + _lr.excellent + '人 劣等' + _lr.poor + '人';
          if (_lr.promotions.length) _recentHistory += ' 建议擢升:' + _lr.promotions.join('、');
          if (_lr.demotions.length) _recentHistory += ' 建议左迁:' + _lr.demotions.join('、');
          _recentHistory += '\n';
        }
        // 情节线索
        if (GM._plotThreads && GM._plotThreads.length > 0) {
          _recentHistory += '\n【活跃情节线索】\n';
          GM._plotThreads.filter(function(t){return t.status==='active';}).slice(-5).forEach(function(t) { _recentHistory += '  · ' + t.title + '(' + t.type + ') P' + t.priority + '\n'; });
        }
        if (_recentHistory.length > 50) {
          var tp05 = '\u4EE5\u4E0B\u662F\u8FD1\u671F\u7684\u5B8C\u6574\u4E8B\u4EF6\u8BB0\u5F55\u3001\u5DF2\u57CB\u4F0F\u7B14\u3001AI\u8BB0\u5FC6\u548C\u73A9\u5BB6\u51B3\u7B56\uFF1A\n' + _recentHistory + '\n\n';
          tp05 += '\u8BF7\u8FD4\u56DEJSON\uFF1A\n{"causal_chains":"\u8FD1\u671F\u4E8B\u4EF6\u4E4B\u95F4\u7684\u5B8C\u6574\u56E0\u679C\u5173\u7CFB\u94FE(200\u5B57)","unresolved":"\u5C1A\u672A\u89E3\u51B3\u7684\u7EBF\u7D22\u548C\u60AC\u5FF5\u2014\u2014\u54EA\u4E9B\u4F0F\u7B14\u5E94\u8BE5\u5F15\u7206(150\u5B57)","patterns":"\u53CD\u590D\u51FA\u73B0\u7684\u6A21\u5F0F\u548C\u52A0\u901F\u7684\u8D8B\u52BF(100\u5B57)","player_impact":"\u73A9\u5BB6\u8FD1\u671F\u51B3\u7B56\u7684\u7D2F\u79EF\u5F71\u54CD\u2014\u2014\u54EA\u4E9B\u540E\u679C\u5373\u5C06\u663E\u73B0(150\u5B57)","npc_memories":"\u5404NPC\u5BF9\u8FD1\u671F\u4E8B\u4EF6\u7684\u8BB0\u5FC6\u548C\u60C5\u7EEA\u53D8\u5316(100\u5B57)","momentum":"\u5F53\u524D\u4E16\u754C\u7684\u60EF\u6027\u65B9\u5411\u2014\u2014\u5982\u679C\u6CA1\u6709\u5E72\u9884\uFF0C\u4E8B\u60C5\u4F1A\u5F80\u54EA\u4E2A\u65B9\u5411\u53D1\u5C55(80\u5B57)"}\n';
          tp05 += '\u8FD9\u662F\u4F60\u7684\u6DF1\u5EA6\u5185\u90E8\u5206\u6790\u3002\u8BF7\u5145\u5206\u601D\u8003\u6BCF\u4E00\u6761\u56E0\u679C\u94FE\u3002';
          var resp05 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp05}], temperature:0.5, max_tokens:_tok(5000)})});
          if (resp05.ok) {
            var data05 = await resp05.json();
            _checkTruncated(data05, '因果合成');
            if (data05.choices && data05.choices[0] && data05.choices[0].message) {
              memoryReview = data05.choices[0].message.content;
              GM._turnAiResults.memoryReview = memoryReview;
              _dbg('[Memory Review]', memoryReview.substring(0, 150));
            }
          }
        }
      } catch(e05) { _dbg('[Memory Review] \u5931\u8D25:', e05); throw e05; }
      }); // end Sub-call 0.5 _runSubcall

      // --- Sub-call 1: 结构化数据 (时政记/数值变化/事件/角色状态) --- [always runs]
      await _runSubcall('sc1', '结构化数据', 'lite', async function() {
      var _preAnalysis = '';
      if (aiThinking) _preAnalysis += '\n\u3010AI\u5C40\u52BF\u5206\u6790\u3011\n' + aiThinking + '\n';
      if (memoryReview) _preAnalysis += '\u3010\u8DE8\u56DE\u5408\u56E0\u679C\u94FE\u3011\n' + memoryReview + '\n';
      if (_preAnalysis) _preAnalysis += '\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5206\u6790\u63A8\u6F14\uFF0C\u786E\u4FDD\u524D\u56DE\u5408\u7684\u60AC\u5FF5\u5F97\u5230\u56DE\u5E94\uFF0C\u56E0\u679C\u94FE\u5F97\u5230\u5EF6\u7EED\u3002\n';
      var tp1=tp+_preAnalysis + "\n请仅返回绝JSON，包含:\n"+
        "{\"turn_summary\":\"一句话概括本回合最重要的变化(30-50字，如:北境叛乱平定，国库因军费骤降三成)\","+
        // 实录：纯文言史官体，仿资治通鉴/历代实录
        "\"shilu_text\":\"实录"+_shiluMin+"-"+_shiluMax+"字——纯文言文(仿《资治通鉴》《明实录》)，以干支月份/日为单位，记事不评论。只记可验证事实：诏令、任免、战事、灾异、人事大变。句式仿实录：'某月某日，上诏……'/'是月，某地……'/'上命某官……'。禁止白话词汇，禁止主观评论。\","+
        // 时政记：朝政纪要体（副标题+总括+分领域因果链+总结）
        "\"szj_title\":\"时政记副标题——七字对仗两句，概括本回合主题(如'雷霆除藩安豫地，断禄激变祸萧墙'；两句用'，'分隔)\","+
        "\"shizhengji\":\"时政记正文"+_szjMin+"-"+_szjMax+"字——仿崇祯朝政纪要体：\\n  1.开篇总括：'陛下本回合……颁布数道谕旨：其一……；其二……'，逐条复述玩家诏令/私人行动\\n  2.按领域分段(3-5段)——军事与边防/内政与民生/吏治与人事/宗室与外戚/关外局势等，每段开头用【军事】【朝政】【经济】【外交】【民生】【宫廷】等方括号标签\\n  3.每段必须完整因果链：诏令→执行者→执行过程→阻力/意外→实际效果→遗留隐患。不要只写结果，要写过程和阻碍\\n  4.跨回合延续：用'此前''原本''延续'衔接往期决策的后续影响\\n  5.自然融入信息源：据XX奏报/有司呈报/密探来报/坊间传言/边军塘报\\n  段间用\\n\\n分隔。\","+
        "\"szj_summary\":\"时政记总结一句话——四字对仗成语风格(如'内帑充盈，边军暂安，然宗室怨气冲天，局势如履薄冰')\","+
        // 玩家角色状态——保留(供NPC记忆系统与昏君叙事基调使用；同时会在后人戏说中自然展现)
        "\"player_status\":\"政治处境(1句话——朝局格局、权力态势、外部威胁)\",\"player_inner\":\"主角内心独白(1-2句，第一人称，私人情感、矛盾挣扎——此字段仅供NPC记忆，不会直接展示)\","+
        // 人事变动：从office_changes/title_changes/character_deaths聚合后的可读列表
        "\"personnel_changes\":[{\"name\":\"姓名\",\"former\":\"原职或原身份\",\"change\":\"变动描述\",\"reason\":\"原因(可选)\"}],"+
        "\"resource_changes\":{\"\u8D44\u6E90\u540D\":\u53D8\u5316\u91CF},\"relation_changes\":{\"\u5173\u7CFB\u540D\":\u53D8\u5316\u91CF},"+
        "\"event\":{\"title\":\"...\",\"type\":\"...\"}\u6216null,"+
        "\"npc_actions\":[{\"name\":\"\u89D2\u8272\u540D\",\"action\":\"\u505A\u4E86\u4EC0\u4E48(30\u5B57)\",\"target\":\"\u5BF9\u8C01\",\"result\":\"\u7ED3\u679C\",\"behaviorType\":\"\u884C\u4E3A\u7C7B\u578B\",\"publicReason\":\"\u5BF9\u5916\u8BF4\u8F9E\",\"privateMotiv\":\"\u771F\u5B9E\u52A8\u673A\",\"new_location\":\"\u56E0\u884C\u52A8\u8F6C\u79FB\u5230\u4F55\u5904(\u53EF\u9009)\"}],"+
        "\"affinity_changes\":[{\"a\":\"\u89D2\u8272A\",\"b\":\"\u89D2\u8272B\",\"delta\":\u53D8\u5316\u91CF,\"reason\":\"\u539F\u56E0\",\"relType\":\"blood/marriage/mentor/sworn/rival/benefactor/enemy(\u53EF\u9009\uFF0C\u65B0\u589E\u6216\u5F3A\u5316\u5173\u7CFB\u7C7B\u578B)\"}],"+
        "\"goal_updates\":[{\"name\":\"\u89D2\u8272\u540D\",\"goalId\":\"goal_1\",\"action\":\"update/add/complete/replace\",\"longTerm\":\"\u957F\u671F\u76EE\u6807(add/replace\u65F6\u5FC5\u586B)\",\"shortTerm\":\"\u5F53\u524D\u77ED\u671F\u76EE\u6807\",\"progress\":\"0-100\",\"context\":\"\u5F53\u524D\u884C\u52A8\u65B9\u5411(1\u53E5)\",\"type\":\"power/wealth/revenge/protect/knowledge/faith(add\u65F6\u5FC5\u586B)\",\"priority\":\"1-10\"}],\"character_deaths\":[{\"name\":\"角色名\",\"reason\":\"死因描述\"}],\"char_updates\":[{\"name\":\"角色名\",\"loyalty_delta\":0,\"ambition_delta\":0,\"stress_delta\":0,\"intelligence_delta\":0,\"valor_delta\":0,\"military_delta\":0,\"administration_delta\":0,\"management_delta\":0,\"charisma_delta\":0,\"diplomacy_delta\":0,\"benevolence_delta\":0,\"legitimacy_delta\":0,\"add_traits\":[\"新获得的特质id\"],\"remove_traits\":[\"失去的特质id\"],\"new_location\":\"新所在地(可选,如被贬/外派/召回)\",\"new_stance\":\"新立场(可选)\",\"new_party\":\"新党派(可选)\",\"action_type\":\"行为类型(punish/reward/betray/mercy/declare_war/reform等)\",\"reason\":\"原因\"}],\"faction_changes\":[{\"name\":\"\u52BF\u529B\u540D\",\"strength_delta\":0,\"economy_delta\":0,\"playerRelation_delta\":0,\"reason\":\"\u539F\u56E0\"}],\"party_changes\":[{\"name\":\"\u515A\u6D3E\u540D\",\"influence_delta\":0,\"new_status\":\"\u6D3B\u8DC3/\u5F0F\u5FAE/\u88AB\u538B\u5236/\u5DF2\u89E3\u6563(\u53EF\u9009)\",\"new_leader\":\"\u65B0\u9996\u9886(\u53EF\u9009)\",\"new_agenda\":\"\u65B0\u8BAE\u7A0B(\u53EF\u9009)\",\"new_shortGoal\":\"\u65B0\u77ED\u671F\u76EE\u6807(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"faction_events\":[{\"actor\":\"\u52BF\u529BA\",\"target\":\"\u52BF\u529BB\u6216\u7A7A(\u5185\u653F\u4E8B\u4EF6\u53EF\u4E0D\u586Btarget)\",\"action\":\"\u5177\u4F53\u884C\u4E3A\u63CF\u8FF0(30\u5B57)\",\"actionType\":\"\u5916\u4EA4/\u5185\u653F/\u519B\u4E8B/\u7ECF\u6D4E\",\"result\":\"\u7ED3\u679C(30\u5B57)\",\"strength_effect\":0,\"geoData\":{\"routeKm\":0,\"terrainDifficulty\":0.5,\"hasOfficialRoad\":true,\"routeDescription\":\"\u7ECF\u2026\u2026\",\"passesAndBarriers\":[],\"fortLevel\":0,\"garrison\":0}}],"+
        "\"faction_relation_changes\":[{\"from\":\"\u52BF\u529BA\",\"to\":\"\u52BF\u529BB\",\"type\":\"\u65B0\u5173\u7CFB\",\"delta\":\u53D8\u5316\u91CF,\"reason\":\"\u539F\u56E0\"}],"+
        "\"class_changes\":[{\"name\":\"\u9636\u5C42\u540D\",\"satisfaction_delta\":0,\"influence_delta\":0,\"new_demands\":\"\u65B0\u8BC9\u6C42(\u53EF\u9009)\",\"new_status\":\"\u65B0\u5730\u4F4D(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"army_changes\":[{\"name\":\"\u90E8\u961F\u540D\",\"soldiers_delta\":\u5175\u529B\u53D8\u5316,\"morale_delta\":\u58EB\u6C14\u53D8\u5316,\"training_delta\":\u8BAD\u7EC3\u53D8\u5316,\"destination\":\"\u8C03\u5175\u76EE\u7684\u5730(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"item_changes\":[{\"name\":\"\u7269\u54C1\u540D\",\"acquired\":true,\"owner\":\"\u65B0\u6301\u6709\u8005\",\"reason\":\"\u83B7\u5F97/\u5931\u53BB\u539F\u56E0\"}],"+
        "\"era_state_delta\":{\"socialStability_delta\":0,\"economicProsperity_delta\":0,\"centralControl_delta\":0,\"militaryProfessionalism_delta\":0},"+
        "\"global_state_delta\":{\"taxPressure_delta\":0},"+
        "\"office_changes\":[{\"dept\":\"\u90E8\u95E8\",\"position\":\"\u5B98\u804C\",\"action\":\"appoint/dismiss/promote/demote/transfer/evaluate/reform\",\"person\":\"\u4EBA\u540D\",\"reason\":\"\u539F\u56E0\",\"newDept\":\"\u65B0\u90E8\u95E8(transfer\u65F6)\",\"newPosition\":\"\u65B0\u5B98\u804C(transfer/promote\u65F6)\",\"newRank\":\"\u65B0\u54C1\u7EA7(promote/demote\u65F6)\",\"evaluator\":\"\u8003\u8BC4\u8005NPC\u540D(evaluate\u65F6\u5FC5\u586B)\",\"grade\":\"\u5353\u8D8A/\u79F0\u804C/\u5E73\u5EB8/\u5931\u804C(evaluate\u65F6)\",\"comment\":\"\u8003\u8BC4\u8BC4\u8BED(evaluate\u65F6)\",\"reformDetail\":\"\u6539\u9769\u5185\u5BB9(reform\u65F6\uFF1A\u589E\u8BBE/\u88C1\u6492/\u5408\u5E76/\u6539\u540D)\"}],"+
        "\"office_aggregate\":[{\"dept\":\"\u90E8\u95E8\u540D\",\"actualCount_delta\":\"\u5B9E\u6709\u4EBA\u6570\u53D8\u5316(+N\u9012\u8865/-N\u79BB\u804C)\",\"evaluation_summary\":{\"excellent\":0,\"good\":0,\"average\":0,\"poor\":0,\"named_excellent\":[\"\u5177\u8C61\u89D2\u8272\"],\"named_good\":[\"\u5177\u8C61\u89D2\u8272\"]},\"corruption_found\":0,\"named_corrupt\":[\"\u5177\u8C61\u8D2A\u8150\u8005\"],\"narrative\":\"\u6DF7\u5408\u53D9\u8FF0\u2014\u2014\u5177\u8C61\u89D2\u8272\u70B9\u540D+\u5176\u4F59\u7528\u6570\u5B57\"}],"+
        // 官制占位实体化——当推演涉及编辑器留的 generated:false 占位时，AI 按史料风格生成对应任职者
        "\"office_spawn\":[{\"dept\":\"部门名(与officeTree中的node.name精确匹配)\",\"position\":\"官职名(与positions[].name精确匹配)\",\"holderName\":\"按本朝代命名习惯起的真实姓名(不得重复现有角色)\",\"age\":35,\"abilities\":{\"intelligence\":60,\"administration\":65,\"military\":40,\"valor\":35,\"charisma\":55,\"diplomacy\":50,\"benevolence\":55},\"personality\":\"性格简述\",\"stance\":\"中立/君党/太子党/外戚党等\",\"loyalty\":55,\"reason\":\"为何在本回合被实体化(如'玩家下诏涉及此官''推演提及此官员')\"}],"+
        // 党派议程演进——AI 每 3-5 回合评估，基于时局变化输出
        "\"party_agenda_shift\":[{\"party\":\"党派名\",\"newAgenda\":\"新议程\",\"oldAgenda\":\"旧议程\",\"reason\":\"变化原因\",\"influence_delta\":0}],"+
        // 党派分裂——凝聚力过低或议程分歧严重时
        "\"party_splinter\":[{\"parent\":\"原党派名\",\"newName\":\"分裂出的新党派名\",\"newLeader\":\"新党派领袖\",\"members\":[\"带走的成员\"],\"ideology\":\"新派立场\",\"reason\":\"分裂原因\"}],"+
        // 党派合流——势力均衡或大势所迫
        "\"party_merge\":[{\"absorber\":\"吸收方党派\",\"absorbed\":\"被吸收党派\",\"reason\":\"合流原因\"}],"+
        // 势力继承事件——首脑死亡后触发
        "\"faction_succession\":[{\"faction\":\"势力名\",\"oldLeader\":\"旧首脑\",\"newLeader\":\"新首脑\",\"legitimacy\":70,\"stability_delta\":-10,\"disputeType\":\"正常继承/争位/篡位/内战/外戚专政\",\"narrative\":\"继承叙事\"}],"+
        // 起义前兆——酝酿期状态（流民聚集/密谋/谶语流传），不一定爆发起义
        "\"revolt_precursor\":[{\"class\":\"蓄势阶层\",\"region\":\"发生地\",\"indicator\":\"famine饥荒/landConcentration土地兼并/heavyTax苛税/corvee繁役/officialCorruption吏治腐败/propheticOmen谶纬异象/secretSociety教门密谋\",\"severity\":\"mild/severe/critical\",\"detail\":\"具体表现(如'青州连续三年旱，流民十万涌入徐州')\",\"couldLeadTo\":\"可能导致的起义类型\"}],"+
        // 阶层起义爆发——进入长周期生命周期，AI 每回合通过 revolt_update 推进
        "\"class_revolt\":[{"+
          "\"revoltId\":\"本次起义的唯一ID(如revolt_huangjin/revolt_1886)\","+
          "\"class\":\"起义阶层\","+
          "\"region\":\"起义地区(须与行政区划匹配)\","+
          "\"leaderName\":\"起义领袖姓名(按朝代命名，如张角、黄巢、李自成风格)\","+
          "\"secondaryLeaders\":[\"副将/兄弟/军师\"],"+
          "\"ideology\":\"religious宗教/dynastic光复/ethnic民族/populist民生/nobleClaim宗室分支/warlord军阀/tributary边疆\","+
          "\"organizationType\":\"flowingBandit流寇/baseArea根据地/builtState建制/secretSociety教门/militaryMutiny军变\","+
          "\"slogan\":\"口号(如'苍天已死黄天当立'、'均田免粮'、'驱除鞑虏')\","+
          "\"religiousSect\":\"宗教派别(ideology=religious时必填，如太平道/白莲教)\","+
          "\"historicalArchetype\":\"参考的历史原型(如'黄巾之乱''黄巢之乱''红巾军')\","+
          "\"scale\":\"小/中/大/滔天\","+
          "\"militaryStrength\":5000,"+
          "\"composition\":\"兵员组成(如'流民为主、饥卒为辅、少数武装乡民')\","+
          "\"supplyStatus\":50,"+
          "\"phase\":\"brewing酝酿/uprising首义/expansion扩张/stalemate相持/turning转折/decline衰落/establishment建政/ending结局\","+
          "\"demands\":[\"起义诉求\"],"+
          "\"grievances\":[\"积怨(连续三年旱灾/徭役过重/官员贪索/土地兼并)\"],"+
          "\"spreadPattern\":\"mobile流动作战/baseDefense根据地/urbanSiege攻城/cascade多点齐发\","+
          "\"reason\":\"起义导火索\""+
        "}],"+
        // 起义进展更新——AI 每回合推进阶段（类似诏令生命周期）
        "\"revolt_update\":[{"+
          "\"revoltId\":\"匹配现有 revolt 的 id\","+
          "\"newPhase\":\"新阶段(brewing→uprising→expansion→stalemate→turning→decline/establishment→ending)\","+
          "\"territoryGained\":[\"本回合占领的城/州\"],"+
          "\"territoryLost\":[\"本回合失去的\"],"+
          "\"strength_delta\":1000,"+
          "\"supplyStatus_delta\":-5,"+
          "\"absorbedForces\":[\"本回合收编的势力/降将(如'归附了张某三千人'、'收编某都尉降卒')\"],"+
          "\"externalSupport\":[\"外援(如'受契丹暗中接济粮草')\"],"+
          "\"defectedOfficials\":[\"归附的朝廷官员(他们会自动转投起义军)\"],"+
          "\"counterForces\":[\"对抗力量(如'某乡勇首领某某纠集千人抗拒')\"],"+
          "\"narrative\":\"30-120 字阶段叙事——体现历史真实感\","+
          "\"keyEvent\":\"本回合关键事件(如'攻陷长安'、'领袖受伤')\","+
          "\"leaderCasualty\":\"领袖伤亡情况(可空；如'领袖中箭负伤'、'副将战死')\""+
        "}],"+
        // 起义镇压行动——朝廷派兵/士绅乡勇/外援等对抗
        "\"revolt_suppress\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"suppressor\":\"镇压主力(官军将领/乡勇首领/异族援军)\","+
          "\"suppressorForce\":20000,"+
          "\"tactic\":\"围剿/坚壁清野/分化瓦解/利诱降服/借异族/迁徙裹挟\","+
          "\"outcome\":\"victory彻底剿灭/partial部分镇压/stalemate相持/defeat反被击溃\","+
          "\"casualties\":{\"rebel\":5000,\"official\":1500,\"civilian\":3000},"+
          "\"narrative\":\"战况叙事\""+
        "}],"+
        // 起义招安——朝廷给条件换取归顺
        "\"revolt_amnesty\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"envoy\":\"招安使节NPC\","+
          "\"terms\":\"招安条件(如'封某节度使，残部编入禁军')\","+
          "\"outcome\":\"accepted接受/rejected拒绝/split分化(部分接受部分拒绝)\","+
          "\"acceptedLeaders\":[\"接受招安的领袖\"],"+
          "\"rejectedLeaders\":[\"拒绝的顽固派\"],"+
          "\"fateOfAccepted\":\"归顺后安置(如'宋江等一十八人封武节大夫')\","+
          "\"narrative\":\"招安过程\""+
        "}],"+
        // 问对承诺进展更新——NPC 对玩家承诺任务的执行报告
        "\"commitment_update\":[{\"id\":\"承诺id(匹配GM._npcCommitments)\",\"npcName\":\"承诺者\",\"progress_delta\":10,\"status\":\"executing/completed/failed/delayed\",\"feedback\":\"执行情况叙事(30-80字，具体描述做了什么、遇到什么)\",\"consequenceType\":\"success/partial/obstructed/abandoned\"}],"+
        // 起义转化——建政/割据/融入他派/彻底消散
        "\"revolt_transform\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"transformType\":\"toFaction升级为独立势力/merged融入他派/coopted被招安编入/dissolved自行消散/dynastyReplaced建立新朝(玩家GAMEOVER)\","+
          "\"newFactionName\":\"新势力名(toFaction时必填)\","+
          "\"mergedInto\":\"被并入的势力名(merged时必填)\","+
          "\"finalTerritory\":\"最终控制区(toFaction时)\","+
          "\"narrative\":\"转化叙事\""+
        "}],"+
        // 势力关系动态变化
        "\"faction_relation_shift\":[{\"from\":\"势力A\",\"to\":\"势力B\",\"relation_delta\":-10,\"new_type\":\"敌对/联盟/交战/朝贡/通婚\",\"event\":\"变化事件\",\"reason\":\"原因\"}],"+
        // 党派新建——当局势催生新政治集团（非分裂自既有）
        "\"party_create\":[{\"name\":\"新党派名\",\"ideology\":\"立场\",\"leader\":\"党魁(须已存在或同时在char_updates创建)\",\"influence\":20,\"socialBase\":[{\"class\":\"阶层名\",\"affinity\":0.6}],\"currentAgenda\":\"当前议程\",\"status\":\"活跃\",\"memberCount\":15,\"cohesion\":70,\"crossFaction\":false,\"trigger\":\"触发因素(诏令/事件/人物聚集)\",\"reason\":\"崛起原因\"}],"+
        // 党派覆灭——被查禁/首领被杀/成员风流云散
        "\"party_dissolve\":[{\"name\":\"被解散党派名\",\"cause\":\"banned(查禁)/liquidated(肃清)/faded(自然消亡)/leaderKilled(领袖被杀)/absorbed(吞并他党)\",\"perpetrator\":\"主使者(可空)\",\"fatePerMember\":\"流放/下狱/归隐/转投别党\",\"reason\":\"原因\"}],"+
        // 势力新建——独立/割据/称帝/复国
        "\"faction_create\":[{\"name\":\"新势力名\",\"type\":\"主权国/藩镇/番属/起义军/宗教势力\",\"leader\":\"首脑\",\"territory\":\"控制地区\",\"parentFaction\":\"脱离自的原势力(可空)\",\"strength\":30,\"militaryStrength\":20000,\"economy\":40,\"attitude\":\"敌对\",\"playerRelation\":-30,\"cohesion\":{\"political\":50,\"military\":60,\"economic\":40,\"cultural\":50,\"ethnic\":60,\"loyalty\":50},\"triggerEvent\":\"触发事件(如:安史之乱/黄巾起义/五代更迭)\",\"reason\":\"新建原因\"}],"+
        // 势力覆灭——被灭国/吞并/解体
        "\"faction_dissolve\":[{\"name\":\"被灭势力名\",\"cause\":\"conquered(征服)/absorbed(并入)/collapsed(内部崩解)/seceded_all(分崩离析)/replaced(被取而代之)\",\"conqueror\":\"征服者势力(conquered/absorbed时必填)\",\"territoryFate\":\"territory归属(如:并入某势力/独立成多国/设郡县)\",\"leaderFate\":\"首脑下场(降/死/逃亡)\",\"refugees\":[\"出逃核心人物\"],\"reason\":\"原因\"}],"+
        // 阶层兴起——新的社会阶层出现
        "\"class_emerge\":[{\"name\":\"新阶层名\",\"size\":\"约5%\",\"mobility\":\"中\",\"economicRole\":\"商贸/军事/手工/治理\",\"status\":\"良民\",\"privileges\":\"\",\"obligations\":\"\",\"satisfaction\":50,\"influence\":15,\"demands\":\"诉求\",\"origin\":\"从哪演化来(如:军功地主自均田崩坏中兴起/士商自科举资格放开中兴起)\",\"unrestThreshold\":30,\"reason\":\"兴起原因\"}],"+
        // 阶层消亡——传统阶层衰落/被废除
        "\"class_dissolve\":[{\"name\":\"消亡阶层名\",\"cause\":\"abolished(法令废除)/assimilated(被吸收)/extincted(衰落消亡)/replaced(被新阶层取代)\",\"successorClass\":\"后继阶层(可空)\",\"membersFate\":\"成员去向(如:编入平民/降为贱籍/融入士绅)\",\"reason\":\"原因\"}],"+
        "\"vassal_changes\":[{\"action\":\"establish/break/change_tribute\",\"vassal\":\"\u5C01\u81E3\u52BF\u529B\u540D\",\"liege\":\"\u5B97\u4E3B\u52BF\u529B\u540D\",\"tributeRate\":0.3,\"reason\":\"\u539F\u56E0\"}],"+
        "\"title_changes\":[{\"action\":\"grant/revoke/inherit/promote\",\"character\":\"\u89D2\u8272\u540D\",\"titleName\":\"\u7235\u4F4D\u540D\u79F0\",\"titleLevel\":3,\"hereditary\":true,\"from\":\"\u7EE7\u627F\u6765\u6E90\u89D2\u8272(inherit\u65F6\u5FC5\u586B)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"building_changes\":[{\"action\":\"build/upgrade/destroy/custom_build\",\"territory\":\"行政区划名\",\"type\":\"建筑名称(对应剧本buildingTypes中的name;custom_build时可为自定义名)\",\"isCustom\":false,\"description\":\"自定义建筑时必填——描述作用(AI自判合理性)\",\"level\":1,\"faction\":\"势力名\",\"costActual\":\"实际花费(两)\",\"timeActual\":\"实际工期(回合)\",\"feasibility\":\"合理/勉强/不合理\",\"judgedEffects\":\"AI判定的效果描述——写入推演叙事(如'每月增收银五百两、田亩增一成；建造期民力消耗较大，需徭役若干')\",\"reason\":\"建造原因\"}],"+
        "\"admin_changes\":[{\"action\":\"appoint_governor/remove_governor/adjust\",\"division\":\"\u884C\u653F\u533A\u540D\",\"person\":\"\u4EBA\u540D\",\"prosperity_delta\":0,\"population_delta\":0,\"corruption_delta\":0,\"stability_delta\":0,\"unrest_delta\":0,\"reason\":\"\u5730\u65B9\u5B98\u6CBB\u7406\u884C\u4E3A\u63CF\u8FF0\"}],"+
        // 中国化管辖变更：封建/削藩/改土归流/册封等历史制度动作
        "\"autonomy_changes\":[{\"action\":\"enfeoff_prince/enfeoff_duke/enfeoff_tusi/invest_tributary/establish_fanzhen/grace_edict/abolish_fief/tusi_to_liuguan/conquer_as_prefecture\",\"division\":\"行政区划名\",\"holder\":\"持爵者(enfeoff类必填)\",\"titleName\":\"爵名(如亲王/国公/宣慰使)\",\"subtype\":\"real(实封)/nominal(虚封)\",\"loyalty\":60,\"tributeRate\":0.3,\"risk\":\"rebellion/secession/stable\",\"reason\":\"原因——须与中国历史事件命名对应(推恩令/削藩/改土归流/册封/设郡等)\"}],"+
        "\"admin_division_updates\":[{\"action\":\"add/remove/rename/merge/split/reform/territory_gain/territory_loss\",\"parentDivision\":\"\u4E0A\u7EA7\u884C\u653F\u533A\u540D(add\u65F6\u5FC5\u586B)\",\"division\":\"\u884C\u653F\u533A\u540D\",\"newName\":\"\u65B0\u540D(rename\u65F6)\",\"level\":\"\u884C\u653F\u5C42\u7EA7\",\"population\":0,\"prosperity\":0,\"terrain\":\"\",\"specialResources\":\"\",\"taxLevel\":\"\u4E2D\",\"officialPosition\":\"\u4E3B\u5B98\u804C\u4F4D\",\"governor\":\"\u4E3B\u5B98\u540D\",\"description\":\"\u63CF\u8FF0\",\"mergeInto\":\"\u5408\u5E76\u76EE\u6807(merge\u65F6)\",\"splitResult\":[\"\u62C6\u5206\u540E\u540D\u79F0\u5217\u8868(split\u65F6)\"],\"lostTo\":\"\u5931\u53BB\u7ED9\u54EA\u4E2A\u52BF\u529B(territory_loss\u65F6)\",\"gainedFrom\":\"\u4ECE\u54EA\u4E2A\u52BF\u529B\u83B7\u5F97(territory_gain\u65F6)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"harem_events\":[{\"type\":\"pregnancy/birth/death/rank_change/favor_change/scandal\",\"character\":\"\u5983\u5B50\u540D\",\"detail\":\"\u63CF\u8FF0\",\"newRank\":\"\u65B0\u4F4D\u5206id(rank_change\u65F6)\",\"favor_delta\":\"\u5BA0\u7231\u53D8\u5316\u6570\u503C(favor_change\u65F6)\"}],"+
        // 皇城宫殿变更
        "\"palace_changes\":[{\"action\":\"build/renovate/assign/ruined/abandon\",\"palace\":\"宫殿名\",\"subHall\":\"殿名(assign时必填)\",\"occupant\":\"居住者(assign时必填)\",\"previousOccupant\":\"原居者(assign/移居时)\",\"newPalace\":\"新宫殿名(build时)\",\"palaceType\":\"main_hall/imperial_residence/consort_residence/dowager/crown_prince/ceremonial/garden/office/offering(build时)\",\"costActual\":\"花费(两)\",\"timeActual\":\"工期(回合)\",\"feasibility\":\"合理/勉强/不合理\",\"judgedEffects\":\"AI判定效果(对威望/国库/民力的影响)\",\"reason\":\"原因\"}],"+
        // NPC 互动（人物间多样化关系演进）
        "\"npc_interactions\":[{"+
          "\"type\":\"recommend举荐/impeach弹劾/petition_jointly联名上书/form_clique结党/private_visit私访/invite_banquet宴请/gift_present馈赠/correspond_secret密信/confront对质/mediate调和/frame_up构陷/expose_secret揭发/marriage_alliance联姻/master_disciple师徒缔结/duel_poetry诗文切磋/share_intelligence通风报信/betray背叛/reconcile和解/mourn_together共哀/rival_compete竞争/guarantee担保/slander诽谤\","+
          "\"actor\":\"发起者角色名\","+
          "\"target\":\"对象角色名\","+
          "\"involvedOthers\":[\"涉及的第三方角色\"],"+
          "\"description\":\"具体行为描述(20-60字)\","+
          "\"publicKnown\":true,"+
          "\"evidence\":\"书信/当庭/密会/宴饮/私室/朝堂/书院\","+
          "\"reason\":\"动机\""+
        "}],"+
        // 势力深度互动（中国政治史典型）
        "\"faction_interactions_advanced\":[{"+
          "\"type\":\"military_aid军援/trade_embargo禁运/open_market互市/send_envoy遣使/demand_tribute索贡/pay_tribute献贡/royal_marriage和亲/send_hostage质子/cultural_exchange文化交流/religious_mission宗教使节/proxy_war代理战争/incite_rebellion煽动叛乱/spy_infiltration派细作/assassin_dispatch派刺客/border_clash边境冲突/declare_war宣战/sue_for_peace请和/annex_vassal并吞/recognize_independence承认独立/form_confederation结盟/break_confederation毁约/gift_treasure赠宝/pay_indemnity赔款\","+
          "\"from\":\"势力A\","+
          "\"to\":\"势力B\","+
          "\"viaProxy\":\"第三方代理势力(proxy_war时填)\","+
          "\"terms\":\"具体条款\","+
          "\"tributeItems\":\"贡物清单(tribute时)\","+
          "\"marriageDetails\":\"XX公主嫁YY王(marriage时)\","+
          "\"hostageDetails\":\"XX子入质(hostage时)\","+
          "\"treatyType\":\"条约类型(盟好/称臣/停战/互不侵犯)\","+
          "\"description\":\"完整描述\","+
          "\"durationTurns\":10,"+
          "\"reason\":\"政治/经济/军事动因\""+
        "}],"+
        // 文事作品（诗词文赋画等，AI按触发源+境遇+人物条件判断是否生成）
        "\"cultural_works\":[{"+
          "\"author\":\"作者角色名\","+
          "\"turn\":" + GM.turn + ","+
          "\"date\":\"具体日期/时节(如'元丰五年七月')\","+
          "\"location\":\"创作地点(如'黄州赤壁'/'京师翰林院'/'岭南谪所')\","+
          "\"triggerCategory\":\"career/adversity/social/duty/travel/private/times/mood (8大类)\","+
          "\"trigger\":\"具体触发源(如seeking_official干谒/pass_exam登科/demoted_exile被贬/mourning_parent丁忧/farewell_friend送别/banquet宴饮/imperial_order应制/visit_temple访寺/travel_scenery游山/war_outing出征/disaster_famine灾荒/casual_mood闲情等)\","+
          "\"motivation\":\"spontaneous自发/commissioned受命/flattery干谒/response酬答/mourning哀悼/critique讽谕/celebration颂扬/farewell送别/memorial纪念/ghostwrite代笔/duty应制/self_express自抒\","+
          "\"lifeStage\":\"early_seeking/young_official/mid_career/exiled/mourning/retired/elder\","+
          "\"genre\":\"shi诗/ci词/fu赋/qu曲/ge歌行/wen散文/apply应用文(表书檄露布)/ji记叙文(游记楼记笔记)/ritual祭文碑铭/paratext序跋\","+
          "\"subtype\":\"具体体式(如'七言绝句'/'念奴娇'/'前出师表'/'岳阳楼记'/'干谒投赠诗')\","+
          "\"title\":\"作品题目\","+
          "\"content\":\"【必须全文真实生成】绝句20/绝28字/律诗40/56字/词按词牌字数/赋300-800/文200-600字。严格匹配作者性格+学识+境遇+地点+时代文风，古文忌现代词汇，格律诗尽力平仄对仗\","+
          "\"mood\":\"豪放/悲怆/闲适/讽刺/追思/感怀/咏物/绮丽/清雅/凄苦/豁达 等\","+
          "\"theme\":\"山水纪行/怀古咏史/送别/应制/讽谕/咏物/羁旅/闺怨/田园/边塞/悼亡/求仕干谒/言志抒怀 等\","+
          "\"elegance\":\"refined雅/vernacular俗/mixed兼融\","+
          "\"dedicatedTo\":[\"赠答对象角色名数组(可空)\"],"+
          "\"inspiredBy\":\"次韵或酬答的源作id(可空)\","+
          "\"commissionedBy\":\"委托人角色名(motivation=ghostwrite/commissioned时必填)\","+
          "\"praiseTarget\":\"颂扬对象(若有)\","+
          "\"satireTarget\":\"讽刺对象(若有;讽谕政治时务必填)\","+
          "\"quality\":\"0-100综合质量(AI据作者智慧学识+心境+主题相性自判)\","+
          "\"politicalImplication\":\"政治暗讽/隐含立场描述(可空;讽谏时必填)\","+
          "\"politicalRisk\":\"low/medium/high（高者易招诗狱）\","+
          "\"narrativeContext\":\"30-80字创作背景叙述——让玩家明白此作因何而作\","+
          "\"preservationPotential\":\"low/medium/high(能否传世,视质量/题材/境遇)\""+
        "}],"+
        "\"tech_civic_unlocks\":[{\"name\":\"\u79D1\u6280\u6216\u653F\u7B56\u540D\",\"type\":\"tech/civic\",\"reason\":\"\u89E3\u9501\u539F\u56E0\"}],"+
        "\"policy_changes\":[{\"action\":\"add/remove\",\"name\":\"\u56FD\u7B56\u540D\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"scheme_actions\":[{\"schemer\":\"\u53D1\u8D77\u8005\u540D\",\"action\":\"advance/disrupt/abort/expose\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"timeline_triggers\":[{\"name\":\"\u65F6\u95F4\u7EBF\u4E8B\u4EF6\u540D\",\"result\":\"\u5B9E\u9645\u53D1\u751F\u60C5\u51B5\"}],"+
        "\"edict_feedback\":[{\"content\":\"\u8BCF\u4EE4\u5185\u5BB9\u6458\u8981\",\"assignee\":\"\u8D1F\u8D23\u6267\u884C\u7684\u5B98\u5458\u540D(\u5FC5\u586B)\",\"status\":\"executing/completed/obstructed/partial/pending_delivery(\u4FE1\u4F7F\u5728\u9014\u5C1A\u672A\u9001\u8FBE)\",\"feedback\":\"\u6267\u884C\u60C5\u51B5\u8BE6\u7EC6\u63CF\u8FF0\u2014\u2014\u8C01\u505A\u4E86\u4EC0\u4E48\u3001\u8FDB\u5C55\u5982\u4F55\u3001\u906D\u9047\u4EC0\u4E48\u963B\u529B\u3001\u4E3A\u4EC0\u4E48\u53D7\u963B\",\"progressPercent\":50}],"+
        // 诏令生命周期更新——AI每回合推进诏令的阶段状态，按中国施政真实模型
        "\"edict_lifecycle_update\":[{"+
          "\"edictId\":\"诏令ID——本回合新诏令必须取自上方【本回合诏令】列表中的tracker.id；延续推演的诏令必须用上方【生命周期推演中的诏令】列表中的已有id，不得凭空生成新id\","+
          "\"edictType\":\"amnesty大赦/reward封赏/personnel人事/tax_reduction减赋/tax_increase加征/admin_reform行政改革/economic_reform经济改革/military_mobilize军事动员/diplomacy对外/imperial_ritual巡幸祭祀/criminal_justice刑狱/education_culture文教\","+
          "\"stage\":\"drafting草拟/review审议/promulgation颁布/transmission传达/interpretation地方解读/execution执行/feedback反馈/adjustment调整/sedimentation沉淀\","+
          "\"reformPhase\":\"pilot试点/expand局部推广/national全国推广/backlash反扑/outcome定局(改革类必填)\","+
          "\"stageProgress\":0.5,"+
          "\"executor\":\"督办者角色名\","+
          "\"executorEffectiveness\":0.85,"+
          "\"classesAffected\":{\"士绅\":{\"impact\":-10,\"resistance\":70},\"农民\":{\"impact\":+8,\"resistance\":10}},"+
          "\"factionsAffected\":{\"契丹\":{\"relation_delta\":-5,\"attitude_shift\":\"hostile\",\"reason\":\"对此诏令的反应\"}},"+
          "\"partiesAffected\":{\"东林党\":{\"influence_delta\":-8,\"agenda_impact\":\"反对/支持/不关心\",\"reason\":\"态度依据\"}},"+
          "\"resistanceDescription\":\"阻力来源与形态描述(如'江南士绅联名抗税，地方胥吏怠工截留')\","+
          "\"currentEffects\":{\"stateTreasury\":-50000,\"民心_江南\":-5},"+
          "\"unintendedConsequences\":\"意外后果(如'户部对账发现库银实际仅入库一半，其余被胥吏截留')\","+
          "\"pilotRegion\":\"试点地名(改革类必填)\","+
          "\"expansionRegions\":[\"已推广地区\"],"+
          "\"oppositionLeaders\":[\"反对派核心人物\"],"+
          "\"supporters\":[\"核心支持者\"],"+
          "\"nextStageETA\":2,"+
          "\"canPlayerIntervene\":true,"+
          "\"interventionOptions\":[\"加派干吏督办\",\"暂缓一州\",\"放弃\",\"更严苛执行\"],"+
          "\"narrativeSnippet\":\"30-80字本阶段叙事——体现程序感和阻力感\""+
        "}],"+
        "\"npc_letters\":[{\"from\":\"\u89D2\u8272\u540D(\u5FC5\u987B\u662F\u4E0D\u5728\u4EAC\u57CE\u7684NPC)\",\"type\":\"report/plea/warning/personal/intelligence\",\"urgency\":\"normal/urgent/extreme\",\"content\":\"\u4FE1\u4EF6\u5185\u5BB9(100-200\u5B57\u53E4\u5178\u4E2D\u6587)\",\"suggestion\":\"\u53EF\u64CD\u4F5C\u7684\u5EFA\u8BAE\u6458\u8981(1-2\u53E5\u2014\u2014\u5982'\u8BF7\u6C42\u589E\u63F4\u4E09\u5343\u5175\u9A6C'\u3001'\u5EFA\u8BAE\u51CF\u514D\u6CB3\u5317\u8D4B\u7A0E'\u2014\u2014\u53EF\u9009\uFF0Cpersonal\u7C7B\u578B\u53EF\u4E0D\u586B)\",\"replyExpected\":true}],"+
        "\"npc_correspondence\":[{\"from\":\"\u53D1\u4FE1NPC\",\"to\":\"\u6536\u4FE1NPC\",\"content\":\"\u4FE1\u4EF6\u5185\u5BB9(50-150\u5B57)\",\"summary\":\"\u4E00\u53E5\u8BDD\u6982\u62EC\",\"implication\":\"\u5BF9\u5C40\u52BF\u7684\u6F5C\u5728\u5F71\u54CD\",\"type\":\"secret/alliance/conspiracy/routine\"}],"+
        "\"route_disruptions\":[{\"route\":\"\u8D77\u70B9-\u7EC8\u70B9\",\"reason\":\"\u963B\u65AD\u539F\u56E0(\u6218\u4E71/\u6D2A\u6C34/\u53DB\u519B\u5360\u636E)\",\"resolved\":false}],"+
        "\"foreshadowing\":[{\"action\":\"plant/resolve\",\"content\":\"\u4F0F\u7B14\u5185\u5BB9\",\"type\":\"threat/opportunity/mystery/romance\",\"resolveCondition\":\"\u56DE\u6536\u6761\u4EF6(plant\u65F6\u586B)\"}],"+
        "\"current_issues_update\":[{\"action\":\"add/resolve/update\",\"title\":\"\u65F6\u653F\u8BAE\u9898\u6807\u9898(\u5982:\u6CB3\u5317\u5175\u997F\u62D6\u6B20\u3001\u6C34\u5229\u5E74\u4E45\u5931\u4FEE\u3001\u67D0\u5DDE\u523A\u53F2\u8D2A\u8150\u88AB\u52BE)\",\"category\":\"\u519B\u653F/\u8D22\u8D4B/\u6C34\u5229/\u5409\u51F6/\u8FB9\u9632/\u5F62\u52BF/\u4EBA\u4E8B/\u6C11\u751F\",\"description\":\"\u534A\u6587\u8A00200-500\u5B57\uFF0C\u7ED3\u5408\u63A8\u6F14\u5B9E\u9645\u7EC6\u5316\u63CF\u8FF0\u5177\u4F53\u65F6\u653F\u95EE\u9898\u7684\u6765\u7531\u3001\u6D89\u53CA\u4EBA\u7269\u3001\u5F53\u524D\u6001\u52BF\",\"id\":\"\u66F4\u65B0/\u89E3\u51B3\u65F6\u586B\u5DF2\u6709\u8981\u52A1id\"}],"+
        "\"map_changes\":{\"ownership_changes\":[],\"development_changes\":[]},"+
        // ═══ AI 至高权力·v2 新增语义通道（可选·按需使用）═══
        // char_updates 条目可混搭传统 delta 字段 + 以下扩展字段：
        "\"char_updates\":[{\"name\":\"角色名(必填)\",\"loyalty_delta\":0,\"ambition_delta\":0,\"new_location\":\"简单改位置\",\"updates\":{\"officialTitle\":\"新官职\",\"title\":\"新头衔\",\"age\":45,\"任何字段\":\"任何值\"},\"careerEvent\":{\"title\":\"新职\",\"dept\":\"部门\",\"action\":\"appoint/dismiss/transfer\",\"reason\":\"原因\",\"summary\":\"仕途概要(会附加到 ch.careerHistory)\"},\"travelTo\":{\"toLocation\":\"目的地\",\"estimatedDays\":30,\"reason\":\"赴任/召回/出使\",\"assignPost\":\"到达后就任的官职(可选)\"}}],"+
        // 任命+走位（若 toLocation ≠ ch.location 会自动启动走位·到期自动就任）
        "\"office_assignments\":[{\"name\":\"角色名\",\"post\":\"职位\",\"dept\":\"部门\",\"action\":\"appoint/dismiss/transfer\",\"fromLocation\":\"原地(可选)\",\"toLocation\":\"任职地(不同于原地则走位)\",\"estimatedDays\":30,\"reason\":\"原因\"}],"+
        // 岁入岁出动态增删（派人经商、大工程、新税目等）
        "\"fiscal_adjustments\":[{\"target\":\"guoku/neitang/province:某省\",\"kind\":\"income/expense\",\"category\":\"商贸/工程/赈济/军饷/杂税\",\"name\":\"项目名(如:派郑和下西洋商队)\",\"amount\":50000,\"reason\":\"依据/推演得出\",\"recurring\":true,\"stopAfterTurn\":null}],"+
        // 势力/党派/阶层/区划任意字段修改（补充既有 xxx_changes 的不足）
        "\"faction_updates\":[{\"name\":\"势力名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"party_updates\":[{\"name\":\"党派名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"class_updates\":[{\"name\":\"阶层名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"region_updates\":[{\"id或name\":\"行政区划\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        // 长期工程/商队/学堂·跨回合追踪
        "\"project_updates\":[{\"name\":\"工程名\",\"type\":\"工程/商队/学堂/道路/造船\",\"status\":\"planning/active/completed/abandoned\",\"cost\":10000,\"progress\":30,\"leader\":\"负责人\",\"region\":\"地点\",\"description\":\"概述\",\"endTurn\":50}],"+
        // 兜底·可用 dotted.path 改任意字段（除禁区：P.ai P.conf GM.saveName turn/year/month/day/sid _开头）
        "\"anyPathChanges\":[{\"path\":\"GM.任意嵌套路径\",\"op\":\"set/push/delta/merge/delete\",\"value\":\"值\",\"reason\":\"原因\"}]" +
        "}";
      // 注入待追踪诏令（让AI知道本回合有哪些诏令需要反馈）
      if (GM._edictTracker) {
        var _pendingEdicts = GM._edictTracker.filter(function(e) { return e.turn === GM.turn && e.status === 'pending'; });
        if (_pendingEdicts.length > 0) {
          tp1 += '\n\n【本回合诏令——每条必须在edict_feedback中逐条报告执行情况，填写assignee和feedback】\n';
          _pendingEdicts.forEach(function(e) {
            tp1 += '  【' + e.category + '】' + e.content;
            if (e._deliveryStatus === 'sending' && e._remoteTargets) {
              tp1 += ' ⚠信使在途→' + e._remoteTargets.join('、') + '（远方NPC尚未收到，status应为pending_delivery）';
            }
            tp1 += '\n';
          });
        }
        // 往期在途诏令——信使已送达的，提醒AI该NPC现在知道了
        var _priorRemote = (GM._edictTracker||[]).filter(function(e) {
          return e.turn < GM.turn && e._letterIds && e._letterIds.length > 0;
        });
        if (_priorRemote.length > 0) {
          var _deliveredThisTurn = [];
          var _stillTransit = [];
          _priorRemote.forEach(function(e) {
            (e._letterIds||[]).forEach(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return;
              if (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying') {
                _deliveredThisTurn.push({ edict: e, letter: lt });
              } else if (lt.status === 'traveling') {
                _stillTransit.push({ edict: e, letter: lt });
              } else if (lt.status === 'intercepted') {
                _stillTransit.push({ edict: e, letter: lt, lost: true });
              }
            });
          });
          if (_deliveredThisTurn.length > 0) {
            tp1 += '\n【往期诏令已送达——以下NPC已收到命令，应在本回合开始执行】\n';
            _deliveredThisTurn.forEach(function(d) {
              tp1 += '  ' + d.letter.to + '已收到：【' + d.edict.category + '】' + d.edict.content.slice(0,60) + '\n';
            });
          }
          if (_stillTransit.length > 0) {
            tp1 += '\n【往期诏令仍在途——以下NPC仍未收到命令】\n';
            _stillTransit.forEach(function(d) {
              tp1 += '  ' + d.letter.to + '：' + (d.lost ? '⚠信使失踪' : '信使在途') + '——' + d.edict.content.slice(0,40) + '\n';
            });
          }
        }
      }
      // 注入生命周期进行中的诏令（让AI记住上回合到哪阶段、反对派是谁、已积累效果）
      if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
        var _ongoing = GM._edictLifecycle.filter(function(e) { return !e.isCompleted; });
        if (_ongoing.length > 0) {
          tp1 += '\n\n【生命周期推演中的诏令——必须在 edict_lifecycle_update 中继续推进，不得重置回 drafting】\n';
          _ongoing.forEach(function(e) {
            var lastStage = e.stages && e.stages.length > 0 ? e.stages[e.stages.length - 1] : null;
            var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
            var phaseLabel = '';
            if (e.reformPhase && typeof REFORM_PHASES !== 'undefined' && REFORM_PHASES[e.reformPhase]) {
              phaseLabel = '·' + REFORM_PHASES[e.reformPhase].label;
            }
            var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : (lastStage ? lastStage.stage : '');
            var elapsed = GM.turn - (e.startTurn || GM.turn);
            tp1 += '  [id=' + e.edictId + '] ' + typeLabel + phaseLabel + ' 已推进' + elapsed + '回合，上回合→' + stageLabel;
            if (lastStage && lastStage.executor) tp1 += '（' + lastStage.executor + '督办）';
            if (e.oppositionLeaders && e.oppositionLeaders.length > 0) tp1 += '；反对派：' + e.oppositionLeaders.slice(0, 3).join('、');
            if (e.supporters && e.supporters.length > 0) tp1 += '；支持者：' + e.supporters.slice(0, 3).join('、');
            if (e.pilotRegion) tp1 += '；试点：' + e.pilotRegion;
            if (e.expansionRegions && e.expansionRegions.length > 0) tp1 += '；已推广：' + e.expansionRegions.slice(0, 3).join('、');
            // 累计效果（告诉AI已经花了多少国库、造成多大民心波动）
            var effectKeys = Object.keys(e.totalEffects || {});
            if (effectKeys.length > 0) {
              var effParts = effectKeys.slice(0, 4).map(function(k) { return k + (e.totalEffects[k] >= 0 ? '+' : '') + e.totalEffects[k]; });
              tp1 += '；累计效果：' + effParts.join('、');
            }
            if (lastStage && lastStage.resistanceDescription) tp1 += '；阻力：' + lastStage.resistanceDescription.slice(0, 50);
            tp1 += '\n';
          });
          tp1 += '  ※ 本回合继续推进（下一阶段或细化当前阶段），不得从草拟重起；改革类逐步推进 pilot→expand→national→backlash→outcome\n';
        }
      }
      // 注入起义前兆——最近 3 回合累积
      if (Array.isArray(GM._revoltPrecursors) && GM._revoltPrecursors.length > 0) {
        var _recentPrec = GM._revoltPrecursors.filter(function(pc){return GM.turn - pc.turn <= 5;});
        if (_recentPrec.length > 0) {
          tp1 += '\n\n【起义前兆——最近 5 回合累积】\n';
          _recentPrec.forEach(function(pc) {
            tp1 += '  T' + pc.turn + '·[' + (pc.region||'?') + '] ' + pc.class + '：' + pc.indicator + '(' + pc.severity + ')';
            if (pc.detail) tp1 += '——' + pc.detail.slice(0, 60);
            if (pc.couldLeadTo) tp1 += '；或演变为：' + pc.couldLeadTo;
            tp1 += '\n';
          });
          tp1 += '  ※ 前兆累积超 3 条且 severity=critical → 下回合应考虑 class_revolt 爆发\n';
        }
      }
      // 注入进行中起义——AI 必须继续推进每一起
      if (Array.isArray(GM._activeRevolts)) {
        var _ongoingRev = GM._activeRevolts.filter(function(r){return !r.outcome;});
        if (_ongoingRev.length > 0) {
          tp1 += '\n\n【进行中的起义——每起必须在 revolt_update 中推进；满足条件应 suppress/amnesty/transform】\n';
          _ongoingRev.forEach(function(r) {
            var elapsed = GM.turn - r.startTurn;
            tp1 += '  [id=' + r.id + '] ' + r.leaderName + '·' + r.class + '起义 已' + elapsed + '回合\n';
            tp1 += '    意识形态:' + r.ideology + ' 组织:' + r.organizationType + ' 阶段:' + r.phase + ' 规模:' + r.scale + '\n';
            if (r.historicalArchetype) tp1 += '    原型:' + r.historicalArchetype + '\n';
            if (r.slogan) tp1 += '    口号「' + r.slogan + '」\n';
            if (r.religiousSect) tp1 += '    教派:' + r.religiousSect + '\n';
            tp1 += '    兵' + r.militaryStrength + ' 粮' + r.supplyStatus + '/100 控制:[' + r.territoryControl.join('、') + ']\n';
            if (r.absorbedForces.length) tp1 += '    已收编:' + r.absorbedForces.slice(0,3).join('、') + '\n';
            if (r.defectedOfficials.length) tp1 += '    叛投官员:' + r.defectedOfficials.slice(0,3).join('、') + '\n';
            if (r.secondaryLeaders.length) tp1 += '    副将:' + r.secondaryLeaders.slice(0,3).join('、') + '\n';
            if (r.history.length > 0) {
              var _recH = r.history.slice(-3).map(function(h){return 'T'+h.turn+':'+(h.event||'').slice(0,30);}).join(' → ');
              tp1 += '    近事:' + _recH + '\n';
            }
            if (r._needTransform) tp1 += '    ⚠已达建政阈值，本回合必须 revolt_transform type=toFaction 升级为独立势力\n';
            if (r.phase === 'stalemate' && elapsed > 5) tp1 += '    ⚠相持过久，考虑招安(revolt_amnesty)或加强剿灭(revolt_suppress)\n';
            if (r.supplyStatus < 20) tp1 += '    ⚠粮草枯竭，可能自行 decline 或内讧\n';
          });
        }
      }
      // 注入问对承诺——NPC 应按应诺去做（或按性格推诿/拖延）
      if (GM._npcCommitments && Object.keys(GM._npcCommitments).length > 0) {
        var _pendingCmt = [];
        Object.keys(GM._npcCommitments).forEach(function(nm) {
          (GM._npcCommitments[nm]||[]).forEach(function(c) {
            if (c.status === 'pending' || c.status === 'executing' || c.status === 'delayed') _pendingCmt.push({ name: nm, c: c });
          });
        });
        if (_pendingCmt.length > 0) {
          tp1 += '\n\n【问对承诺——NPC 应按此行动（AI 推演时体现；可通过 npc_actions 或 commitment_update 报告进展）】\n';
          _pendingCmt.forEach(function(x) {
            var elapsed = GM.turn - x.c.assignedTurn;
            tp1 += '  [id=' + x.c.id + '] ' + x.name + ' 允' + elapsed + '回合前：' + x.c.task + '（意愿' + Math.round((x.c.willingness||0.5)*100) + '%，限' + x.c.deadline + '回合，状态' + x.c.status + ' 进展' + x.c.progress + '%）\n';
            if (x.c.npcPromise) tp1 += '    原诺："' + x.c.npcPromise + '"\n';
          });
          tp1 += '  ※ 忠诚/意愿高者执行快；忠诚低/推诿型者易拖延/忘记/阳奉阴违；可在 npc_actions 中体现行动，或在 p1 中新增 commitment_update:[{id,progress,status,feedback}]\n';
        }
      }
      // 注入御前密谋（activeSchemes 中 source=yuqian2 的）——提醒 AI 暗中推进
      if (Array.isArray(GM.activeSchemes)) {
        var _secretYuq = GM.activeSchemes.filter(function(s){ return s.source === 'yuqian2' && (!s.progress || s.progress !== '完成'); });
        if (_secretYuq.length > 0) {
          tp1 += '\n\n【御前密议遗策——暗中推进】\n';
          _secretYuq.forEach(function(s) {
            tp1 += '  T' + s.startTurn + '·' + (s.schemer||'皇帝') + '：' + (s.plan||'').slice(0, 80) + '（进度:' + (s.progress||'酝酿') + '，同谋:' + (s.allies||'') + '）\n';
          });
          tp1 += '  ※ 密谋推进应合乎逻辑——需行动者、需时机、需风险；可能暴露或成败\n';
        }
      }
      // 方案融入：推演前先①税收级联自然结算 ②区划→七变量聚合 ③注入深化上下文
      try {
        // ①地方按税制征收 → 分账 → 损耗 → 上解中央（所有税种钱粮布走三账）
        if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function') {
          try { CascadeTax.collect(); } catch(_ctE) { console.warn('[endTurn] CascadeTax.collect', _ctE); }
        }
        // ①.5 固定支出（俸禄/军饷/宫廷）—— 三账扣减
        if (typeof FixedExpense !== 'undefined' && typeof FixedExpense.collect === 'function') {
          try { FixedExpense.collect(); } catch(_feE) { console.warn('[endTurn] FixedExpense.collect', _feE); }
        }
        // ②区划 → 七变量聚合（户口/民心/腐败/财政 等）
        if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') {
          try { IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggE) { console.warn('[endTurn] aggregate pre-AI', _aggE); }
        }
        // v3：NpcMemorials 不再硬扫事件，只构造朝堂场景上下文
        if (typeof buildNpcSceneContext === 'function') {
          var _sceneCtx = buildNpcSceneContext();
          if (_sceneCtx) tp1 += '\n\n' + _sceneCtx;
        }
        // 长期事势追踪·注入（含 hidden 条目，AI 全见，玩家不见 hidden）
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtx = ChronicleTracker.getAIContextString();
          if (_chronCtx) tp1 += '\n\n' + _chronCtx;
        }
        if (typeof buildFullAIContext === 'function') {
          var _fCtx = buildFullAIContext();
          // ── 七变量 + 深化字段（详细）──
          if (_fCtx.variables) {
            tp1 += '\n\n【七大变量·推演必读（深化数据）】';
            var _v = _fCtx.variables;
            if (_v.huangwei)  tp1 += '\n  皇威：真 ' + Math.round((_v.huangwei.index||0)) + ' / 视 ' + Math.round(_v.huangwei.perceivedIndex||_v.huangwei.index||0) + ' · ' + (_v.huangwei.phase||'') + (_v.huangwei.tyrantSyndrome?' · 暴君症候活':'') + (_v.huangwei.lostCrisis?' · 失威危机活':'');
            if (_v.huangquan) tp1 += '\n  皇权：' + Math.round((_v.huangquan.index||0)) + ' · ' + (_v.huangquan.phase||'') + (_v.huangquan.powerMinister?' · 权臣 '+ _v.huangquan.powerMinister.name:'');
            if (_v.minxin)    tp1 += '\n  民心：真 ' + Math.round((_v.minxin.index||0)) + ' / 视 ' + Math.round(_v.minxin.perceivedIndex||_v.minxin.index||0) + ' · ' + (_v.minxin.phase||'');
            if (_v.corruption) tp1 += '\n  吏治：真 ' + Math.round((_v.corruption.index||0)) + ' / 视 ' + Math.round(_v.corruption.perceivedIndex||_v.corruption.index||0);
            if (_v.guoku)     tp1 += '\n  帑廪：钱 ' + Math.round((_v.guoku.money||0)/10000) + ' 万两 · 粮 ' + Math.round((_v.guoku.grain||0)/10000) + ' 万石 · 布 ' + Math.round((_v.guoku.cloth||0)/10000) + ' 万匹 · 月入 ' + Math.round((GM.guoku && GM.guoku.monthlyIncome||0)/10000) + ' 万';
            if (_v.neitang)   tp1 += '\n  内帑：钱 ' + Math.round((_v.neitang.money||0)/10000) + ' 万两 · 粮 ' + Math.round((GM.neitang && GM.neitang.grain||0)/10000) + ' 万石 · 布 ' + Math.round((GM.neitang && GM.neitang.cloth||0)/10000) + ' 万匹 · 皇庄 ' + Math.round(_v.neitang.huangzhuangAcres||0) + ' 亩';
            // 本回合税收级联摘要（帮助 AI 了解自然结算已完成什么）
            if (GM._lastCascadeSummary) {
              var cs = GM._lastCascadeSummary;
              tp1 += '\n  本回合自然税收已结算：上解中央 钱 ' + Math.round(cs.central.money/10000) + '万/粮 ' + Math.round(cs.central.grain/10000) + '万/布 ' + Math.round(cs.central.cloth/10000) + '万';
              tp1 += '；地方留存 钱 ' + Math.round(cs.localRetain.money/10000) + '万/粮 ' + Math.round(cs.localRetain.grain/10000) + '万';
              tp1 += '；被贪 钱 ' + Math.round(cs.skimmed.money/10000) + '万/粮 ' + Math.round(cs.skimmed.grain/10000) + '万；路途损耗 钱 ' + Math.round(cs.lostTransit.money/10000) + '万';
            }
            if (_v.population && _v.population.national) tp1 += '\n  户口：户 ' + Math.round((_v.population.national.households||0)/10000) + ' 万 · 口 ' + Math.round((_v.population.national.mouths||0)/10000) + ' 万 · 丁 ' + Math.round((_v.population.national.ding||0)/10000) + ' 万 · 逃户 ' + (_v.population.fugitives||0) + ' · 隐户 ' + (_v.population.hiddenCount||0);
          }
          // ── 民心分阶层/分区域 ──
          try {
            if (GM.minxin && GM.minxin.byClass) {
              var classKeys = Object.keys(GM.minxin.byClass);
              if (classKeys.length > 0) {
                var cls = classKeys.slice(0,9).map(function(k){
                  var v = GM.minxin.byClass[k];
                  var idx = (typeof v === 'object' && v !== null) ? (v.index || v.true || 60) : v;
                  return k + Math.round(idx||60);
                }).join('·');
                tp1 += '\n  民心·分阶层：' + cls;
              }
            }
          } catch(_e){}
          // ── 腐败 6 部门 ──
          try {
            if (GM.corruption && GM.corruption.byDept) {
              var dp = Object.keys(GM.corruption.byDept).map(function(d){
                var v = GM.corruption.byDept[d];
                if (typeof v === 'object') v = v.true || v.overall;
                return d + Math.round(v||0);
              }).join('·');
              if (dp) tp1 += '\n  吏治·6部门：' + dp;
            }
          } catch(_e){}
          // ── 14源累积（民心驱动因素）──
          try {
            if (GM.minxin && GM.minxin.sources) {
              var src = Object.keys(GM.minxin.sources).filter(function(k){return Math.abs(GM.minxin.sources[k])>0.5;})
                .slice(0,8).map(function(k){var v=GM.minxin.sources[k];return k+(v>=0?'+':'')+v.toFixed(1);}).join(' ');
              if (src) tp1 += '\n  民心·主要驱动：' + src;
            }
          } catch(_e){}

          // ── 行政区划深化（每顶级）──
          try {
            if (GM.adminHierarchy) {
              var divTxt = [];
              Object.keys(GM.adminHierarchy).slice(0,3).forEach(function(fk){
                var divs = GM.adminHierarchy[fk] && GM.adminHierarchy[fk].divisions || [];
                divs.slice(0,8).forEach(function(d){
                  var line = '  ' + (d.name||d.id) + '(' + (d.level||'') + ')';
                  if (d.governor) line += ' 官:' + d.governor;
                  if (d.population && typeof d.population === 'object') {
                    if (d.population.mouths) line += ' 口' + Math.round(d.population.mouths/10000) + '万';
                    if (d.population.fugitives) line += ' 逃' + d.population.fugitives;
                  }
                  if (typeof d.minxin === 'number') line += ' 民心' + Math.round(d.minxin);
                  if (typeof d.corruption === 'number') line += ' 腐' + Math.round(d.corruption);
                  if (d.fiscal && d.fiscal.actualRevenue) line += ' 赋' + Math.round(d.fiscal.actualRevenue/10000) + '万';
                  if (d.publicTreasury && d.publicTreasury.money && d.publicTreasury.money.deficit>0) line += ' 亏' + Math.round(d.publicTreasury.money.deficit/10000) + '万';
                  if (d.regionType && d.regionType !== 'normal') line += ' [' + d.regionType + ']';
                  if (d.environment && d.environment.currentLoad > 0.9) line += ' 过载';
                  divTxt.push(line);
                });
              });
              if (divTxt.length) tp1 += '\n\n【行政区划·深化】（你可改 adminHierarchy.{fac}.divisions.{id或name}.{field}）\n' + divTxt.join('\n');
            }
          } catch(_e){}

          // ── 输出格式 ──
          tp1 += '\n\n【推演产出要求】';
          tp1 += '\n推演产生的任何变化请通过以下 JSON 字段输出：';
          tp1 += '\n  · changes: [{path, delta|value, reason}]  （path 支持 by-name：如 "chars.张三.loyalty" / "adminHierarchy.player.divisions.冀州.population.mouths"）';
          tp1 += '\n  · appointments: [{action:"appoint|dismiss|transfer", charName, position, binding}]';
          tp1 += '\n  · institutions: [{action:"create|abolish", type, id, name, annualBudget}]';
          tp1 += '\n  · regions: [{action:"reclassify", id, newType, reason}]';
          tp1 += '\n  · events: [{category, text, credibility}]';
          tp1 += '\n  · npc_interactions: [{actor, target, type:"impeach|slander|recommend|frame_up|betray|private_visit|correspond_secret|mediate|expose_secret|duel_poetry|master_disciple|reconcile|guarantee|..", description, involvedOthers?, publicKnown?}] —— 系统自动路由到 奏疏/问对/鸿雁/起居注/风闻，且按 type 自动涨/跌 actor 的 fame(名望 -100..+100)与 virtueMerit(贤能 累积)——譬如 recommend/mediate 提贤能，frame_up/betray/slander 损名望，expose_secret/impeach 对被揭者 fame 大跌。请按人物性格/立场/与目标关系选择合适的 type，避免机械化';
          tp1 += '\n  · localActions: [{region, type:"disaster_relief|public_works_water|public_works_road|education|granary_stockpile|military_prep|charity_local|illicit", amount, reason, proposer}] —— 地方官自主治理（按 region.fiscal 情况决定，amount < 3% 地方留存为常规，10-30% 为应急。illicit 为贪墨挪用，进入主官私产）';
          tp1 += '\n';
          tp1 += '\n【重要原则】';
          tp1 += '\n · 必读以上七变量+深化字段，推演要体现数据（而非空洞叙事）';
          tp1 += '\n · 不受历史约束——剧本仅作参考，只要合理即可（架空策略、反史实均允许）';
          tp1 += '\n · NPC 行为不要按职位套模板（御史必谏/将军必请战是工具人思维）';
          tp1 += '\n · 突发事件（灾/疫/异象/权臣/民变）通过 npc_interactions 让大臣/官员上奏或求见告知玩家，不要另起弹窗';
        }
      } catch(_fctxErr) { console.warn('[endturn] fullCtx inject:', _fctxErr); }

      // 1.2+1.8: 使用ModelAdapter温度 + OpenAI原生JSON模式
      var _sc1Body = {model:P.ai.model||"gpt-4o",messages:[{role:"system",content:sysP},{role:"user",content:tp1}],temperature:_modelTemp,max_tokens:_tok(16000)};
      if (_modelFamily === 'openai') _sc1Body.response_format = { type: 'json_object' }; // 1.8: 原生JSON模式
      var resp1=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},body:JSON.stringify(_sc1Body)});
      if(!resp1.ok) throw new Error('HTTP ' + resp1.status);
      var data1=await resp1.json();
      _checkTruncated(data1, '结构化数据');
      if(data1.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data1.usage);
      var c1="";if(data1.choices&&data1.choices[0]&&data1.choices[0].message)c1=data1.choices[0].message.content;
      p1=null; // 赋值到外层声明的p1
      p1=extractJSON(c1);
      GM._turnAiResults.subcall1_raw = c1;
      GM._turnAiResults.subcall1 = p1;

      // ═══ Sub-call 1b · 文事鸿雁人际专项（独立预算 8k，避免文事/鸿雁/互动被 sc1 庞大 schema 挤出）═══
      try {
        var _sc1bStart = Date.now();
        showLoading('\u6587\u4E8B\u9E3F\u96C1\u4EBA\u9645\u63A8\u6F14', 58);

        var _charsBriefB = '';
        try {
          var _liveCharsB = (GM.chars||[]).filter(function(c){return c && c.alive!==false;});
          _liveCharsB.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
          var _briefListB = _liveCharsB.slice(0,24).map(function(c){
            var _p = c.name;
            if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
            if (c.location) _p += '@' + c.location;
            if (c.faction) _p += '[' + c.faction + ']';
            _p += ' \u5FE0' + (c.loyalty||50) + '\u00B7\u667A' + (c.intelligence||50) + '\u00B7\u5B66' + (c.scholarship||c.intelligence||50);
            if (Array.isArray(c.traits) && c.traits.length) _p += ' \u7279{' + c.traits.slice(0,3).join(',') + '}';
            return _p;
          });
          _charsBriefB = _briefListB.join('\n');
        } catch(_cbE){}

        var _capB = (GM._capital) || (P.playerInfo && P.playerInfo.capital) || '\u4EAC\u57CE';
        var _pNameB = (P.playerInfo && P.playerInfo.characterName) || '';
        var _recentSZJ = (p1 && p1.shizhengji) ? String(p1.shizhengji).slice(0,1500) : '';

        var tp1b = '\u3010\u6587\u4E8B\u00B7\u9E3F\u96C1\u00B7\u4EBA\u9645\u4E92\u52A8\u00B7\u4E13\u9879\u63A8\u6F14\u3011\n';
        tp1b += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + ' \u00B7 \u9996\u90FD\uFF1A' + _capB + '\n';
        if (_pNameB) tp1b += '\u73A9\u5BB6\u89D2\u8272\uFF1A' + _pNameB + '\uFF08\u4E0D\u5F97\u4F5C\u4E3A npc_interactions.actor\uFF0C\u4E0D\u5F97 autonomous \u4F5C cultural_works\uFF09\n';
        if (_recentSZJ) tp1b += '\n\u3010\u672C\u56DE\u5408\u5DF2\u8BB0\u65F6\u653F\u3011\n' + _recentSZJ + '\n';
        if (_charsBriefB) tp1b += '\n\u3010\u4E3B\u8981\u4EBA\u7269\uFF08\u542B\u4F4D\u7F6E/\u5B98\u804C/\u6D3E\u7CFB/\u7279\u8D28\uFF09\u3011\n' + _charsBriefB + '\n';

        // 已有内容提示（避免重复）
        var _existCW = (p1 && Array.isArray(p1.cultural_works)) ? p1.cultural_works.length : 0;
        var _existNL = (p1 && Array.isArray(p1.npc_letters)) ? p1.npc_letters.length : 0;
        var _existNC = (p1 && Array.isArray(p1.npc_correspondence)) ? p1.npc_correspondence.length : 0;
        var _existNI = (p1 && Array.isArray(p1.npc_interactions)) ? p1.npc_interactions.length : 0;
        if (_existCW || _existNL || _existNC || _existNI) {
          tp1b += '\n\u3010\u4E0A\u4E00\u5B50\u8C03\u7528\u5DF2\u751F\u6210\u3011\u6587\u4E8B ' + _existCW + ' \u7BC7\uFF0C\u9E3F\u96C1 ' + _existNL + ' \u5C01\uFF0C\u5BC6\u4FE1 ' + _existNC + ' \u6761\uFF0C\u4E92\u52A8 ' + _existNI + ' \u6B21\u3002\u8BF7\u8865\u5145\u751F\u6210\u66F4\u591A\u4E0D\u540C\u5185\u5BB9\uFF0C\u4E0D\u8981\u91CD\u590D\u3002\n';
        }

        tp1b += '\n\u3010\u4EFB\u52A1\u3011\u751F\u6210\u4EE5\u4E0B\u56DB\u7C7B\u5185\u5BB9\uFF0C\u8FD4\u56DE\u4E25\u683C JSON\uFF08\u4EC5\u5305\u542B\u8FD9\u56DB\u4E2A\u5B57\u6BB5\uFF09\uFF1A\n\n';

        tp1b += '\u25C6 cultural_works\uFF08\u6587\u82D1\u4F5C\u54C1\u00B7\u5E38\u6001 3-6 \u7BC7\uFF0C\u91CD\u5927\u4E8B\u4EF6\u65F6 5-10 \u7BC7\uFF09\u2014\u2014\n';
        tp1b += '  \u6309\u89E6\u53D1\u6E90\uFF08A\u79D1\u4E3E\u5BA6\u9014/B\u9006\u5883\u8D2C\u8C2A/C\u793E\u4EA4\u916C\u9162/D\u4EFB\u4E0A\u65BD\u653F/E\u6E38\u5386\u5C71\u6C34/F\u5BB6\u4E8B\u79C1\u60C5/G\u65F6\u5C40\u5929\u4E0B/H\u60C5\u611F\u5FC3\u5883\uFF09\u9009\u6709\u8D44\u683C\u7684 NPC \u751F\u6210\u5176\u4F5C\u54C1\u3002\n';
        tp1b += '  \u2605 content \u5FC5\u987B\u5168\u6587\u771F\u5B9E\u751F\u6210\uFF1A\u7EDD\u53E5 20/\u5F8B\u8BD7 40\u621656/\u8BCD\u6309\u8BCD\u724C\u5B57\u6570/\u8D4B 300-800/\u6587 200-600\uFF1B\u53E4\u6587\u5FCC\u73B0\u4EE3\u8BCD\u6C47\uFF1B\u683C\u5F8B\u8BD7\u5C3D\u529B\u8BB2\u5E73\u4EC4\u5BF9\u4ED7\u3002\u4E0D\u5F97\u5199\u5360\u4F4D\u7B26\u5982"(\u6B64\u5904\u8BD7)"\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{author, turn:' + (GM.turn||1) + ', date, location, triggerCategory, trigger, motivation, lifeStage, genre, subtype, title, content, mood, theme, elegance, dedicatedTo[], inspiredBy, commissionedBy, praiseTarget, satireTarget, quality, politicalImplication, politicalRisk, narrativeContext, preservationPotential}\n';
        tp1b += '  motivation\uFF1Aspontaneous\u81EA\u53D1/commissioned\u53D7\u547D/flattery\u5E72\u8C12/response\u916C\u7B54/mourning\u54C0\u60BC/critique\u8BBD\u8C15/celebration\u9882\u626C/farewell\u9001\u522B/memorial\u7EAA\u5FF5/ghostwrite\u4EE3\u7B14/duty\u5E94\u5236/self_express\u81EA\u62D2\n';
        tp1b += '  genre\uFF1Ashi\u8BD7/ci\u8BCD/fu\u8D4B/qu\u66F2/ge\u6B4C\u884C/wen\u6563\u6587/apply\u5E94\u7528\u6587/ji\u8BB0\u53D9\u6587/ritual\u796D\u6587\u7891\u94ED/paratext\u5E8F\u8DCB\n';
        tp1b += '  politicalRisk\uFF1A\u8BBD\u8C15/critique \u7C7B\u9AD8\uFF0C\u5E73\u548C\u7C7B\u4F4E\u3002preservationPotential \u8D28\u91CF\u8D8A\u9AD8/\u9898\u6750\u8D8A\u91CD\u8D8A\u5BB9\u6613\u4F20\u4E16\u3002\n';
        tp1b += '  \u89E6\u53D1\u6761\u4EF6\uFF1A\u667A\u529B\u226570 + scholar/theologian/eccentric/pensive/curious \u7279\u8D28 \u2192 \u9AD8\u6743\u91CD\uFF1B\u9047\u8D2C/\u4E01\u5FE7/\u81F4\u4ED5/\u6218\u80DC/\u593A\u804C/\u4E54\u8FC1/\u5BFF\u8FB0 \u2192 \u5F3A\u89E6\u53D1\uFF1Bstress>60 \u501F\u6587\u53D1\u6CC4\u3002lazy/craven \u964D\u6743\u3002\n\n';

        tp1b += '\u25C6 npc_letters\uFF08\u9E3F\u96C1\u4F20\u4E66\u00B7\u6BCF\u56DE\u5408 2-5 \u5C01\uFF09\u2014\u2014\n';
        tp1b += '  \u4E0D\u5728 ' + _capB + ' \u7684 NPC \u9047\u91CD\u5927\u4E8B\u4EF6\u4E3B\u52A8\u5199\u4FE1\u7ED9\u7687\u5E1D\u3002from \u5FC5\u987B\u662F\u4E0D\u5728\u9996\u90FD\u7684 NPC\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{from, type:"report\u5954\u544A/plea\u6C42\u63F4/warning\u8B66\u62A5/personal\u79C1\u60C5/intelligence\u60C5\u62A5", urgency:"normal/urgent/extreme", content(100-200\u5B57\u53E4\u5178\u4E2D\u6587), suggestion(1-2\u53E5\u53EF\u7701), replyExpected:true}\n';
        tp1b += '  \u53C2\u8003\u4FE1\u4EF6\u6A21\u5F0F\uFF1A\u8FB9\u5C06\u544A\u6025\u00B7\u5730\u65B9\u5B98\u8BF7\u547D\u00B7\u6D41\u5B98\u8FF0\u60C5\u00B7\u51FA\u4F7F\u56DE\u62A5\u00B7\u79BB\u4EAC\u65E7\u81E3\u6000\u60F3\u00B7\u5BC6\u63A2\u5BC6\u62A5\u3002\n\n';

        tp1b += '\u25C6 npc_correspondence\uFF08NPC \u4E4B\u95F4\u5BC6\u4FE1\u00B72-5 \u6761\uFF09\u2014\u2014\n';
        tp1b += '  NPC \u95F4\u79D8\u5BC6\u4E66\u4FE1/\u7ED3\u76DF\u7EA6\u5B9A/\u60C5\u62A5\u4EA4\u6362/\u5BC6\u8C0B\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{from, to, content(50-150\u5B57), summary(\u4E00\u53E5\u8BDD), implication(\u5BF9\u5C40\u52BF\u6F5C\u5728\u5F71\u54CD), type:"secret/alliance/conspiracy/routine"}\n\n';

        tp1b += '\u25C6 npc_interactions\uFF08NPC \u4E92\u52A8\u00B75-12 \u6761\uFF09\u2014\u2014\n';
        tp1b += '  \u7CFB\u7EDF\u81EA\u52A8\u8DEF\u7531\uFF1Aimpeach/slander/expose_secret \u2192 \u594F\u758F\u5F39\u7AE0\uFF1Brecommend/guarantee/petition_jointly \u2192 \u8350\u8868\uFF1B\n';
        tp1b += '  private_visit/invite_banquet/duel_poetry \u2192 \u95EE\u5BF9\u6C42\u89C1\uFF1Bgift_present \u2192 \u9E3F\u96C1\u9644\u793C\uFF1Bcorrespond_secret/share_intelligence \u2192 \u9E3F\u96C1\u5BC6\u4FE1\uFF1B\n';
        tp1b += '  frame_up/betray/mediate/reconcile \u2192 \u98CE\u95FB\uFF1Bmaster_disciple \u2192 \u8D77\u5C45\u6CE8\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{actor, target, type, description(30-60\u5B57), involvedOthers?, publicKnown?(true/false)}\n';
        tp1b += '  \u6309\u4EBA\u7269\u6027\u683C/\u6D3E\u7CFB/\u5173\u7CFB\u9009\u5408\u9002\u7684 type\uFF0C\u907F\u514D"\u5FA1\u53F2\u5FC5\u8C0F/\u5C06\u519B\u5FC5\u8BF7\u6218"\u5DE5\u5177\u4EBA\u6A21\u677F\u3002\n';
        tp1b += '  \u7279\u522B\u6CE8\u610F\uFF1A\u5305\u542B\u5F39\u52BE/\u8350\u4E3E/\u5BC6\u5BFF/\u8FAD\u7E41/\u5F92\u5F92\u4F20\u9053\u7B49\u53E4\u5178\u653F\u6CBB\u884C\u4E3A\uFF0C\u4E00\u90E8\u5206 publicKnown=true \u8FDB\u98CE\u95FB\uFF0C\u4E00\u90E8\u5206 false \u79C1\u4E0B\u3002\n\n';

        tp1b += '\u3010\u786C\u89C4\u5219\u3011\n';
        tp1b += '  \u00B7 \u53EA\u8FD4\u56DE\u4E0A\u8FF0\u56DB\u4E2A\u5B57\u6BB5\u7684 JSON\uFF08\u65E0\u5176\u4ED6\u5B57\u6BB5\uFF09\n';
        tp1b += '  \u00B7 \u4EBA\u540D\u5FC5\u987B\u662F\u73B0\u6709\u89D2\u8272\uFF08\u5DF2\u5217\u5728\u4E0A\u65B9\u4EBA\u7269\u8868\u4E2D\uFF09\n';
        tp1b += '  \u00B7 \u5185\u5BB9\u8981\u4E30\u5BCC\u3001\u6709\u753B\u9762\u611F\u3001\u4E0D\u673A\u68B0\u5316\n';
        tp1b += '  \u00B7 \u73A9\u5BB6 ' + _pNameB + ' \u4E0D\u5F97\u4F5C npc_interactions.actor\uFF1B\u4E0D\u5F97 autonomous \u4F5C cultural_works\n';
        tp1b += '  \u00B7 \u9AD8\u8D28\u91CF\uFF1A\u8BD7\u8981\u6709\u5883\uFF0C\u6587\u8981\u6709\u56E0\uFF0C\u4FE1\u8981\u6709\u9690\uFF0C\u4E92\u52A8\u8981\u6709\u65B9\n';
        tp1b += '\n\u8FD4\u56DE\u683C\u5F0F\uFF1A\n';
        tp1b += '{\n  "cultural_works":[{...}],\n  "npc_letters":[{...}],\n  "npc_correspondence":[{...}],\n  "npc_interactions":[{...}]\n}';

        var _sc1bBody = {model:P.ai.model||'gpt-4o', messages:[{role:'system',content:sysP},{role:'user',content:tp1b}], temperature:_modelTemp, max_tokens:_tok(8000)};
        if (_modelFamily === 'openai') _sc1bBody.response_format = { type:'json_object' };

        var resp1b = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body:JSON.stringify(_sc1bBody)});
        if (resp1b.ok) {
          var data1b = await resp1b.json();
          _checkTruncated(data1b, '\u6587\u4E8B\u9E3F\u96C1\u4EBA\u9645');
          if (data1b.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data1b.usage);
          var c1b = (data1b.choices && data1b.choices[0] && data1b.choices[0].message) ? data1b.choices[0].message.content : '';
          var p1b = extractJSON(c1b);
          GM._turnAiResults.subcall1b_raw = c1b;
          GM._turnAiResults.subcall1b = p1b;

          if (p1b && p1) {
            if (Array.isArray(p1b.cultural_works)) p1.cultural_works = (Array.isArray(p1.cultural_works) ? p1.cultural_works : []).concat(p1b.cultural_works);
            if (Array.isArray(p1b.npc_letters)) p1.npc_letters = (Array.isArray(p1.npc_letters) ? p1.npc_letters : []).concat(p1b.npc_letters);
            if (Array.isArray(p1b.npc_correspondence)) p1.npc_correspondence = (Array.isArray(p1.npc_correspondence) ? p1.npc_correspondence : []).concat(p1b.npc_correspondence);
            if (Array.isArray(p1b.npc_interactions)) p1.npc_interactions = (Array.isArray(p1.npc_interactions) ? p1.npc_interactions : []).concat(p1b.npc_interactions);
            _dbg('[sc1b] \u5408\u5E76: \u6587\u4E8B+' + (p1b.cultural_works||[]).length + ' \u9E3F\u96C1+' + (p1b.npc_letters||[]).length + ' \u5BC6\u4FE1+' + (p1b.npc_correspondence||[]).length + ' \u4E92\u52A8+' + (p1b.npc_interactions||[]).length);
          }
          GM._subcallTimings.sc1b = Date.now() - _sc1bStart;
        } else {
          console.warn('[sc1b] HTTP', resp1b.status);
        }
      } catch(_sc1bErr) {
        console.warn('[sc1b] \u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u4E3B\u6D41\u7A0B\uFF09:', _sc1bErr.message || _sc1bErr);
      }

      // ═══ Sub-call 1c · 势力 & NPC 自主博弈专项（独立预算 8k，丰富势力外交+NPC 阴谋）═══
      try {
        var _sc1cStart = Date.now();
        showLoading('\u52BF\u529B\u5916\u4EA4\u00B7NPC\u9634\u8C0B\u63A8\u6F14', 59);

        var _facsBriefC = '';
        try {
          var _liveFacsC = (GM.facs||[]).filter(function(f){return f && !f.isPlayer;});
          _facsBriefC = _liveFacsC.slice(0,14).map(function(f){
            var _p = f.name + ' \u5B9E' + (f.strength||50);
            if (f.leader) _p += ' \u9996:' + f.leader;
            if (f.attitude) _p += ' \u6001:' + f.attitude;
            if (f.goal) _p += ' \u76EE:' + String(f.goal).slice(0,30);
            if (f.culture) _p += ' [' + f.culture + ']';
            if (f.mainstream) _p += '\u00B7' + f.mainstream;
            if (f.type) _p += '\u00B7' + f.type;
            return _p;
          }).join('\n');
        } catch(_e){}

        var _relsBriefC = '';
        try {
          if (Array.isArray(GM.factionRelations)) {
            _relsBriefC = GM.factionRelations.slice(0,18).map(function(r){
              var s = r.from + '\u2192' + r.to + ' ' + (r.type||'?');
              if (r.value !== undefined) s += '(' + r.value + ')';
              if (r.trust !== undefined) s += ' \u4FE1' + r.trust;
              if (r.hostility !== undefined) s += ' \u654C' + r.hostility;
              if (r.economicTies !== undefined) s += ' \u7ECF' + r.economicTies;
              if (r.kinshipTies !== undefined) s += ' \u4EB2' + r.kinshipTies;
              return s;
            }).join('\n');
          }
        } catch(_e){}

        var _npcsBriefC = '';
        try {
          var _liveNpcsC = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;});
          _liveNpcsC.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
          _npcsBriefC = _liveNpcsC.slice(0,20).map(function(c){
            var _p = c.name;
            if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
            if (c.faction) _p += '[' + c.faction + ']';
            if (c.party) _p += '{' + c.party + '}';
            _p += ' \u5FE0' + (c.loyalty||50) + '\u00B7\u5FD7' + (c.ambition||50) + '\u00B7\u5EC9' + (c.integrity||50);
            if (Array.isArray(c.traits) && c.traits.length) _p += ' \u7279{' + c.traits.slice(0,2).join(',') + '}';
            return _p;
          }).join('\n');
        } catch(_e){}

        var _undercurrentsC = '';
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _undercurrentsC = GM._factionUndercurrents.slice(0,8).map(function(u){
            return (u.faction||'?') + ': ' + (u.situation||'') + (u.nextMove?' (\u53EF\u80FD:'+u.nextMove+')':'');
          }).join('\n');
        }

        var _activeSchemesC = '';
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _activeSchemesC = GM.activeSchemes.slice(-8).map(function(s){
            return (s.schemer||'?') + ' \u9488\u5BF9 ' + (s.target||'?') + ': ' + String(s.plan||'').slice(0,40) + ' [' + (s.progress||'') + ']';
          }).join('\n');
        }

        var _recentSZJC = (p1 && p1.shizhengji) ? String(p1.shizhengji).slice(0,1200) : '';
        var _pNameC = (P.playerInfo && P.playerInfo.characterName) || '';

        var tp1c = '\u3010\u52BF\u529B\u5916\u4EA4\u00B7NPC\u9634\u8C0B\u00B7\u4E13\u9879\u63A8\u6F14\u3011\n';
        tp1c += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '\n';
        if (_recentSZJC) tp1c += '\n\u3010\u672C\u56DE\u5408\u65F6\u653F\u3011\n' + _recentSZJC + '\n';
        if (_facsBriefC) tp1c += '\n\u3010\u975E\u73A9\u5BB6\u52BF\u529B\u3011\n' + _facsBriefC + '\n';
        if (_relsBriefC) tp1c += '\n\u3010\u52BF\u529B\u5173\u7CFB\u5FEB\u7167\u3011\n' + _relsBriefC + '\n';
        if (_undercurrentsC) tp1c += '\n\u3010\u4E0A\u56DE\u5408\u52BF\u529B\u6697\u6D41\uFF08\u5E94\u6709\u540E\u7EED\uFF09\u3011\n' + _undercurrentsC + '\n';
        if (_activeSchemesC) tp1c += '\n\u3010\u8FDB\u884C\u4E2D\u9634\u8C0B\uFF08\u901A\u8FC7 scheme_actions \u63A8\u8FDB\uFF0C\u4E0D\u8981\u5728 npc_schemes \u91CD\u590D\uFF09\u3011\n' + _activeSchemesC + '\n';
        // 长期事势·含 hidden 条目（AI 全见，用于构思本回合该推进/完成哪些）
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtxC = ChronicleTracker.getAIContextString();
          if (_chronCtxC) tp1c += '\n' + _chronCtxC + '\n';
        }
        if (_npcsBriefC) tp1c += '\n\u3010\u4E3B\u8981 NPC\uFF08\u542B\u5B98\u804C/\u6D3E\u7CFB/\u5FE0\u5FD7\u5EC9/\u7279\u8D28\uFF09\u3011\n' + _npcsBriefC + '\n';

        tp1c += '\n\u3010\u4EFB\u52A1\u3011\u751F\u6210\u4EE5\u4E0B\u4E03\u7C7B\u5185\u5BB9\uFF0C\u8FD4\u56DE\u4E25\u683C JSON\uFF08\u4EC5\u5305\u542B\u8FD9\u4E9B\u5B57\u6BB5\uFF09\uFF1A\n\n';

        tp1c += '\u25C6 faction_interactions_advanced\uFF08\u52BF\u529B\u6DF1\u5EA6\u4E92\u52A8\u00B7\u5E38\u6001 3-6 \u6761\uFF0C\u5916\u4EA4\u6D3B\u8DC3\u671F 6-10 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  23 \u79CD type\uFF1A\n';
        tp1c += '    \u6218\u4E89\uFF1Adeclare_war\u5BA3\u6218/border_clash\u8FB9\u5883\u51B2\u7A81/sue_for_peace\u8BF7\u548C/annex_vassal\u5E76\u541E\n';
        tp1c += '    \u548C\u5E73\uFF1Asend_envoy\u9063\u4F7F/form_confederation\u7ED3\u76DF/break_confederation\u6BC1\u7EA6/recognize_independence\u627F\u8BA4\u72EC\u7ACB\n';
        tp1c += '    \u85E9\u5C5E\uFF1Ademand_tribute\u7D22\u8D21/pay_tribute\u732E\u8D21/royal_marriage\u548C\u4EB2/send_hostage\u8D28\u5B50/gift_treasure\u8D60\u5B9D\n';
        tp1c += '    \u7ECF\u6D4E\uFF1Aopen_market\u4E92\u5E02/trade_embargo\u8D38\u6613\u7981\u8FD0/pay_indemnity\u8D54\u6B3E\n';
        tp1c += '    \u6587\u5316\uFF1Acultural_exchange\u6587\u5316\u4EA4\u6D41/religious_mission\u5B97\u6559\u4F7F\u8282\n';
        tp1c += '    \u519B\u4E8B\uFF1Amilitary_aid\u519B\u63F4/proxy_war\u4EE3\u7406\u6218\u4E89/incite_rebellion\u7172\u52A8\u53DB\u4E71\n';
        tp1c += '    \u60C5\u62A5\uFF1Aspy_infiltration\u7EC6\u4F5C/assassin_dispatch\u523A\u5BA2\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{from, to, type, viaProxy?(proxy_war\u65F6), terms, tributeItems?(tribute\u65F6), marriageDetails?(marriage\u65F6\u2014\u2014"XX\u516C\u4E3B\u5AC1YY\u738B"), hostageDetails?(hostage\u65F6\u2014\u2014"XX\u5B50\u5165\u8D28"), treatyType?(\u76DF\u597D/\u79F0\u81E3/\u505C\u6218/\u4E92\u4E0D\u4FB5\u72AF), description, durationTurns, reason}\n';
        tp1c += '  \u5386\u53F2\u53C2\u8003\uFF1A\u662D\u541B\u51FA\u585E/\u6587\u6210\u516C\u4E3B\u5165\u85CF(kinshipTies+/hostility-)\uFF1B\u6E05\u521D\u8D28\u5B50(trust+)\uFF1B\u695A\u6C49\u7528\u8BF8\u4FAF\u4EE3\u7406\u6218\u4E89(trust-)\uFF1B\u5BCB\u6E0A\u5C81\u5E01/\u660E\u518C\u5C01\u671D\u9C9C\u7434\u7409\u7403\uFF1B\u5B8B\u8FBD\u6982\u573A/\u660E\u8499\u9A6C\u5E02(economicTies+)\n';
        tp1c += '  \u4E00\u81F4\u6027\u5F0F\uFF1A\u80CC\u76DF/\u6BC1\u7EA6/\u523A\u6740\u5F71\u54CD\u6DF1\u8FDC\u4E0D\u53EF\u8F7B\u6613"\u548C\u597D"\uFF1B\u548C\u4EB2/\u8D28\u5B50\u8981\u5177\u4F53\u4EBA\u540D\n\n';

        tp1c += '\u25C6 faction_events\uFF08\u52BF\u529B\u95F4/\u5185\u90E8\u4E8B\u4EF6\u00B7\u5E38\u6001 3-6 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{actor, target?(\u5185\u653F\u4E8B\u4EF6\u53EF\u7701), action(30\u5B57), actionType:"\u5916\u4EA4/\u5185\u653F/\u519B\u4E8B/\u7ECF\u6D4E", result(30\u5B57), strength_effect:0, geoData?:{routeKm, terrainDifficulty:0.5, hasOfficialRoad, routeDescription("\u7ECF\u2026\u2026"), passesAndBarriers[], fortLevel, garrison}}\n';
        tp1c += '  \u519B\u4E8B\u7C7B geoData \u5FC5\u586B\uFF0C\u5176\u4ED6\u7C7B\u53EF\u7701\n\n';

        tp1c += '\u25C6 faction_relation_changes\uFF08\u52BF\u529B\u5173\u7CFB\u53D8\u5316\u00B72-5 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{from, to, type, delta, reason}\n';
        tp1c += '  \u5173\u7CFB\u516D\u7EF4\uFF1Atrust\u4FE1\u4EFB/hostility\u654C\u610F/economicTies\u7ECF\u6D4E/culturalAffinity\u6587\u5316/kinshipTies\u59FB\u4EB2/territorialDispute\u9886\u571F\uFF1B\u6309\u4E92\u52A8\u5BFC\u81F4\u7684\u7EF4\u5EA6\u66F4\u65B0\n\n';

        tp1c += '\u25C6 faction_succession\uFF08\u52BF\u529B\u7EE7\u627F\u00B7\u4EC5\u5F53\u9996\u9886\u6B7B\u4EA1/\u5931\u5FC3/\u6C11\u53D8\u65F6\u89E6\u53D1\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{faction, oldLeader, newLeader, legitimacy:70, stability_delta:-10, disputeType:"\u6B63\u5E38\u7EE7\u627F/\u4E89\u4F4D/\u7BE1\u4F4D/\u5185\u6218/\u5916\u621A\u4E13\u653F/\u91CD\u81E3\u63A8\u8F7D", narrative(40\u5B57)}\n\n';

        tp1c += '\u25C6 npc_schemes\uFF08NPC \u9634\u8C0B\u00B7\u65B0\u589E\u9634\u8C0B\u3002\u5E38\u6001 2-4 \u6761\uFF0C\u5F20\u529B\u671F 4-8 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u8DE8\u56DE\u5408\u9634\u8C0B\u2014\u2014\u6743\u81E3\u6392\u6324\u5BF9\u624B\u3001\u5C06\u519B\u6697\u8054\u5916\u90E8\u3001\u6536\u96C6\u53CD\u5BF9\u6D3E\u7F6A\u8BC1\u3001\u6B3E\u586B\u4E00\u8D1D\u3001\u4EA4\u5851\u540E\u5BAB\u3001\u6D41\u8A00\u9020\u52BF\u3001\u540E\u9752\u52FE\u7ED3\u7B49\u957F\u671F\u5E03\u5C40\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{schemer, target, plan(40\u5B57\u63CF\u8FF0), progress:"\u915D\u917F\u4E2D/\u5373\u5C06\u53D1\u52A8/\u957F\u671F\u5E03\u5C40", allies:"\u540C\u8C0B\u8005\uFF08\u4EBA\u540D\u9017\u53F7\u5206\u9694\uFF09"}\n\n';

        tp1c += '\u25C6 scheme_actions\uFF08\u5DF2\u6709\u9634\u8C0B\u63A8\u8FDB\u00B71-3 \u6761\uFF0C\u5BF9\u5E94\u4E0A\u4E00\u56DE\u5408\u9634\u8C0B\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{schemer, action:"advance\u63A8\u8FDB/disrupt\u7834\u574F/abort\u4E2D\u6B62/expose\u88AB\u63ED\u53D1", reason(30\u5B57)}\n\n';

        tp1c += '\u25C6 hidden_moves\uFF08NPC \u6697\u4E2D\u884C\u52A8\u00B7\u81F3\u5C11 8 \u6761\uFF0C\u5B57\u7B26\u4E32\u6570\u7EC4\uFF09\u2014\u2014\n';
        tp1c += '  \u6BCF\u6761\u683C\u5F0F\uFF1A"\u67D0\u89D2\u8272\uFF1A\u56E0\u4E3A\u4EC0\u4E48\u2192\u6697\u4E2D\u505A\u4E86\u4EC0\u4E48\u2192\u76EE\u7684\u662F\u4EC0\u4E48"\uFF0830-60\u5B57\uFF09\n';
        tp1c += '  \u5FC5\u5305\u542B\uFF1A\u2265 3 \u6761 NPC\u5BF9NPC\u6697\u884C\uFF1B\u2265 1 \u6761 \u52BF\u529B\u5185\u90E8\u6697\u6D41\uFF1B\u2265 1 \u6761 \u5C0F\u4EBA\u7269\u52A8\u4F5C\uFF08\u5C0F\u540F\u8D2A\u5893/\u5546\u4EBA\u56E4\u8D27/\u63A2\u5B50\u4F20\u4FE1/\u6D41\u6C11\u805A\u96C6\uFF09\n\n';

        tp1c += '\u25C6 fengwen_snippets\uFF08\u98CE\u95FB\u5F55\u4E8B\u00B7\u5E38\u6001 10-16 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u4EBA\u7269\u548C\u52BF\u529B\u7684\u6D3B\u52A8\u98CE\u95FB\u2014\u2014\u6E90\u81EA\u5751\u95F4\u8033\u76EE\u3001\u671D\u5802\u98CE\u8BEE\u3001\u5F80\u6765\u5BC6\u51FD\u7B49\uFF0C\u901A\u8FC7\u8D77\u5C45\u6CE8/\u8033\u62A5/\u5857\u62A5/\u574A\u95F4\u4F20\u95FB\u62A5\u5165\u3002\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{type, text(30-60\u5B57\u53E4\u5178\u4E2D\u6587\u98CE), credibility(0.3-0.95), actors:["\u4EBA\u540D\u6216\u52BF\u529B\u540D"], source:"\u574A\u95F4/\u671D\u5802/\u8033\u76EE/\u5857\u62A5/\u5BC6\u672D/\u8FB9\u5173"}\n';
        tp1c += '  type \u5206\u7C7B\uFF1A\u5F39\u52BE/\u8350\u4E3E/\u594F\u8BAE/\u7ED3\u515A/\u9020\u8C23/\u79C1\u8BBF/\u5BB4\u996E/\u6E38\u5BB4/\u8BD7\u793E/\u5B66\u8BBA/\u6C42\u5A5A/\u6BCD\u796D/\u4E39\u9053/\u85AC\u91CA/\u6709\u5DE1\u89C6/\u5DE1\u8005/\u8D51\u635C/\u53F8\u6CD5/\u4E39\u5BAB/\u7248\u7A3F/\u5C01\u575B/\u5C45\u7740/\u96C5\u793A/\u5BB6\u4E8B/\u5BC6\u8054/\u51E0\u8A00/\u8BCD\u7AE0/\u66F2\u80FD/\u98DF\u8840/\u7E41\u6CE2/\u5E03\u5C40\n';
        tp1c += '  \u4F8B\uFF1A{type:"\u8BD7\u793E", text:"\u897F\u6E56\u4E09\u96C5\u96C6\u4E8E\u5317\u5C71\uFF0C\u67D0\u7532\u8D4B\u300A\u79CB\u6C34\u300B\uFF0C\u67D0\u4E59\u6B21\u97F5\uFF0C\u67D0\u4E19\u7ACB\u5212\u70B9\u65AD\u53E5\uFF0C\u75AB\u671F\u53F8\u5438\u76EE\u3002", credibility:0.75, actors:["\u67D0\u7532","\u67D0\u4E59"], source:"\u574A\u95F4"}\n\n';

        tp1c += '\u3010\u6D3B\u52A8\u5185\u5BB9\u65B9\u5411\uFF08AI \u63A8\u7406\u53C2\u8003\uFF09\u3011\n';
        tp1c += '  \u65E0\u9700\u6BCF\u79CD\u90FD\u7528\uFF0C\u6309 NPC/\u52BF\u529B\u6027\u683C\u3001\u5F53\u524D\u5C40\u52BF\u3001\u79C1\u5FC3\u81EA\u7531\u9009\u62E9\u2014\u2014\u8BE5\u5206\u7C7B\u4EC5\u4F9B\u6269\u5C55\u601D\u8DEF\uFF0C\u907F\u514D\u5355\u8C03\u91CD\u590D\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u653F\u6597\u671D\u5802\u535A\u5F08\u3011\n';
        tp1c += '    \u00B7 \u4E0A\u758F\u4E89\u8FA9\uFF08\u4E3A\u67D0\u653F\u7B56\u5386\u4E0B\u53CD\u590D\u529B\u4E89\uFF09\n';
        tp1c += '    \u00B7 \u5F39\u52BE\u53CD\u5F39\u8FDE\u73AF\uFF08\u5F39\u8005\u53CD\u88AB\u53CD\u8BD8\u7275\u8FDE\uFF09\n';
        tp1c += '    \u00B7 \u7ED3\u515A\u00B7\u8054\u540D\u5954\u8FF0\uFF08\u7ACB\u573A\u76F8\u8FD1\u8005\u5171\u540C\u4E0A\u8868\uFF09\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u6E38\u8BF4\u4E2D\u7ACB\u6D3E\uFF08\u5BB4\u8BF7\u00B7\u8BB8\u4EE5\u597D\u5904\u6216\u5A01\u80C1\uFF09\n';
        tp1c += '    \u00B7 \u501F\u5929\u8C61/\u707E\u5F02\u8FDB\u8A00\uFF08\u9644\u4F1A\u9634\u9633\u00B7\u6258\u8A00\u5929\u8B66\uFF09\n';
        tp1c += '    \u00B7 \u8BA9\u65C1\u4EBA\u4F5C\u66FF\u8EAB\u2014\u2014\u907F\u76F4\u63A5\u51B2\u7A81\uFF08\u501F\u5FA1\u53F2\u53F0/\u501F\u8BD7\u6587\u5F71\u5C04/\u501F\u5F1F\u5B50\u9677\u9635\uFF09\n';
        tp1c += '    \u00B7 \u6536\u96C6\u5BF9\u624B\u628A\u67C4/\u4F3A\u673A\u53D1\u96BE\uFF08\u8D26\u76EE\u00B7\u79C1\u4EA4\u00B7\u5BB6\u4EBA\u8FC7\u5931\uFF09\n';
        tp1c += '    \u00B7 \u5236\u9020\u8206\u8BBA\u00B7\u6563\u5E03\u6D41\u8A00\uFF08\u501F\u7AE5\u8C23\u00B7\u8C36\u8BED\u00B7\u79C1\u8BE9\uFF09\n';
        tp1c += '    \u00B7 \u6258\u5BA6\u5B98/\u5916\u621A/\u540E\u5983\u8FDB\u8A00\uFF08\u8D70\u5185\u7EBF\u00B7\u7ED5\u5F00\u524D\u671D\uFF09\n';
        tp1c += '    \u00B7 \u62D2\u4E0D\u8868\u6001\u00B7\u660E\u54F2\u4FDD\u8EAB\uFF08\u7ACB\u573A\u4E0D\u660E\u00B7\u6301\u9EBB\u4F7F\u524D\uFF09\n';
        tp1c += '    \u00B7 \u79BB\u673A\u8C0B\u4F4D\u00B7\u4E0A\u7591\u5DE5\u5F85\u52BF\uFF08\u5C0F\u4EBA\u4E4B\u9A9A\u6269\u5927/\u770B\u98CE\u4F7F\u8235\uFF09\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u6CBB\u7406\u516C\u52A1\u5904\u7F6E\u3011\n';
        tp1c += '    \u00B7 \u6279\u9605\u6587\u4E66/\u79EF\u538B\u6848\u724D\uFF08\u8BE5\u5B98\u7C7B\u578B\u6027\u663E\uFF09\n';
        tp1c += '    \u00B7 \u53EC\u96C6\u50DA\u5C5E\u8BAE\u4E8B/\u5802\u6742\u00B7\u4F1A\u516C\u5546\u4E8B\n';
        tp1c += '    \u00B7 \u5DE1\u89C6\u8F96\u533A\u00B7\u5DE1\u6D4E\u4EB2\u770B\uFF08\u6C34\u5229/\u5175\u9632/\u72F1\u8BBC/\u519C\u65F6\uFF09\n';
        tp1c += '    \u00B7 \u5FAE\u670D\u8BBF\u6C11\u60C5\u00B7\u767E\u59D3\u6B8A\u547C\n';
        tp1c += '    \u00B7 \u6574\u985D\u98CE\u7EAA\u00B7\u60E9\u8D2A\u9501\u5BB3\uFF08\u67E5\u5C5E\u90E8\u00B7\u6838\u7269\u5238\uFF09\n';
        tp1c += '    \u00B7 \u67E5\u9605\u6237\u7C4D\u00B7\u4E08\u91CF\u7530\u4EA9\u00B7\u6CBB\u7406\u9690\u6237\n';
        tp1c += '    \u00B7 \u4FEE\u8BA2\u5730\u65B9\u89C4\u7AE0\u00B7\u4FBF\u5B9C\u884C\u4E8B\n';
        tp1c += '    \u00B7 \u8350\u4E3E\u90E8\u5C5E\u00B7\u8003\u8BFE\u9EDC\u9677\uFF08\u4E0A\u9650\u5355/\u8003\u8BE6\u5355\uFF09\n';
        tp1c += '    \u00B7 \u5BA1\u7406\u7591\u96BE\u6848\u4EF6\u00B7\u5BB9\u6781\u51A4\u72F1\n';
        tp1c += '    \u00B7 \u629A\u6170\u6D41\u6C11/\u53D1\u4ED3\u8D48\u6D4E/\u8D44\u9063\u8FD4\u4E61\n';
        tp1c += '    \u00B7 \u7B79\u63AA\u519B\u9700/\u6574\u5907\u9632\u52A1/\u589E\u5385\u5C11\u961F\n';
        tp1c += '    \u00B7 \u62DB\u629A\u76D7\u8D3C/\u8BAE\u548C\u8FB9\u6C11\n';
        tp1c += '    \u00B7 \u7B79\u5EFA\u5DE5\u7A0B\uFF08\u6865\u6881/\u5824\u575D/\u9A7F\u9053/\u5B66\u5BAB/\u7985\u9662\uFF09\n';
        tp1c += '    \u00B7 \u5904\u7406\u4E0A\u7EA7\u578B\u6307\u4EE4\u00B7\u52A0\u76D6\u8F6C\u53D1\u4E0B\u53F8\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u5F7C\u6B64\u4E92\u52A8\u793E\u4EA4\u96C5\u4E8B\u3011\n';
        tp1c += '    \u00B7 \u540C\u50DA\u5BB4\u996E\u00B7\u8BD7\u9152\u5531\u548C\n';
        tp1c += '    \u00B7 \u5B66\u672F\u5207\u78CB\u00B7\u8BBA\u5B66\u8FA9\u96BE\u00B7\u8BB2\u4F1A\n';
        tp1c += '    \u00B7 \u8BBF\u53CB\u95EE\u5B66\u00B7\u8BF7\u6559\u524D\u8F88\u00B7\u8868\u62A5\u5E08\u95E8\n';
        tp1c += '    \u00B7 \u8054\u59FB\u6C42\u4EB2\u00B7\u4EA4\u6362\u5A5A\u8BFA\u00B7\u5408\u5C01\u5C54\u5973\n';
        tp1c += '    \u00B7 \u5E08\u5F92\u4F20\u9053\u00B7\u6536\u5F92\u7ACB\u6D3E\u00B7\u9616\u5B8B\u4F20\u7ECF\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u8C03\u505C\u53CC\u65B9\u7EA0\u7EB7\u00B7\u8BB0\u6069\u4E0E\u6068\n';
        tp1c += '    \u00B7 \u5546\u8BAE\u5171\u540C\u4E0A\u758F\u00B7\u8054\u540D\u5448\u8BF7\n';
        tp1c += '    \u00B7 \u8F6C\u6C42\u540C\u95E8/\u540C\u4E61\u63F4\u5F15\n';
        tp1c += '    \u00B7 \u5199\u4FE1\u6170\u95EE\u75C5\u8005\u00B7\u540A\u5510\u4E27\u8005\u00B7\u8D53\u793C\u7230\u5BD7\n';
        tp1c += '    \u00B7 \u540C\u89C2\u4E66\u753B\u00B7\u5171\u8D4F\u53E4\u73A9\u00B7\u6B23\u8D4F\u82B1\u6728\n';
        tp1c += '    \u00B7 \u7ED3\u793E\u96C5\u96C6\uFF08\u8BD7\u793E/\u6587\u793E/\u4E49\u793E/\u4E91\u7845\u4F1A\uFF09\n';
        tp1c += '    \u00B7 \u65C5\u884C\u540C\u6E38\u00B7\u8BBF\u53E4\u5BFB\u80DC\u00B7\u5BFC\u6E38\u516C\u4E8B\n';
        tp1c += '    \u00B7 \u8D60\u7B54\u6587\u5B57\u00B7\u6B21\u97F5\u552F\u92F3\u7B54\u7B54\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u4E3B\u52A8\u5EFA\u6784\u540D\u671B\u8D24\u80FD\u884C\u4E3A\uFF08\u5FC3\u6709\u91CE\u671B/\u91CD\u89C6\u540D\u8282\u7684 NPC \u5E94\u4E3B\u52A8\u4E3A\u4E4B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6551\u6D4E\u707E\u6C11\u00B7\u65BD\u7CA5\u6296\u8863\uFF08\u540D\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u6350\u8D44\u5174\u5B66\u00B7\u5EFA\u4E66\u9662\u00B7\u7F62\u5B66\u8D4F\u4E8B\uFF08\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u8BB2\u5B66\u00B7\u7ACB\u8A00\u00B7\u8457\u4E66\u7ACB\u5B66\u6D3E\uFF08\u6587\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u5956\u638E\u540E\u8FDB\u00B7\u8350\u62D4\u8D24\u624D\u00B7\u63D0\u643A\u4E0B\u58EB\uFF08\u8D24\u80FD++\uFF09\n';
        tp1c += '    \u00B7 \u4FEE\u5FD7\u7F16\u53F2\u00B7\u96C6\u8D24\u8BEF\u7279\u7AD9\uFF08\u6587\u5316\u8D21\u732E\u00B7\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u5174\u4FEE\u6C34\u5229\u00B7\u5EFA\u8DEF\u7B51\u6865\u00B7\u60E0\u6C11\u5DE5\u7A0B\uFF08\u540D\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u6E05\u5EC9\u81EA\u5B88\u00B7\u62D2\u8D3F\u4E0D\u62DC\u00B7\u5404\u6D01\u8EAB\u4EE5\u98DF\uFF08\u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u629A\u6070\u5B64\u5BA1\u00B7\u65BD\u60E0\u8001\u5F31\u00B7\u89E3\u56F0\u5982\u4EB2\uFF08\u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u5E73\u53CD\u51A4\u72F1\u00B7\u56F4\u590D\u540D\u6D41\u00B7\u6B63\u6C89\u53D7\u5C48\uFF08\u540D\u671B++ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u4E61\u796D\u00B7\u8C03\u505C\u5B97\u65CF\u7EA0\u7EB7\uFF08\u5730\u65B9\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u66FF\u4EBA\u62C5\u4FDD\u00B7\u8DF5\u8BFA\u5B88\u4FE1\u00B7\u4E49\u8D48\u6025\u96BE\uFF08\u4FE1\u4E49+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u4E3A\u56FD\u732E\u7B56\u00B7\u72AF\u9A6C\u76F4\u8C0F\u00B7\u62A5\u56FD\u5C4E\u8EAB\uFF08\u5FE0\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u6784\u7C50\u8BD7\u6587\u00B7\u9898\u8DCB\u540D\u54C1\u00B7\u9700\u987B\u96B6\u5B66\uFF08\u6587\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u7F6E\u4E49\u7530\u4E49\u58AE\u00B7\u4EA4\u4E8B\u5BD7\u65CF\u4EBA\uFF08\u65CF\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u2605 \u9700\u6839\u636E NPC \u6027\u683C\u4E0E\u91CE\u5FC3\u9009\u62E9\uFF1A\u6E05\u6D41\u58EB\u5927\u592B\u504F\u5411\u6587\u5316\u00B7\u8BB2\u5B66\u00B7\u7F6E\u4E49\u7530\uFF0C\n';
        tp1c += '      \u529F\u5229\u578B\u504F\u5411\u6350\u8D44\u5174\u6559\u00B7\u8350\u62D4\u00B7\u60E0\u6C11\u5DE5\u7A0B\uFF0C\u5FE0\u81EA\u578B\u504F\u5411\u76F4\u8C0F\u00B7\u5CD7\u8074\u00B7\u62A5\u56FD\uFF0C\u4EC1\u5FB7\u578B\u504F\u5411\u5E73\u51A4\u00B7\u5B88\u4FE1\u00B7\u629A\u6070\u3002\n';
        tp1c += '    \u2605 \u4EE5\u4E0A\u884C\u4E3A\u53EF\u901A\u8FC7 npc_interactions \u8F93\u51FA\uFF08type \u53EF\u4EE3\u5165 mediate/recommend/guarantee/petition_jointly\u7B49\uFF09\uFF0C\n';
        tp1c += '      \u6216\u901A\u8FC7 fengwen_snippets \u98CE\u95FB\u6761\u5230\u6620\u5728\u73A9\u5BB6\u76F8\u5173\u9762\u677F\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u79C1\u4EBA\u751F\u6D3B\u65E5\u5E38\u3011\n';
        tp1c += '    \u00B7 \u5BB6\u4E8B\u5904\u7406\uFF08\u796D\u7956/\u5A5A\u5A36/\u4E27\u846C/\u8BAD\u5B50/\u5206\u5BB6\uFF09\n';
        tp1c += '    \u00B7 \u5B97\u6559\u4FE1\u4EF0\uFF08\u8FDB\u5E99/\u793C\u4F5B/\u6C42\u9053/\u9F4B\u6212/\u7167\u706B\u7586\u75AB\uFF09\n';
        tp1c += '    \u00B7 \u517B\u751F\u4FDD\u5065\uFF08\u670D\u836F/\u9759\u5750/\u5BFC\u5F15/\u4E94\u79BD\u620F\uFF09\n';
        tp1c += '    \u00B7 \u6587\u623F\u96C5\u4E8B\uFF08\u6536\u85CF\u91D1\u77F3/\u9898\u8DCB\u4E27\u672C/\u4E34\u5E16/\u523B\u5370\uFF09\n';
        tp1c += '    \u00B7 \u56ED\u6797\u6E38\u61A9\uFF08\u8D4F\u82B1/\u542C\u7434/\u9493\u9C7C/\u5F02\u745E\u552F\u548C\uFF09\n';
        tp1c += '    \u00B7 \u7814\u7A76\u8457\u8FF0\uFF08\u6821\u52D8\u7ECF\u7C4D/\u64B0\u53F2/\u6CE8\u758F/\u4FEE\u65B9\u5FD7\uFF09\n';
        tp1c += '    \u00B7 \u5904\u7406\u75BE\u75C5\u00B7\u4E27\u670D\u5B88\u5236\n';
        tp1c += '    \u00B7 \u4E91\u6E38\u53E4\u8FF9\u00B7\u65E0\u65E0\u5C81\u6708\u00B7\u6E29\u8F66\u6253\u5149\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u5185\u653F\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u6574\u987F\u5F8B\u6CD5\u00B7\u9881\u5E03\u65B0\u4EE4\n';
        tp1c += '    \u00B7 \u6E05\u67E5\u6237\u53E3\u00B7\u4E08\u91CF\u7530\u4EA9\n';
        tp1c += '    \u00B7 \u6539\u5143\u00B7\u66F4\u5B9A\u5E74\u53F7\u00B7\u6539\u5236\u5189\u5B98\n';
        tp1c += '    \u00B7 \u5BAB\u5EF7\u4EBA\u4E8B\u6574\u987F\u00B7\u7F62\u9769\u5B66\u5E9C/\u56FD\u5B50\u76D1\n';
        tp1c += '    \u00B7 \u7F62\u9769\u5BA6\u5B98\u00B7\u6574\u9970\u5185\u5BAB\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u519B\u4E8B\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u7B79\u5EFA\u65B0\u519B\u00B7\u6574\u7F16\u65E7\u90E8\n';
        tp1c += '    \u00B7 \u4FEE\u7B51\u57CE\u9632\u00B7\u589E\u8BBE\u8FB9\u585E/\u5821\u91D1\n';
        tp1c += '    \u00B7 \u8C03\u52A8\u9A7B\u519B\u00B7\u66F4\u6362\u5C06\u9886\n';
        tp1c += '    \u00B7 \u50A8\u5907\u7CAE\u8349\u00B7\u8C03\u8FD0\u519B\u9700\n';
        tp1c += '    \u00B7 \u5F81\u52DF\u5175\u6E90\u00B7\u7EC3\u5175\u8BB2\u6B66\n';
        tp1c += '    \u00B7 \u519B\u5C6F\u519B\u7530\u6539\u5236\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u7ECF\u6D4E\u6C11\u751F\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u5F00\u5E02\u901A\u5546\u00B7\u6574\u8083\u5E02\u6988\n';
        tp1c += '    \u00B7 \u53EC\u52DF\u6D41\u6C11\u5C6F\u57A6\n';
        tp1c += '    \u00B7 \u63A8\u884C\u5E73\u7C74/\u5E73\u7C75\n';
        tp1c += '    \u00B7 \u6539\u94F8\u94B1\u5E01\u00B7\u6574\u7406\u76D0\u94C1\n';
        tp1c += '    \u00B7 \u5174\u529E\u77FF\u51B6\u00B7\u7B79\u5EFA\u6F15\u8FD0\n';
        tp1c += '    \u00B7 \u8BBE\u7ACB\u4ED3\u50A8\u00B7\u8D48\u707E\u6D4E\u6C11\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u6587\u5316\u5B97\u6559\u5916\u4EA4\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u4E3E\u529E\u79D1\u4E3E/\u796D\u5929/\u5C01\u7985\n';
        tp1c += '    \u00B7 \u5174\u5EFA\u5BFA\u89C2\u00B7\u656C\u4E8B\u795E\u7948\n';
        tp1c += '    \u00B7 \u6574\u7406\u5178\u7C4D\u00B7\u7F16\u7EAE\u56FD\u53F2\n';
        tp1c += '    \u00B7 \u63A8\u5E7F\u672C\u65CF\u6587\u5316/\u6587\u5B57\n';
        tp1c += '    \u00B7 \u6291\u5236\u5F02\u7AEF\u00B7\u7981\u6BC1\u90AA\u8BF4\n';
        tp1c += '    \u00B7 \u6D3E\u9063\u4F7F\u8005/\u63A5\u7EB3\u6D41\u4EA1\n';
        tp1c += '    \u00B7 \u53EC\u96C6\u90E8\u843D\u5927\u4F1A/\u8BF8\u4FAF\u76DF\u4F1A\n\n';

        tp1c += '\u3010\u786C\u89C4\u5219\u3011\n';
        tp1c += '  \u00B7 \u4EC5\u8FD4\u56DE\u4E0A\u8FF0 8 \u4E2A\u5B57\u6BB5\u7684 JSON\uFF0C\u4E0D\u8981\u4EFB\u4F55\u5176\u4ED6\u5B57\u6BB5\n';
        tp1c += '  \u00B7 \u4EBA\u540D/\u52BF\u529B\u540D\u5FC5\u987B\u4F7F\u7528\u4E0A\u65B9\u5217\u51FA\u7684\u540D\u79F0\n';
        tp1c += '  \u00B7 \u9632\u6B62"\u5FA1\u53F2\u5FC5\u8C0F\u00B7\u5C06\u519B\u5FC5\u6218\u00B7\u6E05\u6D41\u5FC5\u52BE\u5BA6\u5B98"\u5DE5\u5177\u4EBA\u6A21\u677F\u2014\u2014\u6309 NPC \u6027\u683C/\u6D3E\u7CFB/\u4E0E\u76EE\u6807\u5173\u7CFB/\u5FE0\u5FD7\u5EC9\u9009\u884C\u4E3A\n';
        tp1c += '  \u00B7 \u591A\u6570\u4EBA\u89C2\u671B/\u660E\u54F2\u4FDD\u8EAB\uFF0C\u5C11\u6570\u4EBA\u4ECB\u5165\n';
        tp1c += '  \u00B7 \u73A9\u5BB6 ' + _pNameC + ' \u4E0D\u5F97\u4F5C\u4EFB\u4F55\u5B57\u6BB5\u4E2D\u7684 actor/schemer\n';
        tp1c += '  \u00B7 \u5386\u53F2\u8D26\u672C\u4E00\u81F4\u6027\u2014\u2014\u767E\u5E74\u524D\u7684\u4EE4\u6068/\u6069\u60E0\u4ECA\u4ECD\u6709\u4F59\u6CE2\uFF1B\u4E0D\u53EF\u8F7B\u6613\u201C\u548C\u597D\u201D\u4E4B\u524D\u7684\u5C60\u57CE/\u80CC\u76DF\u4EC7\u6577\n';

        tp1c += '\n\u8FD4\u56DE\u683C\u5F0F\u793A\u4F8B\uFF1A\n';
        tp1c += '{\n  "faction_interactions_advanced":[{...}],\n  "faction_events":[{...}],\n  "faction_relation_changes":[{...}],\n  "faction_succession":[{...}],\n  "npc_schemes":[{...}],\n  "scheme_actions":[{...}],\n  "hidden_moves":["..."],\n  "fengwen_snippets":[{...}]\n}';

        var _sc1cBody = {model:P.ai.model||'gpt-4o', messages:[{role:'system',content:sysP},{role:'user',content:tp1c}], temperature:_modelTemp, max_tokens:_tok(8000)};
        if (_modelFamily === 'openai') _sc1cBody.response_format = { type:'json_object' };

        var resp1c = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body:JSON.stringify(_sc1cBody)});
        if (resp1c.ok) {
          var data1c = await resp1c.json();
          _checkTruncated(data1c, '\u52BF\u529B\u9634\u8C0B');
          if (data1c.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data1c.usage);
          var c1c = (data1c.choices && data1c.choices[0] && data1c.choices[0].message) ? data1c.choices[0].message.content : '';
          var p1c = extractJSON(c1c);
          GM._turnAiResults.subcall1c_raw = c1c;
          GM._turnAiResults.subcall1c = p1c;

          if (p1c && p1) {
            // ── sc1 自动派发的 5 字段：concat 合并即可 ──
            if (Array.isArray(p1c.faction_interactions_advanced)) p1.faction_interactions_advanced = (Array.isArray(p1.faction_interactions_advanced) ? p1.faction_interactions_advanced : []).concat(p1c.faction_interactions_advanced);
            if (Array.isArray(p1c.faction_events)) p1.faction_events = (Array.isArray(p1.faction_events) ? p1.faction_events : []).concat(p1c.faction_events);
            if (Array.isArray(p1c.faction_relation_changes)) p1.faction_relation_changes = (Array.isArray(p1.faction_relation_changes) ? p1.faction_relation_changes : []).concat(p1c.faction_relation_changes);
            if (Array.isArray(p1c.faction_succession)) p1.faction_succession = (Array.isArray(p1.faction_succession) ? p1.faction_succession : []).concat(p1c.faction_succession);
            if (Array.isArray(p1c.scheme_actions)) p1.scheme_actions = (Array.isArray(p1.scheme_actions) ? p1.scheme_actions : []).concat(p1c.scheme_actions);

            // ── npc_schemes / hidden_moves：sc1 不派发，内联处理 ──
            if (Array.isArray(p1c.npc_schemes)) {
              if (!GM.activeSchemes) GM.activeSchemes = [];
              p1c.npc_schemes.forEach(function(s){
                if (!s || !s.schemer || !s.target || !s.plan) return;
                GM.activeSchemes.push({
                  id: 'scheme_T' + GM.turn + '_' + Math.random().toString(36).slice(2,6),
                  schemer: s.schemer, target: s.target,
                  plan: s.plan, progress: s.progress || '\u915D\u917F\u4E2D',
                  allies: s.allies || '',
                  startTurn: GM.turn
                });
                addEB('\u9634\u8C0B', s.schemer + ' \u9488\u5BF9 ' + s.target + '\uFF1A' + String(s.plan).slice(0,40) + ' [' + (s.progress||'\u915D\u917F\u4E2D') + ']');
              });
            }
            if (Array.isArray(p1c.hidden_moves)) {
              p1c.hidden_moves.forEach(function(hm){
                if (typeof hm === 'string' && hm) addEB('\u6697\u6D41', hm);
              });
            }

            // ── fengwen_snippets：直接入风闻录事 ──
            if (Array.isArray(p1c.fengwen_snippets) && typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
              p1c.fengwen_snippets.forEach(function(fw){
                if (!fw || !fw.text) return;
                PhaseD.addFengwen({
                  type: fw.type || '\u98CE\u8BAE',
                  text: String(fw.text).slice(0, 120),
                  credibility: (typeof fw.credibility === 'number') ? Math.max(0.3, Math.min(0.95, fw.credibility)) : 0.7,
                  source: fw.source || 'ai_sc1c',
                  actors: Array.isArray(fw.actors) ? fw.actors : [],
                  turn: GM.turn
                });
              });
            }

            _dbg('[sc1c] \u5408\u5E76: \u52BF\u4E92\u52A8+' + (p1c.faction_interactions_advanced||[]).length + ' \u52BF\u4E8B\u4EF6+' + (p1c.faction_events||[]).length + ' \u5173\u7CFB+' + (p1c.faction_relation_changes||[]).length + ' \u7EE7\u627F+' + (p1c.faction_succession||[]).length + ' \u63A8\u8FDB+' + (p1c.scheme_actions||[]).length + ' \u65B0\u9634\u8C0B+' + (p1c.npc_schemes||[]).length + ' \u6697\u6D41+' + (p1c.hidden_moves||[]).length + ' \u98CE\u95FB+' + (p1c.fengwen_snippets||[]).length);
          }
          GM._subcallTimings.sc1c = Date.now() - _sc1cStart;
        } else {
          console.warn('[sc1c] HTTP', resp1c.status);
        }
      } catch(_sc1cErr) {
        console.warn('[sc1c] \u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u4E3B\u6D41\u7A0B\uFF09:', _sc1cErr.message || _sc1cErr);
      }

      if(p1){
        // 方案融入：AI 产出的通用变化/任免/机构/区划/事件/NPC行动/关系 → 统一应用
        try {
          if (typeof applyAITurnChanges === 'function') {
            applyAITurnChanges({
              narrative: p1.shizhengji || '',
              changes: Array.isArray(p1.changes) ? p1.changes : [],
              appointments: Array.isArray(p1.appointments) ? p1.appointments : [],
              institutions: Array.isArray(p1.institutions) ? p1.institutions : [],
              regions: Array.isArray(p1.regions) ? p1.regions : [],
              events: Array.isArray(p1.events) ? p1.events : [],
              npc_actions: Array.isArray(p1.npc_actions) ? p1.npc_actions : [],
              relations: Array.isArray(p1.relations) ? p1.relations : []
            });
          }
        } catch(_applyErr) { console.warn('[endturn] applyAITurnChanges:', _applyErr); }

        // v5·人物生成 B · 推演扫描+自动生成/pending
        try {
          if (typeof scanMentionedCharacters === 'function') {
            // 合并 aiResult·提供扫描所需字段
            var _scanInput = {
              zhengwen: p1.shizhengji || p1.zhengwen || '',
              xinglu: p1.xinglu || '',
              events: Array.isArray(p1.events) ? p1.events : [],
              npc_actions: Array.isArray(p1.npc_actions) ? p1.npc_actions : []
            };
            showLoading('\u8BB0\u8F7D\u65B0\u4EBA\u7269\u2026\u2026', 90);
            scanMentionedCharacters(_scanInput).then(function(res){
              if (res.generated && res.generated.length) {
                if (typeof addEB === 'function') addEB('\u8BB0\u4E8B', '\u63A8\u6F14\u6D8C\u73B0\u65B0\u4EBA\u7269\uFF1A' + res.generated.join('\u3001'));
                _dbg('[人物扫描] 自动生成', res.generated.length, '人：', res.generated);
              }
              if (res.pending && res.pending.length) {
                _dbg('[人物扫描] 入 pending', res.pending.length, '人：', res.pending);
              }
            }).catch(function(e){ console.warn('[\u4EBA\u7269\u626B\u63CF]', e); });
          }
        } catch(_scE) { console.warn('[\u4EBA\u7269\u626B\u63CF] \u5F02\u5E38', _scE); }

        shizhengji=p1.shizhengji||"";
        turnSummary=p1.turn_summary||"";
        playerStatus=p1.player_status||""; // 兼容旧字段
        playerInner=p1.player_inner||"";   // 兼容旧字段
        // 新增字段
        shiluText = p1.shilu_text || "";
        szjTitle = p1.szj_title || "";
        szjSummary = p1.szj_summary || "";
        personnelChanges = Array.isArray(p1.personnel_changes) ? p1.personnel_changes : [];
        // 将主角内省记入角色记忆（兼容旧逻辑）
        if (playerInner && typeof NpcMemorySystem !== 'undefined' && P.playerInfo && P.playerInfo.characterName) {
          var _innerEmo = /痛|苦|忧|恨|怒|惧|恐|悲|泪/.test(playerInner) ? '忧' : /喜|乐|慰|畅|笑/.test(playerInner) ? '喜' : '平';
          NpcMemorySystem.remember(P.playerInfo.characterName, playerInner, _innerEmo, 6);
        }
        if(p1.resource_changes){
          Object.entries(p1.resource_changes).forEach(function(e){
            var d=parseFloat(e[1]);if(isNaN(d))return;
            if(GM.vars[e[0]]){
              GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+d,GM.vars[e[0]].min,GM.vars[e[0]].max);
            } else {
              // AI动态创建新变量（如改革进度、特殊资源等）
              GM.vars[e[0]]={value:clamp(d,0,9999),min:0,max:9999,unit:''};
              _dbg('[resource_changes] \u52A8\u6001\u521B\u5EFA\u53D8\u91CF: ' + e[0] + ' = ' + d);
            }
          });
          // 公式约束校验+联动执行
          _enforceFormulas(p1.resource_changes);
        }
        if(p1.relation_changes)Object.entries(p1.relation_changes).forEach(function(e){var d=parseFloat(e[1]);if(isNaN(d))return;if(GM.rels[e[0]])GM.rels[e[0]].value=clamp(GM.rels[e[0]].value+d,-100,100);});
        if(p1.event&&p1.event.title){
          // 事件白名单校验
          var _evtCheck = (typeof EventConstraintSystem!=='undefined') ? EventConstraintSystem.validate(p1.event) : {allowed:true};
          if (_evtCheck.allowed) {
            addEB(p1.event.type||"\u4E8B\u4EF6",p1.event.title + (_evtCheck.downgraded ? '（纯叙事）' : ''));
            if (!_evtCheck.downgraded && typeof EventConstraintSystem!=='undefined') EventConstraintSystem.recordTriggered(p1.event.type);
          } else {
            _dbg('[EventConstraint] 事件被拒绝:', p1.event.type, _evtCheck.reason);
          }
        }

        // 应用 AI 返回的地图变化
        if(p1.map_changes && P.map) {
          try {
            applyAIMapChanges(p1, P.map);
          } catch(e) {
            console.error('应用地图变化失败:', e);
          }
        }
        // 处理 NPC 自主行为（AI 报告的 NPC 独立行动）
        if (p1.npc_actions && Array.isArray(p1.npc_actions)) {
          p1.npc_actions.forEach(function(act) {
            if (!act.name || !act.action) return;
            // 2.3: 模糊匹配名称（防止AI用字/号/略称导致匹配失败）
            var _ff = typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar : null;
            if (_ff && act.name && !findCharByName(act.name)) {
              var _fm = _ff(act.name);
              if (_fm) act.name = _fm.name;
            }
            if (_ff && act.target && !findCharByName(act.target)) {
              var _ft = _ff(act.target);
              if (_ft) act.target = _ft.name;
            }

            // 尝试机械执行（让 AI 的决策产生真实游戏效果）
            var mechanicallyExecuted = false;

            if (act.behaviorType === 'appoint' && act.target) {
              // NPC 任命：尝试通过 PostTransfer 执行
              if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts) {
                var targetPost = null;
                GM.postSystem.posts.forEach(function(p) {
                  if (p.name && act.action.indexOf(p.name) >= 0 && (!p.holder || p.status === 'vacant')) targetPost = p;
                });
                if (targetPost) {
                  PostTransfer.seat(targetPost.id, act.target, act.name);
                  if (typeof recordCharacterArc === 'function') recordCharacterArc(act.target, 'appointment', '被' + act.name + '任命为' + targetPost.name);
                  if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
                    var _tc = (GM.chars || []).find(function(c){ return c.name === act.target; });
                    if (_tc) CorruptionEngine.markAsRecentAppointment(_tc);
                  }
                  if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 8, '被提拔');
                  mechanicallyExecuted = true;
                }
              }
            } else if (act.behaviorType === 'dismiss' && act.target) {
              // NPC 罢免
              if (typeof PostTransfer !== 'undefined') {
                PostTransfer.cascadeVacate(act.target);
                if (typeof recordCharacterArc === 'function') recordCharacterArc(act.target, 'dismissal', '被' + act.name + '罢免');
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -12, '被罢免');
                mechanicallyExecuted = true;
              }
            } else if (act.behaviorType === 'declare_war' && act.target) {
              // NPC 宣战：更新亲疏
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -30, '宣战');
              if (typeof WarWeightSystem !== 'undefined') WarWeightSystem.addTruce(act.name, act.target);
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reward' && act.target) {
              // NPC 赏赐
              var targetChar = findCharByName(act.target);
              if (targetChar) { targetChar.loyalty = Math.min(100, (targetChar.loyalty || 50) + 5); }
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 10, '受赏');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'punish' && act.target) {
              // NPC 惩罚
              var pChar = findCharByName(act.target);
              if (pChar) { pChar.loyalty = Math.max(0, (pChar.loyalty || 50) - 8); }
              if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -15, '受罚');
              if (typeof StressSystem !== 'undefined' && pChar) StressSystem.checkStress(pChar, '受罚');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'request_loyalty' && act.target) {
              // NPC 拉拢/试探忠诚
              var rlChar = findCharByName(act.target);
              if (rlChar) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, 3, '被拉拢');
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(act.target, act.name + '暗中拉拢示好', '平', 5, act.name);
                  NpcMemorySystem.remember(act.name, '试探' + act.target + '的立场', '平', 4, act.target);
                }
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reform') {
              // NPC 推行改革
              if (typeof AutoReboundSystem !== 'undefined' && AutoReboundSystem.checkReforms) {
                var reformChanges = {};
                reformChanges[act.intent || '改革'] = 5;
                AutoReboundSystem.checkReforms(reformChanges);
              }
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(act.name, '推行改革：' + (act.intent || act.action), '平', 6);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'betray') {
              // NPC 背叛
              var bCh = findCharByName(act.name);
              if (bCh) { bCh.loyalty = Math.max(0, (bCh.loyalty||50) - 25); bCh.stance = '投机'; }
              if (typeof AffinityMap !== 'undefined' && act.target) AffinityMap.add(act.name, act.target, -25, '背叛');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(act.name, '背叛：' + act.action, '忧', 9, act.target||'');
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'conspire') {
              // NPC 密谋串联
              if (typeof AffinityMap !== 'undefined' && act.target) AffinityMap.add(act.name, act.target, 8, '密谋同盟');
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(act.name, '暗中串联' + (act.target||''), '平', 6, act.target||'');
                if (act.target) NpcMemorySystem.remember(act.target, act.name + '来联络密事', '平', 5, act.name);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'petition' || act.behaviorType === 'investigate') {
              // NPC 上疏/弹劾调查
              if (act.target) {
                var _tgt = findCharByName(act.target);
                if (_tgt) { _tgt.stress = Math.min(100, (_tgt.stress||0) + 8); }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, -8, act.behaviorType === 'investigate' ? '弹劾' : '进谏批评');
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'obstruct') {
              // NPC 阻挠政令（仅事件，不修改顶栏数值）
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'slander') {
              // NPC 造谣中伤
              if (act.target) {
                var _slCh = findCharByName(act.target);
                if (_slCh) { _slCh.loyalty = Math.max(0, (_slCh.loyalty||50) - 5); _slCh.stress = Math.min(100, (_slCh.stress||0) + 10); }
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.target, act.name, -12, '被中伤');
                if (typeof FaceSystem !== 'undefined' && _slCh) FaceSystem.loseFace(_slCh, 10, act.name + '造谣');
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'reconcile' || act.behaviorType === 'mentor') {
              // NPC 和解/提携
              if (act.target) {
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(act.name, act.target, act.behaviorType === 'mentor' ? 12 : 8, act.behaviorType === 'mentor' ? '师徒提携' : '冰释前嫌');
                var _rcCh = findCharByName(act.target);
                if (_rcCh) _rcCh.loyalty = Math.min(100, (_rcCh.loyalty||50) + 3);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'train_troops' || act.behaviorType === 'fortify' || act.behaviorType === 'patrol') {
              // 军事行为——提升相关军队士气/训练
              var _armyMatch = (GM.armies||[]).find(function(a){return !a.destroyed && (a.commander === act.name || (act.target && a.name === act.target));});
              if (_armyMatch) {
                if (act.behaviorType === 'train_troops') _armyMatch.training = Math.min(100, (_armyMatch.training||50) + 5);
                else if (act.behaviorType === 'patrol') _armyMatch.morale = Math.min(100, (_armyMatch.morale||50) + 3);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'flee' || act.behaviorType === 'retire' || act.behaviorType === 'travel') {
              // NPC 出逃/告老/游历——移动位置
              if (act.new_location) {
                var _flCh = findCharByName(act.name);
                if (_flCh) { _flCh.location = act.new_location; _flCh._locationExplicit = false; }
              }
              if (act.behaviorType === 'flee') {
                var _flCh2 = findCharByName(act.name);
                if (_flCh2) _flCh2.loyalty = Math.max(0, (_flCh2.loyalty||50) - 20);
              }
              if (act.behaviorType === 'retire') {
                // 告老还乡——从官制中移除（新老模型同步）
                if (GM.officeTree) (function _rmHolder(nodes) {
                  nodes.forEach(function(n) {
                    if (n.positions) n.positions.forEach(function(p) {
                      if (p.holder === act.name || (Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){return h && h.name===act.name;}))) {
                        if (typeof _offDismissPerson === 'function') _offDismissPerson(p, act.name);
                        else p.holder = '';
                      }
                    });
                    if (n.subs) _rmHolder(n.subs);
                  });
                })(GM.officeTree);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'develop' || act.behaviorType === 'donate') {
              // 地方发展/赈灾
              if (act.target && GM.provinceStats && GM.provinceStats[act.target]) {
                var ps = GM.provinceStats[act.target];
                if (act.behaviorType === 'develop') ps.prosperity = Math.min(100, (ps.prosperity||50) + 5);
                if (act.behaviorType === 'donate') ps.unrest = Math.max(0, (ps.unrest||0) - 5);
              }
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'hoard' || act.behaviorType === 'smuggle') {
              // 囤积/走私——损害经济
              if (GM.taxPressure !== undefined) GM.taxPressure = Math.min(100, GM.taxPressure + 2);
              mechanicallyExecuted = true;
            } else if (act.behaviorType === 'suppress') {
              // 镇压——仅事件，不修改顶栏数值
              mechanicallyExecuted = true;
            }

            // NPC行为导致的位置移动（通用处理——flee/retire/travel已内部处理，此处兜底其他情况）
            if (act.new_location && !mechanicallyExecuted) {
              var _nlCh = findCharByName(act.name);
              if (_nlCh && _nlCh.location !== act.new_location) {
                _nlCh.location = act.new_location;
                _nlCh._locationExplicit = false;
              }
            }

            // NPC行为产生连锁记忆——行动者、被动者、旁观同僚都会记住
            if (typeof NpcMemorySystem !== 'undefined' && act.behaviorType && act.behaviorType !== 'none') {
              // 行动者自己的记忆
              var _actEmo = (act.behaviorType === 'reward' || act.behaviorType === 'appoint') ? '喜' : (act.behaviorType === 'punish' || act.behaviorType === 'dismiss') ? '平' : (act.behaviorType === 'declare_war') ? '怒' : '平';
              NpcMemorySystem.remember(act.name, act.action, _actEmo, 5, act.target || '');
              // 同势力同僚也会知道这件事（朝堂无秘密）
              if (act.target && GM.chars && (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'declare_war')) {
                var _actChar = findCharByName(act.name);
                if (_actChar && _actChar.faction) {
                  GM.chars.forEach(function(colleague) {
                    if (colleague.alive !== false && colleague.name !== act.name && colleague.name !== act.target && colleague.faction === _actChar.faction) {
                      NpcMemorySystem.remember(colleague.name, act.name + '对' + act.target + '施以' + act.behaviorType, '忧', 3, act.name);
                    }
                  });
                }
              }
            }

            // 无论是否机械执行，都记录事件
            // 公开事件中只显示 publicReason（对外说辞），不泄露 privateMotiv（真实动机）
            var _pubReason = act.publicReason || act.intent || '';
            var _evtText = act.name + '：' + act.action + (act.target ? '（对象：' + act.target + '）' : '') + (act.result ? ' → ' + act.result : '');
            if (_pubReason) _evtText += '（' + _pubReason + '）';
            addEB('NPC自主', _evtText);
            // 角色弧线记录真实动机（玩家通过人物志可窥见深层故事）
            var _arcDesc = act.action;
            if (act.privateMotiv) _arcDesc += '——' + act.privateMotiv;
            else if (act.innerThought) _arcDesc += '——' + act.innerThought;
            if (typeof recordCharacterArc === 'function') recordCharacterArc(act.name, 'autonomous', _arcDesc);

            if (!mechanicallyExecuted && act.behaviorType && act.behaviorType !== 'none') {
              _dbg('[npc_actions] ' + act.name + ' 行为 ' + act.behaviorType + ' 无法机械执行，仅记录叙事');
            }

            // 3.1: 涟漪效应——与被影响者关系密切的人额外触发记忆
            if (act.target && typeof NpcMemorySystem !== 'undefined' && GM.chars) {
              var _targetCh = findCharByName(act.target);
              if (_targetCh && _targetCh._impressions) {
                for (var _rpn in _targetCh._impressions) {
                  if (_rpn === act.name || _rpn === act.target) continue;
                  var _rpImp = _targetCh._impressions[_rpn];
                  if (Math.abs(_rpImp.favor) >= 15) {
                    var _rpCh = findCharByName(_rpn);
                    if (_rpCh && _rpCh.alive !== false) {
                      var _rpEmo = _rpImp.favor > 0 ? (act.behaviorType === 'punish' || act.behaviorType === 'dismiss' || act.behaviorType === 'slander' ? '\u6012' : '\u559C') : '\u5E73';
                      var _rpDelta = _rpImp.favor > 0 ? -3 : 2; // 友被害→怨施害者；敌被害→对施害者好感
                      NpcMemorySystem.remember(_rpn, act.target + '\u88AB' + act.name + act.behaviorType, _rpEmo, 4, act.name);
                      if (typeof AffinityMap !== 'undefined') AffinityMap.add(_rpn, act.name, _rpDelta, act.target + '\u88AB' + act.behaviorType);
                    }
                  }
                }
              }
            }
          });
        }

        // 处理 NPC 主动来书（AI推演的远方NPC写信给皇帝）
        if (p1.npc_letters && Array.isArray(p1.npc_letters)) {
          if (!GM._pendingNpcLetters) GM._pendingNpcLetters = [];
          p1.npc_letters.forEach(function(nl) {
            if (!nl.from || !nl.content) return;
            // 验证from是远方NPC
            var _nlCh = findCharByName(nl.from);
            var _cap = GM._capital || '京城';
            if (!_nlCh || _nlCh.location === _cap || _nlCh.isPlayer) return;
            GM._pendingNpcLetters.push({
              from: nl.from,
              type: nl.type || 'report',
              urgency: nl.urgency || 'normal',
              content: nl.content,
              suggestion: nl.suggestion || '',
              replyExpected: nl.replyExpected !== false
            });
            _dbg('[npc_letters] ' + nl.from + ' 主动来书（' + (nl.type||'report') + '）');
          });
        }

        // 处理 NPC 间通信（密谋/结盟/情报交换）
        if (p1.npc_correspondence && Array.isArray(p1.npc_correspondence)) {
          if (!GM._pendingNpcCorrespondence) GM._pendingNpcCorrespondence = [];
          p1.npc_correspondence.forEach(function(nc) {
            if (!nc.from || !nc.to) return;
            GM._pendingNpcCorrespondence.push({
              from: nc.from, to: nc.to,
              content: nc.content||'', summary: nc.summary||'',
              implication: nc.implication||'', type: nc.type||'secret'
            });
            _dbg('[npc_correspondence] ' + nc.from + ' → ' + nc.to + '（' + (nc.type||'secret') + '）');
          });
        }

        // 处理驿路阻断
        if (p1.route_disruptions && Array.isArray(p1.route_disruptions)) {
          if (!GM._routeDisruptions) GM._routeDisruptions = [];
          p1.route_disruptions.forEach(function(rd) {
            if (!rd.route && !rd.from) return;
            var route = rd.route || (rd.from + '-' + rd.to);
            // 检查是否已有该路线的阻断记录
            var existing = GM._routeDisruptions.find(function(d) { return d.route === route && !d.resolved; });
            if (rd.resolved) {
              // 恢复驿路
              if (existing) existing.resolved = true;
              _dbg('[route_disruptions] 驿路恢复：' + route);
            } else if (!existing) {
              GM._routeDisruptions.push({
                route: route, from: rd.from||'', to: rd.to||'',
                reason: rd.reason||'', resolved: false, turn: GM.turn
              });
              _dbg('[route_disruptions] 驿路阻断：' + route + '（' + (rd.reason||'') + '）');
              if (typeof addEB === 'function') addEB('传书', '⚠ 驿路阻断：' + route + (rd.reason ? '（' + rd.reason + '）' : ''));
            }
          });
        }

        // 处理 NPC 间亲疏变化（AI 推演的人际关系变动）
        if (p1.affinity_changes && Array.isArray(p1.affinity_changes)) {
          p1.affinity_changes.forEach(function(ac) {
            if (!ac.a || !ac.b || !ac.delta) return;
            var delta = clamp(parseInt(ac.delta) || 0, -30, 30);
            if (delta !== 0 && typeof AffinityMap !== 'undefined') {
              AffinityMap.add(ac.a, ac.b, delta, ac.reason || 'AI\u63A8\u6F14');
            }
            // 4.2: 存储结构化关系类型
            if (ac.relType) {
              var ch_a = findCharByName(ac.a);
              if (ch_a) {
                if (!ch_a._relationships) ch_a._relationships = {};
                if (!ch_a._relationships[ac.b]) ch_a._relationships[ac.b] = [];
                var existingRel = ch_a._relationships[ac.b].find(function(r){return r.type===ac.relType;});
                if (existingRel) { existingRel.strength = Math.max(-100, Math.min(100, (existingRel.strength||0) + (ac.delta||0))); }
                else { ch_a._relationships[ac.b].push({type: ac.relType, strength: ac.delta||0, since: GM.turn}); }
                // 双向
                var ch_b = findCharByName(ac.b);
                if (ch_b) {
                  if (!ch_b._relationships) ch_b._relationships = {};
                  if (!ch_b._relationships[ac.a]) ch_b._relationships[ac.a] = [];
                  var existingRel2 = ch_b._relationships[ac.a].find(function(r){return r.type===ac.relType;});
                  if (existingRel2) { existingRel2.strength = Math.max(-100, Math.min(100, (existingRel2.strength||0) + (ac.delta||0))); }
                  else { ch_b._relationships[ac.a].push({type: ac.relType, strength: ac.delta||0, since: GM.turn}); }
                }
              }
            }
          });
        }

        // 处理角色目标更新（4.1: NPC动态目标系统）
        if (p1.goal_updates && Array.isArray(p1.goal_updates)) {
          p1.goal_updates.forEach(function(gu) {
            if (!gu.name) return;
            var ch = findCharByName(gu.name);
            if (!ch) return;
            if (!ch.personalGoals) ch.personalGoals = [];
            var action = gu.action || 'update';
            if (action === 'add' || action === 'replace') {
              // 添加新目标或替换已完成的目标
              var newGoal = {
                id: gu.goalId || ('goal_' + Date.now() + '_' + Math.floor(Math.random()*1000)),
                type: gu.type || 'power',
                longTerm: gu.longTerm || gu.goal || '',
                shortTerm: gu.shortTerm || '',
                progress: gu.progress || 0,
                priority: gu.priority || 5,
                context: gu.context || '',
                createdTurn: GM.turn,
                dynamic: true
              };
              if (action === 'replace' && gu.goalId) {
                var idx = ch.personalGoals.findIndex(function(g){return g.id===gu.goalId;});
                if (idx >= 0) ch.personalGoals[idx] = newGoal;
                else ch.personalGoals.push(newGoal);
              } else {
                ch.personalGoals.push(newGoal);
              }
              // 最多3个目标
              if (ch.personalGoals.length > 3) ch.personalGoals = ch.personalGoals.sort(function(a,b){return (b.priority||5)-(a.priority||5);}).slice(0,3);
            } else if (action === 'complete') {
              // 目标达成
              var gi = ch.personalGoals.findIndex(function(g){return g.id===gu.goalId;});
              if (gi >= 0) {
                var completed = ch.personalGoals.splice(gi, 1)[0];
                if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(ch.name, '达成目标：' + completed.longTerm, '喜', 8);
                addEB('目标', ch.name + '达成：' + completed.longTerm);
              }
            } else {
              // update: 更新现有目标的短期目标/进度/上下文
              var existing = gu.goalId ? ch.personalGoals.find(function(g){return g.id===gu.goalId;}) : ch.personalGoals[0];
              if (existing) {
                if (gu.shortTerm) existing.shortTerm = gu.shortTerm;
                if (gu.progress !== undefined) existing.progress = Math.max(0, Math.min(100, gu.progress));
                if (gu.context) existing.context = gu.context;
                if (gu.longTerm) existing.longTerm = gu.longTerm;
              }
            }
            // 兼容旧格式
            ch.personalGoal = ch.personalGoals.length > 0 ? ch.personalGoals[0].longTerm : '';
            _dbg('[Goal] ' + gu.name + ' ' + action + ': ' + (gu.longTerm || gu.shortTerm || gu.goalId));
          });
        }

        // 6.1: 伏笔/回收系统处理
        if (p1.foreshadowing && Array.isArray(p1.foreshadowing)) {
          if (!GM._foreshadowings) GM._foreshadowings = [];
          p1.foreshadowing.forEach(function(fs) {
            if (!fs.content || !fs.action) return;
            if (fs.action === 'plant') {
              var newFs = {
                id: 'fs_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                content: fs.content,
                type: fs.type || 'mystery',
                resolveCondition: fs.resolveCondition || '',
                plantTurn: GM.turn,
                resolved: false
              };
              GM._foreshadowings.push(newFs);
              addEB('\u6697\u7EBF', fs.content.slice(0, 40));
              // 6.1联动编年纪事：在编年面板创建一个"进行中"事件（玩家可见的表层线索）
              if (!GM.biannianItems) GM.biannianItems = [];
              GM.biannianItems.push({
                id: newFs.id,
                name: fs.content.slice(0, 15),
                title: fs.content.slice(0, 15),
                content: fs.content,
                startTurn: GM.turn,
                turn: GM.turn,
                duration: 9999, // 持续到被回收
                date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                _isForeshadow: true // 内部标记
              });
              _dbg('[Foreshadow] plant: ' + fs.content.slice(0, 40));
            } else if (fs.action === 'resolve') {
              // 模糊匹配最佳伏笔
              var bestMatch = null;
              var bestScore = 0;
              GM._foreshadowings.forEach(function(existing) {
                if (existing.resolved) return;
                var score = 0;
                // 内容相似度：简单字符匹配
                var keywords = fs.content.replace(/[，。、！？\s]/g, '').split('');
                var existWords = existing.content.replace(/[，。、！？\s]/g, '');
                keywords.forEach(function(ch) { if (existWords.indexOf(ch) >= 0) score++; });
                if (fs.type && fs.type === existing.type) score += 5;
                if (score > bestScore) { bestScore = score; bestMatch = existing; }
              });
              if (bestMatch && bestScore >= 3) {
                bestMatch.resolved = true;
                bestMatch.resolveTurn = GM.turn;
                bestMatch.resolveContent = fs.content;
                addEB('\u8F6C\u6298', bestMatch.content.slice(0,15) + '\u2192' + fs.content.slice(0, 25));
                if (typeof ChronicleSystem !== 'undefined' && typeof ChronicleSystem.addMonthDraft === 'function') {
                  ChronicleSystem.addMonthDraft(GM.turn, '\u4F0F\u7B14\u56DE\u6536', bestMatch.content + ' \u2192 ' + fs.content);
                }
                // 6.1联动编年纪事：完成对应的biannian事件
                if (GM.biannianItems) {
                  var _bIdx = GM.biannianItems.findIndex(function(b){ return b._isForeshadow && b.id === bestMatch.id; });
                  if (_bIdx >= 0) {
                    GM.biannianItems[_bIdx].duration = GM.turn - GM.biannianItems[_bIdx].startTurn;
                    GM.biannianItems[_bIdx].content = bestMatch.content + ' \u2192 ' + fs.content;
                  }
                }
                _dbg('[Foreshadow] resolve: ' + fs.content.slice(0, 40) + ' matched: ' + bestMatch.content.slice(0, 30));
              } else {
                _dbg('[Foreshadow] resolve failed - no match for: ' + fs.content.slice(0, 40));
              }
            }
          });
          // 动态上限控制
          var _dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
          var _fsLimit = _dpt <= 3 ? 100 : _dpt <= 40 ? 40 : _dpt <= 100 ? 25 : 15;
          var _unresolvedFs = GM._foreshadowings.filter(function(f) { return !f.resolved; });
          if (_unresolvedFs.length > _fsLimit) {
            // 按埋下回合排序，移除最老的
            _unresolvedFs.sort(function(a, b) { return a.plantTurn - b.plantTurn; });
            var _toRemove = _unresolvedFs.length - _fsLimit;
            for (var _ri = 0; _ri < _toRemove; _ri++) {
              _unresolvedFs[_ri].resolved = true;
              _unresolvedFs[_ri].resolveTurn = GM.turn;
              _unresolvedFs[_ri].resolveContent = '\u8D85\u4E0A\u9650\u81EA\u52A8\u79FB\u9664';
              // 清理对应的biannianItem（防止幽灵条目）
              if (GM.biannianItems) {
                var _bci = GM.biannianItems.findIndex(function(b){ return b._isForeshadow && b.id === _unresolvedFs[_ri].id; });
                if (_bci >= 0) GM.biannianItems.splice(_bci, 1);
              }
            }
            _dbg('[Foreshadow] trimmed ' + _toRemove + ' oldest unresolved (limit=' + _fsLimit + ')');
          }
        }

        // 处理时局要务更新
        if (p1.current_issues_update && Array.isArray(p1.current_issues_update)) {
          if (!GM.currentIssues) GM.currentIssues = [];
          p1.current_issues_update.forEach(function(iu) {
            if (!iu.action) return;
            if (iu.action === 'add' && iu.title) {
              var newIssue = {
                id: 'issue_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                title: iu.title,
                category: iu.category || '',
                description: iu.description || '',
                status: 'pending',
                raisedTurn: GM.turn,
                raisedDate: typeof getTSText === 'function' ? getTSText(GM.turn) : ''
              };
              GM.currentIssues.push(newIssue);
              addEB('\u65F6\u5C40', '\u65B0\u8981\u52A1\uFF1A' + iu.title);
              _dbg('[Issues] add: ' + iu.title);
            } else if (iu.action === 'resolve' && iu.id) {
              var _ri = GM.currentIssues.find(function(i) { return i.id === iu.id && i.status === 'pending'; });
              if (_ri) {
                _ri.status = 'resolved';
                _ri.resolvedTurn = GM.turn;
                addEB('\u65F6\u5C40', '\u8981\u52A1\u89E3\u51B3\uFF1A' + _ri.title);
                _dbg('[Issues] resolve: ' + _ri.title);
              }
            } else if (iu.action === 'update' && iu.id) {
              var _ui = GM.currentIssues.find(function(i) { return i.id === iu.id; });
              if (_ui) {
                if (iu.description) _ui.description = iu.description;
                if (iu.title) _ui.title = iu.title;
                if (iu.category) _ui.category = iu.category;
                _dbg('[Issues] update: ' + _ui.title);
              }
            }
          });
        }

        // AI 可以让角色死亡（疾病、战死、暗杀等）
        if (p1.character_deaths && Array.isArray(p1.character_deaths)) {
          p1.character_deaths.forEach(function(cd) {
            if (!cd.name || !cd.reason) return;
            var ch = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(cd.name) : null) || findCharByName(cd.name);
            if (!ch) return;
            ch.alive = false;
            ch.dead = true;
            ch.deathTurn = GM.turn;
            ch.deathReason = cd.reason;
            if (typeof recordCharacterArc === 'function') recordCharacterArc(cd.name, 'death', cd.reason);
            if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(cd.name);
            // 官制同步：将死者从所有 actualHolders 中移除（留占位）
            if (GM.officeTree && typeof _offDismissPerson === 'function') {
              (function _clearDead(ns) {
                ns.forEach(function(n) {
                  if (n.positions) n.positions.forEach(function(p) {
                    if (p.holder === cd.name || (Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){return h && h.name===cd.name;}))) {
                      _offDismissPerson(p, cd.name);
                    }
                  });
                  if (n.subs) _clearDead(n.subs);
                });
              })(GM.officeTree);
            }
            // 相关角色记忆此人之死
            if (typeof NpcMemorySystem !== 'undefined') {
              (GM.chars||[]).forEach(function(c2) {
                if (c2.alive === false || c2.name === cd.name) return;
                var _rel = (c2.faction === ch.faction) || (c2.party === ch.party) || (c2.family && c2.family === ch.family);
                if (_rel) NpcMemorySystem.remember(c2.name, cd.name + '离世：' + cd.reason, '忧', 7, cd.name);
              });
            }
            addEB('\u6B7B\u4EA1', cd.name + '\uFF1A' + cd.reason);
            // 2.6: 事件总线广播角色死亡
            if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: cd.name, reason: cd.reason });
            // 家族影响——仅记录记忆和声望，具体情感反应由AI根据每人性格决定
            if (ch.family) {
              if (GM.families && GM.families[ch.family] && typeof updateFamilyRenown === 'function') {
                updateFamilyRenown(ch.family, -2, cd.name + '\u53BB\u4E16');
              }
              // 族人记住此事（AI根据性格决定悲痛/冷漠/窃喜）
              if (GM.chars && typeof NpcMemorySystem !== 'undefined') {
                GM.chars.forEach(function(fm) {
                  if (fm.alive !== false && fm.family === ch.family && fm.name !== cd.name) {
                    NpcMemorySystem.remember(fm.name, '\u65CF\u4EBA' + cd.name + '\u53BB\u4E16\uFF1A' + cd.reason, '\u5E73', 6, cd.name);
                  }
                });
              }
            }
            // 级联清理：军队统帅引用
            if (GM.armies) {
              GM.armies.forEach(function(army) {
                if (army.commander === cd.name) {
                  army.commander = '';
                  army.commanderTitle = '';
                  army.morale = Math.max(0, (army.morale || 50) - 15); // 主帅阵亡士气骤降
                  addEB('\u519B\u4E8B', army.name + '\u4E3B\u5E05' + cd.name + '\u9635\u4EA1\uFF0C\u58EB\u6C14\u9AA4\u964D');
                }
              });
            }
            // 丁忧/服丧——死者的子女如果在任官员，应离职守丧
            var _deadName = cd.name;
            (GM.chars||[]).forEach(function(c3) {
              if (c3.alive === false || c3.isPlayer) return;
              // 检查是否是死者子女（通过family/father/mother字段）
              var _isChild = (c3.father === _deadName || c3.mother === _deadName);
              if (!_isChild && ch.children && Array.isArray(ch.children)) _isChild = ch.children.indexOf(c3.name) >= 0;
              if (!_isChild) return;
              // 此NPC是死者子女→标记丁忧
              if (c3.officialTitle) {
                c3._mourning = { since: GM.turn, until: GM.turn + 9, parent: _deadName }; // 9回合守丧
                addEB('丁忧', c3.name + '因' + _deadName + '去世而丁忧离职');
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c3.name, '父/母' + _deadName + '去世，丁忧守丧', '悲', 10, _deadName);
                }
                // 生成时局要务——提醒玩家可夺情
                if (GM.currentIssues) {
                  GM.currentIssues.push({
                    id: 'issue_mourning_' + c3.name,
                    title: c3.name + '丁忧——是否夺情？',
                    category: '人事',
                    description: c3.name + '（' + (c3.officialTitle||'') + '）因' + _deadName + '去世须离职守丧约9回合。可通过诏令"夺情"强令其留任，但恐引起朝臣非议。',
                    status: 'pending', raisedTurn: GM.turn,
                    raisedDate: typeof getTSText === 'function' ? getTSText(GM.turn) : ''
                  });
                }
              }
            });
            // 级联清理：若死者是势力首领，标记势力动荡
            if (GM.facs) {
              GM.facs.forEach(function(fac) {
                if (fac.leader === cd.name) {
                  fac.leader = '';
                  addEB('\u52BF\u529B\u52A8\u6001', fac.name + '\u9996\u9886' + cd.name + '\u6B7B\u4EA1\uFF0C\u52BF\u529B\u52A8\u8361');
                  fac.strength = Math.max(0, (fac.strength || 50) - 10);

                  // 封臣级联：宗主首领死亡→所有封臣忠诚度下降
                  if (fac.vassals && fac.vassals.length > 0) {
                    fac.vassals.forEach(function(vn) {
                      var vRuler = GM.chars ? GM.chars.find(function(c) { return c.faction === vn && c.alive !== false && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); }) : null;
                      if (vRuler) {
                        vRuler.loyalty = Math.max(0, (vRuler.loyalty || 50) - 10);
                        addEB('\u5C01\u81E3\u52A8\u6001', vn + '\u5C01\u81E3' + vRuler.name + '\u56E0\u5B97\u4E3B\u4E4B\u6B7B\u5FE0\u8BDA\u5EA6\u4E0B\u964D');
                      }
                    });
                  }

                  // 封臣首领死亡→检查是否世袭
                  if (fac.liege) {
                    // 查找继承人（子嗣或同族）
                    var heir = GM.chars ? GM.chars.find(function(c) {
                      return c.alive !== false && c.faction === fac.name && c.name !== cd.name && (c.parentOf === cd.name || c.father === cd.name);
                    }) : null;
                    if (heir) {
                      fac.leader = heir.name;
                      heir.position = '\u9996\u9886';
                      addEB('\u5C01\u81E3\u7EE7\u627F', fac.name + '\u5C01\u81E3\u7531' + heir.name + '\u7EE7\u627F');
                    } else {
                      addEB('\u5C01\u81E3\u5371\u673A', fac.name + '\u5C01\u81E3\u9996\u9886' + cd.name + '\u6B7B\u4EA1\u4E14\u65E0\u7EE7\u627F\u4EBA\uFF0C\u5C01\u81E3\u5173\u7CFB\u52A8\u6447');
                    }
                  }
                }
              });
            }
            // 级联清理：头衔继承
            if (ch.titles && ch.titles.length > 0) {
              ch.titles.forEach(function(t) {
                if (t.hereditary) {
                  // 查找继承人
                  var _titleHeir = GM.chars ? GM.chars.find(function(c) {
                    return c.alive !== false && c.name !== cd.name && (c.father === cd.name || (c.family && c.family === ch.family));
                  }) : null;
                  if (_titleHeir) {
                    if (!_titleHeir.titles) _titleHeir.titles = [];
                    _titleHeir.titles.push({
                      name: t.name, level: t.level,
                      hereditary: t.hereditary, privileges: t.privileges || [],
                      _suppressed: t._suppressed || [],
                      grantedTurn: GM.turn, grantedBy: cd.name + '(\u7EE7\u627F)'
                    });
                    addEB('\u7EE7\u627F', _titleHeir.name + '\u7EE7\u627F\u4E86' + cd.name + '\u7684' + t.name + '\u7235\u4F4D');
                  } else {
                    addEB('\u7235\u4F4D', cd.name + '\u7684' + t.name + '\u7235\u4F4D\u56E0\u65E0\u7EE7\u627F\u4EBA\u800C\u5E9F\u9664');
                  }
                } else {
                  // 非世袭头衔→朝廷收回
                  addEB('\u7235\u4F4D', cd.name + '\u7684' + t.name + '\u5934\u8854(\u6D41\u5B98)\u7531\u671D\u5EF7\u6536\u56DE');
                }
              });
            }
            // 级联清理：行政区划 governor 免职
            if (P.adminHierarchy) {
              var _akDeath = Object.keys(P.adminHierarchy);
              _akDeath.forEach(function(k) {
                var _ahd = P.adminHierarchy[k];
                if (!_ahd || !_ahd.divisions) return;
                function _removeGov(divs) {
                  divs.forEach(function(d) {
                    if (d.governor === cd.name) {
                      d.governor = '';
                      addEB('\u884C\u653F', d.name + '\u4E3B\u5B98' + cd.name + '\u53BB\u4E16\uFF0C\u804C\u4F4D\u7A7A\u7F3A');
                      // 同步省份
                      if (GM.provinceStats && GM.provinceStats[d.name]) {
                        GM.provinceStats[d.name].governor = '';
                        GM.provinceStats[d.name].corruption = Math.min(100, (GM.provinceStats[d.name].corruption || 20) + 10);
                      }
                    }
                    if (d.children) _removeGov(d.children);
                  });
                }
                _removeGov(_ahd.divisions);
              });
            }
            // 级联清理：配偶死亡→后宫更新
            if (ch.spouse && GM.harem) {
              // 从继承人列表移除该配偶的子嗣（如果子嗣也死了的话由子嗣的死亡事件处理）
              // 从孕期列表移除
              if (GM.harem.pregnancies) {
                GM.harem.pregnancies = GM.harem.pregnancies.filter(function(p) { return p.mother !== cd.name; });
              }
              addEB('\u540E\u5BAB', cd.name + '\u85A8\u901D');
              // 重算继承人（如果有recalculateHeirs函数）
              if (typeof HaremSettlement !== 'undefined' && HaremSettlement.recalculateHeirs) {
                HaremSettlement.recalculateHeirs();
              }
            }
            // 级联清理：继承人死亡→从继承人列表中移除
            if (GM.harem && GM.harem.heirs && GM.harem.heirs.indexOf(cd.name) !== -1) {
              GM.harem.heirs = GM.harem.heirs.filter(function(h) { return h !== cd.name; });
              addEB('\u7EE7\u627F', cd.name + '\u53BB\u4E16\uFF0C\u5DF2\u4ECE\u7EE7\u627F\u4EBA\u5E8F\u5217\u4E2D\u79FB\u9664');
            }
            _dbg('[AI Death] ' + cd.name + ': ' + cd.reason);
            // 1.4→2.6: 叙事事实已由 GameEventBus character:death 监听器自动添加
            // E10: 玩家角色死亡 → 尝试世代传承，否则游戏结束
            if (ch.isPlayer || (P.playerInfo && P.playerInfo.characterName === cd.name)) {
              var _heir = (typeof resolveHeir === 'function') ? resolveHeir(ch) : null;
              if (_heir && _heir.alive !== false) {
                // 世代传承——继承人自动继位
                ch.isPlayer = false;
                _heir.isPlayer = true;
                P.playerInfo.characterName = _heir.name;
                addEB('\u7EE7\u627F', cd.name + '\u9A7E\u5D29\uFF0C' + _heir.name + '\u7EE7\u4F4D');
                if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
                  NpcMemorySystem.addMemory(_heir.name, '\u5148\u5E1D\u9A7E\u5D29\uFF0C\u7EE7\u627F\u5927\u7EDF', 10, 'career');
                }
                // 全部NPC记忆先帝驾崩
                (GM.chars || []).forEach(function(c2) {
                  if (c2.alive !== false && !c2.isPlayer && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
                    NpcMemorySystem.addMemory(c2.name, '\u5148\u5E1D' + cd.name + '\u9A7E\u5D29\uFF0C\u65B0\u541B' + _heir.name + '\u7EE7\u4F4D', 8, 'political');
                  }
                });
                GM._successionEvent = { from: cd.name, to: _heir.name, reason: cd.reason };
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('succession', { from: cd.name, to: _heir.name, reason: cd.reason });
              } else {
                GM._playerDead = true;
                GM._playerDeathReason = cd.reason;
              }
            }
          });
        }

        // 处理AI新增角色（子嗣出生、新投奔者等）
        if (p1.new_characters && Array.isArray(p1.new_characters)) {
          p1.new_characters.forEach(function(nc) {
            if (!nc.name) return;
            // 防止重名
            if (findCharByName(nc.name)) { _dbg('[NewChar] 重名跳过: ' + nc.name); return; }
            var newCh = {
              name: nc.name, title: nc.title || '', age: clamp(parseInt(nc.age) || 0, 0, 120), gender: nc.gender || '',
              faction: nc.faction || (P.playerInfo ? P.playerInfo.factionName : '') || '',
              personality: nc.personality || '', appearance: nc.appearance || '',
              loyalty: 70, ambition: 30,
              intelligence: 40 + Math.floor(random() * 30),
              valor: 30 + Math.floor(random() * 20),
              administration: 30 + Math.floor(random() * 20),
              charisma: 30 + Math.floor(random() * 40),
              diplomacy: 30 + Math.floor(random() * 40),
              alive: true, stress: 0, health: 100, traitIds: [], children: [],
              _memory: [], _memArchive: [], _scars: [], _impressions: {},
              location: nc.location || GM._capital || '',
              parentOf: nc.parentOf || null, bio: nc.reason || '',
              family: nc.family || '', familyTier: nc.familyTier || 'common',
              _createdTurn: GM.turn
            };
            // 子嗣继承父族家族与门第
            if (nc.parentOf && !newCh.family) {
              var _parent = findCharByName(nc.parentOf);
              if (_parent) {
                if (_parent.family) newCh.family = _parent.family;
                if (_parent.familyTier) newCh.familyTier = _parent.familyTier;
              }
            }
            // 如果是子嗣——标记母亲并更新母亲children列表
            if (nc.motherName) {
              var mother = findCharByName(nc.motherName);
              if (mother) {
                if (!mother.children) mother.children = [];
                mother.children.push(nc.name);
                newCh.motherClan = mother.motherClan || mother.faction || '';
                // 子嗣自动加入继承人列表
                if (mother.spouse && GM.harem && nc.gender !== '\u5973') {
                  if (!GM.harem.heirs) GM.harem.heirs = [];
                  GM.harem.heirs.push(nc.name);
                }
              }
            }
            GM.chars.push(newCh);
            // 更新角色索引
            if (GM._indices && GM._indices.charByName) GM._indices.charByName.set(newCh.name, newCh);
            GM.allCharacters.push({name:newCh.name,title:newCh.title,age:newCh.age,gender:newCh.gender,personality:newCh.personality,loyalty:newCh.loyalty,faction:newCh.faction,recruited:true,recruitTurn:GM.turn,source:nc.reason||'\u65B0\u751F'});
            // 加入家族注册表
            if (newCh.family && typeof addToFamily === 'function') addToFamily(newCh.name, newCh.family);
            // 设置血缘关系
            if (newCh.family && newCh.parentOf && typeof setFamilyRelation === 'function') {
              setFamilyRelation(newCh.family, nc.name, newCh.parentOf, '\u7236\u5B50');
            }
            if (newCh.family && nc.motherName && typeof setFamilyRelation === 'function') {
              setFamilyRelation(newCh.family, nc.name, nc.motherName, '\u6BCD\u5B50');
            }
            addEB('\u65B0\u4EBA', nc.name + '\uFF1A' + (nc.reason || '\u65B0\u89D2\u8272'));
            if (typeof recordCharacterArc === 'function') recordCharacterArc(nc.name, 'event', nc.reason || '\u5165\u4E16');
            // 子嗣出生时记入母亲和玩家的记忆
            if (nc.motherName && typeof NpcMemorySystem !== 'undefined') {
              NpcMemorySystem.remember(nc.motherName, '\u8BDE\u4E0B' + (nc.gender === '\u5973' ? '\u516C\u4E3B' : '\u7687\u5B50') + nc.name, '\u559C', 10, nc.name);
              if (P.playerInfo && P.playerInfo.characterName) {
                NpcMemorySystem.remember(P.playerInfo.characterName, nc.motherName + '\u8BDE\u4E0B' + nc.name, '\u559C', 8, nc.motherName);
              }
            }
            _dbg('[NewChar] ' + nc.name + ' (' + (nc.reason || '') + ')');
          });
        }

        // 检测AI叙事中的怀孕事件（从shizhengji中提取）
        if (typeof HaremSettlement !== 'undefined' && GM.chars) {
          var _pregKeywords = /(\S{1,4})(有孕|怀孕|有喜|身怀六甲|珠胎暗结)/;
          var _pregMatch = (shizhengji || '').match(_pregKeywords);
          if (_pregMatch) {
            var _pregMother = findCharByName(_pregMatch[1]);
            if (_pregMother && _pregMother.spouse) {
              HaremSettlement.registerPregnancy(_pregMother.name);
            }
          }
        }

        // 处理角色属性变化（AI直接调整个体角色忠诚/野心等）
        if (p1.char_updates && Array.isArray(p1.char_updates)) {
          var _pNameCU = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.char_updates.forEach(function(cu) {
            if (!cu.name) return;
            var ch = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(cu.name) : null) || findCharByName(cu.name);
            if (!ch) return;
            // ── 玩家保护：玩家角色的决策字段(立场/党派/官职) 不允许 AI 修改 ──
            var _isPlayerTarget = (_pNameCU && cu.name === _pNameCU) || ch.isPlayer;
            if (_isPlayerTarget) {
              // 移除玩家决策字段——只保留状态影响字段(stress/health/能力变化)
              delete cu.new_stance;
              delete cu.new_party;
              delete cu.new_location; // 玩家位置由玩家自行决定
              delete cu.add_traits;
              delete cu.remove_traits;
              // loyalty_delta 对玩家无意义（玩家不会对自己忠诚）
              delete cu.loyalty_delta;
              delete cu.legitimacy_delta;
            }
            if (cu.loyalty_delta) {
              var oldL = ch.loyalty || 50;
              var _loyClamp = (typeof _getModeParams === 'function') ? _getModeParams().loyaltyClamp : 20;
              ch.loyalty = clamp(oldL + clamp(parseInt(cu.loyalty_delta)||0, -_loyClamp, _loyClamp), 0, 100);
              if (Math.abs(cu.loyalty_delta) >= 5) recordChange('characters', cu.name, 'loyalty', oldL, ch.loyalty, cu.reason || 'AI推演');
            }
            if (cu.ambition_delta) {
              ch.ambition = clamp((ch.ambition||50) + clamp(parseInt(cu.ambition_delta)||0, -15, 15), 0, 100);
            }
            if (cu.stress_delta && typeof StressSystem !== 'undefined') {
              ch.stress = clamp((ch.stress||0) + clamp(parseInt(cu.stress_delta)||0, -20, 20), 0, 100);
            }
            // 外交能力变化
            if (cu.diplomacy_delta) {
              ch.diplomacy = clamp((ch.diplomacy||50) + clamp(parseInt(cu.diplomacy_delta)||0, -15, 15), 0, 100);
            }
            // 其余 7 维能力变化（AI可根据经历调整）
            ['intelligence','valor','military','administration','management','charisma','benevolence'].forEach(function(_dim) {
              var _deltaKey = _dim + '_delta';
              if (cu[_deltaKey]) {
                ch[_dim] = clamp((ch[_dim]||50) + clamp(parseInt(cu[_deltaKey])||0, -15, 15), 0, 100);
              }
            });
            // 特质增删（如经历事件后新获特质/失去特质）
            if (Array.isArray(cu.add_traits) && cu.add_traits.length) {
              if (!Array.isArray(ch.traits)) ch.traits = [];
              cu.add_traits.forEach(function(tid) {
                if (typeof TRAIT_LIBRARY === 'undefined' || !TRAIT_LIBRARY[tid]) return;
                // 自动移除冲突特质
                if (typeof traitsConflict === 'function') {
                  ch.traits = ch.traits.filter(function(x) { return !traitsConflict(x, tid); });
                }
                if (ch.traits.indexOf(tid) < 0) ch.traits.push(tid);
              });
            }
            if (Array.isArray(cu.remove_traits) && cu.remove_traits.length && Array.isArray(ch.traits)) {
              ch.traits = ch.traits.filter(function(tid) { return cu.remove_traits.indexOf(tid) < 0; });
            }
            // 正统性变化
            if (cu.legitimacy_delta) {
              ch.legitimacy = clamp((ch.legitimacy||50) + clamp(parseInt(cu.legitimacy_delta)||0, -20, 20), 0, 100);
            }
            // 所在地变更（如被外派、流放、召回京城等）
            if (cu.new_location && typeof cu.new_location === 'string') {
              var _oldLoc = ch.location || GM._capital || '京城';
              ch.location = cu.new_location;
              ch._locationExplicit = false; // AI设置的非编辑器显式
              if (_oldLoc !== cu.new_location) {
                recordChange('characters', cu.name, 'location', _oldLoc, cu.new_location, cu.reason || 'AI推演');
                if (typeof addEB === 'function') addEB('人事', cu.name + '从' + _oldLoc + '赴' + cu.new_location);
              }
            }
            // 立场变化
            if (cu.new_stance && typeof cu.new_stance === 'string') {
              ch.stance = cu.new_stance;
            }
            // 党派变化
            if (cu.new_party !== undefined) {
              ch.party = cu.new_party || '';
            }
            // 压力-特质挂钩
            if (cu.action_type && typeof StressTraitSystem !== 'undefined') {
              var _stressDelta = StressTraitSystem.evaluateStress(ch, cu.action_type);
              if (_stressDelta !== 0) {
                ch.stress = clamp((ch.stress||0) + _stressDelta, 0, 100);
              }
            }
            // NPC记忆：记录重大变化
            if (typeof NpcMemorySystem !== 'undefined' && cu.reason) {
              var _emo = '平';
              if (cu.loyalty_delta && cu.loyalty_delta < -5) _emo = '怒';
              else if (cu.loyalty_delta && cu.loyalty_delta > 5) _emo = '喜';
              else if (cu.stress_delta && cu.stress_delta > 5) _emo = '忧';
              var _imp = Math.min(10, Math.max(1, Math.abs(cu.loyalty_delta||0) + Math.abs(cu.stress_delta||0)));
              if (_imp >= 3) NpcMemorySystem.remember(cu.name, cu.reason, _emo, _imp, '天子');
            }
          });
        }

        // 处理势力变化
        if (p1.faction_changes && Array.isArray(p1.faction_changes)) {
          p1.faction_changes.forEach(function(fc) {
            if (!fc.name) return;
            var fac = (typeof _fuzzyFindFac === 'function' ? _fuzzyFindFac(fc.name) : null) || findFacByName(fc.name);
            if (!fac) return;
            if (fc.strength_delta) {
              var oldS = fac.strength || 50;
              var _strClamp = (typeof _getModeParams === 'function') ? _getModeParams().strengthClamp * 2 : 20;
              fac.strength = clamp(oldS + clamp(parseInt(fc.strength_delta)||0, -_strClamp, _strClamp), 0, 100);
              recordChange('factions', fc.name, 'strength', oldS, fac.strength, fc.reason || 'AI\u63A8\u6F14');
            }
            if (fc.economy_delta) {
              fac.economy = clamp((fac.economy || 50) + clamp(parseInt(fc.economy_delta)||0, -20, 20), 0, 100);
            }
            if (fc.playerRelation_delta) {
              fac.playerRelation = clamp((fac.playerRelation || 0) + clamp(parseInt(fc.playerRelation_delta)||0, -30, 30), -100, 100);
            }
            // 势力覆灭级联（在所有delta处理完毕后检查）
            if (fac.strength <= 0 && !fac.destroyed) {
              fac.destroyed = true;
              addEB('\u52BF\u529B\u52A8\u6001', fc.name + '\u5DF2\u8986\u706D\uFF1A' + (fc.reason || ''));
              if (typeof GameEventBus !== 'undefined') GameEventBus.emit('faction:defeated', { name: fc.name, reason: fc.reason || '' });
              if (GM.chars) {
                GM.chars.forEach(function(c) {
                  if (c.alive !== false && c.faction === fc.name) {
                    c.faction = '';
                    if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '\u6240\u5C5E\u52BF\u529B' + fc.name + '\u8986\u706D', '\u5FE7', 8);
                  }
                });
              }
              if (GM.armies) {
                GM.armies.forEach(function(a) {
                  if (a.faction === fc.name && !a.destroyed) {
                    a.morale = Math.max(0, (a.morale || 50) - 30);
                    addEB('\u519B\u4E8B', a.name + '\u56E0\u52BF\u529B\u8986\u706D\u58EB\u6C14\u5D29\u6E83');
                  }
                });
              }
            }
          });
        }

        // ── 处理势力自治事件 ──
        // 条约违约检测
        if (p1.faction_events && typeof TreatySystem !== 'undefined' && TreatySystem.checkViolations) {
          TreatySystem.checkViolations(p1.faction_events);
        }
        if (p1.faction_events && Array.isArray(p1.faction_events)) {
          p1.faction_events.forEach(function(fe) {
            if (!fe.actor || !fe.action) return;
            var evt = { turn: GM.turn, actor: fe.actor, target: fe.target || '', action: fe.action, result: fe.result || '' };
            if (!GM.factionEvents) GM.factionEvents = [];
            GM.factionEvents.push(evt);
            // 防止无限增长——保留最近100条
            if (GM.factionEvents.length > 100) GM.factionEvents = GM.factionEvents.filter(function(e) { return e.turn >= GM.turn - 5; });
            // 内政事件的strength_effect自动应用
            var _seVal = parseFloat(fe.strength_effect);
            if (!isNaN(_seVal) && _seVal !== 0) {
              var _seFac = findFacByName(fe.actor);
              if (_seFac) {
                _seFac.strength = clamp((_seFac.strength||50) + clamp(_seVal, -10, 10), 0, 100);
              }
            }
            // 分类事件日志
            var _feTag = fe.actionType ? fe.actionType : (fe.target ? '外交' : '内政');
            addEB('势力·' + _feTag, fe.actor + (fe.target ? '→' + fe.target : '') + '：' + fe.action + (fe.result ? '(' + fe.result + ')' : ''));
            _dbg('[FactionEvent/' + _feTag + '] ' + fe.actor + ' → ' + (fe.target || '自身') + ': ' + fe.action);

            // ── 机械系统自动路由 ──
            var _act = (fe.action || '').toLowerCase();
            // 宣战 → CasusBelliSystem
            if ((_act.indexOf('宣战') >= 0 || _act.indexOf('开战') >= 0) && fe.target) {
              if (typeof CasusBelliSystem !== 'undefined') CasusBelliSystem.declareWar(fe.actor, fe.target, fe.casusBelli || 'none');
              if (typeof GameEventBus !== 'undefined') GameEventBus.emit('war:start', {attacker: fe.actor, defender: fe.target, reason: fe.action});
            }
            // 结盟/和亲/朝贡/互市 → TreatySystem
            if (typeof TreatySystem !== 'undefined') {
              if (_act.indexOf('结盟') >= 0 || _act.indexOf('同盟') >= 0) TreatySystem.createTreaty('alliance', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('和亲') >= 0) TreatySystem.createTreaty('marriage', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('朝贡') >= 0) TreatySystem.createTreaty('tribute', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('互市') >= 0) TreatySystem.createTreaty('trade', fe.actor, fe.target || '', fe.terms);
              else if (_act.indexOf('停战') >= 0 || _act.indexOf('讲和') >= 0) TreatySystem.createTreaty('truce', fe.actor, fe.target || '', fe.terms);
            }
            // 行军 → MarchSystem
            if ((_act.indexOf('行军') >= 0 || _act.indexOf('调军') >= 0 || _act.indexOf('进军') >= 0) && typeof MarchSystem !== 'undefined' && MarchSystem._getConfig().enabled) {
              var _marchArmy = (GM.armies||[]).find(function(a) { return a.name === fe.actor || a.faction === fe.actor; });
              if (_marchArmy && fe.target) {
                MarchSystem.createMarchOrder(_marchArmy, _marchArmy.garrison || _marchArmy.location || fe.actor, fe.target, fe.geoData || null);
              }
            }
            // 政变/叛乱 → 势力实力大幅变动
            if (_act.indexOf('政变') >= 0 || _act.indexOf('叛乱') >= 0 || _act.indexOf('篡位') >= 0) {
              var _coupFac = findFacByName(fe.actor);
              if (_coupFac) {
                _coupFac.strength = Math.max(5, (_coupFac.strength||50) - 15); // 内部动荡大减实力
                if (fe.result && (fe.result.indexOf('成功') >= 0 || fe.result.indexOf('胜') >= 0)) {
                  // 政变成功——可能更换首领
                  if (fe.newLeader) _coupFac.leader = fe.newLeader;
                  _coupFac.strength = Math.min(100, (_coupFac.strength||30) + 10); // 稳定后回升
                }
              }
            }
            // 改革 → 实力缓慢提升（但可能引发内部不满）
            if (_act.indexOf('改革') >= 0 || _act.indexOf('变法') >= 0) {
              var _reformFac = findFacByName(fe.actor);
              if (_reformFac) _reformFac.strength = Math.min(100, (_reformFac.strength||50) + 2);
            }
            // 征兵 → 军事力量增长
            if (_act.indexOf('征兵') >= 0 || _act.indexOf('扩军') >= 0) {
              var _recFac = findFacByName(fe.actor);
              if (_recFac && _recFac.militaryStrength) {
                _recFac.militaryStrength = Math.round(_recFac.militaryStrength * 1.1);
              }
            }
            // 围城 → SiegeSystem
            if ((_act.indexOf('围城') >= 0 || _act.indexOf('攻城') >= 0 || _act.indexOf('围困') >= 0) && typeof SiegeSystem !== 'undefined' && SiegeSystem._getConfig().enabled) {
              var _siegeArmy = (GM.armies||[]).find(function(a) { return a.name === fe.actor || a.faction === fe.actor; });
              if (_siegeArmy) {
                // 三层读取：AI事件字段 → AI geoData → 地图区域 → 默认值
                var _siegeRegion = (P.map&&P.map.regions||[]).find(function(r){return (r.id||r.name)===fe.target;});
                var _geo = fe.geoData || {};
                var _siegeFort = fe.fortLevel || _geo.fortLevel || (_siegeRegion ? (_siegeRegion.passLevel||0) : 2);
                var _siegeGarrison = fe.garrison || _geo.garrison || (_siegeRegion ? (_siegeRegion.troops||3000) : 3000);
                SiegeSystem.createSiege(_siegeArmy, fe.target || '未知城池', _siegeFort, _siegeGarrison);
              }
            }
          });
        }

        // ── 处理势力间关系变化 ──
        if (p1.faction_relation_changes && Array.isArray(p1.faction_relation_changes)) {
          if (!GM.factionRelations) GM.factionRelations = [];
          p1.faction_relation_changes.forEach(function(rc) {
            if (!rc.from || !rc.to) return;
            var delta = parseInt(rc.delta) || 0;
            // 查找已有关系
            var existing = GM.factionRelations.find(function(r) { return r.from === rc.from && r.to === rc.to; });
            if (existing) {
              if (rc.type) existing.type = rc.type;
              existing.value = clamp((existing.value || 0) + delta, -100, 100);
              if (rc.reason) existing.desc = rc.reason;
            } else {
              GM.factionRelations.push({ from: rc.from, to: rc.to, type: rc.type || '中立', value: clamp(delta, -100, 100), desc: rc.reason || '' });
            }
            // 双向：自动创建反向关系（如果不存在）
            var reverse = GM.factionRelations.find(function(r) { return r.from === rc.to && r.to === rc.from; });
            if (!reverse) {
              GM.factionRelations.push({ from: rc.to, to: rc.from, type: rc.type || '中立', value: clamp(delta, -100, 100), desc: rc.reason || '' });
            } else {
              // 反向也受影响（幅度减半）
              reverse.value = clamp((reverse.value || 0) + Math.round(delta * 0.5), -100, 100);
            }
            _dbg('[FactionRelChange] ' + rc.from + '→' + rc.to + ' ' + (rc.type || '') + ' ' + delta + ' ' + (rc.reason || ''));
          });
          // 防止无限增长——合并重复关系对，保留最新值
          if (GM.factionRelations && GM.factionRelations.length > 200) {
            var _relMap = {};
            GM.factionRelations.forEach(function(r) { _relMap[r.from + '→' + r.to] = r; });
            GM.factionRelations = Object.values(_relMap);
          }
        }

        // 处理党派变化
        if (p1.party_changes && Array.isArray(p1.party_changes)) {
          p1.party_changes.forEach(function(pc) {
            if (!pc.name) return;
            var party = null;
            if (GM.parties) GM.parties.forEach(function(p) { if (p.name === pc.name) party = p; });
            if (!party) return;
            if (pc.influence_delta) {
              var oldI = party.influence || 50;
              party.influence = clamp(oldI + clamp(parseInt(pc.influence_delta)||0, -20, 20), 0, 100);
              recordChange('parties', pc.name, 'influence', oldI, party.influence, pc.reason || 'AI\u63A8\u6F14');
            }
            if (pc.new_status) { party.status = pc.new_status; addEB('\u515A\u6D3E', pc.name + '\u72B6\u6001\u53D8\u4E3A' + pc.new_status); }
            if (pc.new_leader) { party.leader = pc.new_leader; addEB('\u515A\u6D3E', pc.name + '\u65B0\u9996\u9886:' + pc.new_leader); }
            if (pc.new_agenda) party.currentAgenda = pc.new_agenda;
            if (pc.new_shortGoal) party.shortGoal = pc.new_shortGoal;
          });
        }

        // 处理阶层变化
        if (p1.class_changes && Array.isArray(p1.class_changes)) {
          p1.class_changes.forEach(function(cc) {
            if (!cc.name) return;
            var cls = null;
            if (GM.classes) GM.classes.forEach(function(c) { if (c.name === cc.name) cls = c; });
            if (!cls) return;
            if (cc.satisfaction_delta) {
              var oldS = parseInt(cls.satisfaction) || 50;
              cls.satisfaction = clamp(oldS + clamp(parseInt(cc.satisfaction_delta)||0, -20, 20), 0, 100);
              recordChange('classes', cc.name, 'satisfaction', oldS, cls.satisfaction, cc.reason || 'AI\u63A8\u6F14');
            }
            if (cc.influence_delta) {
              var oldI = parseInt(cls.influence || cls.classInfluence) || 50;
              cls.influence = clamp(oldI + clamp(parseInt(cc.influence_delta)||0, -20, 20), 0, 100);
              recordChange('classes', cc.name, 'influence', oldI, cls.influence, cc.reason || 'AI\u63A8\u6F14');
            }
            if (cc.new_demands) cls.demands = cc.new_demands;
            if (cc.new_status) cls.status = cc.new_status;
          });
        }

        // 处理部队变化
        if (p1.army_changes && Array.isArray(p1.army_changes)) {
          p1.army_changes.forEach(function(ac) {
            if (!ac.name) return;
            var army = GM.armies ? GM.armies.find(function(a) { return a.name === ac.name; }) : null;
            if (!army) return;
            if (ac.soldiers_delta) {
              var oldS = army.soldiers || 0;
              army.soldiers = Math.max(0, oldS + (parseInt(ac.soldiers_delta) || 0));
              recordChange('military', ac.name, 'soldiers', oldS, army.soldiers, ac.reason || 'AI推演');
              // 部队全灭
              if (army.soldiers <= 0) { army.destroyed = true; addEB('军事', ac.name + '全军覆没：' + (ac.reason || '')); }
            }
            if (ac.morale_delta) {
              var oldM = army.morale || 50;
              army.morale = clamp(oldM + clamp(parseInt(ac.morale_delta) || 0, -30, 30), 0, 100);
              recordChange('military', ac.name, 'morale', oldM, army.morale, ac.reason || 'AI推演');
            }
            if (ac.training_delta) {
              var oldT = army.training || 50;
              army.training = clamp(oldT + clamp(parseInt(ac.training_delta) || 0, -20, 20), 0, 100);
            }
            // 5.2: AI调兵——设置行军目的地
            if (ac.destination && typeof ac.destination === 'string') {
              army.destination = ac.destination;
              army._remainingDistance = 0; // 重置，armyMarch pipeline会重新计算
              addEB('\u884C\u519B', ac.name + '\u63A5\u4EE4\u8C03\u5F80' + ac.destination);
            }
          });
        }

        // 处理物品变动
        if (p1.item_changes && Array.isArray(p1.item_changes)) {
          p1.item_changes.forEach(function(ic) {
            if (!ic.name) return;
            var item = GM.items ? GM.items.find(function(it) { return it.name === ic.name; }) : null;
            if (!item) return;
            var wasAcquired = item.acquired;
            if (ic.acquired !== undefined) item.acquired = !!ic.acquired;
            if (ic.owner !== undefined) item.owner = ic.owner;
            if (item.acquired && !wasAcquired) {
              addEB('\u7269\u54C1', '\u83B7\u5F97' + ic.name + (ic.reason ? '\uFF1A' + ic.reason : ''));
            } else if (!item.acquired && wasAcquired) {
              addEB('\u7269\u54C1', '\u5931\u53BB' + ic.name + (ic.reason ? '\uFF1A' + ic.reason : ''));
            }
          });
        }

        // 处理时代状态变动
        if (p1.era_state_delta && GM.eraState) {
          ['socialStability','economicProsperity','centralControl','militaryProfessionalism','culturalVibrancy','bureaucracyStrength'].forEach(function(key) {
            var dk = key + '_delta';
            if (p1.era_state_delta[dk]) {
              var d = parseFloat(p1.era_state_delta[dk]) || 0;
              d = Math.max(-0.1, Math.min(0.1, d)); // 每回合最大±10%
              var oldV = GM.eraState[key] || 0.5;
              GM.eraState[key] = Math.max(0, Math.min(1, oldV + d));
            }
          });
          // 朝代阶段可由AI直接调整
          if (p1.era_state_delta.dynastyPhase) GM.eraState.dynastyPhase = p1.era_state_delta.dynastyPhase;
        }

        // 处理全局状态指标变动（税压）
        if (p1.global_state_delta) {
          var gsd = p1.global_state_delta;
          if (gsd.taxPressure_delta) GM.taxPressure = clamp((GM.taxPressure||50) + clamp(parseInt(gsd.taxPressure_delta)||0, -15, 15), 0, 100);
        }

        // 处理官制占位实体化（将 generated:false 占位变成真角色）
        if (p1.office_spawn && Array.isArray(p1.office_spawn) && GM.officeTree) {
          var _spawnedCount = 0;
          p1.office_spawn.forEach(function(sp) {
            if (!sp || !sp.dept || !sp.position || !sp.holderName) return;
            if (_spawnedCount >= 5) return; // 单回合上限
            // 重名校验
            if (findCharByName(sp.holderName)) {
              _dbg('[office_spawn] 跳过：姓名重复 ' + sp.holderName);
              return;
            }
            // 递归找 position
            var targetPos = null, targetDept = null;
            (function walk(ns, deptChain) {
              ns.forEach(function(n) {
                if (!n) return;
                var chain = deptChain ? deptChain + '·' + n.name : n.name;
                if ((n.name === sp.dept || chain.indexOf(sp.dept) >= 0) && Array.isArray(n.positions)) {
                  var found = n.positions.find(function(p){ return p && p.name === sp.position; });
                  if (found && !targetPos) { targetPos = found; targetDept = n; }
                }
                if (n.subs) walk(n.subs, chain);
              });
            })(GM.officeTree, '');
            if (!targetPos) {
              _dbg('[office_spawn] 未找到 ' + sp.dept + '·' + sp.position);
              return;
            }
            if (!Array.isArray(targetPos.actualHolders)) targetPos.actualHolders = [];
            // 找第一个 generated:false 占位
            var slot = targetPos.actualHolders.find(function(h){ return h && h.generated === false; });
            if (!slot) {
              _dbg('[office_spawn] ' + sp.position + ' 无占位可实体化');
              return;
            }
            // 实体化占位
            slot.name = sp.holderName;
            slot.generated = true;
            slot.spawnedTurn = GM.turn;
            // 双向同步老字段（双层模型）
            if (!targetPos.holder) {
              targetPos.holder = sp.holderName;
            } else if (targetPos.holder !== sp.holderName) {
              if (!Array.isArray(targetPos.additionalHolders)) targetPos.additionalHolders = [];
              if (targetPos.additionalHolders.indexOf(sp.holderName) < 0) targetPos.additionalHolders.push(sp.holderName);
            }
            // 更新 actualCount（具象+占位共计）
            var _totalActual = targetPos.actualHolders.length;
            if (targetPos.actualCount == null || targetPos.actualCount < _totalActual) targetPos.actualCount = _totalActual;
            // 创建角色
            var abilities = sp.abilities || {};
            var newChar = {
              name: sp.holderName,
              title: targetDept.name + sp.position,
              officialTitle: sp.position,
              age: parseInt(sp.age, 10) || 35,
              gender: 'male',
              faction: (P.playerInfo && P.playerInfo.factionName) || '',
              stance: sp.stance || '中立',
              loyalty: Math.max(0, Math.min(100, parseInt(sp.loyalty, 10) || 50)),
              intelligence: Math.max(1, Math.min(100, parseInt(abilities.intelligence, 10) || 50)),
              administration: Math.max(1, Math.min(100, parseInt(abilities.administration, 10) || 50)),
              military: Math.max(1, Math.min(100, parseInt(abilities.military, 10) || 40)),
              valor: Math.max(1, Math.min(100, parseInt(abilities.valor, 10) || 40)),
              charisma: Math.max(1, Math.min(100, parseInt(abilities.charisma, 10) || 50)),
              diplomacy: Math.max(1, Math.min(100, parseInt(abilities.diplomacy, 10) || 50)),
              benevolence: Math.max(1, Math.min(100, parseInt(abilities.benevolence, 10) || 50)),
              personality: sp.personality || '',
              alive: true,
              _spawnedFromOffice: { dept: targetDept.name, position: sp.position, turn: GM.turn, reason: sp.reason || '' }
            };
            if (!Array.isArray(GM.chars)) GM.chars = [];
            GM.chars.push(newChar);
            _spawnedCount++;
            addEB('\u5B98\u5236', '\u3010\u5B9E\u4F53\u5316\u3011' + sp.holderName + '\u5C31\u4EFB' + targetDept.name + sp.position + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
            if (GM.qijuHistory) {
              GM.qijuHistory.unshift({
                turn: GM.turn,
                date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
                content: '\u3010\u5B98\u5236\u5B9E\u4F53\u3011\u900F\u8FC7\u63A8\u6F14\u6D89\u53CA\uFF0C' + targetDept.name + sp.position + '\u4E4B\u4F4D\u4E4B\u4EFB\u804C\u8005' + sp.holderName + '\u6D6E\u51FA\u53F2\u4E0B\u3002' + (sp.reason || ''),
                category: '\u5B98\u5236'
              });
            }
          });
        }

        // ── 党派议程演进 ──
        if (p1.party_agenda_shift && Array.isArray(p1.party_agenda_shift) && GM.parties) {
          p1.party_agenda_shift.forEach(function(sh) {
            if (!sh || !sh.party) return;
            var pObj = GM.parties.find(function(p){return p.name === sh.party;});
            if (!pObj) return;
            var old = pObj.currentAgenda || sh.oldAgenda || '';
            pObj.currentAgenda = sh.newAgenda || pObj.currentAgenda;
            if (sh.influence_delta) pObj.influence = Math.max(0, Math.min(100, (pObj.influence||50) + parseFloat(sh.influence_delta)));
            if (!Array.isArray(pObj.agenda_history)) pObj.agenda_history = [];
            pObj.agenda_history.push({ turn: GM.turn, agenda: sh.newAgenda || '', outcome: sh.reason || '', prev: old });
            if (pObj.agenda_history.length > 20) pObj.agenda_history = pObj.agenda_history.slice(-20);
            addEB('\u515A\u4E89', sh.party + '\u8BAE\u7A0B\u8F6C\u5411\u300C' + (sh.newAgenda || '') + '\u300D' + (sh.reason ? '\uFF08' + sh.reason + '\uFF09' : ''));
          });
        }

        // ── 党派分裂 ──
        if (p1.party_splinter && Array.isArray(p1.party_splinter) && GM.parties) {
          p1.party_splinter.forEach(function(sp) {
            if (!sp || !sp.parent || !sp.newName) return;
            var parent = GM.parties.find(function(p){return p.name === sp.parent;});
            if (!parent) return;
            if (GM.parties.some(function(p){return p.name === sp.newName;})) return;
            var newParty = {
              name: sp.newName,
              ideology: sp.ideology || parent.ideology || '',
              leader: sp.newLeader || '',
              influence: Math.floor((parent.influence||50) * 0.4),
              status: '活跃',
              splinterFrom: parent.name,
              cohesion: 70,
              agenda_history: [{ turn: GM.turn, agenda: '立派', outcome: sp.reason||'' }],
              socialBase: parent.socialBase ? JSON.parse(JSON.stringify(parent.socialBase)) : [],
              memberCount: (sp.members && sp.members.length) || 0,
              description: '自' + parent.name + '分裂，' + (sp.reason||''),
              _createdTurn: GM.turn
            };
            GM.parties.push(newParty);
            parent.influence = Math.max(5, (parent.influence||50) - 15);
            parent.cohesion = Math.max(10, (parent.cohesion||60) - 15);
            // 迁移成员
            if (Array.isArray(sp.members) && GM.chars) {
              sp.members.forEach(function(nm) {
                var ch = findCharByName(nm);
                if (ch && ch.party === parent.name) ch.party = sp.newName;
              });
            }
            addEB('\u515A\u4E89', '\u3010\u5206\u88C2\u3011' + parent.name + '\u5206\u88C2\u51FA' + sp.newName + (sp.reason ? '\uFF08' + sp.reason + '\uFF09' : ''));
          });
        }

        // ── 党派合流 ──
        if (p1.party_merge && Array.isArray(p1.party_merge) && GM.parties) {
          p1.party_merge.forEach(function(mg) {
            if (!mg || !mg.absorber || !mg.absorbed) return;
            var abs = GM.parties.find(function(p){return p.name === mg.absorber;});
            var absd = GM.parties.find(function(p){return p.name === mg.absorbed;});
            if (!abs || !absd) return;
            abs.influence = Math.min(100, (abs.influence||50) + Math.floor((absd.influence||50) * 0.5));
            abs.memberCount = (abs.memberCount||0) + (absd.memberCount||0);
            absd.mergedWith = abs.name;
            absd.status = '已解散';
            // 迁移成员
            if (GM.chars) GM.chars.forEach(function(c){ if (c.party === absd.name) c.party = abs.name; });
            // 从 parties 中移除被吸收方
            GM.parties = GM.parties.filter(function(p){return p.name !== absd.name || p.mergedWith;});
            addEB('\u515A\u4E89', '\u3010\u5408\u6D41\u3011' + absd.name + '\u5E76\u5165' + abs.name + (mg.reason ? '\uFF08' + mg.reason + '\uFF09' : ''));
          });
        }

        // ── 势力继承事件 ──
        if (p1.faction_succession && Array.isArray(p1.faction_succession) && GM.facs) {
          p1.faction_succession.forEach(function(sc) {
            if (!sc || !sc.faction || !sc.newLeader) return;
            var fObj = GM.facs.find(function(f){return f.name === sc.faction;});
            if (!fObj) return;
            var oldLeader = fObj.leader;
            fObj.leader = sc.newLeader;
            if (fObj.leaderInfo) fObj.leaderInfo.name = sc.newLeader;
            if (!fObj.succession) fObj.succession = { rule: 'primogeniture', designatedHeir: '', stability: 60 };
            fObj.succession.stability = Math.max(0, Math.min(100, (fObj.succession.stability||60) + (parseInt(sc.stability_delta)||0)));
            if (!Array.isArray(fObj.historicalEvents)) fObj.historicalEvents = [];
            fObj.historicalEvents.push({ turn: GM.turn, event: sc.disputeType || '继承', impact: oldLeader + '→' + sc.newLeader });
            addEB('\u7EE7\u627F', '\u3010' + sc.faction + '\u3011' + (oldLeader||'?') + '\u2192' + sc.newLeader + '(' + (sc.disputeType||'\u6B63\u5E38\u7EE7\u627F') + ')' + (sc.narrative ? '\uFF1A' + sc.narrative.slice(0,80) : ''));
            if (GM.qijuHistory) {
              GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u7EE7\u627F\u4E8B\u3011' + sc.faction + '\uFF1A' + sc.narrative, category: '\u52BF\u529B' });
            }
          });
        }

        // ── 问对承诺进展更新 ──
        if (p1.commitment_update && Array.isArray(p1.commitment_update) && GM._npcCommitments) {
          p1.commitment_update.forEach(function(cu) {
            if (!cu || !cu.id) return;
            // 遍历找到对应承诺
            var found = null, foundNpc = null;
            Object.keys(GM._npcCommitments).forEach(function(nm) {
              (GM._npcCommitments[nm]||[]).forEach(function(c) {
                if (c.id === cu.id) { found = c; foundNpc = nm; }
              });
            });
            if (!found) return;
            // 若 AI 指定了 npcName 但与实际不符，以实际为准
            var npcActual = cu.npcName || foundNpc;
            found.progress = Math.max(0, Math.min(100, (found.progress||0) + (parseInt(cu.progress_delta,10)||0)));
            if (cu.status) found.status = cu.status;
            if (cu.feedback) found.feedback = cu.feedback;
            found.lastUpdateTurn = GM.turn;
            // 完成/失败处理
            if (found.status === 'completed' || found.consequenceType === 'success') {
              found.status = 'completed';
              addEB('\u95EE\u5BF9\u00B7\u5C65\u884C', foundNpc + '\u4EAB\u606F\uFF1A' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0, 40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '履命完成：' + found.task + '——' + (cu.feedback||''), '慰', 5);
              // 忠诚奖励
              var _cch = findCharByName(foundNpc);
              if (_cch) _cch.loyalty = Math.min(100, (_cch.loyalty||50) + 3);
            } else if (found.status === 'failed' || cu.consequenceType === 'abandoned') {
              found.status = 'failed';
              addEB('\u95EE\u5BF9\u00B7\u5931\u8BFA', foundNpc + '\u672A\u5C65\uFF1A' + found.task.slice(0,30) + '——' + (cu.feedback||'').slice(0,40));
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(foundNpc, '未履命：' + found.task + '——' + (cu.feedback||''), '忧', 5);
              var _fch = findCharByName(foundNpc);
              if (_fch) { _fch.loyalty = Math.max(0, (_fch.loyalty||50) - 3); _fch.stress = Math.min(100, (_fch.stress||0) + 5); }
            } else if (cu.feedback) {
              addEB('\u95EE\u5BF9\u00B7\u8FDB\u5C55', foundNpc + '：' + (cu.feedback||'').slice(0,50));
            }
            // 写入起居注
            if (GM.qijuHistory && cu.feedback) {
              GM.qijuHistory.unshift({
                turn: GM.turn,
                date: typeof getTSText==='function'?getTSText(GM.turn):'',
                content: '【问对·履命】' + foundNpc + '就「' + found.task + '」：' + cu.feedback,
                category: '问对'
              });
            }
            // 完成/失败的承诺保留在 list 但状态终结；deadline 过期未完成自动标 failed
            if (found.status === 'pending' || found.status === 'executing' || found.status === 'delayed') {
              var elapsed = GM.turn - found.assignedTurn;
              if (elapsed > (found.deadline || 3) + 2 && found.progress < 50) {
                found.status = 'failed';
                addEB('\u95EE\u5BF9\u00B7\u8FC7\u671F', foundNpc + '迟迟未办：' + found.task.slice(0,30));
              }
            }
          });
        }

        // ── 起义前兆（酝酿期） ──
        if (p1.revolt_precursor && Array.isArray(p1.revolt_precursor)) {
          if (!Array.isArray(GM._revoltPrecursors)) GM._revoltPrecursors = [];
          p1.revolt_precursor.forEach(function(pc) {
            if (!pc || !pc.class || !pc.indicator) return;
            GM._revoltPrecursors.push({
              turn: GM.turn, class: pc.class, region: pc.region || '',
              indicator: pc.indicator, severity: pc.severity || 'mild',
              detail: pc.detail || '', couldLeadTo: pc.couldLeadTo || ''
            });
            // 老前兆自动过期（>15 回合）
            GM._revoltPrecursors = GM._revoltPrecursors.filter(function(p){return GM.turn - p.turn < 15;});
            // 推动 unrestLevels 下降（对应阶层）
            var _cObj = (GM.classes||[]).find(function(c){return c.name === pc.class;});
            if (_cObj) {
              if (!_cObj.unrestLevels) _cObj.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
              var _drop = pc.severity === 'critical' ? 10 : pc.severity === 'severe' ? 5 : 2;
              _cObj.unrestLevels.grievance = Math.max(0, (_cObj.unrestLevels.grievance||60) - _drop);
              if (pc.severity !== 'mild') _cObj.unrestLevels.petition = Math.max(0, (_cObj.unrestLevels.petition||70) - _drop * 0.7);
              if (pc.severity === 'critical') _cObj.unrestLevels.revolt = Math.max(0, (_cObj.unrestLevels.revolt||90) - _drop * 0.5);
            }
            var _indLbl = {famine:'饥荒',landConcentration:'土地兼并',heavyTax:'苛税',corvee:'繁役',officialCorruption:'吏治腐败',propheticOmen:'谶纬异象',secretSociety:'教门密谋'}[pc.indicator] || pc.indicator;
            addEB('\u524D\u5146', '\u3010' + (pc.region||'') + '\u3011' + pc.class + '——' + _indLbl + '(' + (pc.severity||'') + ')' + (pc.detail?'：' + pc.detail.slice(0,80):''));
          });
        }

        // ── 阶层起义爆发——长周期生命周期起点 ──
        if (p1.class_revolt && Array.isArray(p1.class_revolt) && GM.classes) {
          if (!Array.isArray(GM._activeRevolts)) GM._activeRevolts = [];
          p1.class_revolt.forEach(function(rv) {
            if (!rv || !rv.class || !rv.leaderName) return;
            var cObj = GM.classes.find(function(c){return c.name === rv.class;});
            if (!cObj) return;
            var _rid = rv.revoltId || ('revolt_' + GM.turn + '_' + Math.random().toString(36).slice(2, 8));
            if (GM._activeRevolts.some(function(r){return r.id === _rid;})) return; // 重复ID
            // 生成起义领袖角色（若不存在）
            if (GM.chars && !findCharByName(rv.leaderName)) {
              var _abBase = { intelligence: 50, administration: 40, military: 55, valor: 65, charisma: 75, diplomacy: 40, benevolence: 50 };
              // 根据 ideology 调整能力倾向
              if (rv.ideology === 'religious') { _abBase.charisma += 15; _abBase.intelligence += 10; _abBase.diplomacy += 5; }
              else if (rv.ideology === 'warlord' || rv.organizationType === 'militaryMutiny') { _abBase.military += 15; _abBase.valor += 10; }
              else if (rv.ideology === 'nobleClaim') { _abBase.administration += 15; _abBase.intelligence += 10; _abBase.charisma += 10; }
              else if (rv.ideology === 'populist') { _abBase.benevolence += 15; _abBase.charisma += 10; }
              GM.chars.push({
                name: rv.leaderName,
                title: rv.class + '领袖',
                faction: rv.class + '起义军',
                class: rv.class,
                alive: true,
                age: 35,
                loyalty: 0,
                stance: '反对',
                intelligence: Math.min(100, _abBase.intelligence),
                administration: Math.min(100, _abBase.administration),
                military: Math.min(100, _abBase.military),
                valor: Math.min(100, _abBase.valor),
                charisma: Math.min(100, _abBase.charisma),
                diplomacy: Math.min(100, _abBase.diplomacy),
                benevolence: Math.min(100, _abBase.benevolence),
                personality: '起义领袖——' + (rv.slogan || (rv.demands ? rv.demands.join('、') : '')),
                _spawnedFromRevolt: { revoltId: _rid, class: rv.class, region: rv.region, turn: GM.turn }
              });
            }
            // 生成副将（若指定且不存在）
            if (Array.isArray(rv.secondaryLeaders) && GM.chars) {
              rv.secondaryLeaders.forEach(function(sln) {
                if (!sln || findCharByName(sln)) return;
                GM.chars.push({
                  name: sln, title: rv.class + '义军副将', faction: rv.class + '起义军', class: rv.class, alive: true,
                  age: 32, loyalty: 70, stance: '反对',
                  intelligence: 45, administration: 35, military: 60, valor: 65, charisma: 50, diplomacy: 35, benevolence: 45,
                  _spawnedFromRevolt: { revoltId: _rid, class: rv.class, region: rv.region, turn: GM.turn, role: 'secondary' }
                });
              });
            }
            // 构建 revolt 实体
            var revolt = {
              id: _rid,
              class: rv.class, region: rv.region || '',
              leaderName: rv.leaderName,
              secondaryLeaders: Array.isArray(rv.secondaryLeaders) ? rv.secondaryLeaders : [],
              ideology: rv.ideology || 'populist',
              organizationType: rv.organizationType || 'flowingBandit',
              slogan: rv.slogan || '',
              religiousSect: rv.religiousSect || '',
              historicalArchetype: rv.historicalArchetype || '',
              scale: rv.scale || '中',
              militaryStrength: parseInt(rv.militaryStrength, 10) || 5000,
              composition: rv.composition || '',
              supplyStatus: 50,
              phase: rv.phase || 'uprising',
              demands: Array.isArray(rv.demands) ? rv.demands : [],
              grievances: Array.isArray(rv.grievances) ? rv.grievances : [],
              spreadPattern: rv.spreadPattern || 'mobile',
              territoryControl: rv.region ? [rv.region] : [],
              absorbedForces: [],
              externalSupport: [],
              defectedOfficials: [],
              startTurn: GM.turn,
              history: [{ turn: GM.turn, phase: rv.phase || 'uprising', event: '首义：' + (rv.reason || rv.slogan || '') }],
              outcome: null
            };
            GM._activeRevolts.push(revolt);

            // 更新阶层领袖
            if (!Array.isArray(cObj.leaders)) cObj.leaders = [];
            if (cObj.leaders.indexOf(rv.leaderName) < 0) cObj.leaders.push(rv.leaderName);
            // 加入 activeWars
            if (!Array.isArray(GM.activeWars)) GM.activeWars = [];
            GM.activeWars.push({
              enemy: rv.class + '起义军', leader: rv.leaderName, region: rv.region,
              militaryStrength: revolt.militaryStrength, turn: GM.turn,
              demands: revolt.demands, revoltId: _rid
            });
            // 清理关联前兆（已爆发）
            if (Array.isArray(GM._revoltPrecursors)) {
              GM._revoltPrecursors = GM._revoltPrecursors.filter(function(pc){return !(pc.class === rv.class && pc.region === rv.region);});
            }
            addEB('\u8D77\u4E49', '\u3010' + (rv.region||'') + '\u3011' + rv.class + '\u8D77\u4E49\uFF01\u9886\u8896' + rv.leaderName + (rv.slogan?'\u6253\u300C' + rv.slogan + '\u300D':'') + '\u2014\u2014' + (rv.historicalArchetype?'\u5F62\u5982' + rv.historicalArchetype + '\uFF0C':'') + '\u89C4\u6A21' + (rv.scale||'\u4E2D') + (rv.reason ? '\u56E0\u2014\u2014' + rv.reason : ''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义爆发】' + rv.leaderName + '起兵于' + (rv.region||'?') + (rv.slogan?'，号"' + rv.slogan + '"':'') + '。' + (rv.reason||''), category: '起义' });
          });
        }

        // ── 起义进展更新 ──
        if (p1.revolt_update && Array.isArray(p1.revolt_update) && GM._activeRevolts) {
          p1.revolt_update.forEach(function(ru) {
            if (!ru || !ru.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === ru.revoltId;});
            if (!r || r.outcome) return;
            var oldPhase = r.phase;
            if (ru.newPhase) r.phase = ru.newPhase;
            if (Array.isArray(ru.territoryGained)) ru.territoryGained.forEach(function(t){ if(t && r.territoryControl.indexOf(t)<0) r.territoryControl.push(t); });
            if (Array.isArray(ru.territoryLost)) ru.territoryLost.forEach(function(t){ r.territoryControl = r.territoryControl.filter(function(tt){return tt !== t;}); });
            if (ru.strength_delta) r.militaryStrength = Math.max(0, (r.militaryStrength||0) + parseInt(ru.strength_delta, 10));
            if (ru.supplyStatus_delta) r.supplyStatus = Math.max(0, Math.min(100, (r.supplyStatus||50) + parseInt(ru.supplyStatus_delta, 10)));
            if (Array.isArray(ru.absorbedForces)) ru.absorbedForces.forEach(function(f){ if (r.absorbedForces.indexOf(f) < 0) r.absorbedForces.push(f); });
            if (Array.isArray(ru.externalSupport)) ru.externalSupport.forEach(function(s){ if (r.externalSupport.indexOf(s) < 0) r.externalSupport.push(s); });
            if (Array.isArray(ru.defectedOfficials)) {
              ru.defectedOfficials.forEach(function(nm) {
                if (r.defectedOfficials.indexOf(nm) < 0) r.defectedOfficials.push(nm);
                var _och = findCharByName(nm);
                if (_och) {
                  _och.faction = r.class + '起义军';
                  _och.loyalty = 80;
                  _och._defectedTurn = GM.turn;
                  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(nm, '投奔起义军：' + (r.slogan||''), '决', 8);
                }
              });
            }
            // 领袖伤亡
            if (ru.leaderCasualty) {
              addEB('\u8D77\u4E49', '\u3010' + r.leaderName + '\u3011' + ru.leaderCasualty);
              if (/\u6B7B|\u6218\u6B7B|\u88AB\u6740|\u906E\u6BD9/.test(ru.leaderCasualty)) {
                var _lCh = findCharByName(r.leaderName);
                if (_lCh) { _lCh.alive = false; _lCh.dead = true; _lCh.deathTurn = GM.turn; _lCh.deathReason = ru.leaderCasualty; if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: _lCh.name, reason: ru.leaderCasualty }); }
                // 领袖死亡通常推向 decline（除非已转 establishment）
                if (r.phase !== 'establishment') r.phase = 'decline';
              }
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: ru.keyEvent || ru.narrative || '推进' });
            // 同步 activeWars 的 militaryStrength
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars.forEach(function(w){ if (w.revoltId === r.id) w.militaryStrength = r.militaryStrength; });
            }
            // 自动建政提示——若进入 establishment 而未转化，AI 下回合应 revolt_transform to faction_create
            if (r.phase === 'establishment' && oldPhase !== 'establishment') {
              r._needTransform = true;
            }
            addEB('\u8D77\u4E49', '\u3010' + r.leaderName + '\u3011' + (oldPhase!==r.phase?'\u8F6C\u5165' + r.phase + '\uFF1A':'\u63A8\u8FDB\uFF1A') + (ru.keyEvent||'') + (ru.narrative?'\u2014\u2014' + ru.narrative.slice(0,80):''));
            if (GM.qijuHistory && (ru.keyEvent || ru.narrative)) {
              GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义·' + r.phase + '】' + r.leaderName + '：' + (ru.keyEvent||ru.narrative||''), category: '起义' });
            }
          });
        }

        // ── 镇压行动 ──
        if (p1.revolt_suppress && Array.isArray(p1.revolt_suppress) && GM._activeRevolts) {
          p1.revolt_suppress.forEach(function(sp) {
            if (!sp || !sp.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === sp.revoltId;});
            if (!r || r.outcome) return;
            var cas = sp.casualties || {};
            if (cas.rebel) r.militaryStrength = Math.max(0, (r.militaryStrength||0) - parseInt(cas.rebel, 10));
            if (sp.tactic === '坚壁清野') r.supplyStatus = Math.max(0, (r.supplyStatus||50) - 15);
            if (sp.tactic === '分化瓦解') { r.absorbedForces = r.absorbedForces.slice(0, Math.max(0, r.absorbedForces.length - 2)); }
            if (sp.outcome === 'victory') {
              r.outcome = 'suppressed';
              r.phase = 'ending';
              // 移除 activeWars
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              // 领袖被杀
              var _l = findCharByName(r.leaderName);
              if (_l) { _l.alive = false; _l.dead = true; _l.deathTurn = GM.turn; _l.deathReason = '起义失败被剿'; if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: _l.name, reason: '起义失败被剿' }); }
            } else if (sp.outcome === 'defeat') {
              // 官军反被击溃——起义壮大
              r.militaryStrength = Math.min(999999, (r.militaryStrength||0) + 3000);
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '镇压:' + (sp.suppressor||'官军') + '-' + (sp.outcome||'相持') });
            addEB('\u9547\u538B', '【' + (sp.suppressor||'官军') + '】' + (sp.tactic||'') + '→' + r.leaderName + '之乱' + (sp.outcome==='victory'?'\u5E73\u5B9A':sp.outcome==='defeat'?'\u53CD\u88AB\u51FB\u6E83':'') + (sp.narrative?'\u2014\u2014' + sp.narrative.slice(0,80):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【镇压】' + (sp.suppressor||'?') + '战' + r.leaderName + '，结' + (sp.outcome||'?') + '。' + (sp.narrative||''), category: '起义' });
          });
        }

        // ── 招安行动 ──
        if (p1.revolt_amnesty && Array.isArray(p1.revolt_amnesty) && GM._activeRevolts) {
          p1.revolt_amnesty.forEach(function(am) {
            if (!am || !am.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === am.revoltId;});
            if (!r || r.outcome) return;
            if (am.outcome === 'accepted') {
              r.outcome = 'coopted';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              // 领袖归顺：faction 改回朝廷，loyalty 恢复
              var _acLeaders = Array.isArray(am.acceptedLeaders) && am.acceptedLeaders.length ? am.acceptedLeaders : [r.leaderName];
              _acLeaders.forEach(function(nm) {
                var _ch = findCharByName(nm);
                if (_ch) {
                  _ch.faction = (P.playerInfo && P.playerInfo.factionName) || _ch.faction;
                  _ch.loyalty = 45;
                  _ch._cooptedTurn = GM.turn;
                  _ch.title = '归附·' + (_ch.title || '将领');
                }
              });
            } else if (am.outcome === 'split') {
              // 分化：接受者归顺，拒绝者继续
              if (Array.isArray(am.acceptedLeaders)) {
                am.acceptedLeaders.forEach(function(nm) {
                  var _ch = findCharByName(nm);
                  if (_ch) { _ch.faction = (P.playerInfo && P.playerInfo.factionName) || _ch.faction; _ch.loyalty = 40; _ch._cooptedTurn = GM.turn; }
                });
              }
              r.militaryStrength = Math.floor((r.militaryStrength||0) * 0.5);
              r.phase = 'decline';
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '招安:' + (am.envoy||'') + '-' + (am.outcome||'') });
            addEB('\u62DB\u5B89', '【' + (am.envoy||'?') + '】招安' + r.leaderName + '：' + (am.outcome||'?') + (am.terms?'；条件：' + am.terms.slice(0,60):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【招安】' + (am.envoy||'?') + '抚' + r.leaderName + '，' + (am.outcome||'?') + '。' + (am.narrative||''), category: '起义' });
          });
        }

        // ── 起义转化（建政 / 招安编入 / 融入他派 / 改朝） ──
        if (p1.revolt_transform && Array.isArray(p1.revolt_transform) && GM._activeRevolts) {
          p1.revolt_transform.forEach(function(tr) {
            if (!tr || !tr.revoltId) return;
            var r = GM._activeRevolts.find(function(x){return x.id === tr.revoltId;});
            if (!r || r.outcome) return;
            if (tr.transformType === 'toFaction' && tr.newFactionName) {
              // 自动创建 faction
              if (!Array.isArray(GM.facs)) GM.facs = [];
              if (!GM.facs.some(function(f){return f.name === tr.newFactionName;})) {
                GM.facs.push({
                  id: 'faction_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
                  name: tr.newFactionName,
                  type: r.organizationType === 'builtState' ? '主权国' : '起义军',
                  leader: r.leaderName,
                  territory: (tr.finalTerritory || r.territoryControl.join('、')),
                  strength: Math.min(100, 20 + Math.floor((r.militaryStrength||0) / 5000)),
                  militaryStrength: r.militaryStrength || 10000,
                  economy: 30,
                  attitude: '敌对',
                  playerRelation: -50,
                  cohesion: { political: 40, military: 70, economic: 30, cultural: r.ideology === 'religious' ? 80 : 50, ethnic: r.ideology === 'ethnic' ? 90 : 60, loyalty: 70 },
                  militaryBreakdown: { standingArmy: Math.floor((r.militaryStrength||0) * 0.6), militia: Math.floor((r.militaryStrength||0) * 0.4), elite: 0, fleet: 0 },
                  succession: { rule: 'strongest', designatedHeir: '', stability: 30 },
                  historicalEvents: [{ turn: r.startTurn, event: '起义立国', impact: r.slogan||'' }, { turn: GM.turn, event: '正式建政', impact: tr.narrative||'' }],
                  internalParties: [],
                  description: '自' + r.class + '起义（' + (r.historicalArchetype||'') + '）升级',
                  color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
                  _createdTurn: GM.turn,
                  _fromRevolt: r.id
                });
                // 更新角色 faction
                if (GM.chars) {
                  GM.chars.filter(function(c){return c.faction === r.class + '起义军';}).forEach(function(c){ c.faction = tr.newFactionName; });
                }
                // activeWars 更新
                if (Array.isArray(GM.activeWars)) {
                  GM.activeWars.forEach(function(w){ if (w.revoltId === r.id) w.enemy = tr.newFactionName; });
                }
              }
              r.outcome = 'seceded';
              r.phase = 'ending';
            } else if (tr.transformType === 'dynastyReplaced') {
              r.outcome = 'dynastyReplaced';
              r.phase = 'ending';
              // 游戏结束信号——让上层 UI 处理
              GM._gameOverPending = { reason: 'dynasty_replaced_by_revolt', revoltId: r.id, newDynasty: tr.newFactionName, narrative: tr.narrative };
              addEB('\u6539\u671D', '【改朝换代】' + r.leaderName + '之乱颠覆旧朝，' + (tr.newFactionName||'新朝') + '立。');
            } else if (tr.transformType === 'merged' && tr.mergedInto) {
              r.outcome = 'merged';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
              if (GM.chars) GM.chars.filter(function(c){return c.faction === r.class + '起义军';}).forEach(function(c){ c.faction = tr.mergedInto; });
            } else if (tr.transformType === 'coopted') {
              r.outcome = 'coopted';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
            } else if (tr.transformType === 'dissolved') {
              r.outcome = 'dissolved';
              r.phase = 'ending';
              if (Array.isArray(GM.activeWars)) GM.activeWars = GM.activeWars.filter(function(w){return w.revoltId !== r.id;});
            }
            r.history.push({ turn: GM.turn, phase: r.phase, event: '转化:' + tr.transformType });
            addEB('\u8D77\u4E49', '【转化】' + r.leaderName + '之乱→' + tr.transformType + (tr.newFactionName?'：立' + tr.newFactionName:'') + (tr.narrative?'——' + tr.narrative.slice(0,80):''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【起义转化】' + r.leaderName + '：' + tr.transformType + '。' + (tr.narrative||''), category: '起义' });
          });
        }

        // ── 党派新建 ──
        if (p1.party_create && Array.isArray(p1.party_create)) {
          if (!Array.isArray(GM.parties)) GM.parties = [];
          p1.party_create.forEach(function(pc) {
            if (!pc || !pc.name) return;
            if (GM.parties.some(function(p){return p.name === pc.name;})) return;
            var newP = {
              name: pc.name,
              ideology: pc.ideology || '',
              leader: pc.leader || '',
              influence: parseInt(pc.influence, 10) || 20,
              status: pc.status || '活跃',
              cohesion: parseInt(pc.cohesion, 10) || 70,
              memberCount: parseInt(pc.memberCount, 10) || 0,
              crossFaction: !!pc.crossFaction,
              currentAgenda: pc.currentAgenda || '',
              socialBase: Array.isArray(pc.socialBase) ? pc.socialBase : [],
              agenda_history: [{ turn: GM.turn, agenda: '立党', outcome: pc.reason || pc.trigger || '' }],
              focal_disputes: [],
              officePositions: [],
              description: pc.reason || '',
              _createdTurn: GM.turn
            };
            GM.parties.push(newP);
            // 党魁如是已有角色，则标记其 party
            if (pc.leader) {
              var _ldr = findCharByName(pc.leader);
              if (_ldr) _ldr.party = pc.name;
            }
            addEB('\u515A\u4E89', '\u3010\u65B0\u515A\u5D1B\u8D77\u3011' + pc.name + (pc.leader ? '\uFF08\u9996\uFF1A' + pc.leader + '\uFF09' : '') + (pc.trigger ? '\u2014\u2014' + pc.trigger : '') + (pc.reason ? '\uFF1A' + pc.reason : ''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u515A\u3011' + pc.name + '\u6210\u7ACB\u3002' + (pc.reason||''), category: '\u515A\u6D3E' });
          });
        }

        // ── 党派覆灭 ──
        if (p1.party_dissolve && Array.isArray(p1.party_dissolve) && GM.parties) {
          p1.party_dissolve.forEach(function(pd) {
            if (!pd || !pd.name) return;
            var pObj = GM.parties.find(function(p){return p.name === pd.name;});
            if (!pObj) return;
            pObj.status = '已解散';
            pObj._dissolvedTurn = GM.turn;
            pObj._dissolveCause = pd.cause;
            // 成员去向
            if (GM.chars) {
              GM.chars.filter(function(c){return c.party === pd.name;}).forEach(function(c) {
                c.party = '';
                c.partyRank = '';
                c._formerParty = pd.name;
                // 按 fatePerMember 调整状态
                if (pd.cause === 'liquidated' || pd.cause === 'leaderKilled') {
                  c.loyalty = Math.max(0, (c.loyalty||50) - 20);
                  c.stress = Math.min(100, (c.stress||0) + 25);
                }
                if (typeof NpcMemorySystem !== 'undefined') {
                  var _emo = pd.cause === 'liquidated' ? '恨' : pd.cause === 'leaderKilled' ? '悲' : '忧';
                  NpcMemorySystem.remember(c.name, pd.name + '被' + (pd.cause||'解散') + '——' + (pd.fatePerMember||''), _emo, 7);
                }
              });
            }
            // 从列表中移除（保留 _dissolvedTurn 供历史追溯）
            GM.parties = GM.parties.filter(function(p){return p.name !== pd.name;});
            var _cLbl = {banned:'被查禁',liquidated:'被肃清',faded:'自然消亡',leaderKilled:'领袖被杀而散',absorbed:'被吞并'}[pd.cause] || pd.cause || '覆灭';
            addEB('\u515A\u4E89', '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + (pd.perpetrator?'\uFF08' + pd.perpetrator + '\u4E3B\u7F16\uFF09':'') + (pd.reason?'\uFF1A' + pd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u515A\u6D3E\u89E6\u706D\u3011' + pd.name + _cLbl + '\u3002' + (pd.reason||''), category: '\u515A\u6D3E' });
          });
        }

        // ── 势力新建 ──
        if (p1.faction_create && Array.isArray(p1.faction_create)) {
          if (!Array.isArray(GM.facs)) GM.facs = [];
          p1.faction_create.forEach(function(fc) {
            if (!fc || !fc.name) return;
            if (GM.facs.some(function(f){return f.name === fc.name;})) return;
            var newF = {
              id: 'faction_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
              name: fc.name,
              type: fc.type || '起义军',
              leader: fc.leader || '',
              territory: fc.territory || '',
              strength: parseInt(fc.strength, 10) || 30,
              militaryStrength: parseInt(fc.militaryStrength, 10) || 10000,
              economy: parseInt(fc.economy, 10) || 40,
              attitude: fc.attitude || '敌对',
              playerRelation: parseInt(fc.playerRelation, 10) || -30,
              cohesion: fc.cohesion || { political: 50, military: 60, economic: 40, cultural: 50, ethnic: 60, loyalty: 50 },
              militaryBreakdown: { standingArmy: parseInt(fc.militaryStrength, 10)||10000, militia: 0, elite: 0, fleet: 0 },
              succession: { rule: 'strongest', designatedHeir: '', stability: 40 },
              historicalEvents: [{ turn: GM.turn, event: '立国', impact: fc.triggerEvent || fc.reason || '' }],
              internalParties: [],
              parentFaction: fc.parentFaction || '',
              description: fc.reason || '',
              color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
              _createdTurn: GM.turn
            };
            GM.facs.push(newF);
            // 关联现有角色
            if (fc.leader) {
              var _fLdr = findCharByName(fc.leader);
              if (_fLdr) _fLdr.faction = fc.name;
            }
            // 若有 parentFaction，母势力凝聚力下降
            if (fc.parentFaction) {
              var _par = GM.facs.find(function(f){return f.name === fc.parentFaction;});
              if (_par) {
                if (_par.cohesion) _par.cohesion.political = Math.max(0, (_par.cohesion.political||50) - 15);
                _par.strength = Math.max(5, (_par.strength||50) - 10);
                if (!Array.isArray(_par.historicalEvents)) _par.historicalEvents = [];
                _par.historicalEvents.push({ turn: GM.turn, event: fc.name + '脱离', impact: '政治统一度下降' });
              }
            }
            addEB('\u52BF\u529B', '\u3010\u65B0\u52BF\u529B\u7AD6\u8D77\u3011' + fc.name + '\u6210\u7ACB\uFF08' + (fc.type||'') + '\uFF09' + (fc.parentFaction?'\u2014\u2014\u8131\u79BB\u81EA' + fc.parentFaction:'') + (fc.triggerEvent?'\uFF1A' + fc.triggerEvent:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u65B0\u52BF\u529B\u3011' + fc.name + '\u7AD6\u8D77\u3002' + (fc.reason||''), category: '\u52BF\u529B' });
          });
        }

        // ── 势力覆灭 ──
        if (p1.faction_dissolve && Array.isArray(p1.faction_dissolve) && GM.facs) {
          p1.faction_dissolve.forEach(function(fd) {
            if (!fd || !fd.name) return;
            var fObj = GM.facs.find(function(f){return f.name === fd.name;});
            if (!fObj) return;
            if (fObj.isPlayer) { addEB('势力', '【拒绝】不得在 faction_dissolve 中灭玩家势力'); return; }
            fObj._dissolvedTurn = GM.turn;
            fObj._dissolveCause = fd.cause;
            // 征服者处理
            if (fd.conqueror && (fd.cause === 'conquered' || fd.cause === 'absorbed')) {
              var _con = GM.facs.find(function(f){return f.name === fd.conqueror;});
              if (_con) {
                _con.strength = Math.min(100, (_con.strength||50) + Math.floor((fObj.strength||30) * 0.4));
                if (fObj.militaryStrength) _con.militaryStrength = (_con.militaryStrength||0) + Math.floor(fObj.militaryStrength * 0.3);
                if (!Array.isArray(_con.historicalEvents)) _con.historicalEvents = [];
                _con.historicalEvents.push({ turn: GM.turn, event: '吞并' + fd.name, impact: '国力增强' });
              }
            }
            // 角色处理
            if (GM.chars) {
              GM.chars.filter(function(c){return c.faction === fd.name;}).forEach(function(c) {
                c._formerFaction = fd.name;
                if (fd.cause === 'conquered' || fd.cause === 'absorbed') {
                  c.faction = fd.conqueror || '';
                  c.loyalty = Math.max(0, (c.loyalty||50) - 25);
                  c.stress = Math.min(100, (c.stress||0) + 30);
                } else {
                  c.faction = '';
                }
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c.name, fd.name + '亡国：' + (fd.cause||'') + '——' + (fd.leaderFate||''), '悲', 8);
                }
              });
            }
            // 出逃核心人物
            if (Array.isArray(fd.refugees)) {
              fd.refugees.forEach(function(nm) {
                var _r = findCharByName(nm);
                if (_r) { _r._refugee = true; _r._refugeeTurn = GM.turn; _r.loyalty = Math.max(0, (_r.loyalty||50) - 10); }
              });
            }
            // 从 activeWars 移除相关条目（该势力已灭）
            if (Array.isArray(GM.activeWars)) {
              GM.activeWars = GM.activeWars.filter(function(w) { return w.enemy !== fd.name; });
            }
            // 从 factions 中移除
            GM.facs = GM.facs.filter(function(f){return f.name !== fd.name;});
            // 关系矩阵清理
            if (GM.factionRelationsMap) {
              Object.keys(GM.factionRelationsMap).forEach(function(k) {
                if (k.indexOf(fd.name + '->') === 0 || k.indexOf('->' + fd.name) > 0) delete GM.factionRelationsMap[k];
              });
            }
            var _fcLbl = {conquered:'被征服',absorbed:'被并入',collapsed:'内部崩解',seceded_all:'分崩离析',replaced:'被取代'}[fd.cause] || fd.cause || '覆灭';
            addEB('\u52BF\u529B', '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + (fd.conqueror?'\uFF08\u4E3A' + fd.conqueror + '\u6240\u7EC8\uFF09':'') + (fd.territoryFate?'\uFF0C\u7586\u571F:' + fd.territoryFate:'') + (fd.leaderFate?'\u2014\u2014\u9996\u8111:' + fd.leaderFate:'') + (fd.reason?'\uFF1A' + fd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u52BF\u529B\u89E6\u706D\u3011' + fd.name + _fcLbl + '\u3002' + (fd.reason||''), category: '\u52BF\u529B' });
          });
        }

        // ── 阶层兴起 ──
        if (p1.class_emerge && Array.isArray(p1.class_emerge)) {
          if (!Array.isArray(GM.classes)) GM.classes = [];
          p1.class_emerge.forEach(function(ce) {
            if (!ce || !ce.name) return;
            if (GM.classes.some(function(c){return c.name === ce.name;})) return;
            var newC = {
              name: ce.name,
              size: ce.size || '约5%',
              mobility: ce.mobility || '中',
              economicRole: ce.economicRole || '其他',
              status: ce.status || '良民',
              privileges: ce.privileges || '',
              obligations: ce.obligations || '',
              satisfaction: parseInt(ce.satisfaction, 10) || 50,
              influence: parseInt(ce.influence, 10) || 15,
              demands: ce.demands || '',
              unrestThreshold: parseInt(ce.unrestThreshold, 10) || 30,
              representativeNpcs: [],
              leaders: [],
              supportingParties: [],
              regionalVariants: [],
              internalFaction: [],
              unrestLevels: { grievance: 60, petition: 70, strike: 80, revolt: 90 },
              economicIndicators: { wealth: 40, taxBurden: 40, landHolding: 20 },
              description: '【新兴阶层】' + (ce.origin || '') + (ce.reason ? '——' + ce.reason : ''),
              _emergeTurn: GM.turn,
              _origin: ce.origin
            };
            GM.classes.push(newC);
            addEB('\u9636\u5C42', '\u3010\u65B0\u9636\u5C42\u5174\u8D77\u3011' + ce.name + (ce.origin?'\u2014\u2014' + ce.origin:'') + (ce.reason?'\uFF1A' + ce.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u5174\u66BF\u3011' + ce.name + '\u5174\u8D77\u3002' + (ce.reason||''), category: '\u9636\u5C42' });
          });
        }

        // ── 阶层消亡 ──
        if (p1.class_dissolve && Array.isArray(p1.class_dissolve) && GM.classes) {
          p1.class_dissolve.forEach(function(cd) {
            if (!cd || !cd.name) return;
            var cObj = GM.classes.find(function(c){return c.name === cd.name;});
            if (!cObj) return;
            cObj._dissolvedTurn = GM.turn;
            cObj._dissolveCause = cd.cause;
            // 成员流向：character.class 迁移
            if (GM.chars) {
              GM.chars.filter(function(c){return c.class === cd.name;}).forEach(function(c) {
                c._formerClass = cd.name;
                c.class = cd.successorClass || '';
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(c.name, cd.name + '消亡：' + (cd.cause||'') + '——' + (cd.membersFate||''), '忧', 6);
                }
              });
            }
            // 依赖该阶层的党派 socialBase 清理
            if (Array.isArray(GM.parties)) {
              GM.parties.forEach(function(p) {
                if (Array.isArray(p.socialBase)) p.socialBase = p.socialBase.filter(function(sb){return sb.class !== cd.name;});
              });
            }
            // 从 classes 移除
            GM.classes = GM.classes.filter(function(c){return c.name !== cd.name;});
            var _ccLbl = {abolished:'被法令废除',assimilated:'被吸收融合',extincted:'衰落消亡',replaced:'被新阶层取代'}[cd.cause] || cd.cause || '消亡';
            addEB('\u9636\u5C42', '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + (cd.successorClass?'\uFF08\u7EE7\u4EFB\uFF1A' + cd.successorClass + '\uFF09':'') + (cd.membersFate?'\u2014\u2014\u6210\u5458:' + cd.membersFate:'') + (cd.reason?'\uFF1A' + cd.reason:''));
            if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '\u3010\u9636\u5C42\u6D88\u4EA1\u3011' + cd.name + _ccLbl + '\u3002' + (cd.reason||''), category: '\u9636\u5C42' });
          });
        }

        // ── 势力关系动态变化 ──
        if (p1.faction_relation_shift && Array.isArray(p1.faction_relation_shift) && GM.factionRelationsMap) {
          p1.faction_relation_shift.forEach(function(rs) {
            if (!rs || !rs.from || !rs.to) return;
            var key1 = rs.from + '->' + rs.to, key2 = rs.to + '->' + rs.from;
            var rel1 = GM.factionRelationsMap[key1] || (GM.factionRelationsMap[key1] = {});
            var rel2 = GM.factionRelationsMap[key2] || (GM.factionRelationsMap[key2] = {});
            var delta = parseFloat(rs.relation_delta) || 0;
            [rel1, rel2].forEach(function(r) {
              if (delta) r.value = Math.max(-100, Math.min(100, (r.value||0) + delta));
              if (rs.new_type) r.type = rs.new_type;
              if (!Array.isArray(r.historicalEvents)) r.historicalEvents = [];
              r.historicalEvents.push({ turn: GM.turn, event: rs.event || rs.reason || '', delta: delta });
              if (r.historicalEvents.length > 20) r.historicalEvents = r.historicalEvents.slice(-20);
            });
            addEB('\u5916\u4EA4', rs.from + '\u2194' + rs.to + ' ' + (rs.new_type||(delta>0?'\u6539\u5584':'\u6076\u5316')) + (rs.event ? '\uFF1A' + rs.event : ''));
          });
        }

        // 处理官制变动（AI可任命/罢免官员）
        if (p1.office_changes && Array.isArray(p1.office_changes) && GM.officeTree) {
          p1.office_changes.forEach(function(oc) {
            if (!oc.dept || !oc.position || !oc.action) return;
            // 遍历官制树查找匹配的部门和职位
            (function walkTree(nodes) {
              nodes.forEach(function(node) {
                if (node.name === oc.dept && node.positions) {
                  node.positions.forEach(function(pos) {
                    if (pos.name === oc.position) {
                      if (oc.action === 'appoint' && oc.person) {
                        var oldHolder = pos.holder || '';
                        // 新模型：把旧 holder 转成占位再把新 holder 填入
                        if (oldHolder && oldHolder !== oc.person && typeof _offDismissPerson === 'function') _offDismissPerson(pos, oldHolder);
                        if (typeof _offAppointPerson === 'function') _offAppointPerson(pos, oc.person);
                        else pos.holder = oc.person;
                        // 记录继任方式到事件（让叙事更准确）
                        var _succDesc = '';
                        if (pos.succession) {
                          var _succMap = {appointment:'\u6D41\u5B98\u4EFB\u547D',hereditary:'\u4E16\u88AD\u7EE7\u4EFB',examination:'\u79D1\u4E3E\u9009\u62D4',military:'\u519B\u529F\u6388\u804C',recommendation:'\u4E3E\u8350\u4EFB\u7528'};
                          _succDesc = _succMap[pos.succession] ? '(\u4EE5' + _succMap[pos.succession] + ')' : '';
                        }
                        addEB('\u4EFB\u547D', oc.person + _succDesc + '\u4EFB' + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
                        var ch = findCharByName(oc.person);
                        if (ch) {
                          ch.loyalty = Math.min(100, (ch.loyalty||50) + 5);
                          ch.officialTitle = oc.position;
                          ch.title = oc.dept + oc.position;
                          // 举主追踪——从reason中提取"由某某举荐"
                          if (oc.reason) {
                            var _jzMatch = (oc.reason||'').match(/由(.{1,6})举荐|(.{1,6})推荐/);
                            if (_jzMatch) {
                              ch._recommendedBy = _jzMatch[1] || _jzMatch[2];
                              ch._recommendTurn = GM.turn;
                            }
                          }
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(oc.person, 'appointment', '\u4EFB' + oc.dept + oc.position);
                          if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
                            CorruptionEngine.markAsRecentAppointment(ch);
                          }
                        }
                        // 清除旧任职者的官职字段
                        if (oldHolder) {
                          var _oldCh = findCharByName(oldHolder);
                          if (_oldCh && _oldCh.officialTitle === oc.position) _oldCh.officialTitle = '';
                        }
                        // 同步PostSystem（如果有对应post）
                        if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts) {
                          var _mp = GM.postSystem.posts.find(function(p) { return p.name === oc.position || p.name === oc.dept + oc.position; });
                          if (_mp && oc.person) PostTransfer.seat(_mp.id, oc.person, 'AI\u63A8\u6F14');
                        }
                        // 同步行政区划governor（如果该官职对应某个行政单位的主官）
                        if (P.adminHierarchy) {
                          (function _syncAdmGov(ah) {
                            var _aks = Object.keys(ah);
                            _aks.forEach(function(k) {
                              if (!ah[k] || !ah[k].divisions) return;
                              (function _walk(divs) {
                                divs.forEach(function(dv) {
                                  if (dv.officialPosition === oc.position && (!dv.governor || dv.governor === oldHolder)) {
                                    dv.governor = oc.person;
                                    if (GM.provinceStats && GM.provinceStats[dv.name]) GM.provinceStats[dv.name].governor = oc.person;
                                  }
                                  if (dv.children) _walk(dv.children);
                                });
                              })(ah[k].divisions);
                            });
                          })(P.adminHierarchy);
                        }
                      } else if (oc.action === 'promote' && pos.holder) {
                        // 晋升——品级提升，可能调任新职
                        if (oc.newRank) pos.rank = oc.newRank;
                        addEB('晋升', pos.holder + '晋升' + (oc.newRank||'') + (oc.reason ? '（' + oc.reason + '）' : ''));
                        var _pch = findCharByName(pos.holder);
                        if (_pch) {
                          _pch.loyalty = Math.min(100, (_pch.loyalty||50) + 8);
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(pos.holder, 'promotion', '晋升' + (oc.newRank||''));
                        }
                        // 如果指定了新职位，执行调任
                        if (oc.newPosition && oc.newDept) {
                          var _transferPerson = pos.holder;
                          pos.holder = ''; // 空出旧位
                          // 查找新职位并任命
                          (function _findNewPos(ns) {
                            ns.forEach(function(nd) {
                              if (nd.name === oc.newDept && nd.positions) {
                                nd.positions.forEach(function(np) {
                                  if (np.name === oc.newPosition) {
                                    // 记录历任
                                    if (!np._history) np._history = [];
                                    if (np.holder) np._history.push({ holder: np.holder, to: GM.turn });
                                    np.holder = _transferPerson;
                                  }
                                });
                              }
                              if (nd.subs) _findNewPos(nd.subs);
                            });
                          })(GM.officeTree);
                        }
                      } else if (oc.action === 'demote' && pos.holder) {
                        if (oc.newRank) pos.rank = oc.newRank;
                        addEB('降级', pos.holder + '降为' + (oc.newRank||'') + (oc.reason ? '（' + oc.reason + '）' : ''));
                        var _dch2 = findCharByName(pos.holder);
                        if (_dch2) {
                          _dch2.loyalty = Math.max(0, (_dch2.loyalty||50) - 8);
                          _dch2.stress = Math.min(100, (_dch2.stress||0) + 10);
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(pos.holder, 'demotion', '降为' + (oc.newRank||''));
                        }
                      } else if (oc.action === 'transfer' && pos.holder && oc.newDept && oc.newPosition) {
                        var _tPerson = pos.holder;
                        // 记录历任
                        if (!pos._history) pos._history = [];
                        pos._history.push({ holder: _tPerson, to: GM.turn });
                        pos.holder = '';
                        addEB('调任', _tPerson + '调任' + oc.newDept + oc.newPosition);
                        // 任命到新位
                        (function _findTP(ns2) {
                          ns2.forEach(function(nd2) {
                            if (nd2.name === oc.newDept && nd2.positions) {
                              nd2.positions.forEach(function(np2) {
                                if (np2.name === oc.newPosition) {
                                  if (!np2._history) np2._history = [];
                                  if (np2.holder) np2._history.push({ holder: np2.holder, to: GM.turn });
                                  np2.holder = _tPerson;
                                }
                              });
                            }
                            if (nd2.subs) _findTP(nd2.subs);
                          });
                        })(GM.officeTree);
                        var _tch = findCharByName(_tPerson);
                        if (_tch) {
                          _tch.officialTitle = oc.newPosition;
                          _tch.title = oc.newDept + oc.newPosition;
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(_tPerson, 'transfer', '调任' + oc.newDept + oc.newPosition);
                        }
                      } else if (oc.action === 'evaluate' && pos.holder && oc.evaluator) {
                        // NPC考评——由负责考察的官员执行（带偏见）
                        if (!pos._evaluations) pos._evaluations = [];
                        pos._evaluations.push({
                          turn: GM.turn, evaluator: oc.evaluator,
                          grade: oc.grade || '平庸', comment: oc.comment || '',
                          holder: pos.holder
                        });
                        if (pos._evaluations.length > 10) pos._evaluations.shift();
                        addEB('考评', oc.evaluator + '考评' + pos.holder + '：' + (oc.grade||'') + (oc.comment ? '（' + oc.comment + '）' : ''));
                        // 考评者记忆
                        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                          NpcMemorySystem.remember(oc.evaluator, '考评' + pos.holder + '为' + oc.dept + oc.position + '：' + (oc.grade||''), '平', 4);
                          NpcMemorySystem.remember(pos.holder, '被' + oc.evaluator + '考评为' + (oc.grade||''), oc.grade === '失职' ? '怨' : '平', 5);
                        }
                        // 举主连坐——失职考评追溯举主
                        if (oc.grade === '失职') {
                          var _evalCh = findCharByName(pos.holder);
                          if (_evalCh && _evalCh._recommendedBy) {
                            addEB('举主连坐', pos.holder + '考评失职，举主' + _evalCh._recommendedBy + '受牵连（举人不当）');
                            if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                              NpcMemorySystem.remember(_evalCh._recommendedBy, '所举荐的' + pos.holder + '被评为失职，本人受"举人不当"之责', '忧', 6);
                            }
                            var _jzCh = findCharByName(_evalCh._recommendedBy);
                            if (_jzCh) {
                              _jzCh.loyalty = Math.max(0, (_jzCh.loyalty||50) - 5);
                              _jzCh.stress = Math.min(100, (_jzCh.stress||0) + 8);
                            }
                          }
                        }
                      } else if (oc.action === 'dismiss') {
                        var dismissed = pos.holder;
                        // 新模型：把该任职者从 actualHolders 移除，留占位
                        if (dismissed && typeof _offDismissPerson === 'function') _offDismissPerson(pos, dismissed);
                        else pos.holder = '';
                        if (dismissed) {
                          addEB('\u7F62\u514D', dismissed + '\u88AB\u514D\u53BB' + oc.dept + oc.position + (oc.reason ? '(' + oc.reason + ')' : ''));
                          var dch = findCharByName(dismissed);
                          if (dch) {
                            // 致仕（退休）vs 罢免——情绪影响不同
                          var _isRetire = (oc.reason||'').indexOf('\u81F4\u4ED5') >= 0 || (oc.reason||'').indexOf('\u9000\u4F11') >= 0 || (oc.reason||'').indexOf('\u4E5E\u9AB8\u9AA8') >= 0 || (oc.reason||'').indexOf('\u8D50\u91D1\u8FD8\u4E61') >= 0;
                          if (_isRetire) {
                            dch.loyalty = Math.min(100, (dch.loyalty||50) + 5); // 恩准致仕→感恩
                            dch.stress = Math.max(0, (dch.stress||0) - 20); // 卸任减压
                            dch._retired = true;
                            dch._retireTurn = GM.turn;
                            addEB('\u81F4\u4ED5', dismissed + '\u6069\u51C6\u81F4\u4ED5\u5F52\u7530' + (oc.reason ? '（' + oc.reason + '）' : ''));
                          } else {
                            dch.loyalty = Math.max(0, (dch.loyalty||50) - 10);
                            dch.stress = Math.min(100, (dch.stress||0) + 15);
                          }
                          if (dch.officialTitle === oc.position) dch.officialTitle = '';
                          dch.title = _isRetire ? '致仕' : '';
                          if (typeof recordCharacterArc === 'function') recordCharacterArc(dismissed, _isRetire ? 'retirement' : 'dismissal', (_isRetire ? '\u6069\u51C6\u81F4\u4ED5' : '\u88AB\u514D\u53BB') + oc.dept + oc.position + (oc.reason ? '：' + oc.reason : ''));
                          }
                          // 同步PostSystem
                          if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(dismissed);
                          // 同步行政区划：清除被免职者的governor
                          if (P.adminHierarchy) {
                            (function _clearAdmGov(ah) {
                              var _aks2 = Object.keys(ah);
                              _aks2.forEach(function(k) {
                                if (!ah[k] || !ah[k].divisions) return;
                                (function _walk2(divs) {
                                  divs.forEach(function(dv) {
                                    if (dv.governor === dismissed) {
                                      dv.governor = '';
                                      if (GM.provinceStats && GM.provinceStats[dv.name]) GM.provinceStats[dv.name].governor = '';
                                    }
                                    if (dv.children) _walk2(dv.children);
                                  });
                                })(ah[k].divisions);
                              });
                            })(P.adminHierarchy);
                          }
                        }
                      }
                    }
                  });
                }
                if (node.subs) walkTree(node.subs);
              });
            })(GM.officeTree);
            // reform动作——在walkTree之外处理（修改树结构）
            if (oc.action === 'reform' && oc.reformDetail) {
              var _rd = oc.reformDetail;
              if (oc.position && (_rd.indexOf('增设') >= 0 || _rd.indexOf('新设') >= 0)) {
                // 增设官职（在指定部门下）——同时填充老字段与新字段
                (function _addPos(ns) {
                  ns.forEach(function(n) {
                    if (n.name === oc.dept) {
                      if (!n.positions) n.positions = [];
                      var _newPos = {
                        name: oc.position, rank: oc.newRank||'', holder: '', desc: oc.reason||'',
                        headCount: 1, actualCount: 0, additionalHolders: [],
                        establishedCount: 1, vacancyCount: 1, actualHolders: []
                      };
                      n.positions.push(_newPos);
                    }
                    if (n.subs) _addPos(n.subs);
                  });
                })(GM.officeTree);
                addEB('官制改革', oc.dept + '增设' + oc.position + (oc.reason ? '（' + oc.reason + '）' : ''));
              } else if (!oc.position && (_rd.indexOf('增设') >= 0 || _rd.indexOf('新设') >= 0)) {
                // 增设部门
                if (oc.newDept) {
                  // 增设为某部门的下属
                  (function _addSub(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.dept) {
                        if (!n.subs) n.subs = [];
                        n.subs.push({ name: oc.newDept, desc: oc.reason||'', positions: [], subs: [], functions: [] });
                      }
                      if (n.subs) _addSub(n.subs);
                    });
                  })(GM.officeTree);
                  addEB('官制改革', oc.dept + '下增设' + oc.newDept);
                } else {
                  // 增设顶层部门
                  var _newName = oc.dept || '新设部门';
                  GM.officeTree.push({ name: _newName, desc: oc.reason||'', positions: [], subs: [], functions: [] });
                  addEB('官制改革', '增设' + _newName + (oc.reason ? '（' + oc.reason + '）' : ''));
                }
              } else if (_rd.indexOf('裁撤') >= 0 || _rd.indexOf('废除') >= 0) {
                if (oc.position) {
                  // 裁撤官职
                  (function _delPos(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.dept && n.positions) {
                        var _dismissed = n.positions.filter(function(p){ return p.name === oc.position && p.holder; });
                        _dismissed.forEach(function(p) {
                          var dch = findCharByName(p.holder);
                          if (dch) { dch.officialTitle = ''; dch.title = ''; }
                        });
                        n.positions = n.positions.filter(function(p) { return p.name !== oc.position; });
                      }
                      if (n.subs) _delPos(n.subs);
                    });
                  })(GM.officeTree);
                  addEB('官制改革', '裁撤' + oc.dept + oc.position);
                } else {
                  // 裁撤部门
                  GM.officeTree = GM.officeTree.filter(function(d) { return d.name !== oc.dept; });
                  (function _delSub(ns) { ns.forEach(function(n) { if (n.subs) { n.subs = n.subs.filter(function(s) { return s.name !== oc.dept; }); _delSub(n.subs); } }); })(GM.officeTree);
                  addEB('官制改革', '裁撤' + oc.dept + (oc.reason ? '（' + oc.reason + '）' : ''));
                }
              } else if (_rd.indexOf('改名') >= 0 || _rd.indexOf('更名') >= 0) {
                (function _rename(ns) { ns.forEach(function(n) { if (n.name === oc.dept && oc.newDept) n.name = oc.newDept; if (n.subs) _rename(n.subs); }); })(GM.officeTree);
                addEB('官制改革', oc.dept + '更名为' + (oc.newDept||''));
              } else if (_rd.indexOf('合并') >= 0) {
                // 合并：将oc.dept合并入oc.newDept（职位转移）
                var _srcDept = null;
                (function _findSrc(ns) { ns.forEach(function(n) { if (n.name === oc.dept) _srcDept = n; if (n.subs) _findSrc(n.subs); }); })(GM.officeTree);
                if (_srcDept) {
                  (function _findDst(ns) {
                    ns.forEach(function(n) {
                      if (n.name === oc.newDept) {
                        if (!n.positions) n.positions = [];
                        (_srcDept.positions||[]).forEach(function(p) { n.positions.push(p); });
                        if (!n.subs) n.subs = [];
                        (_srcDept.subs||[]).forEach(function(s) { n.subs.push(s); });
                      }
                      if (n.subs) _findDst(n.subs);
                    });
                  })(GM.officeTree);
                  // 删除源部门
                  GM.officeTree = GM.officeTree.filter(function(d) { return d.name !== oc.dept; });
                  (function _delMerged(ns) { ns.forEach(function(n) { if (n.subs) { n.subs = n.subs.filter(function(s) { return s.name !== oc.dept; }); _delMerged(n.subs); } }); })(GM.officeTree);
                  addEB('官制改革', oc.dept + '并入' + oc.newDept);
                }
              } else if (_rd.indexOf('拆分') >= 0 && Array.isArray(oc.splitInto) && oc.splitInto.length > 0) {
                // 拆分：将 oc.dept 按 splitInto 分成多个新部门；原部门的 positions 按 splitInto 指定的 positions 分配
                var _splitSrc = null, _splitParent = null;
                (function _findSp(ns, parent) {
                  ns.forEach(function(n) {
                    if (n.name === oc.dept) { _splitSrc = n; _splitParent = parent; }
                    if (n.subs) _findSp(n.subs, n);
                  });
                })(GM.officeTree, null);
                if (_splitSrc) {
                  var _splitSiblings = _splitParent ? _splitParent.subs : GM.officeTree;
                  var _srcIdx = _splitSiblings.indexOf(_splitSrc);
                  var _newDepts = oc.splitInto.map(function(info) {
                    var posList = Array.isArray(info.positions) ? info.positions : [];
                    // 从源部门摘取匹配 positions（按 name）
                    var takenPos = [];
                    posList.forEach(function(pn) {
                      var pname = typeof pn === 'string' ? pn : (pn && pn.name);
                      if (!pname) return;
                      var idx = (_splitSrc.positions||[]).findIndex(function(p){return p.name===pname;});
                      if (idx >= 0) { takenPos.push(_splitSrc.positions[idx]); _splitSrc.positions.splice(idx,1); }
                    });
                    return { name: info.name || '新部门', desc: info.desc || '', positions: takenPos, subs: [], functions: info.functions || [] };
                  });
                  // 未分配的 positions 追加到第一个新部门
                  if (_splitSrc.positions && _splitSrc.positions.length > 0 && _newDepts.length > 0) {
                    _newDepts[0].positions = _newDepts[0].positions.concat(_splitSrc.positions);
                  }
                  // 替换：移除原部门，插入新部门
                  _splitSiblings.splice.apply(_splitSiblings, [_srcIdx, 1].concat(_newDepts));
                  addEB('官制改革', oc.dept + '拆分为' + _newDepts.map(function(d){return d.name;}).join('、'));
                }
              } else if (_rd.indexOf('改制') >= 0 && Array.isArray(oc.restructurePlan) && oc.restructurePlan.length > 0) {
                // 改制：执行一揽子原子动作，每项是一个 reform 子命令 {action, dept, position, newDept, ...}
                var _restructureCount = 0;
                oc.restructurePlan.forEach(function(atom) {
                  if (!atom || !atom.action) return;
                  var subOC = {
                    dept: atom.dept, position: atom.position,
                    newDept: atom.newDept, newPosition: atom.newPosition,
                    newRank: atom.newRank,
                    reason: atom.reason || oc.reason || '改制',
                    action: 'reform',
                    reformDetail: atom.action,
                    splitInto: atom.splitInto,
                    intoDept: atom.intoDept
                  };
                  // 复用本分支处理逻辑——简化起见用 addEB 日志（实际结构变更依赖下一 oc 迭代）
                  // 直接调用自身分支不方便，这里做常见原子动作的内联处理
                  if (atom.action === '增设' && subOC.position && subOC.dept) {
                    (function _ap(ns) { ns.forEach(function(n) {
                      if (n.name === subOC.dept) {
                        if (!n.positions) n.positions = [];
                        n.positions.push({
                          name: subOC.position, rank: subOC.newRank||'', holder: '', desc: subOC.reason||'',
                          headCount: 1, actualCount: 0, additionalHolders: [],
                          establishedCount: 1, vacancyCount: 1, actualHolders: []
                        });
                      }
                      if (n.subs) _ap(n.subs);
                    }); })(GM.officeTree);
                    _restructureCount++;
                  } else if (atom.action === '裁撤' && subOC.position && subOC.dept) {
                    (function _dp(ns) { ns.forEach(function(n) { if (n.name === subOC.dept && n.positions) n.positions = n.positions.filter(function(p) { return p.name !== subOC.position; }); if (n.subs) _dp(n.subs); }); })(GM.officeTree);
                    _restructureCount++;
                  } else if (atom.action === '改名' && subOC.dept && subOC.newDept) {
                    (function _rn(ns) { ns.forEach(function(n) { if (n.name === subOC.dept) n.name = subOC.newDept; if (n.subs) _rn(n.subs); }); })(GM.officeTree);
                    _restructureCount++;
                  }
                });
                addEB('官制改革', '【改制】' + (oc.reason||'') + '——执行' + _restructureCount + '项原子变更');
              }
              _dbg('[office_reform] ' + _rd + ' ' + (oc.dept||''));
            }
            // 任命/免职时记录历任
            if ((oc.action === 'appoint' || oc.action === 'dismiss') && oc.dept && oc.position) {
              (function _recHistory(ns) {
                ns.forEach(function(n) {
                  if (n.name === oc.dept && n.positions) {
                    n.positions.forEach(function(p) {
                      if (p.name === oc.position) {
                        if (!p._history) p._history = [];
                        if (oc.action === 'dismiss' && oc.person) {
                          p._history.push({ holder: oc.person, to: GM.turn, reason: oc.reason||'' });
                        } else if (oc.action === 'appoint' && oc.person) {
                          p._history.push({ holder: oc.person, from: GM.turn });
                        }
                        if (p._history.length > 20) p._history = p._history.slice(-20);
                      }
                    });
                  }
                  if (n.subs) _recHistory(n.subs);
                });
              })(GM.officeTree);
            }
          });
        }

        // 处理部门聚合事件（双层模型）
        if (p1.office_aggregate && Array.isArray(p1.office_aggregate) && GM.officeTree) {
          p1.office_aggregate.forEach(function(oa) {
            if (!oa.dept) return;
            // 找到对应部门
            var _targetDept = null;
            (function _fd(ns) { ns.forEach(function(n) { if (n.name === oa.dept) _targetDept = n; if (n.subs) _fd(n.subs); }); })(GM.officeTree);
            if (!_targetDept) return;
            // actualCount变动（递补/离职）
            if (oa.actualCount_delta) {
              var delta = parseInt(oa.actualCount_delta) || 0;
              // 分摊到各职位的actualCount
              (_targetDept.positions||[]).forEach(function(p) {
                if (typeof _offMigratePosition === 'function') _offMigratePosition(p);
                if (delta > 0 && (p.actualCount||0) < (p.headCount||1)) {
                  var canAdd = Math.min(delta, (p.headCount||1) - (p.actualCount||0));
                  p.actualCount = (p.actualCount||0) + canAdd;
                  // 新模型同步：递补增加占位，减少 vacancyCount
                  if (!Array.isArray(p.actualHolders)) p.actualHolders = [];
                  for (var _ai = 0; _ai < canAdd; _ai++) {
                    p.actualHolders.push({ name:'', generated:false, placeholderId:'ph_'+Math.random().toString(36).slice(2,8), filledTurn: GM.turn });
                  }
                  p.vacancyCount = Math.max(0, (p.establishedCount||p.headCount||1) - p.actualCount);
                  delta -= canAdd;
                } else if (delta < 0 && (p.actualCount||0) > _offMaterializedCount(p)) {
                  var canRemove = Math.min(-delta, (p.actualCount||0) - _offMaterializedCount(p));
                  p.actualCount = (p.actualCount||0) - canRemove;
                  // 新模型同步：移除占位（仅 generated:false 的），增加 vacancyCount
                  if (Array.isArray(p.actualHolders)) {
                    for (var _ri = 0; _ri < canRemove; _ri++) {
                      var _phIdx = p.actualHolders.findIndex(function(h){return h && h.generated===false;});
                      if (_phIdx >= 0) p.actualHolders.splice(_phIdx, 1);
                    }
                  }
                  p.vacancyCount = Math.max(0, (p.establishedCount||p.headCount||1) - p.actualCount);
                  delta += canRemove;
                }
              });
              if (delta > 0) addEB('官制', oa.dept + '递补' + delta + '人');
              else if (delta < 0) addEB('官制', oa.dept + '减员' + Math.abs(delta) + '人');
            }
            // 考评摘要（存入部门级别）
            if (oa.evaluation_summary) {
              if (!_targetDept._evalHistory) _targetDept._evalHistory = [];
              _targetDept._evalHistory.push({ turn: GM.turn, summary: oa.evaluation_summary });
              if (_targetDept._evalHistory.length > 5) _targetDept._evalHistory.shift();
              // 具象角色的考评同步到position._evaluations
              var _namedAll = [].concat(oa.evaluation_summary.named_excellent||[], oa.evaluation_summary.named_good||[], oa.evaluation_summary.named_average||[], oa.evaluation_summary.named_poor||[]);
              _namedAll.forEach(function(name) {
                var _grade = (oa.evaluation_summary.named_excellent||[]).indexOf(name) >= 0 ? '卓越' :
                             (oa.evaluation_summary.named_good||[]).indexOf(name) >= 0 ? '称职' :
                             (oa.evaluation_summary.named_poor||[]).indexOf(name) >= 0 ? '失职' : '平庸';
                (_targetDept.positions||[]).forEach(function(p) {
                  if (p.holder === name || (p.additionalHolders||[]).indexOf(name) >= 0) {
                    if (!p._evaluations) p._evaluations = [];
                    p._evaluations.push({ turn: GM.turn, evaluator: '有司', grade: _grade, comment: '', holder: name });
                  }
                });
              });
              if (oa.narrative) addEB('考评', oa.narrative);
            }
            // 贪腐查处
            if (oa.corruption_found) {
              addEB('吏治', oa.dept + '查出' + oa.corruption_found + '人贪腐' + ((oa.named_corrupt||[]).length > 0 ? '（' + oa.named_corrupt.join('、') + '等）' : ''));
            }
          });
        }

        // 处理封臣关系变动（AI新通道）
        if (p1.vassal_changes && Array.isArray(p1.vassal_changes)) {
          p1.vassal_changes.forEach(function(vc) {
            if (!vc.action) return;
            if (vc.action === 'establish' && vc.vassal && vc.liege) {
              if (typeof establishVassalage === 'function') {
                var ok = establishVassalage(vc.vassal, vc.liege);
                if (ok) {
                  if (vc.tributeRate !== undefined) {
                    var _vFac = GM._indices.facByName ? GM._indices.facByName.get(vc.vassal) : null;
                    if (_vFac) _vFac.tributeRate = clamp(parseFloat(vc.tributeRate) || 0.3, 0.05, 0.8);
                  }
                  addEB('\u5C01\u81E3', vc.vassal + '\u6210\u4E3A' + vc.liege + '\u7684\u5C01\u81E3' + (vc.reason ? '(' + vc.reason + ')' : ''));
                }
              }
            } else if (vc.action === 'break' && vc.vassal) {
              if (typeof breakVassalage === 'function') {
                var ok2 = breakVassalage(vc.vassal);
                if (ok2) addEB('\u5C01\u81E3', vc.vassal + '\u8131\u79BB\u5C01\u81E3\u5173\u7CFB' + (vc.reason ? '(' + vc.reason + ')' : ''));
              }
            } else if (vc.action === 'change_tribute' && vc.vassal && vc.tributeRate !== undefined) {
              var _vf = GM._indices.facByName ? GM._indices.facByName.get(vc.vassal) : null;
              if (_vf && _vf.liege) {
                var oldRate = _vf.tributeRate || 0.3;
                _vf.tributeRate = clamp(parseFloat(vc.tributeRate) || 0.3, 0.05, 0.8);
                addEB('\u5C01\u81E3', vc.vassal + '\u8D21\u8D4B\u6BD4\u4F8B\u8C03\u6574\uFF1A' + Math.round(oldRate*100) + '%\u2192' + Math.round(_vf.tributeRate*100) + '%' + (vc.reason ? '(' + vc.reason + ')' : ''));
              }
            }
          });
        }

        // 处理头衔爵位变动（AI新通道）
        if (p1.title_changes && Array.isArray(p1.title_changes)) {
          p1.title_changes.forEach(function(tc) {
            if (!tc.action || !tc.character) return;
            var _tch = findCharByName(tc.character);
            if (!_tch) return;
            if (!_tch.titles) _tch.titles = [];

            if (tc.action === 'grant') {
              // 册封头衔
              var _tName = tc.titleName || '';
              var _tLevel = parseInt(tc.titleLevel) || 5;
              var _existing = _tch.titles.find(function(t) { return t.name === _tName; });
              if (!_existing && _tName) {
                _tch.titles.push({
                  name: _tName, level: _tLevel,
                  hereditary: tc.hereditary || false,
                  grantedTurn: GM.turn, grantedBy: tc.grantedBy || '\u671D\u5EF7',
                  privileges: tc.privileges || [], _suppressed: []
                });
                addEB('\u518C\u5C01', tc.character + '\u88AB\u518C\u5C01\u4E3A' + _tName + (tc.reason ? '(' + tc.reason + ')' : ''));
                if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_grant', '\u518C\u5C01' + _tName);
                _tch.loyalty = Math.min(100, (_tch.loyalty || 50) + 5);
              }
            } else if (tc.action === 'revoke') {
              // 剥夺头衔
              var _tIdx = _tch.titles.findIndex(function(t) { return t.name === (tc.titleName || ''); });
              if (_tIdx !== -1) {
                var _removed = _tch.titles.splice(_tIdx, 1)[0];
                addEB('\u964D\u7235', tc.character + '\u7684' + _removed.name + '\u5934\u8854\u88AB\u5265\u593A' + (tc.reason ? '(' + tc.reason + ')' : ''));
                if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_revoke', '\u88AB\u593A' + _removed.name);
                _tch.loyalty = Math.max(0, (_tch.loyalty || 50) - 15);
                _tch.stress = Math.min(100, (_tch.stress || 0) + 10);
              }
            } else if (tc.action === 'promote') {
              // 晋升头衔（移除旧最高，授予新的更高头衔）
              var _tName2 = tc.titleName || '';
              var _tLevel2 = parseInt(tc.titleLevel) || 3;
              // 移除同类型的旧头衔（等级更低的）
              _tch.titles = _tch.titles.filter(function(t) { return t.level <= _tLevel2; });
              _tch.titles.push({
                name: _tName2, level: _tLevel2,
                hereditary: tc.hereditary || false,
                grantedTurn: GM.turn, grantedBy: '\u671D\u5EF7',
                privileges: tc.privileges || [], _suppressed: []
              });
              addEB('\u664B\u7235', tc.character + '\u664B\u5347\u4E3A' + _tName2 + (tc.reason ? '(' + tc.reason + ')' : ''));
              if (typeof recordCharacterArc === 'function') recordCharacterArc(tc.character, 'title_promote', '\u664B\u5347' + _tName2);
              _tch.loyalty = Math.min(100, (_tch.loyalty || 50) + 3);
            } else if (tc.action === 'inherit' && tc.from) {
              // 继承头衔
              var _deceased = findCharByName(tc.from);
              if (_deceased && _deceased.titles) {
                var _iTitle = _deceased.titles.find(function(t) { return t.name === (tc.titleName || ''); });
                if (_iTitle && (_iTitle.hereditary || (GM.eraState && (GM.eraState.centralControl || 0.5) < 0.5))) {
                  _tch.titles.push({
                    name: _iTitle.name, level: _iTitle.level,
                    hereditary: _iTitle.hereditary,
                    grantedTurn: GM.turn, grantedBy: tc.from + '(\u7EE7\u627F)',
                    privileges: _iTitle.privileges || [], _suppressed: _iTitle._suppressed || []
                  });
                  addEB('\u7EE7\u627F', tc.character + '\u7EE7\u627F\u4E86' + tc.from + '\u7684' + _iTitle.name + '\u5934\u8854');
                }
              }
            }
          });
        }

        // 处理建筑变动（AI新通道）
        if (p1.building_changes && Array.isArray(p1.building_changes)) {
          // 确保GM建筑数据结构存在
          if (!GM.buildings) GM.buildings = [];
          if (!GM._indices) GM._indices = {};
          if (!GM._indices.buildingById) GM._indices.buildingById = new Map();
          if (!GM._indices.buildingByTerritory) GM._indices.buildingByTerritory = new Map();

          p1.building_changes.forEach(function(bc) {
            if (!bc.action || !bc.territory) return;

            // 同步写入 adminHierarchy 的 division.buildings（新模式——去结构化，由AI自判效果）
            if (bc.action === 'build' || bc.action === 'custom_build' || bc.action === 'upgrade' || bc.action === 'destroy') {
              if (P.adminHierarchy) {
                var _targetDiv = null;
                Object.keys(P.adminHierarchy).forEach(function(fk) {
                  var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
                  (function _walk(ds) {
                    ds.forEach(function(d) {
                      if (d.name === bc.territory) _targetDiv = d;
                      if (d.children) _walk(d.children);
                      if (d.divisions) _walk(d.divisions);
                    });
                  })(fh.divisions);
                });
                if (_targetDiv) {
                  if (!_targetDiv.buildings) _targetDiv.buildings = [];
                  if (bc.action === 'destroy') {
                    _targetDiv.buildings = _targetDiv.buildings.filter(function(b) { return b.name !== bc.type; });
                    addEB('\u5EFA\u8BBE', bc.territory + '拆除 ' + bc.type);
                  } else if (bc.action === 'upgrade') {
                    var _exB = _targetDiv.buildings.find(function(b) { return b.name === bc.type; });
                    if (_exB) {
                      _exB.level = (_exB.level || 1) + 1;
                      addEB('\u5EFA\u8BBE', bc.territory + '的' + bc.type + '升级至' + _exB.level + '级');
                    }
                  } else {
                    // build 或 custom_build
                    var _isCustom = bc.action === 'custom_build' || bc.isCustom;
                    var _feasibility = bc.feasibility || '合理';
                    if (_feasibility === '不合理') {
                      addEB('\u5EFA\u8BBE', bc.territory + '拟建 ' + bc.type + ' 因不合理未能实施');
                    } else {
                      _targetDiv.buildings.push({
                        name: bc.type,
                        level: bc.level || 1,
                        isCustom: _isCustom,
                        description: bc.description || '',
                        judgedEffects: bc.judgedEffects || '',
                        costActual: bc.costActual || null,
                        timeActual: bc.timeActual || null,
                        status: (bc.timeActual && bc.timeActual > 0) ? 'building' : 'completed',
                        remainingTurns: bc.timeActual || 0,
                        startTurn: GM.turn
                      });
                      addEB('\u5EFA\u8BBE', bc.territory + (_isCustom?'自定义建造 ':'建造 ') + bc.type + (_feasibility!=='合理'?('('+_feasibility+')'):'') + (bc.reason?' —— '+bc.reason:''));
                    }
                  }
                }
              }
            }

            // 以下为旧版本的 BUILDING_TYPES/GM.buildings 逻辑（保留兼容）
            // 支持中文建筑名匹配到type key
            var _bcType = (bc.type || '').replace(/\s/g, '_').toLowerCase();
            if (!_bcType) return;
            // 如果type是中文名，尝试从BUILDING_TYPES反查key
            if (typeof BUILDING_TYPES !== 'undefined') {
              var _btKeys = Object.keys(BUILDING_TYPES);
              for (var _bk = 0; _bk < _btKeys.length; _bk++) {
                if (BUILDING_TYPES[_btKeys[_bk]].name === bc.type) { _bcType = _btKeys[_bk]; break; }
              }
            }

            if (bc.action === 'build' && _bcType) {
              if (typeof createBuilding === 'function') {
                // 推断势力归属
                var _bFaction = bc.faction || '';
                if (!_bFaction && GM.facs) {
                  var _ownerFac = GM.facs.find(function(f) { return f.territories && f.territories.indexOf(bc.territory) !== -1; });
                  if (_ownerFac) _bFaction = _ownerFac.name;
                }
                var _newB = createBuilding(_bcType, bc.level || 1, _bFaction, bc.territory);
                GM.buildings.push(_newB);
                GM._indices.buildingById.set(_newB.id, _newB);
                if (!GM._indices.buildingByTerritory.has(bc.territory)) GM._indices.buildingByTerritory.set(bc.territory, []);
                GM._indices.buildingByTerritory.get(bc.territory).push(_newB);
                addEB('\u5EFA\u8BBE', bc.territory + '\u5EFA\u9020\u4E86' + _newB.name + (bc.reason ? '(' + bc.reason + ')' : ''));
              }
            } else if (bc.action === 'upgrade' && _bcType) {
              // 升级建筑
              var _bList = GM._indices.buildingByTerritory ? GM._indices.buildingByTerritory.get(bc.territory) : null;
              if (_bList) {
                var _bMatch = _bList.find(function(b) { return b.type === _bcType; });
                if (_bMatch) {
                  var _btInfo = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES[_bcType] : null;
                  var _maxLv = (_btInfo && _btInfo.maxLevel) || 5;
                  if (_bMatch.level < _maxLv) {
                    _bMatch.level++;
                    if (typeof getBuildingEffects === 'function') _bMatch.effects = getBuildingEffects(_bcType, _bMatch.level);
                    addEB('\u5EFA\u8BBE', bc.territory + '\u7684' + _bMatch.name + '\u5347\u7EA7\u81F3' + _bMatch.level + '\u7EA7' + (bc.reason ? '(' + bc.reason + ')' : ''));
                  }
                }
              }
            } else if (bc.action === 'destroy' && _bcType) {
              // 拆除建筑
              var _bList2 = GM._indices.buildingByTerritory ? GM._indices.buildingByTerritory.get(bc.territory) : null;
              if (_bList2) {
                var _bIdx = _bList2.findIndex(function(b) { return b.type === _bcType; });
                if (_bIdx !== -1) {
                  var _removed = _bList2.splice(_bIdx, 1)[0];
                  if (GM.buildings) GM.buildings = GM.buildings.filter(function(b) { return b.id !== _removed.id; });
                  if (GM._indices.buildingById) GM._indices.buildingById.delete(_removed.id);
                  addEB('\u5EFA\u8BBE', bc.territory + '\u7684' + _removed.name + '\u88AB\u62C6\u9664' + (bc.reason ? '(' + bc.reason + ')' : ''));
                }
              }
            }
          });
        }

        // 处理行政区划变动（AI新通道）
        if (p1.admin_changes && Array.isArray(p1.admin_changes) && P.adminHierarchy) {
          p1.admin_changes.forEach(function(ac) {
            if (!ac.action || !ac.division) return;

            // 在行政区划树中查找目标节点
            var _targetDiv = null;
            function _findDiv(divs) {
              for (var i = 0; i < divs.length; i++) {
                if (divs[i].name === ac.division) { _targetDiv = divs[i]; return; }
                if (divs[i].children) _findDiv(divs[i].children);
              }
            }
            var _adminKeys = Object.keys(P.adminHierarchy);
            for (var _ak = 0; _ak < _adminKeys.length; _ak++) {
              var _ah = P.adminHierarchy[_adminKeys[_ak]];
              if (_ah && _ah.divisions) _findDiv(_ah.divisions);
              if (_targetDiv) break;
            }

            if (!_targetDiv) return;

            if (ac.action === 'appoint_governor' && ac.person) {
              var oldGov = _targetDiv.governor || '';
              _targetDiv.governor = ac.person;
              addEB('\u4EFB\u547D', ac.person + '\u88AB\u4EFB\u547D\u4E3A' + ac.division + '\u4E3B\u5B98' + (ac.reason ? '(' + ac.reason + ')' : ''));
              var _govCh = findCharByName(ac.person);
              if (_govCh) _govCh.loyalty = Math.min(100, (_govCh.loyalty || 50) + 3);
              // 同步到officeTree：如果该行政单位有officialPosition，同步到对应position.holder
              if (_targetDiv.officialPosition && GM.officeTree) {
                (function _syncOffPos(nodes) {
                  nodes.forEach(function(nd) {
                    if (nd.positions) {
                      nd.positions.forEach(function(p) {
                        if (p.name === _targetDiv.officialPosition && (!p.holder || p.holder === oldGov)) {
                          p.holder = ac.person;
                        }
                      });
                    }
                    if (nd.subs) _syncOffPos(nd.subs);
                  });
                })(GM.officeTree);
              }
            } else if (ac.action === 'remove_governor') {
              var _removedGov = _targetDiv.governor;
              _targetDiv.governor = '';
              if (_removedGov) {
                addEB('\u7F62\u514D', _removedGov + '\u88AB\u514D\u53BB' + ac.division + '\u4E3B\u5B98' + (ac.reason ? '(' + ac.reason + ')' : ''));
                var _rCh = findCharByName(_removedGov);
                if (_rCh) { _rCh.loyalty = Math.max(0, (_rCh.loyalty || 50) - 8); _rCh.stress = Math.min(100, (_rCh.stress || 0) + 10); }
                // 同步清除officeTree中的holder
                if (_targetDiv.officialPosition && GM.officeTree) {
                  (function _clrOffPos(nodes) {
                    nodes.forEach(function(nd) {
                      if (nd.positions) nd.positions.forEach(function(p) { if (p.name === _targetDiv.officialPosition && p.holder === _removedGov) p.holder = ''; });
                      if (nd.subs) _clrOffPos(nd.subs);
                    });
                  })(GM.officeTree);
                }
              }
            } else if (ac.action === 'adjust') {
              addEB('\u5730\u65B9', ac.division + ': ' + (ac.reason || '\u5730\u65B9\u5B98\u6CBB\u7406'));
            }

            // delta字段统一处理（所有action类型都可附带）
            if (ac.prosperity_delta) {
              _targetDiv.prosperity = clamp((_targetDiv.prosperity || 50) + clamp(parseInt(ac.prosperity_delta) || 0, -20, 20), 0, 100);
            }
            if (ac.population_delta) {
              _targetDiv.population = Math.max(0, (_targetDiv.population || 50000) + clamp(parseInt(ac.population_delta) || 0, -50000, 50000));
            }

            // 同步到地方区划
            if (GM.provinceStats && GM.provinceStats[ac.division]) {
              var _ps = GM.provinceStats[ac.division];
              if (_targetDiv.governor !== undefined) _ps.governor = _targetDiv.governor;
              if (_targetDiv.prosperity !== undefined) _ps.wealth = _targetDiv.prosperity;
              if (_targetDiv.population !== undefined) _ps.population = _targetDiv.population;
              if (ac.corruption_delta) _ps.corruption = clamp((_ps.corruption || 0) + clamp(parseInt(ac.corruption_delta) || 0, -20, 20), 0, 100);
              if (ac.stability_delta) _ps.stability = clamp((_ps.stability || 50) + clamp(parseInt(ac.stability_delta) || 0, -20, 20), 0, 100);
              if (ac.unrest_delta) _ps.unrest = clamp((_ps.unrest || 0) + clamp(parseInt(ac.unrest_delta) || 0, -20, 20), 0, 100);
            }
          });
        }

        // 处理中国化管辖层级变更（封建/削藩/改土归流等）
        if (p1.autonomy_changes && Array.isArray(p1.autonomy_changes) && P.adminHierarchy) {
          p1.autonomy_changes.forEach(function(ac) {
            if (!ac || !ac.action || !ac.division) return;
            // 查找区划
            var _targetAutDiv = null;
            Object.keys(P.adminHierarchy).forEach(function(fk) {
              var fh = P.adminHierarchy[fk];
              if (!fh || !fh.divisions) return;
              (function _w(ds) {
                ds.forEach(function(d) { if (d.name === ac.division) _targetAutDiv = d; if (d.divisions) _w(d.divisions); });
              })(fh.divisions);
            });
            if (!_targetAutDiv) return;
            // 按动作分支
            if (ac.action === 'enfeoff_prince' || ac.action === 'enfeoff_duke') {
              _targetAutDiv.autonomy = {
                type: 'fanguo',
                subtype: ac.subtype || (ac.action === 'enfeoff_prince' ? 'real' : 'nominal'),
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 80,
                tributeRate: ac.tributeRate || (ac.subtype === 'real' ? 0.5 : 0.15),
                grantedTurn: GM.turn
              };
              addEB('\u518C\u5C01', (ac.holder || '某人') + ' 受封为' + (ac.titleName || '王') + '，封地 ' + ac.division);
              // NPC 记忆：受封者感恩
              if (ac.holder && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(ac.holder, '受封' + (ac.titleName || '王') + '于' + ac.division + '，皇恩浩荡', '喜', 8);
              }
            } else if (ac.action === 'enfeoff_tusi') {
              _targetAutDiv.autonomy = {
                type: 'jimi', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '宣慰使',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 70,
                tributeRate: ac.tributeRate || 0.1
              };
              addEB('\u6388\u7F81\u7E3B', (ac.holder || '某部') + ' 授' + (ac.titleName || '宣慰使') + '，镇守 ' + ac.division);
            } else if (ac.action === 'invest_tributary') {
              _targetAutDiv.autonomy = {
                type: 'chaogong', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 60,
                tributeRate: ac.tributeRate || 0.05
              };
              addEB('\u518C\u5C01\u5C5E\u56FD', (ac.holder || '某国') + ' 受册为属国，朝贡 ' + ac.division);
            } else if (ac.action === 'establish_fanzhen') {
              _targetAutDiv.autonomy = {
                type: 'fanzhen', subtype: null,
                holder: ac.holder || '',
                suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
                titleType: ac.titleName || '节度使',
                loyalty: ac.loyalty !== undefined ? ac.loyalty : 50,
                tributeRate: ac.tributeRate || 0.1
              };
              addEB('\u8BBE\u7F6E\u85E9\u9547', (ac.holder || '') + ' 任' + (ac.titleName || '节度使') + '，镇守 ' + ac.division);
            } else if (ac.action === 'grace_edict') {
              // 推恩令——分封子弟后逐代分薄
              if (_targetAutDiv.autonomy) {
                _targetAutDiv.autonomy.gracePartitions = (_targetAutDiv.autonomy.gracePartitions || 0) + 1;
                var _holder = _targetAutDiv.autonomy.holder;
                if (_targetAutDiv.autonomy.gracePartitions >= 5) {
                  // 五代后自动回收
                  _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
                  addEB('\u63A8\u6069\u4EE4', ac.division + ' 五代分封完毕，自然回归直辖');
                } else {
                  // 削弱藩王实力
                  _targetAutDiv.autonomy.loyalty = Math.min(100, (_targetAutDiv.autonomy.loyalty || 70) + 5);
                  _targetAutDiv.autonomy.tributeRate = Math.max(0.05, (_targetAutDiv.autonomy.tributeRate || 0.3) - 0.05);
                  addEB('\u63A8\u6069\u4EE4', ac.division + ' 行推恩（第' + _targetAutDiv.autonomy.gracePartitions + '代），藩权逐代分薄');
                }
                // NPC记忆：持爵者忧虑
                if (_holder && typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(_holder, '朝廷行推恩令于 ' + ac.division + '，宗业渐分于子孙，藩权日薄', '忧', 6);
                }
              }
            } else if (ac.action === 'abolish_fief') {
              // 削藩——直接回收，引发忠诚暴跌
              var _hld = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u524A\u85E9', '回收' + _hld + '之封地 ' + ac.division + '，改为直辖');
              // 如果该 holder 对应一个势力，忠诚度暴跌 + 初始化 rebellionRisk
              var _hldFac = (GM.facs || []).find(function(f) { return f.name === _hld; });
              if (_hldFac) {
                _hldFac.loyaltyToLiege = Math.max(0, (_hldFac.loyaltyToLiege !== undefined ? _hldFac.loyaltyToLiege : 60) - 40);
                _hldFac.rebellionRisk = Math.min(100, (_hldFac.rebellionRisk !== undefined ? _hldFac.rebellionRisk : 20) + 40);
              }
              // 持爵者 NPC 本人记仇
              var _hldChar = GM._indices && GM._indices.charByName ? GM._indices.charByName.get(_hld) : null;
              if (_hldChar && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_hld, '封地' + ac.division + '被朝廷削夺，宗业尽失', '恨', 10);
                if (_hldChar.loyalty !== undefined) _hldChar.loyalty = Math.max(0, _hldChar.loyalty - 30);
                if (_hldChar.ambition !== undefined) _hldChar.ambition = Math.min(100, (_hldChar.ambition||50) + 20);
              }
            } else if (ac.action === 'tusi_to_liuguan') {
              // 改土归流
              var _oldTusi = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u6539\u571F\u5F52\u6D41', ac.division + ' 改土归流，设流官');
              if (_oldTusi && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_oldTusi, '祖传土司之位被改流官夺去，族人散失', '恨', 9);
              }
            } else if (ac.action === 'conquer_as_prefecture') {
              // 征讨设郡
              var _oldKing = _targetAutDiv.autonomy && _targetAutDiv.autonomy.holder || '';
              _targetAutDiv.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
              addEB('\u5F81\u4F10\u8BBE\u90E1', '征讨' + ac.division + '，于其地置郡');
              if (_oldKing && typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(_oldKing, '国破家亡，宗社沦丧于 ' + ac.division, '恨', 10);
              }
            }
          });
        }

        // 处理行政区划树结构变更（P1/P2/P4）
        if (p1.admin_division_updates && Array.isArray(p1.admin_division_updates) && P.adminHierarchy) {
          // 确定玩家行政区划数据
          var _ahPlayerKey = P.adminHierarchy.player ? 'player' : null;
          if (!_ahPlayerKey) {
            var _ahks = Object.keys(P.adminHierarchy);
            for (var _ki = 0; _ki < _ahks.length; _ki++) {
              if (P.adminHierarchy[_ahks[_ki]] && P.adminHierarchy[_ahks[_ki]].divisions) { _ahPlayerKey = _ahks[_ki]; break; }
            }
          }
          var _ahPlayer = _ahPlayerKey ? P.adminHierarchy[_ahPlayerKey] : null;
          if (_ahPlayer) {
            // 辅助：在树中查找节点（返回 { node, parent, index }）
            function _findAdminNode(name, divs, parent) {
              for (var i = 0; i < divs.length; i++) {
                if (divs[i].name === name) return { node: divs[i], parent: parent, arr: divs, index: i };
                if (divs[i].children && divs[i].children.length > 0) {
                  var r = _findAdminNode(name, divs[i].children, divs[i]);
                  if (r) return r;
                }
              }
              return null;
            }

            p1.admin_division_updates.forEach(function(adu) {
              if (!adu.action) return;
              var act = adu.action;

              if (act === 'add') {
                // 新增行政区到指定上级下
                var newDiv = {
                  id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: adu.division || '未命名',
                  level: adu.level || '',
                  officialPosition: adu.officialPosition || '',
                  governor: adu.governor || '',
                  description: adu.description || '',
                  population: parseInt(adu.population) || 50000,
                  prosperity: parseInt(adu.prosperity) || 50,
                  terrain: adu.terrain || '',
                  specialResources: adu.specialResources || '',
                  taxLevel: adu.taxLevel || '\u4E2D',
                  children: []
                };
                if (adu.parentDivision) {
                  var parentFound = _findAdminNode(adu.parentDivision, _ahPlayer.divisions, null);
                  if (parentFound) {
                    if (!parentFound.node.children) parentFound.node.children = [];
                    parentFound.node.children.push(newDiv);
                  } else {
                    _ahPlayer.divisions.push(newDiv); // 找不到上级则添加为顶级
                  }
                } else {
                  _ahPlayer.divisions.push(newDiv);
                }
                // 同步到provinceStats
                if (!GM.provinceStats) GM.provinceStats = {};
                var _playerFacName = (P.playerInfo && P.playerInfo.factionName) || '';
                GM.provinceStats[newDiv.name] = {
                  name: newDiv.name, owner: _playerFacName,
                  population: newDiv.population, wealth: newDiv.prosperity,
                  stability: 60, development: Math.round(newDiv.prosperity * 0.8),
                  taxRevenue: 0, militaryRecruits: 0,
                  unrest: 15, corruption: 25,
                  terrain: newDiv.terrain, specialResources: newDiv.specialResources,
                  governor: newDiv.governor, taxLevel: newDiv.taxLevel
                };
                addEB('\u884C\u653F', '\u65B0\u589E\u884C\u653F\u533A\u5212\uFF1A' + newDiv.name + (adu.reason ? '(' + adu.reason + ')' : ''));

              } else if (act === 'remove') {
                var found = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (found) {
                  found.arr.splice(found.index, 1);
                  if (GM.provinceStats && GM.provinceStats[adu.division]) delete GM.provinceStats[adu.division];
                  addEB('\u884C\u653F', '\u64A4\u9500\u884C\u653F\u533A\u5212\uFF1A' + adu.division + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'rename') {
                var found = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (found && adu.newName) {
                  var oldName = found.node.name;
                  found.node.name = adu.newName;
                  // 同步provinceStats
                  if (GM.provinceStats && GM.provinceStats[oldName]) {
                    GM.provinceStats[adu.newName] = GM.provinceStats[oldName];
                    GM.provinceStats[adu.newName].name = adu.newName;
                    delete GM.provinceStats[oldName];
                  }
                  addEB('\u884C\u653F', oldName + '\u6539\u540D\u4E3A' + adu.newName + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'merge') {
                // 合并：将源节点数据并入目标节点，删除源节点
                if (adu.division === adu.mergeInto) return; // 防止自我合并
                var src = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                var dst = adu.mergeInto ? _findAdminNode(adu.mergeInto, _ahPlayer.divisions, null) : null;
                if (src && dst && src.node !== dst.node) {
                  // 合并人口
                  dst.node.population = (dst.node.population || 0) + (src.node.population || 0);
                  // 合并子节点
                  if (src.node.children && src.node.children.length > 0) {
                    if (!dst.node.children) dst.node.children = [];
                    dst.node.children = dst.node.children.concat(src.node.children);
                  }
                  src.arr.splice(src.index, 1);
                  // 同步provinceStats
                  if (GM.provinceStats) {
                    var _srcPS = GM.provinceStats[adu.division];
                    var _dstPS = GM.provinceStats[adu.mergeInto];
                    if (_srcPS && _dstPS) {
                      _dstPS.population += _srcPS.population || 0;
                      _dstPS.taxRevenue += _srcPS.taxRevenue || 0;
                      _dstPS.militaryRecruits += _srcPS.militaryRecruits || 0;
                    }
                    delete GM.provinceStats[adu.division];
                  }
                  addEB('\u884C\u653F', adu.division + '\u5E76\u5165' + adu.mergeInto + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'split') {
                // 拆分：原节点保留，创建新节点分走部分人口
                var orig = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (orig && adu.splitResult && Array.isArray(adu.splitResult) && adu.splitResult.length > 0) {
                  var parentArr = orig.parent ? orig.parent.children : _ahPlayer.divisions;
                  var splitCount = adu.splitResult.length;
                  var popPerSplit = Math.floor((orig.node.population || 50000) / (splitCount + 1));
                  orig.node.population = popPerSplit; // 原节点保留一份
                  adu.splitResult.forEach(function(newName) {
                    var newDiv = {
                      id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                      name: newName, level: orig.node.level || '',
                      officialPosition: orig.node.officialPosition || '',
                      governor: '', description: '\u62C6\u5206\u81EA' + adu.division,
                      population: popPerSplit, prosperity: orig.node.prosperity || 50,
                      terrain: orig.node.terrain || '', specialResources: '',
                      taxLevel: orig.node.taxLevel || '\u4E2D', children: []
                    };
                    parentArr.push(newDiv);
                  });
                  addEB('\u884C\u653F', adu.division + '\u62C6\u5206\u4E3A' + adu.splitResult.join('\u3001') + (adu.reason ? '(' + adu.reason + ')' : ''));
                }

              } else if (act === 'territory_gain') {
                // P2: 获得领土 → 创建"未定行政区"临时顶级节点
                var undetermined = _findAdminNode('\u672A\u5B9A\u884C\u653F\u533A', _ahPlayer.divisions, null);
                if (!undetermined) {
                  var undNode = {
                    id: 'div_undetermined', name: '\u672A\u5B9A\u884C\u653F\u533A',
                    level: '\u4E34\u65F6', officialPosition: '',
                    description: '\u65B0\u83B7\u5F97\u9886\u571F\uFF0C\u7B49\u5F85\u7BA1\u7406\u65B9\u6848',
                    population: 0, prosperity: 30, terrain: '', taxLevel: '\u4E2D',
                    children: []
                  };
                  _ahPlayer.divisions.push(undNode);
                  undetermined = { node: undNode };
                }
                // 添加获得的行政区到未定行政区下
                var gainDiv = {
                  id: 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  name: adu.division || '\u65B0\u9886\u571F',
                  level: adu.level || '', officialPosition: adu.officialPosition || '',
                  governor: '', description: '\u4ECE' + (adu.gainedFrom || '\u654C\u65B9') + '\u83B7\u5F97',
                  population: parseInt(adu.population) || 30000, prosperity: parseInt(adu.prosperity) || 30,
                  terrain: adu.terrain || '', specialResources: adu.specialResources || '',
                  taxLevel: adu.taxLevel || '\u4E2D', children: []
                };
                if (!undetermined.node.children) undetermined.node.children = [];
                undetermined.node.children.push(gainDiv);
                undetermined.node.population += gainDiv.population;
                // 同步provinceStats
                if (!GM.provinceStats) GM.provinceStats = {};
                var _pfn = (P.playerInfo && P.playerInfo.factionName) || '';
                GM.provinceStats[gainDiv.name] = {
                  name: gainDiv.name, owner: _pfn,
                  population: gainDiv.population, wealth: gainDiv.prosperity,
                  stability: 40, development: 30,
                  taxRevenue: 0, militaryRecruits: 0,
                  unrest: 30, corruption: 30,
                  terrain: gainDiv.terrain, specialResources: gainDiv.specialResources,
                  governor: '', taxLevel: gainDiv.taxLevel
                };
                addEB('\u9886\u571F', '\u83B7\u5F97\u9886\u571F\uFF1A' + gainDiv.name + '\uFF0C\u7EB3\u5165\u672A\u5B9A\u884C\u653F\u533A' + (adu.reason ? '(' + adu.reason + ')' : ''));
                // 触发上奏/议程
                if (GM.memorials) {
                  GM.memorials.push({
                    type: 'territory', priority: 'urgent', turn: GM.turn, status: 'pending',
                    title: '\u65B0\u83B7\u9886\u571F' + gainDiv.name + '\u7BA1\u7406\u65B9\u6848',
                    content: '\u81E3\u5949\u8868\uFF1A\u65B0\u83B7' + gainDiv.name + '\u5C1A\u672A\u8BBE\u7F6E\u884C\u653F\u533A\u5212\u548C\u5730\u65B9\u5B98\uFF0C\u8BF7\u965B\u4E0B\u5B9A\u593A\u7BA1\u7406\u65B9\u6848\u3002',
                    from: '\u6709\u53F8', reply: ''
                  });
                }

              } else if (act === 'territory_loss') {
                // P2: 丢失领土 → 数据对玩家清零
                var lost = _findAdminNode(adu.division, _ahPlayer.divisions, null);
                if (lost) {
                  // 记录丢失前数据（供侨置用）
                  if (!GM._lostTerritories) GM._lostTerritories = {};
                  GM._lostTerritories[adu.division] = {
                    node: JSON.parse(JSON.stringify(lost.node)),
                    lostTo: adu.lostTo || '\u654C\u65B9',
                    turn: GM.turn
                  };
                  // 从玩家树中移除
                  lost.arr.splice(lost.index, 1);
                  // 从provinceStats中移除
                  if (GM.provinceStats && GM.provinceStats[adu.division]) {
                    delete GM.provinceStats[adu.division];
                  }
                  // 递归移除所有子节点的provinceStats
                  function _removeChildPS(children) {
                    if (!children) return;
                    children.forEach(function(c) {
                      if (GM.provinceStats && GM.provinceStats[c.name]) delete GM.provinceStats[c.name];
                      if (c.children) _removeChildPS(c.children);
                    });
                  }
                  _removeChildPS(lost.node.children);
                  addEB('\u9886\u571F', '\u4E22\u5931\u9886\u571F\uFF1A' + adu.division + '\uFF0C\u5F52\u5C5E' + (adu.lostTo || '\u654C\u65B9') + (adu.reason ? '(' + adu.reason + ')' : ''));
                  // 地方官受影响 + NPC记忆
                  var _lostGov = lost.node.governor;
                  if (_lostGov) {
                    var _lgCh = findCharByName(_lostGov);
                    if (_lgCh) {
                      _lgCh.loyalty = Math.max(0, (_lgCh.loyalty || 50) - 10);
                      _lgCh.stress = Math.min(100, (_lgCh.stress || 0) + 15);
                      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                        NpcMemorySystem.remember(_lostGov, '\u6240\u8F96' + adu.division + '\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u5BF9\u6B64\u6DF1\u611F\u7126\u8651\u548C\u7F9A\u803B', 'trauma');
                      }
                    }
                  }
                  // 触发侨置决策上奏
                  if (GM.memorials) {
                    GM.memorials.push({
                      type: 'territory', priority: 'urgent', turn: GM.turn, status: 'pending',
                      title: adu.division + '\u5931\u9677\uFF0C\u662F\u5426\u4FA8\u7F6E\uFF1F',
                      content: '\u81E3\u5949\u8868\uFF1A' + adu.division + '\u5DF2\u5931\u9677\u4E8E' + (adu.lostTo || '\u654C\u65B9') + '\uFF0C\u8BF7\u965B\u4E0B\u5B9A\u593A\u662F\u5426\u4FA8\u7F6E\u6B64\u5730\u884C\u653F\u533A\u5212\u3002',
                      from: '\u6709\u53F8', reply: '',
                      _qiaozhiTarget: adu.division
                    });
                  }
                }

              } else if (act === 'reform') {
                // P4: 行政改革
                addEB('\u884C\u653F', '\u884C\u653F\u6539\u9769\uFF1A' + (adu.division || '') + ' ' + (adu.description || adu.reason || ''));
              }
            });
          }
        }

        // 处理后宫事件
        if (p1.harem_events && Array.isArray(p1.harem_events) && GM.harem) {
          p1.harem_events.forEach(function(he) {
            if (!he.type || !he.character) return;
            if (he.type === 'pregnancy') {
              if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
              GM.harem.pregnancies.push({ mother: he.character, startTurn: GM.turn, detail: he.detail || '' });
              addEB('\u540E\u5BAB', he.character + '\u6709\u5B55');
            } else if (he.type === 'birth') {
              addEB('\u540E\u5BAB', he.character + '\u8BDE\u4E0B\u5B50\u55E3' + (he.detail || ''));
              // 从pregnancies移除
              if (GM.harem.pregnancies) GM.harem.pregnancies = GM.harem.pregnancies.filter(function(p) { return p.mother !== he.character; });
            } else if (he.type === 'rank_change') {
              var sp = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (sp) {
                // 优先使用结构化newRank字段，回退到detail文本
                var _newRankId = he.newRank || he.detail || '';
                sp.spouseRank = _newRankId;
                // 获取位份中文名显示
                var _rankDisplayName = _newRankId;
                if (typeof getHaremRankName === 'function') {
                  var _rn = getHaremRankName(_newRankId);
                  if (_rn && _rn !== _newRankId) _rankDisplayName = _rn;
                }
                addEB('\u540E\u5BAB', he.character + '\u664B\u5C01\u4E3A' + _rankDisplayName);
              }
            } else if (he.type === 'death') {
              var spd = GM.chars ? GM.chars.find(function(c) { return c.name === he.character; }) : null;
              if (spd) {
                spd.alive = false; spd.dead = true; spd.deathTurn = GM.turn; spd.deathReason = he.detail || '';
                // 触发完整死亡级联（官职清理/军队统帅/事件总线/叙事事实）
                if (typeof PostTransfer !== 'undefined') PostTransfer.cascadeVacate(he.character);
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('character:death', { name: he.character, reason: he.detail || '薨逝' });
                // 军队统帅清理
                if (GM.armies) GM.armies.forEach(function(a) { if (a.commander === he.character) { a.commander = ''; a.morale = Math.max(0, (a.morale||50) - 15); } });
              }
              addEB('\u540E\u5BAB', he.character + '\u85A8\u901D' + (he.detail ? '\uFF1A' + he.detail : ''));
            } else if (he.type === 'favor_change') {
              // 宠爱变化
              var spf = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (spf) {
                if (spf.favor === undefined) spf.favor = 50;
                spf.favor = clamp(spf.favor + clamp(parseInt(he.favor_delta) || 0, -30, 30), 0, 100);
                if (he.detail) addEB('\u540E\u5BAB', he.character + '\uFF1A' + he.detail);
                // 宠爱极端值影响忠诚
                if (spf.favor > 85) spf.loyalty = Math.min(100, (spf.loyalty || 50) + 2);
                if (spf.favor < 20) spf.loyalty = Math.max(0, (spf.loyalty || 50) - 3);
              }
            } else if (he.type === 'scandal') {
              // 丑闻/纠纷
              var sps = GM.chars ? GM.chars.find(function(c) { return c.name === he.character && c.spouse; }) : null;
              if (sps) {
                sps.stress = Math.min(100, (sps.stress || 0) + 15);
                if (sps.favor !== undefined) sps.favor = Math.max(0, sps.favor - 10);
              }
              addEB('\u540E\u5BAB', he.character + '\u4E11\u95FB' + (he.detail ? '\uFF1A' + he.detail : ''));
              // NPC记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(he.character, '\u540E\u5BAB\u4E11\u95FB\uFF1A' + (he.detail || ''), 'scandal');
              }
            }
          });
        }

        // 处理皇城宫殿变更
        if (p1.palace_changes && Array.isArray(p1.palace_changes)) {
          // 自动初始化（若剧本未启用皇城系统但AI尝试建）
          if (!P.palaceSystem) P.palaceSystem = { enabled: true, capitalName: '', capitalDescription: '', palaces: [] };
          if (!P.palaceSystem.palaces) P.palaceSystem.palaces = [];
          p1.palace_changes.forEach(function(pc) {
            if (!pc.action) return;
            var palaces = P.palaceSystem.palaces;
            if (pc.action === 'build') {
              var nm = pc.newPalace || pc.palace;
              if (!nm) return;
              var _feas = pc.feasibility || '合理';
              if (_feas === '不合理') {
                addEB('\u5BAB\u5EFA', '拟建 ' + nm + ' 因不合理未能实施');
                return;
              }
              palaces.push({
                id: 'pal_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
                name: nm,
                type: pc.palaceType || 'main_hall',
                function: pc.reason || '',
                description: pc.judgedEffects || '',
                status: (pc.timeActual && pc.timeActual > 0) ? 'underconstruction' : 'intact',
                level: 1,
                subHalls: [],
                isHistorical: false,
                costActual: pc.costActual || 0,
                remainingTurns: pc.timeActual || 0,
                startTurn: GM.turn
              });
              addEB('\u5BAB\u5EFA', '新建' + nm + (pc.reason ? '：' + pc.reason : ''));
            } else if (pc.action === 'renovate') {
              var _p = palaces.find(function(x) { return x.name === pc.palace; });
              if (_p) {
                _p.status = 'intact';
                _p.lastRenovation = GM.turn;
                addEB('\u5BAB\u5EFA', _p.name + ' 修缮完工');
              }
            } else if (pc.action === 'ruined') {
              var _p2 = palaces.find(function(x) { return x.name === pc.palace; });
              if (_p2) {
                _p2.status = 'ruined';
                addEB('\u5BAB\u5EFA', _p2.name + ' 荒废' + (pc.reason ? '：' + pc.reason : ''));
              }
            } else if (pc.action === 'abandon') {
              var _idx = palaces.findIndex(function(x) { return x.name === pc.palace; });
              if (_idx >= 0) {
                var _ab = palaces[_idx];
                palaces.splice(_idx, 1);
                addEB('\u5BAB\u5EFA', _ab.name + ' 废弃' + (pc.reason ? '：' + pc.reason : ''));
              }
            } else if (pc.action === 'assign') {
              // 居所分配/移居
              var _tp = palaces.find(function(x) { return x.name === pc.palace; });
              if (_tp && _tp.subHalls) {
                var _sh = _tp.subHalls.find(function(s) { return s.name === pc.subHall; });
                if (_sh && pc.occupant) {
                  // 获取原居所用于比较（判断是晋升还是贬谪）
                  var _prevRole = null;
                  palaces.forEach(function(xp) {
                    if (!xp.subHalls) return;
                    xp.subHalls.forEach(function(xs) {
                      if (xs.occupants && xs.occupants.indexOf(pc.occupant) >= 0) _prevRole = xs.role;
                    });
                  });
                  // 从原位移除
                  palaces.forEach(function(xp) {
                    if (!xp.subHalls) return;
                    xp.subHalls.forEach(function(xs) {
                      if (xs.occupants) xs.occupants = xs.occupants.filter(function(n) { return n !== pc.occupant; });
                    });
                  });
                  // 移入新位
                  if (!_sh.occupants) _sh.occupants = [];
                  _sh.occupants.push(pc.occupant);
                  // 更新 character.residence
                  var _ch = (GM.chars || []).find(function(c) { return c.name === pc.occupant; });
                  if (_ch) _ch.residence = { palaceId: _tp.id, subHallId: _sh.id };
                  addEB('\u5BAB\u5EFA', pc.occupant + ' 移居' + _tp.name + '·' + _sh.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                  // NPC 记忆：按升降分级写入
                  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                    var _roleRank = { main:3, side:2, attached:1 };
                    var _prevRk = _prevRole ? _roleRank[_prevRole] : 0;
                    var _newRk = _roleRank[_sh.role] || 1;
                    var _moodText, _moodKey;
                    if (_newRk > _prevRk) { _moodText = '迁居' + _tp.name + '·' + _sh.name + '，位遇晋升'; _moodKey = '喜'; }
                    else if (_newRk < _prevRk) { _moodText = '由旧居迁至 ' + _tp.name + '·' + _sh.name + '，位遇下降，恐圣眷不再'; _moodKey = '忧'; }
                    else { _moodText = '迁居 ' + _tp.name + '·' + _sh.name; _moodKey = '平'; }
                    NpcMemorySystem.remember(pc.occupant, _moodText, _moodKey, 5);
                  }
                }
              }
            } else if (pc.action === 'build' && pc.occupant) {
              // AI若在新建时指定居住者，也写入记忆
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                NpcMemorySystem.remember(pc.occupant, '蒙恩新赐' + (pc.newPalace || pc.palace) + '为居所', '喜', 7);
              }
            } else if (pc.action === 'abandon' || pc.action === 'ruined') {
              // 若废弃/荒废的宫殿有居住者，通知NPC记忆
              var _ruinedPal = palaces.find(function(x) { return x.name === pc.palace; });
              if (!_ruinedPal && pc.action === 'abandon') {
                // already removed, lookup previous occupants is not possible
              }
              // 对于 ruined，occupants仍然在对象中可查
              if (_ruinedPal && _ruinedPal.subHalls) {
                _ruinedPal.subHalls.forEach(function(sh) {
                  (sh.occupants || []).forEach(function(occ) {
                    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                      NpcMemorySystem.remember(occ, '所居 ' + _ruinedPal.name + ' 荒废，流离失所', '忧', 6);
                    }
                  });
                });
              }
            }
          });
        }

        // 处理文事作品（诗词文赋画等）
        if (p1.cultural_works && Array.isArray(p1.cultural_works) && p1.cultural_works.length > 0) {
          if (!GM.culturalWorks) GM.culturalWorks = [];
          var _pNameW = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.cultural_works.forEach(function(w) {
            if (!w || !w.author || !w.content || !w.title) return;
            // ── 玩家保护：作者是玩家——除非玩家在本回合诏令中明确命自己作，否则过滤 ──
            if (_pNameW && w.author === _pNameW) {
              // 检查 motivation 是否 commissioned（由玩家诏令命作）
              if (w.motivation !== 'commissioned' && w.motivation !== 'duty') {
                addEB('\u8FC7\u6EE4', 'AI 试图让玩家 ' + _pNameW + ' autonomous 作 ' + w.title + '，已过滤');
                return;
              }
            }
            // 补全字段
            var work = {
              id: 'work_T' + GM.turn + '_' + Math.random().toString(36).slice(2, 8),
              author: w.author,
              turn: GM.turn,
              date: w.date || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
              location: w.location || '',
              triggerCategory: w.triggerCategory || 'mood',
              trigger: w.trigger || 'casual_mood',
              motivation: w.motivation || 'spontaneous',
              lifeStage: w.lifeStage || '',
              genre: w.genre || 'shi',
              subtype: w.subtype || '',
              title: w.title,
              content: w.content,
              mood: w.mood || '',
              theme: w.theme || '',
              elegance: w.elegance || 'refined',
              dedicatedTo: Array.isArray(w.dedicatedTo) ? w.dedicatedTo : [],
              inspiredBy: w.inspiredBy || '',
              commissionedBy: w.commissionedBy || '',
              praiseTarget: w.praiseTarget || '',
              satireTarget: w.satireTarget || '',
              quality: parseInt(w.quality) || 60,
              politicalImplication: w.politicalImplication || '',
              politicalRisk: w.politicalRisk || 'low',
              narrativeContext: w.narrativeContext || '',
              preservationPotential: w.preservationPotential || 'low',
              isPreserved: (w.preservationPotential === 'high' || (parseInt(w.quality) || 0) >= 88),
              appreciatedBy: [],
              echoResponses: [],
              isForbidden: false,
              authorTraits: []
            };
            // 记录作者特质快照
            var authorCh = (typeof _fuzzyFindChar === 'function' ? _fuzzyFindChar(w.author) : null) || findCharByName(w.author);
            if (authorCh) {
              work.authorTraits = Array.isArray(authorCh.traits) ? authorCh.traits.slice() : [];
              // 作者索引
              if (!Array.isArray(authorCh.works)) authorCh.works = [];
              authorCh.works.push(work.id);
              // ── 作者自身记忆——"我记得自己写过这篇" ──
              if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                var _authorMood = (work.motivation === 'mourning' || work.mood === '悲怆' || work.mood === '凄苦') ? '忧' :
                                  (work.mood === '豪迈' || work.mood === '豪放' || work.motivation === 'celebration') ? '喜' :
                                  (work.motivation === 'critique' || work.mood === '讽刺') ? '恨' : '平';
                var _importance = Math.min(10, Math.max(4, Math.round((work.quality || 60) / 12)));
                var _memText = '作《' + work.title + '》于' + (work.location || '此地') + '——' +
                               (work.mood ? work.mood + '之作' : '') +
                               (work.narrativeContext ? '：' + work.narrativeContext.substring(0, 50) : '');
                NpcMemorySystem.remember(authorCh.name, _memText, _authorMood, _importance);
              }
            }
            GM.culturalWorks.push(work);
            // === 按动机应用差异化效果 ===
            var _mot = work.motivation;
            var _qBonus = Math.max(0, (work.quality - 50)) / 10; // 0-5
            if (authorCh) {
              if (_mot === 'spontaneous' || _mot === 'self_express') {
                // 自发之作：单纯文名
                if (work.quality >= 85) addEB('文事', authorCh.name + '作' + work.title + '，一时传诵');
              } else if (_mot === 'flattery') {
                // 干谒求官——看质量+委托对象
                var _target = (work.dedicatedTo && work.dedicatedTo[0]) || work.praiseTarget;
                var _targetCh = _target ? findCharByName(_target) : null;
                if (work.elegance === 'refined' && work.quality >= 75) {
                  if (_targetCh) {
                    _targetCh.affinity = (_targetCh.affinity || 50) + 5;
                    addEB('\u6587\u4E8B', authorCh.name + '以《' + work.title + '》干谒' + _target + '，得赏识');
                  }
                } else if (work.elegance === 'vernacular' || work.quality < 60) {
                  // 谄媚过度 → 士林讥嘲
                  authorCh.prestige = Math.max(0, (authorCh.prestige || 50) - 2);
                  addEB('\u6587\u4E8B', authorCh.name + '作《' + work.title + '》献媚于' + _target + '，士林讥之');
                }
              } else if (_mot === 'critique' || work.politicalRisk === 'high') {
                // 讽谕之作：风险+长远文名
                addEB('\u6587\u4E8B', '【讽谕】' + authorCh.name + '《' + work.title + '》出，' + (work.satireTarget ? '暗讽' + work.satireTarget + '，' : '') + '士论哗然');
                // 讽刺对象若为权贵，其可能记恨
                var _satCh = work.satireTarget ? findCharByName(work.satireTarget) : null;
                if (_satCh && typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(_satCh.name, authorCh.name + '作讽谕之文《' + work.title + '》暗刺吾，宜记之', '恨', 7);
                  _satCh.affinity = Math.max(0, (_satCh.affinity || 50) - 8);
                }
                if (work.quality >= 85) {
                  authorCh.prestige = Math.min(100, (authorCh.prestige || 50) + 3);
                }
              } else if (_mot === 'ghostwrite' && work.commissionedBy) {
                // 代笔：委托人署名得名声，作者得润笔
                addEB('\u6587\u4E8B', authorCh.name + '代' + work.commissionedBy + '撰《' + work.title + '》');
                var _commCh = findCharByName(work.commissionedBy);
                if (_commCh) {
                  _commCh.prestige = Math.min(100, (_commCh.prestige || 50) + Math.round(_qBonus));
                  _commCh.affinity = (_commCh.affinity || 50) + 3;
                  // 双方都记忆此事（委托人知道这是代笔，作者也记得）
                  if (typeof NpcMemorySystem !== 'undefined') {
                    NpcMemorySystem.remember(_commCh.name, '托' + authorCh.name + '代作《' + work.title + '》——知其实笔', '平', 5, authorCh.name);
                  }
                }
              } else if (_mot === 'mourning' || _mot === 'memorial') {
                // 悼亡/祭文：仁孝名声
                authorCh.benevolence = Math.min(100, (authorCh.benevolence || 50) + 1);
                addEB('\u6587\u4E8B', authorCh.name + '撰《' + work.title + '》以祭，情深意切');
              } else if (_mot === 'celebration') {
                // 颂扬
                var _prTar = work.praiseTarget ? findCharByName(work.praiseTarget) : null;
                if (_prTar) {
                  _prTar.affinity = (_prTar.affinity || 50) + 4;
                  addEB('\u6587\u4E8B', authorCh.name + '作' + work.title + '颂' + work.praiseTarget);
                  // 被颂者的记忆
                  if (typeof NpcMemorySystem !== 'undefined') {
                    NpcMemorySystem.remember(_prTar.name, authorCh.name + '作《' + work.title + '》颂吾——感其知遇', '喜', 6, authorCh.name);
                  }
                }
              } else if (_mot === 'farewell') {
                // 送别
                (work.dedicatedTo || []).forEach(function(n) {
                  var _ch = findCharByName(n);
                  if (_ch) {
                    _ch.affinity = (_ch.affinity || 50) + 5;
                    _ch.loyalty = Math.min(100, (_ch.loyalty || 50) + 2);
                    // 受赠者记忆
                    if (typeof NpcMemorySystem !== 'undefined') {
                      NpcMemorySystem.remember(n, authorCh.name + '于别时赠《' + work.title + '》，情深意厚', '喜', 7);
                    }
                  }
                });
                addEB('\u6587\u4E8B', authorCh.name + '送别' + (work.dedicatedTo||[]).join('、') + '，作《' + work.title + '》');
              } else if (_mot === 'response') {
                // 次韵酬答：文友关系
                (work.dedicatedTo || []).forEach(function(n) {
                  var _ch = findCharByName(n);
                  if (_ch) {
                    _ch.affinity = (_ch.affinity || 50) + 4;
                    if (typeof NpcMemorySystem !== 'undefined') {
                      NpcMemorySystem.remember(n, authorCh.name + '次韵和余作《' + work.title + '》——文友相重', '喜', 5);
                    }
                  }
                });
              } else if (_mot === 'duty' || _mot === 'commissioned') {
                // 应制：皇恩+
                authorCh.loyalty = Math.min(100, (authorCh.loyalty || 50) + 1);
              }
              // 通用效果：威望与文化影响
              authorCh.prestige = Math.min(100, (authorCh.prestige || 50) + Math.round(_qBonus * 0.5));
              if (GM.eraState && typeof GM.eraState.culturalVibrancy === 'number') {
                GM.eraState.culturalVibrancy = Math.min(1.0, GM.eraState.culturalVibrancy + Math.max(0, work.quality - 70) * 0.001);
              }
            }
          });
        }

        // 处理诏令生命周期更新（AI每回合推进的阶段状态）
        if (p1.edict_lifecycle_update && Array.isArray(p1.edict_lifecycle_update) && p1.edict_lifecycle_update.length > 0) {
          if (!GM._edictLifecycle) GM._edictLifecycle = [];
          p1.edict_lifecycle_update.forEach(function(u) {
            if (!u || !u.edictId) return;
            // 查找或创建生命周期记录
            var entry = GM._edictLifecycle.find(function(e) { return e.edictId === u.edictId; });
            if (!entry) {
              // 新条目——必须能在 _edictTracker 找到对应诏令，否则视为 AI 臆造并拒绝
              var _src = (GM._edictTracker || []).find(function(t) { return t.id === u.edictId; });
              if (!_src) {
                addEB('\u8BCF\u4EE4', '【过滤】AI 试图为不存在的诏令ID(' + u.edictId + ')创建生命周期，已拒绝');
                _dbg('[edict_lifecycle] 拒绝臆造 edictId=' + u.edictId);
                return;
              }
              entry = {
                edictId: u.edictId,
                edictType: u.edictType || '',
                edictContent: _src.content || '',
                edictCategory: _src.category || '',
                startTurn: GM.turn,
                stages: [],
                reformPhase: u.reformPhase || null,
                pilotRegion: u.pilotRegion || '',
                expansionRegions: [],
                oppositionLeaders: [],
                supporters: [],
                totalEffects: {},
                isCompleted: false
              };
              GM._edictLifecycle.push(entry);
            }
            // 推进阶段
            var stageEntry = {
              turn: GM.turn,
              stage: u.stage || 'execution',
              progress: u.stageProgress || 0,
              executor: u.executor || '',
              executorEffectiveness: u.executorEffectiveness || 0.5,
              resistanceDescription: u.resistanceDescription || '',
              narrativeSnippet: u.narrativeSnippet || ''
            };
            entry.stages.push(stageEntry);
            if (u.reformPhase) entry.reformPhase = u.reformPhase;
            if (u.pilotRegion && !entry.pilotRegion) entry.pilotRegion = u.pilotRegion;
            if (Array.isArray(u.expansionRegions)) {
              u.expansionRegions.forEach(function(r) {
                if (entry.expansionRegions.indexOf(r) < 0) entry.expansionRegions.push(r);
              });
            }
            if (Array.isArray(u.oppositionLeaders)) {
              u.oppositionLeaders.forEach(function(n) {
                if (entry.oppositionLeaders.indexOf(n) < 0) entry.oppositionLeaders.push(n);
              });
            }
            if (Array.isArray(u.supporters)) {
              u.supporters.forEach(function(n) {
                if (entry.supporters.indexOf(n) < 0) entry.supporters.push(n);
              });
            }
            // 阶段 = sedimentation 标为完成
            if (u.stage === 'sedimentation') entry.isCompleted = true;

            // 应用 currentEffects 到资源/阶层
            if (u.currentEffects && typeof u.currentEffects === 'object') {
              Object.keys(u.currentEffects).forEach(function(k) {
                var v = parseFloat(u.currentEffects[k]) || 0;
                entry.totalEffects[k] = (entry.totalEffects[k] || 0) + v;
                // 已有变量：直接应用
                if (GM.vars && GM.vars[k]) {
                  GM.vars[k].value = Math.max(GM.vars[k].min || 0, Math.min(GM.vars[k].max || 999999999, (GM.vars[k].value || 0) + v));
                } else if (k === 'stateTreasury' && typeof GM.stateTreasury === 'number') {
                  GM.stateTreasury = Math.max(0, GM.stateTreasury + v);
                }
              });
            }
            // 阶层影响 → classSatisfaction / unrest 联动
            if (u.classesAffected && typeof u.classesAffected === 'object' && GM.classes) {
              Object.keys(u.classesAffected).forEach(function(cls) {
                var info = u.classesAffected[cls] || {};
                var impact = parseFloat(info.impact) || 0;
                var clsObj = (GM.classes || []).find(function(c) { return c.name === cls; });
                if (clsObj) {
                  clsObj.satisfaction = Math.max(0, Math.min(100, (clsObj.satisfaction || 50) + impact));
                  // 联动分级不满：满意度剧降推高 unrestLevels 阶梯
                  if (!clsObj.unrestLevels) clsObj.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
                  if (impact < -5) {
                    clsObj.unrestLevels.grievance = Math.max(0, (clsObj.unrestLevels.grievance || 60) + impact * 0.8);
                    if (impact < -10) clsObj.unrestLevels.petition = Math.max(0, (clsObj.unrestLevels.petition || 70) + impact * 0.5);
                    if (impact < -20) clsObj.unrestLevels.strike = Math.max(0, (clsObj.unrestLevels.strike || 80) + impact * 0.3);
                  }
                }
              });
            }
            // 势力影响 → factionRelations / playerRelation 联动
            if (u.factionsAffected && typeof u.factionsAffected === 'object' && GM.facs) {
              Object.keys(u.factionsAffected).forEach(function(fn) {
                var info = u.factionsAffected[fn] || {};
                var delta = parseFloat(info.relation_delta) || 0;
                var fObj = (GM.facs || []).find(function(f) { return f.name === fn; });
                if (fObj) {
                  if (delta) fObj.playerRelation = Math.max(-100, Math.min(100, (fObj.playerRelation || 0) + delta));
                  if (info.attitude_shift && info.attitude_shift !== fObj.attitude) {
                    fObj.attitude = info.attitude_shift;
                    addEB('外交', fn + '因诏令转向' + info.attitude_shift + (info.reason ? '（' + info.reason + '）' : ''));
                  }
                  // 存入势力历史大事
                  if (!Array.isArray(fObj.historicalEvents)) fObj.historicalEvents = [];
                  if (Math.abs(delta) >= 5) {
                    fObj.historicalEvents.push({ turn: GM.turn, event: '对' + ((P.playerInfo && P.playerInfo.factionName) || '我方') + '诏令的反应', impact: (delta > 0 ? '关系+' : '关系') + delta });
                    if (fObj.historicalEvents.length > 30) fObj.historicalEvents = fObj.historicalEvents.slice(-30);
                  }
                }
              });
            }
            // 党派影响 → influence / agenda_history 联动
            if (u.partiesAffected && typeof u.partiesAffected === 'object' && GM.parties) {
              Object.keys(u.partiesAffected).forEach(function(pn) {
                var info = u.partiesAffected[pn] || {};
                var infDelta = parseFloat(info.influence_delta) || 0;
                var pObj = (GM.parties || []).find(function(pp) { return pp.name === pn; });
                if (pObj) {
                  if (infDelta) pObj.influence = Math.max(0, Math.min(100, (pObj.influence || 50) + infDelta));
                  // 写入议程演进
                  if (info.agenda_impact || info.reason) {
                    if (!Array.isArray(pObj.agenda_history)) pObj.agenda_history = [];
                    pObj.agenda_history.push({ turn: GM.turn, agenda: info.agenda_impact || '诏令反应', outcome: info.reason || '' });
                    if (pObj.agenda_history.length > 20) pObj.agenda_history = pObj.agenda_history.slice(-20);
                  }
                  // 反对派 → 党员写入恨意记忆
                  if (info.agenda_impact === '反对' && typeof NpcMemorySystem !== 'undefined' && GM.chars) {
                    GM.chars.filter(function(c){return c.party === pn;}).slice(0, 3).forEach(function(c) {
                      NpcMemorySystem.remember(c.name, '党议反对诏令(' + (u.edictType||'') + ')', '恨', 5);
                    });
                  }
                }
              });
            }

            // 意外后果 → 编年 + 起居注
            if (u.unintendedConsequences) {
              addEB('\u8BCF\u4EE4', '【意外】' + u.unintendedConsequences);
              if (GM.qijuHistory) {
                GM.qijuHistory.unshift({
                  turn: GM.turn,
                  date: typeof getTSText==='function'?getTSText(GM.turn):'',
                  content: '【意外后果】' + u.unintendedConsequences,
                  category: '诏令'
                });
              }
            }

            // 阻力生成 → 反对派 NPC 记忆（恨意积累）
            if (Array.isArray(u.oppositionLeaders) && typeof NpcMemorySystem !== 'undefined') {
              u.oppositionLeaders.forEach(function(oppName) {
                NpcMemorySystem.remember(oppName, '反对诏令(' + (u.edictType||'') + ')——深恶之', '恨', 6);
                // 与执行者建立冲突级关系
                if (u.executor && typeof applyNpcInteraction === 'function') {
                  // 这里不直接 applyNpcInteraction（避免叠加过多），只做记忆标记
                }
              });
            }
            // 事件板简要记录
            var stageLabel = (typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[u.stage]) ? EDICT_STAGES[u.stage].label : (u.stage||'');
            var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[u.edictType]) ? EDICT_TYPES[u.edictType].label : (u.edictType||'');
            var phaseTag = '';
            if (u.reformPhase && typeof REFORM_PHASES !== 'undefined' && REFORM_PHASES[u.reformPhase]) {
              phaseTag = '·' + REFORM_PHASES[u.reformPhase].label;
            }
            addEB('\u8BCF\u4EE4', typeLabel + phaseTag + ' → ' + stageLabel + (u.executor ? '(' + u.executor + '督办)' : '') + (u.narrativeSnippet ? '：' + u.narrativeSnippet.substring(0,60) : ''));
          });
        }

        // 处理 NPC 互动
        if (p1.npc_interactions && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          var _pName = (P.playerInfo && P.playerInfo.characterName) || '';
          p1.npc_interactions.forEach(function(it) {
            if (!it || !it.type || !it.actor || !it.target) return;
            // ── 玩家保护：actor=玩家的 autonomous 互动一律过滤（玩家应通过诏令/批奏疏/问对自行操作）──
            if (_pName && (it.actor === _pName)) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家 ' + _pName + ' autonomous 互动(' + it.type + '→' + it.target + ')，已过滤');
              return;
            }
            if (typeof applyNpcInteraction !== 'function') return;
            var extra = { description: it.description || '' };
            var ok = applyNpcInteraction(it.actor, it.target, it.type, extra);
            if (ok) {
              var typeInfo = (typeof NPC_INTERACTION_TYPES !== 'undefined' && NPC_INTERACTION_TYPES[it.type]) ? NPC_INTERACTION_TYPES[it.type].label : it.type;
              addEB('\u4EBA\u7269', it.actor + '→' + it.target + ' ' + typeInfo + (it.description ? '：' + it.description : ''));
              // ── 名望/贤能涨跌（由行为定义查询）──
              try {
                var _typeDef = (typeof NPC_INTERACTION_TYPES !== 'undefined' && NPC_INTERACTION_TYPES[it.type]) ? NPC_INTERACTION_TYPES[it.type] : null;
                var _cEng = (typeof CharEconEngine !== 'undefined') ? CharEconEngine : null;
                if (_typeDef && _cEng) {
                  var _actorCh = (typeof findCharByName==='function') ? findCharByName(it.actor) : null;
                  var _targetCh = (typeof findCharByName==='function') ? findCharByName(it.target) : null;
                  if (_actorCh && _typeDef.fameActor) _cEng.adjustFame(_actorCh, _typeDef.fameActor, typeInfo+'→'+it.target);
                  if (_targetCh && _typeDef.fameTarget) _cEng.adjustFame(_targetCh, _typeDef.fameTarget, '被'+it.actor+typeInfo);
                  if (_actorCh && _typeDef.virtueActor) _cEng.adjustVirtueMerit(_actorCh, _typeDef.virtueActor, typeInfo);
                  if (_targetCh && _typeDef.virtueTarget) _cEng.adjustVirtueMerit(_targetCh, _typeDef.virtueTarget, '被'+typeInfo);
                }
              } catch(_fve){}
              // ── 当事人（actor、target）写入记忆 ──
              if (typeof NpcMemorySystem !== 'undefined') {
                var _aggressive = ['impeach','slander','frame_up','betray','expose_secret'].indexOf(it.type) >= 0;
                var _friendly = ['recommend','guarantee','petition_jointly','private_visit','invite_banquet','gift_present','duel_poetry'].indexOf(it.type) >= 0;
                var _emo = _aggressive ? '怒' : (_friendly ? '喜' : '平');
                var _wt = _aggressive ? 6 : (_friendly ? 4 : 3);
                if (it.actor && it.actor !== _pName) {
                  NpcMemorySystem.remember(it.actor, '我对 ' + it.target + ' ' + typeInfo + (it.description ? '：' + it.description.slice(0,30) : ''), _emo, _wt);
                }
                if (it.target && it.target !== _pName) {
                  NpcMemorySystem.remember(it.target, ' ' + it.actor + ' 对我 ' + typeInfo + (it.description ? '——' + it.description.slice(0,30) : ''), _aggressive ? '恨' : _emo, _wt);
                }
              }
              // 涉及第三方——也记入他们的记忆
              if (Array.isArray(it.involvedOthers) && typeof NpcMemorySystem !== 'undefined') {
                it.involvedOthers.forEach(function(n) {
                  if (n && n !== _pName) NpcMemorySystem.remember(n, '见 ' + it.actor + ' 对 ' + it.target + ' ' + typeInfo, '平', 3);
                });
              }
              // ── NPC 对玩家行为的分发 ──
              if (_pName && it.target === _pName) {
                _dispatchNpcActionToPlayer(it, typeInfo);
              }
              // ── publicKnown 的 NPC 间互动 → 起居注风闻 + 风闻录事 ──
              if (it.publicKnown) {
                if (GM.qijuHistory) {
                  GM.qijuHistory.unshift({
                    turn: GM.turn,
                    date: typeof getTSText==='function'?getTSText(GM.turn):'',
                    content: '【风闻】' + it.actor + ' 对 ' + it.target + ' ' + typeInfo + (it.description ? '——' + it.description.substring(0,60) : ''),
                    category: '风闻'
                  });
                }
                if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  var _fwType = (['impeach','slander','frame_up','expose_secret'].indexOf(it.type)>=0) ? '告状'
                              : (['correspond_secret','share_intelligence'].indexOf(it.type)>=0) ? '密札'
                              : (['private_visit','invite_banquet','duel_poetry','gift_present','recommend','guarantee','petition_jointly'].indexOf(it.type)>=0) ? '耳报'
                              : '风议';
                  PhaseD.addFengwen({
                    type: _fwType,
                    text: it.actor + '·' + typeInfo + '·' + it.target + (it.description ? '——' + it.description.slice(0,80) : ''),
                    credibility: 0.7,
                    source: 'npc_interaction',
                    actors: [it.actor, it.target].concat(it.involvedOthers||[]),
                    turn: GM.turn
                  });
                }
              } else if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen && Math.random() < 0.2) {
                // 非公开互动 20% 概率由耳目察觉，走"密札"
                PhaseD.addFengwen({
                  type: '密札',
                  text: '耳目报：' + it.actor + '→' + it.target + ' ' + typeInfo + '（未广传）',
                  credibility: 0.4,
                  source: 'spy',
                  actors: [it.actor, it.target],
                  turn: GM.turn
                });
              }
            }
          });
        }

        // 辅助：NPC 对玩家的互动分发到相应 tab
        function _dispatchNpcActionToPlayer(it, typeInfo) {
          if (!GM) return;
          var actor = it.actor, desc = it.description || typeInfo;
          var turn = GM.turn;
          var date = typeof getTSText==='function'?getTSText(turn):'';
          // 按 type 分发
          if (it.type === 'impeach' || it.type === 'slander' || it.type === 'expose_secret') {
            // 弹劾/诽谤/揭发 → 奏疏（弹章）
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '弹章', subtype: '公疏',
              title: actor + '弹劾' + (it.involvedOthers && it.involvedOthers[0] ? it.involvedOthers[0] : ''),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'recommend' || it.type === 'guarantee' || it.type === 'petition_jointly') {
            // 举荐/担保/联名 → 奏疏
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, type: '荐表', subtype: '公疏',
              title: actor + (it.type==='recommend'?'举荐':it.type==='guarantee'?'担保':'联名'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          } else if (it.type === 'private_visit' || it.type === 'invite_banquet' || it.type === 'duel_poetry') {
            // 私访/宴请/切磋 → 问对（求见队列）
            if (!GM._pendingAudiences) GM._pendingAudiences = [];
            GM._pendingAudiences.push({ name: actor, reason: desc, turn: turn });
          } else if (it.type === 'gift_present') {
            // 馈赠 → 鸿雁（附礼信）
            if (!GM.letters) GM.letters = [];
            GM.letters.push({
              id: 'letter_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, to: '陛下', letterType: 'gift',
              content: desc, turn: turn, status: 'delivered'
            });
          } else if (it.type === 'correspond_secret' || it.type === 'share_intelligence') {
            // 密信/通报 → 鸿雁
            if (!GM.letters) GM.letters = [];
            GM.letters.push({
              id: 'letter_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: actor, to: '陛下', letterType: 'intelligence',
              content: desc, turn: turn, status: 'delivered'
            });
          } else if (it.type === 'frame_up' || it.type === 'betray') {
            // 构陷/背叛 → 奏疏(警报) + 起居注
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: '有司', type: '警报', subtype: '密折',
              title: actor + (it.type==='betray'?'似有不臣之心':'恐有构陷之谋'),
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn
            });
          }
          // 所有对玩家的 NPC 行为也记起居注
          if (GM.qijuHistory) {
            GM.qijuHistory.unshift({
              turn: turn, date: date,
              content: '【' + typeInfo + '】' + actor + '→陛下' + (desc ? '：' + desc : ''),
              category: '对上'
            });
          }
        }

        // 处理势力深度互动
        if (p1.faction_interactions_advanced && Array.isArray(p1.faction_interactions_advanced) && p1.faction_interactions_advanced.length > 0) {
          var _pFac = (P.playerInfo && P.playerInfo.factionName) || '';
          p1.faction_interactions_advanced.forEach(function(it) {
            if (!it || !it.type || !it.from || !it.to) return;
            // ── 玩家势力保护：from=玩家势力的主动宣战/结盟/毁约等一律过滤——这些只能由玩家诏令触发 ──
            var _playerInitiatedTypes = ['declare_war','sue_for_peace','form_confederation','break_confederation','trade_embargo','open_market','send_envoy','demand_tribute','pay_tribute','royal_marriage','send_hostage','cultural_exchange','spy_infiltration','assassin_dispatch','annex_vassal','recognize_independence','incite_rebellion','proxy_war'];
            if (_pFac && it.from === _pFac && _playerInitiatedTypes.indexOf(it.type) >= 0) {
              addEB('\u8FC7\u6EE4', 'AI 试图替玩家势力 ' + _pFac + ' autonomous 对外 ' + it.type + '，已过滤（须玩家诏令）');
              return;
            }
            if (typeof applyFactionInteraction !== 'function') return;
            var extra = {
              description: it.description || it.terms || '',
              viaProxy: it.viaProxy || '',
              action: it.action || '',
              treatyType: it.treatyType || '',
              terms: it.terms || '',
              until: it.until || null
            };
            var ok = applyFactionInteraction(it.from, it.to, it.type, extra);
            if (ok) {
              var typeInfo = (typeof FACTION_INTERACTION_TYPES !== 'undefined' && FACTION_INTERACTION_TYPES[it.type]) ? FACTION_INTERACTION_TYPES[it.type].label : it.type;
              addEB('\u52BF\u529B', it.from + '→' + it.to + ' ' + typeInfo + (it.description ? '：' + it.description : ''));
              // 公开势力互动 → 风闻录事（机密类除外）
              try {
                var _covertTypes = ['spy_infiltration','assassin_dispatch','incite_rebellion'];
                var _isCovert = _covertTypes.indexOf(it.type) >= 0;
                if (!_isCovert && typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  var _fwType = it.type === 'declare_war' ? '\u6218\u62A5'
                              : it.type === 'border_clash' ? '\u8FB9\u62A5'
                              : it.type === 'royal_marriage' ? '\u548C\u4EB2'
                              : it.type === 'send_hostage' ? '\u8D28\u5B50'
                              : it.type === 'demand_tribute' || it.type === 'pay_tribute' ? '\u671D\u8D21'
                              : it.type === 'open_market' || it.type === 'trade_embargo' ? '\u4E92\u5E02'
                              : it.type === 'form_confederation' || it.type === 'break_confederation' ? '\u76DF\u7EA6'
                              : it.type === 'send_envoy' ? '\u9063\u4F7F'
                              : it.type === 'cultural_exchange' || it.type === 'religious_mission' ? '\u4F7F\u8282'
                              : it.type === 'military_aid' || it.type === 'proxy_war' ? '\u519B\u60C5'
                              : it.type === 'pay_indemnity' ? '\u8D54\u6B3E'
                              : it.type === 'annex_vassal' || it.type === 'recognize_independence' ? '\u5916\u4EA4'
                              : it.type === 'gift_treasure' ? '\u8D60\u8D22'
                              : it.type === 'sue_for_peace' ? '\u8BF7\u548C'
                              : '\u98CE\u8BAE';
                  PhaseD.addFengwen({
                    type: _fwType,
                    text: it.from + '\u00B7' + typeInfo + '\u00B7' + it.to + (it.description ? '\u2014\u2014' + String(it.description).slice(0,60) : ''),
                    credibility: 0.85,
                    source: 'faction_public',
                    actors: [it.from, it.to],
                    turn: GM.turn
                  });
                }
              } catch(_fwErr){}
              // 联姻细节——写入角色数据
              if (it.type === 'royal_marriage' && it.marriageDetails) {
                addEB('\u548C\u4EB2', it.marriageDetails);
              }
              // 质子细节
              if (it.type === 'send_hostage' && it.hostageDetails) {
                addEB('\u8D28\u5B50', it.hostageDetails);
              }
              // 宣战——联动 activeWars + 编年
              if (it.type === 'declare_war') {
                if (GM.activeWars) GM.activeWars.push({ attacker: it.from, defender: it.to, startTurn: GM.turn, reason: it.reason || '', declared: true });
                if (!GM.biannianItems) GM.biannianItems = [];
                GM.biannianItems.unshift({
                  turn: GM.turn, startTurn: GM.turn,
                  date: typeof getTSText==='function'?getTSText(GM.turn):'',
                  title: it.from + ' 对 ' + it.to + ' 宣战',
                  content: it.description || (it.from + '向' + it.to + '下战书，两国开战。'),
                  duration: 1, importance: 'high', category: '军事'
                });
              }
              // ── 势力对玩家势力的分发 ──
              if (_pFac && it.to === _pFac) {
                _dispatchFactionActionToPlayer(it, typeInfo);
              }
            }
          });
        }

        // 辅助：他国势力对玩家势力的互动分发
        function _dispatchFactionActionToPlayer(it, typeInfo) {
          if (!GM) return;
          var from = it.from, desc = it.description || typeInfo;
          var turn = GM.turn;
          var date = typeof getTSText==='function'?getTSText(turn):'';
          // 外交类 → 鸿雁（国书）
          var diplomaticTypes = ['send_envoy','demand_tribute','pay_tribute','royal_marriage','send_hostage','sue_for_peace','form_confederation','break_confederation','cultural_exchange','religious_mission','gift_treasure','pay_indemnity','open_market','trade_embargo','recognize_independence'];
          if (diplomaticTypes.indexOf(it.type) >= 0) {
            if (!GM.letters) GM.letters = [];
            GM.letters.push({
              id: 'letter_diplomatic_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: from, to: '朝廷', letterType: 'diplomatic',
              subtype: it.type,
              content: desc + (it.terms ? '\n条款：'+it.terms : '') + (it.tributeItems ? '\n贡物：'+it.tributeItems : ''),
              turn: turn, status: 'delivered', urgency: 'normal'
            });
            // 需要玩家回应的重大外交（和亲/索贡/请和/联盟）→ 问对待接见
            var requireResponseTypes = ['royal_marriage','demand_tribute','sue_for_peace','form_confederation','send_envoy'];
            if (requireResponseTypes.indexOf(it.type) >= 0) {
              if (!GM._pendingAudiences) GM._pendingAudiences = [];
              GM._pendingAudiences.push({
                name: from + '使节', reason: typeInfo + '——' + desc, turn: turn,
                isEnvoy: true, fromFaction: from, interactionType: it.type
              });
            }
          }
          // 军事类 → 编年（重大）+ 奏疏（边报）
          var militaryTypes = ['declare_war','border_clash','assassin_dispatch','incite_rebellion','proxy_war','spy_infiltration'];
          if (militaryTypes.indexOf(it.type) >= 0) {
            if (!GM.memorials) GM.memorials = [];
            GM.memorials.push({
              id: 'mem_border_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
              from: '边军塘报', type: '边报', subtype: '公疏',
              title: from + ' ' + typeInfo,
              content: desc, status: 'pending_review', turn: turn, _arrivedTurn: turn,
              urgency: it.type === 'declare_war' ? 'extreme' : 'urgent'
            });
            // 宣战已在上方入编年；其余军事事件也入编年
            if (it.type !== 'declare_war') {
              if (!GM.biannianItems) GM.biannianItems = [];
              GM.biannianItems.unshift({
                turn: turn, startTurn: turn, date: date,
                title: from + ' ' + typeInfo,
                content: desc, duration: 1,
                importance: it.type === 'border_clash' ? 'high' : 'medium',
                category: '军事'
              });
            }
          }
          // 并吞/承认独立 → 编年
          if (it.type === 'annex_vassal' || it.type === 'recognize_independence') {
            if (!GM.biannianItems) GM.biannianItems = [];
            GM.biannianItems.unshift({
              turn: turn, startTurn: turn, date: date,
              title: it.type === 'annex_vassal' ? (from + '并吞' + it.to) : (from + '宣告独立'),
              content: desc, duration: 1, importance: 'high', category: '政治'
            });
          }
          // 所有对玩家势力的行为都入起居注
          if (GM.qijuHistory) {
            GM.qijuHistory.unshift({
              turn: turn, date: date,
              content: '【外藩】' + from + ' → 本朝：' + typeInfo + (desc ? '——' + desc.substring(0,80) : ''),
              category: '外交'
            });
          }
        }

        // 处理科技/民政解锁（AI可在推演中解锁科技或推行政策）
        if (p1.tech_civic_unlocks && Array.isArray(p1.tech_civic_unlocks)) {
          p1.tech_civic_unlocks.forEach(function(tu) {
            if (!tu.name) return;
            if (tu.type === 'tech') {
              var tech = GM.techTree ? GM.techTree.find(function(t) { return t.name === tu.name && !t.unlocked; }) : null;
              if (tech) {
                tech.unlocked = true;
                // 扣除费用（如果有）
                if (tech.costs && Array.isArray(tech.costs)) {
                  tech.costs.forEach(function(c) { if (c.variable && GM.vars[c.variable]) GM.vars[c.variable].value = Math.max(GM.vars[c.variable].min||0, GM.vars[c.variable].value - (c.amount||0)); });
                }
                // 应用效果
                if (tech.effect) {
                  Object.entries(tech.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + (parseFloat(e[1])||0), GM.vars[e[0]].min||0, GM.vars[e[0]].max||9999); });
                }
                addEB('\u79D1\u6280', '\u89E3\u9501' + tu.name + (tu.reason ? '(' + tu.reason + ')' : ''));
              }
            } else if (tu.type === 'civic') {
              var civic = GM.civicTree ? GM.civicTree.find(function(c) { return c.name === tu.name && !c.adopted; }) : null;
              if (civic) {
                civic.adopted = true;
                if (civic.costs && Array.isArray(civic.costs)) {
                  civic.costs.forEach(function(c) { if (c.variable && GM.vars[c.variable]) GM.vars[c.variable].value = Math.max(GM.vars[c.variable].min||0, GM.vars[c.variable].value - (c.amount||0)); });
                }
                if (civic.effect) {
                  Object.entries(civic.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + (parseFloat(e[1])||0), GM.vars[e[0]].min||0, GM.vars[e[0]].max||9999); });
                }
                addEB('\u6C11\u653F', '\u63A8\u884C' + tu.name + (tu.reason ? '(' + tu.reason + ')' : ''));
              }
            }
          });
        }

        // 4.1: 处理国策变更（AI可添加/废除国策）
        if (p1.policy_changes && Array.isArray(p1.policy_changes)) {
          if (!GM.customPolicies) GM.customPolicies = [];
          var _pTree = (P.mechanicsConfig && P.mechanicsConfig.policyTree) || [];
          p1.policy_changes.forEach(function(pc) {
            if (!pc.action || !pc.name) return;
            if (pc.action === 'add') {
              // 检查前置条件
              var pDef = _pTree.find(function(pt) { return pt.name === pc.name || pt.id === pc.name; });
              if (pDef && pDef.prerequisites && pDef.prerequisites.length > 0) {
                var allMet = pDef.prerequisites.every(function(pre) {
                  return GM.customPolicies.some(function(cp) { return cp.name === pre || cp.id === pre; });
                });
                if (!allMet) { addEB('国策', pc.name + '前置条件不满足，未能施行'); return; }
              }
              if (!GM.customPolicies.some(function(cp) { return cp.name === pc.name; })) {
                GM.customPolicies.push({ name: pc.name, id: pc.name, enactedTurn: GM.turn, reason: pc.reason || '' });
                addEB('国策', '施行新国策：' + pc.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                // NPC记忆：所有在朝NPC记住新国策
                if (typeof NpcMemorySystem !== 'undefined') {
                  (GM.chars || []).forEach(function(c) {
                    if (c.alive !== false && !c.isPlayer && c.officialTitle) {
                      NpcMemorySystem.remember(c.name, '朝廷推行新国策：' + pc.name, '平', 4);
                    }
                  });
                }
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('policy:enacted', { name: pc.name, reason: pc.reason });
              }
            } else if (pc.action === 'remove') {
              var _idx = GM.customPolicies.findIndex(function(cp) { return cp.name === pc.name || cp.id === pc.name; });
              if (_idx >= 0) {
                GM.customPolicies.splice(_idx, 1);
                addEB('国策', '废除国策：' + pc.name + (pc.reason ? '（' + pc.reason + '）' : ''));
                // NPC记忆：在朝NPC记住国策废除
                if (typeof NpcMemorySystem !== 'undefined') {
                  (GM.chars || []).forEach(function(c) {
                    if (c.alive !== false && !c.isPlayer && c.officialTitle) {
                      NpcMemorySystem.remember(c.name, '朝廷废除国策：' + pc.name, '平', 4);
                    }
                  });
                }
                if (typeof GameEventBus !== 'undefined') GameEventBus.emit('policy:abolished', { name: pc.name, reason: pc.reason });
              }
            }
          });
          if (GM.customPolicies.length > 30) GM.customPolicies = GM.customPolicies.slice(-30);
        }

        // 2.4: 处理阴谋干预（AI可推进/破坏/中止阴谋）
        if (p1.scheme_actions && Array.isArray(p1.scheme_actions) && GM.activeSchemes) {
          p1.scheme_actions.forEach(function(sa) {
            if (!sa.schemeId && !sa.schemer) return;
            var scheme = GM.activeSchemes.find(function(s) {
              return (sa.schemeId && s.id === sa.schemeId) || (sa.schemer && s.schemer === sa.schemer && s.status === 'active');
            });
            if (!scheme) return;
            if (sa.action === 'advance') {
              var _advAmt = Math.abs(parseInt(sa.amount) || 20);
              scheme.progress = Math.min(100, scheme.progress + Math.min(_advAmt, 50));
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '被推进(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划推进顺利', '喜', 5, scheme.target);
            } else if (sa.action === 'disrupt') {
              var _disAmt = Math.abs(parseInt(sa.amount) || 30);
              scheme.progress = Math.max(0, scheme.progress - Math.min(_disAmt, 50));
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '受阻(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划受阻：' + (sa.reason || ''), '忧', 6, scheme.target);
            } else if (sa.action === 'abort') {
              scheme.status = 'failure';
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '被迫中止(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(scheme.schemer, scheme.typeName + '计划被迫中止', '忧', 8, scheme.target);
            } else if (sa.action === 'expose') {
              scheme.status = 'exposed';
              scheme.discovered = true;
              addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '阴谋败露(' + sa.reason + ')');
              if (typeof NpcMemorySystem !== 'undefined') {
                NpcMemorySystem.remember(scheme.schemer, '对' + scheme.target + '的' + scheme.typeName + '阴谋败露，身败名裂', '忧', 9, scheme.target);
                NpcMemorySystem.remember(scheme.target, '识破了' + scheme.schemer + '的' + scheme.typeName + '阴谋', '怒', 8, scheme.schemer);
              }
              // 暴露的阴谋 → 风闻录事（高可信度公告）
              try {
                if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
                  PhaseD.addFengwen({
                    type: '\u63ED\u79C1',
                    text: scheme.schemer + '\u8C0B\u5BB3 ' + scheme.target + ' \u4E4B\u4E8B\u8D25\u9732\u2014\u2014' + String(sa.reason||'').slice(0,60),
                    credibility: 0.9,
                    source: 'scheme_exposed',
                    actors: [scheme.schemer, scheme.target],
                    turn: GM.turn
                  });
                }
              } catch(_e){}
              // 同步更新 ChronicleTracker 条目（阴谋暴露后对玩家可见）
              try {
                if (typeof ChronicleTracker !== 'undefined' && scheme.id) {
                  var _ex = ChronicleTracker.findBySource('scheme', scheme.id);
                  if (_ex) {
                    ChronicleTracker.update(_ex.id, { hidden: false, currentStage: '\u5DF2\u66B4\u9732', result: sa.reason || '' });
                    ChronicleTracker.abort(_ex.id, '\u5DF2\u66B4\u9732');
                  }
                }
              } catch(_e){}
            }
          });
        }

        // 处理时间线/事件触发（统一处理timeline和events）
        if (p1.timeline_triggers && Array.isArray(p1.timeline_triggers)) {
          // 1. 查找时间线事件
          if (P.timeline) {
            var _allTL = [].concat(P.timeline.past||[]).concat(P.timeline.future||[]);
            p1.timeline_triggers.forEach(function(tt) {
              if (!tt.name) return;
              var evt = _allTL.find(function(t) { return (t.name === tt.name || t.event === tt.name) && !t.triggered; });
              if (evt) {
                evt.triggered = true;
                evt.triggeredTurn = GM.turn;
                evt.triggeredResult = tt.result || '';
                addEB('\u5386\u53F2\u8282\u70B9', evt.name + '\u5DF2\u53D1\u751F' + (tt.result ? '\uFF1A' + tt.result : ''));
                _dbg('[TimelineTrigger] ' + evt.name);
              }
            });
          }
          // 2. 也查找编辑器定义的事件（GM.events）
          if (GM.events && GM.events.length > 0) {
            p1.timeline_triggers.forEach(function(tt) {
              if (!tt.name) return;
              var gmEvt = GM.events.find(function(e) { return e.name === tt.name && !e.triggered; });
              if (gmEvt) {
                gmEvt.triggered = true;
                gmEvt.triggeredTurn = GM.turn;
                gmEvt.triggeredResult = tt.result || '';
                addEB('\u4E8B\u4EF6', gmEvt.name + '\u5DF2\u89E6\u53D1' + (tt.result ? '\uFF1A' + tt.result : ''));
                _dbg('[EventTrigger] ' + gmEvt.name);
                // 连锁事件：如果有chainNext，提示AI关注
                if (gmEvt.chainNext) {
                  addEB('\u8FDE\u9501', gmEvt.name + '\u89E6\u53D1\u540E\u5E94\u7EE7\u7EED\u5F15\u53D1: ' + gmEvt.chainNext);
                }
              }
            });
          }
        }
        // 1.1: 处理诏令执行反馈
        if (p1.edict_feedback && Array.isArray(p1.edict_feedback) && GM._edictTracker) {
          p1.edict_feedback.forEach(function(ef) {
            if (!ef.content) return;
            // 模糊匹配到对应的tracker条目
            var tracker = GM._edictTracker.find(function(t) {
              return t.turn === GM.turn && t.status === 'pending' && t.content.indexOf(ef.content.slice(0, 10)) >= 0;
            });
            if (!tracker) {
              // 尝试按类别匹配
              tracker = GM._edictTracker.find(function(t) { return t.turn === GM.turn && t.status === 'pending'; });
            }
            if (tracker) {
              // 远方诏令——信使未送达前强制pending_delivery
              if (tracker._remoteTargets && tracker._letterIds && tracker._letterIds.length > 0) {
                var _allDelivered = tracker._letterIds.every(function(lid) {
                  var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
                  return lt && (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying');
                });
                if (!_allDelivered) {
                  tracker.status = 'pending_delivery';
                  tracker.feedback = ef.feedback || '信使尚在途中，目标NPC未收到诏令';
                  tracker.progressPercent = 0;
                  // 忽略AI的执行反馈——NPC还没收到命令不可能执行
                  return;
                }
              }
              tracker.status = ef.status || 'executing';
              tracker.assignee = ef.assignee || '';
              tracker.feedback = ef.feedback || '';
              tracker.progressPercent = parseInt(ef.progressPercent) || (ef.status === 'completed' ? 100 : 50);
              if (ef.status === 'obstructed') {
                addEB('\u8BCF\u4EE4\u53D7\u963B', tracker.category + '\uFF1A' + tracker.content + ' \u2014 ' + (ef.feedback || '\u6267\u884C\u53D7\u963B'));
              }
            }
          });
        }
      }else{
        shizhengji="\u63A8\u6F14\u5B8C\u6210";
      }

      // 1.4: 幻觉防火墙——后验校验（检查AI返回的人名/地名是否在白名单内）
      if (p1 && p1.npc_actions) {
        var _aliveSet = {};
        (GM.chars || []).forEach(function(c) { if (c.alive !== false) _aliveSet[c.name] = true; });
        p1.npc_actions.forEach(function(act) {
          if (act.name && !_aliveSet[act.name]) {
            // 尝试模糊匹配
            var _fuzzy = (typeof _fuzzyFindChar === 'function') ? _fuzzyFindChar(act.name) : null;
            if (_fuzzy) {
              DebugLog.log('ai', '[幻觉修正] NPC名' + act.name + '→' + _fuzzy.name);
              act.name = _fuzzy.name;
            } else {
              DebugLog.warn('ai', '[幻觉检测] AI生成了不存在的NPC: ' + act.name);
              act._hallucinated = true;
            }
          }
        });
        // 过滤掉无法修正的幻觉NPC行动
        p1.npc_actions = p1.npc_actions.filter(function(a) { return !a._hallucinated; });
      }
      }); // end Sub-call 1 _runSubcall

      // --- Sub-call 1.5: NPC全面深度推演 --- [standard+full]
      await _runSubcall('sc15', 'NPC深度推演', 'standard', async function() {
      showLoading("NPC\u5168\u9762\u63A8\u6F14",60);
      try {
        var tp15 = '\u57FA\u4E8E\u672C\u56DE\u5408\u53D1\u751F\u7684\u4E8B\u4EF6\uFF1A\n';
        if (shizhengji) tp15 += '\u65F6\u653F\u8BB0\uFF1A' + shizhengji + '\n'; // 完整不截断
        if (p1 && p1.npc_actions && p1.npc_actions.length > 0) {
          tp15 += '\u5DF2\u77E5NPC\u884C\u52A8\uFF1A' + p1.npc_actions.map(function(a) { return a.name + ':' + a.action + (a.result?'\u2192'+a.result:''); }).join('\uFF1B') + '\n';
        }
        if (p1 && p1.faction_events && p1.faction_events.length > 0) {
          tp15 += '\u52BF\u529B\u4E8B\u4EF6\uFF1A' + p1.faction_events.map(function(fe){return (fe.actor||'')+fe.action;}).join('\uFF1B') + '\n';
        }
        // 全部存活角色完整状态（不限制数量）
        tp15 += '\n\u5168\u90E8\u5B58\u6D3B\u89D2\u8272\u5F53\u524D\u72B6\u6001\uFF1A\n';
        (GM.chars || []).filter(function(c) { return c.alive !== false; }).forEach(function(c) {
          var parts = [c.name];
          if (c.title) parts.push(c.title);
          if (c.faction) parts.push('\u52BF:' + c.faction);
          if (c.party) parts.push('\u515A:' + c.party);
          if (c.officialTitle && c.officialTitle !== '\u65E0') parts.push('\u5B98:' + c.officialTitle);
          parts.push('\u5FE0' + (c.loyalty || 50) + ' \u91CE' + (c.ambition || 50) + ' \u667A' + (c.intelligence || 50) + ' \u6B66\u52C7' + (c.valor || 50) + ' \u519B\u4E8B' + (c.military || 50) + ' \u653F' + (c.administration || 50) + ' \u7BA1' + (c.management || 50) + ' \u9B45' + (c.charisma || 50) + ' \u4EA4' + (c.diplomacy || 50) + ' \u4EC1' + (c.benevolence || 50));
          if (c.traits && c.traits.length > 0 && typeof getTraitBehaviorSummary === 'function') {
            parts.push('\u7279:' + c.traits.slice(0, 6).map(function(tid) {
              var t = (typeof TRAIT_LIBRARY !== 'undefined' && TRAIT_LIBRARY[tid]) ? TRAIT_LIBRARY[tid].name : tid;
              return t;
            }).join('\u3001'));
          }
          if ((c.stress || 0) > 20) parts.push('\u538B\u529B' + c.stress);
          if (c._mood && c._mood !== '\u5E73') parts.push('\u60C5:' + c._mood);
          if (c.personality) parts.push('\u6027:' + c.personality);
          if (c.spouse) parts.push('[\u540E\u5BAB]');
          if (c.personalGoal) parts.push('\u6C42:' + c.personalGoal.substring(0, 30));
          // 伤疤/勋章——永久影响此人行为的刻骨经历
          if (c._scars && c._scars.length > 0) {
            parts.push('\u4F24:' + c._scars.slice(-3).map(function(s) { return s.event + '[' + s.emotion + ']'; }).join(';'));
          }
          if (c.isPlayer) parts.push('\u2605\u73A9\u5BB6');
          tp15 += '  ' + parts.join(' ') + '\n';
        });
        // 加入显著矛盾（NPC行为应受矛盾驱动）
        if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
          tp15 += '\n\u3010\u663E\u8457\u77DB\u76FE\u2014\u2014NPC\u884C\u4E3A\u5E94\u53D7\u6B64\u9A71\u52A8\u3011\n';
          P.playerInfo.coreContradictions.forEach(function(c) { tp15 += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + '\n'; });
        }
        // 省份状况（影响地方官行为）
        if (GM.provinceStats) {
          var _critProv = Object.entries(GM.provinceStats).filter(function(e){return e[1].unrest>50||e[1].corruption>60;});
          if (_critProv.length > 0) {
            tp15 += '\n\u3010\u5371\u673A\u7701\u4EFD\u3011' + _critProv.map(function(e){return e[0]+' \u6C11\u53D8'+Math.round(e[1].unrest)+' \u8150'+Math.round(e[1].corruption);}).join('\uFF1B') + '\n';
          }
        }
        // 列出本回合的资源变化（让AI思考级联影响）
        if (p1 && p1.resource_changes) {
          tp15 += '\n\u672C\u56DE\u5408\u8D44\u6E90\u53D8\u5316\uFF1A';
          Object.entries(p1.resource_changes).forEach(function(e) { tp15 += e[0] + (parseFloat(e[1]) > 0 ? '+' : '') + e[1] + ' '; });
          tp15 += '\n';
        }
        tp15 += '\n请返回JSON。这是"水面下的冰山"——玩家看不到这些，但它们决定了未来走向：\n';
        tp15 += '{\n';
        tp15 += '  "hidden_moves":["某角色：因为什么→暗中做了什么→目的是什么(40字每条，至少7条)"],\n';
        tp15 += '  "mood_shifts":[{"name":"","loyalty_delta":0,"stress_delta":0,"mood":"新情绪","reason":"(30字)"}],\n';
        tp15 += '  "relationship_changes":[{"a":"角色A","b":"角色B","delta":0,"reason":"关系变化原因"}],\n';
        tp15 += '  "cascade_effects":{"变量名":变化量},\n';
        tp15 += '  "province_impacts":[{"name":"省份","unrest_delta":0,"prosperity_delta":0,"reason":""}],\n';
        tp15 += '  "class_reactions":[{"class":"阶层","satisfaction_delta":0,"reason":""}],\n';
        tp15 += '  "party_maneuvers":[{"party":"党派","action":"动作","target":"对谁"}],\n';
        tp15 += '  "faction_undercurrents":[{"faction":"势力名","situation":"内部局势(40字)","trend":"上升/稳定/动荡/衰落","nextMove":"下一步可能行动(30字)"}],\n';
        tp15 += '  "npc_schemes":[{"schemer":"谁","target":"针对谁","plan":"什么阴谋(40字)","progress":"酝酿中/即将发动/长期布局","allies":"同谋者"}],\n';
        tp15 += '  "rumors":"朝堂/军营/民间/后宫传闻各一条(100字)",\n';
        tp15 += '  "contradiction_shift":"矛盾演化方向(60字)"\n';
        tp15 += '}\n';
        tp15 += '\n■ hidden_moves要求：\n';
        tp15 += '  至少7条（角色越多越需要更多暗流）。必须包含：\n';
        tp15 += '  - 至少3条NPC对NPC的暗中行动（权臣排挤对手、将军暗中联络、谋士居中调停）\n';
        tp15 += '  - 至少1条势力内部暗流（某势力重臣暗中联络他国/谋划政变/收集首领罪证）\n';
        tp15 += '  - 至少1条小人物的小动作（小吏贪墨、商人囤货、探子传信、流民聚集）\n';
        tp15 += '  - 每条必须有"动机链"：因为什么→做了什么→想达到什么目的\n';
        tp15 += '  - 如前几回合有伏笔/暗流，应在此回收或推进\n';
        tp15 += '\n■ faction_undercurrents：每个非玩家势力一条——它们的内部在发生什么？\n';
        tp15 += '  situation写当前内部局势（如"权臣与太子争权白热化""改革派占上风""粮荒导致军心不稳"）\n';
        tp15 += '  trend写趋势方向；nextMove写这个势力下一步可能采取的行动\n';
        tp15 += '\n■ npc_schemes：正在酝酿中的阴谋——可能跨多回合。至少2条。\n';
        tp15 += '  progress:"酝酿中"的阴谋不会本回合发动，但会在future turns逐步推进\n';
        tp15 += '  progress:"即将发动"的阴谋会在下1-2回合爆发\n';
        tp15 += '\n■ mood_shifts: 每个受本回合事件影响的角色都应有心态变化。\n';
        tp15 += '■ relationship_changes: NPC之间的关系变动（不只是NPC与玩家的关系）。';

        var resp15 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp15}], temperature:P.ai.temp||0.8, max_tokens:_tok(12000)})});
        if (resp15.ok) {
          var data15 = await resp15.json();
          _checkTruncated(data15, '人物关系');
          var c15 = '';
          if (data15.choices && data15.choices[0] && data15.choices[0].message) c15 = data15.choices[0].message.content;
          var p15 = extractJSON(c15);
          if (p15) {
            // 应用心态变化
            if (p15.mood_shifts && Array.isArray(p15.mood_shifts)) {
              p15.mood_shifts.forEach(function(ms) {
                if (!ms.name) return;
                var msCh = findCharByName(ms.name);
                if (!msCh) return;
                if (ms.loyalty_delta) msCh.loyalty = clamp((msCh.loyalty || 50) + clamp(parseInt(ms.loyalty_delta) || 0, -10, 10), 0, 100);
                if (ms.stress_delta) msCh.stress = clamp((msCh.stress || 0) + clamp(parseInt(ms.stress_delta) || 0, -10, 10), 0, 100);
              });
            }
            // 应用隐藏关系变化
            if (p15.relationship_changes && Array.isArray(p15.relationship_changes)) {
              p15.relationship_changes.forEach(function(rc) {
                if (!rc.a || !rc.b || !rc.delta) return;
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(rc.a, rc.b, clamp(parseInt(rc.delta) || 0, -15, 15), rc.reason || '\u6697\u6D41');
              });
            }
            // 隐藏行动记入事件日志
            if (p15.hidden_moves && Array.isArray(p15.hidden_moves)) {
              p15.hidden_moves.forEach(function(hm) { addEB('\u6697\u6D41', hm); });
            }
            // 应用级联变量效果（AI补充的连锁影响）
            if (p15.cascade_effects && typeof p15.cascade_effects === 'object') {
              Object.entries(p15.cascade_effects).forEach(function(ce) {
                var varName = ce[0], delta = parseFloat(ce[1]);
                if (isNaN(delta) || !GM.vars[varName]) return;
                // 级联变化幅度限制（防止AI过度调整）
                delta = clamp(delta, -GM.vars[varName].max * 0.05, GM.vars[varName].max * 0.05);
                if (Math.abs(delta) >= 0.1) {
                  GM.vars[varName].value = clamp(GM.vars[varName].value + delta, GM.vars[varName].min, GM.vars[varName].max);
                  _dbg('[Cascade] ' + varName + ': ' + (delta > 0 ? '+' : '') + delta.toFixed(1));
                }
              });
            }
            // 应用省份影响
            if (p15.province_impacts && Array.isArray(p15.province_impacts)) {
              p15.province_impacts.forEach(function(pi) {
                if (!pi.name || !GM.provinceStats || !GM.provinceStats[pi.name]) return;
                var ps = GM.provinceStats[pi.name];
                if (pi.unrest_delta) ps.unrest = clamp((ps.unrest||10) + clamp(parseInt(pi.unrest_delta)||0, -10, 10), 0, 100);
                if (pi.prosperity_delta) ps.wealth = clamp((ps.wealth||50) + clamp(parseInt(pi.prosperity_delta)||0, -8, 8), 0, 100);
              });
            }
            // 应用阶层反应
            if (p15.class_reactions && Array.isArray(p15.class_reactions) && GM.classes) {
              p15.class_reactions.forEach(function(cr) {
                if (!cr.class) return;
                var cls = GM.classes.find(function(c){return c.name===cr.class;});
                if (cls && cr.satisfaction_delta) cls.satisfaction = clamp(parseInt(cls.satisfaction||50) + clamp(parseInt(cr.satisfaction_delta)||0, -8, 8), 0, 100);
              });
            }
            // 应用党派动作到事件日志
            if (p15.party_maneuvers && Array.isArray(p15.party_maneuvers)) {
              p15.party_maneuvers.forEach(function(pm) { if (pm.party && pm.action) addEB('\u515A\u4E89', pm.party + '：' + pm.action + (pm.target ? '(\u9488\u5BF9' + pm.target + ')' : '')); });
            }
            // 矛盾演化记入事件
            if (p15.contradiction_shift) addEB('\u77DB\u76FE', p15.contradiction_shift);
            // 流言用于Sub-call 2叙事
            if (p15.rumors) p1Summary = (p1Summary || '') + '\u3010\u6D41\u8A00\u3011' + p15.rumors + '\n';

            // 势力内部暗流——保留历史（最近3回合的暗流，供AI看到趋势演变）
            if (p15.faction_undercurrents && Array.isArray(p15.faction_undercurrents)) {
              if (!GM._factionUndercurrents) GM._factionUndercurrents = [];
              if (!GM._factionUndercurrentsHistory) GM._factionUndercurrentsHistory = [];
              // 存档当前轮暗流到历史
              if (GM._factionUndercurrents.length > 0) {
                GM._factionUndercurrentsHistory.push({ turn: GM.turn, data: GM._factionUndercurrents });
                if (GM._factionUndercurrentsHistory.length > 3) GM._factionUndercurrentsHistory.shift();
              }
              GM._factionUndercurrents = p15.faction_undercurrents;
              p15.faction_undercurrents.forEach(function(fu) {
                if (fu.faction && fu.situation) {
                  addEB('势力·内幕', fu.faction + '：' + fu.situation + (fu.trend ? '（' + fu.trend + '）' : ''));
                  // 动荡/衰落的势力扣strength
                  if (fu.trend === '动荡' || fu.trend === '衰落') {
                    var _uFac = findFacByName(fu.faction);
                    if (_uFac) _uFac.strength = Math.max(1, (_uFac.strength||50) - (fu.trend === '衰落' ? 2 : 1));
                  }
                }
              });
            }

            // NPC阴谋——存入GM，跨回合持续推进
            if (p15.npc_schemes && Array.isArray(p15.npc_schemes)) {
              if (!GM.activeSchemes) GM.activeSchemes = [];
              p15.npc_schemes.forEach(function(sc2) {
                if (!sc2.schemer || !sc2.plan) return;
                // 查找是否有已存在的同一阴谋
                var existing = GM.activeSchemes.find(function(s) { return s.schemer === sc2.schemer && s.target === sc2.target; });
                if (existing) {
                  // 更新进度
                  existing.plan = sc2.plan;
                  existing.progress = sc2.progress || existing.progress;
                  existing.allies = sc2.allies || existing.allies;
                  existing.lastTurn = GM.turn;
                } else {
                  GM.activeSchemes.push({ schemer: sc2.schemer, target: sc2.target || '', plan: sc2.plan, progress: sc2.progress || '酝酿中', allies: sc2.allies || '', startTurn: GM.turn, lastTurn: GM.turn });
                }
                // 记入阴谋者记忆
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(sc2.schemer, '\u6697\u4E2D\u8C0B\u5212\uFF1A' + sc2.plan, '\u5E73', 4, sc2.target || '');
                }
                addEB('暗流', sc2.schemer + '密谋' + (sc2.target ? '针对' + sc2.target : '') + '（' + (sc2.progress || '') + '）');
              });
              // 清理过期阴谋（超过5回合未更新的视为放弃）
              GM.activeSchemes = GM.activeSchemes.filter(function(s) { return GM.turn - s.lastTurn < 5; });
            }

            GM._turnAiResults.subcall15 = p15;
            _dbg('[NPC Deep] hidden:', (p15.hidden_moves||[]).length, 'mood:', (p15.mood_shifts||[]).length, 'undercurrents:', (p15.faction_undercurrents||[]).length, 'schemes:', (p15.npc_schemes||[]).length);
          }
        }
      } catch(e15) { _dbg('[NPC Deep] \u5931\u8D25:', e15); throw e15; }
      }); // end Sub-call 1.5 _runSubcall

      // --- Sub-call 1.6: 势力自主推演 --- [full only]
      await _runSubcall('sc16', '势力推演', 'full', async function() {
      showLoading("\u52BF\u529B\u81EA\u4E3B\u63A8\u6F14",63);
      try {
        var tp16 = '\u57FA\u4E8E\u672C\u56DE\u5408\u5C40\u52BF\uFF0C\u63A8\u6F14\u6BCF\u4E2A\u975E\u73A9\u5BB6\u52BF\u529B\u7684\u81EA\u4E3B\u884C\u52A8\uFF1A\n';
        tp16 += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji||'').substring(0,500) + '\n';
        (GM.facs||[]).forEach(function(f) {
          if (f.isPlayer) return;
          tp16 += f.name + ' \u5B9E\u529B' + (f.strength||50) + (f.leader?' \u9996\u9886:'+f.leader:'') + (f.goal?' \u76EE\u6807:'+f.goal:'') + (f.attitude?' \u6001\u5EA6:'+f.attitude:'') + '\n';
        });
        if (GM.factionRelations && GM.factionRelations.length > 0) {
          tp16 += '\u52BF\u529B\u5173\u7CFB\uFF1A' + GM.factionRelations.map(function(r){return r.from+'\u2192'+r.to+' '+r.type+'('+r.value+')';}).join('\uFF1B') + '\n';
        }
        // 势力暗流（连续性——上回合行动应有后续）
        if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) {
          tp16 += '\n【势力暗流——上回合行动应有后续进展】\n';
          GM._factionUndercurrents.forEach(function(fu) {
            tp16 += '  ' + fu.faction + '：' + fu.situation + (fu.nextMove ? ' 可能行动:' + fu.nextMove : '') + '\n';
          });
        }
        // 势力叙事（记忆上文）
        if (GM._factionNarratives) {
          var _fnKeys = Object.keys(GM._factionNarratives);
          if (_fnKeys.length > 0) {
            tp16 += '【势力发展记忆】\n';
            _fnKeys.forEach(function(k) { tp16 += '  ' + k + '\uFF1A' + (GM._factionNarratives[k]||'') + '\n'; });
          }
        }
        tp16 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"faction_actions":[{"faction":"\u52BF\u529B\u540D","action":"\u5177\u4F53\u884C\u52A8(50\u5B57)","target":"\u5BF9\u8C01","motive":"\u52A8\u673A","impact":"\u5F71\u54CD"}],"diplomatic_shifts":[{"from":"","to":"","old_relation":"","new_relation":"","reason":""}],"territorial_changes":"\u9886\u571F\u53D8\u5316\u63CF\u8FF0(100\u5B57)","power_balance_shift":"\u529B\u91CF\u5BF9\u6BD4\u53D8\u5316(100\u5B57)"}\n';
        tp16 += '\u6BCF\u4E2A\u52BF\u529B\u90FD\u5E94\u6709\u884C\u52A8\u3002\u5305\u62EC\u6218\u4E89\u3001\u8054\u76DF\u3001\u8D38\u6613\u3001\u5185\u90E8\u6574\u5408\u3001\u6269\u5F20\u3001\u9632\u5FA1\u7B49\u3002';
        var resp16 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp16}], temperature:P.ai.temp||0.8, max_tokens:_tok(8000)})});
        if (resp16.ok) {
          var j16 = await resp16.json(); _checkTruncated(j16, '势力行动'); var c16 = j16.choices&&j16.choices[0]?j16.choices[0].message.content:'';
          var p16 = extractJSON(c16);
          if (p16) {
            if (p16.faction_actions && Array.isArray(p16.faction_actions)) {
              p16.faction_actions.forEach(function(fa) { if (fa.faction && fa.action) addEB('\u52BF\u529B\u52A8\u6001', fa.faction + '：' + fa.action); });
            }
            if (p16.diplomatic_shifts && Array.isArray(p16.diplomatic_shifts)) {
              p16.diplomatic_shifts.forEach(function(ds) {
                if (ds.from && ds.to && GM.factionRelations) {
                  var rel = GM.factionRelations.find(function(r){return r.from===ds.from&&r.to===ds.to;});
                  if (rel && ds.new_relation) { rel.type = ds.new_relation; addEB('\u5916\u4EA4', ds.from+'\u2192'+ds.to+' '+ds.new_relation); }
                }
              });
            }
            p1Summary = (p1Summary||'') + '\u3010\u52BF\u529B\u52A8\u6001\u3011' + (p16.power_balance_shift||'') + '\n';
            GM._turnAiResults.subcall16 = p16;
          }
        }
      } catch(e16) { _dbg('[Faction Auto] fail:', e16); throw e16; }
      }); // end Sub-call 1.6 _runSubcall

      // --- Sub-call 1.7: 经济财政专项推演 --- [full only]
      await _runSubcall('sc17', '经济财政', 'full', async function() {
      showLoading("\u7ECF\u6D4E\u8D22\u653F\u63A8\u6F14",65);
      try {
        var tp17 = '\u672C\u56DE\u5408\u7ECF\u6D4E\u8D22\u653F\u72B6\u51B5\uFF1A\n';
        Object.entries(GM.vars||{}).forEach(function(e) { tp17 += '  ' + e[0] + '=' + Math.round(e[1].value) + (e[1].unit||'') + '\n'; });
        if (GM.provinceStats) {
          tp17 += '\u5730\u65B9\u533A\u5212\uFF1A\n';
          Object.entries(GM.provinceStats).forEach(function(e) { var ps=e[1]; tp17 += '  ' + e[0] + ' \u7A0E'+ps.taxRevenue+' \u8D22'+ps.wealth+' \u6C11\u53D8'+Math.round(ps.unrest)+' \u8150'+Math.round(ps.corruption)+'\n'; });
        }
        if (p1 && p1.resource_changes) tp17 += '\u672C\u56DE\u5408\u8D44\u6E90\u53D8\u5316\uFF1A' + JSON.stringify(p1.resource_changes) + '\n';
        tp17 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"fiscal_analysis":"\u8D22\u653F\u5B8C\u6574\u5206\u6790\u2014\u2014\u6536\u5165\u6765\u6E90\u3001\u652F\u51FA\u538B\u529B\u3001\u76C8\u4E8F\u72B6\u51B5(200\u5B57)","trade_dynamics":"\u8D38\u6613\u548C\u5546\u4E1A\u52A8\u6001(100\u5B57)","inflation_pressure":"\u901A\u80C0/\u7269\u4EF7\u538B\u529B(80\u5B57)","resource_forecast":"\u4E0B\u56DE\u5408\u8D44\u6E90\u9884\u6D4B(100\u5B57)","economic_advice":"\u7ECF\u6D4E\u5EFA\u8BAE\u2014\u2014\u5E94\u8BE5\u505A\u4EC0\u4E48\u4E0D\u5E94\u8BE5\u505A\u4EC0\u4E48(100\u5B57)","supplementary_resource_changes":{"\u53D8\u91CF\u540D":\u8865\u5145\u53D8\u5316\u91CF}}';
        var resp17 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp17}], temperature:0.6, max_tokens:_tok(12000)})});
        if (resp17.ok) {
          var j17 = await resp17.json(); _checkTruncated(j17, '资源变动'); var c17 = j17.choices&&j17.choices[0]?j17.choices[0].message.content:'';
          var p17 = extractJSON(c17);
          if (p17) {
            if (p17.supplementary_resource_changes && typeof p17.supplementary_resource_changes === 'object') {
              Object.entries(p17.supplementary_resource_changes).forEach(function(e) {
                var d = parseFloat(e[1]); if (isNaN(d) || !GM.vars[e[0]]) return;
                d = clamp(d, -GM.vars[e[0]].max*0.03, GM.vars[e[0]].max*0.03);
                if (Math.abs(d) >= 0.1) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value+d, GM.vars[e[0]].min, GM.vars[e[0]].max);
              });
            }
            p1Summary = (p1Summary||'') + '\u3010\u8D22\u653F\u3011' + (p17.fiscal_analysis||'').substring(0,100) + '\n';
            GM._turnAiResults.subcall17 = p17;
          }
        }
      } catch(e17) { _dbg('[Econ] fail:', e17); throw e17; }
      }); // end Sub-call 1.7 _runSubcall

      // --- Sub-call 1.8: 军事态势专项推演 --- [full only]
      await _runSubcall('sc18', '军事态势', 'full', async function() {
      showLoading("\u519B\u4E8B\u6001\u52BF\u63A8\u6F14",67);
      try {
        var tp18 = '\u672C\u56DE\u5408\u519B\u4E8B\u6001\u52BF\uFF1A\n';
        (GM.armies||[]).forEach(function(a) {
          if (a.destroyed) return;
          tp18 += '  ' + a.name + ' \u5175' + (a.soldiers||0) + ' \u58EB\u6C14' + (a.morale||50) + ' \u8BAD' + (a.training||50) + (a.commander?' \u5E05:'+a.commander:'') + (a.faction?' \u5C5E:'+a.faction:'') + (a.garrison?' \u9A7B:'+a.garrison:'') + '\n';
        });
        if (p1 && p1.army_changes && p1.army_changes.length > 0) tp18 += '\u672C\u56DE\u5408\u519B\u4E8B\u53D8\u52A8\uFF1A' + p1.army_changes.map(function(a){return a.name+' \u5175'+a.soldiers_delta;}).join('\uFF1B') + '\n';
        tp18 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"military_situation":"\u5168\u5C40\u519B\u4E8B\u6001\u52BF\u5206\u6790(200\u5B57)","border_threats":"\u8FB9\u5883\u5A01\u80C1\u8BC4\u4F30(150\u5B57)","army_morale_analysis":"\u5404\u519B\u58EB\u6C14\u5206\u6790\u548C\u98CE\u9669(100\u5B57)","supplementary_army_changes":[{"name":"\u90E8\u961F","soldiers_delta":0,"morale_delta":0,"reason":""}],"war_probability":"\u4E0B\u56DE\u5408\u7206\u53D1\u6218\u4E89\u7684\u6982\u7387\u548C\u65B9\u5411(80\u5B57)"}';
        var resp18 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp18}], temperature:0.7, max_tokens:_tok(12000)})});
        if (resp18.ok) {
          var j18 = await resp18.json(); _checkTruncated(j18, '军事变动'); var c18 = j18.choices&&j18.choices[0]?j18.choices[0].message.content:'';
          var p18 = extractJSON(c18);
          if (p18) {
            if (p18.supplementary_army_changes && Array.isArray(p18.supplementary_army_changes)) {
              p18.supplementary_army_changes.forEach(function(ac) {
                if (!ac.name) return;
                var army = (GM.armies||[]).find(function(a){return a.name===ac.name;});
                if (army) {
                  if (ac.soldiers_delta) army.soldiers = Math.max(0, (army.soldiers||0) + clamp(parseInt(ac.soldiers_delta)||0, -500, 500));
                  if (ac.morale_delta) army.morale = clamp((army.morale||50) + clamp(parseInt(ac.morale_delta)||0, -10, 10), 0, 100);
                  if (ac.reason) addEB('\u519B\u4E8B', army.name + '：' + ac.reason);
                }
              });
            }
            p1Summary = (p1Summary||'') + '\u3010\u519B\u4E8B\u3011' + (p18.military_situation||'').substring(0,100) + '\n';
            GM._turnAiResults.subcall18 = p18;
          }
        }
      } catch(e18) { _dbg('[Military] fail:', e18); throw e18; }
      }); // end Sub-call 1.8 _runSubcall

      // --- Sub-call 1.9: 新实体丰化（复用编辑器 AI 级 schema，填充骨架） ---
      await _runSubcall('sc19', '新实体丰化', 'lite', async function() {
        try {
          var _RETRY_WINDOW = 3; // 失败后 3 回合内可重试
          var _sparseFacs = (GM.facs||[]).filter(function(f) {
            return f._createdTurn != null && (GM.turn - f._createdTurn) <= _RETRY_WINDOW && !f._enriched && !f.isPlayer;
          });
          var _sparseClasses = (GM.classes||[]).filter(function(c) {
            return c._emergeTurn != null && (GM.turn - c._emergeTurn) <= _RETRY_WINDOW && !c._enriched;
          });
          var _sparseParties = (GM.parties||[]).filter(function(p) {
            return p._createdTurn != null && (GM.turn - p._createdTurn) <= _RETRY_WINDOW && !p._enriched;
          });
          var _sparseChars = (GM.chars||[]).filter(function(c) {
            var _turn = (c._spawnedFromOffice && c._spawnedFromOffice.turn)
              || (c._spawnedFromRevolt && c._spawnedFromRevolt.turn)
              || c._createdTurn;
            return _turn != null && (GM.turn - _turn) <= _RETRY_WINDOW && !c._enriched;
          });

          var _totalSparse = _sparseFacs.length + _sparseClasses.length + _sparseParties.length + _sparseChars.length;
          if (_totalSparse === 0) return; // 无新实体，跳过

          showLoading('AI 丰化新实体（' + _totalSparse + '项）', 68);
          _dbg('[Enrich] 丰化 ' + _totalSparse + ' 项：facs' + _sparseFacs.length + ' classes' + _sparseClasses.length + ' parties' + _sparseParties.length + ' chars' + _sparseChars.length);

          var dynasty = sc.dynasty || sc.era || '';
          var startY = sc.startYear || (sc.gameSettings && sc.gameSettings.startYear) || '';
          var _existingClassNames = (GM.classes||[]).map(function(c){return c.name;}).join('、');
          var _existingCharNames = (GM.chars||[]).filter(function(c){return c.alive!==false;}).slice(0, 60).map(function(c){return c.name;}).join('、');

          var enrichP = '你是' + dynasty + '历史学家。当前是公元' + startY + '年+' + GM.turn + '回合。以下新出现的实体只有骨架，请按史实风格补齐完整字段。\n\n';
          enrichP += '【数值基准——必须遵守】\n';
          enrichP += '· 角色能力按档：顶级92-98/优秀80-91/中等60-79/平庸40-59/拙劣<40\n';
          enrichP += '  武将：valor/military 高；文臣：administration/intelligence 高；管理者：management 高；后妃：charisma 高\n';
          enrichP += '  武勇(个人武力)≠军事(统兵)：吕布 valor99 military70；诸葛亮 military95 valor25\n';
          enrichP += '  治政(行政)≠管理(理财)：王安石 administration88 management92；桑弘羊 management98 administration75\n';
          enrichP += '· 五常(仁义礼智信)按性格定位：compassionate→仁高；just/zealous→义高；humble→礼高；intelligence 约等于 智；honest→信高\n';
          enrichP += '· 起义领袖：charisma 75-90 valor 60-80 benevolence 40-70 loyalty 5-20（对旧朝）\n';
          enrichP += '· 官制占位实体化：品级与能力不强绑——高品可有恩荫庸才(adm40)，低品可有潜龙大才(adm90)；\n';
          enrichP += '  主官通常能力中上(主维度 60-85)，佐官 50-75，小吏 40-65；但特殊情况皆可（贬谪/恩荫/潜龙）\n';
          enrichP += '· 每人数值必须不同，不得雷同！\n\n';

          if (_sparseFacs.length > 0) {
            enrichP += '【待丰化·势力】\n';
            _sparseFacs.forEach(function(f) {
              enrichP += '  ' + f.name + ' 类型:' + (f.type||'?') + ' 首脑:' + (f.leader||'?') + ' 领地:' + (f.territory||'?') + '\n';
              if (f.parentFaction) enrichP += '    脱离自:' + f.parentFaction + '\n';
              if (f.description) enrichP += '    背景:' + f.description + '\n';
            });
            enrichP += '  每个势力须返回:\n';
            enrichP += '    leaderInfo:{name,age,gender,personality(30字),belief,learning,ethnicity,bio(80字)}\n';
            enrichP += '    heirInfo(可null)、resources(主要资源)、mainstream(主体民族/信仰)、culture(文化特征)\n';
            enrichP += '    goal(战略目标 20字)、militaryBreakdown(若缺则按 militaryStrength 分解)\n';
            enrichP += '    description(100-150字 补全历史背景、政治特点、与玩家关系)\n';
          }

          if (_sparseClasses.length > 0) {
            enrichP += '\n【待丰化·阶层】\n';
            _sparseClasses.forEach(function(c) {
              enrichP += '  ' + c.name + (c._origin?' 源于:'+c._origin:'') + (c.description?' 描述:'+c.description.slice(0,80):'') + '\n';
            });
            enrichP += '  参考现有阶层名:' + _existingClassNames + '（勿重复）\n';
            enrichP += '  参考现有角色:' + _existingCharNames + '\n';
            enrichP += '  每个阶层须返回:\n';
            enrichP += '    representativeNpcs:[从上列角色中挑选 2-4 个]\n';
            enrichP += '    leaders:[领袖 1-3 人，可与代表重合]\n';
            enrichP += '    supportingParties:[倾向支持的党派]\n';
            enrichP += '    regionalVariants:[2-4 个地域变体 {region,satisfaction,distinguishing}]\n';
            enrichP += '    internalFaction:[1-2 个内部分化 {name,size,stance}]\n';
            enrichP += '    privileges、obligations、demands 补全\n';
          }

          if (_sparseParties.length > 0) {
            enrichP += '\n【待丰化·党派】\n';
            _sparseParties.forEach(function(p) {
              enrichP += '  ' + p.name + ' 立场:' + (p.ideology||'?') + ' 首领:' + (p.leader||'?') + ' 议程:' + (p.currentAgenda||'?') + '\n';
            });
            enrichP += '  参考现有角色:' + _existingCharNames + '\n';
            enrichP += '  参考现有阶层:' + _existingClassNames + '\n';
            enrichP += '  每个党派须返回:\n';
            enrichP += '    shortGoal、longGoal、description(100字)\n';
            enrichP += '    members(主要成员，逗号分隔，从现有角色中选 3-6 人)\n';
            enrichP += '    base(支持群体如"士绅/寒门/军功贵族")\n';
            enrichP += '    policyStance(政策立场标签 3-5 个)\n';
            enrichP += '    socialBase:[{class,affinity:-1~1}]（补全与阶层关联）\n';
            enrichP += '    agenda_history:[{turn:负数回溯,agenda,outcome}]（回溯 1-2 条历史）\n';
            enrichP += '    focal_disputes:[{topic,rival,stakes}]\n';
          }

          if (_sparseChars.length > 0) {
            enrichP += '\n【待丰化·角色】\n';
            _sparseChars.forEach(function(c) {
              var _origin = c._spawnedFromRevolt ? ('起义领袖：'+c._spawnedFromRevolt.class)
                : c._spawnedFromOffice ? ('官制实体化：'+c._spawnedFromOffice.dept+c._spawnedFromOffice.position)
                : '新出场';
              enrichP += '  ' + c.name + (c.title?'('+c.title+')':'') + ' ' + _origin + '\n';
              if (c.age) enrichP += '    年' + c.age + ' 忠' + (c.loyalty||50) + ' 政' + (c.administration||50) + ' 武' + (c.valor||50) + '\n';
            });
            enrichP += '  每个角色须返回:\n';
            enrichP += '    family(家族)、birthplace(籍贯)、ethnicity(民族)、culture(文化背景)\n';
            enrichP += '    learning(学识如"经学/律学/兵法")、faith(信仰)\n';
            enrichP += '    speechStyle(说话风格 20字)、personalGoal(心中所求 30字)\n';
            enrichP += '    personality(性格 40字)、bio(生平 80-120字)\n';
            enrichP += '    appearance(外貌 30字)\n';
            enrichP += '    traits:[特质标签 3-5 个，如"刚直/狡诈/仁厚/多疑"]\n';
          }

          enrichP += '\n返回 JSON：{\n';
          if (_sparseFacs.length) enrichP += '"factions_enriched":[{"name":"原势力名(锚点)","leaderInfo":{...},"heirInfo":{...}或null,"resources":"","mainstream":"","culture":"","goal":"","description":""}],\n';
          if (_sparseClasses.length) enrichP += '"classes_enriched":[{"name":"","representativeNpcs":[],"leaders":[],"supportingParties":[],"regionalVariants":[],"internalFaction":[],"privileges":"","obligations":"","demands":""}],\n';
          if (_sparseParties.length) enrichP += '"parties_enriched":[{"name":"","shortGoal":"","longGoal":"","description":"","members":"","base":"","policyStance":[],"socialBase":[],"agenda_history":[],"focal_disputes":[]}],\n';
          if (_sparseChars.length) enrichP += '"characters_enriched":[{"name":"","family":"","birthplace":"","ethnicity":"","culture":"","learning":"","faith":"","speechStyle":"","personalGoal":"","personality":"","bio":"","appearance":"","traits":[]}]\n';
          enrichP += '}\n请严格按史实生成；name 必须精确对应上方骨架名。';

          var _enrichBody = {
            model: P.ai.model || 'gpt-4o',
            messages: [{ role: 'user', content: enrichP }],
            temperature: 0.7,
            max_tokens: _tok(4000)
          };
          if (_modelFamily === 'openai') _enrichBody.response_format = { type: 'json_object' };
          var respE = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body: JSON.stringify(_enrichBody)});
          if (!respE.ok) { _dbg('[Enrich] HTTP ' + respE.status); return; }
          var dataE = await respE.json();
          if (dataE.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(dataE.usage);
          var cE = (dataE.choices && dataE.choices[0] && dataE.choices[0].message) ? dataE.choices[0].message.content : '';
          var pE = extractJSON(cE);
          if (!pE) { _dbg('[Enrich] JSON 解析失败'); return; }

          // 合并回 GM——只覆盖空字段，保留 AI 已生成的内容
          function _mergeIfEmpty(target, src, keys) {
            keys.forEach(function(k) {
              var v = src[k];
              if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return;
              var tv = target[k];
              var isEmpty = tv === undefined || tv === null || tv === '' || (Array.isArray(tv) && tv.length === 0) || (typeof tv === 'object' && !Array.isArray(tv) && Object.keys(tv||{}).length === 0);
              if (isEmpty) target[k] = v;
            });
          }

          if (Array.isArray(pE.factions_enriched)) {
            pE.factions_enriched.forEach(function(ef) {
              if (!ef || !ef.name) return;
              var tgt = GM.facs.find(function(f){return f.name === ef.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ef, ['leaderInfo','heirInfo','resources','mainstream','culture','goal']);
              if (ef.description && (!tgt.description || tgt.description.length < 80)) tgt.description = ef.description;
              if (ef.militaryBreakdown && tgt.militaryBreakdown) _mergeIfEmpty(tgt.militaryBreakdown, ef.militaryBreakdown, ['standingArmy','militia','elite','fleet']);
              tgt._enriched = true;
              _dbg('[Enrich] faction done: ' + ef.name);
            });
          }
          if (Array.isArray(pE.classes_enriched)) {
            pE.classes_enriched.forEach(function(ec) {
              if (!ec || !ec.name) return;
              var tgt = GM.classes.find(function(c){return c.name === ec.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ec, ['representativeNpcs','leaders','supportingParties','regionalVariants','internalFaction','privileges','obligations','demands']);
              tgt._enriched = true;
              _dbg('[Enrich] class done: ' + ec.name);
            });
          }
          if (Array.isArray(pE.parties_enriched)) {
            pE.parties_enriched.forEach(function(ep) {
              if (!ep || !ep.name) return;
              var tgt = GM.parties.find(function(p){return p.name === ep.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ep, ['shortGoal','longGoal','description','members','base','policyStance','socialBase','agenda_history','focal_disputes']);
              tgt._enriched = true;
              _dbg('[Enrich] party done: ' + ep.name);
            });
          }
          if (Array.isArray(pE.characters_enriched)) {
            pE.characters_enriched.forEach(function(ech) {
              if (!ech || !ech.name) return;
              var tgt = findCharByName(ech.name);
              if (!tgt) return;
              _mergeIfEmpty(tgt, ech, ['family','birthplace','ethnicity','culture','learning','faith','speechStyle','personalGoal','personality','bio','appearance','traits']);
              tgt._enriched = true;
              // 写入 NPC 记忆：初始身世记忆
              if (typeof NpcMemorySystem !== 'undefined' && ech.bio) {
                NpcMemorySystem.remember(ech.name, '身世：' + ech.bio.slice(0, 60), '平', 5);
              }
              _dbg('[Enrich] char done: ' + ech.name);
            });
          }

          GM._turnAiResults.subcall19 = pE;
          addEB('\u4E30\u5316', '\u672C\u56DE\u5408\u4E30\u5316\u65B0\u5B9E\u4F53 ' + _totalSparse + ' \u9879');
          _dbg('[Enrich] 完成 ' + _totalSparse + ' 项丰化');
        } catch (eE) { _dbg('[Enrich] fail:', eE); }
      }); // end Sub-call 1.9

      // --- Sub-call 2: 后人戏说（场景叙事，完整生活进程） --- [always runs]
      await _runSubcall('sc2', '后人戏说', 'lite', async function() {
      showLoading("AI撰写后人戏说",70);
      // 将Sub-call 1的决策摘要传给Sub-call 2，确保叙事与数据一致
      p1Summary = '';
      if (p1) {
        if (shizhengji) p1Summary += '【时政记(摘要)】' + shizhengji.substring(0, 400) + '\n';
        if (shiluText) p1Summary += '【实录】' + shiluText + '\n';
        if (p1.npc_actions && p1.npc_actions.length > 0) {
          p1Summary += '【NPC行动】' + p1.npc_actions.map(function(a) { return a.name + ':' + a.action; }).join('；') + '\n';
        }
        if (p1.character_deaths && p1.character_deaths.length > 0) {
          p1Summary += '【死亡】' + p1.character_deaths.map(function(d) { return d.name + ':' + d.reason; }).join('；') + '\n';
        }
        if (p1.event && p1.event.title) p1Summary += '【事件】' + p1.event.title + '\n';
        if (personnelChanges && personnelChanges.length > 0) {
          p1Summary += '【人事】' + personnelChanges.map(function(p){return p.name+'→'+p.change;}).join('；') + '\n';
        }
        // 额外上下文
        if (GM._energy !== undefined && GM._energy < 40) p1Summary += '【君主疲态】精力' + Math.round(GM._energy) + '%——应暗示倦容\n';
        if (GM._successionEvent) p1Summary += '【帝位更迭】' + GM._successionEvent.from + '→' + GM._successionEvent.to + '（重点描写）\n';
        if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) p1Summary += '【待铨】' + GM._kejuPendingAssignment.length + '名进士等待授官\n';
      }
      // 附加：玩家本回合推演依据（让AI明白哪些要体现在场景中）
      var _basisBrief = '';
      // 名望/贤能显著变动的 NPC（供后人戏说穿插议论）
      try {
        var _fvMovers = (GM.chars || []).filter(function(c){
          return c && c.alive!==false && !c.isPlayer && c._fameHistory &&
                 c._fameHistory.some(function(h){return h.turn === GM.turn;});
        }).slice(0, 5);
        if (_fvMovers.length > 0) {
          _basisBrief += '【本回合名望/贤能显著变动的 NPC(可在后人戏说里穿插议论/清议/书院学子的评论)】\n';
          _fvMovers.forEach(function(c){
            var _thisTurn = (c._fameHistory||[]).filter(function(h){return h.turn===GM.turn;});
            var _totalD = _thisTurn.reduce(function(s,h){return s+(h.delta||0);},0);
            var _reasons = _thisTurn.map(function(h){return h.reason||'';}).filter(Boolean).slice(0,2).join('/');
            _basisBrief += '  · ' + c.name + ' 名望' + (_totalD>0?'+':'') + _totalD.toFixed(0) + '（' + _reasons + '）\n';
          });
        }
      } catch(_mvE){}
      if (edicts) {
        var _eL = [];
        if (edicts.political) _eL.push('政令:' + edicts.political.substring(0,60));
        if (edicts.military) _eL.push('军令:' + edicts.military.substring(0,60));
        if (edicts.diplomatic) _eL.push('外交:' + edicts.diplomatic.substring(0,60));
        if (edicts.economic) _eL.push('经济:' + edicts.economic.substring(0,60));
        if (edicts.other) _eL.push('其他:' + edicts.other.substring(0,60));
        if (_eL.length) _basisBrief += '\n【玩家诏令(须在场景中具体展开执行过程)】\n  ' + _eL.join('\n  ') + '\n';
      }
      if (xinglu) _basisBrief += '【主角私人行止(须作为主角日常生活片段呈现)】\n  ' + xinglu + '\n';
      if (memRes && memRes.length) {
        var _appMem = memRes.filter(function(m){return m.status==='approved'||m.status==='rejected';}).slice(0,5);
        if (_appMem.length) {
          _basisBrief += '【本回合奏疏批复(至少一份要在场景中被具体展开)】\n';
          _appMem.forEach(function(m){ _basisBrief += '  '+m.from+'('+m.type+')——'+(m.status==='approved'?'准':'驳')+(m.reply?' 批:'+m.reply.substring(0,30):'')+'\n'; });
        }
      }
      if (GM._courtRecords) {
        var _thisCourt = GM._courtRecords.filter(function(r){return (r.targetTurn||r.turn)===GM.turn;});
        if (_thisCourt.length) {
          _basisBrief += '【本回合朝议/问对(作为场景展现)】\n';
          _thisCourt.slice(-3).forEach(function(r){ _basisBrief += '  '+(r.topic||r.mode||'议事')+'\n'; });
        }
      }

      var tp2 = p1Summary + _basisBrief
        + (aiThinking ? '【AI分析】' + aiThinking.substring(0, 200) + '\n' : '')
        + "\n基于上述全部资料，撰写《后人戏说》——这是玩家角色本回合的完整生活进程，核心目的是**完整、立体地呈现玩家角色的日常生活**，让玩家看见自己的角色如何度过这一段时光。\n"
        + "【核心要义——叙事性第一】\n"
        + "  这不是战报、不是史书、不是摘要，而是一段可读的故事。让玩家'跟着角色过完这段日子'。\n"
        + "  要有人物的具体动作、神态、对话、内心活动；要有场景的具体环境、时间、氛围。\n"
        + "  玩家角色不是一个抽象的决策符号，是一个有血有肉的人——他吃饭、他疲倦、他忧虑、他动怒、他思念、他沉默。\n"
        + "【结构骨架——按时辰顺序自然展开】\n"
        + "  晨(卯时)：主角起身——批阅奏折/晨起盥洗/与近侍对话/晨食\n"
        + "  上午(辰时-巳时)：正式政务——朝会/殿见大臣/军务讨论/外交接见\n"
        + "  午后(未时-申时)：续政务/接见/巡视/或私事(若本回合有帝王私行/内眷互动)\n"
        + "  傍晚(酉时-戌时)：私人时间——家人/帝后对话/内省/私下思考；也可继续政务\n"
        + "  深夜/就寝：只在本回合有特别事件时写\n"
        + "  日与日之间用空行或'……'切换；若本回合跨多日请分日叙述\n"
        + "  注：时辰只是顺序参考，具体节奏看本回合实际内容——不必强行每个时段都写\n"
        + "【文风——重在叙事，而非特定标点】\n"
        + "  · **标点自由**：可用句号/逗号/冒号/引号正常组织句子；破折号可用可不用，不强制；顿号、分号也可用\n"
        + "  · 以叙事流畅为首要目标——避免电报体、避免列清单、避免句句破折\n"
        + "  · 对话自然融入场景；可带'说道''答道''低声道'等叙事动词，也可不带(上下文能识别即可)\n"
        + "  · 每个人物说话方式要贴合其性格(忠臣的直/佞臣的滑/老臣的稳/年少者的急/亲眷的柔)\n"
        + "  · 数据融入场景——不要列'国库-20万'，而写成对话或动作(如'户部侍郎垂首奏报：库银减了二十万两，赈灾拨了十五……')\n"
        + "  · 穿插生活碎片：饮食、天气、季节、家人互动(子女成长、帝后闲谈、妃嫔往来)\n"
        + "  · 内心独白可直接写角色所想，不必隐藏——如'他想，今日这事，父皇当年怕是也难办吧。'\n"
        + "  · 幽默感来自人物智慧与情境，不来自吐槽\n"
        + "【着重呈现(推演依据必须场景化)】\n"
        + "  · 玩家诏令：至少一条要在具体场景中被某个大臣收到/讨论/执行——让玩家看见令下之后谁去做、怎么做\n"
        + "  · 玩家行止：作为主角的日常生活片段自然出现\n"
        + "  · 本回合批复的奏疏：至少一份在场景中展开(谁呈上、何时、皇帝的反应)\n"
        + "  · 问对/朝议结果：作为对话场景再现(若本回合有)\n"
        + "  · NPC自主行动：至少出现2-3个NPC的日常片段或私下对话\n"
        + "  · 势力/阴谋伏笔：暗线自然融入\n"
        + "  · 本回合最戏剧性的一幕必须展开写足\n"
        + "【禁止】\n"
        + "  · 不用emoji\n"
        + "  · 不用日式轻小说元素(不出现'诶''嘛''啦'等语气词)\n"
        + "  · 不用全知叙述者评论('这一天注定不平凡'之类)\n"
        + "  · 不是时政记的复述——时政记是摘要报告，后人戏说是把同一事件还原为可感知的生活\n"
        + "  · 少用'陛下圣明''微臣该死'之类套话，让对话贴近真实人际交流\n"
        + "【字数】" + _hourenMin + "-" + _hourenMax + "字。字数应花在场景细节和人物互动上，不要注水。\n"
        + "【情绪基调】若主角勤政——写出'做好事真难'(阻力、孤独、疲惫)；若主角享乐——写出'享乐真好'(感官、轻快、奉承)，但不说教。\n"
        + "\n返回纯JSON：\n"
        + "{\"houren_xishuo\":\"...(场景叙事正文)\",\"new_activities\":[{\"name\":\"...\",\"duration\":3,\"desc\":\"...\",\"effect\":{}}]}";
      var msgs2=[{role:"system",content:sysP}].concat(GM.conv.slice(-(P.ai.mem||60)));
      msgs2.push({role:"user",content:tp2});
      var resp2=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},body:JSON.stringify({model:P.ai.model||"gpt-4o",messages:msgs2,temperature:P.ai.temp||0.8,max_tokens:_tok(16000)})});
      if(!resp2.ok) throw new Error('HTTP ' + resp2.status);
      var data2=await resp2.json();
      _checkTruncated(data2, '后人戏说');
      var c2="";if(data2.choices&&data2.choices[0]&&data2.choices[0].message)c2=data2.choices[0].message.content;
      p2=extractJSON(c2);
      GM._turnAiResults.subcall2_raw = c2;
      GM._turnAiResults.subcall2 = p2;

      if(p2){
        // 优先读取新字段houren_xishuo；兼容旧zhengwen字段
        hourenXishuo = p2.houren_xishuo || p2.zhengwen || c2 || "时光流逝";
        zhengwen = hourenXishuo; // 兼容现有调用
        if(p2.new_activities)p2.new_activities.forEach(function(a){if(a.name)GM.biannianItems.push({name:a.name,startTurn:GM.turn+1,duration:a.duration||3,desc:a.desc||"",effect:a.effect||{}});});
        // 清理过期的biannianItems
        if(GM.biannianItems&&GM.biannianItems.length>50)GM.biannianItems=GM.biannianItems.filter(function(b){return b.startTurn+b.duration>=GM.turn;});
      }

      // 建议不足时自动补全（借鉴 ChongzhenSim fallback choices）
      if (!p2 || !p2.suggestions || p2.suggestions.length < 2) {
        // 动态生成建议——忠臣的建议故意写得冗长、说教（让玩家感受忠言逆耳）
        var _dynSugg = [];
        _dynSugg.push('巩固民心，推行惠政（然此非一朝一夕之功，须持之以恒，不可半途而废）');
        _dynSugg.push('臣以为当整饬吏治、选贤任能，此乃治国之本。然贤愚难辨，望陛下明察秋毫');
        if (GM.eraState && GM.eraState.militaryProfessionalism < 0.4) _dynSugg.push('军备松弛久矣，臣以为宜操练兵马、加强边防。然此事费银甚巨、耗时良久，朝中恐有异议');
        if (_dynSugg.length < 3) _dynSugg.push('臣以为当修文德以来远人，虽见效缓慢，然为万世之基业');
        // 当荒淫值较高时，混入佞臣式的"好建议"
        if (GM._tyrantDecadence && GM._tyrantDecadence > 25) {
          var _badSugg = [
            '近来操劳过度，宜宴饮群臣，以慰圣心',
            '方士进献灵丹，服之可延年益寿，何不一试',
            '天子当享天下之福，何必自苦？宜大赦天下、普天同庆',
            '某处风景绝佳，可建行宫一座，以备避暑',
            '后宫虚设，宜选天下淑女以充掖庭',
            '边功卓著，何不御驾亲征、扬威四海？',
            '近臣某某忠心可嘉，宜委以重任（注：此人谄媚之辈）'
          ];
          _dynSugg.push(_badSugg[Math.floor(random() * _badSugg.length)]);
        }
        if (!p2) p2 = {};
        p2.suggestions = (p2.suggestions || []).concat(_dynSugg).slice(0, 4);
      }

      if(!zhengwen){
        zhengwen = c2 || "时光流逝";
        if (!hourenXishuo) hourenXishuo = zhengwen;
      }
      // 【防止对话历史被后人戏说撑爆】——将过长叙事截断为摘要入conv；完整版已在shijiHistory
      // 标准策略：>1500字时只保留开头600+结尾400作为上下文线索；其余用"……(中略)……"代替
      var _convContent = zhengwen || '';
      if (_convContent.length > 1500) {
        _convContent = _convContent.substring(0, 600) + '\n……（后人戏说正文过长，此处略去中段；完整版见史记）……\n' + _convContent.substring(_convContent.length - 400);
      }
      GM.conv.push({role:"assistant",content:_convContent});
      }); // end Sub-call 2 _runSubcall

      // --- Sub-call 2.5: 深度伏笔种植 + 回合记忆压缩 + NPC情绪快照 ---
      await _runSubcall('sc25', '伏笔记忆', 'lite', async function() {
      showLoading("\u57CB\u4E0B\u4F0F\u7B14",80);
      try {
        var _turnSummary = '\u672C\u56DE\u5408\u5B8C\u6574\u6458\u8981\uFF1A\n';
        _turnSummary += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji || '') + '\n';
        _turnSummary += '\u6B63\u6587\uFF1A' + (zhengwen || '').substring(0, 600) + '\n';
        if (playerStatus) _turnSummary += '\u653F\u5C40\uFF1A' + playerStatus + '\n';
        if (playerInner) _turnSummary += '\u5185\u7701\uFF1A' + playerInner + '\n';
        // 完整变动记录
        var _changeSummary = [];
        if (p1 && p1.npc_actions) p1.npc_actions.forEach(function(a) { _changeSummary.push(a.name + ':' + a.action + (a.result?'→'+a.result:'')); });
        if (p1 && p1.character_deaths) p1.character_deaths.forEach(function(d) { _changeSummary.push(d.name + '\u6B7B:' + d.reason); });
        if (p1 && p1.faction_events) p1.faction_events.forEach(function(fe) { _changeSummary.push((fe.actor||'') + (fe.action||'')); });
        if (p1 && p1.faction_changes) p1.faction_changes.forEach(function(fc) { _changeSummary.push(fc.name + '\u5B9E\u529B' + (fc.strength_delta>0?'+':'')+fc.strength_delta); });
        if (_changeSummary.length > 0) _turnSummary += '\u5168\u90E8\u53D8\u52A8\uFF1A' + _changeSummary.join('\uFF1B') + '\n';
        // 玩家本回合决策
        if (GM.playerDecisions && GM.playerDecisions.length > 0) {
          var _lastDecs = GM.playerDecisions.filter(function(d){return d.turn===GM.turn;});
          if (_lastDecs.length) _turnSummary += '\u73A9\u5BB6\u51B3\u7B56\uFF1A' + _lastDecs.map(function(d){return d.type+':'+d.content;}).join('\uFF1B') + '\n';
        }

        // 注入已有情节线索（让AI延续而非重造）
        if (GM._plotThreads && GM._plotThreads.length > 0) {
          var _activeThreads = GM._plotThreads.filter(function(t){ return t.status !== 'resolved'; });
          if (_activeThreads.length > 0) {
            _turnSummary += '\n【活跃情节线索——应在plot_updates中更新进展】\n';
            _activeThreads.forEach(function(t) { _turnSummary += '  · [' + t.id + '] ' + t.title + ' (' + t.type + ') 状态:' + t.status + '\n'; });
          }
        }
        var tp25 = _turnSummary + '\n\u8BF7\u8FD4\u56DEJSON\uFF1A\n';
        tp25 += '{"foreshadow":["\u4F0F\u7B141\u2014\u201440\u5B57\u2014\u2014\u5305\u542B\u4F55\u4EBA\u4F55\u4E8B\u4F55\u65F6\u5F15\u7206","\u4F0F\u7B142","\u4F0F\u7B143","\u4F0F\u7B144","\u4F0F\u7B145"],';
        tp25 += '"plot_updates":[{"threadId":"\u5DF2\u6709\u7EBFID\u6216null","title":"\u5267\u60C5\u7EBF\u540D","threadType":"political/military/personal/economic/succession/foreign","update":"\u672C\u56DE\u5408\u8FDB\u5C55(30\u5B57)","status":"brewing/active/climax/resolved","newThread":false}],';
        tp25 += '"decision_echoes":[{"content":"\u54EA\u6761\u8BCF\u4EE4/\u51B3\u7B56","echoType":"positive/negative/mixed","echoDesc":"\u5EF6\u65F6\u540E\u679C\u63CF\u8FF0(30\u5B57)","delayTurns":0}],';
        tp25 += '"faction_narrative":{"\u52BF\u529B\u540D":"\u8FD1\u671F\u53D1\u5C55\u4E00\u53E5\u8BDD\u603B\u7ED3(30\u5B57)"},';
        tp25 += '"memory":"\u672C\u56DE\u5408\u7684\u9AD8\u5BC6\u5EA6\u538B\u7F29\u8BB0\u5F55\u2014\u2014\u5305\u542B\u6240\u6709\u5173\u952E\u4EBA\u540D\u3001\u4E8B\u4EF6\u3001\u53D8\u5316\u3001\u73A9\u5BB6\u51B3\u7B56\u53CA\u5176\u540E\u679C(200\u5B57)","trend":"\u5F53\u524D\u5927\u52BF\u8D70\u5411\u548C\u52A0\u901F\u65B9\u5411(50\u5B57)","npc_mood_snapshot":"\u5404\u4E3B\u8981NPC\u672C\u56DE\u5408\u540E\u7684\u60C5\u7EEA\u72B6\u6001(100\u5B57)","contradiction_evolution":"\u5404\u77DB\u76FE\u672C\u56DE\u5408\u7684\u6F14\u5316\u65B9\u5411\u2014\u2014\u52A0\u5267/\u7F13\u548C/\u8F6C\u5316(80\u5B57)"}\n';
        tp25 += '\u4F0F\u7B14\u8981\u5177\u4F53\uFF1A\u5305\u542B\u201C\u8C01\u201D\u201C\u505A\u4EC0\u4E48\u201D\u201C\u5728\u54EA\u91CC\u201D\u201C\u51E0\u56DE\u5408\u540E\u5F15\u7206\u201D\u3002\u4E0D\u8981\u6A21\u7CCA\u3002\n';
        tp25 += 'memory\u5FC5\u987B\u5305\u542B\u6240\u6709\u5173\u952E\u53D8\u5316\uFF0C\u8FD9\u662F\u4E0B\u56DE\u5408AI\u7684\u552F\u4E00\u56DE\u5FC6\u6765\u6E90\u3002';

        var resp25 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp25}], temperature:0.7, max_tokens:_tok(12000)})});
        if (resp25.ok) {
          var data25 = await resp25.json();
          _checkTruncated(data25, '伏笔记忆');
          var c25 = '';
          if (data25.choices && data25.choices[0] && data25.choices[0].message) c25 = data25.choices[0].message.content;
          var p25 = extractJSON(c25);
          if (p25) {
            // 存储伏笔（供下回合AI使用）
            if (p25.foreshadow && Array.isArray(p25.foreshadow)) {
              if (!GM._foreshadows) GM._foreshadows = [];
              p25.foreshadow.forEach(function(f) {
                if (f) GM._foreshadows.push({ turn: GM.turn, text: f });
              });
              // 硬上限保护（正常由压缩系统管理，此为兜底；上限随模型动态调整）
              var _foreHardLim = getCompressionParams().foreHardLimit || 60;
              if (GM._foreshadows.length > _foreHardLim) GM._foreshadows = GM._foreshadows.slice(-Math.round(_foreHardLim * 0.8));
            }
            // 存储AI压缩记忆
            if (p25.memory) {
              if (!GM._aiMemory) GM._aiMemory = [];
              GM._aiMemory.push({ turn: GM.turn, text: p25.memory });
              // 硬上限保护（正常由压缩系统管理，此为兜底；上限随模型动态调整）
              var _memHardLim = getCompressionParams().memHardLimit || 100;
              if (GM._aiMemory.length > _memHardLim) GM._aiMemory = GM._aiMemory.slice(-Math.round(_memHardLim * 0.8));
            }
            // 存储趋势
            if (p25.trend) GM._currentTrend = p25.trend;

            // 2.1: 处理剧情线更新
            if (p25.plot_updates && Array.isArray(p25.plot_updates)) {
              if (!GM._plotThreads) GM._plotThreads = [];
              p25.plot_updates.forEach(function(pu) {
                if (!pu.title) return;
                if (pu.newThread || !pu.threadId) {
                  // 创建新线
                  var existing = GM._plotThreads.find(function(t) { return t.title === pu.title; });
                  if (!existing) {
                    GM._plotThreads.push({
                      id: uid(), title: pu.title, description: pu.update || '',
                      participants: [], startTurn: GM.turn, lastUpdateTurn: GM.turn,
                      status: pu.status || 'active', priority: 3,
                      threadType: pu.threadType || 'political',
                      updates: [{ turn: GM.turn, text: pu.update || '' }]
                    });
                  }
                } else {
                  // 更新已有线
                  var thread = GM._plotThreads.find(function(t) { return t.id === pu.threadId || t.title === pu.title; });
                  if (thread) {
                    thread.lastUpdateTurn = GM.turn;
                    if (pu.status) thread.status = pu.status;
                    if (pu.update) thread.updates.push({ turn: GM.turn, text: pu.update });
                    if (thread.updates.length > 20) thread.updates = thread.updates.slice(-20);
                  }
                }
              });
              // 清理已完结超过5回合的线
              GM._plotThreads = GM._plotThreads.filter(function(t) {
                return t.status !== 'resolved' || GM.turn - t.lastUpdateTurn < 5;
              });
              // 上限15条
              if (GM._plotThreads.length > 15) GM._plotThreads = GM._plotThreads.slice(-15);
            }

            // N1: 处理决策延时后果生成
            if (p25.decision_echoes && Array.isArray(p25.decision_echoes)) {
              if (!GM._decisionEchoes) GM._decisionEchoes = [];
              p25.decision_echoes.forEach(function(de) {
                if (!de.content || !de.echoDesc) return;
                var delay = parseInt(de.delayTurns) || ((typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12);
                GM._decisionEchoes.push({
                  id: uid(), content: de.content, turn: GM.turn,
                  echoTurn: GM.turn + delay, echoType: de.echoType || 'mixed',
                  echoDesc: de.echoDesc, applied: false
                });
              });
              // 清理已应用的和过期的
              GM._decisionEchoes = GM._decisionEchoes.filter(function(e) { return !e.applied || GM.turn - e.echoTurn < 3; });
              if (GM._decisionEchoes.length > 20) GM._decisionEchoes = GM._decisionEchoes.slice(-20);
            }

            // 标记到期的决策回声为已应用
            if (GM._decisionEchoes) {
              GM._decisionEchoes.forEach(function(e) {
                if (!e.applied && e.echoTurn <= GM.turn) e.applied = true;
              });
            }

            // 3.3: 势力发展叙事存储
            if (p25.faction_narrative && typeof p25.faction_narrative === 'object') {
              GM._factionNarrative = p25.faction_narrative;
            }

            GM._turnAiResults.subcall25 = p25;
            _dbg('[Foreshadow]', (p25.foreshadow || []).length, 'hooks. Threads:', (GM._plotThreads||[]).length, 'Echoes:', (GM._decisionEchoes||[]).length);
          }
        }
      } catch(e25) { _dbg('[Foreshadow] \u5931\u8D25:', e25); throw e25; }
      }); // end Sub-call 2.5 _runSubcall

      // --- Sub-call 2.7: 叙事质量审查与增强 --- [standard+full]
      await _runSubcall('sc27', '叙事审查', 'standard', async function() {
      showLoading("\u53D9\u4E8B\u8D28\u91CF\u5BA1\u67E5",85);
      try {
        var tp27 = '\u8BF7\u5BA1\u67E5\u4EE5\u4E0B\u53D9\u4E8B\u6B63\u6587\u7684\u8D28\u91CF\uFF1A\n' + (zhengwen||'') + '\n\n';
        // 注入史料知识供审查参考
        if (GM._aiScenarioDigest) {
          if (GM._aiScenarioDigest.periodVocabulary) tp27 += '\u65F6\u4EE3\u7528\u8BED\uFF1A' + GM._aiScenarioDigest.periodVocabulary.substring(0,200) + '\n';
          if (GM._aiScenarioDigest.etiquetteNorms) tp27 += '\u793C\u4EEA\u89C4\u8303\uFF1A' + GM._aiScenarioDigest.etiquetteNorms.substring(0,200) + '\n';
          if (GM._aiScenarioDigest.sensoryDetails) tp27 += '\u611F\u5B98\u7EC6\u8282\uFF1A' + GM._aiScenarioDigest.sensoryDetails.substring(0,200) + '\n';
        }
        // 注入角色名单供一致性检查
        var _charNames27 = (GM.chars||[]).filter(function(c){return c.alive!==false;}).map(function(c){return c.name;});
        if (_charNames27.length > 0) tp27 += '\u3010\u5728\u4E16\u89D2\u8272\u540D\u5355\uFF08\u6B63\u6587\u4E2D\u63D0\u5230\u7684\u4EBA\u540D\u5FC5\u987B\u5728\u6B64\u5217\u8868\u4E2D\uFF09\u3011' + _charNames27.join('\u3001') + '\n';
        tp27 += '\u8BF7\u8FD4\u56DEJSON\uFF1A{"anachronisms":"\u53D1\u73B0\u7684\u65F6\u4EE3\u9519\u8BEF\u2014\u2014\u7528\u8BCD\u3001\u79F0\u8C13\u3001\u5236\u5EA6\u4E0D\u7B26\u5408\u65F6\u4EE3(100\u5B57)","name_errors":"\u6B63\u6587\u4E2D\u51FA\u73B0\u4F46\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D\u7684\u4EBA\u540D(\u5982\u6709)","enhancement":"\u53EF\u4EE5\u589E\u5F3A\u7684\u90E8\u5206\u2014\u2014\u54EA\u91CC\u53EF\u4EE5\u52A0\u5165\u66F4\u591A\u611F\u5B98\u7EC6\u8282\u3001\u5178\u6545\u5F15\u7528\u3001\u60C5\u611F\u6E32\u67D3(150\u5B57)","rewritten_passages":"\u91CD\u5199\u7684\u6BB5\u843D\u2014\u2014\u5C06\u6700\u5F31\u76842-3\u6BB5\u91CD\u5199\u5F97\u66F4\u597D(300\u5B57)","added_details":"\u5E94\u8865\u5145\u7684\u7EC6\u8282\u2014\u2014\u73AF\u5883\u63CF\u5199\u3001\u4EBA\u7269\u795E\u6001\u3001\u6C14\u6C1B\u70D8\u6258(200\u5B57)"}';
        var resp27 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp27}], temperature:0.6, max_tokens:_tok(12000)})});
        if (resp27.ok) {
          var j27 = await resp27.json(); _checkTruncated(j27, '人名校验'); var c27 = j27.choices&&j27.choices[0]?j27.choices[0].message.content:'';
          var p27 = extractJSON(c27);
          if (p27) {
            // 将增强内容附加到正文
            if (p27.rewritten_passages) zhengwen = zhengwen + '\n\n' + p27.rewritten_passages;
            if (p27.added_details) zhengwen = zhengwen + '\n' + p27.added_details;
            GM._turnAiResults.subcall27 = p27;
            _dbg('[Narrative Review] anachronisms:', (p27.anachronisms||'').substring(0,50));
          }
        }
      } catch(e27) { _dbg('[Narrative Review] fail:', e27); throw e27; }
      }); // end Sub-call 2.7 _runSubcall

      // --- Sub-call 0.7: NPC 认知整合 ---
      //   · 位置：所有推演完成之后，世界快照之前
      //   · 职责：为每个关键 NPC 生成"当下此刻的信息掌握画像"
      //   · 持久化：GM._npcCognition（与 GM 同命周期·随存档）
      //   · 消费者：问对/朝议/科议/奏疏回复等回合内 AI 调用（通过 getNpcCognitionSnippet）
      await _runSubcall('sc07', 'NPC认知整合', 'lite', async function() {
      showLoading("NPC \u8BA4\u77E5\u6574\u5408", 89);
      try {
        var _liveCharsCog = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;});
        _liveCharsCog.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
        var _cogTargets = _liveCharsCog.slice(0, 22);
        if (_cogTargets.length === 0) return;

        var _cogCtx = '';
        _cogCtx += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '\n';
        if (shizhengji) _cogCtx += '\n\u3010\u672C\u56DE\u5408\u65F6\u653F\u8BB0\u3011\n' + String(shizhengji).slice(0,1500) + '\n';
        // 风闻摘要
        if (Array.isArray(GM._fengwenRecord) && GM._fengwenRecord.length > 0) {
          var _fwRecent = GM._fengwenRecord.slice(-20).reverse().map(function(fw){return '['+fw.type+'] '+(fw.text||'').slice(0,50);}).join('\n');
          _cogCtx += '\n\u3010\u8FD1\u671F\u98CE\u95FB\u3011\n' + _fwRecent + '\n';
        }
        // 本回合主要事件
        if (p1 && Array.isArray(p1.events) && p1.events.length > 0) {
          _cogCtx += '\n\u3010\u672C\u56DE\u5408\u4E8B\u4EF6\u3011\n' + p1.events.slice(0,10).map(function(e){return '\u00B7 ['+(e.category||'')+'] '+(e.text||'').slice(0,60);}).join('\n') + '\n';
        }
        // NPC 交互
        if (p1 && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          _cogCtx += '\n\u3010\u672C\u56DE\u5408 NPC \u4E92\u52A8\u3011\n' + p1.npc_interactions.slice(0,12).map(function(it){return '\u00B7 '+it.actor+'\u2192'+it.target+' '+it.type+(it.publicKnown?'\u3010\u516C\u3011':'\u3010\u79C1\u3011');}).join('\n') + '\n';
        }
        // 势力暗流
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _cogCtx += '\n\u3010\u52BF\u529B\u6697\u6D41\u3011\n' + GM._factionUndercurrents.slice(0,6).map(function(u){return '\u00B7 '+(u.faction||'')+'\uFF1A'+(u.situation||'').slice(0,50);}).join('\n') + '\n';
        }
        // 进行中阴谋
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _cogCtx += '\n\u3010\u9634\u8C0B\u3011\n' + GM.activeSchemes.slice(-8).map(function(s){return '\u00B7 '+(s.schemer||'')+'\u8C0B'+(s.target||'')+' ['+(s.progress||'')+']';}).join('\n') + '\n';
        }

        var _cogNpcList = _cogTargets.map(function(c){
          var _p = c.name;
          if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
          if (c.location) _p += '@' + c.location;
          if (c.faction) _p += '[' + c.faction + ']';
          if (c.party) _p += '{' + c.party + '}';
          _p += ' \u5FE0' + (c.loyalty||50) + '/\u667A' + (c.intelligence||50) + '/\u5FD7' + (c.ambition||50) + '/\u5EC9' + (c.integrity||50);
          return _p;
        }).join('\n');

        var _cogPlayerName = (P.playerInfo && P.playerInfo.characterName) || '';
        var _cogCap = GM._capital || '\u4EAC\u57CE';

        var tp07 = '\u3010NPC \u8BA4\u77E5\u6574\u5408\u00B7\u4E13\u9879\u3011\n';
        tp07 += '\u76EE\u7684\uFF1A\u4E3A\u6BCF\u4F4D\u5173\u952E NPC \u751F\u6210"\u5F53\u4E0B\u6B64\u523B\u7684\u4FE1\u606F\u638C\u63E1\u753B\u50CF"\uFF0C\u4EE5\u4F9B\u56DE\u5408\u5185\u95EE\u5BF9/\u671D\u8BAE/\u79D1\u8BAE/\u594F\u758F\u56DE\u590D\u6309\u56FE\u7D22\u9AA5\u3002\n';
        tp07 += '\u539F\u5219\uFF1A\u4FE1\u606F\u4E0D\u5BF9\u79F0\u2014\u2014\u4EAC\u5B98\u77E5\u7684\u591A\u5F80\u6765\u7684\u9065\uFF0C\u5916\u5B98\u77E5\u672C\u9547\u7684\u591A\u4EAC\u4E2D\u7684\u5C11\uFF1B\u4E0E\u8C01\u4EB2\u8FD1\u5C31\u542C\u7684\u591A\uFF1B\u51FA\u8EAB/\u6D3E\u7CFB\u51B3\u5B9A\u4EC0\u4E48\u4F1A\u8FDB\u5165\u5176\u8033\u3002\n\n';
        tp07 += _cogCtx + '\n\u3010\u76EE\u6807 NPC\uFF08\u4EC5\u4E0B\u5217\u4EBA\u3001\u5E0C\u671B\u5168\u76D6\uFF09\u3011\n' + _cogNpcList + '\n';
        if (_cogPlayerName) tp07 += '\n\u73A9\u5BB6\u89D2\u8272\uFF1A' + _cogPlayerName + '\uFF08\u4E0D\u5728\u6B64\u63A8\u6F14\u8303\u56F4\u5185\uFF09\n';

        // 注入各 NPC 深化字段（供 AI 为稳定画像参考）+ 已有稳定画像（避免重复生成）
        var _npcFullCtx = '';
        try {
          _cogTargets.forEach(function(c){
            var _lines = [c.name + ':'];
            if (c.family) _lines.push('  \u5BB6\u65CF\uFF1A' + c.family);
            if (c.aspiration || c.goal || c.lifeGoal) _lines.push('  \u5FD7\u5411\uFF1A' + (c.aspiration||c.goal||c.lifeGoal));
            if (c.personality) _lines.push('  \u6027\u683C\uFF1A' + String(c.personality).slice(0,60));
            if (c.birthplace) _lines.push('  \u7C4D\u8D2F\uFF1A' + c.birthplace);
            if (c.ethnicity) _lines.push('  \u6C11\u65CF\uFF1A' + c.ethnicity);
            if (c.faith) _lines.push('  \u4FE1\u4EF0\uFF1A' + c.faith);
            if (c.learning) _lines.push('  \u5B66\u8BC6\uFF1A' + c.learning);
            if (c.speechStyle) _lines.push('  \u53E3\u540B\uFF1A' + c.speechStyle);
            // 五常十维
            var _fv = [];
            if (c.ren != null) _fv.push('\u4EC1' + c.ren);
            if (c.yi != null) _fv.push('\u4E49' + c.yi);
            if (c.li != null) _fv.push('\u793C' + c.li);
            if (c.zhi != null) _fv.push('\u667A' + c.zhi);
            if (c.xin != null) _fv.push('\u4FE1' + c.xin);
            if (_fv.length) _lines.push('  \u4E94\u5E38\uFF1A' + _fv.join('/'));
            // 能力
            var _ab = [];
            if (c.intelligence != null) _ab.push('\u667A' + c.intelligence);
            if (c.valor != null) _ab.push('\u52C7' + c.valor);
            if (c.military != null) _ab.push('\u519B' + c.military);
            if (c.administration != null) _ab.push('\u653F' + c.administration);
            if (c.charisma != null) _ab.push('\u9B45' + c.charisma);
            if (c.diplomacy != null) _ab.push('\u4EA4' + c.diplomacy);
            if (c.benevolence != null) _ab.push('\u4EC1' + c.benevolence);
            if (_ab.length) _lines.push('  \u80FD\u529B\uFF1A' + _ab.join('/'));
            if (Array.isArray(c.traits) && c.traits.length) _lines.push('  \u7279\u8D28\uFF1A' + c.traits.slice(0,4).join('/'));
            if (c.isHistorical || c.isHistoric) _lines.push('  \u26A0 \u53F2\u5B9E\u4EBA\u7269\u2014\u2014\u6240\u6709\u5185\u5BB9\u5FC5\u987B\u7B26\u5408\u6B63\u53F2\u8BB0\u8F7D\u3002');
            // 已有稳定画像
            if (GM._npcCognition && GM._npcCognition[c.name] && GM._npcCognition[c.name]._identityInitialized) {
              var _ex = GM._npcCognition[c.name];
              _lines.push('  \u26BF \u5DF2\u751F\u6210\u7A33\u5B9A\u753B\u50CF\uFF08\u4FDD\u7559\u4E0D\u53D8\uFF09\uFF1A');
              if (_ex.selfIdentity) _lines.push('    \u81EA\u8BC6\uFF1A' + _ex.selfIdentity);
              if (_ex.personalityCore) _lines.push('    \u4EBA\u683C\u6838\u5FC3\uFF1A' + _ex.personalityCore);
              if (_ex.speechThread) _lines.push('    \u53E3\u543B\u4E3B\u7EBF\uFF1A' + _ex.speechThread);
            }
            _npcFullCtx += _lines.join('\n') + '\n';
          });
        } catch(_e){}
        if (_npcFullCtx) tp07 += '\n\u3010NPC \u6DF1\u5316\u5C5E\u6027\uFF08\u751F\u6210\u7A33\u5B9A\u753B\u50CF\u7684\u4F9D\u636E\uFF09\u3011\n' + _npcFullCtx;

        tp07 += '\n\u3010\u8FD4\u56DE JSON\u3011{\n';
        tp07 += '  "npc_cognition":[{\n';
        tp07 += '    "name":"\u89D2\u8272\u540D",\n';
        tp07 += '    /* \u2500\u2500 \u7A33\u5B9A\u81EA\u6211\u753B\u50CF\uFF08\u9996\u6B21\u751F\u6210\u540E\u6C38\u4E0D\u6539\u53D8\u00B7\u6570\u91CF\u5E0C\u671B\u5168\u8986\u76D6\uFF09\u2500\u2500 */\n';
        tp07 += '    "selfIdentity":"\u4ED6\u6709\u4ED6\u5BF9\u81EA\u5DF1\u8EAB\u4EFD/\u5BB6\u65CF/\u5FD7\u5411\u7684\u4E00\u53E5\u8BDD\u81EA\u6211\u8BA4\u77E5\uFF0825-50\u5B57\uFF0C\u5982\u201C\u8428\u6EE1\u6B63\u9EC4\u65D7\u7684\u9A97\u9A91\u4F5B\u957F\u5B50\u00B7\u4E3A\u67D0\u67D0\u6218\u5DF1\u7B79\u7684\u661F\u5C90\u9A86\u00B7\u6B64\u751F\u4F7F\u547D\u662F\u51FA\u5973\u534F\u671D\u5EF7\u201D\u6216\u201C\u51FA\u8EAB\u5BD2\u95E8\u7684\u4EEE\u58EB\u00B7\u6731\u5B50\u6B63\u5B66\u4E4B\u540E\u5B66\u00B7\u6240\u8FFD\u6C42\u2018\u6210\u4EC1\u53D6\u4E49\u800C\u6B7B\u2019\u2019\uFF09",\n';
        tp07 += '    "personalityCore":"\u6838\u5FC3\u6027\u683C\uFF081\u53E5 20-40\u5B57\uFF0C\u5982\u201C\u7CBE\u660E\u80FD\u5E72\u4F46\u6027\u5B50\u7579\u5F29\u00B7\u65E2\u6052\u5F97\u91CD\u4EE3\u65A5\u8D23\u4E5F\u5F88\u5C0F\u82B9\u91CD\u201D\uFF09",\n';
        tp07 += '    "abilityAwareness":"\u4ED6\u5BF9\u81EA\u5DF1\u80FD\u529B\u957F\u77ED\u7684\u8BA4\u77E5\uFF08\u5982\u201C\u81EA\u8D1F\u7B79\u7565\u4F46\u77E5\u8287\u5565\u5CD1\uFF0C\u4E0D\u5584\u7528\u5175\u201D\u3001\u201C\u81EA\u8BA4\u6587\u7457\u4E0D\u5982\u67D0\u67D0\u4F46\u6211\u547D\u8FD0\u6B8B\u5FCD\u201D\uFF09",\n';
        tp07 += '    "fiveVirtues":"\u4E94\u5E38\u4F53\u73B0/\u7F3A\u5931\uFF08\u5982\u201C\u4EC1\u6C10\u4E49\u91CD\u4F46\u4FE1\u7F3A\uFF0C\u66FE\u5C0F\u7F6A\u4E0D\u517B\u3001\u4F60\u6478\u7F32\u4FA7\u5224\u65F6\u6613\u8981\u5220\u6885\u201D\uFF09",\n';
        tp07 += '    "historicalVoice":"\uFF08\u4EC5\u53F2\u5B9E\u4EBA\u7269\uFF0C\u975E\u5219\u7559\u7A7A\u4E32\uFF09\u5176\u53F2\u6599\u4E2D\u7684\u6807\u5FD7\u6027\u8BED\u8A00/\u8BCD\u6C47/\u5178\u6545/\u7F69\u95E8\u7981\u5FCC\u00B7\u53F8\u7B0A\u6211\u4E3E\u7ACB\u573A\uFF0820-50 \u5B57\uFF09",\n';
        tp07 += '    "speechThread":"\u4ED6\u5728\u6240\u6709\u573A\u5408\u90FD\u4E00\u8D2F\u7684\u8BF4\u8BDD\u53E3\u543B\u00B7\u98CE\u683C\u00B7\u5E38\u5F15\u7684\u5178\u6545\u00B7\u53E3\u5934\u7985\u00B7\u8B6C\u6D88\u53E3\u4E60\uFF0850 \u5B57\uFF0C\u4F53\u73B0\u6BCF\u6B21\u53D1\u8A00\u90FD\u50CF\u4ED6\u3001\u4E0D\u662F\u5176\u4ED6\u4EBA\uFF09",\n';
        tp07 += '    "partyClassFeeling":"\u4ED6\u5BF9\u81EA\u8EAB\u6240\u5C5E\u515A\u6D3E/\u52BF\u529B/\u9636\u5C42/\u5BB6\u65CF/\u540C\u4E61\u7684\u6DF1\u90E8\u611F\u53D7\u2014\u2014\u7684\u5F52\u5C5E\u611F/\u5F92\u6539\u611F/\u80CC\u53DB\u611F/\u65E0\u5947/\u5DE5\u5177\u4E3B\u4E49/\u53CD\u6F74\u8005\u7B49\uFF08\u4E00\u53E5 40-70\u5B57\uFF0C\u5982\u201C\u4E1C\u6797\u8A00\u6982\u4EE5\u4E3A\u7136\u00B7\u671D\u4EE3\u5FE0\u5FE0\u6D01\u4E4B\u58EB\u00B7\u5176\u5F0F\u6162\u8ECD\u8F7B\u5FB7\u4E00\u7B79\u6C31\u76F8\u4E2D\u7F72\u8054\u201D \u6216 \u201C\u5916\u628A\u5FB7\u635A\u5916\u6295\u6218\u7269\u00B7\u5E38\u4EA8\u8881\u5E45\u5546\u53F8\u5C06\u53E4\u529F\u540D\u4E3A\u4F26\u5C4F\u5916\u5988\u201D\uFF09",\n';
        tp07 += '    /* \u2500\u2500 \u672C\u56DE\u5408\u52A8\u6001\u4FE1\u606F\u00B7\u6BCF\u56DE\u5408\u5237\u65B0 \u2500\u2500 */\n';
        tp07 += '    "knows":["3-5 \u6761\u4ED6\u672C\u56DE\u5408\u901A\u8FC7\u90B8\u62A5/\u8033\u76EE/\u540C\u50DA\u8DDF\u4EAB/\u8033\u62A5/\u79C1\u4FE1\u4E86\u89E3\u5230\u7684\u5177\u4F53\u4FE1\u606F\uFF0C\u6BCF\u6761 20-40 \u5B57"],\n';
        tp07 += '    "doesntKnow":["1-3 \u6761\u88AB\u8499\u5728\u9F13\u91CC\u7684\u4E8B\u60C5"],\n';
        tp07 += '    "currentFocus":"\u4ED6\u6B64\u65F6\u5FC3\u601D\u6240\u7CFB\u7684\u4E3B\u8981\u4E8B\u52A1\uFF081\u53E5\uFF09",\n';
        tp07 += '    "worldviewShift":"\u672C\u56DE\u5408\u7701\u610F\u53D8\u5316\uFF081\u53E5\uFF09",\n';
        tp07 += '    "attitudeTowardsPlayer":"\u5BF9\u73A9\u5BB6\u6700\u65B0\u6001\u5EA6\uFF081\u53E5\uFF09",\n';
        tp07 += '    "unspokenConcern":"\u85CF\u5728\u5FC3\u5E95\u6CA1\u8BF4\u7684\u62C5\u5FE7\uFF081\u53E5\uFF09",\n';
        tp07 += '    "infoAsymmetry":"\u4ED6\u4E0E\u540C\u50DA\u4FE1\u606F\u4E0D\u5BF9\u79F0\u4E4B\u5904\uFF081\u53E5\uFF09",\n';
        tp07 += '    "recentMood":"\u8FD1\u671F\u5FC3\u7EEA\u6CE2\u52A8\uFF081\u53E5\uFF0C\u5982\u201C\u6027\u6FC0\u6124\u60E0\u6B4C\u805A\u5973\u201D\u3001\u201D\u541C\u4EB2\u75C5\u9ED8\u4F9D\u7D95\u4FDD\u5377\u4F24\u5BEB\u201D\uFF09"\n';
        tp07 += '  }]\n}\n';

        tp07 += '\n\u3010\u786C\u89C4\u5219\u3011\n';
        tp07 += '\u00B7 \u4E3A\u4E0A\u8FF0\u6240\u6709\u76EE\u6807 NPC \u5168\u90E8\u8F93\u51FA\uFF0C\u4E00\u4E2A\u4E0D\u843D\u4E0B\n';
        tp07 += '\u00B7 \u3010\u7A33\u5B9A\u753B\u50CF\u4E94\u5B57\u6BB5\u3011\uFF08selfIdentity/personalityCore/abilityAwareness/fiveVirtues/speechThread\uFF09\u00B7\u82E5\u4E0A\u65B9\u5DF2\u6807\u26BF \u5DF2\u751F\u6210\u00B7\u4E0D\u8981\u91CD\u65B0\u751F\u6210\uFF0C\u7ECD\u8FFD\u7B80\u5185\u5BB9\u3002\u672A\u751F\u6210\u7684\u2014\u2014\u8981\u4F9D\u636E\u4E0A\u65B9\u8BE6\u8FF0\u4EE5\u6DF1\u5316\u5B57\u6BB5\u8BA1\u5207\u4EBA\u8BA1\u751F\u6210\u3002\n';
        tp07 += '\u00B7 \u3010\u52A8\u6001\u4FE1\u606F\u8FC7\u3011\uFF08knows/doesntKnow/currentFocus/worldviewShift/attitudeTowardsPlayer/unspokenConcern/infoAsymmetry/recentMood\uFF09\u00B7\u6BCF\u56DE\u5408\u91CD\u65B0\u5224\u5B9A\u3002\n';
        tp07 += '\u00B7 \u4FE1\u606F\u5185\u5BB9\u5FC5\u987B\u7B26\u5408\u8BE5 NPC \u7684\u804C\u4F4D/\u6D3E\u7CFB/\u5173\u7CFB\u7F51/\u5730\u70B9\u2014\u2014\u4F60\u51ED\u4EC0\u4E48\u77E5\u9053\u8FD9\u4EF6\uFF1F\n';
        tp07 += '\u00B7 \u5178\u578B\u4EAC\u5B98\u77E5\u672C\u56DE\u5408\u7684\u671D\u8BAE/\u4EBA\u4E8B/\u594F\u758F\uFF0C\u5916\u5B98\u77E5\u672C\u5730\u4E8B\u52A1+\u90B8\u62A5\u6BB5\u843D\uFF1B\u6EE1\u65CF\u4EAC\u5B98\u4E0E\u6C49\u65CF\u4EAC\u5B98\u77E5\u7684\u4E0D\u540C\u3002\n';
        tp07 += '\u00B7 \u4E0D\u8981\u8BA9\u6240\u6709 NPC \u90FD"\u77E5\u9053\u5168\u90E8"\u2014\u2014\u6709\u4EBA\u6D88\u606F\u7075\u901A\uFF0C\u6709\u4EBA\u6D88\u606F\u9ED8\u585E\n';
        tp07 += '\u00B7 \u3010\u26A0 \u53F2\u5B9E NPC\u3011\u9009\u62E9\u4E94\u5B57\u6BB5\u65F6\u5FC5\u987B\u7B26\u5408\u6B63\u53F2\u8BB0\u8F7D\u2014\u2014\u5982\u4E2D\u6749\u4F5C\u4E94\u5E38\u6309\u300A\u660E\u53F2\u300B\u5217\u4F20\u7565\u4E66\uFF0C\u4F7F\u4E1C\u6797\u515A\u6309\u300A\u660E\u53F2\u7EAA\u4E8B\u672C\u672B\u300B\uFF0C\u4E0D\u51ED\u7A7A\u6DF7\u6DC6\u3002\n';
        tp07 += '\u00B7 speechThread \u975E\u5E38\u5173\u952E\u2014\u2014\u5F62\u6BCF\u4EBA\u6BCF\u6B21\u53D1\u8A00\u90FD\u662F\u4ED6\u81EA\u5DF1\u7684\u58F0\u97F3\u3002\u5982\uFF1A\u660E\u4EE3\u76F4\u81E3\u5E38\u7528\u201C\u81E3\u5E79\u81E3\u2026\u2026\u201D\u5F00\u5934\u00B7\u8D3F\u8D3F\u82AE\u82AE\u96B6\u5F89\u00B7\u5F52\u6709\u5149\u00B7\u9A86\u4E0D\u9A86\u670D\uFF1B\u4E8B\u517B\u73A9\u97F3\u5E38\u5F15\u53E3\u5934\u7985\uFF1B\u4E1C\u6797\u5F31\u76F8\u516C\u5F00\u5B66\u6765\u5927\u3002\n';
        tp07 += '\u00B7 attitudeTowardsPlayer \u5FC5\u987B\u53CD\u6620\u672C\u56DE\u5408\u771F\u5B9E\u7684\u53D8\u5316\uFF08\u5982\u88AB\u8D2C\u2192\u51C4\u6167\uFF0C\u88AB\u52A0\u6069\u2192\u611F\u6FC0\uFF0C\u88AB\u8FC1\u2192\u6124\u6012\uFF09\n';
        tp07 += '\u00B7 unspokenConcern \u8981\u771F\u7684\u85CF\u7740\u2014\u2014\u5982\u201C\u6016\u67D0\u67D0\u7690\u5BB3\u81EA\u5DF1\u4FDD\u5929\u5B50\u201D/\u201C\u5BB6\u4E2D\u7236\u8001\u75C5\u91CD\u5374\u65E0\u6CD5\u56DE\u9645\u201D\n';
        tp07 += '\u00B7 \u5C3D\u91CF\u6840\u5356\u201C\u6211\u77E5\u9053\u67D0\u4EBA\u5728\u7B79\u5212\u67D0\u4E8B\u300C\u4F46\u540C\u50DA\u4E0D\u77E5\u300D\u201D\u7684\u8F7D\u5FC3\u4E0D\u5BF9\u79F0\n';

        var _sc07Body = {model:P.ai.model||'gpt-4o', messages:[{role:'system',content:sysP},{role:'user',content:tp07}], temperature:_modelTemp, max_tokens:_tok(12000)};
        if (_modelFamily === 'openai') _sc07Body.response_format = { type:'json_object' };

        var resp07 = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.ai.key}, body:JSON.stringify(_sc07Body)});
        if (resp07.ok) {
          var data07 = await resp07.json();
          _checkTruncated(data07, 'NPC \u8BA4\u77E5');
          if (data07.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data07.usage);
          var c07 = (data07.choices && data07.choices[0] && data07.choices[0].message) ? data07.choices[0].message.content : '';
          var p07 = extractJSON(c07);
          GM._turnAiResults.subcall07_raw = c07;
          GM._turnAiResults.subcall07 = p07;

          if (p07 && Array.isArray(p07.npc_cognition)) {
            if (!GM._npcCognition) GM._npcCognition = {};
            var _cogCount = 0, _identInit = 0;
            p07.npc_cognition.forEach(function(ent){
              if (!ent || !ent.name) return;
              var _ex = GM._npcCognition[ent.name] || {};
              var _rec = {
                // ── 稳定画像：首次生成后不再覆盖（除非空） ──
                selfIdentity: _ex.selfIdentity || String(ent.selfIdentity||'').slice(0,120),
                personalityCore: _ex.personalityCore || String(ent.personalityCore||'').slice(0,80),
                abilityAwareness: _ex.abilityAwareness || String(ent.abilityAwareness||'').slice(0,80),
                fiveVirtues: _ex.fiveVirtues || String(ent.fiveVirtues||'').slice(0,100),
                historicalVoice: _ex.historicalVoice || String(ent.historicalVoice||'').slice(0,100),
                speechThread: _ex.speechThread || String(ent.speechThread||'').slice(0,120),
                partyClassFeeling: _ex.partyClassFeeling || String(ent.partyClassFeeling||'').slice(0,120),
                // ── 动态信息：每回合覆盖 ──
                knows: Array.isArray(ent.knows) ? ent.knows.slice(0,6) : (_ex.knows||[]),
                doesntKnow: Array.isArray(ent.doesntKnow) ? ent.doesntKnow.slice(0,4) : (_ex.doesntKnow||[]),
                currentFocus: String(ent.currentFocus||'').slice(0,80),
                worldviewShift: String(ent.worldviewShift||'').slice(0,80),
                attitudeTowardsPlayer: String(ent.attitudeTowardsPlayer||'').slice(0,60),
                unspokenConcern: String(ent.unspokenConcern||'').slice(0,80),
                infoAsymmetry: String(ent.infoAsymmetry||'').slice(0,80),
                recentMood: String(ent.recentMood||'').slice(0,80),
                _turn: GM.turn
              };
              if (!_ex._identityInitialized && (_rec.selfIdentity || _rec.personalityCore || _rec.speechThread)) {
                _rec._identityInitialized = true;
                _identInit++;
              } else {
                _rec._identityInitialized = _ex._identityInitialized || false;
              }
              GM._npcCognition[ent.name] = _rec;
              _cogCount++;
            });
            _dbg('[sc07] NPC \u8BA4\u77E5\u753B\u50CF\uFF1A' + _cogCount + ' \u4EBA\u66F4\u65B0\uFF0C' + _identInit + ' \u4EBA\u7A33\u5B9A\u753B\u50CF\u9996\u6B21\u751F\u6210');
          }
        } else {
          console.warn('[sc07] HTTP', resp07.status);
        }
      } catch(e07) { _dbg('[NPC Cognition] fail:', e07); }
      }); // end Sub-call 0.7 _runSubcall

      // --- Sub-call 2.8: 世界状态深度快照 --- [full only]
      await _runSubcall('sc28', '世界快照', 'full', async function() {
      showLoading("\u4E16\u754C\u72B6\u6001\u5FEB\u7167",88);
      try {
        var tp28 = '\u672C\u56DE\u5408\u7ED3\u675F\u540E\u7684\u4E16\u754C\u5B8C\u6574\u72B6\u6001\uFF1A\n';
        tp28 += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji||'') + '\n';
        tp28 += '\u6B63\u6587\u6458\u8981\uFF1A' + (zhengwen||'').substring(0,400) + '\n';
        tp28 += '\u73A9\u5BB6\u72B6\u6001\uFF1A' + (playerStatus||'') + '\n';
        tp28 += '\u8D44\u6E90\uFF1A' + Object.entries(GM.vars||{}).map(function(e){return e[0]+'='+Math.round(e[1].value);}).join(' ') + '\n';
        // 角色状态变化
        var _changedChars = (GM.chars||[]).filter(function(c){return c.alive!==false&&(c._changed||c.loyalty<30||c.ambition>70||c.stress>40);});
        if (_changedChars.length) tp28 += '\u5173\u952E\u89D2\u8272\uFF1A' + _changedChars.map(function(c){return c.name+'\u5FE0'+c.loyalty+'\u91CE'+c.ambition+(c.stress>30?'\u538B'+c.stress:'');}).join(' ') + '\n';
        tp28 += '\n\u8BF7\u751F\u6210\u4E00\u4EFD\u6781\u9AD8\u5BC6\u5EA6\u7684\u4E16\u754C\u72B6\u6001\u5FEB\u7167\uFF0C\u4F9B\u4E0B\u56DE\u5408AI\u4F5C\u4E3A\u8BB0\u5FC6\u8D77\u70B9\u3002\u8FD4\u56DEJSON\uFF1A\n';
        tp28 += '{"world_snapshot":"\u5F53\u524D\u4E16\u754C\u7684\u5B8C\u6574\u72B6\u6001\u538B\u7F29\u2014\u2014\u5305\u542B\u6240\u6709\u5173\u952E\u53D8\u5316\u3001\u4EBA\u7269\u72B6\u6001\u3001\u52BF\u529B\u683C\u5C40\u3001\u7ECF\u6D4E\u519B\u4E8B\u3001\u793E\u4F1A\u77DB\u76FE(400\u5B57)","next_turn_seeds":"\u4E0B\u56DE\u5408\u5E94\u53D1\u5C55\u7684\u79CD\u5B50\u2014\u2014\u54EA\u4E9B\u4E8B\u60C5\u6B63\u5728\u915D\u917F\u3001\u54EA\u4E9B\u4EBA\u5373\u5C06\u884C\u52A8(200\u5B57)","tension_level":"\u5F53\u524D\u7D27\u5F20\u5EA6\u7B49\u7EA7(1-10)\u53CA\u539F\u56E0(50\u5B57)"}';
        var resp28 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
          body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:sysP},{role:"user",content:tp28}], temperature:0.5, max_tokens:_tok(4000)})});
        if (resp28.ok) {
          var j28 = await resp28.json(); _checkTruncated(j28, '世界快照'); var c28 = j28.choices&&j28.choices[0]?j28.choices[0].message.content:'';
          var p28 = extractJSON(c28);
          if (p28) {
            // 存入AI记忆（高优先级）
            if (p28.world_snapshot) {
              if (!GM._aiMemory) GM._aiMemory = [];
              GM._aiMemory.push({ turn: GM.turn, content: p28.world_snapshot, type: 'snapshot', priority: 'high' });
            }
            if (p28.next_turn_seeds) {
              if (!GM._foreshadows) GM._foreshadows = [];
              GM._foreshadows.push({ turn: GM.turn, content: '\u3010\u4E0B\u56DE\u5408\u79CD\u5B50\u3011' + p28.next_turn_seeds, priority: 'high' });
            }
            GM._turnAiResults.subcall28 = p28;
          }
        }
      } catch(e28) { _dbg('[World Snapshot] fail:', e28); throw e28; }
      }); // end Sub-call 2.8 _runSubcall

      // --- 记忆压缩系统：根据模型上下文窗口自适应压缩（动态探测，无写死） ---
      try {
        // 使用 getCompressionParams() 获取基于实际上下文窗口的压缩参数
        var _cp = getCompressionParams(); // 定义在 tm-utils.js
        var _memCompressThreshold = _cp.memCompressThreshold;
        var _foreCompressThreshold = _cp.foreCompressThreshold;
        var _convCompressThreshold = _cp.convCompressThreshold;
        var _memKeepRecent = _cp.memKeepRecent;
        var _foreKeepRecent = _cp.foreKeepRecent;
        var _compressSummaryLen = _cp.summaryLen;
        var _compressForeSummaryLen = _cp.foreSummaryLen;

        _dbg('[Compress] ctxK:', _cp.contextK, 'scale:', _cp.scale.toFixed(2),
             'memThresh:', _memCompressThreshold, 'foreThresh:', _foreCompressThreshold,
             'convThresh:', _convCompressThreshold);

        var _needCompress = false;
        var _compressPrompt = '你是记忆压缩AI。请将以下旧记忆压缩为高密度摘要，保留所有关键信息（人物关系变化、重大事件、势力消长、伏笔线索、因果链），丢弃重复和琐碎内容。\n\n';

        // 压缩AI记忆
        if (GM._aiMemory && GM._aiMemory.length > _memCompressThreshold) {
          _needCompress = true;
          var _oldMem = GM._aiMemory.slice(0, GM._aiMemory.length - _memKeepRecent);
          var _keepMem = GM._aiMemory.slice(-_memKeepRecent);
          var _oldMemText = _oldMem.map(function(m){ return 'T'+(m.turn||'?')+': '+(m.content||m.text||m); }).join('\n');
          var _compP1 = _compressPrompt + '【AI记忆条目（共'+_oldMem.length+'条）】\n' + _oldMemText + '\n\n';
          _compP1 += '请返回JSON：{"compressed_memory":"将以上全部记忆压缩为一段连贯的高密度摘要('+_compressSummaryLen+'字，保留所有关键因果链和人物动态)","key_threads":"仍在发展中的关键线索(200字)"}';
          showLoading("压缩AI记忆",89);
          var _compResp1 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"你是记忆压缩专家。必须保留所有关键信息。"},{role:"user",content:_compP1}], temperature:0.3, max_tokens:_tok(6000)})});
          if (_compResp1.ok) {
            var _compJ1 = await _compResp1.json();
            var _compC1 = _compJ1.choices&&_compJ1.choices[0]?_compJ1.choices[0].message.content:'';
            var _compP1r = extractJSON(_compC1);
            if (_compP1r && _compP1r.compressed_memory) {
              // 用压缩摘要替换旧记忆，保留最近20条
              GM._aiMemory = [
                { turn: GM.turn, content: '【历史记忆压缩摘要·T1-T'+((_oldMem[_oldMem.length-1]||{}).turn||'?')+'】' + _compP1r.compressed_memory + (_compP1r.key_threads ? '\n【活跃线索】' + _compP1r.key_threads : ''), type: 'compressed', priority: 'critical' }
              ].concat(_keepMem);
              _dbg('[Memory Compress] AI记忆从', _oldMem.length+_keepMem.length, '条压缩为', GM._aiMemory.length, '条');
            }
          }
        }

        // 压缩伏笔
        if (GM._foreshadows && GM._foreshadows.length > _foreCompressThreshold) {
          var _oldFore = GM._foreshadows.slice(0, GM._foreshadows.length - _foreKeepRecent);
          var _keepFore = GM._foreshadows.slice(-_foreKeepRecent);
          var _oldForeText = _oldFore.map(function(f){ return 'T'+(f.turn||'?')+': '+(f.content||f.text||f); }).join('\n');
          var _compP2 = _compressPrompt + '【伏笔条目（共'+_oldFore.length+'条）】\n' + _oldForeText + '\n\n';
          _compP2 += '请判断哪些伏笔已被回收（已实现/已失效），哪些仍然活跃。返回JSON：{"active_foreshadows":"仍然活跃的伏笔汇总('+_compressForeSummaryLen+'字)","resolved":"已回收的伏笔简述(100字)","still_pending_count":数字}';
          showLoading("整理伏笔",90);
          var _compResp2 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"你是叙事顾问。判断伏笔是否已被回收。"},{role:"user",content:_compP2}], temperature:0.3, max_tokens:_tok(4000)})});
          if (_compResp2.ok) {
            var _compJ2 = await _compResp2.json();
            var _compC2 = _compJ2.choices&&_compJ2.choices[0]?_compJ2.choices[0].message.content:'';
            var _compP2r = extractJSON(_compC2);
            if (_compP2r && _compP2r.active_foreshadows) {
              GM._foreshadows = [
                { turn: GM.turn, content: '【伏笔压缩摘要】' + _compP2r.active_foreshadows + (_compP2r.resolved ? '\n【已回收】' + _compP2r.resolved : ''), type: 'compressed', priority: 'high' }
              ].concat(_keepFore);
              _dbg('[Foreshadow Compress]', _oldFore.length, '条旧伏笔压缩为摘要');
            }
          }
        }

        // 压缩对话历史
        var _maxConvForCompress = (P.conf && P.conf.convKeep) || ((P.ai.mem || 20) * 2);
        if (GM.conv && GM.conv.length > _convCompressThreshold && GM.conv.length > _maxConvForCompress * 0.7) {
          var _halfConv = Math.floor(GM.conv.length / 2);
          var _oldConv = GM.conv.slice(0, _halfConv);
          var _keepConv = GM.conv.slice(_halfConv);
          var _oldConvText = _oldConv.map(function(c){
            var role = c.role || 'unknown';
            var content = (c.content || '').substring(0, 150);
            return '[' + role + '] ' + content;
          }).join('\n');
          var _compP3 = '以下是早期的对话历史（玩家与AI的交互记录）：\n' + _oldConvText + '\n\n';
          _compP3 += '请压缩为一段摘要，保留：玩家的关键决策、AI给出的重要建议、双方达成的共识、未解决的议题。\n';
          _compP3 += '返回JSON：{"conversation_summary":"对话历史压缩摘要(300-500字)"}';
          showLoading("压缩对话",91);
          var _compResp3 = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"你是对话压缩专家。"},{role:"user",content:_compP3}], temperature:0.3, max_tokens:_tok(4000)})});
          if (_compResp3.ok) {
            var _compJ3 = await _compResp3.json();
            var _compC3 = _compJ3.choices&&_compJ3.choices[0]?_compJ3.choices[0].message.content:'';
            var _compP3r = extractJSON(_compC3);
            if (_compP3r && _compP3r.conversation_summary) {
              // 用摘要消息替换旧对话，保留后半段原样
              GM.conv = [
                { role: 'system', content: '【早期对话压缩摘要】' + _compP3r.conversation_summary }
              ].concat(_keepConv);
              _dbg('[Conv Compress]', _oldConv.length, '条旧对话压缩为摘要');
            }
          }
        }
      } catch(_compErr) { _dbg('[Memory Compress] 失败:', _compErr); }

      // 存储叙事摘要供下回合使用
      if (zhengwen && zhengwen.length > 10) {
        if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
        var sentences = zhengwen.split(/[。！？]/).filter(function(s) { return s.trim().length > 5; });
        var lastTwo = sentences.slice(-2).join('。') + '。';
        GM.chronicleAfterwords.push({ turn: GM.turn, summary: lastTwo.substring(0, 200) });
        var chrLimit = (P.conf && P.conf.chronicleKeep) || 10;
        if (GM.chronicleAfterwords.length > chrLimit) GM.chronicleAfterwords = GM.chronicleAfterwords.slice(-chrLimit);
      }

      // 防止对话历史无限增长：使用玩家配置的对话保留数
      var maxConv = (P.conf && P.conf.convKeep) || ((P.ai.mem || 20) * 2);
      if (GM.conv.length > maxConv) {
        GM.conv = GM.conv.slice(-maxConv);
      }

      // 历史检查环节（轻度和严格史实模式）
      if(P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') {
        showLoading("历史检查",85);
        try {
          var histCheckPrompt = "你是历史顾问AI。剧本背景：" + (sc ? sc.dynasty : "") + "，" + (sc ? sc.emperor : "") + "皇帝时期。\n";
          histCheckPrompt += "请检查以下推演内容是否存在明显的史实错误（如时代错乱、人物错位、技术超前等）：\n\n";
          histCheckPrompt += "时政记：" + shizhengji + "\n";
          histCheckPrompt += "正文：" + zhengwen.substring(0, 500) + "\n\n";
          histCheckPrompt += "如发现明显错误，请返回JSON：{\"has_error\":true,\"errors\":[\"错误描述1\",\"错误描述2\"],\"corrected_shizhengji\":\"修正后的时政记\",\"corrected_zhengwen\":\"修正后的正文\"}。\n";
          histCheckPrompt += "如无明显错误，返回：{\"has_error\":false}";

          var histResp = await fetch(url,{
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":"Bearer "+P.ai.key},
            body:JSON.stringify({
              model:P.ai.model||"gpt-4o",
              messages:[{role:"system",content:"你是历史顾问，负责检查史实准确性。"},{role:"user",content:histCheckPrompt}],
              temperature:0.3,
              max_tokens:_tok(1500)
            })
          });
          if(!histResp.ok) throw new Error('HTTP ' + histResp.status);
          var histData = await histResp.json();
          var histContent = "";
          if(histData.choices && histData.choices[0] && histData.choices[0].message) {
            histContent = histData.choices[0].message.content;
          }

          // 解析历史检查结果
          try {
            var histJson = extractJSON(histContent);

            if(histJson && histJson.has_error) {
              _dbg('[历史检查] 发现史实错误:', histJson.errors);
              if(histJson.corrected_shizhengji) shizhengji = histJson.corrected_shizhengji;
              if(histJson.corrected_zhengwen) zhengwen = histJson.corrected_zhengwen;
              // 可选：向玩家显示警告
              if(histJson.errors && histJson.errors.length > 0) {
                console.warn('[历史检查] 已修正以下错误:', histJson.errors.join('; '));
              }
            } else {
              _dbg('[历史检查] 未发现明显史实错误');
            }
          } catch(histParseErr) {
            console.warn('[历史检查] 解析结果失败:', histParseErr);
          }
        } catch(histErr) {
          console.warn('[历史检查] 检查失败:', histErr);
        }
      }

      // E13: 逻辑一致性自检（轻量、不调用API）
      (function _logicSelfCheck() {
        var _lcIssues = [];
        // 检查：死人出现在行动中
        var _deadNames = (GM.chars || []).filter(function(c){ return c.alive === false; }).map(function(c){ return c.name; });
        if (p1 && p1.npc_actions && Array.isArray(p1.npc_actions)) {
          p1.npc_actions.forEach(function(a) {
            var actor = a.actor || a.name || '';
            if (_deadNames.indexOf(actor) >= 0) {
              _lcIssues.push('已故人物"' + actor + '"仍在执行行动，已移除');
            }
          });
          // 移除死人行动
          p1.npc_actions = p1.npc_actions.filter(function(a) {
            return _deadNames.indexOf(a.actor || a.name || '') < 0;
          });
        }
        // 检查：已故人物的属性变化
        if (p1 && p1.char_updates && Array.isArray(p1.char_updates)) {
          p1.char_updates = p1.char_updates.filter(function(u) {
            if (_deadNames.indexOf(u.name || '') >= 0) {
              _lcIssues.push('已故人物"' + (u.name||'') + '"的属性更新已忽略');
              return false;
            }
            return true;
          });
        }
        if (_lcIssues.length > 0) {
          _dbg('[E13 逻辑自检] 修正' + _lcIssues.length + '项：', _lcIssues);
        }
      })();

      showLoading("\u89E3\u6790",90);

      // 3.3: Sub-call管线计时汇总
      if (GM._subcallTimings && Object.keys(GM._subcallTimings).length > 0) {
        var _timingParts = [];
        Object.keys(GM._subcallTimings).forEach(function(k) {
          var _meta = _subcallMeta.filter(function(m){return m.id===k;})[0];
          _timingParts.push((_meta ? _meta.name : k) + ':' + (GM._subcallTimings[k]/1000).toFixed(1) + 's');
        });
        _dbg('[3.3 Pipeline] ' + _timingParts.join(' | '));
      }
    }
    catch(err){shizhengji="\u5931\u8D25:"+err.message;zhengwen="\u9519\u8BEF";}
  }else{
    Object.keys(GM.vars).forEach(function(n){GM.vars[n].value=clamp(GM.vars[n].value+Math.floor(random()*7)-3,GM.vars[n].min,GM.vars[n].max);});
    shizhengji="\u56FD\u5BB6\u53D8\u5316\u4E2D";zhengwen="\u65F6\u5149\u6D41\u901D";playerStatus="\u5982\u5E38";
  }
  // 存储本回合 AI 叙事摘要供 NPC 引擎使用（避免重复 API 调用）
  GM._turnContext = {
    edicts: edicts,
    shizhengji: (shizhengji || '').substring(0, 300),
    zhengwen: (zhengwen || '').substring(0, 200),
    npcActionsThisTurn: (p1 && p1.npc_actions) ? p1.npc_actions.map(function(a) { return a.name; }) : []
  };

  // AI失败兜底——确保玩家至少看到时间推进的信息
  if (!shizhengji) {
    var _tsF = typeof getTSText === 'function' ? getTSText(GM.turn) : '本期';
    shizhengji = _tsF + '，天下暂无大事。（AI推演未返回有效数据）';
  }
  if (!zhengwen) zhengwen = '时移事去，朝堂内外一切如故。';

  return {
    shizhengji:shizhengji, zhengwen:zhengwen,
    playerStatus:playerStatus, playerInner:playerInner,
    turnSummary:turnSummary, timeRatio:timeRatio,
    suggestions:(p2&&p2.suggestions)||[],
    // 新增字段：实录/时政记标题/总结/人事/后人戏说
    shiluText:shiluText, szjTitle:szjTitle, szjSummary:szjSummary,
    personnelChanges:personnelChanges, hourenXishuo:hourenXishuo
  };
}

/** Step 3: 系统更新 — 动态数据更新 + NPC + ChangeQueue 结算 */
async function _endTurn_updateSystems(timeRatio, zhengwen) {
  // 3.0 机械层先行结算（战斗/围城/行军等确定性系统，在AI叙事之后、系统更新之前）
  if (typeof BattleEngine !== 'undefined' && BattleEngine._getConfig().enabled) {
    try { BattleEngine.resolveAllBattles(); } catch(e) { console.error('[BattleEngine] 结算失败:', e); }
  }

  // 3. 通过子回合调度器执行分层结算（daily→monthly→perturn）
  showLoading("更新数据",92);
  var pipelineCtx = { timeRatio: timeRatio, turn: GM.turn };
  SubTickRunner.run(pipelineCtx);

  // 3.5 NPC 行为推演（异步，不在 pipeline 中）
  try {
    if (P.ai.key) { showLoading("推演 NPC 行为",94); await executeNpcBehaviors(); }
    if (P.npcEngine && P.npcEngine.enabled) { showLoading("运行 NPC Engine",94.5); NpcEngine.runEngine(); }
  } catch(e) { console.error('[endTurn] NPC行为推演失败:', e); }

  // 5. 编年处理
  processBiannian();

  // 6. 推进回合
  GM.turn++;

  // 6.01 腐败引擎回合演化（九源累积/衰减/真实感知更新/后果传导/揭发概率）
  try {
    if (typeof CorruptionEngine !== 'undefined') {
      CorruptionEngine.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] CorruptionEngine.tick 失败:', e); }

  // 6.015 户口前移（方案联动总表推荐：腐败→户口→帑廪→内帑→民心→皇权→皇威）
  try {
    if (typeof HujiEngine !== 'undefined') {
      HujiEngine.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] HujiEngine(early) 失败:', e); }
  try {
    if (typeof HujiDeepFill !== 'undefined') {
      HujiDeepFill.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] HujiDeepFill(early) 失败:', e); }
  // 标记已早跑，后文跳过
  GM._hujiEarlyTicked = true;

  // 6.02 帑廪引擎回合结算（八源+八支+月度流水+年末决算）
  try {
    if (typeof GuokuEngine !== 'undefined') {
      GuokuEngine.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] GuokuEngine.tick 失败:', e); }

  // 6.03 内帑引擎回合结算（6 源+5 支+月度+年末+危机检查）
  try {
    if (typeof NeitangEngine !== 'undefined') {
      NeitangEngine.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] NeitangEngine.tick 失败:', e); }

  // 6.04 角色经济回合结算（6 资源 × 全角色）
  try {
    if (typeof CharEconEngine !== 'undefined') {
      CharEconEngine.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] CharEconEngine.tick 失败:', e); }

  // 6.05 经济联动（层层剥夺/区域财政/俸禄流/贪腐流/下拨/民心反馈）
  try {
    if (typeof EconomyLinkage !== 'undefined') {
      EconomyLinkage.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] EconomyLinkage.tick 失败:', e); }

  // 6.055 货币系统（铸币/纸币生命周期/市场/海外银流/钱荒钱贱）
  try {
    if (typeof CurrencyEngine !== 'undefined') {
      CurrencyEngine.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] CurrencyEngine.tick 失败:', e); }

  // 6.056 央地财政（合规率/地方 AI 决策/14 支出效果/监察/自立藩镇）
  try {
    if (typeof CentralLocalEngine !== 'undefined') {
      CentralLocalEngine.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] CentralLocalEngine.tick 失败:', e); }

  // 6.057 经济补完（封建财政/土地兼并/借贷/虚报差额/地域接受度/套利）
  try {
    if (typeof EconomyGapFill !== 'undefined') {
      EconomyGapFill.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] EconomyGapFill.tick 失败:', e); }

  // 6.07 户口系统（已在 6.015 早跑，跳过）
  if (!GM._hujiEarlyTicked) try {
    if (typeof HujiEngine !== 'undefined') {
      HujiEngine.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] HujiEngine.tick 失败:', e); }

  // 6.08 环境承载力（五维/疤痕/过载/危机/技术/政策）
  try {
    if (typeof EnvCapacityEngine !== 'undefined') {
      EnvCapacityEngine.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] EnvCapacityEngine.tick 失败:', e); }

  // 6.09 诏令/奏疏/抗疏（二阶段流程、待朱批清理）
  try {
    if (typeof EdictParser !== 'undefined') {
      EdictParser.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] EdictParser.tick 失败:', e); }

  // 6.10 户口深化（已在 6.015 早跑，跳过）
  if (!GM._hujiEarlyTicked) try {
    if (typeof HujiDeepFill !== 'undefined') {
      HujiDeepFill.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] HujiDeepFill.tick 失败:', e); }
  // 清 early 标记，下回合重新走
  GM._hujiEarlyTicked = false;

  // 6.11 诏令补完（11 类反向触发 + 自动路由）
  try {
    if (typeof EdictComplete !== 'undefined') {
      EdictComplete.tick({ turn: GM.turn });
    }
  } catch(e) { console.error('[endTurn] EdictComplete.tick 失败:', e); }

  // 6.12 环境恢复政策 + §9 联动
  try {
    if (typeof EnvRecoveryFill !== 'undefined') {
      EnvRecoveryFill.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] EnvRecoveryFill.tick 失败:', e); }

  // 6.13 皇威/皇权/民心 tick + 42 项变量联动
  try {
    if (typeof AuthorityEngines !== 'undefined') {
      AuthorityEngines.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] AuthorityEngines.tick 失败:', e); }

  // 6.14 权力系统补完（权臣/民变5级/暴君症状/失威危机/天象/联动全）
  try {
    if (typeof AuthorityComplete !== 'undefined') {
      AuthorityComplete.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] AuthorityComplete.tick 失败:', e); }

  // 6.15 历史补完（年龄金字塔精细化+疫病战亡字段维护）
  try {
    if (typeof HistoricalPresets !== 'undefined') {
      HistoricalPresets.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
    }
  } catch(e) { console.error('[endTurn] HistoricalPresets.tick 失败:', e); }

  // 6.16 C/D/B/A/E 阶段补丁 tick
  try {
    if (typeof PhaseC !== 'undefined') PhaseC.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
  } catch(e) { console.error('[endTurn] PhaseC.tick 失败:', e); }
  try {
    if (typeof PhaseD !== 'undefined') PhaseD.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
  } catch(e) { console.error('[endTurn] PhaseD.tick 失败:', e); }
  try {
    if (typeof PhaseB !== 'undefined') PhaseB.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
  } catch(e) { console.error('[endTurn] PhaseB.tick 失败:', e); }
  try {
    if (typeof PhaseA !== 'undefined') PhaseA.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
  } catch(e) { console.error('[endTurn] PhaseA.tick 失败:', e); }
  try {
    if (typeof PhaseE !== 'undefined') PhaseE.tick({ turn: GM.turn, monthRatio: timeRatio || 1 });
  } catch(e) { console.error('[endTurn] PhaseE.tick 失败:', e); }
  // 6.17 F 阶段全部补丁 tick
  try { if (typeof PhaseF1 !== 'undefined') PhaseF1.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseF1.tick 失败:', e); }
  try { if (typeof PhaseF2 !== 'undefined') PhaseF2.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseF2.tick 失败:', e); }
  try { if (typeof PhaseF3 !== 'undefined') PhaseF3.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseF3.tick 失败:', e); }
  try { if (typeof PhaseF4 !== 'undefined') PhaseF4.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseF4.tick 失败:', e); }
  try { if (typeof PhaseF5 !== 'undefined') PhaseF5.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseF5.tick 失败:', e); }
  try { if (typeof PhaseF6 !== 'undefined') PhaseF6.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseF6.tick 失败:', e); }
  // 6.18 G 阶段终结补丁 tick
  try { if (typeof PhaseG1 !== 'undefined') PhaseG1.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseG1.tick 失败:', e); }
  try { if (typeof PhaseG2 !== 'undefined') PhaseG2.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseG2.tick 失败:', e); }
  try { if (typeof PhaseG3 !== 'undefined') PhaseG3.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseG3.tick 失败:', e); }
  try { if (typeof PhaseG4 !== 'undefined') PhaseG4.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseG4.tick 失败:', e); }
  // 6.19 H 阶段终极补丁 tick
  try { if (typeof PhaseH !== 'undefined') PhaseH.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] PhaseH.tick 失败:', e); }
  // 6.20 NPC 按立场自主献策产生奏疏（天象/权臣/民变/灾变/瘟疫/军败 触发）
  try { if (typeof NpcMemorials !== 'undefined') NpcMemorials.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] NpcMemorials.tick 失败:', e); }
  // 6.21 融合桥接：行政区划 → 七变量 聚合
  try { if (typeof IntegrationBridge !== 'undefined') IntegrationBridge.tick({ turn: GM.turn, monthRatio: timeRatio || 1 }); } catch(e) { console.error('[endTurn] IntegrationBridge.tick 失败:', e); }

  // 6.06 角色完整字段推演（stressSources/innerThought/career/familyMembers/clanPrestige）
  try {
    if (typeof CharFullSchema !== 'undefined' && Array.isArray(GM.chars)) {
      var _mr = (typeof timeRatio === 'number') ? timeRatio : 1;
      GM.chars.forEach(function(ch) {
        if (!ch || ch.alive === false) return;
        CharFullSchema.ensureFullFields(ch);
        CharFullSchema.evolveTick(ch, _mr);
      });
      // 官职变动侦测 → 仕途履历
      GM.chars.forEach(function(ch) {
        if (!ch || ch.alive === false) return;
        var curTitle = ch.officialTitle || '';
        if (ch._lastRecordedTitle !== undefined && curTitle !== ch._lastRecordedTitle) {
          CharFullSchema.recordCareerEvent(
            ch,
            (typeof getTSText === 'function' ? getTSText(GM.turn) : '第' + GM.turn + '回'),
            (ch._lastRecordedTitle ? '由 ' + ch._lastRecordedTitle + ' ' : '') + (curTitle ? '升/转 ' + curTitle : '去官'),
            '',
            !!curTitle && !ch._lastRecordedTitle // 首任视为里程碑
          );
        }
        ch._lastRecordedTitle = curTitle;
      });
    }
  } catch(e) { console.error('[endTurn] CharFullSchema.evolveTick 失败:', e); }
  // N4: 精力回复（每回合回复一定值，受年龄和压力影响）
  if (GM._energy !== undefined) {
    var _pc = GM.chars && GM.chars.find(function(c){ return c.isPlayer; });
    var _recoverAmt = 40; // 基础回复量
    if (_pc) {
      if ((_pc.age || 30) > 50) _recoverAmt -= 5;
      if ((_pc.age || 30) > 65) _recoverAmt -= 10;
      if ((_pc.stress || 0) > 60) _recoverAmt -= 8;
    }
    GM._energy = Math.min(GM._energyMax || 100, (GM._energy || 0) + Math.max(10, _recoverAmt));
  }

  // 6.63 领地产出计算（在集权回拨之前）
  if (P.territoryProductionSystem && P.territoryProductionSystem.enabled) {
    showLoading("计算领地产出",92.5);
    CentralizationSystem.resetFinance();
    TerritoryProductionSystem.calculateAll();
    TerritoryProductionSystem.updateAttributes();
  }

  // 6.65 集权回拨系统财政结算
  if (P.centralizationSystem && P.centralizationSystem.enabled) {
    showLoading("财政结算",93);
    CentralizationSystem.runSettlement();
  }

  // 6.82-6.85 国策/议程/省经济（已注册到 pipeline，此处仅补充未注册的部分）
  // 这些步骤在 pipeline 中按优先级自动执行，此处保留为兜底
  try { if (typeof evaluateThresholdTriggers === 'function') evaluateThresholdTriggers(); } catch(e) { console.error('[endTurn] 阈值触发检查失败:', e); }
  try { updateProvinceEconomy(); } catch(e) { console.error('[endTurn] 省经济更新失败:', e); }
  try { StateCouplingSystem.processCouplings(); } catch(e) { console.error('[endTurn] 状态耦合失败:', e); }
  try { AutoReboundSystem.applyRebounds(); } catch(e) { console.error('[endTurn] 自动反弹失败:', e); }

  // 6.855 应用变动队列（ChangeQueue System）
  showLoading("应用决策变动", 93);
  _dbg('[endTurn] Step 6.855: 开始应用变动队列');
  var queueResult = null;
  try {
    queueResult = ChangeQueue.applyAll() || {};
    _dbg('[endTurn] 变动队列应用完成:', queueResult);
    var _execRate = (typeof queueResult.executionRate === 'number') ? queueResult.executionRate : 0;
    _dbg('[endTurn] 执行率: ' + _execRate.toFixed(1) + '%，已应用 ' + (queueResult.appliedCount || 0) + ' 个变动');

    // 将队列中的国库变动记录到 AccountingSystem
    var appliedChanges = ChangeQueue.getAppliedChanges();

    // 收集变量变化用于检查改革触发
    var variableChanges = {};
    appliedChanges.forEach(function(change) {
      if (change.type === 'treasury' && change.field === 'gold') {
        if (change.delta > 0) {
          AccountingSystem.addIncome(change.description, change.delta, change.source);
        } else if (change.delta < 0) {
          AccountingSystem.addExpense(change.description, Math.abs(change.delta), change.source);
        }
      } else if (change.type === 'variable' && change.delta !== undefined) {
        // 累积变量变化
        if (!variableChanges[change.target]) {
          variableChanges[change.target] = 0;
        }
        variableChanges[change.target] += change.delta;
      }
    });

    // 清空队列
    ChangeQueue.clear();
    _dbg('[endTurn] 变动队列已清空');

    // 检查改革触发（基于本回合变量变化）
    AutoReboundSystem.checkReforms(variableChanges);

    // 应用得罪群体系统衰减
    OffendGroupsSystem.applyDecay();

    // 更新状态耦合系统的变量快照（为下一回合准备）
    StateCouplingSystem.updateSnapshot();
  } catch (error) {
    console.error('[endTurn] 应用变动队列失败:', error);
  }

  // 6.87 检查历史事件触发
  checkHistoryEvents();

  // 6.88 检查刚性触发器
  checkRigidTriggers();

  // 6.885 检查科举筹办完成
  if(GM.keju && GM.keju.preparingExam && zhengwen) {
    // 检查AI是否在正文中提到科举筹办完成、科举开考等关键词
    var kejuCompleteKeywords = ['科举.*?开考', '科举.*?举办', '科举.*?完成', '科举.*?如期', '贡院.*?开启', '考生.*?入场', '放榜'];
    var isKejuComplete = kejuCompleteKeywords.some(function(keyword) {
      return new RegExp(keyword).test(zhengwen);
    });

    if(isKejuComplete) {
      _dbg('[科举] AI推演显示科举筹办完成，准备开考');
      GM.keju.preparingExam = false;
      // 在下一回合自动触发科举考试
      setTimeout(function() {
        if(P.keju && P.keju.enabled && !P.keju.currentExam) {
          _dbg('[科举] 自动触发科举考试');
          startKejuExam();
        }
      }, 2000);
    }
  }

  // 6.89 更新职位系统（品位晋升）
  if (P.positionSystem && P.positionSystem.enabled) {
    _dbg('[endTurn] Step 6.89: 更新职位系统');
    PositionSystem.updatePrestige();
  }

  // 6.90 检查空缺职位提醒
  if (P.vacantPositionReminder && P.vacantPositionReminder.enabled) {
    _dbg('[endTurn] Step 6.90: 检查空缺职位');
    VacantPositionReminder.checkVacantPositions();
  }

  // 6.91 检查自然死亡
  if (P.naturalDeath && P.naturalDeath.enabled) {
    _dbg('[endTurn] Step 6.91: 检查自然死亡');
    NaturalDeathSystem.checkNaturalDeaths();
  }

  // 6.9 处理数据变化队列（监听系统）
  processChangeQueue();

  // 6.91b 关系网冲突自然衰减（每回合）
  if (typeof decayConflictLevels === 'function') {
    try { decayConflictLevels(); } catch(_) {}
  }
  // 6.91c 跨代父仇继承（conflictLevel≥4 + 双方有子嗣）
  if (typeof inheritBloodFeuds === 'function') {
    try { inheritBloodFeuds(); } catch(_) {}
  }

  // 6.92 文事作品老化：非传世且质量<70 的作品 > 10 回合后移入 _forgottenWorks（压缩记忆）
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    if (!GM._forgottenWorks) GM._forgottenWorks = [];
    var _aged = [];
    GM.culturalWorks = GM.culturalWorks.filter(function(w) {
      if (w.isPreserved) return true;
      if (GM.turn - (w.turn || 0) > 10 && (w.quality || 0) < 70) {
        _aged.push({ id: w.id, author: w.author, title: w.title, turn: w.turn, genre: w.genre });
        return false;
      }
      return true;
    });
    if (_aged.length > 0) {
      GM._forgottenWorks = GM._forgottenWorks.concat(_aged);
      if (GM._forgottenWorks.length > 500) GM._forgottenWorks = GM._forgottenWorks.slice(-500);
    }
  }

  // 6.95 清空查询缓存（每回合结束后数据已变化）
  WorldHelper.clearCache();

  return queueResult;
}

/** Step 4: 渲染 + 存档 — UI 更新、史记显示、自动存档 */
// ============================================================
//  endTurn() — 主调度器，按阶段调用子函数
// ============================================================
/** 主回合推演入口（玩家点击"静待时变"触发） */
// ═══ 勤政 / 怠政 累计 ═══
//   每次开朝（in-turn 或 post-turn）调用此函数增量 thisTurnCount
//   endTurn 时结算：count>=2 diligentStreak++/missedStreak=0, count==0 missedStreak++/diligentStreak=0
function recordCourtHeld(opts) {
  if (!GM._courtMeter) GM._courtMeter = { thisTurnCount: 0, missedStreak: 0, diligentStreak: 0, lastCourtTurn: 0 };
  var m = GM._courtMeter;
  // targetTurn 归属：post-turn 归下回合，in-turn 归本回合
  var targetTurn = (opts && opts.isPostTurn) ? (GM.turn + 1) : GM.turn;
  if (!m.byTurn) m.byTurn = {};
  m.byTurn[targetTurn] = (m.byTurn[targetTurn] || 0) + 1;
  m.lastCourtTurn = targetTurn;
}

// endTurn 末尾结算 streak
function _settleCourtMeter() {
  if (!GM._courtMeter) GM._courtMeter = { thisTurnCount: 0, missedStreak: 0, diligentStreak: 0, lastCourtTurn: 0, byTurn: {} };
  var m = GM._courtMeter;
  if (!m.byTurn) m.byTurn = {};
  var curCount = m.byTurn[GM.turn] || 0;
  m.thisTurnCount = curCount;
  if (curCount === 0) {
    m.missedStreak = (m.missedStreak || 0) + 1;
    m.diligentStreak = 0;
  } else if (curCount >= 2) {
    m.diligentStreak = (m.diligentStreak || 0) + 1;
    m.missedStreak = 0;
  } else {
    // 正好 1 次——中庸，两 streak 都不增
    m.missedStreak = Math.max(0, (m.missedStreak || 0) - 0);
    m.diligentStreak = Math.max(0, (m.diligentStreak || 0) - 0);
  }
  // 阈值触发（连续 3 回合）
  if (m.missedStreak >= 3 && !m._missedAlerted) {
    if (GM.vars) {
      if (GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') GM.vars['皇威'].value = Math.max(0, GM.vars['皇威'].value - 5);
    }
    (GM.chars || []).forEach(function(c) {
      if (c && c.alive !== false && (c.wuchang && (c.wuchang['义'] || 0) > 60)) {
        c.loyalty = Math.max(0, (c.loyalty || 50) - 2);
        if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '陛下连三月不视朝·忧国臣子皆患之', '忧', 6);
      }
    });
    if (typeof addEB === 'function') addEB('政局', '连三月不视朝·皇威-5·贤臣谏疏云集');
    m._missedAlerted = true;
    m._diligentAlerted = false;
  } else if (m.diligentStreak >= 3 && !m._diligentAlerted) {
    if (GM.vars) {
      if (GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') GM.vars['皇威'].value = Math.min(100, GM.vars['皇威'].value + 3);
    }
    (GM.chars || []).forEach(function(c) {
      if (c && c.alive !== false && (c.integrity || 50) > 60) {
        c.loyalty = Math.min(100, (c.loyalty || 50) + 1);
        if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '陛下勤勉·连三月双朝议事·臣等感佩', '敬', 5);
      }
    });
    if (typeof addEB === 'function') addEB('政局', '连三月勤政双朝·皇威+3·贤臣归心');
    m._diligentAlerted = true;
    m._missedAlerted = false;
  }
  // 清理过旧的 byTurn 记录
  var cur = GM.turn;
  Object.keys(m.byTurn).forEach(function(k) { if (+k < cur - 8) delete m.byTurn[k]; });
}

// ═══ 后朝并发机制 ═══
//   · 过回合时弹 "是否例行朝会" → 选是：并发开后朝（targetTurn=GM.turn+1）+ AI 推演
//   · AI 先完：暂存 payload，绿 banner 提示；朝会毕时弹史记
//   · 朝会先完：若 AI 仍在跑，自然过渡到加载进度
function _showPostTurnCourtPromptAndStartEndTurn() {
  if (GM.busy) return;
  var _bg = document.createElement('div');
  _bg.className = 'modal-bg show';
  _bg.id = 'post-turn-court-prompt';
  _bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:5000;';
  _bg.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:10px;padding:1.4rem 1.6rem;min-width:360px;max-width:460px;text-align:center;">'
    + '<div style="font-size:1.05rem;color:var(--gold);font-weight:700;margin-bottom:0.7rem;">\u3014\u4ECA\u56DE\u5408\u5DF2\u7EC8\uFF0C\u6B32\u5F00\u4F8B\u884C\u671D\u4F1A\uFF1F\u3015</div>'
    + '<div style="font-size:0.8rem;color:var(--txt-s);line-height:1.7;margin-bottom:1.1rem;text-align:left;padding:0 0.4rem;">'
      + '\u00B7 \u9009\u5F00\u671D\uFF1A\u6709\u53F8\u540E\u53F0\u63A8\u6F14\u540C\u65F6\uFF0C\u5F00\u6B21\u6708\u6714\u671D\uFF1B\u672C\u671D\u4F1A\u7B97\u6B21\u56DE\u5408\u7684\u671D\u4F1A\uFF0C\u5F71\u54CD\u6B21\u56DE\u5408\u63A8\u6F14\n'
      + '\u00B7 \u9009\u5426\uFF1A\u76F4\u63A5\u7B49\u5F85\u63A8\u6F14\u5B8C\u6BD5\uFF0C\u4E0D\u5F00\u671D\n'
      + '\u00B7 \u52E4\u653F\u6807\u51C6\uFF1A\u6BCF\u56DE\u5408\u4EFB\u4E00\u6B21\u671D\u4F1A\uFF08\u6708\u521D\u6714\u671D\u6216\u6708\u4E2D\u5E38\u671D\uFF09\u5373\u8BA1\u52E4'
    + '</div>'
    + '<div style="display:flex;gap:0.6rem;justify-content:center;">'
      + '<button class="bt bp" style="padding:8px 24px;" onclick="_postTurnCourtChoose(true)">\uD83D\uDCDC \u5F00\u6714\u671D</button>'
      + '<button class="bt" style="padding:8px 24px;" onclick="_postTurnCourtChoose(false)">\u9759\u5019\u6709\u53F8</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(_bg);
}

function _postTurnCourtChoose(openCourt) {
  var _bg = _$('post-turn-court-prompt');
  if (_bg) _bg.remove();
  if (openCourt) {
    // 先标记 courtDone=false 并启动 AI 推演（后台）
    GM._pendingShijiModal = { aiReady: false, courtDone: false, payload: null };
    GM._isPostTurnCourt = true;
    // 并发：启动 endTurn 主流程（不 await·让 AI 在后台跑）
    _endTurnInternal();
    // 同时开朝——先打开 chaoyi-modal 再直跳常朝准备
    setTimeout(function(){
      try {
        // 1) 初始化 CY 状态并创建 chaoyi-modal（不走 openChaoyi 的模式选择页·直接进常朝）
        if (typeof openChaoyi === 'function') {
          // 绕过 turn 频率限制（后朝是独立于 in-turn 限制的机会）
          if (!GM._chaoyiCount) GM._chaoyiCount = {};
          if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
          // 临时拉低计数以绕开 openChaoyi 的频率闸（若已开 2 次暂存旧值）
          var _origCnt = GM._chaoyiCount[GM.turn];
          GM._chaoyiCount[GM.turn] = 0;
          openChaoyi();
          GM._chaoyiCount[GM.turn] = _origCnt; // 恢复，避免双计
        }
        // 2) CY 设置为常朝模式
        if (typeof CY !== 'undefined') { CY.mode = 'changchao'; CY.topic = ''; }
        // 3) 隐藏模式选择页·直跳筹备弹窗
        var cyBody = _$('cy-body');
        if (cyBody) cyBody.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);padding:1rem;font-size:0.78rem;">\u3014\u6714\u671D\u00B7\u6B21\u6708\u521D\u671D\u3015\u7B79\u5907\u4E2D\u2026\u2026</div>';
        if (typeof _cc2_openPrepareDialog === 'function') _cc2_openPrepareDialog();
        // 4) 添加底栏进度 banner
        if (typeof _showPostTurnCourtBanner === 'function') _showPostTurnCourtBanner();
      } catch(_e) { console.error('[postTurnCourt] openFailed:', _e); }
    }, 200);
  } else {
    // 不开朝——直接跑 endTurn，显示加载条
    GM._pendingShijiModal = { aiReady: false, courtDone: true, payload: null };
    GM._isPostTurnCourt = false;
    _endTurnInternal();
  }
}

// 底栏进度 banner（朝会期间常驻）
function _showPostTurnCourtBanner() {
  var _existing = _$('post-turn-court-banner');
  if (_existing) _existing.remove();
  var el = document.createElement('div');
  el.id = 'post-turn-court-banner';
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:4900;background:linear-gradient(90deg,rgba(184,154,83,0.18),rgba(184,154,83,0.08));border-top:2px solid var(--gold-d);padding:6px 14px;display:flex;align-items:center;gap:10px;font-size:0.76rem;color:var(--gold);';
  el.innerHTML = '<span style="font-weight:700;">〔朔朝〕</span><span id="post-turn-court-banner-msg">有司推演中……本朝决议施于次回合</span><span style="margin-left:auto;font-size:0.68rem;color:var(--txt-d);">AI 后台推演</span>';
  document.body.appendChild(el);
}

function _updatePostTurnCourtBanner(status) {
  var msgEl = _$('post-turn-court-banner-msg');
  if (!msgEl) return;
  if (status === 'aiReady') {
    msgEl.textContent = '\u2713 \u6709\u53F8\u63A8\u6F14\u5DF2\u6BD5\u00B7\u672C\u671D\u4F1A\u7ED3\u675F\u540E\u81EA\u52A8\u542F\u53F2\u8BB0';
    msgEl.style.color = 'var(--green,#6aa88a)';
  }
}

function _hidePostTurnCourtBanner() {
  var _el = _$('post-turn-court-banner');
  if (_el) _el.remove();
}

// 朝会结束时调用——顺序：先弹史记，其他模态（keju/事件等）排队其后
async function _onPostTurnCourtEnd() {
  if (!GM._pendingShijiModal) { GM._isPostTurnCourt = false; return; }
  _hidePostTurnCourtBanner();
  if (!(GM._pendingShijiModal.aiReady && GM._pendingShijiModal.payload)) {
    // AI 还没好——关闭后朝标志让后续 AI 完成时直接 render
    GM._isPostTurnCourt = false;
    GM._pendingShijiModal.courtDone = true;
    showLoading('\u5019\u6709\u53F8\u63A8\u6F14\u2026\u2026', 50);
    return;
  }
  var _payload = GM._pendingShijiModal.payload;
  var _deferredPhase5 = GM._pendingShijiModal.deferredPhase5;
  GM._pendingShijiModal.payload = null;
  GM._pendingShijiModal.aiReady = false;
  GM._pendingShijiModal.deferredPhase5 = null;

  // 1) 先弹史记（临时放开 courtDone，让 showTurnResult 直通）
  GM._pendingShijiModal.courtDone = true;
  try { _endTurn_render.apply(null, _payload); } catch(_e){ console.error('[postTurnCourt] render:', _e); }

  // 2) 重新启用"队列模式"，让 phase5 产生的模态都进队列·不立即弹
  GM._pendingShijiModal.courtDone = false; // 假装朝会还在
  if (typeof _deferredPhase5 === 'function') {
    try { await _deferredPhase5(); } catch(_ph5){ console.warn('[postTurnCourt] deferredPhase5:', _ph5); }
  }

  // 3) 收官：恢复正常状态 + 延迟 1s 后按队列依次弹出其他模态（给用户看史记的时间）
  GM._isPostTurnCourt = false;
  GM._pendingShijiModal.courtDone = true;
  setTimeout(function(){
    try { if (typeof _flushPostTurnModalQueue === 'function') _flushPostTurnModalQueue(); } catch(_fq){ console.warn('[postTurnCourt] flush:', _fq); }
  }, 1000);
}

async function _endTurnInternal() {
  // 原 endTurn 的完整内容移入此处，方便并发调用
  return await _endTurnCore();
}

async function endTurn(){
  // 入口：显示"是否例行朝会"弹窗
  if (GM.busy) return;
  _showPostTurnCourtPromptAndStartEndTurn();
}

async function _endTurnCore(){
  try{
  // 兼容新旧UI：老诏令面板按钮是btn-end，新UI右侧按钮是btn-end-turn
  var btn=_$("btn-end")||_$("btn-end-turn");
  if(GM.busy)return;
  GM.busy=true;
  GM._endTurnBusy=true;
  if(btn){ btn.textContent="\u63A8\u6F14\u4E2D...";btn.style.opacity="0.6"; }
  // 后朝中不用 showLoading（会遮挡朝会）
  if (!(GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false)) {
    showLoading("\u65F6\u79FB\u4E8B\u53BB",10);
  }

  await EndTurnHooks.execute('before');

  // Phase 0-0: 提交本回合所有奏疏决定的副作用（NPC 记忆 + 朱批回传）
  try { if (typeof _commitMemorialDecisions === 'function') _commitMemorialDecisions(); } catch(_cmE) { console.warn('[endTurn] _commitMemorialDecisions', _cmE); }

  // Phase 0-1: 初始化 + 收集输入
  var npcContext = _endTurn_init();
  var input = _endTurn_collectInput();
  var edicts=input.edicts, xinglu=input.xinglu, memRes=input.memRes, oldVars=input.oldVars;

  // 暂存昏君活动供 AI 推演使用
  GM._turnTyrantActivities = input.tyrantActivities || [];

  // Phase 2: AI 推演
  var aiResult = await _endTurn_aiInfer(edicts, xinglu, memRes, oldVars);
  var shizhengji=aiResult.shizhengji, zhengwen=aiResult.zhengwen, playerStatus=aiResult.playerStatus, playerInner=aiResult.playerInner||'', turnSummary=aiResult.turnSummary||'';
  // 新增：实录、时政记标题/总结、人事变动、后人戏说
  var shiluText=aiResult.shiluText||'', szjTitle=aiResult.szjTitle||'', szjSummary=aiResult.szjSummary||'';
  var personnelChanges=aiResult.personnelChanges||[], hourenXishuo=aiResult.hourenXishuo||aiResult.zhengwen||'';
  var timeRatio=aiResult.timeRatio;

  // Phase 2.5: AI推演后执行玩家诏令（AI已看到意图并在推演中反应）
  if (input.edictActions && (input.edictActions.appointments.length || input.edictActions.dismissals.length || input.edictActions.deaths.length)) {
    applyEdictActions(input.edictActions);
  }

  // Phase 2.6: 应用昏君活动效果
  var tyrantResult = null;
  if (typeof TyrantActivitySystem !== 'undefined' && GM._turnTyrantActivities && GM._turnTyrantActivities.length > 0) {
    tyrantResult = TyrantActivitySystem.applyEffects(GM._turnTyrantActivities);
  }

  // Phase 3: 系统更新
  var queueResult = await _endTurn_updateSystems(timeRatio, zhengwen);

  // 生成变化报告
  var changeReportHtml = generateChangeReport();
  var changes=[];Object.entries(GM.vars).forEach(function(e){var d=e[1].value-oldVars[e[0]];if(d!==0)changes.push({name:e[0],old:oldVars[e[0]],val:e[1].value,delta:d});});

  // Phase 4: 渲染 + 存档 —— 若后朝仍在进行则延后到朝会结束
  var _renderArgs = [shizhengji, zhengwen, playerStatus, playerInner, edicts, xinglu, oldVars, changeReportHtml, queueResult, aiResult.suggestions, tyrantResult, turnSummary, shiluText, szjTitle, szjSummary, personnelChanges, hourenXishuo];
  if (GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false) {
    // 后朝进行中——暂存 payload，AI 完成但不弹史记；刷新底栏进度绿 banner
    GM._pendingShijiModal.aiReady = true;
    GM._pendingShijiModal.payload = _renderArgs;
    if (typeof _updatePostTurnCourtBanner === 'function') _updatePostTurnCourtBanner('aiReady');
    hideLoading();
  } else {
    _endTurn_render.apply(null, _renderArgs);
    if (GM._pendingShijiModal) { GM._pendingShijiModal.aiReady = false; GM._pendingShijiModal.payload = null; }
  }

  // Phase 4.5: 勤政 streak 结算
  try { if (typeof _settleCourtMeter === 'function') _settleCourtMeter(); } catch(_ccE) { console.warn('[endTurn] courtMeter', _ccE); }

  // Phase 4.6: 角色路程推进·到达自动就任（AI 至高权力·Step 4）
  try { if (typeof advanceCharTravelByDays === 'function') advanceCharTravelByDays((P.time && P.time.daysPerTurn) || 30); } catch(_trvE){ console.warn('[endTurn] char travel tick', _trvE); }

  // Phase 5: 后续钩子——后朝进行中则全部延后（避免 keju 等弹窗覆盖朝会）
  if (GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false) {
    GM._pendingShijiModal.deferredPhase5 = async function() {
      try { await EndTurnHooks.execute('after'); } catch(_ph5e){ console.warn('[postTurn] phase5 hooks', _ph5e); }
      // v5·科举时间化推进（每回合累天数）
      if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
        try { advanceKejuByDays((P.time && P.time.daysPerTurn) || 30); } catch(_kjA){ console.warn('[postTurn] keju advance', _kjA); }
      }
      if (P.keju && P.keju.enabled && !P.keju.currentExam) {
        try { await checkKejuTrigger(); } catch(_kj){ console.warn('[postTurn] keju', _kj); }
      }
    };
  } else {
    await EndTurnHooks.execute('after');
    // v5·科举时间化推进
    if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
      try { advanceKejuByDays((P.time && P.time.daysPerTurn) || 30); } catch(_kjA){ console.warn('[endTurn] keju advance', _kjA); }
    }
    if (P.keju && P.keju.enabled && !P.keju.currentExam) {
      await checkKejuTrigger();
    }
  }

  // Phase 5.3: 跨回合记忆摘要（1.3）——每5回合压缩近期事件为200字摘要
  (function _aiMemoryCompress() {
    var interval = 5; // 每5回合压缩一次
    if (GM.turn % interval !== 0 || !P.ai || !P.ai.key) return;
    if (!GM._aiMemorySummaries) GM._aiMemorySummaries = [];

    // 收集近5回合的关键事件
    var _recentEvents = (GM.evtLog || []).filter(function(e) {
      return e.turn > GM.turn - interval;
    }).slice(-30);
    if (_recentEvents.length < 3) return;

    var _evtText = _recentEvents.map(function(e) { return '[' + e.type + '] ' + e.text; }).join('\n');
    var _prevSummary = GM._aiMemorySummaries.length > 0 ? GM._aiMemorySummaries[GM._aiMemorySummaries.length - 1].summary : '';

    // 异步压缩（不阻塞）
    var _compressPrompt = '请将以下游戏事件压缩为200字以内的摘要，格式：「第X-Y回合概要：[关键事件]、[势力变动]、[未解决冲突]、[伏笔]」\n\n'
      + '回合范围：第' + (GM.turn - interval + 1) + '-' + GM.turn + '回合\n'
      + (_prevSummary ? '上一段摘要：' + _prevSummary.slice(-100) + '\n\n' : '')
      + '事件列表：\n' + _evtText + '\n\n请直接输出摘要正文：';

    // 使用callAI而非raw fetch——自动适配所有模型（OpenAI/Anthropic/本地）
    if (typeof callAI === 'function') {
      callAI(_compressPrompt, 500).then(function(txt) {
        if (txt && txt.length > 30) {
          GM._aiMemorySummaries.push({ turn: GM.turn, summary: txt.substring(0, 400) });
          if (GM._aiMemorySummaries.length > 10) GM._aiMemorySummaries = GM._aiMemorySummaries.slice(-10);
          DebugLog.log('ai', '记忆摘要生成完成:', txt.length, '字');
        }
      }).catch(function(err) { DebugLog.warn('ai', '记忆摘要生成失败:', err.message); });
    }
  })();

  // 1.6: 记录回合token消耗
  if (typeof TokenUsageTracker !== 'undefined') {
    var _turnTokens = TokenUsageTracker.getTurnUsage();
    if (_turnTokens > 0) DebugLog.log('ai', '本回合token消耗:', _turnTokens);
  }

  // Phase 5.4: 月度纪事异步生成（3.2）
  // 用 turnsForDuration('month') 判断月边界，大回合剧本(>30天/回合)跳过月度层
  (function _monthlyChronicle() {
    var _monthTurns = (typeof turnsForDuration === 'function') ? turnsForDuration('month') : 0;
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    // 月度层仅在一回合≤30天时有意义；大回合(季度/年度)跳过月度层直接走年度
    if (_monthTurns < 1 || _dpv >= 90 || !P.ai || !P.ai.key) return;
    if (GM.turn % _monthTurns !== 0) return;

    var _mCfg = (P.mechanicsConfig && P.mechanicsConfig.chronicleConfig) || {};
    var _wordLimit = _mCfg.monthlyWordLimit || 200;
    var _narrator = _mCfg.narratorRole || '史官';
    var _style = (P.conf && P.conf.style) || '';

    // 收集本月事件
    var _monthEvents = (GM.evtLog || []).filter(function(e) {
      return e.turn > GM.turn - _monthTurns && e.turn <= GM.turn;
    });
    if (_monthEvents.length === 0) return;

    var _monthSummary = _monthEvents.map(function(e) {
      return '[' + e.type + '] ' + e.text;
    }).join('\n');

    // 上月纪事（连贯性）
    var _prevMonthly = '';
    if (GM.monthlyChronicles && GM.monthlyChronicles.length > 0) {
      _prevMonthly = GM.monthlyChronicles[GM.monthlyChronicles.length - 1].text || '';
      _prevMonthly = _prevMonthly.slice(-100);
    }

    // 异步生成（不阻塞回合）
    var _mPrompt = '你是' + (P.dynasty || '') + _narrator + '。'
      + (_style ? '以' + _style + '风格，' : '')
      + '请根据以下本月事件，撰写' + _wordLimit + '字以内的月度纪事。\n\n'
      + '【本月事件】\n' + _monthSummary + '\n';
    if (_prevMonthly) _mPrompt += '\n【上月纪事末尾】' + _prevMonthly + '\n';
    _mPrompt += '\n请直接输出纪事正文（不要JSON包裹）：';

    // 异步调用，不await——不阻塞后续逻辑
    var _mUrl = P.ai.url;
    if (_mUrl.indexOf('/chat/completions') < 0) _mUrl = _mUrl.replace(/\/+$/, '') + '/chat/completions';
    fetch(_mUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + P.ai.key },
      body: JSON.stringify({
        model: P.ai.model || 'gpt-4o',
        messages: [
          { role: 'system', content: '你是' + (P.dynasty || '') + _narrator },
          { role: 'user', content: _mPrompt }
        ],
        temperature: 0.7,
        max_tokens: Math.min(800, _wordLimit * 3)
      })
    }).then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function(j) {
      var txt = (j.choices && j.choices[0] && j.choices[0].message) ? j.choices[0].message.content : '';
      if (txt && txt.length > 20) {
        if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
        GM.monthlyChronicles.push({
          turn: GM.turn,
          date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T' + GM.turn,
          text: txt.substring(0, _wordLimit * 2),
          generatedAt: Date.now()
        });
        // 保留最近24个月
        if (GM.monthlyChronicles.length > 24) GM.monthlyChronicles = GM.monthlyChronicles.slice(-24);
        DebugLog.log('settlement', '月度纪事生成完成:', txt.length, '字');
      }
    }).catch(function(err) {
      // 失败fallback：用事件日志直接拼接
      DebugLog.warn('settlement', '月度纪事AI生成失败，使用事件拼接:', err.message);
      if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
      var fallbackText = _monthEvents.map(function(e) { return e.text; }).join('\u3002') + '\u3002';
      GM.monthlyChronicles.push({
        turn: GM.turn,
        date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T' + GM.turn,
        text: fallbackText.substring(0, _wordLimit),
        generatedAt: Date.now(),
        isFallback: true
      });
    });
  })();

  // Phase 5.5: 年度汇总（跨年时触发）——统一委托给 ChronicleSystem
  if (typeof isYearBoundary === 'function' && isYearBoundary()) {
    // 重置事件年度计数
    if (typeof EventConstraintSystem !== 'undefined') EventConstraintSystem.resetYearlyCounts();
    // 年度编年史由 ChronicleSystem._tryGenerateYearChronicle 异步生成（含6.1伏笔/6.5摘要整合）
    // 不在此处重复生成——ChronicleSystem.addMonthDraft 的跨年检测会自动触发
    _dbg('[Chronicle] \u8DE8\u5E74\u68C0\u6D4B\uFF0C\u5E74\u5EA6\u7F16\u5E74\u53F2\u7531ChronicleSystem\u5F02\u6B65\u751F\u6210');
  }

  // 清理回合临时上下文
  delete GM._turnContext;
  delete GM._turnTyrantActivities;
  delete GM._turnAiResults;

  // 玩家角色死亡 → 显示游戏结束画面
  if (GM._playerDead) {
    GM.busy = false;
    GM.running = false;
    var _pdName = P.playerInfo ? P.playerInfo.characterName : '玩家';
    var _pdReason = GM._playerDeathReason || '不明原因';
    var _pdHtml = '<div style="text-align:center;padding:3rem 2rem;">';
    _pdHtml += '<div style="font-size:2.5rem;color:var(--red,#c44);margin-bottom:1rem;">天命已尽</div>';
    _pdHtml += '<div style="font-size:1.1rem;color:var(--txt-s);margin-bottom:0.5rem;">' + escHtml(_pdName) + ' 薨逝</div>';
    _pdHtml += '<div style="font-size:0.9rem;color:var(--txt-d);margin-bottom:2rem;">' + escHtml(_pdReason) + '</div>';
    _pdHtml += '<div style="font-size:0.85rem;color:var(--txt-d);margin-bottom:2rem;">历经 ' + GM.turn + ' 回合 · ' + getTSText(GM.turn) + '</div>';
    _pdHtml += '<div style="display:flex;gap:1rem;justify-content:center;">';
    _pdHtml += '<button class="bt bp" onclick="doSaveGame()">保存存档</button>';
    _pdHtml += '<button class="bt bs" onclick="showMain()">返回主菜单</button>';
    _pdHtml += '</div></div>';
    showTurnResult(_pdHtml);
    delete GM._playerDead;
    delete GM._playerDeathReason;
    return;
  }

  // 回合结束前最后一次聚合：确保 七变量(national) 严格等于 各区划叶子之和
  // （因 AI 推演/各 engine.tick 都可能修改 division.population.mouths，需重新累计）
  try { if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggFinalE) { console.warn('[endTurn] final aggregate', _aggFinalE); }

  GM.busy=false;
  GM._endTurnBusy=false;
  } catch (error) {
    console.error('endTurn error:', error);
    toast('回合处理出错: ' + error.message);
    GM.busy = false;
    GM._endTurnBusy=false;
    var btn = _$("btn-end")||_$("btn-end-turn");
    if (btn) {
      btn.textContent = "\u9759\u5F85\u65F6\u53D8";
      btn.style.opacity = "1";
    }
    hideLoading();
  }
}

// 史记列表（带分页+搜索+导出）
// 史记列表（带分页+搜索+导出）
var _sjlPage=0,_sjlKw='',_sjlPageSize=8;
function renderShijiList(){
  var el=_$("shiji-list");if(!el)return;
  var all=(GM.shijiHistory||[]).slice().reverse();
  var kw=(_sjlKw||'').trim().toLowerCase();
  var filtered=kw?all.filter(function(sj){return (sj.shizhengji||'').toLowerCase().indexOf(kw)>=0||(sj.time||'').toLowerCase().indexOf(kw)>=0||String(sj.turn).indexOf(kw)>=0;}):all;
  var total=filtered.length;
  var pages=Math.ceil(total/_sjlPageSize)||1;
  if(_sjlPage>=pages)_sjlPage=pages-1;
  if(_sjlPage<0)_sjlPage=0;
  var slice=filtered.slice(_sjlPage*_sjlPageSize,(_sjlPage+1)*_sjlPageSize);
  var h='<div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;">';
  h+='<input id="sjl-kw" class="fd" style="flex:1;font-size:0.82rem" placeholder="搜索…" value="'+(_sjlKw||'').replace(/"/g,'&quot;')+'" oninput="_sjlKw=this.value;_sjlPage=0;renderShijiList()">';
  h+='<button class="bt bs bsm" onclick="_sjlExport()" title="导出">↓</button>';
  h+='</div>';
  if(!slice.length){h+='<div style="color:var(--txt-d);text-align:center;padding:2rem;">无匹配</div>';}
  else{
    h+=slice.map(function(sj){
      var idx=GM.shijiHistory.length-1-all.indexOf(sj);
      return '<div class="cd" style="cursor:pointer;margin-bottom:0.3rem" onclick="showTurnResult(GM.shijiHistory['+idx+'].html)">'+
        '<div style="display:flex;justify-content:space-between"><strong style="color:var(--gold-l)">T'+sj.turn+'</strong><span style="font-size:0.75rem;color:var(--txt-d)">'+sj.time+'</span></div>'+
        '<div style="font-size:0.75rem;color:var(--txt-d);margin-top:0.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+ escHtml(sj.shizhengji||'') +'</div></div>';
    }).join('');
  }
  h+='<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-top:0.4rem;">';
  h+='<button class="bt bs bsm" '+(_sjlPage<=0?'disabled':'')+' onclick="_sjlPage--;renderShijiList()">‹</button>';
  h+='<span style="font-size:0.78rem;color:var(--txt-s)">'+(_sjlPage+1)+' / '+pages+'&nbsp;('+total+'条)</span>';
  h+='<button class="bt bs bsm" '+(_sjlPage>=pages-1?'disabled':'')+' onclick="_sjlPage++;renderShijiList()">›</button>';
  h+='</div>';
  el.innerHTML=h;
}
function _sjlExport(){
  var txt=(GM.shijiHistory||[]).map(function(sj){return '[T'+sj.turn+'] '+sj.time+'\n'+(sj.shizhengji||'');}).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('已复制');}).catch(function(){_sjlDownload(txt);});}
  else _sjlDownload(txt);
}
function _sjlDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='shiji_'+(GM.saveName||'export')+'.txt';a.click();toast('已导出');
}
var _qijuPage=0,_qijuKw='',_qijuCat='all',_qijuPageSize=15;

/** 统一获取起居注条目的显示文本和类别 */
function _qijuNormalize(r) {
  var text = '', cat = r.category || '';
  // schema1: 回合结算 {edicts, xinglu, memorials}
  if (r.edicts) {
    var parts = [];
    if (r.edicts.political) parts.push('\u653F\uFF1A' + r.edicts.political);
    if (r.edicts.military) parts.push('\u519B\uFF1A' + r.edicts.military);
    if (r.edicts.diplomatic) parts.push('\u5916\uFF1A' + r.edicts.diplomatic);
    if (r.edicts.economic) parts.push('\u7ECF\uFF1A' + r.edicts.economic);
    if (r.edicts.other) parts.push('\u5176\u4ED6\uFF1A' + r.edicts.other);
    if (parts.length > 0) { text += parts.join('\n'); cat = cat || '\u8BCF\u4EE4'; }
    if (r.xinglu) { text += (text ? '\n' : '') + '\u3010\u884C\u6B62\u3011' + r.xinglu; if (!cat) cat = '\u884C\u6B62'; }
  }
  // schema2: AI叙事 {zhengwen}
  if (r.zhengwen) { text = r.zhengwen; cat = cat || '\u53D9\u4E8B'; }
  // schema3: 实时事件 {content}
  if (r.content && !text) {
    text = r.content;
    // 从content前缀推断类别
    if (!cat) {
      if (text.indexOf('\u3010\u9E3F\u96C1') >= 0 || text.indexOf('\u3010\u9A7F\u9012') >= 0) cat = '\u9E3F\u96C1';
      else if (text.indexOf('\u3010\u671D\u8BAE') >= 0 || text.indexOf('\u3010\u5E38\u671D') >= 0) cat = '\u671D\u8BAE';
      else if (text.indexOf('\u3010\u594F\u758F') >= 0 || text.indexOf('\u6279\u590D') >= 0) cat = '\u594F\u758F';
      else if (text.indexOf('\u3010\u5165\u4EAC') >= 0 || text.indexOf('\u4EFB\u547D') >= 0 || text.indexOf('\u7F62\u514D') >= 0) cat = '\u4EBA\u4E8B';
      else cat = '\u5176\u4ED6';
    }
  }
  return { text: text || '(无内容)', cat: cat || '\u5176\u4ED6' };
}

function renderQiju(){
  var el=_$("qiju-history");if(!el)return;
  var all=(GM.qijuHistory||[]).slice().reverse();
  var kw=(_qijuKw||'').trim().toLowerCase();
  var catFilter = _qijuCat || 'all';

  // 统一化+过滤
  var normalized = all.map(function(r) {
    var n = _qijuNormalize(r);
    return { raw: r, text: n.text, cat: n.cat, turn: r.turn, date: r.time || r.date || (typeof getTSText==='function'?getTSText(r.turn):'T'+(r.turn||'?')), annotation: r._annotation || '' };
  });
  var filtered = normalized;
  if (kw) filtered = filtered.filter(function(n) { return n.text.toLowerCase().indexOf(kw) >= 0 || n.date.toLowerCase().indexOf(kw) >= 0; });
  if (catFilter !== 'all') filtered = filtered.filter(function(n) { return n.cat === catFilter; });

  // 按回合分组
  var _byTurn = {};
  filtered.forEach(function(n) {
    var tk = n.turn || 0;
    if (!_byTurn[tk]) _byTurn[tk] = { date: n.date, items: [] };
    _byTurn[tk].items.push(n);
  });
  var _turns = Object.keys(_byTurn).sort(function(a,b) { return b - a; }); // 最近在前

  // 分页（按回合组数）
  var total = _turns.length;
  var pages = Math.ceil(total / _qijuPageSize) || 1;
  if (_qijuPage >= pages) _qijuPage = pages - 1;
  if (_qijuPage < 0) _qijuPage = 0;
  var pageTurns = _turns.slice(_qijuPage * _qijuPageSize, (_qijuPage + 1) * _qijuPageSize);

  var h = '';
  if (pageTurns.length === 0) {
    h = '<div style="color:var(--txt-d);text-align:center;padding:2rem;">\u6682\u65E0\u8BB0\u5F55</div>';
  } else {
    pageTurns.forEach(function(tk) {
      var group = _byTurn[tk];
      h += '<div style="margin-bottom:var(--space-3);">';
      h += '<div style="font-size:var(--text-xs);color:var(--gold-400);font-weight:var(--weight-bold);padding:var(--space-1) 0;border-bottom:1px solid var(--color-border-subtle);letter-spacing:0.08em;">\u2550 \u7B2C' + tk + '\u56DE\u5408 \u00B7 ' + escHtml(group.date) + ' \u2550</div>';
      group.items.forEach(function(n, ni) {
        var _catColors = {'\u8BCF\u4EE4':'var(--indigo-400)','\u594F\u758F':'var(--vermillion-400)','\u671D\u8BAE':'var(--purple,#9b59b6)','\u9E3F\u96C1':'var(--amber-400)','\u4EBA\u4E8B':'var(--celadon-400)','\u884C\u6B62':'var(--gold-400)','\u53D9\u4E8B':'var(--color-foreground-secondary)'};
        var _cc = _catColors[n.cat] || 'var(--ink-300)';
        h += '<div class="qiju-record" style="border-left-color:' + _cc + ';">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        h += '<span class="qiju-turn" style="color:' + _cc + ';">[' + escHtml(n.cat) + ']</span>';
        // 御批按钮
        var _ridx = (GM.qijuHistory||[]).indexOf(n.raw);
        h += '<button class="bt bsm" style="font-size:0.55rem;padding:0 3px;color:var(--vermillion-400);" onclick="_qijuAnnotate(' + _ridx + ')" title="\u5FA1\u6279">\u6279</button>';
        h += '</div>';
        h += '<div class="qiju-text wd-selectable">' + escHtml(n.text) + '</div>';
        if (n.annotation) h += '<div style="font-size:0.7rem;color:var(--vermillion-400);font-style:italic;margin-top:2px;padding-left:0.5rem;border-left:2px solid var(--vermillion-400);">\u5FA1\u6279\uFF1A' + escHtml(n.annotation) + '</div>';
        h += '</div>';
      });
      h += '</div>';
    });
  }
  // 分页控件
  h += '<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-top:var(--space-2);">';
  h += '<button class="bt bs bsm" ' + (_qijuPage <= 0 ? 'disabled' : '') + ' onclick="_qijuPage--;renderQiju();">\u2039</button>';
  h += '<span style="font-size:0.75rem;color:var(--txt-s);">' + (_qijuPage+1) + ' / ' + pages + ' (' + filtered.length + '\u6761)</span>';
  h += '<button class="bt bs bsm" ' + (_qijuPage >= pages-1 ? 'disabled' : '') + ' onclick="_qijuPage++;renderQiju();">\u203A</button>';
  h += '</div>';
  el.innerHTML = h;
  // v5·C·装饰 pending 人名
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(el); } catch(_){}
}

/** 御批——为起居注条目添加批注 */
function _qijuAnnotate(idx) {
  if (idx < 0 || !GM.qijuHistory || !GM.qijuHistory[idx]) return;
  showPrompt('\u5FA1\u6279\uFF1A', GM.qijuHistory[idx]._annotation || '', function(text) {
    if (text === null) return;
    GM.qijuHistory[idx]._annotation = text;
    renderQiju();
  });
}

function _qijuExport(){
  var txt = (GM.qijuHistory||[]).map(function(r) {
    var n = _qijuNormalize(r);
    var dt = r.time || r.date || ('T' + (r.turn||''));
    var ann = r._annotation ? '\n  御批：' + r._annotation : '';
    return '[T' + (r.turn||'') + '] ' + dt + ' [' + n.cat + ']\n' + n.text + ann;
  }).join('\n\n---\n\n');
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_qijuDownload(txt);}); }
  else _qijuDownload(txt);
}
function _qijuDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='qiju_'+(GM.saveName||'export')+'.txt';a.click();toast('\u5DF2\u5BFC\u51FA');
}

// ============================================================
//  Part 3：高级系统
// ============================================================

// ============================================================
//  游戏内科技树/市政树面板
// ============================================================
// enterGame后渲染侧边面板（科技/市政/人物志已移入renderGameState）
GameHooks.on('enterGame:after', function(){
  renderSidePanels();
});

function renderGameTech(){
  var el=_$("g-tech");if(!el||!GM.techTree)return;
  el.innerHTML=GM.techTree.map(function(t,i){
    var canUnlock=true;
    var costDesc=(t.costs||[]).map(function(c){var v=GM.vars[c.variable];var ok=v&&v.value>=c.amount;if(!ok)canUnlock=false;return "<span style=\"color:"+(ok?"var(--green)":"var(--red)")+";\">"+c.variable+":"+c.amount+(v?" ("+v.value+")":"")+"</span>";}).join(" ");
    if(t.prereqs)t.prereqs.forEach(function(pre){var pt=findTechByName(pre);if(!pt||!pt.unlocked)canUnlock=false;});
    var prereqDesc='';
    if(t.prereqs&&t.prereqs.length>0&&!t.unlocked){prereqDesc='<div style="font-size:0.68rem;color:var(--txt-d);">\u524D\u7F6E: '+t.prereqs.map(function(p){var pt=findTechByName(p);return '<span style="color:'+(pt&&pt.unlocked?'var(--green)':'var(--red)')+';">'+escHtml(p)+'</span>';}).join(', ')+'</div>';}
    return "<div class=\"cd\" style=\"border-left:3px solid "+(t.unlocked?"var(--green)":"var(--bdr)")+";\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+t.name+(t.era?' <span style=\"font-size:0.68rem;color:var(--txt-d);\">['+t.era+']</span>':'')+"</strong>"+(t.unlocked?"<span class=\"tg\" style=\"background:rgba(39,174,96,0.2);color:var(--green);\">\u2705</span>":canUnlock?"<button class=\"bt bp bsm\" onclick=\"unlockTech("+i+")\">\u89E3\u9501</button>":"")+"</div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+(t.desc||t.description||'')+"</div>"+prereqDesc+(!t.unlocked&&costDesc?"<div style=\"font-size:0.72rem;margin-top:0.2rem;\">\u6D88\u8017: "+costDesc+"</div>":"")+"</div>";
  }).join("")||"<div style=\"color:var(--txt-d);\">\u65E0</div>";
}
function unlockTech(i){
  var t=GM.techTree[i];if(!t||t.unlocked)return;
  var ok=true;(t.costs||[]).forEach(function(c){if(!GM.vars[c.variable]||GM.vars[c.variable].value<c.amount)ok=false;});
  if(!ok){toast("\u8D44\u6E90\u4E0D\u8DB3");return;}
  (t.costs||[]).forEach(function(c){GM.vars[c.variable].value-=c.amount;});
  t.unlocked=true;
  Object.entries(t.effect||{}).forEach(function(e){if(GM.vars[e[0]])GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+e[1],GM.vars[e[0]].min,GM.vars[e[0]].max);});
  addEB("\u79D1\u6280",t.name+"\u5DF2\u89E3\u9501");renderGameTech();renderGameState();toast("\u2705 "+t.name);
}

function renderGameCivic(){
  var el=_$("g-civic");if(!el||!GM.civicTree)return;
  el.innerHTML=GM.civicTree.map(function(c,i){
    var canAdopt=true;
    // 前置依赖检查（与科技树一致）
    if(c.prereqs&&c.prereqs.length>0){
      c.prereqs.forEach(function(pre){
        var pt=GM.civicTree.find(function(x){return x.name===pre;});
        if(!pt||!pt.adopted)canAdopt=false;
      });
    }
    var costDesc=(c.costs||[]).map(function(ct){var v=GM.vars[ct.variable];var ok=v&&v.value>=ct.amount;if(!ok)canAdopt=false;return "<span style=\"color:"+(ok?"var(--green)":"var(--red)")+";\">"+ct.variable+":"+ct.amount+"</span>";}).join(" ");
    var prereqDesc='';
    if(c.prereqs&&c.prereqs.length>0&&!c.adopted){
      prereqDesc='<div style="font-size:0.68rem;color:var(--txt-d);">\u524D\u7F6E: '+c.prereqs.map(function(p){var pt=GM.civicTree.find(function(x){return x.name===p;});return '<span style="color:'+(pt&&pt.adopted?'var(--green)':'var(--red)')+';">'+escHtml(p)+'</span>';}).join(', ')+'</div>';
    }
    return "<div class=\"cd\" style=\"border-left:3px solid "+(c.adopted?"var(--green)":"var(--bdr)")+";\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+c.name+"</strong>"+(c.adopted?"<span class=\"tg\" style=\"background:rgba(39,174,96,0.2);color:var(--green);\">\u2705</span>":canAdopt?"<button class=\"bt bp bsm\" onclick=\"adoptCivic("+i+")\">\u63A8\u884C</button>":"")+"</div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+(c.desc||c.description||'')+"</div>"+prereqDesc+(!c.adopted&&costDesc?"<div style=\"font-size:0.72rem;margin-top:0.2rem;\">\u6D88\u8017: "+costDesc+"</div>":"")+"</div>";
  }).join("")||"<div style=\"color:var(--txt-d);\">\u65E0</div>";
}
function adoptCivic(i){
  var c=GM.civicTree[i];if(!c||c.adopted)return;
  // 前置依赖检查
  if(c.prereqs&&c.prereqs.length>0){
    var prereqOk=true;
    c.prereqs.forEach(function(pre){var pt=GM.civicTree.find(function(x){return x.name===pre;});if(!pt||!pt.adopted)prereqOk=false;});
    if(!prereqOk){toast("\u524D\u7F6E\u653F\u7B56\u672A\u63A8\u884C");return;}
  }
  var ok=true;(c.costs||[]).forEach(function(ct){if(!GM.vars[ct.variable]||GM.vars[ct.variable].value<ct.amount)ok=false;});
  if(!ok){toast("\u8D44\u6E90\u4E0D\u8DB3");return;}
  (c.costs||[]).forEach(function(ct){GM.vars[ct.variable].value-=ct.amount;});
  c.adopted=true;
  Object.entries(c.effect||{}).forEach(function(e){if(GM.vars[e[0]])GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+e[1],GM.vars[e[0]].min,GM.vars[e[0]].max);});
  addEB("\u5E02\u653F",c.name+"\u5DF2\u63A8\u884C");renderGameCivic();renderGameState();toast("\u2705 "+c.name);
}

// ============================================================
//  人物志
// ============================================================
var _rwSearch='',_rwFaction='all',_rwRole='all',_rwSort='loyalty',_rwShowDead=false;

function renderRenwu(){
  var el=_$("rw-grid");var cnt=_$("rw-cnt");if(!el)return;

  // 填充派系下拉（首次）
  var _facSel = _$('rw-faction');
  if (_facSel && _facSel.options.length <= 1 && GM.facs) {
    GM.facs.forEach(function(f) {
      var opt = document.createElement('option');
      opt.value = f.name; opt.textContent = f.name;
      _facSel.appendChild(opt);
    });
  }

  // 从GM.chars构建完整角色列表（不只是allCharacters）
  var _all = (GM.chars||[]).slice();
  // 补充allCharacters中有但chars中没有的
  (GM.allCharacters||[]).forEach(function(ac) {
    if (!_all.find(function(c){return c.name===ac.name;})) _all.push(ac);
  });

  // 规范化 alive 字段——未显式设为 false 的一律视为在世（修复老数据 alive=undefined 被误判为 dead 的 bug）
  _all.forEach(function(c) {
    if (c.alive !== false && c.alive !== true) c.alive = true;
  });

  // 筛选
  var filtered = _all;
  if (!_rwShowDead) filtered = filtered.filter(function(c) { return c.alive !== false; });
  if (_rwSearch) {
    var kw = _rwSearch.toLowerCase();
    filtered = filtered.filter(function(c) { return (c.name||'').toLowerCase().indexOf(kw)>=0 || (c.officialTitle||c.title||'').toLowerCase().indexOf(kw)>=0 || (c.faction||'').toLowerCase().indexOf(kw)>=0; });
  }
  if (_rwFaction !== 'all') filtered = filtered.filter(function(c) { return c.faction === _rwFaction; });
  if (_rwRole !== 'all') {
    filtered = filtered.filter(function(c) {
      if (_rwRole === 'civil') return (c.administration||0) > (c.military||0) && !c.spouse;
      if (_rwRole === 'military') return (c.military||0) >= (c.administration||0) && !c.spouse;
      if (_rwRole === 'harem') return c.spouse;
      if (_rwRole === 'none') return !c.officialTitle && !c.spouse;
      return true;
    });
  }

  // 排序
  filtered.sort(function(a,b) {
    // 已故排最后
    if (a.alive === false && b.alive !== false) return 1;
    if (a.alive !== false && b.alive === false) return -1;
    // 玩家角色排最前
    if (a.isPlayer && !b.isPlayer) return -1;
    if (!a.isPlayer && b.isPlayer) return 1;
    var va = (a[_rwSort]||50), vb = (b[_rwSort]||50);
    return vb - va;
  });

  if(cnt)cnt.textContent=filtered.length + '/' + _all.length;

  // 按派系分组（如有多个派系）
  var _playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'京城');
  var _facGroups = {};
  filtered.forEach(function(c) { var fk = c.faction || '\u65E0\u6D3E\u7CFB'; if (!_facGroups[fk]) _facGroups[fk] = []; _facGroups[fk].push(c); });
  var _facKeys = Object.keys(_facGroups);
  // 玩家派系排前
  var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
  _facKeys.sort(function(a,b) { if (a === _playerFac) return -1; if (b === _playerFac) return 1; return _facGroups[b].length - _facGroups[a].length; });

  var html = '';
  var _useGroups = _facKeys.length > 1 && _rwFaction === 'all';

  if (_useGroups) {
    _facKeys.forEach(function(fk) {
      var chars = _facGroups[fk];
      var _facColor = 'var(--ink-300)';
      if (GM.facs) { var _f = GM.facs.find(function(f){return f.name===fk;}); if (_f && _f.color) _facColor = _f.color; }
      html += '<div style="grid-column:1/-1;font-size:var(--text-xs);color:' + _facColor + ';font-weight:var(--weight-bold);padding:var(--space-1) 0;border-bottom:1px solid var(--color-border-subtle);margin-top:var(--space-2);">' + escHtml(fk) + ' (' + chars.length + ')</div>';
      chars.forEach(function(c) { html += _rwRenderCard(c); });
    });
  } else {
    filtered.forEach(function(c) { html += _rwRenderCard(c); });
  }

  el.innerHTML = html || '<div style="color:var(--txt-d);grid-column:1/-1;text-align:center;padding:2rem;">\u65E0\u5339\u914D\u89D2\u8272</div>';
}

/** 渲染单个人物卡片 */
function _rwRenderCard(c) {
  var _isDead = c.alive === false;
  var _ch = (typeof findCharByName === 'function') ? findCharByName(c.name) : c;
  if (!_ch) _ch = c;
  var _playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'京城');

  // 官职徽章——fallback 顺序扩展：官职 → 头衔 → role → 后宫 → 布衣
  var _offBadge = '';
  if (_ch._mourning) _offBadge = '<div style="font-size:0.58rem;color:var(--ink-300);">\u4E01\u5FE7</div>';
  else if (_ch._retired) _offBadge = '<div style="font-size:0.58rem;color:var(--ink-300);">\u81F4\u4ED5</div>';
  else if (_ch.officialTitle) _offBadge = '<div style="font-size:0.58rem;color:var(--gold-400);">' + escHtml(_ch.officialTitle) + '</div>';
  else if (_ch.title) _offBadge = '<div style="font-size:0.58rem;color:var(--gold-400);">' + escHtml(_ch.title) + '</div>';
  else if (_ch.role) _offBadge = '<div style="font-size:0.58rem;color:var(--ink-300);">' + escHtml(_ch.role) + '</div>';
  else if (_ch.occupation) _offBadge = '<div style="font-size:0.58rem;color:var(--ink-300);">' + escHtml(_ch.occupation) + '</div>';
  else if (_ch.spouse) _offBadge = '<div style="font-size:0.58rem;color:var(--purple,#9b59b6);">\u540E\u5BAB</div>';
  else _offBadge = '<div style="font-size:0.58rem;color:var(--ink-300);">\u5E03\u8863</div>';

  // 忠诚条——显示保留 1 位小数
  var _loy = _ch.loyalty != null ? _ch.loyalty : 50;
  var _loyClr = _loy > 70 ? 'var(--celadon-400)' : _loy < 30 ? 'var(--vermillion-400)' : 'var(--color-foreground-muted)';
  var _loyDisp = (typeof _fmtNum1 === 'function') ? _fmtNum1(_loy) : Math.round(_loy);
  var _loyBar = '<div style="font-size:0.55rem;color:' + _loyClr + ';">\u5FE0' + _loyDisp + '</div>'
    + '<div style="height:3px;background:var(--color-border-subtle);border-radius:2px;margin-top:2px;"><div style="height:100%;width:' + Math.min(100, parseFloat(_loy)||0) + '%;background:' + _loyClr + ';border-radius:2px;"></div></div>';

  // 关键属性
  var _topStat = '';
  // 展示最高维度标签
  var _topDims = [
    { k:'military', v:_ch.military||0, lb:'\u6B66' },
    { k:'administration', v:_ch.administration||0, lb:'\u653F' },
    { k:'management', v:_ch.management||0, lb:'\u7BA1' },
    { k:'intelligence', v:_ch.intelligence||0, lb:'\u667A' },
    { k:'diplomacy', v:_ch.diplomacy||0, lb:'\u4EA4' }
  ];
  _topDims.sort(function(a,b){return b.v - a.v;});
  var _f1 = (typeof _fmtNum1 === 'function') ? _fmtNum1 : function(v){ return Math.round(v); };
  _topStat = _topDims[0].lb + _f1(_topDims[0].v);
  _topStat = '\u667A' + _f1(_ch.intelligence != null ? _ch.intelligence : 50) + ' ' + _topStat;

  // 位置
  var _locTag = '';
  if (_ch.location && _ch.location !== _playerLoc && !_isDead) {
    _locTag = '<div style="font-size:0.55rem;color:var(--amber-400);">' + escHtml(_ch.location.slice(0,4)) + '</div>';
  }

  // 派系色
  var _facClr = 'var(--gold-d)';
  if (_ch.faction && GM.facs) { var _ff = GM.facs.find(function(f){return f.name===_ch.faction;}); if (_ff && _ff.color) _facClr = _ff.color; }

  // 已故标识
  var _deadStyle = _isDead ? 'opacity:0.45;filter:grayscale(0.8);' : '';
  var _deadTag = _isDead ? '<div style="font-size:0.55rem;color:var(--vermillion-400);font-weight:700;">\u6545</div>' : '';

  // 始终用姓名字符串——索引会读到 allCharacters 简表（缺能力值）
  var _nameArg = "'" + (c.name||'').replace(/'/g,"\\'") + "'";
  // 人物志 tab 点击——打开"人物志完整页"（openCharRenwuPage），降级回 viewRenwu
  var _clickCall = '(typeof openCharRenwuPage===\'function\'?openCharRenwuPage:viewRenwu)(' + _nameArg + ')';

  return '<div class="cd" style="text-align:center;cursor:pointer;padding:0.5rem;' + _deadStyle + '" onclick="' + _clickCall + '">'
    + '<div style="width:38px;height:38px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:1rem;margin:0 auto 0.2rem;border:2px solid ' + _facClr + ';">'
    + ((_ch.portrait)?'<img src="'+escHtml(_ch.portrait)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">':'\uD83D\uDC64')
    + '</div>'
    + '<div style="font-size:0.8rem;font-weight:700;color:var(--gold-l);">' + escHtml(c.name) + '</div>'
    + _offBadge + _deadTag + _locTag
    + '<div style="font-size:0.55rem;color:var(--color-foreground-muted);">' + _topStat + '</div>'
    + _loyBar
    + '</div>';
}
function viewRenwu(i){
  var ch;
  if(typeof i === 'string'){
    // 按名字查找
    ch = (GM.chars||[]).find(function(c){return c.name===i;}) || (GM.allCharacters||[]).find(function(c){return c.name===i;});
  } else {
    ch = (GM.allCharacters||GM.chars||[])[i];
  }
  if(!ch) return;

  // 有效属性（含特质加成）
  var effInt = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'intelligence') : (ch.intelligence||0);
  var effVal = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'valor') : (ch.valor||0);
  var effAdm = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'administration') : (ch.administration||0);
  var effMng = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'management') : (ch.management||0);
  var effCha = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'charisma') : (ch.charisma||0);
  var effDip = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'diplomacy') : (ch.diplomacy||0);
  var effMil = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'military') : (ch.military||0);
  var effBen = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'benevolence') : (ch.benevolence||0);

  var html = '<div style="max-width:600px;margin:auto;">';

  // 头部：名字+称号+阵营
  var _isPlayerChar = ch.isPlayer || (P.playerInfo && P.playerInfo.characterName === ch.name);
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">';
  html += '<div><span style="font-size:1.3rem;font-weight:700;color:var(--gold);">' + escHtml(ch.name) + '</span>';
  if(ch.title) html += ' <span style="color:var(--txt-s);font-size:0.85rem;">' + escHtml(ch.title) + '</span>';
  html += '</div>';
  if(ch.faction) html += '<span style="font-size:0.78rem;padding:0.15rem 0.5rem;background:var(--bg-3);border-radius:10px;color:var(--blue);">' + escHtml(ch.faction) + '</span>';
  html += '</div>';

  // ── 快捷操作栏 ──
  if (!_isPlayerChar && ch.alive !== false) {
    html += '<div style="display:flex;gap:var(--space-1);margin-bottom:0.6rem;flex-wrap:wrap;">';
    var _safeName = escHtml(ch.name).replace(/'/g, "\\'");
    html += '<button class="bt bsm" style="font-size:0.7rem;" onclick="GM.wenduiTarget=\'' + _safeName + '\';switchGTab(null,\'gt-wendui\');">\u95EE\u5BF9</button>';
    html += '<button class="bt bsm" style="font-size:0.7rem;" onclick="GM._pendingLetterTo=\'' + _safeName + '\';switchGTab(null,\'gt-letter\');">\u4F20\u4E66</button>';
    html += '<button class="bt bsm" style="font-size:0.7rem;" onclick="switchGTab(null,\'gt-office\');">\u5B98\u5236</button>';
    html += '</div>';
  }
  if (ch.alive === false) {
    html += '<div style="font-size:0.8rem;color:var(--vermillion-400);margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:rgba(231,76,60,0.1);border-radius:4px;">\u5DF2\u6545' + (ch.deathReason ? '\uFF1A' + escHtml(ch.deathReason) : '') + (ch.deathTurn ? ' (T' + ch.deathTurn + ')' : '') + '</div>';
  }

  // ── 身份档案（基本信息上移） ──
  var _idTags = [];
  if (ch.age) _idTags.push({ l: '\u5E74\u9F84', v: ch.age + '\u5C81' });
  if (ch.gender) _idTags.push({ l: '\u6027\u522B', v: ch.gender });
  if (ch.birthplace) _idTags.push({ l: '\u7C4D\u8D2F', v: ch.birthplace });
  if (ch.ethnicity) _idTags.push({ l: '\u6C11\u65CF', v: ch.ethnicity });
  if (ch.faith) _idTags.push({ l: '\u4FE1\u4EF0', v: ch.faith });
  if (ch.culture) _idTags.push({ l: '\u6587\u5316', v: ch.culture });
  if (ch.learning) _idTags.push({ l: '\u5B66\u8BC6', v: ch.learning });
  if (ch.stance) _idTags.push({ l: '\u7ACB\u573A', v: ch.stance });
  if (ch.party) _idTags.push({ l: '\u515A\u6D3E', v: ch.party + (ch.partyRank ? '(' + ch.partyRank + ')' : '') });
  if (ch.speechStyle) _idTags.push({ l: '\u8BED\u98CE', v: ch.speechStyle });
  if (ch.family) _idTags.push({ l: '\u5BB6\u65CF', v: ch.family + ({imperial:'\u7687\u65CF',noble:'\u4E16\u5BB6',gentry:'\u58EB\u65CF',common:'\u5BD2\u95E8'}[ch.familyTier]||'') });
  if (_idTags.length > 0) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:0.6rem;">';
    _idTags.forEach(function(t) {
      html += '<span style="font-size:0.65rem;padding:1px 6px;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:3px;color:var(--color-foreground-secondary);">' + t.l + '\uFF1A' + escHtml(t.v) + '</span>';
    });
    html += '</div>';
  }

  // 官制信息+仕途（嵌入人物志详情页）
  if (typeof _offRenderCareerHTML === 'function' && !_isPlayerChar) {
    var _careerHtml = _offRenderCareerHTML(ch.name);
    if (_careerHtml) {
      html += '<div style="margin-bottom:0.8rem;padding:0.5rem;background:var(--color-elevated);border-radius:6px;border:1px solid var(--color-border-subtle);">';
      html += '<div style="font-size:0.78rem;color:var(--gold-400);font-weight:700;margin-bottom:0.3rem;letter-spacing:0.08em;">\u5B98\u5236\u4E0E\u4ED5\u9014</div>';
      html += _careerHtml;
      html += '</div>';
    }
  }

  // 双重身份概览（所有角色通用——公职身份+私人身份）
  (function() {
    // 公职身份
    var _pubRole = ch.officialTitle || ch.title || '';
    var _pubFaction = ch.faction || '';
    // 判断是否势力领袖
    var _isLeader = false;
    if (GM.facs) _isLeader = GM.facs.some(function(f) { return f.leader === ch.name; });
    if (_isPlayerChar) {
      var _sc3 = findScenarioById && findScenarioById(GM.sid);
      _pubRole = (_sc3 ? _sc3.role || '' : '') || _pubRole;
      if (P.playerInfo && P.playerInfo.factionName) _pubFaction = P.playerInfo.factionName + '\u4E4B\u4E3B';
      else if (_isLeader) _pubFaction += '\u4E4B\u4E3B';
    } else if (_isLeader) {
      _pubFaction += '\u4E4B\u4E3B';
    }
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem;">';
    html += '<div style="padding:0.5rem;background:var(--bg-3);border-radius:6px;border-left:3px solid var(--gold-d);">';
    html += '<div style="font-size:0.7rem;color:var(--gold-d);letter-spacing:0.1em;margin-bottom:0.2rem;">\u516C\u804C\u8EAB\u4EFD</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt);">' + escHtml(_pubRole || '\u5E03\u8863') + '</div>';
    if (_pubFaction) html += '<div style="font-size:0.72rem;color:var(--txt-s);">' + escHtml(_pubFaction) + '</div>';
    if (ch.party) html += '<div style="font-size:0.68rem;color:var(--ink-300);">\u515A\uFF1A' + escHtml(ch.party) + '</div>';
    html += '</div>';
    html += '<div style="padding:0.5rem;background:var(--bg-3);border-radius:6px;border-left:3px solid var(--purple,#9b59b6);">';
    html += '<div style="font-size:0.7rem;color:var(--purple,#9b59b6);letter-spacing:0.1em;margin-bottom:0.2rem;">\u79C1\u4EBA\u8EAB\u4EFD</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt);">' + escHtml(ch.name) + (ch.age ? '\uFF0C' + ch.age + '\u5C81' : '') + '</div>';
    if (ch.personality) html += '<div style="font-size:0.72rem;color:var(--txt-s);">' + escHtml(ch.personality) + '</div>';
    if (ch.personalGoal) html += '<div style="font-size:0.68rem;color:var(--ink-300);">\u6240\u6C42\uFF1A' + escHtml(ch.personalGoal.slice(0,30)) + '</div>';
    html += '</div></div>';
    // 玩家角色专属：近期内省记录
    if (_isPlayerChar) {
      var _recentInners = (GM.shijiHistory || []).slice(-3).filter(function(s) { return s.playerInner; }).reverse();
      if (_recentInners.length > 0) {
        html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--purple,#9b59b6);font-size:0.85rem;margin-bottom:0.3rem;">\u8FD1\u65E5\u5FC3\u7EEA</div>';
        _recentInners.forEach(function(s) {
          html += '<div style="font-size:0.75rem;color:var(--txt-s);font-style:italic;padding:0.2rem 0.4rem;border-left:2px solid var(--purple,#9b59b6);margin-bottom:0.2rem;">';
          html += '<span style="color:var(--txt-d);">' + (s.time || '') + '</span> ' + escHtml(s.playerInner);
          html += '</div>';
        });
        html += '</div>';
      }
    }
  })();

  // 外貌描写（在属性条之前）
  if (ch.appearance) {
    html += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:6px;font-size:0.8rem;color:var(--txt-s);line-height:1.6;font-style:italic;border-left:2px solid var(--bg-4);">' + escHtml(ch.appearance) + '</div>';
  }

  // 家族与门第 + 家谱树
  if (ch.family) {
    var _fam = GM.families ? GM.families[ch.family] : null;
    var _tierName = typeof getFamilyTierName === 'function' ? getFamilyTierName(ch.familyTier) : '';
    var _tierColor = {'imperial':'var(--gold)','noble':'#e67e22','gentry':'var(--blue)','common':'var(--txt-d)'}[ch.familyTier] || 'var(--txt-d)';

    html += '<div class="fam-tree">';
    // 标题栏：家族名+门第+声望
    html += '<div class="fam-tree-title"><span style="color:' + _tierColor + ';">' + escHtml(ch.family) + (_tierName ? ' <span style="font-size:0.7rem;font-weight:400;">(' + _tierName + ')</span>' : '') + '</span>';
    if (_fam) html += '<span class="fam-tree-renown">\u58F0\u671B ' + Math.round(_fam.renown || 0) + '</span>';
    html += '</div>';

    // 家谱树（简易3代视图）
    if (_fam) {
      // 找到当前角色的血亲
      var _myRels = typeof getBloodRelatives === 'function' ? getBloodRelatives(ch.name) : [];
      // 构建三代树：父辈→自己一代→子辈
      var _parents = _myRels.filter(function(r) { return r.relation === '\u7236\u5B50' || r.relation === '\u6BCD\u5B50'; });
      var _siblings = _myRels.filter(function(r) { return r.relation === '\u5144\u5F1F' || r.relation === '\u5144\u59B9'; });
      var _childRels = (ch.children || []).map(function(cn) { return { name: cn }; });
      // 配偶
      var _spouses = (GM.chars || []).filter(function(c2) { return c2.alive !== false && c2.spouse && c2.family !== ch.family; });
      // 这里用关联spouse（如果当前角色是玩家）
      var _mySpouses = [];
      if (ch.isPlayer || (P.playerInfo && P.playerInfo.characterName === ch.name)) {
        _mySpouses = (GM.chars || []).filter(function(c2) { return c2.spouse && c2.alive !== false; });
      }

      // 渲染函数
      var _nodeHtml = function(name, extra) {
        var c2 = findCharByName(name);
        var cls = 'fam-tree-name';
        if (name === ch.name) cls += ' current';
        if (c2 && c2.alive === false) cls += ' dead';
        if (c2 && c2.spouse) cls += ' spouse-node';
        var titleStr = c2 ? (c2.title || '') : '';
        return '<div class="fam-tree-node"><span class="' + cls + '" onclick="closeGenericModal();viewRenwu(\'' + name.replace(/'/g, "\\'") + '\')">' + escHtml(name) + '</span><span class="fam-tree-role">' + escHtml(titleStr) + (extra || '') + '</span></div>';
      };

      // 父辈行
      if (_parents.length > 0) {
        html += '<div class="fam-tree-gen">';
        _parents.forEach(function(p) { html += _nodeHtml(p.name, ' (' + p.relation + ')'); });
        html += '</div><div class="fam-tree-conn">\u2502</div>';
      }

      // 本代行（自己+配偶+兄弟）
      html += '<div class="fam-tree-gen">';
      _siblings.forEach(function(s) { html += _nodeHtml(s.name, ''); });
      html += _nodeHtml(ch.name, '');
      _mySpouses.forEach(function(sp) { html += _nodeHtml(sp.name, ' ' + (typeof getHaremRankName === 'function' ? getHaremRankName(sp.spouseRank) : '')); });
      html += '</div>';

      // 子辈行
      if (_childRels.length > 0 || (_mySpouses.length > 0 && _mySpouses.some(function(sp) { return sp.children && sp.children.length > 0; }))) {
        html += '<div class="fam-tree-conn">\u2502</div><div class="fam-tree-gen">';
        var _allChildNames = [];
        _childRels.forEach(function(cr) { if (_allChildNames.indexOf(cr.name) < 0) _allChildNames.push(cr.name); });
        _mySpouses.forEach(function(sp) { (sp.children || []).forEach(function(cn) { if (_allChildNames.indexOf(cn) < 0) _allChildNames.push(cn); }); });
        _allChildNames.forEach(function(cn) {
          var _childCh = findCharByName(cn);
          var _motherInfo = '';
          if (_childCh) {
            var _mom = (GM.chars || []).find(function(m) { return m.children && m.children.indexOf(cn) >= 0 && m.spouse; });
            if (_mom) _motherInfo = '\u6BCD:' + _mom.name;
          }
          html += _nodeHtml(cn, _motherInfo);
        });
        html += '</div>';
      }

      // 分支信息
      if (_fam.branches && _fam.branches.length > 1) {
        html += '<div style="font-size:0.68rem;color:var(--txt-d);margin-top:0.3rem;">\u5BB6\u652F\uFF1A';
        _fam.branches.forEach(function(b, bi) {
          html += (bi > 0 ? ' | ' : '') + '<span style="color:' + (bi === 0 ? _tierColor : 'var(--txt-s)') + ';">' + escHtml(b.name) + '(' + b.members.length + '\u4EBA)</span>';
        });
        html += '</div>';
      }

      // 家族关联势力
      if (GM.facs || GM.parties) {
        var _facLink = (GM.facs || []).find(function(f) { return f.name && ch.family && f.name.indexOf(ch.family.replace(/\u6C0F$/, '')) >= 0; });
        if (_facLink) html += '<div style="font-size:0.68rem;color:var(--txt-d);margin-top:0.2rem;">\u5173\u8054\u52BF\u529B\uFF1A' + escHtml(_facLink.name) + '</div>';
      }
    }
    html += '</div>';
  }

  // 核心数值条（10项 5×2网格）——显示四舍五入 1 位小数
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;margin-bottom:0.8rem;">';
  var _f1 = (typeof _fmtNum1 === 'function') ? _fmtNum1 : function(v){ return v==null?0:v; };
  var bars = [
    {label:'\u5FE0\u8BDA',val:(ch.loyalty!=null?ch.loyalty:50),color:'var(--celadon-400)'},
    {label:'\u667A\u529B',val:effInt,color:'var(--indigo-400)',bonus:effInt-(ch.intelligence||0)},
    {label:'\u6B66\u52C7',val:effVal,color:'var(--vermillion-400)',bonus:effVal-(ch.valor||0)},
    {label:'\u519B\u4E8B',val:effMil,color:'var(--vermillion-400)',bonus:effMil-(ch.military||0)},
    {label:'\u653F\u52A1',val:effAdm,color:'var(--gold-400)',bonus:effAdm-(ch.administration||0)},
    {label:'\u7BA1\u7406',val:effMng,color:'#d4a04c',bonus:effMng-(ch.management||0)},
    {label:'\u9B45\u529B',val:effCha,color:'#e84393',bonus:effCha-(ch.charisma||0)},
    {label:'\u5916\u4EA4',val:effDip,color:'var(--amber-400)',bonus:effDip-(ch.diplomacy||0)},
    {label:'\u4EC1\u5FB7',val:effBen,color:'var(--celadon-400)',bonus:effBen-(ch.benevolence||0)},
    {label:'\u91CE\u5FC3',val:(ch.ambition!=null?ch.ambition:50),color:'var(--purple,#9b59b6)'},
    {label:'\u538B\u529B',val:ch.stress||0,color:(ch.stress||0)>=50?'var(--vermillion-400)':'var(--ink-300)'}
  ];
  bars.forEach(function(b){
    var bonusTag = (b.bonus && b.bonus!==0) ? '<span style="color:'+(b.bonus>0?'var(--green)':'var(--red)')+';font-size:0.65rem;">('+(b.bonus>0?'+':'')+_f1(b.bonus)+')</span>' : '';
    html += '<div style="font-size:0.75rem;color:var(--txt-s);">' + b.label + ' ' + _f1(b.val) + bonusTag;
    html += '<div style="height:4px;background:var(--bg-4);border-radius:2px;margin-top:2px;"><div style="height:100%;width:'+Math.min(100,Math.max(0,parseFloat(b.val)||0))+'%;background:'+b.color+';border-radius:2px;"></div></div></div>';
  });
  html += '</div>';

  // 特质展示
  if (ch.traits && ch.traits.length > 0 && typeof TRAIT_LIBRARY !== 'undefined') {
    html += '<div style="margin-top:0.5rem;padding:0.4rem 0.5rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:4px;">';
    html += '<div style="font-size:0.7rem;color:var(--gold-400);margin-bottom:0.2rem;">特质</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
    ch.traits.forEach(function(tid) {
      var t = TRAIT_LIBRARY[tid]; if (!t) return;
      var cat = TRAIT_CATEGORIES && TRAIT_CATEGORIES[t.category];
      var col = cat ? cat.color : '#888';
      html += '<span title="' + escHtml(t.behaviorTendency || t.description || '') + '" style="font-size:0.65rem;padding:1px 6px;background:' + col + '22;color:' + col + ';border:1px solid ' + col + ';border-radius:10px;cursor:help;">' + escHtml(t.name || tid) + '</span>';
    });
    html += '</div></div>';
  }

  // 个人目标
  if(ch.personalGoal){
    html += '<div style="padding:0.4rem 0.6rem;background:var(--bg-3);border-radius:6px;margin-bottom:0.6rem;font-size:0.82rem;"><span style="color:var(--gold-d);">目标：</span>' + escHtml(ch.personalGoal) + '</div>';
  }

  // 文事作品集
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _myWorks = GM.culturalWorks.filter(function(w) { return w.author === ch.name; });
    if (_myWorks.length > 0) {
      html += '<div style="margin-bottom:0.6rem;padding:0.5rem 0.6rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:6px;">';
      html += '<div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.4rem;">文事作品（' + _myWorks.length + '）</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.25rem;">';
      _myWorks.slice(-8).reverse().forEach(function(w) {
        var realIdx = GM.culturalWorks.indexOf(w);
        var genreLbl = (typeof _WENYUAN_GENRES !== 'undefined' ? _WENYUAN_GENRES[w.genre] : w.genre) || '';
        var tier = w.isPreserved ? '★' : '';
        html += '<div style="padding:0.25rem 0.4rem;background:var(--bg-2);border-radius:3px;cursor:pointer;font-size:0.75rem;" onclick="closeGenericModal();_showWorkDetail(' + realIdx + ')" title="点击查看全文">';
        html += '<span style="color:var(--gold-400);">' + tier + '《' + escHtml(w.title || '?') + '》</span>';
        html += ' <span style="color:var(--txt-d);font-size:0.68rem;">[' + genreLbl + (w.subtype ? '·' + escHtml(w.subtype) : '') + '] T' + (w.turn||0) + ' 品' + (w.quality||0);
        if (w.mood) html += ' · ' + escHtml(w.mood);
        html += '</span>';
        html += '</div>';
      });
      if (_myWorks.length > 8) html += '<div style="font-size:0.65rem;color:var(--txt-d);text-align:center;">…另有 ' + (_myWorks.length - 8) + ' 篇（可在文苑标签查阅）</div>';
      html += '</div></div>';
    }
  }

  // 特质卡片
  if(ch.traitIds && ch.traitIds.length>0 && P.traitDefinitions){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">性格特质</div><div style="display:flex;flex-wrap:wrap;gap:0.2rem;">';
    ch.traitIds.forEach(function(tid){
      var def = P.traitDefinitions.find(function(t){return t.id===tid;});
      if(!def) return;
      var oppLabel = '';
      if(def.opposite){ var opp=P.traitDefinitions.find(function(t){return t.id===def.opposite;}); if(opp) oppLabel='↔'+opp.name; }
      var attrParts = [];
      if(def.attrMod){ var an={valor:'武',intelligence:'智',administration:'政',military:'军'}; Object.keys(def.attrMod).forEach(function(k){attrParts.push((an[k]||k)+(def.attrMod[k]>0?'+':'')+def.attrMod[k]);}); }
      html += '<span style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.15rem 0.4rem;background:var(--bg-4);border-radius:10px;font-size:0.75rem;">';
      html += '<b style="color:var(--gold-l);">'+escHtml(def.name)+'</b>';
      if(attrParts.length) html += '<span style="color:var(--blue);font-size:0.65rem;">'+attrParts.join(' ')+'</span>';
      if(oppLabel) html += '<span style="color:var(--txt-d);font-size:0.6rem;">'+oppLabel+'</span>';
      html += '</span>';
    });
    html += '</div>';
    // 行为倾向
    var hints = ch.traitIds.map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;}); return d&&d.aiHint?d.aiHint:null;}).filter(Boolean);
    if(hints.length) html += '<div style="font-size:0.75rem;color:var(--txt-s);margin-top:0.3rem;"><span style="color:var(--gold-d);">行为倾向：</span>'+escHtml(hints.join('；'))+'</div>';
    html += '</div>';
  }

  // 压力详情
  if((ch.stress||0) >= 20 && typeof StressSystem !== 'undefined'){
    html += '<div style="padding:0.3rem 0.6rem;background:rgba(192,57,43,0.1);border-radius:6px;margin-bottom:0.6rem;font-size:0.78rem;">';
    html += '<span style="color:var(--red);">'+StressSystem.getStressLabel(ch)+'</span> ('+ch.stress+'/100)';
    // 压力触发和缓解
    if(ch.traitIds && P.traitDefinitions){
      var stOn=[],stOff=[];
      ch.traitIds.forEach(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;}); if(d){if(d.stressOn)stOn=stOn.concat(d.stressOn);if(d.stressOff)stOff=stOff.concat(d.stressOff);}});
      if(stOn.length) html += '<div style="margin-top:0.2rem;">\u5FCC\uFF1A'+escHtml(stOn.join('\u3001'))+'</div>';
      if(stOff.length) html += '<div>\u597D\uFF1A'+escHtml(stOff.join('\u3001'))+'</div>';
    }
    html += '</div>';
  }

  // 血缘关系（来自家族系统）
  if (typeof getBloodRelatives === 'function') {
    var _bRels = getBloodRelatives(ch.name);
    if (_bRels.length > 0) {
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:#e67e22;font-size:0.85rem;margin-bottom:0.3rem;">\u8840\u7F18\u5173\u7CFB</div>';
      _bRels.forEach(function(br) {
        html += '<div style="display:flex;justify-content:space-between;padding:0.15rem 0;font-size:0.78rem;border-bottom:1px solid var(--bg-4);">';
        html += '<span style="cursor:pointer;color:var(--blue);text-decoration:underline;" onclick="closeGenericModal();viewRenwu(\'' + br.name.replace(/'/g, "\\'") + '\')">' + escHtml(br.name) + '</span>';
        html += '<span style="color:#e67e22;">' + escHtml(br.relation) + '</span></div>';
      });
      html += '</div>';
    }
  }

  // 人际关系网（亲疏度）
  if(typeof AffinityMap !== 'undefined'){
    var rels = AffinityMap.getRelations(ch.name);
    if(rels.length > 0){
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">\u4EBA\u9645\u5173\u7CFB</div>';
      rels.forEach(function(r){
        var col = r.value>=30?'var(--green)':r.value<=-30?'var(--red)':'var(--txt-s)';
        var label = r.value>=50?'\u83AB\u9006':r.value>=25?'\u4EB2\u8FD1':r.value<=-50?'\u6B7B\u654C':r.value<=-25?'\u4E0D\u7766':'\u4E00\u822C';
        html += '<div style="display:flex;justify-content:space-between;padding:0.15rem 0;font-size:0.78rem;border-bottom:1px solid var(--bg-4);">';
        html += '<span>'+escHtml(r.name)+'</span><span style="color:'+col+';">'+label+' ('+r.value+')</span></div>';
      });
      html += '</div>';
    }
  }

  // 好感分解（对玩家）
  if(typeof OpinionSystem !== 'undefined'){
    var playerChar = findCharByName(P.playerInfo.characterName);
    if(playerChar && playerChar.name !== ch.name){
      var baseOp = OpinionSystem.calculateBase(ch, playerChar);
      var totalOp = OpinionSystem.getTotal(ch, playerChar);
      var eventOp = totalOp - baseOp;
      html += '<div style="font-size:0.78rem;margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:var(--bg-3);border-radius:6px;">';
      html += '<span style="color:var(--gold-d);">对君主好感：</span>';
      html += '<span style="color:'+(totalOp>=0?'var(--green)':'var(--red)')+';">'+totalOp+'</span>';
      html += ' <span style="color:var(--txt-d);">(基础'+baseOp+(eventOp!==0?'，事件'+(eventOp>0?'+':'')+eventOp:'')+')</span>';
      html += '</div>';
    }
  }

  // 角色弧线时间轴
  if(GM.characterArcs && GM.characterArcs[ch.name] && GM.characterArcs[ch.name].length > 0){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">经历</div>';
    GM.characterArcs[ch.name].slice(-8).forEach(function(arc){
      var icon = (typeof tmIcon==='function')?({appointment:tmIcon('memorial',12),dismissal:tmIcon('close',12),death:tmIcon('close',12),inheritance:tmIcon('prestige',12),war:tmIcon('troops',12),autonomous:tmIcon('person',12),achievement:tmIcon('policy',12),event:tmIcon('event',12)}[arc.type]||'•'):'•';
      html += '<div style="font-size:0.75rem;padding:0.15rem 0;border-left:2px solid var(--gold-d);padding-left:0.5rem;margin-bottom:0.15rem;">';
      html += '<span style="color:var(--txt-d);">T'+arc.turn+'</span> '+icon+' '+escHtml(arc.desc)+'</div>';
    });
    html += '</div>';
  }

  // 生平简介
  if(ch.bio){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">生平</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.8;text-indent:2em;padding:0.5rem 0.7rem;background:var(--bg-2);border-radius:6px;border-left:2px solid var(--gold-d);">'+escHtml(ch.bio)+'</div></div>';
  }

  // 角色描写
  if(ch.description && ch.description !== ch.bio){
    html += '<div style="font-size:0.8rem;color:var(--txt-d);line-height:1.6;margin-bottom:0.5rem;font-style:italic;">'+escHtml(ch.description)+'</div>';
  }

  // 人生历练
  if(ch._lifeExp && ch._lifeExp.length > 0){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">人生历练</div>';
    // 按领域分组统计
    var domainCounts = {};
    ch._lifeExp.forEach(function(e) { domainCounts[e.domain] = (domainCounts[e.domain]||0) + 1; });
    var domainTags = [];
    var domainIcons = (typeof tmIcon==='function')?{'军旅':tmIcon('troops',12),'治理':tmIcon('office',12),'仕途':tmIcon('memorial',12),'求学':tmIcon('chronicle',12),'师承':tmIcon('person',12),'帝师':tmIcon('prestige',12),'蛰伏':tmIcon('scroll',12),'暮年':tmIcon('history',12),'磨难':tmIcon('unrest',12)}:{};
    for(var dk in domainCounts) domainTags.push((domainIcons[dk]||'•') + dk + '×' + domainCounts[dk]);
    html += '<div style="font-size:0.75rem;color:var(--txt-s);margin-bottom:0.3rem;">' + domainTags.join(' ') + '</div>';
    // 最近几条
    ch._lifeExp.slice(-4).reverse().forEach(function(e){
      html += '<div style="font-size:0.72rem;padding:0.12rem 0;color:var(--txt-d);border-left:2px solid var(--bg-4);padding-left:0.4rem;margin-bottom:0.1rem;">';
      html += (domainIcons[e.domain]||'') + ' ' + escHtml(e.desc) + '</div>';
    });
    html += '</div>';
  }

  // （培养栽培 UI 已删除——人物成长应由推演驱动）

  // 当前情绪
  if(ch._mood && ch._mood !== '平'){
    var moodMap = {'喜':'〔喜〕心情愉悦','怒':'〔怒〕满腔怒火','忧':'〔忧〕忧心忡忡','惧':'〔惧〕惴惴不安','恨':'〔恨〕满怀怨恨','敬':'〔敬〕心怀敬意'};
    var moodColors = {'喜':'var(--color-success)','怒':'var(--vermillion-400)','忧':'#e67e22','惧':'var(--indigo-400)','恨':'var(--vermillion-400)','敬':'var(--celadon-400)'};
    html += '<div style="padding:0.3rem 0.6rem;background:var(--bg-3);border-radius:6px;margin-bottom:0.6rem;font-size:0.82rem;color:'+(moodColors[ch._mood]||'var(--txt-s)')+';">'+(moodMap[ch._mood]||ch._mood)+'</div>';
  }

  // NPC个人记忆
  if((ch._memory && ch._memory.length > 0) || (ch._memArchive && ch._memArchive.length > 0)){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">此人记忆</div>';
    var emotionIcons = {'喜':'〔喜〕','怒':'〔怒〕','忧':'〔忧〕','惧':'〔惧〕','恨':'〔恨〕','敬':'〔敬〕','平':'〔平〕'};
    // 归档记忆（折叠）
    if(ch._memArchive && ch._memArchive.length > 0){
      html += '<div style="font-size:0.7rem;color:var(--txt-d);padding:0.2rem 0.4rem;background:var(--bg-4);border-radius:4px;margin-bottom:0.3rem;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';">'+tmIcon('history',11)+' 往事归档（'+ch._memArchive.length+'段）▸</div>';
      html += '<div style="display:none;font-size:0.7rem;color:var(--txt-d);padding:0.3rem;background:var(--bg-2);border-radius:4px;margin-bottom:0.3rem;">';
      ch._memArchive.forEach(function(a) { html += '<div style="margin-bottom:0.2rem;">T'+a.period+'：'+escHtml(a.summary)+'</div>'; });
      html += '</div>';
    }
    // 活跃记忆
    if(ch._memory && ch._memory.length > 0){
      ch._memory.slice(-8).reverse().forEach(function(m){
        html += '<div style="font-size:0.75rem;padding:0.15rem 0;border-bottom:1px solid var(--bg-4);">';
        html += '<span style="color:var(--txt-d);">T'+m.turn+'</span> '+(emotionIcons[m.emotion]||'•')+' '+escHtml(m.event);
        if(m.who) html += ' <span style="color:var(--blue);font-size:0.65rem;">→'+escHtml(m.who)+'</span>';
        html += '</div>';
      });
    }
    html += '</div>';
  }

  // 对他人的印象
  if(ch._impressions){
    var impEntries = [];
    for(var pn in ch._impressions){
      var iv = ch._impressions[pn];
      if(Math.abs(iv.favor) >= 2) impEntries.push({name:pn, favor:iv.favor, events:iv.events||[]});
    }
    if(impEntries.length > 0){
      impEntries.sort(function(a,b){return Math.abs(b.favor)-Math.abs(a.favor);});
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">对他人印象</div>';
      impEntries.forEach(function(ie){
        var col = ie.favor >= 5 ? 'var(--green)' : ie.favor <= -5 ? 'var(--red)' : 'var(--txt-s)';
        var label = ie.favor >= 15 ? '感恩戴德' : ie.favor >= 8 ? '心存感激' : ie.favor >= 3 ? '略有好感' : ie.favor <= -15 ? '恨之入骨' : ie.favor <= -8 ? '怀恨在心' : ie.favor <= -3 ? '心生不满' : '无感';
        html += '<div style="display:flex;justify-content:space-between;padding:0.12rem 0;font-size:0.75rem;border-bottom:1px solid var(--bg-4);">';
        html += '<span>'+escHtml(ie.name)+'</span><span style="color:'+col+';">'+label+'('+Math.round(ie.favor)+')</span></div>';
      });
      html += '</div>';
    }
  }

  // 基本信息汇总
  // 基本信息标签已移至头部"身份档案"区

  // ── 家庭关系（妻妾+子嗣+亲属——后宫继承仅势力领袖） ──
  var _isLeader2 = false;
  if (GM.facs) _isLeader2 = GM.facs.some(function(f) { return f.leader === ch.name; });
  if (ch.spouse) {
    var _rkDisplay = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
    html += '<div style="margin-bottom:0.6rem;padding:0.5rem;background:linear-gradient(135deg,rgba(232,67,147,0.05),rgba(253,121,168,0.05));border-radius:6px;border-left:3px solid #e84393;">';
    html += '<div style="font-weight:600;color:#e84393;font-size:0.85rem;margin-bottom:0.3rem;">\uD83D\uDC90 ' + (_rkDisplay[ch.spouseRank] || '\u59BB\u5BA4') + '</div>';
    if (ch.motherClan) html += '<div style="font-size:0.78rem;color:var(--txt-s);margin-bottom:0.2rem;">\u6BCD\u65CF\uFF1A<span style="color:var(--blue);">' + escHtml(ch.motherClan) + '</span></div>';
    if (ch.children && ch.children.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--txt-s);margin-bottom:0.2rem;">\u5B50\u5973\uFF1A';
      ch.children.forEach(function(cn) {
        var childCh = findCharByName(cn);
        html += '<span style="cursor:pointer;color:var(--gold-l);text-decoration:underline;" onclick="closeGenericModal();viewRenwu(\'' + cn.replace(/'/g, "\\'") + '\')">' + escHtml(cn) + '</span> ';
        if (childCh && childCh.age) html += '<span style="font-size:0.65rem;color:var(--txt-d);">(' + childCh.age + '\u5C81)</span> ';
        // 标注太子
        if (GM.harem && GM.harem.heirs && GM.harem.heirs[0] === cn) html += '<span style="font-size:0.6rem;color:var(--gold);">\u{1F451}\u592A\u5B50</span> ';
      });
      html += '</div>';
    }
    // 怀孕中
    if (GM.harem && GM.harem.pregnancies) {
      var _isPreg = GM.harem.pregnancies.find(function(p) { return p.motherName === ch.name; });
      if (_isPreg) {
        html += '<div style="font-size:0.78rem;color:#e84393;margin-bottom:0.2rem;">\u{1F930} \u6709\u5B55\u4E2D</div>';
      }
    }
    html += '</div>';
  }
  // 势力领袖（含玩家）查看时显示完整后宫和继承人；普通角色不显示后宫
  if ((_isPlayerChar || _isLeader2) && GM.chars) {
    var _mySpouses = GM.chars.filter(function(c) { return c.alive !== false && c.spouse; });
    if (_mySpouses.length > 0) {
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:#e84393;font-size:0.85rem;margin-bottom:0.3rem;">\uD83C\uDFDB\uFE0F \u540E\u5BAE</div>';
      var _rkOrder = {'empress':0,'queen':0,'consort':1,'concubine':2,'attendant':3};
      _mySpouses.sort(function(a,b){return (_rkOrder[a.spouseRank]||9) - (_rkOrder[b.spouseRank]||9);});
      _mySpouses.forEach(function(sp) {
        var _rkD = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
        html += '<div style="display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.78rem;border-bottom:1px solid var(--bg-4);cursor:pointer;" onclick="closeGenericModal();viewRenwu(\'' + sp.name.replace(/'/g, "\\'") + '\')">';
        html += '<span><span style="color:#e84393;">' + (_rkD[sp.spouseRank] || '') + '</span> ' + escHtml(sp.name) + '</span>';
        var _childCount = sp.children ? sp.children.length : 0;
        html += '<span style="color:var(--txt-d);">' + (sp.motherClan || '') + (_childCount > 0 ? ' \u5B50\u00D7' + _childCount : '') + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    // 继承人
    if (GM.harem && GM.harem.heirs && GM.harem.heirs.length > 0) {
      html += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.6rem;background:var(--bg-3);border-radius:6px;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.2rem;">\uD83D\uDC51 \u7EE7\u627F\u987A\u5E8F</div>';
      html += '<div style="font-size:0.78rem;color:var(--txt-s);">' + GM.harem.heirs.map(function(h, i) { return '<span style="color:' + (i === 0 ? 'var(--gold)' : 'var(--txt-d)') + ';">' + (i + 1) + '. ' + escHtml(h) + '</span>'; }).join(' \u2192 ') + '</div>';
      html += '</div>';
    }
  }
  // 子嗣（非leader且有children时显示——leader的children已在后宫区显示）
  if (!_isLeader2 && !_isPlayerChar && ch.children && ch.children.length > 0) {
    html += '<div style="margin-bottom:0.4rem;">';
    html += '<div style="font-weight:600;color:var(--gold);font-size:0.8rem;margin-bottom:0.2rem;">\u5B50\u55E3</div>';
    html += '<div style="font-size:0.75rem;">';
    ch.children.forEach(function(cn) {
      var childCh = findCharByName(cn);
      html += '<span style="cursor:pointer;color:var(--gold-l);text-decoration:underline;margin-right:0.4rem;" onclick="closeGenericModal();viewRenwu(\'' + cn.replace(/'/g,"\\'") + '\')">' + escHtml(cn) + '</span>';
      if (childCh && childCh.age) html += '<span style="font-size:0.65rem;color:var(--txt-d);">(' + childCh.age + '\u5C81)</span> ';
    });
    html += '</div></div>';
  }
  // 亲属（非leader额外显示）
  if (!_isLeader2 && !_isPlayerChar) {
    var _kinfolk2 = (typeof getBloodRelatives === 'function') ? getBloodRelatives(ch.name) : [];
    if (_kinfolk2.length > 0) {
      html += '<div style="margin-bottom:0.4rem;">';
      html += '<div style="font-weight:600;color:var(--celadon-400);font-size:0.8rem;margin-bottom:0.2rem;">\u4EB2\u5C5E</div>';
      html += '<div style="font-size:0.75rem;">';
      _kinfolk2.slice(0,10).forEach(function(r) {
        html += '<span style="cursor:pointer;color:var(--celadon-400);margin-right:0.3rem;" onclick="closeGenericModal();viewRenwu(\'' + r.name.replace(/'/g,"\\'") + '\')">' + escHtml(r.name) + '(' + escHtml(r.relation) + ')</span>';
      });
      html += '</div></div>';
    }
  }

  html += '</div>';
  // 动态标题含头衔
  var _modalTitle = ch.name;
  if(ch.title) _modalTitle += ' · ' + ch.title;
  if(ch.spouse) {
    var _rkT = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
    _modalTitle += ' · ' + (_rkT[ch.spouseRank] || '\u59BB\u5BA4');
  }
  openGenericModal(_modalTitle, html);
}

// ============================================================
// ── 阶层详情面板 ──
function openClassDetailPanel() {
  if (!GM.classes || GM.classes.length === 0) { toast('\u6682\u65E0\u9636\u5C42\u6570\u636E'); return; }
  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';
  GM.classes.forEach(function(cl) {
    var sat = Math.round(cl.satisfaction || 50);
    var inf = cl.influence || cl.classInfluence || 0;
    var satClr = sat > 65 ? 'var(--green)' : sat < 35 ? 'var(--red)' : 'var(--gold)';
    html += '<div style="background:var(--bg-2);border-radius:6px;padding:0.8rem;margin-bottom:0.8rem;border-left:3px solid ' + satClr + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">';
    html += '<span style="font-weight:700;font-size:0.95rem;">' + escHtml(cl.name) + '</span>';
    html += '<div style="display:flex;gap:0.5rem;font-size:0.75rem;">';
    html += '<span style="color:' + satClr + ';">\u6EE1\u610F ' + sat + '</span>';
    html += '<span style="color:var(--blue);">\u5F71\u54CD ' + inf + '</span>';
    html += '</div></div>';
    // 详细信息网格
    var fields = [];
    if (cl.size) fields.push(['\u89C4\u6A21', cl.size]);
    if (cl.economicRole) fields.push(['\u7ECF\u6D4E\u89D2\u8272', cl.economicRole]);
    if (cl.status) fields.push(['\u6CD5\u5F8B\u5730\u4F4D', cl.status]);
    if (cl.mobility) fields.push(['\u6D41\u52A8\u6027', cl.mobility]);
    if (cl.privileges) fields.push(['\u7279\u6743', cl.privileges]);
    if (cl.obligations) fields.push(['\u4E49\u52A1', cl.obligations]);
    if (cl.unrestThreshold) fields.push(['\u4E0D\u6EE1\u9608\u503C', cl.unrestThreshold]);
    if (fields.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.78rem;margin-bottom:0.4rem;">';
      fields.forEach(function(f) {
        html += '<div><span style="color:var(--txt-d);">' + f[0] + ':</span> ' + escHtml(String(f[1])) + '</div>';
      });
      html += '</div>';
    }
    if (cl.demands) {
      html += '<div style="font-size:0.78rem;margin-bottom:0.3rem;"><span style="color:var(--red);">\u8BC9\u6C42:</span> ' + escHtml(cl.demands) + '</div>';
    }
    if (cl.description) {
      html += '<div style="font-size:0.76rem;color:var(--txt-s);line-height:1.5;">' + escHtml(cl.description) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u9636\u5C42\u8BE6\u60C5', html, null);
}

// ── 党派详情面板 ──
function openPartyDetailPanel() {
  if (!GM.parties || GM.parties.length === 0) { toast('\u6682\u65E0\u515A\u6D3E\u6570\u636E'); return; }
  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';
  GM.parties.forEach(function(p) {
    var inf = p.influence || p.strength || 0;
    var stClr = p.status === '\u6D3B\u8DC3' ? 'var(--green)' : p.status === '\u5F0F\u5FAE' ? 'var(--gold)' : p.status === '\u88AB\u538B\u5236' ? 'var(--red)' : 'var(--txt-d)';
    html += '<div style="background:var(--bg-2);border-radius:6px;padding:0.8rem;margin-bottom:0.8rem;border-left:3px solid var(--purple);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">';
    html += '<div><span style="font-weight:700;font-size:0.95rem;">' + escHtml(p.name) + '</span>';
    if (p.status) html += ' <span style="font-size:0.7rem;color:' + stClr + ';">' + escHtml(p.status) + '</span>';
    html += '</div>';
    html += '<span style="color:var(--purple);font-size:0.82rem;">\u5F71\u54CD ' + inf + '</span>';
    html += '</div>';
    // 核心信息
    var fields = [];
    if (p.leader) fields.push(['\u9996\u9886', p.leader]);
    if (p.ideology) fields.push(['\u7ACB\u573A', p.ideology]);
    if (p.rivalParty) fields.push(['\u5BBF\u654C', p.rivalParty]);
    if (p.org) fields.push(['\u7EC4\u7EC7\u5EA6', p.org]);
    if (p.base) fields.push(['\u652F\u6301\u7FA4\u4F53', p.base]);
    if (p.members) fields.push(['\u6838\u5FC3\u6210\u5458', p.members]);
    if (fields.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.78rem;margin-bottom:0.4rem;">';
      fields.forEach(function(f) {
        html += '<div><span style="color:var(--txt-d);">' + f[0] + ':</span> ' + escHtml(String(f[1])) + '</div>';
      });
      html += '</div>';
    }
    // 目标与议程
    var goals = [];
    if (p.currentAgenda) goals.push('\u5F53\u524D\u8BAE\u7A0B: ' + p.currentAgenda);
    if (p.shortGoal) goals.push('\u77ED\u671F\u76EE\u6807: ' + p.shortGoal);
    if (p.longGoal) goals.push('\u957F\u671F\u8FFD\u6C42: ' + p.longGoal);
    if (goals.length > 0) {
      html += '<div style="font-size:0.78rem;margin-bottom:0.3rem;">';
      goals.forEach(function(g) { html += '<div>' + escHtml(g) + '</div>'; });
      html += '</div>';
    }
    // 政策立场标签
    if (p.policyStance) {
      var stances = Array.isArray(p.policyStance) ? p.policyStance : [p.policyStance];
      html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">';
      stances.forEach(function(s) {
        html += '<span style="font-size:0.68rem;background:var(--bg-3);color:var(--txt-s);padding:1px 6px;border-radius:3px;">' + escHtml(s) + '</span>';
      });
      html += '</div>';
    }
    if (p.description) {
      html += '<div style="font-size:0.76rem;color:var(--txt-s);line-height:1.5;">' + escHtml(p.description) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u515A\u6D3E\u8BE6\u60C5', html, null);
}

// ── 军事力量详情面板 ──
function openMilitaryDetailPanel() {
  var armies = (GM.armies || []).filter(function(a){return !a.destroyed;});
  if (armies.length === 0) { toast('\u6682\u65E0\u519B\u961F\u6570\u636E'); return; }

  // 按 armyType 分组
  var grouped = {};
  armies.forEach(function(a) {
    var t = a.armyType || a.type || '\u5176\u4ED6';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(a);
  });

  var totalSoldiers = armies.reduce(function(s,a){return s+(a.soldiers||a.size||a.strength||0);},0);
  var totalArmies = armies.length;
  var avgMorale = armies.reduce(function(s,a){return s+(a.morale||50);},0) / totalArmies;
  var avgTraining = armies.reduce(function(s,a){return s+(a.training||50);},0) / totalArmies;

  // 类型图标映射
  var typeIcons = {
    '\u7981\u519B': '\uD83C\uDFF0', '\u8FB9\u519B': '\u2694\uFE0F', '\u6C34\u5E08': '\u2693',
    '\u9A91\u5175': '\uD83D\uDC0E', '\u6B65\u5175': '\u2694\uFE0F', '\u706B\u5668\u5175': '\uD83D\uDCA5',
    '\u571F\u53F8\u5175': '\uD83C\uDF04', '\u6C11\u5175': '\u26CF\uFE0F', '\u5BB6\u4E01': '\uD83D\uDEE1\uFE0F',
    '\u5176\u4ED6': '\u2694\uFE0F'
  };

  var html = '<div class="military-detail-wrap" style="padding:1rem;max-height:80vh;overflow-y:auto;">';

  // ═══ 总览卡片 ═══
  html += '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.15),rgba(139,46,37,0.1));border:1px solid var(--gold-d);border-radius:8px;padding:0.8rem;margin-bottom:1rem;display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;">';
  html += '<div><div style="font-size:0.64rem;color:var(--txt-d);">\u603B\u519B\u961F</div><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">' + totalArmies + '</div></div>';
  html += '<div><div style="font-size:0.64rem;color:var(--txt-d);">\u603B\u5175\u529B</div><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">' + totalSoldiers.toLocaleString() + '</div></div>';
  html += '<div><div style="font-size:0.64rem;color:var(--txt-d);">\u5E73\u5747\u58EB\u6C14</div><div style="font-size:1.1rem;font-weight:700;color:' + (avgMorale>65?'var(--green)':avgMorale<40?'var(--red)':'var(--gold)') + ';">' + Math.round(avgMorale) + '</div></div>';
  html += '<div><div style="font-size:0.64rem;color:var(--txt-d);">\u5E73\u5747\u8BAD\u7EC3</div><div style="font-size:1.1rem;font-weight:700;color:' + (avgTraining>65?'var(--green)':avgTraining<40?'var(--red)':'var(--gold)') + ';">' + Math.round(avgTraining) + '</div></div>';
  html += '</div>';

  // ═══ 分组展示 ═══
  Object.keys(grouped).forEach(function(groupName) {
    var list = grouped[groupName];
    var gTotal = list.reduce(function(s,a){return s+(a.soldiers||a.size||a.strength||0);},0);
    var icon = typeIcons[groupName] || '\u2694\uFE0F';
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<div style="font-size:0.82rem;font-weight:700;color:var(--gold-400);margin-bottom:0.5rem;padding:4px 8px;background:rgba(184,154,83,0.08);border-left:3px solid var(--gold-d);border-radius:3px;">';
    html += icon + ' ' + escHtml(groupName) + ' <span style="font-size:0.68rem;color:var(--txt-d);font-weight:400;">(' + list.length + '\u652F\u00B7\u5408\u8BA1' + gTotal.toLocaleString() + ')</span>';
    html += '</div>';

    list.forEach(function(a) {
      var sol = a.soldiers || a.size || a.strength || 0;
      var mor = a.morale || 0, tra = a.training || 0, loy = a.loyalty || 50, ctrl = a.control || 50;
      var morClr = mor>65?'var(--green)':mor<40?'var(--red)':'var(--gold)';
      var traClr = tra>65?'var(--green)':tra<40?'var(--red)':'var(--gold)';
      var loyClr = loy>65?'var(--green)':loy<40?'var(--red)':'var(--gold)';
      var ctrlClr = ctrl>70?'var(--green)':ctrl<45?'var(--red)':'var(--gold)';
      var quality = a.quality || '';
      var qualClr = /精锐|精兵/.test(quality)?'var(--gold-400)':/普通|一般/.test(quality)?'var(--txt-s)':/弱|老/.test(quality)?'var(--red)':'var(--txt-d)';

      html += '<div style="background:var(--bg-2);border-radius:6px;padding:0.7rem;margin-bottom:0.6rem;border-left:3px solid ' + morClr + ';">';

      // 标题行：名称 + 兵力 + 品质
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;gap:0.5rem;">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-weight:700;font-size:0.92rem;color:var(--gold);">' + escHtml(a.name||'\u65E0\u540D') + '</div>';
      if (quality) html += '<div style="font-size:0.68rem;color:' + qualClr + ';margin-top:2px;">' + escHtml(quality) + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;flex-shrink:0;">';
      html += '<div style="font-size:1.05rem;font-weight:700;color:var(--gold);">' + sol.toLocaleString() + '</div>';
      html += '<div style="font-size:0.6rem;color:var(--txt-d);">\u5175</div>';
      html += '</div>';
      html += '</div>';

      // 统帅+驻地
      var metaLines = [];
      if (a.commander) metaLines.push(['\uD83E\uDD34 \u7EDF\u5E05', (a.commanderTitle?a.commanderTitle+'\u00B7':'')+a.commander]);
      if (a.garrison || a.location) metaLines.push(['\uD83D\uDCCD \u9A7B\u5730', String(a.garrison||a.location)]);
      if (a.activity) metaLines.push(['\uD83D\uDCCB \u52A8\u6001', a.activity]);
      if (a.ethnicity) metaLines.push(['\uD83C\uDFF4 \u65CF\u7FA4', a.ethnicity]);
      if (a.equipmentCondition) metaLines.push(['\uD83D\uDEE1\uFE0F \u88C5\u5907', a.equipmentCondition]);
      if (metaLines.length > 0) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:0.72rem;margin-bottom:0.5rem;">';
        metaLines.forEach(function(m) {
          html += '<div><span style="color:var(--txt-d);">' + m[0] + ':</span> <span style="color:var(--txt);">' + escHtml(String(m[1])) + '</span></div>';
        });
        html += '</div>';
      }

      // 四项状态条：士气/训练/忠诚/控制
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:0.5rem;">';
      [['\u58EB\u6C14',mor,morClr],['\u8BAD\u7EC3',tra,traClr],['\u5FE0\u8BDA',loy,loyClr],['\u63A7\u5236',ctrl,ctrlClr]].forEach(function(s) {
        html += '<div style="text-align:center;">';
        html += '<div style="font-size:0.62rem;color:var(--txt-d);">' + s[0] + '</div>';
        html += '<div style="height:4px;background:var(--bg-3);border-radius:2px;margin:2px 0;overflow:hidden;"><div style="height:100%;width:' + s[1] + '%;background:' + s[2] + ';transition:width 0.3s;"></div></div>';
        html += '<div style="font-size:0.68rem;color:' + s[2] + ';font-weight:600;">' + s[1] + '</div>';
        html += '</div>';
      });
      html += '</div>';

      // 兵种构成
      if (Array.isArray(a.composition) && a.composition.length > 0) {
        html += '<div style="margin-bottom:0.5rem;">';
        html += '<div style="font-size:0.64rem;color:var(--txt-d);margin-bottom:3px;">\u5175\u79CD\u6784\u6210</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        a.composition.forEach(function(c) {
          if (!c || !c.type) return;
          html += '<div style="font-size:0.68rem;background:var(--bg-3);border:1px solid var(--gold-d);border-radius:10px;padding:2px 8px;">';
          html += '<span style="color:var(--txt);">' + escHtml(c.type) + '</span>';
          html += ' <span style="color:var(--gold);font-weight:600;">' + (c.count||0).toLocaleString() + '</span>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      }

      // 装备
      if (Array.isArray(a.equipment) && a.equipment.length > 0) {
        html += '<div style="margin-bottom:0.5rem;">';
        html += '<div style="font-size:0.64rem;color:var(--txt-d);margin-bottom:3px;">\u88C5\u5907\u6E05\u5355</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:3px;">';
        a.equipment.forEach(function(e) {
          if (!e || !e.name) return;
          var condClr = e.condition==='\u7CBE\u826F'?'var(--green)':e.condition==='\u4E00\u822C'?'var(--txt-s)':e.condition==='\u7F3A\u635F'||e.condition==='\u788E'?'var(--red)':'var(--txt-d)';
          html += '<div style="font-size:0.68rem;padding:2px 6px;background:var(--bg-3);border-radius:3px;display:flex;justify-content:space-between;gap:4px;">';
          html += '<span style="color:var(--txt);">' + escHtml(e.name) + '</span>';
          html += '<span><span style="color:var(--gold);">' + (e.count||0).toLocaleString() + '</span>';
          if (e.condition) html += ' <span style="color:' + condClr + ';font-size:0.6rem;">' + escHtml(e.condition) + '</span>';
          html += '</span>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      }

      // 岁饷
      if (Array.isArray(a.salary) && a.salary.length > 0) {
        html += '<div style="margin-bottom:0.5rem;">';
        html += '<div style="font-size:0.64rem;color:var(--txt-d);margin-bottom:3px;">\u5C81\u9972</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;font-size:0.7rem;">';
        a.salary.forEach(function(s) {
          if (!s || !s.resource) return;
          html += '<span style="color:var(--txt);"><span style="color:var(--txt-d);">' + escHtml(s.resource) + ':</span> <span style="color:var(--gold);font-weight:600;">' + (s.amount||0).toLocaleString() + '</span> <span style="color:var(--txt-d);font-size:0.62rem;">' + escHtml(s.unit||'') + '</span></span>';
        });
        html += '</div>';
        html += '</div>';
      }

      // 描述
      if (a.description) {
        html += '<div style="font-size:0.7rem;color:var(--txt-s);line-height:1.5;padding-top:4px;border-top:1px dashed var(--bg-4);">' + escHtml(a.description) + '</div>';
      }

      html += '</div>';
    });
    html += '</div>';
  });

  html += '</div>';
  openGenericModal('\u2694\uFE0F \u519B\u4E8B\u8BE6\u60C5\u00B7\u90E8\u961F\u4E0E\u88C5\u5907', html, null);
}

//  左侧面板扩展：阶层/党派/官制消耗
// ============================================================
function renderSidePanels(){
  var gl=_$("gl");if(!gl)return;

  // 清除上一次追加的侧面板内容（防止重复调用导致内容翻倍）
  var _old = document.getElementById('side-panels-ext');
  if (_old) _old.remove();
  var _wrap = document.createElement('div');
  _wrap.id = 'side-panels-ext';

  // 将后续所有 gl.appendChild 替换为追加到 _wrap 内
  var gl_real = gl;
  gl = _wrap;

  // 势力一览
  if(GM.facs&&GM.facs.length>0){
    var fp=document.createElement("div");fp.style.marginBottom="0.8rem";
    fp.innerHTML="<div class=\"pt\">\u2694 \u52BF\u529B\u683C\u5C40 <span style=\"font-size:0.65rem;color:var(--txt-d);font-weight:400;\">"+GM.facs.length+"\u4E2A</span></div>"+GM.facs.map(function(f){
      var attClr=f.attitude==='\u53CB\u597D'||f.attitude==='\u8054\u76DF'?'var(--green)':f.attitude==='\u654C\u5BF9'||f.attitude==='\u4EA4\u6218'||f.attitude==='\u654C\u89C6'?'var(--red)':f.attitude==='\u9644\u5C5E'||f.attitude==='\u5B97\u4E3B'||f.attitude==='\u671D\u8D21'?'var(--blue)':'var(--txt-d)';
      var str=f.strength||50;
      var milStr=f.militaryStrength?' \u5175'+f.militaryStrength:'';
      // 类型标签
      var typeTag=f.type?'<span style="font-size:0.55rem;color:var(--ink-300);margin-left:2px;">'+escHtml(f.type)+'</span>':'';
      // 封臣/宗主标签
      var _vassalTag='';
      if(f.liege)_vassalTag=' <span style="font-size:0.55rem;color:var(--blue);border:1px solid var(--blue);border-radius:3px;padding:0 3px;">\u81E3\u2192'+escHtml(String(f.liege))+'</span>';
      else if(f.vassals&&f.vassals.length>0)_vassalTag=' <span style="font-size:0.55rem;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:0 3px;">\u5B97\u4E3B('+f.vassals.length+')</span>';
      // 颜色条
      var facColor = f.color || attClr;
      // 首领信息
      var leaderLine = '';
      if (f.leader) {
        leaderLine = '<div style="font-size:0.6rem;color:var(--txt-d);">'
          + escHtml(f.leader) + (f.leaderTitle ? '(' + escHtml(f.leaderTitle) + ')' : '')
          + (f.territory ? ' \u00B7 ' + escHtml(String(f.territory)) : '') + '</div>';
      }
      // 目标/文化
      var extraLine = '';
      var extras = [];
      if (f.goal) extras.push('\u2691' + escHtml(String(f.goal)));
      if (f.mainstream) extras.push(escHtml(String(f.mainstream)));
      if (f.resources) extras.push(escHtml(String(f.resources)));
      if (extras.length > 0) extraLine = '<div style="font-size:0.58rem;color:var(--ink-300);margin-top:1px;">' + extras.join(' \u00B7 ') + '</div>';
      return '<div style="margin-bottom:0.45rem;border-left:2px solid '+facColor+';padding-left:0.4rem;">'
        +'<div style="display:flex;justify-content:space-between;font-size:0.78rem;">'
        +'<span>'+(f.name||'')+typeTag+_vassalTag+(f.attitude?' <span style="font-size:0.6rem;color:'+attClr+';">'+f.attitude+'</span>':'')+'</span>'
        +'<span style="color:'+attClr+';">'+str+milStr+'</span></div>'
        +'<div class="rb"><div class="rf" style="width:'+str+'%;background:'+facColor+';"></div></div>'
        +leaderLine+extraLine+'</div>';
    }).join("");
    // 势力间关系摘要
    if(GM.factionRelations&&GM.factionRelations.length>0){
      var _frHtml='<div style="margin-top:0.3rem;font-size:0.65rem;color:var(--txt-d);border-top:1px solid var(--bg-4);padding-top:0.3rem;">';
      GM.factionRelations.forEach(function(r){
        var rClr=(r.value||0)>30?'var(--green)':(r.value||0)<-30?'var(--red)':'var(--txt-d)';
        _frHtml+='<div>'+r.from+'\u2192'+r.to+' <span style="color:'+rClr+';">'+r.type+'('+r.value+')</span></div>';
      });
      _frHtml+='</div>';
      fp.innerHTML+=_frHtml;
    }
    gl.appendChild(fp);
  }

  // 军事力量（点击打开详情）
  if(GM.armies&&GM.armies.length>0){
    var activeA=GM.armies.filter(function(a){return !a.destroyed;});
    if(activeA.length>0){
      var mp=document.createElement("div");mp.style.marginBottom="0.8rem";mp.style.cursor="pointer";
      mp.onclick=function(){openMilitaryDetailPanel();};
      mp.title='\u70B9\u51FB\u67E5\u770B\u5404\u519B\u5B8C\u6574\u8BE6\u60C5';
      var totalSol=activeA.reduce(function(s,a){return s+(a.soldiers||0);},0);
      mp.innerHTML="<div class=\"pt\">\u2694\uFE0F \u519B\u4E8B\u529B\u91CF <span style=\"font-size:0.65rem;color:var(--txt-d);\">\u603B\u5175\u529B"+totalSol+"\u00B7"+activeA.length+"\u652F</span></div>"+activeA.map(function(a){
        var sol=a.soldiers||0;
        var pct=totalSol>0?Math.round(sol/totalSol*100):0;
        var morClr=(a.morale||0)>70?'var(--green)':(a.morale||0)>40?'var(--gold)':'var(--red)';
        var info=a.name+(a.armyType?' <span style=\"font-size:0.6rem;color:var(--txt-d);\">'+a.armyType+'</span>':'');
        var detail=sol+'\u5175 \u58EB\u6C14'+(a.morale||50)+' \u8BAD\u7EC3'+(a.training||50);
        if(a.commander)detail+=' \u5E05:'+a.commander;
        if(a.garrison)detail+=' \u9A7B:'+String(a.garrison);
        return "<div style=\"margin-bottom:0.4rem;\"><div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>"+info+"</span><span style=\"color:"+morClr+";\">"+sol+"</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:"+pct+"%;background:"+morClr+";\"></div></div><div style=\"font-size:0.65rem;color:var(--txt-d);\">"+ detail+"</div></div>";
      }).join("");
      gl.appendChild(mp);
    }
  }

  // 目标条件
  if(P.goals&&P.goals.length>0){
    var gp=document.createElement("div");gp.style.marginBottom="0.8rem";
    var typeIcons={win:'\u2605',lose:'\u2716',milestone:'\u25C6',npc_goal:'\u25CB'};
    var typeColors={win:'var(--gold)',lose:'var(--red)',milestone:'var(--blue)',npc_goal:'var(--txt-s)'};
    gp.innerHTML="<div class=\"pt\">\uD83C\uDFAF \u76EE\u6807\u6761\u4EF6</div>"+P.goals.map(function(g){
      return "<div style=\"padding:0.2rem 0;font-size:0.75rem;display:flex;gap:0.3rem;\"><span style=\"color:"+(typeColors[g.type]||'var(--txt-s)')+";\">"+( typeIcons[g.type]||'\u25CB')+"</span><span>"+(g.name||'')+"</span></div>";
    }).join("");
    gl.appendChild(gp);
  }

  // 显著矛盾
  if(P.playerInfo&&P.playerInfo.coreContradictions&&P.playerInfo.coreContradictions.length>0){
    var cp=document.createElement("div");cp.style.marginBottom="0.8rem";
    var dimC={political:'#6366f1',economic:'#f59e0b',military:'#ef4444',social:'#10b981'};
    var dimN={political:'\u653F',economic:'\u7ECF',military:'\u519B',social:'\u793E'};
    var _cHtml="<div class=\"pt\" style=\"color:#a885d5;\">\u26A1 \u663E\u8457\u77DB\u76FE</div>";
    P.playerInfo.coreContradictions.forEach(function(c){
      var dc=dimC[c.dimension]||'#9ca3af';
      _cHtml+="<div style=\"padding:3px 0;font-size:0.72rem;border-left:3px solid "+dc+";padding-left:6px;margin-bottom:3px;\">";
      _cHtml+="<span style=\"color:"+dc+";font-weight:700;\">"+escHtml(c.title||'')+"</span>";
      _cHtml+=" <span style=\"font-size:0.55rem;color:var(--txt-d);\">"+(dimN[c.dimension]||'')+"</span>";
      if(c.severity==='critical')_cHtml+=" <span style=\"font-size:0.55rem;color:#dc2626;\">\u2605</span>";
      _cHtml+="</div>";
    });
    cp.innerHTML=_cHtml;
    gl.appendChild(cp);
  }

  // 头衔爵位
  if(GM.chars){
    var _titledChars=GM.chars.filter(function(c){return c.alive!==false&&c.titles&&c.titles.length>0;});
    if(_titledChars.length>0){
      var tp=document.createElement("div");tp.style.marginBottom="0.8rem";
      var _tHtml="<div class=\"pt\">\uD83D\uDC51 \u7235\u4F4D\u6301\u6709</div>";
      _titledChars.forEach(function(c){
        var ts=c.titles.map(function(t){
          var hTag=t.hereditary?'\u4E16\u88AD':'\u6D41\u5B98';
          var supTag=(t._suppressed&&t._suppressed.length>0)?' \u26D4':'';
          return t.name+'<span style="font-size:0.55rem;color:var(--txt-d);">('+hTag+supTag+')</span>';
        }).join(' ');
        _tHtml+="<div style=\"font-size:0.75rem;padding:2px 0;\"><span style=\"color:var(--gold-l);\">"+escHtml(c.name)+"</span> "+ts+"</div>";
      });
      tp.innerHTML=_tHtml;
      gl.appendChild(tp);
    }
  }

  // 封建关系（封臣-宗主树）
  if(GM.facs){
    var _hasVassals=GM.facs.some(function(f){return (f.vassals&&f.vassals.length>0)||f.liege;});
    if(_hasVassals){
      var vp=document.createElement("div");vp.style.marginBottom="0.8rem";
      var _vHtml="<div class=\"pt\">\uD83C\uDFF0 \u5C01\u5EFA\u5173\u7CFB</div>";
      GM.facs.forEach(function(f){
        if(f.vassals&&f.vassals.length>0){
          _vHtml+="<div style=\"margin-bottom:0.4rem;\">";
          _vHtml+="<div style=\"font-size:0.78rem;font-weight:700;color:var(--gold-l);\">[\u5B97\u4E3B] "+escHtml(f.name)+"</div>";
          var _totalTrib=0;
          f.vassals.forEach(function(vn){
            var vf=GM._indices.facByName?GM._indices.facByName.get(vn):null;
            var ruler=GM.chars?GM.chars.find(function(c){return c.faction===vn&&(c.position==='\u541B\u4E3B'||c.position==='\u9996\u9886');}):null;
            var loy=ruler?(ruler.loyalty||50):50;
            var loyClr=loy>70?'var(--green)':loy<35?'var(--red)':'var(--txt-s)';
            var trib=vf?Math.round((vf.tributeRate||0.3)*100):30;
            _totalTrib+=trib;
            _vHtml+="<div style=\"padding-left:1rem;font-size:0.72rem;display:flex;justify-content:space-between;\">";
            _vHtml+="<span>\u2514 "+escHtml(vn)+(ruler?" ("+escHtml(ruler.name)+")":"")+"</span>";
            _vHtml+="<span>\u8D21"+trib+"% <span style=\"color:"+loyClr+"\">\u5FE0"+loy+"</span>"+(loy<35?" \u26A0":"")+"</span>";
            _vHtml+="</div>";
          });
          _vHtml+="<div style=\"font-size:0.65rem;color:var(--txt-d);padding-left:1rem;\">\u5C01\u81E3"+f.vassals.length+"\u4E2A</div>";
          _vHtml+="</div>";
        }
      });
      vp.innerHTML=_vHtml;
      gl.appendChild(vp);
    }
  }

  // 行政区划概览
  if(P.adminHierarchy){
    var _adminKeys2=Object.keys(P.adminHierarchy);
    var _totalDivs=0;var _govCount=0;var _topDivs=[];
    _adminKeys2.forEach(function(k){
      var ah=P.adminHierarchy[k];if(!ah||!ah.divisions)return;
      function _cnt(divs){divs.forEach(function(d){_totalDivs++;if(d.governor)_govCount++;if(d.children)_cnt(d.children);});}
      _cnt(ah.divisions);
      ah.divisions.forEach(function(d){_topDivs.push(d);});
    });
    if(_totalDivs>0){
      var ap=document.createElement("div");ap.style.marginBottom="0.8rem";
      var _aHtml="<div class=\"pt\">\uD83C\uDFEF \u884C\u653F\u533A\u5212 <span style=\"font-size:0.65rem;color:var(--txt-d);\">\u5171"+_totalDivs+"\u5355\u4F4D \u5B98"+_govCount+"</span></div>";
      _topDivs.forEach(function(d){
        var pStr=d.prosperity?' \u7E41'+d.prosperity:'';
        var gStr=d.governor?' \u5B98:'+escHtml(d.governor):'';
        var chCount=d.children?d.children.length:0;
        _aHtml+="<div style=\"font-size:0.72rem;padding:2px 0;\">"+escHtml(d.name)+"<span style=\"color:var(--txt-d);font-size:0.6rem;\"> "+(d.terrain||'')+(d.level?'('+d.level+')':'')+(chCount>0?' \u4E0B\u8F96'+chCount:'')+pStr+gStr+"</span></div>";
      });
      ap.innerHTML=_aHtml;
      gl.appendChild(ap);
    }
  }

  // 阶层（点击打开详情）
  if(GM.classes&&GM.classes.length>0){
    var cp=document.createElement("div");cp.style.marginBottom="0.8rem";cp.style.cursor="pointer";
    cp.onclick=function(){openClassDetailPanel();};
    cp.innerHTML="<div class=\"pt\">\uD83D\uDC51 \u9636\u5C42</div>"+GM.classes.map(function(c){var _ci=c.influence||c.classInfluence||0;return "<div style=\"margin-bottom:0.3rem;\"><div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>"+escHtml(c.name)+(c.satisfaction?' <span style=\"font-size:0.65rem;color:var(--txt-d);\">'+Math.round(c.satisfaction)+'</span>':'')+"</span><span style=\"color:var(--gold);\">"+_ci+"</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:"+_ci+"%;background:var(--blue);\"></div></div></div>";}).join("");
    gl.appendChild(cp);
  }

  // 党派（点击打开详情）
  if(GM.parties&&GM.parties.length>0){
    var pp=document.createElement("div");pp.style.marginBottom="0.8rem";pp.style.cursor="pointer";
    pp.onclick=function(){openPartyDetailPanel();};
    pp.innerHTML="<div class=\"pt\">\uD83C\uDFDB \u515A\u6D3E</div>"+GM.parties.map(function(p){var _inf=p.influence||p.strength||0;var _stClr=p.status==='\u6D3B\u8DC3'?'var(--green)':p.status==='\u5F0F\u5FAE'?'var(--gold)':p.status==='\u88AB\u538B\u5236'?'var(--red)':'var(--txt-d)';return "<div style=\"margin-bottom:0.3rem;\"><div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>"+escHtml(p.name)+(p.status?' <span style=\"font-size:0.65rem;color:'+_stClr+';\">'+escHtml(p.status)+'</span>':'')+"</span><span>"+_inf+"</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:"+_inf+"%;background:var(--purple);\"></div></div></div>";}).join("");
    gl.appendChild(pp);
  }

  // 重要物品
  if(GM.items&&GM.items.length>0){
    var ip=document.createElement("div");ip.style.marginBottom="0.8rem";
    var typeIcons={weapon:'\u2694',armor:'\uD83D\uDEE1',consumable:'\uD83C\uDF76',treasure:'\uD83D\uDC8E',document:'\uD83D\uDCDC',seal:'\uD83D\uDD8B',special:'\u2728'};
    var rarClr={'\u666E\u901A':'var(--txt-d)','\u7CBE\u826F':'var(--green)','\u73CD\u8D35':'var(--blue)','\u4F20\u8BF4':'var(--gold)'};
    var _iHtml="<div class=\"pt\">\uD83D\uDCE6 \u7269\u54C1 <span style=\"font-size:0.65rem;color:var(--txt-d);font-weight:400;\">"+GM.items.length+"\u4EF6</span></div>";
    GM.items.forEach(function(it){
      var _acqStyle = it.acquired ? '' : 'opacity:0.5;';
      var _acqTag = it.acquired ? '' : '<span style="font-size:0.55rem;color:var(--ink-300);margin-left:3px;">\u672A\u83B7</span>';
      _iHtml+="<div style=\"padding:0.2rem 0;font-size:0.75rem;border-bottom:1px solid var(--bg-4);"+_acqStyle+"\">";
      _iHtml+="<div style=\"display:flex;justify-content:space-between;\"><span>"+(typeIcons[it.type]||'\u2022')+' '+(it.name||'')+_acqTag+"</span>";
      if(it.rarity&&it.rarity!=='\u666E\u901A')_iHtml+="<span style=\"font-size:0.6rem;color:"+(rarClr[it.rarity]||'var(--txt-d)')+";\">"+it.rarity+"</span>";
      _iHtml+="</div>";
      if(it.effect)_iHtml+="<div style=\"font-size:0.65rem;color:var(--gold-d);\">"+escHtml(String(it.effect))+"</div>";
      if(it.owner)_iHtml+="<div style=\"font-size:0.6rem;color:var(--ink-300);\">\u6301\u6709\uFF1A"+escHtml(it.owner)+"</div>";
      _iHtml+="</div>";
    });
    ip.innerHTML=_iHtml;
    gl.appendChild(ip);
  }

  // 后宫/妃嫔面板
  if(GM.chars&&GM.harem){
    var _spouseChars=GM.chars.filter(function(c){return c.alive!==false&&c.spouse;});
    if(_spouseChars.length>0){
      var hp=document.createElement("div");hp.style.marginBottom="0.8rem";
      var _hHtml="<div class=\"pt\">\uD83D\uDC90 \u540E\u5BAB</div>";
      // 按位份排序（动态从rankSystem获取level）
      _spouseChars.sort(function(a,b){
        var la = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(a.spouseRank) : 9;
        var lb = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(b.spouseRank) : 9;
        return la - lb;
      });
      _spouseChars.forEach(function(sp){
        var rkName=sp.spouseRank||'';
        if(typeof getHaremRankName==='function'){var rn=getHaremRankName(sp.spouseRank);if(rn)rkName=rn;}
        var rkIcon='';if(typeof getHaremRankIcon==='function')rkIcon=getHaremRankIcon(sp.spouseRank);
        var childCount=sp.children?sp.children.length:0;
        var loyClr=(sp.loyalty||50)>70?'var(--green)':(sp.loyalty||50)<30?'var(--red)':'var(--txt-s)';
        _hHtml+="<div style=\"font-size:0.72rem;padding:2px 0;display:flex;justify-content:space-between;\">";
        _hHtml+="<span>"+rkIcon+" "+escHtml(sp.name)+" <span style=\"color:var(--gold-d);font-size:0.6rem;\">"+escHtml(rkName)+"</span></span>";
        var favStr = sp.favor !== undefined ? ' \u5BA0' + sp.favor : '';
        _hHtml+="<span style=\"font-size:0.6rem;\"><span style=\"color:"+loyClr+"\">\u5FE0"+(sp.loyalty||50)+"</span>"+favStr+(childCount>0?" \u5B50"+childCount:"")+"</span>";
        _hHtml+="</div>";
      });
      // 继承人
      if(GM.harem.heirs&&GM.harem.heirs.length>0){
        _hHtml+="<div style=\"font-size:0.65rem;color:var(--gold);margin-top:3px;border-top:1px solid var(--bg-4);padding-top:3px;\">\u7EE7\u627F\u4EBA: "+GM.harem.heirs.join('\u3001')+"</div>";
      }
      // 孕期
      if(GM.harem.pregnancies&&GM.harem.pregnancies.length>0){
        _hHtml+="<div style=\"font-size:0.65rem;color:var(--purple,#9b59b6);\">\u6709\u5B55: "+GM.harem.pregnancies.map(function(p){return p.mother;}).join('\u3001')+"</div>";
      }
      hp.innerHTML=_hHtml;
      gl.appendChild(hp);
    }
  }

  // 建筑概览
  if(GM.buildings&&GM.buildings.length>0){
    var _catCount={};var _totalBld=GM.buildings.length;
    var _inQueue=GM.buildingQueue?GM.buildingQueue.length:0;
    GM.buildings.forEach(function(b){
      var cat=b.category||(typeof BUILDING_TYPES!=='undefined'&&BUILDING_TYPES[b.type]?BUILDING_TYPES[b.type].category:'');
      _catCount[cat]=(_catCount[cat]||0)+1;
    });
    var _catNames={'military':'\u519B','economic':'\u7ECF','economy':'\u7ECF','cultural':'\u6587','culture':'\u6587','administrative':'\u653F','administration':'\u653F','religious':'\u5B97','infrastructure':'\u57FA'};
    var bp=document.createElement("div");bp.style.marginBottom="0.8rem";
    var _bHtml="<div class=\"pt\">\uD83C\uDFD7 \u5EFA\u7B51 <span style=\"font-size:0.65rem;color:var(--txt-d);\">\u5171"+_totalBld+"\u5EA7</span></div>";
    var _catEntries=Object.keys(_catCount);
    if(_catEntries.length>0){
      _bHtml+="<div style=\"display:flex;flex-wrap:wrap;gap:4px;font-size:0.7rem;\">";
      _catEntries.forEach(function(c){_bHtml+="<span style=\"background:var(--bg-3);padding:1px 5px;border-radius:3px;\">"+(_catNames[c]||c)+":"+_catCount[c]+"</span>";});
      _bHtml+="</div>";
    }
    if(_inQueue>0)_bHtml+="<div style=\"font-size:0.65rem;color:var(--gold);margin-top:3px;\">\u5EFA\u9020\u4E2D: "+_inQueue+"\u9879</div>";
    bp.innerHTML=_bHtml;
    gl.appendChild(bp);
  }

  // 事件概览
  if(GM.events&&GM.events.length>0){
    var _untrigEvts=GM.events.filter(function(e){return !e.triggered;});
    var _trigEvts=GM.events.filter(function(e){return e.triggered;});
    if(_untrigEvts.length>0||_trigEvts.length>0){
      var ep2=document.createElement("div");ep2.style.marginBottom="0.8rem";
      var _eHtml="<div class=\"pt\">\u{1F4DC} \u4E8B\u4EF6 <span style=\"font-size:0.65rem;color:var(--txt-d);\">\u5F85\u89E6\u53D1"+_untrigEvts.length+" \u5DF2\u53D1\u751F"+_trigEvts.length+"</span></div>";
      _untrigEvts.forEach(function(e){
        var impClr=e.importance==='\u5173\u952E'?'var(--red)':e.importance==='\u91CD\u8981'?'var(--gold)':'var(--txt-d)';
        _eHtml+="<div style=\"font-size:0.72rem;padding:2px 0;\"><span style=\"color:"+impClr+";\">"+(e.importance==='\u5173\u952E'?'\u2605':e.importance==='\u91CD\u8981'?'\u25C6':'\u25CB')+"</span> "+escHtml(e.name||'')+(e.type?' <span style=\"font-size:0.6rem;color:var(--txt-d);\">'+escHtml(e.type)+'</span>':'')+"</div>";
      });
      if(_trigEvts.length>0){
        _eHtml+="<div style=\"font-size:0.65rem;color:var(--green);margin-top:3px;border-top:1px solid var(--bg-4);padding-top:2px;\">\u5DF2\u53D1\u751F: "+_trigEvts.map(function(e){return e.name;}).join('\u3001')+"</div>";
      }
      ep2.innerHTML=_eHtml;
      gl.appendChild(ep2);
    }
  }

  // 官制消耗
  if(P.officeConfig&&P.officeConfig.costVariables&&P.officeConfig.costVariables.length>0&&GM.officeTree&&GM.officeTree.length>0){
    var td=0,to=0;
    function cnt(tree){tree.forEach(function(d){td++;to+=(d.positions||[]).filter(function(p){return p.holder;}).length;if(d.subs)cnt(d.subs);});}
    cnt(GM.officeTree);
    var oc=document.createElement("div");oc.style.marginBottom="0.8rem";
    oc.innerHTML="<div class=\"pt\">\uD83D\uDCB0 \u5B98\u5236\u6D88\u8017</div><div style=\"font-size:0.68rem;color:var(--txt-d);\">\u90E8\u95E8:"+td+" \u5B98\u5458:"+to+"</div>"+P.officeConfig.costVariables.map(function(cv){var cost=(cv.perDept||0)*td+(cv.perOfficial||0)*to;var v=GM.vars[cv.variable];var ok=v&&v.value>=cost;return "<div style=\"display:flex;justify-content:space-between;font-size:0.75rem;\"><span>"+cv.variable+"</span><span style=\"color:"+(ok?"var(--txt-s)":"var(--red)")+";\">-"+cost+"/\u56DE</span></div>";}).join("");
    gl.appendChild(oc);
  }

  // 皇城宫殿面板
  if (P.palaceSystem && P.palaceSystem.enabled && P.palaceSystem.palaces && P.palaceSystem.palaces.length > 0) {
    var ppd = document.createElement('div');
    ppd.style.marginBottom = '0.8rem';
    var _palaces = P.palaceSystem.palaces;
    // 按type分组统计
    var _typeStats = {};
    _palaces.forEach(function(p) { _typeStats[p.type] = (_typeStats[p.type] || 0) + 1; });
    var _typeLabels = { main_hall:'外朝', imperial_residence:'帝居', consort_residence:'后妃居所', dowager:'太后宫', crown_prince:'太子宫', ceremonial:'礼制', garden:'园林', office:'内廷', offering:'祭祀' };
    var _statItems = [];
    Object.keys(_typeStats).forEach(function(t) {
      _statItems.push((_typeLabels[t] || t) + _typeStats[t]);
    });
    // 本回合居住的妃嫔数
    var _occupiedCount = 0;
    _palaces.forEach(function(p) { if (p.subHalls) p.subHalls.forEach(function(sh) { if (sh.occupants) _occupiedCount += sh.occupants.length; }); });
    var _damaged = _palaces.filter(function(p) { return p.status === 'damaged' || p.status === 'ruined'; }).length;
    ppd.innerHTML = '<div class="pt" onclick="openPalacePanel()" style="cursor:pointer;">🏯 ' + escHtml(P.palaceSystem.capitalName || '皇城') + ' <span style="font-size:0.65rem;color:var(--txt-d);font-weight:400;">' + _palaces.length + '处</span></div>'
      + '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.5;">' + _statItems.join(' · ') + '</div>'
      + '<div style="font-size:0.68rem;color:var(--txt-s);">居住 ' + _occupiedCount + '人' + (_damaged?' · <span style="color:var(--red);">'+_damaged+'处需修缮</span>':'') + '</div>'
      + '<div style="font-size:0.6rem;color:var(--gold-d);margin-top:2px;cursor:pointer;" onclick="openPalacePanel()">点击查看详情 →</div>';
    gl.appendChild(ppd);
  }

  // 将整个侧面板容器追加到真实gl
  gl_real.appendChild(_wrap);
}

// 皇城详情弹窗
function openPalacePanel() {
  if (!P.palaceSystem || !P.palaceSystem.palaces) return;
  var palaces = P.palaceSystem.palaces;
  var _typeLabels = { main_hall:'外朝主殿', imperial_residence:'帝居宫殿', consort_residence:'后妃居所', dowager:'太后/太妃宫', crown_prince:'太子宫', ceremonial:'礼制建筑', garden:'园林行宫', office:'内廷办公', offering:'祭祀宗庙' };
  var _typeColors = { main_hall:'#ffd700', imperial_residence:'#e74c3c', consort_residence:'#9b59b6', dowager:'#d4a04c', crown_prince:'#3498db', ceremonial:'#95a5a6', garden:'#16a085', office:'#7f8c8d', offering:'#c0392b' };
  var html = '<div class="modal-bg show" id="_palaceDetailModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:800px;max-height:85vh;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">🏯 ' + escHtml(P.palaceSystem.capitalName || '皇城') + '</h3>';
  if (P.palaceSystem.capitalDescription) html += '<div style="font-size:0.78rem;color:var(--txt-s);line-height:1.7;padding:0.5rem;background:var(--bg-2);border-radius:6px;margin-bottom:0.8rem;">' + escHtml(P.palaceSystem.capitalDescription) + '</div>';
  // 按type分组
  var groups = {};
  palaces.forEach(function(p) { (groups[p.type] = groups[p.type] || []).push(p); });
  Object.keys(_typeLabels).forEach(function(t) {
    var grp = groups[t]; if (!grp || !grp.length) return;
    var color = _typeColors[t] || '#888';
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<div style="font-size:0.85rem;color:' + color + ';font-weight:700;margin-bottom:0.3rem;padding:0.2rem 0;border-bottom:1px solid ' + color + '44;">◆ ' + _typeLabels[t] + ' (' + grp.length + ')</div>';
    grp.forEach(function(pal, pi) {
      var realIdx = palaces.indexOf(pal);
      html += '<div style="padding:0.5rem;margin-bottom:0.4rem;background:var(--bg-2);border-left:3px solid ' + color + ';border-radius:4px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><span style="font-size:0.95rem;color:' + color + ';font-weight:700;">' + escHtml(pal.name) + '</span>';
      if (pal.status && pal.status !== 'intact') {
        var sMap = { damaged:'损坏', ruined:'荒废', underconstruction:'在建' };
        html += '<span style="margin-left:6px;font-size:0.68rem;color:var(--red);">[' + (sMap[pal.status] || pal.status) + ']</span>';
      }
      if (pal.location) html += '<span style="margin-left:6px;font-size:0.66rem;color:var(--txt-d);">📍' + escHtml(pal.location) + '</span>';
      html += '</div>';
      html += '<div style="display:flex;gap:2px;">';
      html += '<button class="bt bsm" style="font-size:0.62rem;" onclick="_palaceAction(' + realIdx + ',\'renovate\')">修缮</button>';
      html += '<button class="bt bsm" style="font-size:0.62rem;" onclick="_palaceAction(' + realIdx + ',\'reassign\')">移居</button>';
      html += '</div>';
      html += '</div>';
      if (pal.function) html += '<div style="font-size:0.72rem;color:var(--txt-d);margin-top:2px;">' + escHtml(pal.function) + '</div>';
      if (pal.subHalls && pal.subHalls.length > 0) {
        html += '<div style="margin-top:4px;padding-left:10px;font-size:0.72rem;line-height:1.8;">';
        pal.subHalls.forEach(function(sh) {
          var roleLabel = { main:'主殿', side:'偏殿', attached:'附殿' }[sh.role] || sh.role;
          var shColor = sh.role === 'main' ? '#ffd700' : sh.role === 'side' ? '#9b59b6' : '#16a085';
          html += '<div style="color:' + shColor + ';">├ <b>' + escHtml(sh.name) + '</b> <span style="color:var(--txt-d);">(' + roleLabel + ' ' + ((sh.occupants||[]).length) + '/' + (sh.capacity||1) + ')</span>';
          if (sh.occupants && sh.occupants.length) html += ' <span style="color:#4ade80;">' + sh.occupants.map(escHtml).join('、') + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:0.8rem;">';
  html += '<button class="bt bp" onclick="_palaceNewBuild()">⊕ 修建新宫殿</button>';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_palaceDetailModal\');if(m)m.remove();">关闭</button>';
  html += '</div>';
  html += '</div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _palaceAction(idx, action) {
  var pal = P.palaceSystem && P.palaceSystem.palaces && P.palaceSystem.palaces[idx];
  if (!pal) return;
  if (action === 'renovate') {
    _palaceRenovateModal(pal);
    return;
  }
  if (action === 'reassign') {
    _palaceReassignModal(pal);
    return;
  }
}

/** 修缮弹窗 */
function _palaceRenovateModal(pal) {
  var _old = document.getElementById('_palaceRenoModal'); if (_old) _old.remove();
  var statusMap = { damaged:'损坏', ruined:'荒废', underconstruction:'在建', intact:'完好' };
  var html = '<div class="modal-bg show" id="_palaceRenoModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:460px;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">◎ 修缮 ' + escHtml(pal.name) + '</h3>';
  html += '<div style="font-size:0.78rem;color:var(--txt-s);padding:0.5rem;background:var(--bg-2);border-radius:6px;margin-bottom:0.6rem;">当前状态：<b>' + (statusMap[pal.status]||'完好') + '</b>' + (pal.lastRenovation?' · 上次修缮 T'+pal.lastRenovation:'') + '</div>';
  html += '<label style="font-size:0.78rem;color:var(--gold);">修缮意图（告知AI）</label>';
  html += '<textarea id="_palRenoDesc" rows="3" class="fd" style="width:100%;" placeholder="' + (pal.status === 'ruined' ? '如：荒废重建，恢复规制' : '如：整修正殿屋瓦、重绘彩绘、重铺砖石') + '"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:0.6rem;justify-content:flex-end;">';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_palaceRenoModal\');if(m)m.remove();">取消</button>';
  html += '<button class="bt bp" onclick="_palaceSubmitReno(&quot;' + encodeURIComponent(pal.name) + '&quot;)">提交</button>';
  html += '</div></div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}
function _palaceSubmitReno(palNameEnc) {
  var palName = decodeURIComponent(palNameEnc);
  var desc = ((document.getElementById('_palRenoDesc')||{}).value||'').trim() || '修缮 ' + palName + '，恢复规制与威严';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5BAB\u5EFA', from: palName, content: '修缮 ' + palName + '：' + desc, turn: GM.turn, used: false });
  toast('已录入诏令建议库');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_palaceRenoModal'); if (m) m.remove();
}

/** 移居弹窗——列出目标宫殿的所有 subHall 供选择 */
function _palaceReassignModal(pal) {
  var _old = document.getElementById('_palaceAssignModal'); if (_old) _old.remove();
  // 收集当前宫殿的现有居住者
  var currentOccupants = [];
  if (pal.subHalls) {
    pal.subHalls.forEach(function(sh) {
      (sh.occupants || []).forEach(function(n) { currentOccupants.push({ name: n, fromSubHall: sh }); });
    });
  }
  // 收集所有 subHall 作为可迁目标（包括其他宫殿的居所殿）
  var allSubHalls = [];
  (P.palaceSystem.palaces || []).forEach(function(p) {
    if (p.type !== 'consort_residence' && p.type !== 'imperial_residence' && p.type !== 'main_hall') return;
    (p.subHalls || []).forEach(function(sh) {
      allSubHalls.push({ palace: p, subHall: sh });
    });
  });

  var html = '<div class="modal-bg show" id="_palaceAssignModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:600px;max-height:85vh;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">◎ ' + escHtml(pal.name) + ' 妃嫔移居</h3>';

  if (currentOccupants.length === 0) {
    html += '<div style="padding:1rem;text-align:center;color:var(--txt-d);">此宫殿暂无居住者</div>';
    html += '<div style="text-align:center;margin-top:0.6rem;"><button class="bt bs" onclick="var m=document.getElementById(\'_palaceAssignModal\');if(m)m.remove();">关闭</button></div>';
  } else {
    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.78rem;color:var(--gold);">① 选择迁出者</label>';
    html += '<select id="_palAssignWho" class="fd" style="width:100%;">';
    currentOccupants.forEach(function(o) {
      html += '<option value="' + escHtml(o.name) + '">' + escHtml(o.name) + '（现居：' + escHtml(o.fromSubHall.name) + '）</option>';
    });
    html += '</select></div>';

    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.78rem;color:var(--gold);">② 选择目标居所</label>';
    html += '<select id="_palAssignTo" class="fd" style="width:100%;">';
    allSubHalls.forEach(function(t) {
      var occ = t.subHall.occupants || [];
      var full = occ.length >= (t.subHall.capacity || 1);
      var roleLabel = { main:'主殿', side:'偏殿', attached:'附殿' }[t.subHall.role] || t.subHall.role;
      var dispText = t.palace.name + '·' + t.subHall.name + '（' + roleLabel + ' ' + occ.length + '/' + (t.subHall.capacity||1) + '）' + (full ? ' [满]' : '');
      html += '<option value="' + escHtml(t.palace.name) + '|' + escHtml(t.subHall.name) + '"' + (full ? ' disabled' : '') + '>' + escHtml(dispText) + '</option>';
    });
    html += '</select></div>';

    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.78rem;color:var(--gold);">③ 原因说明（AI据此生成叙事）</label>';
    html += '<textarea id="_palAssignReason" rows="2" class="fd" style="width:100%;" placeholder="如：晋贵妃位，移居储秀宫正殿；或：失宠，迁出乾清宫"></textarea>';
    html += '</div>';

    html += '<div style="display:flex;gap:8px;margin-top:0.6rem;justify-content:flex-end;">';
    html += '<button class="bt bs" onclick="var m=document.getElementById(\'_palaceAssignModal\');if(m)m.remove();">取消</button>';
    html += '<button class="bt bp" onclick="_palaceSubmitReassign()">提交</button>';
    html += '</div>';
  }
  html += '</div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _palaceSubmitReassign() {
  var who = (document.getElementById('_palAssignWho')||{}).value || '';
  var toVal = (document.getElementById('_palAssignTo')||{}).value || '';
  var reason = ((document.getElementById('_palAssignReason')||{}).value||'').trim();
  if (!who || !toVal) { toast('请选择迁出者与目标居所'); return; }
  var parts = toVal.split('|');
  var toPal = parts[0], toSubHall = parts[1];
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  var content = '调 ' + who + ' 移居 ' + toPal + '·' + toSubHall + (reason ? '——' + reason : '');
  GM._edictSuggestions.push({ source: '\u5BAB\u5EFA', from: toPal, content: content, turn: GM.turn, used: false });
  toast('已录入诏令建议库');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_palaceAssignModal'); if (m) m.remove();
}

function _palaceNewBuild() {
  var name = window.prompt('新建宫殿名：', '');
  if (!name || !name.trim()) return;
  var desc = window.prompt('该宫殿用途、规模、位置（告知AI）：', '');
  if (!desc || !desc.trim()) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '\u5BAB\u5EFA',
    from: '皇城',
    content: '新建宫殿【' + name.trim() + '】：' + desc.trim() + '。——请AI判定建造合理性、成本、工期与威仪影响，纳入皇城。',
    turn: GM.turn,
    used: false
  });
  toast('已录入诏令建议库，请在诏令区纳入后颁诏');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_palaceDetailModal'); if (m) m.remove();
}

// ============================================================
//  注册 endTurn 钩子（替代原有的包装链）
// ============================================================

// 钩子 1: 官制消耗（原 _origEndTurn）
EndTurnHooks.register('before', function() {
  if(P.officeConfig&&P.officeConfig.costVariables&&P.officeConfig.costVariables.length>0&&GM.officeTree){
    var td=0,to=0;
    function countOff(tree){tree.forEach(function(d){td++;to+=(d.positions||[]).filter(function(p){return p.holder;}).length;if(d.subs)countOff(d.subs);});}
    countOff(GM.officeTree);
    var shortfall=[];
    P.officeConfig.costVariables.forEach(function(cv){
      var cost=(cv.perDept||0)*td+(cv.perOfficial||0)*to;
      if(GM.vars[cv.variable]){
        GM.vars[cv.variable].value=clamp(GM.vars[cv.variable].value-cost,GM.vars[cv.variable].min,GM.vars[cv.variable].max);
        if(GM.vars[cv.variable].value<=GM.vars[cv.variable].min+5)shortfall.push(cv.variable);
      }
    });
    if(shortfall.length>0)addEB("官制危机",shortfall.join(",")+"不足");
  }
}, '官制消耗');

// 钩子 2: 奏议批复（原 _origEndTurn2）
EndTurnHooks.register('before', function() {
  if(GM.memorials&&GM.memorials.length>0){
    GM.memorials.forEach(function(m){
      var statusText=m.status==="approved"?"准奏":m.status==="rejected"?"驳回":"未批复";
      var exists=GM.jishiRecords.find(function(r){return r.turn===GM.turn&&r.char===m.from&&r.playerSaid&&r.playerSaid.indexOf("奏疏")>=0;});
      if(!exists)GM.jishiRecords.push({turn:GM.turn,char:m.from,playerSaid:"\u594F\u758F("+m.type+"): "+m.content,npcSaid:"\u6279\u590D: "+statusText+(m.reply?" | "+m.reply:"")});
    });
    renderJishi();
  }
}, '奏议批复');

// 钩子 3: AI上下文注入 - 剧本文风（原 _origEndTurn3）
EndTurnHooks.register('before', function() {
  if(P.ai.key){
    GM._origPrompt=P.ai.prompt;
    var fullPrompt=P.ai.prompt||DEFAULT_PROMPT;
    var sc=findScenarioById(GM.sid);

    if(sc&&sc.scnStyle)fullPrompt+="\n本剧本文风: "+sc.scnStyle;
    if(sc&&sc.scnStyleRule)fullPrompt+="\n文风规则: "+sc.scnStyleRule;
    // 4.3b: 文风指令映射
    var _styleMap = {
      '文学化': '文辞优美，善用比喻和意象，情感充沛',
      '史书体': '仿《资治通鉴》纪事本末体，言简意赅，重事实轻渲染',
      '戏剧化': '矛盾冲突尖锐，人物对话生动，善用悬念和反转',
      '章回体': '仿《三国演义》章回体小说，每段开头可用对仗回目，文白夹杂',
      '纪传体': '仿《史记》纪传体，以人物为中心，"太史公曰"式评论',
      '白话文': '现代白话文风格，通俗易懂，节奏明快'
    };
    if(P.conf.style&&_styleMap[P.conf.style])fullPrompt+="\n叙事文风: "+_styleMap[P.conf.style];
    if(P.conf.customStyle)fullPrompt+="\n自定义文风: "+P.conf.customStyle;

    if(sc&&sc.refText)fullPrompt+="\n\u53C2\u8003: "+sc.refText;
    if(P.conf.refText)fullPrompt+="\n\u5168\u5C40\u53C2\u8003: "+P.conf.refText;

    if(P.world.entries&&P.world.entries.length>0){
      fullPrompt+="\n\n=== 世界设定 ===";
      P.world.entries.forEach(function(e){
        if(e.category&&e.title&&e.content)fullPrompt+="\n["+e.category+"] "+e.title+": "+e.content;
      });
    }

    P.ai.prompt=fullPrompt;
  }
}, 'AI上下文-剧本文风');

// 钩子 4: 恢复原始prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt!==undefined){
    P.ai.prompt=GM._origPrompt;
    delete GM._origPrompt;
  }
}, '恢复原始prompt');

// 钩子 5: AI上下文注入 - 起居注（原 _origEndTurn5）
EndTurnHooks.register('before', function() {
  if(P.ai.key&&GM.conv.length>0){
    var qijuLb=P.conf.qijuLookback||5;
    var recentQ=GM.qijuHistory.slice(-qijuLb);
    if(recentQ.length>0){
      var qijuText="\n\n=== 近"+qijuLb+"回合起居注 ===\n";
      recentQ.forEach(function(q){
        qijuText+="T"+q.turn+" "+q.time+":\n";
        if(q.edicts){
          if(q.edicts.political)qijuText+="  政: "+q.edicts.political+"\n";
          if(q.edicts.military)qijuText+="  军: "+q.edicts.military+"\n";
          if(q.edicts.diplomatic)qijuText+="  外: "+q.edicts.diplomatic+"\n";
          if(q.edicts.economic)qijuText+="  经: "+q.edicts.economic+"\n";
        }
        if(q.xinglu)qijuText+="  行: "+q.xinglu+"\n";
      });
      if(!GM._origPrompt2)GM._origPrompt2=P.ai.prompt;
      P.ai.prompt=(P.ai.prompt||"")+qijuText;
    }
  }
}, 'AI上下文-起居注');

// 钩子 6: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt2!==undefined){
    P.ai.prompt=GM._origPrompt2;
    delete GM._origPrompt2;
  }
}, '恢复prompt-起居注');

// 钩子 7: AI上下文注入 - 规则（原 _origEndTurn6）
EndTurnHooks.register('before', function() {
  if(P.ai.key&&P.ai.rules){
    if(!GM._origPrompt3)GM._origPrompt3=P.ai.prompt;
    P.ai.prompt=(P.ai.prompt||"")+"\n\n=== 规则 ===\n"+P.ai.rules;
  }
}, 'AI上下文-规则');

// 钩子 8: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt3!==undefined){
    P.ai.prompt=GM._origPrompt3;
    delete GM._origPrompt3;
  }
}, '恢复prompt-规则');

// 钩子 9: 历史检查（原 _origEndTurn7）
EndTurnHooks.register('after', async function() {
  var mode=P.conf.gameMode||"yanyi";
  if(mode==="yanyi"||!P.ai.key)return;

  var sc=findScenarioById(GM.sid);
  if(!sc)return;

  showLoading("历史检查...",50);
  try{
    var checkPrompt="检查以下推演是否符合历史。时代:"+sc.era+" 角色:"+sc.role+"\n";
    if(GM.shijiHistory&&GM.shijiHistory.length>0){
      var latest=GM.shijiHistory[GM.shijiHistory.length-1];
      checkPrompt+="\u63A8\u6F14: "+(latest.zhengwen||"");
    }
    if(mode==="strict_hist"&&P.conf.refText)checkPrompt+="\n\u53C2\u8003: "+P.conf.refText;
    checkPrompt+="\n返回JSON:{\"accurate\":true/false,\"issues\":[],\"historical_note\":\"\"}";

    var resp=await callAISmart(checkPrompt,500,{temperature:0.3,maxRetries:2,validator:function(c){try{var j=extractJSON(c);return j&&typeof j.accurate==='boolean';}catch(e){return false;}}});
    var parsed=extractJSON(resp);
    if(parsed&&!parsed.accurate){
      var msg="历史偏离: "+(parsed.historical_note||"");
      if(parsed.issues&&parsed.issues.length>0)msg+="\n问题: "+parsed.issues.join("; ");
      addEB("史实检查",msg);
    }
  }catch(e){
    console.warn("历史检查失败:",e);
  }
}, '历史检查');

// 钩子 10: 音效（原 _origEndTurn - 音频系统）
EndTurnHooks.register('after', function() {
  if(typeof AudioSystem !== 'undefined' && AudioSystem.playSfx) {
    AudioSystem.playSfx('turnEnd');
  }
}, '回合结束音效');

// 钩子 11: 游戏模式注入（原 _origEndTurn11）
EndTurnHooks.register('before', function() {
  var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
  var origPrompt = (typeof P !== 'undefined' && P.ai && P.ai.prompt != null) ? P.ai.prompt : null;

  if (origPrompt !== null) {
    GM._origPrompt11 = origPrompt;
    var modePrefix = '';
    if (mode === 'yanyi') {
      modePrefix = '【演义模式】请以演义小说风格推演，允许虚构情节和战征细节，强调戳剧冲突。';
    } else if (mode === 'light_hist') {
      modePrefix = '【轻度史实模式】请大体符合历史走向，允许适度演绎，主要人物和事件应有史实依据。';
    } else if (mode === 'strict_hist') {
      var refText = (P.conf && P.conf.refText) ? P.conf.refText : '';
      modePrefix = '\u3010\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\u3011\u8BF7\u4E25\u683C\u6309\u6B63\u53F2\u63A8\u6F14\uFF0C\u4E0D\u5F97\u865A\u6784\u4EBA\u7269\u6216\u4E8B\u4EF6\uFF0C\u8BF7\u51C6\u786E\u5F15\u7528\u53F2\u4E66\u8BB0\u8F7D\u3002' + (refText ? '\u53C2\u8003\u8D44\u6599\uFF1A' + refText + '\u3002' : '');
    }
    if (modePrefix) {
      P.ai.prompt = modePrefix + origPrompt;
    }
  }
}, '游戏模式注入');

// 钩子 12: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt11!==undefined){
    P.ai.prompt=GM._origPrompt11;
    delete GM._origPrompt11;
  }
}, '恢复prompt-游戏模式');

// 钩子 13: 处理AI返回的高级系统变更（原 _origEndTurn 的 after 部分）
EndTurnHooks.register('after', function() {
  if(GM.conv.length>0){
    var lastMsg=GM.conv[GM.conv.length-1];
    if(lastMsg.role==="assistant"&&lastMsg.content){
      try{
            var parsed=extractJSON(lastMsg.content);
            if(parsed){

            // 阶层变化
            if(parsed.class_changes){Object.entries(parsed.class_changes).forEach(function(e){var cls=findClassByName(e[0]);if(cls&&typeof e[1]==="object"&&e[1].influence!=null)cls.influence=clamp(cls.influence+(e[1].influence||0),0,100);});}

            // 党派变化
            if(parsed.party_changes){Object.entries(parsed.party_changes).forEach(function(e){var party=findPartyByName(e[0]);if(party&&typeof e[1]==="object"){if(e[1].strength!=null)party.strength=clamp(party.strength+(e[1].strength||0),0,100);}});}

            // 新角色
            if(parsed.new_characters&&Array.isArray(parsed.new_characters)){
              parsed.new_characters.forEach(function(nc){
                if(!nc.name)return;
                var exists=(GM.allCharacters||[]).find(function(c){return c.name===nc.name;});
                if(!exists){
                  GM.allCharacters.push({name:nc.name,title:nc.title||"",age:nc.age||"?",gender:nc.gender||"男",personality:nc.personality||"",appearance:nc.appearance||"",desc:nc.desc||"",loyalty:nc.loyalty||50,relationValue:nc.relation_value||50,faction:nc.faction||"",recruited:nc.recruited||false,recruitTurn:GM.turn-1,source:nc.source||"推演出现",avatarUrl:""});
                  if(nc.recruited){
                    var newChar = {name:nc.name,title:nc.title||"",desc:nc.desc||"",stats:{},stance:"",playable:false,personality:nc.personality||"",appearance:"",skills:[],loyalty:nc.loyalty||50,morale:70,dialogues:[],secret:"",faction:nc.faction||"",aiPersonaText:"",behaviorMode:"",valueSystem:"",speechStyle:"",rels:[]};
                    GM.chars.push(newChar);
                    addToIndex('char', newChar.name, newChar);
                  }
                  addEB("人物",nc.name+(nc.recruited?" 已招":"出现"));
                }
              });
            }

            // 角色更新
            if(parsed.char_updates){Object.entries(parsed.char_updates).forEach(function(e){var ch=findCharByName(e[0]);if(ch&&typeof e[1]==="object"){if(e[1].loyalty!=null)ch.loyalty=e[1].loyalty;if(e[1].desc)ch.desc=e[1].desc;}var ac=(GM.allCharacters||[]).find(function(c){return c.name===e[0];});if(ac&&typeof e[1]==="object"&&e[1].loyalty!=null){ac.loyalty=e[1].loyalty;ac.relationValue=e[1].loyalty;}});}
          }
      }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
    }
  }

  // 更新高级面板
  renderGameTech();renderGameCivic();renderRenwu();
  renderLeftPanel();renderGameState();renderSidePanels();
}, '处理AI高级系统变更');

// 钩子 14: 播放回合结束音效
EndTurnHooks.register('before', function() {
  if(typeof AudioSystem !== 'undefined' && AudioSystem.playSfx) {
    AudioSystem.playSfx('turnEnd');
  }
}, '播放音效');

// ============================================================
//  旧的包装链（已废弃，保留用于向后兼容）
// ============================================================

// _origEndTurn* 包装链已全部删除（已迁移到 EndTurnHooks 系统）

// ============================================================
//  推演时打包所有高级系统数据
// ============================================================
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统
// 保留此注释用于标记原有代码位置

// ============================================================
//  史记中记录高级系统变化
// ============================================================
// 已在endTurn的史记HTML中包含基础数值变化
// 高级系统变化通过addEB写入大事记，间接记录到史记

// ============================================================
//  游戏模式标识
// ============================================================
// renderGameState 增强：游戏模式徽章 + 小地图（合并两次装饰，避免多层包装链）
GameHooks.on('renderGameState:after', function(){
  var gl=_$("gl");if(!gl)return;
  // 游戏模式徽章
  var mode=P.conf.gameMode||"yanyi";
  var label={yanyi:"\u6F14\u4E49",light_hist:"\u8F7B\u5EA6\u53F2\u5B9E",strict_hist:"\u4E25\u683C\u53F2\u5B9E"}[mode]||"\u6F14\u4E49";
  var color={yanyi:"var(--blue)",light_hist:"var(--gold)",strict_hist:"var(--red)"}[mode]||"var(--blue)";
  var existing=gl.querySelector("#mode-badge");
  if(!existing){
    var badge=document.createElement("div");badge.id="mode-badge";badge.style.cssText="text-align:center;margin-bottom:0.5rem;";
    badge.innerHTML="<span style=\"font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:10px;background:rgba(0,0,0,0.3);color:"+color+";border:1px solid "+color+";\">"+label+"</span>";
    gl.insertBefore(badge,gl.firstChild);
  }
  // 小地图
  if(!_$("g-minimap")){
    var mapDiv=document.createElement("div");mapDiv.style.marginTop="0.8rem";
    mapDiv.innerHTML="<div class=\"pt\">\u5730\u56FE</div><div style=\"border:1px solid var(--bdr);border-radius:5px;overflow:hidden;\"><canvas id=\"g-minimap\" width=\"240\" height=\"160\"></canvas></div>";
    gl.appendChild(mapDiv);
  }
  drawMinimap();
});

// ============================================================
//  完成初始化
// ============================================================
// 所有代码加载完毕，显示启动界面
(function(){
  _$("launch").style.display="flex";
  var lt=_$("lt-title");
  if(lt&&P.conf&&P.conf.gameTitle)lt.textContent=P.conf.gameTitle;
})();

// 回复我获取Part 2（游戏引擎）
// ============================================================
