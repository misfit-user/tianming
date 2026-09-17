'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
module.exports = async function ({ win, root, check, results }) {
  const file = process.env.TM_NEUTRAL_ATLAS_ZIP;
  if (!file) throw Error('Pass the original neutral atlas via --neutral-atlas; never substitute a scenario');
  const bytes = fs.readFileSync(file),
    sha = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha, '98374e1e4709f987958d1901664715b7a461db45e01d5956ef3ebac1cd36cf23');
  const js = (s) =>
    win.webContents
      .executeJavaScript(
        `(async()=>{try{return{ok:true,result:await(${s})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`,
      )
      .then((r) => {
        if (!r.ok) throw Error(r.error);
        return r.result;
      });
  const source = require('./native-start-entry-cases.cjs').world();
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await js(
    `(async()=>{const end=Date.now()+20000;while(document.body.dataset.scenarioEditorResetApp!=='ready'){if(Date.now()>end)throw Error('editor unavailable');await new Promise(r=>setTimeout(r,30));}const a=TM_SCENARIO_EDITOR_RESET_APP;a.applyImportedScenario(${JSON.stringify(source)},'中立原图隔离验收');await a.saveProjectSnapshot('中立原图隔离验收');window.__atlas={bytes:Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}),c=>c.charCodeAt(0))};})()`,
  );
  await check(
    'the real workbench import handler safely decompresses the original 575-cell atlas with every license',
    async () => {
      const began = Date.now();
      const r = await js(
        `(async()=>{TM.WorkbenchUI.open();await new Promise(r=>setTimeout(r,80));const input=document.querySelector('[data-wb-file="map"]'),transfer=new DataTransfer();transfer.items.add(new File([__atlas.bytes],'neutral-2.1.0.zip',{type:'application/zip'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));const end=Date.now()+60000;while(Date.now()<end){const rows=await TM.ProjectAssets.listAssets(TM_SCENARIO_EDITOR_RESET_APP.state.currentProjectId);if(rows.some(r=>r.kind==='map')){const file=await TM.ProjectAssets.getAsset(TM_SCENARIO_EDITOR_RESET_APP.state.currentProjectId,rows.find(r=>r.kind==='map').assetId);__atlas.map=JSON.parse(TM.ProjectAssets.decode(file.bytes));__atlas.assetId=file.meta.assetId;return{cells:__atlas.map.cells.length,licenses:__atlas.map.licenseDocuments.length,original:rows.some(r=>r.kind==='map-original'&&r.hash===${JSON.stringify(sha)}),liveRegions:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.map.regions.length,status:file.meta.processingStatus};}await new Promise(r=>setTimeout(r,50));}throw Error(document.querySelector('[data-wb-status]').textContent);})()`,
      );
      assert.equal(r.cells, 575);
      assert.equal(r.licenses, 5);
      assert(r.original);
      assert.equal(r.liveRegions, 3);
      assert.equal(r.status, 'validated-geometry');
      results.push({
        name: 'original-neutral-atlas-import-observation',
        status: 'OBSERVED',
        value: { ...r, elapsedMs: Date.now() - began, archiveHash: sha },
      });
    },
  );
  await check(
    'full original topology keeps independent Hainan land, both Tsushima components and valid label anchors',
    async () => {
      const r = await js(
        `(()=>{const m=__atlas.map,G=TM.MapWorkbench,ts=m.cells.find(c=>c.id==='jp-tsushima'),hai=m.cells.find(c=>c.id==='海南中部诸峒');const report=G.summary(G.inspect(m));__atlas.geometry=report;return{ok:report.ok,regions:report.regions,components:report.components,holes:report.holes.length,enclave:report.holes.some(h=>h.classification==='enclave'),tsushima:ts.geometry.coordinates.map(p=>G.hit(m,G.anchor({type:'Polygon',coordinates:p}))),hainan:G.hit(m,G.anchor(hai.geometry)),labelsValid:m.cells.every(c=>G.contains(c.geometry,c.labelPoint||G.anchor(c.geometry)))};})()`,
      );
      // This 2.1 source represents the independent Hainan cell between surrounding
      // faces, not as an inner ring. Do not invent an enclave-ring classification.
      assert(r.ok && r.labelsValid, JSON.stringify(r));
      assert.equal(r.regions, 575);
      assert.equal(r.components, 622);
      assert.equal(r.holes, 228);
      assert.deepEqual(r.tsushima, [['jp-tsushima'], ['jp-tsushima']]);
      assert.deepEqual(r.hainan, ['海南中部诸峒']);
    },
  );
  await check(
    'full-size neutral geometry reaches the actual native renderer and yields a current real PNG',
    async () => {
      const began = Date.now();
      const r =
        await js(`(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,s=JSON.parse(JSON.stringify(a.state.scenario)),m=__atlas.map,old=['ra','rb','rc'],ids=m.cells.slice(0,3).map(c=>c.id),text=JSON.stringify(m),b=new TextEncoder().encode(text),hash=await TM.ProjectAssets.hash(b);
      s.map={id:m.id,regions:m.cells.map((c,i)=>({id:c.id,name:c.name,population:100,sovereignFactionId:['fa','fb','fc'][i%3],controllerFactionId:['fa','fb','fc'][i%3]}))};
      s.nativeStart.profiles.forEach(p=>p.startRegionId=ids[old.indexOf(p.startRegionId)]);s.nativeStart.authorities.forEach(p=>p.jurisdiction.regionIds=p.jurisdiction.regionIds.map(id=>ids[old.indexOf(id)]));s.military.initialTroops.forEach(t=>t.garrisonRegionId=ids[old.indexOf(t.garrisonRegionId)]);
      s.adminHierarchy={};for(const id of ['fa','fb','fc'])s.adminHierarchy[id]={factionId:id,factionName:s.factions.find(f=>f.id===id).name,divisions:[{id:'test-admin-'+id,name:'测试区域',level:'province',mappedRegions:s.map.regions.filter(r=>r.sovereignFactionId===id).map(r=>r.id)}]};
      s.nativeStart.mapRef={assetId:'neutral-atlas-full',schemaVersion:m.schemaVersion,mapId:m.id,mapVersion:m.version,coordinateSystemId:m.coordinateSystemId,contentHash:hash,byteLength:b.length};s.nativeStart.assets=[{assetId:'neutral-atlas-full',encoding:'utf8',text}];
      a.applyImportedScenario(s,'中立全图测试，不是晚唐剧本');await a.saveProjectSnapshot('中立全图测试');const report=await TM.Workbench.sandbox(a.state.scenario,TM.Workbench.capture(),{profileId:'pb',preview:true,fiscalPeriods:0});__atlas.preview=report.preview;
      return{renderer:report.preview.renderer,regions:report.preview.hitRegions.length,hasTsushima:report.preview.hitRegions.includes('jp-tsushima'),hasHainan:report.preview.hitRegions.includes('海南中部诸峒'),pixels:report.preview.pixelSummary,runtimeHash:report.runtimeHash,frameCount:document.querySelectorAll('[data-tm-native-preparation]').length,preparation:TM.StartPreparation.status()};})()`);
      assert.equal(r.renderer, 'phase8-formal-map');
      assert.equal(r.regions, 575);
      assert(r.hasTsushima && r.hasHainan);
      assert(r.pixels.sampledColors > 256 && r.pixels.nearBlackFraction < 0.1);
      assert.equal(r.frameCount, 0);
      assert.equal(r.preparation.phase, 'idle');
      results.push({
        name: 'full-atlas-native-render-observation',
        status: 'OBSERVED',
        value: { ...r, elapsedMs: Date.now() - began },
      });
      const data = await js(`__atlas.preview.dataUrl`);
      fs.writeFileSync(
        path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'neutral-atlas-native.png'),
        Buffer.from(data.split(',')[1], 'base64'),
      );
    },
  );
  await check(
    'original Tsushima faces and independent Hainan cell are clickable in the full native client',
    async () => {
      const sourceText = await js(`JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)`);
      // Test fixture transfer, not a game shortcut: avoid compiling a many-megabyte
      // escaped JSON literal as JavaScript. Read the same generated bytes as JSON.
      const sourceFile = path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'neutral-synthetic-source.json');
      fs.writeFileSync(sourceFile, sourceText);
      const sourceHash = crypto.createHash('sha256').update(sourceText).digest('hex');
      const sourceUrl = new URL('file:///' + sourceFile.replace(/\\/g, '/')).href;
      await win.loadFile(path.join(root, 'web/index.html'));
      await js(
        `(async()=>{await TMOfficialScenarioLoader.ready();P.ai={key:'',url:'',model:''};const response=await fetch(${JSON.stringify(sourceUrl)}),bytes=new Uint8Array(await response.arrayBuffer());if(await TM.StartCompiler.sha256(bytes)!==${JSON.stringify(sourceHash)})throw Error('synthetic fixture transfer hash changed');P.scenarios.push(JSON.parse(new TextDecoder().decode(bytes)));await startGame('synthetic-world');document.querySelector('[data-profile="pb"]').click();document.querySelector('.tm-ns-start').click();const end=Date.now()+75000;while(TM.NativeStart.status().phase!=='idle'){if(Date.now()>end||TM.NativeStart.status().phase==='failed')throw Error(document.querySelector('.tm-ns-status')?.textContent||'full native start timed out');await new Promise(r=>setTimeout(r,50));}for(const selector of ['#tm-firstturn-guide .bp','#tm-nokey-banner .bs','#tm-changelog-ov .tm-cl-close'])document.querySelector(selector)?.click();})()`,
      );
      const selected = [];
      for (const [id, component] of [
        ['jp-tsushima', 0],
        ['jp-tsushima', 1],
        ['海南中部诸峒', 0],
      ]) {
        await js(
          `(()=>{TMPhase8FormalBridge.map.closeMapDossier();document.querySelector('[data-map-scale="prefecture"]').click();TMPhase8FormalBridge.map.focusRegion(${JSON.stringify(id)},false);})()`,
        );
        await new Promise((r) => setTimeout(r, 250));
        const point = await js(
          `(()=>{const region=P.map.regions.find(r=>r.id===${JSON.stringify(id)}),polys=TM.MapWorkbench.polys(region.geometry),at=TM.MapWorkbench.anchor({type:'Polygon',coordinates:polys[${component}]}),el=document.querySelector('path.tmf-region[data-region-id="'+${JSON.stringify(id)}+'"]'),p=el.ownerSVGElement.createSVGPoint();p.x=at[0];p.y=at[1];const screen=p.matrixTransform(el.getScreenCTM());return{x:Math.round(screen.x),y:Math.round(screen.y),inside:el.isPointInFill(p),top:document.elementFromPoint(screen.x,screen.y)?.getAttribute('data-region-id')};})()`,
        );
        assert(point.inside, JSON.stringify(point));
        win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: point.x, y: point.y });
        win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: point.x, y: point.y });
        await new Promise((r) => setTimeout(r, 120));
        const picked = await js(`document.getElementById('ppop')?.dataset.regionId`);
        assert.equal(picked, id, JSON.stringify(point));
        selected.push({ id, component, picked });
      }
      results.push({
        name: 'original-neutral-map-native-clicks',
        status: 'OBSERVED',
        value: { regions: await js(`P.map.regions.length`), selected },
      });
      fs.writeFileSync(
        path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'neutral-atlas-native-hainan-click.png'),
        (await win.webContents.capturePage()).toPNG(),
      );
    },
  );
  await check(
    'a delegated representative actually starts without replacing the head or gaining treasury power from a title',
    async () => {
      const representative = require('./native-start-entry-cases.cjs').world();
      representative.id = 'native-representative';
      const r = await js(
        `(async()=>{TMPhase8FormalBridge.map.closeMapDossier();P.scenarios.push(${JSON.stringify(representative)});await startGame('native-representative');document.querySelector('[data-profile="pr"]').click();document.querySelector('.tm-ns-start').click();const end=Date.now()+45000;while(TM.NativeStart.status().phase!=='idle'){if(Date.now()>end||TM.NativeStart.status().phase==='failed')throw Error(document.querySelector('.tm-ns-status')?.textContent||'representative start failed');await new Promise(r=>setTimeout(r,40));}const before={id:GM.playerCharacterId,profile:GM.startContext.startProfileId,role:GM.startContext.roleKind,head:GM.facs.find(f=>f.id==='fb').leaderCharacterId,title:GM.chars.find(c=>c.id==='cr').title,diplomacy:TM.NativeWorld.allowed(GM,'diplomacy','fb','rb'),treasury:TM.NativeWorld.allowed(GM,'treasury','fb','rb')};GM.chars.find(c=>c.id==='cr').title='皇帝';return{...before,titleDoesNotAuthorize:!TM.NativeWorld.allowed(GM,'treasury','fb','rb')};})()`,
      );
      assert.equal(r.id, 'cr');
      assert.equal(r.profile, 'pr');
      assert.equal(r.role, 'delegatedRepresentative');
      assert.equal(r.head, 'cb');
      assert.equal(r.title, '议事代表');
      assert(r.diplomacy && !r.treasury && r.titleDoesNotAuthorize, JSON.stringify(r));
      results.push({ name: 'representative-native-identity', status: 'OBSERVED', value: r });
    },
  );
};
