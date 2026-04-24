// ============================================================
// tm-chaoyi-misc.js — 朝议附带杂务 (R125 从 tm-chaoyi.js L1664-2781 拆出)
//
// ⚠ 此文件是前置状态债务的集中体·应进一步分配到各自领域:
//   - 官员表任命覆盖         → tm-office-panel.js?
//   - 继续游戏按钮           → tm-launch.js?
//   - 奏议批复扩展           → tm-memorials.js?
//   - Electron 桌面端存档    → tm-storage.js?
//   - 游戏内小地图/交互地图   → tm-map-system.js?
//   - 音效和音乐             → tm-audio-theme.js
// 保留本文件作为中转·后续 R126+ 逐个迁移到正确归属
// ============================================================

// ============================================================
//  官员表任命（覆盖简版）
// ============================================================
// renderOfficeTree 已在 tm-index-world.js 中定义（SVG树状图版本）
// renderOfficeDeptV2 仍保留作为SVG不可用时的回退

function renderOfficeDeptV2(dept,path){
  var ps=JSON.stringify(path);
  var posH=(dept.positions||[]).map(function(pos,pi){
    var pp=path.concat(["p",pi]);var ppS=JSON.stringify(pp);var ppId="od-"+pp.join("-");
    // ── 三层统计：编制 / 缺员 / 已具名 ──
    var _est = pos.establishedCount != null ? pos.establishedCount : (parseInt(pos.headCount,10) || 1);
    var _vac = pos.vacancyCount != null ? pos.vacancyCount : 0;
    var _occ = Math.max(0, _est - _vac);
    var _ah = Array.isArray(pos.actualHolders) ? pos.actualHolders : (pos.holder ? [{name:pos.holder,generated:true}] : []);
    var _namedArr = _ah.filter(function(h){return h && h.name && h.generated!==false;});
    var _placeholderCount = _ah.filter(function(h){return h && h.generated===false;}).length;
    // 三栏标签
    var _triBar = '<div style="display:inline-flex;gap:4px;font-size:0.6rem;margin-left:4px;">'
      + '<span style="background:rgba(107,93,79,0.2);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="编制">\u7F16'+_est+'</span>'
      + (_vac>0 ? '<span style="background:rgba(192,64,48,0.15);color:var(--vermillion-400);padding:0 4px;border-radius:2px;" title="缺员(史料记载)">\u7F3A'+_vac+'</span>' : '')
      + '<span style="background:rgba(87,142,126,0.15);color:var(--celadon-400);padding:0 4px;border-radius:2px;" title="实际在职">\u5728'+_occ+'</span>'
      + '<span style="background:rgba(184,154,83,0.15);color:var(--gold-400);padding:0 4px;border-radius:2px;" title="已具名(有角色)">\u540D'+_namedArr.length+'</span>'
      + (_placeholderCount>0 ? '<span style="background:rgba(184,154,83,0.08);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="在职但无角色内容——运行时 AI 按需生成">\u203B'+_placeholderCount+'</span>' : '')
      + '</div>';
    // ── 俸禄理论/实际 ──
    var _perSalary = pos.perPersonSalary || pos.salary || '';
    var _salaryBar = '';
    if (_perSalary) {
      var _n = parseFloat(String(_perSalary).replace(/[^\d.]/g,'')) || 0;
      var _unit = String(_perSalary).replace(/[\d.]/g,'').trim();
      if (_n > 0) {
        _salaryBar = '<span style="font-size:0.6rem;color:var(--ink-300);margin-left:6px;" title="理论总俸=单俸×编制；实际支出=单俸×(编制-缺员)">俸'+_perSalary+'/人 · 理论'+(_n*_est)+_unit+' · 实支'+(_n*_occ)+_unit+'</span>';
      } else {
        _salaryBar = '<span style="font-size:0.6rem;color:var(--ink-300);margin-left:6px;">俸'+_perSalary+'/人</span>';
      }
    }
    // ── 在任者信息（按 actualHolders 显示所有具名任职者） ──
    var holderInfo = '', holderDetail = '';
    if (_namedArr.length > 0) {
      var _nameLine = _namedArr.slice(0,3).map(function(h) {
        var _hch = findCharByName(h.name);
        if (_hch) {
          var _loy = _hch.loyalty || 50;
          var _loyC = _loy > 70 ? 'var(--celadon-400)' : _loy < 30 ? 'var(--vermillion-400)' : 'var(--color-foreground-secondary)';
          var _portraitImg = _hch.portrait?'<img src="'+escHtml(_hch.portrait)+'" style="width:14px;height:14px;object-fit:cover;border-radius:50%;vertical-align:middle;margin-right:2px;">':'';
          return _portraitImg + '<span style="color:var(--celadon-400);">' + escHtml(h.name) + '</span>'
            + '<span style="font-size:0.6rem;color:' + _loyC + ';margin-left:2px;">\u5FE0' + _loy + '</span>'
            + (h.spawnedTurn ? '<span style="font-size:0.55rem;color:var(--amber-400);margin-left:2px;" title="由 AI 推演实体化">\u2605</span>' : '');
        }
        return '<span style="color:var(--gold-400);">' + escHtml(h.name) + '</span>';
      }).join('、');
      holderInfo = _nameLine + (_namedArr.length > 3 ? '<span style="font-size:0.6rem;color:var(--ink-300);">…等'+_namedArr.length+'人</span>' : '');
      // 主任职者详情（第一个）
      var _hch0 = findCharByName(_namedArr[0].name);
      if (_hch0) {
        // 考评（由吏部NPC给出，存在pos._evaluations中）
        var _lastEval = (pos._evaluations && pos._evaluations.length > 0) ? pos._evaluations[pos._evaluations.length-1] : null;
        if (_lastEval) {
          var _evalColors = {'\u5353\u8D8A':'var(--gold-400)','\u79F0\u804C':'var(--celadon-400)','\u5E73\u5EB8':'var(--ink-300)','\u5931\u804C':'var(--vermillion-400)'};
          holderInfo += '<span style="font-size:0.6rem;color:' + (_evalColors[_lastEval.grade]||'var(--ink-300)') + ';margin-left:3px;">' + escHtml(_lastEval.grade||'') + '</span>';
        }
        holderDetail = '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-top:var(--space-1);padding:var(--space-1) 0;">';
        holderDetail += '\u80FD\u529B\uFF1A\u667A' + (_hch0.intelligence||50) + ' \u653F' + (_hch0.administration||50) + ' \u519B' + (_hch0.military||50);
        if (_hch0.location && _hch0.location !== (GM._capital||'\u4EAC\u57CE')) holderDetail += ' <span style="color:var(--amber-400);">[\u8FDC\u65B9:' + escHtml(_hch0.location) + ']</span>';
        holderDetail += '</div>';
        if (_lastEval) {
          holderDetail += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);padding:2px 0;border-top:1px solid var(--color-border-subtle);">';
          holderDetail += '\u8003\u8BC4\uFF08' + escHtml(_lastEval.evaluator||'\u5417\u90E8') + '\uFF09\uFF1A' + escHtml(_lastEval.comment||'');
          holderDetail += '</div>';
        }
      }
    } else if (_placeholderCount >= _occ && _occ > 0) {
      holderInfo = '<span style="color:var(--ink-300);font-style:italic;">\u5728\u804C'+_occ+'\u4EBA(\u672A\u5177\u540D\u2014\u2014\u63A8\u6F14\u6D89\u53CA\u65F6\u81EA\u52A8\u5B9E\u4F53\u5316)</span>';
    } else if (_occ === 0) {
      holderInfo = '<span style="color:var(--vermillion-400);">\u5168\u90E8\u7F3A\u5458</span>';
    } else {
      holderInfo = '<span style="color:var(--vermillion-400);">\u7A7A\u7F3A</span>';
    }
    var rankTag = pos.rank ? '<span style="font-size:0.6rem;color:var(--ink-300);margin-left:3px;">(' + escHtml(pos.rank) + ')</span>' : '';
    var dutyLine = (pos.desc || pos.duties) ? '<div style="font-size:0.68rem;color:var(--color-foreground-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:350px;">' + escHtml((pos.desc || pos.duties || '').slice(0, 60)) + '</div>' : '';
    // 操作按钮——不再直接任命，改为荐贤/免职→写入诏令
    var actionBtns = '';
    if (!pos.holder) {
      actionBtns = '<button class="bt bp bsm" onclick="_offRecommend('+ppS+',\'' + escHtml(dept.name).replace(/'/g,"\\'") + '\',\'' + escHtml(pos.name).replace(/'/g,"\\'") + '\')" style="font-size:0.65rem;">\u8350\u8D24</button>';
    } else {
      actionBtns = '<button class="bt bsm" onclick="_offDismissToEdict(\'' + escHtml(pos.holder).replace(/'/g,"\\'") + '\',\'' + escHtml(dept.name).replace(/'/g,"\\'") + '\',\'' + escHtml(pos.name).replace(/'/g,"\\'") + '\')" style="font-size:0.65rem;color:var(--vermillion-400);">\u514D\u804C</button>';
    }
    // 历任记录
    var histLine = '';
    if (pos._history && pos._history.length > 0) {
      histLine = '<div style="font-size:0.6rem;color:var(--ink-300);margin-top:2px;">\u5386\u4EFB\uFF1A' + pos._history.map(function(h){ return escHtml(h.holder||'?'); }).join(' → ') + '</div>';
    }
    return '<div class="office-node"><div class="office-header" onclick="var d=_$(\''+ppId+'\');if(d)d.style.display=d.style.display===\'block\'?\'none\':\'block\';">'
      +'<div style="flex:1;"><span>'+escHtml(pos.name)+'</span>'+rankTag+_triBar+_salaryBar+'<div style="margin-top:2px;">'+holderInfo+'</div></div>'
      +'<div style="display:flex;gap:2px;align-items:center;">'+actionBtns+'<span class="office-expand">\u25BC</span></div></div>'
      +dutyLine+histLine
      +'<div class="office-detail" id="'+ppId+'">'
      +holderDetail
      +'</div></div>';
  }).join("");
  // 部门头——职能标签+编制/缺员/在职/已名聚合统计
  var fnTags = (dept.functions||[]).map(function(f){ return '<span style="font-size:0.6rem;background:rgba(184,154,83,0.15);color:var(--gold-400);padding:1px 4px;border-radius:3px;">' + escHtml(f) + '</span>'; }).join(' ');
  var deptDesc = dept.desc || dept.description || '';
  var _deptEst = 0, _deptVac = 0, _deptOcc = 0, _deptNamed = 0, _deptPH = 0;
  (dept.positions||[]).forEach(function(p) {
    var est = p.establishedCount != null ? p.establishedCount : (parseInt(p.headCount,10) || 1);
    var vac = p.vacancyCount != null ? p.vacancyCount : 0;
    var ah = Array.isArray(p.actualHolders) ? p.actualHolders : (p.holder ? [{name:p.holder,generated:true}] : []);
    _deptEst += est;
    _deptVac += vac;
    _deptOcc += Math.max(0, est - vac);
    _deptNamed += ah.filter(function(h){return h && h.name && h.generated!==false;}).length;
    _deptPH += ah.filter(function(h){return h && h.generated===false;}).length;
  });
  var vacantTag = '<span style="display:inline-flex;gap:3px;font-size:0.6rem;margin-left:4px;">'
    + '<span style="background:rgba(107,93,79,0.2);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="部门编制总额">\u7F16'+_deptEst+'</span>'
    + (_deptVac>0?'<span style="background:rgba(192,64,48,0.15);color:var(--vermillion-400);padding:0 4px;border-radius:2px;" title="缺员总数">\u7F3A'+_deptVac+'</span>':'')
    + '<span style="background:rgba(87,142,126,0.15);color:var(--celadon-400);padding:0 4px;border-radius:2px;" title="实际在职总数">\u5728'+_deptOcc+'</span>'
    + '<span style="background:rgba(184,154,83,0.15);color:var(--gold-400);padding:0 4px;border-radius:2px;" title="已具名角色总数">\u540D'+_deptNamed+'</span>'
    + (_deptPH>0?'<span style="background:rgba(184,154,83,0.08);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="在职但无角色——运行时按需生成">\u203B'+_deptPH+'</span>':'')
    + '</span>';
  var totalCount = (dept.positions||[]).length;
  var subH=(dept.subs||[]).map(function(s,si){return renderOfficeDeptV2(s,path.concat(["s",si]));}).join("");
  return '<div class="office-node"><div class="office-header"><div style="flex:1;"><span style="font-weight:700;">'+escHtml(dept.name)+'</span>'+vacantTag
    +(fnTags?' <span style="margin-left:4px;">'+fnTags+'</span>':'')
    +'</div><div><button class="office-expand" onclick="addOffPos('+ps+')">+\u5B98</button><button class="office-expand" onclick="addOffSub('+ps+')">+\u5C40</button></div></div>'
    +(deptDesc?'<div style="font-size:0.68rem;color:var(--color-foreground-muted);padding:0 0.5rem;margin-bottom:2px;">'+escHtml(deptDesc).slice(0,100)+'</div>':'')
    +'<div class="office-children">'+posH+subH+'</div></div>';
}

// ============================================================
//  继续游戏按钮
// ============================================================
(function(){
  var menu=_$("lt-menu");if(!menu)return;
  if(_$("lt-continue"))return;
  var btn=document.createElement("button");btn.className="lt-btn";btn.id="lt-continue";btn.style.display="none";
  btn.innerHTML="\u25B6 <div><div style=\"font-weight:700;\">\u7EE7\u7EED\u6E38\u620F</div><div id=\"lt-cont-desc\" style=\"font-size:0.75rem;color:var(--txt-d);\"></div></div>";
  btn.onclick=function(){
    if(GM.running){_$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");}
  };
  menu.insertBefore(btn,menu.firstChild);
})();

// 返回主菜单时显示继续按钮
GameHooks.on('backToLaunch:after', function() {
  var cb=_$("lt-continue");
  if(cb&&GM.running){
    cb.style.display="flex";
    var desc=_$("lt-cont-desc");
    if(desc){var sc=findScenarioById(GM.sid);desc.textContent=(sc?sc.name:"")+" T"+GM.turn+" "+getTSText(GM.turn);}
  }
});

// ============================================================
//  奏议批复按钮增加"批复"
// ============================================================
// renderMemorials 不再覆盖，使用 tm-index-world.js 中的完整版本

// ============================================================
//  Electron桌面端存档支持
// ============================================================
if(window.tianming&&window.tianming.isDesktop){

  // --- 主菜单显示/隐藏辅助 ---
  function showMain(){
    _$('lt-menu').style.display='';
    _$('main-view').style.display='none';
    _$('main-view').innerHTML='';
  }
  function showPanel(html){
    _$('lt-menu').style.display='none';
    _$('main-view').style.display='block';
    _$('main-view').innerHTML=html;
    _$('launch').style.display='flex';
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

// ============================================================
//  游戏内小地图
// ============================================================
// renderGameState 小地图装饰已合并到上方（约17787行），此处不再重复

function drawMinimap(){
  var c=_$("g-minimap");if(!c)return;
  if(!P.mapData || !P.mapData.regions || P.mapData.regions.length === 0) return;
  var ctx=c.getContext("2d");
  ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,c.width,c.height);
  var scale=c.width/(P.mapData.width||800);
  P.mapData.regions.forEach(function(r){
    ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle=r.color||"#c9a84c";
    if(r.type==="rect"&&r.rect){
      ctx.fillRect(r.rect.x*scale,r.rect.y*scale,r.rect.w*scale,r.rect.h*scale);
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font=Math.max(7,9*scale)+"px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,(r.rect.x+r.rect.w/2)*scale,(r.rect.y+r.rect.h/2)*scale+3);
    }else if(r.type==="point"&&r.point){
      ctx.globalAlpha=0.8;ctx.beginPath();ctx.arc(r.point.x*scale,r.point.y*scale,4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="7px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,r.point.x*scale,r.point.y*scale-7);
    }else if(r.type==="poly"&&r.points&&r.points.length>2){
      ctx.beginPath();ctx.moveTo(r.points[0][0]*scale,r.points[0][1]*scale);
      r.points.forEach(function(p){ctx.lineTo(p[0]*scale,p[1]*scale);});
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  });
}

// ============================================================
//  交互式地图系统
// ============================================================

var InteractiveMap = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  selectedRegion: null,
  hoveredRegion: null,

  // 初始化
  init: function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 绑定事件
    this.bindEvents();

    // 绘制地图
    this.draw();
  },

  // 绑定事件
  bindEvents: function() {
    var self = this;

    // 鼠标滚轮缩放
    this.canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? 0.9 : 1.1;
      var newScale = self.scale * delta;

      // 限制缩放范围
      if (newScale < 0.5) newScale = 0.5;
      if (newScale > 3) newScale = 3;

      // 计算缩放中心
      var rect = self.canvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      // 调整偏移以保持鼠标位置不变
      self.offsetX = mouseX - (mouseX - self.offsetX) * (newScale / self.scale);
      self.offsetY = mouseY - (mouseY - self.offsetY) * (newScale / self.scale);

      self.scale = newScale;
      self.draw();
    });

    // 鼠标拖拽平移
    this.canvas.addEventListener('mousedown', function(e) {
      self.isDragging = true;
      self.dragStartX = e.clientX - self.offsetX;
      self.dragStartY = e.clientY - self.offsetY;
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (self.isDragging) {
        self.offsetX = e.clientX - self.dragStartX;
        self.offsetY = e.clientY - self.dragStartY;
        self.draw();
      } else {
        // 检测悬停区域
        var rect = self.canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left - self.offsetX) / self.scale;
        var mouseY = (e.clientY - rect.top - self.offsetY) / self.scale;

        self.hoveredRegion = self.getRegionAt(mouseX, mouseY);
        self.draw();
      }
    });

    this.canvas.addEventListener('mouseup', function(e) {
      if (self.isDragging) {
        self.isDragging = false;
      } else {
        // 点击选择区域
        var rect = self.canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left - self.offsetX) / self.scale;
        var mouseY = (e.clientY - rect.top - self.offsetY) / self.scale;

        var region = self.getRegionAt(mouseX, mouseY);
        if (region) {
          self.selectedRegion = region;
          self.showRegionInfo(region);
          self.draw();
        }
      }
    });

    this.canvas.addEventListener('mouseleave', function() {
      self.isDragging = false;
      self.hoveredRegion = null;
      self.draw();
    });
  },

  // 获取指定坐标的区域
  getRegionAt: function(x, y) {
    if (!P.mapData || !P.mapData.regions) return null;

    for (var i = P.mapData.regions.length - 1; i >= 0; i--) {
      var r = P.mapData.regions[i];

      if (r.type === 'rect' && r.rect) {
        if (x >= r.rect.x && x <= r.rect.x + r.rect.w &&
            y >= r.rect.y && y <= r.rect.y + r.rect.h) {
          return r;
        }
      } else if (r.type === 'point' && r.point) {
        var dist = Math.sqrt(Math.pow(x - r.point.x, 2) + Math.pow(y - r.point.y, 2));
        if (dist <= 10) return r;
      } else if (r.type === 'poly' && r.points && r.points.length > 2) {
        if (this.isPointInPolygon(x, y, r.points)) return r;
      }
    }

    return null;
  },

  // 判断点是否在多边形内
  isPointInPolygon: function(x, y, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i][0], yi = points[i][1];
      var xj = points[j][0], yj = points[j][1];

      var intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  // 绘制地图
  draw: function() {
    if (!this.ctx || !P.mapData || !P.mapData.regions) return;

    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;

    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 应用变换
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 绘制所有区域
    P.mapData.regions.forEach(function(r) {
      var isSelected = this.selectedRegion && this.selectedRegion.name === r.name;
      var isHovered = this.hoveredRegion && this.hoveredRegion.name === r.name;

      ctx.save();

      // 设置透明度和颜色
      ctx.globalAlpha = isSelected ? 0.7 : (isHovered ? 0.5 : 0.35);
      ctx.fillStyle = r.color || '#c9a84c';

      // 绘制区域形状
      if (r.type === 'rect' && r.rect) {
        ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);

        // 绘制边框
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffd700' : '#fff';
          ctx.lineWidth = 2 / this.scale;
          ctx.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
        }

        // 绘制文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (14 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2 + 5);
      } else if (r.type === 'point' && r.point) {
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(r.point.x, r.point.y, 6 / this.scale, 0, Math.PI * 2);
        ctx.fill();

        // 绘制文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (12 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.point.x, r.point.y - 10 / this.scale);
      } else if (r.type === 'poly' && r.points && r.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(r.points[0][0], r.points[0][1]);
        r.points.forEach(function(p) {
          ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.fill();

        // 绘制边框
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffd700' : '#fff';
          ctx.lineWidth = 2 / this.scale;
          ctx.stroke();
        }

        // 计算中心点绘制文字
        var centerX = r.points.reduce(function(sum, p) { return sum + p[0]; }, 0) / r.points.length;
        var centerY = r.points.reduce(function(sum, p) { return sum + p[1]; }, 0) / r.points.length;

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (14 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, centerX, centerY + 5);
      }

      ctx.restore();
    }.bind(this));

    ctx.restore();

    // 绘制控制提示
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('滚轮缩放 | 拖拽平移', 20, 30);
    ctx.fillText('点击区域查看详情', 20, 50);
    ctx.fillText('缩放: ' + (this.scale * 100).toFixed(0) + '%', 20, 65);
  },

  // 显示区域信息
  showRegionInfo: function(region) {
    var infoDiv = document.getElementById('map-region-info');
    if (!infoDiv) return;

    var html = '<h4 style="color:var(--gold);margin-bottom:0.5rem;">' + region.name + '</h4>';

    // 显示控制者
    if (region.controller) {
      html += '<div style="margin-bottom:0.3rem;"><strong>控制者:</strong> ' + region.controller + '</div>';
    }

    // 显示人口
    if (region.population) {
      html += '<div style="margin-bottom:0.3rem;"><strong>人口:</strong> ' + region.population + '</div>';
    }

    // 显示收入
    if (region.income) {
      html += '<div style="margin-bottom:0.3rem;"><strong>收入:</strong> ' + region.income + '</div>';
    }

    // 显示描述
    if (region.desc) {
      html += '<div style="margin-top:0.5rem;color:var(--txt-d);font-size:0.85rem;">' + region.desc + '</div>';
    }

    infoDiv.innerHTML = html;
  }
};

