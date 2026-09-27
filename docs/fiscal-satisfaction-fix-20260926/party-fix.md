# 阶层预算与党派凝聚力修复

## 本分工文件

- `web/tm-class-engine.js`
- `web/tm-party-class-llm-calibrator.js`
- `web/scripts/smoke-class-satisfaction-guard.js`
- `web/scripts/smoke-social-satisfaction-recovery.js`（新增，中央注册由主线程处理）

原文件逐字节备份在 `backups/party/`。三份已有文件均为 UTF-8 无 BOM、LF，本次保持该格式。未修改主目录，也未修改 NativeScope、入口、版本或基线。

## 行为

1. 阶层向党派传导保留凝聚力小数及合法 0，并把实际增减写入近账、总和及回执。82 接受两笔 -0.5 后为 81；两笔 +0.5 后为 83。触底扣减只记实际余量。NativeWorld 的现有 `coupleClass` 已使用浮点数与实际差值，新增测试直接覆盖此分支。
2. 满意度事件预算限制每回合净变化 ±14。`used` 保留累计绝对量供诊断，新增 `net` 记录有符号净量。负 14 后的正 10 完整生效，净 -4；正 10 后负 14 同样净 -4。纯负向多源仍最多扣 14。结构回归继续沿用原有独立通道。
3. 旧存档只有 `used` 时，从同回合非 `struct-drift` 近账还原已知净量；缺失部分形成上下界 `known ± missing`，后续只允许不会让任何可能历史超出 ±14 的变化。完整近账可正常恢复；全无近账且旧预算耗尽时，本回合保守冻结，到下一回合自动正常重置。迁移版本与上下界随存档保存，读档不会重新发预算。
4. 党派校准按真实党派对象合并同批条目。完全相同的数值、目标与理由只算一次；不同证据的增量汇总后限幅。绝对目标会覆盖此前累计 delta，同条绝对目标也覆盖同条 delta，之后的 delta 才继续累加。最终整批只应用一次有界差值；同回合所有校准共享 ±15 净预算。
5. 校准写回同步 canonical 和已存在的 partyState 水位，近账写实际差值，后续 `syncPartyTruth` 不会再加一次。绝对值 0 不能使初值 82 一步归零，首批最低到 67。

## 验证

新增 `node web/scripts/smoke-social-satisfaction-recovery.js`：16 个案例通过，包括旧预算完整/截断/无证据迁移、64 种隐藏历史上下界组合及序列化后再入、同批 absolute/delta 覆盖次序、NativeWorld、浮点正负方向、合法 0、触底近账、校准去重与跨回合同步。

现有定向 smoke 全部 exit 0：

- `smoke-class-satisfaction-guard.js`：29/29；相反方向预算断言已更新为本次净额契约。
- `smoke-class-satisfaction-signal-gate.js`：11/11。
- `smoke-party-class-llm-calibrator.js`：PASS，最后一次生产修改后重跑。
- `smoke-party-class-closed-loop.js`：PASS，最后一次生产修改后重跑。
- `smoke-class-party-bidirectional.js`：34 assertions。
- `smoke-party-opening-standing.js`：104 assertions。
- `smoke-party-class-action-scheduler.js`：PASS。
- `smoke-social-foundation.js`：69/69。
- `smoke-party-class-v3style.js`：26/26。

全架构、中央 smoke 注册与全量测试由主线程统一执行，避免并发写全局报告。`git diff --check` 对本分工四个文件通过。

## 已授权的旧门禁兼容调整

初次全量测试中的 `smoke-endturn-performance-optimizations.js:115` 在未改的主目录也同样失败（主线程独立复现）。它只寻找 `priority: opts.priority` 字面写法，而当前生产 helper 已改用 `Object.assign({}, opts, …)`，真实调用仍完整保留优先级。

先前独立探针 `review-ai-priority.cjs` 使用真实 helper、retry、options policy、恢复包装和真实队列，只有 fetch 返回内存响应；high、critical、background 重载、low 重载及两个 helper 的默认 normal 六路本来全部正确，旧正则仍为 false。因此没有修改 AI 生产代码。

得到主线程明确授权后，只替换这一条断言为六路实际传参检查及单次传输计数。原文件其他断言保留，增加 async main 用于等待行为检查。新增非 smoke helper `web/scripts/lib-ai-priority-routing.js`，未增加测试数量、跳过项或放宽门禁。原测试字节备份位于 `backups/party/smoke-endturn-performance-optimizations.js`。

验证：`smoke-endturn-performance-optimizations.js` 100 assertions；`smoke-faction-llm-priority-lifecycle.js` PASS；`smoke-turn-request-reliability.js` 13/13。无真实网络请求。
