# 国师升级第一批：案卷归属与执行权限

## 范围与基线

- 工作树：`C:/Users/37814/Desktop/tianming-perf-round1`；分支：`codex/guoshi-project-boundaries`。
- 本轮起点：`67895fd168b6f729dbd6b67447f1142bb99d4824`。开工获取的 `origin/main` 为 `f102b56585faa48c47d362a91c5260f4cee1b8eb`。
- 起点包含上一轮三个本地 SSE 修复提交（`8b86ddcf`、`8894e1b7`、`67895fd1`），本次保留。另一个建筑分支 `codex/building-channel-hardening@f3d2086c` 没有混入。
- 本轮只实施优先的案卷隔离、原项目编辑、只读执行授权。不是整套国师升级已经完成。
- 本地实现与测试；未推送、未合并、未改版本、未发布。不操作真实账号、玩家存档或 API。
- 本轮功能提交：`82477266c4c1f5a72a3179e9fa38f9c75d21c75c`（19文件，案卷/权限及其测试）；验证器独立提交：`256f6373eab2abe0c75b63c4fa66c1e7a3fc0de1`（进程错误必须红及9组回归）。本报告随后单独提交，不改变被测执行源码。

## 实现与不变量

| 实现 | 修复内容 | 行为验证 |
| --- | --- | --- |
| `web/preview/scenario-editor-reset-app.js`：`captureDocumentLease` / `isDocumentLeaseCurrent` / `commitScenarioEdit` | 每次新建/导入/打开更换不持久化的加载身份；同案卷编辑保持身份。国师修改不再走导入接口，不清 `currentProjectId`、原始对比基线、玩家草稿和撤销历史。提交检查当前加载实例与 revision。 | 真编辑器应用→保存→IndexedDB 重新加载仍是同一案卷；原对比基线/手工草稿保留；同名同 ID 重载拒绝旧租约。 |
| 同文件：`saveProjectSnapshot` / `loadProjectSnapshot` | 迟到保存的 A 快照可以留库，但不能改变 B 的身份/dirty/原始基线；同案卷保存中发生新编辑也不清 dirty。两个载入逆序返回时，较新的打开意图优先。 | 实际函数注入存储暂停/失败，验证磁盘快照与活动案卷分别正确；真实 IndexedDB 验证正常路径。 |
| `web/editor-authoring-agent-ui.js`：`_runOwned` / `_commitCurrent` / `onApply` / 检查点 / 会话绑定 | 草稿、运行回调、自动续接、逐项应用、撤销/恢复使用共同案卷身份。旧响应不更新新案卷会话，不自动应用；检查点拒绝跨案卷恢复且拒绝时不弹栈。会话切换和手动压缩的迟到结果不覆盖新线程。 | A 任务在途加载 B，A 回包不能写 B/继续旧任务/绑定 B 会话；A 检查点不能覆盖 B；同案卷无关手工编辑保留、同路径冲突拒绝；新开 B 对话恢复正常编辑。 |
| `web/editor-fullgen.js`：`_beginLegacyEditorDocument` / `_mergeAndRenderScriptData`；core 两个 adapter | 旧编辑器就地合并 `scriptData`，所以增加真实加载令牌，不能只比引用或名字。旧/新宿主缺少安全协议时不退回导入覆盖。 | 实际旧载入函数保留对象引用但轮换身份，旧租约拒绝，新租约仍可编辑。此旧入口是模块级测试，未声称完整旧编辑器实机流程通过。 |
| `web/editor-authoring-agent.js`：`runAuthoringLoop` / `toolExecutionDenied` | 工具执行必须在本次实际工具集合中；只读模式还检查 registry 的 effect。拒绝结果保留 `tool-not-authorized` 回执。问策、审阅、问答、讲解不能写草稿/暂存记忆/发起生图；作者的正常编辑与共审待批准语义不变。 | 四种只读模式、无可选 kernel、显式工具子集、正常写入与记忆暂存、范围/危险操作保护、并行评审不能污染作者草稿。 |
| 同 UI：问策下的编排/会审入口 | 拦截包含实际拟稿的快捷入口，提示切共审/放行。玩家明确点击“批准并执行”仍可执行计划。 | 真实 UI 的问策→编排/会审不发起模型调用；问策→计划→明确批准仍生成待应用草稿。 |

所有正式页入口同步缓存戳；未手工维护第二套桥接/工具实现，未改变模型、轮数、上下文上限、游戏内容或持久化格式。

## 兼容和恢复限制

