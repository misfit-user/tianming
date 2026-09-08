# 天命性能第一轮：三个局部优化与同机验证

2026-09-07。结论：减少了规范存档的重复编码、被丢弃的镜像复制，以及一次地图渲染内的重复路径计算。长历史快照与规范载荷构造有可测改善；没有证明启动、所有地图交互或整局帧率都改善。

## 基线、范围、提交

- 分支：`codex/perf-round1`，独立工作树 `tianming-perf-round1`。
- 基线与再次查询到的远端 `main`：`814f3af65f6bd24f02fe8dc245eb9d7e31ea8489`。没有发现远端新改动。
- 原用户工作树保持 `codex/audit-20260905@5ed032afe65cc041dd4d890227ada23e736b4713`，开始与收尾检查均无未提交修改；其本地 `main` 引用仍在 `3f8065cb…`，没有替用户切换或更新。实际性能基线取的是远端已合并的 `814f3af…`，不是这个旧本地引用。
- 附件 README、两份 candidate patch、microbench 原结果和 18 项候选测试未取得。下述是新建的等价行为试验，不是执行附件的声明。
- 只做本地提交，没有推送、创建 PR、合并、改版本、打包、打标签、发布或部署。

| 本地提交 | 内容 |
| --- | --- |
| `d5db7979fc9fd826b797116c4b8269c0b84ffff6` | A：规范 JSON 复用一次 UTF-8 编码；行为测试与共享只读试验工具 |
| `1e09104f2aa42b568ed0e99133b3174116328ddf` | B：当前 render 内按对象复用地块路径；行为测试 |
| `f27b6325f5ef459bd171451cc037f623192696bb` | C：构造时省略最终会被丢弃的镜像；回归适配及生成的启动清单 |
| `e27313329338b20deee8ebd4c287c75daadfe3d5` | 配对微基准、真实 Electron/电脑操作试验设施与官方生成的哈希同步 |

后续证据提交只整理本文件、统计、脱敏日志及离线导出器，不改变被测生产实现。测试运行时尚未提交，所以日志的 HEAD 是 `814f3af…` **加当时工作树修改**，不是裸基线测试成功。每次运行另记工作树状态、生产文件 SHA-256；较晚运行还记录全部 dirty 文件哈希。[summary.json](performance-round1/summary.json) 的 `measuredCode` 与 [execution-index.json](performance-round1/execution-index.json) 可以核对。离线汇总器也强制检查六次 Electron 的三个生产文件哈希与微基准相同。

## 实际代码与行为不变量

### A：规范载荷编码去重

[tm-storage.js](../web/tm-storage.js) 的 `createCanonicalPayload` 同步得到唯一 JSON 后，只显式编码一次，字节长度用于统计/结果/未压缩回退，字节数组供 `_checksumJson` 的 SHA-256 使用，随后释放局部引用。增加 `save.utf8` 性能 span。

没有改变 JSON 内容/键顺序、SHA-256、缺 crypto/TextEncoder 时的 UTF-16 FNV 回退、gzip Blob/字符串格式、`state` 引用、identity 拷贝与冻结。原子世界/receipt、writeGuard、存档格式不变。“一次”指显式 `TextEncoder.encode`，不声称 Blob/浏览器压缩内部不再编码。

[smoke-perf-canonical-utf8.js](../web/scripts/smoke-perf-canonical-utf8.js)：11 项，覆盖 Unicode/emoji/组合字符/孤立代理项、两种格式、缺能力、压缩失败、摘要失败与后续恢复、非法 JSON、异步期间修改输入及并发身份隔离。

### B：同次正式地图只计算一次地块路径

[phase8-formal-map.js](../web/phase8-formal-map.js) 的 `renderFormalMap` 在原 signature guard 后建立局部 `Map`，以地块对象作键；wash/halo/face 三层共用结果，空路径用 `has()` 缓存。没有跨帧缓存，不改海域、层级、图层、标签、美术、rAF 或 signature 失效方式。

