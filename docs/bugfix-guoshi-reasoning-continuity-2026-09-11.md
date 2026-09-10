# 国师连续工具调用：思考字段丢失的补修

## 范围与结论

起点为 PR77 合并后的 `ac7bba497e52116681693b8a763ac88680ddf5e8`，代码提交 `c30a64233bf336dc512a7a9dfb05904895c468b3`，分支 `codex/fix-guoshi-reasoning-protocol`，实际工作树 `tianming-perf-round1`。原 `tianming` 脏工作树和已有分支均保留。本轮仅本地代码、测试与提交，未推送、合并或部署，未改版本、构建安装包或发布热更新。

玩家截图说明上轮 JSON 兼容恢复仍可能失败，但没有提供具体模型名和原始 API 响应。**本轮确认并修复的是客户端一个实际协议缺口，不声称已经证明玩家这次失败只有这一个原因，也不声称所有中转/模型已经兼容。**

按排错技能要求，本次从检查第二、第三轮真实请求包入手，补足上轮“原生无工具→受控 JSON 兜底成功”试验没有验证的多轮协议状态。

## 根因与最小修复

`web/editor-authoring-agent-provider.js` 的 `_parseOpenAI`、SSE `_decodeResponse` 和 `_toOpenAI` 原先都不保留 `reasoning_content`；`web/editor-authoring-agent.js/runAuthoringLoop` 记录 assistant 工具轮时也只保留正文和调用。这使支持思考工具调用的服务收到第二轮请求时缺少续接字段。