- 案卷库 `proj:<id>` 仍可通过真实项目载入恢复会话。
- 未入库草稿及旧编辑器使用当前加载实例键，不再把同名当作唯一身份。历史 `name:` / `file:` 弱键会话保留，可只读回看，不自动归属到同名新剧本。
- 同案卷普通保存保持加载身份；“另存副本”、重新打开同案卷也属于新的加载实例，旧待应用草稿/检查点不能静默覆盖。
- 迟到任务的恢复材料当前仅保留在本页内存，未绑定到 B；不承诺刷新恢复或自动重新应用到重新载入的 A。失败任务的完整续做属于下一批。
- 并非跨文件系统事务升级，也没有声称所有宿主编辑异常都具备完整业务回滚。本轮确认的是身份校验、已有字段冲突保护、正确项目关联和执行权限。

## 新增和适配的测试

- `web/scripts/smoke-authoring-tool-authorization.js`：11 组，实际 core/kernel/registry；后两组还调用实际旧编辑器加载函数。`--source-ref` 从 Git 读取被测实现，不替换旧夹具。
- `web/scripts/smoke-authoring-document-lease.js`：8 组，AST 取实际宿主函数；仅 DOM、存储适配器受控。并非完整 Electron 测试。
- `scripts/electron/authoring-boundary-cases.cjs`：正式 main/preload、真实 BrowserWindow、新工坊、默认 Agent/provider、真实 IndexedDB；只有模型回包和时序受控。20 个检查记录=5 个基础桥接+15 个业务组，不是20条互不重复的整局流程。
- `web/scripts/smoke-electron-gate-process-result.js`：9组调用实际验证器脚本的进程结果测试。在收尾实际遇到“报告完成、status=0，但 spawnSync 带 ETIMEDOUT”后，验证器改为同时拒绝 process error/signal；并未延长超时。旧代码同测7 PASS/2 FAIL，新代码9 PASS。
- 现有 Windows Electron CI 增加 `node scripts/verify-electron-bridge.js --authoring-boundaries`，缺运行时或失败不豁免。此次没有远端运行授权，CI 配置已修改不等于远端已通过。

旧测试适配没有降低断言：三个 caller 夹具明确提供被测 bulk/map/media/knowledge 工具包，避免靠越过清单调用；适配器测试改验新编辑协议并新增缺协议拒绝；旧文件键测试改验加载键并新增弱键拒绝；双编码测试将固定4200字符截取改为完整 AST 函数截取，33条旧断言全部保留，并补真实 UI 修复/丢弃计数控制。SSE Electron 请求明确写“批量”，提供其受控模型实际调用的 multiEdit，原39轮/失败/取消/保存恢复断言保持。

## 验证结果与原始日志

所有带证据的命令通过 `node scripts/perf/run.cjs <label> -- <command>` 执行；各目录内 `run.json` 记录 HEAD、工作区状态、被改源码 SHA-256、平台、Node、CPU、命令、退出码；`stdout.log` / `stderr.log` 保留原始输出。

最终全量报告：`web/dev-tools/arch-guard/ci-PYZyRY/smoke-report.json`，runId=`20feb181-c31e-472d-bee3-582118b353fb`。928个脚本实际执行，926 PASS、0 FAIL、0 SKIP、2 WAIVED（仍为7项具体缺席资产检查），exit0。未修改的工坊锁专项在本轮完整运行中通过（24.5秒是测试脚本耗时，不是玩家操作时间）。

测试时 HEAD 为本轮起点加记录的工作区源码；不能把起点 SHA 单独当作被测版本。全部执行源码/测试文件与最终结果按 SHA-256 校验一致，收尾仅补报告和本地提交，不冒充远端CI。

