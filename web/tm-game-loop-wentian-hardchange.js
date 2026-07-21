// @ts-check
// ═══ 巨石拆分(20260706)：tm-game-loop §5b 问天直改引擎(_wt* 硬改·路径解析/域resolver/apply/import·原行1273-2291) ═══
// 从 tm-game-loop.js 中段切出·顶层函数型(列0全局·运行时全局名互调·无alias)。
// 须紧接 tm-game-loop.js 之后装载。契约见 lint-split-contracts。

function _wtNormalizeHardChangePath(path) {
  var p = String(path || '').trim().replace(/\s+/g, '');
  p = p.replace(/\[([^\]]+)\]/g, '.$1');   // 支持 [名字] 形式·如 armies[天龙军]/chars[袁崇焕] → .名字（原仅支持 [数字]）
  var root = '';
  var m = p.match(/^(GM|gm|P|p)\.(.+)$/);
  if (m) {
    root = (/^p$/i.test(m[1])) ? 'P.' : '';
    p = m[2];
  }
  p = p.replace(/^(vars|variables|var|变量|變量|七变量|七變量)\./i, '');
  var charPath = _wtNormalizeCharacterHardChangePath(p);
  if (charPath) return root + charPath;

  var aliases = {
    '帑廪': 'guoku.money',
    '帑廪.value': 'guoku.money',
    '帑廪.money': 'guoku.money',
    '帑廩': 'guoku.money',
    '国库': 'guoku.money',
    '國庫': 'guoku.money',
    '白银': 'guoku.money',
    '银两': 'guoku.money',
    '银': 'guoku.money',
    'guoku.balance': 'guoku.money',
    '粮': 'guoku.grain',
    '粮食': 'guoku.grain',
    '布': 'guoku.cloth',
    '布匹': 'guoku.cloth',
    '甲胄': 'guoku.armory.甲胄.stock',
    '兵刃': 'guoku.armory.兵刃.stock',
    '弓弩': 'guoku.armory.弓弩.stock',
    '火器': 'guoku.armory.火器.stock',
    '战马': 'guoku.armory.战马.stock',
    '戰馬': 'guoku.armory.战马.stock',
    '铁': 'guoku.materials.铁.stock',
    '鐵': 'guoku.materials.铁.stock',
    '硝石': 'guoku.materials.硝石.stock',
    '皮革': 'guoku.materials.皮革.stock',
    '木料': 'guoku.materials.木.stock',
    '木材': 'guoku.materials.木.stock',
    '内帑': 'neitang.money',
    '内帑.value': 'neitang.money',
    '内帑.money': 'neitang.money',
    '內帑': 'neitang.money',
    '內帑.value': 'neitang.money',
    '內帑.money': 'neitang.money',
    '内藏': 'neitang.money',
    '內藏': 'neitang.money',
    'neicang': 'neitang.money',
    'neicang.money': 'neitang.money',
    'neicang.balance': 'neitang.money',
    'neitang.balance': 'neitang.money',
    '精力': '_energy',
    '精力.value': '_energy',
    '主角精力': '_energy',
    '玩家精力': '_energy',
    '君主精力': '_energy',
    'energy': '_energy',
    'player.energy': '_energy',
    'player.精力': '_energy',
    '精力上限': '_energyMax',
    '精力.max': '_energyMax',
    'energyMax': '_energyMax',
    '皇权': 'huangquan.index',
    '皇权.value': 'huangquan.index',
    '皇权.index': 'huangquan.index',
    '皇權': 'huangquan.index',
    '皇權.value': 'huangquan.index',
    '皇權.index': 'huangquan.index',
    '皇威': 'huangwei.index',
    '皇威.value': 'huangwei.index',
    '皇威.index': 'huangwei.index',
    '民心': 'minxin.trueIndex',
    '民心.value': 'minxin.trueIndex',
    '民心.index': 'minxin.trueIndex',
    '吏治': 'corruption.trueIndex',
    '吏治.value': 'corruption.trueIndex',
    '吏治.index': 'corruption.trueIndex',
    '腐败': 'corruption.trueIndex',
    '腐败.value': 'corruption.trueIndex',
    '腐败.index': 'corruption.trueIndex',
    '腐败.overall': 'corruption.trueIndex',
    '腐敗': 'corruption.trueIndex',
    '腐敗.value': 'corruption.trueIndex',
    '腐敗.index': 'corruption.trueIndex',
    'corruption.index': 'corruption.trueIndex',
    'corruption.value': 'corruption.trueIndex',
    'corruption.overall': 'corruption.trueIndex',
    'huangquan.value': 'huangquan.index',
    'huangwei.value': 'huangwei.index',
    'minxin.index': 'minxin.trueIndex',
    'minxin.value': 'minxin.trueIndex'
  };
  return root + (aliases[p] || p);
}

function _wtNormalizeCharacterHardChangePath(path) {
  var p = String(path || '').trim().replace(/\s+/g, '');
  p = p.replace(/\[(\d+)\]/g, '.$1');
  var directLoc = p.match(/^(?:人物所在地|角色所在地|NPC所在地|npc所在地)\.(.+)$/);
  if (directLoc) return 'chars.' + directLoc[1] + '.location';
  var directLoyalty = p.match(/^(?:人物忠诚|人物忠诚度|角色忠诚|角色忠诚度|NPC忠诚|NPC忠诚度|npc忠诚|npc忠诚度)\.(.+)$/);
  if (directLoyalty) return 'chars.' + directLoyalty[1] + '.loyalty';
  var m = p.match(/^(?:chars|characters|character|allCharacters|人物|角色|NPC|npc)\.(.+)\.([^.]+)$/);
  if (!m) return '';
  var field = _wtCanonicalCharacterHardChangeField(m[2]);
  if (!field) return '';
  return 'chars.' + m[1] + '.' + field;
}

function _wtCanonicalCharacterHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '所在地': 'location',
    '所在': 'location',
    '位置': 'location',
    '地点': 'location',
    '地點': 'location',
    '当前所在地': 'location',
    '目前所在地': 'location',
    'currentLocation': 'location',
    'place': 'location',
    'loc': 'location',
    'location': 'location',
    '忠诚': 'loyalty',
    '忠诚度': 'loyalty',
    '忠誠': 'loyalty',
    '忠誠度': 'loyalty',
    'loyalty': 'loyalty'
  };
  return aliases[f] || f;
}

function _wtHardChangeCharacterLists() {
  var lists = [];
  try {
    if (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars)) lists.push({ name: 'chars', list: GM.chars });
    if (typeof GM !== 'undefined' && GM && Array.isArray(GM.allCharacters) && GM.allCharacters !== GM.chars) lists.push({ name: 'allCharacters', list: GM.allCharacters });
  } catch(_) {}
  return lists;
}

function _wtNormalizeCharacterLookupToken(v) {
  return String(v || '').trim().replace(/\s+/g, '').replace(/[「」『』《》【】\[\]（）()"'“”]/g, '');
}

function _wtFindCharacterHardChangeTarget(target) {
  var t = _wtNormalizeCharacterLookupToken(target);
  if (!t) return null;
  var lists = _wtHardChangeCharacterLists();
  var loose = [];
  for (var li = 0; li < lists.length; li++) {
    var list = lists[li].list;
    for (var i = 0; i < list.length; i++) {
      var ch = list[i];
      if (!ch) continue;
      var keys = [ch.name, ch.id, ch.displayName, ch.fullName, ch.title].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
      if (keys.indexOf(t) >= 0) return { ch: ch, index: i, listName: lists[li].name };
      if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) loose.push({ ch: ch, index: i, listName: lists[li].name });
    }
  }
  return loose.length === 1 ? loose[0] : null;
}

function _wtResolveCharacterHardChange(parts) {
  if (!parts || parts.length < 3) return null;
  var rootKey = String(parts[0] || '');
  if (!/^(chars|characters|character|allCharacters|人物|角色|NPC|npc)$/i.test(rootKey)) return null;
  var target = parts[1];
  var field = _wtCanonicalCharacterHardChangeField(parts.slice(2).join('.'));
  if (!field) return null;
  var hit = null;
  var lists = _wtHardChangeCharacterLists();
  if (/^\d+$/.test(String(target || ''))) {
    var idx = parseInt(target, 10);
    var primary = (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars)) ? GM.chars : null;
    if (primary && primary[idx]) hit = { ch: primary[idx], index: idx, listName: 'chars' };
    else if (lists.length && lists[0].list[idx]) hit = { ch: lists[0].list[idx], index: idx, listName: lists[0].name };
  } else {
    hit = _wtFindCharacterHardChangeTarget(target);
  }
  if (!hit || !hit.ch) return null;
  return { ch: hit.ch, index: hit.index, listName: hit.listName, field: field };
}

