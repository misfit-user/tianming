// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Post 岗位系统 - 增量式增强层
// ============================================================

// Post 数据结构：
// {
//   id: string,
//   name: string,              // 岗位名称，如"刺史"、"太守"
//   territoryId: string,       // 所属领地 ID
//   territoryName: string,     // 领地名称
//   holder: string,            // 当前任职者名字（空字符串表示空缺）
//   rank: number,              // 品级（1-9，数字越小品级越高）
//   salary: number,            // 俸禄
//   authority: string[],       // 权限列表，如 ['军事', '财政', '人事']
//   requirements: {            // 任职要求
//     minIntelligence: number,
//     minValor: number,
//     minLoyalty: number
//   },
//   appointedTurn: number,     // 任命回合
//   term: number,              // 任期（回合数，0表示无限期）
//   performance: number,       // 政绩评分（0-100）
//   status: string             // 状态：'active', 'vacant', 'suspended'
// }

/** @param {string} name @param {string} territoryId @param {string} territoryName @param {number} [rank=5] @param {string[]} [authority] @returns {Object} 岗位对象 */
function createPost(name, territoryId, territoryName, rank, authority) {
  if (!GM.postSystem) {
    GM.postSystem = { enabled: false, posts: [] };
  }

  var post = {
    id: uid(),
    name: name,
    territoryId: territoryId,
    territoryName: territoryName,
    holder: '',
    rank: rank || 5,
    salary: calculateSalary(rank || 5),
    authority: authority || [],
    requirements: {
      minIntelligence: 30,
      minValor: 20,
      minLoyalty: 50
    },
    appointedTurn: 0,
    term: 0,
    performance: 50,
    status: 'vacant'
  };

  GM.postSystem.posts.push(post);

  // 添加到索引
  if (GM.postSystem.enabled) {
    addToIndex('post', post.id, post);

    // 添加到领地索引
    if (!GM._indices.postByTerritory) {
      GM._indices.postByTerritory = new Map();
    }
    if (!GM._indices.postByTerritory.has(territoryId)) {
      GM._indices.postByTerritory.set(territoryId, []);
    }
    GM._indices.postByTerritory.get(territoryId).push(post);
  }

  return post;
}

// 计算俸禄（根据品级）
function calculateSalary(rank) {
  var salaries = [5000, 3000, 2000, 1500, 1000, 800, 600, 400, 200];
  return salaries[rank - 1] || 500;
}

/** @param {string} postId @param {string} characterName @returns {{success:boolean, message:string}} */
function appointToPost(postId, characterName) {
  var post = findPostById(postId);
  if (!post) {
    return { success: false, reason: '岗位不存在' };
  }

  var character = findCharByName(characterName);
  if (!character) {
    return { success: false, reason: '角色不存在' };
  }

  // 检查任职要求（post.requirements 可能不存在）
  // 特权检查：appoint_all → 跳过所有品级和能力要求
  var _appointerName = P.playerInfo ? P.playerInfo.characterName : '';
  var _skipRequirements = _appointerName && typeof hasPrivilege === 'function' && hasPrivilege(_appointerName, 'appoint_all');
  if (!_skipRequirements) {
    var req = post.requirements || {};
    if (req.minIntelligence && character.intelligence < req.minIntelligence) {
      return { success: false, reason: '智谋不足' };
    }
    if (req.minValor && character.valor < req.minValor) {
      return { success: false, reason: '武勇不足' };
    }
    if (req.minLoyalty && character.loyalty < req.minLoyalty) {
      return { success: false, reason: '忠诚度不足' };
    }
  }

  // 如果岗位已有任职者，先罢免
  if (post.holder) {
    dismissFromPost(postId);
  }

  // 任命
  post.holder = characterName;
  post.appointedTurn = GM.turn;
  post.status = 'active';
  post.performance = 50; // 初始政绩

  // 记录事件
  addEB('任命', characterName + ' 被任命为 ' + post.territoryName + ' ' + post.name);
  if (typeof recordCharacterArc === 'function') recordCharacterArc(characterName, 'appointment', '就任' + post.name);
  if (typeof StressSystem !== 'undefined') { var _sc = findCharByName(characterName); if (_sc) StressSystem.checkStress(_sc, '任命'); }

  return { success: true };
}

// 罢免岗位任职者
function dismissFromPost(postId) {
  var post = findPostById(postId);
  if (!post || !post.holder) {
    return { success: false, reason: '岗位空缺或不存在' };
  }

  var oldHolder = post.holder;
  post.holder = '';
  post.status = 'vacant';
  post.appointedTurn = 0;

  addEB('罢免', oldHolder + ' 被罢免 ' + post.territoryName + ' ' + post.name);
  if (typeof recordCharacterArc === 'function') recordCharacterArc(oldHolder, 'dismissal', '离任' + post.name);

  return { success: true, oldHolder: oldHolder };
}

// ============================================================
// PostTransfer — 岗位转移原子操作（借鉴晚唐风云）
// 所有官制变更必须通过这些原子函数，防止半成品状态
// ============================================================
/**
 * 岗位转移原子操作
 * @namespace
 * @property {function(string, string, string=):boolean} seat - 就任
 * @property {function(string):string|false} vacate - 空缺
 * @property {function(string, string, string, string=):boolean} transfer - 调任
 * @property {function(string):string[]} cascadeVacate - 级联空缺
 */
var PostTransfer = {
  /** 就任：设置岗位持有人 + 更新索引（验证角色存活） */
  seat: function(postId, holderId, appointedBy) {
    var post = findPostById(postId);
    if (!post) return false;
    // 验证角色是否存在且存活
    if (holderId) {
      var chr = (typeof findCharByName === 'function') ? findCharByName(holderId) : null;
      if (chr && chr.alive === false) {
        _dbg('[PostTransfer] 拒绝任命已故角色:', holderId);
        return false;
      }
    }
    // 如果岗位已有人，先空缺
    if (post.holder) PostTransfer.vacate(postId);
    post.holder = holderId;
    post.appointedTurn = GM.turn;
    post.status = 'active';
    post.performance = 50;
    if (appointedBy) post.appointedBy = appointedBy;
    addToIndex('post', postId, post);
    _dbg('[PostTransfer] 就任:', holderId, '→', post.name);
    return true;
  },

  /** 空缺：清空持有人 */
  vacate: function(postId) {
    var post = findPostById(postId);
    if (!post) return false;
    var prevHolder = post.holder;
    post.holder = '';
    post.status = 'vacant';
    post.appointedTurn = 0;
    _dbg('[PostTransfer] 空缺:', post.name, '(前任:', prevHolder, ')');
    return prevHolder;
  },

  /** 调任：原子化从 A 岗到 B 岗 */
  transfer: function(charName, fromPostId, toPostId, appointedBy) {
    PostTransfer.vacate(fromPostId);
    return PostTransfer.seat(toPostId, charName, appointedBy);
  },

  /** 级联空缺：持有人死亡/罢免时，清理相关岗位和索引 */
  cascadeVacate: function(charName) {
    var affected = [];
    // 清理 postSystem
    if (GM.postSystem && GM.postSystem.posts) {
      GM.postSystem.posts.forEach(function(p) {
        if (p.holder === charName) {
          PostTransfer.vacate(p.id);
          affected.push(p.name);
        }
      });
    }
    // 清理 officeTree（官制中的holder）
    if (GM.officeTree) {
      (function _clearHolder(nodes) {
        nodes.forEach(function(n) {
          if (n.positions) n.positions.forEach(function(p) {
            if (p.holder === charName) { p.holder = ''; affected.push(n.name + '·' + p.name); }
          });
          if (n.subs) _clearHolder(n.subs);
        });
      })(GM.officeTree);
    }
    // 清理 adminHierarchy（行政区划的governor，递归子层级）
    if (P.adminHierarchy) {
      Object.keys(P.adminHierarchy).forEach(function(k) {
        var ah = P.adminHierarchy[k];
        if (ah && ah.divisions) {
          (function _clearGov(divs) {
            divs.forEach(function(d) {
              if (d.governor === charName) { d.governor = ''; affected.push(k + '·' + d.name); }
              if (d.children) _clearGov(d.children);
              if (d.divisions) _clearGov(d.divisions);
            });
          })(ah.divisions);
        }
      });
    }
    if (affected.length) _dbg('[PostTransfer] 级联空缺:', charName, affected.join(','));
    return affected;
  }
};

// 转任（从一个岗位转到另一个岗位）
function transferPost(characterName, fromPostId, toPostId) {
  var fromPost = findPostById(fromPostId);
  var toPost = findPostById(toPostId);

  if (!fromPost || !toPost) {
    return { success: false, reason: '岗位不存在' };
  }

  if (fromPost.holder !== characterName) {
    return { success: false, reason: '角色不在原岗位' };
  }

  // 罢免原岗位
  dismissFromPost(fromPostId);

  // 任命新岗位
  var result = appointToPost(toPostId, characterName);

  if (result.success) {
    addEB('转任', characterName + ' 从 ' + fromPost.name + ' 转任 ' + toPost.name);
  }

  return result;
}

/** @param {string} postId @returns {Object|null} */
function findPostById(postId) {
  if (GM._indices && GM._indices.postById) {
    return GM._indices.postById.get(postId);
  }

  if (GM.postSystem && GM.postSystem.posts) {
    return GM.postSystem.posts.find(function(p) { return p.id === postId; });
  }

  return null;
}

// 查找领地的所有岗位
function findPostsByTerritory(territoryId) {
  if (GM._indices && GM._indices.postByTerritory) {
    return GM._indices.postByTerritory.get(territoryId) || [];
  }

  if (GM.postSystem && GM.postSystem.posts) {
    return GM.postSystem.posts.filter(function(p) { return p.territoryId === territoryId; });
  }

  return [];
}

// 查找角色的岗位
function findPostByHolder(characterName) {
  if (!GM.postSystem || !GM.postSystem.posts) return null;

  return GM.postSystem.posts.find(function(p) { return p.holder === characterName; });
}

// 更新岗位政绩（每回合调用）
function updatePostPerformance() {
  if (!GM.postSystem || !GM.postSystem.enabled || !GM.postSystem.posts) return;

  GM.postSystem.posts.forEach(function(post) {
    if (post.status !== 'active' || !post.holder) return;

    var character = findCharByName(post.holder);
    if (!character) return;

    // 根据角色能力计算政绩变化
    var performanceChange = 0;

    // 智谋影响
    if (character.intelligence >= 80) performanceChange += 2;
    else if (character.intelligence >= 60) performanceChange += 1;
    else if (character.intelligence < 30) performanceChange -= 2;

    // 忠诚度影响
    if (character.loyalty >= 80) performanceChange += 1;
    else if (character.loyalty < 50) performanceChange -= 1;

    // 时代状态影响
    if (GM.eraState) {
      if (GM.eraState.socialStability < 0.3) performanceChange -= 1;
      if (GM.eraState.economicProsperity < 0.3) performanceChange -= 1;
    }

    // 更新政绩
    post.performance = Math.max(0, Math.min(100, post.performance + performanceChange));

    // 检查任期
    if (post.term > 0) {
      var tenure = GM.turn - post.appointedTurn;
      if (tenure >= post.term) {
        // 任期届满
        addEB('任期', post.holder + ' 在 ' + post.name + ' 任期届满');
        dismissFromPost(post.id);
      }
    }
  });
}

// 获取岗位统计信息
function getPostStatistics() {
  if (!GM.postSystem || !GM.postSystem.posts) {
    return { total: 0, active: 0, vacant: 0, avgPerformance: 0 };
  }

  var total = GM.postSystem.posts.length;
  var active = GM.postSystem.posts.filter(function(p) { return p.status === 'active'; }).length;
  var vacant = GM.postSystem.posts.filter(function(p) { return p.status === 'vacant'; }).length;

  var totalPerformance = 0;
  var activeCount = 0;
  GM.postSystem.posts.forEach(function(p) {
    if (p.status === 'active') {
      totalPerformance += p.performance;
      activeCount++;
    }
  });

  var avgPerformance = activeCount > 0 ? Math.round(totalPerformance / activeCount) : 0;

  return {
    total: total,
    active: active,
    vacant: vacant,
    avgPerformance: avgPerformance
  };
}

// ============================================================
// 动态数据系统 - 插入到 endTurn() 之前
// ============================================================

// 变化追踪系统
GM.turnChanges = {
  variables: [],      // {name, oldValue, newValue, delta, reasons:[{type, amount, desc}]}
  characters: [],     // {name, changes:[{field, oldValue, newValue, reason}]}
  factions: [],       // {name, changes:[{field, oldValue, newValue, reason}]}
  parties: [],        // {name, changes:[{field, oldValue, newValue, reason}]}
  classes: [],        // {name, changes:[{field, oldValue, newValue, reason}]}
  military: [],       // {name, changes:[{field, oldValue, newValue, reason}]}
  map: []             // {name, changes:[{field, oldValue, newValue, reason}]}
};

/** @param {string} category @param {string} itemName @param {string} field @param {*} oldValue @param {*} newValue @param {string} reason */
function recordChange(category, itemName, field, oldValue, newValue, reason) {
  if (!GM.turnChanges[category]) GM.turnChanges[category] = [];
  var item = GM.turnChanges[category].find(function(x) { return x.name === itemName; });
  if (!item) {
    item = { name: itemName, changes: [] };
    GM.turnChanges[category].push(item);
  }
  item.changes.push({ field: field, oldValue: oldValue, newValue: newValue, reason: reason });
}

// 记录变量变化（支持多个原因）
function recordVarChange(varName, amount, type, desc) {
  if (!GM.turnChanges.variables) GM.turnChanges.variables = [];
  var v = GM.turnChanges.variables.find(function(x) { return x.name === varName; });
  if (!v) {
    var currentVal = GM.vars[varName] ? GM.vars[varName].value : 0;
    v = { name: varName, oldValue: currentVal, newValue: currentVal, delta: 0, reasons: [] };
    GM.turnChanges.variables.push(v);
  }
  v.newValue += amount;
  v.delta += amount;
  v.reasons.push({ type: type, amount: amount, desc: desc });
}

/**
 * 统一时间比例：按月结算 → 除以30得日均 → 乘以每回合天数
 * 公式：daysPerTurn / 30 / 12 = daysPerTurn / 360
 * 含义：1回合等于多少"年"（用于 ratePerTurn(年率) 计算）
 * 注：_getDaysPerTurn() 已移至 tm-utils.js（更早加载）
 * @returns {number}
 */
function getTimeRatio() {
  var dpv = _getDaysPerTurn();
  return dpv / 360;
}

// 解析 components 字符串为结构化数据
function parseComponents(componentsStr) {
  if (!componentsStr) return { income: [], expense: [] };
  var lines = componentsStr.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
  var result = { income: [], expense: [] };
  var currentType = null;

  lines.forEach(function(line) {
    if (line.indexOf('收入') === 0 || line.indexOf('收入：') === 0) {
      currentType = 'income';
      var content = line.replace(/^收入[:：]?\s*/, '');
      if (content) {
        content.split(/[、，,]/).forEach(function(item) {
          var trimmed = item.trim();
          if (trimmed) result.income.push(trimmed);
        });
      }
    } else if (line.indexOf('支出') === 0 || line.indexOf('支出：') === 0) {
      currentType = 'expense';
      var content = line.replace(/^支出[:：]?\s*/, '');
      if (content) {
        content.split(/[、，,]/).forEach(function(item) {
          var trimmed = item.trim();
          if (trimmed) result.expense.push(trimmed);
        });
      }
    } else if (currentType) {
      // 继续当前类型
      line.split(/[、，,]/).forEach(function(item) {
        var trimmed = item.trim();
        if (trimmed) result[currentType].push(trimmed);
      });
    }
  });

  return result;
}

