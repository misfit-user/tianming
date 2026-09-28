'use strict';
const fs=require('node:fs'),path=require('node:path');const target=path.join(__dirname,'verify-final.mjs');
let code=fs.readFileSync(target,'utf8');
const from="git(['diff','--check','--',...files.map(f=>f.file),...testFiles]);";
const to=`const diffArgs=['diff','--check','--',...files.map(f=>f.file),...testFiles];
const defaultDiff=cp.spawnSync('C:/Program Files/Git/cmd/git.exe',['--no-optional-locks','-C',root,...diffArgs],{encoding:'utf8',windowsHide:true});
fs.writeFileSync(path.join(here,'diff-check-default.log'),String(defaultDiff.stdout||'')+String(defaultDiff.stderr||''));
// Keep the repository's frozen CRLF bytes; recognize CR as a line ending only.
// All normal end-of-line spaces, end-of-file blanks and space-before-tab checks remain enabled.
git(['-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',...diffArgs]);`;
if(code.split(from).length!==2)throw Error('nonunique diff anchor');code=code.replace(from,to);
code=code.replace('diffCheckExitCode:0,installedSoftware:',"diffCheckExitCode:0,defaultDiffCheckExitCode:defaultDiff.status,diffCheckMode:'standard whitespace checks plus CRLF recognition; process-local only',installedSoftware:");
fs.writeFileSync(target,code);console.log('FROZEN_LINE_ENDING_VERIFICATION_CONFIGURED');
