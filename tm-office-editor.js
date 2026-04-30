// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-office-editor.js — 剧本编辑器桥接+官制 AI 生成+官制编辑器 (R131 从 tm-audio-theme.js L1499-end 拆出)
// 姊妹: tm-audio-theme.js (音频+主题) + tm-save-lifecycle.js (存档管道)
// 包含: openEditorHtml (打开 editor.html)+_showOfficeStartModal (官制启动弹窗)+
//       AI 生成系列 (_aiStylePrefix/_aiGenOptionsHTML/aiGenOfficeEd/aiGenOfficeStaff)+
//       _renderOfficeDept+_office* (部门/职位 CRUD)+bindMainMenuButtons
// ============================================================


// ============================================================
//  剧本编辑器桥接：打开 editor.html
// ============================================================
function openEditorHtml(scnId){
  var scn=findScenarioById(scnId);
  if(!scn){toast('找不到剧本');return;}

  // 确保 API 配置同步到 localStorage
  try{
    localStorage.setItem('tm_api',JSON.stringify(P.ai));
  }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }

  // 把 index.html 的剧本数据映射成 editor.js 的 scriptData 格式
  var scriptData={
    id: scnId,
    name: scn.name||'',
    startYear: scn.startYear||null,
    dynastyPhaseHint: scn.dynastyPhaseHint||'',
    dynasty: scn.dynasty||scn.era||'',
    emperor: scn.emperor||scn.role||'',
    overview: scn.overview||scn.background||scn.desc||'',
    openingText: scn.openingText||'',
    globalRules: scn.globalRules||'',
    playerInfo: scn.playerInfo||{factionName:'',factionDesc:'',characterName:'',characterDesc:'',coreContradictions:[]},
    gameSettings: scn.gameSettings||{enabledSystems:{items:true,military:true,techTree:true,civicTree:true,events:true,map:true,characters:true,factions:true,classes:true,rules:true,officeTree:true},startYear:1,startMonth:1,startDay:1,enableGanzhi:false,enableGanzhiDay:false,enableEraName:false,eraNames:[],turnDuration:1,turnUnit:'月'},
    time: scn.time||P.time||{year:-356,prefix:"公元前",suffix:"年",perTurn:"1s",customDays:90,varSpeed:false,seasons:["春","夏","秋","冬"],startS:2,sEffects:[],reign:"",reignY:1,display:"year_season",template:"{reign}{ry}年 {season}",startMonth:1,startDay:1,enableGanzhi:false,enableGanzhiDay:false,enableEraName:false,eraNames:[]},
    // 优先从 scn 对象本身取（磁盘加载的完整数据），其次从 P 按 sid 过滤
    characters: (scn.characters && scn.characters.length > 0) ? scn.characters : (P.characters||[]).filter(function(c){return c.sid===scnId;}),
    factions: (scn.factions && scn.factions.length > 0) ? scn.factions : (P.factions||[]).filter(function(f){return f.sid===scnId;}),
    parties: (scn.parties && scn.parties.length > 0) ? scn.parties : (P.parties||[]).filter(function(p){return p.sid===scnId;}),
    classes: (scn.classes && scn.classes.length > 0) ? scn.classes : (P.classes||[]).filter(function(c){return c.sid===scnId;}),
    items: (scn.items && scn.items.length > 0) ? scn.items : (P.items||[]).filter(function(it){return it.sid===scnId;}),
    military: scn.military||{troops:[],facilities:[],organization:[],campaigns:[],initialTroops:[],militarySystem:[]},
    techTree: scn.techTree||{military:[],civil:[]},
    civicTree: scn.civicTree||{city:[],policy:[],resource:[],corruption:[]},
    variables: scn.variables||{base:[],other:[],formulas:[]},
    rules: scn.rules||{base:'',combat:'',economy:'',diplomacy:''},
    events: scn.events||{historical:[],random:[],conditional:[],story:[],chain:[]},
    timeline: scn.timeline||{past:[],future:[]},
    map: scn.map||{items:[],regions:[],roads:[]},
    worldSettings: scn.worldSettings||{culture:'',weather:'',religion:'',economy:'',technology:'',diplomacy:''},
    government: scn.government||{name:'',description:'',selectionSystem:'',promotionSystem:'',historicalReference:'',nodes:[]},
    adminHierarchy: scn.adminHierarchy||{},
    officeTree: scn.officeTree||[],
    officeConfig: scn.officeConfig||{costVariables:[],shortfallEffects:''},
    eraState: scn.eraState||{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''},
    buildingSystem: scn.buildingSystem||{enabled:false,buildingTypes:[]},
    palaceSystem: scn.palaceSystem||{enabled:false,capitalName:'',capitalDescription:'',palaces:[]},
    culturalConfig: scn.culturalConfig||{enabled:true,dynastyFocus:'auto',presetWorks:[]},
    presetRelations: scn.presetRelations||{npc:[],faction:[]},
    battleConfig: scn.battleConfig||P.battleConfig||{enabled:true},
    initialEnYuan: scn.initialEnYuan||[],
    initialPatronNetwork: scn.initialPatronNetwork||[],
    chronicleConfig: scn.chronicleConfig||P.chronicleConfig||{yearlyEnabled:false,style:'biannian'},
    eventConstraints: scn.eventConstraints||P.eventConstraints||{enabled:false,types:[]},
    warConfig: scn.warConfig||P.warConfig||{casusBelliTypes:[]},
    diplomacyConfig: scn.diplomacyConfig||P.diplomacyConfig||{treatyTypes:[]},
    schemeConfig: scn.schemeConfig||P.schemeConfig||{enabled:false,schemeTypes:[]},
    decisionConfig: scn.decisionConfig||P.decisionConfig||{decisions:[]},
    edictConfig: scn.edictConfig||P.edictConfig||{enabled:true,examples:[],styleNote:''},
    postSystem: scn.postSystem||{enabled:false,postRules:[]},
    vassalSystem: scn.vassalSystem||{enabled:false,vassalTypes:[]},
    titleSystem: scn.titleSystem||{enabled:false,titleRanks:[]},
    officialVassalMapping: scn.officialVassalMapping||{mappings:[]},
    economyConfig: scn.economyConfig||{enabled:false,currency:'\u8D2F',baseIncome:10000,tributeRatio:0.3,tributeAdjustment:0,taxRate:0.1,inflationRate:0.02,economicCycle:'stable',specialResources:'',tradeSystem:'',description:'',redistributionRate:0.3,tradeBonus:0.1,agricultureMultiplier:1.0,commerceMultiplier:1.0},
    goals: scn.goals||[],
    offendGroups: {enabled:false,decayEnabled:false,decayRate:0.05,groups:[]}, // 已废弃，得罪机制由party/class offendThresholds替代
    keju: scn.keju||{enabled:false,reformed:false,examIntervalNote:'',examNote:''},
    externalForces: scn.externalForces||[],
    relations: (scn.relations && scn.relations.length > 0) ? scn.relations : (P.relations||[]).filter(function(r){return r.sid===scnId;}),
    factionRelations: scn.factionRelations||[],
    mapData: scn.mapData||{},
    haremConfig: scn.haremConfig||{rankSystem:[],succession:'eldest_legitimate'},
    cities: scn.cities||[]
  };
  // 写入IndexedDB（主存储）+ localStorage（兜底）
  var _edMeta = { scnId: scnId, scnName: P._activeScnName||scn.name||scnId };
  if (typeof TM_SaveDB !== 'undefined') {
    TM_SaveDB.save('current_script', scriptData, {
      name: scriptData.name || scnId,
      type: 'editor',
      turn: 0,
      scenarioName: scriptData.name || ''
    });
  }
  try {
    localStorage.setItem('tianming_script', JSON.stringify(scriptData));
  } catch(e) {
    console.warn('[openEditorHtml] localStorage写入失败（已保存到IndexedDB）:', e.message);
  }
  try {
    localStorage.setItem('tianming_editor_meta', JSON.stringify(_edMeta));
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'openEditorHtml') : console.warn('[openEditorHtml] meta写入失败:', e.message); }
  console.log('[openEditorHtml] 准备跳转到 editor.html, scnId=' + scnId);
  window.location.href='editor.html';
}

// 页面加载时：若从 editor.html 返回，同步数据回 P.scenarios
(function syncFromEditor(){
  try{
    var metaRaw=localStorage.getItem('tianming_editor_meta');
    var scriptRaw=localStorage.getItem('tianming_script');
    _dbg('[syncFromEditor] metaRaw:', metaRaw ? '存在' : '不存在');
    _dbg('[syncFromEditor] scriptRaw:', scriptRaw ? '存在' : '不存在');
    if(!metaRaw||!scriptRaw)return;
    var meta=JSON.parse(metaRaw);
    var sd=JSON.parse(scriptRaw);
    // 确定剧本ID：优先meta.scnId，其次sd.id，最后用文件名生成
    var scnId = meta.scnId || sd.id || ('scn_file_' + (meta.scnName || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g,'_'));
    if (!scnId) return;
    // 找或创建对应剧本
    var idx=P.scenarios.findIndex(function(s){return s.id===scnId;});
    if(idx<0){P.scenarios.push({id:scnId,name:sd.name||'',era:sd.dynasty||'',role:sd.emperor||'',background:sd.overview||''});idx=P.scenarios.length-1;}
    var scn=P.scenarios[idx];
    scn.name=sd.name||scn.name;
    scn.era=sd.dynasty||scn.era;
    scn.dynasty=sd.dynasty||scn.dynasty||scn.era||'';
    scn.role=sd.emperor||scn.role;
    scn.emperor=sd.emperor||scn.emperor||scn.role||'';
    scn.background=sd.overview||scn.background;
    scn.overview=sd.overview||scn.overview||scn.background||'';
    scn.desc=sd.overview||scn.desc||'';
    scn.openingText=sd.openingText||scn.openingText||'';
    scn.globalRules=sd.globalRules||scn.globalRules||'';
    scn.playerInfo=sd.playerInfo||scn.playerInfo||{factionName:'',factionDesc:'',characterName:'',characterDesc:'',coreContradictions:[]};
    if(sd.gameSettings)scn.gameSettings=sd.gameSettings;
    // 时间配置：优先用sd.time，若为null则从sd.gameSettings构建
    if(sd.time && typeof sd.time === 'object' && sd.time.year !== undefined){
      scn.time=sd.time;
    } else if(sd.gameSettings){
      // 从gameSettings构建time对象
      var _gst = sd.gameSettings;
      if(!scn.time) scn.time = {};
      if(_gst.startYear !== undefined && _gst.startYear !== null && _gst.startYear !== '') {
        scn.time.year = Number(_gst.startYear);
        if(scn.time.year < 0) { scn.time.prefix = '公元前'; scn.time.suffix = '年'; }
        else { scn.time.prefix = '公元'; scn.time.suffix = '年'; }
      }
      if(_gst.startMonth) scn.time.startMonth = Number(_gst.startMonth);
      if(_gst.startDay) scn.time.startDay = Number(_gst.startDay);
      // 回合天数
      if(_gst.daysPerTurn && _gst.daysPerTurn > 0){
        scn.time.daysPerTurn = Number(_gst.daysPerTurn);
      } else if(_gst.turnUnit){
        // 旧格式兼容
        var _dMap4={'日':1,'周':7,'月':30,'季':90,'年':365};
        scn.time.daysPerTurn = (_gst.turnDuration||1) * (_dMap4[_gst.turnUnit]||30);
      }
      if(_gst.startLunarMonth) scn.time.startLunarMonth = Number(_gst.startLunarMonth);
      if(_gst.startLunarDay) scn.time.startLunarDay = Number(_gst.startLunarDay);
      if(_gst.enableGanzhi !== undefined) scn.time.enableGanzhi = _gst.enableGanzhi;
      if(_gst.enableGanzhiDay !== undefined) scn.time.enableGanzhiDay = _gst.enableGanzhiDay;
      if(_gst.enableEraName !== undefined) scn.time.enableEraName = _gst.enableEraName;
      if(_gst.eraNames && _gst.eraNames.length > 0) scn.time.eraNames = _gst.eraNames;
    }
    // 用 hasOwnProperty 检查：编辑器中清空的字段也应同步（空数组/空对象是有效值）
    var _syncField = function(key, fallback) {
      if (sd.hasOwnProperty(key)) { scn[key] = sd[key]; }
      else if (fallback !== undefined && !scn[key]) { scn[key] = fallback; }
    };
    _syncField('military');
    _syncField('techTree');
    _syncField('civicTree');
    _syncField('variables');
    _syncField('rules');
    _syncField('events');
    _syncField('timeline');
    _syncField('map');
    _syncField('worldSettings');
    _syncField('government');
    _syncField('adminHierarchy', {});
    // 自动从government.nodes同步到officeTree（确保编辑器编辑的官制进入运行时）
    if (sd.government && sd.government.nodes && sd.government.nodes.length > 0) {
      if (!sd.officeTree || sd.officeTree.length === 0) {
        sd.officeTree = JSON.parse(JSON.stringify(sd.government.nodes));
      }
    }
    _syncField('officeTree', []);
    _syncField('officeConfig');
    _syncField('eraState');
    _syncField('buildingSystem');
    _syncField('battleConfig');
    _syncField('adminConfig');
    _syncField('initialEnYuan');
    _syncField('initialPatronNetwork');
    _syncField('chronicleConfig');
    _syncField('eventConstraints');
    _syncField('warConfig');
    _syncField('diplomacyConfig');
    _syncField('schemeConfig');
    _syncField('decisionConfig');
    _syncField('postSystem');
    _syncField('vassalSystem');
    _syncField('titleSystem');
    _syncField('officialVassalMapping');
    _syncField('economyConfig');
    _syncField('goals');
    // offendGroups已移除，得罪机制由party/class的offendThresholds替代
    _syncField('keju');
    _syncField('playerInfo');
    _syncField('mapData');
    _syncField('externalForces');
    _syncField('relations');
    _syncField('haremConfig');
    _syncField('factionRelations');
    _syncField('startYear');
    _syncField('dynastyPhaseHint');
    _syncField('cities');
    // 合并人物/势力/党派/阶层/物品（替换同 sid 的条目）
    ['characters','factions','parties','classes','items'].forEach(function(key){
      if(!sd[key]||!sd[key].length)return;
      P[key]=(P[key]||[]).filter(function(it){return it.sid!==scnId;});
      sd[key].forEach(function(it){it.sid=scnId;});
      P[key]=P[key].concat(sd[key]);
    });
    P._activeScnName=meta.scnName||scn.name;
    // 不删除localStorage中的剧本数据——保留以便下次直接打开编辑器时可恢复
    try { localStorage.removeItem('tianming_editor_meta'); } catch(_){}
    // 注意：保留 tianming_script 以支持直接打开editor.html
    // 持久化P（确保浏览器版本也能保存剧本列表）
    if (typeof saveP === 'function') saveP();
    // 桌面端：保存完整的 scriptData 到磁盘（不是部分合并的 scn）
    // 编辑器的 sd 就是完整的 scriptData，直接存它才能保留全部41个字段
    if(window.tianming&&window.tianming.isDesktop&&window.tianming.saveScenario){
      var saveFname=meta.scnName||scn.name||scnId;
      // 确保 sd 包含 id 和双格式字段
      sd.id = scnId;
      if (sd.dynasty && !sd.era) sd.era = sd.dynasty;
      if (sd.era && !sd.dynasty) sd.dynasty = sd.era;
      if (sd.emperor && !sd.role) sd.role = sd.emperor;
      if (sd.role && !sd.emperor) sd.emperor = sd.role;
      if (sd.overview && !sd.background) sd.background = sd.overview;
      if (sd.background && !sd.overview) sd.overview = sd.background;
      window.tianming.saveScenario(saveFname, sd).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'catch] async:') : console.warn('[catch] async:', e); });
    }
    // 返回剧本管理界面
    _dbg('[syncFromEditor] 同步完成，准备显示剧本管理界面');
    setTimeout(function(){showScnManage();},100);
  }catch(e){
    console.error('[syncFromEditor] 错误:', e);
  }
})();

