# TM-AUD-01—10：远端交付与独立复核入口

日期：2026-09-07。**这是待审查交付，不是十项缺陷已经独立验收、合并或发布的结论。**

重要新证据：锁定 Electron 33.4.11 已成功安装；真实 main/preload 启动在原基线和修复树上均失败：`module not found: ./preload-impl.js`。保留 sandbox，不以改测试或关闭安全项规避。见下文“Electron 验收阻断”。

## 1. 三段基线与排除的前置改动

| 身份 | 完整 SHA / 范围 |
| --- | --- |
| 本次 fetch 后的 `origin/main`、原审计基线 | `3f8065cb9cf09b414cf35dc3deccca59560f733b` |
| 原本地修复起点 | `6ce797ae032857ff99722482768844c2e6d4a4c9` |
| 原交付分支 `codex/audit-20260905`（原样保留，未推送） | `5ed032afe65cc041dd4d890227ada23e736b4713` |
| 独立审查分支 | `codex/audit-20260905-review`，直接从上述 `origin/main` 建立 |
| 十个移植提交后的审查代码基点 | `14130f77ef1976f9b3cd8b311b4aef77636e7d90` |

`main` 是原起点的直接祖先，共同祖先就是 `3f8065cb…`。唯一前置提交 `6ce797ae… chore: remove stale isolated asset entries`，只从 `web/.hot-update-manifest.json` 删除两个 `assets/assets-isolated/{audio/bgm,fonts}/README.md` 条目（10 行），不含源码修复。

该清理**不是本轮依赖，已从审查分支排除**。原分支、未跟踪资产、清理隔离资料均未覆盖/删除。十个提交逐一 cherry-pick，无冲突；没有强推或改写原分支。移植完时相对 `5ed032af…` 唯一树差异就是保留这两条 main 原有清单记录。审查清单因此为 1096 项，而原本地交付为 1094 项；不是新增资产或放宽校验。

可逐项核对的机器记录：[三段提交与完整文件差异、原/审查 SHA 映射](baseline-comparison.json)。其中 `reviewCodeHead` 是移植后代码基点，不冒充后续证据提交的最终 HEAD。之后仅增加本目录证据、报告入口，以及 CI 身份输出/探针/artifact 步骤；没有再改生产实现、测试断言、版本、热更清单。

原修复十个提交相对 `6ce797ae`：40 文件、+1845/-447（含原报告）。最终 PR 的完整 diff 以 GitHub Files changed 为准，另含明确的交付材料提交，不宣称 PR 只有十个提交。

## 2. 代码与正向行为证据

完整的逐项文件/函数、根因、测试与恢复说明见 [原修复记录第 2—3 节](../audit-fix-2026-09-05.md)。本次没有把 Node 测试解释为 Electron 端到端验收。

| 项目 | 实现入口 | 行为测试（均在 `web/scripts/`） | 交付状态 |
| --- | --- | --- | --- |
| 01 | `main-turn-data-commit.js` + 分卷 IPC/renderer | `smoke-audit-turn-namespaces.js`、`smoke-audit-turn-ipc.js` | 代码/模块回归通过；Electron 恢复链未验收 |
| 02 | `main-workshop-transaction.js`、工坊 IPC | `smoke-audit-workshop-transactions.js` | 故障/中断/锁/索引行为回归通过；Electron 安装 UI 未验收 |
| 03 | `main-account-requests.js`、账号 IPC | `smoke-audit-account-generation.js` | 代际/持久化回归通过；无真实账号请求 |
| 04 | `desktopDoSave`、世界 lease | `smoke-audit-manual-save-lease.js` | VM 真实函数回归通过；Electron 换局保存阻塞于 preload |
| 05 | `saveFileRef`、列表/读取/删除 IPC | `smoke-audit-save-files.js` | 临时文件/IPC harness 通过；非实机 UI |
| 06 | `ci-smokes`、`run-smokes`、`lib-smoke-evidence` | `smoke-audit-ci-evidence.js` | 新鲜完整报告、空选择/崩溃/错误/资产豁免负例通过 |
| 07 | `main-safe-remote.js`、实际 request lookup | `smoke-audit-safe-remote.js` | 地址/transport 桩及 localhost HTTP 通过；无完整 TLS/SSRF 攻击链结论 |
| 08 | `dialog-export` → `writeFileAtomic` | `smoke-audit-save-files.js` | 实际文件故障注入通过；非实机导出窗口 |
| 09 | `SaveManager.saveToSlot`/包装层 | `smoke-audit-save-slot-results.js` | Promise/异常/失败后不继续回归通过 |
| 10 | `main-json-file.js`、图片限额及导入 IPC | `smoke-audit-file-import.js` | Node Worker/取消/超时/并发通过；Electron UI/RSS 未测 |

## 3. `da134191` 到底改了什么

### 复现适配器

