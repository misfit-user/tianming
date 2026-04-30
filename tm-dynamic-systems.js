// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-dynamic-systems.js — 动态系统（2,976 行）
// Post 岗位系统 + SaveManager + SaveMigrations + 动态规则引擎
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（2026-04-24 R78）
// ══════════════════════════════════════════════════════════════
//
//  ┌─ §A Post 岗位系统（L1-1000） ─────────────────────┐
//  │  岗位 CRUD·holder 绑定·territory 关联
//  │  被 GM.officeTree 和行政区划同时使用
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B SaveManager（L1006-1200） ────────────────────┐
//  │  L1006 SaveManager = { maxSlots: 10, autoSaveInterval: 5 }
//  │  L1031 saveToSlot(slotId, saveName)
//  │  L1068 loadFromSlot(slotId)
//  │  L1107 deleteSlot(slotId)
//  │  L1117 autoSave()                  每 N 回合
//  │  （存档走 IndexedDB·压缩 gzip·含 P._saveVersion 戳）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C SaveMigrations（L2720-2873） ─────────────────┐
//  │  L2720 var SAVE_VERSION = 5       当前存档版本
//  │  L2726 SaveMigrations.migrations  v1→v5 迁移链
//  │  L2855 SaveMigrations.run(data)   自动升级旧存档
//  │  L2870 SaveMigrations.stamp(data) 写入版本号
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §D 动态规则引擎（其他） ─────────────────────────┐
//  │  runRules / evaluateCondition / applyEffect
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口
// ══════════════════════════════════════════════════════════════
//
//  SaveManager.getAllSaves()          列 10 槽
//  SaveManager.saveToSlot(1, '测试')
//  SaveManager.loadFromSlot(1)
//  SAVE_VERSION                       当前版本（5）
//  SaveMigrations.run(data)           手动跑迁移链
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 架构注意事项
// ══════════════════════════════════════════════════════════════
//
//  1. 改数据结构必须 bump SAVE_VERSION + 写 v(n-1)→v(n) 迁移函数
//     否则老存档无法加载
//
//  2. saveToSlot 的 stamp 调用在 R2 修复过（之前漏调）
//
//  3. IndexedDB + localStorage 双路径·压缩格式 gzip
//
// ══════════════════════════════════════════════════════════════

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

function ensureTurnChangesState() {
  if (typeof GM === 'undefined' || !GM) return null;
  if (!GM.turnChanges || typeof GM.turnChanges !== 'object' || Array.isArray(GM.turnChanges)) {
    GM.turnChanges = {};
  }
  ['variables', 'characters', 'factions', 'parties', 'classes', 'military', 'map'].forEach(function(key) {
    if (!Array.isArray(GM.turnChanges[key])) GM.turnChanges[key] = [];
  });
  return GM.turnChanges;
}

/** @param {string} category @param {string} itemName @param {string} field @param {*} oldValue @param {*} newValue @param {string} reason */
function recordChange(category, itemName, field, oldValue, newValue, reason) {
  var turnChanges = ensureTurnChangesState();
  if (!turnChanges) return;
  if (!turnChanges[category]) turnChanges[category] = [];
  var item = turnChanges[category].find(function(x) { return x.name === itemName; });
  if (!item) {
    item = { name: itemName, changes: [] };
    turnChanges[category].push(item);
  }
  item.changes.push({ field: field, oldValue: oldValue, newValue: newValue, reason: reason });
}

// 记录变量变化（支持多个原因）
function recordVarChange(varName, amount, type, desc) {
  var turnChanges = ensureTurnChangesState();
  if (!turnChanges) return;
  var v = turnChanges.variables.find(function(x) { return x.name === varName; });
  if (!v) {
    var currentVal = GM.vars[varName] ? GM.vars[varName].value : 0;
    v = { name: varName, oldValue: currentVal, newValue: currentVal, delta: 0, reasons: [] };
    turnChanges.variables.push(v);
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