[smoke-perf-map-render-path.js](../web/scripts/smoke-perf-map-render-path.js)：13 项，覆盖 d/path/points/polygon/coords、空路径、重名 ID、重复对象、就地改点、换局复用 ID、异常恢复、两个官方地图与三层输出一致。

同一官方输入的调用量：绍宋 182 个点阵地块从 546 次变为 182 次；天启 43 个预生成 d 地块加 8 个海域从 137 次变为 51 次。减少调用不等于两种数据得到同样耗时收益。

### C：不构造马上丢弃的 23 个镜像

[tm-save-lifecycle.js](../web/tm-save-lifecycle.js)：原 `_autoSaveSnapshotGM` 的 SKIP 原样移入 `_tmSaveSnapshotSkipKeys()`；规范 `_buildSaveState` 显式给 `_prepareGMForSave` 传 `omitDiscardedMirrors`，在克隆前判断同一份策略。直接调用准备函数仍保留旧默认语义，不全局删除 `_saved*`。

23 个省略目标（均以 `_saved` 开头）：Families、ConvArchive、Letters、CharacterArcs、ProvinceStats、AdminHierarchy、EdictTracker、BattleHistory、NpcActionLedger、NpcFactionAiTurnLedger、MemoryLayers、MemoryArchiveFull、CausalGraph、FactionArcs、Chronicle、MapData、CourtRecords、EdictSuggestions、CulturalWorks、FactionRelationsMap、EdictLifecycle、NpcCommitments、HistoryIndex。

保留实际默认值/迁移规范化器、EventBus/Opinion/Chronicle/WarWeight 序列化、DOM 草稿、GM/P 必要字段、Renli、切片诊断、detached snapshot、身份/加载屏障/保存次序。准备函数与快照函数没有各复制一套名单。

[smoke-perf-save-preparation.js](../web/scripts/smoke-perf-save-preparation.js)：13 项，两个官方剧本 × 短/800 条受控历史，真实规范化器及子系统，idb/project 字节与键顺序一致、减少恰好 23 次镜像 clone、旧档恢复相同、用户草稿和 live GM/P 不变、损坏 schema 失败后可恢复。真实 Electron 又验证实际新局启动、全 provider、输入草稿保存后 IPC 读取。

8 个原测试/基准只同步了抽取器对新策略函数的依赖与新参数：`benchmark-round20-workloads`、`smoke-round20-performance-isolation`、`smoke-runtime-save-consistency`、`smoke-save-integrity-audit`、`smoke-save-saved-clone`、`smoke-save-slim`、`smoke-turn-capture-work-count`、`smoke-write-gate-expansion`。须保留字段、工作量、故障和身份断言没有删除；`smoke-save-slim` 改为执行实际策略对象，避免把注释误当名单。

## 性能方法与环境

Windows 11 家庭版中文，10.0.26200；i5-13420H，12 逻辑处理器，25,480,257,536 字节 RAM。CLI Node 24.14.0；锁定 Electron 33.4.11 / Chromium 130.0.6723.191 / 内嵌 Node 20.18.3。终端 PowerShell 7.6.5，显式移动端门禁用 Windows PowerShell 5.1.26100.9168。可见窗口固定 1280×800。

采用同机两份工作树，候选与基线字节有记录。微基准每个变体先 2 次 warmup，再交替 9 次；正式 Electron 顺序为 before0、after0、after1、before1、before2、after2，每进程新建临时 userData、屏蔽生产网络、不配置 API。未清 OS 文件缓存，首次/后续启动原值分别保留，不能称为严格冷启动。没有排除最慢的 before2；其他桌面程序并未完全隔离，小样本 p95 只是描述统计。

真实运行先经 `TMOfficialScenarioLoader` / `doActualStart` 建立新局，再加载同一份公开数据构造的长历史样本：

