# 省道·通志页与方志调整 · 一期施工图

日期：2026-09-23。分支 `claude/circuit-tier-ui-20260923`，worktree `E:/tianming-circuit-tier-ui-20260923`，基于 main `e21a5126`。
设计由 owner 在 09-23 共议拍板；本文只记一期（视图加诏书）怎么施工，不改引擎账、不改剧本数据。

## 〇、开工前置

- ~~**等** `codex/map-pointer-scale-20260922` 那批地图修缮（19 个文件）提交并合入 main，再把本分支快进到新 main。~~ 已满足：那批以 `d1c9310a` 进 main，本分支已快进。它的 CI 在 maps 组失败，修复是本分支的 `ea6ca883`（本地已提交，按规矩接电重跑晚唐开局 smoke 通过后再推）。
- 冲突面：`phase8-formal-map.js`、`tm-shanhe-runtime.js`、`index.html`、`feature-manifest.js`、`tm-feature-loader.js`。更新后先重读这几处，再动刀。
- **`phase8-formal-map.js` 已卡在 lint-file-size 的 3000 行线上**（守卫把末尾空行也算一行）。S3 的交互一行也加不进去，必须先拆出姊妹模块，见第四节。
- 基线（e21a5126，本 worktree 实跑）：
  - `lint-arch-all` 13/13；
  - `ci-smokes` 1085 PASS / 0 FAIL / 2 WAIVED（缺美术资产的结构化豁免）；
  - 启动阶段清单、原生准备清单、跨发布契约、官方剧本对账、热更基线的 `--check` 全部 PASS。
  - 更新到新 main 后要重跑一遍基线。

## 一、拍板要点（详见记忆 proj-tianming-circuit-tier-ui-202609）

1. 点击随层级：天下级开谱牒，省道级开通志并整道描金边，府州级开方志；右键弹三项小菜单；三页都有可点的层级路径。设置里留开关，可切回「左键一律开方志」。
2. 通志以诊断台为主：辖境一览按问题轻重排序是主体。
3. 一期只做视图加诏书，二期让地方大员起作用，三期省道成为记账层。
4. 方志轻调加并卷：层级路径、页脚四动作、本道排名、役政并入户口、状态收进页头，八卷压成六卷。

## 二、S1 省道数据层（新文件 `web/tm-map-circuits.js`，挂 `TM.MapCircuits`）

原则：纯函数，不读写 DOM，不写 GM/P；地图模块把 `regionBundle`、`modeScore` 等函数作为参数传进来，测试可在 VM 里跑。

**已完成（09-24 本地提交）**，实际接口如下（与草案的函数名不同，以此为准）：

- **分组与地图一致**：省道 key 一律取 `TMMapRealmLayout.administrativeGroups(map, owners)` 的 `key`（沿 `parentId` 上溯，回落 `circuitId`/`provinceId`/`circuitName`/`provinceName`）。地图上的分组键是「势力|key」，通志的实体是 key，再按归属拆成本方与他属两部分。
- `indexCircuits(map, { layout, ownerOf })`：一次建好索引 `{ circuits, byRegion, byRegionId }`；每个省道是 `{ key, label, entry, members: [{ region, owner }] }`，`entry` 为 `map.circuitRegistry` 中的对应条目（可能没有）。
- `circuitOf(index, region)`：取某州所属的省道。`isRealCircuit(circuit)`：有 registry 条目或不止一州才算真省道，单州孤块不开通志。
- `partitionByOwner(circuit, viewerOwner)`：拆成 `{ own, others: [{ owner, regions }] }`。
- `profileOf(circuit, { findAdmin })`：开局档案，只取文字，不取数字。依次按 `sourceAdminId`、key、名称找行政树节点，按名称命中的还须像省级节点（`looksProvincial`）。
  - 天启：取主官、官职、战略价值、士绅、书院、威胁、治所。
  - 晚唐：取 `historicalTitle`、`commandType`、`custodyNote`；官衔也可取成员地块的 `circuitTitle`；`circuitGovernor` 为空时标「未录」。
  - 绍宋：没有路级节点，只用 registry 的 `note`。
