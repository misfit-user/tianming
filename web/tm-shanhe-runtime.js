/* 山河境 native adapter: current game polygons, labels and input only. No save/AI writes. */
(function(root){
'use strict';
if(root.__tmNativePreparation)return; // The opaque startup validator uses the original SVG, not interactive scenery.
const BASE=new URL('vendor/shanhe25d/',document.currentScript.src), DEG=Math.PI/180, TILT=42;
const apply=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
function inverse(m){const d=m[0]*m[3]-m[1]*m[2];if(!Number.isFinite(d)||Math.abs(d)<1e-12)throw Error('底图配准不可逆');return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const geoWorld=p=>[(p[0]-55)*20,(67-p[1])*20],worldGeo=p=>[55+p[0]/20,67-p[1]/20];
let enabled=new URLSearchParams(location.search).get('shanhe')!=='0',ready=null,renderer=null,canvas=null,current=null,activeStage=null,lastError=null;
let svgWatch=null,bootPending=false;
// Slow work remains in flight. Only actual failures retry, with bounded backoff.
const RETRY_DELAYS=[1000,3000,8000];
let retryTimer=0,retryCount=0,loading='idle',suspended=false,lastMap=null;
let frame=0,dirty=true,labelStamp='',records=new WeakMap(),labelRecords=new WeakMap(),restores=new Map(),loadEpoch=0,lastRendered='';
const timings=[],errors=[],profiles=new WeakMap();const picker=document.createElement('canvas').getContext('2d');
function refresh(){root.TMPhase8FormalBridge?.map?.renderFormalMapSoon();}
function remember(node,name){let attrs=restores.get(node);if(!attrs){attrs=new Map();restores.set(node,attrs);}if(!attrs.has(name))attrs.set(name,node.getAttribute(name));}
function restore(keepCanvas=false){if(focusRaf){cancelAnimationFrame(focusRaf);focusRaf=0;}if(svgWatch){svgWatch.disconnect();svgWatch=null;}for(const [node,attrs]of restores)for(const [name,value]of attrs){if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);}restores.clear();if(activeStage)activeStage.classList.remove('tmf-shanhe-active');activeStage=null;if(canvas){if(keepCanvas)canvas.style.visibility='hidden';else canvas.remove();}labelStamp='';lastRendered='';}
function cancelRetry(){if(retryTimer)clearTimeout(retryTimer);retryTimer=0;}
function dropRenderer(){restore();try{renderer?.dispose();}catch(e){console.warn('[山河境] 释放失效底图',e);}renderer=null;canvas=null;ready=null;current=null;focusDirty=true;}
function retrySoon(delay){
 if(retryTimer||!enabled||suspended)return;
 if(retryCount>=RETRY_DELAYS.length){loading='failed';updateButton();return;}
 const epoch=loadEpoch,wait=delay??RETRY_DELAYS[retryCount++];
 if(delay!=null)retryCount++;
 loading='recovering';
 retryTimer=setTimeout(()=>{retryTimer=0;if(epoch!==loadEpoch||!enabled||suspended)return;lastError=null;dropRenderer();bootstrap();refresh();},wait);
 updateButton();
}
function fail(error,retryable=false){lastError=String(error?.stack||error);errors.push(lastError);if(errors.length>8)errors.shift();console.error('[山河境]',error);loading='failed';restore();if(retryable){dropRenderer();retrySoon();}updateButton();}
function script(name){return new Promise((resolve,reject)=>{const s=document.createElement('script');const url=new URL(name,BASE);url.searchParams.set('v','B5-native-2-clarity1');s.src=url.href;s.onload=()=>{s.onload=s.onerror=null;resolve();};s.onerror=()=>{s.onload=s.onerror=null;s.remove();reject(Error('底图资源加载失败：'+name));};document.head.appendChild(s);});}
function bootstrap(){
 if(ready||bootPending)return ready;if(!enabled||suspended)return null;
 const epoch=++loadEpoch;bootPending=true;loading='loading';updateButton();
 ready=(async()=>{
  if(!root.TMShanhe25D?.Renderer)await script('engine.js');if(epoch!==loadEpoch)return;
  if(!root.TM_SHANHE_ENV)await script('environment.js');if(epoch!==loadEpoch)return;
  const targetCanvas=document.createElement('canvas');targetCanvas.className='tmf-shanhe-canvas';targetCanvas.setAttribute('aria-hidden','true');
  const urls={height:'height.png',albedo:'albedo.webp',water:'water.png',fallback:'fallback.webp'};for(const k of Object.keys(urls))urls[k]=new URL(urls[k],BASE).href;
  const r=await root.TMShanhe25D.Renderer.create(targetCanvas,root.TM_SHANHE_ENV,urls,{quality:'normal'});
  if(epoch!==loadEpoch){r.dispose();return;}if(!r.gl){r.dispose();throw Error('WebGL2未启用，已保留原地图');}
  canvas=targetCanvas;renderer=r;installCartography(r);
  canvas.addEventListener('webglcontextlost',()=>{if(renderer!==r)return;restore(true);loading='recovering';retrySoon(3000);updateButton();refresh();});
  canvas.addEventListener('webglcontextrestored',()=>{if(renderer!==r||r.lost)return;cancelRetry();dirty=true;focusDirty=true;lastError=null;loading='ready';refresh();});
  dirty=true;lastError=null;loading='ready';updateButton();refresh();
 })().catch(error=>{if(epoch===loadEpoch)fail(error,true);}).finally(()=>{if(epoch===loadEpoch)bootPending=false;});return ready;
}
// Convert only declared current coordinates. Never substitute the old review fixtures.
function projection(map){if(profiles.has(map))return profiles.get(map);let m,checks=0,maxError=0;const p=map.projection;
 if(p?.type==='equirectangular'&&finitePoint(p.offset)&&p.bbox?.length===4){const sx=Number(p.scaleX||p.scale),sy=Number(p.scaleY||p.scale);if(!(sx>0&&sy>0))throw Error('缺少地图比例');m=[sx,0,0,-sy,p.offset[0]-p.bbox[0]*sx,p.offset[1]+p.bbox[3]*sy];}
 else if(/^tianqi-prefecture/.test(String(map.id))&&Array.isArray(map.geographicReferences)){
  const s=8.0233106153169,a=1.4754689984884712,b=9.670324999283973e-7,c=5.11350135290467e-7,d=1.4754637602098157;
  const x=64-48.706749407286495*s,y=74.5962396826697+77.7323326083888*s;
  m=[a*s,b*s,-c*s,-d*s,a*x+c*y-169.54437093926194,b*x+d*y-251.36277969083244];
  for(const r of map.geographicReferences){if(r.accepted===false||!finitePoint(r.lonLat)||!finitePoint(r.xy))continue;const q=apply(m,r.lonLat),e=Math.hypot(q[0]-r.xy[0],q[1]-r.xy[1]);maxError=Math.max(maxError,e);checks++;}if(checks<20||maxError>.1)throw Error('明末现图配准校验失败');
 }else return null;
 const back=inverse(m);let centerMatches=0,centerOffsets=0,markerMaxOffset=0;for(const r of map.regions||[]){if(finitePoint(r.geographicCenter)&&finitePoint(r.center)){const q=apply(m,r.geographicCenter),e=Math.hypot(q[0]-r.center[0],q[1]-r.center[1]);if(e<.15){centerMatches++;maxError=Math.max(maxError,e);checks++;}else{centerOffsets++;markerMaxOffset=Math.max(markerMaxOffset,e);}}}if(centerOffsets&&centerMatches<Math.max(20,centerOffsets*4))throw Error('Declared projection does not match current coordinate evidence');
 if(maxError>.15)throw Error('现图地理控制点不一致');const wm=[20*back[0],-20*back[1],20*back[2],-20*back[3],20*(back[4]-55),20*(67-back[5])];
 const v={forward:m,back,world:new DOMMatrix(wm),sx:Math.hypot(m[0],m[1]),sy:Math.hypot(m[2],m[3]),checks,maxError,centerOffsets,markerMaxOffset};profiles.set(map,v);return v;
}
function nativeScenario(map,p){const settlements=[];for(const r of map.regions){let q=r.referenceSeat||r.operationalPoint||r.center||r.centroid;if(q&&!Array.isArray(q))q=[q.x,q.y];if(!finitePoint(q))continue;const g=apply(p.back,q);if(g[0]>=55&&g[0]<=160&&g[1]>=-10&&g[1]<=67)settlements.push({id:String(r.id||r.name),geo:g});}
 return {id:'native:'+map.id,settlements,registration:{currentLocalProjectTested:true,status:'current-declared-projection-control-checked'}};
}
// Transform the original SVG paths once and drape both current colors and native tier mesh.
// Display-only selection. Original click/dossier logic remains authoritative.
let hoveredId=null,selectedId=null,focusDirty=true,focusRaf=0;
function drawFocusSoon(){if(focusRaf||!active())return;focusRaf=requestAnimationFrame(()=>{focusRaf=0;if(!active()||!current)return;uploadFocus(renderer);renderer.render();});}
function setHovered(id){id=id==null?null:String(id);if(id===hoveredId)return;hoveredId=id;focusDirty=true;drawFocusSoon();}
function setSelected(id){id=id==null?null:String(id);if(id===selectedId)return;selectedId=id;focusDirty=true;drawFocusSoon();}
function uploadFocus(r){
 if(!r.gl||r.lost||!r.bounds||!r.nativeCartography)return;
 if(r.nativeFocusOwner!==r.overlayTexture){r.nativeFocusCanvas=document.createElement('canvas');r.nativeFocusCanvas.width=r.nativeFocusCanvas.height=1;r.nativeFocusTexture=r._texture(r.nativeFocusCanvas);r.nativeFocusOwner=r.overlayTexture;focusDirty=true;}
 const key=JSON.stringify([r.bounds,r.width,r.height,r.dpr,r.options.quality,r.view.span,hoveredId,selectedId,r.nativeCartography.svg.dataset.focusRevision||'']);
 if(!focusDirty&&key===r.nativeFocusKey)return;
 const b=r.bounds,w=b[2]-b[0],h=b[3]-b[1],[nx,ny]=r.rasterSize(),c=r.nativeFocusCanvas;
 c.width=nx;c.height=ny;const ctx=c.getContext('2d');ctx.setTransform(nx/w,0,0,ny/h,-b[0]*nx/w,-b[1]*ny/h);ctx.lineJoin='round';ctx.lineCap='round';
 const unit=r.view.span*20/r.width;
 for(const [id,isSelected]of [[hoveredId,false],[selectedId,true]]){if(id==null||(!isSelected&&id===selectedId))continue;const item=r.nativeCartography.items.find(it=>it.id===id);if(!item)continue;
  ctx.fillStyle=isSelected?'rgba(255,220,125,.14)':'rgba(255,246,205,.07)';ctx.fill(item.world,'evenodd');
  ctx.lineWidth=(isSelected?5.2:3.2)*unit;ctx.strokeStyle='rgba(39,29,19,.82)';ctx.stroke(item.world);
  ctx.lineWidth=(isSelected?2.7:1.6)*unit;ctx.strokeStyle=isSelected?'#ffe3a0':'#fff2d0';ctx.stroke(item.world);
 }
 const g=r.gl;g.activeTexture(g.TEXTURE5);g.bindTexture(g.TEXTURE_2D,r.nativeFocusTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,c);
 r.focusUploads=(r.focusUploads||0)+1;r.nativeFocusKey=key;focusDirty=false;
}

function installCartography(r){const legacy=r._uploadOverlay.bind(r);r._uploadOverlay=function(){const cart=this.nativeCartography;if(!cart)return legacy();if(this.lost||!this.bounds)return;const b=this.bounds,w=b[2]-b[0],h=b[3]-b[1],[nx,ny]=this.rasterSize(),cc=this.overlayCanvas.getContext('2d');this.overlayCanvas.width=nx;this.overlayCanvas.height=ny;cc.setTransform(nx/w,0,0,ny/h,-b[0]*nx/w,-b[1]*ny/h);cc.lineJoin='round';
  for(const item of cart.items){cc.globalAlpha=item.opacity;cc.fillStyle=item.color;cc.fill(item.world,'evenodd');}cc.globalAlpha=1;
  // Independent selection texture avoids rebuilding political colors on pointer motion.
  for(const edge of cart.edges){cc.strokeStyle=edge.color;cc.lineWidth=this.view.span*20/this.width*edge.width;cc.stroke(edge.path);}const g=this.gl;g.bindTexture(g.TEXTURE_2D,this.overlayTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.overlayCanvas);this.work.overlayUploads++;this.overlayOpacity=1;
 };}
function surfaceData(stage,map,p,state){const svg=stage.querySelector('#tmf-formal-map');if(!svg)return null;let rec=records.get(svg);if(rec)return rec;const nodes=[...svg.querySelectorAll('.tmf-region')],items=[],byCell=new Map(),step=Math.max(map.width,map.height)/40;
 for(const node of nodes){const d=node.getAttribute('d');if(!d)continue;const path=new Path2D(d),world=new Path2D();world.addPath(path,p.world);const b=node.getBBox();const item={node,id:node.dataset.regionId,path,world,color:getComputedStyle(node).fill||node.getAttribute('fill')||'#947257',opacity:clamp(Number.isFinite(Number(getComputedStyle(node).fillOpacity))?Number(getComputedStyle(node).fillOpacity):.68,0,1),box:[b.x,b.y,b.x+b.width,b.y+b.height]};items.push(item);
  for(let y=Math.floor(b.y/step);y<=Math.floor((b.y+b.height)/step);y++)for(let x=Math.floor(b.x/step);x<=Math.floor((b.x+b.width)/step);x++){const k=x+':'+y;if(!byCell.has(k))byCell.set(k,[]);byCell.get(k).push(item);}
 }
 const edges=[];for(const [selector,color,width]of [['.tmf-border-minor','#574e38',1.0],['.tmf-border-major','#e3c786',2.0]])for(const n of svg.querySelectorAll(selector)){const d=n.getAttribute('d');if(!d)continue;const path=new Path2D();path.addPath(new Path2D(d),p.world);edges.push({path,color:getComputedStyle(n).stroke||color,width:parseFloat(getComputedStyle(n).strokeWidth)||width});}
 if(!edges.length)for(const item of items)edges.push({path:item.world,color:'#665740',width:1});
 rec={svg,items,edges,byCell,step,fillOpacity:items[0]?.opacity||.68};records.set(svg,rec);return rec;
}
function updateButton(){
 const info=document.getElementById('tm-shanhe-source');if(info)info.textContent='版本 '+(document.querySelector('meta[name="tm-version"]')?.content||'?')+' · B5 接入 R2 · 清晰度C1'+(current?' · '+current.map.regions.length+' 地块':'');
 const b=document.getElementById('tm-shanhe-toggle');if(!b)return;
 b.textContent=!enabled?'底图：原版':active()?'底图：山河境 2.5D':loading==='recovering'?'底图：恢复 2.5D…':loading==='loading'?'底图：载入 2.5D…':lastError||loading==='failed'?'底图：原版（点击重试）':loading==='unsupported'?'底图：原版（未配准）':'底图：准备 2.5D…';
 b.setAttribute('aria-pressed',String(active()));b.title=lastError||loading==='failed'?'2.5D暂未启用，点击重试':loading==='unsupported'?'当前地图未提供地理配准，保留原地图':'切换背景显示，不改变地块与存档';
}
function ensureButton(){let dock=document.querySelector('#map-tools-pop');if(!dock||document.getElementById('tm-shanhe-toggle'))return;const line=document.createElement('div');line.className='tm-shanhe-setting';const b=document.createElement('button');b.id='tm-shanhe-toggle';b.type='button';b.className='map-layer';b.onclick=()=>setEnabled(!enabled||!!lastError||loading==='failed');const save=document.createElement('button');save.type='button';save.className='map-layer';save.textContent='导出底图诊断';save.onclick=exportDiagnostics;line.append(b,save);const info=document.createElement('small');info.id='tm-shanhe-source';info.style.cssText='display:block;width:100%;font-size:11px;opacity:.8';line.append(info);dock.append(line);updateButton();}
function setEnabled(value){enabled=!!value;cancelRetry();retryCount=0;lastError=null;dirty=true;labelStamp='';if(!enabled)restore();else{if(renderer?.lost)dropRenderer();if(!renderer&&!bootPending){ready=null;bootstrap();}}updateButton();refresh();}
function dimensions(stage,map,v){const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),ratio=Math.min(w/map.width,h/map.height);return {w,h,ratio,ox:(w-map.width*ratio)/2,oy:(h-map.height*ratio)/2,scale:v.scale};}
function cameraFor(map,p,v,size){const center=apply(p.back,[(map.width/2-v.tx)/v.scale,(map.height/2-v.ty)/v.scale]);if(center[0]<55||center[0]>160||center[1]<-10||center[1]>67)return null;return {center,span:clamp(size.w/(size.ratio*v.scale*p.sx),.1,300),tilt:TILT,bearing:0};}
function applyFrame(stage,map,v,state){
 suspended=false;ensureButton();
 if(lastMap!==map){lastMap=map;cancelRetry();retryCount=0;lastError=null;loading=bootPending?'loading':'idle';}
 if(!enabled||!map?.regions?.length){restore();updateButton();return false;}
 if(lastError){if(loading==='recovering'&&!retryTimer)retrySoon();updateButton();return false;}
 let p;try{p=projection(map);}catch(e){fail(e);return false;}
 if(!p){restore();loading='unsupported';updateButton();return false;}
 if(!renderer){if(!retryTimer)bootstrap();updateButton();return false;}
 if(renderer.lost){restore(true);retrySoon(3000);updateButton();return false;}
 try{const reattached=!activeStage;const size=dimensions(stage,map,v),view=cameraFor(map,p,v,size);if(!view){restore();return false;}const rec=surfaceData(stage,map,p,state);if(!rec)return false;const parent=rec.svg.closest('.tmf-prepared-map-surface');if(!parent){restore();loading='waiting-surface';updateButton();return false;}
  if((activeStage&&activeStage!==stage)||(current&&current.rec!==rec))restore();activeStage=stage;if(canvas.parentNode!==parent)parent.insertBefore(canvas,parent.firstChild);canvas.style.visibility='';stage.classList.add('tmf-shanhe-active');if(!svgWatch){svgWatch=new MutationObserver(changes=>{if(changes.some(c=>c.attributeName!=='class')){records.delete(rec.svg);dirty=true;refresh();}setSelected(rec.svg.querySelector('.tmf-region.selected')?.dataset.regionId||null);});svgWatch.observe(rec.svg,{subtree:true,attributes:true,attributeFilter:['fill','d','class','style']});}
  const changedMap=!current||current.map!==map;if(changedMap){selectedId=null;hoveredId=null;focusDirty=true;renderer._defer=true;try{renderer.setScenario(nativeScenario(map,p));}finally{renderer._defer=false;}dirty=true;}
  if(reattached){selectedId=rec.svg.querySelector('.tmf-region.selected')?.dataset.regionId||null;hoveredId=null;focusDirty=true;}const cartChanged=renderer.nativeCartography!==rec;renderer.nativeCartography=rec;renderer.overlayOpacity=1;if(cartChanged){focusDirty=true;const selected=rec.svg.querySelector('.tmf-region.selected');if(selected)selectedId=selected.dataset.regionId;}current={map,p,v:{...v},state,size,rec,view,labelSvg:current?.labelSvg,visibleLabels:current?.visibleLabels};
  const stamp=JSON.stringify([map.id,view,size.w,size.h,devicePixelRatio,state.mapScale,state.mapMode]);if(!dirty&&!cartChanged&&stamp===lastRendered){layoutLabels(stage);return true;}
  const start=performance.now(),uploads=renderer.work.overlayUploads;renderer.configure({view,size:{width:size.w,height:size.h,dpr:devicePixelRatio||1}});if(cartChanged&&renderer.work.overlayUploads===uploads)renderer._uploadOverlay();uploadFocus(renderer);const stats=renderer.render();frame++;dirty=false;lastRendered=stamp;layoutLabels(stage);loading='ready';retryCount=0;cancelRetry();timings.push({frame,updateMs:performance.now()-start,submitMs:stats.submitMs,triangles:stats.triangles,drawCalls:stats.drawCalls,gridRevision:stats.gridRevision,work:stats.work});if(timings.length>600)timings.shift();
  const readout=document.querySelector('[data-map-zoom-value]');if(readout)readout.textContent=(v.scale<10?v.scale.toFixed(1):v.scale.toFixed(0))+'×';stage.classList.toggle('zoomed',v.scale>1.35);updateButton();return true;
 }catch(e){fail(e,true);return false;}
}
function labelData(svg){let list=labelRecords.get(svg);if(list)return list;list=[];for(const node of svg.querySelectorAll('.tmf-territory-fit,.tmf-faction-label:not(.tmf-territory-fit),.tmf-region-label:not(.tmf-territory-fit),.tmf-sentinel')){const tr=node.transform.baseVal.consolidate()?.matrix;const x=Number(node.dataset.ax??tr?.e),y=Number(node.dataset.ay??tr?.f);if(!Number.isFinite(x+y))continue;const fs=Number(node.dataset.fs)||18,lw=Number(node.dataset.lw)||24,lh=Number(node.dataset.lh)||24;list.push({node,point:[x,y],fs,lw,lh,angle:tr?Math.atan2(tr.b,tr.a)/DEG:0,priority:Number(node.dataset.pr)||1});}list.sort((a,b)=>b.priority-a.priority);labelRecords.set(svg,list);return list;}
function layoutLabels(stage){if(!activeStage||activeStage!==stage||!current||!renderer||renderer.lost)return false;const svg=stage.querySelector('#tmf-map-labels');if(!svg)return true;const {map,p,v,size,state}=current;const stamp=[frame,state.mapScale,svg===current.labelSvg].join(':');if(labelStamp===stamp)return true;current.labelSvg=svg;
 remember(svg,'viewBox');remember(svg,'preserveAspectRatio');remember(svg,'style');svg.style.setProperty('width',renderer.width+'px','important');svg.style.setProperty('height',renderer.height+'px','important');svg.setAttribute('viewBox','0 0 '+size.w+' '+size.h);svg.setAttribute('preserveAspectRatio','none');const world=svg.querySelector('#tmf-label-world');if(world){remember(world,'transform');world.removeAttribute('transform');}
 const taken=[];let visible=0;for(const item of labelData(svg)){const n=item.node,g=apply(p.back,item.point),q=renderer.projectGeo(g);const base=size.ratio*v.scale;const ceiling=state.mapScale==='realm'?58:24,sc=Math.min(base,ceiling/item.fs),font=sc*item.fs;const bw=item.lw*sc,bh=item.lh*sc;const box=[q[0]-bw/2,q[1]-bh/2,q[0]+bw/2,q[1]+bh/2];
  let show=font>=3&&box[2]>=0&&box[0]<=size.w&&box[3]>=0&&box[1]<=size.h&&g[0]>=55&&g[0]<=160&&g[1]>=-10&&g[1]<=67;
  if(show&&taken.some(b=>box[0]<b[2]+2&&box[2]>b[0]-2&&box[1]<b[3]+2&&box[3]>b[1]-2))show=false;
  if(show){const back=renderer.unprojectScreen(q);show=Math.hypot(back[0]-g[0],back[1]-g[1])<.001;}
  for(const attr of ['transform','style','aria-hidden','class','tabindex'])remember(n,attr);n.classList.toggle('tmf-collide-hidden',!show);n.style.setProperty('display',show?'':'none','important');n.setAttribute('aria-hidden',String(!show));if(n.hasAttribute('data-faction-key'))n.setAttribute('tabindex',show?'0':'-1');
  if(show){n.setAttribute('transform','translate('+q[0]+' '+q[1]+') rotate('+item.angle+') scale('+sc+')');taken.push(box);visible++;}
 }current.visibleLabels=visible;labelStamp=stamp;return true;
}
function active(stage){return !!(enabled&&!lastError&&renderer&&!renderer.lost&&activeStage&&(!stage||stage===activeStage)&&canvas?.isConnected);}
function screenToGame(screen){if(!active())return null;const g=renderer.unprojectScreen(screen),p=apply(current.p.forward,g);return p[0]>=0&&p[1]>=0&&p[0]<=current.map.width&&p[1]<=current.map.height?p:null;}
// Renderer coordinates are CSS layout pixels; DOM client coordinates include fixed-fit scaling.
function clientToScreen(event){
 if(!event||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return null;
 const r=canvas.getBoundingClientRect();if(!(r.width>0&&r.height>0))return null;
 const x=(event.clientX-r.left)*renderer.width/r.width,y=(event.clientY-r.top)*renderer.height/r.height;
 return x>=0&&y>=0&&x<=renderer.width&&y<=renderer.height?[x,y]:null;
}
function pick(event){if(!active())return null;const screen=clientToScreen(event);if(!screen)return null;const q=screenToGame(screen);if(!q)return null;const {rec}=current,items=rec.byCell.get(Math.floor(q[0]/rec.step)+':'+Math.floor(q[1]/rec.step))||[];for(let i=items.length-1;i>=0;i--){const it=items[i],b=it.box;if(q[0]>=b[0]&&q[0]<=b[2]&&q[1]>=b[1]&&q[1]<=b[3]&&picker.isPointInPath(it.path,q[0],q[1],'evenodd'))return it.node;}return null;}
function panDelta(dx,dy){if(!active())return [dx,dy];const p=current.p,sx=p.sx,cos=Math.cos(TILT*DEG);return [(p.forward[0]*dx-p.forward[2]*dy/cos)/sx,(p.forward[1]*dx-p.forward[3]*dy/cos)/sx];}
function zoomAt(factor,x,y,state){if(!active()||!Number.isFinite(factor)||factor<=0)return false;const {size,map,p}=current,v=state.mapView||{scale:1,tx:0,ty:0},s=clamp(v.scale*factor,.72,128);const point=[size.ox+x*size.ratio,size.oy+y*size.ratio],g=renderer.unprojectScreen(point),q=geoWorld(g),span=clamp(size.w/(size.ratio*s*p.sx),.1,300),gain=72*renderer.options.relief*clamp(span/30,.30,1.30),pix=size.w/(span*20),t=TILT*DEG;
 const c=worldGeo([q[0]-(point[0]-size.w/2)/pix,q[1]-((point[1]-size.h/2)/pix+renderer.surfaceHeight(q)*gain*Math.sin(t))/Math.cos(t)]),cg=apply(p.forward,c);v.scale=s;v.tx=map.width/2-cg[0]*s;v.ty=map.height/2-cg[1]*s;state.mapView=v;return true;}
function diagnostics(){return {version:'B5-native-2',clarityVersion:'C1',sourceInfo:{entry:location.href,webVersion:document.querySelector('meta[name="tm-version"]')?.content,background:'B5-approved-no-B6',scenarioId:root.GM?.sid,mapId:current?.map.id,mapRevision:current?.map.authoringRevision||current?.map.version||null,readFrom:'current-runtime-map'},selection:{selectedId,hoveredId,focusUploads:renderer?.focusUploads||0},enabled,active:active(),loading,retryCount,bootPending,lastError,frame,mapId:current?.map.id,regions:current?.map.regions.length,coordinateChecks:current?.p.checks,coordinateMaxError:current?.p.maxError,relocatedCenterMetadata:{count:current?.p.centerOffsets,maxMapPixels:current?.p.markerMaxOffset},mode:renderer?.mode,view:renderer?.view,stats:renderer?.stats,visibleLabels:current?.visibleLabels,errors:errors.slice(),samples:timings.slice(),metricNote:'updateMs includes CPU configure/render/label submission; not GPU completion or guaranteed FPS',source:'current-game-map-no-frozen-review-fixtures',height:'artistic-not-simulation-input'};}
function exportDiagnostics(){const blob=new Blob([JSON.stringify(diagnostics(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='天命-山河境-运行诊断.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function hide(){suspended=true;cancelRetry();hoveredId=null;restore();dirty=true;updateButton();}
function invalidate(map){cancelRetry();retryCount=0;lastError=null;restore();if(map)profiles.delete(map);else if(current?.map)profiles.delete(current.map);records=new WeakMap();labelRecords=new WeakMap();current=null;if(renderer)renderer.nativeCartography=null;dirty=true;labelStamp='';}
const css=document.createElement('style');css.textContent='.tmf-shanhe-active .ming-map-camera{visibility:hidden!important;pointer-events:none!important}.tmf-shanhe-active .tmf-prepared-map-surface{position:absolute;inset:0;isolation:isolate}.tmf-shanhe-canvas{position:absolute;left:0;top:0;z-index:0;pointer-events:none!important}.tmf-shanhe-active .tmf-map-label-overlay{z-index:2;background:transparent!important;pointer-events:none}.tmf-shanhe-active .tmf-realm-fit[aria-hidden="false"]{pointer-events:visiblePainted}.tm-shanhe-setting{display:flex;gap:5px;flex-wrap:wrap;padding:6px}.tm-shanhe-setting button{font-size:12px}';document.head.appendChild(css);
css.textContent+="body.tm-phase8-formal .tmf-shanhe-active #tmf-map-labels,body.tm-phase8-formal .tmf-shanhe-active #tmf-map-labels *{transition:none!important;animation:none!important;transform-origin:0 0!important;}body.tm-phase8-formal .tmf-shanhe-active #tmf-map-labels .tmf-realm-fit{pointer-events:visiblePainted!important;}";
root.TMShanheRuntime={apply:applyFrame,active,pick,panDelta,zoomAt,layoutLabels,setEnabled,diagnostics,exportDiagnostics,hide,invalidate,projection,screenToGame,setHovered,setSelected,projectGame(p){return active()?renderer.projectGeo(apply(current.p.back,p)):null;}};
root.addEventListener('pagehide',()=>{++loadEpoch;suspended=true;cancelRetry();dropRenderer();bootPending=false;lastError=null;retryCount=0;lastMap=null;loading='idle';});
root.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;dirty=true;refresh();}});
})(window);
