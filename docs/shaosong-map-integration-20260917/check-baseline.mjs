// Test-only source substitution. No installed code or scenario is changed.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]||'.'),job=process.argv[3];
if(!['smoke-start-hierarchy-immutability.js','smoke-native-fiscal-consumers.js'].includes(job))throw Error('Explicit regression case required');
const work=path.join(root,'docs/shaosong-map-integration-20260917/map-stage'),read=fs.readFileSync;
const replacements=new Map(JSON.parse(read(path.join(work,'runtime-plan.json'),'utf8')).map(r=>[path.resolve(root,'web',r.name).toLowerCase(),path.join(work,'runtime-before',r.name)]));
fs.readFileSync=function(file,...args){const key=typeof file==='string'?path.resolve(file).toLowerCase():'';return read.call(fs,replacements.get(key)||file,...args);};
console.log('BASELINE before this task runtime changes; existing synthetic fixture unchanged.');
const load=createRequire(path.join(root,'package.json'));load(path.join(root,'web/scripts',job));
