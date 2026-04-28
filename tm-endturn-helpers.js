// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// EndTurn 辅助系统（从 tm-endturn.js 拆分）
// 包含：findOfficeByFunction, 考课, Chancellor, resolveHeir,
//       goals, SettlementPipeline注册, NPC意图, 成就, 议程
// Requires: tm-utils.js, tm-mechanics.js
//
// R157 章节导航 (1503 行)：
//   §1 [L10]   findOfficeByFunction / OfficeFunctionSummary 职能查询
//   §2 [L80]   _computeOfficeHash 官制哈希 (变更检测)
//   §3 [L98]   议程模板示例 (内政/军事/民生·完全配置驱动)
//   §4 [L300]  考课系统 (任期评估·升迁/罢免)
//   §5 [L500]  Chancellor 宰辅决策器 (建议生成)
//   §6 [L700]  resolveHeir 继承人解析 (皇位/势力领袖)
//   §7 [L900]  Settlement 注册表 (按 schedule 调度引擎)
//   §8 [L1100] NPC 意图 + 太史公生成
//   §9 [L1300] 成就系统 + 议程执行
// ============================================================

function findOfficeByFunction(funcKeyword) {
  if (!GM.officeTree || !funcKeyword) return null;
  var result = null;
  (function walk(nodes) {
    if (result) return;
    nodes.forEach(function(n) {
      if (result) return;
      // 1. 检查部门职能数组
      var funcMatch = false;
      if (n.functions && n.functions.length > 0) {
        funcMatch = n.functions.some(function(f) { return f.indexOf(funcKeyword) >= 0; });
      }
      // 2. 检查部门名称/描述
      if (!funcMatch && n.desc && n.desc.indexOf(funcKeyword) >= 0) funcMatch = true;
      if (!funcMatch && n.name && n.name.indexOf(funcKeyword) >= 0) funcMatch = true;
      // 3. 检查各官职的职责
      if (!funcMatch && n.positions) {
        n.positions.forEach(function(p) {
          if (p.duties && p.duties.indexOf(funcKeyword) >= 0) funcMatch = true;
        });
      }
      if (funcMatch) {
        // 找到该部门的最高级别在任官员
        var topHolder = null;
        if (n.positions) {
          n.positions.forEach(function(p) {
            if (p.holder && (!topHolder || (parseInt(p.rank) || 9) < (parseInt(topHolder.rank) || 9))) {
              topHolder = p;
            }
          });
        }
        result = {
          dept: n.name,
          deptDesc: n.desc || '',
          official: topHolder ? topHolder.name : '',
          holder: topHolder ? topHolder.holder : '',
          duties: topHolder ? (topHolder.duties || '') : '',
          functions: n.functions || []
        };
      }
      if (n.subs) walk(n.subs);
    });
  })(GM.officeTree);
  return result;
}

/**
 * 获取官制职能摘要（供AI prompt注入——让AI知道该朝代的部门分工）
 * @returns {string}
 */
function getOfficeFunctionSummary() {
  if (!GM.officeTree || GM.officeTree.length === 0) return '';
  var lines = ['【官制职能分工——AI必须据此判断由谁负责何事】'];
  (function walk(nodes) {
    nodes.forEach(function(n) {
      var funcs = (n.functions && n.functions.length > 0) ? n.functions.join('、') : (n.desc || '');
      if (!funcs) return;
      var holders = [];
      if (n.positions) n.positions.forEach(function(p) {
        if (p.holder) holders.push(p.name + ':' + p.holder);
      });
      lines.push('  ' + n.name + '→' + funcs + (holders.length > 0 ? '（' + holders.join('，') + '）' : '（空缺）'));
      if (n.subs) walk(n.subs);
    });
  })(GM.officeTree);
  lines.push('  ※AI推演中，各类事务应交由对应职能部门处理，不得由无关官员越权处理');
  return lines.join('\n');
}

/** 计算官制树的简易哈希（检测结构变更，不含holder变化） */
function _computeOfficeHash() {
  if (!GM.officeTree) return '';
  var parts = [];
  (function walk(nodes) {
    nodes.forEach(function(n) {
      parts.push(n.name + (n.functions ? n.functions.join(',') : ''));
      if (n.positions) n.positions.forEach(function(p) { parts.push(p.name + (p.rank||'')); });
      if (n.subs) walk(n.subs);
    });
  })(GM.officeTree);
  // 简单字符串哈希
  var s = parts.join('|'), h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

// ============================================================
// 季度议程模板——由编辑器在 P.mechanicsConfig.agendaTemplates 中配置
// 引擎不硬编码任何议题，议题完全由剧本定义，效果由AI在推演中判断
// 如果编辑器未配置，季度议程功能不触发
//
// 剧本编辑参考（勿机械读取——即使是对应朝代也不应原样照搬，仅提供配置思路）：
//   唐朝帝制示例：
//     { id:'tax_policy', title:'税收政策调整', category:'内政',
//       condition:'taxPressure > 60',
//       options:[{label:'减税惠民', desc:'减轻税负'}, {label:'增税充库', desc:'充实国库'}] }
//   部落联盟示例：
//     { id:'pasture_dispute', title:'牧场纠纷', category:'内务',
//       condition:'tribalUnity < 40',
//       options:[{label:'大汗裁决', desc:'以权威压服'}, {label:'长老会议', desc:'各部协商'}] }
// 注意：options 不含 effect 字段——效果完全由AI根据玩家选择在推演中判断，引擎不做机械修改
// ============================================================
var AGENDA_TEMPLATES = []; // 运行时从 P.mechanicsConfig.agendaTemplates 加载

// ============================================================
// 年度考课系统（借鉴晚唐风云 reviewSystem，适配天命全朝代）
// ============================================================
function runAnnualReview() {
  // 每年执行一次（根据剧本设定的回合时间长度动态计算）
  var _yearInterval = (typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12;
  if (!GM.turn || GM.turn % _yearInterval !== 0) return;
  if (!GM.chars || GM.chars.length === 0) return;

  var results = { excellent: [], adequate: [], poor: [], promotions: [], demotions: [] };

  // 查找官职对应的能力需求
  // 通过 findOfficeByFunction 按职能匹配官职类别（不硬编码朝代特定官职名）
  // 剧本编辑参考（勿机械读取——即使是对应朝代也不应原样照搬，应通过官制树的职能标签匹配）：
  //   唐制：将/军/都督 → military，户/度支/盐铁 → fiscal
  //   秦制：太尉 → military，少府/治粟内史 → fiscal
  function _getPostRequirement(char) {
    var req = { type: 'general', key: 'intelligence' };
    var title = char.officialTitle || char.title || '';
    if (!title) return req;
    // 优先用 findOfficeByFunction 在官制树中查找该职位所属职能
    if (typeof findOfficeByFunction === 'function' && GM.officeTree) {
      var funcCategories = [
        { functionKey: 'military', type: 'military', key: 'military' },
        { functionKey: 'finance', type: 'fiscal', key: 'administration' },
        { functionKey: 'education', type: 'cultural', key: 'intelligence' },
        { functionKey: 'justice', type: 'judicial', key: 'intelligence' },
        { functionKey: 'personnel', type: 'personnel', key: 'charisma' }
      ];
      // 在官制树中查找此角色的职位，判断所属部门职能
      for (var fi = 0; fi < funcCategories.length; fi++) {
        var fc = funcCategories[fi];
        var office = findOfficeByFunction(fc.functionKey);
        if (office && office.holder === char.name) {
          req.type = fc.type;
          req.key = fc.key;
          return req;
        }
      }
    }
    return req;
  }

  GM.chars.forEach(function(char) {
    if (!char.alive && char.alive !== undefined) return;
    if (char.isPlayer) return;

    // 多维评分
    var postReq = _getPostRequirement(char);
    var postAbility = char[postReq.key] || char.intelligence || 50;
    var virtue = char.virtue || char.benevolence || 50;
    var loyalty = char.loyalty || 50;
    var admin = char.administration || 50;

    // 五常加权（仁义礼智信各影响不同方面）
    var wuchang = char.wuchang || {};
    var wuchangAvg = ((wuchang.ren||50) + (wuchang.yi||50) + (wuchang.li||50) + (wuchang.zhi||50) + (wuchang.xin||50)) / 5;

    // 综合评分：职务匹配度×0.25 + 忠诚×0.2 + 品德×0.2 + 行政×0.15 + 五常×0.1 + 任期表现×0.1
    var tenureBonus = 0;
    if (char._memory && char._memory.length > 0) {
      var goodDeeds = char._memory.filter(function(m){ return m.importance >= 7; }).length;
      tenureBonus = Math.min(20, goodDeeds * 3);
    }
    var score = postAbility * 0.25 + loyalty * 0.2 + virtue * 0.2 + admin * 0.15 + wuchangAvg * 0.1 + tenureBonus * 0.1;

    var entry = { name: char.name, score: Math.round(score), postType: postReq.type, rank: char.rankLevel || 9 };

    if (score >= 75) results.excellent.push(entry);
    else if (score >= 45) results.adequate.push(entry);
    else results.poor.push(entry);
  });

  // 晋升/贬谪建议（优等中品级≥5可建议晋升，劣等中品级≤4可建议贬谪）
  results.excellent.forEach(function(r) {
    if (r.rank >= 5) results.promotions.push({ name: r.name, score: r.score, reason: '考课优等，堪当大用' });
  });
  results.poor.forEach(function(r) {
    if (r.rank <= 4) results.demotions.push({ name: r.name, score: r.score, reason: '考课劣等，才不配位' });
  });

  // 生成考课事件
  if (results.excellent.length > 0 || results.poor.length > 0) {
    // 查找负责考课的部门
    var _kaoheDept = (typeof findOfficeByFunction === 'function') ? (findOfficeByFunction('考课') || findOfficeByFunction('铨选') || findOfficeByFunction('吏')) : null;
    var msg = '年度考课' + (_kaoheDept && _kaoheDept.holder ? '（' + _kaoheDept.dept + '·' + _kaoheDept.holder + '主持）' : '') + '：';
    if (results.excellent.length > 0) msg += '\u4F18\u7B49' + results.excellent.length + '\u4EBA\uFF08' + results.excellent.map(function(r){return r.name;}).join('\u3001') + '\uFF09\uFF1B';
    if (results.adequate.length > 0) msg += '中等' + results.adequate.length + '人；';
    if (results.poor.length > 0) msg += '\u52A3\u7B49' + results.poor.length + '\u4EBA\uFF08' + results.poor.map(function(r){return r.name;}).join('\u3001') + '\uFF09';
    if (results.promotions.length > 0) msg += '；建议擢升：' + results.promotions.map(function(r){return r.name;}).join('、');
    if (results.demotions.length > 0) msg += '；建议左迁：' + results.demotions.map(function(r){return r.name;}).join('、');
    if (typeof addEB === 'function') addEB('考课', msg);

    // 优等效果
    results.excellent.forEach(function(r) {
      var c = findCharByName(r.name);
      if (c) {
        c.loyalty = Math.min(100, (c.loyalty || 50) + 5);
        c.stress = Math.max(0, (c.stress || 0) - 5);
        if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) OpinionSystem.addEventOpinion(r.name, '朝廷', 5, '考课优等');
        if (typeof recordCharacterArc === 'function') recordCharacterArc(r.name, 'achievement', '考课优等(' + r.score + '分)');
        // 记忆
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
          NpcMemorySystem.addMemory(r.name, '考课获评优等，朝廷嘉许', 6, 'career');
        }
      }
    });
    // 劣等效果
    results.poor.forEach(function(r) {
      var c = findCharByName(r.name);
      if (c) {
        c.loyalty = Math.max(0, (c.loyalty || 50) - 5);
        c.stress = Math.min(100, (c.stress || 0) + 10);
        if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) OpinionSystem.addEventOpinion(r.name, '朝廷', -5, '考课劣等');
        if (typeof recordCharacterArc === 'function') recordCharacterArc(r.name, 'event', '考课劣等(' + r.score + '分)');
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
          NpcMemorySystem.addMemory(r.name, '考课获评劣等，忧惧不安', 6, 'career');
        }
      }
    });

    // 存储考课结果供AI参考
    if (!GM._annualReviewHistory) GM._annualReviewHistory = [];
    GM._annualReviewHistory.push({
      turn: GM.turn,
      excellent: results.excellent.length,
      poor: results.poor.length,
      promotions: results.promotions.map(function(r){return r.name;}),
      demotions: results.demotions.map(function(r){return r.name;})
    });
    if (GM._annualReviewHistory.length > 5) GM._annualReviewHistory = GM._annualReviewHistory.slice(-5);
  }

  return results;
}