function _wtMirrorCharacterHardChange(name, fields, deleteKeys) {
  var key = _wtNormalizeCharacterLookupToken(name);
  if (!key) return;
  fields = fields || {};
  deleteKeys = deleteKeys || [];
  _wtHardChangeCharacterLists().forEach(function(entry) {
    entry.list.forEach(function(item) {
      if (!item || _wtNormalizeCharacterLookupToken(item.name) !== key) return;
      Object.keys(fields).forEach(function(k) { item[k] = fields[k]; });
      deleteKeys.forEach(function(k) { try { delete item[k]; } catch(_) {} });
    });
  });
}

function _wtSetCharacterLocationHardChange(ch, value) {
  if (!ch) return;
  var loc = String(value == null ? '' : value).trim();
  ch.location = loc;
  ch.place = loc;
  ch.currentLocation = loc;
  ch.loc = loc;
  var clearTravel = [
    '_travelTo',
    '_travelFrom',
    '_travelStartTurn',
    '_travelRemainingDays',
    '_travelArrival',
    '_travelReason',
    '_travelAssignPost',
    '_travelAssignConcurrent'
  ];
  clearTravel.forEach(function(k) { try { delete ch[k]; } catch(_) {} });
  _wtMirrorCharacterHardChange(ch.name, { location: loc, place: loc, currentLocation: loc, loc: loc }, clearTravel);
}

function _wtApplyScalarHardChange(oldVal, op, value) {
  if (op === 'add') {
    var delta = parseFloat(value);
    if (isNaN(delta)) return { ok: false };
    return { ok: true, value: (Number(oldVal) || 0) + delta };
  }
  if (op === 'mul') {
    var m = parseFloat(value);
    if (isNaN(m)) return { ok: false };
    return { ok: true, value: (Number(oldVal) || 0) * m };
  }
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return { ok: true, value: parseFloat(value) };
  return { ok: true, value: value };
}

var _wtHardChangeRefreshTimer = 0;
var _wtHardChangeDirty = null;

function _wtIsTypingNow() {
  try {
    var el = document && document.activeElement;
    if (!el) return false;
    var tag = String(el.tagName || '').toLowerCase();
    return tag === 'textarea' || tag === 'input' || el.isContentEditable === true;
  } catch (_) { return false; }
}

function _wtIsVisible(id) {
  try {
    var el = document.getElementById(id);
    if (!el) return false;
    var st = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !st || (st.display !== 'none' && st.visibility !== 'hidden');
  } catch (_) { return false; }
}

function _wtRunIdle(fn, delay) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: delay || 700 });
  } else {
    setTimeout(fn, delay || 120);
  }
}

function _wtHardChangeImpact(path) {
  var p = String(path || '').replace(/^(GM|gm|P|p)\./, '');
  var d = { left: true, guoku: false, neitang: false, renwu: false, wendui: false, shizheng: false, full: false };
  if (/^guoku\./.test(p)) d.guoku = true;
  else if (/^neitang\./.test(p)) d.neitang = true;
  else if (/^(chars|allCharacters)\./.test(p)) { d.renwu = true; d.wendui = true; }
  else if (/^armies\./.test(p)) d.shizheng = true;
  else if (/^(huangquan|huangwei|minxin|corruption)\./.test(p)) d.shizheng = true;
  else if (/^_energy(Max)?$/.test(p)) { /* 主角精力·左栏能量条即够 */ }
  else d.full = true;
  return d;
}

function _wtScheduleFullRefreshWhenIdle(retry) {
  retry = retry || 0;
  _wtRunIdle(function() {
    if (_wtIsTypingNow() && retry < 6) {
      setTimeout(function(){ _wtScheduleFullRefreshWhenIdle(retry + 1); }, 600);
      return;
    }
    try { if (typeof renderGameState === 'function') renderGameState(); } catch(_){}
  }, 500);
}

function _wtFlushHardChangeRefresh() {
  var dirty = _wtHardChangeDirty;
  _wtHardChangeDirty = null;
  _wtHardChangeRefreshTimer = 0;
  if (!dirty) return;
  try { if (dirty.left && typeof renderLeftPanel === 'function') renderLeftPanel(); } catch(_){}
  try { if (dirty.guoku && typeof renderGuokuPanel === 'function') renderGuokuPanel(); } catch(_){}
  try { if (dirty.neitang && typeof renderNeitangPanel === 'function') renderNeitangPanel(); } catch(_){}
  try { if (dirty.renwu && typeof renderRenwu === 'function') renderRenwu(); } catch(_){}
  try {
    if (dirty.wendui && _wtIsVisible('gt-wendui') && typeof renderWenduiPanel === 'function') renderWenduiPanel();
  } catch(_){}
  try {
    if (dirty.shizheng && _wtIsVisible('gt-shizheng') && typeof renderShizhengPanel === 'function') renderShizhengPanel();
  } catch(_){}
  try {
    if (typeof GM !== 'undefined' && GM._listeners && Array.isArray(GM._listeners.varChange)) {
      (dirty.events || []).forEach(function(ev) {
        GM._listeners.varChange.forEach(function(fn){ try { fn(ev.path, ev.oldVal, ev.newVal); } catch(_){} });
      });
    }
  } catch(_){}
  if (dirty.full) _wtScheduleFullRefreshWhenIdle(0);
}

function _wtScheduleHardChangeRefresh(normalizedPath, oldVal, newVal) {
  var impact = _wtHardChangeImpact(normalizedPath);
  if (!_wtHardChangeDirty) {
    _wtHardChangeDirty = {
      left: false, guoku: false, neitang: false, renwu: false, wendui: false, shizheng: false, full: false,
      events: []
    };
  }
  Object.keys(impact).forEach(function(k){ if (impact[k]) _wtHardChangeDirty[k] = true; });
  _wtHardChangeDirty.events.push({ path: normalizedPath, oldVal: oldVal, newVal: newVal });
  if (_wtHardChangeRefreshTimer) clearTimeout(_wtHardChangeRefreshTimer);
  _wtHardChangeRefreshTimer = setTimeout(_wtFlushHardChangeRefresh, _wtIsTypingNow() ? 420 : 160);
}

function _wtAfterHardChange(normalizedPath, oldVal, newVal) {
  // \u64A4\u9500\u5FEB\u7167\u7A97\u53E3\uFF08\u5200B\u00B7\u4EC5\u786E\u8BA4\u73B0\u573A\u6B66\u88C5\uFF09\u00B7typeof \u5B88\u536B\uFF1A\u90E8\u5206 smoke \u6309\u7A97\u53E3\u5207\u7247\u88C5\u8F7D\u672C\u6587\u4EF6\u00B7\u58F0\u660E\u53EF\u80FD\u4E0D\u5728\u5207\u7247\u5185
  try { if (typeof _wtUndoCaptureBuf !== 'undefined' && _wtUndoCaptureBuf) _wtUndoCaptureBuf.push({ path: normalizedPath, old: oldVal, nv: newVal }); } catch (_wtCapE) {}
  _wtScheduleHardChangeRefresh(normalizedPath, oldVal, newVal);
  if (typeof addEB === 'function') addEB('\u95EE\u5929', '\u76F4\u6539 ' + normalizedPath + ' \u00B7 ' + oldVal + '\u2192' + newVal);
}

