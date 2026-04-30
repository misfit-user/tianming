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

bge-small-zh-v1.5 模型（~96MB）由 transformers.js 在首次启用时自动下载到 IndexedDB 缓存。**Electron 离线场景下需要先在线启用一次**，让模型缓存到 IDB·之后即可离线使用。

如需完全离线：

```js
// 在 tm-semantic-recall.js 启用前
transformers.env.localModelPath = './vendor/models/';
transformers.env.allowRemoteModels = false;
// 把 bge-small-zh-v1.5 的 onnx + tokenizer 文件放到 web/vendor/models/Xenova/bge-small-zh-v1.5/
```

模型文件清单可从 https://huggingface.co/Xenova/bge-small-zh-v1.5/tree/main 下载。

## WASM 文件

ONNX 运行时的 .wasm 文件由 onnxruntime-web 在加载时按需下载。jsdelivr 的 `+esm` bundle 内置了 wasm fetch 路径·指向 jsdelivr CDN。完全离线还需手动 vendor `ort-wasm.wasm` / `ort-wasm-simd.wasm` 等到本目录。

## 升级

升级 transformers.js 版本时·重跑 `tools/vendor-transformers.sh`（如果有）·或手动：

```bash
curl -sL "https://cdn.jsdelivr.net/npm/@xenova/transformers@<NEW_VER>/+esm" -o transformers.esm.js
# 同样下载更新的 jinja/onnxruntime-web/onnxruntime-common
# 用 sed 把 /npm/X/+esm 改为 ./X.esm.js
```
