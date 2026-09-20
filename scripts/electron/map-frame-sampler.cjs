'use strict';
// Runs in the isolated renderer: measure rendered-frame scheduling, not test IPC round trips.
module.exports=function installMapFrameSampler(){
 const stage=document.getElementById('ming-map-layer'),values=[],transforms=new Set(),latencies=[];
 let active=false,running=true,last=null,raf,downAt=null,firstFrameMs=null,inputAt=null;
 function down(){active=true;last=null;downAt=performance.now();}
 function move(){if(active)inputAt=performance.now();}
 function up(){active=false;}
 function sample(t){
  if(active){
   if(firstFrameMs===null)firstFrameMs=performance.now()-downAt;
   if(last!==null)values.push(t-last);last=t;
   const node=document.getElementById('tmf-map-world'),m=node&&node.getScreenCTM();
   if(m)transforms.add([m.a,m.d,m.e,m.f].join(','));
   if(inputAt!==null){latencies.push(performance.now()-inputAt);inputAt=null;}
  }
  if(running)raf=requestAnimationFrame(sample);
 }
 stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
 raf=requestAnimationFrame(sample);
 window.__mapFrameAudit={stop(){running=false;cancelAnimationFrame(raf);stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);return {intervals:values,transforms:[...transforms],firstFrameMs,inputToFrameMs:latencies,visibility:document.visibilityState};}};
};