- `summarize(regions, { bundle, mood, office })`：户口、实征、驻军求和；民心、吏治按人口加权；缺数的州单独计数（`missing`）。每个成员的数字都走与方志同口径的 `regionBundle` 和各项评分。**绝不读省级节点自带的数字**，它们开局后就冻结了。
- `rankProblems(regions, { score, grade, isWarn, statusOf, unrestOf })`：`PROBLEM_MODES` 六项（民情、军务、官守、财赋、役政、阶层压力）每个预警记 2 分，每个灾异状态记 1 分，民变信号 ≥60 记 1 分；按分数、再按名称排序，可复现。每州附主要原因。不调 AI。
- 测试 `web/scripts/smoke-map-circuits.js`（12 项）：按三部剧本的形态各造一份小夹具，另有旧式地图、空输入、排序、纯函数与源码约束（不碰 GM、P、DOM、AI）。
- 启动登记：`index.html` 在 `phase8-formal-topbar.js` 之后装载；`smoke-startup-phase-observability.js` 新增 `mapDataModules` 登记组，断言只装载一次、先于 `phase8-formal-map-dossier.js`。

## 三、S2 通志页（`phase8-formal-map-dossier.js`）

**已完成（09-24，本地提交，待回桌看手感）**。与下面草案不同之处，以此为准：
- 样稿回桌后 owner 拍板：五项读数够；卷为辖境、形势、财计，另加**营造**（本道全部建筑，只作集成展示，标出首府的建筑）；共性上提做；名称定「通志」。没有单独的「方面」卷，长官卡放在各卷之上。
- 数据层补了：`profileOf` 的 `description`；`summarize` 的丁口、名义应征、合规（与方志同口径：各州 `fiscal.compliance` 按应征加权，不是实征/应征）、有驻军州数、公帑（各州 `publicTreasury` 合计）；`rankProblems` 返回结构化 `issues`；新增 `liftCommonProblems`、`summarizeBuildings`。
- 归属一律用 `canonicalOwnerKey`（与地图分组同口径）：天启的土司地块归属写成势力 id，其余写成势力名，逐字比较会把本方州误列他属。
- 「本方」判定复用右栏的 `rightCollectPlayerFactionNames`（导出为 `bridge.rightrail.playerFactionNames`）；他方省道标「他方所辖」、不给动作（草案里说的谱牒「谍报有限」其实不存在）。
- 叙述文字（战略、边警、士绅、书院等）直接转义显示，不走 `ppValue`：它会把含势力名的整句换成势力名。方志里同类字段可能有同样问题，未改，另记。
- 册页比方志宽（`#ppop.tmf-book.circuit-panel` 560px），放得下七列辖境表。
- 进通志的入口（第三片之前）：方志页头的「道 某某」签；另有 `bridge.map.openCircuitDossier(省道 key 或府州)`。
- 测试：`smoke-map-circuits`（14 项）、`smoke-map-circuit-book`（VM 实开天启，7 项）；真机 `verify-electron-bridge.js --circuit-book`（逐卷截图，含真点击、刷新、关闭、跳方志）。VM 的模拟 DOM 对所有 id 返回同一节点、classList 不生效，这类行为只能在真机用例里验。

原草案：
- 新增 `renderCircuitBook(key, clickedRegion)` 和 `openCircuitDossier(key, clickedRegion)`；`#ppop` 的 `panelKind` 取值 `'circuit'`。
- 页头：层级路径（势力 › 省道）、名称、历史称谓、治所、归属（本方实控 x/N 州，他属列名）。有长官数据时显示长官卡（天启），只有官衔时人名写「未录」（晚唐），没有就整卡不显示（绍宋）。
- 读数带：户口、实征、驻军、民心、吏治，与方志同口径。
- 各卷：
  - 辖境（核心）：按问题轻重排序，危急项标红，点一行 `data-bk-open-region` 跳该州方志；他属州单列。
  - 方面：长官卡加属官。
  - 形势：战略价值、边警、灾异与民变蔓延。
  - 财计：起运/留用合计、库藏、掌藏记。
