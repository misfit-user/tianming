// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-patches-start.js — 剧本启动链（2026-07-04 立项拆分·自 tm-patches.js 保序切出）
 *  内容：_tmStart* 启动帮手族/开场白·入世仪典 overlay/startGame 完整替换/doActualStart(剧本装载主流程)
 *  尾段唯一装载期语句 = startGame=async function 裸赋值(保序随行·执行点与拆分前逐字节等价)
 *  加载序：index.html 中紧挨 tm-patches.js 之后——勿改
 * ═══════════════════════════════════════════════════════════════════════ */
// 开场白动画（完全替换 startGame，doActualStart 内部调用 GameHooks）
function _tmStartHasRegions(map) {
  return !!(map && Array.isArray(map.regions) && map.regions.length > 0);
}

function _tmStartClone(value) {
  if (typeof deepClone === 'function') return deepClone(value);
  try { return JSON.parse(JSON.stringify(value)); } catch(_) { return value; }
}

function _tmStartIsOfficialTianqi(sid) {
  return String(sid || '') === 'sc-tianqi7-1627';
}

function _tmStartApplyOfficialSnapshot(sid, reason) {
  if (!_tmStartIsOfficialTianqi(sid)) return;
  if (typeof window === 'undefined' || typeof window.TM_TIANQI_APPLY_OFFICIAL_RUNTIME_SNAPSHOT !== 'function') return;
  try {
    window.TM_TIANQI_APPLY_OFFICIAL_RUNTIME_SNAPSHOT();
  } catch(e) {
    try {
      if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-snapshot-' + (reason || 'unknown'));
    } catch(_) {}
  }
}

function _tmStartFindScenario(sid, reason) {
  _tmStartApplyOfficialSnapshot(sid, reason);
  return (typeof findScenarioById === 'function') ? findScenarioById(sid) : null;
}

function _tmStartSidRows(key, sid, sc) {
  if (typeof P === 'undefined' || !P) return [];
  if (!Array.isArray(P[key])) P[key] = [];
  var rows = P[key].filter(function(row) { return row && (!row.sid || row.sid === sid); });
  if (rows.length === 0 && sc && Array.isArray(sc[key]) && sc[key].length > 0) {
    P[key] = P[key].filter(function(row) { return row && row.sid !== sid; });
    sc[key].forEach(function(row) {
      var copy = _tmStartClone(row);
      if (copy && typeof copy === 'object') copy.sid = sid;
      P[key].push(copy);
    });
    rows = P[key].filter(function(row) { return row && (!row.sid || row.sid === sid); });
  }
  return rows;
}

function _tmStartVariableRows(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  var out = [];
  if (Array.isArray(source.base)) {
    source.base.forEach(function(v) {
      var copy = _tmStartClone(v);
      if (copy && typeof copy === 'object') copy._category = copy._category || 'base';
      out.push(copy);
    });
  }
  if (Array.isArray(source.other)) {
    source.other.forEach(function(v) {
      var copy = _tmStartClone(v);
      if (copy && typeof copy === 'object') copy._category = copy._category || 'other';
      out.push(copy);
    });
  }
  return out;
}

function _tmStartLoadVars(sid, sc) {
  if (typeof GM === 'undefined' || !GM || typeof P === 'undefined' || !P) return 0;
  var rows = _tmStartVariableRows(P.variables).filter(function(v) { return v && (!v.sid || v.sid === sid); });
  if (rows.length === 0 && sc && sc.variables) rows = _tmStartVariableRows(sc.variables);
  if (rows.length === 0) return 0;
  if (!Array.isArray(P.variables) || P.variables.length === 0) P.variables = rows.map(function(v) {
    var copy = _tmStartClone(v);
    if (copy && typeof copy === 'object' && !copy.sid) copy.sid = sid;
    return copy;
  });
  if (!GM.vars || typeof GM.vars !== 'object') GM.vars = {};
  rows.forEach(function(v) {
    if (!v || !v.name) return;
    var gv = _tmStartClone(v);
    if (gv.value === undefined) gv.value = parseFloat(gv.defaultValue) || parseFloat(gv.initial) || parseFloat(gv.default) || 0;
    gv.value = parseFloat(gv.value) || 0;
    if (gv.min === undefined && gv.minimum !== undefined) gv.min = gv.minimum;
    if (gv.max === undefined && gv.maximum !== undefined) gv.max = gv.maximum;
    if (gv.min === undefined) gv.min = 0;
    if (gv.max === undefined) gv.max = Math.max(100, Math.abs(gv.value) * 10);
    gv.min = parseFloat(gv.min) || 0;
    gv.max = parseFloat(gv.max) || 100;
    if (gv.max <= gv.min) gv.max = gv.min + 100;
    GM.vars[gv.name] = gv;
  });
  return Object.keys(GM.vars || {}).length;
}

function _tmStartMapSource(sc, allowDisabled) {
  if (typeof GM !== 'undefined' && _tmStartHasRegions(GM.mapData)) return GM.mapData;
  if (typeof P !== 'undefined' && P) {
    if (_tmStartHasRegions(P.map) && (allowDisabled || P.map.enabled !== false)) return P.map;
    if (_tmStartHasRegions(P.mapData) && (allowDisabled || P.mapData.enabled !== false)) return P.mapData;
  }
  if (sc) {
    if (_tmStartHasRegions(sc.map) && (allowDisabled || sc.map.enabled !== false)) return sc.map;
    if (_tmStartHasRegions(sc.mapData) && (allowDisabled || sc.mapData.enabled !== false)) return sc.mapData;
  }
  return null;
}

function _tmStartBindMap(sourceMap) {
  if (!_tmStartHasRegions(sourceMap)) return null;
  var live = null;
  if (typeof bindRuntimeMapState === 'function') {
    try { live = bindRuntimeMapState(sourceMap); } catch(_) { live = null; }
  }
  if (!_tmStartHasRegions(live)) {
    live = _tmStartClone(sourceMap);
    if (typeof GM !== 'undefined' && GM) GM.mapData = live;
    if (typeof P !== 'undefined' && P) {
      P.map = live;
      P.mapData = live;
    }
  }
  if (live) live.enabled = true;
  return live;
}

function _tmStartConsumeMapChoice(sid) {
  if (typeof window === 'undefined') return true;
  var choice = window._pendingUseMap;
  var choiceSid = window._pendingMapModeSid;
  var choiceAt = Number(window._pendingMapModeAt || 0);
  var fresh = (choiceSid === sid) && (!choiceAt || (Date.now() - choiceAt < 30 * 60 * 1000));
  delete window._pendingUseMap;
  delete window._pendingMapModeSid;
  delete window._pendingMapModeAt;
  if (choice === false && fresh) return false;
  return true;
}

function _tmStartApplyMapChoice(sid, sc) {
  var useMap = _tmStartConsumeMapChoice(sid);
  if (useMap === false) {
    if (typeof P !== 'undefined' && P) {
      P.map = P.map || {};
      P.map.enabled = false;
      P.map.regions = [];
      P.map.roads = [];
      P.mapData = P.mapData || {};
      P.mapData.enabled = false;
      P.mapData.regions = [];
    }
    if (typeof GM !== 'undefined' && GM) {
      GM.mapData = null;
      GM._useAIGeo = true;
    }
    return false;
  }
  if (typeof GM !== 'undefined' && GM) GM._useAIGeo = false;
  var source = _tmStartMapSource(sc, true);
  if (source) _tmStartBindMap(source);
  return true;
}

function _tmStartRepairRuntimeData(sid, sc, reason) {
  if (typeof GM === 'undefined' || !GM || typeof P === 'undefined' || !P) return null;
  var official = _tmStartIsOfficialTianqi(sid);
  if (official) {
    _tmStartApplyOfficialSnapshot(sid, reason || 'repair');
    sc = (typeof findScenarioById === 'function') ? findScenarioById(sid) : sc;
  }
  var report = { reason: reason || '', chars: 0, facs: 0, vars: 0, mapRegions: 0, fixed: [] };
  var minChars = official ? 30 : 1;
  var minFacs = official ? 5 : 1;
  var minVars = official ? 10 : 1;
  var minRegions = official ? 10 : 1;

  if (!Array.isArray(GM.chars) || GM.chars.length < minChars) {
    var charRows = _tmStartSidRows('characters', sid, sc);
    if (charRows.length >= minChars) {
      GM.chars = charRows.map(function(c) { return _tmStartClone(c); });
      report.fixed.push('chars');
    }
  }
  if (!Array.isArray(GM.facs) || GM.facs.length < minFacs) {
    var facRows = _tmStartSidRows('factions', sid, sc);
    if (facRows.length >= minFacs) {
      GM.facs = facRows.map(function(f) {
        var copy = _tmStartClone(f);
        if (copy && typeof copy === 'object') {
          if (!copy.vassals) copy.vassals = [];
          if (copy.liege === undefined) copy.liege = null;
          if (copy.tributeRate === undefined) copy.tributeRate = 0.3;
          if (!copy.territories) copy.territories = [];
        }
        return copy;
      });
      report.fixed.push('facs');
    }
  }
  if (!GM.vars || Object.keys(GM.vars).length < minVars) {
    var varCount = _tmStartLoadVars(sid, sc);
    if (varCount >= minVars) report.fixed.push('vars');
  }
  if (!GM._useAIGeo && (!_tmStartHasRegions(GM.mapData) || GM.mapData.regions.length < minRegions)) {
    var mapSource = _tmStartMapSource(sc, true);
    var live = _tmStartBindMap(mapSource);
    if (_tmStartHasRegions(live) && live.regions.length >= minRegions) report.fixed.push('map');
  } else if (_tmStartHasRegions(GM.mapData)) {
    P.map = GM.mapData;
    P.mapData = GM.mapData;
  }

  report.chars = Array.isArray(GM.chars) ? GM.chars.length : 0;
  report.facs = Array.isArray(GM.facs) ? GM.facs.length : 0;
  report.vars = GM.vars ? Object.keys(GM.vars).length : 0;
  report.mapRegions = _tmStartHasRegions(GM.mapData) ? GM.mapData.regions.length : 0;
  if (report.fixed.length) {
    try { console.warn('[StartRuntimeRepair]', report); } catch(_) {}
    try { if (typeof buildIndices === 'function' && (report.fixed.indexOf('chars') >= 0 || report.fixed.indexOf('facs') >= 0)) buildIndices(); } catch(_) {}
  }
  return report;
}

function _tmStartDynastyContext(sc) {
  var dynasty = (sc && (sc.dynasty || sc.era)) || (typeof GM !== 'undefined' && GM && GM.eraState && GM.eraState.dynasty) || '';
  var phase = (typeof GM !== 'undefined' && GM && GM.eraState && GM.eraState.dynastyPhase) || 'peak';
  return { dynasty: dynasty, phase: phase };
}

function _tmStartRefreshFormalShell() {
  try { if (typeof renderTopBarVars === 'function') renderTopBarVars(); } catch(_) {}
  try {
    if (typeof window !== 'undefined' && window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.refresh === 'function') {
      window.TMPhase8FormalBridge.refresh();
    }
  } catch(_) {}
}

