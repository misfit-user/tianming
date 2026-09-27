import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{functionSource}=require('../../web/scripts/lib-perf-round1');
console.log('CARD\n'+functionSource(fs.readFileSync('web/phase8-formal-map-dossier.js','utf8'),'bkYeCard'));
console.log('DEPENDENCIES',JSON.stringify({declared:JSON.parse(fs.readFileSync('package.json','utf8')).overrides,locked:JSON.parse(fs.readFileSync('package-lock.json','utf8')).packages['node_modules/js-yaml'].version,installed:require('js-yaml/package.json').version}));
console.log('START CHECKS');for(const f of ['web/tm-patches-start.js','web/scripts/smoke-start-game-data-integrity.js'])fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(/useAIGeo|geoChoice|aiGeoChoice|_startGeo/.test(l))console.log(f+':'+(i+1)+': '+l.slice(0,240));});
