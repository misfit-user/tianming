import fs from 'node:fs';import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-runtime-save-consistency.js',(s,r)=>{
  s=r(s,"const desktopResultSrc = sliceFn(lifecycle, 'function _tmDesktopAutoSaveResultOk(');","const desktopResultSrc = sliceFn(lifecycle, 'function _tmDesktopAutoSaveResultOk(');\nconst desktopTickSrc = sliceFn(lifecycle, 'async function _tmRunDesktopAutoSaveTick(');");
  const a=s.split('\n').find(l=>l.includes("'60s Electron autoSave 仅在业务成功后推进成功时钟'"));
  const b=s.split('\n').find(l=>l.includes("'60s Electron IPC 跨档或快照推进后不推进当前局闲置跳存基线'"));
  if(!a||!b)throw Error('Expected existing autosave contracts');
  s=r(s,a.trimEnd(),"ok(/await _tmAwaitDesktopAutoSaveReply[\\s\\S]*?return bridge\\.autoSave\\(saveData\\);[\\s\\S]*?if \\(!_tmDesktopAutoSaveResultOk\\(result\\)\\) throw[\\s\\S]*?_autoSaveLastDoneMs = Date\\.now\\(\\)/.test(desktopTickSrc), '60s Electron autoSave 仅在业务成功后推进成功时钟');");
  s=r(s,b.trimEnd(),"ok(/GM===targetGM&&P===targetP[\\s\\S]*?lastCommittedSnapshot===sourceSnapshot[\\s\\S]*?await _tmAwaitDesktopAutoSaveReply[\\s\\S]*?if \\(!snapshotStillCurrent\\(\\)\\)[\\s\\S]*?return \\{ ok: true, stale: true[\\s\\S]*?_autoSaveLastDoneMs = Date\\.now\\(\\)/.test(desktopTickSrc), '60s Electron IPC 跨档或快照推进后不推进当前局闲置跳存基线');");
  const pattern=".match(/tianming\\.autoSave\\(/g) || []).length === 1";
  s=r(s,pattern,".match(/(?:tianming|bridge)\\.autoSave\\(/g) || []).length === 1\n  && (desktopTickSrc.match(/bridge\\.autoSave\\(/g)||[]).length===1 && /bridge=window\\.tianming/.test(desktopTickSrc)");
  return s;
});
const prev='docs/endturn-reliability-20260918',dir='docs/desktop-autosave-reliability-20260919';
if(!fs.existsSync(dir+'/sync-manifest.mjs'))fs.writeFileSync(dir+'/sync-manifest.mjs',fs.readFileSync(prev+'/sync-manifest.mjs','utf8').replaceAll(prev,dir));