[逐行原始→适配器 diff](adapter.diff.txt)、[未改动的原脚本](original/audit-repro.cjs)、[原夹具 manifest](original/manifest.json) 与四份 `original/fixtures/` 一并可读。原文件原字节复制，哈希记录在 [historical/index.json](historical/index.json)。本次在真实 `3f8065cb` worktree 重跑原脚本，仍为 11 DEFECT_PRESENT / 2 CONTROL_PASS / 0 HARNESS_ERROR，退出 1：[日志](current/original-probe-baseline.txt)、[结构化输出](original/repro-results.json)。

工作树适配器必须显式 `--repo`，从该目录读取源码、require 实际模块；不使用随包旧夹具作为修复实现。没有一份适配器能直接跨越旧内联函数与新工厂接口，所以明确保留两套装配及差异，不伪称完全相同 harness。

| 装配变化 | 保持的验收不变量 |
| --- | --- |
| 主进程提取上下文补 `createRequire(actualRepo/main-impl.js)` | 实际源码依赖由目标 worktree 解析，缺依赖仍报错 |
| 工坊改装实际 `createWorkshopTransactions`；对 copyFileSync 注入写半段后 ENOSPC；额外断言注入确实发生 | 原包内容保留、索引不能提前提交，不能以“桩没装好”冒充成功 |
| 账号接实际 `createAccountRequests` | A/me 不能把 A 身份写到 B token，logout 后旧 login 不恢复会话 |
| 手动保存补实际 lease 函数 | 旧保存回调不能改变新世界名称/界面 |
| CI 改调实际导出的 `main` 与 `validateReport`，仅进程/磁盘输入受控 | runner 失败、空报告、非资产业务失败都必须拒绝；其他负例由专项补全 |
| 导出故障从最终路径写入改为 fd 写入注入，并加载实际原子 writer | 失败后原备份逐字节不变 |
| 结果输出移到 ignored evidence 目录 | 11 个缺陷探针和 2 个正常控制的判据未删除 |

原提取器在修复代码上失配的真实失败：[repro-current-original.txt](historical/repro-current-original.txt)，不是通过。修复树适配器结果：[当前日志](current/review-repro.txt)、[当前 JSON](current/repro-results.json)：11 NOT_REPRODUCED / 2 CONTROL_PASS / 0 HARNESS_ERROR。NOT_REPRODUCED **必须结合上节十个正向行为 Smoke**，不能单独证明修复。原包无 10 的探针，不虚报原包覆盖了 Worker 性能。

### 官方生成/哈希

[哈希同步 diff](hash-sync.diff.txt)、[字段级摘要](hash-sync.json)、[首次 stale 失败](historical/release-before-baseline.txt)、[原执行日志](historical/hot-baseline-sync.txt)。原命令是既有非发布维护入口 `node scripts/sync-hot-baseline.js --write --version 1.3.4.11`，不是 release prepare/publish。

只更新清单 generatedAt 与五个 renderer 文件的 hash/size：`tm-endturn-render.js`、`tm-platform.js`、`tm-post-turn-jobs.js`、`tm-save-lifecycle.js`、`tm-save-manager.js`。原修复前后清单各 1094 项，新增/删除均为 0。**官方剧本正文、派生场景、版本字段、package-lock、校验规则没有变化。** `package.json` 仅在安装包 files 中加四个新 shell 模块，不改依赖或版本。

本次审查 worktree 没有再次写清单；运行 `sync-official-scenarios.js` 后无派生物 diff。保留两条 main 旧记录的理由见第 1 节，正式发布契约在缺资产 worktree 仍按原规则通过。

## 4. 外部可读的执行证据

- [历史命令与原/脱敏文件 SHA256](historical/index.json)、[历史执行索引](historical/runs.jsonl)。仅替换工作站用户绝对路径，保留 stdout/stderr、错误、计数和退出码；历史日志没有逐次记录 dirty 状态，**不补造历史 clean 证明**。历史报告仍是本地证据。
- [历史最终 910 项结构化报告](historical/full-smoke-report.json)，执行代码 HEAD 为 `e890eeb8…`；之后 `5ed032af…` 只加原报告。
- [首次全量失败](historical/full-smoke-first.txt)：905/909、4 FAIL；[零选择误用](historical/committed-targeted.txt)不是通过；旧包适配器失配、Windows fd/故障桩修正等失败均保留。
- [当前全量报告](current/full-smoke-report.json)、[当前十个专项报告](current/targeted-report.json)。当前每份 `.txt`/`.json` 都记录命令、HEAD/tree、前后 status、Node/platform、退出码和耗时。

下表当前测试针对 `14130f77…` 的代码树，测试时只有 CI 证据步骤和本目录未提交；所有生产源码与该 HEAD 一致。后续提交只封存这些证据，不为“文档改变 SHA”伪造重测。原始基线探针和 Electron baseline 指定的 `--repo` 才是它们的源码目标，外层 logger 的 head 是记录工具所在审查树，二者不混淆。

