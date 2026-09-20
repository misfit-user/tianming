# 天命：双模式记忆接入与过回合可靠性改造

**本批状态：代码已写入本地，专项与相关回归已核对；整仓仍有既存门禁失败，不是发版通过证明。原方案中的持久化阶段恢复、叙事与结算分层和整条依赖图提速，尚未全部实施。**

项目：`C:\Users\37814\Desktop\tianming`。设备：LAPTOP-AV4J1O7I。分支：`codex/audit-20260905`。开工与结束 HEAD：`5bef8008fe3592e8c026fbbe3bf03345b1cadf2d`。校验时间：2026-09-18T15:59:24.133Z。

没有调用用户的真实付费 API，没有安装依赖、清空存档、提交、推送、打包或部署。其他窗口已有改动保留；本轮采用源码备份、唯一位置补丁和写入前后 SHA 核对。

## 一、已落地：两种模式共用记忆证据服务

新增 `tm-memory-mode-bridge.js`，让独立 Agent 模式接入共享的记忆证据读取、来源展开、关联追查、候选审核和回合归档。模式互斥保留，不同时启动两套记忆管家，也不把独立 Agent 失败悄悄转成普通 LLM 推演。

Agent 只读工具从十项扩展到十二项，增加 `read_memory` 和 `recall_related`。记忆返回保留 ID、来源、权威、状态和有效期，不再在主循环统一裁成前 500 字符，而是按本轮预算保留完整 JSON 条目。非记忆工具的返回限制不因此被放宽。

读取深度接入模型能力策略，保留显式 `agentMemoryDepth` 设置，不改动独立 Agent 的总轮数。新增长期候选通过 WriteGate 作为草稿进入专家沙箱，再由原来的唯一提交器提交；只补充必要记忆队列、档案及版本计数器的写权限。回合结果接入共同归档与 rollup。旧状态盘、综合记忆和情节线读取仍保留，不宣称所有旧记忆路径都已经统一治理。

## 二、已落地：请求前预检与故障诊断

补入主入口实际缺少的重试帮助模块、世界存档校验模块和战斗契约模块，并按已有家族顺序及缓存戳契约加载。新增 `tm-endturn-reliability.js`，在事务快照和 AI 请求前检查当前模式声明的必要入口；缺失时明确报错，不先消耗一次模型请求。预检不是整个项目所有模块的完整冷启动验收。

回合耗时面板现在能查看最近尝试的请求阶段、排队时间、尝试次数和失败类别。记录保存在模块内存，回滚 GM 后仍可查看，最多十二次；刷新页面或退出程序后不会承诺保留。新记录不保存完整提示词、响应正文、URL 或 API 密钥，此说明不覆盖项目其他历史调试设施。

## 三、已落地：重试、排队与取消

普通请求增加可取消排队、队列时限、累计尝试次数和总等待预算。主请求与 JSON 修复共享预算和取消信号；原生工具调用与兼容 JSON 回退也共享尝试额度。关闭普通网络重试不再被外层包装擅自变成整段重放；实际上下文缩减等改变请求的兼容恢复仍有一次有界机会。

限流和暂时性服务错误按配置退避恢复，支持 Retry-After 秒数和 HTTP 日期。鉴权错误不靠换一种请求形式盲目再发。整段可能已经写入世界的子调用默认不重放，但保留明确的策略配置和请求级恢复。

流式主推演、旧消息流式入口及原生工具请求均接入排队取消、响应期限、世界/模型配置身份检查。已审核的 SC1 正文、模型与输出预算不由传输层放大，除既有 stream 标记外保持发送约定。正文读取卡住也会释放等待和队列占用。流式实现移到已有传输模块，未通过堆大旧模块或提高行数基线来规避检查。

回合失败会取消其余已登记的等待任务。手机端本地取消不等于远端一定停止计算或停止计费；晚返回的数据仍不得写进新世界。没有用增加无限重试或取消关键世界校验来提升表面成功率。

## 四、已落地：Agent 时限和提案一致性

独立 Agent 的总期限可以触发真实取消信号，不再只检查下一次预算申请；结束时清理定时器和父信号监听器。明确请求失败后停止盲目追加收尾调用。暂时性供应商故障仍在原请求的有限额度内恢复。

专家的修改基线改为模型调用前冻结，防止其返回后再把期间的新状态当成“修改前”状态，从而让旧提案覆盖新修改。临时绑定全局沙箱的专家也不能在独立读档后恢复旧全局对象。没有改成多个专家并发写真实世界。

## 五、最终验收记录

