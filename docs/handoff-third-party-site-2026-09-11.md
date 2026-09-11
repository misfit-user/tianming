# 给 tianming.pianyitoken.top 维护者的修复方案

这份说明可直接转发。我们已完成游戏仓库内的修复和本地验证；没有登录、修改或部署贵方服务器，没有清理玩家浏览器数据。本轮游戏代码尚未推送或发布，升级请使用后续交付的完整受检版本。

## 1. 优先修复站点自己的 Service Worker

2026-09-11 只读获取 [站点 sw.js](https://tianming.pianyitoken.top/sw.js) 返回 HTTP 200、5403 字节，SHA-256：

`20099674638f7604e091d6920272afa482484e0c83d576d8c247c34984ff8601`

这份文件的第 131 行与玩家截图一致，第 119 行也有同类写法：缓存写入 Promise 没有返回/处理；`resp.ok` 又包含 206。Cache API 明确拒绝缓存 206 部分响应，不能把它当完整资源保存。[Service Worker Cache.put 规范](https://w3c.github.io/ServiceWorker/#cache-put)

请在维护者自己的测试环境修改以下三处，核对文件哈希/内容后再套用，勿只按行号盲改：

1. `fetch` 监听器：带 `Range` 请求直接放行网络，不能先按 URL 命中整文件缓存，也不要删除 Range 请求头。
2. 第 119/131 行所在两个分支：仅缓存适合公开静态缓存的完整 HTTP 200 响应；拒绝 206、错误页面、opaque 响应和 `Vary: *`。缓存读取/写入异常必须捕获；缓存失败不应让已经成功的网络响应变成页面加载失败。
3. `applyDelta` 增量更新分支（原第 62–69 行）：同样要求完整 200 响应，并检查资源类型/发布清单中的内容校验。不要把 206、404 或返回首页 HTML 的假成功写成 JS/JSON 资源，也不要在失败后宣布整批更新成功。

最小判断片段可采用以下形式（这是接入建议，不是已经部署或完整替换过的 SW）：

```js
function mayCacheWholeStatic(request, response) {
  if (request.method !== 'GET' || request.headers.has('Range')) return false;
  if (request.headers.has('Authorization')) return false;
  if (request.cache === 'no-store') return false;
  if (!response || response.status !== 200 || response.type === 'opaque') return false;
  if (response.headers.has('Content-Range')) return false;
  const policy = response.headers.get('Cache-Control') || '';
  if (/(?:^|,)\s*(?:no-store|private)(?=\s|=|,|$)/i.test(policy)) return false;
  const vary = response.headers.get('Vary') || '';
  return !vary.split(',').some(value => value.trim() === '*');
}
```

以上判断还必须放在“已发布的公开静态资源白名单”之内，并尊重禁止缓存的请求/响应标记。现有 `isStatic` 近似覆盖全部同源路径，建议按发布文件清单收窄；API、登录、用户数据等路径不应进入静态缓存。不要因为只读 GET 就认定内容公开。

处理 Promise 时必须返回 `cache.put(...)` 的 Promise，捕获缓存异常；在事件处理函数同步阶段用 `event.waitUntil(...)` 注册涵盖缓存任务的 Promise。`respondWith(...)` 负责正常网络/缓存响应，不能依赖未处理的后台链条。若缓存读取失败，可回退网络；若网络也失败且没有有效缓存，应明确失败，不能回退成 HTTP 200 首页。

## 2. 更新游戏代码时保留完整资源与缓存一致性

本次游戏端修复涉及部队搜索、上下文/输出探测身份、JSON 正文期限、重试边界、主推演错误传播、校准正文解析、本地字体。请整体更新受检 `web` 内容与配套索引/清单，特别是新增的 `tm-ai-infra-retry.js`；不要只复制一个 JS 导致新旧模块混用。

发布新的 SW 缓存版本，确认新 worker 确实激活并控制页面；旧缓存如需淘汰，只处理贵站自己命名且已明确废弃的静态缓存。不要让玩家使用“清除全部站点数据”，不要删除 IndexedDB、本地存档、账号数据或 API 设置。玩家操作中不要强制刷新，应先提醒保存并退出当前推演。

## 3. 字体和模型资源

- 游戏端已移除被 CSP 拒绝的 jsdelivr 字体 CSS，优先使用现有本地字体。请保证 `styles.css` 与 `assets/fonts/MaShanZheng-Regular.ttf`、`assets/fonts/ZCOOLXiaoWei-Regular.ttf` 同版且可访问；不要通过放宽为任意来源样式来掩盖缺文件。
- 玩家截图还出现本地语义模型资源 404。请核对实际请求地址与发布目录；当前游戏模型配置为 `Xenova/bge-small-zh-v1.5`，关键文件位于 `vendor/models/Xenova/bge-small-zh-v1.5/` 下的 `config.json`、`tokenizer.json`、`onnx/model_quantized.onnx`。如贵站提供本地语义检索，应按游戏现有模型资源流程补齐同套资源与运行依赖。
- JS/JSON/模型路径缺文件时应返回真实 404，不能经 SPA fallback 返回首页 HTML。模型资源缺失与 API 上下文不足是不同问题；不要用静默关闭功能或降低内容质量冒充修复。

## 4. 上线前验收

1. 音频等资源的 Range 请求仍按服务器语义返回 206，正文/Content-Range 正确；控制台不再出现 Cache.put 的 206 异常，也不会被替换成错误整文件缓存。
2. 普通完整静态资源 200 可缓存；模拟缓存配额/写入失败时，成功的网络响应仍能正常使用，无 unhandled rejection。
3. 增量更新若遇 206、404、错误内容或校验不一致，应报告失败，不宣布成功更新；验证旧用户升级后加载的是同一批新脚本。
4. 新开页面及旧页面升级后，都检查字体和本地模型地址、状态码、Content-Type 与正文类型。
5. 用测试存档检查部队搜索、正常过回合，以及受控超时/取消/上下文不足时的报错和回滚。确认失败不会保存半回合，已有存档/设置不丢失。

补充判断：当前 SW 的 fetch 监听器只处理 GET，AI 请求为 POST，因此 206 缓存缺陷不能单独解释全部 AI 超时。若升级后仍有 AI 问题，请保留脱敏的响应状态、结束原因、超时阶段、上下文设置与错误码；不要收集 API 密钥或完整私有请求内容。上下文设置应依据所用模型/中转的真实容量，不能统一填一个更大数字，也不能删掉必需规则来“过关”。
