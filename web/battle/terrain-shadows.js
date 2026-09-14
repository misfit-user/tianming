/* Two bounded static landscape shadow cascades. Optional WEBGL_depth_texture, with explicit fallback. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleShadows=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  function matrix(center,radius){
    const sun=[-.5,-.6,.82],len=Math.hypot(...sun),z=sun.map(v=>v/len),x=[-z[1],z[0],0],xl=Math.hypot(...x);for(let i=0;i<3;i++)x[i]/=xl;const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]],eye=center.map((v,i)=>v+z[i]*30000),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
    const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]),ortho=new Float32Array([1/radius,0,0,0,0,1/radius,0,0,0,0,-2/65000,0,0,0,-1,1]);return multiply(ortho,view);
  }
  const vertexDecl='uniform mat4 uShadow0,uShadow1;varying vec4 vShadow0,vShadow1;';
  const fragmentDecl=`uniform sampler2D uShadowTex0,uShadowTex1;uniform vec4 uShadowOptions;varying vec4 vShadow0,vShadow1;
    float shadowSample(sampler2D tex,vec3 p,float pixel){if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0||p.z<0.0||p.z>1.0)return 1.0;float s=0.0;for(int i=0;i<2;i++)for(int j=0;j<2;j++){float depth=texture2D(tex,p.xy+(vec2(float(i),float(j))-.5)*pixel*1.5).r;s+=step(p.z-uShadowOptions.z,depth);}return .36+.64*s*.25;}
    float landscapeShadow(){if(uShadowOptions.w<.5)return 1.0;vec3 p0=vShadow0.xyz/vShadow0.w*.5+.5,p1=vShadow1.xyz/vShadow1.w*.5+.5;float farS=shadowSample(uShadowTex1,p1,uShadowOptions.y);float edge=min(min(p0.x,p0.y),min(1.0-p0.x,1.0-p0.y));return mix(farS,shadowSample(uShadowTex0,p0,uShadowOptions.x),clamp(edge*16.0,0.0,1.0));}`;
  function create(gl,compile){
    const supported=!!gl.getExtension('WEBGL_depth_texture')&&!!gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE),locations=new Map(),maps=[];let quality='balanced',reason=supported?'':'depth-texture-or-precision-unavailable',lastKey='',center=null,draws=0;
    const depthProgram=compile('attribute vec3 aPos;uniform mat4 uMVP;void main(){gl_Position=uMVP*vec4(aPos,1.0);}','precision mediump float;void main(){gl_FragColor=vec4(1.0);}');
    const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    function release(){for(const m of maps){gl.deleteTexture(m.depth);gl.deleteTexture(m.color);gl.deleteFramebuffer(m.fbo);}maps.length=0;lastKey='';center=null;}
    function setQuality(value){const q=['low','balanced','high'].includes(value)?value:'balanced';if(q!==quality){quality=q;release();reason=supported?'':'depth-texture-unavailable';}}
    function allocate(size){const fbo=gl.createFramebuffer(),depth=gl.createTexture(),color=gl.createTexture();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
      for(const [tex,isDepth] of [[depth,true],[color,false]]){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,isDepth?gl.DEPTH_COMPONENT:gl.RGBA,size,size,0,isDepth?gl.DEPTH_COMPONENT:gl.RGBA,isDepth?gl.UNSIGNED_SHORT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.framebufferTexture2D(gl.FRAMEBUFFER,isDepth?gl.DEPTH_ATTACHMENT:gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);}
      const complete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(!complete){gl.deleteTexture(depth);gl.deleteTexture(color);gl.deleteFramebuffer(fbo);throw Error('shadow-framebuffer-incomplete');}return{fbo,depth,color,size,matrix:identity()};
    }
    function update(world,cam,draw){
      if(!world||quality==='low'||!supported||reason)return;
      try{
        if(!maps.length){maps.push(allocate(Math.min(limit,quality==='high'?2048:1024)));maps.push(allocate(Math.min(limit,quality==='high'?1024:512)));}
        const nearRadius=quality==='high'?4800:6000,snap=nearRadius*2/maps[0].size*8,c=[Math.round(cam.x/snap)*snap,Math.round(cam.y/snap)*snap,world.heightAt(cam.x,cam.y)*1.7],changed=lastKey!==world.key;
        for(let i=1;i>=0;i--){if(!changed&&(i===1||(center&&Math.abs(center[0]-c[0])<snap&&Math.abs(center[1]-c[1])<snap)))continue;const m=maps[i],radius=i?Math.max(world.w,world.h)*.77:nearRadius,at=i?[world.w/2,world.h/2,0]:c;m.matrix=matrix(at,radius);
          gl.bindFramebuffer(gl.FRAMEBUFFER,m.fbo);gl.viewport(0,0,m.size,m.size);gl.colorMask(true,true,true,true);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.clearColor(1,1,1,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,3);draw(m.matrix,depthProgram,{x:at[0],y:at[1],radius,far:!!i});gl.disable(gl.POLYGON_OFFSET_FILL);draws++;
        }
        center=c;lastKey=world.key;
      }catch(e){reason=String(e.message||e);release();}finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.colorMask(true,true,true,true);gl.disable(gl.POLYGON_OFFSET_FILL);}
    }
    function bind(program,enabled){
      let l=locations.get(program);if(!l){l={};for(const n of ['uShadow0','uShadow1','uShadowTex0','uShadowTex1','uShadowOptions'])l[n]=gl.getUniformLocation(program,n);locations.set(program,l);}
      const on=enabled!==false&&maps.length===2&&quality!=='low'&&!reason;
      for(let i=0;i<2;i++){gl.uniformMatrix4fv(l['uShadow'+i],false,on?maps[i].matrix:identity());gl.activeTexture(gl.TEXTURE2+i);gl.bindTexture(gl.TEXTURE_2D,on?maps[i].depth:white);gl.uniform1i(l['uShadowTex'+i],2+i);}gl.uniform4f(l.uShadowOptions,on?1/maps[0].size:1,on?1/maps[1].size:1,.00007,on?1:0);gl.activeTexture(gl.TEXTURE0);
    }
    function destroy(){release();gl.deleteTexture(white);gl.deleteProgram(depthProgram);locations.clear();}
    return{setQuality,update,bind,release,destroy,get stats(){return{supported,quality,enabled:maps.length===2&&!reason,reason,cascades:maps.length,draws,sizes:maps.map(m=>m.size)};}};
  }
  return{create,matrix,vertexDecl,fragmentDecl};
});