- 页脚动作：整饬吏治、蠲免、巡按、任免。每个动作生成诏书建议，范围写明本道各州。
- **诏书建议只保留一个写入口**：在 `phase8-formal-rightrail.js` 把 `rightAddEdictSuggestion` 导出到 bridge（它会同时记录玩家行为信号），地图模块调用这个导出，不另写 `GM._edictSuggestions.push`，免得触发 `lint-gm-writes`。
- 他属之道沿用谱牒的「谍报有限」处理。
- 档案 `source` 为 `admin` 不保证有 `adminId`：绍宋的麻逸是该势力唯一的顶层区划，节点没有 id，也没有档案文字，档案整体为空，页头按缺档降级。S2 不要靠 `adminId` 回查节点。
- CSS 放在 `phase8-formal-bridge-styles.js`，沿用册页家族样式，类名前缀 `bk-circuit-`。

## 四、S3 交互（`phase8-formal-map.js`，冲突面，须在新 main 上施工）

**已完成（09-26，本地提交；owner 09-26 令 S3~S6 全做完后统一推）**。与下面草案不同之处，以此为准：
- **不另拆新模块**：读地图模块的测试有 29 个，新拆一个文件要改一串 VM 加载器。改为把签注（`_tipRow`、`_mobileForceRow`、`mapTipVerdict`、`mapTipHtml`，125 行，正文未改）迁进已有的姊妹模块 `phase8-formal-map-dossier.js`，新交互也写在那里；地图模块只留 forward shim（`openTierDossier`、`openMapContextMenu`、`mapTipHtml`），另导出 `GRADE_BANDS`、`mapReported`、`positionMapTip`、`mapStage`。地图模块 2989 → 2875 行。`smoke-reported-spread` 的签注契约改读 dossier。
- 左键：`openTierDossier(r, tier)`，天下级开谱牒、省道级开通志（不属正式省道的孤块照旧开方志）、府州级开方志；stage 的 click 与 `bindRegionPathEvents` 两处都走它。
- 设置开关：`P.conf.mapClickFollowTier`（没设过即随层级），入口在设置「界面显示」的「舆图点击：随层级 / 一律方志」，写入走 `_togglePConf`（`lint-gm-writes` 不许 tm-patches 直写 P）。右键菜单不受开关影响；点省名恒开通志。
- 右键小菜单 `#tmf-map-ctx`：挂在舆图外框（与签注同一容器，不进 stage，免得菜单上的点击被当成点地块），与签注同一套缩放定位；打开即聚焦第一项，上下键移动，回车选中，Esc 关闭并还焦点，Tab、点菜单外、滚轮、窗口缩放或失焦都关闭；菜单开着时签注停更，山河境悬停高亮落在右键点中的州上。
- 省名可点：省道级地名 `.tmf-circuit-fit` 与势力名一样作 `role=button`（碰撞模块照样管它的 tabindex），`activateRealm` 同一处理，防拖动误触沿用 `pressedRealm`。
- 整道描金边：`boundaryMesh(本道成员同组, 'circuit-outline').major`，按成员签名缓存；SVG 图上挂 `<g class="tmf-circuit-outline">`（属性先写好再挂，免得山河境的属性监听整张重采），换层、重画后由 `bindRegionPathEvents` 调 `syncCircuitOutline` 补回；山河境新增 `setSelectedOutline(d)`，焦点层与单州选中同一画法（复用原有两种描边色，不新增写死颜色），诊断的 `selection.outlineLength` 可查。
- 签注页脚按层级写明左键开哪一册；悬停缓存键加上层级。
- 测试：`smoke-map-circuit-book` 加 2 组（随层级与设置、外沿轮廓）；Electron `--circuit-book` 加 8 条原生输入用例（三级真点击、右键菜单与键盘、Esc 与滚轮关闭、省名、设置开关、SVG 模式描金边），时限内 300 秒、外 315 秒；CI maps 组加 `--circuit-book` 一步。

