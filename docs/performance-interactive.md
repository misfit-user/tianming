# 实操后定点优化：自动存档跨桌面桥

2026-09-08。本轮使用 computer-use 在真实隔离 Electron 中操作游戏，并用调用栈定位周期性停顿。只优化已定位的一段：大快照传入 contextBridge 时的递归复制；没有重做 UI、减少保存频率或调整游戏内容。

## 基线与改动

- 实际起点：`54d1f6504047c9e4fc7e25357ff3a4ca75774a7c`，即上一轮 A/B/C 性能切片之后。不是把这三项重复计作本轮收益。
- 分支：`codex/perf-interactive`，工作树 `tianming-perf-round1`；原 `codex/perf-round1` 分支保留。
- 生产优化与行为回归提交：`16f220c4051e28ee0c7fe59e1a31f91d68f48d03`（`perf(save): cut autosave bridge graph conversion`）。随后独立提交本报告、采样工具和原始执行证据；该证据提交不改变被测生产代码。
- 查询到的远端 main：`814f3af65f6bd24f02fe8dc245eb9d7e31ea8489`。原用户工作树 `tianming` 保持 `codex/audit-20260905@5ed032af…`，不切换、不覆盖。
- 全部工作限于本地。未推送、未合并、未改版本、未发布。

生产只改两处：

1. [preload-impl.js](../preload-impl.js) 增加可选 `autoSaveJson`：接受 JSON 文本，在隔离 preload 内解析，再调用原 `_invokeAutoSave`。仍使用原会话 envelope、可信 IPC channel、主进程保存队列。
2. [tm-save-lifecycle.js](../web/tm-save-lifecycle.js) 的 `_tmRunDesktopAutoSaveTick` 优先传已提交快照的 JSON 文本；旧壳没有该能力时保留原对象接口。新接口失败不回退再写一次。

