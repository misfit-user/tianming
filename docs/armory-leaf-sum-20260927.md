# 军工原料与马政按叶子汇总（2026-09-27）

工作树：`E:/tianming-codex-tang-data`；分支：`codex/armory-leaf-sum`；基准：`bedc320885abaff238049c7f905b725d25c41498`。初始工作区干净。修改留在工作区，未提交、未 push、未发版。

## 问题与改法

`tm-armory.js` 原来把行政树的父节点与叶子一起交给原料、马政汇总。天启、绍宋的父级 `economyBase` 存有下属合计；即使父级合计后来没有跟着叶子更新，仍会被再次计入。晚唐源 JSON 的道级没有 `economyBase`，但真实开局会补出非零值，也受到影响。

此次修改三条已确认的汇总路径：

1. 军工增加 `_productionRegions`，递归取得没有 `children` 或 `children` 为空的节点。同一对象只计一次，兼容根节点列表、已经展开的父子混合列表、旧存档 `GM.regions`、旧 `econ` 字段和单层省份。`playerRegions` 返回产量叶子；`collectMaterials` 和 `runArmoryProduction` 对显式传入列表也执行同一规则。
2. `CascadeTax.sumEconomyBase` 从 `leafOnly: false` 改为 `true`。保留原有势力筛选、`requireTag`、叶子灾害折减以及默认覆盖全部势力的范围。
3. 内帑 `_imperialAssetsTotal` 只累加叶子的 `imperialAssets`，保留已有 `children` / `divisions` 两种下级表示和缺数据回退。

`_walkDiv`、`_allRegions`、`_allBuildings` 的全树建筑收集行为保留。父级军器局能正常耗料、生产；不把建筑实例当作父级统计数删除。没有改剧本源数据、派生剧本、版本、热更清单或架构基线。

铁 `0.0015`、硝石 `0.0003`、皮革 `horse × 0.01 + farmland × 0.000005`、木 `0.00002`、马政 `0.004` 及效率公式、取整位置均未改。原注释的全国标定数字保留，并注明不能据旧全树口径补回父级产量或调整系数。

## 军工调用点逐处判定

| 位置（修改后的文件） | 实际输入 / 用途 | 判定与处理 |
| --- | --- | --- |
| `tm-armory.js:182` `_walkDiv` | `_allRegions` 传各势力根节点，递归展开父子 | 保留全树；本身不求产量 |
| `tm-armory.js:195` `_allRegions` | `GM.adminHierarchy[*].divisions`；无行政树结果时退回 `GM.regions` | 保留；建筑要能找到父节点。产量消费方再取叶子 |
| `tm-armory.js:171` `regionMaterialOutput` | 单个区划的 `economyBase || econ` | 单点换算保留；去重与取叶放在汇总入口，系数不变 |
| `tm-armory.js:204` `collectMaterials` | 显式 `regions`，否则 `_allRegions(GM)` | 原料汇总，改为递归取叶；父子混合列表按对象去重 |
| `tm-armory.js:298` `_allBuildings` | `_allRegions(GM)` 的所有节点 | 收建筑，保留父节点，不使用产量列表 |
| `tm-armory.js:314` `playerRegions` | 优先 `player`，再玩家势力名，最后原全区划回退 | 所有运行时调用者均用于产量，改为返回叶子；势力解析规则不变 |
| `tm-armory.js:343` `runArmoryProduction` 的 `regions` | `opts.regions || playerRegions(GM)` | 用于马政，只取叶子；显式列表也受保护 |
| 同函数的 `buildings` | `opts.buildings || _allBuildings(GM)` | 建筑实例，保持原行为；父级建筑能生产 |
| `tm-armory.js:383` `runTurn` | 向原料收集与军工生产传同一辖区列表 | 下游统一取叶；翻账、库存、效率与耗银规则保留 |

全仓调用检索未发现 `playerRegions` 被其他运行时模块用于收集建筑。

## 其他引擎逐处判定

检索范围以 `web/` 直接运行时代码为主：交叉查找 `children` 递归、`economyBase`、`populationDetail`、`mouths`、`+=` / `reduce`、全树与叶子读取器及其调用者；另逐读命中的主要财政、户口、营建、沿海、科举和人才模块。不是对所有编辑器和所有 UI 的全量审计。

