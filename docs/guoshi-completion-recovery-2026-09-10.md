# 国师升级第二批：如实收尾与同案卷续做

## 范围和代码基线

- 工作树：`C:/Users/37814/Desktop/tianming-perf-round1`；分支：`codex/guoshi-recovery-completion`。
- 实际起点：`b6b571b5020478a9babed3ef35dd31c7f0e623db`。开工获取的 `origin/main` 仍为 `f102b56585faa48c47d362a91c5260f4cee1b8eb`。
- 功能提交：`e91a2078182df4faf3decfbdcef87816fbc4f03c`，12 文件，+713/-163。本报告与结构化证据随后单独提交，不改变被测执行源码。
- 起点已经包含六个本地 SSE/案卷权限及文档提交：`8b86ddcf`、`8894e1b7`、`67895fd1`、`82477266`、`256f6373`、`b6b571b5`。本分支相对 main 不只是本轮差异；独立建筑分支 `codex/building-channel-hardening@f3d2086c` 没有混入。
- 只做本地代码、回归和提交。原 `tianming` 工作树和其他分支未被覆盖；未推送、未合并、未改版本、未打包或发布；未使用玩家案卷/账号/真实付费 API。

## 本轮改动

| 路径/函数 | 实际行为及不变量 | 测试 |
| --- | --- | --- |
| `web/editor-authoring-agent.js`：`_toolStateJson`、`_hashStateJson`、`runAuthoringLoop` | 写回执的 changed 比较完整的受影响区段序列化值，不再用约97个采样点推断相等；紧凑 hash 只用于指纹。`applyEdit` 额外回读实际规范化目标；被忽略的 setter 不能显示成功。完整比较缓冲不进入回执或对话。 | 同长度 Unicode 改动、真 no-op、忽略 setter、正常 detached draft。 |
| 同文件：`_writeTargets`、finish 分支、run-local todos | 记录未解决的失败写入；无关成功不能冲销。相关目标修复后才放行；未完成 todo 不能靠反复 finish 清空。允许明确 `partial` / `blocked`，不会标为 completed。保留原结构/增量质量/权限门禁和有限尝试预算。 | 失败→假完成被拒、失败→修复→完成、并发任务不清掉彼此 todo、结构与质量负例。 |
| 同文件：`_makeResume` / `_readResume` / `canResume` | opaque、单次使用、仅内存的恢复句柄绑定相同 draft 引用与内容，保留会话、任务、回执、待批准副作用和开工前质量基线。复制句柄、换 draft、外部修改、重复使用不能发起调用；恢复不能把已引入的错误洗成旧基线。 | 异常部分结果、单次消费、模式不符拒绝、原质量基线、取消后续做。 |
| 同文件：`runOrchestrated` / `runWithCritics` | 不完整子任务阻止后续步骤；续做不重新执行已完成的计划/子任务/拟稿/评审。缺评审报告不等于“没有问题”。并行评审都落定才归还 UI。 | Node 及实际 Electron 的编排中断、评审失败、成功阶段调用次数与条目数。 |
| `web/editor-authoring-agent-ui.js`：`_runOwned`、`_recoveryReady`、`_recoveryButtons`、`onApply` | 失败保留原草稿；区分“继续未完成部分”与两次确认的“从当前剧本重新生成”。案卷、加载身份、revision、live 基线变化均拦截直接续做；历史错误按钮不能操作新任务；问策不能恢复旧写入权限。未完成结果不自动应用；手动应用部分结果需明确确认并继续标注任务未完。 | 同案卷真实 IndexedDB 保存/重读、手工输入、跨项目/历史按钮、连续点击、权限变化、自动/部分应用。 |
| 同 UI：`_commitPendingSideEffects` / `onApply` | 只生成记忆/技能时也能明确批准，不要求伪造一条剧本改动。暂存不称已持久化；提交失败保留待批准内容；成功不调用剧本提交器、不归一化 live 剧本。重复点击不会再次提交。 | 真实 localStorage 配额故障、恢复后批准、零剧本提交及原字节保留。 |
| core 对话收尾 | partial 收尾被用户插话撤回后，不污染下一次成功结果；停止后的未执行工具不留在恢复对话中形成孤立调用。 | 撤回 partial→完成；多工具响应停止→恢复时调用/结果配对。 |

新增运行方式：`node scripts/verify-electron-bridge.js --authoring-recovery`，并纳入现有 Windows Electron CI 作业。没有另建模型实现或伪造 `window.tianming`。本轮没有执行远端 CI。

## 兼容与恢复边界

