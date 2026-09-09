'use strict';
// Actual production markup/CSS in the sandboxed desktop runtime. Synthetic DOM
// input checks are not native mouse/IME tests. No player saves or AI calls.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function ({ win, check }) {
  const dir = path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  const js = code => win.webContents.executeJavaScript(code, true);
  const failures = [], samples = [];
  const verify = async (name, fn) => {
    try { await check(name, fn); } catch (error) { failures.push({ name, error: error.message }); }
  };
  await js(`(async()=>{
    await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));
    TM_Changelog.markRead();TM_Changelog.close();
    GM={sid:'edict-clarity-fixture',turn:2,_campaignId:'clarity-c',_timelineId:'clarity-t',chars:[],facs:[],rels:{},vars:{},edicts:[],_edictSuggestions:[]};
    document.body.classList.add('tm-phase8-formal');
    TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();
    await document.fonts.ready;
  })()`);
  win.show();
  const settled = () => js(`(async()=>{
    const panel=document.querySelector('#tm-action-edict-overlay');
    await Promise.all(panel.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  })()`);
  const inspect = () => js(`(()=>{
    const root=document.getElementById('tm-action-edict-overlay'),field=root.querySelector('#edict-pol');
    function state(el,pseudo){const s=getComputedStyle(el,pseudo),r=el.getBoundingClientRect();return {
      node:el.id||el.className,transform:s.transform,filter:s.filter,backdropFilter:s.backdropFilter,
      opacity:s.opacity,zoom:s.zoom,font:s.font,fontFamily:s.fontFamily,color:s.color,background:s.backgroundColor,
      textShadow:s.textShadow,fontSmoothing:s.webkitFontSmoothing,animation:s.animationName,fill:s.animationFillMode,
      box:{x:r.x,y:r.y,width:r.width,height:r.height}
    };}
    const chain=[];for(let e=field;e;e=e.parentElement)chain.push(state(e));
    return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},chain,
      placeholder:state(field,'::placeholder'),shell:state(root.querySelector('.edict-shell')),silk:state(root.querySelector('.silk')),
      fields:[...root.querySelectorAll('.cat-field')].map(e=>({id:e.id,...state(e),hit:(()=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+12,r.y+12);return e===t;})()})),
      polishedDisplay:getComputedStyle(root.querySelector('#edict-polished')).display,
      rollers:root.querySelectorAll('.roller-v').length,seals:root.querySelectorAll('.cell-seal').length};
  })()`);
  function contrast(fg, bg) {
    const rgb = s => s.match(/[\d.]+/g).map(Number);
    const f = rgb(fg), b = rgb(bg), a = f.length === 4 ? f[3] : 1;
    const lum = c => c.slice(0,3).map(x=>x/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
    const mixed = f.slice(0,3).map((x,i)=>a*x+(1-a)*b[i]);
    const l = [lum(mixed),lum(b)].sort((a,b)=>b-a);return (l[0]+0.05)/(l[1]+0.05);
  }
  // Desktop feedback scope, including an odd requested width. Windows may round
  // this at fractional DPI; observations always record the actual CSS viewport.
  // The initial 960x640 exploratory run exposed pre-existing overlapping mobile
  // rows; retained in the before log, not relabelled as a passed layout test here.
  for (const [width,height] of [[1432,762],[1280,800],[1365,768]]) {
    win.setContentSize(width,height);
    await settled();
    await new Promise(r=>setTimeout(r,160));
    const sample = await inspect();samples.push(sample);
    sample.placeholderContrast=contrast(sample.placeholder.color,sample.fields[0].background);
    fs.writeFileSync(path.join(dir,`edict-${width}.png`),(await win.webContents.capturePage()).toPNG());
    await verify(`edict-${width}-readable-placeholder`,()=>assert(sample.placeholderContrast>=4.5,JSON.stringify({ratio:sample.placeholderContrast,color:sample.placeholder.color})));
    await verify(`edict-${width}-settled-text-not-scaled-or-translucent`,()=>{
      assert.equal(sample.silk.transform,'none');assert.equal(sample.silk.filter,'none');
      assert.equal(sample.shell.transform,'none');assert.equal(sample.shell.opacity,'1');
      assert(sample.chain.every(e=>e.transform==='none'&&e.filter==='none'&&e.opacity==='1'),JSON.stringify(sample.chain));
    });
    await verify(`edict-${width}-layout-and-original-art-preserved`,()=>{
      const box=sample.shell.box;assert(box.x>=0&&box.y>=0&&box.x+box.width<=sample.viewport.width+1&&box.y+box.height<=sample.viewport.height+1);
      assert.equal(sample.fields.length,5);assert(sample.fields.every(f=>f.box.width>100&&f.box.height>30));
      assert(sample.fields[0].hit);assert.equal(sample.rollers,2);assert.equal(sample.seals,5);assert.equal(sample.polishedDisplay,'none');
    });
  }
  win.setContentSize(1432,762);await settled();
  await verify('edict-input-focus-selection-and-draft-roundtrip',async()=>{
    const value='  诏曰：开仓赈济，勿扰民生。组合 e\u0301 😀  ';
    const result=await js(`(()=>{const field=document.querySelector('#tm-action-edict-overlay #edict-pol');
      field.focus();field.value=${JSON.stringify(value)};field.dispatchEvent(new Event('input',{bubbles:true}));
      field.setSelectionRange(4,9);const focus=document.activeElement===field&&field.selectionStart===4&&field.selectionEnd===9;
      TMPhase8FormalBridge.drafts.closeDeskOverlay();TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();
      return {focus,value:document.querySelector('#tm-action-edict-overlay #edict-pol').value,edicts:GM.edicts.length};})()`);
    assert.equal(result.focus,true);assert.equal(result.value,value);assert.equal(result.edicts,0);
  });
  await settled();
  fs.writeFileSync(path.join(dir,'edict-written.png'),(await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(dir,'edict-clarity-observations.json'),JSON.stringify({samples,failures},null,2)+'\n');
  if(failures.length)throw Error(JSON.stringify(failures));
};
