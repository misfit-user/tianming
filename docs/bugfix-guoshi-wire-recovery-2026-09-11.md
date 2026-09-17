# 国师工具目录、空流与中断续做（本地修复）

## 版本和范围

- 起点 `be12ee40617a45d88d53e45fa85c009b3cb2fe7e`；开工获取的 `origin/main` 为 `0d301d8daaf214db792ffb2f44b2cf85bbed0732`。
- 分支 `codex/fix-guoshi-sse-wire`；代码提交 `dd517a2c188678f23ee3965ad6fe3abe34c0ab67`。保留此前新剧本隔离及响应恢复三个本地提交，没有重写历史。
- 本轮只改 renderer 国师实现、回归和派生清单。未改版本、模型配置、思考质量、游戏机制、main/preload；未推送、合并、部署或发布。

## 确认的问题与修复

| 实现 | 证据及本轮处理 |
|---|---|
| `editor-authoring-agent.js/_runTools`、`runAuthoringLoop`、`estimateRun` | 默认阶段裁剪确实可让 `listGaps` 未被提供却被模型调用。编辑模式现在从首轮提供完整目录，续做不恢复旧的默认裁剪；估算同步计入完整工具成本。显式调用方子集、只读模式、范围、危险操作、案卷租约和应用校验仍保留。原分阶段模式只在调用方明确指定时使用。 |
| `editor-authoring-agent-provider.js/_decodeResponse` | 实际中转返回过 `choices:[]` 的 SSE；旧实现把它组装成空助手。现在区分缺失主候选并失败关闭。首次遇到这种响应时，仅把同一 OpenAI 兼容请求显式设为 `stream:true` 重试一次，模型、工具、内容、预算不变。真实日志有多组“零候选→有效工具”的配对，非仅受控桩。已经显式流式的请求不重复协商。 |
| provider 与循环 `checkpoint` | 已协商可用的显式流式方式保留到本任务后续轮次及恢复句柄；不修改持久 API 设置，不跨原生 Anthropic/Gemini 协议套用参数。 |
| `_decodeResponse` 候选选择 | 另以实际模块复现：字符串索引 `"0"` 被旧严格比较丢弃。现在只接受规范非负十进制整数索引，仍只选候选0，不混合其他候选，拒绝重复主候选。这是独立兼容问题，真实空流记录中的索引并非字符串0。 |
| `runAuthoringLoop/_procCall` | 行为测试确认：停止后，同一批响应中的后续工具仍可能执行。现在逐调用检查停止状态；恢复历史只保留实际处理且配有结果的调用，已写入草稿不重放，未执行的调用不冒充成功。 |

完整工具目录增加了输入体积，属于用户明确要求的取舍；本轮没有靠删除校验、无限重试、放开只读或伪造 finish 来实现“成功”。新增诊断只记录格式、计数、固定枚举和规范化用量，不记录密钥、地址、正文、工具参数或思考内容；旧观测器的空 `usage` 不代表实际用量为零。

## 真实 Computer Use 结果

运行环境为 Windows、已有 Electron 33.4.11 的未打包游戏，使用用户配置的真实中转；鼠标/键盘操作原窗口，没有伪造 `window.tianming` 或网络响应。

1. 旧页面多次收到一个零候选 SSE 事件后结束，仍失败；用户修复503后这个现象仍存在。截图中的工具授权失败也属实。
2. 用户在期间把 Kimi 中转项换成 `订阅-deepseek-v4-flash-vision-exp`。对照不能单独归因于代码；但同一新模型下，实际日志多次证明：同输入补显式流式后返回有效工具。原 Kimi 项没有完成最终复测。
3. 刘备案卷先完成四势力、四人物及玩家标记，再完成党派/阶层/关系、七个官制节点与刘备/张鲁行政区划；界面显示实际写回。返回正式入口并重新打开后，33个字段及这些内容仍在。旧阶段漏 `isPlayer` 时校验曾拒绝应用，未绕过；八实体草稿仅做只读备份，再由真实国师恢复。
4. 中间一次官制续做经过3000、6000输出截断后，较长请求因四次网络尝试未收到完整响应而失败。保留这次失败；后续真实续做才完成，不能说所有尝试均成功。
5. 最后加载与代码提交逐字节一致的源码，发送限定财政任务。十轮/31步后形成 `guoku`、`fiscalConfig` 两项草稿；助手真实点击停止，看到两项仍待应用和未完成核验；再点击“继续未完成部分”，仅一轮/三步完成核验及 finish，没有无效工具重试，也没有重建前面的内容。助手点击“应用到剧本”，界面确认写回并显示已保存、35个字段。

