'use strict';
// Actual native game, full SC1 writeback, visible production tree and real desktop save/load.
// Controlled model payloads only; no player profile or external provider is accessed.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
module.exports = async function ({ win, root, check }) {
  const js = async code => {
    const r = await win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,value:await(${code})};}catch(e){return{ok:false,error:String(e.stack||e)};}})()`, true);
    if (!r.ok) throw Error(r.error); return r.value;
  };
  const file = path.join(root, 'scenarios/天启七年·九月（官方）.json'), bytes = fs.readFileSync(file), scenario = JSON.parse(bytes.toString('utf8'));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  await check('office production contract, writer and natural edict bridge are really loaded', async () => {
    assert.equal(await js(`typeof TM.OfficeCreation.prepare==='function'&&typeof applyReformToTree==='function'&&typeof EdictParser.executeOfficeCreation==='function'&&typeof TM.Endturn.AI.apply.writeBack==='function'`), true);
  });
  await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();TM_Changelog.close();
    const source=JSON.parse(${JSON.stringify(JSON.stringify(scenario))});P.scenarios=[source];P.ai={key:'',url:'',model:''};P.conf=P.conf||{};
    P.conf.officeActivationEnabled=false;P.conf.officeReformAdjudicationEnabled=false;doActualStart(source.id);
    window.__officeTest={source:JSON.stringify(source),sourceObject:source,errors:[]};addEventListener('error',e=>__officeTest.errors.push(e.message));
    const person=GM.chars.find(c=>c&&c.alive!==false&&!c.isPlayer&&c.name!==GM.playerInfo.characterName);if(!person)throw Error('no actual official fixture person');
    __officeTest.person=person.name;__officeTest.parent=(GM.officeTree.find(n=>n.name==='户部')||GM.officeTree[0]).name;
    TMPhase8FormalBridge.refresh();await document.fonts.ready;
    for(const button of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button')){if(['开始临朝','知道了'].includes(button.textContent))button.click();}})()`);
  win.show(); win.focus();
  assert(win.isVisible(), 'native visual acceptance must use an actually visible window');
  await check('full production SC1 writeback creates a department, establishments and an actual incumbent', async () => {
    const r = await js(`(async()=>{const payload={office_changes:[{action:'reform',reformDetail:'增设',dept:'实测文书署',positions:[{name:'实测校书郎',rank:'正六品',count:2}]},{action:'appoint',dept:'实测文书署',position:'实测校书郎',person:__officeTest.person,reason:'隔离回归测试'}]};
      await TM.Endturn.AI.apply.writeBack({results:{sc1:payload},prompt:{sc:__officeTest.sourceObject}});renderOfficeTree(true);
      const n=GM.officeTree.find(n=>n.name==='实测文书署'),p=n&&n.positions.find(p=>p.name==='实测校书郎');return{node:!!n,id:n&&n.id,post:p&&{name:p.name,count:p.establishedCount,holder:p.holder},person:__officeTest.person,sourceSame:JSON.stringify(__officeTest.sourceObject)===__officeTest.source};})()`);
    assert(r.node && r.id); assert.equal(r.post.count, 2); assert.equal(r.post.holder, r.person); assert(r.sourceSame);
  });
  await check('issued natural-language creation makes nested department and post in the same real tree', async () => {
    const r = await js(`(()=>{const a=EdictParser.tryExecute(__officeTest.parent+'下设实测税核司，正五品，掌钱粮簿籍。',{},{}),b=EdictParser.tryExecute('在实测税核司增设实测稽核官二人，正七品，掌账簿。',{},{});
      const parent=GM.officeTree.find(n=>n.name===__officeTest.parent),n=(parent.subs||[]).find(n=>n.name==='实测税核司');__officeTest.nodeId=n&&n.id;
      return{first:a.ok,second:b.ok,nested:!!n,post:n&&n.positions.map(p=>({name:p.name,count:p.establishedCount})),money:GM.guoku.balance};})()`);
    assert(r.first && r.second && r.nested, JSON.stringify(r)); assert(r.post.some(p => p.name === '实测稽核官' && p.count === 2));
  });
  await check('the actual player-facing standalone office tree renders the new departments and post text', async () => {
    const r = await js(`(async()=>{TMPhase8FormalBridge.openPanel('archive');await new Promise(r=>setTimeout(r,120));const panel=document.getElementById('office-tree');
      function department(name){return [...panel.querySelectorAll('.og-v10-dept')].find(n=>n.querySelector('.og-v10-dept-name')?.textContent===name);}
      for(const name of [__officeTest.parent,'实测税核司','实测文书署']){const node=department(name),button=node&&node.querySelector('button[title="展开"]');if(button){button.click();await new Promise(r=>requestAnimationFrame(r));}}
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const post=[...panel.querySelectorAll('.og-v10-pos,.og-pos-card')].find(n=>n.textContent.includes('实测稽核官'));
      const scroller=document.getElementById('gt-office');scroller.scrollTo({top:scroller.scrollHeight,behavior:'instant'});await new Promise(r=>setTimeout(r,150));
      if(post)post.scrollIntoView({block:'center',inline:'center',behavior:'instant'});await new Promise(r=>setTimeout(r,150));
      const geometry=[];for(let n=post;n;n=n.parentElement){const b=n.getBoundingClientRect();geometry.push({id:n.id,cls:n.className,top:b.top,height:b.height,scroll:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,overflow:getComputedStyle(n).overflowY});}
      const pb=post&&post.getBoundingClientRect(),hit=pb&&document.elementFromPoint(pb.left+pb.width/2,pb.top+pb.height/2);
      const box=panel.getBoundingClientRect();return{shown:document.body.classList.contains('tm-phase8-office-single')&&box.width>0&&box.height>0,hasDept:!!department('实测文书署'),hasChild:!!department('实测税核司'),hasPost:!!post,visiblePost:!!(post&&hit&&post.contains(hit)),geometry,text:panel.textContent.slice(0,700)};})()`);
    fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'office-tree-geometry.json'), JSON.stringify(r.geometry, null, 2));
    fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'office-real-tree.png'), (await win.webContents.capturePage()).toPNG());
    assert(r.shown && r.hasDept && r.hasChild && r.hasPost && r.visiblePost, JSON.stringify(r));
  });
  await check('the rendered nested post opens its real appointment picker with the exact target path', async () => {
    const r = await js(`(()=>{const post=[...document.querySelectorAll('#office-tree .og-v10-pos')].find(n=>n.textContent.includes('实测稽核官'));
      const button=post&&[...post.querySelectorAll('button')].find(n=>n.textContent.replace(/\\s/g,'')==='任命');if(!button)throw Error('actual appointment button missing');button.click();
      const picker=_OFF_PICKER,modal=document.getElementById('off-picker-modal');const result={open:!!modal,path:picker&&picker.pathArr,dept:picker&&picker.deptName,post:picker&&picker.posName,same:picker&&getOffNode(picker.pathArr)===picker.pos};
      const close=modal&&modal.querySelector('button[aria-label="关闭"]');if(close)close.click();return result;})()`);
    assert(r.open && r.same, JSON.stringify(r)); assert.equal(r.dept, '实测税核司'); assert.equal(r.post, '实测稽核官'); assert(r.path.includes('s') && r.path.includes('p'));
  });
  await check('real desktop serialization, disk roundtrip and fullLoadGame preserve the created structure', async () => {
    const r = await js(`(async()=>{const state=_buildSaveState({format:'project',detach:true});const saved=await tianming.saveProject('官制写回隔离测试',state);if(!saved.success)throw Error(saved.error||'save failed');
      const list=await tianming.listSaves(),row=list.files.find(r=>r.storageKey===saved.storageKey);if(!row)throw Error('saved storageKey not listed');const loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error||'load failed');
      await fullLoadGame(loaded.data,{source:'office-regression',preserveTimeline:true});let hit=null;(function walk(ns){for(const n of ns||[]){if(n.id===__officeTest.nodeId)hit=n;walk(n.subs);}})(GM.officeTree);
      return{saved:saved.success,loaded:loaded.success,linked:!!hit,post:hit&&hit.positions.some(p=>p.name==='实测稽核官'&&p.establishedCount===2),pending:!!GM._loadHydrationPending};})()`);
    assert(r.saved && r.loaded && r.linked && r.post && !r.pending, JSON.stringify(r));
  });
  await check('reissuing after full load is idempotent and does not repeat the institution expense', async () => {
    const r = await js(`(()=>{const before=GM.guoku.balance;const r=EdictParser.tryExecute(__officeTest.parent+'下设实测税核司，正五品，掌钱粮簿籍。',{},{});let count=0;(function walk(ns){for(const n of ns||[]){if(n.id===__officeTest.nodeId)count++;walk(n.subs);}})(GM.officeTree);return{ok:r.ok,count,moneySame:GM.guoku.balance===before,errors:__officeTest.errors};})()`);
    assert(r.ok && r.moneySame); assert.equal(r.count, 1); assert.deepEqual(r.errors, []);
  });
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash, 'official source file is unchanged');
};
