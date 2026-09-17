# PR #70 定点补修与桌面验收（2026-09-07）

本轮只修正式 sandbox preload 入口和工坊锁生命周期，补真实 Electron/桌面门禁。**保持 Draft，未合并、未发布。** 主进程与 preload 必须通过后续经授权的壳层安装包交付，renderer 热更新不能交付这些改动。

## 基线与范围

- 本轮起点：`7a70588c001ce3e9e6c0fdb398cd1f0b88db8948`，`codex/audit-20260905-review`，开始时干净。
- PR base：`main` 的 `3f8065cb9cf09b414cf35dc3deccca59560f733b`。沿用已审核的审查分支，不重新引入被排除的前置本地改动。
- 原用户工作树及历史临时 staging 未改动。没有改版本、官方剧本正文、热更基线或资产豁免。
- 用户提供的新 sandbox 附件链接在当前文件系统未找到；**没有声称运行该 ZIP**。从消息中的操作顺序建立了等价、真实子进程退出复现。
- 原模块 blob 核对：`main-workshop-transaction.js` = `81576d9392b691e2c4e756056ba5afa982df423f`；旧 `preload.js` = `5eb4001fb90ae0ad94d70e2333befa2fec1568ef`。
- 独立代码提交：`55d89af8ae2791f44c4ad5a0744913f612422677`（入口、实际 Electron/网络门禁），`03ec98c9bd3968eed69dc05f8e8adfe38637d056`（工坊锁与动态中断测试）。随后证据提交仅增加本目录文件，不改变被测生产代码。

## 两项改动

### 正式 preload 入口

`main-impl.js/createWindow` 直接选择安装包根目录的 `preload-impl.js`。它只有 `require('electron')`，不需要本地 CommonJS loader。删除不再使用的五行 `preload.js` wrapper，打包清单保留唯一实现；同步两处守卫和入口文档。

`sandbox:true`、`contextIsolation:true`、`nodeIntegration:false`、可信 IPC 来源及不可从热更目录加载可执行桥的约束不变。没有 `--no-sandbox`、动态 import/eval 或双份桥实现。

