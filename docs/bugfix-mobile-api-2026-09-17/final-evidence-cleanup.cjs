'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'verify-final.mjs');let code=fs.readFileSync(file,'utf8');
const from='([^\\s(]+)/gm),m=>m[1]).sort();';const to='([a-z][a-z-]*)/gm),m=>m[1]).sort();';
if(code.split(from).length!==2)throw Error('unexpected status expression');fs.writeFileSync(file,code.replace(from,to));
fs.appendFileSync(path.join(__dirname,'README.md'),'\n差异检查备注：默认 git diff --check 将保留的 CRLF 行尾标成空白错误；原始结果留在 diff-check-default.log。验收另以仅本进程生效的 cr-at-eol 识别原行尾，并保留三项默认空白检查；未修改全局 Git 设置、未转换源码行尾。\n');
console.log('EVIDENCE_NOTES_FINALIZED');
