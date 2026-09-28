# 省道主官验证记录

最终候选通过逐道门禁、全树官称匹配和派生对账。**本独立分支的两个综合门禁尚未全绿**：`lint-scenario-data` 把约定的新字段视为未消费字段，`lint-arch-all` 因此为14/15。需与通志二期引擎合并后重跑；未改守卫或放宽基线。

| 验证 | 结果 |
| --- | --- |
| 原 JSON 标准串行化、玩家省道覆盖、所有职位副本、姓名唯一、全树官称歧义 | 三部 PASS；天启43、绍宋28、晚唐107个节点 |
| `tools/governor-binding.js` | 三部无歧义；另由新增核验覆盖非叶省道 |
| 指定 smoke（71项主题 + start-game-data-integrity） | 最终72项通过，0跳过、0豁免；首轮69项通过，3项单独复核通过 |
| 旧用例随史实数据更新 | 北直隶长官断言改为单明诩；绍宋名册断言为513人，100支军队不变 |
| 晚唐开局账本 | 首轮原生退出0xc0000409，保持测试原断言及期限，独占复跑通过 |
| `sync-official-scenarios.js` / `verify-official-scenario-parity.js` | 11个派生物同步 PASS；41项对账断言 PASS |
| `lint-scenario-data` | FAIL仅为 `governorOffice`、`governanceNote`、`governanceDetail` 在当前分支尚无引擎读取 |
| `lint-arch-all` | 14/15 PASS，唯一未过项为上述数据守卫 |
| 棘轮基线 | 与 HEAD 原字节一致，未执行 --update |
| 全量 smoke / sync-hot-baseline / 发版 | 未运行，按委任状留给合并阶段 |

新增未消费字段计数：天启 `field.dead` 3420→3500（+80），绍宋8330→8362（+32），晚唐0→195（+195）。没有新增人物、势力、阶层、官位引用错误。

### 最终版本从原版完整重建两次

调整前的旧结果、异常中断轮次均不计入以下验收。每个结果还须与已跑定向检查的最终候选 MD5 完全相同。

| 剧本 | 完整重建轮次 | 两次共同 MD5 |
| --- | --- | --- |
| tianqi | 1、2 | `580b2593675e2812e31bbad86b508212` |
| shaosong | 4、5 | `fddfb08b7b12b988644420c1bcfdec4a` |
| tang | 1、2 | `f34e985030f097ceab813b8e41a5b3b2` |

三部补丁重复应用亦无字节变化。完整重建仍调用原 `rebuild-*.js`，仅其末步添加主官补丁；临时执行器对本机已经出现的 `UNKNOWN open` 或 `0xc0000409` 异常保留并恢复该步骤输入后重试，所有数据断言及其余错误仍照常失败。验收轮次内此类重试共 0 次；记录存 `E:/tianming-tmp/codex-governors/logs/`。


### 原字节复原与交付范围

官方派生物与原有报告按启动时快照逐文件复原：校验 157 个路径，恢复 11 个已有文件，移除 0 个原先不存在的派生文件。三份仓根官方 JSON、新数据模块、补丁、核验、报告和说明保留。**当前派生物特意保留基线版本，合并时须统一重生成**；上面的派生对账结果是在新派生物生成之后、恢复之前取得。

本任务的研究文件、备份和验证日志位于 `E:/tianming-tmp/codex-governors`。主库仅作立绘只读查询；没有提交、push、打包、发版。

```text
## codex/circuit-governors...origin/main
 M docs/scenario-data-repair-20260924/README.md
 M docs/scenario-data-repair-20260924/patches/rebuild-shaosong.js
 M docs/scenario-data-repair-20260924/patches/rebuild-tang.js
 M docs/scenario-data-repair-20260924/patches/rebuild-tianqi.js
 M scenarios/天启七年·九月（官方）.json
 M scenarios/晚唐·开成五年（官方）.json
 M scenarios/绍宋·建炎元年八月（官方）.json
 M web/scripts/smoke-map-circuit-book.js
 M web/scripts/smoke-shaosong-target-map-regions.js
?? docs/scenario-data-repair-20260924/data/shaosong-governors.js
?? docs/scenario-data-repair-20260924/data/tang-governors.js
?? docs/scenario-data-repair-20260924/data/tianqi-governors.js
?? docs/scenario-data-repair-20260924/patches/governors.js
?? docs/scenario-data-repair-20260924/reports/governors-shaosong.md
?? docs/scenario-data-repair-20260924/reports/governors-tang.md
?? docs/scenario-data-repair-20260924/reports/governors-tianqi.md
?? docs/scenario-data-repair-20260924/reports/governors-validation.md
?? docs/scenario-data-repair-20260924/sources/shaosong-governors/
?? docs/scenario-data-repair-20260924/sources/tang-research/governors-excerpts.json
?? docs/scenario-data-repair-20260924/sources/tang-research/governors-excerpts.txt
?? docs/scenario-data-repair-20260924/sources/tianqi-governors/
?? docs/scenario-data-repair-20260924/tools/verify-governors.js
?? docs/scenario-data-repair-20260924/省道主官说明.md
```
