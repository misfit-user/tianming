// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   世界 AI 上下文（姊妹 tm-office-panel.js 选任·tm-memorials.js 奏疏）
//   构建推演 prompt 的世界态势上下文（势力/区划/近事等）· 各 builder 按函数名 grep 定位
// ─────────────────────────────────────────────
// ============================================================
// tm-world.js — 特质工具+AI 上下文 (R124 进一步拆分后·保留"世界上下文"主题)
// 姊妹: tm-indices.js (R123·索引层)
//       tm-memorials.js (R124 拆出·奏疏系统)
//       tm-office-panel.js (R124 拆出·官制选任+编年+confirmEndTurn)
// 包含: autoAssignTraitIds/getEffectiveAttr/validateTraits/buildCharacterCard/
//       freezeWorldSnapshot/buildHardFacts/buildInformationCocoon/buildAIContext
// ============================================================

// ============================================================
// 特质工具函数
// ============================================================

/**
 * 从 personality 文本自动匹配 traitIds（兼容旧角色数据）
 * @param {Object} char - 角色对象
 */
function autoAssignTraitIds(char) {
  if (!char || !P.traitDefinitions) return;
  if (char.traitIds && char.traitIds.length > 0) return; // 已有则跳过
  if (!char.personality) return;

  var text = char.personality;
  var matched = [];
  var usedOpposites = {}; // 防止同时匹配对立特质

  P.traitDefinitions.forEach(function(def) {
    if (text.indexOf(def.name) >= 0 || text.indexOf(def.id) >= 0) {
      // 检查对立特质冲突
      if (usedOpposites[def.id]) return;
      matched.push(def.id);
      if (def.opposite) usedOpposites[def.opposite] = true;
    }
  });

  // 最多5个特质
  if (matched.length > 0) {
    char.traitIds = matched.slice(0, 5);
  }
}

/**
 * 获取特质修正后的有效属性值
 * @param {Object} char - 角色对象
 * @param {string} attr - 属性名(intelligence/valor/administration/military)
 * @returns {number} 修正后的值
 */
function getEffectiveAttr(char, attr) {
  if (!char) return 0;
  var base = char[attr] || 0;
  if (!char.traitIds || !P.traitDefinitions) return base;

  var bonus = 0;
  char.traitIds.forEach(function(tid) {
    var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
    if (def && def.attrMod && def.attrMod[attr]) {
      bonus += def.attrMod[attr];
    }
  });
  return base + bonus;
}

/**
 * 校验并清除对立特质冲突
 * @param {Object} char - 角色对象
 * @returns {string[]} 被移除的特质ID
 */
function validateTraits(char) {
  if (!char || !char.traitIds || !P.traitDefinitions) return [];
  var removed = [];
  var traitMap = {};
  P.traitDefinitions.forEach(function(t) { traitMap[t.id] = t; });

  var kept = [];
  var seenOpposites = {};
  char.traitIds.forEach(function(tid) {
    var def = traitMap[tid];
    if (!def) return;
    if (seenOpposites[tid]) {
      removed.push(tid);
      return; // 对立特质已存在，跳过
    }
    kept.push(tid);
    if (def.opposite) seenOpposites[def.opposite] = true;
  });
  char.traitIds = kept;
  return removed;
}

/**
 * 从特质自动推断角色个人目标（当 personalGoal 为空时）
 * @param {Object} char
 */
function inferPersonalGoal(char) {
  if (!char || (char.personalGoal && char.personalGoal.length > 0)) return;
  if (!char.traitIds || char.traitIds.length === 0) return;

  // 特质→目标映射（按优先级，取第一个匹配的）
  var goalMap = [
    { traits: ['ambitious'], goal: '追求更高权位，扩大影响力' },
    { traits: ['greedy'], goal: '积累财富，充实私库' },
    { traits: ['vengeful'], goal: '铲除宿敌，报仇雪恨' },
    { traits: ['brave', 'militant'], goal: '建功立业，征战沙场' },
    { traits: ['just'], goal: '整饬吏治，维护公道' },
    { traits: ['compassionate', 'merciful'], goal: '济世安民，施恩天下' },
    { traits: ['diligent'], goal: '勤勉治理，光耀门庭' },
    { traits: ['cunning', 'deceitful'], goal: '谋定而后动，暗中布局' },
    { traits: ['zealous', 'pious'], goal: '弘扬正道，教化万民' },
    { traits: ['content'], goal: '安于本分，保全家族' },
    { traits: ['suspicious'], goal: '提防暗算，巩固自身地位' },
    { traits: ['scholarly'], goal: '著书立说，留名青史' },
    { traits: ['stubborn'], goal: '坚持主张，绝不妥协' },
    { traits: ['arrogant'], goal: '压服众人，独揽大权' }
  ];

  for (var i = 0; i < goalMap.length; i++) {
    var entry = goalMap[i];
    var match = entry.traits.some(function(t) { return char.traitIds.indexOf(t) >= 0; });
    if (match) {
      char.personalGoal = entry.goal;
      _dbg('[Goal] ' + char.name + ' 自动推断目标: ' + entry.goal);
      return;
    }
  }

  // 无匹配特质的默认目标
  char.personalGoal = '安身立命，侍奉朝廷';
}

// ============================================================
// AI 叙事增强：角色档案卡 + 世界快照 + 事件标签
// 为 AI 提供结构化、精简的上下文（替代全量 JSON dump）
// ============================================================

/** @param {Object} char @returns {{name:string, title:string, faction:string, loyalty:number, traits:string[], age:*, highlights:string[]}|null} */
function buildCharacterCard(char) {
  if (!char) return null;
  var card = {
    name: char.name,
    title: char.title || char.position || '',
    faction: char.faction || '',
    loyalty: char.loyalty || 50,
    age: char.age || '',
    traits: []
  };
  // 特质：优先用 traitIds，回退用 personality 文本
  if (char.traitIds && char.traitIds.length > 0 && P.traitDefinitions) {
    card.traits = char.traitIds.map(function(id) {
      var def = P.traitDefinitions.find(function(t) { return t.id === id; });
      return def ? def.name : id;
    });
  } else if (char.personality) {
    card.traits = char.personality.split(/[,，、\s]+/).filter(function(s) { return s; }).slice(0, 4);
  }
  // AI行为指导（从特质定义中提取）
  if (char.traitIds && P.traitDefinitions) {
    var hints = [];
    var stressors = [];
    var relievers = [];
    char.traitIds.forEach(function(id) {
      var def = P.traitDefinitions.find(function(t) { return t.id === id; });
      if (!def) return;
      if (def.aiHint) hints.push(def.aiHint);
      if (def.stressOn) stressors = stressors.concat(def.stressOn);
      if (def.stressOff) relievers = relievers.concat(def.stressOff);
      // 属性修正
      if (def.attrMod) {
        Object.keys(def.attrMod).forEach(function(attr) {
          if (!card.attrMods) card.attrMods = {};
          card.attrMods[attr] = (card.attrMods[attr] || 0) + def.attrMod[attr];
        });
      }
    });
    if (hints.length) card.aiHints = hints;
    if (stressors.length) card.stressOn = stressors.slice(0, 5);
    if (relievers.length) card.stressOff = relievers.slice(0, 5);
  }
  // 亲属
  if (char.father) card.father = char.father;
  if (char.children && char.children.length) card.children = char.children.slice(0, 3).map(function(c) { return typeof c === 'string' ? c : c.name; });
  // 品级
  if (char.rankLevel) card.rank = char.rankLevel;
  // 关键属性（取最突出的2个）
  var attrs = [];
  var effInt = typeof getEffectiveAttr === 'function' ? getEffectiveAttr(char, 'intelligence') : (char.intelligence || 0);
  var effVal = typeof getEffectiveAttr === 'function' ? getEffectiveAttr(char, 'valor') : (char.valor || 0);
  var effAdm = typeof getEffectiveAttr === 'function' ? getEffectiveAttr(char, 'administration') : (char.administration || 0);
  if (effInt > 70) attrs.push('智' + effInt);
  if (effVal > 70) attrs.push('武' + effVal);
  if (effAdm > 70) attrs.push('政' + effAdm);
  if (char.ambition > 70) attrs.push('野心' + char.ambition);
  if (attrs.length) card.highlights = attrs;
  // 个人目标（NPC独立动机）
  if (char.personalGoal) card.goal = char.personalGoal;
  // 编辑器生成的丰富字段（传递给AI增加叙事深度）
  if (char.officialTitle && char.officialTitle !== '\u65E0') card.officialTitle = char.officialTitle;
  if (char.stance) card.stance = char.stance;
  if (char.birthplace) card.birthplace = char.birthplace;
  if (char.party && char.party !== '\u65E0\u515A\u6D3E') card.party = char.party;
  if (char.charisma && char.charisma > 70) card.charisma = char.charisma;
  return card;
}

/** 将角色卡格式化为紧凑文本（供 AI 阅读） */
function formatCharacterCard(card) {
  if (!card) return '';
  var parts = [card.name];
  if (card.title) parts[0] += '(' + card.title + ')';
  if (card.faction) parts.push('属' + card.faction);
  if (card.traits.length) parts.push('性' + card.traits.join('/'));
  parts.push('忠' + card.loyalty);
  if (card.age) parts.push('年' + card.age);
  if (card.highlights) parts.push(card.highlights.join('/'));
  if (card.children) parts.push('子:' + card.children.join(','));
  if (card.aiHints) parts.push('行为:' + card.aiHints.join(';').substring(0, 80));
  if (card.stressOn) parts.push('忌:' + card.stressOn.join('/'));
  if (card.stressOff) parts.push('好:' + card.stressOff.join('/'));
  if (card.goal) parts.push('目标:' + card.goal.substring(0, 30));
  return parts.join(' ');
}

