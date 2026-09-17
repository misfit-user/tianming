# 营造补修：原诏书到实际工程的可靠写回

## 结论、范围与提交

用户授权“补、修”：补齐上一轮没有证明的普通 LLM 诏书写回链，而不是恢复营造弹窗直接扣款开工。现在已验证：营造录入 → 原建议纳入诏书（可润色、颁行）→ 回合收集 → AI 逐案裁定 → 正式财政与地区建筑写回 → 真实回执。准行、缓行、驳回、漏答有不同结果，漏答不是自动准行。

- 本轮起点：`1a1477260c2abedb797db3af4d931a3249f56b62`。
- 分支：`codex/building-channel-hardening`；独立工作树：`tianming-perf-round1`。
- 本轮获取的 `origin/main`：`f102b56585faa48c47d362a91c5260f4cee1b8eb`，没有变化；原 `tianming` 工作树及玩家数据未修改。
- `0ccd71efce36f73bf78a8715910f5e886f5638ed`：诏书身份、裁定、财政/工程回执、普通/Agent 双链与测试。
- `3a0b012196d56ccde8710c5d92afb7e71d320138`：保留旧独立 writeback stage 调用者；同步新模块对应的精确启动计数。
- **最终生产代码测试于干净的 `3a0b0121`。** 后续文档提交只增加本报告及前报告的指引，不改变被测生产代码、测试或派生物。
- 上一轮 `83c117a1`、`4e942337`、`1a147726` 三个本地提交保留，不能把未来相对 main 的 PR 描述为只有本轮两个代码提交。

本轮只在本地修复和提交；未推送、未合并、未改版本、未打标签、未打包或发布、未部署。

## 实现与不变量

| 位置 / 函数 | 修复及保留的行为 |
| --- | --- |
| `web/tm-player-core.js / _dfSubmitBuild`、`web/tm-building-orders.js / propose` | 录入仍进入原 `_edictSuggestions`。保存脱离 live 引用的核议元数据、稳定案号、世界身份、地区 ID（无 ID 时完整语义路径）。拟案/纳入/润色均不扣款、不开工。内部案账不是新的玩家操作界面。 |
| `web/tm-hongyan-edict-ui.js / _polishEdicts / _applyPolishedEdict` | 润色绑定原稿、世界、回合、加载代际及案号；机器案号可不出现在润色正文。只有当前一致的颁行稿进入后续收集。草稿、润色稿或世界变化时拒绝沿用旧绑定；只保存手稿不当成颁行。 |
| `web/tm-endturn-prep.js / _endTurn_collectInput`、`tm-endturn-ai-infer.js` | 将真实收集批次传入普通模式内部上下文，不丢失 GM/P 引用。没有模块时明确停止带案号的提交，不回退到无身份写法。读档/分叉需要重新收集，旧异步批次无写入权。 |
| `web/tm-endturn-ai.js / SC1 schema、final-rule prompt、_runIncrementalSc1Retry` | 逐案返回 `building_decisions`，AI 负责 approve/defer/reject 与裁定原因。缺答可使用一次增量补问，和原 SC1 额外修复共用额度；固定身份上下文仍计入最终预算，超预算失败关闭，不绕预算。 |
| `web/tm-building-orders.js / execute / begin / verifyReceipts` | 准行调用真实 `CustomBuildAgent.approveBuild`、`FiscalEngine` 和 `BuildingWorks`；核验真实地区工程和 `balance === money === ledgers.money.stock`。重复回包/重新纳入不重复开工扣款；未知/重名身份不猜测。主写回失败时撤销前置营造扣款、工程、案账，包含主 applier 恢复了克隆树的情况。 |
| `web/tm-endturn-apply.js / writeBack`、`tm-endturn-apply-stages.js / _applyCore_reconcile` | 正式落账回执与主 applier 联动；只把实际领域回执送入一致性验证，不相信 AI 自填回执。阻止明确同案的重复支出/旧 `building_changes` 和影子 `activeProjects`。保留不相关写入及原主写回校验。 |
| `web/modules/ai-change-applier/validators.js` | 原建筑一致性校验识别并复验真实回执；原财政诊断计入已经实际支付的营造金额，不再次扣款。伪造回执及未开工却宣称已开工的受测情况仍被拒绝。 |
| `web/tm-endturn-agent-mode.js`、`tm-endturn-agent-write-tools.js / building_project` | Agent 模式复用同一案号和正式领域入口；保留 engine-first 回合时序。普通 LLM 模式不依赖 Agent 工具才可创建工程。 |
| `web/phase8-formal-map-dossier.js / bkYingzao`、原 `_turnReport` | 使用既有营造志及回合记录显示待核办、未开工、未准、缓行与原因，不另设独立控制面板。 |

