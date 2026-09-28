# 党派数值下降只读审计

日期：2026-09-26。检查当前工作树，没有修改生产代码、存档、API 配置或 Git 索引，没有调用真实模型。

## 结论

确认一处会放大党派凝聚力下降、吞掉回升的数值 bug：阶层向党派传导时，对旧凝聚力使用 `parseInt`。阶层端的大幅下降经过支持关系传入党派，再被这处截断额外扣数。

另确认 AI 校准器允许绝对凝聚力直接设零、同一结果重复党派条目累加。这是独立的可触发写入缺口；没有玩家存档或 AI 回包，不能断言玩家遇到了这条路径。

当前正式右侧栏党派卡显示“影响”，近账涉及“凝聚/影响”；天启剧本还保留 `party.satisfaction`，但本次无操作隔离试验中它始终不变。不能把它、凝聚力、阶层满意度视作同一数值。

## 1. 已复现的截断 bug

- `web/tm-class-engine.js:475`：`var oldC = parseTurnNumber(ps.cohesion);`
- `web/tm-class-engine.js:212-215`：该 helper 使用 `parseInt(v, 10)`。
- `web/tm-class-engine.js:454`：传导量是阶层变化 × 亲和度 × 权重，因而本来就常有小数。
- `web/tm-class-engine.js:477-503`：从已经截断的旧值继续写入引擎账和 canonical。

用当前天启官方“士大夫→东林党”支持关系调用生产入口两次，默认亲和度 0.5，起始凝聚力 82：

| 两次阶层变化 | 正确党派结果 | 实际结果 | 影响 |
|---|---:|---:|---|
| 每次 -1 | 81 | 80.5 | 额外扣 0.5 |
| 每次 +1 | 83 | 82.5 | 第二次回升被吞 |

同一探针仅在 VM 中把该行改为 `Number(ps.cohesion)` 后，两方向分别得到 81、83。磁盘生产文件未改。另因近账写的是请求传导量，小数截断损失不会体现在记录的 `cohesionDelta` 中，导致近账相加也对不上实值。

建议：旧凝聚力使用有限数校验后的浮点值，保留 0；回执和近账写实际批准增减。补两笔小数负向、正向与边界数值回归。

## 2. 官方开局的持续压力会传入党派

引用同次审计的 `../class/class-results.json`：完整正式初始化天启官方剧本，冻结非社交状态，逐轮只执行真实社交调度器与 SocialFoundation，不运行 AI、不执行玩家操作，也不推进经济系统。这是因果隔离试验，不能称为玩家存档或完整六回合实玩。

| 凝聚力 | 开局 | 第1次 | 第2次 | 第3次 | 第4次 | 第5次 | 第6次 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 东林党 | 82 | 67.30 | 52.30 | 42.10 | 33.10 | 25.31 | 23.55 |
| 浙党 | 55 | 39.50 | 23.50 | 13.50 | 4.50 | 1.20 | 0 |
| 阉党 | 65 | 66.90 | 68.80 | 70.70 | 72.60 | 74.50 | 74.90 |

单跑 SocialFoundation 六次，七党凝聚力全部保持初值；接入压力信号后，士大夫与缙绅持续下降，东林与浙党被连带扣除。七党的旧 `satisfaction` 字段全程不变，影响力总体上升。因此“所有党派满意都下降”不是本试验复现的精确行为。

压力单跑第一轮，东林近账的传导合计 -14，实值从 82 到 66.5，即 -15.5；多扣的 1.5 来自上述逐笔截断。压力包括腐败、军队欠饷、地方民变风险，细节见阶层审计。

传导接线：`web/tm-social-political-signals.js:387-392` 调用 `applyClassPartyCoupling`；`web/tm-class-engine.js:438-454` 默认权重 1、默认亲和度 0.5，逐支持阶层累计，缺少每党每回合总预算。两阶层各扣 14，在默认亲和度下会使同一个党累计扣 14。这个叠加公式属于现有机制；过广压力传播、恢复被预算阻塞和截断则需分开修正，不能都归咎于玩家。

## 3. 校准器另有一次性归零缺口

- `web/tm-party-class-llm-calibrator.js:757-761` 只给单条 `cohesionDelta` 限幅 ±15。
- `web/tm-party-class-llm-calibrator.js:764-765` 直接接受绝对 `cohesion`，绕过渐变限制。
- `web/tm-party-class-llm-calibrator.js:1103-1105` 逐条应用 `party_updates`，没有同党合并或整回合累计预算。

调用生产 `applyResult` 的合成响应复现：阉党 65 → `cohesion:0` → 0；或者单响应内重复五条 `cohesionDelta:-15`，同样 65 → 0。不是模型真实回包。

建议：将绝对值转成受限增量，按党派 ID 合并同批更新，跨本回合校准保留累计预算，并把原因及实际增减同步至党势近账。

## 验证

独立最小探针：

```powershell
node docs/fiscal-satisfaction-audit-20260926/party/probe.cjs
```

结果：6 组审计案例完成，断言通过；详见 `probe-results.json`、`probe.log`。

以下现有 smoke 全部 exit 0（均为本地离线／合成模型返回）：

- `node web/scripts/smoke-party-class-drift-bidirectional.js`：19/19。
- `node web/scripts/smoke-party-class-llm-calibrator.js`：PASS。
- `node web/scripts/smoke-party-class-action-scheduler.js`：PASS。
- `node web/scripts/smoke-party-opening-standing.js`：104 assertions。
- `node web/scripts/smoke-class-party-bidirectional.js`：34 assertions。
- `node web/scripts/smoke-party-class-closed-loop.js`：PASS。
- `node web/scripts/smoke-social-foundation.js`：69/69。

这些 smoke 通过，不代表已覆盖此次小数截断、校准整批累计或六轮持续压力问题。本次只查因，未修复、未发布。
