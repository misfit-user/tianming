# 国师升级第三批与近期成果集成交付

## 本轮范围

从 `cbce229fa04a8aa317d2de94eebbfd0bb6442922` / `codex/guoshi-recovery-completion` 新建 `codex/guoshi-efficiency-quality`；开工远端 main 为 `f102b56585faa48c47d362a91c5260f4cee1b8eb`。用户授权补完原国师第三批，然后统一推送、正常 PR 合并近期成果，**不发版**。

此前8个国师提交和6个建筑提交均保留。本轮不收其他历史分支或原 `tianming` 工作树未提交变更；不改版本、不强推、不删用户数据、分支或恢复材料。

## 已实施

- `editor-authoring-agent.js`：默认连续8轮无新事实或真实写入即以 `noProgress` 停止，保留上一批同案卷续做能力。重复读取、同错、no-op、note/todo 空转不能刷新预算；有新读取/真改动可以推进。原总迭代/token/重试上限没有增大。
- 长指令保真：原始用户输入单独附于本地消息元数据；宏压缩后继续携带完整原话，再次压缩也不丢。默认保留上限32000字符，超限明确 `instruction-retention-limit`，不截半条指令或静默挑掉后部。元数据不额外发给 provider 或重复算入上下文估算。旧会话兼容解析只去明确的系统构建附文。
- 按阶段工具：普通作者首发轻工具集；真写入后补上 validateDraft/preflight；新 `requestTools` 仅展开本模式允许的既有工具，下一轮才允许执行。显式 tools/工具包仍由调用方决定；问策不能借此申请写工具，范围/危险操作守卫照旧。
- `editor-authoring-agent-provider.js`：OpenAI/Gemini/Anthropic usage 归一化；Anthropic SSE 合并 start/delta 中分开的输入输出计数；JSON、SSE和文本兜底保留 usage。传输层统计实际 HTTP 尝试/重试，core 按逻辑请求、回复、已报告 tokens、请求经过时间聚合；编排含计划阶段，续做保留累计。缺 usage 显示未知/不完整，不装成零消耗，不声称精确账单或主线程耗时。
- 叶路径写回执：普通单路径/批量字段编辑只编码实际目标值，保留完整区段写前外部变更守卫；跨区段/地图继续走原完整证据。失配、同长度修改、非法 multiEdit 参数均有行为断言。读取字段被手工改过时不使用旧去重占位。
- `tm-agent-kernel.js` / `scenario-editor-sandbox-bridge.js`：快测开始同步冻结输入，SHA-256异步计算；报告包含 exact input fingerprint。国师读取快测报告时检查当前草稿是否匹配；无指纹旧报告/不同输入只当历史参考，指纹不是模型质量认证。
- `fieldContract` 官制查询补充真实的候选来源路径及覆盖条件，明确势力自有官制、government.nodes、顶层officeTree的优先关系，不静默把所有镜像都改一遍。
- 用量沿用原 `/用量·上下文` 卡；未增加新自治模式或独立游戏操作入口。

## 回归与实测

