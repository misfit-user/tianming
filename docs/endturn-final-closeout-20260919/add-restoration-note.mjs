import fs from 'node:fs';
const d='docs/endturn-final-closeout-20260919',file=d+'/write-closeout-report.mjs';let s=fs.readFileSync(file,'utf8');
const marker="text.push('## 六、交付边界');";
if(s.split(marker).length!==2)throw Error('Report section changed');
const note="text.push('磁盘写满中断过一次压力测试文件更新。该文件已从开工备份和六次已记录的变更精确重建，SHA-256 与中断前最后记录一致，再应用后续修复并重新验证。重建记录在 `pressure-source-recovery.json` 与 `disk-interruption-restored.json`。最终代码中不保留这次中断产生的空文件。');\n";
if(!s.includes('pressure-source-recovery.json'))fs.writeFileSync(file,s.replace(marker,note+marker),'utf8');
console.log('Recorded the recovered disk interruption in the final report generator.');
