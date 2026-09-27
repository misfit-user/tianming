# 回合史记财政显示修复

当前验收状态：财政取数改动已写入本地；49 个相关回归脚本与新增的 54 项断言通过，架构、官方剧本对账、发布契约、资源清单、热更基线和 renderer bundle 检查通过。**完整门禁尚未全绿**：最后一轮为 1107 PASS / 1 FAIL，唯一失败为 `smoke-tang840-opening-ledgers.js` 的 60 秒 VM 超时；同一用例单独复跑约 43 秒、7266 项断言通过。没有放宽时限或豁免该失败，详见 `final-validation.json`。

问题出在史记的取数口径。`web/tm-endturn-shiji-compose.js` 原先直接读取 `GM.guoku.turnIncome / turnExpense / monthlyIncome`；这些兼容字段可能保留旧概算，财政面板则已通过只读报表读取实际账本。史记还把本回合收支标为“岁入 / 岁出”，没有说明实际期间。

旧概算入口也已核对：`tm-minxin-hard-links.js` 的 `claimedRevenue()` 在缺少直接税额时按人口估算，汇总生成 `remittedToCenter / actualRevenue`；`tm-minxin-hard-link-consumers.js` 的无实际账本兼容分支会把它们写入 `turnIncome / monthlyIncome`。当前有实际账本时已有保护，但史记原先直接读取兼容标量，仍会展示旧存档残留值。这里不把人口概算当成已经征收入库的现金。

修复后，史记优先调用 `FiscalEngine.readAccountStatement`，与财政面板使用同一份已交割数据。旧入口缺少财政服务时，仍优先读取账本流水；有效零值不会回退到旧字段，缺失流水标为“待核”。标题显示“本期收入 / 本期支出”和账本天数，月额按已结算期间换算，钱粮帛保留账户单位。所有变动均为只读展示，不重新征税、不拨款、不改变库存或欠额。

## 复现证据

`reproduction.json` 是离线构造账本的前后对照，不是玩家存档：本期 10 日，实收 300、实付 400；兼容字段残留收入 17,463,000、支出 2,606,000。

- 修复前：岁入 1746.3 万两 / 岁出 260.6 万两，结余 1485.7 万两。
- 修复后：本期收入 300 两 / 本期支出 400 两，亏空 100 两，10 日。

`smoke-shiji-fiscal-ledger.js` 覆盖 54 项断言，包括实际财政服务、旧入口、零流水、缺项、不同期间及单位、完整史记组装、统一税收账本的真实收付、原生财政的零实付与欠款保留，以及渲染前后存档完全一致。修复前该回归在实际流水断言处失败，修复后通过。

## 文件与验证

- 业务修复：`web/tm-endturn-shiji-compose.js`。
- 缓存戳：`web/index.html` 仅更新该脚本的加载参数。
- 回归：`web/scripts/smoke-shiji-fiscal-ledger.js`。
- `web/tm-start-runtime-manifest.json` 由 `build-native-preparation-manifest.cjs --write` 刷新，仅史记脚本记录及对应总指纹变化，见 `native-manifest-delta.json`。
- `web/.hot-update-manifest.json` 由官方 `sync-hot-baseline.js --write --version 1.3.5.2` 刷新。1361 项保持不变，只有脚本、入口 HTML、原生资源清单这三项的 hash/size 更新，版本与资产不变，见 `baseline-delta.json`。
- 定向回归：49 PASS，0 FAIL，0 SKIP；完整门禁详见 `full-validation.json`、`gates-validation.json` 与同目录日志。
- 安装前逐文件校验源目录 hash；源文件与 HTML 原文保存在本目录 `.bak` 文件中。安装未改变 Git index，见 `installation.json`。

首轮全量为 1107 PASS / 1 FAIL，失败项是原生资源清单未同步；原始日志保留为 `first-full-smokes.log`。用正式生成器同步后，该项 14/14 通过，并重新运行最终完整门禁；未删除或放宽断言。

第二轮为 1107 PASS / 1 FAIL，唯一失败是晚唐完整开局的 60 秒 VM 超时（`second-full-smokes.log`）。同一命令单独重跑约 43 秒完成，7266 项断言通过，见 `opening-recheck.json`；同时观察到另一工作目录正在运行全量检查。因此最终全量使用官方 runner 的 `--jobs 2`，未修改测试、断言或限时；以 `full-validation.json` 的最新结果为准。

第三轮降低并发后仍出现同一 VM 超时，结果同为 1107 PASS / 1 FAIL。保留此结果作为未通过的整体验收限制，不再重复同一轮全量测试，也不改动与本次财政显示修复无关的开局实现或测试阈值。

修复已回写当前本地目录，没有提交、推送、打包或发布。没有调用真实模型 API，也没有改动玩家存档。

## 生效范围

重新加载游戏后，新生成的回合史记会使用修复后的取数方式。已有 `GM.shijiHistory[].html` 保存的是当时生成的完整 HTML，旧记录不会自动改写；本次未用当前账本倒填历史回合。
