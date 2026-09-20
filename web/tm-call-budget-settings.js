// Draft-only retry and waiting controls; committed by the existing settings owner.
(function(root){
  'use strict';var TM=root.TM=root.TM||{},state=null;
  function el(tag,text){var n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
  function button(text,fn){var n=el('button',text);n.type='button';n.className='bt bs bsm';n.addEventListener('click',fn);return n;}
  function duration(parent,prefix,key,label,value){
    var wrap=el('label',label),input=el('input');input.type='number';input.min='0';input.max='86400';input.step='1';input.id=prefix+key;input.value=String((Number(value)||0)/1000);
    wrap.style.cssText='display:flex;flex-direction:column;gap:.35rem;font-size:.8rem;';wrap.appendChild(input);parent.appendChild(wrap);return input;
  }
  function waits(host,tier){
    var cfg=tier==='secondary'?((root.P.ai||{}).secondary||{}):(root.P.ai||{}),prefix=tier==='secondary'?'s-sec-':'s-';
    var group=el('fieldset');group.style.cssText='border:1px solid var(--bdr);padding:.6rem;margin:.6rem 0;';group.appendChild(el('legend',tier==='secondary'?'次要 API 等待':'主要 API 等待'));
    var grid=el('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.65rem;';group.appendChild(grid);
    var fields={queueTimeoutMs:duration(grid,prefix,'queue-wait','排队最大等待（秒，0 = 不设）',cfg.queueTimeoutMs),firstResponseTimeoutMs:duration(grid,prefix,'first-response-wait','首响应最大等待（秒，0 = 自动）',cfg.firstResponseTimeoutMs),totalResponseTimeoutMs:duration(grid,prefix,'total-response-wait','完整响应最大等待（秒，0 = 不设）',cfg.totalResponseTimeoutMs)};
    if(tier==='primary')fields.agentRunTimeoutMs=duration(grid,prefix,'agent-total-wait','Agent 回合总等待（秒，0 = 不设）',cfg.agentRunTimeoutMs!=null?cfg.agentRunTimeoutMs:root.P.conf&&root.P.conf.agentModeDeadlineMs);
    host.appendChild(group);return fields;
  }
  function mount(){
    state=null;var host=document.getElementById('s-call-budget-controls');if(!host||!TM.CallRetryPolicy)return;
    host.replaceChildren();host.appendChild(el('h4','逐项调用重试与最大等待'));
    var note=el('p','重试次数不含首次请求：填 5 表示最多尝试 6 次；0 表示不重试；留空跟随默认。只重试暂时性请求故障，不重新执行任免、扣款或工具动作。重试可能增加时间与费用，鉴权错误、取消、切档和明确的总时限仍会停止。');note.style.cssText='font-size:.78rem;line-height:1.65;color:var(--txt-d)';host.appendChild(note);
    var controls=el('div');controls.style.cssText='display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;';
    var search=el('input');search.type='search';search.placeholder='查找调用名称或编号';search.setAttribute('aria-label','查找过回合调用');controls.appendChild(search);host.appendChild(controls);
    var values=root.P.conf&&root.P.conf.aiCallRetryOverrides||{},inputs={},rows=[];
    var wrap=el('div');wrap.style.cssText='max-height:24rem;overflow:auto;margin-top:.5rem;';var table=el('table');table.style.cssText='width:100%;font-size:.8rem;border-collapse:collapse;';wrap.appendChild(table);host.appendChild(wrap);
    var head=el('thead'),tr=el('tr');['调用项目','额外重试次数','故障尝试上限'].forEach(function(t){var th=el('th',t);th.style.textAlign='left';tr.appendChild(th);});head.appendChild(tr);table.appendChild(head);var tbody=el('tbody');table.appendChild(tbody);
    [{id:'*',label:'所有过回合调用的默认重试'}].concat(TM.CallRetryPolicy.catalog()).forEach(function(item){
      var row=el('tr'),name=el('td',item.label+(item.id==='*'?'':' · '+item.id)),cell=el('td'),input=el('input'),countCell=el('td');
      input.type='number';input.min='0';input.max='20';input.step='1';input.value=values[item.id]!=null?String(values[item.id]):'';input.placeholder='默认';input.style.width='6rem';input.setAttribute('data-call-retry-id',item.id);input.setAttribute('aria-label',item.label+'额外重试次数');
      inputs[item.id]=input;cell.appendChild(input);row.append(name,cell,countCell);tbody.appendChild(row);name.style.cssText='padding:.45rem .35rem;overflow-wrap:anywhere;';rows.push({node:row,text:(item.label+' '+item.id).toLowerCase()});
      function refresh(){try{var n=TM.CallRetryPolicy.count(input.value);if(n==null&&item.id!=='*')n=TM.CallRetryPolicy.count(inputs['*'].value);countCell.textContent=n==null?'引擎默认':String(n+1)+' 次';}catch(_){countCell.textContent='输入无效';}}
      input.addEventListener('input',refresh);input._refreshBudget=refresh;refresh();
    });
    controls.appendChild(button('全部设为 3 次',function(){Object.keys(inputs).forEach(function(id){inputs[id].value=id==='*'?'3':'';});refreshAll();}));
    controls.appendChild(button('全部恢复默认',function(){Object.keys(inputs).forEach(function(id){inputs[id].value='';});refreshAll();}));
    function refreshAll(){Object.keys(inputs).forEach(function(id){inputs[id]._refreshBudget();});}
    inputs['*'].addEventListener('input',refreshAll);search.addEventListener('input',function(){var q=search.value.trim().toLowerCase();rows.forEach(function(r){r.node.hidden=!!q&&r.text.indexOf(q)<0;});});
    var help=el('p','上表指单个请求的首次尝试加故障重试，不含独立的结构修复和一次性协议协商。主、次 API 原有等待值保留。成功响应头到达后继续等待完整正文；0 不会被改成固定总期限。Agent 每轮采用同一项设置，工具轮数限制不变；未完整收到的流式正文不拼接重发。修改后点击底部“全部保存”。');help.style.cssText='font-size:.76rem;line-height:1.6;color:var(--txt-d)';host.appendChild(help);
    state={host:host,inputs:inputs,waits:{primary:waits(host,'primary'),secondary:waits(host,'secondary')}};
  }
  function readWaits(tier,target){
    if(!state||!state.host.isConnected)return;var fields=state.waits[tier]||{},draft={};
    Object.keys(fields).forEach(function(k){var v=Number(fields[k].value);if(!Number.isInteger(v)||v<0||v>86400)throw new Error('等待时间须为 0 至 86400 的整数秒');draft[k]=v*1000;});
    Object.assign(target,draft);
  }
  function readConfig(){if(!state||!state.host.isConnected)return null;var values={};Object.keys(state.inputs).forEach(function(id){values[id]=state.inputs[id].value;});return TM.CallRetryPolicy.validate(values);}
  function validate(){readConfig();readWaits('primary',{});readWaits('secondary',{});return true;}
  TM.CallBudgetSettings={mount:mount,validate:validate,readConfig:readConfig,readWaits:readWaits,close:function(){state=null;}};
})(typeof window!=='undefined'?window:globalThis);
