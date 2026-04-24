// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-player-actions.js — 玩家操作 & 结算管道（R111 从 tm-game-engine.js L1141-7013 拆出）
//  姊妹文件: tm-launch.js (L1-1140) + tm-game-loop.js (L7014-end)
//  包含: 导入导出·设置面板·玩家操作工具·结算管道注册
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

    // 智能生图 API·独立 section
    "<div class=\"settings-section\"><h4>\u667A\u80FD\u751F\u56FE API\uFF08\u53EF\u9009\uFF09</h4>"+
    "<div style=\"font-size:0.7rem;color:var(--ink-300);margin:-0.3rem 0 0.5rem;\">\u7528\u4E8E\u4EBA\u7269\u7ACB\u7ED8\u7B49\u56FE\u7247\u751F\u6210\u00B7\u7559\u7A7A\u5219\u590D\u7528\u4E3B API</div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Key</label><input type=\"password\" id=\"s-img-key\" value=\""+(_imgApiCfg.key||'')+"\" placeholder=\"\u7559\u7A7A\u5219\u590D\u7528\u4E3B API\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">URL</label><input id=\"s-img-url\" value=\""+(_imgApiCfg.url||'')+"\" placeholder=\"https://api.openai.com/v1/images/generations\" style=\"font-size:0.8rem;\"></div><div class=\"fd\"><label style=\"font-size:0.72rem;\">\u6A21\u578B</label><input id=\"s-img-model\" value=\""+(_imgApiCfg.model||'dall-e-3')+"\" style=\"font-size:0.8rem;width:80px;\"></div></div>"+
    "<button class=\"bt bs bsm\" onclick=\"var ik=(_$('s-img-key')||{}).value||'',iu=(_$('s-img-url')||{}).value||'',im=(_$('s-img-model')||{}).value||'dall-e-3';if(ik||iu){localStorage.setItem('tm_api_image',JSON.stringify({key:ik.trim(),url:iu.trim(),model:im.trim()}));}else{localStorage.removeItem('tm_api_image');}toast('\u751F\u56FEAPI\u5DF2\u4FDD\u5B58');\">\u4FDD\u5B58\u751F\u56FE\u8BBE\u7F6E</button></div>"+

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

// ============================================================
//  ESC暂停菜单
// ============================================================
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    e.preventDefault();
    // 2.8: 逐层关闭弹窗
    var _renwuOv=document.getElementById('_renwuPageOv');if(_renwuOv&&_renwuOv.classList.contains('open')){_renwuOv.classList.remove('open');return;}
    var _charPop=document.querySelector('.char-popup');if(_charPop){_charPop.remove();return;}
    var _urgentPop=document.querySelector('.notify-urgent');if(_urgentPop){_urgentPop.classList.add('closing');setTimeout(function(){_urgentPop.remove();},300);return;}
    if(_$("turn-modal").classList.contains("show")){closeTurnResult();return;}
    if(_$("settings-bg").classList.contains("show")){closeSettings();return;}
    if(_$("pause-bg").classList.contains("show")){closePause();return;}
    if(GM.running){openPause();return;}
    openSettings();return;
  }
  // 4.3: 快捷键系统（仅在游戏中且无弹窗时生效）
  if(!GM.running)return;
  if(_$("settings-bg").classList.contains("show")||_$("pause-bg").classList.contains("show"))return;
  if(_$("turn-modal").classList.contains("show"))return;
  if(document.querySelector('.modal-bg.show'))return;
  // 不在输入框中时才响应
  var tag=(document.activeElement||{}).tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  // 数字键1-9切标签
  var _tabMap={'1':'gt-edict','2':'gt-memorial','3':'gt-wendui','4':'gt-letter','5':'gt-biannian','6':'gt-office','7':'gt-qiju','8':'gt-jishi','9':'gt-shiji'};
  if(_tabMap[e.key]){var _tb=document.querySelector('.g-tab-btn');if(_tb)switchGTab(null,_tabMap[e.key]);return;}
  // Ctrl+S快速存档
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(typeof openSaveManager==='function')openSaveManager();return;}
});
function openPause(){
  // 回合推演中禁止暂停（防止状态竞争）
  if (GM._endTurnBusy) return;
  var _pi = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  _$("pause-bg").innerHTML="<div class=\"pause-menu\"><div class=\"pause-title\">\u3014 \u5929 \u547D \u3015</div><button class=\"pause-btn\" onclick=\"closePause()\">\u7EE7 \u7EED</button><button class=\"pause-btn\" onclick=\"closePause();openSaveManager()\">"+_pi('save',16)+" \u6848\u5377\u7BA1\u7406</button><button class=\"pause-btn\" onclick=\"closePause();openSettings()\">"+_pi('settings',16)+" \u8BBE \u7F6E</button><button class=\"pause-btn\" onclick=\"closePause();openShiji()\">"+_pi('history',16)+" \u53F2 \u8BB0</button><button class=\"pause-btn\" onclick=\"closePause();openAbdication()\">\u7985\u8BA9\u9000\u4F4D</button><button class=\"pause-btn\" style=\"color:var(--vermillion-400);\" onclick=\"closePause();backToLaunch()\">\u5F52\u53BB\u6765\u516E</button></div>";
  _$("pause-bg").classList.add("show");
}
function closePause(){_$("pause-bg").classList.remove("show");}

// N8: 退位/禅让系统
function openAbdication() {
  var pc = GM.chars && GM.chars.find(function(c){ return c.isPlayer; });
  if (!pc) { toast('未找到玩家角色'); return; }
  // 候选继承人：同势力存活角色
  var candidates = (GM.chars || []).filter(function(c) {
    return c.alive !== false && !c.isPlayer && c.faction === pc.faction;
  }).sort(function(a, b) { return (b.rankLevel || 9) - (a.rankLevel || 9); });
  var html = '<div style="padding:1.5rem;max-width:480px;">';
  html += '<div style="text-align:center;margin-bottom:1rem;"><div style="font-size:1.2rem;color:var(--gold);font-weight:700;">\u7985\u8BA9\u9000\u4F4D</div>';
  html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-top:0.3rem;">\u5C06\u5929\u5B50\u4E4B\u4F4D\u4F20\u4E88\u540E\u4EBA\uFF0C\u6B64\u4E3E\u4E0D\u53EF\u9006</div></div>';
  if (candidates.length === 0) {
    html += '<div style="color:var(--vermillion-400);text-align:center;">无合适继承人</div>';
  } else {
    html += '<div style="max-height:250px;overflow-y:auto;">';
    candidates.slice(0, 10).forEach(function(c, i) {
      var intel = c.intelligence || 50, admin = c.administration || 50;
      var _safeName = escHtml(c.name).replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;margin-bottom:0.3rem;background:var(--bg-2);border-radius:6px;cursor:pointer;" onclick="_confirmAbdication(\'' + _safeName + '\')">';
      html += '<div><div style="font-size:0.85rem;font-weight:700;">' + escHtml(c.name) + '</div><div style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(c.title || '') + ' \u667A' + intel + ' \u653F' + admin + '</div></div>';
      html += '<span style="font-size:0.75rem;color:var(--gold);">\u9009\u62E9</span></div>';
    });
    html += '</div>';
  }
  html += '<button class="bt bs" style="width:100%;margin-top:0.8rem;" onclick="this.closest(\'.modal-bg\').remove();">\u53D6\u6D88</button>';
  html += '</div>';
  var ov = document.createElement('div');
  ov.className = 'modal-bg show';
  ov.innerHTML = '<div class="modal" style="max-width:500px;">' + html + '</div>';
  document.body.appendChild(ov);
}
function _confirmAbdication(heirName) {
  if (!confirm('\u786E\u5B9A\u5C06\u5E1D\u4F4D\u7985\u8BA9\u7ED9' + heirName + '\uFF1F\u6B64\u4E3E\u4E0D\u53EF\u64A4\u56DE\u3002')) return;
  var pc = GM.chars.find(function(c){ return c.isPlayer; });
  var heir = findCharByName(heirName);
  if (!pc || !heir) return;
  // 禅让
  pc.isPlayer = false;
  pc.title = (pc.title || '') + '（太上皇）';
  heir.isPlayer = true;
  // 更新P.playerInfo——用继承人数据替换旧玩家信息
  P.playerInfo.characterName = heir.name;
  P.playerInfo.characterTitle = heir.title || heir.officialTitle || '';
  P.playerInfo.characterBio = heir.bio || '';
  P.playerInfo.characterPersonality = heir.personality || '';
  if (heir.faction) P.playerInfo.factionName = heir.faction;
  // 更新年号提示
  if (typeof addEB === 'function') addEB('\u7985\u8BA9', pc.name + '\u7985\u8BA9\u5E1D\u4F4D\u4E8E' + heir.name);
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
    NpcMemorySystem.addMemory(heir.name, '\u7EE7\u627F\u5E1D\u4F4D\uFF0C\u767B\u57FA\u79F0\u5E1D', 10, 'career');
  }
  // 关闭弹窗
  document.querySelectorAll('.modal-bg').forEach(function(m){ m.remove(); });
  toast('\u7985\u8BA9\u5B8C\u6210\uFF0C' + heir.name + '\u5DF2\u7EE7\u4F4D');
  if (typeof renderGameState === 'function') renderGameState();
}

// 史记浮动按钮
var _shijiPage=0,_shijiKw='',_shijiPageSize=10;
function openShiji(){
  if(!GM.shijiHistory||GM.shijiHistory.length===0){showTurnResult("<div style='text-align:center;padding:2rem;color:var(--txt-d);'>\u5c1a\u65e0\u53f2\u8bb0</div>");return;}
  _shijiPage=0;_shijiKw='';
  _renderShijiPanel();
}
function _renderShijiPanel(){
  var all=GM.shijiHistory.slice().reverse();
  var kw=(_shijiKw||'').trim().toLowerCase();
  var filtered=kw?all.filter(function(sj){return (sj.shizhengji||'').toLowerCase().indexOf(kw)>=0||(sj.time||'').toLowerCase().indexOf(kw)>=0||String(sj.turn).indexOf(kw)>=0;}):all;
  var total=filtered.length;
  var pages=Math.ceil(total/_shijiPageSize)||1;
  if(_shijiPage>=pages)_shijiPage=pages-1;
  var slice=filtered.slice(_shijiPage*_shijiPageSize,(_shijiPage+1)*_shijiPageSize);
  var html='<div style="display:flex;flex-direction:column;height:100%;">';
  // header
  html+='<div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0.8rem;border-bottom:1px solid var(--bdr);flex-shrink:0">';
  html+='<strong style="color:var(--gold);font-size:1.05rem;">\u53f2\u8bb0 / \u8d77\u5c45\u6ce8</strong>';
  html+='<input id="shiji-kw" class="fd" style="flex:1;font-size:0.85rem" placeholder="\u641c\u7d22\u5173\u952e\u8bcd\u2026" value="'+(_shijiKw||'').replace(/"/g,'&quot;')+'" oninput="_shijiKw=this.value;_shijiPage=0;_renderShijiPanel()">';
  html+='<button class="bt bs bsm" onclick="_shijiExport()" title="\u5bfc\u51fa">\u2193 \u5bfc\u51fa</button>';
  html+='<button class="bt bs bsm" onclick="_historyCompare()" title="\u4E0E\u771F\u5B9E\u5386\u53F2\u5BF9\u6BD4">\u2696 \u5386\u53F2\u5BF9\u6BD4</button>';
  html+='<button class="bt bs bsm" onclick="closeTurnResult()">\u2715</button>';
  html+='</div>';
  // list
  html+='<div style="flex:1;overflow-y:auto;padding:0.5rem 0.8rem">';
  if(!slice.length){html+='<div style="text-align:center;padding:2rem;color:var(--txt-d);">\u65e0\u5339\u914d\u7ed3\u679c</div>';}
  slice.forEach(function(sj,i){
    var realIdx=GM.shijiHistory.length-1-(all.indexOf(sj));
    html+='<div class="cd" style="cursor:pointer;margin-bottom:0.4rem" onclick="_shijiShowDetail('+realIdx+')">';
    html+='<div style="display:flex;justify-content:space-between"><strong style="color:var(--gold-l)">T'+sj.turn+'</strong><span style="font-size:0.78rem;color:var(--txt-d)">'+sj.time+'</span></div>';
    html+='<div style="font-size:0.82rem;color:var(--txt-s);margin-top:0.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(sj.shizhengji||'')+'</div>';
    html+='</div>';
  });
  html+='</div>';
  // footer pagination
  html+='<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.5rem;border-top:1px solid var(--bdr);flex-shrink:0">';
  html+='<button class="bt bs bsm" '+((_shijiPage<=0)?'disabled':'')+' onclick="_shijiPage--;_renderShijiPanel()">\u2039</button>';
  html+='<span style="font-size:0.82rem;color:var(--txt-s)">'+(_shijiPage+1)+' / '+pages+'&nbsp;&nbsp;('+total+'\u6761)</span>';
  html+='<button class="bt bs bsm" '+((_shijiPage>=pages-1)?'disabled':'')+' onclick="_shijiPage++;_renderShijiPanel()">\u203a</button>';
  html+='</div>';
  html+='</div>';
  showTurnResult(html);
}
function _shijiShowDetail(idx){
  var sj=GM.shijiHistory[idx];
  if(!sj)return;
  var backBtn='<div style="text-align:center;margin-top:1rem"><button class="bt bs bsm" onclick="_renderShijiPanel()">\u8fd4\u56de\u5217\u8868</button></div>';
  showTurnResult((sj.html||'')+backBtn);
}
function _shijiExport(){
  var all=GM.shijiHistory.slice();
  var txt=all.map(function(sj){return '[T'+sj.turn+'] '+sj.time+'\n'+(sj.shizhengji||'');}).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('\u2705 \u5df2\u590d\u5236\u5230\u526a\u8d34\u677f');}).catch(function(){_shijiDownload(txt);});}
  else _shijiDownload(txt);
}
// E11: 历史对比——调用AI比较游戏进程与真实历史
function _historyCompare() {
  if (!P.ai || !P.ai.key) { toast('需要配置AI才能使用历史对比'); return; }
  var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
  var dynasty = (sc && sc.dynasty) || P.dynasty || '';
  var era = (sc && sc.era) || '';
  var turnInfo = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
  // 收集游戏关键事件摘要
  var eventSummary = (GM.shijiHistory || []).slice(-5).map(function(sj) {
    return 'T' + sj.turn + '(' + sj.time + '): ' + (sj.shizhengji || '');
  }).join('\n');
  var currentState = '';
  if (GM.eraState) currentState += '阶段：' + (GM.eraState.dynastyPhase || '?');
  var factions = (GM.facs || []).map(function(f) { return f.name + '(实力' + (f.strength||50) + ')'; }).join('、');

  var prompt = '你是一位历史学家。以下是一个' + dynasty + (era ? '·' + era : '') + '时期的历史模拟游戏当前状态（' + turnInfo + '，第' + GM.turn + '回合）：\n\n'
    + '【当前国势】' + currentState + '\n'
    + '【各方势力】' + factions + '\n'
    + '【近期大事】\n' + eventSummary + '\n\n'
    + '请对比真实历史中同一时期实际发生的事件，分析：\n'
    + '1. 哪些方面与真实历史一致\n'
    + '2. 哪些方面出现了重大偏差（蝴蝶效应）\n'
    + '3. 如果继续按此趋势发展，历史走向会如何变化\n\n'
    + '用300-500字回答，注明具体史实依据。';

  // 显示loading
  showTurnResult('<div style="text-align:center;padding:3rem;"><div style="color:var(--gold);font-size:1rem;margin-bottom:1rem;">\u2696 \u5386\u53F2\u5BF9\u6BD4\u5206\u6790\u4E2D\u2026\u2026</div><div style="color:var(--txt-d);font-size:0.8rem;">AI\u6B63\u5728\u6BD4\u8F83\u6E38\u620F\u8FDB\u7A0B\u4E0E\u771F\u5B9E\u5386\u53F2</div></div>');

  callAI(prompt, 1500).then(function(resp) {
    var html = '<div style="padding:1rem;">';
    html += '<h3 style="color:var(--gold);margin-bottom:1rem;">\u2696 \u5386\u53F2\u5BF9\u6BD4\u5206\u6790</h3>';
    html += '<div style="font-size:0.85rem;color:var(--txt-s);line-height:1.8;white-space:pre-wrap;">' + escHtml(resp) + '</div>';
    html += '<div style="text-align:center;margin-top:1rem;"><button class="bt bs" onclick="_renderShijiPanel()">返回史记</button></div>';
    html += '</div>';
    showTurnResult(html);
  }).catch(function(err) {
    showTurnResult('<div style="text-align:center;padding:2rem;color:var(--red);">历史对比失败：' + escHtml(err.message) + '<br><button class="bt bs" onclick="_renderShijiPanel()">返回</button></div>');
  });
}

function _shijiDownload(txt){
  var a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='shiji_'+(GM.saveName||'export')+'.txt';
  a.click();
  toast('\u2705 \u5df2\u5bfc\u51fa');
}

// ============================================================
//  启动时加载API配置
// ============================================================
(function(){
  function _applyAiCfg(c) {
    if (!c) return;
    P.ai.key   = c.key   || P.ai.key   || "";
    P.ai.url   = c.url   || P.ai.url   || "";
    P.ai.model = c.model || P.ai.model || "";
    if (c.temp != null) P.ai.temp = parseFloat(c.temp) || 0.8;
    if (c.tok != null) P.ai.tok = parseInt(c.tok, 10) || 2000;
    if (c.mem != null) P.ai.mem = parseInt(c.mem, 10) || 20;
    if (c.prompt != null) P.ai.prompt = c.prompt;
    if (c.rules != null) P.ai.rules = c.rules;
  }
  if(window.tianming&&window.tianming.isDesktop){
    window.tianming.loadAutoSave().then(function(res){
      if(res&&res.success&&res.data&&res.data.ai) _applyAiCfg(res.data.ai);
    }).catch(function(e){ console.warn("[catch] async:", e); });
    return;
  }
  try{var s=localStorage.getItem("tm_api");if(s){_applyAiCfg(JSON.parse(s));}}
  catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
})();

// ============================================================
//  Electron集成
// ============================================================
// Desktop标记已移至问天按钮区域，不再需要修改logo
// ============================================================
//  Part 2：游戏引擎核心函数
// ============================================================

// 地图状态变量
var mapTool="rect",mapDrawing=false,mapStart=null,mapSelIdx=-1,mapPolyPts=[];

// 事件类型图标
// ─ 常规条目类型（朝代/人事/军事等）
// ─ 风闻类条目（告状/风议/密札/耳报）——非正式渠道情报，严格史实模式下的主要识腐来源
var _EVT_ICONS=(typeof tmIcon==='function')?{'朝代':tmIcon('prestige',14),'人事':tmIcon('office',14),'任命':tmIcon('memorial',14),'罢免':tmIcon('close',14),'赏赐':tmIcon('treasury',14),'惩罚':tmIcon('execution',14),'死亡':tmIcon('close',14),
  '事件':tmIcon('event',14),'军事':tmIcon('troops',14),'封臣危机':tmIcon('faction',14),'时代':tmIcon('chronicle',14),'时代趋势':tmIcon('history',14),'完成':tmIcon('policy',14),'诏令意图':tmIcon('scroll',14),
  '群体不满':tmIcon('unrest',14),'改革反弹':tmIcon('strife',14),'官制危机':tmIcon('unrest',14),
  // ═══ 风闻四类（登闻鼓/士林/门生/内廷） ═══
  '告状':tmIcon('drum',14),'风议':tmIcon('rumor',14),'密札':tmIcon('letter',14),'耳报':tmIcon('whisper',14)}:{};

// 可信度标签（风闻类条目专用）
var _CRED_META = {
  'high':   { label:'\u53EF\u4FE1',       color:'var(--green)' },  // 可信（钦差/账册/确证）
  'medium': { label:'\u53C2\u8003',       color:'var(--gold)'  },  // 参考（士林风议/部分证据）
  'low':    { label:'\u98CE\u95FB',       color:'var(--txt-d)' },  // 风闻（流言/未核实）
  'biased': { label:'\u504F\u9882',       color:'var(--purple,#8a5cf5)' } // 偏颇（宦官耳报/党人揭发）
};

function _fmtEvt(e){
  var icon=_EVT_ICONS[e.type]||'•';
  var credHtml='';
  if (e.credibility && _CRED_META[e.credibility]) {
    var cm = _CRED_META[e.credibility];
    credHtml = ' <span style="font-size:0.62rem;color:'+cm.color+';border:1px solid '+cm.color+';padding:0 3px;border-radius:2px;margin-left:2px;">'+cm.label+'</span>';
  }
  return "<div style=\"padding:0.3rem 0;font-size:0.78rem;border-bottom:1px solid rgba(42,42,62,0.3);\">"+
    "<span style=\"margin-right:3px;\">"+icon+"</span>"+
    "<span class=\"tg\">"+escHtml(e.type)+"</span>"+credHtml+" "+escHtml(e.text)+
    " <span style=\"color:var(--txt-d);font-size:0.65rem;\">"+escHtml(e.time||'')+"</span></div>";
}

// 风闻录事（原"大事记"）
// @param {string} type - 事件类型（朝代/人事/…/告状/风议/密札/耳报）
// @param {string} text - 事件文本
// @param {Object} [opts] - 可选字段：{credibility, subject, source, ref}
//   credibility: 'high'|'medium'|'low'|'biased' —— 风闻四类建议填写
//   subject: 被指涉的角色ID（可点击查看）
//   source: 情报来源角色ID（门生/御史/宦官）
//   ref: 关联的弹章/案件id
function addEB(type,text,opts){
  var entry = {turn:GM.turn,type:type,text:text,time:getTSText(GM.turn)};
  if (opts) {
    if (opts.credibility) entry.credibility = opts.credibility;
    if (opts.subject)     entry.subject     = opts.subject;
    if (opts.source)      entry.source      = opts.source;
    if (opts.ref)         entry.ref         = opts.ref;
  }
  GM.evtLog.push(entry);
  // 防止evtLog无限增长——保留最近500条
  if (GM.evtLog.length > 500) GM.evtLog = GM.evtLog.slice(-300);
  var el=_$("evt-log");
  if(el)el.innerHTML=GM.evtLog.slice(-20).reverse().map(_fmtEvt).join("");
}

// 添加事件日志（用于监听系统）
function addEventLog(text) {
  addEB('系统', text);
}

// 游戏标签切换
function switchGTab(btn,panelId){
  document.querySelectorAll(".g-tab-btn").forEach(function(b){b.classList.remove("active");});
  document.querySelectorAll(".g-tab-panel").forEach(function(p){p.style.display="none";});
  if(btn)btn.classList.add("active");
  var panel=_$(panelId);if(panel)panel.style.display=(panelId==='gt-letter'?'flex':'block');
  // 切换到诏令tab时刷新建议库
  if(panelId==='gt-edict' && typeof _renderEdictSuggestions==='function') _renderEdictSuggestions();
  // 切换到鸿雁传书tab时刷新面板
  if(panelId==='gt-letter' && typeof renderLetterPanel==='function') renderLetterPanel();
  // 切换到官制tab时重绘树状图（panel可能首次渲染时尺寸计算失败）
  if(panelId==='gt-office' && typeof renderOfficeTree==='function') {
    // 延迟确保 display:block 已生效，SVG 尺寸能正确计算
    setTimeout(function(){ try { renderOfficeTree(); } catch(e) { console.error('[OfficeTree]', e); } }, 30);
  }
  // 切换到文苑tab时渲染作品列表
  if(panelId==='gt-wenyuan' && typeof renderWenyuan==='function') {
    setTimeout(function(){ try { renderWenyuan(); } catch(e) { console.error('[Wenyuan]', e); } }, 30);
  }
}

// ============================================================
// 文苑（文事作品库）面板
// ============================================================
var _WENYUAN_GENRES = { shi:'诗', ci:'词', fu:'赋', qu:'曲', ge:'歌行', wen:'散文', apply:'应用文', ji:'记叙', ritual:'祭碑', paratext:'序跋' };
var _WENYUAN_CATS = {
  career: { label:'科举宦途', color:'#3498db' },
  adversity:{label:'逆境贬谪', color:'#c0392b' },
  social: { label:'社交酬酢', color:'#e67e22' },
  duty:   { label:'任上施政', color:'#9b59b6' },
  travel: { label:'游历山水', color:'#16a085' },
  private:{ label:'家事私情', color:'#e91e63' },
  times:  { label:'时局天下', color:'#f39c12' },
  mood:   { label:'情感心境', color:'#607d8b' }
};

/** 诗稿卷轴式作者标签——姓只取首字/两字 */
function _wyAuthorTab(name) {
  if (!name) return '?';
  // 保留最多3字，去空白
  var nm = String(name).replace(/\s+/g,'').slice(0, 3);
  return escHtml(nm);
}

/** 品鉴星 */
function _wyQualityStars(q) {
  var _n = Math.max(0, Math.min(100, q||0));
  var _stars = Math.round(_n / 20);
  if (_stars < 1) _stars = 1;
  if (_stars > 5) _stars = 5;
  var html = '<span class="wy-quality"><span class="lbl">\u54C1</span>';
  for (var i=0; i<5; i++) html += '<span class="star' + (i<_stars?'':' d') + '">\u2605</span>';
  html += '<span class="val">' + _n + '</span></span>';
  return html;
}

/** 风险徽章 */
function _wyRiskBadge(r) {
  var _lvl = r || 'low';
  var _lbl = _lvl === 'high' ? '\u653F\u9669 \u00B7 \u9AD8' : _lvl === 'medium' ? '\u653F\u9669 \u00B7 \u4E2D' : '\u653F\u9669 \u00B7 \u4F4E';
  return '<span class="wy-risk ' + _lvl + '">' + _lbl + '</span>';
}

function renderWenyuan() {
  var list = _$('wenyuan-list'); if (!list) return;
  var sbar = _$('wy-statbar'), leg = _$('wy-legend');
  var works = (GM.culturalWorks || []).slice();

  // 统计
  var curTurn = GM.turn || 1;
  var _stat = { all: works.length, preserved: 0, forbidden: 0, risky: 0, recent: 0, authors: {} };
  works.forEach(function(w) {
    if (w.isPreserved) _stat.preserved++;
    if (w.isForbidden) _stat.forbidden++;
    if (w.politicalRisk === 'high' || w.politicalRisk === 'medium') _stat.risky++;
    if ((w.turn||0) >= curTurn - 8) _stat.recent++;
    if (w.author) _stat.authors[w.author] = (_stat.authors[w.author]||0) + 1;
  });
  var _authorCnt = Object.keys(_stat.authors).length;
  if (sbar) {
    sbar.innerHTML = ''
      + '<div class="wy-stat-card s-all"><div class="wy-stat-lbl">\u603B \u5F55</div><div class="wy-stat-num">'+_stat.all+'</div><div class="wy-stat-sub">\u7BC7</div></div>'
      + '<div class="wy-stat-card s-preserve"><div class="wy-stat-lbl">\u4F20 \u4E16</div><div class="wy-stat-num">'+_stat.preserved+'</div><div class="wy-stat-sub">\u540D\u4F5C</div></div>'
      + '<div class="wy-stat-card s-forbid"><div class="wy-stat-lbl">\u67E5 \u7981</div><div class="wy-stat-num">'+_stat.forbidden+'</div><div class="wy-stat-sub">\u8BB3\u7981</div></div>'
      + '<div class="wy-stat-card s-risk"><div class="wy-stat-lbl">\u653F \u9669</div><div class="wy-stat-num">'+_stat.risky+'</div><div class="wy-stat-sub">\u6D89\u8BBD</div></div>'
      + '<div class="wy-stat-card s-era"><div class="wy-stat-lbl">\u672C \u671D</div><div class="wy-stat-num">'+_stat.recent+'</div><div class="wy-stat-sub">\u8FD1\u4F5C</div></div>'
      + '<div class="wy-stat-card s-author"><div class="wy-stat-lbl">\u6587 \u9B41</div><div class="wy-stat-num">'+_authorCnt+'</div><div class="wy-stat-sub">\u540D\u5BB6</div></div>';
  }

  if (!works.length) {
    if (leg) leg.innerHTML = '';
    list.innerHTML = '<div class="wy-empty">\u6682\u65E0\u6587\u4E8B\u4F5C\u54C1<div class="sub">\u58EB\u5927\u592B\u56E0\u5883\u9047\u00B7\u9645\u9047\u00B7\u5FC3\u5883\u800C\u4F5C\uFF0C\u968F\u56DE\u5408\u63A8\u6F14\u81EA\u7136\u751F\u6210</div></div>';
    return;
  }

  // 筛选
  var catFil = (_$('wy-cat-filter') || {value:'all'}).value;
  var genFil = (_$('wy-genre-filter') || {value:'all'}).value;
  var sortKey = (_$('wy-sort') || {value:'recent'}).value;
  var preservedOnly = !!(_$('wy-preserved-only') || {}).checked;
  var hideForbidden = !!(_$('wy-hide-forbidden') || {}).checked;
  var kw = (_$('wy-search') || {value:''}).value.toLowerCase().trim();

  var filtered = works.filter(function(w) {
    if (catFil !== 'all' && w.triggerCategory !== catFil) return false;
    if (genFil !== 'all' && w.genre !== genFil) return false;
    if (preservedOnly && !w.isPreserved) return false;
    if (hideForbidden && w.isForbidden) return false;
    if (kw) {
      var hay = ((w.author||'') + (w.title||'') + (w.content||'') + (w.trigger||'') + (w.location||'')).toLowerCase();
      if (hay.indexOf(kw) < 0) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    if (sortKey === 'quality') return (b.quality||0) - (a.quality||0);
    if (sortKey === 'author') return String(a.author||'').localeCompare(String(b.author||''));
    if (sortKey === 'date') return String(b.date||'').localeCompare(String(a.date||''));
    return (b.turn || 0) - (a.turn || 0); // recent
  });

  // 触发类别 legend
  if (leg) {
    var _catKeyMap = { career:'c-career', adversity:'c-adversity', social:'c-social', duty:'c-duty', travel:'c-travel', private:'c-private', times:'c-times', mood:'c-mood' };
    var _catCnt = {};
    filtered.forEach(function(w) { var k = w.triggerCategory || 'other'; _catCnt[k] = (_catCnt[k]||0)+1; });
    var _lhtml = '<span class="wy-legend-lbl">\u89E6 \u53D1</span>';
    Object.keys(_WENYUAN_CATS).forEach(function(k) {
      if (!_catCnt[k]) return;
      var cls = _catKeyMap[k] || '';
      _lhtml += '<span class="wy-legend-chip ' + cls + '">' + escHtml(_WENYUAN_CATS[k].label) + '<span class="num">\u00B7' + _catCnt[k] + '</span></span>';
    });
    leg.innerHTML = _lhtml;
  }

  if (!filtered.length) { list.innerHTML = '<div class="wy-empty">\u7BC7 \u673A \u5BC2 \u5BC2\u3000\u65E0 \u5339 \u914D \u4E4B \u4F5C<div class="sub">\u8BD5\u8C03\u62AB\u89C8\u6216\u653E\u5BBD\u7B5B\u9009</div></div>'; return; }

  var _catKeyMap2 = { career:'c-career', adversity:'c-adversity', social:'c-social', duty:'c-duty', travel:'c-travel', private:'c-private', times:'c-times', mood:'c-mood' };
  var html = '';
  filtered.forEach(function(w) {
    var _realIdx = works.indexOf(w);
    var cat = _WENYUAN_CATS[w.triggerCategory] || {label:'', color:'#888'};
    var genreLbl = _WENYUAN_GENRES[w.genre] || w.genre || '';
    var _catCls = _catKeyMap2[w.triggerCategory] || '';
    var _cardCls = 'wy-card ' + _catCls;
    if (w.isPreserved) _cardCls += ' preserved';
    if (w.isForbidden) _cardCls += ' forbidden';

    // 节选：取前 4 行或 120 字
    var _lines = (w.content || '').split('\n').filter(function(s){return s.trim();});
    var _excerpt = _lines.slice(0, 4).join('\n');
    if (_excerpt.length > 160) _excerpt = _excerpt.substring(0, 160) + '\u2026';
    var _excerptCls = 'wy-excerpt';
    if (w.genre === 'shi' || w.genre === 'ci' || w.genre === 'qu' || w.genre === 'ge') _excerptCls += ' elegant';
    if (w.genre === 'fu') _excerptCls += ' fu';
    if (w.genre === 'wen' || w.genre === 'ji' || w.genre === 'ritual' || w.genre === 'paratext') _excerptCls += ' wen';

    html += '<div class="' + _cardCls + '" onclick="_showWorkDetail(' + _realIdx + ')">';
    // 左：题签卷轴
    html += '<div class="wy-tab-col">';
    html += '<div class="wy-tab-scroll"><div class="wy-tab-author">' + _wyAuthorTab(w.author||'\u65E0\u540D') + '</div>';
    if (w.date) html += '<div class="wy-tab-date">' + escHtml(String(w.date).slice(0, 10)) + '</div>';
    else if (w.turn) html += '<div class="wy-tab-date">T' + w.turn + '</div>';
    html += '</div>';
    if (w.isPreserved) html += '<div class="wy-tab-seal">\u5370</div>';
    html += '</div>';
    // 右：正文列
    html += '<div class="wy-main-col">';
    html += '<div class="wy-hdr-row"><span class="wy-title-w">' + escHtml(w.title||'\u65E0\u9898') + '</span>';
    if (genreLbl) html += '<span class="wy-genre-chip">' + escHtml(genreLbl) + '</span>';
    if (w.subtype) html += '<span class="wy-subtype">' + escHtml(w.subtype) + '</span>';
    html += '</div>';
    // meta-row
    var _metaParts = [];
    if (cat.label) _metaParts.push('<span class="wy-cat-chip">' + escHtml(cat.label) + '</span>');
    if (w.location) _metaParts.push('<span class="wy-loc">' + escHtml(w.location) + '</span>');
    if (w.mood) _metaParts.push('<span class="wy-mood">' + escHtml(w.mood) + '</span>');
    if (_metaParts.length) html += '<div class="wy-meta-row">' + _metaParts.join('') + '</div>';
    // excerpt
    if (_excerpt) html += '<div class="' + _excerptCls + '">' + escHtml(_excerpt) + '</div>';
    // 品鉴行
    var _tagsHtml = '';
    if (w.theme) _tagsHtml += '<span class="wy-tag">' + escHtml(w.theme) + '</span>';
    if (w.motivation && w.motivation !== 'spontaneous') {
      var _motMap = {commissioned:'\u53D7\u547D',flattery:'\u5E72\u8C12',response:'\u916C\u7B54',mourning:'\u54C0\u60BC',critique:'\u8BBD\u8C15',celebration:'\u9882\u626C',farewell:'\u9001\u522B',memorial:'\u7EAA\u5FF5',ghostwrite:'\u4EE3\u7B14',duty:'\u5E94\u5236',self_express:'\u81EA\u6292'};
      _tagsHtml += '<span class="wy-tag">' + (_motMap[w.motivation] || escHtml(w.motivation)) + '</span>';
    }
    html += '<div class="wy-assess">' + _wyQualityStars(w.quality) + _wyRiskBadge(w.politicalRisk) + _tagsHtml + '</div>';
    // 创作背景
    if (w.narrativeContext) html += '<div class="wy-ctx">' + escHtml(w.narrativeContext) + '</div>';
    if (w.politicalImplication) html += '<div class="wy-implicit">' + escHtml(w.politicalImplication) + '</div>';
    // 操作
    html += '<div class="wy-actions">';
    html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'appreciate\')">\u8D4F \u6790</button>';
    html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'inscribe\')">\u9898 \u5E8F</button>';
    html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'echo\')">\u8FFD \u548C</button>';
    if (!w.isForbidden) html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'circulate\')">\u4F20 \u6284</button>';
    if (!w.isForbidden) html += '<button class="wy-btn danger" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'ban\')">\u67E5 \u7981</button>';
    else html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'unban\')">\u89E3 \u7981</button>';
    html += '<button class="wy-btn primary" onclick="event.stopPropagation();_showWorkDetail(' + _realIdx + ')">\u8BE6 \u60C5</button>';
    html += '</div>';
    html += '</div>'; // main-col
    html += '</div>'; // card
  });
  list.innerHTML = html;
}

function _showWorkDetail(idx) {
  var w = (GM.culturalWorks || [])[idx]; if (!w) return;
  var cat = _WENYUAN_CATS[w.triggerCategory] || {label:'', color:'#888'};
  var genreLbl = _WENYUAN_GENRES[w.genre] || w.genre || '';
  var html = '<div class="modal-bg show" id="_workDetailModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:620px;max-height:90vh;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.3rem;letter-spacing:0.08em;">' + escHtml(w.title || '') + '</h3>';
  html += '<div style="font-size:0.78rem;color:var(--color-foreground-muted);margin-bottom:0.6rem;">' + escHtml(w.author||'') + ' · ' + escHtml(w.date||'') + (w.location ? ' · 于 '+escHtml(w.location) : '') + '</div>';
  // 全文
  html += '<div style="font-family:var(--font-serif,serif);font-size:1rem;line-height:2.0;color:var(--color-foreground);padding:1rem;background:linear-gradient(to bottom,rgba(184,154,83,0.04),transparent);border-left:3px solid var(--gold-500);border-radius:var(--radius-md);white-space:pre-wrap;margin-bottom:0.6rem;">' + escHtml(w.content || '') + '</div>';
  // 创作背景
  if (w.narrativeContext) {
    html += '<div style="font-size:0.82rem;color:var(--color-foreground-secondary);background:var(--bg-2);padding:0.5rem 0.7rem;border-radius:var(--radius-sm);margin-bottom:0.6rem;line-height:1.7;"><b style="color:' + cat.color + ';">创作背景：</b>' + escHtml(w.narrativeContext) + '</div>';
  }
  // 元数据
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 12px;font-size:0.72rem;margin-bottom:0.6rem;">';
  html += '<div><b style="color:' + cat.color + ';">触发：</b>' + cat.label + (w.trigger ? ' · ' + w.trigger : '') + '</div>';
  html += '<div><b style="color:var(--gold-400);">文体：</b>' + genreLbl + (w.subtype ? ' · ' + w.subtype : '') + '</div>';
  if (w.mood) html += '<div><b>情绪：</b>' + w.mood + '</div>';
  if (w.theme) html += '<div><b>题材：</b>' + w.theme + '</div>';
  if (w.motivation) html += '<div><b>动机：</b>' + w.motivation + '</div>';
  if (w.elegance) html += '<div><b>雅俗：</b>' + w.elegance + '</div>';
  html += '<div><b>质量：</b>' + (w.quality || 0) + '</div>';
  html += '<div><b>风险：</b>' + (w.politicalRisk || 'low') + '</div>';
  if (w.isPreserved) html += '<div style="color:var(--gold-400);">★ 传世之作</div>';
  if (w.isForbidden) html += '<div style="color:var(--vermillion-400);">⚠ 已查禁</div>';
  html += '</div>';
  if (w.politicalImplication) html += '<div style="font-size:0.78rem;color:var(--vermillion-400);margin-bottom:0.5rem;padding:0.3rem 0.5rem;background:rgba(192,57,43,0.08);border-radius:4px;">政治暗讽：' + escHtml(w.politicalImplication) + '</div>';
  if (w.dedicatedTo && w.dedicatedTo.length) html += '<div style="font-size:0.72rem;color:var(--color-foreground-muted);">赠：' + w.dedicatedTo.map(escHtml).join('、') + '</div>';
  // 玩家操作
  html += '<div style="display:flex;gap:6px;margin-top:0.8rem;flex-wrap:wrap;justify-content:flex-end;">';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'appreciate\')">赐阅赏析</button>';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'inscribe\')">御题赐序</button>';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'echo\')">追和</button>';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'circulate\')">传抄</button>';
  if (!w.isForbidden) html += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_workAction(' + idx + ',\'ban\')">查禁</button>';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_workDetailModal\');if(m)m.remove();">关闭</button>';
  html += '</div>';
  html += '</div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _workAction(idx, action) {
  var w = (GM.culturalWorks || [])[idx]; if (!w) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  var content = '';
  if (action === 'appreciate') content = '赐阅 ' + w.author + '《' + w.title + '》，表嘉赏之意';
  else if (action === 'inscribe') content = '御题 ' + w.author + '《' + w.title + '》——亲笔题跋或作序，准其刊行';
  else if (action === 'echo') content = '命 ' + w.author + ' 或朝中文臣追和《' + w.title + '》——再作一篇次韵酬答';
  else if (action === 'circulate') content = '将 ' + w.author + '《' + w.title + '》传抄行世，刻本广布';
  else if (action === 'ban') content = '查禁 ' + w.author + '《' + w.title + '》——此作' + (w.politicalImplication ? '有' + w.politicalImplication + '之嫌，' : '') + '不宜流布';
  else if (action === 'unban') content = '解禁 ' + w.author + '《' + w.title + '》——准其重新流布，刊本发还';
  if (content) {
    GM._edictSuggestions.push({ source: '\u6587\u4E8B', from: w.author, content: content, turn: GM.turn, used: false });
    toast('已录入诏令建议库');
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  }
  var m = document.getElementById('_workDetailModal'); if (m) m.remove();
}

// P3: 省份民情面板渲染
var _dfSearch='', _dfSort='name', _dfCrisis=false;

function _renderDifangPanel() {
  var grid = _$('difang-grid'); if (!grid) return;
  // 优先读运行时 GM.adminHierarchy（与左侧栏一致·含推演更新的民心/腐败/人口）·回退剧本 P.adminHierarchy
  var ah = (GM && GM.adminHierarchy && Object.keys(GM.adminHierarchy).length > 0) ? GM.adminHierarchy : P.adminHierarchy;
  if (!ah) { grid.innerHTML = '<div style="color:var(--txt-d);text-align:center;">未设置行政区划</div>'; return; }

  // 启动时按需派生管辖类型（首次或势力变更后）
  if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();
  var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';

  // 收集所有顶级区划（扁平化）+ 附带管辖信息（dedupe 同名区划：只取第一个出现的）
  var _allDivs = [];
  var _seenRegionKeys = {};
  var factionKeys = Object.keys(ah);
  factionKeys.forEach(function(fk) {
    var fh = ah[fk];
    if (!fh || !fh.divisions) return;
    var _fac = (GM.facs || []).find(function(f) { return f.name === fh.name || f.name === fk; });
    fh.divisions.forEach(function(d) {
      if (!d || !d.name) return;
      var _key = d.id || d.name;
      if (_seenRegionKeys[_key]) return;   // 跳过已收集（避免多势力重名重复）
      _seenRegionKeys[_key] = true;
      // 获取或派生 autonomy
      var autonomy = d.autonomy;
      if (!autonomy || !autonomy.type) {
        autonomy = (typeof deriveAutonomy === 'function') ? deriveAutonomy(d, _fac, _playerFac) : { type: 'zhixia' };
      }
      if (!autonomy.type) return;
      _allDivs.push({ div: d, faction: fh.name || fk, factionKey: fk, autonomy: autonomy });
    });
  });

  // 辅助：递归从叶子聚合 population + minxin/corruption/fiscal/publicTreasury
  function _dfRecurseAggregate(node) {
    if (!node) return null;
    if (!node.children || node.children.length === 0) {
      var _popObj = (node.population && typeof node.population === 'object') ? node.population : null;
      return {
        mouths: _popObj ? (_popObj.mouths||0) : (typeof node.population === 'number' ? node.population : 0),
        households: _popObj ? (_popObj.households||0) : 0,
        ding: _popObj ? (_popObj.ding||0) : 0,
        fugitives: _popObj ? (_popObj.fugitives||0) : 0,
        hiddenCount: _popObj ? (_popObj.hiddenCount||0) : 0,
        minxin: (typeof node.minxin === 'number') ? node.minxin : null,
        corruption: (typeof node.corruption === 'number') ? node.corruption : null,
        remit: (node.fiscal && node.fiscal.remittedToCenter) || 0,
        actual: (node.fiscal && node.fiscal.actualRevenue) || 0,
        pubMoney: (node.publicTreasury && node.publicTreasury.money && node.publicTreasury.money.stock) || 0,
        pubGrain: (node.publicTreasury && node.publicTreasury.grain && node.publicTreasury.grain.stock) || 0,
        pubCloth: (node.publicTreasury && node.publicTreasury.cloth && node.publicTreasury.cloth.stock) || 0,
        envLoad: (node.environment && node.environment.currentLoad) || 0,
        count: 1
      };
    }
    var acc = { mouths:0, households:0, ding:0, fugitives:0, hiddenCount:0, remit:0, actual:0, pubMoney:0, pubGrain:0, pubCloth:0, minxinW:0, corrW:0, envLoadSum:0, count:0 };
    node.children.forEach(function(c) {
      var sub = _dfRecurseAggregate(c);
      if (!sub) return;
      acc.mouths += sub.mouths; acc.households += sub.households; acc.ding += sub.ding;
      acc.fugitives += sub.fugitives; acc.hiddenCount += sub.hiddenCount;
      acc.remit += sub.remit; acc.actual += sub.actual;
      acc.pubMoney += sub.pubMoney; acc.pubGrain += sub.pubGrain; acc.pubCloth += sub.pubCloth;
      var w = sub.mouths || 1;
      if (sub.minxin != null) acc.minxinW += sub.minxin * w;
      if (sub.corruption != null) acc.corrW += sub.corruption * w;
      acc.envLoadSum += (sub.envLoad || 0) * (sub.count||1);
      acc.count += sub.count;
    });
    var totalW = acc.mouths || 1;
    return {
      mouths: acc.mouths, households: acc.households, ding: acc.ding,
      fugitives: acc.fugitives, hiddenCount: acc.hiddenCount,
      minxin: totalW > 0 ? acc.minxinW / totalW : null,
      corruption: totalW > 0 ? acc.corrW / totalW : null,
      remit: acc.remit, actual: acc.actual,
      pubMoney: acc.pubMoney, pubGrain: acc.pubGrain, pubCloth: acc.pubCloth,
      envLoad: acc.count > 0 ? acc.envLoadSum / acc.count : 0,
      count: acc.count
    };
  }

  // 为每个区划计算数据（优先读自身深化字段；若顶级 population 为空则从子递归聚合）
  _allDivs.forEach(function(item) {
    var d = item.div;
    var ps = GM.provinceStats && GM.provinceStats[d.name];
    item.name = d.name;
    var _agg = _dfRecurseAggregate(d);
    // 新字段：population 是对象
    if (d.population && typeof d.population === 'object' && d.population.mouths > 0) {
      item.pop = d.population.mouths || 0;
      item.households = d.population.households || 0;
      item.ding = d.population.ding || 0;
      item.fugitives = d.population.fugitives || 0;
      item.hiddenCount = d.population.hiddenCount || 0;
    } else if (_agg && _agg.mouths > 0) {
      // 顶级没自身人口 → 用叶子聚合
      item.pop = _agg.mouths;
      item.households = _agg.households;
      item.ding = _agg.ding;
      item.fugitives = _agg.fugitives;
      item.hiddenCount = _agg.hiddenCount;
    } else {
      item.pop = (typeof d.population === 'number' ? d.population : 0) || (ps ? ps.population : 0) || 0;
      item.households = d.households || (ps ? ps.households : 0) || Math.floor(item.pop/5);
      item.ding = Math.floor(item.pop*0.25);
      item.fugitives = 0; item.hiddenCount = 0;
    }
    // 民心/腐败/财政/公库 —— 优先自身字段；无则用子聚合
    item.minxin = (typeof d.minxin === 'number') ? d.minxin : (_agg && _agg.minxin != null ? _agg.minxin : null);
    item.corruption = (typeof d.corruption === 'number') ? d.corruption : (_agg && _agg.corruption != null ? _agg.corruption : ((ps && ps.corruption) || 0));
    item.unrest = item.minxin != null ? Math.max(0, 100 - item.minxin) : ((ps && ps.unrest) || 0);
    item.prosperity = d.prosperity || (ps ? (ps.prosperity||ps.development) : 0) || 0;
    item.remit = (d.fiscal && d.fiscal.remittedToCenter) || (_agg && _agg.remit) || 0;
    item.actualRevenue = (d.fiscal && d.fiscal.actualRevenue) || (_agg && _agg.actual) || 0;
    item.taxRevenue = item.remit || item.actualRevenue || (ps ? ps.taxRevenue : 0) || 0;
    item.pubMoney = (d.publicTreasury && d.publicTreasury.money && d.publicTreasury.money.stock) || (_agg && _agg.pubMoney) || 0;
    item.pubGrain = (d.publicTreasury && d.publicTreasury.grain && d.publicTreasury.grain.stock) || (_agg && _agg.pubGrain) || 0;
    item.pubCloth = (d.publicTreasury && d.publicTreasury.cloth && d.publicTreasury.cloth.stock) || (_agg && _agg.pubCloth) || 0;
    item.envLoad = (d.environment && d.environment.currentLoad) || (_agg && _agg.envLoad) || 0;
    item.regionType = d.regionType || 'normal';
    item.governor = d.governor || (ps ? ps.governor : '') || '';
    item.govCh = item.governor ? findCharByName(item.governor) : null;
    // 稳定度（民心优先；无则按当地忠诚+老 unrest 派生）
    if (item.minxin != null) {
      item.stability = item.minxin;
    } else {
      var localChars = (GM.chars || []).filter(function(c) { return c.alive !== false && c.location === d.name; });
      var avgLoy = localChars.length > 0 ? Math.round(localChars.reduce(function(s,c){ return s+(c.loyalty||50); },0)/localChars.length) : 50;
      item.stability = Math.max(0, Math.min(100, avgLoy - item.unrest * 0.5));
    }
    // 趋势
    var prev = GM._prevProvinceStats && GM._prevProvinceStats[d.name];
    item.trend = {};
    if (prev) {
      item.trend.prosperity = (item.prosperity||0) > (prev.prosperity||prev.development||0) ? '\u2191' : (item.prosperity||0) < (prev.prosperity||prev.development||0) ? '\u2193' : '';
      item.trend.corruption = (item.corruption||0) > (prev.corruption||0) ? '\u2191' : (item.corruption||0) < (prev.corruption||0) ? '\u2193' : '';
      item.trend.unrest = (item.unrest||0) > (prev.unrest||0) ? '\u2191' : (item.unrest||0) < (prev.unrest||0) ? '\u2193' : '';
    }
  });

  // 搜索
  if (_dfSearch) {
    var kw = _dfSearch.toLowerCase();
    _allDivs = _allDivs.filter(function(item) { return item.name.toLowerCase().indexOf(kw) >= 0 || item.governor.toLowerCase().indexOf(kw) >= 0 || item.faction.toLowerCase().indexOf(kw) >= 0; });
  }
  // 危机筛选
  if (_dfCrisis) {
    _allDivs = _allDivs.filter(function(item) { return item.unrest > 40 || item.corruption > 50; });
  }
  // 排序
  _allDivs.sort(function(a,b) {
    if (_dfSort === 'unrest') return (b.unrest||0) - (a.unrest||0);
    if (_dfSort === 'corruption') return (b.corruption||0) - (a.corruption||0);
    if (_dfSort === 'population') return (b.pop||0) - (a.pop||0);
    if (_dfSort === 'tax') return (b.taxRevenue||b.tax||0) - (a.taxRevenue||a.tax||0);
    return a.name.localeCompare(b.name);
  });

  if (_allDivs.length === 0) { grid.innerHTML = '<div style="color:var(--color-foreground-muted);text-align:center;padding:2rem;font-family:var(--font-serif);letter-spacing:0.2em;">\u65E0\u5339\u914D\u533A\u5212</div>'; return; }

  // ═══ 统计栏 + 图例 + 预警 ═══
  var _allTotal = _allDivs.length;
  var _cntZhi=0, _cntFan=0, _cntJi=0, _cntTu=0, _cntShu=0, _cntCrisis=0;
  _allDivs.forEach(function(item){
    var t = item.autonomy.type;
    if (t === 'zhixia') _cntZhi++;
    else if (t === 'fanzhen' || t === 'fanguo') _cntFan++;
    else if (t === 'jimi') _cntJi++;
    else if (t === 'chaogong') _cntShu++;
    if (item.regionType === 'tusi') _cntTu++;
    if (item.unrest > 40 || item.corruption > 50 || (item.fugitives||0) > (item.pop||1) * 0.04) _cntCrisis++;
  });

  // 统计栏
  var statEl = _$('df-statbar');
  if (statEl) {
    var sh = '';
    sh += '<div class="df-stat-card s-all"><div class="df-stat-lbl">\u884C \u653F \u533A \u5212</div><div class="df-stat-num">' + _allTotal + '</div><div class="df-stat-sub">\u5404\u9053\u00B7\u5E03\u653F\u53F8\u00B7\u85E9\u9547\u00B7\u7F81\u7E3B</div></div>';
    sh += '<div class="df-stat-card s-zhi"><div class="df-stat-lbl">\u76F4 \u8F96</div><div class="df-stat-num">' + _cntZhi + '</div><div class="df-stat-sub">\u90E1\u53BF\u5236\u00B7\u6D41\u5B98\u7BA1\u7406</div></div>';
    sh += '<div class="df-stat-card s-fan"><div class="df-stat-lbl">\u85E9 \u9547</div><div class="df-stat-num">' + _cntFan + '</div><div class="df-stat-sub">\u8282\u5EA6\u4F7F\u00B7\u85E9\u56FD</div></div>';
    sh += '<div class="df-stat-card s-ji"><div class="df-stat-lbl">\u7F81 \u7E3B \u00B7 \u571F \u53F8</div><div class="df-stat-num">' + (_cntJi + _cntTu) + '</div><div class="df-stat-sub">\u56E0\u4FD7\u800C\u6CBB</div></div>';
    sh += '<div class="df-stat-card s-crisis"><div class="df-stat-lbl">\u26A0 \u5371 \u673A</div><div class="df-stat-num">' + _cntCrisis + '</div><div class="df-stat-sub">\u6C11\u53D8\u9AD8\u00B7\u8150\u8D25\u91CD\u00B7\u9003\u6237\u591A</div></div>';
    statEl.innerHTML = sh;
  }

  // 图例
  var legendEl = _$('df-legend');
  if (legendEl) {
    var lh = '<span class="df-legend-lbl">\u7BA1 \u8F96</span>';
    lh += '<span class="df-legend-chip zhi">\u76F4 \u8F96 <span class="num">' + _cntZhi + '</span></span>';
    lh += '<span class="df-legend-chip fan">\u85E9 \u9547 <span class="num">' + _cntFan + '</span></span>';
    lh += '<span class="df-legend-chip ji">\u7F81 \u7E3B <span class="num">' + _cntJi + '</span></span>';
    lh += '<span class="df-legend-chip tu">\u571F \u53F8 <span class="num">' + _cntTu + '</span></span>';
    lh += '<span class="df-legend-chip shu">\u671D \u8D21 <span class="num">' + _cntShu + '</span></span>';
    legendEl.innerHTML = lh;
  }

  // 预警条（前 3 个高危区）
  var alertEl = _$('df-alerts');
  if (alertEl) {
    var _crisisSortedAll = _allDivs.slice().sort(function(a,b){
      var sa = (a.unrest||0) * 1.5 + (a.corruption||0);
      var sb = (b.unrest||0) * 1.5 + (b.corruption||0);
      return sb - sa;
    }).filter(function(x){ return x.unrest > 40 || x.corruption > 50; }).slice(0, 3);
    if (_crisisSortedAll.length > 0) {
      var ah = '';
      _crisisSortedAll.forEach(function(cx){
        var icon = cx.unrest > 60 ? '\u4E71' : cx.corruption > 60 ? '\u8150' : '\u8B66';
        var cls = cx.unrest > 60 ? '' : 'warn';
        var cause = [];
        if (cx.unrest > 60) cause.push('\u6C11\u53D8 ' + Math.round(cx.unrest));
        if (cx.corruption > 50) cause.push('\u8150\u8D25 ' + Math.round(cx.corruption));
        if ((cx.fugitives||0) > 0) cause.push('\u9003\u6237 ' + (cx.fugitives > 10000 ? Math.round(cx.fugitives/10000)+'\u4E07':cx.fugitives));
        ah += '<div class="df-alert' + (cls?' '+cls:'') + '"><div class="ic">' + icon + '</div>';
        ah += '<div><span class="lbl">' + escHtml(cx.name) + '\uFF1A</span><span class="txt">' + cause.join(' \u00B7 ') + (cx.governor ? ' \u00B7 \u957F\u5B98 ' + escHtml(cx.governor) : '') + '</span></div></div>';
      });
      alertEl.innerHTML = ah;
      alertEl.style.display = 'flex';
    } else {
      alertEl.style.display = 'none';
      alertEl.innerHTML = '';
    }
  }

  // ═══ 省份卡网格 ═══
  var html = '';
  _allDivs.forEach(function(item) {
    var t = item.autonomy.type;
    var typeCls = t === 'zhixia' ? 'df-zhi' : (t === 'fanguo' || t === 'fanzhen') ? 'df-fan' : (t === 'jimi' ? 'df-ji' : (t === 'chaogong' ? 'df-shu' : 'df-zhi'));
    if (item.regionType === 'tusi') typeCls = 'df-tu';
    var isCrisis = item.unrest > 40 || item.corruption > 50;
    var cardCls = 'df-card ' + typeCls + (isCrisis ? ' crisis' : '');

    var autonLabel = t === 'zhixia' ? '\u76F4 \u8F96' : t === 'fanguo' ? (item.autonomy.subtype === 'real' ? '\u5B9E\u5C01\u85E9' : '\u865A\u5C01\u85E9') : t === 'fanzhen' ? '\u85E9 \u9547' : t === 'jimi' ? (item.regionType === 'tusi' ? '\u571F \u53F8' : '\u7F81 \u7E3B') : t === 'chaogong' ? '\u671D \u8D21' : '';
    var _isDirect = t === 'zhixia';

    // 大人口口数显示
    var _popMain = item.pop > 10000 ? (item.pop/10000).toFixed(item.pop >= 1e6 ? 0 : 1).replace(/\.0$/,'') : item.pop;
    var _popUnit = item.pop > 10000 ? '\u4E07\u53E3' : '\u53E3';

    html += '<div class="' + cardCls + '">';
    // 顶部
    html += '<div class="df-card-hdr">';
    html += '<span class="df-card-name">' + escHtml(item.name) + '</span>';
    if (autonLabel) html += '<span class="df-auton-chip">' + autonLabel + '</span>';
    if (item.faction) html += '<span class="df-fac-tag">' + escHtml(item.faction) + '</span>';
    html += '<span class="df-pop-main"><span class="n">' + _popMain + '</span><span class="u">' + _popUnit + '</span></span>';
    html += '</div>';

    html += '<div class="df-card-body">';

    // 持爵者/宗主（非直辖）
    if (!_isDirect && item.autonomy.holder) {
      var holderLbl = t === 'fanguo' ? (item.autonomy.subtype === 'real' ? '\u5B9E\u5C01\u85E9\u738B' : '\u865A\u5C01\u85E9\u738B') : t === 'jimi' ? '\u571F\u53F8' : t === 'fanzhen' ? '\u8282\u5EA6\u4F7F' : t === 'chaogong' ? '\u5916\u85E9\u738B' : '';
      html += '<div style="font-size:10.5px;color:var(--auton-c);font-family:var(--font-serif);letter-spacing:0.08em;">' + holderLbl + '\uFF1A' + escHtml(item.autonomy.holder);
      if (item.autonomy.loyalty !== undefined) html += ' \u00B7 \u5FE0 ' + item.autonomy.loyalty;
      if (item.autonomy.tributeRate) html += ' \u00B7 \u8D21\u7387 ' + Math.round(item.autonomy.tributeRate*100) + '%';
      html += '</div>';
    }

    // 4 维条形图
    var _mxCls = item.minxin != null ? (item.minxin >= 60 ? '' : item.minxin >= 35 ? ' mid' : ' lo') : '';
    var _mxVal = item.minxin != null ? Math.round(item.minxin) : null;
    var _crCls = item.corruption >= 60 ? ' hi' : item.corruption >= 40 ? ' mid' : '';
    var _crVal = Math.round(item.corruption||0);
    var _prVal = Math.round(item.prosperity||0);
    var _unCls = item.unrest >= 60 ? ' hi' : item.unrest >= 35 ? ' mid' : '';
    var _unVal = Math.round(item.unrest||0);
    html += '<div class="df-bars">';
    if (_mxVal != null) html += '<div class="df-bar minxin' + _mxCls + '"><span class="df-bar-lbl">\u6C11\u5FC3</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_mxVal) + '%;"></div></div><span class="df-bar-val">' + _mxVal + '</span></div>';
    html += '<div class="df-bar corruption' + _crCls + '"><span class="df-bar-lbl">\u8150\u8D25</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_crVal) + '%;"></div></div><span class="df-bar-val">' + _crVal + '</span></div>';
    html += '<div class="df-bar prosperity"><span class="df-bar-lbl">\u7E41\u8363</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_prVal) + '%;"></div></div><span class="df-bar-val">' + _prVal + '</span></div>';
    html += '<div class="df-bar unrest' + _unCls + '"><span class="df-bar-lbl">\u53DB\u4E71</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_unVal) + '%;"></div></div><span class="df-bar-val">' + _unVal + '</span></div>';
    html += '</div>';

    // 户口细项
    function _fmtP(v){ return v >= 10000 ? (v/10000).toFixed(v>=1e7?0:1).replace(/\.0$/,'') + '\u4E07' : v; }
    html += '<div class="df-pop-detail">';
    html += '<span class="df-pop-item"><span class="lbl">\u6237</span><span class="v">' + _fmtP(item.households||0) + '</span></span>';
    html += '<span class="df-pop-item"><span class="lbl">\u53E3</span><span class="v">' + _fmtP(item.pop||0) + '</span></span>';
    html += '<span class="df-pop-item"><span class="lbl">\u4E01</span><span class="v">' + _fmtP(item.ding||0) + '</span></span>';
    if (item.fugitives > 0) {
      var fugCls = (item.fugitives > (item.pop||1) * 0.04) ? ' danger' : ' warn';
      html += '<span class="df-pop-item' + fugCls + '"><span class="lbl">\u9003</span><span class="v">' + _fmtP(item.fugitives) + '</span></span>';
    }
    if (item.hiddenCount > 0) {
      html += '<span class="df-pop-item warn"><span class="lbl">\u9690</span><span class="v">' + _fmtP(item.hiddenCount) + '</span></span>';
    }
    html += '</div>';

    // 财政
    var _taxRev = Math.round(item.taxRevenue||0);
    var _remit = Math.round(item.remit||0);
    if (_taxRev > 0 || _remit > 0) {
      html += '<div class="df-fiscal">';
      if (_taxRev > 0) html += '<span class="df-fiscal-item income"><span class="lbl">\u5B9E \u6536</span><span class="v">' + _fmtP(_taxRev) + '\u4E24</span></span>';
      if (_isDirect) {
        html += '<span class="df-fiscal-item"><span class="lbl">\u4E0A \u89E3</span><span class="v">' + _fmtP(_remit) + '\u4E24</span></span>';
      } else if (item.autonomy.tributeRate) {
        var _tribute = Math.round(_taxRev * item.autonomy.tributeRate);
        html += '<span class="df-fiscal-item"><span class="lbl">\u8D21 \u8D4B</span><span class="v">' + _fmtP(_tribute) + '\u4E24</span></span>';
      }
      html += '</div>';
    }

    // 公库 钱粮布
    if (item.pubMoney > 0 || item.pubGrain > 0 || item.pubCloth > 0) {
      html += '<div class="df-treasury-row">';
      html += '<span class="lbl">\u5DDE \u5E93</span>';
      if (item.pubMoney > 0) html += '<span class="item gold"><span class="k">\u94B1</span><span class="v">' + _fmtP(item.pubMoney) + '\u4E24</span></span>';
      if (item.pubGrain > 0) html += '<span class="item grain"><span class="k">\u7CAE</span><span class="v">' + _fmtP(item.pubGrain) + '\u77F3</span></span>';
      if (item.pubCloth > 0) html += '<span class="item cloth"><span class="k">\u5E03</span><span class="v">' + _fmtP(item.pubCloth) + '\u5339</span></span>';
      html += '</div>';
    }

    // 环境负担
    if (item.envLoad > 0) {
      var _envPct = Math.round((item.envLoad > 1 ? item.envLoad : item.envLoad * 100));
      var _envCls = _envPct >= 85 ? ' hi' : _envPct >= 60 ? ' mid' : '';
      html += '<div class="df-bar env' + _envCls + '"><span class="df-bar-lbl">\u73AF\u8D1F</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_envPct) + '%;"></div></div><span class="df-bar-val">' + _envPct + '</span></div>';
    }

    // 危机说明
    if (isCrisis) {
      var notes = [];
      if (item.unrest > 60) notes.push('\u6C11\u53D8\u5371\u6025');
      if (item.corruption > 60) notes.push('\u8150\u8D25\u6CDB\u6EE5');
      if ((item.fugitives||0) > (item.pop||1) * 0.04) notes.push('\u9003\u6237\u6D6A\u6F6E');
      if (item.envLoad > 0.85) notes.push('\u8F7D\u91CD\u8D85\u9650');
      if (notes.length > 0) html += '<div class="df-crisis-note">' + notes.join(' \u00B7 ') + '\uFF0C\u4E9F\u987B\u65E9\u7B79\u5904\u7F6E</div>';
    }

    // 事件 chips (灾荒/战乱/瘟疫/丰收等)
    var _evChips = [];
    if ((item.unrest||0) > 70) _evChips.push({ cls:'rebellion', txt:'\u6C11\u53D8' });
    if ((item.envLoad||0) > 0.9) _evChips.push({ cls:'calamity', txt:'\u8F7D\u91CD' });
    if (Array.isArray(item.disasters)) {
      item.disasters.forEach(function(d) {
        var _dName = (typeof d === 'string') ? d : (d.type || d.name || '');
        if (!_dName) return;
        var _cls = 'calamity';
        if (_dName.indexOf('\u65F1') >= 0 || _dName.indexOf('\u65F1\u707E') >= 0) _cls = 'drought';
        else if (_dName.indexOf('\u6D2A') >= 0 || _dName.indexOf('\u6C34') >= 0) _cls = 'flood';
        else if (_dName.indexOf('\u75AB') >= 0 || _dName.indexOf('\u75C5') >= 0) _cls = 'plague';
        else if (_dName.indexOf('\u4E71') >= 0 || _dName.indexOf('\u53DB') >= 0) _cls = 'rebellion';
        _evChips.push({ cls:_cls, txt:_dName });
      });
    }
    if (Array.isArray(item.activeEvents)) {
      item.activeEvents.forEach(function(ae) {
        var _n = (typeof ae === 'string') ? ae : (ae.name || ae.title || '');
        if (_n) _evChips.push({ cls:'calamity', txt:_n });
      });
    }
    if (GM.activeWars && GM.activeWars.length) {
      var _hasWar = GM.activeWars.some(function(w) { return (w.location||'').indexOf(item.name) >= 0 || (w.province||'') === item.name; });
      if (_hasWar) _evChips.push({ cls:'war', txt:'\u6218\u4E8B' });
    }
    if ((item.yearOutput||1) > 1.2 && !isCrisis) _evChips.push({ cls:'bumper', txt:'\u4E30\u79BB' });
    if (_evChips.length) {
      html += '<div class="df-events">';
      _evChips.slice(0, 5).forEach(function(e) { html += '<span class="df-event-chip ' + e.cls + '">' + escHtml(e.txt) + '</span>'; });
      html += '</div>';
    }

    // 长官行
    html += '<div class="df-governor">';
    if (item.governor) {
      var _portChar = item.governor ? item.governor.charAt(0) : '?';
      var _portImg = (item.govCh && item.govCh.portrait) ? '<img src="' + escHtml(item.govCh.portrait) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' : escHtml(_portChar);
      html += '<div class="df-gov-portrait">' + _portImg + '</div>';
      var _loy = item.govCh ? (item.govCh.loyalty || 50) : 50;
      var _loyCls = _loy >= 70 ? '' : _loy >= 40 ? 'mid' : 'lo';
      var _gTitle = _isDirect ? '\u5DE1\u629A' : (t === 'fanzhen' ? '\u603B\u5175\u5B98' : t === 'jimi' ? '\u5BA3\u6170\u4F7F' : '\u957F\u5B98');
      html += '<div class="df-gov-info"><div class="df-gov-title">' + _gTitle + '</div><div class="df-gov-name">' + escHtml(item.governor) + '<span class="loyalty ' + _loyCls + '">\u5FE0 ' + _loy + '</span></div></div>';
    } else {
      html += '<div class="df-gov-portrait" style="background:repeating-linear-gradient(45deg,rgba(107,93,71,0.25),rgba(107,93,71,0.25) 2px,rgba(107,93,71,0.1) 2px,rgba(107,93,71,0.1) 4px);border-style:dashed;color:var(--ink-300);">?</div>';
      html += '<div class="df-gov-info"><div class="df-gov-title">\u957F\u5B98</div><div class="df-gov-name" style="color:var(--vermillion-400);font-style:italic;">\u7A7A\u7F3A</div></div>';
    }
    // 操作按钮
    var _divName = escHtml(item.name).replace(/'/g,"\\'");
    html += '<div class="df-gov-actions">';
    if (_isDirect) {
      html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfEdict(\'' + _divName + '\')">\u4E0B \u65E8</button>';
      if (item.governor) html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfChangeGov(\'' + _divName + '\')">\u6362 \u5B98</button>';
      if (isCrisis) html += '<button class="df-gov-btn danger" onclick="event.stopPropagation();_dfEdict(\'' + _divName + '\')">\u8D48 \u6D4E</button>';
    } else {
      html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfEdict(\'' + _divName + '\')">\u4F20 \u65E8</button>';
      html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfNonDirectAction(\'' + _divName + '\',\'' + t + '\')">\u53EF \u884C \u4E4B \u7B56</button>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>'; // .df-card-body
    html += '</div>'; // .df-card
  });
  grid.innerHTML = html;
}

/** 数据条辅助·兼容旧调用 */
function _dfBar(label, val, color, trend) {
  var v = Math.round(val||0);
  var tStr = trend ? '<span style="font-size:0.55rem;color:' + (trend==='\u2191'?'var(--vermillion-400)':'var(--celadon-400)') + ';">' + trend + '</span>' : '';
  return '<div style="display:flex;align-items:center;gap:3px;margin-top:2px;font-size:0.6rem;">'
    + '<span style="width:24px;color:var(--color-foreground-muted);">' + label + '</span>'
    + '<div style="flex:1;height:3px;background:var(--color-border-subtle);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + Math.min(100,v) + '%;background:' + color + ';border-radius:2px;"></div></div>'
    + '<span style="width:20px;text-align:right;color:var(--color-foreground-muted);">' + v + '</span>' + tStr
    + '</div>';
}

/** 下旨——预填诏令建议库 */
function _dfEdict(divName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  showPrompt('\u5BF9' + divName + '\u4E0B\u65E8\uFF1A', '', function(content) {
    if (!content) return;
    GM._edictSuggestions.push({ source: '\u5730\u65B9', from: divName, content: content, turn: GM.turn, used: false });
    toast('\u5DF2\u5F55\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93');
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  });
}

/** 更换长官——跳转官制荐贤 */
function _dfChangeGov(divName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5730\u65B9', from: divName, content: '\u66F4\u6362' + divName + '\u957F\u5B98', turn: GM.turn, used: false });
  toast('\u5DF2\u5F55\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93\u2014\u2014\u8BF7\u5728\u8BCF\u4EE4\u4E2D\u4E0B\u65E8');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/** 玩家颁诏实时预警——基于诏令文本分类+阻力估算+历史参照 */
var _edictForecastTimer = null;
function _edictLiveForecast(textareaId) {
  // 防抖
  if (_edictForecastTimer) clearTimeout(_edictForecastTimer);
  _edictForecastTimer = setTimeout(function() {
    var ta = _$(textareaId);
    var fcEl = _$(textareaId + '-forecast');
    if (!ta || !fcEl) return;
    var text = ta.value.trim();
    if (!text || text.length < 4) { fcEl.style.display = 'none'; return; }
    if (typeof classifyEdict !== 'function' || typeof EDICT_TYPES === 'undefined') { fcEl.style.display = 'none'; return; }
    var etype = classifyEdict(text);
    var t = EDICT_TYPES[etype]; if (!t) { fcEl.style.display = 'none'; return; }
    // 组装预警 HTML
    var html = '';
    html += '<div style="color:var(--gold-400);font-weight:600;">' + escHtml(t.label);
    if (typeof formatLifecycleForScript === 'function') {
      html += ' · ' + escHtml(formatLifecycleForScript(etype));
    }
    html += '</div>';
    if (t.phased) html += '<div style="color:var(--amber-400);font-size:0.68rem;">※ 改革类——分试点→推广→反扑→定局 5 阶段</div>';
    if (t.resistance) {
      var resLines = Object.keys(t.resistance).map(function(cls) { return cls + '('+t.resistance[cls]+')'; });
      if (resLines.length) html += '<div style="color:var(--vermillion-400);font-size:0.68rem;">阻力：' + escHtml(resLines.join(' / ')) + '</div>';
    }
    if (t.affectedClasses) {
      var winners = [], losers = [];
      Object.keys(t.affectedClasses).forEach(function(cls) {
        var v = t.affectedClasses[cls];
        if (v > 0) winners.push(cls+'+'+v);
        if (v < 0) losers.push(cls+v);
      });
      if (winners.length || losers.length) {
        html += '<div style="font-size:0.68rem;">';
        if (winners.length) html += '<span style="color:var(--celadon-400);">受益：' + escHtml(winners.join('、')) + '</span>';
        if (winners.length && losers.length) html += ' · ';
        if (losers.length) html += '<span style="color:var(--vermillion-400);">受损：' + escHtml(losers.join('、')) + '</span>';
        html += '</div>';
      }
    }
    if (t.unintendedRisk) {
      var riskMap = {
        middlemen_skim: '⚠ 风险：胥吏截留，惠民打折',
        peasant_revolt: '⚠ 风险：加赋过急可能引发民变',
        elite_backlash: '⚠ 风险：精英阶层反扑，反改革潮'
      };
      if (riskMap[t.unintendedRisk]) html += '<div style="color:var(--amber-400);font-size:0.68rem;">' + riskMap[t.unintendedRisk] + '</div>';
    }
    if (t.historyPaths && t.historyPaths.length) html += '<div style="color:var(--ink-300);font-size:0.65rem;">典范：' + escHtml(t.historyPaths.slice(0,3).join('、')) + '</div>';
    fcEl.innerHTML = html;
    fcEl.style.display = 'block';
  }, 500); // 500ms 防抖
}

/** 修建建筑弹窗——玩家可选已有建筑类型或自定义 */
function _dfBuildModal(divName) {
  var _old = document.getElementById('_dfBuildModal'); if (_old) _old.remove();
  var types = (P.buildingSystem && P.buildingSystem.buildingTypes) || [];
  var html = '<div class="modal-bg show" id="_dfBuildModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:560px;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.08em;">\u3014 \u4FEE\u5EFA\u4E8E' + escHtml(divName) + ' \u3015</h3>';
  html += '<div style="font-size:0.75rem;color:var(--txt-d);margin-bottom:0.6rem;line-height:1.5;">\u53EF\u9009\u5267\u672C\u5DF2\u5B9A\u4E49\u7684\u5EFA\u7B51\uFF0C\u6216\u81EA\u5B9A\u4E49\u65B0\u5EFA\u7B51\u3002AI\u5C06\u6839\u636E\u63CF\u8FF0\u5224\u5B9A\u5408\u7406\u6027\u3001\u8D39\u7528\u3001\u5DE5\u671F\u4E0E\u5B9E\u9645\u6548\u679C\u3002</div>';

  // Tab切换
  html += '<div style="display:flex;gap:4px;margin-bottom:0.5rem;">';
  html += '<button class="bt bsm" id="_bmTabPre" style="flex:1;" onclick="document.getElementById(\'_bmPre\').style.display=\'block\';document.getElementById(\'_bmCustom\').style.display=\'none\';">\u9884\u5B9A\u5EFA\u7B51</button>';
  html += '<button class="bt bsm" id="_bmTabCustom" style="flex:1;" onclick="document.getElementById(\'_bmPre\').style.display=\'none\';document.getElementById(\'_bmCustom\').style.display=\'block\';">\u81EA\u5B9A\u4E49</button>';
  html += '</div>';

  // 预定义建筑选择
  html += '<div id="_bmPre">';
  if (types.length === 0) {
    html += '<div style="color:var(--txt-d);padding:1rem;text-align:center;">\u5267\u672C\u672A\u5B9A\u4E49\u5EFA\u7B51\u7C7B\u578B\uFF0C\u8BF7\u7528\u300C\u81EA\u5B9A\u4E49\u300D</div>';
  } else {
    html += '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:0.3rem;">';
    types.forEach(function(b, i) {
      html += '<div style="padding:0.5rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:6px;cursor:pointer;" onclick="_dfSubmitBuild(&quot;' + encodeURIComponent(divName) + '&quot;,' + i + ',null)">';
      html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:700;">' + escHtml(b.name) + ' <span style="font-size:0.66rem;color:var(--txt-d);">[' + escHtml(b.category || '') + '] \u6700\u9AD8Lv' + (b.maxLevel||5) + ' \u57FA\u672C\u8D39' + (b.baseCost||0) + '\u4E24 \u5DE5\u671F' + (b.buildTime||3) + '\u56DE\u5408</span></div>';
      if (b.description) html += '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.5;margin-top:0.2rem;">' + escHtml(b.description.substring(0, 180)) + (b.description.length>180?'\u2026':'') + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // 自定义建筑
  html += '<div id="_bmCustom" style="display:none;">';
  html += '<div style="margin-bottom:0.5rem;"><label style="font-size:0.78rem;color:var(--gold);">\u5EFA\u7B51\u540D\u79F0</label><input id="_bmCustName" class="fd" placeholder="\u5982\uFF1A\u5174\u6587\u9986 / \u6C34\u8F66\u574A / \u7CAE\u5E93"></div>';
  html += '<div style="margin-bottom:0.5rem;"><label style="font-size:0.78rem;color:var(--gold);">\u7C7B\u522B</label><select id="_bmCustCat" class="fd">';
  ['economic:经济','military:军事','cultural:文化','administrative:行政','religious:宗教','infrastructure:基础设施'].forEach(function(p) {
    var kv = p.split(':'); html += '<option value="' + kv[0] + '">' + kv[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div style="margin-bottom:0.5rem;"><label style="font-size:0.78rem;color:var(--gold);">\u63CF\u8FF0\uFF08\u544AAI\u4F60\u60F3\u4FEE\u4EC0\u4E48\u53CA\u9884\u671F\u6548\u679C\uFF09</label><textarea id="_bmCustDesc" rows="4" class="fd" placeholder="\u4F8B\uFF1A\u4FEE\u6587\u9986\u4EE5\u85CF\u4E66\u5200\u7248\uFF0C\u4F9B\u5C9A\u9633\u5B66\u8005\u5165\u5185\u8BAE\u4E8B\uFF0C\u4EE5\u5174\u6587\u98CE\u3001\u5B89\u78A8\u58EB"></textarea></div>';
  html += '</div>';

  html += '<div style="display:flex;gap:8px;margin-top:0.8rem;justify-content:flex-end;">';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_dfBuildModal\');if(m)m.remove();">\u6492\u5E9C</button>';
  html += '<button class="bt bp" onclick="_dfSubmitBuild(&quot;' + encodeURIComponent(divName) + '&quot;,-1,true)">\u63D0\u4EA4\u81EA\u5B9A\u4E49</button>';
  html += '</div>';
  html += '</div></div>';

  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

/** 提交修建请求到诏令建议库 */
function _dfSubmitBuild(divNameEnc, typeIdx, isCustom) {
  var divName = decodeURIComponent(divNameEnc);
  var content = '';
  if (isCustom) {
    var name = (document.getElementById('_bmCustName')||{}).value || '';
    var cat = (document.getElementById('_bmCustCat')||{}).value || 'economic';
    var desc = (document.getElementById('_bmCustDesc')||{}).value || '';
    if (!name.trim() || !desc.trim()) { toast('请填写建筑名称与描述'); return; }
    content = '于 ' + divName + ' 修建【自定义 · ' + cat + '】' + name + '：' + desc + '。——请AI判定此建筑的合理性、成本、工期与实际效果。';
  } else {
    var types = (P.buildingSystem && P.buildingSystem.buildingTypes) || [];
    var b = types[typeIdx]; if (!b) return;
    content = '于 ' + divName + ' 修建 ' + b.name + (b.baseCost?'（预计费用 '+b.baseCost+' 两，工期 '+(b.buildTime||3)+' 回合）':'') + '。——请AI按其描述综合判定实际效果。';
  }
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5DE5\u7A0B', from: divName, content: content, turn: GM.turn, used: false });
  toast('\u5DF2\u5F55\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93\u2014\u2014\u8BF7\u5728\u8BCF\u4EE4\u533A\u7EB3\u5165\u540E\u9881\u8BCF');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_dfBuildModal'); if (m) m.remove();
}

/** 非直辖区划——中国化操作路径弹窗 */
function _dfNonDirectAction(divName, autonomyType) {
  // 找到该区划及其 autonomy
  var _found = null;
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.name === divName) _found = d;
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }
  if (!_found) { toast('\u672A\u627E\u5230\u533A\u5212'); return; }
  var autonomy = _found.autonomy || { type: autonomyType };
  var holder = autonomy.holder || '(\u672A\u77E5\u6301\u7235\u8005)';

  // 按类型提供中国化操作路径
  var _actions = [];
  var _title = '', _desc = '';
  if (autonomyType === 'fanguo') {
    _title = '\u5BF9\u85E9\u56FD\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E4B\u5C01\u56FD\u3002\u9675\u4E0B\u82E5\u6B32\u7F6E\u5587\uFF0C\u6709\u6570\u7B56\u53EF\u884C\uFF1A';
    _actions = [
      { label: '\u884C\u63A8\u6069\u4EE4', hint: '\u5F3A\u5236\u5206\u5C01\u5176\u5B50\u7B49\u2014\u2014\u5982\u6C49\u6B66\u6545\u4E8B\uFF0C\u6BCF\u4EE3\u5206\u8584\uFF0C\u4E94\u4EE3\u540E\u85E9\u6743\u81EA\u6D88', action: 'edict:\u5BF9' + divName + '\u8840\u8109\u884C\u63A8\u6069\u4EE4\uFF0C\u4EE4' + holder + '\u540E\u5D3F\u7686\u5E94\u5206\u5C01\uFF0C\u6BCF\u4EE3\u5206\u8584\u5176\u571F' },
      { label: '\u65AD\u7136\u524A\u85E9', hint: '\u76F4\u63A5\u5269\u593A\u85E9\u738B\u7235\u571F\u2014\u2014\u5FE0\u8BDA\u66B4\u8DCC\uFF0C\u5F88\u53EF\u80FD\u5F15\u53D1\u53DB\u4E71(\u5982\u4E03\u56FD\u4E4B\u4E71\u3001\u9756\u96BE\u4E4B\u5F79)', action: 'edict:\u524A\u85E9' + divName + '\uFF0C\u5269\u593A' + holder + '\u7235\u571F\uFF0C\u539F\u5C01\u5730\u6536\u5F52\u671D\u5EF7\u76F4\u8F96' },
      { label: '\u4F20\u65E8\u89C4\u8C0F', hint: '\u5229\u7528\u73B0\u6709\u8BCF\u4EE4\u5668\u68B0\u8F93\u9001\u610F\u5FD7\u2014\u2014\u6267\u884C\u529B\u770B\u85E9\u738B\u5FE0\u8BDA', action: 'edict:\u547D' + holder + '\u6574\u6CBB' + divName + '\uFF0C\u5174\u5229\u9664\u5F0A' },
      { label: '\u6696\u6BEB\u62DC\u547D', hint: '\u8D50\u7269\u3001\u52A0\u5C01\u3001\u4EE5\u6069\u62C9\u62E2\u85E9\u738B\u5FE0\u5FC3', action: 'edict:\u8D50' + holder + '\u6042\u5149\uFF0C\u63D0\u9AD8\u5176\u5BF9\u671D\u5EF7\u5FE0\u8BDA' }
    ];
  } else if (autonomyType === 'jimi') {
    _title = '\u5BF9\u7F81\u7E3B\u571F\u53F8\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E16\u88AD\u4E4B\u571F\u3002\u671D\u5EF7\u4F8B\u4E0D\u7F6E\u6D41\u5B98\uFF0C\u9675\u4E0B\u53EF\u884C\uFF1A';
    _actions = [
      { label: '\u6539\u571F\u5F52\u6D41', hint: '\u5C06\u571F\u53F8\u4E4B\u5730\u6539\u4E3A\u6D41\u5B98\u7BA1\u8F96\u2014\u2014\u987B\u5F85\u571F\u53F8\u53DB\u4E71\u6216\u7EDD\u55E3\uFF0C\u6216\u629B\u5F00\u540E\u679C\u5F3A\u63A8', action: 'edict:\u884C\u6539\u571F\u5F52\u6D41\u4E8E' + divName + '\uFF0C\u53D6\u6D88' + holder + '\u571F\u53F8\u8EAB\u4EFD\uFF0C\u7F6E\u6D41\u5B98\u8F96\u5236' },
      { label: '\u6566\u8C15\u5B89\u629A', hint: '\u9063\u4F7F\u6566\u8C15\u6216\u8D50\u5C01\u2014\u2014\u4EE5\u6069\u5B89\u629A\uFF0C\u7EF4\u6301\u5C5E\u4F7F\u5173\u7CFB', action: 'edict:\u9063\u4F7F\u6566\u8C15' + holder + '\uFF0C\u8D50\u5C01\u5B89\u629A\u4F7F\uFF0C\u6C38\u9547\u4E00\u65B9' },
      { label: '\u8C03\u6574\u8D21\u989D', hint: '\u589E\u51CF\u571F\u53F8\u8D21\u8D4B\u989D\u5EA6', action: 'edict:\u8C03\u6574' + holder + '\u5E74\u8D21\u989D\u5EA6' },
      { label: '\u51C6\u5176\u627F\u88AD', hint: '\u627F\u8BA4\u65B0\u4EFB\u571F\u53F8\u8EAB\u4EFD', action: 'edict:\u51C6\u4E88' + holder + '\u7236\u5B50\u627F\u88AD\u571F\u53F8\u4E4B\u804C' }
    ];
  } else if (autonomyType === 'chaogong') {
    _title = '\u5BF9\u671D\u8D21\u5916\u85E9\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E4B\u56FD\uFF0C\u5C5E\u591A\u56FD\u5916\u85E9\u3002\u5929\u671D\u4E0D\u5F97\u76F4\u8F96\uFF0C\u552F\u6709\uFF1A';
    _actions = [
      { label: '\u518C\u5C01\u5176\u541B', hint: '\u9057\u4F7F\u518C\u5C01\u5176\u56FD\u738B/\u4E16\u5B50\u2014\u2014\u5F3A\u5316\u5B97\u85E9\u5173\u7CFB', action: 'edict:\u9057\u4F7F\u518C\u5C01' + holder + '\u4E3A\u5176\u56FD\u541B\u4E3B\uFF0C\u8D50\u4E88\u507D\u547D' },
      { label: '\u52E7\u4EE4\u8FDB\u8D21', hint: '\u52E0\u4EE4\u521D\u8D21\u6216\u5047\u9053\u4ECB\u5165', action: 'edict:\u52E0\u4EE4' + holder + '\u6309\u671F\u8FDB\u8D21\uFF0C\u4EE5\u793A\u5C0A\u670F' },
      { label: '\u6D3E\u9063\u4F7F\u81E3', hint: '\u4E34\u65F6\u6D3E\u4F7F\u8C03\u89E3\u7EAA\u5F8B\u6216\u51B2\u7A81', action: 'edict:\u6D3E\u9063\u4F7F\u81E3\u524D\u5F80' + divName + '\uFF0C\u8C03\u89E3\u5B89\u629A' },
      { label: '\u5174\u5E08\u5F81\u8BA8', hint: '\u5F81\u8BA8\u5E76\u7F6E\u90E1\u2014\u2014\u6C49\u6B66\u706D\u5357\u8D8A\u6545\u4E8B\uFF0C\u9700\u5E74\u9A6C\u538B\u5883', action: 'edict:\u5174\u5E08\u5F81\u8BA8' + holder + '\uFF0C\u5E73\u5B9A\u540E\u4E8E\u5176\u5730\u7F6E\u90E1\u53BF' }
    ];
  } else if (autonomyType === 'fanzhen') {
    _title = '\u5BF9\u85E9\u9547\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E4B\u85E9\u9547\uFF0C\u519B\u653F\u5408\u4E00\u3002\u671D\u5EF7\u96BE\u4EE5\u8282\u5236\uFF1A';
    _actions = [
      { label: '\u5BA3\u8C15\u5165\u671D', hint: '\u52E0\u4EE4\u8282\u5EA6\u4F7F\u5165\u671D\u2014\u2014\u4E00\u822C\u88AB\u963F\u8FDE\u6216\u53CD\u62B3', action: 'edict:\u5BA3\u8C15' + holder + '\u5165\u671D\u89C1\u9A7E\uFF0C\u4EA4\u51FA\u5175\u6743' },
      { label: '\u963B\u5176\u4F20\u8896', hint: '\u963B\u6B62\u5176\u5B50\u7EE7\u627F\u85E9\u9547\u2014\u2014\u6613\u5F15\u81EA\u7ACB', action: 'edict:\u4E0D\u51C6' + holder + '\u4E4B\u5B50\u7EE7\u4EFB' + divName + '\u8282\u5EA6\u4F7F' },
      { label: '\u5174\u5E08\u8BA8\u4F10', hint: '\u76F4\u63A5\u51FA\u5175\u8BA8\u4F10', action: 'edict:\u5174\u5E08\u8BA8\u4F10' + holder + '\uFF0C\u5E73\u5B9A\u540E\u6539' + divName + '\u4E3A\u76F4\u8F96' }
    ];
  } else {
    toast('\u65E0\u53EF\u884C\u4E4B\u7B56'); return;
  }

  // 弹窗（用已有 modal-bg / modal-box CSS）
  var html = '<div class="modal-bg show" id="_dfFeudalModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:540px;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">\u3014 ' + escHtml(_title) + ' \u3015</h3>';
  html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.7;margin-bottom:0.8rem;padding:0.5rem;background:var(--bg-2);border-radius:6px;">' + escHtml(_desc) + '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
  _actions.forEach(function(a, i) {
    html += '<div style="padding:0.6rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:6px;cursor:pointer;" onclick="_dfDoNonDirectAction(' + i + ',&quot;' + encodeURIComponent(divName) + '&quot;,&quot;' + encodeURIComponent(autonomyType) + '&quot;)">';
    html += '<div style="font-size:0.88rem;color:var(--gold);font-weight:700;margin-bottom:0.2rem;">' + escHtml(a.label) + '</div>';
    html += '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.5;">' + escHtml(a.hint) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:0.8rem;"><button class="bt bs" onclick="var m=document.getElementById(\'_dfFeudalModal\');if(m)m.remove();">\u6492\u5E9C\u800C\u56DE</button></div>';
  html += '</div></div>';
  // 缓存动作列表供点击调用
  window._dfNonDirectActions = _actions;
  // 先移除可能存在的旧弹窗
  var _old = document.getElementById('_dfFeudalModal'); if (_old) _old.remove();
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

/** 执行中国化操作——记入诏令建议库 */
function _dfDoNonDirectAction(idx, divNameEnc, autonomyTypeEnc) {
  var divName = decodeURIComponent(divNameEnc);
  var actions = window._dfNonDirectActions || [];
  var a = actions[idx]; if (!a) return;
  // 记入诏令建议库
  var content = a.action.indexOf('edict:') === 0 ? a.action.substring(6) : a.action;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5C01\u5EFA', from: divName, content: content, turn: GM.turn, used: false });
  toast('\u3014' + a.label + '\u3015\u5DF2\u5F55\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_dfFeudalModal'); if (m) m.remove();
}

// 左侧面板渲染
function renderLeftPanel(){
  var gl=_$("gl");if(!gl)return;
  gl.innerHTML="";
  // 标记需要在末尾追加侧面板
  var _needSidePanels = true;

  // P9: 渐进式引导（前3回合，每次renderLeftPanel都检查）
  if (GM.turn && GM.turn <= 3) {
    var _guideMap = {1:{t:'初临朝堂',h:'左侧查看资源和势力·右侧"谕令"下诏·"奏议"批折·"诏付有司"推进'},2:{t:'察言观势',h:'查看诏令执行情况·召开朝议·关注势力动态·建议库有方案'},3:{t:'运筹帷幄',h:'人物关系因决策变化·大臣记住你的选择·利用派系矛盾·此后不再提示'}};
    var _gm = _guideMap[GM.turn];
    if (_gm) {
      var _gDiv = document.createElement('div');
      _gDiv.style.cssText = 'margin-bottom:0.6rem;padding:8px;background:linear-gradient(135deg,rgba(201,169,110,0.12),rgba(201,169,110,0.04));border:1px solid var(--gold-d);border-radius:6px;position:relative;font-size:0.7rem;';
      _gDiv.innerHTML = '<span style="color:var(--gold);font-weight:700;">\u{1F4D6} ' + _gm.t + '</span> <span style="color:var(--txt-d);">(' + GM.turn + '/3)</span><br><span style="color:var(--txt-s);line-height:1.5;">' + _gm.h.split('·').map(function(s){return '\u2022'+s;}).join(' ') + '</span>'
        + '<button onclick="this.parentElement.remove();" style="position:absolute;top:4px;right:6px;background:none;border:none;color:var(--txt-d);cursor:pointer;font-size:0.65rem;">\u2715</button>';
      gl.appendChild(_gDiv);
    }
  }

  // 回合信息（增强版：年号+干支+季节+月日完整显示）
  var ti=document.createElement("div");ti.style.cssText="text-align:center;margin-bottom:0.8rem;";
  var _tsMain = getTS(GM.turn);
  var _tsExtra = '';
  if (typeof calcDateFromTurn === 'function') {
    var _cd = calcDateFromTurn(GM.turn);
    if (_cd) {
      var parts = [];
      // 干支年（始终显示）
      if (_cd.gzYearStr) parts.push(_cd.gzYearStr + '\u5E74');
      // 公元年
      parts.push('\u516C\u5143' + _cd.adYear + '\u5E74');
      // 农历月日
      if (_cd.lunarMonth) parts.push(_cd.lunarMonth + '\u6708');
      // 干支日（始终显示）
      if (_cd.gzDayStr) parts.push(_cd.gzDayStr + '\u65E5');
      _tsExtra = parts.join(' ');
    }
  }
  ti.innerHTML="<div style=\"font-size:1.4rem;font-weight:700;color:var(--gold);\">" + _tsMain + "</div>"
    + (_tsExtra ? "<div style=\"font-size:0.68rem;color:var(--txt-d);margin-top:2px;\">" + _tsExtra + "</div>" : "")
    + "<div style=\"font-size:0.72rem;color:var(--txt-d);\">" + (typeof getTSText==='function'?getTSText(GM.turn):'') + "</div>";
  gl.appendChild(ti);
  // 顶栏年号/时代指示（兼容旧/新结构）
  var barEra=_$("bar-era");
  var _sc=findScenarioById&&findScenarioById(GM.sid);
  if(barEra){ barEra.textContent=(_sc?_sc.name:'')+(GM.eraName?' · '+GM.eraName:''); }
  var _barDyn=_$("bar-dynasty"), _barDate=_$("bar-date"), _barTurnT=_$("bar-turn-text");
  if(_barDyn){ _barDyn.textContent=(_sc?_sc.name:'')+(GM.eraName?' · '+GM.eraName:''); }
  if(_barDate){ _barDate.textContent=(typeof getTSText==='function'?getTSText(GM.turn):''); }
  if(_barTurnT){ _barTurnT.textContent='第 '+(GM.turn||1)+' 回合'; }
  // 四时物候：按 GM.turn 月份推算
  var _wSeal=_$("bar-weather-seal"), _wName=_$("bar-weather-name"), _wDesc=_$("bar-weather-desc");
  if(_wSeal && _wName){
    var _mon=(((GM.turn||1)-1)%12)+1; // 1..12
    var _s='春',_sTxt='春分',_sDesc='桃李始华';
    if(_mon>=3&&_mon<=5){_s='春';_sTxt=['孟春','仲春','季春'][_mon-3];_sDesc=['立春·东风解冻','春分·雷乃发声','谷雨·萍始生'][_mon-3];}
    else if(_mon>=6&&_mon<=8){_s='夏';_sTxt=['孟夏','仲夏','季夏'][_mon-6];_sDesc=['立夏·蝼蝈鸣','夏至·蜩始鸣','大暑·腐草为萤'][_mon-6];}
    else if(_mon>=9&&_mon<=11){_s='秋';_sTxt=['孟秋','仲秋','季秋'][_mon-9];_sDesc=['立秋·凉风至','秋分·鸿雁来','霜降·草木黄落'][_mon-9];}
    else {_s='冬';var _wi=(_mon===12?0:_mon+1);_sTxt=['孟冬','仲冬','季冬'][_wi];_sDesc=['立冬·水始冰','冬至·蚯蚓结','大寒·鸡始乳'][_wi];}
    _wSeal.textContent=_s;
    _wName.textContent=_sTxt;
    if(_wDesc)_wDesc.textContent=_sDesc;
  }
  // 悬浮推演按钮 + 底栏状态条显示
  var _gsTurnFloat=_$("gs-turn-float"), _gsStatusBar=_$("gs-status-bar");
  if(_gsTurnFloat) _gsTurnFloat.classList.add('show');
  if(_gsStatusBar) _gsStatusBar.classList.add('show');
  var _gsStatusSave=_$("gs-status-save"), _gsStatusTurn=_$("gs-status-turn");
  if(_gsStatusSave) _gsStatusSave.textContent=(GM.saveName||'未命名');
  if(_gsStatusTurn) _gsStatusTurn.textContent='第 '+(GM.turn||1)+' 回合';
  // 同步悬浮推演按钮 disabled 状态
  var _gsTurnBig=_$("gs-turn-big");
  if(_gsTurnBig){
    _gsTurnBig.disabled = !!(GM.busy || GM._endTurnBusy);
  }
  // 摘要
  var _gsTurnSummary=_$("gs-turn-summary");
  if(_gsTurnSummary){
    var _ec=(GM._edictSuggestions||[]).filter(function(e){return !e.used;}).length;
    var _mc=(GM.memorials||[]).filter(function(m){return !m.reviewed;}).length;
    _gsTurnSummary.innerHTML='诏 <span class="hl">'+_ec+'</span> · 疏 <span class="hl">'+_mc+'</span>'+(_ec+_mc>0?' · <span class="warn">待处置</span>':' · <span style="color:var(--celadon-400);">朕意已决</span>');
  }
  // 顶栏七官方变量
  if(typeof renderTopBarVars==='function') renderTopBarVars();
  // 改元按钮（始终可用）
  var gaiyuanBtn=document.createElement("button");
  gaiyuanBtn.className="bt bsm";
  gaiyuanBtn.style.cssText="width:100%;margin-bottom:0.5rem;font-size:0.75rem;";
  gaiyuanBtn.innerHTML=tmIcon('scroll',12)+' 改元';
  gaiyuanBtn.onclick=function(){openGaiyuanModal();};
  gl.appendChild(gaiyuanBtn);

  // 朝代阶段徽章
  if(GM.eraState&&GM.eraState.dynastyPhase){
    var _phaseMap={founding:{icon:tmIcon('history',14),label:'开创',color:'var(--indigo-400)'},rising:{icon:tmIcon('history',14),label:'上升',color:'var(--green-400)'},peak:{icon:tmIcon('prestige',14),label:'盛世',color:'var(--gold-400)'},stable:{icon:tmIcon('execution',14),label:'承平',color:'var(--ink-300)'},decline:{icon:tmIcon('unrest',14),label:'衰落',color:'#e67e22'},declining:{icon:tmIcon('unrest',14),label:'衰落',color:'#e67e22'},crisis:{icon:tmIcon('unrest',14),label:'危局',color:'var(--vermillion-400)'},collapse:{icon:tmIcon('close',14),label:'崩溃',color:'var(--vermillion-400)'},revival:{icon:tmIcon('history',14),label:'中兴',color:'var(--green-400)'}};
    var _pi=_phaseMap[GM.eraState.dynastyPhase]||{icon:tmIcon('chronicle',14),label:GM.eraState.dynastyPhase,color:'var(--ink-300)'};
    var phDiv=document.createElement("div");
    phDiv.style.cssText="text-align:center;margin-bottom:0.5rem;padding:0.3rem 0.6rem;background:var(--bg-2);border-radius:6px;border:1px solid var(--bdr);";
    phDiv.innerHTML='<span style="font-size:0.9rem;">'+_pi.icon+'</span> <span style="font-size:0.78rem;color:'+_pi.color+';font-weight:700;">'+_pi.label+'</span>';
    var _es=GM.eraState;
    var _stability=Math.round((_es.socialStability||0.5)*100);
    var _economy=Math.round((_es.economicProsperity||0.5)*100);
    var _central=Math.round((_es.centralControl||0.5)*100);
    phDiv.innerHTML+=' <span style="font-size:0.68rem;color:var(--txt-d);">\u7A33'+_stability+'% \u7ECF'+_economy+'% \u6743'+_central+'%</span>';
    // 可展开的详细参数
    var _unity=Math.round((_es.politicalUnity||0.5)*100);
    var _culture=Math.round((_es.culturalVibrancy||0.5)*100);
    var _bureau=Math.round((_es.bureaucracyStrength||0.5)*100);
    var _mil=Math.round((_es.militaryProfessionalism||0.5)*100);
    phDiv.innerHTML+='<div style="font-size:0.6rem;color:var(--txt-d);margin-top:2px;">\u7EDF\u4E00'+_unity+'% \u6587\u5316'+_culture+'% \u5B98\u50DA'+_bureau+'% \u519B\u4E13'+_mil+'%</div>';
    gl.appendChild(phDiv);
    // 1.8: 时代双进度条
    if (GM.eraProgress) {
      var _epDiv = document.createElement("div");
      _epDiv.style.cssText = "margin-bottom:0.4rem;padding:0.3rem 0.5rem;background:var(--bg-2);border-radius:6px;font-size:0.65rem;";
      var _colPct = Math.min(100, Math.round(GM.eraProgress.collapse));
      var _resPct = Math.min(100, Math.round(GM.eraProgress.restoration));
      _epDiv.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="color:var(--vermillion-400);">\u8870\u9000 ' + _colPct + '</span><span style="color:var(--celadon-400);">\u4E2D\u5174 ' + _resPct + '</span></div>'
        + '<div style="display:flex;gap:2px;height:4px;">'
        + '<div style="flex:1;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _colPct + '%;background:var(--vermillion-400);border-radius:2px;"></div></div>'
        + '<div style="flex:1;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _resPct + '%;background:var(--celadon-400);border-radius:2px;"></div></div>'
        + '</div>';
      gl.appendChild(_epDiv);
    }
  }

  // 1.9: 外部威胁标量显示
  if (GM.borderThreat > 0) {
    var _btDiv = document.createElement("div");
    _btDiv.style.cssText = "margin-bottom:0.4rem;font-size:0.7rem;";
    var _btThresh = (P.mechanicsConfig && P.mechanicsConfig.borderThreat) || {};
    var _btCol = GM.borderThreat >= (_btThresh.criticalThreshold || 80) ? 'var(--vermillion-400)' : GM.borderThreat >= (_btThresh.warningThreshold || 60) ? '#e67e22' : 'var(--txt-d)';
    _btDiv.innerHTML = '<span style="color:' + _btCol + ';">\u8FB9\u60A3 ' + GM.borderThreat + '</span>';
    gl.appendChild(_btDiv);
  }

  // N4: 主角精力显示
  if (GM._energy !== undefined) {
    var _enDiv = document.createElement("div");
    _enDiv.id = '_energyBar';
    _enDiv.style.cssText = "margin-bottom:0.5rem;padding:0.3rem 0.5rem;background:var(--bg-2);border-radius:6px;";
    var _enPct = Math.round((GM._energy / (GM._energyMax || 100)) * 100);
    var _enColor = _enPct > 60 ? 'var(--celadon-400)' : _enPct > 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
    _enDiv.innerHTML = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:2px;">\u7CBE\u529B ' + Math.round(GM._energy) + '/' + (GM._energyMax || 100) + '</div>'
      + '<div style="height:4px;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _enPct + '%;background:' + _enColor + ';border-radius:2px;transition:width 0.3s;"></div></div>';
    gl.appendChild(_enDiv);
  }

  // 季节效果
  var se=getSE(GM.turn);
  if(se){
    var sed=document.createElement("div");
    var _seasonIcons={春:'〔春〕',夏:'〔夏〕',秋:'〔秋〕',冬:'〔冬〕'};
    var _curSeason=calcDateFromTurn?calcDateFromTurn(GM.turn).season:'';
    var _sIcon=_seasonIcons[_curSeason]||'〔时〕';
    sed.style.cssText="font-size:var(--text-xs);color:var(--color-foreground-secondary);text-align:center;margin-bottom:var(--space-2);padding:var(--space-1) var(--space-2);background:var(--color-sunken);border-radius:var(--radius-sm);border:1px solid var(--color-border-subtle);letter-spacing:0.08em;";
    sed.innerHTML=_sIcon+' '+se;
    gl.appendChild(sed);
  }

  // 资源
  var resDiv=document.createElement("div");resDiv.className="pt";resDiv.innerHTML=tmIcon('treasury',12)+' \u8D44\u6E90';gl.appendChild(resDiv);
  Object.entries(GM.vars).forEach(function(e){
    var v=e[1];var _range=(v.max||100)-(v.min||0);var pct=_range>0?Math.round(((v.value||0)-(v.min||0))/_range*100):50;
    var _crit=pct>85||pct<15?' critical':'';
    var rd=document.createElement("div");rd.style.cssText="margin-bottom:0.5rem;";
    rd.innerHTML='<div class="res-label"><span class="res-name">'+(v.icon||"")+e[0]+'</span><span class="res-value stat-number" style="color:'+(v.color||"var(--gold-400)")+'">'+(v.value||0)+'</span></div><div class="rb"><div class="rf'+_crit+'" style="width:'+pct+'%;background:'+(v.color||"var(--gold-400)")+';"></div></div>';
    gl.appendChild(rd);
  });

  // B4: 经济概况
  if (P.economyConfig && P.economyConfig.enabled !== false) {
    var ecDiv = document.createElement("div");
    ecDiv.style.cssText = "margin-bottom:0.5rem;font-size:var(--text-xs);color:var(--color-foreground-muted);background:var(--color-sunken);padding:var(--space-1) var(--space-2);border-radius:var(--radius-sm);border:1px solid var(--color-border-subtle);";
    var ec = P.economyConfig;
    var ecHtml = tmIcon('treasury',12) + ' ';
    ecHtml += (ec.currency || '\u8D2F');
    if (ec.economicCycle) {
      var _ecClr = ec.economicCycle === 'prosperity' ? 'var(--celadon-400)' : ec.economicCycle === 'recession' || ec.economicCycle === 'depression' ? 'var(--vermillion-400)' : 'var(--color-foreground-muted)';
      var _ecLbl = {prosperity:'\u7E41\u8363',stable:'\u7A33\u5B9A',recession:'\u8870\u9000',depression:'\u8427\u6761'}[ec.economicCycle] || '';
      ecHtml += ' <span style="color:' + _ecClr + ';">' + _ecLbl + '</span>';
    }
    ecHtml += ' \u7A0E' + Math.round((ec.taxRate || 0.1) * 100) + '%';
    if (ec.inflationRate > 0.03) ecHtml += ' \u901A\u80C0' + Math.round(ec.inflationRate * 100) + '%';
    ecDiv.innerHTML = ecHtml;
    gl.appendChild(ecDiv);
  }

  // B1: 双层国库显示
  if (P.economyConfig && P.economyConfig.dualTreasury) {
    var treasuryDiv = document.createElement("div");
    treasuryDiv.style.cssText = "margin-bottom:0.5rem;padding:0.4rem 0.5rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);font-size:0.75rem;";
    var _stVal = GM.stateTreasury || 0;
    var _pvVal = GM.privateTreasury || 0;
    var _stColor = _stVal < 0 ? 'var(--vermillion-400)' : 'var(--color-foreground-secondary)';
    var _pvColor = 'var(--celadon-400)';
    treasuryDiv.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:0.2rem;"><span>'+tmIcon('treasury',12)+' 国库</span><span class="stat-number" style="color:'+_stColor+';">'+Math.round(_stVal).toLocaleString()+'</span></div>'
      + '<div style="display:flex;justify-content:space-between;"><span>'+tmIcon('treasury',12)+' 内库</span><span class="stat-number" style="color:'+_pvColor+';">'+Math.round(_pvVal).toLocaleString()+'</span></div>'
      + ((GM._bankruptcyTurns||0) > 0 ? '<div style="color:var(--vermillion-400);font-size:0.65rem;margin-top:0.2rem;">〔财政危机第'+(GM._bankruptcyTurns)+'回合〕</div>' : '');
    gl.appendChild(treasuryDiv);
  }

  // P4: 财务预测——显示下回合预估收支
  if (typeof AccountingSystem !== 'undefined') {
    var _lastLedger = AccountingSystem.getLedger();
    if (_lastLedger && (_lastLedger.totalIncome > 0 || _lastLedger.totalExpense > 0)) {
      var _fcDiv = document.createElement("div");
      _fcDiv.style.cssText = "font-size:0.68rem;color:var(--txt-d);padding:2px 0.5rem;margin-bottom:0.3rem;";
      var _fcNet = _lastLedger.netChange;
      _fcDiv.innerHTML = '\u9884\u4F30\u4E0B\u56DE\u5408\uFF1A<span style="color:' + (_fcNet >= 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)') + ';">' + (_fcNet >= 0 ? '+' : '') + _fcNet.toFixed(0) + '</span>';
      gl.appendChild(_fcDiv);
    }
  }
  // 不显示荒淫值数值——玩家通过叙事和NPC反应感受

  // 主角压力显示
  if (P.playerInfo && P.playerInfo.characterName) {
    var _pChar = typeof findCharByName === 'function' ? findCharByName(P.playerInfo.characterName) : null;
    if (_pChar && (_pChar.stress || 0) > 0) {
      var pStressDiv = document.createElement("div");
      pStressDiv.style.cssText = "margin-bottom:0.4rem;";
      var pStress = _pChar.stress || 0;
      var pStressLabel = pStress > 70 ? '\u5FC3\u529B\u4EA4\u7601' : pStress > 50 ? '\u7126\u8651\u4E0D\u5B89' : pStress > 30 ? '\u7565\u611F\u7591\u60D1' : '\u5C1A\u53EF';
      var pStressColor = pStress > 70 ? 'var(--red)' : pStress > 50 ? '#e67e22' : pStress > 30 ? 'var(--blue)' : 'var(--txt-d)';
      var _moodIcon = '';
      if (_pChar._mood && _pChar._mood !== '\u5E73') {
        var _pmi = {'\u559C':'\uD83D\uDE0A','\u6012':'\uD83D\uDE20','\u5FE7':'\uD83D\uDE1F','\u60E7':'\uD83D\uDE28','\u6068':'\uD83D\uDE24','\u656C':'\uD83D\uDE4F'};
        _moodIcon = (_pmi[_pChar._mood] || '') + ' ';
      }
      pStressDiv.innerHTML = "<div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>" + _moodIcon + "\u5FC3\u5883</span><span style=\"color:" + pStressColor + ";font-size:0.7rem;\">" + pStressLabel + "</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:" + pStress + "%;background:" + pStressColor + ";\"></div></div>";
      gl.appendChild(pStressDiv);
    }
  }

  // 季度议程按钮
  var agendaBtn=document.createElement("button");
  agendaBtn.className="bt bsm";
  agendaBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  agendaBtn.innerHTML=tmIcon('agenda',14)+" \u65F6\u5C40\u8981\u52A1";
  agendaBtn.onclick=function(){openQuarterlyAgenda();};
  gl.appendChild(agendaBtn);

  // 省级经济按钮
  var provinceBtn=document.createElement("button");
  provinceBtn.className="bt bsm";
  provinceBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  provinceBtn.innerHTML=tmIcon('office',14)+" \u5730\u65B9\u533A\u5212";
  provinceBtn.onclick=function(){openProvinceEconomy();};
  gl.appendChild(provinceBtn);

  // P5: 军事面板——活跃战争概览
  if (GM.activeWars && GM.activeWars.length > 0) {
    var _warDiv = document.createElement("div");
    _warDiv.style.cssText = "margin-top:0.5rem;padding:0.4rem 0.5rem;background:rgba(192,57,43,0.1);border:1px solid var(--vermillion-400);border-radius:6px;";
    var _warHtml = '<div style="font-size:0.75rem;color:var(--vermillion-400);font-weight:700;margin-bottom:3px;">' + tmIcon('troops',12) + ' \u6D3B\u8DC3\u6218\u4E89 (' + GM.activeWars.length + ')</div>';
    GM.activeWars.forEach(function(w) {
      _warHtml += '<div style="font-size:0.7rem;color:var(--txt-s);padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">'
        + escHtml(w.attacker || '?') + ' \u2694\uFE0F ' + escHtml(w.defender || '?')
        + (w.warScore !== undefined ? ' <span style="color:' + (w.warScore > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)') + ';">\u6218\u5206' + w.warScore + '</span>' : '')
        + '</div>';
    });
    _warDiv.innerHTML = _warHtml;
    gl.appendChild(_warDiv);
  }

  // 记忆锚点按钮——已隐藏（数据继续供 AI 推演记忆使用）
  // 如需调试查看，可在控制台执行 openMemoryAnchors() 或开启 P.conf.debugMemoryAnchor
  if (P.conf && P.conf.debugMemoryAnchor) {
    var memoryBtn=document.createElement("button");
    memoryBtn.className="bt bsm";
    memoryBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);opacity:0.5;";
    memoryBtn.innerHTML=tmIcon('chronicle',14)+" \u5927\u4E8B\u8BB0\uFF08\u8C03\u8BD5\uFF09";
    memoryBtn.onclick=function(){openMemoryAnchors();};
    gl.appendChild(memoryBtn);
  }

  // 天下大势按钮（合并历史事件+时代趋势）
  var situationBtn=document.createElement("button");
  situationBtn.className="bt bsm";
  situationBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  situationBtn.innerHTML=tmIcon('history',14)+" \u5929\u4E0B\u5927\u52BF";
  situationBtn.onclick=function(){openWorldSituation();};
  gl.appendChild(situationBtn);

  // AI性能监控按钮
  if (P.ai && P.ai.key) {
    var aiPerfBtn=document.createElement("button");
    aiPerfBtn.className="bt bsm";
    aiPerfBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
    aiPerfBtn.innerHTML=tmIcon('settings',14)+" AI\u8C03\u5EA6";
    aiPerfBtn.onclick=function(){openAIPerformance();};
    gl.appendChild(aiPerfBtn);
  }

  // 帮助按钮
  var helpBtn=document.createElement("button");
  helpBtn.className="bt bsm";
  helpBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  helpBtn.innerHTML=tmIcon('scroll',14)+" 帮助";
  helpBtn.onclick=function(){openHelp();};
  gl.appendChild(helpBtn);

  // 音频设置按钮
  var audioBtn=document.createElement("button");
  audioBtn.className="bt bsm";
  audioBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  audioBtn.innerHTML=tmIcon('settings',14)+" 音频";
  audioBtn.onclick=function(){openAudioSettings();};
  gl.appendChild(audioBtn);

  // 主题设置按钮
  var themeBtn=document.createElement("button");
  themeBtn.className="bt bsm";
  themeBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  themeBtn.innerHTML=tmIcon('policy',14)+" 主题";
  themeBtn.onclick=function(){openThemeSettings();};
  gl.appendChild(themeBtn);

  // 关系
  if(Object.keys(GM.rels).length>0){
    var relTitle=document.createElement("div");relTitle.className="pt";relTitle.textContent="\u5173\u7CFB";relTitle.style.marginTop="0.8rem";gl.appendChild(relTitle);
    Object.entries(GM.rels).forEach(function(e){
      var v=e[1];var color=v.value>30?"var(--green)":v.value<-30?"var(--red)":"var(--blue)";
      var rd=document.createElement("div");rd.style.cssText="display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.78rem;";
      rd.innerHTML="<span>"+e[0]+"</span><span style=\"color:"+color+";\">"+v.value+"</span>";
      gl.appendChild(rd);
    });
  }

  // 风闻录事（原"大事记"）——收录朝野耳目、弹章、耳报、风议、密札、登闻状
  var evtTitle=document.createElement("div");evtTitle.className="pt";evtTitle.textContent="\u98CE\u95FB\u5F55\u4E8B";evtTitle.style.marginTop="0.8rem";gl.appendChild(evtTitle);
  var evtDiv=document.createElement("div");evtDiv.id="evt-log";evtDiv.style.cssText="max-height:200px;overflow-y:auto;";
  evtDiv.innerHTML=GM.evtLog.length>0?GM.evtLog.slice(-20).reverse().map(_fmtEvt).join(""):"<div style=\"color:var(--txt-d);font-size:0.78rem;text-align:center;padding:0.5rem;\">\u6682\u65E0\u98CE\u95FB</div>";
  gl.appendChild(evtDiv);

  // P10: 上下文功能提示——根据当前游戏状态提示可做的事
  var _hints = [];
  if (GM.activeWars && GM.activeWars.length > 0) _hints.push('\u6B63\u5728\u4EA4\u6218\uFF0C\u53EF\u4E0B\u8FBE\u519B\u4EE4');
  if (GM._edictSuggestions && GM._edictSuggestions.filter(function(s){return !s.used;}).length > 0) _hints.push('\u5EFA\u8BAE\u5E93\u6709\u672A\u91C7\u7EB3\u65B9\u6848');
  if (_hints.length > 0) {
    var hintDiv = document.createElement('div');
    hintDiv.style.cssText = 'margin-top:0.5rem;padding:0.4rem;background:rgba(201,169,110,0.08);border-radius:6px;border:1px dashed var(--gold-d);';
    hintDiv.innerHTML = '<div style="font-size:0.65rem;color:var(--gold);margin-bottom:2px;">\u63D0\u793A</div>' + _hints.map(function(h){ return '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.5;">\u00B7 ' + h + '</div>'; }).join('');
    gl.appendChild(hintDiv);
  }

  // 追加侧面板（势力/阶层/党派/军事/目标等——由renderSidePanels管理）
  if (typeof renderSidePanels === 'function') renderSidePanels();
}

// 游戏主界面渲染
function openGaiyuanModal(){  var cur=GM.eraName||"";  var t=P.time;var tpy=4;if(t.perTurn==="1y")tpy=1;else if(t.perTurn==="1m")tpy=12;  var yo=Math.floor((GM.turn-1)/tpy);var y=t.year+yo;  var mo=t.startMonth||1;  var html="<div style='padding:1rem'>"+    "<div style='margin-bottom:0.8rem;color:var(--gold);font-weight:700'>"+"改元"+"</div>"+    "<div style='font-size:0.85rem;color:var(--txt-d);margin-bottom:0.8rem'>"+"当前年号："+cur+"。改元后将使用新年号。"+"</div>"+    "<div class='rw'>"+    "<div class='fd'><label>"+"新年号名"+"</label><input id='gy-name' value=''  placeholder='如建安、建兴…'></div>"+    "<div class='fd'><label>"+"起始年"+"</label><input type='number' id='gy-year' value='"+y+"'></div>"+    "<div class='fd'><label>"+"起始月"+"</label><input type='number' id='gy-month' min='1' max='12' value='"+mo+"'></div>"+    "<div class='fd'><label>"+"起始日"+"</label><input type='number' id='gy-day' min='1' max='31' value='1'></div>"+    "</div></div>";  openGenericModal("改元",html,function(){    var name=(_$("gy-name")||{}).value||"";    if(!name){toast("年号名不能为空");return false;}    var ey=parseInt((_$("gy-year")||{}).value)||y;    var em=parseInt((_$("gy-month")||{}).value)||mo;    var ed=parseInt((_$("gy-day")||{}).value)||1;    if(!GM.eraNames)GM.eraNames=[];    GM.eraNames.push({name:name,startYear:ey,startMonth:em,startDay:ed});    GM.eraName=name;    if(!P.time.eraNames)P.time.eraNames=[];    P.time.eraNames.push({name:name,startYear:ey,startMonth:em,startDay:ed});    P.time.enableEraName=true;    saveP();renderLeftPanel();    toast("改元为"+name+"元年");  });}// ============================================================
// Tooltip 系统（轻量单例）
// ============================================================
var TmTooltip = {
  _el: null,
  _timer: null,
  _getEl: function() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'tm-tooltip';
      document.body.appendChild(this._el);
    }
    return this._el;
  },
  show: function(anchor, html) {
    var el = this._getEl();
    el.innerHTML = html;
    el.classList.add('visible');
    // 定位：优先锚点下方
    var r = anchor.getBoundingClientRect();
    var top = r.bottom + 6;
    var left = r.left;
    // 溢出翻转
    if (top + 200 > window.innerHeight) top = r.top - el.offsetHeight - 6;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
    if (left < 4) left = 4;
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  },
  hide: function() {
    if (this._el) this._el.classList.remove('visible');
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  },
  /** 绑定hover tooltip到元素 */
  bind: function(el, contentFn) {
    var self = this;
    el.addEventListener('mouseenter', function() {
      self._timer = setTimeout(function() { self.show(el, contentFn()); }, 120);
    });
    el.addEventListener('mouseleave', function() { self.hide(); });
  }
};

// ============================================================
// 全局资源栏渲染（顶栏动态指标+回合变化量）
// ============================================================
function renderBarResources() {
  var bar = _$('bar');
  if (!bar || !GM.running) return;
  var container = bar.querySelector('.bar-resources');
  if (!container) {
    container = document.createElement('div');
    container.className = 'bar-resources';
    var btns = _$('bar-btns');
    if (btns) bar.insertBefore(container, btns);
    else bar.appendChild(container);
  }
  // 顶栏指标待重新规划——GM.vars 自定义资源已撤出
  container.innerHTML = '';
}

// ============================================================
// 角色详情——人物志完整页（6-tab 布局，匹配 preview-char-full.html）
// ============================================================
// 人物志面板 → 官制入口(关闭人物志+切官制 tab·高亮目标官职)
function _rwpOpenOffice(name) {
  if (!name) return;
  try { document.getElementById('_renwuPageOv') && document.getElementById('_renwuPageOv').classList.remove('open'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  if (typeof switchGTab === 'function') switchGTab(null, 'gt-office');
  if (typeof renderOfficeTree === 'function') setTimeout(function(){ try { renderOfficeTree(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}} }, 50);
  if (typeof toast === 'function') toast('已切至官制·查看 '+name+' 职位');
}
// 人物志面板 → 问对入口(关闭人物志+打开问对弹窗)
function _rwpOpenWendui(name) {
  if (!name) return;
  try { document.getElementById('_renwuPageOv') && document.getElementById('_renwuPageOv').classList.remove('open'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  if (typeof openWenduiModal === 'function') {
    openWenduiModal(name, 'private');
  } else {
    // 降级：切到问对 tab + 设置 target
    try { GM.wenduiTarget = name; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
    if (typeof switchGTab === 'function') switchGTab(null, 'gt-wendui');
    if (typeof toast === 'function') toast('已切至问对·' + name);
  }
}
// 人物志面板 → 传书入口(关闭人物志+切传书 tab·预填收信人)
function _rwpOpenLetter(name) {
  if (!name) return;
  try { document.getElementById('_renwuPageOv') && document.getElementById('_renwuPageOv').classList.remove('open'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  if (typeof switchGTab === 'function') switchGTab(null, 'gt-letter');
  // 预填目标
  setTimeout(function(){
    try {
      var toInp = document.getElementById('letter-to') || document.querySelector('[data-role="letter-to"]');
      if (toInp) { toInp.value = name; if (typeof toInp.dispatchEvent === 'function') toInp.dispatchEvent(new Event('input', { bubbles: true })); }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
    if (typeof renderLetterPanel === 'function') renderLetterPanel();
  }, 50);
  if (typeof toast === 'function') toast('可传书予·' + name);
}
function _rwpFameSeal(fame) {
  var v = typeof fame === 'number' ? fame : (fame && fame.value) || 0;
  if (v >= 80) return { cls: 'radiant', label: '+' + Math.round(v) + ' 朝宗' };
  if (v >= 50) return { cls: 'bright', label: '+' + Math.round(v) + ' 儒望' };
  if (v >= 20) return { cls: 'clear', label: '+' + Math.round(v) + ' 清誉' };
  if (v > -10) return { cls: 'neutral', label: (v >= 0 ? '+' : '') + Math.round(v) + ' 无闻' };
  if (v > -40) return { cls: 'stain', label: Math.round(v) + ' 微瑕' };
  return { cls: 'infamy', label: Math.round(v) + ' 恶名' };
}
function _rwpXianTier(virtue) {
  var v = typeof virtue === 'number' ? virtue : (virtue && virtue.merit) || 0;
  if (v >= 800) return '师表';
  if (v >= 500) return '朝宗';
  if (v >= 300) return '儒望';
  if (v >= 150) return '清誉';
  if (v >= 50) return '有闻';
  return '未识';
}
function _rwpXianPct(virtue) {
  var v = typeof virtue === 'number' ? virtue : (virtue && virtue.merit) || 0;
  var stages = [0, 50, 150, 300, 500, 800];
  for (var i = stages.length - 1; i >= 0; i--) {
    if (v >= stages[i]) {
      var next = stages[i + 1] || 1000;
      return Math.max(0, Math.min(100, ((v - stages[i]) / (next - stages[i])) * 100));
    }
  }
  return 0;
}
function _rwpAbilityRank(v) {
  if (v >= 85) return 'excel';
  if (v >= 70) return 'good';
  if (v >= 40) return '';
  return 'poor';
}
function _rwpAbilityRankLabel(v) {
  if (v >= 90) return '卓异';
  if (v >= 80) return '优秀';
  if (v >= 70) return '中上';
  if (v >= 50) return '寻常';
  if (v >= 30) return '稍逊';
  return '下愚';
}
function _rwpMoodCls(emotion) {
  var map = {'喜':'happy','怒':'angry','忧':'worry','惧':'fear','恨':'hate','敬':'respect','平':'peace'};
  return map[emotion] || 'peace';
}
function _rwpLoyaltyTag(v) {
  if (v >= 80) return '忠贞可托';
  if (v >= 60) return '尚堪一用';
  if (v >= 40) return '貌合神离';
  if (v >= 20) return '心怀异志';
  return '叛骨天成';
}
function _rwpAmbitionTag(v) {
  if (v >= 80) return '志在九霄';
  if (v >= 60) return '图有远略';
  if (v >= 40) return '知进退';
  if (v >= 20) return '安守本分';
  return '淡泊无求';
}
function _rwpHeartVerdict(loy, amb) {
  if (loy >= 70 && amb <= 60) return { cls: '', text: '可 托 以 一 方 · 良 臣 之 选' };
  if (loy >= 70 && amb > 60) return { cls: 'warn', text: '忠 而 有 志 · 宜 善 驭 之' };
  if (loy < 40 && amb >= 70) return { cls: 'danger', text: '心 怀 异 志 · 慎 防 反 侧' };
  if (loy < 40) return { cls: 'warn', text: '忠 诚 可 疑 · 须 加 看 护' };
  return { cls: '', text: '中 规 中 矩 · 可 观 后 效' };
}

/** 渲染八才雷达 SVG */
function _rwpRenderRadar(ch) {
  // 8维：智武军政管魅交仁
  var abilities = [
    { key: 'intelligence', label: '智', val: ch.intelligence || 50 },
    { key: 'valor', label: '武', val: ch.valor || 50 },
    { key: 'military', label: '军', val: ch.military || 50 },
    { key: 'administration', label: '政', val: ch.administration || 50 },
    { key: 'management', label: '管', val: ch.management || ch.administration || 50 },
    { key: 'charisma', label: '魅', val: ch.charisma || 50 },
    { key: 'diplomacy', label: '交', val: ch.diplomacy || 50 },
    { key: 'benevolence', label: '仁', val: ch.benevolence || 50 }
  ];
  var cx = 110, cy = 110, rMax = 80;
  // 生成数据多边形点
  var dataPts = abilities.map(function(a, i) {
    var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
    var r = (a.val / 100) * rMax;
    return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1);
  }).join(' ');
  // 8条轴线 + 标签位置
  var axisLines = '', labels = '', dots = '';
  abilities.forEach(function(a, i) {
    var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
    var ex = cx + rMax * Math.cos(angle);
    var ey = cy + rMax * Math.sin(angle);
    axisLines += '<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'"/>';
    var lx = cx + (rMax + 14) * Math.cos(angle);
    var ly = cy + (rMax + 14) * Math.sin(angle) + 4;
    labels += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'">'+a.label+'</text>';
    var pr = (a.val / 100) * rMax;
    var px = cx + pr * Math.cos(angle);
    var py = cy + pr * Math.sin(angle);
    dots += '<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="2.5"/>';
  });
  // 网格多边形（4层）
  var grids = '';
  [0.25, 0.5, 0.75, 1.0].forEach(function(scale) {
    var pts = abilities.map(function(_, i) {
      var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
      var r = scale * rMax;
      return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1);
    }).join(' ');
    grids += '<polygon points="'+pts+'"/>';
  });
  var svg = '<svg class="rwp-radar" viewBox="0 0 220 220">' +
    '<g stroke="rgba(184,154,83,0.12)" fill="none" stroke-width="1">' + grids + '</g>' +
    '<g stroke="rgba(184,154,83,0.15)" stroke-width="1">' + axisLines + '</g>' +
    '<polygon points="'+dataPts+'" fill="rgba(184,154,83,0.2)" stroke="var(--gold-400)" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<g fill="var(--gold-300)">' + dots + '</g>' +
    '<g fill="var(--ink-300)" font-size="11" font-family="serif" text-anchor="middle" letter-spacing="2">' + labels + '</g>' +
    '</svg>';
  return { svg: svg, abilities: abilities };
}

/** 渲染简化家族树 SVG */
function _rwpRenderFamilyTree(ch) {
  var members = (ch.familyMembers && Array.isArray(ch.familyMembers)) ? ch.familyMembers : [];
  if (members.length === 0) return '<div style="padding:24px;text-align:center;color:#d4be7a;font-style:italic;">家 谱 暂 缺 · 史 笔 未 录</div>';
  // 按代分组
  var groups = {'-2':[],'-1':[],'0':[],'1':[],'2':[]};
  members.forEach(function(m) {
    var g = m.generation !== undefined ? m.generation : 0;
    if (groups[g]) groups[g].push(m);
  });
  // 本人加入 gen 0
  groups[0].unshift({ name: ch.name, zi: ch.zi, relation: '本人', self: true, age: ch.age, title: ch.title||ch.officialTitle||'' });
  var svg = '<svg viewBox="0 0 900 580" class="rwp-ft-svg">';
  var genLabels = {'-2':'祖 辈','-1':'父 辈','0':'同 辈','1':'子 嗣','2':'孙 辈'};
  var yMap = {'-2':35, '-1':155, '0':275, '1':400, '2':525};
  // 世代标签
  svg += '<g class="ft-gen-labels" font-family="serif" font-size="11" letter-spacing="3" fill="#8a6d2b">';
  Object.keys(genLabels).forEach(function(g) {
    if (groups[g] && groups[g].length > 0) svg += '<text x="14" y="'+(yMap[g]+25)+'">'+genLabels[g]+'</text>';
  });
  svg += '<line x1="8" y1="35" x2="8" y2="555" stroke="#8a6d2b" stroke-width="1" opacity="0.4"/></g>';
  // 节点
  svg += '<g class="ft-nodes" font-family="serif">';
  Object.keys(groups).forEach(function(g) {
    var row = groups[g];
    if (!row.length) return;
    var startX = 60;
    var gap = Math.min(120, (820 - 100) / row.length);
    row.forEach(function(m, i) {
      var x = startX + i * gap;
      var y = yMap[g];
      var dead = m.dead || m.deceased;
      var inLaw = m.inLaw || m.relation && /妻|嫂|媳|姻/.test(m.relation);
      var cls = m.self ? 'self' : (dead ? 'dead' : (inLaw ? 'in-law' : ''));
      var rectFill = m.self ? 'rgba(184,154,83,0.12)' : (inLaw ? 'rgba(126,184,167,0.05)' : 'rgba(0,0,0,0.3)');
      var rectStroke = m.self ? '#d4be7a' : (inLaw ? '#7eb8a7' : '#b89a53');
      var rectStrokeW = m.self ? '2' : '1';
      var dashAttr = inLaw ? ' stroke-dasharray="3,2"' : '';
      var textColor = m.self ? '#d4be7a' : (dead ? '#9d917d' : (inLaw ? '#d4c9b0' : '#f8f3e8'));
      var relColor = m.self ? '#d4be7a' : (inLaw ? '#7eb8a7' : '#b89a53');
      svg += '<g class="ft-node '+cls+'" transform="translate('+x+','+y+')">';
      svg += '<rect width="100" height="'+(m.self?50:40)+'" rx="4" fill="'+rectFill+'" stroke="'+rectStroke+'" stroke-width="'+rectStrokeW+'"'+dashAttr+'/>';
      svg += '<text x="50" y="16" text-anchor="middle" font-size="9" fill="'+relColor+'" letter-spacing="2">'+(m.relation||'亲属')+'</text>';
      svg += '<text x="50" y="'+(m.self?33:29)+'" text-anchor="middle" font-size="'+(m.self?15:13)+'" fill="'+textColor+'" '+(m.self?'font-weight="bold"':'')+'>'+escHtml((m.name||'')+(dead?' †':''))+'</text>';
      var sub = '';
      if (m.self) sub = (m.zi?'字'+m.zi+' · ':'') + (m.age?m.age+' · ':'') + (m.title||'');
      else sub = (m.age?m.age+' · ':'') + (m.title||m.note||'');
      svg += '<text x="50" y="'+(m.self?44:38)+'" text-anchor="middle" font-size="'+(m.self?9:8)+'" fill="'+(m.self?'#b89a53':'#9d917d')+'">'+escHtml(sub)+'</text>';
      svg += '</g>';
    });
  });
  svg += '</g></svg>';
  return svg;
}

// ───────────────────────────────────────────────────────────────────
// 快速详情面板 openCharDetail（440px 右滑，点角色名入口）
// ───────────────────────────────────────────────────────────────────
function openCharDetail(charName) {
  var ch = typeof findCharByName === 'function' ? findCharByName(charName) : null;
  if (!ch) { toast('未找到角色'); return; }
  if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureFullFields === 'function') {
    try { CharFullSchema.ensureFullFields(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  } else if (typeof CharEconEngine !== 'undefined' && typeof CharEconEngine.ensureCharResources === 'function') {
    try { CharEconEngine.ensureCharResources(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  }

  var ov = document.getElementById('_charDetailOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_charDetailOv';
    ov.className = 'char-detail-overlay';
    ov.innerHTML = '<div class="char-detail-panel" id="_charDetailPanel"></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
    document.body.appendChild(ov);
  }
  var panel = document.getElementById('_charDetailPanel');

  var loy = Math.round(ch.loyalty || 50);
  var amb = Math.round(ch.ambition || 50);
  var res = ch.resources || {};
  var pub = res.publicPurse || res.publicTreasury || {};
  var priv = res.privateWealth || {};
  var fame = res.fame !== undefined ? res.fame : 0;
  var virtue = res.virtueMerit !== undefined ? res.virtueMerit : 0;
  var health = Math.round(res.health !== undefined ? res.health : (ch.health !== undefined ? ch.health : 80));
  var stress = Math.round(res.stress !== undefined ? res.stress : (ch.stress || 0));
  var gender = ch.gender || (ch.isFemale ? 'female' : 'male');
  // 兼容中/英 gender 值：'女'|'female' 视为女·'男'|'male' 视为男
  var isFemale = (gender === 'female' || gender === '女' || ch.isFemale === true);
  var age = ch.age || '';
  var fameS = _rwpFameSeal(fame);
  var xianTier = _rwpXianTier(virtue);
  var radar = _rwpRenderRadar(ch);
  var safeName = (ch.name||'').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  var h = '';
  // 头部
  h += '<div class="qp-head">';
  var portraitInner = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" alt="">' : escHtml((ch.name||'').charAt(0));
  h += '<div class="qp-portrait">'+portraitInner+'</div>';
  h += '<div class="qp-heading">';
  h += '<div><span class="qp-name">' + escHtml(ch.name || '') + '</span>';
  if (ch.zi || ch.courtesyName) h += '<span class="qp-courtesy">'+escHtml(ch.zi||ch.courtesyName)+'</span>';
  if (gender) h += '<span class="qp-gender-age">' + (isFemale?'♀':'♂') + (age?age:'') + '</span>';
  h += '</div>';
  if (ch.title || ch.officialTitle) {
    h += '<div class="qp-title">' + escHtml(ch.officialTitle || ch.title || '');
    if (ch.rankLevel) h += ' · ' + (typeof rankLevelToText === 'function' ? rankLevelToText(ch.rankLevel) : '品级'+ch.rankLevel);
    h += '</div>';
  }
  h += '<div class="qp-location-line">';
  if (ch.location) {
    h += '<span class="rwp-mini-tag loc" style="font-size:9px;">'+escHtml(ch.location)+'</span>';
    if (ch._travelTo) h += '<span class="rwp-mini-tag travel" style="font-size:9px;">→'+escHtml(ch._travelTo)+'</span>';
  }
  if (ch.faction) h += '<span class="rwp-mini-tag fac" style="font-size:9px;">'+escHtml(ch.faction)+(ch.party?' · '+escHtml(ch.party):'')+'</span>';
  h += '</div>';
  h += '</div>';
  h += '<button class="qp-close" onclick="document.getElementById(\'_charDetailOv\').classList.remove(\'open\')">×</button>';
  h += '</div>';

  // 心性
  var loyCol = loy>=70?'var(--celadon-300)':loy<=30?'var(--vermillion-300)':'var(--ink-50)';
  var ambCol = amb>=70?'var(--purple-400,#8e44ad)':'var(--ink-50)';
  h += '<div class="qp-sec"><div class="qp-sec-title">心 性</div>';
  h += '<div class="qp-heart-mini">';
  h += '<div class="qp-heart-mini-item loy"><span class="qp-heart-mini-lb">忠</span><span class="qp-heart-mini-v" style="color:'+loyCol+';">'+loy+'</span></div>';
  h += '<div class="qp-heart-mini-item amb"><span class="qp-heart-mini-lb">野</span><span class="qp-heart-mini-v" style="color:'+ambCol+';">'+amb+'</span></div>';
  h += '</div></div>';

  // 品行状态四格
  var hCls = health>=70?'':health>=40?'warn':'crit';
  var sCls = stress>=70?'crit':stress>=40?'warn':'';
  h += '<div class="qp-sec"><div class="qp-sec-title">品 行 状 态</div>';
  h += '<div class="rwp-stats-row" style="gap:6px;">';
  h += '<div class="rwp-stat-card" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">名望</div><div class="rwp-fame-seal '+fameS.cls+'" style="font-size:10px;padding:2px 6px;">'+fameS.label+'</div></div>';
  h += '<div class="rwp-stat-card rwp-xian-card" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">贤能</div><div class="rwp-stat-card-value" style="font-size:16px;">'+Math.round(virtue)+'</div><div class="rwp-xian-tier" style="font-size:8px;">'+xianTier+'</div></div>';
  h += '<div class="rwp-stat-card rwp-health-card '+hCls+'" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">健</div><div class="rwp-stat-card-value" style="font-size:16px;">'+health+'</div></div>';
  h += '<div class="rwp-stat-card rwp-health-card '+sCls+'" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">压</div><div class="rwp-stat-card-value" style="font-size:16px;">'+stress+'</div></div>';
  h += '</div></div>';

  // 公库·私产（压缩）
  h += '<div class="qp-sec"><div class="qp-sec-title">公 库 · 私 产</div>';
  h += '<div class="rwp-grid-2" style="gap:6px;">';
  var pubMoney = pub.money || pub.balance || 0;
  var pubGrain = pub.grain || 0;
  var pubCloth = pub.cloth || 0;
  var prMoney = priv.money || priv.cash || 0;
  var prGrain = priv.grain || 0;
  var prCloth = priv.cloth || 0;
  h += '<div style="padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:3px;">';
  h += '<div style="font-size:9px;color:var(--gold-400);letter-spacing:0.2em;text-align:center;margin-bottom:3px;">公 库</div>';
  h += '<div style="font-size:10px;line-height:1.7;">钱 '+_fmtShort(pubMoney)+' · 粮 '+_fmtShort(pubGrain)+' · 布 '+_fmtShort(pubCloth)+'</div></div>';
  h += '<div style="padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:3px;">';
  h += '<div style="font-size:9px;color:var(--gold-400);letter-spacing:0.2em;text-align:center;margin-bottom:3px;">私 产</div>';
  h += '<div style="font-size:10px;line-height:1.7;"><span'+(prMoney<0?' style="color:var(--vermillion-300);"':'')+'>钱 '+(prMoney<0?'-':'')+_fmtShort(Math.abs(prMoney))+'</span> · 粮 '+_fmtShort(prGrain)+' · 布 '+_fmtShort(prCloth)+'</div></div>';
  h += '</div></div>';

  // 能力八才（紧凑 2x4）
  h += '<div class="qp-sec"><div class="qp-sec-title">能 力 八 才</div>';
  h += '<div class="rwp-ability-grid" style="gap:4px;">';
  var abLabels = {intelligence:'智',valor:'武',military:'军',administration:'政',management:'管',charisma:'魅',diplomacy:'交',benevolence:'仁'};
  var rkShort = {excel:'优',good:'良','':'寻',poor:'逊'};
  radar.abilities.forEach(function(a) {
    var rk = _rwpAbilityRank(a.val);
    h += '<div class="rwp-ability-cell '+rk+'" style="padding:4px 8px;"><span class="rwp-ability-cell-name" style="font-size:11px;">'+abLabels[a.key]+'</span>';
    h += '<div class="rwp-ability-cell-right"><span class="rwp-ability-cell-value" style="font-size:14px;">'+a.val+'</span>';
    h += '<span class="rwp-ability-cell-rank" style="font-size:9px;">'+rkShort[rk]+'</span></div></div>';
  });
  h += '</div></div>';

  // 五常
  if (typeof calculateWuchang === 'function') {
    var wc = calculateWuchang(ch);
    h += '<div class="qp-sec"><div class="qp-sec-title">五 常 · 气 质</div>';
    h += '<div class="rwp-stat-grid five" style="gap:3px;">';
    ['仁','义','礼','智','信'].forEach(function(k) {
      h += '<div class="rwp-stat" style="padding:4px;"><div class="rwp-stat-label">'+k+'</div><div class="rwp-stat-value" style="font-size:12px;">'+(wc[k]||0)+'</div></div>';
    });
    h += '</div>';
    if (wc.气质) h += '<div style="font-size:10px;color:var(--gold-400);text-align:center;margin-top:4px;letter-spacing:0.2em;">气质 · '+wc.气质+'</div>';
    h += '</div>';
  }

  // 特质 · 情绪
  var hasTraits = (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions);
  var mood = '';
  if (ch._memory && ch._memory.length > 0) {
    var recent = ch._memory.slice(-3);
    var moodCount = {};
    recent.forEach(function(m) { if (m.emotion) moodCount[m.emotion] = (moodCount[m.emotion]||0) + 1; });
    var maxN = 0;
    Object.keys(moodCount).forEach(function(k) { if (moodCount[k] > maxN) { maxN = moodCount[k]; mood = k; } });
  }
  if (hasTraits || mood) {
    h += '<div class="qp-sec"><div class="qp-sec-title">特 质 · 情 绪</div>';
    if (hasTraits) {
      h += '<div>';
      ch.traitIds.slice(0, 5).forEach(function(tid) {
        var d = P.traitDefinitions.find(function(t) { return t.id === tid; });
        if (!d) return;
        var cls = 'gold';
        if (d.dims && d.dims.boldness > 0.2) cls = 'valor';
        else if (d.dims && d.dims.compassion > 0.2) cls = 'heart';
        else if (d.dims && d.dims.rationality > 0.2) cls = 'mind';
        h += '<span class="rwp-trait-tag '+cls+'" style="font-size:10px;padding:2px 8px;">'+escHtml(d.name)+'</span>';
      });
      h += '</div>';
    }
    if (mood && mood !== '平') {
      var mCls = _rwpMoodCls(mood);
      var mTxt = {'喜':'心境欣然','怒':'怒气未消','忧':'心事深重','惧':'惶恐难安','恨':'怨恨难消','敬':'心怀感念'}[mood] || mood;
      h += '<div style="margin-top:6px;"><span class="rwp-mood-chip '+mCls+'" style="font-size:11px;padding:3px 10px;">〔'+mood+'〕'+mTxt+'</span></div>';
    }
    h += '</div>';
  }

  // 外貌 / 生平（省略号）
  if (ch.appearance) {
    h += '<div class="qp-sec"><div class="qp-sec-title">外 貌</div>';
    h += '<div class="rwp-prose italic" style="font-size:11px;padding:6px 10px;line-height:1.6;text-indent:0;">'+escHtml(ch.appearance)+'</div></div>';
  }
  if (ch.bio) {
    h += '<div class="qp-sec"><div class="qp-sec-title">生 平</div>';
    h += '<div class="rwp-prose" style="font-size:11px;padding:6px 10px;line-height:1.6;text-indent:0;">'+escHtml(ch.bio.length>160?ch.bio.slice(0,160)+'……':ch.bio)+'</div></div>';
  }

  // 近五记忆
  if (ch._memory && ch._memory.length > 0) {
    h += '<div class="qp-sec"><div class="qp-sec-title">近 五 记 忆</div>';
    h += '<div style="font-size:11px;">';
    ch._memory.slice(-5).reverse().forEach(function(m) {
      var mc = _rwpMoodCls(m.emotion);
      h += '<div class="rwp-mem '+mc+'" style="padding:3px 0 3px 10px;font-size:10px;"><span class="rwp-mem-mood '+mc+'">〔'+m.emotion+'〕</span>'+escHtml((m.event||'').slice(0,36));
      if (m.who) h += '<span class="rwp-mem-who">('+escHtml(m.who)+')</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  // 志向
  if (ch.personalGoal) {
    var gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : 0;
    var gpc = gsat>=60?'var(--celadon-300)':gsat>=30?'var(--gold-300)':'var(--vermillion-300)';
    h += '<div class="qp-sec"><div class="qp-sec-title">个 人 志 向</div>';
    h += '<div style="padding:8px 10px;background:rgba(0,0,0,0.22);border-left:2px solid var(--gold-500);border-radius:0 3px 3px 0;font-size:11px;line-height:1.6;">';
    h += escHtml(ch.personalGoal);
    h += '<div style="margin-top:4px;font-size:10px;"><span style="color:#d4be7a;">满足度</span> <span style="color:'+gpc+';font-weight:600;">'+gsat+'%</span></div>';
    h += '</div></div>';
  }

  // 入口到完整人物志
  h += '<div class="qp-link-more" onclick="openCharRenwuPage(\''+safeName+'\')">〔 点 开 人 物 志 查 看 完 整 〕</div>';

  panel.innerHTML = h;
  ov.classList.add('open');
}

function _fmtShort(v) {
  v = v || 0;
  if (Math.abs(v) >= 10000) return (v/10000).toFixed(1)+'万';
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  return Math.round(v);
}

// ───────────────────────────────────────────────────────────────────
// 人物志完整页 openCharRenwuPage（1120px 居中，6 Tab，双击或点"完整人物志"入口）
// ───────────────────────────────────────────────────────────────────
function openCharRenwuPage(charName) {
  var ch = typeof findCharByName === 'function' ? findCharByName(charName) : null;
  if (!ch) { toast('未找到角色'); return; }
  if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureFullFields === 'function') {
    try { CharFullSchema.ensureFullFields(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  }

  var ov = document.getElementById('_renwuPageOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_renwuPageOv';
    ov.className = 'renwu-page-overlay';
    ov.innerHTML = '<div class="renwu-page-container" id="_renwuPageContainer"></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
    document.body.appendChild(ov);
  }
  var panel = document.getElementById('_renwuPageContainer');

  // ─── 数据预备 ───
  var loy = Math.round(ch.loyalty || 50);
  var amb = Math.round(ch.ambition || 50);
  var res = (ch.resources || {});
  var pub = res.publicPurse || res.publicCoffers || {};
  var priv = res.privateWealth || {};
  var fame = res.fame !== undefined ? res.fame : (res.fameValue || 0);
  var virtue = res.virtueMerit !== undefined ? res.virtueMerit : (res.virtue || 0);
  var health = Math.round(res.health !== undefined ? res.health : (ch.health !== undefined ? ch.health : 80));
  var stress = Math.round(res.stress !== undefined ? res.stress : (ch.stress || 0));
  var gender = ch.gender || (ch.isFemale ? 'female' : 'male');
  var isFemale = (gender === 'female' || gender === '女' || ch.isFemale === true);
  var age = ch.age || '';
  var fameS = _rwpFameSeal(fame);
  var xianTier = _rwpXianTier(virtue);
  var xianPct = _rwpXianPct(virtue);
  var radar = _rwpRenderRadar(ch);

  // ─── 头部区 ───
  var h = '<div class="rwp-top">';
  h += '<div class="rwp-identity-row">';
  // 头像
  var portraitInner = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" alt="">' : escHtml((ch.name||'').charAt(0));
  h += '<div class="rwp-portrait'+(ch.portrait?' has-image':'')+'">'+portraitInner+'</div>';
  // 身份体
  h += '<div class="rwp-ident-body">';
  h += '<div class="rwp-name-row">';
  h += '<div class="rwp-name">' + escHtml(ch.name || '') + '</div>';
  if (ch.zi || ch.courtesyName) h += '<div class="rwp-courtesy">'+escHtml(ch.zi || ch.courtesyName)+'</div>';
  if (gender) h += '<span class="rwp-gender '+(isFemale?'female':'male')+'">'+(isFemale?'女':'男')+(age?' · '+age:'')+'</span>';
  h += '</div>';
  // 官职
  if (ch.title || ch.officialTitle) {
    h += '<div class="rwp-title"><b>' + escHtml(ch.officialTitle || ch.title || '') + '</b>';
    if (ch.rankLevel) h += ' · ' + (typeof rankLevelToText === 'function' ? rankLevelToText(ch.rankLevel) : '品级'+ch.rankLevel);
    h += '</div>';
  }
  // mini tags
  h += '<div class="rwp-mini-tags">';
  if (ch.location) {
    h += '<span class="rwp-mini-tag loc">所在地 '+escHtml(ch.location)+'</span>';
    if (ch._travelTo) h += '<span class="rwp-mini-tag travel">→ '+escHtml(ch._travelTo)+'</span>';
  }
  if (ch.faction) h += '<span class="rwp-mini-tag fac">势力 · '+escHtml(ch.faction)+'</span>';
  if (ch.family) {
    var tierMap = {imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
    h += '<span class="rwp-mini-tag clan">'+escHtml(ch.family)+(ch.familyTier?' · '+(tierMap[ch.familyTier]||ch.familyTier):'')+'</span>';
  }
  if (ch.learning) h += '<span class="rwp-mini-tag origin">'+escHtml(ch.learning)+'</span>';
  if (ch.birthplace) h += '<span class="rwp-mini-tag">籍贯 '+escHtml(ch.birthplace)+'</span>';
  if (ch.ethnicity || ch.faith) h += '<span class="rwp-mini-tag">'+(ch.ethnicity||'')+(ch.ethnicity&&ch.faith?' · ':'')+(ch.faith||'')+'</span>';
  if (ch.culture) h += '<span class="rwp-mini-tag">'+escHtml(ch.culture)+'</span>';
  if (ch.party) h += '<span class="rwp-mini-tag">'+escHtml(ch.party+(ch.partyRank?' · '+ch.partyRank:''))+'</span>';
  h += '</div>';
  h += '</div>';
  // 操作按钮
  h += '<div class="rwp-actions">';
  var safeName = (ch.name||'').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  if (GM.running) {
    h += '<button class="rwp-act-btn" onclick="_rwpOpenWendui(\''+safeName+'\')">问 对</button>';
    h += '<button class="rwp-act-btn" onclick="_rwpOpenLetter(\''+safeName+'\')">传 书</button>';
    if (ch.officialTitle || ch.title) {
      h += '<button class="rwp-act-btn" onclick="_rwpOpenOffice(\''+safeName+'\')">官 制</button>';
    }
  }
  h += '<button class="rwp-act-btn close" onclick="document.getElementById(\'_renwuPageOv\').classList.remove(\'open\')">×</button>';
  h += '</div>';
  h += '</div>'; // identity row

  // 心性二维
  var loyFillCls = loy >= 60 ? 'loyalty-hi' : 'loyalty-lo';
  var ambFillCls = amb >= 70 ? 'ambition-hi' : amb >= 40 ? 'ambition-mid' : 'ambition-lo';
  h += '<div class="rwp-heart">';
  h += '<div class="rwp-heart-item loyalty"><span class="rwp-heart-label">忠 诚</span>';
  h += '<div class="rwp-heart-bar"><div class="rwp-heart-bar-fill '+loyFillCls+'" style="width:'+loy+'%;"></div></div>';
  h += '<span class="rwp-heart-value">'+loy+'</span>';
  h += '<span class="rwp-heart-tag">'+_rwpLoyaltyTag(loy)+'</span></div>';
  h += '<div class="rwp-heart-item ambition"><span class="rwp-heart-label">野 心</span>';
  h += '<div class="rwp-heart-bar"><div class="rwp-heart-bar-fill '+ambFillCls+'" style="width:'+amb+'%;"></div></div>';
  h += '<span class="rwp-heart-value">'+amb+'</span>';
  h += '<span class="rwp-heart-tag">'+_rwpAmbitionTag(amb)+'</span></div>';
  h += '</div>';
  var verdict = _rwpHeartVerdict(loy, amb);
  h += '<div class="rwp-verdict'+(verdict.cls?' '+verdict.cls:'')+'">综合评估：'+verdict.text+'</div>';
  h += '</div>'; // rwp-top

  // ─── Tab 导航 ───
  h += '<div class="rwp-tabs">';
  ['概 要','身 世','家 谱','仕 途','心 绪','关 系'].forEach(function(t, i) {
    h += '<button class="rwp-tab'+(i===0?' active':'')+'" onclick="_rwpSwitchTab(this,'+i+')">'+t+'</button>';
  });
  h += '</div>';

  h += '<div class="rwp-tab-panels">';

  // ═══ Tab 1: 概要 ═══
  h += '<div class="rwp-tab-panel active">';
  // 资源
  h += '<div class="rwp-sec">';
  h += '<div class="rwp-sec-title">资 源<small>公库与官职绑定，私产归个人</small></div>';
  h += '<div class="rwp-grid-2">';
  // 公私财富
  h += '<div class="rwp-res-block">';
  h += '<div class="rwp-res-subgroup"><div class="rwp-res-sublabel">公 库 · 职 权 支 配</div><div class="rwp-res-items">';
  h += _rwpResItem(pub.money||0, '贯', 'coin');
  h += _rwpResItem(pub.grain||0, '石', 'grain');
  h += _rwpResItem(pub.cloth||0, '匹', 'cloth');
  h += '</div></div>';
  h += '<div class="rwp-res-subgroup"><div class="rwp-res-sublabel">私 产</div><div class="rwp-res-items">';
  h += _rwpResItem(priv.money||0, '贯', 'coin');
  h += _rwpResItem(priv.grain||0, '石', 'grain');
  h += _rwpResItem(priv.cloth||0, '匹', 'cloth');
  h += '</div></div>';
  h += '</div>';
  // 品行状态四格
  h += '<div class="rwp-res-block">';
  h += '<div class="rwp-res-sublabel">品 行 状 态</div>';
  h += '<div class="rwp-stats-row">';
  // 名望
  h += '<div class="rwp-stat-card"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="4" width="14" height="16" rx="1"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
  h += '<div class="rwp-stat-card-label">名 望</div><div class="rwp-fame-seal '+fameS.cls+'">'+fameS.label+'</div></div>';
  // 贤能
  h += '<div class="rwp-stat-card rwp-xian-card"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 19.2 8 13.7 4 9.8l5.5-.8z"/></svg>';
  h += '<div class="rwp-stat-card-label">贤 能</div><div class="rwp-stat-card-value">'+Math.round(virtue)+'</div>';
  h += '<div class="rwp-xian-tier">'+xianTier+'</div><div class="rwp-xian-prog"><div class="rwp-xian-prog-fill" style="width:'+xianPct.toFixed(1)+'%;"></div></div></div>';
  // 健康
  var hCls = health>=70?'':health>=40?'warn':'crit';
  h += '<div class="rwp-stat-card rwp-health-card '+hCls+'"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></svg>';
  h += '<div class="rwp-stat-card-label">健 康</div><div class="rwp-stat-card-value">'+health+'</div>';
  h += '<div class="rwp-health-bar"><div class="rwp-health-bar-fill health" style="width:'+health+'%;"></div></div></div>';
  // 压力
  var sCls = stress>=70?'crit':stress>=40?'warn':'';
  var sBarCls = stress>=60?'stress-hi':stress>=30?'stress-mid':'stress-lo';
  var sSub = stress>=80?'将 崩':stress>=60?'负 重':stress>=30?'承 重':'从 容';
  h += '<div class="rwp-stat-card rwp-health-card '+sCls+'"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12c1.5-3 5.5-5 7-5s5.5 2 7 5M12 7v10M8 17h8"/></svg>';
  h += '<div class="rwp-stat-card-label">压 力</div><div class="rwp-stat-card-value">'+stress+'</div>';
  h += '<div class="rwp-stat-card-sub">'+sSub+'</div>';
  h += '<div class="rwp-health-bar"><div class="rwp-health-bar-fill '+sBarCls+'" style="width:'+stress+'%;"></div></div></div>';
  h += '</div></div>';
  h += '</div></div>';

  // 能力八才
  h += '<div class="rwp-sec">';
  h += '<div class="rwp-sec-title">能 力 八 才<small>忠诚野心已移至顶部心性</small></div>';
  h += '<div class="rwp-abilities">' + radar.svg;
  h += '<div class="rwp-ability-grid">';
  var abLabels = {intelligence:'智 力',valor:'武 勇',military:'军 事',administration:'政 务',management:'管 理',charisma:'魅 力',diplomacy:'外 交',benevolence:'仁 厚'};
  radar.abilities.forEach(function(a) {
    var rk = _rwpAbilityRank(a.val);
    var label = _rwpAbilityRankLabel(a.val);
    h += '<div class="rwp-ability-cell '+rk+'"><span class="rwp-ability-cell-name">'+abLabels[a.key]+'</span>';
    h += '<div class="rwp-ability-cell-right"><span class="rwp-ability-cell-value">'+a.val+'</span>';
    h += '<span class="rwp-ability-cell-rank">'+label+'</span></div></div>';
  });
  h += '</div></div></div>';

  // 五常 + 特质
  h += '<div class="rwp-grid-2">';
  h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">五 常</div>';
  if (typeof calculateWuchang === 'function') {
    var wc = calculateWuchang(ch);
    h += '<div class="rwp-stat-grid five">';
    ['仁','义','礼','智','信'].forEach(function(k) {
      h += '<div class="rwp-stat"><div class="rwp-stat-label">'+k+'</div><div class="rwp-stat-value">'+(wc[k]||0)+'</div></div>';
    });
    h += '</div>';
    if (wc.气质) h += '<div style="text-align:center;font-size:11px;color:var(--gold-400);margin-top:6px;letter-spacing:0.2em;">气 质：'+wc.气质+'</div>';
  } else {
    h += '<div style="color:#d4be7a;font-size:11px;">五 常 未 启</div>';
  }
  h += '</div>';
  h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">性 格 特 质</div>';
  if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
    h += '<div>';
    ch.traitIds.forEach(function(tid) {
      var d = P.traitDefinitions.find(function(t) { return t.id === tid; });
      if (!d) return;
      var cls = 'gold';
      if (d.dims && d.dims.boldness > 0.2) cls = 'valor';
      else if (d.dims && d.dims.compassion > 0.2) cls = 'heart';
      else if (d.dims && d.dims.rationality > 0.2) cls = 'mind';
      h += '<span class="rwp-trait-tag '+cls+'">'+escHtml(d.name)+'</span>';
    });
    h += '</div>';
  } else if (ch.traits && Array.isArray(ch.traits)) {
    h += '<div>';
    ch.traits.forEach(function(t) {
      h += '<span class="rwp-trait-tag gold">'+escHtml(typeof t==='string'?t:(t.name||''))+'</span>';
    });
    h += '</div>';
  } else {
    h += '<div style="color:#d4be7a;font-size:11px;">特 质 未 录</div>';
  }
  if (ch.personality) h += '<div style="font-size:11px;color:var(--ink-300);margin-top:6px;line-height:1.6;font-style:italic;">'+escHtml(ch.personality)+'</div>';
  h += '</div>';
  h += '</div>';

  // 志向
  if (ch.personalGoal) {
    var gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : 0;
    var gPctCls = gsat >= 60 ? 'hi' : gsat >= 30 ? 'mid' : 'lo';
    h += '<div class="rwp-sec" style="margin-top:18px;"><div class="rwp-sec-title">个 人 志 向</div>';
    h += '<div class="rwp-goal-card"><div class="rwp-goal-text">'+escHtml(ch.personalGoal)+'</div>';
    h += '<div class="rwp-goal-progress"><span class="rwp-goal-label">满 足 度</span>';
    h += '<div class="rwp-goal-bar"><div class="rwp-goal-bar-fill" style="width:'+gsat+'%;"></div></div>';
    h += '<span class="rwp-goal-pct '+gPctCls+'">'+gsat+'%</span></div></div></div>';
  }
  h += '</div>'; // tab1

  // ═══ Tab 2: 身世 ═══
  h += '<div class="rwp-tab-panel">';
  h += '<div class="rwp-sec"><div class="rwp-sec-title">身 份 档 案</div>';
  h += '<div class="rwp-identity-grid">';
  var idCells = [
    {l:'性 别', v: isFemale?'女':'男'},
    {l:'年 龄', v: age || '未详'},
    {l:'身 份', v: ch.role || '—'},
    {l:'职 业', v: ch.occupation || ch.officialTitle || '—'},
    {l:'籍 贯', v: ch.birthplace || '—'},
    {l:'所 在 地', v: ch.location + (ch._travelTo?' \u2192 '+ch._travelTo+((typeof ch._travelRemainingDays==='number'&&ch._travelRemainingDays>0)?'\uFF08\u8FD8\u9700 '+ch._travelRemainingDays+' \u65E5\uFF09':''):''), cls: ch._travelTo?'warn':''},
    {l:'势 力', v: ch.faction || '无'},
    {l:'民 族', v: ch.ethnicity || '—'},
    {l:'信 仰', v: ch.faith || '—'},
    {l:'文 化', v: ch.culture || '—'},
    {l:'学 识', v: ch.learning || '—', cls: ch.learning?'hi':''},
    {l:'辞 令', v: ch.diction || '—'},
    {l:'立 场', v: ch.stance || '—', cls: ch.stance==='改革'?'hi':''},
    {l:'党 派', v: ch.party ? ch.party+(ch.partyRank?' · '+ch.partyRank:'') : '—'},
    {l:'家 族', v: ch.family ? ch.family+(ch.familyTier?' · '+({imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'}[ch.familyTier]||ch.familyTier):'') : '—'},
    {l:'与 君 主', v: ch.playerRelation || '—'}
  ];
  idCells.forEach(function(c) {
    h += '<div class="rwp-id-cell"><div class="rwp-id-label">'+c.l+'</div><div class="rwp-id-value'+(c.cls?' '+c.cls:'')+'">'+escHtml(c.v||'—')+'</div></div>';
  });
  h += '</div></div>';

  // 公私身份对照
  h += '<div class="rwp-sec"><div class="rwp-sec-title">公 私 身 份 对 照</div>';
  h += '<div class="rwp-duo">';
  h += '<div class="rwp-duo-col public"><div class="rwp-duo-header">官 职 身 份</div>';
  h += '<div class="rwp-duo-row"><span class="label">官职</span><span class="val">'+escHtml(ch.officialTitle||ch.title||'—')+'</span></div>';
  if (ch.rankLevel) h += '<div class="rwp-duo-row"><span class="label">品级</span><span class="val">'+(typeof rankLevelToText==='function'?rankLevelToText(ch.rankLevel):'品级'+ch.rankLevel)+'</span></div>';
  if (ch.officeDuties) h += '<div class="rwp-duo-row"><span class="label">职事</span><span class="val">'+escHtml(ch.officeDuties)+'</span></div>';
  if (ch.superior) h += '<div class="rwp-duo-row"><span class="label">上司</span><span class="val">'+escHtml(ch.superior)+'</span></div>';
  if (ch.concurrentTitle) h += '<div class="rwp-duo-row"><span class="label">兼衔</span><span class="val">'+escHtml(ch.concurrentTitle)+'</span></div>';
  h += '</div>';
  h += '<div class="rwp-duo-col private"><div class="rwp-duo-header">私 人 身 份</div>';
  if (ch.familyRole) h += '<div class="rwp-duo-row"><span class="label">家中</span><span class="val">'+escHtml(ch.familyRole)+'</span></div>';
  if (ch.mentor) h += '<div class="rwp-duo-row"><span class="label">师承</span><span class="val">'+escHtml(ch.mentor)+'</span></div>';
  if (ch.friends) h += '<div class="rwp-duo-row"><span class="label">好友</span><span class="val">'+escHtml(Array.isArray(ch.friends)?ch.friends.join(' · '):ch.friends)+'</span></div>';
  if (ch.hobbies) h += '<div class="rwp-duo-row"><span class="label">爱好</span><span class="val">'+escHtml(Array.isArray(ch.hobbies)?ch.hobbies.join(' · '):ch.hobbies)+'</span></div>';
  if (ch.zi || ch.haoName) h += '<div class="rwp-duo-row"><span class="label">字号</span><span class="val">'+(ch.zi||'')+(ch.haoName?' · 号'+ch.haoName:'')+'</span></div>';
  h += '</div></div></div>';

  if (ch.appearance) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">外 貌</div><div class="rwp-prose italic">'+escHtml(ch.appearance)+'</div></div>';
  }
  if (ch.bio) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">生 平</div><div class="rwp-prose">'+escHtml(ch.bio)+'</div></div>';
  }
  if (ch.background || ch.description) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">角 色 描 写</div><div class="rwp-prose">'+escHtml(ch.background || ch.description)+'</div></div>';
  }
  h += '</div>'; // tab2

  // ═══ Tab 3: 家谱 ═══
  h += '<div class="rwp-tab-panel">';
  h += '<div class="rwp-sec"><div class="rwp-sec-title">家 谱 · 五 代 树<small>金框为本人 · 虚线为姻亲</small></div>';
  h += '<div class="rwp-ft-svg-wrap">' + _rwpRenderFamilyTree(ch) + '</div>';
  h += '<div class="rwp-ft-legend">';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark self"></span>本 人</span>';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark blood"></span>血 亲</span>';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark inlaw"></span>姻 亲</span>';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark dead"></span>已 故</span>';
  h += '</div></div>';
  // 家族统览
  if (ch.family || ch.familyTier) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">家 族 · 统 览</div>';
    h += '<div class="rwp-ft-clan-grid">';
    var clanPrestige = ch.clanPrestige !== undefined ? ch.clanPrestige : 50;
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">族 望</div><div class="rwp-ft-clan-v-big">'+Math.round(clanPrestige)+'</div><div class="rwp-ft-clan-bar"><span class="rwp-ft-clan-bar-fill" style="width:'+clanPrestige+'%;"></span></div></div>';
    var tierMap2 = {imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">门 第</div><div class="rwp-ft-clan-v-big" style="color:var(--celadon-300);">'+(tierMap2[ch.familyTier]||'—')+'</div></div>';
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">家 族 势 力</div><div class="rwp-ft-clan-v-big" style="font-size:16px;">'+escHtml(ch.party||ch.faction||'—')+'</div></div>';
    var clanSize = (ch.familyMembers && ch.familyMembers.length) || 0;
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">族 丁 总 数</div><div class="rwp-ft-clan-v-big">'+clanSize+'</div></div>';
    h += '</div></div>';
  }
  // 姻亲四族·从 familyMembers 中筛 inLaw 或关系为姻亲的·按 family 聚合
  try {
    var _inlaws = {};
    (ch.familyMembers || []).forEach(function(m) {
      if (!m) return;
      var rel = (m.relation || m.role || '');
      var isInLaw = m.inLaw === true || /妻|嫂|媳|姻|岳|丈人|舅|姑/.test(rel);
      if (!isInLaw) return;
      var fam = m.family || (m.name && m.name.length >= 2 ? m.name.charAt(0)+'氏' : '');
      if (!fam) return;
      if (!_inlaws[fam]) _inlaws[fam] = { family: fam, members: [], relations: [] };
      _inlaws[fam].members.push(m.name || '');
      if (rel) _inlaws[fam].relations.push(rel);
    });
    // 从 ch.family (本家) 反推母族/妻族·用 spouseClan / motherClan 字段
    if (ch.motherClan && !_inlaws[ch.motherClan]) _inlaws[ch.motherClan] = { family: ch.motherClan, members: [], relations: ['母族'] };
    if (ch.spouseClan && !_inlaws[ch.spouseClan]) _inlaws[ch.spouseClan] = { family: ch.spouseClan, members: [], relations: ['妻族'] };
    var _inlawList = Object.keys(_inlaws).map(function(k){ return _inlaws[k]; });
    if (_inlawList.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">姻 亲 诸 族</div>';
      h += '<div style="padding:10px 14px;background:rgba(0,0,0,0.22);border-radius:5px;">';
      _inlawList.slice(0, 8).forEach(function(inl) {
        var relText = inl.relations.length ? ('（'+inl.relations.slice(0,2).join('·')+'）') : '';
        h += '<div style="font-size:12px;color:var(--ink-200);margin:3px 0;line-height:1.9;">· <span style="color:var(--celadon-300);">'+escHtml(inl.family)+'</span>'+relText;
        if (inl.members.length) h += '<span style="color:var(--ink-400);font-size:11px;margin-left:6px;">'+inl.members.slice(0,3).map(escHtml).join('·')+'</span>';
        h += '</div>';
      });
      h += '</div></div>';
    }
  } catch(_inlawE) { console.warn('[人物志] 姻亲段', _inlawE); }
  // 在朝者·从 GM.chars 筛同 family 且有官职者
  try {
    if (ch.family) {
      var _inCourt = (GM.chars || []).filter(function(cc) {
        if (!cc || cc.dead) return false;
        if (cc.family !== ch.family) return false;
        return !!(cc.officialTitle || cc.title);
      }).slice(0, 10);
      if (_inCourt.length > 0) {
        h += '<div class="rwp-sec"><div class="rwp-sec-title">在 朝 者</div>';
        h += '<div style="padding:10px 14px;background:rgba(184,154,83,0.06);border:1px solid rgba(184,154,83,0.2);border-radius:3px;">';
        _inCourt.forEach(function(cc) {
          var isSelf = cc.name === ch.name;
          var nmCls = isSelf ? 'var(--gold-300)' : (cc.party && cc.party === ch.party ? 'var(--celadon-300)' : 'var(--ink-50)');
          var roleTxt = cc.name === ch.name ? '（本人）' : '';
          var rkTxt = cc.rankLevel ? ('·'+(typeof rankLevelToText==='function'?rankLevelToText(cc.rankLevel):'品'+cc.rankLevel)) : '';
          h += '<div style="font-size:12px;line-height:1.8;">· <b style="color:'+nmCls+';">'+escHtml(cc.name)+'</b>'+roleTxt
             + '（'+escHtml(cc.officialTitle||cc.title||'')+rkTxt+'）</div>';
        });
        h += '</div></div>';
      }
    }
  } catch(_incE) { console.warn('[人物志] 在朝者段', _incE); }
  h += '</div>'; // tab3

  // ═══ Tab 4: 仕途 ═══
  h += '<div class="rwp-tab-panel">';
  // 仕途履历（从 ch._scars milestone 或 ch.career 构建）
  h += '<div class="rwp-sec"><div class="rwp-sec-title">仕 途 履 历</div>';
  if (ch.career && Array.isArray(ch.career) && ch.career.length > 0) {
    h += '<div class="rwp-timeline">';
    ch.career.forEach(function(c) {
      var ms = c.milestone ? ' milestone' : '';
      h += '<div class="rwp-timeline-item'+ms+'"><div class="rwp-timeline-date">'+escHtml(c.date||c.time||'')+'</div>';
      h += '<div class="rwp-timeline-title">'+escHtml(c.title||c.event||'')+'</div>';
      if (c.desc) h += '<div class="rwp-timeline-desc">'+escHtml(c.desc)+'</div>';
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<div style="padding:12px;text-align:center;color:#d4be7a;font-style:italic;">仕 途 尚 浅 · 事 迹 未 录</div>';
  }
  h += '</div>';
  // 经历·大事纪·从 ch._scars milestone 或 ch._experience 构建
  try {
    var _bigEvents = [];
    if (Array.isArray(ch._scars)) {
      ch._scars.forEach(function(s) {
        if (s && (s.milestone || s.bigEvent || s.emotion === '敬' || s.emotion === '恨')) {
          _bigEvents.push({ date: s.turn?('T'+s.turn):'', title: s.event||'', desc: s.who?('与 '+s.who):'', milestone: !!s.milestone });
        }
      });
    }
    if (Array.isArray(ch._chronicle)) {
      ch._chronicle.slice(-8).forEach(function(c) {
        _bigEvents.push({ date: c.turn?('T'+c.turn):'', title: c.title||c.event||'', desc: c.desc||'', milestone: !!c.milestone });
      });
    }
    if (_bigEvents.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">经 历 · 大 事 纪<small>近 8 条</small></div>';
      h += '<div class="rwp-timeline">';
      _bigEvents.slice(-8).forEach(function(e) {
        var ms = e.milestone ? ' milestone' : '';
        h += '<div class="rwp-timeline-item'+ms+'"><div class="rwp-timeline-date">'+escHtml(e.date)+'</div>';
        h += '<div class="rwp-timeline-title">'+escHtml(e.title)+'</div>';
        if (e.desc) h += '<div class="rwp-timeline-desc">'+escHtml(e.desc)+'</div>';
        h += '</div>';
      });
      h += '</div></div>';
    }
  } catch(_beE) { console.warn('[人物志] 大事纪段', _beE); }
  // 文事作品集·从 ch.works / ch.culturalWorks 读
  try {
    var _works = [];
    if (Array.isArray(ch.works)) _works = _works.concat(ch.works);
    if (Array.isArray(ch.culturalWorks)) _works = _works.concat(ch.culturalWorks);
    // 也扫 GM.culturalWorks 中 author === ch.name
    if (Array.isArray(GM.culturalWorks)) {
      GM.culturalWorks.forEach(function(w) {
        if (w && w.author === ch.name) _works.push(w);
      });
    }
    if (_works.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">文 事 作 品 集<small>近 '+Math.min(_works.length, 8)+' 件</small></div>';
      _works.slice(-8).forEach(function(w) {
        var title = w.title || w.name || '无题';
        var meta = [];
        if (w.date || w.turn) meta.push(w.date || ('T'+w.turn));
        if (w.genre || w.type) meta.push(w.genre || w.type);
        if (w.distribution || w.circulated) meta.push(w.distribution || '流传');
        h += '<div class="rwp-work-card"><div class="rwp-work-title">《 '+escHtml(title)+' 》</div>';
        if (meta.length) h += '<div class="rwp-work-meta">'+escHtml(meta.join(' · '))+'</div>';
        if (w.extract || w.excerpt || w.content) {
          var ext = (w.extract || w.excerpt || w.content).slice(0, 90);
          h += '<div class="rwp-work-extract">"'+escHtml(ext)+(ext.length>=90?'……':'')+'"</div>';
        }
        h += '</div>';
      });
      h += '</div>';
    }
  } catch(_wkE) { console.warn('[人物志] 作品集段', _wkE); }
  // 颜面+志向
  h += '<div class="rwp-grid-2">';
  if (typeof FaceSystem !== 'undefined' && ch._face !== undefined) {
    var fv = Math.round(ch._face);
    var fLabel = fv>=70?'颜 面 在':fv>=40?'有 分 量':'颜 面 失';
    h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">颜 面</div>';
    h += '<div class="rwp-face-card"><div class="rwp-face-value">'+fv+'</div>';
    h += '<div><div class="rwp-face-label">'+fLabel+'</div>';
    h += '<div class="rwp-face-desc">'+(typeof FaceSystem.getFaceText==='function'?FaceSystem.getFaceText(ch):'')+'</div></div></div></div>';
  }
  if (ch.personalGoal) {
    var gsat2 = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : 0;
    var gpc = gsat2>=60?'hi':gsat2>=30?'mid':'lo';
    h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">个 人 志 向</div>';
    h += '<div class="rwp-goal-card"><div class="rwp-goal-text" style="font-size:12px;">'+escHtml(ch.personalGoal)+'</div>';
    h += '<div class="rwp-goal-progress"><span class="rwp-goal-label">满足</span>';
    h += '<div class="rwp-goal-bar"><div class="rwp-goal-bar-fill" style="width:'+gsat2+'%;"></div></div>';
    h += '<span class="rwp-goal-pct '+gpc+'">'+gsat2+'%</span></div></div></div>';
  }
  h += '</div>';
  h += '</div>'; // tab4

  // ═══ Tab 5: 心绪 ═══
  h += '<div class="rwp-tab-panel">';
  // 当前情绪
  var moodMap = {'喜':{cls:'happy',txt:'心 境 欣 然'},'怒':{cls:'angry',txt:'怒 气 未 消'},'忧':{cls:'worry',txt:'心 事 深 重'},'惧':{cls:'fear',txt:'惶 恐 难 安'},'平':{cls:'peace',txt:'心 如 止 水'}};
  var currentMood = '平';
  if (ch._memory && ch._memory.length > 0) {
    var recent = ch._memory.slice(-3);
    var scoreMap = {'喜':0,'怒':0,'忧':0,'惧':0,'恨':0,'敬':0,'平':0};
    recent.forEach(function(m) { if (scoreMap[m.emotion]!==undefined) scoreMap[m.emotion]++; });
    var max = 0;
    Object.keys(scoreMap).forEach(function(k) { if (scoreMap[k] > max) { max = scoreMap[k]; currentMood = k; } });
  }
  var md = moodMap[currentMood] || moodMap['平'];
  h += '<div class="rwp-grid-2">';
  h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">当 前 情 绪</div>';
  h += '<div style="display:flex;gap:10px;align-items:center;"><span class="rwp-mood-chip '+md.cls+'">〔 '+currentMood+' 〕 '+md.txt+'</span></div></div>';
  if (ch.innerThought) {
    h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">近 期 心 声</div>';
    h += '<div class="rwp-inner-thought">'+escHtml(ch.innerThought)+'</div></div>';
  }
  h += '</div>';
  // 情节弧·若有(后台调用 CharArcs 生成)
  try {
    var _arc = (GM._charArcs && GM._charArcs[ch.name]) ? GM._charArcs[ch.name] : null;
    if (_arc && (_arc.arcStage || _arc.motivation)) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">情 节 弧 <span style="font-size:0.7rem;color:var(--txt-d);font-weight:400;letter-spacing:0;">T'+(_arc.turn||'?')+' 起</span></div>';
      h += '<div style="padding:10px 14px;background:rgba(142,106,168,0.06);border:1px solid rgba(142,106,168,0.2);border-radius:5px;">';
      if (_arc.arcStage) h += '<div style="font-size:12px;color:var(--purple-300,#b89ec8);letter-spacing:0.2em;margin-bottom:6px;">当 前 境 · '+escHtml(_arc.arcStage)+'</div>';
      if (_arc.emotionalState) h += '<div style="font-size:11px;color:var(--txt-s);margin-bottom:4px;">情绪：'+escHtml(_arc.emotionalState)+'</div>';
      if (_arc.motivation) h += '<div style="font-size:11px;color:var(--txt-s);margin-bottom:4px;line-height:1.6;">动机：'+escHtml(_arc.motivation)+'</div>';
      if (_arc.nextCue) h += '<div style="font-size:11px;color:var(--gold-d,#8c7030);line-height:1.6;">潜动向：'+escHtml(_arc.nextCue)+'</div>';
      if (typeof _arc.arcProgress === 'number') {
        var _ap = Math.max(0, Math.min(100, _arc.arcProgress));
        h += '<div style="margin-top:6px;height:4px;background:rgba(0,0,0,0.2);border-radius:2px;overflow:hidden;"><div style="height:100%;width:'+_ap+'%;background:var(--purple-400,#8e6aa8);"></div></div>';
        h += '<div style="font-size:10px;color:var(--txt-d);margin-top:2px;letter-spacing:0.1em;">弧线进度 '+_ap+'%</div>';
      }
      h += '</div></div>';
    }
  } catch(_arcUiE) {}
  // 压力详情
  if (stress > 30) {
    var sL = stress>=80?'将 崩':stress>=60?'负 重':'承 重';
    h += '<div class="rwp-sec"><div class="rwp-sec-title">压 力 详 情</div>';
    h += '<div style="padding:12px 14px;background:rgba(192,64,48,0.06);border:1px solid rgba(192,64,48,0.2);border-radius:5px;">';
    h += '<div style="color:var(--vermillion-300);font-size:12px;margin-bottom:6px;letter-spacing:0.2em;">压 力 值 · '+stress+'/100 · '+sL+'</div>';
    if (ch.stressSources && ch.stressSources.length) {
      h += '<div style="font-size:10px;color:var(--vermillion-400);letter-spacing:0.15em;margin-bottom:4px;">当 下 压 源</div>';
      ch.stressSources.forEach(function(s) { h += '<div style="font-size:11px;padding:2px 0 2px 10px;border-left:1px dashed rgba(255,255,255,0.1);">· '+escHtml(s)+'</div>'; });
    }
    // 释压之法·从 hobbies/stressOff/stressRelief 读
    var _reliefs = [];
    if (Array.isArray(ch.stressRelief)) _reliefs = ch.stressRelief.slice(0, 4);
    else if (Array.isArray(ch.stressOff)) _reliefs = ch.stressOff.slice(0, 4);
    else if (ch.hobbies) _reliefs = (Array.isArray(ch.hobbies) ? ch.hobbies : String(ch.hobbies).split(/[·、，,\/]/)).filter(Boolean).slice(0, 4);
    if (_reliefs.length > 0) {
      h += '<div style="font-size:10px;color:var(--celadon-400);letter-spacing:0.15em;margin:8px 0 4px;">释 压 之 法</div>';
      _reliefs.forEach(function(s) { h += '<div style="font-size:11px;padding:2px 0 2px 10px;border-left:1px dashed rgba(126,184,167,0.2);color:var(--celadon-300);">· '+escHtml(s)+'</div>'; });
    }
    h += '</div></div>';
  }
  // 人生历练·分域累计·从 ch._experience 或 ch.exp 读
  try {
    var _exp = ch._experience || ch.exp || null;
    if (_exp && typeof _exp === 'object') {
      var _domains = [
        { k: '治理', lbs: ['governance','administration','治理','rule'] },
        { k: '民生', lbs: ['livelihood','民生','people'] },
        { k: '文事', lbs: ['literary','文事','culture'] },
        { k: '党议', lbs: ['faction','党议','politics'] },
        { k: '军机', lbs: ['military','军事','军机','war'] },
        { k: '刑名', lbs: ['justice','刑名','law'] }
      ];
      var _domainStats = [];
      _domains.forEach(function(d) {
        var cnt = 0;
        d.lbs.forEach(function(l) { if (typeof _exp[l] === 'number') cnt += _exp[l]; });
        if (cnt > 0) _domainStats.push({ k: d.k, cnt: cnt });
      });
      var _recentExp = Array.isArray(ch._experienceLog) ? ch._experienceLog.slice(-4) :
        Array.isArray(_exp.recent) ? _exp.recent.slice(-4) : [];
      if (_domainStats.length > 0 || _recentExp.length > 0) {
        h += '<div class="rwp-sec"><div class="rwp-sec-title">人 生 历 练<small>分域累计</small></div>';
        if (_domainStats.length > 0) {
          h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;padding:10px 14px;background:rgba(0,0,0,0.22);border-radius:5px;">';
          _domainStats.forEach(function(d) {
            h += '<div style="flex:1;min-width:80px;text-align:center;padding:6px;background:rgba(184,154,83,0.06);border:1px solid rgba(184,154,83,0.18);border-radius:3px;">'
              + '<div style="font-size:11px;color:var(--gold-400);letter-spacing:0.2em;">'+d.k+'</div>'
              + '<div style="font-size:18px;color:var(--gold-300);font-weight:600;margin-top:2px;">'+d.cnt+'</div></div>';
          });
          h += '</div>';
        }
        if (_recentExp.length > 0) {
          h += '<div style="font-size:11px;color:var(--ink-300);letter-spacing:0.1em;margin-bottom:4px;">近 期</div>';
          _recentExp.forEach(function(e) {
            var txt = typeof e === 'string' ? e : (e.text || e.desc || ('〔'+(e.domain||'?')+'〕'+(e.event||'')));
            h += '<div style="font-size:11px;padding:3px 0 3px 10px;color:var(--ink-200);line-height:1.6;">· '+escHtml(txt)+'</div>';
          });
        }
        h += '</div>';
      }
    }
  } catch(_expE) { console.warn('[人物志] 历练段', _expE); }
  // 近期记忆
  if (ch._memory && ch._memory.length > 0) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">此 人 记 忆<small>近 5 条</small></div><div>';
    ch._memory.slice(-5).reverse().forEach(function(m) {
      var mc = _rwpMoodCls(m.emotion);
      h += '<div class="rwp-mem '+mc+'"><span class="rwp-mem-mood '+mc+'">〔'+m.emotion+'〕</span>'+escHtml(m.event);
      if (m.who) h += '<span class="rwp-mem-who">('+escHtml(m.who)+')</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }
  // 印象
  if (ch._impressions) {
    var impParts = [];
    for (var _pn in ch._impressions) {
      var _imp = ch._impressions[_pn];
      if (Math.abs(_imp.favor) >= 3) {
        var _rel = _imp.favor >= 15 ? '感恩' : _imp.favor >= 5 ? '好感' : _imp.favor <= -15 ? '深恨' : _imp.favor <= -5 ? '不满' : '寻常';
        impParts.push('<b>'+escHtml(_pn)+'：</b>'+_rel+'('+(_imp.favor>0?'+':'')+_imp.favor+')');
      }
    }
    if (impParts.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">对 他 人 印 象</div>';
      h += '<div class="rwp-impressions"><div>'+impParts.join('　')+'</div></div></div>';
    }
  }
  // 刻骨铭心
  if (ch._scars && ch._scars.length > 0) {
    h += '<div class="rwp-sec"><div class="rwp-scar-box"><div class="rwp-scar-label">刻 骨 铭 心 · 不 忘</div>';
    ch._scars.forEach(function(s) {
      var mc = _rwpMoodCls(s.emotion);
      h += '<div class="rwp-mem '+mc+'"><span class="rwp-mem-mood '+mc+'">〔'+s.emotion+'〕</span>'+escHtml(s.event);
      if (s.who) h += '<span class="rwp-mem-who">('+escHtml(s.who)+')</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }
  h += '</div>'; // tab5

  // ═══ Tab 6: 关系 ═══
  h += '<div class="rwp-tab-panel">';
  // 玩家好感
  if (ch._impressions && ch._impressions['玩家']) {
    var fv = ch._impressions['玩家'].favor || 0;
    h += '<div class="rwp-sec"><div class="rwp-sec-title">对 玩 家 好 感</div>';
    h += '<div class="rwp-opinion-breakdown">';
    h += '<div class="rwp-opinion-total"><span class="rwp-opinion-total-lb">合 计 好 感</span>';
    h += '<span class="rwp-opinion-total-v'+(fv<0?' neg':'')+'">'+(fv>=0?'+':'')+fv+'</span></div>';
    h += '<div class="rwp-opinion-bar"><div class="rwp-opinion-fill '+(fv>=0?'pos':'neg')+'" style="width:'+Math.min(50,Math.abs(fv)/2)+'%;"></div></div>';
    h += '</div></div>';
  }
  // 恩怨
  if (typeof EnYuanSystem !== 'undefined') {
    var eyt = EnYuanSystem.getTextForChar(ch.name);
    if (eyt) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">恩 怨 · 因 果</div><div class="rwp-prose">'+escHtml(eyt)+'</div></div>';
    }
  }
  // 关系网（从 impressions）
  if (ch._impressions) {
    var relList = [];
    for (var pn in ch._impressions) {
      if (pn === '玩家') continue;
      var imp = ch._impressions[pn];
      if (Math.abs(imp.favor||0) >= 3) relList.push({ name: pn, favor: imp.favor });
    }
    relList.sort(function(a,b){ return Math.abs(b.favor)-Math.abs(a.favor); });
    if (relList.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">人 际 关 系 网</div><div class="rwp-aff-list">';
      relList.slice(0, 10).forEach(function(r) {
        var cls = r.favor>=5?'pos':r.favor<=-5?'neg':'neu';
        var rel = r.favor>=15?'感恩深厚':r.favor>=5?'有好感':r.favor<=-15?'深怀恨意':r.favor<=-5?'心存不满':'寻常';
        h += '<div class="rwp-aff-item '+cls+'"><span class="rwp-aff-name">'+escHtml(r.name)+'</span>';
        h += '<span class="rwp-aff-rel">'+rel+'</span>';
        h += '<span class="rwp-aff-value">'+(r.favor>0?'+':'')+r.favor+'</span></div>';
      });
      h += '</div></div>';
    }
  }
  // 血缘关系 + 门生故吏 · 2 列并排
  try {
    var _bloods = [];
    if (Array.isArray(ch.familyMembers)) {
      ch.familyMembers.forEach(function(m) {
        if (!m || !m.name) return;
        var rel = m.relation || m.role || '';
        var isInLaw = m.inLaw === true || /妻|嫂|媳|岳|丈人|舅/.test(rel);
        if (isInLaw && !/妻/.test(rel)) return;  // 姻亲不算血缘(妻子特殊·列入)
        var close = m.dead ? '已故' : (m.name === ch.name ? '本人' : '亲');
        _bloods.push({ name: m.name, rel: rel, close: close, dead: !!m.dead });
      });
    }
    var _students = [];
    if (Array.isArray(ch.studentsIds)) {
      ch.studentsIds.slice(0, 10).forEach(function(sn) {
        var sc = GM.chars && GM.chars.find(function(cc){ return cc.name === sn; });
        _students.push({ name: sn, rel: sc ? (sc.officialTitle||sc.title||'') : '门生', tag: '门生' });
      });
    }
    // 亦扫 GM.chars 中 mentor 含本人
    if (Array.isArray(GM.chars)) {
      GM.chars.forEach(function(cc) {
        if (!cc || !cc.mentor) return;
        if (String(cc.mentor).indexOf(ch.name) < 0) return;
        if (_students.some(function(s){ return s.name === cc.name; })) return;
        _students.push({ name: cc.name, rel: cc.officialTitle||cc.title||'门生', tag: '门生' });
      });
    }
    // 故吏·从 ch._formerSubordinates 或扫 GM.chars 曾为下属者
    if (Array.isArray(ch._formerSubordinates)) {
      ch._formerSubordinates.slice(0, 8).forEach(function(sub) {
        _students.push({ name: typeof sub === 'string' ? sub : sub.name, rel: (typeof sub === 'object' ? sub.post||'故吏' : '故吏'), tag: '故吏' });
      });
    }
    if (_bloods.length > 0 || _students.length > 0) {
      h += '<div class="rwp-grid-2">';
      if (_bloods.length > 0) {
        h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">血 缘 关 系</div><div class="rwp-aff-list">';
        _bloods.slice(0, 10).forEach(function(b) {
          var cls = b.dead ? 'neu' : 'pos';
          h += '<div class="rwp-aff-item '+cls+'"><span class="rwp-aff-name">'+escHtml(b.name)+'</span>';
          h += '<span class="rwp-aff-rel">'+escHtml(b.rel||'—')+'</span>';
          h += '<span class="rwp-aff-value">'+b.close+'</span></div>';
        });
        h += '</div></div>';
      }
      if (_students.length > 0) {
        h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">门 生 故 吏</div><div class="rwp-aff-list">';
        _students.slice(0, 10).forEach(function(s) {
          h += '<div class="rwp-aff-item pos"><span class="rwp-aff-name">'+escHtml(s.name)+'</span>';
          h += '<span class="rwp-aff-rel">'+escHtml(s.rel)+'</span>';
          h += '<span class="rwp-aff-value">'+s.tag+'</span></div>';
        });
        h += '</div></div>';
      }
      h += '</div>';
    }
  } catch(_relE) { console.warn('[人物志] 血缘/门生段', _relE); }
  // 降级文本·PatronNetwork(若存在·作为补充)
  if (typeof PatronNetwork !== 'undefined') {
    var pnt = PatronNetwork.getTextForChar(ch.name);
    if (pnt) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">恩 怨 · 因 果</div><div class="rwp-prose" style="font-size:11px;">'+escHtml(pnt)+'</div></div>';
    }
  }
  h += '</div>'; // tab6

  h += '</div>'; // tab-panels

  panel.innerHTML = h;
  ov.classList.add('open');
}

/** 切换 tab */
function _rwpSwitchTab(btn, idx) {
  var panel = btn.closest('.renwu-page-container') || btn.closest('.char-detail-panel');
  if (!panel) return;
  var tabs = panel.querySelectorAll('.rwp-tab');
  var panels = panel.querySelectorAll('.rwp-tab-panel');
  tabs.forEach(function(t, i) { t.classList.toggle('active', i === idx); });
  panels.forEach(function(p, i) { p.classList.toggle('active', i === idx); });
}

/** 渲染资源单元 */
function _rwpResItem(val, unit, type) {
  var svg = '';
  if (type === 'coin') svg = '<svg class="rwp-res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><rect x="9.5" y="9.5" width="5" height="5" stroke-width="1.3"/></svg>';
  else if (type === 'grain') svg = '<svg class="rwp-res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 21V6"/><path d="M12 10C8.5 10 6 8.5 5 6"/><path d="M12 10C15.5 10 18 8.5 19 6"/><path d="M12 14C8.5 14 6 12.5 5 10"/><path d="M12 14C15.5 14 18 12.5 19 10"/></svg>';
  else if (type === 'cloth') svg = '<svg class="rwp-res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 7Q12 4 20 7L20 9Q12 6 4 9Z"/><path d="M4 11Q12 8 20 11L20 13Q12 10 4 13Z"/></svg>';
  var neg = val < 0;
  var v = Math.abs(val);
  var display = v >= 10000 ? (v/10000).toFixed(1)+'万' : v >= 1000 ? v.toLocaleString() : Math.round(v);
  return '<div class="rwp-res-item">'+svg+'<span><span class="rwp-res-val'+(neg?' neg':'')+'">'+display+'</span><span class="rwp-res-unit">'+unit+'</span></span></div>';
}

// ============================================================
// 鸿雁传书系统 — 信件传递+回复+结算+NPC来书+信使可见化
// ============================================================

/** 信件类型定义 */
// ============================================================
// 品级体系（结构化官阶——通用中国古代18级制）
// ============================================================
// ============================================================
// 官制双层模型——数据迁移与工具
// ============================================================

/** 迁移并双向同步 position 数据：老模型(headCount/actualCount/holder+additionalHolders) ↔ 新模型(establishedCount/vacancyCount/actualHolders) */
function _offMigratePosition(pos) {
  if (!pos || typeof pos !== 'object') return;

  // ── Step 1: 规范老字段 ──
  if (pos.headCount === undefined || pos.headCount === null || pos.headCount === '') pos.headCount = 1;
  if (typeof pos.headCount === 'string') { var _hc = parseInt(pos.headCount, 10); pos.headCount = isNaN(_hc) || _hc < 1 ? 1 : _hc; }
  if (!Array.isArray(pos.additionalHolders)) pos.additionalHolders = [];
  var _matCount = (pos.holder ? 1 : 0) + pos.additionalHolders.length;
  if (pos.actualCount === undefined) pos.actualCount = _matCount;

  // ── Step 2: 新字段——若已存在则以新字段为权威 ──
  if (pos.establishedCount == null) {
    pos.establishedCount = pos.headCount;
  } else {
    // 新字段已设 → 反向同步到老字段
    pos.headCount = pos.establishedCount;
  }
  if (pos.vacancyCount == null) {
    // 从老字段派生：缺员 = 编制 - 实有
    pos.vacancyCount = Math.max(0, pos.headCount - pos.actualCount);
  } else {
    // 新字段已设 → 反向同步 actualCount
    var _derivedActual = Math.max(0, pos.establishedCount - pos.vacancyCount);
    if (pos.actualCount < _derivedActual) pos.actualCount = _derivedActual;
    else if (pos.actualCount > _derivedActual && _matCount <= _derivedActual) pos.actualCount = _derivedActual;
  }

  // ── Step 3: actualHolders——若未存在则从老字段(holder + additionalHolders)构建 ──
  if (!Array.isArray(pos.actualHolders)) {
    var ah = [];
    if (pos.holder) ah.push({ name: pos.holder, generated: true });
    pos.additionalHolders.forEach(function(nm) {
      if (nm && !ah.some(function(h){return h.name===nm;})) ah.push({ name: nm, generated: true });
    });
    // 补占位到 actualCount 长度
    while (ah.length < pos.actualCount) {
      ah.push({ name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8) });
    }
    pos.actualHolders = ah;
  } else {
    // 新字段已存在——反向同步到老字段（holder + additionalHolders）
    var namedArr = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
    pos.holder = namedArr[0] || '';
    pos.additionalHolders = namedArr.slice(1);
    // 反向同步 actualCount
    if (pos.actualHolders.length > pos.actualCount) pos.actualCount = pos.actualHolders.length;
  }

  // 单人俸禄兼容
  if (!pos.perPersonSalary && pos.salary) pos.perPersonSalary = pos.salary;
  if (!pos.salary && pos.perPersonSalary) pos.salary = pos.perPersonSalary;

  pos._migrated = true;
}

/** 迁移整棵官制树 */
function _offMigrateTree(tree) {
  if (!tree) return;
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) { _offMigratePosition(p); });
      if (n.subs) _walk(n.subs);
    });
  })(tree);
}

/** 获取职位的具象人数——优先新模型 actualHolders，降级老模型 */
function _offMaterializedCount(pos) {
  if (Array.isArray(pos.actualHolders)) {
    return pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).length;
  }
  return (pos.holder ? 1 : 0) + (pos.additionalHolders ? pos.additionalHolders.length : 0);
}

/** 获取职位的所有具象角色名列表——优先新模型 */
function _offAllHolders(pos) {
  if (Array.isArray(pos.actualHolders)) {
    return pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  }
  var arr = [];
  if (pos.holder) arr.push(pos.holder);
  if (pos.additionalHolders) arr = arr.concat(pos.additionalHolders);
  return arr;
}

/** 任命：把 person 装入 position 的 actualHolders（优先填占位；无占位则扩展） */
function _offAppointPerson(pos, person) {
  if (!pos || !person) return;
  _offMigratePosition(pos);
  if (!Array.isArray(pos.actualHolders)) pos.actualHolders = [];
  // 若已有同名条目，跳过
  if (pos.actualHolders.some(function(h){return h && h.name === person && h.generated!==false;})) return;
  // 找第一个 generated:false 占位
  var slot = pos.actualHolders.find(function(h){return h && h.generated===false;});
  if (slot) {
    slot.name = person;
    slot.generated = true;
    slot.appointedTurn = (typeof GM!=='undefined' && GM.turn) || 0;
  } else {
    // 无占位——扩展一个（编制可能因此增加）
    pos.actualHolders.push({ name: person, generated: true, appointedTurn: (typeof GM!=='undefined' && GM.turn) || 0 });
    if (pos.actualHolders.length > pos.establishedCount) pos.establishedCount = pos.actualHolders.length;
    if (pos.actualHolders.length > pos.headCount) pos.headCount = pos.actualHolders.length;
    pos.actualCount = pos.actualHolders.length;
  }
  // 同步老字段
  var named = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  pos.holder = named[0] || '';
  pos.additionalHolders = named.slice(1);
  pos.actualCount = named.length + pos.actualHolders.filter(function(h){return h && h.generated===false;}).length;
}

/** 罢免：从 actualHolders 中移除 person，留下 generated:false 占位（不变更编制） */
function _offDismissPerson(pos, person) {
  if (!pos || !person) return;
  _offMigratePosition(pos);
  if (!Array.isArray(pos.actualHolders)) pos.actualHolders = [];
  var idx = pos.actualHolders.findIndex(function(h){return h && h.name === person;});
  if (idx >= 0) {
    // 替换为占位（保持位置计数）
    pos.actualHolders[idx] = { name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8), vacatedBy: person, vacatedTurn: (typeof GM!=='undefined' && GM.turn) || 0 };
  }
  var named = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  pos.holder = named[0] || '';
  pos.additionalHolders = named.slice(1);
}

/** 扫遍官制树·清除指定姓名的所有 holder 登记（死亡/贬谪/退隐级联）
 * 返回 { vacated: [{dept, pos, rank}...] } 供事件日志使用
 * reason: 'death' | 'demote' | 'retire' | 'exile' | 'execute'
 */
function _offVacateByCharName(charName, reason, tree) {
  if (!charName) return { vacated: [] };
  tree = tree || (typeof GM !== 'undefined' && GM.officeTree) || [];
  var vacated = [];
  (function _walk(nodes, deptChain) {
    (nodes || []).forEach(function(n) {
      if (!n) return;
      var curChain = deptChain ? (deptChain + '·' + n.name) : n.name;
      (n.positions || []).forEach(function(p) {
        if (!p) return;
        // 新模型 actualHolders
        if (Array.isArray(p.actualHolders)) {
          var hitNew = p.actualHolders.some(function(h){ return h && h.name === charName && h.generated !== false; });
          if (hitNew) {
            _offDismissPerson(p, charName);
            vacated.push({ dept: n.name, pos: p.name, rank: p.rank || '', chain: curChain, reason: reason || '' });
          }
        }
        // 老模型 holder 直接匹配（即使已做 dismiss 也做兜底）
        if (p.holder === charName) {
          if (!Array.isArray(p.holderHistory)) p.holderHistory = [];
          p.holderHistory.push({ name: charName, until: (typeof GM !== 'undefined' && GM.turn) || 0, reason: reason || '身故级联' });
          p.holder = '';
          p.holderSinceTurn = 0;
          // 公库头衔同步
          if (p.publicTreasury && p.publicTreasury.currentHead === charName) {
            p.publicTreasury.previousHead = charName;
            p.publicTreasury.currentHead = null;
          }
          vacated.push({ dept: n.name, pos: p.name, rank: p.rank || '', chain: curChain, reason: reason || '' });
        }
        // additionalHolders 兼容
        if (Array.isArray(p.additionalHolders)) {
          var ai = p.additionalHolders.indexOf(charName);
          if (ai >= 0) p.additionalHolders.splice(ai, 1);
        }
      });
      if (n.subs) _walk(n.subs, curChain);
    });
  })(tree, '');
  return { vacated: vacated };
}

/** 扫全局·清除所有 alive===false 或找不到的 holder（endturn 兜底 sweep）
 * 用于捕获未发 character:death 事件但实际已死的角色遗留
 */
function _offSweepGhostHolders() {
  if (typeof GM === 'undefined' || !GM.officeTree) return { swept: [] };
  var swept = [];
  var _findCh = (typeof findCharByName === 'function') ? findCharByName : function(n){
    return (GM.chars||[]).find(function(c){ return c && c.name === n; });
  };
  (function _walk(nodes) {
    (nodes || []).forEach(function(n) {
      if (!n) return;
      (n.positions || []).forEach(function(p) {
        if (!p) return;
        var names = [];
        if (p.holder) names.push(p.holder);
        if (Array.isArray(p.actualHolders)) {
          p.actualHolders.forEach(function(h){ if (h && h.name && h.generated !== false) names.push(h.name); });
        }
        var seen = {};
        names.forEach(function(nm){
          if (seen[nm]) return; seen[nm] = 1;
          var ch = _findCh(nm);
          if (!ch || ch.alive === false || ch.dead) {
            _offVacateByCharName(nm, 'ghost-sweep');
            swept.push({ name: nm, dept: n.name, pos: p.name });
          }
        });
      });
      if (n.subs) _walk(n.subs);
    });
  })(GM.officeTree);
  return { swept: swept };
}

/** 获取部门的聚合统计 */
function _offDeptStats(dept) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, vacant: 0, unmaterialized: 0, holders: [] };
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        _offMigratePosition(p);
        stats.headCount += (p.headCount||1);
        stats.actualCount += (p.actualCount||0);
        var m = _offMaterializedCount(p);
        stats.materialized += m;
        _offAllHolders(p).forEach(function(h) { stats.holders.push(h); });
      });
      if (n.subs) _walk(n.subs);
    });
  })([dept]);
  stats.vacant = stats.headCount - stats.actualCount;
  stats.unmaterialized = stats.actualCount - stats.materialized;
  return stats;
}

/** 获取整棵树的聚合统计 */
function _offTreeStats(tree) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, depts: 0 };
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      stats.depts++;
      (n.positions||[]).forEach(function(p) {
        _offMigratePosition(p);
        stats.headCount += (p.headCount||1);
        stats.actualCount += (p.actualCount||0);
        stats.materialized += _offMaterializedCount(p);
      });
      if (n.subs) _walk(n.subs);
    });
  })(tree||[]);
  return stats;
}

var RANK_HIERARCHY = [
  {id:'z1',label:'正一品',level:1,salary:100,color:'var(--gold-400)'},
  {id:'c1',label:'从一品',level:2,salary:90,color:'var(--gold-400)'},
  {id:'z2',label:'正二品',level:3,salary:80,color:'var(--gold-400)'},
  {id:'c2',label:'从二品',level:4,salary:72,color:'var(--gold-400)'},
  {id:'z3',label:'正三品',level:5,salary:65,color:'var(--amber-400)'},
  {id:'c3',label:'从三品',level:6,salary:58,color:'var(--amber-400)'},
  {id:'z4',label:'正四品',level:7,salary:50,color:'var(--amber-400)'},
  {id:'c4',label:'从四品',level:8,salary:44,color:'var(--amber-400)'},
  {id:'z5',label:'正五品',level:9,salary:38,color:'var(--celadon-400)'},
  {id:'c5',label:'从五品',level:10,salary:33,color:'var(--celadon-400)'},
  {id:'z6',label:'正六品',level:11,salary:28,color:'var(--celadon-400)'},
  {id:'c6',label:'从六品',level:12,salary:24,color:'var(--celadon-400)'},
  {id:'z7',label:'正七品',level:13,salary:20,color:'var(--color-foreground-secondary)'},
  {id:'c7',label:'从七品',level:14,salary:17,color:'var(--color-foreground-secondary)'},
  {id:'z8',label:'正八品',level:15,salary:14,color:'var(--ink-300)'},
  {id:'c8',label:'从八品',level:16,salary:12,color:'var(--ink-300)'},
  {id:'z9',label:'正九品',level:17,salary:10,color:'var(--ink-300)'},
  {id:'c9',label:'从九品',level:18,salary:8,color:'var(--ink-300)'}
];

/** 根据品级文本获取level（数字越小品级越高） */
function getRankLevel(rankStr) {
  if (!rankStr) return 99;
  for (var i = 0; i < RANK_HIERARCHY.length; i++) {
    if (rankStr.indexOf(RANK_HIERARCHY[i].label) >= 0) return RANK_HIERARCHY[i].level;
  }
  return 99;
}

/** 获取品级信息 */
function getRankInfo(rankStr) {
  if (!rankStr) return null;
  for (var i = 0; i < RANK_HIERARCHY.length; i++) {
    if (rankStr.indexOf(RANK_HIERARCHY[i].label) >= 0) return RANK_HIERARCHY[i];
  }
  return null;
}

/** 计算官员满意度（大材小用/小材大用检测） */
function calcOfficialSatisfaction(charName, posRank, deptName) {
  var ch = findCharByName(charName);
  if (!ch) return { score: 50, label: '未知' };
  // 能力综合分
  var abilityScore = ((ch.intelligence||50) + (ch.administration||50) + (ch.military||50)) / 3;
  var rankLevel = getRankLevel(posRank);
  // 品级越高(level越小)→需要越高能力
  var expectedAbility = Math.max(30, 90 - rankLevel * 3.5);
  var diff = abilityScore - expectedAbility;
  // 野心影响：野心高的人在低品级更不满
  var ambitionPenalty = rankLevel > 10 ? (ch.ambition||50) * 0.3 : 0;
  var satisfaction = 50 + diff * 0.8 - ambitionPenalty;
  satisfaction = Math.max(0, Math.min(100, Math.round(satisfaction)));
  var label = satisfaction > 75 ? '志得意满' : satisfaction > 55 ? '安于其位' : satisfaction > 35 ? '郁郁不得志' : '怀才不遇';
  return { score: satisfaction, label: label };
}

var LETTER_TYPES = {
  // 玩家发信类型
  secret_decree: { label: '密旨', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 3, needsToken: 'seal', formal: false },
  military_order: { label: '征调令', css: 'lt-type-military', icon: 'troops', interceptWeight: 3, needsToken: 'tally', formal: true },
  greeting: { label: '问安函', css: 'lt-type-greeting', icon: 'person', interceptWeight: 0.5, needsToken: false, formal: false },
  personal: { label: '私函', css: 'lt-type-personal', icon: 'dialogue', interceptWeight: 1, needsToken: false, formal: false },
  proclamation: { label: '檄文', css: 'lt-type-proclamation', icon: 'event', interceptWeight: 0, needsToken: false, formal: false },
  formal_edict: { label: '正式诏令', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 2, needsToken: 'seal', formal: true },
  // NPC来信类型
  report: { label: '奏报', css: 'lt-type-military', icon: 'memorial', interceptWeight: 2, formal: true },
  plea: { label: '陈情', css: 'lt-type-personal', icon: 'person', interceptWeight: 1, formal: false },
  warning: { label: '急报', css: 'lt-type-military', icon: 'troops', interceptWeight: 2.5, formal: false },
  intelligence: { label: '密信', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 3, formal: false },
  // 新增：馈赠、外交国书
  gift: { label: '附礼', css: 'lt-type-greeting', icon: 'treasury', interceptWeight: 0.5, formal: false },
  diplomatic: { label: '国书', css: 'lt-type-proclamation', icon: 'scroll', interceptWeight: 2, formal: true }
};

/** 信物凭证系统 */
var LETTER_TOKENS = {
  seal: { label: '玺印', desc: '加盖玺印，彰显正统', icon: 'scroll' },
  tally: { label: '虎符', desc: '调兵凭证，无符不从', icon: 'troops' },
  gold_tablet: { label: '金牌', desc: '八百里加急专用信物', icon: 'treasury' }
};

/** 加密方式 */
var LETTER_CIPHERS = {
  none: { label: '不加密', interceptReadChance: 1.0, cost: 0 },
  yinfu: { label: '阴符', desc: '预设暗号体系', interceptReadChance: 0.2, cost: 0 },
  yinshu: { label: '阴书', desc: '拆分三份交不同信使', interceptReadChance: 0.05, cost: 0 },
  wax_ball: { label: '蜡丸', desc: '蜡封密函藏于身', interceptReadChance: 0.4, cost: 0 },
  silk_sewn: { label: '帛书缝衣', desc: '缝入衣裳夹层', interceptReadChance: 0.3, cost: 0 }
};

/** 估算两地信件传递天数（改进版） */
function calcLetterDays(fromLoc, toLoc, urgency) {
  if (!fromLoc || !toLoc || fromLoc === toLoc) return 1;
  // 古代驿站速度（里/天）：普通50里，加急300里，八百里加急800里
  var liPerDay = { normal: 50, urgent: 300, extreme: 800 };
  var speed = liPerDay[urgency] || 50;
  // 估算距离（里）——基于行政区划层级推断
  var li = 1000; // 默认中等距离
  if (P.adminHierarchy) {
    var _sameProv = _ltCheckSameProvince(fromLoc, toLoc);
    if (_sameProv) li = 200;
  }
  // 若两地名有共同前缀（同区域），距离近
  if (fromLoc.length >= 2 && toLoc.length >= 2 && fromLoc.slice(0,2) === toLoc.slice(0,2)) li = 150;
  return Math.max(1, Math.ceil(li / speed));
}
/** 检查两地是否在同一顶级行政区 */
function _ltCheckSameProvince(loc1, loc2) {
  if (!P.adminHierarchy) return false;
  var ah = P.adminHierarchy.player ? P.adminHierarchy.player : P.adminHierarchy[Object.keys(P.adminHierarchy)[0]];
  if (!ah || !ah.divisions) return false;
  var p1 = '', p2 = '';
  ah.divisions.forEach(function(d) {
    var _names = [d.name];
    if (d.children) d.children.forEach(function(c){ _names.push(c.name); if(c.children) c.children.forEach(function(gc){ _names.push(gc.name); }); });
    if (_names.indexOf(loc1) >= 0) p1 = d.name;
    if (_names.indexOf(loc2) >= 0) p2 = d.name;
  });
  return p1 && p1 === p2;
}

/** 渲染鸿雁传书面板 */
function renderLetterPanel() {
  var capital = GM._capital || '京城';
  var _filter = GM._ltFilter || 'all';

  // ── 驿路状态 ──
  var routeBar = _$('letter-route-bar');
  if (routeBar) {
    var disruptions = GM._routeDisruptions || [];
    var active = disruptions.filter(function(d) { return !d.resolved; });
    if (active.length > 0) {
      var _rHtml = '<span class="hy-route-warn-lbl">\u26A0 \u9A7F\u8DEF\u544A\u6025\uFF1A</span>';
      _rHtml += active.map(function(d) {
        return '<span class="hy-route-warn-item">' + escHtml(d.route||'') + (d.reason ? ' \u00B7 ' + escHtml(d.reason) : '') + '</span>';
      }).join('');
      routeBar.innerHTML = _rHtml;
      routeBar.style.display = 'flex';
    } else { routeBar.style.display = 'none'; routeBar.innerHTML = ''; }
  }

  // 更新 multi button 状态
  var _mbtn = _$('lt-multi-toggle');
  if (_mbtn) _mbtn.classList.toggle('active', !!GM._ltMultiMode);
  // 更新 compose target 提示
  var _ctgt = _$('lt-compose-target');
  if (_ctgt) {
    if (GM._ltMultiMode && GM._ltMultiTargets && GM._ltMultiTargets.length > 0) _ctgt.textContent = '（\u7FA4\u53D1' + GM._ltMultiTargets.length + '\u4EBA\uFF09';
    else if (GM._pendingLetterTo) _ctgt.textContent = '\u2192 \u81F4 ' + GM._pendingLetterTo;
    else _ctgt.textContent = '\uFF08\u9009\u62E9\u53D7\u4FE1\u4EBA\uFF09';
  }

  // ── 人物分组·按地域粗分 ──
  function _regionOf(loc) {
    if (!loc) return '\u5176\u4ED6';
    if (/\u8FBD|\u5BA7|\u9526|\u7518\u76F4|\u76DB\u4EAC|\u8FA3\u9633|\u6C88\u9633|\u4EAC\u7B7B/.test(loc)) return '\u8FBD\u4E1C\u00B7\u5317\u5883';
    if (/\u5927\u540C|\u5BA3|\u8367|\u592A\u539F|\u9695/.test(loc)) return '\u8FBD\u4E1C\u00B7\u5317\u5883';
    if (/\u9655|\u897F\u5B89|\u5EF6|\u7518|\u5B81\u590F|\u5170\u5DDE|\u4E09\u8FB9|\u6C58\u5DDE|\u51C9/.test(loc)) return '\u897F\u9677\u00B7\u8FB9\u9547';
    if (/\u56DB\u5DDD|\u91CD\u5E86|\u4E91|\u8D35|\u8568|\u7B47|\u77F3\u67F1|\u6210\u90FD/.test(loc)) return '\u897F\u5357\u00B7\u5DF4\u8700';
    if (/\u798F\u5EFA|\u5E7F\u4E1C|\u5E7F\u897F|\u6D77|\u5384\u95E8|\u6280\u6E7E|\u6E29\u90FD|\u7518\u590F/.test(loc)) return '\u5357\u65B9\u00B7\u6D77\u7586';
    if (/\u6C5F|\u676D|\u5357\u4EAC|\u82CF|\u6E56\u5E7F|\u77F3\u5BAE|\u6D59/.test(loc)) return '\u6C5F\u5357\u00B7\u6C5F\u6D59';
    if (/\u6CB3\u5357|\u5C71\u4E1C|\u6CB3\u5317|\u5317\u76F4|\u9C81/.test(loc)) return '\u4E2D\u539F\u00B7\u9C81\u8C6B';
    return '\u5176\u4ED6';
  }

  // ── NPC 卡片列表 ──
  var el = _$('letter-chars');
  if (el) {
    var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && c.location !== capital && !c.isPlayer; });
    if (remote.length === 0) {
      el.innerHTML = '<div style="color:var(--color-foreground-muted);font-size:12px;padding:20px 14px;text-align:center;font-family:var(--font-serif);letter-spacing:0.12em;line-height:1.8;">\u767E\u5B98\u5747\u5728\u4EAC\u57CE\u00B7\u65E0\u9700\u4F20\u4E66</div>';
    } else {
      // 按地域分组
      var _groups = {};
      remote.forEach(function(ch) {
        var r = _regionOf(ch.location);
        if (!_groups[r]) _groups[r] = [];
        _groups[r].push(ch);
      });
      var _grpOrder = ['\u8FBD\u4E1C\u00B7\u5317\u5883','\u897F\u9677\u00B7\u8FB9\u9547','\u4E2D\u539F\u00B7\u9C81\u8C6B','\u6C5F\u5357\u00B7\u6C5F\u6D59','\u897F\u5357\u00B7\u5DF4\u8700','\u5357\u65B9\u00B7\u6D77\u7586','\u5176\u4ED6'];

      function _cardClass(ch) {
        var t = (ch.title||'') + (ch.officialTitle||'');
        if (/\u5C06|\u603B\u5175|\u7763|\u6307\u6325|\u6307\u6325\u4F7F/.test(t)) return 'hy-c-mili';
        if ((ch.loyalty||50) >= 75) return 'hy-c-loyal';
        if (/\u5B66\u58EB|\u4FA8|\u5C1A\u4E66|\u90CE\u4E2D|\u4FA8\u5B66|\u7AE5\u5B9E|\u4F5B|\u5FB4\u58EB|\u6559\u6388|\u4FA8\u516C|\u84DD\u77E5/.test(t)) return 'hy-c-scholar';
        return 'hy-c-normal';
      }

      var cardsHtml = '';
      _grpOrder.forEach(function(g) {
        if (!_groups[g] || _groups[g].length === 0) return;
        cardsHtml += '<div class="hy-group-sep">' + escHtml(g) + '</div>';
        _groups[g].forEach(function(ch) {
          var isMulti = (GM._ltMultiTargets||[]).indexOf(ch.name) >= 0;
          var sel = (GM._ltMultiMode ? (isMulti ? ' active' : '') : (GM._pendingLetterTo === ch.name ? ' active' : ''));
          var safeName = ch.name.replace(/'/g, "\\'");
          var _cls = _cardClass(ch);
          var unreadCount = _ltCountUnread(ch.name);
          var transitCount = _ltCountTransit(ch.name);
          var lostCount = _ltCountLost(ch.name);
          var npcNewCount = _ltCountNpcNew(ch.name);
          var _isRouteBlocked = _ltIsRouteBlocked(capital, ch.location);
          var _inds = '';
          if (unreadCount > 0) _inds += '<div class="hy-ind hy-ind-unread" title="' + unreadCount + ' \u5C01\u672A\u8BFB">' + unreadCount + '</div>';
          if (npcNewCount > 0) _inds += '<div class="hy-ind hy-ind-new" title="' + npcNewCount + ' \u5C01\u6765\u51FD">' + npcNewCount + '</div>';
          if (transitCount > 0) _inds += '<div class="hy-ind hy-ind-transit" title="' + transitCount + ' \u5C01\u5728\u9014">' + transitCount + '</div>';
          if (lostCount > 0) _inds += '<div class="hy-ind hy-ind-lost" title="\u4FE1\u4F7F\u903E\u671F">?</div>';
          if (_isRouteBlocked) _inds += '<div class="hy-ind hy-ind-blocked" title="\u9A7F\u8DEF\u963B\u65AD">\u2715</div>';

          var _initial = escHtml(String(ch.name||'?').charAt(0));
          var _portrait = ch.portrait ? '<img src="' + escHtml(ch.portrait) + '">' : _initial;
          var _travel = '';
          if (ch._travelTo) {
            var _rd4 = (typeof ch._travelRemainingDays === 'number' && ch._travelRemainingDays > 0) ? ch._travelRemainingDays : 0;
            _travel = '<span class="travel-arrow">\u2192</span>' + escHtml(ch._travelTo) + (_rd4 ? '<span style="font-size:0.85em;opacity:0.7;"> \u00B7' + _rd4 + '\u65E5</span>' : '');
          }

          cardsHtml += '<div class="hy-npc-card ' + _cls + sel + '" onclick="_ltSelectTarget(\'' + safeName + '\')">';
          cardsHtml += '<div class="hy-npc-portrait">' + _portrait + '</div>';
          cardsHtml += '<div class="hy-npc-info">';
          cardsHtml += '<div class="hy-npc-name">' + escHtml(ch.name) + '</div>';
          cardsHtml += '<div class="hy-npc-title">' + escHtml(ch.officialTitle || ch.title || ch.role || '') + '</div>';
          cardsHtml += '<div class="hy-npc-loc">' + escHtml(ch.location || '') + _travel + '</div>';
          cardsHtml += '</div>';
          cardsHtml += '<div class="hy-npc-indicators">' + _inds + '</div>';
          cardsHtml += '</div>';
        });
      });
      el.innerHTML = cardsHtml;
    }
  }

  // ── 信件记录区 ──
  var hist = _$('letter-history');
  if (!hist) return;
  var target = GM._pendingLetterTo || '';
  if (!target) {
    var _npcCorr = GM._npcCorrespondence || [];
    var _recentCorr = _npcCorr.filter(function(c) { return (GM.turn - c.turn) <= 5; });
    var overviewHtml = '<div class="hy-hist-body"><div class="hy-hist-empty">\u9009\u62E9\u4E00\u4F4D\u8FDC\u65B9\u81E3\u5B50\u00B7\u4EE5\u89C1\u4E66\u4FE1\u5F80\u6765</div>';
    if (_recentCorr.length > 0) {
      overviewHtml = '<div class="hy-hist-head"><div class="hy-hist-title-wrap"><div class="hy-hist-portrait" style="background:linear-gradient(135deg,var(--vermillion-400),var(--ink-100));border-color:var(--vermillion-400);">\u5BC6</div><div><div class="hy-hist-name">\u622A\u83B7\u7684 NPC \u5BC6\u4FE1</div><div class="hy-hist-sub">\u8FD1 5 \u56DE\u5408\u00B7\u5171 ' + _recentCorr.length + ' \u5C01</div></div></div></div>';
      overviewHtml += '<div class="hy-hist-body">';
      _recentCorr.forEach(function(c) {
        overviewHtml += '<div class="hy-msg hy-msg-intercept"><span class="hy-msg-tag"></span>';
        overviewHtml += '<div class="hy-letter">';
        overviewHtml += '<div class="header"><span class="type-pill">\u5BC6\u51FD</span><span>' + escHtml(c.from) + ' \u2192 ' + escHtml(c.to) + '</span><span class="date">T' + (c.turn||'?') + '</span></div>';
        overviewHtml += '<div class="body">' + escHtml(c.content || c.summary || '') + '</div>';
        if (c.implication) overviewHtml += '<div class="hy-intercept-imply">\u6697\u542B\uFF1A' + escHtml(c.implication) + '</div>';
        overviewHtml += '</div></div>';
      });
      overviewHtml += '</div>';
    } else {
      overviewHtml += '</div>';
    }
    hist.innerHTML = overviewHtml;
    return;
  }

  var ch = findCharByName(target);
  var allLetters = (GM.letters||[]).filter(function(l) { return l.to === target || l.from === target; });
  var letters = allLetters;
  if (_filter === 'unread') letters = allLetters.filter(function(l) { return !l._playerRead; });
  else if (_filter === 'transit') letters = allLetters.filter(function(l) { return l.status === 'traveling' || l.status === 'replying'; });
  else if (_filter === 'lost') letters = allLetters.filter(function(l) { return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1); });

  // 新头部
  var _initial = escHtml(String(target||'?').charAt(0));
  var _portraitHtml = (ch && ch.portrait) ? '<img src="' + escHtml(ch.portrait) + '">' : _initial;
  var html = '<div class="hy-hist-head"><div class="hy-hist-title-wrap">';
  html += '<div class="hy-hist-portrait">' + _portraitHtml + '</div>';
  html += '<div><div class="hy-hist-name">\u4E0E ' + escHtml(target) + ' \u7684\u4E66\u4FE1</div>';
  html += '<div class="hy-hist-sub">' + escHtml(ch ? ch.location : '?') + '\u3000\u5171 ' + allLetters.length + ' \u5C01\u5F80\u6765</div></div>';
  html += '</div><div class="hy-filter-btns">';
  var _filterBtns = [{k:'all',l:'\u5168\u90E8'},{k:'unread',l:'\u672A\u8BFB'},{k:'transit',l:'\u5728\u9014'},{k:'lost',l:'\u5931\u8E2A'}];
  _filterBtns.forEach(function(f) {
    html += '<button class="hy-filter-btn' + (_filter===f.k?' active':'') + '" onclick="GM._ltFilter=\'' + f.k + '\';renderLetterPanel();">' + f.l + '</button>';
  });
  html += '</div></div>';

  // 信件列表容器
  html += '<div class="hy-hist-body">';
  if (letters.length === 0) {
    html += '<div class="hy-hist-empty">' + (_filter==='all' ? '\u5C1A\u65E0\u5F80\u6765\u4E66\u4FE1' : '\u65E0\u5339\u914D\u4FE1\u4EF6') + '</div>';
  } else {
    letters.sort(function(a,b) { return (a.sentTurn||0) - (b.sentTurn||0); });
    letters.forEach(function(l) { html += _ltRenderLetterCard(l, target); });
  }
  html += '</div>';

  hist.innerHTML = html;
  var _body = hist.querySelector('.hy-hist-body');
  if (_body) _body.scrollTop = _body.scrollHeight;
}

/** 渲染单封信笺卡片 */
function _ltRenderLetterCard(l, target) {
  var html = '';
  var isOutgoing = (l.from === '玩家');
  var sentDate = (typeof getTSText === 'function') ? getTSText(l.sentTurn) : '第' + l.sentTurn + '回合';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeInfo = LETTER_TYPES[l.letterType] || LETTER_TYPES.personal;
  var _intercepted = (l.status === 'intercepted' || l.status === 'intercepted_forging');
  var _inTransit = (l.status === 'traveling' || l.status === 'replying');
  var _lost = (l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1));

  // 外层 msg 类
  var msgCls = 'hy-msg ';
  if (_lost) msgCls += 'hy-msg-lost';
  else if (_intercepted) msgCls += 'hy-msg-intercept';
  else if (_inTransit) msgCls += 'hy-msg-transit';
  else if (isOutgoing) msgCls += 'hy-msg-player';
  else msgCls += 'hy-msg-npc';

  // 印章类
  var sealCls = 'personal';
  if (/secret|decree/.test(l.letterType||'')) sealCls = 'secret';
  else if (/military|army|order/.test(l.letterType||'')) sealCls = 'military';
  var sealChar = typeInfo.label ? String(typeInfo.label).charAt(0) : (isOutgoing ? '\u8C15' : '\u62A5');

  // 标记已读
  if (!isOutgoing && !l._playerRead) l._playerRead = true;

  html += '<div class="' + msgCls + '"><span class="hy-msg-tag"></span>';
  html += '<div class="hy-letter">';
  html += '<div class="seal ' + sealCls + '">' + sealChar + '</div>';
  html += '<div class="header">';
  html += '<span class="type-pill">' + escHtml(typeInfo.label || '\u4E66\u51FD') + '</span>';
  html += '<span>' + escHtml(urgLabels[l.urgency] || '\u9A7F\u9012') + '</span>';
  if (l._cipher && l._cipher !== 'none') html += '<span>' + escHtml((LETTER_CIPHERS[l._cipher]||{}).label || l._cipher) + '</span>';
  if (l._tokenUsed) html += '<span>' + escHtml((LETTER_TOKENS[l._tokenUsed]||{}).label || l._tokenUsed) + '</span>';
  if (l._sendMode === 'multi_courier') html += '<span>\u591A\u8DEF</span>';
  if (l._sendMode === 'secret_agent') html += '<span>\u5BC6\u4F7F' + (l._agentName ? '(' + escHtml(l._agentName) + ')' : '') + '</span>';
  if (l._multiRecipients) html += '<span>\u7FA4\u53D1' + l._multiRecipients + '\u4EBA</span>';
  html += '<span class="date">' + escHtml(sentDate) + '</span>';
  html += '</div>';
  // 正文
  html += '<div class="body wd-selectable">' + escHtml(l.content || '') + '</div>';
  // 署名
  var _sig = isOutgoing ? '\u6731\u624B\u4E66' : ('\u81E3 ' + escHtml(l.from||target) + ' \u987F\u9996');
  html += '<div class="signature">' + escHtml(sentDate) + '\u00B7' + _sig + '</div>';
  // 回信（朱笔批注/来回信内容）
  if (l.reply && (l.status === 'returned' || l.status === 'intercepted_forging') && isOutgoing) {
    var replyDate = (typeof getTSText === 'function') ? getTSText(l.replyTurn||GM.turn) : '';
    html += '<div class="reply">';
    html += '<div class="reply-label">\u56DE \u4E66 \u00B7 ' + escHtml(l.to||target) + (replyDate ? '\u00B7' + escHtml(replyDate) : '') + '</div>';
    html += escHtml(l.reply);
    if (l._isForged && (GM._letterSuspects||[]).indexOf(l.id) >= 0) {
      html += '<div style="font-size:11px;color:var(--amber-400);margin-top:4px;font-style:normal;">\u26A0 \u5DF2\u6807\u8BB0\u5B58\u7591\u2014\u2014\u6B64\u4FE1\u5185\u5BB9\u771F\u4F2A\u5F85\u6838</div>';
    }
    if (l._forgedRevealed) {
      html += '<div style="font-size:11px;color:var(--vermillion-400);margin-top:4px;font-weight:bold;font-style:normal;">\u26A0 \u5DF2\u8BC1\u5B9E\u4E3A\u4F2A\u9020\uFF01</div>';
    }
    html += '</div>';
  }
  html += '</div>'; // .hy-letter

  // 操作按钮（信件动作）
  var acts = '';
  if (l.status === 'blocked' && isOutgoing) {
    acts += '<button class="hy-filter-btn" style="color:var(--vermillion-400);border-color:var(--vermillion-400);" onclick="_ltBypassBlock(\'' + l.id + '\')" title="\u7ED5\u8FC7\u4E2D\u4E66\uFF0C\u6539\u7528\u5BC6\u65E8\u76F4\u53D1">\u6539\u7528\u5BC6\u65E8</button>';
  }
  if (l.status === 'traveling' && isOutgoing && !l._recallSent) {
    acts += '<button class="hy-filter-btn" onclick="_ltRecall(\'' + l.id + '\')" title="\u6D3E\u5FEB\u9A6C\u8FFD\u56DE\u4FE1\u4F7F">\u8FFD\u3000\u56DE</button>';
  }
  if ((l.status === 'returned' || l.status === 'intercepted_forging') && l.reply && isOutgoing) {
    if ((GM._letterSuspects||[]).indexOf(l.id) < 0) {
      acts += '<button class="hy-filter-btn" onclick="_ltSuspect(\'' + l.id + '\')" title="\u6807\u8BB0\u6B64\u56DE\u4FE1\u53EF\u7591">\u5B58\u3000\u7591</button>';
    }
    acts += '<button class="hy-filter-btn" onclick="_ltVerify(\'' + l.id + '\')" title="\u518D\u9063\u4FE1\u4F7F\u6838\u5B9E">\u9063\u4F7F\u6838\u5B9E</button>';
  }
  if (!isOutgoing && l.status === 'returned' && l._npcInitiated) {
    if (!l._playerReplied) {
      acts += '<button class="hy-filter-btn active" onclick="_ltReplyToNpc(\'' + l.id + '\')" title="\u56DE\u590D\u6B64\u51FD">\u56DE\u3000\u4E66</button>';
    }
    acts += '<button class="hy-filter-btn" onclick="_ltExcerptToEdict(\'' + l.id + '\')" title="\u5212\u9009\u4FE1\u4E2D\u6587\u5B57\u540E\u70B9\u6B64\uFF0C\u6458\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93">\u6458\u3000\u5165</button>';
  }
  acts += '<button class="hy-filter-btn' + (l._starred?' active':'') + '" onclick="_ltStar(\'' + l.id + '\')" title="\u6807\u8BB0\u91CD\u8981">' + (l._starred ? '\u2605' : '\u2606') + '</button>';

  if (acts) {
    html += '<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;' + (isOutgoing?'justify-content:flex-end;':'') + '">' + acts + '</div>';
  }

  // 信使状态条
  if (l.status === 'traveling' || l.status === 'delivered' || l.status === 'replying' || l.status === 'blocked') {
    var _cTxt = _ltGetStatusText(l);
    html += '<div style="font-size:10.5px;color:var(--ink-300);margin-top:4px;font-style:italic;letter-spacing:0.08em;' + (isOutgoing?'text-align:right;':'') + '">\u21A3 ' + escHtml(_cTxt) + '</div>';
  }
  html += '</div>'; // .hy-msg
  return html;
}

/** 信件状态文本 */
function _ltGetStatusText(l) {
  if (l.status === 'traveling') {
    var arrDate = (typeof getTSText === 'function') ? getTSText(l.deliveryTurn) : '第' + l.deliveryTurn + '回合';
    if (l._recallSent) return '追回信使已派出';
    if (GM.turn > l.deliveryTurn + 1) return '⚠ 信使逾期未归';
    return '信使在途…… 预计' + arrDate + '送达';
  }
  if (l.status === 'delivered') return '已送达，等待回函……';
  if (l.status === 'replying') return '回函在途……';
  if (l.status === 'intercepted') return '⚠ 信使失踪';
  if (l.status === 'intercepted_forging') return '回函在途……';
  if (l.status === 'recalled') return '信使已追回';
  if (l.status === 'blocked') return '⚠ 中书门下阻止，未能下达';
  if (l.status === 'returned') {
    var note = (GM._courierStatus||{})[l.id];
    return note || '信使已归';
  }
  return l.status || '';
}

/** NPC选择（单选/多选模式） */
function _ltSelectTarget(name) {
  if (GM._ltMultiMode) {
    if (!GM._ltMultiTargets) GM._ltMultiTargets = [];
    var idx = GM._ltMultiTargets.indexOf(name);
    if (idx >= 0) GM._ltMultiTargets.splice(idx, 1);
    else GM._ltMultiTargets.push(name);
  } else {
    GM._pendingLetterTo = name;
  }
  renderLetterPanel();
}

/** 统计辅助函数 */
function _ltCountUnread(name) {
  return (GM.letters||[]).filter(function(l) { return l.from === name && !l._playerRead; }).length;
}
function _ltCountTransit(name) {
  return (GM.letters||[]).filter(function(l) { return l.to === name && (l.status === 'traveling' || l.status === 'replying'); }).length;
}
function _ltCountLost(name) {
  return (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'intercepted'; }).length
    + (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'traveling' && GM.turn > l.deliveryTurn + 1; }).length;
}
function _ltCountNpcNew(name) {
  return (GM.letters||[]).filter(function(l) { return l.from === name && !l._playerRead && l.status === 'returned'; }).length;
}

/** 检查驿路是否阻断 */
function _ltIsRouteBlocked(from, to) {
  var disruptions = GM._routeDisruptions || [];
  return disruptions.some(function(d) {
    if (d.resolved) return false;
    // 检查方向是否匹配（任一端点匹配即视为阻断）
    return (d.from === from || d.to === from || d.from === to || d.to === to || d.route === from + '-' + to || d.route === to + '-' + from);
  });
}

/** 标记回信存疑 */
function _ltSuspect(letterId) {
  if (!GM._letterSuspects) GM._letterSuspects = [];
  if (GM._letterSuspects.indexOf(letterId) < 0) GM._letterSuspects.push(letterId);
  toast('已标记此信存疑，AI推演将据此判断');
  renderLetterPanel();
}

/** 标记/取消重要 */
function _ltStar(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (l) l._starred = !l._starred;
  renderLetterPanel();
}

/** 追回信使 */
function _ltRecall(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l || l.status !== 'traveling') { toast('此信已无法追回'); return; }
  // 追回概率基于已过时间——刚发出容易追回，接近送达则难
  var elapsed = GM.turn - l.sentTurn;
  var total = l.deliveryTurn - l.sentTurn;
  var recallChance = total > 0 ? Math.max(0.1, 1 - (elapsed / total) * 0.8) : 0.5;
  l._recallSent = true;
  // 追回结果在下回合结算中处理
  l._recallChance = recallChance;
  toast('已派快马追回（成功率约' + Math.round(recallChance * 100) + '%），下回合见分晓');
  renderLetterPanel();
}

/** 回复NPC来函 */
function _ltReplyToNpc(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  // 设置当前目标为该NPC，并在textarea中预填回复提示
  GM._pendingLetterTo = l.from;
  GM._ltReplyingTo = letterId;
  renderLetterPanel();
  var ta = _$('letter-textarea');
  if (ta) { ta.focus(); ta.placeholder = '回复' + l.from + '的来函……'; }
}

/** 绕过中书门下阻止——改为密旨发出 */
function _ltBypassBlock(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  l.status = 'traveling';
  l.letterType = 'secret_decree';
  l.sentTurn = GM.turn;
  var days = calcLetterDays(l.fromLocation, l.toLocation, l.urgency || 'normal');
  var dpv = _getDaysPerTurn();
  l.deliveryTurn = GM.turn + Math.max(1, Math.ceil(days / dpv));
  l.replyTurn = l.deliveryTurn + Math.max(1, Math.ceil(days / dpv));
  toast('已改密旨直发——绕过中书门下');
  renderLetterPanel();
}

/** 摘入建议库（划选来函文字后点击，同问对流程） */
function _ltExcerptToEdict(letterId) {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('请先在来函中划选要摘录的文字'); return; }
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  var from = l ? (l.from || '?') : '?';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '鸿雁', from: from, content: text, turn: GM.turn, used: false });
  toast('已摘入诏书建议库');
  // 如果诏令tab可见则刷新
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/** 遣使核实 */
function _ltVerify(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  var capital = GM._capital || '京城';
  var ch = findCharByName(l.to);
  var toLoc = ch ? (ch.location || capital) : capital;
  var days = calcLetterDays(capital, toLoc, 'urgent');
  var dpv = _getDaysPerTurn();
  var verifyLetter = {
    id: uid(), from: '玩家', to: l.to,
    fromLocation: capital, toLocation: toLoc,
    content: '核实前函——朕遣使复核，卿是否曾收到前日来函并亲笔回书？',
    sentTurn: GM.turn, deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
    replyTurn: GM.turn + Math.max(2, Math.ceil(days * 2 / dpv)),
    reply: '', status: 'traveling', urgency: 'urgent',
    letterType: 'secret_decree', _verifyTarget: letterId
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(verifyLetter);
  toast('已遣快马核实，约' + days + '天可知真伪');
  renderLetterPanel();
}

/** 发送信件（支持单发/群发/密使/多路/加密/信物） */
function sendLetter() {
  var textarea = _$('letter-textarea');
  var content = textarea ? textarea.value.trim() : '';
  if (!content) { toast('请写下信函内容'); return; }
  var urgency = _$('letter-urgency') ? _$('letter-urgency').value : 'normal';
  var letterType = _$('letter-type') ? _$('letter-type').value : 'personal';
  var cipher = _$('letter-cipher') ? _$('letter-cipher').value : 'none';
  var sendMode = _$('letter-sendmode') ? _$('letter-sendmode').value : 'normal';

  // 确定收信人列表
  var targets = [];
  if (GM._ltMultiMode && GM._ltMultiTargets && GM._ltMultiTargets.length > 0) {
    targets = GM._ltMultiTargets.slice();
  } else if (GM._pendingLetterTo) {
    targets = [GM._pendingLetterTo];
  }
  if (targets.length === 0) { toast('请先选择收信人'); return; }

  var capital = GM._capital || '京城';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeLabel = (LETTER_TYPES[letterType]||{}).label || '书信';
  var sentDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  var dpv = _getDaysPerTurn();
  var multiCount = targets.length > 1 ? targets.length : 0;

  // 信物检查（征调令需虎符等）
  var tokenNeeded = (LETTER_TYPES[letterType]||{}).needsToken;
  var tokenUsed = '';
  if (tokenNeeded && typeof tokenNeeded === 'string') {
    // 检查是否有此信物（物品系统）——若无则警告但仍可发（NPC可能不从）
    var _hasToken = (GM.items||[]).some(function(it) { return it.type === tokenNeeded || it.name === (LETTER_TOKENS[tokenNeeded]||{}).label; });
    if (!_hasToken) {
      toast('⚠ 未持有' + ((LETTER_TOKENS[tokenNeeded]||{}).label||'凭证') + '——对方可能疑诏不从');
    }
    tokenUsed = tokenNeeded;
  }

  // 密使模式：选择一个NPC作为信使
  var agentName = '';
  if (sendMode === 'secret_agent') {
    var _agentSel = _$('letter-agent');
    agentName = _agentSel ? _agentSel.value : '';
  }

  // 正式诏令经中书门下（权臣可能阻挠）
  var _formalBlocked = false;
  if ((LETTER_TYPES[letterType]||{}).formal) {
    // 检查是否有权臣把控中书——通过官制系统
    var _primeMin = _ltFindPrimeMinister();
    if (_primeMin && (_primeMin.loyalty||50) < 30 && (_primeMin.ambition||50) > 70) {
      _formalBlocked = true;
      toast('⚠ ' + _primeMin.name + '阻挠此诏令流转——可改用密旨绕过');
    }
  }

  targets.forEach(function(target) {
    var ch = findCharByName(target);
    var toLoc = ch ? (ch.location || capital) : capital;
    var days = calcLetterDays(capital, toLoc, urgency);
    // 密使模式速度更慢但更安全
    if (sendMode === 'secret_agent') days = Math.ceil(days * 1.5);
    // 多路信使增加冗余
    var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
    var replyDays = days * 2 + 3;
    var replyTurns = Math.max(deliveryTurns + 1, Math.ceil(replyDays / dpv));

    var letter = {
      id: uid(), from: '玩家', to: target,
      fromLocation: capital, toLocation: toLoc,
      content: content, sentTurn: GM.turn,
      deliveryTurn: GM.turn + deliveryTurns,
      replyTurn: GM.turn + replyTurns,
      reply: '', status: _formalBlocked ? 'blocked' : 'traveling',
      urgency: urgency, letterType: letterType,
      _cipher: cipher, _sendMode: sendMode,
      _tokenUsed: tokenUsed, _agentName: agentName,
      _multiRecipients: multiCount > 0 ? multiCount : undefined,
      _replyingTo: GM._ltReplyingTo || undefined
    };

    // 如果是回复NPC来函，标记原函已回复
    if (GM._ltReplyingTo) {
      var origLetter = (GM.letters||[]).find(function(x){ return x.id === GM._ltReplyingTo; });
      if (origLetter) origLetter._playerReplied = true;
    }

    // 征调令/密旨→自动注册诏令追踪
    if (letterType === 'military_order' || letterType === 'secret_decree' || letterType === 'formal_edict') {
      if (!GM._edictTracker) GM._edictTracker = [];
      GM._edictTracker.push({
        content: content, category: letterType === 'military_order' ? '军令' : '政令',
        turn: GM.turn, status: 'pending', source: 'letter',
        target: target, letterId: letter.id
      });
    }

    if (!GM.letters) GM.letters = [];
    GM.letters.push(letter);
  });

  if (GM.qijuHistory) {
    var _targetNames = targets.join('、');
    GM.qijuHistory.unshift({ turn: GM.turn, date: sentDate, content: '【鸿雁传书】遣' + (urgLabels[urgency]||'驿递') + '致' + _targetNames + '（' + typeLabel + (cipher !== 'none' ? '·' + (LETTER_CIPHERS[cipher]||{}).label : '') + '）。内容：' + content });
  }

  if (textarea) textarea.value = '';
  GM._ltReplyingTo = undefined;
  GM._ltMultiMode = false;
  GM._ltMultiTargets = [];
  toast(targets.length > 1 ? '已群发' + targets.length + '函' : '信函已发出（' + (urgLabels[urgency]||'驿递') + '）');
  renderLetterPanel();
}

/** 查找宰相/中书令 */
function _ltFindPrimeMinister() {
  if (!P.officeConfig) return null;
  var _depts = P.officeConfig.departments || [];
  for (var i = 0; i < _depts.length; i++) {
    var d = _depts[i];
    if (d.name && (d.name.indexOf('中书') >= 0 || d.name.indexOf('宰') >= 0 || d.name.indexOf('丞相') >= 0)) {
      var _pos = d.positions || [];
      for (var j = 0; j < _pos.length; j++) {
        if (_pos[j].holder) return findCharByName(_pos[j].holder);
      }
    }
  }
  return null;
}

/** 每回合结算信件传递+角色赶路 (注册到SettlementPipeline) */
function _settleLettersAndTravel() {
  var dpv = _getDaysPerTurn();
  if (!GM._courierStatus) GM._courierStatus = {};
  if (!GM._npcCorrespondence) GM._npcCorrespondence = [];

  var _gMode = (P.conf && P.conf.gameMode) || '';
  var _canIntercept = _gMode === 'strict_hist' || _gMode === 'light_hist';
  var _hostileFacs = (GM.facs||[]).filter(function(f){ return !f.isPlayer && (f.playerRelation||0) < -50; });

  // 0. 处理追回信使
  (GM.letters||[]).forEach(function(l) {
    if (l._recallSent && l.status === 'traveling' && !l._recallResolved) {
      l._recallResolved = true;
      if (Math.random() < (l._recallChance||0.5)) {
        l.status = 'recalled';
        if (typeof addEB === 'function') addEB('传书', '致' + l.to + '的信使已追回');
        toast('信使已追回——致' + l.to + '的函未送达');
      } else {
        if (typeof addEB === 'function') addEB('传书', '追回信使失败——致' + l.to + '的函仍在途');
      }
    }
  });

  // 1. 推进玩家信件
  (GM.letters||[]).forEach(function(l) {
    if (l.status === 'blocked') return; // 被中书阻挠
    if (l.status === 'recalled') return;
    if (l.status === 'traveling' && GM.turn >= l.deliveryTurn) {
      // 截获判定
      if (_canIntercept && !l._interceptChecked) {
        l._interceptChecked = true;
        var _rate = _ltCalcInterceptRate(l, _hostileFacs);
        if (Math.random() < _rate) {
          _ltDoIntercept(l, _hostileFacs);
          return;
        }
      }
      l.status = 'delivered';
      if (typeof addEB === 'function') addEB('传书', '致' + (l.to||l.from) + '的信已送达' + (l.toLocation||''));
      // 收信者记忆（玩家→NPC 的信件，无论是否回信都记入记忆）
      if (!l._npcInitiated && l.to) {
        try {
          if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
            var _rcvCh = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
            if (_rcvCh && _rcvCh.alive !== false) {
              var _typeLabel = (typeof LETTER_TYPES !== 'undefined' && LETTER_TYPES[l.letterType]) ? LETTER_TYPES[l.letterType].label : '来函';
              var _urgLabel = l.urgency === 'extreme' ? '八百里加急' : l.urgency === 'urgent' ? '加急' : '驿递';
              var _subj = l.subjectLine ? ('《' + String(l.subjectLine).slice(0,20) + '》') : '';
              var _body = String(l.content || '').replace(/<[^>]+>/g, '').slice(0, 80);
              var _memTxt = '收天子亲笔' + _typeLabel + '(' + _urgLabel + ')' + _subj + '：' + _body;
              // 情绪依据信件类型与称谓
              var _emoMap = {
                edict: '敬', secret_edict: '惧', military_order: '惧', summons: '敬',
                inquiry: '平', encouragement: '喜', reprimand: '惧',
                personal: '喜', consolation: '哀', condolence: '哀',
                appointment: '敬', promotion: '喜', dismissal: '怒'
              };
              var _emo = _emoMap[l.letterType] || '敬';
              var _weight = l.urgency === 'extreme' ? 8 : l.urgency === 'urgent' ? 7 : 6;
              NpcMemorySystem.remember(l.to, _memTxt, _emo, _weight, '天子', {
                type: 'dialogue',
                source: 'witnessed',
                credibility: 100
              });
            }
          }
        } catch(_memE) {}
      }
      if (!l._npcInitiated) _generateLetterReply(l);
    }
    if (l.status === 'replying' && GM.turn >= l.replyTurn) {
      l.status = 'returned';
      var _replyNpc = findCharByName(l.to);
      var _dem = _replyNpc ? (_replyNpc.loyalty > 80 ? '恭敬拜读' : _replyNpc.loyalty < 30 ? '面色凝重' : _replyNpc.stress > 70 ? '神色疲惫' : '速具回书') : '已收函';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + _dem + '。';
      // 核实信处理
      if (l._verifyTarget) {
        var _orig = (GM.letters||[]).find(function(x){ return x.id === l._verifyTarget; });
        if (_orig && _orig._isForged) {
          l.reply = '臣' + l.to + '惶恐顿首——臣从未收到前日来函，更未曾回书！此前所谓回信必是伪造！请陛下明察！';
          _orig._forgedRevealed = true;
          if (typeof addEB === 'function') addEB('传书', '⚠ ' + l.to + '证实前函回信系伪造！');
        }
      }
      // 征调令/密旨未附信物→NPC可能不从
      if (l._tokenUsed === 'tally' && l.letterType === 'military_order') {
        var _hasIt = (GM.items||[]).some(function(it){ return it.type === 'tally' || it.name === '虎符'; });
        if (!_hasIt && _replyNpc && _replyNpc.loyalty < 60) {
          l.reply = (l.reply||'') + '\n（按：' + l.to + '以未见虎符为由，暂未奉行征调。）';
        }
      }
      var replyDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: replyDate, content: '【鸿雁传书】' + l.to + '回函到达。' + (l.reply||'') });
    }
    // 伪造回信
    if (l.status === 'intercepted_forging' && GM.turn >= l.replyTurn) {
      l.status = 'returned'; l._isForged = true;
      l.reply = '臣谨奉诏。诸事安好，请陛下放心。臣当继续勉力。';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + '已收函。';
      var _fd = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: _fd, content: '【鸿雁传书】' + l.to + '回函到达。' + l.reply });
      if (!GM._interceptedIntel) GM._interceptedIntel = [];
      GM._interceptedIntel.push({ turn: GM.turn, interceptor: l.interceptedBy||'敌方', from: '伪造', to: '皇帝', content: '敌方已伪造' + l.to + '的回信欺骗玩家', urgency: 'forged' });
    }
  });

  // 2. NPC主动来书入队
  if (GM._pendingNpcLetters && GM._pendingNpcLetters.length > 0) {
    var capital = GM._capital || '京城';
    GM._pendingNpcLetters.forEach(function(nl) {
      var fromCh = findCharByName(nl.from);
      var fromLoc = fromCh ? (fromCh.location || '远方') : '远方';
      var days = calcLetterDays(fromLoc, capital, nl.urgency || 'normal');
      var letter = {
        id: uid(), from: nl.from, to: '玩家', fromLocation: fromLoc, toLocation: capital,
        content: nl.content||'', sentTurn: GM.turn,
        deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
        reply: '', status: 'traveling', urgency: nl.urgency||'normal',
        letterType: nl.type||'report', _npcInitiated: true,
        _replyExpected: nl.replyExpected !== false, _playerRead: false,
        _suggestion: nl.suggestion || ''
      };
      if (_canIntercept && nl.type !== 'proclamation') {
        var _r2 = _ltCalcInterceptRate(letter, _hostileFacs);
        if (Math.random() < _r2) { _ltDoIntercept(letter, _hostileFacs); }
      }
      // NPC记住自己写了什么（防止续奏/来函前后矛盾）
      if (nl.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
        var _typeLabels = {report:'奏报',plea:'陈情',warning:'急报',intelligence:'密信',personal:'私函'};
        NpcMemorySystem.remember(nl.from, '向天子上' + (_typeLabels[nl.type]||'书') + '：' + (nl.content||'').slice(0,60), '平', 5);
      }
      if (!GM.letters) GM.letters = [];
      GM.letters.push(letter);
    });
    GM._pendingNpcLetters = [];
  }

  // 3. NPC来信到达 → 自动推入诏书建议库
  (GM.letters||[]).forEach(function(l) {
    if (l._npcInitiated && l.status === 'traveling' && GM.turn >= l.deliveryTurn) {
      l.status = 'returned';
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.from + '的来函已送达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: ad, content: '【鸿雁传书】收到' + l.from + '自' + (l.fromLocation||'远方') + '来函。' });
      // NPC来函附带的可操作建议 → 自动推入诏书建议库（同问对/朝议流程）
      // 只推AI提炼的suggestion摘要，不推整封信原文
      if (l._suggestion) {
        if (!GM._edictSuggestions) GM._edictSuggestions = [];
        var _dup = GM._edictSuggestions.some(function(s) { return s.from === l.from && s.content === l._suggestion; });
        if (!_dup) {
          GM._edictSuggestions.push({
            source: '鸿雁', from: l.from, content: l._suggestion,
            turn: GM.turn, used: false
          });
        }
      }
    }
  });

  // 4. NPC间通信（由AI推演，暂存在GM._pendingNpcCorrespondence）
  if (GM._pendingNpcCorrespondence && GM._pendingNpcCorrespondence.length > 0) {
    GM._pendingNpcCorrespondence.forEach(function(nc) {
      // 玩家的密探有概率截获
      var spyChance = 0.15; // 基础截获率
      if (GM._spyNetwork) spyChance += GM._spyNetwork * 0.01; // 情报网加成
      if (Math.random() < spyChance) {
        GM._npcCorrespondence.push({
          turn: GM.turn, from: nc.from, to: nc.to,
          content: nc.content||'', summary: nc.summary||'',
          implication: nc.implication||'', type: nc.type||'secret'
        });
        if (typeof addEB === 'function') addEB('情报', '截获' + nc.from + '致' + nc.to + '的密信');
      }
    });
    GM._pendingNpcCorrespondence = [];
  }

  // 5. 远方奏疏驿递到达
  if (GM._pendingMemorialDeliveries && GM._pendingMemorialDeliveries.length > 0) {
    var _arrivedMems = [];
    GM._pendingMemorialDeliveries = GM._pendingMemorialDeliveries.filter(function(mem) {
      if (mem.status === 'intercepted') return true; // 被截获的留在队列中（不到达）
      if (GM.turn >= mem._deliveryTurn) {
        mem.status = 'pending'; // 改为可批复
        mem.turn = GM.turn; // 更新为到达回合（让renderMemorials显示）
        mem._arrivedTurn = GM.turn;
        if (!GM.memorials) GM.memorials = [];
        GM.memorials.push(mem);
        _arrivedMems.push(mem);
        return false; // 从队列移除
      }
      return true; // 继续等待
    });
    _arrivedMems.forEach(function(mem) {
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('奏疏', mem.from + '自' + (mem._remoteFrom||'远方') + '的奏疏到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: ad, content: '【驿递奏疏】收到' + mem.from + '自' + (mem._remoteFrom||'远方') + '所上奏疏。' });
    });
    if (_arrivedMems.length > 0 && typeof renderMemorials === 'function') renderMemorials();
  }

  // 6. 推进角色赶路
  (GM.chars||[]).forEach(function(c) {
    if (c._travelTo && GM.turn >= c._travelArrival) {
      var arrDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      c.location = c._travelTo;
      if (typeof addEB === 'function') addEB('人事', c.name + '已抵达' + c.location);
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: arrDate, content: '【入京】' + c.name + '从' + c._travelFrom + '抵达' + c.location + '。' });
      c._travelTo = null;
      c._travelArrival = 0;
      c._travelFrom = '';
    }
  });
}

/** AI生成回信 */
/** 计算截获概率（基于地理、势力范围、驿路、加密、信件类型） */
function _ltCalcInterceptRate(l, hostileFacs) {
  if (l.letterType === 'proclamation') return 0; // 檄文公开
  // 基础概率
  var rate = l.urgency === 'extreme' ? 0.02 : l.urgency === 'urgent' ? 0.05 : 0.10;
  // 信件类型权重
  var tw = (LETTER_TYPES[l.letterType]||{}).interceptWeight;
  if (tw !== undefined) rate *= (tw || 0.1);
  // 敌对势力加成
  if (hostileFacs && hostileFacs.length > 0) rate += 0.10;
  // 地理因素：目标地是否在敌对势力控制区
  if (l.toLocation || l.fromLocation) {
    var _loc = l.toLocation || l.fromLocation;
    var _inHostile = (GM.facs||[]).some(function(f) {
      if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
      var _fTerr = f.territories || f.territory || [];
      if (typeof _fTerr === 'string') _fTerr = [_fTerr];
      return _fTerr.indexOf(_loc) >= 0;
    });
    if (_inHostile) rate += 0.25; // 途经敌占区
  }
  // 围城中的信更难出去
  var _besieged = (GM._sieges||[]).some(function(s) { return s.target === l.fromLocation || s.target === l.toLocation; });
  if (_besieged) rate += 0.40;
  // 驿路阻断
  if (_ltIsRouteBlocked(l.fromLocation, l.toLocation)) rate += 0.30;
  // 加密降低截获内容可读性（但不降低截获率——只降低情报价值）
  // 密使模式降低截获率
  if (l._sendMode === 'secret_agent') rate *= 0.3;
  // 多路信使降低截获率（至少一路成功）
  if (l._sendMode === 'multi_courier') rate *= 0.15;
  return Math.min(0.9, Math.max(0, rate));
}

/** 执行截获 */
function _ltDoIntercept(l, hostileFacs) {
  l.status = 'intercepted';
  var _int = hostileFacs && hostileFacs.length > 0 ? hostileFacs[Math.floor(Math.random()*hostileFacs.length)].name : '不明势力';
  l.interceptedBy = _int;
  // 加密影响情报价值
  var _cipherInfo = LETTER_CIPHERS[l._cipher] || LETTER_CIPHERS.none;
  var _canRead = Math.random() < _cipherInfo.interceptReadChance;
  if (!GM._interceptedIntel) GM._interceptedIntel = [];
  GM._interceptedIntel.push({
    turn: GM.turn, interceptor: _int,
    from: l._npcInitiated ? l.from : '皇帝', to: l._npcInitiated ? '皇帝' : l.to,
    content: _canRead ? (l.content||'') : '（密函已截获但无法破译内容）',
    urgency: l.urgency||'normal', letterType: l.letterType||'personal',
    encrypted: !_canRead,
    militaryRelated: _canRead && ((l.content||'').indexOf('兵') >= 0 || (l.content||'').indexOf('军') >= 0 || l.letterType === 'military_order'),
    diplomaticRelated: _canRead && ((l.content||'').indexOf('盟') >= 0 || (l.content||'').indexOf('使') >= 0)
  });
  if (GM._interceptedIntel.length > 30) GM._interceptedIntel.shift();
  if (!GM._undeliveredLetters) GM._undeliveredLetters = [];
  GM._undeliveredLetters.push({ to: l._npcInitiated ? '皇帝' : l.to, content: l.content, turn: GM.turn, interceptor: _int });
  GM._courierStatus[l.id] = '⚠ 信使逾期未归——去向不明';
  // 伪造回信
  if (!l._npcInitiated) {
    var _iFac = (GM.facs||[]).find(function(f){ return f.name === _int; });
    if (_iFac && Math.random() < 0.3) {
      l._forgedReply = true; l.status = 'intercepted_forging'; l.replyTurn = GM.turn + 1;
    }
  }
  if (typeof addEB === 'function') addEB('传书', (l._npcInitiated ? l.from + '的来函' : '致' + l.to + '的') + '信使逾期未归');
}

function _generateLetterReply(letter) {
  letter.status = 'replying';
  var ch = findCharByName(letter.to);
  if (!ch) { letter.reply = '臣已拜读圣函。'; letter.status = 'returned'; return; }
  // 注：收信记忆已在 _settleLettersAndTravel 的 delivered 节点注入，此处不重复

  var typeLabel = (LETTER_TYPES[letter.letterType]||{}).label || '书信';

  if (typeof callAI === 'function' && P.ai && P.ai.key) {
    var brief = (typeof getCharacterPersonalityBrief === 'function') ? getCharacterPersonalityBrief(ch) : ch.name;
    var memCtx = (typeof NpcMemorySystem !== 'undefined') ? NpcMemorySystem.getMemoryContext(ch.name) : '';
    // 对玩家好感/积怨·影响语气
    var favor = 0;
    try { if (ch._impressions && ch._impressions['玩家']) favor = ch._impressions['玩家'].favor || 0; } catch(_){}
    var toneHint = '';
    if (favor >= 20) toneHint = '\n语气：感激温厚·愿效死力';
    else if (favor >= 5) toneHint = '\n语气：恭敬有分寸';
    else if (favor <= -15) toneHint = '\n语气：表面恭顺但暗含怨怼或疏离·可有所保留';
    else if (favor <= -5) toneHint = '\n语气：礼数不失但缺少热络';
    else toneHint = '\n语气：标准臣礼·不卑不亢';

    // 情节弧·若有
    var arcCtx = '';
    try {
      var arc = (typeof GM !== 'undefined' && GM._charArcs && GM._charArcs[ch.name]) ? GM._charArcs[ch.name] : null;
      if (arc) {
        if (arc.arcStage) arcCtx += '\n当前境：'+arc.arcStage;
        if (arc.motivation) arcCtx += '\n当前动机：'+arc.motivation;
        if (arc.emotionalState) arcCtx += '\n情绪基调：'+arc.emotionalState;
      }
    } catch(_){}

    // 近期涉该 NPC 的玩家诏令
    var recentEdictCtx = '';
    try {
      var tracker = (GM._edictTracker || []).filter(function(e) {
        if (!e || !e.content) return false;
        return e.content.indexOf(ch.name) >= 0 && (GM.turn - (e.turn||0)) <= 3;
      }).slice(-3);
      if (tracker.length > 0) {
        recentEdictCtx = '\n玩家近期涉君诏令(回信可顺带回应)：';
        tracker.forEach(function(t) { recentEdictCtx += '\n  · ' + (t.content||'').slice(0, 80); });
      }
    } catch(_){}

    // 本轮往来上下文·若此信不是第一次
    var priorHistory = '';
    try {
      var earlier = (GM.letters || []).filter(function(l) {
        return l && l !== letter && ((l.to === ch.name) || (l.from === ch.name));
      }).slice(-3);
      if (earlier.length > 0) {
        priorHistory = '\n往来背景(近 3 封)：';
        earlier.forEach(function(l) {
          var dir = (l.from === ch.name) ? (ch.name+'→帝') : ('帝→'+ch.name);
          priorHistory += '\n  · '+dir+'·'+((l.content||'').slice(0, 50))+((l.reply&&l.from!==ch.name)?'(已回:'+l.reply.slice(0,40)+')':'');
        });
      }
    } catch(_){}

    var cipherLabel = (LETTER_CIPHERS && LETTER_CIPHERS[letter.cipher] && LETTER_CIPHERS[letter.cipher].label) || '不加密';
    var prompt = '你是' + ch.name + '·' + (ch.officialTitle||ch.title||'') + '·当前在' + (ch.location||'远方') + '。\n性格：' + brief;
    if (ch.stance) prompt += '\n政治立场：' + ch.stance;
    if (ch.party) prompt += '\n党派：' + ch.party + (ch.partyRank?'·'+ch.partyRank:'');
    if (memCtx) prompt += '\n近期心绪：' + memCtx;
    if (arcCtx) prompt += arcCtx;
    if (recentEdictCtx) prompt += recentEdictCtx;
    if (priorHistory) prompt += priorHistory;
    prompt += toneHint;
    if (typeof _buildTemporalConstraint === 'function') { try { prompt += _buildTemporalConstraint(ch); } catch(_){} }
    prompt += '\n\n收到来自京城天子的' + typeLabel + '('+cipherLabel+')：\n「' + letter.content + '」';
    prompt += '\n\n【回信要求】';
    prompt += '\n1. 以该角色口吻/身份/性格·100-200 字古典中文';
    prompt += '\n2. 称谓恰当(臣/末将/罪臣/妾身/草民等)';
    prompt += '\n3. 必须针对来信具体内容回应·不得套话空泛';
    prompt += '\n4. 若来信问及某事·直接给答复或说明缘由';
    prompt += '\n5. 若来信有命令·明确接旨或婉拒(附理由)';
    prompt += '\n6. 若近期有玩家涉君诏令·可在回信中顺带回应(感激/委屈/澄清/汇报)';
    prompt += '\n7. 语气与当前境/情绪/好感一致·不割裂';
    prompt += '\n8. 不要提及未在当前游戏时间之前发生的未来史实';
    prompt += '\n\n直接输出回信正文·无前言无解释。';
    callAI(prompt, 600).then(function(reply) {
      letter.reply = (reply || '').trim() || '臣叩首拜读·容臣三思后详禀。';
      letter.status = 'returned';
    }).catch(function() {
      letter.reply = '臣已拜读圣函·容臣三思。';
      letter.status = 'returned';
    });
  } else {
    letter.reply = '臣' + ch.name + '叩首·拜读圣函。容臣细思·当速具回奏。';
    letter.status = 'returned';
  }
}

/** AI prompt注入：角色位置+传书完整态势 */
function getLocationPromptInjection() {
  var capital = GM._capital || '京城';
  var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && c.location !== capital; });
  var allLetters = GM.letters || [];
  var pendingLetters = allLetters.filter(function(l) { return l.status !== 'returned' && l.status !== 'intercepted'; });
  var suspectedIds = GM._letterSuspects || [];

  if (remote.length === 0 && allLetters.length === 0) return '';
  var lines = ['【鸿雁传书·完整态势】'];
  lines.push('京城：' + capital);

  if (remote.length > 0) {
    lines.push('不在京城的角色（不能参与朝堂对话/朝议）：');
    remote.forEach(function(c) {
      var line = '  ' + c.name + '（' + c.location + '）';
      if (c._travelTo) line += ' →正在赶往' + c._travelTo;
      if (c.title) line += ' ' + c.title;
      lines.push(line);
    });
  }

  // 在途信件
  if (pendingLetters.length > 0) {
    lines.push('当前在途信件：');
    pendingLetters.forEach(function(l) {
      var typeLabel = (LETTER_TYPES[l.letterType]||{}).label || '书信';
      var st = { traveling:'信使在途', delivered:'已送达待回信', replying:'回信在途', intercepted_forging:'回信在途' };
      if (l._npcInitiated) {
        lines.push('  ' + l.from + '→皇帝（' + typeLabel + '·' + (l.urgency==='extreme'?'八百里加急':l.urgency==='urgent'?'加急':'驿递') + '）：' + (st[l.status]||l.status));
      } else {
        lines.push('  皇帝→' + l.to + '（' + typeLabel + '·' + (l.urgency==='extreme'?'八百里加急':l.urgency==='urgent'?'加急':'驿递') + '）：' + (st[l.status]||l.status));
      }
    });
  }

  // 信使失踪（截获线索——玩家看到的是"信使逾期"）
  var lostLetters = allLetters.filter(function(l) {
    return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1);
  });
  if (lostLetters.length > 0) {
    lines.push('信使失踪（可能被截获）：');
    lostLetters.forEach(function(l) {
      var target = l._npcInitiated ? ('来自' + l.from) : ('致' + l.to);
      lines.push('  ' + target + '的信使已逾期' + (GM.turn - l.deliveryTurn) + '回合未归');
      if (l._npcInitiated) lines.push('    →' + l.from + '不知道皇帝是否收到其报告，可能焦虑或自行决断');
      else lines.push('    →' + l.to + '未收到皇帝命令，不会按旨行事');
    });
  }

  // 玩家存疑的信件
  if (suspectedIds.length > 0) {
    lines.push('玩家存疑的回信：');
    suspectedIds.forEach(function(sid) {
      var sl = allLetters.find(function(l){ return l.id === sid; });
      if (sl) lines.push('  致' + sl.to + '的回信被玩家标记存疑' + (sl._isForged ? '——【确实是伪造的】' : '——【实际是真信】'));
    });
    lines.push('  →若回信确系伪造，应在叙事中给出更多线索（如NPC行为与信中所述矛盾）');
    lines.push('  →若为真信但被存疑，NPC可能因不被信任而不满');
  }

  // NPC期望回信但未回
  var _npcWaiting = allLetters.filter(function(l) {
    return l._npcInitiated && l._replyExpected && l.status === 'returned' && !l._playerReplied && (GM.turn - l.deliveryTurn) > 2;
  });
  if (_npcWaiting.length > 0) {
    lines.push('NPC待回信（期望回复但玩家未回）：');
    _npcWaiting.forEach(function(l) {
      lines.push('  ' + l.from + '来函已等' + (GM.turn - l.deliveryTurn) + '回合未回→可能影响NPC情绪（忠诚、焦虑）');
    });
  }

  // 精确信息时差
  if (remote.length > 0) {
    lines.push('【各NPC信息时差——决定NPC基于什么信息做决策】');
    remote.forEach(function(c) {
      var lastReceived = 0;
      allLetters.forEach(function(l) {
        if (l.to === c.name && (l.status === 'delivered' || l.status === 'returned' || l.status === 'replying')) {
          lastReceived = Math.max(lastReceived, l.deliveryTurn || l.sentTurn);
        }
      });
      var lastSent = 0;
      allLetters.forEach(function(l) {
        if (l.from === c.name && l.status === 'returned') {
          lastSent = Math.max(lastSent, l.sentTurn);
        }
      });
      var delay = lastReceived > 0 ? (GM.turn - lastReceived) : '从未';
      lines.push('  ' + c.name + '（' + c.location + '）：');
      lines.push('    最后收到皇帝指令：' + (lastReceived > 0 ? delay + '回合前' : '从未') + ' → 其决策基于' + (lastReceived > 0 ? delay + '回合前的信息' : '自身判断'));
      if (lastSent > 0) lines.push('    最后来函：' + (GM.turn - lastSent) + '回合前');
      // 是否有未送达命令
      var _undel = (GM._undeliveredLetters||[]).filter(function(u) { return u.to === c.name; });
      if (_undel.length > 0) lines.push('    ⚠ 有' + _undel.length + '封命令未送达——此NPC不知道皇帝的指令');
    });
  }

  // 驿路阻断
  var _disruptions = (GM._routeDisruptions||[]).filter(function(d) { return !d.resolved; });
  if (_disruptions.length > 0) {
    lines.push('【驿路阻断】');
    _disruptions.forEach(function(d) {
      lines.push('  ' + (d.route||d.from+'-'+d.to) + '：' + (d.reason||'原因不明') + ' → 该方向信件截获率大幅提高');
    });
  }

  lines.push('');
  lines.push('【信件驱动NPC行为——核心规则】');
  lines.push('NPC收到皇帝信件后的行为必须在npc_actions中体现：');
  lines.push('  - 收到征调令+有虎符 → 执行调兵（但可能阳奉阴违）');
  lines.push('  - 收到征调令但无虎符 → 疑诏不从，或要求出示凭证');
  lines.push('  - 收到密旨 → 秘密执行（但密旨不经中书，法理性弱）');
  lines.push('  - 从未收到指令 → 按自身判断行事，可能与皇帝意图相悖');
  lines.push('  - 信使失踪多日 → NPC焦虑，可能派人来京打探');
  lines.push('NPC间也会通信——在npc_correspondence中输出重要的NPC间密信：');
  lines.push('  格式: {from,to,content,summary,implication,type:"secret/alliance/conspiracy/routine"}');
  lines.push('  只输出对剧情有影响的通信（密谋/结盟/背叛/情报交换），不必输出日常问候');
  lines.push('NPC主动来书：远方NPC遇重大事件时应在npc_letters中输出。');
  return lines.join('\n');
}

/** 按需具象化——为未具象的在任官员生成角色 */
async function _offMaterialize(deptName, posName) {
  if (!P.ai || !P.ai.key) { toast('需要AI密钥'); return; }
  // 找到职位
  var _pos = null, _dept = null;
  (function _f(ns) { ns.forEach(function(n) { if (n.name === deptName) { (n.positions||[]).forEach(function(p) { if (p.name === posName) { _pos = p; _dept = n; } }); } if (n.subs) _f(n.subs); }); })(GM.officeTree||[]);
  if (!_pos) { toast('找不到职位'); return; }
  if (typeof _offMigratePosition === 'function') _offMigratePosition(_pos);
  var _m = _offMaterializedCount(_pos);
  if (_m >= (_pos.actualCount||0)) { toast('此职位所有在任者已具象'); return; }
  var _dynasty = '';
  var _sc4 = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
  if (_sc4) _dynasty = (_sc4.era||'') + (_sc4.dynasty||'');
  var _existNames = (GM.chars||[]).map(function(c) { return c.name; });
  try {
    toast('正在生成角色...');
    var prompt = '背景：' + (_dynasty||'中国古代') + '。为' + deptName + '的' + posName + '（' + (_pos.rank||'') + '）生成1名任职者。\n'
      + '优先用真实历史人物，找不到则虚构。\n'
      + '已有角色：' + _existNames.slice(0,15).join('、') + '\n'
      + '返回JSON：{"name":"人名","personality":"性格","intelligence":60,"administration":60,"military":40,"loyalty":60,"ambition":50}';
    var c = await callAI(prompt, 500);
    var parsed = extractJSON(c);
    if (parsed && parsed.name) {
      if (!GM.chars) GM.chars = [];
      if (!GM.chars.find(function(ch){ return ch.name === parsed.name; })) {
        GM.chars.push({
          name: parsed.name, title: posName, officialTitle: posName,
          personality: parsed.personality||'', intelligence: parsed.intelligence||55,
          administration: parsed.administration||55, military: parsed.military||40,
          loyalty: parsed.loyalty||55, ambition: parsed.ambition||45,
          location: GM._capital||'京城', alive: true,
          valor: parsed.valor||40, diplomacy: parsed.diplomacy||50, stress: 0
        });
      }
      // 加入holders
      if (!_pos.additionalHolders) _pos.additionalHolders = [];
      if (!_pos.holder) { _pos.holder = parsed.name; }
      else { _pos.additionalHolders.push(parsed.name); }
      toast('已生成：' + parsed.name);
      if (typeof renderOfficeTree === 'function') renderOfficeTree();
    }
  } catch(e) { toast('生成失败'); }
}

/** 丁忧/考课/任期结算 */
function _settleOfficeMourning() {
  // 1. 丁忧中的官员——在丁忧期间从官制树中标记空缺（但不删除holder，保留恢复）
  (GM.chars||[]).forEach(function(c) {
    if (!c._mourning || c.alive === false) return;
    if (GM.turn >= c._mourning.until) {
      // 丁忧期满——可复职
      c._mourning = null;
      if (typeof addEB === 'function') addEB('人事', c.name + '丁忧期满，可重新起用');
    } else if (c._mourning.since === GM.turn) {
      // 刚进入丁忧——从官制树中暂离（AI已在office_changes中dismiss）
      // 如果AI没有dismiss，这里补上
      (function _checkMourn(nodes) {
        nodes.forEach(function(n) {
          (n.positions||[]).forEach(function(p) {
            if (p.holder === c.name && !c._mourningDismissed) {
              c._mourningOldPost = { dept: n.name, pos: p.name, rank: p.rank };
              // 不直接清除holder——让AI在office_changes中处理
              // 但标记以便AI prompt知道
              c._mourningDismissed = true;
            }
          });
          if (n.subs) _checkMourn(n.subs);
        });
      })(GM.officeTree||[]);
    }
  });

  // 2. 考课周期提醒（在AI prompt中已注入，此处记录触发状态）
  if (GM.turn > 0 && GM.turn % 5 === 0) {
    if (!GM._lastEvalTurn || GM._lastEvalTurn < GM.turn - 3) {
      GM._lastEvalTurn = GM.turn;
      if (typeof addEB === 'function') addEB('官制', '考课之期——吏部应对百官考评');
    }
  }
}

function renderGameState(){
  // 旧 UI
  renderLeftPanel();
  renderBarResources();

  // 中间面板（游戏主体）
  var gc=_$("gc");if(!gc)return;
  gc.innerHTML="";

  // 面包屑
  var _bc=document.createElement("div");_bc.className="gs-breadcrumb";
  _bc.innerHTML='<span>朝野要务</span><span class="sep">›</span><span>本朝纪要</span><span class="sep">›</span><span class="cur" id="gs-bc-cur">朝 政</span>'
    +'<div class="gs-breadcrumb-right">'
    +'<button class="gs-bc-btn" onclick="if(typeof openGlobalSearch===\'function\')openGlobalSearch();">搜 寻</button>'
    +'<button class="gs-bc-btn" onclick="if(typeof openHelp===\'function\')openHelp();">帮 助</button>'
    +'</div>';
  gc.appendChild(_bc);

  // 标签栏（5 组分栏：政务/问答/纪录/臣子/文考）
  var tabBar=document.createElement("div");tabBar.className="gs-tab-bar";
  var _ti = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  var tabs=[
    {id:"gt-zhaozheng",label:"\u671D\u653F",icon:'office',group:'政务'},
    {id:"gt-edict",label:"\u8BCF\u4EE4",icon:'scroll',group:'政务'},
    {id:"gt-memorial",label:"\u594F\u758F",icon:'memorial',group:'政务'},
    {id:"gt-chaoyi",label:"\u671D\u8BAE",icon:'dialogue',group:'政务',action:'openChaoyi'},
    {id:"gt-wendui",label:"\u95EE\u5BF9",icon:'dialogue',group:'问答'},
    {id:"gt-letter",label:"\u9E3F\u96C1",icon:'scroll',group:'问答'},
    {id:"gt-biannian",label:"\u7F16\u5E74",icon:'chronicle',group:'纪录'},
    {id:"gt-qiju",label:"\u8D77\u5C45\u6CE8",icon:'qiju',group:'纪录'},
    {id:"gt-jishi",label:"\u7EAA\u4E8B",icon:'event',group:'纪录'},
    {id:"gt-shiji",label:"\u53F2\u8BB0",icon:'history',group:'纪录'},
    {id:"gt-office",label:"\u5B98\u5236",icon:'office',group:'臣子'},
    {id:"gt-renwu",label:"\u4EBA\u7269\u5FD7",icon:'person',group:'臣子'},
    {id:"gt-difang",label:"\u5730\u65B9",icon:'faction',group:'臣子'},
    {id:"gt-wenyuan",label:"\u6587\u82D1",icon:'scroll',group:'文考'},
    {id:"gt-keju",label:"\u79D1\u4E3E",icon:'scroll',group:'文考',action:'openKejuPanel'}
  ];
  // 按 group 分组
  var _curGroup=null, _curGroupEl=null, _tabIdx=0;
  tabs.forEach(function(t){
    if (t.group !== _curGroup){
      _curGroupEl=document.createElement('div');
      _curGroupEl.className='gs-tab-group';
      _curGroupEl.setAttribute('data-label', t.group || '');
      tabBar.appendChild(_curGroupEl);
      _curGroup=t.group;
    }
    var btn=document.createElement("button");
    btn.className='g-tab-btn gs-tab-btn'+(_tabIdx===0?" active":"");
    btn.innerHTML=_ti(t.icon,12)+' '+t.label;
    if (t.action) {
      btn.onclick=function(){ if(typeof window[t.action]==='function') window[t.action](); };
    } else {
      (function(_t,_b){
        _b.onclick=function(){
          switchGTab(_b,_t.id);
          if(_t.id==='gt-zhaozheng'){var zp=_$('gt-zhaozheng');if(zp)zp.innerHTML=_renderZhaozhengCenter();}
          var bc=_$('gs-bc-cur'); if(bc) bc.textContent=_t.label;
        };
      })(t,btn);
    }
    _curGroupEl.appendChild(btn);
    _tabIdx++;
  });
  gc.appendChild(tabBar);

  // 2.5: 朝政中心面板
  var zzP=document.createElement("div");zzP.className="g-tab-panel";zzP.id="gt-zhaozheng";zzP.style.cssText="flex:1;overflow-y:auto;padding:1rem;display:block;";
  zzP.innerHTML=_renderZhaozhengCenter();
  gc.appendChild(zzP);

  // 诏令面板
  var edictP=document.createElement("div");edictP.className="g-tab-panel";edictP.id="gt-edict";edictP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
  // 诏令区标题——根据玩家角色身份动态调整称谓
  var _edictRole='天子';
  var _sc2=findScenarioById&&findScenarioById(GM.sid);
  if(_sc2){
    var _r=_sc2.role||'';
    if(_r.indexOf('王')>=0||_r.indexOf('侯')>=0) _edictRole=_r;
    else if(_r) _edictRole=_r;
  }
  var _ei = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  // 诏令5类·含圆形字符徽章+宋体提示词
  var _edictCats = [
    {id:'edict-pol', label:'政 令', badge:'政', cls:'ed-c-pol', hint:'改革官制·任免官员·降旨安抚',  placeholder:'诏谕天下，如：改革官制、降旨安抚、任免官员……'},
    {id:'edict-mil', label:'军 令', badge:'军', cls:'ed-c-mil', hint:'调兵遣将·加强边防·讨伐叛贼',  placeholder:'调兵遣将，如：调动军队、加强边防、讨伐叛贼……'},
    {id:'edict-dip', label:'外 交', badge:'外', cls:'ed-c-dip', hint:'遣使和亲·结盟讨伐·册封藩属',  placeholder:'纵横捭阖，如：遣使和亲、结盟讨伐、册封藩属……'},
    {id:'edict-eco', label:'经 济', badge:'经', cls:'ed-c-eco', hint:'减税轻赋·开仓放粮·兴修水利',  placeholder:'经纶民生，如：减税轻赋、开仓放粮、兴修水利……'},
    {id:'edict-oth', label:'其 他', badge:'他', cls:'ed-c-oth', hint:'大赦·科举·建造·礼仪',          placeholder:'其他旨意，如：大赦天下、科举取士、建造宫殿……'}
  ];
  var edictHTML = '<div class="ed-panel-wrap" style="padding:var(--space-4) var(--space-5);">';

  // ═══ 左右并排布局 ═══
  edictHTML += '<div style="display:flex;gap:var(--space-5);align-items:flex-start;position:relative;z-index:1;">';

  // ── 左侧：建议库 ──
  edictHTML += '<div style="width:260px;flex-shrink:0;align-self:flex-start;position:sticky;top:20px;">';
  edictHTML += '<div class="ed-sug-title-wrap"><span class="ed-sug-title">\u8BAE \u4E8B \u6E05 \u518C</span></div>';
  edictHTML += '<div id="edict-sug-sidebar" style="display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow-y:auto;padding-right:4px;"></div>';
  edictHTML += '</div>';

  // ── 右侧：诏书编辑区 ──
  edictHTML += '<div style="flex:1;min-width:0;">';

  // 御笔标题 + 朱砂印章
  edictHTML += '<div class="ed-yubi-title">';
  edictHTML += '<div class="seal">'+escHtml(_edictRole)+'</div>';
  edictHTML += '<div class="main">' + escHtml(_edictRole) + ' \u5FA1 \u7B14</div>';
  edictHTML += '<div class="sub">\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u3000\u3000\u8BCF\u66F0</div>';
  edictHTML += '</div>';

  // 5 类诏令卡片
  edictHTML += '<div class="ed-cards">';
  _edictCats.forEach(function(cat) {
    edictHTML += '<div class="ed-card '+cat.cls+'">';
    edictHTML += '<div class="ed-card-hdr">';
    edictHTML += '<span class="ed-cat-icon">'+cat.badge+'</span>';
    edictHTML += '<span class="ed-cat-label">'+cat.label+'</span>';
    edictHTML += '<span class="ed-cat-hint">'+cat.hint+'</span>';
    edictHTML += '</div>';
    edictHTML += '<textarea id="'+cat.id+'" rows="2" class="edict-input paper-texture" placeholder="'+cat.placeholder+'" oninput="_edictLiveForecast(\''+cat.id+'\')"></textarea>';
    edictHTML += '<div id="'+cat.id+'-forecast" class="ed-forecast" style="display:none;"></div>';
    edictHTML += '</div>';
  });
  edictHTML += '</div>';

  // 建议库动态渲染
  _renderEdictSuggestions();

  // 润色控制行
  edictHTML += '<div class="ed-polish-bar">';
  edictHTML += '<span class="ed-polish-label">\u6587 \u98CE \u9009 \u62E9</span>';
  edictHTML += '<select id="edict-polish-style" style="font-size:12px;padding:6px 12px;background:var(--color-elevated);border:1px solid var(--color-border-subtle);color:var(--color-foreground);border-radius:2px;font-family:var(--font-serif);cursor:pointer;">';
  edictHTML += '<option value="elegant">\u5178\u96C5\u9A88\u6587</option>';
  edictHTML += '<option value="concise">\u7B80\u6D01\u660E\u5FEB</option>';
  edictHTML += '<option value="ornate">\u534E\u4E3D\u6587\u85FB</option>';
  edictHTML += '<option value="plain">\u767D\u8BDD\u6587\u8A00</option>';
  edictHTML += '</select>';
  edictHTML += '<button class="ed-polish-btn" onclick="_polishEdicts()">\u6709 \u53F8 \u6DA6 \u8272</button>';
  edictHTML += '</div>';

  // 润色结果区
  edictHTML += '<div id="edict-polished" style="display:none;margin-top:var(--space-3);"></div>';

  // 主角行止
  edictHTML += '<div class="ed-section-divider"><span class="label">\u4E3B \u89D2 \u884C \u6B62</span></div>';
  edictHTML += '<div class="ed-xinglu-card">';
  edictHTML += '<div class="ed-xinglu-hdr">';
  edictHTML += '<span class="title">\u672C \u56DE \u5408 \u884C \u52A8</span>';
  edictHTML += '<span class="desc">\u2014\u2014\u4F60\u8FD9\u6BB5\u65F6\u95F4\u505A\u4E86\u4EC0\u4E48</span>';
  edictHTML += '</div>';
  edictHTML += '<textarea id="xinglu-pub" rows="4" class="edict-input paper-texture" placeholder="\u5982\uFF1A\u53EC\u89C1\u67D0\u81E3\u3001\u6821\u9605\u4E09\u519B\u3001\u5FAE\u670D\u79C1\u8BBF\u3001\u591C\u8BFB\u53F2\u4E66\u3001\u7956\u5E99\u796D\u7940\u3001\u5BB4\u8BF7\u7FA4\u81E3\u2026\u2026"></textarea>';

  // 行止历史
  if (GM.qijuHistory && GM.qijuHistory.length > 1) {
    var _recentXl = GM.qijuHistory.filter(function(q) { return q.xinglu && q.turn < GM.turn; }).slice(-5).reverse();
    if (_recentXl.length > 0) {
      edictHTML += '<details class="ed-xinglu-hist">';
      edictHTML += '<summary>\u8FD1\u671F\u884C\u6B62\u8BB0\u5F55 <span style="color:var(--ink-300);margin-left:6px;font-size:10px;">' + _recentXl.length + ' \u6761</span></summary>';
      edictHTML += '<div style="margin-top:10px;max-height:200px;overflow-y:auto;">';
      _recentXl.forEach(function(q) {
        edictHTML += '<div class="ed-xinglu-hist-item"><span class="turn">T' + q.turn + '</span>' + escHtml(q.xinglu) + '</div>';
      });
      edictHTML += '</div></details>';
    }
  }
  edictHTML += '</div>'; // ed-xinglu-card

  // 帝王私行
  edictHTML += '<div class="ed-tyrant-block">';
  edictHTML += '<div class="ed-tyrant-toggle" onclick="var p=_$(\'tyrant-panel\');if(p){p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.classList.toggle(\'open\');if(p.style.display!==\'none\'&&typeof TyrantActivitySystem!==\'undefined\')TyrantActivitySystem.renderPanel();}">';
  edictHTML += '\u5E1D \u738B \u79C1 \u884C';
  edictHTML += '<span class="sub">\u2014\u2014 \u70B9\u51FB\u5C55\u5F00\uFF08\u540E\u5983\u00B7\u6E38\u730E\u00B7\u4E39\u836F\u00B7\u5BC6\u8BBF\uFF09</span>';
  edictHTML += '</div>';
  edictHTML += '<div id="tyrant-panel" style="display:none;max-height:300px;overflow-y:auto;padding:var(--space-2);margin-top:var(--space-2);"></div>';
  edictHTML += '</div>';
  // 往期诏令档案
  if (GM._edictTracker && GM._edictTracker.length > 0) {
    var _allEdicts = GM._edictTracker.filter(function(e) { return e.turn < GM.turn; });
    if (_allEdicts.length > 0) {
      // 按回合分组
      var _edictByTurn = {};
      _allEdicts.forEach(function(e) { if (!_edictByTurn[e.turn]) _edictByTurn[e.turn] = []; _edictByTurn[e.turn].push(e); });
      var _edictTurns = Object.keys(_edictByTurn).sort(function(a,b){ return b-a; });
      edictHTML += '<details class="ed-archive">';
      edictHTML += '<summary>\u5F80 \u671F \u8BCF \u4EE4 \u6863 \u6848 \u00B7 ' + _allEdicts.length + ' \u6761</summary>';
      edictHTML += '<div style="margin-top:var(--space-2);max-height:400px;overflow-y:auto;">';
      _edictTurns.forEach(function(turn) {
        var edicts = _edictByTurn[turn];
        var _tsText = typeof getTSText === 'function' ? getTSText(parseInt(turn)) : 'T' + turn;
        edictHTML += '<div class="ed-archive-group">';
        edictHTML += '<div class="ed-archive-group-title">\u7B2C' + turn + '\u56DE\u5408 \u00B7 ' + _tsText + '</div>';
        edicts.forEach(function(e) {
          var _sc = e.status === 'completed' ? 'var(--celadon-400)' : e.status === 'obstructed' ? 'var(--vermillion-400)' : e.status === 'partial' ? '#e67e22' : e.status === 'pending_delivery' ? 'var(--amber-400)' : 'var(--ink-300)';
          var _sl = {completed:'\u2705', obstructed:'\u274C', partial:'\u26A0\uFE0F', executing:'\u23F3', pending:'\u2B55', pending_delivery:'\uD83D\uDCE8'}[e.status] || '';
          edictHTML += '<div style="font-size:var(--text-xs);padding:2px 0;border-bottom:1px solid var(--color-border-subtle);">';
          edictHTML += '<span style="color:' + _sc + ';">' + _sl + '</span> ';
          edictHTML += '<span style="color:var(--color-foreground-muted);">' + escHtml(e.category) + '</span> ';
          edictHTML += escHtml(e.content);
          if (e.assignee) edictHTML += ' <span style="color:var(--ink-300);">[\u6267\u884C:' + escHtml(e.assignee) + ']</span>';
          // 远方送达状态
          if (e._remoteTargets && e._remoteTargets.length > 0) {
            var _ltStatuses = (e._letterIds||[]).map(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return null;
              var _name = lt.to || '';
              if (lt.status === 'traveling') return _name + ':信使在途';
              if (lt.status === 'delivered' || lt.status === 'replying') return _name + ':已送达';
              if (lt.status === 'returned') return _name + ':已送达且回函';
              if (lt.status === 'intercepted') return _name + ':⚠信使失踪';
              if (lt.status === 'recalled') return _name + ':已追回';
              return _name + ':' + (lt.status||'?');
            }).filter(Boolean);
            if (_ltStatuses.length > 0) {
              edictHTML += '<div style="font-size:0.6rem;color:var(--amber-400);padding-left:1rem;">传书：' + _ltStatuses.join(' | ') + '</div>';
            }
          }
          if (e.feedback) edictHTML += '<div style="color:var(--color-foreground-secondary);padding-left:1rem;">' + escHtml(e.feedback) + '</div>';
          edictHTML += '</div>';
        });
        edictHTML += '</div>';
      });
      edictHTML += '</div></details>';
    }
  }

  // 结束回合按钮
  edictHTML += '<div class="ed-action-bar">';
  edictHTML += '<button class="bt bp" id="btn-end" onclick="confirmEndTurn()" style="padding:var(--space-3) var(--space-8);font-size:var(--text-md);letter-spacing:0.15em;border:2px solid var(--gold-400);box-shadow:0 2px 12px rgba(184,154,83,0.2);">'+_ei('end-turn',16)+' 诏付有司</button>';
  edictHTML += '<button class="bt" title="地形图·山川城池分布（决策辅助）·与【军事·地图总览】数据源不同" onclick="TM.MapSystem.open(\'terrain\')" style="padding:var(--space-3) var(--space-6);font-size:var(--text-md);">'+_ei('map',16)+' 查看地图</button>';
  edictHTML += '</div>';
  edictHTML += '</div>'; // 关闭右侧诏书编辑区
  edictHTML += '</div>'; // 关闭左右并排 flex 容器
  edictHTML += '</div>'; // 关闭 ed-panel-wrap
  edictP.innerHTML = edictHTML;
  gc.appendChild(edictP);

  // 奏疏面板
  var memP=document.createElement("div");memP.className="g-tab-panel";memP.id="gt-memorial";memP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  memP.innerHTML='<div class="mem-panel-wrap"><div class="mem-inner">'
    +'<div class="mem-title"><div class="seal">\u5949<br>\u6731</div><div class="main">\u594F \u758F \u5F85 \u89C8</div><div class="sub">\u6848\u724D\u4E4B\u53F8\u3000\u3000\u767E\u5B98\u542F\u594F</div></div>'
    +'<div id="zouyi-list"></div>'
    +'</div></div>';
  gc.appendChild(memP);

  // 问对面板（仅角色选择网格，点击打开弹窗）
  var wdP=document.createElement("div");wdP.className="g-tab-panel";wdP.id="gt-wendui";wdP.style.cssText="flex:1;overflow-y:auto;padding:0;display:flex;flex-direction:column;";
  wdP.innerHTML='<div class="wdp-panel-wrap"><div class="wdp-inner">'
    +'<div class="wdp-title"><div class="seal">\u53EC\u89C1</div><div class="main">\u5FA1 \u524D \u95EE \u5BF9</div><div class="sub">\u541B\u81E3\u4E4B\u5BF9\u3000\u3000\u9762\u5723\u8BF7\u5BF9</div></div>'
    +'<div id="wendui-chars"></div>'
    +'</div></div>';
  gc.appendChild(wdP);

  // 鸿雁传书面板
  var ltP=document.createElement("div");ltP.className="g-tab-panel";ltP.id="gt-letter";ltP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  ltP.innerHTML='<div class="hy-panel-wrap"><div class="hy-inner">'
    +'<div class="hy-title"><div class="seal">\u9C7C<br>\u96C1</div><div class="main">\u9E3F \u96C1 \u4F20 \u4E66</div><div class="sub">\u7B3A\u672D\u5F80\u6765\u3000\u3000\u9A7F\u4F7F\u4F20\u9012</div></div>'
    +'<div id="letter-route-bar" class="hy-route-warn" style="display:none;"></div>'
    +'<div class="hy-main">'
    +  '<div class="hy-left">'
    +    '<div class="hy-left-header"><span class="hy-left-title">\u8FDC \u65B9 \u81E3 \u5B50</span>'
    +      '<button class="hy-multi-btn" id="lt-multi-toggle" onclick="GM._ltMultiMode=!GM._ltMultiMode;GM._ltMultiTargets=[];renderLetterPanel();">\u7FA4 \u53D1</button>'
    +    '</div>'
    +    '<div id="letter-chars" class="hy-npc-list"></div>'
    +  '</div>'
    +  '<div class="hy-center">'
    +    '<div id="letter-history"></div>'
    +    '<div class="hy-compose-area">'
    +      '<div class="hy-compose-title">\u4E66 \u672D \u62DF \u7A3F<span class="target" id="lt-compose-target">\uFF08\u9009\u62E9\u53D7\u4FE1\u4EBA\uFF09</span></div>'
    +      '<div class="hy-compose-row">'
    +        '<select id="letter-type"><option value="secret_decree">\u5BC6\u65E8</option><option value="military_order">\u5F81\u8C03\u4EE4</option><option value="greeting">\u95EE\u5B89\u51FD</option><option value="personal" selected>\u79C1\u51FD</option><option value="proclamation">\u6A84\u6587</option></select>'
    +        '<select id="letter-urgency"><option value="normal">\u666E\u901A\u9A7F\u9012\uFF08\u65E5\u884C\u4E94\u5341\u91CC\uFF09</option><option value="urgent">\u52A0\u6025\u9A7F\u9012\uFF08\u65E5\u884C\u4E09\u767E\u91CC\uFF09</option><option value="extreme">\u516B\u767E\u91CC\u52A0\u6025</option></select>'
    +      '</div>'
    +      '<div class="hy-compose-row">'
    +        '<select id="letter-cipher"><option value="none">\u4E0D\u52A0\u5BC6</option><option value="yinfu">\u9634\u7B26\uFF08\u6697\u53F7\u4F53\u7CFB\uFF09</option><option value="yinshu">\u9634\u4E66\uFF08\u62C6\u5206\u4E09\u8DEF\uFF09</option><option value="wax_ball">\u8721\u4E38\u5BC6\u51FD</option><option value="silk_sewn">\u5E1B\u4E66\u7F1D\u8863</option></select>'
    +        '<select id="letter-sendmode"><option value="normal">\u666E\u901A\u4FE1\u4F7F</option><option value="multi_courier">\u591A\u8DEF\u4FE1\u4F7F\uFF08\u622A\u83B7\u7387\u964D\u4F4E\uFF09</option><option value="secret_agent">\u5BC6\u4F7F\uFF08\u4E0D\u8D70\u9A7F\u7AD9\uFF09</option></select>'
    +      '</div>'
    +      '<div class="hy-compose-row" id="lt-agent-row" style="display:none;"><label style="font-size:12px;color:var(--color-foreground-muted);align-self:center;">\u5BC6\u4F7F\u4EBA\u9009\uFF1A</label><select id="letter-agent"></select></div>'
    +      '<textarea id="letter-textarea" class="hy-compose-paper" placeholder="\u81F4\u4E66\u8FDC\u65B9\u81E3\u5B50\u2026\u2026" rows="4"></textarea>'
    +      '<div class="hy-compose-bot">'
    +        '<span class="hy-compose-hint">\u203B \u52A0\u5BC6/\u5BC6\u4F7F\u964D\u4F4E\u622A\u83B7\u7387\uFF1B\u516B\u767E\u91CC\u52A0\u6025\u8017\u8D39\u66F4\u591A\u90AE\u8D39</span>'
    +        '<button class="hy-send-btn" onclick="sendLetter()">\u9063 \u4F7F</button>'
    +      '</div>'
    +    '</div>'
    +  '</div>'
    +'</div>'
    +'</div></div>';
  gc.appendChild(ltP);
  // 密使选择器联动
  var _smSel = ltP.querySelector('#letter-sendmode');
  if (_smSel) _smSel.onchange = function() {
    var agRow = _$('lt-agent-row');
    if (this.value === 'secret_agent') {
      if (agRow) agRow.style.display = 'flex';
      var agSel = _$('letter-agent');
      if (agSel) {
        var _cap2 = GM._capital || '京城';
        var _inKy = (GM.chars||[]).filter(function(c){ return c.alive !== false && c.location === _cap2 && !c.isPlayer; });
        agSel.innerHTML = _inKy.map(function(c){ return '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + '（' + escHtml(c.title||'') + '）</option>'; }).join('');
      }
    } else { if (agRow) agRow.style.display = 'none'; }
  };

  // 编年面板
  var bnP=document.createElement("div");bnP.className="g-tab-panel";bnP.id="gt-biannian";bnP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  bnP.innerHTML='<div class="bn-panel-wrap"><div class="bn-inner">'
    +'<div class="bn-title"><div class="seal">\u7F16<br>\u5E74</div><div class="main">\u7F16 \u5E74 \u7EAA \u4E8B</div><div class="sub">\u5929\u3000\u5B50\u3000\u7EAA\u3000\u5E74\u3000\u3000\u3000\u8BF8\u4E8B\u7ECF\u5E74\u7D2F\u8F7D</div></div>'
    +'<div id="bn-active"></div>'
    +'<div class="bn-section-hdr" style="margin-top:16px;"><span class="tag">\u7F16 \u5E74 \u68C0 \u7D22</span><span class="desc">\u2014\u2014 \u6309\u5E74\u4EFD\u00B7\u7C7B\u522B\u00B7\u5173\u952E\u5B57\u8FFD\u6EAF\u5F80\u8FF9</span></div>'
    +'<div class="bn-tools">'
    +'<span class="bn-tools-label">\u67E5\u3000\u9605\uFF1A</span>'
    +'<div class="bn-search-wrap"><input id="bn-search" class="bn-search" placeholder="\u9898\u76EE\u3001\u4EBA\u540D\u3001\u5730\u70B9\u3001\u5173\u952E\u5B57\u2026\u2026" oninput="renderBiannian()"></div>'
    +'<select id="bn-filter" class="bn-filter" onchange="renderBiannian()">'
    +'<option value="all">\u5168\u90E8\u7C7B\u522B</option><option value="\u519B\u4E8B">\u519B\u4E8B</option><option value="\u653F\u6CBB">\u653F\u4E8B</option><option value="\u7ECF\u6D4E">\u7ECF\u6D4E</option><option value="\u5916\u4EA4">\u5916\u4EA4</option><option value="\u6587\u5316">\u6587\u5316</option><option value="\u4EBA\u4E8B">\u4EBA\u4E8B</option><option value="\u707E\u5F02">\u5929\u8C61\u707E\u5F02</option></select>'
    +'<button class="bn-export-btn" onclick="_bnExport()" title="\u5BFC\u51FA\u5168\u90E8\u7F16\u5E74">\u2756 \u5BFC \u51FA</button>'
    +'<span class="bn-tools-stat" id="bn-tools-stat"></span>'
    +'</div>'
    +'<div class="bn-section-hdr"><span class="tag">\u7F16 \u5E74 \u53F2 \u518C</span><span class="desc">\u2014\u2014 \u65E2\u5F80\u4E4B\u4E8B\u00B7\u6C38\u4E45\u5B58\u5F55</span></div>'
    +'<div class="bn-chronicle-wrap"><div id="biannian-list"></div></div>'
    +'</div></div>';
  gc.appendChild(bnP);

  // 官制面板
  var offP=document.createElement("div");offP.className="g-tab-panel";offP.id="gt-office";offP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  offP.innerHTML='<div class="og-panel-wrap"><div class="og-inner">'
    +'<div class="og-title"><div class="seal">\u5B98<br>\u5236</div><div class="main">\u516D \u90E8 \u537F \u5BFA</div><div class="sub">\u8862\u3000\u95E8\u3000\u804C\u3000\u5B98\u3000\u3000\u3000\u3000\u73ED\u3000\u4F4D\u3000\u5404\u3000\u53F8\u3000\u5176\u3000\u804C</div></div>'

    // 总览区
    +'<div class="og-section-hdr">'
    +'<span class="tag">\u8862 \u95E8 \u603B \u89C8</span>'
    +'<span class="desc">\u2014\u2014 \u7F16\u5236\u00B7\u6743\u529B\u683C\u5C40\u00B7\u4FF8\u7984\u5F00\u652F</span>'
    +'<span class="act">'
    +'<button class="og-hdr-btn" onclick="_offReformToEdict(\'add_dept\',\'\')">\u589E \u8BBE \u90E8 \u95E8</button>'
    +'<button class="og-hdr-btn primary" onclick="if(typeof _offOpenZhongtui===\'function\')_offOpenZhongtui();else toast(\'\u8350\u8D24\u5EF7\u63A8\u9700\u5148\u9009\u4E2D\u804C\u4F4D\')">\u8350 \u8D24 \u5EF7 \u63A8</button>'
    +'</span>'
    +'</div>'

    // 预警 + 摘要
    +'<div id="office-alerts" class="og-alerts"></div>'
    +'<div id="office-summary" class="og-summary-grid"></div>'

    // 树
    +'<div class="og-section-hdr">'
    +'<span class="tag">\u8862 \u95E8 \u5C42 \u7EA7</span>'
    +'<span class="desc">\u2014\u2014 \u9F20\u8F6E\u7F29\u653E\u00B7\u62D6\u62FD\u5E73\u79FB\u00B7\u70B9\u51FB\u5361\u7247\u5C55\u5F00\u8BE6\u60C5</span>'
    +'</div>'
    +'<div class="og-tree-topbar">'
    +'<span class="title-bar">\u56FE \u4F8B</span>'
    +'<span style="font-size:11px;color:var(--ink-300);letter-spacing:0.05em;display:inline-flex;align-items:center;gap:8px;">'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:#e4c579;border-radius:1px;"></span>\u6B63\u4E00\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--gold-400);border-radius:1px;"></span>\u4E8C\u4E09\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--celadon-400);border-radius:1px;"></span>\u56DB\u4E94\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--ink-500);border-radius:1px;"></span>\u516D\u54C1\u4EE5\u4E0B</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--amber-400);"></span>\u4E45\u4EFB</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--vermillion-400);"></span>\u4E0D\u6EE1\u00B7\u7F3A\u5458</span>'
    +'</span>'
    +'</div>'
    +'<div id="office-tree"></div>'
    +'</div></div>';
  gc.appendChild(offP);

  // 文苑面板（文事作品库）
  var wyP=document.createElement("div");wyP.className="g-tab-panel";wyP.id="gt-wenyuan";wyP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  wyP.innerHTML='<div class="wy-panel-wrap"><div class="wy-inner">'
    +'<div class="wy-title"><div class="seal">\u6587<br>\u82D1</div><div class="main">\u6587 \u82D1 \u00B7 \u8BD7 \u6587 \u603B \u96C6</div><div class="sub">\u8BD7 \u8BCD \u6B4C \u8D4B\u3000\u3000\u5E8F \u8DCB \u8BB0 \u94ED\u3000\u3000\u7ECF \u4E16 \u98CE \u96C5</div></div>'
    +'<div id="wy-statbar" class="wy-statbar"></div>'
    +'<div class="wy-tools">'
    +'<span class="wy-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="wy-search-wrap"><input id="wy-search" class="wy-search" placeholder="\u641C\u7D22\u4F5C\u8005\u00B7\u6807\u9898\u00B7\u8BD7\u6587\u2026" oninput="renderWenyuan()"></div>'
    +'<select id="wy-cat-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">\u5168\u90E8\u89E6\u53D1</option><option value="career">\u79D1\u4E3E\u5B98\u9014</option><option value="adversity">\u9006\u5883\u8D2C\u8C2A</option><option value="social">\u793E\u4EA4\u916C\u9154</option><option value="duty">\u4EFB\u4E0A\u65BD\u653F</option><option value="travel">\u6E38\u5386\u5C71\u6C34</option><option value="private">\u5BB6\u4E8B\u79C1\u60C5</option><option value="times">\u65F6\u5C40\u5929\u4E0B</option><option value="mood">\u60C5\u611F\u5FC3\u5883</option></select>'
    +'<select id="wy-genre-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">\u5168\u90E8\u6587\u4F53</option><option value="shi">\u8BD7</option><option value="ci">\u8BCD</option><option value="fu">\u8D4B</option><option value="qu">\u66F2</option><option value="ge">\u6B4C\u884C</option><option value="wen">\u6563\u6587</option><option value="apply">\u5E94\u7528\u6587</option><option value="ji">\u8BB0\u53D9\u6587</option><option value="ritual">\u796D\u6587\u7891\u94ED</option><option value="paratext">\u5E8F\u8DCB</option></select>'
    +'<select id="wy-sort" class="wy-filter" onchange="renderWenyuan()"><option value="recent">\u6392\uFF1A\u8FD1\u4F5C</option><option value="quality">\u6392\uFF1A\u54C1\u8BC4</option><option value="author">\u6392\uFF1A\u4F5C\u8005</option><option value="date">\u6392\uFF1A\u5E74\u4EE3</option></select>'
    +'<label class="wy-chk"><input type="checkbox" id="wy-preserved-only" onchange="renderWenyuan()">\u4EC5\u4F20\u4E16</label>'
    +'<label class="wy-chk"><input type="checkbox" id="wy-hide-forbidden" onchange="renderWenyuan()">\u9690\u67E5\u7981</label>'
    +'</div>'
    +'<div id="wy-legend" class="wy-legend"></div>'
    +'<div id="wenyuan-list" class="wy-grid"></div>'
    +'</div></div>';
  gc.appendChild(wyP);

  // 起居注面板
  var qjP=document.createElement("div");qjP.className="g-tab-panel";qjP.id="gt-qiju";qjP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  qjP.innerHTML='<div class="qj-panel-wrap"><div class="qj-inner">'
    +'<div class="qj-title"><div class="seal">\u8D77<br>\u5C45<br>\u6CE8</div><div class="main">\u8D77\u3000\u5C45\u3000\u6CE8</div><div class="sub">\u4E00 \u65E5 \u4E00 \u5F55\u3000\u3000\u8D77 \u5C45 \u996E \u98DF \u8A00 \u52A8 \u5FC5 \u4E66\u3000\u3000\u85CF \u4E4B \u91D1 \u532E \u77F3 \u5BA4</div></div>'
    +'<div id="qj-statbar" class="qj-statbar"></div>'
    +'<div class="qj-tools">'
    +'<span class="qj-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="qj-search-wrap"><input id="qj-search" class="qj-search" placeholder="\u641C\u7D22\u8D77\u5C45\u6CE8\u00B7\u65E5\u671F\u00B7\u4EBA\u540D\u2026" oninput="_qijuKw=this.value;_qijuPage=0;renderQiju()"></div>'
    +'<select id="qj-cat-filter" class="qj-filter" onchange="_qijuCat=this.value;_qijuPage=0;renderQiju()">'
    +'<option value="all">\u5168\u90E8\u7C7B\u522B</option><option value="\u8BCF\u4EE4">\u8BCF\u4EE4</option><option value="\u594F\u758F">\u594F\u758F</option><option value="\u671D\u8BAE">\u671D\u8BAE</option><option value="\u9E3F\u96C1">\u9E3F\u96C1</option><option value="\u4EBA\u4E8B">\u4EBA\u4E8B</option><option value="\u884C\u6B62">\u884C\u6B62</option><option value="\u53D9\u4E8B">\u53D9\u4E8B</option></select>'
    +'<select id="qj-sort" class="qj-filter" onchange="_qijuSort=this.value;_qijuPage=0;renderQiju()"><option value="recent">\u6392\uFF1A\u8FD1\u65E5 \u2193</option><option value="old">\u6392\uFF1A\u65E7\u65E5 \u2191</option><option value="annot">\u6392\uFF1A\u5FA1\u6279\u5148</option></select>'
    +'<label class="qj-chk"><input type="checkbox" id="qj-annot-only" onchange="_qijuAnnotOnly=this.checked;_qijuPage=0;renderQiju()">\u4EC5\u5FA1\u6279</label>'
    +'<label class="qj-chk"><input type="checkbox" id="qj-collapse-narr" onchange="_qijuCollapseNarr=this.checked;renderQiju()">\u6298\u53E0\u53D9\u4E8B</label>'
    +'<button class="qj-export" onclick="_qijuExport()">\u5BFC \u51FA \u7F16 \u5E74</button>'
    +'</div>'
    +'<div id="qj-legend" class="qj-legend"></div>'
    +'<div id="qiju-history"></div>'
    +'</div></div>';
  gc.appendChild(qjP);

  // 纪事面板
  var jsP=document.createElement("div");jsP.className="g-tab-panel";jsP.id="gt-jishi";jsP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  jsP.innerHTML='<div class="ji-panel-wrap"><div class="ji-inner">'
    +'<div class="ji-title"><div class="seal">\u7EAA<br>\u4E8B</div><div class="main">\u7EAA \u4E8B \u672C \u672B</div><div class="sub">\u4EE5 \u4E8B \u7CFB \u65E5\u3000\u3000\u4EE5 \u65E5 \u7CFB \u6708\u3000\u3000\u4EE5 \u6708 \u7CFB \u65F6\u3000\u3000\u4EE5 \u65F6 \u7CFB \u5E74</div></div>'
    +'<div id="jishi-statbar" class="ji-statbar"></div>'
    +'<div class="ji-tools">'
    +'<span class="ji-tools-lbl">\u62AB\u3000\u89C8</span>'
    +'<div class="ji-view-switch">'
    +'<button class="ji-view-btn active" id="js-view-time" onclick="_jishiView=\'time\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u65F6 \u95F4 \u7EBF</button>'
    +'<button class="ji-view-btn" id="js-view-char" onclick="_jishiView=\'char\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u6309 \u4EBA \u7269</button>'
    +'<button class="ji-view-btn" id="js-view-type" onclick="_jishiView=\'type\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u6309 \u4E8B \u7C7B</button>'
    +'</div>'
    +'<div class="ji-search-wrap"><input id="jishi-kw" class="ji-search" placeholder="\u641C\u7D22\u8BAE\u9898\u00B7\u4EBA\u7269\u00B7\u5BF9\u8BDD\u2026\u2026" oninput="_jishiKw=this.value;_jishiPage=0;renderJishi();"></div>'
    +'<select id="jishi-char-filter" class="ji-filter" onchange="_jishiCharFilter=this.value;_jishiPage=0;renderJishi();"><option value="all">\u5168\u90E8\u4EBA\u7269</option></select>'
    +'<button class="ji-star-btn" onclick="_jishiToggleStarred()" id="js-star-toggle" title="\u4EC5\u770B\u661F\u6807">\u2606</button>'
    +'<button class="ji-export-btn" onclick="_jishiExport()" title="\u5BFC\u51FA\u7EB5\u7EAA\u5B8C\u6574\u8BB0\u5F55">\u5BFC \u51FA</button>'
    +'</div>'
    +'<div id="jishi-legend" class="ji-legend"></div>'
    +'<div id="jishi-list"></div>'
    +'</div></div>';
  gc.appendChild(jsP);

  // 史记面板
  var sjP=document.createElement("div");sjP.className="g-tab-panel";sjP.id="gt-shiji";sjP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  sjP.innerHTML='<div class="sj-panel-wrap"><div class="sj-inner">'
    +'<div class="sj-title"><div class="seal">\u53F2<br>\u8BB0</div><div class="main">\u53F2 \u8BB0 \u672C \u7EAA</div><div class="sub">\u7A76 \u5929 \u4EBA \u4E4B \u9645\u3000\u901A \u53E4 \u4ECA \u4E4B \u53D8\u3000\u6210 \u4E00 \u5BB6 \u4E4B \u8A00</div></div>'
    +'<div id="shiji-list"></div>'
    +'</div></div>';
  gc.appendChild(sjP);

  // 科技树面板（条件显示）
  if(P.systems && P.systems.techTree!==false){
    var _techBtn=document.createElement("button");_techBtn.className="g-tab-btn";_techBtn.innerHTML=_ti('scroll',13)+' \u79D1\u6280';
    _techBtn.onclick=function(){switchGTab(_techBtn,"gt-tech");};tabBar.appendChild(_techBtn);
    var _techP=document.createElement("div");_techP.className="g-tab-panel";_techP.id="gt-tech";_techP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
    _techP.innerHTML='<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u79D1\u6280</div><div id="g-tech"></div>';
    gc.appendChild(_techP);
  }
  // 市政树面板（条件显示）
  if(P.systems && P.systems.civicTree!==false){
    var _civicBtn=document.createElement("button");_civicBtn.className="g-tab-btn";_civicBtn.innerHTML=_ti('office',13)+' \u5E02\u653F';
    _civicBtn.onclick=function(){switchGTab(_civicBtn,"gt-civic");};tabBar.appendChild(_civicBtn);
    var _civicP=document.createElement("div");_civicP.className="g-tab-panel";_civicP.id="gt-civic";_civicP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
    _civicP.innerHTML='<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u5E02\u653F</div><div id="g-civic"></div>';
    gc.appendChild(_civicP);
  }
  // 人物志面板
  var _rwBtn=document.createElement("button");_rwBtn.className="g-tab-btn";_rwBtn.innerHTML=_ti('person',13)+' \u4EBA\u7269\u5FD7';
  _rwBtn.onclick=function(){switchGTab(_rwBtn,"gt-renwu");};tabBar.appendChild(_rwBtn);
  var _rwP=document.createElement("div");_rwP.className="g-tab-panel";_rwP.id="gt-renwu";_rwP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  _rwP.innerHTML='<div class="rw-panel-wrap"><div class="rw-inner">'
    +'<div class="rw-title"><div class="seal">\u4EBA<br>\u7269</div><div class="main">\u4EBA \u7269 \u5FD7</div><div class="sub">\u82F1 \u6770 \u5217 \u4F20\u3000\u3000\u81E7 \u5426 \u54C1 \u8BC4</div></div>'
    +'<div id="rw-statbar" class="rw-statbar"></div>'
    +'<div class="rw-tools">'
    +'<span class="rw-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="rw-search-wrap"><input id="rw-search" class="rw-search" placeholder="\u641C\u7D22\u59D3\u540D\u00B7\u5B57\u53F7\u00B7\u5B98\u804C\u2026" oninput="_rwSearch=this.value;renderRenwu();"></div>'
    +'<select id="rw-faction" class="rw-filter" onchange="_rwFaction=this.value;renderRenwu();"><option value="all">\u5168\u90E8\u6D3E\u7CFB</option></select>'
    +'<select id="rw-role" class="rw-filter" onchange="_rwRole=this.value;renderRenwu();"><option value="all">\u5168\u90E8\u8EAB\u4EFD</option><option value="civil">\u6587\u81E3</option><option value="military">\u6B66\u5C06</option><option value="harem">\u540E\u5BAB</option><option value="none">\u5E03\u8863</option></select>'
    +'<select id="rw-sort" class="rw-filter" onchange="_rwSort=this.value;renderRenwu();"><option value="loyalty">\u6392\uFF1A\u5FE0\u8BDA</option><option value="intelligence">\u6392\uFF1A\u667A\u529B</option><option value="administration">\u6392\uFF1A\u653F\u52A1</option><option value="military">\u6392\uFF1A\u519B\u4E8B</option><option value="ambition">\u6392\uFF1A\u91CE\u5FC3</option></select>'
    +'<label class="rw-chk"><input type="checkbox" id="rw-dead" onchange="_rwShowDead=this.checked;renderRenwu();">\u663E \u5DF2 \u6B81</label>'
    +'</div>'
    +'<div id="rw-legend" class="rw-legend"></div>'
    +'<div id="rw-grid" class="rw-grid"></div>'
    +'</div></div>';
  gc.appendChild(_rwP);

  // P3: 省份民情面板（地方舆情）
  if (P.adminHierarchy) {
    var _dfBtn=document.createElement("button");_dfBtn.className="g-tab-btn";_dfBtn.innerHTML=_ti('faction',13)+' \u5730\u65B9';
    _dfBtn.onclick=function(){switchGTab(_dfBtn,"gt-difang");_renderDifangPanel();};tabBar.appendChild(_dfBtn);
    var _dfP=document.createElement("div");_dfP.className="g-tab-panel";_dfP.id="gt-difang";_dfP.style.cssText="flex:1;overflow-y:auto;padding:0;";
    _dfP.innerHTML='<div class="df-panel-wrap"><div class="df-inner">'
      +'<div class="df-title"><div class="seal">\u5730<br>\u65B9</div><div class="main">\u5730 \u65B9 \u8206 \u60C5</div><div class="sub">\u4E00 \u7701 \u4E00 \u6C11 \u60C5\u3000\u3000\u6309 \u5BDF \u629A \u6C11 \u00B7 \u5B89 \u6C11 \u4E3A \u672C</div></div>'
      +'<div id="df-statbar" class="df-statbar"></div>'
      +'<div class="df-tools">'
      +'<span class="df-tools-lbl">\u6309 \u5BDF</span>'
      +'<div class="df-search-wrap"><input id="df-search" class="df-search" placeholder="\u641C\u7D22\u5730\u540D\u00B7\u5B98\u540D\u00B7\u4E8B\u7531\u2026\u2026" oninput="_dfSearch=this.value;_renderDifangPanel();"></div>'
      +'<select id="df-sort" class="df-filter" onchange="_dfSort=this.value;_renderDifangPanel();"><option value="name">\u6392\uFF1A\u540D\u79F0</option><option value="unrest">\u6392\uFF1A\u6C11\u53D8 \u2191</option><option value="corruption">\u6392\uFF1A\u8150\u8D25 \u2191</option><option value="population">\u6392\uFF1A\u4EBA\u53E3 \u2193</option><option value="tax">\u6392\uFF1A\u7A0E\u6536 \u2193</option></select>'
      +'<label class="df-chk"><input type="checkbox" id="df-crisis" onchange="_dfCrisis=this.checked;_renderDifangPanel();">\u26A0 \u4EC5 \u5371 \u673A</label>'
      +'<button class="df-export" onclick="if(typeof openProvinceEconomy===\'function\')openProvinceEconomy();">\u8BE6 \u7EC6 \u533A \u5212</button>'
      +'</div>'
      +'<div id="df-legend" class="df-legend"></div>'
      +'<div id="df-alerts" class="df-alerts" style="display:none;"></div>'
      +'<div id="difang-grid" class="df-grid"></div>'
      +'</div></div>';
    gc.appendChild(_dfP);
  }

  // 右侧面板——增强角色卡片
  var gr=_$("gr");if(gr){
    var _charList = (GM.chars || []).filter(function(c){return c.alive!==false;});
    // 7.3: 角色列表分页——超过30人时先显示前30，可展开全部
    var _charPageLimit = 30;
    var _charShowAll = gr._showAllChars || false;
    var _charDisplayList = (!_charShowAll && _charList.length > _charPageLimit) ? _charList.slice(0, _charPageLimit) : _charList;
    gr.innerHTML="<div class=\"pt\" style=\"display:flex;align-items:center;gap:4px;\">"+tmIcon('person',12)+" \u4EBA\u7269 <span style=\"font-size:var(--text-xs);color:var(--color-foreground-muted);font-weight:400;margin-left:auto;\">"+_charList.length+"\u4EBA</span></div>"+
      _charDisplayList.map(function(ch){
        var loy=ch.loyalty||50;
        var loyColor=loy>70?"var(--green)":loy<30?"var(--red)":"var(--gold)";
        var loyDisp = (typeof _fmtNum1==='function') ? _fmtNum1(loy) : loy;
        var stressTag='';
        if(ch.stress&&ch.stress>40){
          stressTag=' <span style="font-size:0.62rem;padding:1px 4px;border-radius:3px;background:'+(ch.stress>60?'rgba(192,57,43,0.2)':'rgba(230,126,34,0.15)')+';color:'+(ch.stress>60?'var(--red)':'#e67e22')+';">'+(ch.stress>60?'\u5D29':'\u7126')+'</span>';
        }
        // 心情标记（中国古典方括号）
        var moodIcon='';
        if(ch._mood&&ch._mood!=='\u5E73'){
          var _moodColors={'\u559C':'var(--color-success)','\u6012':'var(--vermillion-400)','\u5FE7':'#e67e22','\u60E7':'var(--indigo-400)','\u6068':'var(--vermillion-400)','\u656C':'var(--celadon-400)'};
          moodIcon='<span style="font-size:0.6rem;color:'+(_moodColors[ch._mood]||'var(--txt-d)')+';">\u3014'+ch._mood+'\u3015</span> ';
        }
        // 野心标记
        var ambTag=(ch.ambition||50)>75?'<span style="font-size:0.58rem;color:var(--purple,#9b59b6);">\u91CE</span>':'';
        // 后宫/配偶标记
        var spouseTag='';
        if(ch.spouse){
          var _spIc = typeof getHaremRankIcon === 'function' ? getHaremRankIcon(ch.spouseRank) : '\u{1F490}';
          spouseTag=' <span style="font-size:0.62rem;color:#e84393;">'+_spIc+'</span>';
        }
        var factionTag=ch.faction?'<span style="font-size:0.62rem;color:var(--txt-d);">'+ch.faction+'</span>':'';
        // 立场/党派/学识标签
        var stancePartyTag='';
        if(ch.stance&&ch.stance!=='中立') stancePartyTag+='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';color:'+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';margin-right:2px;">'+ch.stance+'</span>';
        if(ch.party) stancePartyTag+='<span style="font-size:0.55rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;margin-right:2px;">'+escHtml(ch.party)+'</span>';
        var officeLine=ch.title?'<span style="font-size:0.7rem;color:var(--txt-d);">'+ch.title+'</span>':'';
        var ageTag=ch.age?'<span style="font-size:0.62rem;color:var(--txt-d);">'+ch.age+'\u5C81</span>':'';
        var _cap=GM._capital||'京城';
        var locTag='';
        if(ch._travelTo){
          var _rd5=(typeof ch._travelRemainingDays==='number'&&ch._travelRemainingDays>0)?ch._travelRemainingDays:0;
          locTag='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.18);color:var(--gold-400);margin-left:2px;" title="\u5728\u9014">'+escHtml(ch._travelFrom||ch.location||'')+'\u2192'+escHtml(ch._travelTo)+(_rd5?'\u00B7'+_rd5+'\u65E5':'')+'</span>';
        } else if(ch.location&&ch.location!==_cap) locTag='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.1);color:var(--gold-400);margin-left:2px;">'+ch.location+'</span>';
        // 性格特质缩写
        var traitBrief='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitBrief=ch.traitIds.slice(0,2).map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;});return d?d.name:'';}).filter(Boolean).join('\u00B7');
          if(traitBrief) traitBrief='<span style="font-size:0.58rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;">'+traitBrief+'</span>';
        }
        // 目标+满足度
        var goalBrief='';
        if(ch.personalGoal) {
          var _gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : '';
          var _gsatColor = _gsat >= 60 ? 'var(--celadon-400)' : _gsat >= 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
          goalBrief='<div style="font-size:0.6rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">\u5FD7\uFF1A'+escHtml(ch.personalGoal);
          if(_gsat !== '') goalBrief += ' <span style="color:'+_gsatColor+';">'+_gsat+'%</span>';
          goalBrief += '</div>';
        }
        // 恩怨摘要（简短）
        var eyBrief='';
        if(typeof EnYuanSystem!=='undefined'){var _eyt2=EnYuanSystem.getTextForChar(ch.name);if(_eyt2)eyBrief='<div style="font-size:0.55rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">'+_eyt2+'</div>';}
        // 五常/气质/面子（新增增强）
        var wcLine='';
        if(typeof calculateWuchang==='function'){
          var _wc=calculateWuchang(ch);
          wcLine='<div style="font-size:0.6rem;color:var(--celadon-400);margin-top:0.15rem;letter-spacing:0.03em;">仁'+_wc.仁+' 义'+_wc.义+' 礼'+_wc.礼+' 智'+_wc.智+' 信'+_wc.信+' <span style="color:var(--gold-400);">'+_wc.气质+'</span></div>';
        }
        var faceLine='';
        if(typeof FaceSystem!=='undefined'&&ch._face!==undefined){
          var _fv=FaceSystem.getFace(ch);
          var _fc=_fv>=60?'var(--color-foreground-muted)':_fv>=40?'#e67e22':'var(--vermillion-400)';
          faceLine=_fv<60?' <span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+_fc+';color:'+_fc+';">'+(_fv<20?'奇耻':_fv<40?'颜面尽失':'面子低落')+'</span>':'';
        }
        // 特质色彩编码（增强）
        var traitTags='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitTags=ch.traitIds.slice(0,3).map(function(tid){
            var d=P.traitDefinitions.find(function(t){return t.id===tid;});
            if(!d)return '';
            var _tc=(d.dims&&d.dims.boldness>0.2)?'var(--vermillion-400)':(d.dims&&d.dims.compassion>0.2)?'var(--celadon-400)':(d.dims&&d.dims.rationality>0.2)?'var(--indigo-400)':'var(--gold-400)';
            return '<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+_tc+';color:'+_tc+';margin-right:2px;">'+d.name+'</span>';
          }).filter(Boolean).join('');
        }
        var _portraitThumb = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;margin-right:6px;">' : '';
        return "<div class=\"cd\" style=\"padding:0.5rem 0.6rem;margin-bottom:0.35rem;cursor:pointer;border-left:3px solid var(--gold-500);\" onclick=\"openCharDetail('"+ch.name.replace(/'/g,"\\'")+"')\">"
          +"<div style=\"display:flex;align-items:center;\">"+_portraitThumb
          +"<div style=\"flex:1;\"><div style=\"display:flex;justify-content:space-between;align-items:center;\">"
          +"<strong style=\"font-size:0.85rem;\">"+moodIcon+ch.name+locTag+spouseTag+faceLine+"</strong>"
          +"<span style=\"font-size:0.68rem;\">"+ageTag+" <span class=\"stat-number\" style=\"color:"+loyColor+";\">忠"+loyDisp+"</span>"+ambTag+stressTag+"</span>"
          +"</div>"
          +"<div style=\"display:flex;justify-content:space-between;align-items:center;margin-top:0.1rem;\">"+officeLine+"<span>"+factionTag+"</span></div>"
          +(stancePartyTag?'<div style="margin-top:0.1rem;">'+stancePartyTag+'</div>':'')
          +wcLine
          +"<div style=\"margin-top:0.1rem;\">"+traitTags+"</div>"
          +goalBrief
          +eyBrief
          +"</div></div></div>";
      }).join("")||"<div style=\"color:var(--txt-d);font-size:0.78rem;\">\u65E0</div>";
    // 7.3: 超过分页限制时添加"显示全部"按钮
    if (!_charShowAll && _charList.length > _charPageLimit) {
      gr.innerHTML += '<div style="text-align:center;padding:0.3rem;"><button class="bt bs bsm" onclick="_$(\'gr\')._showAllChars=true;renderGameState();">\u663E\u793A\u5168\u90E8' + _charList.length + '\u4EBA</button></div>';
    }
  }

  // 渲染子组件
  renderWenduiChars();renderMemorials();renderBiannian();renderOfficeTree();renderShijiList();renderJishi();
  // 地方舆情每回合同步刷新（接新 adminHierarchy 深化字段）
  if (typeof _renderDifangPanel === 'function' && P.adminHierarchy) {
    try { _renderDifangPanel(); } catch(_dfRefE) { console.warn('[difang refresh]', _dfRefE); }
  }
  if(typeof renderGameTech==='function')renderGameTech();
  if(typeof renderGameCivic==='function')renderGameCivic();
  if(typeof renderRenwu==='function')renderRenwu();
  if(typeof renderSidePanels==='function')renderSidePanels();
  // 触发钩子，各模块在此追加徽章/地图等
  GameHooks.run('renderGameState:after');
  // 2.8: 动态元素无障碍增强
  if (typeof _applyA11y === 'function') _applyA11y();
}

// ── 建议库动态渲染 ──
// 纳入诏书的下拉菜单——以 body 级 fixed 定位呈现，避免被侧栏 overflow 裁切
function _showEdictAdoptMenu(evt, realIdx) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  // 移除旧菜单
  var _old = document.getElementById('_edictAdoptMenu'); if (_old) _old.remove();
  var _btn = evt && evt.currentTarget ? evt.currentTarget : (evt && evt.target);
  if (!_btn) return;
  var rect = _btn.getBoundingClientRect();
  var cats = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var menu = document.createElement('div');
  menu.id = '_edictAdoptMenu';
  // 计算位置——优先向下；若下方空间不足则向上
  var menuH = cats.length * 28 + 6;
  var vh = window.innerHeight;
  var top = rect.bottom + 4;
  if (top + menuH > vh - 10) top = Math.max(10, rect.top - menuH - 4);
  menu.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + top + 'px;z-index:9999;background:var(--color-elevated,#1a1a2e);border:1px solid var(--color-border-subtle,#444);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:90px;padding:3px 0;';
  cats.forEach(function(cat) {
    var item = document.createElement('div');
    item.textContent = cat.label;
    item.style.cssText = 'padding:5px 12px;font-size:0.8rem;cursor:pointer;color:' + cat.color + ';transition:background 0.12s;';
    item.onmouseover = function() { this.style.background = 'var(--color-surface,rgba(255,255,255,0.06))'; };
    item.onmouseout = function() { this.style.background = ''; };
    item.onclick = function(ev) {
      ev.stopPropagation();
      var sg = GM._edictSuggestions && GM._edictSuggestions[realIdx];
      if (sg) {
        var ta = _$(cat.id);
        if (ta) {
          // 纳入时保留问题背景：先写 topic，再写 content
          var prefix = '';
          if (sg.topic) prefix += '〔' + sg.topic + '〕';
          if (sg.from) prefix += '（' + sg.from + '言）';
          var block = (prefix ? prefix + '\n' : '') + sg.content;
          ta.value += (ta.value ? '\n\n' : '') + block;
        }
        if (typeof toast === 'function') toast('\u5DF2\u7EB3\u5165' + cat.label + (sg.topic?'（含问题背景）':''));
      }
      menu.remove();
      document.removeEventListener('click', _closeEdictMenu);
    };
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  // 点击外部关闭
  setTimeout(function() { document.addEventListener('click', _closeEdictMenu); }, 0);
}
function _closeEdictMenu(e) {
  var m = document.getElementById('_edictAdoptMenu');
  if (m && !m.contains(e.target)) {
    m.remove();
    document.removeEventListener('click', _closeEdictMenu);
  }
}

function _renderEdictSuggestions() {
  var container = _$('edict-sug-sidebar');
  if (!container) return;
  var _edictCatIds = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var _unused = (GM._edictSuggestions || []).filter(function(s) { return !s.used; });
  // 按回合倒序（本回合最上·以往回合依次下排·同回合按原入库顺序）
  _unused.sort(function(a, b) {
    var ta = a.turn || 0, tb = b.turn || 0;
    if (tb !== ta) return tb - ta;
    // 同回合：保持插入顺序·取原数组索引
    return (GM._edictSuggestions || []).indexOf(a) - (GM._edictSuggestions || []).indexOf(b);
  });
  // 按来源映射 src 类
  var _srcClsMap = {
    '\u671D\u8BAE': 'ed-src-chaoyi',
    '\u95EE\u5BF9': 'ed-src-wendui',
    '\u9E3F\u96C1': 'ed-src-letter',
    '\u594F\u758F': 'ed-src-memorial',
    '\u5B98\u5236': 'ed-src-office',
    '\u5730\u65B9': 'ed-src-local',
    '\u72EC\u53EC': 'ed-src-wendui',
    '\u72EC\u53EC\u00B7\u5212\u9009': 'ed-src-wendui',
    '\u72EC\u53EC\u00B7\u5EFA\u8A00\u8981\u70B9': 'ed-src-wendui'
  };
  var html = '';
  if (_unused.length === 0) {
    html += '<div style="font-size:11.5px;color:var(--color-foreground-muted);line-height:1.7;padding:12px 10px;text-align:center;font-family:var(--font-serif);font-style:italic;">\u8BF8\u4E8B\u6682\u5B81\u3002\u53EC\u5F00\u300C\u671D\u8BAE\u300D\u6216\u300C\u95EE\u5BF9\u300D\uFF0C\u5176\u8FDB\u8A00\u5C06\u6536\u5165\u6B64\u5904\u3002</div>';
  } else {
    var _curTurn = (GM.turn || 1);
    var _lastTurnHeader = null;
    _unused.forEach(function(s) {
      var _realIdx = (GM._edictSuggestions || []).indexOf(s);
      var _srcCls = _srcClsMap[s.source] || 'ed-src-default';
      var _srcLine = '\u3010' + escHtml(s.source || '?') + (s.from ? '\u00B7' + escHtml(s.from) : '') + '\u3011';
      // 插入回合分组 header
      var _sTurn = s.turn || 0;
      if (_sTurn !== _lastTurnHeader) {
        _lastTurnHeader = _sTurn;
        var _turnLabel;
        if (_sTurn === _curTurn) _turnLabel = '\u672C\u56DE\u5408';
        else if (_sTurn === _curTurn - 1) _turnLabel = '\u4E0A\u56DE\u5408';
        else if (_sTurn > 0) _turnLabel = '\u7B2C ' + _sTurn + ' \u56DE\u5408';
        else _turnLabel = '\u5F80\u65E5';
        var _dateStr = (typeof getTSText === 'function' && _sTurn > 0) ? getTSText(_sTurn) : '';
        html += '<div style="font-size:10.5px;color:var(--gold,#c9a84c);letter-spacing:0.3em;padding:6px 8px 3px;border-bottom:1px dashed rgba(201,168,76,0.2);margin-top:4px;font-family:var(--font-serif);">\u00B7 ' + _turnLabel + (_dateStr ? ' \u00B7 ' + escHtml(_dateStr) : '') + ' \u00B7</div>';
      }
      html += '<div class="ed-sug-item ' + _srcCls + '" onclick="_showEdictAdoptMenu(event,' + _realIdx + ')">';
      html += '<div class="src">' + _srcLine + '</div>';
      if (s.topic) html += '<div class="topic">\u3014' + escHtml(s.topic) + '\u3015</div>';
      html += '<div class="txt">' + escHtml(s.content) + '</div>';
      html += '<span class="act">\u6458\u5165</span>';
      html += '<button class="del" onclick="event.stopPropagation();GM._edictSuggestions[' + _realIdx + '].used=true;_renderEdictSuggestions();" title="\u5220\u9664">\u2715</button>';
      html += '</div>';
    });
  }
  container.innerHTML = html;
}

// ── 有司润色：将各类诏令合并为正式诏书 ──
async function _polishEdicts() {
  var cats = [
    { id: 'edict-pol', label: '\u653F\u4EE4' },
    { id: 'edict-mil', label: '\u519B\u4EE4' },
    { id: 'edict-dip', label: '\u5916\u4EA4' },
    { id: 'edict-eco', label: '\u7ECF\u6D4E' },
    { id: 'edict-oth', label: '\u5176\u4ED6' }
  ];
  var parts = [];
  cats.forEach(function(cat) {
    var el = _$(cat.id);
    var val = el ? el.value.trim() : '';
    if (val) parts.push({ label: cat.label, content: val });
  });
  if (parts.length === 0) { toast('\u8BF7\u5148\u5728\u5404\u7C7B\u8BCF\u4EE4\u4E2D\u586B\u5199\u5185\u5BB9'); return; }

  var panel = _$('edict-polished');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);padding:var(--space-4);">\u6709\u53F8\u6B63\u5728\u6DA6\u8272\u8BCF\u4E66\u2026\u2026</div>';

  // 读取风格选择
  var styleEl = _$('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleDesc = {
    elegant: '\u5178\u96C5\u5E84\u91CD\u7684\u6587\u8A00\uFF0C\u5584\u7528\u5BF9\u5076\u9A88\u53E5',
    concise: '\u7B80\u6D01\u660E\u5FEB\uFF0C\u76F4\u5165\u4E3B\u9898\uFF0C\u4E0D\u7528\u5197\u957F\u8F9E\u85FB',
    ornate: '\u534E\u4E3D\u6587\u85FB\uFF0C\u6587\u91C7\u98DE\u626C\uFF0C\u5927\u91CF\u4F7F\u7528\u5178\u6545\u3001\u8F9E\u8D4B\u3001\u6392\u6BD4',
    plain: '\u767D\u8BDD\u6587\u8A00\uFF0C\u534A\u6587\u534A\u767D\uFF0C\u901A\u4FD7\u6613\u61C2\u4F46\u4FDD\u6301\u5E84\u91CD'
  }[style] || '';

  if (!P.ai.key) {
    var merged = parts.map(function(p) { return '\u3010' + p.label + '\u3011' + p.content; }).join('\n\n');
    _renderPolishedEdict(panel, merged);
    return;
  }

  var sc = findScenarioById && findScenarioById(GM.sid);
  var era = (sc && sc.era) || '';
  var dynasty = (sc && sc.dynasty) || '';
  var role = (P.playerInfo && P.playerInfo.characterName) || '\u7687\u5E1D';
  var dateText = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';

  var prompt = '\u4F60\u662F' + (dynasty || era || '\u4E2D\u56FD\u53E4\u4EE3') + '\u671D\u5EF7\u7684\u4E2D\u4E66\u820D\u4EBA/\u7FF0\u6797\u5B66\u58EB\uFF0C\u8D1F\u8D23\u8D77\u8349\u6B63\u5F0F\u8BCF\u4E66\u3002\n\n';
  prompt += '\u3010\u53D1\u5E03\u8005\u3011' + role + '\n';
  prompt += '\u3010\u65F6\u95F4\u3011' + dateText + '\n\n';
  prompt += '\u3010\u73A9\u5BB6\u8349\u62DF\u7684\u5404\u7C7B\u65E8\u610F\u3011\n';
  parts.forEach(function(p) { prompt += '\u3014' + p.label + '\u3015' + p.content + '\n'; });

  prompt += '\n\u3010\u4EFB\u52A1\u3011\u5C06\u4EE5\u4E0A\u5404\u7C7B\u65E8\u610F\u5408\u5E76\u6DA6\u8272\u4E3A\u4E00\u9053\u5B8C\u6574\u7684\u6B63\u5F0F\u8BCF\u4E66\u3002\u8981\u6C42\uFF1A\n';
  prompt += '1. \u8BCF\u4E66\u683C\u5F0F\u5FC5\u987B\u4E25\u683C\u9075\u5FAA' + (era || '\u8BE5\u671D\u4EE3') + '\u7684\u771F\u5B9E\u516C\u6587\u4F53\u5236\u2014\u2014\n';
  prompt += '   \u4E0D\u540C\u671D\u4EE3\u8BCF\u4E66\u683C\u5F0F\u5DEE\u5F02\u6781\u5927\uFF0C\u4F60\u5FC5\u987B\u6839\u636E\u5177\u4F53\u671D\u4EE3\u9009\u7528\u6B63\u786E\u683C\u5F0F\uFF1A\n';
  prompt += '   \u00B7 \u79E6\u6C49\uFF1A\u5236\u66F0/\u8BCF\u66F0\uFF0C\u65E0\u56FA\u5B9A\u8D77\u9996\u5957\u8BED\uFF0C\u7ED3\u5C3E\u201C\u5E03\u544A\u5929\u4E0B\u201D\u201C\u5176\u4EE4\u2026\u2026\u201D\u7B49\n';
  prompt += '   \u00B7 \u9B4F\u664B\u5357\u5317\u671D\uFF1A\u591A\u7528\u201C\u95E8\u4E0B\u201D\u8D77\u9996\uFF0C\u9A88\u6587\u98CE\u683C\u6D53\u90C1\n';
  prompt += '   \u00B7 \u5510\u5B8B\uFF1A\u5236\u4E66\u201C\u95E8\u4E0B\uFF1A\u201D\u8D77\u9996\uFF0C\u6555\u4E66\u201C\u6555\u67D0\u67D0\u201D\u8D77\u9996\uFF0C\u7ED3\u5C3E\u201C\u4E3B\u8005\u65BD\u884C\u201D\n';
  prompt += '   \u00B7 \u5143\u4EE3\uFF1A\u8499\u6C49\u5408\u74A7\uFF0C\u767D\u8BDD\u8BCF\u4E66\u201C\u957F\u751F\u5929\u6C14\u529B\u91CC\uFF0C\u5927\u798F\u836B\u62A4\u52A9\u91CC\uFF0C\u7687\u5E1D\u5723\u65E8\u2026\u2026\u201D\n';
  prompt += '   \u00B7 \u660E\u6E05\uFF1A\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\uFF0C\u8BCF\u66F0/\u5236\u66F0/\u6555\u66F0\u201D\u2014\u2014\u6CE8\u610F\u201C\u5949\u5929\u627F\u8FD0\u201D\u56DB\u5B57\u540E\u63A5\u201C\u7687\u5E1D\u201D\uFF0C\n';
  prompt += '     \u201C\u8BCF\u66F0\u201D\u53E6\u8D77\uFF0C\u4E2D\u95F4\u65AD\u53E5\uFF0C\u4E0D\u662F\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u8BCF\u66F0\u201D\u8FDE\u8BFB\u3002\u4E14\u6B64\u683C\u5F0F\u4EC5\u9650\u660E\u6E05\u3002\n';
  prompt += '   \u00B7 \u82E5\u975E\u5E1D\u738B\uFF08\u5982\u8BF8\u4FAF/\u738B/\u4E1E\u76F8\u7B49\uFF09\uFF0C\u5E94\u4F7F\u7528\u201C\u4EE4\u201D\u201C\u6559\u201D\u201C\u6A84\u201D\u7B49\u5BF9\u5E94\u6587\u79CD\uFF0C\u4E0D\u7528\u201C\u8BCF\u201D\n';
  prompt += '2. \u6B63\u6587\uFF1A\u5C06\u5404\u7C7B\u65E8\u610F\u6709\u673A\u878D\u5408\uFF0C\u6309\u8F7B\u91CD\u7F13\u6025\u6392\u5217\uFF0C\u884C\u6587\u6D41\u7545\n';
  prompt += '3. \u8BED\u8A00\u98CE\u683C\uFF1A' + styleDesc + '\n';
  prompt += '4. \u4FDD\u7559\u73A9\u5BB6\u6240\u6709\u65E8\u610F\u7684\u5B9E\u8D28\u5185\u5BB9\uFF0C\u4E0D\u9057\u6F0F\u4E0D\u7BE1\u6539\uFF0C\u4E0D\u51ED\u7A7A\u589E\u52A0\u65B0\u653F\u7B56\n';
  prompt += '5. \u5B57\u6570\uFF1A' + _charRangeText('zw') + '\n\n';
  prompt += '\u76F4\u63A5\u8F93\u51FA\u8BCF\u4E66\u5168\u6587\uFF0C\u4E0D\u8981\u52A0\u4EFB\u4F55\u89E3\u91CA\u3002';

  try {
    var result = await callAI(prompt, 2000);
    if (result) _renderPolishedEdict(panel, result);
    else panel.innerHTML = '<div style="color:var(--color-foreground-muted);text-align:center;">\u6DA6\u8272\u672A\u8FD4\u56DE\u5185\u5BB9</div>';
  } catch(e) {
    panel.innerHTML = '<div style="color:var(--vermillion-400);">\u6DA6\u8272\u5931\u8D25\uFF1A' + escHtml(e.message || '') + '</div>';
  }
}

function _renderPolishedEdict(panel, text) {
  // 卷轴式·宣纸底+上下木轴+朱砂御玺+颁行天下
  panel.innerHTML = ''
    + '<div class="ed-scroll">'
    +   '<div class="ed-scroll-title">\u8BCF\u3000\u4E66</div>'
    +   '<textarea id="edict-polished-text" class="ed-scroll-text" rows="12">' + escHtml(text) + '</textarea>'
    +   '<div class="ed-scroll-seal"><div class="top">\u7687 \u5E1D</div><div class="main">\u5236\u5B9D</div><div class="bot">\u4E4B \u5B9D</div></div>'
    + '</div>'
    + '<div class="ed-scroll-actions">'
    +   '<button class="ed-scroll-btn" onclick="_polishEdicts()" title="\u91CD\u65B0\u7531\u6709\u53F8\u6DA6\u8272">\u91CD \u65B0 \u6DA6 \u8272</button>'
    +   '<button class="ed-scroll-btn" onclick="_applyPolishedEdict(\'keep\')" title="\u5B58\u4E3A\u8BCF\u4E66\u624B\u7A3F\u00B7\u5F52\u6863\u8D77\u5C45\u6CE8\u00B7\u672A\u9881\u884C">\u624B \u7A3F \u5165 \u6863</button>'
    +   '<button class="ed-scroll-btn primary" onclick="_applyPolishedEdict(\'replace\')" title="\u8BCF\u4E66\u9881\u884C\u5929\u4E0B\u00B7\u5F55\u5165\u653F\u4EE4\u680F\u00B7\u540C\u65F6\u5F52\u6863\u8D77\u5C45\u6CE8">\u9881 \u884C \u5929 \u4E0B</button>'
    +   '<button class="ed-scroll-btn" onclick="_$(\'edict-polished\').style.display=\'none\'">\u6536 \u8D77</button>'
    + '</div>';
}

function _applyPolishedEdict(mode) {
  var ta = _$('edict-polished-text');
  if (!ta) return;
  var text = ta.value.trim();
  if (!text) { toast('\u8BCF\u4E66\u5185\u5BB9\u4E3A\u7A7A'); return; }

  // 升级 GM.edicts 为结构化数组·兼容老字符串数据
  if (!Array.isArray(GM.edicts)) GM.edicts = [];
  for (var _i = 0; _i < GM.edicts.length; _i++) {
    if (typeof GM.edicts[_i] === 'string') {
      GM.edicts[_i] = { id: 'legacy-' + _i, turn: 0, time: '', text: GM.edicts[_i], status: 'draft', source: 'polish', style: '', styleLabel: '', polishVersion: 1, _chainEffects: [] };
    }
  }

  var styleEl = _$('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleLabel = ({elegant:'\u5178\u96C5', concise:'\u7B80\u6D01', ornate:'\u534E\u4E3D', plain:'\u767D\u8BDD'})[style] || '\u5178\u96C5';

  // 本回合已有几次润色
  var _curTurn = GM.turn || 0;
  var _thisTurnPolish = GM.edicts.filter(function(e) { return e.turn === _curTurn && e.source === 'polish'; });
  var polishVersion = _thisTurnPolish.length + 1;

  var status;
  if (mode === 'replace') {
    status = 'promulgated';
    // 同回合之前已颁行的·回落为"诏书手稿"(被后润色稿替代)
    GM.edicts.forEach(function(e) {
      if (e.turn === _curTurn && e.status === 'promulgated') e.status = 'draft';
    });
    var polEl = _$('edict-pol');
    if (polEl) polEl.value = text;
    ['edict-mil', 'edict-dip', 'edict-eco', 'edict-oth'].forEach(function(id) {
      var el = _$(id); if (el) el.value = '';
    });
    toast('\u8BCF\u4E66\u9881\u884C\u5929\u4E0B\u00B7\u5DF2\u5F55\u5165\u653F\u4EE4\u680F');
  } else {
    status = 'draft';
    toast('\u8BCF\u4E66\u5DF2\u7F16\u8BA2\u5165\u6863\u00B7\u672A\u9881\u884C\uFF08\u8BCF\u4E66\u624B\u7A3F\uFF09');
  }

  var rec = {
    id: 'edict-' + _curTurn + '-' + Date.now() + '-' + polishVersion,
    turn: _curTurn,
    time: (typeof getTSText === 'function') ? getTSText(_curTurn) : '',
    text: text,
    status: status,
    source: 'polish',
    style: style,
    styleLabel: styleLabel,
    polishVersion: polishVersion,
    _chainEffects: []
  };
  GM.edicts.push(rec);

  // 诏书入起居注（"诏令"分类·即时可见）
  if (!GM.qijuHistory) GM.qijuHistory = [];
  var _statusLabel = status === 'promulgated' ? '\u9881\u884C\u5929\u4E0B' : '\u8BCF\u4E66\u624B\u7A3F';
  var _headline = '\u3010\u8BCF\u4E66\u00B7' + _statusLabel + '\u00B7\u7B2C' + polishVersion + '\u6B21\u6DA6\u8272\u00B7' + styleLabel + '\u3011';
  GM.qijuHistory.push({
    turn: _curTurn,
    time: rec.time,
    category: '\u8BCF\u4EE4',
    content: _headline + '\n' + text,
    _edictRef: rec.id
  });

  _$('edict-polished').style.display = 'none';
  if (typeof renderQiju === 'function') renderQiju();
}

// 官职公库初始化：walk officeTree，从 publicTreasuryInit 建立 live publicTreasury
function _initOfficePublicTreasury(nodes) {
  (nodes || []).forEach(function(n) {
    if (!n) return;
    (n.positions || []).forEach(function(p) {
      if (!p) return;
      // 若已有 live publicTreasury 则跳过（保存加载时不覆盖）
      if (p.publicTreasury && p.publicTreasury.money && p.publicTreasury.money.stock != null) return;
      var init = p.publicTreasuryInit || {};
      p.publicTreasury = {
        money: { stock: init.money || 0, quota: init.quotaMoney || 0, used: 0, available: init.money || 0, deficit: 0 },
        grain: { stock: init.grain || 0, quota: init.quotaGrain || 0, used: 0, available: init.grain || 0, deficit: 0 },
        cloth: { stock: init.cloth || 0, quota: init.quotaCloth || 0, used: 0, available: init.cloth || 0, deficit: 0 },
        currentHead: p.holder || null,
        previousHead: null,
        handoverLog: []
      };
    });
    if (n.subs) _initOfficePublicTreasury(n.subs);
  });
}

// 按品级推算角色私产初始值（当剧本未给定 wealthInit 且 wealth 为字符串描述时）
// 兼容从 rank(数字) 和 officialTitle(如"从四品"/"正二品") 两种输入
function _parseRankNumber(ch) {
  // 1. 直接用 rank 数字
  if (typeof ch.rank === 'number' && ch.rank >= 1 && ch.rank <= 9) return ch.rank;
  // 2. 从 officialTitle/rank 字符串解析"正X品/从X品"
  var rankStr = (typeof ch.rank === 'string' ? ch.rank : '') + '|' + (ch.officialTitle || '') + '|' + (ch.title || '');
  var numMap = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
  var m = rankStr.match(/(正|从)([一二三四五六七八九])品/);
  if (m) {
    var r = numMap[m[2]];
    // 从品加 0.5 档，但结果仍取整数档位（1-9）
    return r;
  }
  // 3. 无品级 → 0（平民/未入仕）
  return 0;
}
function _inferPrivateWealthByRank(ch) {
  var r = _parseRankNumber(ch);
  // 品级越高私产越丰（明清历史参照·单位 两/亩）
  var tiers = {
    1:  { cash: 50000, land: 10000, treasure: 30000, slaves: 200, commerce: 20000 },  // 正一品
    2:  { cash: 30000, land:  8000, treasure: 20000, slaves: 150, commerce: 15000 },  // 正二品
    3:  { cash: 15000, land:  5000, treasure: 10000, slaves: 100, commerce:  8000 },  // 正三品
    4:  { cash:  8000, land:  3000, treasure:  5000, slaves:  60, commerce:  4000 },  // 正四品
    5:  { cash:  4000, land:  1500, treasure:  2500, slaves:  30, commerce:  2000 },  // 正五品
    6:  { cash:  2000, land:   800, treasure:  1200, slaves:  15, commerce:  1000 },  // 正六品
    7:  { cash:  1000, land:   400, treasure:   600, slaves:   8, commerce:   500 },  // 正七品
    8:  { cash:   500, land:   200, treasure:   300, slaves:   4, commerce:   200 },  // 正八品
    9:  { cash:   200, land:   100, treasure:   150, slaves:   2, commerce:   100 }   // 正九品
  };
  // 无品级 → 平民/未入仕基准（很低）
  if (!r || r < 1) return { cash: 100, land: 50, treasure: 50, slaves: 0, commerce: 50 };
  return tiers[Math.min(9, r)] || tiers[9];
}

// 从 wealth 字符串中解析数字线索（如"田 4 万顷"→ land = 40000*100, "家丁 3000"→ slaves = 3000）
function _parseWealthString(s) {
  if (!s || typeof s !== 'string') return {};
  var out = {};
  // 田 N 万顷
  var m1 = s.match(/田\s*(\d+(?:\.\d+)?)\s*万?顷/);
  if (m1) {
    var qing = parseFloat(m1[1]);
    if (s.indexOf('万顷') >= 0) qing *= 10000;
    out.land = Math.round(qing * 100);  // 1 顷 = 100 亩
  } else {
    var m2 = s.match(/田\s*(\d+(?:\.\d+)?)\s*万?亩/);
    if (m2) {
      var mu = parseFloat(m2[1]);
      if (s.indexOf('万亩') >= 0) mu *= 10000;
      out.land = Math.round(mu);
    }
  }
  // 家丁 N
  var m3 = s.match(/家丁\s*(\d+(?:\.\d+)?)\s*(千|万)?/);
  if (m3) {
    var n = parseFloat(m3[1]);
    var mu2 = m3[2] === '万' ? 10000 : m3[2] === '千' ? 1000 : 1;
    out.slaves = Math.round(n * mu2);
  }
  // 富甲天下 / 抄没 X 万两
  var m4 = s.match(/(?:抄没估?|家?产)\s*(\d+)\s*万?两/);
  if (m4) {
    var v = parseInt(m4[1]);
    if (s.indexOf('万两') >= 0 || s.indexOf('万') >= 0) v *= 10000;
    out.cash = v;
  }
  // 富甲天下 / 豪富 关键词
  if (/富甲天下|豪富|巨富/.test(s)) {
    out._rich = true;  // rank-based * 5
  } else if (/家境殷实|小有资产/.test(s)) {
    out._rich = false;
  } else if (/清贫|贫困|寒素/.test(s)) {
    out._poor = true;  // rank-based * 0.3
  }
  return out;
}

// 初始化所有角色的 privateWealth
function _initCharacterPrivateWealth(chars) {
  var _isLeader = function(c){
    if (!c) return false;
    // 皇帝
    if (c.role === '皇帝' || c.officialTitle === '皇帝') return true;
    if (c.isPlayer && c.royalRelation === 'emperor_family' && c.isRoyal) return true;
    if (c.title && /明思宗|崇祯帝|庄烈帝|皇帝/.test(c.title)) return true;
    // 势力领袖
    var facs = (GM && GM.facs) || [];
    for (var i = 0; i < facs.length; i++) {
      var f = facs[i]; if (!f) continue;
      if (f.leader === c.name) return true;
      if (f.leadership && f.leadership.ruler === c.name) return true;
    }
    return false;
  };
  (chars || []).forEach(function(ch) {
    if (!ch || ch.alive === false) return;
    if (!ch.resources) ch.resources = {};
    // 领袖：跳过五大类赋值，其私产=内帑/领袖私库 镜像（由 updatePublicTreasuryMirror 同步）
    if (_isLeader(ch)) {
      if (typeof CharEconEngine !== 'undefined') {
        try { CharEconEngine.ensureCharResources(ch); } catch(_){}
        try { CharEconEngine.updatePublicTreasuryMirror(ch); } catch(_){}
      }
      return;
    }
    // 若 resources.privateWealth 已有有效数据（存档加载）则跳过
    if (ch.resources.privateWealth && (ch.resources.privateWealth.cash > 0 || ch.resources.privateWealth.land > 0)) return;
    // 剧本可直接提供 wealthInit 覆盖全部
    if (ch.wealthInit && typeof ch.wealthInit === 'object') {
      ch.resources.privateWealth = {
        cash: ch.wealthInit.cash || 0,
        land: ch.wealthInit.land || 0,
        treasure: ch.wealthInit.treasure || 0,
        slaves: ch.wealthInit.slaves || 0,
        commerce: ch.wealthInit.commerce || 0
      };
      if (ch.wealthInit.hidden != null) ch.hiddenWealth = ch.wealthInit.hidden;
      return;
    }
    // 按品级推算基准
    var base = _inferPrivateWealthByRank(ch);
    // 从 wealth 字符串解析线索叠加
    var parsed = _parseWealthString(ch.wealth || '');
    if (parsed._rich) {
      ['cash','land','treasure','slaves','commerce'].forEach(function(k){ base[k] = Math.round(base[k] * 5); });
    }
    if (parsed._poor) {
      ['cash','land','treasure','slaves','commerce'].forEach(function(k){ base[k] = Math.round(base[k] * 0.3); });
    }
    // 具体数字线索覆盖
    ['cash','land','treasure','slaves','commerce'].forEach(function(k){
      if (parsed[k] != null && parsed[k] > 0) base[k] = parsed[k];
    });
    ch.resources.privateWealth = base;
  });
}
