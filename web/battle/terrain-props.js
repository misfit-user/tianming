/* Instanced authored procedural assets: close leaf clusters / tile roofs, medium and distant geometry. */
(function(root){'use strict';
  const A=root.TMBattleAssets,S=root.TMBattleShadows;
  const alpha=`float hashLeaf(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*4375.585);}
    void leafMask(){if(vMaterial>2.9&&vMaterial<3.2){vec2 v=vUV*2.0-1.0;if(dot(v,v)>1.15)discard;vec2 tile=floor(vUV*7.0),q=fract(vUV*7.0)-.5;float h=hashLeaf(tile);if(h<.12)discard;float a=h*6.28;q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;if(dot(q*vec2(1.0,1.9),q*vec2(1.0,1.9))>.20)discard;}}`;
  const attributes=`attribute vec3 aPos,aNrm,aCol,aIPos;attribute vec2 aUV;attribute float aMaterial;attribute vec4 aIParams;uniform mat4 uMVP;uniform vec2 uCam;varying vec2 vUV;varying vec3 vN,vCol,vWorld;varying float vMaterial,vD;`;
  const transform=`float c=aIParams.x,s=aIParams.y,scale=aIParams.z;vec3 p=vec3(aPos.x*c-aPos.y*s,aPos.x*s+aPos.y*c,aPos.z)*scale+aIPos;vN=vec3(aNrm.x*c-aNrm.y*s,aNrm.x*s+aNrm.y*c,aNrm.z);vCol=aCol*(.93+aIParams.w*.14);vUV=aUV;vMaterial=aMaterial;vWorld=p*.02;vD=distance(p.xy,uCam);gl_Position=uMVP*vec4(p,1.0);`;
  function create(gl,compile){
    const ext=gl.getExtension('ANGLE_instanced_arrays');if(!ext||gl.getParameter(gl.MAX_VERTEX_ATTRIBS)<7)return null;
    const vertex=attributes+S.vertexDecl+'void main(){'+transform+'vShadow0=uShadow0*vec4(p,1.0);vShadow1=uShadow1*vec4(p,1.0);}';
    const fragment=`precision highp float;varying vec2 vUV;varying vec3 vN,vCol,vWorld;varying float vMaterial,vD;uniform vec3 uSky;uniform float uFn,uFf,uDry;${S.fragmentDecl}${alpha}
      void main(){leafMask();vec3 N=normalize(vN);bool leaf=vMaterial>2.9&&vMaterial<4.0;if(leaf&&!gl_FrontFacing)N=-N;vec3 L=normalize(vec3(-.5,-.6,.82));float n=hashLeaf(floor(vWorld.xy*6.0+vWorld.z)),fine=hashLeaf(floor(vWorld.xy*28.0));vec3 base=vCol;
      if(vMaterial<.5){float grain=sin(vUV.x*93.0+sin(vUV.y*11.0)*.7);base*=.84+.11*grain+.12*n;}
      else if(vMaterial<1.5){float plaster=.91+.13*n+.06*fine;base*=plaster;}
      else if(vMaterial<2.5){float tile=step(.075,fract(vUV.x*18.0))*step(.08,fract(vUV.y*8.0));base*=.79+.24*tile;}
      else if(leaf){base=mix(base,vec3(.42,.41,.19),uDry*.35);base*=.84+.27*n;}
      else if(vMaterial<4.5)base*=.85+.24*n;
      float ndl=max(dot(N,L),0.0),shadow=landscapeShadow();vec3 ambient=vec3(.38,.43,.38)+max(N.z,0.0)*vec3(.16,.17,.20);vec3 color=base*(ambient+vec3(1.00,.94,.80)*ndl*shadow*.62);
      if(leaf)color+=base*max(dot(-N,L),0.0)*.11;
      float rough=vMaterial<.5?.82:vMaterial<1.5?.93:vMaterial<2.5?.68:leaf?.95:.84;vec3 V=normalize(vec3(0.0,.6,1.0)),H=normalize(V+L);float shine=pow(max(dot(N,H),0.0),mix(64.0,5.0,rough))*(1.0-rough)*.10;color+=vec3(shine*shadow);
      color=mix(color,uSky,smoothstep(uFn,uFf,vD)*.70);gl_FragColor=vec4(color,1.0);}`;
    const program=compile(vertex,fragment),shadowProgram=compile(attributes+'void main(){'+transform+'}',`precision highp float;varying vec2 vUV;varying float vMaterial;${alpha}void main(){leafMask();gl_FragColor=vec4(1.0);}`);
    const meshes=new Map(),locations=new Map(),uploads=new Map();let drawn=0,triangles=0,lodCounts=[0,0,0],key='',previous=[],poseWorld=null,poses=[],visibleKey='',visibleGroups=null,uploadBytes=0,allocations=0;
    function loc(p){if(locations.has(p))return locations.get(p);const a={},u={};for(const n of ['aPos','aNrm','aCol','aUV','aMaterial','aIPos','aIParams'])a[n]=gl.getAttribLocation(p,n);for(const n of ['uMVP','uCam','uSky','uFn','uFf','uDry'])u[n]=gl.getUniformLocation(p,n);const o={a,u};locations.set(p,o);return o;}
    function mesh(kind,lod,variant){const key=kind+':'+lod+':'+variant;if(meshes.has(key))return meshes.get(key);const asset=A.generate(kind,lod,variant),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,asset.vertices,gl.STATIC_DRAW);const result={buffer,count:asset.count};meshes.set(key,result);return result;}
    function draw(p,geo,items,batchKey){const l=loc(p),attrs=[['aPos',3,0],['aNrm',3,12],['aCol',3,24],['aUV',2,36],['aMaterial',1,44]];gl.bindBuffer(gl.ARRAY_BUFFER,geo.buffer);
      for(const [n,size,offset] of attrs){const a=l.a[n];if(a>=0){ext.vertexAttribDivisorANGLE(a,0);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,48,offset);}}
      let b=uploads.get(batchKey);if(!b||b.capacity<items.length){if(b)gl.deleteBuffer(b.buffer);const capacity=2**Math.ceil(Math.log2(Math.max(16,items.length)));b={buffer:gl.createBuffer(),capacity,data:new Float32Array(capacity*7),items:null};uploads.set(batchKey,b);gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.bufferData(gl.ARRAY_BUFFER,b.data.byteLength,gl.DYNAMIC_DRAW);allocations++;}else gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
      if(b.items!==items){for(let i=0;i<items.length;i++){const o=items[i],k=i*7,d=b.data;d[k]=o.x;d[k+1]=o.y;d[k+2]=o.z;d[k+3]=o._c;d[k+4]=o._s;d[k+5]=o.size;d[k+6]=o.variant||0;}gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data.subarray(0,items.length*7));b.items=items;uploadBytes+=items.length*28;}
      for(const [n,size,offset] of [['aIPos',3,0],['aIParams',4,12]]){const a=l.a[n];if(a>=0){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,28,offset);ext.vertexAttribDivisorANGLE(a,1);}}
      ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,geo.count,items.length);
      for(const n of ['aIPos','aIParams'])if(l.a[n]>=0){ext.vertexAttribDivisorANGLE(l.a[n],0);gl.disableVertexAttribArray(l.a[n]);}
    }
    function batches(world,ex,cam,range,quality,shadow,project){
      if(poseWorld!==world){poseWorld=world;poses=world.props.map(p=>({...p,z:world.heightAt(p.x,p.y)*ex,_c:Math.cos(p.rotation||0),_s:Math.sin(p.rotation||0)}));visibleKey='';}
      if(key!==world.key){key=world.key;previous=new Uint8Array(world.props.length);previous.fill(2);}const groups=new Map();
      for(let i=0;i<world.props.length;i++){const p=world.props[i],d=Math.hypot(p.x-cam.x,p.y-cam.y);if(d>range)continue;if(project){const s=project(p.x,p.y);if(s.x<-180||s.y<-260||s.x>innerWidth+180||s.y>innerHeight+260)continue;}
        let lod=quality==='low'?2:d<(quality==='high'?4200:2700)?0:d<9000?1:2;if(shadow)lod=shadow.far?2:Math.max(quality==='high'?0:1,lod);else{const last=previous[i],edge=last===0?(quality==='high'?4200:2700):9000;if(last!==lod&&Math.abs(d-edge)<160)lod=last;previous[i]=lod;}
        const kind=A.kindFor(p,world),variant=Math.min(2,Math.floor((p.variant||0)*3)),id=kind+':'+lod+':'+variant;if(!groups.has(id))groups.set(id,{kind,lod,variant,items:[]});groups.get(id).items.push(poses[i]);
      }return groups;
    }
    function render(world,ex,mvp,cam,dist,shadows,quality,project){
      drawn=0;triangles=0;lodCounts=[0,0,0];const l=loc(program);gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniformMatrix4fv(l.u.uMVP,false,mvp);gl.uniform2f(l.u.uCam,cam.x,cam.y);gl.uniform3fv(l.u.uSky,[.67,.73,.72]);gl.uniform1f(l.u.uFn,dist*1.1);gl.uniform1f(l.u.uFf,dist*2.7);gl.uniform1f(l.u.uDry,world.biome==='desert'?1:0);shadows.bind(program);
      uploadBytes=0;const viewKey=[world.key,ex,quality,dist,cam.x,cam.y,...mvp].join(':');if(viewKey!==visibleKey||poseWorld!==world){visibleGroups=batches(world,ex,cam,dist*2.5+4500,quality,null,project);visibleKey=viewKey;}
      for(const [id,g] of visibleGroups){const geo=mesh(g.kind,g.lod,g.variant);draw(program,geo,g.items,'view:'+id);drawn+=g.items.length;triangles+=geo.count/3*g.items.length;lodCounts[g.lod]+=g.items.length;}
    }
    function shadow(world,ex,matrix,area,quality){const l=loc(shadowProgram);gl.useProgram(shadowProgram);gl.uniformMatrix4fv(l.u.uMVP,false,matrix);gl.uniform2f(l.u.uCam,area.x,area.y);for(const [id,g] of batches(world,ex,area,area.radius*1.7+1500,quality,area,null))draw(shadowProgram,mesh(g.kind,g.lod,g.variant),g.items,'shadow:'+id);}
    function destroy(){for(const m of meshes.values())gl.deleteBuffer(m.buffer);meshes.clear();for(const b of uploads.values())gl.deleteBuffer(b.buffer);uploads.clear();gl.deleteProgram(program);gl.deleteProgram(shadowProgram);locations.clear();}
    return{render,shadow,destroy,get stats(){return{instancing:true,drawn,triangles,lodCounts:lodCounts.slice(),geometryBuffers:meshes.size,uploadBytes,bufferAllocations:allocations};}};
  }
  root.TMBattleProps={create};
})(window);
