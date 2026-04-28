// 游戏内地图显示组件
// 用于 index.html 中显示地图

// ============================================================
// 简化地图渲染器（用于游戏内显示）
// ============================================================

/**
 * 在游戏中显示地图
 * @param {string} containerId - 容器元素ID
 * @param {Object} mapData - 地图数据 (P.map)
 * @param {Object} options - 显示选项
 */
function renderGameMap(containerId, mapData, options) {
    options = options || {};
    const container = document.getElementById(containerId);
    if (!container || !mapData || !mapData.regions) return;

    // 创建 Canvas
    let canvas = container.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.cursor = 'pointer';
        container.appendChild(canvas);
    }

    const width = options.width || mapData.width || 800;
    const height = options.height || mapData.height || 600;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    // 清空画布
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // 绘制省份
    mapData.regions.forEach(function(region) {
        if (!region.coords || region.coords.length < 6) return;
        var _isBorder = false; // 提前声明，避免依赖var hoisting

        // 重建多边形
        const polygon = [];
        for (let i = 0; i < region.coords.length; i += 2) {
            polygon.push([region.coords[i], region.coords[i + 1]]);
        }

        if (polygon.length < 3) return;

        // 绘制填充
        ctx.beginPath();
        ctx.moveTo(polygon[0][0], polygon[0][1]);
        for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i][0], polygon[i][1]);
        }
        ctx.closePath();

        // 根据显示模式选择颜色
        const mode = options.displayMode || 'owner';
        if (mode === 'owner') {
            // 2.4: 优先从GM.facs获取势力颜色
            var _ownerColor = region.color || '#666666';
            if (region.owner && typeof GM !== 'undefined' && GM.facs) {
                var _ownerFac = GM.facs.find(function(f){return f.name === region.owner;});
                if (_ownerFac && _ownerFac.color) _ownerColor = _ownerFac.color;
            }
            // 判断是否为边境（与不同势力相邻）
            _isBorder = false;
            if (region.adjacent && typeof GM !== 'undefined') {
                var _adjNames = (typeof region.adjacent === 'string') ? region.adjacent.split(',') : (region.adjacent || []);
                _adjNames.forEach(function(adj) {
                    var _adjRegion = mapData.regions.find(function(r){return r.name === adj.trim() || r.id === adj.trim();});
                    if (_adjRegion && _adjRegion.owner && _adjRegion.owner !== region.owner) _isBorder = true;
                });
            }
            ctx.fillStyle = _ownerColor;
        } else if (mode === 'development') {
            const dev = region.development || 50;
            const hue = (dev / 100) * 120;
            ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;
        } else if (mode === 'troops') {
            const troops = region.troops || 0;
            const maxTroops = Math.max(...mapData.regions.map(r => r.troops || 0), 1);
            const intensity = Math.min(troops / maxTroops, 1);
            const r = Math.floor(200 * intensity);
            const b = Math.floor(200 * (1 - intensity));
            ctx.fillStyle = `rgb(${r}, 0, ${b})`;
        }

        ctx.fill();

        // 绘制边界（边境线加粗）
        ctx.strokeStyle = _isBorder ? '#ff6600' : '#444444';
        ctx.lineWidth = _isBorder ? 2 : 1;
        if (_isBorder) ctx.setLineDash([4, 2]); else ctx.setLineDash([]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 绘制省份名称（可选）
        if (options.showLabels && region.center) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(region.name, region.center[0], region.center[1]);
        }
    });

    // 2.4: 绘制军队位置标记
    if (typeof GM !== 'undefined' && GM.armies) {
        GM.armies.forEach(function(army) {
            if (!army.location) return;
            // 查找军队所在区域的中心点
            var _armyRegion = mapData.regions.find(function(r){return r.name === army.location || r.id === army.location;});
            if (!_armyRegion || !_armyRegion.center) return;
            var ax = _armyRegion.center[0], ay = _armyRegion.center[1];
            // 军队标记（小旗帜图标）
            var _armyColor = '#fff';
            if (army.faction && GM.facs) {
                var _af = GM.facs.find(function(f){return f.name===army.faction;});
                if (_af && _af.color) _armyColor = _af.color;
            }
            ctx.save();
            ctx.fillStyle = _armyColor;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            // 画一个小三角旗
            ctx.beginPath();
            ctx.moveTo(ax, ay - 8);
            ctx.lineTo(ax + 6, ay - 4);
            ctx.lineTo(ax, ay);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 旗杆
            ctx.beginPath();
            ctx.moveTo(ax, ay - 8);
            ctx.lineTo(ax, ay + 4);
            ctx.strokeStyle = _armyColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
            // 兵力数字
            var _armySoldiers = army.soldiers || army.strength || 0;
            if (_armySoldiers) {
                ctx.fillStyle = '#fff';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText((_armySoldiers >= 10000 ? Math.round(_armySoldiers/10000)+'\u4E07' : _armySoldiers), ax, ay + 14);
            }
        });
    }

    // 添加点击事件
    canvas.onclick = function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (width / rect.width);
        const y = (e.clientY - rect.top) * (height / rect.height);

        // 查找点击的省份
        const region = findRegionAtPoint(x, y, mapData);
        if (region && options.onProvinceClick) {
            options.onProvinceClick(region);
        }
    };
}

