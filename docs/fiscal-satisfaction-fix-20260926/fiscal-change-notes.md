# 财政修复核验

## 修改

- `FiscalStatement` 的旧财政读取路径从已有实际流水构建收支与库存显示；真实零值优先于旧显示字段，月均/折年按已记录期长换算。
- 旧存档中已经污染的收入字段在读取右栏、帑廪详情时立即显示为真账数值；提交前财政消费者通过既有 statement 同步接口修复派生字段，不改余额、不重复入账。
- 民心财政估算不再覆盖已经存在的实际入账流水。无实际流水的兼容路径保留估算处理，不对未知口径直接除以 12。
- 右栏与详情复用财政 statement，区分预计、本期、上期及日数；真实零收入不回退到旧账或静态税表。
- 据奏失真继续作用于正确基础值。收支和据奏结余有独立徽标，国库银已揭真时也能标明收入仍属据奏。
- 详情三账的零收入/零支出不再回退到 `lastTurnIn` / `lastTurnOut`；已交割显示不补入未入流水的旧自定义税估算。

## 验证

`node web/scripts/smoke-fiscal-actual-display.js`：62 条数值断言通过。覆盖污染存档、真实零、库存与流水不变、重复消费者调用、10 日/月度换算、已记录周期、开局预测、统一财政、据奏与单独揭真。

旧相关 smoke 全部通过：shared-display 53、fiscal-field-contracts 99、reported-fiscal-wiring 22、reported-view 19、treasury-account-books 91、monthly-shizheng-sync 17、active-fiscal-readers 56、dynamic-settlement 40、unified-budget 72、collection-ledger 26、neitang-shared-fields 91、neitang-inner-treasury-compat 10，以及 minxin-hard-link-consumers。

`fiscal-final-smokes.json` 是边界修复后的最终 15 项验证输出，全部通过。`fiscal-smokes.json` 保留前一轮原始验证输出。一条 `smoke-neitang-shared-display` 是调用时写错文件名；现存文件 `smoke-neitang-shared-fields` 已随后运行通过，并在收据中标明替代关系。

`fiscal-fixed-probe.cjs` 用官方天启 JSON 经正式 `doActualStart` 开局，再运行真实财政消费者，16 条断言通过。三次阶段链的消费者执行后，显示收入分别保持 425,836、1,022,181、1,022,063，与实际入账流水一致；消费者不改变库存。证据在 `fiscal-fixed-results.json`。该测试隔离财政阶段，未调用真实 AI，也不代表玩家原存档完整回合重放。离线测试桩中 Audio 缺席和 SaveDB 超时日志没有影响财政断言。

主任务负责顶栏同源显示、全局测试注册、加载版本戳和总体架构/全量门禁。本子任务未触及版本、热更、发布、分支推送。

## 文件

生产修改仅四个文件：`web/tm-fiscal-statements.js`、`web/tm-minxin-hard-link-consumers.js`、`web/tm-guoku-panel.js`、`web/phase8-formal-rightrail.js`。

测试新增 `web/scripts/smoke-fiscal-actual-display.js`；旧 `smoke-guoku-shared-display.js` 只有一条开局预测的文案断言从“折月”改为“月均”。原始字节备份在 `backups/`，旧审计探针和证据未改。

## 独立复核后的边界修复

实际期内缺失某资源或收支方向时，该方向及依赖它的结余返回 null，显示为“待核 / 交割缺项”。消费者只清除污染的派生字段，不补造凭据；真实数值 0 仍保持 0。Native 已交割的零流水根据本玩家本类账户的 fiscalOperations / fiscalFrontier 识别，欠付 10、实支 0 不会再以计划支出 10 冒充实支。新增上述边界与正式 Native fixture 数值断言通过。
