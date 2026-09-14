/* Software-only raster budget. CSS/HUD coordinates and simulation never change. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleResolution=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const SOFTWARE_PIXELS=240000,MIN_SOFTWARE_PIXELS=120000;
  function mode(value){return value==='native'?'native':'auto';}
  function size(width,height,software,setting,budget){
    const safe=n=>Number.isFinite(n)&&n>0?Math.max(1,Math.round(n)):1,w=safe(width),h=safe(height);
    const pixels=Number.isFinite(budget)?Math.max(MIN_SOFTWARE_PIXELS,Math.min(SOFTWARE_PIXELS,budget)):SOFTWARE_PIXELS;
    const scale=software&&mode(setting)==='auto'?Math.min(1,Math.sqrt(pixels/(w*h))):1;
    return{width:Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale)),scale,mode:mode(setting),software:!!software};
  }
  function create(){
    let pixels=SOFTWARE_PIXELS,last=0,warm=8;const samples=[];
    function reset(){pixels=SOFTWARE_PIXELS;last=0;warm=8;samples.length=0;}
    function frame(time,enabled){
      if(!enabled){last=0;samples.length=0;return false;}const elapsed=last?time-last:0;last=time;
      if(warm>0){warm--;return false;}if(elapsed<=0||elapsed>1000)return false;
      samples.push(elapsed);if(samples.length<12)return false;samples.sort((a,b)=>a-b);const slow=samples[6]>70;samples.length=0;
      if(!slow||pixels<=MIN_SOFTWARE_PIXELS)return false;pixels=Math.max(MIN_SOFTWARE_PIXELS,Math.floor(pixels*.75));return true;
    }
    return{frame,reset,get pixels(){return pixels;}};
  }
  return{size,mode,create,SOFTWARE_PIXELS,MIN_SOFTWARE_PIXELS};
});