// ── 页面加载：检测IndexedDB中的autosave/pre_endturn并提示恢复 ──
// pre_endturn 优先：标记存在=上回合 AI 推演崩溃·本回合诏令/批复/对话/调动尚未保存
// autosave 次之：上回合正常完成的快照
(function _checkAutoRestore() {
  try {
    var preMark = null;
    var preInfo = null;
    try {
      preMark = localStorage.getItem('tm_pre_endturn_mark');
      if (preMark) preInfo = JSON.parse(preMark);
    } catch(_pmE) { preInfo = null; }

    var autoMark = localStorage.getItem('tm_autosave_mark');
    var autoInfo = null;
    if (autoMark) {
      try { autoInfo = JSON.parse(autoMark); } catch(_amE) { autoInfo = null; }
    }

    if (!preInfo && (!autoInfo || !autoInfo.turn)) return;

    // 延迟弹窗（等IndexedDB打开）
    setTimeout(function() {
      if (GM.running) return; // 已经在游戏中（从syncFromEditor恢复的）

      // ── 优先处理 pre_endturn 崩溃信号 ──
      if (preInfo && preInfo.turn) {
        var preMsg = '上次过回合推演中断（' + (preInfo.scenarioName || '') + ' 第' + preInfo.turn + '回合';
        if (preInfo.eraName) preMsg += ' · ' + preInfo.eraName;
        preMsg += '）·恢复至本回合操作前？\n（本回合的诏令/批复/对话/调动将保留·AI推演需重新执行）';
        if (confirm(preMsg)) {
          showLoading('展卷恢复中……', 40);
          TM_SaveDB.load('pre_endturn').then(function(record) {
            if (record && record.gameState) {
              if (typeof fullLoadGame === 'function') {
                try {
                  fullLoadGame({ gameState: record.gameState });
                  toast('已恢复至过回合前·第' + preInfo.turn + '回合');
                  try { localStorage.removeItem('tm_pre_endturn_mark'); } catch(_){}
                } catch (_psrE) { console.error('[pre_endturn] 恢复失败', _psrE); toast('恢复失败: ' + (_psrE.message||_psrE)); }
                finally { hideLoading(); }
              } else { hideLoading(); }
            } else {
              hideLoading();
              toast('过回合前快照已损坏·尝试加载常规自动存档');
              try { localStorage.removeItem('tm_pre_endturn_mark'); } catch(_){}
              _tryLoadAutosave(autoInfo);
            }
          }).catch(function(e) { hideLoading(); toast('恢复失败: ' + (e && e.message || e)); });
          return;
        } else {
          // 用户拒绝 pre_endturn 恢复·清除标记·继续询问 autosave
          try { localStorage.removeItem('tm_pre_endturn_mark'); } catch(_){}
        }
      }

      // ── fallback: 普通 autosave ──
      _tryLoadAutosave(autoInfo);
    }, 500);
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-audio-theme');}catch(_){}}

  function _tryLoadAutosave(info) {
    if (!info || !info.turn) return;
    var msg = '检测到上次推演（' + (info.scenarioName || '') + ' 第' + info.turn + '回合';
    if (info.eraName) msg += ' · ' + info.eraName;
    msg += '），是否恢复？';
    if (confirm(msg)) {
      showLoading('展卷恢复中……', 40);
      TM_SaveDB.load('autosave').then(function(record) {
        if (record && record.gameState) {
          if (typeof fullLoadGame === 'function') {
            try { fullLoadGame({ gameState: record.gameState }); toast('已恢复：第' + info.turn + '回合'); }
            catch (_asE) { console.error('[autosave] 恢复失败', _asE); toast('恢复失败: ' + (_asE.message||_asE)); }
            finally { hideLoading(); }
          } else { hideLoading(); }
        } else {
          hideLoading();
          toast('自动存档数据已损坏');
        }
      }).catch(function(e) { hideLoading(); toast('恢复失败: ' + (e && e.message || e)); });
    }
  }
})();

function _showOfficeStartModal(){
  var ov=document.createElement('div');
  ov.id='office-start-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML=`
    <div style="background:var(--bg2,#1e1e2e);border:1px solid var(--bdr,#444);border-radius:10px;padding:28px 32px;min-width:360px;max-width:520px;color:var(--txt,#ccc);font-size:14px;">
      <h3 style="margin:0 0 16px;font-size:16px;">当前剧本未配置官制，请选择如何处理</h3>
      <div style="margin-bottom:14px;">
        <label style="display:block;margin-bottom:6px;">模式</label>
        <label style="margin-right:18px;"><input type="radio" name="osm-mode" value="auto" checked> 自动生成（输入朝代）</label>
        <label><input type="radio" name="osm-mode" value="skip"> 跳过（无官制运行）</label>
      </div>
      <div id="osm-auto-area" style="margin-bottom:14px;">
        <label style="display:block;margin-bottom:6px;">朝代名称</label>
        <input id="osm-dynasty" type="text" placeholder="如：汉、唐、宋..." style="width:100%;box-sizing:border-box;padding:6px 10px;background:var(--bg3,#111);border:1px solid var(--bdr,#444);border-radius:6px;color:inherit;font-size:14px;">
      </div>
      <div id="osm-status" style="color:#f90;min-height:20px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="osm-confirm-btn" onclick="_osmConfirm()" style="padding:7px 20px;background:var(--acc,#5865f2);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">确定</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  // toggle auto/skip area
  ov.querySelectorAll('input[name=osm-mode]').forEach(function(r){
    r.addEventListener('change',function(){
      document.getElementById('osm-auto-area').style.display=this.value==='auto'?'':'none';
      document.getElementById('osm-confirm-btn').textContent=this.value==='auto'?'确定':'跳过';
    });
  });
}

async function _osmConfirm(){
  var ov=document.getElementById('office-start-overlay');
  if(!ov)return;
  var modeInput=ov.querySelector('input[name=osm-mode]:checked');
  if(!modeInput)return;
  var mode=modeInput.value;
  var status=document.getElementById('osm-status');
  if(mode==='skip'){
    ov.remove();
    toast("第1回合");
    return;
  }
  var dynastyInput=document.getElementById('osm-dynasty');
  if(!dynastyInput)return;
  var dynasty=(dynastyInput.value||'').trim();
  if(!dynasty){if(status)status.textContent='请输入朝代名称';return;}
  if(!P.ai||!P.ai.key){if(status)status.textContent='未配置 AI key，请先跳过';return;}
  var confirmBtn=document.getElementById('osm-confirm-btn');
  if(confirmBtn)confirmBtn.disabled=true;
  if(status)status.textContent='生成中...';
  try{
    showLoading('生成官制',50);
    var prompt='生成'+dynasty+'官制。返回JSON数组，格式：[{"name":"部门","positions":[{"name":"","holder":"","desc":"","rank":""}],"subs":[]}]\n生成5个主要部门。';
    var c=await callAISmart(prompt,3000,{minLength:200,maxRetries:3,validator:function(content){try{var cleaned=content.replace(/```json|```/g,'').trim();var jm=cleaned.match(/\[[\s\S]*?\](?=\s*$)/);if(!jm){jm=cleaned.match(/\[[\s\S]*\]/);}if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
    var cleaned=c.replace(/```json|```/g,'').trim();var jm=cleaned.match(/\[[\s\S]*?\](?=\s*$)/);if(!jm){jm=cleaned.match(/\[[\s\S]*\]/);}
    if(jm){
      try{
        GM.officeTree=JSON.parse(jm[0]);
      }catch(parseErr){
        // 尝试修复常见JSON问题：去掉末尾多余逗号
        var fixedStr=jm[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}');
        GM.officeTree=JSON.parse(fixedStr);
      }
      P.officeTree=deepClone(GM.officeTree);
      renderOfficeTree();
      hideLoading();
      ov.remove();
      toast("第1回合");
    } else {
      hideLoading();
      status.textContent='生成失败，请重试或跳过';
      document.getElementById('osm-confirm-btn').disabled=false;
    }
  }catch(e){
    hideLoading();
    status.textContent='错误: '+e.message;
    document.getElementById('osm-confirm-btn').disabled=false;
  }
}

// ==== aiGen_override.js ====
// ========================================================
// Feature 3+4+5: AI Gen Mode overrides
// auto/manual mode, style override, refText override
// Appended before closing script tag
// ========================================================

// Helper: build style+refText prefix for prompts
function _aiStylePrefix(styleVal, refVal) {
  var parts = [];
  if (styleVal) parts.push('\u5399\u4e8b\u98ce\u683c\uff1a' + styleVal + '\u3002');
  if (refVal) parts.push('\u53c2\u8003\u8d44\u6599\uff1a' + refVal + '\u3002');
  return parts.join('');
}

// Helper: render AI gen options panel
// Returns HTML string for mode/style/refText controls
// containerId: unique prefix for IDs
// showMode: whether to show auto/manual toggle
function _aiGenOptionsHTML(containerId, showMode) {
  var modeHtml = '';
  if (showMode) {
    modeHtml =
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center;">'+
      '<span style="font-size:0.82rem;color:var(--txt-d);">\u751f\u6210\u6a21\u5f0f\uff1a</span>'+
      '<label style="font-size:0.82rem;"><input type="radio" name="'+containerId+'-mode" value="auto" checked onchange="_aiOptToggleMode(\'' + containerId + '\')" style="margin-right:3px;">\u81ea\u52a8\uff08\u540c\u5267\u672c\u671d\u4ee3\uff09</label>'+
      '<label style="font-size:0.82rem;"><input type="radio" name="'+containerId+'-mode" value="manual" onchange="_aiOptToggleMode(\'' + containerId + '\')" style="margin-right:3px;">\u624b\u52a8\uff08\u81ea\u5199\u63cf\u8ff0\uff09</label>'+
      '</div>'+
      '<div id="'+containerId+'-manual-area" style="display:none;margin-bottom:0.5rem;">'+
      '<textarea id="'+containerId+'-manual-desc" rows="2" placeholder="\u8bf7\u63cf\u8ff0\u8981\u751f\u6210\u7684\u5185\u5bb9\uff0c\u5982\u671d\u4ee3\u3001\u4eba\u7269\u7279\u5f81\u7b49\u2026" style="width:100%;font-size:0.82rem;"></textarea>'+
      '</div>';
  }
  return modeHtml +
    '<details style="margin-bottom:0.4rem;"><summary style="font-size:0.82rem;color:var(--txt-d);cursor:pointer;">\u2699\ufe0f \u9ad8\u7ea7\u9009\u9879</summary>'+
    '<div style="padding:0.4rem 0;">'+
    '<div style="margin-bottom:0.3rem;"><label style="font-size:0.8rem;color:var(--txt-d);">\u5399\u4e8b\u98ce\u683c\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40\u8bbe\u7f6e: '+((typeof P!=='undefined'&&P.conf&&P.conf.style)||'\u6587\u5b66\u5316')+')</span></label>'+
    '<input id="'+containerId+'-style" placeholder="\u5982\uff1a\u5c0f\u8bf4\u98ce\u683c/\u8bf4\u4e66\u4eba\u98ce\u683c/\u6b63\u53f2\u98ce\u683c" style="width:100%;font-size:0.82rem;"></div>'+
    '<div><label style="font-size:0.8rem;color:var(--txt-d);">\u53c2\u8003\u8d44\u6599\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40\u53c2\u8003\u6587\u672c)</span></label>'+
    '<textarea id="'+containerId+'-ref" rows="2" placeholder="\u53ef\u8d34\u5165\u53c2\u8003\u6587\u672c\u3001\u53f2\u4e66\u6bb5\u843d\u7b49\u2026" style="width:100%;font-size:0.82rem;"></textarea></div>'+
    '</div></details>';
}

function _aiOptToggleMode(containerId) {
  var radios = document.querySelectorAll('input[name="'+containerId+'-mode"]');
  var mode = 'auto';
  radios.forEach(function(r){ if(r.checked) mode = r.value; });
  var area = document.getElementById(containerId+'-manual-area');
  if (area) area.style.display = mode === 'manual' ? 'block' : 'none';
}

function _aiOptGetMode(containerId) {
  var radios = document.querySelectorAll('input[name="'+containerId+'-mode"]');
  var mode = 'auto';
  radios.forEach(function(r){ if(r.checked) mode = r.value; });
  return mode;
}

function _aiOptGetStyle(containerId) {
  var el = document.getElementById(containerId+'-style');
  return (el && el.value.trim()) || (P.conf && P.conf.style) || '';
}

function _aiOptGetRef(containerId) {
  var el = document.getElementById(containerId+'-ref');
  return (el && el.value.trim()) || (P.conf && P.conf.refText) || '';
}

function _aiOptGetManualDesc(containerId) {
  var el = document.getElementById(containerId+'-manual-desc');
  return (el && el.value.trim()) || '';
}

// ==== aiGen_override2.js ====
// ========================================================
// Feature 3+4+5: AI Gen Mode overrides (Part 2)
// Monkey-patches aiGenChr/aiGenFac/aiGenVar/aiGenTech/aiGenCivic/aiGenItems
// and adds style+refText fields to execFullGen panel
// Appended before closing script tag
// ========================================================

(function(){

// ---- wrap aiGenChr ----
window.aiGenChr = async function() {
  var cid = 'agchr';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u89d2\u8272',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u89d2\u8272\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var era = ctx ? ctx.era : '';
        var scnName = ctx ? ctx.name : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62125\u4e2a\u89d2\u8272\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","title":"","desc":"","personality":"","stats":{},"loyalty":70,"ambition":50,"benevolence":50,"intelligence":70,"valor":60,"morale":75,"stance":"","faction":"","isHistorical":false}]';
        } else {
          var histReq = '\u300a\u8981\u6c42\u300b\u4eba\u7269\u5fc5\u987b\u662f' + era + '\u65f6\u671f\u5b9e\u9645\u5b58\u5728\u7684\u5386\u53f2\u4eba\u7269\uff0c\u4e0d\u5f97\u865a\u6784\u3002';
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002' + histReq + '\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62125\u4e2a\u5386\u53f2\u4eba\u7269\uff0c\u4e25\u683c\u6309\u6b63\u53f2\u8fd8\u539f\u3002\u8fd4\u56dejson:[{"name":"","title":"","desc":"","personality":"","stats":{},"loyalty":70,"ambition":50,"benevolence":50,"intelligence":70,"valor":60,"morale":75,"stance":"","faction":"","isHistorical":true}]';
        }
        var content = await callAISmart(prefix + promptBody, 2500,{minLength:200,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
        var jm = content.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(c) {
            P.characters.push({sid:editingScenarioId,name:c.name||'',title:c.title||'',desc:c.desc||'',stats:c.stats||{},stance:c.stance||'',playable:false,personality:c.personality||'',appearance:'',skills:[],loyalty:c.loyalty!=null?c.loyalty:70,morale:c.morale!=null?c.morale:75,ambition:c.ambition!=null?c.ambition:50,benevolence:c.benevolence!=null?c.benevolence:50,intelligence:c.intelligence!=null?c.intelligence:70,valor:c.valor!=null?c.valor:60,dialogues:[],secret:'',faction:c.faction||'',aiPersonaText:'',behaviorMode:'',valueSystem:'',speechStyle:'',rels:[],isHistorical:c.isHistorical||false,age:30,gender:'\u7537'});
          });
          renderEdTab('t-chr'); hideLoading(); toast('\u2705 \u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(err) { hideLoading(); toast('\u5931\u8d25: ' + err.message); }
    }
  );
}

// ---- wrap aiGenFac ----
window.aiGenFac = async function() {
  var cid = 'agfac';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u6d3e\u7cfb',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u6d3e\u7cfb\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var era = ctx ? ctx.era : '';
        var scnName = ctx ? ctx.name : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62123-5\u4e2a\u6d3e\u7cfb\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","leader":"","desc":"","strength":50,"ideology":"","territory":"","traits":[]}]';
        } else {
          var histReq = '\u300a\u8981\u6c42\u300b\u6d3e\u7cfb\u5fc5\u987b\u662f' + era + '\u65f6\u671f\u771f\u5b9e\u5b58\u5728\u7684\u5386\u53f2\u6d3e\u7cfb\u3001\u5355\u8425\u6216\u653f\u6cbb\u96c6\u56e2\uff0c\u9886\u8896\u4eba\u7269\u5fc5\u987b\u662f\u8be5\u65f6\u671f\u5b9e\u6709\u5176\u4eba\uff0c\u4e0d\u5f97\u865a\u6784\u3002';
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002' + histReq + '\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62123-5\u4e2a\u5386\u53f2\u4e0a\u5b9e\u9645\u5b58\u5728\u7684\u6d3e\u7cfb\u6216\u653f\u6cbb\u96c6\u56e2\uff0c\u4e25\u683c\u6309\u6b63\u53f2\u8fd8\u539f\u3002\u8fd4\u56dejson:[{"name":"","leader":"","desc":"","strength":50,"ideology":"","territory":"","traits":[]}]';
        }
        var c = await callAISmart(prefix + promptBody, 2000,{minLength:150,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(f) {
            P.factions.push({sid:editingScenarioId,name:f.name||'',leader:f.leader||'',desc:f.desc||'',color:'#'+Math.floor(random()*16777215).toString(16).padStart(6,'0'),traits:f.traits||[],strength:f.strength||50,territory:f.territory||'',ideology:f.ideology||''});
          });
          renderEdTab('t-fac'); hideLoading(); toast('\u2705 \u5386\u53f2\u6d3e\u7cfb\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- wrap aiGenVar ----
window.aiGenVar = async function() {
  var cid = 'agvar';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u53d8\u91cf\u4e0e\u5173\u7cfb',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      var sid = editingScenarioId;
      if (!sid) { toast('\u8bf7\u5148\u9009\u62e9\u5267\u672c'); return; }
      var scn = findScenarioById(sid)||{};
      var ctx = (scn.name||'') + (scn.era ? ',' + scn.era : '') + (scn.background ? ',' + scn.background.slice(0,80) : '');
      var promptBody;
      if (mode === 'manual' && manualDesc) {
        promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62126\u4e2a\u53d8\u91cf\u548c5\u4e2a\u5173\u7cfb\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:{"variables":[{"name":"","value":50,"min":0,"max":100,"desc":""}],"relations":[{"name":"","from":"","to":"","type":"","value":50}]}';
      } else {
        promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002\u5267\u672c\u80cc\u666f\uff1a' + ctx + '\n\u8bf7\u751f\u62126\u4e2a\u5168\u5c40\u53d8\u91cf\u548c5\u4e2a\u4eba\u7269\u5173\u7cfb\u3002\u53d8\u91cf\u5e94\u53cd\u6620\u8be5\u65f6\u671f\u771f\u5b9e\u653f\u6cbb\u3001\u519b\u4e8b\u3001\u7ecf\u6d4e\u3001\u6c11\u5fc3\u72b6\u51b5\u3002\n\u8fd4\u56dejson:{"variables":[{"name":"","value":50,"min":0,"max":100,"desc":""}],"relations":[{"name":"","from":"","to":"","type":"","value":50}]}';
      }
      showLoading('\u751f\u6210\u53d8\u91cf\u4e0e\u5173\u7cfb...');
      try {
        var raw = await callAISmart(prefix + promptBody, 2000,{minLength:100,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,'').trim());return j.variables&&Array.isArray(j.variables)&&j.variables.length>=6;}catch(e){return false;}}});
        var j = JSON.parse(raw.replace(/```json|```/g,'').trim());
        var added = 0;
        if (j.variables && Array.isArray(j.variables)) j.variables.forEach(function(v) {
          P.variables.push({id:uid(),sid:sid,name:v.name||'',value:v.value!=null?v.value:50,min:v.min!=null?v.min:0,max:v.max!=null?v.max:100,color:'#c9a84c',icon:'',cat:'',visible:true,desc:v.desc||''});
          added++;
        });
        if (j.relations && Array.isArray(j.relations)) j.relations.forEach(function(r) {
          P.relations.push({id:uid(),sid:sid,name:r.name||(r.from+'\u2192'+r.to),from:r.from||'',to:r.to||'',type:r.type||'',value:r.value!=null?r.value:50,desc:''});
          added++;
        });
        saveP(); renderEdTab('t-var'); toast('\u5df2\u751f\u6210\u53d8\u91cf/\u5173\u7cfb ' + added + '\u4e2a');
      } catch(e) { toast('\u751f\u6210\u5931\u8d25:' + e.message); }
      finally { hideLoading(); }
    }
  );
}

// ---- wrap aiGenTech ----
window.aiGenTech = async function() {
  var cid = 'agtech';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u79d1\u6280',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u79d1\u6280\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var scnName = ctx ? ctx.name : '';
        var era = ctx ? ctx.era : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62128\u4e2a\u79d1\u6280\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","desc":"","prereqs":[],"costs":[],"effect":{},"era":""}]';
        } else {
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62128\u4e2a\u8be5\u65f6\u671f\u5b9e\u9645\u5b58\u5728\u7684\u5386\u53f2\u79d1\u6280\u6216\u5236\u5ea6\u521b\u65b0\u3002\u8fd4\u56dejson:[{"name":"","desc":"","prereqs":[],"costs":[{"variable":"\u7ecf\u6d4e\u5b9e\u529b","amount":20}],"effect":{},"era":"\u521d\u7ea7/\u4e2d\u7ea7/\u9ad8\u7ea7"}]';
        }
        var c = await callAISmart(prefix + promptBody, 2000,{minLength:200,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=8;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(t) {
            P.techTree.push({sid:editingScenarioId,name:t.name||'',desc:t.desc||'',prereqs:t.prereqs||[],costs:t.costs||[],effect:t.effect||{},era:t.era||'\u521d\u7ea7',unlocked:false});
          });
          renderEdTab('t-tech'); hideLoading(); toast('\u2705 \u79d1\u6280\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- wrap aiGenCivic ----
window.aiGenCivic = async function() {
  var cid = 'agcivic';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u5e02\u653f',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      showLoading('\u751f\u6210\u5e02\u653f\u4e2d...',20);
      try {
        var ctx = findScenarioById(editingScenarioId);
        var era = ctx ? ctx.era : '';
        var scnName = ctx ? ctx.name : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62123-5\u4e2a\u5e02\u653f\u6216\u5236\u5ea6\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","desc":"","era":"","prereqs":[],"effect":{},"costs":[]}]';
        } else {
          promptBody = '\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002\u8bf7\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62123-5\u4e2a\u5e02\u653f\u6b63\u7b56\u6216\u5236\u5ea6\uff0c\u5fc5\u987b\u662f\u8be5\u65f6\u671f\u5386\u53f2\u4e0a\u5b9e\u9645\u5b58\u5728\u7684\u3002\u8fd4\u56dejson:[{"name":"","desc":"","era":"","prereqs":[],"effect":{},"costs":[]}]';
        }
        var c = await callAISmart(prefix + promptBody, 2000,{minLength:150,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(v) {
            P.civicTree.push({sid:editingScenarioId,name:v.name||'',desc:v.desc||'',era:v.era||era,prereqs:v.prereqs||[],costs:v.costs||[],effect:v.effect||{},adopted:false});
          });
          renderEdTab('t-civic'); hideLoading(); toast('\u2705 \u5e02\u653f\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- wrap aiGenItems ----
window.aiGenItems = async function() {
  var cid = 'agitm';
  var bodyHTML = _aiGenOptionsHTML(cid, true);
  openGenericModal(
    '\u{1F916} AI\u751f\u6210\u7269\u54c1',
    bodyHTML,
    async function() {
      closeGenericModal();
      var mode = _aiOptGetMode(cid);
      var styleVal = _aiOptGetStyle(cid);
      var refVal = _aiOptGetRef(cid);
      var manualDesc = _aiOptGetManualDesc(cid);
      var prefix = _aiStylePrefix(styleVal, refVal);
      try {
        showLoading('\u751f\u6210\u7269\u54c1\u4e2d...',20);
        var ctx = findScenarioById(editingScenarioId);
        var scnName = ctx ? ctx.name : '';
        var era = ctx ? ctx.era : '';
        var promptBody;
        if (mode === 'manual' && manualDesc) {
          promptBody = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u63cf\u8ff0\u751f\u62123-5\u4e2a\u7269\u54c1\uff1a' + manualDesc + '\u3002\u8fd4\u56dejson:[{"name":"","type":"item/tech/policy","desc":"","effect":{},"prerequisite":""}]';
        } else {
          promptBody = '\u4e3a\u5267\u672c\u300a' + scnName + '\u300b(' + era + ')\u751f\u62123-5\u4e2a\u5177\u6709\u5386\u53f2\u611f\u7684\u7269\u54c1\u6216\u5b9d\u7269\u3002\u8fd4\u56dejson:[{"name":"","type":"item","desc":"","effect":{},"prerequisite":""}]';
        }
        var c = await callAISmart(prefix + promptBody, 1500,{minLength:100,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
        var jm = c.match(/\[[\s\S]*\]/);
        if (jm) {
          JSON.parse(jm[0]).forEach(function(t) {
            P.items.push({sid:editingScenarioId,name:t.name||'',type:t.type||'item',desc:t.desc||'',effect:t.effect||{},prereq:t.prerequisite||'',acquired:false});
          });
          renderEdTab('t-itm'); hideLoading(); toast('\u2705 \u7269\u54c1\u5df2\u751f\u6210');
        } else { hideLoading(); toast('\u89e3\u6790\u5931\u8d25'); }
      } catch(e) { hideLoading(); toast('\u5931\u8d25: ' + e.message); }
    }
  );
}

// ---- override aiGenFullScenario: inject style+ref fields into panel ----
window.aiGenFullScenario = function() {
  var panel = _$('ai-full-gen-panel');
  if (!panel) return;
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  var globalStyle = (typeof P !== 'undefined' && P.conf && P.conf.style) || '\u6587\u5b66\u5316';
  panel.innerHTML =
    '<div class="cd"><h4 style="color:var(--gold);">\uD83E\uDD16 AI\u751f\u6210\u5386\u53f2\u5267\u672c</h4>'+
    '<div class="rw"><div class="fd full"><label>\u671d\u4ee3 / \u7687\u5e1d <span style="color:var(--txt-d);font-size:0.8rem;">\uff08\u5fc5\u586b\uff09</span></label>'+
    '<input id="fg-dynasty" placeholder="\u5982\uff1a\u660e\u671d\u5d07\u797a\u7687\u5e1d / \u5510\u671d\u674e\u4e16\u6c11" style="width:100%;"></div></div>'+
    '<div class="rw"><div class="fd full"><label>\u8865\u5145\u63cf\u8ff0 <span style="color:var(--txt-d);font-size:0.8rem;">\uff08\u53ef\u9009\uff0c\u6307\u5b9a\u80cc\u666f\u3001\u4e8b\u4ef6\uff09</span></label>'+
    '<textarea id="fg-desc" rows="2" placeholder="\u5982\uff1a\u5d07\u797a\u5341\u4e03\u5e74\uff0c\u674e\u81ea\u6210\u5175\u4e34\u57ce\u4e0b\uff0c\u671d\u5c40\u52a8\u8361\u2026"></textarea></div></div>'+
    '<div class="rw"><div class="fd"><label>\u751f\u6210\u8be6\u7ec6\u7a0b\u5ea6</label>'+
    '<select id="fg-words"><option value="brief">\u7b80\u7565\uff08\u5feb\u901f\uff09</option><option value="normal" selected>\u6807\u51c6\uff08\u63a8\u8350\uff09</option><option value="detailed">\u8be6\u7ec6\uff08\u5185\u5bb9\u4e30\u5bcc\uff09</option><option value="full">\u5b8c\u6574\uff08\u6700\u8be6\u5c3d\uff09</option></select></div></div>'+
    '<details style="margin:0.4rem 0;"><summary style="font-size:0.82rem;color:var(--txt-d);cursor:pointer;">\u2699\ufe0f \u9ad8\u7ea7\u9009\u9879</summary>'+
    '<div style="padding:0.4rem 0;">'+
    '<div style="margin-bottom:0.3rem;"><label style="font-size:0.8rem;color:var(--txt-d);">\u5399\u4e8b\u98ce\u683c\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40: ' + globalStyle + ')</span></label>'+
    '<input id="fg-style" placeholder="\u5982\uff1a\u5c0f\u8bf4\u98ce\u683c/\u8bf4\u4e66\u4eba\u98ce\u683c/\u6b63\u53f2\u98ce\u683c" style="width:100%;font-size:0.82rem;"></div>'+
    '<div><label style="font-size:0.8rem;color:var(--txt-d);">\u53c2\u8003\u8d44\u6599\u8986\u76d6 <span style="font-size:0.75rem;">(\u7a7a\u5219\u7528\u5168\u5c40\u53c2\u8003\u6587\u672c)</span></label>'+
    '<textarea id="fg-ref" rows="2" placeholder="\u53ef\u8d34\u5165\u53c2\u8003\u6587\u672c\u3001\u53f2\u4e66\u6bb5\u843d\u7b49\u2026" style="width:100%;font-size:0.82rem;"></textarea></div>'+
    '</div></details>'+
    '<button class="bai" onclick="execFullGen()" style="margin-top:0.8rem;width:100%;">\uD83D\uDE80 \u5f00\u59cb\u751f\u6210\u5386\u53f2\u5267\u672c</button>'+
    '<div id="fg-status" style="font-size:0.82rem;color:var(--txt-d);margin-top:0.3rem;"></div></div>';
}

// ---- patch execFullGen: wrap callAI to prepend style+ref prefix to all 11 prompts ----
var _orig_execFullGen = typeof execFullGen === 'function' ? execFullGen : null;
window.execFullGen = async function() {
  var styleEl = document.getElementById('fg-style');
  var refEl = document.getElementById('fg-ref');
  var styleVal = (styleEl && styleEl.value.trim()) || (P.conf && P.conf.style) || '';
  var refVal = (refEl && refEl.value.trim()) || (P.conf && P.conf.refText) || '';
  var prefix = _aiStylePrefix(styleVal, refVal);
  if (!prefix || !_orig_execFullGen) {
    if (_orig_execFullGen) return _orig_execFullGen.apply(this, arguments);
    return;
  }
  var _origCallAI = callAI;
  callAI = function(prompt, maxTok, signal) {
    return _origCallAI(prefix + prompt, maxTok, signal);
  };
  try {
    return await _orig_execFullGen.apply(this, arguments);
  } finally {
    callAI = _origCallAI;
    if (typeof _fgHideProgress === 'function') _fgHideProgress();
  }
}

})();

// ========================================================
// Phase 6: editTech / editFac / editRul / editEvt
// + render overrides with edit buttons
// ========================================================

// ---- editTech(i) ----
function editTech(i) {
  var t = P.techTree[i];
  if (!t) return;
  openGenericModal(
    '\u7F16\u8F91\u79D1\u6280',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="etk-name" value="' + (t.name||'') + '"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="etk-desc" rows="2">' + (t.desc||'') + '</textarea></div>'+
    '<div class="form-group"><label>\u65F6\u4EE3</label><select id="etk-era"><option value="\u521D\u7EA7"' + (t.era==='\u521D\u7EA7'?' selected':'') + '>\u521D\u7EA7</option><option value="\u4E2D\u7EA7"' + (t.era==='\u4E2D\u7EA7'?' selected':'') + '>\u4E2D\u7EA7</option><option value="\u9AD8\u7EA7"' + (t.era==='\u9AD8\u7EA7'?' selected':'') + '>\u9AD8\u7EA7</option></select></div>'+
    '<div class="form-group"><label>\u524D\u7F6E\u6761\u4EF6(\u9017\u53F7\u5206\u9694)</label><input id="etk-prereqs" value="' + (t.prereqs||[]).join(',') + '"></div>'+
    '<div class="form-group"><label>\u6548\u679C(JSON)</label><input id="etk-effect" value="' + JSON.stringify(t.effect||{}) + '"></div>',
    function() {
      var tk = P.techTree[i];
      if (!tk) return;
      tk.name = gv('etk-name');
      tk.desc = gv('etk-desc');
      tk.era = gv('etk-era');
      tk.prereqs = gv('etk-prereqs').split(',').map(function(s){return s.trim();}).filter(Boolean);
      try { tk.effect = JSON.parse(gv('etk-effect')); } catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
      renderEdTab('t-tech');
    }
  );
}

// ---- override renderTechTab with edit buttons ----
function renderTechTab(em, sid) {
  var list = P.techTree.filter(function(t){ return t.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\u79D1\u6280\u6811 (' + list.length + ')</h4>'+
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">'+
    '<button class="bt bp" onclick="openGenericModal(\u0027\u6DFB\u52A0\u79D1\u6280\u0027,'+
    '\u0027<div class=\\"form-group\\"><label>\u540D\u79F0</label><input id=\\"ntk-name\\" placeholder=\"\u65B0\u79D1\u6280\"></div><div class=\\"form-group\\"><label>\u63CF\u8FF0</label><textarea id=\\"ntk-desc\\" rows=\\"2\\"></textarea></div><div class=\\"form-group\\"><label>\u65F6\u4EE3</label><select id=\\"ntk-era\\"><option value=\\"\u521D\u7EA7\\" selected>\u521D\u7EA7</option><option value=\\"\u4E2D\u7EA7\\">\u4E2D\u7EA7</option><option value=\\"\u9AD8\u7EA7\\">\u9AD8\u7EA7</option></select></div>\u0027,'+
    'function(){P.techTree.push({sid:editingScenarioId,name:gv(\u0027ntk-name\u0027)||\u0027\u65B0\u79D1\u6280\u0027,desc:gv(\u0027ntk-desc\u0027),prereqs:[],costs:[],effect:{},era:gv(\u0027ntk-era\u0027),unlocked:false});renderEdTab(\u0027t-tech\u0027);});">\uFF0B</button>'+
    '<button class="bai" onclick="aiGenTech()">\uD83E\uDD16 AI\u751F\u6210</button></div>'+
    list.map(function(t) {
      var i = P.techTree.indexOf(t);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<span><strong>' + t.name + '</strong> <span class="tg">' + (t.era||'') + '</span></span>'+
        '<span><button class="bt bsm" onclick="editTech(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.techTree.splice(' + i + ',1);renderEdTab(\u0027t-tech\u0027);">\u2715</button></span></div>'+
        (t.desc ? '<div style="font-size:0.82rem;color:var(--txt-d);margin-top:0.3rem;">' + t.desc + '</div>' : '') +
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- editFac(i) ----
function editFac(i) {
  var f = P.factions[i];
  if (!f) return;
  openGenericModal(
    '\u7F16\u8F91\u6D3E\u7CFB',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="efc-name" value="' + (f.name||'') + '"></div>'+
    '<div class="form-group"><label>\u9886\u8896</label><input id="efc-leader" value="' + (f.leader||'') + '"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="efc-desc" rows="2">' + (f.desc||'') + '</textarea></div>'+
    '<div class="form-group"><label>\u610F\u8BC6\u5F62\u6001</label><input id="efc-ideology" value="' + (f.ideology||'') + '"></div>'+
    '<div class="form-group"><label>\u5730\u76D8</label><input id="efc-territory" value="' + (f.territory||'') + '"></div>'+
    '<div class="form-group"><label>\u5B9E\u529B (0-100)</label><input type="range" id="efc-strength" min="0" max="100" value="' + (f.strength!=null?f.strength:50) + '" oninput="document.getElementById(\u0027efc-strength-v\u0027).textContent=this.value"> <span id="efc-strength-v">' + (f.strength!=null?f.strength:50) + '</span></div>',
    function() {
      var fc = P.factions[i];
      if (!fc) return;
      fc.name = gv('efc-name');
      fc.leader = gv('efc-leader');
      fc.desc = gv('efc-desc');
      fc.ideology = gv('efc-ideology');
      fc.territory = gv('efc-territory');
      fc.strength = parseInt(gv('efc-strength'))||50;
      renderEdTab('t-fac');
    }
  );
}

// ---- override renderFacTab with edit buttons ----
function renderFacTab(em, sid) {
  var list = P.factions.filter(function(f){ return f.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\uD83C\uDFDB \u6D3E\u7CFB (' + list.length + ')</h4>'+
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">'+
    '<button class="bt bp" onclick="P.factions.push({sid:editingScenarioId,name:\u0027\u65B0\u6D3E\u7CFB\u0027,leader:\u0027\u0027,desc:\u0027\u0027,color:\u0027#888\u0027,traits:[],strength:50,territory:\u0027\u0027,ideology:\u0027\u0027,courtInfluence:50,popularInfluence:30});renderEdTab(\u0027t-fac\u0027);">\uFF0B</button>'+
    '<button class="bai" onclick="aiGenFac()">\uD83E\uDD16 AI\u751F\u6210</button></div>'+
    list.map(function(f) {
      var i = P.factions.indexOf(f);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>' + f.name + '</strong>'+
        '<span><button class="bt bsm" onclick="editFac(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.factions.splice(' + i + ',1);renderEdTab(\u0027t-fac\u0027);">\u2715</button></span></div>'+
        (f.desc ? '<div style="font-size:0.82rem;color:var(--txt-d);margin-top:0.2rem;">' + f.desc + '</div>' : '') +
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- editRul(i) ----
function editRul(i) {
  var r = P.rules[i];
  if (!r) return;
  openGenericModal(
    '\u7F16\u8F91\u89C4\u5219',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="erl-name" value="' + (r.name||'') + '"></div>'+
    '<div class="form-group"><label>\u89E6\u53D1\u53D8\u91CF</label><input id="erl-var" value="' + (r.trigger&&r.trigger.variable||'') + '"></div>'+
    '<div class="form-group"><label>\u89E6\u53D1\u6761\u4EF6</label>'+
    '<select id="erl-op"><option value="&lt;"' + ((r.trigger&&r.trigger.op)==='<'?' selected':'') + '>&lt;</option>'+
    '<option value="&gt;"' + ((r.trigger&&r.trigger.op)==='>'?' selected':'') + '>&gt;</option>'+
    '<option value="=="' + ((r.trigger&&r.trigger.op)==='=='?' selected':'') + '>&gt;=</option></select>'+
    ' <input id="erl-val" type="number" value="' + (r.trigger&&r.trigger.value!=null?r.trigger.value:20) + '" style="width:60px;"></div>'+
    '<div class="form-group"><label>\u53D9\u4E8B\u6548\u679C</label><textarea id="erl-narrative" rows="2">' + (r.effect&&r.effect.narrative||'') + '</textarea></div>'+
    '<div class="form-group"><label>\u542F\u7528</label><input type="checkbox" id="erl-enabled"' + (r.enabled?' checked':'') + '></div>',
    function() {
      var rl = P.rules[i];
      if (!rl) return;
      rl.name = gv('erl-name');
      rl.enabled = document.getElementById('erl-enabled').checked;
      if (!rl.trigger) rl.trigger = {type:'threshold',variable:'',op:'<',value:20};
      rl.trigger.variable = gv('erl-var');
      rl.trigger.op = gv('erl-op');
      rl.trigger.value = parseFloat(gv('erl-val'))||0;
      if (!rl.effect) rl.effect = {narrative:'',varChg:{},event:null};
      rl.effect.narrative = gv('erl-narrative');
      renderEdTab('t-rul');
    }
  );
}

// ---- override renderRulTab with edit buttons ----
function renderRulTab(em, sid) {
  var list = P.rules.filter(function(r){ return r.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\u89C4\u5219 (' + list.length + ')</h4>'+
    '<button class="bt bp" style="margin-bottom:0.5rem;" onclick="P.rules.push({sid:editingScenarioId,name:\u0027\u65B0\u89C4\u5219\u0027,enabled:true,trigger:{type:\u0027threshold\u0027,variable:\u0027\u0027,op:\u0027<\u0027,value:20},effect:{narrative:\u0027\u0027,varChg:{},event:null}});renderEdTab(\u0027t-rul\u0027);">\uFF0B</button>'+
    list.map(function(r) {
      var i = P.rules.indexOf(r);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>' + r.name + '</strong>'+
        '<span><button class="bt bsm" onclick="editRul(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.rules.splice(' + i + ',1);renderEdTab(\u0027t-rul\u0027);">\u2715</button></span></div>'+
        '<div style="font-size:0.78rem;color:var(--txt-d);">' + (r.trigger&&r.trigger.variable?r.trigger.variable+' '+r.trigger.op+' '+r.trigger.value:'') + '</div>'+
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- editEvt(i) ----
function editEvt(i) {
  var ev = P.events[i];
  if (!ev) return;
  openGenericModal(
    '\u7F16\u8F91\u4E8B\u4EF6',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="evt-name" value="' + (ev.name||'') + '"></div>'+
    '<div class="form-group"><label>\u89E6\u53D1\u56DE\u5408</label><input type="number" id="evt-turn" value="' + (ev.triggerTurn||0) + '"></div>'+
    '<div class="form-group"><label>\u7C7B\u578B</label>'+
    '<select id="evt-type"><option value="scripted"' + (ev.type==='scripted'?' selected':'') + '>scripted</option>'+
    '<option value="random"' + (ev.type==='random'?' selected':'') + '>random</option></select></div>'+
    '<div class="form-group"><label>\u53D9\u4E8B</label><textarea id="evt-narrative" rows="3">' + (ev.narrative||'') + '</textarea></div>'+
    '<div class="form-group"><label><input type="checkbox" id="evt-onetime"' + (ev.oneTime?' checked':'') + '> \u4EC5\u89E6\u53D1\u4E00\u6B21</label></div>',
    function() {
      var ev2 = P.events[i];
      if (!ev2) return;
      ev2.name = gv('evt-name');
      ev2.triggerTurn = parseInt(gv('evt-turn'))||0;
      ev2.type = gv('evt-type');
      ev2.narrative = gv('evt-narrative');
      ev2.oneTime = document.getElementById('evt-onetime').checked;
      renderEdTab('t-evt');
    }
  );
}

// ---- override renderEvtTab with edit buttons ----
function renderEvtTab(em, sid) {
  var list = P.events.filter(function(ev){ return ev.sid===sid; });
  em.innerHTML =
    '<h4 style="color:var(--gold);">\u4E8B\u4EF6 (' + list.length + ')</h4>'+
    '<button class="bt bp" style="margin-bottom:0.5rem;" onclick="P.events.push({sid:editingScenarioId,id:uid(),name:\u0027\u65B0\u4E8B\u4EF6\u0027,type:\u0027scripted\u0027,triggerTurn:0,oneTime:true,triggered:false,narrative:\u0027\u0027,choices:[]});renderEdTab(\u0027t-evt\u0027);">\uFF0B</button>'+
    list.map(function(ev) {
      var i = P.events.indexOf(ev);
      return '<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>' + ev.name + '</strong>'+
        '<span><button class="bt bsm" onclick="editEvt(' + i + ')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.events.splice(' + i + ',1);renderEdTab(\u0027t-evt\u0027);">\u2715</button></span></div>'+
        '<div style="font-size:0.78rem;color:var(--txt-d);">\u7B2C ' + (ev.triggerTurn||0) + ' \u56DE\u5408 | ' + (ev.type||'scripted') + (ev.oneTime?' | \u5355\u6B21':'') + '</div>'+
        '</div>';
    }).join('') || '<div style="color:var(--txt-d);font-size:0.85rem;">\u6682\u65E0</div>';
}

// ---- Feature 7: Enhanced game modes — pre-turn prompt injection ----
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子10）

// ---- Feature 6: Reference book import + world rules — patch renderWldTab ----
(function(){
  var _origRenderWldTab = typeof renderWldTab === 'function' ? renderWldTab : null;
  renderWldTab = function(em, sid) {
    if (_origRenderWldTab) _origRenderWldTab.apply(this, arguments);
    if (!em) em = _$('em');
    if (!em) return;
    var refVal = (typeof P !== 'undefined' && P.conf && P.conf.refText) ? P.conf.refText : '';
    var refSection = document.createElement('div');
    refSection.id = 'wld-ref-section';
    refSection.innerHTML =
      '<hr class="dv">'+
      '<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">参考书目</div>'+
      '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.5rem;">全局参考资料，供 AI 生成和史实模式使用。</div>'+
      '<div class="fd full">'+
      '<label>参考资料（可粘贴史书段落、论文等）</label>'+
      '<textarea id="wld-ref-text" rows="6" style="width:100%;" placeholder="在此粘贴参考文本…">' + (refVal.replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '</textarea>'+
      '</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;">'+
      '<button class="bt bp" onclick="_wldSaveRef()">✅ 保存参考资料</button>'+
      '<button class="bt" onclick="_wldImportRef()">📂 导入文件</button>'+
      '<button class="bd" onclick="if(confirm(\'\u786e认清空参考资料?\')){\'wld-ref-text\';document.getElementById(\'wld-ref-text\').value=\'\';_wldSaveRef();toast(\'\u5df2清空\');}">\uD83D\uDDD1\uFE0F 清空</button>'+
      '</div>'+
      '<div id="wld-ref-info" style="font-size:0.78rem;color:var(--txt-d);margin-top:0.25rem;">' + (refVal ? '已存储 ' + refVal.length + ' 字符' : '未设置') + '</div>';
    em.appendChild(refSection);
  };
})();

function _wldSaveRef() {
  var el = document.getElementById('wld-ref-text');
  if (!el) return;
  if (!P.conf) P.conf = {};
  P.conf.refText = el.value;
  saveP();
  var info = document.getElementById('wld-ref-info');
  if (info) info.textContent = P.conf.refText ? '已存储 ' + P.conf.refText.length + ' 字符' : '未设置';
  toast('✅ 参考资料已保存');
}

function _wldImportRef() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.md';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var el = document.getElementById('wld-ref-text');
      if (el) {
        el.value = ev.target.result;
        _wldSaveRef();
      }
    };
    reader.readAsText(file, 'utf-8');
  };
  input.click();
}

// ============================================================
//  Phase 6 overrides: renderCivicTab / renderOfficeTab / aiGenOfficeEd
// ============================================================

// Override renderCivicTab: replace inline push with openGenericModal
function renderCivicTab(em) {
  var sid = editingScenarioId;
  var rows = (P.civicTree || []).map(function(c, i) {
    if (c.sid !== sid) return '';
    return '<div class="card" style="margin-bottom:6px;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;">'+
      '<strong>' + (c.name || '') + '</strong>'+
      '<span><button class="bt bsm" onclick="editCivic(' + i + ')">' + '\u7F16\u8F91</button>'+
      '<button class="bd bsm" onclick="P.civicTree.splice(' + i + ',1);renderEdTab(\'t-civic\');">\u2715</button></span>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--txt-d);margin-top:2px;">' + (c.desc || '') + '</div>'+
      '</div>';
  }).join('');
  em.innerHTML = '<h4 style="color:var(--gold);">\u5E02\u653F\u6811</h4>'+
    '<div style="display:flex;gap:8px;margin-bottom:0.5rem;">'+
    '<button class="bt bp" onclick="_addCivic()">\uFF0B</button>'+
    '<button class="bt" onclick="aiGenCivic()">\u2728 AI\u751F\u6210</button>'+
    '</div>' + rows;
}

// _addCivic: open modal to create new civic item
function _addCivic() {
  openGenericModal('\u65B0\u5EFA\u5E02\u653F',
    '<div class="form-group"><label>\u540D\u79F0</label><input id="gmf-name" placeholder="\u5E02\u653F\u540D\u79F0"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="gmf-desc" rows="2"></textarea></div>'+
    '<div class="form-group"><label>\u65F6\u4EE3</label><input id="gmf-era" value="\u521D\u7EA7"></div>',
    function() {
      if (!P.civicTree) P.civicTree = [];
      P.civicTree.push({
        sid: editingScenarioId,
        name: gv('gmf-name') || '\u65B0\u5E02\u653F',
        desc: gv('gmf-desc'),
        era: gv('gmf-era') || '\u521D\u7EA7',
        prereqs: [], costs: [], effect: {}, adopted: false
      });
      renderEdTab('t-civic');
    }
  );
}

// Office hierarchy helpers
function _officeGetByPath(path) {
  if (!P.officeTree) P.officeTree = [];
  var node = { subs: P.officeTree };
  var i = 0;
  while (i < path.length) {
    var seg = path[i];
    if (seg === 's') {
      // next segment is the sub-dept index
      i++; if (i >= path.length) return null;
      if (!node.subs) return null;
      node = node.subs[path[i]];
    } else if (seg === 'p') {
      // next segment is the position index
      i++; if (i >= path.length) return null;
      if (!node.positions) return null;
      node = node.positions[path[i]];
    } else {
      // legacy numeric-only path (top-level dept index)
      if (!node.subs) return null;
      node = node.subs[seg];
    }
    if (!node) return null;
    i++;
  }
  return node;
}
function _officeGetParentArr(path) {
  if (path.length === 0) return P.officeTree;
  // For tree-style paths ending in ['s', idx] or legacy [idx]
  var parentPath = path.slice(0, -2);
  var lastMarker = path[path.length - 2];
  if (lastMarker !== 's' && lastMarker !== 'p') {
    // legacy single-segment path
    return P.officeTree;
  }
  var parent = _officeGetByPath(parentPath);
  if (!parent) return null;
  if (lastMarker === 'p') {
    if (!parent.positions) parent.positions = [];
    return parent.positions;
  }
  if (!parent.subs) parent.subs = [];
  return parent.subs;
}
function _officeBuildTree(collapsed, opts) {
  if (!P.officeTree) P.officeTree = [];
  var W = (opts && opts.W) || 150, H = (opts && opts.H) || 44;
  var H_GAP = (opts && opts.H_GAP) || 30, V_GAP = (opts && opts.V_GAP) || 90;

  // Build a virtual Emperor root that wraps all top-level depts
  var rootData = {name: '皇帝', desc: '', positions: [], subs: P.officeTree};

  function buildNode(nd, path, depth, isPos, posIdx) {
    var key = JSON.stringify(path);
    var isCollapsed = !!(collapsed && collapsed[key]);
    var children = [];
    if (!isPos && !isCollapsed) {
      // dept children first: sub-departments
      var subs = nd.subs || [];
      for (var i = 0; i < subs.length; i++)
        children.push(buildNode(subs[i], path.concat(['s', i]), depth + 1, false, -1));
      // then positions as leaf nodes
      var ps = nd.positions || [];
      for (var pi = 0; pi < ps.length; pi++)
        children.push(buildNode(ps[pi], path.concat(['p', pi]), depth + 1, true, pi));
    }
    return {node: nd, path: path, depth: depth, children: children,
            isPos: isPos, posIdx: posIdx,
            leafCount: 0, x: 0, y: 0, w: W, h: H,
            collapsed: isCollapsed && !isPos};
  }

  function countLeaves(n) {
    if (!n.children.length) { n.leafCount = 1; return 1; }
    var total = 0;
    for (var i = 0; i < n.children.length; i++) total += countLeaves(n.children[i]);
    n.leafCount = Math.max(total, 1);
    return n.leafCount;
  }

  function assignXY(n, leftLeaf) {
    n.y = n.depth * (H + V_GAP);
    if (!n.children.length) {
      n.x = leftLeaf * (W + H_GAP);
    } else {
      var cursor = leftLeaf;
      for (var i = 0; i < n.children.length; i++) {
        assignXY(n.children[i], cursor);
        cursor += n.children[i].leafCount;
      }
      var fc = n.children[0], lc = n.children[n.children.length - 1];
      n.x = (fc.x + fc.w / 2 + lc.x + lc.w / 2) / 2 - W / 2;
    }
  }

  var flat = [];
  function flatten(n, parentRef) {
    var entry = {node: n.node, path: n.path, depth: n.depth,
                 x: n.x, y: n.y, w: n.w, h: n.h,
                 parent: parentRef, children: n.children,
                 collapsed: n.collapsed, isPos: n.isPos, posIdx: n.posIdx};
    flat.push(entry);
    for (var i = 0; i < n.children.length; i++) flatten(n.children[i], entry);
  }

  var root = buildNode(rootData, [], 0, false, -1);
  countLeaves(root);
  assignXY(root, 0);
  flatten(root, null);

  var maxX = 0, maxY = 0;
  for (var i = 0; i < flat.length; i++) {
    if (flat[i].x + flat[i].w > maxX) maxX = flat[i].x + flat[i].w;
    if (flat[i].y + flat[i].h > maxY) maxY = flat[i].y + flat[i].h;
  }
  return {flat: flat, width: maxX + H_GAP * 4, height: maxY + V_GAP * 2,
          nodeW: W, nodeH: H};
}

// v10·嵌套群组四层树 Emperor → Group → Dept → Pos（群组纵叠）
// opts: { courtKey, subTab, collapsed, W_DEPT, W_POS, H_DEPT, H_POS, H_GROUP, H_EMP }
function _officeBuildTreeV10(opts) {
  opts = opts || {};
  var courtKey = opts.courtKey || 'central';
  var subTab = opts.subTab || 'all';
  var collapsed = opts.collapsed || {};

  var EMP_W = opts.EMP_W || 240;
  var EMP_H = opts.EMP_H || 90;
  var GROUP_H = opts.GROUP_H || 60;
  var DEPT_W = opts.DEPT_W || 220;
  var DEPT_H = opts.DEPT_H || 110;
  var POS_W = opts.POS_W || 240;
  var POS_H = opts.POS_H || 210;
  var H_GAP = opts.H_GAP || 22;
  var DEPT_GAP = opts.DEPT_GAP || 16;
  var V_GAP = opts.V_GAP || 46;
  var V_GAP_GROUP = opts.V_GAP_GROUP || 32;

  // 优先用 opts.officeTree（GM.officeTree），fallback 到 P.officeTree 以兼容旧调用
  var depts = opts.officeTree || P.officeTree || [];
  var _collapseMap = opts.collapsedSrc || collapsed || {};
  // 分类（不在 tm-audio-theme.js 中硬编 map·依赖 window._officeClassifyDept）
  var classify = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept : function(){ return { court:'central', group:'sijian' }; };

  // 过滤属于本 court 的部门·并进一步按 subTab
  var courtDepts = [];
  depts.forEach(function(d, idx){
    var cls = classify(d);
    if (cls.court !== courtKey) return;
    if (subTab !== 'all' && cls.group !== subTab) return;
    courtDepts.push({ dept:d, idx:idx, group:cls.group });
  });

  // 群组分桶·保持 subTab 顺序
  var GROUP_ORDER = (typeof OFFICE_SUBTABS !== 'undefined' && OFFICE_SUBTABS[courtKey])
    ? OFFICE_SUBTABS[courtKey].filter(function(g){ return g.key !== 'all'; })
    : [];
  var groupBuckets = {};
  GROUP_ORDER.forEach(function(g){ groupBuckets[g.key] = []; });
  courtDepts.forEach(function(cd){
    if (!groupBuckets[cd.group]) groupBuckets[cd.group] = [];
    groupBuckets[cd.group].push(cd);
  });

  // Emperor 虚根
  var emperor = { type:'emperor', node:null, children:[], parent:null, w:EMP_W, h:EMP_H, depth:0, path:[] };

  // 构造群组子树
  var groupNodes = [];
  GROUP_ORDER.forEach(function(g){
    var bucket = groupBuckets[g.key] || [];
    if (bucket.length === 0) return;
    var gNode = {
      type:'group', node:null, groupCfg:g, groupKey:g.key, courtKey:courtKey,
      children:[], parent:emperor, w:0, h:GROUP_H, depth:1
    };
    bucket.forEach(function(cd){
      var key = JSON.stringify([cd.idx]);
      var isCollapsed = !!collapsed[key];
      var deptNode = {
        type:'dept', node:cd.dept, path:[cd.idx], deptIdx:cd.idx,
        collapsed:isCollapsed, children:[], parent:gNode,
        w:DEPT_W, h:DEPT_H, depth:2
      };
      if (!isCollapsed) {
        (cd.dept.positions || []).forEach(function(p, pi){
          deptNode.children.push({
            type:'pos', node:p, deptName:cd.dept.name, deptIdx:cd.idx, posIdx:pi,
            path:[cd.idx, 'p', pi], children:[], parent:deptNode,
            w:POS_W, h:POS_H, depth:3
          });
        });
      }
      gNode.children.push(deptNode);
    });
    groupNodes.push(gNode);
  });
  emperor.children = groupNodes;

  // leafCount 递归
  function countLeaves(n) {
    if (!n.children.length) { n.leafCount = 1; return 1; }
    var t = 0;
    for (var i = 0; i < n.children.length; i++) t += countLeaves(n.children[i]);
    n.leafCount = Math.max(t, 1);
    return n.leafCount;
  }
  groupNodes.forEach(countLeaves);

  // 每群组独立布局·按行纵叠
  var yCursor = EMP_H + V_GAP;
  groupNodes.forEach(function(gNode) {
    var groupY = yCursor;
    var deptY = groupY + GROUP_H + V_GAP_GROUP;
    var posY = deptY + DEPT_H + V_GAP;
    var hasExp = gNode.children.some(function(d){ return d.children.length > 0; });

    function assignXY(n, leftX) {
      if (n.type === 'group') n.y = groupY;
      else if (n.type === 'dept') n.y = deptY;
      else if (n.type === 'pos') n.y = posY;

      if (!n.children.length) {
        var slotW = (n.type === 'pos') ? (POS_W + H_GAP) : (DEPT_W + DEPT_GAP);
        n.x = leftX + (slotW - n.w) / 2;
        n.slotW = slotW;
      } else {
        var cursor = leftX;
        n.children.forEach(function(c){ assignXY(c, cursor); cursor += c.slotW; });
        var fc = n.children[0], lc = n.children[n.children.length-1];
        if (n.type === 'group') {
          n.w = (lc.x + lc.w) - fc.x + 40;
          n.x = fc.x - 20;
          n.slotW = cursor - leftX;
        } else {
          var centerX = (fc.x + fc.w/2 + lc.x + lc.w/2) / 2;
          n.x = centerX - n.w/2;
          n.slotW = cursor - leftX;
        }
      }
    }
    assignXY(gNode, 0);

    if (hasExp) yCursor = posY + POS_H + V_GAP * 1.4;
    else yCursor = deptY + DEPT_H + V_GAP * 1.4;
  });

  // 水平居中所有群组到同一 cx（等于皇帝 cx）
  var maxGroupW = EMP_W;
  groupNodes.forEach(function(g){ if (g.w > maxGroupW) maxGroupW = g.w; });
  var leftPad = 50;
  var emperorCx = leftPad + maxGroupW / 2;

  groupNodes.forEach(function(gNode){
    var delta = emperorCx - (gNode.x + gNode.w / 2);
    function shift(n){ n.x += delta; n.children.forEach(shift); }
    shift(gNode);
  });

  emperor.x = emperorCx - EMP_W / 2;
  emperor.y = 0;

  var canvasWidth = 2 * leftPad + maxGroupW;
  var canvasHeight = groupNodes.length > 0 ? yCursor : (EMP_H + V_GAP * 2);

  var flat = [emperor];
  groupNodes.forEach(function(gNode){
    flat.push(gNode);
    gNode.children.forEach(function(d){
      flat.push(d);
      d.children.forEach(function(p){ flat.push(p); });
    });
  });

  return {
    flat: flat,
    root: emperor,
    groupNodes: groupNodes,
    emperorCx: emperorCx,
    width: canvasWidth,
    height: canvasHeight,
    isEmpty: groupNodes.length === 0
  };
}

function renderOfficeTab(em) {
  if (!P.officeTree) P.officeTree = [];
  if (!P._officeCollapsed) P._officeCollapsed = {};
  var layout = _officeBuildTree(P._officeCollapsed);
  var flat   = layout.flat;
  var NW = layout.nodeW, NH = layout.nodeH;
  var cw = Math.max(layout.width  + 80, 700);
  var ch = Math.max(layout.height + 80, 400);

  // SVG elbow connectors
  var svgLines = '';
  for (var i = 0; i < flat.length; i++) {
    var fi = flat[i];
    if (!fi.parent) continue;
    var px = fi.parent.x + fi.parent.w / 2;
    var py = fi.parent.y + fi.parent.h;
    var cx = fi.x + fi.w / 2;
    var cy = fi.y;
    var my = py + (cy - py) * 0.5;
    var clr = fi.isPos ? '#4a6a3a' : '#8a6e2e';
    var dsh = fi.isPos ? ' stroke-dasharray="4,3"' : '';
    svgLines += '<path d="M' + px + ',' + py
      + ' L' + px + ',' + my
      + ' L' + cx + ',' + my
      + ' L' + cx + ',' + cy + '"'
      + ' stroke="' + clr + '" stroke-width="1.5" fill="none" opacity="0.9"' + dsh + '/>';
  }

  // Node cards
  var nodesDivs = '';
  for (var i = 0; i < flat.length; i++) {
    var fi  = flat[i];
    var nd  = fi.node;
    var pathStr = JSON.stringify(fi.path);

    if (fi.isPos) {
      // ── Position leaf card ──
      nodesDivs +=
        '<div style="position:absolute;left:' + fi.x + 'px;top:' + fi.y + 'px;'
        + 'width:' + NW + 'px;height:' + NH + 'px;box-sizing:border-box;'
        + 'border:1px solid #2a4a24;border-radius:5px;background:#080e06;'
        + 'overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,0.6)">';
      nodesDivs +=
        '<div style="display:flex;align-items:center;gap:3px;padding:3px 4px;height:100%;box-sizing:border-box">';
      nodesDivs +=
        '<div style="width:20px;height:20px;border-radius:3px;border:1px solid #2a4a24;'
        + 'background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;'
        + 'font-size:10px;color:#6a9a50;flex-shrink:0">位</div>';
      nodesDivs += '<div style="flex:1;min-width:0">';
      var _svgSuccLabel = '';
      if (nd.succession) {
        var _svgSL = {appointment:'\u6D41',hereditary:'\u88AD',examination:'\u79D1',military:'\u519B',recommendation:'\u8350'};
        _svgSuccLabel = _svgSL[nd.succession] ? '<span style="font-size:8px;background:#2a3a24;padding:0 2px;border-radius:2px;color:#7a9a60;margin-left:2px;">' + _svgSL[nd.succession] + '</span>' : '';
      }
      nodesDivs +=
        '<div style="font-size:12px;color:#9ac870;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + (nd.name || '?') + _svgSuccLabel + '</div>';
      if (nd.rank || nd.holder) {
        nodesDivs += '<div style="font-size:10px;color:#5a7a42;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">';
        if (nd.rank)   nodesDivs += nd.rank;
        if (nd.holder) nodesDivs += (nd.rank ? ' \u2013 ' : '') + nd.holder;
        nodesDivs += '</div>';
      }
      nodesDivs += '</div>';
      nodesDivs +=
        '<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">';
      // fi.path for pos is [...deptPath, 'p', pi] — need deptPath and pi separately
      var deptPath4 = fi.path.slice(0, fi.path.length - 2);
      var pi4 = fi.posIdx;
      nodesDivs +=
        '<button class="bd" style="font-size:9px;padding:0 3px;line-height:15px" '
        + 'onclick="_officeEditPos(' + JSON.stringify(deptPath4) + ',' + pi4 + ')">✎</button>';
      nodesDivs +=
        '<button class="bd" style="font-size:9px;padding:0 3px;line-height:15px" '
        + 'onclick="_officeDelPos(' + JSON.stringify(deptPath4) + ',' + pi4 + ')">×</button>';
      nodesDivs += '</div></div></div>';

    } else {
      // ── Department card ──
      var isEmperor = fi.depth === 0;
      var isRoot1   = fi.depth === 1;
      var borderC  = isEmperor ? '#d4a020' : (isRoot1 ? '#8a6e2e' : '#4a3a18');
      var headerBg = isEmperor ? '#2a1a00' : (isRoot1 ? '#1a1206' : '#121008');
      var cardBg   = isEmperor ? '#1e1600' : (isRoot1 ? '#140f04' : '#0e0b04');
      var nameClr  = isEmperor ? '#ffd040' : (isRoot1 ? '#e0b840' : '#c09428');
      var bw       = isEmperor ? '2.5px' : (isRoot1 ? '1.5px' : '1px');
      var icon     = isEmperor ? '天' : (isRoot1 ? '山' : (fi.depth === 2 ? '司' : '所'));

      var psCount  = (nd.positions || []).length;
      var subCount = (nd.subs || []).length;
      var canCollapse = (psCount + subCount > 0) && !isEmperor;
      var isCollapsed4 = fi.collapsed;
      var colBtn = canCollapse
        ? '<button class="bd" style="font-size:9px;padding:0 3px;line-height:16px;margin-left:2px" '
          + 'onclick="_officeToggle(' + pathStr + ')" title="' + (isCollapsed4 ? '展开' : '折叠') + '">'
          + (isCollapsed4 ? '▼' : '▲') + '</button>'
        : '';

      nodesDivs +=
        '<div style="position:absolute;left:' + fi.x + 'px;top:' + fi.y + 'px;'
        + 'width:' + NW + 'px;box-sizing:border-box;border:' + bw + ' solid ' + borderC + ';'
        + 'border-radius:6px;background:' + cardBg + ';overflow:hidden;'
        + 'box-shadow:0 2px 8px rgba(0,0,0,0.7)">';

      // header row
      nodesDivs +=
        '<div style="display:flex;align-items:center;gap:3px;padding:4px 4px;background:' + headerBg + ';border-bottom:1px solid ' + borderC + '">';
      nodesDivs +=
        '<div style="width:20px;height:20px;border-radius:3px;border:1px solid ' + borderC + ';'
        + 'background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;'
        + 'font-size:11px;color:' + nameClr + ';flex-shrink:0">' + icon + '</div>';
      nodesDivs +=
        '<span style="flex:1;font-size:12px;font-weight:bold;color:' + nameClr + ';'
        + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (nd.name || '?') + '</span>';
      nodesDivs += colBtn;
      if (!isEmperor) {
        nodesDivs +=
          '<button class="bd" style="font-size:8px;padding:0 2px;line-height:16px" '
          + 'onclick="_officeEditDept(' + pathStr + ')">✎</button>';
        nodesDivs +=
          '<button class="bd" style="font-size:8px;padding:0 2px;line-height:16px" '
          + 'onclick="_officeAddSub(' + pathStr + ')">↓</button>';
        nodesDivs +=
          '<button class="bd" style="font-size:8px;padding:0 2px;line-height:16px" '
          + 'onclick="_officeDelDept(' + pathStr + ')">×</button>';
      }
      nodesDivs += '</div>';

      // desc + stats strip
      var descText4 = nd.desc || '';
      var statsText4 = '';
      if (psCount)  statsText4 += psCount + '位';
      if (subCount) statsText4 += (statsText4 ? ' ' : '') + subCount + '个子部';
      nodesDivs +=
        '<div style="display:flex;align-items:center;gap:4px;padding:2px 5px;font-size:9px;color:#6a5020">';
      nodesDivs += (descText4
        ? '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + descText4 + '</span>'
        : '<span style="flex:1"></span>');
      if (statsText4)
        nodesDivs += '<span>' + statsText4 + '</span>';
      nodesDivs +=
        '<button class="bt" style="font-size:8px;padding:0 3px;line-height:15px" '
        + 'onclick="_officeAddPos(' + pathStr + ')">+官词</button>';
      nodesDivs += '</div>';

      nodesDivs += '</div>';
    }
  }

  var canvasId  = 'office-tree-canvas';
  var svgId     = 'office-tree-svg';
  var wrapperId = 'office-tree-wrap';

  em.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
    + '<h4 style="color:var(--gold);margin:0">官制树状图</h4>'
    + '<button class="bt bp" onclick="_officeAddTopDept()">＋ 顶层部门</button>'
    + '<button class="bai" onclick="aiGenOfficeEd()">&#x1F916; AI生成</button>'
    + '<span style="font-size:11px;color:var(--txt-d);margin-left:auto">滚轮缩放 拖动平移</span>'
    + '</div>'
    + '<div id="' + wrapperId + '" style="overflow:hidden;border:1px solid #3a2a10;border-radius:8px;background:#0a0804;position:relative;height:520px;cursor:grab">'
    + '<div id="' + canvasId + '" style="position:absolute;transform-origin:0 0;left:0;top:0;width:' + cw + 'px;height:' + ch + 'px">'
    + '<svg id="' + svgId + '" style="position:absolute;top:0;left:0;pointer-events:none" width="' + cw + '" height="' + ch + '">'
    + svgLines
    + '</svg>'
    + nodesDivs
    + '</div>'
    + '</div>';

  // Zoom + pan —— document 级监听只安装一次，避免 renderOfficeTab 重复调用时泄漏
  (function() {
    var wrap = document.getElementById(wrapperId);
    var canvas = document.getElementById(canvasId);
    if (!wrap || !canvas) return;
    // 把拖拽状态挂在 wrap 上，便于全局 handler 查找当前活跃的 wrap
    wrap._officePan = { scale: 1, ox: 20, oy: 20, drag: null, canvas: canvas };
    function applyTransform() {
      var s = wrap._officePan;
      canvas.style.transform = 'translate('+s.ox+'px,'+s.oy+'px) scale('+s.scale+')';
    }
    applyTransform();
    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var s = wrap._officePan;
      var rect = wrap.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var delta = e.deltaY > 0 ? 0.85 : 1.18;
      var newScale = Math.max(0.2, Math.min(3, s.scale * delta));
      s.ox = mx - (mx - s.ox) * (newScale / s.scale);
      s.oy = my - (my - s.oy) * (newScale / s.scale);
      s.scale = newScale;
      applyTransform();
    }, {passive: false});
    wrap.addEventListener('mousedown', function(e) {
      var t = e.target;
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      e.preventDefault();
      var s = wrap._officePan;
      s.drag = {sx: e.clientX - s.ox, sy: e.clientY - s.oy};
      wrap.style.cursor = 'grabbing';
      window._activeOfficePanWrap = wrap;
    });

    // document 级 handler 只注册一次（幂等）
    if (!window._officePanGlobalInstalled) {
      window._officePanGlobalInstalled = true;
      document.addEventListener('mousemove', function(e) {
        var w = window._activeOfficePanWrap;
        if (!w || !w._officePan || !w._officePan.drag) return;
        var s = w._officePan;
        s.ox = e.clientX - s.drag.sx;
        s.oy = e.clientY - s.drag.sy;
        if (s.canvas) s.canvas.style.transform = 'translate('+s.ox+'px,'+s.oy+'px) scale('+s.scale+')';
      });
      document.addEventListener('mouseup', function() {
        var w = window._activeOfficePanWrap;
        if (w && w._officePan) {
          w._officePan.drag = null;
          w.style.cursor = 'grab';
        }
        window._activeOfficePanWrap = null;
      });
    }
  })();
}
function _officeToggle(path) {
  if (!P._officeCollapsed) P._officeCollapsed = {};
  var key = JSON.stringify(path);
  P._officeCollapsed[key] = !P._officeCollapsed[key];
  renderEdTab('t-office');
}



function _renderOfficeDept(dept, path, depth) {
  if (!dept) return '';
  var ps = dept.positions || [];
  var pathStr = JSON.stringify(path);
  var borderStyle = depth === 0
    ? 'border:2px solid var(--gold-dim,#6b5a2e);border-radius:8px;margin-bottom:10px;'
    : 'border:1px solid var(--bg-4,#333);border-radius:6px;margin:6px 0 6px 16px;';
  var bgColor = depth === 0 ? 'var(--bg-2)' : 'var(--bg-3)';
  var fns = dept.functions || [];
  var fnHTML = fns.length
    ? '<div style="padding:3px 8px 6px 8px;display:flex;flex-wrap:wrap;gap:4px">' +
      fns.map(function(fn, fi) {
        return '<span style="background:var(--bg-4,#2a2a2a);color:var(--txt-d);font-size:11px;'
          + 'padding:1px 6px;border-radius:10px;cursor:pointer" '
          + 'onclick="_officeFnDel(' + pathStr + ',' + fi + ')" title="点击删除">× ' + fn + '</span>';
      }).join('') + '</div>'
    : '';
  var posHTML = ps.map(function(p, pi) {
    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;border-top:1px solid var(--bg-4,#333)">'
      + '<span style="flex:1;font-size:12px;color:var(--txt-s)">'
      + (p.name||'')
      + (p.rank ? ' <span style="color:var(--txt-d);font-size:11px">('+p.rank+')</span>' : '')
      + (function(){var _sl={appointment:'\u6D41',hereditary:'\u88AD',examination:'\u79D1',military:'\u519B',recommendation:'\u8350'};return p.succession&&_sl[p.succession]?' <span style="font-size:9px;background:var(--bg-4);padding:0 3px;border-radius:2px;color:var(--txt-d)">'+_sl[p.succession]+'</span>':'';})()
      + (p.holder ? ' <span style="color:var(--gold);font-size:11px">&mdash;'+p.holder+'</span>' : '')
      + '</span>'
      + '<span style="font-size:11px;color:var(--txt-d);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      + (p.desc||'') + '</span>'
      + '<button class="bd bsm" onclick="_officeEditPos(' + pathStr + ',' + pi + ')">✎</button>'
      + '<button class="bd bsm" onclick="_officeDelPos(' + pathStr + ',' + pi + ')">✕</button>'
      + '</div>';
  }).join('');
  var subsHTML = (dept.subs || []).map(function(sub, si) {
    return _renderOfficeDept(sub, path.concat(['s', si]), depth + 1);
  }).join('');
  return '<div style="' + borderStyle + 'overflow:hidden">'
    + '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:' + bgColor + '">'
    + '<strong style="flex:0 0 auto;color:var(--gold)">' + (depth===0?'▶':'▸') + ' ' + (dept.name||'') + '</strong>'
    + (dept.desc
        ? '<span style="font-size:11px;color:var(--txt-d);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + dept.desc + '</span>'
        : '<span style="flex:1"></span>')
    + '<button class="bt bsm" onclick="_officeEditDept(' + pathStr + ')">✎ 编辑</button>'
    + '<button class="bt bsm" onclick="_officeAddFn(' + pathStr + ')">＋ 职能</button>'
    + '<button class="bt bsm" onclick="_officeAddPos(' + pathStr + ')">＋ 官职</button>'
    + '<button class="bt bsm" onclick="_officeAddSub(' + pathStr + ')">＋ 子部门</button>'
    + '<button class="bd bsm" onclick="_officeDelDept(' + pathStr + ')">✕</button>'
    + '</div>'
    + fnHTML + posHTML
    + (subsHTML ? '<div style="padding:0 6px 6px 6px">' + subsHTML + '</div>' : '')
    + '</div>';
}

function _officeAddTopDept() {
  openGenericModal('新建顶层部门',
    '<div class="form-group"><label>部门名称</label><input id="gmf-name" placeholder="如：内阁、内府"></div>'+
    '<div class="form-group"><label>部门职能</label><textarea id="gmf-desc" placeholder="该部门负责的国家职能..."></textarea></div>',
    function() {
      if (!P.officeTree) P.officeTree = [];
      P.officeTree.push({ name: gv('gmf-name') || '新部门', desc: document.getElementById('gmf-desc').value || '', positions: [], subs: [] });
      renderEdTab('t-office');
    }
  );
}
function _officeEditDept(path) {
  var dept = _officeGetByPath(path);
  if (!dept) return;
  var fns = dept.functions || [];
  openGenericModal('编辑部门',
    '<div class="form-group"><label>部门名</label><input id="gmf-name" value="' + (dept.name||'') + '"></div>'+
    '<div class="form-group"><label>简介</label><input id="gmf-desc" value="' + (dept.desc||'') + '"></div>'+
    '<div class="form-group"><label>现有职能（共 ' + fns.length + ' 项，在部门卡头点『＋职能』添加）</label>'+
    '<div style="font-size:12px;color:var(--txt-d)">' + (fns.length ? fns.join('、') : '暂无') + '</div></div>',
    function() {
      dept.name = gv('gmf-name') || dept.name;
      dept.desc = gv('gmf-desc');
      renderEdTab('t-office');
    }
  );
}
function _officeAddSub(path) {
  var parent = _officeGetByPath(path);
  if (!parent) return;
  openGenericModal('新建子部门',
    '<div class="form-group"><label>子部门名称</label><input id="gmf-name" placeholder="如：中书房、门下省"></div>'+
    '<div class="form-group"><label>部门职能</label><textarea id="gmf-desc" placeholder="该子部门的职能..." style="min-height:60px"></textarea></div>',
    function() {
      if (!parent.subs) parent.subs = [];
      parent.subs.push({ name: gv('gmf-name') || '新子部门', desc: document.getElementById('gmf-desc').value || '', positions: [], subs: [] });
      renderEdTab('t-office');
    }
  );
}
function _officeDelDept(path) {
  var arr = _officeGetParentArr(path);
  if (!arr) return;
  arr.splice(path[path.length-1], 1);
  renderEdTab('t-office');
}
function _officeAddFn(path) {
  var dept = _officeGetByPath(path);
  if (!dept) return;
  openGenericModal('添加职能',
    '<div class="form-group"><label>职能描述</label><input id="gmf-fn" placeholder="如：考核官员绩效"></div>',
    function() {
      var fn = gv('gmf-fn').trim();
      if (!fn) return;
      if (!dept.functions) dept.functions = [];
      dept.functions.push(fn);
      renderEdTab('t-office');
    }
  );
}
function _officeFnDel(path, fi) {
  var dept = _officeGetByPath(path);
  if (!dept || !dept.functions) return;
  dept.functions.splice(fi, 1);
  renderEdTab('t-office');
}
function _officeAddPos(path) {
  var dept = _officeGetByPath(path);
  if (!dept) return;
  openGenericModal('新建官职',
    '<div class="form-group"><label>官职名</label><input id="gmf-name" placeholder="如：尚书、中书令"></div>'+
    '<div class="form-group"><label>任职者</label><input id="gmf-holder" placeholder="姓名（可留空）"></div>'+
    '<div class="form-group"><label>品级</label><input id="gmf-rank" placeholder="如：正一品、从三品"></div>'+
    '<div class="form-group"><label>职能描述</label><textarea id="gmf-desc" placeholder="该官职负责的具体职能..."></textarea></div>',
    function() {
      if (!dept.positions) dept.positions = [];
      dept.positions.push({ name: gv('gmf-name') || '新官职', holder: gv('gmf-holder'), rank: gv('gmf-rank'), desc: document.getElementById('gmf-desc').value || '' });
      renderEdTab('t-office');
    }
  );
}
function _officeEditPos(path, pi) {
  var dept = _officeGetByPath(path);
  if (!dept || !dept.positions[pi]) return;
  var p = dept.positions[pi];
  openGenericModal('编辑官职',
    '<div class="form-group"><label>官职名</label><input id="gmf-name" value="' + (p.name||'') + '"></div>'+
    '<div class="form-group"><label>任职者</label><input id="gmf-holder" value="' + (p.holder||'') + '"></div>'+
    '<div class="form-group"><label>品级</label><input id="gmf-rank" value="' + (p.rank||'') + '"></div>'+
    '<div class="form-group"><label>职能描述</label><textarea id="gmf-desc">' + (p.desc||'') + '</textarea></div>',
    function() {
      p.name = gv('gmf-name') || p.name;
      p.holder = gv('gmf-holder');
      p.rank = gv('gmf-rank');
      p.desc = document.getElementById('gmf-desc').value;
      renderEdTab('t-office');
    }
  );
}
function _officeDelPos(path, pi) {
  var dept = _officeGetByPath(path);
  if (!dept || !dept.positions) return;
  dept.positions.splice(pi, 1);
  renderEdTab('t-office');
}
function _addOfficeDept() { _officeAddTopDept(); }
function _addOfficePos(di) { _officeAddPos([di]); }

// AI生成官制——三阶段：A完整骨架 B关键角色 C可选补充
function aiGenOfficeEd() {
  var _scnBg = '';
  // 尝试从剧本中获取朝代背景
  if (typeof editingScenarioId !== 'undefined') {
    var _sc = (typeof findScenarioById === 'function') ? findScenarioById(editingScenarioId) : null;
    if (_sc) _scnBg = (_sc.era||'') + ' ' + (_sc.dynasty||'') + ' ' + (_sc.name||'');
  }
  openGenericModal('\uD83E\uDD16 AI\u751F\u6210\u5B98\u5236\uFF08\u5B8C\u6574\u7248\uFF09',
    '<div class="form-group"><label>\u671D\u4EE3 / \u5386\u53F2\u80CC\u666F\u65F6\u671F</label>'
    +'<input id="gmf-dynasty" placeholder="\u5982\uFF1A\u5510\u671D\u5F00\u5143\u5E74\u95F4\u3001\u660E\u671D\u5D07\u797A\u5341\u4E03\u5E74" value="' + escHtml(_scnBg) + '"></div>'
    +'<div class="form-group"><label>\u751F\u6210\u8303\u56F4</label>'
    +'<select id="gmf-scope"><option value="full">\u5B8C\u6574\u5B98\u5236\uFF08\u6240\u6709\u90E8\u95E8+\u5173\u952E\u89D2\u8272\uFF09</option><option value="skeleton">\u4EC5\u9AA8\u67B6\uFF08\u4E0D\u751F\u6210\u89D2\u8272\uFF09</option></select></div>'
    +'<div style="font-size:0.75rem;color:var(--txt-d);margin-top:0.3rem;">AI\u5C06\u67E5\u8BE2\u8BE5\u671D\u4EE3\u804C\u5B98\u5FD7/\u767E\u5B98\u5FD7\uFF0C\u5B8C\u6574\u751F\u6210\u6240\u6709\u90E8\u95E8\u548C\u5B98\u804C\u3002\u53EF\u80FD\u9700\u8981\u591A\u6B21API\u8C03\u7528\u3002</div>',
    async function() {
      var dynasty = gv('gmf-dynasty');
      if (!dynasty) { toast('\u8BF7\u586B\u5199\u671D\u4EE3'); return; }
      var scope = gv('gmf-scope') || 'full';
      closeGenericModal();
      try {
        // ── 阶段A：完整官制骨架 ──
        showLoading('\u9636\u6BB5A\uFF1A\u751F\u6210\u5B8C\u6574\u5B98\u5236\u9AA8\u67B6...', 10);
        if (!P.officeTree) P.officeTree = [];
        var _maxRounds = 5, _round = 0;
        while (_round < _maxRounds) {
          _round++;
          var existDepts = P.officeTree.map(function(d) { return d.name; });
          var _existNote = existDepts.length > 0 ? '\n已有部门（不要重复）：' + existDepts.join('、') + '\n请补充剩余未生成的部门。' : '';
          var promptA = '你是中国历史官制专家。请为' + dynasty + '生成【完整】官制组织结构。\n'
            + '严格参照该朝代的《职官志》《百官志》或相关史料记载。\n'
            + '要求：\n'
            + '1. 生成该朝代的【所有】中央官署部门——不是5-8个，而是按史载的全部部门（如唐代三省六部九寺五监等）\n'
            + '2. 每个部门包含所有子部门（如尚书省下六部，每部下四司等）\n'
            + '3. 每个官职必须包含headCount（该官职按制度额定几人）\n'
            + '4. positions中holder留空，不填任何人名\n'
            + '5. 每个职位的rank必须是真实品级（正一品至从九品）\n'
            + _existNote
            + '\n仅返回JSON数组，格式：\n'
            + '[{"name":"部门名","desc":"简介","functions":["职能"],"positions":[{"name":"官名","rank":"品级","holder":"","headCount":2,"desc":"职责"}],"subs":[递归子部门]}]';
          var c = await callAISmart(promptA, 8000, {
            minLength: 500, maxRetries: 2,
            validator: function(ct) {
              try { var jm = ct.match(/\[[\s\S]*\]/); if (!jm) return false; var arr = JSON.parse(jm[0]); return Array.isArray(arr) && arr.length >= 1; } catch(e) { return false; }
            }
          });
          var cleaned = c.replace(/```json|```/g,'').trim();
          var jm = cleaned.match(/\[[\s\S]*?\](?=\s*$)/) || cleaned.match(/\[[\s\S]*\]/);
          if (jm) {
            var newDepts;
            try { newDepts = JSON.parse(jm[0]); } catch(pe) { newDepts = JSON.parse(jm[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}')); }
            // 合并——不覆盖已有部门
            newDepts.forEach(function(nd) {
              var existing = P.officeTree.find(function(d) { return d.name === nd.name; });
              if (!existing) P.officeTree.push(nd);
              else {
                // 合并子部门和职位
                if (nd.subs) nd.subs.forEach(function(ns) {
                  if (!existing.subs) existing.subs = [];
                  if (!existing.subs.find(function(s){ return s.name === ns.name; })) existing.subs.push(ns);
                });
                if (nd.positions) nd.positions.forEach(function(np) {
                  if (!existing.positions) existing.positions = [];
                  if (!existing.positions.find(function(p){ return p.name === np.name; })) existing.positions.push(np);
                });
              }
            });
            showLoading('\u9636\u6BB5A\uFF1A\u7B2C' + _round + '\u6B21\u8C03\u7528\u5B8C\u6210\uFF0C\u5DF2\u6709' + P.officeTree.length + '\u4E2A\u90E8\u95E8', 10 + _round * 15);
          }
          // 检查完整性——唐代至少应有~15个顶级机构，宋/明/清类似
          if (P.officeTree.length >= 8) break; // 基本够了
        }
        // 迁移新数据到双层模型
        if (typeof _offMigrateTree === 'function') _offMigrateTree(P.officeTree);

        if (scope === 'skeleton') {
          renderEdTab('t-office');
          hideLoading(); toast('\u2705 \u5B98\u5236\u9AA8\u67B6\u5DF2\u751F\u6210\uFF08' + P.officeTree.length + '\u4E2A\u90E8\u95E8\uFF09');
          return;
        }

        // ── 阶段B：生成关键角色 ──
        showLoading('\u9636\u6BB5B\uFF1A\u751F\u6210\u5173\u952E\u5B98\u5458...', 60);
        // 收集所有主要官职（从三品以上）
        var keyPositions = [];
        (function _kp(nodes, dName) {
          nodes.forEach(function(n) {
            (n.positions||[]).forEach(function(p) {
              var rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
              if (rl <= 6) keyPositions.push({ dept: dName || n.name, pos: p.name, rank: p.rank, posRef: p });
            });
            if (n.subs) _kp(n.subs, n.name);
          });
        })(P.officeTree);

        if (keyPositions.length > 0) {
          var _existChars = (P.characters||[]).map(function(c) { return c.name; });
          var promptB = '你是中国历史专家。当前剧本背景：' + dynasty + '。\n'
            + '以下是该朝代的关键官职（从三品以上），请为每个职位推荐任职者。\n'
            + '【优先使用真实历史人物】——查找该时期的真实官员记载。实在找不到历史记载才用虚构人物。\n'
            + '某些职位在该时期可能确实空缺——如实标注vacant:true。\n'
            + ((_existChars.length > 0) ? '已有角色（不要重复）：' + _existChars.join('、') + '\n' : '')
            + '职位列表：\n'
            + keyPositions.map(function(k, i) { return (i+1) + '. ' + k.dept + ' · ' + k.pos + '（' + k.rank + '）'; }).join('\n')
            + '\n\n返回JSON数组：[{"dept":"部门","pos":"官职","holder":"人名（空缺则空）","vacant":false,"historical":true,"personality":"性格简述","intelligence":65,"administration":70,"loyalty":60,"ambition":50}]';
          var c2 = await callAISmart(promptB, 6000, {
            minLength: 200, maxRetries: 2,
            validator: function(ct) { try { var jm = ct.match(/\[[\s\S]*\]/); return jm && JSON.parse(jm[0]).length >= 1; } catch(e) { return false; } }
          });
          var cleaned2 = c2.replace(/```json|```/g,'').trim();
          var jm2 = cleaned2.match(/\[[\s\S]*?\](?=\s*$)/) || cleaned2.match(/\[[\s\S]*\]/);
          if (jm2) {
            var appointments;
            try { appointments = JSON.parse(jm2[0]); } catch(pe2) { appointments = JSON.parse(jm2[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}')); }
            var _assigned = 0;
            appointments.forEach(function(a) {
              if (!a.holder || a.vacant) return;
              // 在officeTree中找到对应职位并填入holder
              (function _fill(nodes) {
                nodes.forEach(function(n) {
                  (n.positions||[]).forEach(function(p) {
                    if (p.name === a.pos && !p.holder && (n.name === a.dept || !a.dept)) {
                      p.holder = a.holder;
                      p.actualCount = Math.max(p.actualCount||0, 1);
                      _assigned++;
                    }
                  });
                  if (n.subs) _fill(n.subs);
                });
              })(P.officeTree);
              // 创建角色（如果不存在）
              if (!P.characters) P.characters = [];
              if (!P.characters.find(function(ch) { return ch.name === a.holder; })) {
                P.characters.push({
                  name: a.holder, title: a.pos, role: a.dept + a.pos,
                  personality: a.personality || '', intelligence: a.intelligence || 60,
                  administration: a.administration || 60, military: a.military || 40,
                  loyalty: a.loyalty || 60, ambition: a.ambition || 50,
                  officialTitle: a.pos, alive: true
                });
              }
            });
            showLoading('\u9636\u6BB5B\u5B8C\u6210\uFF0C\u4EFB\u547D' + _assigned + '\u4F4D\u5173\u952E\u5B98\u5458', 90);
          }
        }

        renderEdTab('t-office');
        hideLoading();
        var _ts = typeof _offTreeStats === 'function' ? _offTreeStats(P.officeTree) : {};
        toast('\u2705 \u5B98\u5236\u5DF2\u5B8C\u6574\u751F\u6210\uFF1A' + (_ts.depts||'?') + '\u4E2A\u90E8\u95E8\uFF0C' + (_ts.headCount||'?') + '\u4E2A\u7F16\u5236\uFF0C' + (_ts.materialized||'?') + '\u540D\u5177\u8C61\u89D2\u8272');
      } catch(e) { hideLoading(); toast('\u5931\u8D25: ' + (e.message||e)); console.error(e); }
    }
  );
}

/** 编辑器：为某部门AI补充生成角色（阶段C） */
function aiGenOfficeStaff(deptPath) {
  var dept = _officeGetByPath(deptPath);
  if (!dept) { toast('找不到部门'); return; }
  var _scnBg = '';
  if (typeof editingScenarioId !== 'undefined') {
    var _sc = (typeof findScenarioById === 'function') ? findScenarioById(editingScenarioId) : null;
    if (_sc) _scnBg = (_sc.era||'') + ' ' + (_sc.dynasty||'');
  }
  var _unfilled = (dept.positions||[]).filter(function(p) {
    var m = (p.holder ? 1 : 0) + (p.additionalHolders ? p.additionalHolders.length : 0);
    return (p.actualCount||0) > m; // 有未具象的在任者
  });
  if (_unfilled.length === 0) { toast('该部门所有在任者已具象'); return; }
  (async function() {
    try {
      showLoading('为' + dept.name + '补充人员...', 30);
      var _existChars = (P.characters||[]).map(function(c) { return c.name; });
      var prompt = '背景：' + (_scnBg || '中国古代') + '。\n'
        + '为' + dept.name + '的以下官职生成任职者角色。\n'
        + '优先使用真实历史人物，找不到再虚构。\n'
        + (_existChars.length > 0 ? '已有角色：' + _existChars.slice(0,20).join('、') + '\n' : '')
        + _unfilled.map(function(p, i) {
          var need = (p.actualCount||0) - ((p.holder?1:0) + (p.additionalHolders||[]).length);
          return (i+1) + '. ' + p.name + '（' + (p.rank||'') + '），需补' + need + '人';
        }).join('\n')
        + '\n返回JSON：[{"pos":"官职名","name":"人名","personality":"性格","intelligence":60,"administration":60,"loyalty":60}]';
      var c = await callAISmart(prompt, 4000, { minLength: 100, maxRetries: 2 });
      var jm = (c.replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/) || ['[]'])[0];
      var chars = JSON.parse(jm.replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}'));
      var added = 0;
      chars.forEach(function(ch) {
        if (!ch.name || !ch.pos) return;
        var p = (dept.positions||[]).find(function(pp) { return pp.name === ch.pos; });
        if (!p) return;
        if (!p.additionalHolders) p.additionalHolders = [];
        p.additionalHolders.push(ch.name);
        if (!P.characters) P.characters = [];
        if (!P.characters.find(function(c2) { return c2.name === ch.name; })) {
          P.characters.push({ name: ch.name, title: ch.pos, role: dept.name + ch.pos, personality: ch.personality||'', intelligence: ch.intelligence||55, administration: ch.administration||55, loyalty: ch.loyalty||55, ambition: ch.ambition||45, officialTitle: ch.pos, alive: true });
        }
        added++;
      });
      hideLoading();
      renderEdTab('t-office');
      toast('已补充' + added + '名角色');
    } catch(e) { hideLoading(); toast('失败: ' + (e.message||e)); }
  })();
}

// ============================================================
//  脚本加载完成标记
// ============================================================
_dbg('天命游戏脚本加载完成！');
_dbg('关键函数检查:');
_dbg('- doNewGame:', typeof doNewGame);
_dbg('- doLoadSave:', typeof doLoadSave);
_dbg('- doEditor:', typeof doEditor);
_dbg('- openSettings:', typeof openSettings);
_dbg('- _$:', typeof _$);

// 定义按钮绑定函数
function bindMainMenuButtons() {
  _dbg('========================================');
  _dbg('[bindMainMenuButtons] 开始绑定主菜单按钮事件...');
  _dbg('[bindMainMenuButtons] document.readyState:', document.readyState);

  var btnNewGame = document.getElementById('btn-new-game');
  var btnLoadSave = document.getElementById('btn-load-save');
  var btnEditor = document.getElementById('btn-editor');
  var btnSettings = document.getElementById('btn-settings');

  _dbg('[bindMainMenuButtons] 按钮查找结果:');
  _dbg('  btn-new-game:', btnNewGame ? '找到' : '未找到');
  _dbg('  btn-load-save:', btnLoadSave ? '找到' : '未找到');
  _dbg('  btn-editor:', btnEditor ? '找到' : '未找到');
  _dbg('  btn-settings:', btnSettings ? '找到' : '未找到');

  if (btnNewGame) {
    btnNewGame.onclick = function() {
      _dbg('[按钮点击] btn-new-game 被点击');
      doNewGame();
    };
    _dbg('  ✓ 绑定 btn-new-game 成功');
  } else {
    console.error('  ✗ btn-new-game 不存在');
  }

  if (btnLoadSave) {
    btnLoadSave.onclick = function() {
      _dbg('[按钮点击] btn-load-save 被点击');
      doLoadSave();
    };
    _dbg('  ✓ 绑定 btn-load-save 成功');
  } else {
    console.error('  ✗ btn-load-save 不存在');
  }

  if (btnEditor) {
    btnEditor.onclick = function() {
      _dbg('[按钮点击] btn-editor 被点击');
      doEditor();
    };
    _dbg('  ✓ 绑定 btn-editor 成功');
  } else {
    console.error('  ✗ btn-editor 不存在');
  }

  if (btnSettings) {
    btnSettings.onclick = function() {
      _dbg('[按钮点击] btn-settings 被点击');
      openSettings();
    };
    _dbg('  ✓ 绑定 btn-settings 成功');
  } else {
    console.error('  ✗ btn-settings 不存在');
  }

  _dbg('[bindMainMenuButtons] 主菜单按钮事件绑定完成！');
  _dbg('========================================');
}

// 绑定主菜单按钮事件 - 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindMainMenuButtons);
} else {
  // DOM 已经加载完成，立即绑定
  bindMainMenuButtons();
}

// ============================================================
//  科举制度系统
// ============================================================

/**
 * 初始化科举制度（游戏开始时调用）
 * 由 AI 根据朝代判断是否启用科举
 */
