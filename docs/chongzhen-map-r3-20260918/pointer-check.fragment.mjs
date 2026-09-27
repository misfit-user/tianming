 // Pointer test in the isolated renderer: camera focus is not counted as a successful click.
 report.pointerChecks=[];
 for(const id of ['ming-28-p03','ming-28-p07','ming-28-p08']){
  await js(`TMPhase8FormalBridge.map.closeMapDossier();TMPhase8FormalBridge.map.focusRegion('${id}',false)`);await sleep(900);
  const target=await js(`(()=>{const id='${id}',r=GM.mapData.regions.find(r=>r.id===id),path=document.querySelector('#tmf-formal-map .tmf-region[data-region-id="'+id+'"]');if(!path)return {error:'path missing'};const m=path.getScreenCTM(),p=new DOMPoint(r.center[0],r.center[1]).matrixTransform(m);for(let radius=0;radius<=14;radius++){for(let dy=-radius;dy<=radius;dy++){for(let dx=-radius;dx<=radius;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;const x=Math.round(p.x)+dx,y=Math.round(p.y)+dy,hit=document.elementFromPoint(x,y);if(hit?.closest('[data-region-id]')?.dataset.regionId===id)return {x,y,regionId:id,name:r.name,geometryPoint:[p.x,p.y]};}}}return {error:'no unobstructed integer pointer target',id,center:[p.x,p.y]};})()`);
  check('pointer-target-'+id,Number.isInteger(target.x)&&Number.isInteger(target.y),target);
  win.webContents.sendInputEvent({type:'mouseMove',x:target.x,y:target.y});
  win.webContents.sendInputEvent({type:'mouseDown',x:target.x,y:target.y,button:'left',clickCount:1});
  win.webContents.sendInputEvent({type:'mouseUp',x:target.x,y:target.y,button:'left',clickCount:1});
  await sleep(1100);
  const panel=await js(`(()=>{const p=document.getElementById('ppop');return {id:p?.dataset.regionId,visible:!!p&&getComputedStyle(p).display!=='none',text:p?.innerText?.slice(0,150)};})()`);
  check('real-pointer-selects-'+id,panel.visible&&panel.id===id&&panel.text.includes(target.name),panel);
  report.pointerChecks.push({target,panel});mark('pointer-verified',{id,name:target.name});
 }