原草案：
- **先拆后加**：`phase8-formal-map.js` 正好 3000 行，守卫不许再长。先把点击与标签交互拆成姊妹模块（暂名 `phase8-formal-map-interact.js`），按 alias 加内联范式迁出（见 `docs/arch-guards.md`），拆分本身单独一步提交、行为不变，再在新模块里加下面的功能。动手前先查 lint-split-contracts、lint-split-stamps 对新拆模块有什么登记要求；启动登记照第六节的顺序做。
- 左键按 `state.mapScale` 分派：`realm` 开谱牒，`region` 开通志，`prefecture` 开方志。要同时改 stage 上的 click 和 `bindRegionPathEvents` 两处。
- 设置开关：新增一个 `P.conf` 键（名称待定），默认随层级，并配设置界面入口（家规：设 flag 必配设置开关）。
- 右键：新做小菜单 `tmf-map-ctx`，三项为本州方志、本道通志、本国谱牒。支持键盘和 Esc；点击外部、缩放或拖动时关闭。游戏里目前没有现成的右键菜单组件。
- 省名可点：省道级标签带上 `data-circuit-key`，比照 `activateRealm` 处理，同样要防拖动误触。
- 整道描金边：
  - SVG 模式：把成员当作同一组交给 `TMMapRealmLayout.boundaryMesh`，取其 `major`（外轮廓），画一条覆盖描边。
  - 山河境模式：运行时目前只按单个 `.tmf-region.selected` 画焦点，需要扩展为可接收一组外轮廓。`tm-shanhe-runtime.js` 在 Codex 那批改动里，必须在新 main 上改。
- 三页的层级路径统一走 `data-bk-open-faction`、`data-bk-open-circuit`、`data-bk-open-region` 三种委托。

## 五、S4 方志轻调加并卷

- 页头加层级路径；页脚加安民、巡按、调粮、拟诏四个动作（走同一个导出）；读数旁加本道排名，例如「民心 本道 11 州第 9」。
- 役政并入户口：保留 `bk-hukou` 的 id，卷名改为户役志，原役政各行作为其中一节，据报与揭真逻辑原样搬入。
- 状态收进页头：改成小签，悬停显示效果和剩余回合；容器保留 `bk-zhuangkuang` 类名，以兼容 `smoke-region-status` 的源码契约。
- 六卷：户役、财赋、军备、职官、风物、营造。
- 契约改写（改前改后比对断言数）：`smoke-phase8-map-live-panels.js` 第 701 行的断言项 `data-bk-jq="bk-zhuangkuang"` 改为断言页头状态签，同一行的文案断言（辽河冬灾、岁入 -12%、民心 -1/回合、永 续）原样保留。第 706 行「无状态时不挂检签」并卷后照样成立，不改。
- 附加建议（待回桌确认）：谱牒的版图卷改按省道列出，点省道名开通志。**未经确认，一期不做。**

**已完成（09-26，本地提交）**，实际做法：
- 层级路径：`regionCrumbs` 出「势力 › 省道 › 本州」，势力、省道可点；原「道 某某」签由它取代。势力谱牒改由路径与归属签进，页脚不再放「展势力谱」。
- 状态小签：`regionStatusTags` 在页头 pills 下出一行小签（`bk-zhuangkuang bk-zt-tags`），签上写名目与剩余回合，悬停（title）见说明与效果；增益签青、减损签朱。原状态卷与检签「况」撤掉；`bk-zt-list` 样式未删（smoke-region-status 仍查它）。
- 本道排名：`regionCircuitRank` 在读数带下出一行「北直隶 本方 11 州中：户口第 1 · 实征第 2 · 民心第 9 · 吏治第 8」，民心、吏治排在后三分之一的标朱；只在本方不少于 2 州的正式省道里出。户口、实征从多到少，民心从高到低，吏治从清到浊。
- 户役志：户口一节在前，役政一节（`#bk-yizheng`，役政视图跳到这里）接在后，据报与揭真逻辑原样；役政里的逃户、隐户两行与户口一节重复，并卷后不再列。六卷：户役、财赋、军备、职官、风物、营造。
- 页脚：本方州县出安民、巡按、调粮、拟诏四个动作（`regionAction`，经 `bridge.rightrail.addEdictSuggestion` 写建议库，topic 为「方志·动作」），地方账本另起一行；他方州县不给动作。
- 契约改写：`smoke-phase8-map-live-panels` 状态一条的 `data-bk-jq="bk-zhuangkuang"` 改为 `bk-zt-tags`，另加一条断言检签不再出现（断言数 7 → 8）；空状态一条不改。
- 测试：`smoke-map-circuit-book` 加 3 组（六卷与户役志、排名与页脚动作、他方不给动作），「道」签一条改查层级路径；Electron 加 2 条（方志截图与布局、真点击「安民」）。