/**
 * 查找点击位置的省份
 */
function findRegionAtPoint(x, y, mapData) {
    for (let i = 0; i < mapData.regions.length; i++) {
        const region = mapData.regions[i];
        if (!region.coords || region.coords.length < 6) continue;

        // 重建多边形
        const polygon = [];
        for (let j = 0; j < region.coords.length; j += 2) {
            polygon.push([region.coords[j], region.coords[j + 1]]);
        }

        // 点在多边形内检测
        if (pointInPolygon(x, y, polygon)) {
            return region;
        }
    }
    return null;
}

/**
 * 点在多边形内检测（射线法）
 */
function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * 显示省份详情面板
 */
function showProvinceDetails(region) {
    // 2.4: 增加provinceStats经济数据和驻地角色
    var _provStats = '';
    if (typeof GM !== 'undefined' && GM.provinceStats && GM.provinceStats[region.name]) {
        var ps = GM.provinceStats[region.name];
        _provStats = '<div style="margin-top:8px; padding-top:8px; border-top:1px solid #444;">' +
            '<strong>\u7ECF\u6D4E\u6570\u636E</strong>' +
            '<div>\u4EBA\u53E3\uFF1A' + ((ps.population||0) >= 10000 ? Math.round((ps.population||0)/10000)+'\u4E07' : (ps.population||0)) + '</div>' +
            '<div>\u7E41\u8363\u5EA6\uFF1A' + Math.round(ps.prosperity||50) + '/100</div>' +
            '<div>\u7A0E\u6536\uFF1A' + Math.round(ps.taxRevenue||0) + '</div>' +
            (ps.governor ? '<div>\u592A\u5B88\uFF1A' + ps.governor + '</div>' : '') +
            '</div>';
    }
    // 驻地角色
    var _localChars = '';
    if (typeof GM !== 'undefined' && GM.chars) {
        var _lc = GM.chars.filter(function(c){return c.alive!==false && _isSameLocation(c.location, region.name);});
        if (_lc.length > 0) {
            _localChars = '<div style="margin-top:4px;"><strong>\u9A7B\u5730\u4EBA\u7269\uFF1A</strong>' + _lc.map(function(c){return c.name;}).join('\u3001') + '</div>';
        }
    }
    var _resources = '';
    try { _resources = region.resources ? (Array.isArray(region.resources) ? region.resources.join('\u3001') : region.resources) : '\u65E0'; } catch(e) { _resources = '\u65E0'; }

    const html = `
        <div style="background:#2a2a2a; border:1px solid #444; border-radius:8px; padding:16px; color:#e0e0e0;">
            <h3 style="margin:0 0 12px 0; color:#ffd700;">${region.name}</h3>
            <div style="font-size:13px; line-height:1.8;">
                <div><strong>\u6240\u5C5E\uFF1A</strong>${region.owner || '\u65E0\u4E3B'}</div>
                <div><strong>\u5730\u5F62\uFF1A</strong>${getTerrainName(region.terrain)}</div>
                <div><strong>\u8D44\u6E90\uFF1A</strong>${_resources}</div>
                <div><strong>\u53D1\u5C55\u5EA6\uFF1A</strong>${region.development || 50}/100</div>
                <div><strong>\u9A7B\u519B\uFF1A</strong>${region.troops || 0}\u4EBA</div>
                ${region.characters && region.characters.length > 0 ?
                    `<div><strong>\u9A7B\u5B88\u4EBA\u7269\uFF1A</strong>${region.characters.join('\u3001')}</div>` : ''}
                ${_localChars}
                ${_provStats}
                ${region.events ? `<div style="margin-top:8px; padding-top:8px; border-top:1px solid #444;">
                    <strong>\u5386\u53F2\uFF1A</strong><br>${region.events.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
        </div>
    `;
    return html;
}

/**
 * 在游戏主界面显示地图
 */
function showMapInGame() {
    // R107·AI 地理志模式 P.map.enabled===false 时直接归为无数据·占位提示
    var isAIGeo = (P.map && P.map.enabled === false) || (typeof GM !== 'undefined' && GM._useAIGeo === true);
    var hasMapData = !isAIGeo && P.map && P.map.regions && P.map.regions.length > 0;

    // 2.4方案B：无数据时显示占位提示而非alert
    if (!hasMapData) {
        var _placeholder = document.createElement('div');
        _placeholder.id = 'game-map-overlay';
        _placeholder.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
            '<div style="text-align:center;max-width:400px;padding:2rem;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;opacity:0.3;">\uD83D\uDDFA</div>' +
            '<div style="font-size:1.2rem;color:var(--gold-400,#c9a849);margin-bottom:0.8rem;">\u5730\u56FE\u5C1A\u672A\u7ED8\u5236</div>' +
            '<div style="font-size:0.85rem;color:var(--color-foreground-muted,#888);line-height:1.8;margin-bottom:1.5rem;">' +
            '\u5F53\u524D\u5267\u672C\u672A\u914D\u7F6E\u5730\u56FE\u6570\u636E\u3002<br>\u5267\u672C\u4F5C\u8005\u53EF\u5728\u7F16\u8F91\u5668\u4E2D\u7ED8\u5236\u884C\u653F\u533A\u5212\u5730\u56FE\uFF0C<br>\u5C4A\u65F6\u5C06\u5728\u6B64\u5C55\u793A\u52BF\u529B\u5206\u5E03\u3001\u519B\u961F\u4F4D\u7F6E\u7B49\u4FE1\u606F\u3002</div>' +
            '<button onclick="closeGameMap()" style="padding:0.5rem 2rem;background:var(--gold-500,#c9a849);color:var(--ink-900,#1a1a1a);border:none;border-radius:6px;font-size:0.9rem;cursor:pointer;font-weight:700;">\u77E5\u9053\u4E86</button>' +
            '</div></div>';
        document.body.appendChild(_placeholder);
        return;
    }

    const html = `
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column;">
            <div style="padding:16px; background:#1a1a1a; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; color:#ffd700;">地图总览</h2>
                <div style="display:flex; gap:12px; align-items:center;">
                    <select id="game-map-mode" style="padding:6px 12px; background:#2a2a2a; border:1px solid #444; color:#e0e0e0; border-radius:4px;">
                        <option value="owner">势力分布</option>
                        <option value="development">发展度</option>
                        <option value="troops">驻军分布</option>
                    </select>
                    <label style="display:flex; align-items:center; gap:6px; color:#e0e0e0; font-size:13px;">
                        <input type="checkbox" id="game-map-labels">
                        显示省份名
                    </label>
                    <button onclick="closeGameMap()" style="padding:6px 16px; background:#c0392b; border:none; color:#fff; border-radius:4px; cursor:pointer;">关闭</button>
                </div>
            </div>
            <div style="flex:1; display:flex; overflow:hidden;">
                <div id="game-map-canvas" style="flex:1; position:relative;"></div>
                <div id="game-map-info" style="width:300px; background:#1a1a1a; border-left:1px solid #444; padding:16px; overflow-y:auto;">
                    <div style="color:#888; font-size:13px;">点击省份查看详情</div>
                </div>
            </div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'game-map-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 渲染地图
    function updateMap() {
        const mode = document.getElementById('game-map-mode').value;
        const showLabels = document.getElementById('game-map-labels').checked;

        renderGameMap('game-map-canvas', P.map, {
            displayMode: mode,
            showLabels: showLabels,
            onProvinceClick: function(region) {
                document.getElementById('game-map-info').innerHTML = showProvinceDetails(region);
            }
        });
    }

    updateMap();

    // 绑定事件
    document.getElementById('game-map-mode').onchange = updateMap;
    document.getElementById('game-map-labels').onchange = updateMap;

    // 多重退出机制：ESC 键 + 点击遮罩背景
    window._mapEscHandler = function(e){
        if (e.key === 'Escape' || e.key === 'Esc') closeGameMap();
    };
    document.addEventListener('keydown', window._mapEscHandler);
    // 点击遮罩黑色背景（不是内容区）关闭
    overlay.addEventListener('click', function(e){
        // 如果点在顶层 overlay（没点到子面板），就关闭
        if (e.target && e.target.id === 'game-map-overlay') closeGameMap();
    });
}

/**
 * 关闭游戏地图
 */
function closeGameMap() {
    const overlay = document.getElementById('game-map-overlay');
    if (overlay) {
        // 使用 .remove() 不依赖 parentNode 必为 document.body（防御 DOM 被移动）
        if (overlay.remove) overlay.remove();
        else if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    // 解绑 ESC
    if (window._mapEscHandler) {
        document.removeEventListener('keydown', window._mapEscHandler);
        window._mapEscHandler = null;
    }
}

// 导出函数
if (typeof window !== 'undefined') {
    window.renderGameMap = renderGameMap;
    window.showMapInGame = showMapInGame;
    window.closeGameMap = closeGameMap;
    window.showProvinceDetails = showProvinceDetails;
}
