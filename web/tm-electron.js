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

  // 2026-05-22·loadScenario·hot bundled fallback wrapper
  // 老 .exe + 1.2.4.1+ hot update 时·main.js 不知 bundled-scenarios/·renderer 自己 try fetch
  // 成功 → 用 hot 版·失败 → fallback IPC 走 main.js (拿 installer bundled)
  async function _loadScenarioWithHotFallback(name) {
    var fileName = String(name || '').trim();
    if (!fileName) return { success: false, error: 'empty name' };
    if (!/\.json$/i.test(fileName)) fileName += '.json';
    // 1. try fetch hot bundled (相对路径·hot update 解压后 hotRoot/bundled-scenarios/<file>)
    try {
      var resp = await fetch('bundled-scenarios/' + encodeURIComponent(fileName) + '?t=' + Date.now());
      if (resp.ok) {
        var data = await resp.json();
        console.log('[loadScenario] 从 hot bundled-scenarios 加载:', fileName);
        return { success: true, data: data, source: 'hot-update' };
      }
    } catch (e) {
      // fetch 失败 (没 hot 或文件不存在)·静默 fallback
    }
    // 2. fallback IPC (main.js·走 installer BUNDLED_SCENARIOS_DIR 或 user-scenarios)
    return await window.tianming.loadScenario(name);
  }

  async function _ensureOfficialScenarioFiles(){
    var seeder = window.TMOfficialScenarioSeeder;
    if (!seeder || typeof seeder.ensure !== 'function') return;
    try {
      await seeder.ensure();
    } catch (e) {
      console.warn('[official-scenario-seeder] ensure failed:', e && e.message || e);
    }
  }

  function _desktopElement(tag, className, text){
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function _desktopReplaceChildren(parent){
    var children = Array.prototype.slice.call(arguments, 1);
    if (parent && typeof parent.replaceChildren === 'function') {
      parent.replaceChildren.apply(parent, children);
      return;
    }
    if (!parent) return;
    parent.textContent = '';
    children.forEach(function(child){ parent.appendChild(child); });
  }

  function _desktopButton(label, className, handler){
    var button = _desktopElement('button', className, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function _desktopPanel(title, subtitle){
    var panel = _desktopElement('div', 'pnl');
    var head = _desktopElement('div', 'pnl-hd');
    var titleWrap = subtitle ? _desktopElement('div') : head;
    titleWrap.appendChild(_desktopElement('div', 'pnl-t', title));
    if (subtitle) titleWrap.appendChild(_desktopElement('div', 'pnl-sub', subtitle));
    if (subtitle) head.appendChild(titleWrap);
    panel.appendChild(head);
    return panel;
  }

  function _desktopFooter(panel){
    var footer = _desktopElement('div', 'rw pnl-ft');
    panel.appendChild(footer);
    return footer;
  }

  function _desktopScenarioStartPanel(scn, name, defName){
    var panel = _desktopPanel('开始游戏', '剧本：' + String(scn.name || name || scn.id || ''));
    var field = _desktopElement('div', 'fd full');
    field.style.marginBottom = '1.2rem';
    field.appendChild(_desktopElement('label', '', '存档名（可修改）'));
    var input = _desktopElement('input');
    input.id = 'start-save-name';
    input.value = String(defName || '');
    field.appendChild(input);
    panel.appendChild(field);
    var footer = _desktopFooter(panel);
    footer.appendChild(_desktopButton('▶ 开始', 'bt bp', function(){ window.desktopConfirmStart(); }));
    footer.appendChild(_desktopButton('返回', 'bt bs', function(){ showScnSelect(); }));
    return panel;
  }

  function _normalizeDesktopScenario(scn, fallbackName){
    if (!scn || typeof scn !== 'object') return null;
    if (!scn.id) scn.id = 'scn_file_' + String(fallbackName || scn.name || Date.now()).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
    if (!scn.name) scn.name = String(fallbackName || scn.id || '未命名剧本');
    if (!scn.era && scn.dynasty) scn.era = scn.dynasty;
    if (!scn.role && scn.emperor) scn.role = scn.emperor;
    if (!scn.background && scn.overview) scn.background = scn.overview;
    if (!scn.desc && scn.overview) scn.desc = scn.overview;
    return scn;
  }

  function _installDesktopScenario(scn){
    if (!scn || !scn.id) return;
    if (!Array.isArray(P.scenarios)) P.scenarios = [];
    var existing = P.scenarios.findIndex(function(s){return s && s.id===scn.id;});
    if(existing>=0){P.scenarios[existing]=scn;}else{P.scenarios.push(scn);}
    ['characters','factions','parties','classes','items','relations'].forEach(function(key){
      if(scn[key]&&scn[key].length>0){
        P[key]=(P[key]||[]).filter(function(it){return it.sid!==scn.id;});
        scn[key].forEach(function(it){it.sid=scn.id;});
        P[key]=P[key].concat(scn[key]);
      }
    });
    if (typeof buildIndices === 'function') buildIndices();
  }

  function _projectScenarioListItems(files){
    var seen = {};
    (files || []).forEach(function(f){
      if (f && f.id) seen['id:' + f.id] = true;
      if (f && f.name) seen['name:' + f.name] = true;
      if (f && f.title) seen['title:' + f.title] = true;
    });
    var scenarios = (window.P && Array.isArray(P.scenarios)) ? P.scenarios : [];
    return scenarios.filter(function(sc){
      if (!sc || sc._scenarioEditorSandbox) return false;
      var label = sc.name || sc.title || sc.id || '';
      if (sc.id && seen['id:' + sc.id]) return false;
      if (label && (seen['name:' + label] || seen['title:' + label])) return false;
      return !!(sc.id || label);
    }).map(function(sc){
      return {
        id: sc.id || '',
        name: sc.name || sc.title || sc.id || '未命名剧本',
        title: sc.name || sc.title || sc.id || '未命名剧本',
        modifiedStr: '正式剧本库',
        source: 'project',
        projectOnly: true,
        playable: true
      };
    });
  }

  function _scenarioSourceLabel(item){
    if (!item) return '';
    if (item.projectOnly || item.source === 'project') return '正式库';
    if (item.source === 'official') return '官方';
    if (item.source === 'user') return '自制';
    return item.source || '';
  }

  function _prepareDesktopStartScenario(scn, name){
    scn = _normalizeDesktopScenario(scn, name);
    if (!scn) { toast('剧本数据为空'); return; }
    _installDesktopScenario(scn);
    var now=new Date();
    var pad=function(n){return String(n).padStart(2,'0');};
    var defName=(scn.name||name||scn.id)+'_'+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes());
    window._pendingStartPayload={scn:scn,origName:name||scn.name||scn.id};
    showPanel(_desktopScenarioStartPanel(scn, name, defName));
  }

  // --- 主菜单显示/隐藏辅助 ---
  // launch 改版后 #lt-menu → .home-stage 整个 hero 区(menu + title + 楹联等)·main-view 是其后兄弟
  // 旧版直接 toggle lt-menu·新版必须 toggle 整个 home-stage·不然 main-view 被 home-stage(100vh) 推到屏外
  function _getLaunchHero(){
    return document.getElementById('lt-menu')          // 旧版兼容
        || document.querySelector('.home-stage')       // 新版 launch hero
        || document.querySelector('.home-menu');       // 兜底
  }
  function _tmClearDesktopStartPayload(){ window._pendingStartPayload=null; }
  function showMain(){
    var hero = _getLaunchHero(); if (hero) hero.style.display='';
    var mv = document.getElementById('main-view');
    if (mv) { mv.style.display='none'; _desktopReplaceChildren(mv); }
  }
  function _ensureDesktopMainView(){
    var launch=document.getElementById('launch');
    if(!launch) throw new Error('启动页容器未加载，无法显示剧本选择');
    var view=document.getElementById('main-view');
    if(!view){
      view=document.createElement('div');view.id='main-view';
      view.style.cssText='display:none;width:100%;max-height:80vh;overflow-y:auto;';
      launch.appendChild(view);
    }
    return view;
  }

  function showPanel(content){
    var mv = _ensureDesktopMainView();
    var hero = _getLaunchHero(); if (hero) hero.style.display='none';
    if (mv) {
      mv.style.display='block';
      _desktopReplaceChildren(mv, typeof content === 'string' ? document.createTextNode(content) : content);
    }
    var lc = document.getElementById('launch'); if (lc) lc.style.display='flex';
  }

  // --- 剧本管理页（桌面端）---
  showScnManage=async function(){
    await _ensureOfficialScenarioFiles();
    var list=await window.tianming.listScenarios();
    var files=list.success?list.files:[];
    var panel=_desktopPanel('剧本管理');
    if(!files.length){
      panel.appendChild(_desktopElement('p', 'pnl-empty', '暂无剧本，请先新建。'));
    }else{
      var listEl=_desktopElement('div', 'pnl-list');
      files.forEach(function(f){
        var row=_desktopElement('div', 'pnl-row cd');
        var info=_desktopElement('div', 'pnl-row-info');
        info.appendChild(_desktopElement('span', 'pnl-row-name', f && f.name));
        info.appendChild(_desktopElement('span', 'pnl-row-meta', f && f.modifiedStr));
        row.appendChild(info);
        var actions=_desktopElement('div', 'rw'); actions.style.gap='0.4rem';
        actions.appendChild(_desktopButton('编辑', 'bt bs bsm', function(){ window.desktopEnterScn(f.name); }));
        actions.appendChild(_desktopButton('删除', 'bt bd bsm', function(){ window.desktopDeleteScn(f.name); }));
        row.appendChild(actions); listEl.appendChild(row);
      });
      panel.appendChild(listEl);
    }
    var footer=_desktopFooter(panel);
    footer.appendChild(_desktopButton('＋ 新建剧本', 'bt bp', function(){ createNewScn(); }));
    footer.appendChild(_desktopButton('返回', 'bt bs', showMain));
    showPanel(panel);
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
      // 从磁盘加载·优先 hot bundled-scenarios·fallback IPC
      var r = await _loadScenarioWithHotFallback(name);
      if(!r.success){toast('加载失败: '+(r.error||''));return;}
      scn = r.data;
      console.log('[desktopEnterScn] 从磁盘加载:', name, '·source=' + (r.source || 'ipc'));
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
    (window.openScenarioResetEditor||openEditorHtml)(scn.id);
    }catch(e){console.error('[desktopEnterScn] 错误:',e);toast('打开失败: '+e.message);}
  };

  window.desktopDeleteScn=async function(name){
    if(!confirm('确认删除剧本「'+name+'」？')){return;}
    var r=await window.tianming.deleteScenario(name);
    if(r.success){toast('已删除');showScnManage();}
    else toast('删除失败: '+(r.error||''));
  };

  // --- 剧本选择页（桌面端）---
  function _desktopSelectionRequest(){
    var pane=_desktopPanel('选择剧本');
    pane.setAttribute('aria-busy','true');
    pane.appendChild(_desktopElement('p','pnl-empty','正在读取剧本目录…'));
    _desktopFooter(pane).appendChild(_desktopButton('返回','bt bs',showMain));
    showPanel(pane);
    var host=document.getElementById('main-view');
    return {
      current:function(){
        var launch=document.getElementById('launch');
        return document.getElementById('main-view')===host && pane.parentNode===host &&
          launch && launch.style.display!=='none' && host.style.display!=='none';
      },
      fail:function(error){
        if(!this.current())return;
        var failed=_desktopPanel('剧本目录读取失败');
        failed.appendChild(_desktopElement('p','pnl-empty',String(error && error.message || error)));
        var footer=_desktopFooter(failed);
        footer.appendChild(_desktopButton('重试','bt bp',function(){showScnSelect();}));
        footer.appendChild(_desktopButton('返回','bt bs',showMain));
        showPanel(failed);
      }
    };
  }

  showScnSelect=async function(){
    var request=_desktopSelectionRequest();
    try {
    await _ensureOfficialScenarioFiles();
    if(!request.current())return;
    var list=await window.tianming.listScenarios();
    if(!request.current())return;
    if(!list || !list.success || !Array.isArray(list.files))throw new Error(list && list.error || '没有收到有效的剧本目录');
    var files=list.files;
    files=files.concat(_projectScenarioListItems(files));
    var panel=_desktopPanel('选择剧本');
    if(!files.length){
      panel.appendChild(_desktopElement('p', 'pnl-empty', '暂无剧本。'));
    }else{
      var listEl=_desktopElement('div', 'pnl-list');
      files.forEach(function(f){
        var label = _scenarioSourceLabel(f);
        var row=_desktopElement('div', 'pnl-row cd');
        row.dataset.scenarioId=String(f.id || '');
        var info=_desktopElement('div', 'pnl-row-info');
        info.appendChild(_desktopElement('span', 'pnl-row-name', f.title||f.name||f.id));
        info.appendChild(_desktopElement('span', 'pnl-row-meta', (label?label+' · ':'')+(f.modifiedStr||'')));
        row.appendChild(info);
        row.appendChild(_desktopButton('开始', 'bt bp bsm', function(){
          if (f.projectOnly) window.desktopStartProjectScn(f.id);
          else window.desktopStartScn(f.name);
        }));
        listEl.appendChild(row);
      });
      panel.appendChild(listEl);
    }
    _desktopFooter(panel).appendChild(_desktopButton('返回', 'bt bs', showMain));
    showPanel(panel);
    }catch(error){request.fail(error);}
  };

  window.desktopStartScn=async function(name){
    var r=await _loadScenarioWithHotFallback(name);
    if(!r.success){toast('加载失败: '+(r.error||''));return;}
    _prepareDesktopStartScenario(r.data, name);
  };

  window.desktopStartProjectScn=function(id){
    var scn = (window.P && Array.isArray(P.scenarios)) ? P.scenarios.find(function(s){return s && s.id===id;}) : null;
    if(!scn){toast('剧本库中未找到：'+id);showScnSelect();return;}
    _prepareDesktopStartScenario(scn, scn.name||scn.id);
  };

  // 模式选择页「返回」：用内存中的 _pendingStartPayload 重建存档名面板。
  // 正式库剧本（projectOnly）没有磁盘文件，按文件名重新 load 必报「加载失败」。
  window.desktopBackToStartPanel=function(){
    var p=window._pendingStartPayload;
    if(p&&p.scn){_prepareDesktopStartScenario(p.scn,p.origName);}
    else if(typeof showScnSelect==='function'){showScnSelect();}
  };

  window.desktopConfirmStart=function(){
    var payload=window._pendingStartPayload;
    var scn=payload.scn;
    var saveName=(_$('start-save-name').value||'').trim();
    if(!saveName){toast('请输入存档名');return;}
    window._pendingStartPayload.saveName=saveName;
    // Show mode selection panel
    var panel=_desktopPanel('选择游戏模式', '存档：'+saveName);
    // Long scenario-specific mode descriptions and expanded references must not
    // push continuation outside main-view's 80vh viewport. Only the body scrolls.
    panel.classList.add('pnl-mode-setup');
    panel.style.cssText='display:flex;flex-direction:column;height:80vh;box-sizing:border-box';
    panel.firstElementChild.style.flex='0 0 auto';
    var modes=_desktopElement('div', 'pnl-mode-body'); modes.style.cssText='padding:0.5rem 0.2rem 0.75rem 0;flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain';
    function addMode(id, mode, title, desc, notes, selected){
      var opt=_desktopElement('div', 'mode-opt'); opt.id=id;
      opt.style.cssText='border:2px solid '+(selected?'var(--gold)':'var(--bdr)')+';border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.6rem;cursor:pointer;'+(selected?'background:rgba(200,160,60,0.12)':'');
      var heading=_desktopElement('div', '', title); heading.style.cssText='color:'+(selected?'var(--gold)':'var(--txt-s)')+';font-weight:700;font-size:1rem'; opt.appendChild(heading);
      var detail=_desktopElement('div', '', desc); detail.style.cssText='color:var(--txt-d);font-size:0.82rem;margin-top:0.25rem'; opt.appendChild(detail);
      notes.forEach(function(note){ var n=_desktopElement('div', '', '• '+note); n.style.cssText='color:var(--txt-d);font-size:0.75rem;margin-top:0.25rem'; opt.appendChild(n); });
      opt.addEventListener('click', function(){ window._pendingSelectMode(opt, mode); }); modes.appendChild(opt);
    }
    // historical-agency-v21
    if (window.TM && TM.HistoricalAgency && TM.HistoricalAgency.isPlayerDriven(scn)) {
      addMode('mo-yanyi','yanyi','演义模式',TM.HistoricalAgency.modeDescription('yanyi',scn),['人物属于当前时代，后续大事不预定'],true);
      addMode('mo-light','light_hist','轻度史实',TM.HistoricalAgency.modeDescription('light_hist',scn),['核查时代条件，尊重玩家所定年号与施政'],false);
      addMode('mo-strict','strict_hist','严格史实',TM.HistoricalAgency.modeDescription('strict_hist',scn),['考据用于既往经历和制度，不替玩家规定结局'],false);
    } else {
    addMode('mo-yanyi','yanyi','演义模式','小说化演绎，AI可自由发挥，情节更富戏剧性',['历史名臣：中国古代全部历史名臣都有概率出现'],true);
    addMode('mo-light','light_hist','轻度史实','大事件遵历史，细节可演绎，平衡历史与趣味',['历史名臣：仅出现剧本开始年份前后200年内的历史名臣','每回合推演后进行历史检查，校正明显史实错误'],false);
    addMode('mo-strict','strict_hist','严格史实','严格遵守史实，不得改变历史走向',['历史名臣：仅出现剧本开始年份前后100年内的历史名臣','每回合推演前检索参考数据库，强制遵循史实'],false);
    }
    var strictOptions=_desktopElement('div'); strictOptions.id='strict-mode-options'; strictOptions.style.cssText='display:none;margin-top:1rem;padding:1rem;background:rgba(0,0,0,0.2);border-radius:8px';
    strictOptions.appendChild(_desktopElement('div', '', '📚 参考数据库（可选）'));
    strictOptions.appendChild(_desktopElement('div', '', '提供史料文本作为AI推演的参考依据'));
    var ref=_desktopElement('textarea'); ref.id='strict-ref-text'; ref.placeholder='粘贴或输入参考史料文本...'; ref.style.cssText='width:100%;height:120px;padding:0.5rem;background:#1a1a1a;border:1px solid var(--bdr);color:var(--txt-s);border-radius:4px;font-size:0.85rem;resize:vertical'; strictOptions.appendChild(ref);
    strictOptions.appendChild(_desktopElement('div', '', '💡 提示：可输入正史记载、大事年表等，AI将严格参照此内容推演'));
    modes.appendChild(strictOptions); panel.appendChild(modes);
    var footer=_desktopFooter(panel);
    footer.style.cssText='flex:0 0 auto;margin-top:0.6rem;padding-top:0.75rem;background:var(--bg-0)';
    var startButton=_desktopButton('▶ 开始', 'bt bp', function(){ window.desktopDoStart(); }); startButton.id='start-mode-btn'; footer.appendChild(startButton);
    footer.appendChild(_desktopButton('返回', 'bt bs', function(){ window.desktopBackToStartPanel(); }));
    window._pendingStartMode='yanyi';
    window._pendingRefText='';
    showPanel(panel);
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
    // Keep the persistent launch mount; remove only the old panel contents.
    var panel=document.getElementById('main-view');
    if(panel){panel.style.display='none';_desktopReplaceChildren(panel);}

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
    (window.openScenarioResetEditor||openEditorHtml)(id);
  };

}