| 当前命令 | 退出码 | 实际结果 | 可读原始输出 |
| --- | ---: | --- | --- |
| `npm ci --ignore-scripts` | 0 | 安装锁定依赖 | [日志](current/npm-ci.txt) |
| `node web/scripts/run-smokes.js --grep smoke-audit- --all --no-retry --report ...` | 0 | 10 PASS / 0 FAIL / 0 SKIP / 0 WAIVED | [日志](current/review-targeted.txt) |
| `node web/scripts/ci-smokes.js` | 0 | 908 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，910 脚本全部执行 | [日志](current/review-smokes.txt) |
| `node web/scripts/lint-arch-all.js` | 0 | 13 守卫通过 | [日志](current/review-arch.txt) |
| `node scripts/verify-release-contract.js` | 0 | 166 断言通过 | [日志](current/review-release.txt) |
| `node web/scripts/sync-official-scenarios.js` | 0 | 2 sources / 9 artifacts；无派生漂移 | [日志](current/official-sync.txt) |
| `node web/scripts/verify-official-scenario-parity.js` | 0 | 27 断言通过 | [日志](current/review-parity.txt) |
| `node web/scripts/verify-hot-builder-gates.js` | 0 | 27 断言通过 | [日志](current/review-hot-gates.txt) |
| `node web/scripts/audit-repro.cjs --repo <review-worktree> --expect-clean` | 0 | 11 NOT_REPRODUCED / 2 CONTROL_PASS / 0 HARNESS_ERROR | [日志](current/review-repro.txt) |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 | 0 vulnerabilities；非 Electron 验收 | [日志](current/review-audit.txt) |

七条具体 waiver 是五个 `assets/audio/bgm/*.mp3` 和两个 `assets/fonts/*.ttf` 缺席检查；分布于两个脚本，脚本其余断言仍执行。没有复制本地资产、假造资源、扩大清单或整文件豁免来凑 910 PASS。空/陈旧/不完整报告和 runner 错误仍阻断。

## 5. Electron 验收阻断（新实测，不掩盖）

- [锁定 runtime 安装](current/electron-install.txt)：`node node_modules/electron/install.js`，退出 0；Electron 33.4.11 / Chromium 130.0.6723.191 / embedded Node 20.18.3，无版本升级或发布构建。
- [审查代码真实启动](current/electron-startup.txt)：退出 1，`production-preload-failed`。
- [原 `3f8065cb` 相同启动探针](current/electron-baseline.txt)：退出 1，同为 `module not found: ./preload-impl.js`。这是基线已有的真实启动阻断，不是仅根据字符串搜索推测，也不是新增修复已通过。
- [可复跑探针](electron-probe.cjs) 使用真实 `main.js`/`main-impl.js`/`preload.js`；只替换 app 路径到受测 checkout、临时 userData、隐藏窗口显示，并阻止所有外部网络。没有替换 IPC/preload 成功桩，保留 contextIsolation/nodeIntegration/sandbox 配置。失败后不继续伪造后续 UI 通过结果。

因此六组完整桌面流程（启动及 IPC、保存换局、旧档/分卷恢复、Worker UI 导入取消超时、工坊 UI 更新恢复、受控 TLS 地址绑定/重定向）仍未完成。**合并/发布前必须另行处理或验证 preload 启动阻断。** 不关闭 sandbox 来绕过；不把此次交付扩展成壳层模块化重构。原 Node Worker 心跳、localhost HTTP 结果仍有效，但不等于上述 Electron/TLS/RSS 验收。

## 6. 协议、恢复与远端流程

分卷 v2 的 campaign/timeline hash 身份、同事务幂等、canonical+receipt 同事务、旧 manifest 可证明才复制迁移/未知保留；工坊 journal 与 index transaction ID 提交点、失败保旧/提交后清理警告；账号代际、保存 lease、detached snapshot、TLS/凭据/签名边界，均见 [原协议说明](../audit-fix-2026-09-05.md#3-协议兼容与恢复契约)。

**main/preload 修改需要后续壳层安装包交付，renderer 热更新不能替代。** 本次不打包、不盖版本、不动发布指针、不使用真实账号/玩家档。不处理上轮被拒绝清理的 935 MB 临时 staging。

仓库只有 `ci.yml` 的 main push/目标 main PR 验证，以及手动触发的 `pages.yml`；本次 feature 分支 push 不发布，Draft PR 触发 guards/mobile。新增 CI 步骤只打印被测 checkout 身份、运行工作树探针、上传这次报告；`always()` artifact 不改变失败 job 的结论，缺报告仍由门禁失败。PR CI 默认测试合并预览 SHA，与 head SHA 区分，实际 SHA/Node/status 会出现在日志。

远端结果以 Draft PR Checks 和 `audit-evidence-<merge-preview-SHA>` Actions artifact 为准（保留 30 天），不是用本地 910 或 908 代替。首次创建时可能仍运行中，不能提前标绿；完整远端 run 链接/结果由 PR 描述更新及最终交付提供。保持 Draft，关闭 auto-merge，不合并、不发布。
