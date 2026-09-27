# 天命 AI 记忆系统：本地升级与验收报告

日期：2026-09-18。设备：LAPTOP-AV4J1O7I。项目：`C:\Users\37814\Desktop\tianming`。

## 结论与范围

已在本地源码完成一轮核心记忆链路升级，重点覆盖投影、治理、召回去重、预算编译和实际注入审计。保留既有分层、归档、语义检索及写入机制，没有推倒重做，也没有新增模型调用阶段。此次不是所有记忆功能的重写，不等同于已经完成真实付费 API 长局验收。

修改 7 个运行时文件，新增 1 个回归测试文件，并更新测试注册表。没有安装依赖、修改版本、清空存档、执行存档迁移、提交、推送、打包或部署；没有回滚其他窗口已有改动。共享的 `tm-endturn-ai.js` 在开始前已有修改，本次以该工作区版本为备份基线做唯一位置补丁。

起始与结束 HEAD 均为 `5bef8008fe3592e8c026fbbe3bf03345b1cadf2d`，分支保持 `codex/audit-20260905`。备份、哈希和测试证据见本文末尾。

## 实查复现与已完成修正

**1. 最终入口统一检查。** 原先直接调用编译器可绕过草稿和私有记忆过滤。现在最终编译入口也执行治理，草稿、待审核、拒绝、隔离、删除及明确清空安全正文的记录不再默认进入推演。兼容 NPC 身份对象、人物私有范围和势力范围。

**2. 正确区分世界与时间。** 对明确带世界、存档、战役或时间线标识的记录检查一致性；默认排除未来回合和未来才获知的事实。读档分叉后，只允许有证据支持的直接父分支分叉前历史；其他分支及父分支后续事实不混入。旧档没有身份字段时维持兼容，不虚构完整跨档隔离能力。

**3. 保留完整条目与硬预算。** 显式零预算表示不输出；异常预算有有限回退；缺少预算模块时不忽略上限。修复紧预算把 XML 标签切开却报告成功的问题。现按完整条目裁剪；连必要结构和条目也容不下时明确失败，不发送残缺成功结果。历史过期事实附带历史用途和有效期标识。

**4. 提高有限预算的信息覆盖。** 先对跨查询重复证据去重，再分配召回预算；不再仅按前 80 个字符误删结论不同的记录。大量人物条目存在时，优先保留人物现状、有效诏令和承诺的代表条目，并为廷议、时政和历史证据留出空间。预算极小时不能保证每类都有条目，更不保证所有重要事实都同时保留。

**5. 注入审计与实际编译结果一致。** 保留旧候选字段以兼容既有调用方，同时新增实际输出条目及分区统计。SC_RECALL、SC1 和记忆审计改用实际输出集合，记录被裁掉的条目，去除重复的拒绝记录。空编译结果不再重新启用原文回退。审计反映记忆块编译与装配阶段，不代表模型一定注意到了每条内容。

**6. 兼容性。** 修正空时间字段被转成回合 0、真正回合 0 被默认值覆盖、原型同名 ID 被误判重复，以及合法 128 字符战役 ID 截短后误拒自身投影等边界。原始证据引用、既有中文文本及旧存档内容没有被清空。

修改前 8 个边界缺陷均有执行记录，见 `reproduced-before.json`。

## 测试结果

| 检查 | 实际结果 |
|---|---|
| 修改前记忆/上下文/语义专项 | 104/104 通过 |
| 最终同范围专项（含新测试） | 105/105 通过，0 失败、0 重试豁免 |
| 新增回归 | 26 组通过；包含预算 1—320 遍历及自定义估算器 |
| 整仓扫描 | 1013/1035 通过，22 项失败 |
| 本次 9 个源码/测试文件 | 语法检查与最终 SHA 校验通过 |
| 本次范围 git diff --check | 退出码 0 |

整仓扫描在最后的小范围分支继承/日志收口补丁之前执行；收口之后重新完成了记忆专项和架构检查。没有把这两次不同快照的结果冒充同一最终快照的整仓验收。

架构检查修改前后均有 5 类失败：`lint-dep-graph`、`lint-renderer-module-boundaries`、`lint-file-size`、`lint-split-contracts`、`ref-check`。最终失败类别为：`lint-dep-graph`、`lint-renderer-module-boundaries`、`lint-file-size`、`lint-split-contracts`、`ref-check`。没有新增失败类别，但这不等于整仓架构全通过，也不等于逐条诊断文字完全相同。