/** 选择关键人物（按重要度排序，取前N个） */
function selectKeyCharacters(chars, maxCount) {
  if (!chars || chars.length === 0) return [];
  maxCount = maxCount || 8;
  var scored = chars.filter(function(c) { return c.alive !== false; }).map(function(c) {
    var score = 0;
    if (c.isPlayer) score += 100;
    if (c.title && c.title.indexOf('皇帝') >= 0) score += 50;
    if (c.rankLevel) score += c.rankLevel;
    if (c.ambition > 70) score += 10;
    if (c.loyalty < 30) score += 15; // 不稳定人物有叙事价值
    if (c.troops > 0 || c.soldiers > 0) score += 10;
    var office = typeof findNpcOffice === 'function' ? findNpcOffice(c.name) : null;
    if (office) score += 20;
    return { char: c, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, maxCount).map(function(s) { return s.char; });
}

/** @returns {{topFactions:Array, keyChars:string[]}} 世界快照 */
function freezeWorldSnapshot() {
  var snapshot = { topFactions: [], keyChars: [], turnSummary: '' };
  // Top 5 势力
  if (GM.facs && GM.facs.length) {
    snapshot.topFactions = GM.facs.slice().sort(function(a, b) {
      return (b.strength || 0) - (a.strength || 0);
    }).slice(0, 5).map(function(f) {
      return { name: f.name, strength: f.strength || 0, militaryStrength: f.militaryStrength || 0, leader: f.leader || '', type: f.type || '', attitude: f.attitude || '', territory: f.territory || '', goal: f.goal || '' };
    });
  }
  // 关键人物卡片
  snapshot.keyChars = selectKeyCharacters(GM.chars, 8).map(function(c) {
    return formatCharacterCard(buildCharacterCard(c));
  });
  return snapshot;
}

/** 事件角色标签映射（按事件类型给角色加上语义标签） */
var EVENT_ROLE_MAP = {
  '任命': { subject: '任命者', target: '被任命' },
  '罢免': { subject: '罢免者', target: '被罢免' },
  '战争': { subject: '进攻方', target: '防守方' },
  '继位': { subject: '故者', target: '继任者' },
  '叛乱': { subject: '叛军', target: '朝廷' },
  '外交': { subject: '发起方', target: '对象' },
  '改革': { subject: '推行者', target: '受影响者' },
  '灾害': { subject: '受灾地区', target: '' },
  '科举': { subject: '主考官', target: '状元' }
};

/** 格式化事件为带角色标签的文本 */
function formatEventWithRoles(event) {
  if (!event) return '';
  var roleMap = EVENT_ROLE_MAP[event.type] || { subject: '主体', target: '对象' };
  var text = '[' + (event.type || '事件') + '] ' + (event.title || event.text || '');
  if (event.subject) text += ' (' + roleMap.subject + ':' + event.subject + ')';
  if (event.target) text += ' (' + roleMap.target + ':' + event.target + ')';
  return text;
}

// ============================================================
// 硬性事实约束（借鉴 ChongzhenSim Story Facts）
// 明确告诉 AI 哪些角色已死、哪些势力已灭、谁任什么官
// 防止 AI 叙事中出现"复活""官职错误"等矛盾
// ============================================================
/** @returns {string[]} 硬性事实约束列表（AI 不得违反） */
function buildHardFacts() {
  var facts = [];

  // 已死角色（不得复活）
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (c.alive === false || c.dead) {
        var reason = c.deathReason || c.deathCause || '去世';
        facts.push(c.name + '已' + reason + '（回合' + (c.deathTurn || '?') + '），不得在后续叙事中以存活状态出现。');
      }
    });
  }
  // 从角色弧线中提取死亡记录
  if (GM.characterArcs) {
    Object.keys(GM.characterArcs).forEach(function(name) {
      var arcs = GM.characterArcs[name] || [];
      arcs.forEach(function(a) {
        if (a.type === 'death' && facts.indexOf(name) < 0) {
          facts.push(name + '已去世（回合' + a.turn + '），不得复活。');
        }
      });
    });
  }

  // 现任官职（防止AI混淆谁任什么职）
  if (GM.officeTree && GM.officeTree.length > 0) {
    var appointments = [];
    function walkOffice(nodes) {
      nodes.forEach(function(node) {
        if (node.positions) {
          node.positions.forEach(function(pos) {
            if (pos.holder) appointments.push(pos.holder + '现任' + node.name + pos.name);
          });
        }
        if (node.subs) walkOffice(node.subs);
      });
    }
    walkOffice(GM.officeTree);
    if (appointments.length > 0 && appointments.length <= 15) {
      facts.push('当前官职：' + appointments.join('，') + '。');
    } else if (appointments.length > 15) {
      facts.push('当前有' + appointments.length + '人任官，关键：' + appointments.slice(0, 8).join('，') + '等。');
    }
  }

  // 已灭势力（不得复活）
  if (GM.facs) {
    GM.facs.forEach(function(f) {
      if (f.destroyed || f.eliminated || f.strength <= 0) {
        facts.push('\u52BF\u529B"' + f.name + '"\u5DF2\u8986\u706D\uFF0C\u4E0D\u5F97\u4EE5\u5B58\u6D3B\u52BF\u529B\u51FA\u73B0\u3002');
      }
    });
  }

  // C2: 得罪阈值超标→硬性约束注入
  if (GM.offendGroupScores) {
    var allGroups = [];
    // 收集所有有阈值的组
    (GM.parties || []).forEach(function(p) {
      if (p.offendThresholds && p.offendThresholds.length > 0) {
        var score = GM.offendGroupScores['party_' + p.name] || 0;
        var maxT = p.offendThresholds[p.offendThresholds.length - 1];
        if (score >= maxT.score) {
          facts.push('\u515A\u6D3E"' + p.name + '"\u5DF2\u8FBE\u6700\u9AD8\u5F97\u7F6A\u9608\u503C(' + Math.round(score) + ')——' + (maxT.description || '\u53DB\u4E71') + '\uFF0C\u5176\u6210\u5458\u62D2\u7EDD\u5408\u4F5C\u3001\u53EF\u80FD\u53D1\u52A8' + (maxT.consequences || []).join('\u3001'));
        } else if (p.offendThresholds.length >= 2) {
          var midT = p.offendThresholds[Math.floor(p.offendThresholds.length / 2)];
          if (score >= midT.score) {
            facts.push('\u515A\u6D3E"' + p.name + '"\u4E25\u91CD\u4E0D\u6EE1(' + Math.round(score) + ')——' + (midT.description || '\u62B5\u5236') + '\uFF0C\u6B63\u5728\u6D88\u6781\u5BF9\u6297\u3002');
          }
        }
      }
    });
    (GM.classes || []).forEach(function(cls) {
      if (cls.offendThresholds && cls.offendThresholds.length > 0) {
        var score = GM.offendGroupScores['class_' + cls.name] || 0;
        var maxT = cls.offendThresholds[cls.offendThresholds.length - 1];
        if (score >= maxT.score) {
          facts.push('\u9636\u5C42"' + cls.name + '"\u5DF2\u8FBE\u6700\u9AD8\u5F97\u7F6A\u9608\u503C(' + Math.round(score) + ')——' + (maxT.description || '\u8D77\u4E49') + '\uFF0C' + (maxT.consequences || []).join('\u3001'));
        } else if (cls.offendThresholds.length >= 2) {
          var midT = cls.offendThresholds[Math.floor(cls.offendThresholds.length / 2)];
          if (score >= midT.score) {
            facts.push('\u9636\u5C42"' + cls.name + '"\u4E25\u91CD\u4E0D\u6EE1(' + Math.round(score) + ')——' + (midT.description || '\u6297\u7A0E') + '\u3002');
          }
        }
      }
    });
  }

  // 阶层满意度极低→硬性警告
  if (GM.classes) {
    GM.classes.forEach(function(cls) {
      var sat = parseInt(cls.satisfaction) || 50;
      if (sat < 15) {
        facts.push('\u9636\u5C42"' + cls.name + '"\u6EE1\u610F\u5EA6\u6781\u4F4E(' + sat + ')\uFF0C\u5DF2\u5904\u4E8E\u66B4\u52A8\u8FB9\u7F18\uFF0CAI\u5FC5\u987B\u5728\u53D9\u4E8B\u4E2D\u4F53\u73B0\u793E\u4F1A\u52A8\u8361\u3002');
      }
    });
  }

  // 截断（最多30条，控制token）
  if (facts.length > 30) facts = facts.slice(0, 30);
  return facts;
}

// ============================================================
// 信息茧房矛盾（借鉴 ChongzhenSim moduleComposer）
// 生成官方报告 vs 实际情报的矛盾，让 AI 产生多层叙事
// 全朝代通用：根据数值状态动态生成，不硬编码朝代
// ============================================================
function buildInformationCocoon() {
  var contradictions = [];

  // 经济 — 官方账面 vs 实际亏空
  if (GM.eraState && GM.eraState.economicProsperity < 0.4) {
    contradictions.push({
      official: '户部称税赋按期征收，国库尚可维持。',
      intel: '查实：多处税银被截留，实际入库不足奏报之半。',
      metric: '经济', value: Math.round((GM.eraState.economicProsperity || 0) * 100)
    });
  }

  // 军事 — 奏报大捷 vs 实际损失
  if (GM.eraState && GM.eraState.militaryProfessionalism < 0.4) {
    contradictions.push({
      official: '前线奏报守备稳固，将士用命。',
      intel: '实则兵员空额严重，军械朽坏，士气低迷。',
      metric: '军事', value: Math.round((GM.eraState.militaryProfessionalism || 0) * 100)
    });
  }

  // NPC派系矛盾线索——不同派系对同一事件的不同说法
  if (GM.parties && GM.parties.length >= 2) {
    var p1 = GM.parties[0], p2 = GM.parties[1];
    if (p1.influence > 20 && p2.influence > 20) {
      contradictions.push({
        official: (p1.name || '甲派') + '称：当前施政得当，应继续推行。',
        intel: (p2.name || '乙派') + '私下议论：现行政策危害甚大，须立即更张。',
        metric: '派系视角', value: Math.round((p1.influence + p2.influence) / 2)
      });
    }
  }

  // 边将可能夸大战果
  if (GM.armies && GM.armies.length > 0) {
    var weakArmy = GM.armies.find(function(a) { return (a.morale || 50) < 40 || (a.soldiers || a.troops || 0) < 3000; });
    if (weakArmy) {
      contradictions.push({
        official: (weakArmy.commander || '前线') + '奏报：我军严阵以待，士气高昂，粮草充足。',
        intel: '暗探查实：该部兵额空虚，士卒逃亡甚众，军粮已不足月余。',
        metric: '军情', value: weakArmy.morale || 30
      });
    }
  }

  // NPC利益驱动的信息扭曲——找到忠诚度低或野心高的官员
  if (GM.chars) {
    // 野心家的自利汇报
    var schemer = GM.chars.find(function(c) { return c.alive !== false && (c.ambition || 50) > 75 && (c.loyalty || 50) < 50; });
    if (schemer) {
      var _office = typeof findNpcOffice === 'function' ? findNpcOffice(schemer.name) : null;
      if (_office) {
        contradictions.push({
          official: schemer.name + '奏称其辖区政绩卓著，请求嘉奖升迁。',
          intel: '查核：其所辖实际政绩平庸，多有虚饰之嫌。此人野心('+schemer.ambition+')远超忠诚('+schemer.loyalty+')。',
          metric: '官员诚信', value: schemer.loyalty || 30
        });
      }
    }

    // 忠臣的有限视野——忠心≠正确
    var loyalist = GM.chars.find(function(c) { return c.alive !== false && (c.loyalty || 50) > 85 && (c.intelligence || 50) < 45; });
    if (loyalist && GM.eraState && GM.eraState.socialStability < 0.5) {
      contradictions.push({
        official: loyalist.name + '（忠' + loyalist.loyalty + '）进言：当下局势并无大碍，只需严刑峻法即可。',
        intel: '此人虽忠心耿耿，但智识有限(智' + (loyalist.intelligence || 40) + ')，可能误判形势。实际局势恐非如此乐观。',
        metric: '忠臣盲区', value: loyalist.intelligence || 40
      });
    }
  }

  // 昏君行为引发的信息矛盾
  if (GM._tyrantDecadence && GM._tyrantDecadence > 20) {
    // 佞臣粉饰 vs 忠臣担忧
    contradictions.push({
      official: '近臣奏称：陛下圣心优裕，偶有逸兴，乃天子之常，群臣不必过虑。',
      intel: '有老臣私下叹息：上荒于政事，恐非社稷之福。然无人敢言。',
      metric: '帝王声名', value: GM._tyrantDecadence
    });
    if (GM._tyrantDecadence > 40) {
      contradictions.push({
        official: '户部奏报：国库充裕，足支用度。',
        intel: '密查：修宫殿、办宴饮、赐方士之费日增，实际国帑已渐空虚。上供之物多流入私囊。',
        metric: '帝王挥霍', value: GM._tyrantDecadence
      });
    }
    if (GM._tyrantDecadence > 60) {
      contradictions.push({
        official: '各地奏报太平无事，歌功颂德之表络绎不绝。',
        intel: '坊间童谣已有"天子不朝，宰相空劳"之讥。流言纷纷，民心思变。有人暗引桀纣之典。',
        metric: '民间议论', value: GM._tyrantDecadence
      });
    }
  }

  // 门阀世家之间的信息对立
  if (GM.families) {
    var _famKeys2 = Object.keys(GM.families);
    // 找两个声望差距大的家族
    if (_famKeys2.length >= 2) {
      _famKeys2.sort(function(a, b) { return (GM.families[b].renown || 0) - (GM.families[a].renown || 0); });
      var _topFam = GM.families[_famKeys2[0]], _lowFam = GM.families[_famKeys2[_famKeys2.length - 1]];
      if (_topFam && _lowFam && _topFam.renown - _lowFam.renown > 20 && _topFam.tier !== _lowFam.tier) {
        contradictions.push({
          official: _topFam.name + '\u7684\u65CF\u4EBA\u79F0\uFF1A\u5F53\u4ECA\u671D\u5802\u5B89\u5B9A\uFF0C\u5404\u65B9\u5404\u5C3D\u5176\u804C\uFF0C\u56FD\u5BB6\u6709\u671B\u3002',
          intel: _lowFam.name + '\u7684\u4EBA\u79C1\u4E0B\u62B1\u6028\uFF1A\u671D\u4E2D\u8981\u804C\u5C3D\u88AB' + _topFam.name + '\u5360\u636E\uFF0C\u5BD2\u95E8\u65E0\u51FA\u5934\u4E4B\u65E5\u3002',
          metric: '\u95E8\u9600\u4E4B\u4E89', value: Math.round(_topFam.renown - _lowFam.renown)
        });
      }
    }
  }

  return contradictions.slice(0, 7); // 最多7条
}

