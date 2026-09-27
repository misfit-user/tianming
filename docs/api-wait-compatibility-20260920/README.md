# 天命 1.3.5.1 慢响应兼容修复：最终验收

## 结论

本次本地源码修改及本报告列出的工程验收已经完成。恢复成功响应头之后继续等待完整内容的默认语义，同时保留取消、切档隔离、完整性校验和原有世界提交约束。没有通过截短正文、降低模型推理能力或吞掉主推演错误来提高表面成功率。

项目：`C:\Users\37814\Desktop\tianming`。设备：LAPTOP-AV4J1O7I。分支：`codex/audit-20260905`。HEAD：`5bef8008fe3592e8c026fbbe3bf03345b1cadf2d`。最终核验时间：2026-09-20T04:28:18.028Z。

本轮没有提交、推送、打包、发布或部署，也没有调用玩家的付费 API。玩家手里的旧安装包和已部署网页不会自动取得本地源码修复。

## 一、默认等待行为

排队与真正发送后的首响应等待分开。请求收到成功 HTTP 响应头后，撤销首响应期限，继续等待完整 JSON 或流式正文。后续完成后，仍经过原有解析、必要字段、正文和世界状态校验，全部满足才允许提交。

默认不再用原 150 秒首响应期限、共享重试预算或隐藏的 Agent 总时间，截断一个仍可能完成的成功响应。长等待会提示真实状态，不自动重发、切模型、缩减正文或跳过当前阶段。明确错误响应没有被当作成功响应无限等待。

同时修复自动输出设置与最终流式入口的不一致：最终请求可以合法省略输出上限字段，不再因 max_tokens 缺省而在发送前报错；明确填写的非法数值仍拒绝。不在传输层偷偷补一个小上限。

## 二、玩家可以分别设置

| 设置 | 0 的含义 |
|---|---|
| 排队最大等待 | 不设强制排队期限 |
| 发送后的首响应等待 | 使用现有按调用类型计算的自动期限 |
| 完整响应最大等待 | 不设强制完整响应总期限 |
| Agent 回合总时限 | 不设隐式总期限，轮数和调用次数限制仍保留 |

主、次 API 的等待设置分别保存。玩家明确设定的总上限仍然有效。Agent 的工具调用额度、轮数、深度门槛与语义提交规则保留，不等于无限开新调用。

## 三、取消和安卓边界

取消、切档和模型配置身份检查保留。等待中的旧请求不能向新世界发布结果；明确取消不能被通用网络重试当成再发一遍的理由。流式和原生工具入口也有同样的区分，不只修改普通 JSON 请求。

安卓原生桥接只返回整包结果，没有首响应头事件。本轮保留原生连接检查，推演的正文读取默认不设硬期限；玩家显式上限仍执行。模型列表和能力探测等请求保留自身有限等待。安卓部分验证使用原生桥接模拟及安装源码核对，并非安卓真机。

本地取消不保证供应商已停止计算或停止计费。代码只负责不采纳迟到结果、不自动重复发送相同失败操作，不能代替供应商的取消协议。

## 四、最终验证结果

| 检查 | 实际结果 |
|---|---|
| 开工相关专项 | 74/74 通过 |
| 断线前扩大回归 | 210/210 通过 |
| 恢复连接后的最终全量回归 | 1059/1059 通过，失败 0、跳过 0、豁免 0 |
| 新增等待兼容场景 | 18/18 通过 |
| 架构检查 | 13/13 通过 |
| 质量边界对照 | 30/30 通过 |
| 真实 Edge HTTP 与设置验证 | 11 项通过 |
| 本轮文件语法与最终哈希 | 18 个文件通过 |
| 本轮范围 git diff --check | 退出码 0 |

核心差分样例采用受控时钟：第十秒收到成功响应头，第 170 秒返回完整 JSON，首响应策略仍为 150 秒；修复后完整返回且仅有一次请求。另验证显式总期限、未收到首响应时的期限、取消、切档、流式静默间隔、Agent 工具、安卓整包响应、独立主次设置以及排队不消耗首响应预算。

真实 Edge 使用独立配置、真实 fetch 和本机 HTTP 服务，验证响应头先到、正文延迟超过首响应期限仍成功；并检查显式总期限、取消、工具响应、自动输出的流式入口与设置保存。测试共发送五次合成请求，没有使用实际中转站、付费模型或玩家存档。独立浏览器配置清理结果：已清理。

最终浏览器源文件哈希与最终运行时代码一致。记录测试输入文件 2053 个；测试期间变化 0 个，结束后再次核对变化 0 个。没有将前一次中断的结果当成最终全量结果。

原架构失败来自并行地图文件的家族缓存戳不一致。本次仅同步加载标记和生成清单，未修改地图实现、版本号、资产或加载顺序，未删除检查或增加豁免。

## 五、质量边界与未改动范围

以下文件或函数与开工备份保持一致：

