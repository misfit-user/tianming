/* B5 display-only geometry safety. Units are map-art units, never real city extents.
 * Broad-phase spatial bins + exact circle/segment/triangle tests.
 * River/lake/shore coordinates are immutable. Only decorative origins may move.
 */
(function(root){
'use strict';
const CELL=24, EPS=1e-7;
const key=(x,y)=>x+','+y;
function segDistance2(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
 const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;
 return (p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;}
function inTriangle(p,a,b,c){const cross=(a,b)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const x=cross(a,b),y=cross(b,c),z=cross(c,a);return !((x<-EPS||y<-EPS||z<-EPS)&&(x>EPS||y>EPS||z>EPS));}
class Bins{
 constructor(){this.cells=new Map();this.large=[];this.count=0;}
 insert(item,b){item.box=b;this.count++;const x0=Math.floor(b[0]/CELL),x1=Math.floor(b[2]/CELL),z0=Math.floor(b[1]/CELL),z1=Math.floor(b[3]/CELL);
  if((x1-x0+1)*(z1-z0+1)>256){this.large.push(item);return;}
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const k=key(x,z);if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(item);}}
 query(p,r){const out=new Set(this.large);for(let z=Math.floor((p[1]-r)/CELL);z<=Math.floor((p[1]+r)/CELL);z++)for(let x=Math.floor((p[0]-r)/CELL);x<=Math.floor((p[0]+r)/CELL);x++)for(const s of this.cells.get(key(x,z))||[])out.add(s);return out;}
 clear(){this.cells.clear();this.large=[];}
}
function rings(path){return (path.match(/[Mm][^Mm]*/g)||[]).map(chunk=>{const a=(chunk.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)||[]).map(Number),pts=[];for(let i=0;i<a.length-1;i+=2)pts.push([a[i],a[i+1]]);return pts;});}
class Safety{
 constructor(env){this.lines=new Bins();this.lakes=new Bins();this.land=[];this.queries=0;
  const add=(a,b,kind,pad)=>this.lines.insert({a,b,kind,pad},[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]);
  for(const r of env.rivers||[])for(const pts of rings(r.d))for(let i=1;i<pts.length;i++)add(pts[i-1],pts[i],'river',r.major?.65:.29);
  for(const land of env.landPaths||[]){this.land.push({b:land.b,path:new Path2D(land.d)});for(const pts of rings(land.d))for(let i=0;i<pts.length;i++)add(pts[i],pts[(i+1)%pts.length],'shore',.10);}
  for(const lake of env.lakeFaces||[]){for(let i=0;i<lake.f.length;i+=6){const a=lake.f.slice(i,i+2),b=lake.f.slice(i+2,i+4),c=lake.f.slice(i+4,i+6);this.lakes.insert({a,b,c},[Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1]),Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1])]);}}
  this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=1;this.ctx=this.canvas.getContext('2d');
 }
 onLand(p){return this.land.some(v=>p[0]>=v.b[0]&&p[0]<=v.b[2]&&p[1]>=v.b[1]&&p[1]<=v.b[3]&&this.ctx.isPointInPath(v.path,p[0],p[1],'evenodd'));}
 hit(p,r=0,{shore=true}={}){this.queries++;
  for(const s of this.lines.query(p,r+.7)){if(!shore&&s.kind==='shore')continue;if(segDistance2(p,s.a,s.b)<=(r+s.pad)**2+EPS)return s.kind;}
  for(const t of this.lakes.query(p,r)){if(inTriangle(p,t.a,t.b,t.c)||segDistance2(p,t.a,t.b)<=r*r+EPS||segDistance2(p,t.b,t.c)<=r*r+EPS||segDistance2(p,t.c,t.a)<=r*r+EPS)return 'lake';}
  return null;
 }
 safe(p,r=0){return this.onLand(p)&&!this.hit(p,r);}
 dispose(){this.lines.clear();this.lakes.clear();this.land=[];this.ctx=null;this.canvas.width=this.canvas.height=1;}
}
root.TMShanhePlacement=Object.freeze({Safety,Bins,segDistance2,inTriangle,version:'B5.0'});
})(typeof window!=='undefined'?window:globalThis);

/* B5 authored environment geometry. Decorative, exaggerated scale; not surveyed buildings.
 * Every solid has a local ground anchor: roofs remain horizontal on sloped terrain.
 * No text, event handlers, game state, external libraries, or random global state.
 */
(function(root){
'use strict';
const TAU=Math.PI*2;
const baseKinds=['fields','rivers','paths','trees','pine','village','village-wet','village-dry','town','town-wet','town-dry','village-alt','village-wet-alt','village-dry-alt'];
const kinds=[...baseKinds,...baseKinds.filter(k=>k.startsWith('town')||k.startsWith('village')).map(k=>k+'-lod')];
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function build(kind){
 const lod=kind.endsWith('-lod');if(lod)kind=kind.slice(0,-4);
 const alternate=kind.endsWith('-alt');if(alternate)kind=kind.slice(0,-4);
 const verts=[];let anchor=[0,0];
 const wet=kind.endsWith('-wet'),dry=kind.endsWith('-dry');
 const stone=dry?[.59,.46,.31]:[.43,.46,.40],wall=wet?[.79,.78,.66]:dry?[.67,.54,.37]:[.66,.61,.48];
 const roofcol=wet?[.25,.31,.31]:dry?[.37,.35,.29]:[.31,.36,.35];
 const wood=[.32,.21,.14],sand=[.62,.56,.40];
 function tri(a,b,c,col){const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];let l=Math.hypot(...n)||1;n=n.map(v=>v/l);for(const p of [a,b,c])verts.push(...p,...n,...col,...anchor);}
 function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col);}
 function box(x,y,z,w,h,d,col){let [l,r,n,s,t]=[x-w/2,x+w/2,z-d/2,z+d/2,y+h];
  quad([l,y,n],[l,t,n],[r,t,n],[r,y,n],col);quad([r,y,s],[r,t,s],[l,t,s],[l,y,s],col);
  quad([l,y,s],[l,t,s],[l,t,n],[l,y,n],col);quad([r,y,n],[r,t,n],[r,t,s],[r,y,s],col);
  quad([l,t,n],[l,t,s],[r,t,s],[r,t,n],col);
 }
 function roof(x,y,z,w,d,h,col,tiles=true){
  // Four sloped wings around one ridge, a gently concave profile, restrained upturned corners.
  const ridge=[[-w*.28,0],[w*.28,0]],corners=[[-w*.55,-d*.57],[w*.55,-d*.57],[w*.55,d*.57],[-w*.55,d*.57]];
  const rr=[[0,1],[1,1],[1,0],[0,0]];
  const p=(q,t,r)=>[x+r[0]*(1-t)+q[0]*t,y+h*Math.pow(1-t,1.65)+.05*Math.pow(t,6),z+q[1]*t];
  const steps=lod?1:4;for(let k=0;k<4;k++)for(let j=0;j<steps;j++){
   const a=j/steps,b=(j+1)/steps,q=corners[k],s=corners[(k+1)%4],r=ridge[rr[k][0]],v=ridge[rr[k][1]];
   quad(p(q,a,r),p(s,a,v),p(s,b,v),p(q,b,r),col.map((c,i)=>c*(1+j*.019)));
  }
  box(x,y+h,z,w*.65,.045,.055,col.map(c=>c*.78));
  // Tile seams are geometry, not borrowed texture or text. Limited to the broad roof slopes.
  if(tiles&&!lod&&w>.8){const count=Math.min(12,Math.floor(w*8));for(let k=1;k<count;k++){
   const xx=x+(k/count-.5)*w*.8;for(const side of [-1,1])for(let j=0;j<3;j++){
    const t0=j/3,t1=(j+1)/3;const z0=z+side*d*.55*t0,z1=z+side*d*.55*t1;
    const y0=y+h*Math.pow(1-t0,1.65)+.055*Math.pow(t0,6)+.008,y1=y+h*Math.pow(1-t1,1.65)+.055*Math.pow(t1,6)+.008;
    quad([xx-.008,y0,z0],[xx+.008,y0,z0],[xx+.008,y1,z1],[xx-.008,y1,z1],col.map(c=>c*.82));
   }
  }}
 }
 function hall(x,z,w,d,h=.6,grand=false){
  anchor=[x,z];box(x,0,z,w+.14,.14,d+.15,stone);box(x,.14,z,w,h,d,wall);
  // Dark door, small front openings and exposed timber make a readable inhabited facade.
  box(x,.15,z+d*.502,w*.14,h*.71,.015,wood);
  if(!lod)for(const side of [-1,1])box(x+side*w*.29,.30,z+d*.505,w*.15,h*.27,.016,[.24,.29,.25]);
  if(!lod)for(let k=-1;k<=1;k++)box(x+k*w*.36,.14,z+d*.55,.035,h+.015,.04,wood);
  roof(x,.14+h,z,w*1.09,d*1.17,h*.62,roofcol,grand);
  if(grand){box(x,.03,z+d*.61,w*.38,.065,.28,stone);box(x,.01,z+d*.74,w*.42,.035,.22,stone);}
 }
 function wallSegment(x,z,w,d,h=.32,crenels=false){anchor=[x,z];box(x,.01,z,w,h,d,stone);box(x,h,z,w+.035,.045,d+.06,roofcol);
  if(crenels&&!lod){const long=Math.max(w,d),num=Math.max(1,Math.floor(long/.32));for(let i=0;i<num;i++)box(x+(w>d?(i+.5)/num*w-w/2:0),h+.04,z+(d>w?(i+.5)/num*d-d/2:0),w>d?.16:w+.02,.10,d>w?.16:d+.02,stone);}}
 function court(x,z,w=1.8,d=1.65){
  hall(x,z-d*.34,w*.84,d*.31,.43);hall(x-w*.34,z+d*.10,w*.22,d*.55,.30);hall(x+w*.34,z+d*.10,w*.22,d*.55,.30);
  wallSegment(x,z+d*.42,w,.055,.18);anchor=[x,z];box(x,.009,z,w*.51,.013,d*.47,sand);
 }
 if(kind.startsWith('town')){
  const rw=wet?5.25:5.8,rh=wet?4.3:4.9;
  // Segmented enclosure drapes piece by piece rather than placing one huge flat slab.
  for(const side of [-1,1]){
   for(let x=-rw+.48;x<rw;x+=.96)if(Math.abs(x)>.72)wallSegment(x,side*rh,.96,.25,.45,true);
   for(let z=-rh+.5;z<rh;z+=1)wallSegment(side*rw,z,.25,1,.45,true);
   hall(0,side*rh,1.20,.8,.88,true);
   for(const x of [-rw,rw])hall(x,side*rh,.72,.72,.74);
  }
  // Inner ceremonial axis is surrounded by modest ward blocks, not a single oversized palace.
  hall(0,-2.05,2.7,1.3,.90,true);hall(0,.3,2.15,1,.60,true);
  hall(-1.40,-.8,.65,1.0,.44);hall(1.40,-.8,.65,1.0,.44);
  hall(0,2.4,1.18,.72,.58,true);
  for(const side of [-1,1])for(let k=0;k<(lod?2:3);k++){
   let x=side*(3.0+(k%2)*.34),z=-2.8+k*2.1;
   court(x,z,1.82,1.65);
  }
  if(!lod)for(const x of [-4.7,4.7])for(const z of [-2.8,-.7,1.6,3.3])hall(x,z,.8,.65,.3);
  anchor=[0,0];box(0,.003,0,.36,.015,9.5,sand);
  if(!lod){
   for(const x of [-2,2]){anchor=[x,0];box(x,.006,0,.17,.012,8,sand);}
   for(const z of [-3.8,1.4,3.5]){anchor=[0,z];box(0,.006,z,10.1,.012,.17,sand);}
   // An open-sided roadside shelter and two small awnings, without writing or icons.
   const x=-1.65,z=2.4;anchor=[x,z];box(x,0,z,.62,.09,.60,stone);
   for(const dx of [-.23,.23])for(const dz of [-.21,.21])box(x+dx,.09,z+dz,.045,.48,.045,wood);
   roof(x,.57,z,.76,.72,.23,roofcol,false);
   for(const sx of [-1,1]){anchor=[sx*1.35,1.4];box(sx*1.35,.10,1.4,.62,.26,.31,wood);roof(sx*1.35,.43,1.4,.83,.58,.12,[.51,.41,.29],false);}
  }
  if(wet){hall(-1.5,3.25,.82,.52,.42);hall(1.7,3.6,.7,.55,.4);}
 }else if(kind.startsWith('village')){
  const r=random(wet?1127:dry?773:840);
  if(wet){for(let i=0;i<(alternate?6:9);i++){const z=(i-4)*.65,x=(i%2?1:-1)*(.65+r()*.6);hall(x,z,.56+r()*.35,.46+r()*.22,.30+r()*.17);}}
  else if(dry){court(alternate?-.5:-.95,-.6,1.55,1.2);court(1.1,alternate?1.2:.65,1.4,1.1);hall(-1.2,1.3,.55,.43,.27);hall(1.6,-1.2,.65,.48,.3);}
  else if(alternate){court(0,0,2.0,1.8);hall(-1.6,-.8,.85,.55,.33);hall(1.9,.8,.62,.49,.29);hall(.8,1.65,.81,.56,.36);}
  else{court(-1.0,-.6,1.7,1.35);court(1.2,.8,1.6,1.35);hall(-1.7,1.6,.68,.50,.32);hall(.85,-1.7,.66,.48,.33);}
 }else if(kind==='trees'||kind==='pine'){
  const pine=kind==='pine';
  for(const [x,z,s] of [[0,0,1]]){
   anchor=[x,z];box(x,0,z,.07,.48*s,.07,[.25,.23,.16]);
   const rings=pine?[[.20,.34],[.80,.07],[.62,.28],[1.18,.03]]:[[.35,.20],[.55,.48],[.87,.45],[1.14,.2],[1.24,.015]];
   const c=pine?[.19,.31,.23]:[.30,.43,.27];
   for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){
    const a=TAU*i/8,b=TAU*(i+1)/8;const p=(k,t)=>[x+Math.cos(t)*rings[k][1]*s,rings[k][0]*s,z+Math.sin(t)*rings[k][1]*s];
    quad(p(j,a),p(j+1,a),p(j+1,b),p(j,b),c.map(v=>v*(.92+j*.045)));
   }
  }
 }
 return new Float32Array(verts);
}
const radii=new Map();function radius(kind){if(!radii.has(kind)){const v=build(kind);let r=0;for(let i=0;i<v.length;i+=11)r=Math.max(r,Math.hypot(v[i],v[i+2]));radii.set(kind,r);}return radii.get(kind);}
root.TMShanheModels=Object.freeze({build,radius,kinds:Object.freeze(kinds),stride:44,version:'B5.0'});
})(typeof window!=='undefined'?window:globalThis);

