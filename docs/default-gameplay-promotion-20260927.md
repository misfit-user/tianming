# 默认开启玩法的转正候选

核对日期：2026-09-27。依据当前工作目录的设置渲染、运行时门控、初始配置及本地 Git 历史。这里的“默认开启”指没有玩家显式覆盖时的行为；没有修改任何运行代码、设置值或存档。

“转正”建议定义为：选中的机制成为游戏常规流程，清理实验文案和不再使用的旧路径，完成旧设置/旧存档迁移，并以游戏内规则、剧本制度及触发条件决定何时发生。AI 调用预算、设备性能和叙事偏好继续作为质量设置。

## A. 优先候选：设置中默认开启的玩法

| 编号 | 玩家看到的功能 | 实际作用 | 当前门控 | 主要证据 |
| --- | --- | --- | --- | --- |
| 1 | 确定性战果 | AI 漏报或伤亡异常时，由兵力、地形、城防等核算伤亡 | `deterministicCasualties`；剧本 battleConfig 也可覆盖 | `web/tm-military.js:790`，`web/tm-patches.js:1143` |
| 2 | 兵败牵动天下 | 战败真实折损势力军事实力，进入天下反应与编年 | `worldReactorBattleEnabled` | `web/tm-world-reactors.js:19` |
| 3 | 势力活世界 | 列国宣战、参战、结盟背刺、跨回合目标与动向 | `GM._factionLivingWorld` / `factionLivingWorldDefault` | `web/tm-patches.js:642`，`web/tm-agent-flags.js:46` |
| 4 | 民变实体化 | 叛乱形成首领、旗号和军队，真实夺地、谈判、建国或瓦解 | `revoltEntityEnabled` | `web/tm-revolt-entity.js:25`，`web/tm-patches.js:788` |
| 5 | 义军拒抚·真备战 | 拒绝招安后备战进逼，不能无战斗便凭空消失 | `revoltRejectionEscalation` | `web/tm-endturn-apply.js:1964`，`web/tm-patches.js:802` |
| 6 | 边患·真实入侵 | 持续边境高风险会触发真实入侵军与作战 | `borderInvasionEnabled` | `web/tm-border-invasion.js:23` |
| 7 | 谈判续谈·多轮回价 | 招抚、议和和外藩提案可多轮往复，兑现付银、停战等条款 | `negotiationSessionsEnabled` | `web/tm-negotiation.js:33`，`web/tm-patches.js:1179` |
| 8 | 逆案裁断·阴谋真发动 | 阴谋会产生兵变、废立、下狱、连坐或继统等实际后果 | `conspiracyResolutionEnabled` | `web/tm-conspiracy.js:131`，`web/tm-patches.js:1180` |
| 9 | 廷议新框架 v3 | 预审、起议、辩议、廷推、钦定、草诏、用印、追责的八阶段流程 | `useTinyiV3` | `web/tm-tinyi-v3.js:2317` |
| 10 | 出缺补员 | 亡故、致仕形成真实官缺，进入补员流程 | `officeVacancyEnabled` | `web/tm-office-vacancy.js:26` |
| 11 | 职权舆图 | 推演读取官署职责、任官、权限和空缺情况 | `officePowerPerceptionEnabled` | `web/tm-office-flags.js:31` |
| 12 | 特科体系 | 恩科、武举、童子科依制度与时机出现；三项可以拆选 | `useNewKejuD2`、`useNewKejuG2/G3/G5` | `web/tm-patches.js:851`；各特科模块及默认开启回归 |
| 13 | 私学／书院网络 | 书院、山长、学说与科举制度形成联动 | `useNewKejuH` | `web/tm-keju-school-network.js:55` |

第 3 项在常规 LLM 回合管线中默认生效。实验 Agent 回合管线有互斥门控，另依赖 `agentLiveWorldEnabled`，它本身默认关闭。若转正，需要处理两条回合管线的接入，不能只删除设置按钮。

“活世界演绎·总纲”只是第 2、3、4、6 项的批量设置入口，不重复计为一种玩法。选中这些项转正后，总纲开关可随之清理。

## B. 同样默认开启，建议将机制与调用成本分开