// 输入框焦点修复（Electron）·2026-05-22 B fix·
// 老版无脑 setTimeout 10ms focus·这 10ms 内 phase8 wrapper / panel render 会 innerHTML 重建
// e.target 变孤儿节点·focus() 给已脱树元素 → 光标消失
// 新版·1) 立即尝试 (大多场景原生 OK·不需延迟) 2) fallback 时验证 target.isConnected
function _tmElectronGlobalMouseDown(e){
  var t=e.target.tagName;
  if(t!=="INPUT"&&t!=="TEXTAREA"&&t!=="SELECT")return;
  var target=e.target;
  if(document.activeElement===target)return;
  setTimeout(function(){
    if(target.isConnected){
      target.focus();
    }else if(window._tmFocusFixDebug){
      console.log("[focus-fix] target detached, skip focus:",t);
    }
  },10);
}
if(!window.__tmElectronGlobalMouseDownInstalled){
  window.__tmElectronGlobalMouseDownInstalled=true;
  document.addEventListener("mousedown",_tmElectronGlobalMouseDown);
}

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
  var rows=(P.mapData&&Array.isArray(P.mapData.regions))?P.mapData.regions:[];
  if(!rows.length){var empty=document.createElement('div');empty.style.cssText='color:var(--txt-d);font-size:0.82rem;padding:0.5rem';empty.textContent='无区域';if(el.replaceChildren)el.replaceChildren(empty);else{el.textContent='';el.appendChild(empty);}return;}
  var nodes=rows.map(function(r,i){
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.5rem;border-bottom:1px solid rgba(42,42,62,0.4);font-size:0.8rem;cursor:pointer;'+(i===mapSelIdx?'background:var(--bg-4);':'');
    row.addEventListener('click',function(){selectRegion(i);});
    var label=document.createElement('div');var dot=document.createElement('span');dot.style.cssText='width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:0.35rem';dot.style.background=/^#[0-9a-f]{3,8}$/i.test(String(r.color||''))?String(r.color):'#c9a84c';label.appendChild(dot);label.appendChild(document.createTextNode(String(r.name||'')));row.appendChild(label);
    var del=document.createElement('button');del.type='button';del.className='bd bsm';del.style.padding='0.1rem 0.3rem';del.textContent='✕';del.addEventListener('click',function(event){event.stopPropagation();P.mapData.regions.splice(i,1);mapSelIdx=-1;drawMapEditor();renderRegionList();var detail=_$('region-detail');if(detail)detail.style.display='none';});row.appendChild(del);return row;
  });
  if(el.replaceChildren)el.replaceChildren.apply(el,nodes);else{el.textContent='';nodes.forEach(function(node){el.appendChild(node);});}
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
    var _map=P.map||{};var existMap=[].concat(_map.city||[]).concat(_map.strategic||[]).concat(_map.geo||[]).filter(function(x){return !x.sid||x.sid===editingScenarioId;}).map(function(x){return x.name;});var existNoteMap=existMap.length?"已有地图地点（不得重复）："+existMap.join("、")+"\n":"";var c=await callAISmart("\u4E3A\u5267\u672C\""+(ctx?ctx.name:"")+"\"("+(ctx?ctx.era:"")+") \u5EFA\u8BAE5-8\u4E2A\u5730\u56FE\u533A\u57DF\u3002"+existNoteMap+"\u8FD4\u56DEJSON:\n[{\"name\":\"\",\"owner\":\"\",\"terrain\":\"\u5E73\u539F/\u5C71\u5730/\u6CB3\u6D41/\u57CE\u6C60/\u5173\u9698\",\"population\":0,\"resources\":50,\"defense\":50,\"desc\":\"\",\"adjacent\":[]}]",1500,{minLength:300,validator:function(c){try{var arr=extractJSON(c);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
    var generatedMap=extractJSON(c);
    if(Array.isArray(generatedMap)){
      generatedMap.forEach(function(d,i){
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
