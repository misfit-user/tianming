# 天命 AI 记忆与过回合可靠性升级：统一收尾报告

## 一、结论

本地工程收尾已通过本报告列出的验证：长期记忆与双模式读取、能力适配、完整响应恢复、主存档及桌面写入边界、迟到结果保护、启动依赖和模块拆分均已有实现与测试证据。没有把失败提示隐藏起来充当成功，也没有为了提高表面成功率而删正文、降低推演深度或取消世界校验。

设备：LAPTOP-AV4J1O7I。项目：`C:\Users\37814\Desktop\tianming`。分支：`codex/audit-20260905`。HEAD：`5bef8008fe3592e8c026fbbe3bf03345b1cadf2d`。最终验证时间：2026-09-19T15:23:34.958Z。

本报告区分工程验证与生产运行：未调用真实付费 AI API，未提交、推送、打包或部署；测试通过不代表所有供应商和所有真实长局都已验证，也不保证断网、磁盘满或服务端持续故障时仍能完成推演。

## 二、整体完成内容

**长期记忆与模型适配。** 保留原有活跃记忆层并增加有界长期档案，支持事件、事实、人物经历、关系、承诺、决策依据、因果经验、制度、领土、经济、未解线索和纠错等十二类。两种回合模式共用受治理的检索与来源信息；独立 Agent 接入证据展开和关联追查。主、次 API 的能力证据分开，网络失败与能力失败分开，读取和自主规划仍受玩家开关及预算约束。

**完整响应跨刷新恢复。** 在已确认回滚的条件下，合格的完整响应保存到独立本地 IndexedDB；刷新后只有同一世界、完整输入指纹、模型配置、输出限制和调用次序匹配，才可以复用。仍运行原有解析、业务校验、动作应用和唯一提交器。保存的是响应，不是重复执行财政、任免或战争副作用的指令队列。

持久候选保留期限为三十分钟，最多六十四条、累计八百万序列化字符；不完整、截断、拒答或校验不明的响应不能作为完整检查点。容量不足或恢复存储失效时使用原有完整请求路径，不裁短内容。提供关闭持久化与清除候选的入口。没有把 API 密钥或原始提示词写进这个检查点库。

**未知写入结果自动核对。** 不再把超时直接当作没有写入。收到真实迟到提交事件后，重新读取 autosave 和 slot_0，将两份完整内容与本回合冻结状态逐字核对；一致才完成原事务和展示，不重跑 AI。真实中止则由原回滚入口恢复。没有终态或内容不一致时保持写入保护，不能凭一个任意回执解锁。

**请求和保存等待。** 普通、流式和原生工具请求共用取消、排队与恢复预算。主数据库打开、读取、写入、压缩、校验，附加快照、桌面分卷和自动档均区分本地等待结束与真实提交结果，避免重复发送、旧回执污染新存档和提交后误回滚。

**无损减少本地计算。** 记忆评分缓存只依据精确文本，词项与多样性排序不变；保存准备阶段跳过的是最终输出过滤器本就丢弃的二十三份镜像复制。原始字段、正文、历史记录、输出顺序和恢复语义仍由完整对照测试检查。

**工程装载收尾。** 缺失的启动模块和派生清单已同步；大文件按原函数内容拆分，保留加载顺序和原接口。旧备份源码从运行时扫描目录移出后仍逐文件保留，不删除原证据。已安装的 js-yaml 从 4.3.1 对齐到项目既有锁文件指定的 4.3.2，下载包完整性已核对，没有修改依赖清单或执行安装脚本。

## 三、最终验收

| 检查 | 结果 |
|---|---|
| 收尾基线全量 JavaScript smoke | 1042/1050 通过 |
| 最终全量 JavaScript smoke | 1058/1058 通过；失败 0，豁免 0 |
| 架构检查 | 13/13 通过 |
| 另行执行的 .mjs 检查 | 7/7 通过 |
| 质量边界及等内容函数迁移核对 | 30/30 通过 |
| 本次收尾涉及文件 | 42 个，语法与最终哈希核对通过 |
| 本轮 git diff --check | 退出码 0 |
| 官方剧本派生对账 | 通过 |
| 实际启动清单 | 445 个立即加载脚本；生成器检查通过 |

本次测试期间源文件变化数：0。全量测试、附加检查和真实浏览器测试使用了记录在 `final-tested-inputs.json` 中的源文件，并在结束后重新核对。没有把上次中断或失败的记录冒充最终通过记录。

关键新增检查：

- `smoke-recovery-vault.js`：{"pass":7,"fail":0,"total":7}
- `smoke-final-save-reconcile.js`：{"pass":10,"fail":0,"total":10}
- `smoke-memory-scoring-equivalence.js`：{"pass":244,"fail":0,"seed":81731,"mode":"exact JSON equality, unchanged scores and ordered evidence"}
- `smoke-final-recovery-races.js`：{"pass":6,"fail":0,"total":6}

