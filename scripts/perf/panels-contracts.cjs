'use strict';
const assert=require('assert/strict');
// Real DOM, full production providers and the real detached save/load boundary.
module.exports=async function({win,check,report}){
  const js=code=>win.webContents.executeJavaScript(code);
  await check('panel archive preserves every row, order and escaped content',async()=>{
    const r=await js(`(async()=>{TMPhase8FormalBridge.drafts.closeDeskOverlay();openZhao();const ov=document.querySelector('#tm-action-edict-overlay');const hidden=ov.querySelectorAll('.arc-body *').length;ov.querySelector('.head-right .link-btn').click();const body=ov.querySelector('.arc-body'),rows=[...body.querySelectorAll('.arc-item')];const html=body.innerHTML,hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html));return {hidden,count:rows.length,expected:GM._edictTracker.filter(e=>e.turn<GM.turn).length,first:rows[0]&&rows[0].textContent,last:rows.at(-1)&&rows.at(-1).textContent,sha:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join(''),shown:ov.querySelector('.arc-modal').classList.contains('show')};})()`);
    assert.equal(r.count,r.expected);assert.equal(r.shown,true);assert(r.first.includes('799'));assert(r.last.includes('0'));report.archive=r;
  });
  await check('edict close/reopen keeps input, selection and detached snapshot semantics',async()=>{
    const r=await js(`(()=>{const ov=document.querySelector('#tm-action-edict-overlay');ov.querySelector('.arc-x').click();const ids=['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth','xinglu-pub'];const values=ids.map((_,i)=>' 受控草稿 '+i+' < > e\u0301 😀 ');
      ids.forEach((id,i)=>{const el=ov.querySelector('#'+id);el.value=values[i];el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:values[i]}));});
      const focus=ov.querySelector('#edict-pol');focus.focus();focus.setSelectionRange(2,5);focus.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'测试'}));focus.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'测试'}));
      const stable=ov===document.querySelector('#tm-action-edict-overlay')&&document.activeElement===focus&&focus.selectionStart===2&&focus.selectionEnd===5;focus.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'测试'}));
      const before=JSON.stringify({GM,P}),g=GM,p=P;window.__panelProject=_buildSaveState({format:'project',detach:true});const idb=_buildSaveState({format:'idb',detach:true});const unchanged=before===JSON.stringify({GM,P})&&g===GM&&p===P;const projectDrafts=__panelProject.gameState._phase8FormalDrafts,idbDrafts=idb.GM._phase8FormalDrafts;
      ov.querySelector('[data-close-bridge]').click();openZhao();const next=document.querySelector('#tm-action-edict-overlay');return {stable,unchanged,values,restored:ids.map(id=>next.querySelector('#'+id).value),project:projectDrafts.edictDrafts.policy,idb:idbDrafts.edictDrafts.policy};})()`);
    // With the old overlay closed, deskValue uses the untrimmed persisted fallback.
    // The first harness incorrectly expected trim here; retain all six raw values.
    assert(r.stable);assert(r.unchanged);assert.deepEqual(r.restored,r.values);
    assert.equal(r.project,r.values[0]);assert.equal(r.idb,r.values[0]);
  });
  await check('project reload restores archived history and submitted draft source',async()=>{
    const r=await js(`(async()=>{await fullLoadGame(__panelProject,{source:'panel-regression'});await _tmAwaitLoadBarrier();openZhao();const v=document.querySelector('#tm-action-edict-overlay #edict-pol').value;const stored=GM._phase8FormalDrafts.edictDrafts.policy;TMPhase8FormalBridge.drafts.closeDeskOverlay();return {v,stored,history:GM._edictTracker.length};})()`);
    assert.equal(r.v,r.stored);assert(r.v.includes('受控草稿'));assert.equal(r.history,800);
  });
  for(const [name,method,selector] of [['memorial','openYueZou','[data-desk-memorial-reply]'],['letter','openHongyan','[data-letter-draft-field="body"]']]){
    await check(name+' close/reopen retains draft',async()=>{
      const r=await js(`(()=>{${method}();const ov=document.querySelector('.tm-desk-overlay'),el=ov.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing actual ${name} draft');el.value='受控'+${JSON.stringify(name)}+' 草稿 😀';el.dispatchEvent(new InputEvent('input',{bubbles:true}));const value=el.value;ov.querySelector('[data-close-bridge]').click();${method}();const restored=document.querySelector('.tm-desk-overlay').querySelector(${JSON.stringify(selector)}).value;TMPhase8FormalBridge.drafts.closeDeskOverlay();return {value,restored};})()`);
      assert.equal(r.value,r.restored);
    });
  }
};
