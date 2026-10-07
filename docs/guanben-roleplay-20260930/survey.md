# 附录：现状勘察

> 2026-09-30 · 基线 origin/main `22472d24` · 六路只读勘察（官制、钱粮、文书流、NPC 底盘、玩家身份、关系家族）
> 路径默认在 `web/` 下。标「已亲核」的是我自己对过代码的；标「待实测」的是读码推断、没有跑过。
> 这份附录只记事实，设计取舍见 [design.md](design.md)。

---

## 顺带发现

与本设计不一定直接相关，但都是现存的问题，值得先知道：

1. **加派诏令不进银子**（已亲核）。`tm-guoku-engine.js:1325-1340` 的 `Actions.extraTax` 只把税率写进 `guoku.emergency.extraTax`，全库没有任何地方读它来收税；下加派只落下腐败源 +税率×10、民心 −税率×15。
2. **奏疏每回合整批替换**（已亲核代码路径）。`tm-memorials.js:701`、`:142` 把 `GM.memorials` 换成新一批，只保留未读的交办复命（`tm-imperial-orders.js:67-72`）。留中的折子、派来的弹章、驿递刚到的远方折，会在下一批生成时被冲掉；而提示词里还有「留中满 2 回合的焦虑」。
3. **关系交互的效果不落地**（已亲核代码路径）。`tm-relations.js:229-236`：被行动账认领的交互类型一进门就转成信件计划返回；担保、举荐、联姻、师徒、托孤、密信等在交互表里规定的亲疏、人情、标签加减都不执行（登记在 `tm-npc-decision.js:392-394`）。
4. **权臣截留只打标记、没人读**。`tm-authority-complete.js:237-248` 给第二队列的复奏打 `intercepted`，复奏面板与批复函数都不读，被截留的文书照常可见、可批。
5. **失位标记只写不读**。`_playerDeposed`、`_playerCaptive`、`_deposed`、`_puppet` 全库没有读者；失位后五渠道与精力照常全开。
6. **继位后身份不同步**（待实测）。`transferPlayerControl`（`tm-indices.js:1560-1659`）只更新 `GM.playerInfo`，不更新 `P.playerInfo`；回合推演找主角读的是后者（`tm-endturn-prompt.js:2782-2786`），继位后 AI 可能仍把先帝当主角。
7. **官制活化开关实际默认全开**（已亲核）。`tm-office-flags.js:23-33` 总闸缺省为 true；各文件头注释仍写「默认关」。
8. **改制裁定不查落树结果**（读码）。拆分、「改制」一揽子方案入队后落成 `other`、落树失败，但裁定仍记「准行」并扣皇威（`tm-office-reform.js:388-391`）。
9. **Agent 模式可能不征正税、不提交延期行动**（待实测）。全库唯一的征收调用在 `tm-endturn-ai.js:2935/2939`（LLM 模式）；Agent 分支不经过写回（`tm-endturn-pipeline-steps.js:372-397`）。
10. **头衔非空被当成有官**。功名推定（`tm-gongming.js:165`，vm 实测张溥、顾炎武都被推成「生员」）、NPC 行为候选（`tm-npc-decision.js:1044, 1066`）、科举排除考生（`tm-keju.js:1005`）、铨选（`tm-keju-runtime-keyi.js:1613, 2121`）。
11. **开仓、借贷直改国库余额，绕过账本**（`tm-guoku-engine.js:1350, 1394`）。
12. **通志的起运、留用是静态数**：旧账剧本是剧本里的年额，晚唐是岁计预估，都不是本回合实账（`tm-map-circuits.js:228-290`；`phase8-formal-map-dossier.js:316-346`）。
13. **财政没有任何揭真通道**：奏报失真层现有的揭真调用只在腐败、民心、人力、军额。
14. **界面固定文案写死「通政司」**（`phase8-formal-drafts-message-panels.js:114, 136, 149, 305`），违反「界面用朝代中立词」的规矩。
15. **行动账的回执与政治来源不裁剪**（`tm-npc-action-ledger.js:439` 等），存档随行动量增长。
16. **九权词表抄了五处、编辑器只认六权**（`tm-office-powermap.js:20-24`、`tm-office-reform.js:12`、`tm-office-charter.js:23-24`、`tm-office-creation.js:7`、`tm-office-dutystate.js:18`；`editor-office-deep.js:57`）。
17. **座主门生强度只衰不增**：`_kjBumpDiscipleStrength` 没有调用方。
18. **`GM.clans` 从不写入**：族共财、九族株连取族人、抄没族产都空转（`tm-char-economy-engine.js:1340-1343, 1386-1391, 1752-1787`）。

