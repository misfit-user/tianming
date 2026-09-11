'use strict';
// Real editor buttons, provider and IPC. Only the remote relay is controlled.
const assert = require('assert/strict');
module.exports = async function({ win, js, until, click, test }) {
  await js(`(()=>{
    window.__recoveryRelay={mode:'empty',round:0,packets:[]};
    window.fetch=async function(url,init){
      if(String(url)!=='https://relay.invalid/v1/chat/completions')throw Error('test-external-network-denied');
      const b=JSON.parse(init.body),p=__recoveryRelay,names=(b.tools||[]).map(t=>t.function.name);
      const tc=(name,input)=>({id:name+'-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}});
      const out=(calls=[],reason='tool_calls',content='',thinking)=>new Response(JSON.stringify({choices:[{message:{content,tool_calls:calls,reasoning_content:thinking},finish_reason:reason}]}));
      if(names.length===1&&names[0]==='setTitle')return out([tc('setTitle',{title:'隔离响应恢复'})]);
      if(names.length===1&&names[0]==='selectMemories')return out([tc('selectMemories',{names:[]})]);
      p.round++;p.packets.push({native:!!b.tools,budget:b.max_tokens,choice:b.tool_choice,emptyAssistant:b.messages.some(m=>m.role==='assistant'&&!m.content&&!m.reasoning_content&&!m.tool_calls)});
      const finish=tc('finish',{summary:'完成本阶段核验'}),edit=tc('applyPush',{path:'labels',value:{name:'once',text:'已生成草稿'}});
      if(p.mode==='choice'&&b.tool_choice!==undefined)return new Response('Thinking mode does not support this tool_choice',{status:400});
      if(p.mode==='choice')return out([edit,finish]);
      if(p.round===1)return out([edit],'tool_calls','','SYNTHETIC_PRIVATE_REASONING');
      if(p.phase==='ready')return out([finish]);
      if(p.mode==='empty'&&p.round===2)return out([],null);
      if(p.mode==='empty')return out([finish]);
      if(p.mode==='fallback'&&p.round===2)return out([],'stop','继续核验');
      if(p.mode==='length')return out([tc('applyEdit',{path:'name',value:'不得执行截断前缀'})],'length','','SYNTHETIC_PRIVATE_REASONING');
      return out([],null);
    };
  })()`);
  async function fresh(mode) {
    await click(`document.getElementById('tm-aa-newchat')`);
    await js(`(()=>{TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:'response-'+${JSON.stringify(mode)},name:'响应恢复隔离案卷',labels:[],characters:[],factions:[],customPrompt:'保留手工输入'},'响应恢复隔离案卷');__recoveryRelay={mode:${JSON.stringify(mode)},round:0,packets:[]};TM_AuthoringAgentUI.permMode('review');TM_AuthoringAgentUI._ui.els.req.value='增加 once 条目后检查并收尾，不要重复新增';})()`);
    await click(`TM_AuthoringAgentUI._ui.els.go`);
    await until(`!TM_AuthoringAgentUI._ui.running && __recoveryRelay.round>0`);
  }
  const read = () => js(`(()=>{const u=TM_AuthoringAgentUI._ui;return{packets:__recoveryRelay.packets,round:__recoveryRelay.round,status:u._completion.status,recovery:!!u._recovery,live:u.adapter.getScenario(),draft:u.draft,summary:u.els.summary.textContent};})()`);
  await test('real UI transient empty response returns to native tools and only approval saves the single append', async () => {
    await fresh('empty'); const r=await read();
    assert.equal(r.round,3); assert(r.packets.every(p=>p.native&&!p.emptyAssistant)); assert.equal(r.status,'completed');
    assert.equal(r.live.labels.length,0); assert.equal(r.draft.labels.length,1); assert(!r.summary.includes('SYNTHETIC_PRIVATE'));
    await click(`TM_AuthoringAgentUI._ui.els.apply`);
    const saved=await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,p=await app.saveProjectSnapshot('响应恢复阶段稿');await app.loadProjectSnapshot(p.id);return app.state.scenario;})()`);
    assert.deepEqual(saved.labels,[{name:'once',text:'已生成草稿'}]); assert.equal(saved.customPrompt,'保留手工输入');
  });
  await test('real UI exhausted empty compatibility returns to proven native; mouse continuation does not replay writes', async () => {
    await fresh('fallback'); const first=await read(); assert.equal(first.round,4); assert.equal(first.status,'blocked'); assert(first.recovery);
    assert.deepEqual(first.packets.map(p=>p.native),[true,true,false,true]); assert.equal(first.live.labels.length,0); assert.equal(first.draft.labels.length,1);
    await js(`__recoveryRelay.phase='ready'`); await click(`TM_AuthoringAgentUI._ui.els.summary.querySelector('.ec-retry')`);
    await until(`!TM_AuthoringAgentUI._ui.running && __recoveryRelay.round>4`);
    const r=await read(); assert.equal(r.round,5); assert(r.packets.at(-1).native); assert.equal(r.status,'completed'); assert.equal(r.draft.labels.length,1); assert.equal(r.live.labels.length,0);
  });
  await test('real UI length limit is not no-tools; manual continuation retains the last budget and pending draft', async () => {
    await fresh('length'); const first=await read(); assert.equal(first.round,4); assert.equal(first.status,'blocked'); assert.match(first.summary,/输出.*截断/);
    assert(first.packets.every(p=>p.native)); assert.deepEqual(first.packets.map(p=>p.budget),[3000,3000,6000,16000]);
    assert.equal(first.draft.name,'响应恢复隔离案卷'); assert.equal(first.draft.labels.length,1); assert.equal(first.live.labels.length,0);
    await js(`__recoveryRelay.phase='ready'`); await click(`TM_AuthoringAgentUI._ui.els.summary.querySelector('.ec-retry')`);
    await until(`!TM_AuthoringAgentUI._ui.running && __recoveryRelay.round>4`);
    const r=await read(); assert.equal(r.round,5); assert.equal(r.packets.at(-1).budget,16000); assert.equal(r.status,'completed'); assert.equal(r.draft.labels.length,1);
  });
  await test('real UI repairs explicit auto rejection without dropping tools or changing thinking mode', async () => {
    await fresh('choice'); const r=await read(); assert.equal(r.round,2); assert(r.packets.every(p=>p.native)); assert.equal(r.packets[1].choice,undefined); assert.equal(r.status,'completed'); assert.equal(r.live.labels.length,0); assert.equal(r.draft.labels.length,1);
  });
};
