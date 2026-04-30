// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-player-settings.js — 导入导出 + 设置 + API 模型探测 (R127 从 tm-player-actions.js L1-500 拆出)
// 姊妹: tm-player-core.js (L501-3303·游戏控制+文苑+人物志)
//       tm-hongyan-office.js (L3304-end·鸿雁传书+官制)
// 包含: importSaveFile/doSaveGame/doSaveGameDesktop/openSettings/closeSettings/
//       _renderModelProbePanel/_probeRunContext/_probeRunOutput/_saveSecondaryAPI/
//       _toggleSecondaryEnabled/_testSecondaryAPI/_probeClearCache
// ============================================================

// ============================================================
function importSaveFile(){
  if(window.tianming&&window.tianming.isDesktop){
    window.tianming.dialogImport().then(function(res){
      if(!res||res.canceled||!res.success)return;
      try{
        var data=res.data;
        if(data.gameState){P=data;GM=data.gameState;GM.running=true;if(GM._rngState)restoreRng(GM._rngState);if(GM._warTruces && typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces);_$("launch").style.display="none";_$("bar").style.display="flex";_$("G").style.display="grid";enterGame();toast("\u2705 \u5DF2\u52A0\u8F7D");}
        else{P=data;loadT();toast("\u5DF2\u52A0\u8F7D\u9879\u76EE");showScnManage();}
      }catch(err){toast("\u5931\u8D25");}
    }).catch(function(){toast("\u5931\u8D25");});
    return;
  }
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    var r=new FileReader();r.onload=function(ev){
      try{
        var data=JSON.parse(ev.target.result);
        if(data.gameState){P=data;GM=data.gameState;GM.running=true;if(GM._rngState)restoreRng(GM._rngState);if(GM._warTruces && typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces);_$("launch").style.display="none";_$("bar").style.display="flex";_$("G").style.display="grid";enterGame();toast("\u2705 \u5DF2\u52A0\u8F7D");}
        else{P=data;loadT();toast("\u5DF2\u52A0\u8F7D\u9879\u76EE");showScnManage();}
      }catch(err){toast("\u5931\u8D25");}
    };r.readAsText(f);
  };inp.click();
}
function doSaveGame(){
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  var saveData=deepClone(P);saveData.gameState=deepClone(GM);
  if(window.tianming&&window.tianming.isDesktop){
    // 使用统一的存档系统
    doSaveGameDesktop();
    return;
  }
  showPrompt("\u5B58\u6863\u540D:","T"+GM.turn,function(name){if(!name)return;
  var b=new Blob([JSON.stringify(saveData,null,2)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name+".json";a.click();
  toast("\u2705 \u5DF2\u5BFC\u51FA");
  });
}


// 桌面版存档（使用统一的存档面板）
async function doSaveGameDesktop(){
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  var files=[];
  try{
    var r=await window.tianming.listProjects();
    if(r.success&&r.files)files=r.files;
  }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  var html='<div class="pnl">';
  html+='<div class="pnl-hd"><div><div class="pnl-t">\u4FDD\u5B58\u6E38\u620F</div>';
  html+='<div class="pnl-sub">\u5F53\u524D\u56DE\u5408: T'+GM.turn+'</div></div></div>';
  html+='<div class="fd full" style="margin-bottom:1.2rem">';
  html+='<label>\u5B58\u6863\u540D</label>';
  html+='<input id="save-name-inp" value="'+escHtml(GM.saveName||('T'+GM.turn))+'">';
  html+='</div>';
  html+='<button class="bt bp" style="margin-bottom:1.4rem" onclick="desktopDoSave()">\u2714 \u4FDD\u5B58</button>';
  if(files.length){
    html+='<div class="pnl-section">\u8986\u76D6\u73B0\u6709\u5B58\u6863</div>';
    html+='<div class="pnl-list" style="max-height:200px">';
    files.forEach(function(f){
      html+='<div class="pnl-row">';
      html+='<div class="pnl-row-info"><div class="pnl-row-name">'+f.name+'</div>';
      html+='<div class="pnl-row-meta">'+f.modifiedStr+'</div></div>';
      html+='<button class="bt bp bsm" onclick="_$(\\u0027save-name-inp\\u0027).value='+JSON.stringify(f.name).replace(/"/g,"&quot;")+';desktopDoSave()">覆盖</button>';
      html+='</div>';
    });
    html+='</div>';
  }
  html+='<div class="pnl-ft"><button class="bt bs" onclick="enterGame()">\u53D6\u6D88</button></div>';
  html+='</div>';
  showPanel(html);
  _$('G').style.display='none';
}

// ============================================================
//  设置弹窗
// ============================================================
// ⚠️⚠️⚠️ 警告：本函数被 tm-patches.js (line 89) openSettings=function(){...} 覆盖
//   实际运行的是 patches 版本·不是这里！要修改设置面板·请改 tm-patches.js
//   保留此函数仅为兼容·勿在此处增加新内容（已发生过 P15 错加在此从未生效·见 commit ad9ab79）
function openSettings(){
  var bg=_$("settings-bg");
  bg.innerHTML="<div class=\"settings-box\"><div style=\"padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;\"><div style=\"font-size:1.1rem;font-weight:700;color:var(--gold);\">\u2699 \u8BBE\u7F6E</div><button class=\"bt bs bsm\" onclick=\"closeSettings()\">\u2715</button></div><div class=\"settings-body\" id=\"settings-body\"></div></div>";

  var _imgApiCfg = {}; try { _imgApiCfg = JSON.parse(localStorage.getItem('tm_api_image') || '{}'); } catch(e) {}

  // M3·次要 API section·预先构造 HTML 字符串·避免 IIFE 异常打断 innerHTML 拼接
  var _secApiHtml = '';
  try {
    var _sec = (P.ai && P.ai.secondary) || {};
    var _hasKey = !!(_sec.key && _sec.url);
    var _enabled = !(P.conf && P.conf.secondaryEnabled === false); // 默认启用
    var _active = _hasKey && _enabled;
    var _esc = (typeof escHtml === 'function') ? escHtml : function(s){ return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
    var _badge;
    if (_active) _badge = '<span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(107,176,124,0.15);color:var(--celadon-400);font-size:0.68rem;font-weight:700;letter-spacing:0.05em;">\u25CF \u5DF2\u6FC0\u6D3B</span>';
    else if (_hasKey) _badge = '<span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(184,154,83,0.15);color:var(--gold);font-size:0.68rem;font-weight:700;letter-spacing:0.05em;">\u25CB \u5DF2\u914D\u00B7\u672A\u542F\u7528</span>';
    else _badge = '<span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:rgba(120,120,120,0.15);color:var(--txt-d);font-size:0.68rem;letter-spacing:0.05em;">\u25CB \u672A\u914D\u7F6E\u00B7\u5168\u8D70\u4E3B API</span>';
    var _desc = '\u7528\u4E8E\u95EE\u5BF9\u00B7\u4E09\u79CD\u671D\u8BAE\u00B7\u6587\u4E8B\u52BF\u529B\u5B50\u8C03\u7528\u7B49\u6B21\u8981\u573A\u666F\u3002\u4E3B\u63A8\u6F14\u59CB\u7EC8\u8D70\u4E3B API\u3002\u914D\u4E00\u4E2A\u5FEB\u800C\u4FBF\u5B9C\u7684\u6A21\u578B\u53EF\u5927\u5E45\u52A0\u901F\u00B7\u51CF\u5C11\u6210\u672C\u3002';
    var _disabledAttr = _hasKey ? '' : 'disabled ';
    var _disabledStyle = _hasKey ? '' : 'style="opacity:0.5;cursor:not-allowed;" ';
    _secApiHtml = '<div class="settings-section" style="border-left:3px solid #8a5cf5;background:rgba(138,92,245,0.03);">'+
      '<h4 style="display:flex;align-items:center;gap:0.5rem;color:#a585ff;"><span>\u6B21\u8981 API \u00B7 \u5FEB\u6A21\u578B\u8DEF\u7531</span>' + _badge + '</h4>'+
      '<div style="font-size:0.72rem;color:var(--ink-300);margin:-0.3rem 0 0.6rem;line-height:1.55;">' + _desc + '</div>'+
      '<div class="rw"><div class="fd"><label style="font-size:0.72rem;">Key</label><input type="password" id="s-sec-key" value="' + _esc(_sec.key||'') + '" placeholder="\u7559\u7A7A\u5219\u56DE\u9000\u4E3B API" style="font-size:0.8rem;"></div></div>'+
      '<div class="rw"><div class="fd"><label style="font-size:0.72rem;">URL</label><input id="s-sec-url" value="' + _esc(_sec.url||'') + '" placeholder="https://api.openai.com/v1" style="font-size:0.8rem;"></div><div class="fd"><label style="font-size:0.72rem;">\u6A21\u578B</label><input id="s-sec-model" value="' + _esc(_sec.model||'') + '" placeholder="gpt-4o-mini / haiku" style="font-size:0.8rem;"></div></div>'+
      '<div style="font-size:0.68rem;color:var(--ink-300);margin-bottom:0.5rem;">\u63A8\u8350\u5FEB\u6A21\u578B\uFF1Agpt-4o-mini \u00B7 claude-haiku-4-5 \u00B7 deepseek-chat \u00B7 gemini-2.5-flash</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+
        '<button class="bt bp bsm" onclick="_saveSecondaryAPI()">\u4FDD\u5B58\u6B21 API</button>'+
        '<button class="bt bs bsm" ' + _disabledStyle + _disabledAttr + 'onclick="_testSecondaryAPI()">\u2713 \u6D4B\u8BD5\u8FDE\u63A5</button>'+
        '<button class="bt bs bsm" ' + _disabledStyle + _disabledAttr + 'onclick="_showAvailableModels(\'secondary\')">\u5217\u6A21\u578B</button>'+
        '<label style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.72rem;color:var(--txt-d);margin-left:auto;">'+
          '<input type="checkbox" id="s-sec-enabled" ' + (_enabled?'checked ':'') + _disabledAttr + 'onchange="_toggleSecondaryEnabled(this.checked)"> \u542F\u7528</label>'+
        (_hasKey ? '<button class="bt bd bsm" onclick="if(confirm(\'\u786E\u5B9A\u6E05\u9664\u6B21 API \u914D\u7F6E\uFF1F\')){delete P.ai.secondary;saveP();toast(\'\u5DF2\u6E05\u9664\');closeSettings();openSettings();}">\u6E05\u9664</button>' : '') +
      '</div>'+
      (_hasKey ? ('<div style="margin-top:0.5rem;padding:0.4rem 0.5rem;background:rgba(138,92,245,0.06);border-left:2px solid #8a5cf5;border-radius:2px;font-size:0.7rem;color:var(--txt-d);line-height:1.6;">'+
        '<div><b style="color:#a585ff;">\u6FC0\u6D3B\u8DEF\u7531\uFF1A</b>\u95EE\u5BF9 \u00B7 \u5EF7\u8BAE \u00B7 \u5FA1\u524D \u00B7 \u5E38\u671D \u00B7 \u6587\u4E8B\u52BF\u529B\u00B7\u8FD9\u4E94\u7C7B\u9AD8\u9891\u5B50\u8C03\u7528\u5728\u542F\u7528\u65F6\u8D70\u6B21 API</div>'+
        '<div style="margin-top:0.2rem;"><b>\u4E3B API \u8D1F\u8D23\uFF1A</b>\u56DE\u5408\u4E3B\u63A8\u6F14(SC1/SC1b/SC1c) \u00B7 \u8BE2\u5929 \u00B7 \u8BE1\u5199\u6DF1\u5EA6\u6587\u672C</div>'+
      '</div>') : '')+
    '</div>';
  } catch(_secErr) {
    console.error('[openSettings] 次 API section 渲染异常:', _secErr);
    _secApiHtml = '<div class="settings-section" style="border-left:3px solid #8a5cf5;"><h4 style="color:#a585ff;">\u6B21\u8981 API\uFF08\u6E32\u67D3\u5F02\u5E38\uFF09</h4><div style="color:var(--vermillion-400);font-size:0.78rem;">' + (_secErr.message||_secErr) + '\u3002\u8BF7\u67E5\u63A7\u5236\u53F0\u3002</div></div>';
  }

  _$("settings-body").innerHTML=
    "<div class=\"settings-section\"><h4>\u4E3B API</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-key\" value=\""+(P.ai.key||"")+"\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-url\" value=\""+(P.ai.url||"")+"\" placeholder=\"https://api.openai.com/v1 \u6216\u4E2D\u8F6C\u7AD9URL\"></div><div class=\"fd\"><label>\u6A21\u578B</label><input id=\"s-model\" value=\""+(P.ai.model||"")+"\"></div></div>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin:-0.3rem 0 0.5rem;\">\u652F\u6301\u4EFB\u610F OpenAI \u517C\u5BB9\u4E2D\u8F6C\u7AD9\uFF0C\u5730\u5740\u586B\u5199 base URL \u5373\u53EF\u3002</div>"+
    "<button class=\"bt bp bsm\" onclick=\"_saveAPIAndAutoProbe()\">\u4FDD\u5B58\u5E76\u81EA\u52A8\u6821\u9A8C</button>"+
    "<button class=\"bt bs bsm\" onclick=\"P.ai.key=_$('s-key').value;P.ai.url=_$('s-url').value;P.ai.model=_$('s-model').value;try{localStorage.setItem('tm_api',JSON.stringify(P.ai));}catch(e){}if(window.tianming&&window.tianming.isDesktop){window.tianming.autoSave(P).catch(function(){});}saveP();toast('\u2705 \u5DF2\u4FDD\u5B58')\">\u4EC5\u4FDD\u5B58</button>"+
    "</div>"+

    _secApiHtml +

    // P15: 性能·成本控制 section
    (function(){
      try { console.log('[P15 settings] 性能·成本控制 段渲染中·v=2026050102'); } catch(_){}
      var _gateOn = !!(P.conf && P.conf.recallGateEnabled === true); // 默认 false
      var _consolOn = !(P.conf && P.conf.consolidationEnabled === false); // 默认 true
      var _semOn = !(P.conf && P.conf.semanticRecallAutoload === false); // 默认 true
      return '<div class="settings-section" style="border-left:3px solid #6b9eff;background:rgba(107,158,255,0.03);">' +
        '<h4 style="color:#9bbfff;">⚡ 性能·成本控制</h4>' +
        '<div style="font-size:0.72rem;color:var(--ink-300);margin:-0.3rem 0 0.6rem;line-height:1.55;">这些选项控制 AI 调用频率与资源使用·默认保守为质量优先。</div>' +

        // 召回节流开关（P14.5/P14.6 决策）
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
          '<input type="checkbox" id="s-recall-gate" ' + (_gateOn?'checked ':'') + 'onchange="_togglePConf(\'recallGateEnabled\',this.checked)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">启用召回节流（省 API）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">开启后·平常回合如未触发关键词（前朝/旧诏/卣宗）·未下诏·上回合无重大事件·且未到 6 回合刷新点·则跳过 SC_RECALL 5 源召回·节省 40-60% API 成本。关闭时（默认）每回合都跑全量召回·AI 记忆富度最高。</div>' +
          '</div>' +
        '</label>' +

        // 后台记忆固化开关
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;border-bottom:1px dotted var(--bdr);cursor:pointer;">' +
          '<input type="checkbox" id="s-consol" ' + (_consolOn?'checked ':'') + 'onchange="_togglePConf(\'consolidationEnabled\',this.checked,true)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">后台记忆固化 sc_consolidate（默认启用）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">每回合后台追加一次记忆整合调用（优先走次要 API）·不阻塞玩家·但会增加 ~20% API 成本。关闭后 AI 记忆连贯性限于原有 12 表 + sc_consolidated 会减低。</div>' +
          '</div>' +
        '</label>' +

        // 语义检索自动加载开关
        '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">' +
          '<input type="checkbox" id="s-sem" ' + (_semOn?'checked ':'') + 'onchange="_togglePConf(\'semanticRecallAutoload\',this.checked,true)" style="margin-top:0.15rem;flex-shrink:0;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;">本地语义检索自动加载（默认启用）</div>' +
            '<div style="font-size:0.7rem;color:var(--txt-d);line-height:1.55;margin-top:0.15rem;">进游戏 5 秒后后台加载 bge-small-zh 模型（23 MB）·提供 SC_RECALL 第 5 源语义同义召回。Electron 预打包后秒开·网页端首次需联网从 hf-mirror 缓存。关闭可节省 23 MB 下载·但会损失语义检索能力（“叛变”无法匹配“举旗/起兵）。</div>' +
          '</div>' +
        '</label>' +

      '</div>';
    })() +

    // 智能生图 API·独立 section
    "<div class=\"settings-section\"><h4>\u667A\u80FD\u751F\u56FE API\uFF08\u53EF\u9009\uFF09</h4>"+
    "<div style=\"font-size:0.7rem;color:var(--ink-300);margin:-0.3rem 0 0.5rem;\">\u7528\u4E8E\u4EBA\u7269\u7ACB\u7ED8\u7B49\u56FE\u7247\u751F\u6210\u00B7\u7559\u7A7A\u5219\u590D\u7528\u4E3B API</div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Key</label><input type=\"password\" id=\"s-img-key\" value=\""+(_imgApiCfg.key||'')+"\" placeholder=\"\u7559\u7A7A\u5219\u590D\u7528\u4E3B API\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">URL</label><input id=\"s-img-url\" value=\""+(_imgApiCfg.url||'')+"\" placeholder=\"https://api.openai.com/v1/images/generations\" style=\"font-size:0.8rem;\"></div><div class=\"fd\"><label style=\"font-size:0.72rem;\">\u6A21\u578B</label><input id=\"s-img-model\" value=\""+(_imgApiCfg.model||'dall-e-3')+"\" style=\"font-size:0.8rem;width:80px;\"></div></div>"+
    "<button class=\"bt bs bsm\" onclick=\"var ik=(_$('s-img-key')||{}).value||'',iu=(_$('s-img-url')||{}).value||'',im=(_$('s-img-model')||{}).value||'dall-e-3';try{if(ik||iu){localStorage.setItem('tm_api_image',JSON.stringify({key:ik.trim(),url:iu.trim(),model:im.trim()}));}else{localStorage.removeItem('tm_api_image');}}catch(_){}toast('\u751F\u56FEAPI\u5DF2\u4FDD\u5B58');\">\u4FDD\u5B58\u751F\u56FE\u8BBE\u7F6E</button></div>"+

    // 模型能力校验·防欺骗
    "<div class=\"settings-section\"><h4>\u6A21\u578B\u80FD\u529B\u6821\u9A8C</h4>"+
    "<div id=\"s-model-probe-body\">" + _renderModelProbePanel('primary') + '<div style="margin-top:0.4rem;"></div>' + _renderModelProbePanel('secondary') + "</div>"+
    // 主 API 操作
    "<div style=\"margin-top:0.6rem;padding:0.4rem;background:rgba(184,154,83,0.04);border-radius:3px;\">"+
    "<div style=\"font-size:0.7rem;color:var(--gold-d);margin-bottom:0.3rem;\">\u4E3B API \u64CD\u4F5C</div>"+
    "<div style=\"display:flex;gap:0.3rem;flex-wrap:wrap;\">"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunContext('primary')\">\u4E0A\u4E0B\u6587</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunOutput('primary')\">\u8F93\u51FA\u5B9E\u6D4B</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunSelfReport('primary')\">\u6A21\u578B\u81EA\u62A5</button>"+
    "<button class=\"bt bs bsm\" onclick=\"_showAvailableModels('primary')\">\u5217\u51FA\u53EF\u7528\u6A21\u578B</button>"+
    "</div></div>"+
    // 次 API 操作（若已配）
    "<div style=\"margin-top:0.4rem;padding:0.4rem;background:rgba(138,92,245,0.04);border-radius:3px;\">"+
    "<div style=\"font-size:0.7rem;color:var(--purple,#8a5cf5);margin-bottom:0.3rem;\">\u6B21 API \u64CD\u4F5C\uFF08\u672A\u914D\u5219\u6309\u94AE\u63D0\u9192\uFF09</div>"+
    "<div style=\"display:flex;gap:0.3rem;flex-wrap:wrap;\">"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunContext('secondary')\">\u4E0A\u4E0B\u6587</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunOutput('secondary')\">\u8F93\u51FA\u5B9E\u6D4B</button>"+
    "<button class=\"bt bp bsm\" onclick=\"_probeRunSelfReport('secondary')\">\u6A21\u578B\u81EA\u62A5</button>"+
    "<button class=\"bt bs bsm\" onclick=\"_showAvailableModels('secondary')\">\u5217\u51FA\u53EF\u7528\u6A21\u578B</button>"+
    "</div></div>"+
    "<div style=\"margin-top:0.4rem;\"><button class=\"bt bs bsm\" onclick=\"_probeClearCache()\">\u6E05\u9664\u63A2\u6D4B\u7F13\u5B58</button></div>"+
    "<div style=\"margin-top:0.5rem;display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;\">"+
    "<label style=\"font-size:0.72rem;color:var(--txt-d);\">\u624B\u52A8\u8986\u5199\u4E0A\u4E0B\u6587 K\uFF1A</label>"+
    "<input id=\"s-ctx-override\" type=\"number\" min=\"0\" value=\""+(P.conf.contextSizeK||0)+"\" placeholder=\"0\u8868\u81EA\u52A8\" style=\"width:90px;font-size:0.78rem;\">"+
    "<label style=\"font-size:0.72rem;color:var(--txt-d);\">\u8F93\u51FA\u4E0A\u9650 Tokens\uFF1A</label>"+
    "<input id=\"s-out-override\" type=\"number\" min=\"0\" value=\""+(P.conf.maxOutputTokens||0)+"\" placeholder=\"0\u8868\u81EA\u52A8\" style=\"width:110px;font-size:0.78rem;\">"+
    "<button class=\"bt bs bsm\" onclick=\"P.conf.contextSizeK=parseInt(_$('s-ctx-override').value)||0;P.conf.maxOutputTokens=parseInt(_$('s-out-override').value)||0;saveP();toast('\u2705 \u5DF2\u4FDD\u5B58\u624B\u52A8\u8986\u5199');_$('s-model-probe-body').innerHTML=_renderModelProbePanel();\">\u4FDD\u5B58</button>"+
    "</div>"+
    // G4·每回合 Token 预算上限·超支预警
    "<div style=\"margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--bdr);display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;\">"+
    "<label style=\"font-size:0.72rem;color:var(--txt-d);\">\u6BCF\u56DE\u5408 Token \u9884\u7B97\uFF1A</label>"+
    "<input id=\"s-turn-budget\" type=\"number\" min=\"0\" step=\"5000\" value=\""+(P.conf.turnTokenBudget||0)+"\" placeholder=\"0\u8868\u65E0\u4E0A\u9650\" style=\"width:130px;font-size:0.78rem;\">"+
    "<button class=\"bt bs bsm\" onclick=\"P.conf.turnTokenBudget=parseInt(_$('s-turn-budget').value)||0;saveP();toast(P.conf.turnTokenBudget?'\u2705 \u9884\u7B97\u8BBE\u4E3A '+P.conf.turnTokenBudget.toLocaleString():'\u2705 \u5DF2\u53D6\u6D88\u9884\u7B97\u9650\u5236');\">\u4FDD\u5B58</button>"+
    "<span style=\"font-size:0.68rem;color:var(--ink-300);\">\u8D85\u652F\u4F1A toast \u9884\u8B66\u00B7\u4E0D\u963B\u65AD\u6E38\u620F</span>"+
    "</div>"+
    // G5·模型档位·手动覆写 schema 裁剪策略
    "<div style=\"margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--bdr);display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;\">"+
    "<label style=\"font-size:0.72rem;color:var(--txt-d);\">\u6A21\u578B\u6863\u4F4D\uFF1A</label>"+
    "<select id=\"s-model-tier\" onchange=\"P.conf.modelTier=this.value||'auto';saveP();toast('\u5DF2\u5207\u6362\u6863\u4F4D\uFF1A'+(this.selectedOptions[0]||{}).text);\">"+
    "<option value=\"auto\""+((P.conf.modelTier||'auto')==='auto'?' selected':'')+">\u81EA\u52A8\uFF08\u6309\u6A21\u578B\u80FD\u529B\uFF09</option>"+
    "<option value=\"low\""+(P.conf.modelTier==='low'?' selected':'')+">\u4F4E\u6863\uFF08\u7EBF\u5B9A\u7CBE\u7B80\u00B7GPT-3.5/\u672C\u5730\u5C0F\u6A21\u578B\uFF09</option>"+
    "<option value=\"medium\""+(P.conf.modelTier==='medium'?' selected':'')+">\u4E2D\u6863\uFF08\u5355\u6B21 8K\u00B7\u4E2D\u7B49\u88C1\u526A\uFF09</option>"+
    "<option value=\"high\""+(P.conf.modelTier==='high'?' selected':'')+">\u9AD8\u6863\uFF08\u4E0D\u88C1\u526A\u00B7Claude/GPT-4o+\uFF09</option>"+
    "</select>"+
    "<span style=\"font-size:0.68rem;color:var(--ink-300);\">\u5F3A\u5236\u88C1\u526A SC1 schema\u00B7\u5F25\u8865\u81EA\u52A8\u68C0\u6D4B\u504F\u5DEE</span>"+
    "</div></div>"+

    "<div class=\"settings-section\"><h4>\u6587\u98CE</h4>"+
    "<div class=\"fd\"><label>\u5168\u5C40</label><select onchange=\"P.conf.style=this.value\"><option "+(P.conf.style==="\u6587\u5B66\u5316"?"selected":"")+">\u6587\u5B66\u5316</option><option "+(P.conf.style==="\u53F2\u4E66\u4F53"?"selected":"")+">\u53F2\u4E66\u4F53</option><option "+(P.conf.style==="\u622F\u5267\u5316"?"selected":"")+">\u622F\u5267\u5316</option></select></div></div>"+


    "<div class=\"settings-section\"><h4>\u96BE\u5EA6</h4>"+
    "<select onchange=\"P.conf.difficulty=this.value\"><option "+(P.conf.difficulty==="\u7B80\u5355"?"selected":"")+">\u7B80\u5355</option><option "+(P.conf.difficulty==="\u666E\u901A"?"selected":"")+">\u666E\u901A</option><option "+(P.conf.difficulty==="\u56F0\u96BE"?"selected":"")+">\u56F0\u96BE</option></select></div>"+

    // 1.6: Token消耗统计
    "<div class=\"settings-section\"><h4>AI \u8C03\u7528\u7EDF\u8BA1</h4>"+
    (function() {
      if (typeof TokenUsageTracker === 'undefined') return '<div style="color:var(--txt-d);font-size:0.8rem;">暂无数据</div>';
      var s = TokenUsageTracker.getStats();
      var family = (typeof ModelAdapter !== 'undefined') ? ModelAdapter.detectFamily(P.ai.model) : 'openai';
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.8rem;">'+
        '<div>输入Token: <b>'+s.promptTokens.toLocaleString()+'</b></div>'+
        '<div>输出Token: <b>'+s.completionTokens.toLocaleString()+'</b></div>'+
        '<div>总Token: <b>'+s.totalTokens.toLocaleString()+'</b></div>'+
        '<div>API调用次数: <b>'+s.totalCalls+'</b></div>'+
        '<div>预估费用('+family+'): <b>$'+s.estimatedCostUSD+'</b></div>'+
        '<div>本回合消耗: <b>'+TokenUsageTracker.getTurnUsage().toLocaleString()+'</b></div>'+
        '</div>';
    })()+
    "</div>"+

    // 8.6: 错误日志
    "<div class=\"settings-section\"><h4>\u8C03\u8BD5</h4>"+
    "<div style=\"display:flex;gap:0.5rem;flex-wrap:wrap;\">"+
    "<button class=\"bt bp bsm\" onclick=\"if(typeof runSelfTests==='function'){runSelfTests();toast('自检完成，查看控制台');}\">\u8FD0\u884C\u81EA\u68C0</button>"+
    "<button class=\"bt bp bsm\" onclick=\"if(typeof ErrorMonitor!=='undefined'){var t=ErrorMonitor.exportText();navigator.clipboard.writeText(t).then(function(){toast('错误日志已复制到剪贴板('+ErrorMonitor.count()+'条)')}).catch(function(){prompt('请手动复制:',t);});}else{toast('无错误监控');}\">"+"\u5BFC\u51FA\u9519\u8BEF\u65E5\u5FD7 "+(typeof ErrorMonitor!=='undefined'?'('+ErrorMonitor.count()+')':'')+"</button>"+
    "<button class=\"bt bp bsm\" onclick=\"if(typeof DebugLog!=='undefined'){DebugLog.enable('all');toast('已启用全部调试日志');}\">\u5F00\u542F\u8C03\u8BD5\u65E5\u5FD7</button>"+
    "</div></div>";

  bg.classList.add("show");
}
function closeSettings(){_$("settings-bg").classList.remove("show");}

// ============================================================
// 模型能力校验面板·防欺骗·M3 支持双 tier
// ============================================================
function _renderModelProbePanel(tier) {
  tier = tier || 'primary';
  var _sfx = tier === 'secondary' ? '_secondary' : '';
  var cfg = P.conf || {};
  var isSec = tier === 'secondary';
  var _hasKey = isSec ? !!(P.ai && P.ai.secondary && P.ai.secondary.key) : !!(P.ai && P.ai.key);
  if (isSec && !_hasKey) {
    return '<div style="font-size:0.74rem;padding:0.5rem 0.6rem;background:rgba(138,92,245,0.04);border-left:3px solid var(--purple,#8a5cf5);border-radius:2px;color:var(--txt-d);line-height:1.7;">' +
      '<b style="color:var(--purple,#8a5cf5);">\u3010\u6B21 API\u3011</b> \u672A\u914D\u7F6E\u00B7\u914D\u7F6E\u540E\u6B64\u5904\u5C06\u663E\u793A\u63A2\u6D4B\u7ED3\u679C\u3002' +
    '</div>';
  }
  var model = '(未配置)';
  if (isSec && P.ai.secondary && P.ai.secondary.model) model = P.ai.secondary.model;
  else if (!isSec) model = P.ai.model || '(未配置)';
  var wlCtxK = (typeof _matchModelCtx === 'function') ? _matchModelCtx(model) : 0;
  var wlOutK = (typeof _matchModelOutput === 'function') ? _matchModelOutput(model) : 0;
  var detCtx = cfg['_detectedContextK' + _sfx] || 0;
  var detOut = cfg['_detectedMaxOutput' + _sfx] || 0;
  var measOut = cfg['_measuredMaxOutput' + _sfx] || 0;
  var layer = cfg['_ctxDetectLayer' + _sfx] || '未探测';
  var probe = cfg._probeHistory || {};
  var self = isSec ? probe.selfReport_secondary : probe.selfReport;
  var out = isSec ? probe.outputLimit_secondary : probe.outputLimit;

  var _tierLbl = isSec ? '【次 API】' : '【主 API】';
  var h = '<div style="font-size:0.76rem;line-height:1.8;padding:0.4rem;background:' + (isSec?'rgba(138,92,245,0.04)':'rgba(184,154,83,0.04)') + ';border-left:3px solid ' + (isSec?'var(--purple,#8a5cf5)':'var(--gold-d)') + ';border-radius:2px;">';
  h += '<div><b>' + _tierLbl + ' \u5F53\u524D\u6A21\u578B\uFF1A</b><code style="color:var(--gold);">' + escHtml(model) + '</code></div>';
  h += '<div style="margin-top:0.4rem;display:grid;grid-template-columns:auto auto auto auto;gap:0.3rem 0.8rem;padding:0.4rem;background:var(--color-elevated);border-radius:3px;">';
  h += '<div style="color:var(--txt-d);">\u6765\u6E90</div><div style="color:var(--txt-d);">\u4E0A\u4E0B\u6587</div><div style="color:var(--txt-d);">\u8F93\u51FA\u4E0A\u9650</div><div style="color:var(--txt-d);">\u5907\u6CE8</div>';
  h += '<div>\u767D\u540D\u5355</div><div>' + (wlCtxK ? wlCtxK+'K' : '-') + '</div><div>' + (wlOutK ? wlOutK+'K' : '-') + '</div><div style="color:var(--txt-d);font-size:0.7rem;">\u6570\u636E\u5E93\u58F0\u79F0</div>';
  if (self) {
    h += '<div>AI\u81EA\u62A5</div>';
    h += '<div>' + (self.contextClaimedK ? self.contextClaimedK+'K' : '-') + '</div>';
    h += '<div>' + (self.outputClaimedK ? self.outputClaimedK+'K' : '-') + '</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">' + escHtml((self.modelClaimedName||'').slice(0,20)) + '</div>';
  }
  if (detCtx || detOut) {
    h += '<div>API\u63A2\u6D4B</div>';
    h += '<div>' + (detCtx ? detCtx+'K' : '-') + '</div>';
    h += '<div>' + (detOut ? Math.round(detOut/1024)+'K' : '-') + '</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">' + escHtml(layer) + '</div>';
  }
  if (out && out.realLimitTokens > 0) {
    h += '<div style="color:var(--gold);">\u5B9E\u6D4B</div>';
    h += '<div>-</div>';
    h += '<div style="color:var(--gold);">' + Math.round(out.realLimitTokens/1024*10)/10 + 'K</div>';
    h += '<div style="color:var(--txt-d);font-size:0.7rem;">\u771F\u5B9E\u4EA7\u51FA</div>';
  }
  h += '</div>';

  // 冲突警告
  var warns = [];
  if (self && self.warnings && self.warnings.length) warns = warns.concat(self.warnings);
  if (out && out.realLimitTokens > 0 && wlOutK > 0) {
    var measK = Math.round(out.realLimitTokens/1024);
    if (measK < wlOutK * 0.6) warns.push('\u5B9E\u6D4B\u8F93\u51FA ' + measK + 'K \u8FDC\u4F4E\u4E8E\u767D\u540D\u5355 ' + wlOutK + 'K\u00B7\u7591\u4EE3\u7406\u7F29\u6C34');
  }
  if (warns.length) {
    h += '<div style="margin-top:0.5rem;padding:0.4rem;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.72rem;color:var(--vermillion-400);">';
    h += '\u26A0 \u7591\u4F2A\u6216\u7F29\u6C34\u8B66\u544A\uFF1A';
    warns.forEach(function(w){ h += '<div style="padding-left:0.6rem;">\u00B7 ' + escHtml(w) + '</div>'; });
    h += '</div>';
  }

  // 当前生效值·按 tier 读
  var manualCtx = cfg['contextSizeK' + _sfx] || 0;
  var manualOut = cfg['maxOutputTokens' + _sfx] || 0;
  var effCtxK = manualCtx || detCtx || wlCtxK || 32;
  var effOutTok = manualOut || measOut || detOut || (wlOutK * 1024) || 0;
  h += '<div style="margin-top:0.5rem;padding:0.4rem;background:rgba(107,176,124,0.08);border-left:3px solid var(--celadon-400);border-radius:3px;font-size:0.72rem;">';
  h += '\u2713 \u5F53\u524D\u751F\u6548\uFF1A\u4E0A\u4E0B\u6587 <b>' + effCtxK + 'K</b>\u00B7\u8F93\u51FA\u4E0A\u9650 <b>' + (effOutTok ? effOutTok+' tokens' : '\u6A21\u578B\u81EA\u7531') + '</b>';
  if (manualCtx || manualOut) h += ' <span style="color:var(--gold);">(\u624B\u52A8\u8986\u5199)</span>';
  h += '</div>';
  h += '</div>';
  return h;
}

function _refreshBothProbePanels() {
  var el = _$('s-model-probe-body');
  if (!el) return;
  el.innerHTML = _renderModelProbePanel('primary') + '<div style="margin-top:0.4rem;"></div>' + _renderModelProbePanel('secondary');
}

function _tierHasKey(tier) {
  if (tier === 'secondary') return !!(P.ai && P.ai.secondary && P.ai.secondary.key);
  return !!(P.ai && P.ai.key);
}

async function _probeRunContext(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E' + (tier==='secondary'?'\u6B21\u8981':'\u4E3B') + ' API'); return; }
  toast('\u6B63\u5728\u63A2\u6D4B\u4E0A\u4E0B\u6587\u00B7' + (tier==='secondary'?'\u6B21 API':'\u4E3B API') + '\u2026');
  try {
    if (typeof detectModelContextSize !== 'function') { toast('\u63A2\u6D4B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
    await detectModelContextSize({ force: true, tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    toast('\u2705 \u4E0A\u4E0B\u6587\u63A2\u6D4B\u5B8C\u6210');
    _refreshBothProbePanels();
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u63A2\u6D4B\u5931\u8D25\uFF1A' + (e.message||e)); }
}

async function _probeRunOutput(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E ' + (tier==='secondary'?'\u6B21\u8981':'\u4E3B') + ' API'); return; }
  if (!confirm('\u5B9E\u6D4B\u8F93\u51FA\u4E0A\u9650\u4F1A\u8017 1-3 \u6B21\u957F\u7BC7\u8C03\u7528\u00B7\u7EE7\u7EED\uFF1F')) return;
  toast('\u6B63\u5728\u5B9E\u6D4B\u8F93\u51FA\u4E0A\u9650\u2026');
  try {
    if (typeof detectModelOutputLimit !== 'function') { toast('\u63A2\u6D4B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
    if (typeof showLoading === 'function') showLoading('\u5B9E\u6D4B\u8F93\u51FA\u4E2D\u2026', 20);
    await detectModelOutputLimit({ tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    toast('\u2705 \u8F93\u51FA\u4E0A\u9650\u5B9E\u6D4B\u5B8C\u6210');
    _refreshBothProbePanels();
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u5B9E\u6D4B\u5931\u8D25\uFF1A' + (e.message||e)); }
}

async function _probeRunSelfReport(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E ' + (tier==='secondary'?'\u6B21\u8981':'\u4E3B') + ' API'); return; }
  toast('\u6B63\u5728\u8BE2\u95EE\u6A21\u578B\u81EA\u62A5\u2026');
  try {
    if (typeof probeModelSelfReport !== 'function') { toast('\u63A2\u6D4B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
    if (typeof showLoading === 'function') showLoading('\u6A21\u578B\u81EA\u62A5\u4E2D\u2026', 30);
    var r = await probeModelSelfReport({ tier: tier, onProgress: function(msg){ if (typeof showLoading === 'function') showLoading(msg, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    var warnCt = (r && r.warnings && r.warnings.length) || 0;
    toast(warnCt ? ('\u26A0 \u5B8C\u6210\u00B7 ' + warnCt + ' \u6761\u7591\u4F2A\u8B66\u544A') : '\u2705 \u81EA\u62A5\u6821\u9A8C\u5B8C\u6210');
    _refreshBothProbePanels();
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u81EA\u62A5\u5931\u8D25\uFF1A' + (e.message||e)); }
}

// 新·列出 API 可用模型·弹窗展示
async function _showAvailableModels(tier) {
  tier = tier || 'primary';
  if (!_tierHasKey(tier)) { toast('\u8BF7\u5148\u914D\u7F6E ' + (tier==='secondary'?'\u6B21':'\u4E3B') + ' API'); return; }
  if (typeof listAvailableModels !== 'function') { toast('\u5217\u6A21\u578B\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
  if (typeof showLoading === 'function') showLoading('\u6B63\u5728\u62C9\u53D6\u6A21\u578B\u5217\u8868\u2026', 30);
  try {
    var models = await listAvailableModels({ tier: tier });
    if (typeof hideLoading === 'function') hideLoading();
    if (!models || !models.length) { toast('\u672A\u80FD\u83B7\u53D6\u6A21\u578B\u5217\u8868'); return; }
    // 弹窗展示
    var html = '<div class="modal-bg show" id="_modelListModal" onclick="if(event.target===this)this.remove()" style="z-index:9999;">';
    html += '<div class="modal-box" style="max-width:780px;max-height:80vh;overflow-y:auto;background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.5rem;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">';
    html += '<div style="font-size:1rem;font-weight:700;color:var(--gold);">' + (tier==='secondary'?'\u6B21':'\u4E3B') + ' API \u53EF\u7528\u6A21\u578B\uFF08\u5171 ' + models.length + ' \u4E2A\uFF09</div>';
    html += '<button class="bt bs bsm" onclick="document.getElementById(\'_modelListModal\').remove()">\u2715</button></div>';
    html += '<div style="font-size:0.7rem;color:var(--ink-300);margin-bottom:0.5rem;">\u2605 \u6807\u7B7E=\u5728\u767D\u540D\u5355\u00B7\u5DF2\u77E5\u80FD\u529B\uFF1B\u70B9\u51FB\u6A21\u578B ID \u5373\u53EF\u586B\u5165</div>';
    html += '<table style="width:100%;font-size:0.76rem;border-collapse:collapse;">';
    html += '<tr style="color:var(--txt-d);border-bottom:1px solid var(--bdr);"><td>\u6A21\u578B ID</td><td style="text-align:right;">\u4E0A\u4E0B\u6587</td><td style="text-align:right;">\u8F93\u51FA</td><td style="text-align:right;">\u64CD\u4F5C</td></tr>';
    models.forEach(function(m){
      var star = m.matched ? '<span style="color:var(--gold);">\u2605</span> ' : '';
      html += '<tr style="border-bottom:1px solid rgba(107,93,79,0.1);">';
      html += '<td style="padding:4px 0;"><code style="color:' + (m.matched?'var(--gold)':'var(--txt-s)') + ';">' + star + escHtml(m.id) + '</code>';
      if (m.ownedBy) html += '<span style="color:var(--ink-300);font-size:0.64rem;"> · ' + escHtml(m.ownedBy) + '</span>';
      html += '</td>';
      html += '<td style="text-align:right;padding:4px 0;">' + (m.contextK ? m.contextK+'K' : '-') + '</td>';
      html += '<td style="text-align:right;padding:4px 0;">' + (m.outputK ? m.outputK+'K' : '-') + '</td>';
      html += '<td style="text-align:right;padding:4px 0;">';
      var inputId = tier==='secondary' ? 's-sec-model' : 's-model';
      html += '<button class="bt bs bsm" onclick="var i=document.getElementById(\'' + inputId + '\');if(i){i.value=' + JSON.stringify(m.id).replace(/"/g,'&quot;') + ';toast(\'\u5DF2\u586B\u5165\u00B7\u8BF7\u70B9\u4FDD\u5B58\');}">\u9009\u6B64</button>';
      html += '</td></tr>';
    });
    html += '</table></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) {
    if (typeof hideLoading === 'function') hideLoading();
    toast('\u83B7\u53D6\u6A21\u578B\u5217\u8868\u5931\u8D25\uFF1A' + (e.message||e));
  }
}

// M3·保存次要 API 配置
function _saveSecondaryAPI() {
  var sk = (_$('s-sec-key')||{}).value || '';
  var su = (_$('s-sec-url')||{}).value || '';
  var sm = (_$('s-sec-model')||{}).value || '';
  if (sk || su || sm) {
    if (!P.ai) P.ai = {};
    P.ai.secondary = { key: sk.trim(), url: su.trim(), model: sm.trim() };
  } else {
    if (P.ai) delete P.ai.secondary;
  }
  try { localStorage.setItem('tm_api', JSON.stringify(P.ai)); } catch(_) {}
  if (typeof saveP === 'function') saveP();
  if (window.tianming && window.tianming.isDesktop) { try { window.tianming.autoSave(P).catch(function(){}); } catch(_){} }
  if (sk && su) toast('\u2705 \u6B21\u8981 API \u5DF2\u4FDD\u5B58\u00B7\u95EE\u5BF9/\u671D\u8BAE\u5C06\u8D70\u6B64\u914D\u7F6E');
  else toast('\u2705 \u5DF2\u6E05\u7A7A\u6B21\u8981 API\u00B7\u6240\u6709\u8C03\u7528\u56DE\u9000\u4E3B API');
  // 重新打开设置以刷新状态徽标和探测面板
  try { closeSettings(); openSettings(); } catch(_){}
}

// 次 API 启用开关·切换时即时生效
function _toggleSecondaryEnabled(on) {
  if (!P.conf) P.conf = {};
  P.conf.secondaryEnabled = !!on;
  if (typeof saveP === 'function') saveP();
  toast(on ? '\u2705 \u5DF2\u542F\u7528\u6B21 API\u00B7\u95EE\u5BF9/\u671D\u8BAE\u5C06\u8D70\u6B64\u8DEF' : '\u2705 \u5DF2\u5173\u95ED\u6B21 API\u00B7\u6240\u6709\u8C03\u7528\u56DE\u9000\u4E3B API');
  // 刷新设置面板以更新徽标
  try { closeSettings(); openSettings(); } catch(_){}
}
// P15: 通用 P.conf 字段开关·切换 boolean 值并保存
function _togglePConf(confKey, on) {
  if (!P.conf) P.conf = {};
  P.conf[confKey] = !!on;
  if (typeof saveP === 'function') saveP();
  var labels = {
    recallGateEnabled: { on: '已启用召回节流·常规回合跳过 SC_RECALL 节省 API', off: '已关闭召回节流·每回合都全跑 5 源召回' },
    consolidationEnabled: { on: '已启用后台记忆固化', off: '已关闭后台记忆固化·sc_consolidate 不再调用' },
    semanticRecallAutoload: { on: '已启用语义检索自动加载', off: '已关闭语义检索自动加载·SC_RECALL 第 5 源失效' }
  };
  var l = labels[confKey] || { on: '已启用 ' + confKey, off: '已关闭 ' + confKey };
  if (typeof toast === 'function') toast('✅ ' + (on ? l.on : l.off));
}


// 测试次 API 连接·发一条极短请求验证 key/url/model 可达
async function _testSecondaryAPI() {
  if (!(P.ai && P.ai.secondary && P.ai.secondary.key)) { toast('\u8BF7\u5148\u4FDD\u5B58\u6B21 API \u914D\u7F6E'); return; }
  if (typeof callAIMessages !== 'function') { toast('\u6D4B\u8BD5\u51FD\u6570\u672A\u52A0\u8F7D'); return; }
  if (typeof showLoading === 'function') showLoading('\u6B63\u5728\u6D4B\u8BD5\u6B21 API\u8FDE\u63A5\u2026', 20);
  var t0 = Date.now();
  try {
    // callAIMessages(messages, maxTok, signal, tier)
    var res = await callAIMessages([{ role:'user', content: '\u7528\u4E00\u4E2A\u6C49\u5B57\u56DE\u590D\uFF1A\u597D' }], 10, null, 'secondary');
    if (typeof hideLoading === 'function') hideLoading();
    var dt = Date.now() - t0;
    var text = typeof res === 'string' ? res : ((res && (res.content || res.text)) || '');
    toast('\u2713 \u6B21 API \u901A\u00B7' + dt + 'ms\u00B7\u6A21\u578B\u56DE\uFF1A' + (text||'').trim().slice(0,24));
  } catch(e) {
    if (typeof hideLoading === 'function') hideLoading();
    toast('\u2717 \u6B21 API \u6D4B\u8BD5\u5931\u8D25\uFF1A' + ((e && e.message)||e));
  }
}

// M2·保存 API 配置后自动跑一次上下文探测（轻量层 0-3·不跑实测以免烧钱）
async function _saveAPIAndAutoProbe() {
  var newKey = (_$('s-key')||{}).value||'';
  var newUrl = (_$('s-url')||{}).value||'';
  var newModel = (_$('s-model')||{}).value||'';
  var _changed = (P.ai.key !== newKey) || (P.ai.url !== newUrl) || (P.ai.model !== newModel);
  P.ai.key = newKey; P.ai.url = newUrl; P.ai.model = newModel;
  try { localStorage.setItem('tm_api', JSON.stringify(P.ai)); } catch(_) {}
  if (typeof saveP === 'function') saveP();
  if (window.tianming && window.tianming.isDesktop) { try { window.tianming.autoSave(P).catch(function(){}); } catch(_){} }
  if (!_changed) { toast('\u2705 \u5DF2\u4FDD\u5B58\uFF08\u914D\u7F6E\u672A\u53D8\uFF09'); return; }
  // 配置变化·清旧缓存·跑新探测
  delete P.conf._detectedContextK; delete P.conf._detectedMaxOutput; delete P.conf._measuredMaxOutput; delete P.conf._ctxCacheKey; delete P.conf._ctxDetectLayer; delete P.conf._probeHistory;
  if (!newKey) { toast('\u2705 \u5DF2\u4FDD\u5B58\uFF08\u672A\u914D key\u00B7\u8DF3\u8FC7\u81EA\u52A8\u6821\u9A8C\uFF09'); return; }
  toast('\u2705 \u5DF2\u4FDD\u5B58\u00B7\u6B63\u5728\u81EA\u52A8\u6821\u9A8C\u6A21\u578B\u00B7\u7A0D\u5019\u2026');
  try {
    if (typeof showLoading === 'function') showLoading('\u81EA\u52A8\u6821\u9A8C\u6A21\u578B\u80FD\u529B\u2026', 30);
    if (typeof detectModelContextSize === 'function') await detectModelContextSize({ force: true, onProgress: function(m){ if (typeof showLoading === 'function') showLoading(m, 50); } });
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof saveP === 'function') saveP();
    var el = _$('s-model-probe-body'); if (el) el.innerHTML = _renderModelProbePanel();
    var wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(newModel) : 0;
    var wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(newModel) : 0;
    if (wlCtx && wlOut) toast('\u2705 \u6A21\u578B\u5DF2\u8BC6\u522B\uFF1A\u4E0A\u4E0B\u6587 ' + wlCtx + 'K\u00B7\u8F93\u51FA ' + wlOut + 'K');
    else toast('\u26A0 \u672A\u5728\u767D\u540D\u5355\u00B7\u5DF2\u8FD4\u56DE\u63A2\u6D4B\u7ED3\u679C\u00B7\u5EFA\u8BAE\u624B\u52A8\u8DD1"\u5B9E\u6D4B\u8F93\u51FA\u4E0A\u9650"');
  } catch(e) { if (typeof hideLoading === 'function') hideLoading(); toast('\u26A0 \u81EA\u52A8\u6821\u9A8C\u5931\u8D25\uFF1A' + (e.message||e)); }
}

function _probeClearCache() {
  if (!confirm('\u6E05\u9664\u6240\u6709\u63A2\u6D4B\u7F13\u5B58\uFF1F\u4E0B\u6B21\u5C06\u91CD\u65B0\u63A2\u6D4B\u3002')) return;
  delete P.conf._detectedContextK;
  delete P.conf._detectedMaxOutput;
  delete P.conf._measuredMaxOutput;
  delete P.conf._ctxCacheKey;
  delete P.conf._ctxDetectLayer;
  delete P.conf._probeHistory;
  if (typeof saveP === 'function') saveP();
  toast('\u5DF2\u6E05\u9664\u63A2\u6D4B\u7F13\u5B58');
  var el = _$('s-model-probe-body'); if (el) el.innerHTML = _renderModelProbePanel();
}

