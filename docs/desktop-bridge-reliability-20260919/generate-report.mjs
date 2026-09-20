import fs from 'node:fs';
const dir='docs/desktop-bridge-reliability-20260919',v=JSON.parse(fs.readFileSync(dir+'/verification.json','utf8'));
if(!v.complete||!v.ownDiffClean||v.scopedDiff.exit||v.files.some(r=>!r.hashMatches||r.syntax)||v.qualityChecks.some(r=>!r.ok)||v.newFailures.length||v.newArchitectureFailures.length||!v.nativeCurrent||!v.native.ok)throw Error('Final verification has not closed');
const cases=v.newTests.reduce((n,r)=>n+JSON.parse(r.detail).pass,0);
const text=[
'# 天命：桌面分卷桥接的有界等待与回执保护',
'## 本批结果',
'本批补齐分卷暂存、发布、丢弃、读档恢复以及桌面时间线引用查询的等待边界。目标是在桌面进程不回应时结束本地等待，同时保留判断提交结果所需的证据，不把超时当成远端取消，不重复发送尚未确认的同事务操作。没有减少推演阶段、正文或记忆，也没有降低世界提交检查。',
'项目：`C:\\Users\\37814\\Desktop\\tianming`。设备：LAPTOP-AV4J1O7I。分支：`'+v.branch+'`。开工与结束 HEAD：`'+v.head+'`。核验时间：'+v.at+'。',
'未调用真实付费 AI API，未访问玩家真实数据库或分卷目录，未安装依赖、提交、推送、打包或部署。原有工作区改动保留。',
'## 一、实现与安全边界',
'**每次桌面桥接等待默认 60 秒。** 正常结果仍需要真实回执；超时只是停止本地等待，并不声称已经取消主进程中的磁盘工作。相同战役、时间线与事务的操作在前一调用尚未返回时不得重发或交叉执行，即使本地已经超时。同一页面最多保留 32 份未确认操作，达到上限明确拒绝新调用，不能丢弃旧状态后假装可以无限重试。',
'**暂存失败仍阻断主存档提交。** 不能因为桌面分卷没有响应而省略分卷、降低成功门槛。暂存回执超时之后，即使迟到成功，也不把旧响应补进已经退出的当前调用；可能留下尚未发布的暂存文件，本批不擅自删除这些不明状态文件。',
'**发布超时保留已经提交的世界和持久化回执。** 原有最终化函数继续展示完整结果，并使用原有读档恢复入口处理待发布分卷。只有主进程确认发布、当前世界身份仍匹配且回执清理成功，才能清掉当前待发布标记。主进程完成但回执丢失的情况，不能因此重新推演整回合。',
'**丢弃操作必须得到确认。** 原版在丢弃失败后也会在 finally 中删除回执并清空标记。本批改为确认成功之后再清理；已确认主存档提交的分卷禁止走丢弃路径。主进程回执带有事务、时间线等身份字段时也必须匹配，不能用其他事务的成功结果清理当前证据。',
'**读档恢复继续保持必要屏障。** 恢复失败或超时仍然阻止依赖该恢复的加载流程，不以跳过分卷来宣称完整恢复；原有轻量回执和旧式内嵌标记兼容路径保留。未来回合和其他战役的回执不会发送给当前恢复。',
'**引用查询失败时保守保留。** 桌面引用列表不响应、不完整或管理组件尚未加载时，视为仍可能被引用，跳过辅助数据清理，而不是按空列表删除。',
'**异步身份保护。** 校验摘要、桥接返回和回执清理边界核对世界、加载代次与桌面连接。旧世界回调不得清理新世界的标记。接口协议版本仍为 2，没有修改主进程协议或扩大 preload 暴露权限。',
'诊断可通过 `TM.Endturn.Reliability.bridgeDiagnostics()` 查看，最多十二条事件及未确认请求数量，不包括存档名称、完整请求、人物正文或密钥。期限是本地异步阶段限制，系统挂起或事件循环阻塞可能使计时事件延迟。',
'## 二、实查与真实 Electron 验证',
'前后故障对照复现：旧代码在分卷暂存没有回执时一直等待；旧代码丢弃分卷被拒绝后仍丢失回执和暂存标记。本批分别增加期限失败路径和确认后清理路径，见 `reproduced.json`。',
'使用本机已有 Electron '+v.native.versions.electron+'、独立新建配置目录、合成分卷数据和本地文件页面进行了真实 IPC 验证。主进程直接使用未改动的 `main-turn-data-commit.js`，跨进程调用使用测试专用最小 preload 包装；不是完整生产 preload 或游戏 UI 的端到端验收。测试禁止网络导航，未读取日常浏览器配置。',
'真实通信和磁盘操作检查 '+v.native.checks+' 项通过：暂存不提前公开、完整上下文与正文保存、重复恢复幂等、主进程已经写完但回执仍延迟、超时不当成功、未确认时不重复发送、迟到回执只释放等待锁、再恢复得到原始完整文件、未提交暂存不被发布等。超时事件在测试页面手动触发，没有修改生产 60 秒期限。独立配置和测试文件目录在进程退出后清理。',
];
text.push('## 三、回归与质量检查');
text.push('| 检查 | 结果 |\n|---|---|\n| 开工同范围专项 | '+v.baseline.pass+'/'+v.baseline.selected+' 通过 |\n| 最终同范围及新增专项 | '+v.final.pass+'/'+v.final.selected+' 通过 |\n| 新增故障与集成场景 | '+cases+' 组通过 |\n| 扩展回归 | '+v.extended.pass+'/'+v.extended.selected+' 通过 |\n| 质量边界对照 | '+v.qualityChecks.filter(r=>r.ok).length+'/'+v.qualityChecks.length+' 通过 |\n| 真实 Electron IPC 与磁盘检查 | '+v.native.checks+'/'+v.native.checks+' 通过 |\n| 本轮 '+v.files.length+' 个文件的语法、哈希及差异检查 | 通过 |');
text.push('质量对照包括本批没有改写的 LLM/Agent 主推演、有效性门槛、管道、响应复用、传输、快照、主进程分卷提交器和 preload 文件，以及完整存档构造、主库写事务、最终化与正文渲染等函数。具体哈希和函数对照见 `verification.json`。没有减少模型调用的必要推演内容，也没有缩短输出预算。');
text.push('已有隔离测试补充加载实际桥接管理模块，保留“完整双槽提交、恢复失败阻断、只删除轻量回执”等断言；新增用例覆盖永不返回、超时后迟到回应、重复请求限制、错误身份、切换世界、拒绝丢弃、旧式恢复、引用查询保守保留和真实最终化函数。');
text.push('扩展回归未通过：`'+v.failures.join('`、`')+'`。该脚本仍是此前已有的启动契约失败（实际 420 个脚本，要求 436 个）；本批没有修改启动清单、减少预期数量或增加豁免。');
text.push('架构检查仍有 `'+v.architectureFailures.join('`、`')+'` 失败，与本批基线类别相同，没有新增失败类别。整仓不是发布全绿；本轮使用主题筛选测试，不声称已经运行全部 smoke。');
text.push('## 四、尚未覆盖的范围');
text.push('本批只处理上述五项分卷与引用接口，不宣称全部 Electron IPC 已有期限。桌面自动档写接口、用户对话框、其他外部桥接、跨刷新响应复用及未知磁盘结果自动对账没有因此全部完成。未收到暂存确认时可能保留未发布文件，未恢复完整分卷时也可能需要排除磁盘或进程问题后再操作。');
text.push('测试不包含真实付费模型长局、完整游戏 UI 或手机真机。真实 Electron 验证证明的是该桥接路径与真实主进程文件提交器可以按预期协作，不是整个已安装客户端验收。未测量真实玩家整体回合速度或成功率，不把关闭无限等待换算成整体快了多少倍。');
text.push('## 五、文件与证据');
text.push(v.files.map(r=>'- `'+r.file+'`').join('\n'));
text.push('证据目录：`docs/desktop-bridge-reliability-20260919/`。关键记录：baseline.json、changes.json、baseline-tests.json、final-tests.json、extended-tests.json、final-architecture.log、verification.json、reproduced.json、electron-result.json、electron-cleanup.json。');
text.push('修改前备份：`.bak-desktop-bridge-reliability-20260919/`。后续操作前核对文件 SHA，不重复执行补丁，不整目录恢复覆盖其他窗口改动。');
text.push('技术参考：Electron 官方 ipcRenderer.invoke 与 ipcMain.handle 文档。invoke 返回由主进程回应决定的 Promise；本批本地期限不等同于远端取消协议。来源：`https://www.electronjs.org/docs/latest/api/ipc-renderer`、`https://www.electronjs.org/docs/latest/api/ipc-main`。');
fs.writeFileSync(dir+'/README.md',text.join('\n\n')+'\n','utf8');console.log('Report written:',dir+'/README.md');