## 六、S5 验收

- 定向 smoke：
  - 新增：`smoke-map-circuits`，以及通志和交互的 smoke；
  - 回归：`smoke-phase8-map-live-panels`、`smoke-map-view-scores`、`smoke-map-live-vitals`、`smoke-region-status`、`smoke-region-governor-live`、`smoke-renli-reported-fog`、`smoke-reported-spread`、`smoke-renli-reported-channels`、`smoke-field-pipelines`、`smoke-building-order-writeback`、`smoke-building-payment-ledger`、`smoke-map-demographic-display`、`smoke-region-age-settlement-labels`、`smoke-player-action-signals`、`smoke-social-foundation`、`smoke-cultural-runtime-consumption`、`smoke-tang840-opening-ledgers`。
- Electron：`scripts/electron/strategic-map-cases.cjs`、`map-label-assertions.cjs`、`seven-ui-cases.cjs`；另加通志用例。worktree 没有 Electron 本体，届时借用主库的 electron。
- 全量：`lint-arch-all` 13/13、`ci-smokes`。
- 新增运行时脚本后的重生成顺序（顺序错了会得到过期清单）：
  1. 先跑 `lint-global-providers`（或整套 `lint-arch-all`），刷新全局提供者报告；启动阶段清单要从这份报告读每个脚本提供了哪些全局名。
  2. 启动阶段清单：`node web/scripts/build-startup-phase-manifest.js`，再 `--check`。
  3. 原生准备清单：`node scripts/build-native-preparation-manifest.cjs --write`，再 `--check`。
  4. 热更基线最后生成：`node scripts/sync-hot-baseline.js --write --version 1.3.5.2 --asset-root D:/tianming-publish-resume-1789962006317/candidate --temp-root E:/tianming-tmp`，再 `--check`。本 worktree 没有美术资产，不带 asset-root 会丢掉资产条目。
  5. 新脚本还要在 `smoke-startup-phase-observability.js` 里登记，它断言脚本总数等于 417 加各登记组。
- `smoke-tang840-opening-ledgers` 有 60 秒硬时限，笔记本用电池或与别的全量门禁并跑时会超时；推送前的全量要在接电、机器空闲时跑。
- 回桌验手感：三部剧本各走一遍，截图给 owner。

**已完成（09-26，本地提交）**，实际做法：
- 门禁：守卫 15/15（施工图原稿写 13 项，期间 main 新增了 lint-design-tokens、lint-scenario-data）；全量 smoke 1101 过、0 败、2 项豁免（缺席资产，原本就豁免），共 1103 项；三份清单按上面顺序重生成并 `--check` 通过。
- 新增 Electron 用例 `scripts/electron/circuit-tour-cases.cjs`（模式 `--circuit-tour`，配 `--scenario`）：不认死某一州，挑本方州数最多的正式省道，五条逐项核对并截图——方志（层级路径、本道排名、四个动作、至多六卷、改隶入口）、从层级路径进通志（辖境列全本方各州、四个动作）、省道级真点击开通志并描金边、府州级右键小菜单三项、改隶候选面板。各剧本的都城字段写法不一（有地名、有「无统一都城」），不拿它认治所。
- 三部剧本巡检各 10/10（含 5 项框架自检）：天启选中湖广（15 府州，武昌府）、绍宋选中广南西路（27 府州，桂州）、晚唐选中岭南（21 州，广州）。截图在各次报告目录，文件名为「剧本-region/circuit/outline/menu/reassign.png」。
- 回归（条数均含 5 项框架自检）：通志用例 24/24；战略地图默认 17/17、绍宋 17/17；山河境 10/10；七项界面 26/26。
- 未做：S4 附带的建议「谱牒版图卷按省道列」未经 owner 确认，不做。

## 六之二、S6 改隶（owner 09-24 新增，一期末尾）

