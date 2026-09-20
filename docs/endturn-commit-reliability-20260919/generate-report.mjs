import fs from 'node:fs';
const dir='docs/endturn-commit-reliability-20260919',v=JSON.parse(fs.readFileSync(dir+'/verification.json','utf8'));
if(!v.testsComplete||v.files.some(f=>!f.hashMatches||f.syntaxExit)||v.qualityChecks.some(q=>!q.ok)||!v.ownDiffClean||v.scopedDiff.exit||v.newFailures.length||v.newArchitectureFailures.length)throw Error('Scoped verification not closed');
const cases=JSON.parse(v.newTests[0].detail).pass,b=v.benchmark.summary;
const paragraphs=[
'# 天命：主存档提交确认与无损收尾提速',
'## 本轮结果',
'本轮完成主存档提交回执、附加快照故障隔离和提交后的并行收尾。目的是减少已完成推演被错误当成保存失败，以及正常存档阶段的串行等待，不减少模型推演、正文、记忆、世界校验或保存内容。',
'项目：`C:\\Users\\37814\\Desktop\\tianming`。设备：LAPTOP-AV4J1O7I。分支：`'+v.branch+'`。开工与结束 HEAD：`'+v.head+'`。最终核验：'+v.at+'。',
'没有调用真实付费 API、操作玩家真实存档、安装依赖、提交、推送、打包或部署。修改前备份与工作区既有改动均保留。',
'## 一、已复现的错误边界',
'通过提取本地实际 `_endTurn_saveSnapshot` 函数并注入模拟存储/附加快照响应，复现两条路径：主存档已经写入两个槽位后，附加快照抛出异常，原函数仍返回 false；附加快照等待期间切换世界，原函数仍返回 true 并写入旧回合的保存标记。这里是源码级故障模拟，不是对玩家真实文件进行故障注入。',
'修改后，第一条路径返回主存档已提交，并记录附加快照警告；第二条路径保留已经提交的旧档数据，但拒绝向新世界发布旧标记。原始前后对照见 `reproduced.json`。',
'## 二、实现内容',
'**明确主存档的提交结果。** 为批量保存增加可选的提交回执通知。IndexedDB 路径在事务完成事件后通知；localStorage 回退路径在双槽数据和已提交日志落定后通知。回执包含本次事务 ID、槽位、战役、时间线和回合，不把请求入队或某一次 put 完成当成整个批次成功。',
'**区分主存档与附加任务。** 附加时间快照异常或返回失败，不再抹掉已经确认的主存档提交。已有的主存档 false/异常路径和必要回合任务失败仍然阻断，不因这轮优化开放半提交成功。回合有附加快照问题时会提示，错误明细留在控制台；本轮没有承诺已自动修复失败的附加快照。',
'**正常收尾减少串行等待。** 主存档确认提交后，旧档辅助记录清理与附加时间快照可以重叠进行。保存流程仍等待两者结束，没有删除其中一项，也没有把未完成任务冒充已完成。附加快照继续读取同一份已冻结的完整世界数据，不重新读取变化中的 live GM/P。',
'**切档与事务防护。** 异步附加步骤之后再次检查世界身份；已经确认提交的本事务不允许被后续异常回滚成旧世界。暂存结果展示抛错不会阻断已提交事务的收尾。桌面基线接纳异常会报告，不再因此直接中断后续正文展示。',
'**存储回退细节。** localStorage 已提交日志的清理失败不会重新还原旧值，日志保留为已提交状态，后续按既有恢复流程清理；批量 put 同步抛错时会尝试中止该事务。提交通知自身同步或异步报错被隔离，不改写主存档结果。',
];
paragraphs.push('## 三、质量边界与测试');
paragraphs.push('本轮对普通 LLM 推演、独立 Agent 推演、正文/结果完整性、模式契约、回合管道、上一轮响应复用、API 传输和时间快照实现做了文件哈希对照，九个文件保持不变。另外核对原始 canonical payload 构造、分卷暂存和发布、正文渲染、事务快照和提交前准备等函数未被改写。');
paragraphs.push('| 检查 | 结果 |\n|---|---|\n| 开工同主题回归 | '+v.baselineTests.pass+'/'+v.baselineTests.selected+' 通过 |\n| 最终同范围加新增测试 | '+v.finalTests.pass+'/'+v.finalTests.selected+' 通过 |\n| 新增故障与集成场景 | '+cases+' 组通过 |\n| 质量边界对照 | '+v.qualityChecks.filter(q=>q.ok).length+'/'+v.qualityChecks.length+' 通过 |\n| 本轮文件 | '+v.files.length+' 个，语法与最终哈希校验通过 |\n| 本轮范围 git diff --check | 退出码 '+v.scopedDiff.exit+' |');
paragraphs.push('新增场景覆盖：提交前不通知、提交后单次通知、主事务中止、同步 put 失败、提交通知异常、localStorage 日志清理失败、部分回退恢复、附加快照拒绝或空结果、异步期间切档、两项后处理并行且仍被等待、必要记忆任务失败、真实最终化函数与回滚保护等。测试执行项目源码函数，网络、数据库事件和部分外部组件使用测试桩，不是浏览器/Electron 真机全流程验收。');
paragraphs.push('原始测试与质量对照见 `final-tests.json` 和 `verification.json`。本轮未通过删正文、填空结构、减少推演阶段、降低校验门槛或缩减输出预算来提速。');
paragraphs.push('## 四、受控耗时对照');
paragraphs.push('| 存档收尾样例 | 修改前 | 修改后 |\n|---|---:|---:|\n| 三次模拟中位耗时 | '+b.beforeMedianMs+' 毫秒 | '+b.afterMedianMs+' 毫秒 |\n| 完整主存档与时间快照内容 | 一致 | 一致 |');
paragraphs.push('旧档清理与附加快照分别注入 50 毫秒延迟；修改前串行等待，修改后在主事务确认提交后重叠执行。全部正文和世界状态的哈希一致。该结果只衡量受控的保存收尾等待，不代表真实游戏整体快一倍，也不代表玩家成功率已达到某个百分比。');
paragraphs.push('## 五、仍未完成的范围');
paragraphs.push('架构检查仍有 `'+v.architectureFailures.join('`、`')+'` 失败，与开工的失败类别相同，没有新增失败类别。这些依赖、模块边界、文件规模和引用问题不属于本批已经关闭的范围。本轮按主题运行测试，不宣称整个仓库、全部启动入口或正式发版门禁全绿。');
paragraphs.push('本批没有实现跨刷新或跨重启的推演阶段恢复，也没有把结果不明确的持久化失败自动重放。上一轮完整响应恢复规则未变。附加快照永久阻塞的处理、正常推演调用依赖图的全面重排和真实模型长局的性能/成功率测量，仍不能算作已完成。');
paragraphs.push('未执行用户付费 API、手机真机或 Electron 客户端长局验收，没有提交、推送、打包或发布。当前改动只在本地工作区。');
paragraphs.push('## 六、文件与证据');
paragraphs.push(v.files.map(f=>'- `'+f.file+'`').join('\n'));
paragraphs.push('报告和证据目录：`docs/endturn-commit-reliability-20260919/`。关键记录：`baseline.json`、`changes.json`、`baseline-tests.json`、`final-tests.json`、`baseline-architecture.log`、`final-architecture.log`、`reproduced.json`、`benchmark.json`、`own-diff-check.json`、`verification.json`。');
paragraphs.push('修改前备份：`.bak-endturn-commit-reliability-20260919/`。后续操作前核对当前 SHA，不重复运行已应用补丁，不整目录还原并覆盖其他窗口修改。');
fs.writeFileSync(dir+'/README.md',paragraphs.join('\n\n')+'\n','utf8');console.log('Report written:',dir+'/README.md');
