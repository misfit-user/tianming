// Settings are drafts until the existing Save All owner commits them.
(function(root){
  'use strict';var TM=root.TM=root.TM||{},draft=null;if(TM.RecoverySettings)return;
  function el(tag,text){var n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
  function select(host,key,label,options,value){var box=el('label',label),input=el('select');input.id='s-recovery-'+key;options.forEach(function(pair){var o=el('option',pair[1]);o.value=pair[0];input.appendChild(o);});input.value=String(value);box.appendChild(input);box.style.cssText='display:flex;flex-direction:column;gap:.35rem';host.appendChild(box);return input;}
  function mount(host){
    draft=null;if(!host||!TM.EmergencyRecovery)return;
    var c=TM.EmergencyRecovery.draftConfig(),box=el('fieldset');box.id='s-emergency-recovery';box.style.cssText='border:1px solid var(--bdr);padding:.7rem;margin:.8rem 0;';box.appendChild(el('legend','回合复核与应急推演'));
    box.appendChild(el('p','每回合检验后固定由 Agent 阅读完整推演原文，核查误判、遗漏与未覆盖事项，可修正、补充游戏数据并核验实际修改。初核尽量与后续推演并行。固定复核与失败后应急修补分别计算 Token 预算。'));
    var grid=el('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem';box.appendChild(grid);var fields={};
    fields.mode=select(grid,'mode','失败后的应急策略',[['auto','自动修复可验证项（默认）'],['ask','每次失败后询问'],['off','关闭']],c.mode);
    fields.tier=select(grid,'tier','复核与应急模型',[['same','复核用主要 API；应急沿用原接口'],['primary','主要 API'],['secondary','次要 API（须已配置）']],c.tier);
    [['maxCalls','每次复核／应急调用预算（次）',1],['maxRepairs','候选修订预算（次）',1],['maxSteps','工具步骤预算（步）',1],['reviewMaxTokens','固定复核 Token 预算（0 不设）',0],['maxTokens','失败后应急 Token 预算',1],['timeoutMs','复核／应急等待（秒，0 不设）',0]].forEach(function(row){
      var label=el('label',row[1]),input=el('input');input.type='number';input.id='s-recovery-'+row[0];input.min=String(row[2]);input.step='1';input.value=String(row[0]==='timeoutMs'?c[row[0]]/1000:c[row[0]]);label.appendChild(input);label.style.cssText='display:flex;flex-direction:column;gap:.35rem';grid.appendChild(label);fields[row[0]]=input;
    });
    box.appendChild(el('p','主推演完成后正常保存并过回合，复核在后台继续；复核失败、超预算或辅助任务出错不会撤销已完成回合。补正通过正式写入和实际读回后另行保存。开始下一回合或切换存档时，旧复核停止写入。查证与修订计入实际接口用量。'));
    box.appendChild(el('p','固定复核默认不设 Token 上限，完整原文阅读、查漏和修改后核验均计入实际接口用量。可自行填写正整数限制本次总量；0 表示不设上限。其他预算不设固定最大值，等待时间为 0 表示不设时限。'));
    var error=el('p');error.setAttribute('role','alert');error.style.color='var(--danger,#a33)';box.appendChild(error);
    var reset=el('button','恢复默认预算');reset.type='button';reset.addEventListener('click',function(){Object.keys(fields).forEach(function(k){if(k==='mode'||k==='tier')return;fields[k].value=String(k==='timeoutMs'?TM.EmergencyRecovery.defaults[k]/1000:TM.EmergencyRecovery.defaults[k]);});error.textContent='';});box.appendChild(reset);
    host.appendChild(box);draft={box:box,fields:fields,error:error};
  }
  function read(){
    if(!draft||!draft.box.isConnected)return null;
    var out={};Object.keys(draft.fields).forEach(function(k){var v=draft.fields[k].value;out[k]=v;if(k==='timeoutMs'&&v.trim()!=='')out[k]=Number(v)*1000;});
    try{var result=TM.EmergencyRecovery.config(out);draft.error.textContent='';return result;}
    catch(error){draft.error.textContent=error.message;var input=draft.fields[error.field];if(input){if(input.focus)input.focus();if(input.scrollIntoView)input.scrollIntoView({block:'center'});}throw error;}
  }
  function close(){draft=null;}
  function ask(summary,signal){
    if(!root.document)return Promise.resolve(false);
    return new Promise(function(resolve){
      var box=el('section');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.style.cssText='position:fixed;inset:20% 10% auto;z-index:2147483600;background:var(--bg,#222);color:var(--txt,#eee);padding:1.2rem;border:1px solid #888;';
      box.appendChild(el('h3','是否启动应急恢复？'));box.appendChild(el('p',String(summary.call)+' 的普通重试已结束。将使用额外模型调用查证并预检，不直接执行未经验证的修改。'));
      var yes=el('button','查证并修复'),no=el('button','保留失败，不启动');yes.type=no.type='button';box.append(yes,no);
      var done=false;function finish(value){if(done)return;done=true;signal.removeEventListener('abort',cancel);box.remove();resolve(value);}function cancel(){finish(false);}
      yes.addEventListener('click',function(){finish(true);});no.addEventListener('click',cancel);signal.addEventListener('abort',cancel,{once:true});
      if(signal.aborted){finish(false);return;}document.body.appendChild(box);yes.focus();
    });
  }
  var panel=null;
  function progress(event){
    if(!root.document||!document.body)return;
    var row=event.detail;if(!row)return;
    if(!panel){panel=el('aside');panel.id='tm-recovery-progress';panel.setAttribute('role','status');panel.style.cssText='position:fixed;right:1rem;bottom:1rem;max-width:min(32rem,90vw);z-index:2147483500;background:var(--bg,#222);color:var(--txt,#eee);padding:.8rem;border:1px solid #888;';document.body.appendChild(panel);}
    panel.replaceChildren();panel.appendChild(el('strong',(row.kind==='turn-review'?'回合复核 · ':'应急恢复 · ')+String(row.call)));
    panel.appendChild(el('div',row.detail||row.phase));panel.appendChild(el('small','额外调用 '+row.calls+(row.budget?'/'+row.budget.maxCalls:'')+' · 工具步骤 '+row.steps+' · 候选 '+row.repairs+' · 估算 Token '+(row.estimatedTokens||0)+(row.budget?'/'+(row.budget.maxTokens===0?'不设上限':row.budget.maxTokens):'')));
    var stop=el('button',row.phase==='verified'||row.phase==='stopped'?'关闭提示':row.kind==='turn-review'?'取消回合复核':'取消应急恢复');stop.type='button';panel.appendChild(stop);
    stop.addEventListener('click',function(){if(row.phase!=='verified'&&row.phase!=='stopped')(row.kind==='turn-review'&&TM.RecoveryReview?TM.RecoveryReview.cancel(row.id):TM.EmergencyRecovery.cancel(row.id));else{panel.remove();panel=null;}});
  }
  if(root.addEventListener)root.addEventListener('tm-emergency-recovery',progress);
  TM.RecoverySettings={mount:mount,read:read,close:close,ask:ask};
})(typeof window!=='undefined'?window:globalThis);
