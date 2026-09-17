/* Full-resolution color + depth cache for static terrain. Dynamic troops/effects retain real occlusion.
 * Requires WEBGL_depth_texture and EXT_frag_depth. Missing capability/FBO failure uses the original renderer. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleFrameCache=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function create(gl,compile){
    if(!gl.getExtension('WEBGL_depth_texture')||!gl.getExtension('EXT_frag_depth')||!gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision)return null;
    const program=compile('attribute vec2 aPos;varying vec2 vUV;void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0.0,1.0);}',
      '#extension GL_EXT_frag_depth : require\nprecision highp float;varying vec2 vUV;uniform sampler2D uColor,uDepth;void main(){gl_FragColor=texture2D(uColor,vUV);gl_FragDepthEXT=texture2D(uDepth,vUV).r;}');
    const position=gl.getAttribLocation(program,'aPos'),colorLoc=gl.getUniformLocation(program,'uColor'),depthLoc=gl.getUniformLocation(program,'uDepth'),quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    let fbo=null,color=null,depth=null,width=0,height=0,key='',failed=false,rebuilds=0,hits=0;
    function clear(){if(fbo)gl.deleteFramebuffer(fbo);if(color)gl.deleteTexture(color);if(depth)gl.deleteTexture(depth);fbo=color=depth=null;width=height=0;key='';}
    function texture(format,type,w,h){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,format,w,h,0,format,type,null);return t;}
    function begin(next,w,h){
      if(failed)return false;
      if(w!==width||h!==height){clear();gl.activeTexture(gl.TEXTURE0);fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);color=texture(gl.RGBA,gl.UNSIGNED_BYTE,w,h);depth=texture(gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,w,h);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){clear();failed=true;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return false;}width=w;height=h;
      }
      if(key===next){hits++;return false;}key=next;rebuilds++;gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);return true;
    }
    function end(){gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
    function draw(){if(!fbo||failed)return false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(program);gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.ALWAYS);gl.depthMask(true);
      gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,color);gl.uniform1i(colorLoc,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,depth);gl.uniform1i(depthLoc,1);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthFunc(gl.LEQUAL);gl.activeTexture(gl.TEXTURE0);return true;
    }
    function invalidate(){key='';}
    function destroy(){clear();gl.deleteBuffer(quad);gl.deleteProgram(program);}
    return{begin,end,draw,destroy,invalidate,get ready(){return!!fbo&&!failed;},get stats(){return{rebuilds,hits,width,height,bytes:width*height*8,failed};}};
  }
  return{create};
});
