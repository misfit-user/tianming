# 七项玩家反馈修复

本批基于 `235711963ce263d4c92962728914de49f62aa58a`，在独立分支 `codex/fix-seven-ui-settings` 开发，保留此前玩家反馈与国师修复。只做本地代码与隔离验证，未改原工作区、玩家存档或真实 API 设置；未推送、合并、部署、改版本或打安装包。

## 七项对应结果

1. **国帑／内帑叠层**：共用“只保留最新详情”规则。正式顶栏右键国帑→内帑→国帑，只显示最后一个；空白关闭后没有旧抽屉再浮上来。左键的既有摘要卡行为与双击入口保留。实现位于 `tm-topbar-vars.js`、`tm-guoku-panel.js`、`tm-neitang-panel.js`。
2. **央地分账显示内部 ID**：表格从当前世界地区数据按稳定 ID 查名称，兼容旧的地区名键，缺数据明确显示“地区未载”；ID 只作鼠标悬停核查，不改财政账本或行政归属。表头改为不限定朝代层级的“地区”。实现位于 `tm-var-drawers.js`。
3. **户口下方错误的 0 户**：读取结构化户口、独立户数、人口明细及明确的旧文本户数，不根据人口猜户数。缺失显示“户数未载”，真正的零仍显示 0 户，人口为零也保留。实现位于 `tm-endturn-province.js`。
4. **帮助切页闪烁／导航跳位**：只替换标题和正文；固定外框，左侧列表和滚动位置保留，当前主题按钮状态就地更新。无效主题不能破坏当前页面。保留原有墨金配色与书卷风格。实现位于 `tm-help-social.js`。
5. **主副 API 拉取模型与 thinking**：两处 Model_ID 旁新增拉取按钮、列表内搜索、手动填写与选择。读取当前输入框尚未保存的 URL/Key，不把常用模型冒充接口返回值。可分别保存 thinking 默认／开启／关闭，并为中转别名选择协议。配置真正进入文字、消息、流式和工具调用；国师读取共享主 API 配置。
6. **右栏二次点击不能关闭**：同一按钮再次点击关闭当前抽屉，换按钮切到新内容；官制独立页再次点击返回御案。程序调用 `openPanel` 仍保持幂等刷新，不被误当成用户的二次点击。保留栏按钮本身，减少重绘与焦点丢失。实现位于 `phase8-formal-bridge.js`。
7. **删除议事清册重开圣旨页**：只删除对应卡片、更新数量和空态；不重开面板，不重建正文输入框，保留已输入内容、选区、焦点和滚动位置。连续删除使用原索引，不会误删相邻建议。实现位于 `phase8-formal-drafts.js`。

## API 边界与质量

- 新模块为 `tm-api-models.js`、`tm-api-settings.js`、`tm-ai-request-options.js`。不填 thinking 时不新增请求参数；不是自动给所有模型降级为不思考。受服务商限制的型号会明确报配置错误，不能通过“隐藏思考文本”伪装关闭。
- 模型列表只发 GET，不做推理，不自动保存或发送到别的站点。请求禁止重定向、Cookies 和缓存；20 秒截止涵盖响应正文。关闭、重开、换地址或密钥会取消旧请求，迟到结果不能落到新面板。分页最多 20 页，未全取会明确标注；可继续手填，不宣称列表代表推理额度。
- 模型 ID 作为纯文本显示，保存后再打开也转义；不把返回值插入事件处理器，不展示服务商原始错误正文或密钥。
- thinking 在 SC1 最终预算核算之前加入；已通过预算核算的请求在发送时不再被当前设置改写。使用 OpenAI 新输出字段时总输出上限数值不变。提示词、工具定义、历史思考、校验与重试边界不因开关被裁减。格式修复继承原请求的思考设置快照。
- 支持的参数基于官方协议：OpenAI 使用 `reasoning_effort`，具体可关闭范围取决于型号。[OpenAI 推理说明](https://developers.openai.com/api/docs/guides/reasoning)。模型列表按 GET `/models` 返回的 ID 供选择。[OpenAI 模型列表](https://developers.openai.com/api/reference/resources/models/methods/list)。
- DeepSeek 使用顶层 `thinking`，Qwen 兼容接口使用 `enable_thinking`，OpenRouter 使用 `reasoning.enabled`。[DeepSeek](https://api-docs.deepseek.com/guides/thinking_mode/)、[Qwen](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions)、[OpenRouter](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)。
- Gemini 原生与 OpenAI 兼容接口各自使用对应的 thinking 配置；不能关闭的系列不假装支持关闭。[Gemini thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking)、[兼容接口](https://ai.google.dev/gemini-api/docs/openai)。Claude 原生的已识别自适应系列使用 adaptive，旧型号需要手动预算时明确提示保留默认，不私自压低输出或放宽强制工具要求。[Claude thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)。

## 验证与失败留档

最终全量 `ci-qA3Szc` 已完成：**950 executed，948 PASS、0 FAIL、0 SKIP、2 个既有 WAIVED（7 条缺席资产断言）**。正常用例并发8，硬时限用例原样独占执行；完整回合42.6秒、锁恢复11.7秒，未改变压力、期限或豁免。

- 实际生产 main/preload/renderer、临时用户目录的 Electron 综合回归 **23 PASS**，含真实鼠标右键命中、动画结束后的圣旨保留和实际请求体检查。
- API 列表与思考单测 **19 PASS**；国师真实 provider 思考与完整响应恢复 **4 PASS**；原 provider 回归 **21 PASS**；SC1 最终请求预算回归通过。
- 保存一致性 **81 PASS**，请见角标语义 **24 PASS**；旧真实侧栏回归 **16 PASS**，圣旨润色 **15 PASS**。
- 架构 **13/13**，官方剧本对账 **27**，发布契约 **166**，热更构建闸 **27** 均通过。
- 同族缓存戳一起更新，启动清单覆盖 **414** 个脚本；热更清单生成器核对 **1101** 项，完整保留 **410** 个未跟踪资产、**806161938** 字节。只是清单维护，未发布。

首轮全量 `ci-9Q90UN` 为 945 PASS、3 FAIL、2 个既有 WAIVED，共 950 项。三处失败对应隔离 fixture 缺浏览器 window、模拟节点缺 dataset、启动脚本数旧常量。补齐浏览器表面及新模块精确加载断言，未删除保存／角标断言、增添豁免或放宽期限。旧 Electron 侧栏测试曾用按钮入口刷新数据；改用既有幂等 `openPanel` 后原人数／拒见／请见断言全部通过，按钮切换在新综合测试独立验证。

一次重跑没有完成回执，标作未证实、不算通过；初始 CSP 测试包装错误、旧顶栏隐藏节点误选、构建闸路径拼错等原始日志均保留。截图曾在合成器尚未重绘时捕获旧帧；动画后再次读取真实 DOM、等待绘制后截图，确认空清册与输入选区同时保留，并非靠截图声称数据正确。

具体文件哈希、原始命令日志、失败与最终报告、已查看截图见 `docs/evidence/seven-ui-settings-20260912.json`。未使用玩家真实中转做收费验证，无法替服务商保证支持所有别名及所有思考协议；不支持时保留手动填写和模型默认，错误明确可见。
