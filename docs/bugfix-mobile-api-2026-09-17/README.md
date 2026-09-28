# 手机端 API 请求修复与验收

设备：LAPTOP-AV4J1O7I。工程：C:\Users\37814\Desktop\tianming。
范围：项目的安卓 Capacitor 安装版请求链路；未操作真实手机、存档或已保存密钥。

## 查实的代码问题

安卓配置已启用 CapacitorHttp，AndroidManifest 已声明 INTERNET，并非缺少联网权限。
项目实际安装的 @capacitor/android 为 6.2.1。游戏原先依赖其自动 fetch 补丁：

1. POST 补丁没有处理 AbortSignal，也没有传递原生连接/读取超时。连接快检只依赖 AbortSignal，可能长期停留在等待状态。
2. 补丁只认 Content-Type/content-type 两种键及 application/json 前缀。原生已解析对象在特定头部形式下被作为 Response 文本传入，生成 [object Object]，后续 JSON 解析失败。
3. 原生桥完整返回响应，与实时流式首包不是同一能力；旧连接报告未区分这两者。

verify-vendor-bridge.cjs 直接提取并执行已安装依赖中的实际 fetch 补丁，使用合成桥接回包复现上述行为；不是另写一个有相同缺陷的替身。未改动 node_modules。
这证明存在可复现的适配缺陷，不证明用户手机上的每一次连接失败都由同一原因引起。

## 实际修复

- 在已有 tm-ai-infra-retry.js 中加入显式原生 API 传输适配器。
- 主/次推演请求、连接快检、模型探测与模型列表复用该入口；浏览器和 Electron 继续使用原 fetch。
- JSON 请求正文原样传递，不截短提示词、不削减输出上限，不改变模型参数。
- 设置原生连接/读取超时，并提供本地总等待期限与取消响应；迟到回包不能成为成功结果。
- 原生接口没有取消已发请求的 API：本地取消不等于服务器停止计算。原生超时/传输异常后不自动重复发送该 POST。
- 原生对象响应统一转换；HTTP 状态与 Retry-After 等响应头保持可读取。
- 连接快检在安卓测试连通、模型回声和严格 JSON，将流式能力标为“原生整包”，不伪报首包测速。
- 主 API 测试输入去除首尾空格；未改持久化设置。
- 不跳过证书验证、不启用明文混合内容。远程 HTTP 地址给出 HTTPS 提示；重定向不自动携带认证信息跳转。

## 修改文件

- web/tm-ai-infra-retry.js
- web/tm-ai-infra.js
- web/tm-ai-infra-model-detect.js
- web/tm-api-models.js
- web/tm-patches.js

新增 smoke-mobile-api-transport.js 与 smoke-mobile-api-integration.js，均位于 web/scripts。
原文件逐字节备份位于 originals；最终源码哈希、分支与测试摘要见 FINAL-RESULT.json。

## 验证

专项包含 14 项传输测试与 8 项生产调用集成测试。集成测试执行实际推演请求函数、连接快检、模型列表与报告渲染函数。
相关回归使用 run-smokes.js，以 ai-、api、probe、prompt-cache、platform、mobile、capacitor 为筛选词，关闭自动重试。
最终通过数量及每条输出以 final-smokes.json/log 和 FINAL-RESULT.json 为准。
vendor-comparison.json 保存本机已安装桥接实现的三组对照结果：大小写响应头、JSON MIME 形式、取消/超时。

架构守卫修前已有依赖、重复全局声明、文件大小、脚本装载/文件引用问题；本轮还观察到 renderer-writeback 检查在修前、修后均内存耗尽。
不把内存耗尽当成检查通过，也不为本修复修改守卫基线。最终完整结果见 arch-before.log、arch-final.log。

## 使用边界

所有测试在用户电脑执行，原生 HTTP 桥及回包为合成测试，不含真实密钥，不请求外部 AI。
没有安装软件、提交、推送、打包或发布；没有改动 Android 配置、生成 staging 或手机安装文件。
因此手机现有版本尚未获得这次修复，需要通过项目正式安卓更新流程发布后才能使用。桌面源码重启不等于手机自动更新。
本次不是手机浏览器/PWA 的跨域代理改造；浏览器请求保持原有安全限制。

接口契约参考：Capacitor v6 Http 官方文档 https://capacitorjs.com/docs/v6/apis/http 。

差异检查备注：默认 git diff --check 将保留的 CRLF 行尾标成空白错误；原始结果留在 diff-check-default.log。验收另以仅本进程生效的 cr-at-eol 识别原行尾，并保留三项默认空白检查；未修改全局 Git 设置、未转换源码行尾。
