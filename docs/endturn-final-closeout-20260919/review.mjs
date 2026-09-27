import fs from 'node:fs';
const dir='docs/endturn-final-closeout-20260919';
for(const name of process.argv.slice(2)){
 const p=dir+'/'+name;if(!fs.existsSync(p)){console.log(name,'not available');continue;}
 const r=JSON.parse(fs.readFileSync(p,'utf8'));console.log(name,JSON.stringify(r.summary));
 for(const row of r.results||[])if(!row.pass)console.log(row.name,JSON.stringify({exit:row.exit,timedOut:row.timedOut}),String(row.output||'').slice(-1800));
}