保留原有可用银两支付加欠额的资金短缺政策、工期、工程完成效果、养护/修缮和人才/制度语义。明确 ID 对应的重复账项被移除，不做任意自然语言财政意图的猜测去重。旧建筑及旧付款不回溯重算；已成功工程的案号回执随存档保留，回放幂等。损坏或重复的案账不覆盖，回滚失败标为待恢复，不自动再次扣款。

## 测试方法与真实边界

环境：Windows x64，Intel i5-13420H，12 逻辑核；CLI Node `24.14.0`；锁定 Electron `33.4.11`，内置 Node `20.18.3`。Electron 使用正式 main/preload、独立临时 userData、真实 BrowserWindow/DOM/IPC；外网被阻断，AI 返回是受控响应，不使用玩家 API key 或存档。

- `web/scripts/smoke-building-order-writeback.js`：**38 PASS**。调用真实财政、营建与案账实现，覆盖身份定位、遗漏/拒绝、重复、读档分叉、换局、付款/建造故障回滚与恢复、并发重入、真实/伪造回执、现有营造志输出。
- `web/scripts/smoke-building-order-sc1.js`：**9 PASS**。执行实际请求预算/增量修复实现和实际 AI-infer 初始化；验证缺答补问、原共享修复上限、过期拒绝、强制身份上下文超预算失败。部分入口由 AST 提取真实函数/分支，不是重写一个替代实现。
- `scripts/electron/building-orders-cases.cjs`：接入既有营造专项，共 **27 PASS**（包含先前 20 项及新增 7 项）。真实点击目录营造、原建议纳入；受控返回的 requestId 从实际发出的请求读取；调用真实普通模式 transport/JSON parser 和完整 `writeBack`。验证扣 5000 两、只创建一次、3 次真实 tick 完工并生效，漏答/驳回不建工程、主写回失败回滚后重试、实际润色颁行不带机器案号仍可创建。
- Electron 的受控普通模式测试显式构造该专项 SC1 请求，再走真实预算/transport/parser/writeBack；完整 `_callEndturnAI` 外层所有提示构造及整局所有回合阶段不是一次不加干预的玩家端到端实测。生产提示注入及缺答补问另由 9 项 SC1 行为测试覆盖，不将两者混称为整局实机验收。
- 另执行原润色专项 **15 PASS**；标准 Electron 生产/测试导出/重启模式为 **12 + 11 + 6 PASS**。这些基础桥接检查有重复，不是 29 个独立完整游戏流程。

此前在 `1a147726` 上的七项只读诊断保留于 `web/dev-tools/perf-round1/building-recognition-review-complete-54ca8192-b6d2-4497-b4bc-24c16f08feea/`。其 exit 0 表示诊断完成，不表示缺陷关闭；本轮未把旧叶子提取器当成新链路的验收器。此前 `EndturnValidity` 接受不完整内容，也不代表完整主 applier 一定会接受——本轮真实完整写回测试实际发现并修复了下述一致性校验衔接问题。

## 执行证据索引

