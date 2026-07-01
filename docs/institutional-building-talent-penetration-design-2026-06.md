# 制度性建筑 · 人才范式渗透引擎 详设（2026-06）

> owner 命题(2026-06-30)：全面完善天命**建筑系统**，使「有司核验能说明真实现实阻力」、
> 建筑「能实现广泛的、不能被数据量化的全局效果」。母题=**新式学校**——它的作用不是 +民心/-腐败/+钱，
> 而是持续地为军政财农医工各业供给技术人才、催生新文化与新阶层；若一定要落一个效果，便是它的成功运行
> 设立了「改革成功率↑」「科技推广成功率↑」「群众对实学认可度↑」这样的**持续性全局规则**——
> 间接、全局、难量化，**阻力亦是全局的**(传统势力抵制)。
>
> owner 纠偏一(现实逻辑铁律)：全局修正器**不许凭空 +X**。须有「**师生网络/人才**」这一**有数量的载体**：
> 庞大网络一年毕业不过几千、还需在岗历练数年乃至数十年方能发挥；旧式人才数十万~数百万；
> 数亿人口之国非几千新人能改变——**但日积月累，学校越多、毕业越多、影响越大，直到旧式人才被边缘化**。
>
> owner 纠偏二(防数字游戏)：渗透率**不能与学校数量挂钩**。狂建没有灵魂的空壳学校——没合格师资、
> 没对应产业、没就业岗位——只会**毕业即失业**，渗透率不增反惹动荡。**渗透率本身的逻辑就该是复杂的、
> 与许多东西密切关联的**；学校只是培养人才，人才要真正发挥作用、实现渗透，还需诸多条件。
>
> owner 纠偏三(范式自由)：**「实学」只是举例，玩家完全可能搞别的「学」**。引擎**绝不预设任何具体的学**，
> 「实学/西学/格致/新军学/玩家自创的架空学派」一律平等，由玩家描述 + AI 核议涌现。

---

## 〇 · 一句话设计

建筑系统新增「**制度性/变革性建筑**」范式：建筑不直接产出全局数值，而是向一个新建的「**人才范式渗透引擎**」注入年流量(毕业生)。引擎的核心抽象是**数据驱动、运行时可由玩家描述 + AI 核议动态创建的「人才范式(paradigm)」**——引擎不认任何具体的「学」。每个范式的人才,要穿过**师资质量 → 产业吸纳 → 制度空间**层层瓶颈、再经在岗历练,才转化为**有效渗透**;渗透格局派生**因范式而异的全局软修正**(influenceProfile,由 AI 据该学性质判定)注入 AI 推演语境(非写死数字),并与**双向全局阻力**(旧势力反扑 / 失业动荡)耦合。**有司核验**相应补「社会政治可行性」一档。

每个全局效果都能溯源到「**人 → 培养质量 → 吸纳 → 历练 → 制度空间 → 有效渗透 → 影响**」,无任何凭空数字,无任何写死的「学」。

---

## 一 · 现状与缺口（已 hash 双信道确证）

| 文件 | 是什么 | 本设计如何用 |
|---|---|---|
| `tm-building-works.js`(501行) | 建筑工役引擎:`WHITELIST` **地方量化账**、`effectsStructured`+费效封顶、`applyCompletion`/`appliedDelta` 可逆、`tick`/`ledger` | **第一刀**扩非地方账效果类型 `talentSource`;沿用 appliedDelta 可逆、ledger 可观测 |
| `tm-custom-build-agent.js`(459行) | 有司核议 agent:`inspectRegion` 勘地、`appraise` 多步核定、谏官对抗审、`approveBuild` 准奏→扣银→注入推演 | **第二刀**增勘社会政治阻力 + **核议时判定该校教什么「学」、利于什么、是否新范式** |
| `tm-region-magnate._buildingPolitics`(180行) | 营造贪墨+徭役怨气(**地方级**) | **第三刀**地方侧已有;补**全局双向阻力** |
| `tm-keju-school-network.js`(1879行) | 私学/书院 mini-system(`GM._schoolNetwork`、5层、tier、山长NPC、生命周期) | **范式照搬**(状态容器+tier+flag gate+standalone runner);其书院存量是「既有正统」范式的一个来源 |

