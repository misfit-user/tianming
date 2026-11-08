// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   行政区划模块（独立编辑工具 editor.js 家族·全局 scriptData）
//   §1 行政层级树状图系统（按势力管理）· CK3 式交互树可视化
//   §2 地图归属映射系统
//   §M5 层级权力检查 · §M6 治所联动 · §M7 法理领地检查
//   入口  aiGenerateAdminHierarchy / _editorAiGenerateAdminHierarchy
// ─────────────────────────────────────────────
/**
 * 行政区划模块
 * 第一部分：行政层级树状图系统（按势力管理）
 * 第二部分：地图归属映射系统
 */

// 当前选中的势力ID
var _currentAdminFactionId = 'player';

// 初始化行政区划数据结构
if (!scriptData.adminHierarchy) {
  scriptData.adminHierarchy = {};
}

// 为玩家势力初始化
if (!scriptData.adminHierarchy.player) {
  scriptData.adminHierarchy.player = {
    name: '玩家势力行政区划',
    description: '玩家势力的行政层级结构',
    divisions: []
  };
}

// 行政区划树状图状态（使用与官制树相同的结构）
var _adminTree = {
  scale: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  collapsed: {},  // path-string -> true
  NODE_W: 180,
  NODE_GAP_X: 24,
  NODE_GAP_Y: 60,
  ROOT_EXTRA_Y: 30
};

// 获取当前势力的行政区划数据
function getCurrentAdminHierarchy() {
  if (!scriptData.adminHierarchy[_currentAdminFactionId]) {
    var factionName = '未知势力';
    if (_currentAdminFactionId === 'player') {
      factionName = '玩家势力';
    } else {
      var faction = scriptData.factions ? scriptData.factions.find(function(f) { return f.id === _currentAdminFactionId; }) : null;
      if (faction) factionName = faction.name;
    }
    scriptData.adminHierarchy[_currentAdminFactionId] = {
      name: factionName + '行政区划',
      description: factionName + '的行政层级结构',
      divisions: []
    };
  }
  return scriptData.adminHierarchy[_currentAdminFactionId];
}

function _adminBuildOfficialPositionOptions(selectedTitle) {
  var options = '<option value="">无</option>';
  var tree = scriptData.government && scriptData.government.officeTree;
  if (!tree) return options;

  var stack = [tree];
  while (stack.length) {
    var node = stack.pop();
    if (!node) continue;
    if (node.positions) {
      for (var i = 0; i < node.positions.length; i++) {
        var pos = node.positions[i];
        var title = pos && pos.title;
        var selected = (selectedTitle && selectedTitle === title) ? ' selected' : '';
        options += '<option value="' + title + '"' + selected + '>' + title + '</option>';
      }
    }
    if (node.departments) {
      for (var j = node.departments.length - 1; j >= 0; j--) {
        stack.push(node.departments[j]);
      }
    }
  }
  return options;
}

function _adminCollectLeafDivisionEntries(divs, parentPath) {
  var out = [];
  var stack = [];
  divs = divs || [];
  for (var i = divs.length - 1; i >= 0; i--) {
    stack.push({ division: divs[i], path: parentPath ? parentPath + ' > ' + divs[i].name : divs[i].name });
  }
  while (stack.length) {
    var item = stack.pop();
    var d = item.division;
    if (!d.children || d.children.length === 0) {
      out.push(item);
    } else {
      for (var j = d.children.length - 1; j >= 0; j--) {
        var child = d.children[j];
        stack.push({ division: child, path: item.path ? item.path + ' > ' + child.name : child.name });
      }
    }
  }
  return out;
}

function _adminFindDivisionIn(divs, divId) {
  var stack = (divs || []).slice().reverse();
  while (stack.length) {
    var d = stack.pop();
    if (!d) continue;
    if (d.id === divId) return d;
    if (d.children) {
      for (var i = d.children.length - 1; i >= 0; i--) {
        stack.push(d.children[i]);
      }
    }
  }
  return null;
}

// 切换势力
function switchAdminFaction(factionId) {
  _currentAdminFactionId = factionId;
  renderAdminTree();
  updateAdminStats();
}

// 更新势力选择器
function updateAdminFactionSelector() {
  var selector = document.getElementById('admin-faction-selector');
  if (!selector) return;

  var html = '<option value="player">玩家势力</option>';
  if (scriptData.factions) {
    for (var i = 0; i < scriptData.factions.length; i++) {
      var f = scriptData.factions[i];
      if (!f.id) f.id = 'faction_' + i;
      html += '<option value="' + f.id + '">' + f.name + '</option>';
    }
  }
  selector.innerHTML = html;
  selector.value = _currentAdminFactionId;
}

// 页面加载完成后自动初始化
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        if (typeof initAdministrationPanel === 'function') {
          initAdministrationPanel();
        }
      }, 100);
    });
  } else {
    setTimeout(function() {
      if (typeof initAdministrationPanel === 'function') {
        initAdministrationPanel();
      }
    }, 100);
  }
}