function _wtCleanHardChangeToken(v) {
  return String(v || '').trim()
    .replace(/^[\s，。；、：:,.!?！？"'“”「」『』《》【】\[\]（）()]+/, '')
    .replace(/[\s，。；、：:,.!?！？"'“”「」『』《》【】\[\]（）()]+$/, '');
}

function _wtCanonicalLocationHardChangeValue(v) {
  var loc = _wtCleanHardChangeToken(v);
  if (!loc) return '';
  if (/^(京|京城|在京|入京|赴京)$/.test(loc)) {
    try { return (GM && GM._capital) || '京师'; } catch(_) { return '京师'; }
  }
  return loc;
}

function _wtInferCharacterLocationHardChange(raw) {
  var text = String(raw || '');
  if (!/(所在地|所在|位置|地点|地點|迁|遷|移|抵达|抵達|到达|到達|入京|赴京|召.*京)/.test(text)) return null;
  var chars = [];
  _wtHardChangeCharacterLists().forEach(function(entry) {
    entry.list.forEach(function(ch) {
      if (ch && ch.name) chars.push(ch);
    });
  });
  chars.sort(function(a, b){ return String(b.name || '').length - String(a.name || '').length; });
  for (var i = 0; i < chars.length; i++) {
    var name = String(chars[i].name || '');
    var at = name ? text.indexOf(name) : -1;
    if (at < 0) continue;
    var after = text.slice(at + name.length);
    var m = after.match(/(?:所在地|所在|位置|地点|地點|当前所在地|目前所在地)(?:设为|设置为|改为|改到|改至|变为|變為|为|為|=|：|:)([^，。；、\s]{1,20})/);
    if (!m) m = after.match(/(?:迁到|迁至|遷到|遷至|移到|移至|抵达|抵達|到达|到達|赴|去|入|到|至)([^，。；、\s]{1,20})/);
    var target = m ? _wtCanonicalLocationHardChangeValue(m[1]) : '';
    if (!target && /(入京|赴京|召.*入京|召.*赴京)/.test(text)) target = _wtCanonicalLocationHardChangeValue('京');
    if (target) return { path: 'chars.' + name + '.location', op: 'set', value: target };
  }
  return null;
}

function _wtAugmentParsedHardChange(raw, parsed, forcedCategory) {
  parsed = parsed || {};
  var cat = forcedCategory || parsed.category || '';
  if (cat !== 'hardChange' && cat !== 'absolute') return parsed;
  if (parsed.hardChange && parsed.hardChange.path) return parsed;
  var inferred = _wtInferCharacterLocationHardChange(raw);
  if (!inferred) return parsed;
  parsed.hardChange = inferred;
  if (!parsed.structured) parsed.structured = {};
  parsed.structured.target = parsed.structured.target || String(inferred.path).split('.')[1] || '';
  parsed.structured.action = parsed.structured.action || '修改人物所在地';
  parsed.structured.scope = parsed.structured.scope || 'GM.chars';
  parsed.interpretation = parsed.interpretation || ('将' + parsed.structured.target + '的所在地直接改为' + inferred.value);
  parsed.plan = parsed.plan || '确认后立即写入人物所在地，并清理旧在途状态';
  return parsed;
}

function _wtSetNumericIfPossible(obj, key, value) {
  if (!obj) return;
  var n = Number(value);
  obj[key] = isNaN(n) ? value : n;
}

function _wtSyncHardChangeSideEffects(parts, newVal) {
  var key = parts.join('.');
  var numeric = Number(newVal);
  var hasNumber = !isNaN(numeric);
  function syncCorruptionDeptIndex() {
    if (!GM.corruption || typeof GM.corruption !== 'object') return;
    if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine && typeof CorruptionEngine.syncIndexFromSubDepts === 'function') {
      try { CorruptionEngine.syncIndexFromSubDepts('问天·腐败部门调整'); return; } catch(_) {}
    }
    var vals = [];
    Object.keys(GM.corruption.subDepts || {}).forEach(function(k) {
      var d = GM.corruption.subDepts[k];
      var v = d && typeof d === 'object' ? d.true : d;
      if (typeof v === 'number' && isFinite(v)) vals.push(v);
    });
    if (!vals.length) return;
    var sum = vals.reduce(function(a, b){ return a + b; }, 0);
    GM.corruption.trueIndex = sum / vals.length;
    GM.corruption.overall = GM.corruption.trueIndex;
  }
  if (key === 'guoku.money' && GM.guoku) {
    GM.guoku.balance = GM.guoku.money;
    if (GM.guoku.ledgers && GM.guoku.ledgers.money) GM.guoku.ledgers.money.stock = GM.guoku.money;
  }
  if (key === 'neitang.money' && GM.neitang) {
    GM.neitang.balance = GM.neitang.money;
    if (GM.neitang.ledgers && GM.neitang.ledgers.money) GM.neitang.ledgers.money.stock = GM.neitang.money;
  }
  if (key === 'huangquan.index' && GM.huangquan && typeof GM.huangquan === 'object') {
    _wtSetNumericIfPossible(GM.huangquan, 'index', GM.huangquan.index);
  }
  if (key === 'huangwei.index' && GM.huangwei && typeof GM.huangwei === 'object') {
    _wtSetNumericIfPossible(GM.huangwei, 'index', GM.huangwei.index);
    if (GM.huangwei.subDims && hasNumber) {
      Object.keys(GM.huangwei.subDims).forEach(function(k){
        var d = GM.huangwei.subDims[k];
        if (d && typeof d === 'object' && d.value !== undefined) d.value = numeric;
      });
    }
  }
  if (key === 'minxin.trueIndex' && GM.minxin && typeof GM.minxin === 'object') {
    _wtSetNumericIfPossible(GM.minxin, 'trueIndex', GM.minxin.trueIndex);
    if (GM.minxin.perceivedIndex === undefined && hasNumber) GM.minxin.perceivedIndex = numeric;
  }
  if (key === 'corruption.trueIndex' && GM.corruption && typeof GM.corruption === 'object' && hasNumber) {
    GM.corruption.trueIndex = numeric;
    GM.corruption.overall = numeric;
    if (GM.corruption.perceivedIndex === undefined) GM.corruption.perceivedIndex = numeric;
    if (GM.corruption.subDepts) {
      Object.keys(GM.corruption.subDepts).forEach(function(k){
        var d = GM.corruption.subDepts[k];
        if (d && typeof d === 'object') {
          d.true = numeric;
          if (d.perceived === undefined) d.perceived = numeric;
        }
      });
    }
  }
  if (key === '_energy' && hasNumber) {
    var _enMax = (typeof GM._energyMax === 'number' && GM._energyMax > 0) ? GM._energyMax : 100;
    GM._energy = Math.max(0, Math.min(_enMax, Math.round(numeric))); // arch-ok 问天god-mode直改主角精力·夹取0..上限(2026-07-10 治「改精力落GM.精力幽灵键」)
  }
  if (key === '_energyMax' && hasNumber) {
    GM._energyMax = Math.max(1, Math.round(numeric)); // arch-ok 问天god-mode直改精力上限
    if (typeof GM._energy === 'number' && GM._energy > GM._energyMax) GM._energy = GM._energyMax; // arch-ok 上限收窄时同步夹现值
  }
  var subDeptMatch = key.match(/^corruption\.subDepts\.([^.]+)\.true$/);
  if (subDeptMatch && GM.corruption && typeof GM.corruption === 'object' && hasNumber) {
    var subDept = subDeptMatch[1];
    var byDeptMirror = { imperial: 'palace' }[subDept] || subDept;
    if (!GM.corruption.byDept) GM.corruption.byDept = {};
    GM.corruption.byDept[byDeptMirror] = numeric;
    syncCorruptionDeptIndex();
  }
  var byDeptMatch = key.match(/^corruption\.byDept\.([^.]+)$/);
  if (byDeptMatch && GM.corruption && typeof GM.corruption === 'object' && hasNumber) {
    var byDept = byDeptMatch[1];
    var subDeptMirror = { palace: 'imperial' }[byDept] || byDept;
    if (!GM.corruption.subDepts) GM.corruption.subDepts = {};
    if (!GM.corruption.subDepts[subDeptMirror]) GM.corruption.subDepts[subDeptMirror] = {};
    GM.corruption.subDepts[subDeptMirror].true = numeric;
    syncCorruptionDeptIndex();
  }
}

/** 直接修改 GM/P 字段 */
function _wtCanonicalArmyHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '兵力':'soldiers','兵员':'soldiers','兵員':'soldiers','军额':'soldiers','軍額':'soldiers','人数':'soldiers','人數':'soldiers','兵数':'soldiers','兵數':'soldiers','兵':'soldiers','size':'soldiers','strength':'soldiers','soldiers':'soldiers',
    '主帅':'commander','主帥':'commander','统帅':'commander','統帥':'commander','主将':'commander','主將':'commander','将领':'commander','將領':'commander','将帅':'commander','將帥':'commander','commander':'commander','general':'commander','leader':'commander',
    '士气':'morale','士氣':'morale','军心':'morale','軍心':'morale','morale':'morale',
    '训练':'training','訓練':'training','操练':'training','操練':'training','训练度':'training','training':'training',
    '补给':'supply','補給':'supply','粮饷':'supply','糧餉':'supply','供给':'supply','供給':'supply','supply':'supply',
    '忠诚':'loyalty','忠誠':'loyalty','军忠':'loyalty','忠诚度':'loyalty','忠誠度':'loyalty','loyalty':'loyalty',
    '控制':'control','控制度':'control','军纪':'control','軍紀':'control','掌控':'control','control':'control','controlLevel':'control',
    '兵变险':'mutinyRisk','兵變險':'mutinyRisk','兵变风险':'mutinyRisk','兵變風險':'mutinyRisk','mutinyRisk':'mutinyRisk',
    '欠饷':'payArrearsMonths','欠餉':'payArrearsMonths','欠饷月数':'payArrearsMonths','欠餉月數':'payArrearsMonths','payArrearsMonths':'payArrearsMonths'
  };
  return aliases[f] || f;
}

function _wtFindArmyHardChangeTarget(name, allowFuzzy) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.armies) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = [];
  for (var i = 0; i < GM.armies.length; i++) {
    var a = GM.armies[i];
    if (!a) continue;
    var keys = [a.name, a.id, a.title].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
    if (keys.indexOf(t) >= 0) return { army: a, index: i };
    if (allowFuzzy && keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) loose.push({ army: a, index: i });
  }
  return (allowFuzzy && loose.length === 1) ? loose[0] : null;
}

