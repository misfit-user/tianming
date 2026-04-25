// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-save-manager.js — 存档管理系统 UI (R134 从 tm-dynamic-systems.js L1038-1788 拆出)
// 姊妹: tm-storage.js (IndexedDB 后端) + TM.Storage 门面 (tm-namespaces.js)
// 包含: SaveManager 对象·openSaveManager/closeSaveManager/loadFromSlot/saveToSlot/
//       exportSave/importSave/showLoading/hideLoading/整卷案目录 UI
// R113 已把底层对齐到 TM_SaveDB·此文件专注 UI 协调
// ============================================================

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
    try { localStorage.setItem('tm_save_index', JSON.stringify(idx)); } catch(_){}
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-dynamic-systems');}catch(_){}}
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
    // 打上存档版本号，避免旧存档被误判为 v1 触发全链迁移
    if (typeof SaveMigrations !== 'undefined' && typeof SaveMigrations.stamp === 'function') {
      SaveMigrations.stamp(gameState);
    }
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
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveToSlot') : console.error('[saveToSlot] 存档异常:', e); toast('\u274C \u5B58\u6863\u5F02\u5E38'); });
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
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'exportSave') : console.error('[exportSave] 异常:', e);
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
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_wE, 'importSave') : console.error('[importSave] TM_SaveDB.save 异常:', _wE);
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
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'openSaveManager') : console.error('[openSaveManager] 加载失败:', e);
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
      // 空卷·增本卡位直接「调入外卷」按钮
      html += '<div class="scroll-save-card" style="--ribbon-h:0%;--ribbon-c:transparent;" onclick="event.stopPropagation();">';
      html += '<div class="scroll-empty">';
      html += '<div class="scroll-archive-id">' + archiveId + '</div>';
      html += '<div style="font-size:var(--text-sm);color:var(--color-foreground-muted);">此卷暂缺</div>';
      html += '<div class="scroll-empty-hint">轻触归档</div>';
      html += '<div style="display:flex;flex-direction:column;gap:var(--space-1);margin-top:var(--space-2);">';
      if (GM.running && !isAuto) {
        html += '<button class="bt bp bsm" onclick="saveToSlot('+i+')">玉玺封卷</button>';
      }
      if (!isAuto) {
        html += '<label class="bt bs bsm" style="cursor:pointer;">' + _ic('load',12) + ' 调入外卷';
        html += '<input type="file" accept=".json" style="display:none;" onchange="_importToSpecificSlot('+i+', this)">';
        html += '</label>';
      }
      html += '</div>';
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

// 从空卡位直接触发导入·省去选槽位步骤
function _importToSpecificSlot(slotId, fileInput) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
  if (isNaN(slotId) || slotId < 0) { toast('\u274C \u69FD\u4F4D\u65E0\u6548'); return; }
  var file = fileInput.files[0];
  var _ret = SaveManager.importSave(file, slotId);
  if (_ret && typeof _ret.then === 'function') {
    _ret.then(function(ok) {
      console.log('[_importToSpecificSlot] slot=' + slotId + '·ok=' + ok);
      setTimeout(function() {
        closeSaveManager();
        openSaveManager();
        if (!ok) toast('\u26A0 \u5BFC\u5165\u672A\u6210\u529F\u00B7\u8BF7\u67E5\u63A7\u5236\u53F0');
      }, 200);
    }).catch(function(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '_importToSpecificSlot') : console.error('[_importToSpecificSlot] 异常:', e);
      toast('\u274C \u5BFC\u5165\u5F02\u5E38\uFF1A' + (e.message||e));
      setTimeout(function(){ closeSaveManager(); openSaveManager(); }, 200);
    });
  }
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
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'importSaveFileToSlot') : console.error('[importSaveFileToSlot] Promise 异常:', e);
      toast('\u274C \u5BFC\u5165\u5F02\u5E38\uFF1A' + (e.message||e));
      setTimeout(function(){ closeSaveManager(); openSaveManager(); }, 200);
    });
  } else {
    // 兜底（旧版本同步返回）
    setTimeout(function() { closeSaveManager(); openSaveManager(); }, 800);
  }
}

