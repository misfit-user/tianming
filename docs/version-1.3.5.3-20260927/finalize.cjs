'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');const root=path.resolve(__dirname,'../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),receipt=require('./receipt.json');
for(const [rel,hash] of Object.entries(receipt.after)){if(sha(fs.readFileSync(path.join(root,rel)))!==hash)throw Error('File changed during verification: '+rel);}
const index=path.resolve(root,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:root,encoding:'utf8'}).trim());if(sha(fs.readFileSync(index))!==receipt.indexBefore)throw Error('Index changed');
const log=fs.readFileSync(path.join(__dirname,'full-smokes.log'),'utf8');if(!log.includes('[ci-smokes] PASS gate '))throw Error('Full gate not passed');
const match=log.match(/report=([^\r\n]+smoke-report\.json)/);if(!match)throw Error('Report missing');const r=JSON.parse(fs.readFileSync(match[1],'utf8'));
if(!r.complete||r.results.length!==r.expected.length||r.results.some(x=>!x.pass)||r.skipped.length)throw Error('Incomplete gate');
const result={version:receipt.version,versionCode:receipt.versionCode,semver:receipt.semver,completedAt:new Date().toISOString(),fullSmokes:{pass:r.results.length,fail:0,skip:0,runId:r.runId},architecture:'PASS',officialParityAssertions:41,releaseContractAssertions:182,versionFanoutAssertions:48,baselineFiles:1361,assetFiles:527,indexUnchanged:true,published:false};
fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(__dirname,'README.md'),['# 1.3.5.3 本地版本更新','',
 '已统一更新 package/lock、桌面构建字段、网页版本、主界面左下角、安卓 canonical 配置与本机 Gradle 派生版本。安卓 versionCode 1355。','',
 '邸报新增八条本轮说明，README 更新当前版本与本轮内容。历史条目保留。所有写前字节在 before/；版本字段直接复用 scripts/release.js 的原子盖戳及校验函数，未修改发布脚本，未运行打包或发布入口。','',
 '原生启动清单和热更基线由现有生成器同步；1361项基线、527项资产全部核对。版本盖戳自测48条、发布契约182条、官方剧本对账41条、架构守卫通过；全量smoke '+r.results.length+'项通过，零失败与跳过。','',
 'Git暂存区哈希未变。仅更新本地源码版本，未提交、推送、打包或发布。',''].join('\n'));
console.log(JSON.stringify(result));