| 模块 / 路径 | 父级数据与调用方证据 | 处理 |
| --- | --- | --- |
| `tm-fiscal-engine.js:2001` `sumEconomyBase` | 直接 `walkAdminDivisions` 全树累加；天启、绍宋父级田亩、矿马、皇庄田、驿站、解额均存子合计 | **修改**为叶子汇总 |
| `tm-guoku-engine.js:136` `_sumEB` 及其直接调用 | 田赋、盐、海贸、商业、矿、渔、马政消费 `CascadeTax.sumEconomyBase`；驿站、科举支出也调用它 | 由上述共用汇总修复，不逐个改公式 |
| `tm-neitang-engine.js:100–125` `_sumEB` / 皇庄田 / 皇产 | 皇庄田走 `sumEconomyBase`；皇产另自行遍历全树。源 JSON 天启玩家父/叶皇产均为织造 5、矿场 20、御窑 1；绍宋均为 1、5、1 | **修改**独立皇产汇总；皇庄田由共用汇总修复 |
| `tm-fiscal-engine.js:1917` 实际级联征收 | 调用已带 `leafOnly: true` | 不改，没有父子重复征收这一问题 |
| `tm-fiscal-engine.js:1343` `estimateNationalMouths` | 优先全国人口，否则调用 `leafOnly: true` | 不改 |
| 财政 `fold` / `reconcile`、灾害标记、按名查区划 | `fold` 从零汇总子项后赋给父项；标记与查找虽遍历全树，不累加全国产量 | 不改；不能仅因 `leafOnly: false` 就删父节点 |
| `tm-coastal-raid.js:19` `_allLeaves` | 每个势力调用 `IntegrationBridge.getLeafDivisions`，再按对象去重；袭击只处理所得叶子 | 不改，父级海贸合计不会再次被袭击 |
| `tm-building-works.js:565` `tick` | 遍历 P/GM 行政树，按区划对象去重，逐座 `buildings` 调 `tickBuilding`；统计的是工程实例 | 不改，父级工程必须保留，不属于经济或人口合计 |
| `tm-building-works.js:283` `spreadMinxin` / `applyCompletion` | 民心下发叶子；完工经济效果写调用方传入的承载区划，没有全树求和 | 不改；省级经济建筑的效果落点另见下方限制 |
| `tm-region-enrich.js:20,31,56,669` | 读取器可取全树，随后补各节点的人口分类等字段；本文件没有 `economyBase` 补值或全国产量相加 | 不改；不能据文件名把父级经济补值归因于它 |
| `tm-game-loop.js:88–106` → `tm-fiscal-engine.js:1191–1245` | 开局逐节点调用 `_ensureEconomyBase`，包含父节点。田亩可由户数、环境等推导，矿马等可由人口与标签补齐 | 保留默认补值；消费方只读叶子，避免把展示/缺省父项当成独立产区 |
| `tm-integration-bridge.js:90,477,545` | 取叶、父项由子项覆盖、全国人口另由叶子相加 | 不改；父项镜像不是第二笔全国人口 |
| `tm-huji-engine.js` 的人口视图、`_walkAdminLeaves`、`_leafPopulationTotals`；户口 bridge / governance | 递归先排父，再加叶子人口；人口视图按势力叶组读取 | 不改 |
| `tm-corruption-engine.js:389` | 人口权重来自融合桥玩家叶子；没有加父级人口 | 不改 |
| `tm-talent-bottlenecks.js:14`；`tm-keju-paradigm.js:813`；`tm-keju-indicators.js:291` | 有下级即递归并 return，随后才加经济、人口或解额 | 不改 |
| `tm-faction-derived-economy.js:87`；货币粮食平衡 `declaredFoodBalance` | 前者建叶子索引并按 ID 去重，后者在有 children 时递归返回；不把父子相加 | 不改 |
| `tm-endturn-province.js:463`；`tm-player-core.js:739` | 单区统计递归汇总子结果；叶子分支与父分支互斥 | 不改 |
| `tm-economy-engine.js:1883`；`tm-guoku-engine.js:1596` | 调用方提供 `mapData.cities` 平铺城市；不递归行政树。地区分账按人口比例分配既有总额 | 不改，不能仅看人口 `reduce` 就认定父子重复 |
| `tm-economy-engine.js:2062` 全树地域读取器 | 后续用于币值接受度、区域价格等逐地读写，未发现该路径把父子经济/人口加成全国总量 | 不改 |

本次范围内确认的同类重复汇总已在上述三个引擎入口修复，没有另留一处已确认的“父合计 + 子产量”求和。未证明为重复计数的路径没有改动。

## 官方剧本的实际形状

`GM.adminHierarchy` 是以势力键分组的对象，各分支有 `divisions` 数组；正式下级用 `children`。下面的“父”包括所有非叶中间节点，不只看最外层省/路名称。

