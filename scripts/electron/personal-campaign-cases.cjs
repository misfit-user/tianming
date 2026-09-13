'use strict';
// Real production entry, real SC18 block, iframe handshake, UI commands and final military writer.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,root,check}){
  const js=code=>win.webContents.executeJavaScript(code,true), delay=ms=>new Promise(r=>setTimeout(r,ms));
  const reportDir=path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  async function until(fn,label){const end=Date.now()+12000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(50);}throw Error('not reached: '+label);}
  async function click(frame,selector){await until(()=>frame.executeJavaScript(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b||b.disabled)return false;const r=b.getBoundingClientRect();if(!r.width||!r.height||!b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))return false;b.click();return true;})()`,true),'click '+selector);}
  async function clickText(text){await until(()=>js(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)return false;const r=b.getBoundingClientRect();if(!b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))return false;b.click();return true;})()`),'button '+text);}
  win.show();win.focus();assert(win.isVisible());
  await until(()=>js('!!(window.TMBattleTurn&&MilitarySystems._battleHookInstalled&&MilitarySystems.validateBattleResult)'), 'production contracts');
  const src=fs.readFileSync(path.join(root,'web/tm-endturn-followup.js'),'utf8'),start=src.indexOf('var _battleResultCasualtyFactions = {};'),end=src.indexOf('if (p18.supplementary_army_changes',start);
  assert(start>0&&end>start);const sc18=src.slice(start,end);
  await js(`(()=>{
    window.__campaignMessages=[];window.addEventListener('message',e=>{if(e.data&&/^battle/.test(e.data.type||''))__campaignMessages.push(e.data);});
    window.__campaignFixture=function(kind){
      GM={running:false,turn:10,chars:[{id:'emperor',name:'刘备',role:'皇帝',isPlayer:true,alive:true}],facs:[{id:'shu',name:'蜀汉'},{id:'wei',name:'曹魏'}],armies:[
        {id:'pa',name:'御营',faction:'蜀汉',commander:'刘备',soldiers:3000,morale:60,training:55,supply:80,quality:'普通',location:'汉中',composition:[{type:'步兵',count:3000}]},
        {id:'ea',name:'魏军',faction:'曹魏',commander:'敌将',soldiers:2500,morale:60,training:55,supply:80,quality:'普通',location:'汉中',composition:[{type:'步兵',count:2500}]}]};
      P.playerInfo={factionName:'蜀汉'};P.ai={};P.conf=P.conf||{};P.conf.deterministicCasualties=false;_tmSetYujiaQinzheng(true);TMBattleTurn._clear();
      const br={battleId:'native-'+kind,winnerFactionId:'蜀汉',loserFactionId:'曹魏',attackerArmyId:'pa',defenderArmyId:'ea',casualties:{attacker:300,defender:500},affectedArmies:[{armyId:kind==='name'?'御营':'pa',side:'attacker',loss:300},{armyId:kind==='name'?'魏军':'ea',side:'defender',loss:500}]};
      if(kind==='top')delete br.affectedArmies;
      window.__campaignBefore=JSON.parse(JSON.stringify(GM.armies));window.__campaignAbstract=br;
      window.__campaignBand=TMBattleResolve.predictBattleBand([GM.armies[0]],[GM.armies[1]],{GM:GM});
      const p18={battleResult:br};${sc18}
      window.__campaignDone=false;window.__campaignMessages=[];
      return{on:GM._yujiaQinzheng,rejected:!!p18._battleResultRejected,pending:TMBattleTurn._pending().length,soldiers:GM.armies.map(a=>a.soldiers)};
    };
  })()`);
  for(const kind of ['id','name','top']){
    await check(kind+' references enter pending without early casualty or occupation writes',async()=>{
      const queued=await js(`__campaignFixture(${JSON.stringify(kind)})`);assert(queued.on);assert(!queued.rejected);assert.equal(queued.pending,1);assert.deepEqual(queued.soldiers,[3000,2500]);
    });
    await js('window.__campaignMeeting=TMBattleTurn.runPending(GM).then(()=>{window.__campaignDone=true});void 0');
    await clickText('🐎 御驾亲征 · 会参其事');
    let frame;
    await check(kind+' real iframe acknowledges injected army roster without standalone startup',async()=>{
      const loaded=await until(async()=>{
        frame=win.webContents.mainFrame.frames.find(f=>/\/battle\/index\.html(?:[?#]|$)/.test(f.url.replaceAll('\\','/')));if(!frame)return false;
        try{return await frame.executeJavaScript(`(()=>{if(typeof _activeBattleConfig==='undefined'||!_activeBattleConfig||document.readyState!=='complete')return false;return{phase:state.phase,sideName:_activeBattleConfig.sideName,emperor:units.filter(u=>u.emperor).length,totals:['ming','jin'].map(s=>units.filter(u=>u.side===s&&!u._hero).reduce((n,u)=>n+u.soldiers,0)),locked:Array.from(document.querySelectorAll('#compose .scen')).every(b=>b.disabled),titleHidden:$('title').style.display==='none'};})()`);}catch(_){return false;}
      },'embedded compose');
      assert.equal(loaded.phase,'compose');assert.deepEqual(loaded.totals,[3000,2500]);assert.equal(loaded.emperor,1);assert(loaded.locked&&loaded.titleHidden);assert.deepEqual(loaded.sideName,{ming:'蜀汉',jin:'曹魏'});
      assert(await js('__campaignMessages.some(m=>m.type==="battleStarted")'));
    });
    if(kind==='id')await check('bench choice preserves the unfielded cohort and foreign scenario buttons cannot replace the battle',async()=>{
      const bench=await frame.executeJavaScript(`(()=>{const u=units.find(u=>u.side==='ming'&&!u._hero&&!u.emperor);return{id:u.id,sourceId:u._srcId,soldiers:u.soldiers};})()`);
      await click(frame,`#cmpGrid [data-id="${bench.id}"]`);
      await click(frame,'#cmpGo');
      const result=await frame.executeJavaScript(`(()=>{const r=_collectResult(),u=r.units.find(u=>u.id===${JSON.stringify(bench.sourceId)});return{phase:state.phase,survivors:u&&u.survivors,bench:_benchedBattleUnits.length};})()`);
      assert.equal(result.phase,'deploy');assert.equal(result.survivors,bench.soldiers);assert.equal(result.bench,1);
    });else await click(frame,'#cmpGo');
    await check(kind+' real start button advances the tactical simulation',async()=>{
      await click(frame,'#btnPlay');await until(()=>frame.executeJavaScript('state.time>0&&!state.paused'),'battle clock');
      if(kind==='id'){win.show();win.focus();await delay(250);fs.writeFileSync(path.join(reportDir,'personal-campaign-battle.png'),(await win.webContents.capturePage()).toPNG());}
    });
    if(kind==='id'){
      await click(frame,'#btnSettings');await click(frame,'#btnAuto'); // real tactical auto-resolve, not a fabricated postMessage result
    }else await clickText('✕ 放弃·转庙算');
    await clickText('整编归伍 · 继续');
    await check(kind+' returns through the actual final writer exactly once with final casualty allowance',async()=>{
      await until(()=>js('window.__campaignDone'),'return from meeting');
      const state=await js(`(()=>{const result={soldiers:GM.armies.map(a=>a.soldiers),history:(GM.battleHistory||[]).length,pending:(GM._pendingAbstractBattles||[]).length,overlay:!!document.getElementById('tm-battle-overlay'),bonus:GM.guoku._battleCasualtyBonus};
        const packet=__campaignMessages.find(m=>m.type==='battleResult');if(packet){const before=__campaignBefore;const br=TMBattleResolve.tacticalToBattleResult(packet.result,{playerArmies:[before[0]],enemyArmies:[before[1]],band:__campaignBand,playerFactionName:'蜀汉',enemyFactionName:'曹魏',abstractBr:__campaignAbstract});result.expected=before.map(a=>a.soldiers-(((br.affectedArmies||[]).find(e=>e.armyId===a.id)||{}).loss||0));result.packet=true;}return result;})()`);
      assert.equal(state.history,1);assert.equal(state.pending,0);assert(!state.overlay);
      if(kind==='id'){assert(state.packet);assert.deepEqual(state.soldiers,state.expected);}else assert.deepEqual(state.soldiers,[2700,2000]);
      assert.equal(state.bonus,(3000-state.soldiers[0])*5);
    });
  }
  await check('invalid startup configuration returns a typed error and removes its overlay',async()=>{
    const result=await js(`TMBattleEmbed.launch({armies:{ming:[],jin:[]}}).then(r=>({code:r&&r.code,overlay:!!document.getElementById('tm-battle-overlay')}))`);
    assert.equal(result.code,'battle-runtime-error');assert(!result.overlay);
  });
};
