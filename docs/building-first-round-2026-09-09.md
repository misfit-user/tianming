# 营造第一轮：回归原渠道与异常保护

后续补修见 `docs/building-order-writeback-2026-09-10.md`：本文件记录第一轮当时的范围与结果，不能用其中 Agent 工具测试代替普通 LLM 诏书写回验收；后续已单独补齐并验证该链路。

## 范围与基线

- 用户同意建筑系统复核后的第一轮改进；只做本地实现、回归与提交。未授权本轮推送、合并或发版。
- 实际起点：`main / origin/main@f102b56585faa48c47d362a91c5260f4cee1b8eb`。
- 独立工作树：`tianming-perf-round1`；分支：`codex/building-channel-hardening`。原 `tianming` 工作树和玩家数据未修改。
- 实现提交：`83c117a17e2ca034c917689dd552fb14984a2275`。
- 测试前置条件补全：`4e942337e4cd8ecbcf92519e8a06bc217054a56f`，仅将两份旧领域集成测试接入真实财政引擎，并增加真实扣款断言。
- 后续文档提交不改变上述被测生产代码。

## 实际改动

### 1. 核议回到原诏书通路

`web/tm-player-core.js`：`_dfSubmitBuild`、`_dfAppraiseCustomBuild`、`_dfApproveBuild`。

原核议帖的“准奏开工”直接调用领域接口扣钱、创建建筑。现在旧函数名仅作兼容入口，按钮改为“录入核议建议”，只追加 `GM._edictSuggestions`。名称、规制、核议费用、工期、核定效果账目和国是参考一并保存到建议正文，使用既有“纳入”操作进入正式诏书，并由既有回合输入收集器接收。没有新增独立的待执行队列。

`_recordPlayerActionSignal('construction', ...)` 不再在拟案时调用，避免把未颁行建议当成已发号施令。原回合渠道仍负责登记实际命令。核议、录入和纳入都不会扣款、创建建筑或开始倒计时；AI 仍可根据颁行时的局势裁定结果，核议不构成机械兑现承诺。

### 2. 旧核议不能串局、串请求或串规制

复用 `_tmCaptureWorldLease / _tmWorldLeaseCurrent`，核验 GM/P 引用、campaign/timeline、sid、回合和加载代际；另核验当前弹窗实例、请求实例及三个输入字段。关闭/重开、修改输入和新请求都会使旧结果失效。

`web/tm-custom-build-agent.js` 为核议、后续轮次及谏官覆核传递已有 transport 支持的 AbortSignal。取消只是减少无用请求；即使受控网络桩忽略取消，旧回包仍无法通过提交前校验。临时生命周期引用不参加核议结果的 JSON 序列化，旧存档无需迁移。

### 3. 正式营建落账不再将支付失败当成功

`CustomBuildAgent.approveBuild` 保留给既有 `TM.Endturn.AgentWriteTools.handle('building_project', ...)` 等正式领域调用者。缺财政引擎、支付异常、明确失败或无有效回执时返回失败，不继续创建建筑或新开工记录；传入真实 `GM` 给 `FiscalEngine.spendFromGuoku`，不误扣另一个全局世界。

保留原先“实际扣可用银两 + 返回欠额”的短缺政策，不改成新的足额开工规则，也未改变倒计时、维护费率、灾损概率、人才或制度机制。本轮不声称实现了财政扣款与所有后续对象写入的通用跨模块事务。

### 4. 营造志显示与实际效果一致

`web/tm-building-works.js` 的 `effectiveBuildingFlowPct` 同时供实际 RegionStatus 投放及 `buildingLedger` 使用，保持实际单建筑上限 6%。原先五级建筑界面可能显示 15%，实际仅给 6%；现在不会夸大。建设中、失修、半损时不显示正在生效的工成之利。

`web/phase8-formal-map-dossier.js / bkYeCard` 独立展示工成之利，不再因没有存量增量而漏掉；说明地方养护费用、修缮费及停效状态。修缮显示与实际 tick 共用计算函数，仍为造价 30%、最低 20 两。既有中央开工支付与地方维护/修缮的所有权不变。

## 验证与证据索引

