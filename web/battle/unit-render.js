/* Instanced articulated troop rendering. Bounded reusable upload buffers; view LOD never changes simulation. */
(function(root){'use strict';
  const A=root.TMBattleUnitAssets,S=root.TMBattleShadows,V=root.TMBattleUnitVisibility,groups={},pools=new Map(),bounds=new Map();let lastInstances={};
  function instances(units,o){
    for(const key in groups)groups[key].length=0;
    const quality=o.quality||'balanced',ex=o.EX,zoom=o.cam.zoom,now=o.now,zMul=Math.max(1,Math.min(1.8,.12/zoom));let total=0;
    function add(kind,lod,x,y,angle,scale,tint,phase,am){
      if(total>=8000)return;const z=ex*o.heightAt(x,y),cf=Math.cos(angle-Math.PI/2),sf=Math.sin(angle-Math.PI/2);if(V&&o.frustum){if(!bounds.has(kind))bounds.set(kind,V.bounds(A.generate(kind,0)));const b=bounds.get(kind);if(!V.visible(o.frustum,x+(b.x*cf+b.z*sf)*scale,y+(b.x*sf-b.z*cf)*scale,z+b.y*scale,b.r*scale))return;}
      const key=kind+':'+lod;if(!pools.has(key))pools.set(key,[]);if(!groups[key])groups[key]=[];const pool=pools.get(key),i=groups[key].length,instance=pool[i]||(pool[i]={});
      Object.assign(instance,{x,y,z,cf,sf,s:scale,t:tint,ph:phase,am});groups[key].push(instance);total++;
    }
    // Commanders first: the global visual budget may never hide a named leader behind a massed cohort.
    const sorted=units.filter(u=>u.alive&&!(u.hidden&&u.side!=='ming')).sort((a,b)=>Number(!!b._hero)-Number(!!a._hero));
    for(const u of sorted){
      if(total>=6200)break;const p=o.project(u.x,u.y);if(!o.frustum&&(p.x<-180||p.x>o.W+180||p.y<-180||p.y>o.H+300))continue;
      const kind=A.kindFor(u),distance=Math.hypot(u.x-o.cam.x,u.y-o.cam.y),head=o.project(u.x,u.y,84*zMul),pixels=Math.hypot(head.x-p.x,head.y-p.y),lod=o.impostors&&pixels<64?4:pixels<18?3:quality==='low'?2:zoom>.65&&distance<2200?0:zoom>.15&&distance<6500?1:2;
      const tint=u.emperor?[1.20,1.0,.58]:u.side==='ming'?[1.12,.80,.65]:[.58,.88,1.28],isMounted=['shock','heavy','horse','general'].includes(kind),scale=(isMounted?84/3.14:62/2.2)*zMul;
      const moving=u._inMelee||u.state==='rout'||(u.tx!=null&&Math.hypot(u.x-u.tx,u.y-u.ty)>12),am=u._inMelee?.9:moving?.28:0;
      if(kind==='cannon'){const n=Math.max(1,Math.min(5,Math.round(u.soldiers/300)));for(let i=0;i<n;i++){const d=(i-(n-1)/2)*50;add(kind,lod,u.x-Math.sin(u.facing)*d,u.y+Math.cos(u.facing)*d,u.facing,38*zMul,tint,now*.005,am);}continue;}
      const men=u._men||[];for(let i=0;i<men.length&&total<6200;i++){const m=men[i],role=kind==='general'&&i>0?(u.emperor?'guard':'heavy'):kind;add(role,lod,m.x,m.y,u.facing,scale*(kind==='general'&&i===0?1.12:1),tint,now*.0065+(m.ph||i)*1.3,am);}
    }
    const tint=[.65,.65,.62];for(const list of [o.corpses||[],o.dying||[]])for(const c of list){const p=o.project(c.x,c.y);if(p.x<-160||p.x>o.W+160||p.y<-160||p.y>o.H+260)continue;add('dead',2,c.x,c.y,c.ff??c.a??c.ca??0,62/2.2*zMul,tint,0,0);}
    lastInstances={count:total,groups:Object.keys(groups).filter(k=>groups[k].length).length};return groups;
  }
  function create(gl,compile,options){
    const ext=gl.getExtension('ANGLE_instanced_arrays');if(!ext||gl.getParameter(gl.MAX_VERTEX_ATTRIBS)<8)return null;
    const vertex=`attribute vec3 aPos,aNrm,aCol,aIPos,aIParm,aITint;attribute vec2 aRole;attribute vec4 aIAnim;uniform mat4 uMVP;uniform float uBake;varying vec3 vN,vCol;varying float vMat;${S.vertexDecl}
      void main(){vec3 p=aPos;float part=aRole.x,sw=aIAnim.x;vMat=aRole.y;
        if(part>.5&&part<2.5)p.z+=(part<1.5?sw:-sw)*.18*(1.0-smoothstep(.25,1.0,p.y));
        if(part>2.5&&part<4.5)p.z+=sw*.12;
        if(part>5.5&&part<7.5)p.z+=(part<6.5?sw:-sw)*.27*(1.0-smoothstep(.1,1.0,p.y));
        if(part>7.5&&part<8.5)p.x+=aIAnim.y*.035;
        if(part>8.5){vec2 yz=p.yz-vec2(.44,.15);p.yz=mat2(aIAnim.z,-aIAnim.w,aIAnim.w,aIAnim.z)*yz+vec2(.44,.15);}
        float cf=aIParm.x,sf=aIParm.y;vec3 mp=vec3(p.x,-p.z,p.y)*aIParm.z,mn=vec3(aNrm.x,-aNrm.z,aNrm.y),wp=vec3(mp.x*cf-mp.y*sf,mp.x*sf+mp.y*cf,mp.z)+aIPos;
        vN=vec3(mn.x*cf-mn.y*sf,mn.x*sf+mn.y*cf,mn.z);vCol=aCol;if(uBake<.5&&vMat>.5&&vMat<1.5)vCol=mix(aCol,vec3(.49,.37,.27)*aITint,.82);vShadow0=uShadow0*vec4(wp,1.0);vShadow1=uShadow1*vec4(wp,1.0);gl_Position=uMVP*vec4(wp,1.0);}`;
    const fragment=`precision highp float;varying vec3 vN,vCol;varying float vMat;${S.fragmentDecl}void main(){vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;vec3 L=normalize(vec3(-.5,-.6,.82));float light=max(dot(N,L),0.0),shade=landscapeShadow();vec3 color=vCol*(.42+max(N.z,0.0)*.13+light*.70*shade);if(vMat>1.5&&vMat<2.5)color+=vec3(.24,.23,.20)*pow(max(dot(N,normalize(L+vec3(0.0,.6,1.0))),0.0),22.0)*shade;gl_FragColor=vec4(color,1.0);}`;
    const sprites=options&&options.software&&root.TMBattleImpostors?root.TMBattleImpostors.create(gl,compile,A,S,vertex):null;
    const program=compile(vertex,fragment),attributes={},meshes=new Map(),buffers=new Map();for(const n of ['aPos','aNrm','aCol','aRole','aIPos','aIParm','aITint','aIAnim'])attributes[n]=gl.getAttribLocation(program,n);
    const mvpLoc=gl.getUniformLocation(program,'uMVP');let stats={generated:true,instances:0,triangles:0,drawCalls:0,lodCounts:[0,0,0,0,0],uploads:0,bufferAllocations:0};
    function mesh(key){if(meshes.has(key))return meshes.get(key);const [kind,lod]=key.split(':'),m=A.indexed(kind,+lod),buffer=gl.createBuffer(),index=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,m.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);const geo={buffer,index,count:m.count};meshes.set(key,geo);return geo;}
    function draw(groups,mvp,shadows,yaw){
      const spriteOK=sprites&&sprites.draw(groups,mvp,shadows,yaw||0);
      stats.instances=stats.triangles=stats.drawCalls=stats.uploads=0;stats.lodCounts=[0,0,0,0,0];gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.uniformMatrix4fv(mvpLoc,false,mvp);shadows.bind(program);
      for(const key in groups){const list=groups[key];if(!list.length||(key.endsWith(':4')&&spriteOK))continue;const geo=mesh(key.endsWith(':4')?key.slice(0,-1)+'2':key),n=list.length;let b=buffers.get(key);
        if(!b||b.capacity<n){if(b)gl.deleteBuffer(b.buffer);const capacity=Math.pow(2,Math.ceil(Math.log2(Math.max(n,16))));b={capacity,data:new Float32Array(capacity*13),buffer:gl.createBuffer()};buffers.set(key,b);gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.bufferData(gl.ARRAY_BUFFER,b.data.byteLength,gl.DYNAMIC_DRAW);stats.bufferAllocations++;}
        for(let i=0;i<n;i++){const o=list[i],k=i*13,d=b.data;d[k]=o.x;d[k+1]=o.y;d[k+2]=o.z;d[k+3]=o.cf;d[k+4]=o.sf;d[k+5]=o.s;d[k+6]=o.t[0];d[k+7]=o.t[1];d[k+8]=o.t[2];d[k+9]=Math.sin(o.ph)*o.am;d[k+10]=Math.sin(o.ph*.6);d[k+11]=Math.cos(o.ph*o.am);d[k+12]=Math.sin(o.ph*o.am);}
        gl.bindBuffer(gl.ARRAY_BUFFER,geo.buffer);for(const [name,size,offset] of [['aPos',3,0],['aNrm',3,12],['aCol',3,24],['aRole',2,36]]){const a=attributes[name];if(a<0)continue;ext.vertexAttribDivisorANGLE(a,0);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,44,offset);}
        gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data.subarray(0,n*13));for(const [name,size,offset] of [['aIPos',3,0],['aIParm',3,12],['aITint',3,24],['aIAnim',4,36]]){const a=attributes[name];if(a<0)continue;gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,52,offset);ext.vertexAttribDivisorANGLE(a,1);}
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,geo.index);const calls=1;ext.drawElementsInstancedANGLE(gl.TRIANGLES,geo.count,gl.UNSIGNED_SHORT,0,n);for(const name of ['aIPos','aIParm','aITint','aIAnim']){const a=attributes[name];if(a<0)continue;ext.vertexAttribDivisorANGLE(a,0);gl.disableVertexAttribArray(a);}
        stats.instances+=n;stats.triangles+=geo.count/3*n*calls;stats.drawCalls+=calls;stats.lodCounts[key.endsWith(':4')?2:+key.split(':')[1]]+=n;stats.uploads+=n*52;
      }
      if(spriteOK){const s=sprites.stats;stats.instances+=s.instances;stats.triangles+=s.triangles;stats.drawCalls+=s.drawCalls;stats.lodCounts[4]=s.instances;stats.uploads+=s.uploads;}
    }
    function destroy(){if(sprites)sprites.destroy();for(const m of meshes.values()){gl.deleteBuffer(m.buffer);gl.deleteBuffer(m.index);}for(const b of buffers.values())gl.deleteBuffer(b.buffer);gl.deleteProgram(program);meshes.clear();buffers.clear();}
    return{draw,destroy,get impostorsAvailable(){return!!sprites&&sprites.available;},get stats(){return{...stats,bufferAllocations:stats.bufferAllocations+(sprites?sprites.stats.bufferAllocations:0),impostors:sprites&&sprites.stats,lodCounts:stats.lodCounts.slice(),geometryBuffers:meshes.size,instanceBuffers:buffers.size};}};
  }
  root.TMBattleUnitRenderer={create,instances,get lastInstances(){return lastInstances;}};
})(window);
