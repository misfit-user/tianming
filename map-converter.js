// 地图格式转换器
// 连接 Leaflet 编辑器和游戏系统

// ============================================================
// Leaflet GeoJSON <-> 游戏格式转换
// ============================================================

/**
 * 将 Leaflet 编辑器导出的游戏格式转换为标准游戏地图格式
 * @param {Object} leafletData - Leaflet 编辑器导出的数据
 * @returns {Object} - 标准游戏地图格式
 */
function convertLeafletToGame(leafletData) {
    const gameMap = {
        name: leafletData.name || '\u65b0\u5730\u56fe',
        width: leafletData.width || 1200,
        height: leafletData.height || 800,
        regions: []
    };

    if (!leafletData.regions) {
        return gameMap;
    }

    leafletData.regions.forEach(function(region) {
        // Leaflet 使用 [lng, lat] 格式，游戏使用 [x, y] 格式
        // 在 CRS.Simple 模式下，lng=x, lat=y
        const gameRegion = {
            id: region.id,
            name: region.name,
            type: 'poly',
            coords: region.coords || [],
            center: region.center || null,
            neighbors: region.neighbors || [],

            // 地理属性
            terrain: region.terrain || 'plains',
            resources: region.resources || [],

            // 游戏数据
            owner: region.owner || '',
            characters: region.characters || [],
            troops: region.troops || 0,
            development: region.development || 50,

            // 历史记录
            events: region.events || '',

            // 显示属性
            color: region.color || '#666666'
        };

        gameMap.regions.push(gameRegion);
    });

    return gameMap;
}

/**
 * 将游戏地图格式转换为 Leaflet GeoJSON 格式
 * @param {Object} gameMap - 游戏地图数据
 * @returns {Object} - GeoJSON FeatureCollection
 */
function convertGameToGeoJSON(gameMap) {
    const geojson = {
        type: 'FeatureCollection',
        features: []
    };

    if (!gameMap.regions) {
        return geojson;
    }

    gameMap.regions.forEach(function(region) {
        // 将坐标数组转换为 GeoJSON 多边形格式
        const coordinates = [];
        for (let i = 0; i < region.coords.length; i += 2) {
            coordinates.push([region.coords[i], region.coords[i + 1]]);
        }
        // 闭合多边形
        if (coordinates.length > 0) {
            coordinates.push(coordinates[0]);
        }

        const feature = {
            type: 'Feature',
            properties: {
                id: region.id,
                name: region.name,
                terrain: region.terrain,
                owner: region.owner,
                color: region.color,
                resources: region.resources,
                development: region.development,
                troops: region.troops,
                characters: region.characters,
                neighbors: region.neighbors,
                events: region.events
            },
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
            }
        };

        geojson.features.push(feature);
    });

    return geojson;
}

/**
 * 将 Voronoi 地图编辑器格式转换为新的游戏格式
 * @param {Object} voronoiMap - 旧的 Voronoi 地图数据
 * @returns {Object} - 标准游戏地图格式
 */
function convertVoronoiToGame(voronoiMap) {
    const gameMap = {
        name: voronoiMap.name || '\u65b0\u5730\u56fe',
        width: voronoiMap.width || 1200,
        height: voronoiMap.height || 800,
        regions: []
    };

    if (!voronoiMap.provinces) {
        return gameMap;
    }

    voronoiMap.provinces.forEach(function(province) {
        // 将多边形坐标展平
        const coords = [];
        if (province.polygon) {
            province.polygon.forEach(function(point) {
                coords.push(point[0], point[1]);
            });
        }

        const gameRegion = {
            id: province.id,
            name: province.name,
            type: 'poly',
            coords: coords,
            center: province.center || null,
            neighbors: province.neighbors || [],

            terrain: province.terrain || 'plains',
            resources: province.resources || [],

            owner: province.owner || '',
            characters: province.characters || [],
            troops: province.troops || 0,
            development: province.development || 50,

            events: province.events || '',
            color: province.color || '#666666'
        };

        gameMap.regions.push(gameRegion);
    });

    return gameMap;
}

/**
 * 加载地图到 scriptData (editor.js)
 * @param {Object} mapData - 地图数据
 */
function loadMapToScriptData(mapData) {
    if (typeof scriptData === 'undefined') {
        console.error('scriptData \u4e0d\u5b58\u5728\uff0c\u8bf7\u5728 editor.js \u4e2d\u4f7f\u7528');
        return;
    }

    scriptData.map = convertLeafletToGame(mapData);
    console.log('\u5730\u56fe\u5df2\u52a0\u8f7d\u5230 scriptData.map');
}

/**
 * 加载地图到游戏运行时 (index.html)
 * @param {Object} mapData - 地图数据
 */
function loadMapToGame(mapData) {
    if (typeof P === 'undefined') {
        console.error('P \u4e0d\u5b58\u5728\uff0c\u8bf7\u5728 index.html \u4e2d\u4f7f\u7528');
        return;
    }

    P.map = convertLeafletToGame(mapData);
    console.log('\u5730\u56fe\u5df2\u52a0\u8f7d\u5230 P.map');

    // 如果有地图显示函数，刷新显示
    if (typeof renderGameMap === 'function') {
        // 这里可以调用地图显示函数
        console.log('\u53ef\u4ee5\u8c03\u7528 renderGameMap() \u663e\u793a\u5730\u56fe');
    }
}