// 解析军队 hardChange 路径：armies/军/部队 前缀（允许模糊匹配军名）或 裸军名（只认精确·防误伤 guoku/民心 等 GM 字段路径）
function _wtResolveArmyHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(armies|army|军|軍|军队|軍隊|部队|部隊)$/i;
  var name, field, allowFuzzy;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalArmyHardChangeField(parts.slice(2).join('.'));
    allowFuzzy = true;
  } else {
    name = parts[0];
    field = _wtCanonicalArmyHardChangeField(parts.slice(1).join('.'));
    allowFuzzy = false;
  }
  if (!name || !field) return null;
  var hit = _wtFindArmyHardChangeTarget(name, allowFuzzy);
  if (!hit || !hit.army) return null;
  return { army: hit.army, index: hit.index, field: field };
}

// 阶层 hardChange 字段规范化（满意度/影响力等中文/英文别名 → 真实字段名）
function _wtCanonicalClassHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '满意度':'satisfaction','滿意度':'satisfaction','满意':'satisfaction','滿意':'satisfaction','支持度':'satisfaction','满意度值':'satisfaction','satisfaction':'satisfaction',
    '影响力':'influence','影響力':'influence','影响':'influence','影響':'influence','话语权':'influence','話語權':'influence','影响力值':'influence','influence':'influence',
    '人口':'population','人口数':'population','population':'population',
    '凝聚力':'cohesion','凝聚':'cohesion','cohesion':'cohesion'
  };
  return aliases[f] || f;
}

// 按名查阶层（GM.classes / GM.socialClasses·精确优先·唯一模糊命中兜底·镜像军队查找）
function _wtFindClassHardChangeTarget(name) {
  var lists = [];
  if (typeof GM !== 'undefined' && GM) {
    if (Array.isArray(GM.classes)) lists.push({ list: GM.classes, name: 'classes' });
    if (Array.isArray(GM.socialClasses)) lists.push({ list: GM.socialClasses, name: 'socialClasses' });
  }
  if (!lists.length || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = null, looseCount = 0;
  for (var li = 0; li < lists.length; li++) {
    var arr = lists[li].list;
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c) continue;
      var keys = [c.name, c.className, c.id].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
      if (keys.indexOf(t) >= 0) return { cls: c, index: i, listName: lists[li].name };
      if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) { loose = { cls: c, index: i, listName: lists[li].name }; looseCount++; }
    }
  }
  return (looseCount === 1) ? loose : null;
}

// 解析阶层 hardChange 路径：classes/阶层 前缀，或裸阶层名（裸名须命中真实 class 字段·防误伤 GM 字段路径）
// 治"问天直改 classes[农户].满意度 → 通用导航写到数组幽灵属性 GM.classes['农户']、真阶层不动"的静默失败。
function _wtResolveClassHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(classes|socialClasses|socialClass|class|阶层|階層|阶级|階級|社会阶层|社會階層)$/i;
  var name, field;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalClassHardChangeField(parts.slice(2).join('.'));
  } else {
    name = parts[0];
    field = _wtCanonicalClassHardChangeField(parts.slice(1).join('.'));
  }
  if (!name || !field) return null;
  if (['satisfaction','influence','population','cohesion'].indexOf(field) < 0) return null; // 只认 class 真实字段·避免裸名误伤
  var hit = _wtFindClassHardChangeTarget(name);
  if (!hit || !hit.cls) return null;
  return { cls: hit.cls, index: hit.index, listName: hit.listName, field: field };
}

// 势力 hardChange 字段规范化（实力/经济/对玩家关系 中英别名 → 真实字段名）
function _wtCanonicalFacHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '实力':'strength','實力':'strength','国力':'strength','國力':'strength','兵力':'strength','军力':'strength','軍力':'strength','武力':'strength','strength':'strength','power':'strength',
    '经济':'economy','經濟':'economy','财力':'economy','財力':'economy','富庶':'economy','economy':'economy',
    '对玩家关系':'playerRelation','對玩家關係':'playerRelation','玩家关系':'playerRelation','玩家關係':'playerRelation','关系':'playerRelation','關係':'playerRelation','邦交':'playerRelation','好感':'playerRelation','亲疏':'playerRelation','親疏':'playerRelation','playerRelation':'playerRelation','relation':'playerRelation'
  };
  return aliases[f] || f;
}

// 按名查势力（GM.facs·精确优先·唯一模糊命中兜底·镜像阶层/军队查找）
function _wtFindFacHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.facs) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = null, looseCount = 0;
  for (var i = 0; i < GM.facs.length; i++) {
    var f = GM.facs[i];
    if (!f) continue;
    var keys = [f.name, f.id, f.shortName, f.title].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
    if (keys.indexOf(t) >= 0) return { fac: f, index: i };
    if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) { loose = { fac: f, index: i }; looseCount++; }
  }
  return (looseCount === 1) ? loose : null;
}

// 解析势力 hardChange 路径：facs/势力/外邦 前缀，或裸势力名（裸名须命中真实 fac 字段·防误伤 GM 字段路径）
// 治"问天改 facs[后金].实力 → 通用导航写到数组幽灵属性 GM.facs['后金']、真势力不动"的静默失败（与阶层/军队同根）。
function _wtResolveFacHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(facs|faction|factions|fac|势力|勢力|外邦|邦国|邦國|藩镇|藩鎮)$/i;
  var name, field;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalFacHardChangeField(parts.slice(2).join('.'));
  } else {
    name = parts[0];
    field = _wtCanonicalFacHardChangeField(parts.slice(1).join('.'));
  }
  if (!name || !field) return null;
  if (['strength','economy','playerRelation'].indexOf(field) < 0) return null; // 只认 fac 真实字段·避免裸名误伤
  var hit = _wtFindFacHardChangeTarget(name);
  if (!hit || !hit.fac) return null;
  return { fac: hit.fac, index: hit.index, field: field };
}

// 党派 hardChange 字段规范化（影响力/凝聚力 中英别名 → 真实字段名）
function _wtCanonicalPartyHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '影响力':'influence','影響力':'influence','影响':'influence','影響':'influence','话语权':'influence','話語權':'influence','声势':'influence','聲勢':'influence','influence':'influence',
    '凝聚力':'cohesion','凝聚':'cohesion','团结':'cohesion','團結':'cohesion','向心力':'cohesion','cohesion':'cohesion'
  };
  return aliases[f] || f;
}

// 按名查党派（GM.parties·精确优先·唯一模糊命中兜底·镜像势力查找）
function _wtFindPartyHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.parties) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = null, looseCount = 0;
  for (var i = 0; i < GM.parties.length; i++) {
    var p = GM.parties[i];
    if (!p) continue;
    var keys = [p.name, p.id, p.shortName].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
    if (keys.indexOf(t) >= 0) return { party: p, index: i };
    if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) { loose = { party: p, index: i }; looseCount++; }
  }
  return (looseCount === 1) ? loose : null;
}

// 解析党派 hardChange 路径：parties/党派/朋党 前缀，或裸党派名（裸名须命中真实 party 字段·防误伤）
function _wtResolvePartyHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(parties|party|党派|黨派|党|黨|朋党|朋黨)$/i;
  var name, field;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalPartyHardChangeField(parts.slice(2).join('.'));
  } else {
    name = parts[0];
    field = _wtCanonicalPartyHardChangeField(parts.slice(1).join('.'));
  }
  if (!name || !field) return null;
  if (['influence','cohesion'].indexOf(field) < 0) return null; // 只认 party 真实字段·避免裸名误伤
  var hit = _wtFindPartyHardChangeTarget(name);
  if (!hit || !hit.party) return null;
  return { party: hit.party, index: hit.index, field: field };
}

// 区划 hardChange 字段规范化（民心/吏治/田亩/商业/盐矿渔马/解额等 中文别名 → 真实字段路径）
function _wtCanonicalDivisionHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '民心': 'minxin', 'minxin': 'minxin',
    '吏治': 'corruption', '腐败': 'corruption', '腐敗': 'corruption', 'corruption': 'corruption',
    '募兵': 'militaryRecruits', '募兵上限': 'militaryRecruits', 'militaryRecruits': 'militaryRecruits',
    '田亩': 'economyBase.farmland', '田畝': 'economyBase.farmland', '耕地': 'economyBase.farmland', 'farmland': 'economyBase.farmland',
    '商业': 'economyBase.commerceVolume', '商業': 'economyBase.commerceVolume', '商业额': 'economyBase.commerceVolume', '商業額': 'economyBase.commerceVolume', 'commerceVolume': 'economyBase.commerceVolume',
    '盐产': 'economyBase.saltProduction', '鹽產': 'economyBase.saltProduction', 'saltProduction': 'economyBase.saltProduction',
    '矿产': 'economyBase.mineralProduction', '礦產': 'economyBase.mineralProduction', 'mineralProduction': 'economyBase.mineralProduction',
    '渔获': 'economyBase.fishingProduction', '漁獲': 'economyBase.fishingProduction', 'fishingProduction': 'economyBase.fishingProduction',
    '马政': 'economyBase.horseProduction', '馬政': 'economyBase.horseProduction', 'horseProduction': 'economyBase.horseProduction',
    '解额': 'economyBase.kejuQuota', '解額': 'economyBase.kejuQuota', 'kejuQuota': 'economyBase.kejuQuota',
    '驿站': 'economyBase.postRelays', '驛站': 'economyBase.postRelays', 'postRelays': 'economyBase.postRelays',
    '道路': 'economyBase.roadQuality', 'roadQuality': 'economyBase.roadQuality'
  };
  if (aliases[f]) return aliases[f];
  if (/^economyBase\./.test(f)) return f;
  return f;
}

