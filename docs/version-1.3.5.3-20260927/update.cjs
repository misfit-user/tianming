'use strict';
// Local metadata update. Reuse release.js's unchanged atomic fan-out functions;
// do not invoke the CLI prepare/publish jobs, Git operations or archive builders.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),Module=require('module');
const root=path.resolve(__dirname,'../..'),version='1.3.5.3',code=1355;
const notes='修复财政收入显示与阶层党派数值变化，完善诏令实际执行、史记反馈和革职后的官制及人物同步。';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['package.json','package-lock.json','mobile/release-version.json','mobile/android/app/build.gradle','web/version.json','web/index.html','web/changelog.json','README.md','web/tm-start-runtime-manifest.json','web/.hot-update-manifest.json'];
const before={};for(const rel of files){const p=path.join(root,rel),buf=fs.readFileSync(p),to=path.join(__dirname,'before',rel);fs.mkdirSync(path.dirname(to),{recursive:true});if(fs.existsSync(to))throw Error('Backup already exists: '+rel);fs.writeFileSync(to,buf);before[rel]=sha(buf);}
const index=path.resolve(root,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:root,encoding:'utf8'}).trim()),indexBefore=sha(fs.readFileSync(index));
const entry={date:'2026-09-27',module:'1.3.5.3 · 财政、诏令反馈与人事同步修缮',title:'校正收支与群体数值，补齐诏令执行回报，让史记、人事和官制与实际数据一致。',items:[
 '财政：右侧栏、顶栏与财政详情采用一致的本期收支口径，修复旧估算覆盖实际收入、重复税项和零流水回落造成的收入虚高；实际交割、预计与欠付分别显示。',
 '阶层与党派：欠饷、地方风险和腐败按真实受影响对象结算；修复满意度正向恢复被吞、开局提前扣减，以及党派凝聚力小数与零值处理错误，防止同回合重复校准绕过变化上限。',
 '诏令：完整颁行诏书与分类诏令统一追踪，逐道返回执行人、进度、阻碍和实际效果；遗漏回报可补正，重复响应不会重复扣款。',
 '实际效果：诏令通过既有机制影响国库、内帑、民心、吏治、皇威、皇权、剧本自定义变量及阶层党派数据；库存不足时显示实付、欠付与部分执行。',
 '史记：实录记录事实，时政记呈现执行过程、因果和消息来源，后人戏说呈现人物经历；各卷依据实际写回结果成文，后台补充反馈归入原回合。',
 '人事：修复“革职抄家、拘押候勘”被误判为任命或漏执行的问题，同步清理人物现职、兼任、官制席位及旧任职字段；刷新与读档后不再恢复旧职，人物图志同步读取现职。',
 '官制兼容：保留剧本自定义官职的正常任命，正确处理同名人物、嵌套官署和重复处分；拟议、暂不革职及留任不会直接免职。',
 '版本：主界面左下角、网页、桌面与安卓版本配置统一为1.3.5.3。本条为本地版本准备记录，发布与客户端下载更新另行进行。'
]};
const changePath=path.join(root,'web/changelog.json'),changeSource=fs.readFileSync(changePath,'utf8'),change=JSON.parse(changeSource);
if(change.entries.some(e=>String(e.module||'').startsWith(version)))throw Error('Version entry already exists');
const clNL=changeSource.includes('\r\n')?'\r\n':'\n',marker=' "entries": ['+clNL;
if(!changeSource.includes(marker))throw Error('Changelog insertion anchor missing');
const block=JSON.stringify(entry,null,1).split('\n').map(l=>'  '+l).join(clNL);
fs.writeFileSync(changePath,changeSource.replace(marker,()=>marker+block+','+clNL));
const readmePath=path.join(root,'README.md');let readme=fs.readFileSync(readmePath,'utf8'),nl=readme.includes('\r\n')?'\r\n':'\n';
const old='| **当前源码内容版本** | 1.3.5.2（2026-09-20；网页与源码版，本轮不打安装包） |';if(!readme.includes(old))throw Error('README version anchor changed');
readme=readme.replace(old,'| **当前源码内容版本** | 1.3.5.3（2026-09-27；本地版本准备，待发布） |');
const section=[
 '## 1.3.5.3 本轮更新','',
 '- **财政收支**：修复右侧栏收入虚高，顶栏与详情统一读取本期实际账目，区分预计收入、实付和欠付。',
 '- **阶层与党派**：按真实受影响对象结算满意度与影响；修复开局提前扣减、正向恢复被吞、凝聚力小数和零值错误，以及同回合重复校准问题。',
 '- **诏令执行**：整道颁行诏书也有逐条追踪与回报，实际影响写入核心指标、各剧本变量和阶层党派数据；缺款、在途、受阻及部分执行如实呈现。',
 '- **史记分工**：实录记事实，时政记讲执行过程与消息来源，后人戏说呈现人物经历；成文依据实际写回结果，晚到反馈归入原回合。',
 '- **官制与人物**：修复“革职抄家、拘押候勘”显示成功却未正确摘职的问题，人物现职、兼任、官制席位及图志保持一致，刷新和读档不再恢复旧职；保留自定义官职任命和同名人物区分。','',
 '**当前为本地源码版本准备，尚未发布安装包、网页或热更新。** 主界面左下角及各端版本配置已统一为 1.3.5.3。旧存档中已漏执行的历史处分与已扣除的满意度未做追溯补算。','',
 '---','',
 '## 1.3.5.2 更新记录'
].join(nl);
if(!readme.includes('## 1.3.5.2 本轮更新'))throw Error('README section anchor changed');readme=readme.replace('## 1.3.5.2 本轮更新',()=>section);
const oldCurrent='（网页／源码当前为 1.3.5.2；本轮未更新客户端 OTA）';if(!readme.includes(oldCurrent))throw Error('README current-status anchor changed');readme=readme.replace(oldCurrent,'（当前本地源码为 1.3.5.3，待发布；公开版本以实际发布记录为准）');fs.writeFileSync(readmePath,readme);
// Load only definitions. The release command itself remains unchanged on disk.
const releaseFile=path.join(root,'scripts/release.js'),releaseSource=fs.readFileSync(releaseFile,'utf8'),cut=releaseSource.lastIndexOf('(async function main()');if(cut<0)throw Error('release entrypoint missing');
process.argv.push('--version',version,'--version-code',String(code),'--notes',notes);
const releaseModule=new Module(releaseFile,module);releaseModule.filename=releaseFile;releaseModule.paths=Module._nodeModulePaths(path.dirname(releaseFile));
releaseModule._compile(releaseSource.slice(0,cut)+'\nmodule.exports={gatePrepareVersion,gateChangelog,fanOutVersions,syncGeneratedAndroidVersion,refreshBaseline,gatePreparedVersion};',releaseFile);
const release=releaseModule.exports;
release.gatePrepareVersion();release.gateChangelog();release.fanOutVersions(code);release.syncGeneratedAndroidVersion();
cp.execFileSync(process.execPath,[path.join(root,'scripts/build-native-preparation-manifest.cjs'),'--write'],{cwd:root,stdio:'inherit'});
process.env.TIANMING_RELEASE_TEMP_ROOT='D:/Codex-Deliverables/edict-feedback-fix-20260926/temp';release.refreshBaseline();release.gatePreparedVersion(true);
const after={};for(const rel of files)after[rel]=sha(fs.readFileSync(path.join(root,rel)));const indexAfter=sha(fs.readFileSync(index));if(indexAfter!==indexBefore)throw Error('Unexpected index modification');
const receipt={version,versionCode:code,semver:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,updatedAt:new Date().toISOString(),before,after,indexBefore,indexAfter,indexUnchanged:true,releaseScriptSha256:sha(fs.readFileSync(releaseFile)),mode:'local-metadata-only',published:false};
fs.writeFileSync(path.join(__dirname,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({version,versionCode:code,files:files.length,indexUnchanged:true}));