/**
 * 从 URL 加载地图文件
 * @param {string} url - 地图文件 URL
 * @param {Function} callback - 加载完成回调
 */
function loadMapFromURL(url, callback) {
    fetch(url)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            // 自动检测格式并转换
            let gameMap;
            if (data.type === 'FeatureCollection') {
                // GeoJSON 格式
                gameMap = convertGeoJSONToGame(data);
            } else if (data.provinces) {
                // Voronoi 格式
                gameMap = convertVoronoiToGame(data);
            } else if (data.regions) {
                // 已经是游戏格式
                gameMap = data;
            } else {
                throw new Error('\u672a\u77e5\u7684\u5730\u56fe\u683c\u5f0f');
            }

            if (callback) {
                callback(gameMap);
            }
        })
        .catch(function(error) {
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(error, 'u52a0u8f7du5730u56feu5931u8d25') : console.error('\u52a0\u8f7d\u5730\u56fe\u5931\u8d25:', error);
            alert('\u52a0\u8f7d\u5730\u56fe\u5931\u8d25: ' + error.message);
        });
}

/**
 * 将 GeoJSON 转换为游戏格式
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @returns {Object} - 游戏地图格式
 */
function convertGeoJSONToGame(geojson) {
    const gameMap = {
        name: '\u5bfc\u5165\u7684\u5730\u56fe',
        width: 1200,
        height: 800,
        regions: []
    };

    if (!geojson.features) {
        return gameMap;
    }

    geojson.features.forEach(function(feature) {
        const props = feature.properties || {};
        const geometry = feature.geometry;

        if (geometry.type !== 'Polygon') {
            return; // 只支持多边形
        }

        // 提取坐标
        const coords = [];
        const coordinates = geometry.coordinates[0]; // 外环
        coordinates.forEach(function(coord) {
            coords.push(coord[0], coord[1]);
        });

        // 计算中心点
        let centerX = 0, centerY = 0;
        coordinates.forEach(function(coord) {
            centerX += coord[0];
            centerY += coord[1];
        });
        centerX /= coordinates.length;
        centerY /= coordinates.length;

        const gameRegion = {
            id: props.id || 'region_' + Date.now() + '_' + Math.random(),
            name: props.name || '\u672a\u547d\u540d',
            type: 'poly',
            coords: coords,
            center: [centerX, centerY],
            neighbors: props.neighbors || [],

            terrain: props.terrain || 'plains',
            resources: props.resources || [],

            owner: props.owner || '',
            characters: props.characters || [],
            troops: props.troops || 0,
            development: props.development || 50,

            events: props.events || '',
            color: props.color || '#666666'
        };

        gameMap.regions.push(gameRegion);
    });

    return gameMap;
}

// ============================================================
// 地图数据验证
// ============================================================

/**
 * 验证地图数据完整性
 * @param {Object} mapData - 地图数据
 * @returns {Object} - 验证结果 { valid: boolean, errors: string[] }
 */
function validateMapData(mapData) {
    const errors = [];

    if (!mapData) {
        errors.push('\u5730\u56fe\u6570\u636e\u4e3a\u7a7a');
        return { valid: false, errors: errors };
    }

    if (!mapData.regions || !Array.isArray(mapData.regions)) {
        errors.push('\u7f3a\u5c11 regions \u6570\u7ec4');
        return { valid: false, errors: errors };
    }

    if (mapData.regions.length === 0) {
        errors.push('\u5730\u56fe\u4e3a\u7a7a\uff0c\u6ca1\u6709\u7701\u4efd');
    }

    // 检查每个省份
    const ids = new Set();
    const names = new Set();

    mapData.regions.forEach(function(region, index) {
        const prefix = `\u7701\u4efd #${index + 1}`;

        if (!region.id) {
            errors.push(`${prefix}: \u7f3a\u5c11 id`);
        } else if (ids.has(region.id)) {
            errors.push(`${prefix}: \u91cd\u590d\u7684 id: ${region.id}`);
        } else {
            ids.add(region.id);
        }

        if (!region.name) {
            errors.push(`${prefix}: \u7f3a\u5c11 name`);
        } else if (names.has(region.name)) {
            errors.push(`${prefix}: \u91cd\u590d\u7684\u540d\u79f0: ${region.name}`);
        } else {
            names.add(region.name);
        }

        if (!region.coords || region.coords.length < 6) {
            errors.push(`${prefix} (${region.name}): \u5750\u6807\u6570\u636e\u4e0d\u8db3`);
        }

        if (!region.terrain) {
            errors.push(`${prefix} (${region.name}): \u7f3a\u5c11\u5730\u5f62\u7c7b\u578b`);
        }
    });

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// ============================================================
// 导出函数
// ============================================================

if (typeof window !== 'undefined') {
    window.convertLeafletToGame = convertLeafletToGame;
    window.convertGameToGeoJSON = convertGameToGeoJSON;
    window.convertVoronoiToGame = convertVoronoiToGame;
    window.convertGeoJSONToGame = convertGeoJSONToGame;
    window.loadMapToScriptData = loadMapToScriptData;
    window.loadMapToGame = loadMapToGame;
    window.loadMapFromURL = loadMapFromURL;
    window.validateMapData = validateMapData;
}