| 剧本 | 运行时势力分支数 | 玩家父节点 | 玩家叶子 | 源 JSON 有 economyBase 的父节点 | 实际开局有 economyBase 的父节点 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 天启 | 22 | 19 | 198 | 17 | 19 |
| 绍宋 | 35 | 28 | 277 | 28 | 28 |
| 晚唐 | 42 | 45 | 249 | 0 | 45 |

源 JSON 的天启玩家父级 / 叶级矿产均为 **11,200,000**、马政均为 **61,700**、田亩均为 **564,766,900**；绍宋分别均为 **712,704 / 1,524 / 427,545,616**。这证明它们是合计镜像，不是父节点另外一份物产。晚唐源 JSON 父级三项均无值，但实际初始化后并不继续为零。

真实开局中的玩家父级 / 叶级总数如下（经济基数，不是兑换后的原料）：

| 剧本 | 矿产：父 / 叶 | 马政：父 / 叶 | 田亩：父 / 叶 |
| --- | ---: | ---: | ---: |
| 天启 | 11,200,000 / 2,354,597 | 63,500 / 6,589 | 567,106,900 / 566,899,335 |
| 绍宋 | 712,704 / 712,704 | 1,524 / 1,524 | 427,545,616 / 427,546,741 |
| 晚唐 | 107,681 / 697,547 | 4,063 / 3,346 | 70,536,667 / 244,115,391 |

因此，“晚唐没有父级经济项，所以不重复”仅适用于源 JSON，不能用于实际开局。天启实际开局的叶子值也不同于静态 JSON，不能直接把旧产量除以二当作结果。

## 三部每回合产量前后对比

| 剧本 | 铁：前 → 后 | 硝石：前 → 后 | 皮革：前 → 后 | 木：前 → 后 | 战马：前 → 后 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 天启七年·九月 | 20,333 → 3,533 | 4,068 → 708 | 6,365 → 2,893 | 22,681 → 11,340 | 218 → 20 |
| 绍宋·建炎元年八月 | 2,138 → 1,070 | 428 → 213 | 4,298 → 2,147 | 17,100 → 8,549 | 10 → 5 |
| 晚唐·开成五年 | 1,209 → 1,047 | 241 → 209 | 1,645 → 1,251 | 6,299 → 4,888 | 20 → 9 |

测量方法与边界：

- 每个剧本单独启动 Node 进程，仅开一个游戏 VM。复用 `smoke-start-game-data-integrity.js` 的 `loadGame`，按 `index.html` 顺序加载正式脚本、按 manifest 校验所选剧本的 bytes/SHA-256，再调用真实 `doActualStart(sid)` 与真实 `enterGame`。不执行该 smoke 的其他测试用例。
- 原版三个引擎从本次修改前的字节备份加载（等于指定 HEAD）；真实开局后，在同一份运行时行政树上测原版，再加载修改后的三个引擎测新版。每次测量临时克隆并恢复 `guoku` / `neitang`，并断言整个行政树序列化结果前后不变，避免库存和随机开局差异干扰比较。
- 调用 `TMArmory.runTurn(GM, {buildings: [], noSilver: true})`，四类原料读取账本 `thisTurnIn`，战马读取 `report.produced.战马`。`regions` 与 `efficiency` 均不覆盖，因此使用真实玩家辖区、工部主官与腐败效率。空建筑列表用于隔离题目要求的原料流入及马政产出；不是扣完建筑耗料的净库存差，也不包括自定义建筑 profile 额外产马。
- 报告返回的效率（三位小数）分别为天启 **0.777**、绍宋 **0.801**、晚唐 **0.683**；实际计算仍使用函数内未截断的精度。原料逐区换算取整后相加，战马汇总后统一乘率、效率再取整，因此不要求所有新值恰好为旧值的一半。
- 三次有效官方开局均为 `turn=1` 且已进入游戏；实际地图区域数分别为 **307 / 566 / 575**。所有网络请求用既有 headless 桩，不调用真实模型/API。Audio / IndexedDB 缺失是 headless 环境限制，不是游戏产量错误。
- 绍宋第一次受 768 MiB 堆上限限制、之后一次受 30 秒开局超时限制，没有形成有效测量；释放进程后去掉重复源数据和跨用例编译缓存，使用 1280 MiB 堆上限、120 秒执行上限完成。全过程没有同时保留两个开局 VM。有效进程峰值 RSS 约天启 **495 MiB**、绍宋 **1487 MiB**、晚唐 **1004 MiB**。
- 测量脚本、逐例汇总和修改前备份均放在 `E:/tianming-tmp/codex-armory`；数字落入本报告后清理，不保留大型存档或地图副本。

