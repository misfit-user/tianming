# 官制全面升级 · 开关与 Playtest 指南（2026-06）

把官制从「展示 + 给 AI 提示」层改造成**有确定性机械后果的活制度**。11 个机制全部 **flag 默认关 = 零回归**（①职权舆图除外，已 flip 默认开），各刀 smoke 调真函数验证。

启用任一开关：控制台或存档里设 `P.conf.<flag> = true`（或 `P.ai.<flag> = true`）。一键全开官制活化四刀：`P.conf.officeActivationEnabled = true`。

---

## 怎么 playtest（建议顺序）

**第一档·纯增益/低风险（可直接开，感受官制「有重量」）**
| 机制 | 开关 | 开了之后看什么 |
|---|---|---|
| ①职权舆图（已默认开） | `officePowerPerceptionEnabled`（显式 false 才关） | 推演 prompt 里出现「职权舆图」：谁掌征税/调兵/监察、才德、履职/出缺 |
| 权臣复活 | `powerMinisterEnabled` | 久居首辅+高野心者 24 月后坐大：截留奏疏、自拟诏命、（皇权极弱时）篡位终局 |

**第二档·人事代谢（让官场会自己 churn）**
| 机制 | 开关 | 看什么 |
|---|---|---|
| 考课落地 | `officeReviewLandingEnabled` | 年度考课优等→功名升、劣等→功名降（rankLevel 真动）；连劣记数 |
| 才不配位反哺 | `officeSatisfactionFeedbackEnabled` | 能臣才高位卑→忠诚渐降、久郁「乞求外放」 |
| 致仕 | `officePersonnelTurnoverEnabled` | 高龄官乞骸骨→耄耋准致仕去位（可下诏起复） |
| 京察黜陟 | `officeJingchaEnabled`（**需考课落地+才不配位同开**才有信号可消费） | 每 3 年一察：黜屡劣庸才（功名罚降）、拔擢怀才不遇能臣（功名擢升） |

**第三档·有 balance 后果（建议单独逐个试、观察国库/吏治曲线）**
| 机制 | 开关 | 看什么 |
|---|---|---|
| 官位入阴谋 | `officeConspiracyEnabled` | 高官谋逆酝酿更快更隐秘、门生故吏更易拉拢 |
| 俸禄认人 | `officeSalaryHeadcountEnabled` | 冗官超编→国库俸禄开支真上升 |
| 履职度②（活化） | `officeDutyStateEnabled` | 失职主官→实征率↓腐败↑、称职→反之；起居注「履职结算」 |
| 权限门③（活化） | `officeAuthorityGateEnabled` | 掌征税主官出缺/失职→加赋实收打折、漏额中饱 |
| 改制裁定④（活化） | `officeReformAdjudicationEnabled` | 设衙门改制走廷议裁定、机械抵抗 band 防放水 |

**反应总线联动**：②③（及致仕/京察）的后果会写进 `GM._chronicle` 并被「天下牵动·因果综述」前景化——官制成为反应总线的一个域，AI 推演会顺着「官制↔财政·吏治/人事」的因果叙事。

---

## 依赖与注意
- **京察**消费考课的连劣 `_reviewPoorStreak` + 才不配位的 `_seeksRemoval`——这两个上游开关（`officeReviewLandingEnabled` / `officeSatisfactionFeedbackEnabled`）不开，京察就没信号可察。
- 致仕/京察对君上（isPlayer）一律跳过；致仕可下诏「起复/召回」复出（既有通道清 `_retired`）。
- 京察的引擎动作是**保守裁示**：只「降/擢功名」（可逆·角色仍在朝），**绝不擅自革职去职**——硬罢仍交 AI/玩家。
- 所有 balance 改动默认关，确认手感后再逐个 flip 进默认（参照 `worldReactorBattleEnabled` 的节奏）。

## 相关 smoke（回归用）
`smoke-s1-power-minister-revival` / `smoke-s1b-review-landing` / `smoke-s1c-office-conspiracy` / `smoke-s1d-official-disaffection` / `smoke-s1e-salary-headcount` / `smoke-s2-office-powermap` / `smoke-s2b-duty-authority-reform` / `smoke-s2c-office-digest-wiring` / `smoke-s4-office-retirement` / `smoke-s4b-jingcha`