以下目录均位于 `web/dev-tools/perf-round1/`，包含 `run.json`（命令、HEAD、工作区、平台、时间、退出码、未提交文件 hash）、`stdout.log`、`stderr.log`。是本地原始证据，没有上传或冒充远端 CI。表中“标签”加目录 UUID 即实际目录名。

| 实际命令（均由 `node scripts/perf/run.cjs <标签> --` 记录） | 结果 / exit | 日志目录 |
| --- | --- | --- |
| `node web/scripts/ci-smokes.js`，初轮 `0ccd71ef` | 922 PASS / 4 FAIL / 0 SKIP / 2 WAIVED，928 executed；exit 1 | `building-orders-ci-fa822a88-f8dd-4a4f-a472-92643a44b0f8` |
| `node web/scripts/ci-smokes.js`，最终 `3a0b0121` | **926 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，928 executed；exit 0**。7 项具体缺资产检查豁免，未扩大规则 | `building-orders-ci-final-aa0e4004-165c-4abe-92cd-199f3e473857` |
| `node web/scripts/run-smokes.js --grep building --grep custom-build --grep globalrules-build --grep talent-s4 --grep yingzao --grep sc1-stream --grep ai-change-applier-module --all --no-retry --jobs 2` | 15 PASS / 0 FAIL / 0 SKIP / 0 WAIVED；exit 0；之后最终全量再次执行这些测试 | `building-orders-scope-final-766291d1-9074-4af4-a1e8-8432358660ba` |
| `node web/scripts/run-smokes.js --grep ai-writeback-integrity --grep no-source-death --grep startup-phase-observability --all --no-retry --jobs 2` | 3 PASS / 0 FAIL / 0 SKIP / 0 WAIVED；exit 0 | `building-orders-compat-86ebc042-ac5d-488f-8ef5-d08eb056089c` |
| `node scripts/verify-electron-bridge.js --building-appraisal` | 27 PASS，0 FAIL；exit 0；干净 `3a0b0121` | `building-orders-electron-committed-67264285-d94a-4bde-a7fc-040e213299bf` |
| `node scripts/verify-electron-bridge.js --edict-polish` | 15 PASS，0 FAIL；exit 0；干净 `3a0b0121` | `building-orders-edict-polish-e96dd50d-762a-4898-91c0-910f0ca9e00b` |
| `node scripts/verify-electron-bridge.js` | 三模式 12 / 11 / 6 PASS；exit 0；干净 `3a0b0121` | `building-orders-electron-standard-27b92d89-c769-4c45-8e97-6d243af837d0` |
| `node web/scripts/lint-arch-all.js` | 13 PASS；exit 0；干净 `3a0b0121` | `building-orders-arch-delivery-cb6d5132-b5f0-4709-8733-1e77669e3a76` |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS；exit 0 | `building-orders-parity-7f598b39-eeda-4c60-8eef-6e0231d6d853` |
| `node scripts/verify-release-contract.js` | 166 PASS；exit 0；干净 `3a0b0121` | `building-orders-contract-final-0da90ffe-28e8-4234-a89c-d6cb3118b5e6` |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS；exit 0；只验证合成临时树的构建闸门，不发版 | `building-orders-hot-gates-f2686ccd-73a8-46a2-b425-f7ff763da29e` |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | PASS；exit 0；687 在场文件、410 个缺席未跟踪资产条目保留 | `building-orders-hot-check-a4aff793-c715-46e7-9c16-bb2f4429d1fc` |
| `node web/scripts/build-renderer-modules.js --check` | 逐字节可复现，337002 bytes；exit 0 | `building-orders-bundle-check-88442470-dd24-4341-9568-ee1e63f245df` |

最终全量结构化报告：`web/dev-tools/arch-guard/ci-dkz2dm/smoke-report.json`；runId `6b2c033c-37ea-4ab5-bc2b-5f2cabe6f157`，head `3a0b012196d56ccde8710c5d92afb7e71d320138`，complete=true，928 个唯一结果。新的两份专项原始输出也在此报告内（38 与 9 项）。

最终真实 Electron 结构化报告：