// ============================================================
// 宰相月度建议系统（草拟-审批雏形）
// 每回合生成 2-3 个政策建议，供玩家在诏令中参考
// ============================================================
function generateChancellorSuggestions() {
  if (!GM.chars || GM.chars.length < 3) return [];
  // 找到品级最高的 NPC 作为"宰相"
  var chancellor = null;
  GM.chars.forEach(function(c) {
    if (c.isPlayer) return;
    if (!c.alive && c.alive !== undefined) return;
    if (!chancellor || (c.rankLevel || 99) < (chancellor.rankLevel || 99)) chancellor = c;
  });
  if (!chancellor) return [];

  var suggestions = [];
  // 动态读取核心指标（由 buildCoreMetricLabels 从编辑器配置构建），检查哪些指标异常
  var _labels = (typeof CORE_METRIC_LABELS === 'object') ? CORE_METRIC_LABELS : {};
  var _vars = (P.variables && Array.isArray(P.variables)) ? P.variables : [];
  for (var _ck in _labels) {
    if (!_labels.hasOwnProperty(_ck) || typeof GM[_ck] !== 'number') continue;
    var _vDef = _vars.find(function(v){return v.name===_ck;});
    var _max = (_vDef && _vDef.max) || 100;
    var _inversed = _vDef && _vDef.inversed; // 越高越差的变量（如民变、党争）
    var _label = _labels[_ck];
    if (_inversed && GM[_ck] > _max * 0.5) {
      suggestions.push({ from: chancellor.name, type: _label, text: _label + '偏高，宜加以关注' });
    } else if (!_inversed && GM[_ck] < _max * 0.4) {
      suggestions.push({ from: chancellor.name, type: _label, text: _label + '不足，宜设法改善' });
    }
  }
  // 最多3条
  return suggestions.slice(0, 3);
}

// ============================================================
// 指定继承人机制
// 玩家可为任何角色指定继承人，NPC 死亡时优先使用
// ============================================================
function designateHeir(charName, heirName) {
  var char = findCharByName(charName);
  if (!char) { toast('角色不存在'); return false; }
  var heir = findCharByName(heirName);
  if (!heir) { toast('继承人不存在'); return false; }
  char.designatedHeirId = heirName;
  _dbg('[Heir] ' + charName + ' 指定继承人: ' + heirName);
  if (typeof addEB === 'function') addEB('继承', charName + '指定' + heirName + '为继承人');
  return true;
}

/** 解析继承人（designatedHeir 优先 → AI 推演） */
// 4.5: 多继承法支持——根据 successionLaw 类型分支执行
// 继承法由编辑器在角色/势力上配置，默认无配置时使用同势力最强者
// 剧本编辑参考（勿机械读取——即使是对应朝代也不应原样照搬，仅提供配置思路）：
//   唐朝帝制：successionLaw:'primogeniture', genderRestriction:'male'
//   部落联盟：successionLaw:'seniority'
//   五代军阀：successionLaw:'elective'
function resolveHeir(deadChar) {
  if (!deadChar) return null;
  // 继承法：优先读角色自身，再读其势力的默认继承法
  var law = deadChar.successionLaw || '';
  if (!law && deadChar.faction) {
    var fac = GM.facs && GM.facs.find(function(f) { return f.name === deadChar.faction; });
    if (fac) law = fac.successionLaw || '';
  }
  var genderFilter = deadChar.genderRestriction || 'none'; // 'male'|'female'|'none'

  function _genderOk(c) {
    if (genderFilter === 'none') return true;
    return (c.gender || '') === genderFilter;
  }

  // 1. designated：指定继承人（所有法类型共享最高优先级）
  if (deadChar.designatedHeirId) {
    var heir = findCharByName(deadChar.designatedHeirId);
    if (heir && heir.alive !== false) return heir;
  }

  // 2. 根据继承法类型分支
  if (law === 'primogeniture' && deadChar.childrenIds && deadChar.childrenIds.length > 0) {
    // 嫡长子继承——年龄最大的符合性别限制的子嗣
    var children = deadChar.childrenIds.map(function(id) { return findCharByName(id); })
      .filter(function(c) { return c && c.alive !== false && _genderOk(c); })
      .sort(function(a, b) { return (b.age || 0) - (a.age || 0); });
    if (children.length > 0) return children[0];
  }

  if (law === 'seniority' && deadChar.family) {
    // 兄终弟及——同族年龄最大者
    var seniors = (GM.chars || []).filter(function(c) {
      return c.alive !== false && c.family === deadChar.family && c.name !== deadChar.name && _genderOk(c);
    }).sort(function(a, b) { return (b.age || 0) - (a.age || 0); });
    if (seniors.length > 0) return seniors[0];
  }

  if (law === 'elective' && deadChar.faction) {
    // 选贤——同势力能力最高者
    var electable = (GM.chars || []).filter(function(c) {
      return c.alive !== false && c.faction === deadChar.faction && c.name !== deadChar.name && _genderOk(c);
    }).sort(function(a, b) {
      return ((b.intelligence || 0) + (b.administration || 0) + (b.military || 0))
           - ((a.intelligence || 0) + (a.administration || 0) + (a.military || 0));
    });
    if (electable.length > 0) return electable[0];
  }

  // 3. fallback：同势力最强者（现有逻辑，适用于无继承法配置的情况）
  if (deadChar.faction) {
    var candidates = (GM.chars || []).filter(function(c) {
      return c.faction === deadChar.faction && c.name !== deadChar.name && c.alive !== false;
    });
    if (candidates.length > 0) {
      candidates.sort(function(a, b) {
        return ((b.intelligence || 0) + (b.valor || 0) + (b.loyalty || 0))
             - ((a.intelligence || 0) + (a.valor || 0) + (a.loyalty || 0));
      });
      return candidates[0];
    }
  }
  return null; // 交给 AI 推演
}

SettlementPipeline.register('annualReview', '年度考课', function() { runAnnualReview(); }, 50, 'monthly');

// ============================================================
// 目标/胜负条件系统（借鉴 ChongzhenSim goalCheck）
// 剧本可配置胜利/失败条件，每回合自动检查
// ============================================================
/** 检查所有目标的完成状态（每回合调用） */
/**
 * 统一条件评估器（支持单条件和组合条件）
 * 单条件：{type:'variable_gte', variable:'钱粮', value:5000}
 * 组合条件：{all:[条件1,条件2]} / {any:[条件1,条件2]} / {none:[条件1]}
 */
/**
 * 公式约束校验+联动执行
 * AI返回resource_changes后调用，检查constraint违反并执行coupling联动
 */
