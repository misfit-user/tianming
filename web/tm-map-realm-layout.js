/* Read-only cartographic label layout. Polygon unions are rasterized once per orientation,
 * eroded at the coast and searched for a text-shaped rectangle; no scenario geometry is changed.
 * SVG arc conversion follows https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMMapRealmLayout=api;
  // This same fixed, local module is the worker entry; no eval/blob or extra CSP permission.
  if(typeof document==='undefined'&&typeof root.postMessage==='function')root.addEventListener('message',function(event){
    const m=event.data;if(!m||m.type!=='tm-map-prepare')return;
    try{const fits=m.jobs.map((j,i)=>{const value=api.fit(j.ids.map(i=>m.regions[i]),j.text,j.options);if(i%20===0)root.postMessage({id:m.id,progress:(i+1)/(m.jobs.length+m.meshes.length)});return value;}),boundaries=m.meshes.map(mesh=>api.boundaryMesh(mesh.items.map(it=>({...it,region:m.regions[it.index]})),mesh.tier));root.postMessage({id:m.id,fits,boundaries});}
    catch(error){root.postMessage({id:m.id,error:String(error.message||error)});}
  });
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  let regions=new WeakMap(),pathSources=new WeakMap(),serial=0;const layouts=new Map(),meshes=new Map(),counts={geometry:0,layouts:0,hits:0,rasterCells:0,meshes:0,meshHits:0},RAD=Math.PI/180;
  // Parsed rings are immutable snapshots; raw in-place edits create new rings in region().
  let ringBands=new WeakMap();
  const workerURL=typeof document==='object'&&document.currentScript?document.currentScript.src:'';
  let prepareWorker=null,prepareId=0,prepareEpoch=0,workerUnavailable=false,workerIdle=0;
  const pending=new Map();
  function fitKey(input,text,options){options=options||{};return input.map(region).filter(p=>p&&p.rings.length).map(p=>p.version).sort((a,b)=>a-b).join(',')+'|'+text+'|'+(Number(options.maxFont)||82)+'|'+Math.max(32,Math.min(112,Number(options.resolution)||112));}
  function meshKey(items,tier){return tier+'|'+items.map(it=>({...it,pack:region(it.region)})).filter(it=>it.pack&&it.pack.rings.length).map(it=>[it.pack.version,it.owner,it.group].join(':')).join(';');}
  function trimCaches(){while(layouts.size>1024)layouts.delete(layouts.keys().next().value);while(meshes.size>8)meshes.delete(meshes.keys().next().value);}
  function prepare(jobs,boundaryJobs,onProgress){
    const needed=jobs.map(j=>({...j,key:fitKey(j.regions,j.text,j.options)})).filter(j=>!layouts.has(j.key));
    const meshJobs=boundaryJobs.map(j=>({...j,key:meshKey(j.items,j.tier)})).filter(j=>!meshes.has(j.key));
    if(!needed.length&&!meshJobs.length)return null;
    const epoch=prepareEpoch,id=++prepareId;
    return new Promise(resolve=>{
      let done=false,timer=0,fallingBack=false;
      function complete(reply){
        if(done)return;done=true;clearTimeout(timer);pending.delete(id);
        if(epoch===prepareEpoch&&reply){needed.forEach((j,i)=>layouts.set(j.key,reply.fits[i]));meshJobs.forEach((j,i)=>meshes.set(j.key,reply.boundaries[i]));trimCaches();}
        resolve(epoch===prepareEpoch&&!!reply);
        clearTimeout(workerIdle);if(!pending.size&&prepareWorker)workerIdle=setTimeout(()=>{if(!pending.size&&prepareWorker){prepareWorker.terminate();prepareWorker=null;}},30000);
      }
      function fallback(){
        if(fallingBack||done)return;fallingBack=true;clearTimeout(timer);let index=0;const fits=[],boundaries=[];
        function step(){
          if(done)return;if(epoch!==prepareEpoch){complete(null);return;}
          try{if(index<needed.length){const j=needed[index];fits.push(fit(j.regions,j.text,j.options));}else if(index<needed.length+meshJobs.length){const j=meshJobs[index-needed.length];boundaries.push(boundaryMesh(j.items,j.tier));}else{complete({fits,boundaries});return;}}
          catch(_){complete(null);return;}index++;setTimeout(step,0);
        }setTimeout(step,0);
      }
      function heartbeat(){clearTimeout(timer);timer=setTimeout(()=>{if(prepareWorker){prepareWorker.terminate();prepareWorker=null;}for(const p of pending.values())p.fallback();},30000);}
      pending.set(id,{complete,fallback,progress:onProgress,heartbeat});clearTimeout(workerIdle);
      if(!workerURL||typeof Worker!=='function'||workerUnavailable){fallback();return;}
      try{
        if(!prepareWorker){
          prepareWorker=new Worker(workerURL);
          prepareWorker.onmessage=event=>{const reply=event.data,p=reply&&pending.get(reply.id);if(!p)return;if(reply.progress!=null){p.heartbeat();if(p.progress)p.progress(reply.progress);return;}if(reply.error)p.fallback();else p.complete(reply);};
          prepareWorker.onerror=()=>{workerUnavailable=true;prepareWorker.terminate();prepareWorker=null;for(const p of pending.values())p.fallback();};
        }
        const index=new Map(),geometry=[];
        function identify(r){if(!index.has(r)){index.set(r,geometry.length);geometry.push({d:r.d,path:r.path,points:r.points,polygon:r.polygon,coords:r.coords,extraPolygons:r.extraPolygons});}return index.get(r);}
        const requests=needed.map(j=>({ids:j.regions.map(identify),text:j.text,options:j.options}));
        const boundaries=meshJobs.map(j=>({tier:j.tier,items:j.items.map(it=>({index:identify(it.region),owner:it.owner,group:it.group}))}));
        prepareWorker.postMessage({type:'tm-map-prepare',id,regions:geometry,jobs:requests,meshes:boundaries});
        heartbeat();
      }catch(_){workerUnavailable=true;fallback();}
    });
  }
  const point=p=>Array.isArray(p)?{x:Number(p[0]),y:Number(p[1])}:p&&typeof p==='object'?{x:Number(p.x),y:Number(p.y)}:{x:NaN,y:NaN};
  function ring(points){const r=(Array.isArray(points)?points:[]).map(point).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(r.length>1&&r[0].x===r[r.length-1].x&&r[0].y===r[r.length-1].y)r.pop();return r.length>=3?r:[];}
  function arc(a,v,put){
    let [rx,ry,rotation,large,sweep,x,y]=v;rx=Math.abs(rx);ry=Math.abs(ry);if(!rx||!ry||a.x===x&&a.y===y){put(x,y);return;}
    const phi=rotation*RAD,c=Math.cos(phi),s=Math.sin(phi),dx=(a.x-x)/2,dy=(a.y-y)/2,px=c*dx+s*dy,py=-s*dx+c*dy,l=px*px/(rx*rx)+py*py/(ry*ry);
    if(l>1){const q=Math.sqrt(l);rx*=q;ry*=q;}const rr=rx*rx*ry*ry,den=rx*rx*py*py+ry*ry*px*px,k=(!!large===!!sweep?-1:1)*Math.sqrt(Math.max(0,(rr-den)/Math.max(den,1e-30))),cxp=k*rx*py/ry,cyp=-k*ry*px/rx;
    const cx=c*cxp-s*cyp+(a.x+x)/2,cy=s*cxp+c*cyp+(a.y+y)/2,ux=(px-cxp)/rx,uy=(py-cyp)/ry,vx=(-px-cxp)/rx,vy=(-py-cyp)/ry,begin=Math.atan2(uy,ux);
    let delta=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);if(!sweep&&delta>0)delta-=Math.PI*2;if(sweep&&delta<0)delta+=Math.PI*2;
    const steps=Math.max(4,Math.ceil(Math.abs(delta)/(Math.PI/24)));for(let i=1;i<=steps;i++){const t=begin+delta*i/steps;put(cx+rx*Math.cos(t)*c-ry*Math.sin(t)*s,cy+rx*Math.cos(t)*s+ry*Math.sin(t)*c);}
  }
  function ringsFromPath(text){
    const tokens=String(text||'').match(/[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)||[];
    if(tokens.length>800000)return[];const rings=[],sizes={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7};let i=0,cmd='',current={x:0,y:0},start=current,last='',control=null,part=[];
    const finish=()=>{const r=ring(part);if(r.length)rings.push(r);part=[];};
    const put=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('invalid-map-path');current={x,y};part.push(current);};
    try{while(i<tokens.length){
      if(/^[a-z]$/i.test(tokens[i]))cmd=tokens[i++];const op=cmd.toUpperCase(),relative=cmd!==op;
      if(op==='Z'){finish();current={...start};last=op;control=null;cmd='';continue;}
      const n=sizes[op];if(!n||i+n>tokens.length)return[];const v=tokens.slice(i,i+n).map(Number);if(!v.every(Number.isFinite))return[];i+=n;const a={...current},xy=(x,y)=>({x:x+(relative?a.x:0),y:y+(relative?a.y:0)});
      if(op==='M'){finish();const p=xy(v[0],v[1]);put(p.x,p.y);start={...current};cmd=relative?'l':'L';control=null;}
      else if(op==='L'){const p=xy(v[0],v[1]);put(p.x,p.y);control=null;}
      else if(op==='H'){put(v[0]+(relative?a.x:0),a.y);control=null;}
      else if(op==='V'){put(a.x,v[0]+(relative?a.y:0));control=null;}
      else if(op==='C'||op==='S'){
        const b=op==='C'?xy(v[0],v[1]):/[CS]/.test(last)&&control?{x:2*a.x-control.x,y:2*a.y-control.y}:a,c=xy(v[n-4],v[n-3]),d=xy(v[n-2],v[n-1]);
        for(let j=1;j<=24;j++){const t=j/24,u=1-t;put(u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y);}control=c;
      }else if(op==='Q'||op==='T'){
        const b=op==='Q'?xy(v[0],v[1]):/[QT]/.test(last)&&control?{x:2*a.x-control.x,y:2*a.y-control.y}:a,d=xy(v[n-2],v[n-1]);
        for(let j=1;j<=24;j++){const t=j/24,u=1-t;put(u*u*a.x+2*u*t*b.x+t*t*d.x,u*u*a.y+2*u*t*b.y+t*t*d.y);}control=b;
      }else if(op==='A'){const p=xy(v[5],v[6]);arc(a,[...v.slice(0,5),p.x,p.y],put);control=null;}
      last=op;if(part.length>100000)return[];
    }finish();return rings;}catch(_){return[];}
  }
  function insideRing(r,x,y){
    let band=ringBands.get(r);
    if(band===undefined){
      band=null;
      if(r.length>=64){
        const b=bounds([r]),size=Math.min(128,Math.ceil(Math.sqrt(r.length))),step=b.height/size,buckets=Array.from({length:size},()=>[]);let entries=0;
        if(step>0)for(let i=0,j=r.length-1;i<r.length;j=i++){
          if(r[i].y===r[j].y)continue;
          const lo=Math.max(0,Math.min(size-1,Math.floor((Math.min(r[i].y,r[j].y)-b.minY)/step))),hi=Math.max(0,Math.min(size-1,Math.floor((Math.max(r[i].y,r[j].y)-b.minY)/step)));
          entries+=hi-lo+1;if(entries>r.length*16)break;
          for(let k=lo;k<=hi;k++)buckets[k].push(i);
        }
        if(step>0&&entries<=r.length*16)band={b,step,size,buckets};
      }
      ringBands.set(r,band);
    }
    let inside=false;
    if(band){
      const b=band.b;if(y<b.minY||y>=b.maxY||x<b.minX||x>b.maxX)return false;
      const candidates=band.buckets[Math.max(0,Math.min(band.size-1,Math.floor((y-b.minY)/band.step)))];
      for(const i of candidates){const a=r[i],z=r[(i+r.length-1)%r.length];if((a.y>y)!==(z.y>y)&&x<(z.x-a.x)*(y-a.y)/(z.y-a.y)+a.x)inside=!inside;}
    }else for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
    return inside;
  }
  function signedArea(r){let sum=0;for(let i=0,j=r.length-1;i<r.length;j=i++)sum+=r[j].x*r[i].y-r[i].x*r[j].y;return sum/2;}
  function bounds(rings){const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const r of rings)for(const p of r){b.minX=Math.min(b.minX,p.x);b.minY=Math.min(b.minY,p.y);b.maxX=Math.max(b.maxX,p.x);b.maxY=Math.max(b.maxY,p.y);}b.width=b.maxX-b.minX;b.height=b.maxY-b.minY;return b;}
  function region(r){
    if(!r||typeof r!=='object')return null;const path=r.d||r.path,shape=Array.isArray(r.points)?r.points:Array.isArray(r.polygon)?r.polygon:Array.isArray(r.coords)?r.coords:[],extra=Array.isArray(r.extraPolygons)?r.extraPolygons:[];
    const old=regions.get(r);
    // Immutable strings can hit by source value without rebuilding multi-megabyte signatures.
    // Arrays and custom stringifiable objects still use the full mutation-aware signature.
    if(old&&typeof path==='string'&&path&&pathSources.get(r)===path)return old;
    const signature=path?'path:'+String(path):JSON.stringify([shape,extra]);if(old&&old.signature===signature)return old;
    let rings;if(path)rings=ringsFromPath(path);else{const points=shape.length&&(typeof shape[0]==='number'||typeof shape[0]==='string')?Array.from({length:Math.floor(shape.length/2)},(_,i)=>[shape[i*2],shape[i*2+1]]):shape;rings=[ring(points),...extra.map(ring)].filter(r=>r.length);}
    const b=bounds(rings);let area=0;for(const rr of rings){let depth=0;for(const other of rings)if(other!==rr&&insideRing(other,rr[0].x,rr[0].y))depth++;area+=Math.abs(signedArea(rr))*(depth%2?-1:1);}
    const value={signature,version:++serial,rings,bounds:b,area:Math.max(0,area)};regions.set(r,value);if(typeof path==='string')pathSources.set(r,path);else pathSources.delete(r);counts.geometry++;return value;
  }
  function contains(packs,x,y){for(const p of packs){const b=p.bounds;if(x<b.minX||x>b.maxX||y<b.minY||y>b.maxY)continue;let inside=false;for(const r of p.rings)if(insideRing(r,x,y))inside=!inside;if(inside)return true;}return false;}
  function raster(packs,angle,resolution){
    const c=Math.cos(angle*RAD),s=Math.sin(angle*RAD),shapes=packs.map(p=>p.rings.map(r=>r.map(v=>({x:v.x*c+v.y*s,y:-v.x*s+v.y*c})))),b=bounds(shapes.flat()),step=Math.max(b.width,b.height)/(resolution||112);
    if(!(step>0)||!Number.isFinite(step))return null;const x0=b.minX-step,y0=b.minY-step,nx=Math.ceil(b.width/step)+3,ny=Math.ceil(b.height/step)+3,mask=new Uint8Array(nx*ny);
    for(const rs of shapes){const rows=Array.from({length:ny},()=>[]);for(const r of rs)for(let i=0,j=r.length-1;i<r.length;j=i++){
      const a=r[j],z=r[i];if(a.y===z.y)continue;const lo=Math.max(0,Math.ceil((Math.min(a.y,z.y)-y0)/step-.5)),hi=Math.min(ny,Math.ceil((Math.max(a.y,z.y)-y0)/step-.5));
      for(let row=lo;row<hi;row++)rows[row].push(a.x+(y0+(row+.5)*step-a.y)*(z.x-a.x)/(z.y-a.y));
    }for(let y=0;y<ny;y++){const xs=rows[y];xs.sort((a,b)=>a-b);for(let j=0;j+1<xs.length;j+=2){const lo=Math.max(0,Math.ceil((xs[j]-x0)/step-.5)),hi=Math.min(nx-1,Math.floor((xs[j+1]-x0)/step-.5));if(hi>=lo)mask.fill(1,y*nx+lo,y*nx+hi+1);}}}
    // A one-cell coastline margin also rejects thin straits and small holes at the sampling boundary.
    const area=mask.reduce((sum,v)=>sum+v,0)*step*step,safe=new Uint8Array(mask.length);for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const k=y*nx+x;safe[k]=mask[k]&&mask[k-1]&&mask[k+1]&&mask[k-nx]&&mask[k+nx]&&mask[k-nx-1]&&mask[k-nx+1]&&mask[k+nx-1]&&mask[k+nx+1]?1:0;}
    const ids=new Int32Array(mask.length),queue=new Int32Array(mask.length);let id=0,best=0,total=0,cx=0,cy=0;
    for(let k=0;k<safe.length;k++){if(!safe[k]||ids[k])continue;id++;let head=0,tail=1,sumX=0,sumY=0;queue[0]=k;ids[k]=id;
      while(head<tail){const q=queue[head++],x=q%nx,y=Math.floor(q/nx);sumX+=x+.5;sumY+=y+.5;for(const next of [x>0?q-1:-1,x<nx-1?q+1:-1,y>0?q-nx:-1,y<ny-1?q+nx:-1])if(next>=0&&safe[next]&&!ids[next]){ids[next]=id;queue[tail++]=next;}}
      if(tail>total){total=tail;best=id;cx=x0+sumX/tail*step;cy=y0+sumY/tail*step;}
    }
    for(let k=0;k<safe.length;k++)safe[k]=ids[k]===best&&best?1:0;counts.rasterCells+=safe.length;
    return{mask:safe,nx,ny,x0,y0,step,c,s,cx,cy,area,diagonal:Math.hypot(b.width,b.height)};
  }
  function textAspect(text){const chars=Array.from(String(text));return Math.max(1,chars.reduce((n,ch)=>n+(/\s/.test(ch)?.35:/[\u2e80-\uffff]/.test(ch)?1:/[\u0300-\u036f]/.test(ch)?0:.63),0)+Math.max(0,chars.length-1)*.12);}
  function rectangle(grid,aspect,vertical,limit,angle){
    const {mask,nx,ny,step,x0,y0,cx,cy,diagonal}=grid,heights=new Int32Array(nx);let best=null;
    for(let y=0;y<ny;y++){for(let x=0;x<nx;x++)heights[x]=mask[y*nx+x]?heights[x]+1:0;const stack=[];
      for(let x=0;x<=nx;x++){const height=x===nx?0:heights[x];while(stack.length&&heights[stack[stack.length-1]]>height){const at=stack.pop(),h=heights[at],left=stack.length?stack[stack.length-1]+1:0,w=x-left,size=Math.min(limit,(w-1)*step/(vertical?1.3:aspect+.3),(h-1)*step/(vertical?aspect+.3:1.3));if(!(size>0))continue;
          const u=x0+(left+w/2)*step,v=y0+(y+1-h/2)*step,score=size*(1-.07*Math.abs(angle)/45)*(vertical?.97:1)*(1-.08*Math.hypot(u-cx,v-cy)/diagonal);
          if(!best||score>best.score)best={u,v,size,score,vertical,angle};
        }if(x<nx)stack.push(x);}
    }return best;
  }
  function fits(packs,box){const c=Math.cos(box.angle*RAD),s=Math.sin(box.angle*RAD),nx=box.vertical?4:Math.min(80,Math.max(12,box.characters*4)),ny=box.vertical?Math.min(80,Math.max(12,box.characters*4)):4;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const u=(x/nx-.5)*box.width,v=(y/ny-.5)*box.height;if(!contains(packs,box.x+u*c-v*s,box.y+u*s+v*c))return false;}
    // A thin inlet can fit between grid samples. Inspect polygon edges clipped
    // to the rectangle interior, probing both sides; internal province borders
    // remain valid because contains() checks the whole territory union.
    const eps=Math.max(1e-8,Math.min(box.width,box.height)*1e-6),hx=box.width/2-eps,hy=box.height/2-eps;
    const local=p=>({x:(p.x-box.x)*c+(p.y-box.y)*s,y:-(p.x-box.x)*s+(p.y-box.y)*c});
    const ex=Math.abs(c)*box.width/2+Math.abs(s)*box.height/2+eps,ey=Math.abs(s)*box.width/2+Math.abs(c)*box.height/2+eps,minX=box.x-ex,maxX=box.x+ex,minY=box.y-ey,maxY=box.y+ey;
    for(const pack of packs){
      const bounds=pack.bounds;if(bounds.maxX<minX||bounds.minX>maxX||bounds.maxY<minY||bounds.minY>maxY)continue;
      for(const r of pack.rings)for(let i=0,j=r.length-1;i<r.length;j=i++){
      const p=r[j],q=r[i];if(Math.max(p.x,q.x)<minX||Math.min(p.x,q.x)>maxX||Math.max(p.y,q.y)<minY||Math.min(p.y,q.y)>maxY)continue;
      const a=local(p),b=local(q),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;let lo=0,hi=1;
      for(const [v,d,h] of [[a.x,dx,hx],[a.y,dy,hy]]){if(Math.abs(d)<1e-12){if(Math.abs(v)>h){hi=-1;break;}}else{const p=(-h-v)/d,q=(h-v)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}}
      if(hi<=lo)continue;for(const t of [lo+(hi-lo)*.01,lo+(hi-lo)*.25,(lo+hi)/2,lo+(hi-lo)*.75,hi-(hi-lo)*.01])for(const side of [-1,1]){
        const u=a.x+t*dx-dy/length*eps*side,v=a.y+t*dy+dx/length*eps*side;if(Math.abs(u)>=hx||Math.abs(v)>=hy)continue;if(!contains(packs,box.x+u*c-v*s,box.y+u*s+v*c))return false;
      }
    }}return true;
  }
  function fit(input,text,options){
    options=options||{};const packs=input.map(region).filter(p=>p&&p.rings.length),characters=Array.from(String(text||'')).length;
    if(!packs.length||!characters)return null;const max=Number(options.maxFont)||82,resolution=Math.max(32,Math.min(112,Number(options.resolution)||112)),key=packs.map(p=>p.version).sort((a,b)=>a-b).join(',')+'|'+text+'|'+max+'|'+resolution;
    if(layouts.has(key)){const hit=layouts.get(key);layouts.delete(key);layouts.set(key,hit);counts.hits++;return hit&&{...hit};}
    counts.layouts++;const first=raster(packs,0,resolution);if(!first)return null;const aspect=textAspect(text),limit=Math.min(max,Math.sqrt(first.area)*.34/Math.pow(aspect,.12)),verticalAllowed=/[\u2e80-\uffff]/.test(text)&&characters>1;let best=null;
    for(const angle of [0,-15,15,-30,30,-45,45]){const grid=angle===0?first:raster(packs,angle,resolution);if(!grid)continue;for(const vertical of verticalAllowed&&Math.abs(angle)<=30?[false,true]:[false]){
      const candidate=rectangle(grid,aspect,vertical,limit,angle);if(!candidate)continue;const {u,v}=candidate,box={x:u*grid.c-v*grid.s,y:u*grid.s+v*grid.c,angle,vertical,characters,text,size:candidate.size};
      for(let attempt=0;attempt<7;attempt++){box.size=Math.floor(box.size*10)/10;box.width=(vertical?1.3:aspect+.3)*box.size;box.height=(vertical?aspect+.3:1.3)*box.size;if(box.size<=0)break;if(fits(packs,box)){box.score=candidate.score*box.size/candidate.size;box.textWidth=aspect*box.size;box.lw=Math.abs(grid.c)*box.width+Math.abs(grid.s)*box.height;box.lh=Math.abs(grid.s)*box.width+Math.abs(grid.c)*box.height;if(!best||box.score>best.score)best={...box};break;}box.size*=.9;}
    }}layouts.set(key,best);if(layouts.size>1024)layouts.delete(layouts.keys().next().value);return best&&{...best};
  }
  function anchor(r){const p=region(r);if(!p||!p.rings.length)return null;if(p.anchor)return{...p.anchor};const grid=raster([p],0),box=grid&&rectangle(grid,1,false,Infinity,0);if(box&&contains([p],box.u,box.v)){p.anchor={x:box.u,y:box.v};return{...p.anchor};}return null;}
  // Administrative identity is explicit hierarchy, never a leaf's display name.
  // Missing hierarchy keeps independent outlines instead of inventing provinces.
  function administrativeGroups(map,owners){
    const rs=map.regions||[],index=new Map(rs.map(r=>[String(r.id),r])),registry=new Map((Array.isArray(map.circuitRegistry)?map.circuitRegistry:[]).map(r=>[String(r.key||r.id),r]));
    const upper=r=>/^(province|circuit|state|dao|省|道)$/.test(String(r.level||r.data&&r.data.level||''));
    return rs.map((r,i)=>{let p=r,seen=new Set(),key='',label='';while(p&&!seen.has(p)){seen.add(p);if(upper(p)){key=String(p.id||p.name);label=p.title||p.name;break;}const parent=p.parentId||p.data&&p.data.parentId;if(!parent)break;key=String(parent);const entry=registry.get(key);if(entry){label=entry.name;break;}p=index.get(key);}
      if(!key){key=String(r.circuitId||r.provinceId||r.circuitName||r.provinceName||r.province||r.id||i);label=r.circuitName||r.provinceName||r.province;}
      label=label||r.circuitName||index.get(key)?.title||index.get(key)?.name||r.title||r.name||'';const owner=String(owners[i]||'unowned');return{region:r,owner,group:owner+'|'+key,key,label};});
  }
  // Linear-size topology mesh: shared edges cancel only when the filled sides
  // belong to the same group. Collinear intervals also handle split T-junctions.
  // This does not rewrite/round the source path; rounding is only the match key.
  function boundaryMesh(items,tier){
    const rows=items.map(it=>({...it,pack:region(it.region)})).filter(it=>it.pack&&it.pack.rings.length),key=tier+'|'+rows.map(it=>[it.pack.version,it.owner,it.group].join(':')).join(';');
    if(meshes.has(key)){counts.meshHits++;return meshes.get(key);}counts.meshes++;
    const lines=new Map();let input=0;
    for(const it of rows)for(const rr of it.pack.rings){let depth=0;for(const other of it.pack.rings)if(other!==rr&&insideRing(other,rr[0].x,rr[0].y))depth++;const filled=(signedArea(rr)>=0?1:-1)*(depth%2?-1:1);
      for(let j=0,k=rr.length-1;j<rr.length;k=j++){
        let a=rr[k],b=rr[j],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-7)continue;input++;const dir=dx>0||dx===0&&dy>0?1:-1,ux=dx/len*dir,uy=dy/len*dir,offset=-uy*a.x+ux*a.y;
        const lk=ux.toFixed(7)+','+uy.toFixed(7)+','+offset.toFixed(4);let line=lines.get(lk);if(!line){line={ux,uy,offset,edges:[]};lines.set(lk,line);}const ta=a.x*ux+a.y*uy,tb=b.x*ux+b.y*uy;
        line.edges.push({lo:Math.min(ta,tb),hi:Math.max(ta,tb),side:filled*dir,owner:it.owner,group:tier==='realm'?it.owner:it.group});
      }
    }
    const major=[],minor=[];let hidden=0,segments=0;const n=v=>Number(v.toFixed(5));
    for(const line of lines.values()){
      const events=new Map();for(const e of line.edges){for(const [v,start] of [[e.lo,true],[e.hi,false]]){const k=v.toFixed(5);if(!events.has(k))events.set(k,{t:v,start:[],end:[]});events.get(k)[start?'start':'end'].push(e);}}
      const sorted=Array.from(events.values()).sort((a,b)=>a.t-b.t),active=new Set();for(let i=0;i<sorted.length-1;i++){const event=sorted[i];event.end.forEach(e=>active.delete(e));event.start.forEach(e=>active.add(e));const lo=event.t,hi=sorted[i+1].t;if(!active.size||hi-lo<1e-6)continue;segments++;
        const edges=Array.from(active),owners=new Set(edges.map(e=>e.owner)),groups=new Set(edges.map(e=>e.group)),sides=new Set(edges.map(e=>e.side));if(owners.size===1&&groups.size===1&&sides.size>1){hidden++;continue;}
        const path=owners.size>1||sides.size===1?major:minor,x1=line.ux*lo-line.uy*line.offset,y1=line.uy*lo+line.ux*line.offset,x2=line.ux*hi-line.uy*line.offset,y2=line.uy*hi+line.ux*line.offset;
        path.push([n(x1),n(y1),n(x2),n(y2)]);
      }
    }
    const result={major:stitchEdges(major),minor:stitchEdges(minor),input,segments,hidden,majorCount:major.length,minorCount:minor.length};meshes.set(key,result);if(meshes.size>8)meshes.delete(meshes.keys().next().value);return result;
  }
  // Joined contours avoid tens of thousands of independent SVG stroke caps.
  // Every input edge is visited exactly once, including enclaves and islands.
  function stitchEdges(edges){
    const nodes=new Map(),used=new Uint8Array(edges.length),parts=[];
    function add(x,y,i){const key=x+','+y;if(!nodes.has(key))nodes.set(key,[]);nodes.get(key).push(i);}
    edges.forEach((e,i)=>{add(e[0],e[1],i);add(e[2],e[3],i);});
    for(let i=0;i<edges.length;i++){if(used[i])continue;let [x,y]=edges[i],sx=x,sy=y,k=i,out='M'+x+' '+y;while(k!==undefined){used[k]=1;const e=edges[k];[x,y]=e[0]===x&&e[1]===y?[e[2],e[3]]:[e[0],e[1]];out+='L'+x+' '+y;if(x===sx&&y===sy){out+='Z';break;}k=(nodes.get(x+','+y)||[]).find(j=>!used[j]);}parts.push(out);}
    return parts.join('');
  }

  return{region,ringsFromPath,contains,fit,fits,anchor,textAspect,administrativeGroups,boundaryMesh,prepare,get stats(){return{...counts,cachedLayouts:layouts.size,preparing:pending.size};},clear(){prepareEpoch++;regions=new WeakMap();pathSources=new WeakMap();ringBands=new WeakMap();layouts.clear();meshes.clear();if(prepareWorker){prepareWorker.terminate();prepareWorker=null;}for(const p of pending.values())p.complete(null);clearTimeout(workerIdle);}};
});