| 实际命令 | 已确认结果 | 原始证据（仓根相对路径） |
| --- | --- | --- |
| `node web/scripts/smoke-authoring-tool-authorization.js --source-ref 67895fd1` | 2 PASS /9 FAIL，含新增协议缺席断言，不是9个独立缺陷 | `web/dev-tools/perf-round1/guoshi-auth-legacy-baseline-781d7992-69c1-4876-90e4-ace7d12f72cc` |
| `node web/scripts/run-smokes.js --grep authoring --grep guoshi --grep agent-kernel --all --no-retry --jobs 2` | 16 PASS、0 FAIL/SKIP/WAIVED | `web/dev-tools/perf-round1/guoshi-boundary-topic-verified-3f582402-f2d3-44b4-888f-ce0e5eb19bef` |
| `node scripts/verify-electron-bridge.js --authoring-boundaries` | 严格验证器20 PASS，exit0，无进程error/signal | `web/dev-tools/perf-round1/guoshi-electron-quiet-3cd65b46-eded-40b2-9179-f228f252ea47` |
| `node scripts/verify-electron-bridge.js --authoring-stream` | 严格验证器12 PASS（基础5+业务7），无进程错误 | `web/dev-tools/perf-round1/guoshi-stream-quiet-aeb9a0b6-6d3f-45ba-989e-b0a64250a02a` |
| `node scripts/verify-electron-bridge.js` | 严格验证器 production12 / test-exports11 / restart6 PASS，无进程错误 | `web/dev-tools/perf-round1/guoshi-standard-quiet-56b2879e-d3ac-49df-b65b-f28d34f94f1a` |
| `node web/scripts/lint-arch-all.js` | 13 PASS | `web/dev-tools/perf-round1/guoshi-release-arch-8f77b96a-06b0-47d9-947a-25fb20b6048c` |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS | `web/dev-tools/perf-round1/guoshi-boundary-parity-836a0463-aa99-4e3b-b4db-27622e456fa0` |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS，隔离合成构建夹具 | `web/dev-tools/perf-round1/guoshi-boundary-hot-gates-a095beb1-a171-47c1-bd19-17953b33209e` |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 vulnerabilities，exit0 | `web/dev-tools/perf-round1/guoshi-boundary-audit-7f564e53-5719-4f72-822c-30533ec2ad3c` |
| `node web/scripts/ci-smokes.js` | 最终926 PASS /0 FAIL /0 SKIP /2 WAIVED，928执行，exit0 | `web/dev-tools/perf-round1/guoshi-final-full-0dca7186-c3e4-438a-a2ec-ed001d123ccf` |
| `node scripts/verify-release-contract.js` | 166 PASS，exit0 | `web/dev-tools/perf-round1/guoshi-release-contract-22fa3143-c654-403b-994a-255c1005a1a9` |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | 686在场文件逐项通过，保留410条缺席资产；exit0 | `web/dev-tools/perf-round1/guoshi-boundary-hot-check-verified-f68e07ba-cf0f-4026-bcc7-a0cf6b07e82a` |

首次失败也保留：权限正向夹具曾误用 memory 的 title/content（真实接口是 name/description/body）；Electron 夹具曾调用不存在的 newConversation/restoreCheckpoint 导出，已改为真实新对话按钮/restore；旧静态截取误报已上述修正。它们不是生产缺陷数量。额外真实 Electron 证明问策高级入口缺口：`guoshi-mode-entry-before-f022ebc8-72d7-4d1d-850d-ae458f56692e` 为18 PASS /2 FAIL；49/98次是受控响应下的调用数，不是实测玩家网络耗时。

中间完整回归曾为925 PASS /0 FAIL /2 WAIVED（927个），但它先于最后补修，不作为最终证据。后面两次完整运行出现未修改的 `smoke-workshop-lock-recovery.js` 准入超时，保留 `ci-s9aEHN` / `ci-Sl8NOB` 原报告；不放宽该测试。`guoshi-boundary-electron-verified-a7c67b20-9f3b-47a3-85b3-b5bc0e5ba827` 虽有20条完成断言，进程却报ETIMEDOUT，本报告不接受其旧验证器的ok=true作为门禁通过；最终采用严格验证器重新执行。

生成器：`node web/scripts/sync-official-scenarios.js` 没有改变官方真源/派生物；`node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp` 使用正式收集器，保留1096项及410项本 checkout 缺席资产。只同步源码哈希/字节数和生成时间，不盖新版本、不发布。原始玩家目录只读作资产来源。

混合行尾的 HTML 按原行保留 CRLF/LF。默认 `git diff --check` 对其中4个已有 CRLF 行末报 whitespace；`git -c core.whitespace=cr-at-eol diff --check` 通过。没有为消除提示转换全文件行尾；中文 PS1/BAT 未改。

## 尚未实施 / 未实测

- 下一批：失败写操作与 finish 的闭环、精确回执、partial 安全恢复；随后再处理无进展预算、长指令保真和效率。
- 没有真实外部模型/付费 API 调用，没有证明所有模型质量或费用改善；没有给出 FPS、耗时下降百分比。
- Electron 为 Windows 未打包开发环境、独立临时 userData、受控网络和 DOM 点击，不冒充原生 Computer Use 鼠标测试或正式安装包验收。
- 未触碰另一个未合并建筑分支、原工作树用户改动、版本号、真实存档或发布系统。