// 按名查区划（GM.adminHierarchy 全势力树·精确优先·唯一模糊命中兜底·镜像人物/军队/党派查找范式）
function _wtFindDivisionHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !GM.adminHierarchy || typeof GM.adminHierarchy !== 'object' || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var exact = null, loose = null, looseCount = 0;
  Object.keys(GM.adminHierarchy).forEach(function (fk) {
    var rootNode = GM.adminHierarchy[fk];
    (function walk(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function (d) {
        if (!d || typeof d !== 'object') return;
        var k = _wtNormalizeCharacterLookupToken(d.name);
        if (k) {
          if (k === t) { if (!exact) exact = d; }
          else if (k.indexOf(t) >= 0 || t.indexOf(k) >= 0) { loose = d; looseCount++; }
        }
        walk(d.divisions || d.children);
      });
    })((rootNode && (rootNode.divisions || rootNode.children)) || []);
  });
  if (exact) return { div: exact };
  return (looseCount === 1) ? { div: loose } : null;
}

// 解析区划 hardChange 路径：divisions/区划/州府 前缀【必须带前缀·区划名太杂不做裸名接管】。
// 治"问天改 divisions[顺天府].economyBase.farmland → 通用导航写 GM.economyBase 幽灵对象、真区划不动"
// 的静默失败（与人物/军队/阶层/势力/党派同根·区划一直是缺口）。
function _wtResolveDivisionHardChange(parts) {
  if (!parts || parts.length < 3) return null;
  var prefixes = /^(divisions|division|区划|區劃|州府|府州|府县|府縣|地方|辖区|轄區)$/i;
  if (!prefixes.test(String(parts[0] || ''))) return null;
  var name = parts[1];
  var field = _wtCanonicalDivisionHardChangeField(parts.slice(2).join('.'));
  if (!name || !field) return null;
  var okField = (field === 'minxin' || field === 'corruption' || field === 'militaryRecruits' || /^economyBase\.[A-Za-z]+$/.test(field));
  if (!okField) return null;
  var hit = _wtFindDivisionHardChangeTarget(name);
  if (!hit || !hit.div) return null;
  return { div: hit.div, field: field };
}

// 按名查官职席位（GM.officeTree·递归 positions·精确优先·唯一模糊兜底）
function _wtFindOfficeHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.officeTree) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var exact = null, loose = null, looseCount = 0;
  (function walk(nodes) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach(function (n) {
      if (!n) return;
      (n.positions || []).forEach(function (pos) {
        if (!pos || !pos.name) return;
        var k = _wtNormalizeCharacterLookupToken(pos.name);
        if (!k) return;
        if (k === t) { if (!exact) exact = pos; }
        else if (k.indexOf(t) >= 0 || t.indexOf(k) >= 0) { loose = pos; looseCount++; }
      });
      walk(n.subs);
    });
  })(GM.officeTree);
  if (exact) return { pos: exact };
  return (looseCount === 1) ? { pos: loose } : null;
}

// 解析官职 hardChange 路径：office/官职 前缀·只认公库 publicTreasury（任免走官制系统·不在问天直改）
function _wtResolveOfficeHardChange(parts) {
  if (!parts || parts.length < 3) return null;
  var prefixes = /^(office|offices|officeTree|官职|官職|职官|職官)$/i;
  if (!prefixes.test(String(parts[0] || ''))) return null;
  var fld = String(parts.slice(2).join('.') || '').trim();
  if (!/^(publicTreasury|公库|公庫)$/.test(fld)) return null;
  var hit = _wtFindOfficeHardChangeTarget(parts[1]);
  if (!hit || !hit.pos) return null;
  return { pos: hit.pos };
}

// ═══ 幽灵键闸 + dry-run 预演（2026-07-10·owner 拍板：hardChange 档拒创建新 GM/P 根·absolute 档 allowCreate 放行）═══
// 病根：通用导航兜底对任意错路径都「成功」创建新字段——问天直改静默失败的总病根（精力→GM.精力 是最新一例）。
// 实体前缀正则=七类 resolver + renli 强制前缀的并集（须与各 resolver 的 prefixes 保持镜像·改那边须同步这里）。
var _WT_ENTITY_PREFIX_RE = /^(chars|characters|character|allCharacters|人物|角色|NPC|npc|armies|army|军|軍|军队|軍隊|部队|部隊|classes|socialClasses|socialClass|class|阶层|階層|阶级|階級|社会阶层|社會階層|facs|faction|factions|fac|势力|勢力|外邦|邦国|邦國|藩镇|藩鎮|parties|party|党派|黨派|党|黨|朋党|朋黨|divisions|division|区划|區劃|州府|府州|府县|府縣|地方|辖区|轄區|office|offices|officeTree|官职|官職|职官|職官|region|地域|丁口|田|田土|役|役政)$/i;
var _WT_CREATABLE_ROOTS = { _energy: 1, _energyMax: 1 };  // 别名表产物·引擎法定字段·旧档未初始化时允许创建

function _wtGenericNavGate(rootObj, parts) {
  var rk = String(parts[0] || '');
  if (_WT_ENTITY_PREFIX_RE.test(rk)) {
    return { ok: false, reason: '「' + String(parts[1] || rk) + '」不在档（实体名解析失败·请核对真名）' };
  }
  if (rootObj && (rk in rootObj)) return { ok: true };
  if (_WT_CREATABLE_ROOTS[rk]) return { ok: true };
  return { ok: false, reason: '字段「' + rk + '」不存在（拒创建幽灵键·请用真实字段路径）' };
}

// dry-run 预演：不写入·判定路径能否落到真实字段（agent submit 校验/确认框预标用）。
// → { ok, kind:'char|army|class|fac|party|division|office|renli|generic|ghost', normalized, reason? }
// renli 前缀无只读探针·前缀命中即乐观放行（apply 时 renli 找不到地域仍会落闸拒绝）。
function _wtDryRunHardChange(path, opts) {
  var normalizedPath = _wtNormalizeHardChangePath(path);
  var parts = String(normalizedPath).split('.');
  var rootObj;
  if (parts[0] === 'GM' || parts[0] === 'gm') { parts.shift(); rootObj = (typeof GM !== 'undefined') ? GM : null; }
  else if (parts[0] === 'P' || parts[0] === 'p') { parts.shift(); rootObj = (typeof P !== 'undefined') ? P : null; }
  else rootObj = (typeof GM !== 'undefined') ? GM : null;
  if (!parts.length || !parts[0]) return { ok: false, kind: 'ghost', normalized: normalizedPath, reason: '空路径' };
  if (rootObj && typeof GM !== 'undefined' && rootObj === GM) {
    try {
      if (/^(region|地域|丁口|田|田土|役|役政)$/i.test(String(parts[0]))) return { ok: true, kind: 'renli', normalized: normalizedPath };
      var _dr;
      if ((_dr = _wtResolveCharacterHardChange(parts)) && _dr.ch) return { ok: true, kind: 'char', normalized: normalizedPath };
      if ((_dr = _wtResolveArmyHardChange(parts)) && _dr.army) return { ok: true, kind: 'army', normalized: normalizedPath };
      if ((_dr = _wtResolveClassHardChange(parts)) && _dr.cls) return { ok: true, kind: 'class', normalized: normalizedPath };
      if ((_dr = _wtResolveFacHardChange(parts)) && _dr.fac) return { ok: true, kind: 'fac', normalized: normalizedPath };
      if ((_dr = _wtResolvePartyHardChange(parts)) && _dr.party) return { ok: true, kind: 'party', normalized: normalizedPath };
      if ((_dr = _wtResolveDivisionHardChange(parts)) && _dr.div) return { ok: true, kind: 'division', normalized: normalizedPath };
      if ((_dr = _wtResolveOfficeHardChange(parts)) && _dr.pos) return { ok: true, kind: 'office', normalized: normalizedPath };
    } catch (_) {}
  }
  if (opts && opts.allowCreate) return { ok: true, kind: 'generic', normalized: normalizedPath };
  var _gate = _wtGenericNavGate(rootObj, parts);
  if (_gate.ok) return { ok: true, kind: 'generic', normalized: normalizedPath };
  return { ok: false, kind: 'ghost', normalized: normalizedPath, reason: _gate.reason };
}

