# 新建剧本来源隔离修复 · 2026-09-11

## 根因与改动

基线：`0d301d8daaf214db792ffb2f44b2cf85bbed0732`，本地分支 `codex/fix-blank-scenario-origin`。

实际鼠标检查已发现：新建案卷出现“大明”官制、37个衙门/462个官职，以及28个明代行政区缺少地图绑定的警告。问题不是本次国师生成这些制度。

`web/tm-office-editor.js/buildScenarioResetEditorSnapshot` 在本卷缺失配置时，直接克隆无归属的 `P.adminHierarchy/officeTree/government/economyConfig/...`。新建入口只建立少量字段，全局P却仍保留旧剧本内容。桌面入口还会先设置 `GM.sid`，因此不能用当前sid或显示名称推断配置属于新剧本。

本次修复：

- 只使用剧本自身的配置，不再以无归属的全局P配置补空。
- 人物等旧集合仍可从P恢复，但必须匹配请求的 `sid`。
- 自有空数组、null和分组events/timeline保留；同一桥接循环此前还会把合法分组事件/时间线误改成空数组，本次一并按数据归属修正。
- 修改的是 detached snapshot，不反向更改P、原案卷或世界状态。
- 更新该脚本缓存标记；不改版本、模型参数或国师权限/重试预算。

兼容边界：已有案卷内已经写入的明代数据不会靠朝代名称猜测清除。需要创作者明确选择改写；源数据与恢复材料保留。缺失字段应由本案卷制作流程补齐，不再默默借用另一局。

## 回归证据

| 验证 | 实际结果 |
|---|---|
| 同一行为测试读取git基线实现 | 5 PASS / 8 FAIL，退出1 |
| 修复后行为测试（含两个真实官方剧本正向对照） | 13 PASS / 0 FAIL，退出0 |
| Electron33.4.11真实主进程/预加载/IPC与编辑器 | 18 PASS，退出0，其中3项新增来源隔离/桌面新建/空视图检查 |
| 全量smoke | 938执行：936 PASS / 0 FAIL / 0 SKIP / 2 WAIVED（7项既有缺席资产检查），退出0 |
| 架构守卫 | 13 PASS，退出0 |
| 官方剧本对账 | 27 PASS，退出0 |
| 发布契约（最终） | 166 PASS，退出0 |
| 热更新构建闸门 | 27 PASS，退出0 |
| canonical清单检查（最终） | PASS，退出0 |

行为测试：`web/scripts/smoke-scenario-editor-origin-isolation.js`。
Electron专项：`scripts/electron/scenario-origin-cases.cjs`，接入既有 `--authoring-continuation` 作业，无需新增豁免。

可复跑命令：

```sh
node web/scripts/smoke-scenario-editor-origin-isolation.js --source-ref 0d301d8daaf214db792ffb2f44b2cf85bbed0732
node web/scripts/smoke-scenario-editor-origin-isolation.js
node scripts/verify-electron-bridge.js --authoring-continuation
node web/scripts/ci-smokes.js
node web/scripts/lint-arch-all.js
node web/scripts/verify-official-scenario-parity.js
node scripts/verify-release-contract.js
node web/scripts/verify-hot-builder-gates.js
node scripts/sync-hot-baseline.js --check --version 1.3.4.11
git diff --check
```

原始日志位于本地 `web/dev-tools/new-scenario/` 每次运行独立目录内的 `output.log/result.json`，包含命令、平台、Node版本、被测HEAD与工作区状态。关键目录：

- 基线：`final-baseline-bd154313-cbe0-4c16-86fd-feba79d625f4`
- 修复：`origin-final-4fd7849d-a7c4-4e0e-b1ef-071c0f9d1799`
- Electron：`electron-origin-c002be37-1f8b-40fe-80c5-09f7b59bebd7`；原报告 `web/dev-tools/electron-bridge/e877fcb8-f28f-481b-8578-127993c9c666/report.json`
- 全量：`smokes-bd191de8-37e5-4f3c-b0f4-794225d30e41`；报告 `web/dev-tools/arch-guard/ci-fHIKQy/smoke-report.json`，runId `6fa609d2-1cd4-47dc-af87-9e630ce8d04d`
- 最终发布契约：`release-contract-final-c5303abc-f58b-40ae-9428-208bd6575a8c`

首次直接在无资产工作树生成清单，错误地遗漏410项资产，发布契约如实失败，未作为交付接受。随后使用仓库现有生成器的 `--asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp` 重生成：1097项全保留，无增加/删除，仅index.html和tm-office-editor.js的hash/size变化。没有删除实际资产，也没有发版。全量smoke测试的JS代码与最终候选一致，随后只修正派生清单并重跑发布契约。

## 范围

Electron自动回归使用临时userData和受控网络，不等于真实API创作或安装包验收。刘备剧本的后续原生鼠标创作另行记录，不以以上计数冒充完成。

本轮仅本地修复与测试；未推送、未合并、未部署、未发布。

## 后续原生实操：新建通过，完整国师创作未通过

已将本次bridge/index两处最小改动同步到用户实际启动目录，写前确认两文件均与基线完全相同，写后确认与修复树逐字节一致。原文件备份在原工作树 `web/backups/scenario-origin-b8e7f640-ab37-4621-9b72-de90e20d3918`；其他用户改动未覆盖。

使用用户原API配置重新启动游戏，真实鼠标点击首页著卷、新建，建立独立的“建安十九年·益州初定（刘备实操）”。已有“刘备测试”和其他案卷未改动。新案卷18字段，官礼页显示“本剧本暂无官职树”，行政页显示“本剧本暂无行政区划层级”，不再带入原先37衙门/462官职和28明代区划。这是原生Windows实操，不是自动化夹具输出。

随后实际尝试创作刘备入主成都后的剧本。时代背景以[《三国志·先主传》十九年成都降、复领益州牧的记载](https://zh.wikisource.org/wiki/三國志/卷32)为起点，具体开局月日与能力数值按模拟设定处理；地图/区划仅计划按本卷数据绑定，没有改正式地图UI或借用明代底图。

但真实API创作没有完整完成：

1. 第一批请求基本设定、18人物、4势力与汉末官制，界面记录输出截断，并在JSON兼容2/2后失败：`finish=length`、正文0字、思考28373字，预览无改动。
2. 缩小到时间/玩家、4首脑/4势力及简短overview后，产生21处草稿修改，但自检收尾失败：界面识别为JSON兼容空助手消息，`finish=unknown`，正文/思考均0。
3. 实际点击一次“继续未完成部分”，执行2步后再次报空助手消息，未完成。原21处草稿保留，未自动应用，没有重复创建已有四人/四势力。

失败恢复按钮本次确实触发，橙棕实底/深底描边配白字，肉眼清楚可读，不再是原截图的浅色白框。但按钮可读不能证明任务能收尾。

**刘备剧本尚未完成，不能进入可玩/可导出验收；新建来源隔离修复与国师生成稳定性必须分别判定。** 没有获取脱敏原始HTTP回包，因此当前还不能区分中转空包、模型输出预算耗尽和客户端响应解析遗漏的完整责任。未改模型、自动重试上限或安全边界来掩盖失败，也未继续无限消耗请求。

原生操作细记：本地 `web/dev-tools/new-scenario/liubei-manual.md`，截图已随本会话原生操作工具逐次展示。此节是后续实操证据，不改变之前测试的代码树。