| 编号 | 功能 | 实际作用 | 转正时的取舍 | 证据 |
| --- | --- | --- | --- | --- |
| 14 | NPC 势力真决策 | 非玩家势力作出可落账的财政、军务、外交、地政等行动 | 机制可常驻；AI 频率和预算继续可调，未配置 Key 时保留本地退路 | `web/tm-faction-npc-settings.js:21`、`:68`；`web/tm-patches.js:829` |
| 15 | 党派自主行动 | 联名上书、清议、杯葛、结盟、倒阁等真实政治行动 | 与党派系统一起转正，保留 AI 调用预算 | `web/tm-party-inference.js:65`；`web/tm-patches.js:1170` |
| 16 | 党争／阶层 AI 校准 | AI 精细推演党派与阶层的态度和倾向 | 可纳入正式推演质量档，不必继续暴露为实验机制开关 | `web/tm-party-class-llm-calibrator.js:1298`；`web/tm-patches.js:1163` |
| 17 | 问天先查证后裁定 | 先核实对象和现值，再执行世界修改 | 适合成为问天的标准流程；工具服务可用性及额外调用仍需兼容 | `web/tm-wentian-agent.js:100`；`web/tm-patches.js:745` |

问天的工具核实流程与“整个回合采用实验 Agent 引擎”是两个概念，不应一起误转正。

## C. 设置里不突出，但内部早已默认开启

| 编号 | 功能 | 实际作用 | 门控及证据 |
| --- | --- | --- | --- |
| 18 | 门生、同年与清议网络 | 师门、同年会、联名上书、言官清议及人物归因 | `useNewKejuD1`；`web/tm-keju-disciple-graph.js:47`、`web/tm-keju-cohort-meet.js:35`、`web/tm-keju-yanguan-qingyi.js:37` |
| 19 | 科举改革完整链 | 改革提案、反对派回应、新科目、实施、年度演变、跨代承袭、废止及改革者列传 | `useNewKejuL`、`L5` 至 `L12`；`tm-keju-paradigm-panel.js`、`tm-keju-reform-apply.js`、`tm-keju-reform-evolution.js`、`tm-keju-reform-rollback.js`、`tm-keju-reformer-bio.js` |

这两项可随本次一起清理遗留实验门控。特科和书院等内容仍须按时代、剧本及游戏内条件触发。

## 不混入本批的设置

仍默认关闭：实验 Agent 回合模式、全部 LLM 升级总闸、官制活化总闸、官员履职度、权限门控、改制裁定及设衙章程、权臣坐大、考课落地、官位入阴谋、才不配位反哺、俸禄认人、致仕与京察、人口自下而上、认知反馈忠诚、密探常侦、军令移防、灾异模拟、诏令外交动词、有司限期回奏、外患威胁变量联动、帝王本纪、大赦、宗室繁衍、百官主动上奏、奏报失真、科场弊案、三段史记、问天兑现对账及撤销。

这些项目可另立一批，但不能因为同处“玩法深化”菜单，就当作已经长期默认开启。

默认开启但属于质量／资源偏好：后台记忆综合、本地语义模型自动加载、NPC 文字润色，以及若干 AI 子管线分工选项。建议移入“推演质量／成本”或高级设置；音效、背景音乐、显示方式等继续作为个人偏好。

## 核对结果

- 读取了设置页面的实际条件表达式，并核对对应运行时消费者；没有凭“默认关／实验”标题判断。
- 空配置 VM 实跑：职权舆图为开，官制活化其余子项为关；普通模式下势力自主和目标栈为开，实验 Agent 模式下受另外的开关限制。
- NPC 默认精细推演、文字润色均为开；未配置 API Key 时对应 AI 路径不执行。
- `smoke-keju-specialexam-default-on.js`：43 项断言通过。
- `smoke-keju-hl-default-on.js`：37 项断言通过。
- 本地 Git 历史中，`d7f7f587`（2026-07-22）记录活世界默认开启，`56c7e88b`（同日）记录多轮谈判默认开启；这说明默认策略的历史，不替代玩家反馈统计或后续功能验收。

本次仅形成选项清单，待用户选择编号后实施。
