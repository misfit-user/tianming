# f435 验证范围与复跑入口

最近已测候选f4359559260a76417e75a5de76c094fc2248ed4c，包含152功能与main b0c80e5ae005912effbc947af027d021505c1dbd。该提交本机最终59项及全部附加门禁通过；923正式成功／OOM失败及8a采样诊断继续保留独立身份。8a的CDP采样会影响GC，不能据其PASS认定普通验收或OOM修复。

## 8a独立诊断（不等于游戏验收）

新增smoke-npc-composite-diagnostics.js为11／11；实际锁定Electron的CDP空窗探针只验证采样协议和栈归属。两者不证明游戏完整通过、不归因或修复OOM。原始探针report／profile及8a诊断smoke完整输出、hash见allocation-probe-20261023/SUMMARY.json；空窗探针发生在8a提交前，原报告没有Git SHA，未倒填为提交后验收。组合120263871955已完成，但仅归为采样诊断；其实际checkout为15b58bd11e49c2e061ccfeb3813b0479232d118f。

## 923夹具的独立结果

| 命令／环境 | 实际结果 | 证据 |
| --- | --- | --- |
| node web/scripts/smoke-npc-composite-waits.js | 90 PASS／0 FAIL；修复前新增严格 transport 分支为 89／1 | composite-final-background.json → strictTransportRevision |
| 锁定 Electron33.4.11 Node20.18.3，以 child-only ELECTRON_RUN_AS_NODE=1 执行原 run-smokes.js，仅选择 startup | 1 PASS／0 FAIL／0 TIMEOUT，103.280 秒，12／12 case；120 秒原期限、零重试 | startup-electron-node20-20261023/{run-start,run-end,startup-report,SUMMARY}.json |
| 两夹具 AST／syntax／diff-check | 原26／77条断言全保留，各增6条；原期限不变 | fixture-freeze-audit-20261023.json |

Node20 单项运行时 HEAD=152，夹具 hash 与923相同；没有改锁文件或安装依赖。它是 headless VM 验证，Audio／IndexedDB 仍为明确夹具边界；不等于浏览器保存恢复，也不抹掉 Node24 原失败。Oct22同环境尝试的缺失终结记录另标 interrupted，不能记成通过。

## 923 远端完整 smoke（已完成）

远端 guards 已在实际 checkout **0ad31616537aa80bd732391cbac0b618fd001b59** 通过，文件树与923相同（836d8be0bd29a5ad298ff4ea8858348d37380c65）。Ubuntu／Linux x64、Node v22.23.3，run39904863206／job120254352752；1185 项实际执行：**1183 PASS、0 FAIL、2 既有 WAIVED**，flaky／suspect／SKIP均0。豁免仅为旧的可选音频／字体资源，未新增。full-turn55.560秒、startup57.764秒及observer90／90均在该轮通过。原报告与精确环境见 remote-923-guards/SUMMARY.json、arch-guard/ci-aG8zzm/smoke-report.json；原日志 remote-923-guards.log。此结论限 guards，不等于组合 Electron、全部 CI jobs 或本机最终门禁通过。

## f435最终本机59项（已完整通过）

f435本机已完成整轮：run641d560d-e44c-4955-ac92-0e1559bd43ab，**59／59通过、两官方兼容通过、六项静态门禁通过**，总327.221秒。锁定Electron33.4.11以Node20.18.3子进程运行，原120秒、单并发、零重试；失败／超时／豁免／flaky／suspect／skip均0。full-turn57.258秒，startup53.455秒，官方组合smoke51.218秒；天启兼容7.636秒、晚唐24.268秒，均模型尝试0。2395输入运行前后hash相同：3fd173af0f52ab806c2aead280f38d7fb417e410451c2b82e4a144c7dade7971。完整证据为final-gates/2026-10-23T06-11-20-025Z-641d560d-e44c-4955-ac92-0e1559bd43ab/SUMMARY.json与同目录原报告。

实际命令：锁定Electron可执行文件以child-only ELECTRON_RUN_AS_NODE=1运行docs/npc-stable-candidate-20261021/run-final-gates.cjs --run --expected-head f4359559260a76417e75a5de76c094fc2248ed4c --temp-root D:\tianming-npc-candidate-temp。运行环境与完整命令在final59-corrected-launch-2026-10-23T06-11-19-468Z/。