// 打开交互式地图
function openInteractiveMap() {
  if (!P.mapData || !P.mapData.regions || P.mapData.regions.length === 0) {
    toast('❌ 当前剧本没有地图数据');
    return;
  }

  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'interactive-map-overlay';

  var html = '<div class="generic-modal" style="max-width:90vw;max-height:90vh;width:1200px;display:flex;flex-direction:column;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>🗺️ 交互式地图</h3>';
  html += '<button onclick="closeInteractiveMap()">✕</button>';
  html += '</div>';

  html += '<div style="flex:1;display:flex;overflow:hidden;">';

  // 左侧地图画布
  html += '<div style="flex:1;position:relative;">';
  html += '<canvas id="interactive-map-canvas" width="900" height="600" style="width:100%;height:100%;cursor:grab;"></canvas>';
  html += '</div>';

  // 右侧信息面板
  html += '<div style="width:280px;border-left:1px solid var(--bg-3);padding:1rem;overflow-y:auto;">';
  html += '<div id="map-region-info" style="color:var(--txt-d);font-size:0.9rem;">点击地图区域查看详情</div>';
  html += '</div>';

  html += '</div>';
  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);

  // 初始化交互式地图
  var canvas = document.getElementById('interactive-map-canvas');
  if (canvas) {
    InteractiveMap.init(canvas);
  }
}

function closeInteractiveMap() {
  var ov = document.getElementById('interactive-map-overlay');
  if (ov) ov.remove();
}

// ============================================================
//  音效和音乐系统
// ============================================================