function _wtApplyHardChange(path, op, value, opts) {
  if (!path) return false;
  // 根据路径前缀决定 root
  var normalizedPath = _wtNormalizeHardChangePath(path);
  var parts = String(normalizedPath).split('.');
  var root;
  if (parts[0] === 'GM' || parts[0] === 'gm') { parts.shift(); root = GM; }
  else if (parts[0] === 'P' || parts[0] === 'p') { parts.shift(); root = P; }
  else root = GM;  // 默认 GM
  if (parts.length === 0) return false;
  if (root === GM) {
    var charChange = _wtResolveCharacterHardChange(parts);
    if (charChange && charChange.ch) {
      var charPath = (charChange.listName || 'chars') + '.' + charChange.index + '.' + charChange.field;
      var oldCharVal = (charChange.field === 'location')
        ? (charChange.ch.location || charChange.ch.place || charChange.ch.currentLocation || charChange.ch.loc || '')
        : charChange.ch[charChange.field];
      var scalar = _wtApplyScalarHardChange(oldCharVal, op || 'set', value);
      if (!scalar.ok) return false;
      if (charChange.field === 'location') _wtSetCharacterLocationHardChange(charChange.ch, scalar.value);
      else {
        charChange.ch[charChange.field] = scalar.value;
        var mirror = {};
        mirror[charChange.field] = scalar.value;
        _wtMirrorCharacterHardChange(charChange.ch.name, mirror, []);
      }
      _wtAfterHardChange(charPath, oldCharVal, scalar.value);
      return true;
    }
    // 军队按名解析（镜像人物处理·治"问天直改军队写到数组幽灵属性 armies['天龙军']、真军不动"的静默失败）
    var armyChange = _wtResolveArmyHardChange(parts);
    if (armyChange && armyChange.army) {
      var _a = armyChange.army, _f = armyChange.field;
      var _armyPath = 'armies.' + armyChange.index + '.' + _f;
      if (_f === 'commander') {
        var _cmdVal = String(value == null ? '' : value).trim();
        var _oldCmd = String(_a.commander == null ? '' : _a.commander);  // 真 old（原传 ''·撤销快照/变更日志都需要真值）
        try {
          if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && typeof TM.AIChange.Army.applyAIArmyChange === 'function') {
            TM.AIChange.Army.applyAIArmyChange({ armyName: _a.name, commander: _cmdVal, reason: '问天直改主帅' }, { source: 'wentian.hardChange' });
          } else { _a.commander = _cmdVal; }
        } catch (_wtCmdE) { _a.commander = _cmdVal; }
        _wtAfterHardChange(_armyPath, _oldCmd, _cmdVal);
        return true;
      }
      var _oldA = _a[_f];
      var _ascalar = _wtApplyScalarHardChange(_oldA, op || 'set', value);
      if (!_ascalar.ok) return false;
      var _numFields = { soldiers:1, morale:1, training:1, supply:1, loyalty:1, control:1, mutinyRisk:1, payArrearsMonths:1 };
      var _nv = _ascalar.value;
      if (_numFields[_f]) {
        _nv = Math.round(Number(_nv) || 0);
        if (_f === 'morale' || _f === 'training' || _f === 'supply' || _f === 'loyalty' || _f === 'control' || _f === 'mutinyRisk') _nv = Math.max(0, Math.min(100, _nv));
        else _nv = Math.max(0, _nv);
      }
      _a[_f] = _nv;
      if (_f === 'soldiers') { _a.size = _nv; _a.strength = _nv; }   // 与 applier 同口径同步别名
      if (_f === 'control') { _a.controlLevel = _nv; }
      try { if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && TM.AIChange.Army.refreshMilitaryViews) TM.AIChange.Army.refreshMilitaryViews(GM); } catch (_wtRmvE) {}
      _wtAfterHardChange(_armyPath, _oldA, _nv);
      return true;
    }
    // 阶层按名解析（镜像军队/人物）·治"问天改 classes[农户].满意度 写到数组幽灵属性、真阶层不动"的静默失败。
    // 问天=god-mode 直改·满意度/影响力直写真阶层对象(0-100 夹取)·不走 gateSatisfaction 总闸(那是每回合信号预算·此处是显式覆盖)。
    var classChange = _wtResolveClassHardChange(parts);
    if (classChange && classChange.cls) {
      var _cls = classChange.cls, _cf = classChange.field;
      var _classPath = classChange.listName + '.' + classChange.index + '.' + _cf;
      var _oldC = _cls[_cf];
      var _cscalar = _wtApplyScalarHardChange(_oldC, op || 'set', value);
      if (!_cscalar.ok) return false;
      var _cnv = Math.round(Number(_cscalar.value) || 0);
      if (_cf === 'population') _cnv = Math.max(0, _cnv);
      else _cnv = Math.max(0, Math.min(100, _cnv)); // satisfaction/influence/cohesion 0-100
      _cls[_cf] = _cnv;
      try { if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.refreshClassPhase === 'function') TM.ClassEngine.refreshClassPhase(GM, _cls); } catch (_wtClsE) {}
      _wtAfterHardChange(_classPath, _oldC, _cnv);
      return true;
    }
    // 势力按名解析（镜像阶层/军队·治"问天改 facs[后金].实力 写到数组幽灵属性、真势力不动"的静默失败）。
    // 问天=god-mode 直改·实力/经济/对玩家关系直写真势力对象（strength/economy 0-100·playerRelation -100..100 夹取）。
    var facChange = _wtResolveFacHardChange(parts);
    if (facChange && facChange.fac) {
      var _fac = facChange.fac, _ff = facChange.field;
      var _facPath = 'facs.' + facChange.index + '.' + _ff;
      var _oldF = _fac[_ff];
      var _fscalar = _wtApplyScalarHardChange(_oldF, op || 'set', value);
      if (!_fscalar.ok) return false;
      var _fnv = Math.round(Number(_fscalar.value) || 0);
      if (_ff === 'playerRelation') _fnv = Math.max(-100, Math.min(100, _fnv));
      else _fnv = Math.max(0, Math.min(100, _fnv)); // strength/economy 0-100
      _fac[_ff] = _fnv;
      _wtAfterHardChange(_facPath, _oldF, _fnv);
      return true;
    }
    // 党派按名解析（镜像势力·治"问天改 parties[东林党].影响力 写到数组幽灵属性、真党派不动"的静默失败）。
    var partyChange = _wtResolvePartyHardChange(parts);
    if (partyChange && partyChange.party) {
      var _pty = partyChange.party, _pf = partyChange.field;
      var _ptyPath = 'parties.' + partyChange.index + '.' + _pf;
      var _oldP = _pty[_pf];
      var _pscalar = _wtApplyScalarHardChange(_oldP, op || 'set', value);
      if (!_pscalar.ok) return false;
      var _pnv = Math.max(0, Math.min(100, Math.round(Number(_pscalar.value) || 0))); // influence/cohesion 0-100
      _pty[_pf] = _pnv;
      _wtAfterHardChange(_ptyPath, _oldP, _pnv);
      return true;
    }
    // 区划按名解析（治"问天改 divisions[顺天府].economyBase.farmland → 通用导航写 GM.economyBase 幽灵对象、真区划不动"）
    var divChange = _wtResolveDivisionHardChange(parts);
    if (divChange && divChange.div) {
      var _dvo = divChange.div, _dfp = divChange.field.split('.');
      var _dCur = _dvo;
      for (var _di = 0; _di < _dfp.length - 1; _di++) {
        var _dk = _dfp[_di];
        if (_dCur[_dk] == null || typeof _dCur[_dk] !== 'object') _dCur[_dk] = {};
        _dCur = _dCur[_dk];
      }
      var _dLast = _dfp[_dfp.length - 1];
      var _dOld = _dCur[_dLast];
      var _dscalar = _wtApplyScalarHardChange(_dOld, op || 'set', value);
      if (!_dscalar.ok) return false;
      var _dnv = _dscalar.value;
      if (divChange.field === 'minxin' || divChange.field === 'corruption') _dnv = Math.max(0, Math.min(100, Math.round(Number(_dnv) || 0)));
      else if (isFinite(Number(_dnv))) _dnv = Math.max(0, Math.round(Number(_dnv) || 0));
      _dCur[_dLast] = _dnv;
      _wtAfterHardChange('divisions.' + (_dvo.name || '') + '.' + divChange.field, _dOld, _dnv);
      return true;
    }
    // 官职公库按名解析（officeTree 按职名找席位·只认 publicTreasury·任免归官制系统）
    var offChange = _wtResolveOfficeHardChange(parts);
    if (offChange && offChange.pos) {
      var _opos = offChange.pos;
      var _oOld = Number(_opos.publicTreasury) || 0;
      var _oscalar = _wtApplyScalarHardChange(_oOld, op || 'set', value);
      if (!_oscalar.ok) return false;
      var _onv = Math.max(0, Math.round(Number(_oscalar.value) || 0));
      _opos.publicTreasury = _onv;
      _wtAfterHardChange('officeTree.' + (_opos.name || '') + '.publicTreasury', _oOld, _onv);
      return true;
    }
    // 人力/徭役农政 god-mode（R5·镜像阶层/军队·治"问天改丁/田/役写数组幽灵属性、真账不动"静默失败·逻辑在 tm-renli）
    try { if (typeof TM !== 'undefined' && TM.Renli && typeof TM.Renli.wtHardChange === 'function' && TM.Renli.wtHardChange(GM, (typeof P !== 'undefined' ? P : null), parts, op, value, _wtAfterHardChange)) return true; } catch (_wtRlE) {}
  }
  // 幽灵键闸：hardChange 档默认拒创建新根·absolute 档 opts.allowCreate 放行（2026-07-10）
  if (!(opts && opts.allowCreate)) {
    var _navGate = _wtGenericNavGate(root, parts);
    if (!_navGate.ok) return false;
  }
  // 导航到父对象
  var cur = root;
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  var lastKey = parts[parts.length - 1];
  var oldVal = cur[lastKey];
  var applied = _wtApplyScalarHardChange(oldVal, op || 'set', value);
  if (!applied.ok) return false;
  cur[lastKey] = applied.value;
  if (root === GM) _wtSyncHardChangeSideEffects(parts, cur[lastKey]);
  // 立即刷新 UI·让玩家看到数值变化——原只刷 renderLeftPanel 不够·补全帑廪/内帑/七变量/整体
  _wtAfterHardChange(normalizedPath, oldVal, cur[lastKey]);
  return true;
}

