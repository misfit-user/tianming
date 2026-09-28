import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../../web/tm-endturn-apply.js');
const before=fs.readFileSync(path.join(here,'originals/tm-endturn-apply.js'));
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
if(!fs.readFileSync(file).equals(before))throw Error('file changed since backup');
const oldText="        // 应用 AI 返回的地图变化\r\n        if(p1.map_changes && P.map) {\r\n          try {\r\n            applyAIMapChanges(p1, P.map);\r\n          } catch(e) {\r\n            console.error('应用地图变化失败:', e);\r\n          }\r\n        }";
const newText="        // 当前世界拥有地图；错误交回回合事务，不得吞掉后继续提交。\r\n        if(p1.map_changes) {\r\n          if (typeof applyAIMapChanges !== 'function') throw new Error('地图变更模块未加载，本回合未能完成写入');\r\n          ctx.apply.mapChanges = applyAIMapChanges(p1, GM.mapData || GM.map);\r\n        }";
const source=before.toString('utf8');
if(source.split(oldText).length!==2)throw Error('exact entry block not found');
const data=Buffer.from(source.replace(oldText,newText),'utf8');
const fd=fs.openSync(file,'r+');
try{fs.writeSync(fd,data,0,data.length,0);fs.ftruncateSync(fd,data.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
if(!fs.readFileSync(file).equals(data))throw Error('readback mismatch');
console.log('MAIN_MAP_ENTRY_PATCH_READBACK_OK');