/*
 * Tianming Shanhe B5 — display-only 2.5D heightfield renderer, zero dependencies.
 * No gameplay controls, text drawing, game state, storage, network or animation loop.
 * Heightfield is normalized ART, NOT a DEM and NOT simulation input.
 * Map coordinates: x=(lon-55)*20; z=(67-lat)*20. A single-valued y=h(x,z).
 */
(function(root){
'use strict';
const W=2100,H=1540,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=Number.isFinite;
const geo=p=>[(p[0]-55)*20,(67-p[1])*20];
const ungeo=p=>[p[0]/20+55,67-p[1]/20];
function validPoint(p){return Array.isArray(p)&&p.length===2&&p.every(finite);}
function hash(s){let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function rng(n){return ()=>{n=(n+0x6D2B79F5)|0;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
function loadImage(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('背景资源读取失败'));im.src=url;});}
function viewValidate(v){
 if(!validPoint(v.center)||v.center[0]<55||v.center[0]>160||v.center[1]<-10||v.center[1]>67)throw new TypeError('镜头中心超出共用范围');
 for(const k of ['span','tilt','bearing'])if(!finite(v[k]))throw new TypeError('镜头参数必须为有限数字');
 if(v.span<.1||v.span>300||v.tilt<0||v.tilt>52||Math.abs(v.bearing)>45)throw new RangeError('镜头参数越界');
 return {...v,center:v.center.slice()};
}
const GLSL_PROJECT=`
uniform vec2 uCenter;uniform vec2 uViewport;uniform float uSpan;uniform float uTilt;uniform float uBearing;
uniform float uGain;uniform sampler2D uHeight;
uniform vec4 uGridBounds;uniform vec2 uGridRes;
float rawHeight(vec2 p){if(p.x<0.||p.y<0.||p.x>2100.||p.y>1540.)return 0.;vec4 a=texture(uHeight,p/vec2(2100.,1540.));return (a.r*65280.+a.g*255.)/65535.*uGain;}
float heightAt(vec2 p){vec2 uv=(p-uGridBounds.xy)/(uGridBounds.zw-uGridBounds.xy)*uGridRes;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,uGridRes)))return rawHeight(p);
 vec2 ij=min(floor(uv),uGridRes-1.),f=uv-ij;vec2 step=(uGridBounds.zw-uGridBounds.xy)/uGridRes,origin=uGridBounds.xy+ij*step;
 float a=rawHeight(origin),b=rawHeight(origin+vec2(step.x,0.)),c=rawHeight(origin+vec2(0.,step.y)),d=rawHeight(origin+step);
 return f.x+f.y<=1.?a+(b-a)*f.x+(c-a)*f.y:d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);
}
vec4 projectWorld(vec3 p){vec2 d=p.xz-uCenter;float ca=cos(uBearing),sa=sin(uBearing);float x=d.x*ca-d.y*sa;float z=d.x*sa+d.y*ca;float yy=z*cos(uTilt)-p.y*sin(uTilt);float ww=uSpan*20.;return vec4(2.*x/ww,-2.*yy/(ww*uViewport.y/uViewport.x),-(z*sin(uTilt)+p.y*cos(uTilt))/2600.,1.);}
`;
const TERRAIN_VS=`#version 300 es
precision highp float;layout(location=0)in vec2 aPos;out vec2 vUV;out vec3 vWorld;${GLSL_PROJECT}
void main(){vUV=aPos/vec2(2100.,1540.);vWorld=vec3(aPos.x,rawHeight(aPos),aPos.y);gl_Position=projectWorld(vWorld);}`;
const TERRAIN_FS=`#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;out vec4 fragColor;
uniform sampler2D uHeight;uniform sampler2D uAlbedo;uniform sampler2D uOverlay;uniform sampler2D uWater;uniform sampler2D uCoast;uniform vec4 uGridBounds;
uniform sampler2D uNativeFocus;uniform float uNativeFocusMix;uniform float uNativePolitical;
uniform float uSeason;uniform float uGain;uniform vec3 uSun;uniform float uOverlayMix;uniform float uTime;uniform float uDetail;uniform float uTilt;
float h(vec2 p){vec4 a=texture(uHeight,p/vec2(2100.,1540.));return (a.r*65280.+a.g*255.)/65535.*uGain;}
float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash2(i),hash2(i+vec2(1.,0.)),f.x),mix(hash2(i+vec2(0.,1.)),hash2(i+vec2(1.,1.)),f.x),f.y);}
// Positive cubic color reconstruction on magnification; geometry height remains bilinear.
vec3 terrainColor(vec2 uv){
 vec2 size=vec2(textureSize(uAlbedo,0)),p=uv*size-.5;
 vec3 regular=texture(uAlbedo,uv).rgb;
 float footprint=max(length(dFdx(p)),length(dFdy(p)));
 if(footprint>=1.)return regular;
 vec2 i=floor(p),f=fract(p),f2=f*f,f3=f2*f;
 vec2 w0=(1.-3.*f+3.*f2-f3)/6.,w1=(4.-6.*f2+3.*f3)/6.;
 vec2 w2=(1.+3.*f+3.*f2-3.*f3)/6.,w3=f3/6.;
 vec2 a=w0+w1,b=w2+w3,lo=(i-1.+w1/a+.5)/size,hi=(i+1.+w3/b+.5)/size;
 vec3 top=mix(textureLod(uAlbedo,vec2(lo.x,lo.y),0.).rgb,textureLod(uAlbedo,vec2(hi.x,lo.y),0.).rgb,b.x);
 vec3 bottom=mix(textureLod(uAlbedo,vec2(lo.x,hi.y),0.).rgb,textureLod(uAlbedo,vec2(hi.x,hi.y),0.).rgb,b.x);
 return mix(mix(top,bottom,b.y),regular,smoothstep(.65,1.,footprint));
}
float filteredNoise(vec2 p){float footprint=max(length(dFdx(p)),length(dFdy(p)));return mix(noise2(p),.5,smoothstep(.4,1.5,footprint));}

void main(){
 if(vUV.x<0.||vUV.x>1.||vUV.y<0.||vUV.y>1.){fragColor=vec4(.055,.115,.125,1.);return;}
 vec4 terrain=texture(uHeight,vUV);vec3 col=terrainColor(vUV);float surface=h(vWorld.xz);
 vec4 shore=texture(uCoast,(vWorld.xz-uGridBounds.xy)/(uGridBounds.zw-uGridBounds.xy));
 shore.rgb*=shore.a;float water=1.-smoothstep(.08,.92,shore.r);float river=texture(uWater,vUV).r;
 // Vector-rasterized coverage replaces the enlarged old coastline pixels; it is not a new coastline reconstruction.
 col=mix(col,vec3(.58,.62,.46),clamp((.98-terrain.b)*1.2,0.,1.)*(1.-water));
 vec3 sea=mix(vec3(.066,.19,.219),vec3(.28,.45,.435),clamp(shore.g,0.,.8));
 col=mix(col,sea,water);
 float dx=h(vWorld.xz+vec2(1.,0.))-h(vWorld.xz-vec2(1.,0.));
 float dz=h(vWorld.xz+vec2(0.,1.))-h(vWorld.xz-vec2(0.,1.));
 vec3 n=normalize(vec3(-dx*.55,1.,-dz*.55));
 float diff=max(0.,dot(n,uSun));
 float shadow=1.;
 if(uDetail>.5&&water<.9&&uGain>.001){
  vec2 sd=normalize(uSun.xz);float rise=uSun.y/max(.12,length(uSun.xz));
  for(int i=1;i<=5;i++){float dist=float(i*i)*1.25;float obstruction=h(vWorld.xz+sd*dist)-surface-rise*dist;shadow=min(shadow,1.-.35*smoothstep(.1,2.8,obstruction));}
 }
 float concavity=clamp((h(vWorld.xz+vec2(2.,0.))+h(vWorld.xz-vec2(2.,0.))+h(vWorld.xz+vec2(0.,2.))+h(vWorld.xz-vec2(0.,2.))-4.*surface)*.14,0.,.22);
 float light=(.63+.59*diff)*shadow-concavity;
 col*=mix(light,1.,water);
 float altitude=(terrain.r*65280.+terrain.g*255.)/65535.;
 if(uSeason>.5&&uSeason<1.5)col=mix(col,col*vec3(.94,1.075,.93),.45*(1.-water));
 if(uSeason>1.5&&uSeason<2.5)col=mix(col,col*vec3(1.13,1.015,.85),.66*(1.-water));
 if(uSeason>2.5){float snow=smoothstep(.13,.38,altitude)*smoothstep(.46,.87,1.-vUV.y);col=mix(col,col*vec3(.99,1.00,1.055),.40*(1.-water));col=mix(col,vec3(.80,.85,.83)*light,snow*(1.-water)*.84);}
 vec4 ov=texture(uOverlay,(vWorld.xz-uGridBounds.xy)/(uGridBounds.zw-uGridBounds.xy));float oa=ov.a*uOverlayMix*(1.-water);col=mix(col,mix(ov.rgb*(.65+.46*diff),ov.rgb,uNativePolitical),oa);vec4 focus=texture(uNativeFocus,(vWorld.xz-uGridBounds.xy)/(uGridBounds.zw-uGridBounds.xy));col=mix(col,focus.rgb,focus.a*uNativeFocusMix);
 // Inland water is drawn as draped vector triangles, not a magnified pixel mask.
 float wave=sin(vWorld.x*.53+vWorld.z*.22+uTime*.32)*sin(vWorld.z*1.8-vWorld.x*.13-uTime*.18);
 col+=vec3(.08,.11,.105)*water*(.10+.14*pow(max(0.,wave),8.));
 float foam=water*(1.-water)*.19;col+=vec3(.38,.38,.25)*foam;
 float coarse=filteredNoise(vWorld.xz*.85),fine=filteredNoise(vWorld.xz*3.1);float grain=(fine-.5)*.010;col+=grain*(1.-water);
 float slope=clamp(length(vec2(dx,dz))*.8,0.,1.);float phaseX=vWorld.x*21.+sin(vWorld.z*7.)*1.5,phaseZ=vWorld.z*14.;float strata=sin(phaseX)*sin(phaseZ);float band=1.-smoothstep(.65,2.4,max(fwidth(phaseX),fwidth(phaseZ)));col*=1.+strata*.016*slope*(1.-water)*band;float grit=coarse*.72+fine*.28;col*=1.+(grit-.5)*.12*slope*(1.-water);
 float air=clamp(gl_FragCoord.y/1800.,0.,1.)*.025*sin(uTilt);col=mix(col,vec3(.61,.67,.64),air);fragColor=vec4(clamp(col,0.,1.),1.);
}`;
const MODEL_VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;layout(location=2)in vec3 aColor;
layout(location=3)in vec4 aInstance;layout(location=4)in vec2 aAnchor;
uniform float uDrape;uniform float uModelGain;uniform float uShadowPass;uniform vec3 uSun;
out vec3 vNormal;out vec3 vColor;out vec3 vWorld;out float vAO;${GLSL_PROJECT}
void main(){float c=cos(aInstance.w),s=sin(aInstance.w);mat2 rot=mat2(c,s,-s,c);
 vec2 p=rot*aPos.xz*aInstance.z+aInstance.xy,base=rot*aAnchor*aInstance.z+aInstance.xy;
 float hh=heightAt(mix(base,p,uDrape));vWorld=vec3(p.x,hh+aPos.y*aInstance.z*uModelGain+.045,p.y);
 vNormal=vec3(aNormal.x*c-aNormal.z*s,aNormal.y,aNormal.x*s+aNormal.z*c);
 vColor=aColor*(.95+.10*fract(sin(dot(aInstance.xy,vec2(12.989,78.233)))*43758.5453));
 vAO=mix(.77,1.,smoothstep(.04,.85,aPos.y));
 if(uShadowPass>.5){vec2 q=p;for(int i=0;i<4;i++)q=p-uSun.xz/max(.26,uSun.y)*max(0.,vWorld.y-heightAt(q));vWorld=vec3(q.x,heightAt(q)+.033,q.y);}
 gl_Position=projectWorld(vWorld);
}`;
const MODEL_FS=`#version 300 es
precision highp float;in vec3 vNormal;in vec3 vColor;in vec3 vWorld;in float vAO;
out vec4 fragColor;uniform vec3 uSun;uniform float uOpacity;uniform vec3 uTint;uniform float uShadowPass;uniform float uSeason;uniform float uMaterial;
void main(){if(uShadowPass>.5){fragColor=vec4(.07,.12,.11,uOpacity);return;}
 vec3 n=normalize(vNormal);float d=max(0.,dot(n,uSun));float sky=.5+.5*n.y;
 vec3 col=vColor*uTint*(.54+.57*d)*vAO+vec3(.021,.025,.028)*sky;
 if(uMaterial<2.5){
  if(uSeason>1.5&&uSeason<2.5&&uMaterial>.5){vec3 fall=uMaterial<1.5?vec3(.61,.45,.22):vec3(.68,.58,.32);float variation=fract(sin(dot(vWorld.xz,vec2(.41,.73)))*912.7);col=mix(col,fall*(.6+.4*d),.48+variation*.24);}
  if(uSeason>.5&&uSeason<1.5&&uMaterial>.5)col*=vec3(.96,1.06,.94);
  if(uSeason>2.5){float dust=uMaterial<.5?max(0.,n.y)*.25:uMaterial<1.5?.24:.20;col=mix(col,vec3(.72,.77,.73),dust);}
 }
 if(uMaterial>3.5&&uSeason>2.5)col=mix(col,vec3(.72,.77,.73),max(0.,n.y)*.20);
 fragColor=vec4(col,uOpacity);
}`;
function program(gl,vs,fs){
 const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((t,i)=>{const s=gl.createShader(t);gl.shaderSource(s,i?fs:vs);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const m=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('着色器编译失败: '+m);}return s;});
 const p=gl.createProgram();shaders.forEach(s=>gl.attachShader(p,s));gl.linkProgram(p);shaders.forEach(s=>gl.deleteShader(s));if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const m=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('着色器链接失败: '+m);}return p;
}
const makeShape=kind=>root.TMShanheModels.build(kind);
const MODEL_KINDS=root.TMShanheModels.kinds;
class Renderer{
 static async create(canvas,env,urls,options={}){
  if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('需要有效画布');
  if(!env||env.schema!=='tm-shanhe-25d/1')throw new TypeError('背景资源版本不符');
  const ims=await Promise.all(['height','albedo','fallback','water'].map(k=>{if(!urls[k])throw new TypeError('缺少资源 '+k);return loadImage(urls[k]);}));
  return new Renderer(canvas,env,{height:ims[0],albedo:ims[1],fallback:ims[2],water:ims[3]},options);
 }
 constructor(canvas,env,images,options={}){
  this.canvas=canvas;this.env=env;this.images=images;this.disposed=false;this.lost=false;this.width=1;this.height=1;this.frames=0;this.view=viewValidate({center:[109,32],span:40,tilt:40,bearing:0});
  this.work={gridBuilds:0,coastBuilds:0,riverBuilds:0,instanceBuilds:0,overlayUploads:0};this.gridRevision=0;this._sceneRevision=0;this._instanceKey=null;this._gridStep=0;this._requestedDpr=1;this._sceneLayoutCache=new Map();
  this.options={relief:1,civilization:true,forest:true,shadows:true,quality:'normal',season:'summer',...options};this.scenario={id:'',settlements:[]};this.referenceOnly=false;
  this.light={azimuth:315,altitude:43};this.overlayOpacity=0;this._overlayItems=[];this._overlayGeneration=0;this.buffers=[];this.textures=[];this.programs=[];this.vaos=[];
  const hc=document.createElement('canvas');hc.width=images.height.width;hc.height=images.height.height;const ctx=hc.getContext('2d',{willReadFrequently:true});ctx.drawImage(images.height,0,0);this.pixels=ctx.getImageData(0,0,hc.width,hc.height).data;this.texW=hc.width;this.texH=hc.height;ctx.clearRect(0,0,hc.width,hc.height);ctx.drawImage(images.water,0,0,hc.width,hc.height);this.waterPixels=ctx.getImageData(0,0,hc.width,hc.height).data;hc.width=hc.height=1;
  this.canvas.style.pointerEvents='none';
  this.coastPaths=(env.landPaths||[]).map(v=>({b:v.b,path:new Path2D(v.d)}));
  this.coastCanvas=document.createElement('canvas');this.coastCanvas.width=1;this.coastCanvas.height=1;
  this.riverPaths=(env.rivers||[]).map(r=>({...r,points:(r.d.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number)}));
  this._safety=new root.TMShanhePlacement.Safety(env);
  this.overlayCanvas=document.createElement('canvas');this.overlayCanvas.width=W;this.overlayCanvas.height=H;
  this.gl=options.forceFallback?null:canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,stencil:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  this.mode=this.gl?'webgl2-heightfield':'canvas2d-fallback';this.context2d=this.gl?null:canvas.getContext('2d');
  if(!this.gl&&!this.context2d)throw new Error('此画布没有可用的绘制上下文');
  if(this.gl){this._initGL();this._onLost=e=>{e.preventDefault();this.lost=true;};this._onRestored=()=>{if(this.disposed)return;this.buffers=[];this.textures=[];this.vaos=[];this.programs=[];this._initGL();this.lost=false;this.bounds=null;this._gridStep=0;this._instanceKey=null;this._grid();this._instances();this._uploadOverlay();this.render();};canvas.addEventListener('webglcontextlost',this._onLost);canvas.addEventListener('webglcontextrestored',this._onRestored);}
  this.setOptions({});
 }
 _assert(){if(this.disposed)throw new Error('背景实例已销毁');}
 _initGL(){const g=this.gl;this._clarityRaster=null;this._maxTextureSize=g.getParameter(g.MAX_TEXTURE_SIZE);this._visualAnisotropy=g.getExtension('EXT_texture_filter_anisotropic');this._visualAnisotropyLevel=this._visualAnisotropy?Math.min(4,g.getParameter(this._visualAnisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;
  g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.disable(g.CULL_FACE);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
  this.terrainProgram=program(g,TERRAIN_VS,TERRAIN_FS);this.modelProgram=program(g,MODEL_VS,MODEL_FS);this.programs.push(this.terrainProgram,this.modelProgram);
  this.loc=new Map();
  this.heightTexture=this._texture(this.images.height);this.albedoTexture=this._texture(this.images.albedo);this.waterTexture=this._texture(this.images.water);this.overlayTexture=this._texture(this.overlayCanvas);this.coastTexture=this._texture(this.coastCanvas);
  this.terrainVAO=g.createVertexArray();this.vaos.push(this.terrainVAO);g.bindVertexArray(this.terrainVAO);this.gridBuffer=g.createBuffer();this.buffers.push(this.gridBuffer);g.bindBuffer(g.ARRAY_BUFFER,this.gridBuffer);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,8,0);this.indexBuffer=g.createBuffer();this.buffers.push(this.indexBuffer);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,this.indexBuffer);g.bindVertexArray(null);
  this.models={};for(const kind of MODEL_KINDS){
   const vao=g.createVertexArray();this.vaos.push(vao);g.bindVertexArray(vao);const buffer=g.createBuffer();this.buffers.push(buffer);g.bindBuffer(g.ARRAY_BUFFER,buffer);const verts=makeShape(kind);g.bufferData(g.ARRAY_BUFFER,verts,g.STATIC_DRAW);
   for(let i=0;i<3;i++){g.enableVertexAttribArray(i);g.vertexAttribPointer(i,3,g.FLOAT,false,44,i*12);}
   g.enableVertexAttribArray(4);g.vertexAttribPointer(4,2,g.FLOAT,false,44,36);
   const inst=g.createBuffer();this.buffers.push(inst);g.bindBuffer(g.ARRAY_BUFFER,inst);g.enableVertexAttribArray(3);g.vertexAttribPointer(3,4,g.FLOAT,false,16,0);g.vertexAttribDivisor(3,1);this.models[kind]={vao,buffer,inst,vertices:verts.length/11,count:0};g.bindVertexArray(null);
  }
  for(const kind of MODEL_KINDS){if((!kind.startsWith('town')&&!kind.startsWith('village'))||kind.endsWith('-lod'))continue;
   const m=this.models[kind],proxy=this.models[kind+'-lod'],vao=g.createVertexArray();this.vaos.push(vao);g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,proxy.buffer);
   for(let i=0;i<3;i++){g.enableVertexAttribArray(i);g.vertexAttribPointer(i,3,g.FLOAT,false,44,i*12);}g.enableVertexAttribArray(4);g.vertexAttribPointer(4,2,g.FLOAT,false,44,36);
   g.bindBuffer(g.ARRAY_BUFFER,m.inst);g.enableVertexAttribArray(3);g.vertexAttribPointer(3,4,g.FLOAT,false,16,0);g.vertexAttribDivisor(3,1);g.bindVertexArray(null);m.shadowVAO=vao;m.shadowVertices=proxy.vertices;
  }
 }
 // Display-only raster budget. Height sampling and the camera/hit mesh are unchanged.
 rasterSize(){
  if(!this.bounds)return [W,H];
  const key=[this.gridRevision,this.width,this.height,this.dpr,this.options.quality].join(':');
  if(this._clarityRaster?.key===key)return this._clarityRaster.size;
  const b=this.bounds,low=this.options.quality==='low',high=this.options.quality==='high';
  const cap=Math.min(this._maxTextureSize||4096,low?2048:4096),budget=low?2097152:high?12582912:8388608;
  const scale=this.canvas.width/(this.view.span*20)*1.15;
  let x=Math.max(256,Math.ceil((b[2]-b[0])*scale/256)*256),y=Math.max(256,Math.ceil((b[3]-b[1])*scale/256)*256);
  const reduction=Math.min(1,cap/x,cap/y,Math.sqrt(budget/(x*y)));
  x=Math.max(64,Math.floor(x*reduction/64)*64);y=Math.max(64,Math.floor(y*reduction/64)*64);
  this._clarityRaster={key,size:[x,y],budget};return this._clarityRaster.size;
 }
 _syncRasterResolution(){
  if(this._defer||!this.gl||this.lost||!this.bounds)return;
  const [x,y]=this.rasterSize();
  if(this.coastCanvas.width!==x||this.coastCanvas.height!==y)this._coast();
  if(this.overlayCanvas.width!==x||this.overlayCanvas.height!==y)this._uploadOverlay();
 }

 _texture(image){const g=this.gl,t=g.createTexture();this.textures.push(t);g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);if(image===this.images?.albedo){g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);if(this._visualAnisotropy)g.texParameterf(g.TEXTURE_2D,this._visualAnisotropy.TEXTURE_MAX_ANISOTROPY_EXT,this._visualAnisotropyLevel);}return t;}
 _loc(p,n){const key=(p===this.terrainProgram?'t':'m')+n;if(!this.loc.has(key))this.loc.set(key,this.gl.getUniformLocation(p,n));return this.loc.get(key);}
 _f(p,n,v){this.gl.uniform1f(this._loc(p,n),v);}
 _common(p){const g=this.gl,v=this.view,c=geo(v.center);g.useProgram(p);if(p===this.terrainProgram){this._f(p,'uNativePolitical',this.nativeCartography?1:0);const focus=this.nativeFocusTexture&&this.nativeFocusOwner===this.overlayTexture;this._f(p,'uNativeFocusMix',focus?1:0);g.activeTexture(g.TEXTURE5);g.bindTexture(g.TEXTURE_2D,focus?this.nativeFocusTexture:this.overlayTexture);g.uniform1i(this._loc(p,'uNativeFocus'),5);}this._f(p,'uSeason',this.seasonIndex);g.uniform2f(this._loc(p,'uCenter'),...c);g.uniform2f(this._loc(p,'uViewport'),this.width,this.height);this._f(p,'uSpan',v.span);this._f(p,'uTilt',v.tilt*Math.PI/180);this._f(p,'uBearing',v.bearing*Math.PI/180);this._f(p,'uGain',this.gain);if(this.bounds){g.uniform4f(this._loc(p,'uGridBounds'),...this.bounds);g.uniform2f(this._loc(p,'uGridRes'),...this.gridResolution);}
  const az=this.light.azimuth*Math.PI/180,alt=this.light.altitude*Math.PI/180;g.uniform3f(this._loc(p,'uSun'),Math.cos(az)*Math.cos(alt),Math.sin(alt),Math.sin(az)*Math.cos(alt));
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.heightTexture);g.uniform1i(this._loc(p,'uHeight'),0);
 }
 get seasonIndex(){return ['summer','spring','autumn','winter'].indexOf(this.options.season);}
 get gain(){return 72*this.options.relief*clamp(this.view.span/30,.30,1.30);}
 sample(p){
  this._assert();if(!validPoint(p)||p[0]<0||p[1]<0||p[0]>W||p[1]>H)return {h:0,land:0,river:0};
  const xx=clamp(p[0]/W*this.texW-.5,0,this.texW-1),yy=clamp(p[1]/H*this.texH-.5,0,this.texH-1),x=Math.floor(xx),y=Math.floor(yy),fx=xx-x,fy=yy-y;
  let hv=0,land=0,river=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const idx=(Math.min(this.texH-1,y+j)*this.texW+Math.min(this.texW-1,x+i))*4;const wt=(i?fx:1-fx)*(j?fy:1-fy);hv+=(this.pixels[idx]*256+this.pixels[idx+1])/65535*wt;land+=this.pixels[idx+2]/255*wt;river+=this.waterPixels[idx]/255*wt;}return {h:hv,land,river};
 }
 resize(width,height,dpr=1){
  this._assert();if(![width,height,dpr].every(finite)||width<1||height<1||width>8192||height>8192||dpr<=0)throw new TypeError('视窗尺寸无效');
  width=Math.round(width);height=Math.round(height);
  if(this.width===width&&this.height===height&&this._requestedDpr===dpr&&this._resizeQuality===this.options.quality&&this.bounds)return this;
  this.width=width;this.height=height;this._requestedDpr=dpr;this._resizeQuality=this.options.quality;
  this._maxRenderSize=this._maxRenderSize||(this.gl?this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE):8192);
  const low=this.options.quality==='low',high=this.options.quality==='high';this.dpr=Math.min(clamp(dpr,1,low?1:high?2.5:2),Math.sqrt((low?3000000:high?12000000:8000000)/(width*height)),this._maxRenderSize/width,this._maxRenderSize/height);
  this.canvas.width=Math.max(1,Math.floor(width*this.dpr));this.canvas.height=Math.max(1,Math.floor(height*this.dpr));
  this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';this._grid();this._instances();this._syncRasterResolution();return this;
 }
 setView(next){this._assert();const v=viewValidate({...this.view,...next});if(this.bounds&&JSON.stringify(v)===JSON.stringify(this.view))return this;this.view=v;this._grid();this._instances();return this;}
 setLighting(next){this._assert();const v={...this.light,...next};if(!finite(v.azimuth)||!finite(v.altitude)||v.altitude<15||v.altitude>85)throw new TypeError('光照参数无效');this.light={azimuth:((v.azimuth%360)+360)%360,altitude:v.altitude};return this;}
 setOptions(next){
  this._assert();const o={...this.options,...next};
  if(!finite(o.relief)||o.relief<0||o.relief>1.7)throw new TypeError('地形强度须为0到1.7');
  if(!['low','normal','high'].includes(o.quality))throw new TypeError('画质档位无效');
  if(!['summer','spring','autumn','winter'].includes(o.season))throw new TypeError('季相样式无效');
  for(const k of ['forest','civilization','shadows'])if(typeof o[k]!=='boolean')throw new TypeError('显隐参数无效');
  const qualityChanged=this.options.quality!==o.quality,reliefChanged=this.options.relief!==o.relief;this.options=o;
  if(qualityChanged&&this.width>1)this.resize(this.width,this.height,this._requestedDpr);else if(reliefChanged)this._grid();
  this._instances();return this;
 }
 // Preflight the whole frame before mutating any live fields. Batch expensive rebuilds once.
 configure(frame={}){
  this._assert();if(!frame||typeof frame!=='object')throw new TypeError('需要镜头帧对象');
  const view=viewValidate({...this.view,...(frame.view||{})}),o={...this.options,...(frame.options||{})},light={...this.light,...(frame.lighting||{})};
  if(!finite(o.relief)||o.relief<0||o.relief>1.7||!['low','normal','high'].includes(o.quality)||!['summer','spring','autumn','winter'].includes(o.season))throw new TypeError('背景帧选项无效');
  for(const k of ['forest','civilization','shadows'])if(typeof o[k]!=='boolean')throw new TypeError('背景帧显隐无效');
  if(!finite(light.azimuth)||!finite(light.altitude)||light.altitude<15||light.altitude>85)throw new TypeError('背景帧光照无效');
  const size=frame.size||{width:this.width,height:this.height,dpr:this._requestedDpr};
  if(![size.width,size.height,size.dpr].every(finite)||size.width<1||size.height<1||size.width>8192||size.height>8192||size.dpr<=0)throw new TypeError('背景帧尺寸无效');
  this._defer=true;
  try{this.setOptions(o);this.setView(view);this.setLighting(light);this.resize(size.width,size.height,size.dpr);}
  finally{this._defer=false;}
  this._grid();this._instances();this._syncRasterResolution();return this;
 }
 setScenario(sc,{referencePreview=false}={}){
  this._assert();if(!sc||!Array.isArray(sc.settlements))throw new TypeError('需要只读场景锚点');
  if(!referencePreview&&(!sc.registration||sc.registration.currentLocalProjectTested!==true||String(sc.registration.status).includes('provisional')))throw new Error('尚未核实本地配准；参考样板不得自动成为正式地图');
  const ids=new Set();const settlements=sc.settlements.map(r=>{if(r.id==null||ids.has(String(r.id)))throw new TypeError('缺少或重复的锚点ID');ids.add(String(r.id));const p=r.geo?geo(r.geo):r.p;if(!validPoint(p)||p[0]<0||p[0]>W||p[1]<0||p[1]>H)throw new TypeError('锚点坐标无效');return {id:String(r.id),p:p.slice(),seed:finite(r.seed)?r.seed:hash(r.id)};});
  this.scenario={id:String(sc.id||''),settlements};this._sceneRevision++;this._layoutKey=JSON.stringify(this.scenario);this._layoutCache=null;this._instanceKey=null;this.referenceOnly=referencePreview;this._instances();return this;
 }
 // Reusable, world-aligned mesh envelope. A short pan changes uniforms, not all geometry.
 _grid(){
  if(this._defer||!this.gl||this.lost||this.width<=1)return false;
  const v=this.view,c=geo(v.center),wide=v.span*20,high=wide*this.height/this.width,t=v.tilt*Math.PI/180,a=v.bearing*Math.PI/180;
  const rz=high/Math.cos(t)+this.gain*2.2,ww=Math.abs(wide*Math.cos(a))+Math.abs(rz*Math.sin(a)),hh=Math.abs(wide*Math.sin(a))+Math.abs(rz*Math.cos(a));
  const req=[c[0]-ww*.51-4,c[1]-hh*.51-4,c[0]+ww*.51+4,c[1]+hh*.51+4];
  const base=this.options.quality==='low'?144:this.options.quality==='high'?384:256;
  let step=Math.pow(2,Math.round(Math.log2(wide/base)*2)/2);
  step=Math.max(step,Math.sqrt((ww*1.42+60)*(hh*1.42+60)/300000),ww/640,hh/640);
  const old=this.bounds;
  if(old&&Math.abs(this._gridStep-step)<1e-9&&this._gridQuality===this.options.quality&&req[0]>=old[0]&&req[1]>=old[1]&&req[2]<=old[2]&&req[3]<=old[3])return false;
  const quantum=step*16,px=Math.max(ww*.14,step*24),py=Math.max(hh*.14,step*24);
  const b=[Math.floor((req[0]-px)/quantum)*quantum,Math.floor((req[1]-py)/quantum)*quantum,Math.ceil((req[2]+px)/quantum)*quantum,Math.ceil((req[3]+py)/quantum)*quantum];
  const nx=Math.round((b[2]-b[0])/step),ny=Math.round((b[3]-b[1])/step);
  this.bounds=b;this._gridStep=step;this._gridQuality=this.options.quality;this.gridRevision++;this.work.gridBuilds++;
  const xy=new Float32Array((nx+1)*(ny+1)*2);let k=0;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){xy[k++]=b[0]+i/nx*(b[2]-b[0]);xy[k++]=b[1]+j/ny*(b[3]-b[1]);}
  const indices=new Uint32Array(nx*ny*6);k=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,c=a+nx+1;indices[k++]=a;indices[k++]=c;indices[k++]=a+1;indices[k++]=a+1;indices[k++]=c;indices[k++]=c+1;}
  const g=this.gl;g.bindVertexArray(this.terrainVAO);g.bindBuffer(g.ARRAY_BUFFER,this.gridBuffer);g.bufferData(g.ARRAY_BUFFER,xy,g.DYNAMIC_DRAW);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,this.indexBuffer);g.bufferData(g.ELEMENT_ARRAY_BUFFER,indices,g.STATIC_DRAW);g.bindVertexArray(null);
  this.gridCount=indices.length;this.gridTriangles=nx*ny*2;this.gridResolution=[nx,ny];this._heightCache=new Float64Array((nx+1)*(ny+1));this._heightCache.fill(NaN);this._rivers();this._coast();this._uploadOverlay();return true;
 }
 _coast(){
  if(!this.gl||!this.bounds||!this.coastTexture)return;
  this.work.coastBuilds++;const b=this.bounds,ww=b[2]-b[0],hh=b[3]-b[1];
  const [nx,ny]=this.rasterSize();
  const canvas=this.coastCanvas;canvas.width=nx;canvas.height=ny;
  const ctx=canvas.getContext('2d');ctx.setTransform(nx/ww,0,0,ny/hh,-b[0]*nx/ww,-b[1]*ny/hh);
  const paths=this.coastPaths.filter(v=>v.b[2]>=b[0]-5&&v.b[0]<=b[2]+5&&v.b[3]>=b[1]-5&&v.b[1]<=b[3]+5);
  const combined=new Path2D();for(const v of paths)combined.addPath(v.path);ctx.fillStyle='#ff0000';ctx.fill(combined,'evenodd');
  ctx.globalCompositeOperation='screen';ctx.strokeStyle='#00b800';ctx.lineWidth=1.05;ctx.lineJoin='round';ctx.filter='blur('+Math.max(.7,1.5*nx/ww)+'px)';ctx.stroke(combined);
  ctx.filter='none';ctx.globalCompositeOperation='source-over';
  const g=this.gl;g.bindTexture(g.TEXTURE_2D,this.coastTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);
  this.coastRasterSize=[nx,ny];
 }
 _rivers(){
  if(!this.gl||!this.models?.rivers||!this.bounds)return;this.work.riverBuilds++;const b=this.bounds,data=[],span=this.view.span;
  const add=(a,c,d,col,y)=>{for(const p of [a,c,d])data.push(p[0],y,p[1],0,1,0,...col,0,0);};
  let segments=0;
  for(const r of this.riverPaths){if(r.b[2]<b[0]||r.b[0]>b[2]||r.b[3]<b[1]||r.b[1]>b[3])continue;const pts=r.points;
   for(let i=0;i<pts.length-2;i+=2){let ax=pts[i],az=pts[i+1],bx=pts[i+2],bz=pts[i+3];if(Math.max(ax,bx)<b[0]-3||Math.min(ax,bx)>b[2]+3||Math.max(az,bz)<b[1]-3||Math.min(az,bz)>b[3]+3)continue;let len=Math.hypot(bx-ax,bz-az);if(len<.003)continue;
    const nx=-(bz-az)/len,nz=(bx-ax)/len,steps=Math.max(1,Math.ceil(len/Math.min(1.2,Math.max(.16,this._gridStep*.65))));
    for(let j=0;j<steps;j++){const p=[ax+(bx-ax)*j/steps,az+(bz-az)*j/steps],q=[ax+(bx-ax)*(j+1)/steps,az+(bz-az)*(j+1)/steps];
     for(const bank of [true,false]){const width=(r.major?.22:.085)*(bank?2.4:1);const aa=[p[0]+nx*width,p[1]+nz*width],bb=[q[0]+nx*width,q[1]+nz*width],cc=[q[0]-nx*width,q[1]-nz*width],dd=[p[0]-nx*width,p[1]-nz*width];const col=bank?[.53,.57,.44]:[.24,.44,.44];const y=bank?.019:.035;add(aa,bb,cc,col,y);add(aa,cc,dd,col,y);}
     segments++;
    }
    if(segments>50000)break;
   }
   if(segments>50000)break;
  }
  for(const lake of this.env.lakeFaces||[]){if(lake.b[2]<b[0]||lake.b[0]>b[2]||lake.b[3]<b[1]||lake.b[1]>b[3])continue;for(let i=0;i<lake.f.length;i+=6)add([lake.f[i],lake.f[i+1]],[lake.f[i+2],lake.f[i+3]],[lake.f[i+4],lake.f[i+5]],[.24,.44,.44],.055);}
  const g=this.gl,m=this.models.rivers;g.bindBuffer(g.ARRAY_BUFFER,m.buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.DYNAMIC_DRAW);g.bindBuffer(g.ARRAY_BUFFER,m.inst);g.bufferData(g.ARRAY_BUFFER,new Float32Array([0,0,1,0]),g.STATIC_DRAW);m.count=data.length?1:0;m.vertices=data.length/11;this.riverSegments=segments;
 }
 _layout(){
  if(this._layoutCache)return this._layoutCache;
  if(this._sceneLayoutCache.has(this._layoutKey)){this._layoutCache=this._sceneLayoutCache.get(this._layoutKey);return this._layoutCache;}
  const out=[],occupied=new root.TMShanhePlacement.Bins();let rejected=0,relocated=0;
  const reasons={river:0,lake:0,shore:0,sea:0,slope:0,overlap:0},source=this.scenario.settlements.slice().sort((a,b)=>{
   const town=r=>r.seed%10===0||r.id.includes('长安')||r.id.includes('开封');return Number(town(b))-Number(town(a))||a.seed-b.seed||a.id.localeCompare(b.id,'en');});
  const skipped=[];
  for(const r of source){
   const gp=ungeo(r.p);if(gp[0]<98||gp[0]>126||gp[1]<19||gp[1]>43)continue;
   const rand=rng(r.seed),isTown=r.seed%10===0||r.id.includes('长安')||r.id.includes('开封');
   const size=isTown?(r.id.includes('长安')?1.17:.83):.71+rand()*.20;
   const biome=gp[0]<105.7&&gp[1]>33.5?'dry':(gp[1]<31.5&&gp[0]>106)||gp[1]<25?'wet':'north';
   const kind=(isTown?'town':'village')+(biome==='north'?'':'-'+biome)+(!isTown&&r.seed%2===0?'-alt':'');
   const radius=root.TMShanheModels.radius(kind)*size+.25,maxOffset=radius*1.6,angle=biome==='wet'?(rand()-.5)*.65:(rand()-.5)*.20;
   let best=null,bestScore=1e6,lastReason='slope';
   for(let i=0;i<81;i++){
    const az=i*2.3999632297,dist=i===0?0:maxOffset*Math.sqrt(i/80),q=[r.p[0]+Math.cos(az)*dist,r.p[1]+Math.sin(az)*dist];
    let cause=this._safety.hit(q,radius);
    if(!cause&&!this._safety.onLand(q))cause='sea';
    if(!cause&&[...occupied.query(q,radius)].some(s=>Math.hypot(q[0]-s.p[0],q[1]-s.p[1])<s.radius+radius+.30))cause='overlap';
    if(cause){reasons[cause]++;lastReason=cause;continue;}
    const ring=[this.sample(q)];for(const scale of [.5,1])for(let j=0;j<12;j++){const a=j*TAU/12;ring.push(this.sample([q[0]+Math.cos(a)*radius*scale,q[1]+Math.sin(a)*radius*scale]));}
    const dh=Math.max(...ring.map(v=>v.h))-Math.min(...ring.map(v=>v.h));
    if(ring.some(v=>v.land<.99)||ring[0].h>.74||dh>(isTown?.070:.105)){reasons.slope++;lastReason='slope';continue;}
    const score=dh+dist*.003;if(score<bestScore){best={p:q,h:ring[0].h,slope:dh,offset:dist};bestScore=score;}
   }
   if(!best){rejected++;skipped.push({id:r.id,reason:lastReason});continue;}
   if(best.offset>.01)relocated++;
   const site={id:r.id,seed:r.seed,sourceP:r.p.slice(),...best,isTown,biome,size,radius,maxOffset,kind,angle};out.push(site);
   occupied.insert(site,[site.p[0]-radius,site.p[1]-radius,site.p[0]+radius,site.p[1]+radius]);
  }
  this._layoutCache={items:out,rejected,relocated,reasons,skipped,contract:'conservative-full-model-disk / visual-origins-only'};if(this._sceneLayoutCache.size>=3)this._sceneLayoutCache.delete(this._sceneLayoutCache.keys().next().value);this._sceneLayoutCache.set(this._layoutKey,this._layoutCache);return this._layoutCache;
 }
 _instances(){if(this._defer||!this.gl||!this.models||this.lost||!this.bounds)return;
  const lod=(this.view.span>10||this.options.quality==='low')?'simplified':'detailed';
  const key=[this.gridRevision,this._sceneRevision,this.options.quality,this.options.civilization,this.options.forest,lod,...[15,16,24,28,32,36,65].map(t=>this.view.span<t)].join('|');
  if(this._instanceKey===key)return;this._instanceKey=key;this.work.instanceBuilds++;

  const groups=Object.fromEntries(MODEL_KINDS.filter(k=>!['rivers','fields','paths'].includes(k)).map(k=>[k,[]]));
  const b=this.bounds,span=this.view.span,cc=geo(this.view.center),aa=this.view.bearing*Math.PI/180,tt=this.view.tilt*Math.PI/180,ca=Math.cos(aa),sa=Math.sin(aa),ct=Math.cos(tt),st=Math.sin(tt),wide=span*20,high=wide*this.height/this.width;
  const visible=p=>p[0]>=b[0]-12&&p[0]<=b[2]+12&&p[1]>=b[1]-12&&p[1]<=b[3]+12;
  const layout=this._layout(),sites=this.options.civilization&&span<65?layout.items.filter(v=>visible(v.p)):[];
  const cap=this.options.quality==='low'?650:span>28?1800:span>16?3200:this.options.quality==='high'?8000:5000;
  let treeCount=0;
  const nearSolid=q=>sites.some(s=>Math.abs(q[0]-s.p[0])<s.radius&&Math.abs(q[1]-s.p[1])<s.radius*.93);
  if(this.options.forest&&span<65){for(const p of this.env.trees||[]){if(treeCount>=cap)break;if(span>24&&((Math.floor(p[0]*31)+Math.floor(p[1]*17))%3!==0))continue;if(!visible(p)||nearSolid(p)||this._safety.hit(p,p[2]*.46))continue;
    const gp=ungeo(p),kind=gp[1]>36||this.sample(p).h>.25?'pine':'trees';groups[kind].push(p[0],p[1],p[2]*.88,p[3]*1.17);treeCount++;
  }}
  const farm=[],paths=[];let fieldPatches=0,fieldRejects=0;
  const pushTri=(dest,a,c,d,col,y)=>{for(const p of [a,c,d])dest.push(p[0],y,p[1],0,1,0,...col,0,0);};
  const quad=(dest,pts,col,y=.016)=>{pushTri(dest,pts[0],pts[1],pts[2],col,y);pushTri(dest,pts[0],pts[2],pts[3],col,y);};
  const strip=(a,c,width,col)=>{const len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<.01)return;const nx=-(c[1]-a[1])/len*width,nz=(c[0]-a[0])/len*width;quad(paths,[[a[0]+nx,a[1]+nz],[c[0]+nx,c[1]+nz],[c[0]-nx,c[1]-nz],[a[0]-nx,a[1]-nz]],col,.025);};
  const biomeCounts={north:0,wet:0,dry:0};
  for(const s of sites){groups[s.kind+(lod==='simplified'?'-lod':'')].push(...s.p,s.size,s.angle);biomeCounts[s.biome]++;
   const rand=rng(s.seed^8401127);
   if(this.options.forest&&span<32){for(let i=0;i<(s.isTown?20:11);i++){const a=rand()*TAU,rad=s.radius+1+rand()*4,q=[s.p[0]+Math.cos(a)*rad,s.p[1]+Math.sin(a)*rad*.88];const v=this.sample(q);if(treeCount<cap&&v.land>.998&&v.river<.08&&!nearSolid(q)&&!this._safety.hit(q,.42)){groups[s.biome==='dry'?'pine':'trees'].push(...q,.45+rand()*.36,a);treeCount++;}}}
   if(span>=36)continue;
   const zones=s.isTown?7:4;
   for(let k=0;k<zones;k++){
    const angle=s.angle+k*TAU/zones+(rand()-.5)*.35,rad=s.radius+2.9+rand()*3.2;
    const center=[s.p[0]+Math.cos(angle)*rad,s.p[1]+Math.sin(angle)*rad*.86];
    const angle2=s.biome==='wet'?s.angle+rand()*.5:s.angle+.12*Math.sin(k),c=Math.cos(angle2),sn=Math.sin(angle2);
    const nx=s.biome==='dry'?4:5,ny=s.biome==='wet'?5:4,scale=s.biome==='dry'?1.05:.91;
    // Jittered continuous parcels, not repeated 5x6 field stamps. All vertices are checked against water and slope.
    const lattice=[];for(let j=0;j<=ny;j++){lattice[j]=[];for(let i=0;i<=nx;i++){
      const lx=(i-nx/2)*scale+(rand()-.5)*.26,ly=(j-ny/2)*scale*.62+(rand()-.5)*.22+(s.biome==='wet'?Math.sin(i*.6+k)*.15:0);
      lattice[j][i]=[center[0]+c*lx-sn*ly,center[1]+sn*lx+c*ly];}}
    let zoneCount=0;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
     const base=[lattice[j][i],lattice[j][i+1],lattice[j+1][i+1],lattice[j+1][i]];
     const mid=[base.reduce((n,p)=>n+p[0],0)/4,base.reduce((n,p)=>n+p[1],0)/4];
     const pts=base.map(q=>[mid[0]+(q[0]-mid[0])*.945,mid[1]+(q[1]-mid[1])*.945]);
     const samples=[...pts,mid].map(q=>this.sample(q));const dh=Math.max(...samples.map(v=>v.h))-Math.min(...samples.map(v=>v.h));
     if(this._safety.hit(mid,Math.max(...pts.map(q=>Math.hypot(q[0]-mid[0],q[1]-mid[1]))))||nearSolid(mid)||samples.some(v=>v.land<.994||v.river>.10)||dh>.013||rand()<.08){fieldRejects++;continue;}
     const palettes=s.biome==='wet'?[[.36,.53,.39],[.48,.60,.39],[.54,.60,.39],[.43,.55,.41],[.47,.57,.45]]:s.biome==='dry'?[[.64,.58,.39],[.65,.61,.42],[.56,.56,.37],[.60,.55,.37]]:[[.56,.61,.39],[.60,.62,.41],[.49,.57,.35],[.60,.58,.38]];
     const rawColor=palettes[Math.floor(rand()*palettes.length)],zoneColor=palettes[k%palettes.length];const col=rawColor.map((v,i)=>v*.48+zoneColor[i]*.52);quad(farm,pts,col);fieldPatches++;zoneCount++;
     if(span<15){for(let line=1;line<4;line++){
      const t=line/4,a=[pts[0][0]+(pts[3][0]-pts[0][0])*t,pts[0][1]+(pts[3][1]-pts[0][1])*t],v=[pts[1][0]+(pts[2][0]-pts[1][0])*t,pts[1][1]+(pts[2][1]-pts[1][1])*t];
      strip(a,v,.006,col.map(v=>v*.94));
     }}
    }
    // Short local footpath only. Never connect settlements or create a gameplay road.
    if(zoneCount>4){const a=[s.p[0]+Math.cos(angle)*(s.radius+.1),s.p[1]+Math.sin(angle)*(s.radius+.1)];
     const samples=Array.from({length:6},(_,i)=>this.sample([a[0]+(center[0]-a[0])*i/5,a[1]+(center[1]-a[1])*i/5]));if(samples.every(v=>v.land>.995&&v.river<.10)&&!this._safety.hit([(a[0]+center[0])/2,(a[1]+center[1])/2],Math.hypot(a[0]-center[0],a[1]-center[1])*.5+.07))strip(a,center,.065,[.62,.58,.43]);}
   }
  }
  const g=this.gl;
  for(const [kind,data] of Object.entries(groups)){const m=this.models[kind];g.bindBuffer(g.ARRAY_BUFFER,m.inst);g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.DYNAMIC_DRAW);m.count=data.length/4;}
  for(const [kind,data] of [['fields',farm],['paths',paths]]){const m=this.models[kind];g.bindBuffer(g.ARRAY_BUFFER,m.buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.DYNAMIC_DRAW);g.bindBuffer(g.ARRAY_BUFFER,m.inst);g.bufferData(g.ARRAY_BUFFER,new Float32Array([0,0,1,0]),g.STATIC_DRAW);m.count=data.length?1:0;m.vertices=data.length/11;}
  this.instanceStats={lod,acceptedSettlements:sites.length,skippedVisibleAnchors:layout.rejected,trees:treeCount,fieldPatches,fieldRejects,biomeCounts,relocatedArtAnchors:layout.relocated};
 }
 setOverlay(items=[],opacity=.48){this._assert();if(!Array.isArray(items)||!finite(opacity)||opacity<0||opacity>1)throw new TypeError('叠色参数无效');const ids=new Set();const clean=items.map((r,i)=>{if(r.id==null||ids.has(String(r.id)))throw new TypeError('叠色ID重复或缺失');ids.add(String(r.id));if(typeof r.d!=='string'||r.d.length>2000000)throw new TypeError('需要规范的世界坐标SVG路径');const color=r.color||['#c09059','#7fadb0','#a57d7a','#99a46c','#aea2b7'][i%5];if(!/^#[0-9a-fA-F]{6}$/.test(color))throw new TypeError('颜色格式无效');return {id:String(r.id),path:new Path2D(r.d),color};});
  const signature=JSON.stringify(items);if(signature===this._overlaySignature){this.overlayOpacity=opacity;return this;}this._overlaySignature=signature;
  this._overlayItems=clean;this.overlayOpacity=opacity;this._overlayGeneration++;this._uploadOverlay();return this;
 }
 _uploadOverlay(){
  if(this.lost)return;
  const local=!!(this.gl&&this.bounds),b=local?this.bounds:[0,0,W,H],ww=b[2]-b[0],hh=b[3]-b[1];
  const [nx,ny]=local?this.rasterSize():[W,H];
  this.overlayCanvas.width=nx;this.overlayCanvas.height=ny;const cc=this.overlayCanvas.getContext('2d');
  cc.setTransform(nx/ww,0,0,ny/hh,-b[0]*nx/ww,-b[1]*ny/hh);
  for(const r of this._overlayItems){cc.fillStyle=r.color;cc.fill(r.path,'evenodd');cc.strokeStyle='#e3cd9d';cc.lineWidth=Math.max(.025,ww/nx*.85);cc.stroke(r.path);}
  if(!this.gl)return;this.work.overlayUploads++;const g=this.gl;g.bindTexture(g.TEXTURE_2D,this.overlayTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.overlayCanvas);
 }
 render({time=0}={}){
  this._assert();if(!finite(time))throw new TypeError('时间参数无效');if(this.lost)return {mode:this.mode,lost:true};const start=performance.now();let drawCalls=0,triangles=0;
  if(this.gl){const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.clearColor(.055,.115,.125,1);g.clearStencil(0);g.stencilMask(255);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT|g.STENCIL_BUFFER_BIT);g.depthMask(true);
   this._common(this.terrainProgram);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,this.albedoTexture);g.uniform1i(this._loc(this.terrainProgram,'uAlbedo'),1);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,this.overlayTexture);g.uniform1i(this._loc(this.terrainProgram,'uOverlay'),2);g.activeTexture(g.TEXTURE3);g.bindTexture(g.TEXTURE_2D,this.waterTexture);g.uniform1i(this._loc(this.terrainProgram,'uWater'),3);g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D,this.coastTexture);g.uniform1i(this._loc(this.terrainProgram,'uCoast'),4);this._f(this.terrainProgram,'uOverlayMix',this.overlayOpacity);this._f(this.terrainProgram,'uTime',time);this._f(this.terrainProgram,'uDetail',this.options.quality==='low'?0:1);g.bindVertexArray(this.terrainVAO);g.drawElements(g.TRIANGLES,this.gridCount||0,g.UNSIGNED_INT,0);triangles+=this.gridTriangles||0;drawCalls++;
   this._common(this.modelProgram);g.uniform3f(this._loc(this.modelProgram,'uTint'),1,1,1);this._f(this.modelProgram,'uModelGain',1);this._f(this.modelProgram,'uShadowPass',0);
   const drawModel=(kind,shadow=false)=>{const m=this.models[kind];if(!m.count)return;const ground=['fields','rivers','paths'].includes(kind);this._f(this.modelProgram,'uMaterial',kind==='fields'?2:kind==='trees'?1:kind==='pine'?4:ground?3:0);this._f(this.modelProgram,'uDrape',ground?1:0);
    this._f(this.modelProgram,'uOpacity',shadow?.23:kind==='fields'?.73:kind==='paths'?.68:kind==='rivers'?1:clamp((65-this.view.span)/18,0,1));
    const vertices=shadow&&m.shadowVAO?m.shadowVertices:m.vertices;g.bindVertexArray(shadow&&m.shadowVAO?m.shadowVAO:m.vao);g.drawArraysInstanced(g.TRIANGLES,0,vertices,m.count);drawCalls++;triangles+=vertices/3*m.count;};
   for(const kind of ['fields','paths','rivers'])drawModel(kind);
   if(this.options.shadows&&this.options.quality!=='low'&&this.view.span<46&&g.getContextAttributes().stencil){
    this._f(this.modelProgram,'uShadowPass',1);g.enable(g.STENCIL_TEST);g.stencilFunc(g.NOTEQUAL,1,255);g.stencilOp(g.KEEP,g.KEEP,g.REPLACE);g.depthMask(false);
    for(const kind of MODEL_KINDS)if(!['fields','paths','rivers'].includes(kind))drawModel(kind,true);
    g.disable(g.STENCIL_TEST);g.depthMask(true);this._f(this.modelProgram,'uShadowPass',0);
   }
   for(const kind of MODEL_KINDS)if(!['fields','rivers','paths'].includes(kind))drawModel(kind);
   g.bindVertexArray(null);
  }else{const cc=this.context2d,span=this.view.span*20,c=geo(this.view.center),s=this.width/span;cc.setTransform(this.dpr,0,0,this.dpr,0,0);cc.fillStyle='#173037';cc.fillRect(0,0,this.width,this.height);cc.translate(this.width/2,this.height/2);cc.scale(s,s);cc.translate(-c[0],-c[1]);cc.drawImage(this.images.fallback,0,0,W,H);if(this.overlayOpacity>0){cc.globalAlpha=this.overlayOpacity;cc.drawImage(this.overlayCanvas,0,0,W,H);cc.globalAlpha=1;}}
  this.frames++;this.stats={clarity:{version:'C1',renderPixels:[this.canvas.width,this.canvas.height],requestedDpr:this._requestedDpr,effectiveDpr:this.dpr,coastPixels:[this.coastCanvas.width,this.coastCanvas.height],politicalPixels:[this.overlayCanvas.width,this.overlayCanvas.height],albedoAnisotropy:this._visualAnisotropyLevel||1,heightSampling:'unchanged-bilinear-no-mipmap'},mode:this.mode,frames:this.frames,drawCalls,triangles,submitMs:performance.now()-start,...this.instanceStats,referenceOnly:this.referenceOnly,heightStatus:this.env.heightStatus,overlayGeneration:this._overlayGeneration,gridRevision:this.gridRevision,work:{...this.work},season:this.options.season};return {...this.stats};
 }
 _vertexHeight(i,j){const [nx,ny]=this.gridResolution,k=j*(nx+1)+i,b=this.bounds;let h=this._heightCache[k];
  if(Number.isNaN(h)){h=this.sample([Math.fround(b[0]+i/nx*(b[2]-b[0])),Math.fround(b[1]+j/ny*(b[3]-b[1]))]).h;this._heightCache[k]=h;}return h;
 }
 surfaceHeight(p){this._assert();if(!this.gl||!this.bounds||!this.gridResolution)return this.sample(p).h;const b=this.bounds,[nx,ny]=this.gridResolution;
  const x=(p[0]-b[0])/(b[2]-b[0])*nx,z=(p[1]-b[1])/(b[3]-b[1])*ny;if(x<0||x>nx||z<0||z>ny)return this.sample(p).h;
  const ix=Math.min(nx-1,Math.floor(x)),iz=Math.min(ny-1,Math.floor(z)),fx=x-ix,fz=z-iz;
  const at=(i,j)=>this._vertexHeight(i,j);
  if(fx+fz<=1){const a=at(ix,iz);return a+(at(ix+1,iz)-a)*fx+(at(ix,iz+1)-a)*fz;}
  const d=at(ix+1,iz+1);return d+(at(ix,iz+1)-d)*(1-fx)+(at(ix+1,iz)-d)*(1-fz);
 }
 projectGeo(p,{ground=false,visibleOnly=false}={}){this._assert();if(!validPoint(p))throw new TypeError('经纬度无效');const q=geo(p),c=geo(this.view.center);const t=(this.gl?this.view.tilt:0)*Math.PI/180,a=(this.gl?this.view.bearing:0)*Math.PI/180;const dx=q[0]-c[0],dz=q[1]-c[1],x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a),h=this.gl&&!ground?this.surfaceHeight(q)*this.gain:0;const s=this.width/(this.view.span*20);const screen=[this.width/2+x*s,this.height/2+(z*Math.cos(t)-h*Math.sin(t))*s];if(visibleOnly&&!ground){const q=this.unprojectScreen(screen);if(Math.hypot(q[0]-p[0],q[1]-p[1])>.0005)return null;}return screen;}
 unprojectScreen(p){this._assert();if(!validPoint(p))throw new TypeError('屏幕坐标无效');const s=this.width/(this.view.span*20),rx=(p[0]-this.width/2)/s,v=(p[1]-this.height/2)/s,c=geo(this.view.center),a=(this.gl?this.view.bearing:0)*Math.PI/180,t=(this.gl?this.view.tilt:0)*Math.PI/180;
  const at=h=>{const rz=(v+h*Math.sin(t))/Math.cos(t);return [c[0]+rx*Math.cos(a)+rz*Math.sin(a),c[1]-rx*Math.sin(a)+rz*Math.cos(a)];};
  if(!this.gl||this.gain===0||t===0)return ungeo(at(0));
  // Exact ray / heightfield-triangle intersection. Visit cells in depth order; no fixed-step raymarch misses.
  const b=this.bounds,[nx,ny]=this.gridResolution,step=[(b[2]-b[0])/nx,(b[3]-b[1])/ny],origin=at(0),one=at(1),dir=[one[0]-origin[0],one[1]-origin[1]],top=this.gain+1;
  const cuts=[top,0];
  for(let axis=0;axis<2;axis++){
   if(Math.abs(dir[axis])<1e-12)continue;const count=axis?ny:nx;
   const c0=(origin[axis]-b[axis])/step[axis],c1=(origin[axis]+dir[axis]*top-b[axis])/step[axis];
   for(let i=Math.max(0,Math.ceil(Math.min(c0,c1)));i<=Math.min(count,Math.floor(Math.max(c0,c1)));i++){
    const ht=(b[axis]+i*step[axis]-origin[axis])/dir[axis];if(ht>0&&ht<top)cuts.push(ht);
   }
  }
  cuts.sort((a,b)=>b-a);
  for(let i=0;i<cuts.length-1;i++){
   const hi=cuts[i],lo=cuts[i+1],mid=(hi+lo)/2,pt=at(mid),ix=Math.floor((pt[0]-b[0])/step[0]),iz=Math.floor((pt[1]-b[1])/step[1]);
   if(ix<0||iz<0||ix>=nx||iz>=ny)continue;
   const x0=b[0]+ix*step[0],z0=b[1]+iz*step[1];
   const fx0=(origin[0]-x0)/step[0],fz0=(origin[1]-z0)/step[1],fxd=dir[0]/step[0],fzd=dir[1]/step[1];
   const ah=this._vertexHeight(ix,iz),bh=this._vertexHeight(ix+1,iz),ch=this._vertexHeight(ix,iz+1),dh=this._vertexHeight(ix+1,iz+1);
   const faces=[[ah,bh-ah,ch-ah],[bh+ch-dh,dh-ch,dh-bh]],hits=[];
   for(let j=0;j<2;j++){
    const [base,dx,dz]=faces[j],den=1-this.gain*(dx*fxd+dz*fzd);if(Math.abs(den)<1e-12)continue;
    const ht=this.gain*(base+dx*fx0+dz*fz0)/den,fx=fx0+fxd*ht,fz=fz0+fzd*ht;
    if(ht<lo-1e-7||ht>hi+1e-7||fx<-.00001||fx>1.00001||fz<-.00001||fz>1.00001)continue;
    if(j===0?fx+fz<=1.00001:fx+fz>=.99999)hits.push(ht);
   }
   if(hits.length)return ungeo(at(Math.max(...hits)));
  }
  return ungeo(at(0));
 }
 isGeoVisible(p){this._assert();return this.projectGeo(p,{visibleOnly:true})!==null;}

 async exportPNG(){this._assert();this.render();return new Promise((resolve,reject)=>this.canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG导出失败')),'image/png'));}
 dispose(){if(this.disposed)return;const g=this.gl;if(g){g.useProgram(null);g.bindVertexArray(null);g.bindBuffer(g.ARRAY_BUFFER,null);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,null);for(let i=0;i<6;i++){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,null);}for(const x of this.buffers)g.deleteBuffer(x);for(const x of this.textures)g.deleteTexture(x);for(const x of this.vaos)g.deleteVertexArray(x);for(const x of this.programs)g.deleteProgram(x);this.canvas.removeEventListener('webglcontextlost',this._onLost);this.canvas.removeEventListener('webglcontextrestored',this._onRestored);}this.buffers=[];this.textures=[];this.vaos=[];this.programs=[];this.riverPaths=null;this.coastPaths=null;this._safety?.dispose();this._safety=null;this._sceneLayoutCache.clear();this._layoutCache=null;this._instanceKey=null;this._heightCache=null;this.pixels=null;this.waterPixels=null;this.images=null;this.env=null;this.scenario=null;this.models=null;this.loc?.clear();this.terrainProgram=null;this.modelProgram=null;this.heightTexture=null;this.waterTexture=null;this.albedoTexture=null;this.overlayTexture=null;this.coastTexture=null;this.context2d=null;this._overlayItems=[];this.overlayCanvas.width=this.overlayCanvas.height=1;this.coastCanvas.width=this.coastCanvas.height=1;this.disposed=true;}
}
const api=Object.freeze({Renderer,geo,ungeo,version:'B5.0',heightStatus:'artistic-heightfield-not-DEM'});root.TMShanhe25D=api;
})(typeof window!=='undefined'?window:globalThis);
