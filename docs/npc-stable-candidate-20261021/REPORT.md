# NPC 本地人物模拟首版候选

## 当前结论与身份

**功能提交 `574fcf05447d6daf0e6a99f64ea4a70b119a496e` 的正常、未采样组合试玩已分别在远端和本机完整通过。** 两次独立运行均完成60个模拟日、两次正式菜单保存加载、独立NPC回答、双方实际返程、可见结果与最终持久化。修正隔离夹具后的本机回归亦已通过；最终交付提交的新远端required checks尚待，不能写成整个CI绿色或已合并。

| 身份 | 当前值 |
| --- | --- |
| 功能提交 | `574fcf05447d6daf0e6a99f64ea4a70b119a496e` |
| 分支／PR | `codex/npc-composite-r123-20261011`／[PR #105](https://github.com/misfit-user/tianming/pull/105)，文档冻结时仍open；最终合并状态查PR记录 |
| 已纳入主线 | `b0c80e5ae005912effbc947af027d021505c1dbd`，含PR #109、#110及近期其他开发成果 |
| 正式前端 | main的日常往来界面；未合入Claude新UI分支 |
| 正式测试身份 | checkout `481eea15eecc348e11b4cad28fd655208df21a83`，与574文件树同为 `e0aa6115fed7238a1adc72e64badcb4995f9f363` |
| 远端组合 | [CI39919665284／job120301568125](https://github.com/misfit-user/tianming/actions/runs/39919665284/job/120301568125)，run `fad96787-97f8-4f56-8c89-910434b72ef4`，退出0，657.452秒 |
| 本机组合 | 574＋唯一test-only夹具补丁，run `ac0bfde1-8538-46be-b2cb-f3b17f95cc4a`，退出0，1724.354秒（28分44秒） |
| 其他门禁 | 当前远端core已通过；guards全量1185通过／1失败／2既有豁免，失败为同一夹具依赖遗漏；修正后新的远端门禁尚待。本机574＋唯一test-only夹具补丁的67／67、两官方兼容及六静态同轮通过；原574的66／67失败保留 |
| 交付／发布 | 最终交付SHA将包含后续夹具修正与报告，另行记录；未改版本、未部署、未打包 |

[正式汇总](browser-574-remote-pass/summary.json)与[原始归档及hash](browser-574-remote-pass/ARCHIVE.json)记录实际运行身份。即时状态见 [CURRENT.json](CURRENT.json)，测试清单见 [TESTS.md](TESTS.md)。功能提交、最终交付提交、远端测试checkout和部署身份分别保留。

## M1—M4

| 目标 | 当前结果与边界 |
| --- | --- |
| M1 职任与外出 | **生产模块及声明范围的本机／远端正式链通过。** 无官、驻任、兼任、许可及身份边界有正反测试；正式链使用官方岗位兼容配置；具体驻任许可链仍以合成生产模块证据为准，不扩大为完整许可UI或全部历史假制验收 |
| M2 现场时序 | **生产模块及声明范围的本机／远端正式链通过。** 现场问题、独立回答、玩家选择边界、实际返回与单次结果均有证据；分段一致性只限本活动事件 |
| M3 页面与恢复 | **本机及远端正式场景分别通过。** 两次非终态菜单加载、旧凭据失效及恢复后继续、最终可见结果均在各自完整run中通过 |
| M4 持续运行与交付 | **60日持续运行及本机最终门禁通过。** 最终交付提交的新远端required checks尚待；文档冻结时PR未合并，不提前标记完成发布 |

不将原日常Electron用例、隔离单测或采样诊断冒充本次组合成功。当前正常成功运行同时包含全部正式要求。

## 正式运行实际发生了什么

以下过程分别在本机和远端完整跑通，统计分别保留，不拼接为一次运行：

- 保留绍宋官方513人、39势力及地图。真实按钮完成材料协助来源、约见、出发、现场提问与结果查看；NPC独立接受并回答。
- 顶层过回合区间为 **0→30→37→60日**。省经济执行3次，对应3次顶层推进，没有因现场子步骤重复结算这个领域。
- 第30日在途中保存并从菜单加载，第37日已提出现场问题、尚未回答时再次保存加载；加载代次 **0→1→2**，人物、行程和问题连续。
- NPC在 **第37.5日** 独立回答；双方沿实际路线回到原出发点 `ssr-0048`。第60日通过正常页面重新打开结果卡，文本实际可见且命中检测通过。
- 实际回答为：“我理解，材料中的本人陈述和还没有交叉来源的段落，都只能先列为待确认。”它与本次阅读理解问题、参与记录和个人成果对应。
- 收尾复核为verified，canonical与desktop保存回执均为revision15。截图为辅助，主体证据是同一份活动、时间线、位置、消息及保存身份断言。

[机器时间线](browser-574-remote-pass/composite-timeline.json)、[最终可见结果](browser-574-remote-pass/04-completed-return.png)及[原始报告](browser-574-remote-pass/report.json)均在同一归档中。测试事前声明现有应天地点为公开地点；普通原始开局未必提供这个异地选项。试玩入口与该前提的区别见 [PLAY.md](PLAY.md)。

本机独立运行从08:08:26.882至08:37:11.236 UTC，耗时1724.354秒，使用574功能代码及唯一测试夹具补丁。见 [本机汇总](browser-574-local-pass/summary.json)、[原始归档](browser-574-local-pass/ARCHIVE.json)。它同样在day30途中和day37现场待答时实际加载，NPC在day37.5回答，day60实际返程并显示结果，最终review verified、canonical与desktop均revision15。**28分44秒的等待是明显性能限制，不能隐藏为“流畅试玩”。**

### 调用、持续运行与性能

本机、远端的本地普通组合活动模型尝试均为0。远端实际传输入口共90次，由确定性外部响应替身承接：33次其他直接生产者、45次已标记世界子调用、6次常规复核、6次NPC方向规划。本机实际传输入口为97次：其他直接生产者41、已标记世界子调用45、常规复核6、NPC方向规划5。两次真实外部网络请求均为0；这不表示全游戏离线，也不将未识别的直接生产者强行归类。

记录到495个独立规划请求，最终2个`no_change`、493个`expired`。这不是495次模型调用，更不是全部人物目标成功或公平调度的证明。单独的真实两步依赖规划回归保留其范围。

远端完整运行657.452秒；观察活动15项（13通问、1协助、1会面），8项done、7项cancelled，末尾pending为0。活动done不一律等于目标成功。堆读数最大3,063,140,828字节、末尾1,384,335,472字节，既不是连续峰值，也不是泄漏证明。详见 [METRICS.json](browser-574-remote-pass/METRICS.json)。两次保存记录中的`activityBytes`实际为JSON的UTF-16长度114066、128185，不是磁盘字节或完整存档增长。本机对应活动JSON长度为114066、128159。两次正式成功不证明全部平台长期内存问题都已解决；大型保存与后台结算的内存和等待成本仍显著。

本机观察到的renderer堆最大读数为2,739,549,728字节、末尾1,382,323,210字节，同样不是连续峰值。另对同一真实桌面自动存档只读取文件元数据：第二次加载完成、第三回合尚未提交时181,390,295字节，最终day60为183,259,378字节，增加1,869,083字节。该增量包含正常全世界变化，不能归为NPC独占成本；未复制完整存档内容。[本机METRICS及采样时点](browser-574-local-pass/METRICS.json)保留原依据。

## 必要修改及证据

### 职任、现场时序和结果

私人外出逐项核对实际职责，活动参数不能取消约束；许可不得跨人物、组织或任职借用。外勤标签不是私人远行许可，获准私人出行也不赋予目的地公权。

现场活动复用消息、SimTime、行程和账本真源。未送达条件、玩家选择、预算重试及不确定路线保留安全边界。未进行、部分参与、拒绝和取消不算规划成功；同一次经历不重复发放成果。旧实现反例见 [玩家边界](r2-player-boundaries.json)、[职任身份](m1-missing-identity-reproduction.json)。

### 574：复用同一个后台记忆保存生产者

主canonical保存仍不等待SC25／SC25c；后台复核先等待原来已经启动的记忆保存Promise，再确认自己的pending来源真正保存，之后才建立第二个basis。不重新调用可重开失败周期的等待入口。取消、读档、同局变化与忙碌时退出；首次producer失败保存原因与来源，已请求保存后的失败不重置重试预算。

原生产者闭包移出持有整份canonical快照的async IIFE。新旧真实源码反例证明旧版在记忆未完时已调用第二次模型，新版等待；79项Review、36项保存边界及84项保存一致性定向回归通过。[实现与反证](memory-producer-barrier-20261023/README.md)、[机器记录](memory-producer-barrier-20261023/evidence.json)。小对象显式GC诊断只证明引用释放及未确认写入的恢复保护，见 [诊断边界](save-closure-diagnostic-d31/README.md)，不代替正式验收。

### 保留的d31与681修复

d31将整档JSON解析移入原主进程保存队列；旧对象API、磁盘格式、可信IPC、session及rename前后检查不变。见 [实现证据](autosave-main-parse-20261023/evidence.json)、[独立复核](autosave-main-text-review.md)。当前574的实际桌面IPC、重启和启动恢复另见 [remote-574-core](remote-574-core/SUMMARY.json)；[d31 core](remote-d31-core/SUMMARY.json)保留历史身份。

681先保存复核pending来源，再分配下一basis；原62项同测试对照为新62通过、旧45通过／17失败。[说明](review-save-barrier-20261023/README.md)、[证据](review-save-barrier-20261023/evidence.json)。单独这一步未消除后来的正常OOM，574继续修复了晚到的记忆保存与闭包保留。

## 门禁及历史失败分别记录

574首次本机同轮运行 [186eb79d](final-gates/2026-10-23T07-44-07-460Z-186eb79d-3676-415a-8347-e47a1fef1f25/SUMMARY.json)：66通过／1失败，两官方兼容及六静态通过。失败是`smoke-turn-capture-work-count`提取源码时未加载新增helper，不是环境超时；只修测试依赖，保留原失败。修正后另一整轮 [5a8bdda1](final-gates/2026-10-23T07-57-29-186Z-5a8bdda1-7a3f-4c36-9f31-ca1d757c2815/SUMMARY.json) 的67／67、两官方兼容及六静态全部通过，599.178秒。其身份是574＋唯一测试夹具补丁，输入hash为`bbce0d44c14a150e8c3893867469f0cc0cd501887ccdfdcf11eca21988b7819d`，不能写成纯574原轮全绿；原远端[guards报告](remote-574-guards/SUMMARY.json)也以同一夹具失败结束（1185通过／1失败／2既有豁免）；修正后的新远端最终门禁仍待收口。

- **d31正式远端**：[正常未采样OOM](browser-d31-remote-oom/summary.json)发生在实际问答、返程后的最后后台保存阶段。本机同轮在831秒主动中断，见 [中断记录](browser-d31-local-launch/INTERRUPTED.json)，不写成本机OOM或通过。d31的[67项旧通过](final-gates/2026-10-23T06-57-56-916Z-897c28fa-8d7e-4b70-a76f-4562a7444d66/SUMMARY.json)不继承给574。
- **681**：[远端OOM](browser-681-remote-oom/summary.json)、[原文件hash](browser-681-remote-oom/ARCHIVE.json)、[本机522.952秒人工中断](browser-681-local-launch/INTERRUPTED.json)与[59项旧门禁](final-gates/2026-10-23T06-29-30-533Z-76dc02f0-f0d4-460e-a69d-19f2256b0b07/SUMMARY.json)分别保留。
- **923**：[本机原业务链成功](browser-923-local-pass/summary.json)，但最终截图只见主地图；[同树远端OOM](browser-923-remote-oom/summary.json)。不作为当前更强可见结果证明。
- **8a**：[采样诊断成功](browser-8a-diagnostic/summary.json)，但匹配V8的CDP采样会触发GC，故`formalAcceptancePassed=false`。[上游核对](allocation-probe-20261023/upstream-v8-gc.json)。它与本次574未采样成功分别记录。

更多旧记录见 [HISTORY-REPORT.md](HISTORY-REPORT.md)、[HISTORY-TESTS.md](HISTORY-TESTS.md)。不拼接不同版本数字为一次全通过。

## 未验范围

其余两部官方剧本仅有headless加载、地点／职任、活动入口和保存结构恢复兼容，未完成正式菜单与完整往返。[官方兼容范围](OFFICIAL-COMPATIBILITY.md)。完整无官玩家开局、全部历史假制、完整代理／归任UI、移动真机、Claude新UI、真实付费模型及全世界分段等价均未验。公库只保持回归；省经济对账不证明所有财政投影恢复守恒。

独立遗留项见 [LEGACY.md](LEGACY.md)。最终门禁收口后冻结此开发线，不继续增加新主题或大型系统。
