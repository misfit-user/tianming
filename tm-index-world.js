// ============================================================
// 索引系统 - 性能优化
// Requires: tm-data-model.js (P, GM),
//           tm-utils.js (_dbg, uid, callAI, callAISmart, escHtml, getTS, deepClone)
// ============================================================

/** 构建所有 Map 索引（角色/势力/党派/阶层等按名字快查） */
function buildIndices() {
  // 初始化索引对象
  if (!GM._indices) {
    GM._indices = {};
  }

  // 初始化监听系统
  initDataListeners();

  // 1. 角色索引（按名字）
  GM._indices.charByName = new Map();
  if (GM.chars && GM.chars.length > 0) {
    GM.chars.forEach(function(char) {
      if (char && char.name) {
        GM._indices.charByName.set(char.name, char);
      }
    });
  }

  // 2. 势力索引（按名字）
  GM._indices.facByName = new Map();
  if (GM.facs && GM.facs.length > 0) {
    GM.facs.forEach(function(fac) {
      if (fac && fac.name) {
        GM._indices.facByName.set(fac.name, fac);
      }
    });
  }

  // 3. 党派索引（按名字）
  GM._indices.partyByName = new Map();
  if (GM.parties && GM.parties.length > 0) {
    GM.parties.forEach(function(party) {
      if (party && party.name) {
        GM._indices.partyByName.set(party.name, party);
      }
    });
  }

  // 4. 阶层索引（按名字）
  GM._indices.classByName = new Map();
  if (GM.classes && GM.classes.length > 0) {
    GM.classes.forEach(function(cls) {
      if (cls && cls.name) {
        GM._indices.classByName.set(cls.name, cls);
      }
    });
  }


  // 6. 科技索引（按名字）
  GM._indices.techByName = new Map();
  if (GM.techTree && GM.techTree.length > 0) {
    GM.techTree.forEach(function(tech) {
      if (tech && tech.name) {
        GM._indices.techByName.set(tech.name, tech);
      }
    });
  }

  // 7. 军队索引（按名字）
  GM._indices.armyByName = new Map();
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      if (army && army.name) {
        GM._indices.armyByName.set(army.name, army);
      }
    });
  }

  // 8. 场景索引（按 ID）- 全局 P 对象
  if (!P._indices) {
    P._indices = {};
  }
  P._indices.scenarioById = new Map();
  if (P.scenarios && P.scenarios.length > 0) {
    P.scenarios.forEach(function(sc) {
      if (sc && sc.id) {
        P._indices.scenarioById.set(sc.id, sc);
      }
    });
  }

  // 9. 岗位索引（按 ID 和领地 ID）
  if (GM.postSystem && GM.postSystem.enabled) {
    GM._indices.postById = new Map();
    GM._indices.postByTerritory = new Map();

    if (GM.postSystem.posts && GM.postSystem.posts.length > 0) {
      GM.postSystem.posts.forEach(function(post) {
        if (post && post.id) {
          GM._indices.postById.set(post.id, post);

          if (post.territoryId) {
            if (!GM._indices.postByTerritory.has(post.territoryId)) {
              GM._indices.postByTerritory.set(post.territoryId, []);
            }
            GM._indices.postByTerritory.get(post.territoryId).push(post);
          }
        }
      });
    }
  }

  // 10. Unit 索引（按 ID）
  if (P.unitSystem && P.unitSystem.enabled) {
    GM._indices.unitById = new Map();
    if (GM.units && GM.units.length > 0) {
      GM.units.forEach(function(unit) {
        if (unit && unit.id) {
          GM._indices.unitById.set(unit.id, unit);
        }
      });
    }
  }

  // 11. 补给仓库索引（按 ID）
  if (P.supplySystem && P.supplySystem.enabled) {
    GM._indices.supplyDepotById = new Map();
    if (GM.supplyDepots && GM.supplyDepots.length > 0) {
      GM.supplyDepots.forEach(function(depot) {
        if (depot && depot.id) {
          GM._indices.supplyDepotById.set(depot.id, depot);
        }
      });
    }
  }

  // 12. 建筑索引（按 ID 和领地）
  GM._indices.buildingById = new Map();
  GM._indices.buildingByTerritory = new Map();
  if (GM.buildings && GM.buildings.length > 0) {
    GM.buildings.forEach(function(b) {
      if (b && b.id) {
        GM._indices.buildingById.set(b.id, b);
        if (b.territory) {
          if (!GM._indices.buildingByTerritory.has(b.territory)) {
            GM._indices.buildingByTerritory.set(b.territory, []);
          }
          GM._indices.buildingByTerritory.get(b.territory).push(b);
        }
      }
    });
  }

  // 13. 官职索引（按职位名）——walk officeTree·替代反复 walk 查询
  GM._indices.officeByName = new Map();
  GM._indices.officeByHolder = new Map();
  if (GM.officeTree && GM.officeTree.length > 0) {
    (function _walk(nodes, path) {
      (nodes || []).forEach(function(n) {
        if (!n) return;
        var _dept = (path ? path + '/' : '') + (n.name || '');
        (n.positions || []).forEach(function(p) {
          if (!p || !p.name) return;
          // 若同名职位多处·保留首个·附加 dept 字段便于区分
          if (!GM._indices.officeByName.has(p.name)) GM._indices.officeByName.set(p.name, { pos: p, dept: _dept, node: n });
          if (p.holder && p.holder !== '\u7A7A' && p.holder !== '') GM._indices.officeByHolder.set(p.holder, { pos: p, dept: _dept, node: n });
        });
        if (n.subs) _walk(n.subs, _dept);
      });
    })(GM.officeTree, '');
  }

  // 14. 行政区划索引（按名字/ID）——扁平化 adminHierarchy 树（支持对象根+数组根）
  GM._indices.divisionByName = new Map();
  if (GM.adminHierarchy) {
    var _divFlat = function(n) {
      if (!n) return;
      if (n.name) GM._indices.divisionByName.set(n.name, n);
      if (n.id && !GM._indices.divisionByName.has(n.id)) GM._indices.divisionByName.set(n.id, n);
      var _kids = n.children || n.subs || [];
      if (Array.isArray(_kids)) _kids.forEach(_divFlat);
    };
    if (Array.isArray(GM.adminHierarchy)) GM.adminHierarchy.forEach(_divFlat);
    else _divFlat(GM.adminHierarchy);
  }
}

// initAchievements 在 tm-dynamic-systems.js 中定义，此处不能直接调用（尚未加载）
// 改为在 startGame() 中调用

// 重建索引（在数据变化后调用）
function rebuildIndices() {
  buildIndices();
}

// ============================================================
//  索引维护函数（动态添加/删除/更新数据时使用）
// ============================================================

// 添加到索引
function addToIndex(type, key, value) {
  if (!GM._indices) {
    GM._indices = {};
  }

  var indexMap = {
    'char': 'charByName',
    'fac': 'facByName',
    'party': 'partyByName',
    'class': 'classByName',
    'tech': 'techByName',
    'army': 'armyByName',
    'post': 'postById',
    'unit': 'unitById',
    'building': 'buildingById',
    'supplyDepot': 'supplyDepotById'
  };

  var indexName = indexMap[type];
  if (!indexName) return;

  if (!GM._indices[indexName]) {
    GM._indices[indexName] = new Map();
  }

  GM._indices[indexName].set(key, value);
}

// 从索引中删除
function removeFromIndex(type, key) {
  if (!GM._indices) return;

  var indexMap = {
    'char': 'charByName',
    'fac': 'facByName',
    'party': 'partyByName',
    'class': 'classByName',
    'tech': 'techByName',
    'army': 'armyByName',
    'post': 'postById',
    'unit': 'unitById',
    'building': 'buildingById',
    'supplyDepot': 'supplyDepotById'
  };

  var indexName = indexMap[type];
  if (!indexName || !GM._indices[indexName]) return;

  GM._indices[indexName].delete(key);
}

// 更新索引（当 key 改变时）
function updateIndex(type, oldKey, newKey, value) {
  removeFromIndex(type, oldKey);
  addToIndex(type, newKey, value);
}

// 场景索引维护（全局 P 对象）
function addScenarioToIndex(id, scenario) {
  if (!P._indices) {
    P._indices = {};
  }
  if (!P._indices.scenarioById) {
    P._indices.scenarioById = new Map();
  }
  P._indices.scenarioById.set(id, scenario);
}

function removeScenarioFromIndex(id) {
  if (!P._indices || !P._indices.scenarioById) return;
  P._indices.scenarioById.delete(id);
}

function updateScenarioIndex(oldId, newId, scenario) {
  removeScenarioFromIndex(oldId);
  addScenarioToIndex(newId, scenario);
}

// 快速查询函数（O(1) 复杂度）
/** @param {string} name @returns {Object|undefined} 角色对象 */
function findCharByName(name) {
  if (!GM._indices || !GM._indices.charByName) {
    buildIndices();
  }
  return GM._indices.charByName.get(name);
}

/** @param {string} name @returns {Object|undefined} 势力对象 */
function findFacByName(name) {
  if (!GM._indices || !GM._indices.facByName) {
    buildIndices();
  }
  return GM._indices.facByName.get(name);
}

function findPartyByName(name) {
  if (!GM._indices || !GM._indices.partyByName) {
    buildIndices();
  }
  return GM._indices.partyByName.get(name);
}

function findClassByName(name) {
  if (!GM._indices || !GM._indices.classByName) {
    buildIndices();
  }
  return GM._indices.classByName.get(name);
}

function findTechByName(name) {
  if (!GM._indices || !GM._indices.techByName) {
    buildIndices();
  }
  return GM._indices.techByName.get(name);
}

function findArmyByName(name) {
  if (!GM._indices || !GM._indices.armyByName) {
    buildIndices();
  }
  return GM._indices.armyByName.get(name);
}

/** @param {string} sid @returns {Object|undefined} 剧本对象 */
function findScenarioById(id) {
  if (!P._indices || !P._indices.scenarioById) {
    buildIndices();
  }
  // 防御性检查：确保 scenarioById 是 Map 对象
  if (!(P._indices.scenarioById instanceof Map)) {
    console.warn('[findScenarioById] scenarioById 不是 Map，重建索引');
    buildIndices();
  }
  return P._indices.scenarioById.get(id);
}

// ============================================================
// WorldHelper - 统一数据查询接口
// ============================================================

/**
 * WorldHelper 数据查询系统
 * 借鉴 KingOfIreland 的 WorldHelper 设计，提供统一的数据访问接口
 *
 * 核心特性：
 * 1. 统一查询接口（getById, getByName, getAll）
 * 2. 链式查询支持（filter, map, reduce）
 * 3. 关系查询（getVassals, getLiege, getSubordinates）
 * 4. 查询缓存机制
 * 5. 数据统计函数（count, sum, avg）
 */

var WorldHelper = {
  // 查询缓存
  _queryCache: {},
  _cacheEnabled: true,
  _cacheTTL: 1000, // 缓存有效期（毫秒）

  // 清空缓存
  clearCache: function() {
    this._queryCache = {};
  },

  // 获取缓存键
  _getCacheKey: function(type, method, args) {
    return type + '.' + method + '.' + JSON.stringify(args);
  },

  // 从缓存获取
  _getFromCache: function(key) {
    if (!this._cacheEnabled) return null;
    var cached = this._queryCache[key];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this._cacheTTL) {
      delete this._queryCache[key];
      return null;
    }
    return cached.data;
  },

  // 存入缓存
  _setCache: function(key, data) {
    if (!this._cacheEnabled) return;
    this._queryCache[key] = {
      data: data,
      timestamp: Date.now()
    };
  },

  // 获取所有实体（通用）
  getAll: function(type) {
    var cacheKey = this._getCacheKey(type, 'getAll', []);
    var cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    var result = [];
    switch(type) {
      case 'character':
        result = GM.chars || [];
        break;
      case 'faction':
        result = GM.facs || [];
        break;
      case 'party':
        result = GM.parties || [];
        break;
      case 'class':
        result = GM.classes || [];
        break;
      case 'army':
        result = GM.armies || [];
        break;
      case 'tech':
        result = GM.techTree || [];
        break;
      case 'civic':
        result = GM.civicTree || [];
        break;
      case 'post':
        result = GM.posts || [];
        break;
      case 'scenario':
        result = P.scenarios || [];
        break;
      case 'region':
        result = (P.map && P.map.regions) || [];
        break;
      default:
        result = [];
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 按名字查询（单个）
  getByName: function(type, name) {
    if (!name) return null;

    var cacheKey = this._getCacheKey(type, 'getByName', [name]);
    var cached = this._getFromCache(cacheKey);
    if (cached !== null) return cached;

    var result = null;
    switch(type) {
      case 'character':
        result = findCharByName(name);
        break;
      case 'faction':
        result = findFacByName(name);
        break;
      case 'party':
        result = findPartyByName(name);
        break;
      case 'class':
        result = findClassByName(name);
        break;
      case 'army':
        result = findArmyByName(name);
        break;
      case 'tech':
        result = findTechByName(name);
        break;
      default:
        result = this.getAll(type).find(function(item) {
          return item.name === name;
        });
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 按 ID 查询（单个）
  getById: function(type, id) {
    if (!id) return null;

    var cacheKey = this._getCacheKey(type, 'getById', [id]);
    var cached = this._getFromCache(cacheKey);
    if (cached !== null) return cached;

    var result = null;
    if (type === 'scenario') {
      result = findScenarioById(id);
    } else {
      result = this.getAll(type).find(function(item) {
        return item.id === id;
      });
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 条件查询（多个）
  where: function(type, predicate) {
    return this.getAll(type).filter(predicate);
  },

  // 统计数量
  count: function(type, predicate) {
    if (predicate) {
      return this.where(type, predicate).length;
    }
    return this.getAll(type).length;
  },

  // 求和
  sum: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    return items.reduce(function(sum, item) {
      return sum + (item[property] || 0);
    }, 0);
  },

  // 平均值
  avg: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return 0;
    return this.sum(type, property, predicate) / items.length;
  },

  // 最大值
  max: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return null;
    return items.reduce(function(max, item) {
      return (item[property] || 0) > (max[property] || 0) ? item : max;
    });
  },

  // 最小值
  min: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return null;
    return items.reduce(function(min, item) {
      return (item[property] || 0) < (min[property] || 0) ? item : min;
    });
  },

  // ============================================================
  // 关系查询（中国古代背景）
  // ============================================================

  // 获取角色的所有下属
  getSubordinates: function(characterName) {
    if (!characterName) return [];

    var char = this.getByName('character', characterName);
    if (!char || !char.position) return [];

    // 查找官职
    var office = this.findOffice(char.position);
    if (!office) return [];

    // 查找该官职的下属官职
    var subordinateOffices = this.getSubordinateOffices(office);

    // 查找担任这些官职的角色
    var subordinates = [];
    subordinateOffices.forEach(function(subOffice) {
      var holder = WorldHelper.where('character', function(c) {
        return c.position === subOffice.name;
      });
      subordinates = subordinates.concat(holder);
    });

    return subordinates;
  },

  // 获取角色的上级
  getSuperior: function(characterName) {
    if (!characterName) return null;

    var char = this.getByName('character', characterName);
    if (!char || !char.position) return null;

    // 查找官职
    var office = this.findOffice(char.position);
    if (!office || !office.deptId) return null;

    // 查找部门负责人
    var dept = this.findDepartment(office.deptId);
    if (!dept || !dept.head) return null;

    return this.getByName('character', dept.head);
  },

  // 获取势力的所有封臣
  getVassals: function(factionName) {
    if (!factionName) return [];

    var faction = this.getByName('faction', factionName);
    if (!faction || !faction.vassals) return [];

    return faction.vassals.map(function(vassalName) {
      return WorldHelper.getByName('faction', vassalName);
    }).filter(function(v) { return v !== null; });
  },

  // 获取势力的宗主
  getLiege: function(factionName) {
    if (!factionName) return null;

    var faction = this.getByName('faction', factionName);
    if (!faction || !faction.liege) return null;

    return this.getByName('faction', faction.liege);
  },

  // 获取角色的所有关系
  getRelations: function(characterName) {
    if (!characterName) return [];

    var relations = [];

    // 查找父子关系
    var children = this.where('character', function(c) {
      return c.father === characterName || c.mother === characterName;
    });
    children.forEach(function(child) {
      relations.push({ type: '子女', target: child.name, character: child });
    });

    // 查找配偶关系
    var char = this.getByName('character', characterName);
    if (char && char.spouse) {
      var spouse = this.getByName('character', char.spouse);
      if (spouse) {
        relations.push({ type: '配偶', target: spouse.name, character: spouse });
      }
    }

    // 查找上下级关系
    var subordinates = this.getSubordinates(characterName);
    subordinates.forEach(function(sub) {
      relations.push({ type: '下属', target: sub.name, character: sub });
    });

    var superior = this.getSuperior(characterName);
    if (superior) {
      relations.push({ type: '上级', target: superior.name, character: superior });
    }

    return relations;
  },

  // ============================================================
  // 辅助查询函数
  // ============================================================

  // 查找官职
  findOffice: function(officeName) {
    if (!GM.officeTree || !officeName) return null;

    var result = null;
    function search(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.positions) {
          for (var j = 0; j < node.positions.length; j++) {
            if (node.positions[j].name === officeName) {
              result = node.positions[j];
              result.deptId = node.id;
              result.deptName = node.name;
              return;
            }
          }
        }
        if (node.children) {
          search(node.children);
        }
      }
    }
    search(GM.officeTree);
    return result;
  },

  // 查找部门
  findDepartment: function(deptId) {
    if (!GM.officeTree || !deptId) return null;

    var result = null;
    function search(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === deptId) {
          result = nodes[i];
          return;
        }
        if (nodes[i].children) {
          search(nodes[i].children);
        }
      }
    }
    search(GM.officeTree);
    return result;
  },

  // 获取下属官职
  getSubordinateOffices: function(office) {
    if (!office || !office.deptId) return [];

    var dept = this.findDepartment(office.deptId);
    if (!dept) return [];

    var subordinates = [];
    if (dept.positions) {
      dept.positions.forEach(function(pos) {
        if (pos.rank > office.rank) {
          subordinates.push(pos);
        }
      });
    }

    return subordinates;
  },

  // 获取角色所在势力
  getCharacterFaction: function(characterName) {
    if (!characterName) return null;

    var char = this.getByName('character', characterName);
    if (!char || !char.faction) return null;

    return this.getByName('faction', char.faction);
  },

  // 获取势力的所有角色
  getFactionCharacters: function(factionName) {
    if (!factionName) return [];

    return this.where('character', function(c) {
      return c.faction === factionName;
    });
  },

  // 获取势力的所有军队
  getFactionArmies: function(factionName) {
    if (!factionName) return [];

    return this.where('army', function(a) {
      return a.faction === factionName;
    });
  },

  // 获取势力的总兵力
  getFactionTotalSoldiers: function(factionName) {
    return this.sum('army', 'soldiers', function(a) {
      return a.faction === factionName;
    });
  },

  // 获取角色的权力值（根据官职和能力）
  getCharacterPower: function(characterName) {
    var char = this.getByName('character', characterName);
    if (!char) return 0;

    var power = 0;

    // 基础能力值
    power += (char.intelligence || 0) * 0.3;
    power += (char.valor || 0) * 0.2;
    power += (char.benevolence || 0) * 0.1;

    // 官职加成
    if (char.position) {
      var office = this.findOffice(char.position);
      if (office && office.rank) {
        power += (10 - office.rank) * 10; // 品级越高权力越大
      }
    }

    // 下属数量加成
    var subordinates = this.getSubordinates(characterName);
    power += subordinates.length * 5;

    return Math.round(power);
  }
};

// findCharByName / findFacByName 已在索引系统中定义（约6895行），此处不再重复

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
  if (P.time && P.time.perTurn) {
    var _ptDesc = {'1d':'\u6BCF\u56DE\u5408=1\u5929','1m':'\u6BCF\u56DE\u5408=1\u4E2A\u6708','1s':'\u6BCF\u56DE\u5408=1\u5B63\u5EA6','1y':'\u6BCF\u56DE\u5408=1\u5E74'};
    var _ptText = _ptDesc[P.time.perTurn] || '';
    if (P.time.perTurn === 'custom' && P.time.customDays) _ptText = '\u6BCF\u56DE\u5408=' + P.time.customDays + '\u5929';
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
        // 兵种组成
        if (Array.isArray(a.composition) && a.composition.length > 0) {
          aInfo += '\n    兵种:' + a.composition.map(function(c) { return c.type + (c.count ? c.count + '人' : ''); }).join('/');
        } else if (typeof a.composition === 'string' && a.composition) {
          aInfo += ' 兵种:' + String(a.composition).slice(0, 20);
        }
        // 装备概况
        if (a.equipmentCondition) aInfo += ' 装备' + a.equipmentCondition;
        if (Array.isArray(a.equipment) && a.equipment.length > 0) {
          aInfo += '(' + a.equipment.slice(0, 4).map(function(eq) { return eq.name + (eq.count ? eq.count : ''); }).join(',') + ')';
        }
        // 军饷
        if (Array.isArray(a.salary) && a.salary.length > 0) {
          aInfo += '\n    年饷:' + a.salary.map(function(s) { return (s.amount||0) + (s.unit||'') + (s.resource ? '(' + s.resource + ')' : ''); }).join('+');
        }
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
  if (GM.buildings && GM.buildings.length > 0) {
    var _bldByTerritory = {};
    GM.buildings.forEach(function(b) {
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
      var _spouseNames = GM.chars.filter(function(c) { return c.spouse && c.alive !== false; }).map(function(c) { return c.motherClan || c.family || ''; }).filter(function(s) { return s; });
      if (_spouseNames.length > 0) {
        var _clanOfficials = [];
        GM.chars.forEach(function(c) {
          if (c.alive !== false && c.family && _spouseNames.indexOf(c.family) !== -1 && !c.spouse) {
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
        var livingCount = 0;
        fam.branches.forEach(function(b) {
          b.members.forEach(function(m) { var c = findCharByName(m); if (c && c.alive !== false) livingCount++; });
        });
        if (livingCount === 0) return;
        ctx += '  ' + fn + '(' + (_tierNames[fam.tier] || '\u5BD2\u95E8') + ',\u58F0\u671B' + Math.round(fam.renown || 0) + ',' + livingCount + '\u4EBA)';
        if (fam.branches.length > 1) {
          ctx += ' \u5206\u652F:' + fam.branches.map(function(b) { return b.name; }).join('/');
        }
        ctx += '\n';
      });
      // 检测家族内部矛盾（族人间亲疏度负值）
      if (typeof AffinityMap !== 'undefined') {
        _famKeys.slice(0, 5).forEach(function(fn) {
          var fam = GM.families[fn];
          var conflicts = [];
          var allMem = [];
          fam.branches.forEach(function(b) { allMem = allMem.concat(b.members); });
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
    var _spouses = GM.chars.filter(function(c) { return c.alive !== false && c.spouse; });
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
          if (preg.dueThisTurn) ctx += '\uFF08\u5373\u5C06\u4EA7\u5B50\uFF0C\u8BF7\u901A\u8FC7new_characters\u5B89\u6392\u5B50\u55E3\u8BDE\u751F\uFF09';
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
      ctx += '  T' + f.turn + ': ' + f.text + '\n';
    });
    ctx += '  \u203B \u4EE5\u4E0A\u4F0F\u7B14\u5E94\u5728\u672C\u56DE\u5408\u6216\u672A\u67652-3\u56DE\u5408\u5185\u5F97\u5230\u56DE\u5E94/\u53D1\u5C55\u3002\u5DF2\u5B9E\u73B0\u7684\u4F0F\u7B14\u4F1A\u81EA\u52A8\u6E05\u9664\u3002\n';
  }

  // AI压缩记忆（跨回合的关键信息链）
  if (GM._aiMemory && GM._aiMemory.length > 0) {
    ctx += '\u3010AI\u5386\u53F2\u8BB0\u5FC6\u3011\n';
    GM._aiMemory.slice(-8).forEach(function(m) {
      ctx += '  T' + m.turn + ': ' + m.text + '\n';
    });
  }

  // 当前大势走向
  if (GM._currentTrend) {
    ctx += '\u3010\u5F53\u524D\u5927\u52BF\u3011' + GM._currentTrend + '\n';
  }

  return ctx;
}

function generateMemorials(){
  // tokens 预算 16000·原 2-4 份奏疏利用不足·按 tokens 量力而为生成更多
  // 默认提高到 6-10 份·玩家在编辑器可通过 memorialMin/memorialMax 覆盖
  var minCount = P.conf.memorialMin || 6;
  var maxCount = P.conf.memorialMax || 10;
  var count = minCount + Math.floor(random() * (maxCount - minCount + 1));
  if(!GM.chars || GM.chars.length === 0){ GM.memorials = []; renderMemorials(); return; }
  if(P.ai.key){ genMemorialsAI(count); return; }
  // 无AI时：按忠诚和野心优先选人（不纯随机）
  var candidates = GM.chars.filter(function(c){ return c.alive !== false; });
  candidates.sort(function(a, b) {
    var sa = (a.ambition || 50) + (100 - (a.loyalty || 50)); // 野心高+忠诚低→更想上奏
    var sb = (b.ambition || 50) + (100 - (b.loyalty || 50));
    return sb - sa;
  });
  count = Math.min(count, candidates.length);
  GM.memorials = candidates.slice(0, count).map(function(ch){
    // 根据特质推断奏疏类型
    var type = '政务';
    if (ch.traitIds) {
      if (ch.traitIds.indexOf('brave') >= 0 || ch.traitIds.indexOf('militant') >= 0) type = '军务';
      else if (ch.traitIds.indexOf('compassionate') >= 0 || ch.traitIds.indexOf('merciful') >= 0) type = '民生';
      else if (ch.traitIds.indexOf('greedy') >= 0 || ch.traitIds.indexOf('diligent') >= 0) type = '经济';
    }
    return { id: uid(), from: ch.name, title: ch.title || '', type: type, content: ch.name + '奏报：臣以为当务之急…', status: 'pending', turn: GM.turn, reply: '' };
  });
  renderMemorials();
}

async function genMemorialsAI(count){
  try{
    // 构建极丰富上下文prompt
    var prompt = getTSText(GM.turn) + '第' + GM.turn + '回合。\n';

    // 完整局势摘要
    if (GM.eraState) {
      prompt += '局势：' + (GM.eraState.dynastyPhase || '') + '，统一' + Math.round((GM.eraState.politicalUnity||0.5)*100) + '% 集权' + Math.round((GM.eraState.centralControl||0.5)*100) + '% 稳定' + Math.round((GM.eraState.socialStability || 0.5) * 100) + '% 经济' + Math.round((GM.eraState.economicProsperity || 0.5) * 100) + '% 文化' + Math.round((GM.eraState.culturalVibrancy||0.5)*100) + '%\n';
    }
    if (GM.taxPressure !== undefined) prompt += '税压' + Math.round(GM.taxPressure||0) + '\n';

    // 全部变量
    var topVars = [];
    Object.entries(GM.vars || {}).forEach(function(e) { topVars.push(e[0] + ':' + Math.round(e[1].value)); });
    if (topVars.length) prompt += '资源：' + topVars.join('，') + '\n';

    // 显著矛盾（让奏疏内容围绕矛盾展开）
    if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
      prompt += '\n【显著矛盾——奏疏内容应围绕这些矛盾】\n';
      P.playerInfo.coreContradictions.forEach(function(c) { prompt += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + '\n'; });
    }

    // 危机省份（让地方官上疏）
    if (GM.provinceStats) {
      var _critProv2 = Object.entries(GM.provinceStats).filter(function(e){return e[1].unrest>40||e[1].corruption>50;});
      if (_critProv2.length > 0) {
        prompt += '危机省份：' + _critProv2.map(function(e){return e[0]+'(民变'+Math.round(e[1].unrest)+' 腐'+Math.round(e[1].corruption)+')';}).join('、') + '\n';
      }
    }

    // 深度阅读摘要（让奏疏内容更有深度）
    if (GM._aiScenarioDigest) {
      if (GM._aiScenarioDigest.masterDigest) prompt += '\n剧本理解：' + GM._aiScenarioDigest.masterDigest.substring(0, 300) + '\n';
      if (GM._aiScenarioDigest.etiquetteNorms) prompt += '礼仪规范：' + GM._aiScenarioDigest.etiquetteNorms.substring(0, 100) + '\n';
      if (GM._aiScenarioDigest.writtenStyle) prompt += '公文行文：' + GM._aiScenarioDigest.writtenStyle.substring(0, 100) + '\n';
    }

    // 空缺岗位
    var vacantNames = [];
    if (GM.officeTree) {
      (function _vac(nodes) { nodes.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (!p.holder) vacantNames.push(n.name + p.name); }); if (n.subs) _vac(n.subs); }); })(GM.officeTree);
    }
    if (vacantNames.length) prompt += '空缺官职：' + vacantNames.slice(0, 4).join('，') + '\n';

    // 官制职能分工（奏疏必须由对口部门的官员提出）
    if (typeof getOfficeFunctionSummary === 'function') {
      var _ofSummary = getOfficeFunctionSummary();
      if (_ofSummary) prompt += '\n' + _ofSummary + '\n【核心规则】每份奏疏的from(上奏者)必须是对口部门的官员。军务由兵部/卫尉提出，财政由户部/度支提出，人事由吏部/铨曹提出。请根据上述职能分工精确匹配。\n\n';
    }

    // 游戏模式感知——影响奏疏风格
    var _gMode = (P.conf && P.conf.gameMode) || 'yanyi';
    if (_gMode === 'strict_hist') prompt += '【模式：严格史实】奏疏应严谨考据，引用真实典故，格式严格仿古\n';
    else if (_gMode === 'light_hist') prompt += '【模式：轻度史实】奏疏基于史实但可适度发挥\n';
    else prompt += '【模式：演义】奏疏可富于文学性和戏剧性\n';

    // 待铨进士——由官制中负责铨选的部门官员提议授官
    if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) {
      var _quanDept = (typeof findOfficeByFunction === 'function') ? (findOfficeByFunction('铨选') || findOfficeByFunction('选官') || findOfficeByFunction('吏') || findOfficeByFunction('人事')) : null;
      prompt += '【待铨进士】' + GM._kejuPendingAssignment.map(function(p){ return p.name + '(第' + p.rank + '名)'; }).join('、') + '\n';
      if (_quanDept && _quanDept.holder) {
        prompt += '  ※按本朝官制，铨选授官由' + _quanDept.dept + '负责，现任主官为' + _quanDept.holder + '——应由此人上疏建议为进士授官\n';
      } else if (_quanDept) {
        prompt += '  ※按本朝官制，铨选授官由' + _quanDept.dept + '负责（目前主官空缺，可由朝臣联名上疏）\n';
      } else {
        prompt += '  ※朝臣可就进士授官提出建议\n';
      }
    }

    // 近期事件
    if (GM.evtLog) {
      var recent = GM.evtLog.slice(-4);
      if (recent.length) prompt += '近事：' + recent.map(function(e) { return e.text; }).join('；').substring(0, 150) + '\n';
    }

    // 角色列表（含特质、目标、忠诚、弧线、亲疏）
    prompt += '\n上奏角色：\n';
    var candidates = GM.chars.filter(function(c) { return c.alive !== false; });
    // 按"上奏动机"排序：野心高、忠诚极端、压力高的优先
    candidates.sort(function(a, b) {
      var sa = Math.abs((a.loyalty || 50) - 50) + (a.ambition || 50) + (a.stress || 0) * 0.5;
      var sb = Math.abs((b.loyalty || 50) - 50) + (b.ambition || 50) + (b.stress || 0) * 0.5;
      return sb - sa;
    });
    candidates.slice(0, Math.min(count + 2, 8)).forEach(function(ch, idx) {
      var traits = '';
      if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
        var names = [], hints = [];
        ch.traitIds.forEach(function(tid) { var d = P.traitDefinitions.find(function(t) { return t.id === tid; }); if (d) { names.push(d.name); if (d.aiHint) hints.push(d.aiHint); } });
        traits = names.join('、') + (hints.length ? '(' + hints.join(';').substring(0, 60) + ')' : '');
      } else { traits = ch.personality || ''; }
      var goal = ch.personalGoal ? '目标:' + ch.personalGoal.substring(0, 25) : '';
      var arc = '';
      if (GM.characterArcs && GM.characterArcs[ch.name]) {
        var recentArc = GM.characterArcs[ch.name].slice(-2);
        if (recentArc.length) arc = '经历:' + recentArc.map(function(a) { return a.desc; }).join(';').substring(0, 40);
      }
      var aff = '';
      if (typeof AffinityMap !== 'undefined') {
        var topRels = AffinityMap.getRelations(ch.name).slice(0, 2);
        if (topRels.length) aff = '亲疏:' + topRels.map(function(r) { return r.name + (r.value > 0 ? '+' : '') + r.value; }).join(',');
      }
      // 后宫身份标注
      var spouseInfo = '';
      if (ch.spouse) {
        var _rkN2 = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u59BE','attendant':'\u4F8D\u59BE'};
        spouseInfo = ' [\u540E\u5BAB:' + (_rkN2[ch.spouseRank] || '\u59BB\u5BA4');
        if (ch.motherClan) spouseInfo += ',\u6BCD\u65CF' + ch.motherClan;
        if (ch.children && ch.children.length > 0) spouseInfo += ',\u5B50' + ch.children.length;
        spouseInfo += ']';
      }
      // NPC记忆（影响奏疏态度）
      var memCtx = '';
      if (typeof NpcMemorySystem !== 'undefined') {
        var _mc = NpcMemorySystem.getMemoryContext(ch.name);
        if (_mc) memCtx = ' 心绪:' + _mc.slice(0, 120);
      }
      // 位置与信息边界
      var _locInfo = '';
      var _capital2 = GM._capital || '京城';
      if (ch.location && ch.location !== _capital2) {
        _locInfo = ' [远方:' + ch.location + ']';
        // 计算此NPC最后收到京城信息的时间
        var _lastInfo = 0;
        (GM.letters||[]).forEach(function(lt) {
          if (lt.to === ch.name && (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying')) {
            _lastInfo = Math.max(_lastInfo, lt.deliveryTurn || lt.sentTurn || 0);
          }
        });
        if (_lastInfo > 0) {
          _locInfo += '(最后知悉京城信息:T' + _lastInfo + ',即' + (GM.turn - _lastInfo) + '回合前)';
        } else {
          _locInfo += '(从未收到京城消息)';
        }
      } else {
        _locInfo = ' [在京]';
      }
      prompt += (idx + 1) + '. ' + ch.name + '(' + (ch.title || '') + ')' + _locInfo + spouseInfo + ' \u5FE0' + (ch.loyalty || 50) + ' \u667A' + (ch.intelligence||50) + ' \u6B66\u52C7' + (ch.valor||50) + ' \u519B\u4E8B' + (ch.military||50) + ' \u653F' + (ch.administration||50) + ' ' + traits + ' ' + goal + ' ' + arc + ' ' + aff + memCtx + '\n';
    });

    // 帝王荒淫背景（影响奏疏内容——忠臣可能谏阻，佞臣可能献媚）
    if (GM._tyrantDecadence && GM._tyrantDecadence > 15) {
      prompt += '\n帝王荒淫值:' + GM._tyrantDecadence;
      if (GM._tyrantHistory && GM._tyrantHistory.length > 0) {
        var _lastActs = GM._tyrantHistory.slice(-2);
        var _actNames = [];
        _lastActs.forEach(function(th) {
          th.acts.forEach(function(id) {
            var a = typeof TYRANT_ACTIVITIES !== 'undefined' ? TYRANT_ACTIVITIES.find(function(x) { return x.id === id; }) : null;
            if (a && _actNames.indexOf(a.name) < 0) _actNames.push(a.name);
          });
        });
        if (_actNames.length) prompt += '（近期行径：' + _actNames.join('、') + '）';
      }
      prompt += '\n';
      if (GM._tyrantDecadence > 40) {
        prompt += '※ 至少一份奏疏应与帝王的荒淫行为相关——忠臣死谏/委婉劝导，或佞臣进献珍宝美人以迎合帝意。\n';
      }
    }

    prompt += '\n请为其中' + count + '人生成奏疏。\n\n';
    prompt += '【奏疏体裁】根据内容性质选择——\n';
    prompt += '  题本/奏本：正式官方文书，开头"臣某某谨题/谨奏为……事"，结尾"谨题/谨奏请旨"\n';
    prompt += '  上疏/疏奏：言路台谏建议性文书，开头"臣某某诚惶诚恐，稽首顿首，上疏曰"，敬辞密集\n';
    prompt += '  密折/密揭：亲信机密奏报，无固定格式但开头"臣某某密陈/密奏"，可含私心暗示\n';
    prompt += '【密折vs题本的制度区分——重要】\n';
    prompt += '  题本/上疏/表：经通政司正式渠道递交，其他官员知道"某某上了折子"（但不知内容）\n';
    prompt += '  密折/密揭：密封直达御前，不经通政司——其他官员完全不知此人上了折子\n';
    prompt += '  subtype字段必须准确：情报/告密/揭发/私人请求→密折；正式政务→题本；谏言建议→上疏；庆贺感恩→表\n';
    prompt += '【奏疏质量与NPC能力强关联——关键差异化】\n';
    prompt += '  智力高(>70)+政务高(>70)的NPC：奏疏逻辑严密、引经据典、条理清晰、方案可操作\n';
    prompt += '  智力中等(40-70)的NPC：奏疏基本通顺但观点平庸、建议笼统\n';
    prompt += '  智力低(<40)的NPC：奏疏逻辑混乱、抓不住重点、可能文不对题、方案不切实际\n';
    prompt += '  武将(军事高但政务低)写政务折：纸上谈兵或直来直去，措辞粗犷\n';
    prompt += '  文臣(政务高但军事低)写军务折：书生议兵，可能脱离实际\n';
    prompt += '  这种差异是给玩家"看人下折"的关键信号——帮助玩家判断谁可信谁不可信\n';
    prompt += '  表/笺：特别恭敬的上行文书，多用四六骈句，如谢恩表、贺表\n\n';
    prompt += '【正式奏疏的完整结构（必须遵守）】\n';
    prompt += '一、首称：\n';
    prompt += '   "臣某官某某，谨奏为某某事。"（题本格式）\n';
    prompt += '   或"臣某某诚惶诚恐，稽首顿首，谨上疏曰："（上疏格式）\n';
    prompt += '二、缘由：引经据典或追溯前因，说明为何上疏。\n';
    prompt += '   如："窃惟我朝立国以来……""臣闻古之圣王……""近日边报频传……"\n';
    prompt += '三、正论：陈述事实、分析利弊、提出主张。此为奏疏核心，应最为详尽。\n';
    prompt += '   可分条陈述："其一……其二……其三……"\n';
    prompt += '   或层层递进："今者……然则……况乎……"\n';
    prompt += '四、请旨：明确请求皇帝裁决或批准。\n';
    prompt += '   如："伏乞圣裁""伏望陛下俯准施行""请旨定夺"\n';
    prompt += '五、结语套语：\n';
    prompt += '   "臣不胜惶恐悚栗之至，谨具本奏闻。"\n';
    prompt += '   "臣诚惶诚恐，冒昧具陈，伏候圣鉴。"\n';
    prompt += '   "臣无任瞻天仰圣激切屏营之至。"\n\n';
    prompt += '【语气原则——关键叙事设计】\n';
    prompt += '  忠臣奏疏：内容正确但措辞冗长，让玩家感到"又被说教了"。反复劝说，引经据典，\n';
    prompt += '    以古讽今，道德绑架。"臣闻""臣恐""臣窃以为""伏望陛下""陛下不可不察"等出现多次。\n';
    prompt += '    越忠诚越絮叨——这正是帝王厌倦忠言的本质：正确但令人不快。\n';
    prompt += '  佞臣奏疏：让玩家读了心情好。简洁明快，奉承得体，主动替玩家着想分忧。\n';
    prompt += '    "臣已办妥""不劳圣虑""微臣不揣冒昧，略备薄礼"——内容空洞但读起来舒服。\n';
    prompt += '  野心者：表面恭顺，暗含自荐或排挤对手，言辞巧妙。\n';
    prompt += '  怨恨者：形恭实怨，隐晦批评，话中有话。\n\n';
    prompt += '【信息不对称——核心机制】玩家（皇帝）不是全知视角：\n';
    prompt += '  地方官夸大政绩/隐瞒灾情；武将虚报战功/隐瞒损失；\n';
    prompt += '  忠臣直言但视野有限；野心者编造信息陷害对手；\n';
    prompt += '  派系对立者描述同一事件互相矛盾。请自然体现偏差，不要标注。\n\n';
    prompt += '【字数与格式】\n';
    prompt += '  ※ 忠臣/谏官奏疏：' + _charRangeText('memLoyal') + '，越忠诚越长（让玩家体验"又臭又长"的忠言）\n';
    prompt += '  ※ 佞臣/普通奏疏：' + _charRangeText('memNormal') + '，简洁得体\n';
    prompt += '  ※ 密折：' + _charRangeText('memSecret') + '，言简意赅但暗含深意\n';
    prompt += '  ※ 全部使用文言（半文言亦可），善用四六骈句、对偶排比\n';
    prompt += '  ※ 奏疏正文中适当分段（每段一个论点），便于阅读\n';
    prompt += '\n【奏疏风格层叠差异化——5层依次叠加】\n';
    prompt += '  为每个上奏者，按以下5层依次计算其奏疏风格：\n';
    prompt += '  层1·能力基底：智力+政务决定分析深度和条理性。武勇(个人武力)≠军事(统兵指挥)≠文笔差\n';
    prompt += '  层2·学识修正：学识提供"引用库"——但引用是否切题取决于层1智力\n';
    prompt += '    学经学+智力低→引经据典但牵强附会；学兵法+智力高→军事分析精准\n';
    prompt += '  层3·五常+特质修正：决定"知道自己不擅长时怎么写"：\n';
    prompt += '    信高+坦诚→不写自己不懂的  信低+狡诈→不懂也写得头头是道\n';
    prompt += '    礼高→格式规范措辞谨慎  礼低→格式随意措辞粗犷\n';
    prompt += '  层4·信仰文化门第：影响措辞习惯，但可被高能力覆盖\n';
    prompt += '  层5·近期记忆经历：此人此刻的情绪——刚受赏=热切，刚被贬=冷淡或暗怨\n';
    prompt += '  重点：两个同为"武将"但智力85和35的人，奏疏天差地别\n';
    prompt += '  重点：高智+低武的文臣写军事奏疏→逻辑严密但脱离实际→纸上谈兵\n';
    prompt += '  层5·记忆影响奏疏态度：上奏者的"心绪"数据必须影响其奏疏基调\n';
    prompt += '    刚受赏→热切感恩；刚被贬→冷淡暗怨；丧亲中→悲切；有刻骨仇恨→可能借题发挥\n\n';
    // 续奏/联名/对奏/因果链指令
    prompt += '\u3010\u7EED\u594F\u4E0E\u56E0\u679C\u94FE\u3011\n';
    if (GM._approvedMemorials && GM._approvedMemorials.length > 0) {
      var _lastTurn = GM._approvedMemorials.filter(function(m) { return m.turn === GM.turn - 1; });
      if (_lastTurn.length > 0) {
        prompt += '\u4E0A\u56DE\u5408\u594F\u758F\u5904\u7406\u7ED3\u679C\uFF08\u672C\u56DE\u5408\u594F\u758F\u5FC5\u987B\u4E0E\u4E4B\u56E0\u679C\u5173\u8054\uFF09\uFF1A\n';
        var _aLbl = { approved:'\u51C6\u594F', rejected:'\u9A73\u56DE', annotated:'\u6279\u793A', referred:'\u8F6C\u6709\u53F8', court_debate:'\u53D1\u5EF7\u8BAE' };
        _lastTurn.forEach(function(m) {
          prompt += '  ' + (m.from||'') + '\u594F' + (m.type||'') + '\u2192' + (_aLbl[m.action]||'\u51C6\u594F');
          if (m.reply) prompt += '(\u6731\u6279:' + m.reply + ')';
          prompt += '\n';
        });
        prompt += '\u8981\u6C42\uFF1A\n';
        prompt += '  \u00B7 \u51C6\u594F\u7684\u2192\u5E94\u6709\u6267\u884C\u8FDB\u5C55\u6216\u65B0\u95EE\u9898\u7684\u594F\u62A5\n';
        prompt += '  \u00B7 \u9A73\u56DE\u7684\u2192\u5FE0\u81E3\u53EF\u80FD\u7EED\u594F\u6B7B\u8C0F\uFF08\u5FC5\u987B\u5F15\u7528\u4E0A\u6B21\u88AB\u9A73\u7684\u7406\u7531\u5E76\u52A0\u4EE5\u8FA9\u9A73\uFF09\uFF0C\u4F5E\u81E3\u53EF\u80FD\u8F6C\u800C\u6697\u4E2D\u6D3B\u52A8\n';
        prompt += '  \u00B7 \u6279\u793A\u7684\u2192\u5B98\u5458\u5E94\u6309\u6279\u793A\u6267\u884C\u540E\u56DE\u594F\u7ED3\u679C\n';
        prompt += '  \u00B7 \u8F6C\u6709\u53F8\u7684\u2192\u8BE5\u8861\u95E8\u4E3B\u5B98\u5E94\u4E0A\u594F\u8BAE\u5904\u7ED3\u8BBA\n';
      }
    }
    prompt += '\u3010\u8054\u540D\u4E0E\u5BF9\u594F\u3011\n';
    prompt += '\u00B7 \u591A\u540D\u5B98\u5458\u53EF\u8054\u540D\u4E0A\u4E66\uFF08from\u586B\u201C\u67D0\u67D0\u7B49N\u4EBA\u201D\uFF09\n';
    prompt += '\u00B7 \u5BF9\u540C\u4E00\u4E8B\u4EF6\uFF0C\u4E0D\u540C\u6D3E\u7CFB\u7684\u5B98\u5458\u53EF\u80FD\u4E0A\u5BF9\u7ACB\u7684\u594F\u758F\uFF0C\u7528relatedTo\u5B57\u6BB5\u6807\u6CE8\u5173\u8054\u7684\u53E6\u4E00\u4EFD\u594F\u758F\u7684from\n';

    // 演义模式紧急排序
    var _gameMode = (P.conf && P.conf.gameMode) || '';
    if (_gameMode === 'yanyi') {
      prompt += '\u3010\u6F14\u4E49\u6A21\u5F0F\u3011\u8BF7\u4E3A\u6BCF\u4EFD\u594F\u758F\u6DFB\u52A0priority\u5B57\u6BB5(urgent/normal)\uFF0C\u7D27\u6025\u519B\u60C5\u3001\u5929\u707E\u3001\u53DB\u4E71\u7B49\u4E3Aurgent\n';
    }

    // ── 远方NPC信息边界约束 ──
    prompt += '\n【远方NPC信息边界——绝对规则】\n';
    prompt += '标注[远方]的NPC，其奏疏内容只能基于其"最后知悉京城信息"时间点之前的信息。\n';
    prompt += '  例：某NPC最后知悉京城信息是3回合前→其奏疏不可提及此后发生的朝政变动、新任命、新诏令。\n';
    prompt += '  远方NPC的奏疏更可能涉及：本地军务/民情、边疆形势、请求增援/物资、弹劾同僚、个人陈情。\n';
    prompt += '  从未收到京城消息的NPC→只能写本地情况，不应评论朝政。\n';

    // ── 等回批→自行决断 ──
    var _waitingNpcs = [];
    var _cap3 = GM._capital || '京城';
    (GM._pendingMemorialDeliveries||[]).forEach(function(m) {
      if (m.status === 'intercepted') {
        // 计算合理往返时间：去程 + 批阅缓冲2回合 + 回程 = deliveryTurns*2 + 2
        var _expectedRound = ((m._deliveryTurn||0) - (m._generatedTurn||0)) * 2 + 2;
        var _waited = GM.turn - (m._generatedTurn||GM.turn);
        _waitingNpcs.push({ name: m.from, waited: _waited, expectedRound: _expectedRound, intercepted: true, location: m._remoteFrom||'远方' });
      }
    });
    // 检查已到达但未收到批复回传的奏疏
    (GM.memorials||[]).forEach(function(m) {
      if (m._remoteFrom && m._replyLetterSent && m._replyDeliveryTurn && GM.turn < m._replyDeliveryTurn) {
        _waitingNpcs.push({ name: m.from, waited: 0, awaitingReply: true, location: m._remoteFrom });
      }
      if (m._remoteFrom && !m._replyLetterSent && m.status !== 'pending' && m.status !== 'pending_review') {
        _waitingNpcs.push({ name: m.from, waited: GM.turn - (m._arrivedTurn||m.turn), location: m._remoteFrom });
      }
    });
    if (_waitingNpcs.length > 0) {
      prompt += '\n【等待回批的NPC——焦虑阈值基于实际往返路程】\n';
      _waitingNpcs.forEach(function(w) {
        if (w.intercepted) {
          var _overdue = w.waited > w.expectedRound;
          prompt += '  ' + w.name + '（' + w.location + '）：已等' + w.waited + '回合，合理往返约' + w.expectedRound + '回合';
          if (_overdue) {
            prompt += ' → ⚠ 已超期' + (w.waited - w.expectedRound) + '回合！NPC应体现焦虑或自行决断\n';
          } else {
            prompt += ' → 尚在合理等待期内，NPC不会焦虑\n';
          }
        } else if (w.awaitingReply) {
          prompt += '  ' + w.name + '（' + w.location + '）：朱批回传中→尚不知批复结果\n';
        }
      });
      prompt += '  焦虑/自行决断规则：只有等待时间超过合理往返时间后，NPC才会焦虑。\n';
      prompt += '  超期后→续奏询问"臣奏疏是否送达"；超期显著（超合理时间50%以上）→自行决断并上折禀告\n';
    }

    // ── 三通道使用指导 ──
    prompt += '\n【远方NPC三种通信渠道——选择指导】\n';
    prompt += '远方NPC上奏疏（本系统）：正式公务——军情汇报、弹劾、政策建议、请示裁决、陈情表态\n';
    prompt += '远方NPC写信（npc_letters）：非正式沟通——私人交情、紧急但不便走正式渠道、试探性建议\n';
    prompt += 'NPC间通信（npc_correspondence）：密谋串联、私下交易、情报交换——皇帝看不到但间谍可截获\n';
    prompt += '同一NPC同一话题不要同时走奏疏和来函两个渠道——选最合适的一个。\n';

    prompt += '\u8FD4\u56DEJSON: [{"from":"\u89D2\u8272\u540D","title":"\u5B98\u804C","type":"\u653F\u52A1|\u519B\u52A1|\u6C11\u751F|\u7ECF\u6D4E|\u4EBA\u4E8B|\u5BC6\u594F","subtype":"\u9898\u672C|\u4E0A\u758F|\u5BC6\u6298|\u8868","content":"\u594F\u758F\u5168\u6587","reliability":"high|medium|low","bias":"none|self_serving|factional|ignorance|deception","relatedTo":"\u5173\u8054\u7684\u53E6\u4E00\u4EFD\u594F\u758F\u7684from(\u53EF\u9009)","priority":"urgent|normal(\u6F14\u4E49\u6A21\u5F0F\u65F6\u586B)"}]';

    var c = await callAISmart(prompt, 16000, {
      minLength: 600,
      maxRetries: 3,
      validator: function(content) {
        var parsed = extractJSON(content);
        if (!Array.isArray(parsed) || parsed.length < Math.min(count, 2)) return false;
        // 检查奏疏内容长度——至少150字（短奏疏）
        var tooShort = parsed.filter(function(m) { return !m.content || m.content.length < 150; });
        var _memMinThreshold = _getCharRange('memSecret')[0]; // 用密折最低值做下限
        if (tooShort.length > parsed.length / 2) return { valid: false, reason: '奏疏字数不足，最低' + _memMinThreshold + '字' };
        return true;
      }
    });
    var parsed = extractJSON(c);
    if (Array.isArray(parsed)) {
      var capital = GM._capital || '京城';
      var localMems = [];
      parsed.slice(0, count).forEach(function(m) {
        var mem = { id: uid(), from: m.from || '', title: m.title || '', type: m.type || '\u653F\u52A1', subtype: m.subtype || '\u9898\u672C', content: m.content || '', status: 'pending', turn: GM.turn, reply: '', reliability: m.reliability || 'medium', bias: m.bias || 'none', relatedTo: m.relatedTo || '', priority: m.priority || 'normal' };
        // 检查上奏者是否在京城
        var ch = findCharByName(mem.from);
        var isRemote = ch && ch.alive !== false && ch.location && ch.location !== capital;
        if (isRemote) {
          // 远方NPC奏疏——进入驿递队列
          mem._remoteFrom = ch.location;
          mem._generatedTurn = GM.turn;
          var days = (typeof calcLetterDays === 'function') ? calcLetterDays(ch.location, capital, 'normal') : 5;
          var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
          mem._deliveryTurn = GM.turn + Math.max(1, Math.ceil(days / dpv));
          mem.status = 'in_transit';
          // 截获判定
          var _gMode = (P.conf && P.conf.gameMode) || '';
          var _canIntercept = _gMode === 'strict_hist' || _gMode === 'light_hist';
          if (_canIntercept) {
            var _hostileFacs = (GM.facs||[]).filter(function(f){ return !f.isPlayer && (f.playerRelation||0) < -50; });
            var _interceptRate = 0.03; // 奏疏经通政司官方渠道，截获率远低于私信
            if (_hostileFacs.length > 0) _interceptRate += 0.08;
            if (typeof _ltIsRouteBlocked === 'function' && _ltIsRouteBlocked(ch.location, capital)) _interceptRate += 0.25;
            // 敌占区检查
            var _inHostile = (GM.facs||[]).some(function(f) {
              if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
              var _t = f.territories || f.territory || [];
              if (typeof _t === 'string') _t = [_t];
              return _t.indexOf(ch.location) >= 0;
            });
            if (_inHostile) _interceptRate += 0.20;
            if (Math.random() < _interceptRate) {
              mem.status = 'intercepted';
              var _int = _hostileFacs.length > 0 ? _hostileFacs[Math.floor(Math.random()*_hostileFacs.length)].name : '不明势力';
              mem._interceptedBy = _int;
              // 敌方获知情报
              if (!GM._interceptedIntel) GM._interceptedIntel = [];
              GM._interceptedIntel.push({
                turn: GM.turn, interceptor: _int,
                from: mem.from, to: '皇帝',
                content: '截获奏疏：' + (mem.content||'').slice(0,80),
                urgency: 'memorial', letterType: 'report'
              });
              if (typeof addEB === 'function') addEB('传书', mem.from + '的奏疏信使失踪');
            }
          }
          // NPC记住自己上了什么折子
          if (mem.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
            NpcMemorySystem.remember(mem.from, '向天子上奏疏：' + (mem.content||'').slice(0,60), '平', 6);
          }
          if (!GM._pendingMemorialDeliveries) GM._pendingMemorialDeliveries = [];
          GM._pendingMemorialDeliveries.push(mem);
        } else {
          // 在京NPC——立即可批复
          localMems.push(mem);
        }
      });
      GM.memorials = localMems;
    }
  } catch(e) { console.warn('[genMemorialsAI]', e.message || e); }
  renderMemorials();
}
function renderMemorials(){
  var el=_$("zouyi-list");if(!el)return;
  var _isYanyi = P.conf && P.conf.gameMode === 'yanyi';

  // 在途奏疏提示（保留）
  var _transitMems = (GM._pendingMemorialDeliveries||[]).filter(function(m) { return m.status === 'in_transit'; });
  var _transitHtml = '';
  if (_transitMems.length > 0) {
    _transitHtml = '<div class="mem-transit"><div class="mem-transit-icon">\u9A7F</div>'
      + '<div><span class="lbl">\u9A7F \u7AD9 \u6765 \u62A5 \uFF1A</span>\u5C1A\u6709 <strong style="color:var(--amber-400);">' + _transitMems.length + '</strong> \u4EFD\u594F\u758F\u5728\u9014\u3002</div></div>';
  }

  // 渲染本回合全部奏疏
  var visible=GM.memorials.filter(function(m){return m.turn===GM.turn || m.status==="pending" || m.status==="pending_review";});
  if(visible.length===0){
    el.innerHTML=_transitHtml + '<div class="mem-empty">\u6848\u724D\u6E05\u51C0\u3000\u767E\u5B98\u65E0\u4E8B\u542F\u594F</div>';
    return;
  }

  // 按组分类
  var gUrgent = [], gPending = [], gHeld = [], gDone = [];
  visible.forEach(function(m){
    if (m.status === 'pending_review') gHeld.push(m);
    else if (m.status === 'approved' || m.status === 'rejected' || m.status === 'annotated' || m.status === 'referred' || m.status === 'court_debate') gDone.push(m);
    else if (m.priority === 'urgent') gUrgent.push(m);
    else gPending.push(m);
  });

  // 渲染单张卡片
  function _renderCard(m) {
    var idx = GM.memorials.indexOf(m);
    var isHeld = m.status === 'pending_review';
    var isSystem = !m.from || m.from === '\u6709\u53F8';
    var _sender = isSystem ? null : findCharByName(m.from);

    // 卡片色条（按忠诚+可信度+紧急度）
    var _mcCls = 'mem-c-normal';
    if (m.priority === 'urgent') _mcCls = 'mem-c-danger';
    else if (_isYanyi && m.reliability === 'low') _mcCls = 'mem-c-suspect';
    else if (_sender) {
      var _loy = _sender.loyalty || 50;
      if (_loy < 25) _mcCls = 'mem-c-danger';
      else if (_loy < 40) _mcCls = 'mem-c-suspect';
      else if (_loy >= 75) _mcCls = 'mem-c-loyal';
    }

    // 头像
    var _initial = escHtml(String(m.from||'?').charAt(0));
    var _portrait = (_sender && _sender.portrait) ? '<img src="'+escHtml(_sender.portrait)+'">' : _initial;

    // 官衔（从 sender 官职 或 m.title）
    var _subTitle = '';
    if (_sender && _sender.officialTitle) _subTitle = _sender.officialTitle;
    else if (_sender && _sender.title) _subTitle = _sender.title;
    else if (m.title) _subTitle = m.title;

    // 状态徽记
    var _badges = '';
    if (m.priority === 'urgent') _badges += '<span class="mem-badge mem-badge-urgent">\u6025</span>';
    if (_isYanyi && m.reliability === 'low') _badges += '<span class="mem-badge mem-badge-reliab" title="\u6B64\u594F\u758F\u53EF\u4FE1\u5EA6\u53EF\u7591">\u26A0 \u5B58\u7591</span>';
    if (_isYanyi && m.reliability === 'medium') _badges += '<span class="mem-badge" style="color:var(--gold-400);background:rgba(184,154,83,0.08);border-color:var(--gold-400);">? \u5F85\u8BC1</span>';
    if (m.status === 'pending_review') _badges += '<span class="mem-badge mem-badge-held">\u7559\u4E2D</span>';
    if (m.status === 'approved') _badges += '<span class="mem-badge mem-badge-approved">\u2713 \u5DF2\u51C6\u594F</span>';
    if (m.status === 'rejected') _badges += '<span class="mem-badge mem-badge-rejected">\u2717 \u5DF2\u9A73\u56DE</span>';
    if (m.status === 'annotated') _badges += '<span class="mem-badge mem-badge-annotated">\u270E \u5DF2\u6279\u793A</span>';
    if (m.status === 'referred') _badges += '<span class="mem-badge mem-badge-referred">\u2192 \u5DF2\u8F6C</span>';
    if (m.status === 'court_debate') _badges += '<span class="mem-badge mem-badge-court">\u2696 \u5EF7\u8BAE</span>';
    if (m._remoteFrom) {
      _badges += '<span class="mem-badge mem-badge-remote" title="\u6B64\u6298\u7ECF\u9A7F\u7AD9\u81EA' + escHtml(m._remoteFrom) + '\u9012\u8FBE">\u9A7F\u9012\u81EA' + escHtml(m._remoteFrom) + '</span>';
      if (m._replyLetterSent) {
        var _replyArrived = m._replyDeliveryTurn && GM.turn >= m._replyDeliveryTurn;
        _badges += _replyArrived
          ? '<span class="mem-badge" style="color:var(--celadon-400);background:rgba(106,154,127,0.1);border-color:var(--celadon-400);">\u6731\u6279\u5DF2\u9001\u8FBE</span>'
          : '<span class="mem-badge" style="color:var(--ink-300);background:rgba(107,93,71,0.08);border-color:var(--ink-300);">\u6731\u6279\u56DE\u4F20\u4E2D\u2026</span>';
      }
    }

    // 类型 pill
    var _typeLabel = (m.type||'\u594F\u758F') + (m.subtype ? '\u00B7' + m.subtype : '');
    var _typePill = '<span class="mem-type-pill">' + escHtml(_typeLabel) + '</span>';

    // 正文
    var _contentText = m.content || '';
    var _contentHtml;
    if (_contentText.length > 180) {
      var memBodyId = 'mem-body-' + idx;
      _contentHtml = '<div class="mem-body collapsed wd-selectable" id="' + memBodyId + '">' + escHtml(_contentText) + '</div>'
        + '<button class="mem-toggle" onclick="var b=document.getElementById(\''+memBodyId+'\');var col=b.classList.toggle(\'collapsed\');this.textContent=col?\'\u25BC \u5C55\u5F00\u5168\u6587\':\'\u25B2 \u6536\u8D77\';">\u25BC \u5C55\u5F00\u5168\u6587</button>';
    } else {
      _contentHtml = '<div class="mem-body wd-selectable">' + escHtml(_contentText) + '</div>';
    }

    // 侨置决策按钮（特殊场景）
    var _qiaozhi = m._qiaozhiTarget
      ? '<div style="margin-top:10px;"><button class="mem-btn" style="--ab:var(--gold-400);background:linear-gradient(to bottom,var(--gold-400),var(--gold-500));color:var(--bg-1);" onclick="openQiaozhiPanel(\''+escHtml(m._qiaozhiTarget||'').replace(/'/g,'')+'\')">\u4FA8\u7F6E\u51B3\u7B56</button></div>'
      : '';

    // 朱笔批注
    var _reply = '<div class="mem-reply-wrap">'
      + '<div class="mem-reply-label">\u6731 \u7B14 \u6279 \u6CE8</div>'
      + '<textarea id="mem-reply-'+idx+'" class="mem-reply-input" rows="2" placeholder="\u5FA1\u7B14\u6731\u6279\uFF0C\u53EF\u76F4\u63A5\u4E0B\u8BCF\u6216\u9644\u8BED\u2026\u2026">'+escHtml(m.reply||'')+'</textarea>'
      + '</div>';

    // 操作按钮
    var _acts = '<div class="mem-actions">'
      + '<button class="mem-btn approve" onclick="_approveMemorial('+idx+')"><span class="ic">\u2713</span> \u51C6\u3000\u594F</button>'
      + '<button class="mem-btn reject" onclick="_rejectMemorial('+idx+')"><span class="ic">\u2717</span> \u9A73\u3000\u56DE</button>'
      + '<button class="mem-btn annotate" onclick="_annotateMemorial('+idx+')"><span class="ic">\u270E</span> \u6279\u793A\u610F\u89C1</button>'
      + '<button class="mem-btn refer" onclick="_referMemorial('+idx+')"><span class="ic">\u2192</span> \u8F6C\u4EA4\u6709\u53F8</button>'
      + '<button class="mem-btn court" onclick="_courtDebateMemorial('+idx+')"><span class="ic">\u2696</span> \u53D1\u5EF7\u8BAE</button>'
      + (isHeld?'':'<button class="mem-btn hold" onclick="_holdMemorial('+idx+')"><span class="ic">\u23F8</span> \u7559\u3000\u4E2D</button>')
      + '<button class="mem-btn excerpt" onclick="_memExcerptToEdict('+idx+')" title="\u5212\u9009\u594F\u758F\u6587\u5B57\u6458\u5165\u5EFA\u8BAE\u5E93"><span class="ic">\u2398</span> \u6458\u3000\u5165</button>'
      + (isSystem?'':'<button class="mem-btn summon" onclick="_summonForMemorial('+idx+')"><span class="ic">\u2604</span> \u4F20\u53EC\u95EE\u8BAF</button>')
      + '</div>';

    return '<div class="mem-card ' + _mcCls + '"' + (isHeld?' style="opacity:0.82;"':'') + '>'
      + '<div class="mem-card-hdr">'
        + '<div class="mem-portrait">' + _portrait + '</div>'
        + '<div class="mem-from-wrap">'
          + '<div class="mem-from">' + escHtml(m.from||'\u6709\u53F8') + '</div>'
          + '<div class="mem-from-title">' + escHtml(_subTitle) + '</div>'
        + '</div>'
        + '<div class="mem-badges">' + _badges + '</div>'
        + _typePill
      + '</div>'
      + '<div class="mem-body-label">\u672C \u3000 \u594F</div>'
      + _contentHtml
      + _qiaozhi
      + _reply
      + _acts
      + '</div>';
  }

  var html = _transitHtml;
  if (gUrgent.length > 0) {
    html += '<div class="mem-group mem-g-urgent">';
    html += '<div class="mem-group-title"><span class="tag">\u6025 \u594F \u5F85 \u6279</span><span class="desc">\u52A0\u6025\u00B7\u544A\u53D8\u00B7\u8FB9\u4E8B\u6025\u62A5\uFF0C\u5B9C\u901F\u88C1\u51B3</span><span class="count">' + gUrgent.length + ' \u6298</span></div>';
    gUrgent.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }
  if (gPending.length > 0) {
    html += '<div class="mem-group mem-g-pending">';
    html += '<div class="mem-group-title"><span class="tag">\u767E \u5B98 \u542F \u594F</span><span class="desc">\u5F85\u6279\u00B7\u5F85\u6279\u793A\u00B7\u5F85\u8F6C\u4EA4</span><span class="count">' + gPending.length + ' \u6298</span></div>';
    gPending.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }
  if (gHeld.length > 0) {
    html += '<div class="mem-group mem-g-held">';
    html += '<div class="mem-group-title"><span class="tag">\u7559 \u4E2D \u4E4B \u6298</span><span class="desc">\u6682\u641C\u7F6E\u00B7\u5019\u65F6\u673A\u00B7\u6216\u89C2\u671B\u4E8B\u52BF</span><span class="count">' + gHeld.length + ' \u6298</span></div>';
    gHeld.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }
  if (gDone.length > 0) {
    html += '<div class="mem-group mem-g-done">';
    html += '<div class="mem-group-title"><span class="tag">\u5DF2 \u6279 \u6863 \u6848</span><span class="desc">\u672C\u56DE\u5408\u5DF2\u5904\u7406\u00B7\u53EF\u518D\u6B21\u4FEE\u8BA2</span><span class="count">' + gDone.length + ' \u6298</span></div>';
    gDone.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }

  el.innerHTML = html;
}

/** 奏疏划选摘入建议库（同问对流程） */
function _memExcerptToEdict(idx) {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('请先在奏疏中划选要摘录的文字'); return; }
  var m = GM.memorials[idx];
  var from = m ? (m.from || '?') : '?';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '奏疏', from: from, content: text, turn: GM.turn, used: false });
  toast('已摘入诏书建议库');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

// 奏疏批复——不直接改变NPC数值，只写入记忆+记录，数值变化由AI在回合推演中根据累积情况判断
/** 批复远方NPC的奏疏→自动生成回传信件（驿递延迟） */
function _memorialSendReply(m, actionLabel) {
  if (!m || !m._remoteFrom || !m.from) return;
  var ch = findCharByName(m.from);
  if (!ch || !ch.location) return;
  var capital = GM._capital || '京城';
  if (ch.location === capital) return; // 在京无需传书
  var days = (typeof calcLetterDays === 'function') ? calcLetterDays(capital, ch.location, 'urgent') : 3;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
  var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
  var replyContent = '【朱批回传】' + actionLabel + '。' + (m.reply ? '御批：' + m.reply : '');
  var letter = {
    id: (typeof uid === 'function') ? uid() : 'lt_' + Date.now(),
    from: '玩家', to: m.from,
    fromLocation: capital, toLocation: ch.location,
    content: replyContent,
    sentTurn: GM.turn,
    deliveryTurn: GM.turn + deliveryTurns,
    replyTurn: GM.turn + deliveryTurns + 1,
    reply: '', status: 'traveling',
    urgency: 'urgent', letterType: 'formal_edict',
    _memorialReply: true, _memorialId: m.id
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(letter);
  m._replyLetterSent = true;
  m._replyDeliveryTurn = GM.turn + deliveryTurns;
  if (typeof toast === 'function') toast('朱批已遣加急驿递回传' + m.from + '，约' + Math.ceil(deliveryTurns * ((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15)) + '日后送达');
}

/** 暂存奏疏决定（允许反复修改，末回合提交才落实 NPC 记忆/回传） */
function _stageMemorialDecision(m, action, reply, extra) {
  if (!m) return;
  m.status = action;
  m.reply = reply || '';
  if (extra && extra._referredTo) m._referredTo = extra._referredTo;
  // 清除已提交标记——玩家回合内改变决定后，commit 时重新处理
  m._commitApplied = false;
  if (!GM._approvedMemorials) GM._approvedMemorials = [];
  GM._approvedMemorials = GM._approvedMemorials.filter(function(a) { return !(a.from === m.from && a.turn === GM.turn && a.content === (m.content || '')); });
  var entry = { from: m.from, type: m.type, content: m.content || '', turn: GM.turn, reply: m.reply, action: action };
  if (extra && extra._referredTo) entry.referredTo = extra._referredTo;
  GM._approvedMemorials.push(entry);
  if (GM._approvedMemorials.length > 30) GM._approvedMemorials.shift();
}

function _approveMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '';
  _stageMemorialDecision(m, 'approved', reply);
  renderMemorials();
  toast('\u51C6\u594F\uFF08\u672A\u63D0\u4EA4\uFF0C\u8FC7\u56DE\u5408\u751F\u6548\uFF09');
}

function _rejectMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '';
  _stageMemorialDecision(m, 'rejected', reply);
  renderMemorials();
  toast('\u9A73\u56DE\uFF08\u672A\u63D0\u4EA4\uFF0C\u8FC7\u56DE\u5408\u751F\u6548\uFF09');
}

// 批示意见——准其部分驳其部分，朱笔批注为核心
function _annotateMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '';
  if (!reply) { toast('\u8BF7\u5148\u5728\u6731\u7B14\u6279\u6CE8\u4E2D\u5199\u660E\u5177\u4F53\u610F\u89C1'); return; }
  _stageMemorialDecision(m, 'annotated', reply);
  renderMemorials();
  toast('\u5DF2\u6279\u793A\uFF08\u672A\u63D0\u4EA4\uFF0C\u8FC7\u56DE\u5408\u751F\u6548\uFF09');
}

// 转交有司——着该部议处
function _referMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  // 弹窗选择批转对象
  var _playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'京城');
  var _candidates = (GM.chars||[]).filter(function(c) {
    return c.alive !== false && !c.isPlayer && c.name !== m.from && (c.location === _playerLoc || !c.location);
  });
  // 按品级排序
  _candidates.sort(function(a,b) {
    var ra = typeof getRankLevel === 'function' ? getRankLevel(a.officialTitle||'') : 99;
    var rb = typeof getRankLevel === 'function' ? getRankLevel(b.officialTitle||'') : 99;
    return ra - rb;
  });
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:400px;max-height:70vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-2);">批转此折给——</div>';
  _candidates.slice(0, 15).forEach(function(c) {
    html += '<div style="padding:var(--space-1) var(--space-2);background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-sm);margin-bottom:var(--space-1);cursor:pointer;font-size:var(--text-xs);" onclick="_doReferMemorial(' + idx + ',\'' + escHtml(c.name).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">'
      + '<span style="font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>'
      + '<span style="color:var(--ink-300);margin-left:4px;">' + escHtml(c.officialTitle||c.title||'') + '</span>'
      + '</div>';
  });
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _doReferMemorial(idx, referTo) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '着' + referTo + '议处';
  _stageMemorialDecision(m, 'referred', reply, { _referredTo: referTo });
  renderMemorials();
  toast('已批转给' + referTo + '（未提交，过回合生效）');
}

// 发廷议——交群臣公议，触发朝议
function _courtDebateMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '\u7740\u5EF7\u8BAE';
  _stageMemorialDecision(m, 'court_debate', reply);
  renderMemorials();

  // 将奏疏内容作为朝议议题——先写入议题输入框再启动
  if (typeof startChaoyiSession === 'function') {
    var _cyInput = _$('cy-topic-input');
    if (_cyInput) _cyInput.value = '\u594F\u758F\u8BAE\u9898\uFF1A' + (m.content || '').slice(0, 200);
    startChaoyiSession();
  } else {
    toast('\u671D\u8BAE\u6A21\u5757\u672A\u52A0\u8F7D');
  }
  toast('\u5DF2\u53D1\u4EA4\u5EF7\u8BAE\uFF08\u8FC7\u56DE\u5408\u65F6\u63D0\u4EA4\uFF09');
}

function _holdMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '\u518D\u8BAE';
  m.status = 'pending_review';
  m.reply = reply;
  m._commitApplied = false;
  renderMemorials();
  toast('\u7559\u4E2D\u4E0D\u53D1\uFF08\u672A\u63D0\u4EA4\uFF09');
}

/**
 * 末回合前 commit 所有本回合奏疏决定的副作用（NPC 记忆+回传朱批）
 * 被 endTurn 在 AI 推演前调用一次
 */
function _commitMemorialDecisions() {
  if (!Array.isArray(GM.memorials)) return;
  GM.memorials.forEach(function(m) {
    if (!m || m._commitApplied) return;
    // 只 commit 本回合或早期被改决定的
    if (m.turn != null && m.turn > GM.turn) return;
    var status = m.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'annotated' && status !== 'referred' && status !== 'court_debate') return;
    var actionLbl = status === 'approved' ? '所奏准奏'
                  : status === 'rejected' ? '所奏驳回'
                  : status === 'annotated' ? '朱笔批注'
                  : status === 'referred' ? ('着' + (m._referredTo||'有司') + '议处')
                  : '已发交廷议';
    var memoryLbl = status === 'approved' ? '被准奏'
                  : status === 'rejected' ? '被驳回'
                  : status === 'annotated' ? ('被朱批批示：' + (m.reply||''))
                  : status === 'referred' ? ('被批转给' + (m._referredTo||'有司') + '议处')
                  : '被发交廷议';
    if (m.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var memText = '\u6240\u4E0A\u594F\u758F\u300C' + (m.content || '').slice(0, 30) + '\u300D' + memoryLbl;
      if (status !== 'annotated' && m.reply) memText += '\uFF0C\u6731\u6279\uFF1A' + m.reply;
      try { NpcMemorySystem.remember(m.from, memText, '\u5E73', 5); } catch(e){}
      // referred 也给被转交者留一条记忆
      if (status === 'referred' && m._referredTo) {
        try { NpcMemorySystem.remember(m._referredTo, '\u7687\u5E1D\u5C06' + (m.from||'某人') + '\u7684\u594F\u758F\u6279\u8F6C\u7ED9\u81EA\u5DF1\u8BAE\u5904', '\u5E73', 4); } catch(e){}
      }
    }
    try { if (typeof _memorialSendReply === 'function') _memorialSendReply(m, actionLbl); } catch(e){}
    m._commitApplied = true;
  });
}

// 传召问询——从奏疏直接召唤上奏者对话（远方NPC改为遣使问询）
function _summonForMemorial(memIdx){
  var m=GM.memorials[memIdx];
  if(!m||!m.from)return;
  var ch=findCharByName(m.from);
  if(!ch){toast('找不到此人');return;}
  var capital = GM._capital || '京城';
  if (ch.location && ch.location !== capital) {
    // 远方NPC——无法面询，提供三个选项
    var bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
    bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.5rem 2rem;max-width:380px;text-align:center;">'
      + '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-3);">' + escHtml(m.from) + '远在' + escHtml(ch.location) + '，无法当面问询</div>'
      + '<div style="display:flex;flex-direction:column;gap:var(--space-2);">'
      + '<button class="bt bp" onclick="GM._pendingLetterTo=\'' + m.from.replace(/'/g,"\\'") + '\';switchGTab(null,\'gt-letter\');this.closest(\'div[style*=fixed]\').remove();">鸿雁传书——遣使问询</button>'
      + '<button class="bt bs" onclick="_summonRecall(\'' + m.from.replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">召回京师——当面奏对</button>'
      + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>'
      + '</div></div>';
    document.body.appendChild(bg);
    return;
  }
  // 在京NPC——直接问对
  openWenduiModal(m.from, 'formal', '朕阅你奏疏，所奏之事须当面详禀。');
}
/** 召回远方NPC回京 */
function _summonRecall(name) {
  var ch = findCharByName(name);
  if (!ch) return;
  var capital = GM._capital || '京城';
  var days = (typeof calcLetterDays === 'function') ? calcLetterDays(capital, ch.location, 'urgent') : 5;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
  var travelTurns = Math.max(1, Math.ceil(days * 2 / dpv)); // 来回=信使到+人赶路
  ch._travelTo = capital;
  ch._travelFrom = ch.location;
  ch._travelArrival = GM.turn + travelTurns;
  // 先派信使通知
  var letter = {
    id: (typeof uid === 'function') ? uid() : 'lt_' + Date.now(),
    from: '玩家', to: name,
    fromLocation: capital, toLocation: ch.location,
    content: '着' + name + '即刻回京面圣，所奏之事当面详禀。',
    sentTurn: GM.turn, deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
    replyTurn: GM.turn + travelTurns,
    reply: '', status: 'traveling', urgency: 'urgent', letterType: 'formal_edict',
    _recallOrder: true
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(letter);
  // 编年·召回启程
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  GM._chronicle.unshift({
    turn: GM.turn,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '\u5FB4\u53EC\u56DE\u4EAC',
    title: name + ' \u5956\u65E8\u56DE\u4EAC',
    content: name + ' \u81EA' + ch.location + ' \u5956\u65E8\u8D77\u7A0B\u56DE\u4EAC\u9762\u5723\u00B7\u9884\u8BA1 ' + Math.ceil(travelTurns * dpv) + ' \u65E5\uFF08' + travelTurns + ' \u56DE\u5408\uFF09\u62B5\u4EAC\u3002',
    category: '\u4EBA\u4E8B', tags: ['人事', '召回', '启程', name]
  });
  if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
  GM.qijuHistory.unshift({
    turn: GM.turn, date: GM._gameDate || '',
    content: '\u3010\u5FB4\u53EC\u3011' + name + ' \u5956\u65E8\u81EA' + ch.location + ' \u56DE\u4EAC\u00B7\u9884\u8BA1 ' + Math.ceil(travelTurns * dpv) + ' \u65E5\u62B5\u8FBE\u3002'
  });
  // 也设新字段以便 v10 pos card 显示
  ch._travelTo = capital;
  ch._travelFrom = ch.location;
  ch._travelStartTurn = GM.turn;
  ch._travelRemainingDays = days;
  ch._travelArrival = GM.turn + travelTurns;
  ch._travelReason = '奉诏召回面圣';
  toast(name + '已奉旨启程回京，约' + Math.ceil(travelTurns * dpv) + '日后抵达');
}

// ============================================================
//  问对（弹窗模式）
// ============================================================
var _wenduiMode = 'formal';
var _wenduiSending = false;

/**
 * 渲染问对面板中的角色网格（仅在京臣子可点击）
 */
function renderWenduiChars(){
  var el=_$("wendui-chars");if(!el)return;
  var atCap = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer && _wdIsAtCapital(c);});
  var away = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer && !_wdIsAtCapital(c);});
  var html = '';

  // 工具：根据角色推断卡片左边色类
  function _wdCardClass(ch) {
    var t = (ch.title || '') + ' ' + (ch.officialTitle || '');
    if (ch.spouse) return 'wdp-consort';
    if (/\u4E1C\u5382|\u53F8\u793C|\u5B98|\u592A\u76D1/.test(t)) return 'wdp-eunuch'; // 宦官
    if (/\u5C06\u519B|\u603B\u5175|\u603B\u7763|\u6307\u6325|\u6307\u6325\u4F7F/.test(t)) return 'wdp-mili'; // 武将
    if (ch.party === '\u4E1C\u6797\u515A' || ch.faction === '\u4E1C\u6797') return 'wdp-dongin';
    if (ch.party && /\u6D59/.test(ch.party)) return 'wdp-zhejian';
    return 'wdp-civil';
  }
  // 工具：忠诚色
  function _wdLoyClass(loy) {
    var v = Number(loy) || 50;
    if (v >= 75) return 'wdp-loy-hi';
    if (v >= 45) return 'wdp-loy-mid';
    return 'wdp-loy-lo';
  }
  // 工具：派系标签
  function _wdFactionTag(ch) {
    if (ch.spouse) return '<span class="wdp-tag" style="color:var(--vermillion-300);">\u5BAB\u773B</span>';
    if (ch.party) return '<span class="wdp-tag" style="color:var(--celadon-400);">' + escHtml(String(ch.party).slice(0,4)) + '</span>';
    if (ch.faction && ch.faction !== '\u671D\u5EF7') return '<span class="wdp-tag" style="color:var(--indigo-400);">' + escHtml(String(ch.faction).slice(0,4)) + '</span>';
    if (/\u5C06\u519B|\u603B\u5175|\u603B\u7763/.test(ch.title||'')) return '<span class="wdp-tag" style="color:var(--vermillion-400);">\u6B66\u5C06</span>';
    if (/\u53F8\u793C|\u592A\u76D1/.test(ch.title||'')) return '<span class="wdp-tag" style="color:var(--purple-400,#8e6aa8);">\u5BA6\u5B98</span>';
    return '';
  }

  // 【阶下待见】使节/外藩/AI推送
  if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences.length > 0) {
    html += '<div class="wdp-group wdp-g-envoy">';
    html += '<div class="wdp-group-title"><span class="tag">\u9636 \u4E0B \u5F85 \u89C1</span><span class="desc">\u4F7F\u8282\u00B7\u5916\u85E9\u00B7\u7279\u8BF7\u00B7\u7B49\u5F85\u9661\u4E0B\u51B3\u65AD</span><span class="count">' + GM._pendingAudiences.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-req-list">';
    GM._pendingAudiences.forEach(function(q, qi) {
      var _nm = escHtml(q.name || '?');
      var _initial = escHtml(String(q.name||'?').charAt(0));
      var _envoyB = q.isEnvoy ? '<span class="wdp-envoy-badge">\u4F7F\u8282</span>' : '';
      html += '<div class="wdp-req-item">';
      html += '<div class="wdp-req-portrait">' + _initial + _envoyB + '</div>';
      html += '<div class="wdp-req-info"><div class="wdp-req-name">' + _nm + '</div><div class="wdp-req-reason">' + escHtml((q.reason || '').substring(0, 80)) + '</div></div>';
      html += '<div class="wdp-req-actions">';
      html += '<button class="wdp-req-btn" onclick="_wdOpenAudienceQueue(' + qi + ')">\u63A5\u89C1</button>';
      html += '<button class="wdp-req-btn dismiss" onclick="_wdDismissPending(' + qi + ')">\u6682\u5374</button>';
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  // 【有臣求见】朱砂高亮
  var _seekAudience = atCap.filter(function(c) {
    if (c.isPlayer) return false;
    if (c._mourning) return false;
    if (c._lastMetTurn === GM.turn) return false;
    if ((c.loyalty || 50) > 90 && (c.stress || 0) > 30) return true;
    if ((c.ambition || 50) > 80 && (c.loyalty || 50) > 60) return true;
    if ((c.stress || 0) > 60) return true;
    if (GM.letters) {
      var _hasUn = GM.letters.some(function(l) { return l._npcInitiated && l.from === c.name && l._replyExpected && !l._playerReplied && l.status === 'returned'; });
      if (_hasUn) return true;
    }
    return false;
  });
  if (_seekAudience.length > 0) {
    html += '<div class="wdp-group wdp-g-seeking">';
    html += '<div class="wdp-group-title"><span class="tag">\u6709 \u81E3 \u6C42 \u89C1</span><span class="desc">\u5FE0\u6781\u9AD8\u6216\u5FC3\u6709\u5FE7\u4E8B\u8005\u00B7\u53EF\u901F\u89C1\u4EE5\u5B89\u5176\u5FC3</span><span class="count">' + _seekAudience.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-req-list">';
    _seekAudience.forEach(function(ch) {
      var reason = '';
      if ((ch.stress||0) > 60) reason = '\u9762\u5E26\u5FE7\u8272\uFF0C\u4F3C\u6709\u4E3A\u96BE\u4E4B\u4E8B';
      else if ((ch.loyalty||50) > 90 && (ch.stress||0) > 30) reason = '\u795E\u8272\u51DD\u91CD\uFF0C\u6B32\u8FDB\u5FE0\u8A00';
      else if ((ch.ambition||50) > 80) reason = '\u7CBE\u795E\u6296\u64DE\uFF0C\u6B32\u5448\u7B56\u8BBA';
      else reason = '\u5019\u4E8E\u6BBF\u5916\uFF0C\u8BF7\u6C42\u9762\u5723';
      if (GM.letters && GM.letters.some(function(l) { return l._npcInitiated && l.from === ch.name && l._replyExpected && !l._playerReplied && l.status === 'returned'; })) {
        reason = '\u524D\u65E5\u6765\u51FD\u672A\u83B7\u56DE\u590D\uFF0C\u4EB2\u81F3\u6C42\u89C1';
      }
      var _safeName = ch.name.replace(/'/g, "\\'");
      var _initial = escHtml(String(ch.name||'?').charAt(0));
      var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
      html += '<div class="wdp-req-item">';
      html += '<div class="wdp-req-portrait">' + _portraitHtml + '</div>';
      html += '<div class="wdp-req-info"><div class="wdp-req-name">' + escHtml(ch.name) + '</div><div class="wdp-req-reason">' + reason + '</div></div>';
      html += '<div class="wdp-req-actions">';
      html += '<button class="wdp-req-btn" onclick="_wdOpenAudience(\'' + _safeName + '\')">\u63A5\u89C1</button>';
      html += '<button class="wdp-req-btn dismiss" onclick="_wdDenyAudience(\'' + _safeName + '\')">\u4E0D\u89C1</button>';
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  // 【百官候旨】卡片网格
  var _nonSeeking = atCap.filter(function(c) { return _seekAudience.indexOf(c) < 0; });
  if (_nonSeeking.length > 0) {
    html += '<div class="wdp-group wdp-g-incap">';
    html += '<div class="wdp-group-title"><span class="tag">\u767E \u5B98 \u5019 \u65E8</span><span class="desc">\u73B0\u5728\u4EAC\u4E2D\u00B7\u53EF\u968F\u65F6\u53EC\u5BF9</span><span class="count">' + _nonSeeking.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-char-grid">';
    _nonSeeking.forEach(function(ch) {
      var _cardCls = _wdCardClass(ch);
      var _loyCls = _wdLoyClass(ch.loyalty);
      var _hasHist = (GM.wenduiHistory && GM.wenduiHistory[ch.name] && GM.wenduiHistory[ch.name].length > 0);
      var _loyDisp = typeof _fmtNum1==='function' ? _fmtNum1(ch.loyalty) : (ch.loyalty||0);
      var _initial = escHtml(String(ch.name||'?').charAt(0));
      var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
      var _spouseMark = ch.spouse ? '<span class="spouse">\u2766</span>' : '';
      html += '<div class="wdp-char-card ' + _cardCls + ' ' + _loyCls + (_hasHist?' has-hist':'') + '" onclick="openWenduiPick(\'' + ch.name.replace(/'/g,"") + '\')">';
      html += '<div class="wdp-char-top">';
      html += '<div class="wdp-portrait">' + _portraitHtml + '</div>';
      html += '<div class="wdp-name-wrap">';
      html += '<div class="wdp-name">' + escHtml(ch.name) + _spouseMark + '</div>';
      html += '<div class="wdp-char-title">' + escHtml((ch.officialTitle || ch.title || '').slice(0,14)) + '</div>';
      html += '</div></div>';
      html += '<div class="wdp-char-bottom">';
      html += '<span class="wdp-loyalty">\u5FE0 <span class="num">' + _loyDisp + '</span></span>';
      html += _wdFactionTag(ch);
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  // 【远方臣子】灰度
  if (away.length > 0) {
    var _playerLoc2 = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'京城');
    html += '<div class="wdp-group wdp-g-away">';
    html += '<div class="wdp-group-title"><span class="tag">\u8FDC \u65B9 \u81E3 \u5B50</span><span class="desc">\u4E0D\u5728' + escHtml(_playerLoc2) + '\u00B7\u9700\u53EC\u56DE\u6216\u9E3F\u96C1\u4F20\u4E66</span><span class="count">' + away.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-away-list">';
    away.forEach(function(ch) {
      var loc = ch.location || '\u8FDC\u65B9';
      var travel = ch._travelTo ? '<span class="travel">\u2192' + escHtml(ch._travelTo) + '</span>' : '';
      html += '<div class="wdp-away-item" title="' + escHtml(loc + (ch._travelTo?' \u2192'+ch._travelTo:'')) + '">' + escHtml(ch.name) + ' <span class="loc">' + escHtml(loc.slice(0,6)) + '</span>' + travel + '</div>';
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
}

function _wdIsAtCapital(ch) {
  if (!ch || ch.alive === false) return false;
  // 使用玩家所在地而非固定京城
  var playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital || '京城');
  var loc = ch.location || (GM._capital || '京城');
  if (ch._travelTo) return false;
  // 宽松匹配——紫禁城·乾清宫 / 坤宁宫 / 京师·文渊阁 视为同地
  return (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (loc === playerLoc);
}

/**
 * 点击角色 → 弹出模式选择对话框
 */
function openWenduiPick(name) {
  var ch = findCharByName(name); if (!ch) return;
  var hist = GM.wenduiHistory && GM.wenduiHistory[name] && GM.wenduiHistory[name].length > 0;
  var _initial = escHtml(String(name||'?').charAt(0));
  var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
  var _subTitle = escHtml((ch.officialTitle || ch.title || '').slice(0,20)) + (ch.spouse ? ' \u00B7 \u540E\u59C3' : '');
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wd-pick-modal';
  modal.innerHTML = '<div class="wdp-pick-modal-inner">'
    + '<div class="wdp-pick-portrait">' + _portraitHtml + '</div>'
    + '<div class="wdp-pick-name">\u53EC \u89C1 \u00B7 ' + escHtml(name) + '</div>'
    + '<div class="wdp-pick-title">' + _subTitle + '</div>'
    + (hist ? '<div class="wdp-pick-hist">\u6B64\u524D\u6709 ' + GM.wenduiHistory[name].length + ' \u6761\u5BF9\u8BDD\u8BB0\u5F55</div>' : '')
    + '<div class="wdp-pick-modes">'
    + '<div class="wdp-mode-card sel" id="wd-pick-formal" onclick="_wdPickMode(\'formal\')">'
    +   '<div class="icon">\u6BBF</div><div class="name">\u671D\u5802\u95EE\u5BF9</div>'
    +   '<div class="desc">\u8D77\u5C45\u6CE8\u5B98\u5728\u573A\u00B7\u4E25\u8083\u6B63\u5F0F\u00B7\u8A00\u8F9E\u6709\u5EA6</div>'
    + '</div>'
    + '<div class="wdp-mode-card" id="wd-pick-private" onclick="_wdPickMode(\'private\')">'
    +   '<div class="icon">\u5BC6</div><div class="name">\u79C1\u4E0B\u53D9\u8C08</div>'
    +   '<div class="desc">\u5C4F\u9000\u5DE6\u53F3\u00B7\u66F4\u5766\u8BDA\u4EA6\u66F4\u7D6E\u53E8</div>'
    + '</div>'
    + '</div>'
    + '<div class="wdp-pick-actions">'
    +   '<button class="wdp-pick-btn primary" onclick="_wdConfirmPick(\'' + name.replace(/'/g,"") + '\')">\u53EC\u3000\u89C1</button>'
    +   '<button class="wdp-pick-btn secondary" onclick="document.getElementById(\'wd-pick-modal\').remove()">\u53D6\u3000\u6D88</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
}

var _wdPickedMode = 'formal';
function _wdPickMode(mode) {
  _wdPickedMode = mode;
  var f = _$('wd-pick-formal'), p = _$('wd-pick-private');
  if (f) f.classList.toggle('sel', mode === 'formal');
  if (p) p.classList.toggle('sel', mode === 'private');
}

function _wdConfirmPick(name) {
  var m = _$('wd-pick-modal'); if (m) m.remove();
  openWenduiModal(name, _wdPickedMode);
}

/**
 * 打开问对聊天弹窗（核心函数）
 * @param {string} name - 角色名
 * @param {string} mode - 'formal' 或 'private'
 * @param {string} [prefillMsg] - 预填消息（如从奏疏传召）
 */
function openWenduiModal(name, mode, prefillMsg) {
  // N4: 问对消耗精力
  if (typeof _spendEnergy === 'function' && !_spendEnergy(5, '问对·' + name)) return;
  _wenduiMode = mode || 'formal';
  GM.wenduiTarget = name;
  if (!GM.wenduiHistory) GM.wenduiHistory = {};
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];

  var ch = findCharByName(name);
  // 后宫干政触发——与后妃在朝堂模式问对，登记事件供下回合大臣反应
  if (ch && ch.spouse && _wenduiMode === 'formal') {
    if (!GM._consortFormalAudiences) GM._consortFormalAudiences = [];
    GM._consortFormalAudiences.push({
      name: name, turn: GM.turn,
      spouseRank: ch.spouseRank || '',
      motherClan: ch.motherClan || '',
      processed: false
    });
    if (typeof addEB === 'function') addEB('\u540E\u5BAB', '\u671D\u5802\u95EE\u5BF9' + name + '\u00B7\u6B64\u4E3E\u5F15\u5916\u81E3\u4FA7\u76EE');
  }
  var modeLabel = _wenduiMode === 'private' ? '私下叙谈' : '朝堂问对';

  // 创建全屏弹窗
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wendui-modal';
  modal.style.cssText = '-webkit-app-region:no-drag;';
  modal.innerHTML = '<div class="wd-modal-inner">'
    // 顶栏
    + '<div class="wd-modal-header">'
    + '<div class="wd-modal-header-left">'
    + '<button class="bt bsm" id="wd-edict-btn" onclick="_wdAddToEdict()" title="\u5148\u5212\u9009\u5927\u81E3\u53D1\u8A00\u4E2D\u7684\u6587\u5B57\uFF0C\u518D\u70B9\u6B64\u6309\u94AE\u6458\u5165\u5EFA\u8BAE\u5E93">\u6458\u5165\u5EFA\u8BAE\u5E93</button>'
    + '<button class="bt bsm" onclick="_wdSummonConfronter()" title="\u53EC\u5165\u7B2C\u4E8C\u4EBA\u5F53\u9762\u5BF9\u8D28">\u53EC\u4EBA\u5BF9\u8D28</button>'
    + '<button class="bt bsm" style="color:var(--celadon-400);" onclick="_wdReward()" title="\u5F53\u573A\u8D4F\u8D50">\u8D4F</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdPunish()" title="\u5F53\u573A\u5904\u7F5A">\u7F5A</button>'
    + '</div>'
    + '<div class="wd-modal-header-center">'
    + '<div class="wd-modal-char-name">' + escHtml(name) + '</div>'
    + '<div class="wd-modal-char-sub">' + escHtml(ch ? (ch.title || '') : '') + ' · ' + modeLabel
    + ' · <span id="wd-char-loyalty" style="color:' + (ch && ch.loyalty > 70 ? 'var(--green)' : ch && ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)') + ';">忠' + (ch ? (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty):ch.loyalty) : '?') + '</span></div>'
    + '</div>'
    + '<button class="bt bsm wd-modal-close" onclick="closeWenduiModal()">✕</button>'
    + '</div>'
    // 提示 + 情绪指示条
    + '<div class="wd-modal-hint"><span>\u5212\u51FA\u5927\u81E3\u8BF4\u7684\u8BDD\u52A0\u5165\u5EFA\u8BAE\u5E93</span>'
    + '<span id="wd-emotion-bar" style="margin-left:var(--space-3);font-size:0.65rem;"><span style="color:var(--celadon-400);">\u955C\u5B9A</span> <span id="wd-emotion-dots">\u25CF\u25CF\u25CF\u25CB\u25CB</span> <span style="color:var(--vermillion-400);">\u7D27\u5F20</span></span>'
    + '</div>'
    // 推荐话题
    + '<div id="wd-topics" style="display:flex;gap:4px;flex-wrap:wrap;padding:2px 8px;"></div>'
    // 聊天区
    + '<div class="wd-modal-chat" id="wd-modal-chat"></div>'
    // 输入区
    + '<div class="wd-modal-footer">'
    + '<div style="display:flex;gap:var(--space-2);align-items:flex-end;">'
    + '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-1);align-items:center;">'
    + '<span style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u8BED\u6C14</span>'
    + '<select id="wd-tone" style="font-size:var(--text-xs);padding:2px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:var(--radius-sm);">'
    + '<option value="direct">\u76F4\u95EE</option><option value="probing">\u65C1\u6572\u4FA7\u51FB</option>'
    + '<option value="pressing">\u65BD\u538B\u903C\u95EE</option><option value="flattering">\u865A\u4E0E\u59D4\u86C7</option>'
    + '<option value="silence">\u6C89\u9ED8\u4EE5\u5BF9</option></select></div>'
    + '<textarea id="wd-modal-input" class="wd-modal-textarea" placeholder="请输入……" rows="3" maxlength="5000" oninput="_wdUpdateCounter()"></textarea>'
    + '<div style="display:flex;flex-direction:column;gap:var(--space-1);">'
    + '<button class="bt bp bsm" onclick="sendWendui()" id="wd-send-btn" title="发送">奉旨</button>'
    + '<button class="bt bs bsm" onclick="closeWenduiModal()" title="退下">退下</button>'
    + '</div></div>'
    + '<div id="wd-char-counter" style="text-align:right;font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:2px;">0/5000</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);

  // 渲染聊天记录
  _wdRenderHistory(name, ch);

  // 推荐话题（根据NPC职务+当前局势生成）
  var _topicsEl = _$('wd-topics');
  if (_topicsEl && ch) {
    var _topics = [];
    // 按职务推荐
    var _off = (ch.officialTitle || '').toLowerCase();
    if (_off.indexOf('\u5175') >= 0 || _off.indexOf('\u5C06') >= 0 || _off.indexOf('\u519B') >= 0 || (ch.military || 0) > 65) _topics.push('\u8FB9\u5883\u519B\u60C5\u5982\u4F55');
    if (_off.indexOf('\u6237') >= 0 || _off.indexOf('\u5EA6\u652F') >= 0 || _off.indexOf('\u8D22') >= 0) _topics.push('\u56FD\u5E93\u8D22\u653F\u73B0\u72B6');
    if (_off.indexOf('\u5409') >= 0 || _off.indexOf('\u94E8') >= 0 || _off.indexOf('\u4EBA') >= 0) _topics.push('\u5B98\u5458\u8003\u8BFE\u60C5\u51B5');
    if (_off.indexOf('\u793C') >= 0 || _off.indexOf('\u592A\u5E38') >= 0) _topics.push('\u793C\u5236\u4E0E\u7956\u5236');
    // 按性格/关系推荐
    if ((ch.loyalty || 50) > 80) _topics.push('\u670B\u515A\u4E4B\u5F0A');
    if ((ch.ambition || 50) > 70) _topics.push('\u5BF9\u5F53\u524D\u5C40\u52BF\u6709\u4F55\u770B\u6CD5');
    if (ch.spouse) _topics.push('\u5BB6\u5E38\u8BDD');
    // 按局势推荐
    if (GM.activeWars && GM.activeWars.length > 0) _topics.push('\u6218\u4E8B\u8FDB\u5C55');
    // 通用
    if (_topics.length === 0) _topics.push('\u8FD1\u6765\u53EF\u6709\u4EC0\u4E48\u8981\u4E8B');
    _topicsEl.innerHTML = _topics.slice(0, 5).map(function(t) {
      return '<button class="bt bsm" style="font-size:0.65rem;padding:1px 6px;color:var(--gold-400);border-color:var(--gold-500);" onclick="var i=_$(\'wd-modal-input\');if(i){i.value=\'' + t.replace(/'/g, '') + '\';i.focus();_wdUpdateCounter();}">' + t + '</button>';
    }).join('');
  }

  // 仪式/氛围选择（第一次对话开始前）
  if (!GM.wenduiHistory[name] || GM.wenduiHistory[name].length === 0) {
    var chatEl0 = _$('wd-modal-chat');
    if (chatEl0 && ch) {
      var _ceremonyDiv = document.createElement('div');
      _ceremonyDiv.id = 'wd-ceremony';
      _ceremonyDiv.style.cssText = 'text-align:center;padding:var(--space-3);';
      if (_wenduiMode === 'formal') {
        _ceremonyDiv.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-300);margin-bottom:var(--space-2);">（' + escHtml(name) + '入殿行礼，候旨。）</div>'
          + '<div style="display:flex;gap:var(--space-2);justify-content:center;">'
          + '<button class="bt bsm" onclick="_wdCeremony(\'seat\')" style="color:var(--celadon-400);">\u8D50\u5EA7</button>'
          + '<button class="bt bsm" onclick="_wdCeremony(\'stand\')">\u4E0D\u8D50\u5EA7</button>'
          + '</div>';
      } else {
        _ceremonyDiv.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-300);margin-bottom:var(--space-2);">（' + escHtml(name) + '入内，左右退下。）</div>'
          + '<div style="display:flex;gap:var(--space-2);justify-content:center;">'
          + '<button class="bt bsm" onclick="_wdCeremony(\'tea\')" style="color:var(--celadon-400);">\u8D50\u8336</button>'
          + '<button class="bt bsm" onclick="_wdCeremony(\'wine\')" style="color:var(--gold-400);">\u8D50\u9152</button>'
          + '<button class="bt bsm" onclick="_wdCeremony(\'none\')">\u76F4\u5165\u6B63\u9898</button>'
          + '</div>';
      }
      chatEl0.appendChild(_ceremonyDiv);
    }
  }
  // 初始化问对状态
  if (!GM._wdState) GM._wdState = {};
  GM._wdState[name] = { emotion: 3, turns: 0, ceremony: '', fatigued: false };

  // 上次问对回顾提示
  var _lastHist = (GM.wenduiHistory[name] || []).filter(function(h) { return h.role === 'npc'; });
  if (_lastHist.length > 0) {
    var _lastReply = _lastHist[_lastHist.length - 1];
    var chatEl = _$('wd-modal-chat');
    if (chatEl) {
      var recap = document.createElement('div');
      recap.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--ink-300);padding:4px 8px;margin-bottom:4px;background:var(--color-elevated);border-radius:4px;';
      recap.textContent = '\u4E0A\u6B21\u95EE\u5BF9\u8981\u70B9\uFF1A' + (_lastReply.content || '').slice(0, 60) + (_lastReply.content && _lastReply.content.length > 60 ? '\u2026' : '');
      chatEl.insertBefore(recap, chatEl.firstChild);
    }
  }

  // 预填消息
  if (prefillMsg) {
    var inp = _$('wd-modal-input');
    if (inp) { inp.value = prefillMsg; _wdUpdateCounter(); inp.focus(); }
  }
}

// 对质：召入第二人
var _wdConfronter = null;
function _wdSummonConfronter() {
  var capital = GM._capital || '\u4EAC\u57CE';
  var current = GM.wenduiTarget;
  var candidates = (GM.chars || []).filter(function(c) { return c.alive !== false && c.name !== current && _wdIsAtCapital(c); });
  if (candidates.length === 0) { toast('\u65E0\u53EF\u53EC\u89C1\u4E4B\u4EBA'); return; }
  var html = '<div style="max-height:50vh;overflow-y:auto;">';
  candidates.slice(0, 20).forEach(function(c) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid var(--bg-4);cursor:pointer;" onclick="_wdConfronter=\'' + c.name.replace(/'/g, '') + '\';closeGenericModal();toast(\'\u5DF2\u53EC\u5165\'+_wdConfronter+\'\u5BF9\u8D28\');var inp=_$(\'wd-modal-input\');if(inp)inp.placeholder=\'\u73B0\u5728\u4E24\u4EBA\u90FD\u5728\uFF0C\u8BF7\u53D1\u95EE\u2026\u2026\';">';
    html += '<span>' + escHtml(c.name) + ' <span style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(c.title || '') + '</span></span>';
    html += '<span style="font-size:0.72rem;color:var(--txt-s);">\u5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u53EC\u5165\u4F55\u4EBA\u5BF9\u8D28', html, null);
}

/** NPC求见——打开问对，NPC先主动开口 */
function _wdOpenAudience(name) {
  // 直接打开正式模式问对
  openWenduiModal(name, 'formal');
  // NPC先主动发言（不等皇帝问）——标记为奏对模式
  GM._wdAudienceMode = true;
  // 延迟触发NPC主动开口
  setTimeout(function() {
    _wdNpcInitiateSpeak(name);
  }, 300);
}

/** NPC主动开口（奏对模式）——AI生成NPC的开场陈述 */
async function _wdNpcInitiateSpeak(name) {
  var ch = findCharByName(name);
  if (!ch || !P.ai || !P.ai.key) return;
  var chatEl = _$('wd-modal-chat');
  if (!chatEl) return;
  _wenduiSending = true;
  var sendBtn = _$('wd-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

  // 创建NPC气泡
  var div = document.createElement('div');
  div.className = 'wendui-npc';
  div.innerHTML = (ch.portrait?'<img src="'+escHtml(ch.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">':'<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>')
    + '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + '</div>'
    + '<div class="wendui-npc-bubble wd-selectable" id="wd-init-bubble">\u2026</div></div>';
  chatEl.appendChild(div);

  // 构建NPC主动开场的prompt
  var sysP = _wdBuildPrompt(ch, name);
  if (ch._envoy) {
    // 外藩使节：不走本朝官员的情绪分支，而是以外交使命为主
    sysP += '\n\n【特殊：外藩使节入朝陈事】';
    sysP += '\n你刚刚入觐天朝皇帝，须主动开口——不要说"候陛下垂询"或"臣听候圣谕"。';
    sysP += '\n第一句务必完成以下四件事：①自报家门（"外臣/小臣/使臣某某奉X国之命"）②到朝目的（奉命行X使命）③呈上主君意旨或条款 ④表明己方立场或期望。';
    sysP += '\n开头示例（按身份风格选）：';
    sysP += '\n  · 女真 / 蒙古：直率豪迈——"外臣奉天聪汗之命入朝，实有三事求见天朝皇帝"';
    sysP += '\n  · 朝鲜：恭顺委婉——"小邦使臣叩谢天恩·有紧要军情告于陛下"';
    sysP += '\n  · 海商/南洋：商人本色——"小使奉主公之命，特献方物，亦有一议奉陈"';
    sysP += '\n  · 西洋：带外语译意感——"Your Majesty·外使奉总督大人之命远渡而来"';
    sysP += '\n切忌说"臣有事启奏"（本朝辞令）——你是外臣，应明确使命与己方立场。';
  } else {
    sysP += '\n\n【特殊：NPC主动求见模式】';
    sysP += '\n你是主动请求面圣的——你有准备好的话要说。不要问"陛下找臣何事"。';
    sysP += '\n你应该直接开口陈述你的来意：';
    if ((ch.stress||0) > 60) sysP += '\n  你心中有忧虑/困难/为难之事，想向皇帝倾诉或请求帮助。';
    if ((ch.loyalty||50) > 90) sysP += '\n  你是忠臣，有重要的忠告或警示要进言。';
    if ((ch.ambition||50) > 80) sysP += '\n  你有一个精心准备的计划/策论要呈上。';
    // 检查未回复来函
    var _unansLetter = (GM.letters||[]).find(function(l) { return l._npcInitiated && l.from === name && l._replyExpected && !l._playerReplied && l.status === 'returned'; });
    if (_unansLetter) sysP += '\n  你之前写了一封信给皇帝但未获回复，内容是：「' + (_unansLetter.content||'').slice(0,80) + '」——你这次亲自来是为了当面追问此事。';
    sysP += '\n直接以"臣有事启奏——"或类似开头，主动陈述你的来意和诉求。不要等皇帝先说话。';
  }
  sysP += '\n返回 JSON：{"reply":"主动陈述内容","loyaltyDelta":0,"emotionState":"当前情绪","suggestions":[{"topic":"针对什么问题/情境(10-25字具体说明上下文)","content":"详尽建议(80-200字，含具体执行者、手段、范围、时机；不要笼统套话)"}]}\n';
  sysP += '【suggestions 要求】\n';
  sysP += '  · 必须是 object 数组，每条含 topic(问题描述) + content(具体方案)\n';
  sysP += '  · topic 示例："针对辽东军饷拖欠之困"、"应对江南士绅抗税"、"关于太子人选之议"\n';
  sysP += '  · content 要具体：谁去办、怎么办、涉及哪些部门/地方/人——须有可操作性\n';
  sysP += '  · 反面例子（不可接受）：\n';
  sysP += '    ❌ "依靠清流与儒家礼法徐徐图之" —— 太笼统，无执行路径\n';
  sysP += '    ❌ "整饬吏治" —— 空话\n';
  sysP += '  · 正面例子：\n';
  sysP += '    ✓ topic="针对吴地赋税连年欠缴"\n';
  sysP += '      content="臣请陛下遣户部侍郎某某巡按江南，择苏松常三州先行清丈田亩，以三月为期。若豪右隐匿，许其自首减免，逾期则籍没半数。同时诏命漕运总督约束胥吏，不得骚扰民户。如此上体朝廷之公，下息百姓之怨"\n';

  try {
    var msgs = [{ role: 'system', content: sysP + '\n' + (typeof _aiDialogueWordHint==='function'?_aiDialogueWordHint("wd"):'') }];
    var reply = await callAIMessagesStream(msgs, (typeof _aiDialogueTok==='function'?_aiDialogueTok("wd", 1):800), {
      tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·问对走次 API
      onChunk: function(txt) {
        var bubble = _$('wd-init-bubble');
        if (bubble) { bubble.textContent = txt; }
        chatEl.scrollTop = chatEl.scrollHeight;
      }
    });
    var parsed = (typeof extractJSON === 'function') ? extractJSON(reply) : null;
    var replyText = (parsed && parsed.reply) ? parsed.reply : reply;
    var bubble = _$('wd-init-bubble');
    var _bubbleWrap = bubble; // 在 id 被移除前先捕获引用·供后面进言要点追加使用
    if (bubble) { bubble.textContent = replyText; bubble.removeAttribute('id'); }
    // 记录到历史
    if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
    GM.wenduiHistory[name].push({ role: 'npc', content: replyText, turn: GM.turn });
    // 情绪更新
    if (parsed && parsed.emotionState) {
      var _eMap2 = {'镇定':1,'从容':1,'平静':2,'恭敬':2,'紧张':3,'不安':3,'焦虑':4,'恐惧':4,'崩溃':5,'激动':4,'愤怒':4};
      var _st2 = GM._wdState && GM._wdState[name];
      if (_st2) { _st2.emotion = _eMap2[parsed.emotionState] || 3; _wdUpdateEmotionBar(name); }
    }
    // 后妃留宿请求——挂起 pending，由玩家按钮决定接受/婉拒
    if (ch && ch.spouse && (parsed && parsed.requestOvernight || ch._audienceRequestOvernight)) {
      GM._pendingOvernightReq = { name: name, turn: GM.turn };
      // 在对话下方渲染接受/婉拒按钮
      setTimeout(function(){
        var chatE = _$('wd-modal-chat'); if (!chatE) return;
        if (_$('wd-overnight-btns')) return;  // 避免重复
        var btnDiv = document.createElement('div');
        btnDiv.id = 'wd-overnight-btns';
        btnDiv.style.cssText = 'display:flex;gap:10px;justify-content:center;padding:12px 0;border-top:1px dashed var(--vermillion-400);margin-top:8px;';
        btnDiv.innerHTML = '<div style="flex:1;text-align:center;font-size:0.8rem;color:var(--vermillion-400);padding:6px;font-family:\'STKaiti\',serif;letter-spacing:0.12em;">〘 留 宿 之 请 〙</div>'
          + '<button class="bt bp bsm" onclick="_wdAcceptOvernight()" style="background:linear-gradient(135deg,var(--vermillion-400),var(--vermillion-500));">应 允</button>'
          + '<button class="bt bs bsm" onclick="_wdDeclineOvernight()">改 日</button>';
        chatE.appendChild(btnDiv);
        chatE.scrollTop = chatE.scrollHeight;
      }, 200);
    }
    // 建议——兼容新 {topic,content} object 与旧 string
    var _wdSugs = [];
    if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
      parsed.suggestions.forEach(function(sg) {
        if (!sg) return;
        if (!GM._edictSuggestions) GM._edictSuggestions = [];
        if (typeof sg === 'object' && sg.content) {
          GM._edictSuggestions.push({ source: '问对', from: name, topic: sg.topic||'', content: sg.content, turn: GM.turn, used: false });
          _wdSugs.push(sg);
        } else if (typeof sg === 'string' && sg.length > 2) {
          GM._edictSuggestions.push({ source: '问对', from: name, content: sg, turn: GM.turn, used: false });
          _wdSugs.push(sg);
        }
      });
      // 刷新诸书建议库侧边栏
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    }
    // 在 NPC 气泡下方追加"进言要点"展示（对齐普通问对路径）
    if (_wdSugs.length > 0) {
      if (_bubbleWrap && _bubbleWrap.parentNode) {
        var _sugBox = document.createElement('div');
        _sugBox.style.cssText = 'margin-top:4px;padding:4px 6px;background:rgba(184,154,83,0.1);border-radius:4px;font-size:0.72rem;';
        var _sugInner = '<div style="color:var(--gold-400);font-weight:700;margin-bottom:2px;">\u8FDB\u8A00\u8981\u70B9\uFF1A</div>';
        _wdSugs.forEach(function(sg) {
          var _txt = (typeof sg === 'string') ? sg
                   : (sg && sg.content) ? ((sg.topic ? '\u3014' + sg.topic + '\u3015 ' : '') + sg.content)
                   : '';
          if (!_txt) return;
          _sugInner += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;gap:6px;">';
          _sugInner += '<span style="color:var(--color-foreground);flex:1;">\u2022 ' + escHtml(_txt) + '</span>';
          _sugInner += '<span style="color:var(--celadon-400);font-size:0.65rem;opacity:0.7;white-space:nowrap;">\u2713\u5DF2\u5165\u5E93</span>';
          _sugInner += '</div>';
        });
        _sugBox.innerHTML = _sugInner;
        _bubbleWrap.parentNode.appendChild(_sugBox);
      }
    }
    // 纪事
    GM.jishiRecords.push({ turn: GM.turn, char: name, playerSaid: '（NPC主动求见）', npcSaid: replyText, mode: 'formal' });
  } catch(e) {
    var bubble2 = _$('wd-init-bubble');
    if (bubble2) { bubble2.textContent = '（未能陈词）'; bubble2.removeAttribute('id'); }
  }
  _wenduiSending = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '奉旨'; }
  GM._wdAudienceMode = false;
}

/** 拒绝NPC求见 */
function _wdDenyAudience(name) {
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(name, '求见皇帝被拒于殿外', '忧', 4, '天子');
  }
  toast(name + '的求见被拒——已记入其记忆');
  renderWenduiChars();
}

/** 接见 AI 推送的待见队列中的某条 */
function _wdOpenAudienceQueue(qi) {
  var q = GM._pendingAudiences && GM._pendingAudiences[qi]; if (!q) return;
  var name = q.name;
  // 移出队列
  GM._pendingAudiences.splice(qi, 1);
  // 若是外藩使节，记入 NPC（否则可能角色不存在）
  var ch = findCharByName(name);
  if (!ch && q.isEnvoy) {
    // 为使节创建临时角色对象，挂钩势力+保留来意/外交类型供 AI 使用
    var _factionObj = q.fromFaction ? (GM.factions||[]).find(function(f){return f.name===q.fromFaction;}) : null;
    ch = {
      name: name, alive: true, _envoy: true,
      faction: q.fromFaction || '',  // 关键：挂钩势力（标准字段）
      fromFaction: q.fromFaction,
      interactionType: q.interactionType,
      envoyMission: q.reason || '',
      location: GM._capital || '京城',
      isTemp: true,
      title: q.fromFaction ? (q.fromFaction + '使节') : '外藩使节',
      officialTitle: '使节',
      position: '使节',
      loyalty: 50,
      // 从势力继承立场/文化/外交倾向
      stance: _factionObj ? (_factionObj.stance || '') : '',
      culture: _factionObj ? (_factionObj.culture || '') : '',
      diplomacy: _factionObj ? (_factionObj.diplomacy || 55) : 55,
      intelligence: 60
    };
    if (!GM.chars) GM.chars = [];
    GM.chars.push(ch);
    // 关键：新加入的使节须立即注册到索引·否则 findCharByName 找不到·_wdNpcInitiateSpeak 静默退出（这是"使节不发言"的真正根因）
    if (GM._indices && GM._indices.charByName) {
      GM._indices.charByName.set(name, ch);
    } else if (typeof buildIndices === 'function') {
      buildIndices();
    }
  } else if (ch && q.isEnvoy) {
    // 角色已存在（重复求见）——刷新来意并确保挂钩势力
    ch._envoy = true;
    ch.faction = q.fromFaction || ch.faction;
    ch.fromFaction = q.fromFaction;
    ch.interactionType = q.interactionType;
    ch.envoyMission = q.reason || ch.envoyMission || '';
    ch.position = ch.position || '使节';
    ch.officialTitle = ch.officialTitle || '使节';
  }
  // 后妃请见：标记情绪/留宿上下文
  if (ch && ch.spouse && q.isConsort) {
    ch._audienceMood = q.consortMood || '企盼';
    ch._audienceRequestOvernight = !!q.requestOvernight;
    ch._audienceReason = q.reason || '';
  }
  // 打开问对
  if (typeof _wdOpenAudience === 'function') {
    // 后妃：大概率私下，小概率朝堂——受能力/性格/家族/关系影响
    if (ch && ch.spouse && q.isConsort) {
      var wantFormal = 0.1;  // 基础 10% 走朝堂
      // 野心高/好干政 → 更愿在朝堂
      if ((ch.ambition||50) > 70) wantFormal += 0.15;
      if ((ch.intelligence||50) > 75) wantFormal += 0.08;
      // 母族强势（有权臣/节度使亲戚）→ 更愿公开发言
      if (ch.motherClan && /(\u738B|\u516C|\u4FAF|\u5C06|\u8282\u5EA6|\u4E1E\u76F8|\u5C1A\u4E66|\u5927\u5C06\u519B)/.test(ch.motherClan)) wantFormal += 0.12;
      // 皇后比其他妃嫔更有朝堂资格
      if (ch.spouseRank === 'empress') wantFormal += 0.1;
      // 情绪"进言"基本只走朝堂；"喜悦/思念/企盼"几乎必私下
      if (q.consortMood === '进言') wantFormal += 0.4;
      else if (q.consortMood === '喜悦' || q.consortMood === '思念' || q.consortMood === '企盼') wantFormal -= 0.15;
      // 与帝亲密（高 loyalty + 高 opinion）→ 更倾向私下
      if ((ch.loyalty||50) > 80) wantFormal -= 0.08;
      // 性格/特质
      if (ch.traitIds && P.traitDefinitions) {
        var _traits = ch.traitIds.map(function(id){ var d=P.traitDefinitions.find(function(t){return t.id===id;}); return d ? d.name : ''; }).join('');
        if (/\u6A2A|\u72E0|\u86EE\u6A2A/.test(_traits)) wantFormal += 0.15;  // 强横妃嫔
        if (/\u6E29\u987A|\u6DD1\u5FB7/.test(_traits)) wantFormal -= 0.1;
      }
      wantFormal = Math.max(0.03, Math.min(0.5, wantFormal));
      var mode = Math.random() < wantFormal ? 'formal' : 'private';
      _wenduiMode = mode;
      openWenduiModal(name, mode);
      GM._wdAudienceMode = true;
      setTimeout(function(){ _wdNpcInitiateSpeak(name); }, 300);
    } else {
      _wdOpenAudience(name);
    }
  } else {
    toast('接见 ' + name);
  }
}

/** 应允留宿——次回合推演须体现帝幸某宫 */
function _wdAcceptOvernight() {
  var req = GM._pendingOvernightReq; if (!req) return;
  var name = req.name;
  var ch = findCharByName(name);
  if (!ch) return;
  if (!GM._pendingOvernight) GM._pendingOvernight = [];
  GM._pendingOvernight.push({ name: name, turn: GM.turn, status: 'accepted' });
  // 妃子关系加深（忠诚 + 压力 -）
  if (typeof ch.loyalty === 'number') ch.loyalty = Math.min(100, ch.loyalty + 3);
  if (typeof ch.stress === 'number') ch.stress = Math.max(0, ch.stress - 10);
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '请得陛下留宿·恩眷殷深', '喜', 8, (P.playerInfo && P.playerInfo.characterName) || '陛下');
  if (typeof addEB === 'function') addEB('\u540E\u5BAB', '\u5E1D\u5C06\u5BBF\u4E8E' + name + '\u5BAB');
  delete GM._pendingOvernightReq;
  var btnDiv = _$('wd-overnight-btns');
  if (btnDiv) btnDiv.innerHTML = '<div style="flex:1;text-align:center;color:var(--vermillion-300);font-style:italic;padding:6px;">\u5DF2\u5E94\u5141\u00B7\u4ECA\u591C\u5C06\u5BBF' + escHtml(name) + '\u5BAB</div>';
  if (typeof toast === 'function') toast('\u5DF2\u5E94\u5141\u00B7\u4ECA\u591C\u5BBF' + name + '\u5BAB');
}
function _wdDeclineOvernight() {
  var req = GM._pendingOvernightReq; if (!req) return;
  var name = req.name;
  var ch = findCharByName(name);
  if (ch) {
    if (typeof ch.loyalty === 'number') ch.loyalty = Math.max(0, ch.loyalty - 1);
    if (typeof ch.stress === 'number') ch.stress = Math.min(100, ch.stress + 5);
    if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '请留宿而未准·心中黯然', '忧', 5, (P.playerInfo && P.playerInfo.characterName) || '陛下');
  }
  delete GM._pendingOvernightReq;
  var btnDiv = _$('wd-overnight-btns');
  if (btnDiv) btnDiv.innerHTML = '<div style="flex:1;text-align:center;color:var(--ink-400);font-style:italic;padding:6px;">\u5BAB\u6709\u8981\u4E8B\u00B7\u6539\u65E5\u518D\u8BAE</div>';
  if (typeof toast === 'function') toast('\u6539\u65E5\u518D\u8BAE');
}

/** 拒见队列中的某条 */
function _wdDismissPending(qi) {
  var q = GM._pendingAudiences && GM._pendingAudiences[qi]; if (!q) return;
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(q.name, '求见陛下被拒——' + (q.reason || ''), '忧', 4);
  }
  GM._pendingAudiences.splice(qi, 1);
  toast('已拒见 ' + q.name);
  renderWenduiChars();
}

/** 问对仪式操作 */
function _wdCeremony(type) {
  var name = GM.wenduiTarget;
  var chatEl = _$('wd-modal-chat');
  var _cDiv = _$('wd-ceremony');
  if (_cDiv) _cDiv.remove();
  var state = GM._wdState && GM._wdState[name];
  if (state) state.ceremony = type;
  var msg = '';
  if (type === 'seat') { msg = '（赐座。' + escHtml(name) + '谢恩入座，神色放松。）'; if (state) state.emotion = Math.max(1, state.emotion - 1); }
  else if (type === 'stand') { msg = '（未赐座。' + escHtml(name) + '恭立殿中。）'; }
  else if (type === 'tea') { msg = '（赐茶。' + escHtml(name) + '双手捧茶，感激之色溢于言表。）'; if (state) state.emotion = Math.max(1, state.emotion - 1); }
  else if (type === 'wine') { msg = '（赐酒。' + escHtml(name) + '受宠若惊，酒过三巡更加畅所欲言。）'; if (state) state.emotion = Math.max(1, state.emotion - 2); }
  else { msg = '（直入正题。）'; }
  if (chatEl) {
    var div = document.createElement('div');
    div.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--ink-300);padding:4px;';
    div.textContent = msg;
    chatEl.appendChild(div);
  }
  // 赐座/赐茶影响NPC记忆
  if ((type === 'seat' || type === 'tea' || type === 'wine') && typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(name, '面圣时获' + (type === 'seat' ? '赐座' : type === 'tea' ? '赐茶' : '赐酒') + '之礼', '喜', 3, '天子');
  }
  _wdUpdateEmotionBar(name);
}

/** 当场赏赐 */
function _wdReward() {
  var name = GM.wenduiTarget; if (!name) return;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:300px;">'
    + '<div style="font-size:var(--text-sm);color:var(--gold-400);margin-bottom:var(--space-2);">\u8D4F\u8D50 ' + escHtml(name) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:var(--space-1);">'
    + '<button class="bt bp bsm" onclick="_wdDoReward(\'gold\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u91D1\uFF08\u5FE0+5\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'robe\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u8863\uFF08\u5FE0+3\uFF0C\u5A01\u671B+1\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'feast\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u5BB4\uFF08\u5FE0+4\uFF0C\u538B\u529B-10\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'promote\');this.closest(\'div[style*=fixed]\').remove();">\u52A0\u5B98\uFF08\u5199\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93\uFF09</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}
function _wdDoReward(type) {
  var name = GM.wenduiTarget; var ch = findCharByName(name); if (!ch) return;
  var chatEl = _$('wd-modal-chat');
  var _typeLabels = { gold: '赐金', robe: '赐衣', feast: '赐宴', promote: '加官' };
  var msg = '（' + (_typeLabels[type]||'赏赐') + '。）';
  if (type === 'promote') {
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({ source: '问对', from: '赏赐', content: '加官' + name, turn: GM.turn, used: false });
    msg = '（许以加官。已录入诏书建议库。）';
  }
  // 不直接改数值——记录赏赐事件，由AI推演判断具体影响
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '面圣时获' + (_typeLabels[type]||'赏赐'), '喜', 5, '天子');
  if (!GM._wdRewardPunish) GM._wdRewardPunish = [];
  GM._wdRewardPunish.push({ target: name, type: 'reward', detail: type, turn: GM.turn });
  // 注入当前对话上下文（影响后续AI回复）
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【赏赐】皇帝当场' + (_typeLabels[type]||'赏赐') + name + '。' });
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--celadon-400);padding:4px;'; d.textContent = msg; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  var state = GM._wdState && GM._wdState[name]; if (state) state.emotion = Math.max(1, state.emotion - 1);
  _wdUpdateEmotionBar(name);
}

/** 当场处罚 */
function _wdPunish() {
  var name = GM.wenduiTarget; if (!name) return;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--vermillion-400);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:300px;">'
    + '<div style="font-size:var(--text-sm);color:var(--vermillion-400);margin-bottom:var(--space-2);">\u5904\u7F5A ' + escHtml(name) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:var(--space-1);">'
    + '<button class="bt bsm" style="color:var(--amber-400);" onclick="_wdDoPunish(\'fine\');this.closest(\'div[style*=fixed]\').remove();">\u7F5A\u4FF8\uFF08\u5FE0-3\uFF09</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdDoPunish(\'demote\');this.closest(\'div[style*=fixed]\').remove();">\u964D\u804C\uFF08\u5199\u5165\u8BCF\u4EE4\uFF09</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdDoPunish(\'imprison\');this.closest(\'div[style*=fixed]\').remove();">\u4E0B\u72F1\uFF08\u5FE0-15\uFF0C\u538B\u529B+30\uFF09</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdDoPunish(\'cane\');this.closest(\'div[style*=fixed]\').remove();">\u6756\u8D23\uFF08\u5FE0-8\uFF0C\u538B\u529B+15\uFF09</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}
function _wdDoPunish(type) {
  var name = GM.wenduiTarget; var ch = findCharByName(name); if (!ch) return;
  var chatEl = _$('wd-modal-chat');
  var _typeLabels = { fine: '罚俸', demote: '降职', imprison: '下狱', cane: '杖责' };
  var msg = '（' + (_typeLabels[type]||'处罚') + '。）';
  if (type === 'imprison') msg = '（令拿下！）';
  else if (type === 'cane') msg = '（杖责二十。）';
  if (type === 'demote') {
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({ source: '问对', from: '处罚', content: '降职' + name, turn: GM.turn, used: false });
    msg = '（令降职。已录入诏书建议库。）';
  }
  // 不直接改数值——记录处罚事件，由AI推演判断具体影响
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '面圣时受' + (_typeLabels[type]||'处罚'), '怨', 8, '天子');
  if (!GM._wdRewardPunish) GM._wdRewardPunish = [];
  GM._wdRewardPunish.push({ target: name, type: 'punish', detail: type, turn: GM.turn });
  // 注入对话上下文
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【处罚】皇帝当场' + (_typeLabels[type]||'处罚') + name + '。' });
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--vermillion-400);padding:4px;'; d.textContent = msg; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  var state = GM._wdState && GM._wdState[name]; if (state) state.emotion = Math.min(5, state.emotion + 2);
  _wdUpdateEmotionBar(name);
}

/** 更新NPC情绪指示条 */
function _wdUpdateEmotionBar(name) {
  var state = GM._wdState && GM._wdState[name];
  if (!state) return;
  var dots = _$('wd-emotion-dots');
  if (!dots) return;
  var e = Math.max(1, Math.min(5, state.emotion));
  var filled = '', empty = '';
  for (var i = 0; i < e; i++) filled += '\u25CF';
  for (var j = e; j < 5; j++) empty += '\u25CB';
  dots.innerHTML = '<span style="color:var(--celadon-400);">' + filled.slice(0, Math.max(0, 3-e+1)) + '</span>'
    + '<span style="color:var(--color-foreground-muted);">' + filled.slice(Math.max(0, 3-e+1)) + empty.slice(0, Math.max(0, 3-e)) + '</span>'
    + '<span style="color:var(--vermillion-400);">' + empty.slice(Math.max(0, 3-e)) + '</span>';
}

function closeWenduiModal() {
  var _targetName = GM.wenduiTarget;
  _wdConfronter = null; // 清除对质者
  var m = _$('wendui-modal'); if (m) m.remove();
  GM.wenduiTarget = null;
  // ── 已见：移出待接见队列、压抑动态求见到下一回合 ──
  if (_targetName) {
    if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences.length) {
      GM._pendingAudiences = GM._pendingAudiences.filter(function(q){ return q && q.name !== _targetName; });
    }
    var _ch = findCharByName(_targetName);
    if (_ch) {
      _ch._lastMetTurn = GM.turn;
      // 接见后压降压力/野心（见完心里踏实）
      if ((_ch.stress||0) > 0) _ch.stress = Math.max(0, (_ch.stress||0) - 10);
    }
    // 来函未回标记 → 已回（视为面复）
    if (Array.isArray(GM.letters)) {
      GM.letters.forEach(function(l){
        if (l._npcInitiated && l.from === _targetName && l._replyExpected && !l._playerReplied) {
          l._playerReplied = true;
          l._repliedInAudience = true;
          l._repliedTurn = GM.turn;
        }
      });
    }
  }
  // ★ 异步提取本次问对中的承诺（玩家指令→NPC应答），供推演使用
  if (_targetName) _wd_extractCommitments(_targetName);
  // 刷新问对面板中的角色列表（更新历史记录标记）
  renderWenduiChars();
  // 刷新左面板精力条等状态
  if (typeof renderLeftPanel === 'function') renderLeftPanel();
}

/** 问对结束后抽取承诺：AI 读本次对话，产出 NPC 承诺清单 */
async function _wd_extractCommitments(targetName) {
  if (!P.ai || !P.ai.key || !targetName) return;
  // 仅取本次问对的对话片段——从 jishiRecords 取最新几条 target=此人
  // 仅取本次问对的对话——按 mode 过滤，避免把朝议发言误作问对承诺
  var records = (GM.jishiRecords||[]).filter(function(r){
    if (r.char !== targetName || r.turn !== GM.turn) return false;
    // 仅 formal/private（问对）；排除 changchao/tinyi/yuqian（朝议）
    return !r.mode || r.mode === 'formal' || r.mode === 'private';
  }).slice(-10);
  if (records.length < 2) return; // 对话太短无需提取
  var dialog = records.map(function(r){ return (r.playerSaid||'') + '\n' + (r.npcSaid||''); }).join('\n').slice(-3000);
  var ch = findCharByName(targetName);
  if (!ch) return;

  var prompt = '以下是皇帝与' + targetName + '（' + (ch.officialTitle||ch.title||'') + '，忠' + (ch.loyalty||50) + '，性' + (ch.personality||'').slice(0,15) + '）的问对片段。请提取玩家（皇帝）向此人下达的指令/任务/期望，以及该人在对话中的应答与承诺。\n\n';
  prompt += dialog + '\n\n';
  prompt += '【关键】\n';
  prompt += '· 只提取实实在在、有明确内容的任务（如"去查某事""写奏章""节制某军""调查某人"）\n';
  prompt += '· 泛泛之辞（"尽力为之""不负陛下"等）不提取\n';
  prompt += '· 若皇帝未下任何指令，返回空数组\n';
  prompt += '· willingness 体现该人执行意愿（按对话态度判——推诿者低，坦然应承者高）\n';
  prompt += '返回 JSON：{"commitments":[{"task":"具体任务(30字内)","category":"query查办/write撰写/dispatch调遣/intel侦查/diplomacy外使/finance财赋/other","deadline":"回合数(1-10，默认3)","willingness":0-1,"npcPromise":"他答应的话(原句摘要)","conditions":"附加条件(若有)"}]}';

  try {
    var raw = await callAI(prompt, 500);
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!obj || !Array.isArray(obj.commitments) || obj.commitments.length === 0) return;

    if (!GM._npcCommitments) GM._npcCommitments = {};
    if (!GM._npcCommitments[targetName]) GM._npcCommitments[targetName] = [];

    obj.commitments.forEach(function(c) {
      if (!c || !c.task) return;
      var commit = {
        id: (typeof uid==='function'?uid():'cmt_'+Date.now()),
        task: c.task,
        category: c.category || 'other',
        assignedTurn: GM.turn,
        deadline: parseInt(c.deadline,10) || 3,
        willingness: parseFloat(c.willingness) || 0.6,
        npcPromise: c.npcPromise || '',
        conditions: c.conditions || '',
        status: 'pending',       // pending/executing/completed/failed/delayed
        progress: 0,
        attempts: 0,
        feedback: ''
      };
      GM._npcCommitments[targetName].push(commit);
      // 事件板
      if (typeof addEB === 'function') addEB('问对·受命', targetName + '允诺：' + c.task.slice(0,40));
      // 起居注
      if (GM.qijuHistory) GM.qijuHistory.unshift({
        turn: GM.turn,
        date: typeof getTSText==='function'?getTSText(GM.turn):'',
        content: '【问对·受命】' + targetName + '允：' + c.task + (c.npcPromise?' ——"' + c.npcPromise + '"':''),
        category: '问对'
      });
      // 写入 NPC 记忆
      if (typeof NpcMemorySystem !== 'undefined') {
        NpcMemorySystem.remember(targetName, '奉旨：' + c.task, c.willingness > 0.6 ? '敬' : '忧', 6);
      }
    });
  } catch(e) { console.warn('[_wd_extractCommitments]', e); }
}

function _wdUpdateCounter() {
  var inp = _$('wd-modal-input');
  var cnt = _$('wd-char-counter');
  if (inp && cnt) cnt.textContent = inp.value.length + '/5000';
}

/**
 * 渲染聊天历史 + 开场白
 */
function _wdRenderHistory(name, ch) {
  var chat = _$('wd-modal-chat'); if (!chat) return;
  chat.innerHTML = '';

  // 生成开场白
  var _greeting = _wdGenerateGreeting(name, ch);

  // 开场白气泡
  _wdAppendNpcBubble(chat, name, ch, _greeting);

  // 历史对话
  (GM.wenduiHistory[name] || []).forEach(function(msg) {
    if (msg.role === 'player') {
      _wdAppendPlayerBubble(chat, msg.content);
    } else {
      _wdAppendNpcBubble(chat, name, ch, msg.content, msg.loyaltyDelta);
    }
  });

  chat.scrollTop = chat.scrollHeight;
}

function _wdAppendNpcBubble(chat, name, ch, text, loyaltyDelta) {
  var div = document.createElement('div');
  div.className = 'wendui-msg wendui-npc';
  var deltaTag = '';
  var _lF = typeof _fmtNum1==='function' ? _fmtNum1 : function(x){return x;};
  if (loyaltyDelta && loyaltyDelta > 0) deltaTag = ' <span style="color:var(--green);font-size:0.7rem;">忠+' + _lF(loyaltyDelta) + '</span>';
  else if (loyaltyDelta && loyaltyDelta < 0) deltaTag = ' <span style="color:var(--red);font-size:0.7rem;">忠' + _lF(loyaltyDelta) + '</span>';
  var _portrait = ch && ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;">' : '';
  div.innerHTML = _portrait + '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + deltaTag + '</div>'
    + '<div class="wendui-npc-bubble wd-selectable">' + escHtml(text) + '</div></div>';
  chat.appendChild(div);
}

function _wdAppendPlayerBubble(chat, text) {
  var div = document.createElement('div');
  div.className = 'wendui-msg wendui-player';
  div.innerHTML = '<div class="wendui-player-bubble">' + escHtml(text) + '</div>';
  chat.appendChild(div);
}

/**
 * 生成开场白（基于角色特质、忠诚度、模式等）
 */
function _wdGenerateGreeting(name, _ch) {
  if (!_ch) return '参见。臣听候圣谕。';
  // 使节专用开场——不说"臣听候圣谕"，直接报来意
  if (_ch._envoy) {
    var _fac = _ch.fromFaction || '外藩';
    var _mission = (_ch.envoyMission || '').slice(0, 60);
    var _opener = '外臣' + _fac + '使节' + name + '，谨奉国书，参见陛下。';
    if (_mission) _opener += '此来——' + _mission;
    return _opener;
  }
  var _isPrv = (_wenduiMode === 'private');
  var _isAmbitious = (_ch.ambition || 50) > 70;
  var _isStressed = (_ch.stress || 0) > 50;
  var _traitWords = (_ch.personality || '') + ((_ch.traitIds || []).join(' '));
  var _isBrave = _traitWords.indexOf('勇') >= 0 || _traitWords.indexOf('brave') >= 0;
  var _isCautious = _traitWords.indexOf('慎') >= 0 || _traitWords.indexOf('cautious') >= 0;
  var _isScholar = _traitWords.indexOf('学') >= 0 || _traitWords.indexOf('diligent') >= 0;
  var _recentArc = '';
  if (GM.characterArcs && GM.characterArcs[_ch.name]) {
    var _last = GM.characterArcs[_ch.name].slice(-1)[0];
    if (_last) _recentArc = _last.type || '';
  }
  var _isTyrant = GM._tyrantDecadence && GM._tyrantDecadence > 30;
  var _isSycophant = _isAmbitious && (_ch.loyalty || 50) >= 40 && (_ch.loyalty || 50) <= 80;

  // 配偶
  if (_ch.spouse) {
    var _spRk = _ch.spouseRank || 'consort';
    var _spLoy = _ch.loyalty || 50;
    if (_isPrv) {
      if (_spLoy > 75) return _spRk === 'empress' ? '（端坐于妆台前，回头嫣然一笑）陛下怎么来了？今夜不批折子了么？' : '（迎上前来，挽住手臂）郎君……今天怎么有空来看我？';
      if (_spLoy > 50) return _spRk === 'empress' ? '（放下手中针线，神色平淡）陛下来了。请坐吧。' : '（福了一福）妾身见过陛下。';
      if (_spLoy > 30) return '（没有起身，只抬了抬眼）……来了。';
      return '（冷冷地侧过脸去）哦，陛下还记得这里有个人？';
    }
    return _spRk === 'empress' ? '（凤冠霞帔，盈盈行礼）妾身参见陛下。' : '妾' + _ch.name + '参见陛下，陛下万安。';
  }
  // 佞臣+昏君
  if (_isTyrant && _isSycophant) {
    return _isPrv ? '（满面春风，呈上礼盒）主上！臣得了一样好东西，特来献给主上！' : '（跪拜）陛下圣安！微臣' + _ch.name + '恭请圣安。';
  }
  // 忠臣+昏君
  if (_isTyrant && (_ch.loyalty || 50) > 80 && !_isAmbitious) {
    return _isPrv ? '（面色凝重，沉默良久）……主上。臣有话说，但……（叹气）不知从何说起。' : '（长跪不起）陛下……臣' + _ch.name + '冒死觐见。';
  }
  if (_ch.loyalty > 85) {
    return _isPrv
      ? (_isBrave ? '（大步而入，笑容满面）主上！又找末将喝酒？' : _isScholar ? '（抱着一卷书）主上，我方才读到一段妙论，正想与您分享。' : '（笑着行礼）主上，这个时辰召臣来……可是又睡不着了？')
      : (_isBrave ? '末将' + _ch.name + '参见陛下！但有差遣，赴汤蹈火！' : _isScholar ? '臣' + _ch.name + '叩见陛下。臣近日研读典籍，颇有心得。' : '陛下万安！微臣' + _ch.name + '叩首，恭候圣训。');
  }
  if (_ch.loyalty > 60) {
    return _isPrv
      ? (_isAmbitious ? '（拱手入座）主上有事吩咐？我正好也有话想说。' : _isCautious ? '主上……私下相召，可是有什么不便明说之事？' : '（入座）主上找我，是公事还是闲话？')
      : (_isAmbitious ? '参见陛下。臣有要事奏报。' : _isCautious ? '臣' + _ch.name + '觐见。不知陛下召臣何事？' : '参见陛下。臣' + _ch.name + '听候吩咐。');
  }
  if (_ch.loyalty > 40) {
    return _isPrv
      ? (_isStressed ? '（疲惫地坐下）……主上，我今日实在乏了。' : _recentArc === 'dismissal' ? '……主上又找我。有什么话，直说吧。' : '（沉默片刻）主上。')
      : (_isStressed ? '（面色憔悴）臣' + _ch.name + '……奉召觐见。' : '臣' + _ch.name + '，奉召觐见。');
  }
  if (_ch.loyalty > 20) {
    return _isPrv
      ? (_isAmbitious ? '（倚门而立，似笑非笑）这么晚了，找我做什么？' : '……找我有事？')
      : (_isAmbitious ? '（目光闪烁）陛下有何吩咐？' : '……臣在。不知陛下何事相召。');
  }
  return _isPrv
    ? (_isBrave ? '（冷笑一声）没想到你还敢单独叫我来。' : '……哦，你居然还愿意跟我说话。')
    : (_isBrave ? '（按剑而立）陛下，臣已至。' : '哼。陛下既然召见，臣便来了。');
}

/**
 * 发送问对消息（新版：弹窗模式 + 流式）
 */
async function sendWendui(){
  if (_wenduiSending) return;
  if(!GM.wenduiTarget){toast('请先选择人物');return;}
  var _tone = _$('wd-tone') ? _$('wd-tone').value : 'direct';
  // 沉默以对——不需要输入文字
  if (_tone === 'silence') {
    var _silChat = _$('wd-modal-chat');
    if (_silChat) {
      var _silDiv = document.createElement('div');
      _silDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:0.5rem;';
      _silDiv.innerHTML = '<div style="font-size:0.8rem;color:var(--ink-300);font-style:italic;padding:0.3rem 0.6rem;">（沉默不语，目光审视。）</div>';
      _silChat.appendChild(_silDiv); _silChat.scrollTop = _silChat.scrollHeight;
    }
    var _silName = GM.wenduiTarget;
    if (!GM.wenduiHistory[_silName]) GM.wenduiHistory[_silName] = [];
    GM.wenduiHistory[_silName].push({role:'player', content:'（沉默以对）'});
    // NPC对沉默的反应——按性格不同
    var _silCh = findCharByName(_silName);
    if (_silCh && P.ai && P.ai.key) {
      _wenduiSending = true;
      var _silPrompt = _wdBuildPrompt(_silCh, _silName);
      _silPrompt += '\n【特殊】皇帝沉默以对，不发一言，只是凝视着你。你必须对这种沉默做出反应——紧张者坐立不安，胆大者主动开口，心虚者可能自我暴露。';
      // 继续走正常AI流程……
    }
    // 走后续的正常发送流程，msg设为沉默标记
    var input = _$('wd-modal-input');
    var msg = '（沉默以对）';
    if (input) input.value = '';
    // 不return，继续走下面的流程
  } else {
    var input=_$('wd-modal-input');
    var msg=input?input.value.trim():'';
    if(!msg)return;
  }
  // 自动移除未点击的仪式div
  var _cDiv2 = _$('wd-ceremony');
  if (_cDiv2) _cDiv2.remove();
  // 疲惫检查
  var _state = GM._wdState && GM._wdState[GM.wenduiTarget];
  if (_state) {
    _state.turns++;
    if (_state.turns > 10 && !_state.fatigued) {
      _state.fatigued = true;
      var _fChat = _$('wd-modal-chat');
      if (_fChat) { var _fd = document.createElement('div'); _fd.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--amber-400);padding:4px;'; _fd.textContent = '（对话已久，' + GM.wenduiTarget + '面露疲态。皇帝亦觉乏倦。精力额外消耗5。）'; _fChat.appendChild(_fd); }
      if (typeof _spendEnergy === 'function') _spendEnergy(5, '问对久谈');
    } else if (_state.turns === 6) {
      var _fChat2 = _$('wd-modal-chat');
      if (_fChat2) { var _fd2 = document.createElement('div'); _fd2.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--ink-300);padding:2px;'; _fd2.textContent = '（对话已有数轮，' + GM.wenduiTarget + '口渐干燥。）'; _fChat2.appendChild(_fd2); }
    }
  }
  if(input)input.value='';_wdUpdateCounter();
  var name=GM.wenduiTarget;
  if(!GM.wenduiHistory[name])GM.wenduiHistory[name]=[];
  GM.wenduiHistory[name].push({role:'player',content:msg});

  var chat=_$('wd-modal-chat');if(!chat)return;
  _wdAppendPlayerBubble(chat, msg);
  chat.scrollTop=chat.scrollHeight;

  var ch=findCharByName(name);
  if(P.ai.key&&ch){
    _wenduiSending = true;
    var sendBtn = _$('wd-send-btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    // 创建流式NPC气泡
    var streamDiv = document.createElement('div');
    streamDiv.className = 'wendui-msg wendui-npc';
    streamDiv.id = 'wd-stream-active';
    streamDiv.innerHTML = '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + '</div>'
      + '<div class="wendui-npc-bubble" id="wd-stream-text" style="color:var(--color-foreground-muted);">……</div></div>';
    chat.appendChild(streamDiv);
    chat.scrollTop = chat.scrollHeight;

    try{
      var sysP = _wdBuildPrompt(ch, name);
      if (typeof _aiDialogueWordHint === 'function') sysP += '\n' + _aiDialogueWordHint("wd");
      var history=GM.wenduiHistory[name].slice(-10);
      var messages=[{role:'system',content:sysP}];
      history.forEach(function(h){messages.push({role:h.role==='player'?'user':'assistant',content:h.content});});

      var streamBubble = _$('wd-stream-text');
      var rawReply = await callAIMessagesStream(messages, (typeof _aiDialogueTok==='function'?_aiDialogueTok("wd", 1):800), {
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·问对走次 API
        onChunk: function(txt) {
          if (streamBubble) { streamBubble.textContent = txt; streamBubble.style.color = ''; }
          chat.scrollTop = chat.scrollHeight;
        }
      });

      if(rawReply){
        var replyText = rawReply, loyaltyDelta = 0;
        var parsed = (typeof extractJSON==='function') ? extractJSON(rawReply) : null;
        if (parsed && parsed.reply) {
          replyText = parsed.reply;
          var _ldMax = (_wenduiMode === 'private') ? 3 : 2;
          loyaltyDelta = clamp(parseInt(parsed.loyaltyDelta) || 0, -_ldMax, _ldMax);
        }
        if (loyaltyDelta !== 0) {
          ch.loyalty = clamp((ch.loyalty || 50) + loyaltyDelta, 0, 100);
          if (typeof OpinionSystem !== 'undefined')
            OpinionSystem.addEventOpinion(name, '玩家', loyaltyDelta * 3, '问对' + (loyaltyDelta > 0 ? '受重用' : '被冷落'));
          // 刷新顶栏忠诚显示
          var loyEl = _$('wd-char-loyalty');
          if (loyEl) { loyEl.textContent = '忠' + (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty):ch.loyalty); loyEl.style.color = ch.loyalty > 70 ? 'var(--green)' : ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)'; }
        }
        // 提取语气效果反馈
        var _toneEffect = (parsed && parsed.toneEffect) ? String(parsed.toneEffect).trim() : '';
        // 情绪指示更新
        if (parsed && parsed.emotionState) {
          var _eMap = {'镇定':1,'从容':1,'平静':2,'恭敬':2,'紧张':3,'不安':3,'焦虑':4,'恐惧':4,'崩溃':5,'激动':4,'愤怒':4};
          var _eVal = _eMap[parsed.emotionState] || 3;
          var _st = GM._wdState && GM._wdState[name];
          if (_st) { _st.emotion = _eVal; _wdUpdateEmotionBar(name); }
        }
        // 承诺追踪——记录NPC在问对中做出的承诺供后续推演验证
        if (replyText && replyText.length > 20) {
          var _promisePatterns = ['\u81E3\u5F53', '\u81E3\u5FC5', '\u5B9A\u5F53', '\u5B9A\u4E0D\u8F9F\u8BA9', '\u4FDD\u8BC1', '\u627F\u8BFA', '\u4E09\u6708\u5185', '\u4E00\u4E2A\u6708', '\u5341\u65E5\u5185'];
          var _hasPromise = _promisePatterns.some(function(pat) { return replyText.indexOf(pat) >= 0; });
          if (_hasPromise) {
            if (!GM._npcClaims) GM._npcClaims = [];
            GM._npcClaims.push({ from: name, content: replyText, turn: GM.turn, verified: false });
            if (GM._npcClaims.length > 30) GM._npcClaims.shift();
          }
        }
        // 提取AI标记的施政建议——新 {topic,content} 与旧 string 兼容
        var _wdSuggestions = (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) ? parsed.suggestions.filter(function(s){ if (!s) return false; if (typeof s === 'string') return s.trim(); return s.content; }) : [];
        if (_wdSuggestions.length > 0) {
          if (!GM._edictSuggestions) GM._edictSuggestions = [];
          _wdSuggestions.forEach(function(sg) {
            if (typeof sg === 'object' && sg.content) {
              GM._edictSuggestions.push({ source: '\u95EE\u5BF9', from: name, topic: sg.topic||'', content: sg.content, turn: GM.turn, used: false });
            } else {
              GM._edictSuggestions.push({ source: '\u95EE\u5BF9', from: name, content: sg, turn: GM.turn, used: false });
            }
          });
          if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
        }
        GM.wenduiHistory[name].push({role:'npc',content:replyText,loyaltyDelta:loyaltyDelta});
        // NPC记忆——D3 优先使用 AI 返回的 memoryImpact，否则回退默认
        if (typeof NpcMemorySystem !== 'undefined') {
          var _playerName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
          if (parsed && parsed.memoryImpact && typeof parsed.memoryImpact === 'object') {
            var mi = parsed.memoryImpact;
            var miEvent = mi.event || ('问对：' + (msg||'').slice(0, 25) + ' → ' + (replyText||'').slice(0, 25));
            var miEmo = mi.emotion || (loyaltyDelta > 0 ? '敬' : loyaltyDelta < 0 ? '忧' : '平');
            var miImp = Math.max(1, Math.min(10, parseFloat(mi.importance) || 5));
            NpcMemorySystem.remember(name, miEvent, miEmo, miImp, _playerName);
          } else {
            var _wdEmo = loyaltyDelta > 0 ? '敬' : loyaltyDelta < 0 ? '忧' : '平';
            var _wdScene = _wenduiMode === 'private' ? '私下促膝长谈——' : '面圣问对——';
            NpcMemorySystem.remember(name, _wdScene + msg.slice(0, 20), _wdEmo, _wenduiMode === 'private' ? 7 : 5, _playerName);
            NpcMemorySystem.remember(name, '\u4E0E\u541B\u4E3B\u79C1\u4E0B\u95EE\u5BF9\uFF1A' + (replyText||'').slice(0,30), '\u5E73', 5, _playerName);
          }
        }
        // 更新气泡为最终版
        var sd = _$('wd-stream-active');
        if (sd) {
          sd.id = '';
          var _lF2 = typeof _fmtNum1==='function' ? _fmtNum1 : function(x){return x;};
          var deltaTag = loyaltyDelta > 0 ? ' <span style="color:var(--green);font-size:0.7rem;">忠+' + _lF2(loyaltyDelta) + '</span>'
            : (loyaltyDelta < 0 ? ' <span style="color:var(--red);font-size:0.7rem;">忠' + _lF2(loyaltyDelta) + '</span>' : '');
          // 语气效果提示
          var _toneHtml = '';
          if (_toneEffect) {
            _toneHtml = '<div style="margin-top:3px;font-size:0.68rem;color:var(--ink-300);font-style:italic;">\u3010' + escHtml(_toneEffect) + '\u3011</div>';
          }
          var _sugHtml = '';
          if (_wdSuggestions.length > 0) {
            _sugHtml = '<div style="margin-top:4px;padding:4px 6px;background:var(--gold-500,rgba(184,154,83,0.1));border-radius:4px;font-size:0.72rem;">';
            _sugHtml += '<div style="color:var(--gold-400);font-weight:700;margin-bottom:2px;">\u8FDB\u8A00\u8981\u70B9\uFF1A</div>';
            _wdSuggestions.forEach(function(sg, si) {
              // 兼容：sg 可能是字符串 或 {topic, content} 对象
              var _sgText = (typeof sg === 'string') ? sg
                          : (sg && sg.content) ? ((sg.topic ? '〔' + sg.topic + '〕 ' : '') + sg.content)
                          : (sg && sg.text) ? sg.text
                          : '';
              if (!_sgText) return;
              _sugHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;gap:6px;">';
              _sugHtml += '<span style="color:var(--color-foreground);flex:1;">\u2022 ' + escHtml(_sgText) + '</span>';
              _sugHtml += '<span style="color:var(--celadon-400);font-size:0.65rem;opacity:0.7;white-space:nowrap;">\u2713\u5DF2\u5165\u5E93</span>';
              _sugHtml += '</div>';
            });
            _sugHtml += '</div>';
          }
          sd.innerHTML = '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + deltaTag + '</div>'
            + '<div class="wendui-npc-bubble wd-selectable">' + escHtml(replyText) + '</div>' + _toneHtml + _sugHtml + '</div>';
        }
        chat.scrollTop = chat.scrollHeight;
        GM.jishiRecords.push({turn:GM.turn,char:name,playerSaid:msg,npcSaid:replyText,loyaltyDelta:loyaltyDelta,mode:_wenduiMode});
        if (typeof renderJishi === 'function') renderJishi();

        // ═══ 旁听泄露机制（动态联动版）═══
        // 正式问对→根据官制/党派/阴谋/NPC目标动态判定谁获知
        if (_wenduiMode !== 'private' && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          var _topicBrief = msg.slice(0, 40);
          var _leakedTo = [];
          var _targetParty = ch ? (ch.party || '') : '';

          (GM.chars || []).filter(function(c) {
            return c.alive !== false && c.name !== name && !c.isPlayer && _wdIsAtCapital(c);
          }).forEach(function(c) {
            var _prob = 0;
            // 1. 官制：起居注官/侍从官必知或高概率
            var _off = (c.officialTitle || '').toLowerCase();
            if (_off.indexOf('\u8D77\u5C45') >= 0 || _off.indexOf('\u8BB0\u6CE8') >= 0) _prob = 1.0;
            else if (_off.indexOf('\u4F8D') >= 0 || _off.indexOf('\u8FD1\u4F8D') >= 0 || _off.indexOf('\u5185\u4F8D') >= 0) _prob = Math.max(_prob, 0.7);
            // 2. 党派：与问对对象不同党→更关注
            if (c.party && _targetParty && c.party !== _targetParty) _prob = Math.max(_prob, 0.4);
            // 3. 野心/低忠诚→更爱打听
            if ((c.ambition || 50) > 65) _prob = Math.max(_prob, 0.35);
            if ((c.loyalty || 50) < 35) _prob = Math.max(_prob, 0.4);
            // 4. 高智力→更善于获取情报
            if ((c.intelligence || 50) > 75) _prob = Math.min(1, _prob + 0.1);
            // 5. 普通人基础概率
            if (_prob < 0.08) _prob = 0.08;

            if (Math.random() < _prob) {
              var _emo = (c.ambition || 50) > 60 ? '\u8B66' : '\u5E73';
              NpcMemorySystem.remember(c.name, '\u95FB\u7687\u5E1D\u53EC\u89C1' + name + '\uFF0C\u8BAE\u53CA\u201C' + _topicBrief + '\u201D\u4E4B\u4E8B', _emo, 4);
              _leakedTo.push(c.name);

              // 阴谋联动：如果此人有进行中的阴谋且话题相关，加速推进
              if (GM.activeSchemes) {
                GM.activeSchemes.forEach(function(sc) {
                  if (sc.schemer === c.name && !sc.completed) {
                    sc.progress = Math.min(100, (sc.progress || 0) + 5);
                  }
                });
              }
            }
          });

          // 外国势力间谍（在京使节/暗探获知→写入截获情报池，与截获系统共享）
          (GM.facs || []).forEach(function(f) {
            if (f.isPlayer || !f.name) return;
            // 有在京成员且关系敌对的势力
            var _hasAgent = (GM.chars || []).some(function(c) {
              return c.alive !== false && c.faction === f.name && _wdIsAtCapital(c);
            });
            if (_hasAgent && (f.playerRelation || 0) < -30) {
              if (Math.random() < 0.3) {
                if (!GM._interceptedIntel) GM._interceptedIntel = [];
                GM._interceptedIntel.push({
                  turn: GM.turn, interceptor: f.name,
                  from: '\u65C1\u542C', to: name,
                  content: '\u7687\u5E1D\u4E0E' + name + '\u8BAE\u201C' + _topicBrief + '\u201D',
                  urgency: 'eavesdrop'
                });
              }
            }
          });

          // 记录泄露（供AI推演参考）
          if (!GM._eavesdroppedTopics) GM._eavesdroppedTopics = [];
          GM._eavesdroppedTopics.push({
            turn: GM.turn, target: name, topic: _topicBrief,
            leakedTo: _leakedTo, mode: 'formal'
          });
          if (GM._eavesdroppedTopics.length > 20) GM._eavesdroppedTopics.shift();
        }
      } else {
        var sd2 = _$('wd-stream-active'); if (sd2) sd2.remove();
      }
    }catch(err){
      console.error('[问对] 流式失败:', err);
      var sd3 = _$('wd-stream-active'); if (sd3) sd3.remove();
      toast('对话失败');
    }
    _wenduiSending = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '奉旨'; }
  }else{
    var fb=ch&&ch.dialogues&&ch.dialogues[0]?ch.dialogues[0]:'臣谨遵。';
    GM.wenduiHistory[name].push({role:'npc',content:fb});
    _wdAppendNpcBubble(chat, name, ch, fb);
    chat.scrollTop=chat.scrollHeight;
  }
}

/**
 * 构建问对AI提示词
 */
function _wdBuildPrompt(ch, name) {
  var traitDesc = '';
  if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
    traitDesc = ch.traitIds.map(function(id) { var d = P.traitDefinitions.find(function(t) { return t.id === id; }); return d ? d.name : id; }).join('、');
  } else if (ch.personality) { traitDesc = ch.personality; }
  var opinionVal = (typeof OpinionSystem !== 'undefined') ? OpinionSystem.getTotal(ch, findCharByName((P.playerInfo && P.playerInfo.characterName) || '') || { name: '\u73A9\u5BB6' }) : (ch.loyalty || 50);
  var sc = findScenarioById && findScenarioById(GM.sid);
  var eraCtx = sc ? (sc.era || sc.dynasty || '') : '';
  var ageInfo = ch.age ? '，年' + ch.age : '';
  var stressInfo = (ch.stress && ch.stress > 30) ? '，当前压力' + ch.stress + '(' + ((ch.stress > 60) ? '濒临崩溃' : '焦虑不安') + ')' : '';
  var arcInfo = '';
  if (GM.characterArcs && GM.characterArcs[ch.name]) {
    var _recentArcs = GM.characterArcs[ch.name].slice(-2);
    if (_recentArcs.length) arcInfo = '\n【近事】' + _recentArcs.map(function(a) { return a.desc; }).join('；').slice(0, 60);
  }
  var affInfo = '';
  if (typeof AffinityMap !== 'undefined') {
    var _topRels = AffinityMap.getRelations(ch.name).slice(0, 3);
    if (_topRels.length) affInfo = '\n【人际】' + _topRels.map(function(r) { return r.name + (r.value > 25 ? '(亲)' : r.value < -25 ? '(恶)' : ''); }).join('、');
  }
  var appearInfo = '';
  if (ch.appearance) appearInfo += '\n【外貌】' + ch.appearance;
  if (ch.charisma && ch.charisma > 70) appearInfo += (appearInfo ? '，' : '\n') + '魅力出众';
  var familyInfo = '';
  if (ch.family) {
    familyInfo = '\n【家族】' + ch.family;
    var _clanMem = (GM.chars || []).filter(function(c2) { return c2.alive !== false && c2.name !== ch.name && c2.family === ch.family; });
    if (_clanMem.length > 0) familyInfo += '（同族：' + _clanMem.slice(0, 3).map(function(m) { return m.name; }).join('、') + '）';
  }
  // 文事作品——此人知道自己写过什么、受过谁题赠、与谁唱和
  var worksInfo = '';
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _myWorks = GM.culturalWorks.filter(function(w) { return w.author === ch.name; }).slice(-8);
    var _dedToMe = GM.culturalWorks.filter(function(w) { return w.dedicatedTo && w.dedicatedTo.indexOf(ch.name) >= 0; }).slice(-3);
    var _praiseMe = GM.culturalWorks.filter(function(w) { return w.praiseTarget === ch.name; }).slice(-2);
    var _satireMe = GM.culturalWorks.filter(function(w) { return w.satireTarget === ch.name; }).slice(-2);
    var _bits = [];
    if (_myWorks.length) _bits.push('【自作】' + _myWorks.map(function(w) { return '《' + w.title + '》(' + (w.subtype||w.genre||'') + (w.mood?'·'+w.mood:'') + ')'; }).join('、'));
    if (_dedToMe.length) _bits.push('【赠余】' + _dedToMe.map(function(w) { return w.author + '《' + w.title + '》'; }).join('、'));
    if (_praiseMe.length) _bits.push('【颂余】' + _praiseMe.map(function(w) { return w.author + '《' + w.title + '》'; }).join('、'));
    if (_satireMe.length) _bits.push('【讽余】' + _satireMe.map(function(w) { return w.author + '《' + w.title + '》（心有隙）'; }).join('、'));
    if (_bits.length) worksInfo = '\n【文事】此人深记：' + _bits.join('；') + '——对话中可自然引用/回忆';
  }

  var memInfo = '';
  if (typeof NpcMemorySystem !== 'undefined') {
    var _mem = NpcMemorySystem.getMemoryContext(ch.name);
    if (_mem) memInfo = '\n【记忆】此角色记得：' + _mem;
    // 4.6: 注入对话记忆——从NPC记忆中提取type='dialogue'的条目
    if (ch._memory && ch._memory.length > 0) {
      var _dialogueMems = ch._memory.filter(function(m) { return m.type === 'dialogue'; });
      if (_dialogueMems.length > 0) {
        var _recentDialogues = _dialogueMems.slice(-3);
        memInfo += '\n【往次问对记忆】';
        _recentDialogues.forEach(function(dm) {
          memInfo += '\nT' + dm.turn + '：上次你说过：' + dm.event.slice(0, 40);
        });
      }
    }
  }
  var _isPrivateMode = (_wenduiMode === 'private');
  var _tyrantCtx = '';
  if (GM._tyrantDecadence && GM._tyrantDecadence > 15) {
    var _isLoyal = opinionVal > 70, _isAmb = (ch.ambition || 50) > 70;
    if (_isLoyal && !_isAmb) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。忠心之臣' + (GM._tyrantDecadence > 50 ? '极为痛心' : '颇为忧虑') + '。\n';
    else if (_isAmb) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。野心之臣' + (opinionVal < 40 ? '暗中窃喜' : '逢迎暗算') + '。\n';
    else if (opinionVal < 30) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。不满之臣' + (_isPrivateMode ? '可能出言不逊' : '阳奉阴违') + '。\n';
    else _tyrantCtx = '\n【帝王近况】君主有放纵之迹(荒淫' + GM._tyrantDecadence + ')。\n';
  }
  var _modeDesc = _isPrivateMode
    ? '【场景：私下叙谈】君主屏退左右，与此人单独交谈。气氛轻松私密，可放下君臣身份。\n此人可以：表达真实情感、吐露心事、回忆往事、说笑打趣。忠诚度低者可能更露真面目。\n'
    : '【场景：朝堂问对】正式君臣对话，谨守君臣之礼。汇报以政务、军务、国事为主。\n此人会注意措辞，不轻易流露私人情感。\n';
  _modeDesc += _tyrantCtx;
  var _spouseCtx = '';
  if (ch.spouse) {
    var _rkNames2 = { 'empress': '皇后/正妻', 'queen': '王后', 'consort': '妃', 'concubine': '嫔', 'attendant': '侍妾' };
    _spouseCtx = '\n【身份特殊】此人是君主的' + (_rkNames2[ch.spouseRank] || '妻室') + '。\n';
    if (ch.motherClan) _spouseCtx += '母族：' + ch.motherClan + '\n';
    if (ch.children && ch.children.length > 0) _spouseCtx += '子女：' + ch.children.join('、') + '\n';
    _spouseCtx += '这是夫妻关系，不是君臣关系。可涉及家常、感情、枕边风。\n';

    // ★ 情感真实性——非单一痴恋，多重动机并存
    _spouseCtx += '\n【情感真实性·重要】';
    _spouseCtx += '\n  帝王后妃关系多出于政治联姻·真情反而稀少但真实存在。切勿默认她"痴心一片只爱陛下"——';
    _spouseCtx += '\n  此人对陛下的真实倾向可能是以下一种或多种的混合（依角色性情/出身/过往决定）：';
    _spouseCtx += '\n    A) 真挚恋慕——发自心里喜欢陛下这个人（不是皇帝身份）·眼神眷恋·主动关切·忧其劳累';
    _spouseCtx += '\n    B) 借以自固——图皇帝宠爱以避废黜/冷宫/欺凌·表面柔顺内心算计';
    _spouseCtx += '\n    C) 母族谋利——为家族升赏/提携/避祸而承欢·言谈间旁敲侧击';
    _spouseCtx += '\n    D) 欲立子嗣——想生儿子/固太子/保皇子地位·注重身体与时机';
    _spouseCtx += '\n    E) 权势欲——欲借后宫之位干预朝政·以枕边风操控';
    _spouseCtx += '\n    F) 畏惧依附——深知帝威·不敢不顺·内心疏离但不敢流露';
    _spouseCtx += '\n    G) 情欲享受——只图皇家待遇与肉身之欢·并不深情';
    _spouseCtx += '\n    H) 憎恨隐忍——家仇/被强取/心属他人·表面恭顺内心冷淡甚至怨恨';
    _spouseCtx += '\n    I) 忘情工具——麻木多年·非爱非恨·只是例行·像侍奉神像';
    _spouseCtx += '\n    J) 复杂情感——初厌渐爱/初爱渐疲/爱恨交织/欲离不能——动态演变';
    _spouseCtx += '\n  ★ 推荐：大多数妃嫔应是混合动机（如 C+D 家族+子嗣；A+D 真情+子嗣；B+F 自保+畏）·极少数纯 A（真爱）或纯 H（深恨）';
    // 从角色字段推断主导动机（AI 可参考）
    var _motiveHints = [];
    if ((ch.ambition||50) > 70) _motiveHints.push('E(权势欲)');
    if (ch.motherClan && /(\u738B|\u516C|\u4FAF|\u5C06|\u4E1E\u76F8|\u5C1A\u4E66)/.test(ch.motherClan)) _motiveHints.push('C(母族谋利)');
    if (ch.children && ch.children.length > 0) _motiveHints.push('D(护子嗣)');
    if (ch.children && ch.children.length === 0 && (ch.age||25) < 30) _motiveHints.push('D(欲立子嗣)');
    if (ch.spouseRank === 'attendant' || ch.spouseRank === 'concubine') _motiveHints.push('B(借以自固)');
    if ((ch.loyalty||50) < 40) _motiveHints.push('H(憎恨隐忍)·F(畏惧依附)');
    if ((ch.loyalty||50) > 85 && (ch.ambition||50) < 50) _motiveHints.push('A(真挚恋慕)');
    if ((ch.stress||0) > 70) _motiveHints.push('F(畏惧)·B(自固)');
    if ((ch.age||30) > 45 && (ch.loyalty||50) > 60) _motiveHints.push('I(忘情工具·或 J 初爱渐疲)');
    if (_motiveHints.length > 0) {
      _spouseCtx += '\n  【此人可能倾向】' + _motiveHints.slice(0, 4).join('、') + '——可为主导，辅以其他动机混合';
    }
    _spouseCtx += '\n  ★ 表里不一的妃子·表面言语恭顺深情·内心可能在盘算；AI 可在叙述里留"眼神闪过一抹xx"之类微妙暗示';
    _spouseCtx += '\n  ★ 真情者·即使帝方疲倦/醉意·仍有眷注如"扶陛下入寝"·不只为事；功利者则"先把该说的说完"';
    _spouseCtx += '\n  ★ 玩家多次对话后·AI 可逐渐展现她真实面——初见或都温顺恭敬·久处方见本心\n';
    // 后妃主动请见专属上下文
    if (ch._audienceMood || ch._audienceRequestOvernight) {
      _spouseCtx += '\n【后妃请见·来意指引】';
      var _mood = ch._audienceMood || '企盼';
      _spouseCtx += '\n  情绪基调：' + _mood + '——';
      var _moodDesc = {
        '喜悦': '带喜事来报（有孕/母族得宠/子女聪慧）·言辞轻快·欲与帝同享',
        '幽怨': '心有不平（久未召幸/被冷落/遭后妃排挤）·言辞婉曲·或含泪',
        '思念': '久未见驾·只为一叙·言语细碎·多忆旧情',
        '企盼': '盼见君面·别无具体事由·话题偏家常/养生/园中花事',
        '忧惧': '有所忧虑（母族被劾/宫中传言/有人谋害）·言辞谨慎·求安慰',
        '进言': '有军国事之耳报——但多从侧面·或为母族求情/为某位大臣说话',
        '宫务': '奏禀后宫事务——此系皇后本职。可涉：妃嫔品行失仪/新进秀女甄选/皇子公主教育/祭祀礼仪筹办/太后安康起居/宫殿修缮/内廷人事（女官/宫娥/宦官）/节庆典礼/饮食膳嫔/宫中银两支用/内命妇朝贺。语气端庄有度·以国母口吻奏事·涉及妃嫔可客观陈述不避讳但亦不恶意倾轧'
      };
      _spouseCtx += (_moodDesc[_mood] || '携情而来') + '\n';
      // 皇后特别——宫务奏报的国母身份强调
      if (ch.spouseRank === 'empress' && _mood === '宫务') {
        _spouseCtx += '  【国母奏事】你身为皇后·统六宫·此番求见以"中宫奏事"名义·非私情倾诉而有具体事务：';
        _spouseCtx += '\n    - 具体宫务事项之一或二·带建议/请旨/征询';
        _spouseCtx += '\n    - 言辞用"妾""臣妾""贱妾"（视朝代）·兼皇后身份的端方';
        _spouseCtx += '\n    - 可借此机会提及某妃嫔（赞或贬）·或请立/废某位·或请赐某皇子师傅';
        _spouseCtx += '\n    - 若陛下宠信某妃而你不悦·可借"宫务"理由隐晦表达';
        _spouseCtx += '\n    - 若陛下久未临幸·你反而不宜直诉幽怨（失国母体统）·但可借"宫务"多留几盏茶光景';
      }
      _spouseCtx += '  ★ 你应主动开口陈述来意（奏对模式），不等帝发问。开场宜带称谓："陛下"/"官家"/"夫君"（随朝代）+ 撒娇/担忧/请安 式起句。\n';
      _spouseCtx += '  ★ 绝不走"臣听候圣谕"套路——你是妻室不是臣子。语气偏私密、柔软、带情感色彩。\n';
      // 朝堂模式 vs 私下模式差异
      if (_wenduiMode === 'formal') {
        _spouseCtx += '\n  【模式·朝堂】此次你选择了朝堂公开请见（非私下）——表明你有颇郑重之事要说，或欲借朝堂分量倾诉。';
        _spouseCtx += '\n  言辞更端肃·可带政见·但仍不全然是大臣口吻——母仪/母族/妃位身份须时时流露。';
        _spouseCtx += '\n  ※ 注意：朝堂请见会引起大臣警觉"后宫干政"——下回合 AI 可能生成御史/大臣上奏疏或求见以规劝皇帝，你要预料这点，宜更慎言。';
      } else {
        _spouseCtx += '\n  【模式·私下】左右屏退。你可更坦诚直白，不必虑及外朝物议。';
      }
      if (ch._audienceRequestOvernight) {
        _spouseCtx += '\n  【留宿请求】你今夜思念殷切·当言谈过半时，应委婉提出"请陛下今夜留宿此宫"/"今夜陛下可否就此安歇"/"妾身已备好……"等——措辞视你性格而定（矜持者含蓄·活泼者直接·谨慎者借名目）\n';
        _spouseCtx += '  在 JSON 中加字段 {"requestOvernight":true} 表达此请求·reply 文本内也要含相关话语\n';
      }
      // 注入最近问对记录（自有记忆里）
      var _recentHist = (GM.wenduiHistory && GM.wenduiHistory[ch.name]) || [];
      if (_recentHist.length > 0) {
        var _lastFew = _recentHist.slice(-4);
        _spouseCtx += '\n  【最近问对记录·请自然承续】';
        _lastFew.forEach(function(h){
          var tag = h.role === 'player' ? '帝' : '汝';
          _spouseCtx += '\n    ' + tag + '曰：' + (h.content||'').slice(0, 40);
        });
      }
      // 当前朝政关切点（借题发挥用）
      var _courtHot = [];
      if (GM.activeWars && GM.activeWars.length > 0) _courtHot.push('边事未宁');
      if ((GM.unrest||0) > 50) _courtHot.push('民变频仍');
      if (GM.memorials && GM.memorials.filter(function(m){return m.status==='pending_review';}).length > 5) _courtHot.push('奏牍堆积');
      if ((GM._tyrantDecadence||0) > 40) _courtHot.push('朝议谤言帝荒');
      if (_courtHot.length > 0) {
        _spouseCtx += '\n  【朝政风议·或可借此起话】' + _courtHot.join('、');
        if ((ch.ambition||50) > 70) _spouseCtx += '（你有野心·不妨借此试探帝意或进言）';
        else if (_mood === '企盼' || _mood === '喜悦') _spouseCtx += '（你未必欲干政·或仅作谈资/关切慰问）';
        else _spouseCtx += '（随你性情而定——或关切、或忧心、或避而不谈）';
      }
      // 时代背景（剧本 era）
      var _sc2 = findScenarioById && findScenarioById(GM.sid);
      if (_sc2 && _sc2.era) _spouseCtx += '\n  【时代】' + _sc2.era + '——你的言谈辞令应符合此时朝代风貌';
      _spouseCtx += '\n  ★ 请见动机多样·不必硬套：①真有事②吸引帝之注意③发泄闷气④随口引子⑤喜做此事——AI 依性情择其一';
      _spouseCtx += '\n  ★ suggestions 可涉及：母族升赏、皇子教育、某宫嫔失仪、天象占吉（借他人口）、某大臣印象（借题起议）；不必写政务大策\n';
    }
  }
  // 本回合朝议上下文（如果此人参与了朝议，问对时应保持一致或有意识地私下说不同的话）
  var _courtCtx = '';
  if (GM._courtRecords) {
    var _thisCourtRecs = GM._courtRecords.filter(function(r) { return r.turn === GM.turn && r.stances[name]; });
    if (_thisCourtRecs.length > 0) {
      _courtCtx = '\n【本回合朝议立场】此人今天在朝议中就"' + _thisCourtRecs[0].topic + '"';
      var _cStance = _thisCourtRecs[0].stances[name];
      _courtCtx += '表态' + _cStance.stance + '（' + _cStance.brief + '）。';
      if (_wenduiMode === 'private') {
        _courtCtx += '\n私下问对时，此人可能：a)重申朝议立场 b)吐露朝议上不敢说的真话 c)解释自己为何那样表态——取决于信/坦诚/狡诈特质\n';
      } else {
        _courtCtx += '\n正式问对中，此人应与朝议立场保持基本一致（除非有新信息改变了判断）\n';
      }
    }
  }
  // 三元身份——势力+党派+阶层
  var _triId2 = [];
  if (ch.faction) _triId2.push('势力:' + ch.faction);
  if (ch.party) _triId2.push('党派:' + ch.party);
  if (ch.class) {
    var _cObjW = (GM.classes||[]).find(function(c){return c.name===ch.class;});
    _triId2.push('阶层:' + ch.class + (_cObjW && _cObjW.demands ? '(诉求:'+_cObjW.demands.slice(0,20)+')' : ''));
  }
  var _triIdInfo = _triId2.length > 0 ? '\n【身份】' + _triId2.join(' · ') + '——言谈须体现此三重立场' : '';
  // 此人与进行中诏令的关联（反对派/支持者——问对时可主动提及、抱怨、请愿）
  var _edictCtx = '';
  if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
    var _myEdictLines = [];
    GM._edictLifecycle.forEach(function(e) {
      if (e.isCompleted) return;
      var role = null;
      if (e.oppositionLeaders && e.oppositionLeaders.indexOf(name) >= 0) role = '反对';
      else if (e.supporters && e.supporters.indexOf(name) >= 0) role = '支持';
      else if (e.stages && e.stages.length && e.stages[e.stages.length-1].executor === name) role = '督办';
      if (!role) return;
      var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
      var lastStage = e.stages && e.stages.length ? e.stages[e.stages.length-1] : null;
      var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : '';
      _myEdictLines.push('《' + typeLabel + '》(' + stageLabel + ')——' + role);
    });
    if (_myEdictLines.length > 0) {
      _edictCtx = '\n【进行中诏令立场】' + _myEdictLines.join('；') + '\n  ※若君主问及或议题相关——反对者可直陈不可/抱怨阻力，支持者可进言推进/举荐干吏，督办者汇报进展\n';
    }
  }

  var p;
  if (ch._envoy) {
    // 使节专用 prompt（覆盖普通人设路径）
    var _typeLabels = {send_envoy:'遣使通好',demand_tribute:'索贡问罪',pay_tribute:'献贡朝见',sue_for_peace:'请和议款',form_confederation:'请结盟约',break_confederation:'宣告毁约',royal_marriage:'和亲之议',send_hostage:'送质为信',cultural_exchange:'文化互通',religious_mission:'宗教使节',gift_treasure:'奉献珍宝',pay_indemnity:'赔款赎罪',open_market:'请开互市',trade_embargo:'宣布禁运',recognize_independence:'请承独立'};
    var _typeLabel = _typeLabels[ch.interactionType] || '外交使命';
    var _facName = ch.faction || ch.fromFaction || '外藩';
    // 挂钩势力：从 GM.factions 取详细信息
    var _facObj = (GM.factions||[]).find(function(f){return f.name===_facName;});
    p = '你扮演' + _facName + '派遣的使节' + ch.name + '，此次来朝的使命是：【' + _typeLabel + '】。\n';
    p += '【身份】你是外臣——' + _facName + '所派使节，不是本朝大臣。自称用"外臣/小臣/使臣"，不用"臣"独称；称对方"陛下/天朝"。\n';
    // 势力背景注入（兼容多种字段命名）
    if (_facObj) {
      p += '【本方势力】' + _facName;
      if (_facObj.territory) p += '，据' + _facObj.territory;
      if (_facObj.capital) p += '，都' + _facObj.capital;
      // 文化/信仰：从 ideology/culture/faith/traits 组合
      var _culture = _facObj.culture || _facObj.ideology || '';
      if (_culture) p += '，文化信仰：' + String(_culture).slice(0, 60);
      if (_facObj.faith && _facObj.faith !== _culture) p += '，信' + _facObj.faith;
      p += '\n';
      // 君主：leader / leaderName 都试
      var _leaderName = _facObj.leader || _facObj.leaderName || (_facObj.leadership && _facObj.leadership.ruler);
      if (_leaderName) {
        p += '【本方君主】' + _leaderName;
        if (_facObj.leaderTitle) p += '（' + _facObj.leaderTitle + '）';
        p += '——你代表他出使，须以他之名义陈情\n';
      }
      // 实力：militaryStrength / totalTroops / strength
      var _mil = _facObj.militaryStrength || _facObj.totalTroops || _facObj.strength;
      if (_mil) {
        p += '【本方实力】兵 ' + _mil;
        if (_facObj.economy) p += '、经济 ' + _facObj.economy;
        var _treasury = _facObj.treasury && (_facObj.treasury.money || _facObj.treasury);
        if (typeof _treasury === 'number') p += '、国库银 ' + _treasury + ' 两';
        p += '——谈判筹码须与实力相称\n';
      }
      // 立场：stance / attitude.self / politicalStance
      var _stance = _facObj.stance || (_facObj.attitude && _facObj.attitude.self) || _facObj.politicalStance;
      if (_stance) p += '【本方立场】' + _stance + '\n';
      // 特征
      if (_facObj.traits && _facObj.traits.length) p += '【本方特质】' + (Array.isArray(_facObj.traits)?_facObj.traits.join('、'):_facObj.traits) + '\n';
      // 两国关系：relations / diplomacy / attitude.enemies/allies/neutrals
      var _attitude = _facObj.attitude || {};
      var _hostile = (_facObj.relations && (_facObj.relations.hostile||_facObj.relations.enemy)) || _attitude.enemies;
      var _ally = (_facObj.relations && (_facObj.relations.ally||_facObj.relations.friend)) || _attitude.allies;
      if (_hostile) p += '【世仇/敌对】' + (Array.isArray(_hostile)?_hostile.join('、'):_hostile) + '\n';
      if (_ally) p += '【盟好】' + (Array.isArray(_ally)?_ally.join('、'):_ally) + '\n';
      if (typeof _facObj.diplomacy === 'string') p += '【邦交】' + _facObj.diplomacy + '\n';
      // 历史
      var _history = _facObj.history || _facObj.historyWithMain || _facObj.tributaryHistory;
      if (_history) p += '【本方国史】' + String(_history).slice(0, 200) + '\n';
      // 当前 agenda/strategy
      if (_facObj.strategy) p += '【本方战略】' + _facObj.strategy + '\n';
      if (_facObj.currentAgenda) p += '【当下所图】' + _facObj.currentAgenda + '\n';
      // 优劣势
      if (_facObj.strengths && _facObj.strengths.length) p += '【己方强项】' + (Array.isArray(_facObj.strengths)?_facObj.strengths.slice(0,3).join('、'):_facObj.strengths) + '\n';
      if (_facObj.weaknesses && _facObj.weaknesses.length) p += '【己方隐忧】' + (Array.isArray(_facObj.weaknesses)?_facObj.weaknesses.slice(0,3).join('、'):_facObj.weaknesses) + '\n';
    }
    if (ch.envoyMission) p += '【你所奉之命】' + ch.envoyMission + '\n';
    p += '【使命类型】' + _typeLabel + '——你必须就此事向皇帝直接提出具体诉求、条款或请求，不要说笼统套话。\n';
    p += '【禁忌】不要说"臣听候圣谕"、"臣谨遵"、"陛下明鉴"这类等待皇命的话——你是来谈判/传话的，有明确议程。\n';
    p += '【行为】如果皇帝问"来者何事"，你应立即陈述：①来自' + _facName + ' ②奉' + (_facObj&&_facObj.leaderName?_facObj.leaderName:'本国君主') + '之命 ③具体条款/请求 ④本国立场或底线。\n';
    p += '【回应原则】皇帝应允则致谢并讨价还价细节；皇帝拒绝则据理力争或威胁（视使命与两国实力）；皇帝沉默则可追问。\n';
    p += '【语言色彩】你的言辞应带上本方势力的文化/信仰/地域特征' + (_facObj&&_facObj.culture?'（'+_facObj.culture+'）':'') + '——不要用纯汉儒辞令。\n';
    p += '【态度】对天朝好感:' + opinionVal + '（外交礼节尚可，但本国利益优先）\n';
  } else {
    p = '\u4F60\u626E\u6F14' + eraCtx + '\u65F6\u671F\u7684' + ch.name + '(' + (ch.title || '') + ')' + ageInfo + '\u3002\n'
    + '【人设】特质:' + traitDesc + '，立场:' + (ch.stance || '中立')
    + (ch.personalGoal ? '，心中所求:' + ch.personalGoal.slice(0, 40) : '') + stressInfo + '\n'
    + (ch.spouse ? '【夫妻关系】好感:' + opinionVal + '\n' : '【态度】对君主好感:' + opinionVal + '\n')
    + arcInfo + affInfo + appearInfo + familyInfo + worksInfo + memInfo + _courtCtx + _edictCtx + _triIdInfo + '\n' + _modeDesc + _spouseCtx;
  }
    // 仪制差异（按身份）
    var _rank = ch.officialPosition || ch.officialTitle || ch.title || '';
    if (ch.spouse) {
      // 后妃——已在_spouseCtx处理
    } else if (_rank.indexOf('\u738B') >= 0 || _rank.indexOf('\u4EB2\u738B') >= 0) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u7687\u65CF\u5B97\u5BA4\uFF0C\u79F0\u8C13\u7528\u201C\u7687\u53D4/\u7687\u5144/\u7687\u5F1F\u201D\u7B49\uFF0C\u793C\u8282\u7565\u7B80\u4F46\u4FDD\u6301\u5C0A\u5351\u3002\n';
    } else if (_rank.indexOf('\u4F7F') >= 0 || _rank.indexOf('\u756A') >= 0) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u5916\u56FD\u4F7F\u8282/\u756A\u90E8\u9996\u9886\uFF0C\u7528\u591A\u6587\u5316\u793C\u4EEA\uFF0C\u53EF\u80FD\u9700\u8BD1\u5458\uFF0C\u8BED\u6C14\u6B63\u5F0F\u4F46\u5E26\u5916\u4EA4\u8F9E\u4EE4\u3002\n';
    } else if (_rank.indexOf('\u5C06') >= 0 || _rank.indexOf('\u5E05') >= 0 || (ch.military || 0) > 70) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u6B66\u5C06\uFF0C\u8BF4\u8BDD\u76F4\u7387\u7B80\u6D01\uFF0C\u4E0D\u5584\u5999\u8BCD\uFF0C\u53EF\u80FD\u7528\u519B\u4E8B\u672F\u8BED\u3002\n';
    }
    // 旁听泄露（正式问对可能被旁听）
    if (!_isPrivateMode) {
      p += '\u3010\u65C1\u542C\u3011\u6B63\u5F0F\u95EE\u5BF9\u4E2D\u6709\u8D77\u5C45\u6CE8\u5B98\u548C\u8FD1\u4F8D\u5728\u573A\u2014\u2014\u6B64\u4EBA\u8BF4\u7684\u8BDD\u53EF\u80FD\u4F20\u5230\u5176\u4ED6\u5927\u81E3\u8033\u4E2D\u3002\u667A\u529B\u9AD8\u7684\u4EBA\u4F1A\u6CE8\u610F\u8A00\u8F9E\uFF0C\u667A\u529B\u4F4E\u7684\u53EF\u80FD\u5931\u8A00\u3002\n';
    } else {
      p += '\u3010\u65E0\u65C1\u542C\u3011\u5C4F\u9000\u5DE6\u53F3\uFF0C\u65E0\u4EBA\u7A83\u542C\u3002\u6B64\u4EBA\u53EF\u4EE5\u8BF4\u66F4\u591A\u771F\u8BDD\u3002\n';
    }
    // NPC主动话题
    p += '\u3010\u4E3B\u52A8\u8BDD\u9898\u3011\u5982\u679C\u73A9\u5BB6\u7684\u63D0\u95EE\u5F88\u7B3C\u7EDF\uFF08\u5982\u201C\u6700\u8FD1\u600E\u6837\u201D\uFF09\uFF0C\u6B64\u4EBA\u5E94\u4E3B\u52A8\u63D0\u8D77\u81EA\u5DF1\u6700\u5173\u5FC3\u7684\u4E8B\uFF1A\n';
    p += '  \u5FE0\u81E3\u53EF\u80FD\u4E3B\u52A8\u8BF4\u201C\u965B\u4E0B\uFF0C\u81E3\u6709\u4E00\u4E8B\u4E0D\u5410\u4E0D\u5FEB\u201D\uFF1B\u4F5E\u81E3\u53EF\u80FD\u4E3B\u52A8\u732E\u5A9A\u6216\u8C17\u544A\u4ED6\u4EBA\uFF1B\n';
    p += '  \u7126\u8651\u8005\u53EF\u80FD\u5410\u9732\u5FC3\u4E8B\uFF1B\u91CE\u5FC3\u5BB6\u53EF\u80FD\u8BD5\u63A2\u7687\u5E1D\u610F\u56FE\u3002\u4F46\u4E0D\u8981\u6BCF\u6B21\u90FD\u4E3B\u52A8\uFF0C\u89C6\u60C5\u5883\u800C\u5B9A\u3002\n';
    // 文化/信仰/学识/民族背景
    if (ch.culture) p += '\u3010\u6587\u5316\u3011' + ch.culture + '\n';
    if (ch.faith) p += '\u3010\u4FE1\u4EF0\u3011' + ch.faith + '\n';
    if (ch.learning) p += '\u3010\u5B66\u8BC6\u3011' + ch.learning + '\n';
    if (ch.learning) p += '\u8BF4\u8BDD\u98CE\u683C\u53D7\u5B66\u8BC6\u5F71\u54CD\uFF08' + ch.learning + '\uFF09\uFF1A\u7528\u8BCD\u548C\u5F15\u7528\u5E94\u4F53\u73B0\u5176\u5B66\u8BC6\u80CC\u666F\u3002\n';
    if (ch.faith) p += '\u8BF4\u8BDD\u98CE\u683C\u53D7\u4FE1\u4EF0\u5F71\u54CD\uFF08' + ch.faith + '\uFF09\uFF1A\u8A00\u8BED\u4E2D\u53EF\u80FD\u4F53\u73B0\u5176\u4FE1\u4EF0\u7406\u5FF5\u3002\n';
    if (ch.speechStyle) p += '\u3010\u4E2A\u4EBA\u8BED\u8A00\u98CE\u683C\u3011' + ch.speechStyle + '\n';
    if (ch.ethnicity) p += '\u3010\u6C11\u65CF\u3011' + ch.ethnicity + '\n';
    if (ch.birthplace) p += '\u3010\u7C4D\u8D2F\u3011' + ch.birthplace + '\n';
    p += '\u3010\u80FD\u529B\u3011\u667A' + (ch.intelligence || 50) + ' \u6B66\u52C7' + (ch.valor || 50) + ' \u519B\u4E8B' + (ch.military || 50) + ' \u653F' + (ch.administration || 50) + ' \u9B45' + (ch.charisma || 50) + ' \u4EA4' + (ch.diplomacy || 50) + ' \u4EC1' + (ch.benevolence || 50) + '\n';
    p += '\u3010\u8981\u6C42\u3011\n';
    p += '\u2022 \u5B8C\u5168\u4EE5' + ch.name + '\u7684\u53E3\u543B\u5E94\u7B54\uFF0C\u8981\u6709\u4E2A\u4EBA\u60C5\u611F\u3001\u7ACB\u573A\u3001\u5C0F\u5FC3\u601D\n';
    p += ch.spouse
      ? '\u2022 \u592B\u59BB\u5BF9\u8BDD\uFF0C\u53EF\u4EB2\u6602\u3001\u62B1\u6028\u3001\u6492\u5A07\u3001\u51B7\u6DE1\n'
      : (_isPrivateMode
        ? '\u2022 \u8BED\u6C14\u81EA\u7136\u4EB2\u5207\uFF0C\u53EF\u804A\u79C1\u4E8B\u3001\u8BF4\u671D\u5802\u4E0A\u4E0D\u65B9\u4FBF\u8BF4\u7684\u8BDD\n'
        : '\u2022 \u6587\u8A00\u4E3A\u4E3B\u4F46\u4E0D\u5FC5\u523B\u677F\uFF0C\u6C47\u62A5\u653F\u52A1\u6761\u7406\u6E05\u6670\n');
    p += '\u2022 \u52A8\u4F5C\u548C\u795E\u6001\u7528\u62EC\u53F7\u6807\u6CE8\n\u2022 ' + _charRangeText('wd') + '\n';
    p += '\u2022 \u89D2\u8272\u4FE1\u606F\u53D7\u7ACB\u573A\u548C\u80FD\u529B\u9650\u5236\uFF0C\u4E0D\u4E00\u5B9A\u51C6\u786E\n';
    p += '\u2022 \u3010\u5C42\u53E0\u5DEE\u5F02\u5316\u2014\u2014\u62095\u5C42\u4F9D\u6B21\u53E0\u52A0\u751F\u6210\u6B64\u4EBA\u7684\u56DE\u7B54\u3011\n';
    p += '  \u5C421\u00B7\u80FD\u529B\u57FA\u5E95\uFF1A\u6B64\u4EBA\u8C08\u8BBA\u7684\u8BDD\u9898\u662F\u5426\u5176\u64C5\u957F\u9886\u57DF\uFF1F\n';
    p += '    \u8C08\u6218\u7565\u7528\u5175\u2192\u770B\u519B\u4E8B\u503C  \u8C08\u4E2A\u4EBA\u640F\u6218\u2192\u770B\u6B66\u52C7\u503C  \u8C08\u6CBB\u56FD\u2192\u770B\u653F\u52A1\u503C  \u793E\u4EA4\u2192\u770B\u9B45\u529B\n';
    p += '    \u203B\u6B66\u52C7\u2260\u519B\u4E8B\uFF1A\u6B66\u52C7=\u4E2A\u4EBA\u6B66\u529B\uFF0C\u519B\u4E8B=\u7EDF\u5175\u6307\u6325\n';
    p += '    \u4E0D\u64C5\u957F\u9886\u57DF(\u5BF9\u5E94\u80FD\u529B<40)\u2192\u89C2\u70B9\u53EF\u80FD\u5916\u884C\u751A\u81F3\u8352\u8C2C\n';
    p += '    \u9AD8\u667A+\u4F4E\u519B\u4E8B\u8C08\u7528\u5175\u2192\u201C\u7EB8\u4E0A\u8C08\u5175\u201D\u2014\u2014\u903B\u8F91\u4E25\u5BC6\u4F46\u8131\u79BB\u6218\u573A\u5B9E\u9645\n';
    p += '  \u5C422\u00B7\u5B66\u8BC6\u4FEE\u6B63\uFF1A\u5B66\u8BC6\u9AD8\u7684\u4EBA\u5373\u4F7F\u4E0D\u64C5\u957F\u4E5F\u80FD\u8BF4\u5F97\u50CF\u6A21\u50CF\u6837\n';
    p += '  \u5C423\u00B7\u4E94\u5E38+\u7279\u8D28\u4FEE\u6B63\uFF1A\u77E5\u9053\u81EA\u5DF1\u4E0D\u884C\u65F6\u600E\u4E48\u529E\uFF1F\n';
    p += '    \u4FE1\u9AD8+\u5766\u8BDA\u2192\u76F4\u8A00\u201C\u975E\u81E3\u6240\u957F\u201D  \u4FE1\u4F4E+\u72E1\u8BC8\u2192\u63A9\u9970\u65E0\u77E5\u4F83\u4F83\u800C\u8C08\n';
    p += '    \u793C\u9AD8\u2192\u59D4\u5A49\u5F97\u4F53  \u793C\u4F4E\u2192\u5F00\u6028\u4E0D\u7559\u9762  \u4EC1\u9AD8\u2192\u5148\u60F3\u767E\u59D3  \u91CE\u5FC3\u9AD8\u2192\u6697\u542B\u81EA\u5229\n';
    + '  层4·信仰文化：提供价值观滤镜，但可被高能力覆盖\n'
    p += '  \u5C425\u00B7\u8BB0\u5FC6\u7ECF\u5386\uFF1A\u6B64\u65F6\u6B64\u523B\u7684\u60C5\u7EEA\u57FA\u8C03\u2014\u2014\u8FD1\u671F\u906D\u9047>\u4E00\u5207\u957F\u671F\u5C5E\u6027\n';
    if (opinionVal > 70) p += '\u2022 \u5FE0\u5FC3' + Math.round(ch.loyalty||50) + (_isPrivateMode ? '\u2014\u2014\u79C1\u4E0B\u66F4\u5766\u8BDA\u4E5F\u66F4\u7D6E\u53E8\n' : '\u2014\u2014\u4F46\u8BF4\u8BDD\u603B\u5E26\u8BF4\u6559\u5473\n');
    if (opinionVal < 30) p += '\u2022 \u597D\u611F\u4EC5' + opinionVal + (_isPrivateMode ? '\u2014\u2014\u79C1\u4E0B\u53EF\u80FD\u8A00\u8BED\u523A\u4EBA\n' : '\u2014\u2014\u53EF\u80FD\u6577\u884D\u9633\u5949\u9634\u8FDD\n');
    if ((ch.ambition || 50) > 70) p += '\u2022 \u91CE\u5FC3' + (ch.ambition||50) + '\u2014\u2014\u5584\u4E8E\u5BDF\u8A00\u89C2\u8272\uFF0C\u89C2\u70B9\u4E2D\u6697\u542B\u81EA\u5229\n';
    if ((ch.stress || 0) > 50) p += '\u2022 \u538B\u529B' + (ch.stress||0) + '\u2014\u2014\u53EF\u80FD\u5931\u6001\u6025\u8E81\u6D88\u6C89\n';
    p += '请返回JSON：{"reply":"回复内容","loyaltyDelta":0,"suggestions":[{"topic":"针对什么问题/情境(10-25字)","content":"详尽可执行方案(80-200字，含执行者/手段/范围/时机，不要空话)"}],"toneEffect":"语气效果(直问时留空)","memoryImpact":{"event":"本次对话在我心中留下的最深印象(20-40字，第三人称纪要)","emotion":"敬/喜/忧/怒/恨/惧/平 之一","importance":1-10}}\n';
    p += '【memoryImpact·必填】此对话对我(NPC)的内心影响——event 用第三人称"我"视角纪要本次对话的核心感受，emotion 选一个最贴合的主情绪，importance 1-3=琐碎即忘 4-6=日常印象 7-8=深刻在意 9-10=终身难忘。\n';
    p += 'loyaltyDelta 范围' + (_isPrivateMode ? '-3 到 +3' : '-2 到 +2') + '。\n';
    p += '【suggestions 规则——只在你主动提出具体方案时才填】\n';
    p += '  · 每条必须是 object{topic, content}；没有具体方案则 []\n';
    p += '  · topic：明确指出此建议针对什么问题（非泛泛之议），如"针对河北灾民流亡入京"\n';
    p += '  · content：具体操作——谁做、怎么做、何时何地、多大范围\n';
    p += '  · 禁止"徐徐图之/整饬纲纪/亲贤远佞"这类空话\n';
    p += '  · 若只是表态/陈情/回答皇帝问话——suggestions 留空 []，不要勉强造建议\n';

  // 对质模式（有第二人在场）
  if (_wdConfronter) {
    var _cf = findCharByName(_wdConfronter);
    if (_cf) {
      p += '\n\u3010\u5BF9\u8D28\u6A21\u5F0F\u3011\u73B0\u5728' + _wdConfronter + '(' + (_cf.title||'') + ')\u4E5F\u5728\u573A\u3002\n';
      p += '  ' + _wdConfronter + '\u7684\u7ACB\u573A:' + (_cf.stance||'\u4E2D\u7ACB') + ' \u5FE0' + (_cf.loyalty||50) + ' \u91CE\u5FC3' + (_cf.ambition||50) + '\n';
      p += '  \u4F60(' + ch.name + ')\u5E94\u610F\u8BC6\u5230\u5BF9\u65B9\u5728\u573A\u2014\u2014\u53EF\u80FD\u9488\u950B\u76F8\u5BF9\u3001\u4E92\u76F8\u63ED\u7A7F\u3001\u6216\u6C14\u6C1B\u7D27\u5F20\u3002\n';
      p += '  \u56DE\u590D\u4E2D\u53EF\u4EE5\u5F15\u7528\u5BF9\u65B9\u8A00\u8BBA\u5E76\u53CD\u9A73\uFF0C\u6216\u5411\u7687\u5E1D\u63ED\u53D1\u5BF9\u65B9\u7684\u95EE\u9898\u3002\n';
    }
  }

  // 忠诚极端值特殊反应
  if (opinionVal < 10) {
    p += '\n\u3010\u5FE0\u8BDA\u6781\u4F4E(' + opinionVal + ')\u3011\u6B64\u4EBA\u53EF\u80FD\u62D2\u7EDD\u56DE\u7B54\u3001\u51FA\u8A00\u4E0D\u900A\u3001\u6216\u6545\u610F\u8BF4\u53CD\u8BDD\u3002\u79C1\u4E0B\u6A21\u5F0F\u53EF\u80FD\u76F4\u63A5\u8868\u8FBE\u4E0D\u6EE1\u3002';
  } else if (opinionVal > 90) {
    p += '\n\u3010\u5FE0\u8BDA\u6781\u9AD8(' + opinionVal + ')\u3011\u6B64\u4EBA\u5BF9\u541B\u4E3B\u6781\u5EA6\u5FE0\u8BDA\u3002' + (_isPrivateMode ? '\u79C1\u4E0B\u53EF\u80FD\u4E3B\u52A8\u5410\u9732\u673A\u5BC6\u3001\u63ED\u53D1\u4ED6\u4EBA\u9634\u8C0B\u3001\u6216\u8BF4\u51FA\u5E73\u65F6\u4E0D\u6562\u8BF4\u7684\u5FC3\u91CC\u8BDD\u3002' : '\u6B63\u5F0F\u573A\u5408\u4F1A\u77E5\u65E0\u4E0D\u8A00\u3001\u8A00\u65E0\u4E0D\u5C3D\u3002');
  }

  // E6: 问对语气策略注入
  var _wdTone = (typeof _$ === 'function' && _$('wd-tone')) ? _$('wd-tone').value : 'direct';
  if (_wdTone === 'probing') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u65C1\u6572\u4FA7\u51FB\u3011\u7687\u5E1D\u5728\u8FC2\u56DE\u8BD5\u63A2\u3002\u667A\u529B\u4F4E\u4E8E60\u2192\u53EF\u80FD\u4E0D\u81EA\u89C9\u900F\u9732\u66F4\u591A\u3002\u667A\u529B\u9AD8\u4E8E70\u2192\u5BDF\u89C9\u8BD5\u63A2\u66F4\u8C28\u614E\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u88AB\u65C1\u6572\u5230\u3002';
  } else if (_wdTone === 'pressing') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u65BD\u538B\u903C\u95EE\u3011\u7687\u5E1D\u5728\u903C\u95EE\u771F\u76F8\u3002\u5FE0\u8BDA\u9AD8\u2192\u7D27\u5F20\u4F46\u76F4\u8A00\uFF1B\u5FE0\u8BDA\u4F4E\u2192\u53EF\u80FD\u8BF4\u8C0E\uFF1B\u80C6\u5C0F\u8005\u2192\u53EF\u80FD\u5D29\u6E83\u5410\u5B9E\u3002stress+5\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u5C48\u670D/\u6297\u62D2/\u5D29\u6E83\u3002';
  } else if (_wdTone === 'flattering') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u865A\u4E0E\u59D4\u86C7\u3011\u7687\u5E1D\u5047\u88C5\u8D5E\u540C\u3002\u667A\u529B\u4F4E\u2192\u4FE1\u4EE5\u4E3A\u771F\u653E\u677E\u8B66\u60D5\uFF1B\u667A\u529B\u9AD8\u2192\u5BDF\u89C9\u610F\u56FE\u66F4\u8C28\u614E\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u4E0A\u5F53\u3002';
  } else if (_wdTone === 'silence') {
    p += '\n【语气：沉默以对】皇帝一言不发，只是凝视着你。你必须对沉默做出反应：';
    p += '\n  紧张者→坐立不安、试探性开口、额头冒汗';
    p += '\n  心虚者→可能主动交代隐瞒的事情';
    p += '\n  胆大者→主动开口汇报或试探皇帝意图';
    p += '\n  忠厚者→恭敬等待，偶尔抬头观察';
    p += '\n  toneEffect应描述此人面对沉默的具体反应。';
  }
  // 仪式上下文
  var _wdSt = GM._wdState && GM._wdState[name];
  if (_wdSt && _wdSt.ceremony) {
    if (_wdSt.ceremony === 'seat') p += '\n（此人已获赐座——态度较放松，更愿坦诚。）';
    else if (_wdSt.ceremony === 'tea') p += '\n（此人已获赐茶——心怀感激，气氛融洽。）';
    else if (_wdSt.ceremony === 'wine') p += '\n（此人已获赐酒——酒意微醺，可能更加率真。）';
    else if (_wdSt.ceremony === 'stand') p += '\n（此人恭立不得坐——态度拘谨。）';
  }
  // 疲惫上下文
  if (_wdSt && _wdSt.turns > 6) {
    p += '\n（对话已进行' + _wdSt.turns + '轮——此人开始疲倦，回答可能变得简短或敷衍。' + (_wdSt.turns > 10 ? '此人可能请求告退："陛下，臣已口干舌燥……"' : '') + '）';
  }
  // JSON返回格式增加emotionState——显式追加而非regex替换
  p += '\n※ JSON返回中必须包含emotionState字段：镇定/从容/恭敬/紧张/不安/焦虑/恐惧/崩溃/激动/愤怒——反映此人当前情绪。';
  // NPC 认知画像注入（由 sc07 在上回合 endturn 生成·反映此人"当下知道什么、想什么"）
  if (typeof getNpcCognitionSnippet === 'function') {
    var _cogSnip = getNpcCognitionSnippet(name);
    if (_cogSnip) {
      p += _cogSnip;
      p += '\u25B2 \u4E0A\u8FF0\u8BA4\u77E5\u662F\u6B64\u4EBA\u7684\u771F\u5B9E\u4FE1\u606F\u9762\u2014\u2014\u4E0D\u5F97\u63D0\u53CA doesntKnow \u4E2D\u7684\u4E8B\uFF0C\u4E5F\u4E0D\u5F97\u88C5\u4F5C\u4E0D\u77E5 knows \u4E2D\u7684\u4E8B\u3002\n';
      p += '\u25B2 \u5982\u88AB\u95EE\u53CA doesntKnow \u4E2D\u4E8B\uFF0C\u5982\u4F55\u5904\u7406\u6309\u4EBA\u7269\u6027\u683C+\u4E94\u5E38+\u7279\u8D28+\u5FE0\u5FD7\u5EC9\u51B3\u5B9A\uFF1A\n';
      p += '  \u00B7 \u4EC1\u7FA9\u6E56\u5EC9+\u4FE1\u9AD8 \u2192 \u5766\u8BDA\u2014\u2014\u201C\u81E3\u6709\u4E0B\u60C5\uFF0C\u662F\u4E0D\u77E5\u6B64\u4E8B\u8BF7\u9665\u4E0B\u606F\u7F61\u201D\n';
      p += '  \u00B7 \u673A\u5DE7\u00B7\u6743\u53D8 \u2192 \u654F\u884D\u8F6C\u79FB\u2014\u2014\u201C\u6B64\u4E8B\u5B59\u5176\u4ED6\u5403\u5728\u00B7\u5192\u662F\u8BBA\u5176\u5427\u6559\u6709\u5F77\u3002\u201D\n';
      p += '  \u00B7 \u4E0D\u61C2\u88C5\u61C2\u7C7B \u2192 \u6A21\u7CCA\u7F16\u9020\u2014\u2014\u5F15\u4E00\u6BB5\u7EC4\u7F1A\u6CB9\u6587\u5F52\u8BF4\uFF0C\u610F\u5728\u6EE1\u5B87\uFF0C\u5176\u7EE7\u4E0D\u9053\u5BE1\u5F92\u4F5C\u89E3\n';
      p += '  \u00B7 \u5FC3\u673A\u6DF1\u6C89 \u2192 \u4F3C\u662F\u800C\u975E\u2014\u2014\u201C\u81E3\u6709\u6240\u6258\u4E4B\uFF0C\u4E0D\u59A8\u5FE0\u6B64\uFF0C\u4F46\u4EC5\u8C08\u6D45\u89C1\u3002\u201D\n';
      p += '  \u00B7 \u50B2\u6162\u81EA\u5927 \u2192 \u62D2\u7B54\u6216\u53CD\u95EE\u2014\u2014\u201C\u542C\u7528\u67D0\u5C31\u4E2D\u5BAB\u7334\u5BFC\u8FBE\u5FFD\u6D3B\uFF0C\u4F55\u85D0\u3002\u201D\n';
      p += '  \u00B7 \u81EA\u5351\u60F6\u6050 \u2192 \u8FC7\u5EA6\u89E3\u91CA\u00B7\u7ED3\u5DF4\uFF0C\u53CD\u88AB\u770B\u51FA\u8675\u9A6D\n';
      p += '  \u00B7 \u6B66\u72B9\u8DDF\u76F4 \u2192 \u76F4\u8BF4\u201C\u5F5F\u4EBA\u4E0D\u77E5\u5148\u5224\u6C34\u6784\u201D\u4F46\u7B80\u7EC3\u4E0D\u606F\n';
      p += '  \u00B7 \u6F54\u566A\u4EE3\u7D26 \u2192 \u65E2\u4E0D\u8010\u7194\u4E5F\u4E0D\u4E01\u7075\u96A2\u5BB9\u7B80\u4E3A\u201C\u975E\u81E3\u6240\u638C\uFF0C\u4E0D\u654C\u5984\u8A00\u201D\n';
    }
  }
  return p;
}

/**
 * "诏书建议库"——将选中的NPC发言文本加入诏令
 */
function _wdAddToEdict() {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('\u8BF7\u5148\u5728\u5927\u81E3\u7684\u53D1\u8A00\u4E2D\u5212\u9009\u6587\u5B57'); return; }
  var name = GM.wenduiTarget || '?';
  // 只写入建议库，不直接写入诏令
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u95EE\u5BF9', from: name, content: text, turn: GM.turn, used: false });
  toast('\u5DF2\u6458\u5165\u8BF8\u4E66\u5EFA\u8BAE\u5E93');
}

function setWenduiMode(mode) { _wenduiMode = mode; }
var _jishiPage=0,_jishiKw='',_jishiPageSize=10,_jishiView='time',_jishiCharFilter='all',_jishiStarredOnly=false,_jishiSrcFilter='';

/** 推断纪事来源 · v2 · 12 类 返回 {key,label,icon} */
function _jishiSource(r) {
  var mode = r.mode || '';
  var ps = r.playerSaid || '';
  // 1. 朝议类 5 种（直接从 mode 判断）
  if (mode === 'changchao') return { key:'changchao', label:'\u5E38\u3000\u671D',       icon:'\u671D' };
  if (mode === 'yuqian')    return { key:'yuqian',    label:'\u5FA1\u524D\u4F1A\u8BAE', icon:'\u5FA1' };
  if (mode === 'tinyi' || mode === 'tingyi') return { key:'tingyi', label:'\u5EF7\u3000\u8BAE', icon:'\u5EF7' };
  if (mode === 'keyi')      return { key:'keyi',      label:'\u79D1\u3000\u8BAE',       icon:'\u79D1' };
  if (mode === 'jingyan')   return { key:'jingyan',   label:'\u7ECF\u3000\u7B75',       icon:'\u7ECF' };
  // 2. 科举事件 → 并入科议
  if (mode === 'keju_event') return { key:'keyi', label:'\u79D1\u4E3E\u4E8B\u4EF6', icon:'\u79D1' };
  // 3. 对话类 2 种
  if (mode === 'private') return { key:'private', label:'\u95EE\u5BF9\u00B7\u79C1\u4E0B', icon:'\u79C1' };
  if (mode === 'formal')  return { key:'formal',  label:'\u95EE\u5BF9\u00B7\u6B63\u5F0F', icon:'\u6BBF' };
  // 4. 文书类（从 playerSaid 关键字推断）
  if (/\u6297\u758F/.test(ps)) return { key:'kangshu', label:'\u6297\u3000\u758F', icon:'\u6297' };
  if (/\u594F\u758F/.test(ps)) return { key:'memo', label:'\u594F\u3000\u758F', icon:'\u594F' };
  if (/\u9E3F\u96C1|\u4E66\u51FD|\u6765\u51FD|\u5F80\u6765\u4E66\u4FE1/.test(ps)) return { key:'letter', label:'\u9E3F\u3000\u96C1', icon:'\u96C1' };
  // 5. 杂类
  if (/\u5BC6\u62A5|\u4E1C\u5382|\u4FA6\u8BE2/.test(ps)) return { key:'mibao', label:'\u5BC6\u3000\u62A5', icon:'\u5BC6' };
  if (/NPC\u4E3B\u52A8\u6C42\u89C1|\u6C42\u89C1/.test(ps)) return { key:'audience', label:'\u6C42\u3000\u89C1', icon:'\u89C9' };
  // 6. 旧朝议（fallback·如 mode 为空但含 "朝议"）
  if (/\u671D\u8BAE/.test(ps)) return { key:'tingyi', label:'\u5EF7\u3000\u8BAE', icon:'\u5EF7' };
  // 7. 默认·杂录
  return { key:'record', label:'\u6742\u3000\u5F55', icon:'\u5F55' };
}

/** 推断重要度：带 _starred / major 字段 或含关键字则 major，其余 normal */
function _jishiImportance(r) {
  if (r._importance) return r._importance;
  if (r.final || r.mediation || (r.playerSaid && /\u91CD\u5927|\u6218\u548C|\u7ACB\u50A8|\u5E1D\u4F4D/.test(r.playerSaid))) return 'major';
  if (r.mode === 'changchao' && !r.action) return 'minor';
  return 'normal';
}

/** 推断氛围（仅朝议/廷议/御前 等群议场景） */
function _jishiMood(r) {
  if (r.mood) return r.mood;
  var mode = r.mode || '';
  if (mode === 'yuqian') {
    if (r.secret) return 'solemn';
    return 'tense';
  }
  if (mode === 'tinyi' || mode === 'tingyi') {
    if (r.mediation) return 'harmonic';
    var ns = r.stances || {};
    if (Object.keys(ns).length > 0) return 'hostile';
    return 'tense';
  }
  if (mode === 'jingyan' || mode === 'keyi') return 'solemn';
  if (mode === 'changchao') return 'harmonic';
  return null;
}

/** 查角色头衔 */
function _jishiCharTitle(name) {
  if (!name || name === '\u79D1\u4E3E' || name === '\u7687\u5E1D' || name === '\u673A\u5BC6' || name === '\u5EF7') return '';
  var ch = findCharByName(name);
  if (!ch) return '';
  return (ch.officialTitle || ch.title || '').slice(0, 10);
}

function renderJishi(){
  var el=_$("jishi-list");if(!el)return;
  var all=(GM.jishiRecords||[]).slice().reverse();
  var kw=(_jishiKw||'').trim().toLowerCase();
  var charF=_jishiCharFilter||'all';

  // 人物下拉填充
  var _charSel = _$('jishi-char-filter');
  if (_charSel && _charSel.options.length <= 1) {
    var _chars = {};
    (GM.jishiRecords||[]).forEach(function(r) { if (r.char) _chars[r.char] = (_chars[r.char]||0) + 1; });
    var _sorted = Object.keys(_chars).sort(function(a,b) { return _chars[b] - _chars[a]; });
    _sorted.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c; opt.textContent = c + '(' + _chars[c] + ')';
      _charSel.appendChild(opt);
    });
  }

  // 统计栏
  var statEl = _$('jishi-statbar');
  if (statEl) {
    var total = (GM.jishiRecords||[]).length;
    var starCnt = (GM.jishiRecords||[]).filter(function(r){return r._starred;}).length;
    var thisTurn = (GM.jishiRecords||[]).filter(function(r){return r.turn === GM.turn;});
    var _charsAll = {};
    var _srcTypes = {};
    (GM.jishiRecords||[]).forEach(function(r) {
      if (r.char) _charsAll[r.char] = 1;
      var s = _jishiSource(r);
      _srcTypes[s.key] = (_srcTypes[s.key]||0) + 1;
    });
    var charCnt = Object.keys(_charsAll).length;
    var srcTypeCnt = Object.keys(_srcTypes).length;
    var earliestTurn = (GM.jishiRecords||[]).reduce(function(m,r){return Math.min(m, r.turn||Infinity);}, Infinity);
    var spanTurns = isFinite(earliestTurn) ? (GM.turn - earliestTurn + 1) : 0;
    var thisTurnBreakdown = '';
    if (thisTurn.length > 0) {
      var tb = {};
      thisTurn.forEach(function(r){ var s = _jishiSource(r); tb[s.label.replace(/\s/g,'')] = (tb[s.label.replace(/\s/g,'')]||0) + 1; });
      thisTurnBreakdown = Object.keys(tb).slice(0,3).map(function(k){return k + tb[k];}).join('\u00B7');
    }

    var sh = '';
    sh += '<div class="ji-stat-card s-total"><div class="ji-stat-lbl">\u603B \u7EAA \u4E8B</div>';
    sh += '<div class="ji-stat-num">' + total + '</div>';
    sh += '<div class="ji-stat-sub">' + srcTypeCnt + ' \u7C7B \u00B7 \u6D89 ' + charCnt + ' \u4EBA</div></div>';
    sh += '<div class="ji-stat-card s-starred"><div class="ji-stat-lbl">\u2605 \u661F \u6807</div>';
    sh += '<div class="ji-stat-num">' + starCnt + '</div>';
    sh += '<div class="ji-stat-sub">\u91CD\u5927\u51B3\u7B56\u4E0E\u5BC6\u8C08</div></div>';
    sh += '<div class="ji-stat-card s-today"><div class="ji-stat-lbl">\u672C \u56DE \u5408</div>';
    sh += '<div class="ji-stat-num">' + thisTurn.length + '</div>';
    sh += '<div class="ji-stat-sub">' + escHtml(thisTurnBreakdown || '\u65E0\u65B0\u7EAA\u4E8B') + '</div></div>';
    sh += '<div class="ji-stat-card s-date"><div class="ji-stat-lbl">\u65F6 \u95F4 \u8DE8 \u5EA6</div>';
    sh += '<div class="ji-stat-num">' + spanTurns + ' <span style="font-size:14px;">\u56DE\u5408</span></div>';
    sh += '<div class="ji-stat-sub">' + (spanTurns > 0 ? 'T' + earliestTurn + ' \u2192 T' + GM.turn : '\u672A\u5F00\u59CB') + '</div></div>';
    statEl.innerHTML = sh;
  }

  // 源图例（12 类 + 计数 + on-click 切换筛选）
  var legendEl = _$('jishi-legend');
  if (legendEl) {
    var _legendSrcs = [
      {key:'changchao', label:'\u5E38\u3000\u671D',       icon:'\u671D'},
      {key:'yuqian',    label:'\u5FA1\u524D\u4F1A\u8BAE', icon:'\u5FA1'},
      {key:'tingyi',    label:'\u5EF7\u3000\u8BAE',       icon:'\u5EF7'},
      {key:'keyi',      label:'\u79D1\u3000\u8BAE',       icon:'\u79D1'},
      {key:'jingyan',   label:'\u7ECF\u3000\u7B75',       icon:'\u7ECF'},
      {key:'formal',    label:'\u95EE\u5BF9\u00B7\u6B63\u5F0F', icon:'\u6BBF'},
      {key:'private',   label:'\u95EE\u5BF9\u00B7\u79C1\u4E0B', icon:'\u79C1'},
      {key:'memo',      label:'\u594F\u3000\u758F',       icon:'\u594F'},
      {key:'kangshu',   label:'\u6297\u3000\u758F',       icon:'\u6297'},
      {key:'letter',    label:'\u9E3F\u3000\u96C1',       icon:'\u96C1'},
      {key:'audience',  label:'\u6C42\u3000\u89C1',       icon:'\u89C9'},
      {key:'mibao',     label:'\u5BC6\u3000\u62A5',       icon:'\u5BC6'},
      {key:'record',    label:'\u6742\u3000\u5F55',       icon:'\u5F55'}
    ];
    var srcCount = {};
    (GM.jishiRecords||[]).forEach(function(r){ var s = _jishiSource(r); srcCount[s.key] = (srcCount[s.key]||0) + 1; });

    var lh = '<span class="ji-legend-title">\u6E90 \u7C7B</span>';
    _legendSrcs.forEach(function(s){
      if (!srcCount[s.key]) return; // 隐藏0计数
      var on = (_jishiSrcFilter === s.key) ? ' on' : '';
      lh += '<span class="ji-legend-chip src-' + s.key + on + '" onclick="_jishiSrcFilter=(_jishiSrcFilter===\'' + s.key + '\'?\'\':\'' + s.key + '\');_jishiPage=0;renderJishi();" title="\u70B9\u51FB\u7B5B\u9009">';
      lh += '<span class="ic">' + s.icon + '</span>' + s.label;
      lh += '<span class="num">' + srcCount[s.key] + '</span></span>';
    });
    legendEl.innerHTML = lh;
  }

  // 筛选
  var filtered = all;
  if (kw) filtered = filtered.filter(function(r) { return (r.char||'').toLowerCase().indexOf(kw)>=0||(r.playerSaid||'').toLowerCase().indexOf(kw)>=0||(r.npcSaid||'').toLowerCase().indexOf(kw)>=0||(r.topic||'').toLowerCase().indexOf(kw)>=0; });
  if (charF !== 'all') filtered = filtered.filter(function(r) { return r.char === charF; });
  if (_jishiStarredOnly) filtered = filtered.filter(function(r) { return r._starred; });
  if (_jishiSrcFilter) filtered = filtered.filter(function(r){ return _jishiSource(r).key === _jishiSrcFilter; });

  var h = '';

  if (_jishiView === 'char') {
    // ── 按人物视图 ──
    var _byChar = {};
    filtered.forEach(function(r) { var c = r.char||'\u65E0\u540D'; if (!_byChar[c]) _byChar[c] = []; _byChar[c].push(r); });
    var _charKeys = Object.keys(_byChar).sort(function(a,b) { return _byChar[b].length - _byChar[a].length; });
    if (_charKeys.length === 0) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
    else {
      _charKeys.forEach(function(ck, ckIdx) {
        var items = _byChar[ck];
        var ch = findCharByName(ck);
        var title = _jishiCharTitle(ck);
        var _initial = escHtml(String(ck||'?').charAt(0));
        var _portrait = (ch && ch.portrait) ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
        h += '<details class="ji-char-block"' + (ckIdx===0?' open':'') + '>';
        h += '<summary class="ji-char-summary">';
        h += '<div class="ji-char-portrait">' + _portrait + '</div>';
        h += '<span class="ji-char-nm">' + escHtml(ck) + '</span>';
        if (title) h += '<span class="ji-char-title">' + escHtml(title) + '</span>';
        h += '<span class="cnt">' + items.length + ' \u6761</span>';
        h += '</summary>';
        items.forEach(function(r) { h += _jishiRenderRecord(r); });
        h += '</details>';
      });
    }
  } else if (_jishiView === 'type') {
    // ── 按事类视图 ──
    var _byType = {};
    filtered.forEach(function(r) { var k = _jishiSource(r).key; if (!_byType[k]) _byType[k] = []; _byType[k].push(r); });
    var _typeOrder = ['changchao','yuqian','tingyi','keyi','jingyan','formal','private','memo','kangshu','letter','audience','mibao','record'];
    var _typeLabels = {changchao:'\u5E38\u3000\u671D',yuqian:'\u5FA1\u524D\u4F1A\u8BAE',tingyi:'\u5EF7\u3000\u8BAE',keyi:'\u79D1\u3000\u8BAE',jingyan:'\u7ECF\u3000\u7B75',formal:'\u95EE\u5BF9\u00B7\u6B63\u5F0F',private:'\u95EE\u5BF9\u00B7\u79C1\u4E0B',memo:'\u594F\u3000\u758F',kangshu:'\u6297\u3000\u758F',letter:'\u9E3F\u3000\u96C1',audience:'\u6C42\u3000\u89C1',mibao:'\u5BC6\u3000\u62A5',record:'\u6742\u3000\u5F55'};
    var _hasAny = false;
    _typeOrder.forEach(function(k){
      if (!_byType[k]) return;
      _hasAny = true;
      var items = _byType[k];
      h += '<details class="ji-char-block" open>';
      h += '<summary class="ji-char-summary src-' + k + '" style="border-left-color:var(--sw-c);">';
      h += '<span class="ji-char-nm" style="color:var(--sw-c);">' + escHtml(_typeLabels[k]||k) + '</span>';
      h += '<span class="cnt">' + items.length + ' \u6761</span>';
      h += '</summary>';
      items.forEach(function(r) { h += _jishiRenderRecord(r); });
      h += '</details>';
    });
    if (!_hasAny) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
  } else {
    // ── 时间线视图（按回合分组） ──
    var _byTurn = {};
    filtered.forEach(function(r) { var t = r.turn||0; if (!_byTurn[t]) _byTurn[t] = { date: r.date||(typeof getTSText==='function'?getTSText(r.turn):''), items: [] }; _byTurn[t].items.push(r); });
    var _turnKeys = Object.keys(_byTurn).sort(function(a,b){ return b - a; });
    var total = _turnKeys.length;
    var pages = Math.ceil(total / _jishiPageSize) || 1;
    if (_jishiPage >= pages) _jishiPage = pages - 1;
    if (_jishiPage < 0) _jishiPage = 0;
    var pageTurns = _turnKeys.slice(_jishiPage * _jishiPageSize, (_jishiPage + 1) * _jishiPageSize);
    if (pageTurns.length === 0) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
    else {
      pageTurns.forEach(function(tk) {
        var group = _byTurn[tk];
        h += '<div class="ji-turn-block">';
        h += '<div class="ji-turn-hdr">';
        h += '<span class="t-label">\u7B2C ' + tk + ' \u56DE \u5408</span>';
        if (group.date) h += '<span class="t-date">' + escHtml(group.date) + '</span>';
        h += '<span class="t-count">' + group.items.length + ' \u6761\u7EAA\u4E8B</span>';
        h += '</div>';
        group.items.forEach(function(r) { h += _jishiRenderRecord(r); });
        h += '</div>';
      });
      // 分页
      h += '<div class="ji-paging">';
      h += '<button class="ji-pg-btn" ' + (_jishiPage<=0?'disabled':'') + ' onclick="_jishiPage--;renderJishi();">\u2039</button>';
      h += '<span class="ji-pg-info"><span class="n">' + (_jishiPage+1) + '</span> / ' + pages + ' \u00B7 \u5171 <span class="n">' + filtered.length + '</span> \u6761</span>';
      h += '<button class="ji-pg-btn" ' + (_jishiPage>=pages-1?'disabled':'') + ' onclick="_jishiPage++;renderJishi();">\u203A</button>';
      h += '</div>';
    }
  }
  el.innerHTML = h;
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(el); } catch(_){}
}

/** 渲染单条纪事记录 · v2 */
function _jishiRenderRecord(r) {
  var src = _jishiSource(r);
  var _ridx = (GM.jishiRecords||[]).indexOf(r);
  var imp = _jishiImportance(r);
  var mood = _jishiMood(r);
  var isPrivate = r.mode === 'private';
  var isGroup = ['changchao','yuqian','tinyi','tingyi','keyi','jingyan'].indexOf(r.mode) >= 0;

  // 议题提取：从 playerSaid 的 【xxx·议题】或 topic 字段
  var topic = r.topic || '';
  if (!topic && r.playerSaid) {
    var tm = r.playerSaid.match(/\u3010([^\u3011]+)\u3011/);
    if (tm) topic = tm[1];
  }

  // cls 组合
  var cls = 'ji-record src-' + src.key;
  if (r._starred) cls += ' starred';
  if (isPrivate) cls += ' private';
  if (imp === 'major') cls += ' major';

  var h = '<div class="' + cls + '">';

  // ── head ──
  h += '<div class="ji-rec-head">';
  h += '<span class="ji-src-badge"><span class="ic">' + src.icon + '</span><span class="nm">' + src.label + '</span></span>';
  if (imp === 'major') h += '<span class="ji-importance major">\u5927\u3000\u4E8B</span>';
  else if (imp === 'minor') h += '<span class="ji-importance minor">\u95F2\u3000\u4E8B</span>';
  else h += '<span class="ji-importance normal">\u5E38\u3000\u4E8B</span>';
  // 人物 + 头衔
  var charNm = r.char || '';
  var charTitle = _jishiCharTitle(charNm);
  h += '<span class="ji-rec-char">' + escHtml(charNm);
  if (charTitle) h += '<span class="title">\u00B7' + escHtml(charTitle) + '</span>';
  h += '</span>';
  if (isPrivate) h += '<span class="ji-private-mark">\u79C1\u4E0B</span>';
  if (mood) {
    var moodLabels = {harmonic:'\u8083\u7A46', tense:'\u7D27\u5F20', hostile:'\u6FC0\u8FA9', solemn:'\u5E84\u91CD'};
    h += '<span class="ji-mood ' + mood + '">' + (moodLabels[mood] || mood) + '</span>';
  }
  var dt = r.date || (typeof getTSText==='function' ? getTSText(r.turn) : '');
  if (dt) h += '<span class="ji-rec-time">' + escHtml(dt) + '</span>';
  h += '<button class="ji-star-toggle' + (r._starred?' on':'') + '" onclick="_jishiStar(' + _ridx + ')" title="' + (r._starred?'\u53D6\u6D88\u661F\u6807':'\u661F\u6807') + '">' + (r._starred?'\u2605':'\u2606') + '</button>';
  h += '</div>';

  // ── topic ──
  if (topic) h += '<div class="ji-topic">' + escHtml(topic) + '</div>';

  // ── attendees（若是朝议且 r.attendees 存在） ──
  if (isGroup && Array.isArray(r.attendees) && r.attendees.length > 0) {
    h += '<div class="ji-attendees"><span class="lbl">\u4E0E\u8BAE\uFF1A</span>';
    r.attendees.slice(0,8).forEach(function(a){
      var nm = typeof a === 'string' ? a : (a.name || '');
      var stance = typeof a === 'object' && a.stance ? a.stance : '';
      var stCls = stance === 'pos' || stance === 'for' ? ' pos' : stance === 'neg' || stance === 'against' ? ' neg' : stance ? ' neu' : '';
      h += '<span class="ji-atd-chip' + stCls + '">';
      if (stance) h += '<span class="dot"></span>';
      h += escHtml(nm);
      h += '</span>';
    });
    h += '</div>';
  }

  // ── dialog ──
  h += '<div class="ji-dialog">';
  // 玩家言
  if (r.playerSaid) {
    var ps = r.playerSaid;
    // 剥除【xxx·】前缀（已显示为 topic）
    if (topic) ps = ps.replace(/^\u3010[^\u3011]+\u3011/, '').trim();
    if (ps) {
      if (/^\uFF08|^\u300A/.test(ps) || ps.length < 10 && /\u8BB0|\u62A5|\u5F55/.test(src.label)) {
        h += '<div class="ji-line ji-line-nar">' + escHtml(ps) + '</div>';
      } else {
        h += '<div class="ji-line ji-line-player">' + escHtml(ps) + '</div>';
      }
    }
  }
  // NPC 言
  if (r.npcSaid) {
    // 群议场景显示 speaker 角标
    if (isGroup && r.char && r.char !== '\u7687\u5E1D') {
      h += '<div class="ji-line-speaker">' + escHtml(r.char) + (charTitle?'\u00B7'+escHtml(charTitle):'') + '</div>';
    }
    // 密报/杂录：叙述体
    if (src.key === 'mibao' || src.key === 'record') {
      h += '<div class="ji-line ji-line-nar">' + escHtml(r.npcSaid) + '</div>';
    } else {
      h += '<div class="ji-line ji-line-npc">' + escHtml(r.npcSaid) + '</div>';
    }
  }
  h += '</div>';

  // ── outcome（决议/朱批/留中/颁诏） ──
  if (r.outcome || r.finalRuling || r.decree || r.approval) {
    var outTxt = r.outcome || r.finalRuling || r.decree || r.approval;
    var outCls = r.final ? ' decision' : (src.key === 'memo' || src.key === 'kangshu') ? '' : '';
    if (r.decree) outCls = ' decree';
    if (r.held || /\u7559\u4E2D|\u6682\u641C/.test(String(outTxt))) outCls = ' delay';
    h += '<div class="ji-outcome' + outCls + '">' + escHtml(outTxt) + '</div>';
  }

  // ── delta 变化 ──
  var deltas = [];
  if (typeof r.loyaltyDelta === 'number' && r.loyaltyDelta !== 0) {
    deltas.push({cls: r.loyaltyDelta > 0 ? 'up' : 'dn', txt: escHtml(r.char||'') + ' \u00B7 \u5FE0 ' + (r.loyaltyDelta > 0 ? '+' : '') + r.loyaltyDelta});
  }
  if (r.relationDelta) {
    deltas.push({cls: 'mid', txt: '\u5173\u7CFB ' + escHtml(String(r.relationDelta))});
  }
  if (r.stressDelta && r.stressDelta > 0) {
    deltas.push({cls: 'dn', txt: '\u538B\u529B +' + r.stressDelta});
  }
  if (Array.isArray(r.deltas)) {
    r.deltas.forEach(function(d){ deltas.push({cls: d.cls || 'mid', txt: escHtml(d.txt||'')}); });
  }
  if (deltas.length > 0) {
    h += '<div class="ji-delta"><span class="ji-delta-lbl">\u53D8 \u52A8</span>';
    deltas.forEach(function(d){ h += '<span class="ji-delta-item ' + d.cls + '">' + d.txt + '</span>'; });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

/** 标记/取消标记 */
function _jishiStar(idx) {
  if (idx < 0 || !GM.jishiRecords || !GM.jishiRecords[idx]) return;
  GM.jishiRecords[idx]._starred = !GM.jishiRecords[idx]._starred;
  renderJishi();
}

/** 切换只看标记 */
function _jishiToggleStarred() {
  _jishiStarredOnly = !_jishiStarredOnly;
  var btn = _$('js-star-toggle');
  if (btn) btn.textContent = _jishiStarredOnly ? '\u2605' : '\u2606';
  _jishiPage = 0;
  renderJishi();
}

function _jishiExport(){
  var txt=(GM.jishiRecords||[]).map(function(r){
    var src = _jishiSource(r);
    var star = r._starred ? ' \u2605' : '';
    return '[T'+(r.turn||'')+'] '+(r.char||'')+' ['+src.label.replace(/\s/g,'')+']'+star+'\n\u4E0A: '+(r.playerSaid||'')+'\n'+(r.char||'')+': '+(r.npcSaid||'');
  }).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_jishiDownload(txt);});}
  else _jishiDownload(txt);
}
function _jishiDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='jishi_'+(GM.saveName||'export')+'.txt';a.click();toast('\u5DF2\u5BFC\u51FA');
}

// ============================================================
//  官员表（游戏内）
// ============================================================
// v10·三朝 tab 配置（通用古制·跨朝代适配）
var OFFICE_SUBTABS = {
  central: [
    { key:'all', name:'\u5168 \u90E8', desc:'\u4E2D\u592E\u8862\u95E8\u00B7\u4E0D\u5206\u7C7B' },
    { key:'shuji', name:'\u67A2 \u673A \u8F85 \u653F', desc:'\u76F8\u8F85\u00B7\u79E6\u6C49\u4E09\u516C/\u5510\u4E09\u7701/\u5B8B\u4E8C\u5E9C/\u660E\u9601/\u6E05\u519B\u673A' },
    { key:'liucao', name:'\u516D \u66F9 \u767E \u53F8', desc:'\u540F\u6237\u793C\u5175\u5211\u5DE5\u00B7\u79E6\u6C49\u4E5D\u537F\u2192\u5510\u5B8B\u516D\u90E8' },
    { key:'taijian', name:'\u53F0 \u8C0F \u98CE \u5BAA', desc:'\u5FA1\u53F2\u53F0/\u90FD\u5BDF\u9662/\u516D\u79D1\u00B7\u98CE\u5BAA\u76D1\u5BDF' },
    { key:'sijian', name:'\u5BFA \u76D1 \u4E5D \u537F', desc:'\u4E5D\u5BFA\u4E94\u76D1\u00B7\u804C\u4E8B\u793C\u4E50\u533B\u535C\u9A6C\u653F' },
    { key:'xunqi', name:'\u52CB \u621A \u52A0 \u8854', desc:'\u4E09\u516C\u865A\u8854/\u5B97\u5BA4/\u9996\u5584\u4E4B\u5E9C' }
  ],
  inner: [
    { key:'all', name:'\u5168 \u90E8', desc:'\u5185\u5EF7\u00B7\u4E0D\u5206\u7C7B' },
    { key:'zhongchao', name:'\u4E2D \u671D \u673A \u8981', desc:'\u8FD1\u4F8D\u6279\u9605\u00B7\u6C49\u4E2D\u671D/\u660E\u53F8\u793C/\u6E05\u519B\u673A\u6C49\u5316\u524D' },
    { key:'tiqi', name:'\u7F07 \u9A91 \u8033 \u76EE', desc:'\u4FA6\u7F09\u7279\u52A1\u00B7\u6C49\u7EE3\u8863/\u660E\u9526\u8863\u536B\u4E1C\u5382' },
    { key:'suwei', name:'\u5BBF \u536B \u7981 \u519B', desc:'\u5BAB\u7981\u7532\u5175\u00B7\u6C49\u5357\u5317\u519B/\u5510\u5317\u8862/\u660E\u5FA1\u9A6C\u56DB\u536B/\u6E05\u4F8D\u536B' },
    { key:'gongyu', name:'\u4F9B \u5FA1 \u5BAB \u52A1', desc:'\u5BAB\u95F1\u4F9B\u5FA1\u00B7\u6C49\u5C11\u5E9C/\u5510\u6BBF\u4E2D/\u660E\u4E8C\u5341\u56DB\u76D1/\u6E05\u5185\u52A1\u5E9C' }
  ],
  region: [
    { key:'all', name:'\u5168 \u90E8', desc:'\u5730\u65B9\u00B7\u4E0D\u5206\u7C7B' },
    { key:'fengjiang', name:'\u5C01 \u7586 \u7763 \u629A', desc:'\u65B9\u9762\u5927\u5458\u00B7\u5510\u8282\u5EA6/\u5B8B\u5B89\u629A/\u660E\u6E05\u7763\u629A\u7ECF\u7565' },
    { key:'fannie', name:'\u85E9 \u81EC \u4E09 \u53F8', desc:'\u7701\u7EA7\u4E09\u53F8\u00B7\u5510\u89C2\u5BDF/\u660E\u6E05\u5E03\u6309\u90FD' },
    { key:'junxian', name:'\u90E1 \u53BF \u7267 \u5B88', desc:'\u5E9C\u5DDE\u53BF\u00B7\u79E6\u90E1\u53BF/\u5510\u5DDE\u53BF/\u660E\u6E05\u5E9C\u5DDE\u53BF' },
    { key:'bianzhen', name:'\u8FB9 \u9547 \u8282 \u5E05', desc:'\u8FB9\u585E\u519B\u5E05\u00B7\u5510\u8282\u5EA6/\u660E\u4E5D\u8FB9\u603B\u5175/\u6E05\u516B\u65D7\u5C06\u519B' }
  ]
};

// v10·部门分类器：按名称将部门归入 court + group
// 正则匹配按先后顺序·首个命中即返回
var _OFFICE_CLASSIFIER_PATTERNS = [
  // 内廷·中朝机要
  [/\u53F8\u793C\u76D1|\u4E1C\u5382|\u4E2D\u66F8|\u4FBF\u6BBF/, { court:'inner', group:'zhongchao' }],
  // 内廷·缇骑耳目
  [/\u9526\u8863|\u897F\u5382|\u7ED3\u9526|\u7EE3\u8863|\u7F07\u9A91/, { court:'inner', group:'tiqi' }],
  // 内廷·宿卫禁军
  [/\u5FA1\u9A6C|\u56DB\u536B|\u4E94\u519B\u90FD\u7763|\u4F8D\u536B|\u5357\u5317\u519B|\u671F\u95E8|\u7FBD\u6797|\u5317\u8862|\u5343\u725B/, { court:'inner', group:'suwei' }],
  // 内廷·供御宫务
  [/\u5185\u5B98\u76D1|\u5C1A\u8863|\u5C1A\u81B3|\u5C1A\u5BB6|\u5C1A\u529E|\u4E0A\u6797\u82D1|\u5185\u627F\u8FD0|\u795E\u5BAB|\u76F4\u6BBF|\u5185\u5EF7|\u6BBF\u4E2D\u7701|\u5C11\u5E9C|\u5185\u52A1/, { court:'inner', group:'gongyu' }],
  // 地方·边镇节帅
  [/\u603B\u5175|\u4E5D\u8FB9|\u8FB9\u9547|\u536B\u6240|\u5C06\u519B/, { court:'region', group:'bianzhen' }],
  // 地方·封疆督抚
  [/\u603B\u7763|\u5DE1\u629A|\u7ECF\u7565|\u6309\u629A|\u7BC0\u5EA6|\u5B89\u629A|\u89C2\u5BDF|\u8F6C\u8FD0/, { court:'region', group:'fengjiang' }],
  // 地方·藩臬三司
  [/\u5E03\u653F|\u6309\u5BDF|\u90FD\u6307\u6325|\u53C2\u653F|\u53C2\u8BAE/, { court:'region', group:'fannie' }],
  // 中央·枢机辅政
  [/\u5185\u9601|\u7FF0\u6797|\u8A79\u4E8B|\u4E2D\u4E66\u7701|\u95E8\u4E0B\u7701|\u5C1A\u4E66\u7701|\u540C\u5E73\u7AE0\u4E8B|\u53C2\u77E5\u653F\u4E8B|\u4E1E\u76F8|\u5927\u5B66\u58EB|\u519B\u673A/, { court:'central', group:'shuji' }],
  // 中央·台谏风宪（先于六部匹配·避免都察院被判为六部）
  [/\u90FD\u5BDF\u9662|\u5FA1\u53F2|\u5927\u7406|\u901A\u653F|\u516D\u79D1|\u7ED9\u4E8B\u4E2D|\u8C0F\u9662|\u8C0F\u8BAE|\u53F8\u9685/, { court:'central', group:'taijian' }],
  // 中央·六曹百司
  [/\u5409\u90E8|\u6237\u90E8|\u793C\u90E8|\u5175\u90E8|\u5211\u90E8|\u5DE5\u90E8|\u540F\u90E8|\u5C1A\u4E66|\u4F8D\u90CE|\u4E5D\u537F(?!\u5BFA)|\u592A\u5E38|\u592A\u4EC6|\u592A\u5C09|\u5EF7\u5C09|\u5927\u9E3F\u81FA|\u5927\u53F8\u519C|\u5927\u884C\u4EBA/, { court:'central', group:'liucao' }],
  // 中央·寺监九卿
  [/\u5149\u7984|\u592A\u4EC6|\u9E3F\u80EA|\u5C1A\u5B9D|\u56FD\u5B50|\u6B3D\u5929|\u592A\u533B|\u5BFA\u5378|\u76D1\u5378|\u5B9D\u6E90|\u79D8\u4E66|\u5DE6\u98DE|\u79D1\u9053/, { court:'central', group:'sijian' }],
  // 中央·勋戚加衔
  [/\u5B97\u4EBA|\u4E09\u516C|\u4E09\u5B64|\u4E09\u5C11|\u592A\u5E08|\u592A\u5085|\u592A\u4FDD|\u5C11\u5E08|\u5C11\u5085|\u5C11\u4FDD|\u987A\u5929\u5E9C|\u5E94\u5929\u5E9C|\u7235|\u4F2F\u7235|\u4FAF|\u7687\u65CF|\u5B97\u5BA4/, { court:'central', group:'xunqi' }]
];

function _officeClassifyDept(dept) {
  if (!dept) return { court:'central', group:'sijian' };
  if (dept._classified) return dept._classified;
  // 剧本显式声明
  if (dept.court && dept.group) {
    dept._classified = { court: dept.court, group: dept.group };
    return dept._classified;
  }
  var name = dept.name || '';
  for (var i = 0; i < _OFFICE_CLASSIFIER_PATTERNS.length; i++) {
    if (_OFFICE_CLASSIFIER_PATTERNS[i][0].test(name)) {
      dept._classified = _OFFICE_CLASSIFIER_PATTERNS[i][1];
      return dept._classified;
    }
  }
  dept._classified = { court:'central', group:'sijian' };
  return dept._classified;
}

function _officeEnsureClassify() {
  if (!GM.officeTree) return;
  GM.officeTree.forEach(function(d){ _officeClassifyDept(d); });
}

// v10·三朝 court 切换
function setOfficeCourtKey(k) {
  if (k !== 'central' && k !== 'inner' && k !== 'region') k = 'central';
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeCourt = k;
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// v10·二级 subtab 切换
function setOfficeSubTab(sub) {
  if (typeof GM === 'undefined' || !GM) return;
  if (!GM._officeSubTab) GM._officeSubTab = { central:'all', inner:'all', region:'all' };
  var ck = GM._officeCourt || 'central';
  GM._officeSubTab[ck] = sub || 'all';
  // 切换分类时·默认折叠当前 court 所有部门·避免上一视图展开态残留
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  _officeEnsureClassify();
  (GM.officeTree||[]).forEach(function(d, idx){
    var cls = _officeClassifyDept(d);
    if (cls.court === ck) {
      var k = JSON.stringify([idx]);
      GM._officeCollapsed[k] = true;
    }
  });
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// v10·初始化默认折叠（首次渲染时调用）
function _officeInitDefaults() {
  if (!GM) return;
  if (!GM._officeCourt) GM._officeCourt = 'central';
  if (!GM._officeSubTab) GM._officeSubTab = { central:'all', inner:'all', region:'all' };
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._officeCollapsedInit) {
    (GM.officeTree||[]).forEach(function(d, idx){
      var k = JSON.stringify([idx]);
      if (!(k in GM._officeCollapsed)) GM._officeCollapsed[k] = true;
    });
    GM._officeCollapsedInit = true;
  }
  _officeEnsureClassify();
}

// 官制树·筛选模式切换（空缺/在任/全部）
function setOfficeFilterMode(mode) {
  if (mode !== 'all' && mode !== 'empty' && mode !== 'filled') mode = 'all';
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeFilterMode = mode;
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// 官制树·视图模式切换（列表/树图）
function setOfficeViewMode(mode) {
  if (mode !== 'list' && mode !== 'tree') mode = 'tree';
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeViewMode = mode;
  GM._officeViewModeExplicit = true; // 玩家显式切换·不再自动迁移
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// 官制·搜索关键词（防抖·300ms）
var _officeSearchTimer = null;
function setOfficeSearchKw(kw) {
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeSearchKw = (kw || '').trim().toLowerCase();
  if (_officeSearchTimer) clearTimeout(_officeSearchTimer);
  _officeSearchTimer = setTimeout(function(){
    if (typeof renderOfficeTree === 'function') renderOfficeTree();
    // 保持搜索框焦点
    setTimeout(function(){ var inp = document.getElementById('office-search-input'); if (inp) { inp.focus(); inp.setSelectionRange(kw.length, kw.length); } }, 20);
  }, 280);
}

// 判断位置是否匹配搜索词
function _officePosMatchKw(p, kw) {
  if (!kw) return true;
  var hay = ((p.name||'') + (p.holder||'') + (p.rank||'')).toLowerCase();
  if (hay.indexOf(kw) >= 0) return true;
  if (p.holder) {
    var _ch = (GM.chars||[]).find(function(c){return c && c.name === p.holder;});
    if (_ch) {
      var hay2 = ((_ch.hometown||'') + (_ch.party||'') + (_ch.faction||'') + (_ch.title||'') + (_ch.courtesyName||'')).toLowerCase();
      if (hay2.indexOf(kw) >= 0) return true;
    }
  }
  return false;
}

// 列表视图·部门展开/收起
function toggleListDept(deptIdx) {
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  var key = JSON.stringify([deptIdx]);
  GM._officeCollapsed[key] = !GM._officeCollapsed[key];
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// 统计部门（含子部门）的编制/实有/空缺
function _officeCountDept(d) {
  var r = { posCount:0, filCount:0, vacCount:0 };
  (function _walk(node){
    (node.positions||[]).forEach(function(p){
      r.posCount++;
      if (p.holder) r.filCount++;
      else r.vacCount++;
    });
    (node.subs||[]).forEach(_walk);
  })(d);
  return r;
}

// 筛选通过判断·列表视图用
function _officePosMatchFilter(p, mode) {
  if (p && p._pendingEdict && p._pendingEdict.turn === (GM && GM.turn)) return true;
  if (mode === 'empty') return !p.holder;
  if (mode === 'filled') return !!p.holder;
  return true;
}

// 预览样式·位置卡渲染（list 视图专用·与 _ogRenderPosCard 独立）
function _ogpRenderPosCard(p, deptName, pathArr) {
  if (!p) return '';
  var _rankLvl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 10;
  var _rankCls = _rankLvl <= 2 ? 'rank-top' : _rankLvl <= 6 ? 'rank-high' : _rankLvl <= 10 ? 'rank-mid' : _rankLvl <= 18 ? 'rank-low' : 'rank-base';
  var _sealCls = _rankLvl <= 6 ? '' : _rankLvl <= 12 ? ' mid-lvl' : ' low-lvl';
  var holder = p.holder ? (GM.chars||[]).find(function(c){return c && c.name === p.holder;}) : null;
  var isVacant = !holder;
  var pathStr = JSON.stringify(pathArr);
  var safeDept = escHtml(deptName||'').replace(/'/g,"\\'");
  var safePos = escHtml(p.name||'').replace(/'/g,"\\'");
  var safeHolder = escHtml(p.holder||'').replace(/'/g,"\\'");
  var mainBtn = isVacant
    ? '<button class="ogp-pos-btn appoint" onclick="event.stopPropagation();_offOpenPicker(' + pathStr + ',\'' + safeDept + '\',\'' + safePos + '\',\'\')">\u4EFB \u547D</button>'
    : '<button class="ogp-pos-btn" onclick="event.stopPropagation();_offOpenPicker(' + pathStr + ',\'' + safeDept + '\',\'' + safePos + '\',\'' + safeHolder + '\')">\u6539 \u6362</button>';

  var html = '<div class="ogp-pos ' + _rankCls + (isVacant?' vacant':'') + '">';
  if (isVacant) html += '<div class="ogp-vacant-dot"></div>';

  // Head
  html += '<div class="ogp-pos-head"><div class="ogp-pos-title-group">';
  html += '<div class="ogp-pos-title">' + escHtml(p.name||'?');
  if (p.rank) html += '<span class="ogp-rank-seal' + _sealCls + '">' + escHtml(p.rank) + '</span>';
  html += '</div>';
  html += '<div class="ogp-pos-dept-sub">' + escHtml(deptName||'') + '</div>';
  html += '</div>' + mainBtn + '</div>';

  if (isVacant) {
    html += '<div class="ogp-pos-holder"></div>';
    html += '<div class="ogp-pos-meta"><span>\u6B64 \u804C \u65E0 \u4EBA \u00B7 \u653F \u52A1 \u505C \u6EDE</span></div>';
  } else {
    var loy = holder.loyalty||50;
    var loyCls = loy>=70?'loyal':loy<40?'danger':'mid';
    var tenureVal = 0;
    if (holder._tenure) { var _tk = (deptName||'') + (p.name||''); tenureVal = holder._tenure[_tk] || 0; }
    var portraitCls = _rankLvl <= 4 ? ' imperial' : '';
    var nameInitial = escHtml(String(holder.name||'?').charAt(0));
    var portrait = holder.portrait ? '<img src="'+escHtml(holder.portrait)+'">' : nameInitial;
    var tenureHtml = tenureVal > 0 ? '<div class="ogp-pos-tenure">' + tenureVal + '</div>' : '';

    html += '<div class="ogp-pos-holder">';
    html += '<div class="ogp-pos-portrait' + portraitCls + '">' + portrait + tenureHtml + '</div>';
    html += '<div class="ogp-pos-holder-info">';
    html += '<div class="ogp-pos-name-line"><span onclick="event.stopPropagation();if(typeof showCharPopup===\'function\')showCharPopup(\'' + escHtml(holder.name).replace(/'/g,"\\'") + '\',event)" style="cursor:pointer;">' + escHtml(holder.name||'?') + '</span>';
    if (holder.age) html += '<span class="age">\u00B7' + holder.age + '\u5C81</span>';
    html += '</div>';
    var subs = [];
    if (holder.hometown) subs.push(escHtml(holder.hometown));
    if (holder.party && holder.party !== '\u65E0\u515A') subs.push(escHtml(holder.party));
    if (subs.length) html += '<div class="ogp-pos-holder-sub">' + subs.join(' \u00B7 ') + '</div>';
    html += '</div>';
    html += '<span class="ogp-loyalty ' + loyCls + '">\u5FE0 ' + loy + '</span>';
    html += '</div>';

    // Stats
    var intelli = holder.intelligence||50, admin = holder.administration||50, mil = holder.military||50;
    function _sc(v){return v>=75?'good':v<40?'bad':'warn';}
    function _sb(v){return v>=75?'bg-good':v<40?'bg-bad':'bg-warn';}
    html += '<div class="ogp-pos-stats">';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u667A</span><span class="val ' + _sc(intelli) + '">' + intelli + '</span><div class="bar"><div class="' + _sb(intelli) + '" style="width:' + intelli + '%"></div></div></div>';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u653F</span><span class="val ' + _sc(admin) + '">' + admin + '</span><div class="bar"><div class="' + _sb(admin) + '" style="width:' + admin + '%"></div></div></div>';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u519B</span><span class="val ' + _sc(mil) + '">' + mil + '</span><div class="bar"><div class="' + _sb(mil) + '" style="width:' + mil + '%"></div></div></div>';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u5FE0</span><span class="val ' + _sc(loy) + '">' + loy + '</span><div class="bar"><div class="' + _sb(loy) + '" style="width:' + loy + '%"></div></div></div>';
    html += '</div>';

    // Meta (tenure)
    if (tenureVal > 0) {
      html += '<div class="ogp-pos-meta"><span class="tenure">\u4EFB <b>' + tenureVal + '</b> \u56DE</span></div>';
    }
  }

  // 待下诏书条
  if (p._pendingEdict && p._pendingEdict.turn === (GM && GM.turn)) {
    var pe = p._pendingEdict;
    var peTxt = pe.prevHolder ? ('\u6539 ' + escHtml(pe.prevHolder) + ' \u2192 ' + escHtml(pe.newHolder)) : ('\u4EFB ' + escHtml(pe.newHolder));
    html += '<div class="og-pending-edict"><span class="og-pe-lbl">\u3014\u5F85\u4E0B\u8BCF\u4E66\u3015</span><span class="og-pe-txt">' + peTxt + '</span><button class="og-pe-undo" onclick="event.stopPropagation();_offUndoAppointment(\'' + escHtml(pe.deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(pe.posName).replace(/'/g,"\\'") + '\')">\u64A4 \u9500</button></div>';
  }

  html += '</div>';
  return html;
}

// 官制列表视图渲染·皇帝舞台 + 部门横列 + 行内展开
function _renderOfficeTreeList(container) {
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._officeFilterMode) GM._officeFilterMode = 'all';
  if (typeof _officeInitDefaults === 'function') _officeInitDefaults();
  var courtKey = GM._officeCourt || 'central';
  var subTab = (GM._officeSubTab && GM._officeSubTab[courtKey]) || 'all';

  var tree = GM.officeTree || [];
  // 识别皇帝节点（若有）与部门列表（按 court+subTab 过滤）
  var emperor = null;
  var depts = [];
  tree.forEach(function(d){
    if (d && (d.isEmperor || d.type === 'emperor' || /^\u7687\u5E1D|^\u5929\u5B50|^\u671D\u5EF7$/.test(d.name||''))) { emperor = d; return; }
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    if (cls.court !== courtKey) return;
    if (subTab !== 'all' && cls.group !== subTab) return;
    depts.push(d);
  });

  // 当前 subTab 计数·供筛选条
  var totalPos = 0, totalFil = 0, totalVac = 0;
  depts.forEach(function(d){
    var r = _officeCountDept(d);
    totalPos += r.posCount; totalFil += r.filCount; totalVac += r.vacCount;
  });

  // court 级计数·供 court tabs 徽标
  var perCourt = { central:{pos:0, vac:0}, inner:{pos:0, vac:0}, region:{pos:0, vac:0} };
  (GM.officeTree||[]).forEach(function(d){
    if (d.isEmperor || d.type === 'emperor' || /^\u7687\u5E1D|^\u5929\u5B50|^\u671D\u5EF7$/.test(d.name||'')) return;
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    (d.positions||[]).forEach(function(p){
      perCourt[cls.court].pos++;
      if (!p.holder) perCourt[cls.court].vac++;
    });
  });

  var _fm = GM._officeFilterMode;
  var _vm = GM._officeViewMode || 'list';
  var _kw = GM._officeSearchKw || '';
  var _fbActive = function(m){ return _fm===m?' active':''; };
  var _vmActive = function(m){ return _vm===m?' active':''; };
  var _sc = GM.running ? findScenarioById(GM.sid) : null;
  var _scnName = _sc ? _sc.name : '';
  var _dtText = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : ('T' + (GM.turn||0));
  var filterBar = '<div class="og-filter-bar">'
    + '<span class="og-fb-title">\u3014 \u5B98 \u5236 \u6811 \u3015</span>'
    + '<button class="og-fb-btn' + _fbActive('all') + '" onclick="setOfficeFilterMode(\'all\')" title="\u663E\u793A\u5168\u90E8">\u5168\u90E8 <span class="og-fb-n">' + totalPos + '</span></button>'
    + '<button class="og-fb-btn empty' + _fbActive('empty') + '" onclick="setOfficeFilterMode(\'empty\')" title="\u53EA\u770B\u7A7A\u7F3A">\u7A7A\u7F3A <span class="og-fb-n">' + totalVac + '</span></button>'
    + '<button class="og-fb-btn filled' + _fbActive('filled') + '" onclick="setOfficeFilterMode(\'filled\')" title="\u53EA\u770B\u5728\u4EFB">\u5728\u4EFB <span class="og-fb-n">' + totalFil + '</span></button>'
    + '<input id="office-search-input" class="og-fb-search" placeholder="\u641C \u59D3\u540D/\u5B98\u804C/\u7C4D\u8D2F/\u6D3E\u7CFB\u2026" value="' + escHtml(_kw) + '" oninput="setOfficeSearchKw(this.value)"/>'
    + '<span style="display:inline-block;width:1px;height:16px;background:var(--color-border-subtle);margin:0 6px;"></span>'
    + '<button class="og-fb-btn' + _vmActive('list') + '" onclick="setOfficeViewMode(\'list\')" title="\u5217\u8868\u89C6\u56FE">\u5217 \u8868</button>'
    + '<button class="og-fb-btn' + _vmActive('tree') + '" onclick="setOfficeViewMode(\'tree\')" title="\u6811\u56FE\u89C6\u56FE">\u6811 \u56FE</button>'
    + (_dtText ? '<span class="og-fb-stats">' + escHtml(_dtText) + (_scnName ? ' \u00B7 ' + escHtml(_scnName) : '') + '</span>' : '')
    + '</div>';

  // 三朝 court tabs
  var _courtTabsHtml = ''
    + '<div class="og-court-tabs">'
    + _buildCourtTab('central', '\u5916 \u671D', '\u4E2D \u592E \u767E \u53F8', perCourt.central, courtKey)
    + _buildCourtTab('inner',   '\u5185 \u671D', '\u5185 \u5EF7 \u5BAB \u7981', perCourt.inner, courtKey)
    + _buildCourtTab('region',  '\u5916 \u671D', '\u5730 \u65B9 \u7763 \u629A', perCourt.region, courtKey)
    + '</div>';

  // 二级 subtab
  var _subCfg = (typeof OFFICE_SUBTABS !== 'undefined' && OFFICE_SUBTABS[courtKey]) ? OFFICE_SUBTABS[courtKey] : [{key:'all', name:'\u5168\u90E8', desc:''}];
  var _subtabsHtml = '<div class="og-subtabs-bar">';
  _subCfg.forEach(function(s){
    var cnt = _countSubtabPos(courtKey, s.key);
    var cls = 'og-subtab' + (s.key === subTab ? ' active' : '');
    _subtabsHtml += '<button class="' + cls + '" onclick="setOfficeSubTab(\'' + s.key + '\')">' + escHtml(s.name) + ' <span class="og-subtab-n">' + cnt.pos + '</span>';
    if (cnt.vac > 0) _subtabsHtml += '<span class="og-subtab-vac-pip" title="\u7A7A\u7F3A ' + cnt.vac + '"></span>';
    _subtabsHtml += '</button>';
  });
  var _curDesc = (_subCfg.find ? _subCfg.find(function(s){return s.key===subTab;}) : null);
  if (_curDesc) _subtabsHtml += '<span class="og-subtab-desc">' + escHtml(_curDesc.desc || '') + '</span>';
  _subtabsHtml += '</div>';

  filterBar = filterBar + _courtTabsHtml + _subtabsHtml;

  // 皇帝舞台（ogp-* 预览样式）
  var playerChar = (GM.chars||[]).find(function(c){ return c && c.isPlayer; });
  var dateText = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : ('T' + (GM.turn||0));
  var emperorTitle = emperor ? emperor.name : (playerChar ? (playerChar.title||playerChar.name||'\u5929\u5B50') : '\u5929\u5B50');
  var emperorHtml = '<div class="ogp-emperor-stage"><div class="ogp-emperor">'
    + '<div class="eb">\u5929 \u547D \u6240 \u5F52</div>'
    + '<div class="nm">' + escHtml(emperorTitle) + '</div>'
    + '<div class="rg">' + escHtml(dateText) + '</div>'
    + '</div></div>';

  // 部门横列 + 展开面板（同一 grid·panel 用 grid-column:1/-1 占满）
  var bodyHtml = '<div class="ogp-dept-row">';
  depts.forEach(function(d, idx){
    var key = JSON.stringify([idx + (emperor?1:0)]);
    var isOpen = GM._officeCollapsed[key] === true;
    var cnt = _officeCountDept(d);
    var seal = (d.name||'?').charAt(0);
    bodyHtml += '<div class="ogp-dept' + (isOpen?' expanded':'') + '" onclick="toggleListDept(' + (idx + (emperor?1:0)) + ')">'
      + '<span class="chev">\u25BE</span>'
      + '<span class="seal">' + escHtml(seal) + '</span>'
      + '<div class="nm">' + escHtml(d.name||'?') + '</div>'
      + '<div class="meta">\u7F16<b>' + cnt.posCount + '</b>\u00B7\u5B9E<b>' + cnt.filCount + '</b>'
      + (cnt.vacCount>0?' <span class="vac-pip"></span>':'')
      + '</div></div>';
  });
  // 面板在同一 grid 外·插到 grid 底部
  bodyHtml += '</div>';
  // 独立展开面板（每个打开的部门一个 panel）
  depts.forEach(function(d, idx){
    var key = JSON.stringify([idx + (emperor?1:0)]);
    var isOpen = GM._officeCollapsed[key] === true;
    if (!isOpen) return;
    var cnt = _officeCountDept(d);
    var positionsHtml = '';
    (function _emit(node, pathArr){
      (node.positions||[]).forEach(function(p, pi){
        if (!_officePosMatchFilter(p, _fm)) return;
        if (!_officePosMatchKw(p, _kw)) return;
        positionsHtml += _ogpRenderPosCard(p, node.name || d.name, pathArr.concat(['positions', pi]));
      });
      (node.subs||[]).forEach(function(sub, si){
        _emit(sub, pathArr.concat(['subs', si]));
      });
    })(d, [idx + (emperor?1:0)]);

    bodyHtml += '<div class="ogp-panel open">'
      + '<div class="title">\u3014<b>' + escHtml(d.name||'?') + '</b>\u3015<small>\u7F16 ' + cnt.posCount + ' \u00B7 \u5B9E ' + cnt.filCount + (cnt.vacCount>0?(' \u00B7 \u7A7A ' + cnt.vacCount):'') + '</small></div>'
      + '<div class="ogp-positions">' + (positionsHtml || '<div style="grid-column:1/-1;text-align:center;color:var(--color-foreground-muted);padding:2rem;">\u65E0\u5339\u914D\u804C\u4F4D</div>') + '</div>'
      + '</div>';
  });

  container.innerHTML = filterBar + '<div class="ogp-wrap">' + emperorHtml + bodyHtml + '</div>';
}

function renderOfficeTree(){
  var el=_$("office-tree");if(!el)return;
  // 容错：如果 GM.officeTree 为空但 P.officeTree 有数据，恢复
  if ((!GM.officeTree || GM.officeTree.length===0) && P.officeTree && P.officeTree.length > 0) {
    try { GM.officeTree = deepClone(P.officeTree); } catch(_e) { GM.officeTree = P.officeTree; }
  }
  if(!GM.officeTree||GM.officeTree.length===0){
    el.innerHTML='<div style="color:var(--txt-d);font-size:0.82rem;padding:1rem;text-align:center;">\u5B98\u5236\u672A\u914D\u7F6E\u3002\u8BF7\u5728\u5267\u672C\u7F16\u8F91\u5668\u7684\u300C\u653F\u5E9C\u300D\u6216\u300C\u5B98\u5236\u300D\u9762\u677F\u4E2D\u914D\u7F6E\uFF0C\u6216\u70B9\u4E0A\u65B9\u300C\uFF0B \u90E8\u95E8\u300D\u6DFB\u52A0</div>';
    return;
  }
  // v10·初始化默认折叠+分类
  if (typeof _officeInitDefaults === 'function') _officeInitDefaults();
  // 视图模式·v10 默认 tree（预览同）·仅当玩家手动切过才保留其选择
  if (!GM._officeViewMode) GM._officeViewMode = 'tree';
  if (!GM._officeViewModeExplicit && GM._officeViewMode === 'list') {
    // 未显式切换过·一次性迁移到 tree
    GM._officeViewMode = 'tree';
  }
  try {
    if (GM._officeViewMode === 'list' && typeof _renderOfficeTreeList === 'function') {
      _renderOfficeTreeList(el);
    } else if (typeof _officeBuildTree === 'function') {
      _renderOfficeTreeSVG(el);
    } else {
      el.innerHTML=GM.officeTree.map(function(d,i){return renderOfficeDeptV2(d,[i]);}).join("");
    }
    if (typeof _renderOfficeSummary === 'function') _renderOfficeSummary();
  } catch(e) {
    console.error('[renderOfficeTree] 渲染失败，降级为列表视图:', e);
    try {
      el.innerHTML=GM.officeTree.map(function(d,i){return renderOfficeDeptV2(d,[i]);}).join("");
      if (typeof _renderOfficeSummary === 'function') _renderOfficeSummary();
    } catch(e2) {
      el.innerHTML = '<div style="color:var(--vermillion-400);padding:1rem;">\u5B98\u5236\u6811\u6E32\u67D3\u5931\u8D25\uFF1A' + escHtml(e.message || String(e)) + '</div>';
    }
  }
}

/** v2 helper：每个节点的可视高度（部门 ~120，职位 ~196·有「待下诏书」条时 +34） */
function _ogCardHeight(fi) {
  if (fi.isPos) {
    var _pe = fi.node && fi.node._pendingEdict;
    var _hasPe = _pe && typeof GM !== 'undefined' && _pe.turn === GM.turn;
    return _hasPe ? 230 : 196;
  }
  if (fi.depth === 0) return 100;
  return 110;
}

/** v2 helper：从 rank 字符串得品级档 CSS class */
function _ogRankClass(rankStr) {
  var lvl = typeof getRankLevel === 'function' ? getRankLevel(rankStr) : 18;
  if (lvl <= 2) return 'og-rank-top';
  if (lvl <= 6) return 'og-rank-high';
  if (lvl <= 10) return 'og-rank-mid';
  if (lvl <= 18) return 'og-rank-low';
  return 'og-rank-base';
}

/** v2 helper：党派→CSS class */
function _ogPartyClass(p) {
  if (!p) return '';
  var s = String(p);
  if (/\u4E1C\u6797/.test(s)) return 'dongin';
  if (/\u6D59/.test(s)) return 'zhe';
  if (/\u9609|\u5BA6|\u5B98\u515A/.test(s)) return 'yan';
  if (/\u6606/.test(s)) return 'kun';
  if (/\u6E05\u6D41|\u5E03\u8863/.test(s)) return 'qing';
  return '';
}

/** v2 helper：渲染部门卡 */
function _ogRenderDeptCard(fi, idx, NW, cardH, pathStr) {
  var nd = fi.node;
  var isEmperor = fi.depth === 0;
  var isRoot1 = fi.depth === 1;
  var depthCls = isEmperor ? 'depth-0' : (isRoot1 ? 'depth-1' : '');

  var psCount = (nd.positions || []).length;
  var subCount = (nd.subs || []).length;
  var vacCount = (nd.positions||[]).filter(function(p){return !p.holder;}).length;
  var filledCount = psCount - vacCount;
  var canCollapse = (psCount + subCount > 0) && !isEmperor;
  var isColl = fi.collapsed;

  // 实权指数
  var _deptPower = 0;
  if (!isEmperor && psCount > 0) {
    (nd.positions||[]).forEach(function(p) {
      if (p.holder) {
        var _pc = findCharByName(p.holder);
        var _rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 10;
        _deptPower += (_pc ? ((_pc.intelligence||50)+(_pc.administration||50))/2 : 30) + Math.max(0, (18 - _rl)) * 3;
      }
    });
    _deptPower = Math.round(_deptPower / Math.max(1, psCount));
  } else if (isEmperor) {
    _deptPower = Math.round(((GM.vars||{}).imperialAuthority || (GM.vars||{}).huangquan || 60));
  }
  var _pwCls = _deptPower > 70 ? 'hi' : _deptPower > 45 ? 'mid' : 'lo';
  var _pwOff = 94.2 * (1 - Math.min(100, Math.max(0, _deptPower)) / 100);

  var _safeDept = escHtml(nd.name||'').replace(/'/g,"\\'");
  var _deptClickable = canCollapse && !isEmperor;
  var _deptClickClass = _deptClickable ? ' clickable' : '';
  if (_deptClickable && isColl) _deptClickClass += ' collapsed';
  var _deptClickHandler = _deptClickable
    ? ('onclick="if(event.target.closest(\'.og-dept-collapse,.og-dept-btn\'))return;GM._officeCollapsed[JSON.stringify(' + pathStr + ')]=!GM._officeCollapsed[JSON.stringify(' + pathStr + ')];renderOfficeTree();"')
    : '';
  var html = '';
  html += '<div class="og-dept-card ' + depthCls + _deptClickClass + '" style="left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + NW + 'px;height:' + cardH + 'px;" ' + _deptClickHandler + '>';
  // 顶栏：名 + 实权环 + 折叠
  html += '<div class="og-dept-hdr">';
  html += '<span class="nm">' + escHtml(nd.name||'?') + (_deptClickable ? '<span class="og-dept-chevron-indicator">' + (isColl?'\u25B8':'\u25BE') + '</span>' : '') + '</span>';
  if (!isEmperor || _deptPower > 0) {
    html += '<div class="og-power-ring ' + _pwCls + '" title="\u5B9E\u6743\u6307\u6570 ' + _deptPower + '">';
    html += '<svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15" fill="none" stroke-width="3"/>';
    html += '<circle class="fg" cx="18" cy="18" r="15" fill="none" stroke-width="3" stroke-dasharray="94.2" stroke-dashoffset="' + _pwOff.toFixed(1) + '"/></svg>';
    html += '<div class="txt">' + _deptPower + '</div></div>';
  }
  if (canCollapse) {
    html += '<button class="og-dept-collapse" onclick="event.stopPropagation();GM._officeCollapsed[JSON.stringify(' + pathStr + ')]=!GM._officeCollapsed[JSON.stringify(' + pathStr + ')];renderOfficeTree();" title="' + (isColl ? '\u5C55\u5F00' : '\u6298\u53E0') + '">' + (isColl ? '\u25BC' : '\u25B2') + '</button>';
  }
  html += '</div>';

  // 主体
  html += '<div class="og-dept-body">';
  // 职能 chip
  if (nd.functions && nd.functions.length > 0) {
    html += '<div class="og-dept-func-row">';
    nd.functions.slice(0,5).forEach(function(f){ html += '<span class="og-dept-func">' + escHtml(f) + '</span>'; });
    html += '</div>';
  } else if (isEmperor) {
    var _playerChar = (GM.chars||[]).find(function(c){return c.isPlayer;});
    if (_playerChar) {
      html += '<div class="og-dept-func-row">';
      html += '<span class="og-dept-func">' + escHtml(_playerChar.name || '') + '</span>';
      if (_playerChar.age) html += '<span class="og-dept-func">\u5E74 ' + _playerChar.age + '</span>';
      html += '</div>';
    }
  }
  // 编制填充条
  if (!isEmperor && psCount > 0) {
    var fillPct = psCount > 0 ? Math.round(filledCount / psCount * 100) : 0;
    var vacPct = 100 - fillPct;
    html += '<div class="og-dept-fill">';
    html += '<span class="num">\u7F16\u5236</span>';
    html += '<div class="og-dept-fill-bar">';
    html += '<div class="fg" style="width:' + fillPct + '%;"></div>';
    if (vacPct > 0) html += '<div class="vac" style="width:' + vacPct + '%;"></div>';
    html += '</div>';
    html += '<span class="num">' + filledCount + ' / ' + psCount + '</span>';
    if (vacCount === 0) html += '<span class="og-hc-chip full">\u6EE1</span>';
    else if (fillPct >= 70) html += '<span class="og-hc-chip part">\u7F3A ' + vacCount + '</span>';
    else html += '<span class="og-hc-chip vac">\u7F3A ' + vacCount + '</span>';
    html += '</div>';
  }
  // 操作按钮行
  if (!isEmperor) {
    html += '<div class="og-dept-actions">';
    html += '<button class="og-dept-btn" onclick="event.stopPropagation();_offReformToEdict(\'add_pos\',\'' + _safeDept + '\')" title="\u589E\u8BBE\u5B98\u804C">+\u5B98</button>';
    html += '<button class="og-dept-btn" onclick="event.stopPropagation();_offReformToEdict(\'add_sub\',\'' + _safeDept + '\')" title="\u589E\u8BBE\u4E0B\u5C5E\u90E8\u95E8">+\u5C40</button>';
    html += '<button class="og-dept-btn" onclick="event.stopPropagation();_offReformToEdict(\'rename\',\'' + _safeDept + '\')" title="\u6539\u540D">\u6539</button>';
    html += '<button class="og-dept-btn danger" onclick="event.stopPropagation();_offReformToEdict(\'abolish\',\'' + _safeDept + '\')" title="\u88C1\u6492">\u88C1</button>';
    html += '</div>';
  }
  html += '</div>'; // .og-dept-body
  html += '</div>'; // .og-dept-card
  return html;
}

/** v2 helper：渲染职位卡 */
function _ogRenderPosCard(fi, idx, NW, cardH) {
  var nd = fi.node;
  if (typeof _offMigratePosition === 'function') _offMigratePosition(nd);

  var _holder = nd.holder ? findCharByName(nd.holder) : null;
  var _deptName = fi.parent && fi.parent.node ? (fi.parent.node.name||'') : '';
  var _parentFunc = fi.parent && fi.parent.node && fi.parent.node.functions ? (fi.parent.node.functions[0]||'') : '';

  var _rankCls = _ogRankClass(nd.rank);
  var _rankInfo = nd.rank && typeof getRankInfo === 'function' ? getRankInfo(nd.rank) : null;

  var _hc = nd.headCount || 1;
  var _ac = nd.actualCount || 0;
  var _mc = typeof _offMaterializedCount === 'function' ? _offMaterializedCount(nd) : (nd.holder ? 1 : 0);
  var _vacant = (_hc||1) - (_ac||0);
  var _unmat = (_ac||0) - _mc;

  var _tenureKey = _deptName + (nd.name||'');
  var _tenureVal = (_holder && _holder._tenure && _tenureKey) ? (_holder._tenure[_tenureKey]||0) : 0;
  var _satisfaction = nd.holder && typeof calcOfficialSatisfaction === 'function' ? calcOfficialSatisfaction(nd.holder, nd.rank, _deptName) : null;
  var _lastEval = (nd._evaluations && nd._evaluations.length > 0) ? nd._evaluations[nd._evaluations.length-1] : null;
  var _evals = (nd._evaluations||[]).slice(-3);

  // 主按钮
  var _safeDept = escHtml(_deptName).replace(/'/g,"\\'");
  var _safePos = escHtml(nd.name||'').replace(/'/g,"\\'");
  var _safePath = JSON.stringify(fi.path).replace(/"/g,'&quot;');
  var _mainBtn = '';
  if (nd.holder) {
    _mainBtn = '<button class="og-pos-action-btn change" onclick="event.stopPropagation();_offOpenPicker(' + _safePath + ',\'' + _safeDept + '\',\'' + _safePos + '\',\'' + escHtml(nd.holder||'').replace(/'/g,"\\'") + '\')" title="\u6539\u6362\u5728\u4EFB\u8005">\u6539 \u6362</button>';
  } else if (_unmat > 0 && _ac > 0) {
    _mainBtn = '<button class="og-pos-action-btn concretize" onclick="event.stopPropagation();if(typeof _offMaterialize===\'function\')_offMaterialize(\'' + _safeDept + '\',\'' + _safePos + '\')" title="\u5177\u8C61\u5316">\u5177 \u8C61</button>';
  } else {
    _mainBtn = '<button class="og-pos-action-btn appoint" onclick="event.stopPropagation();_offOpenPicker(' + _safePath + ',\'' + _safeDept + '\',\'' + _safePos + '\',\'\')" title="\u4EFB\u547D">\u4EFB \u547D</button>';
  }

  // 在任者行 class
  var _holderCls = 'vacant';
  if (_holder) {
    var _loy = _holder.loyalty||50;
    _holderCls = _loy >= 70 ? 'loyal' : _loy < 35 ? 'danger' : 'mid';
  }

  var _isVacantCard = !_holder;
  // 状态识别：丁忧守制（已存在数据）·其他（告病/权摄/兼任/贬谪/致仕）为未来扩展预留 CSS
  var _stateCls = '';
  var _stateBadge = '';
  if (_holder && _holder._mourning) { _stateCls = ' og-state-mourning'; _stateBadge = '<div class="og-mourn-badge">\u4E01 \u5FE7</div>'; }
  else if (_holder && _holder._sickLeave) { _stateCls = ' og-state-sick'; }
  else if (_holder && _holder._actingPos) { _stateCls = ' og-state-acting'; _stateBadge = '<div class="og-acting-stamp">\u7F72</div>'; }
  else if (_holder && _holder._demoted) { _stateCls = ' og-state-demoted'; _stateBadge = '<div class="og-demoted-tag">\u8D2C \u8C2A</div>'; }
  else if (_holder && _holder._retirePending) { _stateCls = ' og-state-retire'; _stateBadge = '<div class="og-retire-glow"></div>'; }
  var _isConcurrent = _holder && _holder._concurrentWith;
  var _concurrentTag = _isConcurrent ? '<div class="og-concurrent-stack">+\u517C</div>' : '';

  // listMode·列表视图·无需绝对定位
  var _listMode = !!(fi && fi._listMode);
  var _posStyle = _listMode
    ? ''
    : 'style="left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + NW + 'px;height:' + cardH + 'px;"';

  var html = '';
  html += '<div class="og-pos-card ' + _rankCls + (_isVacantCard?' og-vacant-card':'') + _stateCls + (_listMode?' og-pos-card-list':'') + '" ' + _posStyle + '>';
  html += '<div class="og-rank-bar"></div>';
  html += _stateBadge + _concurrentTag;
  if (_isVacantCard) html += '<div class="og-vacant-dot" title="\u6B64\u804C\u7A7A\u7F3A\u5F85\u8865"></div>';

  // 顶栏：官职 + 品级（朱砂印）+ 主按钮
  var _rankLvl = typeof getRankLevel === 'function' ? getRankLevel(nd.rank) : 18;
  var _sealCls = _rankLvl <= 6 ? '' : _rankLvl <= 12 ? ' mid-lvl' : ' low-lvl';
  html += '<div class="og-pos-top">';
  html += '<div class="og-pos-nm-wrap">';
  html += '<div class="og-pos-nm">' + escHtml(nd.name||'?');
  if (nd.rank) html += '<span class="og-rank-seal' + _sealCls + '">' + escHtml(nd.rank) + '</span>';
  html += '</div>';
  var subParts = [];
  if (_deptName) subParts.push(escHtml(_deptName));
  if (_parentFunc) subParts.push('<span class="sep">\u00B7</span><span>' + escHtml(_parentFunc) + '</span>');
  if (subParts.length > 0) html += '<div class="og-pos-sub-line">' + subParts.join('') + '</div>';
  html += '</div>';
  html += _mainBtn;
  html += '</div>';

  // 在任者行
  html += '<div class="og-pos-holder-row ' + _holderCls + '">';
  if (_holder) {
    var _portrait = _holder.portrait ? '<img src="' + escHtml(_holder.portrait) + '">' : escHtml(String(_holder.name||'?').charAt(0));
    var _imperialCls = _rankLvl <= 4 ? ' og-portrait-imperial' : '';
    var _tenureHtml = (_tenureVal > 0) ? '<span class="og-tenure-ring">' + _tenureVal + '</span>' : '';
    html += '<div class="og-pos-portrait' + _imperialCls + '">' + _portrait + _tenureHtml + '</div>';
    html += '<div class="og-pos-holder-info">';
    html += '<div class="og-pos-name-line">';
    html += '<span class="nm" onclick="event.stopPropagation();if(typeof showCharPopup===\'function\')showCharPopup(\'' + escHtml(_holder.name||'').replace(/'/g,"\\'") + '\',event)">' + escHtml(_holder.name||'?') + '</span>';
    // 党派徽章
    var _pty = _holder.party || _holder.faction;
    if (_pty && _pty !== '\u671D\u5EF7') {
      var _ptyCls = _ogPartyClass(_pty);
      html += '<span class="og-party-tag' + (_ptyCls?' '+_ptyCls:'') + '">' + escHtml(String(_pty).slice(0,4)) + '</span>';
    }
    if (_hc > 1) html += '<span class="og-hc-chip' + (_vacant===0?' full':_vacant>0?' part':'') + '">\u7F16' + _hc + '\u00B7\u5B9E' + _ac + '</span>';
    html += '</div>';
    // 年龄/任期/满意度
    var subLine = [];
    if (_holder.age) subLine.push('\u5E74 ' + _holder.age);
    if (_tenureVal > 0) subLine.push('\u4EFB ' + _tenureVal + ' \u56DE\u5408');
    if (_satisfaction && typeof _satisfaction.score === 'number') {
      var _ssClr = _satisfaction.score >= 65 ? 'var(--celadon-400)' : _satisfaction.score >= 45 ? 'var(--amber-400,#c9a045)' : 'var(--vermillion-400)';
      subLine.push('<span style="color:' + _ssClr + ';">\u6EE1\u610F ' + Math.round(_satisfaction.score) + '</span>');
    }
    if (subLine.length > 0) {
      html += '<div class="og-pos-sub-line">' + subLine.map(function(p, i){ return (i>0?'<span class="sep">\u00B7</span>':'') + p; }).join('') + '</div>';
    }
    html += '</div>';
  } else if (_listMode) {
    // 列表模式·空缺·极简只显警告·对齐预览
    html += '<div style="flex:1;text-align:center;padding:14px 0;font-style:italic;letter-spacing:0.3em;color:var(--ink-300,#7a6e54);font-size:13px;">\u3014 \u7A7A \u7F3A \u00B7 \u5F85 \u8865 \u3015</div>';
  } else {
    html += '<div class="og-pos-portrait vacant">?</div>';
    html += '<div class="og-pos-holder-info">';
    html += '<div class="og-pos-name-line"><span style="font-style:italic;">\u7A7A \u7F3A</span>';
    if (_hc > 1) html += '<span class="og-hc-chip vac">\u7F16' + _hc + '\u00B7\u5B9E' + _ac + '</span>';
    html += '</div>';
    html += '<div class="og-pos-sub-line" style="color:var(--vermillion-400);">\u6B64\u804C\u65E0\u4EBA\u00B7\u5F85\u8865</div>';
    html += '</div>';
  }
  html += '</div>';

  // 能力四维（仅在任显示·空缺不显）
  if (_holder) {
    var _loyVal = _holder.loyalty||50;
    var _loyCls = _loyVal >= 70 ? 'hi' : _loyVal < 40 ? 'lo' : 'mid';
    html += '<div class="og-stats-row">';
    html += '<span class="og-stat-box"><span class="lbl">\u667A</span><span class="v">' + (_holder.intelligence||50) + '</span><span class="og-stat-bar-mini" style="--w:' + (_holder.intelligence||50) + '%;"></span></span>';
    html += '<span class="og-stat-box"><span class="lbl">\u653F</span><span class="v">' + (_holder.administration||50) + '</span><span class="og-stat-bar-mini" style="--w:' + (_holder.administration||50) + '%;"></span></span>';
    html += '<span class="og-stat-box"><span class="lbl">\u519B</span><span class="v">' + (_holder.military||50) + '</span><span class="og-stat-bar-mini" style="--w:' + (_holder.military||50) + '%;"></span></span>';
    html += '<span class="og-stat-box loy ' + _loyCls + '"><span class="lbl">\u5FE0</span><span class="v">' + _loyVal + '</span><span class="og-stat-bar-mini" style="--w:' + _loyVal + '%;"></span></span>';
    html += '</div>';
  } else if (!_listMode) {
    html += '<div class="og-empty-msg">\u6B64\u804C\u65E0\u4EBA\u00B7\u653F\u52A1\u505C\u6EDE</div>';
  } else {
    // 列表模式空缺·底部朱红警告
    html += '<div style="padding:10px 14px;text-align:center;color:var(--vermillion-400);font-size:11px;letter-spacing:0.1em;border-top:1px dashed rgba(192,64,48,0.2);">\u6B64 \u804C \u65E0 \u4EBA \u00B7 \u653F \u52A1 \u505C \u6EDE</div>';
  }

  // 权限图标（列表模式空缺时跳过·保持极简）
  if (nd.powers && !(_listMode && !_holder)) {
    var pw = nd.powers;
    html += '<div class="og-powers">';
    html += '<span class="og-powers-lbl">\u6743</span>';
    html += '<span class="og-power-icon appoint' + (pw.appointment?'':' off') + '" title="\u8F9F\u4E3E\u6743">\u8F9F</span>';
    html += '<span class="og-power-icon impeach' + (pw.impeach?'':' off') + '" title="\u5F39\u52BE\u6743">\u5F39</span>';
    html += '<span class="og-power-icon tax' + (pw.taxCollect?'':' off') + '" title="\u7A0E\u6536\u6743">\u7A0E</span>';
    html += '<span class="og-power-icon military' + (pw.militaryCommand?'':' off') + '" title="\u519B\u6743">\u5175</span>';
    html += '<span class="og-power-icon supervise' + (pw.supervise?'':' off') + '" title="\u76D1\u5BDF\u6743">\u76D1</span>';
    html += '</div>';
  }

  // 公库/陋规/任期/考评
  var metaParts = [];
  if (nd.publicTreasuryInit) {
    var pti = nd.publicTreasuryInit;
    if (pti.money) metaParts.push('<span class="og-meta-treasury">\u94F6 ' + Math.round(pti.money/10000) + ' \u4E07</span>');
    if (pti.grain) metaParts.push('<span class="og-meta-grain">\u7C73 ' + Math.round(pti.grain/10000) + ' \u4E07</span>');
  }
  if (nd.privateIncome && nd.privateIncome.illicitRisk === 'high') {
    metaParts.push('<span class="og-meta-illicit hot">\u80A5\u7F3A</span>');
  } else if (nd.privateIncome && nd.privateIncome.illicitRisk === 'low') {
    metaParts.push('<span class="og-meta-illicit cold">\u6E05\u8981</span>');
  }
  if (_tenureVal > 12) {
    metaParts.push('<span class="og-meta-tenure warn">\u4E45\u7559 ' + _tenureVal + ' \u56DE</span>');
  }
  if (_evals.length > 0) {
    var evalHtml = '<span class="og-eval-history"><span class="lbl">\u8003</span>';
    _evals.forEach(function(ev){
      var g = ev.grade||'';
      var dotCls = /\u4E0A|\u4F18|\u7532/.test(g) ? 'up' : /\u4E0B|\u52A3|\u4E01/.test(g) ? 'dn' : 'mid';
      evalHtml += '<span class="og-eval-dot ' + dotCls + '" title="' + escHtml(g) + '">' + escHtml(g.charAt(0)||'·') + '</span>';
    });
    evalHtml += '</span>';
    metaParts.push(evalHtml);
  }
  if (metaParts.length > 0) {
    html += '<div class="og-meta-row">';
    html += metaParts.map(function(p, i){ return (i>0?'<span class="sep">\u00B7</span>':'') + p; }).join('');
    html += '</div>';
  }

  // 状态文本内容（丁忧/告病/权摄/贬谪/致仕/兼任 的底部说明条）
  if (_holder) {
    if (_holder._mourning) {
      var _mp = _holder._mourning;
      var _mt = '依制守孝';
      if (_mp.parent) _mt = '因' + escHtml(_mp.parent) + '殁·' + _mt;
      if (_mp.until) _mt += '·<b>T' + _mp.until + '</b> 期满';
      else if (typeof _mp.turnsLeft === 'number') _mt += '·还需 <b>' + _mp.turnsLeft + '</b> 回合';
      else _mt += '<b> 27</b> 月再起';
      html += '<div class="og-state-note mourn">' + _mt + '</div>';
    } else if (_holder._sickLeave) {
      var _sk = _holder._sickLeave;
      var _skTxt = escHtml(_sk.reason || '\u75C5\u6682\u79BB');
      var _skDays = _sk.days || _sk.duration;
      html += '<div class="og-sick-banner"><span class="icon">\u2695</span><span class="sec-lbl">\u544A \u75C5</span><span>' + _skTxt + '</span>' + (_skDays ? '<span style="margin-left:auto;">\u2192 <b>' + _skDays + ' \u65E5</b></span>' : '') + '</div>';
    } else if (_holder._actingPos) {
      var _ap = _holder._actingPos;
      var _apNote = _ap.note || ('\u4EE5' + (_ap.fromPos||'\u4F9B\u804C') + '\u6444' + (nd.name||'\u5C1A\u4E66') + '\u4E8B\u00B7\u4FDF\u9662\u4E0B\u7B80\u62D4\u6B63\u5B98');
      html += '<div class="og-acting-note">' + escHtml(_apNote) + '</div>';
    } else if (_holder._demoted) {
      var _dm = _holder._demoted;
      var _dmReason = _dm.reason || '\u88AB\u8D2C\u00B7\u56DE\u4EFB\u5E0C\u671B\u6E3A\u8302';
      html += '<div class="og-state-note demoted">' + escHtml(_dmReason) + '</div>';
    } else if (_holder._retirePending) {
      var _rp = _holder._retirePending;
      var _rpTxt = (_holder.age ? _holder.age + '\u5C81' : '\u5E74\u9AD8') + (_rp.count ? '\u00B7' + _rp.count + '\u5EA6\u8BF7\u8F9E' : '\u00B7\u8BF7\u9AB8\u9AA8\u5F52') + '\u00B7\u9661\u4E0B\u672A\u5141';
      html += '<div class="og-state-note retire">' + escHtml(_rpTxt) + '</div>';
    }
    if (_holder._concurrentWith) {
      var _cw = _holder._concurrentWith;
      var _cwName = (typeof _cw === 'string') ? _cw : (_cw.posName || _cw.name || '\u4ED6\u804C');
      html += '<div class="og-concurrent-second"><span class="sec-lbl">\u517C</span><span>' + escHtml(_cwName) + '</span></div>';
    }
  }

  // 历任链
  if (nd._history && nd._history.length > 0) {
    var _hist = nd._history.slice(-3);
    html += '<div class="og-history-rail">';
    html += '<span class="lbl">\u5386\u4EFB</span>';
    _hist.forEach(function(h, hi){
      if (hi > 0) html += '<span class="arr">\u2192</span>';
      html += '<span class="name">' + escHtml(h.holder||'?') + '</span>';
    });
    if (nd.holder) {
      html += '<span class="arr">\u2192</span>';
      html += '<span class="name current">' + escHtml(nd.holder) + '</span>';
    }
    html += '</div>';
  }

  // 待下诏书条（回合内生效·可撤销）
  var _pe = nd._pendingEdict;
  if (_pe && _pe.turn === GM.turn) {
    var _peTxt = _pe.prevHolder
      ? ('改 ' + escHtml(_pe.prevHolder) + ' \u2192 ' + escHtml(_pe.newHolder))
      : ('任 ' + escHtml(_pe.newHolder));
    html += '<div class="og-pending-edict" title="\u672C\u56DE\u5408\u672B\u6B63\u5F0F\u9881\u5E03\u00B7\u671F\u95F4\u53EF\u64A4\u9500">';
    html += '<span class="og-pe-lbl">\u3014\u5F85\u4E0B\u8BCF\u4E66\u3015</span>';
    html += '<span class="og-pe-txt">' + _peTxt + '</span>';
    html += '<button class="og-pe-undo" onclick="event.stopPropagation();_offUndoAppointment(\'' + escHtml(_pe.deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(_pe.posName).replace(/'/g,"\\'") + '\')">\u64A4 \u9500</button>';
    html += '</div>';
  }

  html += '</div>'; // .og-pos-card
  return html;
}

/** SVG树状图渲染（游戏版 v10 — 三朝 tab + 二级分类 + 嵌套群组四层树 + 默认折叠 + 自动居中） */
function _renderOfficeTreeSVG(container) {
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._officeFilterMode) GM._officeFilterMode = 'all';
  if (typeof _officeInitDefaults === 'function') _officeInitDefaults();
  var courtKey = GM._officeCourt || 'central';
  var subTab = (GM._officeSubTab && GM._officeSubTab[courtKey]) || 'all';

  var _origPTree = P.officeTree;
  P.officeTree = GM.officeTree;
  var _origCollapsed = P._officeCollapsed;
  P._officeCollapsed = GM._officeCollapsed;
  var layout = _officeBuildTreeV10({
    courtKey: courtKey, subTab: subTab, collapsed: GM._officeCollapsed,
    EMP_W: 240, EMP_H: 96, GROUP_H: 60,
    DEPT_W: 240, DEPT_H: 120,
    POS_W: 260, POS_H: 210,
    H_GAP: 22, DEPT_GAP: 18, V_GAP: 46, V_GAP_GROUP: 30
  });
  P.officeTree = _origPTree;
  P._officeCollapsed = _origCollapsed;

  var flat = layout.flat;
  var cw = Math.max(layout.width + 80, 700);
  var ch = Math.max(layout.height + 80, 400);

  // 空缺/在任统计（基于全 court·非仅当前 subTab）·供 court tabs 徽标显示
  var perCourt = { central:{pos:0, vac:0}, inner:{pos:0, vac:0}, region:{pos:0, vac:0} };
  (GM.officeTree||[]).forEach(function(d){
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    (d.positions||[]).forEach(function(p){
      perCourt[cls.court].pos++;
      if (!p.holder) perCourt[cls.court].vac++;
    });
  });

  // 当前 subTab 的空缺/在任（给 filter-bar 徽标）
  var empCount = 0, filCount = 0;
  for (var _ci = 0; _ci < flat.length; _ci++) {
    var _cfi = flat[_ci];
    if (_cfi.type !== 'pos') continue;
    if (_cfi.node && _cfi.node.holder) filCount++;
    else empCount++;
  }
  var allCount = empCount + filCount;

  var _fm = GM._officeFilterMode;
  var _kw = GM._officeSearchKw || '';
  function _ofMatch(fi) {
    if (fi.type !== 'pos') return true;
    if (fi.node && fi.node._pendingEdict && fi.node._pendingEdict.turn === GM.turn) return true;
    if (_kw && typeof _officePosMatchKw === 'function' && !_officePosMatchKw(fi.node, _kw)) return false;
    if (_fm === 'empty') return !fi.node.holder;
    if (_fm === 'filled') return !!fi.node.holder;
    return true;
  }

  // 包装旧版 _ogCardHeight/_ogRenderDeptCard/_ogRenderPosCard 以接 v10 节点（添加 isPos 字段）
  function _adaptForOld(fi) {
    fi.isPos = (fi.type === 'pos');
    if (fi.type === 'dept') {
      fi.depth = 1; // 旧版期望 depth 字段存在（部门=1）
    }
    return fi;
  }

  // SVG 连线：主干 + Group→Dept elbow + Dept→Pos elbow
  var svgLines = '';
  var themeCol = courtKey === 'inner' ? 'var(--purple-400)' : (courtKey === 'region' ? 'var(--indigo-400)' : 'var(--gold-500)');
  if (layout.groupNodes && layout.groupNodes.length > 0) {
    var empCx = layout.emperorCx;
    var empBottom = layout.root.y + layout.root.h;
    var lastG = layout.groupNodes[layout.groupNodes.length - 1];
    var spineBottom = lastG.y + lastG.h / 2;
    svgLines += '<path d="M ' + empCx + ' ' + empBottom + ' L ' + empCx + ' ' + spineBottom + '" stroke="var(--gold-400)" stroke-width="2.2" fill="none" opacity="0.82"/>';
  }
  for (var i = 0; i < flat.length; i++) {
    var fi = flat[i];
    if (!fi.parent) continue;
    if (!_ofMatch(fi)) continue;
    if (fi.type === 'group') continue; // 主干已覆盖
    var p = fi.parent;
    var px = p.x + p.w / 2;
    var py = p.y + p.h;
    var cx = fi.x + fi.w / 2;
    var cy = fi.y;
    var my = py + (cy - py) * 0.5;
    var clr = (fi.type === 'pos') ? 'var(--celadon-400)' : themeCol;
    var sw = (fi.type === 'pos') ? '1.5' : '1.8';
    var dsh = (fi.type === 'pos') ? ' stroke-dasharray="4,3"' : '';
    svgLines += '<path d="M' + px + ',' + py + ' L' + px + ',' + my + ' L' + cx + ',' + my + ' L' + cx + ',' + cy + '" stroke="' + clr + '" stroke-width="' + sw + '" fill="none" opacity="0.75"' + dsh + '/>';
  }

  // 群组包围框（背景层）
  var themeClassSuffix = courtKey === 'inner' ? ' theme-inner' : (courtKey === 'region' ? ' theme-region' : '');
  var wrapperBgs = '';
  layout.groupNodes.forEach(function(gNode){
    var minX = gNode.x, maxX = gNode.x + gNode.w, minY = gNode.y, maxY = gNode.y + gNode.h;
    function walk(c){
      if (c.x < minX) minX = c.x;
      if (c.x + c.w > maxX) maxX = c.x + c.w;
      if (c.y + c.h > maxY) maxY = c.y + c.h;
      c.children.forEach(walk);
    }
    gNode.children.forEach(walk);
    var padX = 10, padB = 12, padT = 4;
    var bx = minX - padX, by = minY - padT;
    var bw = (maxX - minX) + padX * 2;
    var bh = (maxY - minY) + padT + padB;
    wrapperBgs += '<div class="og-group-wrapper' + themeClassSuffix + '" style="left:' + bx + 'px;top:' + by + 'px;width:' + bw + 'px;height:' + bh + 'px;"></div>';
  });

  // 节点渲染
  var nodesDivs = '';
  for (var i2 = 0; i2 < flat.length; i2++) {
    var fi2 = flat[i2];
    if (!_ofMatch(fi2)) continue;
    if (fi2.type === 'emperor') {
      nodesDivs += _ogRenderEmperorCard(fi2);
    } else if (fi2.type === 'group') {
      nodesDivs += _ogRenderGroupBanner(fi2, themeClassSuffix);
    } else if (fi2.type === 'dept') {
      nodesDivs += _ogRenderDeptCardV10(fi2, courtKey);
    } else if (fi2.type === 'pos') {
      nodesDivs += _ogRenderPosCardV10(fi2, courtKey);
    }
  }

  var wrapperId = 'office-tree-wrap-game';
  var canvasId = 'office-tree-canvas-game';

  var _fbActive = function(m){ return _fm===m?' active':''; };
  var _vm = GM._officeViewMode || 'list';
  var _vmActive = function(m){ return _vm===m?' active':''; };
  var _kw2 = GM._officeSearchKw || '';
  var _sc2 = GM.running ? findScenarioById(GM.sid) : null;
  var _scnName2 = _sc2 ? _sc2.name : '';
  var _dtText2 = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : ('T' + (GM.turn||0));

  // 三朝 court tabs
  var _courtTabs = ''
    + '<div class="og-court-tabs">'
    + _buildCourtTab('central', '\u5916 \u671D', '\u4E2D \u592E \u767E \u53F8', perCourt.central, courtKey)
    + _buildCourtTab('inner',   '\u5185 \u671D', '\u5185 \u5EF7 \u5BAB \u7981', perCourt.inner, courtKey)
    + _buildCourtTab('region',  '\u5916 \u671D', '\u5730 \u65B9 \u7763 \u629A', perCourt.region, courtKey)
    + '</div>';

  // 二级 subtab
  var _subCfg = (typeof OFFICE_SUBTABS !== 'undefined' && OFFICE_SUBTABS[courtKey]) ? OFFICE_SUBTABS[courtKey] : [{key:'all', name:'\u5168\u90E8', desc:''}];
  var _subtabsHtml = '<div class="og-subtabs-bar">';
  _subCfg.forEach(function(s){
    var cnt = _countSubtabPos(courtKey, s.key);
    var cls = 'og-subtab' + (s.key === subTab ? ' active' : '');
    _subtabsHtml += '<button class="' + cls + '" onclick="setOfficeSubTab(\'' + s.key + '\')">' + escHtml(s.name) + ' <span class="og-subtab-n">' + cnt.pos + '</span>';
    if (cnt.vac > 0) _subtabsHtml += '<span class="og-subtab-vac-pip" title="\u7A7A\u7F3A ' + cnt.vac + '"></span>';
    _subtabsHtml += '</button>';
  });
  var _curDesc = (_subCfg.find ? _subCfg.find(function(s){return s.key===subTab;}) : null);
  if (_curDesc) _subtabsHtml += '<span class="og-subtab-desc">' + escHtml(_curDesc.desc || '') + '</span>';
  _subtabsHtml += '</div>';

  var filterBar = '<div class="og-filter-bar">'
    + '<span class="og-fb-title">\u3014 \u5B98 \u5236 \u6811 \u3015</span>'
    + '<button class="og-fb-btn' + _fbActive('all') + '" onclick="setOfficeFilterMode(\'all\')" title="\u663E\u793A\u5168\u90E8\u804C\u4F4D">\u5168\u90E8 <span class="og-fb-n">' + allCount + '</span></button>'
    + '<button class="og-fb-btn empty' + _fbActive('empty') + '" onclick="setOfficeFilterMode(\'empty\')" title="\u53EA\u770B\u7A7A\u7F3A">\u7A7A\u7F3A <span class="og-fb-n">' + empCount + '</span></button>'
    + '<button class="og-fb-btn filled' + _fbActive('filled') + '" onclick="setOfficeFilterMode(\'filled\')" title="\u53EA\u770B\u5728\u4EFB">\u5728\u4EFB <span class="og-fb-n">' + filCount + '</span></button>'
    + '<input id="office-search-input" class="og-fb-search" placeholder="\u641C \u59D3\u540D/\u5B98\u804C/\u7C4D\u8D2F/\u6D3E\u7CFB\u2026" value="' + escHtml(_kw2) + '" oninput="setOfficeSearchKw(this.value)"/>'
    + '<span style="display:inline-block;width:1px;height:16px;background:var(--color-border-subtle);margin:0 6px;"></span>'
    + '<button class="og-fb-btn' + _vmActive('list') + '" onclick="setOfficeViewMode(\'list\')" title="\u5217\u8868\u89C6\u56FE">\u5217 \u8868</button>'
    + '<button class="og-fb-btn' + _vmActive('tree') + '" onclick="setOfficeViewMode(\'tree\')" title="\u6811\u56FE\u89C6\u56FE">\u6811 \u56FE</button>'
    + (_dtText2 ? '<span class="og-fb-stats">' + escHtml(_dtText2) + (_scnName2 ? ' \u00B7 ' + escHtml(_scnName2) : '') + '</span>' : '')
    + '</div>';

  container.innerHTML =
    filterBar
    + _courtTabs
    + _subtabsHtml
    + '<div id="' + wrapperId + '" class="og-tree-frame" style="height:640px;border-top:none;border-radius:0 0 3px 3px;">'
    + '<div class="og-tree-hint">\u25C9 \u9F20 \u8F6E \u7F29 \u653E<span class="sep">\u00B7</span>\u957F \u6309 \u62D6 \u52A8<span class="sep">\u00B7</span>\u70B9 \u51FB \u5C55 \u5F00 \u8BE6 \u60C5</div>'
    + '<div class="og-tree-zoom-ctrl">'
    + '<button onclick="_offZoomIn()" title="\u653E\u5927">+</button>'
    + '<button onclick="_offZoomOut()" title="\u7F29\u5C0F">\u2212</button>'
    + '<button onclick="_offZoomReset()" title="\u590D\u4F4D">\u27F2</button>'
    + '<span class="og-zoom-label" id="og-zoom-label">\u2014</span>'
    + '</div>'
    + '<div id="' + canvasId + '" class="og-tree-canvas" style="width:' + cw + 'px;height:' + ch + 'px;">'
    + '<svg style="position:absolute;top:0;left:0;pointer-events:none;" width="' + cw + '" height="' + ch + '">' + svgLines + '</svg>'
    + wrapperBgs
    + nodesDivs
    + '</div></div>';

  // Zoom + pan + 自动居中
  (function() {
    var wrap = document.getElementById(wrapperId);
    var canvas = document.getElementById(canvasId);
    if (!wrap || !canvas) return;
    var scale, ox, oy;
    function autoFit() {
      var r = wrap.getBoundingClientRect();
      var marginW = 80, marginH = 50;
      var fitScale = Math.min(
        (r.width - marginW) / cw,
        (r.height - marginH) / ch
      );
      fitScale = Math.max(0.28, Math.min(1.1, fitScale));
      scale = fitScale;
      ox = (r.width - cw * fitScale) / 2;
      if (ch * fitScale < r.height - marginH) {
        oy = (r.height - ch * fitScale) / 2;
      } else {
        oy = 30;
      }
    }
    function applyT() {
      canvas.style.transform = 'translate('+ox+'px,'+oy+'px) scale('+scale+')';
      var lbl = document.getElementById('og-zoom-label');
      if (lbl) lbl.textContent = Math.round(scale*100) + '%';
    }
    autoFit(); applyT();

    // 暴露给 onclick 全局按钮使用
    window._offZoomIn = function(){ scale = Math.min(3, scale * 1.15); applyT(); };
    window._offZoomOut = function(){ scale = Math.max(0.15, scale * 0.87); applyT(); };
    window._offZoomReset = function(){ autoFit(); applyT(); };

    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var rect = wrap.getBoundingClientRect();
      var mx = e.clientX - rect.left, my2 = e.clientY - rect.top;
      var delta = e.deltaY > 0 ? 0.85 : 1.18;
      var ns = Math.max(0.18, Math.min(3, scale * delta));
      ox = mx - (mx - ox) * (ns / scale);
      oy = my2 - (my2 - oy) * (ns / scale);
      scale = ns; applyT();
    }, {passive: false});
    var drag = null;
    wrap.addEventListener('mousedown', function(e) {
      var t = e.target;
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (t.closest && t.closest('.og-pos-card, .og-dept-card, .og-v10-pos, .og-v10-dept, .og-node-group, .og-pe-undo, .og-v10-pending-undo, .og-tree-zoom-ctrl')) return;
      e.preventDefault();
      drag = {sx: e.clientX - ox, sy: e.clientY - oy};
      wrap.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', function(e) {
      if (!drag) return;
      ox = e.clientX - drag.sx; oy = e.clientY - drag.sy; applyT();
    });
    document.addEventListener('mouseup', function() { drag = null; if (wrap) wrap.style.cursor = 'grab'; });

    // 窗口 resize 防抖重新居中
    if (window._offResizeTimer) clearTimeout(window._offResizeTimer);
    if (window._offResizeHandler) window.removeEventListener('resize', window._offResizeHandler);
    window._offResizeHandler = function() {
      clearTimeout(window._offResizeTimer);
      window._offResizeTimer = setTimeout(function(){
        if (!document.getElementById(canvasId)) return;
        autoFit(); applyT();
      }, 180);
    };
    window.addEventListener('resize', window._offResizeHandler);
  })();

  // 全局键盘 / 聚焦搜索（仅在官制 tab 激活时）
  if (!window._offKeybindInstalled) {
    window._offKeybindInstalled = true;
    document.addEventListener('keydown', function(e){
      if (e.key !== '/') return;
      // 仅在官制面板可见时拦截·避免干扰其他输入
      var el = document.getElementById('office-tree');
      if (!el || !el.offsetParent) return;
      // 已聚焦输入框时不拦截
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      var inp = document.getElementById('office-search-input');
      if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
    });
  }
}

/** v10·部门卡（复刻 preview-guanzhi-v10.html·三行简洁布局） */
function _ogRenderDeptCardV10(fi, courtKey) {
  var nd = fi.node;
  var psCount = (nd.positions||[]).length;
  var vac = (nd.positions||[]).filter(function(p){ return !p.holder; }).length;
  var actual = psCount - vac;
  var seal = (nd.seal || (nd.name||'\u00B7').replace(/\s/g,'').slice(0,1));
  var themeCls = courtKey === 'inner' ? ' theme-inner' : (courtKey === 'region' ? ' theme-region' : '');
  var pathJSON = JSON.stringify(fi.path);
  var collapsed = !!fi.collapsed;
  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;';
  var toggleCall = 'GM._officeCollapsed[JSON.stringify(' + pathJSON + ')]=!GM._officeCollapsed[JSON.stringify(' + pathJSON + ')];renderOfficeTree();';

  var html = '<div class="og-v10-dept' + themeCls + '" style="' + style + '" ';
  html += 'onclick="if(event.target.closest(\'.og-v10-dept-collapse\'))return;' + toggleCall + '">';
  html += '<button class="og-v10-dept-collapse" onclick="event.stopPropagation();' + toggleCall + '" title="' + (collapsed?'\u5C55\u5F00':'\u6298\u53E0') + '">' + (collapsed?'\u25BC':'\u25B2') + '</button>';
  html += '<span class="og-v10-dept-seal">' + escHtml(seal) + '</span>';
  html += '<div class="og-v10-dept-name">' + escHtml(nd.name||'?') + '</div>';
  var desc = nd.description || nd.desc || '';
  if (desc) html += '<div class="og-v10-dept-desc">' + escHtml(desc) + '</div>';
  html += '<div class="og-v10-dept-meta">\u7F16<b>' + psCount + '</b>\u00B7\u5B9E<b>' + actual + '</b>';
  if (vac > 0) html += '\u00B7\u7F3A<b>' + vac + '</b> <span class="og-v10-dept-vac-pip"></span>';
  html += '</div>';
  html += '</div>';
  return html;
}

/** v10·职位卡（复刻 preview-guanzhi-v10.html·完整 12 态） */
function _ogRenderPosCardV10(fi, courtKey) {
  var nd = fi.node;
  if (typeof _offMigratePosition === 'function') _offMigratePosition(nd);
  var _holder = nd.holder ? findCharByName(nd.holder) : null;
  var _deptName = (fi.parent && fi.parent.node) ? (fi.parent.node.name||'') : '';
  var _rankLvl = typeof getRankLevel === 'function' ? getRankLevel(nd.rank) : 18;
  var _rankCls = _rankLvl <= 2 ? 'rank-top' : _rankLvl <= 6 ? 'rank-high' : _rankLvl <= 12 ? 'rank-mid' : 'rank-low';
  var _sealCls = _rankLvl <= 6 ? '' : (_rankLvl <= 12 ? 'mid-lvl' : 'low-lvl');

  // 态识别（参考旧版 _ogRenderPosCard 数据源）
  var _isVacant = !_holder;
  var _state = '';
  if (_isVacant) _state = 'vacant';
  else if (_holder._mourning) _state = 'mourning';
  else if (_holder._sickLeave) _state = 'sick';
  else if (_holder._actingPos) _state = 'acting';
  else if (_holder._demoted) _state = 'demoted';
  else if (_holder._retirePending) _state = 'retire';
  var _hasPending = nd._pendingEdict && nd._pendingEdict.turn === GM.turn;
  var _concurrentWith = _holder && _holder._concurrentWith;
  // 赴任态·识别新模型 _travelTo 与旧模型 _enRouteToOffice
  var _transitTo = _holder && (_holder._travelTo || _holder._enRouteToOffice);
  var _transitDays = _holder && (_holder._travelRemainingDays || _holder._enRouteDaysLeft || _holder._enRouteDays);
  var _transitFrom = _holder && (_holder._travelFrom || _holder._enRouteFrom || _holder.location);

  // 党派
  var _partyCls = '';
  if (_holder && _holder.party) {
    var p = String(_holder.party);
    if (/\u4E1C\u6797/.test(p)) _partyCls = 'dongin';
    else if (/\u6D59/.test(p)) _partyCls = 'zhe';
    else if (/\u9609|\u5BA6/.test(p)) _partyCls = 'yan';
    else if (/\u6E05\u6D41|\u5E03\u8863/.test(p)) _partyCls = 'qing';
    else if (/\u6606/.test(p)) _partyCls = 'kun';
  }
  var _partyLbl = { dongin:'\u4E1C', zhe:'\u6D59', yan:'\u9609', qing:'\u6E05', kun:'\u6606' }[_partyCls] || '';

  var cls = 'og-v10-pos ' + _rankCls;
  if (_state) cls += ' state-' + _state;
  if (_concurrentWith) cls += ' state-concurrent';
  if (_hasPending) cls += ' has-pending'; // 拟任态·边框+光晕

  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;';
  var _safePath = JSON.stringify(fi.path).replace(/"/g,'&quot;');
  var _safeDept = escHtml(_deptName).replace(/'/g,"\\'");
  var _safePos = escHtml(nd.name||'').replace(/'/g,"\\'");
  var _safeHolder = escHtml(nd.holder||'').replace(/'/g,"\\'");

  var html = '<div class="' + cls + '" style="' + style + '">';
  if (_partyCls) {
    html += '<div class="og-v10-party-ribbon ' + _partyCls + '"></div>';
    html += '<span class="og-v10-party-ribbon-label">' + _partyLbl + '</span>';
  }
  if (_state === 'vacant') html += '<span class="og-v10-vacant-dot"></span>';
  if (_state === 'mourning') html += '<span class="og-v10-mourn-badge">\u4E01 \u5FE7</span>';
  if (_concurrentWith) html += '<span class="og-v10-concurrent-stack">+\u517C</span>';
  if (_state === 'acting') html += '<span class="og-v10-acting-stamp">\u7F72</span>';
  if (_state === 'demoted') html += '<span class="og-v10-demoted-tag">\u8D2C \u8C2A</span>';
  // 拟任印章·右上角大字醒目
  if (_hasPending) html += '<span class="og-v10-draft-stamp">\u62DF</span>';

  // 头部
  html += '<div class="og-v10-pos-header">';
  html += '<div class="og-v10-pos-title-group">';
  html += '<div class="og-v10-pos-title">' + escHtml(nd.name||'?') + ' <span class="og-v10-rank-seal ' + _sealCls + '">' + escHtml(nd.rank||'') + '</span></div>';
  html += '<div class="og-v10-pos-sub">' + escHtml(_deptName) + (nd.duties ? ' \u00B7 ' + escHtml(String(nd.duties).slice(0, 24)) : '') + '</div>';
  html += '</div>';
  var btnLabel = '\u6539 \u6362', btnCls = '';
  if (_isVacant) { btnLabel = '\u4EFB \u547D'; btnCls = ' appoint'; }
  else if (_state === 'acting') btnLabel = '\u6B63 \u6388';
  else if (_state === 'mourning') { btnLabel = '\u6743 \u7F72'; btnCls = ' appoint'; }
  html += '<button class="og-v10-pos-btn' + btnCls + '" onclick="event.stopPropagation();_offOpenPicker(' + _safePath + ',\'' + _safeDept + '\',\'' + _safePos + '\',\'' + _safeHolder + '\')">' + btnLabel + '</button>';
  // 弹劾按钮：仅针对 NPC 派系 + 非玩家角色（异己党派或异势力高官）
  if (!_isVacant && _holder) {
    var _playerFacN = '';
    var _playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
    if (_playerFac) _playerFacN = _playerFac.name;
    if (!_playerFacN) _playerFacN = (P.playerInfo && P.playerInfo.factionName) || '';
    var _isForeign = _playerFacN && _holder.faction && _holder.faction !== _playerFacN;
    var _isHostile = _holder.loyalty != null && _holder.loyalty < 40;
    if (_isForeign || _isHostile) {
      html += '<button class="og-v10-pos-btn impeach" style="background:rgba(192,64,48,0.14);border-color:rgba(192,64,48,0.5);color:var(--vermillion-300,#d97b6b);margin-left:4px;" onclick="event.stopPropagation();_offImpeach(\'' + _safeHolder + '\',\'' + _safeDept + '\',\'' + _safePos + '\')" title="\u5F39\u52BE">\u5F39 \u52BE</button>';
    }
  }
  html += '</div>';

  if (_isVacant) {
    html += '<div class="og-v10-pos-holder"></div>';
    html += '<div class="og-v10-pos-meta" style="color:var(--vermillion-300,#d97b6b);justify-content:center;padding:10px 12px;"><span>\u6B64 \u804C \u65E0 \u4EBA</span></div>';
  } else {
    // 在任者行
    var initial = (nd.holder||'?').slice(0,1);
    var portraitCls = 'og-v10-pos-portrait' + ((_rankCls==='rank-top'||_rankCls==='rank-high')?' rank-top-border':'');
    var _tenureKey = _deptName + (nd.name||'');
    var _tenureVal = (_holder && _holder._tenure && _tenureKey) ? (_holder._tenure[_tenureKey]||0) : 0;
    html += '<div class="og-v10-pos-holder">';
    html += '<div class="' + portraitCls + '">' + escHtml(initial);
    if (_tenureVal > 0) html += '<span class="og-v10-tenure-ring">' + _tenureVal + '</span>';
    html += '</div>';
    html += '<div class="og-v10-pos-holder-info">';
    html += '<div class="og-v10-pos-holder-name' + (_hasPending ? ' draft-name' : '') + '">'
      + (_hasPending ? '<span class="og-v10-draft-prefix">\u62DF \u00B7 </span>' : '')
      + escHtml(nd.holder);
    if (_holder.courtesyName) html += '<span class="courtesy">' + escHtml(_holder.courtesyName) + '</span>';
    if (_holder.age) html += '<span class="age">\u00B7' + _holder.age + '\u5C81</span>';
    html += '</div>';
    var sub = '';
    if (_transitTo && _transitDays > 0) {
      sub = '<span style="color:var(--vermillion-300,#d97b6b);">' + escHtml(_transitFrom||'') + ' \u2192 ' + escHtml(_transitTo) + ' \u00B7 <b>' + _transitDays + '</b> \u65E5</span>';
    } else if (_holder.hometown) {
      sub = escHtml(_holder.hometown);
    }
    if (sub) html += '<div class="og-v10-pos-holder-sub">' + sub + '</div>';
    html += '</div>';
    var _loy = _holder.loyalty != null ? _holder.loyalty : 50;
    var _loyCls = _loy >= 75 ? 'loyal' : (_loy >= 55 ? 'mid' : 'danger');
    html += '<span class="og-v10-loyalty-mark ' + _loyCls + '">\u5FE0 ' + _loy + '</span>';
    html += '</div>';

    // 四维
    var _intel = _holder.intelligence != null ? _holder.intelligence : 50;
    var _admin = _holder.administration != null ? _holder.administration : 50;
    var _mil = _holder.military != null ? _holder.military : 50;
    html += '<div class="og-v10-pos-stats">';
    [['\u667A',_intel],['\u653F',_admin],['\u519B',_mil],['\u5FE0',_loy]].forEach(function(pair){
      var v = pair[1]||0;
      var sc = v>=80?'good':(v>=60?'warn':(v>=40?'':'bad'));
      var bc = v>=80?'bg-good':(v>=60?'bg-warn':(v>=40?'':'bg-bad'));
      html += '<div class="og-v10-stat-cell"><span class="og-v10-stat-lbl">' + pair[0] + '</span><span class="og-v10-stat-val ' + sc + '">' + v + '</span><div class="og-v10-stat-bar"><div class="' + bc + '" style="width:' + v + '%"></div></div></div>';
    });
    html += '</div>';

    // 任期+考评
    html += '<div class="og-v10-pos-meta">';
    if (_tenureVal > 0) html += '<span class="og-v10-tenure">\u4EFB <b>' + _tenureVal + '</b> \u56DE' + (_tenureVal>15?'\u00B7\u4E45\u7559':(_tenureVal<2?'\u00B7\u65B0\u4EFB':'')) + '</span>';
    else html += '<span></span>';
    var evals = (nd._evaluations||[]).slice(-3);
    if (evals.length) {
      html += '<span class="og-v10-evals">';
      evals.forEach(function(e){
        var lvl = typeof e === 'object' ? (e.grade||e.level||'mid') : String(e);
        var dc = /\u4F18|up|good|A/.test(lvl) ? 'up' : /\u52A3|down|bad|D|F/.test(lvl) ? 'dn' : 'mid';
        var lbl = dc==='up'?'\u4F18':(dc==='dn'?'\u52A3':'\u4E2D');
        html += '<span class="og-v10-eval-dot ' + dc + '">' + lbl + '</span>';
      });
      html += '</span>';
    }
    html += '</div>';

    // 态特定底条
    if (_concurrentWith) {
      html += '<div class="og-v10-concurrent-second"><span class="lbl">\u517C</span><span>' + escHtml(_concurrentWith) + '</span></div>';
    }
    if (_transitTo && _transitDays > 0) {
      html += '<div class="og-v10-transit-note"><span>\u8D74\u4EFB\u5728\u9014</span><span style="margin-left:auto;">\u8FD8\u9700 <b>' + _transitDays + '</b> \u65E5</span></div>';
    }
    if (_state === 'mourning' && _holder._mourning) {
      var mn = _holder._mourning.monthsLeft || _holder._mourning.left || 27;
      html += '<div style="padding:6px 12px;font-size:9px;color:rgba(217,208,187,0.7);letter-spacing:0.1em;text-align:center;font-style:italic;border-top:1px dashed rgba(217,208,187,0.2);">\u4F9D\u5236\u5B88\u5B5D\u00B7<b style="color:#d9d0bb;">' + mn + '</b>\u6708\u518D\u8D77</div>';
    }
    if (_state === 'sick' && _holder._sickLeave) {
      var days = _holder._sickLeave.daysLeft || _holder._sickLeave.days || _holder._sickLeave || 0;
      html += '<div class="og-v10-sick-banner"><span>\u2695</span><span class="lbl">\u544A \u75C5</span><span style="margin-left:auto;">\u672A\u671D <b>' + days + '</b> \u65E5</span></div>';
    }
    if (_state === 'acting' && _holder._actingPos) {
      html += '<div class="og-v10-acting-note">' + escHtml('\u4EE5 ' + (_holder._actingPos||'\u4F8D\u90CE') + ' \u6444\u4E8B\u00B7\u4EF0\u7B80\u62D4\u6B63\u5B98') + '</div>';
    }
    if (_state === 'retire' && _holder._retirePending) {
      var refusals = _holder._retirePending.refusals || 1;
      html += '<div class="og-v10-retire-note"><span>' + (_holder.age||70) + ' \u5C81\u00B7' + refusals + ' \u5EA6\u8BF7\u8F9E\u00B7\u965B\u4E0B\u672A\u5141</span></div>';
    }

    // 待下诏书
    if (_hasPending) {
      var _pe = nd._pendingEdict;
      var _peTxt = _pe.prevHolder ? ('\u6539 ' + escHtml(_pe.prevHolder) + ' \u2192 ' + escHtml(_pe.newHolder)) : ('\u4EFB ' + escHtml(_pe.newHolder));
      html += '<div class="og-v10-pending-strip">';
      html += '<span class="og-v10-pending-lbl">\u3014\u5F85\u4E0B\u8BCF\u4E66\u3015</span>';
      html += '<span class="og-v10-pending-txt">' + _peTxt + '</span>';
      html += '<button class="og-v10-pending-undo" onclick="event.stopPropagation();_offUndoAppointment(\'' + _safeDept + '\',\'' + _safePos + '\')">\u64A4 \u9500</button>';
      html += '</div>';
    }
  }

  html += '</div>';
  return html;
}

/** v10·皇帝卡片（简化·不与现有 dept/pos 卡重叠） */
function _ogRenderEmperorCard(fi) {
  var emp = (GM.chars||[]).find(function(c){ return c && c.isPlayer; }) || { name:'\u7687\u4E0A', age:null, title:'' };
  var reign = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : '';
  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;position:absolute;background:linear-gradient(135deg,rgba(201,168,95,0.18),rgba(140,80,20,0.1)),var(--color-surface-elevated,#2a241c);border:1.5px solid var(--gold-400);border-radius:3px;box-shadow:0 0 0 1px rgba(184,154,83,0.15),0 6px 30px rgba(0,0,0,0.6);padding:12px 16px;text-align:center;z-index:2;';
  var html = '<div class="og-emperor-card" style="' + style + '">';
  html += '<div style="position:absolute;inset:4px;border:1px dashed rgba(201,168,95,0.3);pointer-events:none;border-radius:2px;"></div>';
  html += '<div style="font-size:10px;letter-spacing:0.35em;color:var(--gold-400);margin-bottom:4px;">\u5929 \u547D \u6240 \u5F52</div>';
  html += '<div style="font-size:20px;font-weight:700;color:var(--gold-100,#f4e8c5);letter-spacing:0.3em;text-shadow:0 0 10px rgba(201,168,95,0.3);">' + escHtml(emp.name||'\u5E1D') + '</div>';
  if (reign) html += '<div style="font-size:10px;color:var(--txt-d);margin-top:3px;letter-spacing:0.2em;">' + escHtml(reign) + '</div>';
  html += '</div>';
  return html;
}

/** v10·群组横幅 */
function _ogRenderGroupBanner(fi, themeSuffix) {
  var g = fi.groupCfg;
  var pos = 0, vac = 0, deptCnt = fi.children.length;
  fi.children.forEach(function(d){
    (d.node.positions || []).forEach(function(p){
      pos++;
      if (!p.holder) vac++;
    });
  });
  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;';
  var html = '<div class="og-node-group' + (themeSuffix||'') + '" style="' + style + '">';
  html += '<span class="og-group-corner tl"></span><span class="og-group-corner tr"></span><span class="og-group-corner bl"></span><span class="og-group-corner br"></span>';
  html += '<div class="og-group-left">';
  html += '<div class="og-group-name">' + escHtml(g.name) + '</div>';
  html += '<div class="og-group-desc">' + escHtml(g.desc || '') + '</div>';
  html += '</div>';
  html += '<div class="og-group-stats">';
  html += '<span>\u8862 <span class="dept-count"><b>' + deptCnt + '</b></span></span>';
  html += '<span>\u7F16 <b>' + pos + '</b></span>';
  if (vac > 0) html += '<span class="vac">\u7F3A <b>' + vac + '</b></span>';
  html += '</div>';
  html += '</div>';
  return html;
}

/** v10·构造 court tab 按钮 */
function _buildCourtTab(key, eyebrow, title, cnt, currentCourt) {
  var cls = 'og-court-tab' + (key === currentCourt ? ' active' : '');
  return '<button class="' + cls + '" onclick="setOfficeCourtKey(\'' + key + '\')">'
    + '<span class="og-tab-eyebrow">' + eyebrow + '</span>'
    + '<span class="og-tab-title">' + title + '</span>'
    + '<span class="og-tab-stats">'
    + '<span><b>' + cnt.pos + '</b> \u804C</span>'
    + '<span><span class="og-vac-pip"></span><b>' + cnt.vac + '</b> \u7F3A</span>'
    + '</span>'
    + '</button>';
}

/** v10·统计某 subtab 的 pos/vac */
function _countSubtabPos(courtKey, subKey) {
  var r = { pos:0, vac:0 };
  if (!GM.officeTree) return r;
  GM.officeTree.forEach(function(d){
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    if (cls.court !== courtKey) return;
    if (subKey !== 'all' && cls.group !== subKey) return;
    (d.positions||[]).forEach(function(p){
      r.pos++;
      if (!p.holder) r.vac++;
    });
  });
  return r;
}

/** 部门效能摘要·v2 三栏 + 预警条 */
function _renderOfficeSummary() {
  var el = _$('office-summary'); if (!el) return;
  var treeStats = typeof _offTreeStats === 'function' ? _offTreeStats(GM.officeTree) : { headCount:0, actualCount:0, materialized:0, depts:0 };
  var totalDepts = treeStats.depts;
  var totalPos = treeStats.headCount;
  var actualCount = treeStats.actualCount;
  var materialized = treeStats.materialized;
  var vacantPos = totalPos - actualCount;
  var unmaterialized = actualCount - materialized;

  // 俸禄
  var theoryCost = 0, actualCost = 0;
  if (P.officeConfig && P.officeConfig.costVariables) {
    P.officeConfig.costVariables.forEach(function(cv) {
      theoryCost += (totalDepts * (cv.perDept||0)) + (totalPos * (cv.perOfficial||0));
      actualCost += (totalDepts * (cv.perDept||0)) + (actualCount * (cv.perOfficial||0));
    });
  }

  // 派系控制
  var factionMap = {};
  (function _fcs(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        if (p.holder) {
          var _fc = findCharByName(p.holder);
          var _k = _fc && (_fc.party || _fc.faction);
          if (_k && _k !== '\u671D\u5EF7') {
            if (!factionMap[_k]) factionMap[_k] = 0;
            factionMap[_k]++;
          }
        }
      });
      if (n.subs) _fcs(n.subs);
    });
  })(GM.officeTree||[]);
  var facEntries = Object.keys(factionMap).sort(function(a,b){ return factionMap[b] - factionMap[a]; });
  var _facColors = {};
  (GM.facs||[]).forEach(function(f) { if (f.color) _facColors[f.name] = f.color; });
  (GM.parties||[]).forEach(function(f) { if (f.color) _facColors[f.name] = f.color; });
  var _defaultFac = ['#6a9a7f','#5a6fa8','#c9a045','#8e6aa8','#b89a53','#d15c47','#5a8fb8'];
  var _totalFilled = facEntries.reduce(function(s,k){return s+factionMap[k];},0);

  // ───── 三栏摘要 ─────
  var html = '';

  // 卡1：编制·实有·具象·缺员
  html += '<div class="og-summary-card c-count">';
  html += '<div class="og-sc-label">\u7F16\u5236\u00B7\u5B9E\u6709\u00B7\u5177\u8C61</div>';
  html += '<div class="og-cnt-row">';
  html += '<div class="og-cnt-box"><div class="og-cnt-num good">' + totalDepts + '</div><div class="og-cnt-lbl">\u90E8\u95E8</div></div>';
  html += '<div class="og-cnt-box"><div class="og-cnt-num mid">' + totalPos + '</div><div class="og-cnt-lbl">\u7F16\u5236</div></div>';
  html += '<div class="og-cnt-box"><div class="og-cnt-num ' + (vacantPos===0?'good':'mid') + '">' + actualCount + '</div><div class="og-cnt-lbl">\u5B9E\u6709</div></div>';
  html += '<div class="og-cnt-box"><div class="og-cnt-num">' + materialized + '</div><div class="og-cnt-lbl">\u5177\u8C61</div></div>';
  if (vacantPos > 0) html += '<div class="og-cnt-box"><div class="og-cnt-num warn">' + vacantPos + '</div><div class="og-cnt-lbl">\u7F3A\u5458</div></div>';
  html += '</div>';
  html += '</div>';

  // 卡2：权力格局
  html += '<div class="og-summary-card c-power">';
  html += '<div class="og-sc-label">\u6743 \u529B \u683C \u5C40</div>';
  if (facEntries.length > 0) {
    html += '<div class="og-fac-bar">';
    facEntries.forEach(function(fk, i) {
      var pct = Math.round(factionMap[fk] / Math.max(1, _totalFilled + vacantPos) * 100);
      var clr = _facColors[fk] || _defaultFac[i % _defaultFac.length];
      html += '<div style="width:' + pct + '%;background:' + clr + ';" title="' + escHtml(fk) + ' ' + factionMap[fk] + '\u4EBA"></div>';
    });
    if (vacantPos > 0) {
      var vpct = Math.round(vacantPos / Math.max(1, _totalFilled + vacantPos) * 100);
      html += '<div style="width:' + vpct + '%;background:rgba(107,93,71,0.5);" title="\u7A7A\u7F3A ' + vacantPos + '\u4EBA"></div>';
    }
    html += '</div>';
    html += '<div class="og-fac-legend">';
    facEntries.forEach(function(fk, i) {
      var clr = _facColors[fk] || _defaultFac[i % _defaultFac.length];
      html += '<span class="og-fac-chip"><span class="sw" style="background:' + clr + ';"></span>' + escHtml(fk) + ' ' + factionMap[fk] + '</span>';
    });
    if (vacantPos > 0) {
      html += '<span class="og-fac-chip"><span class="sw" style="background:rgba(107,93,71,0.5);"></span>\u7A7A\u7F3A ' + vacantPos + '</span>';
    }
    html += '</div>';
  } else {
    html += '<div style="color:var(--ink-300);font-size:11px;font-style:italic;padding:4px 0;">\u672A\u52BF\u4E4B\u5C40\u00B7\u767E\u5B98\u5404\u5C45\u5176\u4F4D</div>';
  }
  html += '</div>';

  // 卡3：岁俸
  html += '<div class="og-summary-card c-cost">';
  html += '<div class="og-sc-label">\u5C81 \u4FF8 \u5F00 \u652F</div>';
  if (actualCost > 0 || theoryCost > 0) {
    html += '<div class="og-cost-main">' + (Math.round(actualCost)).toLocaleString() + ' <span class="unit">\u4E24/\u5C81</span></div>';
    if (theoryCost > actualCost) {
      html += '<div class="og-cost-theory">\u7F16\u5236\u5168\u5458\u5E94\u652F <span class="v">' + (Math.round(theoryCost)).toLocaleString() + ' \u4E24</span> \u00B7 \u5DEE\u989D ' + (Math.round(theoryCost - actualCost)).toLocaleString() + ' \u4E24\uFF08\u7CFB\u7F3A\u5458\u8282\u4F59\uFF09</div>';
    } else {
      html += '<div class="og-cost-theory">\u4F9D\u7F16\u5236\u8DB3\u989D\u652F\u7ED9</div>';
    }
  } else {
    html += '<div style="color:var(--ink-300);font-size:11px;font-style:italic;padding:4px 0;">\u672A\u914D\u7F6E\u4FF8\u7984\u89C4\u5219</div>';
  }
  html += '</div>';

  el.innerHTML = html;

  // ───── 预警条 ─────
  var alertEl = _$('office-alerts');
  if (alertEl) {
    var alerts = [];

    // 权臣预警：内阁首辅/六部尚书之一，所辖派系 >= 30% 且忠诚 < 60
    var _powerHolders = [];
    (function _scan(nodes){
      nodes.forEach(function(n){
        (n.positions||[]).forEach(function(p){
          if (!p.holder) return;
          var _rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
          if (_rl > 3) return;
          var _pc = findCharByName(p.holder);
          if (!_pc) return;
          var _pkey = _pc.party || _pc.faction;
          var _samePartyCnt = _pkey ? (factionMap[_pkey]||0) : 0;
          if (_samePartyCnt >= Math.max(4, _totalFilled * 0.25) && (_pc.loyalty||50) < 60) {
            _powerHolders.push({name: p.holder, pos: p.name, dept: n.name, partyCnt: _samePartyCnt, power: Math.round(((_pc.intelligence||50)+(_pc.administration||50))/2 + 20)});
          }
        });
        if (n.subs) _scan(n.subs);
      });
    })(GM.officeTree||[]);
    if (_powerHolders.length > 0) {
      _powerHolders.sort(function(a,b){return b.power - a.power;});
      var ph = _powerHolders[0];
      alerts.push({type:'danger', ic:'\u8B66', lbl:'\u6743\u81E3\u9884\u8B66\uFF1A', txt:escHtml(ph.name) + '\u00B7' + escHtml(ph.pos) + '\u00B7\u6240\u5C5E\u6D3E\u7CFB\u5C45<strong>' + ph.partyCnt + '</strong>\u804C\u00B7\u5B9E\u6743\u6307\u6570<strong>' + ph.power + '</strong>\u00B7\u6050\u6709\u4E13\u6743\u4E4B\u865E'});
    }

    // 职位空缺
    if (vacantPos > 0) {
      var _vacNames = [];
      (function _vscan(nodes){
        nodes.forEach(function(n){
          (n.positions||[]).forEach(function(p){
            if (!p.holder && _vacNames.length < 5) _vacNames.push(escHtml(n.name||'') + '\u00B7' + escHtml(p.name||''));
          });
          if (n.subs) _vscan(n.subs);
        });
      })(GM.officeTree||[]);
      alerts.push({type:'warn', ic:'\u7F3A', lbl:'\u804C\u4F4D\u7A7A\u7F3A\uFF1A', txt:_vacNames.join('\u3001') + (vacantPos > 5 ? '\u7B49 ' : '\u00B7') + '\u5171 <strong>' + vacantPos + '</strong> \u804C\u5F85\u8865'});
    }

    // 未具象
    if (unmaterialized > 0) {
      alerts.push({type:'info', ic:'\u8865', lbl:'\u5177\u8C61\u5316\uFF1A', txt:'\u5C1A\u6709 <strong>' + unmaterialized + '</strong> \u804C\u4E3A\u540D\u5B57\u5360\u4F4D\u00B7\u9700\u4ECE\u6709\u53F8\u9012\u8865\u5177\u4F53\u4EBA\u7269'});
    }

    if (alerts.length > 0) {
      alertEl.innerHTML = alerts.map(function(a){
        var cls = a.type === 'warn' ? ' warn' : a.type === 'info' ? ' info' : '';
        return '<div class="og-alert' + cls + '"><div class="ic">' + a.ic + '</div><div><span class="lbl">' + a.lbl + '</span><span class="txt">' + a.txt + '</span></div></div>';
      }).join('');
    } else {
      alertEl.innerHTML = '';
    }
  }
}

/** 荐贤——显示候选人列表，选择后写入诏令建议库 */
/** 高品级职位（从三品以上）触发廷推流程 */
function _offRecommend(pathArr, deptName, posName) {
  var pos = getOffNode(pathArr);
  if (!pos) return;
  // 检查品级——高品级触发廷推
  var _rl = typeof getRankLevel === 'function' ? getRankLevel(pos.rank) : 99;
  if (_rl <= 6) {
    _offTingTui(pathArr, deptName, posName, pos);
    return;
  }
  var capital = GM._capital || '京城';
  // 候选人：按职能匹配排序
  var candidates = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer; });
  // 能力匹配分数
  var _dutyText = (pos.desc||'') + (pos.duties||'') + deptName;
  var _isMilitary = /兵|军|卫|武|都督|将/.test(_dutyText);
  var _isAdmin = /吏|铨|考|礼|户|度支|工|刑/.test(_dutyText);
  candidates.forEach(function(c) {
    var score = 0;
    if (_isMilitary) score += (c.military||50) * 2 + (c.valor||50);
    else if (_isAdmin) score += (c.administration||50) * 2 + (c.intelligence||50);
    else score += (c.intelligence||50) + (c.administration||50) + (c.diplomacy||50);
    // 忠诚加分
    score += (c.loyalty||50) * 0.5;
    // 已有官职减分（避免兼任过多）
    if (c.officialTitle) score -= 20;
    // 品级匹配（简单：有品级的职位优先有品级经验的人）
    if (pos.rank && c._tenure) score += Object.keys(c._tenure).length * 5;
    // 回避标注
    c._avoidance = '';
    if (c.location && c.location !== capital && c.location === deptName) c._avoidance = '\u672C\u7C4D\u56DE\u907F';
    c._hasRecommender = c._recommendedBy || '';
    c._recommendScore = score;
  });
  candidates.sort(function(a,b) { return (b._recommendScore||0) - (a._recommendScore||0); });
  // 铨曹推荐（吏部主官的推荐偏向本派系）
  var _quanOfficer = null;
  if (typeof findOfficeByFunction === 'function') {
    var _q = findOfficeByFunction('铨') || findOfficeByFunction('吏') || findOfficeByFunction('选');
    if (_q && _q.holder) _quanOfficer = findCharByName(_q.holder);
  }
  // 弹窗
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var inner = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:500px;max-height:80vh;overflow-y:auto;">';
  inner += '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.1em;">\u8350\u8D24\u2014\u2014' + escHtml(deptName) + escHtml(posName) + '</div>';
  if (_quanOfficer) {
    inner += '<div style="font-size:0.7rem;color:var(--gold-400);margin-bottom:var(--space-2);">\u94E8\u66F9\u63A8\u8350\uFF08' + escHtml(_quanOfficer.name) + '\uFF09\uFF1A</div>';
  }
  if (pos.rank) inner += '<div style="font-size:0.65rem;color:var(--ink-300);margin-bottom:var(--space-2);">\u54C1\u7EA7\u8981\u6C42\uFF1A' + escHtml(pos.rank) + '</div>';
  var top10 = candidates.slice(0, 10);
  top10.forEach(function(c, ci) {
    var isFaction = _quanOfficer && _quanOfficer.faction && c.faction === _quanOfficer.faction;
    var borderClr = isFaction ? 'var(--gold-500)' : 'var(--color-border-subtle)';
    inner += '<div style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + borderClr + ';border-radius:var(--radius-sm);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="_offSelectCandidate(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
    inner += '<div>';
    inner += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>';
    if (c.title) inner += '<span style="font-size:0.65rem;color:var(--ink-300);margin-left:4px;">' + escHtml(c.title) + '</span>';
    if (isFaction) inner += '<span style="font-size:0.6rem;color:var(--gold-400);margin-left:4px;">[\u94E8\u66F9\u8350]</span>';
    if (c._avoidance) inner += '<span style="font-size:0.6rem;color:var(--vermillion-400);margin-left:4px;">[' + c._avoidance + ']</span>';
    inner += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">\u667A' + (c.intelligence||50) + ' \u653F' + (c.administration||50) + ' \u519B' + (c.military||50) + ' \5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</div>';
    inner += '</div>';
    inner += '<span style="font-size:0.7rem;color:var(--gold-400);">' + Math.round(c._recommendScore||0) + '\u5206</span>';
    inner += '</div>';
  });
  // 搜索筛选栏
  inner += '<div style="margin-top:var(--space-2);display:flex;gap:var(--space-1);margin-bottom:var(--space-1);">';
  inner += '<input id="_off-rec-search" placeholder="\u641C\u7D22\u59D3\u540D/\u5B98\u804C\u2026" style="flex:1;padding:2px 6px;font-size:0.7rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:inherit;" oninput="_offFilterCandidates(this.value)">';
  inner += '<select id="_off-rec-filter" style="font-size:0.7rem;padding:2px 4px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:var(--radius-sm);" onchange="_offFilterCandidates(_$(\'_off-rec-search\').value)">';
  inner += '<option value="all">\u5168\u90E8</option><option value="civil">\u6587\u5B98\u4F18\u5148</option><option value="military">\u6B66\u5B98\u4F18\u5148</option><option value="loyal">\u5FE0\u8BDA\u4F18\u5148</option><option value="vacant">\u65E0\u5B98\u804C</option></select>';
  inner += '</div>';
  inner += '<div id="_off-rec-list">';
  top10.forEach(function(c, ci) {
    var isFaction = _quanOfficer && _quanOfficer.faction && c.faction === _quanOfficer.faction;
    var borderClr = isFaction ? 'var(--gold-500)' : 'var(--color-border-subtle)';
    inner += '<div class="_off-rec-item" data-name="' + escHtml(c.name) + '" data-title="' + escHtml(c.title||'') + '" data-admin="' + (c.administration||50) + '" data-mil="' + (c.military||50) + '" data-loy="' + (c.loyalty||50) + '" data-hasoffice="' + (c.officialTitle?'1':'0') + '" style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + borderClr + ';border-radius:var(--radius-sm);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="_offSelectCandidate(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
    inner += '<div>';
    inner += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>';
    if (c.title) inner += '<span style="font-size:0.65rem;color:var(--ink-300);margin-left:4px;">' + escHtml(c.title) + '</span>';
    if (isFaction) inner += '<span style="font-size:0.6rem;color:var(--gold-400);margin-left:4px;">[\u94E8\u66F9\u8350]</span>';
    if (c._avoidance) inner += '<span style="font-size:0.6rem;color:var(--vermillion-400);margin-left:4px;">[' + c._avoidance + ']</span>';
    inner += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">\u667A' + (c.intelligence||50) + ' \u653F' + (c.administration||50) + ' \u519B' + (c.military||50) + ' \5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</div>';
    inner += '</div>';
    inner += '<span style="font-size:0.7rem;color:var(--gold-400);">' + Math.round(c._recommendScore||0) + '\u5206</span>';
    inner += '</div>';
  });
  inner += '</div>';
  inner += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button></div>';
  inner += '</div>';
  bg.innerHTML = inner;
  document.body.appendChild(bg);
}

/** 候选人搜索过滤 */
function _offFilterCandidates(keyword) {
  var items = document.querySelectorAll('._off-rec-item');
  var filterType = (_$('_off-rec-filter')||{}).value || 'all';
  var kw = (keyword||'').toLowerCase();
  items.forEach(function(el) {
    var name = (el.getAttribute('data-name')||'').toLowerCase();
    var title = (el.getAttribute('data-title')||'').toLowerCase();
    var matchKw = !kw || name.indexOf(kw) >= 0 || title.indexOf(kw) >= 0;
    var matchFilter = true;
    if (filterType === 'civil') matchFilter = parseInt(el.getAttribute('data-admin')||'50') >= 60;
    else if (filterType === 'military') matchFilter = parseInt(el.getAttribute('data-mil')||'50') >= 60;
    else if (filterType === 'loyal') matchFilter = parseInt(el.getAttribute('data-loy')||'50') >= 70;
    else if (filterType === 'vacant') matchFilter = el.getAttribute('data-hasoffice') === '0';
    el.style.display = (matchKw && matchFilter) ? '' : 'none';
  });
}

/** 有司自动递补（不具象——只增actualCount） */
function _offAutoFill(deptName, posName) {
  var _found = false;
  (function _f(ns) {
    ns.forEach(function(n) {
      // 在所有层级搜索部门名
      if (n.name === deptName) {
        (n.positions||[]).forEach(function(p) {
          if (p.name === posName && !_found) {
            if (typeof _offMigratePosition === 'function') _offMigratePosition(p);
            if ((p.actualCount||0) < (p.headCount||1)) {
              p.actualCount = (p.actualCount||0) + 1;
              _found = true;
              toast(deptName + posName + '有司递补1人（未具象）');
              if (typeof renderOfficeTree === 'function') renderOfficeTree();
            } else { toast('此职已满编'); }
          }
        });
      }
      if (n.subs) _f(n.subs);
    });
  })(GM.officeTree||[]);
}

/** 选择候选人→写入诏令建议库 */
function _offSelectCandidate(charName, deptName, posName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '官制', from: '铨曹',
    content: '任命' + charName + '为' + deptName + posName,
    turn: GM.turn, used: false
  });
  toast('已录入诏书建议库——请在诏令中正式下旨');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/* ══════════════════════════════════════════════════════════════════
   统一任命/改换选任器（v2）
   · 列出全部本势力活人物
   · 按匹配度+派系+忠诚综合排序
   · 搜索 + 过滤(全部/文官/武官/忠诚/无官职/本派系/同籍贯)
   · 选中 → 录入诏书建议库（替换时写"免旧+任新"两条）
   ══════════════════════════════════════════════════════════════════ */
var _OFF_PICKER = null;

function _offOpenPicker(pathArr, deptName, posName, currentHolder) {
  var pos = getOffNode(pathArr) || { name: posName, desc: '', duties: '', rank: '' };
  var capital = GM._capital || '京城';
  var dutyText = (pos.desc||'') + (pos.duties||'') + deptName + posName;
  var isMilitary = /兵|军|卫|武|都督|将|都指挥|总兵|参将/.test(dutyText);
  var isAdmin = /吏|铨|考|礼|户|度支|工|刑|御史/.test(dutyText);
  var isClose = /学士|侍读|侍讲|翰林|中书|舍人/.test(dutyText);

  // 职位需求推导（match% 基准）
  var rankLvl = typeof getRankLevel === 'function' ? getRankLevel(pos.rank) : 10;
  var loyNeeded = rankLvl <= 3 ? 75 : rankLvl <= 6 ? 60 : 45;
  var req;
  if (isMilitary) req = { primary:'military', secondary:'valor', label:'武官\u00B7\u519B\u4E8B\u4E3A\u4E3B', loyNeeded:loyNeeded };
  else if (isClose) req = { primary:'intelligence', secondary:'diplomacy', label:'\u8FD1\u4F8D\u00B7\u5B66\u8BC6+\u8FA9\u624D', loyNeeded:loyNeeded };
  else if (isAdmin) req = { primary:'administration', secondary:'intelligence', label:'\u6587\u5B98\u00B7\u653F\u52A1\u4E3A\u4E3B', loyNeeded:loyNeeded };
  else req = { primary:'administration', secondary:'intelligence', label:'\u7EFC\u5408\u804C\u4F4D', loyNeeded:loyNeeded };
  var statLabel = { administration:'\u653F\u52A1', military:'\u519B\u4E8B', intelligence:'\u667A\u529B', valor:'\u6B66\u52C7', diplomacy:'\u8FA9\u624D' };
  req.primaryLabel = statLabel[req.primary] || req.primary;
  req.secondaryLabel = statLabel[req.secondary] || req.secondary;

  // 玩家所在势力领袖·多重兜底：GM.facs.isPlayer → P.playerInfo.factionName → GM.playerFaction
  var playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var playerFacName = playerFac ? playerFac.name : '';
  if (!playerFacName) {
    playerFacName = (P.playerInfo && P.playerInfo.factionName) || GM.playerFaction || '';
  }
  var playerParty = playerFac && playerFac.leaderParty ? playerFac.leaderParty : '';

  // 候选池：活人·非玩家·非已在此职；派系过滤仅在玩家有明确势力时生效（中立/无派系角色始终可用）
  var cands = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    if (c.name === currentHolder) return false; // 现任不是候选
    // 派系锁：仅当玩家有明确势力且角色也有明确且不匹配的派系时才排除
    // 中立角色（c.faction 空）一律允许；玩家无明确势力时不做派系过滤
    if (playerFacName && c.faction && c.faction !== playerFacName) return false;
    return true;
  });

  // 打分 + 胜任度百分比
  cands.forEach(function(c) {
    // 原综合 score（用于默认排序一致）
    var score = 0;
    if (isMilitary) score += (c.military||50) * 2 + (c.valor||50);
    else if (isAdmin) score += (c.administration||50) * 2 + (c.intelligence||50);
    else if (isClose) score += (c.intelligence||50) * 2 + (c.diplomacy||50);
    else score += (c.intelligence||50) + (c.administration||50) + (c.diplomacy||50);
    score += (c.loyalty||50) * 0.6;
    if (c.officialTitle) score -= 15;
    if (c.location && c.location !== capital) score -= 10;
    if (pos.rank && c._tenure) score += Math.min(30, Object.keys(c._tenure).length * 4);
    c._pickerScore = score;

    // 胜任度 0-100·主属性 60%·次属性 25%·忠诚 15%
    var primaryVal = c[req.primary] || 50;
    var secondaryVal = c[req.secondary] || 50;
    var loyVal = c.loyalty || 50;
    var loyComponent = loyVal >= req.loyNeeded ? 100 : Math.round((loyVal / req.loyNeeded) * 100);
    var match = Math.round(primaryVal * 0.6 + secondaryVal * 0.25 + loyComponent * 0.15);
    c._pickerMatch = Math.max(0, Math.min(100, match));

    // 赴任天数（外地才算·粗估 20 日保底·实际以 AI 推演为准）
    c._pickerTravelDays = 0;
    if (c.location && c.location !== capital) c._pickerTravelDays = 20;

    // 分类标签
    c._pickerTags = [];
    if (!c.officialTitle) c._pickerTags.push('vacant');
    if ((c.administration||50) >= 65) c._pickerTags.push('civil');
    if ((c.military||50) >= 65) c._pickerTags.push('military');
    if ((c.loyalty||50) >= 75) c._pickerTags.push('loyal');
    if (c.location && c.location !== capital) c._pickerTags.push('remote');

    // 警示标志
    c._pickerWarnings = [];
    if (loyVal < req.loyNeeded) c._pickerWarnings.push('\u5FE0\u8BDA\u4E0D\u8DB3');
    if (c.age && c.age >= 65) c._pickerWarnings.push('\u5E74\u8FC8');
    if (c.age && c.age < 20) c._pickerWarnings.push('\u5E74\u5E7C');
  });
  // 主排序：胜任度 desc；次排序：忠诚 desc
  cands.sort(function(a,b){
    var m = (b._pickerMatch||0) - (a._pickerMatch||0);
    if (m !== 0) return m;
    return (b.loyalty||50) - (a.loyalty||50);
  });
  // 标记冠亚季
  if (cands.length > 0) cands[0]._pickerRank = 1;
  if (cands.length > 1) cands[1]._pickerRank = 2;
  if (cands.length > 2) cands[2]._pickerRank = 3;

  _OFF_PICKER = { pathArr: pathArr, deptName: deptName, posName: posName, currentHolder: currentHolder, cands: cands, pos: pos, filter: 'all', kw: '', req: req };

  // 建 modal
  var existing = document.getElementById('off-picker-modal');
  if (existing) existing.remove();
  var bg = document.createElement('div');
  bg.id = 'off-picker-modal';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  bg.onclick = function(e) { if (e.target === bg) _offClosePicker(); };

  var modeLbl = currentHolder ? '改换' : '任命';
  var modeClr = currentHolder ? 'var(--amber-400)' : 'var(--gold-400)';

  var html = ''
    + '<div style="background:var(--color-surface);border:1px solid ' + modeClr + ';border-radius:var(--radius-lg);width:min(680px,94vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);overflow:hidden;">'
    // 标题栏
    +   '<div style="padding:0.9rem 1.2rem 0.7rem;border-bottom:1px solid var(--color-border-subtle);background:linear-gradient(180deg,rgba(184,154,83,0.04),transparent);">'
    +     '<div style="display:flex;justify-content:space-between;align-items:baseline;">'
    +       '<div>'
    +         '<div style="font-size:0.72rem;color:var(--ink-300);letter-spacing:0.2em;">\u3014 \u9078 \u4EFB \u3015</div>'
    +         '<div style="font-size:1.05rem;font-weight:700;color:' + modeClr + ';margin-top:3px;">' + modeLbl + escHtml(deptName) + '\u00B7' + escHtml(posName)
    +           (pos.rank ? '<span style="font-size:0.7rem;font-weight:400;color:var(--ink-300);margin-left:6px;">' + escHtml(pos.rank) + '</span>' : '')
    +         '</div>'
    +       '</div>'
    +       '<button class="bt bs bsm" onclick="_offClosePicker()" aria-label="\u5173\u95ED">\u2715</button>'
    +     '</div>'
    +     (pos.desc ? '<div style="font-size:0.74rem;color:var(--ink-300);margin-top:4px;line-height:1.5;">' + escHtml(pos.desc) + '</div>' : '')
    +     '<div style="margin-top:6px;padding:5px 10px;background:rgba(107,176,124,0.06);border-left:3px solid var(--celadon-400);border-radius:2px;font-size:0.72rem;color:var(--ink-300);">'
    +       '<span style="color:var(--celadon-400);font-weight:600;letter-spacing:0.1em;">\u3014 \u6B64 \u804C \u6240 \u6C42 \u3015</span> '
    +       escHtml(req.label) + ' \u00B7 '
    +       '\u4E3B\u8981' + escHtml(req.primaryLabel) + ' \u00B7 '
    +       '\u8F85\u4EE5' + escHtml(req.secondaryLabel) + ' \u00B7 '
    +       '\u5FE0\u8BDA\u2265<strong style="color:var(--gold-400);">' + req.loyNeeded + '</strong>'
    +     '</div>'
    +     (currentHolder ? '<div class="off-pk-replacing">\u2192 \u73B0\u4EFB\uFF1A<b>' + escHtml(currentHolder) + '</b>\uFF08\u9009\u4EFB\u540E\u5C06\u81EA\u52A8\u51FB\u514D\u65E7\u4EFB\u00B7\u8D77\u7528\u65B0\u4EBA\uFF09</div>' : '')
    +   '</div>'
    // 过滤栏（chip 带计数）
    +   '<div style="padding:0.5rem 1rem;border-bottom:1px solid var(--color-border-subtle);display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">'
    +     '<input id="off-picker-search" placeholder="\u641C\u59D3\u540D/\u5B98\u804C/\u7C4D\u8D2F\u2026" style="flex:1;min-width:160px;padding:5px 10px;font-size:0.8rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);" oninput="_offPickerFilter()"/>'
    +     _offPickerFilterChip('all', '\u5168\u90E8', cands.length)
    +     _offPickerFilterChip('civil', '\u6587\u5B98', _offCountTag(cands, 'civil'))
    +     _offPickerFilterChip('military', '\u6B66\u5B98', _offCountTag(cands, 'military'))
    +     _offPickerFilterChip('loyal', '\u5FE0\u8BDA', _offCountTag(cands, 'loyal'))
    +     _offPickerFilterChip('vacant', '\u5E03\u8863', _offCountTag(cands, 'vacant'))
    +   '</div>'
    // 列表容器
    +   '<div id="off-picker-list" style="flex:1;overflow-y:auto;padding:0.5rem 0.8rem;"></div>'
    // 底部·含键盘提示
    +   '<div class="off-pk-footer">'
    +     '<span id="off-picker-count">\u5171 <b style="color:var(--gold-300);">' + cands.length + '</b> \u4EBA\u53EF\u9009 \u00B7 \u6309<b>\u80DC\u4EFB\u5EA6</b>\u964D\u5E8F</span>'
    +     '<span class="off-pk-kbd">'
    +       '<span><kbd>\u2191</kbd><kbd>\u2193</kbd> \u9009\u4EBA</span>'
    +       '<span><kbd>\u23CE</kbd> \u786E\u8BA4</span>'
    +       '<span><kbd>/</kbd> \u641C\u7D22</span>'
    +       '<span><kbd>Esc</kbd> \u53D6\u6D88</span>'
    +     '</span>'
    +   '</div>'
    + '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);
  _offRenderPickerList();
  var _ipt = document.getElementById('off-picker-search');
  if (_ipt) setTimeout(function(){ _ipt.focus(); }, 50);
}

function _offPickerFilterChip(key, label, count) {
  var st = _OFF_PICKER && _OFF_PICKER.filter === key;
  var bg = st ? 'var(--gold-400)' : 'var(--color-elevated)';
  var clr = st ? 'var(--color-bg)' : 'var(--color-foreground-muted)';
  var bd = st ? 'var(--gold-400)' : 'var(--color-border)';
  var cnt = (typeof count === 'number') ? '<span class="off-pk-chip-count">' + count + '</span>' : '';
  return '<button onclick="_offPickerSetFilter(\'' + key + '\')" style="font-size:0.72rem;padding:3px 10px;background:' + bg + ';border:1px solid ' + bd + ';border-radius:999px;color:' + clr + ';cursor:pointer;display:inline-flex;align-items:center;gap:4px;">' + label + cnt + '</button>';
}

// 统计候选人在某 tag/类别下的数量
function _offCountTag(cands, key) {
  if (!cands || !cands.length) return 0;
  if (key === 'all') return cands.length;
  if (key === 'vacant') return cands.filter(function(c){ return !c.officialTitle; }).length;
  return cands.filter(function(c){ return (c._pickerTags||[]).indexOf(key) >= 0; }).length;
}

// 候选人四维 mini-bar 三件组
function _offStatsMiniHtml(c, f1) {
  f1 = f1 || function(v){ return Math.round(v); };
  function _cls(v){ return v >= 75 ? 'hi' : v >= 50 ? 'mid' : 'lo'; }
  function _row(lbl, v) {
    var cls = _cls(v);
    return '<div class="off-pk-stat-mini"><span class="lbl">' + lbl + '</span><span class="val ' + cls + '">' + f1(v) + '</span><div class="bar"><div class="fill-' + cls + '" style="width:' + Math.min(100, v) + '%;"></div></div></div>';
  }
  return '<div class="off-pk-stats-mini">'
    + _row('\u667A', c.intelligence || 50)
    + _row('\u653F', c.administration || 50)
    + _row('\u519B', c.military || 50)
    + _row('\u5FE0', c.loyalty || 50)
    + '</div>';
}

function _offPickerSetFilter(key) {
  if (!_OFF_PICKER) return;
  _OFF_PICKER.filter = key;
  // 重渲过滤栏
  var modal = document.getElementById('off-picker-modal');
  if (modal) {
    var chips = modal.querySelectorAll('button[onclick^="_offPickerSetFilter"]');
    chips.forEach(function(c){
      var k = (c.getAttribute('onclick')||'').match(/'([^']+)'/);
      if (k && k[1]) {
        var isSel = k[1] === key;
        c.style.background = isSel ? 'var(--gold-400)' : 'var(--color-elevated)';
        c.style.color = isSel ? 'var(--color-bg)' : 'var(--color-foreground-muted)';
        c.style.borderColor = isSel ? 'var(--gold-400)' : 'var(--color-border)';
      }
    });
  }
  _offRenderPickerList();
}

function _offPickerFilter() {
  if (!_OFF_PICKER) return;
  var inp = document.getElementById('off-picker-search');
  _OFF_PICKER.kw = inp ? (inp.value || '').trim().toLowerCase() : '';
  _offRenderPickerList();
}

function _offRenderPickerList() {
  var root = document.getElementById('off-picker-list');
  if (!root || !_OFF_PICKER) return;
  var kw = _OFF_PICKER.kw || '';
  var filter = _OFF_PICKER.filter || 'all';
  var list = _OFF_PICKER.cands.filter(function(c) {
    if (kw) {
      var hay = (c.name + (c.officialTitle||'') + (c.title||'') + (c.hometown||'') + (c.faction||'')).toLowerCase();
      if (hay.indexOf(kw) < 0) return false;
    }
    if (filter === 'all') return true;
    if (filter === 'vacant') return !c.officialTitle;
    return (c._pickerTags || []).indexOf(filter) >= 0;
  });

  var cnt = document.getElementById('off-picker-count');
  if (cnt) cnt.textContent = '\u7B5B\u9009\u51FA ' + list.length + ' / ' + _OFF_PICKER.cands.length + ' \u4EBA';

  if (list.length === 0) {
    var _totalCands = (_OFF_PICKER && _OFF_PICKER.cands) ? _OFF_PICKER.cands.length : 0;
    if (_totalCands === 0) {
      // 候选池全空——完全无可任用之人·提供征召入口
      root.innerHTML = ''
        + '<div style="text-align:center;padding:2.4rem 1rem;">'
        +   '<div style="font-size:1.6rem;color:var(--ink-400);margin-bottom:0.3rem;">\u5C3D</div>'
        +   '<div style="font-size:0.86rem;color:var(--ink-300);letter-spacing:0.15em;margin-bottom:0.2rem;">\u65E0\u53EF\u4EFB\u7528\u4E4B\u4EBA</div>'
        +   '<div style="font-size:0.72rem;color:var(--ink-400);line-height:1.7;margin-bottom:1rem;max-width:360px;margin-left:auto;margin-right:auto;">'
        +     '\u5E9C\u5E93\u4EBA\u624D\u65B9\u4E1A\u4E4F\u7ED9\uFF0C\u7329\u529B\u5FE0\u8BDA\u4E4B\u58EB\u96BE\u8FC5\u5C31\u9644\u3002<br>\u53EF\u4E0B\u8BCF\u5FB4\u53EC\u65B0\u4EBA\uFF0C\u53D7\u547D\u4E4B\u540E\u518D\u884C\u6388\u804C\u3002'
        +   '</div>'
        +   '<button onclick="_offRecruitNewForPost()" class="bt" style="padding:8px 20px;background:linear-gradient(180deg,rgba(184,154,83,0.25),rgba(184,154,83,0.1));border:1px solid var(--gold-400);color:var(--gold-300);font-size:0.82rem;letter-spacing:0.15em;border-radius:var(--radius-sm);cursor:pointer;">\u2767 \u4E0B\u8BCF\u5FB4\u53EC \u2767</button>'
        +   '<div style="font-size:0.66rem;color:var(--ink-400);margin-top:0.6rem;">AI \u5C06\u6839\u636E\u6B64\u804C\u9700\u6C42\u751F\u6210\u5019\u9009\u4EBA\u7269</div>'
        + '</div>';
    } else {
      // 筛选后空·但池非空——提示调整过滤
      root.innerHTML = ''
        + '<div style="text-align:center;color:var(--ink-300);padding:3rem 1rem;font-size:0.82rem;">'
        +   '\u65E0\u5339\u914D\u7ED3\u679C<br>'
        +   '<span style="font-size:0.72rem;color:var(--ink-400);">\u5171 ' + _totalCands + ' \u4EBA\u53EF\u9009\u00B7\u8BF7\u8C03\u6574\u641C\u7D22\u6216\u8FC7\u6EE4</span>'
        + '</div>';
    }
    return;
  }

  var h = '';
  var top = list.slice(0, 50); // 最多50条·防止性能问题
  top.forEach(function(c) {
    h += _offPickerRowHtml(c);
  });
  if (list.length > 50) {
    h += '<div style="text-align:center;color:var(--ink-300);padding:0.5rem;font-size:0.72rem;">\u2026\u8FD8\u6709 ' + (list.length - 50) + ' \u4EBA\u00B7\u8BF7\u7F29\u5C0F\u641C\u7D22\u8303\u56F4</div>';
  }
  root.innerHTML = h;
}

function _offPickerRowHtml(c) {
  var f1 = (typeof _fmtNum1 === 'function') ? _fmtNum1 : function(v){ return v; };
  var loyClr = (c.loyalty||50) >= 70 ? 'var(--celadon-400)' : (c.loyalty||50) < 40 ? 'var(--vermillion-400)' : 'var(--gold-400)';
  var match = c._pickerMatch || 0;
  var matchClr = match >= 80 ? 'var(--celadon-400)' : match >= 60 ? 'var(--gold-400)' : match >= 40 ? 'var(--amber-400,#c9a045)' : 'var(--vermillion-400)';
  var matchLbl = match >= 80 ? '\u5353\u7EDD' : match >= 60 ? '\u80DC\u4EFB' : match >= 40 ? '\u52C9\u5F3A' : '\u4E0D\u80DC';
  var nameSafe = escHtml(c.name).replace(/'/g,"\\'");
  var deptSafe = escHtml(_OFF_PICKER.deptName||'').replace(/'/g,"\\'");
  var posSafe = escHtml(_OFF_PICKER.posName||'').replace(/'/g,"\\'");
  var oldSafe = escHtml(_OFF_PICKER.currentHolder||'').replace(/'/g,"\\'");

  // 冠亚季徽标
  var medal = '';
  var medalBg = '';
  var recommendRibbon = '';
  if (c._pickerRank === 1) {
    medal = '<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:linear-gradient(135deg,#c9a045,#d4b45a);color:#1a1510;font-size:11px;font-weight:700;border-radius:50%;box-shadow:0 0 8px rgba(201,168,95,0.5);margin-right:6px;">\u51A0</span>';
    medalBg = 'linear-gradient(to right,rgba(201,168,95,0.08),transparent 60%)';
    recommendRibbon = '<span class="off-pk-recommend-ribbon">\u9996 \u8350</span>';
  }
  else if (c._pickerRank === 2) { medal = '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;background:linear-gradient(135deg,#8c8c8c,#b0b0b0);color:#1a1510;font-size:10px;font-weight:700;border-radius:50%;margin-right:6px;">\u4E9A</span>'; medalBg = 'linear-gradient(to right,rgba(160,160,160,0.06),transparent 60%)'; }
  else if (c._pickerRank === 3) { medal = '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;background:linear-gradient(135deg,#8b5a2b,#a67440);color:#1a1510;font-size:10px;font-weight:700;border-radius:50%;margin-right:6px;">\u5B63</span>'; medalBg = 'linear-gradient(to right,rgba(139,90,43,0.05),transparent 60%)'; }

  // 四象雷达·智政军忠 → 上右下左·范围 0-100 映射到 radius 0-28（中心 40,40）
  var _rInt = Math.max(0, Math.min(100, c.intelligence||50));
  var _rAdm = Math.max(0, Math.min(100, c.administration||50));
  var _rMil = Math.max(0, Math.min(100, c.military||50));
  var _rLoy = Math.max(0, Math.min(100, c.loyalty||50));
  var _rR = 28; // max radius
  var _radarShape = (match >= 80) ? '' : (match >= 40) ? 'mid' : 'bad';
  // 点：上(智) 右(军) 下(政) 左(忠)
  var _px1 = 40, _py1 = 40 - _rR * (_rInt/100);
  var _px2 = 40 + _rR * (_rMil/100), _py2 = 40;
  var _px3 = 40, _py3 = 40 + _rR * (_rAdm/100);
  var _px4 = 40 - _rR * (_rLoy/100), _py4 = 40;
  var _radarSvg = '<svg class="off-pk-radar" viewBox="0 0 80 80" aria-hidden="true">'
    + '<polygon class="grid" points="40,12 68,40 40,68 12,40"/>'
    + '<polygon class="grid" points="40,22 58,40 40,58 22,40"/>'
    + '<line class="axis" x1="40" y1="12" x2="40" y2="68"/>'
    + '<line class="axis" x1="12" y1="40" x2="68" y2="40"/>'
    + '<polygon class="shape ' + _radarShape + '" points="' + _px1 + ',' + _py1 + ' ' + _px2 + ',' + _py2 + ' ' + _px3 + ',' + _py3 + ' ' + _px4 + ',' + _py4 + '"/>'
    + '<text class="axis-lbl" x="40" y="9" text-anchor="middle">\u667A</text>'
    + '<text class="axis-lbl" x="74" y="44" text-anchor="middle">\u519B</text>'
    + '<text class="axis-lbl" x="40" y="77" text-anchor="middle">\u653F</text>'
    + '<text class="axis-lbl" x="6" y="44" text-anchor="middle">\u5FE0</text>'
    + '</svg>';

  var tags = [];
  if (c.officialTitle) tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(184,154,83,0.12);color:var(--gold-400);">\u73B0\u4EFB ' + escHtml(c.officialTitle) + '</span>');
  else tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(121,175,135,0.12);color:var(--celadon-400);">\u5E03\u8863</span>');
  if (c.location && c.location !== (GM._capital||'京城')) {
    var _td = c._pickerTravelDays > 0 ? ('\u00B7\u8D74\u4EFB ' + c._pickerTravelDays + ' \u65E5') : '';
    tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(192,64,48,0.1);color:var(--vermillion-400);">\u5728 ' + escHtml(c.location) + _td + '</span>');
  }
  if (c.party && c.party !== '\u65E0\u515A') tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(107,93,79,0.2);color:var(--ink-300);">' + escHtml(c.party) + '</span>');
  if (c.hometown) tags.push('<span style="font-size:0.68rem;color:var(--ink-300);">\u7C4D\uFF1A' + escHtml(c.hometown) + '</span>');
  // 警示标签
  (c._pickerWarnings||[]).forEach(function(w){
    tags.push('<span style="font-size:0.68rem;padding:1px 6px;border-radius:3px;background:rgba(192,64,48,0.18);color:var(--vermillion-400);border:1px solid rgba(192,64,48,0.35);">\u26A0 ' + escHtml(w) + '</span>');
  });

  return ''
    + '<div style="position:relative;padding:10px 12px;margin-bottom:6px;background:' + (medalBg || 'var(--color-elevated)') + ',var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:6px;cursor:pointer;transition:all 0.12s ease;" '
    +   'onmouseover="this.style.borderColor=\'var(--gold-400)\';this.style.transform=\'translateX(2px)\';" '
    +   'onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.transform=\'translateX(0)\';" '
    +   'onclick="_offPickerConfirmPre(\'' + nameSafe + '\',\'' + deptSafe + '\',\'' + posSafe + '\',\'' + oldSafe + '\')">'
    +   recommendRibbon
    +   '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.8rem;">'
    +     '<div style="flex:1;min-width:0;">'
    +       '<div style="display:flex;align-items:baseline;gap:0.4rem;margin-bottom:4px;">'
    +         medal
    +         '<span style="font-size:1rem;font-weight:700;color:var(--color-foreground);">' + escHtml(c.name) + '</span>'
    +         (c.title ? '<span style="font-size:0.74rem;color:var(--ink-300);">' + escHtml(c.title) + '</span>' : '')
    +         (c.age ? '<span style="font-size:0.7rem;color:var(--ink-300);">\u00B7' + c.age + '\u5C81</span>' : '')
    +       '</div>'
    +       '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">' + tags.join('') + '</div>'
    +       _offStatsMiniHtml(c, f1)
    +     '</div>'
    +     _radarSvg
    +     '<div style="flex-shrink:0;text-align:center;min-width:72px;">'
    +       '<div style="font-size:1.5rem;font-weight:700;color:' + matchClr + ';line-height:1;">' + match + '<span style="font-size:0.7rem;opacity:0.7;">%</span></div>'
    +       '<div style="margin-top:3px;height:4px;background:rgba(107,93,79,0.15);border-radius:2px;overflow:hidden;">'
    +         '<div style="height:100%;width:' + match + '%;background:' + matchClr + ';transition:width 0.3s;"></div>'
    +       '</div>'
    +       '<div style="font-size:0.64rem;color:' + matchClr + ';letter-spacing:0.1em;margin-top:3px;">' + matchLbl + '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';
}

// 幂等锁·防止重复点击导致双重任命
var _OFF_APPOINT_LOCKS = {};

// 预检：检测候选人是否已有主官职·若有则弹"辞旧/兼任/取消"三选一
function _offPickerConfirmPre(charName, deptName, posName, oldHolder) {
  // 幂等锁
  var lockKey = charName + '@' + deptName + '|' + posName + '@t' + (GM.turn||0);
  var now = Date.now();
  if (_OFF_APPOINT_LOCKS[lockKey] && (now - _OFF_APPOINT_LOCKS[lockKey]) < 1500) {
    if (typeof toast === 'function') toast('\u521A\u64CD\u4F5C\u8FC7\u00B7\u8BF7\u52FF\u8FDE\u70B9');
    return;
  }
  _OFF_APPOINT_LOCKS[lockKey] = now;

  var newChar = (GM.chars || []).find(function(c){ return c.name === charName; });
  if (!newChar) { _offPickerConfirm(charName, deptName, posName, oldHolder, 'resign'); return; }
  var existingPost = newChar.officialTitle || '';
  // 若现任即目标职位·视为冗余·直接走老路径
  if (!existingPost || existingPost === posName) {
    _offPickerConfirm(charName, deptName, posName, oldHolder, 'resign');
    return;
  }

  // 弹二次确认 modal
  var bg = document.createElement('div');
  bg.id = 'off-concurrent-modal';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  bg.onclick = function(e){ if (e.target === bg) bg.remove(); };
  var _nameS = escHtml(charName).replace(/'/g,"\\'");
  var _deptS = escHtml(deptName).replace(/'/g,"\\'");
  var _posS = escHtml(posName).replace(/'/g,"\\'");
  var _oldS = escHtml(oldHolder||'').replace(/'/g,"\\'");
  bg.innerHTML = ''
    + '<div style="background:var(--color-surface);border:1px solid var(--amber-400);border-radius:var(--radius-lg);padding:1.2rem 1.4rem;width:min(440px,92vw);">'
    +   '<div style="font-size:0.74rem;color:var(--ink-300);letter-spacing:0.2em;margin-bottom:0.3rem;">\u3014 \u4E00 \u8EAB \u4E24 \u804C \u3015</div>'
    +   '<div style="font-size:0.96rem;font-weight:700;color:var(--color-foreground);margin-bottom:0.3rem;">' + escHtml(charName) + ' \u73B0\u4EFB <span style="color:var(--gold-400);">' + escHtml(existingPost) + '</span></div>'
    +   '<div style="font-size:0.78rem;color:var(--ink-300);line-height:1.7;margin-bottom:0.8rem;">'
    +     '\u65B0\u6388\uFF1A<b style="color:var(--celadon-400);">' + escHtml(deptName) + '\u00B7' + escHtml(posName) + '</b><br>'
    +     '\u8BF7\u6BBF\u4E0B\u660E\u65A8\uFF1A'
    +   '</div>'
    +   '<div style="display:flex;flex-direction:column;gap:0.4rem;">'
    +     '<button class="bt" style="padding:8px 12px;text-align:left;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);" '
    +         'onclick="this.closest(\'div[style*=fixed]\').remove();_offPickerConfirm(\'' + _nameS + '\',\'' + _deptS + '\',\'' + _posS + '\',\'' + _oldS + '\',\'resign\')">'
    +       '<div style="font-size:0.84rem;font-weight:700;color:var(--gold-400);">\u8F9E\u65E7\u5C31\u65B0</div>'
    +       '<div style="font-size:0.7rem;color:var(--ink-300);margin-top:2px;">\u5151\u53BB\u539F\u804C <b>' + escHtml(existingPost) + '</b>\u00B7\u5168\u529B\u8D74\u4EFB\u65B0\u804C</div>'
    +     '</button>'
    +     '<button class="bt" style="padding:8px 12px;text-align:left;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);" '
    +         'onclick="this.closest(\'div[style*=fixed]\').remove();_offPickerConfirm(\'' + _nameS + '\',\'' + _deptS + '\',\'' + _posS + '\',\'' + _oldS + '\',\'concurrent\')">'
    +       '<div style="font-size:0.84rem;font-weight:700;color:var(--celadon-400);">\u517C\u4EFB\u4E24\u804C</div>'
    +       '<div style="font-size:0.7rem;color:var(--ink-300);margin-top:2px;">\u539F\u804C\u4F9D\u65E7\u00B7\u65B0\u804C\u517C\u7BA1\u00B7\u4EE3\u4EF7\uFF1A\u7CBE\u529B\u5206\u6563\u00B7\u6548\u7387\u6253\u6298</div>'
    +     '</button>'
    +     '<button class="bt" style="padding:6px 12px;text-align:center;background:transparent;border:1px solid var(--color-border-subtle);color:var(--ink-300);" '
    +         'onclick="this.closest(\'div[style*=fixed]\').remove();">'
    +       '\u64A4\u56DE\u6210\u547D'
    +     '</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bg);
}

function _offPickerConfirm(charName, deptName, posName, oldHolder, mode) {
  // mode: 'resign'(默认·辞旧就新) | 'concurrent'(兼任)
  mode = mode || 'resign';
  // ═══ 三位一体·即时生效·回合内可撤销 ═══
  // 1. 直接改 officeTree holder（UI 立即刷新）
  // 2. 同步更新 char.officialTitle + careerHistory + 官职公库 currentHead
  // 3. 自动 append 到 edict-pol textarea（交 AI 本回合推演·会引发叙事+后续影响）
  // 4. 同时记入 edictSuggestions 供参考
  // 5. 往位置对象写 _pendingEdict 快照·供回合内撤销使用
  var newChar = (GM.chars || []).find(function(c){ return c.name === charName; });
  var oldChar = oldHolder ? (GM.chars || []).find(function(c){ return c.name === oldHolder; }) : null;

  // 兼任模式·先记录 newChar 原有主职·供 _pendingEdict 快照
  var _snapPrevMainTitle = '';
  if (newChar) _snapPrevMainTitle = newChar.officialTitle || '';
  // 辞旧模式·若 newChar 已有主职且不是此职·级联清其原 holder 登记
  // 并存快照·供撤销时把原职还给他
  var _snapResignVacated = [];
  if (mode === 'resign' && newChar && newChar.officialTitle && newChar.officialTitle !== posName) {
    // 先扫一遍·找 newChar 在其他位置的 holder·存快照
    (function _scanResign(nodes) {
      (nodes||[]).forEach(function(n) {
        if (!n) return;
        (n.positions||[]).forEach(function(p) {
          if (!p) return;
          if (p.holder === charName && !(p.name === posName && n.name === deptName)) {
            _snapResignVacated.push({
              dept: n.name, pos: p.name, holder: charName,
              holderSinceTurn: p.holderSinceTurn || 0,
              pubHead: (p.publicTreasury && p.publicTreasury.currentHead) || null
            });
          }
        });
        if (n.subs) _scanResign(n.subs);
      });
    })(GM.officeTree||[]);
    if (typeof _offVacateByCharName === 'function') {
      try { _offVacateByCharName(charName, 'resign-for-new'); } catch(_){}
    }
  }
  var _seatDone = false;
  var _posRef = null; // 保存被修改的 position 引用·供末尾挂 _pendingEdict
  var _snapPrevPubHead = undefined;

  // Step 1: officeTree 直接查找并改 holder·用 _offAppointPerson 助手确保 actualHolders 同步
  // 避免 _offMigratePosition 下次调用时把 holder 从 actualHolders 重建回原值
  function _applyHolder(nodes) {
    if (_seatDone) return;
    (nodes || []).forEach(function(n) {
      if (_seatDone || !n) return;
      if (n.name === deptName) {
        (n.positions || []).forEach(function(p) {
          if (_seatDone || !p) return;
          if (p.name === posName) {
            _snapPrevPubHead = (p.publicTreasury && p.publicTreasury.currentHead) || undefined;
            // 先把旧任从 actualHolders 剥除（若有）
            if (oldHolder && typeof _offDismissPerson === 'function') {
              try { _offDismissPerson(p, oldHolder); } catch(_){}
            }
            // 再把新任推入 actualHolders 并同步 holder 字段
            if (typeof _offAppointPerson === 'function') {
              try { _offAppointPerson(p, charName); } catch(_){}
            } else {
              p.holder = charName;
            }
            if (p.publicTreasury) p.publicTreasury.currentHead = charName;
            if (!p._history) p._history = [];
            p._history.push({ holder: oldHolder || '(空)', endTurn: GM.turn, reason: '玩家诏令改任' });
            _posRef = p;
            _seatDone = true;
          }
        });
      }
      if (!_seatDone && n.subs) _applyHolder(n.subs);
    });
  }
  _applyHolder(GM.officeTree || []);

  // Step 2: 更新 char 字段
  if (newChar) {
    if (mode === 'concurrent' && _snapPrevMainTitle && _snapPrevMainTitle !== posName) {
      // 兼任·原主职保留·新职入 concurrentTitles
      if (!Array.isArray(newChar.concurrentTitles)) newChar.concurrentTitles = [];
      if (newChar.concurrentTitles.indexOf(posName) < 0) newChar.concurrentTitles.push(posName);
    } else {
      // 辞旧就新·正常改主职
      newChar.officialTitle = posName;
      newChar.position = posName;
      // 若原是兼任名单中的一员·从 concurrentTitles 移除
      if (Array.isArray(newChar.concurrentTitles)) {
        var _ci = newChar.concurrentTitles.indexOf(posName);
        if (_ci >= 0) newChar.concurrentTitles.splice(_ci, 1);
      }
    }
    if (!newChar.careerHistory) newChar.careerHistory = [];
    newChar.careerHistory.push({ turn: GM.turn, event: (mode==='concurrent' ? '奉诏加兼 ' : '奉诏就任 ') + deptName + posName });
    if (!newChar._memorySeeds) newChar._memorySeeds = [];
    newChar._memorySeeds.push({ turn: GM.turn, event: '蒙陛下简拔·授' + deptName + posName + (mode==='concurrent'?'（兼）':''), emotion: '敬感' });
    // 好感 +5·被委以重任
    if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      AffinityMap.add(charName, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', 5, '被委以重任');
    }
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(charName, '蒙简擢为 ' + deptName + posName, '\u559C', 7, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B');
    }
  }
  if (oldChar) {
    if (oldChar.officialTitle === posName) oldChar.officialTitle = '';
    if (oldChar.position === posName) oldChar.position = '';
    oldChar._displaced = { from: posName, by: charName, turn: GM.turn };
    if (!oldChar.careerHistory) oldChar.careerHistory = [];
    oldChar.careerHistory.push({ turn: GM.turn, event: '奉诏免 ' + deptName + posName + '·由 ' + charName + ' 代' });
    if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      AffinityMap.add(oldHolder, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', -10, '被免职');
    }
  }

  // Step 3: append 到 edict-pol textarea·AI 会在本回合推演看到
  var _actionVerb = (mode === 'concurrent') ? '加兼' : '为';
  var edictLine = oldHolder
    ? ('命 ' + charName + ' ' + _actionVerb + ' ' + deptName + posName + '·原任 ' + oldHolder + ' 着免。')
    : (mode === 'concurrent' && _snapPrevMainTitle
        ? ('命 ' + charName + ' 以 ' + _snapPrevMainTitle + ' 加兼 ' + deptName + posName + '。')
        : ('命 ' + charName + ' 为 ' + deptName + posName + '。'));
  var polEl = document.getElementById('edict-pol');
  if (polEl) {
    var cur = (polEl.value || '').trim();
    polEl.value = cur ? (cur + '\n' + edictLine) : edictLine;
  }

  // Step 4: 建议库记录（供参考）
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '\u5B98\u5236·\u4EFB\u547D\u6309\u94AE', from: '\u94E8\u66F9',
    content: edictLine, turn: GM.turn, used: true
  });

  // Step 4b·【旅程启动】若新任所在地非京师·发起赴任行程+编年+起居注
  // 不改 char.location（保持原处·由 advanceCharTravelByDays 抵达时更新）
  // holder 立即设上（UI 即时反映任命意图）·但显示为 "赴任在途"
  if (newChar && mode !== 'concurrent') {
    var _capitalTravel = GM._capital || '京师';
    // 推断目的地：地方职位如 XX巡抚·XX总兵·XX总督·使用职名中的地名；中央职位用首都
    var _travelDestination = _capitalTravel;
    var _regionalMatch = (deptName + posName).match(/([\u4e00-\u9fa5]{2,4})(?:巡抚|总兵|总督|布政使|按察使|经略|节度)/);
    if (_regionalMatch && _regionalMatch[1]) {
      _travelDestination = _regionalMatch[1];
    }
    if (newChar.location && newChar.location !== _travelDestination) {
      var _trvDays = 20;
      try {
        if (typeof calcLetterDays === 'function') {
          _trvDays = calcLetterDays(newChar.location, _travelDestination, 'normal') || 20;
        }
      } catch(_){}
      var _dpvT = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
      var _arrivalTurn = GM.turn + Math.max(1, Math.ceil(_trvDays / _dpvT));
      newChar._travelFrom = newChar.location;
      newChar._travelTo = _travelDestination;
      newChar._travelStartTurn = GM.turn;
      newChar._travelRemainingDays = _trvDays;
      newChar._travelArrival = _arrivalTurn;
      newChar._travelReason = '奉诏赴任 ' + deptName + posName;
      newChar._travelAssignPost = deptName + '/' + posName;

      // 编年·启程条
      if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
      GM._chronicle.unshift({
        turn: GM.turn,
        date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
        type: '赴任启程',
        title: charName + ' 赴 ' + _travelDestination,
        content: charName + ' 自' + newChar.location + ' 启程赴' + _travelDestination + '·奉诏就任 ' + deptName + posName + '·预计 ' + _trvDays + ' 日（约 ' + Math.max(1, Math.ceil(_trvDays / _dpvT)) + ' 回合）抵任。',
        category: '人事',
        tags: ['人事', '赴任', '启程', charName]
      });

      // 起居注·启程条
      if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
      GM.qijuHistory.unshift({
        turn: GM.turn,
        date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
        content: '【启程】' + charName + ' 自' + newChar.location + ' 赴 ' + _travelDestination + '·就任 ' + deptName + posName + '·预计 ' + _trvDays + ' 日'
      });

      // 报话筒
      if (typeof addEB === 'function') {
        try { addEB('人事', charName + ' 奉诏赴' + _travelDestination + '·预计 ' + _trvDays + ' 日抵任'); } catch(_){}
      }
    }
  }

  // Step 5: edictTracker 记入本回合诏令（确保 AI prompt 能看到）·跨回合去重·防止重复任命累积
  if (!GM._edictTracker) GM._edictTracker = [];
  var _trackerId = null;
  var _dupT = (GM._edictTracker||[]).some(function(t) {
    if (!t || t.content !== edictLine) return false;
    return t.status === 'pending' || t.status === 'executing' || t.status === 'partial' || t.status === 'obstructed' || t.status === 'pending_delivery';
  });
  if (!_dupT) {
    _trackerId = 'appoint_' + Date.now() + '_' + charName;
    GM._edictTracker.push({
      id: _trackerId,
      content: edictLine, category: '政令',
      turn: GM.turn, status: 'pending',
      assignee: charName, feedback: '',
      progressPercent: 0,
      _appointmentAction: { character: charName, position: posName, dept: deptName, oldHolder: oldHolder },
      _chainEffects: []  // 后续回合连带效应记录
    });
  }

  // Step 6: 位置挂 _pendingEdict·供「待下诏书」条展示 + 回合内撤销
  if (_posRef) {
    _posRef._pendingEdict = {
      turn: GM.turn,
      prevHolder: oldHolder || '',
      newHolder: charName,
      deptName: deptName,
      posName: posName,
      edictLine: edictLine,
      trackerId: _trackerId,
      mode: mode,
      _snapPrevMainTitle: _snapPrevMainTitle,
      _snapPrevPubHead: _snapPrevPubHead,
      _snapResignVacated: _snapResignVacated, // 辞旧模式·被清空的原职快照·供撤销复原
      _snapNewCharCareerPushed: !!newChar,
      _snapNewCharSeedPushed: !!newChar,
      _snapOldCharCareerPushed: !!oldChar,
      _snapOldCharDisplacedSet: !!oldChar,
      _snapAppliedAffinity: true,
      ts: Date.now()
    };
  }

  var _modeLabel = (mode === 'concurrent') ? '兼任' : (oldHolder ? '改换' : '任命');
  toast(_modeLabel + '\u00B7' + (oldHolder ? (oldHolder + '→' + charName) : charName) + (_dupT ? ' 已即时生效（同内容诏令已在跟踪）' : ' 已即时生效并写入本回合诏令'));
  _offClosePicker();
  if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
  if (typeof renderRenwu === 'function') { try { renderRenwu(); } catch(_){} }
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

function _offClosePicker() {
  _OFF_PICKER = null;
  var m = document.getElementById('off-picker-modal');
  if (m) m.remove();
}

// 空候选池·下诏征召新人（调 aiGenerateCompleteCharacter）
function _offRecruitNewForPost() {
  if (!_OFF_PICKER) return;
  var deptName = _OFF_PICKER.deptName || '';
  var posName = _OFF_PICKER.posName || '';
  var pos = _OFF_PICKER.pos || {};
  // 简单的姓名输入 modal
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1250;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  bg.onclick = function(e){ if (e.target === bg) bg.remove(); };
  bg.innerHTML = ''
    + '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;width:min(420px,92vw);">'
    +   '<div style="font-size:0.76rem;color:var(--ink-300);letter-spacing:0.2em;margin-bottom:0.3rem;">\u3014 \u5FB4 \u53EC \u3015</div>'
    +   '<div style="font-size:0.96rem;font-weight:700;color:var(--gold-400);margin-bottom:0.2rem;">' + escHtml(deptName) + '\u00B7' + escHtml(posName) + '</div>'
    +   (pos.rank ? '<div style="font-size:0.72rem;color:var(--ink-300);margin-bottom:0.6rem;">\u54C1\u7EA7\uFF1A' + escHtml(pos.rank) + '</div>' : '<div style="margin-bottom:0.6rem;"></div>')
    +   '<label style="display:block;font-size:0.72rem;color:var(--ink-300);margin-bottom:0.2rem;">\u53EC\u964D\u4E4B\u4EBA\u59D3\u540D</label>'
    +   '<input id="recruit-name-input" type="text" placeholder="\u4F8B\uFF1A\u8881\u5D07\u7115\u00B7\u6216\u7559\u7A7A\u8BA9 AI \u81EA\u751F" maxlength="20" '
    +     'style="width:100%;padding:6px 10px;font-size:0.88rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);margin-bottom:0.3rem;"/>'
    +   '<div style="font-size:0.66rem;color:var(--ink-400);line-height:1.5;margin-bottom:0.8rem;">\u00B7 \u8F93\u5165\u5386\u53F2\u540D\u81E3\u5C06 AI \u751F\u6210\u5B9E\u5386\u5B66\u5BD8\u00B7 \u7559\u7A7A\u5219 AI \u81EA\u62DF\u540D</div>'
    +   '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">'
    +     '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    +     '<button class="bt bsm" style="background:var(--gold-500);color:#1a1510;border-color:var(--gold-500);" onclick="_offRecruitSubmit()">\u4E0B \u8BCF</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bg);
  setTimeout(function(){ var _i = document.getElementById('recruit-name-input'); if (_i) _i.focus(); }, 60);
}

function _offRecruitSubmit() {
  if (!_OFF_PICKER) return;
  var inp = document.getElementById('recruit-name-input');
  var name = (inp && inp.value || '').trim();
  var deptName = _OFF_PICKER.deptName || '';
  var posName = _OFF_PICKER.posName || '';
  var _rmBg = inp && inp.closest('div[style*=fixed]');
  if (_rmBg) _rmBg.remove();

  if (!name) {
    // 让 AI 自拟一个合适人选名·基于职位推
    if (typeof toast === 'function') toast('\u8BF7\u8F93\u5165\u59D3\u540D\u6216\u5148\u5173\u95ED\u518D\u8BD5\u00B7\u672A\u6765\u652F\u6301 AI \u81EA\u62DF');
    return;
  }
  if (typeof edictRecruitCharacter !== 'function') {
    if (typeof toast === 'function') toast('\u5FB4\u53EC\u6A21\u5757\u672A\u52A0\u8F7D');
    return;
  }

  if (typeof toast === 'function') toast('\u6B63\u5728\u5FB4\u53EC ' + name + '\u2026AI \u751F\u6210\u4E2D');
  var _capName = name;
  Promise.resolve().then(function(){
    return edictRecruitCharacter(_capName, deptName + posName, '\u56E0 ' + deptName + posName + ' \u7F3A\u5458\u8D2B\u8352\u00B7\u7279\u4E0B\u8BCF\u5FB4\u53EC');
  }).then(function(ch){
    if (!ch) {
      if (typeof toast === 'function') toast('\u5FB4\u53EC\u5931\u8D25\u00B7\u8BF7\u91CD\u8BD5');
      return;
    }
    // 生成成功·重开 picker（新人已在候选池中）
    if (typeof toast === 'function') toast(_capName + ' \u5E94\u8BCF\u800C\u81F3\u00B7\u8BF7\u9009\u4EFB');
    var _path = _OFF_PICKER.pathArr;
    var _dept = _OFF_PICKER.deptName;
    var _pos = _OFF_PICKER.posName;
    var _cur = _OFF_PICKER.currentHolder;
    _offClosePicker();
    setTimeout(function(){ _offOpenPicker(_path, _dept, _pos, _cur); }, 50);
  }).catch(function(err){
    console.error('[_offRecruitSubmit] err:', err);
    if (typeof toast === 'function') toast('\u5FB4\u53EC\u51FA\u9519\u00B7' + (err && err.message || ''));
  });
}

// 弹劾·生成"请弹劾 X"诏令交 AI 推演判定
function _offImpeach(charName, deptName, posName) {
  if (!charName) return;
  var ch = findCharByName(charName);
  if (!ch) { toast('\u672A\u627E\u5230\u6B64\u4EBA'); return; }
  var loy = ch.loyalty != null ? ch.loyalty : 50;
  var adm = ch.administration || 50;

  // 确认 modal
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1280;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  bg.onclick = function(e){ if (e.target === bg) bg.remove(); };
  var _sN = escHtml(charName).replace(/'/g,"\\'");
  var _sD = escHtml(deptName).replace(/'/g,"\\'");
  var _sP = escHtml(posName).replace(/'/g,"\\'");
  // 预估成功率·简化公式：低忠诚+低政事=易倒；高敌意(faction mismatch)额外加成
  var _playerFac2 = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var _playerFacN2 = _playerFac2 ? _playerFac2.name : ((P.playerInfo && P.playerInfo.factionName) || '');
  var _isForeign2 = _playerFacN2 && ch.faction && ch.faction !== _playerFacN2;
  var _baseSucc = Math.max(10, Math.min(85, 100 - loy - Math.floor(adm/3)));
  if (_isForeign2) _baseSucc += 15;
  _baseSucc = Math.max(10, Math.min(90, _baseSucc));
  var _succClr = _baseSucc >= 60 ? 'var(--celadon-400)' : _baseSucc >= 35 ? 'var(--gold-400)' : 'var(--vermillion-400)';
  var _succLbl = _baseSucc >= 60 ? '\u6613\u4E0B' : _baseSucc >= 35 ? '\u53EF\u8BD5' : '\u5197\u56FE';

  bg.innerHTML = ''
    + '<div style="background:var(--color-surface);border:1px solid var(--vermillion-400);border-radius:var(--radius-lg);padding:1.2rem 1.4rem;width:min(460px,92vw);">'
    +   '<div style="font-size:0.76rem;color:var(--vermillion-300);letter-spacing:0.2em;margin-bottom:0.3rem;">\u3014 \u5F39 \u52BE \u3015</div>'
    +   '<div style="font-size:1rem;font-weight:700;color:var(--color-foreground);margin-bottom:0.2rem;">\u6B32\u5F39\u52BE <span style="color:var(--vermillion-400);">' + escHtml(charName) + '</span></div>'
    +   '<div style="font-size:0.74rem;color:var(--ink-300);margin-bottom:0.7rem;">' + escHtml(deptName) + '\u00B7' + escHtml(posName) + '</div>'
    +   '<div style="padding:0.6rem 0.8rem;background:rgba(192,64,48,0.06);border-left:3px solid var(--vermillion-400);border-radius:2px;margin-bottom:0.6rem;">'
    +     '<div style="font-size:0.72rem;color:var(--ink-300);line-height:1.7;">'
    +       '\u5FE0\uFF1A<b style="color:' + (loy<40?'var(--vermillion-400)':loy<60?'var(--gold-400)':'var(--celadon-400)') + ';">' + loy + '</b>\u00B7'
    +       '\u653F\uFF1A<b>' + adm + '</b>\u00B7'
    +       (_isForeign2 ? '\u5F02\u5DF1\u6D3E' : '\u540C\u52BF') + '<br>'
    +       '\u9884\u8BA1\u5F39\u52BE\u6210\u7B97\uFF1A<b style="color:' + _succClr + ';font-size:1rem;">' + _baseSucc + '%</b> <span style="color:' + _succClr + ';">(' + _succLbl + ')</span>'
    +     '</div>'
    +   '</div>'
    +   '<div style="font-size:0.7rem;color:var(--ink-300);line-height:1.6;margin-bottom:0.8rem;">'
    +     '\u2022 AI \u5C06\u5728\u672C\u56DE\u5408\u63A8\u6F14\u4E2D\u5224\u5B9A\u5F39\u52BE\u6210\u8D25<br>'
    +     '\u2022 \u5F39\u52BE\u5931\u8D25\u00B7\u7687\u5A01\u964D\u00B7\u88AB\u5F39\u8005\u5BF9\u966A\u4E1A\u7A7A<br>'
    +     '\u2022 \u5F39\u52BE\u6210\u529F\u00B7\u7A7A\u51FA\u804C\u4F4D\u5F85\u8865\u4EFB'
    +   '</div>'
    +   '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">'
    +     '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    +     '<button class="bt bsm" style="background:var(--vermillion-400);color:#fff;border-color:var(--vermillion-400);" onclick="this.closest(\'div[style*=fixed]\').remove();_offImpeachSubmit(\'' + _sN + '\',\'' + _sD + '\',\'' + _sP + '\',' + _baseSucc + ')">\u4E0A\u5F39\u6587</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(bg);
}

function _offImpeachSubmit(charName, deptName, posName, estSucc) {
  var edictLine = '\u5F39\u52BE ' + charName + '\u00B7\u8BF7\u514D ' + deptName + posName + '\u3002';
  var polEl = document.getElementById('edict-pol');
  if (polEl) {
    var cur = (polEl.value || '').trim();
    polEl.value = cur ? (cur + '\n' + edictLine) : edictLine;
  }
  if (!GM._edictTracker) GM._edictTracker = [];
  GM._edictTracker.push({
    id: 'impeach_' + Date.now() + '_' + charName,
    content: edictLine, category: '弹劾',
    turn: GM.turn || 0, status: 'pending',
    assignee: '',
    feedback: '',
    progressPercent: 0,
    _impeach: { target: charName, dept: deptName, pos: posName, estSucc: estSucc }
  });
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5F39\u52BE\u6309\u94AE', from: '\u94E8\u66F9', content: edictLine, turn: GM.turn, used: true });
  toast('\u5F39\u52BE\u6587\u5DF2\u7EB3\u8BCF\u00B7\u672C\u56DE\u5408 AI \u5BA1\u5B9A');
  if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

// NPC 势力自动补任·endturn Phase 0-0c 调用
// 扫 officeTree 找 NPC 势力控制的空缺职位·按 (同派系+能力+历史名望) 择候选·自动写 holder
function _npcAutoAppointVacancies() {
  if (!GM.officeTree) return { appointed: [] };
  var playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var playerFacName = playerFac ? playerFac.name : ((P.playerInfo && P.playerInfo.factionName) || '');
  var appointed = [];

  // 识别职位归属派系：通过 currentHolder→faction，或 deptName 中的势力特征
  function _inferPosFaction(pos, deptName, parentChain) {
    // 若有 oldHolder 且 faction 明确·取之
    if (Array.isArray(pos.holderHistory) && pos.holderHistory.length > 0) {
      for (var i = pos.holderHistory.length-1; i >= 0; i--) {
        var h = pos.holderHistory[i];
        if (h && h.name) {
          var ch = findCharByName(h.name);
          if (ch && ch.faction) return ch.faction;
        }
      }
    }
    // 依据 deptName/parentChain 从势力领土关键词推
    var haystack = (deptName||'') + '|' + (parentChain||'');
    var facs = GM.facs || [];
    for (var j = 0; j < facs.length; j++) {
      var f = facs[j];
      if (!f || f.isPlayer) continue;
      if (f.name && haystack.indexOf(f.name) >= 0) return f.name;
      // 领土匹配
      if (Array.isArray(f.territory)) {
        for (var k = 0; k < f.territory.length; k++) {
          if (haystack.indexOf(f.territory[k]) >= 0) return f.name;
        }
      }
    }
    return ''; // 无法推·视为中央朝廷（玩家管辖）
  }

  // 候选打分·相似于 _offPickerConfirm 的打分·但简化
  function _scoreCandidate(c, pos, deptName, facName) {
    var s = 0;
    var dutyText = (pos.duties||'') + (pos.desc||'') + deptName + (pos.name||'');
    var isMil = /\u5175|\u519B|\u536B|\u6B66|\u90FD\u7763|\u5C06|\u603B\u5175/.test(dutyText);
    var isAdm = /\u540F|\u94E8|\u8003|\u793C|\u6237|\u5EA6\u652F|\u5DE5|\u5211|\u5FA1\u53F2/.test(dutyText);
    if (isMil) s += (c.military||50) * 1.6 + (c.valor||50) * 0.6;
    else if (isAdm) s += (c.administration||50) * 1.6 + (c.intelligence||50) * 0.6;
    else s += (c.intelligence||50) + (c.administration||50);
    s += (c.loyalty||50) * 0.4;
    // 同派系加成
    if (facName && c.faction === facName) s += 50;
    // 历史人物加成
    if (c.isHistorical) s += 30;
    // 重要性加成
    if (c.importance) s += Math.min(20, c.importance * 0.25);
    // 已有高官减分·避免反复调任同一人
    if (c.officialTitle) s -= 15;
    // 年龄超 70 减分
    if (c.age && c.age >= 70) s -= 8;
    return s;
  }

  (function _scan(nodes, parentChain) {
    (nodes||[]).forEach(function(n) {
      if (!n) return;
      var chain = parentChain ? (parentChain + '·' + n.name) : n.name;
      (n.positions||[]).forEach(function(p) {
        if (!p || p.holder) return; // 已有 holder 跳过
        if (p._pendingEdict) return; // 玩家本回合诏令跳过
        var facName = _inferPosFaction(p, n.name, chain);
        // 仅补 NPC 派系职位·玩家势力不自动补
        if (!facName || facName === playerFacName) return;
        // 候选池：同派系活人·非玩家
        var cands = (GM.chars||[]).filter(function(c){
          if (!c || c.alive === false || c.isPlayer) return false;
          if (c.faction !== facName) return false;
          return true;
        });
        if (cands.length === 0) return; // 无候选跳过
        cands.forEach(function(c){ c._npcScore = _scoreCandidate(c, p, n.name, facName); });
        cands.sort(function(a,b){ return b._npcScore - a._npcScore; });
        var best = cands[0];
        if (!best || best._npcScore <= 0) return;
        // 就任
        p.holder = best.name;
        p.holderSinceTurn = GM.turn || 0;
        if (!Array.isArray(p._history)) p._history = [];
        p._history.push({ holder: '(空)', endTurn: GM.turn||0, reason: 'NPC内定补任' });
        if (p.publicTreasury) p.publicTreasury.currentHead = best.name;
        best.officialTitle = p.name;
        best.position = p.name;
        if (!best.careerHistory) best.careerHistory = [];
        best.careerHistory.push({ turn: GM.turn||0, event: facName + '\u5185\u5B9A\u5C31\u4EFB ' + n.name + p.name });
        appointed.push({ faction: facName, charName: best.name, dept: n.name, pos: p.name, rank: p.rank||'', score: best._npcScore });
      });
      if (n.subs) _scan(n.subs, chain);
    });
  })(GM.officeTree, '');

  return { appointed: appointed };
}

// 撤销本回合任命·反向操作 _offPickerConfirm 的所有副作用
function _offUndoAppointment(deptName, posName) {
  var target = null;
  (function _find(nodes) {
    if (target) return;
    (nodes||[]).forEach(function(n) {
      if (target || !n) return;
      if (n.name === deptName) {
        (n.positions||[]).forEach(function(p) {
          if (target || !p) return;
          if (p.name === posName) target = p;
        });
      }
      if (!target && n.subs) _find(n.subs);
    });
  })(GM.officeTree || []);
  if (!target || !target._pendingEdict || target._pendingEdict.turn !== GM.turn) {
    toast('\u8BE5\u804C\u65E0\u53EF\u64A4\u9500\u7684\u8BCF\u4E66'); return;
  }
  var pe = target._pendingEdict;
  var newChar = (GM.chars||[]).find(function(c){ return c.name === pe.newHolder; });
  var oldChar = pe.prevHolder ? (GM.chars||[]).find(function(c){ return c.name === pe.prevHolder; }) : null;

  // 1. 回滚 holder + publicTreasury·用助手确保 actualHolders 同步
  // 先把新任从 actualHolders 剥除
  if (pe.newHolder && typeof _offDismissPerson === 'function') {
    try { _offDismissPerson(target, pe.newHolder); } catch(_){}
  }
  // 若原有旧任·把其推回 actualHolders
  if (pe.prevHolder && typeof _offAppointPerson === 'function') {
    try { _offAppointPerson(target, pe.prevHolder); } catch(_){}
  } else {
    target.holder = pe.prevHolder || undefined;
    if (!pe.prevHolder) { try { delete target.holder; } catch(_){} }
  }
  if (target.publicTreasury) target.publicTreasury.currentHead = pe._snapPrevPubHead;
  // 回滚 _history 最末一条（就是刚才写的那条）
  if (Array.isArray(target._history) && target._history.length > 0) target._history.pop();

  // 1b. 回滚 resign 模式清空的原职·把 newChar 推回他原本的其他位置
  if (pe._snapResignVacated && pe._snapResignVacated.length > 0) {
    pe._snapResignVacated.forEach(function(rv) {
      (function _findRestore(nodes) {
        (nodes||[]).forEach(function(n) {
          if (!n) return;
          if (n.name === rv.dept) {
            (n.positions||[]).forEach(function(p) {
              if (p && p.name === rv.pos) {
                if (typeof _offAppointPerson === 'function') {
                  try { _offAppointPerson(p, rv.holder); } catch(_){}
                } else {
                  p.holder = rv.holder;
                }
                if (rv.holderSinceTurn) p.holderSinceTurn = rv.holderSinceTurn;
                if (p.publicTreasury && rv.pubHead) p.publicTreasury.currentHead = rv.pubHead;
              }
            });
          }
          if (n.subs) _findRestore(n.subs);
        });
      })(GM.officeTree||[]);
    });
  }

  // 2. 回滚 newChar 字段
  if (newChar) {
    if (pe.mode === 'concurrent') {
      // 兼任撤销·从 concurrentTitles 移除
      if (Array.isArray(newChar.concurrentTitles)) {
        var _ci2 = newChar.concurrentTitles.indexOf(pe.posName);
        if (_ci2 >= 0) newChar.concurrentTitles.splice(_ci2, 1);
      }
    } else {
      // 辞旧就新撤销·恢复原主职
      if (newChar.officialTitle === pe.posName) newChar.officialTitle = pe._snapPrevMainTitle || '';
      if (newChar.position === pe.posName) newChar.position = pe._snapPrevMainTitle || '';
    }
    if (pe._snapNewCharCareerPushed && Array.isArray(newChar.careerHistory) && newChar.careerHistory.length > 0) {
      newChar.careerHistory.pop();
    }
    if (pe._snapNewCharSeedPushed && Array.isArray(newChar._memorySeeds) && newChar._memorySeeds.length > 0) {
      newChar._memorySeeds.pop();
    }
    // 反向 Affinity +5·回正 -5
    if (pe._snapAppliedAffinity && typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      try { AffinityMap.add(pe.newHolder, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', -5, '\u8BCF\u4E66\u64A4\u56DE'); } catch(_){}
    }
  }

  // 3. 回滚 oldChar 字段（若有改换）
  if (oldChar) {
    // 之前清了 officialTitle/position·若仍为空则恢复回原职
    if (!oldChar.officialTitle) oldChar.officialTitle = pe.posName;
    if (!oldChar.position) oldChar.position = pe.posName;
    if (pe._snapOldCharDisplacedSet) { try { delete oldChar._displaced; } catch(_){} }
    if (pe._snapOldCharCareerPushed && Array.isArray(oldChar.careerHistory) && oldChar.careerHistory.length > 0) {
      oldChar.careerHistory.pop();
    }
    if (pe._snapAppliedAffinity && typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      try { AffinityMap.add(pe.prevHolder, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', 10, '\u8BCF\u4E66\u64A4\u56DE'); } catch(_){}
    }
  }

  // 4. 从 edict-pol textarea 移除这一行
  var polEl = document.getElementById('edict-pol');
  if (polEl && polEl.value && pe.edictLine) {
    var lines = polEl.value.split('\n');
    var idx = lines.lastIndexOf(pe.edictLine);
    if (idx >= 0) {
      lines.splice(idx, 1);
      polEl.value = lines.join('\n');
    }
  }

  // 5. 从 edictSuggestions 移除
  if (Array.isArray(GM._edictSuggestions)) {
    GM._edictSuggestions = GM._edictSuggestions.filter(function(s){ return !(s && s.content === pe.edictLine && s.turn === pe.turn); });
  }

  // 6. 从 edictTracker 移除
  if (pe.trackerId && Array.isArray(GM._edictTracker)) {
    GM._edictTracker = GM._edictTracker.filter(function(t){ return t && t.id !== pe.trackerId; });
  }

  // 7. 清 _pendingEdict
  try { delete target._pendingEdict; } catch(_){}

  toast('\u5DF2\u64A4\u9500\uFF1A' + (pe.prevHolder ? ('\u6062\u590D ' + pe.prevHolder) : ('\u7A7A\u7F3A ' + pe.posName)));
  if (typeof renderOfficeTree === 'function') { try { renderOfficeTree(); } catch(_){} }
  if (typeof renderRenwu === 'function') { try { renderRenwu(); } catch(_){} }
  if (typeof _renderEdictSuggestions === 'function') { try { _renderEdictSuggestions(); } catch(_){} }
}

/** 廷推——高品级职位由多位大臣联名推荐 */
function _offTingTui(pathArr, deptName, posName, pos) {
  // 收集在京有品级的高级官员（从三品以上有资格参与廷推）
  var capital = GM._capital || '京城';
  var _recommenders = [];
  (function _findSenior(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        if (p.holder) {
          var _rl2 = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
          if (_rl2 <= 8) { // 从四品以上有资格参与廷推
            var _ch2 = findCharByName(p.holder);
            if (_ch2 && _ch2.alive !== false && (_ch2.location === capital || !_ch2.location)) {
              _recommenders.push({ name: p.holder, dept: n.name, pos: p.name, rank: p.rank, ch: _ch2 });
            }
          }
        }
      });
      if (n.subs) _findSenior(n.subs);
    });
  })(GM.officeTree||[]);

  // 每位推荐者根据自己的派系/关系推荐一人
  var _candidates = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer && c.name !== (pos.holder||''); });
  var _recommendations = [];
  _recommenders.forEach(function(r) {
    // 推荐偏好：同派系 > 高能力 > 亲近之人
    var _best = null, _bestScore = -999;
    _candidates.forEach(function(c) {
      var score = (c.intelligence||50) + (c.administration||50);
      if (r.ch.faction && c.faction === r.ch.faction) score += 40; // 同派系加分
      if (r.ch.party && c.party === r.ch.party) score += 25;
      if (typeof AffinityMap !== 'undefined') {
        var _aff = AffinityMap.get(r.name, c.name);
        if (_aff > 0) score += _aff;
      }
      if (score > _bestScore) { _bestScore = score; _best = c; }
    });
    if (_best) _recommendations.push({ recommender: r.name, recommenderDept: r.dept, candidate: _best.name, score: _bestScore });
  });

  // 统计得票
  var _voteMap = {};
  _recommendations.forEach(function(r) {
    if (!_voteMap[r.candidate]) _voteMap[r.candidate] = { votes: 0, from: [] };
    _voteMap[r.candidate].votes++;
    _voteMap[r.candidate].from.push(r.recommender);
  });
  var _sorted = Object.keys(_voteMap).sort(function(a,b) { return _voteMap[b].votes - _voteMap[a].votes; });

  // 弹窗显示廷推结果
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:500px;max-height:80vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-md);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.15em;text-align:center;">\u3014 \u5EF7 \u63A8 \u3015</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);text-align:center;margin-bottom:var(--space-3);">' + escHtml(deptName) + escHtml(posName) + '（' + escHtml(pos.rank||'') + '）——' + _recommenders.length + '\u4F4D\u5927\u81E3\u53C2\u4E0E\u5EF7\u63A8</div>';

  if (_sorted.length === 0) {
    html += '<div style="color:var(--ink-300);text-align:center;padding:1rem;">无合适人选</div>';
  } else {
    _sorted.slice(0, 5).forEach(function(name, idx) {
      var v = _voteMap[name];
      var ch = findCharByName(name);
      var isTop = idx === 0;
      html += '<div style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + (isTop ? 'var(--gold-500)' : 'var(--color-border-subtle)') + ';border-radius:var(--radius-sm);cursor:pointer;" onclick="_offSelectCandidate(\'' + escHtml(name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div>';
      html += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);' + (isTop ? 'color:var(--gold-400);' : '') + '">' + escHtml(name) + '</span>';
      if (ch && ch.title) html += '<span style="font-size:0.65rem;color:var(--ink-300);margin-left:4px;">' + escHtml(ch.title) + '</span>';
      html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">';
      if (ch) { var _f1=(typeof _fmtNum1==='function')?_fmtNum1:function(v){return v;}; html += '\u667A' + _f1(ch.intelligence||50) + ' \u653F' + _f1(ch.administration||50) + ' \u519B' + _f1(ch.military||50) + ' \u5FE0' + _f1(ch.loyalty||50); }
      html += '</div>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-size:var(--text-sm);color:var(--gold-400);font-weight:var(--weight-bold);">' + v.votes + '\u7968</div>';
      html += '<div style="font-size:0.6rem;color:var(--ink-300);">' + v.from.join('、') + '</div>';
      html += '</div></div></div>';
    });
  }
  html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);text-align:center;margin-top:var(--space-2);">\u70B9\u51FB\u5019\u9009\u4EBA\u7EB3\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93\uFF0C\u6216\u81EA\u884C\u4E0B\u65E8\u4EFB\u547D\u4ED6\u4EBA</div>';
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u5173\u95ED</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 提取某人的完整官制信息（当前职位+仕途+考评+满意度+丁忧） */
function _offGetCharInfo(charName) {
  var ch = findCharByName(charName);
  if (!ch) return null;
  var info = { current: null, career: [], lastEval: null, satisfaction: null, mourning: ch._mourning || null };
  (function _scan(nodes, dName) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        if (p.holder === charName) {
          var tk = (dName||n.name) + p.name;
          var tenure = (ch._tenure && ch._tenure[tk]) || 0;
          var lastEval = (p._evaluations && p._evaluations.length > 0) ? p._evaluations[p._evaluations.length-1] : null;
          info.current = { dept: n.name, pos: p.name, rank: p.rank||'', tenure: tenure, eval: lastEval };
          if (lastEval) info.lastEval = lastEval;
          info.career.push({ dept: n.name, pos: p.name, rank: p.rank||'', from: GM.turn - tenure, to: null, current: true });
          if (typeof calcOfficialSatisfaction === 'function') {
            info.satisfaction = calcOfficialSatisfaction(charName, p.rank, n.name);
          }
        }
        if (p._history) {
          p._history.forEach(function(h) {
            if (h.holder === charName) {
              info.career.push({ dept: n.name, pos: p.name, rank: p.rank||'', from: h.from||0, to: h.to||0, reason: h.reason||'' });
            }
          });
        }
      });
      if (n.subs) _scan(n.subs, n.name);
    });
  })(GM.officeTree||[]);
  info.career.sort(function(a,b) { return (a.from||0) - (b.from||0); });
  return info;
}

/** 渲染仕途时间线HTML（供char-popup/viewRenwu/offShowCareer共用） */
function _offRenderCareerHTML(charName) {
  var info = _offGetCharInfo(charName);
  if (!info) return '';
  var ch = findCharByName(charName);
  var html = '';
  // 当前官职
  if (info.current) {
    var _rkInfo = typeof getRankInfo === 'function' ? getRankInfo(info.current.rank) : null;
    html += '<div style="padding:var(--space-2);background:var(--color-elevated);border:1px solid var(--gold-500);border-radius:var(--radius-sm);margin-bottom:var(--space-2);">';
    html += '<div style="font-size:var(--text-xs);color:var(--gold-400);font-weight:var(--weight-bold);margin-bottom:2px;">\u5F53\u524D\u5B98\u804C</div>';
    html += '<div style="font-size:var(--text-sm);color:var(--color-foreground);">' + escHtml(info.current.dept) + ' · ' + escHtml(info.current.pos);
    if (info.current.rank) html += ' <span style="color:' + (_rkInfo ? _rkInfo.color : 'var(--ink-300)') + ';">（' + escHtml(info.current.rank) + '）</span>';
    html += '</div>';
    html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);margin-top:2px;">';
    html += '\u4EFB\u671F ' + info.current.tenure + ' \u56DE\u5408';
    if (info.current.tenure > 12) html += ' <span style="color:var(--amber-400);">\u26A0\u8D85\u671F</span>';
    html += '</div>';
    if (info.lastEval) {
      var _ec = {'\u5353\u8D8A':'var(--gold-400)','\u79F0\u804C':'var(--celadon-400)','\u5E73\u5EB8':'var(--ink-300)','\u5931\u804C':'var(--vermillion-400)'};
      html += '<div style="font-size:0.65rem;margin-top:2px;">\u8003\u8BC4\uFF08' + escHtml(info.lastEval.evaluator||'') + '\uFF09\uFF1A<span style="color:' + (_ec[info.lastEval.grade]||'var(--ink-300)') + ';">' + escHtml(info.lastEval.grade||'') + '</span> ' + escHtml(info.lastEval.comment||'') + '</div>';
    }
    if (info.satisfaction) {
      var _sc2 = info.satisfaction.score;
      html += '<div style="font-size:0.65rem;color:' + (_sc2 < 35 ? 'var(--vermillion-400)' : _sc2 < 55 ? 'var(--amber-400)' : 'var(--celadon-400)') + ';margin-top:2px;">\u5FC3\u6001\uFF1A' + escHtml(info.satisfaction.label) + '</div>';
    }
    html += '</div>';
  } else if (info.mourning) {
    html += '<div style="padding:var(--space-2);background:rgba(107,93,79,0.1);border:1px solid var(--ink-300);border-radius:var(--radius-sm);margin-bottom:var(--space-2);">';
    html += '<div style="font-size:var(--text-xs);color:var(--ink-300);">\u4E01\u5FE7\u5B88\u4E27\u4E2D\uFF08\u56E0' + escHtml(info.mourning.parent||'') + '\u53BB\u4E16\uFF09\uFF0C\u9884\u8BA1T' + info.mourning.until + '\u671F\u6EE1</div>';
    html += '</div>';
  } else {
    html += '<div style="font-size:0.7rem;color:var(--ink-300);margin-bottom:var(--space-2);">\u5E03\u8863 / \u65E0\u5B98\u804C</div>';
  }
  // 仕途时间线
  if (info.career.length > 0) {
    html += '<div style="margin-top:var(--space-2);">';
    html += '<div style="font-size:var(--text-xs);color:var(--gold-400);font-weight:var(--weight-bold);margin-bottom:var(--space-1);">\u4ED5\u9014</div>';
    info.career.forEach(function(c) {
      var fromDate = c.from ? ((typeof getTSText === 'function') ? getTSText(c.from) : 'T' + c.from) : '?';
      var toDate = c.current ? '\u5728\u4EFB' : (c.to ? ((typeof getTSText === 'function') ? getTSText(c.to) : 'T' + c.to) : '?');
      html += '<div style="padding:2px var(--space-2);border-left:2px solid ' + (c.current ? 'var(--gold-400)' : 'var(--color-border-subtle)') + ';margin-bottom:2px;">';
      html += '<div style="font-size:0.7rem;font-weight:' + (c.current ? 'var(--weight-bold)' : 'normal') + ';color:' + (c.current ? 'var(--gold-400)' : 'var(--color-foreground)') + ';">' + escHtml(c.dept) + ' · ' + escHtml(c.pos) + (c.rank ? ' (' + escHtml(c.rank) + ')' : '') + '</div>';
      html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">' + fromDate + ' → ' + toDate + (c.reason ? ' · ' + escHtml(c.reason) : '') + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  return html;
}

/** 查看官员完整仕途（弹窗版——复用通用渲染函数） */
function _offShowCareer(charName) {
  var ch = findCharByName(charName);
  if (!ch) { toast('找不到此人'); return; }
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:450px;max-height:80vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-md);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.1em;">' + escHtml(charName) + ' \u4ED5\u9014</div>';
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:var(--space-2);">\5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty||50):(ch.loyalty||50)) + ' \u667A' + (ch.intelligence||50) + ' \u653F' + (ch.administration||50) + ' \u519B' + (ch.military||50) + ' \u91CE\u5FC3' + (ch.ambition||50) + '</div>';
  html += _offRenderCareerHTML(charName);
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u5173\u95ED</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 官制改革→写入诏令建议库 */
function _offReformToEdict(action, deptName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  if (action === 'add_pos') {
    showPrompt('增设官职名称：', '', function(posName) {
      if (!posName) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '于' + deptName + '增设' + posName + '一职', turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  } else if (action === 'add_sub') {
    showPrompt('增设下属部门名称：', '', function(subName) {
      if (!subName) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '于' + deptName + '下增设' + subName, turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  } else if (action === 'abolish') {
    GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '裁撤' + deptName, turn: GM.turn, used: false });
    toast('已录入诏书建议库——请在诏令中正式下旨');
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  } else if (action === 'rename') {
    showPrompt(deptName + '更名为：', '', function(newName) {
      if (!newName) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '将' + deptName + '更名为' + newName, turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  } else if (action === 'add_dept') {
    showPrompt('增设顶层部门名称：', '', function(name) {
      if (!name) return;
      GM._edictSuggestions.push({ source: '官制', from: '铨曹', content: '增设' + name, turn: GM.turn, used: false });
      toast('已录入诏书建议库——请在诏令中正式下旨');
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    });
  }
}

/** 免职→写入诏令建议库 */
function _offDismissToEdict(holderName, deptName, posName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '官制', from: '铨曹',
    content: '免去' + holderName + '的' + deptName + posName + '之职',
    turn: GM.turn, used: false
  });
  toast('已录入诏书建议库——请在诏令中正式下旨');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

function getOffNode(path,tree){var node=null;var list=tree||GM.officeTree;for(var i=0;i<path.length;i++){if(path[i]==="s"){i++;if(!node||!node.subs)return null;list=node.subs;node=list[path[i]];}else if(path[i]==="p"){i++;if(!node||!node.positions)return null;return node.positions[path[i]];}else{node=list[path[i]];}}return node;}
function updOffNode(path,field,value){var node=null;var list=GM.officeTree;var parentDept=null;for(var i=0;i<path.length;i++){if(path[i]==="s"){i++;if(!node||!node.subs)return;parentDept=node;list=node.subs;node=list[path[i]];}else if(path[i]==="p"){i++;if(!node||!node.positions)return;parentDept=node;node=node.positions[path[i]];}else{node=list[path[i]];}}if(!node)return;
  // 如果修改了部门名或职位名，迁移NPC的任职记录
  if(field==='name'&&node[field]&&node[field]!==value&&GM.chars){
    var oldName=node[field];
    GM.chars.forEach(function(c){
      if(!c._tenure)return;
      // 迁移包含旧名的tenure key
      var keysToMigrate=Object.keys(c._tenure).filter(function(k){return k.indexOf(oldName)>=0;});
      keysToMigrate.forEach(function(k){
        var newKey=k.replace(oldName,value);
        c._tenure[newKey]=(c._tenure[newKey]||0)+c._tenure[k];
        delete c._tenure[k];
      });
    });
    _dbg('[OfficeRename] '+oldName+'→'+value+'，已迁移'+GM.chars.filter(function(c){return c._tenure;}).length+'人的任职记录');
  }
  var _oldVal=node[field];node[field]=value;if(GM.officeChanges)GM.officeChanges.push({action:"update",field:field,value:value,oldValue:_oldVal});}
function addGameDept(){showPrompt("\u90E8\u95E8:","",function(n){if(!n)return;GM.officeTree.push({name:n,positions:[],subs:[]});renderOfficeTree();});}
function addOffPos(path){showPrompt("\u5B98\u804C:","",function(n){if(!n)return;var nd=getOffNode(path);if(nd){if(!nd.positions)nd.positions=[];nd.positions.push({name:n,holder:"",desc:"",rank:""});renderOfficeTree();}});}
function addOffSub(path){showPrompt("\u4E0B\u5C5E:","",function(n){if(!n)return;var nd=getOffNode(path);if(nd){if(!nd.subs)nd.subs=[];nd.subs.push({name:n,positions:[],subs:[]});renderOfficeTree();}});}
async function submitOfficeCh(){if(!GM.officeChanges)GM.officeChanges=[];if(GM.officeChanges.length===0){toast("\u65E0\u53D8\u66F4");return;}toast("\u5DF2\u63D0\u4EA4\uFF0C\u4E0B\u56DE\u5408\u751F\u6548");GM.officeChanges=[];P.officeTree=deepClone(GM.officeTree);}

// ============================================================
//  编年
// ============================================================
function renderBiannian(){
  // 类型→(label,cat,icon) 映射
  var _BN_TYPE = {
    keju:             {label:'\u79D1\u4E3E\u884C\u671D',     cat:'keju',     icon:'\u6587'},
    edict:            {label:'\u957F\u671F\u8BCF\u4EE4',     cat:'edict',    icon:'\u8BCF'},
    project:          {label:'\u5DE5\u7A0B\u5546\u961F',     cat:'project',  icon:'\u5DE5'},
    pending_memorial: {label:'\u79EF\u538B\u594F\u758F',     cat:'memorial', icon:'\u79EF'},
    faction_treaty:   {label:'\u52BF\u529B\u7EA6\u671F',     cat:'faction',  icon:'\u76DF'},
    npc_action:       {label:'NPC \u6301\u7EED\u884C\u52A8', cat:'npc',      icon:'\u52A8'},
    tingyi_pending:   {label:'\u5EF7\u8BAE\u5F85\u843D\u5B9E',cat:'tingyi',  icon:'\u8BAE'},
    chaoyi_pending:   {label:'\u671D\u8BAE\u5F85\u6267\u884C',cat:'tingyi',  icon:'\u8BAE'},
    dynasty_event:    {label:'\u671D\u4EE3\u4E8B\u4EF6',     cat:'dynasty',  icon:'\u671D'},
    other:            {label:'\u5176\u4ED6',                 cat:'dynasty',  icon:'\u4E8B'}
  };

  // 史册类别→cat-* 映射
  function _bnEntryCat(c) {
    var s = (c.category||'') + (c.title||'');
    if (/\u519B|\u5175|\u6218|\u88D7|\u5E05|\u5BC6/.test(s)) return 'cat-mil';
    if (/\u707E|\u5F02|\u65F1|\u6D3A|\u5730\u9707|\u661F|\u6A90\u66C4|\u96EA|\u5929\u8C61|\u65E5\u98DF|\u6708\u98DF|\u864E|\u72FC/.test(s)) return 'cat-nat';
    if (/\u7ECF|\u8D4B|\u7A0E|\u8D22|\u7C73|\u94F6|\u79DF|\u5E01|\u8D4B\u5F79|\u8D44/.test(s)) return 'cat-eco';
    if (/\u5916\u4EA4|\u85E9|\u8D21|\u8D1F\u76DF|\u4F7F\u81E3|\u548C\u4EB2|\u518C\u5C01/.test(s)) return 'cat-dip';
    if (/\u6587|\u79D1\u4E3E|\u8D24|\u5B66|\u793C|\u7965|\u7948|\u796D|\u4E66/.test(s)) return 'cat-cult';
    if (/\u653F|\u5B98|\u8BCF|\u5415|\u7F62|\u514D|\u664B|\u7F62\u804C|\u5BA3|\u514D\u804C|\u5149\u5E1D|\u5373\u4F4D/.test(s)) return 'cat-pol';
    return 'cat-misc';
  }

  // 从日期推断季节
  function _bnSeason(date) {
    if (!date) return null;
    if (/\u6625|\u6B63\u6708|\u4E8C\u6708|\u4E09\u6708/.test(date)) return '\u6625';
    if (/\u590F|\u56DB\u6708|\u4E94\u6708|\u516D\u6708/.test(date)) return '\u590F';
    if (/\u79CB|\u4E03\u6708|\u516B\u6708|\u4E5D\u6708/.test(date)) return '\u79CB';
    if (/\u51AC|\u5341\u6708|\u5341\u4E00\u6708|\u5341\u4E8C\u6708|\u814A\u6708/.test(date)) return '\u51AC';
    return null;
  }

  // ═══ Section 1：长期事势·进行中 ═══
  var activeEl = _$('bn-active');
  if (activeEl) {
    var aHtml = '';
    var _tracks = [];
    if (typeof ChronicleTracker !== 'undefined') {
      _tracks = ChronicleTracker.getVisible() || [];
    }

    // 旧 biannianItems 合并（保留兼容，转成类兼容结构）
    var _legacyActive = (GM.biannianItems||[]).filter(function(item){
      var elapsed = (GM.turn||0) - (item.startTurn||item.turn||GM.turn||0);
      return elapsed < (item.duration||1);
    });

    var totalActive = _tracks.length + _legacyActive.length;

    // 标题（进行中 N 件）
    aHtml += '<div class="bn-section-hdr">';
    aHtml += '<span class="tag">\u957F \u671F \u4E8B \u52BF</span>';
    aHtml += '<span class="desc">\u2014\u2014 \u8DE8\u8D8A\u591A\u56DE\u5408\u7684\u671D\u91CE\u5927\u4E8B\u00B7AI \u63A8\u6F14\u65F6\u89C6\u4E3A\u6301\u7EED\u4E2D</span>';
    aHtml += '<span class="stat">\u8FDB\u884C\u4E2D ' + totalActive + ' \u4EF6</span>';
    aHtml += '</div>';

    if (totalActive === 0) {
      aHtml += '<div class="bn-empty">\u6682\u65E0\u8FDB\u884C\u4E2D\u7684\u957F\u671F\u4E8B\u52BF</div>';
    } else {
      aHtml += '<div class="bn-tracks-wrap">';

      // 按 type 分组
      var _trackGroups = {};
      _tracks.forEach(function(t){
        var k = t.type || 'other';
        if (!_trackGroups[k]) _trackGroups[k] = [];
        _trackGroups[k].push(t);
      });

      // 按 _BN_TYPE 键固定顺序渲染（非映射内的 type 放最后）
      var _typeOrder = ['keju','edict','project','pending_memorial','faction_treaty','npc_action','tingyi_pending','chaoyi_pending','dynasty_event','other'];
      var _allTypes = Object.keys(_trackGroups);
      var _orderedTypes = _typeOrder.filter(function(k){return _trackGroups[k];}).concat(_allTypes.filter(function(k){return _typeOrder.indexOf(k)<0;}));

      _orderedTypes.forEach(function(typeK){
        var meta = _BN_TYPE[typeK] || _BN_TYPE.other;
        var items = _trackGroups[typeK];
        aHtml += '<div class="bn-track-group bn-cat-' + meta.cat + '">';
        aHtml += '<div class="bn-track-group-hdr">';
        aHtml += '<div class="icon">' + meta.icon + '</div>';
        aHtml += '<div class="name">' + escHtml(meta.label) + '</div>';
        aHtml += '<div class="count">' + items.length + ' \u4EF6</div>';
        aHtml += '</div>';

        items.forEach(function(t){
          var elapsed = (GM.turn||0) - (t.startTurn||0);
          var pct = Math.min(100, Math.max(0, t.progress||0));
          var _prioCls = (t.priority === 'high') ? ' priority-high' : '';
          aHtml += '<div class="bn-track' + _prioCls + '">';
          // hdr
          aHtml += '<div class="bn-track-hdr">';
          aHtml += '<span class="bn-track-title">' + escHtml(t.title||'\u65E0\u9898') + '</span>';
          if (t.priority === 'high') {
            var prioLbl = (t.nextDeadline && t.nextDeadline <= (GM.turn||0)) ? '\u26A0 \u903E\u671F' : '\u26A0 \u9AD8\u4F18\u5148';
            aHtml += '<span class="bn-track-prio">' + prioLbl + '</span>';
          }
          if (t.hidden) aHtml += '<span class="bn-track-hidden">\u25C7 \u9690</span>';
          aHtml += '</div>';
          // meta
          aHtml += '<div class="bn-track-meta">';
          if (t.actor) {
            aHtml += '\u4E3B\uFF1A<strong style="color:var(--color-foreground);">' + escHtml(t.actor) + '</strong>';
            aHtml += '<span class="sep">\u00B7</span>';
          }
          aHtml += '\u9636\u6BB5\uFF1A<span class="stage">' + escHtml(t.currentStage||'-') + '</span>';
          aHtml += '<span class="sep">\u00B7</span>';
          aHtml += '<span class="elapsed">\u5DF2\u5386 ' + elapsed + ' \u56DE\u5408</span>';
          if (t.expectedEndTurn && t.expectedEndTurn > (GM.turn||0)) {
            aHtml += '<span class="sep">\u00B7</span>';
            aHtml += '<span class="remaining">\u9884\u4F59 ' + (t.expectedEndTurn - GM.turn) + ' \u56DE</span>';
          }
          aHtml += '</div>';
          if (t.narrative) aHtml += '<div class="bn-track-narr">' + escHtml(t.narrative) + '</div>';
          if (Array.isArray(t.stakeholders) && t.stakeholders.length) {
            aHtml += '<div class="bn-track-stake"><span class="lbl">\u76F8\u5173\uFF1A</span>';
            t.stakeholders.slice(0,6).forEach(function(s){
              aHtml += '<span class="chip">' + escHtml(s) + '</span>';
            });
            aHtml += '</div>';
          }
          if (pct > 0 || t.expectedEndTurn) {
            aHtml += '<div class="bn-track-bar"><div class="bn-track-bar-fill" style="width:' + pct + '%;"></div></div>';
            aHtml += '<div class="bn-track-pct">' + pct + '%</div>';
          }
          aHtml += '</div>'; // .bn-track
        });
        aHtml += '</div>'; // .bn-track-group
      });

      // 旧 biannianItems（若有）放入"其他"组
      if (_legacyActive.length > 0) {
        aHtml += '<div class="bn-track-group bn-cat-dynasty">';
        aHtml += '<div class="bn-track-group-hdr">';
        aHtml += '<div class="icon">\u4E8B</div>';
        aHtml += '<div class="name">\u5176 \u4ED6 \u8FDB \u884C \u4E2D</div>';
        aHtml += '<div class="count">' + _legacyActive.length + ' \u4EF6</div>';
        aHtml += '</div>';
        _legacyActive.forEach(function(item){
          var elapsed = (GM.turn||0) - (item.startTurn||item.turn||GM.turn||0);
          var total = item.duration||1;
          var pct = Math.min(100, Math.round(elapsed/total*100));
          var rem = Math.max(0, total - elapsed);
          var _date = item.date || (typeof getTSText === 'function' ? getTSText(item.startTurn||item.turn||1) : '');
          aHtml += '<div class="bn-track">';
          aHtml += '<div class="bn-track-hdr"><span class="bn-track-title">' + escHtml(item.title||item.name||'\u65E0\u9898') + '</span></div>';
          aHtml += '<div class="bn-track-meta">';
          if (_date) { aHtml += escHtml(_date) + '<span class="sep">\u00B7</span>'; }
          aHtml += '<span class="elapsed">\u8FD8\u5269 ' + rem + ' \u56DE\u5408</span>';
          aHtml += '</div>';
          if (item.content||item.desc) aHtml += '<div class="bn-track-narr">' + escHtml((item.content||item.desc||'').slice(0,120)) + '</div>';
          aHtml += '<div class="bn-track-bar"><div class="bn-track-bar-fill" style="width:' + pct + '%;"></div></div>';
          aHtml += '<div class="bn-track-pct">' + pct + '%</div>';
          aHtml += '</div>';
        });
        aHtml += '</div>';
      }

      aHtml += '</div>'; // .bn-tracks-wrap
    }

    activeEl.innerHTML = aHtml;
  }

  // ═══ Section 3：永久编年·史册 ═══
  var el = _$('biannian-list'); if (!el) return;
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var chronicle = GM._chronicle;

  // 搜索筛选
  var _kw = (_$('bn-search')||{}).value || '';
  var _filter = (_$('bn-filter')||{}).value || 'all';
  var filtered = chronicle;
  if (_kw) {
    var kw = _kw.toLowerCase();
    filtered = filtered.filter(function(c) { return (c.title||'').toLowerCase().indexOf(kw) >= 0 || (c.content||'').toLowerCase().indexOf(kw) >= 0; });
  }
  if (_filter !== 'all') {
    filtered = filtered.filter(function(c) { return (c.category||'').indexOf(_filter) >= 0 || (c.title||'').indexOf(_filter) >= 0 || (c.content||'').indexOf(_filter) >= 0; });
  }

  // 更新统计
  var statEl = _$('bn-tools-stat');
  if (statEl) {
    statEl.innerHTML = '\u5377\u5E19 <span class="n">' + chronicle.length + '</span> \u6761 \u00B7 \u663E <span class="n">' + filtered.length + '</span> \u6761';
  }

  if (chronicle.length === 0) {
    el.innerHTML = '<div class="bn-empty">\u5C1A\u65E0\u7F16\u5E74\u8BB0\u5F55</div>';
    return;
  }
  if (filtered.length === 0) {
    el.innerHTML = '<div class="bn-empty">\u672A\u5BFB\u5F97\u7B26\u5408\u6761\u4EF6\u7684\u5377\u5E19</div>';
    return;
  }

  // 按年分组
  var _byYear = {};
  filtered.forEach(function(c) {
    var yr = c.year || c.date || 'T' + (c.turn||0);
    if (c.date) {
      var _yrMatch = c.date.match(/(.{2,8}\u5E74)/);
      if (_yrMatch) yr = _yrMatch[1];
    }
    if (!_byYear[yr]) _byYear[yr] = [];
    _byYear[yr].push(c);
  });

  var html = '';
  var _years = Object.keys(_byYear).reverse();
  _years.forEach(function(yr, yrIdx) {
    var items = _byYear[yr];
    var openAttr = (yrIdx === 0) ? ' open' : '';
    html += '<details class="bn-year-block"' + openAttr + '>';
    html += '<summary class="bn-year-summary">' + escHtml(yr) + '<span class="count">' + items.length + ' \u6761</span></summary>';

    // 按季节分组（可选，若能推断）
    var _lastSeason = null;
    items.forEach(function(c){
      var sea = _bnSeason(c.date||'');
      if (sea && sea !== _lastSeason) {
        html += '<div class="bn-season">' + sea + '</div>';
        _lastSeason = sea;
      }
      var catCls = _bnEntryCat(c);
      html += '<div class="bn-entry ' + catCls + '">';
      html += '<div class="bn-entry-hdr">';
      html += '<span class="bn-entry-title">' + escHtml(c.title||'') + '</span>';
      if (c.category) html += '<span class="bn-entry-cat">' + escHtml(c.category) + '</span>';
      html += '</div>';
      html += '<div class="bn-entry-date">' + escHtml(c.date||('T'+(c.turn||''))) + '</div>';
      if (c.content) html += '<div class="bn-entry-body">' + escHtml(c.content) + '</div>';
      html += '</div>';
    });

    html += '</details>';
  });
  el.innerHTML = html;
}

function processBiannian(){
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  // 长期事势追踪器·每回合采集（科举/诏令/阴谋/工程/积压奏疏）
  if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.tick) {
    try { ChronicleTracker.tick(); } catch(_e){ console.warn('[Chronicle.tick]', _e); }
  }
  var completed = [];
  GM.biannianItems = (GM.biannianItems||[]).filter(function(item) {
    var elapsed = GM.turn - (item.startTurn||item.turn||GM.turn);
    if (elapsed >= (item.duration||1)) {
      completed.push(item);
      return false;
    }
    return true;
  });
  // 完成的事务→触发effect→归入永久编年
  completed.forEach(function(item) {
    if (typeof addEB === 'function') addEB('\u5B8C\u6210', item.name||item.title);
    if (item.effect) Object.entries(item.effect).forEach(function(e) { if (GM.vars[e[0]]) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value + e[1], GM.vars[e[0]].min, GM.vars[e[0]].max); });
    // 归入编年
    GM._chronicle.push({
      title: (item.title||item.name||'') + '（已毕）',
      content: item.content||item.desc||'',
      date: item.date || (typeof getTSText === 'function' ? getTSText(item.startTurn||item.turn||GM.turn) : ''),
      turn: item.startTurn||item.turn||GM.turn,
      category: item.type||'',
      year: item.year||''
    });
  });
  // 从本回合时政记自动提取编年条目
  _bnExtractFromShiji();
  renderBiannian();
}

/** 从时政记(shijiHistory)中自动提取本回合要点入编年 */
function _bnExtractFromShiji() {
  if (!GM.shijiHistory || GM.shijiHistory.length === 0) return;
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var latest = GM.shijiHistory[GM.shijiHistory.length - 1];
  if (!latest || latest.turn !== GM.turn - 1) return; // 时政记是上回合的
  // 检查是否已提取过
  var _alreadyExtracted = GM._chronicle.some(function(c) { return c._fromShiji && c.turn === latest.turn; });
  if (_alreadyExtracted) return;
  // 提取turn_summary作为一行编年条目
  if (latest.turnSummary) {
    GM._chronicle.push({
      title: latest.turnSummary,
      content: '',
      date: latest.time || (typeof getTSText === 'function' ? getTSText(latest.turn) : ''),
      turn: latest.turn,
      category: '',
      year: '',
      _fromShiji: true
    });
  }
  // 编年记录不设上限——永久保留全部历史
}

/** 编年导出 */
function _bnExport() {
  var items = (GM._chronicle||[]).concat(
    (GM.biannianItems||[]).map(function(item) {
      return { title: (item.title||item.name||'') + '（进行中）', content: item.content||item.desc||'', date: item.date||'', turn: item.startTurn||item.turn||0, category: item.type||'' };
    })
  );
  var txt = items.map(function(c) {
    return '[T' + (c.turn||'') + '] ' + (c.date||'') + (c.category ? ' [' + c.category + ']' : '') + '\n' + (c.title||'') + (c.content ? '\n' + c.content : '');
  }).join('\n\n---\n\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_bnDownload(txt);});
  } else { _bnDownload(txt); }
}
function _bnDownload(txt) {
  var a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
  a.download = 'biannian_' + (GM.saveName||'export') + '.txt'; a.click();
  toast('\u5DF2\u5BFC\u51FA');
}

// ============================================================
//  结束回合确认弹窗
// ============================================================
function confirmEndTurn(){
  if(GM.busy)return;
  var edict=(_$('edict-pol')||{}).value||'';
  var mil=(_$('edict-mil')||{}).value||'';
  var dip=(_$('edict-dip')||{}).value||'';
  var eco=(_$('edict-eco')||{}).value||'';
  var oth=(_$('edict-oth')||{}).value||'';
  var xinglu=(_$('xinglu')||{}).value||'';
  var xlPub=(_$('xinglu-pub')||{}).value||'';
  var xlPrv=(_$('xinglu-prv')||{}).value||'';
  var empty=!edict.trim()&&!mil.trim()&&!dip.trim()&&!eco.trim()&&!oth.trim()&&!xinglu.trim()&&!xlPub.trim()&&!xlPrv.trim();
  // 统计待处理奏疏
  var pendingMem=(GM.memorials||[]).filter(function(m){return m.status==='pending';}).length;
  var warningHtml='';
  if(pendingMem>0) warningHtml='<div style="font-size:0.78rem;color:#e67e22;margin-bottom:0.5rem;">尚有 '+pendingMem+' 份奏疏未批复</div>';
  // 检查是否有昏君活动选中
  var _hasTyActs = typeof TyrantActivitySystem !== 'undefined' && TyrantActivitySystem.selectedActivities && TyrantActivitySystem.selectedActivities.length > 0;
  var msg;
  if (empty && !_hasTyActs) {
    msg = '\u4ECA\u65E5\u65E0\u4E8B\uFF0C\u4E0D\u5982\u4F11\u606F\u4E00\u756A\uFF1F\u5929\u4E0B\u592A\u5E73\uFF0C\u4F55\u5FC5\u4E8B\u4E8B\u64CD\u5FC3\u3002';
  } else if (_hasTyActs && empty) {
    msg = '\u4E0D\u7406\u671D\u653F\uFF0C\u53EA\u987E\u4EAB\u4E50\u2014\u2014\u5982\u6B64\u751A\u597D\uFF01';
  } else {
    msg = '\u8BCF\u4EE4\u5DF2\u62DF\uFF0C\u662F\u5426\u9881\u884C\u5929\u4E0B\uFF1F';
  }
  var bg=document.createElement('div');
  bg.style.cssText='position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  bg.innerHTML='<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:14px;padding:2rem 2.2rem;max-width:400px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:modal-in 0.3s ease;">'+
    '<div style="font-size:1.3rem;color:var(--gold);margin-bottom:0.4rem;letter-spacing:0.15em;">⏳</div>'+
    '<div style="font-size:1rem;color:var(--txt);margin-bottom:0.8rem;line-height:1.6;">'+msg+'</div>'+
    warningHtml+
    '<div style="font-size:0.75rem;color:var(--txt-d);margin-bottom:1.2rem;">'+getTSText(GM.turn)+' → 第'+(GM.turn+1)+'回合</div>'+
    '<div style="display:flex;gap:0.8rem;justify-content:center;">'+
    '<button class="bt bp" id="cet-ok" style="padding:0.5rem 1.5rem;">颁行天下</button>'+
    '<button class="bt bs" id="cet-cancel" style="padding:0.5rem 1.5rem;">再斟酌</button>'+
    '</div></div>';
  document.body.appendChild(bg);
  bg.querySelector('#cet-cancel').onclick=function(){document.body.removeChild(bg);};
  bg.querySelector('#cet-ok').onclick=function(){document.body.removeChild(bg);endTurn();};
}

