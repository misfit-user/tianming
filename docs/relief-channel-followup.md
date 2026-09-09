# 赈务试点纠偏（本地，未发布）

起点 `a26665904802debc41a5068411dd5ff28d8002a4`，分支 `codex/relief-channel-followup`；读取并 fetch 后的 main 仍为 `14d477945f5ef78b913ed5f249b51c2002167d0f`。原工作树与此前三个提交保留。

## 1. 生产依赖

首次实际审计重现 1 中危 / 2 高危（退出 1）。高危来自 electron-updater 的 js-yaml 4.3.1，升级到兼容的官方 4.3.2，并通过 override 固定生产解析器；未升级 Electron 或 updater、未改游戏版本。

- [js-yaml 官方安全通告](https://github.com/advisories/GHSA-2883-xcg3-v3hh)列明 4.3.2 修复空 mapping 的 merge 工作量计数。
- [adm-zip 通告](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9)截至核验没有修复版本。当前 main 热更/工坊解压已用受限流式 yauzl，仓内 adm-zip 引用仅在构建、制品读取和测试工具中，没有 extractAllTo/extractEntryTo 调用。因此改列 devDependency，使其不再装入生产依赖闭包，而非添加漏洞豁免或改包名。

验证：实际 electron-updater 的 parseUpdateInfo 仍可读中文 releaseNotes、files、size 与 hash；过量空 merge 被拒绝、正常小 merge 保持；npm 实际 runtime closure 中无 adm-zip；既有 ZIP 配额、类型、签名、IPC 安全回归保持。

范围说明：`npm audit --omit=dev` 为 0 漏洞。包含开发依赖的 audit 仍有告警（安装时 1 中危 / 14 高危 / 1 严重）；不把本次生产闭包修复说成全仓所有开发工具零漏洞。后续壳层安装包才能交付依赖变化，本次不构建、不发布。

原始证据位于 `web/dev-tools/perf-round1/relief-followup-*`，最终索引待本轮全部验证后填写。

首次新增测试失败保留：旧解析器不对空 mapping 计费。升级后的第一次回归用 101 个 merge 源先撞到现有单序列上限，而不是待验证的累计上限；改为每组 100 个、101 组，保持累计过量不变量，实际检验新增的累计计费。没有移除异常断言。

## 2. 操作流程纠偏

独立立案表、确认筹款、改派/撤止等按钮偏离已约定的操作流程。移除这些入口及试点独占结算；履行单只汇总已有诏令、御批、信函及朝会廷议记录。财政、人事、民心仍由原来的渠道和正式执行器负责，不让查看履行单产生新命令、重复扣款或自动奖励。

上一版私有现金试点的 API 与相应专项属于被撤回的设计，不再作为当前玩法验收依据；回归改为覆盖原渠道和只读不变量。已有试验存档里的流水只保留、提示，不猜测成正式渠道数据，也不自动退钱。

| 旧渠道 | 实际入口与读取来源 | 不能越过的步骤 |
| --- | --- | --- |
| 诏书 | `_endTurn_collectInput` → `_edictTracker`；整篇颁行稿读取 `GM.edicts` | 输入/留档草稿不算已颁行；观察不触发执行 |
| 奏疏批复 | `_approveMemorial` / `_annotateMemorial` → `_stageMemorialDecision` → `_commitMemorialDecisions` | 回合内御批先暂存，可改驳；提交不等于执行完成 |
| 鸿雁传书 | 原 `letterId` → `_ltApplyFormalPolicyOnDelivery` → `EdictParser` / `EconomyLinkage` / `FiscalEngine` | 信函到达后仍走旧执行器；在途/被截/受阻不能被督查提前结算 |
| 朝会廷议 | `_cc3_writeActionToGM` / `_cc3_applyCourtPolicyBridge`、`_ty2_decide` | 留中、延期、未颁行裁决与准奏分别展示，读记录不追加调拨 |

`web/tm-relief-governance.js` 现在只有 `list/resolve/channels` 只读接口，返回有来源的短投影；不创建 `currentIssues`、不持有全局定时器、不建立第二本钱账。查看原文按源对象与世界代际校验，重名与不同 ID 分开，缺乏精确凭据时显示未记录，不从金额文字猜账。

`web/tm-relief-governance-ui.js` 保留御案字体/配色（依前端设计技能约束），只提供展开、分页、刷新和回到四个原渠道的导航，不自动填字、发诏、批奏或发送信函。两份脚本仍按需加载：409 eager / 8 deferred，没有新增启动脚本。

原 `tm-fiscal-engine.js`、`tm-endturn-agent-mode.js`、`tm-endturn-systems.js`、`tm-save-lifecycle.js` 的试点接管全部撤回，与试点前 main 对应文件一致。诏书 AI 及原财政/人事/民心执行器负责结果，不改成传统随机事件。督查仍用原来的开关、15 条批次和一次重试；查看履行单不会开启 AI 调用。保留实际批次单航班、换局/取消与源记录变化拦截，建议只记入原追踪条目。

这是对错误接入方式的收缩，不冒充已实现全新的政治/赈务机制；后续玩法增强仍须在原渠道内部增加因果、执行与回报。

## 3. 验证与真实边界

- 来源与原流程 17 组通过；既有 AI 督查的并发、取消、错位、换局和恢复 13 组通过。
- 生产依赖 5 组、安全边界 67 断言、原财政/鸿雁/民心/御批 4 个脚本、Agent 四特性全链 13 断言通过。
- 最终静置全量：**922 个唯一脚本，920 PASS / 0 FAIL / 0 SKIP / 2 WAIVED**；只豁免原来的 7 项缺席资产存在性检查，没有改变豁免、超时或统计口径。
- 架构 13 项、发布契约 166、官方剧本对账 27、热更构建夹具 27、受控 TLS 5 项通过。
- 实际 Windows Electron 33.4.11，正式 main/preload、独立临时 userData、禁止外网：两官方剧本各 17 项，标准 production/test-exports/restart 共 29 项。它们是部分重叠的检查记录，不是 63 条完整游戏流程。AI 回应为受控输入，没有使用真实 API 密钥或检验模型质量。
- Electron 测试调用真实表单输入事件、原诏书收集、原御批提交、原 AI 传输、detached idb/project 快照、真实 save/load IPC 与 fullLoadGame；不注入假的 tianming 桥。
- **Computer Use 未完成**：按技能初始化、重置后再初始化，都报 `failed to write kernel assets: 系统找不到指定的路径。 (os error 3)`。未发生本轮原生鼠标操作；只停止命令行身份验证过的隔离检查进程 11956，未删文件。
- `capturePage` PNG 在本机捕到了旧地图帧，未作为视觉验收证据。DOM 尺寸/命中与文字安全测试通过不等于逐像素绘制验收；相关断言已准确命名为 layout-and-hit-test。
- 未打安装包，未验签名安装/升级，未在 Linux 执行本轮门禁；未推送、合并、改版本或发布。

### 首次失败保留

1. 原试点基线上新版接口测试失败，确认仍有独立 `create`；这不是十几个原游戏 Bug 的计数。
2. 模块级夹具起初未加载 `extractEdictActions` / `extractCustomPolicies`，均为测试依赖遗漏；补入实际 AST 提取的原函数，未使用成功桩。
3. Electron 草稿回读先命中了同 ID 的隐藏旧控件，诊断同时记录了正式输入与隐藏输入；范围限定到正式诏书面板后，原文逐字回读、关闭重开和存读档通过。没有修改生产草稿行为。
4. 第一次全量在 `smoke-agent-mode-metacog-wired.js` 失败：过期保护误拦原 API 支持的显式离线 GM（全局没有绑定 GM）。改为捕获当时全局绑定，并拒绝另一个实际活世界；原测试与换局负例全部保留通过。
5. 第二次全量在未修改的工坊锁压力准入 deadline 失败，单跑 13 项和静置完整重跑均通过；无延长 timeout、降低次数或扩大豁免。

所有上述运行及命令/退出码、原始输出哈希、平台/Node/CPU、源码 hash 绑定收录于 [evidence.json](relief-channel-followup/evidence.json)。这是本地证据；旧报告及失败日志未删除。

执行证据的 HEAD 为 `cf81681f1f5bff7dd18b2198add4c03163e8b2cf` 加当时明确记录的 dirty 源码；收尾逐文件核对 hash 与当前源码一致，并非声称一个空工作区提交已经事先跑过测试。随后本地 `e3f289ce` 仅提交已被测试的跨平台 npm 路径选择；最终纠偏提交收录其余已测源码、生成清单及本报告。证据收集器和报告本身不改变游戏逻辑。
