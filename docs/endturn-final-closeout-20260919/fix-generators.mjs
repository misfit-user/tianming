import fs from 'node:fs';
import {edit} from './patch-utils.mjs';
const p='docs/endturn-final-closeout-20260919/generate.mjs';let s=fs.readFileSync(p,'utf8');s=s.replace("[command],{stdio:'inherit'}","[command].concat(command.includes('build-native-preparation')?['--write']:[]),{stdio:'inherit'}");fs.writeFileSync(p,s,'utf8');
edit('web/scripts/smoke-startup-phase-observability.js',(s,r)=>r(s,"'tm-endturn-response-recovery.js','tm-endturn-recovery-vault.js']","'tm-endturn-response-recovery.js','tm-endturn-recovery-vault.js','tm-endturn-save-reconcile.js']"));
edit('web/scripts/lib-save-commit-boundary.js',(s,r)=>{
 s=r(s,'_writeSafety:null,_storageDiagnostic(){}','_writeSafety:null,_writeSequence:0,_uncertainWrites:new Map(),_writeOutcomeListeners:new Map(),_storageDiagnostic(){}');
 return r(s,"['_unconfirmedWriteError','_assertStorageWritable'","['_publishWriteOutcome','_unconfirmedWriteError','_assertStorageWritable'");
});
edit('web/scripts/lib-perf-round1.js',(s,r)=>r(s,'Blob, Response, CompressionStream, DecompressionStream, TextDecoder, TextEncoder: Encoder,','Blob, Response, ReadableStream, CompressionStream, DecompressionStream, TextDecoder, TextEncoder: Encoder,'));
edit('web/scripts/smoke-building-appraisal-compat.js',(s,r)=>r(s,"assert.equal(h.requests.length, 2, 'one tool attempt plus one bounded fallback, not three whole rounds');","assert.equal(h.requests.length, 1, 'authentication rejection must not resend credentials through another fallback or appraisal round');"));
