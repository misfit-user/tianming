(function(root) {
  'use strict';
  function mount() {
    var ME=root.TM && root.TM.MapEditor;
    if(!ME || !ME.agent || document.getElementById('me-guoshi')) return;
    var launcher=document.createElement('button');
    launcher.id='me-guoshi-launcher';launcher.type='button';launcher.textContent='国师';
    launcher.setAttribute('aria-controls','me-guoshi');launcher.setAttribute('aria-expanded','false');
    var panel=document.createElement('section');panel.id='me-guoshi';panel.hidden=true;
    panel.setAttribute('aria-label','国师地图助手');
    panel.innerHTML='<header><div><b>国师</b><small>地图编辑</small></div><button type="button" data-action="close" aria-label="收起国师">×</button></header>'
      +'<p class="me-guoshi-hint">可指定剧本和地图层级，再修改地名。每条指令完成后应用，可整步撤销。</p>'
      +'<div data-role="selection"></div><div data-role="log" role="log" aria-live="polite"></div>'
      +'<form><label for="me-guoshi-request">地图指令</label><textarea id="me-guoshi-request" rows="3" maxlength="8000" placeholder="例如：使用绍宋剧本的三级地图，把开封府改名为汴京。"></textarea>'
      +'<div class="me-guoshi-options"><label><input type="checkbox" data-role="readonly"> 仅查看</label><span data-role="model"></span></div>'
      +'<div class="me-guoshi-actions"><button type="button" data-action="undo" disabled>撤销上次修改</button><button type="button" data-action="stop" disabled>停止</button><button type="submit">发送</button></div></form>'
      +'<p data-role="status" role="status">复用国师的模型设置</p>';
    document.body.appendChild(launcher);document.body.appendChild(panel);
    var get=function(s) {return panel.querySelector(s);}, log=get('[data-role="log"]'), status=get('[data-role="status"]');
    var input=get('textarea'), send=get('[type="submit"]'), stop=get('[data-action="stop"]'), undo=get('[data-action="undo"]');
    function add(who,text) {
      var item=document.createElement('p'), label=document.createElement('b');label.textContent=who+'：';
      item.appendChild(label);item.appendChild(document.createTextNode(String(text || '')));log.appendChild(item);
      while(log.children.length>60)log.removeChild(log.firstChild);log.scrollTop=log.scrollHeight;
    }
    function selection() {
      var list=ME.getSelected();get('[data-role="selection"]').textContent=list.length?'已选中：'+list.slice(0,5).map(function(d) {return d.name;}).join('、')+(list.length>5?' 等 '+list.length+' 块':''):'可先在地图选择地块，或直接输入地名';
      undo.disabled=!ME.agent.canUndo();
    }
    function show(open) {
      panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));
      if(open) {
        selection();var cfg=root.TM.AuthoringAgent.loadEditorApiConfig();
        get('[data-role="model"]').textContent=cfg.model || '未配置模型';
        status.textContent=cfg.key && cfg.url?'指令完成后应用到当前地图':'请先在游戏或剧本工坊设置国师使用的 API';
        input.focus();
      }
    }
    launcher.onclick=function() {show(panel.hidden);};get('[data-action="close"]').onclick=function() {show(false);launcher.focus();};
    stop.onclick=function() {ME.agent.stop();status.textContent='正在停止，本次修改将不应用';};
    undo.onclick=function() {var r=ME.agent.undo();status.textContent=r.ok?'已撤销上次国师修改':r.reason;selection();};
    panel.addEventListener('keydown',function(e) {e.stopPropagation();if(e.key==='Escape')show(false);});
    panel.addEventListener('keyup',function(e) {e.stopPropagation();});
    get('form').onsubmit=async function(e) {
      e.preventDefault();var request=input.value.trim();if(!request || ME.agent.isRunning())return;
      var readonly=get('[data-role="readonly"]');send.disabled=true;stop.disabled=false;undo.disabled=true;readonly.disabled=true;
      add('你',request);status.textContent='国师正在查看地图…';input.value='';
      try {
        var response=await ME.agent.run(request,{readOnly:readonly.checked,onStep:function(step) {
          var labels={listScenarioMaps:'查询剧本地图',loadScenarioMap:'载入地图副本',mapEditorOverview:'检索地块',mapEditorRead:'读取地块',mapEditorEdit:'拟订属性修改',mapEditorMoveVertex:'检查边界修改',mapEditorFocus:'定位地块'};
          if(step && labels[step.name])status.textContent=labels[step.name]+'…';
        }});
        panel._lastResult=response;
        var result=response.result || {}, summary=result.summary || result.finishSummary || '';
        add('国师',(summary?summary+'\n':'')+response.reason);status.textContent=response.reason;
      } catch(error) {add('国师',error.message);status.textContent='未应用本次修改：'+error.message;}
      finally {send.disabled=false;stop.disabled=true;readonly.disabled=false;selection();}
    };
    ['selection-change','mutation','map-loaded'].forEach(function(evt) {ME.on(evt,selection);});
    selection();
  }
  if(document.readyState === 'loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(window);