避免的是整个对象图跨 contextBridge 的递归转换。并非消除了所有复制：renderer stringify、preload parse、后续 IPC structured clone、main stringify 和磁盘 IO 仍存在。Electron 对桥接数据复制/冻结的约定见[官方 contextBridge 文档](https://www.electronjs.org/docs/latest/api/context-bridge)。

不变量：提交后 detached 快照、live GM/P 不变、世界身份/加载代际/会话令牌、保存次数与最大等待、输入避让、在途 Promise、成功时钟、关闭 flush、正文 generation 前缀及原子替换全部保留。规范存档格式与 canonical/receipt 关系不变。

**能力位于 preload，实际使用需要后续壳层安装包交付。** 仅 renderer 热更新到旧壳仍走兼容旧接口，不会获得这段收益。本轮没有打包或发布。

## 实际电脑操作与定位证据

使用 computer-use skill 操作正式 main/preload 的可见绍宋新局；独立临时 userData、生产模式、外部网络阻断、未配置 AI。前后均正常关窗，保存握手退出码 0。

修复前：关闭引导和提示，打开军务边防、舆图政区。周期任务出现约 2.0～5.8 秒的 renderer long task。CPU 采样在相应时间窗落于 `tm-save-lifecycle.js` 的 autosave closure 与 sandbox `invoke`；没有同期 `_buildSaveState`/`renderGameState` 重建计时。这使本轮选择桥接传递，而不是再次缓存地图或跳过整页状态同步。

修复后：关闭引导/未配置 AI 提示/邸报，打开军务边防，随后正常退出。军务展开的一次 click→下一帧约 270.8ms；这条 UI 路径本轮未优化。观察过程中检测到用户切换桌面，停止鼠标操作，未完成的地图缩放不计作通过。工具截图耗时不当作游戏延迟。

修复后轨迹在一些周期保存附近记录到 555/678/696ms 长任务，也有 2285ms；另保留了初始化期间 **111224ms** 长任务及桌面切换阶段其他长任务，没有从原始记录删除。后者尚未准确归因，交互观察存在焦点变化及诊断开销，不用于配对性能结论，也不据此声称卡顿已全面消失。

[修复前轨迹](performance-interactive/inspect-before-trace.json) · [修复后轨迹](performance-interactive/inspect-after-trace.json) · [前采样栈](performance-interactive/inspect-before-cpu-summary.json) · [后采样栈](performance-interactive/inspect-after-cpu-summary.json)。采样 self time 不是精确函数总耗时或 GC 暂停时间；原 CPU profiles 保留在执行索引指向的本地目录。

## 同机配对实测，不是微基准

Windows 11 / i5-13420H / 12 逻辑处理器 / 25.48GB RAM；CLI Node 24.14.0，Electron 33.4.11（Node 20.18.3、Chromium 130.0.6723.191），可见 1280×800。两个源码工作树均在 C 盘；独立临时数据在 E 盘。未清操作系统缓存，未宣称整个桌面完全空闲；固定测试期间没有并行运行本任务重门禁。

同一份公开绍宋受控 800 回合样本：35,625,923 bytes，SHA-256 `3d4916bc9cb9cea8a79607214f90e08140afb8f1b9ce0b10f689a6296edd6157`。沿用上一轮生成的样本，不读取玩家存档。真实新局初始化、`fullLoadGame`、加载屏障后，执行实际 `_tmRunDesktopAutoSaveTick({force:true})` 三次；每次从磁盘读取并核验完整 GM 的 SHA、generation 前缀和 session envelope。没有用成功桩替代 bridge/IPC/写盘。

这是一对独立进程、每侧 3 次保存，不是大量独立启动样本。下表小样本 p50 仅描述本次结果：

| 指标（毫秒） | before 三次原值 | after 三次原值 | p50 before→after |
| --- | --- | --- | --- |
| renderer 最长任务 | 4679 / 3603 / 3687 | 1558 / 1652 / 1103 | **3687→1558（约 -58%）** |
| 最长 rAF 间隔 | 4681.5 / 3605.7 / 3701.7 | 1559.0 / 1653.9 / 1115.6 | 3701.7→1559.0 |
| 实际保存 Promise 往返 | 6288.2 / 5022.7 / 5333.7 | **30153.2** / 2748.0 / 2433.7 | 5333.7→2748.0 |
| main 最大事件循环延迟 | 1586.5 / 1404.0 / 1634.7 | **28219.3** / 942.1 / 1192.2 | 1586.5→1192.2 |
| main 最大 stringify | 311.9 / 316.2 / 359.1 | 320.6 / 317.4 / 418.8 | 316.2→320.6 |

结论只限于：这个样本中自动存档的 renderer 阻塞明显减少。**保存总等待尾部并未证明改善**，after 第一次 30.15s 的慢样本仍计入，main 的异常停顿未归因。main stringify 基本未改善。不能换算成整局 FPS 或宣称“自动存档完全不卡”。

[配对完整原始结果](performance-interactive/paired-raw.json) · [统计、源码哈希及环境](performance-interactive/summary.json)。测量时 HEAD 为 `54d1f650…` 加工作区修改；after 的生产文件哈希另外记录，不能把它描述成裸 HEAD 测试。

### 失败试验与未完成范围

- 早期分支位于 E 盘的几次定位试验超时；一次强制保存与自然保存重叠，正确被 in-flight guard 拒绝。都记为失败，不计入成功配对结果。
- 测量适配器改为在 renderer 内计算读回对照 SHA，不跨诊断 `executeJavaScript` 返回整份大 JSON；真正磁盘读回及完整正文相等约束没有取消。最终 before/after 使用同一适配器，先等待既有在途 Promise，没有禁用自然保存定时器。
- 天启 42,535,361-byte 长档的后续配对，在 before 进程 260 秒超时，退出 1，未运行 after。**本轮天启长档性能验证未完成**，不扩大超时、不把未运行算通过；上一轮的数据不冒充本轮结果。
- 没有新建微基准来代替 Electron。原 A/B/C 微基准与原始完整回归见[上一轮报告](performance-round1.md)，与本轮分开。
- 未验证真实 AI 网络/首 token/流输出、完整 AI 回合、物理中文 IME 组合态、完整未跟踪美术资产、签名安装包。本轮不改变 AI 或游戏内容。

## 行为回归与正式门禁

[新增实际实现回归](../web/scripts/smoke-autosave-text-bridge.js) 17 组：文本/对象落账一致，Unicode/emoji/组合字符，非法 JSON、非对象、IPC 失败/拒绝、会话来源、live 快照不变、旧壳回退、busy 延迟、序列化失败、成功时钟、并发/换局/恢复。

[真实 Electron desktop cases](../scripts/electron/desktop-cases.cjs) 增加文本/对象实际 IPC 落盘相等、无效输入保留旧文件。原生产安全配置、手动保存换局、Worker 故障、工坊回滚及 receipt 重启测试继续执行。

`smoke-runtime-save-consistency` 仅适配条件分支后的调用形状；没有移除失败/时钟断言。新的动态测试对新旧两种传输分别断言失败不会推进时钟。

完整命令、退出码、源码状态与原始 stdout/stderr 见[执行索引](performance-interactive/execution-index.json)和[日志](performance-interactive/logs.json)。PASS 单位是该行的检查记录/脚本，不跨表相加；没有远端 CI，本地门禁**未全绿**。

| 实际命令（均由 `scripts/perf/run.cjs` 记录） | 退出码 | PASS / FAIL / SKIP / WAIVED | 秒 |
| --- | ---: | --- | ---: |
| `node web/scripts/smoke-autosave-text-bridge.js` | 0 | 17 / 0 / 0 / 0 | 0.3 |
| `node web/scripts/smoke-desktop-autosave-committed-world.js` | 0 | 35 / 0 / 0 / 0 | 0.5 |
| `node web/scripts/smoke-runtime-save-consistency.js` | 0 | 81 / 0 / 0 / 0 | 0.8 |
| `node scripts/verify-electron-bridge.js` | 0 | 12 production + 11 test-exports + 6 restart / 0 / 0 / 0 | 62.8 |
| `node web/scripts/lint-arch-all.js` | 0 | 13 / 0 / 0 / 0 | 71.0 |
| `node web/scripts/ci-smokes.js` | **1** | **912 / 1 / 0 / 2；915 唯一结果全部执行** | 224.4 |
| `node scripts/verify-release-contract.js` | 0 | 166 / 0 / 0 / 0 | 4.3 |
| `node web/scripts/verify-official-scenario-parity.js` | 0 | 27 / 0 / 0 / 0 | 7.6 |
| `node web/scripts/verify-hot-builder-gates.js` | 0 | 27 / 0 / 0 / 0 | 9.1 |
| `node scripts/verify-remote-tls.js` | 0 | 5 / 0 / 0 / 0 | 4.5 |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 | 0 vulnerabilities；不是游戏断言 | 12.5 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11 --temp-root E:/tianming-perf-temp` | 0 | 684 在场文件；410 既有缺席资产条目；无 stale/missing | 4.0 |
| `powershell -NoProfile -File mobile/scripts/verify-staging-dryrun.ps1` | 0 | dry-run 成功 | 3.3 |
| `powershell -NoProfile -File mobile/scripts/stage-web-for-cap.ps1 -WwwDir E:/tianming-perf-temp/mobile-www-interactive-20260908-0038` | 0 | 689 文件 staging；不是安装包 | 72.8 |
| `powershell -NoProfile -File mobile/scripts/verify-staged-web.ps1 -TargetDir E:/tianming-perf-temp/mobile-www-interactive-20260908-0038` | 0 | 689 文件对账；allowedExtra 0 | 7.8 |
| `node web/scripts/audit-repro.cjs --repo <当前性能工作树> --expect-clean` | 0 | 11 NOT_REPRODUCED、2 CONTROL_PASS；0 defect/harness error | 2.4 |
| 绍宋固定样本配对（上节） | 0 | 2 进程均成功、6 次完整落盘核对 | 416.6 |
| 天启配对尝试（上节） | 1 | before 超时；after 未执行 | 261.1 |

全量失败为 `smoke-workshop-lock-recovery.js` 中四进程压力阶段的 `stress admission deadline exceeded`。此前十二组中断/恢复检查通过，压力阶段未通过。随后当前树单独复跑（34.8s）和未修改的 `54d1f650…` 只读基线复跑（34.9s）均以相同错误退出 1。已核对相关 `main-workshop*` 和测试字节未变；证据只支持这项失败不由本次桥接改动引入，尚不能断言其根因是机器负载或生产锁缺陷。本轮不改锁、截止时间、断言或豁免。

[失败的完整 Smoke 报告](performance-interactive/smoke-failed.json) 与[成功的 Electron 报告](performance-interactive/electron-bridge-final.json) 分开保留。两项 WAIVED 仍是原五个音频和两个字体的具体缺席检查，其余断言继续执行；没有制作假资产或增加豁免。

另保留新接口不存在时的红测试，以及旧静态调用形状失配的初次失败；修正形状后原动态保存约束 81 项通过。安装依赖使用上一轮已经验证的锁定 runtime，**本轮未重跑 `npm ci`、未升级依赖**。日志中的 npm 配置弃用提示和 Node shell warning 未静默删除。

## 可复跑、派生物与范围

```sh
node scripts/perf/run.cjs interactive-profile -- node scripts/perf/inspect-electron.cjs --temp-root E:/tianming-perf-temp --cpu-profile
node scripts/perf/run.cjs autosave-paired -- node scripts/perf/round1-electron.cjs --baseline <54d1f650 的只读工作树> --repeats 1 --autosave --scenario sc-jianyan1-1127-shaosong --samples <上一轮生成的公开 shared-samples> --temp-root E:/tianming-perf-temp
node web/scripts/smoke-autosave-text-bridge.js
```

临时目录不放真实存档；固定样本的生成方法在 `scripts/perf/round1-electron-cases.cjs`。观察器只记事件类型/时间/元素 ID，不记输入正文。离线导出脚本 `scripts/perf/summarize-interactive.cjs` 不运行游戏或访问网络。

其余修改是复用现有 Electron/perf 设施的定点采样、读盘回归和脱敏统计。没有另建生产诊断服务。官方执行 `build-startup-phase-manifest.js` 与 `sync-official-scenarios.js`，没有生成新的跟踪差异（409 eager / 6 deferred、2 官方源/9 产物）。`sync-hot-baseline.js --write --version 1.3.4.11 --asset-root <原用户工作树> --temp-root E:/tianming-perf-temp` 只同步一个生产文件 `tm-save-lifecycle.js` 的 hash/size 和 generatedAt，仍 1094 条目；不手改 hash、版本或艺术资源。没有执行 release prepare/publish。

修改清单：生产 `preload-impl.js`、`web/tm-save-lifecycle.js`；回归 `web/scripts/smoke-autosave-text-bridge.js`、`web/scripts/smoke-runtime-save-consistency.js`、`scripts/electron/desktop-cases.cjs`；测试采样入口 `scripts/electron/bridge-main.cjs`、`scripts/perf/inspect-electron*.cjs`、`scripts/perf/round1-electron.cjs`、`scripts/perf/autosave-electron-cases.cjs`、`scripts/perf/summarize-interactive.cjs`；官方生成的 `web/.hot-update-manifest.json`；本文和 `docs/performance-interactive/` 脱敏证据。

被测生产代码之后没有变化。配对 runner 后来只将额外主进程/preload 哈希限制在 autosave 模式，保持上一轮微基准汇总器兼容；新增离线导出器与本文不改变测量代码。文档提交 SHA 变化不冒充重新运行测试。

仍重的路径：主进程/IPC/IO 尾部、长档手动保存、整页 UI 与部分抽屉重建、地图布局。此次不扩展到 Worker 保存协议或全 UI dirty 重构。状态：局部优化有实测收益和对应行为回归，**全量门禁仍有一个基线同样复现的压力超时**，不是可直接合并/发布的“全绿交付”。
