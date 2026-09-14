'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),V=require('../battle/unit-visibility.js'),A=require('../battle/unit-assets.js');
const planes=V.frustum([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);assert(V.visible(planes,0,0,0,.1));assert(V.visible(planes,1.4,0,0,.5));assert(!V.visible(planes,1.6,0,0,.5));assert(!V.visible(planes,0,0,-2,.5));assert(V.visible(null,100,100,100,1));
let points=0;for(const kind of A.kinds){const m=A.generate(kind,0),b=V.bounds(m);for(let i=0;i<m.vertices.length;i+=11){const d=Math.hypot(m.vertices[i]-b.x,m.vertices[i+1]-b.y,m.vertices[i+2]-b.z);assert(d+.549<b.r,kind+' bounds must include articulation');points++;}}
// The view-volume module must exist before unit-render captures its dependency.
const html=fs.readFileSync(require.resolve('../battle/index.html'),'utf8');assert(html.indexOf('src="unit-visibility.js')<html.indexOf('src="unit-render.js'));
const vm=require('node:vm'),scope={window:{TMBattleUnitAssets:A,TMBattleUnitVisibility:V,TMBattleShadows:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../battle/unit-render.js'),'utf8'),scope);
const u={id:'tail',type:'step',sub:'spear',alive:true,side:'ming',x:3000,y:0,facing:0,soldiers:500,_men:[{x:0,y:0,ph:0}]},options={cam:{x:0,y:0,zoom:1},frustum:V.frustum([.001,0,0,0,0,.001,0,0,0,0,.001,0,0,0,0,1]),W:1000,H:700,EX:1,now:0,project:(x,y,h)=>({x,y:y-(h||0)}),heightAt:()=>0};
const count=g=>Object.values(g).reduce((n,a)=>n+a.length,0);assert.equal(count(scope.window.TMBattleUnitRenderer.instances([u],options)),1,'visible tail must survive an off-screen cohort center');u.x=0;u._men[0].x=5000;assert.equal(count(scope.window.TMBattleUnitRenderer.instances([u],options)),0,'off-screen mesh must not consume the visible budget');assert.equal(u.soldiers,500);
console.log('PASS conservative frustum culling: '+points+' source vertices plus articulation margin; boundary intersections remain visible; load order verified');