1. 原来的 `finish({summary})` 仍兼容，默认要求 completed；原结构校验、范围/危险操作限制、只读工具授权没有放宽。`completed` 表示已通过工具与校验契约，不是证明 AI 已理解全部自然语言意图，更不是“已经应用到玩家剧本”。
2. **续做只支持当前页面、当前案卷实例中保留的草稿。** 刷新、进程崩溃、重新载入不具备这次新增的 opaque 句柄；历史对话仍按原会话机制保留，不冒充持久化任务恢复。
3. 手工编辑后拒绝直接续做，是保守策略。玩家可在同案卷明确放弃未应用草稿，再从最新 live 内容生成；不静默丢掉手工输入或把 A 的任务放到 B。
4. 明确批准部分结果会结束当前待应用草稿，剩余要求需另行提出；没有自动把旧任务重定位到新世界。已完成阶段不会由恢复器重放，但新一次模型若主动提出新写入仍走现有审阅流程，不宣称任意模型工具请求都能语义去重。
5. 失败目标匹配偏保守：同字段或同一批量操作重试能解决对应失败；换目标、改名等复杂改法可能需要明确说明 partial/blocked 或重新生成。没有“忽略失败即可完成”的新工具。
6. 副作用持久化复用既有本地存储提交器；本轮不是跨 localStorage/IndexedDB 的崩溃事务升级。复杂写工具的回执证明执行结果与观察到的区段变化；额外目标值回读目前针对 `applyEdit`，不宣称所有工具具备相同强度的语义证明。
7. 默认迭代/token/重试和自动续接上限未增加，未改游戏内容或持久化格式。无进展预算、长指令保真、上下文成本优化留到下一批；本轮没有 FPS、耗时或模型质量提升结论。

## 执行证据

机器可读索引：[guoshi-completion-recovery-20260910.json](evidence/guoshi-completion-recovery-20260910.json)。包含33次记录的完整命令、退出码、耗时、日志相对路径，最终12个文件 SHA-256、全量运行身份和7项具体豁免。

所有命令在修复工作树根运行，使用 `node scripts/perf/run.cjs <label> -- <下面的命令>` 留存 `run.json` / `stdout.log` / `stderr.log`。原始日志位于本机 `web/dev-tools/perf-round1/<索引中的目录>/`，没有声称已公开到远端。

环境：Windows x64；Node `v24.14.0`；锁定 Electron `33.4.11`（内部 Node `20.18.3`）；i5-13420H。Electron 使用独立临时 userData、真实 main/preload/provider/editor/IPC/IndexedDB，外部网络阻断，只注入模型响应和故障时序；是未打包运行环境中的 DOM 点击，不是原生 Computer Use 鼠标操作或签名安装包验收。

| 实际命令 | 退出码 / 结果 | 日志 label |
| --- | --- | --- |
| `node web/scripts/smoke-authoring-completion-recovery.js --source-ref b6b571b5020478a9babed3ef35dd31c7f0e623db` | 1；2 PASS / 20 FAIL。包括新恢复/结果契约尚不存在的断言，不等于20个独立旧 Bug。 | `guoshi-recovery-baseline-final-adapter` |
| 同脚本，不带 `--source-ref` | 0；22 PASS / 0 FAIL | `guoshi-recovery-core-final` |
| `node web/scripts/run-smokes.js --grep authoring --grep guoshi --grep agent-kernel --all --no-retry --jobs 2` | 0；17脚本 PASS，0 FAIL/SKIP/WAIVED | `guoshi-recovery-topic-final` |
| `node scripts/verify-electron-bridge.js --authoring-recovery --repo E:/tianming-perf-temp/guoshi-recovery-baseline` | 1；5桥接条件 PASS、12业务组 FAIL。实际加载 b6 基线原代码；包括新控制缺席及前序失败影响，不当作12个独立 Bug。 | `guoshi-recovery-electron-baseline` |
| `node scripts/verify-electron-bridge.js --authoring-recovery` | 0；17 PASS =5桥接+12业务组，0 FAIL | `guoshi-recovery-electron-final` |
| `node scripts/verify-electron-bridge.js --authoring-boundaries` | 0；20 PASS | `guoshi-recovery-boundaries-final` |
| `node scripts/verify-electron-bridge.js --authoring-stream` | 0；12 PASS | `guoshi-recovery-stream-final` |
| `node scripts/verify-electron-bridge.js` | 0；production12 + test-exports11 + restart6 PASS | `guoshi-recovery-desktop-final` |
| `node web/scripts/lint-arch-all.js` | 0；13守卫 PASS | `guoshi-recovery-arch` |
| `node web/scripts/sync-official-scenarios.js` | 0；2 sources /9 artifacts，未改变官方正文/派生物 | `guoshi-recovery-official-sync` |
| `node web/scripts/verify-official-scenario-parity.js` | 0；27 PASS | `guoshi-recovery-parity` |
| `node scripts/verify-release-contract.js` | 0；166 PASS | `guoshi-recovery-release-contract` |
| `node web/scripts/verify-hot-builder-gates.js` | 0；27 PASS（合成临时夹具，未发包） | `guoshi-recovery-hot-gates` |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | 0；686在场文件校验，保留410缺席资产条目 | `guoshi-recovery-hot-check` |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0；0 vulnerabilities | `guoshi-recovery-audit` |
| `node web/scripts/ci-smokes.js` | **0；929唯一结果，927 PASS /0 FAIL /0 SKIP /2 WAIVED（7具体资产检查）** | `guoshi-recovery-full` |
| `git diff --check` | 2；只报 preview HTML 的3个原 CRLF 行末 | `guoshi-recovery-default-diff-check` |
| `git -c core.whitespace=cr-at-eol diff --check` | 0；保留原逐行行尾，真实空格检查通过 | `guoshi-recovery-cr-diff-check` |