---

## A. 官制数据

- **运行时的树**：天启用剧本顶层 `officeTree`（`tm-patches-start.js:1424`）；绍宋、晚唐用玩家势力的 `fac.officeTree`（`:1936-1945`，内容与顶层相同）。三部都是扁平树，`subs` 全空，装载时还会拍平（`tm-office-system.js:360-371`）。三部都不启用 NativeWorld。
- **职位字段**：天启 153 个（无 id、无 holderId）、绍宋 169 个（无 id）、晚唐 220 个（有 id、holderId、`regionId`=治所州 89 个、`treasuryBinding`）。多员额：天启 32 职 352 席（如十三道监察御史 ×110）、绍宋 76 职 695 席（如知州·知军·知监 ×40）。天启的陕西巡抚没有 powers、authority、俸禄，只能靠省节点 `governorOffice` 反查。
- **补 id**：`political-office:<组织>:<路径>` 只在读档（`tm-save-lifecycle.js:1021`）和首次回合结算（`tm-endturn-apply.js:164`）补一次。
- **九权与档位**：剧本实际只用 appointment、impeach、supervise、taxCollect、militaryCommand 五键；judicial、works、drafting、yinBu 出现 0 次。authority 四档（decision/execution/advisory/supervision），晚唐有 6 个职位写了不在集合里的 administration。
- **`OfficeHolderState`**（`tm-office-holder-state.js`）：`assignments` 返回 `{dept, holder, principalCharacterId, delegated, appointmentId, positionId, jurisdiction}`；`appointmentId` 只有 NPC 任命会写，通用任命 `_offAppointCharacter` 不生成；`jurisdiction` 取 `pos.jurisdictionId‖…‖node.id`，三部剧本都没写，实际等于部门 id；`availability` 管代理与 capacity（请假已批且代理人在位才生效）；兼任时 `select` 不指定就返回 null。
- **辖区现存的载体**：晚唐职位 `regionId`（治所州）；行政树省节点 `governorOffice`（天启、绍宋写「部门/职位」路径，晚唐写职位 id）；`mapData.circuitRegistry`；省道治理 `tm-circuit-governance.js`（`governorOf` 返回绑定状态、能力、履职）；`liveRegionGovernor`（只按头衔字符串唯一匹配）。
- **统属**：职位上没有任何上下级字段（`types.d.ts:251-264`）；唯一接近的是非玩家势力的 `authorityScope.positionIds/departmentIds`（`tm-political-actions.js:44`）；晚唐有 `mechanicsConfig.executionPipeline`（中枢议政、文书颁行、对口承办、执行核查，`tm-endturn-edict.js:1120-1178`），只作提示词信息。人物的 `superior` 是自由文本（天启 141 人有，只有 3 条能精确对上人名）。
- **改制**（`tm-office-reform.js`）：种类有增设、裁职、裁衙、改名、合并、其他，没有移权和拆分，全按名字匹配；抵抗基础分 5/15/25/35/45/20。章程校验（`tm-office-charter.js:64-116`）：职位 ≤6、员额 1–8、每职 ≤3 权、品级须在本朝品级表内等。
- **权限判定** `authority()`（`tm-political-actions.js:30-57`）只读在任职位的 `powers[power]===true`，再过 `authorityScope` 过滤；兼任命中多条返回 null，须显式给职位。三部剧本里 judicial、reform、declareWar 为 true 的职位数都是 0。

## B. 钱粮链路

