# 国师 Agent：流式响应误当 JSON 导致无法收尾

## 范围、基线和结论

- 用户截图：执行过程中报 `Unexpected token 'd', "data: {\"id\"... is not valid JSON`，无法产出最终修改结果。
- 已在真实主干代码上复现同类错误。直接原因是 `web/editor-authoring-agent-provider.js / _fetchJSON` 对 HTTP 成功响应无条件调用 `response.json()`，而部分中转返回 SSE 事件流。原请求读到响应头就解除超时/取消监听，正文读取阶段也缺少相同生命周期保护。
- 本轮起点及获取的 `origin/main` 均为 `f102b56585faa48c47d362a91c5260f4cee1b8eb`。独立分支 `codex/fix-authoring-agent-sse`，工作树 `tianming-perf-round1`。
- 上一轮营造修复完整留在 `codex/building-channel-hardening@f3d2086c8613e5593f3542bba822995d29b85abf`，没有混入本国师分支。原 `tianming` 脏工作树及另一个 authoring 工作树均未修改。
- 生产修复提交：`8b86ddcf128c619ca7a845e16d233f7b1420dc1f`。
- 旧测试响应桩修正：`8894e1b754ad4de5fbac50a0821e5345f406e853`，只改测试，不改生产代码。
- 后续提交只包含本报告及已实测的 Electron 稳态/取消断言增强；生产字节与 `8b86ddcf` 相同。最终提交可由本分支 `git log` 查阅。

**国师相关回归和实际编辑器流程通过；全量仍有一个未改动的工坊安装锁压力测试超时，不宣称全部门禁绿。** 本轮只做本地实现、测试和提交，未推送、未合并、未改版本或发布。

## 实际修复

主要生产变更集中于 `editor-authoring-agent-provider.js`：

1. `_decodeResponse` 按实际正文识别 JSON / SSE，不仅信任 Content-Type。兼容既有 OpenAI Chat Completions、Anthropic、Gemini 响应形状；未知/混合协议明确报错，不把缺失结果当成功。
2. 按事件与工具序号合并片段，保留 UTF-8 跨块字符、工具名称、参数与调用 ID；多工具交错返回不串参数。收到完整结束标记或协议允许的结束原因后，才交给原工具解析器。完整标记后的 keep-alive 不再阻塞收尾。
3. 截断和坏参数不会执行看似完整的前半轮工具。截断标志穿过文本工具回退，继续由原 Agent 输出预算修复逻辑处理；没有提高迭代次数、token 上限或重试次数。
4. `_readResponse / _fetchJSON` 将超时和玩家取消覆盖到正文读取，取消 reader、释放监听与缓冲；区分请求超时和玩家主动停止。原 429/5xx 重试额度、Retry-After、鉴权不重试规则保留，确定的格式错误不再当网络抖动重复请求。真实 Reader 路径对正文设 64 MiB 上限，并不等于声称内存峰值仅有 64 MiB。
5. 错误卡使用明确的协议错误说明，不输出原始响应片段或工具参数；保留原重试入口。主调用和 400 后文本工具回退共用同一个解码入口。

未修改 `editor-authoring-agent.js` 的工具执行、finish 质量闸、权限或预算，未修改 UI 的共审/放行及实际提交逻辑。`editor.html` 和 `preview/scenario-editor-reset-preview.html` 中 provider / agent 家族同步缓存戳，避免半旧半新。没有增加启动脚本或另建 Agent。

## 可复跑的验证

Node 24.14.0，Windows x64，i5-13420H、12 逻辑核。真实 Electron 为锁定的 33.4.11 / Node 20.18.3，正式 main/preload、安全沙箱不变，独立临时 userData，外网被阻断。请求由受控 `fetch`/真实 `Response`/`ReadableStream` 提供；没有调用玩家 API、真实账号或读取玩家存档。

新测试 `web/scripts/smoke-authoring-provider-stream.js` 直接加载实际模块，可用相同适配器指定基线 Git blob：

```text
node web/scripts/smoke-authoring-provider-stream.js --source-ref f102b56585faa48c47d362a91c5260f4cee1b8eb
node web/scripts/smoke-authoring-provider-stream.js
node scripts/verify-electron-bridge.js --authoring-stream
```