修改前只跑了记忆专项和架构基线，没有跑整仓测试基线，因此不能把整仓剩余 22 项失败全部宣称为已证实的历史问题。它们保留在原始报告中，未删除、降级或豁免。

## 合成重复召回样例：相同预算的信息覆盖

40 个查询、80 个候选，每个查询都命中同一诏令和一条不同的廷议证据。召回及最终记忆编译预算均为 1200。本表来自 `benchmark.mjs` 与 `recall-benchmark.json`，不是实际对局平均性能或模型理解率。

| 指标 | 修改前 | 修改后 |
|---|---:|---:|
| 召回阶段独立事实 | 1 | 41 |
| 最终记忆块独立事实 | 1 | 32 |
| 最终记忆块估算 tokens | 65 | 1172 |
| 本地召回打包中位耗时（毫秒） | 2.037 | 2.58 |

修改后最终记忆块在预算内携带了更多有效内容；原版则先让重复条目耗尽召回预算，随后编译去重又留下大片空余。改进没有新增 AI 调用阶段，但实际利用的上下文可能增多，不能据此承诺 API 账单下降。tokens 均为本地估算；耗时受机器负载影响。

## 整仓仍失败的测试

以下为完整扫描实际失败项，均保留在 `full-smokes.json`。失败集中于地图代理、军队/战斗、财政、初始化、持久化、依赖与剧本等范围；未在本次任务中将这些系统整体重写。

| 测试脚本 | 退出码 |
|---|---:|
| `smoke-agent-mode-geo.js` | 1 |
| `smoke-army-liability-ledger.js` | 1 |
| `smoke-battle-cost-guoku.js` | 1 |
| `smoke-battle-trigger-contract.js` | 1 |
| `smoke-building-payment-ledger.js` | 1 |
| `smoke-divergence-ledger.js` | 1 |
| `smoke-edict-npc-atomicity.js` | 1 |
| `smoke-edict-office-tree-writeback.js` | 1 |
| `smoke-fiscal-collection-ledger.js` | 1 |
| `smoke-native-fiscal-consumers.js` | 1 |
| `smoke-native-start-preparation.js` | 1 |
| `smoke-native-world-events.js` | 1 |
| `smoke-production-dependencies.js` | 1 |
| `smoke-relief-governance.js` | 1 |
| `smoke-runtime-save-consistency.js` | 1 |
| `smoke-security-trust-boundary.js` | 1 |
| `smoke-social-foundation.js` | 1 |
| `smoke-start-game-data-integrity.js` | 1 |
| `smoke-start-hierarchy-immutability.js` | 1 |
| `smoke-startup-autosave-opt-in.js` | 1 |
| `smoke-startup-phase-observability.js` | 1 |
| `smoke-tang840-opening-ledgers.js` | 1 |

## 源码、证据与备份

运行时文件：`web/tm-memory-envelope.js`、`web/tm-memory-governance.js`、`web/tm-memory-retrieval.js`、`web/tm-memory-context-compiler.js`、`web/tm-memory-trace.js`、`web/tm-context-zones.js`、`web/tm-endturn-ai.js`。测试：`web/scripts/smoke-memory-boundary-upgrade.js`；注册：`web/scripts/verify-all.js`。

本报告所在目录：`docs/ai-memory-upgrade-20260918/`。关键证据为 `baseline.json`、`changes.json`、`reproduced-before.json`、`baseline-smokes.json`、`final-regression.log`、`final-memory-smokes.json`、`full-smokes.json`、`baseline-arch.log`、`final-arch-after-closeout.log`、`recall-benchmark.json`、`closeout.json`。日志由 Windows PowerShell 重定向的部分采用 UTF-16LE；验收解析器已按 BOM 正确识别。

开始前备份：`.bak-ai-memory-upgrade-20260918/`。后续恢复前应先核对 `changes.json` 与当前文件哈希，采用逐文件合并；不要直接覆盖其他窗口后来写入的内容。

本次验收没有使用真实付费 AI API 跑完整长局，没有独立验证手机端或 Electron 打包产物，也没有发布网页版本。源码修改不会自动替换已部署网页或已安装客户端。记忆筛选和预算改进可降低已复现的漏读、串档与污染风险，但不保证模型永不遗忘、永不产生幻觉。
