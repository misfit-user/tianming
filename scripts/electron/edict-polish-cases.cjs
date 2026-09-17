'use strict';
// Real production panel/transport in sandbox Electron; controlled HTTP only.
// Button.click is a DOM integration test, not a physical mouse measurement.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function({ win, temp, check }) {
  const js = source => win.webContents.executeJavaScript(source, true);
  await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();})()`);
  await check('edict-production-fixture-and-real-panel', async () => {
    assert.equal(await js(`(()=>{
      P.ai={key:'fixture-primary-key',url:'https://primary.invalid/v1',model:'gpt-4o',secondary:{key:'fixture-secondary-key',url:'https://secondary.invalid/v1',model:'deepseek-reasoner'}};
      P.conf=P.conf||{};P.conf.secondaryEnabled=true;
      GM={sid:'edict-fixture',turn:2,_campaignId:'edict-fixture-c',_timelineId:'edict-fixture-t',chars:[],facs:[],rels:{},vars:{},edicts:[],_edictSuggestions:[]};
      window.__edictTest={mode:'thinking',requests:[],clicks:0};
      window.fetch=async function(url,init){
        if(!String(url).startsWith('https://secondary.invalid/'))throw Error('test-external-network-denied');
        const b=JSON.parse(init.body);__edictTest.requests.push({model:b.model,maxTokens:b.max_tokens,prompt:b.messages[0].content});
        if(__edictTest.mode==='auth')return new Response(JSON.stringify({error:{message:'Unauthorized fixture-secondary-key'}}),{status:401});
        const short=__edictTest.mode==='thinking'&&__edictTest.requests.length===1;
        const content=short?null:__edictTest.mode==='empty'?'':__edictTest.mode==='blocks'?[{type:'thinking',text:'PRIVATE THOUGHT'},{type:'text',text:'诏曰：免灾区徭役，开仓赈济。'}]:'诏曰：免灾区徭役，开仓赈济。';
        return new Response(JSON.stringify({choices:[{finish_reason:short?'length':'stop',message:{content,reasoning_content:short?'PRIVATE THOUGHT':null}}]}),{headers:{'Content-Type':'application/json'}});
      };
      TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();
      const root=document.getElementById('tm-action-edict-overlay');
      root.querySelector('#edict-pol').value='免灾区徭役，开仓赈济。';
      root.querySelector('.act-polish').addEventListener('click',()=>__edictTest.clicks++);
      return !!root&&typeof callAI==='function'&&typeof _polishEdicts==='function';
    })()`), true);
  });
  win.show();
  const settle = async () => js(`(async()=>{const start=Date.now();while(_polishEdicts._pending){if(Date.now()-start>20000)throw Error('edict-polish-did-not-settle');await new Promise(r=>setTimeout(r,25));}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  const trigger = async mode => { await js(`_hidePolishedEdict();__edictTest.mode=${JSON.stringify(mode)};__edictTest.requests=[];document.querySelector('#tm-action-edict-overlay .act-polish').click();`); await settle(); };
  const visible = async () => {
    await js(`Promise.all(_edictEl('edict-polished').getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))`);
    const r = await js(`(()=>{const p=_edictEl('edict-polished'),card=p.querySelector('.ed-polish-card'),r=card.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),s=getComputedStyle(card);return {width:r.width,height:r.height,hit:t===card||card.contains(t),top:t&&t.className,display:s.display,opacity:s.opacity,color:s.color,background:s.backgroundColor};})()`);
    assert(r.width > 0 && r.height > 0 && r.hit && r.display !== 'none' && Number(r.opacity) > 0.9, JSON.stringify(r));
  };
  await check('edict-real-button-recovers-reasoning-truncation', async () => {
    await trigger('thinking');
    const r = await js(`({text:_edictEl('edict-polished-text')?.value,requests:__edictTest.requests,disabled:document.querySelector('#tm-action-edict-overlay .act-polish').disabled,clicks:__edictTest.clicks})`);
    assert.equal(r.text, '诏曰：免灾区徭役，开仓赈济。'); assert.equal(r.requests.length, 2); assert(r.requests[1].maxTokens > r.requests[0].maxTokens && r.requests[1].maxTokens <= 8000);
    assert.equal(r.requests[0].prompt, r.requests[1].prompt); assert.equal(r.disabled, false); assert.equal(r.clicks, 1);
  });
  await check('edict-complete-result-is-visible', visible);
  fs.writeFileSync(path.join(temp, 'edict-success.png'), (await win.webContents.capturePage()).toPNG());
  await check('edict-raw-intent-kept-and-not-automatically-published', async () => assert.equal(await js(`_edictEl('edict-pol').value==='免灾区徭役，开仓赈济。'&&GM.edicts.length===0`), true));
  await check('edict-empty-reply-shows-explicit-actionable-failure', async () => {
    await trigger('empty'); const r = await js(`({code:_edictEl('edict-polished').dataset.errorCode,text:_edictEl('edict-polished').textContent,count:__edictTest.requests.length,hasDraft:!!_edictEl('edict-polished-text')})`);
    assert.equal(r.code, 'ai-text-empty'); assert(r.text.includes('次 API') && r.text.includes('重试润色')); assert.equal(r.count, 1); assert.equal(r.hasDraft, false);
  });
  await check('edict-failure-card-is-visible', visible);
  await check('edict-retry-and-return-buttons-not-covered-by-backdrop', async () => {
    assert.equal(await js(`Array.from(_edictEl('edict-polished').querySelectorAll('button')).every(b=>{const r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(t===b||b.contains(t));})`), true);
    assert.equal(await js(`_edictEl('edict-polished').querySelectorAll('button').length`), 2);
  });
  fs.writeFileSync(path.join(temp, 'edict-empty.png'), (await win.webContents.capturePage()).toPNG());
  await check('edict-real-retry-button-restores-answer', async () => {
    await js(`__edictTest.mode='blocks';__edictTest.requests=[];_edictEl('edict-polished').querySelector('button').click();`); await settle();
    assert.equal(await js(`_edictEl('edict-polished-text').value`), '诏曰：免灾区徭役，开仓赈济。'); assert.equal(await js(`_edictEl('edict-polished').textContent.includes('PRIVATE THOUGHT')`), false);
  });
  await check('edict-auth-failure-does-not-expose-provider-echo', async () => {
    await trigger('auth'); const text = await js(`_edictEl('edict-polished').textContent`); assert(text.includes('401')); assert(!text.includes('fixture-secondary-key'));
  });
  await check('edict-late-response-after-hide-cannot-reopen', async () => {
    await js(`window.__edictRelease=null;window.fetch=async()=>{await new Promise(r=>window.__edictRelease=r);return new Response(JSON.stringify({choices:[{message:{content:'过期结果'},finish_reason:'stop'}]}));};document.querySelector('#tm-action-edict-overlay .act-polish').click();`);
    await js(`(async()=>{const start=Date.now();while(!window.__edictRelease){if(Date.now()-start>5000)throw Error('request not started');await new Promise(r=>setTimeout(r,20));}_hidePolishedEdict();__edictRelease();})()`);
    await new Promise(r => setTimeout(r, 100));
    assert.equal(await js(`_edictEl('edict-polished').style.display==='none'&&!_edictEl('edict-polished').textContent.includes('过期结果')`), true);
  });
};