前者 **1 PASS / 20 FAIL，exit 1**；后者 **21 PASS / 0 FAIL，exit 0**。这是同一协议缺口的多种回归条件，不是 20 个独立游戏 Bug。覆盖正常 JSON、SSE、错误 MIME、逐字节 Unicode、多工具交错、跨行 data、文本回退、三家协议、截断/损坏/错误事件、取消、超时、并发、HTTP 重试及 39 轮实际 Agent 收尾。

真实 Electron 新模式 **12 PASS**，其中 5 项为基础桥接/安全条件，7 项为编辑器场景检查：

- 正式工坊页、默认 `runAuthoringLoop` 和默认 provider，不替换 Agent、工具执行器或提交适配器。
- 前 38 次主调用为 JSON，最后 `finish` 为 SSE；显示最终摘要、名称及国库两处真实差异，未点击批准前原剧本不变。
- 点击真实“应用到剧本”按钮后，实际名称与国库值改变；保存项目并重新加载页面，实际 IndexedDB 回读仍保留修改。
- 后半段损坏的 SSE 不执行前面的完整工具，原剧本和草稿均不被误改；错误说明不带响应正文，真实重试按钮可恢复并应用。
- 停止尚未结束的 SSE，会取消正文读取；即使前缀已含将 450 万改为 470 万的完整工具，草稿仍保持 450 万，原剧本也不变。

截图中的“执行过程 N 步”不是 API 轮次数。测试的 39 次主调用对应 UI 77 条过程记录，另有独立 `setTitle` 请求；没有将这些计成 39 个独立完整游戏流程。截图上的空人物/势力提示来自刻意使用的最小合成样本，未隐藏或放宽原校验，不代表完成了整份可玩剧本验收。

## 原始日志索引

以下目录位于 `web/dev-tools/perf-round1/`，各含 `run.json`、`stdout.log`、`stderr.log`。`run.json` 记录实际命令、HEAD、工作区状态、平台、时间、退出码以及未提交文件 hash；均为本地证据。表中命令通过 `node scripts/perf/run.cjs <label> -- <命令>` 执行。

| 实际命令 | 结果 / 退出码 | 日志目录 |
| --- | --- | --- |
| 上述新专项 `--source-ref f102...` | 1 PASS / 20 FAIL，exit 1 | `authoring-sse-baseline-final-2882c421-a933-42e4-a072-3d6adaeb6ae5` |
| `node web/scripts/run-smokes.js --grep authoring --grep guoshi --grep agent-kernel --grep ai-abort --all --no-retry --jobs 2` | 15 脚本 PASS，0 FAIL/SKIP/WAIVED；包含 21 项新回归，exit 0 | `authoring-sse-complete-topic-1a975c35-0e67-4cc0-9639-4c2abdfb4a56` |
| `node scripts/verify-electron-bridge.js --authoring-stream`，最终增强版 | 12 PASS，exit 0；含完整摘要、按钮命中和取消草稿不变断言 | `authoring-sse-electron-delivery-3081c982-75d1-41d2-a1fa-8f751e20f530` |
| `node scripts/verify-electron-bridge.js` | 生产/测试导出/重启模式 12 / 11 / 6 PASS，exit 0；基础断言有重复 | `authoring-sse-electron-standard-90d5071b-4713-4d26-8c2a-c312d18d7227` |
| `node web/scripts/lint-arch-all.js` | 13 PASS，exit 0 | `authoring-sse-arch-final-25a654f8-2824-4623-b167-983ee5abf3b7` |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS，exit 0 | `authoring-sse-parity-6c9428d7-6df1-4166-b55a-22ade31a6630` |
| `node scripts/verify-release-contract.js` | 166 PASS，exit 0 | `authoring-sse-release-contract-279639d3-2d5c-42f6-b4fc-b0f06a74fa68` |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS，exit 0；合成临时树测试，不是发布 | `authoring-sse-hot-gates-c2b3284b-c79c-4478-8b03-26d7b9e0690e` |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | PASS，exit 0 | `authoring-sse-hot-check-3a0ec568-4779-4371-9b5d-2316781b1c72` |
| 首轮 `node web/scripts/ci-smokes.js`，`8b86ddcf` | 921 PASS / 2 FAIL / 0 SKIP / 2 WAIVED，925 executed，exit 1 | `authoring-sse-ci-final-423ddc70-39cf-474f-8821-623415983202` |
| 最后全量 `node web/scripts/ci-smokes.js`，`8894e1b7` | **922 PASS / 1 FAIL / 0 SKIP / 2 WAIVED，925 executed，exit 1** | `authoring-sse-ci-delivery-0e796189-18f1-4ff5-8b95-13a3a6a5d5d4` |
| `node web/scripts/smoke-workshop-lock-recovery.js`，独立诊断 | 13 PASS，exit 0；不能替代上一行全量 FAIL | `authoring-sse-lock-isolated-f89ba663-6eb5-4c7e-94e1-a9e6bf053be5` |