**三缺口**:①效果维度(无全局规则修正器类型)②核验维度(看不见政治阻力、不判范式归属)③阻力维度(无全局反弹、无失业动荡)。

---

## 二 · 核心：人才范式渗透引擎（`tm-talent-cohorts.js`，新建）

### 2.1 跨朝代 + 玩家自由铁律（红线）

引擎认的是**抽象的「人才范式之竞争」**,**不认**「实学/新学/西学/科举」等任何专名。所有「学」的身份、命名、影响,**全部数据驱动**:剧本 preset 既有正统、玩家游戏中描述新学、AI 核议判定。明清/架空专名只进剧本与玩家输入,**绝不进引擎**。

### 2.2 「人才范式(paradigm)」抽象——空壳,内容涌现

```js
// 一个 paradigm = 一种「学/人才范式」。引擎只提供结构,不预设任何具体的学。
{
  id: 'pdg_3',                 // 引擎生成
  label: '<玩家/AI 命名>',      // "格致之学"/"泰西新学"/"经世实学"/"旧学"… 完全自由
  kind: 'established'|'emergent',// 角色,由 stock 规模与历史自然涌现(非硬预设)
  // —— 存量动态 ——
  stock: 0,                    // 成熟在岗、已真正发挥影响的人数
  trainingCohorts: [],         // [{ enteredTurn, n, quality }] 历练梯队(毕业未成熟·质量已烙印)
  unemployed: 0,               // 知识失业存量(吸纳不足的溢出)
  decayRate: 0.015,            // 世代自然致仕/凋零
  maturityTurns: 60,           // 毕业→成熟历练回合(≈数年·按粒度校准)
  // —— 该「学」利于什么:由 AI 据其纲领描述判定,引擎不写死 ——
  influenceProfile: {          // 稀疏:这个学影响哪些全局维度、各几何
    // 例 格致之学 → { techPromotion: 0.8, industry: 0.6 }
    // 例 经世之学 → { reformSuccess: 0.7, governance: 0.5 }
    // 例 玩家自创 → AI 据描述给
  },
  // —— 吸纳需求:这个学的人才需要哪类岗位(决定吸纳瓶颈读哪些产业) ——
  absorptionKind: [],          // 例 ['industry','craft'] / ['military'] / ['governance'] / ['medicine']
  sources: {}                  // { 'bw_id': 年贡献人数 } 哪些学校在供给·可逆溯源
}
```

### 2.3 全局状态 `GM._talentCohorts`（数据驱动）

```js
GM._talentCohorts = {
  paradigms: {},      // 开放字典 id→paradigm。起步至多含剧本 preset 的既有正统(可空)
  seq: 0,             // id 生成
  history: []         // [{turn, byParadigm:{id:penetration}}] 增速/可观测
}
```

> 剧本 preset 可提供一个或多个 `established` 范式(科举经义/世袭门第/某架空正统·label 剧本定·stock 大)。新兴范式游戏中由玩家+AI 创建。也可全空(白纸开局)。

### 2.4 多瓶颈漏斗（每回合 `tick`·防数字游戏的心脏）

对**每个** paradigm 独立跑下列漏斗,**最窄处决定通量**,任一环缺失则卡死该范式:

**第0层·招生** — 学校(sources Σ)→ 年招生/毕业基数 `intake`。招生 ≠ 成才。

**第1层·师资瓶颈(培养质量)** —
- `quality = clamp(f(teacherCapacity / 在学规模, 师资素质), 0..1)`。
- 合格师资 `teacherCapacity` 来源:外聘(贵·少·剧本/政策)+ **成熟人才回流任教**(从该范式 stock 抽一比例——**自举**:早期 stock≈0 → 师资极稀 → 第一道死结)。
- 生师比超阈值 → quality 断崖。**毕业生质量在毕业当回合烙印进该 cohort,历练只增熟练不改质量(水货历练成熟练的水货)。**
- → 狂建学校不投师资:quality→低 → 后续有效渗透贡献趋近0。

