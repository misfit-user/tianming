# 财政字段的共同契约

三官方剧本共用账目字段，制度名称放在项目的 `name` 中。税、官职、军队及库藏的 `id` 用于关联；同名项目不能合并为同一笔凭据。

| 层级 | 字段 | 含义及期间 |
| --- | --- | --- |
| 剧本国库、内帑 | `initialMoney / initialGrain / initialCloth` | 开局存量，分库存放仍须守恒 |
| 剧本国库、内帑 | `monthlyIncomeEstimate / monthlyExpenseEstimate` | `{money, grain, cloth}` 月额；预算不能直接增加库存 |
| 运行账户 | `money / grain / cloth`、钱的 `balance` | 本库现存，以对应真实 `ledgers[k].stock` 为准 |
| 运行账户 | `unit`、`turnDays`、`accounting` | 资源单位与该账本实际期间，不能按下一期长度重标旧账 |
| 运行账户 | `turn*Income / turn*Expense` | 本期收支；无后缀为钱，粮帛分别用 `Grain / Cloth` |
| 运行账户 | `monthly*Income / monthly*Expense`、`annual*Income / annual*Expense` | 对应月额、年额，钱粮帛不自动混折 |
| 运行账户 | `sources / expenses` | **年额**，标准英文分类键；不能写成当期中文凭由表 |
| 运行账户 | `sourcesDetail / expensesDetail` | 钱账分类下的**年额**子目数组 `{id,name,amount}` |
| 三资源账本 | `thisTurnIn / thisTurnOut`、`sources / sinks` | **本期真实收付**；sources 用共同英文分类，sinks 沿主结算器使用共同中文科目 |
| 三资源账本 | `sourceDetails / sinkDetails` | **本期**分类下的凭据数组，不得按当前项目名称重新猜测旧交易归类 |
| 三资源账本 | `deficit / deficitDetails` | 已确认欠额及其支项；欠支不算已付款，偿还旧欠须减少对应欠项 |
| 只读财政报表 | `flowBasis`、`periodStatus` | `forecast / actual` 区分预算与实绩，`previous / current` 标明期间 |
| 只读财政报表 | `sourceDetailsByResource / expenseDetailsByResource` | 三资源**年额**子目，与账户年额 Detail 含义相同 |

国库岁入类别为 `tianfu / dingshui / caoliang / yanlizhuan / shipaiShui / quanShui / juanNa / qita / mining / fishingTax`。国库岁出为 `fenglu / junxiang / zhenzi / gongcheng / jisi / shangci / neiting / qita`。军费统一归军饷，官员和胥吏给养统一归俸禄，中央与地方承付仍分别记账；每军、每税、每项常费保留子目。

内帑岁入为 `huangzhuang / huangchan / specialTax / confiscation / tribute / guokuTransfer / other`；岁出为 `gongting / dadian / shangci / houGongLingQin / guokuRescue / other`。国库拨内必须在两端分别扣、入，不能另造收入；拨给地方不能归内廷转运。

差额字段统一使用 `gaps.clerk / official / power / transit`，分别为州县吏胥、各级私分、豪强抵偿、在途损耗。运输损耗不能改名塞入 `power`。未模拟某项不能凭空捏造私分比例；差额合计须等于民缴与官收之差。

生产读口为 `FiscalEngine.readAccountStatement`；初始化及结算归档由原 owner 调用 `syncAccountStatement`。界面与 AI 使用相同字段。`readFiscalContext` 返回国库、内帑的三资源、期间、分类摘要，不再从未初始化的 `stateTreasury / privateTreasury` 标量猜数。

`FiscalStatement` 只生成报表字段和收付明细；库存变化仍由财政引擎、公库移交与各库结算写口负责。只读界面的预计账本不回写真实 `thisTurnIn / thisTurnOut`。旧两官方剧本的既有经济推算与随机事件不在此次改动中重算。

AI 财务写入沿用 `fiscal_adjustments`，提供稳定 `id`；同一凭据重试不能重复收付，不同支项各有 ID。一次性收付与年例实际结算均同时登记库存、本期流水、共同分类、明细和欠项。`currentEffects` 不再接受国库或内帑财务字段；非财务指标仍按原写口处理。旧欠必须按原欠项 ID 和实际偿还凭据核对，新增同名支出或只改执行报告的 `resolved` 均不构成销欠。

验证：`smoke-fiscal-ai-posting.js`、`smoke-fiscal-ai-field-routing.js`、`smoke-fiscal-field-contracts.js`、`smoke-fiscal-contract-edgecases.js`、`smoke-neitang-shared-fields.js`、`smoke-guoku-shared-display.js`、`smoke-treasury-account-books.js`，以及完整官方入口的离线开局、收付、个人俸给实到账验证。
