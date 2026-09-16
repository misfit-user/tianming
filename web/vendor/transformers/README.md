# transformers.js 离线打包

本目录提供 `@xenova/transformers` 2.17.2 的 ESM 打包·让本地语义检索（tm-semantic-recall.js）可在断网环境运行。

## 文件清单

| 文件 | 来源 | 用途 |
|---|---|---|
| `transformers.esm.js` | jsdelivr `@xenova/transformers@2.17.2/+esm` | 主库（依赖路径已改为相对） |
| `jinja.esm.js` | jsdelivr `@huggingface/jinja@0.2.2/+esm` | Jinja2 模板引擎（tokenizer 用） |
| `onnxruntime-web.esm.js` | jsdelivr `onnxruntime-web@1.14.0/+esm` | ONNX 运行时浏览器版 |
| `onnxruntime-common.esm.js` | jsdelivr `onnxruntime-common@1.14.0/+esm` | onnxruntime-web 依赖 |

## 加载顺序

`tm-semantic-recall.js` 会优先尝试本地路径：

```js
await import('./vendor/transformers/transformers.esm.js')
```

本地失败时回退到 jsdelivr · 再失败回退到 esm.sh。

## 模型文件（不在本目录）

bge-small-zh-v1.5 的量化模型、配置与 tokenizer 随全量安装包放在 `web/vendor/models/Xenova/bge-small-zh-v1.5/`。运行时优先探测这些本地文件，并禁止本地加载失败时悄悄转为远程下载。未提供本地模型的网页部署，只有玩家显式开启远程回退后才尝试下载。

全量安装包不依赖之前下载过模型的缓存；首装也可离线启用。`file:` / `capacitor:` 不使用不支持这些协议的 Cache API。

模型文件清单可从 https://huggingface.co/Xenova/bge-small-zh-v1.5/tree/main 下载。

## WASM 文件

四个 `ort-wasm*.wasm` 已随包提供，与上方 ESM 的 `onnxruntime-web@1.14.0` 严格配套。主线程与 Worker 都通过 `env.backends.onnx.wasm.wasmPaths` 指定本目录，不依赖默认 CDN。

`wasm-manifest.json` 记录官方 npm 包完整性值及各文件 SHA-256；授权和第三方声明见 `onnxruntime-LICENSE.txt`、`onnxruntime-ThirdPartyNotices.txt`。配置依据：[Transformers.js 本地资源文档](https://huggingface.co/docs/transformers.js/v2.17.2/custom_usage)、[ONNX Runtime Web 部署文档](https://onnxruntime.ai/docs/tutorials/web/deploy.html)。

`node scripts/verify-semantic-offline.cjs` 从仓根执行：使用全新 Electron 隔离目录、生产 CSP、阻断所有外网请求，实际加载模型并产生归一化的 512 维向量；不调用模型 API、不读取玩家配置。

## 升级

升级 transformers.js 版本时·重跑 `tools/vendor-transformers.sh`（如果有）·或手动：

```bash
curl -sL "https://cdn.jsdelivr.net/npm/@xenova/transformers@<NEW_VER>/+esm" -o transformers.esm.js
# 同样下载更新的 jinja/onnxruntime-web/onnxruntime-common
# 用 sed 把 /npm/X/+esm 改为 ./X.esm.js
```
