/* Procedural surface atlas and original low-poly terrain props. No remote assets or API calls. */
(function(root){'use strict';
  const T=root.TMBattleTerrain,S=root.TMBattleShadows;
  const palettes={plain:{grass:[107,119,68],dry:[157,144,92],wood:[.30,.36,.15]},verdant:{grass:[89,121,64],dry:[148,139,86],wood:[.20,.35,.13]},wetland:{grass:[85,116,72],dry:[126,132,87],wood:[.19,.34,.17]},desert:{grass:[179,158,111],dry:[197,170,117],wood:[.38,.37,.19]},snow:{grass:[196,205,195],dry:[167,173,157],wood:[.25,.34,.28]}};
  function palette(w){return palettes[w.snow?'snow':w.biome]||palettes.plain;}
  function bake(w){
    if(w.atlas)return w.atlas;const P=palette(w),c=document.createElement('canvas');c.width=2048;c.height=Math.round(2048*w.h/w.w);const ctx=c.getContext('2d');
    const small=document.createElement('canvas');small.width=768;small.height=Math.round(768*w.h/w.w);const sc=small.getContext('2d'),data=sc.createImageData(small.width,small.height);
    for(let y=0;y<small.height;y++)for(let x=0;x<small.width;x++){
      const wx=x/small.width*w.w,wy=y/small.height*w.h,z=w.heightAt(wx,wy),n=T.noise(wx/1750,wy/1750,w.seed),n2=T.noise(wx/280,wy/280,w.seed+16),forest=w.forestAt(wx,wy),wet=w.riverInfo(wx,wy).distance<w.riverW/2+180||w.seaDepth(wx,wy)>-180;
      const dry=Math.min(.8,Math.max(0,(n-.35)*.9)+(z>170?.32:0)),shade=forest?.68:wet?.78:1;
      const k=(y*small.width+x)*4;
      for(let j=0;j<3;j++)data.data[k+j]=(P.grass[j]*(1-dry)+P.dry[j]*dry)*(shade+(n2-.5)*.15);
      data.data[k+3]=255;
    }
    sc.putImageData(data,0,0);ctx.drawImage(small,0,0,c.width,c.height);ctx.save();ctx.scale(c.width/w.w,c.height/w.h);
    const Q=T.rng(w.seed^0x3e53c7c9),colors=w.snow?['#bfc2b1','#d7d4bf','#c5ccb8','#aeb9a1']:['#98945d','#b2a16b','#778449','#778d55'];
    for(const f of w.fields){ctx.fillStyle=colors[f.style];ctx.fillRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);ctx.strokeStyle=w.snow?'#d6d8cd':'#c0b084';ctx.lineWidth=18;ctx.strokeRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);ctx.lineWidth=7;ctx.strokeStyle='rgba(52,53,28,.18)';ctx.beginPath();for(let i=1;i<f.rows;i++){const y=f.y-f.h/2+f.h*i/f.rows;ctx.moveTo(f.x-f.w/2+15,y);ctx.lineTo(f.x+f.w/2-15,y);}ctx.stroke();}
    function path(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));}
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const rd of w.roads){path(rd.pts);ctx.strokeStyle='rgba(62,55,32,.16)';ctx.lineWidth=rd.width+75;ctx.stroke();ctx.strokeStyle=w.snow?'#c5c3ac':'#b5a076';ctx.lineWidth=rd.width;ctx.stroke();ctx.strokeStyle='rgba(71,60,33,.18)';ctx.lineWidth=rd.width*.18;ctx.stroke();}
    // Fine surface breakup remains in world scale; separate tiled GPU detail supplies close views.
    for(let i=0;i<18000;i++){const x=Q()*w.w,y=Q()*w.h;ctx.fillStyle=i%2?'rgba(239,225,162,.11)':'rgba(38,55,24,.10)';ctx.fillRect(x,y,10+Q()*32,8+Q()*18);}
    // Footprint shadows are terrain-draped, while actual props are independent depth-tested meshes.
    for(const p of w.props){ctx.fillStyle=p.kind==='tree'?'rgba(23,33,19,.10)':'rgba(35,29,22,.14)';ctx.beginPath();ctx.ellipse(p.x+p.size*.1,p.y+p.size*.1,p.size*.62,p.size*.40,.7,0,Math.PI*2);ctx.fill();}
    ctx.restore();w.atlas=c;return c;
  }
  function drawMap(ctx,w){ctx.drawImage(bake(w),0,0,w.w,w.h);ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    if(w.river.length){ctx.beginPath();w.river.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#687f78';ctx.lineWidth=w.riverW+90;ctx.stroke();ctx.strokeStyle='#476e73';ctx.lineWidth=w.riverW;ctx.stroke();}
    for(const b of w.crossings){ctx.strokeStyle=b.kind==='bridge'?'#b29c74':'#78908a';ctx.lineWidth=b.width;ctx.beginPath();ctx.moveTo(b.x+b.ty*b.length/2,b.y-b.tx*b.length/2);ctx.lineTo(b.x-b.ty*b.length/2,b.y+b.tx*b.length/2);ctx.stroke();}
    for(const p of w.props){if(p.kind==='tree'){ctx.fillStyle=w.snow?'#a3b5a7':'#334a27';ctx.beginPath();ctx.arc(p.x,p.y,p.size*.68,0,Math.PI*2);ctx.fill();}else if(p.kind==='house'){ctx.fillStyle='#71654e';ctx.fillRect(p.x-p.size,p.y-p.size*.6,p.size*2,p.size*1.2);}}
    ctx.restore();
  }
  const vertex=`attribute vec3 aPos;attribute vec3 aNrm;attribute vec2 aUV;uniform mat4 uMVP;uniform vec2 uCam;varying vec2 vUV;varying vec3 vN;varying float vD;${S.vertexDecl}void main(){vUV=aUV;vN=aNrm;vD=distance(aPos.xy,uCam);gl_Position=uMVP*vec4(aPos,1.0);vShadow0=uShadow0*vec4(aPos,1.0);vShadow1=uShadow1*vec4(aPos,1.0);}`;
  const fragment=`precision highp float;varying vec2 vUV;varying vec3 vN;varying float vD;uniform sampler2D uTex;uniform sampler2D uDetail;uniform float uModern;uniform vec3 uSun;uniform vec3 uSky;uniform float uFn;uniform float uFf;${S.fragmentDecl}void main(){vec3 a=texture2D(uTex,vUV).rgb;vec3 detail=texture2D(uDetail,vUV*85.0).rgb;float gx=texture2D(uDetail,vUV*85.0+vec2(.009,0.0)).r-detail.r,gy=texture2D(uDetail,vUV*85.0+vec2(0.0,.009)).r-detail.r;vec3 normal=normalize(vN+vec3(gx,gy,0.0)*.13*uModern);float d=max(dot(normal,normalize(uSun)),0.0);vec3 c=a*(0.49+0.68*d*landscapeShadow());c*=mix(1.0,0.86+detail.r*.29,uModern);float f=smoothstep(uFn,uFf,vD);c=mix(c,uSky,f*.72);gl_FragColor=vec4(c,1.0);}`;
  function detailTexture(gl){const side=128,bytes=new Uint8Array(side*side*4);const q=T.rng(53917);for(let i=0;i<side*side;i++){const n=55+q()*150;bytes[i*4]=n;bytes[i*4+1]=n;bytes[i*4+2]=n;bytes[i*4+3]=255;}const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,side,side,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.generateMipmap(gl.TEXTURE_2D);return tex;}
  function makeRenderer(gl,prog){
    const p=prog(`attribute vec3 aPos;attribute vec3 aNrm;attribute vec3 aCol;uniform mat4 uMVP;uniform vec2 uCam;varying vec3 vN,vC;varying vec2 vWorld;varying float vD;${S.vertexDecl}void main(){vN=aNrm;vC=aCol;vWorld=aPos.xy*.004;vD=distance(aPos.xy,uCam);gl_Position=uMVP*vec4(aPos,1.0);vShadow0=uShadow0*vec4(aPos,1.0);vShadow1=uShadow1*vec4(aPos,1.0);}`,
      `precision highp float;varying vec3 vN,vC;varying vec2 vWorld;varying float vD;uniform vec3 uSky;uniform float uFn,uFf,uTime,uWater;${S.fragmentDecl}void main(){float d=max(dot(normalize(vN),normalize(vec3(-.5,-.6,.82))),0.0);float ripple=(sin(vWorld.x*3.0+vWorld.y*.7+uTime*.8)*cos(vWorld.y*4.0-uTime*.5))*.025*uWater;vec3 c=vC*(.46+.7*d*landscapeShadow())+ripple;gl_FragColor=vec4(mix(c,uSky,smoothstep(uFn,uFf,vD)*.72),1.0);}`);
    const locations={};for(const n of ['uMVP','uCam','uSky','uFn','uFf','uTime','uWater'])locations[n]=gl.getUniformLocation(p,n);
    const attrs=['aPos','aNrm','aCol'].map(n=>gl.getAttribLocation(p,n));let chunks=[],water=null,key='';
    function dispose(){for(const c of chunks)gl.deleteBuffer(c.buffer);chunks=[];if(water)gl.deleteBuffer(water.buffer);water=null;key='';}
    function upload(data,center){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return{buffer,n:data.length/9,center};}
    function build(w,ex,detailed){const nextKey=w.key+':'+!!detailed;if(key===nextKey)return;dispose();key=nextKey;const batches=new Map(),P=palette(w);let current=[];
      function triangle(a,b,c,col){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;for(const v of [a,b,c])current.push(...v,nx,ny,nz,...col);}
      function box(x,y,z,sx,sy,sz,col,rot){const c=Math.cos(rot||0),s=Math.sin(rot||0),v=[];for(const zz of [0,sz])for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])v.push([x+a*sx*c-b*sy*s,y+a*sx*s+b*sy*c,z+zz]);for(const [a,b,c,d] of [[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){triangle(v[a],v[b],v[c],col);triangle(v[a],v[c],v[d],col);}}
      function crown(x,y,z,r,h,col,phase){const n=7,v=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2+phase;v.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}for(let i=0;i<n;i++){const j=(i+1)%n;triangle(v[i],v[j],[x-r*.12,y,z+h],col);triangle(v[j],v[i],[x,y,z-h*.32],col);}}
      function batch(x,y){const ix=Math.floor(x/3500),iy=Math.floor(y/3500),k=ix+':'+iy;if(!batches.has(k))batches.set(k,{data:[],center:{x:(ix+.5)*3500,y:(iy+.5)*3500}});current=batches.get(k).data;}
      for(const o of (detailed?[]:w.props)){batch(o.x,o.y);const z=w.heightAt(o.x,o.y)*ex,s=o.size,c=P.wood.map(v=>v*(.86+o.variant*.32));
        if(o.kind==='tree'){box(o.x,o.y,z,s*.085,s*.085,s*.8,[.28,.23,.16],o.rotation);if(w.snow){crown(o.x,o.y,z+s*.95,s*.68,s*.9,c,o.rotation);crown(o.x,o.y,z+s*1.22,s*.55,s*.62,[.75,.80,.72],o.rotation);}else{crown(o.x,o.y,z+s*.85,s*.82,s*.7,c,o.rotation);crown(o.x-s*.35,o.y+s*.16,z+s*.92,s*.53,s*.53,c.map(v=>v*1.08),o.rotation+1);}}
        else if(o.kind==='rock')crown(o.x,o.y,z+s*.17,s,s*.72,[.41+o.variant*.10,.42+o.variant*.09,.35+o.variant*.06],o.rotation);
        else if(o.kind==='palisade'){for(let i=-2;i<=2;i++)box(o.x+i*s*.42,o.y,z,s*.19,s*.19,s*2.1,[.39,.32,.22],0);}
        else if(o.kind==='house'){box(o.x,o.y,z,s,s*.66,s*.95,[.69,.62,.45],o.rotation);const roof=[.26,.29,.27],c=Math.cos(o.rotation),sn=Math.sin(o.rotation),at=(x,y,zz)=>[o.x+x*c-y*sn,o.y+x*sn+y*c,z+zz];
          const a=at(-s*1.2,-s*.85,s*.91),b=at(s*1.2,-s*.85,s*.91),cc=at(s*1.2,s*.85,s*.91),d=at(-s*1.2,s*.85,s*.91),e=at(-s*1.22,0,s*1.5),f=at(s*1.22,0,s*1.5);triangle(a,b,f,roof);triangle(a,f,e,roof);triangle(e,f,cc,roof.map(v=>v*.8));triangle(e,cc,d,roof.map(v=>v*.8));triangle(a,e,d,[.48,.41,.28]);triangle(b,cc,f,[.48,.41,.28]);
          box(o.x,o.y-s*.674,z+s*.05,s*.16,4,s*.48,[.19,.17,.12],o.rotation);
          for(const xx of [-.62,.62]){const at=xx*s,wx=o.x+at*Math.cos(o.rotation)+s*.675*Math.sin(o.rotation),wy=o.y+at*Math.sin(o.rotation)-s*.675*Math.cos(o.rotation);box(wx,wy,z+s*.45,s*.13,4,s*.20,[.23,.22,.17],o.rotation);}
          for(let k=-5;k<=5;k++){const xx=k*s*.2,wx=o.x+xx*Math.cos(o.rotation),wy=o.y+xx*Math.sin(o.rotation);box(wx,wy,z+s*1.49,s*.02,s*.035,s*.035,[.35,.36,.31],o.rotation);}
        }
      }
      for(const b of w.crossings)if(b.kind==='bridge'){batch(b.x,b.y);const steps=20,ang=Math.atan2(b.tx,-b.ty);for(let i=0;i<=steps;i++){const t=(i/steps-.5)*b.length,x=b.x-b.ty*t,y=b.y+b.tx*t,z=w.heightAt(x,y)*ex+6;box(x,y,z,b.width*.49,b.length/steps*.48,12,[.51,.43,.29],ang-Math.PI/2);if(i%3===0)for(const s of [-1,1])box(x+b.tx*b.width*.47*s,y+b.ty*b.width*.47*s,z,12,12,72,[.37,.31,.21],0);}}
      for(const b of batches.values())chunks.push(upload(b.data,b.center));
      current=[];
      function riverVertex(i,f){const p=w.river[i],a=w.river[Math.max(0,i-1)],b=w.river[Math.min(w.river.length-1,i+1)],l=Math.hypot(b.x-a.x,b.y-a.y);return[p.x-(b.y-a.y)/l*w.riverW*.5*f,p.y+(b.x-a.x)/l*w.riverW*.5*f,w.waterLevel*ex+2];}
      for(let i=0;i<w.river.length-1;i++){const near=[.25,.41,.44],far=[.31,.47,.47];for(const [f1,f2,col] of [[-1,-.6,far],[-.6,.6,near],[.6,1,far]]){const p1=riverVertex(i,f1),p2=riverVertex(i+1,f1),p3=riverVertex(i+1,f2),p4=riverVertex(i,f2);triangle(p1,p2,p3,col);triangle(p1,p3,p4,col);}}
      for(const side of ['leftX','rightX'])if(w.coast[side]!=null){const left=side==='leftX';for(let i=0;i<128;i++){const y=i*w.h/128,y2=(i+1)*w.h/128,outer=left?0:w.w,z=w.waterLevel*ex,p1=[w.coastX(side,y),y,z],p2=[w.coastX(side,y2),y2,z],p3=[outer,y2,z],p4=[outer,y,z];triangle(p1,p2,p3,[.28,.43,.48]);triangle(p1,p3,p4,[.28,.43,.48]);}}
      if(current.length)water=upload(current,{x:w.w/2,y:w.h/2});
    }
    function drawMesh(m){gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);attrs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});gl.drawArrays(gl.TRIANGLES,0,m.n);}
    function render(w,ex,mvp,cam,dist,time,detailed,shadows,pass){if(!w)return;build(w,ex,detailed);gl.useProgram(p);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniformMatrix4fv(locations.uMVP,false,mvp);gl.uniform2f(locations.uCam,cam.x,cam.y);gl.uniform3fv(locations.uSky,[.67,.73,.72]);gl.uniform1f(locations.uFn,dist*1.1);gl.uniform1f(locations.uFf,dist*2.7);gl.uniform1f(locations.uTime,time);gl.uniform1f(locations.uWater,0);if(shadows)shadows.bind(p);if(pass!=='water')for(const c of chunks)if(Math.hypot(c.center.x-cam.x,c.center.y-cam.y)<dist*2.5+5000)drawMesh(c);if(water&&pass!=='static'){gl.uniform1f(locations.uWater,1);drawMesh(water);}}
    function shadow(matrix,program){gl.useProgram(program);gl.uniformMatrix4fv(gl.getUniformLocation(program,'uMVP'),false,matrix);const a=gl.getAttribLocation(program,'aPos');for(const c of chunks){gl.bindBuffer(gl.ARRAY_BUFFER,c.buffer);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,0);gl.drawArrays(gl.TRIANGLES,0,c.n);}}
    return{render,dispose,prepare:build,shadow,get stats(){return{chunks:chunks.length,vertices:chunks.reduce((n,c)=>n+c.n,0)+(water?water.n:0)};}};
  }
  root.TMBattleLandscape={bake,drawMap,vertex,fragment,detailTexture,makeRenderer};
})(window);