**第2层·吸纳瓶颈(产业/岗位)** —
- `absorptionDemand = f(该范式 absorptionKind 对应的产业/机构规模)`:读 economyBase 工矿商贸、军备/新军、官制新政机构、医疗… **来自其他系统的真实规模**。
- `absorbRate = min(1, absorptionDemand / 合格毕业生供给)`。供>需 → 溢出转 `unemployed`。
- → 只育才不兴业:absorbRate→低 → 毕业即失业 → 渗透不增 + 失业动荡(2.7)。

**第3层·历练滞后** — 被吸纳者进 `trainingCohorts`(带 quality),满 `maturityTurns` 转入 `stock`。

**第4层·制度空间(旧势力压制)** —
- `institutionalRoom = clamp(f(全局政治阻力, 既有正统当道度, 改革推进度), 0..1)`。
- 旧势力强 → 新人压边缘岗 → 有效发挥打折。**与第三刀阻力、与「改革」耦合成正反馈飞轮**(改革→开空间→渗透→更挺改革),但须先破初始瓶颈。

**第5层·世代衰减** — 各范式 stock 按 decayRate 自然减(致仕/凋零);unemployed 也随时间流失(改行/外流)。

### 2.5 有效渗透率（非简单 stock 占比）

```
有效人才_i = ( Σ 成熟梯队人数 × 该梯队 quality ) × institutionalRoom_i
渗透率_i  = 有效人才_i / ( Σ_j 有效人才_j + Σ_k established_k.stock )
```

- quality 加权 → 水货不算数。institutionalRoom 动态乘子 → 政治环境放大/压缩发挥。
- 初期:几千×低质×受压 / 数十万 ≈ 趋零(「几千人改变不了数亿人口之国」)。
- 协同建设(师资+产业+空间)+时间 → 有效人才升、established 自然衰 → 渗透爬升 → 临界**非线性跃迁** → 旧式边缘化。

### 2.6 渗透格局 → 全局软修正（influenceProfile 加权·因范式而异）

```
全局修正[dim] = Σ_i ( 渗透率_i × influenceProfile_i[dim] )   // 跨所有 emergent 范式
```

- **不写死「新式学校→改革+科技+认可」**。某局玩家只搞军学,则只有 military/战力维度被推高;搞格致则 techPromotion。
- 修正→**分档标签+建议幅度区间**注入 AI 推演(非写死数字),让 AI 在玩家自由下给硬核裁决。**硬门**:修正是「成功率倾向」非「必成」。
- 分档(每范式各算):萌芽<5% / 渐显5-15% / 可观15-30% / 主流30-50% / 主导>50%。

### 2.7 第三刀 · 全局双向阻力

渗透是动既有格局的蛋糕,阻力有**两个方向**,玩家走钢丝:

- **右·旧势力反扑** `backlash = f(dPenetration↑, established.stock, 触动深度)`:上升越快、旧式越庞大,反弹越烈 → currentIssues(联名上疏「废祖宗成法」、攻讦、清议)+ 势力 aiStrategy/goal-stack(敌意↑、阻挠新学/裁学堂)。**临界后非线性瓦解**(旧式边缘化→反抗瓦解)。
- **左·失业动荡** `unrest = f(Σ unemployed, 占受教育人口比)`:受教育却失业者激进化 → currentIssues(学潮、激进思潮、人才外流)。建太快太空触发。

---

## 三 · 第二刀 · 有司核验补「社会政治可行性 + 范式判定」

`tm-custom-build-agent.js` 增维(不改既有物理/经济核验,叠加):
- `inspectRegion` 增勘:既有正统势力强弱(`_schoolNetwork` tier/`leadingGentry`/`specialCulture`/保守 posture)、士绅态度、本地产业(决定毕业生有无出路)。
- `appraise` 增判:① **变革阻力**(物理可行但触士绅根基/见效需数年人才积累)② **范式判定**——这校教的是哪个「学」?归入已有范式还是新建?其 influenceProfile/absorptionKind 为何?(据玩家 description 由 AI 给)。

---

## 四 · 第一刀 · 建筑侧接法

