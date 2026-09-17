# 国师中转续做、按钮可读性与行政区划空状态

## 范围与基线

分支 `codex/fix-guoshi-continuation`，起点 `76ade3e4d78c9190800bdbd9544b940f9ae327fc`，代码提交 `deb7ade1b79d5734d76a1045f822027e57d399ef`。起点已包含未推送的奏疏修复 `6ef9d224`、说明 `76ade3e4`，本轮保留它们；读取到的 `origin/main` 为 `547e2bb14bd4a61cbe5927b2ca7c2c8f55859ff8`。未修改原 `tianming` 脏工作树。

仅本地修复和测试，**未推送、未合并、未部署或发布**。本说明与机器证据不改变被测运行时代码。

## 核验与实现

| 玩家现象 / 核验 | 根因与修复 | 实际测试 |
| --- | --- | --- |
| “任务未完成”下按钮近乎不可读，属实 | `editor-authoring-agent-ui.js/_recoveryButtons` 位于普通摘要内，而原 `.ec-retry` 样式只覆盖错误卡；`.ec-restart` 无样式。改为统一、面板内限定的恢复操作类，补底色、文字、间距和焦点，沿用原有风格，不重做布局。 | 真实 Electron 深浅主题、两按钮至少4.5:1对比度、祖先无透明淡化、实际Tab焦点与鼠标点击。 |
| 无工具后反复“提示继续”，可复现 | `editor-authoring-agent.js/runAuthoringLoop` 对成功但无工具的响应只泛泛催促，并且成功进展不重置无工具计数；只读模式也被提示调用写工具。下一轮改为明确JSON兼容格式，按当前模式终结工具收尾；仅新读取或实际改动重置计数。仍保留原两次恢复、迭代、token和无进展上限。兼容模式随同一草稿的恢复句柄保留。 | 原生返回部分改动→纯文字→兼容工具→finish；持续空响应有界停止；只读四模式；部分应用后追加消息；续做不重复append；取消。 |
| 中转连接重复关闭，客户端确有重试叠乘 | `editor-authoring-agent-provider.js/_fetchJSON` 默认4次尝试，外层loop又重试2轮，持续断连时一轮可发12次请求。由provider标记尝试次数与重试耗尽，loop不再叠乘；自定义caller的既有重试保留。400后的文本兼容路径也保留错误类别与耗尽状态。 | 受控首轮改动成功，随后断连：旧实现13次总请求→新实现5次（成功1次+断连4次）。失败仍reject，草稿/恢复句柄保留，401不重试，Abort不进入兼容兜底。 |
| 中转工具格式差异，客户端兼容缺口已复现 | Provider原文本解析器漏掉嵌套 `function.name/arguments`，字符串arguments未转对象；补旧式 `function_call` 与对象参数读取。只接受完整JSON命令信封或完整围栏，禁止把说明里的示例执行，任一参数损坏整批不执行。兼容请求保留完整工具schema、系统消息和各轮图片。 | 实际provider+core写回/完成；Unicode；坏JSON/null/数组/数值参数；完整批次拒绝；越权工具仍被执行门禁拒绝；三provider受控传输。 |
| `renderAdminFolio` 读取 `factionName` 抛错，属实 | `preview/scenario-editor-reset-app.js` 的 `adminHierarchy={}` 被当成有首个势力。空/格式无效时显示明确空态；格式错误条目保留并提示，不擅自修写玩家数据；失效区划选择回到可用项。 | 同一函数基线复现原TypeError；真实编辑器清单/树图均可打开；有效与无效条目混合，原数据不变。 |
| 连接测试“成功”未证明工具可用 | `testConnection` 原先任何成功HTTP响应均返回工具可用。现在必须收到唯一有效 `ping({ok:true})` 才能通过；只有聊天文字会明确报工具未验证。 | 纯文字失败对照、正常ping通过、取消不重试。 |

上述受控兼容格式试验**不能证明玩家实际回包恰好属于哪一种格式**：未取得模型名、完整失败响应，也未调用其真实中转。玩家日志中的 `ERR_CONNECTION_CLOSED` 是连接层失败，不能宣称客户端修复已恢复该服务。CSP开发警告未被当成根因，未关闭CSP、sandbox、contextIsolation或IPC检查。

仍保留显式应用/部分应用二次确认、质量闸、只读和工具范围、文档租约、当前项目冲突保护；没有用自然语言“完成”取代有效工具回执，没有强制自动应用。重新生成仍需确认放弃未应用草稿。

## 执行证据