6. 再经正常返回入口保存并重新打开案卷，使用只读诊断核对恢复后的实际对象（未修改或模拟状态）：35字段、4人物、4势力、仅刘备为玩家、7官制节点、2行政根；国库300000、月收入30000、月支出25000，加载查询戳为 `20260911-wire-recovery1`。原始数值见 [重开读回记录](evidence/guoshi-native-readback-20260911.json)。

这是国师创作、停止、续做和写回的实操证据，不是整个刘备剧本的可玩性验收。地图几何、完整经济/军事/世界规则仍缺，未声称整局已经制作完成；也没有签名安装包、安卓或所有中转模型的验收结论。

## 回归与可复查记录

[执行索引、文件哈希、脱敏真实响应统计及精选原始日志](evidence/guoshi-wire-recovery-20260911.json) 包含本轮52条命令的原始退出码及本机日志位置。测试主要在起点 HEAD 加工作树改动上执行；最后代码提交的八个文件哈希对应被测源码，提交后又运行了两个核心专项。后续文档提交不改变运行时代码。

| 实际命令（仓库根） | 最终结果 / 退出码 |
|---|---|
| `node web/scripts/smoke-authoring-sse-candidate-index.js` | 12 PASS / 0 |
| 同脚本 `--source-ref be12ee40617a45d88d53e45fa85c009b3cb2fe7e` | 2 PASS、10 FAIL / 1；包含旧版没有新增诊断/协商能力，不是10个独立玩家缺陷 |
| `node web/scripts/smoke-authoring-response-recovery.js` | 18 PASS / 0；同适配器基线15 PASS、3 FAIL / 1 |
| `node web/scripts/ci-smokes.js` | 940个唯一脚本全部执行：938 PASS、0 FAIL、0 SKIP、2 WAIVED（7项既有缺资产检查）/ 0 |
| `node scripts/verify-electron-bridge.js --authoring-continuation` | 24 PASS / 0；真实主进程/preload/按钮/IPC，只有中转受控，临时 userData |
| 同入口 `--authoring-boundaries`、`--authoring-recovery` | 分别20、17 PASS / 0，最终代码均重跑 |
| `node web/scripts/lint-arch-all.js` | 13 PASS / 0 |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS / 0 |
| `node scripts/verify-release-contract.js` | 166 PASS / 0 |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS / 0 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | PASS / 0 |
| 思考续接、流式、完成恢复、工具授权、效率专项 | 分别13、21、22、11、12 PASS / 0；命令及日志见索引 |

CLI Node24.14.0，Electron内部 Node20.18.3。首次新增 Electron 桩的模板换行转义错误导致初始化失败，修正桩后重跑；一次误写专项文件名导致命令无法启动，改用真实的 `smoke-authoring-tool-authorization.js` 后11项通过。初始适配器失配及这些失败日志均保留，没有降低断言或扩展资产豁免。

官方生成器同步未改变官方剧本正文。热更清单保持1.3.4.11、1097项，以原工作树410项真实资产作 overlay，仅更新三个运行时文件的 hash/size；没有手改 hash 或生成发布包。原脏工作树只同步这三个已核对的运行时文件，先前备份保留于 `web/backups/guoshi-wire-*`，其余用户改动、API配置和玩家存档未覆盖。