最后全量结构化报告：`web/dev-tools/arch-guard/ci-BIoh5Q/smoke-report.json`，runId `f6bb528f-d374-4053-9f49-f7e96df0cec9`，head `8894e1b754ad4de5fbac50a0821e5345f406e853`，complete=true，925 个唯一结果。仅有 `smoke-workshop-lock-recovery.js` 报 `stress admission deadline exceeded`；相关锁/事务源码、压力测试、时限和豁免均未改。两项 WAIVED 仍是既有 7 项具体缺资产检查。

最终 Electron 结构化报告及已查看的截图：`web/dev-tools/electron-bridge/68206521-edb4-4db0-b67e-3c1a05b2a4de/report.json`、同目录 `authoring-final-diff.png` / `authoring-error-recovery.png`。标准三模式：`web/dev-tools/electron-bridge/93baee14-b112-474d-98de-da16fb398d44/report.json`。增强版测试在 `8894e1b7` 上运行，其未提交测试文件 hash 由运行记录保存，提交前核验一致；生产代码与全量被测树相同。

## 失败过程、兼容及交付边界

1. 最初测试确切复现 `Unexpected token 'd'`。修复后测试也抓到超时被误分类为玩家取消，已纠正，仍保留原重试额度。测试中的 `diffDraft` 名称误用改为真实导出 `computeDiff`，没有改变验收条件。
2. Electron 适配器最初把已打开的国师面板再次切成关闭；后又将独立会话标题调用误计为主 Agent 轮次。分别修正 UI 初始状态和按真实工具名区分标题调用，未替换生产流程。早期截图在逐字显示/渐入期间抓取，后来增加终态及命中等待，旧图不作为清晰终态证据。
3. 首轮全量的国师回归失败来自 4 个旧模拟 Response：`json()` 有成功数据，`text()` 却空串。已改成真实 `Response`，原图像/摘要数据与全部断言保留；没有让生产代码在空正文后偷偷再读另一份 JSON。
4. 最后全量仍有工坊安装锁压力超时。只记录独立复跑通过，不将其归因写死为环境，也没有为了绿灯扩大本轮范围去改锁。

官方生成器实际执行且 exit 0：`node web/scripts/sync-official-scenarios.js`；`node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp`。热更清单仍 1096 项，仅 provider 与两个编辑器 HTML 共 3 个条目的 hash/size 变化；保留 410 个真实未跟踪资产条目（806161938 字节）。原始剧本、版本、依赖、游戏首页启动顺序、主进程/preload 均未改。

此分支基于 main 的 924 个脚本加 1 个新专项，因此全量为 925；与未合入的营造分支 928 不能直接比较，未删除旧测试。CI 中已增加真实 Electron `--authoring-stream` 步骤，但尚未推送，不能声称远端执行过。

本轮没有真人服务商/model 质量测量、玩家完整剧本复现、签名安装包、Android 或原生 Computer Use 鼠标验收；真实 Electron DOM 点击与受控响应不冒充这些证据。也不把响应解析修复表述为消除了所有第三方端点兼容问题。未推送、未合并、未发布。
