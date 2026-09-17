/* Deterministic, bounded tactical navigation. No game-state writes, rendering dependencies or timers. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleNavigation=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const directions=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
  function footprint(p){
    if(p.kind==='house')return{x:p.x,y:p.y,hx:p.size,hy:p.size*.66,angle:p.rotation||0};
    if(p.kind==='palisade')return{x:p.x,y:p.y,hx:p.size*1.08,hy:p.size*.22,angle:p.rotation||0};
    if(p.kind==='rock'&&p.size>65)return{x:p.x,y:p.y,hx:p.size*.82,hy:p.size*.82,angle:p.rotation||0};
    return null;
  }
  function deploymentPolygon(world,side){
    const a=world.deployment(side),b=world.deployment(side==='ming'?'jin':'ming'),dx=b.x-a.x,dy=b.y-a.y,margin=Math.hypot(dx,dy)*180;
    const value=p=>(p.x-world.w/2)*dx+(p.y-world.h/2)*dy+margin,corners=[{x:0,y:0},{x:world.w,y:0},{x:world.w,y:world.h},{x:0,y:world.h}],out=[];
    for(let i=0;i<4;i++){const p=corners[i],q=corners[(i+1)%4],v=value(p),w=value(q);if(v<=0)out.push(p);if((v<0)!==(w<0)){const t=v/(v-w);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}
    return out;
  }
  function create(world,options){
    options=options||{};const cell=options.cellSize||100,clearance=options.clearance==null?26:options.clearance,nx=Math.ceil(world.w/cell),ny=Math.ceil(world.h/cell),size=nx*ny;
    const blocked=new Uint8Array(size),cost=new Float32Array(size),edgeKnown=new Uint8Array(size),edges=new Uint8Array(size),scores=new Float64Array(size),parents=new Int32Array(size),visited=new Uint32Array(size),closed=new Uint32Array(size);
    const bins=new Map(),bucketSize=500,obstacles=(world.props||[]).map(footprint).filter(Boolean),cache=new Map(),plans=new WeakMap();
    const stats={searches:0,cacheHits:0,expanded:0,waiting:0,blocked:0};let epoch=0,budget=options.searchBudget||3;
    for(const o of obstacles){o.c=Math.cos(o.angle);o.s=Math.sin(o.angle);const r=Math.hypot(o.hx,o.hy)+100;for(let y=Math.floor((o.y-r)/bucketSize);y<=Math.floor((o.y+r)/bucketSize);y++)for(let x=Math.floor((o.x-r)/bucketSize);x<=Math.floor((o.x+r)/bucketSize);x++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(o);}}
    function walkable(x,y,r){
      if(!Number.isFinite(x)||!Number.isFinite(y))return false;
      r=r==null?clearance:r;if(x<24+r||y<24+r||x>world.w-24-r||y>world.h-24-r)return false;
      if(world.isWater(x,y)||world.isWater(x+r,y)||world.isWater(x-r,y)||world.isWater(x,y+r)||world.isWater(x,y-r))return false; // 热路径不再为每名兵反复分配5组坐标数组
      const list=bins.get(Math.floor(x/bucketSize)+','+Math.floor(y/bucketSize))||[];
      for(const o of list){const dx=x-o.x,dy=y-o.y,lx=dx*o.c+dy*o.s,ly=-dx*o.s+dy*o.c;if(Math.abs(lx)<o.hx+r&&Math.abs(ly)<o.hy+r)return false;}
      return true;
    }
    function point(k){return{x:Math.min(world.w-50,(k%nx+.5)*cell),y:Math.min(world.h-50,(Math.floor(k/nx)+.5)*cell)};}
    function index(p){return clamp(Math.floor(p.y/cell),0,ny-1)*nx+clamp(Math.floor(p.x/cell),0,nx-1);}
    for(let k=0;k<size;k++){const p=point(k);blocked[k]=walkable(p.x,p.y)?0:1;if(!blocked[k]){const t=world.surfaceAt(p.x,p.y),s=Math.hypot(world.heightAt(p.x+40,p.y)-world.heightAt(p.x-40,p.y),world.heightAt(p.x,p.y+40)-world.heightAt(p.x,p.y-40))/80;cost[k]=1+Math.min(2,s*3)+(t==='forest'?.7:t==='river'?.5:0);}}
    function segmentClear(a,b,r){if(![a.x,a.y,b.x,b.y].every(Number.isFinite))return false;const steps=Math.max(1,Math.ceil(distance(a,b)/Math.min(40,cell*.4)));for(let i=0;i<=steps;i++){const t=i/steps;if(!walkable(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,r))return false;}return true;}
    function nearest(p,limit,connected,gridOnly){
      if(!gridOnly&&walkable(p.x,p.y)&&!blocked[index(p)])return{x:p.x,y:p.y};const cx=clamp(Math.floor(p.x/cell),0,nx-1),cy=clamp(Math.floor(p.y/cell),0,ny-1);let best=null,bd=Infinity;
      for(let ring=0;ring<=(limit||16);ring++){for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++){if(ring&&Math.abs(dx)!==ring&&Math.abs(dy)!==ring)continue;const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=nx||y>=ny||blocked[y*nx+x])continue;const q=point(y*nx+x),d=distance(p,q);if(d<bd&&(!connected||segmentClear(p,q))){bd=d;best=q;}}if(best&&ring*cell>bd+cell)return best;}return best;
    }
    function connections(k){if(edgeKnown[k])return edges[k];edgeKnown[k]=1;const x=k%nx,y=Math.floor(k/nx),p=point(k);let bits=0;
      for(let d=0;d<8;d++){const [dx,dy]=directions[d],xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=nx||yy>=ny)continue;const n=yy*nx+xx;if(blocked[n]||(d>3&&(blocked[y*nx+xx]||blocked[yy*nx+x])))continue;if(segmentClear(p,point(n)))bits|=1<<d;}edges[k]=bits;return bits;
    }
    function remember(key,r){if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,r);return r;}
    function findPath(from,target){
      if(!from||!target||![from.x,from.y,target.x,target.y].every(Number.isFinite))return{ok:false,reason:'invalid-coordinate',points:[]};
      const start=walkable(from.x,from.y)?{x:from.x,y:from.y}:nearest(from),goal=walkable(target.x,target.y)?{x:target.x,y:target.y}:nearest(target);if(!start||!goal)return{ok:false,reason:'no-safe-ground',points:[]};const adjusted=distance(goal,target)>1;
      if(segmentClear(start,goal))return{ok:true,points:[start,goal],goal,adjusted,expanded:0};
      const gridStart=nearest(start,16,true,true),gridGoal=nearest(goal,16,true,true);if(!gridStart||!gridGoal)return{ok:false,reason:'unsafe-connector',points:[]};const si=index(gridStart),gi=index(gridGoal),key=si+':'+gi;
      if(cache.has(key)){const saved=cache.get(key);if(!saved.ok)return saved;const points=[start,...saved.middle,goal];if(segmentClear(points[0],points[1])&&segmentClear(points[points.length-2],goal)){stats.cacheHits++;return{...saved,points,goal,adjusted};}cache.delete(key);}
      stats.searches++;epoch++;if(epoch===0xffffffff){visited.fill(0);closed.fill(0);epoch=1;}
      const heap=[],hx=gi%nx,hy=Math.floor(gi/nx);let sequence=0;
      const heuristic=k=>{const dx=Math.abs(k%nx-hx),dy=Math.abs(Math.floor(k/nx)-hy);return Math.max(dx,dy)+.41421356237*Math.min(dx,dy);};
      function push(k,f){const o={k,f,seq:sequence++};let i=heap.length;heap.push(o);while(i){const p=(i-1)>>1;if(heap[p].f<f||(heap[p].f===f&&heap[p].k<=k))break;heap[i]=heap[p];i=p;}heap[i]=o;}
      function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&(heap[j+1].f<heap[j].f||(heap[j+1].f===heap[j].f&&heap[j+1].k<heap[j].k)))j++;if(last.f<heap[j].f||(last.f===heap[j].f&&last.k<=heap[j].k))break;heap[i]=heap[j];i=j;}heap[i]=last;}return first.k;}
      scores[si]=0;visited[si]=epoch;parents[si]=-1;push(si,heuristic(si));let expanded=0,found=false;
      while(heap.length&&expanded<(options.maxExpanded||28000)){const k=pop();if(closed[k]===epoch)continue;closed[k]=epoch;expanded++;if(k===gi){found=true;break;}const mask=connections(k),x=k%nx,y=Math.floor(k/nx);for(let d=0;d<8;d++){if(!(mask&(1<<d)))continue;const [dx,dy]=directions[d],n=(y+dy)*nx+x+dx;if(closed[n]===epoch)continue;const score=scores[k]+(d>3?Math.SQRT2:1)*(cost[k]+cost[n])*.5;if(visited[n]!==epoch||score<scores[n]){scores[n]=score;visited[n]=epoch;parents[n]=k;push(n,score+heuristic(n));}}}
      stats.expanded+=expanded;if(!found){stats.blocked++;return remember(key,{ok:false,reason:heap.length?'search-budget':'unreachable',points:[],expanded});}
      const raw=[];for(let k=gi;k!==-1;k=parents[k]){raw.push(point(k));if(k===si)break;}raw.reverse();
      // Keep boundary connectors validated; coarse cells must never cut a thin wall.
      const all=[start,...raw,goal],points=[start];let cursor=0;
      while(cursor<all.length-1){let next=Math.min(all.length-1,cursor+24);while(next>cursor+1&&!segmentClear(all[cursor],all[next]))next--;if(!segmentClear(all[cursor],all[next]))return remember(key,{ok:false,reason:'unsafe-connector',points:[],expanded});points.push(all[next]);cursor=next;}
      const r={ok:true,points,middle:points.slice(1,-1),goal,adjusted,expanded};remember(key,r);return r;
    }
    function beginFrame(){budget=options.searchBudget||3;}
    function waypoint(unit,target,time){
      let p=plans.get(unit);const moved=!p||distance(p.target,target)>cell*.75;
      if(moved){if(budget<=0){stats.waiting++;return{ok:false,waiting:true};}budget--;const r=findPath(unit,target);p={target:{...target},route:r,cursor:1,time:time||0};plans.set(unit,p);}
      if(!p.route.ok)return p.route;
      while(p.cursor<p.route.points.length-1&&distance(unit,p.route.points[p.cursor])<cell*.35)p.cursor++;
      const q=p.route.points[p.cursor],arrived=p.cursor===p.route.points.length-1&&distance(unit,q)<18;
      return{ok:true,x:q.x,y:q.y,arrived,adjusted:p.route.adjusted,goal:p.route.goal,points:p.route.points,cursor:p.cursor};
    }
    function reset(unit){plans.delete(unit);}
    function constrain(a,b,r,allowExit){
      if(![b.x,b.y].every(Number.isFinite))return a;
      if(allowExit)return{x:b.x,y:b.y};if(!walkable(a.x,a.y,r))return project(a,r)||a;
      if(segmentClear(a,b,r))return b;
      let best={x:a.x,y:a.y},travel=0;
      for(const q of [{x:b.x,y:a.y},{x:a.x,y:b.y},b]){const steps=Math.max(1,Math.ceil(distance(a,q)/20));for(let i=1;i<=steps;i++){const p={x:a.x+(q.x-a.x)*i/steps,y:a.y+(q.y-a.y)*i/steps};if(!walkable(p.x,p.y,r))break;const d=distance(a,p);if(d>travel){travel=d;best=p;}}}return best;
    }
    function project(p,r){if(walkable(p.x,p.y,r))return p;for(let ring=1;ring<=24;ring++){const rad=ring*16;for(let i=0;i<16;i++){const a=i/16*Math.PI*2,q={x:p.x+Math.cos(a)*rad,y:p.y+Math.sin(a)*rad};if(walkable(q.x,q.y,r))return q;}}return nearest(p);}
    function exitGoal(unit,desired){let candidates=[];for(let k=0;k<size;k++){const x=k%nx,y=Math.floor(k/nx);if(x&&y&&x!==nx-1&&y!==ny-1)continue;if(blocked[k])continue;const p=point(k);candidates.push({p,score:distance(p,desired)+distance(p,unit)*.15,x,y});}candidates.sort((a,b)=>a.score-b.score);
      for(const c of candidates.slice(0,16)){if(!findPath(unit,c.p).ok)continue;return{inside:c.p,outside:{x:c.x===0?-100:c.x===nx-1?world.w+100:c.p.x,y:c.y===0?-100:c.y===ny-1?world.h+100:c.p.y}};}return null;
    }
    return{world,cell,nx,ny,stats,obstacles,walkable,segmentClear,findPath,waypoint,beginFrame,reset,nearest,project,constrain,exitGoal};
  }
  return{create,footprint,deploymentPolygon};
});
