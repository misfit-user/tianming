import fs from 'node:fs';
const root='C:/Users/37814/Desktop/tianming';
const s=JSON.parse(fs.readFileSync(root+'/scenarios/绍宋·建炎元年八月（官方）.json','utf8'));
console.log('FISCAL ACCOUNTING',s.fiscalConfig.accounting);
console.log('FISCAL MAP FLAGS',s.map.sourceBudgetModel);
const files=process.argv.slice(2);
for(const spec of files){
 const [f,a,b]=spec.split(':');
 const code=fs.readFileSync(root+'/web/'+f,'utf8').split('\n');
 console.log('\nFILE '+f);
 if(a)console.log(code.slice(Number(a)-1,Number(b)).map((x,i)=>(Number(a)+i)+': '+x).join('\n'));
 else code.forEach((l,i)=>{if(/function walkAdminDivisions|function childArrays|function calcCascade|cascadeTax|FiscalEngine =|function taxBase|provinceCount|entry.provinces|sourceBudgetModel|leafOnly|skipChildren/.test(l))console.log((i+1)+': '+l);});
}