- **先修写口**：回合末 AI 的区划改制事务 `tm-endturn-agent-write-tools.js` 的 `_semDivision` 已能改隶，但只改 `adminHierarchy`，不同步地图地块的 `parentId`/`circuitId` 和 `map.circuitRegistry` 的 `memberRegionIds`，AI 改隶后地图与通志仍按旧省道分组。改成三处同步、带快照、失败整体回滚；玩家与 AI 走这同一个写口。
- 规则：只许在本方省道之间改；首府暂不许改出（二期能更易首府后再放开）；不相邻允许，但提示将成飞地。
- 入口：通志页脚「调整辖区」、方志页脚「改隶」，都只生成诏书建议；下诏后由推演核定，再经写口落地；奏疏、朝会里大臣提议改隶也走同一写口。
- 地图：按势力着色，同势力内改隶不变色，变的是省道边界与省名位置；`formalMapSignature` 已含 parentId/circuitId 与 circuitRegistry，数据一致即自动重画，不需另写刷新。
- 测试：写口三处一致与回滚；诏书建议范围；地图签名随改隶变化；三部剧本（绍宋没有路级节点，只改登记与地块）。

**已完成（09-26，本地提交）**，实际做法：
- 写口是新模块 `web/tm-division-reassign.js`（`TM.DivisionReassign`：`plan`、`apply`、`targetsFor`、`movable`、`circuitOfRegion`），UMD 挂法同 `tm-map-circuits.js`（`var TM = root.TM || (root.TM = {})` 的写法会被 lint-global-providers 当成又一个改写 TM 的文件）。三处：行政树（P 与 GM 两份都改，共用节点时不重复挪）、地块字段（`parentId` 恒写，`circuitId`、`circuitName`、`circuitTitle` 原来有才写，经 `TMMapRuntime.updateRegion` 记地图变更账）、登记 `memberRegionIds`。三处逐步记撤回动作，验收不过即逆序撤回，不整棵树替换（免得节点换成副本）。
- 省道节点的找法：天启按登记的 `sourceAdminId`，晚唐按 key，绍宋路节点 id 与登记 key 不同，按名称在该州所在势力树里找；首府按省道节点 `capitalChildId`，找不到节点时取行政树里这州的上级。**绍宋如今已有路一级节点**（剧本修复后），施工图原稿说「没有路级节点」已过时。
- 地图上隶于省道的州一律当省道改隶看，目标认不出就拒绝并列出本方省道名，免得退回只改行政树。
- 回合末写工具 `restructure_division` 在 `fields.parentId` 指向省道时交给写口，写口成功之后不再有会失败的步骤；工具说明补上省道改隶的填法与规则。
- 入口：方志页脚「改隶」（与地方账本同一行），列接壤的本方省道，不接壤的收在「另有 N 道不接壤（改隶将成飞地）」里；首府只给说明。通志页脚「调整辖区」列本道各州接壤的前三道与邻道可划入之州。选定即经 `addEdictSuggestion` 写建议库（topic「改隶·目标道」，正文写明原隶与飞地、隔断提示），不改世界。
- 地图：改隶后签名变，三层重新准备（期间「舆图准备中」），省道之间的界线画在次级线（`tmf-border-minor`）里，随之重画；通志与描金边按新成员取。
- 测试：新增 `smoke-division-reassign`（三部剧本各 4 组：三处一致且地图分组归新道、首府与他方拒绝、飞地提示与目标写错、失败全撤回；另有双树与写工具 2 组，共 14 组）；`smoke-map-circuit-book` 加 2 组（入口只写建议、写工具落地后通志随之改）；Electron 加 3 条（方志改隶面板与写建议、通志调整辖区面板、落地后省道界线重画且新道通志收入此州）。

二期、三期新增（owner 09-24 定）：
- 二期「更易首府」：首府即长官驻地，长官的作用从首府出发（如应对边警）；首府失守则寄治别州、效能打折。
- 三期「省道级建筑」：贡院（乡试）、布政司署、省仓一类，与省库一起做；需要建筑类型表新增省道级（编辑器、引擎、剧本三面齐改，绍宋目前没有建筑类型）。

## 七、边界

- 数字只从叶子汇总；不改剧本数据；不新增引擎账。
- 界面固定文案用朝代中立词，官衔等专名来自剧本数据。
- 代码写成可读风格（owner 偏好），不模仿周边的压缩长行；不顺手重排旧代码。
- 每片独立可验、单独提交；每片之后回桌。