| 样本 | 长历史文件字节 | SHA-256 | 实际新局角色/地区 |
| --- | ---: | --- | --- |
| 绍宋 | 35,625,923 | `3d4916bc9cb9cea8a79607214f90e08140afb8f1b9ce0b10f689a6296edd6157` | 485 / 182 |
| 天启 | 42,535,361 | `58091d5de0070bb8c0fadb3a10f4719e446e7d55faa7a63ba7e248cf6605f9c1` | 203 / 43 |

六次进程的对应样本哈希完全相同。只提交统计和轨迹，不提交大存档正文、真实玩家内容、凭据或临时 userData。字节比较时只在同步断言内固定 `Date.now`，避免草稿 `updatedAt` 不同；测量期间不冻结时钟。微基准样本与完整运行时样本不同，不能直接横比两表。

复用 `TM.perf` 和正式 bridge gate，记录 stringify/UTF-8/规范化/快照、异步压缩/hash span、实际 main 的 stringify/write/fsync/rename、main 事件循环延迟、CDP task/layout/DOM、长任务和 rAF 间隔。仪器自身有开销；每操作的指标包含 100ms settle，wallMs 不含 settle，但含测试调用往返。压缩与摘要的 wall span 可重叠，不能相加当连续主线程阻塞。DOM 增减记的是 mutation 根，不是所有后代；未对每个隐藏子树强制测量布局。

### 微基准：p50 毫秒，9 次/侧

| 操作 | 绍宋 before→after | 天启 before→after |
| --- | ---: | ---: |
| 地图函数与字符串生成（非浏览器绘制） | 24.10→9.08 | 0.629→0.653 |
| 短状态快照 | 157.29→158.89 | 258.60→172.65 |
| 长历史快照 | 209.69→159.94 | 288.23→222.83 |
| 规范载荷，gzip（异步总时间） | 798.64→724.79 | 734.47→606.47 |
| 规范载荷，字符串回退 | 384.10→171.01 | 366.56→165.79 |

绍宋短快照没有明显收益；天启预生成路径本来很便宜，局部 Map 微基准没有提速。这些结果没有被挑掉。[原始每次数据](performance-round1/microbench-raw.json)。

### 真实未打包 Electron：p50 毫秒

快照/规范载荷/地图每个进程 3 次，即每侧 9 个记录；其余每侧 3 个。六次进程全部完成，退出码均为 0。

| 操作 | 绍宋 before→after | 天启 before→after |
| --- | ---: | ---: |
| 实际新局 | 2396.7→2276.2 | 2589.1→2537.6 |
| 读相同长历史样本 | 2781.8→2698.3 | 2944.8→2913.0 |
| 长历史快照构造 | **773.5→479.4** | **1002.0→774.7** |
| 规范 JSON/编码/压缩/hash 总时间 | 2411.4→1767.5 | 3426.0→3154.6 |
| 地图完整 rebuild | 229.2→206.3 | 172.5→158.7 |
| 面板切换 | 79.1→74.3 | 86.3→70.5 |
| 合成 wheel/pointer 平移缩放 | 316.9→255.7 | **221.5→236.2** |
| 打开诏令面板 | 80.1→62.3 | 154.9→145.7 |
| 手动保存 + IPC 读回确认 | 10657.6→9537.3 | 22403.1→16648.7 |
| 请求后台保存并 flush canonical/桌面镜像 | 7972.3→6179.3 | 13469.6→10184.2 |

对应快照最长任务的中位值为绍宋 772→478ms、天启 1001→769ms，说明一部分同步工作确实减少。准备函数中位累计时间分别为 86.8→8.2ms、112.2→21.2ms；规范载荷 UTF-8 累计时间为 548.9→192.8ms、810.5→262.1ms。

但地图尾部没有一致改善：绍宋 wall p95 280.1→359.0ms、天启 231.2→285.4ms；天启合成平移缩放也没有提速。天启手动保存过程仍有约 4.56s 的最长 renderer 任务（中位记录），前后基本不变。端到端保存还包含读取和测试确认，不能当成用户点击保存的纯写盘延迟。