- **流程**（旧账：天启、绍宋）：prep 阶段税令写税政规则、改革诏存入 `GM._turnFiscalReforms`、加派开仓借贷调 `GuokuEngine.Actions`；ai 步主推演之前 `CascadeTax.collect`（每回合一次，幂等标记 `tm-fiscal-engine.js:1942/2054`）：应征 = 税基 × 税率 × 天数/365 × 各种折扣；起运毛 × `compliance` = 起运净，再扣路耗入国库，差额是截留，**一半进主官私财**（`:1694-1700, 1743-1749`）；存留进叶库。然后固定支出、sc1 写回（AI 财政条目先过权限门，再改革兜底、履职 tick）。systems 步回合推进、腐败、户口、国库 tick。回合尾省道主官改叶子腐败。
- **统一账**（晚唐）：实收 = 应收 × `compliance`，截留 = 实收 × `skimmingRate`，起运 = 余额 × 起运比 × (1−路耗)，存留进叶库；截留在报表里拆成胥吏、主官、豪强三份（`tm-fiscal-statements.js:202-213`）。
- **叶子字段**：`div.fiscal`（应征、实征、`compliance`、`skimmingRate`、`autonomyLevel`）、`div.corruption`、`populationDetail`、`fiscalConfig.centralLocalRules`（起运存留比）、`div.publicTreasury`。天启 `compliance` 0.15–0.86（中位 0.61）。
- **官员对钱粮的作用**：履职度（`tm-office-dutystate.js:197-209`，施加在 `modules/ai-change-applier/reconcile.js:366-411`）；权限门（`reconcile.js:413-442`，只管 AI 写的税类收入条目）；省道主官（`tm-circuit-governor-effects.js`，路程衰减 R=1/(1+天数/15)，改政令执行率与叶子腐败）；政令执行率（`tm-field-pipelines.js:40-82`）只影响行政变动的增量，不进税收。
- **时令**：没有夏税秋粮、开征、奏销、考成期限；年税按天摊（旧账 /365、统一账 /360）；每回合天数天启 30、绍宋 30、晚唐 10（`tm-tax-policy.js:16-26`）。
- **诏令财政动作**：加派见「顺带发现」1；开仓借贷见 11；财政改革兜底：肃贪全境 `compliance` +0.05、腐败 −3，清丈设 `_surveyTrigger`，盐法、开海基本无读者，劝农垦荒 ×2.5（`reconcile.js:298-362`）；税政诏令写 `GM.fiscalConfig.taxPolicies`，带回执，只改税率（`tm-tax-policy.js:177-204`）。
- **士绅相关**：优免、诡寄只在徭役层（`tm-renli.js:508-530`），天启只有陕西试点；胥吏、浮收、包揽只在晚唐统一账报表里；亏空有 `ledger.deficit` 与公库挂债；奏销、带征、开征、催科没有代码实体。
- **奏报失真**（`tm-reported-view.js`）：只在严格史实模式；财政键为国库银粮布与岁入、本回合收支；没有财政揭真通道。
- **公库**（`tm-public-treasury.js`）：只有晚唐启用（schema `tm-public-treasury/2`），714 个账户（国库、内帑、势力、官署 12、叶子 575、按道合计视图 107）；`transfer` 带守恒检查、幂等、回滚。府、道两级没有物理账户。
- **新层该接的写口**：征收之前改参数（`compliance`/`skimmingRate`/`autonomyLevel`）；税政条目（蠲缓加派）；清丈触发；统一账用公库转账、挂债、还债、追赃，旧账用国库加减函数（`tm-fiscal-engine.js:2571, 2794`）。

## C. 文书流

- **到达皇帝面前的东西**：AI 每回合批量奏疏（不经任何衙门；远方的先进驿递队列，可能被截获）；十余种确定性或 NPC 奏疏（自主上疏、弹章、边报、民情、役政、联名、领土、交办复命、御案时政转奏等）直接写入；第二队列 `GM._pendingMemorials`（诏令转复奏、条件急奏、权臣自拟）；候见队列 `GM._pendingAudiences`；常朝议程（AI 从二十多类来源挑选）。
- **批复**：暂存 `_stageMemorialDecision`（`tm-memorials.js:949`），prep 阶段 `_commitMemorialDecisions`（`:1091-1155`）落地；准、驳、批示、转有司、发廷议、留中六种，对上奏者的忠诚、面子、压力各有加减，其余后果交 AI 推演。
- **通政、票拟、批红、封驳**：代码里只有文案与标签；辅臣拟议 `_fuchenNiyi`（`tm-endturn-apply-stages.js:543-564`）是近似票拟，但不绑定官员，而且写在即将被替换的旧批上。天启官制树里内阁、通政使司、司礼监、六科节点都在，职责只写在描述里。
- **诏令**：登记进 `GM._edictTracker`；人事抽取只记意图；一次性财政动作在 prep 当场执行（`tm-endturn-prep.js:610-623`）；诏令效力（`tm-edict-efficacy.js`）管常制、有期、一次性。
- **`ImperialOrders`**（`tm-imperial-orders.js`）：`GM._npcCommitments`；能从「N 月内具奏」解析期限（缺省 3 回合）；有凭据才结案；按承办人所在地选奏疏、鸿雁或候见复命；逾期两回合无更新判失败。
- **改造插入点**：统一上呈写口替换十余处直写；整批替换改增量合并；票拟接辅臣拟议并绑定职位；批红用 `_stageMemorialDecision` 单点；封驳放在诏令登记之后、执行之前；截留从第二队列迁到主队列的上呈环节。

