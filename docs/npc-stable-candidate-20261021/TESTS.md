# 574候选：测试与证据

功能提交：`574fcf05447d6daf0e6a99f64ea4a70b119a496e`。正常、未采样组合已在远端和本机分别完整通过，修正隔离夹具后的本机整轮门禁亦通过。最终交付提交的新远端required checks仍待收口，文档冻结时PR仍open。最终交付提交会另含测试修正和报告，不倒改本次功能测试身份。

## 正式组合：当前远端通过

[CI39919665284／job120301568125](https://github.com/misfit-user/tianming/actions/runs/39919665284/job/120301568125)，run `fad96787-97f8-4f56-8c89-910434b72ef4`。实际checkout为`481eea15eecc348e11b4cad28fd655208df21a83`，与574文件树同为`e0aa6115fed7238a1adc72e64badcb4995f9f363`。

```text
node scripts/verify-electron-bridge.js --npc-composite
```

环境为Windows、Electron33.4.11／Node20.18.3／V8 13.0.245.25。`ELECTRON_RUN_AS_NODE`关闭，`TM_BRIDGE_HEAP_SAMPLING=0`、`TM_BRIDGE_CPU_PROFILE=0`，没有CDP分配采样或强制收集；仅记录进程及精确堆读数。原整套1800秒、外层1830秒、CI45分钟保持。**退出0，657.452秒，`formalAcceptancePassed=true`。**

| 检查 | 同一次成功运行中的证据 |
| --- | --- |
| 正常人物群体 | 绍宋513人、39势力及地图保留；没有清空人物、全体搬家或预填完整目标 |
| 正式玩家操作 | 按钮形成协助来源、确认材料、提出约见、启程、现场提问、读取结果；NPC独立接受与回答 |
| 时间和正常领域 | 顶层0→30→37→60日，3次过回合对应3次省经济结算 |
| 两次真实恢复 | 途中day30、现场待答day37，正式菜单保存加载，代次0→1→2，控制者、行程、问题保持 |
| 现场内容与返程 | NPC于day37.5独立回答，双方实际回到`ssr-0048`；同一结果不重复结算 |
| 最终可见性 | day60正常重开结果卡，正文可见、命中检测通过；不是隐藏DOM的textContent断言 |
| 最终持久化 | review verified，canonical与desktop均revision15，相关producer已真实完成 |

[汇总](browser-574-remote-pass/summary.json)、[时间线](browser-574-remote-pass/composite-timeline.json)、[原始报告](browser-574-remote-pass/report.json)、[结果截图](browser-574-remote-pass/04-completed-return.png)、[逐文件hash归档](browser-574-remote-pass/ARCHIVE.json)均属本次run。原始文件15份已回读验证。性能与活动统计另见 [METRICS.json](browser-574-remote-pass/METRICS.json)。

该远行场景事前将现有应天地点声明为公开地点；这是明确测试配置，不等于官方默认开局一定列出这个异地选项。已配置职任的全部正反分支由下面生产模块测试承担，本正式链不代替全部官员外出UI验收。

### 模型与连续运行边界

本地普通组合机制模型尝试0。真实传输入口共90次，外部响应均由确定性替身提供：其他直接生产者33、已标记世界子调用45、常规复核6、NPC方向规划6。真实外部网络请求0，fixture错误0；未识别的直接生产者保持单独分组。没有替换整个endTurn，也没有将权限、日期、旅行、省经济与保存设为空操作。

观察到15项活动：13通问、1协助、1会面；最终8项done、7项cancelled、pending为0。done是活动终态，不能一律解读为目标成功。规划记录495个独立请求，最终2个no_change、493个expired；调度计数logicalRequests=3不等于独立请求数，modelAttempts=5也不等于传输入口记录的6次方向请求。原统计分别保留，不为使数字一致改定义。

两处`activityBytes`实为JSON的UTF-16长度114066与128185，不是磁盘字节。堆读数最大3,063,140,828字节、末尾1,384,335,472字节，仅是观察时点，不是连续峰值或泄漏证明。大型存档仍有显著内存和等待成本；该通过不代表全游戏离线、所有平台稳定或所有人物公平规划。

## 本机正常组合：独立完整通过

run `ac0bfde1-8538-46be-b2cb-f3b17f95cc4a`，同一正式命令，Windows／Electron33.4.11／Node20.18.3。准确身份为HEAD574＋唯一`smoke-turn-capture-work-count.js`测试夹具补丁（hash `489a946ea40e64054185e01258cb428c5ec1930f90892910e3a4e9e76361a733`），运行时代码与574相同。

退出0，`formalAcceptancePassed=true`，耗时 **1724.354秒（28分44秒）**，外层进程区间08:08:26.882→08:37:11.236 UTC。没有分配采样、强制GC、加堆或提高时限。原1800／1830秒限制保持；该明显等待成本是性能限制，不能用远端较短耗时掩盖。

同一次本机run完成513人、60日、顶层0→30→37→60、3次省经济；day30途中和day37现场待答两次菜单保存加载，代次0→1→2。NPC在day37.5回答，双方实际返`ssr-0048`，最终结果正文可见，review verified且canonical／desktop均revision15。

本机实际传输97次：41其他直接生产者、45已标记世界子调用、6常规复核、5NPC方向规划；普通组合机制0、真实外部网络0、fixture错误0。它不同于远端90次，不能混计。本机两槽`activityBytes`对应UTF-16长度114066、128159，不是磁盘字节。

[本机summary](browser-574-local-pass/summary.json)、[原始归档及hash](browser-574-local-pass/ARCHIVE.json)、[本机性能记录](browser-574-local-pass/METRICS.json)与[可见结果](browser-574-local-pass/04-completed-return.png)保留独立身份。初始启动记录仍在 [browser-574-local-launch](browser-574-local-launch/start.json)。

本机归档14份原文件已回读hash验证。renderer堆最大观察值2,739,549,728字节、末尾1,382,323,210字节，不当作连续峰值或泄漏证明。同一desktop自动存档的两次真实stat为181,390,295→183,259,378字节，增加1,869,083字节；前者在第二次加载完成且第三回合尚未提交时，后者在最终day60保存后。它是整个世界的磁盘文件增长，不是NPC独占增量；原时点和mtime在METRICS中，完整存档内容未归档。

## 本机最终门禁：修正后同轮通过，原失败保留

首次574运行：[186eb79d](final-gates/2026-10-23T07-44-07-460Z-186eb79d-3676-415a-8347-e47a1fef1f25/SUMMARY.json)。Windows x64、锁定Electron的Node20.18.3、每例原120秒、单并发、零重试。

- 67项中66通过、1失败；超时、豁免、flaky、suspect均0。
- 唯一失败：`smoke-turn-capture-work-count.js`的隔离源码提取没有加载新增`_endTurn_startPostTurnMemorySave`，发生ReferenceError。它是测试依赖遗漏，不是环境故障；已补真实helper，未削弱断言。
- 两官方兼容与六静态门禁通过。整轮600.866秒；2,395个输入前后相同，hash为`b6c4a61b1d11dafcaaa974c5a3a7543d45e58e3327a35d5c293302698bbbf93a`。
- 修正后另一整轮 [5a8bdda1](final-gates/2026-10-23T07-57-29-186Z-5a8bdda1-7a3f-4c36-9f31-ca1d757c2815/SUMMARY.json) 已完成：67／67、两官方兼容、六静态全部通过，599.178秒；失败／超时／豁免／重试异常均0。不能把后轮结果改写到原66／67报告中。
- 这次准确身份为574＋唯一`smoke-turn-capture-work-count.js`测试补丁（SHA-256 `489a946ea40e64054185e01258cb428c5ec1930f90892910e3a4e9e76361a733`）；2,395个输入前后hash一致：`bbce0d44c14a150e8c3893867469f0cc0cd501887ccdfdcf11eca21988b7819d`。
- 原远端[guards全量报告](remote-574-guards/SUMMARY.json)为1185通过／1失败／2既有豁免，失败也是该夹具遗漏helper；修正后新的required CI尚待运行，不能用本机复跑替代。本机普通组合已按上述独立run完整通过，不再处于运行中。

原命令、输出、环境和输入身份见 [final-gates.json](final-gates/2026-10-23T07-44-07-460Z-186eb79d-3676-415a-8347-e47a1fef1f25/final-gates.json) 与 [targeted-smoke-report.json](final-gates/2026-10-23T07-44-07-460Z-186eb79d-3676-415a-8347-e47a1fef1f25/targeted-smoke-report.json)。该选定集合不是本机全量smoke。

## 直接相关的生产模块检查

| 入口 | 证明范围 |
| --- | --- |
| `smoke-npc-meeting-office.js` | 21组，无官／驻任／兼任／许可及身份正反路径；第21组是合成生产链 |
| `smoke-npc-meeting-events.js` | 6组，共同在场、现场结果与去留 |
| `smoke-npc-meeting-events-boundaries.js` | 15组，长区间、分段与玩家选择边界 |
| `smoke-emergency-recovery-review.js` | 79／79，原62项保留；同一producer、pending保存屏障、失效与失败持久化 |
| `smoke-save-commit-boundary.js` | 36／36，原28项保留；主提交不等待记忆，恢复依据不提前释放 |
| `smoke-runtime-save-consistency.js` | 84／84，正式保存真源及边界 |
| `smoke-npc-composite-waits.js` | 90／90，真实producer、经济对账及最终持久化观察 |
| `smoke-npc-composite-diagnostics.js` | 11／11，仅诊断协议和失败顺序，不作正式玩法证据 |
| `smoke-npc-composite-official.js` | 官方人口／地图生产模块链，不冒充页面操作与顶层时间 |

上述入口在574首次67项中均通过；修正夹具后的完整67项复跑亦通过。规划、私人活动、旅行、政治、公库、职任与保存相关回归亦保留；公库没有新增功能。

574真实源码反证：旧d31在SC25c未解时开始第二次模型请求，`2 != 1`失败；当前等待原producer后继续。原始输出与实际队列双槽读回见 [memory-producer-barrier](memory-producer-barrier-20261023/README.md)。闭包可达性诊断与未确认提交恢复保护见 [save-closure-diagnostic-d31](save-closure-diagnostic-d31/README.md)；其显式GC仅作诊断，不混入正常通过。

## 当前桌面IPC与重启

[remote-574-core/SUMMARY.json](remote-574-core/SUMMARY.json)对应同一CI的job120301568159，实际checkout及tree与上面相同。production、test-exports、restart及startup-autosave均通过，覆盖真实IPC非法JSON拒绝、不改盘、不换session、进程重启后的保存回执和启动恢复。它与组合门禁各有自己的报告；core通过也不等于整个CI绿色。

## 其他官方剧本

574首次同轮的[天启／晚唐兼容记录](final-gates/2026-10-23T07-44-07-460Z-186eb79d-3676-415a-8347-e47a1fef1f25/other-officials/official-compatibility.json)通过。范围限headless生产加载、地点／职任、通问入口、save-builder和restore-fields，未验正式菜单加载、完整往返或30日世界。兼容夹具的`--expose-gc`不能替代正式未采样浏览器。

正式启动manifest为492条scripts，兼容夹具实际编译身份集合为480个文件，两者不是同一计数。范围详见 [OFFICIAL-COMPATIBILITY.md](OFFICIAL-COMPATIBILITY.md)。

## 历史结果不继承

- d31的[本机67项通过](final-gates/2026-10-23T06-57-56-916Z-897c28fa-8d7e-4b70-a76f-4562a7444d66/SUMMARY.json)、[原始final-gates](final-gates/2026-10-23T06-57-56-916Z-897c28fa-8d7e-4b70-a76f-4562a7444d66/final-gates.json)、[逐例报告](final-gates/2026-10-23T06-57-56-916Z-897c28fa-8d7e-4b70-a76f-4562a7444d66/targeted-smoke-report.json)及[两官方旧记录](final-gates/2026-10-23T06-57-56-916Z-897c28fa-8d7e-4b70-a76f-4562a7444d66/other-officials/official-compatibility.json)保留该版本身份；[d31 core](remote-d31-core/SUMMARY.json)不补偿其[正常远端OOM](browser-d31-remote-oom/summary.json)。本机831秒[主动中断](browser-d31-local-launch/INTERRUPTED.json)不算通过或本机OOM。
- 681的[正常远端OOM](browser-681-remote-oom/summary.json)、[本机中断](browser-681-local-launch/INTERRUPTED.json)、[59项旧门禁](final-gates/2026-10-23T06-29-30-533Z-76dc02f0-f0d4-460e-a69d-19f2256b0b07/SUMMARY.json)及[62项屏障修复对照](review-save-barrier-20261023/README.md)分别保留。
- 8a[采样运行](browser-8a-diagnostic/summary.json)为diagnostic_pass，`formalAcceptancePassed=false`。匹配V8上游证明CDP采样包含`kSamplingForceGC`，[上游核对](allocation-probe-20261023/upstream-v8-gc.json)保留；没有显式collectGarbage不代表无强制GC。
- 923本机原链成功但最终截图不是可见结果卡，远端同树OOM；旧152、f435等记录见 [HISTORY-TESTS.md](HISTORY-TESTS.md)、[HISTORY-REPORT.md](HISTORY-REPORT.md)。

本机和远端两份574正常完整报告分别支持当前声明范围的M3通过；60日持续运行及本机门禁亦通过。M4的最终交付提交仍须新的远端全部required checks。文档冻结时PR仍open，最终状态以PR和交付记录为准；移动真机、Claude新UI与真实付费模型未验。