质量边界核对逐项结果：

- unchanged web/tm-endturn-validity.js：通过
- unchanged web/tm-endturn-mode-contract.js：通过
- unchanged web/tm-endturn-agent-mode.js：通过
- unchanged web/tm-endturn-ai-infer.js：通过
- unchanged web/tm-endturn-prompt.js：通过
- unchanged web/tm-endturn-pipeline-steps.js：通过
- unchanged web/tm-endturn-pipeline-executor.js：通过
- unchanged web/tm-ai-infra.js：通过
- unchanged web/tm-ai-infra-retry.js：通过
- unchanged web/tm-memory-envelope.js：通过
- unchanged web/tm-memory-retrieval.js：通过
- unchanged web/tm-memory-context-compiler.js：通过
- unchanged main-impl.js：通过
- unchanged preload-impl.js：通过
- unchanged main-turn-data-commit.js：通过
- exact relocated function _aiPolicyText：通过
- exact relocated function _aiPolicyAmount：通过
- exact relocated function _aiPolicyRegion：通过
- exact relocated function _aiPolicyRatioLabel：通过
- exact relocated function _aiStructuredPolicyText：通过
- exact relocated function _aiStructuredPolicyParams：通过
- exact relocated function _aiStructuredPolicyExpectedType：通过
- exact relocated function _buildSc1JsonSchema：通过
- exact relocated function _buildSc1bJsonSchema：通过
- exact relocated function _buildSc1cJsonSchema：通过
- exact relocated function _buildSc1qJsonSchema：通过
- unchanged function _buildSaveState：通过
- unchanged function _prepareGMForSave：通过
- unchanged function _tmCommitEndTurnTransaction：通过
- unchanged function _tmRollbackEndTurnTransaction：通过

## 四、性能依据与真实浏览器验证

| 本地检索评分对照 | 修改前 | 修改后 |
|---|---:|---:|
| 同一组八个查询，中位耗时 | 14516.935 ms | 113.768 ms |
| 完整排序结果与分数 | 完全一致 | 完全一致 |

上述对照使用 360 条合成记录，每个查询保留 20 条结果，两次预热后计七次；输出 SHA-256 一致。它只测本地词项评分、结果融合与多样性筛选，不是整个回合或真实模型响应速度。八十组不同数据及纠错输入另做了 244 次精确结果核对。

真实 Edge 使用独立测试配置与原生 IndexedDB，验证写入、页面实际刷新、完整响应逐字相等、模拟推演仅一次、用量不重复计入和显式清除。浏览器结果：`{"ok":true,"checks":["native IndexedDB commit","real page reload","full text equality","single inference","usage not duplicated","explicit clear"],"calls":1,"chars":17000}`。测试来源哈希与最终源码匹配；没有使用玩家存档或日常浏览器数据。

## 五、测试环境修正及磁盘情况

测试保留全部原断言和完整剧本内容，修正了现代浏览器 currentScript/URL 等测试接口；所选官方剧本由完整字节数和 SHA-256 校验，不把另外两套无关世界预先塞入同一个开局。完整存档压力检查按世界隔离进程并及时释放比较用对象，仍覆盖两套官方剧本、短局和八百回合长历史、两种保存格式、完整恢复与异常路径；外层原有三百秒时限没有扩大。

收尾时 C 盘曾实际耗尽，导致测试异常和写文件失败。仅将本任务生成的测试证据迁到 D 盘、逐文件校验后建立原路径连接；已有原备份位于 D 盘，游戏源码和玩家文件没有迁移。后续测试临时目录使用 D 盘，仅影响测试进程，不改系统设置或用户数据。C 盘仍需保留实际存档所需空间；本次不会擅自清理个人文件。

磁盘写满中断过一次压力测试文件更新。该文件已从开工备份和六次已记录的变更精确重建，SHA-256 与中断前最后记录一致，再应用后续修复并重新验证。重建记录在 `pressure-source-recovery.json` 与 `disk-interruption-restored.json`。最终代码中不保留这次中断产生的空文件。

## 六、交付边界

本次收尾的源码与上述工程验证已经完成；不额外声称完成真实付费模型长局、手机真机全流程、生产安装包或发布验收。没有可确认的底层提交/中止事件时，保护机制仍会暂停写入，而不是凭猜测制造成功。跨刷新缓存可减少符合严格匹配条件的重复请求，不保证每个回合都命中，也不改变供应商的计费和可用性。

仓库仍是原本的本地开发分支与未提交工作区。未执行 push、release、安装包构建或线上部署；网页资源修改也不会自动更新已安装客户端的 preload/main。

## 七、文件、证据和复核命令

