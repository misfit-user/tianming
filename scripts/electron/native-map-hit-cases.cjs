'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async function(args){
  const {win,check}=args,entry=require('./native-start-entry-cases.cjs'),source=entry.world();
  const map=JSON.parse(source.nativeStart.assets[0].text),ring=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  map.cells[0].geometry={type:'MultiPolygon',coordinates:[map.cells[0].geometry.coordinates,[ring(14,3,2,2)]]};
  map.cells[1].geometry={type:'MultiPolygon',coordinates:[[...map.cells[1].geometry.coordinates,ring(14,3,2,2)],[ring(32,0,4,4)]]};
  map.cells[2].geometry.coordinates.push(ring(23,2,3,3));
  const text=JSON.stringify(map);source.nativeStart.assets[0].text=text;source.nativeStart.mapRef.contentHash=crypto.createHash('sha256').update(text).digest('hex');source.nativeStart.mapRef.byteLength=Buffer.byteLength(text);
  await entry({...args,mode:'native-start-entry',sourceOverride:source});
  const js=s=>win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,result:await(${s})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`).then(r=>{if(!r.ok)throw Error(r.error);return r.result;});
  await check('real native mouse clicks select both multipart faces by one ID and preserve an independent enclave',async()=>{
    for(const [point,id] of [[[11,1],'rb'],[[34,1],'rb'],[[15,4],'ra']]){
      await js(`document.querySelector('#ppop [data-pp-close]')?.click()`);
      const p=await js(`(()=>{const t=P.map.coordinateTransform,r=document.querySelector('path.tmf-region[data-region-id="'+${JSON.stringify(id)}+'"]'),at=r.ownerSVGElement.createSVGPoint();at.x=${point[0]}*t.scale+t.offset[0];at.y=${point[1]}*t.scale+t.offset[1];const screen=at.matrixTransform(r.getScreenCTM());return{x:Math.round(screen.x),y:Math.round(screen.y),inside:r.isPointInFill(at),top:document.elementFromPoint(screen.x,screen.y)?.getAttribute('data-region-id')};})()`);
      assert(p.inside,JSON.stringify(p));
      win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:p.x,y:p.y});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:p.x,y:p.y});
      await new Promise(r=>setTimeout(r,80));assert.equal(await js(`document.getElementById('ppop')?.dataset.regionId`),id,JSON.stringify(p));
    }
  });
  await check('a lake hole is not selectable land in the actual native SVG',async()=>{
    await js(`document.querySelector('#ppop [data-pp-close]')?.click()`);
    const p=await js(`(()=>{const t=P.map.coordinateTransform,r=document.querySelector('path.tmf-region[data-region-id="rc"]'),at=r.ownerSVGElement.createSVGPoint();at.x=24*t.scale+t.offset[0];at.y=3*t.scale+t.offset[1];const screen=at.matrixTransform(r.getScreenCTM());return{x:Math.round(screen.x),y:Math.round(screen.y),inside:r.isPointInFill(at)};})()`);
    assert(!p.inside);win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:p.x,y:p.y});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:p.x,y:p.y});await new Promise(r=>setTimeout(r,80));
    assert.equal(await js(`document.getElementById('ppop')?.dataset.regionId||null`),null);
  });
};