主页 navigation：before 2145.7/2128.7/2756.9ms，after 2296.4/2244.5/2221.6ms，不宣称启动提速。renderer 进程峰值工作集 before 约 1.37/1.53/1.58GiB，after 约 1.52/1.56/1.58GiB，不宣称整体峰值内存下降。main RSS 只是 25ms 采样峰值，不能冒充无遗漏的系统峰值。

[六次完整记录](performance-round1/electron-raw.json) · [分布/长任务/布局/内存/IO 汇总](performance-round1/summary.json)。

## 电脑操作观察（不是配对基准）

按用户授权使用 computer-use skill，操作**真实隔离 Electron 正式 main/preload**，而非伪造 `window.tianming`。实际打开绍宋新局、关闭引导、展开诏令、输入无隐私的中文测试草稿、关闭面板、地图滚轮与拖动；最后正常关窗，保存握手退出码 0。未调用 AI、未推进真实玩家回合。

- 看到草稿正常显示；实际 input 事件到下一 rAF 约 16.7ms，只有一个观察样本，且输入工具注入文本，不是中文输入法候选/组合态验收。
- 打开诏令的一个点击到下一帧约 127.7ms，伴随约 127ms 长任务。
- 看到“未响应”状态，以及约每 60 秒出现的 1.5～5.2s renderer 长任务；只有时间相关性，没有 CPU 调用栈证明它们全部属于自动存档或某个函数。不得把工具截图等待时间换算成游戏卡顿时间。
- 操作期间有用户活动/焦点变化，可访问性树读取本身也有额外开销。这段仅作定位线索，**不进入前后性能分布**。没有在这段电脑观察中完成一次 UI 手动保存；前面的固定 Electron 试验独立完成了实际保存/IPC 读回。

[有界事件与长任务轨迹](performance-round1/computer-use-trace.json) · [运行与安全检查](performance-round1/computer-use-report.json) · [源码哈希](performance-round1/computer-use-source.json)。观察没有导致关闭安全边界、降低保存频率或追加一层防抖，也没有被用来支持“输入不再卡顿”的结论。

## 回归、门禁与执行证据

所有表内最终命令退出码 **0**。PASS 单位分别注明，不把脚本数、内部断言和三个 Electron 模式重复检查相加成一个总数。

