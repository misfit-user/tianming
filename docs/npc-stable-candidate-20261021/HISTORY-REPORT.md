# NPC 本地人物模拟首版候选

## 当前结论

**最近已测候选 f4359559260a76417e75a5de76c094fc2248ed4c，包含NPC功能1524724与main b0c80e5（PR #110）。本机59项／两官方兼容／六静态门禁通过。923本机正式链通过、923远端OOM失败继续分列；8a采样CI虽通过，但CDP隐式GC使它只能算诊断，不能作为正常验收。还需最终候选未采样正式门禁，不宣称稳定交付或已合并。**

| 身份 | 当前值 |
| --- | --- |
| 最近已测候选提交 | f4359559260a76417e75a5de76c094fc2248ed4c |
| 运行时代码来源 | NPC功能1524724fc45ccd1e04ae61717db9f789f267ca9b＋main b0c80e5ae005912effbc947af027d021505c1dbd |
| 已纳入 main | b0c80e5ae005912effbc947af027d021505c1dbd（含PR #109、#110） |
| 旧 152 本机门禁 run | ad379252-a0c9-473d-a003-bdda4a7bdae1，54 PASS／2 TIMEOUT |
| 旧 152 输入身份 | 2,390 文件，运行前后 hash 相同 |
| 923远端 guards | run39904863206／job120254352752 成功：1183 PASS＋2既有WAIVED／1185实际执行 |
| f435本机门禁 | run641d560d：59／59＋两官方＋六静态通过 |
| 8a采样组合CI | run39907873427／job120263871955原断言通过，仅诊断，不计正常验收 |
| 本机正式组合 | 923原断言通过，run67c9b63c；最终可见结果还需补证 |
| 远端组合／全部 CI | 同树组合明确OOM失败，run93affced；不能合并 |
| 分支／PR | codex/npc-composite-r123-20261011／#105，未合并 |
| 发布 | 未改版本、未部署、未打包 |

## f435 本机门禁与main整合

f435本机已完成整轮：run641d560d-e44c-4955-ac92-0e1559bd43ab，**59／59通过、两官方兼容通过、六项静态门禁通过**，总327.221秒。锁定Electron33.4.11以Node20.18.3子进程运行，原120秒、单并发、零重试；失败／超时／豁免／flaky／suspect／skip均0。full-turn57.258秒，startup53.455秒，官方组合smoke51.218秒；天启兼容7.636秒、晚唐24.268秒，均模型尝试0。2395输入运行前后hash相同：3fd173af0f52ab806c2aead280f38d7fb417e410451c2b82e4a144c7dade7971。完整证据为final-gates/2026-10-23T06-11-20-025Z-641d560d-e44c-4955-ac92-0e1559bd43ab/SUMMARY.json与同目录原报告。

首次f435 run68aae9ea的59项也通过，但交付兼容检查器仍读取旧compiledScripts条目的.source而失败，未进入两剧本实际检查。这是检查器与main缓存形态不匹配，不归为环境或游戏失败。只适配docs/check-other-officials.cjs：真实vm.Script缓存键对应实际源文件，读取字节取hash；39条原断言保留，新增2条身份断言。原失败未覆盖，随后整轮重跑通过。main的冻结启动脚本清单、首次编译缓存、NPC进入屏障与区划批量解析均保留；startup冲突审计见startup-merge-b0-audit.json。

## 8a采样诊断：成功不等于普通验收

8a远端组合CI39907873427／job120263871955已终结，实际checkout15b58bd11e49c2e061ccfeb3813b0479232d118f、run c758790a-f00f-4416-bcb7-25e8ac538975，1134.616秒，原业务断言通过。收尾后通过正常按钮重新打开的结果卡在04-completed-return.png中实际可见，包含双方已收到、讨论内容和已返回原处。但该运行开启CDP堆分配采样，必须标为`diagnostic_pass`、`formalAcceptancePassed=false`，不能作为普通未采样验收或OOM已经修复的证据。

