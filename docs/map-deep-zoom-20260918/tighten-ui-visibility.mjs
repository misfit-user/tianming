import fs from 'node:fs';import assert from 'node:assert/strict';
const p='docs/map-deep-zoom-20260918/verify-zoom-ui.mjs';let t=fs.readFileSync(p,'utf8');
function one(a,b){assert.equal(t.split(a).length,2,a);t=t.replace(a,b);}
one("const b=p.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scale:","const b=p.getBoundingClientRect(),q=document.getElementById('ming-map-layer').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,inside:b.left>=q.left&&b.top>=q.top&&b.right<=q.right&&b.bottom<=q.bottom,scale:");
one("atMax.width>40&&atMax.height>25,atMax","atMax.width>40&&atMax.height>25&&atMax.inside,atMax");
fs.writeFileSync(p,t);console.log('Visible target must be inside the actual map viewport, not merely have nonzero dimensions.');