| 命令/入口 | PASS / FAIL / SKIP / WAIVED | 秒 | 证据索引 label |
| --- | --- | ---: | --- |
| `node web/scripts/run-smokes.js --grep smoke-perf-canonical-utf8 --grep smoke-perf-map-render-path --grep smoke-perf-save-preparation` | 3 脚本、37 内部断言 / 0 / 0 / 0 | 21.5 | final-slices |
| `node web/scripts/ci-smokes.js` | **912 / 0 / 0 / 2，914 个唯一结果** | 92.3 | full-smoke-final |
| `node web/scripts/lint-arch-all.js` | 13 守卫 / 0 / 0 / 0 | 17.4 | final-architecture |
| `node scripts/verify-electron-bridge.js` | 11 production + 10 test-exports + 6 restart / 0 / 0 / 0 | 21.9 | electron-final-regression |
| `node scripts/verify-remote-tls.js` | 5 / 0 / 0 / 0 | 1.4 | controlled-tls |
| `node scripts/verify-release-contract.js` | 166 / 0 / 0 / 0 | 3.2 | release-contract |
| `node web/scripts/verify-official-scenario-parity.js` | 27 / 0 / 0 / 0 | 3.0 | official-parity |
| `node web/scripts/verify-hot-builder-gates.js` | 27 / 0 / 0 / 0 | 3.8 | hot-builder-gates |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 vulnerabilities；不计为游戏断言 | 5.0 | dependency-audit |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11 --temp-root E:/tianming-perf-temp` | 1094 条目；684 在场 / 410 按现有规则缺席；无 stale/missing | 1.0 | hot-baseline-check |
| `powershell -NoProfile -File mobile/scripts/verify-staging-dryrun.ps1` | dry-run 成功；不生成安装包 | 1.1 | mobile-dryrun |
| `powershell -NoProfile -File mobile/scripts/stage-web-for-cap.ps1 -WwwDir E:/tianming-perf-temp/mobile-www-round1-5223106` | 689 文件 staging 成功 | 31.0 | mobile-stage |
| `powershell -NoProfile -File mobile/scripts/verify-staged-web.ps1 -TargetDir E:/tianming-perf-temp/mobile-www-round1-5223106` | 689 文件对账成功，allowedExtra 0 | 2.2 | mobile-verify |
| `node web/scripts/audit-repro.cjs --repo <当前工作树> --expect-clean` | 11 NOT_REPRODUCED、2 CONTROL_PASS、0 HARNESS_ERROR/DEFECT | 0.5 | audit-checkout-probes |
| 配对微基准 / 六进程 Electron（命令见下节） | 均完成；所有行为断言通过 | 69.0 / 706.8 | microbench-final / electron-performance-final |

全量 Smoke 沿用原七条**具体缺席资产**豁免：`smoke-audio-bgm.js` 中五个 mp3（tianming-hegui、gucheng-junqi、hanwei-fengyun、changhe-zhangu、yunkai-wanli）；`smoke-mapeditor-ui.js` 中 ZCOOLXiaoWei 与 MaShanZheng 两个字体。其余检查仍执行，两脚本退出码 0。不曾制作假资产、移除测试或修改豁免规则。

[全量结构化报告](performance-round1/smoke-final.json) · [最终 Electron gate](performance-round1/electron-bridge-final.json) · [全部包装执行的命令、状态、SHA 与耗时](performance-round1/execution-index.json) · [对应 stdout/stderr](performance-round1/logs.json)。日志仅替换本机用户目录及结构化的临时 userData 字段；保留原始来源 SHA 与导出后 SHA，空格/换行以 JSON 无损保留。未经脱敏的原日志仍在本地 `web/dev-tools/perf-round1/`；[附加报告索引](performance-round1/additional-evidence.json) 标明来源与哈希。

前置安装实际执行 `npm ci --ignore-scripts`、`node node_modules/electron/install.js`，均退出 0；版本锁未改。这两步早于日志包装器，只保留了终端结果，不伪称拥有独立 raw artifact。`git diff --check` 与最终字节核对另见收尾日志。

### 保留的失败与适配记录

- 同一候选回归工具指向裸基线：A 为 8 PASS/3 FAIL、B 为 1 PASS/12 FAIL、C 正确适配后为 9 PASS/4 FAIL；失败落在新工作量约束，旧行为输出仍校验。不是拿 NOT_REPRODUCED 单独证明优化。
- C 初次试验缺真实 `_rngState`，属于 HARNESS_ERROR，不是生产缺陷或成功；补入实际依赖后重新运行，原失败日志保留。
- 首轮全量为 907 PASS/5 FAIL/2 WAIVED。四项为 SKIP 抽取器/参数形状适配，一项为启动清单新 provider 未生成；执行实际策略、保留原断言并生成清单后，最终为 912/0/0/2。
- 一次把多个 `--grep` 写成含 `|` 的单个字面值，选中 0，按规则失败；之后改为多个参数，没有取消空集合门禁。
- Electron 探索阶段分别遇到草稿时间戳不同、找到了隐藏旧输入框、将未 await 的请求 Promise 返回跨进程克隆。修的是测量适配器；最终选择实际可见输入、只在相等断言中固定时钟、真正等待请求，失败日志仍保留。
- 早期 microbench 与其他重门禁并行，不用于最终性能表。最终微基准和配对 Electron 没有同时跑本任务重测试，但不声称整个操作系统完全空闲。

## 派生物与文件清单

生产只改上述三个文件。其余为三项 Smoke、共享 `web/scripts/lib-perf-round1.js`、前述八个抽取器适配、`scripts/perf/*.cjs`、复用的 `scripts/electron/bridge-main.cjs` 测试入口、本文与统计证据。

官方生成流程实际运行：

```sh
node web/scripts/build-startup-phase-manifest.js
node web/scripts/sync-official-scenarios.js
node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root <原用户工作树> --temp-root E:/tianming-perf-temp
```

前两者退出 0；启动清单只增加 `_tmSaveSnapshotSkipKeys`，仍为 409 eager / 6 deferred。官方剧本同步报告 2 源/9 产物，跟踪的剧本正文和派生数据没有差异。

哈希同步是现有版本的非发布维护：四个在场文件 hash/size（上述三生产文件及启动清单）与 generatedAt 更新；生成器还剔除了磁盘已缺席的两条重复 README 路径 `assets/assets-isolated/audio/bgm/README.md`、`assets/assets-isolated/fonts/README.md`，因此 1096→1094。这两条不是游戏音频或字体本体，原哈希与正常 README 相同。没有手改 hash、改版本、删除真实资产或收敛为 tracked-only；410 个既有缺席条目仍按原契约保留。没有执行 release prepare/publish 或安装包构建。

## 可复跑

在候选工作树运行；baseline 为独立只读工作树，临时目录须有足够空间。脚本读取两个官方场景，禁止传入真实玩家私密存档。

```sh
node scripts/perf/run.cjs microbench -- node scripts/perf/round1-microbench.cjs --baseline ../tianming-perf-baseline --repeats 9 --out web/dev-tools/perf-round1/microbench-final.json
node scripts/perf/run.cjs electron-performance -- node scripts/perf/round1-electron.cjs --baseline ../tianming-perf-baseline --repeats 3 --temp-root E:/tianming-perf-temp
node scripts/perf/run.cjs computer-use -- node scripts/perf/inspect-electron.cjs --temp-root E:/tianming-perf-temp
```

第三条会显示隔离新局供电脑操作，正常关窗结束；不是无人值守重复采样。两种性能模式都不启用 `TIANMING_TEST_EXPORTS`，使用正式 main/preload，保留 sandbox/contextIsolation/nodeIntegration 与可信 IPC 检查。测试钩子只存在于 `scripts/`。内置 30 分钟上限只退出这份 disposable 测试进程，不是生产退出实现。

数据汇总不重新跑测试：

```sh
node scripts/perf/summarize.cjs --electron web/dev-tools/perf-round1/electron-61559156-5269-49a2-b426-96c08b7d0f22/report.json --smoke web/dev-tools/arch-guard/ci-7jW7Ep/smoke-report.json --bridge web/dev-tools/electron-bridge/ade70bf3-afcc-4ecf-bd65-04702a3e8ec5/report.json --inspect web/dev-tools/perf-round1/inspect-1ab3ba2e-466e-49c9-a02e-b785654f8fa7
```

## 尚重的路径与本轮边界

1. 大快照复制、renderer/main structured clone、main 同步 stringify 仍重。长档手动保存中最大一次 main stringify 的中位值约 349ms/427ms；未单独分离纯 IPC 运输与 clone 成本，不把 Worker 改造当成已完成。
2. 全 UI 重建、地图布局/标签工作仍在，地图 tail 与天启滚动没有一致收益。没有跳过旧 `renderGameState` 的状态同步、草稿/焦点/GameHooks，也没有减面、删标签或持久跨帧缓存。
3. 电脑观察中的周期性长任务需要后续 CPU 调用栈归因，当前不是已确认的具体新缺陷；不以提高保存间隔掩盖它。
4. 未测真实 AI 网络等待/首 token/流时间、完整 AI 回合前后、物理中文 IME 组合态、GC 暂停与连续 GPU 绘制归因、签名安装包；无 API 请求。隔离 checkout 缺未跟踪大美术/音频，不能代替完整资产加载性能。
5. 没有重写回滚对象图快照、主进程序列化、全 UI dirty 调度、启动 feature 边界或后台保存策略。rAF/长任务/堆数据是所列受控样本，不是全游戏 FPS 保证。

状态：**代码已修改并本地提交；所列回归和测量已执行；未推送、未合并、未发布。** 达到首批可测改善后收口，下一轮应针对已记录的重路径单独设计，而不是扩大本次三个切片。