环境：Windows x64，Intel i5-13420H，12 逻辑核；CLI Node 24.14.0。真实 Electron 为锁定 33.4.11（内置 Node 20.18.3），未打包，独立临时 userData，阻断真实外网，受控 HTTP 返回与时序，不使用玩家 API key/存档。

所有 `scripts/perf/run.cjs <label> -- <command>` 日志目录均在 `web/dev-tools/perf-round1/<label>-<uuid>/`，包含 `run.json`（HEAD、工作区状态、命令、平台、时间、退出码及改动文件 hash）、`stdout.log`、`stderr.log`。这些是本地证据，不冒充远端 CI。

| 实际命令/范围 | 结果 | 日志目录后缀 |
| --- | --- | --- |
| `node web/scripts/smoke-building-original-channels.js --source-ref f102b56585faa48c47d362a91c5260f4cee1b8eb` | 0 PASS / 16 FAIL，exit 1；同一测试读取真实基线 Git blob | `building-original-baseline-verified-d2c4b5df-d06b-4315-8941-a2d44e339791` |
| `node web/scripts/smoke-building-payment-ledger.js --source-ref f102b56585faa48c47d362a91c5260f4cee1b8eb` | 4 PASS / 11 FAIL，exit 1；正常扣款、原短缺政策等正向对照通过 | `building-baseline-final-payment-a450ccb3-5f1e-4316-9af6-bcf2045b2084` |
| 新增两份实际实现行为回归 | 16 + 15 PASS，0 FAIL，exit 0；由下面营建主题 runner 全部执行 | `building-related-final-873bb2e4-50a6-4be2-a830-7ac20fec6375` |
| `node web/scripts/run-smokes.js --grep building --grep custom-build --grep faction-build --grep yingzao --all --no-retry --jobs 2` | 10 PASS / 0 FAIL / 0 SKIP / 0 WAIVED，exit 0 | 同上 |
| `node scripts/verify-electron-bridge.js --building-appraisal` | 20 PASS，exit 0；正式 main/preload/DOM、按钮命中、真实纳入和回合收集、正式工具落账、迟到回包和输入失效 | `building-electron-final-d32c9c9c-35d4-4ebe-972e-821f9fd262f2` |
| `node scripts/verify-electron-bridge.js` | 生产模式 12 / 测试导出模式 11 / 重启模式 6 PASS，三个模式均 exit 0；累计 29 条检查而非 29 个独立完整游戏流程 | `building-electron-standard-2ce76c1e-a843-481f-ba67-c704b102043a` |
| `node web/scripts/lint-arch-all.js` | 13 PASS，exit 0 | `building-arch-final-e02d2969-6290-4438-9692-87d69a552e29` |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS，exit 0 | `building-parity-82e005ae-c667-4b93-a45b-8a3ad4d8cd18` |
| `node scripts/verify-release-contract.js` | 166 PASS，exit 0 | `building-release-contract-82f7f93f-b0ef-4d14-91a3-12841f94162a` |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS，exit 0；仅合成临时资源验证构建闸门，不是发版 | `building-hot-gates-922e92dd-50c3-42a9-ace3-d8505c8ebcc8` |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | PASS，exit 0 | `building-hot-baseline-check-3bb2e596-820b-4519-afe2-e3b1b7bcb168` |
| 首轮 `node web/scripts/ci-smokes.js`，实现提交 83c117a1 | 921 PASS / 3 FAIL / 0 SKIP / 2 WAIVED，926 唯一脚本全部执行，exit 1 | `building-full-ci-81601ad4-1c2e-436e-8623-5184761e9ab7` |
| 最终 `node web/scripts/ci-smokes.js`，测试补全提交 4e942337 | **923 PASS / 1 FAIL / 0 SKIP / 2 WAIVED**，926 个脚本全部执行，exit 1；唯一失败为未修改的工坊锁压力测试 | `building-full-ci-final-58f320fd-93a2-49ec-8b3e-790312478a8f` |
| `node web/scripts/run-smokes.js --grep globalrules-build --grep talent-s4 --all --no-retry --jobs 2` | 补齐真实财政依赖后 2 PASS，0 FAIL，exit 0 | `building-domain-integrations-219b4092-6c39-4804-9d96-2f68539fe72d` |
| `node web/scripts/smoke-workshop-lock-recovery.js` | 独立复跑 13 PASS，exit 0 | `building-lock-isolated-92b14541-c09a-4bf3-9ab4-d09aa3d492e2` |