- 新 `web/scripts/smoke-authoring-efficiency.js`：12组，实际 core/provider/kernel，涵盖正常/异常/恢复/权限、三类provider usage、压缩和回执。支持 `--source-ref` 调用真实 Git 源文件。首批5组对旧代码1 PASS/4 FAIL；后来补充字段来源检查先11 PASS/1 FAIL，再实施修复。
- `smoke-quicktest-multiturn.js`：保留原49断言，增加“开始后对象变化也不能改变报告输入指纹”；50 PASS。
- 相关20脚本、13项架构守卫通过；原工具专项明确选择其要测试的 history 包，不降低原断言。
- 原39轮 SSE 回归仍要求恰好39轮、最终实际写入/保存重读/取消与错误恢复。前37轮改为37个不同的合成字段核查；重复同参48轮原本就是本次要阻止的行为，不能为了保留旧夹具而关闭空转保护。
- 新真实 Electron 门禁 `node scripts/verify-electron-bridge.js --authoring-efficiency`；再带 `--scenario sc-jianyan1-1127-shaosong`。每个进程一个官方样本，10条检查：5基础桥接+5业务组。真实 main/preload/editor/provider/IndexedDB/开局消费者，只有模型回复和故障时序受控。外网阻断、临时 userData、未打包；不冒充原生鼠标、付费模型或安装包验收。
- 实际保存重读之后，两个官方剧本均从 canonical guoku/neitang 初始化到900123/123987且三镜像相等；民心77在真正的叶子pin边界落位；正式官制描述读取已编辑的实际来源。开局后仍可发生原有结算，不强行把最终财政/月收入/民心钉成输入值。
- 字段覆盖、批量改名、旧档、地区路径继续由既有实际工具/保存/运行时 smoke 和 Electron模式回归；本轮不把一个合成任务集说成所有玩家剧本/所有LLM输出均已证明。

## 中间失败及纠正

1. 初次 Electron 去游戏页仍带着本测试的合成 API 配置，凭据前置检查正确失败；清除仅该临时测试写入的 `tm_api` 后重跑，未使用玩家配置。
2. 两个大官方样本共用一个进程曾触及原90秒门禁；拆成各自独立临时环境，没有增加超时或豁免。
3. 绍宋缺部分行政 `level`，既有 `EconomyGapFill.buildHierarchyFromAdminDepth` 在游戏初始化补齐。测试原先把游戏临时输入也要求逐字节不变，超出该真实协议；改为与实际既有初始化器生成的期望逐字节比较，同时保留编辑器live/保存源与官方原文件不变断言。经济初始化器没有修改。
4. 绍宋顶层officeTree只是兜底，玩家势力的 `factions[0].officeTree` 最终覆盖它。实际消费者测试抓到只改兜底无效，于是增加字段契约来源提示，再按它的真实来源重测；不是删掉“实际生效”断言。
5. 民心从77在开局结算后可到76.75，测试改在实际pin边界严格断言77，同时记录并验证开局结果有限非负；未为测试改游戏数值。
6. 同步hash期间最后一行core统计改动导致一次 stale，原始失败保留并重新运行官方生成器；不手填hash。

## 成本证据（不等于整局提速）

可复跑：`node scripts/perf/guoshi-cost.cjs [--source-ref cbce229fa04a8aa317d2de94eebbfd0bb6442922]`。

同官方文件哈希、每样本一次预热+7次实际 core 循环：首发工具28→16；工具schema字符9166→5638；人物叶路径写回执所编码字符，天启619917→72、绍宋1635017→72。所有保护仍在。

原始 Node分布保存在 `web/dev-tools/perf-round1/guoshi-efficiency-cost-before-65e2b400-821e-4dde-9fcb-865eadb90c54/` 与 `guoshi-efficiency-cost-after-31faad9e-ec43-4185-b5fd-1b91c60fdc67/`。环境Windows/Node24.14/i5-13420H；部分时段有Electron任务并行，**不把耗时差异作为干净性能结论**。本轮可确定的是发送工具体积、重复编码体积和受控空转请求数减少。整段大剧本复制、首轮摘要/结构质量检查仍是较重本地路径，真实网络及模型费用未测。

## 兼容边界

恢复仍是当前页面的 opaque 内存恢复点，未承诺刷新/崩溃后续跑。旧对话/旧快测数据保留，不强行删除或归属当前案卷。大原始指令超过保留上限需拆任务，不通过提高原token预算接纳。报表usage只累计服务商确实提供的字段，不含未知失败请求的计费、第三方价格或外部工具费用。

各轮原始日志由 `scripts/perf/run.cjs` 记录 HEAD、dirty文件hash、命令、退出码和环境。最终集成/远端CI的提交与结果另见交付证据，不能拿本文件的早期局部通过代替组合门禁。
