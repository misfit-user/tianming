# 架构守卫四刀（2026-07-04）

> 背景：运行时 355 个 JS 全靠 359 个 `<script>` 标签按序加载，GM 全局单例被 163 个文件直写 3314 处，
> 串台/双账/漏还原一族 bug 皆源于此。存量一口吃不掉 → 全部做成**棘轮（ratchet）**：
> 基线记录现状，**只许降、不许升**。还清一笔就 `--update` 收紧一格。
> 巨石拆分的范式/军规/终审流程另见 [split-paradigms.md](split-paradigms.md)（拆前必读）。

## 一条命令

```
node scripts/lint-arch-all.js     # 秒级全绿门禁：写口 + 依赖 + 巨石 + 断链（每刀收尾跑）
```

## 四刀分述

### ① 写口收窄 `lint-gm-writes.js`
纪律：**读随便，写必须走账**。直写 `GM.x=` / `GM.arr.push()` / `delete GM.x` / `Object.assign(GM…)` 逐行计数；
P 是剧本库，gameplay **只读 GM 不伸 P**（剧本隔离既有不变量），P 直写同样计数。

- 超基线 FAIL，处置三选一：改走子系统 mutator/ledger 入口；确属写口本体 → 登记 `arch-baselines/gm-writes.json` 的 `config.owners`；确经裁定的合法直写 → 行内加 `// arch-ok`。
- `--top 20` 看欠账大户。当前大户：`tm-save-lifecycle.js`(442·存读档本体,已登记owner)、`tm-endturn-apply.js`(269)、`tm-patches.js`(260,P直写165是重灾)。

**子树写主固化（2026-07-04 二期）**：直写按 `GM.<顶层子树>` 归属建权属矩阵（742 棵·单写主 484 棵）。
基线里每棵子树的写手名单即权属——两条新红线：
- **闯入**：非既有写手写别人的子树 → FAIL（例：又有人绕过 MinxinLedger 直写 gm:minxin）
- **新开**：新建 GM/P 顶层子树须显式裁定写主（`--update` 落权属），防止匿名新账本
- `--subtrees` 看权属矩阵：争抢最凶 = gm:qijuHistory(25写手)、gm:_chronicle(23)、gm:vars(21)、p:conf(17)、gm:guoku(13)——还账优先队列即此表。

**还账进度**：
- ✅ p:conf（2026-07-04·性质不同：收「写必随存」而非消灭写手）：
  17 写手 133 处逐点审计——设置面板/旗标模块的写本是其职，红线是「写后不 saveP =重启蒸发」（「设置不持久」bug 族）；
  恢复/迁移路径(save-lifecycle/launch/utils loadP)则**必须不 save**（否则重演 register 竞态覆盖）。
  修真病灶三处：①tm-ai-infra 全文件零 saveP——上下文/输出上限/证据分五类探测结果(烧真金 API 换来的)重启即蒸发每会话重烧，
  五个探测收笔点补 `_persistProbeConf()`；②③FactionNpcSettings.setEnabled/setCosmeticEnrich 与 InTurnDriver.setSpeed 补写必随存。
  其余无存点定性：恢复回填/启动暂存(随 startGame 流持久化)/临时换栈(设计如此)/字符串误报。
- ✅ gm:guoku（2026-07-04·写手 13→5·外来真金流 34 处全迁 FiscalEngine）：
  国库出入的真写口 = `FiscalEngine.spendFromGuoku / addToGuoku`（对账 ledger.stock↔balance + sinks/sources 记账 + 亏空落 `_欠`）。
  直改 `GM.guoku.balance/money` 就是「财政两本账」病灶——ledger 不知情，cascade 对账时账目漂移。
  扣账语义：不打负余额·落 0 + 记 deficit（破产链读 `balance<0 || ledgers.money.deficit>0`，亏空分支健在）。
  剩 5 写手皆非金流：game-loop(展示字段+对账镜像7)·endturn-followup(营葬银暂存2)·armory(挂载init 5)·
  corruption(actualTaxRate模型字段1)·guoku-engine(owner本体78·两引擎合账属owner级设计题另议)。
  沙箱纪律同 minxin：断言国库变动的 smoke 须同载 tm-fiscal-engine.js（已补4个）。
