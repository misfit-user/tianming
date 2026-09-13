# 御驾亲征修复验收

## 范围与状态

本地分支：`codex/fix-personal-campaign-trigger`，基于 `80a20bf9ab45bdcd3827d146449adca6468562ec`。
本轮未提交、推送、合并或部署，未变更版本号，未使用玩家 API 或存档。上一轮自动存档弹窗修复保留。

本地修复和验收已完成。完整资源全量 **955/955**，零失败、零跳过、零豁免。

## 已实施

- 战果统一引用解析：稳定 ID、合法军名、`affectedArmies.name`、顶层攻守军队字段均可进入亲征；玩家势力旧字段和 ID／名称别名兼容。
- 显式关闭总开关优先于旧存档的 `settings.yujiaQinzheng=true`。开启亲征后，标准／精简深度仍保留必要军事事件；SC18 lite 不再裁掉战斗。
- SC18 支持 `battleResults` 多场事件，不再只保留全局最大一战；旧单场 `battleResult` 兼容，同 ID 去重。普通行军、疾病或逃亡损耗不凭空变成战斗。
- Agent 增加 `resolve_battle` 真实登记工具；修复 `command_army` 增减和绝对兵额假成功，无变化时不冒称修改成功。
- 旧战斗引擎也经会战队列，结算后标记完成；匿名旧战果在持久化前取得稳定 ID。重复调用、恢复与跨存档迟到结果不重复扣兵／写历史。
- 经典 AI 写回入口将待亲征标记为延期，不报写入失败；军功和败将后效随最终结果一次落地，存档恢复也保留，不提前发胜仗奖励。
- 营葬银从实际已落地战果派生，敌方损失不算玩家抚恤；无战回合清旧值。战术结果保留有效战略字段与多位主将各自命运。
- iframe 使用 Ready → Start → Ack 握手，同会战 ID 重发不重开；12 秒未启动、页面错误或主动放弃可回庙算。错误响应不伪装成零伤亡战败。
- 嵌入战斗不先初始化无关内置战役／标题 3D；出征准备不能换成萨尔浒等内置名册；未出阵部队不会被当作阵亡。优先定位当前玩家君主，不误取其他势力的皇帝。

共享契约放在新增 `web/tm-battle-contract.js`，紧邻原军事写口，并在游戏／旧编辑器装载序守卫中登记。原 `tm-military.js` 保持在 3000 行门禁内，没有提高架构预算。

## 使用条件

在局内设置“玩法·战斗与亲征”开启“御驾亲征·战术战斗”。实际接战后选择“亲征”或“委之”；军卡可以预选“必亲征”。仅写一句“亲征”不会凭空制造一场战斗，也不会代替显式总开关。

开启亲征会保留军事事件所需的推演调用；这是保证功能所需，不通过删掉事件来节省调用。模型仍须给出真实可识别的交战双方，API 本身不可用不在此次保证范围内。

## 验证记录

| 检查 | 当前结果 |
|---|---|
| 新增真实生产函数反例 | 60/60，通过；初始 15 通过、31 失败 |
| iframe 协议隔离测试 | 11 项通过，含来源／会话校验、超时、重复启动、清理 |
| 战斗／军队／Agent／国库相关回归 | 74/74，通过，无豁免 |
| 原生亲征完整流程 | 19/19，通过；三轮复验通过 |
| 自动存档弹窗修复原生回归 | 9/9，通过 |
| 架构守卫 | 13/13，通过 |
| 官方剧本派生对账 | 27 项通过，官方 JSON 未改 |
| 发布契约／同版基线 | 166 项／1103 文件通过，没有发版 |
| 最终全量 smoke | 955/955，通过；0 FAIL / 0 SKIP / 0 WAIVED |

真实原生测试使用生产 `main/preload/renderer` 和真实战术 iframe，全新临时 profile，外网请求阻断。实际点选出阵、开战并观察时钟推进，使用战术页面自己的“代战”生成真实战果后经父页面写回；另验军名和顶层字段的放弃回退、留营兵保全、错误启动清理。不是直接伪造一条 `postMessage` 宣称战斗完成。

最后亲征报告：`web/dev-tools/electron-bridge/186d9053-2b88-4011-be06-b2f7ee493472/report.json`。
前轮截图已视觉检查：`web/dev-tools/electron-bridge/0e2efe75-53fc-4074-b7bb-7b71b163c572/personal-campaign-battle.png`。
自动存档回归：`web/dev-tools/electron-bridge/e7ef3507-b5eb-44da-8df3-8fe4876e097c/report.json`。
行为回执：`web/dev-tools/office-writeback/campaign-all-write-paths-0690fa54-6500-4725-8101-b94ece4c85c7`。
架构回执：`web/dev-tools/office-writeback/campaign-architecture-accepted-7f582284-de34-4d6f-8240-e4dec16e0b75`。
发布契约回执：`web/dev-tools/office-writeback/campaign-release-accepted-1ae84151-5c74-4733-957f-40840594a702`。
最终全量报告：`web/dev-tools/arch-guard/ci-x5Jwtc/smoke-report.json`，回执 `web/dev-tools/office-writeback/campaign-full-suite-standalone-1b3e0ef0-67fb-4723-8140-68d785031b0d`。

基线由官方生成器在原 `1.3.4.11` 同版更新：1102 → 1103，仅新增 `tm-battle-contract.js`，删除 0，`assets/` 367 → 367。没有修改六处版本字段或创建分发包。模块源修改后已用官方 builder 重生成并检查 bundle 可复现。

## 保留的失败证据

初始诊断、触发反例、原生和全量失败均保留在 `_codex_tmp/campaign-*` 与 `web/dev-tools/office-writeback/campaign-*`。未跳过用例、提高超时或放宽守卫来换取通过。

首次原生新验收用战后人物数据重算战前预测带，导致期望漂移；改为战前快照后通过。首次架构检查发现新代码令旧军事文件越过 3000 行，改为独立共享契约，没有抬预算。旧测试中的固定脚本数量、无缓存戳路径、原校验注释和旧直接调用字符串已替换为相同目标的新真实契约断言。

第二轮全量唯一失败为 `smoke-production-dependencies` 内部 `npm ls` 的 30 秒硬截止（status=null），保留 `ci-XjvA0R` 报告；原命令独立执行 5/5 通过。随后完整套件不与其他原生／架构重型验证同时执行，未改用例或 deadline。

按文件规划和根因排查逐项追踪，未将标准 ID 的 mock 通过当成完整功能正常；字节整理仅恢复原有 CRLF/LF，断言代码文本完全不变。没有安装客户端、修改真实存档或触发生产发布。
