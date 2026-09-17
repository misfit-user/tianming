// 地图集成模块 - 连接地图编辑器、剧本编辑器和游戏运行时
// 用于 index.html 和 editor.js

// 地图系统可配置常量（可通过P.mapConfig覆盖）
var MAP_DEFAULTS = {
  strategicMinNeighbors: 4,       // 战略要地最少邻接数
  strategicMinDevelopment: 70,    // 战略要地最低发展度
  maxStrategicRegions: 5,         // AI上下文中最多战略区域数
  developmentRange: [0, 100],     // 发展度范围
  terrainStrategicValues: { plains: 10, grassland: 8, hills: 5, forest: 5, mountains: 3, desert: 2, swamp: 1, water: 0 },
  terrainCombatModifiers: {
    plains: { cavalry: 1.2, infantry: 1.0, archer: 1.0 },
    hills: { cavalry: 0.8, infantry: 1.1, archer: 1.2 },
    mountains: { cavalry: 0.6, infantry: 1.2, archer: 1.1 },
    forest: { cavalry: 0.7, infantry: 1.1, archer: 0.9 },
    desert: { cavalry: 0.9, infantry: 0.8, archer: 1.0 },
    water: { cavalry: 0.5, infantry: 0.6, archer: 0.7 },
    grassland: { cavalry: 1.3, infantry: 0.9, archer: 1.0 },
    swamp: { cavalry: 0.5, infantry: 0.7, archer: 0.8 }
  },
  terrainMovementCosts: { plains: 1, grassland: 1, hills: 1.5, forest: 1.8, mountains: 2.5, desert: 2.0, swamp: 2.2, water: 3.0 }
};
/** 获取地图配置（优先剧本配置，回退默认值） */
function _mapCfg(key) { return (typeof P !== 'undefined' && P.mapConfig && P.mapConfig[key] !== undefined) ? P.mapConfig[key] : MAP_DEFAULTS[key]; }

// ============================================================
// 数据结构统一
// ============================================================

/**
 * 标准地图数据结构（scriptData.map 和 P.map 通用）
 * {
 *   width: number,
 *   height: number,
 *   regions: [
 *     {
 *       id: string,
 *       name: string,
 *       type: 'poly' | 'rect' | 'point',
 *       coords: number[],  // 多边形坐标 [x1,y1,x2,y2,...]
 *       center: [x, y],
 *       neighbors: string[],  // 邻接省份ID
 *
 *       // 地理属性
 *       terrain: 'plains' | 'hills' | 'mountains' | 'forest' | 'desert' | 'water' | 'grassland' | 'swamp',
 *       resources: string[],  // 资源列表
 *
 *       // 游戏数据
 *       owner: string,        // 所属势力ID
 *       characters: string[], // 驻守人物ID
 *       troops: number,       // 驻军数量
 *       development: number,  // 发展度 0-100
 *
 *       // 历史记录
 *       events: string,       // 历史事件
 *
 *       // 显示属性
 *       color: string
 *     }
 *   ]
 * }
 */

// ============================================================
// AI 地图理解系统
// ============================================================

/**
 * 为 AI 生成地图上下文
 * @param {Object} mapData - 地图数据
 * @param {Object} gameState - 游戏状态 (P 或 scriptData)
 * @returns {string} - AI 可理解的地图描述
 */
function generateMapContextForAI(mapData, gameState) {
    if (!mapData || !mapData.regions || mapData.regions.length === 0) {
        return '当前无地图数据。';
    }

    const regions = mapData.regions;
    const factions = gameState.factions || [];

    // 1. 地图总览
    let context = `【地图总览】\n`;
    context += `共有 ${regions.length} 个省份。\n\n`;

    // 2. 势力分布
    const factionTerritories = {};
    regions.forEach(r => {
        if (r.owner) {
            if (!factionTerritories[r.owner]) {
                factionTerritories[r.owner] = [];
            }
            factionTerritories[r.owner].push(r.name);
        }
    });

    context += `【势力分布】\n`;
    for (const [factionId, territories] of Object.entries(factionTerritories)) {
        const faction = factions.find(f => f.id === factionId || f.name === factionId);
        const factionName = faction ? faction.name : factionId;
        context += `${factionName}：控制 ${territories.length} 个省份（${territories.slice(0, 5).join('、')}${territories.length > 5 ? '等' : ''}）\n`;
    }
    context += `\n`;

    // 3. 战略要地
    context += `【战略要地】\n`;
    var _minN = _mapCfg('strategicMinNeighbors'), _minD = _mapCfg('strategicMinDevelopment'), _maxS = _mapCfg('maxStrategicRegions');
    const strategicRegions = regions
        .filter(r => r.neighbors.length >= _minN || r.development >= _minD)
        .sort((a, b) => b.neighbors.length - a.neighbors.length)
        .slice(0, _maxS);

    strategicRegions.forEach(r => {
        const owner = r.owner || '无主';
        context += `${r.name}（${owner}）：邻接 ${r.neighbors.length} 省，发展度 ${r.development}，驻军 ${r.troops}\n`;
    });
    context += `\n`;

    // 4. 边境冲突点
    context += `【边境形势】\n`;
    const borderConflicts = findBorderConflicts(regions);
    borderConflicts.slice(0, 5).forEach(conflict => {
        context += `${conflict.region1} (${conflict.owner1}) 与 ${conflict.region2} (${conflict.owner2}) 接壤\n`;
    });
    context += `\n`;

    // 5. 资源分布
    const resourceMap = {};
    regions.forEach(r => {
        r.resources.forEach(res => {
            if (!resourceMap[res]) resourceMap[res] = [];
            resourceMap[res].push(r.name);
        });
    });

    context += `【重要资源】\n`;
    for (const [resource, locations] of Object.entries(resourceMap)) {
        if (locations.length > 0) {
            context += `${resource}：${locations.slice(0, 3).join('、')}${locations.length > 3 ? '等' + locations.length + '处' : ''}\n`;
        }
    }

    return context;
}

