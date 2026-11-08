# 后台记忆保存与复核的先后关系

## 基线与故障证据

基于 `d31d47787573e9cb48935a1e8d3e6ccdca56b90f`，只修改现有保存生产者及复核消费者。各文件完整 SHA-256 在 `evidence.json`。

远端无采样组合测试 `39914633560` 的实际 checkout 为 `815bfb626364dd6d0f15b9cab6833099740c8f08`，run ID 为 `611c2c4c-4779-43d3-b115-96f8f77ff39a`。该次已有两次真实读档、day60、NPC回答及双方返程，最后在后台保存期间 OOM：

- 07:10:07 UTC：第二次后台复核开始，calls=2。
- 07:10:15：SC25c仍运行；canonical revision15已保存；desktop没有在途保存。
- 07:11:03：SC25c完成后出现新的background pending。
- 07:11:10：background canonical正在执行，复核仍在运行，desktop仍未在途。
- 07:11:22附近：renderer报告OOM。

原始文件在 `web/dev-tools/ci-39914633560-composite/611c2c4c-4779-43d3-b115-96f8f77ff39a/`。这与681在第二basis之前崩溃的阶段不同。当前证据支持晚到的记忆保存与复核副本重叠，不支持将本次崩溃归于同时执行的desktop保存。

## 修改

`_endTurn_startPostTurnMemorySave` 接管原来就在 `_endTurn_saveSnapshot` 中启动的同一条记忆等待及保存排队链。它只启动一次，完成凭据仅含状态、回合或错误原因。它在保存大对象的async IIFE外定义和调用，不捕获该IIFE的 `_autoState`、`_canonicalPayload`。

主canonical保存不等待记忆任务。后台复核等待这条已经启动的Promise，随后仍须确认自己的pending来源已通过既有canonical保存队列提交，才创建第二个basis。复核不会再次调用能重开失败周期的 `_awaitPostTurnJobsForSave`。

等待使用原有复核有效性监视与AbortSignal。取消、读档、回合、API或世界身份变化，以及新的busy状态，都会让消费者退出；不等待旧producer永远返回，不开启新的世界事务。未取得真实producer凭据时保留明确pending失败，不默认为核验完成。

记忆producer失败发生在复核pending保存之前时，错误和原始来源沿既有保存队列持久化一次；已请求过pending保存而该保存失败时，不再次新建保存重试预算。原记忆失败不会因此重新运行。

## 验证

本目录 `runs.json` 记录命令、环境和退出状态；原始输出保存在同名 `.log` 中。环境为 Windows、Node v24.14.0。

| 检查 | 当前结果 |
|---|---|
| 相同真实源码反例，使用旧d31 Review | 0通过 / 1失败；SC25c未解时实际calls=2 |
| 相同反例，使用新Review | 1通过 / 0失败 |
| smoke-emergency-recovery-review | 79通过 / 0失败；原62项保留 |
| smoke-save-commit-boundary | 36通过 / 0失败；原28项保留 |
| smoke-runtime-save-consistency | 84通过 / 0失败 |
| syntax、git diff --check、lint-arch-all | 通过 |

新测试使用真实render函数、Review模块和生产后台保存队列。它回读两个保存槽中的pending来源与SC25c原始错误，并验证主提交仍可完成、无任务正向、排队拒绝、存储失败、跨档、取消、同局变化及不重复启动原producer。

`counterexample.cjs` 只筛选现有测试中的同一条用例。通过 `TM_REVIEW_SOURCE_OVERRIDE` 可以使用本目录保存的旧Review原文复现；没有复制实现到测试中。

同一闭包持有问题的独立小型可达性诊断位于相邻的 `save-closure-diagnostic-d31/`。其显式GC仅用于验证引用释放和未确认写入的恢复保护，不属于普通浏览器验收。

## 未证明的范围

这些证据证明生产者顺序与引用释放的具体缺陷；尚未证明完整无采样组合浏览器已不再OOM。未运行新的正式浏览器、移动真机或真实模型。未改模型、GC、堆大小、超时、保存字段及磁盘格式；未生成清单、提交、推送、打包或部署。