function _tmStartPrimeFormalRuntime(sid, sc, reason) {
  if (typeof GM === 'undefined' || !GM) return null;
  sc = sc || ((typeof findScenarioById === 'function' && sid) ? findScenarioById(sid) : null);
  var ctx = _tmStartDynastyContext(sc);
  var fixed = [];

  try {
    if (GM.turn === 1 && !GM._corruptionPresetDone && typeof CorruptionEngine !== 'undefined' && typeof CorruptionEngine.initFromDynasty === 'function') {
      CorruptionEngine.initFromDynasty(ctx.dynasty, ctx.phase, sc || {});
      GM._corruptionPresetDone = true;
      fixed.push('corruption');
    } else if (typeof CorruptionEngine !== 'undefined' && typeof CorruptionEngine.ensureModel === 'function') {
      CorruptionEngine.ensureModel();
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-corruption'); } catch(_) {} }

  try {
    if (GM.turn === 1 && !GM._guokuPresetDone && typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.initFromDynasty === 'function') {
      GuokuEngine.initFromDynasty(ctx.dynasty, ctx.phase, sc || {});
      GM._guokuPresetDone = true;
      fixed.push('guoku');
    } else if (typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.ensureModel === 'function') {
      GuokuEngine.ensureModel();
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-guoku'); } catch(_) {} }

  // 开局即真活算财政收入（根治「绍宋月入显估算 20万/旧兜底 7万·实应 ~70万」）。
  // 此处在 GuokuEngine 加载静态估算之后、enterGame 之前·adminHierarchy 与各区 economyBase 均已就绪——
  // 跑一次 cascadeCollect(turnDays:30=月入口径) 用真活算值覆盖静态估算。settle 幂等·首回合会重算。
  try {
    if (typeof CascadeTax !== 'undefined' && CascadeTax && typeof CascadeTax.collect === 'function'
        && GM && GM.adminHierarchy && (GM.adminHierarchy.player || Object.keys(GM.adminHierarchy).length)) {
      CascadeTax.collect({ faction: 'player', turnDays: 30 });
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-fiscal'); } catch(_) {} }

  // 役政/人力开局种子（根治「役负舆图开局灰·GM.renli.byRegion 空」）：同收入·开局即种 renli 账，
  // 让役负视图(yizheng 层·读 GM.renli.byRegion)开局有真值，而非等第一回合 endturnTick 才有。幂等·首回合会重算。
  try {
    if (typeof TM !== 'undefined' && TM.Renli) {
      if (typeof TM.Renli.ensurePilotSeeds === 'function') TM.Renli.ensurePilotSeeds(GM);
      if (typeof TM.Renli.endturnTick === 'function') TM.Renli.endturnTick(GM, typeof P !== 'undefined' ? P : null);
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-renli'); } catch(_) {} }

  try {
    if (GM.turn === 1 && !GM._neitangPresetDone && typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.initFromDynasty === 'function') {
      NeitangEngine.initFromDynasty(ctx.dynasty, ctx.phase, sc || {});
      GM._neitangPresetDone = true;
      fixed.push('neitang');
    } else if (typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.ensureModel === 'function') {
      NeitangEngine.ensureModel();
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-neitang'); } catch(_) {} }

  try {
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.init === 'function') {
      HujiEngine.init(sc || {});
      fixed.push('population');
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-huji'); } catch(_) {} }

  try {
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.init === 'function') {
      AuthorityEngines.init();
      fixed.push('authority');
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-authority'); } catch(_) {} }

  try {
    if (!GM._useAIGeo && !_tmStartHasRegions(GM.mapData)) {
      var mapSource = _tmStartMapSource(sc, true);
      if (_tmStartBindMap(mapSource)) fixed.push('map');
    }
  } catch(e) { try { if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(e, 'start-prime-map'); } catch(_) {} }

  if (fixed.length) {
    try { console.warn('[StartRuntimePrime]', { reason: reason || '', fixed: fixed }); } catch(_) {}
  }
  _tmStartRefreshFormalShell();
  return fixed;
}

function _tmStartValidateScenarioBeforeLaunch(sc){
  // TM_START_GUARD: validate-scenario-before-start.
  if (typeof validateScenario !== 'function') return true;
  try {
    var validation = validateScenario(sc);
    if (!validation) return true;
    if (validation.valid === false) {
      var errors = Array.isArray(validation.errors) ? validation.errors : [];
      if (typeof toast === 'function') toast('\u5267\u672C\u9519\u8BEF: ' + errors.join('; '));
      try { console.error('[startGame] scenario validation failed:', errors); } catch(_) {}
      return false;
    }
    if (validation.warnings && validation.warnings.length > 0) {
      try { console.warn('[startGame] scenario validation warnings:', validation.warnings); } catch(_) {}
      try { if (typeof _dbg === 'function') _dbg('[startGame] validation warnings: ' + validation.warnings.join('; ')); } catch(_) {}
    }
  } catch(e) {
    if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'startGame scenario validation');
    else try { console.warn('[startGame scenario validation]', e); } catch(_) {}
    if (typeof toast === 'function') toast('\u5267\u672C\u6821\u9A8C\u5931\u8D25');
    return false;
  }
  return true;
}

function _tmStartConfirmModelRequirementsBeforeLaunch(sc){
  // TM_START_GUARD: model-requirements-warning-before-start.
  try {
    if (!sc || !sc.modelRequirements || !P || !P.ai || !P.ai.model) return true;
    var req = sc.modelRequirements;
    var warnings = [];
    var wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(P.ai.model) : 0;
    var wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(P.ai.model) : 0;
    var conf = P.conf || {};
    var measuredCtx = conf._detectedContextK || wlCtx;
    var measuredOutK = conf._measuredMaxOutput ? Math.round(conf._measuredMaxOutput / 1024) : (conf._detectedMaxOutput ? Math.round(conf._detectedMaxOutput / 1024) : wlOut);
    if (req.minContextK && measuredCtx > 0 && measuredCtx < req.minContextK) warnings.push('\u4E0A\u4E0B\u6587 ' + measuredCtx + 'K < \u63A8\u8350 ' + req.minContextK + 'K');
    if (req.minOutputK && measuredOutK > 0 && measuredOutK < req.minOutputK) warnings.push('\u8F93\u51FA ' + measuredOutK + 'K < \u63A8\u8350 ' + req.minOutputK + 'K\u00B7\u4E3B\u63A8\u6F14 JSON \u6613\u88AB\u622A\u65AD');
    if (warnings.length === 0) return true;
    var models = (req.recommendedModels || []).join('/').slice(0, 80);
    var msg = '\u26A0 \u672C\u5267\u672C\u63A8\u8350: ' + models
      + '\n\u5F53\u524D\u6A21\u578B: ' + P.ai.model
      + '\n\n\u68C0\u51FA\u95EE\u9898:\n  \u00B7 ' + warnings.join('\n  \u00B7 ')
      + '\n\n' + (req.warningThreshold || '')
      + '\n\n\u662F\u5426\u4ECD\u8981\u5F00\u59CB?';
    if (typeof confirm === 'function' && !confirm(msg)) {
      if (typeof toast === 'function') toast('\u5DF2\u53D6\u6D88\u00B7\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u66F4\u6362\u6A21\u578B\u6216\u91CD\u8DD1\u6A21\u578B\u80FD\u529B\u6821\u9A8C');
      return false;
    }
  } catch(e) {
    if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'M1 modelReq check');
    else try { console.warn('[M1 modelReq check]', e); } catch(_) {}
  }
  return true;
}

startGame=async function(sid){
  var sc=_tmStartFindScenario(sid, 'startGame-pre') || findScenarioById(sid);
  if(!sc){toast("\u672A\u627E\u5230");return;}
  if (!_tmStartValidateScenarioBeforeLaunch(sc)) return;
  if (!_tmStartConfirmModelRequirementsBeforeLaunch(sc)) return;
  _$("scn-page").classList.remove("show");
  _$("launch").style.display="none";

  // 加载流程
  showLoading("\u751F\u6210\u4E16\u754C\u4E2D",0);

  // 第一阶段：读取剧本数据
  var steps=[
    {text:"\u8BFB\u53D6\u5267\u672C\u57FA\u672C\u4FE1\u606F",progress:5},
    {text:"\u8BFB\u53D6\u4E16\u754C\u8BBE\u5B9A",progress:10},
    {text:"\u8BFB\u53D6\u89D2\u8272\u6570\u636E",progress:20},
    {text:"\u8BFB\u53D6\u52BF\u529B\u6570\u636E",progress:30},
    {text:"\u8BFB\u53D6\u7269\u54C1\u7CFB\u7EDF",progress:40},
    {text:"\u8BFB\u53D6\u4E8B\u4EF6\u7CFB\u7EDF",progress:50},
    {text:"\u8BFB\u53D6\u5B98\u5236\u7CFB\u7EDF",progress:55},
    {text:"\u8BFB\u53D6\u519B\u4E8B\u7CFB\u7EDF",progress:60},
    {text:"\u8BFB\u53D6\u79D1\u6280\u6811",progress:65},
    {text:"\u8BFB\u53D6\u5E02\u653F\u6811",progress:70}
  ];

  for(var i=0;i<steps.length;i++){
    showLoading(steps[i].text+"...",steps[i].progress);
    await new Promise(function(r){setTimeout(r,200);});
  }

  // 第二阶段：AI 配置世界（如果配置了 AI）
  if(P.ai.key){
    showLoading("\u63A2\u6D4B\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3...",71);
    try {
      var _detK = await detectModelContextSize();
      showLoading("\u6A21\u578B\u4E0A\u4E0B\u6587: " + _detK + "K tokens",72);
      await new Promise(function(r){setTimeout(r,500);});
    } catch(_detErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_detErr, 'CtxDetect] 探测失败，使用默认值:') : console.warn('[CtxDetect] 探测失败，使用默认值:', _detErr); }
    showLoading("\u8FDE\u63A5AI\u7CFB\u7EDF...",72);
    await new Promise(function(r){setTimeout(r,300);});

    // 1. AI 读取并理解剧本基本信息
    showLoading("AI\u8BFB\u53D6\u5267\u672C\u57FA\u672C\u4FE1\u606F...",74);
    await new Promise(function(r){setTimeout(r,300);});

    // 2. AI 读取世界设定
    showLoading("AI\u8BFB\u53D6\u4E16\u754C\u8BBE\u5B9A...",76);
    await new Promise(function(r){setTimeout(r,300);});

    // 3. AI 读取角色信息
    var chars = P.characters.filter(function(c){return c.sid===sid;});
    if(chars.length > 0){
      showLoading("AI\u8BFB\u53D6\u89D2\u8272\u4FE1\u606F\uFF08" + chars.length + "\u4EBA\uFF09...",78);
      await new Promise(function(r){setTimeout(r,300);});
    }

    // 4. AI 读取势力信息
    var facs = P.factions.filter(function(f){return f.sid===sid;});
    if(facs.length > 0){
      showLoading("AI\u8BFB\u53D6\u52BF\u529B\u4FE1\u606F\uFF08" + facs.length + "\u4E2A\uFF09...",80);
      await new Promise(function(r){setTimeout(r,300);});
    }

    // 5. AI 统筹整合
    showLoading("AI\u7EDF\u7B79\u6574\u5408\u4E16\u754C\u6570\u636E...",82);
    await new Promise(function(r){setTimeout(r,500);});

    // 6. 生成开场白（如果需要）
    if(!sc.opening||sc.opening.length<50){
      showLoading("AI\u751F\u6210\u5F00\u573A\u767D...",85);
      try{
        // 构建完整的剧本上下文
        var contextPrompt = "\u4F60\u662FAI\u4E16\u754C\u914D\u7F6E\u7CFB\u7EDF\uFF0C\u8BF7\u6839\u636E\u4EE5\u4E0B\u5B8C\u6574\u7684\u5267\u672C\u6570\u636E\u751F\u6210\u5F00\u573A\u767D\u3002\n\n";

        contextPrompt += "\u3010\u5267\u672C\u57FA\u672C\u4FE1\u606F\u3011\n";
        contextPrompt += "\u540D\u79F0\uFF1A" + sc.name + "\n";
        contextPrompt += "\u65F6\u4EE3\uFF1A" + sc.era + "\n";
        contextPrompt += "\u89D2\u8272\uFF1A" + sc.role + "\n";
        if(sc.background) contextPrompt += "\u80CC\u666F\uFF1A" + sc.background + "\n";
        if(sc.overview) contextPrompt += "\u6982\u8FF0\uFF1A" + sc.overview + "\n";

        // 添加世界设定
        if(P.world && (P.world.history || P.world.politics || P.world.culture)){
          contextPrompt += "\n\u3010\u4E16\u754C\u8BBE\u5B9A\u3011\n";
          if(P.world.history) contextPrompt += "\u5386\u53F2\u80CC\u666F\uFF1A" + P.world.history.substring(0, 300) + (P.world.history.length > 300 ? "..." : "") + "\n";
          if(P.world.politics) contextPrompt += "\u653F\u6CBB\u683C\u5C40\uFF1A" + P.world.politics.substring(0, 300) + (P.world.politics.length > 300 ? "..." : "") + "\n";
          if(P.world.culture) contextPrompt += "\u6587\u5316\u7279\u8272\uFF1A" + P.world.culture.substring(0, 300) + (P.world.culture.length > 300 ? "..." : "") + "\n";
        }

        // 添加角色信息
        if(chars.length > 0){
          contextPrompt += "\n\u3010\u89D2\u8272\u5217\u8868\u3011\uFF08\u5171" + chars.length + "\u4EBA\uFF09\n";
          chars.slice(0, 15).forEach(function(c){
            contextPrompt += "- " + c.name;
            if(c.title) contextPrompt += "\uFF08" + c.title + "\uFF09";
            if(c.faction) contextPrompt += " \u6240\u5C5E\uFF1A" + c.faction;
            if(c.bio) contextPrompt += " \u7B80\u4ECB\uFF1A" + c.bio.substring(0, 80);
            contextPrompt += "\n";
          });
          if(chars.length > 15) contextPrompt += "...\u7B49\u5171" + chars.length + "\u4EBA\n";
        }

        // 添加势力信息
        if(facs.length > 0){
          contextPrompt += "\n\u3010\u52BF\u529B\u5217\u8868\u3011\uFF08\u5171" + facs.length + "\u4E2A\uFF09\n";
          facs.forEach(function(f){
            contextPrompt += "- " + f.name;
            if(f.leader) contextPrompt += " \u9996\u9886\uFF1A" + f.leader;
            if(f.desc) contextPrompt += " \u7B80\u4ECB\uFF1A" + f.desc.substring(0, 80);
            contextPrompt += "\n";
          });
          if(facs.length > 10) contextPrompt += "...\u7B49\u5171" + facs.length + "\u4E2A\u52BF\u529B\n";
        }

        // 添加物品系统
        var items = P.items.filter(function(t){return t.sid===sid;});
        if(items.length > 0){
          contextPrompt += "\n\u3010\u7269\u54C1\u7CFB\u7EDF\u3011\uFF08\u5171" + items.length + "\u4EF6\uFF09\n";
          items.slice(0, 5).forEach(function(t){
            contextPrompt += "- " + t.name;
            if(t.desc) contextPrompt += "\uFF1A" + t.desc.substring(0, 50);
            contextPrompt += "\n";
          });
          if(items.length > 5) contextPrompt += "...\u7B49\u5171" + items.length + "\u4EF6\u7269\u54C1\n";
        }

        // 添加游戏模式信息
        var gameMode = P.conf.gameMode || 'yanyi';
        contextPrompt += "\n\u3010\u6E38\u620F\u6A21\u5F0F\u3011";
        if(gameMode === 'strict_hist'){
          contextPrompt += "\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\uFF0C\u5FC5\u987B\u4E25\u683C\u9075\u5FAA\u5386\u53F2\u4E8B\u5B9E\u3002\n";
          if(P.conf.refText) contextPrompt += "\n\u3010\u53C2\u8003\u53F2\u6599\u3011\n" + P.conf.refText.substring(0, 800) + (P.conf.refText.length > 800 ? "..." : "") + "\n";
        }else if(gameMode === 'light_hist'){
          contextPrompt += "\u8F7B\u5EA6\u53F2\u5B9E\u6A21\u5F0F\uFF0C\u5927\u4F53\u7B26\u5408\u5386\u53F2\u5373\u53EF\u3002\n";
        }else{
          contextPrompt += "\u6F14\u4E49\u6A21\u5F0F\uFF0C\u53EF\u81EA\u7531\u53D1\u6325\u3002\n";
        }

        contextPrompt += "\n\u3010\u4EFB\u52A1\u3011\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5B8C\u6574\u7684\u5267\u672C\u6570\u636E\uFF0C\u7EFC\u5408\u8003\u8651\u6240\u6709\u89D2\u8272\u3001\u52BF\u529B\u3001\u4E16\u754C\u8BBE\u5B9A\uFF0C\u751F\u6210\u4E00\u6BB5400\u5B57\u7684\u5F00\u573A\u767D\u3002\u76F4\u63A5\u8F93\u51FA\u6587\u672C\uFF0C\u4E0D\u8981\u5305\u542B\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\u3002";

        sc.opening=await callAISmart(contextPrompt, 2000, {minLength: 300, maxRetries: 3});

      // 历史检查环节（轻度和严格模式）
      if((P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') && sc.opening && sc.opening.length > 50){
        showLoading("\u5386\u53F2\u68C0\u67E5\u4E2D...",92);
        try{
          var yearRange = P.conf.gameMode === 'strict_hist' ? 100 : 200;
          var histCheckPrompt = "\u4F60\u662F\u5386\u53F2\u987E\u95EEAI\u3002\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u5F00\u573A\u767D\u662F\u5426\u5B58\u5728\u660E\u663E\u7684\u53F2\u5B9E\u9519\u8BEF\uFF08\u5982\u4EBA\u7269\u5E74\u4EE3\u9519\u8BEF\u3001\u4E8B\u4EF6\u987A\u5E8F\u9519\u8BEF\u3001\u5730\u7406\u9519\u8BEF\u7B49\uFF09\u3002\n\n"+
            "\u3010\u5267\u672C\u8BBE\u5B9A\u3011\n\u540D\u79F0\uFF1A"+sc.name+"\n\u65F6\u4EE3\uFF1A"+sc.era+"\n\u89D2\u8272\uFF1A"+sc.role+"\n\n"+
            "\u3010\u5F00\u573A\u767D\u3011\n"+sc.opening+"\n\n"+
            "\u8BF7\u8FD4\u56DEJSON\u683C\u5F0F\uFF1A{\"hasErrors\":true/false,\"errorCount\":0,\"errors\":[\"\u9519\u8BEF\u63CF\u8FF0\"],\"correctedText\":\"\u4FEE\u6B63\u540E\u7684\u5F00\u573A\u767D\"}\u3002\u5982\u679C\u6CA1\u6709\u9519\u8BEF\uFF0ChasErrors\u4E3Afalse\uFF0CcorrectedText\u4E3A\u7A7A\u3002";

          var histCheckResult = await callAISmart(histCheckPrompt, 2000, {maxRetries: 2});
          var histCheck = JSON.parse(histCheckResult.replace(/```json|```/g,"").trim());

          if(histCheck.hasErrors && histCheck.correctedText){
            sc.opening = histCheck.correctedText;
            _dbg('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u53D1\u73B0\u5E76\u4FEE\u6B63\u4E86 ' + (histCheck.errorCount || histCheck.errors.length) + ' \u5904\u53F2\u5B9E\u9519\u8BEF');
            if(histCheck.errors && histCheck.errors.length > 0){
              _dbg('[\u5386\u53F2\u68C0\u67E5] \u9519\u8BEF\u8BE6\u60C5\uFF1A', histCheck.errors);
            }
          }
        }catch(e){
          console.error('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u68C0\u67E5\u5931\u8D25\uFF1A', e);
        }
      }
    }catch(e){
      console.error('[AI生成开场白] 失败：', e);
    }
  }
  }

    // 7. AI 最终统筹总结（可选，不影响游戏启动）
    if(P.ai.key){
      showLoading("AI\u6700\u7EC8\u7EDF\u7B79\u603B\u7ED3...",88);
      try{
        // 构建统筹提示，让 AI 确认所有数据已正确加载
        var summaryPrompt = "\u4F60\u662FAI\u4E16\u754C\u914D\u7F6E\u7CFB\u7EDF\u3002\u8BF7\u7528\u4E00\u53E5\u8BDD\uFF0815\u5B57\u4EE5\u5185\uFF09\u786E\u8BA4\u4E16\u754C\u914D\u7F6E\u5B8C\u6210\u3002\u76F4\u63A5\u8F93\u51FA\u786E\u8BA4\u4FE1\u606F\uFF0C\u4E0D\u8981JSON\u683C\u5F0F\u3002";

        var summaryResult = await callAISmart(summaryPrompt, 50, {maxRetries: 1});
        _dbg('[AI统筹总结] ' + summaryResult);
      }catch(e){
        _dbg('[AI统筹总结] 跳过：', e);
      }
    }

  // 第三阶段：历史检查（轻度和严格模式）
  if((P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist') && sc.opening && sc.opening.length > 50){
    showLoading("\u5386\u53F2\u68C0\u67E5\u4E2D...",92);
    try{
      var yearRange = P.conf.gameMode === 'strict_hist' ? 100 : 200;
      var histCheckPrompt = "\u4F60\u662F\u5386\u53F2\u987E\u95EEAI\u3002\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u5F00\u573A\u767D\u662F\u5426\u5B58\u5728\u660E\u663E\u7684\u53F2\u5B9E\u9519\u8BEF\uFF08\u5982\u4EBA\u7269\u5E74\u4EE3\u9519\u8BEF\u3001\u4E8B\u4EF6\u987A\u5E8F\u9519\u8BEF\u3001\u5730\u7406\u9519\u8BEF\u7B49\uFF09\u3002\n\n"+
        "\u3010\u5267\u672C\u8BBE\u5B9A\u3011\n\u540D\u79F0\uFF1A"+sc.name+"\n\u65F6\u4EE3\uFF1A"+sc.era+"\n\u89D2\u8272\uFF1A"+sc.role+"\n\n"+
        "\u3010\u5F00\u573A\u767D\u3011\n"+sc.opening+"\n\n"+
        "\u8BF7\u8FD4\u56DEJSON\u683C\u5F0F\uFF1A{\"hasErrors\":true/false,\"errorCount\":0,\"errors\":[\"\u9519\u8BEF\u63CF\u8FF0\"],\"correctedText\":\"\u4FEE\u6B63\u540E\u7684\u5F00\u573A\u767D\"}\u3002\u5982\u679C\u6CA1\u6709\u9519\u8BEF\uFF0ChasErrors\u4E3Afalse\uFF0CcorrectedText\u4E3A\u7A7A\u3002";

      var histCheckResult = await callAISmart(histCheckPrompt, 2000, {maxRetries: 2});
      var histCheck = JSON.parse(histCheckResult.replace(/```json|```/g,"").trim());

      if(histCheck.hasErrors && histCheck.correctedText){
        sc.opening = histCheck.correctedText;
        _dbg('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u53D1\u73B0\u5E76\u4FEE\u6B63\u4E86 ' + (histCheck.errorCount || histCheck.errors.length) + ' \u5904\u53F2\u5B9E\u9519\u8BEF');
        if(histCheck.errors && histCheck.errors.length > 0){
          _dbg('[\u5386\u53F2\u68C0\u67E5] \u9519\u8BEF\u8BE6\u60C5\uFF1A', histCheck.errors);
        }
      }
    }catch(e){
      console.error('[\u5386\u53F2\u68C0\u67E5] \u5F00\u573A\u767D\u68C0\u67E5\u5931\u8D25\uFF1A', e);
    }
  }

  // 第四阶段：完成初始化
  showLoading("\u521D\u59CB\u5316\u5B8C\u6210",95);
  await new Promise(function(r){setTimeout(r,300);});
  showLoading("\u51C6\u5907\u5C31\u7EEA",100);
  await new Promise(function(r){setTimeout(r,200);});

  hideLoading();

  // 开场白动画
  // 开场文本兜底：如果没有opening，用overview前200字
  if (!sc.opening || sc.opening.length <= 20) {
    if (sc.overview && sc.overview.length > 30) {
      sc.opening = sc.overview.substring(0, 200) + (sc.overview.length > 200 ? '...' : '');
    }
  }
  if(sc.opening&&sc.opening.length>20){
    // 2026-06 重制·入世仪典（跨剧本通用·数据全取 sc·缺则兜底）
    _tmShowOpeningCeremony(sc, sid);
  }else{
    doActualStart(sid);
  }
};

// ════ 开场白·入世仪典 overlay（2026-06 重制·跨剧本通用）════
// 时机：在 doActualStart 之前展示·此刻 P/GM 尚未初始化·所有数据均从 sc（剧本对象）取，缺则兜底。
// 数据：题署=sc.name/sc.era；身份=sc.playerInfo.characterName(去注解)→sc.characters 找立绘/称谓/bio；
//       戏眼=sc.events 里 isOpeningEvent/triggerTurn:1 的前 3 条（每剧本皆有·绝不写死单朝专名）。
function _tmShowOpeningCeremony(sc, sid) {
  var _esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // 玩家角色（容错去注解·跨剧本：绍宋 characterName 形如「赵构(穿越者赵玖)」）
  var _pi = sc.playerInfo || {};
  var _pName = _pi.characterName || '';
  var _pClean = (_pName.replace(/[（(].*$/, '').trim()) || _pName;
  var _pChar = null;
  (sc.characters || []).some(function (c) { if (c && (c.name === _pClean || c.name === _pName)) { _pChar = c; return true; } return false; });
  var _pTitle = _pi.characterTitle || (_pChar && (_pChar.officialTitle || _pChar.title)) || '';
  var _pPortrait = (_pChar && _pChar.portrait) || '';
  var _pBio = _pi.characterBio || (_pChar && _pChar.bio) || '';
  if (_pBio) _pBio = String(_pBio).replace(/\s+/g, ' ').trim().slice(0, 64);
  // 开局戏眼（开局事件前 3·跨剧本通用）
  var _eyes = [];
  (sc.events || []).forEach(function (e) {
    if (_eyes.length >= 3 || !e) return;
    if (!(e.isOpeningEvent === true || e.triggerTurn === 1)) return;
    _eyes.push({ ti: e.name || '开局要务', ds: String(e.description || e.narrative || '').replace(/\s+/g, ' ').trim().slice(0, 16), key: (e.importance === '关键') });
  });
  // 题署印字：剧本朝代字 > 剧本名首字
  var _sealCh = ((sc.dynastyChar || sc.dynasty || '').toString().charAt(0)) || ((sc.name || '天').toString().charAt(0));

  var ov = document.createElement('div');
  ov.id = 'tm-opening'; ov.className = 'tm-op';
  var h = '<div class="tm-op-world">';
  h += '<div class="tm-op-title"><div class="tm-op-seal">' + _esc(_sealCh) + '</div>'
    + '<div class="tm-op-tcol"><div class="tm-op-name">' + _esc(sc.name || '') + '</div>'
    + (sc.era ? '<div class="tm-op-sub">' + _esc(sc.era) + '</div>' : '') + '</div></div>';
  h += '<div class="tm-op-body">';
  if (_pName) {
    h += '<div class="tm-op-aside">';
    var _figInner = (_pPortrait
      ? '<img src="' + _esc(_pPortrait) + '" alt="" onerror="var f=this.closest(\'.tm-op-fig\');if(f)f.classList.add(\'no-img\');this.remove();">'
      : '')
      + '<span class="tm-op-figseal">' + _esc(_pClean.charAt(0) || '帝') + '</span>'
      + '<div class="tm-op-vig"></div><div class="tm-op-frame"></div><span class="tm-op-rtag">尔之所履</span>';
    h += '<div class="tm-op-fig' + (_pPortrait ? '' : ' no-img') + '">' + _figInner + '</div>';
    h += '<div class="tm-op-ident"><div class="tm-op-who">' + _esc(_pClean) + (_pTitle ? '<small>' + _esc(_pTitle) + '</small>' : '') + '</div>'
      + (_pBio ? '<div class="tm-op-plight">' + _esc(_pBio) + '</div>' : '') + '</div>';
    if (_eyes.length) {
      h += '<div class="tm-op-eyes"><div class="tm-op-eyes-h">开 局 戏 眼</div>';
      _eyes.forEach(function (ey) {
        h += '<div class="tm-op-eye' + (ey.key ? ' key' : '') + '"><span class="tm-op-eye-dot"></span><span class="tm-op-eye-tx"><b>' + _esc(ey.ti) + '</b>' + (ey.ds ? '<span>' + _esc(ey.ds) + '</span>' : '') + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="tm-op-scroll' + (_pName ? '' : ' solo') + '"><div class="tm-op-scroll-h"><span class="tm-op-lbl">开 卷</span><span class="tm-op-hint">按 空格 略过逐字</span></div>'
    + '<div class="tm-op-paper"><div class="tm-op-narr" id="opening-text"></div></div></div>';
  h += '</div>';
  h += '<div class="tm-op-foot"><div class="tm-op-fnote">此局为<b>平行时空</b> · 史册由尔亲手改写。</div>'
    + '<div class="tm-op-btns"><button class="tm-op-skip" id="tm-op-skip">▶ 略过逐字</button>'
    + '<button class="tm-op-enter" id="tm-op-enter">提 笔 临 朝</button></div></div>';
  h += '</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);

  // 逐字浮现（沿用现有 50ms·预渲染 visibility 防重排抖动）
  var textEl = ov.querySelector('#opening-text');
  var full = sc.opening || '';
  var _hh = '';
  for (var i = 0; i < full.length; i++) {
    var ch = full.charAt(i);
    if (ch === '\n') { _hh += '<br>'; continue; }
    _hh += '<span class="_ot-ch" style="opacity:0;">' + (ch === ' ' ? '&nbsp;' : (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch)) + '</span>';
  }
  textEl.innerHTML = _hh;
  var spans = textEl.querySelectorAll('._ot-ch');
  var idx = 0, allShown = false;
  var timer = setInterval(function () {
    if (idx >= spans.length || !ov.parentElement) { clearInterval(timer); allShown = true; return; }
    if (spans[idx]) spans[idx].style.opacity = '1';
    idx++;
  }, 50);
  function showAll() { clearInterval(timer); for (var k = 0; k < spans.length; k++) spans[k].style.opacity = '1'; allShown = true; }
  function enter() { clearInterval(timer); document.removeEventListener('keydown', onKey); if (ov.parentElement) ov.remove(); doActualStart(sid); }
  var skipBtn = ov.querySelector('#tm-op-skip'); if (skipBtn) skipBtn.addEventListener('click', function () { if (!allShown) showAll(); });
  var entBtn = ov.querySelector('#tm-op-enter'); if (entBtn) entBtn.addEventListener('click', enter);
  var onKey = function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!allShown) showAll(); else enter(); }
    else if (e.key === 'Escape') { e.preventDefault(); enter(); }
  };
  document.addEventListener('keydown', onKey);
}

function doActualStart(sid){
  showLoading('\u52A0\u8F7D\u5267\u672C\u914D\u7F6E...', 5);
  // 应用难度设置
  if (window._pendingDifficulty) {
    if (!P.conf) P.conf = {};
    P.conf.difficulty = window._pendingDifficulty;
    delete window._pendingDifficulty;
  }
  _tmStartApplyOfficialSnapshot(sid, 'doActualStart-pre');
  // 初始化GM（完整版，包含所有必要属性）
  var sc=_tmStartFindScenario(sid, 'doActualStart-find') || findScenarioById(sid);
  if(!sc){toast("\u672A\u627E\u5230");return;}
  // 治剧本数据串台(漏洞):P 为跨剧本复用的全局配置,下方 if(sc.X) P.X=... 只在新剧本含该字段时覆盖,缺字段则残留上一个剧本的值。
  // 绍宋无 government/military/map/mapData/mapRuntimeContract → 会漏天启的官制官员/军队/地图。故应用新剧本前先清空这些
  // 非 sid 隔离的「整个世界」字段,缺则保持空,绝不继承别的剧本(sid 隔离的 characters/factions/... 已自带过滤,不在此列)。
  ['government','military','map','mapData','mapRuntimeContract'].forEach(function(_lk){ try { delete P[_lk]; } catch(_le) { P[_lk] = undefined; } });
  var _prevSaveName=GM.saveName||'';GM={running:true,sid:sid,turn:1,vars:{},rels:{},chars:[],facs:[],items:[],armies:[],evtLog:[],conv:[],busy:false,memorials:[],qijuHistory:[],jishiRecords:[],biannianItems:[],officeTree:P.officeTree?deepClone(P.officeTree):[],wenduiTarget:null,wenduiHistory:{},officeChanges:[],shijiHistory:[],allCharacters:[],classes:[],parties:[],techTree:[],civicTree:[],autoSummary:"",summarizedTurns:[],currentDay:0,eraName:"",eraNames:[],eraState:sc.eraState?deepClone(sc.eraState):(P.eraState?deepClone(P.eraState):{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''}),taxPressure:52,playerAbilities:{management:0,military:0,scholarship:0,politics:0},currentIssues:[],pendingConsequences:[],memoryAnchors:[],provinceStats:{},playerPendingTasks:[],playerCharacterId:null,regentSignal:null,regentState:{},npcContext:null,turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]},_listeners:{},_changeQueue:[],triggeredHistoryEvents:{},rigidTriggers:{},offendGroupScores:{},activeRebounds:[],triggeredOffendEvents:{},_indices:null,postSystem:null,mapData:null,eraStateHistory:[],factionRelations:[],factionEvents:[],_tyrantDecadence:0,_tyrantHistory:[],_varMapping:null,stateTreasury:0,privateTreasury:0,_bankruptcyTurns:0,enYuanRecords:[],patronNetwork:[],activeSchemes:[],schemeCooldowns:{},eventCooldowns:{},yearlyChronicles:[],activeBattles:[],battleHistory:[],_turnBattleResults:[],activeWars:[],treaties:[],marchOrders:[],activeSieges:[],_rngCheckpoints:[]};if(_prevSaveName)GM.saveName=_prevSaveName;

  // 根据era智能推断eraState缺失字段（当剧本未定义eraState时使用合理默认值）
  if (!sc.eraState && sc.era && GM.eraState) {
    var _era = sc.era || '';
    // 根据剧本名称/背景推断是否为衰落期
    var _bg = (sc.background || '') + (sc.name || '') + (sc.desc || '');
    if (_bg.indexOf('末') >= 0 || _bg.indexOf('衰') >= 0 || _bg.indexOf('亡') >= 0 || _bg.indexOf('挽') >= 0 || _bg.indexOf('困') >= 0) {
      GM.eraState.dynastyPhase = 'decline';
      GM.eraState.socialStability = 0.35;
      GM.eraState.economicProsperity = 0.3;
      GM.eraState.centralControl = 0.3;
    }
    // 秦/隋等短命统一王朝：高集权
    if (_era.indexOf('秦') >= 0 || _era.indexOf('隋') >= 0) {
      GM.eraState.centralControl = 0.9;
      GM.eraState.landSystemType = 'junxian';
    }
    // 南渡/偏安：低统一度
    if (_bg.indexOf('南渡') >= 0 || _bg.indexOf('偏安') >= 0 || _era.indexOf('南宋') >= 0 || _era.indexOf('东晋') >= 0) {
      GM.eraState.politicalUnity = 0.3;
    }
  }

  // 从剧本加载目标/得罪群体/科举配置
  if (sc.goals && sc.goals.length > 0) P.goals = deepClone(sc.goals);
  if (sc.offendGroups) P.offendGroups = deepClone(sc.offendGroups);
  if (sc.keju) P.keju = deepClone(sc.keju);
  else if (P.keju) { P.keju.currentExam = null; P.keju.currentEnke = null; } // arch-ok 换剧本清残局考试·旧局currentExam曾串新局继续推进/归档进新局history(2026-07-04 审查定罪)
  if (sc.playerInfo) P.playerInfo = deepClone(sc.playerInfo);
  if (sc.engineConstants) {
    GM.engineConstants = deepClone(sc.engineConstants);
    P.engineConstants = deepClone(sc.engineConstants);
  }
  if (Array.isArray(sc.influenceGroups)) {
    GM.influenceGroups = deepClone(sc.influenceGroups);
    P.influenceGroups = deepClone(sc.influenceGroups);
  }

  // 初始皇命（钉子条目 + 隐藏天机）写入 12 表系统的 imperialEdict（玩家锁·AI 永读不写）
  if (sc.imperialEdicts && sc.imperialEdicts.length > 0 && window.MemTables) {
    try {
      MemTables.ensureInit();
      sc.imperialEdicts.forEach(function(e) {
        MemTables.editorWrite('imperialEdict', 'insert', {
          values: {
            0: String(e.priority || 5),
            1: String(e.content || ''),
            2: String(e.condition || '永久生效'),
            3: String(e.startTurn || 1),
            4: e.secret ? 'true' : ''
          }
        });
      });
    } catch(_ieE) { console.warn('[ImperialEdict] 初始皇命同步失败:', _ieE); }
  }

  // 加载时字段自动补全（防止旧剧本缺少新字段导致崩溃）
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.playerDecisions) GM.playerDecisions = [];
  if (!GM.memoryArchive) GM.memoryArchive = [];
  if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
  if (!GM.customPolicies) GM.customPolicies = [];
  if (!GM.affinityMap) GM.affinityMap = {};
  if (!GM._rngState) initRng(sid + '_' + Date.now());

  // 重置全局系统状态（防止上一局数据残留）
  if (typeof ChronicleSystem !== 'undefined') ChronicleSystem.reset();
  if (typeof WarWeightSystem !== 'undefined') WarWeightSystem._truces = {};

  // 加载经济配置
  if (sc.economyConfig) {
    P.economyConfig = deepClone(sc.economyConfig);
  } else if (!P.economyConfig) {
    P.economyConfig = {
      redistributionRate: 0.3,
      baseIncome: 100
    };
  }

  // 加载岗位系统配置
  if (sc.postSystem) {
    GM.postSystem = deepClone(sc.postSystem);
  } else {
    GM.postSystem = {
      enabled: false,
      posts: []
    };
  }
  // A1: 从postRules自动生成实际posts（如果posts为空但有rules）
  if (GM.postSystem && GM.postSystem.postRules && GM.postSystem.postRules.length > 0 && (!GM.postSystem.posts || GM.postSystem.posts.length === 0)) {
    GM.postSystem.posts = [];
    GM.postSystem.postRules.forEach(function(rule) {
      var post = {
        id: 'post_' + (rule.positionName || '').replace(/\s/g, '_') + '_' + Date.now() + '_' + randInt(0, 999),
        name: rule.positionName || rule.name || '',
        territoryId: '',
        territoryName: '',
        holder: '',
        rank: rule.rank || 5,
        salary: rule.salary || 0,
        authority: [],
        requirements: {},
        appointedTurn: 0,
        term: 0,
        performance: 0,
        status: 'vacant',
        // 保留postRule的元数据供AI参考
        succession: rule.succession || 'appointment',
        hasAppointmentRight: rule.hasAppointmentRight || false,
        ruleDescription: rule.description || ''
      };
      // 从rule推断authority
      if (rule.succession === 'military') post.authority = ['military'];
      if (rule.hasAppointmentRight) post.authority.push('personnel');
      GM.postSystem.posts.push(post);
    });
    _dbg('[PostSystem] 从 ' + GM.postSystem.postRules.length + ' 条规则生成 ' + GM.postSystem.posts.length + ' 个岗位');
  }

  var _gs=(typeof sc!=="undefined"&&sc.gameSettings)||{};
  P.gameSettings = _gs; // 保存到P供运行时系统查询enabledSystems
  if(_gs.eraName)GM.eraName=_gs.eraName;
  if(_gs.eraNames&&_gs.eraNames.length)GM.eraNames=_gs.eraNames.slice();

  // 加载完整的时间配置（历法/季节/年号模板等）
  if(sc.time){
    P.time = deepClone(sc.time);
  }
  // ★ gameSettings 是编辑器「开局日期」权威字段：即使剧本带 sc.time（可能陈旧·含默认 year:-356 公元前356），
  //   也须以 gameSettings.startYear/startMonth/startDay 覆盖开局年月日——否则编辑器改了开局时间进游戏仍显旧 sc.time 年份（玩家报「固定公元前」）。
  //   见 tm-launch 注释「引擎权威读 gameSettings.startYear/startMonth（仅设 scn.time 会致公元前）」。剧本未设 gameSettings 相应字段则保留 sc.time 原值。
  if(_gs.startMonth)P.time.startMonth=_gs.startMonth;
  if(_gs.startDay)P.time.startDay=_gs.startDay;
  var _gsStartYear = (_gs.startYear!==undefined && _gs.startYear!=='' && !isNaN(Number(_gs.startYear)) && Number(_gs.startYear)!==0) ? Number(_gs.startYear) : null;
  if(_gsStartYear !== null) {
    P.time.year = _gsStartYear;                       // gameSettings.startYear 权威（编辑器改开局年的字段）
  } else if(!sc.time && sc.startYear) {
    // 兜底：无 sc.time 且无有效 gameSettings.startYear → 用剧本元数据顶层 startYear。
    // 不用 `!P.time.year` 判空——P.time 默认 year 为 -356（公元前356·真值），会漏掉此兜底（见 tm-data-model 默认）。
    // 有 sc.time 时保留 sc.time.year（不误伤纯 sc.time 剧本，含合法的公元前年份）。
    P.time.year = sc.startYear;
  }
  // 标准化回合时长：gameSettings.daysPerTurn 是编辑器权威字段，perTurn/customDays 只作旧系统兼容。
  if (typeof normalizeTimeConfigFromGameSettings === 'function') {
    P.time = normalizeTimeConfigFromGameSettings(P.time, _gs);
  } else if (!P.time.daysPerTurn) {
    var _dMapFallback={'\u65E5':1,'\u5468':7,'\u6708':30,'\u5B63':90,'\u5E74':365};
    P.time.daysPerTurn = (_gs.daysPerTurn && Number(_gs.daysPerTurn)) ||
      (_gs.turnUnit ? ((Number(_gs.turnDuration)||1) * (_dMapFallback[_gs.turnUnit]||30)) : 30);
  }
  // 从gameSettings映射干支和年号设置
  if (_gs.enableGanzhi !== undefined) P.time.enableGanzhi = _gs.enableGanzhi;
  if (_gs.enableGanzhiDay !== undefined) P.time.enableGanzhiDay = _gs.enableGanzhiDay;
  if (_gs.enableEraName !== undefined) P.time.enableEraName = _gs.enableEraName;
  if (_gs.eraNames && _gs.eraNames.length > 0 && (!P.time.eraNames || P.time.eraNames.length === 0)) {
    P.time.eraNames = deepClone(_gs.eraNames);
  }
  // dynastyPhaseHint → GM.eraState.dynastyPhase（如果eraState未显式设置phase）
  if(sc.dynastyPhaseHint && GM.eraState && (!GM.eraState.dynastyPhase || GM.eraState.dynastyPhase === 'peak')) {
    GM.eraState.dynastyPhase = sc.dynastyPhaseHint;
  }

  // 加载剧本的其他配置到 P 对象
  if(sc.military) P.military = deepClone(sc.military);
  if(sc.rules) P.rules = deepClone(sc.rules);
  if(sc.timeline) P.timeline = deepClone(sc.timeline);
  if(sc.map) P.map = deepClone(sc.map);
  if(sc.worldSettings) P.worldSettings = deepClone(sc.worldSettings);
  if(sc.government) P.government = deepClone(sc.government);
  if(sc.adminHierarchy) P.adminHierarchy = deepClone(sc.adminHierarchy);
  // 根治(跨剧本)：GM.adminHierarchy 此前只在 fullLoadGame(存档加载)恢复·doActualStart(新开局)从不设→
  // 新开局 GM.adminHierarchy=undefined → 财政引擎 cascadeCollect 经 getGame().adminHierarchy 找不到任何区 → 落 fixedCollect 兜底 → 收入畸低(绍宋开局显七万·实应数百万/月)。开局即同步。
  if(P.adminHierarchy && typeof GM !== 'undefined' && GM && (!GM.adminHierarchy || Object.keys(GM.adminHierarchy).length === 0)) GM.adminHierarchy = deepClone(P.adminHierarchy);
  if(sc.officeTree) P.officeTree = deepClone(sc.officeTree);
  if(sc.officeConfig) P.officeConfig = deepClone(sc.officeConfig);
  // 官制数据源优先级：government.nodes（编辑器主数据，含holder）> officeTree（旧兜底）
  if (P.government && P.government.nodes && P.government.nodes.length > 0) {
    var _govHasHolders = false;
    (function _chk(ns) { ns.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (p.holder) _govHasHolders = true; }); if (n.subs) _chk(n.subs); }); })(P.government.nodes);
    if (_govHasHolders || !P.officeTree || P.officeTree.length === 0) {
      P.officeTree = deepClone(P.government.nodes);
      _dbg('[Office] 使用 government.nodes 作为官制数据源' + (_govHasHolders ? '（含任职者）' : ''));
    }
  }
  // 同步到 GM
  if(P.officeTree && P.officeTree.length>0) GM.officeTree = deepClone(P.officeTree);
  if(sc.techTree) P.techTree = deepClone(sc.techTree);
  if(sc.civicTree) P.civicTree = deepClone(sc.civicTree);
  if(sc.variables) P.variables = deepClone(sc.variables);
  // 规范化变量：保留元数据（unit, calcMethod, components, category），分离公式
  if(P.variables && !Array.isArray(P.variables)){
    var _fv=[];
    if(P.variables.base) P.variables.base.forEach(function(v){ v._category='base'; _fv.push(v); });
    if(P.variables.other) P.variables.other.forEach(function(v){ v._category='other'; _fv.push(v); });
    // 公式单独存储到 P._varFormulas（不混入变量数组）
    P._varFormulas = P.variables.formulas || [];
    P.variables=_fv;
  }
  if(!P._varFormulas) P._varFormulas = [];
  if(P.techTree && !Array.isArray(P.techTree)){var _ft=[];if(P.techTree.military)_ft=_ft.concat(P.techTree.military);if(P.techTree.civil)_ft=_ft.concat(P.techTree.civil);P.techTree=_ft;}
  if(P.civicTree && !Array.isArray(P.civicTree)){var _fc=[];if(P.civicTree.city)_fc=_fc.concat(P.civicTree.city);if(P.civicTree.policy)_fc=_fc.concat(P.civicTree.policy);if(P.civicTree.resource)_fc=_fc.concat(P.civicTree.resource);if(P.civicTree.corruption)_fc=_fc.concat(P.civicTree.corruption);P.civicTree=_fc;}
  // rules保持对象格式{base,combat,economy,diplomacy}——这是文本规则描述，供AI推演参考
  // 不转为数组（旧版兼容：如果rules已经是数组则保持）
  if(sc.openingText) P.openingText = sc.openingText;
  if(sc.globalRules) P.globalRules = sc.globalRules;
  if(sc.mapData) P.mapData = deepClone(sc.mapData);
  // 剧本地图进入可变运行态：GM.mapData 为唯一 live state，P.map/P.mapData 同步引用它。
  // 这样 AI 的 map_changes、存档和地图系统读到的是同一份地块所有者/占领状态。
  if ((P.map && P.map.regions && P.map.regions.length > 0) || (P.mapData && P.mapData.regions && P.mapData.regions.length > 0)) {
    var _runtimeMapSource = (P.map && P.map.regions && P.map.regions.length > 0) ? P.map : P.mapData;
    if (typeof bindRuntimeMapState === 'function') {
      bindRuntimeMapState(_runtimeMapSource);
    } else {
      GM.mapData = deepClone(_runtimeMapSource);
      P.map = GM.mapData;
      P.mapData = GM.mapData;
    }
  }
  _tmStartApplyMapChoice(sid, sc);
  if(sc.buildingSystem) P.buildingSystem = deepClone(sc.buildingSystem);
  if(sc.battleConfig) P.battleConfig = deepClone(sc.battleConfig);
  if(sc.mechanicsConfig) { if(!P.mechanicsConfig) P.mechanicsConfig={}; Object.assign(P.mechanicsConfig, deepClone(sc.mechanicsConfig)); }
  if(sc.militaryConfig) P.militaryConfig = deepClone(sc.militaryConfig);
  // 加载初始恩怨/门生到GM
  if (sc.initialEnYuan && sc.initialEnYuan.length > 0 && typeof EnYuanSystem !== 'undefined') {
    sc.initialEnYuan.forEach(function(ey) {
      EnYuanSystem.add(ey.type, ey.from, ey.to, ey.强度||1, ey.事由||'', ey.不共戴天||false);
    });
  }
  if (sc.initialPatronNetwork && sc.initialPatronNetwork.length > 0 && typeof PatronNetwork !== 'undefined') {
    sc.initialPatronNetwork.forEach(function(pn) {
      PatronNetwork.establish(pn.座主, pn.门生, pn.关系类型||'座主门生', pn.亲密度||60);
    });
  }
  if(sc.adminConfig) P.adminConfig = deepClone(sc.adminConfig);
  if(sc.chronicleConfig) P.chronicleConfig = deepClone(sc.chronicleConfig);
  if(sc.eventConstraints) P.eventConstraints = deepClone(sc.eventConstraints);
  if(sc.warConfig) P.warConfig = deepClone(sc.warConfig);
  if(sc.diplomacyConfig) P.diplomacyConfig = deepClone(sc.diplomacyConfig);
  if(sc.schemeConfig) P.schemeConfig = deepClone(sc.schemeConfig);
  if(sc.decisionConfig) P.decisionConfig = deepClone(sc.decisionConfig);
  if(sc.vassalSystem) P.vassalSystem = deepClone(sc.vassalSystem);
  if(sc.titleSystem) P.titleSystem = deepClone(sc.titleSystem);
  if(sc.officialVassalMapping) P.officialVassalMapping = deepClone(sc.officialVassalMapping);

  // 加载剧本的角色、势力、党派、阶层等数据到 P 对象
  if(sc.characters) {
    // 移除旧的该剧本的角色，添加新的
    P.characters = (P.characters||[]).filter(function(c){return c.sid!==sid;});
    P.characters = P.characters.concat(sc.characters.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.factions) {
    P.factions = (P.factions||[]).filter(function(f){return f.sid!==sid;});
    P.factions = P.factions.concat(sc.factions.map(function(f){f.sid=sid;return f;}));
  }
  if(sc.parties) {
    P.parties = (P.parties||[]).filter(function(p){return p.sid!==sid;});
    P.parties = P.parties.concat(sc.parties.map(function(p){p.sid=sid;return p;}));
  }
  if(sc.classes) {
    P.classes = (P.classes||[]).filter(function(c){return c.sid!==sid;});
    P.classes = P.classes.concat(sc.classes.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.items) {
    P.items = (P.items||[]).filter(function(i){return i.sid!==sid;});
    P.items = P.items.concat(sc.items.map(function(i){i.sid=sid;return i;}));
  }
  if(sc.relations) {
    P.relations = (P.relations||[]).filter(function(r){return r.sid!==sid;});
    P.relations = P.relations.concat(sc.relations.map(function(r){r.sid=sid;return r;}));
  }

  if(sc.events) {
    var allEvents = [];
    if (Array.isArray(sc.events)) {
      // 扁平数组格式（官方剧本/bundle/内置自注册脚本：sc.events 直接是事件数组）。
      // 根治：旧加载器只认 {historical/random/conditional/story/chain} 对象格式，
      // 官方天启/绍宋的 sc.events 是扁平数组 → allEvents 恒空 → GM.events 空 → 开局事件无法激活成御案时政。
      // （1.3.4.1 旧天启靠 split-rows 把事件直接塞 P.events 绕过此处；换成扁平内置脚本后暴露。绍宋靠预制 currentIssues 兜底未暴露。）
      allEvents = sc.events.filter(Boolean).map(function(e){ e.sid=sid; if(!e.type) e.type='story'; return e; });
    } else {
      if(sc.events.historical) allEvents = allEvents.concat(sc.events.historical.map(function(e){e.sid=sid;e.type='historical';return e;}));
      if(sc.events.random) allEvents = allEvents.concat(sc.events.random.map(function(e){e.sid=sid;e.type='random';return e;}));
      if(sc.events.conditional) allEvents = allEvents.concat(sc.events.conditional.map(function(e){e.sid=sid;e.type='conditional';return e;}));
      if(sc.events.story) allEvents = allEvents.concat(sc.events.story.map(function(e){e.sid=sid;e.type='story';return e;}));
      if(sc.events.chain) allEvents = allEvents.concat(sc.events.chain.map(function(e){e.sid=sid;e.type='chain';return e;}));
    }
    // 移除旧的该剧本的事件，添加新的
    P.events = (P.events||[]).filter(function(e){return e.sid!==sid;});
    P.events = P.events.concat(allEvents);
  }

  // 刚性史事 sc.rigidHistoryEvents → P.rigidHistoryEvents（打 sid·与 characters/events 同构）。
  // 根治：此前缺这一步，编辑器/草案剧本写的 rigidHistoryEvents 从不进 P，下方 GM 副本 filter(sid) 恒空，
  // 史实进程提示(喂AI预知)+定时触发(checkHistoryEvents)全失效；仅官方 bundle 剧本靠自身预 load 生效。
  // 补齐后所有剧本一致。幂等：同 sid 旧条目先 filter 掉再 concat，重复 doActualStart 不累积。
  if(Array.isArray(sc.rigidHistoryEvents)) {
    P.rigidHistoryEvents = (P.rigidHistoryEvents||[]).filter(function(e){return e && e.sid!==sid;});
    P.rigidHistoryEvents = P.rigidHistoryEvents.concat(sc.rigidHistoryEvents.map(function(e){e.sid=sid;return e;}));
  }

  // 开局内容（御案时政 currentIssues / 奏疏 memorials / 开场书信 openingLetters→鸿雁 letters）→ GM。
  // 根治：此前缺这一步，剧本写的这三类从不进 GM，渲染器(御案时政/奏疏/鸿雁视图)读 GM.* 恒空。跨剧本通用·幂等(同 sid 先清再加)。
  if(typeof GM !== 'undefined' && GM){
    if(Array.isArray(sc.currentIssues)){
      GM.currentIssues = (GM.currentIssues||[]).filter(function(x){return x && x._sid!==sid;});
      sc.currentIssues.forEach(function(x){var c=deepClone(x); c._sid=sid; if(c.raisedTurn==null)c.raisedTurn=GM.turn||1; if(!c.status)c.status='pending'; GM.currentIssues.push(c);});
    }
    if(Array.isArray(sc.memorials)){
      GM.memorials = (GM.memorials||[]).filter(function(x){return x && x._sid!==sid;});
      sc.memorials.forEach(function(x){var c=deepClone(x); c._sid=sid; GM.memorials.push(c);});
    }
    if(Array.isArray(sc.openingLetters)){
      // 鸿雁运行时读 GM.letters；开场书信 openingLetters 是其开局来源。打 sid·幂等。
      GM.letters = (GM.letters||[]).filter(function(x){return x && x._sid!==sid;});
      sc.openingLetters.forEach(function(x){var c=deepClone(x); c._sid=sid; if(c.isOpening==null)c.isOpening=true; GM.letters.push(c);});
    }
    if(Array.isArray(sc.openingAudiences)){
      // 问对「阶下待见」运行时读 GM._pendingAudiences；开局远来求见(使节·告急·特请·非在京者动态浮现不了)由 openingAudiences 预置·打 sid·幂等。
      GM._pendingAudiences = (GM._pendingAudiences||[]).filter(function(x){return x && x._sid!==sid;});
      sc.openingAudiences.forEach(function(x){var c=deepClone(x); c._sid=sid; if(c._opening==null)c._opening=true; GM._pendingAudiences.push(c);});
    }
  }

  // 加载变量到GM.vars——保留编辑者写的所有字段，不假设任何固定格式
  (P.variables||[]).forEach(function(v){
    if(v.sid && v.sid!==sid) return;
    if(!v.name) return; // 至少要有名字
    var gv = deepClone(v);
    // 推断数值：尝试多种可能的字段名
    if(gv.value === undefined) {
      gv.value = parseFloat(gv.defaultValue) || parseFloat(gv.initial) || parseFloat(gv.default) || 0;
    }
    gv.value = parseFloat(gv.value) || 0;
    // min/max：有就用，没有就智能推断
    if(gv.min === undefined && gv.minimum !== undefined) gv.min = gv.minimum;
    if(gv.max === undefined && gv.maximum !== undefined) gv.max = gv.maximum;
    if(gv.min === undefined) gv.min = 0;
    if(gv.max === undefined) gv.max = Math.max(100, Math.abs(gv.value) * 10);
    gv.min = parseFloat(gv.min) || 0;
    gv.max = parseFloat(gv.max) || 100;
    if(gv.max <= gv.min) gv.max = gv.min + 100;
    GM.vars[gv.name] = gv;
  });
  // 存储公式/关联规则供AI参考（不做程序层面的计算）
  GM._varFormulas = P._varFormulas || [];
  (P.relations||[]).filter(function(r){return r.sid===sid;}).forEach(function(r){GM.rels[r.name]=deepClone(r);});
  // 加载势力间关系矩阵
  GM.factionRelations = deepClone(sc.factionRelations || P.factionRelations || []);
  if (!GM.factionRelationsMap) GM.factionRelationsMap = {};
  if (typeof syncFactionRelationsFromList === 'function') syncFactionRelationsFromList(GM.factionRelations);
  GM.chars=(P.characters||[]).filter(function(c){return c.sid===sid;}).map(function(c){return deepClone(c);});
  GM.facs=(P.factions||[]).filter(function(f){return f.sid===sid;}).map(function(f){
    var faction = deepClone(f);
    // 初始化封臣系统字段
    if (!faction.vassals) faction.vassals = [];
    if (!faction.liege) faction.liege = null;
    if (!faction.tributeRate) faction.tributeRate = 0.3;
    if (!faction.territories) faction.territories = [];
    return faction;
  });
  // 人物 factionId ↔ faction 名串 双向同步根治（跨剧本通用）。
  // 此前人物只有 faction 中文名串、无 factionId，引擎各处用 c.faction===f.name 关联→势力一改名/编辑器细化命名，
  // 人物名串就对不上、沦为孤儿（如"大越·李朝"vs"大越李朝"差一个中点）。根治：factionId 为稳定真相源——
  // 有 factionId 则用它校正 c.faction 名串（势力改名后人物名串自动跟新、永不孤儿）；无 factionId 的旧档/其他剧本，
  // 反向用名串回填 factionId。引擎其余各处仍读 c.faction 名串、零改动，但名串自此由 factionId 保证与 factions 一致。
  (function _syncCharFactionId(){
    if (!GM.chars || !GM.facs || !GM.facs.length) return;
    var byId = {}, byName = {};
    GM.facs.forEach(function(f){ if (f && f.id) byId[f.id] = f; if (f && f.name) byName[f.name] = f; });
    var corrected = 0, backfilled = 0;
    GM.chars.forEach(function(c){
      if (!c) return;
      if (c.factionId && byId[c.factionId]) {
        if (c.faction !== byId[c.factionId].name) corrected++;
        c.faction = byId[c.factionId].name;            // 有 id → 校正名串
      } else if (c.faction && byName[c.faction]) {
        c.factionId = byName[c.faction].id;             // 有名 → 回填 id（兼容旧档/中立桶名匹配）
        backfilled++;
      }
    });
    if (typeof _dbg === 'function') _dbg('[factionId同步] 校正名串' + corrected + ' 回填id' + backfilled);
  })();
  // 被俘态初始化（跨朝代通用·非绍宋专属）：剧本数据 stance/presenceState/status 标为被俘类状态 → 运行时 _captured 标记。
  // _captured 者身份仍属本势力(factionId 不变)，但人在敌境、排出本势力日常班底：廷议不召、不得任官、NPC 决策不选、官缺不计为在任。
  // 字段名不含朝代词——靖康「北狩」、土木堡「被俘」等皆由剧本数据驱动，引擎只认 _captured boolean，迎回/获释时可清。
  (function _initCapturedState(){
    if (!GM.chars) return;
    var CAPTURED_MARK = { '北狩': 1, '被俘': 1, '被掳': 1, '陷虏': 1, '没蕃': 1 };
    var PRESENT_MARK = { 'present': 1, '在场': 1, '在朝': 1, '随驾': 1, '在位': 1 };
    function _isCapturedTag(v){
      if (!v || typeof v !== 'string') return false;
      if (CAPTURED_MARK[v]) return true;
      for (var k in CAPTURED_MARK) { if (v.indexOf(k) === 0) return true; }  // "北狩·法理皇帝"等变体取主词
      return false;
    }
    var n = 0;
    GM.chars.forEach(function(c){
      if (!c) return;
      // 在场/在位/随驾/逃归者(presenceState 明示)绝不算被俘——即便别字段提及被俘字样(如柔福帝姬 present、邢焕随驾、金方北狩管理官)
      if (PRESENT_MARK[c.presenceState]) return;
      if (_isCapturedTag(c.presenceState) || _isCapturedTag(c.status) || _isCapturedTag(c.stance)) {
        c._captured = true;
        c._capturedLocation = c.location || c.currentLocation || '';
        if (c._capturedTurn == null) c._capturedTurn = 0;
        n++;
      }
    });
    if (typeof _dbg === 'function') _dbg('[被俘态] 标记 _captured ' + n + ' 人');
  })();
  GM.items=(P.items||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.acquired=false;return c;});
  // 军队加载：优先 initialTroops（编辑器新 schema 完整部队表），armies 仅作兜底（旧字段通常只有少量代表部队）
  var _initTroops = (P.military && P.military.initialTroops) || [];
  var _legacyArmies = (P.military && P.military.armies) || [];
  var _rawArmies = (_initTroops.length > 0) ? _initTroops : _legacyArmies;
  GM.armies = _rawArmies.filter(function(a) { return !a.sid || a.sid === sid; }).map(function(a) {
    var army = deepClone(a);
    // 字段兼容映射
    if (army.size && !army.soldiers) army.soldiers = parseInt(army.size) || 1000;
    if (army.strength && !army.soldiers) army.soldiers = parseInt(army.strength) || 1000;
    if (!army.soldiers) army.soldiers = 1000;
    if (army.location && !army.garrison) army.garrison = army.location;
    // 兼容旧文本格式 composition → 结构化
    if (typeof army.composition === 'string' && army.composition) {
      army.composition = [{type: army.composition, count: army.soldiers}];
    }
    // 兼容旧文本格式 salary → 结构化
    if (typeof army.salary === 'string' && army.salary) {
      army.salary = [{resource: army.salary, amount: 0, unit: ''}];
    }
    // 兼容旧装备格式 quota/actual → count/condition
    if (army.equipment && Array.isArray(army.equipment)) {
      army.equipment.forEach(function(eq) {
        if (eq.actual !== undefined && eq.count === undefined) eq.count = eq.actual;
        if (eq.note && !eq.condition) eq.condition = eq.note;
      });
    }
    return army;
  });
  // 应用编辑器预设的封臣关系
  if (P.vassalSystem && P.vassalSystem.vassalRelations && P.vassalSystem.vassalRelations.length > 0) {
    P.vassalSystem.vassalRelations.forEach(function(rel) {
      var vassalFac = GM.facs.find(function(f) { return f.name === rel.vassal; });
      var liegeFac = GM.facs.find(function(f) { return f.name === rel.liege; });
      if (vassalFac && liegeFac) {
        vassalFac.liege = rel.liege;
        vassalFac.tributeRate = rel.tributeRate || 0.3;
        if (rel.vassalType) vassalFac.vassalType = rel.vassalType;
        if (!liegeFac.vassals) liegeFac.vassals = [];
        if (liegeFac.vassals.indexOf(rel.vassal) === -1) liegeFac.vassals.push(rel.vassal);
        if (rel.loyalty !== undefined) {
          var vRuler = GM.chars.find(function(c) { return c.faction === rel.vassal && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); });
          if (vRuler) vRuler.loyalty = rel.loyalty;
        }
      }
    });
  }
  // 应用编辑器预设的角色头衔
  if (P.titleSystem && P.titleSystem.characterTitles && P.titleSystem.characterTitles.length > 0) {
    P.titleSystem.characterTitles.forEach(function(ct) {
      var ch = GM.chars.find(function(c) { return c.name === ct.character; });
      if (ch) {
        if (!ch.titles) ch.titles = [];
        ch.titles.push({
          name: ct.titleName || '', level: ct.titleLevel || 5,
          hereditary: ct.hereditary || false, privileges: ct.privileges || [],
          _suppressed: [], grantedTurn: 0, grantedBy: '\u5F00\u5C40\u9884\u8BBE'
        });
      }
    });
  }

  GM.classes=(P.classes||[]).filter(function(c){return c.sid===sid;}).map(function(c){return deepClone(c);});
  GM.parties=(P.parties||[]).filter(function(p){return p.sid===sid;}).map(function(p){return deepClone(p);});
  GM.techTree=(P.techTree||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.unlocked=false;return c;});
  GM.civicTree=(P.civicTree||[]).filter(function(c){return c.sid===sid;}).map(function(c){var cp=deepClone(c);cp.adopted=false;return cp;});
  GM.events=(P.events||[]).filter(function(e){return e.sid===sid;}).map(function(e){var ev=deepClone(e);if(ev.triggered===undefined)ev.triggered=false;return ev;});
  // 单一真相源(剧本隔离根治):刚性史事此前只存在于跨剧本累积的 P.rigidHistoryEvents(官方天启快照常驻·sid=天启)·
  // GM 没有对应数组→处理器/AI 被迫读 P 库→玩绍宋时会看到/触发天启的「魏忠贤自缢」等剧本事件。此处给当前局
  // 建一份只含本剧本的干净副本·让 gameplay 只读 GM(单剧本世界)·不再伸手进多剧本的 P 库。
  GM.rigidHistoryEvents=(P.rigidHistoryEvents||[]).filter(function(e){return e&&e.sid===sid;}).map(function(e){return deepClone(e);});
  // 天机·改命(穿越/上帝视角剧本)：开局建天机录(预知未来刚性史事)+注入御案时政。gated sc.tianjiEnabled(默认关·绍宋赵玖穿越开)·跨朝代。
  GM._tianjiEnabled = !!(sc && sc.tianjiEnabled);
  if (GM._tianjiEnabled && typeof TMTianji !== 'undefined') { try { TMTianji.build(GM); } catch(_tjE){} }
  // 边报·天下军情：从活势力关系算敌我大势·注入御案。gated sc.junqingBriefEnabled(默认关·绍宋开)·跨朝代。
  GM._junqingBriefEnabled = !!(sc && sc.junqingBriefEnabled);
  if (GM._junqingBriefEnabled && typeof TMJunqing !== 'undefined') { try { TMJunqing.build(GM); } catch(_jqE){} }
  // 新君观政·百日：即位之初的观政期(百官观望/政令初行阻/根基法理未固)·相位+AI framing。gated sc.xinjunObserveEnabled(默认关·绍宋开)·跨朝代。
  GM._xinjunObserveEnabled = !!(sc && sc.xinjunObserveEnabled);
  GM._xinjunObserveTurns = (sc && sc.xinjunObserveTurns) || 6;
  if (GM._xinjunObserveEnabled && typeof TMXinjun !== 'undefined') { try { TMXinjun.build(GM); } catch(_xjE){} }
  _tmStartRepairRuntimeData(sid, sc, 'after-runtime-load');
  GM.allCharacters=GM.chars.map(function(c){return{name:c.name,title:c.title,age:c.age||"?",gender:c.gender||"\u7537",personality:c.personality,appearance:c.appearance,desc:c.desc,loyalty:c.loyalty,relationValue:c.loyalty,faction:c.faction,recruited:true,recruitTurn:0,source:"\u521D\u59CB",avatarUrl:""};});

  // 自动为旧角色匹配 traitIds + 初始化stress/goals
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (typeof autoAssignTraitIds === 'function') autoAssignTraitIds(c);
      if (typeof validateTraits === 'function') validateTraits(c);
      if (typeof inferPersonalGoal === 'function') inferPersonalGoal(c);
      // 初始化压力值（若缺失）
      if (c.stress === undefined) c.stress = 0;
      // 初始化军事能力（若缺失，根据武勇和智力推算）
      if (c.military === undefined) {
        // 武将类角色军事偏高，文臣偏低，但都受智力修正
        var _valBase = c.valor || 50;
        var _intMod = ((c.intelligence || 50) - 50) * 0.3;
        c.military = Math.round(_valBase * 0.6 + _intMod + 20 + (random() - 0.5) * 20);
        c.military = clamp(c.military, 10, 95);
      }
      // 初始化政务能力（若缺失）
      if (c.administration === undefined) {
        c.administration = Math.round(((c.intelligence || 50) * 0.5 + 25) * (0.8 + random() * 0.4));
        c.administration = clamp(c.administration, 10, 95);
      }
      // 初始化魅力值（若缺失，根据已有属性推算）
      if (c.charisma === undefined) {
        c.charisma = Math.round(((c.intelligence || 50) + (c.loyalty || 50)) / 2 * (0.8 + random() * 0.4));
        c.charisma = clamp(c.charisma, 10, 95);
      }
      // 初始化外交值（若缺失，根据已有属性推算）
      if (c.diplomacy === undefined) {
        c.diplomacy = Math.round(((c.charisma || 50) + (c.intelligence || 50)) / 2 * (0.8 + random() * 0.4));
        c.diplomacy = clamp(c.diplomacy, 10, 95);
      }
      // 初始化家族（若缺失，从姓氏提取——开局后由AI丰富为郡望格式）
      if (!c.family) {
        var _nameStr = c.name || '';
        var _compSurnames = ['\u53F8\u9A6C','\u8BF8\u845B','\u4E0A\u5B98','\u6B27\u9633','\u7687\u752B','\u4EE4\u72D0','\u592A\u53F2','\u5B87\u6587','\u957F\u5B59','\u6148\u79A7','\u53F8\u5F92','\u7AEF\u6728','\u4E07\u4FDF','\u767E\u91CC','\u5C09\u8FDF','\u547C\u5EF6','\u5B8C\u989C','\u8D6B\u8FDE','\u72EC\u5B64','\u6155\u5BB9','\u62D3\u8DCB','\u5148\u8F9C','\u5CB3\u98DE','\u52A0\u5F00','\u4E2D\u5C71'];
        var _surname = '';
        for (var _si = 0; _si < _compSurnames.length; _si++) {
          if (_nameStr.indexOf(_compSurnames[_si]) === 0) { _surname = _compSurnames[_si]; break; }
        }
        if (!_surname && _nameStr.length >= 2) _surname = _nameStr.charAt(0);
        if (_surname) c.family = _surname + '\u6C0F';
      }
      // 初始化门第等级（若缺失）
      // familyTier: 'imperial'=皇族宗室 | 'noble'=世家大族 | 'gentry'=地方士族 | 'common'=寒门
      if (!c.familyTier) {
        if (c.isPlayer) c.familyTier = 'imperial';
        else if (c.title && /王|公|侯|伯/.test(c.title)) c.familyTier = 'noble';
        else c.familyTier = 'common'; // 默认寒门，开局后由AI丰富
      }
      // 初始化事件观感数组（若缺失）
      if (!c._eventOpinions) c._eventOpinions = [];
      // 初始化后宫/配偶字段（若缺失）
      // spouse: 是否为玩家配偶  spouseRank: 位份  children: 子女名  motherClan: 母族
      if (c.spouse === undefined) c.spouse = false;
      if (c.spouse && !c.spouseRank) c.spouseRank = 'consort';
      if (!c.children) c.children = [];
      if (!c.parentOf) c.parentOf = null; // 该角色是谁的子女
    });
  }

  // ── 标记玩家角色 & 玩家势力 ──
  (function _markPlayer() {
    var pi = P.playerInfo;
    if (!pi) return;
    var pName = (pi.characterName || '').trim();
    var fName = (pi.factionName || '').trim();

    // 1) 在 GM.chars 中找到玩家角色并标记 isPlayer
    if (pName && GM.chars) {
      var found = false;
      // 容错(跨剧本根治)：playerInfo.characterName 可能带注解(如绍宋"赵构(穿越者赵玖)")·与人物名"赵构"对不上→
      // 否则 2696 会误建一个空壳重复玩家角色(真角色的家谱/关系/记忆全废)+ 玩家势力派生失效(officeTree/阶层党派过滤不跑→显全势力)。剥括注重匹配。
      var pNameAlt = pName.replace(/[（(].*$/, '').trim();
      GM.chars.forEach(function(c) { c.isPlayer = false; }); // 先清除旧标记
      for (var _pi = 0; _pi < GM.chars.length; _pi++) {
        if (GM.chars[_pi].name === pName || (pNameAlt && pNameAlt !== pName && GM.chars[_pi].name === pNameAlt)) {
          GM.chars[_pi].isPlayer = true;
          // 同步 playerInfo 的详细字段到角色对象（角色对象优先，playerInfo补缺）
          if (!GM.chars[_pi].age && pi.characterAge) GM.chars[_pi].age = pi.characterAge;
          if (!GM.chars[_pi].gender && pi.characterGender) GM.chars[_pi].gender = pi.characterGender;
          if (!GM.chars[_pi].personality && pi.characterPersonality) GM.chars[_pi].personality = pi.characterPersonality;
          if (!GM.chars[_pi].title && pi.characterTitle) GM.chars[_pi].title = pi.characterTitle;
          if (!GM.chars[_pi].faction && pi.characterFaction) GM.chars[_pi].faction = pi.characterFaction;
          if (!GM.chars[_pi].faction && fName) GM.chars[_pi].faction = fName;
          if (!GM.chars[_pi].bio && pi.characterBio) GM.chars[_pi].bio = pi.characterBio;
          if (!GM.chars[_pi].desc && pi.characterDesc) GM.chars[_pi].desc = pi.characterDesc;
          if (!GM.chars[_pi].faith && pi.characterFaith) GM.chars[_pi].faith = pi.characterFaith;
          if (!GM.chars[_pi].culture && pi.characterCulture) GM.chars[_pi].culture = pi.characterCulture;
          if (!GM.chars[_pi].appearance && pi.characterAppearance) GM.chars[_pi].appearance = pi.characterAppearance;
          if (!GM.chars[_pi].charisma && pi.characterCharisma) GM.chars[_pi].charisma = parseInt(pi.characterCharisma) || 60;
          found = true;
          break;
        }
      }
      // 角色列表中没有玩家角色 → 自动创建
      if (!found) {
        var newChar = {
          name: pName, title: pi.characterTitle || '', faction: pi.characterFaction || fName || '',
          age: pi.characterAge || '', gender: pi.characterGender || '男',
          personality: pi.characterPersonality || '', bio: pi.characterBio || '',
          desc: pi.characterDesc || '', faith: pi.characterFaith || '', culture: pi.characterCulture || '',
          appearance: pi.characterAppearance || '', charisma: parseInt(pi.characterCharisma) || 60,
          diplomacy: parseInt(pi.characterDiplomacy) || 50,
          loyalty: 100, morale: 80, ambition: 50, benevolence: 50, intelligence: 60, valor: 50,
          isPlayer: true, isHistorical: true, alive: true, stress: 0
        };
        GM.chars.push(newChar);
        GM.allCharacters.push({
          name: newChar.name, title: newChar.title, age: newChar.age || '?', gender: newChar.gender,
          personality: newChar.personality, desc: newChar.desc, loyalty: 100, faction: newChar.faction,
          recruited: true, recruitTurn: 0, source: '初始'
        });
      }
    }

    // 2) 在 GM.facs 中标记玩家势力
    if (fName && GM.facs) {
      for (var _fi = 0; _fi < GM.facs.length; _fi++) {
        if (GM.facs[_fi].name === fName) {
          GM.facs[_fi].isPlayer = true;
          // 补全势力字段
          if (!GM.facs[_fi].leader && pi.factionLeader) GM.facs[_fi].leader = pi.factionLeader;
          if (!GM.facs[_fi].desc && pi.factionDesc) GM.facs[_fi].desc = pi.factionDesc;
          break;
        }
      }
    }

    // 人物势力绑定根治（通用·跨剧本）：把每个人物的 factionId 与 faction 名串补齐、双向对齐。
    // 此前人物多只靠 faction 名串关联（天启仅 48% 有 factionId）→名串是唯一锚、脆弱：势力改名/改换门庭即断。
    // 开局锚定 id+名，后续改换门庭(allegiance)、roster 归属、关系分发都有稳固双锚。
    (function _bindCharFactions(){
      if (!GM.chars || !GM.facs) return;
      var byName = {}, byId = {};
      GM.facs.forEach(function(f){ if (f) { if (f.name) byName[f.name] = f; if (f.id) byId[f.id] = f; } });
      var fixed = 0;
      GM.chars.forEach(function(ch){
        if (!ch) return;
        var fname = ch.faction || ch.factionName;
        if (fname && !ch.factionId) { var f = byName[fname] || byId[fname]; if (f && f.id) { ch.factionId = f.id; fixed++; } }
        if (ch.factionId && !ch.faction) { var f2 = byId[ch.factionId]; if (f2 && f2.name) { ch.faction = f2.name; fixed++; } }
        if (ch.factionId && ch.faction && byId[ch.factionId] && byId[ch.factionId].name !== ch.faction) { ch.faction = byId[ch.factionId].name; fixed++; }
      });
      if (fixed && typeof _dbg === 'function') _dbg('[绑定] 人物势力 factionId↔名 补齐对齐 ' + fixed + ' 处');
    })();

    // 2.5) 同好之谊·开局亲疏种子(owner 2026-06)：同势力且共享≥3雅好者=知音·开局即有亲疏。
    //   喂运行时 AffinityMap(GM.affinityMap)·被主推演 npc-hearts 盟友列表(top3·|值|≥20可见)+endturn-ai决策(_favA)+常朝/廷议消费——
    //   故为活字段·非孤立。与静态 894 关系互补(此为动态亲疏层)。仅同势力(相识 proxy)·门槛≥3共好(知音级·实测约389对·不撑爆affinityMap)·跨朝代任何剧本受益。
    (function _seedHobbyAffinity(){
      if (typeof AffinityMap === 'undefined' || !AffinityMap.add || !GM.chars) return;
      function hset(x){
        var h = x && x.hobbies; if (!h) return null;
        var arr = Array.isArray(h) ? h : (typeof h === 'string' ? h.split(/[、,，·\/;；]/) : []);
        var s = {}, n = 0;
        arr.forEach(function(v){ v = ('' + v).trim(); if (v && !s[v]) { s[v] = 1; n++; } });
        return n ? s : null;
      }
      var byFac = {};
      GM.chars.forEach(function(ch){ if (!ch || ch.alive === false || ch.dead) return; var f = ch.faction || ch.factionId || ch.factionName; if (!f) return; (byFac[f] = byFac[f] || []).push(ch); });
      var seeded = 0;
      Object.keys(byFac).forEach(function(fk){
        var arr = byFac[fk], sets = arr.map(hset);
        for (var i = 0; i < arr.length; i++) {
          if (!sets[i]) continue;
          for (var j = i + 1; j < arr.length; j++) {
            if (!sets[j]) continue;
            var sh = 0; for (var k in sets[i]) { if (sets[j][k]) sh++; }
            if (sh >= 3) { AffinityMap.add(arr[i].name, arr[j].name, Math.min(sh, 4) * 7, '同好之谊'); seeded++; }
          }
        }
      });
      if (seeded && typeof _dbg === 'function') _dbg('[同好] 开局共好亲疏种子 ' + seeded + ' 对(同势力·≥3雅好)');
    })();

    // 3) 设置 GM.playerCharacterId
    if (pName && GM.chars) {
      var pc = GM.chars.find(function(c) { return c.name === pName; }) || GM.chars.find(function(c) { return c.isPlayer; });
      if (pc) GM.playerCharacterId = pc.id || pc.name || pName;
      // 官制按玩家势力归属（根治：GM.officeTree 原为整个 scenario.officeTree·多势力剧本会串其他势力官职）
      var _pf = pc ? (pc.faction || pc.factionName) : null;
      if (_pf && GM.officeTree && GM.officeTree.length) {
        var _fac = (GM.facs || []).find(function(f) { return f.name === _pf || f.id === _pf; });
        if (_fac && Array.isArray(_fac.officeTree) && _fac.officeTree.length) {
          // 方案C 主路径：每势力官制分存于 faction.officeTree（天启格式·无 faction 字段）
          GM.officeTree = deepClone(_fac.officeTree);
        } else if (GM.officeTree.some(function(o) { return o.faction; })) {
          // 过渡兼容：顶层 officeTree 带 faction 字段→只留玩家势力的
          var _own = GM.officeTree.filter(function(o) { return o.faction === _pf; });
          if (_own.length) GM.officeTree = _own;
        }
        // 顶层 officeTree 无 faction（天启单势力）→ 保持全部·不变
      }
      // 阶层/党派按玩家势力归属（根治：GM.classes/parties 原为整个 scenario 全势力混渲·多势力剧本开局显 250 阶层/150 党派=灾难·同 officeTree 病）
      if (_pf) {
        if (Array.isArray(GM.classes) && GM.classes.length) {
          var _ownCls = GM.classes.filter(function(c) { return c && (c.faction === _pf || c.factionId === _pf); });
          if (_ownCls.length) GM.classes = _ownCls; // 守卫：过滤后非空才替换·天启单势力(无faction或全匹配)不受影响
        }
        if (Array.isArray(GM.parties) && GM.parties.length) {
          var _ownPty = GM.parties.filter(function(p) { return p && (p.faction === _pf || p.factionId === _pf || p.crossFaction); });
          if (_ownPty.length) GM.parties = _ownPty;
        }
      }
    }
  })();

  // 初始化家族注册表 + 从剧本加载 sc.families（根治）。
  // 此前仅初始化空对象·剧本定义的 families 数组从不加载→updateFamilyRenown/GM.families[name] 消费恒空。
  // 补后所有剧本一致·向后兼容：无 sc.families 则不变；已存在的 name 不覆盖。
  if (!GM.families) GM.families = {};
  if (Array.isArray(sc.families)) {
    sc.families.forEach(function(f) {
      if (f && f.name && !GM.families[f.name]) {
        var fam = deepClone(f);
        if (typeof fam.renown !== 'number') fam.renown = (typeof fam.prestige === 'number') ? fam.prestige : 50;
        GM.families[f.name] = fam;
      }
    });
  }

  // S6b·人才范式渗透引擎·剧本 preset（既有正统 label/初始 stock·design §2.3·仿 families 分发）。
  //   flag talentCohortEnabled 关 → 不播种（零回归）；跨朝代：范式名取剧本，引擎不预设任何「学」。不重复立。
  //   sc.talentParadigms = [{label, kind:'established'|'emergent', stock, influenceProfile?, absorptionKind?, maturityTurns?}]
  (function _seedTalentParadigms(){
    try {
      var TC = (typeof TM !== 'undefined' && TM.TalentCohorts) || (typeof window !== 'undefined' && window.TM && window.TM.TalentCohorts);
      if (!TC || typeof TC.enabled !== 'function' || !TC.enabled(P)) return;
      var presets = sc.talentParadigms || sc.talentCohorts;
      if (!Array.isArray(presets) || !presets.length) return;
      TC.init(GM, P);
      presets.forEach(function(pd){
        if (!pd || !pd.label || TC.findParadigm(GM, pd.label)) return;
        TC.registerParadigm(GM, {
          label: pd.label, kind: (pd.kind === 'emergent') ? 'emergent' : 'established',
          stock: pd.stock, influenceProfile: pd.influenceProfile, absorptionKind: pd.absorptionKind, maturityTurns: pd.maturityTurns
        });
      });
    } catch(_e){}
  })();

  // 剧本 relations 数组（from/to）分发到人物 ch.relations（根治）。
  // 此前剧本 relations 只进坏的 GM.rels[r.name]（relations 无 name 字段→key undefined·63条全覆盖成1条），
  // 而 getTopRelations/summarizeRelation 读的是人物自带 ch.relations·二者脱节→剧本人际关系在 AI 推演中恒空。
  // 双向分发·字段映射(value→hostility/conflictLevel·type→labels)·向后兼容：人物已有 ch.relations[other] 不覆盖。
  (function _dispatchScenarioRelations(){
    var _scRels = (sc.relations || []);
    if (!_scRels.length || !GM.chars) return;
    var _byName = {};
    GM.chars.forEach(function(c){ if (c && c.name) _byName[c.name] = c; });
    var _put = function(owner, other, r, hostility, conflictLevel){
      var c = _byName[owner]; if (!c) return;
      if (!c.relations) c.relations = {};
      if (c.relations[other]) return; // 不覆盖人物自带关系
      c.relations[other] = {
        affinity: (typeof r.affinity === 'number') ? r.affinity : 50,
        trust: (typeof r.trust === 'number') ? r.trust : 50,
        respect: (typeof r.respect === 'number') ? r.respect : 50,
        fear: (typeof r.fear === 'number') ? r.fear : 0,
        hostility: hostility, conflictLevel: conflictLevel,
        labels: r.type ? [r.type] : [], desc: r.desc || '',
        history: [], _fromScenario: true
      };
    };
    _scRels.forEach(function(r){
      if (!r || !r.from || !r.to) return;
      var hostility = (typeof r.value === 'number' && r.value < 0) ? Math.min(100, -r.value) : 0;
      var conflictLevel = (r.value <= -40) ? 2 : (r.value < -15 ? 1 : 0);
      _put(r.from, r.to, r, hostility, conflictLevel);
      _put(r.to, r.from, r, hostility, conflictLevel);
    });
  })();

  // 初始化后宫/继承系统数据
  if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
  if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
  // 从剧本加载后宫配置
  if (sc && sc.haremConfig) GM.harem = Object.assign(GM.harem, deepClone(sc.haremConfig));

  // ── 官制任职者自动匹配 ──
  // 角色的 title/officialTitle 与 officeTree.positions.holder 双向同步
  if (GM.officeTree && GM.officeTree.length > 0 && GM.chars && GM.chars.length > 0) {
    var _syncCount = 0;
    // 1) position有holder但角色没officialTitle → 设角色officialTitle
    // 2) position无holder但角色title匹配某职位名 → 填充holder
    (function _syncOffice(nodes) {
      nodes.forEach(function(dept) {
        (dept.positions || []).forEach(function(pos) {
          if (pos.holder || (Array.isArray(pos.actualHolders) && pos.actualHolders.length)) {
            // 职位已有人 → 确保该角色知道自己的官职；兼任者保留主职并写入 concurrentTitles
            var _holders = [];
            if (typeof _offAllHolders === 'function') {
              try { _holders = _offAllHolders(pos) || []; } catch(_) { _holders = []; }
            }
            if (!_holders.length && pos.holder) _holders = [pos.holder];
            _holders.forEach(function(_hn, _idx) {
              var ch = GM.chars.find(function(c) { return c.name === _hn && c.alive !== false; });
              if (!ch) return;
              if (typeof _offAddCharOfficeTitle === 'function') _offAddCharOfficeTitle(ch, pos.name, { concurrent: _idx > 0 || !!ch.officialTitle });
              else if (!ch.officialTitle) ch.officialTitle = pos.name;
              _syncCount++;
            });
          } else {
            // 职位空缺 → 从角色的title/officialTitle中寻找匹配
            var posName = pos.name || '';
            if (!posName) return;
            var matched = GM.chars.find(function(c) {
              if (c.alive === false) return false;
              // officialTitle精确匹配
              if (c.officialTitle && c.officialTitle === posName) return true;
              // title中包含职位名（如title="尚书令·xx"包含pos.name="尚书令"）
              if (c.title && c.title.indexOf(posName) >= 0) return true;
              // title直接就是职位名
              if (c.title && c.title === posName) return true;
              return false;
            });
            if (matched) {
              pos.holder = matched.name;
              if (!matched.officialTitle) matched.officialTitle = posName;
              _syncCount++;
            }
          }
        });
        if (dept.subs) _syncOffice(dept.subs);
      });
    })(GM.officeTree);
    if (_syncCount > 0) _dbg('[Office] 自动匹配官制任职者 ' + _syncCount + ' 处');
  }

  // 单一真相源:开局去重人物+从树回填officialTitle+派生任职者(与读档一致)
  try { if (typeof _offSyncHoldersFromChars === 'function') _offSyncHoldersFromChars({ importSeats: true, dedupChars: true, force: true }); } catch (_e) {}

  // 构建索引系统（性能优化）
  showLoading('\u6784\u5EFA\u7D22\u5F15...', 50);
  if(typeof buildIndices === 'function') buildIndices();

  // 初始化 AI 缓存系统
  if(typeof initAICache === 'function') initAICache();

  // 初始化 Unit 系统
  if (P.unitSystem && P.unitSystem.enabled && typeof initUnitSystem === 'function') {
    initUnitSystem();
  }

  // 初始化补给系统（可从battleConfig.supplyConfig或P.supplySystem触发）
  if (P.battleConfig && P.battleConfig.supplyConfig && P.battleConfig.supplyConfig.enabled) {
    if (!P.supplySystem) P.supplySystem = {};
    P.supplySystem.enabled = true;
  }
  if (P.supplySystem && P.supplySystem.enabled && typeof initSupplySystem === 'function') {
    initSupplySystem();
  }

  // 初始化建筑系统
  if (P.buildingSystem && P.buildingSystem.enabled && typeof initBuildingSystem === 'function') {
    showLoading('\u521D\u59CB\u5316\u5EFA\u7B51\u4E0E\u7ECF\u6D4E...', 70);
    initBuildingSystem();
  }

  // 初始化地图系统
  if(typeof initGameMap === 'function') initGameMap();
  // 构建邻接图（供行军/补给寻路使用）
  if(P.map && P.map.enabled && typeof buildAdjacencyGraph === 'function') buildAdjacencyGraph();

  // 初始化省级经济系统
  showLoading('\u521D\u59CB\u5316\u5730\u65B9\u533A\u5212...', 85);
  if(typeof initProvinceEconomy === 'function') initProvinceEconomy();

  // 初始化得罪群体系统
  if(typeof OffendGroupsSystem !== 'undefined' && OffendGroupsSystem.initialize) OffendGroupsSystem.initialize();

  // 初始化状态耦合系统
  if(typeof StateCouplingSystem !== 'undefined' && StateCouplingSystem.initialize) StateCouplingSystem.initialize();

  // 初始化集权回拨系统
  if(typeof CentralizationSystem !== 'undefined' && CentralizationSystem.initialize) CentralizationSystem.initialize();

  // 初始化领地产出系统
  if(typeof TerritoryProductionSystem !== 'undefined' && TerritoryProductionSystem.initialize) TerritoryProductionSystem.initialize();

  // 初始化职位系统
  if(typeof PositionSystem !== 'undefined' && PositionSystem.initialize) PositionSystem.initialize();


  _$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("E").style.display="none";
  _$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");

  _tmStartRepairRuntimeData(sid, sc, 'before-start-hook');
  _tmStartPrimeFormalRuntime(sid, sc, 'before-start-hook');
  GameHooks.run('startGame:after', sid);

  // 5.1: 剧本完整度预检（非阻断式警告）
  var _checkWarnings = [];
  if (!GM.chars || GM.chars.length < 3) _checkWarnings.push('\u89D2\u8272\u4E0D\u8DB3\uFF08\u5F53\u524D' + (GM.chars ? GM.chars.length : 0) + '\u4EBA\uFF0C\u5EFA\u8BAE\u22655\uFF09');
  if (!GM.chars || !GM.chars.some(function(c){return c.isPlayer;})) _checkWarnings.push('\u672A\u8BBE\u7F6E\u73A9\u5BB6\u89D2\u8272');
  if (!GM.facs || GM.facs.length === 0) _checkWarnings.push('\u672A\u8BBE\u7F6E\u52BF\u529B');
  if (!GM.vars || Object.keys(GM.vars).length === 0) _checkWarnings.push('\u672A\u5B9A\u4E49\u53D8\u91CF\uFF08\u56FD\u5E93/\u5A01\u671B/\u6C11\u5FC3\u7B49\uFF09');
  if (!P.time || !P.time.year) _checkWarnings.push('\u672A\u8BBE\u7F6E\u5F00\u59CB\u5E74\u4EFD');
  if (!GM.officeTree || GM.officeTree.length === 0) _checkWarnings.push('\u672A\u8BBE\u7F6E\u5B98\u5236');
  if (_checkWarnings.length > 0) {
    console.warn('[ScenarioCheck]', _checkWarnings.join('; '));
    // 在起居注中记录警告
    if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: 0, date: '\u5F00\u5C40\u68C0\u67E5', content: '\u3010\u5267\u672C\u4E0D\u5B8C\u6574\u8B66\u544A\u3011' + _checkWarnings.join('\uFF1B') });
  }

  // 确保所有字段有默认值
  if (typeof _ensureGMDefaults === 'function') _ensureGMDefaults();
  if (typeof _ensurePDefaults === 'function') _ensurePDefaults();
  // 清理新游戏时的旧会话数据
  if (typeof ChangeLog !== 'undefined') ChangeLog.clear();
  if (typeof GameEventBus !== 'undefined') GameEventBus.clear();
  if (typeof DecisionRegistry !== 'undefined') DecisionRegistry.loadFromConfig();
  if (typeof PromptLayerCache !== 'undefined') PromptLayerCache.clear();
  if (typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.reset();

  // ── 逻辑审查：AI检查剧本数据中的矛盾冲突并自动修正 ──
  if (P.ai && P.ai.key && GM.chars && GM.chars.length > 0) {
    (async function() {
      try {
        showLoading('\u903B\u8F91\u5BA1\u67E5\uFF1A\u68C0\u67E5\u5267\u672C\u6570\u636E\u77DB\u76FE...', 90);
        await _logicAuditOnStart(sc);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'LogicAudit] error:') : console.warn('[LogicAudit] error:', e); }

      // AI深度预热（剧本标 isFullyDetailed 时内部跳过·用剧本文本兜底）
      if (typeof aiDeepReadScenario === 'function') {
        try {
          await aiDeepReadScenario();
        } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'DeepRead in doActualStart] error:') : console.warn('[DeepRead in doActualStart] error:', e); }
      }
      // 三项推演规划·并行发射（节省等待）·各 1 次 AI：
      //   · aiPlanScenarioForInference: NPC 议程/危机分岔/行文指纹
      //   · aiPlanFactionMatrix: 势力关系矩阵/轨迹/黑天鹅
      //   · aiPlanFirstTurnEvents: 首 3 回合候选事件池
      showLoading('\u89C4\u5212\u63A8\u6F14\u9519\u70B9\u00B7\u5E76\u884C 3 \u9879\u2026', 92);
      try {
        await Promise.all([
          (typeof aiPlanScenarioForInference === 'function') ? aiPlanScenarioForInference().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiPlan') : console.warn('[aiPlan]', e); }) : Promise.resolve(),
          (typeof aiPlanFactionMatrix === 'function') ? aiPlanFactionMatrix().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiFacMatrix') : console.warn('[aiFacMatrix]', e); }) : Promise.resolve(),
          (typeof aiPlanFirstTurnEvents === 'function') ? aiPlanFirstTurnEvents().catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiFTE') : console.warn('[aiFTE]', e); }) : Promise.resolve()
        ]);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '3 plans parallel') : console.warn('[3 plans parallel]', e); }
      showLoading('\u751F\u6210\u521D\u59CB\u594F\u758F...', 98);
      _tmStartRepairRuntimeData(sid, sc, 'before-enter-api');
      _tmStartPrimeFormalRuntime(sid, sc, 'before-enter-api');
      generateMemorials();
      hideLoading();
      enterGame();
      _tmStartRefreshFormalShell();
    })();
  } else {
    showLoading('\u8FDB\u5165\u6E38\u620F\u4E16\u754C...', 95);
    _tmStartRepairRuntimeData(sid, sc, 'before-enter-local');
    _tmStartPrimeFormalRuntime(sid, sc, 'before-enter-local');
    generateMemorials();
    setTimeout(function(){hideLoading();enterGame();_tmStartRefreshFormalShell();},100);
  }
  var hd=_$("qiju-history");if(hd&&sc)hd.innerHTML="<div class=\"qiju-record\"><div class=\"qiju-turn\">"+getTS(1)+" \u5F00\u7BC7</div><div class=\"nt\">"+sc.opening+"</div></div>";

  // 初始化科举制度（由AI判断是否启用）
  initKejuSystem(sc);

  if(!GM.officeTree||GM.officeTree.length===0){
    _showOfficeStartModal();
    return;
  }
  toast("第1回合");
}

// 奏议批复写入纪事本末
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子2）

// ============================================================