- `WHITELIST` 增 `talentSource`(路由,不写区划叶)。建筑 `effectsStructured.talentSource = { paradigmRef|newParadigm, annualGraduates }`。
- `applyCompletion` 识别 → 若 newParadigm 则 `registerParadigm`(玩家命名+AI 给 influenceProfile/absorptionKind)→ `registerSource(bw_id, paradigmId, 年毕业)`。记 appliedDelta 可逆。
- 费效封顶:年毕业数按造价/层级定档(`sanitizeStructuredFx` 加 talentSource 分支)。
- `category:'institutional'` 或含 talentSource → 走制度性分支(核验补维、运行担全局阻力);普通建筑**零改动零回归**。

---

## 五 · AI 在场（守命门）

三刀全局效果核心皆为**塑造 AI 推演/裁决语境**而非写死数值:
- 推演 prompt 注入「【人才与风气】」段:列各 emergent 范式 label/渗透档/年增/有效人才、各 established 存量、由 influenceProfile 派生的当前全局倾向、当前双向阻力。AI 裁决改革/科技/民意/动荡据此给硬核回应。
- 范式的 influenceProfile、阻力事件、核议判语,皆 AI 据语境涌现,非脚本写死。

---

## 六 · 工程化

- **依赖倒置**:S1 引擎把 teacherCapacity/absorptionDemand/institutionalRoom 设为**可注入输入**(ctx 提供或回调),核心逻辑不耦合具体字段名;真实接线(读 economyBase/官制/势力/改革度)放 S2。→ S1 纯净、node 可测、不依赖读污染中的现状代码。
- 回合粒度:确认月/季/年 → 折算 maturityTurns/inflow/decay。参数集中文件顶部、可调、标注校准。
- flag gate:`P.conf.talentCohortEnabled` **默认关** → 引擎 no-op、建筑 talentSource 不路由、核验不增维、无全局阻力 → **全系统零回归**。
- standalone mini-runner,复用 schoolNetwork/wuju 范式;node selftest + 真机验。
- 可观测面板:各范式渗透/成熟/在训/失业/年增/质量、established 存量、全局倾向、双向阻力。全程 appliedDelta/source 可逆;`.bak` 留底;不直写聚合(改源头)。

---

## 七 · 实现切片

- **S1**:`tm-talent-cohorts.js` 引擎骨架——init、`registerParadigm`/`registerSource`/`revokeSource`、`tick`(多瓶颈漏斗:招生/师资质量/吸纳/历练/制度空间/衰减)、有效渗透率、influenceProfile→全局修正→分档。瓶颈输入依赖倒置。flag gate。node selftest(验:无师资→质量低渗透不涨;无岗位→失业渗透不涨;齐备→涨;多范式;临界)。
- **S2**:建筑接法——WHITELIST/sanitizeStructuredFx 加 talentSource、applyCompletion/revertBuilding 路由、category institutional;**瓶颈真实接线**(teacherCapacity 含回流自举、absorptionDemand 读各产业、institutionalRoom 读政治/改革)。普通建筑零回归。
- **S3**:AI 推演注入「【人才与风气】」段。
- **S4**:第二刀核验增维(勘政治阻力 + 范式判定)。
- **S5**:第三刀双向阻力(backlash + unrest → currentIssues + 势力反弹 + 非线性瓦解)。
- **S6**:可观测面板 + 剧本 preset(既有正统 label/初始 stock)。
- **S7**:真机整局验(渗透滞后/瓶颈卡死/临界跃迁/双向阻力/AI 叙事跟人才态;另验非新式学校的「学」走同引擎证通用)。

---

## 八 · 风险与边界

- 平衡:渗透曲线/瓶颈阈值/临界点须真机调(太快无史感/太慢无获得感)。参数集中可调。
- 不与现役冲突:引擎独立于 schoolNetwork(后者管书院实体生命周期,本引擎管人才范式渗透),仅**读**其 tier 作既有正统强弱输入,不互写。
- AI 漂移防护:修正给「分档+建议区间」硬锚;硬门「人才不保证必成」写进 prompt;influenceProfile 经核议+可被谏官回调(防玩家描述一个学就声称全能)。
- 通用验:除新式学校,至少另验一玩家自定义「学」走同引擎。

---

*本案 flag 默认关、`.bak` 留底、node+真机双验、未 commit。S1 代码见 `tm-talent-cohorts.js`(本会话产出·因信道注入未能在此实跑验证·待干净环境复跑 selftest+hash 复核)。*
