// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-electron.js — Electron 桌面端存档支持 (R126 从 tm-chaoyi-misc.js L174-776 拆出)
//
// 独立领域·仅桌面 Electron 环境激活·浏览器/GitHub Pages 下整个 IIFE 不跑
// 入口: window.tianming && window.tianming.isDesktop
// 包含: showMain/主菜单显示隐藏·桌面端 doSave/doLoad/Electron 文件对话框集成
//       doSaveGameDesktop/doLoadDesktop/saveToPath/loadFromPath 等
// ============================================================

// ============================================================
//  Electron桌面端存档支持
// ============================================================
if(window.tianming&&window.tianming.isDesktop){

  // --- 主菜单显示/隐藏辅助 ---
  // launch 改版后 #lt-menu → .home-stage 整个 hero 区(menu + title + 楹联等)·main-view 是其后兄弟
  // 旧版直接 toggle lt-menu·新版必须 toggle 整个 home-stage·不然 main-view 被 home-stage(100vh) 推到屏外
  function _getLaunchHero(){
    return document.getElementById('lt-menu')          // 旧版兼容
        || document.querySelector('.home-stage')       // 新版 launch hero
        || document.querySelector('.home-menu');       // 兜底
  }
  function showMain(){
    var hero = _getLaunchHero(); if (hero) hero.style.display='';
    var mv = document.getElementById('main-view');
    if (mv) { mv.style.display='none'; mv.innerHTML=''; }
  }
  function showPanel(html){
    var hero = _getLaunchHero(); if (hero) hero.style.display='none';
    var mv = document.getElementById('main-view');
    if (mv) { mv.style.display='block'; mv.innerHTML=html; }
    var lc = document.getElementById('launch'); if (lc) lc.style.display='flex';
  }

  // --- 剧本管理页（桌面端）---
  showScnManage=async function(){
    var list=await window.tianming.listScenarios();
    var files=list.success?list.files:[];
    var html='<div class="pnl">';
    html+='<div class="pnl-hd"><span class="pnl-t">剧本管理</span></div>';
    if(!files.length){
      html+='<p class="pnl-empty">暂无剧本，请先新建。</p>';
    }else{
      html+='<div class="pnl-list">';
      files.forEach(function(f){
        html+='<div class="pnl-row cd">';
        html+='<div class="pnl-row-info"><span class="pnl-row-name">'+f.name+'</span><span class="pnl-row-meta">'+f.modifiedStr+'</span></div>';
        html+='<div class="rw" style="gap:0.4rem">';
        html+='<button class="bt bs bsm" onclick="desktopEnterScn('+JSON.stringify(f.name).replace(/"/g,'&quot;')+')">编辑</button>';
        html+='<button class="bt bd bsm" onclick="desktopDeleteScn('+JSON.stringify(f.name).replace(/"/g,'&quot;')+')">删除</button>';
        html+='</div></div>';
      });
      html+='</div>';
    }
    html+='<div class="rw pnl-ft">';
    html+='<button class="bt bp" onclick="createNewScn()">＋ 新建剧本</button>';
    html+='<button class="bt bs" onclick="showMain()">返回</button>';
    html+='</div></div>';
    showPanel(html);
  };

  window.desktopEnterScn=async function(name){
    try{
    // 优先从 IndexedDB 读取最新编辑数据（可能比磁盘更新）
    var _idbRecord = null;
    if (typeof TM_SaveDB !== 'undefined') {
      try { _idbRecord = await TM_SaveDB.load('current_script'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
    }
    var scn = null;
    if (_idbRecord && _idbRecord.gameState && _idbRecord.gameState.name === name) {
      // IndexedDB 中有匹配的最新数据
      scn = _idbRecord.gameState;
      console.log('[desktopEnterScn] 从IndexedDB加载最新编辑数据:', name);
    } else {
      // 从磁盘加载
      var r = await window.tianming.loadScenario(name);
      if(!r.success){toast('加载失败: '+(r.error||''));return;}
      scn = r.data;
      console.log('[desktopEnterScn] 从磁盘加载:', name);
    }
    // 生成稳定ID：如果文件中没有id，用文件名生成确定性id（避免每次生成不同id导致重复）
    if(!scn.id){scn.id='scn_file_'+name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g,'_');}
    // 兼容editor格式字段 → game格式字段
    if(!scn.era && scn.dynasty) scn.era = scn.dynasty;
    if(!scn.role && scn.emperor) scn.role = scn.emperor;
    if(!scn.background && scn.overview) scn.background = scn.overview;
    if(!scn.desc && scn.overview) scn.desc = scn.overview;
    var existing=P.scenarios.findIndex(function(s){return s.id===scn.id;});
    if(existing>=0){P.scenarios[existing]=scn;}else{P.scenarios.push(scn);}
    // 展开 characters/factions/parties 等到 P 顶层（供 doActualStart 等使用）
    ['characters','factions','parties','classes','items','relations'].forEach(function(key){
      if(scn[key]&&scn[key].length>0){
        P[key]=(P[key]||[]).filter(function(it){return it.sid!==scn.id;});
        scn[key].forEach(function(it){it.sid=scn.id;});
        P[key]=P[key].concat(scn[key]);
      }
    });
    // 重建索引以确保新剧本可以被找到
    if (typeof buildIndices === 'function') buildIndices();
    P._activeScnName=name;
    GM.sid=scn.id;
    openEditorHtml(scn.id);
    }catch(e){console.error('[desktopEnterScn] 错误:',e);toast('打开失败: '+e.message);}
  };

  window.desktopDeleteScn=async function(name){
    if(!confirm('确认删除剧本「'+name+'」？')){return;}
    var r=await window.tianming.deleteScenario(name);
    if(r.success){toast('已删除');showScnManage();}
    else toast('删除失败: '+(r.error||''));
  };

  // --- 剧本选择页（桌面端）---
  showScnSelect=async function(){
    var list=await window.tianming.listScenarios();
    var files=list.success?list.files:[];
    var html='<div class="pnl">';
    html+='<div class="pnl-hd"><span class="pnl-t">选择剧本</span></div>';
    if(!files.length){
      html+='<p class="pnl-empty">暂无剧本。</p>';
    }else{
      html+='<div class="pnl-list">';
      files.forEach(function(f){
        html+='<div class="pnl-row cd">';
        html+='<div class="pnl-row-info"><span class="pnl-row-name">'+f.name+'</span><span class="pnl-row-meta">'+f.modifiedStr+'</span></div>';
        html+='<button class="bt bp bsm" onclick="desktopStartScn('+JSON.stringify(f.name).replace(/"/g,'&quot;')+')">开始</button>';
        html+='</div>';
      });
      html+='</div>';
    }
    html+='<div class="rw pnl-ft">';
    html+='<button class="bt bs" onclick="showMain()">返回</button>';
    html+='</div></div>';
    showPanel(html);
  };

  window.desktopStartScn=async function(name){
    var r=await window.tianming.loadScenario(name);
    if(!r.success){toast('加载失败: '+(r.error||''));return;}
    var scn=r.data;
    // 生成稳定ID：用文件名生成确定性id（避免重复）
    if(!scn.id){scn.id='scn_file_'+name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g,'_');}
    // 兼容editor格式字段 → game格式字段
    if(!scn.era && scn.dynasty) scn.era = scn.dynasty;
    if(!scn.role && scn.emperor) scn.role = scn.emperor;
    if(!scn.background && scn.overview) scn.background = scn.overview;
    if(!scn.desc && scn.overview) scn.desc = scn.overview;
    // 预先添加到 P.scenarios 并建立索引
    var existing=P.scenarios.findIndex(function(s){return s.id===scn.id;});
    if(existing>=0){P.scenarios[existing]=scn;}else{P.scenarios.push(scn);}
    // 展开数组数据到 P 顶层（供 doActualStart 使用）
    ['characters','factions','parties','classes','items','relations'].forEach(function(key){
      if(scn[key]&&scn[key].length>0){
        P[key]=(P[key]||[]).filter(function(it){return it.sid!==scn.id;});
        scn[key].forEach(function(it){it.sid=scn.id;});
        P[key]=P[key].concat(scn[key]);
      }
    });
    if (typeof buildIndices === 'function') buildIndices();
    var now=new Date();
    var pad=function(n){return String(n).padStart(2,'0');};
    var defName=(scn.name||name)+'_'+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes());
    window._pendingStartPayload={scn:scn,origName:name};
    var html='<div class="pnl">';
    html+='<div class="pnl-hd"><div><div class="pnl-t">\u5f00\u59cb\u6e38\u620f</div>';
    html+='<div class="pnl-sub">\u5267\u672c\uff1a'+(scn.name||name)+'</div></div></div>';
    html+='<div class="fd full" style="margin-bottom:1.2rem">';
    html+='<label>\u5b58\u6863\u540d\uff08\u53ef\u4fee\u6539\uff09</label>';
    html+='<input id="start-save-name" value="'+defName+'"></div>';
    html+='<div class="pnl-ft">';
    html+='<button class="bt bp" onclick="desktopConfirmStart()">\u25b6 \u5f00\u59cb</button>';
    html+='<button class="bt bs" onclick="showScnSelect()">\u8fd4\u56de</button>';
    html+='</div></div>';
    showPanel(html);
  };
  window.desktopConfirmStart=function(){
    var payload=window._pendingStartPayload;
    var scn=payload.scn;
    var saveName=(_$('start-save-name').value||'').trim();
    if(!saveName){toast('请输入存档名');return;}
    window._pendingStartPayload.saveName=saveName;
    // Show mode selection panel
    var html='<div class="pnl">';
    html+='<div class="pnl-hd"><div><div class="pnl-t">选择游戏模式</div>';
    html+='<div class="pnl-sub">存档：'+saveName+'</div></div></div>';
    html+='<div style="padding:0.5rem 0 1rem">';
    html+='<div class="mode-opt" id="mo-yanyi" onclick="_pendingSelectMode(this,\'yanyi\')" style="border:2px solid var(--gold);border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.6rem;cursor:pointer;background:rgba(200,160,60,0.12)">';
    html+='<div style="color:var(--gold);font-weight:700;font-size:1rem">演义模式</div>';
    html+='<div style="color:var(--txt-d);font-size:0.82rem;margin-top:0.25rem">小说化演绎，AI可自由发挥，情节更富戏剧性</div>';
    html+='<div style="color:var(--txt-d);font-size:0.75rem;margin-top:0.25rem">• 历史名臣：中国古代全部历史名臣都有概率出现</div></div>';
    html+='<div class="mode-opt" id="mo-light" onclick="_pendingSelectMode(this,\'light_hist\')" style="border:2px solid var(--bdr);border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.6rem;cursor:pointer">';
    html+='<div style="color:var(--txt-s);font-weight:700;font-size:1rem">轻度史实</div>';
    html+='<div style="color:var(--txt-d);font-size:0.82rem;margin-top:0.25rem">大事件遵历史，细节可演绎，平衡历史与趣味</div>';
    html+='<div style="color:var(--txt-d);font-size:0.75rem;margin-top:0.25rem">• 历史名臣：仅出现剧本开始年份前后200年内的历史名臣</div>';
    html+='<div style="color:var(--txt-d);font-size:0.75rem;margin-top:0.25rem">• 每回合推演后进行历史检查，校正明显史实错误</div></div>';
    html+='<div class="mode-opt" id="mo-strict" onclick="_pendingSelectMode(this,\'strict_hist\')" style="border:2px solid var(--bdr);border-radius:8px;padding:0.75rem 1rem;cursor:pointer">';
    html+='<div style="color:var(--txt-s);font-weight:700;font-size:1rem">严格史实</div>';
    html+='<div style="color:var(--txt-d);font-size:0.82rem;margin-top:0.25rem">严格遵守史实，不得改变历史走向</div>';
    html+='<div style="color:var(--txt-d);font-size:0.75rem;margin-top:0.25rem">• 历史名臣：仅出现剧本开始年份前后100年内的历史名臣</div>';
    html+='<div style="color:var(--txt-d);font-size:0.75rem;margin-top:0.25rem">• 每回合推演前检索参考数据库，强制遵循史实</div></div>';
    html+='<div id="strict-mode-options" style="display:none;margin-top:1rem;padding:1rem;background:rgba(0,0,0,0.2);border-radius:8px">';
    html+='<div style="color:var(--txt-s);font-weight:600;margin-bottom:0.5rem">📚 参考数据库（可选）</div>';
    html+='<div style="color:var(--txt-d);font-size:0.82rem;margin-bottom:0.5rem">提供史料文本作为AI推演的参考依据</div>';
    html+='<textarea id="strict-ref-text" placeholder="粘贴或输入参考史料文本..." style="width:100%;height:120px;padding:0.5rem;background:#1a1a1a;border:1px solid var(--bdr);color:var(--txt-s);border-radius:4px;font-size:0.85rem;resize:vertical"></textarea>';
    html+='<div style="margin-top:0.5rem;font-size:0.75rem;color:var(--txt-d)">💡 提示：可输入正史记载、大事年表等，AI将严格参照此内容推演</div>';
    html+='</div>';
    html+='</div>';
    html+='<div class="pnl-ft">';
    html+='<button class="bt bp" id="start-mode-btn" onclick="desktopDoStart()">▶ 开始</button>';
    html+='<button class="bt bs" onclick="desktopStartScn(window._pendingStartPayload.origName)">返回</button>';
    html+='</div></div>';
    window._pendingStartMode='yanyi';
    window._pendingRefText='';
    showPanel(html);
  };
  window._pendingSelectMode=function(el,mode){
    window._pendingStartMode=mode;
    ['mo-yanyi','mo-light','mo-strict'].forEach(function(id){var d=_$(id);if(d){d.style.borderColor='var(--bdr)';d.style.background='';}});
    el.style.borderColor='var(--gold)';el.style.background='rgba(200,160,60,0.12)';
    // 显示或隐藏严格史实模式的数据库选项
    var strictOptions=_$('strict-mode-options');
    if(strictOptions){
      strictOptions.style.display=(mode==='strict_hist')?'block':'none';
    }
  };
  window.desktopDoStart=function(){
    var payload=window._pendingStartPayload;
    var scn=payload.scn;
    var saveName=payload.saveName;
    _dbg('[desktopDoStart] payload:', payload);
    _dbg('[desktopDoStart] scn:', scn);
    _dbg('[desktopDoStart] scn.id:', scn ? scn.id : 'undefined');
    if(!saveName){toast('请输入存档名');return;}
    GM.saveName=saveName;
    if(!P.conf)P.conf={};
    P.conf.gameMode=window._pendingStartMode||'yanyi';
    _dbg('[desktopDoStart] gameMode:', P.conf.gameMode);
    // 保存严格史实模式的参考文本
    if(P.conf.gameMode==='strict_hist'){
      var refTextEl=_$('strict-ref-text');
      P.conf.refText=refTextEl?refTextEl.value.trim():'';
    }else{
      P.conf.refText='';
    }
    var existing=P.scenarios.findIndex(function(s){return s.id===scn.id;});
    _dbg('[desktopDoStart] existing index:', existing);
    if(existing>=0){P.scenarios[existing]=scn;}else{P.scenarios.push(scn);}
    _dbg('[desktopDoStart] P.scenarios 长度:', P.scenarios.length);
    // 重建索引以确保新剧本可以被找到
    if (typeof buildIndices === 'function') buildIndices();
    _dbg('[desktopDoStart] 索引已建立，scn.id:', scn.id);
    _dbg('[desktopDoStart] 索引内容:', P._indices.scenarioById);
    GM.sid=scn.id;
    _dbg('[desktopDoStart] 准备调用 startGame，sid:', scn.id);

    // 关闭面板
    var panel=document.querySelector('.pnl');
    if(panel&&panel.parentElement){panel.parentElement.remove();}

    startGame(scn.id);
  };

  // --- 保存并返回（桌面端）---
  saveAndBack=async function(){
    var scn=findScenarioById(GM.sid);
    if(!scn){toast('无当前剧本');return;}
    var fname=P._activeScnName||(scn.name||scn.id);
    var r=await window.tianming.saveScenario(fname,scn);
    if(r.success){P._activeScnName=fname;toast('\u2705 剧本已保存');enterGame();}
    else toast('保存失败: '+(r.error||''));
  };

  // --- 新建剧本确认（桌面端）---
  confirmNewScn=async function(){
    var nameEl=document.getElementById('new-scn-name');
    var name=nameEl?nameEl.value.trim():'';
    if(!name){toast('请输入剧本名');return;}
    var id='scn_'+Date.now();
    var scn={id:id,name:name,desc:'',factions:[],characters:[],events:[],rules:{},map:{}};
    P.scenarios.push(scn);
    P._activeScnName=name;
    GM.sid=id;
    var r=await window.tianming.saveScenario(name,scn);
    if(!r.success){toast('保存失败: '+(r.error||''));return;}
    openEditorHtml(id);
  };

  doSaveGame=async function(){
    if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB");return;}
    var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    var defName=GM.saveName||('T'+GM.turn);
    var html='<div class="pnl">';
    html+='<div class="pnl-hd"><div class="pnl-t">\u4fdd\u5b58\u6e38\u620f</div></div>';
    html+='<div class="fd full" style="margin-bottom:1rem">';
    html+='<label>\u5b58\u6863\u540d</label>';
    html+='<input id="save-name-inp" value="'+defName+'"></div>';
    html+='<button class="bt bp" style="margin-bottom:1.4rem" onclick="desktopDoSave()">\u2714 \u4fdd\u5b58</button>';
    if(files.length){
      html+='<div class="pnl-section">\u8986\u76d6\u73b0\u6709\u5b58\u6863</div>';
      html+='<div class="pnl-list" style="max-height:200px">';
      files.forEach(function(f){
        html+='<div class="pnl-row">';
        html+='<div class="pnl-row-info"><div class="pnl-row-name">'+f.name+'</div>';
        html+='<div class="pnl-row-meta">'+f.modifiedStr+'</div></div>';
        html+='<button class="bt bp bsm" onclick="_$(\u0027save-name-inp\u0027).value='+JSON.stringify(f.name).replace(/"/g,'&quot;')+';desktopDoSave()">\u8986\u76d6</button>';
        html+='</div>';
      });
      html+='</div>';
    }
    html+='<div class="pnl-ft"><button class="bt bs" onclick="enterGame()">\u53d6\u6d88</button></div>';
    html+='</div>';
    showPanel(html);
    _$('G').style.display='none';
  };
  window.desktopDoSave=async function(){
    var name=(_$('save-name-inp').value||'').trim();
    if(!name){toast('\u8bf7\u8f93\u5165\u5b58\u6863\u540d');return;}
    var saveData=deepClone(P);saveData.gameState=deepClone(GM);
    saveData._saveMeta={turn:GM.turn,gameMode:(P.conf&&P.conf.gameMode)||'',saveName:name};
    var r=await window.tianming.saveProject(name,saveData);
    if(r.success){GM.saveName=name;toast('\u2705 \u5df2\u4fdd\u5b58');enterGame();}
    else toast('\u5931\u8d25: '+(r.error||''));
  };

  doLoadSave=async function(){
    var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    var html='<div class="pnl wide">';
    html+='<div class="pnl-hd"><div class="pnl-t">\u8bfb\u53d6\u5b58\u6863</div></div>';
    if(!files.length){
      html+='<div class="pnl-empty">\u65e0\u5b58\u6863\u3002</div>';
    }else{
      html+='<div class="pnl-list">';
      files.forEach(function(f){
        html+='<div class="pnl-row">';
        html+='<div class="pnl-row-info"><div class="pnl-row-name">'+f.name+'</div>';
        html+='<div class="pnl-row-meta">'+f.modifiedStr+' &nbsp;'+Math.round(f.size/1024)+' KB'+(f._saveMeta?(' &nbsp;· T'+f._saveMeta.turn+(f._saveMeta.gameMode?' &nbsp;· '+f._saveMeta.gameMode:'')):'')+'</div></div>';
        html+='<button class="bt bp bsm" onclick="desktopLoadSave('+JSON.stringify(f.name).replace(/"/g,'&quot;')+')">\u8f7d\u5165</button>';
        html+='<button class="bt bd bsm" onclick="desktopDeleteSave('+JSON.stringify(f.name).replace(/"/g,'&quot;')+')">\u5220\u9664</button>';
        html+='</div>';
      });
      html+='</div>';
    }
    html+='<div class="pnl-ft"><button class="bt bs" onclick="showMain()">\u8fd4\u56de</button></div>';
    html+='</div>';
    showPanel(html);
  };
  window.desktopLoadSave=async function(name){
    var r=await window.tianming.loadProject(name);
    if(!r.success||!r.data){toast('\u8bfb\u53d6\u5931\u8d25');return;}
    if(r.data.gameState){
      P=r.data;GM=r.data.gameState;GM.running=true;GM.saveName=name;
      _$('launch').style.display='none';_$('bar').style.display='flex';_$('bar-btns').innerHTML='';_$('G').style.display='grid';
      _$('shiji-btn').classList.add('show');_$('save-btn').classList.add('show');
      enterGame();renderGameState();renderOfficeTree();renderBiannian();renderMemorials();renderJishi();
      if(typeof renderShijiList==='function')renderShijiList();
      if(typeof renderQiju==='function')renderQiju();
      toast('\u2705 \u5df2\u52a0\u8f7d');
    }else{
      P=r.data;loadT();toast('\u9879\u76ee\u5df2\u52a0\u8f7d');
      _$('launch').style.display='none';showScnManage();
    }
  };
  window.desktopDeleteSave=async function(name){
    if(!confirm('\u786e\u8ba4\u5220\u9664\u5b58\u6863\u300c'+name+'\u300d\uff1f'))return;
    var r=await window.tianming.deleteSave(name);
    if(r.success){toast('\u5df2\u5220\u9664');doLoadSave();}
    else toast('\u5220\u9664\u5931\u8d25: '+(r.error||''));
  };
}

// 输入框焦点修复（Electron）
document.addEventListener("mousedown",function(e){var t=e.target.tagName;if(t==="INPUT"||t==="TEXTAREA"||t==="SELECT"){setTimeout(function(){e.target.focus();},10);}});

// 地图编辑器（覆盖简版）
renderMapTab=function(em){
  em.innerHTML="<h4 style=\"color:var(--gold);\">\u5730\u56FE\u7F16\u8F91\u5668</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\">"+
    "<button class=\"bt bs bsm\" id=\"map-upload-btn\">\uD83D\uDCC1 \u4E0A\u4F20\u5E95\u56FE</button>"+
    "<input type=\"file\" id=\"map-file-input\" accept=\"image/*\" style=\"display:none;\">"+
    "<button class=\"bt bs bsm\" onclick=\"P.mapData.imageDataUrl=null;drawMapEditor();\">\uD83D\uDDD1 \u6E05\u9664\u5E95\u56FE</button>"+
    "<button class=\"bai bsm\" onclick=\"aiGenMapRegions()\">\uD83E\uDD16 AI\u5EFA\u8BAE\u533A\u57DF</button></div>"+

    "<div style=\"display:grid;grid-template-columns:1fr 260px;gap:0.8rem;\">"+
    "<div style=\"background:var(--bg-2);border:1px solid var(--bdr);border-radius:var(--r);overflow:hidden;\">"+
    "<div style=\"display:flex;gap:0.3rem;padding:0.5rem;background:var(--bg-3);border-bottom:1px solid var(--bdr);flex-wrap:wrap;align-items:center;\">"+
    "<button class=\"bt bs bsm\" id=\"mt-rect\" onclick=\"setMapTool('rect')\" style=\"border-color:var(--gold);\">▭ \u77E9\u5F62</button>"+
    "<button class=\"bt bs bsm\" id=\"mt-poly\" onclick=\"setMapTool('poly')\">\u2B1F \u591A\u8FB9\u5F62</button>"+
    "<button class=\"bt bs bsm\" id=\"mt-point\" onclick=\"setMapTool('point')\">\u25CF \u6807\u8BB0</button>"+
    "<button class=\"bt bs bsm\" id=\"mt-select\" onclick=\"setMapTool('select')\">\u261D \u9009\u62E9</button>"+
    "<button class=\"bd bsm\" onclick=\"if(confirm('\u6E05\u7A7A\u533A\u57DF?')){P.mapData.regions=[];mapSelIdx=-1;mapPolyPts=[];drawMapEditor();renderRegionList();}\">\uD83D\uDDD1</button>"+
    "<span style=\"font-size:0.72rem;color:var(--txt-d);margin-left:auto;\" id=\"map-count\">0 \u533A\u57DF</span></div>"+
    "<canvas id=\"map-canvas\" width=\"800\" height=\"500\" style=\"display:block;cursor:crosshair;width:100%;\"></canvas></div>"+

    "<div>"+
    "<div class=\"cd\" style=\"max-height:280px;overflow-y:auto;\"><h4>\u533A\u57DF\u5217\u8868</h4><div id=\"region-list\"></div></div>"+
    "<div class=\"cd\" id=\"region-detail\" style=\"display:none;\"><h4>\u533A\u57DF\u8BE6\u60C5</h4>"+
    "<div class=\"fd\"><label>\u540D\u79F0</label><input id=\"rg-name\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u5F52\u5C5E</label><input id=\"rg-owner\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u989C\u8272</label><input type=\"color\" id=\"rg-color\" value=\"#c9a84c\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u5730\u5F62</label><select id=\"rg-terrain\" onchange=\"updateRegion()\"><option>\u5E73\u539F</option><option>\u5C71\u5730</option><option>\u4E18\u9675</option><option>\u6CB3\u6D41</option><option>\u68EE\u6797</option><option>\u6C99\u6F20</option><option>\u8349\u539F</option><option>\u6CBF\u6D77</option><option>\u6CBC\u6CFD</option><option>\u57CE\u6C60</option><option>\u5173\u9698</option><option>\u6E2F\u53E3</option></select></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u4EBA\u53E3(\u4E07)</label><input type=\"number\" id=\"rg-pop\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u8D44\u6E90</label><input type=\"number\" id=\"rg-res\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u9632\u5FA1</label><input type=\"number\" id=\"rg-def\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u76F8\u90BB(\u9017\u53F7)</label><input id=\"rg-adj\" onchange=\"updateRegion()\"></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u7279\u6B8A\u6548\u679C</label><textarea id=\"rg-effect\" rows=\"2\" onchange=\"updateRegion()\"></textarea></div>"+
    "<div class=\"fd\" style=\"margin-top:0.3rem;\"><label>\u63CF\u8FF0</label><textarea id=\"rg-desc\" rows=\"2\" onchange=\"updateRegion()\"></textarea></div>"+
    "</div></div></div>";

  // 绑定事件
  setTimeout(function(){bindMapEvents();drawMapEditor();renderRegionList();},100);
};


function setMapTool(tool){
  mapTool=tool;mapPolyPts=[];
  ["mt-rect","mt-poly","mt-point","mt-select"].forEach(function(id){var el=_$(id);if(el)el.style.borderColor=(id==="mt-"+tool)?"var(--gold)":"var(--bdr)";});
}

function bindMapEvents(){
  var uploadBtn=_$("map-upload-btn");
  var fileInput=_$("map-file-input");
  if(uploadBtn&&fileInput){
    uploadBtn.onclick=function(){
      if(window.tianming&&window.tianming.isDesktop){
        window.tianming.dialogLoadImage().then(function(r){if(r.success){P.mapData.imageDataUrl=r.dataUrl;drawMapEditor();}});
      }else{fileInput.click();}
    };
    fileInput.onchange=function(e){
      var f=e.target.files[0];if(!f)return;
      var reader=new FileReader();
      reader.onload=function(ev){P.mapData.imageDataUrl=ev.target.result;drawMapEditor();};
      reader.readAsDataURL(f);
    };
  }

  var canvas=_$("map-canvas");if(!canvas)return;

  canvas.onmousedown=function(e){
    var rect=this.getBoundingClientRect();
    var sx=this.width/rect.width,sy=this.height/rect.height;
    var x=(e.clientX-rect.left)*sx,y=(e.clientY-rect.top)*sy;

    if(mapTool==="rect"){mapDrawing=true;mapStart={x:x,y:y};}
    else if(mapTool==="poly"){mapPolyPts.push([x,y]);drawMapEditor();}
    else if(mapTool==="point"){
      P.mapData.regions.push({id:uid(),name:"\u6807\u8BB0"+(P.mapData.regions.length+1),type:"point",point:{x:x,y:y},color:"#e74c3c",owner:"",desc:"",population:0,resources:0,defense:50,terrain:"\u5E73\u539F",adjacent:"",specialEffect:""});
      drawMapEditor();renderRegionList();
    }
    else if(mapTool==="select"){
      for(var i=P.mapData.regions.length-1;i>=0;i--){
        var r=P.mapData.regions[i];
        if(r.type==="rect"&&r.rect&&x>=r.rect.x&&x<=r.rect.x+r.rect.w&&y>=r.rect.y&&y<=r.rect.y+r.rect.h){selectRegion(i);return;}
        if(r.type==="point"&&r.point&&Math.hypot(x-r.point.x,y-r.point.y)<15){selectRegion(i);return;}
        if(r.type==="poly"&&r.points&&isPointInPoly(x,y,r.points)){selectRegion(i);return;}
      }
    }
  };

  canvas.onmouseup=function(e){
    if(!mapDrawing||mapTool!=="rect")return;
    mapDrawing=false;
    var rect=this.getBoundingClientRect();
    var sx=this.width/rect.width,sy=this.height/rect.height;
    var x=(e.clientX-rect.left)*sx,y=(e.clientY-rect.top)*sy;
    var w=x-mapStart.x,h=y-mapStart.y;
    if(Math.abs(w)>10&&Math.abs(h)>10){
      P.mapData.regions.push({id:uid(),name:"\u533A\u57DF"+(P.mapData.regions.length+1),type:"rect",rect:{x:Math.min(mapStart.x,x),y:Math.min(mapStart.y,y),w:Math.abs(w),h:Math.abs(h)},color:"#"+Math.floor(random()*16777215).toString(16).padStart(6,"0"),owner:"",desc:"",population:0,resources:0,defense:50,terrain:"\u5E73\u539F",adjacent:"",specialEffect:""});
      drawMapEditor();renderRegionList();
    }
  };

  canvas.ondblclick=function(){
    if(mapTool==="poly"&&mapPolyPts.length>2){
      P.mapData.regions.push({id:uid(),name:"\u533A\u57DF"+(P.mapData.regions.length+1),type:"poly",points:mapPolyPts.slice(),color:"#"+Math.floor(random()*16777215).toString(16).padStart(6,"0"),owner:"",desc:"",population:0,resources:0,defense:50,terrain:"\u5E73\u539F",adjacent:"",specialEffect:""});
      mapPolyPts=[];drawMapEditor();renderRegionList();
    }
  };
}

function isPointInPoly(x,y,pts){
  var inside=false;
  for(var i=0,j=pts.length-1;i<pts.length;j=i++){
    var xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}

function drawMapEditor(){
  var canvas=_$("map-canvas");if(!canvas)return;
  var ctx=canvas.getContext("2d");

  if(P.mapData.imageDataUrl){
    var img=new Image();
    img.onload=function(){
      canvas.width=img.width;canvas.height=img.height;
      P.mapData.width=img.width;P.mapData.height=img.height;
      ctx.drawImage(img,0,0);
      drawRegions(ctx);
    };
    img.src=P.mapData.imageDataUrl;
  }else{
    ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#5a5548";ctx.font="16px sans-serif";ctx.textAlign="center";
    ctx.fillText("\u4E0A\u4F20\u5730\u56FE\u56FE\u7247",canvas.width/2,canvas.height/2);
    drawRegions(ctx);
  }

  var countEl=_$("map-count");if(countEl)countEl.textContent=P.mapData.regions.length+" \u533A\u57DF";
}

function drawRegions(ctx){
  P.mapData.regions.forEach(function(r,i){
    ctx.save();
    ctx.globalAlpha=0.3;
    ctx.fillStyle=r.color||"#c9a84c";
    ctx.strokeStyle=i===mapSelIdx?"#ffffff":(r.color||"#c9a84c");
    ctx.lineWidth=i===mapSelIdx?3:1.5;

    if(r.type==="rect"&&r.rect){
      ctx.fillRect(r.rect.x,r.rect.y,r.rect.w,r.rect.h);
      ctx.globalAlpha=0.8;ctx.strokeRect(r.rect.x,r.rect.y,r.rect.w,r.rect.h);
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,r.rect.x+r.rect.w/2,r.rect.y+r.rect.h/2+4);
      if(r.terrain&&r.terrain!=="\u5E73\u539F"){ctx.font="9px sans-serif";ctx.fillStyle="#aaa";ctx.fillText(r.terrain,r.rect.x+r.rect.w/2,r.rect.y+r.rect.h/2+16);}
    }
    else if(r.type==="poly"&&r.points&&r.points.length>2){
      ctx.beginPath();ctx.moveTo(r.points[0][0],r.points[0][1]);
      r.points.forEach(function(p){ctx.lineTo(p[0],p[1]);});
      ctx.closePath();ctx.fill();ctx.globalAlpha=0.8;ctx.stroke();
      var cx=r.points.reduce(function(s,p){return s+p[0];},0)/r.points.length;
      var cy=r.points.reduce(function(s,p){return s+p[1];},0)/r.points.length;
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,cx,cy+4);
    }
    else if(r.type==="point"&&r.point){
      ctx.globalAlpha=0.8;ctx.beginPath();ctx.arc(r.point.x,r.point.y,8,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="10px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,r.point.x,r.point.y-14);
    }
    ctx.restore();
  });

  // 正在绘制的多边形
  if(mapPolyPts.length>0){
    ctx.save();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.setLineDash([5,5]);
    ctx.beginPath();ctx.moveTo(mapPolyPts[0][0],mapPolyPts[0][1]);
    mapPolyPts.forEach(function(p){ctx.lineTo(p[0],p[1]);});
    ctx.stroke();
    mapPolyPts.forEach(function(p){ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fill();});
    ctx.restore();
  }
}

function renderRegionList(){
  var el=_$("region-list");if(!el)return;
  el.innerHTML=P.mapData.regions.map(function(r,i){
    return "<div style=\"display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.5rem;border-bottom:1px solid rgba(42,42,62,0.4);font-size:0.8rem;cursor:pointer;"+(i===mapSelIdx?"background:var(--bg-4);":"")+"\" onclick=\"selectRegion("+i+")\">"+
      "<div><span style=\"width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:0.35rem;background:"+r.color+";\"></span>"+r.name+"</div>"+
      "<button class=\"bd bsm\" onclick=\"event.stopPropagation();P.mapData.regions.splice("+i+",1);mapSelIdx=-1;drawMapEditor();renderRegionList();_$('region-detail').style.display='none';\" style=\"padding:0.1rem 0.3rem;\">\u2715</button></div>";
  }).join("")||"<div style=\"color:var(--txt-d);font-size:0.82rem;padding:0.5rem;\">\u65E0\u533A\u57DF</div>";
}

function selectRegion(i){
  mapSelIdx=i;var r=P.mapData.regions[i];
  _$("region-detail").style.display="block";
  _$("rg-name").value=r.name||"";
  _$("rg-owner").value=r.owner||"";
  _$("rg-color").value=r.color||"#c9a84c";
  _$("rg-terrain").value=r.terrain||"\u5E73\u539F";
  _$("rg-pop").value=r.population||0;
  _$("rg-res").value=r.resources||0;
  _$("rg-def").value=r.defense||50;
  _$("rg-adj").value=r.adjacent||"";
  _$("rg-effect").value=r.specialEffect||"";
  _$("rg-desc").value=r.desc||"";
  drawMapEditor();renderRegionList();
}

function updateRegion(){
  if(mapSelIdx<0)return;
  var r=P.mapData.regions[mapSelIdx];
  r.name=_$("rg-name").value;
  r.owner=_$("rg-owner").value;
  r.color=_$("rg-color").value;
  r.terrain=_$("rg-terrain").value;
  r.population=+_$("rg-pop").value;
  r.resources=+_$("rg-res").value;
  r.defense=+_$("rg-def").value;
  r.adjacent=_$("rg-adj").value;
  r.specialEffect=_$("rg-effect").value;
  r.desc=_$("rg-desc").value;
  drawMapEditor();renderRegionList();
}

async function aiGenMapRegions(){
  try{
    showLoading("\u751F\u6210\u533A\u57DF...",20);
    var ctx=findScenarioById(editingScenarioId);
    var _map=P.map||{};var existMap=[].concat(_map.city||[]).concat(_map.strategic||[]).concat(_map.geo||[]).filter(function(x){return !x.sid||x.sid===editingScenarioId;}).map(function(x){return x.name;});var existNoteMap=existMap.length?"已有地图地点（不得重复）："+existMap.join("、")+"\n":"";var c=await callAISmart("\u4E3A\u5267\u672C\""+(ctx?ctx.name:"")+"\"("+(ctx?ctx.era:"")+") \u5EFA\u8BAE5-8\u4E2A\u5730\u56FE\u533A\u57DF\u3002"+existNoteMap+"\u8FD4\u56DEJSON:\n[{\"name\":\"\",\"owner\":\"\",\"terrain\":\"\u5E73\u539F/\u5C71\u5730/\u6CB3\u6D41/\u57CE\u6C60/\u5173\u9698\",\"population\":0,\"resources\":50,\"defense\":50,\"desc\":\"\",\"adjacent\":[]}]",1500,{minLength:300,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
    var jm=c.match(/\[[\s\S]*\]/);
    if(jm){
      JSON.parse(jm[0]).forEach(function(d,i){
        P.mapData.regions.push({
          id:uid(),name:d.name||"\u533A\u57DF",type:"rect",
          rect:{x:50+i*120,y:50+Math.floor(i/5)*100,w:100,h:80},
          color:"#"+Math.floor(random()*16777215).toString(16).padStart(6,"0"),
          owner:d.owner||"",desc:d.desc||"",population:d.population||0,
          resources:d.resources||0,defense:d.defense||50,
          terrain:d.terrain||"\u5E73\u539F",adjacent:(d.adjacent||[]).join(","),specialEffect:""
        });
      });
      drawMapEditor();renderRegionList();hideLoading();toast("\u2705 \u5DF2\u751F\u6210");
    }
  }catch(e){hideLoading();toast("\u5931\u8D25");}
}

