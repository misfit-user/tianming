/* Editable original troop models. Y up, facing -Z; 0=near, 1=middle, 2=far.
 * Vertex layout: position(3), normal(3), color(3), articulated part, material.
 * No external textures, executable skill strings, random simulation calls or save mutations. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleUnitAssets=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const kinds=['spear','sword','halberd','shock','heavy','horse','bow','crossbow','musket','cannon','guard','general','dead'];
  const cache=new Map(),C={cloth:[.52,.20,.13],metal:[.26,.29,.30],edge:[.58,.58,.51],gold:[.64,.47,.23],skin:[.69,.49,.33],wood:[.34,.22,.12],leather:[.16,.12,.09],hair:[.10,.09,.08],horse:[.37,.24,.15],dark:[.08,.09,.09]};
  function kindFor(u){if(u._hero||u.emperor)return'general';if(kinds.includes(u.sub))return u.sub;return{step:'spear',cav:'shock',bow:'bow',art:'cannon',guard:'guard'}[u.type]||'spear';}
  function generate(kind,lod){
    if(!kinds.includes(kind))kind='spear';lod=Math.max(0,Math.min(2,lod|0));const key=kind+':'+lod;if(cache.has(key))return cache.get(key);
    const vertices=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],features=[];let part=0,material=0;
    const seg=lod===0?10:lod===1?7:4,ring=lod===0?5:lod===1?3:2;
    function tri(a,b,c,color){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-9)return;for(const p of [a,b,c]){for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}vertices.push(...p,n[0]/l,n[1]/l,n[2]/l,...color,part,material);}}
    function quad(a,b,c,d,color){tri(a,b,c,color);tri(a,c,d,color);}
    function box(x,y,z,hx,hy,hz,color){const p=[];for(const zz of [-1,1])for(const [xx,yy] of [[-1,-1],[1,-1],[1,1],[-1,1]])p.push([x+xx*hx,y+yy*hy,z+zz*hz]);for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]])quad(...f.map(i=>p[i]),color);}
    function tube(a,b,r1,r2,color,sides=seg,cap=true){const axis=b.map((v,i)=>v-a[i]),len=Math.hypot(...axis);if(!len)return;for(let i=0;i<3;i++)axis[i]/=len;let u=Math.abs(axis[1])>.9?[1,0,0]:[-axis[2],0,axis[0]],l=Math.hypot(...u);u=u.map(v=>v/l);const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]],p=[],q=[];for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2,o=u.map((x,k)=>x*Math.cos(t)+v[k]*Math.sin(t));p.push(a.map((x,k)=>x+o[k]*r1));q.push(b.map((x,k)=>x+o[k]*r2));}for(let i=0;i<sides;i++){const j=(i+1)%sides;quad(p[i],p[j],q[j],q[i],color);if(cap){tri(a,p[j],p[i],color);tri(b,q[i],q[j],color);}}}
    function ellipsoid(x,y,z,rx,ry,rz,color,s=seg,r=ring){const p=[];for(let j=0;j<=r;j++)for(let i=0;i<=s;i++){const t=j/r*Math.PI,a=i/s*Math.PI*2;p.push([x+Math.sin(t)*Math.cos(a)*rx,y+Math.cos(t)*ry,z+Math.sin(t)*Math.sin(a)*rz]);}for(let j=0;j<r;j++)for(let i=0;i<s;i++){const a=j*(s+1)+i,b=a+1,c=a+s+1,d=c+1;tri(p[a],p[b],p[c],color);tri(p[b],p[d],p[c],color);}}
    function withPart(p,m,fn){const old=[part,material];part=p;material=m;fn();[part,material]=old;}
    function blade(a,b,width,color){const tip=b,base=[a[0]-width,a[1],a[2]],edge=[a[0]+width,a[1],a[2]],ridge=[a[0],a[1],a[2]-.025];tri(base,ridge,tip,color);tri(ridge,edge,tip,C.edge);tri(edge,base,tip,color);}
    function human(offset,mounted,armored,general,weapon){
      const y=offset,legTop=mounted?y+.37:y+.91,feet=mounted?y-.22:y+.08;
      for(const side of [-1,1])withPart(side<0?1:2,1,()=>{const x=mounted?side*.39:side*.145;tube([side*.18,legTop,.02],[x,feet+.15,mounted?.12:0],.115,.075,C.cloth,lod===2?4:6);material=0;box(x,feet, -.055,.088,.125,.15,C.leather);});
      withPart(0,1,()=>{ellipsoid(0,y+1.19,0,.31,.45,.21,C.cloth);box(0,y+.91,.01,.27,.21,.21,C.cloth);});
      if(armored)withPart(0,2,()=>{ellipsoid(0,y+1.30,-.015,.32,.30,.23,C.metal);for(const side of [-1,1])box(side*.31,y+1.43,0,.125,.095,.23,C.metal);
        if(lod===0){for(const back of [-1,1])for(let row=0;row<5;row++)for(let col=-2;col<=2;col++)box(col*.102,y+1.08+row*.086,back*.227,.043,.032,.014,(row+col)%2?C.metal:C.edge);for(const side of [-1,1])for(let row=0;row<3;row++)box(side*.18,y+.71+row*.11,-.22,.16,.045,.015,C.metal);}
      });
      withPart(0,0,()=>{box(0,y+.99,0,.30,.045,.235,C.leather);box(0,y+.99,-.245,.046,.04,.018,general?C.gold:C.edge);});
      for(const side of [-1,1])withPart(side<0?3:4,1,()=>{tube([side*.30,y+1.48,0],[side*.41,y+1.12,-.16],.105,.085,C.cloth,6);tube([side*.41,y+1.12,-.16],[side*.39,y+1.10,-.36],.075,.055,C.cloth,6);material=0;ellipsoid(side*.39,y+1.10,-.37,.069,.08,.065,C.skin,6,2);});
      withPart(0,0,()=>{tube([0,y+1.56,0],[0,y+1.69,0],.085,.09,C.skin,6);ellipsoid(0,y+1.81,-.012,.145,.19,.145,C.skin);
        if(lod===0){box(-.057,y+1.84,-.144,.025,.013,.008,C.dark);box(.057,y+1.84,-.144,.025,.013,.008,C.dark);box(0,y+1.78,-.17,.026,.036,.025,C.skin);}
      });
      withPart(0,2,()=>{ellipsoid(0,y+1.96,.01,.177,.15,.18,C.metal);box(0,y+1.9,.012,.174,.024,.182,general?C.gold:C.edge);for(const side of [-1,1])box(side*.15,y+1.77,.04,.033,.14,.13,C.metal);
        tube([0,y+2.07,.015],[0,y+2.20,.06],.045,.008,general?C.gold:C.metal,6);
      });
      if(general){features.push('commander-cape','gilded-crest');withPart(8,1,()=>{const strips=lod===0?6:2;for(let i=0;i<strips;i++){const x=-.34+i*.68/strips,x2=x+.68/strips;quad([x,y+1.55,.20],[x2,y+1.55,.20],[x2*1.35,y+.38,.48],[x*1.35,y+.38,.48],C.cloth);}});withPart(0,2,()=>{for(const side of [-1,1])blade([side*.17,y+2.01,.02],[side*.30,y+2.24,.11],.065,C.gold);});}
      withPart(4,0,()=>{
        if(['spear','halberd','shock','heavy','guard','general'].includes(weapon)){
          const top=[.42,y+2.76,-.42],base=[.38,y+.17,-.27];tube(base,top,.019,.014,C.wood,lod===2?4:6);material=2;blade(top,[.42,y+3.12,-.44],.055,C.edge);features.push('long-shaft');
          if(weapon==='halberd'||weapon==='general'){blade([.43,y+2.66,-.43],[.70,y+2.92,-.44],.10,C.edge);tube([.4,y+2.6,-.43],[.59,y+2.67,-.44],.015,.014,C.metal,4);features.push('halberd-blade');}
        }else if(weapon==='sword'){material=2;blade([.39,y+1.15,-.41],[.41,y+2.10,-.52],.046,C.edge);box(.39,y+1.14,-.42,.10,.024,.027,C.gold);features.push('sabre');}
        else if(weapon==='bow'||weapon==='horse'){
          const n=lod===2?5:10;for(let i=0;i<n;i++){const t=i/n,tt=(i+1)/n,a=[.38+Math.sin(t*Math.PI)*.29,y+.62+t*1.3,-.48],b=[.38+Math.sin(tt*Math.PI)*.29,y+.62+tt*1.3,-.48];tube(a,b,.017,.014,C.wood,4);}tube([.38,y+.62,-.48],[.38,y+1.92,-.48],.003,.003,C.edge,3);features.push('curved-bow');
        }else if(weapon==='crossbow'){
          box(.37,y+1.10,-.51,.047,.043,.39,C.wood);tube([-.02,y+1.12,-.76],[.76,y+1.12,-.76],.025,.023,C.metal,6);tube([-.02,y+1.12,-.76],[.37,y+1.12,-.44],.004,.004,C.leather,3);tube([.76,y+1.12,-.76],[.37,y+1.12,-.44],.004,.004,C.leather,3);features.push('crossbow-limbs');
        }else if(weapon==='musket'){
          box(.36,y+1.10,-.59,.045,.065,.37,C.wood);material=2;tube([.36,y+1.18,-.36],[.36,y+1.18,-1.22],.027,.022,C.metal,seg);box(.40,y+1.16,-.52,.042,.025,.042,C.edge);features.push('gun-barrel');
        }
      });
      if(weapon==='sword'||weapon==='guard')withPart(3,0,()=>{tube([-.46,y+1.12,-.40],[-.46,y+1.12,-.49],.36,.36,C.wood,lod===0?12:6);material=2;tube([-.46,y+1.12,-.49],[-.46,y+1.12,-.505],.365,.365,C.metal,lod===0?12:6);ellipsoid(-.46,y+1.12,-.53,.09,.09,.045,C.edge,6,2);features.push('round-shield');});
      if(['bow','horse','crossbow'].includes(weapon))withPart(0,0,()=>{box(-.19,y+1.28,.23,.09,.27,.08,C.leather);if(lod<2)for(let i=0;i<4;i++)tube([-.25+i*.038,y+1.43,.23],[-.25+i*.038,y+1.81,.25],.007,.007,C.wood,3);});
    }
    const mounted=['shock','heavy','horse','general'].includes(kind);
    if(mounted){
      features.push('horse','rider');withPart(0,3,()=>{ellipsoid(0,1.02,.12,.32,.41,.78,C.horse);tube([0,1.16,-.37],[0,1.76,-.70],.27,.16,C.horse);ellipsoid(0,1.73,-.83,.16,.20,.29,C.horse);ellipsoid(0,1.57,-1.02,.13,.12,.22,C.horse);for(const side of [-1,1])tube([side*.105,1.88,-.71],[side*.12,2.13,-.68],.045,.005,C.horse,4);tube([0,1.09,.83],[0,.44,1.09],.10,.025,C.hair,6);});
      for(const side of [-1,1])for(const front of [-1,1])withPart((side===front)?6:7,3,()=>{const x=side*.24,z=front*.49;tube([x,1.08,z],[x,.43,z+.04],.09,.06,C.horse,6);tube([x,.43,z+.04],[x,.09,z-.03],.054,.041,C.horse,6);material=0;box(x,.075,z-.05,.065,.075,.105,C.hair);});
      withPart(0,1,()=>{box(0,1.37,.07,.34,.06,.34,C.cloth);for(const side of [-1,1])box(side*.34,1.10,.13,.032,.27,.33,C.cloth);});
      withPart(0,0,()=>{box(0,1.47,.12,.26,.075,.27,C.leather);for(const side of [-1,1]){tube([side*.14,1.66,-1.01],[side*.28,1.64,.09],.009,.009,C.leather,4);tube([side*.18,1.44,.1],[side*.42,.93,.17],.015,.012,C.leather,4);}box(0,1.61,-.97,.145,.035,.065,C.leather);});
      if(kind==='heavy'||kind==='general')withPart(0,2,()=>{features.push('horse-armour');ellipsoid(0,1.13,-.35,.34,.32,.38,C.metal);box(0,1.75,-1.01,.13,.16,.06,C.metal);if(lod<2)for(const side of [-1,1])for(let i=0;i<5;i++)box(side*.35,1.12,.48-i*.18,.025,.22,.077,C.metal);});
      human(.91,true,true,kind==='general',kind);
    }else if(kind==='cannon'){
      features.push('wheels','barrel','gun-carriage');withPart(0,0,()=>{box(0,.50,.20,.38,.13,.82,C.wood);box(0,.70,-.05,.27,.12,.39,C.wood);tube([-.67,.42,.15],[.67,.42,.15],.075,.075,C.metal,6);});
      for(const side of [-1,1])withPart(9,0,()=>{const x=side*.60;tube([x-.055,.44,.15],[x+.055,.44,.15],.43,.43,C.wood,lod===0?14:8);material=2;tube([x+.056*side,.44,.15],[x+.08*side,.44,.15],.43,.43,C.metal,lod===0?14:8);if(lod<2)for(let i=0;i<6;i++){const a=i/6*Math.PI*2;tube([x+.082*side,.44,.15],[x+.082*side,.44+Math.cos(a)*.36,.15+Math.sin(a)*.36],.020,.018,C.gold,4);}});
      withPart(0,2,()=>{tube([0,.88,.56],[0,.99,-1.23],.19,.13,C.metal,lod===0?14:8);tube([0,.99,-1.24],[0,.99,-1.28],.135,.135,C.dark,seg);for(const z of [-1.12,-.63,.15,.48])tube([0,.91-z*.06,z-.025],[0,.91-z*.06,z+.025],z<-.7?.15:.197,z<-.7?.15:.197,C.edge,seg);});
    }else human(0,false,!['bow','musket','crossbow'].includes(kind),false,kind==='dead'?'sword':kind);
    if(kind==='dead'){min.fill(Infinity);max.fill(-Infinity);for(let i=0;i<vertices.length;i+=11){const y=vertices[i+1],z=vertices[i+2];vertices[i+1]=.48-z;vertices[i+2]=-y;const ny=vertices[i+4],nz=vertices[i+5];vertices[i+4]=-nz;vertices[i+5]=-ny;vertices[i+9]=0;for(let j=0;j<3;j++){min[j]=Math.min(min[j],vertices[i+j]);max[j]=Math.max(max[j],vertices[i+j]);}}}
    const model={kind,lod,stride:11,vertices:new Float32Array(vertices),count:vertices.length/11,triangles:vertices.length/33,height:mounted?3.14:kind==='cannon'?1.15:2.2,features:[...new Set(features)],bounds:{min,max}};cache.set(key,model);return model;
  }
  return{kinds,generate,kindFor};
});