/** 检查系统是否启用（未配置的默认启用，由AI自由发挥） */
function _sysEnabled(name) {
  var gs = (P.conf && P.conf.gameSettings) || (P.gameSettings) || {};
  var es = gs.enabledSystems;
  if (!es) return true; // 未配置则默认全部启用
  return es[name] !== false;
}

/** @returns {string} 精简版 AI 上下文（替代全量 JSON dump） */
function buildAIContext(deepMode) {
  var ctx = '';
  // deepMode=true时：所有截断值放大，让AI看到更完整的世界
  // 非deepMode时：根据模型实际上下文窗口动态调整截断值（通过探测系统，无写死）
  var _ctxF = (typeof getCompressionParams === 'function') ? getCompressionParams().contextTruncFactor : 1.0;
  var _M = deepMode ? 5 : _ctxF;
  function _sl(str, base) { return str ? String(str).slice(0, Math.round(base * _M)) : ''; }
  function _sn(arr, base) { return arr ? arr.slice(0, Math.round(base * (deepMode ? 3 : _ctxF))) : []; }
  function _memText(entry) {
    if (typeof memoryEntryText === 'function') return memoryEntryText(entry);
    if (entry == null) return '';
    if (typeof entry === 'string') return entry;
    return String(entry.content || entry.text || entry.summary || entry.title || '');
  }

  // 玩家身份概要（让AI在所有上下文前先了解视角）
  if (P.playerInfo) {
    var _pi = P.playerInfo;
    if (_pi.characterName || _pi.factionName) {
      ctx += '【主角概要】';
      if (_pi.characterName) ctx += _pi.characterName;
      if (_pi.characterTitle) ctx += '(' + _pi.characterTitle + ')';
      if (_pi.playerRole) {
        var _prMap = {emperor:'\u5E1D\u738B',regent:'\u6743\u81E3',general:'\u5C06\u5E05',minister:'\u6587\u81E3',prince:'\u8BF8\u4FAF',merchant:'\u5546\u8D3E'};
        ctx += ' ' + (_prMap[_pi.playerRole] || _pi.playerRoleCustom || '');
      }
      if (_pi.factionName) ctx += ' ' + _pi.factionName;
      ctx += '\n';
    }
    // 显著矛盾（黑格尔式核心驱动力）
    if (_pi.coreContradictions && _pi.coreContradictions.length > 0) {
      var dimNames = {political:'\u653F\u6CBB',economic:'\u7ECF\u6D4E',military:'\u519B\u4E8B',social:'\u793E\u4F1A'};
      var sevNames = {critical:'\u2605\u81F4\u547D',major:'\u25C6\u91CD\u5927',minor:'\u25CB\u6F5C\u5728'};
      ctx += '\u3010\u663E\u8457\u77DB\u76FE\u00B7\u6838\u5FC3\u9A71\u52A8\u529B\u3011\n';
      _pi.coreContradictions.forEach(function(c) {
        ctx += '  ' + (sevNames[c.severity] || '') + ' [' + (dimNames[c.dimension] || c.dimension) + '] ' + c.title;
        if (c.parties) ctx += ' (' + c.parties + ')';
        ctx += '\n';
        if (c.description) ctx += '    ' + c.description.slice(0, 100) + '\n';
      });
      ctx += '  \u203B \u77DB\u76FE\u662F\u63A8\u6F14\u7684\u6838\u5FC3\u9A71\u52A8\u529B\u3002AI\u6BCF\u56DE\u5408\u5FC5\u987B\u56F4\u7ED5\u8FD9\u4E9B\u77DB\u76FE\u5C55\u5F00\u53D9\u4E8B\uFF0C\u73A9\u5BB6\u7684\u4EFB\u4F55\u51B3\u7B56\u90FD\u5C06\u5728\u653F\u6CBB/\u7ECF\u6D4E/\u519B\u4E8B/\u793E\u4F1A\u56DB\u7EF4\u5EA6\u5F15\u53D1\u8FDE\u9501\u53CD\u5E94\u3002\n';
    }
  }

  // 世界快照
  var snapshot = freezeWorldSnapshot();
  if (snapshot.topFactions.length) {
    ctx += '【天下大势】\n';
    snapshot.topFactions.forEach(function(f) {
      var parts = ['  ' + f.name];
      if (f.type) parts.push('(' + f.type + ')');
      parts.push('\u5B9E\u529B' + f.strength);
      if (f.militaryStrength) parts.push('\u5175\u529B\u7EA6' + f.militaryStrength);
      if (f.leader) parts.push('\u9996\u9886' + f.leader);
      if (f.attitude) parts.push('\u6001\u5EA6:' + f.attitude);
      if (f.territory) parts.push('\u5730\u76D8:' + String(f.territory).slice(0, 15));
      if (f.goal) parts.push('\u76EE\u6807:' + String(f.goal).slice(0, 15));
      ctx += parts.join(' ') + '\n';
    });
  }
  // 关键人物
  if (snapshot.keyChars.length) {
    ctx += '【关键人物】\n';
    snapshot.keyChars.forEach(function(card) {
      ctx += '  ' + card + '\n';
    });
  }
  // 人物内心状态（让AI了解角色的心理和处境，增加叙事深度）
  if (GM.chars) {
    var stressedOrGoaled = GM.chars.filter(function(c) {
      return c.alive !== false && ((c.stress && c.stress > 20) || c.personalGoal || (c.traitIds && c.traitIds.length > 0));
    });
    if (stressedOrGoaled.length > 0) {
      ctx += '\u3010\u4EBA\u7269\u72B6\u6001\u3011\n';
      stressedOrGoaled.slice(0, 6).forEach(function(c) {
        var parts = [c.name];
        if (c.age) parts.push(c.age + '\u5C81');
        if (c.family) parts.push(c.family);
        if (c.personality) parts.push(c.personality.slice(0, 15));
        if (c.appearance) parts.push('\u8C8C:' + c.appearance.slice(0, 12));
        if (c.charisma && c.charisma > 75) parts.push('\u9B45\u529B\u51FA\u4F17');
        if (c.administration && c.administration > 75) parts.push('\u6CBB\u653F\u51FA\u4F17');
        if (c.stress && c.stress > 20) {
          parts.push('\u538B\u529B' + c.stress + (c.stress > 60 ? '(\u6FC2\u5D29)' : c.stress > 40 ? '(\u7126\u8651)' : ''));
        }
        if (c.personalGoal) parts.push('\u6C42:' + c.personalGoal.slice(0, 15));
        if (typeof getWuchangText === 'function') parts.push(getWuchangText(c));
        if (typeof getFamilyStatusText === 'function') { var _fs = getFamilyStatusText(c); if (_fs) parts.push(_fs); }
        if (typeof EnYuanSystem !== 'undefined') { var _ey = EnYuanSystem.getTextForChar(c.name); if (_ey) parts.push(_ey); }
        if (typeof PatronNetwork !== 'undefined') { var _pn = PatronNetwork.getTextForChar(c.name); if (_pn) parts.push(_pn); }
        if (typeof FaceSystem !== 'undefined' && c._face !== undefined) parts.push(FaceSystem.getFaceText(c));
        ctx += '  ' + parts.join('\uFF0C') + '\n';
      });
    }
  }

  // 主角近期内省（让AI在写player_inner时保持人物一致性）
  if (GM.shijiHistory && GM.shijiHistory.length > 0) {
    var _recentInnerCtx = GM.shijiHistory.slice(-3).filter(function(s) { return s.playerInner; }).map(function(s) { return s.playerInner; });
    if (_recentInnerCtx.length > 0) {
      ctx += '【主角近期心境】\n  ' + _recentInnerCtx.join('→') + '\n';
    }
  }

  // 帝王荒淫史（让AI了解玩家的暴君程度，自然融入叙事）
  if (GM._tyrantDecadence && GM._tyrantDecadence > 5) {
    var _decLbl = GM._tyrantDecadence < 15 ? '微有放纵' : GM._tyrantDecadence < 30 ? '声名不佳' : GM._tyrantDecadence < 60 ? '昏庸之名渐起' : '暴君之名远播';
    ctx += '【帝王声名】' + _decLbl + '(荒淫值' + GM._tyrantDecadence + ')\n';
    if (GM._tyrantHistory && GM._tyrantHistory.length > 0) {
      var _recentTy = GM._tyrantHistory.slice(-3);
      var _tyActs = [];
      _recentTy.forEach(function(th) {
        th.acts.forEach(function(id) {
          var a = typeof TYRANT_ACTIVITIES !== 'undefined' ? TYRANT_ACTIVITIES.find(function(x) { return x.id === id; }) : null;
          if (a && _tyActs.indexOf(a.name) < 0) _tyActs.push(a.name);
        });
      });
      if (_tyActs.length > 0) ctx += '  近期行径：' + _tyActs.join('、') + '\n';
    }
  }

  // 关键资源（只发非零变量）
  ctx += '\u3010\u6838\u5FC3\u8D44\u6E90\u3011\n';
  var varCount = 0;
  Object.entries(GM.vars || {}).forEach(function(e) {
    if (varCount < 15) {
      var v = e[1];
      var vInfo = '  ' + e[0] + ':' + v.value;
      // 尝试显示单位（不假设字段名）
      var unit = v.unit || v.unitName || v.suffix || '';
      if (unit) vInfo += unit;
      vInfo += '(' + v.min + '-' + v.max + ')';
      // 尝试显示描述（不假设字段名）
      var desc = v.desc || v.description || v.note || '';
      if (desc) vInfo += ' ' + String(desc).slice(0, 20);
      ctx += vInfo + '\n';
      varCount++;
    }
  });
  // 时间刻度（让AI理解每回合代表多久，从而合理估算变量变化量）
  if (P.time) {
    var _dpvCtx = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30);
    var _ptText = '\u6BCF\u56DE\u5408=' + _dpvCtx + '\u5929';
    if (_dpvCtx === 30) _ptText = '\u6BCF\u56DE\u5408=1\u4E2A\u6708';
    else if (_dpvCtx === 90) _ptText = '\u6BCF\u56DE\u5408=1\u5B63\u5EA6';
    else if (_dpvCtx === 365) _ptText = '\u6BCF\u56DE\u5408=1\u5E74';
    if (_ptText) ctx += '  \u65F6\u95F4\u523B\u5EA6\uFF1A' + _ptText + '\u3002\u53D8\u91CF\u53D8\u5316\u91CF\u5E94\u4E0E\u6B64\u5339\u914D\u3002\n';
  }
  // 变量附加信息与关联规则（编辑者定义的一切传给AI）
  if (typeof getVarCalcContext === 'function') {
    var _vcCtx = getVarCalcContext();
    if (_vcCtx) ctx += _vcCtx;
  }
  // 忠诚关系（纵向：臣→君，基于 char.loyalty）
  var loyaltyIssues = [];
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (c.alive === false) return;
      if (c.loyalty !== undefined && (c.loyalty < 30 || c.loyalty > 85)) {
        loyaltyIssues.push(c.name + '忠' + c.loyalty + (c.loyalty < 30 ? '(危)' : '(坚)'));
      }
    });
  }
  if (loyaltyIssues.length) {
    ctx += '【忠诚状况】\n  ' + loyaltyIssues.slice(0, 10).join('，') + '\n';
  }

  // 党派动态（影响力和状态）
  if (GM.parties && GM.parties.length > 0) {
    var activeParties = GM.parties.filter(function(p) { return (p.influence||0) > 10 || p.status === '\u6D3B\u8DC3'; });
    if (activeParties.length > 0) {
      ctx += '【党派格局】\n';
      activeParties.slice(0, 6).forEach(function(p) {
        var pInfo = '  ' + p.name + '：影响' + (p.influence || 0) + (p.status ? '(' + p.status + ')' : '');
        if (p.leader) pInfo += '，领袖' + p.leader;
        if (p.ideology) pInfo += '，主张:' + String(p.ideology).slice(0, 20);
        if (p.currentAgenda) pInfo += '\n    当前议程:' + String(p.currentAgenda).slice(0, 30);
        if (p.rivalParty) pInfo += ' 对立:' + p.rivalParty;
        if (p.policyStance && p.policyStance.length) pInfo += ' 立场:[' + p.policyStance.slice(0, 4).join(',') + ']';
        if (p.base) pInfo += '\n    基本盘:' + String(p.base).slice(0, 20);
        // 党派成员名单
        if (GM.chars) {
          var pMembers = GM.chars.filter(function(c) { return c.alive !== false && c.party === p.name; });
          if (pMembers.length > 0) pInfo += '\n    成员(' + pMembers.length + '):' + pMembers.slice(0, 5).map(function(c) { return c.name; }).join(',');
        }
        // 得罪分数
        var offScore = GM.offendGroupScores && GM.offendGroupScores['party_' + p.name];
        if (offScore && offScore > 5) pInfo += '\n    ⚠不满度:' + Math.round(offScore);
        ctx += pInfo + '\n';
      });
    }
  }

  // 军事概况（士气/训练/兵力）
  if (GM.armies && GM.armies.length > 0) {
    var activeArmies = GM.armies.filter(function(a) { return !a.destroyed; });
    if (activeArmies.length > 0) {
      ctx += '【军事力量】\n';
      activeArmies.forEach(function(a) {
        var aInfo = '  ' + a.name;
        if (a.armyType) aInfo += '(' + a.armyType + ')';
        if (a.faction) aInfo += '[' + a.faction + ']';
        aInfo += '：' + (a.soldiers || a.troops || '?') + '\u5175';
        if (a.morale !== undefined) aInfo += ' 士气' + a.morale;
        if (a.training !== undefined) aInfo += ' 训练' + a.training;
        if (a.loyalty !== undefined) aInfo += ' 忠诚' + a.loyalty;
        if (a.control !== undefined && a.control < 80) aInfo += ' 掌控' + a.control;
        if (a.quality) aInfo += ' ' + a.quality;
        if (a.commander) aInfo += ' 统帅:' + a.commander + (a.commanderTitle ? '(' + a.commanderTitle + ')' : '');
        if (a.garrison) aInfo += ' 驻:' + String(a.garrison).slice(0, 15);
        // 第二刀·sc1 主推演只需粗粒度战力·兵种细分/装备数量明细/年饷已归位至 sc18 军事专项(战斗解算所需)·保留 equipmentCondition 一词作粗粒度战力指标
        if (a.equipmentCondition) aInfo += ' 装备' + a.equipmentCondition;
        ctx += aInfo + '\n';
      });
      var totalSoldiers = activeArmies.reduce(function(s, a) { return s + (a.soldiers || 0); }, 0);
      if (totalSoldiers > 0) ctx += '  总兵力约' + totalSoldiers + '\n';
    }
  }

  // 领地概况（发展/控制/人口）
  if (P.map && P.map.regions && P.map.regions.length > 0) {
    var importantRegions = P.map.regions.filter(function(r) { return r.owner || r.development > 50 || r.troops > 0; });
    if (importantRegions.length > 0) {
      ctx += '【领地】\n';
      importantRegions.slice(0, 6).forEach(function(r) {
        var parts = [r.name];
        if (r.owner) parts.push('属' + r.owner);
        if (r.development) parts.push('发展' + r.development);
        if (r.troops) parts.push('驻军' + r.troops);
        if (r.population) parts.push('人口' + r.population);
        ctx += '  ' + parts.join(' ') + '\n';
      });
    }
  }

  // B1+B3: 世界设定（扩大到150字 + 合并P.world）
  var wsCtx = [];
  if (P.worldSettings) {
    if (P.worldSettings.culture) wsCtx.push('\u6587\u5316:' + P.worldSettings.culture.slice(0, 150));
    if (P.worldSettings.weather) wsCtx.push('\u6C14\u5019:' + P.worldSettings.weather.slice(0, 150));
    if (P.worldSettings.religion) wsCtx.push('\u5B97\u6559:' + P.worldSettings.religion.slice(0, 150));
    if (P.worldSettings.economy) wsCtx.push('\u7ECF\u6D4E:' + P.worldSettings.economy.slice(0, 150));
    if (P.worldSettings.technology) wsCtx.push('\u79D1\u6280:' + P.worldSettings.technology.slice(0, 150));
    if (P.worldSettings.diplomacy) wsCtx.push('\u5916\u4EA4:' + P.worldSettings.diplomacy.slice(0, 150));
  }
  // 合并P.world中的补充信息（如果P.worldSettings对应字段为空）
  if (P.world) {
    if (P.world.history && !wsCtx.some(function(s){return s.indexOf('\u5386\u53F2')===0;})) wsCtx.push('\u5386\u53F2:' + P.world.history.slice(0, 150));
    if (P.world.politics && !wsCtx.some(function(s){return s.indexOf('\u653F\u6CBB')===0;})) wsCtx.push('\u653F\u6CBB:' + P.world.politics.slice(0, 150));
    if (P.world.military && !wsCtx.some(function(s){return s.indexOf('\u519B\u4E8B')===0;})) wsCtx.push('\u519B\u4E8B\u80CC\u666F:' + P.world.military.slice(0, 100));
  }
  if (wsCtx.length > 0) {
    ctx += '\u3010\u4E16\u754C\u80CC\u666F\u3011\n  ' + wsCtx.join('\n  ') + '\n';
  }

  // A1+A2: 完整时代状态注入
  if (GM.eraState) {
    var es = GM.eraState;
    var phaseLabels = {founding:'\u5F00\u521B',rising:'\u4E0A\u5347',expansion:'\u6269\u5F20',peak:'\u9F0E\u76DB',stable:'\u5B88\u6210',decline:'\u8870\u843D',declining:'\u8870\u843D',crisis:'\u5371\u673A',collapse:'\u5D29\u6E83',revival:'\u4E2D\u5174'};
    var legLabels = {hereditary:'\u4E16\u88AD',military:'\u519B\u529F',merit:'\u8D24\u80FD',divine:'\u5929\u547D',declining:'\u8870\u5FAE'};
    var landLabels = {state:'\u56FD\u6709\u5236',private:'\u79C1\u6709\u5236',mixed:'\u6DF7\u5408\u5236'};
    ctx += '\u3010\u65F6\u4EE3\u72B6\u6001\u3011\n';
    ctx += '  \u738B\u671D\u9636\u6BB5:' + (phaseLabels[es.dynastyPhase]||es.dynastyPhase||'\u672A\u77E5');
    ctx += ' \u653F\u6CBB\u7EDF\u4E00:' + Math.round((es.politicalUnity||0.5)*100) + '%';
    ctx += ' \u4E2D\u592E\u96C6\u6743:' + Math.round((es.centralControl||0.5)*100) + '%';
    ctx += ' \u793E\u4F1A\u7A33\u5B9A:' + Math.round((es.socialStability||0.5)*100) + '%\n';
    ctx += '  \u7ECF\u6D4E\u7E41\u8363:' + Math.round((es.economicProsperity||0.5)*100) + '%';
    ctx += ' \u6587\u5316\u6D3B\u529B:' + Math.round((es.culturalVibrancy||0.5)*100) + '%';
    ctx += ' \u5B98\u50DA\u6548\u7387:' + Math.round((es.bureaucracyStrength||0.5)*100) + '%';
    ctx += ' \u519B\u4E8B\u4E13\u4E1A:' + Math.round((es.militaryProfessionalism||0.5)*100) + '%\n';
    if (es.legitimacySource) ctx += '  \u6B63\u7EDF\u6027:' + (legLabels[es.legitimacySource]||es.legitimacySource);
    if (es.landSystemType) ctx += ' \u571F\u5730\u5236\u5EA6:' + (landLabels[es.landSystemType]||es.landSystemType);
    ctx += '\n';
    // A1: contextDescription
    if (es.contextDescription) ctx += '  \u80CC\u666F:' + es.contextDescription.slice(0, 200) + '\n';
  }

  // B3: 经济配置增强（含更多字段）
  if (P.economyConfig && P.economyConfig.enabled !== false) {
    var ec = P.economyConfig;
    ctx += '\u3010\u7ECF\u6D4E\u4F53\u5236\u3011\n';
    ctx += '  \u8D27\u5E01:' + (ec.currency||'\u8D2F') + ' \u57FA\u7840\u6536\u5165:' + (ec.baseIncome||100);
    ctx += ' \u7A0E\u7387:' + Math.round((ec.taxRate||0.1)*100) + '%';
    if (ec.inflationRate > 0.03) ctx += ' \u901A\u80C0:' + Math.round(ec.inflationRate*100) + '%';
    var cycleLabels = {prosperity:'\u7E41\u8363',stable:'\u7A33\u5B9A',recession:'\u8870\u9000',depression:'\u8427\u6761'};
    if (ec.economicCycle) ctx += ' \u5468\u671F:' + (cycleLabels[ec.economicCycle]||ec.economicCycle);
    ctx += '\n';
    if (ec.agricultureMultiplier && ec.agricultureMultiplier !== 1) ctx += '  \u519C\u4E1A\u7CFB\u6570:' + ec.agricultureMultiplier;
    if (ec.commerceMultiplier && ec.commerceMultiplier !== 1) ctx += ' \u5546\u4E1A\u7CFB\u6570:' + ec.commerceMultiplier;
    if (ec.tradeBonus > 0.1) ctx += ' \u8D38\u6613\u52A0\u6210:' + Math.round(ec.tradeBonus*100) + '%';
    if (ec.agricultureMultiplier !== 1 || ec.commerceMultiplier !== 1 || ec.tradeBonus > 0.1) ctx += '\n';
    if (ec.specialResources) ctx += '  \u7279\u4EA7:' + String(ec.specialResources).slice(0, 80) + '\n';
    if (ec.tradeSystem) ctx += '  \u8D38\u6613:' + String(ec.tradeSystem).slice(0, 80) + '\n';
    if (ec.description) ctx += '  \u8D22\u653F:' + String(ec.description).slice(0, 100) + '\n';
  }

  // 建筑系统（类型+实际建筑概况）
  if (P.buildingSystem && P.buildingSystem.buildingTypes && P.buildingSystem.buildingTypes.length > 0) {
    ctx += '\u3010\u5EFA\u7B51\u4F53\u7CFB\u3011\n';
    P.buildingSystem.buildingTypes.slice(0, 10).forEach(function(b) {
      ctx += '  ' + b.name + '(' + (b.category || '') + ')';
      if (b.maxLevel) ctx += ' Lv' + b.maxLevel;
      if (b.description) ctx += '\uFF1A' + b.description.slice(0, 30);
      ctx += '\n';
    });
    ctx += '  \u203B \u7528building_changes\u5EFA\u9020/\u5347\u7EA7/\u62C6\u9664\u5EFA\u7B51\u3002\u5EFA\u7B51\u5F71\u54CD\u7ECF\u6D4E\u3001\u519B\u4E8B\u3001\u6587\u5316\u3002\n';
  }
  // 实际建筑概况
  var _allBlds = (typeof getAllBuildingsCompat === 'function') ? getAllBuildingsCompat() : ((GM.buildings && GM.buildings) || []);
  if (_allBlds && _allBlds.length > 0) {
    var _bldByTerritory = {};
    _allBlds.forEach(function(b) {
      if (!_bldByTerritory[b.territory]) _bldByTerritory[b.territory] = [];
      _bldByTerritory[b.territory].push(b.name + 'Lv' + b.level);
    });
    var _bldLines = Object.keys(_bldByTerritory).slice(0, 6).map(function(t) {
      return '  ' + t + ': ' + _bldByTerritory[t].join(', ');
    });
    if (_bldLines.length > 0) {
      ctx += '\u3010\u5DF2\u5EFA\u5EFA\u7B51\u3011\n' + _bldLines.join('\n') + '\n';
    }
  }

  // 政体/官制结构（让AI了解部门职能和官职权责）
  if (P.government && P.government.nodes && P.government.nodes.length > 0) {
    ctx += '\u3010\u5B98\u5236\u7ED3\u6784\u3011\n';
    P.government.nodes.slice(0, 8).forEach(function(dept) {
      ctx += '  ' + dept.name;
      if (dept.functions && dept.functions.length > 0) ctx += '(\u804C\u80FD:' + dept.functions.slice(0, 3).join('/') + ')';
      if (dept.positions && dept.positions.length > 0) {
        ctx += ' \u5B98\u804C:' + dept.positions.slice(0, 4).map(function(p) {
          var pInfo = p.name;
          if (p.holder) pInfo += '[\u73B0\u4EFB:' + p.holder + ']';
          return pInfo;
        }).join(',');
      }
      ctx += '\n';
      // 子部门（只展示一层）
      if (dept.subs && dept.subs.length > 0) {
        dept.subs.slice(0, 3).forEach(function(sub) {
          ctx += '    \u2514' + sub.name + (sub.positions ? ' (' + sub.positions.length + '\u5B98\u804C)' : '') + '\n';
        });
      }
    });
    if (P.government.description) ctx += '  \u653F\u4F53:' + P.government.description.slice(0, 60) + '\n';
  }

  // A2: 岗位/官职运作规则增强
  if (P.postSystem && P.postSystem.postRules && P.postSystem.postRules.length > 0) {
    var succLabels = {appointment:'\u6D41\u5B98(\u671D\u5EF7\u4EFB\u547D)',hereditary:'\u4E16\u88AD(\u7236\u6B7B\u5B50\u7EE7)',examination:'\u79D1\u4E3E\u9009\u62D4',recommendation:'\u4E3E\u8350\u5236',purchase:'\u6350\u5B98',military:'\u519B\u529F\u6388\u804C'};
    ctx += '\u3010\u5B98\u804C\u8FD0\u4F5C\u89C4\u5219\u3011\n';
    ctx += '  \u203B AI\u5728\u63A8\u6F14\u4EFB\u514D\u65F6\u5FC5\u987B\u5C0A\u91CD\u4EE5\u4E0B\u89C4\u5219\uFF1A\n';
    P.postSystem.postRules.slice(0, 8).forEach(function(r) {
      var rInfo = '  ' + (r.positionName || r.name || '');
      rInfo += '\uFF1A' + (succLabels[r.succession] || r.succession || '\u6D41\u5B98');
      if (r.hasAppointmentRight) rInfo += ' [\u6709\u8F9F\u7F72\u6743\u2014\u53EF\u81EA\u884C\u4EFB\u547D\u5C5E\u5B98]';
      if (r.description) rInfo += ' ' + r.description.slice(0, 50);
      ctx += rInfo + '\n';
    });
  }

  // 封臣体制（类型定义+实际关系图）
  if (P.vassalSystem && P.vassalSystem.vassalTypes && P.vassalSystem.vassalTypes.length > 0) {
    ctx += '\u3010\u5C01\u81E3\u4F53\u5236\u3011\n';
    P.vassalSystem.vassalTypes.slice(0, 5).forEach(function(v) {
      ctx += '  ' + v.name;
      if (v.rank) ctx += '(' + v.rank + ')';
      ctx += '\uFF1A';
      if (v.obligations) ctx += '\u4E49\u52A1:' + v.obligations.slice(0, 30) + ' ';
      if (v.rights) ctx += '\u6743\u5229:' + v.rights.slice(0, 30);
      if (v.autonomyFields && v.autonomyFields.length > 0) ctx += ' \u81EA\u6CBB:' + v.autonomyFields.join('/');
      ctx += '\n';
    });
    ctx += '  \u203B \u5C01\u81E3\u5173\u7CFB\u5F71\u54CD\u8D21\u8D4B\u3001\u5175\u5458\u3001\u5FE0\u8BDA\u3002\u7528vassal_changes\u64CD\u4F5C\u5C01\u81E3\u5173\u7CFB\u3002\n';
  }
  // 实际封臣关系图（谁是谁的封臣）
  if (GM.facs) {
    var _vassalLines = [];
    GM.facs.forEach(function(f) {
      if (f.vassals && f.vassals.length > 0) {
        var vDetails = f.vassals.map(function(vn) {
          var vf = GM._indices.facByName ? GM._indices.facByName.get(vn) : null;
          if (!vf) return vn;
          var ruler = GM.chars ? GM.chars.find(function(c) { return c.faction === vn && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); }) : null;
          var loyStr = ruler ? '\u5FE0' + (ruler.loyalty || 50) : '';
          var tribStr = '\u8D21' + Math.round((vf.tributeRate || 0.3) * 100) + '%';
          var warn = (ruler && ruler.loyalty < 35) ? '\u26A0' : '';
          return vn + '(' + tribStr + ' ' + loyStr + warn + ')';
        });
        _vassalLines.push('  [' + f.name + ']\u2192' + vDetails.join('\u3001'));
      }
    });
    if (_vassalLines.length > 0) {
      ctx += '\u3010\u5C01\u5EFA\u5173\u7CFB\u3011\n' + _vassalLines.join('\n') + '\n';
    }
  }

  // 头衔爵位（体系定义+持有者列表）
  var _titleRanks = (P.titleSystem && Array.isArray(P.titleSystem.titleRanks)) ? P.titleSystem.titleRanks : [];
  if (_titleRanks.length > 0) {
    ctx += '\u3010\u7235\u4F4D\u4F53\u7CFB\u3011' + _titleRanks.slice(0, 8).map(function(t) { return t.name + (t.level !== undefined ? '(Lv' + t.level + ')' : ''); }).join('\u2192') + '\n';
  }
  // 实际头衔持有者
  if (GM.chars) {
    var _titleHolders = [];
    GM.chars.forEach(function(c) {
      if (c.alive !== false && c.titles && c.titles.length > 0) {
        var ts = c.titles.map(function(t) { return t.name + (t.hereditary ? '(\u4E16\u88AD)' : '(\u6D41\u5B98)'); }).join('/');
        _titleHolders.push(c.name + ':' + ts);
      }
    });
    if (_titleHolders.length > 0) {
      ctx += '\u3010\u7235\u4F4D\u6301\u6709\u3011' + _titleHolders.slice(0, 10).join('\u3001') + '\n';
    }
  }

  // 科举制度
  if (P.keju) {
    if (P.keju.enabled) {
      ctx += '\u3010\u79D1\u4E3E\u5236\u5EA6\u3011\n';
      ctx += '  ' + (P.keju.examIntervalNote || '\u5DF2\u542F\u7528');
      if (P.keju.examSubjects) ctx += ' \u79D1\u76EE:' + P.keju.examSubjects;
      if (P.keju.quotaPerExam) ctx += ' \u6BCF\u79D1\u53D6\u58EB:' + P.keju.quotaPerExam + '\u4EBA';
      if (P.keju.specialRules) ctx += ' \u89C4\u5219:' + P.keju.specialRules;
      ctx += '\n';
      if (P.keju.examNote) ctx += '  ' + P.keju.examNote.slice(0, 100) + '\n';
      // 科举历史
      if (P.keju.history && P.keju.history.length > 0) {
        var lastExam = P.keju.history[P.keju.history.length - 1];
        ctx += '  \u4E0A\u6B21\u79D1\u4E3E:' + (lastExam.date ? lastExam.date.year + '\u5E74' : '') + ' \u53D6\u58EB' + (lastExam.passedCount||0) + '\u4EBA';
        if (lastExam.topThree && lastExam.topThree.length > 0) ctx += ' \u72B6\u5143:' + lastExam.topThree[0];
        ctx += '\n';
      }
    } else {
      // 非科举时代也显示选才制度
      if (P.keju.examNote) ctx += '\u3010\u9009\u624D\u5236\u5EA6\u3011' + P.keju.examNote.slice(0, 80) + '\n';
    }
  }

  // 阶层概况
  if (GM.classes && GM.classes.length > 0) {
    ctx += '【社会阶层】\n';
    GM.classes.forEach(function(c) {
      var sat = parseInt(c.satisfaction) || 50;
      var inf = parseInt(c.influence || c.classInfluence) || 0;
      var cInfo = '  ' + c.name;
      if (c.size || c.population) cInfo += '(' + (c.size || c.population) + ')';
      cInfo += ' 满意' + sat + ' 影响' + inf;
      if (c.economicRole) cInfo += ' 角色:' + c.economicRole;
      if (c.mobility) cInfo += ' 流动:' + c.mobility;
      if (c.demands) cInfo += '\n    诉求:' + String(c.demands).slice(0, 30);
      // 不满警告
      var threshold = c.unrestThreshold || 30;
      if (sat < threshold) cInfo += '\n    ⚠ 满意度低于阈值(' + threshold + ')，社会动荡风险!';
      // 得罪分数
      var offScore = GM.offendGroupScores && GM.offendGroupScores['class_' + c.name];
      if (offScore && offScore > 5) cInfo += ' 被得罪:' + Math.round(offScore);
      ctx += cInfo + '\n';
    });
  }

  // 重要物品
  if (GM.items && GM.items.length > 0) {
    var ownedItems = GM.items.filter(function(it) { return it.acquired; });
    var notOwned = GM.items.filter(function(it) { return !it.acquired; });
    if (ownedItems.length > 0) {
      ctx += '【已获物品】\n';
      ownedItems.forEach(function(it) {
        ctx += '  ' + it.name;
        if (it.effect) ctx += '(' + String(it.effect).slice(0, 20) + ')';
        if (it.value) ctx += ' 值' + it.value;
        if (it.owner) ctx += ' 持有:' + it.owner;
        ctx += '\n';
      });
    }
    if (notOwned.length > 0 && notOwned.length <= 6) {
      ctx += '【未获物品】' + notOwned.map(function(it) { return it.name + (it.rarity ? '[' + it.rarity + ']' : ''); }).join('、') + '\n';
    }
  }

  // 亲疏关系（横向：人↔人，含NPC之间）
  if (typeof AffinityMap !== 'undefined') {
    var sigAff = AffinityMap.getSignificantRelations(25);
    if (sigAff.length > 0) {
      ctx += '【人际亲疏】\n';
      sigAff.slice(0, 10).forEach(function(r) {
        var label = r.value >= 50 ? '莫逆' : r.value >= 25 ? '亲近' : r.value <= -50 ? '死敌' : '不睦';
        ctx += '  ' + r.a + '↔' + r.b + ' ' + label + '(' + r.value + ')\n';
      });
    }
  }

  // NPC 个人目标（让AI知道各角色在追求什么）
  if (GM.chars) {
    var goaled = GM.chars.filter(function(c) { return c.alive !== false && c.personalGoal; });
    if (goaled.length > 0) {
      ctx += '【各方意图】\n';
      goaled.slice(0, 8).forEach(function(c) {
        ctx += '  ' + c.name + '：' + c.personalGoal.substring(0, 40) + '\n';
      });
    }
  }

  // 空缺岗位（让AI知道哪些职位需要人）
  if (GM.postSystem && GM.postSystem.posts) {
    var vacant = GM.postSystem.posts.filter(function(p) { return p.status === 'vacant' || !p.holder; });
    if (vacant.length > 0) {
      ctx += '【空缺官职】\n';
      vacant.slice(0, 6).forEach(function(p) {
        ctx += '  ' + (p.territoryName || '') + p.name + '（空缺）\n';
      });
      if (vacant.length > 6) ctx += '  ...等' + vacant.length + '个空缺\n';
    }
  }
  // 也检查官制树中的空缺
  if (GM.officeTree && GM.officeTree.length > 0) {
    var officeVacant = [];
    function _findVacant(nodes) {
      nodes.forEach(function(node) {
        if (node.positions) {
          node.positions.forEach(function(pos) {
            if (!pos.holder) officeVacant.push(node.name + pos.name);
          });
        }
        if (node.subs) _findVacant(node.subs);
      });
    }
    _findVacant(GM.officeTree);
    if (officeVacant.length > 0 && !(GM.postSystem && GM.postSystem.posts)) {
      ctx += '【空缺官职】\n  ' + officeVacant.slice(0, 6).join('，') + (officeVacant.length > 6 ? '等' + officeVacant.length + '个' : '') + '\n';
    }
    // 官制填充率概况
    var _totalPos = 0, _filledPos = 0;
    (function _cntOff(nodes) {
      nodes.forEach(function(n) {
        if (n.positions) n.positions.forEach(function(p) { _totalPos++; if (p.holder) _filledPos++; });
        if (n.subs) _cntOff(n.subs);
      });
    })(GM.officeTree);
    if (_totalPos > 0) {
      ctx += '\u3010\u5B98\u5236\u6982\u51B5\u3011\u5B98\u804C' + _totalPos + '\u4E2A \u5728\u4EFB' + _filledPos + ' \u7A7A\u7F3A' + (_totalPos - _filledPos) + ' \u586B\u5145\u7387' + Math.round(_filledPos / _totalPos * 100) + '%\n';
    }
    // 外戚任职信息
    if (GM.chars && GM.harem) {
      var _spouseNames = GM.chars.filter(function(c) { return c.alive !== false && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true); }).map(function(c) { return c.motherClan || c.family || ''; }).filter(function(s) { return s; });
      if (_spouseNames.length > 0) {
        var _clanOfficials = [];
        GM.chars.forEach(function(c) {
          if (c.alive !== false && c.family && _spouseNames.indexOf(c.family) !== -1 && !(typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true)) {
            var _hasOffice = false;
            if (GM.officeTree) {
              (function _chk(nodes) { nodes.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (p.holder === c.name) _hasOffice = true; }); if (n.subs) _chk(n.subs); }); })(GM.officeTree);
            }
            if (_hasOffice) _clanOfficials.push(c.name + '(' + c.family + '\u65CF)');
          }
        });
        if (_clanOfficials.length > 0) {
          ctx += '\u3010\u5916\u621A\u4EFB\u804C\u3011' + _clanOfficials.slice(0, 5).join('\u3001') + '\n';
        }
      }
    }
  }

  // 新科进士+门生座主网络（让AI了解科举政治格局）
  if (GM.chars) {
    var _allJinshi = GM.chars.filter(function(c) { return c.alive !== false && c.source === '\u79D1\u4E3E'; });
    if (_allJinshi.length > 0) {
      var _recentJs = _allJinshi.filter(function(c) { return c.recruitTurn >= GM.turn - 3; });
      if (_recentJs.length > 0) {
        ctx += '\u3010\u65B0\u79D1\u8FDB\u58EB\u3011' + _recentJs.map(function(j) {
          return j.name + '(' + (j.title||'') + ' \u667A' + (j.intelligence||0) + ' \u6CBB' + (j.administration||0) + (j.party && j.party!=='\u65E0\u515A\u6D3E'?' \u515A:'+j.party:'') + ')';
        }).join('\u3001') + '\n';
      }
      // 门生-座主网络
      if (P.keju && P.keju.history && P.keju.history.length > 0) {
        var _mentorNet = P.keju.history.slice(-3).filter(function(h){return h.chiefExaminer;}).map(function(h) {
          return h.chiefExaminer + (h.examinerParty ? '(' + h.examinerParty + ')' : '') + '\u2192\u95E8\u751F:' + (h.topThree||[]).join(',');
        });
        if (_mentorNet.length > 0) {
          ctx += '\u3010\u95E8\u751F\u5EA7\u4E3B\u3011' + _mentorNet.join('\uFF1B') + '\n';
        }
      }
    }
  }

  // 门阀家族网络（从GM.families注册表读取，包含声望和分支）
  if (GM.families) {
    var _famKeys = Object.keys(GM.families);
    if (_famKeys.length > 0) {
      var _tierOrder = {'imperial':0,'noble':1,'gentry':2,'common':3};
      _famKeys.sort(function(a, b) {
        var fa = GM.families[a], fb = GM.families[b];
        var ta = _tierOrder[fa.tier] || 3, tb = _tierOrder[fb.tier] || 3;
        if (ta !== tb) return ta - tb;
        return (fb.renown || 0) - (fa.renown || 0);
      });
      var _tierNames = {'imperial':'\u7687\u65CF','noble':'\u4E16\u5BB6','gentry':'\u58EB\u65CF','common':'\u5BD2\u95E8'};
      ctx += '\u3010\u95E8\u9600\u5BB6\u65CF\u3011\n';
      _famKeys.slice(0, 8).forEach(function(fn) {
        var fam = GM.families[fn];
        if (!fam) return;
        var livingCount = 0;
        // \u5B88\u536B:\u7ECF doActualStart \u7684 sc.families \u5206\u53D1(renown \u515C\u5E95)\u521B\u5EFA\u7684\u5BB6\u65CF\u53EF\u80FD\u65E0 branches/members \u2192 \u539F forEach \u5D29\u00B7
        //   \u4E14\u6B64\u5904\u5728 LLM prompt.build \u5185\u00B7\u672A\u88AB\u6355\u83B7 \u2192 \u76F4\u63A5\u5D29\u6389\u6574\u4E2A mode A \u56DE\u5408(\u8DE8\u5267\u672C\u00B7\u51E1\u6709\u65E0\u5206\u652F\u5BB6\u65CF\u5373\u89E6\u53D1)\u3002
        (fam.branches || []).forEach(function(b) {
          ((b && b.members) || []).forEach(function(m) { var c = findCharByName(m); if (c && c.alive !== false) livingCount++; });
        });
        if (livingCount === 0) return;
        ctx += '  ' + fn + '(' + (_tierNames[fam.tier] || '\u5BD2\u95E8') + ',\u58F0\u671B' + Math.round(fam.renown || 0) + ',' + livingCount + '\u4EBA)';
        if ((fam.branches || []).length > 1) {
          ctx += ' \u5206\u652F:' + fam.branches.map(function(b) { return b && b.name; }).filter(Boolean).join('/');
        }
        ctx += '\n';
      });
      // 检测家族内部矛盾（族人间亲疏度负值）
      if (typeof AffinityMap !== 'undefined') {
        _famKeys.slice(0, 5).forEach(function(fn) {
          var fam = GM.families[fn];
          if (!fam) return;
          var conflicts = [];
          var allMem = [];
          (fam.branches || []).forEach(function(b) { allMem = allMem.concat((b && b.members) || []); });
          for (var _i = 0; _i < allMem.length && conflicts.length < 2; _i++) {
            for (var _j = _i + 1; _j < allMem.length && conflicts.length < 2; _j++) {
              var _av = AffinityMap.get(allMem[_i], allMem[_j]) || 0;
              if (_av < -15) conflicts.push(allMem[_i] + '\u2194' + allMem[_j] + '(\u4E0D\u7766)');
            }
          }
          if (conflicts.length > 0) {
            ctx += '  ' + fn + '\u5185\u90E8\u77DB\u76FE\uFF1A' + conflicts.join('\uFF1B') + '\n';
          }
        });
      }
      ctx += '  \u203B \u540C\u65CF\u4E0D\u7B49\u4E8E\u540C\u5FC3\u3002\u65CF\u4EBA\u4E4B\u95F4\u53EF\u80FD\u56E0\u5BB6\u4EA7\u3001\u50A8\u4F4D\u3001\u653F\u89C1\u53CD\u76EE\u3002\u5185\u6597\u6BD4\u5916\u6218\u66F4\u6B8B\u9177\u3002\n';
      ctx += '  \u5BD2\u95E8\u53EF\u5D1B\u8D77\u4E3A\u65B0\u8D35\uFF1B\u4E16\u5BB6\u53EF\u56E0\u5185\u8017\u800C\u8870\u843D\u3002\u95E8\u7B2C\u5F71\u54CD\u5A5A\u59FB\u3001\u4EFB\u5B98\u3001\u8054\u76DF\u3002\n';
    }
  }

  // 死亡风险角色（AI决定谁实际死亡）
  if (GM._deathRiskChars && GM._deathRiskChars.length > 0) {
    ctx += '【死亡风险】以下角色因年老/疾病面临死亡风险，请在叙事中根据剧情需要决定是否让其去世：\n';
    GM._deathRiskChars.forEach(function(r) {
      ctx += '  ' + r.name + '（' + (r.age || '?') + '岁，概率' + r.probability + '，' + r.reason + '）\n';
    });
    GM._deathRiskChars = []; // 清空，避免重复
  }

  // 阴谋暗流（多回合阴谋弧·确定性引擎推演中·不清空·将发者交 AI 决成败）
  try {
    if (typeof ConspiracyEngine !== 'undefined' && ConspiracyEngine && typeof ConspiracyEngine.aiContextBlock === 'function') {
      ctx += ConspiracyEngine.aiContextBlock(GM);
    }
  } catch (_cspE) {}

  // 近期NPC自主行动（从事件日志中提取）
  if (GM.evtLog) {
    var npcAuto = GM.evtLog.filter(function(e) { return e.type === 'NPC自主' || e.type === 'NPC行为'; }).slice(-5);
    if (npcAuto.length > 0) {
      ctx += '【近期NPC动向】\n';
      npcAuto.forEach(function(e) { ctx += '  T' + e.turn + ' ' + e.text + '\n'; });
    }
  }

  // 后宫/妻室信息（让AI了解宫廷家庭关系，驱动后宫叙事）
  // 后宫制度概述
  if (GM.harem) {
    if (GM.harem.haremDescription) ctx += '\u3010\u540E\u5BAB\u5236\u5EA6\u3011' + GM.harem.haremDescription.slice(0, 80) + '\n';
    if (GM.harem.motherClanSystem) {
      var _mcsLabels = {powerful:'\u5916\u621A\u53EF\u5E72\u653F',restricted:'\u5916\u621A\u53D7\u9650',forbidden:'\u4E25\u7981\u5916\u621A'};
      ctx += '  \u5916\u621A\u5236\u5EA6:' + (_mcsLabels[GM.harem.motherClanSystem] || GM.harem.motherClanSystem) + '\n';
    }
    if (GM.harem.successionNote) ctx += '  \u7EE7\u627F\u89C4\u5219:' + GM.harem.successionNote.slice(0, 60) + '\n';
  }
  if (GM.chars) {
    var _spouses = GM.chars.filter(function(c) { return c.alive !== false && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true); });
    if (_spouses.length > 0) {
      ctx += '\u3010\u540E\u5BAB/\u59BB\u5BA4\u3011\n';
      // 按位份排序
      var _rankOrder = {'empress':0,'queen':0,'consort':1,'concubine':2,'attendant':3};
      _spouses.sort(function(a, b) { return (_rankOrder[a.spouseRank] || 9) - (_rankOrder[b.spouseRank] || 9); });
      _spouses.forEach(function(sp) {
        var parts = ['  ' + sp.name];
        if (sp.spouseRank) {
          var _rkNames = {'empress':'\u7687\u540E/\u6B63\u59BB','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
          parts.push(_rkNames[sp.spouseRank] || sp.spouseRank);
        }
        if (sp.motherClan) parts.push('\u6BCD\u65CF:' + sp.motherClan);
        if (sp.personality) parts.push(sp.personality.slice(0, 10));
        if (sp.children && sp.children.length > 0) parts.push('\u5B50\u5973:' + sp.children.join('\u3001'));
        // 宠爱暗示（通过亲疏值推断，不用显式数字）
        if (typeof AffinityMap !== 'undefined' && P.playerInfo) {
          var _af = AffinityMap.get(P.playerInfo.characterName, sp.name);
          if (_af > 30) parts.push('(\u5F97\u5BA0)');
          else if (_af < -10) parts.push('(\u5931\u5BA0)');
        }
        ctx += parts.join(' ') + '\n';
      });
      // 继承相关
      if (GM.harem && GM.harem.heirs && GM.harem.heirs.length > 0) {
        ctx += '  \u7EE7\u627F\u987A\u5E8F\uFF1A' + GM.harem.heirs.join('\u2192') + '\n';
      }
      // 怀孕中
      if (GM.harem && GM.harem.pregnancies && GM.harem.pregnancies.length > 0) {
        GM.harem.pregnancies.forEach(function(preg) {
          ctx += '  ' + preg.motherName + '\u6709\u5B55\u4E2D';
          if (preg.dueThisTurn) ctx += '\uFF08\u5373\u5C06\u4EA7\u5B50\uFF0C\u4EC5\u8BB0\u5F55\u751F\u80B2\u4E8B\u4EF6\uFF0C\u4E0D\u5728\u56DE\u5408\u63A8\u6F14\u4E2D\u81EA\u52A8\u521B\u5EFA\u89D2\u8272\uFF09';
          ctx += '\n';
        });
      }
      // 外戚势力（后宫→前朝联动）
      if (GM.facs || GM.parties) {
        var _clanInfo = [];
        _spouses.forEach(function(sp) {
          if (!sp.motherClan) return;
          var fac = (GM.facs || []).find(function(f) { return f.name && f.name.indexOf(sp.motherClan) >= 0; });
          var party = !fac && GM.parties ? GM.parties.find(function(p) { return p.name && p.name.indexOf(sp.motherClan) >= 0; }) : null;
          var power = fac ? (fac.strength || 50) : (party ? (party.influence || 50) : 0);
          if (power > 0) {
            _clanInfo.push(sp.motherClan + '(' + (typeof getHaremRankName === 'function' ? getHaremRankName(sp.spouseRank) : '') + sp.name + '\u6BCD\u65CF,\u52BF\u529B' + power + ')');
          }
        });
        if (_clanInfo.length > 0) {
          ctx += '  \u3010\u5916\u621A\u52BF\u529B\u3011' + _clanInfo.join('\uFF1B') + '\n';
          ctx += '  \u203B \u5916\u621A\u662F\u540E\u5BAB\u4E0E\u524D\u671D\u7684\u6865\u6881\u3002\u5F97\u5BA0\u5983\u5ABE\u7684\u6BCD\u65CF\u5728\u671D\u4E2D\u52BF\u529B\u81A8\u80C0\uFF0C\u53EF\u80FD\u5E72\u653F/\u5F04\u6743\uFF1B\u5931\u5BA0\u8005\u6BCD\u65CF\u8870\u843D\u3002\n';
        }
      }
      // 子嗣详情
      var _allChildren = [];
      _spouses.forEach(function(sp) {
        if (sp.children) sp.children.forEach(function(cn) {
          var child = typeof findCharByName === 'function' ? findCharByName(cn) : null;
          if (child && child.alive !== false) {
            _allChildren.push({ name: cn, age: child.age || 0, gender: child.gender || '', mother: sp.name, motherRank: sp.spouseRank,
              heirPos: GM.harem && GM.harem.heirs ? GM.harem.heirs.indexOf(cn) : -1 });
          }
        });
      });
      if (_allChildren.length > 0) {
        ctx += '  \u3010\u5B50\u55E3\u3011\n';
        _allChildren.forEach(function(c) {
          ctx += '    ' + c.name + ' ' + c.age + '\u5C81 ' + c.gender + ' \u6BCD:' + c.mother;
          if (typeof getHaremRankName === 'function') ctx += '(' + getHaremRankName(c.motherRank) + ')';
          if (c.heirPos === 0) ctx += ' \u2605\u592A\u5B50';
          else if (c.heirPos > 0) ctx += ' \u7B2C' + (c.heirPos + 1) + '\u987A\u4F4D';
          ctx += '\n';
        });
        if (_allChildren.length > 1) ctx += '    \u203B \u591A\u7687\u5B50\u5E76\u5B58\u65F6\uFF0C\u50A8\u4F4D\u4E4B\u4E89\u662F\u81EA\u7136\u4E8B\u4EF6\u3002\u5404\u6BCD\u65CF\u4F1A\u4E3A\u5916\u5B59\u4E89\u53D6\u592A\u5B50\u4E4B\u4F4D\u3002\n';
      }
      ctx += '  \u53D9\u4E8B\u4E2D\u53EF\u81EA\u7136\u878D\u5165\u540E\u5BAB\u4E8B\u52A1\uFF1A\u5AC9\u5992\u3001\u8054\u59FB\u3001\u679D\u8FB9\u98CE\u3001\u5B50\u55E3\u7EB7\u4E89\u3001\u8D24\u540E\u52B5\u8C0F\u3001\u5916\u621A\u5E72\u653F\u7B49\u3002\n';
    }
  }

  // 角色压力排行（让AI知道谁濒临崩溃、谁心态良好）
  if (GM.chars) {
    var _stressChars = GM.chars.filter(function(c) { return c.alive !== false && (c.stress || 0) > 30; });
    if (_stressChars.length > 0) {
      _stressChars.sort(function(a, b) { return (b.stress || 0) - (a.stress || 0); });
      ctx += '【高压角色】\n';
      _stressChars.slice(0, 5).forEach(function(c) {
        var label = (c.stress || 0) > 70 ? '\u6FC2\u5D29' : (c.stress || 0) > 50 ? '\u7126\u8651' : '\u7D27\u5F20';
        ctx += '  ' + c.name + ' \u538B\u529B' + (c.stress || 0) + '(' + label + ')';
        if (c._mood && c._mood !== '\u5E73') ctx += ' \u60C5\u7EEA:' + c._mood;
        ctx += '\n';
      });
    }
  }

  // 玩家近期决策轨迹（让AI知道玩家的执政风格）
  if (GM.playerDecisions && GM.playerDecisions.length > 0) {
    var _recentDecs = GM.playerDecisions.slice(-6);
    ctx += '【近期决策轨迹】\n';
    _recentDecs.forEach(function(d) { ctx += '  T' + d.turn + ' ' + d.desc + '\n'; });
  }

  // 旧式关系变量（保留兼容）
  var sigRels = Object.entries(GM.rels || {}).filter(function(e) { return Math.abs(e[1].value) > 20; });
  if (sigRels.length) {
    ctx += '【外交关系指标】\n';
    sigRels.slice(0, 6).forEach(function(e) { ctx += '  ' + e[0] + ':' + e[1].value + '\n'; });
  }

  // 势力间关系矩阵
  if (GM.factionRelations && GM.factionRelations.length > 0) {
    ctx += '【势力间关系】\n';
    GM.factionRelations.forEach(function(r) {
      ctx += '  ' + r.from + ' → ' + r.to + '：' + (r.type || '中立') + '(' + (r.value || 0) + ')';
      if (r.desc) ctx += ' ' + r.desc.slice(0, 20);
      ctx += '\n';
    });
  }

  // 近期势力事件
  if (GM.factionEvents && GM.factionEvents.length > 0) {
    var recentFE = GM.factionEvents.filter(function(e) { return e.turn >= (GM.turn - 3); });
    if (recentFE.length > 0) {
      ctx += '【近期势力动态】\n';
      recentFE.slice(-8).forEach(function(e) {
        ctx += '  T' + e.turn + ' ' + e.actor + (e.target ? '→' + e.target : '') + '：' + e.action + (e.result ? '→' + e.result : '') + '\n';
      });
    }
  }

  // 硬性事实（AI 不得违反）
  var hardFacts = buildHardFacts();
  if (hardFacts.length > 0) {
    ctx += '【硬性事实·不得违反】\n';
    hardFacts.forEach(function(f) { ctx += '  ⚠ ' + f + '\n'; });
  }

  // 变量阈值→条件事件提醒
  if (GM.vars && GM.events) {
    var _alerts = [];
    Object.keys(GM.vars).forEach(function(k) {
      var v = GM.vars[k];
      if (v.value <= v.min + (v.max - v.min) * 0.1) {
        _alerts.push(k + '\u6781\u4F4E(' + Math.round(v.value) + ')');
      }
      if (v.value >= v.max * 0.9) {
        _alerts.push(k + '\u6781\u9AD8(' + Math.round(v.value) + ')');
      }
    });
    if (_alerts.length > 0) {
      // 查找匹配的条件事件
      var _condEvts = GM.events.filter(function(e) { return e.type === 'conditional' && !e.triggered; });
      ctx += '\u3010\u53D8\u91CF\u8B66\u62A5\u3011' + _alerts.join('\u3001') + '\n';
      if (_condEvts.length > 0) {
        ctx += '  \u76F8\u5173\u6761\u4EF6\u4E8B\u4EF6\uFF1A' + _condEvts.slice(0, 4).map(function(e) { return e.name + '(\u6761\u4EF6:' + (e.trigger || '').slice(0, 20) + ')'; }).join('\u3001') + '\n';
        ctx += '  \u203B AI\u5E94\u6839\u636E\u53D8\u91CF\u72B6\u6001\u5224\u65AD\u662F\u5426\u89E6\u53D1\u8FD9\u4E9B\u4E8B\u4EF6\u3002\n';
      }
    }
  }

  // 信息茧房矛盾（让AI产生多层叙事）
  var cocoon = buildInformationCocoon();
  if (cocoon.length > 0) {
    ctx += '【官报与密报·矛盾情报】\n';
    cocoon.forEach(function(c) {
      ctx += '  [官] ' + c.official + '\n';
      ctx += '  [密] ' + c.intel + '\n';
    });
    ctx += '  ※ 请在叙事中体现信息不对称——不同渠道对同一事件的解读可能矛盾。\n';
  }

  // 群体不满数据（供AI推演参考）
  if (typeof OffendGroupsSystem !== 'undefined' && OffendGroupsSystem.getContext) {
    var offendCtx = OffendGroupsSystem.getContext();
    if (offendCtx) ctx += offendCtx;
  }
  // 改革反弹数据（供AI推演参考）
  if (typeof AutoReboundSystem !== 'undefined' && AutoReboundSystem.getContext) {
    var reboundCtx = AutoReboundSystem.getContext();
    if (reboundCtx) ctx += reboundCtx;
  }

  // 上回合系统变化摘要（让AI知道机械系统做了什么）
  if (GM.turnChanges && Object.keys(GM.turnChanges).length > 0) {
    var changeLines = [];
    for (var cat in GM.turnChanges) {
      GM.turnChanges[cat].forEach(function(item) {
        if (item.changes && item.changes.length > 0) {
          item.changes.forEach(function(ch) {
            changeLines.push(item.name + '.' + ch.field + ':' + ch.oldValue + '→' + ch.newValue + '(' + ch.reason + ')');
          });
        }
      });
    }
    if (changeLines.length > 0) {
      ctx += '【系统变化记录】\n';
      changeLines.slice(0, 8).forEach(function(l) { ctx += '  ' + l + '\n'; });
    }
  }

  // 剧本目标条件（让AI知道胜负方向）
  if (P.goals && P.goals.length > 0) {
    ctx += '【目标条件】\n';
    P.goals.forEach(function(g) {
      var typeL = { win: '胜利', lose: '失败', npc_goal: 'NPC目标', milestone: '里程碑' };
      ctx += '  [' + (typeL[g.type] || g.type) + '] ' + g.name + '：' + (g.description || '').slice(0, 60) + '\n';
    });
  }

  // 变量概览（让AI知道有哪些可修改的变量及当前值）
  if (GM.vars && Object.keys(GM.vars).length > 0) {
    ctx += '\u3010\u8D44\u6E90\u53D8\u91CF\u3011\n';
    var _varKeys = Object.keys(GM.vars);
    _varKeys.slice(0, 15).forEach(function(k) {
      var v = GM.vars[k];
      ctx += '  ' + k + ':' + Math.round(v.value);
      if (v.unit) ctx += v.unit;
      ctx += ' [' + (v.min || 0) + '~' + (v.max || '?') + ']';
      if (v.value <= v.min + (v.max - v.min) * 0.1) ctx += ' \u26A0\u4F4E';
      if (v.value >= v.max * 0.9) ctx += ' \u26A0\u9AD8';
      ctx += '\n';
    });
    ctx += '  \u203B \u7528resource_changes\u4FEE\u6539\u53D8\u91CF\u3002\n';
    // 公式关系（让AI理解变量间联动）
    if (GM._varFormulas && GM._varFormulas.length > 0) {
      ctx += '  \u516C\u5F0F\u5173\u7CFB\uFF1A' + GM._varFormulas.slice(0, 5).map(function(f) { return f.name + '(' + (f.expression || '').slice(0, 40) + ')'; }).join('\uFF1B') + '\n';
    }
  }

  // 事件列表（编辑器定义的事件，让AI知道可能触发什么）
  if (GM.events && GM.events.length > 0) {
    var _untriggeredEvts = GM.events.filter(function(e) { return !e.triggered; });
    var _triggeredEvts = GM.events.filter(function(e) { return e.triggered; });
    if (_untriggeredEvts.length > 0) {
      ctx += '\u3010\u5F85\u89E6\u53D1\u4E8B\u4EF6\u3011\n';
      _untriggeredEvts.slice(0, 8).forEach(function(e) {
        ctx += '  ' + (e.name || '') + (e.type ? '(' + e.type + ')' : '');
        if (e.trigger) ctx += ' \u6761\u4EF6:' + String(e.trigger).slice(0, 40);
        if (e.importance) ctx += ' ' + e.importance;
        ctx += '\n';
      });
      ctx += '  \u203B AI\u5E94\u5728\u63A8\u6F14\u4E2D\u6CE8\u610F\u8FD9\u4E9B\u4E8B\u4EF6\u7684\u89E6\u53D1\u6761\u4EF6\u3002\u6761\u4EF6\u6EE1\u8DB3\u65F6\u901A\u8FC7timeline_triggers\u89E6\u53D1\uFF08name\u5B57\u6BB5\u586B\u4E8B\u4EF6\u540D\uFF09\u3002\u8FDE\u9501\u4E8B\u4EF6\u89E6\u53D1\u540E\u5E94\u7EE7\u7EED\u89E6\u53D1\u5176chainNext\u4E8B\u4EF6\u3002\n';
    }
    if (_triggeredEvts.length > 0) {
      ctx += '\u3010\u5DF2\u53D1\u751F\u4E8B\u4EF6\u3011' + _triggeredEvts.slice(0, 5).map(function(e) { return e.name; }).join('\u3001') + '\n';
    }
  }

  // 剧本规则（兼容两种格式：对象{base,combat,...} 和 数组[{name,trigger,effect}]）
  if (P.rules) {
    var ruleTexts = [];
    if (typeof P.rules === 'object' && !Array.isArray(P.rules)) {
      // 新编辑器格式：{base:'text', combat:'text', economy:'text', diplomacy:'text'}
      ['base','combat','economy','diplomacy'].forEach(function(k) {
        if (P.rules[k]) ruleTexts.push(k + '\uFF1A' + P.rules[k].slice(0, 200));
      });
    } else if (Array.isArray(P.rules)) {
      // 旧编辑器格式：[{name, trigger, effect}]
      P.rules.slice(0, 8).forEach(function(r) {
        if (r.name) ruleTexts.push(r.name + (r.effect && r.effect.narrative ? '\uFF1A' + r.effect.narrative.slice(0, 60) : ''));
      });
    }
    if (ruleTexts.length > 0) {
      ctx += '\u3010\u5267\u672C\u89C4\u5219\u3011\n  ' + ruleTexts.join('\n  ') + '\n';
    }
  }
  if (P.globalRules) {
    ctx += '【全局规则】\n  ' + P.globalRules.slice(0, 200) + '\n';
  }

  // 科技树（已解锁的科技）
  if (_sysEnabled('techTree') && GM.techTree && GM.techTree.length > 0) {
    var unlocked = GM.techTree.filter(function(t) { return t.unlocked; });
    var locked = GM.techTree.filter(function(t) { return !t.unlocked; });
    if (unlocked.length > 0 || locked.length > 0) {
      ctx += '【科技】';
      if (unlocked.length > 0) ctx += '已有:' + unlocked.map(function(t) { return t.name; }).join('、');
      if (locked.length > 0) ctx += (unlocked.length > 0 ? '；' : '') + '可研:' + locked.slice(0, 5).map(function(t) { return t.name; }).join('、');
      ctx += '\n';
    }
  }

  // 民政树（已采用的政策）
  if (_sysEnabled('civicTree') && GM.civicTree && GM.civicTree.length > 0) {
    var adopted = GM.civicTree.filter(function(c) { return c.adopted; });
    if (adopted.length > 0) {
      ctx += '【政策】已行:' + adopted.map(function(c) { return c.name; }).join('、') + '\n';
    }
  }

  // 时间线（预设的未来事件——让AI可以铺垫）
  // 时间线（剧本预设的历史/未来事件——指导AI叙事方向）
  if (P.timeline) {
    var _tl = Array.isArray(P.timeline) ? P.timeline : [].concat(P.timeline.past || []).concat(P.timeline.future || []);
    var pastEvts = _tl.filter(function(t) { return t.type === 'past'; });
    var futureEvts = _tl.filter(function(t) { return t.type === 'future' && !t.triggered; });
    if (pastEvts.length > 0 || futureEvts.length > 0) {
      ctx += '\u3010\u5267\u672C\u65F6\u95F4\u7EBF\u3011\n';
      if (pastEvts.length > 0) {
        ctx += '  \u5DF2\u53D1\u751F\uFF1A' + pastEvts.slice(0, 4).map(function(t) { return (t.year || '') + ' ' + (t.name || t.event || ''); }).join('\uFF1B') + '\n';
      }
      if (futureEvts.length > 0) {
        ctx += '  \u672A\u6765\u53EF\u80FD\uFF1A' + futureEvts.slice(0, 4).map(function(t) { return (t.year || '') + ' ' + (t.name || t.event || ''); }).join('\uFF1B') + '\n';
        ctx += '  \u203B \u672A\u6765\u4E8B\u4EF6\u662F\u5267\u672C\u9884\u8BBE\u7684\u53EF\u80FD\u8D70\u5411\u3002AI\u5E94\u5728\u63A8\u6F14\u4E2D\u9010\u6B65\u94FA\u57AB\u8FD9\u4E9B\u4E8B\u4EF6\uFF0C\u800C\u975E\u5FFD\u7565\u3002\n';
      }
    }
  }

  // 行政区划概况（含主官、经济、建筑 + 深化字段：户口/民心/腐败/公库/承载力）
  if (P.adminHierarchy) {
    var adminFactions = Object.keys(P.adminHierarchy).filter(function(k) { return P.adminHierarchy[k] && P.adminHierarchy[k].divisions && P.adminHierarchy[k].divisions.length > 0; });
    if (adminFactions.length > 0) {
      ctx += '\u3010\u884C\u653F\u533A\u5212\u3011\n';
      ctx += '  \u203B \u7528admin_changes\u4EFB\u547D/\u64A4\u6362\u5730\u65B9\u5B98\u3001\u8C03\u6574\u7E41\u8363\u5EA6\uFF1B\u7528 changes[] \u4FEE\u6539 divisions.X.{population,fiscal,publicTreasury,minxin,corruption} \u7B49\u6DF1\u5316\u5B57\u6BB5\u3002\n';
      adminFactions.forEach(function(fk) {
        var divs = P.adminHierarchy[fk].divisions;
        divs.slice(0, 10).forEach(function(d) {
          ctx += '  ' + d.name + (d.level ? '(' + d.level + ')' : '');
          if (d.governor) ctx += ' \u5B98:' + d.governor;
          if (d.prosperity) ctx += ' \u7E41' + d.prosperity;
          if (d.terrain) ctx += ' ' + d.terrain;
          // 深化字段（简洁显示）
          if (d.population && typeof d.population === 'object') {
            var mo = d.population.mouths || 0, ho = d.population.households || 0;
            if (mo > 10000) ctx += ' \u53E3' + Math.round(mo/10000) + '\u4E07';
            if (d.population.fugitives > 0) ctx += ' \u9003' + d.population.fugitives;
          }
          if (d.minxin !== undefined) ctx += ' \u6C11\u5FC3' + Math.round(d.minxin||0);
          if (d.corruption !== undefined) ctx += ' \u8150' + Math.round(d.corruption||0);
          if (d.fiscal && d.fiscal.actualRevenue) ctx += ' \u8D4B' + Math.round((d.fiscal.actualRevenue||0)/10000) + '\u4E07';
          if (d.publicTreasury && d.publicTreasury.money && d.publicTreasury.money.deficit > 0) ctx += ' \u4E8F' + Math.round(d.publicTreasury.money.deficit/10000) + '\u4E07';
          if (d.regionType && d.regionType !== 'normal') ctx += ' [' + d.regionType + ']';
          if (d.environment && d.environment.currentLoad > 0.9) ctx += ' \u8FC7\u8F7D';
          if (d.children && d.children.length > 0) {
            ctx += '\uFF1A' + d.children.slice(0, 5).map(function(c) { return c.name + (c.governor ? '(' + c.governor + ')' : ''); }).join('\u3001');
            if (d.children.length > 5) ctx += '\u7B49' + d.children.length + '\u4E2A';
          }
          ctx += '\n';
        });
      });
    }
  }

  // 角色成长动态
  if (typeof CharacterGrowthSystem !== 'undefined' && CharacterGrowthSystem.getGrowthContext) {
    var growthCtx = CharacterGrowthSystem.getGrowthContext();
    if (growthCtx) ctx += growthCtx;
  }

  // 近期事件（使用角色标签格式化）
  if (GM.evtLog && GM.evtLog.length > 0) {
    ctx += '【近期事件】\n';
    GM.evtLog.slice(-6).forEach(function(e) {
      ctx += '  ' + formatEventWithRoles(e) + '\n';
    });
  }
  // AI伏笔（前几回合埋下的线索，本回合应有回应或发展）
  if (GM._foreshadows && GM._foreshadows.length > 0) {
    ctx += '\u3010\u672A\u7ADF\u4F0F\u7B14\u3011\n';
    GM._foreshadows.forEach(function(f) {
      ctx += '  T' + f.turn + ': ' + _memText(f) + '\n';
    });
    ctx += '  \u203B \u4EE5\u4E0A\u4F0F\u7B14\u5E94\u5728\u672C\u56DE\u5408\u6216\u672A\u67652-3\u56DE\u5408\u5185\u5F97\u5230\u56DE\u5E94/\u53D1\u5C55\u3002\u5DF2\u5B9E\u73B0\u7684\u4F0F\u7B14\u4F1A\u81EA\u52A8\u6E05\u9664\u3002\n';
  }

  // AI压缩记忆（跨回合的关键信息链）
  if (GM._aiMemory && GM._aiMemory.length > 0) {
    ctx += '\u3010AI\u5386\u53F2\u8BB0\u5FC6\u3011\n';
    GM._aiMemory.slice(-8).forEach(function(m) {
      ctx += '  T' + m.turn + ': ' + _memText(m) + '\n';
    });
  }

  // 当前大势走向
  if (GM._currentTrend) {
    ctx += '\u3010\u5F53\u524D\u5927\u52BF\u3011' + GM._currentTrend + '\n';
  }

  return ctx;
}