function _wtReviseFromPending() {
  var p = _wtPending; if (!p) return;
  var inp = _$('wt-input');
  if (inp) {
    inp.value = p.raw + '\n\n（补充澄清：）';
    inp.focus();
    // 移光标到末尾
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  var cb = _$('wt-confirm-box'); if (cb) cb.remove();
  GM._wentianHistory.push({ role: 'system', content: '\u26B2 \u8BF7\u8865\u5145\u6F84\u6E05\u540E\u518D\u53D1' });
  _wtPending = null;
  _wtRenderHistory();
}

function _wtCancelPending() {
  _wtPending = null;
  var cb = _$('wt-confirm-box'); if (cb) cb.remove();
  GM._wentianHistory.push({ role: 'system', content: '\u274C \u5DF2\u53D6\u6D88\u5F55\u5165' });
  _wtRenderHistory();
}

/** 导入文档 */
function _wtImportDoc() {
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.md,.json,.log';
  fileInput.onchange = function() {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      if (!GM._importedMemories) GM._importedMemories = [];
      GM._importedMemories.push({ title: file.name, content: text, type: 'document', turn: GM.turn });
      if (!GM._wentianHistory) GM._wentianHistory = [];
      GM._wentianHistory.push({ role: 'player', content: '\u3010\u5BFC\u5165\u6587\u6863\u3011' + file.name + ' (' + Math.round(text.length/1000) + 'KB)', turn: GM.turn });
      GM._wentianHistory.push({ role: 'system', content: '\u2705 \u6587\u6863\u5DF2\u5BFC\u5165\u4E3A\u63A8\u6F14\u4E0A\u4E0B\u6587\u3002AI\u5C06\u5728\u63A8\u6F14\u65F6\u53C2\u8003\u6B64\u6587\u6863\u5185\u5BB9\u3002' });
      _wtRenderHistory();
      toast('\u6587\u6863\u5DF2\u5BFC\u5165\uFF1A' + file.name);
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

/** 导入对话记录作为NPC记忆 */
function _wtImportMemory() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem;max-width:500px;width:95%;">'
    + '<div style="font-size:var(--text-sm);color:var(--gold-400);margin-bottom:var(--space-2);">\u6CE8\u5165\u8BB0\u5FC6</div>'
    + '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-2);">\u7C98\u8D34\u5BF9\u8BDD\u8BB0\u5F55\u6216\u6587\u5B57\uFF0C\u4F5C\u4E3ANPC\u8BB0\u5FC6\u6216\u5168\u5C40\u80CC\u666F\u6CE8\u5165\u63A8\u6F14</div>'
    + '<div style="margin-bottom:var(--space-2);"><label style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u76EE\u6807NPC\uFF08\u7559\u7A7A=\u5168\u5C40\u80CC\u666F\uFF09</label>'
    + '<input id="wt-mem-target" placeholder="\u89D2\u8272\u540D\uFF08\u53EF\u7559\u7A7A\uFF09" style="width:100%;padding:3px 6px;font-size:var(--text-xs);background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:inherit;margin-top:2px;"></div>'
    + '<div style="margin-bottom:var(--space-2);"><label style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u8BB0\u5FC6\u5185\u5BB9</label>'
    + '<textarea id="wt-mem-content" rows="8" placeholder="\u7C98\u8D34\u5BF9\u8BDD\u8BB0\u5F55\u6216\u80CC\u666F\u6587\u5B57\u2026" style="width:100%;padding:0.4rem;font-size:var(--text-xs);font-family:inherit;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-foreground);margin-top:2px;resize:vertical;"></textarea></div>'
    + '<div style="display:flex;gap:var(--space-2);justify-content:flex-end;">'
    + '<button class="bt bp" onclick="_wtDoImportMemory();this.closest(\'div[style*=fixed]\').remove();">\u6CE8\u5165</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}

function _wtDoImportMemory() {
  var target = (_$('wt-mem-target')||{}).value || '';
  var content = (_$('wt-mem-content')||{}).value || '';
  if (!content.trim()) { toast('\u8BF7\u8F93\u5165\u8BB0\u5FC6\u5185\u5BB9'); return; }

  if (target.trim()) {
    // 写入特定NPC记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(target.trim(), content.trim(), '\u5E73', 8, '\u5916\u90E8\u5BFC\u5165');
      toast('\u5DF2\u6CE8\u5165' + target + '\u7684\u8BB0\u5FC6');
    }
  }
  // 同时存入全局imported memories（供AI推演参考）
  if (!GM._importedMemories) GM._importedMemories = [];
  GM._importedMemories.push({ title: target ? '\u8BB0\u5FC6\u6CE8\u5165\u2192' + target : '\u5168\u5C40\u80CC\u666F', content: content.trim(), type: 'memory', target: target.trim(), turn: GM.turn });
  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'player', content: '\u3010\u8BB0\u5FC6\u6CE8\u5165\u3011' + (target ? target + '\uFF1A' : '\u5168\u5C40\uFF1A') + content.trim().slice(0,50) + '\u2026', turn: GM.turn });
  GM._wentianHistory.push({ role: 'system', content: '\u2705 \u8BB0\u5FC6\u5DF2\u6CE8\u5165\u3002' + (target ? target + '\u5C06\u8BB0\u4F4F\u6B64\u5185\u5BB9\u3002' : '\u5DF2\u4F5C\u4E3A\u5168\u5C40\u63A8\u6F14\u80CC\u666F\u3002') });
  _wtRenderHistory();
}

/** 清除所有玩家指令 */
function _wtClearDirectives() {
  if (!confirm('\u786E\u5B9A\u6E05\u9664\u6240\u6709\u7384\u5929\u6307\u4EE4\uFF1F')) return;
  GM._playerDirectives = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'system', content: '\u6240\u6709\u6307\u4EE4\u5DF2\u6E05\u9664\u3002' });
  _wtRenderHistory();
  toast('\u6307\u4EE4\u5DF2\u6E05\u9664');
}

// ═══ 问天升级批（2026-07-21·两刀·flag 默认 OFF·设置→性能可开）════════════════════
// 刀A 兑现对账：推演 AI 的合规回报(directive_compliance)是自报作业——本刀在回合末用在档真值
//   对 watch 指标做确定性复核·盖进既有 _lastStatus 徽章体系（_lastReason 带「⚖︎对账」前缀·
//   与 AI 自报可区分且能纠正它）。P.conf.wentianFulfillAudit === true 才启用。
// 刀B 直改撤销：hardChange 档落笔时经 _wtAfterHardChange 快照 before 值·当回合内一键回滚
//   （replay 走同一 _wtApplyHardChange·别名/镜像/UI 刷新随之复原）。天意 allowCreate 造物不可撤。
//   P.conf.wentianUndo === true 才启用。

