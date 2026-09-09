// @ts-check
// Read-only register inside 御案; player decisions stay in their original channels.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{};
  var ink='color:var(--txt-l,#e8d7ae);font-family:STKaiti,KaiTi,serif;';
  function el(tag,text,style){var n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(style)n.style.cssText=style;return n;}
  function button(text,fn){var b=el('button',text,'padding:.4rem .7rem;border:1px solid var(--gold-d,#80683e);background:#352719;color:var(--gold,#c9a84c);font:inherit;cursor:pointer;');b.type='button';b.addEventListener('click',fn);return b;}
  function navigation(parent,G,valid){
    var actions=el('div',null,'display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0;');parent.appendChild(actions);
    [['诏书','openZhao'],['奏疏','openYueZou'],['鸿雁','openHongyan'],['朝会廷议','court']].forEach(function(row){
      var b=button('回'+row[0]+'办理',function(){
        if(G!==global.GM || !valid())return;
        var fn=row[1]==='court' ? global.TMPhase8FormalBridge && global.TMPhase8FormalBridge.openChaoyi : global[row[1]];
        if(typeof fn!=='function'){b.textContent=row[0]+'尚未就绪';return;}
        if(typeof global.closeShizhengTasks==='function')global.closeShizhengTasks();
        fn(row[1]==='court'?'changchao':undefined); // navigation only: never fill, submit or execute for the player.
      });b.dataset.reliefChannel=row[1];actions.appendChild(b);
    });
  }
  function renderEntry(parent,entry){
    parent.appendChild(el('p',entry.channelLabel+' · '+entry.status,'color:var(--gold);font-size:.85rem;'));
    parent.appendChild(el('p',entry.text,'white-space:pre-wrap;line-height:1.8;font-size:.9rem;'));
    if(entry.actor)parent.appendChild(el('p','文书关联人：'+entry.actor+'（不据此推定已奉行）','font-size:.8rem;color:var(--txt-d);'));
    if(entry.reply)parent.appendChild(el('p','原文书回应：'+entry.reply,'white-space:pre-wrap;line-height:1.8;'));
    if(entry.progress!==null)parent.appendChild(el('p','原追踪进度：'+entry.progress+'%（推演记录，不等于钱款到户）','font-size:.8rem;'));
    if(entry.transfer){var t=entry.transfer;parent.appendChild(el('p','关联调拨 '+t.id+'：计划 '+(t.amount===null?'未记录':t.amount)+'；已送达 '+(t.delivered===null?'未记录':t.delivered)+'；'+t.status+'。调拨到地方不等于已发到灾户。','font-size:.8rem;'));}
    if(entry.execution)parent.appendChild(el('p',entry.execution.ok?'原政务入口已受理；最终落实仍看执行回报。':'原政务入口未确认成功：'+(entry.execution.reason||entry.execution.pathway||'未详'),'font-size:.8rem;'));
    if(entry.advice)parent.appendChild(el('p','原督查建议：'+entry.advice,'font-size:.85rem;'));
    entry.history.forEach(function(h){parent.appendChild(el('p','第 '+(h.turn===null?'?':h.turn)+' 回合：'+h.text,'font-size:.8rem;line-height:1.6;'));});
  }
  function mountToolbar(panel){
    if(!TM.ReliefGovernance||!global.GM||panel.querySelector('[data-relief-register]'))return;
    var G=global.GM,P=global.P,load=global._tmLoadGen||0,campaign=G._campaignId,timeline=G._timelineId;
    function valid(){return G===global.GM&&P===global.P&&load===(global._tmLoadGen||0)&&campaign===G._campaignId&&timeline===G._timelineId;}
    var box=el('section',null,'margin:0 0 1rem;padding:.8rem 1rem;border:1px solid #806438;background:#261d13;'+ink);box.dataset.reliefRegister='true';
    box.appendChild(el('h3','赈务履行单 · 循原文书追踪','margin:0;color:var(--gold);font-size:1.05rem;letter-spacing:.13em;'));
    box.appendChild(el('p','照常写诏书、批奏疏、发鸿雁、议朝政。这里仅核对原记录，不另立案，不另扣款；改派、追加、催办或撤止也须循原渠道。','font-size:.82rem;line-height:1.8;'));
    navigation(box,G,valid);
    var content=el('div');box.appendChild(content);
    var offset=0;
    function render(){
      if(!valid()){content.textContent='世界已变化，请重新打开御案。';return;}
      content.replaceChildren();
      var data=TM.ReliefGovernance.list(G,{offset:offset,limit:12});
      data.warnings.forEach(function(w){content.appendChild(el('p',w,'color:#e0a87f;font-size:.85rem;'));});
      if(!data.total)content.appendChild(el('p','尚无赈务相关原文书记录；草稿未提交不会被当成已发旨意。','font-size:.82rem;color:var(--txt-d);'));
      data.entries.forEach(function(entry){
        var item=el('details',null,'border-top:1px solid #65512f;padding:.5rem 0;');item.dataset.reliefSource=entry.key;
        item.appendChild(el('summary',entry.channelLabel+' · '+entry.title+' ｜ '+entry.status,'cursor:pointer;font-size:.88rem;line-height:1.8;'));
        item.addEventListener('toggle',function(){if(!item.open||item.dataset.built)return;item.dataset.built='1';
          var result=TM.ReliefGovernance.resolve(G,entry);
          if(!result.ok){item.appendChild(el('p','原文书或世界已变化，请刷新履行单。'));return;}
          renderEntry(item,result.entry);
        });content.appendChild(item);
      });
      var controls=el('div',null,'display:flex;gap:.5rem;align-items:center;margin-top:.5rem;');content.appendChild(controls);
      controls.appendChild(el('small','共 '+data.total+' 条原记录'));
      controls.appendChild(button('刷新原记录',render));
      if(offset)controls.appendChild(button('上一页',function(){offset=Math.max(0,offset-12);render();}));
      if(offset+12<data.total)controls.appendChild(button('下一页',function(){offset+=12;render();}));
    }
    render();var scroll=panel.lastElementChild;scroll.insertBefore(box,scroll.firstChild);
  }
  function mountDetail(panel,id){
    var issue=(global.GM&&global.GM.currentIssues||[]).find(function(i){return i&&i.id===id;});
    if(!issue||!issue.relief||issue.relief.version!==1)return;
    var message=el('p','旧版独立试验案，仅保留历史数据；本页不再提供独立立案、拨款或撤止。请先核对原流水，勿重复支付。','padding:1rem;color:#e0a87f;line-height:1.8;');
    message.dataset.reliefLegacy='true';panel.lastElementChild.prepend(message);
  }
  TM.ReliefGovernanceUI={mountToolbar:mountToolbar,mountDetail:mountDetail};
})(typeof window!=='undefined'?window:globalThis);
