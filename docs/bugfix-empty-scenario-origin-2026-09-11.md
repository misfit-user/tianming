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