这些数字是不同层级的脚本/检查记录，不能相加成互不重复的完整游戏流程。全量成功是有明确资产豁免的门禁通过，不是零豁免全绿。

全量报告：`web/dev-tools/arch-guard/ci-0qf66Y/smoke-report.json`；runId `bca3ca70-6712-4dff-befe-a924e47cc6f2`。豁免仍限于 `smoke-audio-bgm.js` 的5个缺席音频、`smoke-mapeditor-ui.js` 的2个缺席字体；两脚本退出码都是0，其余断言继续执行。校验器/白名单/资产规则没有改动。

真实 Electron 原始报告分别是 `web/dev-tools/electron-bridge/` 下：

- 新恢复：`8891ea58-3f21-4a67-bde0-9b8024b1d2e3/report.json`
- 案卷边界：`7457c817-3462-4d4c-8015-554910bb7f4c/report.json`
- SSE：`a321c401-d436-4f90-bc2c-5dc19fe1a9bf/report.json`
- 桌面：`ae05afe8-6e00-4e01-9de8-7c0fd38b985f/report.json`

每份报告都检查完成标记、进程退出码、signal/error；没有用“报告通过”覆盖进程失败。

## 中间失败与测试调整

- 初次基线12组全部失败留在 `guoshi-recovery-baseline`；最终同一适配器扩大到22组，旧代码2个正常控制通过。测试通过 `git show <ref>:<真实源文件>` 或 `--repo` 调用原实现，不替换业务成功桩。
- 初版 core 的质量基线用例放了空 factions，实际 validator 没有可校验的势力集合；改为有合法 F 势力再注入坏引用。原失败保留在 `guoshi-recovery-core-initial`，未弱化生产校验。
- 旧 `smoke-guoshi-cc-port.js` 曾明确要求“第二次坚持 finish 就放行”。本轮改为有限三次后受阻，原未完成任务保留断言不删；两处越权编辑用例继续断言数据不变/正确拒绝，另要求不能宣称完成。只读成功用例仍通过。一次替换误命中只读断言已纠正，15/2及16/1的中间日志保留，最终17/0。
- 新边界测试先出现19 PASS/3 FAIL：只暂存记忆被说成未改、撤回 partial 状态残留、停止后的工具消息不配对；均保留 `guoshi-recovery-edge-before` 后实施修复。记忆-only实际 Electron 先13 PASS/2 FAIL，修复后通过。不是只用完成摘要自证。
- 最终基线适配器显式断言新契约存在，避免把 TypeError 当功能失败证据；评审暂停的测试桩用 finally 释放，失败也不遗留悬挂操作。没有降低验收不变量。

## 派生物、字节和交付状态

- 仅两个正式编辑器入口同步国师家族缓存戳；逐行恢复并核对原 CRLF/LF，未格式化全文件，未改中文脚本编码。
- 执行 `node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp`。官方生成器更新4个生产文件 hash/size及生成时间；总清单仍1096，保留410个资产条目。原资产目录只读使用；无版本/官方剧本正文/校验规则改动。
- 被测 HEAD 记录为 b6 + dirty tree，不伪称在后来的提交上执行。全量运行记录的12个 dirty file hashes 已逐一与功能提交 e91a2078 的 Git blob SHA-256核对一致；后续仅报告/证据文件不影响执行代码。
- **代码已本地提交、上述回归已执行；未推送、未合并、未发布。** 下一批可处理重复勘察、无进展预算与长指令保真；本轮到此收口。
