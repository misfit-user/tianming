# 国师空响应与截断后的续做修复（本地）

## 范围与基线

- 分支：`codex/fix-guoshi-empty-finalization`。
- 起点：`d87cbf606db85c90d1349283446d51c27269e087`；本轮读取远端 main 仍为 `0d301d8daaf214db792ffb2f44b2cf85bbed0732`。
- 起点包含此前两个未推送提交（新剧本隔离代码 `f8c1ae91`、其实操记录 `d87cbf60`），本轮不重写这些修改。
- 只修国师响应恢复。未改游戏内容、版本、模型/思考设置、审批及完成闸门；未推送、合并、部署或发布。
- 原始脏工作树不切分支、不重置、不广泛覆盖。原窗口中刘备测试案卷的 21 处未应用修改仍须保留。

## 已确认的实现问题及修改

| 位置 | 修复前行为 | 本轮行为 |
|---|---|---|
| `web/editor-authoring-agent.js/runAuthoringLoop` | 空响应、只返回思考、输出截断耗尽均落入 JSON 格式补救，失败模式一直沿用 | 空/思考/服务中断只在原或已成功的工具协议上有限退避重试；普通文字无工具仍可尝试 JSON；最多两次无进展恢复，不无限循环 |
| 同上，输出预算及 `checkpoint` | 默认 3000→6000→12000 后错误转 JSON；恢复又回 3000；显式大预算可能反被压到16000 | 自动扩展仍只两次、原自动上限16000，最后一次到达上限；截断轮完全不执行，提示分批处理下一步；检查点保留预算，显式更大预算不反向缩小；到限返回 `outputLimit`，不伪装成工具协议错误 |
| `web/editor-authoring-agent-provider.js/_toOpenAI` 与循环会话构造 | 空助手占位继续发给接口 | 不再加入空/中断占位；兼容既有会话时仅略过完全空的助手占位，成功工具轮、用户需求和不透明思考续接字段仍保留 |
| provider 的 `_responseInfo`、`_parseResp`、SSE解码 | `insufficient_system_resource` / `aborted` 未识别；其中完整的工具前缀可能被执行 | 明确识别生成中断，整批不执行；不向模型回传半轮内容；诊断仅含枚举、字数、预算，不含响应正文/思考/凭据 |
| provider 的 `handleFailure` | 明确的 `Thinking mode does not support this tool_choice` 也退化成无 tools 请求 | 仅省略被拒绝的 `tool_choice: auto` 重试一次，保留 tools、历史思考、取消和预算；不会关闭思考模式 |
| `web/editor-authoring-agent-ui.js`，两个编辑器HTML入口 | 缺少输出上限的状态名称、旧资源查询戳 | 明确输出上限状态；同步正式/预览编辑器的 provider/core 资源查询戳，无版本盖戳 |

这里的“成功协议”是返回了可解析工具信封的模式，不代表模型完成了任务。原有工具授权、参数/引用校验、失败写入账、todo、质量闸、案卷租约、批准和分离草稿仍负责判定能否修改/完成。JSON-only 接口成功后仍保留 JSON 模式，不强迫所有接口使用原生工具。

协议参考：[DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)、[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)。它们证明思考续轮及中断结束枚举的契约，**不证明玩家中转的实际实现与官方相同**。

## 回归证据

所有专项均调用工作树实际 provider/core；只有 HTTP 和测试等待被受控替换。没有读取玩家 API 密钥，没有用成功 caller 桩替代工具实现。

- 新专项 `web/scripts/smoke-authoring-response-recovery.js`：最终同一适配器基线 **3 PASS / 11 FAIL**（退出1），修复树 **14 PASS / 0 FAIL**（退出0）；这是行为检查数，不是11个独立玩家缺陷。
- 既有思考续接13、兼容接口14、流式协议21项通过。
- `scripts/electron/authoring-response-recovery-cases.cjs` 接入现有强制 `--authoring-continuation` 门禁，实际 BrowserWindow、正式 main/preload、UI按钮、草稿批准、IPC保存/读回；受控中转，独立临时 userData，阻断外部网络。
- Electron33.4.11 / Node20.18.3：首次 **21 PASS / 1 FAIL**，失败为原有恢复按钮祖先 opacity 的即时断言；本轮4项新业务检查均通过。未修改该旧断言；重复执行整组 **22 PASS / 0 FAIL**。保留首次失败，不将重复成功说成已查明消除了该偶发边界。
- 测试主机 Windows，CLI Node24.14.0；不是签名安装包、安卓或线上中转验收。

