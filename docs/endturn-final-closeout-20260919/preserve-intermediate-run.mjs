import fs from 'node:fs';
const d='docs/endturn-final-closeout-20260919',label='before-panel-fixture-fix-';
for(const name of ['final-full-tests.json','final-full-tests.log','final-run-status.json','final-tested-inputs.json','verification.json']){
 const source=d+'/'+name,dest=d+'/'+label+name;if(fs.existsSync(source)&&!fs.existsSync(dest))fs.copyFileSync(source,dest);
}
console.log('Preserved the 1056/1058 intermediate run and source-change ledger before the final complete rerun.');