首次run68aae9ea因docs检查器误读旧.source字段而失败；源码与原断言未改，检查器39条保留＋2条真实缓存／文件身份核查，修正后完整重跑，不拼接不同run。两官方结果仍仅为headless生产加载和save-builder／restore-fields，不是两剧本正式UI全链。

## 8a采样CI（仅诊断）

8a远端组合CI39907873427／job120263871955已终结，实际checkout15b58bd11e49c2e061ccfeb3813b0479232d118f、run c758790a-f00f-4416-bcb7-25e8ac538975，1134.616秒，原业务断言通过。收尾后通过正常按钮重新打开的结果卡在04-completed-return.png中实际可见，包含双方已收到、讨论内容和已返回原处。但该运行开启CDP堆分配采样，必须标为`diagnostic_pass`、`formalAcceptancePassed=false`，不能作为普通未采样验收或OOM已经修复的证据。

先前“没有显式GC命令，所以不会GC”的表述不准确：与实测V8基准版本13.0.245.25对应的源码表明，CDP `startSampling`设置`kSamplingForceGC`，读取`GetAllocationProfile`会进入`CollectAllGarbage`路径。诊断可能改变回收时机；未显式调用`HeapProfiler.collectGarbage`不等于未触发GC。核对范围是匹配的上游V8基准tag，未声称审计所有Electron补丁。原日志不倒改，修正说明和原始blob／hash见[upstream-v8-gc.json](allocation-probe-20261023/upstream-v8-gc.json)，来源为[V8 inspector](https://github.com/v8/v8/blob/13.0.245.25/src/inspector/v8-heap-profiler-agent-impl.cc)与[V8 sampling profiler](https://github.com/v8/v8/blob/13.0.245.25/src/profiler/sampling-heap-profiler.cc)。

## 旧 152 实际执行（保留失败）

node docs/npc-stable-candidate-20261021/run-final-gates.cjs --run --expected-head 1524724fc45ccd1e04ae61717db9f789f267ca9b --temp-root E:\tianming-npc-candidate-temp

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

run ad379252-a0c9-473d-a003-bdda4a7bdae1，总 648.745 秒；2,390 输入文件 hash 前后相同：03a868ded9be94a8f58769118b7e42132cac38d53b48bc6b0a823dacf6672cb6。没有重试、豁免或增加原期限。

- 总报告与命令／日志 hash：final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/final-gates.json。
- 全部 56 项原输出：final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/targeted-smoke-report.json。
- 两官方：final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/other-officials/official-compatibility.json。
- 唯一 full-turn 旧源码注入对照：final-gates/2026-10-22T16-48-54-117Z-ad379252-a0c9-473d-a003-bdda4a7bdae1/full-turn-151a-control/control.json 及同目录 stdout.log、stderr.log、injection-hits.jsonl。

full-turn-flow 在 120.415 秒超时且原输出为空；start-game-data-integrity 在 120.494 秒超时，最后输出 deepread-config-is-immutable PASS。旧两 runtime 对照已命中，13.719 秒在 doActualStart 的原 10000ms VM 限额失败。对照不替代原失败，不支持直接归因。

## 旧 152 门禁中通过的直接回归

| 原入口 | 本轮结果 |
| --- | --- |
| web/scripts/smoke-npc-meeting-office.js | 21 组 |
| web/scripts/smoke-npc-meeting-events.js | 6 组 |
| web/scripts/smoke-npc-meeting-events-boundaries.js | 15 组 |
| web/scripts/smoke-emergency-recovery-review.js | 45／45 |
| web/scripts/smoke-npc-composite-waits.js | 49／49 |
| web/scripts/smoke-recovery-settings-restore.js | 31／31 |
| web/scripts/smoke-runtime-save-consistency.js | 84／0 |
| web/scripts/smoke-save-integrity-audit.js | 26 项 |

NPC、office-duty／tenure、公库及保存的其余结果均在同一原始定向报告；公库未新增功能。R2 负向对照见 r2-player-boundaries.json；review 原始 37 项、最终 45 项及旧实现 43 PASS／2 FAIL 的完整原日志见 review-lazy-basis-2026-10-22T16-36-49-282Z/。旧 151a 的 56 PASS 和 ebf 的 54 PASS 保留各自身份；55 项从未独立执行。

天启／晚唐本轮分别 16.222／51.145 秒、模型尝试 0；原每例 150 秒。兼容范围限 headless 加载／地点／职任／活动／save-builder／restore-fields，不是正式菜单读档或三剧本全链。工具 check-other-officials.cjs 的 --output-dir 防止覆盖旧证据。

## 923 正式组合：分别归档

923 本机正式组合 run **67c9b63c-d08f-4183-b3aa-5e97109fc8de** 的原断言完整通过，exit0／1204.076秒。保留绍宋513人、39势力与正式地图；从真实协助材料来源、玩家按钮邀请／启程／提问到NPC独立接受和回答，使用顶层endTurn推进 **0→30→37→60日**。在第30日在途和第37日现场待答时，实际菜单保存／加载槽1与槽2，世界代次 **0→1→2**；第37.5日NPC实际回答，双方最终返回原出发地ssr-0048。仅一条discuss与一条discuss_response，成果有稳定resultId和个人经历／记忆引用。3个真实顶层区间分别为30／7／23日，省经济恰好执行3次且原字段发生变化。最终后台复核与保存自然收尾，canonical revision17与desktop saved revision17一致，当前day60／turn4／load2。

同文件树的远端组合 run **93affced-3b75-48a7-8281-34f59de88f59**（CI39904863206／job120254352816，checkout0ad31616537aa80bd732391cbac0b618fd001b59）在569.316秒失败。两次实际加载和现场问题均已完成；随后Chromium明确报告 **reason=oom、exitCode=-536870904**，没有最终NPC回答／物理返回／持久化终结证据。因此远端组合CI仍阻断，不把本机成功与远端guards成功拼成全绿。

只读汇总命令已实际执行：

- node docs/npc-stable-candidate-20261021/summarize-final-composite.cjs --run-dir web/dev-tools/electron-bridge/67c9b63c-d08f-4183-b3aa-5e97109fc8de --expected-head 9232aa314d9db1b6fd346e3b241f4afcf1676ec4 --output browser-923-local-pass/summary.json → exit0。
- 同入口 --run-dir web/dev-tools/ci-39904863206-composite/93affced-3b75-48a7-8281-34f59de88f59 --expected-head 0ad31616537aa80bd732391cbac0b618fd001b59 --output browser-923-remote-oom/summary.json → exit1，准确传播失败。

本机最后的04-completed-return.png实际显示主地图；虽然原DOM与业务断言通过，仍需在后台收尾后用正常按钮重新打开结果，并补可见结果的强断言及截图。183,387,794字节是本次最终磁盘autosave的实测大小，不是从零增长或存档增量。采样最大JS used heap为3,372,812,355字节，最大renderer private为5,679,180KiB；它们是采样观测，不是连续测量峰值或远端OOM根因。原报告与所有输入hash见两目录ARCHIVE.json；无重跑业务或改写原测试输入。

## 正式组合入口与门禁边界

原入口：node scripts/verify-electron-bridge.js --npc-composite。

923已有上述本机成功和远端OOM两份独立证据；后继候选不得继承为全部通过。原1800秒整套、1830秒外层、CI45分钟不变；UI producer保留原Promise和回执。M3还需普通未采样新候选的结果可见性证明；f435本机门禁已通过，但M4仍需最终未采样组合CI，运行时改动后相关门禁须重跑。

旧152本机发现1185个 smoke，但仅执行选定56项；当前923远端完整执行1185项，结果见本文件“923远端完整smoke”。两者环境、版本和范围分列，不拼接成一次本机全绿。其他CI任务与即时run由CURRENT.json维护；历史失败分类见REPORT.md。

## 终结后的只读汇总

summarize-final-composite.cjs只读同一轮完整report／timeline，未终结拒绝输出，失败仍为failed。923本机已生成passed汇总，远端另存failed汇总；两者不合并为一个成功结果。

汇总中的请求 ID、sourceKey 唯一数分别统计，planning.logicalRequests 只作调度计数；仅统计已记录快照，缺失保持未知。activityBytes 是 JSON 字符长度，不能称为真实存档字节数。

剩余：后继运行时修复对应的冻结回归、普通未采样组合正式流程与required CI全绿。旧两项超时原因仍未确证；新 Node20 单项通过是独立环境证据。其他边界见 LEGACY.md。