## D. NPC 行动底盘

- **行动账** `TM.NPC.ActionLedger`（`tm-npc-action-ledger.js`）：结果九种（noop、blocked、submitted、waiting、started、partial、completed、failed、expired）；执行流程为分配 id、预检、租约、回执去重、原子事务、成功须带可核验引用、入账（`:390-450`）；可核验的引用种类是固定表（`:452-490`），新写入对象要加分支；签名只比白名单字段（`:385-389`）；延期提交只提交早于本回合的条目（`:706-715`），实际晚一回合落账。
- **行为登记** `NpcBehaviorRegistry`：共 49 种；handler 必须同步、返回行动账结果、带非空可核验引用；新增一种要改登记、核验分支、签名白名单、提示词字段模板、中文名（`tm-endturn-apply.js:29` 为唯一真源）等。现有 `office_duty`、`develop_local`、`relief` 的例行部分多为空操作。
- **`PoliticalActions`**：绑定对象冻结且不可伪造，含行动者、组织、当前行事职任、知情快照；在 `writeBack` 开头提交（`tm-endturn-apply.js:163-164`）。
- **AI 关注与预算**：自主决断挑 10 人、私密单人批每回合 2 个加 1 个公开合批，硬上限 3 次调用（`tm-npc-decision-ai-driven.js:330-338`）；sc1 的 npc_actions 按显著度取 3–20 人；sc1b 5–12 条；势力回合内调度 2–8 次。合计与 NPC 相关的调用每回合约 10–20 次（推测）。
- **没有 API key 时**：NPC 决断整个停摆，**没有任何「替人物照惯例决断」的确定性兜底**（`_runTemplateFallback` 无调用方）。
- **人物限知**：秘密标记只对知情名单可见（`tm-live-context.js:4-8`）；自主决断的公开合批只看公开信息，私密单人批才带本人职任、计划、记忆；主推演与 sc15 不做逐人限知。
- **性情字段**：8D 性格（由 traitIds 推）进常朝、廷议立场与五常推导；五常进履职承载力；野心、忠诚、压力进挑选；贪念不是独立字段（8D 的一维）；`persona`、`agenda` 没有判定消费者。休眠代码：`_buildNpcActionCandidates` 的候选打分只在 AI 只回卡号时才用。
- **成本**：每次执行都深拷贝整份 GM 与 P 并做全局校验（`reconcile.js:1484-1498, 1533-1550`）。

## E. 玩家身份与五渠道

- **身份字段**：`GM.playerInfo.characterId` 是运行时权威值（`tm-indices.js:444-455`）；`P.playerInfo` 被 87 个文件读 397 处；`char.isPlayer` 被 123 个文件读 409 处；另有 `faction.isPlayer`、`GM.playerCharacterId`、`GM.startContext.*`。公共取数口 `TM.Player.getInfo/getCharacter` 用得很少；「玩家势力」没有可用的公共取数口（29 个文件各写本地函数，`_isMarkedPlayerFaction` 有 9 份拷贝，68 处内联查找）；「玩家势力」有两套定义并存（#90 的「没有能执权的 NPC」与旧的 isPlayer 标记）。
- **`isPlayer` 分类**：约 71% 指玩家本人（其中约 118 行是把玩家从 NPC 名单里剔除）、约 25% 指玩家势力或辖区、少数混用。最集中：`tm-huji-engine`、`tm-endturn-helpers`、`tm-renwu-tuzhi`、`tm-office-runtime`、`tm-ai-planning`。
- **称谓绑定**：`_tmPlayerCharAliases` 把「皇帝、天子、陛下、朕」列为玩家别名（`tm-indices.js:276-279`），还会把 NPC 关系和记忆里的这些称谓改写成玩家名字（`:356-413`）。
- **五渠道**：诏令（正式界面 `renderFormalEdictPanel`，拟诏与主角行止两个页签；提示词写死「本回合皇帝亲颁诏令」）；奏疏批复（六个按钮）；鸿雁（发信人 `'玩家'`、发信地京师；路程按里程与急递等级算；NPC 回信写「收天子亲笔」）；问对（准入按本朝、生死、同地判断，耗精力 5）；朝议（常朝 10、廷议 15、御前会议 10，每回合至多 2 次，玩家永远是主持者）；主角行止（诏令面板里的一栏自由文字，出巡、移驾没有结构化入口，玩家移动只能写进诏令让抽取器认）。
- **精力** `GM._energy`：全局一个值、上限 100、每回合回满；只有朝议、问对类动作扣；正式界面没有数值条。
- **失位**：见「顺带发现」5；被俘的 `_captured` 只有被俘朝廷模块与提示词消费。
- **原生开局**：三种角色只在授权依据上不同；运行时只有元首能继位；开局选择器只列作者预设的「掌权」档案；官方剧本都没有原生开局配置。
- **改造工作量**（勘察估计）：身份内核 M；取数口收敛 L（机械替换）；视角势力与受控者解耦 M；渠道后端合计 L～XL（朝议 XL：11 个文件、约 1.6 万行、417 处称谓）；权限层 M～L；失位渠道矩阵 M；精力与位置 S～M（`GM._capital` 125 处）；NPC 侧对称化 L（「玩家」字面量 60 处）；提示词人设 XL（「陛下」605 处、「皇帝」287 处……）。建议顺序：棘轮守卫 → 只读外观层 → 拆开换视角与继位 → 分批迁移读者 → 身份档与渠道矩阵 → 渠道逐个换装（行止、书信、奏疏反向、诏令公文、问对、朝议）→ NPC 侧对称化与提示词分档。