另外用真实引擎开了一个仅有两个省级节点的自定义剧本，一个不含 `children`，另一个 `children: []`：原料 **铁 2,100、硝石 420、皮革 1,235、木 140**，战马 **383**，修改前后完全一致；两个节点都作为叶子保留。其独立 VM 峰值 RSS 约 **120 MiB**。

## 其他修复的量化证据

以下也在同一实际开局快照上调用原/新公开 API。经济汇总与内帑维持原来的全势力范围，不能把这里的全境数字当作仅玩家辖区数据。

| 调用 | 天启：前 → 后 | 绍宋：前 → 后 | 晚唐：前 → 后 |
| --- | ---: | ---: | ---: |
| `sumEconomyBase('farmland')`，全势力 | 1,163,250,905 → 581,521,670 | 1,125,645,599 → 562,823,362 | 574,030,670 → 490,175,903 |
| 同字段，`faction: 'player'` | 1,134,006,235 → 566,899,335 | 855,092,357 → 427,546,741 | 314,652,058 → 244,115,391 |
| 内帑旧账制 `Sources.huangchan()` 年额 | 4,910,000 → 2,930,000 | 720,000 → 360,000 | 0 → 0 |
| 内帑旧账制 `Sources.huangzhuang()` 年额 | 12,983,818.5 → 6,008,818.5 | 368,603 → 184,301.5 | 0 → 0 |

晚唐的正式开局走显式账制，旧皇产、皇庄收入被现有包装禁用，不能把这两行零解释为晚唐没有相关经济字段。这张表是 API 汇总结果，不是额外执行一回合的实际国库入账。

## 未改与尚未确定的边界

1. 天启开局叶子矿产、马政与源 JSON 的数值差异已观测到，源 JSON 和生成脚本中的原始矿产合计是一致的。具体开局步骤为何改变这些叶子值，本次没有完整追踪；没有据此修改初始化、剧本或地图数据。对比使用的是实际 `GM`，不是静态推算。
2. 原料无显式辖区时的全势力回退，以及 `_allBuildings` 跨势力收集建筑的现有规则保留。这可能涉及归属口径，但不等同于父子合计重复，此次不扩成势力归属改造。
3. `BuildingWorks.applyCompletion(div, ...)` 的经济效果直接落给定的 `div`。若自定义/旧存档把矿场或牧场放在非叶节点，新增经济效果如何分配到下属实际产地，需要另定分配规则；本次只保证父级军工建筑实例及其 `armoryProfile` 不被过滤，没有擅自把父级经济增量均摊到府州。
4. 按省/府分别建立的公共库、独立建筑、明细与镜像不能一概删除父级。此次没有认定这些实体本身是重复资产，也没有重写所有行政树遍历器。

## 验证

全部按顺序运行，无全量 smoke、无 `sync-hot-baseline`：

| 命令 | 结果 |
| --- | --- |
| `node web/scripts/smoke-armory.js` | 86 通过 / 0 失败；⑧ 已改为父合计不重计，新增单层省、混合显式列表、旧存档、马政与父级建筑断言 |
| `node web/scripts/smoke-armory-readiness.js` | 13 / 13 |
| `node web/scripts/smoke-disaster-taxbase.js` | 23 通过 / 0 失败；新增叶子、灾减、势力/tag 过滤、旧树形断言 |
| `node web/scripts/smoke-neitang-shared-fields.js` | 99 assertions；新增皇产/皇庄叶子口径、单层省、旧下级字段、缺行政数据回退 |
| `node web/scripts/smoke-fiscal-dynamic-settlement.js` | 40 assertions |
| `node web/scripts/smoke-guoku-legacy-fiscal-compat.js` | 17 assertions |
| `node web/scripts/smoke-neitang-inner-treasury-compat.js` | 10 assertions |
| `node web/scripts/smoke-native-fiscal-consumers.js` | 19 PASS / 0 FAIL |
| `(cd web && node scripts/lint-arch-all.js)` | 15 项全部 PASS，未更新基线 |
| 三个修改后引擎的 `node --check` | PASS |
| `git diff --check` | PASS |
| Git Bash：`git diff \| grep -c $'\r'` | **0**；grep 无匹配返回 1 是正常语义 |

字节检查：`tm-fiscal-engine.js` 原有 **11 个 CRLF** 保留在原有行，其余段落 LF 保留；另外两个引擎及三个 smoke 均保持 LF。未改行尾样式或中文显示名。

最终文件范围：三个引擎、三个对应 smoke、本报告，共 7 个文件。`HEAD` 未改变，所有改动均未暂存。
