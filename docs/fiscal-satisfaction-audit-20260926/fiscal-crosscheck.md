# 财政右栏交叉核查（2026-09-26）

## 结论

已用当前官方天启 JSON 和真实本地模块离线复现：民心财政消费者能把财政估算直接写成回合收入，国库余额和本回合入账流水不变，右栏随后显示虚高收入和结余。没有真实模型调用，也没有修改生产文件。

截图的精确来源仍需玩家存档：图 1 是第 4 回合冬月，图 2 是第 2 回合秋九月，两图中的 1746.3 万和 91.6 万不能当作同一期直接相减。

## 确定性写入路径

1. `web/tm-minxin-hard-links.js:207` 读取行政区 `fiscalDetail.claimedRevenue`，否则以人口乘系数计算；`244-246` 按民心、侵吞计算 `actualRevenue` 和 `remittedToCenter`，没有周期换算。`303-310` 汇总地方数值。
2. 当前官方天启 `fiscalConfig.accounting` 没有 `tm-fiscal-ledger/2`。因此 `web/tm-minxin-hard-link-consumers.js:107` 的统一财政真账分支不会生效。
3. `web/tm-minxin-hard-link-consumers.js:124-131` 直接把上述汇总写成 `guoku.turnIncome` 和 `guoku.monthlyIncome`，而且把计划额抬至不低于它。这里不写余额、`ledgers.money.thisTurnIn` 或国庫收入分项。
4. `web/tm-endturn-core.js:252-268` 的提交前流程确实先运行 HardLinks，再运行 Consumers；`275-285` 还会再维护户口硬约束。
5. `web/phase8-formal-rightrail.js:1486` 优先读 `guoku.turnIncome`，`1488` 直接用它减支出得结余。右栏不会核对真实入账流水。

这不是只能用伪数据演示的理论缺口：真实官方 191 个玩家叶节点传入上述模块后就会触发。

## 离线复现

运行：

```powershell
node docs/fiscal-satisfaction-audit-20260926/fiscal-crosscheck-probe.cjs
```

探针用真实官方区划与腐败数据，初始财政余额和流水是明确注明的合成输入。它不代表玩家原存档。

| 字段 | 调用前 | 调用后 |
|---|---:|---:|
| `guoku.turnIncome` | 915,557 | 49,738,189 |
| `guoku.monthlyIncome` | 915,557 | 49,738,189 |
| `ledgers.money.thisTurnIn` | 915,557 | 915,557 |
| `guoku.money / balance` | 95,000 | 95,000 |

官方区划的 `claimedRevenue` 合计 122,395,000；HardLinks 推导上解值 49,738,189。消费者把这个上解估算直接放进回合/月入显示字段。关闭据奏失真也照样发生。所有断言通过，探针同时输出输入和模块 SHA-256。

探针另用明确的合成 HardLinks 汇总值 17,463,000 验证消费者契约：写入后的收入为 1746.3 万，减合成支出 260.6 万后结余 1485.7 万，而余额和入账流水不变。这个检查只证明截图形态可由该路径产生，不证明玩家这次正是此输入。

## 据奏失真排查

- `web/tm-reported-view.js:24` 必须同时满足严格史实模式和 `reportedViewEnabled === true` 才开启；`web/tm-patches.js:1194` 明示该设置默认关闭。
- `web/tm-reported-view.js:10` 偏移上限 35%；`60-63` 确定幅度；该右栏调用没有经手人加码，正向通常上限约 33%。不能解释十几倍的数额变化。
- 真实天启腐败配置、回合 4、原值 915,557 的据奏输出为 1,136,719（+24.156%），远小于 17,463,000。
- 确有独立标记缺口：`web/phase8-formal-rightrail.js:1495` 只看国库银的失真结果来显示库藏标题的“据奏”徽。收入/支出/结余没有自己的标记；若国库银被揭真但收入没被揭真，会出现收入失真却没有徽的情况。现有 `smoke-reported-fiscal-wiring.js` 只检查徽函数在源代码出现，不能覆盖这个组合。

## 修复边界建议

应让右栏使用和财政详情一致的权威财政 statement / 实际流水；同时阻止非统一财政消费者将无周期标注的地方估算覆盖已结算收入。仅改右栏会保留其他读者拿到错误 scalar 的风险。对未结算的开局估算需单独标明预测周期；不能直接用 `/12` 猜测所有自定义剧本的字段单位。

主核查另通过正式 `doActualStart` 完成更接近运行态的复现，结果见同目录 `fiscal-results.json`。应优先以该复现作为主结论，本探针补充据奏失真的排除和消费者独立行为证据。