真实 Electron 专项结构化报告：`web/dev-tools/electron-bridge/d38aaad9-1e2b-45e2-b971-236c8653cc1d/report.json`。页面截图经过实际查看；第一次抓取纳入后画面时尚未等待绘制，随后补上两帧等待并重跑以上专项，不能用那张旧画面证明纳入后的视觉状态。

首次单测的轻量 DOM 适配器漏掉 `preventDefault` / `_closeEdictMenu`，随后接入完整实际辅助函数；没有删除行为断言。现有 `smoke-building-appraisal-compat` 接入实际世界租约，唯一产品预期变化是按钮从直接开工改为明确录入原渠道；HTTP 错误、重试上限、各协议格式和文本转义断言保留。

首轮全量的三项失败：两份制度/人才旧测试没有加载 FiscalEngine，依赖了原本缺引擎也能免费开工的缺陷；现已使用真实财政引擎及足够的合成余额，追加扣款归属断言，原制度/人才效果断言全部保留。第三项是既有 `smoke-workshop-lock-recovery` 的 `stress admission deadline exceeded`，单独执行通过；其测试、锁、事务和文件模块相对起点逐字节未改。没有扩大豁免或修改锁的等待时限。

标准 Electron 报告：`web/dev-tools/electron-bridge/56d9dae6-0767-49ac-8456-273b63f6ff01/report.json`，实际被测 HEAD 为 `4e942337`。营造专项的运行 HEAD 是实现前基线但记录了改动文件 SHA-256；提交后已逐个对照四份生产 JS 和入口 HTML，均与被测字节一致。后续变化只有清单生成物、两份财政测试夹具及文档，没有把旧测试结果冒充新生产代码验证。

最终全量报告：`web/dev-tools/arch-guard/ci-319tPm/smoke-report.json`，runId `22e3d561-c7cc-4222-9157-70f6da970a3a`、HEAD `4e942337e4cd8ecbcf92519e8a06bc217054a56f`。剩余失败仍为工坊锁 `stress admission deadline exceeded`；全量门禁仍是红，不能用独立复跑成功替代。两项既有资产豁免保留原具体检查规则，未增加豁免。营造相关全部通过，不继续在此分支扩大到工坊优化。

`git diff --check` exit 0；交付检查未发现无关源码、版本修改、密钥、玩家存档或测试临时资产被暂存。报告文件是最后的独立文档提交，运行时代码与最终被测树相同。

## 派生物、兼容及未做范围

实际执行官方生成器（均 exit 0）：

```text
node web/scripts/build-startup-phase-manifest.js
node web/scripts/sync-official-scenarios.js
node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp
```

启动清单仍 409 eager / 8 deferred；增加的只是实际新 helper provider 索引。热更清单仍 1096 项，保留 410 个只读取原工作树的真实未跟踪资产条目（806161938 字节），只刷新 6 个变化文件的 hash/size，未改版本号或校验规则。官方剧本正文未改。`phase8-formal-map` 两个成员一起更新缓存戳；没有批量改行尾、PowerShell、依赖或打包入口。

旧建筑、已付费用、欠额和 `_pendingCustomBuilds` 记录均保留；不回溯扣钱、不把旧核议自动当成新局命令。复用现有建议、诏书、世界租约与领域工具，未增加持久化协议。核议 UI 缺租约设施时明确拒绝，不回退到无身份开工。

未做：分阶段施工玩法、劳役供给、政策/财政侧栏、施工暂停或督办新入口、工期重算、全局经济模型、通用业务事务框架。未实测真实服务商模型对每份诏书的执行质量、未做完整长局/安装包/Android 验收，未使用原生电脑鼠标自动化；Electron 结果是实际未打包窗口内的 DOM 点击、命中检查和受控模块调用，不能冒充完整游戏端到端验收。

本轮未推送、未合并、未改版本、未打标签、未发布安装包/热更新、未部署。
