/* Single movement boundary for tactical orders, routs, displacement, deployment and visible crowds. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleMotion=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function create(nav,notify){
    const before=new Map(),exits=new WeakMap(),world=nav.world;
    function beginStep(units){nav.beginFrame();before.clear();for(const u of units){before.set(u,{x:u.x,y:u.y});if(u.state!=='rout'){u._navExiting=false;exits.delete(u);}}}
    function waypoint(u,target,time){
      let exit;
      if(u.state==='rout'){
        exit=exits.get(u);if(!exit){exit=nav.exitGoal(u,target);if(exit)exits.set(u,exit);}if(!exit)return{ok:false,reason:'no-exit'};
        if(u._navExiting||dist(u,exit.inside)<36){u._navExiting=true;return{ok:true,...exit.outside,exiting:true};}target=exit.inside;
      }
      const r=nav.waypoint(u,target,time);u._navStatus=r.ok?(r.adjusted?'adjusted':'ready'):r.waiting?'waiting':'blocked';u._navReason=r.reason||'';u._navGoal=r.goal||null;
      if(!r.ok&&!r.waiting&&u.side==='ming'&&u.state!=='rout'){
        const key=Math.round(target.x/100)+':'+Math.round(target.y/100);if(u._navNotice!==key){u._navNotice=key;if(notify)notify((u.name||'此阵')+(r.reason==='search-budget'?'：本次寻路达到计算上限，已停步，请分段下令。':'：目标无可达道路，已停止前进，请另择落点。'));}
      }
      if(r.ok&&r.adjusted&&u.side==='ming'&&u.state!=='rout'){const key='adjusted:'+Math.round(target.x/100)+':'+Math.round(target.y/100);if(u._navNotice!==key){u._navNotice=key;if(notify)notify((u.name||'此阵')+'：落点位于障碍中，改至附近可达地面。');}}
      if(r.ok){u._navRoute=r.points||[];u._navCursor=r.cursor||0;}else u._navRoute=[];return r;
    }
    function move(u,x,y){const q=nav.constrain(u,{x,y},undefined,!!u._navExiting);u.x=q.x;u.y=q.y;}
    function endStep(units){for(const u of units){const old=before.get(u);if(!u._navExiting){const q=old?nav.constrain(old,u):nav.project(u);if(q){u.x=q.x;u.y=q.y;}}const trail=u._navTrail||(u._navTrail=[{x:u.x,y:u.y}]);if(dist(u,trail[trail.length-1])>60){trail.push({x:u.x,y:u.y});if(trail.length>40)trail.shift();}}}
    function place(u,target){
      const own=world.deployment(u.side||'ming'),enemy=world.deployment(u.side==='jin'?'ming':'jin'),dx=enemy.x-own.x,dy=enemy.y-own.y;
      const belongs=p=>((p.x-world.w/2)*dx+(p.y-world.h/2)*dy)<-Math.hypot(dx,dy)*180;
      if(!belongs(target))return false;const p=nav.project(target);if(!p||!belongs(p))return false;u.x=p.x;u.y=p.y;u._navTrail=[{...p}];nav.reset(u);return true;
    }
    function crowdTarget(m,u,target){
      const b=world.crossingAt(u.x,u.y,300);if(b){const along=(target.x-b.x)*b.tx+(target.y-b.y)*b.ty,limit=b.width/2-55,clamped=Math.max(-limit,Math.min(limit,along));target={x:target.x+(clamped-along)*b.tx,y:target.y+(clamped-along)*b.ty};}
      if(!nav.segmentClear(m,target,6)){const trail=u._navTrail||[];for(let i=trail.length-1;i>=0;i--)if(nav.segmentClear(m,trail[i],6))return trail[i];}
      return target;
    }
    function crowdMove(m,x,y,exiting){const q=nav.constrain(m,{x,y},6,!!exiting);m.x=q.x;m.y=q.y;}
    return{beginStep,waypoint,move,endStep,place,crowdTarget,crowdMove};
  }
  return{create};
});