// ── 只读取值（对账基线/现值用·复用七类 resolver·绝不创建任何字段）──
function _wtReadHardChangeValue(path) {
  try {
    var normalizedPath = _wtNormalizeHardChangePath(path);
    var parts = String(normalizedPath).split('.');
    var root;
    if (parts[0] === 'GM' || parts[0] === 'gm') { parts.shift(); root = (typeof GM !== 'undefined') ? GM : null; }
    else if (parts[0] === 'P' || parts[0] === 'p') { parts.shift(); root = (typeof P !== 'undefined') ? P : null; }
    else root = (typeof GM !== 'undefined') ? GM : null;
    if (!root || !parts.length || !parts[0]) return { ok: false };
    if (typeof GM !== 'undefined' && root === GM) {
      var r;
      if ((r = _wtResolveCharacterHardChange(parts)) && r.ch) {
        var v = (r.field === 'location')
          ? (r.ch.location || r.ch.place || r.ch.currentLocation || r.ch.loc || '')
          : r.ch[r.field];
        return { ok: true, value: v };
      }
      if ((r = _wtResolveArmyHardChange(parts)) && r.army) return { ok: true, value: r.army[r.field] };
      if ((r = _wtResolveClassHardChange(parts)) && r.cls) return { ok: true, value: r.cls[r.field] };
      if ((r = _wtResolveFacHardChange(parts)) && r.fac) return { ok: true, value: r.fac[r.field] };
      if ((r = _wtResolvePartyHardChange(parts)) && r.party) return { ok: true, value: r.party[r.field] };
      if ((r = _wtResolveDivisionHardChange(parts)) && r.div) {
        var cur = r.div, fp = r.field.split('.');
        for (var i = 0; i < fp.length; i++) {
          if (cur == null || typeof cur !== 'object') return { ok: false };
          cur = cur[fp[i]];
        }
        return { ok: true, value: cur };
      }
      if ((r = _wtResolveOfficeHardChange(parts)) && r.pos) return { ok: true, value: Number(r.pos.publicTreasury) || 0 };
      if (/^(region|地域|丁口|田|田土|役|役政)$/i.test(String(parts[0]))) return { ok: false };  // renli 无只读探针·不入对账
    }
    // generic 只读导航（'in' 逐级核在·绝不创建）
    var cur2 = root;
    for (var j = 0; j < parts.length; j++) {
      if (cur2 == null || typeof cur2 !== 'object' || !(parts[j] in cur2)) return { ok: false };
      cur2 = cur2[parts[j]];
    }
    return { ok: true, value: cur2 };
  } catch (_) { return { ok: false }; }
}

// ── 刀A·watch 注册（确认入库前调）：逐条校验可读性并快照基线·全不可读→null（诚实：不做假对账）──
function _wtRegisterWatch(watchArr) {
  if (!Array.isArray(watchArr) || !watchArr.length) return null;
  var okExpect = { increase: 1, decrease: 1, gte: 1, lte: 1, eq: 1, change: 1 };
  var items = [], baseline = {};
  for (var i = 0; i < watchArr.length && items.length < 6; i++) {
    var w = watchArr[i];
    if (!w || !w.path || !okExpect[String(w.expect || '')]) continue;
    var cur = _wtReadHardChangeValue(w.path);
    if (!cur.ok) continue;
    items.push({ path: String(w.path), expect: String(w.expect), value: (w.value != null ? w.value : null), note: String(w.note || '').slice(0, 40) });
    baseline[String(w.path)] = cur.value;
  }
  if (!items.length) return null;
  return { items: items, baseline: baseline, registeredTurn: (typeof GM !== 'undefined' && GM && GM.turn) || 0 };
}

function _wtJudgeWatchItem(item, baseVal, curOk, curVal) {
  if (!curOk) return { met: false, text: '读不到现值' };
  var nb = Number(baseVal), nc = Number(curVal), nv = Number(item.value);
  var text = String(baseVal) + '→' + String(curVal);
  switch (item.expect) {
    case 'increase': return { met: isFinite(nc) && isFinite(nb) && nc > nb, text: text };
    case 'decrease': return { met: isFinite(nc) && isFinite(nb) && nc < nb, text: text };
    case 'gte': return { met: isFinite(nc) && isFinite(nv) && nc >= nv, text: '现' + String(curVal) + '/须≥' + String(item.value) };
    case 'lte': return { met: isFinite(nc) && isFinite(nv) && nc <= nv, text: '现' + String(curVal) + '/须≤' + String(item.value) };
    case 'eq': return { met: (isFinite(nc) && isFinite(nv)) ? nc === nv : String(curVal) === String(item.value), text: '现' + String(curVal) + '/须=' + String(item.value) };
    case 'change': return { met: String(curVal) !== String(baseVal), text: text };
  }
  return { met: false, text: text };
}

// ── 刀A·回合末对账（tm-endturn-render 收尾调·同回合幂等·多 pass 结算安全）──
function _wtRunFulfillAudit() {
  try {
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM._playerDirectives)) return;
    if (!(typeof P !== 'undefined' && P && P.conf && P.conf.wentianFulfillAudit === true)) return;  // 默认 OFF
    var turn = GM.turn || 0;
    if (GM._wtAuditTurn === turn) return;  // arch-ok 问天对账回合戳·同回合多 pass 只审一次(与 _directivesAppliedTurn 同范式)
    GM._wtAuditTurn = turn;  // arch-ok 同上
    var stamps = [];
    GM._playerDirectives.forEach(function (d) {
      if (!d || !d._watch || !Array.isArray(d._watch.items) || !d._watch.items.length) return;
      if (d._watch.registeredTurn === turn) return;  // 注册当回合不对账（推演还没跑）
      var met = 0, parts = [];
      d._watch.items.forEach(function (it) {
        var cur = _wtReadHardChangeValue(it.path);
        var j = _wtJudgeWatchItem(it, d._watch.baseline[it.path], cur.ok, cur.ok ? cur.value : null);
        if (j.met) met++;
        parts.push((j.met ? '✓' : '✗') + (it.note || it.path) + '(' + j.text + ')');
      });
      var status = met === d._watch.items.length ? 'followed' : (met > 0 ? 'partial' : 'ignored');
      var prev = d._watch.lastStatus;
      d._lastStatus = status;
      d._lastReason = '⚖︎对账 ' + met + '/' + d._watch.items.length + '：' + parts.join('；');
      d._lastCheckTurn = turn;
      d._watch.lastStatus = status;
      if (prev !== status) {
        stamps.push('《' + String(d.content || '').slice(0, 18) + '》' + met + '/' + d._watch.items.length
          + (status === 'followed' ? ' 已兑现' : status === 'partial' ? ' 部分兑现' : ' 未见兑现'));
      }
    });
    if (stamps.length) {
      if (!GM._wentianHistory) GM._wentianHistory = [];  // arch-ok 问天历史容器惰性初始化·与本文件既有范式同
      var _faLine = '⚖︎ 兑现对账·T' + turn + '：' + stamps.join('；');
      GM._wentianHistory.push({ role: 'system', content: _faLine });  // arch-ok 问天历史行·与本文件既有 _wentianHistory push 同容器同性质(刀A对账戳)
    }
  } catch (_wtFaErr) {}
}

// ── 刀B·撤销快照窗口 + 一键回滚 ──
var _wtUndoCaptureBuf = null;
function _wtBeginUndoCapture() { _wtUndoCaptureBuf = []; }
function _wtEndUndoCapture() { var r = _wtUndoCaptureBuf; _wtUndoCaptureBuf = null; return r || []; }

function _wtUndoHardChange(did) {
  try {
    if (!(typeof P !== 'undefined' && P && P.conf && P.conf.wentianUndo === true)) return;
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM._playerDirectives)) return;
    var d = null;
    for (var i = 0; i < GM._playerDirectives.length; i++) {
      if (GM._playerDirectives[i] && GM._playerDirectives[i].id === did) { d = GM._playerDirectives[i]; break; }
    }
    if (!d || !d._undoSnapshot || d._undone) return;
    if ((GM.turn || 0) !== d._undoSnapshot.turn) {
      if (typeof toast === 'function') toast('已过回合·不可撤销');
      return;
    }
    var cs = d._undoSnapshot.changes || [], okN = 0;
    for (var k = cs.length - 1; k >= 0; k--) {  // 逆序回滚
      if (_wtApplyHardChange(cs[k].reqPath, 'set', cs[k].old)) okN++;
    }
    d._undone = true;
    d._lastReason = '玩家已撤销(' + okN + '/' + cs.length + ')';
    if (!GM._wentianHistory) GM._wentianHistory = [];  // arch-ok 问天历史容器惰性初始化·与本文件既有范式同
    var _udLine = '↩ 已撤销直改 ' + okN + '/' + cs.length + ' 笔：' + cs.map(function (c2) { return c2.reqPath + '→' + c2.old; }).join('；') + ' [id=' + did + ']';
    GM._wentianHistory.push({ role: 'system', content: _udLine });  // arch-ok 问天历史行·与本文件既有 _wentianHistory push 同容器同性质(刀B撤销记录)
    if (typeof _wtRenderHistory === 'function') _wtRenderHistory();
    if (typeof toast === 'function') toast('已撤销 ' + okN + ' 笔直改');
  } catch (_wtUndoErr) {}
}
