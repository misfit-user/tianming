// @ts-check
// Existing 御案时政 surface. No timers, global listeners, hidden full-world render,
// raw AI HTML or automatic takeover of old edicts.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{}, serial=0;
  var ink='color:var(--txt-l,#e8d7ae);font-family:STKaiti,KaiTi,serif;';
  var field='box-sizing:border-box;width:100%;padding:.45rem;background:#21180f;border:1px solid var(--gold-d,#80683e);color:#ead7ad;font:inherit;border-radius:2px;';
  function el(tag,content,style){var n=document.createElement(tag);if(content!=null)n.textContent=String(content);if(style)n.style.cssText=style;return n;}
  function button(label,fn){var b=el('button',label,'padding:.4rem .75rem;border:1px solid var(--gold-d,#80683e);background:#352719;color:var(--gold,#c9a84c);font:inherit;cursor:pointer;border-radius:2px;');b.type='button';b.addEventListener('click',fn);return b;}
  function request(){return global.crypto&&global.crypto.randomUUID?global.crypto.randomUUID():'relief-ui-'+Date.now()+'-'+(++serial);}
  function api(){return TM.ReliefGovernance;}
  function number(v){return Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2});}
  function save(G,status){
    if(G!==global.GM)return;
    if(typeof global.requestBackgroundAutosave==='function'){
      Promise.resolve(global.requestBackgroundAutosave({reason:'relief-player-intent'})).then(function(r){
        if(G===global.GM&&status&&status.isConnected&&(!r||r.ok!==true))status.textContent='办理已记入本局，但自动保存未排入；请手动保存。';
      }).catch(function(){if(G===global.GM&&status&&status.isConnected)status.textContent='办理已记入本局，自动保存请求失败；请手动保存。';});
    }else if(status)status.textContent+='；请手动保存本局。';
  }
  function guard(G,lease){return G===global.GM&&(!lease||global._tmWorldLeaseCurrent(lease));}
  function lease(){return typeof global._tmCaptureWorldLease==='function'?global._tmCaptureWorldLease():null;}
  function labeled(parent,name,input){var l=el('label',null,'display:block;'+ink);l.appendChild(el('span',name,'display:block;font-size:.8rem;margin:.2rem 0;'));l.appendChild(input);parent.appendChild(l);return input;}
  function input(type,value){var n=el('input',null,field);n.type=type;n.value=value;n.autocomplete='off';return n;}
  function select(rows,value){var s=el('select',null,field);rows.forEach(function(r){var o=el('option',r.label);o.value=r.value;s.appendChild(o);});if(value!=null)s.value=value;return s;}
  function officerRows(G){return(G.chars||[]).filter(function(c){return c&&c.id&&!c.dead&&!c.deceased&&!c.retired&&c.alive!==false;}).map(function(c){return{value:c.id,label:(c.name||c.id)+' · '+(c.officialTitle||c.position||c.id)};});}
  function mountToolbar(panel){
    if(!api()||!global.GM)return;
    var G=global.GM, captured=lease(), bar=el('div',null,'padding:.6rem 1.4rem;display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;border-bottom:1px solid #65512f;'+ink);
    bar.dataset.reliefToolbar='true';
    var status=el('span','仅新立赈案使用；旧诏令与旧账不自动接管。','font-size:.75rem;color:var(--txt-d,#aa9874);flex:1;');
    var toggle=button('赈务试点：'+(api().enabled(G)?'已启用':'未启用'),function(){
      if(!guard(G,captured)){status.textContent='世界已变更，请重新打开御案。';return;}
      var r=api().setEnabled(G,!api().enabled(G));
      if(!r.ok){status.textContent=r.reason||r.code;return;}
      toggle.textContent='赈务试点：'+(r.enabled?'已启用':'未启用');create.disabled=!r.enabled;
      status.textContent=r.enabled?'本局已启用；下一步立案并明确钱款来源。':'本局已停用，历史案卷保留。';save(G,status);
    });
    toggle.dataset.reliefAction='toggle';bar.appendChild(toggle);
    var create=button('拟赈灾诏令',function(){if(guard(G,captured)&&api().enabled(G))openForm(panel,G);});
    create.dataset.reliefAction='create';create.disabled=!api().enabled(G);bar.appendChild(create);bar.appendChild(status);
    panel.insertBefore(bar,panel.children[1]||null);
  }
  function openForm(panel,G){
    var old=panel.querySelector('[data-relief-form]');if(old){old.scrollIntoView({block:'nearest'});return;}
    var captured=lease(), form=el('form',null,'padding:1rem 1.3rem;margin:.8rem;background:#2a2015;border:1px solid #9b7d43;'+ink);
    form.dataset.reliefForm='true';form.appendChild(el('h3','赈务立案 · 先定其责，再核其实','margin:0 0 .7rem;color:var(--gold);font-size:1.1rem;'));
    form.appendChild(el('p','首批为拨银赈济：批准预算不等于扣款，筹款后由回合 AI 推演执行。这里的旨意可自由书写；不另填一遍同额普通拨款诏令。','font-size:.8rem;line-height:1.7;'));
    var grid=el('div',null,'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.7rem;');form.appendChild(grid);
    var region=labeled(grid,'灾地',select(api().regions(G).map(function(r){return{value:r.id,label:(r.name||r.id)+' · '+r.id};})));
    region.name='regionId';
    var ch=labeled(grid,'承办人',select(officerRows(G)));ch.name='assigneeId';
    var source=labeled(grid,'钱款来源',select([{value:'guoku',label:'国库拨付'},{value:'neitang',label:'内帑垫付'},{value:'local',label:'地方真实留存'}]));source.name='source';
    var amount=labeled(grid,'批准预算（按本局钱款单位）',input('number',''));amount.name='amount';amount.min='0.01';amount.step='any';amount.required=true;
    var days=labeled(grid,'期限（日，不是回合数）',input('number','60'));days.name='deadlineDays';days.min='1';days.max='3650';days.required=true;
    var words=el('textarea',null,field+'min-height:90px;resize:vertical;line-height:1.7;');words.name='edictText';words.required=true;words.maxLength=2000;
    words.placeholder='例如：赈济灾民，先核灾户、按实发放；承办人逐次呈报，不得以已奉旨充作已办妥。';
    labeled(form,'诏令正文',words);
    var status=el('p','','font-size:.82rem;color:#d9ae82;');status.setAttribute('role','status');form.appendChild(status);
    var actions=el('div',null,'display:flex;gap:.6rem;justify-content:flex-end;');form.appendChild(actions);
    actions.appendChild(button('暂不立案',function(){form.remove();}));
    var submit=button('立案 · 批准预算',function(){form.requestSubmit();});submit.dataset.reliefAction='submit';actions.appendChild(submit);
    var intent=request();
    form.addEventListener('submit',function(event){event.preventDefault();
      if(!guard(G,captured)){status.textContent='世界已变更；未立案，也未扣款。';return;}
      var r=api().create(G,{requestId:intent,text:words.value,regionId:region.value,assigneeId:ch.value,source:source.value,
        amount:Number(amount.value),deadlineDays:Number(days.value)});
      if(!r.ok){status.textContent=r.reason||r.code;return;}
      status.textContent='已立案，尚未扣款。';save(G,status);form.remove();
      if(typeof global._openShizhengDetail==='function')global._openShizhengDetail(r.issueId);
    });
    var scroll=panel.lastElementChild;scroll.insertBefore(form,scroll.firstChild);words.focus();
  }
  function mountDetail(panel,id){
    if(!api())return;var G=global.GM,v=api().view(G,id);if(!v)return;
    var captured=lease(), box=el('section',null,'margin:1rem 0;padding:1rem;border:1px solid #96763b;background:linear-gradient(100deg,#342717,#221a12);'+ink);
    box.dataset.reliefDetail=id;
    box.appendChild(el('h3','履行单 · '+v.statusLabel,'color:var(--gold);margin:0 0 .6rem;font-size:1.1rem;letter-spacing:.15em;'));
    var facts=el('div',null,'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem;margin-bottom:.8rem;');box.appendChild(facts);
    [['批准预算',v.budget],['已筹款',v.funded],['已发放',v.disbursed],['待发放',v.remaining],['已退回',v.refunded]].forEach(function(row){
      var cell=el('div',null,'padding:.45rem;border-left:2px solid #8c7040;');cell.appendChild(el('small',row[0],'display:block;color:#bba47a;'));cell.appendChild(el('strong',number(row[1]),'display:block;margin-top:.25rem;font-size:1rem;'));facts.appendChild(cell);
    });
    box.appendChild(el('p','承办：'+v.assigneeName+'　｜　已过 '+v.elapsedDays+' 日 / 期限 '+v.deadlineDays+' 日'+(v.overdue?' · 已逾期，待处置':''),'font-size:.85rem;'));
    var bar=el('progress');bar.max=v.budget;bar.value=v.disbursed;bar.style.cssText='width:100%;height:8px;accent-color:#bd9b50;';bar.setAttribute('aria-label','实际发放占预算');box.appendChild(bar);
    box.appendChild(el('p','进度仅按实际发放计，不按时间猜满；已筹款不等于灾民已经收讫。','font-size:.74rem;color:#bba47a;'));
    if(v.lastTechnicalError)box.appendChild(el('p','技术状态：'+v.lastTechnicalError+'。未因此扣款或记作承办失败；可检查 AI 配置，后续回合重试。','color:#e0a87f;font-size:.84rem;line-height:1.7;'));
    [['执行裁决',v.lastReason||'等待筹款与回合推演。'],['承办呈报（非独立核验）',v.officialReport],['核对回应（AI 推演）',v.investigationReport],['后续可做',v.nextAdvice],['后续影响',v.consequence]].forEach(function(row){if(!row[1])return;box.appendChild(el('h4',row[0],'color:var(--gold);font-size:.85rem;margin:.8rem 0 .3rem;'));box.appendChild(el('p',row[1],'white-space:pre-wrap;font-size:.87rem;line-height:1.7;margin:0;'));});
    var status=el('p','','color:#e0a87f;min-height:1.2em;font-size:.82rem;');status.setAttribute('role','status');box.appendChild(status);
    function act(action,extra){
      if(!guard(G,captured)){status.textContent='世界已变化；未执行，请重新打开案卷。';return;}
      var result=api().act(G,id,Object.assign({action:action,requestId:request(),expectedRevision:v.revision},extra||{}));
      if(!result.ok){status.textContent=result.reason||result.code;return;}
      status.textContent='办理已记入本局。';save(G,status);if(global._openShizhengDetail)global._openShizhengDetail(id);
    }
    if(v.status!=='completed'&&v.status!=='cancelled'){
      var actions=el('div',null,'display:flex;flex-wrap:wrap;gap:.6rem;align-items:end;');box.appendChild(actions);
      if(v.budget>v.funded){
        var funds=labeled(actions,'本次筹款',input('number',String(v.unfunded)));funds.name='fundAmount';funds.step='0.01';
        var partial=el('input');partial.type='checkbox';var pl=el('label','允许不足额时仅拨可用余额','font-size:.8rem;');pl.prepend(partial);actions.appendChild(pl);
        var fund=button('确认筹款',function(){act('fund',{amount:Number(funds.value),allowPartial:partial.checked});});fund.dataset.reliefAction='fund';actions.appendChild(fund);
      }
      var officers=labeled(actions,'接办人',select(officerRows(G),v.assigneeId));officers.name='newAssigneeId';
      actions.appendChild(button('改派承办',function(){act('reassign',{assigneeId:officers.value});}));
      var days=labeled(actions,'展期日数',input('number','30'));days.name='extraDays';days.min='1';days.max='365';
      actions.appendChild(button('准予展期',function(){act('extend',{extraDays:Number(days.value)});}));
      var budget=labeled(actions,'修订总预算',input('number',String(v.budget)));budget.name='revisedBudget';budget.step='any';
      actions.appendChild(button('修订规模',function(){act('resize',{amount:Number(budget.value)});}));
      actions.appendChild(button('核对呈报',function(){act('investigate');}));
      actions.appendChild(button('催办',function(){act('resume');}));
      var cancel=button('撤止未办 · 退回余款',function(){act('cancel');});cancel.dataset.reliefAction='cancel';actions.appendChild(cancel);
    }
    var records=el('details',null,'margin-top:1rem;border-top:1px solid #806438;padding-top:.5rem;');records.appendChild(el('summary','展开拨付凭据与办理沿革','cursor:pointer;color:var(--gold);font-size:.85rem;'));box.appendChild(records);
    // Build the bounded history only when explicitly expanded.
    records.addEventListener('toggle',function(){if(!records.open||records.dataset.built)return;records.dataset.built='1';
      v.orders.forEach(function(o){records.appendChild(el('p',o.id+'｜筹款 '+number(o.amount)+'；发放 '+number(o.deliveredAmount)+'；退回 '+number(o.refundedAmount),'font-size:.76rem;line-height:1.6;word-break:break-all;'));});
      v.history.slice(-20).forEach(function(h){records.appendChild(el('p','第 '+h.turn+' 回合 · '+h.kind+'：'+h.detail,'font-size:.8rem;line-height:1.7;'));});
    });
    var scroll=panel.children[1];scroll.insertBefore(box,scroll.children[1]||null);
  }
  TM.ReliefGovernanceUI={mountToolbar:mountToolbar,mountDetail:mountDetail};
})(typeof window!=='undefined'?window:globalThis);
