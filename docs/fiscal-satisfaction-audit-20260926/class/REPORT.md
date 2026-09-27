# 阶层满意度只读审计 · 2026-09-26

## 结论与范围

当前工作树可独立复现普遍暴跌，不能把玩家反馈直接归咎于操作。最明确的问题是欠饷/地方风险通过关键词匹配扩大到不相关阶层；开局还会提前进行一次役政结算。正负共用绝对额预算会阻挡随后救济，这是恢复设计和调用顺序问题，不能说成加减号误写。

复现从仓根天启官方 JSON，经项目完整 `doActualStart` 启动。在 Node VM 内运行真实社会引擎，未调用真实 AI，未修改游戏/存档/剧本。六轮实验只调用 `PartyClassActionScheduler.scheduleBeforeSubmit` 和 `SocialFoundation.tick`，包括它们自身的民心等反馈；没有运行整套经济、军队和 AI 回合，也没有输入玩家政策。故下表是隔离实验，不能冒充玩家存档回放或完整六回合结果。截图未给满意度历史或存档，无法确定玩家具体哪次事件贡献多少。

## 1. 明确错误：欠饷信号的阶层匹配过宽

`tm-social-political-signals.js:1081` 的 `inferClassImpacts` 将原文关键词命中与 Ecology 分数取最大，只要大于零就采用完整满意度扣分。

`tm-party-class-ecology.js:114` 的类别词表把“饷”归入税类；`categoriesForTokens`（243）将“军饷/欠饷”同时归为 `tax,military`，将“地方”同时归为 `land,local`。`scoreClass`（399）又把税与田互相折算。于是“僧道免赋”等与军饷无关的词也能匹配。静态描述、身份、诉求都参与匹配（`tm-social-political-signals.js:1052`），不存在受饷身份或地域资格检查。

严格最小对照：取官方九阶层原数据，只设置 `military.arrearsRatio=0.6`。

- 原生 Ecology 开启：`military-wage-arrears` 命中全部九阶层，各请求 **-5**。
- 仅在 VM 内禁用 Ecology 匹配：同一信号只命中 **军户**。
- 商人、僧道军饷匹配分均为 1，宗室为 0.7；不需要玩家操作便会误扣。

独立命令：`node docs/fiscal-satisfaction-audit-20260926/class/probe-semantic.cjs`。
完整证据：`semantic-results.json`。

完整开局社会链首轮发出三类压力：

| 信号 | 原始扣分 | 原始命中 |
|---|---:|---|
| corruption-high | -6 | 士大夫、缙绅、商人、工匠、僧道 |
| military-wage-arrears | -5 | 全部九阶层 |
| local-revolt-risk | -8 | 全部九阶层 |

`readLocalRevoltRisk`（`tm-social-political-signals.js:1277`）取玩家地区最大风险，并向全国阶层发信号；`readCorruptionIndex`（1361）也取各部门最高值。开局全局腐败约61.28，最高内廷部门92，使腐败信号按92生成。多层扣分合计很快用满14预算。

**建议：** 满意度数值落账用结构化身份、军饷关系、地域暴露判断；广义词类匹配只负责议程相关性。对地方压力保留地理范围与人口权重，避免最坏一个地方给全国所有身份整额惩罚。单独提高预算不会修正误扩散。

## 2. 已证恢复缺陷：负向压力先耗尽预算，随后惠政被裁零

`tm-class-engine.js:827` 计算剩余预算，833以 `Math.abs(approved)` 消耗它。并不是注释811所写的“净变动封顶”。严格调用结果：商人50，先调用-14得到36，再在同回合请求+10，批准0，仍为36。

前置扫描发生在 `tm-endturn-core.js:92` 起的提交前阶段，主推演及政策结果随后才应用。故初始压力可先占完预算，挤掉后续政策改善。既有 `smoke-class-satisfaction-guard` 还明确测试过“+12之后-12只能批准-2”，说明绝对额预算是现有设计；它与当前调用顺序组合形成恢复偏置，不属于新发现的符号笔误。