- 营造：`web/dev-tools/electron-bridge/51b21f35-5298-46ed-9683-b88b15dddadf/report.json`。
- 润色：`web/dev-tools/electron-bridge/09bd0982-cf45-4abb-8603-955aad691e53/report.json`。
- 标准三模式：`web/dev-tools/electron-bridge/ba1c2461-887c-46c7-9b66-77ded485cc59/report.json`。

## 失败记录与修正说明

1. 实际完整 Electron writeback 首先报 `construction_build_missing`，不是只缺一句提示。旧严格校验不认识营造领域回执，导致主写回拒绝。已修为先在可撤销领域事务中落账、验证真实回执、主 applier 成功后提交提示；没有删除该校验或把失败强改成功。诊断原件：`building-orders-electron-diagnostic-17f7fb09-d17a-43dd-a17c-28b894b489f4`。
2. 首轮全量两份旧独立 stage 测试报 `ctx.apply.buildingReceipts` 缺字段。`3a0b0121` 对合法无营造上下文调用保留空回执语义；原两份死亡/写回断言未修改。
3. 新模块使 eager 409 → 410。启动观察测试同步成精确 410，并新增“唯一加载 + 位于实际营建 provider 后”断言；不是放开无上限计数。原 8 deferred、五个 feature 和所有旧规则继续检查。
4. 初次架构检查发现新模块不应重新初始化 canonical `TM`；改为使用已存在 provider，未扩大 overrides 或白名单。原日志：`building-orders-arch-first-96484a3c-0354-41c7-8ea3-d59f79a43bfc`。
5. 测试适配器曾漏初始化 `TM.Endturn.AI`、误用预算诊断字段 `totalTokens`（实际为 `finalTotalTokens`）、Electron 字符串模板换行未转义；均修测试适配，不改变领域验收预期。原日志前缀 `building-orders-sc1-first`、`building-orders-sc1-second`、`building-orders-electron-first` 保留。
6. 初轮工坊锁压力测试 `stress admission deadline exceeded`。工坊锁/事务/测试源码相对本轮起点未改；最后全量运行 13 个工坊锁检查通过（含四进程 100 次共享索引提交）。保留初轮失败，不将环境相关的波动宣称为本轮修复成果，也没有改变时限或豁免。

## 派生物、兼容和未验证范围

实际使用的官方生成命令（均 exit 0）：

```text
node web/scripts/build-renderer-modules.js
node web/scripts/build-startup-phase-manifest.js
node web/scripts/sync-official-scenarios.js
node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp
```

启动清单 **410 eager / 8 deferred**：明确新增一个营造回执内部模块，没有新游戏操作入口。热更清单 **1097 项**：新增 `tm-building-orders.js`，16 个原有文件 hash/size 更新，410 个从原工作树只读取得的未跟踪资产条目（806161938 字节）保留。大量 startup diff 是后续次序索引加 1。官方两份剧本正文、package/lock、版本字段、主进程/preload 与部署脚本均未改，不手写 hash、不改发布规则。`git diff --check` 通过。

明确边界：

- 本轮可靠绑定覆盖**从营造系统录入、沿原诏书渠道提交的营造案**。任意徒手输入、没有案号绑定的自由文本仍由既有识别路径处理，不承诺所有自然语言命令 100% 识别。
- AI 仍可以缓行或驳回；一次补问耗尽后未核定则明确不施工，不为提高成功率绕过 AI 裁定、资金归属或错误保护。
- 没有真实服务商模型成功率/长局质量测量，没有原生 Computer Use 鼠标实操、签名安装包或 Android 验收。真实 Electron 受控集成不冒充这些证据。
- 只做注册营造领域的小事务及主 applier 失败联动，不声称所有游戏模块都获得通用跨模块崩溃事务；整个回合仍依赖既有回合保护与 canonical 保存事务。
- 没有重做建筑分阶段玩法、劳役供给、暂停督办、财政侧栏或独立营造操作页。
