'use strict';
// Real production renderer/DOM/button handler, controlled HTTP responses. This
// is an integration regression, not a live DeepSeek call or physical mouse test.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function({ win, temp, check }) {
  const js = source => win.webContents.executeJavaScript(source, true);
  win.show();
  await check('building-production-modules', async () => assert.equal(await js(`typeof _dfBuildModal==='function' && typeof _dfAppraiseCustomBuild==='function' && typeof callAIWithTools==='function' && !!TM.CustomBuildAgent && !!TM.BuildingWorks`), true));
  // New isolated profiles have an unrelated unread-changelog popup scheduled
  // 500 ms after local metadata resolves. Dismiss via its production read/close
  // API before opening the feature under test; never activate "apply update".
  await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();})()`);
  await js(`(()=>{
    P.ai={key:'test-primary-only',url:'https://primary.invalid/v1',model:'gpt-4o',temp:0.2,secondary:{key:'test-secondary-only',url:'https://api.deepseek.com/v1',model:'deepseek-v4-flash'}};
    P.conf=P.conf||{}; P.conf.customBuildAgentRounds=1;
    GM={turn:2,_campaignId:'appraisal-fixture',_timelineId:'appraisal-fixture',vars:{},chars:[],facs:[],memorials:[],guoku:{money:100000},adminHierarchy:{test:{divisions:[{name:'测试府',buildings:[],economyBase:{commerceVolume:50000},populationDetail:{mouths:100000}}]}}};
    P.adminHierarchy=GM.adminHierarchy;
    window.__appraisalTest={mode:'success',requests:[],clicks:0};
    window.fetch=async function(url,init){
      if(!['https://api.deepseek.com/v1/chat/completions','https://primary.invalid/v1/chat/completions'].includes(String(url))) throw Error('test-external-network-denied');
      const b=JSON.parse(init.body);__appraisalTest.requests.push({url:String(url),body:b});
      if(__appraisalTest.mode==='hold') await new Promise(resolve=>(__appraisalTest.held||=[]).push(resolve));
      const http=(status,message)=>new Response(JSON.stringify({error:{message}}),{status,headers:{'Content-Type':'application/json'}});
      if(__appraisalTest.mode==='auth')return http(401,'Unauthorized');
      if(b.tools&&Object.prototype.hasOwnProperty.call(b,'tool_choice'))return http(400,'Thinking mode does not support this tool_choice');
      const result={choices:[{finish_reason:'stop',message:{content:'普通问对正常回答'}}]};
      if(__appraisalTest.mode==='empty')result.choices[0].message.content='尚待勘议';
      else if(b.tools){
        const critic=b.tools.some(t=>t.function.name==='critique');
        result.choices[0].message={content:'',tool_calls:[{id:'controlled-call',type:'function',function:{name:critic?'critique':'submit_appraisal',arguments:JSON.stringify(critic?{sound:true,effectScale:1,minTimeActual:0,note:'允当'}:{feasibility:'合理',costActual:50000,timeActual:4,effectsStructured:{pct:{'economyBase.commerceVolume':0.9,invalidPath:1}},judgedEffects:'藏书育才',reason:'<img src=x onerror=window.__xss=1> 据本地条件核定'})}}]};
      }
      return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
    };
    _dfBuildModal('测试府');_dfBuildTab('cus');
    document.getElementById('_bmCustName').value='崇文馆';document.getElementById('_bmCustCat').value='cultural';document.getElementById('_bmCustDesc').value='召集学士修订典籍';
    document.getElementById('_bmAppraise').addEventListener('click',()=>__appraisalTest.clicks++);
  })()`);
  await check('building-modal-is-visible', async () => {
    const r = await js(`(()=>{const m=document.getElementById('_dfBuildModal'),b=document.getElementById('_bmAppraise'),r=b.getBoundingClientRect(),s=getComputedStyle(m),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {display:s.display,visibility:s.visibility,z:s.zIndex,width:r.width,height:r.height,hit:top===b||b.contains(top),topId:top&&top.id,topClass:top&&top.className,body:document.body.className};})()`);
    assert(r.width > 0 && r.height > 0 && r.hit && r.display !== 'none' && r.visibility !== 'hidden', JSON.stringify(r));
  });
  await check('building-plain-ai-control', async () => assert.equal(await js(`callAI('普通问对',100,null,'secondary')`), '普通问对正常回答'));
  const trigger = async mode => {
    await js(`__appraisalTest.mode=${JSON.stringify(mode)};__appraisalTest.requests=[];window._dfPendingAppraisal=null;document.getElementById('_bmAppraise').click();`);
    await js(`(async()=>{const start=Date.now();while(document.getElementById('_bmAppraise').disabled){if(Date.now()-start>12000)throw Error('appraisal-button-did-not-settle');await new Promise(r=>setTimeout(r,25));}})()`);
  };
  const resultVisible = async () => {
    await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const r = await js(`(()=>{const b=document.getElementById('_bmAppraiseResult'),r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,hit:t===b||b.contains(t),topId:t&&t.id,topClass:t&&t.className};})()`);
    assert(r.width > 0 && r.height > 0 && r.hit, JSON.stringify(r));
  };
  await check('building-real-button-thinking-response', async () => {
    await trigger('success');
    const r = await js(`({clicks:__appraisalTest.clicks,html:document.getElementById('_bmAppraiseResult').innerHTML,pending:_dfPendingAppraisal,disabled:document.getElementById('_bmAppraise').disabled,requests:__appraisalTest.requests})`);
    assert.equal(r.clicks, 1); assert.equal(r.disabled, false); assert(r.html.includes('有司核议：合理'));
    assert.equal(r.pending.req.name, '崇文馆'); assert.equal(r.pending.appraisal.costActual, 50000);
    assert.equal(r.requests.length, 2); assert(r.requests.every(x => x.url.startsWith('https://api.deepseek.com/') && !Object.hasOwn(x.body, 'tool_choice') && !Object.hasOwn(x.body, 'thinking')));
  });
  await check('building-real-hard-gates-and-text-escaping', async () => {
    const r = await js(`({fx:_dfPendingAppraisal.appraisal.effectsStructured,images:document.querySelectorAll('#_bmAppraiseResult img').length,xss:window.__xss||0,money:GM.guoku.money,buildings:GM.adminHierarchy.test.divisions[0].buildings.length})`);
    assert(r.fx.pct['economyBase.commerceVolume'] < 0.9); assert(!Object.hasOwn(r.fx.pct, 'invalidPath'));
    assert.equal(r.images, 0); assert.equal(r.xss, 0); assert.equal(r.money, 100000); assert.equal(r.buildings, 0);
  });
  await check('building-success-result-visible', resultVisible);
  fs.writeFileSync(path.join(temp, 'building-success.png'), (await win.webContents.capturePage()).toPNG());
  await check('building-real-failure-feedback-and-retry-button', async () => {
    await trigger('auth');
    const r = await js(`({html:document.getElementById('_bmAppraiseResult').innerHTML,disabled:document.getElementById('_bmAppraise').disabled,name:document.getElementById('_bmCustName').value,requests:__appraisalTest.requests.length})`);
    assert(r.html.includes('401') && /密钥|权限/.test(r.html)); assert(!r.html.includes('no-appraisal')); assert(!r.html.includes('准 奏 开 工'));
    assert.equal(r.disabled, false); assert.equal(r.name, '崇文馆'); assert.equal(r.requests, 2);
  });
  await check('building-failure-result-visible', resultVisible);
  fs.writeFileSync(path.join(temp, 'building-failure.png'), (await win.webContents.capturePage()).toPNG());
  await check('building-real-no-result-is-not-success', async () => {
    await trigger('empty'); const html=await js(`document.getElementById('_bmAppraiseResult').innerHTML`);
    assert(html.includes('未提交可用的结构化核议')); assert(!html.includes('准 奏 开 工'));
  });
  await check('building-real-retry-recovers-with-proposal-intact', async () => {
    await trigger('success');
    assert.equal(await js(`!!_dfPendingAppraisal && _dfPendingAppraisal.req.description==='召集学士修订典籍' && document.getElementById('_bmAppraiseResult').innerHTML.includes('有司核议：合理') && GM.guoku.money===100000`), true);
  });
  await check('building-appraisal-action-only-enqueues-original-edict', async () => {
    const r = await js(`(()=>{const b=document.querySelector('#_bmAppraiseResult button');if(!b||!b.textContent.includes('核 议 建 议'))throw Error('proposal-button-missing');b.click();return {money:GM.guoku.money,buildings:P.adminHierarchy.test.divisions[0].buildings.length,suggestions:GM._edictSuggestions,modal:!!document.getElementById('_dfBuildModal'),pending:!!window._dfPendingAppraisal};})()`);
    assert.equal(r.money, 100000); assert.equal(r.buildings, 0); assert.equal(r.modal, false); assert.equal(r.pending, false);
    assert.equal(r.suggestions.length, 1); assert(r.suggestions[0].content.includes('50000') && r.suggestions[0].content.includes('economyBase.commerceVolume'));
  });
  await check('building-formal-adoption-and-real-turn-input-preserve-reference', async () => {
    await js(`TMPhase8FormalBridge.clearEdictDrafts();TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const r = await js(`(()=>{const b=document.querySelector('.tm-desk-overlay .edict-sug-adopt');if(!b)throw Error('formal-suggestion-missing');const rect=b.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);if(!(rect.width>0&&rect.height>0&&(hit===b||b.contains(hit))))throw Error('formal-suggestion-not-clickable');b.click();const menu=document.getElementById('_edictAdoptMenu');menu.querySelectorAll('button')[3].click();const input=_endTurn_collectInput();return {economic:input.edicts.economic,money:GM.guoku.money,buildings:P.adminHierarchy.test.divisions[0].buildings.length,tracked:GM._edictTracker.some(t=>t.content.includes('economyBase.commerceVolume'))};})()`);
    assert(r.economic.includes('50000') && r.economic.includes('economyBase.commerceVolume')); assert.equal(r.tracked, true);
    assert.equal(r.money, 100000); assert.equal(r.buildings, 0);
    await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    fs.writeFileSync(path.join(temp, 'building-original-edict.png'), (await win.webContents.capturePage()).toPNG());
    await js(`TMPhase8FormalBridge.drafts.closeDeskOverlay()`);
  });
  await check('building-original-write-tool-pays-only-at-formal-execution', async () => {
    const r = await js(`(async()=>{const spec={action:'start',region:'测试府',name:'崇文馆',category:'cultural',cost:50000,turns:4,effectsStructured:{abs:{'economyBase.commerceVolume':1000}}};const first=await TM.Endturn.AgentWriteTools.handle('building_project',spec,{GM});const second=await TM.Endturn.AgentWriteTools.handle('building_project',spec,{GM});return {first:first.ok,second:second.ok,money:GM.guoku.money,balance:GM.guoku.balance,stock:GM.guoku.ledgers.money.stock,buildings:P.adminHierarchy.test.divisions[0].buildings.length};})()`);
    assert.equal(r.first, true); assert.equal(r.second, false); assert.equal(r.money, 50000); assert.equal(r.balance, r.money); assert.equal(r.stock, r.money); assert.equal(r.buildings, 1);
  });
  await check('building-real-close-cancels-and-reopened-world-keeps-only-new-reply', async () => {
    await js(`(()=>{
      window.__openBuildingFixture=(name)=>{_dfBuildModal('测试府');_dfBuildTab('cus');document.getElementById('_bmCustName').value=name;document.getElementById('_bmCustCat').value='cultural';document.getElementById('_bmCustDesc').value='修订典籍';};
      __appraisalTest.mode='hold';__appraisalTest.held=[];__openBuildingFixture('旧局工程');document.getElementById('_bmAppraise').click();
    })()`);
    const waitHeld = async count => js(`(async()=>{const start=Date.now();while(__appraisalTest.held.length<${count}){if(Date.now()-start>12000)throw Error('held-request-missing');await new Promise(r=>setTimeout(r,20));}})()`);
    await waitHeld(1);
    await js(`(()=>{document.querySelector('#_dfBuildModal .tmjz-x').click();GM=Object.assign({},GM,{_timelineId:'new-world',_edictSuggestions:[]});P=Object.assign({},P);__openBuildingFixture('新局工程');document.getElementById('_bmAppraise').click();})()`);
    await waitHeld(2);
    await js(`__appraisalTest.mode='success';__appraisalTest.held[1]();`);
    await js(`(async()=>{const start=Date.now();while(document.getElementById('_bmAppraise').disabled){if(Date.now()-start>12000)throw Error('new-result-missing');await new Promise(r=>setTimeout(r,20));}})()`);
    await js(`__appraisalTest.held[0]();new Promise(r=>setTimeout(r,100))`);
    const r = await js(`({pending:_dfPendingAppraisal.req.name,html:document.getElementById('_bmAppraiseResult').textContent,money:GM.guoku.money})`);
    assert.equal(r.pending, '新局工程'); assert(r.html.includes('地方库银') && r.html.includes('不扣款')); assert.equal(r.money, 50000);
  });
  await check('building-real-input-change-invalidates-old-proposal', async () => {
    const r = await js(`(()=>{const old=document.querySelector('#_bmAppraiseResult button');const d=document.getElementById('_bmCustDesc');d.value='新规制';d.dispatchEvent(new Event('input',{bubbles:true}));old.click();return {pending:!!window._dfPendingAppraisal,suggestions:GM._edictSuggestions.length,retry:!document.getElementById('_bmAppraise').disabled,money:GM.guoku.money};})()`);
    assert.equal(r.pending, false); assert.equal(r.suggestions, 0); assert.equal(r.retry, true); assert.equal(r.money, 50000);
    await js(`_dfCloseBuildModal()`);
  });
  await require('./building-orders-cases.cjs')({win,temp,check});
};