// 更新变量系统
function updateVariables(timeRatio) {
  var sc = findScenarioById(GM.sid);
  if (!sc || !sc.variables) return;

  // 处理基础变量
  if (sc.variables.base && Array.isArray(sc.variables.base)) {
    sc.variables.base.forEach(function(varDef) {
      if (!varDef.name) return;

      // 补漏初始化：如果 startGame 时遗漏了该变量，直接赋值初始化（非 ChangeQueue，因为这是创建而非修改）
      if (!GM.vars[varDef.name]) {
        GM.vars[varDef.name] = {
          value: parseFloat(varDef.defaultValue) || 0,
          min: parseFloat(varDef.min) || 0,
          max: parseFloat(varDef.max) || 999999999
        };
        console.warn('[updateVariables] 补漏初始化变量:', varDef.name);
      }

      var oldValue = GM.vars[varDef.name].value;

      // 解析 components
      var comps = parseComponents(varDef.components);

      // 计算年度净变化（从 calcMethod 中提取，简化处理）
      var yearlyChange = 0;
      if (varDef.calcMethod) {
        // 尝试从 calcMethod 中提取数字
        var match = varDef.calcMethod.match(/[+\-]?\d+/);
        if (match) yearlyChange = parseFloat(match[0]);
      }

      // 按时间比例计算本回合变化
      var turnChange = yearlyChange * timeRatio;

      if (turnChange !== 0) {
        recordVarChange(varDef.name, turnChange, '常规变化', '年度变化 × 时间比例');
        GM.vars[varDef.name].value += turnChange;
      }

      // 记录 components 明细（用于显示）
      if (comps.income.length > 0) {
        comps.income.forEach(function(item) {
          recordVarChange(varDef.name, 0, '收入明细', item);
        });
      }
      if (comps.expense.length > 0) {
        comps.expense.forEach(function(item) {
          recordVarChange(varDef.name, 0, '支出明细', item);
        });
      }
    });
  }

  // 处理其他变量
  if (sc.variables.other && Array.isArray(sc.variables.other)) {
    sc.variables.other.forEach(function(varDef) {
      if (!varDef.name) return;

      // 补漏初始化：同上，创建缺失变量（非 ChangeQueue）
      if (!GM.vars[varDef.name]) {
        GM.vars[varDef.name] = {
          value: parseFloat(varDef.defaultValue) || 0,
          min: parseFloat(varDef.min) || 0,
          max: parseFloat(varDef.max) || 999999999
        };
        console.warn('[updateVariables] 补漏初始化变量:', varDef.name);
      }

      // 其他变量也按时间比例变化
      var comps = parseComponents(varDef.components);

      // 简化：假设 defaultValue 是年度值，按比例分配
      // 实际应该从 description 或其他地方获取变化率

      if (comps.income.length > 0 || comps.expense.length > 0) {
        // 记录明细
        comps.income.forEach(function(item) {
          recordVarChange(varDef.name, 0, '收入明细', item);
        });
        comps.expense.forEach(function(item) {
          recordVarChange(varDef.name, 0, '支出明细', item);
        });
      }
    });
  }
}

// ============================================================
// 时代状态动态更新系统
// ============================================================

function updateEraState() {
  if (!GM.eraState) {
    GM.eraState = {
      politicalUnity: 0.7,
      centralControl: 0.6,
      legitimacySource: 'hereditary',
      socialStability: 0.6,
      economicProsperity: 0.6,
      culturalVibrancy: 0.7,
      bureaucracyStrength: 0.6,
      militaryProfessionalism: 0.5,
      landSystemType: 'mixed',
      dynastyPhase: 'peak',
      contextDescription: ''
    };
  }
  var _ms = _getDaysPerTurn() / 30; // 月比例因子

  var es = GM.eraState;
  var changes = []; // 记录本回合的变化

  // 1. 根据资源变化调整经济繁荣度（使用varMapping自动匹配变量名）
  var _ecoKey = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
  var _foodKey = typeof _findVarByType === 'function' ? _findVarByType('food') : null;
  if (_ecoKey || _foodKey) {
    var wealth = (_ecoKey && GM.vars[_ecoKey]) ? GM.vars[_ecoKey].value : 0;
    var grain = (_foodKey && GM.vars[_foodKey]) ? GM.vars[_foodKey].value : 0;
    var wealthMax = (_ecoKey && GM.vars[_ecoKey]) ? GM.vars[_ecoKey].max : 10000;
    var grainMax = (_foodKey && GM.vars[_foodKey]) ? GM.vars[_foodKey].max : 10000;

    var wealthRatio = wealth / wealthMax;
    var grainRatio = grain / grainMax;

    var oldProsperity = es.economicProsperity;

    // 财政和粮食充足 → 经济繁荣度上升
    if (wealthRatio > 0.7 && grainRatio > 0.7) {
      es.economicProsperity = Math.min(1.0, es.economicProsperity + 0.02 * _ms);
      if (es.economicProsperity > oldProsperity) {
        changes.push('经济繁荣度上升');
      }
    } else if (wealthRatio < 0.2 || grainRatio < 0.2) {
      es.economicProsperity = Math.max(0.0, es.economicProsperity - 0.03 * _ms);
      if (es.economicProsperity < oldProsperity) {
        changes.push('经济繁荣度下降');
        // 触发经济危机事件
        if (es.economicProsperity < 0.3) {
          triggerHistoricalEvent('economic_crisis', '经济危机：财政和粮食严重短缺');
        }
      }
    }
  }

  // 2. 根据民心调整社会稳定度
  var _morKey = typeof _findVarByType === 'function' ? _findVarByType('morale') : null;
  if (_morKey && GM.vars[_morKey]) {
    var morale = GM.vars[_morKey].value;
    var moraleMax = GM.vars[_morKey].max || 100;
    var moraleRatio = morale / moraleMax;

    var oldStability = es.socialStability;

    if (moraleRatio > 0.8) {
      es.socialStability = Math.min(1.0, es.socialStability + 0.02 * _ms);
      if (es.socialStability > oldStability) {
        changes.push('社会稳定度上升');
      }
    } else if (moraleRatio < 0.3) {
      es.socialStability = Math.max(0.0, es.socialStability - 0.03 * _ms);
      if (es.socialStability < oldStability) {
        changes.push('社会稳定度下降');
        // 触发民变事件
        if (es.socialStability < 0.3) {
          triggerHistoricalEvent('civil_unrest', '民变：民心低落，社会动荡');
        }
      }
    }
  }

  // 3. 根据势力数量调整政治统一度
  if (GM.facs && GM.facs.length > 0) {
    var activeFactions = GM.facs.filter(function(f) { return f.strength && f.strength > 10; }).length;
    var oldUnity = es.politicalUnity;

    if (activeFactions <= 2) {
      es.politicalUnity = Math.min(1.0, es.politicalUnity + 0.02 * _ms);
      if (es.politicalUnity > oldUnity) {
        changes.push('政治统一度上升');
      }
    } else if (activeFactions >= 5) {
      es.politicalUnity = Math.max(0.0, es.politicalUnity - 0.02 * _ms);
      if (es.politicalUnity < oldUnity) {
        changes.push('政治统一度下降');
        // 触发分裂事件
        if (es.politicalUnity < 0.3) {
          triggerHistoricalEvent('political_fragmentation', '政治分裂：多方势力割据');
        }
      }
    }
  }

  // 4. 根据官制变更频率调整官僚体系强度
  if (GM.officeChanges && GM.officeChanges.length > 5) {
    // 频繁变更官制 → 官僚体系混乱
    var oldBureaucracy = es.bureaucracyStrength;
    es.bureaucracyStrength = Math.max(0.0, es.bureaucracyStrength - 0.02 * _ms);
    if (es.bureaucracyStrength < oldBureaucracy) {
      changes.push('官僚体系强度下降');
    }
  } else if (GM.officeTree && GM.officeTree.length > 0) {
    es.bureaucracyStrength = Math.min(1.0, es.bureaucracyStrength + 0.005 * _ms);
  }

  // 5. 根据军队数量调整军队职业化程度
  if (GM.armies && GM.armies.length > 0) {
    var totalTroops = GM.armies.reduce(function(sum, a) { return sum + (a.strength || 0); }, 0);
    if (totalTroops > 50000) {
      es.militaryProfessionalism = Math.min(1.0, es.militaryProfessionalism + 0.01 * _ms);
    } else if (totalTroops < 10000) {
      es.militaryProfessionalism = Math.max(0.0, es.militaryProfessionalism - 0.01 * _ms);
    }
  }

  // 6. 根据角色忠诚度调整中央集权度
  if (GM.chars && GM.chars.length > 0) {
    var totalLoyalty = 0;
    var loyaltyCount = 0;
    GM.chars.forEach(function(c) {
      if (c.loyalty !== undefined && hasOffice(c.name)) {
        totalLoyalty += c.loyalty;
        loyaltyCount++;
      }
    });

    if (loyaltyCount > 0) {
      var avgLoyalty = totalLoyalty / loyaltyCount;
      var oldControl = es.centralControl;

      if (avgLoyalty > 80) {
        es.centralControl = Math.min(1.0, es.centralControl + 0.01 * _ms);
        if (es.centralControl > oldControl) {
          changes.push('中央集权度上升');
        }
      } else if (avgLoyalty < 40) {
        es.centralControl = Math.max(0.0, es.centralControl - 0.02 * _ms);
        if (es.centralControl < oldControl) {
          changes.push('中央集权度下降');
          // 触发权力分散事件
          if (es.centralControl < 0.3) {
            triggerHistoricalEvent('power_decentralization', '权力分散：地方势力坐大');
          }
        }
      }
    }
  }

  // 7. 根据文化活动调整文化活力
  // 文化/科技变量——按关键字模糊匹配
  var _culKey = null, _techKey = null;
  if (GM.vars) { Object.keys(GM.vars).forEach(function(k) { if (!_culKey && /文化|文/.test(k)) _culKey = k; if (!_techKey && /科技|技术/.test(k)) _techKey = k; }); }
  if (_culKey || _techKey) {
    var culture = (_culKey && GM.vars[_culKey]) ? GM.vars[_culKey].value : 0;
    var tech = (_techKey && GM.vars[_techKey]) ? GM.vars[_techKey].value : 0;

    if (culture > 500 || tech > 500) {
      es.culturalVibrancy = Math.min(1.0, es.culturalVibrancy + 0.01 * _ms);
    } else if (culture < 100 && tech < 100) {
      es.culturalVibrancy = Math.max(0.0, es.culturalVibrancy - 0.01 * _ms);
    }
  }

  // 8. 朝代阶段趋势评估（向AI报告趋势，不自动切换阶段）
  // 朝代阶段的实际变化由AI在推演中通过叙事决定
  var oldPhase = es.dynastyPhase;
  var phaseTrend = '';

  if (es.economicProsperity > 0.8 && es.socialStability > 0.8 && es.centralControl > 0.7) {
    if (es.dynastyPhase !== 'peak') phaseTrend = '各项指标趋向盛世水平';
  } else if (es.economicProsperity < 0.3 || es.socialStability < 0.3) {
    if (es.dynastyPhase !== 'collapse') phaseTrend = '多项指标跌破危险线，王朝面临崩溃危机';
  } else if (es.economicProsperity < 0.5 || es.socialStability < 0.5 || es.centralControl < 0.4) {
    if (es.dynastyPhase === 'peak') phaseTrend = '指标下滑，盛世可能终结';
  } else if (es.dynastyPhase === 'decline' && es.economicProsperity > 0.6 && es.socialStability > 0.6) {
    phaseTrend = '指标回升，有中兴迹象';
  }

  if (phaseTrend) {
    changes.push(phaseTrend);
    addEB('时代趋势', phaseTrend + '（当前阶段：' + es.dynastyPhase + '）');
  }

  // 9. 根据中央集权度调整正统性来源
  if (es.centralControl < 0.3 && es.legitimacySource === 'hereditary') {
    es.legitimacySource = 'declining';
    changes.push('正统性来源衰落');
  } else if (es.centralControl > 0.7 && es.legitimacySource === 'declining') {
    es.legitimacySource = 'hereditary';
    changes.push('正统性来源恢复');
  }

  // 10. 综合评估：触发复合事件
  var crisisScore = 0;
  if (es.economicProsperity < 0.3) crisisScore++;
  if (es.socialStability < 0.3) crisisScore++;
  if (es.centralControl < 0.3) crisisScore++;
  if (es.politicalUnity < 0.3) crisisScore++;

  if (crisisScore >= 3) {
    triggerHistoricalEvent('total_crisis', '全面危机：经济、社会、政治多重危机爆发');
  }

  // 确保所有数值在 0-1 范围内
  ['politicalUnity', 'centralControl', 'socialStability', 'economicProsperity',
   'culturalVibrancy', 'bureaucracyStrength', 'militaryProfessionalism'].forEach(function(key) {
    if (es[key] !== undefined) {
      es[key] = Math.max(0, Math.min(1, es[key]));
    }
  });

  // 记录变化到事件簿
  if (changes.length > 0) {
    addEB('时代演化', '时代状态变化：' + changes.join('、'));
  }

  // 记录时代状态历史（用于趋势图表）
  if (!GM.eraStateHistory) {
    GM.eraStateHistory = [];
  }

  // 每回合记录一次时代状态
  GM.eraStateHistory.push({
    turn: GM.turn,
    date: GM.date,
    politicalUnity: es.politicalUnity,
    centralControl: es.centralControl,
    socialStability: es.socialStability,
    economicProsperity: es.economicProsperity,
    culturalVibrancy: es.culturalVibrancy,
    bureaucracyStrength: es.bureaucracyStrength,
    militaryProfessionalism: es.militaryProfessionalism
  });

  // 只保留最近 N 回合的历史（可配置）
  var eraHistLimit = ((P.conf && P.conf.memoryArchiveKeep) || 20) * 2;
  if (GM.eraStateHistory.length > eraHistLimit) {
    GM.eraStateHistory = GM.eraStateHistory.slice(-eraHistLimit);
  }
}

