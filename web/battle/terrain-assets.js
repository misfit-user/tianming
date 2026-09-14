/* Original, editable tactical prop models. Normalized world-space geometry, three explicit LODs. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleAssets=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const cache=new Map(),materials={wood:0,wall:1,roof:2,leaf:3,stone:4,snow:5};
  function generate(kind,lod,variant){
    lod=Math.max(0,Math.min(2,lod|0));variant=variant|0;const key=kind+':'+lod+':'+variant;if(cache.has(key))return cache.get(key);
    const out=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let material=0;
    function tri(a,b,c,color,uv){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-9)return;n=n.map(v=>v/l);for(const [i,p] of [a,b,c].entries()){for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}out.push(...p,...n,...color,...(uv?uv[i]:[p[0],p[2]]),material);}}
    function box(x,y,z,hx,hy,hz,c){const p=[];for(const zz of [z,z+hz])for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])p.push([x+a*hx,y+b*hy,zz]);for(const [a,b,c1,d] of [[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){tri(p[a],p[b],p[c1],c);tri(p[a],p[c1],p[d],c);}}
    function branch(a,b,r1,r2,c,sides){const dz=b.map((v,i)=>v-a[i]),len=Math.hypot(...dz),axis=dz.map(v=>v/len);let u=Math.abs(axis[2])>.9?[1,0,0]:[-axis[1],axis[0],0],ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]],p=[],q=[];for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2,off=u.map((x,k)=>x*Math.cos(t)+v[k]*Math.sin(t));p.push(a.map((x,k)=>x+off[k]*r1));q.push(b.map((x,k)=>x+off[k]*r2));}for(let i=0;i<sides;i++){const j=(i+1)%sides;tri(p[i],p[j],q[j],c);tri(p[i],q[j],q[i],c);}}
    function sphere(x,y,z,rx,ry,rz,c,segments,rings){const p=[];for(let j=0;j<=rings;j++){const t=j/rings*Math.PI;for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,pulse=1+.09*Math.sin(a*3+j+variant);p.push([x+Math.sin(t)*Math.cos(a)*rx*pulse,y+Math.sin(t)*Math.sin(a)*ry*pulse,z+Math.cos(t)*rz]);}}for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c1=a+segments+1,d=c1+1;tri(p[a],p[c1],p[b],c);tri(p[b],p[c1],p[d],c);}}
    function leafCard(x,y,z,s,angle,tilt,c){const u=[Math.cos(angle)*s,Math.sin(angle)*s,0],v=[-Math.sin(angle)*Math.sin(tilt)*s,Math.cos(angle)*Math.sin(tilt)*s,Math.cos(tilt)*s],a=[x-u[0]-v[0],y-u[1]-v[1],z-v[2]],b=[x+u[0]-v[0],y+u[1]-v[1],z-v[2]],cc=[x+u[0]+v[0],y+u[1]+v[1],z+v[2]],d=[x-u[0]+v[0],y-u[1]+v[1],z+v[2]];tri(a,b,cc,c,[[0,0],[1,0],[1,1]]);tri(a,cc,d,c,[[0,0],[1,1],[0,1]]);}
    if(kind==='house'){
      material=materials.stone;box(0,0,0,1.03,.69,.16,[.43,.43,.36]);material=materials.wall;box(0,0,.13,1,.66,.86,[.69,.64,.50]);
      material=materials.wood;for(const x of [-.93,0,.93])for(const y of [-.64,.64])box(x,y,.15,.045,.045,.86,[.27,.22,.16]);
      box(0,-.672,.15,.17,.013,.58,[.20,.17,.12]);for(const x of [-.6,.6]){box(x,-.675,.48,.16,.016,.24,[.25,.23,.18]);if(lod===0)for(let j=-2;j<=2;j++)box(x+j*.055,-.698,.48,.009,.012,.24,[.50,.43,.29]);}
      material=materials.roof;const count=lod===0?18:lod===1?8:2,rows=lod===0?8:lod===1?4:1;
      for(const side of [-1,1])for(let i=0;i<count;i++)for(let j=0;j<rows;j++){
        const x0=-1.2+2.4*i/count,x1=-1.2+2.4*(i+1)/count,t0=j/rows,t1=(j+1)/rows;
        const height=t=>1.55-.67*t+.12*t*t+(lod===0?Math.sin(i*Math.PI*.5)*.014:0),y0=t0*.88*side,y1=t1*.88*side,col=[.29+(i%3)*.014,.32+(j%2)*.008,.30];
        const a=[x0,y0,height(t0)],b=[x1,y0,height(t0)],c=[x1,y1,height(t1)],d=[x0,y1,height(t1)];if(side>0){tri(a,b,c,col,[[i/count,t0],[i/count+.08,t0],[i/count+.08,t1]]);tri(a,c,d,col,[[i/count,t0],[i/count+.08,t1],[i/count,t1]]);}else{tri(a,c,b,col,[[i/count,t0],[i/count+.08,t1],[i/count+.08,t0]]);tri(a,d,c,col,[[i/count,t0],[i/count,t1],[i/count+.08,t1]]);}
      }
      material=materials.wall;for(const x of [-1,1])tri([x,-.66,.98],[x,.66,.98],[x,0,1.52],[.59,.53,.39]);
      material=materials.roof;box(0,0,1.54,1.22,.036,.05,[.37,.38,.33]);material=materials.wood;box(0,0,.94,1.2,.88,.045,[.31,.27,.19]);
      if(lod===0){material=materials.stone;box(0,-.92,.01,.32,.21,.07,[.50,.48,.39]);material=materials.wood;for(const y of [-.45,.45])box(0,y,.90,1.08,.025,.05,[.25,.22,.16]);}
    }else if(kind==='palisade'){
      material=materials.wood;for(let i=-2;i<=2;i++){const x=i*.42;branch([x,0,0],[x,0,1.92],.19,.14,[.40,.32,.22],lod===0?8:4);tri([x-.14,0,1.9],[x+.14,0,1.9],[x,0,2.17],[.53,.43,.29]);}box(0,-.19,.55,1.05,.05,.1,[.29,.23,.15]);box(0,-.19,1.4,1.05,.05,.1,[.29,.23,.15]);
    }else if(kind==='rock'){
      material=materials.stone;sphere(0,0,.3,.87,.80,.73,[.48,.48,.41],lod===0?14:lod===1?9:5,lod===0?7:lod===1?4:2);
    }else{
      const pine=kind==='pine'||kind==='snow-pine',snow=kind==='snow-pine',willow=kind==='willow',wood=[.31,.25,.17],leaf=snow?[.66,.74,.65]:willow?[.28,.42,.19]:[.25,.38,.13];
      material=materials.wood;branch([0,0,0],[.07,-.03,pine?1.9:1.45],.09,.027,wood,lod===0?10:6);
      const crowns=pine?5:5+(variant%3),sides=lod===0?8:5;
      for(let i=0;i<crowns;i++){
        const angle=i*2.399+variant*.7,z=pine?.67+i*.27:.92+(i%3)*.23,r=pine?.68-i*.085:.38+(i%2)*.15,x=pine?0:Math.cos(angle)*r*.75,y=pine?0:Math.sin(angle)*r*.75;
        material=materials.wood;if(lod<2)branch([.025,0,z-.27],[x,y,z+.04],.035,.012,wood,sides);
        material=lod===0?materials.leaf:(snow?materials.snow:materials.leaf+0.4);
        if(lod===0){const cards=pine?11:18;for(let k=0;k<cards;k++){const a=k*2.399+i*1.7,rad=Math.sqrt((k+.5)/cards)*r,cx=x+Math.cos(a)*rad,cy=y+Math.sin(a)*rad,cz=z+(pine?.24:.22)*Math.sin(k*1.37)+(willow?-.25*rad:0);leafCard(cx,cy,cz,r*.48,a,(k%3)*.56,leaf.map(v=>v*(.86+(k%4)*.075)));}}
        else sphere(x,y,z,r,r*.85,pine?.3:.40,leaf,lod===1?6:5,2);
      }
    }
    const mesh={kind,lod,variant,stride:12,vertices:new Float32Array(out),count:out.length/12,triangles:out.length/36,bounds:{min,max}};cache.set(key,mesh);return mesh;
  }
  function kindFor(prop,world){if(prop.kind!=='tree')return prop.kind;if(world.snow)return'snow-pine';if(world.biome==='wetland')return'willow';return prop.variant>.7?'pine':'broadleaf';}
  return{generate,kindFor,materials};
});
