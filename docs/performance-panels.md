# 诏书与面板开关：鼠标实操和本地优化

2026-09-08。先完成已授权合并，再在独立分支优化；不发布。

## 合并与当前范围

- 已合并 [PR #71](https://github.com/misfit-user/tianming/pull/71)：`814f3af65f6bd24f02fe8dc245eb9d7e31ea8489` → `5300ab4bf07fbb43a36a09f0919605f99aad2688`，包含原候选 `08a1a99a4dfeb2def18f98d8608c9f0c09322141` 的七个提交；合并树与候选树逐字节一致。
- [PR 检查](https://github.com/misfit-user/tianming/actions/runs/34203154654)和[合并后检查](https://github.com/misfit-user/tianming/actions/runs/34203514744)的 guards、electron-bridge、mobile-release-contracts 均成功。对应全量为 913 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，915 脚本全部执行。未绕过保护、强推、删除分支或触发发布。
- 以下新面板改动基于 `5300ab4b…`，只在本地 `codex/perf-panels`，工作树 `tianming-perf-round1`。原用户工作树没有切换或覆盖。新面板代码未推送、未合并。
- 本地生产提交：`31fd1f5598d35b51511f52f71ac0ffc9178365a7`（`perf(ui): defer hidden edict history and batch draft capture`）；随后独立提交本报告、回归工具与证据。测试发生在该提交前的工作树，生产文件 SHA-256 与本提交一致；证据中的 HEAD `5300ab4b…` 不表示只测试了未修改的 main。

## 确实进行了鼠标实操

通过 computer-use 操作可见的真实 Electron 33.4.11，使用正式 main/preload、安全沙箱、独立临时 userData、公开绍宋新局，外部网络阻断。没有配置 AI、使用玩家存档或发送诏令/信件。没有用伪造的桌面桥。

最后一次观察全程用鼠标开关面板：诏书 3 轮、奏疏 2 轮、鸿雁 2 轮；另打开/关闭历史诏书子窗。每次以实际画面和 `trusted` 指针/点击事件确认，未使用脚本 `.click()` 或键盘激活替代。结束后正常关窗退出码 0；清理窗口的 Alt+F4 不属于面板测量。

下表是**同一候选的首开/重复打开，不是优化前后对比**。单位毫秒；采用浏览器原生 [Event Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming) 的点击到绘制时间，精度按 8ms 量化，观测阈值 16ms。它包含输入排队，不把“处理函数返回后下一帧”冒充全部响应时间。

| 面板 | 打开（逐次原值） | 关闭（逐次原值） |
| --- | --- | --- |
| 诏书 | 504 / 104 / 80 | 56 / 40 / 40 |
| 奏疏 | 512 / 112 | 40 / 88 |
| 鸿雁 | 440* / 120 | 40 / 40 |

`*` 鸿雁第一次来自鼠标双击重试，第二下落在新面板联系人上；440ms 受后续交互干扰，不作为干净的单次打开比较。若某次只记录到 pointerdown，没有完整点击和画面变化，不计为成功样本。所有尝试仍留在原始轨迹中。

还有必须保留的异常：启动时记录到 87.9 秒长任务，一次引导点击排队约 53 秒；根因未定位，不能推广为所有玩家的启动时间。检测到用户操作后重新观察，轨迹最后另有非实施 AI 操作的人物图志点击（约 1.2 秒），不冒充本轮已复核动作。未改动没有证据支持的拖动区域或全局悬停逻辑。

环境：Windows 11、i5-13420H、12 逻辑处理器、约 25.48GB RAM，窗口 1280×800；Electron Node 20.18.3 / Chromium 130.0.6723.191，命令行 Node 24.14.0。部分非 Git 美术/字体缺席，不能把数值推广到完整资源安装包。截图工具调用耗时不是游戏响应时间。

[鼠标逐事件结果](performance-panels/mouse.json) · [完整被动观测及代码哈希](performance-panels/mouse-raw.json)。该会话没有并行运行本任务的重回归；正式回归在鼠标测量结束后进行。

## 实际源码修改

集中在 [phase8-formal-drafts.js](../web/phase8-formal-drafts.js)：

1. `renderFormalEdictPanel` 只计算历史条数，不提前生成隐藏历史全文；`renderFormalEdictArchive` 在真实“历史诏书”点击时生成原有完整内容。800 条受控历史默认少生成 **4,800 个隐藏子节点**。不是删除历史、分页截断或持久缓存；原顺序、文案、转义、状态标记和滚动位置保留。显式重新打开能读取就地更新，旧世界的 overlay 不构造新世界档案。
2. `captureDeskOverlayState` 同步收齐所有输入后，仅调用一次原有草稿聚合保存；`saveFormalDraftsToGM` 用有 `finally` 的局部捕获深度合并重复调用。诏书关闭的聚合保存 **7 → 1**；奏疏和书信共用此路径。普通 input/change 仍立即保存，不改变自动存档频率、最大脏等待、世界租约或退出 flush。

没有重做游戏 UI、删动画/文字/标签、改变 AI 参数、游戏内容或持久化格式。没有跳过 `renderGameState`，因为实操相应时段没有该函数重建的证据。当前首开仍约半秒，绘制/排队部分尚未解决，**不提供未经同口径对照证明的“鼠标提速百分比”或 FPS**。

[新增实际源码回归](../web/scripts/smoke-perf-desk-panels.js)：完整生产 IIFE 和正式草稿存储函数，15 组检查，覆盖懒构造、排序/转义、就地更新、滚动保留、六字段/别名/空白、重复关闭、普通输入、异常恢复、detached 快照及换局。初次在旧实现上确实因提前读取历史正文而失败；未修改断言来容忍缺陷。

## 验证结果与未完成部分

完整命令、退出码、耗时、被测 HEAD/工作区哈希在[执行索引](performance-panels/executions.json)；stdout/stderr 与原始/脱敏哈希在[日志](performance-panels/logs.json)。不同表行的“脚本/检查”不混加。

| 命令/范围 | 退出码 | 实际结果 | 秒 |
| --- | ---: | --- | ---: |
| `node web/scripts/smoke-perf-desk-panels.js` | 0 | 15 组 PASS | 0.3 |
| `node web/scripts/ci-smokes.js` | 0 | **914 PASS / 0 FAIL / 0 SKIP / 2 WAIVED；916 唯一脚本全部执行** | 121.5 |
| `node web/scripts/lint-arch-all.js` | 0 | 13 守卫 PASS | 25.8 |
| `node scripts/verify-electron-bridge.js` | 0 | 12 production + 11 test-exports + 6 restart PASS | 25.8 |
| 绍宋真实 DOM、草稿、project/idb 构造与 project 读回 | 0 | 16 检查 PASS | 216.4 |
| 天启同组检查，初次 | 1 | 12 检查已 PASS，剩余未完成，240s 看门狗超时 | 245.6 |
| 天启同组检查，无其他本任务重进程的复跑 | 1 | 14 检查已 PASS，整组仍超时 | 259.4 |
| `node scripts/verify-release-contract.js` | 0 | 166 检查 PASS | 2.0 |
| `node web/scripts/verify-official-scenario-parity.js` | 0 | 27 检查 PASS | 2.3 |
| `node web/scripts/verify-hot-builder-gates.js` | 0 | 27 检查 PASS | 3.9 |
| `node scripts/verify-remote-tls.js` | 0 | 5 受控 TLS 检查 PASS | 1.1 |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 | 0 vulnerabilities | 23.3 |
| `powershell -NoProfile -File mobile/scripts/verify-staging-dryrun.ps1` | 0 | 689 文件 dry-run | 0.9 |
| `powershell -NoProfile -File mobile/scripts/stage-web-for-cap.ps1 -WwwDir E:/tianming-perf-temp/mobile-www-panels-20260908` | 0 | 689 文件 staging，非安装包 | 34.7 |
| `powershell -NoProfile -File mobile/scripts/verify-staged-web.ps1 -TargetDir E:/tianming-perf-temp/mobile-www-panels-20260908` | 0 | 689 文件对账，allowedExtra=0 | 2.0 |
| `node web/scripts/audit-repro.cjs --repo <当前树> --expect-clean` | 0 | 11 NOT_REPRODUCED / 2 CONTROL_PASS / 0 HARNESS_ERROR | 0.7 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11 --temp-root E:/tianming-perf-temp` | 0 | 684 在场条目，410 既有缺席资产条目，无 stale/missing | 1.1 |

天启复跑已经通过了诏书开关、完整历史、六字段/焦点/选区、detached project/idb 构造不污染 live GM/P，以及 project 读档恢复。**尚未完成的是之后的奏疏、书信草稿往返两项**；超时没有被改为豁免，也没有增大看门狗或宣称整套通过。合成 composition 事件不代表物理中文输入法验收。

两项 Smoke WAIVED 仍是原来五个音频与两个字体的具体缺席检查，其他断言执行；未添加假资产或扩大豁免。[完整 Smoke 报告](performance-panels/smoke.json) · [标准 Electron 报告](performance-panels/electron-bridge.json)。

## 试验透明度与复跑

早期脚本试跑与鼠标实操分开保存于[原始试验记录](performance-panels/experiments.json)：完整 timeline 试跑超时；第一版适配器用 rAF 自带时间戳（可能早于调用），后改为回调内 `performance.now()`；初次草稿测试误以为行止 fallback 会 trim，核对实现后改为严格保留六字段原始空白。失败记录未删除。

早期新局前后后台 DOM 数量未完全一致，因此脚本耗时不能直接作为同样本收益。后来同一 35,625,923-byte 公开受控长档的基线完成了三次开关，但用户要求优先真实鼠标后没有继续该脚本配对；不声称完成 before/after 对照。诊断连接及 CSS/native metrics 采集的额外开销与默认轻量测量分离。最终回归与其他门禁并行时产生的耗时也不作为性能比较。

```sh
# 真实窗口由 computer-use 鼠标操作；此命令不自动点击面板
node scripts/perf/inspect-electron.cjs --temp-root E:/tianming-perf-temp
# 单独的实际实现回归，不宣称为鼠标实操
node web/scripts/smoke-perf-desk-panels.js
node scripts/perf/panels-electron.cjs --temp-root E:/tianming-perf-temp --panel all --history 800 --cycles 1 --contracts
```

生产变动之外的文件是上述回归及被动观察工具、执行证据。`index.html` 仅同步 drafts 家族两个缓存查询戳，应用版本不变。官方 `build-startup-phase-manifest.js` / `sync-official-scenarios.js` 未产生跟踪差异，仍 409 eager / 6 deferred；`sync-hot-baseline.js --write --version 1.3.4.11 --asset-root <原工作树> --temp-root E:/tianming-perf-temp` 仅生成 index/drafts 两个条目的 hash/size 与 generatedAt，仍 1094 条目。没有手改 hash 或运行 release prepare/publish。

状态：已有性能工作已合并；这轮面板代码已本地修改并有上述验证，**并非所有额外验收全绿**；未推送新面板分支、未发布。签名安装包、完整美术资源、真实 AI/长局与首开绘制的进一步定位不在本轮完成声明内。