- ✅ gm:minxin（2026-07-04·写手 11→4·直写 45→6 行）：八文件 39 处 trueIndex 直写全部迁 `TM.MinxinLedger.recordAndApply`。
  这批不是账目洁癖——trueIndex 只是聚合缓存，`aggregateTrue()` 每次按叶子人口加权重算即冲掉直写，
  **带地图剧本里这些效果一直在静默蒸发**；走闸后 delta 落叶子+按源封顶(P-ZV7)才真正落地。
  kind 映射：加派/减税/税负感→taxation·赈济→disasterRelief·粮价→priceStability·狱案→judicialFairness·
  科举/恩科→socialMobility·内帑德政→imperialVirtue·其余系统专属 kind 走 _default(±20)。
  沙箱纪律：engine smoke 的 vm 沙箱须同载 tm-minxin-ledger.js（运行时同形态），否则效果静默跳过。
  剩 6 行另案：endturn-apply 的 mx.revolts 起义链(3)·game-loop 存档迁移 perceivedIndex(1)·office-panel/corruption 的 byClass 阶层矩阵(2)。

**v3·别名写探测（2026-07-04·全面审查定罪的守卫盲区）**：`_adjAuthority` 用 `var G = global.GM` 间接写
trueIndex，31 处调用点的民心蒸发 bug 在正则棘轮眼皮下活了数月——v2 只认字面 `GM.`/`P.`。v3 识别两类且仅两类：
- **全量别名** `var G = GM | global.GM | window.GM | root.GM | getGame()`（工厂名单在 `config.gmFactories`）→ 写经 G 与写 GM 同计、root 归属照旧
- **子树别名** `var g = GM.guoku`（RHS 单层成员·无下标；源亦可为已识别全量别名）→ 写经 g 计入 gm:guoku，可触发「闯入」
- 明确不追：元素别名（`var ch = GM.chars[i]`）、函数参数传递、动态成员（`v[key]=`·_adjAuthority 那半层仍在盲区）——宁缺勿噪
- v3 重基线：GM 直写 3096→4568（+1472 处别名写现形）·子树 742→885 棵(单写主 601)·guoku-engine 213/corruption 147/neitang 132 全部入册
- 阴性测试过：别名新写 +N、`var x=GM.sub` 闯入、新开子树三类全能拦

### ② 依赖显式化 `lint-dep-graph.js`（不上构建·v2）
把隐式依赖量成图：每文件的 provides/requires → `dev-tools/arch-guard/deps-manifest.json`。

- **拆分/改名前必查**：`node scripts/lint-dep-graph.js --who TM.ClassEngine` 看各入口引用面。
- 守卫：各入口**新增**悬空引用（引用了但该入口全集无人定义的 `TM.X`）即 FAIL——typo 或忘挂 `<script>`。
- **v2 三入口分集**：index.html(359脚本/165命名空间) · editor.html(36/38) · map-editor.html(77/2) 各自建集各自判；
  跨入口引用（如编辑器探测游戏侧 TM.ClassEngine）单独标注 crossEntry，多为带守卫的合法探测。
- **v2 TM 别名识别**：`var TMNS = root.TM;` 后 `TMNS.Foo=...` 算定义 TM.Foo。别名 RHS 必须是 TM 本体且随即终结——
  `window.TM && window.TM.X` 这类子树探测严禁误认（首版踩坑：悬空 9→67 全是这噪声）；别名只认定义不认引用。
- 存量欠账：index 7 / editor 8 / map-editor 2，全数经逐个裁定为「带兜底分支的防御探测」或「已注释的遗留 API(R143 删的 TM.register 族)」。
  已修真 bug：`TM.AISchema` 死引用(5af11599)、`TM.utils` 谎言自检(c8ef7afa)。
- 局限（诚实声明）：逐行正则非 AST；TM[动态key] 定义看不见（dynamicDefiners 兜底）；顶层加载顺序违例判不了，属 v3。

### ③ smoke 统一 runner `run-smokes.js`
676 个 smoke 的发现式入口：并发、超时熔断、失败聚类、报告落 `dev-tools/arch-guard/smoke-report.json`。

```
node scripts/run-smokes.js --grep tinyi            # 按主题跑（可多个 --grep 取并集）
node scripts/run-smokes.js --list                  # 干跑看选中
node scripts/run-smokes.js --jobs 8 --timeout 90   # 全量扫荡（大改后/周期性）
```