原始27条命令、退出码、被测HEAD/工作区状态、日志哈希及10个被测文件哈希见配套 [执行索引](evidence/guoshi-response-recovery-20260911.json)。所有原始日志保留在本工作树忽略目录 `web/dev-tools/new-scenario/response-*`，Electron原始报告在 `web/dev-tools/electron-bridge/`；无远端 artifact，未获远端交付授权。测试是在起点HEAD+本轮工作树改动上执行；最后提交不再改运行时代码，文件哈希为具体被测内容凭证。

## 实际玩家式创作的边界

上一轮真实鼠标创作看到：大批刘备请求结束于 length、正文0/思考28373字；小批写出21处草稿后空响应，点击继续仍空。本轮以等价行为测试确认并修复本地恢复链问题，**尚未取得这些旧响应的脱敏原始HTTP信封，不能把 unknown 武断归因为服务资源不足，也不能宣称中转已恢复**。

本轮 Computer Use 只读确认原窗口仍有21处修改、4势力/4人物，未丢弃/自动应用。旧页面内存中的引擎不会因磁盘文件改动而更新；重载前必须安全保存阶段成果，不能直接刷新丢掉未应用草稿。完整18人物刘备剧本、开局可玩性及真实API的大任务成功率不属于本轮已通过结论。

## 生成物与最终门禁

官方剧本仍以仓根JSON为真源，官方同步没有修改原始剧情或派生正文。热更清单通过官方生成器使用原工作树的410项真实资产作为overlay，只刷新本轮5个运行时文件；版本仍1.3.4.11，条目仍1097，没有删减资产或手改hash。

| 实际命令（仓库根；日志工具为每次运行保留独立目录） | 结果/退出码 |
|---|---|
| `node web/scripts/smoke-authoring-response-recovery.js` | 14 PASS / 0 |
| 同一脚本 `--source-ref d87cbf606db85c90d1349283446d51c27269e087` | 3 PASS、11 FAIL / 1，预期基线失败 |
| `node web/scripts/ci-smokes.js` 最终运行 | 939个唯一脚本，937 PASS、0 FAIL、0 SKIP、2 WAIVED（7项既有缺资产检查）/ 0 |
| `node web/scripts/lint-arch-all.js` | 13 PASS / 0 |
| `node scripts/verify-release-contract.js` | 166 PASS / 0 |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS / 0 |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS / 0 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | PASS / 0，410个缺席资产仍保留在正式清单 |
| `node scripts/verify-electron-bridge.js --authoring-continuation` | 首次21 PASS/1 FAIL，重跑22 PASS / 0；见上文保留边界 |
| 同上 `--authoring-boundaries` / `--authoring-recovery` | 20 PASS / 17 PASS，均退出0 |
| 三份原有 smoke：`smoke-authoring-document-lease.js`、`smoke-authoring-tool-authorization.js`、`smoke-authoring-completion-recovery.js` | 8 / 11 / 22 PASS，均退出0 |
| `node web/scripts/smoke-guoshi-cc-port.js` | 最终161断言通过 / 0 |
| `git diff --check` | PASS / 0 |

全量首次936 PASS、1 FAIL、2 WAIVED；唯一失败是旧 `smoke-guoshi-cc-port.js` 的措辞选择器。后续该脚本又检出了两个旧截断策略断言。适配仅改：按真实待办进入后续会话而非提示开头查找、验证第二次扩展到已有16000上限、将“第三次截断后继续请求直到成功”收紧成“第三次截断停止且保留恢复点”。未删除检查，没有修改资产豁免，所有失败日志保留。全量最终 runId=`15848599-fd1b-4685-833b-b7616f6de1cd`。

原启动目录的5个文件在确认原字节等于起点后才同步，先备份至 `web/backups/guoshi-response-33c992db-35e7-4875-8b0a-f570c9ab2587`；读回与修复工作树逐字节相同。补丁上下文造成的9个HTML行尾差异已按原行尾恢复，没有整文件CRLF/LF转换。其余原工作树改动和本机数据未覆盖。
