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

## 2. 操作流程纠偏（进行中）

独立立案表、确认筹款、改派/撤止等按钮偏离已约定的操作流程。移除这些入口及试点独占结算；履行单只汇总已有诏令、御批、信函及朝会廷议记录。财政、人事、民心仍由原来的渠道和正式执行器负责，不让查看履行单产生新命令、重复扣款或自动奖励。

上一版私有现金试点的 API 与相应专项属于被撤回的设计，不再作为当前玩法验收依据；回归改为覆盖原渠道和只读不变量。已有试验存档里的流水只保留、提示，不猜测成正式渠道数据，也不自动退钱。最终状态与验证将在收尾补全。