完整26次验证/同步记录（命令、退出码、平台、时间、日志与hash）、13个被测代码/测试/工作流/清单文件和1个行尾属性文件的hash，见 [机器证据](evidence/guoshi-continuation-20260910.json)。所有运行时代码字节已与代码提交逐一比对。报告中的HEAD是测试起点，实际执行的是该HEAD加记录的工作区修改，不是声称只测试了旧提交。

| 命令 / 检查 | 最终结果 |
| --- | --- |
| `node web/scripts/smoke-authoring-relay-continuation.js --source-ref 76ade3e4d78c9190800bdbd9544b940f9ae327fc` | exit1，2 PASS /12 FAIL（14个行为组，不等于12个独立玩家Bug） |
| `node web/scripts/smoke-authoring-relay-continuation.js` | exit0，14 PASS /0 FAIL /0 SKIP /0 WAIVED |
| `node web/scripts/run-smokes.js --grep authoring --grep guoshi --no-retry` | exit0，18脚本 PASS |
| `node web/scripts/ci-smokes.js` | exit0，**934 PASS /0 FAIL /0 SKIP /2 WAIVED，936脚本完整执行** |
| `node web/scripts/lint-arch-all.js` | exit0，13 PASS |
| `node web/scripts/sync-official-scenarios.js` | exit0，2来源/9派生物，无官方数据改动 |
| `node web/scripts/verify-official-scenario-parity.js` | exit0，27 PASS |
| `node scripts/verify-release-contract.js` | exit0，166 PASS |
| `node web/scripts/verify-hot-builder-gates.js` | exit0，27 PASS |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | exit0，687在场条目校验，410缺席资产保留 |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | exit0，0 vulnerabilities |
| `node scripts/verify-electron-bridge.js --authoring-continuation` | exit0，12 PASS（5共用桥接+7本轮UI/流程检查） |
| 同一Electron入口 `--authoring-recovery` / `--authoring-stream` / `--authoring-boundaries` | exit0，17 /12 /20 PASS |
| `git diff --check` / `git diff --cached --check` | exit0，保留原逐行EOL |

全量报告：[smoke-report.json](../web/dev-tools/arch-guard/ci-t70rYp/smoke-report.json)，runId `08764a4e-3ba6-437a-9dcf-c8bfb19f36f7`。两项豁免仍为原7个具体缺席资产检查，未扩大豁免、删断言或造资产。

新Electron报告：[report.json](../web/dev-tools/electron-bridge/2b3bde03-6ebc-4207-badd-cf2002cf020b/report.json)。[深色截图](../web/dev-tools/electron-bridge/2b3bde03-6ebc-4207-badd-cf2002cf020b/recovery-dark.png)、[浅色截图](../web/dev-tools/electron-bridge/2b3bde03-6ebc-4207-badd-cf2002cf020b/recovery-light.png)、[对比度原始颜色](../web/dev-tools/electron-bridge/2b3bde03-6ebc-4207-badd-cf2002cf020b/recovery-colors.json)。原始日志保留本地ignored目录，没有随源码提交玩家内容或大型测试产物。

环境：Windows，Node24.14.0；真实未打包Electron33.4.11、Chromium130。正式main/preload/UI及IndexedDB，临时userData，禁止外部网络，合成案卷，受控fetch响应。点击由Electron输入事件驱动，不冒充原生OS鼠标、安卓真机、真实中转端到端或已发布安装包验收。各模式的共用桥接检查重复，不合并夸大为独立游戏流程数量。

## 中间失败与派生物

1. 第一次基线的行政区划提取用例缺少展示辅助桩，是HARNESS_ERROR，不当作缺陷证明。补足展示桩后重跑，实际函数稳定复现原 `factionName` TypeError；最终同一适配器对旧代码与修复树各跑一次。
2. 首次相关18脚本中旧回归按“没有调用任何工具”定位催促文本，更新文案后定位失败。保留该措辞并增加具体兼容策略，原任务表点名断言及全部旧测试不改，18脚本通过。
3. 首次深色截图尚在原入场动画中；补等待有限动画完成与祖先opacity断言后再次拍摄，未关动画/伪造CSS或改色断言。
4. `git diff --check` 曾将保留的CRLF误报为空白。按仓库已有 `.gitattributes` 模式，仅为该历史混合换行入口识别CR；真正行尾空格、文件尾空白等检查仍启用。入口逐行换行序列与起点完全相同（592 CRLF /2 LF），没有整文件转换。
5. 整族缓存戳在正式editor与reset入口同步为 `20260910-relay-continuation1`。用官方命令 `node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp` 只读借用现有资产更新清单。仍1097项，仅7个本轮运行时路径的hash/size变化；版本、官方剧本、美术、依赖锁、发布流程不变。

CI只新增本轮真实Electron用例，尚未远端运行。本轮收口为本地候选修复，不代表中转服务、线上网页或客户端已更新。
