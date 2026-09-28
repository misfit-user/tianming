from pathlib import Path
p=Path(__file__).with_name('ui-full-scenario-electron.cjs');t=p.read_text(encoding='utf-8')
old=" const source=JSON.parse(fs.readFileSync(path.join(root,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));"
new=" const source=(()=>{const s=JSON.parse(fs.readFileSync(path.join(root,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));return{id:s.id,characters:s.characters.map(c=>({id:c.id,name:c.name,isHistorical:c.isHistorical,historicalSourceRef:c.historicalSourceRef,concurrentTitles:c.concurrentTitles||[]}))};})();"
assert t.count(old)==1;t=t.replace(old,new,1)
old="const rows=await js(`(()=>{const people=GM.chars.filter(c=>c.isHistorical);return people.map(c=>{TMZhi.selectP(c.name);TMZhi.switchTab('sources');const p=document.querySelector('[data-zhi-sources]');return{id:c.id,quoted:p.querySelectorAll('[data-zhi-original]').length,pending:p.textContent.includes('原文待核：'),name:p.textContent.includes(c.name)};});})()`);"
new="const rows=await js(`(async()=>{const people=GM.chars.filter(c=>c.isHistorical),out=[];for(const c of people){TMZhi.selectP(c.name);TMZhi.switchTab('sources');const p=document.querySelector('[data-zhi-sources]');out.push({id:c.id,quoted:p.querySelectorAll('[data-zhi-original]').length,pending:p.textContent.includes('原文待核：'),name:p.textContent.includes(c.name)});await new Promise(r=>setTimeout(r,20));}return out;})()`);"
assert t.count(old)==1;t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
print('Test-only memory reduction: keep minimal assertion reference, yield between each of the 81 page visits. Production code and all assertions unchanged.')
