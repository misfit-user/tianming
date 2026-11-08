# 屎山清理·第一轮（2026-10-14）

同志令：「看看天命的史山代码情况，清理、优化一下」。本轮先摸底，再只动「能被门禁和 smoke 验证」的两刀；
其余列成账，等拍板。工作区 `E:/tianming-shishan-20261014`，分支 `claude/shishan-cleanup-20261014`，基于 origin/main `bddd3c51`；10-14 夜变基到主干最新 `d41e534a`，10-15 再变基到 `ac568161`（本目录的提交号都已换成这次变基后的最终号，新旧对照见「六」）。

## 一、摸底（bddd3c51）

| 项 | 数字 | 说明 |
| --- | --- | --- |
| web/ 顶层 JS | 606 个 · 41.5 万行 | 5 座超 3000 行（endturn-apply 5081 / endturn-ai 5025 / editor-authoring-agent 4508 / endturn-prompt 4214 / endturn-followup 3620），已在 file-size 棘轮里 |
| index.html 同步挂载 | 479 个 `<script>` · 20.3MB · 470 个无 defer | 启动分期清单 startup-script-phases.json 只把 9 个标为 deferred |
| styles.css | 649KB · 5176 条规则 | 按「类名/ID 在运行时文本零出现」估 240 条死规则（27.7KB，4%）；其中 `.ote-rank-N`、`.severity-N`、`.dir-out`、`.z-sup` 一类多半是动态拼类名，**不能机械删** |
| 函数级死码 | 1.58 万个声明里零引用 45 个 | 其中 14 个被 smoke/工具按名抽取（见下），真死 31 个 |
| 文件级孤儿 | 0 | tm-editor-fit.js / tm-workbench-*.js / tm-start-preparation-runtime.js 看似孤儿，实由 preview 页或原生开局清单挂载 |
| 全局同名覆盖 | 89 条在 `intentional-global-overrides.json` 白名单 | 多数是拆分家族的别名链；真重复的工具函数只有 `_getDaysPerTurn`（tm-utils→tm-edict-lifecycle）、`escHtml`（tm-utils→tm-chaoyi-changchao）、`robustParseJSON`（tm-utils→tm-ai-infra-json） |
| 根目录 docs/ | 140 个目录 · 164MB | 全是 Codex 任务证据；最大 `late-tang-person-20260917/` 65MB（一个 62.8MB 的 JSON 快照） |
| web/preview/ | 98 件 | 活的：剧本工坊重置预览一套 + 92MB `official-scenarios-bundle.js`；死的：45 件备份副本/坏编码副本/codemod |
| 88MB 双胞胎 | `web/tm-official-scenario-bundle.js` 与 `web/preview/official-scenarios-bundle.js` | 都由 sync-official-scenarios.js 派生、内容只差壳，两份都进仓 |
| release-hot/ | 79 件 1.2.x～1.3.4 推送脚本 | heal.py 7.6MB、graphql.json 3.1MB；OTA 已停用 |
| web/source-manifest.json | 2026-06-04 生成 · 974 条 | 剧本工坊 AI 代理 `listSource` 的源文件索引，四个月没更新 |
| console.log | web/*.js 里 311 处 | 未动 |

## 二、本轮做了什么

### 第一刀 `1a41d8db`：删 31 个零引用函数（445 行，15 个文件）
口径：任意缩进的 `function` 声明与函数表达式赋值，标识符在全部运行时文本 + web/scripts + scripts 里整词只出现一次。
按原始字节切行删除，混排的 CRLF/LF 不动。清单在提交信息里。

**保留的 14 个「测试钉住的死码」**（生产零调用，但 smoke 用 `functionSource()` 按名抽取后单测）：
`_buildSc{1d,15,15n,16,17,18,2,25,25c,27,28}JsonSchema`（tm-endturn-ai.js，被 smoke-final-completion.js 与工具 derive-sc-schema-from-prompt.js 用）、
`_seedRecordFromP1ForApplyFailure`（lib-player-error-regression.js）、`_fireCommitCanon`（smoke-sc1q-sc19-upgrade.js）、`rightIssueRows`（smoke-right-panel-lag-guards.js）。
要删它们得先改这些 smoke 的契约，属于另一刀。

### 第二刀 `550dee3f`：删 127 个一次性垃圾文件（19.9MB）
- web/ 根 4 件废 JSON/脚本/报告；web/preview/ 45 件备份与 codemod；release-hot/ 78 件旧推送脚本（只留 `.env.local.example`）。
- 随动：package.json / release-excludes.json / verify-release-contract.js 去掉已无对象的排除项；PROJECT-STRUCTURE.md 改 release-hot 口径；
  `.hot-update-manifest.json` 删 16 条条目并对齐哈希；`source-manifest.json` 删 37 条已删路径。

### 第三刀 `2fe0d0e0`：本目录两份记录
README 与 final-smokes.txt。

### 第四刀 `b77bb369`：变基后补齐派生清单（记录随后补在 `4ddcf633`）
主干 26ec4c81～d41e534a 那几笔改了 13 个文件的字节却没重生成派生清单，`sync-hot-baseline --check` 报 13 项 stale、
`build-startup-phase-manifest --check` 也 stale，GitHub guards 工作流的「Cross-release contract」在 d41e534a 上因此红。
这一刀按脚本顺序重生成：lint-global-providers 报告 → startup-script-phases.json → tm-start-runtime-manifest.json → 重打 .hot-update-manifest.json。
（顺序错了会像我第一次那样：用旧的 providers 报告生成分期清单，少 5 个新函数，smoke-startup-phase-observability 立刻抓出来。）

### 门禁
lint-arch-all 15/15 绿；verify-release-contract 176 项绿；sync-hot-baseline --check 绿；verify-hot-builder-gates 27 项绿；
build-native-preparation-manifest --check 绿；定向 smoke 177 + 13 + 41 全过；全量 ci-smokes 结果见本目录 `final-smokes.txt`。
变基到 d41e534a 后：lint-arch-all 15/15、hot-builder-gates 27、四项 --check、release contract 176 再次全绿；定向 smoke 190/190（含主干新加的税诏/过回合用例）。
Electron 七组未在本机跑（改动不含界面）。

## 三、没动的，和为什么

1. **`_getDaysPerTurn` 双定义**：tm-edict-lifecycle.js 那份带 `TM_RETENTION_GUARD: edict-days-per-turn-compatible-redefinition`，
   smoke-non-dead-retention-guards.js 钉着「两份都在」；另有 3 个 smoke 单独装载 tm-edict-lifecycle.js 不带 tm-utils。
   要集中化：tm-utils 版改成 Number() 口径的超集 → 删 edict 版 → 改 4 个 smoke → 白名单减一条。
2. **`escHtml` 双定义**：tm-chaoyi-changchao.js 的一行版在 index.html 里后装，**覆盖**了 tm-utils 版（差别：`escHtml(0)` 前者返回 ''，后者 '0'）。
   但 preview/changchao-preview.html 等两页只装 changchao 不装 utils，12 个 smoke 也单独装它，删了会炸。先让这些页/测试装 tm-utils，再删。
3. **`robustParseJSON` 双定义**：tm-ai-infra-json 版（带 OOM 护栏，#40 审计加的）在 index.html 覆盖 tm-utils 版；editor.html 只有 tm-utils 版。两边语义不同，要合并得先定哪份是正典。
4. **240 条死 CSS**：动态拼类名的误报率不低，要人工逐条看；收益只有 27KB。
5. **docs/ 164MB**：是 Codex 的证据目录，删不删是同志定；建议把 10MB 以上的快照 JSON 挪出仓（git 历史里有）。
6. **24 个 preview-*.html 设计稿**：发版已按 `previewMockup` 排除，不进包；前端重做期间留着当参考。
7. **88MB 双胞胎剧本包**：要省得改 sync-official-scenarios.js 和两处 parity 守卫，让 preview 复用主包。→ 第二轮预览包改适配器（「五」），第三轮 seeder 主包删掉（「七」）。
8. **index.html 479 个同步脚本**：真正的启动优化点（分期懒加载 / 合包），但要配 startup-script-phases 审计与 Electron 七组，另开专项。

## 五、第二轮（10-15 凌晨·同志「按你的想法逐个开」）

### 瘦身 `07a8d10f`：预览页剧本包改成 724 字节适配器
web/preview/official-scenarios-bundle.js 原是 tm-official-scenario-bundle.js 的同数据副本（92.8MB），只是全局名不同；两份都进发布包。
现在 sync-official-scenarios.js 把它生成为适配器：先装 ../tm-official-scenario-bundle.js，再按文件名换成 tianqi7/shaosong/tang840 三个 key。
三个读预览包的脚本改为先装主包；奇偶校验改断言「适配器含映射、不再内嵌第二份数据」。release contract 的 bytes 572,655,263 → 479,834,904。
顺带发现：仓里官方剧本其实有四份（scenarios/*.json 真源 90MB、web/scenarios/*.js 三个内建 92.8MB、seeder 主包 92.8MB、预览包）。
seeder 主包与三个内建脚本还是一对双胞胎（发布包里再省 92.8MB 的目标），但 seeder 要的是「数组 + 文件名」、内建要的是「注册进 P.scenarios」，
合并得改 tm-official-scenario-seeder.js 的装载方式并过 Electron 七组，留作下一轮。

### 清理 `fb8f2bad`：docs/ 移出 19 个超 1MB 的证据快照（102.9MB）
docs/ 共 2167 个文件 166MB；19 个超 1MB 的 JSON 占 102.9MB，最大 65.9MB。核过没有脚本、守卫、工作流读它们。markdown 与小文件全留。

### 去重 `4f7d2d68`：escHtml 只剩 tm-utils 一份
tm-chaoyi-changchao.js 的一行版后装覆盖了全站。改成模块私有 `_ccEscHtml`（28 处调用），可单独装载的预览/测试不受影响。
行为差异只在 0/false：以前全站 escHtml(0) 得空串，现在得「0」。白名单减一条。

### 去重 `f551b276`：robustParseJSON 只剩 tm-utils 一份（正典=修复层版）
正式游戏一直跑的是 tm-ai-infra-json.js 的修复层版（OOM 护栏、截断补闭合、并列多值主可解取主），tm-utils 的严格版只有编辑器在用，
而 smoke-player-text-memory-regressions 钉的恰是编辑器那份——测试盯着游戏不用的函数。现在修复层版并回 tm-utils（游戏与编辑器共用），
infra 文件删定义。_dbg 探测改 window._dbg，TM.platform 入 editor.html 跨入口悬空基线（与 TM.SimTime 同类）。三个 smoke 随动。白名单再减一条。
补漏 `7d90fb85`（10-15，全量 smoke 抓到）：smoke-building-appraisal-compat 一条 FAIL。它和另外 13 个 harness 整装 tm-ai-infra-json.js、却只按名抽 tm-utils.js 的几个函数，
以前靠 infra 文件顺带定义的 robustParseJSON 就没了；唯一调用点裹在 try/catch 里，ReferenceError 被当「解析失败」吞掉，只有走兜底解析路径的断言才露馅
（探针显示 smoke-secondary-task-retries 也静默走到过一次、仍 17/17 通过——假绿）。改共享装载器 lib-turn-reliability.js（12 个用户）与 3 个单独 smoke，
按名抽 robustParseJSON 进上下文；23 条受影响 smoke 用探针（钩 vm.runInContext 查 typeof）核过上下文齐全、全过。

### 没动：`_getDaysPerTurn`
retention guard 明钉「兼容性重定义」，三个 smoke 单独装载 tm-edict-lifecycle.js；15 行，值不回票价，留着。

### 评估 `4fe88d81`：index.html 479 个同步脚本不是启动慢的主因
新工具 `web/scripts/perf-startup-script-cost.js`（node vm + headless 桩，装载环境同 smoke-full-turn-flow）量了每个脚本的编译+顶层执行耗时，
结果在本目录 `startup-script-cost.md`：479 个脚本 20.2MB 合计约 1.5 秒（5 轮：执行取最小、编译取首轮冷值；单轮噪声能差 10 倍，机器当时 CPU 82%），world 分期 318 个占 69%，
最重的单个脚本 generated/tm-ai-change-applier.bundle.js 也只 23ms（几乎全是编译），前 30 名合计 319ms、占 21%。
结论：把脚本改成分期懒加载最多省一秒上下，还要配 Electron 七组回归；开局慢的大头在剧本 JSON 解析、深读与地图首渲（见 perf 第七~九轮记录），
不在脚本装载。本轮不动 index.html。

## 七、第三轮（10-15 上午·同志「交给你了，一个一个完工」）

### 瘦身 `1201d8ae`：删 92.8MB seeder 主包，桌面落盘器改经 loader 装内建脚本
web/tm-official-scenario-bundle.js（92,821,491 字节）与 web/scenarios/*.js 三个内建是同一份数据的双胞胎，都由 sync-official-scenarios.js 生成，
发布包、热更基线、仓各带两份。只用它的是桌面版落盘器 tm-official-scenario-seeder.js（首次启动把三部官方剧本写进用户剧本目录）和两个 node 校验。
现在只剩内建一份：
- 内建脚本模板：有 P 时照旧注册进 P.scenarios、不另留引用（loader 在 tm:p-restored 复位时才能把整份数据放掉）；
  没有 P 的独立页面（剧本工坊预览、node 测试）只登进 TMOfficialScenarioBuiltins 注册表，不再每 200ms 轮询 P。
- 落盘器：缺哪份就经 TMOfficialScenarioLoader.ensure(id) 装哪份（和玩家开卷同一条路），克隆后交 tianming.saveScenario；装不上整体失败、下次重试。
- 预览适配器 preview/official-scenarios-bundle.js 改读注册表按 id 换 key；预览页改挂三个内建脚本。
- 新 web/scripts/lib-official-builtins.js 统一 node 侧装载（默认静默 console：内建的「已注册」日志不再污染把 stdout 当结果读的父进程）；
  parity 守卫的执行态对照改三模式 builtin/game/preview（46 条）；smoke-official-bundle-parity / scenario-isolation / editor-reset-roundtrip
  与根目录 scripts/smoke-scenario-no-bleed 改读注册表；新增 smoke-official-scenario-seeder（24 项：对照表、非桌面跳过、只装缺的、深克隆、
  并发共用一次运行、loader 缺失重试、单份失败、占位不落盘、落盘失败、源码契约）。
- 随动：source-manifest.json 937→936；.hot-update-manifest.json 1396→1395（重生成工具只增不删，已删文件的旧条目手摘）；
  startup-script-phases / tm-start-runtime-manifest / bundled-scenarios/manifest 重生成；lint-scenario-data 语料排除表去一条。
release contract bytes 479,841,325 → 387,020,170；自第二轮开工前的 572,655,263 起，发布包共省约 185.6MB。

### 门禁
lint-arch-all 15/15、parity 46、release contract 176、hot-builder-gates 27、四项 --check 全绿。
定向 run-smokes 72 条（official/scenario/preview/manifest/startup/hot-/release/split/retention/source/orphan/desktop/electron/seeder/editor-reset/lazy 诸族并集）全过，
热更基线手摘旧条目后 hot-/manifest/release 三族复跑 7 条全过；根目录 smoke-scenario-no-bleed 的 A3 改前就红，与本轮无关。
全量 smoke 与 Electron 七组交 GitHub CI（PR → main），结果见 final-smokes.txt。

## 四、教训
- 扫描死码时，去注释的正则遇到字符串里的 `image/*` 会把半个文件吞掉，产出 70 个假死函数——**最终以「全文整词计数 ≤1」为准，不去注释**。
- 「被 smoke 引用」要用 `grep -rlw` 全目录核，别信自己脚本里的一次性判断（第一次漏了 14 个，smoke 抓回来 1 个）。
- `E:/tianming-main-port-20261014` 同时有别的会话在改，开工前 `git status` 干净不代表开工后还干净——动刀一律另开工作区。
- 搬顶层函数的宿主文件后，要查「谁整装了旧宿主却没装新宿主」：vm 型 smoke 常按文件名整装一族、按名抽另一族，
  `grep -l 旧宿主文件名 web/scripts scripts` 逐个看上下文。调用点裹在 try/catch 里时 ReferenceError 不会让 smoke 红，得用探针核，别信「跑过了就是对的」。
- 派生清单的重生成工具（patch-hot-baseline）只增不删：删了文件，.hot-update-manifest.json 里的旧条目要手摘；`--check` 会把它当「本 checkout 缺席的未跟踪资产」容忍过去（595→596），看不出来。
- run-smokes 的 `--grep` 要重复给（`--grep a --grep b` 取并集），逗号串成一条一个都选不中。
- vm 上下文里造的对象是另一个 realm，`assert.deepStrictEqual` 会因原型不同而失败，先 JSON 压平再比；async 函数每次调用都返回新 promise，别拿 promise 同一性当「并发共用」的契约。

## 六、提交号对照（10-15 变基到 ac568161 之后）

分支在 10-14 夜变基到 d41e534a、10-15 再变基到 ac568161，每次变基提交号都会换；本目录正文一律用最终号，旧号只在这里留档（远端分支已强推，旧号不在主干历史里）。

| 最终号（ac568161 底） | d41e534a 底 | bddd3c51 底 | 内容 |
| --- | --- | --- | --- |
| 1a41d8db | dd63e1b5 | 68c6ed22 | 删 31 个零引用函数 |
| 550dee3f | cf1d38a4 | b93b69ac | 删 127 个一次性垃圾文件 |
| 2fe0d0e0 | 0cb4fd94 | — | 第一轮记录 |
| b77bb369 | 3fe8b545 | — | 变基后补齐派生清单（主干漏更 13 项） |
| 4ddcf633 | 1416152d | — | 记录补充 |
| 07a8d10f | 672b9097 | — | 预览页剧本包改适配器 |
| fb8f2bad | e582e821 | — | docs/ 移出 19 个大快照 |
| 4f7d2d68 | 3476a04b | — | escHtml 只留一份 |
| f551b276 | 8f55bd30 | — | robustParseJSON 只留一份 |
| 4fe88d81 | 25f766ac | — | 启动脚本成本实测 |
| 7d90fb85 | b7509202 | — | 补漏：14 个 harness 补抽 robustParseJSON |
| 2700552f | 756d345d | — | 第二轮记录 |
| 7ae3f136 | — | — | 变基到 ac568161 后重生成派生清单（主干热更基线 19 项 stale 一并治好） |
| 8f05376d | — | — | 变基后全量 smoke 记录（已上主干） |
| 1201d8ae | — | — | 第三轮：删 seeder 主包，落盘器改经 loader（分支 claude/shishan-round3-20261015） |

final-smokes.txt 里各段标注的「分支 @ xxx」是每次跑 smoke 时的实际分支头，按这张表换算。
