'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),log=fs.readFileSync(path.join(__dirname,'installed-full-smokes.log'),'utf8');
const header=log.match(/\[ci-smokes\] run=([^ ]+) HEAD=([^ ]+) report=([^\r\n]+)/);assert(header,'CI header missing');
assert(log.includes('[ci-smokes] PASS gate '),'Full CI has not passed');
const report=JSON.parse(fs.readFileSync(header[3])),gates=JSON.parse(fs.readFileSync(path.join(__dirname,'installed-gates/results.json')));
assert.equal(gates.length,4);for(const g of gates)assert.equal(g.exitCode,0,g.name);
const evidence=require(path.join(root,'web/scripts/lib-smoke-evidence'));
const full=evidence.validateReport(report,{runId:header[1],head:header[2],tests:evidence.discover(),runnerExit:0});
const installation=JSON.parse(fs.readFileSync(path.join(__dirname,'installation.json')));
for(const row of installation.installed)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,row.path))).digest('hex'),row.sha256,'installed source drift '+row.path);
assert.equal(installation.indexBefore,installation.indexAfter);
fs.copyFileSync(header[3],path.join(__dirname,'installed-ci-report.json'));
const result={verifiedAt:new Date().toISOString(),source:root,version:JSON.parse(fs.readFileSync(path.join(root,'web/version.json'))).version,fullSmokes:full,gates,installedFiles:installation.installed.length,indexUnchangedDuringInstall:true,published:false,playerSavesModified:false};
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2));
const md=`# 财政、阶层与党派修复交付

本地补丁已安装并验证。版本保持 ${result.version}；未打包、推送或发布热更，未修改玩家存档。

## 修复内容

- **财政**：民心联动不再用无周期估算覆盖已结算收入；旧存档显示从真实流水恢复。右栏、详情和顶栏采用一致的实际/预计与期间口径。真实零保留为零，缺失流水显示“待核”；Native 财政已实支 0、欠付 10 的状态不会被显示成实支 10。
- **阶层**：欠饷、地方风险、腐败按身份与本国地域暴露确定受影响对象；运行扫描和 AI 结果入口一致，排除外国、退役等不相关身份。地方风险按人口覆盖计算，生态关键词不再扩大已明确的数值受影响名单。
- **恢复**：满意度事件使用每回合净变动上下限。50 扣 14 后再加 10，正确得到 46；旧存档预算保守迁移，不因读档重发额度。
- **开局**：役政只派生初始视图，不提前结算满意度、人口、政策倒计时等；天启自耕农保持剧本设定的 26。
- **党派**：凝聚力保留小数与合法零值，近账记录实际增减。82 连续两次各减 0.5 得 81，连续两次各加 0.5 得 83。校准结果去重合并，同批或同回合不能绕过限制直接归零。

真实的腐败、欠饷、民生危机及社会行动成本仍会降低相关阶层数值。这次修复不自动补回旧存档中已被错误扣掉的历史满意度；没有玩家原档，无法精确区分每笔历史损失与正常机制。

## 验证

| 检查 | 最终结果 |
|---|---|
| 安装后全量 CI smoke | ${full.total} 项；通过 ${full.pass}，失败 ${full.fail}，跳过 ${full.skip}，豁免 ${full.waived} |
| 架构守卫 | 全部通过 |
| 官方剧本派生对账 | 通过 |
| 发布契约 | 通过 |
| 热更基线逐文件校验 | 通过 |
| 安装后文件哈希 | ${installation.installed.length} 个文件全部匹配已验证候选 |

新增关键回归包括财政 62 条、顶栏 29 条、满意度/党派 16 组（含 64 组旧预算历史组合）、阶层目标范围和完整官方开局无额外结算。正式天启启动后的三次财政隔离结算中，消费者处理后收入摘要与真实账本一致，库存不发生额外变动。

全量门禁使用未跳过、未重试的 CI 入口。旧测试中固定函数签名、固定源码写法、依赖偶然开局奏疏的三个假设已改为确定的行为验证；开局正文保护另通过 5 次重复和反向对照；共享 node_modules 导致的 npm 路径盘点失败通过在真实主目录复验解决，没有删除断言或降低门禁。

## 本地安装与证据

仅按清单同步 ${installation.installed.length} 个文件。写入前检查原哈希，写入后回读，原 Git 索引保持不变；原文件备份在 [before-install](before-install/)。其他已有修改保持原样。

脚本缓存戳与原生启动清单已同步；热更基线由项目生成器按当前版本重新生成。原有 495 条 assets 清单的路径与哈希全部保留。重新加载本地游戏后使用新代码。

- [最终机器可读验证](verification.json)
- [安装后全量报告](installed-ci-report.json)
- [安装后门禁结果](installed-gates/results.json)
- [同步清单与哈希回执](installation.json)
- [财政修后复现](fiscal-fixed-results.json)
- [阶层修后隔离实验](class/class-after-results.json)
- [阶层修复说明](class/HANDOFF.md)
- [党派修复与预算迁移说明](party-fix.md)

验证时间：${result.verifiedAt}。
`;
fs.writeFileSync(path.join(__dirname,'README.md'),md);console.log(JSON.stringify(result));
