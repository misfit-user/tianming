'use strict';
const assert = require('assert/strict'),
  fs = require('fs'),
  path = require('path');
const { fixture } = require('../../web/scripts/fixtures/native-start-fixture.cjs');
function world() {
  const f = fixture(),
    s = f.scenario;
  s.name = '原生开局隔离测试';
  s.worldKind = 'fictional';
  s.gameSettings = { startYear: 1000, daysPerTurn: 30 };
  s.time = { year: 1000, startMonth: 1, startDay: 1 };
  s.nativeStart.rulesets.forEach((r) => {
    r.requiredCapabilities = ['tm-native-world/1'];
    r.config = { privateTreasuryEnabled: false };
  });
  s.nativeStart.accounts.forEach((a, i) => {
    a.resource = 'money';
    a.unit = '两';
    a.flowModel = { type: 'fixed', periodDays: 30, income: i ? 5 : 20, expense: 0 };
  });
  s.military.initialTroops.forEach((a) =>
    Object.assign(a, { monthlyMoneyPayPerSoldier: 0, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0 }),
  );
  Object.assign(s.military.initialTroops[1], {
    commanderId: 'ca',
    monthlyMoneyPayPerSoldier: 1 / 80,
    payerShares: [
      { accountId: 'account-a', share: 0.5 },
      { accountId: 'account-b', share: 0.5 },
    ],
  });
  s.nativeStart.assets = [{ assetId: s.nativeStart.mapRef.assetId, encoding: 'utf8', text: JSON.stringify(f.map) }];
  s.nativeStart.profiles.find((p) => p.id === 'pb').initialStateOverrides = {
    openingText: '此为乙国同名君主的开场。保留甲国人物、社会与关系，不将旧君主当成本局玩家。',
  };
  s.officeTree = [
    {
      id: 'office-a',
      name: '甲国议事厅',
      authorityFactionId: 'fa',
      positions: [{ id: 'pos-a', name: '大臣', holderId: null }],
      subs: [],
    },
  ];
  s.officeRegistryByFaction.fb = [
    {
      id: 'office-b',
      name: '乙国议事厅',
      authorityFactionId: 'fb',
      positions: [
        { id: 'pos-b', name: '空缺执事', holderId: null },
        {
          id: 'pos-b-employed',
          name: '外籍执事',
          holderId: 'ca',
          appointmentAuthority: 'authority-pb',
          salaryPayments: [{ accountId: 'account-b', amountPer30Days: 2 }],
        },
      ],
      subs: [],
    },
  ];
  s.adminHierarchy = {
    fa: {
      factionId: 'fa',
      factionName: '甲国',
      divisions: [{ id: 'da', name: '甲州', level: 'province', mappedRegions: ['ra'], population: 100, children: [] }],
    },
    fb: {
      factionId: 'fb',
      factionName: '乙国',
      divisions: [{ id: 'db', name: '乙州', level: 'province', mappedRegions: ['rb'], population: 200, children: [] }],
    },
  };
  return s;
}
module.exports = async function ({ win, check, results, mode, sourceOverride }) {
  const js = async (c) => {
    const r = await win.webContents.executeJavaScript(
      `(async()=>{try{return{ok:true,result:await(${c})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`,
    );
    if (!r.ok) throw Error(r.error);
    return r.result;
  };
  const wait = async (expression) =>
    js(
      `(async()=>{const end=Date.now()+45000;while(Date.now()<end){if(${expression})return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out: '+JSON.stringify(TM.NativeStart.status())+' '+(document.querySelector('.tm-ns-status')?.textContent||''));})()`,
    );
  const capture = async (name) => {
    await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    fs.writeFileSync(
      path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), name + '.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
  };
  const click = async (selector, button = 'left') => {
    const p = await js(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing control');const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('control is visually obscured: '+${JSON.stringify(selector)});return{x:Math.round(x),y:Math.round(y)};})()`,
    );
    win.webContents.sendInputEvent({ type: 'mouseDown', button, clickCount: 1, ...p });
    win.webContents.sendInputEvent({ type: 'mouseUp', button, clickCount: 1, ...p });
    await new Promise((r) => setTimeout(r, 100));
  };
  if (mode === 'native-start-restart') {
    await check('native world survives an actual Electron restart through canonical storage', async () => {
      const r = await js(
        `(async()=>{const record=await TM_SaveDB.load('autosave');if(!record)throw Error('canonical save missing');await fullLoadGame({gameState:record.gameState},{source:'native-start-restart',preserveTimeline:true});return{profile:GM.startContext?.startProfileId,id:GM.playerCharacterId,faction:GM.startContext?.playerFactionId,turn:GM.turn,classes:GM.classes.map(c=>c.id),worldClasses:GM.nativeWorld.classes.map(c=>c.id),money:GM.guoku.money};})()`,
      );
      assert.equal(r.profile, 'pb');
      assert.equal(r.id, 'cg');
      assert.equal(r.faction, 'fb');
      assert(r.worldClasses.includes('class-a') && r.worldClasses.includes('class-b'));
      assert.deepEqual(r.classes, ['class-b']);
      assert.equal(r.money, 14.5);
      const tax = await js(
        `({money:GM.facs.find(f=>f.id==='fc').treasury.money,region:GM.mapData.regions.find(r=>r.id==='ra'),receipt:GM.nativeWorld.fiscalOperations['income:4:account-c']})`,
      );
      assert.equal(tax.money, 30);
      assert.equal(tax.region.sovereignFactionId, 'fa');
      assert.equal(tax.region.controllerFactionId, 'fb');
      assert.equal(tax.region.taxAuthorityFactionId, 'fc');
      assert.equal(tax.receipt.payments[0].regionId, 'ra');
    });
    return;
  }
  const scenario = sourceOverride || world();
  if (!sourceOverride) {
    scenario.nativeStart.accounts.push({
      id: 'account-c',
      ownerFactionId: 'fc',
      kind: 'public',
      resource: 'money',
      unit: '两',
      balance: 0,
      flowModel: { type: 'region-tax', periodDays: 30, rate: 0.1, expense: 0 },
    });
    Object.assign(scenario.map.regions[0], {
      sovereignFactionId: 'fa',
      controllerFactionId: 'fb',
      taxAuthorityFactionId: 'fc',
      taxBase: 100,
      taxBaseResource: 'money',
      taxBaseUnit: '两',
    });
  }
  await js(
    `(async()=>{await TMOfficialScenarioLoader.ready();P.ai={key:'',url:'',model:''};const source=${JSON.stringify(scenario)},old=JSON.parse(JSON.stringify(source));delete old.nativeStart;old.id='native-old-legacy';old.characters[0].name='旧局甲君';old.characters[1].name='旧局乙君';old.playerInfo={characterId:'ca',characterName:'旧局甲君',factionId:'fa',factionName:'甲国',characterFaction:'甲国'};P.scenarios.push(old,source);doActualStart(old.id);await new Promise(r=>setTimeout(r,500));window.__nsOriginal={gm:GM,p:P,gmText:JSON.stringify(GM),source:JSON.stringify(P.scenarios.find(s=>s.id==='synthetic-world')),calls:0};})()`,
  );
  win.show();
  win.focus();
  await check(
    'production startGame opens a native selector without a model key or changing the old world',
    async () => {
      await js(`startGame('synthetic-world')`);
      await wait(`TM.NativeStart.status().phase==='choosing'`);
      const r = await js(
        `(()=>{const before=JSON.parse(__nsOriginal.gmText),changes=Object.keys(GM).filter(k=>JSON.stringify(GM[k])!==JSON.stringify(before[k])).map(k=>({key:k,before:JSON.stringify(before[k])?.slice(0,120),after:JSON.stringify(GM[k])?.slice(0,120)}));return{same:GM===__nsOriginal.gm&&P===__nsOriginal.p,unchanged:JSON.stringify(GM)===__nsOriginal.gmText,changes,cards:document.querySelectorAll('.tm-ns-card').length,buttons:!!document.querySelector('.tm-ns-start'),external:document.querySelectorAll('iframe').length};})()`,
      );
      assert(r.same && r.unchanged, JSON.stringify(r));
      assert.equal(r.cards, 5);
      assert(r.buttons);
      assert.equal(r.external, 0);
    },
  );
  await check('cancel returns to the scenario selection and leaves the old world intact', async () => {
    await click('.tm-ns-head button');
    const r = await js(
      `(()=>({open:!!document.getElementById('tm-native-start-selector'),same:GM===__nsOriginal.gm&&JSON.stringify(GM)===__nsOriginal.gmText,state:TM.NativeStart.status().phase}))()`,
    );
    assert(!r.open && r.same);
    assert.equal(r.state, 'idle');
  });
  await js(`startGame('synthetic-world')`);
  await wait(`TM.NativeStart.status().phase==='choosing'`);
  await check(
    'search and exact-ID selection distinguish same-name characters and show the selected public balance',
    async () => {
      const r = await js(
        `(()=>{const q=document.querySelector('.tm-ns-search');q.value='乙公国';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-profile="pb"]').click();return{text:document.querySelector('.tm-ns-detail').textContent,id:TM.NativeStart.status().profileId,rows:document.querySelectorAll('.tm-ns-card').length};})()`,
      );
      assert.equal(r.id, 'pb');
      assert.match(r.text, /乙国/);
      assert.match(r.text, /7 两/);
      assert.equal(r.rows, 3);
    },
  );
  await capture('native-start-selector');
  await js(
    `(()=>{for(const [key,value] of [['gameMode','strict_hist'],['difficulty','hardcore']]){const control=document.querySelector('[data-setting="'+key+'"]');control.value=value;control.dispatchEvent(new Event('change'));}})()`,
  );
  await click('.tm-ns-start');
  await js(`document.querySelector('.tm-ns-start')?.click()`);
  await wait(`TM.NativeStart.status().phase==='idle'||TM.NativeStart.status().phase==='failed'`);
  await check(
    'one confirmed profile reaches real initialization, canonical save and the selected live world',
    async () => {
      const r = await js(
        `(()=>({phase:TM.NativeStart.status(),error:document.querySelector('.tm-ns-status')?.textContent,id:GM.playerCharacterId,info:GM.playerInfo,context:GM.startContext,money:GM.guoku?.money,classes:GM.classes.map(c=>c.id),allClasses:GM.nativeWorld?.classes.map(c=>c.id),chars:GM.chars.map(c=>({id:c.id,isPlayer:c.isPlayer})),frames:document.querySelectorAll('[data-tm-native-preparation]').length,source:JSON.stringify(P.scenarios.find(s=>s.id==='synthetic-world'))===__nsOriginal.source}))()`,
      );
      results.push({
        name: 'native-start-observation',
        status: 'OBSERVED',
        value: {
          phase: r.phase,
          error: r.error,
          id: r.id,
          money: r.money,
          classes: r.classes,
          allClasses: r.allClasses,
          chars: r.chars,
          frames: r.frames,
          source: r.source,
        },
      });
      assert.equal(r.phase.phase, 'idle', r.error);
      assert.equal(r.id, 'cb');
      assert.equal(r.context.startProfileId, 'pb');
      assert.equal(r.info.factionId, 'fb');
      assert.equal(r.money, 7);
      assert.equal(r.chars.filter((c) => c.isPlayer).length, 1);
      assert(r.chars.some((c) => c.id === 'ca'));
      assert.deepEqual(r.classes, ['class-b']);
      assert(r.allClasses.includes('class-a'));
      assert(r.source);
      assert.equal(r.frames, 0);
      assert.deepEqual(await js(`({mode:P.conf.gameMode,difficulty:P.conf.difficulty})`), {
        mode: 'strict_hist',
        difficulty: 'hardcore',
      });
    },
  );
  await capture('native-start-world');
  await check('native treasury drawers show declared flows and no inherited palace accounting', async () => {
    if (await js(`!!document.querySelector('#tm-firstturn-guide .bp')`)) await click('#tm-firstturn-guide .bp');
    if (await js(`!!document.querySelector('#tm-nokey-banner .bs')`)) await click('#tm-nokey-banner .bs');
    // Close only. The other primary button in this panel applies a software update.
    if (await js(`!!document.querySelector('#tm-changelog-ov .tm-cl-close')`))
      await click('#tm-changelog-ov .tm-cl-close');
    await click('#tmf-tb-vars [data-key="guoku"]', 'right');
    await wait(`!!document.querySelector('#tm-native-fiscal-panel [data-tm-native-ledger="public"]')`);
    const publicText = await js(`document.querySelector('#tm-native-fiscal-panel').textContent`);
    assert.match(publicText, /公共账册/);
    assert.match(publicText, /2.5/);
    await capture('native-start-public-ledger');
    await click('#tmf-tb-vars [data-key="neitang"]', 'right');
    await wait(`!!document.querySelector('#tm-native-fiscal-panel [data-tm-native-ledger="private"]')`);
    const r = await js(
      `({privateText:document.querySelector('#tm-native-fiscal-panel').textContent,count:document.querySelectorAll('#tm-native-fiscal-panel').length,income:GM.guoku.monthlyIncome,expense:GM.guoku.monthlyExpense,money:GM.guoku.money,polity:document.querySelector('#tmf-tb-dyn').textContent,ruler:document.querySelector('#tmf-tb-ruler').textContent})`,
    );
    assert.match(r.privateText, /未配置私库/);
    assert.equal(r.count, 1);
    assert.equal(r.income, 5);
    assert.equal(r.expense, 2.5);
    assert.equal(r.money, 7);
    assert.equal(r.polity, '乙国');
    assert.match(r.ruler, /同名君主/);
    await click('#tm-native-fiscal-panel button');
  });
  await check(
    'three native fiscal periods charge joint payers once and do not create imperial private income',
    async () => {
      const r = await js(
        `(()=>{const rows=[];for(let turn=2;turn<=4;turn++){GM.turn=turn;CascadeTax.collect();GuokuEngine.tick();NeitangEngine.tick();FixedExpense.collect();TM.FactionNpcGuoku.generate();const before=JSON.stringify(GM.nativeWorld.accounts);CascadeTax.collect();GuokuEngine.tick();NeitangEngine.tick();FixedExpense.collect();TM.FactionNpcGuoku.generate();if(before!==JSON.stringify(GM.nativeWorld.accounts))throw Error('duplicate finance');rows.push({turn,money:GM.guoku.money,private:GM.neitang.money,foreign:GM.facs.find(f=>f.id==='fa').treasury.money});}const army=GM.armies.find(a=>a.id==='army-b');return{rows,holder:GM.officeTree[0].positions.find(p=>p.id==='pos-b-employed').holderId,vacancy:GM.officeTree[0].positions.find(p=>p.id==='pos-b').holderId,armyOwner:army.ownerFactionId,armyFaction:army.factionId,commander:army.commanderId};})()`,
      );
      assert.deepEqual(r.rows, [
        { turn: 2, money: 9.5, private: 0, foreign: 19.5 },
        { turn: 3, money: 12, private: 0, foreign: 39 },
        { turn: 4, money: 14.5, private: 0, foreign: 58.5 },
      ]);
      assert.equal(r.holder, 'ca');
      assert(!r.vacancy);
      assert.equal(r.armyOwner, 'fb');
      assert.equal(r.armyFaction, 'fb');
      assert.equal(r.commander, 'ca');
    },
  );
  await check('the native canonical save owner preserves changed finance for the next process', async () => {
    if (!sourceOverride) {
      const tax = await js(
        `({canonical:GM.mapData===P.map,money:GM.facs.find(f=>f.id==='fc').treasury.money,receipt:GM.nativeWorld.fiscalOperations['income:4:account-c']})`,
      );
      assert(tax.canonical);
      assert.equal(tax.money, 30);
      assert.equal(tax.receipt.payments[0].regionId, 'ra');
      assert.equal(tax.receipt.payments[0].taxAuthorityFactionId, 'fc');
      results.push({ name: 'native-three-authorities-tax', status: 'OBSERVED', value: tax });
    }
    const succession = await js(
      `(()=>{GM.chars.find(c=>c.id==='cb').designatedHeirId='cg';applyOneDeath({characterId:'cb',name:'同名君主',reason:'隔离验收病逝'});return{current:GM.playerCharacterId,original:GM.startContext.playerCharacterId,profile:GM.startContext.startProfileId,otherAlive:GM.chars.find(c=>c.id==='ca').alive,dead:GM.chars.find(c=>c.id==='cb').alive,title:GM.chars.find(c=>c.id==='cg').title,money:GM.guoku.money,mode:P.conf.gameMode,difficulty:P.conf.difficulty};})()`,
    );
    assert.deepEqual(succession, {
      current: 'cg',
      original: 'cb',
      profile: 'pb',
      otherAlive: true,
      dead: false,
      title: '公',
      money: 14.5,
      mode: 'strict_hist',
      difficulty: 'hardcore',
    });
    const r = await js(
      `(async()=>{const saved=_buildSaveState({format:'idb',detach:true}),tx='native-fiscal-periods',identity={campaignId:saved.GM._campaignId,timelineId:saved.GM._timelineId,turn:saved.GM.turn,transactionId:tx,schemaVersion:1};const payload=await TM_SaveDB.createCanonicalPayload(saved,identity);return TM_SaveDB.saveManyAtomic([{id:'autosave',gameState:saved,canonicalPayload:payload,meta:{turn:GM.turn}},{id:'slot_0',gameState:saved,canonicalPayload:payload,meta:{turn:GM.turn}}],{transactionId:tx,writeGuard:()=>GM.turn===4});})()`,
    );
    assert.equal(r, true);
  });
};
module.exports.world = world;