- `web/tm-ai-infra-model-detect.js unchanged`：通过
- `web/tm-ai-request-options.js unchanged`：通过
- `web/tm-endturn-ai-sc1-budget.js unchanged`：通过
- `web/tm-agent-kernel.js unchanged`：通过
- `web/tm-endturn-validity.js unchanged`：通过
- `web/tm-endturn-mode-contract.js unchanged`：通过
- `web/tm-endturn-pipeline-steps.js unchanged`：通过
- `web/tm-endturn-reliability.js unchanged`：通过
- `web/tm-endturn-ai.js:_tok unchanged`：通过
- `web/tm-endturn-ai.js:_buildFetchBody unchanged`：通过
- `web/tm-endturn-ai.js:_buildSc1Schema unchanged`：通过
- `web/tm-endturn-ai.js:_parseOrRepairJsonResult unchanged`：通过
- `web/tm-endturn-ai.js:_runSubcall unchanged`：通过
- `web/tm-endturn-ai.js:_runSubcallBatch unchanged`：通过
- `web/tm-endturn-agent-mode.js:_depthGate unchanged`：通过
- `web/tm-endturn-agent-mode.js:_selfCheck unchanged`：通过
- `web/tm-endturn-agent-mode.js:_buildSystemPrompt unchanged`：通过
- `web/tm-endturn-agent-mode.js:_buildTurnPrompt unchanged`：通过
- `web/tm-endturn-agent-mode.js:_qualityGate unchanged`：通过
- `web/tm-endturn-agent-mode.js:_dispatch unchanged`：通过
- `web/tm-endturn-agent-mode.js:_snapshot unchanged`：通过
- `web/tm-endturn-agent-mode.js:_rollback unchanged`：通过
- `web/tm-ai-infra.js:getPromptBudget unchanged`：通过
- `web/tm-ai-infra.js:estimateTokens unchanged`：通过
- `web/tm-ai-infra.js:checkPromptTokenBudget unchanged`：通过
- `web/tm-ai-infra.js:callAISmart unchanged`：通过
- `web/tm-memory-agent-tools.js:_buildRecallPrompt unchanged`：通过
- `web/tm-memory-agent-tools.js:_requestRecallPlan unchanged`：通过
- `web/tm-memory-agent-tools.js:_normHit unchanged`：通过
- `web/tm-memory-agent-tools.js:exec unchanged`：通过

模型上下文容量检测和思考协议转换文件没有修改。没有强制改回 32K，也没有默认关闭 thinking。本轮完成的是等待与自动输出流式兼容，不将其他中转协议差异或容量识别问题假称为已经全部解决。

工程回归全绿不等于所有真实供应商均已验证。尚未使用报告玩家的真实 API 跑完整长局，未运行安卓真机或已发布安装包验收，不能报告真实玩家总体成功率或整回合提速百分比。

## 六、全量回归中的测试环境修正

第一次恢复后的全量回归发现 smoke-tc-history-wave 的 B5 隔离场景未加载真实的 _aiWaitSetting，Agent 在构造运行预算时提前抛出 ReferenceError，未进入模型调用。诊断确认不是历史约束被删除。测试补入生产使用的真实解析函数后，原有 49 条断言全部通过；没有 stub 成无条件成功，没有删除或放宽任何历史约束断言。修改后另行重跑完整验证，中间失败结果保存在 before-history-fixture-fix/。

取消监听器测试也同步了实际所有权：重试等待使用内部控制器，而不是在外部信号重复挂监听器。保留外部三次请求的精确添加/移除检查，并额外用真实 getEventListeners 检查两次内部等待均清理完毕；29 条断言通过。该修改没有放宽或绕过运行时取消逻辑。

## 七、文件与交付状态

本轮文件：

| 文件 | SHA-256 前十二位 |
|---|---|
| `web/index.html` | `ab4ad8b6d089` |
| `web/scripts/smoke-ai-abort-listener-cleanup.js` | `65b5048149f5` |
| `web/scripts/smoke-ai-transport-deadlines.js` | `3a4db227d9b6` |
| `web/scripts/smoke-api-wait-compatibility.js` | `323f93bbca74` |
| `web/scripts/smoke-mobile-api-integration.js` | `c6d8d35dbf11` |
| `web/scripts/smoke-tc-history-wave.js` | `8d141615be42` |
| `web/scripts/smoke-turn-request-reliability.js` | `509d65512489` |
| `web/scripts/smoke-turn-stream-reliability.js` | `7177ae56adc0` |
| `web/scripts/verify-all.js` | `e3425b1240cc` |
| `web/startup-script-phases.json` | `fd15170e9307` |
| `web/tm-ai-infra-retry.js` | `6ee4201dd57c` |
| `web/tm-ai-infra.js` | `1eb3cbaca0ca` |
| `web/tm-api-settings.js` | `1501dedcfa9c` |
| `web/tm-endturn-agent-mode.js` | `9e7ac1d4d74f` |
| `web/tm-endturn-ai.js` | `6e0d6b304ae8` |
| `web/tm-endturn-timing-ledger.js` | `689d6258f97b` |
| `web/tm-memory-agent-tools.js` | `644a241f115b` |
| `web/tm-utils.js` | `1e6346077cd3` |

完整证据目录：`docs/api-wait-compatibility-20260920/`。关键文件：`verification.json`、`resumed-full-tests.json`、`resumed-run-status.json`、`resumed-tested-inputs.json`、`resumed-architecture.log`、`browser-realtime-result.json`、`own-diff-check.json`、`changes.json`。

原始备份：`D:\tianming-task-artifacts-20260919\api-wait-backup-20260920`。原路径与其他窗口已有改动保留。仅调整地图拆分模块的查询缓存戳，没有回滚其他窗口的地图工作。

修复尚未进入发布包或线上网页。后续发布仍须由仓主明确触发，并经过项目发布流水线；本报告不构成已发版声明。