/**
 * 查找边境冲突点
 */
function findBorderConflicts(regions) {
    const conflicts = [];

    regions.forEach(r1 => {
        if (!r1.owner) return;

        r1.neighbors.forEach(neighborId => {
            const r2 = regions.find(r => r.id === neighborId);
            if (r2 && r2.owner && r2.owner !== r1.owner) {
                // 避免重复
                const exists = conflicts.some(c =>
                    (c.region1 === r1.name && c.region2 === r2.name) ||
                    (c.region1 === r2.name && c.region2 === r1.name)
                );

                if (!exists) {
                    conflicts.push({
                        region1: r1.name,
                        owner1: r1.owner,
                        region2: r2.name,
                        owner2: r2.owner
                    });
                }
            }
        });
    });

    return conflicts;
}

/**
 * 生成省份详细信息（用于 AI 理解单个省份）
 */
function generateProvinceContextForAI(region, mapData) {
    if (!region) return '';

    let context = `【${region.name}】\n`;
    context += `所属：${region.owner || '无主'}\n`;
    context += `地形：${getTerrainName(region.terrain)}\n`;
    context += `资源：${region.resources.join('、') || '无'}\n`;
    context += `发展度：${region.development}/100\n`;
    context += `驻军：${region.troops}人\n`;

    // 邻接省份
    const neighbors = region.neighbors
        .map(nid => {
            const n = mapData.regions.find(r => r.id === nid);
            return n ? `${n.name}(${n.owner || '无主'})` : nid;
        })
        .join('、');
    context += `邻接：${neighbors}\n`;

    // 战略价值
    const strategicValue = calculateStrategicValue(region, mapData);
    context += `战略价值：${strategicValue}/100\n`;

    return context;
}

/**
 * 计算省份战略价值
 */
function calculateStrategicValue(region, mapData) {
    let value = 0;

    // 发展度贡献
    value += region.development * 0.3;

    // 邻接省份数量（交通枢纽）
    value += Math.min(region.neighbors.length * 5, 30);

    // 资源价值
    value += region.resources.length * 5;

    // 地形加成（从配置读取）
    var terrainBonus = _mapCfg('terrainStrategicValues');
    value += terrainBonus[region.terrain] || 0;

    return Math.min(Math.round(value), 100);
}

/**
 * 获取地形中文名
 */
function getTerrainName(terrain) {
    const names = {
        'plains': '平原',
        'hills': '丘陵',
        'mountains': '山地',
        'forest': '森林',
        'desert': '沙漠',
        'water': '水域',
        'grassland': '草原',
        'swamp': '沼泽'
    };
    return names[terrain] || terrain;
}

// ============================================================
// 地图影响游戏逻辑
// ============================================================

/**
 * 计算地形对战斗的影响
 */
function getTerrainCombatModifier(terrain, attackerType) {
    var modifiers = _mapCfg('terrainCombatModifiers');
    return (modifiers[terrain] && modifiers[terrain][attackerType]) || 1.0;
}

/**
 * 计算两省份间的距离（用于补给和移动）
 */
