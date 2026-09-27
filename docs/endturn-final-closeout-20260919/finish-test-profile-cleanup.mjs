import fs from 'node:fs';import path from 'node:path';
const dir=path.resolve('docs/endturn-final-closeout-20260919'),file=path.join(dir,'browser-realtime-result.json');
const report=JSON.parse(fs.readFileSync(file,'utf8')),profile=path.resolve(report.isolatedProfile);
if(path.dirname(profile)!==dir||!/^\.edge-realtime-\d+$/.test(path.basename(profile)))throw Error('Refusing cleanup outside the recorded isolated test directory');
const before=Object.assign({},report);let removed=!fs.existsSync(profile);
if(!removed){if(fs.lstatSync(profile).isSymbolicLink())throw Error('Refusing a linked profile');if(path.dirname(fs.realpathSync(profile))!==fs.realpathSync(dir))throw Error('Unexpected profile destination');fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:300});removed=!fs.existsSync(profile);}
fs.writeFileSync(path.join(dir,'browser-profile-cleanup.json'),JSON.stringify({at:new Date().toISOString(),profile,previousProfileRemoved:before.profileRemoved,previousCleanupError:before.cleanupError||null,removed},null,2));
if(!removed)throw Error('Isolated test profile remains; no other browser profile was touched');
report.profileRemoved=true;report.cleanupVerifiedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));console.log('Recorded isolated browser profile removed; current runtime and source files unchanged.');