// 更新角色关系（动态演化）
function updateRelations() {
  if (!GM.rels || Object.keys(GM.rels).length === 0) return;
  if (!GM.chars || GM.chars.length === 0) return;

  var changes = [];

  Object.entries(GM.rels).forEach(function(entry) {
    var relName = entry[0];
    var relData = entry[1];
    var parts = relName.split('-');

    if (parts.length !== 2) return;

    var fromName = parts[0];
    var toName = parts[1];
    var fromChar = findCharByName(fromName);
    var toChar = findCharByName(toName);

    if (!fromChar || !toChar) return;

    var oldValue = relData.value;
    var newValue = oldValue;

    // 关系变化由AI叙事驱动，此处不再随机漂移
    // AI通过 relationship_changes 响应字段来调整关系值

    // 边界修正：极端关系趋向中和（按天数缩放）
    var _rms = _getDaysPerTurn() / 30;
    if (newValue > 80) {
      newValue -= 1 * _rms;
    } else if (newValue < -80) {
      newValue += 1 * _rms;
    }

    // 限制范围 -100 ~ 100
    newValue = Math.max(-100, Math.min(100, newValue));

    // 更新关系值（仅边界修正时才更新）
    if (newValue !== oldValue) {
      relData.value = newValue;
      recordChange('relations', relName, 'value', oldValue, newValue, '关系边界修正');
    }
  });

  // 记录到事件簿
  if (changes.length > 0 && changes.length <= 5) {
    addEB('\u5173\u7CFB\u6F14\u5316', changes.join('\uFF1B'));
  } else if (changes.length > 5) {
    addEB('关系演化', '本回合共有 ' + changes.length + ' 对角色关系发生变化');
  }
}

// 检查是否存在上下级关系
function checkHierarchy(title1, title2) {
  // 动态从品级判断层级（不硬编码官职名，适配全朝代）
  if (!title1 || !title2) return 0;
  // 优先用 rankLevel
  var char1 = findCharByName(title1);
  var char2 = findCharByName(title2);
  if (char1 && char2 && char1.rankLevel && char2.rankLevel) {
    return char2.rankLevel - char1.rankLevel; // rankLevel 越高=品级越高
  }
  // 回退：从官制树查找
  if (typeof findNpcOffice === 'function') {
    var off1 = findNpcOffice(title1);
    var off2 = findNpcOffice(title2);
    if (off1 && off2) {
      var rank1 = parseInt(off1.rank) || 0;
      var rank2 = parseInt(off2.rank) || 0;
      return rank2 - rank1;
    }
  }
  return 0; // 无法判断
}

// 成就系统已移除（暂不实现）
function checkAchievements() {}
function openAchievements() { toast('\u6682\u672A\u5F00\u653E'); }