先前“没有显式GC命令，所以不会GC”的表述不准确：与实测V8基准版本13.0.245.25对应的源码表明，CDP `startSampling`设置`kSamplingForceGC`，读取`GetAllocationProfile`会进入`CollectAllGarbage`路径。诊断可能改变回收时机；未显式调用`HeapProfiler.collectGarbage`不等于未触发GC。核对范围是匹配的上游V8基准tag，未声称审计所有Electron补丁。原日志不倒改，修正说明和原始blob／hash见[upstream-v8-gc.json](allocation-probe-20261023/upstream-v8-gc.json)，来源为[V8 inspector](https://github.com/v8/v8/blob/13.0.245.25/src/inspector/v8-heap-profiler-agent-impl.cc)与[V8 sampling profiler](https://github.com/v8/v8/blob/13.0.245.25/src/profiler/sampling-heap-profiler.cc)。

证据browser-8a-diagnostic/保存原报告、全字段压缩时间线、最终可见PNG与hash；不复制整批97个profile或crash dump。源码分配分析另列，不能仅凭采样后不崩溃认定正常运行已修复。

## 8a 诊断实现范围

8a提交只涉及测试桥、组合测试、CDP分配采样模块／空窗探针、相应smoke和CI接点。最终结果读取移至后台保存收尾后，再用普通按钮打开并检查可见内容；它没有扩大游戏堆、修改世界数据、放宽原期限或修复已发生的OOM。新增诊断单测11／11与真实CDP空窗协议探针分别记录；空窗协议通过不能代替正式游戏或证明OOM原因。原始探针report／profile及8a诊断smoke完整输出、hash见allocation-probe-20261023/SUMMARY.json；空窗探针发生在8a提交前，原报告没有Git SHA，未倒填为提交后验收。

8a的57项计划和923的56项计划保留为未执行历史。合入main后最终本机实际执行59项，新增main的进入屏障与区划批量解析回归；当前通过证据只引用上面的f435 run641d560d。

## M1—M4 当前验收范围

| 目标 | 当前结果 |
| --- | --- |
| M1 职任与外出 | 生产模块21组通过；完整假制／全部代理UI不在已验范围 |
| M2 现场事件 | 生产模块及923本机正式链通过；长区间保留真实NPC回应和玩家选择 |
| M3 正式试玩与恢复 | 923本机原正式链通过；8a采样运行已看到最终结果卡，但普通未采样新候选仍待验证 |
| M4 持续运行与候选 | 923本机60日和f435本机最终门禁通过；仍需未采样组合CI，不能借采样GC成功消除923 OOM风险 |

## 923 正式组合：本机通过与远端失败分列

923 本机正式组合 run **67c9b63c-d08f-4183-b3aa-5e97109fc8de** 的原断言完整通过，exit0／1204.076秒。保留绍宋513人、39势力与正式地图；从真实协助材料来源、玩家按钮邀请／启程／提问到NPC独立接受和回答，使用顶层endTurn推进 **0→30→37→60日**。在第30日在途和第37日现场待答时，实际菜单保存／加载槽1与槽2，世界代次 **0→1→2**；第37.5日NPC实际回答，双方最终返回原出发地ssr-0048。仅一条discuss与一条discuss_response，成果有稳定resultId和个人经历／记忆引用。3个真实顶层区间分别为30／7／23日，省经济恰好执行3次且原字段发生变化。最终后台复核与保存自然收尾，canonical revision17与desktop saved revision17一致，当前day60／turn4／load2。

具体问题是“如何分清材料中的已知事实、本人陈述和仍待确认之处”；玩家第37日选择先问理解，NPC第37.5日独立答复“材料中的本人陈述和还没有交叉来源的段落，都只能先列为待确认”。结果meeting-discussion:plan:daily-ui:1792732990299:4:1引用游戏练习，不冒充史料。完整可核对活动／消息／结果在browser-923-local-pass/summary.json和composite-timeline.json。

同文件树的远端组合 run **93affced-3b75-48a7-8281-34f59de88f59**（CI39904863206／job120254352816，checkout0ad31616537aa80bd732391cbac0b618fd001b59）在569.316秒失败。两次实际加载和现场问题均已完成；随后Chromium明确报告 **reason=oom、exitCode=-536870904**，没有最终NPC回答／物理返回／持久化终结证据。因此远端组合CI仍阻断，不把本机成功与远端guards成功拼成全绿。

本机最后的04-completed-return.png实际显示主地图；虽然原DOM与业务断言通过，仍需在后台收尾后用正常按钮重新打开结果，并补可见结果的强断言及截图。183,387,794字节是本次最终磁盘autosave的实测大小，不是从零增长或存档增量。采样最大JS used heap为3,372,812,355字节，最大renderer private为5,679,180KiB；它们是采样观测，不是连续测量峰值或远端OOM根因。

外部响应边界记录92次尝试：独立NPC5（规划调度计数3、兼容2）、routine-review6、带kind的world-subcall45、其他直接producer36；真实出站请求记录0、fixture error0。495个可见规划request ID不等于495次调用；终态为2 no_change、493 expired。这些全部是goal_initial，最大已观测pending年龄7日；过期清空不证明全体目标公平续办或成功，两步规划回归另列，详LEGACY.md“官方持续运行的规划覆盖边界”。没有将其他世界过程置空，也不宣称全游戏离线。省经济证明范围为逐顶层区间恰好一次及源字段变化；GM.guoku.money投影的恢复守恒未由本场景断言，本轮不据此诊断或扩建财政。

证据分目录：browser-923-local-pass/（成功汇总、原报告、保留全部字段的压缩时间线、四张截图、采样和实际autosave大小）；browser-923-remote-oom/（失败汇总、原报告、时间线与采样）。ARCHIVE.json记录原文件和归档hash；大crash dump保留在原测试artifact，未放入交付目录。

## 923 测试接线与独立验证

- 最终组合观察回归 **90／90**：只读取真实后台复核、canonical 保存及桌面持久化回执；仍以原整套期限等待，不主动保存、重试或取消。旧版观察器对新增严格 transport 分支为 89 PASS／1 FAIL，修正后 90 PASS／0 FAIL；完整输出及最终文件 hash 见 composite-final-background.json 的 strictTransportRevision。这个结果不是完整 Electron 通过。
- 两个 VM 集成夹具使用原生 Blob／Response／CompressionStream／DecompressionStream，并核对真实 gzip 及精确解压。原 full-turn 26 条、startup 77 条断言全部原样保留，各新增 6 条；未改用例期限或 delay。startup 的每个 VM 在本例断言后或异常退出时释放自己的 timeout／interval／immediate／RAF。见 fixture-freeze-audit-20261023.json。
- 锁定 Electron 33.4.11 的 Node 20.18.3 单项 startup 对照：**1 PASS、103.280 秒、12／12 case 完成**，原 120 秒、零重试，输入 hash 前后不变。运行当时 HEAD 为 152，夹具字节随后原样提交到 923；证据 startup-electron-node20-20261023/SUMMARY.json、startup-report.json、run-end.json。它不覆盖既有 Node24 超时，不是浏览器或实际磁盘读档证明。
- 前一轮 Oct22 Node20 实验只有启动日志，无最终报告且进程已不在；登记 interrupted，原因未知，不能记为 PASS 或已知超时。见 startup-electron-node20-20261022/interrupted-observation-20261023.json。

## 923 远端 guards 终结证据

远端 guards 已在实际 checkout **0ad31616537aa80bd732391cbac0b618fd001b59** 通过，文件树与923相同（836d8be0bd29a5ad298ff4ea8858348d37380c65）。Ubuntu／Linux x64、Node v22.23.3，run39904863206／job120254352752；1185 项实际执行：**1183 PASS、0 FAIL、2 既有 WAIVED**，flaky／suspect／SKIP均0。豁免仅为旧的可选音频／字体资源，未新增。full-turn55.560秒、startup57.764秒及observer90／90均在该轮通过。原报告与精确环境见 remote-923-guards/SUMMARY.json、arch-guard/ci-aG8zzm/smoke-report.json；原日志 remote-923-guards.log。此结论限 guards，不等于组合 Electron、全部 CI jobs 或本机最终门禁通过。

## 旧 152 本机门禁（不继承为 923 通过）

| 本轮步骤 | 退出码 | 耗时 |
| --- | ---: | ---: |
| 56 项定向回归 | 1 | 424.600 秒 |
| 天启／晚唐兼容 | 0 | 70.238 秒 |
| 架构检查 | 0 | 43.941 秒 |
| 官方派生对账 | 0 | 89.372 秒 |
| Native 清单 | 0 | 0.893 秒 |
| Startup 清单 | 0 | 0.389 秒 |
| 发布契约 | 0 | 4.697 秒 |
| 热更基线 | 0 | 3.113 秒 |

实际进程 exit 1，总耗时 **648.745 秒**，2026-10-22T16:48:54.117Z—2026-10-22T16:59:42.862Z。56 项全部执行：54 PASS／2 timeout，WAIVED／flaky／suspect／SKIP 均为 0，无自动重试。本机发现 1185 个 smoke，选定执行 56；不能据此填写当前完整 CI 总数。

- smoke-full-turn-flow.js：120.415 秒触及原 120 秒外层期限，捕获输出为 0 字符；测试把阶段日志留在内存，原输出不能定位更细阶段。
- smoke-start-game-data-integrity.js：120.494 秒超时，最后完成 deepread-config-is-immutable；尚未输出最后的 stale-call 检查通过。
- 两测试、headless 夹具、runner 与 151a 字节相同；Node、E 临时根、单并发、隔离调度、无 NODE_OPTIONS、原期限相同。现有证据不足以归因于环境或新实现。
- 单次旧 151a 两 runtime 注入对照确实加载旧 travel/review，13.719 秒 exit 1：正式开局的原 10 秒 VM 限额耗尽。它不替代原失败，也不证明崩溃根因。

总报告 final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/final-gates.json；逐项完整原输出 final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/targeted-smoke-report.json；对照 final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/full-turn-151a-control/control.json。输入 hash：03a868ded9be94a8f58769118b7e42132cac38d53b48bc6b0a823dacf6672cb6。证据校验报 smoke-evidence-runner-failed，是两项真实超时的传播，没有证据解析误报。

## 当前已通过的直接范围

### M1／M2

实际职任与完整返任许可 **21 组**、事件 **6 组**、边界 **15 组**通过。M1 读取真实任职、有限代理及已送达许可；稳定复合身份和每个兼任分别核对。第 21 组为生产模块合成链，不冒充许可 UI 全链。

R2 仅在玩家已知并已提交的确定链中合并无新玩家选择的外层停点；真实到达、NPC 回答、结束与返程仍按原 eventDays／advanceWithin 逐事件执行。玩家 target／双控、待选、未送达消息、预算重试和不确定路线保留原边界。长／分段完整消息、讨论、物理返程与效果回执相同；旧 151a 对新增边界测试为 10 PASS／5 FAIL，范围及摘录限制见 r2-player-boundaries.json。合成 60 人／30 场／30 日不代表官方三十日完整玩法验收。

### 复核快照与经济观察

152 定向门禁中 review **45／45**、observer **49／49**、settings **31／31**通过。923 的观察器后续独立回归为 **90／90**，证据身份如上。复核按根同步冻结完整 JSON 事实，首次读取该根才解析；不延迟读取 live，不删字段。旧 151a 对同 45 项为 43 PASS／2 FAIL，证明旧实现会立即解析未读大根；原语义与负向对照完整输出见 review-lazy-basis-2026-10-22T16-36-49-282Z/candidate-final.json、review-lazy-basis-2026-10-22T16-36-49-282Z/old-151a-final-tests.json。这是峰值优化，未证明 renderer crash 根因。

经济观察以真实完成 turn 票据逐项匹配 systems／省经济的 turn、load、campaign、timeline 和实际天数，拒绝两组同时漏记、重复、失败或跨档。原 Promise／UI／1800 秒整套、1830 秒外层及 CI 45 分钟保持。

### main 与另外两部官方兼容

main 的 authoring、地图／区划及 stable-ID 迁移已纳入；web/tm-save-stable-id-migration.js 现在是合法主干源码。当前 hot **1397＝802 在场＋595 缺席资产**，startup **480**。151a 的 25 个 main 文件逐字核对仍保留在 final-gates/2026-10-22T15-58-55-222Z-bf4022e2-961c-442f-9f03-a72783c0303e/new-main-input-confirmation.json；152 只追加两处 runtime 与对应测试、生成清单。

本轮天启 217 人／22 势力／307 区域、163 人精确定位，16.222 秒；晚唐 142／42／575、53 人精确定位，51.145 秒，模型尝试各 0。final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/other-officials/official-compatibility.json 只证明生产加载、地点／职任、活动入口和保存结构恢复，不证明正式 UI／IndexedDB／完整三十日玩法。

## 仍需完成

1. 旧152超时、首次f435检查器错误及修正后完整通过均保留独立证据；运行时再修改后，相关最终门禁必须重跑。
2. 923本机已完成真实链；8a最终可见结果仅在有采样GC的诊断中通过。必须在最终普通未采样运行中重新证明并核查OOM风险。
3. 923远端guards全量数字已核准，组合job则明确失败；修复后的候选必须独立重验，不以guards或本机成功代替。
4. 923本机与远端各自终结汇总已生成。planning.logicalRequests仍只作调度数；活动JSON长度不是实际存档字节数。最后可见结果和最终冻结门禁仍须对应后继候选。

范围与未验项见 LEGACY.md；正常界面操作见 PLAY.md；复跑命令与输出位置见 TESTS.md。无付费模型、移动真机、Claude 新 UI 或另外两部剧本全链验收。

## 历史证据：不得继承为当前通过

旧 e32 本机整轮为 1181 全执行、1177 PASS／2 timeout／2 既有 WAIVED，exit 1；旧 7c 远端 guards 为 1179 PASS／0 FAIL／2 WAIVED，但组合失败。旧 ebf 的 54 项通过属于 run5f40a3b6；55 项从未运行。这些不计入当前 56 项或当前完整 CI。

旧整轮身份保留于 runtime-tested.json、full-smoke-run.json、full-smoke-report.json；释放修复证据见 committed-capture-release-gate.json。settings 的旧实现对照为 27 PASS／4 FAIL，工具摘录及限制见 review-progress-collapse.json；observer 证据见 composite-producer-waits.json。

### 已保留的失败与中断

1. 2455fa03：第一次真实槽位加载通过，继续回合时 renderer crash。不是完整通过。
2. adeb3d79：明确 V8 OOM，dump 为 0xe0000008 / CALL_AND_RETRY_LAST。
3. b282 的 7c947ba3：有界恢复指纹已越过原崩点，但第二回合收官后再次 OOM。实际到第 31.7 日抵达边界；第 37 日仅是约定开场日，现场尚未进行。
4. 109b24f6 的本地 7f963b07：`interrupted_without_final_report`。没有最终报告或 renderer crash 结果，原因不推断；见 `web/dev-tools/electron-bridge/7f963b07-9b62-44a5-98e2-4a95b7147fd8/INTERRUPTED.json`。该轮已中断，不能继续写成“正在复验”，也不能记为 PASS 或 OOM。
5. 109b24f6 的远端 run39784161656：真实历史选择弹窗遮挡 `#zhao-btn-3`，组合门禁失败于按钮不可点击；guards 成功不改变组合失败。见 `remote-109-composite.log`。这轮是测试未处理选择遮罩，不归因于环境或 OOM。

6. 477ecfac 的本地 964f3503：完整报告 exit 1，失败为 `#zhao-btn-3` 不可点击。已通过在途 slot 1 真实加载，但历史弹窗底部“取消”位于可视区外，测试未关闭遮罩；这是正式按钮阻挡，不是 OOM。
7. 477ecfac 的远端 run39786955659 / job119852596289：slot 1 实际加载后的下一次顶层回合提交完毕，在重新打开书信前 renderer crash，exitCode -36861。无 crash dump，本轮不写成已证实 OOM；实际 CI checkout 为 fe4ea74a06f51f8eaa52990983b23932bb4d12c8。guards 和其他 CI jobs 成功，组合失败使整轮仍失败。

本地失败原始报告与分类见 `browser-477-formal-block/report.json`、`browser-477-formal-block/classification.json`、`browser-477-formal-block/blocked-control.json`；当时截图为 `web/dev-tools/electron-bridge/964f3503-873f-4003-aa87-be2f10c2c4bf/blocked-control.png`。远端证据见 `remote-477-composite.log` 与 `web/dev-tools/ci-39786955659-composite/104a6716-12e2-43a9-a0ae-4eef5f1cf5e0/report.json`。

8. ebf58473 的远端 run39790789251 / job119866048808：生产回合复核浮层盖住 `#endturn .et-big`，最终报告 exit 1。已越过上一轮实际加载后的崩点；本轮没有 renderer crash，不能与 477 的 crash 合并归因。报告为 `web/dev-tools/ci-39790789251-composite/e4d28492-04f7-41d6-ad89-9ab2010fa5d4/report.json`，截图为 `web/dev-tools/ci-39790789251-composite/e4d28492-04f7-41d6-ad89-9ab2010fa5d4/blocked-control.png`；实际 CI checkout 为 89ce0069761c1ed5edd537c394fe3bff8227cfbd。
9. ebf58473 的本地 d16f26ca：为在源文件修改前结束自有运行，主动停止并写入 `web/dev-tools/electron-bridge/d16f26ca-6243-4559-b133-deb545796545/INTERRUPTED.json`。这不是完整验收，也不是本地生产通过／失败或 crash 结论。

10. 60d9c8f1 的远端 run39800379096 / job119899046206：500 次轮询耗尽时仍为 turn 4／day 37／busy=true，AutoSave 尚在收尾；组合报告 exit 1，非 renderer crash。其他全部 CI jobs（含 relief 与 guards）成功，组合失败使整轮仍失败。报告 `web/dev-tools/ci-39800379096-composite/388f196d-e5d7-43cb-97bf-ae6da4efd6f3/report.json`，日志 `remote-60d9-composite.log`；实际 CI checkout 为 da3ed7d972fda9659207c739fbadf741fa3dad8e。
11. 60d9c8f1 的本地 cb9c1636：已通过真实现场按钮提出问题；第 37 日／turn 4／513 人，discussion=awaiting_target，actorContent 非空、targetContent 为空。slot 2 保存按钮触发后的固定 90 秒显示等待超时，压缩日志在失败前刚完成；最终报告 exit 1。只有 slot 1 实际加载，尚无第二次加载、NPC 现场回答或双方返程；不记为 PASS。原始报告 `web/dev-tools/electron-bridge/cb9c1636-1455-40cc-b899-a36672a730fb/report.json`，状态 `web/dev-tools/electron-bridge/cb9c1636-1455-40cc-b899-a36672a730fb/composite-timeline.json`，压缩记录 `web/dev-tools/electron-bridge/cb9c1636-1455-40cc-b899-a36672a730fb/renderer.log`。

12. f732f205 的本地 4e25945c：发现 main PR #109 已合入后，在修改合并源文件前主动中断；原运行未完成，不作生产通过／失败结论。f732 的远端没有 CI 运行，原因是新 main 带来的生成物冲突与 GitHub 旧 base 缓存，不记录为测试失败。

此前排除 stable-ID 模块仅发生在它尚未提交到主干时；PR #109 将其纳入 main 后已随 151a 合并。f732 因新 main 冲突没有 CI，本地 4e25945c 主动中断；两者都不是生产测试失败，151a 随后已另起本机与远端验收，终结结果见下。


13. 151a 的远端 run39809834192／job119932780629：slot 1、slot 2 的实际加载均完成，代次 0→1→2；现场问题已存在。随后顶层回合期间 renderer crash，exitCode -36861，未完成 NPC 回答及返程最终断言，无 dump 不能断言 OOM。实际 checkout 为 6f67f461ed46021aa7517ba08aed2f78c88c31d9。证据 remote-151a-composite.log 与 web/dev-tools/ci-39809834192-composite/11c0fcd5-0b86-4c91-895c-7f40247961e5/report.json。

14. 151a 的本地 52a5afea：原 1800 秒整套期限在第二次正式保存期间耗尽，报告 exit 1／1801484ms；完成 slot 1 代次 0→1 和第 37 日现场提问，未完成第二次加载、NPC 答复或返程；不是 renderer crash。证据 web/dev-tools/electron-bridge/52a5afea-754b-4f25-8651-e0b6ce4eb4a8/report.json。

151a 本机 56 项通过仅属于 bf4022e2-961c-442f-9f03-a72783c0303e（489.766 秒），不继承为 152 的通过；完整证据 final-gates/2026-10-22T15-58-55-222Z-bf4022e2-961c-442f-9f03-a72783c0303e/final-gates.json。ff727a22 的诊断 CI 与经济对账属于独立身份，不代替 152 正式复验。