- 与 `verify-all.js` 分工：verify-all = 手工精选快速门禁（fail-fast）；run-smokes = 全量/按主题扫荡。
- 尊重 `scripts/_<TOKEN>_NORUN.flag`（并行会话施工标记）与 `arch-baselines/smoke-skip.json`；`--all` 无视。
- `suspect` = 退出码 0 但输出带 FAIL → 该脚本忘了 `process.exit(1)`，见报告补上。

### ④ 巨石棘轮 `lint-file-size.js`
纪律（2026-07-04 owner 改判：**立项拆**）：按「保序切割」范式逐座拆；新文件不许超 3000、旧文件只许降。

**保序切割范式（2026-07-04·tm-tinyi-v3 首拆定式）**：适用于顶层全局函数型巨石（非 IIFE 包裹型——那种走 alias 范式）。
1. 探结构：`grep -c "^(function"` 数 IIFE·`═══` 分节地图·确认安装器 IIFE 皆轮询式（跨文件时序安全）
2. 只切**文件头部连续段**（sibling 排原文件*之前*）或**尾部连续段**（排*之后*）——执行顺序与拆前逐字节等价·行为漂移=0（按构造）
3. 切割脚本必须带**逐字节重组校验**（四段按原序拼回 === 原文件）+ 备份 `backups/<日期>/X.js.pre-split` + CJK token 守恒比对
4. sibling 头部补 `'use strict';`（原文件顶层 strict 覆盖全文·切出段须保持同语义）
5. smoke 装载器 codemod：`read('X')`→三段串接·`load('X')`→三连·`readFileSync`→串接（源串断言与 vm 执行两用·顺序=拆前）
6. 基线三连落：file-size/gm-writes（写手改名）/dep-graph（provides 迁移）·受影响 smoke 族全跑+终局全量
首拆战果：tm-tinyi-v3.js 7101 → 4090 + persona 1637 + parties 1389·90/90 受影响族全绿。
第二拆：tm-chaoyi-changchao.js 5286 → 2582 + adapter 1341 + flows 1379。
三至五拆：tm-keju-runtime 3781→1773+keyi 2018·tm-wendui 3518→2531+persona-views 997·tm-npc-decision 3475→2396+ai-driven 1089。
第六拆：tm-patches 3390→1709+start 1693（剧本启动链·**顶层函数型收官**）。
第七拆：tm-economy-engine 3056→2062+currency 1005（§A+§B 两**整只独立 IIFE**头切——
IIFE 自执行=装载期语句·保序随行即可·**alias 范式只在单只 IIFE 内部共享闭包被切开时才需要**）。
第八拆（tinyi 二切）：tm-tinyi-v3 4091→2984+edict-personnel 1119（§9 草诏拟旨+§10 廷推·三片变四片·
已有分片序列里插新片=codemod 对旧串接的中项再改写·顺序自然保持）。
★codemod 军规（v3 定稿·scratchpad codemod-split-smokes.js 已参数化）：**行级幂等**（该行已含
本次 sibling 名才 skip——文件级 skip 挡同文件第二装载点·跨拆次串接改写靠只查本次 sibling 放行）。
覆盖形：`read('X')`/`src('X')`/`load('X');`/`load(BASE,'X');`/`fs.readFileSync(path.join|resolve(BASE[,'seg'…],'X'),'utf8|utf-8')`/
`FN(path.join|resolve(BASE…,'X'))`。多段基底（`ROOT,'web'`/`__dirname,'..'`）第六拆抓获。
非标形手补：文件清单数组（official-scenario-smoke）·路径表（calibrate 工具）·白名单按文件名记账的
lint 型 smoke（faction-binding-lint 五条豁免随代码迁档）。
巨石分诊三类：①顶层函数型→本范式（**已清零**）；②IIFE 包裹型=整文件单只 IIFE(endturn-ai/
ai-change-applier/content-manager/ai-infra/endturn-followup/keju-paradigm-panel/phase8族/
editor-authoring-agent 两件·已 grep 逐一确认皆单只)→alias 范式专项(见记忆 feedback_large_file_split_paradigm)；
③单函数巨石(tm-endturn-apply 的 writeBack=125..5880 一根函数·§1-10 全内联段)→切割即重构·
须专项设计勿套本范式；tm-endturn-prompt=范式反例(prompt 拼接型)不拆；tm-player-core=并行会话禁区。