// AI 调度监控面板（基于_runSubcall实际统计）
function openAIPerformance() {
  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'ai-performance-overlay';

  var stats = (GM && GM._aiDispatchStats) ? GM._aiDispatchStats : { totalCalls:0, totalTime:0, errors:0, byId:{}, errorLog:[] };
  var errorRate = stats.totalCalls > 0 ? ((stats.errors / stats.totalCalls) * 100).toFixed(1) : 0;
  var avgTime = stats.totalCalls > 0 ? Math.round(stats.totalTime / stats.totalCalls) : 0;

  var html = '<div class="generic-modal" style="max-width:650px;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>\u2699 AI \u8C03\u5EA6</h3>';
  html += '<button onclick="closeAIPerformance()">\u2715</button>';
  html += '</div>';
  html += '<div class="generic-modal-body" style="padding:1rem;">';

  // 总体统计
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.6rem;margin-bottom:1.2rem;">';
  html += '<div style="padding:0.7rem;background:var(--bg-3);border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u603B\u8C03\u7528</div>';
  html += '<div style="font-size:1.3rem;font-weight:700;color:var(--gold);">' + stats.totalCalls + '</div></div>';
  html += '<div style="padding:0.7rem;background:var(--bg-3);border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u5E73\u5747\u8017\u65F6</div>';
  html += '<div style="font-size:1.3rem;font-weight:700;color:' + (avgTime > 5000 ? 'var(--red)' : 'var(--blue)') + ';">' + (avgTime > 1000 ? (avgTime/1000).toFixed(1) + 's' : avgTime + 'ms') + '</div></div>';
  html += '<div style="padding:0.7rem;background:var(--bg-3);border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u9519\u8BEF\u7387</div>';
  html += '<div style="font-size:1.3rem;font-weight:700;color:' + (errorRate > 5 ? 'var(--red)' : 'var(--green)') + ';">' + errorRate + '%</div></div>';
  html += '</div>';

  // 按Sub-call分类统计
  var ids = Object.keys(stats.byId);
  if (ids.length > 0) {
    html += '<div style="font-size:0.88rem;font-weight:700;color:var(--txt-l);margin-bottom:0.5rem;">Sub-call \u5206\u7C7B\u7EDF\u8BA1</div>';
    html += '<div style="max-height:250px;overflow-y:auto;margin-bottom:1rem;">';
    // 按调用次数排序
    ids.sort(function(a,b){ return stats.byId[b].calls - stats.byId[a].calls; });
    ids.forEach(function(id) {
      var s = stats.byId[id];
      var avg = s.calls > 0 ? Math.round(s.totalTime / s.calls) : 0;
      var avgStr = avg > 1000 ? (avg/1000).toFixed(1) + 's' : avg + 'ms';
      var errClr = s.errors > 0 ? 'var(--red)' : 'var(--txt-d)';
      html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:4px;margin-bottom:0.3rem;font-size:0.8rem;">';
      html += '<span style="font-weight:700;color:var(--gold);width:3rem;flex-shrink:0;">' + id + '</span>';
      html += '<span style="flex:1;color:var(--txt-s);">' + s.name + '</span>';
      html += '<span style="color:var(--txt-d);">' + s.calls + '\u6B21</span>';
      html += '<span style="color:var(--blue);width:4rem;text-align:right;">\u5747' + avgStr + '</span>';
      if (s.errors > 0) html += '<span style="color:var(--red);font-size:0.72rem;">' + s.errors + '\u5931\u8D25</span>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:1.5rem;color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0\u8C03\u7528\u6570\u636E\uFF08\u8FDB\u884C\u7B2C\u4E00\u56DE\u5408\u540E\u53EF\u67E5\u770B\uFF09</div>';
  }

  // 错误日志
  if (stats.errorLog && stats.errorLog.length > 0) {
    html += '<div style="font-size:0.88rem;font-weight:700;color:var(--red);margin-bottom:0.5rem;">\u6700\u8FD1\u9519\u8BEF</div>';
    html += '<div style="max-height:150px;overflow-y:auto;margin-bottom:1rem;">';
    stats.errorLog.slice().reverse().slice(0, 5).forEach(function(e) {
      html += '<div style="font-size:0.75rem;padding:0.3rem 0.5rem;background:var(--bg-2);border-left:2px solid var(--red);border-radius:3px;margin-bottom:0.3rem;">';
      html += '<span style="color:var(--txt-d);">T' + e.turn + ' ' + e.time + '</span> ';
      html += '<span style="color:var(--gold);">[' + e.id + ']</span> ';
      html += '<span style="color:var(--txt-s);">' + escHtml(e.msg || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // 重置按钮
  html += '<div style="text-align:right;">';
  html += '<button class="bt bsm" onclick="if(GM._aiDispatchStats){GM._aiDispatchStats={totalCalls:0,totalTime:0,errors:0,byId:{},errorLog:[]};closeAIPerformance();openAIPerformance();toast(\'\\u7EDF\\u8BA1\\u5DF2\\u91CD\\u7F6E\');}">\u91CD\u7F6E\u7EDF\u8BA1</button>';
  html += '</div>';

  html += '</div></div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);
}

function closeAIPerformance() {
  var ov = document.getElementById('ai-performance-overlay');
  if (ov) ov.remove();
}

function clearAICache() {
  AICache.clear();
  toast('AI 缓存已清空');
  closeAIPerformance();
  openAIPerformance(); // 重新打开以刷新显示
}

function resetAIStats() {
  AICache.resetStats();
  toast('AI 统计已重置');
  closeAIPerformance();
  openAIPerformance(); // 重新打开以刷新显示
}

// ============================================================
// 存档管理系统
// ============================================================

// 轻量索引（localStorage，<2KB，用于UI快速渲染卡片）
function _updateSaveIndex(slotId, meta) {
  try {
    var idx = JSON.parse(localStorage.getItem('tm_save_index') || '{}');
    if (meta) {
      idx['slot_' + slotId] = { name: meta.name, turn: meta.turn, timestamp: Date.now(), scenarioName: meta.scenarioName || '', eraName: meta.eraName || '', dynastyPhase: meta.dynastyPhase || '', date: meta.date || '' };
    } else {
      delete idx['slot_' + slotId];
    }
    localStorage.setItem('tm_save_index', JSON.stringify(idx));
  } catch(e) {}
}
function _getSaveIndex() {
  try { return JSON.parse(localStorage.getItem('tm_save_index') || '{}'); } catch(e) { return {}; }
}

// 存档管理器
var SaveManager = {
  maxSlots: 10,
  autoSaveInterval: 5, // 每5回合自动存档

  // 获取所有存档元信息（从轻量索引，同步）
  getAllSaves: function() {
    var idx = _getSaveIndex();
    var saves = [];
    for (var i = 0; i < this.maxSlots; i++) {
      var info = idx['slot_' + i];
      if (info) {
        saves.push({
          slotId: i,
          name: info.name || ('存档' + (i+1)),
          turn: info.turn || 0,
          timestamp: info.timestamp || 0,
          scenarioName: info.scenarioName || '',
          eraName: info.eraName || ''
        });
      }
    }
    return saves;
  },

  // 保存游戏到指定槽位
  saveToSlot: function(slotId, saveName) {
    if (slotId < 0 || slotId >= this.maxSlots) {
      toast('❌ 无效的存档槽位');
      return false;
    }

    // 序列化全局系统到 GM
    if (typeof _prepareGMForSave === 'function') _prepareGMForSave();

    var _sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
    var gameState = { GM: deepClone(GM), P: deepClone(P) };
    var meta = {
      name: saveName || ('存档 ' + (slotId + 1)),
      type: slotId === 0 ? 'auto' : 'manual',
      turn: GM.turn,
      scenarioName: _sc ? _sc.name : '',
      eraName: GM.eraName || '',
      date: GM.date || '',
      dynastyPhase: GM.eraState ? GM.eraState.dynastyPhase : ''
    };

    // 写入 IndexedDB（异步，不阻塞UI）
    var slotKey = 'slot_' + slotId;
    console.log('[saveToSlot] 保存到:', slotKey, 'IDB available:', TM_SaveDB.isAvailable());
    TM_SaveDB.save(slotKey, gameState, meta).then(function(ok) {
      console.log('[saveToSlot] 保存结果:', ok);
      if (ok) {
        toast('\u2705 \u5DF2\u4FDD\u5B58\u5230\u69FD\u4F4D ' + (slotId + 1));
        _updateSaveIndex(slotId, meta);
      } else {
        toast('\u274C \u4FDD\u5B58\u5931\u8D25');
      }
    }).catch(function(e) { console.error('[saveToSlot] 存档异常:', e); toast('\u274C \u5B58\u6863\u5F02\u5E38'); });
    return true;
  },

  // 从指定槽位加载游戏（异步）
  loadFromSlot: function(slotId) {
    if (slotId < 0 || slotId >= this.maxSlots) { toast('无效的存档槽位'); return; }

    var slotKey = 'slot_' + slotId;
    console.log('[loadFromSlot] 尝试加载:', slotKey, 'IDB available:', TM_SaveDB.isAvailable());
    showLoading('展卷中……', 30);
    TM_SaveDB.load(slotKey).then(function(record) {
      hideLoading();
      console.log('[loadFromSlot] 加载结果:', record ? ('有数据, keys:' + Object.keys(record).join(',')) : 'null');
      if (!record || !record.gameState) { toast('该槽位没有存档'); return; }

      // record.gameState = {GM, P}
      // fullLoadGame期望格式B: data.gameState = {GM, P}
      // 需要包装一层让它识别
      var saveWrapper = { gameState: record.gameState };
      if (typeof SaveMigrations !== 'undefined') saveWrapper = SaveMigrations.run(saveWrapper);

      // 关闭案卷目录
      if (typeof closeSaveManager === 'function') closeSaveManager();

      if (typeof fullLoadGame === 'function') {
        fullLoadGame(saveWrapper);
      } else {
        var gs = record.gameState;
        GM = deepClone(gs.GM || gs);
        P = deepClone(gs.P || P);
        GM.running = true;
        if (typeof buildIndices === 'function') buildIndices();
        if (typeof enterGame === 'function') enterGame();
        if (typeof renderGameState === 'function') renderGameState();
      }
      toast('已加载：' + (record.name || '存档'));
    }).catch(function(e) {
      hideLoading();
      toast('加载失败：' + e.message);
    });
  },

  // 删除指定槽位
  deleteSlot: function(slotId) {
    if (slotId < 0 || slotId >= this.maxSlots) return false;
    TM_SaveDB.delete('slot_' + slotId).then(function() {
      _updateSaveIndex(slotId, null); // 清除索引
      toast('已删除存档');
    });
    return true;
  },

  // 自动存档（每回合调用）
  autoSave: function() {
    if (!GM.running) return;
    // 每N回合自动存到slot_0
    if (GM.turn % this.autoSaveInterval === 0) {
      this.saveToSlot(0, '自动封存 · 第' + GM.turn + '回合');
    }
  },

  // 导出存档为文件（异步·防御 Blob 未解压/压缩失败/空数据多种边界）
  exportSave: function(slotId) {
    var slotKey = 'slot_' + slotId;

    // 辅助：确保 record.gameState 是可 JSON 化的对象
    function _ensureDecompressed(record) {
      if (!record) return Promise.resolve(null);
      var gs = record.gameState;
      // 已是对象或字符串化 JSON → 直接用
      if (gs && typeof gs === 'object' && !(gs instanceof Blob)) return Promise.resolve(record);
      if (typeof gs === 'string') {
        try { record.gameState = JSON.parse(gs); } catch(_) {}
        return Promise.resolve(record);
      }
      // 是 Blob → 尝试解压
      if (gs instanceof Blob) {
        return SaveCompression.decompress(gs).then(function(jsonStr) {
          try { record.gameState = JSON.parse(jsonStr); }
          catch(_e) {
            // 再尝试把 Blob 当纯文本读
            return gs.text().then(function(t) { try { record.gameState = JSON.parse(t); } catch(_){ record.gameState = null; } return record; });
          }
          return record;
        });
      }
      return Promise.resolve(record);
    }

    TM_SaveDB.load(slotKey).then(function(record) {
      if (!record) { toast('该槽位没有存档'); return; }
      return _ensureDecompressed(record);
    }).then(function(record) {
      if (!record) return;
      if (!record.gameState || (typeof record.gameState === 'object' && Object.keys(record.gameState).length === 0)) {
        toast('❌ 存档数据为空·无法导出');
        console.error('[exportSave] record.gameState empty:', record);
        return;
      }
      // 统一用未压缩·可人读的 JSON 导出
      var exportRec = {
        id: record.id,
        name: record.name,
        type: record.type,
        timestamp: record.timestamp,
        turn: record.turn,
        scenarioName: record.scenarioName,
        eraName: record.eraName,
        date: record.date,
        dynastyPhase: record.dynastyPhase,
        gameState: record.gameState,
        _format: 'tianming-save-v1'
      };
      var json;
      try { json = JSON.stringify(exportRec, null, 2); }
      catch(_e) { console.error('[exportSave] JSON.stringify failed:', _e); toast('❌ 序列化失败'); return; }
      if (!json || json.length < 100) {
        toast('❌ 导出内容异常·请重试');
        console.error('[exportSave] serialized too short:', json && json.length);
        return;
      }
      var blob = new Blob([json], {type: 'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (record.name || 'save') + '_T' + (record.turn||0) + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast('✅ 存档已导出 · ' + (json.length/1024).toFixed(1) + 'KB');
    }).catch(function(e) {
      console.error('[exportSave] 异常:', e);
      toast('❌ 导出失败: ' + (e.message || e));
    });
  },

  // 导入存档文件·返回 Promise·兼容三种历史格式
  importSave: function(file, slotId) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onerror = function() {
        console.error('[importSave] FileReader 读文件失败');
        toast('\u274C \u8BFB\u6587\u4EF6\u5931\u8D25');
        resolve(false);
      };
      reader.onload = function(e) {
        try {
          var saveData = e.target.result;
          var save;
          try { save = JSON.parse(saveData); }
          catch(_pe) { console.error('[importSave] JSON 解析失败:', _pe); toast('\u274C JSON \u89E3\u6790\u5931\u8D25\u00B7' + (_pe.message||'')); resolve(false); return; }
          if (!save || typeof save !== 'object') { toast('\u274C \u5B58\u6863\u7ED3\u6784\u5F02\u5E38'); resolve(false); return; }

          // ── 规范化 gameState 为 {GM, P} 结构·兼容三种导出格式 ──
          // 格式 A（SaveManager.exportSave）: save = {id, name, ..., gameState: {GM, P}, _format:'tianming-save-v1'}
          // 格式 B（doSaveGame/desktopDoSave）: save = P 本体 + { gameState: GM_only }
          // 格式 C（极早期/手工导出）: save = { GM, P } 直接顶层无 wrapper
          var gs = save.gameState;
          var normalized = null;
          if (gs && typeof gs === 'object' && gs.GM && gs.P) {
            // 格式 A
            normalized = { GM: gs.GM, P: gs.P };
          } else if (gs && typeof gs === 'object' && (gs.turn !== undefined || gs.chars !== undefined || gs.sid !== undefined)) {
            // 格式 B：gameState 是 GM 本体（含 turn/chars/sid）·save 顶层其余字段作为 P
            var _pObj = {};
            var _skipMeta = {gameState:1,_format:1,id:1,name:1,type:1,timestamp:1,turn:1,scenarioName:1,eraName:1,date:1,dynastyPhase:1};
            Object.keys(save).forEach(function(k) { if (!_skipMeta[k]) _pObj[k] = save[k]; });
            normalized = { GM: gs, P: _pObj };
          } else if (save.GM && save.P) {
            // 格式 C
            normalized = { GM: save.GM, P: save.P };
          } else if (save.turn !== undefined || save.chars !== undefined) {
            // 兜底：save 整体当 GM
            normalized = { GM: save, P: {} };
          } else {
            console.error('[importSave] 无法识别存档格式·keys:', Object.keys(save).slice(0,10));
            toast('\u274C \u65E0\u6CD5\u8BC6\u522B\u7684\u5B58\u6863\u683C\u5F0F');
            resolve(false); return;
          }

          var slotKey = 'slot_' + slotId;
          var _gmRef = normalized.GM || {};
          var meta = {
            name: save.name || ('导入存档 ' + (slotId + 1)),
            type: 'imported',
            turn: save.turn || _gmRef.turn || 0,
            scenarioName: save.scenarioName || '',
            eraName: save.eraName || _gmRef.eraName || '',
            date: save.date || _gmRef.date || '',
            dynastyPhase: save.dynastyPhase || (_gmRef.eraState && _gmRef.eraState.dynastyPhase) || ''
          };
          console.log('[importSave] 规范化完成·slot=' + slotId + '·turn=' + meta.turn + '·gameState keys:', Object.keys(normalized));

          console.log('[importSave] 准备写入 IDB·slotKey=' + slotKey + '·normalized.GM.turn=' + (normalized.GM && normalized.GM.turn));
          TM_SaveDB.save(slotKey, normalized, meta).then(function(ok) {
            console.log('[importSave] TM_SaveDB.save 返回·ok=' + ok);
            if (ok) {
              _updateSaveIndex(slotId, meta);
              // 验证·再次 list 确认条目在 IDB
              setTimeout(function(){
                TM_SaveDB.list().then(function(list){
                  var found = list.filter(function(r){return r.id===slotKey;});
                  console.log('[importSave] 写后验证·IDB 共 ' + list.length + ' 条·目标槽位找到: ' + (found.length>0));
                  if (found.length === 0) toast('\u26A0 \u5199\u5165\u540E\u672A\u5728 IDB \u627E\u5230\u00B7\u53EF\u80FD\u7F13\u5B58\u95EE\u9898');
                });
              }, 100);
              toast('\u2705 \u5B58\u6863\u5DF2\u5F52\u6863\u5230\u5361\u4F4D ' + (slotId + 1));
              resolve(true);
            } else {
              toast('\u274C \u5199\u5165 IndexedDB \u5931\u8D25');
              resolve(false);
            }
          }).catch(function(_wE) {
            console.error('[importSave] TM_SaveDB.save 异常:', _wE);
            toast('\u274C \u5199\u5165\u5F02\u5E38\uFF1A' + (_wE.message || _wE));
            resolve(false);
          });
        } catch (err) {
          console.error('[importSave] 内部异常:', err);
          toast('\u274C \u5BFC\u5165\u5F02\u5E38\uFF1A' + (err.message || err));
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }
};

// 打开存档管理界面（美化版）
// ═══ 卷宗存档系统 — 竹简·玉轴·朱印 ═══

var _SCROLL_NUMS = ['自动','甲字壹号','甲字贰号','甲字叁号','甲字肆号','甲字伍号','甲字陆号','甲字柒号','甲字捌号','甲字玖号'];

function _scrollInkAge(timestamp) {
  var h = (Date.now() - (timestamp||0)) / 3600000;
  if (h < 1) return { cls: 'ink-fresh', label: '墨迹未干' };
  if (h < 24) return { cls: 'ink-recent', label: '墨色尚新' };
  if (h < 168) return { cls: 'ink-old', label: '渐已褪色' };
  return { cls: 'ink-ancient', label: '陈年旧墨' };
}

function _scrollTitle(save) {
  if (!save) return '';
  var gm = save.gameState ? (save.gameState.GM || save.gameState) : {};
  // 优先使用存档自带的 date，否则用 eraName，否则回退 turn
  var date = save.date;
  if (!date) {
    if (save.eraName) date = save.eraName + '年';
    else if (save.turn) date = '第' + save.turn + '回';
    else date = '未知时日';
  }
  var phase = (gm.eraState && gm.eraState.dynastyPhase) || save.dynastyPhase || '';
  var prefix = '';
  if (phase === 'collapse') prefix = '末路';
  else if (phase === 'peak') prefix = '盛世';
  else if (phase === 'decline' || phase === 'declining') prefix = '衰颓';
  else if (phase === 'founding' || phase === 'rising') prefix = '开基';
  else if (gm.unrest > 70) prefix = '烽烟';
  else if (gm.partyStrife > 70) prefix = '朝堂';
  else prefix = '国事';
  var suffix;
  if (gm.activeWars && gm.activeWars.length > 0) suffix = '征伐纪要';
  else if (gm.unrest > 60) suffix = '安民密策';
  else suffix = '纪要';
  return '〔' + date + ' ' + prefix + suffix + '〕';
}

function _scrollRibbon(save) {
  if (!save) return { h: '50%', c: 'var(--gold-400)' };
  var gm = save.gameState ? (save.gameState.GM || save.gameState) : {};
  var phase = (gm.eraState && gm.eraState.dynastyPhase) || save.dynastyPhase || 'stable';
  var c = 'var(--gold-400)';
  var h = 50;
  if (phase === 'peak' || phase === 'stable') { c = 'var(--green-400)'; h = 85; }
  else if (phase === 'rising' || phase === 'founding') { c = 'var(--gold-400)'; h = 65; }
  else if (phase === 'decline' || phase === 'declining') { c = 'var(--amber-400)'; h = 40; }
  else if (phase === 'crisis' || phase === 'collapse') { c = 'var(--vermillion-400)'; h = 20; }
  return { h: h + '%', c: c };
}

function openSaveManager() {
  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'save-manager-overlay';
  ov.onclick = function(e) { if (e.target === ov) closeSaveManager(); };

  // 先显示加载占位
  ov.innerHTML = '<div class="generic-modal scroll-panel" style="max-width:780px;text-align:center;padding:3rem;"><div class="scroll-manager-header">〔 案 卷 目 录 〕</div><div style="color:var(--color-foreground-muted);margin-top:2rem;">展卷中……</div></div>';
  document.body.appendChild(ov);

  // 异步从 IndexedDB 加载全部存档元信息
  TM_SaveDB.list().then(function(dbSaves) {
    // 将 IndexedDB 记录映射为 slot → save 对象
    var savesBySlot = {};
    dbSaves.forEach(function(s) {
      // id 格式: 'slot_0' ~ 'slot_9' 或 'autosave'
      if (s.id === 'autosave') {
        savesBySlot[0] = { slotId: 0, name: s.name, turn: s.turn, timestamp: s.timestamp, scenarioName: s.scenarioName, eraName: s.eraName, date: s.date || '', dynastyPhase: s.dynastyPhase || '' };
      } else if (s.id && s.id.indexOf('slot_') === 0) {
        var idx = parseInt(s.id.replace('slot_', ''));
        if (!isNaN(idx)) savesBySlot[idx] = { slotId: idx, name: s.name, turn: s.turn, timestamp: s.timestamp, scenarioName: s.scenarioName, eraName: s.eraName, date: s.date || '', dynastyPhase: s.dynastyPhase || '' };
      }
    });
    // 同时补充 localStorage 索引中的记录（兼容）
    var lsIdx = _getSaveIndex();
    Object.keys(lsIdx).forEach(function(k) {
      var idx = parseInt(k.replace('slot_', ''));
      if (!isNaN(idx) && !savesBySlot[idx]) {
        var info = lsIdx[k];
        savesBySlot[idx] = { slotId: idx, name: info.name, turn: info.turn, timestamp: info.timestamp, scenarioName: info.scenarioName || '', eraName: info.eraName || '', date: info.date || '', dynastyPhase: info.dynastyPhase || '' };
      }
    });

    var saves = [];
    for (var i = 0; i < SaveManager.maxSlots; i++) {
      if (savesBySlot[i]) saves.push(savesBySlot[i]);
    }

    _renderSaveManagerUI(ov, saves);
  }).catch(function(e) {
    console.error('[openSaveManager] 加载失败:', e);
    // 降级：从 localStorage 索引读
    var saves = SaveManager.getAllSaves();
    _renderSaveManagerUI(ov, saves);
  });
}

function _renderSaveManagerUI(ov, saves) {
  var sc = GM.running ? findScenarioById(GM.sid) : null;
  var _ic = typeof tmIcon === 'function' ? tmIcon : function() { return ''; };

  var html = '<div class="generic-modal scroll-panel" style="max-width:780px;">';

  // 标题
  html += '<div class="scroll-manager-header">';
  html += '〔 案 卷 目 录 〕';
  html += '<button class="bt bs bsm" onclick="closeSaveManager()" style="position:absolute;top:12px;right:16px;border:none;background:none;color:var(--color-foreground-muted);font-size:1rem;cursor:pointer;">'+_ic('close',16)+'</button>';
  html += '</div>';

  html += '<hr class="ink-divider">';
  html += '<div class="generic-modal-body" style="padding:var(--space-3) var(--space-4);">';

  // 当前游戏信息
  if (GM.running) {
    html += '<div style="margin-bottom:var(--space-3);padding:var(--space-2) var(--space-3);background:var(--color-elevated);border-left:3px solid var(--celadon-400);border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--color-foreground-secondary);line-height:var(--leading-normal);">';
    html += _ic('scroll',14) + ' 当前推演：' + (sc ? sc.name : '未知') + ' · 第' + GM.turn + '回合 · ' + (typeof getTSText==='function'?getTSText(GM.turn):'');
    html += '</div>';
  }

  // 卷宗网格
  html += '<div class="scroll-save-grid">';
  for (var i = 0; i < SaveManager.maxSlots; i++) {
    var save = saves.find(function(s) { return s.slotId === i; });
    var isAuto = i === 0;
    var archiveId = '案卷·' + (_SCROLL_NUMS[i] || '第'+i+'号');

    if (save) {
      var ink = _scrollInkAge(save.timestamp);
      var title = _scrollTitle(save);
      var ribbon = _scrollRibbon(save);
      var sealType = isAuto ? '' : ' square';
      var freshCls = (window._scrollJustSavedSlot === i || (window._scrollJustSavedSlot === -2 && i > 0 && ink.cls === 'ink-fresh')) ? ' fresh-ink' : '';
      var sealAnim = freshCls ? ' seal-animate' : '';

      html += '<div class="scroll-save-card ' + ink.cls + freshCls + '" style="--ribbon-h:' + ribbon.h + ';--ribbon-c:' + ribbon.c + ';" onclick="event.stopPropagation();">';
      // 归档编号
      html += '<div class="scroll-archive-id">' + archiveId + '</div>';
      // 标题
      html += '<div class="scroll-title">' + (title || save.name) + '</div>';
      // 元数据 + P11: 存档预览增强
      html += '<div class="scroll-meta">';
      html += save.scenarioName + ' · 第' + save.turn + '回合';
      if (save.eraName) html += ' · ' + save.eraName;
      html += '<br>';
      html += '<span style="font-size:0.6rem;">' + ink.label + ' · ' + new Date(save.timestamp).toLocaleString('zh-CN') + '</span>';
      html += '</div>';
      // 朱印
      html += '<div class="save-seal' + sealType + sealAnim + '">' + (isAuto ? '自' : '封') + '</div>';
      // 动作栏
      html += '<div class="scroll-actions">';
      html += '<button class="bt bp bsm" onclick="loadSaveSlot('+i+')">启封御览</button>';
      if (GM.running) html += '<button class="bt bs bsm" onclick="saveToSlot('+i+')">重新封缄</button>';
      html += '<button class="bt bs bsm" onclick="exportSaveSlot('+i+')">抄送副本</button>';
      if (!isAuto) html += '<button class="bt bd bsm" onclick="deleteSaveSlot('+i+')">付之丙火</button>';
      html += '</div>';
      html += '</div>';
    } else {
      // 空卷
      html += '<div class="scroll-save-card" style="--ribbon-h:0%;--ribbon-c:transparent;" onclick="event.stopPropagation();">';
      html += '<div class="scroll-empty">';
      html += '<div class="scroll-archive-id">' + archiveId + '</div>';
      html += '<div style="font-size:var(--text-sm);color:var(--color-foreground-muted);">此卷暂缺</div>';
      html += '<div class="scroll-empty-hint">轻触归档</div>';
      if (GM.running) {
        html += '<button class="bt bp bsm" style="margin-top:var(--space-2);" onclick="saveToSlot('+i+')">玉玺封卷</button>';
      }
      html += '</div></div>';
    }
  }
  html += '</div>';

  // 底部
  html += '</div>';
  html += '<div class="scroll-manager-footer">';
  if (GM.running) html += '<button class="bt bp" onclick="saveToSlot(-1)" style="padding:var(--space-2) var(--space-5);">'+_ic('prestige',16)+' 玉玺封卷（当前）</button>';
  html += '<button class="bt bs bsm" onclick="openSaveCompare()" style="padding:var(--space-2) var(--space-3);">\u2696 \u5BF9\u6BD4\u5377\u5B97</button>';
  html += '<label class="bt bs" style="cursor:pointer;padding:var(--space-2) var(--space-4);">';
  html += _ic('load',14) + ' 调入外卷';
  html += '<input type="file" id="import-save-file" accept=".json" style="display:none;">';
  html += '</label>';
  html += '<select id="import-save-slot" style="padding:var(--space-1) var(--space-2);background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:var(--radius-md);font-size:var(--text-xs);font-family:var(--font-serif);">';
  for (var j = 1; j < SaveManager.maxSlots; j++) {
    html += '<option value="'+j+'">'+(_SCROLL_NUMS[j]||'第'+j+'号')+'</option>';
  }
  html += '</select>';
  html += '<button class="bt bs bsm" onclick="importSaveFileToSlot()">归档</button>';
  html += '</div>';
  html += '</div>';

  ov.innerHTML = html;
  // 动画标记一次性，渲染后清除
  window._scrollJustSavedSlot = undefined;
}

function closeSaveManager() {
  var ov = document.getElementById('save-manager-overlay');
  if (ov) ov.remove();
}

// P12: 存档对比——选择两个存档比较关键指标
function openSaveCompare() {
  TM_SaveDB.list().then(function(dbSaves) {
    var validSaves = dbSaves.filter(function(s) { return s.id && s.turn; });
    if (validSaves.length < 2) { toast('至少需要2个存档才能对比'); return; }
    var html = '<div style="padding:1.5rem;max-width:550px;">';
    html += '<h3 style="color:var(--gold-400);margin-bottom:1rem;">\u2696 \u5377\u5B97\u5BF9\u6BD4</h3>';
    html += '<div style="display:flex;gap:1rem;margin-bottom:1rem;">';
    html += '<div style="flex:1;"><label style="font-size:0.8rem;color:var(--color-foreground-muted);">卷宗A</label><select id="cmp-a" style="width:100%;padding:0.4rem;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:4px;">';
    validSaves.forEach(function(s) { html += '<option value="' + s.id + '">' + (s.name||s.id) + ' (T' + s.turn + ')</option>'; });
    html += '</select></div>';
    html += '<div style="flex:1;"><label style="font-size:0.8rem;color:var(--color-foreground-muted);">卷宗B</label><select id="cmp-b" style="width:100%;padding:0.4rem;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:4px;">';
    validSaves.forEach(function(s, i) { html += '<option value="' + s.id + '"' + (i === 1 ? ' selected' : '') + '>' + (s.name||s.id) + ' (T' + s.turn + ')</option>'; });
    html += '</select></div></div>';
    html += '<button class="bt bp" style="width:100%;" onclick="_doSaveCompare()">开始对比</button>';
    html += '<div id="cmp-result" style="margin-top:1rem;"></div>';
    html += '</div>';
    var ov = document.createElement('div');
    ov.className = 'generic-modal-overlay';
    ov.id = 'save-compare-overlay';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div class="generic-modal" style="max-width:580px;">' + html + '</div>';
    document.body.appendChild(ov);
  }).catch(function() { toast('加载存档列表失败'); });
}

function _doSaveCompare() {
  var aId = document.getElementById('cmp-a').value;
  var bId = document.getElementById('cmp-b').value;
  if (aId === bId) { toast('请选择不同的存档'); return; }
  var result = document.getElementById('cmp-result');
  result.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);">加载中……</div>';
  Promise.all([TM_SaveDB.load(aId), TM_SaveDB.load(bId)]).then(function(pair) {
    var a = pair[0], b = pair[1];
    if (!a || !b || !a.gameState || !b.gameState) { result.innerHTML = '<div style="color:var(--vermillion-400);">存档数据不完整</div>'; return; }
    var gA = a.gameState.GM || {}, gB = b.gameState.GM || {};
    var metrics = [
      { key: 'turn', label: '回合' },
      { key: 'taxPressure', label: '税压' }
    ];
    var html = '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;">';
    html += '<tr style="border-bottom:2px solid var(--color-border);"><th style="text-align:left;padding:0.3rem;">指标</th><th>卷A</th><th>卷B</th><th>差值</th></tr>';
    metrics.forEach(function(m) {
      var vA = Math.round(gA[m.key] || 0), vB = Math.round(gB[m.key] || 0);
      var diff = vB - vA;
      var dc = diff > 0 ? 'var(--celadon-400)' : diff < 0 ? 'var(--vermillion-400)' : 'var(--color-foreground-muted)';
      html += '<tr style="border-bottom:1px solid var(--color-border-subtle);"><td style="padding:0.3rem;">' + m.label + '</td><td style="text-align:center;">' + vA + '</td><td style="text-align:center;">' + vB + '</td><td style="text-align:center;color:' + dc + ';">' + (diff > 0 ? '+' : '') + diff + '</td></tr>';
    });
    // 角色数量对比
    var charsA = (gA.chars || []).filter(function(c) { return c.alive !== false; }).length;
    var charsB = (gB.chars || []).filter(function(c) { return c.alive !== false; }).length;
    html += '<tr style="border-bottom:1px solid var(--color-border-subtle);"><td style="padding:0.3rem;">存活人物</td><td style="text-align:center;">' + charsA + '</td><td style="text-align:center;">' + charsB + '</td><td style="text-align:center;">' + (charsB - charsA > 0 ? '+' : '') + (charsB - charsA) + '</td></tr>';
    // 势力数量
    var facsA = (gA.facs || []).length, facsB = (gB.facs || []).length;
    html += '<tr><td style="padding:0.3rem;">势力数</td><td style="text-align:center;">' + facsA + '</td><td style="text-align:center;">' + facsB + '</td><td style="text-align:center;">' + (facsB - facsA > 0 ? '+' : '') + (facsB - facsA) + '</td></tr>';
    html += '</table>';
    // 朝代阶段对比
    var phaseA = (gA.eraState || {}).dynastyPhase || '?', phaseB = (gB.eraState || {}).dynastyPhase || '?';
    if (phaseA !== phaseB) {
      html += '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--gold-400);">朝代阶段：' + phaseA + ' → ' + phaseB + '</div>';
    }
    result.innerHTML = html;
  }).catch(function(err) {
    result.innerHTML = '<div style="color:var(--vermillion-400);">加载失败: ' + err.message + '</div>';
  });
}

// 宣纸风格确认框——替代 confirm()
function showScrollConfirm(opts) {
  var ov = document.createElement('div');
  ov.className = 'rice-paper-confirm';
  var boxCls = 'rice-paper-box' + (opts.danger ? ' danger' : '');
  var okCls = opts.danger ? 'bt bd' : 'bt bp';
  ov.innerHTML = '<div class="' + boxCls + '">' +
    '<div class="rice-paper-title">' + (opts.title || '请再斟酌') + '</div>' +
    '<div class="rice-paper-body">' + (opts.body || '') + '</div>' +
    '<div class="rice-paper-actions">' +
    '<button class="bt bs bsm" id="_rpc_cancel">' + (opts.cancelText || '搁置') + '</button>' +
    '<button class="' + okCls + ' bsm" id="_rpc_ok">' + (opts.okText || '确认') + '</button>' +
    '</div></div>';
  document.body.appendChild(ov);
  var cleanup = function() { ov.remove(); };
  ov.addEventListener('click', function(e) { if (e.target === ov) cleanup(); });
  ov.querySelector('#_rpc_cancel').onclick = function() { cleanup(); if (opts.onCancel) opts.onCancel(); };
  ov.querySelector('#_rpc_ok').onclick = function() { cleanup(); if (opts.onOk) opts.onOk(); };
  var escHandler = function(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); cleanup(); if (opts.onCancel) opts.onCancel(); } };
  document.addEventListener('keydown', escHandler);
  setTimeout(function() { var ok = ov.querySelector('#_rpc_ok'); if (ok) ok.focus(); }, 80);
}

// 玉玺按压动画——屏幕中央
function _playJadeSealAnimation(glyph) {
  var g = glyph || '封';
  var ov = document.createElement('div');
  ov.className = 'jade-seal-overlay';
  ov.innerHTML = '<div class="jade-seal-glyph">' + g + '</div>';
  document.body.appendChild(ov);
  setTimeout(function() { if (ov.parentNode) ov.remove(); }, 900);
}

function saveToSlot(slotId) {
  // 自动生成卷宗标题
  var defaultName = '案卷';
  if (GM.running && typeof getTSText === 'function') {
    defaultName = getTSText(GM.turn) + ' 纪要';
  }
  showPrompt('为此卷命名：', defaultName, function(saveName) {
    if (saveName) {
      // 玉玺按压动画
      _playJadeSealAnimation(slotId === 0 ? '自' : '封');
      // 延迟保存，让动画先展现
      setTimeout(function() {
        SaveManager.saveToSlot(slotId === -1 ? (function(){
          // 找最早的空槽位或最旧的手动槽位
          for (var i = 1; i < SaveManager.maxSlots; i++) {
            var key = 'slot_' + i;
            var idx = _getSaveIndex();
            if (!idx[key]) return i;
          }
          return 1;
        })() : slotId, saveName);
        toast('已载入编年');
        // 刷新时标记新卷需动画
        window._scrollJustSavedSlot = slotId === -1 ? -2 : slotId;
        closeSaveManager();
        openSaveManager();
      }, 450);
    }
  });
}

function loadSaveSlot(slotId) {
  showScrollConfirm({
    title: '启封此卷？',
    body: '一经启封，当前推演进度将被覆盖<span class="rice-paper-emphasis">（若未封存）</span>。史官将抄录副本，恭迎御览。',
    okText: '启封御览',
    onOk: function() {
      toast('史官正在抄录副本……');
      setTimeout(function() {
        SaveManager.loadFromSlot(slotId);
        closeSaveManager();
      }, 300);
    }
  });
}

function deleteSaveSlot(slotId) {
  showScrollConfirm({
    title: '将此案卷付之丙火？',
    body: '此举<span class="rice-paper-emphasis">不可逆</span>。卷成灰烬，再难追寻。',
    okText: '付之丙火',
    danger: true,
    onOk: function() {
      // 找到对应卡片播放焚毁动画
      var cards = document.querySelectorAll('.scroll-save-card');
      var target = null;
      cards.forEach(function(c) {
        var btn = c.querySelector('button[onclick*="deleteSaveSlot('+slotId+')"]');
        if (btn) target = c;
      });
      if (target) target.classList.add('burning');
      setTimeout(function() {
        SaveManager.deleteSlot(slotId);
        closeSaveManager();
        openSaveManager();
      }, 420);
    }
  });
}

function exportSaveSlot(slotId) {
  SaveManager.exportSave(slotId);
}

function importSaveFileToSlot() {
  var fileInput = document.getElementById('import-save-file');
  var slotSelect = document.getElementById('import-save-slot');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    toast('❌ 请先选择卷宗文件');
    return;
  }
  if (!slotSelect) { toast('❌ 未找到槽位选择器'); return; }

  var file = fileInput.files[0];
  var slotId = parseInt(slotSelect.value);
  if (isNaN(slotId) || slotId < 0) { toast('❌ 槽位无效'); return; }

  // 等待 Promise 完成后再刷新·避免 setTimeout 500ms 竞态·无条件 reopen 以展示结果
  var _ret = SaveManager.importSave(file, slotId);
  if (_ret && typeof _ret.then === 'function') {
    _ret.then(function(ok) {
      console.log('[importSaveFileToSlot] importSave 返回·ok=', ok);
      // 无论 ok 还是 false 都 reopen·让玩家看到最新状态
      setTimeout(function() {
        closeSaveManager();
        openSaveManager();
        if (!ok) toast('\u26A0 \u5BFC\u5165\u672A\u6210\u529F\u00B7\u8BF7\u67E5\u63A7\u5236\u53F0');
      }, 200);  // 200ms 等 IDB commit
    }).catch(function(e) {
      console.error('[importSaveFileToSlot] Promise 异常:', e);
      toast('\u274C \u5BFC\u5165\u5F02\u5E38\uFF1A' + (e.message||e));
      setTimeout(function(){ closeSaveManager(); openSaveManager(); }, 200);
    });
  } else {
    // 兜底（旧版本同步返回）
    setTimeout(function() { closeSaveManager(); openSaveManager(); }, 800);
  }
}

// ============================================================
// 教程和帮助系统
// ============================================================

var HelpSystem = {
  currentTopic: 'overview',

  topics: {
    overview: {
      title: '📖 游戏概览',
      content: `
        <h4>欢迎来到天命游戏</h4>
        <p>这是一款基于AI的历史模拟游戏，你将扮演历史人物，通过发布政令、处理奏疏、管理官制等方式影响历史进程。</p>

        <h4>核心特色</h4>
        <ul>
          <li><strong>AI驱动</strong>：使用大语言模型推演历史事件和角色行为</li>
          <li><strong>高度自由</strong>：不受固定剧本束缚，AI会根据你的决策动态推演</li>
          <li><strong>跨朝代</strong>：支持秦汉、唐宋、明清等多个历史时期</li>
          <li><strong>深度系统</strong>：包含官制、军制、经济、外交、继承等完整系统</li>
        </ul>

        <h4>游戏模式</h4>
        <ul>
          <li><strong>严格史实</strong>：严格遵守历史，不得改变历史走向</li>
          <li><strong>轻度史实</strong>：大事件遵循历史，细节可演绎</li>
          <li><strong>演义模式</strong>：AI自由发挥，情节更富戏剧性</li>
        </ul>
      `
    },

    gameplay: {
      title: '🎮 游戏玩法',
      content: `
        <h4>回合流程</h4>
        <ol>
          <li><strong>查看奏疏</strong>：处理NPC提交的各类奏疏（任命、请求、建议等）</li>
          <li><strong>发布政令</strong>：在政治、军事、外交、经济等领域发布指令</li>
          <li><strong>记录行录</strong>：记录本回合的重要活动和决策</li>
          <li><strong>结束回合</strong>：AI推演事件，更新游戏状态</li>
        </ol>

        <h4>政令系统</h4>
        <p>你可以在五个领域发布政令：</p>
        <ul>
          <li><strong>政治</strong>：改革制度、任命官员、颁布法令</li>
          <li><strong>军事</strong>：调动军队、发动战争、防御边境</li>
          <li><strong>外交</strong>：结盟、和亲、朝贡、宣战</li>
          <li><strong>经济</strong>：调整税收、发展产业、赈济灾民</li>
          <li><strong>其他</strong>：文化、宗教、科技等</li>
        </ul>

        <h4>奏疏处理</h4>
        <p>NPC会提交各类奏疏，你需要批复：</p>
        <ul>
          <li><strong>任命请求</strong>：批准或拒绝官职任命</li>
          <li><strong>资源请求</strong>：决定是否拨付资源</li>
          <li><strong>政策建议</strong>：采纳或驳回政策建议</li>
          <li><strong>军事行动</strong>：批准或否决军事计划</li>
        </ul>
      `
    },

    systems: {
      title: '⚙️ 游戏系统',
      content: `
        <h4>官制系统</h4>
        <p>管理朝廷官职结构，包括：</p>
        <ul>
          <li>官职树：层级化的官职结构</li>
          <li>任命权：不同官职的任命权限</li>
          <li>俸禄：官员的薪资和待遇</li>
          <li>考课：定期评估官员表现</li>
        </ul>

        <h4>经济系统</h4>
        <ul>
          <li><strong>集权度</strong>：影响地方向中央的贡奉比例</li>
          <li><strong>贡奉</strong>：地方定期向中央上缴财政</li>
          <li><strong>回拨</strong>：中央按比例回拨给地方</li>
          <li><strong>地方区划</strong>：查看各省经济详情</li>
        </ul>

        <h4>继承系统</h4>
        <ul>
          <li><strong>宗法继承</strong>：嫡长子继承制</li>
          <li><strong>流官制</strong>：官职不可继承</li>
          <li><strong>AI推演</strong>：根据时代背景推荐继承人</li>
        </ul>

        <h4>时代状态</h4>
        <p>11个维度动态追踪历史时期：</p>
        <ul>
          <li>政治统一度、中央集权度</li>
          <li>社会稳定度、经济繁荣度</li>
          <li>文化活力、官僚体系强度</li>
          <li>军队职业化程度等</li>
        </ul>

        <h4>NPC行为</h4>
        <p>AI驱动的NPC会根据性格、忠诚度、野心等属性做出决策：</p>
        <ul>
          <li>政治行为：结盟、背叛、弹劾</li>
          <li>军事行为：叛乱、扩张、招募</li>
          <li>经济行为：贪污、请求资源</li>
          <li>社会行为：赈济、镇压</li>
        </ul>
      `
    },

    interface: {
      title: '🖥️ 界面说明',
      content: `
        <h4>主界面布局</h4>
        <ul>
          <li><strong>左侧面板</strong>：显示回合信息、资源状态、关系值</li>
          <li><strong>中央区域</strong>：主要内容区，显示奏疏、政令、事件等</li>
          <li><strong>右侧面板</strong>：显示角色信息、势力信息等</li>
          <li><strong>顶部菜单</strong>：史记、存档、设置等功能</li>
        </ul>

        <h4>快捷按钮</h4>
        <ul>
          <li><strong>\u5929\u4E0B\u5927\u52BF</strong>\uFF1A\u67E5\u770B\u65F6\u4EE3\u8D8B\u52BF\u56FE\u548C\u5386\u53F2\u5927\u4E8B\u4EF6</li>
          <li><strong>🏆 成就</strong>：查看已解锁的成就</li>
          <li><strong>⚡ AI性能</strong>：查看AI推演性能统计</li>
          <li><strong>❓ 帮助</strong>：打开本帮助系统</li>
        </ul>

        <h4>顶部菜单</h4>
        <ul>
          <li><strong>📜 史记</strong>：查看历史记录和回合推演</li>
          <li><strong>💾 存档</strong>：保存和加载游戏</li>
        </ul>
      `
    },

    tips: {
      title: '💡 游戏技巧',
      content: `
        <h4>新手建议</h4>
        <ul>
          <li>先熟悉界面和基本操作，不要急于发布复杂政令</li>
          <li>注意观察资源变化，避免财政或粮食短缺</li>
          <li>及时处理奏疏，维护与NPC的关系</li>
          <li>\u5B9A\u671F\u67E5\u770B\u5929\u4E0B\u5927\u52BF\u548C\u5730\u65B9\u533A\u5212</li>
          <li>善用存档功能，尝试不同的决策路线</li>
        </ul>

        <h4>进阶技巧</h4>
        <ul>
          <li><strong>平衡集权</strong>：过高或过低的集权度都有风险</li>
          <li><strong>培养继承人</strong>：提前安排继承，避免权力真空</li>
          <li><strong>管理关系</strong>：维护与重要NPC的关系，防止叛乱</li>
          <li><strong>适应时代</strong>：根据时代状态调整策略</li>
          <li><strong>利用AI</strong>：善用AI推演，了解决策的可能后果</li>
        </ul>

        <h4>常见问题</h4>
        <ul>
          <li><strong>Q: 为什么AI推演很慢？</strong><br>A: 检查网络连接和API配置，可以在AI性能面板查看统计</li>
          <li><strong>Q: 如何提高缓存命中率？</strong><br>A: 保持角色状态相对稳定，避免频繁大幅度变化</li>
          <li><strong>Q: 存档在哪里？</strong><br>A: 存档保存在浏览器本地存储，可以导出为文件备份</li>
          <li><strong>Q: 如何切换朝代？</strong><br>A: 在编辑器中创建新剧本，选择不同的朝代模板</li>
        </ul>
      `
    },

    shortcuts: {
      title: '⌨️ 快捷键',
      content: `
        <h4>常用快捷键</h4>
        <ul>
          <li><strong>Enter</strong>：结束回合（在主界面）</li>
          <li><strong>Esc</strong>：关闭当前弹窗</li>
          <li><strong>Ctrl+S</strong>：快速保存</li>
        </ul>

        <p style="color:var(--txt-s);margin-top:1rem;">注：部分快捷键可能与浏览器冲突</p>
      `
    },

    edictQA: {
      title: '📜 诏书问对',
      content: `
        <h4>六类诏书通则</h4>
        <p>制度级诏书由 AI 自动识别分类，按完整度/紧急度/重要度三维度判定路径：</p>
        <ul>
          <li><strong>直断</strong>：诏书详尽或事急 → AI 即时推演</li>
          <li><strong>复奏</strong>：意图明确细节不足 → 大臣拟奏疏供朱批</li>
          <li><strong>追问</strong>：意图模糊 → 侍臣问疑</li>
        </ul>

        <h4>Ⅰ 货币改革</h4>
        <p>铸币、改制、发钞、废钞皆走此。必含<b>币种/重量/成色/官铸机构</b>四要素。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 铸五铢钱，重五铢，上林三官造<br>
          · 发交子于蜀，十年一界，准备金足<br>
          · 减铸小钱当千，以纾军用<br>
          · 废宝钞，改行白银
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：成色低则民弃之，私铸兴。发钞无准备金必崩。</p>

        <h4>Ⅱ 税种设立</h4>
        <p>新税种须含：<b>税基（田/丁/商/关）+ 税率 + 豁免对象</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立算赋，每丁岁一百二十钱<br>
          · 置商税，百抽三，商户登记<br>
          · 开市舶司，海商百抽十<br>
          · 行两税法，夏秋两征
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：过高赋役 → 逃户 → 税基流失。一条鞭法折银改革为典范。</p>

        <h4>Ⅲ 户籍制度</h4>
        <p>编户、黄册、保甲、色目皆此类。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 编户齐民，什伍连坐<br>
          · 造黄册，十年一大造<br>
          · 推行保甲，十户一牌<br>
          · 摊丁入亩，永不加赋
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：清查频率影响税基透明度。重造黄册费钱但扫隐户。</p>

        <h4>Ⅳ 徭役改革</h4>
        <p>三路径：<b>均役（分摊）/折银（雇佣代役）/摊入田赋</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立均徭，丁岁三十日<br>
          · 行一条鞭法，役银合一<br>
          · 摊丁入亩，役尽归田
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：大徭役死亡率 &gt; 30% 必民变。折银仅宜商贸发达地。</p>

        <h4>Ⅴ 兵制改革</h4>
        <p>七类兵制各有条件：<b>府兵需均田、募兵需军饷、卫所需世袭军户</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立府兵，府兵轮番宿卫<br>
          · 行募兵制，月饷二两<br>
          · 建卫所，军户世袭<br>
          · 立团练，绅士领兵
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：马政决定骑兵上限。兵权旁落 → 藩镇自立。</p>

        <h4>Ⅵ 官制设立</h4>
        <p>新设机构须含：<b>名称/品级/职事/员额/上司</b>。</p>
        <div style="background:var(--bg-2);padding:6px 10px;border-left:3px solid var(--gold-500);margin:4px 0;">
          · 立三省六部<br>
          · 置节度使<br>
          · 设内阁大学士<br>
          · 置总督巡抚
        </div>
        <p style="color:var(--celadon-300);font-style:italic;">要旨：同职位多则政出多门。冗官冗费 → 帑廪压力。</p>

        <h4>30 条历代典范诏书（示例）</h4>
        <div style="font-size:0.78rem;line-height:1.9;background:var(--bg-2);padding:8px 12px;border-radius:4px;max-height:280px;overflow-y:auto;">
          · [秦] 统一币制，废六国异币，铸圆方孔半两<br>
          · [汉] 铸五铢钱，禁郡国铸<br>
          · [唐] 废五铢，立开元通宝<br>
          · [宋] 发交子于蜀<br>
          · [明] 发大明宝钞<br>
          · [汉] 立算赋，每人每年一百二十钱<br>
          · [唐] 租庸调：丁岁粟二石、绢二丈、役二十日<br>
          · [唐] 行两税法，夏秋两征<br>
          · [明] 一条鞭法：赋役合一折银<br>
          · [秦] 编户齐民，什伍连坐<br>
          · [明] 造黄册，十年一大造<br>
          · [清] 推行保甲，十户一牌，十牌一甲<br>
          · [清] 摊丁入亩，永不加赋<br>
          · [秦] 立更役，丁岁一月<br>
          · [唐] 庸役折绢，岁二丈<br>
          · [明] 均徭，按丁田轮派<br>
          · [清] 火耗归公，养廉银制<br>
          · [唐] 立府兵，府兵轮番宿卫<br>
          · [宋] 行募兵制<br>
          · [明] 立卫所，军户世袭<br>
          · [清] 立八旗，兵民合一<br>
          · [清] 湘军淮军，团练练勇<br>
          · [秦] 立三公九卿<br>
          · [汉] 立刺史部十三州<br>
          · [唐] 立三省六部<br>
          · [宋] 立中书门下政事堂<br>
          · [明] 立内阁大学士
        </div>

        <h4>抗疏机制</h4>
        <p>重大制度诏书可能触发清流大臣抗疏。玩家有五种处理：<b>纳谏/斥之/下狱/诛/贬</b>。</p>
        <p style="color:var(--celadon-300);font-style:italic;">历史典范：魏征谏十思、包拯弹亲贵、海瑞直言天子失德、杨涟弹劾魏忠贤。</p>
      `
    },

    // ═══════════════════════════════════════════════════════════════
    //  历代典范（只读参考，不是游戏内选项）
    // ═══════════════════════════════════════════════════════════════
    classics: {
      title: '📚 历代典范参考',
      dynamicRender: true,  // 渲染时动态从 HistoricalPresets 读取
      content: '' // 占位，renderHelp 时动态填充
    }
  }
};

/**
 * 动态渲染"历代典范"帮助页 —— 从 HistoricalPresets 读取最新数据
 * （支持剧本 customPresets 覆盖）
 */
function _buildClassicsHelpContent() {
  var HP = window.HistoricalPresets;
  if (!HP) return '<p style="color:var(--vermillion-400);">历史预设库未加载</p>';

  function _esc(s){return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  var html = '<p style="color:var(--celadon-300);font-style:italic;">以下内容仅供参考——这些是历代典型案例，玩家推演时并不受其约束，AI 只要合理可产出任何架空策略。</p>';

  // 大徭役
  try {
    var corvee = typeof HP.getGreatCorveeProjects === 'function' ? HP.getGreatCorveeProjects() : (HP.GREAT_CORVEE_PROJECTS||[]);
    if (corvee.length) {
      html += '<h4>📜 历代大徭役（' + corvee.length + ' 条）</h4><div style="max-height:280px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      corvee.forEach(function(p){
        html += '· <b>[' + _esc(p.dynasty||'') + (p.year?' '+p.year:'') + ']</b> ' + _esc(p.name||p.id) + '：丁 ' + (p.labor||p.dingMobilized||'?') + ' · 殁 ' + Math.round((p.deathRate||p.mortalityRate||0)*100) + '%' + (p.notes?' · ' + _esc(p.notes):'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 迁徙
  try {
    var mig = typeof HP.getMigrationEventsDetail === 'function' ? HP.getMigrationEventsDetail() : (HP.MIGRATION_EVENTS_DETAIL||[]);
    if (mig.length) {
      html += '<h4>🗺 历代大迁徙（' + mig.length + ' 条）</h4><div style="max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      mig.forEach(function(p){
        html += '· <b>[' + (p.year||'?') + ']</b> ' + _esc(p.name) + '：' + (p.scale?Math.round(p.scale/10000)+'万口':'') + ' · ' + _esc((p.from||[]).join('/')||'?') + ' → ' + _esc((p.to||[]).join('/')||'?') + (p.culturalShift?'（' + _esc(p.culturalShift) + '）':'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 兵制
  try {
    var mil = typeof HP.getMilitarySystemsDetail === 'function' ? HP.getMilitarySystemsDetail() : (HP.MILITARY_SYSTEMS_DETAIL||{});
    var mKeys = Object.keys(mil);
    if (mKeys.length) {
      html += '<h4>⚔ 历代兵制（' + mKeys.length + ' 种）</h4><div style="max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      mKeys.forEach(function(k){
        var s = mil[k];
        html += '· <b>' + _esc(s.name||k) + '</b>（' + _esc(s.dynasty||'') + '·' + _esc(s.era||'') + '）：兵 ' + (s.totalStrength||'?') + (s.collapse?' · 衰于' + _esc(s.collapse):'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 30 典范诏
  try {
    var EP = window.EdictParser;
    var eds = EP && (typeof EP.getHistoricalEdictPresets === 'function' ? EP.getHistoricalEdictPresets() : (EP.HISTORICAL_EDICT_PRESETS||[]));
    if (eds && eds.length) {
      html += '<h4>📜 历代典范诏（' + eds.length + ' 条）</h4><div style="max-height:280px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      eds.forEach(function(p){
        html += '· <b>[' + _esc(p.dynasty||'') + ']</b> ' + _esc(p.text||'') + ' <span style="color:var(--txt-d);">(' + _esc(p.type||'') + ')</span><br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  // 制度模板
  try {
    var inst = typeof HP.getInstitutionTemplates === 'function' ? HP.getInstitutionTemplates() : (HP.INSTITUTION_TEMPLATES||{});
    var iKeys = Object.keys(inst);
    if (iKeys.length) {
      html += '<h4>🏛 历代制度模板（' + iKeys.length + ' 种）</h4><div style="max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-2);border-radius:4px;font-size:0.78rem;line-height:1.7;">';
      iKeys.forEach(function(k){
        var it = inst[k];
        html += '· <b>' + _esc(it.name||k) + '</b>' + (it.category?'（' + _esc(it.category) + '）':'') + (it.notes?'：' + _esc(it.notes):'') + '<br>';
      });
      html += '</div>';
    }
  } catch(_e){}

  html += '<p style="color:var(--gold);font-size:0.78rem;margin-top:12px;">这些条目本游戏 <b>不</b> 作为运行时触发规则。AI 推演时可能会参考也可能完全不参考——由局面和 AI 自由决定。若你写架空诏令（如"造纸币失败则发行国债"），AI 也会推演而非拒绝。</p>';

  return html;
}

// 打开帮助界面
function openHelp(topic) {
  var currentTopic = topic || HelpSystem.currentTopic;

  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'help-overlay';

  var html = '<div class="generic-modal" style="max-width:800px;max-height:85vh;display:flex;flex-direction:row;">';

  // 左侧导航
  html += '<div style="width:200px;border-right:1px solid var(--bg-3);padding:1rem;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin-bottom:1rem;">帮助主题</h3>';

  Object.keys(HelpSystem.topics).forEach(function(key) {
    var t = HelpSystem.topics[key];
    var isActive = key === currentTopic;
    html += '<div onclick="switchHelpTopic(\'' + key + '\')" style="';
    html += 'padding:0.6rem;margin-bottom:0.3rem;cursor:pointer;border-radius:4px;';
    html += 'background:' + (isActive ? 'var(--bg-3)' : 'transparent') + ';';
    html += 'color:' + (isActive ? 'var(--gold)' : 'var(--txt)') + ';';
    html += 'font-size:0.9rem;';
    html += '">';
    html += t.title;
    html += '</div>';
  });

  html += '</div>';

  // 右侧内容
  html += '<div style="flex:1;display:flex;flex-direction:column;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>' + HelpSystem.topics[currentTopic].title + '</h3>';
  html += '<button onclick="closeHelp()">✕</button>';
  html += '</div>';
  html += '<div class="generic-modal-body" style="flex:1;overflow-y:auto;">';
  html += '<div style="line-height:1.8;font-size:0.9rem;">';
  var _topicEntry = HelpSystem.topics[currentTopic];
  if (_topicEntry && _topicEntry.dynamicRender && currentTopic === 'classics' && typeof _buildClassicsHelpContent === 'function') {
    html += _buildClassicsHelpContent();
  } else {
    html += _topicEntry ? _topicEntry.content : '';
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);

  HelpSystem.currentTopic = currentTopic;
}

function closeHelp() {
  var ov = document.getElementById('help-overlay');
  if (ov) ov.remove();
}

function switchHelpTopic(topic) {
  closeHelp();
  openHelp(topic);
}

// AI 推演缓存系统
var AICache = {
  cache: new Map(),
  maxSize: 100,
  ttl: 5, // 缓存有效期（回合数）

  // 统计信息
  stats: {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    totalTime: 0,
    avgTime: 0
  },

  // 生成缓存键
  generateKey: function(npc, context) {
    var key = npc.name + '_' +
              (npc.loyalty || 50) + '_' +
              (npc.ambition || 50) + '_' +
              (context.eraState ? context.eraState.centralControl : 0.5) + '_' +
              (context.eraState ? context.eraState.socialStability : 0.5);
    return key;
  },

  // 获取缓存
  get: function(npc, context) {
    var key = this.generateKey(npc, context);
    var cached = this.cache.get(key);

    if (cached && (GM.turn - cached.turn) <= this.ttl) {
      return cached.data;
    }

    return null;
  },

  // 设置缓存
  set: function(npc, context, data) {
    var key = this.generateKey(npc, context);

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      var oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: data,
      turn: GM.turn
    });
  },

  // 清空缓存
  clear: function() {
    this.cache.clear();
  },

  // 清理过期缓存
  cleanup: function() {
    var keysToDelete = [];
    this.cache.forEach(function(value, key) {
      if ((GM.turn - value.turn) > AICache.ttl) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(function(key) {
      AICache.cache.delete(key);
    });
  },

  // 重置统计
  resetStats: function() {
    this.stats = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTime: 0,
      avgTime: 0
    };
  }
};

// 初始化 AI 缓存系统
function initAICache() {
  AICache.clear();
  AICache.resetStats();
  _dbg('AI 缓存系统已初始化');
}

// AI 批处理队列
var AIBatchQueue = {
  queue: [],
  processing: false,
  batchSize: 5, // 每批处理的 NPC 数量
  delay: 1000, // 批次间延迟（毫秒）

  // 添加到队列
  add: function(npc, context, callback) {
    this.queue.push({
      npc: npc,
      context: context,
      callback: callback
    });
  },

  // 处理队列
  process: async function() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      // 取出一批任务
      var batch = this.queue.splice(0, this.batchSize);

      // 并行处理这一批
      var promises = batch.map(function(item) {
        return processNPCWithCache(item.npc, item.context).then(function(result) {
          if (item.callback) {
            item.callback(result);
          }
          return result;
        });
      });

      await Promise.all(promises);

      // 批次间延迟
      if (this.queue.length > 0) {
        await new Promise(function(resolve) {
          setTimeout(resolve, AIBatchQueue.delay);
        });
      }
    }

    this.processing = false;
  },

  // 清空队列
  clear: function() {
    this.queue = [];
    this.processing = false;
  }
};

// 使用缓存处理 NPC 行为
async function processNPCWithCache(npc, context) {
  // 1. 检查缓存
  var cached = AICache.get(npc, context);
  if (cached) {
    return cached;
  }

  // 2. 调用 AI 推演
  var result = await executeNpcBehavior(npc, context);

  // 3. 存入缓存
  if (result) {
    AICache.set(npc, context, result);
  }

  return result;
}

// 批量处理 NPC 行为（优化版）
async function batchProcessNPCs(npcs, context) {
  var results = [];

  // 将所有 NPC 添加到批处理队列
  npcs.forEach(function(npc) {
    AIBatchQueue.add(npc, context, function(result) {
      if (result) {
        results.push({npc: npc, behavior: result});
      }
    });
  });

  // 处理队列
  await AIBatchQueue.process();

  return results;
}

// 性能监控
var AIPerformanceMonitor = {
  stats: {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalTime: 0,
    avgTime: 0
  },

  // 记录调用
  recordCall: function(isCacheHit, duration) {
    this.stats.totalCalls++;
    if (isCacheHit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
    this.stats.totalTime += duration;
    this.stats.avgTime = this.stats.totalTime / this.stats.totalCalls;
  },

  // 获取统计信息
  getStats: function() {
    var hitRate = this.stats.totalCalls > 0 ?
                  (this.stats.cacheHits / this.stats.totalCalls * 100).toFixed(1) : 0;
    return {
      totalCalls: this.stats.totalCalls,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: hitRate + '%',
      avgTime: this.stats.avgTime.toFixed(2) + 'ms'
    };
  },

  // 重置统计
  reset: function() {
    this.stats = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTime: 0,
      avgTime: 0
    };
  }
};

// 触发历史事件
function triggerHistoricalEvent(eventType, description) {
  if (!GM.historicalEvents) {
    GM.historicalEvents = [];
  }

  // 检查是否已触发过相同事件（避免重复）
  var recentEvent = GM.historicalEvents.find(function(e) {
    return e.type === eventType && (GM.turn - e.turn) < 10;
  });

  if (recentEvent) return; // 10 回合内不重复触发

  var event = {
    id: uid(),
    type: eventType,
    description: description,
    turn: GM.turn,
    date: GM.date,
    effects: []
  };

  // 根据事件类型添加效果
  switch(eventType) {
    case 'economic_crisis':
      var _crisisEco = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
      var _crisisMor = typeof _findVarByType === 'function' ? _findVarByType('morale') : null;
      if (_crisisEco) { event.effects.push(_crisisEco + ' -500'); GM.vars[_crisisEco].value = Math.max(GM.vars[_crisisEco].min, GM.vars[_crisisEco].value - 500); }
      if (_crisisMor) { event.effects.push(_crisisMor + ' -10'); GM.vars[_crisisMor].value = Math.max(GM.vars[_crisisMor].min, GM.vars[_crisisMor].value - 10); }
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 10);
      break;
    case 'civil_unrest':
      event.effects.push('民心 -15');
      event.effects.push('社会稳定度 -0.05');
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 15);
      if (GM.eraState) GM.eraState.socialStability = Math.max(0, GM.eraState.socialStability - 0.05);
      break;
    case 'political_fragmentation':
      event.effects.push('中央集权度 -0.05');
      event.effects.push('政治统一度 -0.05');
      if (GM.eraState) {
        GM.eraState.centralControl = Math.max(0, GM.eraState.centralControl - 0.05);
        GM.eraState.politicalUnity = Math.max(0, GM.eraState.politicalUnity - 0.05);
      }
      break;
    case 'power_decentralization':
      event.effects.push('中央集权度 -0.1');
      if (GM.eraState) GM.eraState.centralControl = Math.max(0, GM.eraState.centralControl - 0.1);
      break;
    case 'golden_age':
      event.effects.push('所有资源 +10%');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.min(GM.vars[key].max, Math.floor(GM.vars[key].value * 1.1));
      });
      break;
    case 'decline_begins':
      event.effects.push('所有资源 -5%');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.max(GM.vars[key].min || 0, Math.floor(GM.vars[key].value * 0.95));
      });
      break;
    case 'dynasty_collapse':
      event.effects.push('所有资源 -20%');
      event.effects.push('民心 -30');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.max(GM.vars[key].min || 0, Math.floor(GM.vars[key].value * 0.8));
      });
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 30);
      break;
    case 'revival':
      event.effects.push('所有资源 +15%');
      event.effects.push('民心 +20');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.min(GM.vars[key].max, Math.floor(GM.vars[key].value * 1.15));
      });
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.min(GM.vars[__mk].max||100, GM.vars[__mk].value + 20);
      break;
    case 'total_crisis':
      event.effects.push('所有资源 -30%');
      event.effects.push('民心 -40');
      Object.keys(GM.vars).forEach(function(key) {
        GM.vars[key].value = Math.max(GM.vars[key].min || 0, Math.floor(GM.vars[key].value * 0.7));
      });
      var __mk=typeof _findVarByType==='function'?_findVarByType('morale'):null;if(__mk&&GM.vars[__mk]) GM.vars[__mk].value = Math.max(GM.vars[__mk].min||0, GM.vars[__mk].value - 40);
      break;
  }

  GM.historicalEvents.push(event);
  addEB('历史事件', description + '（效果：' + event.effects.join('、') + '）');
}

// ============================================================
// 亲疏关系网（横向人际关系，区别于纵向忠诚）
// 每对角色间有独立的亲疏值（-100 到 +100）
// NPC 之间也有关系，不以玩家为中心
// ============================================================
var AffinityMap = {
  /** 获取两人之间的亲疏值 */
  get: function(nameA, nameB) {
    if (!GM.affinityMap || !nameA || !nameB) return 0;
    var key = [nameA, nameB].sort().join('|');
    return GM.affinityMap[key] || 0;
  },

  /** 设置两人之间的亲疏值 */
  set: function(nameA, nameB, value) {
    if (!nameA || !nameB) return;
    if (!GM.affinityMap) GM.affinityMap = {};
    var key = [nameA, nameB].sort().join('|');
    GM.affinityMap[key] = clamp(value, -100, 100);
  },

  /** 增减亲疏值 */
  add: function(nameA, nameB, delta, reason) {
    var cur = AffinityMap.get(nameA, nameB);
    AffinityMap.set(nameA, nameB, cur + delta);
    _dbg('[Affinity] ' + nameA + '↔' + nameB + ': ' + (delta>0?'+':'') + delta + ' → ' + AffinityMap.get(nameA, nameB) + (reason ? ' (' + reason + ')' : ''));
  },

  /** 获取某角色的所有关系（按绝对值排序） */
  getRelations: function(name) {
    if (!GM.affinityMap || !name) return [];
    var results = [];
    Object.keys(GM.affinityMap).forEach(function(key) {
      var parts = key.split('|');
      if (parts[0] === name || parts[1] === name) {
        var other = parts[0] === name ? parts[1] : parts[0];
        results.push({ name: other, value: GM.affinityMap[key] });
      }
    });
    results.sort(function(a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    return results;
  },

  /** 获取所有显著关系（|value| >= threshold）供 AI 上下文 */
  getSignificantRelations: function(threshold) {
    if (!GM.affinityMap) return [];
    threshold = threshold || 20;
    var results = [];
    Object.keys(GM.affinityMap).forEach(function(key) {
      var v = GM.affinityMap[key];
      if (Math.abs(v) >= threshold) {
        var parts = key.split('|');
        results.push({ a: parts[0], b: parts[1], value: v });
      }
    });
    results.sort(function(a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    return results;
  },

  /** 月度亲疏自然衰减（极端关系缓慢趋向中性） */
  monthlyDecay: function() {
    if (!GM.affinityMap) return;
    Object.keys(GM.affinityMap).forEach(function(key) {
      var v = GM.affinityMap[key];
      if (v > 0) GM.affinityMap[key] = Math.max(0, v - 1);
      else if (v < 0) GM.affinityMap[key] = Math.min(0, v + 1);
      if (GM.affinityMap[key] === 0) delete GM.affinityMap[key];
    });
  }
};

SettlementPipeline.register('affinityDecay', '亲疏衰减', function() { AffinityMap.monthlyDecay(); }, 23, 'monthly');

// ============================================================
// 双轨好感系统（借鉴晚唐风云 dual-track opinion）
// 好感 = 基础好感(计算型，实时) + 事件好感(衰减型，积累)
// ============================================================
/**
 * 双轨好感系统
 * @namespace
 * @property {function(Object, Object):number} calculateBase - 基础好感
 * @property {function(string, string, number, string):void} addEventOpinion - 事件好感
 * @property {function(Object, Object):number} getTotal - 总好感
 * @property {function():void} decayAll - 月度衰减
 */
var OpinionSystem = {
  /**
   * 计算两个角色间的基础好感（实时计算，不存储）
   * 考虑：同势力/同党派/品级差/性格相似度
   */
  calculateBase: function(charA, charB) {
    if (!charA || !charB) return 0;
    var score = 0;
    // 同势力 +15
    if (charA.faction && charA.faction === charB.faction) score += 15;
    // 同党派 +10
    if (charA.party && charA.party === charB.party) score += 10;
    // 上下级关系 +5
    if (charA.superior === charB.name || charB.superior === charA.name) score += 5;
    // 忠诚度影响（对君主/上级，不硬编码头衔）
    if (charB.isPlayer || charB.isRuler || (charB.rankLevel && charB.rankLevel >= 28)) {
      score += Math.round((charA.loyalty - 50) * 0.3);
    }
    // 特质匹配（CK3式：同特质加分，对立特质减分）
    if (charA.traitIds && charB.traitIds && P.traitDefinitions) {
      var traitMap = {};
      P.traitDefinitions.forEach(function(t) { traitMap[t.id] = t; });
      charA.traitIds.forEach(function(aId) {
        var aDef = traitMap[aId];
        if (!aDef) return;
        charB.traitIds.forEach(function(bId) {
          if (aId === bId) {
            // 同特质好感
            score += aDef.opinionSame || 10;
          } else if (aDef.opposite === bId) {
            // 对立特质减分
            score += aDef.opinionOpposite || -10;
          }
        });
      });
    } else if (charA.personality && charB.personality) {
      // 回退：旧式文本匹配
      var simWords = 0;
      var aWords = charA.personality.split(/[,，、\s]+/);
      var bWords = charB.personality.split(/[,，、\s]+/);
      aWords.forEach(function(w) { if (bWords.indexOf(w) >= 0) simWords++; });
      score += simWords * 5;
    }
    // 正统性差值影响（接入 LegitimacySystem）
    if (typeof LegitimacySystem !== 'undefined' && LegitimacySystem.calcGapOpinion && charA.legitimacy && charB.legitimacy) {
      var expected = (typeof LegitimacySystem.getRankCap === 'function' && charB.rankLevel) ? LegitimacySystem.getRankCap(charB.rankLevel) : 50;
      score += LegitimacySystem.calcGapOpinion(charB.legitimacy, expected);
    }
    return clamp(score, -100, 100);
  },

  /**
   * 添加事件好感（带衰减，存入角色数据）
   * @param {string} charName - 目标角色名
   * @param {string} fromName - 来源角色名
   * @param {number} value - 好感变化（正/负）
   * @param {string} reason - 原因描述
   */
  addEventOpinion: function(charName, fromName, value, reason) {
    var char = findCharByName(charName);
    if (!char) return;
    if (!char._eventOpinions) char._eventOpinions = [];
    char._eventOpinions.push({
      from: fromName,
      value: value,
      reason: reason || '',
      turn: GM.turn
    });
    _dbg('[Opinion] ' + fromName + '→' + charName + ': ' + (value>0?'+':'') + value + ' (' + reason + ')');
  },

  /**
   * 获取总好感 = 基础 + 事件累积
   */
  getTotal: function(charA, charB) {
    // 防御：任一方为 undefined 直接返回 0（findCharByName 可能找不到已死/不存在的角色）
    if (!charA || !charB || !charA.name || !charB.name) return 0;
    var base = OpinionSystem.calculateBase(charA, charB);
    var eventSum = 0;
    if (charA._eventOpinions) {
      charA._eventOpinions.forEach(function(op) {
        if (op.from === charB.name) eventSum += op.value;
      });
    }
    // 加入亲疏关系网数据
    var affinity = (typeof AffinityMap !== 'undefined') ? AffinityMap.get(charA.name, charB.name) : 0;
    // 加入恩怨系统修正
    var enYuanMod = (typeof EnYuanSystem !== 'undefined') ? EnYuanSystem.getModifier(charA.name, charB.name) : 0;
    // 加入门生网络修正
    var patronMod = (typeof PatronNetwork !== 'undefined') ? PatronNetwork.getOpinionModifier(charA.name, charB.name) : 0;
    return clamp(base + eventSum + affinity + enYuanMod + patronMod, -100, 100);
  },

  /**
   * 月度衰减：事件好感每回合衰减 1 点趋向 0
   */
  decayAll: function() {
    if (!GM.chars) return;
    var _ms = _getDaysPerTurn() / 30; // 月比例
    GM.chars.forEach(function(char) {
      if (!char._eventOpinions) return;
      char._eventOpinions = char._eventOpinions.filter(function(op) {
        var d = 1 * _ms; // 月基准衰减1点
        if (op.value > 0) { op.value = Math.max(0, op.value - d); }
        else if (op.value < 0) { op.value = Math.min(0, op.value + d); }
        return Math.abs(op.value) >= 0.5; // 移除近零的
      });
    });
  },

  /** 导出所有角色的事件观感（存档用） */
  getAllEventOpinions: function() {
    var result = {};
    if (!GM.chars) return result;
    GM.chars.forEach(function(c) {
      if (c._eventOpinions && c._eventOpinions.length > 0) {
        result[c.name] = c._eventOpinions.slice();
      }
    });
    return result;
  },

  /** 恢复角色事件观感（读档用） */
  restoreEventOpinions: function(data) {
    if (!data || !GM.chars) return;
    GM.chars.forEach(function(c) {
      if (data[c.name]) c._eventOpinions = data[c.name];
    });
  }
};

// ============================================================
// 存档版本迁移系统（借鉴晚唐风云 migrations.ts）
// 存档带版本号，加载时自动运行迁移函数链升级旧存档
// ============================================================
/** @type {number} 当前存档版本号 */
var SAVE_VERSION = 5; // v5: 融合补强（NPC事件队列/区划深化/官职深化公库绑定/集成桥梁）

var SaveMigrations = {
  migrations: [
    // v1 → v2: 添加 triggeredOffendEvents、_rngState 等新字段
    {
      from: 1, to: 2,
      migrate: function(data) {
        var gm = data.gameState;
        if (!gm) return data;
        if (!gm.triggeredOffendEvents) gm.triggeredOffendEvents = {};
        if (!gm.eraStateHistory) gm.eraStateHistory = [];
        if (gm.taxPressure === undefined) gm.taxPressure = 50;
        _dbg('[SaveMigration] v1 → v2: 补充新字段');
        return data;
      }
    },
    // v2 → v3: 全面升级Phase A-F新增字段
    {
      from: 2, to: 3,
      migrate: function(data) {
        var gm = data.gameState || data;
        if (!gm) return data;
        // Phase A: 战斗/行军/围城
        if (!gm.activeBattles) gm.activeBattles = [];
        if (!gm.battleHistory) gm.battleHistory = [];
        if (!gm.activeWars) gm.activeWars = [];
        if (!gm.treaties) gm.treaties = [];
        if (!gm.marchOrders) gm.marchOrders = [];
        if (!gm.activeSieges) gm.activeSieges = [];
        if (!gm._rngCheckpoints) gm._rngCheckpoints = [];
        // Phase B: 双层国库
        if (gm.stateTreasury === undefined) gm.stateTreasury = 0;
        if (gm.privateTreasury === undefined) gm.privateTreasury = 0;
        if (gm._bankruptcyTurns === undefined) gm._bankruptcyTurns = 0;
        // Phase C: 恩怨/门生
        if (!gm.enYuanRecords) gm.enYuanRecords = [];
        if (!gm.patronNetwork) gm.patronNetwork = [];
        // Phase D: 阴谋/事件冷却
        if (!gm.activeSchemes) gm.activeSchemes = [];
        if (!gm.schemeCooldowns) gm.schemeCooldowns = {};
        if (!gm.eventCooldowns) gm.eventCooldowns = {};
        // Phase E: 年度编年史
        if (!gm.yearlyChronicles) gm.yearlyChronicles = [];
        _dbg('[SaveMigration] v2 → v3: 全面升级字段补充');
        return data;
      }
    },
    // v3 → v4: 角色完整字段（zi/性别/家族成员/仕途/内心独白/压力源/族望）
    {
      from: 3, to: 4,
      migrate: function(data) {
        var gm = (data.gameState && (data.gameState.GM || data.gameState)) || data.gameState || data;
        if (!gm || !Array.isArray(gm.chars)) return data;
        if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
          var n = CharFullSchema.ensureAll(gm.chars);
          _dbg('[SaveMigration] v3 → v4: 角色完整字段补齐 ' + n + ' 位');
        } else {
          // CharFullSchema 未加载——保底手工补：zi/gender/familyMembers/career/stressSources
          gm.chars.forEach(function(ch) {
            if (!ch) return;
            if (ch.zi === undefined) ch.zi = ch.courtesyName || '';
            if (ch.gender === undefined) ch.gender = 'male';
            if (!Array.isArray(ch.familyMembers)) ch.familyMembers = [];
            if (!Array.isArray(ch.career)) ch.career = [];
            if (!Array.isArray(ch.stressSources)) ch.stressSources = [];
            if (ch.innerThought === undefined) ch.innerThought = '';
            if (ch.clanPrestige === undefined) ch.clanPrestige = 50;
            if (ch.management === undefined) ch.management = ch.administration || 50;
          });
          _dbg('[SaveMigration] v3 → v4: CharFullSchema 未就绪，使用保底补齐');
        }
        return data;
      }
    },
    // v4 → v5: 融合补强——NPC事件队列/官职深化/区划深化
    {
      from: 4, to: 5,
      migrate: function(data) {
        var gs = data.gameState || data;
        var gm = gs && (gs.GM || gs);
        var p  = gs && gs.P;
        if (!gm) return data;
        // NPC 事件反应队列
        if (!gm._pendingEventReactions) gm._pendingEventReactions = [];
        if (!gm._eventDetectCooldown) gm._eventDetectCooldown = {};
        // 变更日志（applyAITurnChanges）
        if (!gm.turnChanges) gm.turnChanges = {variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]};
        if (!gm.turnChanges.variables) gm.turnChanges.variables = [];
        // 官职深化字段在 GM.officeTree 内，遍历补齐默认值
        var _fix = function(positions){
          (positions||[]).forEach(function(pos){
            if (!pos) return;
            if (!pos.publicTreasuryInit) pos.publicTreasuryInit = {money:0,grain:0,cloth:0,quotaMoney:0,quotaGrain:0,quotaCloth:0};
            if (!pos.privateIncome) pos.privateIncome = {legalSalary:pos.salary||'',bonusType:'',bonusNote:'',illicitRisk:'medium'};
            if (!pos.powers) pos.powers = {appointment:false,yinBu:false,impeach:false,supervise:false,taxCollect:false,militaryCommand:false};
            if (!pos.hooks) pos.hooks = {triggerOnLowTreasury:'',triggerOnUnrest:'',triggerOnHeavenSign:'',tenureYears:0};
            if (pos.bindingHint === undefined) pos.bindingHint = '';
          });
        };
        var _walk = function(nodes){ (nodes||[]).forEach(function(n){ if (!n) return; _fix(n.positions); if (n.subs) _walk(n.subs); }); };
        _walk(gm.officeTree);
        if (p && p.officeTree) _walk(p.officeTree);
        if (p && p.government && p.government.nodes) _walk(p.government.nodes);
        // 区划深化 —— 遍历 adminHierarchy（runtime + preset）
        var _divFix = function(divs){
          (divs||[]).forEach(function(d){
            if (!d) return;
            if (typeof d.population === 'number') d.population = {total:d.population, households:0, mouths:d.population, ding:0};
            if (!d.population) d.population = {households:0,mouths:0,ding:0};
            if (!d.minxinDetails) d.minxinDetails = {};
            if (!d.corruption) d.corruption = {local:0};
            if (!d.publicTreasury) d.publicTreasury = {money:{stock:0},grain:{stock:0},cloth:{stock:0}};
            if (!d.fiscal) d.fiscal = {claimedRevenue:0,actualRevenue:0,remittedToCenter:0,retainedBudget:0,compliance:1.0};
            if (!d.environment) d.environment = {carryingCapacity:{arable:0,water:0,climate:0,currentLoad:0}};
            if (d.children) _divFix(d.children);
          });
        };
        if (p && p.adminHierarchy) {
          Object.keys(p.adminHierarchy).forEach(function(fid){
            var h = p.adminHierarchy[fid];
            if (h && h.divisions) _divFix(h.divisions);
          });
        }
        _dbg('[SaveMigration] v4 → v5: 融合补强字段齐备');
        return data;
      }
    }
  ],

  /** 运行迁移链：从存档版本自动升级到当前版本 */
  run: function(data) {
    var ver = (data._saveVersion || 1);
    if (ver >= SAVE_VERSION) return data; // 已是最新
    _dbg('[SaveMigration] 存档版本 ' + ver + ' → ' + SAVE_VERSION);
    SaveMigrations.migrations.forEach(function(m) {
      if (ver >= m.from && ver < m.to) {
        data = m.migrate(data);
        ver = m.to;
      }
    });
    data._saveVersion = SAVE_VERSION;
    return data;
  },

  /** 在保存时打上版本号 */
  stamp: function(data) {
    data._saveVersion = SAVE_VERSION;
    return data;
  }
};

// ============================================================
// 面子系统（Face/Honor）
// ============================================================

var FaceSystem = {
  /**
   * 获取角色面子值（0-100）
   * 存储在 character._face 字段
   */
  getFace: function(character) {
    if (!character) return 50;
    if (character._face === undefined) character._face = 60; // 初始60
    return character._face;
  },

  /**
   * 修改面子值
   * @param {Object} character
   * @param {number} delta - 正=获得面子，负=丢面子
   * @param {string} reason
   */
  changeFace: function(character, delta, reason) {
    if (!character) return;
    if (character._face === undefined) character._face = 60;
    var oldFace = character._face;
    character._face = clamp(character._face + delta, 0, 100);
    if (Math.abs(delta) >= 10) {
      _dbg('[Face] ' + character.name + ' 面子' + (delta>0?'+':'') + delta + '(' + reason + ') ' + oldFace + '→' + character._face);
    }
  },

  /**
   * 公开受辱（当众被贬/弹劾/失败）
   */
  publicHumiliation: function(character, reason) {
    FaceSystem.changeFace(character, -20, reason || '公开受辱');
    if (typeof EnYuanSystem !== 'undefined' && character._lastHumiliatedBy) {
      EnYuanSystem.add('yuan', character.name, character._lastHumiliatedBy, 2, reason || '公开受辱');
    }
    if (character.stress !== undefined) character.stress = Math.min(100, (character.stress||0) + 15);
  },

  /**
   * 公开受赏（当众嘉奖/升迁）
   */
  publicHonor: function(character, reason) {
    FaceSystem.changeFace(character, 15, reason || '公开受赏');
    if (typeof EnYuanSystem !== 'undefined' && character._lastHonoredBy) {
      EnYuanSystem.add('en', character.name, character._lastHonoredBy, 2, reason || '公开受赏');
    }
  },

  /**
   * 每回合面子自然回复
   */
  naturalRecovery: function() {
    if (!GM.chars) return;
    var decayRate = (P.opinionConfig && P.opinionConfig.faceDecayRate) || 0.02;
    var _ms = _getDaysPerTurn() / 30; // 月比例
    GM.chars.forEach(function(c) {
      if (c.alive === false) return;
      if (c._face === undefined) return;
      if (c._face < 60) {
        c._face = Math.min(60, c._face + (60 - c._face) * decayRate * _ms);
      }
    });
  },

  /**
   * 获取面子状态文本
   */
  getFaceText: function(character) {
    var f = FaceSystem.getFace(character);
    if (f >= 80) return '面子:如日中天';
    if (f >= 60) return '面子:体面';
    if (f >= 40) return '面子:低落';
    if (f >= 20) return '面子:颜面尽失';
    return '面子:奇耻大辱';
  }
};

// 注册面子回复到SettlementPipeline
SettlementPipeline.register('faceRecovery', '面子回复', function() { FaceSystem.naturalRecovery(); }, 23, 'perturn');

// ============================================================
// 注册结算步骤到 SettlementPipeline
// ============================================================
// monthly 步骤：每月子tick执行（经济/人事/社会类）
SettlementPipeline.register('variables', '变量更新', function(ctx) { updateVariables(ctx.timeRatio); }, 10, 'monthly');
SettlementPipeline.register('eraState', '时代状态', function() { updateEraState(); }, 15, 'monthly');
SettlementPipeline.register('relations', '关系更新', function() { updateRelations(); }, 20, 'monthly');
SettlementPipeline.register('opinionDecay', '好感衰减', function() { OpinionSystem.decayAll(); }, 22, 'monthly');
SettlementPipeline.register('postPerf', '岗位考绩', function() { if(GM.postSystem&&GM.postSystem.enabled) updatePostPerformance(); }, 25, 'monthly');
// perturn 步骤：每回合末执行一次（与 AI 推演结果配合的全局结算）
SettlementPipeline.register('changeQueue', '数据变化队列', function() { processChangeQueue(); }, 92, 'perturn');
SettlementPipeline.register('clearCache', '清空查询缓存', function() { WorldHelper.clearCache(); }, 95, 'perturn');