function calculateDistance(region1, region2) {
    if (!region1.center || !region2.center) return Infinity;

    const c1 = Array.isArray(region1.center) ? region1.center : [region1.center.x, region1.center.y];
    const c2 = Array.isArray(region2.center) ? region2.center : [region2.center.x, region2.center.y];
    const dx = c1[0] - c2[0];
    const dy = c1[1] - c2[1];
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算移动路径（考虑地形）
 */
function calculateMovementCost(path, mapData) {
    let totalCost = 0;

    const terrainCosts = {
        'plains': 1,
        'grassland': 1,
        'hills': 1.5,
        'forest': 1.8,
        'mountains': 2.5,
        'desert': 2.0,
        'swamp': 2.2,
        'water': 3.0
    };

    path.forEach(regionId => {
        const region = mapData.regions.find(r => r.id === regionId);
        if (region) {
            totalCost += terrainCosts[region.terrain] || 1;
        }
    });

    return totalCost;
}

/**
 * 检查省份是否可以补给
 */
function canSupply(fromRegion, toRegion, mapData) {
    // 必须是同一势力
    if (fromRegion.owner !== toRegion.owner) return false;

    // 必须连通（通过 A* 或 BFS 检查）
    const path = _miFindPath(fromRegion.id, toRegion.id, mapData, fromRegion.owner);
    return path.length > 0;
}

/**
 * 简单路径查找（只经过己方领土）—— 与 tm-map-system.js findPath 冲突，已改名为内部函数
 */
function _miFindPath(startId, endId, mapData, owner) {
    const visited = new Set();
    const queue = [[startId]];

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        if (current === endId) return path;
        if (visited.has(current)) continue;
        visited.add(current);

        const region = mapData.regions.find(r => r.id === current);
        if (!region) continue;

        region.neighbors.forEach(neighborId => {
            const neighbor = mapData.regions.find(r => r.id === neighborId);
            if (neighbor && neighbor.owner === owner && !visited.has(neighborId)) {
                queue.push([...path, neighborId]);
            }
        });
    }

    return [];
}

// ============================================================
// AI 推演更新地图
// ============================================================

/**
 * 解析 AI 返回的地图变化
 * @param {Object} aiResponse - AI 返回的结构化数据
 * @param {Object} mapData - 当前地图数据
 */
function applyAIMapChanges(aiResponse, mapData) {
    if (!aiResponse.map_changes) return;

    if (typeof TMMapRuntime !== 'undefined' && TMMapRuntime && typeof TMMapRuntime.applyAIMapChanges === 'function') {
        // TMMapRuntime owns the live GM map.  Do not forward legacy P.map
        // references, which are immutable scenario templates after game start.
        TMMapRuntime.applyAIMapChanges(aiResponse);
        return;
    }

    const changes = aiResponse.map_changes;

    // 1. 省份所属变化（战争、外交）
    if (changes.ownership_changes) {
        changes.ownership_changes.forEach(change => {
            const region = mapData.regions.find(r => r.id === change.region_id || r.name === change.region_name);
            if (region) {
                region.owner = change.new_owner;
                region.events += `\n${change.reason || '势力变更'}`;
            }
        });
    }

    // 2. 驻军变化
    if (changes.troop_changes) {
        changes.troop_changes.forEach(change => {
            const region = mapData.regions.find(r => r.id === change.region_id || r.name === change.region_name);
            if (region) {
                region.troops = Math.max(0, (region.troops || 0) + change.delta);
            }
        });
    }

    // 3. 发展度变化
    if (changes.development_changes) {
        changes.development_changes.forEach(change => {
            const region = mapData.regions.find(r => r.id === change.region_id || r.name === change.region_name);
            if (region) {
                region.development = Math.max(0, Math.min(100, (region.development || 50) + change.delta));
            }
        });
    }

    // 4. 历史事件记录
    if (changes.events) {
        changes.events.forEach(event => {
            const region = mapData.regions.find(r => r.id === event.region_id || r.name === event.region_name);
            if (region) {
                region.events += `\n${event.description}`;
            }
        });
    }
}

/**
 * 为 AI 提示词添加地图影响规则
 */
function getMapInfluenceRules() {
    return `
【地图影响规则】
1. 地形影响战斗：
   - 平原利于骑兵，山地利于步兵防守
   - 森林和丘陵利于弓箭手
   - 沙漠和沼泽不利于所有兵种

2. 距离影响补给：
   - 远离本土的军队补给困难
   - 跨越敌对领土无法补给
   - 山地和沙漠增加补给成本

3. 邻接关系影响外交：
   - 接壤势力更容易发生冲突
   - 战略要地（多邻接）更易成为争夺焦点

4. 资源影响经济：
   - 粮食影响军队维持
   - 铁矿影响武器生产
   - 马匹影响骑兵数量

5. 发展度影响收入：
   - 高发展度省份提供更多税收
   - 战争会降低发展度
   - 和平时期发展度缓慢恢复
`;
}

// 导出函数（用于 index.html 和 editor.js）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateMapContextForAI,
        generateProvinceContextForAI,
        getTerrainCombatModifier,
        calculateDistance,
        calculateMovementCost,
        canSupply,
        applyAIMapChanges,
        getMapInfluenceRules
    };
}