**建议：** 明确采用净变动上下限、正负独立预算，或对恢复另留额度；应先定规则，再加“先坏后好/先好后坏等价”和跨回合恢复测试。

## 3. 明确开局额外结算：自耕农26直接变12

官方真源的自耕农初始满意度26；完整启动后仍为第1回合，却已变12。探针对启动时 `ClassEngine.gateSatisfaction` 包装记录显示来源 `renli-corvee-grain`、实际-14。

调用来源：`tm-patches-start.js:435-436` 只有 `tm-population-ledger/2` 剧本走纯派生 `Renli.prime`，当前天启走 `Renli.endturnTick`。其真实结算在 `tm-renli.js:417`，人口加权信号于434通过总闸落账。开局预热因此消耗一轮满意度预算。该路径注释声称开局种账、幂等，与数值副作用冲突。

**建议：** 所有剧本启动统一使用不推进时间、不扣满意度的派生/prime路径，添加“官方开局满意度不被结算改写”的断言。保留剧本既有低满意度设定。

## 隔离实验轨迹

| 阶层 | 正式开局 | 第1次社会链 | 第2次 | 第3次 | 第4次 | 第5次 |
|---|---:|---:|---:|---:|---:|---:|
| 宗室 | 62 | 48.9 | 36 | 22.9 | 9.8 | 0.9 |
| 士大夫 | 30 | 16.9 | 3.8 | 0.9 | 0.9 | 0.9 |
| 缙绅 | 64 | 50.88 | 37.78 | 24.68 | 11.58 | 0.9 |
| 自耕农 | 12（原值26） | 12.9 | 0.9 | 0.9 | 0.9 | 0.9 |
| 佃农与流民 | 10 | 0.9 | 0.9 | 0.9 | 0.9 | 0.9 |
| 商人 | 50 | 36.9 | 23.8 | 10.7 | 0.9 | 0.9 |
| 工匠 | 36 | 22.9 | 9.8 | 0.9 | 0.9 | 0.9 |
| 军户 | 22 | 8.9 | 0.9 | 0.9 | 0.9 | 0.9 |
| 僧道·外籍 | 55 | 41.9 | 28.8 | 15.7 | 2.6 | 0.9 |

对照：只运行结构回归，第三次时宗室61.57、士大夫32.7、商人50.86，多数阶层恢复。只运行压力信号而无结构回归，第三次分别23、0、8。大幅下跌不是结构回归自身造成。

未处理的真实腐败、欠饷、灾难每回合造成损害属于机制/调参选择，不能只因“重复”就定 bug。实际扫描按 `turn,source,kind` 去重（`tm-social-political-signals.js:1425`）：同回合同source再次扫描不发；换回合可重新发。当前实验未发现同一次scheduler必然双跑。跨source可重复，但正式主路径是scheduler与fallback二选一，不能据此断言玩家重复结算。

结构恢复实际上限+0.9、恶化下限-1.92（`tm-social-foundation.js:382-395`），文件开头仍写±1.2；它远弱于每回合-14事件预算，是现有数值放大因素。

## 验证与交付

```text
node docs/fiscal-satisfaction-audit-20260926/class/probe-class.cjs
node docs/fiscal-satisfaction-audit-20260926/class/probe-semantic.cjs
node web/scripts/smoke-class-satisfaction-guard.js          # 29 PASS, 0 FAIL
node web/scripts/smoke-class-satisfaction-signal-gate.js    # 11 PASS, 0 FAIL
```

主探针结果 `class-results.json` 含每次classes、满意度近账、parties、partyState、联动记录、signals及scheduler明细；`startupGates` 是开局真实过闸前后值。所有正式代码未改。现有smoke只证明单回合封顶有效，未覆盖真实天启压力的跨身份误匹配或多回合恢复。