- 超 3000 行入基线（2026-07-04 立项拆八连后余 13 座，最大 `tm-endturn-apply.js` 5954 行）；涨超 +100 行预算 FAIL，预算内只提醒。
- 阈值/预算在 `arch-baselines/file-size.json` 的 `config` 里调。

**队列余账·设计已勘（2026-07-04·实施待下刀）**：
- ✅ gm:qijuHistory（2026-07-04 四还·已实施）：新立 `tm-qiju-ledger.js` = `TM.Qiju.record(content,opts)` / `recordEntry(entry透传形)`。
  55 处 unshift/push 经 codemod 换头（对象字面量原样保留·diff 最小）；cap 归一 `TM.Qiju.CAP=240`（三处散装 trim 退役）；
  hongyan 诏书 push 破序修正（「即时可见」终于置顶）；date/time 兜底归一。挂 index.html + editor.html 双入口
  （依赖图 v2 首战：抓到 mechanics 系在 editor 入口悬空）。余 13 「写手」皆 init 保读行/御批批注/owner 本体·非条目追加。
- ✅ gm:_chronicle（2026-07-04 五还·已实施）：`TM.Chronicle.record(entry)` 并入 tm-qiju-ledger.js（史官写口之家）。
  87 处换头（codemod 83 + 手工 4）。**契约与 qiju 相反·收口时逐读者核过**：push 时序（读者全是 filter/find 全量扫·
  keju-reformer-bio 按 reformId 反查老条目）→ 故【无 cap·忠实现状】——无界增长的归档策略属 owner 设计题；
  四处 unshift 混写（memorials/office-panel/hongyan/endturn-edict 的人事启程/鸿雁遇险条目插头部）随收口归一为时序 push。
  ★工程教训：写口 IIFE 须 **globalThis 优先**绑定——`global.window={}` 裸 mock 的 require 沙箱会把 TM 劫走(smoke-h-school 之鉴)；
  ★顺手修 smoke-h-school 谎言退出码(有 FAIL 仍 exit 0·runner suspect 机制首杀)。
- ✅ gm:vars（2026-07-04·v3.1 按 key 细分权属·争抢队列末棵收束）：字面键升格伪子树 `gm:vars[键]`
  （复用闯入/新开机器·\uXXXX 键与明文归一）·动态键归 `vars[<dynamic>]` 走总量棘轮·裸 `GM.vars=` 整袋写留原根。
  分解结果：字面键写手仅余 威望←paradigm-panel·边事←wuju（无引擎普通变量·vars 即真值·合法锁权属）
  + 民心/皇威 两组**死镜像主路径写**当场定罪即修：童子科祥瑞民心(从未落地→MinxinLedger)、
  勤政/怠政皇威±(从未生效→AuthorityEngines.adjustHuangwei)·各留沙箱兜底。
  新变量键未经裁定即写 → 「新开子树 gm:vars[新键]」红。
- ✅ gm:chars 数组级（2026-07-04·TM.Roster 名册写口·争抢队列最后一棵收束）：`TM.Roster.addChar / removeChar`
  （住 tm-indices.js=索引娘家·owner 已登记）。此前 22 个造人 push 点各自为政——push 后 charByName 索引/
  图志名册缓存的配套动作漏一处=新人 findCharByName 走线性扫(其 fallback 注释即此病自白)/图志看不到(策名之鉴)。
  单口收齐 push+索引+缓存失效·codemod 换头(条件表达式头·变量/字面量两形通吃·沙箱回退保留)。
  字段级(ch.loyalty 等)明确不收——loyalty 已有 adjustCharacterLoyalty·其余属各系统语义。
  剧本装载(tm-patches 批量 GM.chars=)=load owner 性质不迁。★editor 入口 TM.Roster 悬空=带兜底防御探测·已裁定入基线。
- ✅ gm:neitang 外部金流（2026-07-04·内帑对称写口）：`FiscalEngine.spendFromNeitang / addToNeitang`
  （语义与国库口一致：reconcile ledger↔标量·尽扣记欠·sink/source 记账·syncAccountScalars 同步镜像）。
  八处外部散写迁入：赐金(wendui)/科举补贴(keju)/宫廷俸禄+银钱调度(economy)/内帑侵吞+追赃(corruption)/
  抄没+无嗣归公(char-economy)·各留沙箱兜底。neitang-engine 本体(120 写)=owner 级·两引擎合账另议。