function _enforceFormulas(changes) {
  if (!GM._varFormulas || !GM._varFormulas.length) return;
  var formulas = GM._varFormulas;
  var changedVars = changes ? Object.keys(changes) : [];

  formulas.forEach(function(f) {
    if (!f.type) { _dbg('[Formula] 跳过无类型公式:', f.name); return; }
    if ((f.type === 'constraint' || f.type === 'trigger' || f.type === 'coupling') && (!f.relatedVars || !f.relatedVars.length)) {
      _dbg('[Formula] 公式' + f.name + '缺少relatedVars，跳过');
      return;
    }

    // constraint（约束校验）：检查变量是否违反约束
    if (f.type === 'constraint' && f.relatedVars) {
      f.relatedVars.forEach(function(varName) {
        var v = GM.vars[varName];
        if (!v) return;
        // 简单解析：表达式中的 >=0 / <0 / <=N 等
        var expr = f.expression || '';
        var m = expr.match(new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*(>=|<=|>|<)\\s*(\\d+)'));
        if (m) {
          var op = m[1], threshold = parseFloat(m[2]);
          var violated = false;
          if (op === '>=' && v.value < threshold) { v.value = threshold; violated = true; }
          else if (op === '<=' && v.value > threshold) { v.value = threshold; violated = true; }
          else if (op === '>' && v.value <= threshold) { v.value = threshold + 1; violated = true; }
          else if (op === '<' && v.value >= threshold) { v.value = threshold - 1; violated = true; }
          if (violated) {
            if (typeof addEB === 'function') addEB('约束', f.name + '：' + varName + '已被强制修正');
            _dbg('[Formula] 约束触发：' + f.name + ', ' + varName + '=' + v.value);
          }
        }
      });
    }

    // trigger（触发检查）：变量达到阈值时记录事件
    if (f.type === 'trigger' && f.relatedVars) {
      f.relatedVars.forEach(function(varName) {
        var v = GM.vars[varName] || (GM[varName] !== undefined ? {value:GM[varName]} : null);
        if (!v) return;
        var expr = f.expression || '';
        var m = expr.match(new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*(>=|<=|>|<)\\s*(\\d+)'));
        if (m) {
          var op = m[1], threshold = parseFloat(m[2]);
          var triggered = false;
          if (op === '<' && v.value < threshold) triggered = true;
          else if (op === '>' && v.value > threshold) triggered = true;
          else if (op === '<=' && v.value <= threshold) triggered = true;
          else if (op === '>=' && v.value >= threshold) triggered = true;
          if (triggered && typeof addEB === 'function') {
            addEB('触发', f.name + '：' + varName + '=' + Math.round(v.value));
          }
        }
      });
    }

    // coupling（联动执行）：当关联变量被改变时，检查是否需要联动
    if (f.type === 'coupling' && f.relatedVars && changedVars.length > 0) {
      var _hasChanged = f.relatedVars.some(function(rv) { return changedVars.indexOf(rv) >= 0; });
      if (_hasChanged) {
        // 将联动关系记入AI事件日志，让下回合AI叙事反映
        if (typeof addEB === 'function' && f.chains && f.chains.length > 0) {
          addEB('联动', f.name + '触发联动：' + f.chains[0]);
        }
      }
    }
  });
}

function _evalGoalCondition(cond) {
  if (!cond) return false;
  // 组合条件
  if (cond.all && Array.isArray(cond.all)) return cond.all.every(_evalGoalCondition);
  if (cond.any && Array.isArray(cond.any)) return cond.any.some(_evalGoalCondition);
  if (cond.none && Array.isArray(cond.none)) return !cond.none.some(_evalGoalCondition);
  // 单条件
  var t = cond.type || '';
  try {
    if (t === 'survive') return GM.turn >= (cond.turns || cond.value || 40);
    if (t === 'variable_gte') return GM.vars[cond.variable] && GM.vars[cond.variable].value >= cond.value;
    if (t === 'variable_lte') return GM.vars[cond.variable] && GM.vars[cond.variable].value <= cond.value;
    if (t === 'turn_reached') return GM.turn >= (cond.value || 1);
    if (t === 'character_alive') return GM.chars && GM.chars.some(function(c) { return c.name === cond.character && c.alive !== false; });
    if (t === 'character_dead') return !GM.chars || !GM.chars.some(function(c) { return c.name === cond.character && c.alive !== false; });
    if (t === 'faction_destroyed') return !GM.facs || !GM.facs.some(function(f) { return f.name === cond.faction && (f.strength || 0) > 0; });
    if (t === 'era_state') return GM.eraState && GM.eraState[cond.field] !== undefined && (cond.op === 'gte' ? GM.eraState[cond.field] >= cond.value : GM.eraState[cond.field] <= cond.value);
    if (t === 'contradiction_resolved') return GM._contradictions && GM._contradictions.some(function(c) { return c.title === cond.title && c.phase === 'resolved'; });
    if (t === 'custom' && cond.condition) return !!TM.safeEval(cond.condition, { GM: GM, P: P });
  } catch(e) { _dbg('[Goal] 条件评估失败:', t, e); }
  return false;
}

/** 计算目标进度(0-100) */
function _calcGoalProgress(goal) {
  if (goal.completed) return 100;
  var conds = goal.conditions || [];
  if (conds.length === 0) {
    // 旧格式：直接从goal对象读type
    if (goal.type === 'survive') return Math.min(100, Math.round(GM.turn / (goal.turns || 40) * 100));
    if (goal.type === 'variable_gte' && GM.vars[goal.variable]) return Math.min(100, Math.round(GM.vars[goal.variable].value / goal.value * 100));
    return 0;
  }
  // 多条件：已完成条件数/总数
  var met = conds.filter(_evalGoalCondition).length;
  return Math.round(met / conds.length * 100);
}

function checkGoals() {
  if (!P.goals || P.goals.length === 0) return;
  P.goals.forEach(function(goal) {
    if (goal.completed) return;
    goal.progress = _calcGoalProgress(goal);

    // 判断是否达成
    var met = false;
    if (goal.conditions && goal.conditions.length > 0) {
      // 新格式：用组合条件
      met = goal.conditions.every(_evalGoalCondition);
    } else {
      // 旧格式：用type字段
      met = _evalGoalCondition(goal);
    }

    if (met) {
      goal.completed = true;
      goal.completedTurn = GM.turn;
      goal.progress = 100;

      if (goal.type === 'milestone' || (!goal.winCondition && !goal.loseCondition)) {
        // 里程碑：记入编年+起居注
        addEB('里程碑', '达成：' + (goal.title || goal.name));
        if (GM.biannianItems) GM.biannianItems.unshift({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', title: '里程碑：' + (goal.title || goal.name), content: goal.description || '', importance: 'high' });
      }

      if (goal.winCondition) {
        var allWinsMet = P.goals.filter(function(g) { return g.winCondition; }).every(function(g) { return g.completed; });
        if (allWinsMet) {
          addEB('胜利', '所有胜利条件已达成！');
          // 延迟弹出终局画面
          setTimeout(function() { _showVictoryScreen(); }, 1000);
        }
      }
      if (goal.loseCondition) {
        addEB('失败', '触发失败条件：' + (goal.title || goal.name));
        setTimeout(function() { _showDefeatScreen(goal); }, 1000);
      }
    }
  });
}

/** 胜利终局画面 */
function _showVictoryScreen() { _showEndgameScreen('victory'); }

/** 失败终局画面 */
function _showDefeatScreen(failGoal) { _showEndgameScreen('defeat', failGoal); }

/** 9.4: 统一终局画面（含数据回顾） */
function _showEndgameScreen(type, failGoal) {
  var isVictory = type === 'victory';
  var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
  var _ts = typeof getTSText === 'function' ? getTSText(GM.turn) : '\u7B2C' + GM.turn + '\u56DE\u5408';
  var accentColor = isVictory ? 'var(--gold-400)' : 'var(--vermillion-400)';
  var completedGoals = (P.goals || []).filter(function(g) { return g.completed; });

  var h = '<div style="position:fixed;inset:0;z-index:1500;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fi 0.5s ease;overflow-y:auto;" id="_endgame">';
  h += '<div style="max-width:640px;width:90%;padding:2rem;max-height:90vh;overflow-y:auto;">';

  // 标题
  h += '<div style="height:2px;background:linear-gradient(90deg,transparent,' + accentColor + ',transparent);margin-bottom:1.5rem;"></div>';
  h += '<div style="text-align:center;font-size:2rem;color:' + accentColor + ';font-weight:700;letter-spacing:0.3em;">' + (isVictory ? '\u5929 \u547D \u5DF2 \u6210' : '\u5929 \u547D \u5DF2 \u7EDD') + '</div>';
  h += '<div style="text-align:center;font-size:0.85rem;color:var(--color-foreground-muted);margin:0.5rem 0;">' + _ts + ' \u00B7 \u5171' + GM.turn + '\u56DE\u5408</div>';
  h += '<hr style="border:none;height:1px;background:var(--color-border-subtle);margin:1rem 0;">';

  // 目标/败因
  if (isVictory && completedGoals.length > 0) {
    h += '<div style="margin-bottom:1rem;">';
    completedGoals.forEach(function(g) { h += '<div style="font-size:0.82rem;margin-bottom:3px;color:var(--celadon-400);">\u2713 ' + escHtml(g.title || g.name) + '</div>'; });
    h += '</div>';
  }
  if (!isVictory && failGoal) {
    h += '<div style="text-align:center;font-size:0.9rem;color:var(--vermillion-300);margin-bottom:0.5rem;">' + escHtml(failGoal.title || failGoal.name || '\u5931\u8D25') + '</div>';
    if (failGoal.description) h += '<div style="text-align:center;font-size:0.78rem;color:var(--color-foreground-muted);margin-bottom:1rem;">' + escHtml(failGoal.description) + '</div>';
  }

  // 太史公三段评语
  h += '<div id="_taishigong" style="font-size:0.85rem;color:var(--color-foreground-muted);font-style:italic;padding:0.8rem;background:var(--color-elevated);border-radius:8px;border-left:3px solid ' + accentColor + ';margin-bottom:1.2rem;">\u592A\u53F2\u516C\u6B63\u5728\u64B0\u5199\u8BC4\u8BED\u2026\u2026</div>';

  // 标签页切换
  h += '<div style="display:flex;gap:4px;margin-bottom:0.8rem;">';
  h += '<button class="bt bs bsm _endtab active" onclick="_endTabSwitch(this,\'_end-metrics\')" style="flex:1;">\u6307\u6807\u53D8\u5316</button>';
  h += '<button class="bt bs bsm _endtab" onclick="_endTabSwitch(this,\'_end-timeline\')" style="flex:1;">\u4E8B\u4EF6\u65F6\u95F4\u7EBF</button>';
  h += '<button class="bt bs bsm _endtab" onclick="_endTabSwitch(this,\'_end-npc\')" style="flex:1;">NPC\u547D\u8FD0</button>';
  h += '</div>';

  // === 标签页1：核心指标变化曲线 ===
  h += '<div id="_end-metrics" class="_end-panel" style="display:block;">';
  var history = GM._metricHistory || [];
  if (history.length > 1) {
    // 动态读取核心指标（从CORE_METRIC_LABELS，编辑器定义）
    var metricKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];
    // 补充vars中isCore的
    Object.entries(GM.vars||{}).forEach(function(e) { if (e[1].isCore && metricKeys.indexOf(e[0]) < 0) metricKeys.push(e[0]); });
    var colors = ['var(--gold-400)','var(--celadon-400)','var(--vermillion-400)','var(--indigo-400)','#e67e22','#9b59b6','#1abc9c','#e74c3c'];
    metricKeys.slice(0, 8).forEach(function(key, ki) {
      var label = (typeof CORE_METRIC_LABELS === 'object' && CORE_METRIC_LABELS[key]) || key;
      var vals = history.map(function(s) { return s[key] || 0; });
      var maxV = Math.max.apply(null, vals.concat([1]));
      var minV = Math.min.apply(null, vals.concat([0]));
      var range = Math.max(maxV - minV, 1);
      var col = colors[ki % colors.length];
      // 纯CSS迷你折线（用inline SVG polyline）
      var w = 100, ht = 30;
      var points = vals.map(function(v, vi) {
        var x = (vi / Math.max(vals.length - 1, 1)) * w;
        var y = ht - ((v - minV) / range) * ht;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
      h += '<span style="width:60px;font-size:0.7rem;color:var(--color-foreground-muted);text-align:right;">' + escHtml(label) + '</span>';
      h += '<svg viewBox="0 0 ' + w + ' ' + ht + '" style="flex:1;height:30px;"><polyline points="' + points + '" fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      h += '<span style="width:35px;font-size:0.7rem;color:' + col + ';text-align:right;">' + vals[vals.length - 1] + '</span>';
      h += '</div>';
    });
  } else {
    h += '<div style="color:var(--color-foreground-muted);text-align:center;padding:1rem;">\u6570\u636E\u4E0D\u8DB3\uFF08\u9700\u81F3\u5C112\u56DE\u5408\uFF09</div>';
  }
  h += '</div>';

  // === 标签页2：关键事件时间轴 ===
  h += '<div id="_end-timeline" class="_end-panel" style="display:none;">';
  var _keyEvents = (GM.evtLog || []).filter(function(e) {
    return /\u6218|\u53DB|\u4EA1|\u7B5B|\u5A5A|\u6539\u9769|\u79D1\u4E3E|\u7EE7\u627F|\u9A7E\u5D29|\u6210\u5C31|\u4F0F\u7B14|\u8F6C\u6298|\u706D|\u5BA3\u6218/.test(e.text || '');
  });
  if (_keyEvents.length > 0) {
    _keyEvents.slice(-30).forEach(function(evt) {
      var _evtDate = typeof getTSText === 'function' ? getTSText(evt.turn) : 'T' + evt.turn;
      var _evtCol = /\u6218|\u53DB|\u4EA1|\u706D/.test(evt.text) ? 'var(--vermillion-400)' : /\u5A5A|\u79D1\u4E3E|\u6210\u5C31/.test(evt.text) ? 'var(--celadon-400)' : 'var(--gold-400)';
      h += '<div style="display:flex;gap:8px;margin-bottom:4px;font-size:0.75rem;">';
      h += '<span style="color:var(--color-foreground-muted);width:80px;flex-shrink:0;">' + _evtDate + '</span>';
      h += '<span style="width:6px;height:6px;border-radius:50%;background:' + _evtCol + ';margin-top:4px;flex-shrink:0;"></span>';
      h += '<span style="color:var(--color-foreground-secondary);">' + escHtml(evt.text || '') + '</span>';
      h += '</div>';
    });
  } else {
    h += '<div style="color:var(--color-foreground-muted);text-align:center;padding:1rem;">\u65E0\u5173\u952E\u4E8B\u4EF6\u8BB0\u5F55</div>';
  }
  h += '</div>';

  // === 标签页3：NPC命运总结 ===
  h += '<div id="_end-npc" class="_end-panel" style="display:none;">';
  var _allChars = (GM.chars || []).sort(function(a, b) { return (b.importance || 50) - (a.importance || 50); });
  _allChars.forEach(function(c) {
    var alive = c.alive !== false;
    var statusIcon = alive ? '\u25CF' : '\u2620';
    var statusCol = alive ? 'var(--celadon-400)' : 'var(--vermillion-400)';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:0.75rem;padding:3px 6px;background:var(--color-elevated);border-radius:4px;">';
    h += '<span style="color:' + statusCol + ';">' + statusIcon + '</span>';
    h += (c.portrait ? '<img src="'+escHtml(c.portrait)+'" style="width:24px;height:24px;object-fit:cover;border-radius:50%;flex-shrink:0;">' : '');
    h += '<span style="font-weight:600;color:var(--color-foreground);width:50px;">' + escHtml(c.name) + '</span>';
    h += '<span style="color:var(--color-foreground-muted);flex:1;">' + escHtml(c.officialTitle || c.title || '') + '</span>';
    h += '<span style="font-size:0.68rem;color:var(--color-foreground-muted);">\u5FE0' + Math.round(c.loyalty || 0) + '</span>';
    if (!alive && c.deathReason) h += '<span style="font-size:0.65rem;color:var(--vermillion-400);"> ' + escHtml(c.deathReason) + '</span>';
    h += '</div>';
  });
  if (_allChars.length > 20) h += '<div style="font-size:0.68rem;color:var(--color-foreground-muted);text-align:center;">\u2026\u53CA\u53E6\u5916' + (_allChars.length - 20) + '\u4EBA</div>';
  h += '</div>';

  // 关闭按钮
  h += '<div style="text-align:center;margin-top:1.2rem;">';
  h += '<button class="bt bp" style="padding:0.6rem 2rem;" onclick="document.getElementById(\'_endgame\').remove();">' + (isVictory ? '\u5F52\u53BB\u6765\u516E' : '\u518D\u6765\u4E00\u5C40') + '</button>';
  h += '</div></div></div>';

  document.body.insertAdjacentHTML('beforeend', h);

  // AI生成太史公三段评语
  if (P.ai && P.ai.key && typeof callAI === 'function') {
    // 收集核心指标最终值
    var _finalStats = [];
    var _coreKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];
    _coreKeys.forEach(function(k) {
      var label = CORE_METRIC_LABELS[k] || k;
      var val = typeof GM[k] === 'number' ? Math.round(GM[k]) : ((GM.vars[k] && GM.vars[k].value !== undefined) ? Math.round(GM.vars[k].value) : '?');
      _finalStats.push(label + val);
    });
    var _deadCount = (GM.chars || []).filter(function(c) { return c.alive === false; }).length;
    var _warCount = (GM.evtLog || []).filter(function(e) { return /\u6218|\u5BA3\u6218/.test(e.text); }).length;

    var prompt = '\u4F60\u662F\u592A\u53F2\u516C\u3002\u8BF7\u7528\u6587\u8A00\u6587\u8BC4\u4EF7\u8FD9\u4F4D\u541B\u4E3B\u7684\u529F\u8FC7\u3002' +
      '\u5728\u4F4D' + GM.turn + '\u56DE\u5408' + (sc ? '\uFF0C\u5267\u672C\uFF1A' + sc.name : '') + '\u3002' +
      (isVictory ? '\u5B8C\u6210\u76EE\u6807\uFF1A' + completedGoals.map(function(g){return g.title||g.name;}).join('\u3001') : '\u5931\u8D25\uFF1A' + (failGoal ? failGoal.title || failGoal.name : '')) + '\u3002' +
      '\u6838\u5FC3\u6307\u6807\uFF1A' + _finalStats.join('\u3001') + '\u3002' +
      '\u6B7B\u4EA1' + _deadCount + '\u4EBA\uFF0C\u6218\u4E89\u4E8B\u4EF6' + _warCount + '\u6B21\u3002' +
      '\n\u8BF7\u5206\u4E09\u6BB5\u8BC4\u4EF7\uFF0C\u6BCF\u6BB5\u7528\u3010\u3011\u6807\u6CE8\u4E3B\u9898\uFF1A\n' +
      '\u3010\u6587\u6CBB\u3011\u5185\u653F\u6C11\u751F\u65B9\u9762\u7684\u8BC4\u4EF7(50\u5B57)\n' +
      '\u3010\u6B66\u529F\u3011\u519B\u4E8B\u5916\u4EA4\u65B9\u9762\u7684\u8BC4\u4EF7(50\u5B57)\n' +
      '\u3010\u603B\u8BC4\u3011\u7EFC\u5408\u8BC4\u4EF7\u548C\u5386\u53F2\u5730\u4F4D(80\u5B57)\n' +
      '\u76F4\u63A5\u8FD4\u56DE\u4E09\u6BB5\u6587\u5B57\uFF0C\u4E0D\u8981JSON\u3002';
    callAI(prompt, 600).then(function(r) {
      var el = document.getElementById('_taishigong');
      if (el) el.innerHTML = '\u592A\u53F2\u516C\u66F0\uFF1A<br>' + escHtml(r).replace(/\u3010/g, '<br><b style="color:' + accentColor + ';">\u3010').replace(/\u3011/g, '\u3011</b>');
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '\u592A\u53F2\u516C] \u751F\u6210\u5931\u8D25:') : console.warn('[\u592A\u53F2\u516C] \u751F\u6210\u5931\u8D25:', e); });
  }
}

// 9.4: 终局标签页切换
function _endTabSwitch(btn, panelId) {
  document.querySelectorAll('._end-panel').forEach(function(p) { p.style.display = 'none'; });
  document.querySelectorAll('._endtab').forEach(function(b) { b.classList.remove('active'); });
  var panel = document.getElementById(panelId);
  if (panel) panel.style.display = 'block';
  if (btn) btn.classList.add('active');
}

// ============================================================
// 2.6: 事件总线监听器注册
// 角色死亡 → 自动添加叙事事实 (与 1.4 配合)
// ============================================================
if (typeof GameEventBus !== 'undefined') {
  GameEventBus.on('character:death', function(data) {
    // 自动添加不可逆叙事事实
    if (!GM._mutableFacts) GM._mutableFacts = [];
    var factStr = '\u300C' + data.name + '\u300D\u5DF2\u6545\uFF08' + (data.reason || '') + '\uFF09\uFF0C\u4E0D\u5F97\u590D\u6D3B';
    // 避免重复
    if (GM._mutableFacts.indexOf(factStr) < 0) {
      GM._mutableFacts.push(factStr);
      if (GM._mutableFacts.length > 30) GM._mutableFacts.shift();
    }
    // 2.6: 角色死亡→紧急警告（重要角色）或驻留通知（普通角色）
    var _ch = typeof findCharByName === 'function' ? findCharByName(data.name) : null;
    var _isImportant = _ch && (_ch.isPlayer || (_ch.importance && _ch.importance >= 80) || _ch.isRuler);
    if (_isImportant && typeof notifyUrgent === 'function') {
      notifyUrgent(data.name + ' \u6B83', data.reason || '');
    } else if (typeof notifyPersist === 'function') {
      notifyPersist(data.name + ' \u6B83\uFF1A' + (data.reason || ''), '\u2620');
    }
    // 级联：清 officeTree 所有 holder 登记·让职位空缺可见·生成空缺事件
    try {
      if (typeof _offVacateByCharName === 'function') {
        var _vr = _offVacateByCharName(data.name, 'death');
        if (_vr && _vr.vacated && _vr.vacated.length > 0) {
          // 起居注登记每个空缺
          if (!GM._chronicle) GM._chronicle = [];
          _vr.vacated.forEach(function(v){
            GM._chronicle.push({
              turn: GM.turn || 0, date: GM._gameDate || '',
              type: '官缺',
              text: v.chain + '·' + v.pos + '\u00B7\u56E0 ' + data.name + ' \u6B83\u800C\u7F3A\u5458',
              tags: ['官职','身故','缺员']
            });
          });
          // 诏令跟踪器·登记待补空缺（AI 推演可见）
          if (!GM._edictTracker) GM._edictTracker = [];
          var _summary = _vr.vacated.map(function(v){ return v.pos; }).slice(0,3).join('、') + (_vr.vacated.length>3?'等':'');
          GM._edictTracker.push({
            id: 'vacancy_death_' + Date.now() + '_' + data.name,
            content: data.name + ' \u8EAB\u6545\u00B7\u6240\u4EFB ' + _summary + ' \u7B49\u5DF2\u7F3A\u5458\u00B7\u5F85\u8BCF\u8865\u4EFB\u3002',
            category: '官缺',
            turn: GM.turn || 0, status: 'pending',
            assignee: '', feedback: '',
            progressPercent: 0,
            _vacancyFromDeath: { name: data.name, positions: _vr.vacated }
          });
          // UI 刷新（若官制面板当前在显示）
          if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
        }
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'character:death vacate cascade') : console.error('[character:death vacate cascade]', e); }
  });

  // 角色贬谪/免职也应级联清 officeTree（某些流程只改 officialTitle 不清 tree）
  GameEventBus.on('character:demote', function(data) {
    if (!data || !data.name) return;
    try {
      if (typeof _offVacateByCharName === 'function') {
        _offVacateByCharName(data.name, data.reason || 'demote');
        if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-helpers');}catch(_){}}
  });

  // 2.6: 战争爆发→紧急警告
  GameEventBus.on('war:start', function(data) {
    if (typeof notifyUrgent === 'function') {
      notifyUrgent('\u6218\u4E89\u7206\u53D1', (data.attacker||'') + ' \u5411 ' + (data.defender||'') + ' \u5BA3\u6218');
    }
  });

  // 2.6: 成就解锁→驻留通知
  GameEventBus.on('achievement:unlock', function(data) {
    if (typeof notifyPersist === 'function') {
      notifyPersist('\u6210\u5C31\u89E3\u9501\uFF1A' + (data.name || data.title || ''), '\uD83C\uDFC6');
    }
  });

  // 2.6: 势力灭亡→紧急警告
  GameEventBus.on('faction:defeated', function(data) {
    if (typeof notifyUrgent === 'function') {
      notifyUrgent((data.name||'\u52BF\u529B') + ' \u706D\u4EA1', data.reason || '');
    }
  });
}

// 注册到结算流水线
// 1.8: 时代进度分析（纯信息注入，不直接修改朝代阶段）
// 评估编辑器配置的衰退/中兴规则，将满足的条件注入 GM._eraProgressReport
// 朝代阶段转换由 AI 在推演中自行决定（通过 era_state_delta）
SettlementPipeline.register('eraProgress', '时代进度', function() {
  if (!GM.eraProgress) GM.eraProgress = { collapse: 0, restoration: 0 };
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
  var ep = (P.mechanicsConfig && P.mechanicsConfig.eraProgress) || {};
  var collapseFactors = [];
  var restorationFactors = [];

  // 评估衰退条件（不修改数值，仅收集）
  (ep.collapseRules || []).forEach(function(rule) {
    try {
      if (TM.safeEval(rule.condition, { GM: GM })) {
        collapseFactors.push(rule.label || rule.condition);
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-helpers');}catch(_){}}
  });
  // 评估中兴条件
  (ep.restorationRules || []).forEach(function(rule) {
    try {
      if (TM.safeEval(rule.condition, { GM: GM })) {
        restorationFactors.push(rule.label || rule.condition);
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-helpers');}catch(_){}}
  });

  // 汇总为AI参考信息
  var report = '';
  var curPhase = (GM.eraState && GM.eraState.dynastyPhase) || 'stable';
  report += '\u5F53\u524D\u671D\u4EE3\u9636\u6BB5\uFF1A' + curPhase;
  if (collapseFactors.length > 0) {
    report += '\u3002\u8870\u9000\u538B\u529B(' + collapseFactors.length + ')\uFF1A' + collapseFactors.join('\u3001');
  }
  if (restorationFactors.length > 0) {
    report += '\u3002\u4E2D\u5174\u52A8\u529B(' + restorationFactors.length + ')\uFF1A' + restorationFactors.join('\u3001');
  }
  if (collapseFactors.length > restorationFactors.length) {
    report += '\u3002\u603B\u4F53\u8D8B\u52BF\uFF1A\u8870\u9000\u538B\u529B>\u4E2D\u5174\u52A8\u529B\uFF0CAI\u5E94\u8003\u8651\u662F\u5426\u8FDB\u5165\u66F4\u6DF1\u5371\u673A\u3002';
  } else if (restorationFactors.length > collapseFactors.length) {
    report += '\u3002\u603B\u4F53\u8D8B\u52BF\uFF1A\u4E2D\u5174\u52A8\u529B>\u8870\u9000\u538B\u529B\uFF0CAI\u5E94\u8003\u8651\u662F\u5426\u56DE\u5347\u3002';
  }
  GM._eraProgressReport = (collapseFactors.length > 0 || restorationFactors.length > 0) ? report : '';
  // 更新UI进度条展示值（按满足条件占总规则数的比例，仅供UI展示，不触发阶段转换）
  var totalCollapseRules = (ep.collapseRules || []).length || 1;
  var totalRestorationRules = (ep.restorationRules || []).length || 1;
  GM.eraProgress.collapse = Math.round(collapseFactors.length / totalCollapseRules * 100);
  GM.eraProgress.restoration = Math.round(restorationFactors.length / totalRestorationRules * 100);
  DebugLog.log('eraProgress', '\u8870\u9000\u56E0\u5B50:', collapseFactors, '\u4E2D\u5174\u56E0\u5B50:', restorationFactors);
}, 16, 'perturn');

// 1.9: 边患聚合（从敌对势力计算）
SettlementPipeline.register('borderThreatAgg', '\u8FB9\u60A3\u805A\u5408', function() {
  var playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
  if (!playerFac) { GM.borderThreat = 0; return; }
  var _hostileTypes = ['\u654C\u5BF9','\u6218\u4E89','\u654C\u89C6','\u4EA4\u6218','hostile','war','\u4FB5\u7565'];
  var hostileFacs = (GM.facs || []).filter(function(f) {
    if (!f.name || f.name === playerFac || f.isPlayer) return false;
    // 方式1: playerRelation低于-50视为敌对
    if ((f.playerRelation || 0) < -50) return true;
    // 方式2: 从factionRelations中查找敌对关系
    var rel = (GM.factionRelations || []).find(function(r) {
      return (r.from === playerFac && r.to === f.name) || (r.from === f.name && r.to === playerFac);
    });
    return rel && rel.type && _hostileTypes.indexOf(rel.type) >= 0;
  });
  if (hostileFacs.length === 0) { GM.borderThreat = 0; return; }
  var totalThreat = 0;
  hostileFacs.forEach(function(f) { totalThreat += (f.strength || 50); });
  GM.borderThreat = Math.min(100, Math.round(totalThreat / hostileFacs.length));
}, 17, 'perturn');

// ============================================================
// 2.1: 状态耦合规则引擎（纯信息注入，不直接修改数值）
// 评估编辑器配置的 couplingRules[]，将满足条件的规则和建议变化量
// 注入 GM._couplingReport，供 AI prompt 参考。AI自行决定实际变化。
// ============================================================
SettlementPipeline.register('stateCoupling', '状态耦合', function() {
  var mc = (typeof P !== 'undefined' && P.mechanicsConfig) ? P.mechanicsConfig : {};
  var rules = mc.couplingRules;
  if (!rules || !rules.length) return;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
  var monthScale = tr * 12;
  var triggered = [];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (!rule.if || !rule.target || !rule.perMonth) continue;
    try {
      var condResult = TM.safeEval(rule.if, {
        GM: GM,
        taxPressure: GM.taxPressure || 0,
        corruption: (GM.corruption || {}).trueIndex || 0,
        borderThreat: GM.borderThreat || 0,
        eraState: GM.eraState || {}
      });
      if (!condResult) continue;
    } catch(e) {
      DebugLog.log('coupling', '\u89C4\u5219\u6761\u4EF6\u8BC4\u4F30\u5931\u8D25:', rule.if, e.message);
      continue;
    }
    // 计算建议变化量（仅供AI参考，不实际应用）
    var suggestedDelta = Math.round(rule.perMonth * monthScale * 10) / 10;
    var currentVal = (GM.hasOwnProperty(rule.target) && typeof GM[rule.target] === 'number') ? Math.round(GM[rule.target]) : '?';
    triggered.push({
      reason: rule.reason || rule.if,
      target: rule.target,
      currentVal: currentVal,
      suggestedDelta: suggestedDelta
    });
    DebugLog.log('coupling', '\u89C4\u5219\u89E6\u53D1(AI\u53C2\u8003):', rule.reason, rule.target, '\u5EFA\u8BAE' + (suggestedDelta >= 0 ? '+' : '') + suggestedDelta);
  }
  // 汇总为自然语言提示注入 AI prompt
  if (triggered.length > 0) {
    var reportParts = triggered.map(function(t) {
      return t.reason + '\u2192\u5EFA\u8BAE' + t.target + (t.suggestedDelta >= 0 ? '+' : '') + t.suggestedDelta + '(\u5F53\u524D' + t.currentVal + ')';
    });
    GM._couplingReport = '\u3010\u72B6\u6001\u8054\u52A8\u53C2\u8003\u3011' + reportParts.join('\uFF1B') + '\u3002\u4EE5\u4E0A\u4EC5\u4E3A\u53C2\u8003\uFF0CAI\u53EF\u6839\u636E\u5B9E\u9645\u5C40\u52BF\u81EA\u884C\u51B3\u5B9A\u5B9E\u9645\u53D8\u5316\u5E45\u5EA6\u3002';
  } else {
    GM._couplingReport = '';
  }
  if (triggered.length && typeof addEB === 'function') {
    addEB('\u8026\u5408', '\u72B6\u6001\u8054\u52A8\u53C2\u8003\uFF1A' + triggered.map(function(t){return t.reason;}).join('\u3001'));
  }
}, 24, 'perturn');

// ============================================================
// 3.1: NPC行为意图分析（为AI提供参考信息，不做机械兜底）
// 根据角色重要度/性格/记忆/局势分析行为倾向，注入AI prompt
// AI完全有权忽略这些倾向
// ============================================================
function computeNpcIntents() {
  if (!GM.chars || GM.chars.length < 2) return;
  var mc = (typeof P !== 'undefined' && P.mechanicsConfig) ? P.mechanicsConfig : {};
  var cfg = mc.npcIntentConfig || {};
  var behaviorTypes = mc.npcBehaviorTypes || [];
  // 如果编辑器没有配置行为类型，不计算意图
  if (!behaviorTypes.length) { GM._npcIntents = []; return; }

  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var highInterval = cfg.highImportanceIntervalDays || 15;
  var midInterval = cfg.midImportanceIntervalDays || 45;
  var lowInterval = cfg.lowImportanceIntervalDays || 90;

  var intents = [];
  GM.chars.forEach(function(c) {
    if (c.isPlayer || c.alive === false) return;
    // 角色重要度（编辑器定义，默认50）
    var importance = c.importance || 50;
    // 根据重要度确定分析间隔（天）
    var intervalDays = importance > 70 ? highInterval : importance > 30 ? midInterval : lowInterval;
    // 判断本回合是否轮到该NPC（基于天数而非回合数）
    var turnsSinceStart = GM.turn - (c._lastIntentTurn || 0);
    var daysSinceStart = turnsSinceStart * dpv;
    if (daysSinceStart < intervalDays && c._lastIntentTurn) return;
    c._lastIntentTurn = GM.turn;

    // 从配置的行为类型中，根据角色属性计算倾向权重
    var bestBehavior = null, bestWeight = 0;
    behaviorTypes.forEach(function(bt) {
      if (!bt.id || !bt.name) return;
      var weight = 10; // 基础权重
      // 根据行为类型配置的属性加成计算权重
      if (bt.weightFactors) {
        for (var attr in bt.weightFactors) {
          if (bt.weightFactors.hasOwnProperty(attr) && typeof c[attr] === 'number') {
            weight += c[attr] * bt.weightFactors[attr];
          }
        }
      }
      // 记忆修正：如果有相关情绪记忆，调整权重
      if (c._memory && c._memory.length > 0 && bt.memoryKeywords) {
        c._memory.forEach(function(mem) {
          if (bt.memoryKeywords.some(function(kw) { return (mem.text || '').indexOf(kw) >= 0; })) {
            weight += 10;
          }
        });
      }
      // 随机扰动保持多样性
      weight += Math.floor((typeof random === 'function' ? random() : Math.random()) * 15);
      if (weight > bestWeight) { bestWeight = weight; bestBehavior = bt; }
    });

    if (bestBehavior && bestWeight > 20) {
      intents.push({
        name: c.name,
        behavior: bestBehavior.id,
        behaviorName: bestBehavior.name,
        weight: Math.round(bestWeight),
        importance: importance
      });
    }
  });

  // 按权重排序，截取前20个（避免prompt过长）
  intents.sort(function(a, b) { return b.weight - a.weight; });
  GM._npcIntents = intents.slice(0, 20);
  DebugLog.log('npc', 'NPC意图分析完成:', GM._npcIntents.length, '个');
}

SettlementPipeline.register('npcIntentAnalysis', 'NPC意图分析', function() {
  computeNpcIntents();
}, 10, 'perturn'); // priority 10: 在AI调用前执行

// 4.3: NPC主动事件提案——扫描满足条件的NPC，生成提案注入AI prompt
SettlementPipeline.register('npcEventProposal', 'NPC事件提案', function() {
  if (!GM.chars) return;
  var proposals = [];
  GM.chars.forEach(function(c) {
    if (c.alive === false || c.isPlayer) return;
    var loy = c.loyalty || 50;
    var amb = c.ambition || 50;
    var stress = c.stress || 0;
    var health = c.health || 100;
    // 叛乱条件
    if (loy < 20 && amb > 80) proposals.push({name:c.name, type:'rebellion', desc:c.name+'忠诚极低('+loy+')且野心极高('+amb+')，可能叛乱'});
    // 辞官/崩溃
    if (stress > 80) proposals.push({name:c.name, type:'breakdown', desc:c.name+'压力过大('+stress+')，可能辞官或崩溃'});
    // 联姻意向
    if (!c.spouse && c.age && c.age > 16 && c.age < 45 && (c.importance||50) >= 60) {
      proposals.push({name:c.name, type:'marriage', desc:c.name+'适婚且有分量，可考虑联姻'});
    }
    // 目标驱动事件
    if (c.personalGoals) {
      c.personalGoals.forEach(function(g) {
        if (g.type === 'revenge' && g.progress >= 50) proposals.push({name:c.name, type:'revenge', desc:c.name+'复仇目标进度'+g.progress+'%，可能采取激烈行动'});
        if (g.type === 'power' && g.progress >= 80) proposals.push({name:c.name, type:'power_grab', desc:c.name+'权力目标即将达成('+g.progress+'%)，可能发起关键行动'});
      });
    }
    // 健康危机
    if (health < 10 && health > 0) proposals.push({name:c.name, type:'death_risk', desc:c.name+'健康极差('+Math.round(health)+')，可能病亡'});
  });
  GM._npcEventProposals = proposals.slice(0, 10);
}, 11, 'perturn');

// ============================================================
// 4.4: 角色健康分析（信息注入模式）
// 基础自然老化衰减保留（极缓慢，代表生理规律），但：
//  - 不因deathYear机械加速衰减，改为信息提示让AI自行决定
//  - health=0时不直接杀人，生成提示让AI通过character_deaths决定
//  - AI可通过char_updates中的health相关行为来调整health
// ============================================================
SettlementPipeline.register('healthDecay', '\u89D2\u8272\u5065\u5EB7\u5206\u6790', function() {
  if (!GM.chars) return;
  var mc = (typeof P !== 'undefined' && P.mechanicsConfig && P.mechanicsConfig.characterRules) ? P.mechanicsConfig.characterRules : {};
  var hCfg = mc.healthConfig || {};
  var monthlyDecay = hCfg.monthlyDecay || 0.1;
  var ageThreshold = hCfg.ageAccelThreshold || 60;
  var ageAccelRate = hCfg.ageAccelRate || 0.3;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1 / 12);
  var monthScale = tr * 12;
  var healthAlerts = [];

  GM.chars.forEach(function(c) {
    if (c.alive === false) return;
    if (c.health === undefined) c.health = 100;
    var age = c.age || 30;
    // 基础自然老化（极缓慢，代表生理规律，非AI可控范围）
    var decay = monthlyDecay * monthScale;
    if (age > ageThreshold) decay += ageAccelRate * monthScale;
    c.health = Math.max(0, Math.round((c.health - decay) * 100) / 100);

    // 史实角色deathYear——不再机械扣血，改为信息提示
    if (c.deathYear && typeof calcDateFromTurn === 'function') {
      var dateInfo = calcDateFromTurn(GM.turn);
      if (dateInfo && dateInfo.adYear >= c.deathYear) {
        var yearsPast = dateInfo.adYear - c.deathYear;
        healthAlerts.push(c.name + '\u5DF2\u8FC7\u53F2\u5B9E\u5356\u5E74(' + c.deathYear + '\u5E74\uFF0C\u5DF2\u8FC7' + yearsPast + '\u5E74)\uFF0CAI\u5E94\u8003\u8651\u5176\u5065\u5EB7\u72B6\u51B5(health:' + Math.round(c.health) + ')');
      }
    }

    // 生成AI提示
    if (c.health <= 0) {
      healthAlerts.push(c.name + '\u5DF2\u6CB9\u5C3D\u706F\u67AF(health:0)\uFF0CAI\u5E94\u5728character_deaths\u4E2D\u5904\u7406');
      if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(c.name, '\u75C5\u5165\u818F\u80B2\uFF0C\u547D\u60AC\u4E00\u7EBF', '\u5FE7', 9);
    } else if (c.health < 20) {
      healthAlerts.push(c.name + '\u4F53\u5F31\u591A\u75C5(health:' + Math.round(c.health) + ')\uFF0C\u8FD1\u671F\u53EF\u80FD\u75C5\u4EA1');
      if (typeof NpcMemorySystem !== 'undefined' && !c._healthMemoryWritten) {
        NpcMemorySystem.remember(c.name, '\u8EAB\u67D3\u91CD\u75BE\uFF0C\u4F53\u529B\u4E0D\u652F', '\u5FE7', 7);
        c._healthMemoryWritten = true;
      }
    }
  });
  GM._healthAlerts = healthAlerts;
}, 12, 'perturn');

// 4.5: 派系内部动态——检测领袖更迭条件，注入AI prompt
SettlementPipeline.register('partyDynamics', '党派内部动态', function() {
  if (!GM.parties || GM.parties.length === 0) { GM._partyDynamics = []; return; }
  var dynamics = [];
  GM.parties.forEach(function(party) {
    if (!party.name) return;
    var members = (GM.chars||[]).filter(function(c){return c.alive!==false && c.party===party.name;});
    if (members.length < 2) return;
    var leader = members.find(function(c){return c.name===party.leader;});
    if (!leader) return;
    // 检测挑战者：party内influence/ambition最高且非leader的人
    var challenger = null;
    members.forEach(function(c) {
      if (c.name === party.leader) return;
      var cScore = (c.ambition||50) + (c.influence||0);
      var lScore = (leader.ambition||50) + (leader.influence||0);
      if (cScore > lScore && (c.ambition||50) > 70) {
        if (!challenger || cScore > ((challenger.ambition||50) + (challenger.influence||0))) challenger = c;
      }
    });
    if (challenger) {
      dynamics.push({party:party.name, type:'leadership_challenge',
        desc:party.name + '内部：' + challenger.name + '(野心' + (challenger.ambition||50) + ')挑战领袖' + leader.name + '的地位'});
    }
    // 检测路线分歧（stance不同的成员）
    var stances = {};
    members.forEach(function(c){ var s = c.stance||'neutral'; stances[s] = (stances[s]||0)+1; });
    var stanceKeys = Object.keys(stances);
    if (stanceKeys.length >= 2) {
      dynamics.push({party:party.name, type:'ideological_split',
        desc:party.name + '内部路线分歧：' + stanceKeys.map(function(s){return s+'派'+stances[s]+'人';}).join(' vs ')});
    }
  });
  GM._partyDynamics = dynamics.slice(0, 8);
}, 25, 'perturn');

// 4.6: 重大决策扫描——检查NPC是否满足决策条件，结果供AI prompt注入
SettlementPipeline.register('decisionScan', '决策扫描', function() {
  if (typeof DecisionRegistry === 'undefined') return;
  DecisionRegistry.loadFromConfig();
  if (DecisionRegistry.count() === 0) { GM._decisionAlerts = []; return; }
  var npcDecisions = DecisionRegistry.scanNpcDecisions();
  GM._decisionAlerts = npcDecisions.slice(0, 10); // 最多10条
}, 11, 'perturn');

SettlementPipeline.register('goalCheck', '目标检查', function() { checkGoals(); }, 88, 'perturn');

// P14: 成就系统——每回合检查是否达成新成就
SettlementPipeline.register('achievementCheck', '成就检查', function() {
  if (!GM._achievements) GM._achievements = [];
  var _earned = GM._achievements.map(function(a){ return a.id; });
  var _defs = [
    { id: 'first_edict', name: '初掌乾纲', desc: '下达第一道诏令', check: function(){ return (GM.edicts||[]).length > 0; } },
    { id: 'turn_10', name: '初入庙堂', desc: '度过10个回合', check: function(){ return GM.turn >= 10; } },
    { id: 'turn_50', name: '宦海沉浮', desc: '度过50个回合', check: function(){ return GM.turn >= 50; } },
    { id: 'keju', name: '文教大兴', desc: '完成一次科举', check: function(){ return P.keju && P.keju.history && P.keju.history.length > 0; } },
    { id: 'war_won', name: '武功赫赫', desc: '赢得一场战争', check: function(){ return GM._turnBattleResults && GM._turnBattleResults.some(function(b){ return b.verdict === '大胜' || b.verdict === '小胜'; }); } },
    { id: 'chaoyi_5', name: '广开言路', desc: '召开5次朝议', check: function(){ return (GM._courtRecords||[]).length >= 5; } },
    { id: 'dynasty_peak', name: '盛世华章', desc: '进入盛世阶段', check: function(){ return GM.eraState && GM.eraState.dynastyPhase === 'peak'; } }
  ];
  _defs.forEach(function(d) {
    if (_earned.indexOf(d.id) >= 0) return;
    if (d.check()) {
      GM._achievements.push({ id: d.id, name: d.name, desc: d.desc, turn: GM.turn });
      // 2.6: 成就解锁事件广播
      if (typeof GameEventBus !== 'undefined') GameEventBus.emit('achievement:unlock', {name: d.name, desc: d.desc, id: d.id});
      if (typeof addEB === 'function') addEB('\u6210\u5C31', d.name + '\u2014\u2014' + d.desc);
    }
  });
}, 95, 'perturn');

// N5: 主角成长——玩家角色每回合根据行为获得微量属性成长
SettlementPipeline.register('playerGrowth', '主角成长', function() {
  if (!GM.chars) return;
  var pc = GM.chars.find(function(c){ return c.isPlayer; });
  if (!pc) return;
  // 基于本回合操作统计成长方向
  var edictCount = (GM.edicts || []).length;
  var wenduiCount = GM.wenduiHistory ? Object.keys(GM.wenduiHistory).reduce(function(s, k){ return s + (GM.wenduiHistory[k] || []).filter(function(w){ return w.turn === GM.turn; }).length; }, 0) : 0;
  var hasWar = GM.activeWars && GM.activeWars.length > 0;
  // 微量成长（每回合+0.1~0.3）
  if (edictCount > 2) pc.administration = Math.min(100, (pc.administration || 50) + 0.2);
  if (wenduiCount > 0) pc.charisma = Math.min(100, (pc.charisma || 50) + 0.15);
  if (hasWar) pc.military = Math.min(100, (pc.military || 50) + 0.15);
  // 基础智力随回合缓慢增长（阅历增长）
  if (GM.turn > 1 && GM.turn % 3 === 0) pc.intelligence = Math.min(100, (pc.intelligence || 50) + 0.1);
  // 年龄增长带来的衰退（65岁以上）
  if ((pc.age || 30) > 65 && GM.turn % 6 === 0) {
    pc.valor = Math.max(10, (pc.valor || 50) - 0.3);
    pc.military = Math.max(10, (pc.military || 50) - 0.2);
  }
}, 60, 'perturn');

/**
 * 生成季度议程（每3回合触发一次）
 */
// ============================================================
// 时局要务系统——AI根据推演状态总结当前矛盾议题
// GM.currentIssues = [{ id, title, description, category, status, raisedTurn, raisedDate, resolvedTurn }]
// ============================================================

/**
 * 打开时局要务面板
 */
function openQuarterlyAgenda() {
  if (!GM.currentIssues) GM.currentIssues = [];

  var pending = GM.currentIssues.filter(function(i) { return i.status === 'pending'; });
  var resolved = GM.currentIssues.filter(function(i) { return i.status === 'resolved'; });

  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';

  if (pending.length === 0 && resolved.length === 0) {
    html += '<div style="text-align:center;padding:3rem;color:var(--txt-d);font-size:0.9rem;">\u56DB\u6D77\u5347\u5E73\uFF0C\u6682\u65E0\u8981\u52A1\u3002</div>';
  }

  // 待解决
  if (pending.length > 0) {
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:1.5rem;">';
    pending.forEach(function(issue) {
      html += _renderIssueCard(issue);
    });
    html += '</div>';
  }

  // 已解决（折叠）
  if (resolved.length > 0) {
    html += '<div style="margin-top:0.5rem;">';
    html += '<div style="font-size:0.82rem;color:var(--txt-d);cursor:pointer;margin-bottom:0.5rem;" onclick="var el=document.getElementById(\'issues-resolved\');el.style.display=el.style.display===\'none\'?\'grid\':\'none\';">\u25B6 \u5DF2\u89E3\u51B3\u8981\u52A1\uFF08' + resolved.length + '\uFF09</div>';
    html += '<div id="issues-resolved" style="display:none;grid-template-columns:1fr 1fr;gap:0.8rem;">';
    resolved.forEach(function(issue) {
      html += _renderIssueCard(issue);
    });
    html += '</div></div>';
  }

  html += '</div>';

  openGenericModal('\u65F6\u5C40\u8981\u52A1', html, null);
}

/**
 * 渲染单个议题卡片
 */
function _renderIssueCard(issue) {
  var isPending = issue.status === 'pending';
  var borderColor = isPending ? 'var(--gold)' : 'rgba(100,180,100,0.4)';
  var statusBadge = isPending
    ? '<span style="background:rgba(192,64,48,0.15);color:var(--vermillion-400);padding:2px 8px;border-radius:3px;font-size:0.7rem;font-weight:700;">\u5F85\u89E3\u51B3</span>'
    : '<span style="background:rgba(80,160,80,0.15);color:var(--green);padding:2px 8px;border-radius:3px;font-size:0.7rem;font-weight:700;">\u5DF2\u89E3\u51B3</span>';

  var dateStr = issue.raisedDate || ('\u7B2C' + (issue.raisedTurn || '?') + '\u56DE\u5408');
  if (issue.status === 'resolved' && issue.resolvedTurn) {
    dateStr += ' \u2192 \u7B2C' + issue.resolvedTurn + '\u56DE\u5408\u89E3\u51B3';
  }

  var h = '<div style="background:var(--bg-2);border:1px solid ' + borderColor + ';border-radius:8px;padding:0.9rem;position:relative;'
    + (isPending ? '' : 'opacity:0.7;') + (issue.isOpening ? 'border-width:2px;box-shadow:0 0 12px rgba(201,168,76,0.15);' : '') + '">';
  // 开局要务徽标
  if (issue.isOpening) {
    h += '<div style="position:absolute;top:-10px;right:-10px;background:linear-gradient(135deg,var(--vermillion-400),var(--vermillion-600,#8b2e25));color:#f4eadd;padding:3px 10px;border-radius:3px;font-size:0.68rem;letter-spacing:0.2em;box-shadow:0 2px 6px rgba(140,40,30,0.4);">开 局 要 务</div>';
  }
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem;">';
  h += '<div style="font-weight:700;font-size:0.95rem;color:var(--txt-l);line-height:1.3;">' + escHtml(issue.title) + '</div>';
  h += statusBadge;
  h += '</div>';
  h += '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:0.5rem;">' + escHtml(dateStr);
  if (issue.category) h += ' \u00B7 ' + escHtml(issue.category);
  if (issue.affectedRegion) h += ' \u00B7 <span style="color:var(--vermillion-300);">' + escHtml(issue.affectedRegion) + '</span>';
  h += '</div>';
  h += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.7;white-space:pre-wrap;">' + escHtml(issue.description) + '</div>';
  // 选项按钮(若有 choices 且 pending)
  if (isPending && Array.isArray(issue.choices) && issue.choices.length > 0) {
    h += '<div style="margin-top:0.7rem;padding-top:0.6rem;border-top:1px dashed rgba(201,168,76,0.2);">';
    h += '<div style="font-size:0.74rem;color:var(--gold);letter-spacing:0.2em;margin-bottom:0.4rem;">〔 陛 下 决 断 〕</div>';
    issue.choices.forEach(function(ch, idx) {
      var safeIid = (issue.id || '').replace(/'/g, "\\'");
      h += '<button class="bt bsm" style="display:block;width:100%;text-align:left;margin-bottom:0.3rem;padding:0.5rem 0.7rem;background:rgba(201,168,76,0.04);border:1px solid var(--gold-d);color:var(--txt-l);cursor:pointer;line-height:1.5;white-space:normal;" onclick="if(typeof _chooseIssueOption===\'function\')_chooseIssueOption(\''+safeIid+'\','+idx+');">';
      h += '<div style="font-weight:600;font-size:0.82rem;margin-bottom:0.2rem;">' + escHtml(ch.text||'选项'+(idx+1)) + '</div>';
      if (ch.desc) h += '<div style="font-size:0.7rem;color:var(--txt-d);margin-bottom:0.15rem;">' + escHtml(ch.desc) + '</div>';
      if (ch.effect && typeof ch.effect === 'object') {
        var effs = Object.keys(ch.effect).map(function(k) {
          var v = ch.effect[k];
          var clr = v > 0 ? 'var(--celadon-400)' : v < 0 ? 'var(--vermillion-400)' : 'var(--txt-d)';
          return '<span style="color:'+clr+';">' + escHtml(k) + (v>0?'+':'') + v + '</span>';
        }).slice(0, 8).join(' · ');
        if (effs) h += '<div style="font-size:0.66rem;">' + effs + '</div>';
      }
      h += '</button>';
    });
    h += '</div>';
  }
  // 长期后果(若有)·折叠提示
  if (issue.longTermConsequences && typeof issue.longTermConsequences === 'object') {
    h += '<details style="margin-top:0.5rem;"><summary style="font-size:0.72rem;color:var(--gold-d);cursor:pointer;">▸ 长期后果分支(点击展开)</summary>';
    h += '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.7;padding:0.4rem 0.2rem;">';
    Object.keys(issue.longTermConsequences).forEach(function(k) {
      h += '· <b style="color:var(--gold-d);">' + escHtml(k) + '</b>：' + escHtml(issue.longTermConsequences[k]) + '<br>';
    });
    h += '</div></details>';
  }
  if (issue.historicalNote) {
    h += '<div style="margin-top:0.4rem;font-size:0.68rem;color:var(--ink-400);font-style:italic;">史料：' + escHtml(issue.historicalNote.slice(0,100)) + '</div>';
  }
  h += '</div>';
  return h;
}

// 玩家点击议题选项·应用 effect + 标记 resolved + 写编年
function _chooseIssueOption(issueId, choiceIdx) {
  if (!GM.currentIssues) return;
  var issue = GM.currentIssues.find(function(i) { return i.id === issueId; });
  if (!issue || !Array.isArray(issue.choices)) return;
  var ch = issue.choices[choiceIdx];
  if (!ch) return;
  // 应用 effect
  if (ch.effect && typeof ch.effect === 'object') {
    Object.keys(ch.effect).forEach(function(k) {
      var v = ch.effect[k];
      if (typeof v !== 'number') return;
      // 先匹配 GM.vars
      if (GM.vars && GM.vars[k]) {
        var vObj = GM.vars[k];
        vObj.value = Math.max(vObj.min||0, Math.min(vObj.max||100, (vObj.value||0) + v));
      } else if (typeof GM[k] === 'number') {
        GM[k] += v;
      } else {
        // 作为特殊变量挂在 GM._issueEffects
        if (!GM._issueEffects) GM._issueEffects = {};
        GM._issueEffects[k] = (GM._issueEffects[k] || 0) + v;
      }
    });
  }
  // 标记解决
  issue.status = 'resolved';
  issue.resolvedTurn = GM.turn || 1;
  issue.resolvedDate = GM._gameDate || '';
  issue.chosenOption = choiceIdx;
  issue.chosenText = ch.text;
  // 写编年
  if (!GM._chronicle) GM._chronicle = [];
  GM._chronicle.push({
    turn: GM.turn || 1, date: GM._gameDate || '',
    type: '要务决断',
    text: '【' + (issue.title||'') + '】陛下决：' + (ch.text||'') + (ch.desc?' ·'+ch.desc:''),
    tags: ['要务','决断'].concat(issue.affectedRegion?[issue.affectedRegion]:[])
  });
  // 写 edictTracker 让 AI 推演读取
  if (!GM._edictTracker) GM._edictTracker = [];
  GM._edictTracker.push({
    id: 'issue_choice_' + issueId,
    content: '【' + (issue.title||'要务') + '】陛下决：' + (ch.text||'') + (ch.desc?' ·'+ch.desc:''),
    category: issue.category || '要务决断',
    turn: GM.turn || 1, status: 'pending', assignee: '', feedback: '', progressPercent: 0,
    _fromIssue: true, _affectedRegion: issue.affectedRegion || ''
  });
  if (typeof toast === 'function') toast('已决·' + (ch.text||'').slice(0, 20));
  // 关闭并重开面板刷新
  try {
    var _m = document.querySelector('.modal-bg');
    if (_m) _m.remove();
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-helpers');}catch(_){}}
  setTimeout(function(){ if (typeof openQuarterlyAgenda === 'function') openQuarterlyAgenda(); }, 100);
}
if (typeof window !== 'undefined') window._chooseIssueOption = _chooseIssueOption;

// ============================================================
// 5.1: 贸易路线结算
// ============================================================
SettlementPipeline.register('tradeRoutes', '贸易路线', function() {
  var routes = (P.mechanicsConfig && P.mechanicsConfig.tradeRoutes) || [];
  if (routes.length === 0) { GM._tradeReport = ''; return; }
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
  var monthScale = tr * 12;
  var totalRevenue = 0;
  var reports = [];

  routes.forEach(function(route) {
    if (!route.from || !route.to) return;
    var volume = route.volume || 100;
    // 安全系数：受战争、民变影响
    var risk = route.risk || 0;
    // 检查路线是否经过战区
    if (GM.activeWars && GM.activeWars.length > 0) {
      GM.activeWars.forEach(function(w) {
        if ((w.attacker === route.controlledBy || w.defender === route.controlledBy)) risk += 0.3;
      });
    }
    var safety = Math.max(0.1, 1 - Math.min(risk, 0.9));
    var revenue = Math.round(volume * safety * monthScale);
    totalRevenue += revenue;
    route._lastRevenue = revenue;
    route._lastSafety = Math.round(safety * 100);
    if (revenue > 0) reports.push(route.from + '\u2192' + route.to + '(' + (route.goods||'\u6742\u8D27') + ') \u6536\u5165' + revenue + ' \u5B89\u5168' + route._lastSafety + '%');
  });

  // 贸易收入计入国库
  if (totalRevenue > 0 && typeof GM.stateTreasury === 'number') {
    GM.stateTreasury += totalRevenue;
    if (typeof AccountingSystem !== 'undefined' && AccountingSystem.addIncome) AccountingSystem.addIncome('\u8D38\u6613\u6536\u5165', totalRevenue);
  }
  GM._tradeReport = reports.length > 0 ? reports.join('\uFF1B') : '';
  if (reports.length > 0 && typeof addEB === 'function') addEB('\u8D38\u6613', '\u8D38\u6613\u6536\u5165' + totalRevenue + '\uFF08' + routes.length + '\u6761\u8DEF\u7EBF\uFF09');
}, 36, 'perturn');

// ============================================================
// 5.6: 军事改革过渡
// ============================================================
// 5.6: 军事改革（及一切制度改革）不再独立机械追踪
// 改为通过"其他变量"系统运作：AI可在resource_changes中动态创建如
// "军制改革进度""税制改革进度"等变量，用0-100表示过渡进度。
// AI自行判断改革完成时机、阻力、既得利益者反弹等叙事。
// 编辑器可预设改革相关变量模板，也可完全由AI自行创建。

// 5.4: 外交使团状态推进
SettlementPipeline.register('diplomaticMissions', '\u5916\u4EA4\u4F7F\u56E2', function() {
  if (!GM._diplomaticMissions || GM._diplomaticMissions.length === 0) return;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  GM._diplomaticMissions.forEach(function(m) {
    if (m.status === 'completed' || m.status === 'failed') return;
    var turnsSinceSent = GM.turn - (m.sentTurn || GM.turn);
    // 旅途时间：简化为1-3回合（取决于距离/回合天数）
    var travelTurns = Math.max(1, Math.ceil(600 / (dpv * 30))); // 假设600里，使臣30里/天
    if (m.status === 'traveling' && turnsSinceSent >= travelTurns) {
      m.status = 'negotiating';
      m.arrivedTurn = GM.turn;
      if (typeof addEB === 'function') addEB('\u5916\u4EA4', m.envoy + '\u5DF2\u62B5\u8FBE' + m.target + '\uFF0C\u5F00\u59CB\u8C08\u5224');
    }
    // 谈判中超过3回合仍无AI回应→自动标记为completed(AI应在叙事中处理)
    if (m.status === 'negotiating' && GM.turn - (m.arrivedTurn||GM.turn) >= 3) {
      m.status = 'awaiting_result';
    }
  });
  // 清理已完成/失败超过5回合的任务
  GM._diplomaticMissions = GM._diplomaticMissions.filter(function(m) {
    if ((m.status === 'completed' || m.status === 'failed') && GM.turn - (m.resultTurn||GM.turn) > 5) return false;
    return true;
  });
}, 39, 'perturn');

// 6.6: 叙事张力评分
SettlementPipeline.register('tensionScore', '叙事张力', function() {
  var score = 0;
  if (GM.activeWars && GM.activeWars.length > 0) score += 30;
  if (GM.activeSchemes && GM.activeSchemes.length > 0) score += 15;
  if (!GM.activeWars || GM.activeWars.length === 0) score -= 10;
  // 角色死亡本回合
  if (GM.turnChanges && GM.turnChanges.characters) {
    GM.turnChanges.characters.forEach(function(cc) {
      cc.changes.forEach(function(ch) { if (ch.field === 'alive' && ch.newValue === false) score += 25; });
    });
  }
  if (!GM._tensionHistory) GM._tensionHistory = [];
  GM._tensionHistory.push({turn: GM.turn, score: Math.max(0, score)});
  if (GM._tensionHistory.length > 15) GM._tensionHistory.shift();
}, 90, 'perturn');

// ============================================================
// 7.4: 历史数据索引——按主题分类evtLog，供AI按需检索
// ============================================================
var HistoryIndex = {
  // 主题分类规则
  _categories: {
    military: /军|战|兵|攻|守|伐|胜|败|围|援|征|讨|行军/,
    political: /朝|政|官|臣|弹劾|任命|罢免|谏|奏|党|派/,
    economic: /税|粮|钱|财|商|贸|建|修|库|赋|贫/,
    diplomatic: /使|盟|和|约|贡|藩|外|邦|通好|遣/,
    social: /民|灾|疫|荒|乱|流|饥|叛|起义|盗/,
    personal: /婚|死|生|嗣|继|封|赏|罚|流放|赐/
  },

  // 构建索引（每回合调用一次，增量更新）
  buildIndex: function() {
    if (!GM.evtLog) return;
    if (!GM._historyIndex) GM._historyIndex = {};
    var cats = this._categories;
    // 用数组索引游标代替回合号——避免同回合后添加的事件被遗漏
    var startIdx = GM._historyIndexCursor || 0;
    if (startIdx > GM.evtLog.length) startIdx = 0; // 安全重置

    for (var _ei = startIdx; _ei < GM.evtLog.length; _ei++) {
      var evt = GM.evtLog[_ei];
      var text = evt.text || '';
      var matched = false;
      Object.keys(cats).forEach(function(cat) {
        if (cats[cat].test(text)) {
          if (!GM._historyIndex[cat]) GM._historyIndex[cat] = [];
          GM._historyIndex[cat].push({turn: evt.turn, text: text, type: evt.type});
          matched = true;
        }
      });
      if (!matched) {
        if (!GM._historyIndex.other) GM._historyIndex.other = [];
        GM._historyIndex.other.push({turn: evt.turn, text: text, type: evt.type});
      }
    }
    GM._historyIndexCursor = GM.evtLog.length;

    // 每个分类保留最近200条（不删除evtLog原始数据）
    Object.keys(GM._historyIndex).forEach(function(cat) {
      if (GM._historyIndex[cat].length > 200) {
        GM._historyIndex[cat] = GM._historyIndex[cat].slice(-200);
      }
    });
  },

  // 生成AI可读的历史目录摘要
  getSummaryForAI: function() {
    if (!GM._historyIndex) return '';
    var lines = [];
    Object.keys(GM._historyIndex).forEach(function(cat) {
      var items = GM._historyIndex[cat] || [];
      if (items.length === 0) return;
      var recent = items.slice(-3);
      lines.push(cat + '(' + items.length + '\u6761): \u8FD1\u671F=' + recent.map(function(i){return 'T'+i.turn+i.text;}).join('; '));
    });
    return lines.join('\n');
  },

  // 按主题检索详细历史（供AI回溯请求）
  queryByCategory: function(cat, limit) {
    if (!GM._historyIndex || !GM._historyIndex[cat]) return [];
    return GM._historyIndex[cat].slice(-(limit||20));
  }
};

SettlementPipeline.register('historyIndex', '历史索引', function() {
  HistoryIndex.buildIndex();
}, 91, 'perturn');