原因是 sandbox preload 不支持普通 Node 的相对 CommonJS 加载，而不是缺少依赖；参见 [Electron 官方 sandbox 说明](https://www.electronjs.org/docs/latest/tutorial/sandbox)。基线真实 Electron 日志直接记录 `production-preload-failed: module not found: ./preload-impl.js`。

### 工坊锁：先有可证明所有者，再发布固定锁

新增 `main-workshop-lock.js/createWorkshopLock`，由原 `exclusive()` 使用。目录、索引、staging 和 `.transaction.json` 的既有提交点没有重写。

1. 同盘原子创建 `owner-PID-UUID` 目录。第一步可见时身份已包含在名称中，不再先创建空的固定锁。
2. 原子创建 ticket 目录，以 choosing 状态和 `(ticket, owner)` 顺序完成本地文件系统互斥；竞争返回 busy，不同步自旋。新进入者不能越过已持锁者。
3. 只有 `process.kill(pid, 0)` 返回 ESRCH 才回收其他进程的唯一所有权目录。PID 复用、无法读取、权限错误均保守拒绝，不凭超时抢锁。
4. 私有 `owner.json` 写全、fsync、close 后，以同盘硬链接原子、no-replace 发布 `.transaction.lock`。不支持硬链接时明确失败，不降级为先建空锁。
5. 回收者也拥有自己的唯一 claim，不再创建固定 `.lock-recovery`。回收者退出后，其 claim 可由后续进程按死亡证明回收；并发回收者不会误删新一代唯一 claim。
6. 释放失败保留所有权材料；本进程只对明确已完成的操作记录 token，允许后续同进程重试清理。提交后清理失败仍是成功带 warning，不能谎称回滚。

**旧材料兼容边界：** 有有效已死 PID 的旧锁自动恢复。历史空锁、损坏所有者信息和无身份的旧 `.lock-recovery` 仍保留并报告，不能自动猜测持有人已死；测试验证它们不会引发包、索引或事务日志删除。本修复阻止新协议再次产生这两个未知所有者窗口，并不提供未经授权的旧材料强制清理。未验证不同版本壳层同时操作同一工坊根目录，不支持据此抢占旧进程。

## 测试对象与适配说明

- `lock-window-probe.cjs` 对修改前实际模块复现两个窗口，各重新初始化两次均失败；普通读取、已死 PID、存活持锁者三个对照通过。日志为 `baseline-lock-verified`（退出 1，确有缺陷）。第一次探针 hook 错误提前终止，`baseline-lock` 保留为 **HARNESS_ERROR**，不是缺陷证据。
- 新版改变了所有者发布协议，旧 open/PID hook 不再对应生产操作。`smoke-workshop-lock-recovery.js` 在真实 mkdir/open/link/回收处令子进程 `exit(86)`，验证确实命中中断、两次重启成功、旧包/索引字节不变及存活所有者保护。没有改旧基线夹具。
- 新锁测试覆盖四个发布窗口、回收者退出、未知旧材料保留、已死旧 PID、发布失败、两种释放失败及四进程 100 次共享索引操作；独立排他 critical-section 文件检测真实事务体重叠。Windows 并发测试暴露并修正了目录释放时的 ENOENT/EPERM 检查竞态；权限不明按 busy 处理，未当作死亡。
- `scripts/verify-electron-bridge.js` 启动锁定 Electron 33.4.11，真实 `main.js` → `main-impl.js` → preload → IPC。单独临时 userData、隐藏原生窗口、拒绝外部网络。不伪造 `window.tianming`。
- 生产与重启用例不设 `TIANMING_TEST_EXPORTS`；另跑显式测试模式并验证导出隔离。记录原生 BrowserWindow 构造参数，随后用 `getLastWebPreferences()` 核实安全配置。Electron 33 后者不返回 preload 路径，因此最初直接读取该字段的失败属于适配器失配，已保留首次日志。
- 首轮保存断言跨越整个异步事件循环，观察到 `_indices/_listeners` 正常初始化；`tm-indices.js/findScenarioById` 可证明索引建立原因。随后改为在**真实同步 `_buildSaveState` 边界**前后比较 live GM/P，透明转调原实现并断言实际执行一次、没有修改 live，未替换其返回值，也未改生产保存逻辑。最初差异/诊断 IPC 克隆错误均保留。
- 基线模式只核验桥是否启动，记录协议版本但不要求原基线拥有 v2；修复模式严格要求 v2。缺运行时、preload-error、renderer 退出、主页面加载失败、断言错误、超时或报告缺失均使门禁红，不适用资产豁免。

## 真实桌面与网络覆盖

真实 Electron 进程执行：基本桥与安全配置；旧中文档与 hash 档 list/load/delete；手动保存等待屏障时换局、真实 save-project 写盘后的迟到 IPC 回复；detached 快照观测；导出部分写/fsync/rename 失败和取消；8 MiB JSON 的真实 Worker 成功、取消、超时、异常及恢复；GeoJSON IPC；工坊覆盖复制失败后旧包/索引保留与重试；canonical 双槽与 receipt 提交后结束进程，再启动另一个进程读取 IDB 并经正式 renderer 恢复分卷，最后重复 publish 验幂等。

故障注入只改变测试对话框选择、实际请求的返回时机，以及选定临时目标的 fs/Worker 失败；保留真实来源校验、预加载桥、磁盘写入、Worker 实现与 IndexedDB。测试 Worker 的前置暂停/异常包装随后调用生产解析脚本，不是替代解析器。

`scripts/verify-remote-tls.js` 用临时自签 CA 和本机 HTTPS server，调用真实 `main-safe-remote` transport，验证校验后 DNS 来源改变仍连接原地址、Host/SNI、逐跳校验、私网重定向拒绝、跨源凭据隔离和不可信证书拒绝。只为测试请求显式信任其临时 CA，未关闭 TLS 验证。**这是 Node 下受控 loopback TLS 测试，不是生产 SSRF 攻击链或 Electron 代理配置的全面验收。**

## 执行证据

`evidence/*.json` 与同名 `.txt` 配对记录命令、HEAD、执行前后工作区状态、平台、Node、退出码和耗时。修改中测试的 HEAD 指向起点，但状态明确为 dirty；不能把它叫起点原始代码或远端合并预览测试。后续已提交代码测试另以 `committed-*` 标记。

`electron/<runId>/` 保留真实 Electron stdout/stderr、结构化报告和原始/脱敏副本 SHA256；临时 userData、存档内容和 TLS 私钥不提交。历史失败日志保留，不用后一次成功覆盖。`collect.cjs` 只收集明确列出的文本文件。

完整门禁实测：全量发现 911 个脚本，909 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，豁免仍是原有七项具体缺席资产检查；13 项架构守卫；166 项发布契约；27 项官方对账；27 项热更构建夹具；生产依赖 audit 0。未修改 CI smoke 统计或资产豁免。

| 实际命令（仓根） | 结果 | 退出码 | 墙钟秒 | 日志 |
| --- | --- | ---: | ---: | --- |
| `npm ci --ignore-scripts`（经同一 npm-cli.js） | 安装 417 包 | 0 | 32.29 | [dependencies](evidence/dependencies.txt) |
| `node node_modules/electron/install.js` | 锁定 runtime 安装成功 | 0 | 10.99 | [electron-runtime](evidence/electron-runtime.json) |
| `node scripts/verify-electron-bridge.js` | 27 PASS / 0 FAIL / 0 SKIP / 0 WAIVED | 0 | 38.51 | [committed-electron](evidence/committed-electron.txt) |
| `node scripts/verify-remote-tls.js` | 5 PASS / 0 FAIL / 0 SKIP / 0 WAIVED | 0 | 1.70 | [committed-tls](evidence/committed-tls.txt) |
| `node web/scripts/smoke-workshop-lock-recovery.js` | 13 PASS / 0 FAIL / 0 SKIP / 0 WAIVED | 0 | 18.26 | [committed-lock](evidence/committed-lock.txt) |
| `node web/scripts/ci-smokes.js` | 909 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，911 executed | 0 | 83.74 | [committed-smoke](evidence/committed-smoke.txt)、[逐脚本报告](evidence/full-smoke-report.json) |
| `node web/scripts/lint-arch-all.js` | 13 守卫 PASS | 0 | 20.99 | [committed-architecture](evidence/committed-architecture.txt) |
| `node web/scripts/audit-repro.cjs --repo <本工作树> --expect-clean` | 11 探针未复现，2 正向控制通过，0 harness error | 0 | 0.83 | [committed-audit-worktree](evidence/committed-audit-worktree.txt) |
| `node scripts/verify-release-contract.js` | 166 PASS | 0 | 2.02 | [release-contract](evidence/release-contract.txt) |
| `node web/scripts/sync-official-scenarios.js` | 2 sources / 9 artifacts；没有生成差异 | 0 | 2.48 | [official-sync](evidence/official-sync.txt) |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS | 0 | 2.15 | [official-parity](evidence/official-parity.txt) |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS | 0 | 3.50 | [hot-builder](evidence/hot-builder.txt) |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 vulnerabilities | 0 | 5.13 | [dependencies-audit](evidence/dependencies-audit.txt) |

上述墙钟是 recorder 实测值，不是把并行子测试的耗时相加。Node 主机 `v24.14.0` / Windows `10.0.26200`；Electron 内嵌 Node `20.18.3`。`committed-*` 测试针对 `03ec98c9`，当时仅本证据目录尚未提交。其他门禁在相同代码树提交前执行，其 JSON 保留 dirty 状态。新门禁的源码和实际桥均没有为证据提交再次修改。

真实 Electron 最终本地日志：[run f6723acc](electron/f6723acc-4899-45ec-9665-1bbbd1a311f7/report.json)；[修改前启动失败](electron/ca1af9d3-ac4a-4ca8-abab-83b14aa64611/report.json)；[修改前锁缺陷](evidence/baseline-lock-verified.txt)。所有 `NOT_REPRODUCED` 仅为探针结论，另由 Smoke 和上述真实桌面正向行为佐证，不单独充当修复证明。

新 `electron-bridge` Windows CI job 在 `npm ci --ignore-scripts` 后安装锁定 runtime，运行真实桌面门禁和受控 TLS，上传证据；缺 runtime 或启动失败为失败，不豁免。既有 guards/mobile jobs 不变。本轮远端结果必须查**新提交的新运行**，不能沿用 `95b41fcb` 的成功。

## 尚未宣称完成的范围

- 已测 Windows 本地文件系统进程退出与故障注入，未测真实断电、网络文件系统、多个旧/新壳层混用。
- 已测 unpackaged 正式 main/preload 生产安全配置，没有制作或验证签名安装包、ASAR 安装或 OTA 交付；本轮无发版授权。
- UI 自动化使用真实页面函数/IPC与受控输入，不是完整长局人工游戏验收。没有编造 UI 卡顿、RSS、GC 或长回合数据。
- TM-AUD-01—10 的既有 Node 回归仍保留，但新增启动门禁通过不等于这十项所有端到端组合均已穷尽。
- 未访问真实账号、存档、生产服务或真实内网，未删除旧 staging。未知旧锁材料需要独立确认所有权后的维护，不自动删除。
