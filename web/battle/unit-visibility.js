/* Conservative world-space frustum culling, including every mesh vertex and articulation margin. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleUnitVisibility=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function frustum(m){if(!m||m.length!==16)return null;const out=[];for(const row of [0,1,2])for(const sign of [-1,1]){const p=[m[3]+sign*m[row],m[7]+sign*m[4+row],m[11]+sign*m[8+row],m[15]+sign*m[12+row]],len=Math.hypot(p[0],p[1],p[2]);if(!len||!p.every(Number.isFinite))return null;out.push(p.map(v=>v/len));}return out;}
  function bounds(model){const b=model.bounds;return{x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2,z:(b.min[2]+b.max[2])/2,r:Math.hypot((b.max[0]-b.min[0])/2,(b.max[1]-b.min[1])/2,(b.max[2]-b.min[2])/2)+.55};}
  function visible(planes,x,y,z,r){return!planes||planes.every(p=>p[0]*x+p[1]*y+p[2]*z+p[3]>=-r);}
  return{frustum,bounds,visible};
});