| 检查 | 结果 |
|---|---|
| 开工基线 | 201/202 通过 |
| 最终相关回归 | 208/209 通过，1 项未通过 |
| 新增三套内部场景 | 34 组通过 |
| 本轮源码/清单/测试文件 | 24 个，语法及最终哈希校验通过 |
| 本轮相对开工备份差异检查 | 通过 |
| 主入口派生清单一致性 | 通过 |

新增测试详情：

- `smoke-turn-memory-parity.js`：{"pass":10,"fail":0,"total":10}
- `smoke-turn-request-reliability.js`：{"pass":13,"fail":0,"total":13}
- `smoke-turn-stream-reliability.js`：{"pass":11,"fail":0,"total":11}

最终回归与基线共同未通过：`smoke-startup-phase-observability.js`。本轮没有新增失败脚本。主入口清单当前为 419 个脚本，原测试要求 436 个并包含更多原生开局与财政模块；已同步派生清单，但没有降低该独立数量/装载契约。

最终架构失败类别：`lint-dep-graph`、`lint-renderer-module-boundaries`、`lint-file-size`、`ref-check`。开工失败类别：`lint-dep-graph`、`lint-renderer-module-boundaries`、`lint-file-size`、`lint-split-contracts`、`ref-check`。没有新增失败类别。拆分顺序和家族戳已通过；仍存在模块体积、其他模块边界/派生物、依赖与引用问题，不是整仓全绿。`tm-endturn-ai.js` 的规模限制仍未关闭，包含本轮继续修改的代码，没有提高其行数预算。

本轮没有重新运行整个仓库的全部测试。运行的是上述按主题筛选的相关回归与架构检查，没有把多个不同时点的测试拼成真实客户端全量验收。

## 六、受控故障对照

| 模拟项 | 修改前 | 修改后 |
|---|---:|---:|
| 明确关闭单请求重试时，外层仍重复执行的 HTTP 尝试数 | 3 | 1 |
| 前请求固定占队 120 毫秒时，后请求取消返回耗时 | 126.518 毫秒 | 0.679 毫秒 |

这是受控模拟的一次对照，不是实际对局平均值、真实 API 速度或玩家成功率。正常的暂时性供应商错误仍可以按配置恢复。没有取得真实玩家失败占比，不能报告已经提高到某个成功率百分比。

## 七、尚未实施及交付边界

本批优先关闭双模式记忆接口、请求可靠性、取消/时限、诊断与提案一致性问题。原方案中的持久化阶段检查点、玩家重试时安全复用上一轮结果、只重试正文而不重新推演世界、结算与叙事分层、按实测性能重新排列整条依赖图，尚未完成。当前关键校验失败仍按原有事务机制回滚，不允许半提交伪装成功。

未完成真实付费 API 长局、手机真机、Electron 客户端和所有模块的完整冷启动验收。电脑上的源码修改没有被提交、推送或部署为线上版本。

远程通道在收尾时曾短暂无响应，之后恢复。本报告采用恢复后重新读取的测试、哈希和差异结果，不再采用“最后结果待取回”的中间状态。

## 八、文件与证据

- `web/index.html`
- `web/scripts/lib-turn-reliability.js`
- `web/scripts/lint-renderer-writeback-boundaries.js`
- `web/scripts/smoke-agent-mode-s2.js`
- `web/scripts/smoke-agent-mode-tools.js`
- `web/scripts/smoke-endturn-performance-optimizations.js`
- `web/scripts/smoke-turn-memory-parity.js`
- `web/scripts/smoke-turn-request-reliability.js`
- `web/scripts/smoke-turn-stream-reliability.js`
- `web/scripts/verify-all.js`
- `web/startup-script-phases.json`
- `web/tm-agent-kernel.js`
- `web/tm-ai-infra-retry.js`
- `web/tm-ai-infra.js`
- `web/tm-endturn-agent-depth-tools.js`
- `web/tm-endturn-agent-intent-plan.js`
- `web/tm-endturn-agent-mode.js`
- `web/tm-endturn-agent-read-tools.js`
- `web/tm-endturn-ai.js`
- `web/tm-endturn-core.js`
- `web/tm-endturn-pipeline-steps.js`
- `web/tm-endturn-reliability.js`
- `web/tm-endturn-timing-ledger.js`
- `web/tm-memory-mode-bridge.js`

证据目录：`docs/endturn-reliability-20260918/`。关键文件：`baseline.json`、`changes.json`、`baseline-tests.json`、`final-tests.json`、`baseline-architecture.log`、`final-architecture.log`、`manifest-check.json`、`own-diff-check.json`、`benchmark.json`、`verification.json`。

开工备份：`.bak-endturn-reliability-20260918/`。继续操作前应读取 `changes.json` 并核对当前哈希；不要重复运行 setup 或整批补丁，也不要整目录覆盖备份，以免影响其他窗口后续修改。