本地报告：`C:\Users\37814\Desktop\tianming\docs\endturn-final-closeout-20260919\README.md`。该路径保持可用，测试证据实际位于 `validation-workspace.json` 记录的 D 盘工作目录。

关键证据：`verification.json`、`final-full-tests.json`、`final-run-status.json`、`final-tested-inputs.json`、`final-architecture.log`、`browser-realtime-result.json`、`memory-benchmark.json`、`own-diff-check.json`、`changes.json`、`yaml-sync.json`。之前失败的全量报告已保留，未从历史中删除。

复核命令：

```powershell
node web/scripts/run-smokes.js --all --jobs 2 --no-retry --report docs/endturn-final-closeout-20260919/recheck.json
node web/scripts/lint-arch-all.js
node web/scripts/verify-official-scenario-parity.js
node docs/endturn-final-closeout-20260919/verify-final.mjs
```

复核前应使用有足够空间的临时目录，并确认源码未被其他窗口继续修改；新的改动需要对应的新验收，不能沿用旧哈希证明。

本次收尾文件及短哈希：

| 文件 | SHA-256 前十二位 |
|---|---|
| `web/generated/tm-ai-change-applier.bundle.js` | `fd30e6ec954c` |
| `web/index.html` | `458b4b113a86` |
| `web/modules/ai-change-applier/core.js` | `c143114e5a72` |
| `web/modules/ai-change-applier/policy-format.js` | `e3d7a0c756ca` |
| `web/phase8-formal-map-dossier.js` | `1262f98c3b70` |
| `web/phase8-formal-map.js` | `ea326ebf9eab` |
| `web/scripts/fixtures/memory-hybrid-reference.js` | `ff83dd4173e9` |
| `web/scripts/headless-smoke.js` | `39a832f55153` |
| `web/scripts/lib-perf-round1.js` | `23e5295e2cc4` |
| `web/scripts/lib-recovery-vault-fixture.js` | `fe4295d95b4a` |
| `web/scripts/lib-save-commit-boundary.js` | `8fb22037a01f` |
| `web/scripts/run-smokes.js` | `9da339535dc0` |
| `web/scripts/smoke-building-appraisal-compat.js` | `02e45393a0c5` |
| `web/scripts/smoke-endturn-baseline-helpers.js` | `9a4120651089` |
| `web/scripts/smoke-final-recovery-races.js` | `54329965197d` |
| `web/scripts/smoke-final-save-reconcile.js` | `65e2d8381c9a` |
| `web/scripts/smoke-full-turn-flow.js` | `913216d7b8fb` |
| `web/scripts/smoke-memory-scoring-equivalence.js` | `7f68949a989e` |
| `web/scripts/smoke-memory-turn-output-contract.js` | `89e294053c66` |
| `web/scripts/smoke-perf-save-preparation.js` | `9c4808f76230` |
| `web/scripts/smoke-phase8-map-live-panels.js` | `f75aee85662d` |
| `web/scripts/smoke-phase8-office-standalone.js` | `64a6af5b0a55` |
| `web/scripts/smoke-recovery-vault.js` | `79d11df680cc` |
| `web/scripts/smoke-sc1q-sc19-upgrade.js` | `1d423dcaae2b` |
| `web/scripts/smoke-search-empty-state.js` | `abd8205decba` |
| `web/scripts/smoke-start-game-data-integrity.js` | `c3c225a7ceb8` |
| `web/scripts/smoke-startup-phase-observability.js` | `d9a0b874c418` |
| `web/scripts/smoke-tang840-opening-ledgers.js` | `3f78c63f8e44` |
| `web/scripts/verify-all.js` | `3d1100402a77` |
| `web/startup-script-phases.json` | `54c4e5bc8144` |
| `web/tm-endturn-ai-sc1-budget.js` | `f097b48d9ff1` |
| `web/tm-endturn-ai.js` | `129bc73d9bb7` |
| `web/tm-endturn-core.js` | `76c28f13561d` |
| `web/tm-endturn-recovery-vault.js` | `a1e2aac215dd` |
| `web/tm-endturn-render.js` | `5ef619119ff7` |
| `web/tm-endturn-response-recovery.js` | `6461ccfe9f0b` |
| `web/tm-endturn-save-reconcile.js` | `bd29f9f75b92` |
| `web/tm-endturn-timing-ledger.js` | `baccf9485321` |
| `web/tm-memory-hybrid.js` | `1080e50c78fa` |
| `web/tm-save-lifecycle.js` | `a43d88c99254` |
| `web/tm-start-runtime-manifest.json` | `d53cb244d2d8` |
| `web/tm-storage.js` | `03407f4cf862` |

原备份和并行改动副本均保留。后续恢复应逐文件比对 `changes.json`，不要整目录覆盖，避免抹掉地图、界面等其他窗口的修改。