// 切换行政区划标签页
function switchAdminTab(tabName) {
  // 更新标签按钮状态
  var tabs = document.querySelectorAll('.admin-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  var activeTab = document.querySelector('.admin-tab[data-tab="' + tabName + '"]');
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // 显示对应内容
  var contents = document.querySelectorAll('.admin-tab-content');
  for (var i = 0; i < contents.length; i++) {
    contents[i].style.display = 'none';
  }
  var activeContent = document.getElementById('admin-tab-' + tabName);
  if (activeContent) {
    activeContent.style.display = 'block';
  }

  // 刷新对应内容
  if (tabName === 'hierarchy') {
    renderAdminTree();
  } else if (tabName === 'mapping') {
    renderMappingList();
  }
}

// 更新统计数据
function updateAdminStats() {
  var adminHierarchy = getCurrentAdminHierarchy();

  // 计算行政单位总数和各级别数量
  var divisionCount = 0;
  var levelCounts = {
    country: 0,
    province: 0,
    prefecture: 0,
    county: 0,
    district: 0
  };
  var governorCount = 0;
  var mappedRegionCount = 0;

  function countDivisions(node) {
    divisionCount++;
    if (node.level) {
      levelCounts[node.level] = (levelCounts[node.level] || 0) + 1;
    }
    if (node.governor) {
      governorCount++;
    }
    if (node.mappedRegions && node.mappedRegions.length > 0) {
      mappedRegionCount += node.mappedRegions.length;
    }
    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        countDivisions(node.children[i]);
      }
    }
  }
  for (var i = 0; i < adminHierarchy.divisions.length; i++) {
    countDivisions(adminHierarchy.divisions[i]);
  }

  // 计算层级深度
  var maxDepth = 0;
  function getDepth(node, depth) {
    maxDepth = Math.max(maxDepth, depth);
    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        getDepth(node.children[i], depth + 1);
      }
    }
  }
  for (var i = 0; i < adminHierarchy.divisions.length; i++) {
    getDepth(adminHierarchy.divisions[i], 1);
  }

  var regionCount = scriptData.map && scriptData.map.regions ? scriptData.map.regions.length : 0;

  // 更新顶部统计卡片
  var divCountEl = document.getElementById('admin-division-count');
  var regionCountEl = document.getElementById('admin-region-count');
  var levelCountEl = document.getElementById('admin-level-count');

  if (divCountEl) divCountEl.textContent = divisionCount;
  if (regionCountEl) regionCountEl.textContent = regionCount;
  if (levelCountEl) levelCountEl.textContent = maxDepth;

  // 更新详细统计信息（如果存在详细统计容器）
  var detailsEl = document.getElementById('admin-stats-details');
  if (detailsEl && divisionCount > 0) {
    var levelNames = {
      country: '国家/王朝',
      province: '省/州',
      prefecture: '郡/府',
      county: '县/城',
      district: '乡/镇'
    };

    var html = '<div style="background: #2a2a2a; border: 1px solid #444; border-radius: 8px; padding: 16px; margin-top: 16px;">';
    html += '<div style="font-size: 13px; color: #ffd700; font-weight: 600; margin-bottom: 12px;">📊 详细统计</div>';

    // 各级别数量
    html += '<div style="margin-bottom: 12px;">';
    html += '<div style="font-size: 12px; color: #aaa; margin-bottom: 6px;">各级行政单位数量：</div>';
    for (var level in levelCounts) {
      if (levelCounts[level] > 0) {
        var percentage = ((levelCounts[level] / divisionCount) * 100).toFixed(1);
        html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">';
        html += '<div style="width: 80px; font-size: 11px; color: #ccc;">' + levelNames[level] + '</div>';
        html += '<div style="flex: 1; height: 16px; background: #1a1a1a; border-radius: 8px; overflow: hidden;">';
        html += '<div style="height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: ' + percentage + '%;"></div>';
        html += '</div>';
        html += '<div style="width: 60px; text-align: right; font-size: 11px; color: #ffd700;">' + levelCounts[level] + ' (' + percentage + '%)</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    // 主官任命情况
    var governorPercentage = divisionCount > 0 ? ((governorCount / divisionCount) * 100).toFixed(1) : 0;
    html += '<div style="margin-bottom: 12px;">';
    html += '<div style="font-size: 12px; color: #aaa; margin-bottom: 6px;">主官任命情况：</div>';
    html += '<div style="display: flex; align-items: center; gap: 8px;">';
    html += '<div style="flex: 1; height: 16px; background: #1a1a1a; border-radius: 8px; overflow: hidden;">';
    html += '<div style="height: 100%; background: linear-gradient(90deg, #10b981, #059669); width: ' + governorPercentage + '%;"></div>';
    html += '</div>';
    html += '<div style="width: 100px; text-align: right; font-size: 11px; color: #10b981;">' + governorCount + ' / ' + divisionCount + ' (' + governorPercentage + '%)</div>';
    html += '</div>';
    html += '</div>';

    // 地块映射情况
    if (regionCount > 0) {
      var mappingPercentage = ((mappedRegionCount / regionCount) * 100).toFixed(1);
      html += '<div>';
      html += '<div style="font-size: 12px; color: #aaa; margin-bottom: 6px;">地块映射情况：</div>';
      html += '<div style="display: flex; align-items: center; gap: 8px;">';
      html += '<div style="flex: 1; height: 16px; background: #1a1a1a; border-radius: 8px; overflow: hidden;">';
      html += '<div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); width: ' + mappingPercentage + '%;"></div>';
      html += '</div>';
      html += '<div style="width: 100px; text-align: right; font-size: 11px; color: #3b82f6;">' + mappedRegionCount + ' / ' + regionCount + ' (' + mappingPercentage + '%)</div>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    detailsEl.innerHTML = html;
  }
}

// 添加行政单位
function addAdminDivision(parentNode) {
  var factionOptions = '<option value="">无</option>';
  if (scriptData.factions) {
    for (var i = 0; i < scriptData.factions.length; i++) {
      factionOptions += '<option value="' + scriptData.factions[i].id + '">' + scriptData.factions[i].name + '</option>';
    }
  }

  // 生成官职选项（从官制系统中获取）
  var officialOptions = _adminBuildOfficialPositionOptions('');

  // 生成人物选项
  var characterOptions = '<option value="">无</option>';
  if (scriptData.characters) {
    for (var i = 0; i < scriptData.characters.length; i++) {
      var c = scriptData.characters[i];
      characterOptions += '<option value="' + c.name + '">' + c.name + (c.officialTitle ? ' (' + c.officialTitle + ')' : '') + '</option>';
    }
  }

  var html = '<div style="padding: 16px;">'
    + '<div class="form-group">'
    + '<label>行政单位名称</label>'
    + '<input type="text" id="division-name" placeholder="例：关中郡、长安县" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + '</div>'
    + '<div class="form-group">'
    + '<label>行政级别</label>'
    + '<select id="division-level" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + '<option value="country">国家/王朝</option>'
    + '<option value="province">省/州</option>'
    + '<option value="prefecture">郡/府</option>'
    + '<option value="county">县/城</option>'
    + '<option value="district">乡/镇</option>'
    + '</select>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>主官职位（可选）</label>'
    + '<select id="division-officialPosition" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + officialOptions
    + '</select>'
    + '<div style="font-size:11px;color:#888;margin-top:4px;">该行政单位的主官职位（如郡守、县令）</div>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>主官人选（可选）</label>'
    + '<select id="division-governor" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + characterOptions
    + '</select>'
    + '<div style="font-size:11px;color:#888;margin-top:4px;">当前担任该行政单位主官的人物</div>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>描述（可选）</label>'
    + '<textarea id="division-description" rows="2" placeholder="描述该行政单位的特点..." style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; resize: vertical;"></textarea>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">'
    + '<div class="form-group"><label>人口</label><input type="number" id="division-population" min="0" value="50000" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"></div>'
    + '<div class="form-group"><label>繁荣度(0-100)</label><input type="number" id="division-prosperity" min="0" max="100" value="50" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"></div>'
    + '<div class="form-group"><label>税率等级</label><select id="division-taxLevel" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"><option value="轻">轻税</option><option value="中" selected>中税</option><option value="重">重税</option></select></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
    + '<div class="form-group"><label>地形</label><select id="division-terrain" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"><option value="平原">平原</option><option value="丘陵">丘陵</option><option value="山地">山地</option><option value="水乡">水乡</option><option value="沿海">沿海</option><option value="沙漠">沙漠</option><option value="草原">草原</option></select></div>'
    + '<div class="form-group"><label>特产</label><input type="text" id="division-specialResources" placeholder="如：盐、铁、丝绸" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">'
    + '<div class="form-group"><label>法理归属势力</label><select id="division-dejureOwner" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;">' + factionOptions.replace('无', '未设定') + '</select><div style="font-size:10px;color:#888;margin-top:2px;">该地名义上应归属的势力（用于宣称战争）</div></div>'
    + '<div class="form-group"><label>首府子区ID</label><input type="text" id="division-capitalChildId" placeholder="子行政区ID(如div_xxx)" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"><div style="font-size:10px;color:#888;margin-top:2px;">治所——上级的governor/税制自动同步到首府</div></div>'
    + '</div>'
    + '</div>';

  openGenericModal('添加行政单位', html, function() {
    var name = gv('division-name');
    if (!name) {
      alert('请输入行政单位名称');
      return;
    }

    var adminHierarchy = getCurrentAdminHierarchy();
    var newDivision = {
      id: 'div_' + Date.now(),
      name: name,
      level: gv('division-level'),
      officialPosition: gv('division-officialPosition'),
      governor: gv('division-governor'),
      description: gv('division-description'),
      population: parseInt(gv('division-population')) || 50000,
      prosperity: parseInt(gv('division-prosperity')) || 50,
      taxLevel: gv('division-taxLevel') || '中',
      terrain: gv('division-terrain') || '平原',
      specialResources: gv('division-specialResources') || '',
      dejureOwner: gv('division-dejureOwner') || '',
      capitalChildId: gv('division-capitalChildId') || '',
      children: []
    };

    if (parentNode) {
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(newDivision);
    } else {
      adminHierarchy.divisions.push(newDivision);
    }

    renderAdminTree();
    updateAdminStats();
    if(typeof autoSave==="function")autoSave();
  });
}

// 编辑行政单位
function editAdminDivision(node) {
  // 生成官职选项
  var officialOptions = _adminBuildOfficialPositionOptions(node.officialPosition);

  // 生成人物选项
  var characterOptions = '<option value="">无</option>';
  if (scriptData.characters) {
    for (var i = 0; i < scriptData.characters.length; i++) {
      var c = scriptData.characters[i];
      var selected = (node.governor === c.name) ? ' selected' : '';
      characterOptions += '<option value="' + c.name + '"' + selected + '>' + c.name + (c.officialTitle ? ' (' + c.officialTitle + ')' : '') + '</option>';
    }
  }

  var html = '<div style="padding: 16px;">'
    + '<div class="form-group">'
    + '<label>行政单位名称</label>'
    + '<input type="text" id="division-name" value="' + (node.name || '').replace(/"/g, '&quot;') + '" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + '</div>'
    + '<div class="form-group">'
    + '<label>行政级别</label>'
    + '<select id="division-level" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + '<option value="country"' + (node.level === 'country' ? ' selected' : '') + '>国家/王朝</option>'
    + '<option value="province"' + (node.level === 'province' ? ' selected' : '') + '>省/州</option>'
    + '<option value="prefecture"' + (node.level === 'prefecture' ? ' selected' : '') + '>郡/府</option>'
    + '<option value="county"' + (node.level === 'county' ? ' selected' : '') + '>县/城</option>'
    + '<option value="district"' + (node.level === 'district' ? ' selected' : '') + '>乡/镇</option>'
    + '</select>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>主官职位</label>'
    + '<select id="division-officialPosition" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + officialOptions
    + '</select>'
    + '<div style="font-size:11px;color:#888;margin-top:4px;">该行政单位的主官职位（如郡守、县令）</div>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>主官人选</label>'
    + '<select id="division-governor" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">'
    + characterOptions
    + '</select>'
    + '<div style="font-size:11px;color:#888;margin-top:4px;">当前担任该行政单位主官的人物</div>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>描述</label>'
    + '<textarea id="division-description" rows="2" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; resize: vertical;">' + (node.description || '') + '</textarea>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">'
    + '<div class="form-group"><label>人口</label><input type="number" id="division-population" min="0" value="' + (node.population || 50000) + '" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"></div>'
    + '<div class="form-group"><label>繁荣度(0-100)</label><input type="number" id="division-prosperity" min="0" max="100" value="' + (node.prosperity || 50) + '" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"></div>'
    + '<div class="form-group"><label>税率等级</label><select id="division-taxLevel" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"><option value="轻"' + (node.taxLevel==='轻'?' selected':'') + '>轻税</option><option value="中"' + ((!node.taxLevel||node.taxLevel==='中')?' selected':'') + '>中税</option><option value="重"' + (node.taxLevel==='重'?' selected':'') + '>重税</option></select></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
    + '<div class="form-group"><label>地形</label><select id="division-terrain" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"><option value="平原"' + (node.terrain==='平原'?' selected':'') + '>平原</option><option value="丘陵"' + (node.terrain==='丘陵'?' selected':'') + '>丘陵</option><option value="山地"' + (node.terrain==='山地'?' selected':'') + '>山地</option><option value="水乡"' + (node.terrain==='水乡'?' selected':'') + '>水乡</option><option value="沿海"' + (node.terrain==='沿海'?' selected':'') + '>沿海</option><option value="沙漠"' + (node.terrain==='沙漠'?' selected':'') + '>沙漠</option><option value="草原"' + (node.terrain==='草原'?' selected':'') + '>草原</option></select></div>'
    + '<div class="form-group"><label>特产</label><input type="text" id="division-specialResources" value="' + (node.specialResources || '').replace(/"/g,'&quot;') + '" placeholder="如：盐、铁" style="width:100%;padding:6px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;border-radius:4px;"></div>'
    + '</div>'
    + '</div>';

  openGenericModal('编辑行政单位', html, function() {
    var name = gv('division-name');
    if (!name) {
      alert('请输入行政单位名称');
      return;
    }

    node.name = name;
    node.level = gv('division-level');
    node.officialPosition = gv('division-officialPosition');
    node.governor = gv('division-governor');
    node.description = gv('division-description');
    node.population = parseInt(gv('division-population')) || 50000;
    node.prosperity = parseInt(gv('division-prosperity')) || 50;
    node.taxLevel = gv('division-taxLevel') || '中';
    node.terrain = gv('division-terrain') || '平原';
    node.specialResources = gv('division-specialResources') || '';

    renderAdminTree();
    updateAdminStats();
    if(typeof autoSave==="function")autoSave();
  });
}

// 删除行政单位
function deleteAdminDivision(nodeId) {
  var adminHierarchy = getCurrentAdminHierarchy();

  function removeNode(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) {
        nodes.splice(i, 1);
        return true;
      }
      if (nodes[i].children && removeNode(nodes[i].children, id)) {
        return true;
      }
    }
    return false;
  }

  removeNode(adminHierarchy.divisions, nodeId);
  renderAdminTree();
  updateAdminStats();
  if(typeof autoSave==="function")autoSave();
}

// 渲染城市列表
function renderCitiesList() {
  const container = document.getElementById('cities-list');
  if (!scriptData.cities || scriptData.cities.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px; font-size: 13px;">暂无城市，点击"添加城市"或"AI生成城市"开始</div>';
    return;
  }

  let html = '';
  scriptData.cities.forEach((city, index) => {
    const region = scriptData.map && scriptData.map.regions ?
      scriptData.map.regions.find(r => r.id === city.regionId) : null;
    const faction = scriptData.factions ?
      scriptData.factions.find(f => f.id === city.owner) : null;

    html += `
      <div class="city-card">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 14px; color: #ffd700; font-weight: 600; margin-bottom: 4px;">${city.name || '未命名城市'}</div>
            <div style="font-size: 11px; color: #aaa;">
              ${region ? `📍 ${region.name} (${city.position || '中部'})` : '📍 未分配地块'}
              ${faction ? ` · 🏴 ${faction.name}` : city.owner === 'player' ? ' · 🏴 玩家势力' : ' · 🏴 无主'}
            </div>
          </div>
          <div style="display: flex; gap: 4px;">
            <button onclick="editCity(${index})" style="padding: 4px 8px; background: #3a3a3a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; cursor: pointer; font-size: 11px;">编辑</button>
            <button onclick="deleteCity(${index})" style="padding: 4px 8px; background: #8B0000; border: 1px solid #444; color: #fff; border-radius: 4px; cursor: pointer; font-size: 11px;">删除</button>
          </div>
        </div>
        ${city.description ? `<div style="font-size: 12px; color: #ccc; margin-top: 8px; line-height: 1.4;">${city.description}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
  updateAdminStats();
}

// 添加城市
function addCity() {
  const html = `
    <div style="padding: 16px;">
      <div class="form-group">
        <label>城市名称</label>
        <input type="text" id="city-name" placeholder="例：长安" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
      </div>
      <div class="form-group">
        <label>所属地块</label>
        <select id="city-region" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          <option value="">未分配</option>
          ${scriptData.map && scriptData.map.regions ? scriptData.map.regions.map(r =>
            `<option value="${r.id}">地块${r.id} - ${r.name || '未命名'}</option>`
          ).join('') : ''}
        </select>
      </div>
      <div class="form-group">
        <label>在地块中的方位</label>
        <select id="city-position" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          <option value="center">中部</option>
          <option value="north">北部</option>
          <option value="south">南部</option>
          <option value="east">东部</option>
          <option value="west">西部</option>
          <option value="northeast">东北</option>
          <option value="northwest">西北</option>
          <option value="southeast">东南</option>
          <option value="southwest">西南</option>
        </select>
      </div>
      <div class="form-group">
        <label>所属势力</label>
        <select id="city-owner" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          <option value="">无主</option>
          <option value="player">玩家势力</option>
          ${scriptData.factions ? scriptData.factions.map(f =>
            `<option value="${f.id}">${f.name}</option>`
          ).join('') : ''}
        </select>
      </div>
      <div class="form-group">
        <label>城市描述（可选）</label>
        <textarea id="city-description" rows="3" placeholder="描述城市的特点、历史..." style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; resize: vertical;"></textarea>
      </div>
    </div>
  `;

  openGenericModal('添加城市', html, () => {
    const name = document.getElementById('city-name').value.trim();
    if (!name) {
      alert('请输入城市名称');
      return;
    }

    const city = {
      id: 'city_' + Date.now(),
      name: name,
      regionId: document.getElementById('city-region').value || null,
      position: document.getElementById('city-position').value,
      owner: document.getElementById('city-owner').value,
      description: document.getElementById('city-description').value.trim(),
      population: 10000,
      development: 50,
      buildings: [],
      characters: []
    };

    scriptData.cities.push(city);
    renderCitiesList();
    if(typeof autoSave==="function")autoSave();
  });
}

// 编辑城市
function editCity(index) {
  const city = scriptData.cities[index];
  if (!city) return;

  const html = `
    <div style="padding: 16px;">
      <div class="form-group">
        <label>城市名称</label>
        <input type="text" id="city-name" value="${city.name || ''}" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
      </div>
      <div class="form-group">
        <label>所属地块</label>
        <select id="city-region" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          <option value="">未分配</option>
          ${scriptData.map && scriptData.map.regions ? scriptData.map.regions.map(r =>
            `<option value="${r.id}" ${city.regionId === r.id ? 'selected' : ''}>地块${r.id} - ${r.name || '未命名'}</option>`
          ).join('') : ''}
        </select>
      </div>
      <div class="form-group">
        <label>在地块中的方位</label>
        <select id="city-position" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          <option value="center" ${city.position === 'center' ? 'selected' : ''}>中部</option>
          <option value="north" ${city.position === 'north' ? 'selected' : ''}>北部</option>
          <option value="south" ${city.position === 'south' ? 'selected' : ''}>南部</option>
          <option value="east" ${city.position === 'east' ? 'selected' : ''}>东部</option>
          <option value="west" ${city.position === 'west' ? 'selected' : ''}>西部</option>
          <option value="northeast" ${city.position === 'northeast' ? 'selected' : ''}>东北</option>
          <option value="northwest" ${city.position === 'northwest' ? 'selected' : ''}>西北</option>
          <option value="southeast" ${city.position === 'southeast' ? 'selected' : ''}>东南</option>
          <option value="southwest" ${city.position === 'southwest' ? 'selected' : ''}>西南</option>
        </select>
      </div>
      <div class="form-group">
        <label>所属势力</label>
        <select id="city-owner" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          <option value="" ${!city.owner ? 'selected' : ''}>无主</option>
          <option value="player" ${city.owner === 'player' ? 'selected' : ''}>玩家势力</option>
          ${scriptData.factions ? scriptData.factions.map(f =>
            `<option value="${f.id}" ${city.owner === f.id ? 'selected' : ''}>${f.name}</option>`
          ).join('') : ''}
        </select>
      </div>
      <div class="form-group">
        <label>城市描述</label>
        <textarea id="city-description" rows="3" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; resize: vertical;">${city.description || ''}</textarea>
      </div>
    </div>
  `;

  openGenericModal('编辑城市', html, () => {
    const name = document.getElementById('city-name').value.trim();
    if (!name) {
      alert('请输入城市名称');
      return;
    }

    city.name = name;
    city.regionId = document.getElementById('city-region').value || null;
    city.position = document.getElementById('city-position').value;
    city.owner = document.getElementById('city-owner').value;
    city.description = document.getElementById('city-description').value.trim();

    renderCitiesList();
    if(typeof autoSave==="function")autoSave();
  });
}

// 删除城市
function deleteCity(index) {
  const city = scriptData.cities[index];
  if (!city) return;

  if (confirm(`确定要删除城市"${city.name}"吗？`)) {
    scriptData.cities.splice(index, 1);
    renderCitiesList();
    if(typeof autoSave==="function")autoSave();
  }
}

// 渲染地块列表
function renderRegionsList() {
  const container = document.getElementById('regions-list');
  if (!scriptData.map || !scriptData.map.regions || scriptData.map.regions.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px; font-size: 13px;">暂无地块数据，请先在地图编辑器中导入地图</div>';
    return;
  }

  // 按势力分组
  const grouped = {};
  scriptData.map.regions.forEach(region => {
    const owner = region.owner || 'unassigned';
    if (!grouped[owner]) {
      grouped[owner] = [];
    }
    grouped[owner].push(region);
  });

  let html = '';

  // 显示各势力的地块
  Object.keys(grouped).sort().forEach(owner => {
    let ownerName = '无主荒地';
    let ownerColor = '#808080';

    if (owner === 'player') {
      ownerName = '玩家势力';
      ownerColor = '#4CAF50';
    } else if (owner !== 'unassigned') {
      const faction = scriptData.factions ? scriptData.factions.find(f => f.id === owner) : null;
      if (faction) {
        ownerName = faction.name;
        ownerColor = faction.color || '#8BC34A';
      }
    }

    html += `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; color: #ffd700; font-weight: 600; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #444;">
          ${ownerName} (${grouped[owner].length}个地块)
        </div>
    `;

    grouped[owner].forEach(region => {
      const citiesInRegion = scriptData.cities ? scriptData.cities.filter(c => c.regionId === region.id) : [];

      html += `
        <div class="region-card">
          <div class="region-color-box" style="background: ${region.color || ownerColor};"></div>
          <div style="flex: 1;">
            <div style="font-size: 13px; color: #e0e0e0; font-weight: 600;">地块${region.id} - ${region.name || '未命名'}</div>
            <div style="font-size: 11px; color: #aaa; margin-top: 4px;">
              ${citiesInRegion.length > 0 ? `🏙️ ${citiesInRegion.map(c => c.name).join('、')}` : '🏙️ 暂无城市'}
            </div>
          </div>
          <button onclick="quickEditRegion(${region.id})" style="padding: 4px 8px; background: #3a3a3a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; cursor: pointer; font-size: 11px;">编辑</button>
        </div>
      `;
    });

    html += '</div>';
  });

  container.innerHTML = html;
  updateAdminStats();
}

// 快速编辑地块
function quickEditRegion(regionId) {
  const region = scriptData.map.regions.find(r => r.id === regionId);
  if (!region) return;

  const factions = scriptData.factions || [];
  const factionOptions = [
    '<option value="">无主荒地</option>',
    '<option value="player">玩家势力</option>',
    ...factions.map(f => `<option value="${f.id}" ${region.owner === f.id ? 'selected' : ''}>${f.name}</option>`)
  ].join('');

  const citiesInRegion = scriptData.cities ? scriptData.cities.filter(c => c.regionId === regionId) : [];

  const html = `
    <div style="padding: 16px;">
      <div class="form-group">
        <label>地块ID</label>
        <div style="color: #ffd700; font-size: 14px; font-weight: 600;">${region.id}</div>
      </div>
      <div class="form-group">
        <label>地块名称</label>
        <input type="text" id="region-name" value="${region.name || ''}" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
      </div>
      <div class="form-group">
        <label>所属势力</label>
        <select id="region-owner" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px;">
          ${factionOptions}
        </select>
      </div>
      <div class="form-group">
        <label>地块颜色</label>
        <input type="color" id="region-color" value="${region.color || '#8BC34A'}" style="width: 100%; height: 36px; border: 1px solid #444; border-radius: 4px; cursor: pointer;">
      </div>
      <div style="background: #2a2a2a; border: 1px solid #444; border-radius: 4px; padding: 12px; margin-top: 12px;">
        <div style="font-size: 12px; color: #ffd700; font-weight: 600; margin-bottom: 8px;">包含的城市</div>
        ${citiesInRegion.length > 0 ?
          citiesInRegion.map(c => `<div style="font-size: 11px; color: #ccc; padding: 4px 0;">• ${c.name} (${c.position || '中部'})</div>`).join('') :
          '<div style="font-size: 11px; color: #888;">暂无城市</div>'
        }
      </div>
    </div>
  `;

  openGenericModal('编辑地块', html, () => {
    region.name = document.getElementById('region-name').value;
    region.owner = document.getElementById('region-owner').value;
    region.color = document.getElementById('region-color').value;

    renderRegionsList();
    if(typeof autoSave==="function")autoSave();
  });
}

// ====== CK3-style interactive tree visualization (identical to government tree) ======

function renderAdminTree() {
  var box = document.getElementById('adminTree');
  var adminHierarchy = getCurrentAdminHierarchy();
  var divisions = adminHierarchy.divisions;
  if (!divisions || !divisions.length) {
    box.innerHTML = '<div style="text-align:center;color:#888;padding:40px">'
      + '暂无行政区划数据。点击"添加顶级行政单位"开始。</div>';
    return;
  }
  _adminBuildTree(box);
  updateAdminStats();
}

function _adminBuildTree(container) {
  var adminHierarchy = getCurrentAdminHierarchy();
  // Build virtual root
  var rootName = adminHierarchy.name || '行政区划体系';
  var rootDesc = adminHierarchy.description || '';
  var divisions = adminHierarchy.divisions || [];

  // Layout pass: assign x,y to each node
  var laid = [];  // {div, path, x, y, w, h, depth, children:[], collapsed, isRoot}
  var rootNode = {
    div: {name: rootName, description: rootDesc, level: 'root', children: []},
    path: null, x: 0, y: 0, w: _adminTree.NODE_W, h: 0,
    depth: 0, children: [], collapsed: false, isRoot: true
  };
  laid.push(rootNode);

  // Recursively build layout nodes
  function buildLayoutNodes(divArr, basePath, parentLayout, depth) {
    for (var i = 0; i < divArr.length; i++) {
      var div = divArr[i];
      if (!div) continue;
      var path = basePath.concat(i);
      var pathKey = JSON.stringify(path);
      var isCollapsed = !!_adminTree.collapsed[pathKey];
      var ln = {
        div: div, path: path, x: 0, y: 0, w: _adminTree.NODE_W, h: 0,
        depth: depth, children: [], collapsed: isCollapsed, isRoot: false
      };
      parentLayout.children.push(ln);
      laid.push(ln);
      if (!isCollapsed && div.children && div.children.length) {
        buildLayoutNodes(div.children, path.concat('c'), ln, depth + 1);
      }
    }
  }
  buildLayoutNodes(divisions, [], rootNode, 1);

  // Compute node heights
  for (var i = 0; i < laid.length; i++) {
    var n = laid[i];
    var h = 38; // header
    if (n.div.description) h += 18;
    if (n.div.faction) h += 18; // faction badge
    h += 30; // actions
    if (n.collapsed && n.div.children && n.div.children.length) h += 14; // collapsed indicator
    n.h = h;
  }

  // Assign positions using a simple top-down layout
  function getSubtreeWidth(ln) {
    if (ln.children.length === 0) return ln.w;
    var total = 0;
    for (var i = 0; i < ln.children.length; i++) {
      if (i > 0) total += _adminTree.NODE_GAP_X;
      total += getSubtreeWidth(ln.children[i]);
    }
    return Math.max(ln.w, total);
  }

  // Gather max height per depth for uniform Y spacing
  var maxHByDepth = {};
  for (var i = 0; i < laid.length; i++) {
    var d = laid[i].depth;
    if (!maxHByDepth[d] || laid[i].h > maxHByDepth[d]) maxHByDepth[d] = laid[i].h;
  }

  function assignPositions(ln, leftX, topY) {
    var stw = getSubtreeWidth(ln);
    ln.x = leftX + (stw - ln.w) / 2;
    ln.y = topY;
    if (ln.children.length > 0) {
      var childY = topY + (maxHByDepth[ln.depth] || ln.h) + _adminTree.NODE_GAP_Y;
      var cx = leftX;
      for (var i = 0; i < ln.children.length; i++) {
        var cw = getSubtreeWidth(ln.children[i]);
        assignPositions(ln.children[i], cx, childY);
        cx += cw + _adminTree.NODE_GAP_X;
      }
    }
  }
  assignPositions(rootNode, 40, 40);

  // Compute canvas bounds
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (var i = 0; i < laid.length; i++) {
    var n = laid[i];
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
  }
  var canvasW = maxX + 40;
  var canvasH = maxY + 40;

  // Build SVG lines
  var svgLines = '';
  function drawLines(ln) {
    for (var i = 0; i < ln.children.length; i++) {
      var ch = ln.children[i];
      var x1 = ln.x + ln.w / 2;
      var y1 = ln.y + ln.h;
      var x2 = ch.x + ch.w / 2;
      var y2 = ch.y;
      var midY = (y1 + y2) / 2;
      svgLines += '<path d="M' + x1 + ',' + y1 + ' C' + x1 + ',' + midY + ' ' + x2 + ',' + midY + ' ' + x2 + ',' + y2 + '" '
        + 'fill="none" stroke="rgba(201,169,110,0.35)" stroke-width="2"/>';
      drawLines(ch);
    }
  }
  drawLines(rootNode);

  // Build HTML
  var html = '';
  // SVG layer
  html += '<svg width="' + canvasW + '" height="' + canvasH + '" style="position:absolute;top:0;left:0;pointer-events:none">'
    + svgLines + '</svg>';

  // Node layer
  html += '<div class="gov-tree-nodes" style="position:absolute;top:0;left:0;width:' + canvasW + 'px;height:' + canvasH + 'px">';
  for (var i = 0; i < laid.length; i++) {
    html += _adminRenderTreeNode(laid[i]);
  }
  html += '</div>';

  // Zoom controls
  html += '<div class="tree-zoom-controls">'
    + '<button onclick="_adminZoom(0.1)" title="Zoom in">+</button>'
    + '<button onclick="_adminZoom(-0.1)" title="Zoom out">\u2212</button>'
    + '<button onclick="_adminZoomReset()" title="Reset">\u2302</button>'
    + '</div>';

  // Minimap
  html += _adminBuildMinimap(laid, canvasW, canvasH);

  // Wrap in transform div
  var s = _adminTree.scale;
  var tx = _adminTree.panX;
  var ty = _adminTree.panY;
  container.innerHTML = '<div id="adminTreeInner" style="position:absolute;transform-origin:0 0;'
    + 'transform:scale(' + s + ') translate(' + tx + 'px,' + ty + 'px);width:' + canvasW + 'px;height:' + canvasH + 'px">'
    + html + '</div>';

  // Attach pan/zoom handlers
  _adminAttachHandlers(container);
  // Update minimap viewport
  setTimeout(function(){ _adminUpdateMinimap(container, canvasW, canvasH); }, 0);
}

function _adminRenderTreeNode(ln) {
  var d = ln.div;
  var isRoot = ln.isRoot;
  var cls = 'gov-tree-node' + (isRoot ? ' root-node' : '');
  var pathStr = ln.path !== null ? JSON.stringify(ln.path).replace(/"/g, '&quot;') : 'null';
  var hasChildren = d.children && d.children.length > 0;

  var levelNames = {
    country: '国家/王朝',
    province: '省/州',
    prefecture: '郡/府',
    county: '县/城',
    district: '乡/镇'
  };

  var h = '';
  h += '<div class="' + cls + '" style="left:' + ln.x + 'px;top:' + ln.y + 'px;width:' + ln.w + 'px">';

  // Header
  h += '<div class="node-header">';
  if (hasChildren && !isRoot) {
    var pathKey = JSON.stringify(ln.path);
    var arrow = ln.collapsed ? '\u25b6' : '\u25bc';
    h += '<span class="node-toggle" onclick="_adminToggleCollapse(\'' + pathKey.replace(/'/g, "\\'") + '\')">' + arrow + '</span>';
  }
  h += '<span class="node-name">' + (d.name || '') + '</span>';
  h += '</div>';

  // Body
  h += '<div class="node-body">';
  if (d.description) {
    h += '<div class="node-desc" title="' + (d.description||'').replace(/"/g, '&quot;') + '">' + d.description + '</div>';
  }
  // Level badge + 管辖类型标签（中国古代制度）
  if (!isRoot && d.level) {
    h += '<div class="node-badges">';
    h += '<span class="fn-badge">' + (levelNames[d.level] || d.level) + '</span>';
    // autonomy 管辖类型
    if (d.autonomy && d.autonomy.type && d.autonomy.type !== 'zhixia') {
      var _autLabels = { fanguo:'藩国', fanzhen:'藩镇', jimi:'羁縻', chaogong:'朝贡' };
      var _autColors = { fanguo:'#9a7bd8', fanzhen:'#f87171', jimi:'#66bb6a', chaogong:'#f59e0b' };
      var _lbl = _autLabels[d.autonomy.type] || d.autonomy.type;
      if (d.autonomy.type === 'fanguo') _lbl += d.autonomy.subtype === 'real' ? '(实封)' : '(虚封)';
      var _autClr = _autColors[d.autonomy.type] || '#888';
      h += '<span class="fn-badge" style="margin-left:4px;background:' + _autClr + '22;color:' + _autClr + ';border:1px dashed ' + _autClr + ';">' + _lbl + '</span>';
      if (d.autonomy.holder) {
        h += '<span class="fn-badge" style="margin-left:4px;background:' + _autClr + '15;color:' + _autClr + ';">持:' + d.autonomy.holder + '</span>';
      }
    }
    h += '</div>';
  } else if (!isRoot && d.autonomy && d.autonomy.type && d.autonomy.type !== 'zhixia') {
    // 无level但有autonomy时仍显示
    h += '<div class="node-badges">';
    var _autLabels2 = { fanguo:'藩国', fanzhen:'藩镇', jimi:'羁縻', chaogong:'朝贡' };
    var _autColors2 = { fanguo:'#9a7bd8', fanzhen:'#f87171', jimi:'#66bb6a', chaogong:'#f59e0b' };
    var _lbl2 = _autLabels2[d.autonomy.type] || d.autonomy.type;
    if (d.autonomy.type === 'fanguo') _lbl2 += d.autonomy.subtype === 'real' ? '(实封)' : '(虚封)';
    var _autClr2 = _autColors2[d.autonomy.type] || '#888';
    h += '<span class="fn-badge" style="background:' + _autClr2 + '22;color:' + _autClr2 + ';border:1px dashed ' + _autClr2 + ';">' + _lbl2 + '</span>';
    h += '</div>';
  }
  // 经济/地理属性紧凑行
  if (!isRoot) {
    var _attrParts = [];
    if (d.population) _attrParts.push('\u4EBA' + (d.population >= 10000 ? Math.round(d.population / 10000) + '\u4E07' : d.population));
    if (d.prosperity) {
      var _prosClr = d.prosperity > 70 ? '#4ade80' : d.prosperity < 30 ? '#f87171' : '#fbbf24';
      _attrParts.push('<span style="color:' + _prosClr + '">\u7E41' + d.prosperity + '</span>');
    }
    if (d.terrain) _attrParts.push(d.terrain);
    if (d.specialResources) _attrParts.push('\u4EA7' + d.specialResources);
    if (d.taxLevel) {
      var _taxClr = d.taxLevel === '\u91CD' ? '#f87171' : d.taxLevel === '\u8F7B' ? '#4ade80' : '#9ca3af';
      _attrParts.push('<span style="color:' + _taxClr + '">' + d.taxLevel + '\u7A0E</span>');
    }
    if (_attrParts.length > 0) {
      h += '<div style="font-size:10px;color:#9a9590;padding:2px 0;display:flex;flex-wrap:wrap;gap:4px;">' + _attrParts.join('<span style="color:#555">|</span>') + '</div>';
    }
  }
  // 显示主官信息
  if (!isRoot && (d.officialPosition || d.governor)) {
    h += '<div class="node-badges" style="margin-top:4px;">';
    if (d.officialPosition) {
      h += '<span class="fn-badge" style="background:rgba(99,102,241,0.2);color:#818cf8;">' + d.officialPosition + '</span>';
    }
    if (d.governor) {
      h += '<span class="fn-badge" style="background:rgba(34,197,94,0.2);color:#4ade80;margin-left:4px;">' + d.governor + '</span>';
    }
    h += '</div>';
  }
  // Stats
  var childCount = (d.children || []).length;
  if (childCount) {
    h += '<div class="node-stats">';
    h += '<span>下级单位 ' + childCount + '</span>';
    h += '</div>';
  }
  // Collapsed indicator
  if (ln.collapsed && hasChildren) {
    h += '<div style="font-size:10px;color:#888;text-align:center;padding:2px 0">\u2026 ' + childCount + ' 下级单位已折叠</div>';
  }
  h += '</div>';

  // Actions
  if (!isRoot) {
    h += '<div class="node-actions">';
    h += '<button class="act-edit" onclick="event.stopPropagation();_adminEditNode(' + pathStr + ')">编辑</button>';
    h += '<button class="act-add" onclick="event.stopPropagation();_adminAddChild(' + pathStr + ')">添加下级</button>';
    if (d.id) h += '<button class="act-add" onclick="event.stopPropagation();aiExpandAdminChildren(\'' + d.id + '\')" title="AI查阅史料生成下级行政区划">AI生成下级</button>';
    h += '<button class="act-del" onclick="event.stopPropagation();_adminDelNode(' + pathStr + ')">删除</button>';
    h += '</div>';
  } else {
    h += '<div class="node-actions">';
    h += '<button class="act-edit" onclick="event.stopPropagation();_adminEditRoot()">编辑名称</button>';
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function _adminEditRoot() {
  var adminHierarchy = getCurrentAdminHierarchy();
  openGenericModal('编辑顶端节点',
    '<div class="form-group"><label>名称</label>'
    + '<input id="amf-rootname" value="' + (adminHierarchy.name||'').replace(/"/g,'&quot;') + '"></div>'
    + '<div class="form-group"><label>描述</label>'
    + '<input id="amf-rootdesc" value="' + (adminHierarchy.description||'').replace(/"/g,'&quot;') + '"></div>',
    function() {
      adminHierarchy.name = gv('amf-rootname') || adminHierarchy.name;
      adminHierarchy.description = gv('amf-rootdesc');
      renderAdminTree();
      if(typeof autoSave==="function")autoSave();
    }
  );
}

function _adminToggleCollapse(pathKey) {
  _adminTree.collapsed[pathKey] = !_adminTree.collapsed[pathKey];
  renderAdminTree();
}

function _adminZoom(delta) {
  _adminTree.scale = Math.max(0.3, Math.min(2.0, _adminTree.scale + delta));
  var inner = document.getElementById('adminTreeInner');
  if (inner) {
    inner.style.transform = 'scale(' + _adminTree.scale + ') translate(' + _adminTree.panX + 'px,' + _adminTree.panY + 'px)';
  }
  var box = document.getElementById('adminTree');
  _adminUpdateMinimap(box, parseFloat(inner.style.width), parseFloat(inner.style.height));
}

function _adminZoomReset() {
  _adminTree.scale = 1;
  _adminTree.panX = 0;
  _adminTree.panY = 0;
  var inner = document.getElementById('adminTreeInner');
  if (inner) {
    inner.style.transform = 'scale(1) translate(0px,0px)';
  }
  var box = document.getElementById('adminTree');
  _adminUpdateMinimap(box, parseFloat(inner.style.width), parseFloat(inner.style.height));
}

function _adminAttachHandlers(container) {
  // Remove old handlers
  container._adminMouseDown = null;
  container._adminMouseMove = null;
  container._adminMouseUp = null;
  container._adminWheel = null;

  container._adminMouseDown = function(e) {
    if (e.button !== 0) return;
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('node-toggle')) return;
    _adminTree.dragging = true;
    _adminTree.dragStartX = e.clientX;
    _adminTree.dragStartY = e.clientY;
    container.classList.add('grabbing');
    e.preventDefault();
  };

  container._adminMouseMove = function(e) {
    if (!_adminTree.dragging) return;
    var dx = e.clientX - _adminTree.dragStartX;
    var dy = e.clientY - _adminTree.dragStartY;
    _adminTree.dragStartX = e.clientX;
    _adminTree.dragStartY = e.clientY;
    _adminTree.panX += dx / _adminTree.scale;
    _adminTree.panY += dy / _adminTree.scale;
    var inner = document.getElementById('adminTreeInner');
    if (inner) {
      inner.style.transform = 'scale(' + _adminTree.scale + ') translate(' + _adminTree.panX + 'px,' + _adminTree.panY + 'px)';
    }
    _adminUpdateMinimap(container, parseFloat(inner.style.width), parseFloat(inner.style.height));
  };

  container._adminMouseUp = function() {
    _adminTree.dragging = false;
    container.classList.remove('grabbing');
  };

  container._adminWheel = function(e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? -0.08 : 0.08;
    _adminTree.scale = Math.max(0.3, Math.min(2.0, _adminTree.scale + delta));
    var inner = document.getElementById('adminTreeInner');
    if (inner) {
      inner.style.transform = 'scale(' + _adminTree.scale + ') translate(' + _adminTree.panX + 'px,' + _adminTree.panY + 'px)';
    }
    _adminUpdateMinimap(container, parseFloat(inner.style.width), parseFloat(inner.style.height));
  };

  container.addEventListener('mousedown', container._adminMouseDown);
  document.addEventListener('mousemove', container._adminMouseMove);
  document.addEventListener('mouseup', container._adminMouseUp);
  container.addEventListener('wheel', container._adminWheel, {passive: false});
}

function _adminBuildMinimap(laid, canvasW, canvasH) {
  var mmW = 140, mmH = 90;
  var scaleX = mmW / canvasW;
  var scaleY = mmH / canvasH;
  var sc = Math.min(scaleX, scaleY);
  var dots = '';
  for (var i = 0; i < laid.length; i++) {
    var n = laid[i];
    var rx = n.x * sc;
    var ry = n.y * sc;
    var rw = Math.max(n.w * sc, 3);
    var rh = Math.max(n.h * sc, 2);
    var col = n.isRoot ? '#ffd700' : 'rgba(201,169,110,0.5)';
    dots += '<div style="position:absolute;left:' + rx + 'px;top:' + ry + 'px;width:' + rw + 'px;height:' + rh + 'px;background:' + col + ';border-radius:1px"></div>';
  }
  return '<div class="gov-tree-minimap" id="adminMinimap">' + dots
    + '<div class="minimap-viewport" id="adminMinimapVP"></div></div>';
}

function _adminUpdateMinimap(container, canvasW, canvasH) {
  var vp = document.getElementById('adminMinimapVP');
  if (!vp) return;
  var mmW = 140, mmH = 90;
  var scaleX = mmW / canvasW;
  var scaleY = mmH / canvasH;
  var sc = Math.min(scaleX, scaleY);
  var cw = container.clientWidth;
  var ch = container.clientHeight;
  var vpLeft = -_adminTree.panX;
  var vpTop = -_adminTree.panY;
  var vpW = cw / _adminTree.scale;
  var vpH = ch / _adminTree.scale;
  vp.style.left = (vpLeft * sc) + 'px';
  vp.style.top = (vpTop * sc) + 'px';
  vp.style.width = (vpW * sc) + 'px';
  vp.style.height = (vpH * sc) + 'px';
}

function _adminGetByPath(path) {
  var adminHierarchy = getCurrentAdminHierarchy();
  var cur = adminHierarchy.divisions;
  var div = null;
  var i = 0;
  while (i < path.length) {
    var idx = path[i];
    if (idx === 'c') { i++; idx = path[i]; cur = div.children || []; }
    div = cur[idx];
    if (!div) return null;
    i++;
  }
  return div;
}

function _adminGetParentArr(path) {
  var adminHierarchy = getCurrentAdminHierarchy();
  if (path.length === 1) return { arr: adminHierarchy.divisions, idx: path[0] };
  var parentPath = path.slice(0, -2);
  var parent = _adminGetByPath(parentPath);
  if (!parent || !parent.children) return null;
  return { arr: parent.children, idx: path[path.length - 1] };
}

function _adminEditNode(path) {
  var node = _adminGetByPath(path);
  if (!node) return;
  editAdminDivision(node);
}

function _adminAddChild(path) {
  var node = _adminGetByPath(path);
  if (!node) return;
  addAdminDivision(node);
}

function _adminDelNode(path) {
  var node = _adminGetByPath(path);
  if (!node) return;
  if (confirm('确定要删除"' + node.name + '"及其所有下级单位吗？')) {
    var pa = _adminGetParentArr(path);
    if (pa) {
      pa.arr.splice(pa.idx, 1);
      renderAdminTree();
      updateAdminStats();
      if(typeof autoSave==="function")autoSave();
    }
  }
}

// 导出行政层级
function exportAdminHierarchy() {
  var adminHierarchy = getCurrentAdminHierarchy();
  var data = {
    factionId: _currentAdminFactionId,
    adminHierarchy: adminHierarchy
  };

  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'admin_hierarchy_' + _currentAdminFactionId + '_' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// 地图归属相关函数（第二部分）
function renderMappingList() {
  var container = document.getElementById('mapping-list');
  if (!container) return;

  // 检查是否有地图数据
  if (!scriptData.map || !scriptData.map.regions || scriptData.map.regions.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">暂无地图数据，请先在地图编辑器中导入地图</div>';
    return;
  }

  // 获取当前势力的行政区划
  var adminHierarchy = getCurrentAdminHierarchy();
  if (!adminHierarchy.divisions || adminHierarchy.divisions.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">暂无行政区划数据，请先创建行政层级</div>';
    return;
  }

  // 收集所有最底层的行政单位（县/城级别）
  var leafDivisions = _adminCollectLeafDivisionEntries(adminHierarchy.divisions, '');

  var html = '<div style="margin-bottom: 16px; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; font-size: 12px; color: #aaa; line-height: 1.6;">'
    + '💡 提示：将地图地块分配给最底层的行政单位（如县、城），建立行政区划与地理地图的对应关系。'
    + '</div>';

  // 显示每个最底层行政单位及其映射的地块
  for (var i = 0; i < leafDivisions.length; i++) {
    var item = leafDivisions[i];
    var div = item.division;

    // 查找映射到该行政单位的地块
    var mappedRegions = [];
    if (div.mappedRegions && Array.isArray(div.mappedRegions)) {
      for (var j = 0; j < div.mappedRegions.length; j++) {
        var regionId = div.mappedRegions[j];
        var region = scriptData.map.regions.find(function(r) { return r.id === regionId; });
        if (region) {
          mappedRegions.push(region);
        }
      }
    }

    html += '<div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 12px;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">';
    html += '<div style="flex: 1;">';
    html += '<div style="font-size: 13px; color: #ffd700; font-weight: 600;">' + div.name + '</div>';
    html += '<div style="font-size: 11px; color: #888; margin-top: 2px;">' + item.path + '</div>';
    html += '</div>';
    html += '<button onclick="openMapDivisionModal(\'' + div.id + '\')" style="padding: 4px 12px; background: #3a3a3a; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; cursor: pointer; font-size: 11px;">分配地块</button>';
    html += '</div>';

    if (mappedRegions.length > 0) {
      html += '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">';
      for (var j = 0; j < mappedRegions.length; j++) {
        var r = mappedRegions[j];
        html += '<div style="padding: 4px 8px; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); border-radius: 4px; font-size: 11px; color: #a5b4fc;">';
        html += '地块' + r.id + (r.name ? ' - ' + r.name : '');
        html += '<span onclick="removeMappedRegion(\'' + div.id + '\', ' + r.id + ')" style="margin-left: 6px; color: #ef4444; cursor: pointer; font-weight: bold;" title="移除">×</span>';
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="font-size: 11px; color: #666; margin-top: 8px;">未分配地块</div>';
    }

    html += '</div>';
  }

  container.innerHTML = html;
}

// 打开地块分配模态框
function openMapDivisionModal(divisionId) {
  // 查找行政单位
  var adminHierarchy = getCurrentAdminHierarchy();
  var division = _adminFindDivisionIn(adminHierarchy.divisions, divisionId);

  if (!division) {
    alert('未找到该行政单位');
    return;
  }

  // 获取所有地块
  var regions = scriptData.map.regions || [];
  var mappedRegions = division.mappedRegions || [];

  var html = '<div style="padding: 16px;">';
  html += '<div style="font-size: 13px; color: #ffd700; font-weight: 600; margin-bottom: 12px;">为 "' + division.name + '" 分配地块</div>';
  html += '<div style="max-height: 400px; overflow-y: auto;">';

  for (var i = 0; i < regions.length; i++) {
    var r = regions[i];
    var isChecked = mappedRegions.indexOf(r.id) !== -1;
    html += '<div style="padding: 8px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 8px;">';
    html += '<input type="checkbox" id="region-' + r.id + '" ' + (isChecked ? 'checked' : '') + ' style="cursor: pointer;">';
    html += '<label for="region-' + r.id + '" style="flex: 1; cursor: pointer; font-size: 12px; color: #e0e0e0;">';
    html += '地块' + r.id + (r.name ? ' - ' + r.name : '') + (r.owner ? ' (' + r.owner + ')' : '');
    html += '</label>';
    html += '</div>';
  }

  html += '</div>';
  html += '</div>';

  openGenericModal('分配地块', html, function() {
    var selectedRegions = [];
    for (var i = 0; i < regions.length; i++) {
      var checkbox = document.getElementById('region-' + regions[i].id);
      if (checkbox && checkbox.checked) {
        selectedRegions.push(regions[i].id);
      }
    }
    division.mappedRegions = selectedRegions;
    renderMappingList();
    if(typeof autoSave==="function")autoSave();
  });
}

// 移除映射的地块
function removeMappedRegion(divisionId, regionId) {
  var adminHierarchy = getCurrentAdminHierarchy();
  var division = _adminFindDivisionIn(adminHierarchy.divisions, divisionId);

  if (division && division.mappedRegions) {
    var index = division.mappedRegions.indexOf(regionId);
    if (index !== -1) {
      division.mappedRegions.splice(index, 1);
      renderMappingList();
      if(typeof autoSave==="function")autoSave();
    }
  }
}

// 智能匹配地块与行政单位
function autoMapDivisions() {
  var adminHierarchy = getCurrentAdminHierarchy();
  if (!adminHierarchy.divisions || adminHierarchy.divisions.length === 0) {
    alert('请先创建行政区划');
    return;
  }

  if (!scriptData.map || !scriptData.map.regions || scriptData.map.regions.length === 0) {
    alert('请先导入地图');
    return;
  }

  // 收集所有最底层的行政单位
  var leafDivisions = _adminCollectLeafDivisionEntries(adminHierarchy.divisions, '');

  var matchCount = 0;

  // 尝试根据名称匹配
  for (var i = 0; i < leafDivisions.length; i++) {
    var div = leafDivisions[i].division;
    var divName = div.name;

    // 查找名称相似的地块
    for (var j = 0; j < scriptData.map.regions.length; j++) {
      var region = scriptData.map.regions[j];
      var regionName = region.name || '';

      // 简单的名称匹配：如果地块名称包含行政单位名称，或反之
      if (regionName && (regionName.indexOf(divName) !== -1 || divName.indexOf(regionName) !== -1)) {
        if (!div.mappedRegions) {
          div.mappedRegions = [];
        }
        if (div.mappedRegions.indexOf(region.id) === -1) {
          div.mappedRegions.push(region.id);
          matchCount++;
        }
      }
    }
  }

  renderMappingList();
  if(typeof autoSave==="function")autoSave();

  if (matchCount > 0) {
    alert('智能匹配完成，共匹配 ' + matchCount + ' 个地块');
  } else {
    alert('未找到可匹配的地块，请手动分配');
  }
}

// 清除所有映射
function clearAllMappings() {
  if (!confirm('确定要清除所有地块映射吗？')) {
    return;
  }

  var adminHierarchy = getCurrentAdminHierarchy();
  function clearMappings(divs) {
    for (var i = 0; i < divs.length; i++) {
      divs[i].mappedRegions = [];
      if (divs[i].children) {
        clearMappings(divs[i].children);
      }
    }
  }
  clearMappings(adminHierarchy.divisions);

  renderMappingList();
  if(typeof autoSave==="function")autoSave();
  alert('已清除所有映射');
}

// 导出映射数据
function exportMappingData() {
  var adminHierarchy = getCurrentAdminHierarchy();
  var mappingData = [];

  function collectMappings(divs, parentPath) {
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      var path = parentPath ? parentPath + ' > ' + d.name : d.name;
      if (d.mappedRegions && d.mappedRegions.length > 0) {
        mappingData.push({
          divisionId: d.id,
          divisionName: d.name,
          divisionPath: path,
          mappedRegions: d.mappedRegions
        });
      }
      if (d.children) {
        collectMappings(d.children, path);
      }
    }
  }
  collectMappings(adminHierarchy.divisions, '');

  var json = JSON.stringify(mappingData, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'admin_mapping_' + _currentAdminFactionId + '_' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// M5: 层级权力检查
// ============================================================

/**
 * 获取行政层级的权力规则
 * @param {string} level - 'country'|'province'|'prefecture'|'county'|'district'
 * @returns {Object} tierRule
 */
function getTierRule(level) {
  var rules = (P.adminConfig && P.adminConfig.tierRules) || [];
  var rule = rules.find(function(r) { return r.level === level; });
  return rule || { level: level, tributeMultiplier: 0.5, maxArmies: 1, canAppoint: false, canLevy: false, canDeclareWar: false };
}

/**
 * 递归查找行政区划节点
 */
function findDivisionById(divId) {
  if (!P.adminHierarchy) return null;
  var ids = Object.keys(P.adminHierarchy);
  for (var i = 0; i < ids.length; i++) {
    var fid = ids[i];
    var ah = P.adminHierarchy[fid];
    var found = ah && ah.divisions ? _adminFindDivisionIn(ah.divisions, divId) : null;
    if (found) return found;
  }
  return null;
}

// ============================================================
// M6: 治所联动
// ============================================================

// ============================================================
// M7: 法理领地检查
// ============================================================

/**
 * 检查某势力是否对某行政区有法理宣称
 * @param {string} factionName - 势力名
 * @param {string} divisionId - 行政区划ID
 * @returns {boolean}
 */
function hasDejureClaim(factionName, divisionId) {
  var div = findDivisionById(divisionId);
  if (!div || !div.dejureOwner) return false;
  // 法理归属是该势力，但实际控制者不是
  var actualOwner = div.governor ? (function() {
    var gov = (typeof findCharByName === 'function') ? findCharByName(div.governor) : null;
    return gov ? gov.faction : '';
  })() : '';
  return div.dejureOwner === factionName && actualOwner !== factionName;
}

// 初始化
function initAdministrationPanel() {
  updateAdminFactionSelector();
  updateAdminStats();
  renderAdminTree();
}
