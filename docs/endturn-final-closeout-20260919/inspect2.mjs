import fs from 'node:fs';
for(const name of ['tm-save-manager.js','tm-save-lifecycle.js','tm-storage.js']){
 console.log('\n'+name);
 fs.readFileSync('web/'+name,'utf8').split('\n').forEach((line,i)=>{if(/_tmForkLoadedTimeline|recoverPreEndturn|_validatePreEndturn|pre_endturn|writeBlocked|_storageWrite|reconcile/i.test(line))console.log((i+1)+': '+line.slice(0,240));});
}
console.log('\nSCRIPT LOCATIONS');
fs.readFileSync('web/index.html','utf8').split('\n').forEach((line,i)=>{if(/tm-faction-membership|tm-fiscal-engine|tm-custom-build-agent|tm-office-reform|tm-player-settings|tm-map-drawer|tm-public-treasury/.test(line))console.log((i+1)+': '+line);});
const b=fs.readFileSync('docs/endturn-final-closeout-20260919/baseline-full-tests.log');console.log('BASELINE TAIL',b.toString(b[0]===255?'utf16le':'utf8').split('\n').slice(-5).join('\n'));
