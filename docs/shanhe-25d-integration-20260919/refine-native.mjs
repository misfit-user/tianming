import fs from 'node:fs';import path from 'node:path';const root=path.resolve(import.meta.dirname,'../..');
const test=path.join(import.meta.dirname,'test-native.mjs');let t=fs.readFileSync(test,'utf8');t=t.replace("app.whenReady().then(async()=>{report.gpuFeatureStatus", "app.on('window-all-closed',()=>{});\napp.whenReady().then(async()=>{report.gpuFeatureStatus");t=t.replace("mark('active-'+sid,{regions:diag.regions,frame:diag.frame});", "report.gpuAfterReady=app.getGPUFeatureStatus();mark('active-'+sid,{regions:diag.regions,frame:diag.frame});");fs.writeFileSync(test,t);
const file=path.join(root,'web/tm-shanhe-runtime.js');let s=fs.readFileSync(file,'utf8');function swap(a,b){if(s.split(a).length!==2)throw Error('Changed anchor: '+a);s=s.replace(a,b);}
swap("let frame=0,dirty=true", "let svgWatch=null;\nlet frame=0,dirty=true");
swap("function restore(){for", "function restore(){if(svgWatch){svgWatch.disconnect();svgWatch=null;}for");
swap("stage.classList.add('tmf-shanhe-active');", "stage.classList.add('tmf-shanhe-active');if(!svgWatch){svgWatch=new MutationObserver(()=>{records.delete(rec.svg);dirty=true;refresh();});svgWatch.observe(rec.svg,{subtree:true,attributes:true,attributeFilter:['fill','d','class']});}");
swap("current={map,p,v:{...v},state,size,rec,view};", "current={map,p,v:{...v},state,size,rec,view,labelSvg:current?.labelSvg,visibleLabels:current?.visibleLabels};");
swap("cc.globalAlpha=1;\n  for(const edge", "cc.globalAlpha=1;\n  for(const it of cart.items)if(it.node.classList.contains('selected')){cc.strokeStyle='#fff1b5';cc.lineWidth=w/nx*3;cc.stroke(it.world);}\n  for(const edge");
fs.writeFileSync(file,s);console.log('Adapter selection/color invalidation and retained label state; test window lifecycle fixed');