DeepSeek 当前官方文档明确要求带 tools 的后续请求回传原 assistant 的 `reasoning_content`（包括没有调用工具的 assistant 消息），缺失可能返回 HTTP400；参见 [Thinking Mode / Tool Calls](https://api-docs.deepseek.com/guides/thinking_mode/#tool-calls)。它解释了可复现的“首步成功→后续请求报错→降级为文字兼容→未完成”链路；本轮没有调用玩家的中转服务。

改动：

- JSON 和 SSE 均提取完整 `reasoning_content`，以内部会话字段 `reasoningContent` 保存；原生 OpenAI 兼容请求原样回传，空字符串不丢。既有深拷贝、恢复和会话序列化自然保留该字段。
- 不把思考内容当作正文、工具参数或可执行 JSON；不放进 UI、步骤日志、诊断或摘要，不向无 tools 的文本兼容请求及其他协议序列化器混入它。会话仍只保存在已有本地会话/恢复材料中，未改变剧本或游戏存档格式。上下文预算计入它，不靠忽略体积或提高预算绕过限制。
- 增加最多4条脱敏响应分类：正文、思考长度；协议；已知结束原因；有效工具数；原生/JSON兼容。区分仅思考、空消息、普通文字、拒绝/过滤、输出截断、工具参数损坏和未知协议。失败说明显示这些信息，不再把所有情况笼统归为“模型不支持工具”。
- 非数组 `tool_calls` 明确判为参数/结构无效，整批不执行；不从思考或说明里的示例猜测修改指令。
- 两个正式编辑器入口同步缓存戳 `20260911-reasoning-continuity1`。没有重试次数、输出上限、工具权限、只读模式、质量闸、草稿应用确认、文档租约或业务机制变化。

## 行为验证

新增 `web/scripts/smoke-authoring-reasoning-continuity.js`，通过真实 provider/core、隔离 fetch 响应验证出站包。相同最终适配器运行原 main 为 **3 PASS /10 FAIL**，修复树为 **13 PASS /0 FAIL /0 SKIP /0 WAIVED**。失败数包括新增诊断契约尚不存在，不等于10个独立玩家 Bug；原生 JSON/SSE 首步写入后断链均为实际行为复现。

覆盖：连续写入并 finish、空思考字段、非思考正向对照、同草稿恢复/继续不重复 append、旧会话深拷贝、微压缩与宏摘要边界、仅思考中的工具形状不执行、各类安全诊断、输出截断不执行前缀、有界恢复、其他协议不混字段、取消不写回。

扩展已有 `scripts/electron/authoring-continuation-cases.cjs`，实际正式主进程/preload/编辑器、鼠标输入事件、真实 IndexedDB 保存读回，合成案卷、独立临时 userData、禁止外部网络：

| 命令 | 最终结果 |
| --- | --- |
| `node scripts/verify-electron-bridge.js --authoring-continuation` | 15 PASS，其中5个共用桥接检查、7个原有流程、3个新流程；JSON/SSE 两步修改在批准前不改 live，批准后读回一致；仅思考明确失败、不执行其内容 |
| `--authoring-recovery` | 17 PASS |
| `--authoring-boundaries` | 20 PASS |
| `--authoring-stream` | 12 PASS，含39轮工具完成、坏流尾、取消、真实应用/读回 |
| `node web/scripts/run-smokes.js --grep authoring --grep guoshi --no-retry` | 19脚本 PASS（中途候选）；最终文件另由全量套件覆盖 |
| `node web/scripts/ci-smokes.js` | **exit1：934 PASS /1 FAIL /0 SKIP /2 WAIVED，共937个脚本**；失败为未修改的工坊锁压力测试 `stress admission deadline exceeded` |
| `node web/scripts/smoke-workshop-lock-recovery.js` 单独对照 | exit1：前12组 PASS，四进程压力组仍超时；本轮没有降低断言、延长时间或修改实现 |
| `node web/scripts/lint-arch-all.js` | 13 PASS |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS |
| `node scripts/verify-release-contract.js` | 166 PASS |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | exit0，0 vulnerabilities |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | exit0，687在场条目通过，保留410缺席资产条目 |
| `git diff --check` | exit0 |

全量报告 runId `f02ad1d1-2671-40e6-b1d9-eaf67847006c`，路径 `web/dev-tools/arch-guard/ci-BUvZwm/smoke-report.json`。仍为原有2个脚本的7项具体资产缺席豁免，其他断言全部执行；本次门禁失败，不能称为“全绿”。工坊锁及其测试与起点无差异，单独运行也失败；本轮没有证据判定是资源竞争还是其他既有边界，不擅自归因或展开无关修复。

所有 Electron 模式共享部分基础检查，不能相加冒充独立端到端游戏操作数。环境为 Windows、Node24.14.0、Intel i5-13420H、未打包 Electron33.4.11/Chromium130；不冒充真实中转、已发布网页、Android 或签名安装包验收。

## 日志、首次失败与派生物

执行索引见 [机器证据](evidence/guoshi-reasoning-continuity-20260911.json)，含24次实际执行，记录命令、时间、退出码、平台、被测起点加脏文件hash与原始日志相对路径。7个被测源码/测试/清单文件与代码提交逐字节相同；随后只有本说明和机器索引的文档提交，未以文档SHA声称重跑全量。`node scripts/perf/run.cjs <label> -- <command>` 只记录本地脱敏证据，不上传环境变量、账户信息或玩家正文。原始日志在该索引的本地 ignored 路径中；本轮尚无远端可访问日志。

1. 初始11组基线2 PASS/9 FAIL；最终增加协议分类及跨协议边界后13组基线3 PASS/10 FAIL。未修改旧源或用成功桩替代实际循环。
2. 首次 Electron 12 PASS/3 FAIL：一个既有断言要求保留“兼容尝试已用尽”文案；两个新测试读取了不存在的 `ui.els.steps`，属于测试框架错误，不能作代码失败/成功的证据。保留原文案语义，将新测试读取目标修正为实际 `#tm-aa-panel`，原有断言不删，最终15项通过。
3. `sync-official-scenarios.js` 按官方流程执行，2来源/9派生物，无官方内容改动。热更清单由 `node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp` 非发布同步，资产源只读；仍1097项，仅两个运行时JS和两个HTML的hash/size变化。版本和资产不变，不手改hash。
4. 保留两个 HTML 逐行原换行序列：editor 2948 CRLF/7 LF，reset入口592 CRLF/2 LF；没有整文件转换编码或修改换行规则。

## 仍需明确的边界

- 未取得玩家的模型名/有效响应，未验证其真实中转。`reasoning_content` 以外的供应商专用签名、加密思考块或 Responses API 等不同协议，不在本补丁中冒称已完整支持。
- 已经丢失的旧会话字段无法凭空还原；保留旧草稿和原有确认/恢复入口，不自动丢弃进度。若旧线程继续受上游协议限制，需保留/明确应用已有改动后，从当前内容继续，而不是伪造历史思考字段。
- 服务若始终只回思考/普通文字而不回有效命令，本地不能把“说要修改”当成真正修改成功。本轮仍有界停止并保留草稿，显示可用于进一步定位的响应类型。
- 只读查询发现原 main 的合并后 [CI34498575290](https://github.com/misfit-user/tianming/actions/runs/34498575290) 中 guards/mobile 成功、Electron 失败于 `memorial-reading-cases.cjs:85` 的颜色断言（18 PASS/1 FAIL）。这不是本候选的远程结果，也不是国师链路错误；本轮保留日志，不顺带改奏疏代码/断言，不以旧 PR 绿灯覆盖它。
- 本候选未运行远端 CI；未经本轮后续明确授权，不推送、合并或部署。
