/* Tactical landscape authority. Seeded, bounded, DOM-free; simulation and renderer share it. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleTerrain=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>(t=clamp(t,0,1))*t*(3-2*t);
  function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function noise(x,y,seed){
    const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
    function hash(a,b){let h=Math.imul(a,374761393)^Math.imul(b,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
    return mix(mix(hash(ix,iy),hash(ix+1,iy),fx),mix(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy);
  }
  function segment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a.x-dx*t,y-a.y-dy*t);}
  function raycast(a,b,height,field,scale){
    if(field)return raycastGrid(a,b,field,scale||1);
    const at=t=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
    let lo=0,prev=a[2]-height(a[0],a[1]);if(prev<=0)return{x:a[0],y:a[1]};
    // Front-most intersection; bounded marching followed by bisection, not a z=0 projection.
    for(let i=1;i<=160;i++){const hi=i/160,p=at(hi),d=p[2]-height(p[0],p[1]);if(d<=0&&prev>0){let l=lo,h=hi;for(let j=0;j<22;j++){const m=(l+h)/2,q=at(m);if(q[2]>height(q[0],q[1]))l=m;else h=m;}const q=at((l+h)/2);return{x:q[0],y:q[1]};}lo=hi;prev=d;}return null;
  }
  function raycastGrid(a,b,g,scale){
    const d=b.map((v,i)=>v-a[i]),sx=g.w/(g.nx-1),sy=g.h/(g.ny-1);let entry=0,exit=1;
    for(const [axis,size] of [[0,g.w],[1,g.h]]){if(Math.abs(d[axis])<1e-10){if(a[axis]<0||a[axis]>size)return null;}else{let t0=-a[axis]/d[axis],t1=(size-a[axis])/d[axis];if(t0>t1)[t0,t1]=[t1,t0];entry=Math.max(entry,t0);exit=Math.min(exit,t1);}}if(entry>exit)return null;
    let i=clamp(Math.floor((a[0]+d[0]*entry)/sx),0,g.nx-2),j=clamp(Math.floor((a[1]+d[1]*entry)/sy),0,g.ny-2),t=entry;
    const ix=Math.sign(d[0]),iy=Math.sign(d[1]),deltaX=ix?sx/Math.abs(d[0]):Infinity,deltaY=iy?sy/Math.abs(d[1]):Infinity;
    let nextX=ix?((i+(ix>0?1:0))*sx-a[0])/d[0]:Infinity,nextY=iy?((j+(iy>0?1:0))*sy-a[1])/d[1]:Infinity;
    function triangle(v0,v1,v2){const e1=v1.map((v,k)=>v-v0[k]),e2=v2.map((v,k)=>v-v0[k]),p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-9)return Infinity;const v=a.map((x,k)=>x-v0[k]),u=(v[0]*p[0]+v[1]*p[1]+v[2]*p[2])/det;if(u< -1e-7||u>1.0000001)return Infinity;const q=[v[1]*e1[2]-v[2]*e1[1],v[2]*e1[0]-v[0]*e1[2],v[0]*e1[1]-v[1]*e1[0]],vv=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])/det;if(vv< -1e-7||u+vv>1.0000001)return Infinity;const hit=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])/det;return hit>=entry-1e-8&&hit<=exit+1e-8?hit:Infinity;}
    // Grid DDA tests every crossed cell's actual two triangles. Narrow ridges cannot fall between samples.
    for(let n=0;n<g.nx+g.ny+4&&i>=0&&j>=0&&i<g.nx-1&&j<g.ny-1&&t<=exit+1e-8;n++){
      const k=j*g.nx+i,v0=[i*sx,j*sy,g.heights[k]*scale],v1=[(i+1)*sx,j*sy,g.heights[k+1]*scale],v2=[i*sx,(j+1)*sy,g.heights[k+g.nx]*scale],v3=[(i+1)*sx,(j+1)*sy,g.heights[k+g.nx+1]*scale],end=Math.min(nextX,nextY,exit),hit=Math.min(triangle(v0,v1,v2),triangle(v1,v3,v2));
      if(hit>=t-1e-8&&hit<=end+1e-8)return{x:a[0]+d[0]*hit,y:a[1]+d[1]*hit};if(end>=exit)break;
      const crossX=nextX<=nextY,crossY=nextY<=nextX;t=end;if(crossX){i+=ix;nextX+=deltaX;}if(crossY){j+=iy;nextY+=deltaY;}
    }return null;
  }
  function create(seed,profile){
    seed=(Number(seed)>>>0)||1;profile=profile||{};const R=rng(seed^0x39a816d1),dir=(profile.provinceMeta||{}).neighborDir||'N',horizontal=dir==='E'||dir==='W';
    const w=32000+Math.floor(R()*2200),h=24000+Math.floor(R()*1500),biome=profile.biome||'plain',waterLevel=12;
    const axis=(side,main)=>horizontal?{x:w/2+(main-.5)*h,y:side*h}:{x:side*w,y:main*h};
    const deployment=side=>{const sign=(dir==='S'||dir==='E'?1:-1)*(side==='jin'?1:-1);return{x:w/2+(horizontal?sign*h*.12:0),y:h/2+(horizontal?0:sign*h*.12)};};
    function deployMask(x,y){let f=0;for(const side of ['ming','jin']){const c=deployment(side),a=Math.abs(horizontal?y-c.y:x-c.x),b=Math.abs(horizontal?x-c.x:y-c.y);f=Math.max(f,(1-smooth((a-7400)/1000))*(1-smooth((b-1350)/650)));}return f;}
    const wet=biome==='wetland',desert=biome==='desert',snow=biome==='snow'||profile.weather==='snow',density=clamp(Number(profile.dens)||.30,.12,.7);
    const river=[],crossings=[],riverW=wet?640:desert?280:420+R()*180,hasRiver=wet||!desert||R()<.35;
    const phase=R()*6.28;
    if(hasRiver)for(let i=0;i<=128;i++){const t=i/128,main=.50+.014*Math.sin(t*8+phase)+.005*Math.sin(t*21+phase*.7);river.push(axis(t,main));}
    function riverInfo(x,y){
      if(!river.length)return{distance:Infinity,x:0,y:0,tx:1,ty:0};
      const t=clamp((horizontal?y/h:x/w)*128,0,127.999),i=Math.floor(t),a=river[i],b=river[i+1],l=Math.hypot(b.x-a.x,b.y-a.y),tx=(b.x-a.x)/l,ty=(b.y-a.y)/l;
      return{distance:segment(x,y,a,b),x:mix(a.x,b.x,t-i),y:mix(a.y,b.y,t-i),tx,ty};
    }
    if(hasRiver)for(const [t,kind] of [[.28,'ford'],[.5,'bridge'],[.73,'ford']]){const p=axis(t,.5),b=riverInfo(p.x,p.y);crossings.push({...b,t,kind,width:kind==='bridge'?560:1000,length:riverW+460});}
    function crossingAt(x,y,pad){return crossings.find(b=>Math.abs((x-b.x)*b.tx+(y-b.y)*b.ty)<b.width/2+(pad||0)&&Math.abs(-(x-b.x)*b.ty+(y-b.y)*b.tx)<b.length/2+(pad||0));}
    const coast={};if(profile.coast||profile.island){if(profile.island||(profile.provinceMeta||{}).oceanSide==='left')coast.leftX=w*.07;else coast.rightX=w*.93;if(profile.island)coast.rightX=w*.93;}
    function coastX(side,y){const wav=70*Math.sin(y/h*23+phase)+45*Math.sin(y/h*51);return coast[side]+(side==='leftX'?1:-1)*wav;}
    function seaDepth(x,y){return Math.max(coast.leftX==null?-1e6:coastX('leftX',y)-x,coast.rightX==null?-1e6:x-coastX('rightX',y));}
    const isWater=(x,y)=>seaDepth(x,y)>0||(riverInfo(x,y).distance<riverW*.5&&!crossingAt(x,y));
    const hills=[],forests=[],ponds=[];
    // Ridges flank a broad manoeuvre basin; low shoulders rather than disconnected circular cones.
    for(let i=0;i<12;i++){const side=i%2?.86:.14,main=.08+(i>>1)*.166,p=axis(side+(R()-.5)*.09,main);hills.push({...p,r:2200+R()*1900,height:((desert?360:550)+R()*850)*(.65+density*1.2),stretch:1.25+R()*.6});}
    const objective=axis(.62,.54);hills.push({...objective,r:1800,height:300,stretch:1.2});
    objective.r=1200;objective.name='中军高地';
    for(let i=0;i<22;i++){const p=axis(.08+R()*.84,.08+R()*.84);if(deployMask(p.x,p.y)>.2)continue;forests.push({...p,r:(desert?500:950)+R()*(wet?1700:1400)});}
    const settlements=[axis(.27,.455),axis(.73,.565)];
    function forestAt(x,y){if(deployMask(x,y)>.1||isWater(x,y)||crossingAt(x,y,180)||settlements.some(c=>Math.hypot(x-c.x,y-c.y)<2200))return false;for(const f of forests){const d=Math.hypot(x-f.x,y-f.y);if(d<f.r*(.73+.35*noise(x/450,y/450,seed+22)))return true;}return false;}
    const roads=[];
    for(const t of [.28,.5,.73]){
      const b=crossings.find(b=>b.t===t),mid=b?{x:b.x,y:b.y}:axis(t,.5),a=axis(t+(t-.5)*.08,.08),z=axis(t-(t-.5)*.08,.92);
      roads.push({width:t===.5?240:135,main:t===.5,pts:[a,axis(t-.015,.28),{x:mid.x+(b?b.ty:0)*900,y:mid.y-(b?b.tx:1)*900},mid,{x:mid.x-(b?b.ty:0)*900,y:mid.y+(b?b.tx:1)*900},axis(t+.014,.72),z]});
    }
    function roadDistance(x,y){let v=Infinity;for(const rd of roads)for(let i=1;i<rd.pts.length;i++)v=Math.min(v,segment(x,y,rd.pts[i-1],rd.pts[i])/rd.width);return v;}
    function rawHeight(x,y){
      const f=noise(x/2100,y/2100,seed),warp=(f-.5)*500;
      let z=42+18*noise(x/850,y/850,seed+7)+12*noise(x/290,y/290,seed+18);
      for(const p of hills){const dx=x-p.x+warp,dy=(y-p.y-warp*.4)/p.stretch,d=Math.hypot(dx,dy)/p.r;if(d<1.3)z+=p.height*Math.pow(Math.max(0,1-d/1.3),2.2)*(0.8+.25*f);}
      z=mix(z,48+f*5,deployMask(x,y));
      for(const c of settlements)z=mix(z,72+f*3,1-smooth((Math.hypot(x-c.x,y-c.y)-800)/1400));
      const ri=riverInfo(x,y),shore=smooth((ri.distance-riverW*.48)/700),b=crossingAt(x,y,50);
      if(hasRiver){const bed=b?waterLevel+(b.kind==='bridge'?28:-2):waterLevel-8;z=mix(bed,z,shore);}
      const sea=seaDepth(x,y);if(sea>-300)z=mix(z,waterLevel-10,smooth((sea+300)/300));
      return z;
    }
    const nx=257,ny=193,heights=new Float32Array(nx*ny);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)heights[y*nx+x]=rawHeight(x*w/(nx-1),y*h/(ny-1));
    function heightAt(x,y){
      const xx=clamp(x/w*(nx-1),0,nx-1.00001),yy=clamp(y/h*(ny-1),0,ny-1.00001),i=Math.floor(xx),j=Math.floor(yy),a=xx-i,b=yy-j,k=j*nx+i;
      // Same diagonal and interpolation as the actual triangle mesh (not a different bilinear surface).
      return a+b<=1?heights[k]+a*(heights[k+1]-heights[k])+b*(heights[k+nx]-heights[k]):heights[k+nx+1]+(1-a)*(heights[k+nx]-heights[k+nx+1])+(1-b)*(heights[k+1]-heights[k+nx+1]);
    }
    // Anchor the objective at the actual dry crest, not a river-carved shoulder with a hill label.
    let crest={x:objective.x,y:objective.y,z:-Infinity};
    for(let dy=-650;dy<=650;dy+=65)for(let dx=-650;dx<=650;dx+=65){const x=objective.x+dx,y=objective.y+dy,z=heightAt(x,y);if(!isWater(x,y)&&deployMask(x,y)<.1&&z>crest.z)crest={x,y,z};}
    objective.x=crest.x;objective.y=crest.y;
    const props=[],fields=[],hamlets=[];
    function good(x,y){return x>350&&y>350&&x<w-350&&y<h-350&&!isWater(x,y)&&heightAt(x,y)>waterLevel+10&&!crossingAt(x,y,260)&&deployMask(x,y)<.1&&roadDistance(x,y)>1.1;}
    const target=desert?420:Math.round((wet?2600:2900)*(.6+density*1.4));
    for(let i=0;i<60000&&props.length<target;i++){const x=R()*w,y=R()*h;if(good(x,y)&&forestAt(x,y))props.push({kind:'tree',x,y,size:90+R()*110,variant:R(),rotation:R()*6.283});}
    for(let i=0;i<300;i++){const x=R()*w,y=R()*h;if(good(x,y)&&heightAt(x,y)>120)props.push({kind:'rock',x,y,size:35+R()*110,variant:R(),rotation:R()*6.283});}
    for(const center of settlements){
      if(isWater(center.x,center.y))continue;
      hamlets.push({...center,r:780});
      for(let j=0;j<20;j++){const x=center.x+(j%5-2)*240+(R()-.5)*60,y=center.y+(Math.floor(j/5)-1.5)*290+(R()-.5)*60;if(good(x,y)&&!forestAt(x,y))props.push({kind:'house',x,y,size:90+R()*45,variant:R(),rotation:horizontal?Math.PI/2:0});}
      if(profile.fort)for(let j=-6;j<=6;j++){if(Math.abs(j)<2)continue;const x=center.x+j*130,y=center.y+720;if(good(x,y))props.push({kind:'palisade',x,y,size:60,variant:0,rotation:0});}
      for(let j=0;j<35;j++){const x=center.x+(R()-.5)*4600,y=center.y+(R()-.5)*3600,fw=480+R()*530,fh=380+R()*480;
        if(!good(x,y)||forestAt(x,y)||Math.hypot(heightAt(x+80,y)-heightAt(x-80,y),heightAt(x,y+80)-heightAt(x,y-80))>40)continue;
        if([[-1,-1],[-1,1],[1,-1],[1,1]].some(([a,b])=>isWater(x+a*fw/2,y+b*fh/2)||forestAt(x+a*fw/2,y+b*fh/2)))continue;
        if(fields.some(f=>Math.abs(x-f.x)<(fw+f.w)/2+50&&Math.abs(y-f.y)<(fh+f.h)/2+50))continue;
        fields.push({x,y,w:fw,h:fh,a:0,style:Math.floor(R()*4),rows:10+Math.floor(R()*9)});
      }
    }
    function surfaceAt(x,y){if(deployMask(x,y)>.8)return'plain';const b=crossingAt(x,y);if(b)return b.kind==='bridge'?'plain':'river';if(seaDepth(x,y)>0)return'marsh';if(riverInfo(x,y).distance<riverW/2)return'river';if(forestAt(x,y))return'forest';if(heightAt(x,y)>130)return'hill';return'plain';}
    return{version:1,seed,key:[seed,biome,dir,density,profile.coast,profile.island,profile.fort,profile.weather,(profile.provinceMeta||{}).oceanSide].join(':'),w,h,nx,ny,heights,biome,snow,waterLevel,river,riverW,crossings,coast,hills,forests,ponds,roads,props,fields,hamlets,objective,deployment,deployMask,heightAt,forestAt,surfaceAt,riverInfo,crossingAt,isWater,seaDepth,coastX,roadDistance};
  }
  return{create,raycast,rng,noise};
});