## F. 关系、家族与白身

- **关系存储**：五维 `char.relations`（有向，含 `owesFavor`、`holdsSecret`、标签、冲突度；`tm-relations.js:8-43`）；`AffinityMap` 对称图（`tm-help-social.js:898-975`）；`_relationships`（AI 写的关系类型）；`_impressions`；`OpinionSystem`（现算）；恩怨 `EnYuanSystem`；门生网 `PatronNetwork`。`owesFavor` 只增不减、没有讨还的消费方；`holdsSecret` 没有写入点。
- **制度关系**：荐主（`_recommendedBy`/`_mentorId`，考评失职时举主忠诚 −5、压力 +8，`tm-endturn-apply.js:2677-2691`）；座主门生（`_mentorRef`、`_cohortYear`、`GM._discipleGraph`，强度只衰不增）；同年（同年集会，`tm-keju-cohort-meet.js:39-115`）；同乡（只用于乡梓沦陷涟漪）；党派（消费很广）；姻亲（`spouse` 与 `familyMembers` 文字）；上官属官（自由文本）。**师承至少有七套存储互不相通。**
- **家族**：人物 `family` 字段三种形态并存；`GM.families` 由剧本 `families[]` 载入（天启 37 族，有门第、声望、祖籍、当家人、继承人、成员等文字字段），每月按在任族人结算声望（`tm-mechanics-world.js:326-386, 499-528`）；`GM.clans` 从不写入；有在册活子女的活人极少（天启 9/216、晚唐 2/141、绍宋 25/509）。
- **继承**：`resolveHeir`（`tm-endturn-helpers.js:356-456`）支持指定、子嗣、长幼、推举、兜底；`transferPlayerControl` 把继承人设为「皇帝」（`tm-indices.js:1587-1638`）；遗产只在经济引擎判定老死时分，旧路径要求 `family.children`（字符串形态下永不触发），人物经济账路径按份均分（只有晚唐启用）。
- **门荫与功名**：`_offMenyin` 新造一个荫生（`tm-office-panel.js:1174-1210`）；`TMGongming` 七种入仕途（科举、门荫、纳赀、军功、吏进、荐辟、布衣）；丁忧 `_mourning` 与廷议读的 `_dingyou` 两套不同步。
- **私人经济**：`tm-char-economy-engine.js`，私产含田地、宅、店、借贷等，18 项收入里俸禄、贿赂等要求有官。
- **非官社会层**：阶层 `GM.classes`（天启 9 个）与阶层—人物关系；省级节点的 `leadingGentry`、`academies` 只是字符串；地方豪强只有省级标量；书院与结社有实体（`tm-keju-school-network.js`：东林、首善、关中书院与复社，有真实山长人物）；宗族、乡约、义仓、团练没有实体。
- **科举里的非官人物**：童试、院试、乡试只产统计，生员、举人不成人物；殿试前 20 名建成人物；在册人物不能应考（`tm-keju.js:1001-1007`）。
- **没有实职的人**：天启本朝在世 99 人里约 19 人（19.2%，含罢、告归、丁忧、致仕、在学）；样本：张溥（剧本头衔「太仓举人」）、顾炎武（「昆山少年」）。