## 增补守卫（四刀之后·随拆分战役立）

### ⑤ 控制字节 `lint-control-bytes.js`（2026-07 前后入伞）
源文件禁藏控制字节（bash 转义把 `\b` 变退格一类事故的下游防线）。

### ⑥ 拆分装载序契约 `lint-split-contracts.js`（2026-07-04）
每座已拆巨石登记 `[before..., origin, after...]` 家族序列，要求在对应入口 html 的
`<script src>` 顺序里**连续且按序**出现，且每片恰装载一次。保序切割/bucket 范式的
行为等价性全押在装载序上——挪动或插队即红。新拆一座 = 契约加一条（收尾步骤之一）。
契约覆盖入口：index.html / editor.html / preview（家族清单的单一真相源在本文件）。

### ⑦ 拆分家族缓存戳一致 `lint-split-stamps.js`（2026-07-06）
同一家族在同一入口的所有成员必须共用同一 `?v=` 戳。病根：旧戳 origin 命中缓存 +
新 sibling 现取 = 「半旧半新」装载，bucket 成员缺失即崩（治理刀曾手工 bump 十座）。
纪律：**改拆分家族的任何一片，整族 bump 同一新戳**。历史分歧走豁免基线
`split-stamps.json`（棘轮只减不增·当前=空）。附带全入口重复装载检测（零基线）。

### ⑧ smoke 拼接序 `lint-smoke-family-order.js`（2026-07-06）
scripts/ 下任何脚本以字符串提及同一拆分家族 ≥2 个成员时，首次提及顺序必须与契约序
一致（read 拼接/readFileSync/vm/loadMany 各形通吃）。病根：拼接序错的 smoke 纯正则
断言照样全绿，但作为装载序防腐测试不可信（Codex 复审第十八拆曾抓 15 处）。
豁免基线 `smoke-family-order.json`（棘轮·当前=空）。

### ⑨ 设计令牌 `lint-design-tokens.js`（2026-09-25·美术宪法第0刀）
[美术宪法](art-constitution.md) 规定颜色和字号只从 `styles.css` 的令牌表里取。本守卫按文件统计**写死的颜色**
（`#rgb`/`#rrggbb` 等十六进制与直接写数字的 `rgb()/rgba()/hsl()/hsla()`）和**写死的字号**（`font-size: 12px`、
`fontSize = '12px'`），基线只许降不许升，新文件从 0 起算。第0刀基线：写死颜色 12564、写死字号 5511，分布在 142 个文件。

- 文件集：index.html 挂载的运行时 JS（与其他守卫同源）+ index.html 链接的样式表 + 运行时 JS 按文件名动态加载的样式表（如常朝）。
- 不计：令牌定义本身（`--名字: 值`）、`var()` 引用、注释、带 `design-ok` 标记的行（确经裁定的例外，如图标插画设色）。
- 超基线 FAIL，处置：改用令牌；确属例外 → 该行加 `design-ok`；还了账或拆分挪了代码 → `--update` 重写基线（拆分收尾的基线连落从三连变四连）。
- `--top 15` 看欠账大户，`--list <文件>` 逐行看某个文件里被计入的写法（收令牌时用）。
- 阴性测试过：样式表新增一条写死颜色和字号即红，同一行加 `design-ok` 即放行。

### runner 附注：flake 自愈（2026-07-06）
`run-smokes.js` 全量并行下 DOM-stub/AI 超时类假阳性反复出现——失败 ≤15 个时自动
**串行重跑一次**，过了标 `flaky`（汇总/报告单列，不静默掩盖；反复上榜的去查真因）。
`--no-retry` 恢复严格单跑。失败 >15 视为真损坏不重跑。

## 基线文件（要进 git）

`scripts/arch-baselines/{gm-writes,dep-dangling,file-size,smoke-skip,split-stamps,smoke-family-order,design-tokens}.json` —— 棘轮的账本，删了守卫就瞎。
`dev-tools/arch-guard/` 下是生成物（依赖清单/smoke报告），不进安装包，可随时重生成。
