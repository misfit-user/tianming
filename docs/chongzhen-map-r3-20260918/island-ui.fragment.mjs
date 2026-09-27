 await js(`TMPhase8FormalBridge.map.focusRegion('ming-28-p08'); TMPhase8FormalBridge.map.openRegionDossier('ming-28-p08')`);
 await sleep(1800);await win.webContents.capturePage();await sleep(750);
 fs.writeFileSync(path.join(dir,'map-pidao-dossier.png'),(await win.webContents.capturePage()).toPNG());
 report.newGeography=await js(`(()=>{const p=GM.chars.find(c=>c.name==='毛文龙');const r=TMMapLocations.read(p,'character',GM);const island=GM.mapData.regions.find(x=>x.id==='ming-28-p08');return {maoText:p.location,maoMapRegion:r.regionId,islandName:island.name,theaterLedgers:island.accountingLeafIds.length};})()`);
 check('live-mao-wenlong-at-pidao',report.newGeography.maoMapRegion==='ming-28-p08',report.newGeography);
