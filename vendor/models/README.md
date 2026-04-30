# vendor/models — bge-small-zh 模型预打包目录

## 状态

此目录默认为空（不入仓库）·避免 23 MB 模型污染 git 历史。

## 预下载（Electron 打包前）

```bash
# CN 友好镜像（推荐）
npm run prepare-vendor

# HuggingFace 主站
npm run prepare-vendor-hf
```

或直接：

```bash
node tools/download-bge-model.js
```

## 下载后结构

```
vendor/models/Xenova/bge-small-zh-v1.5/
├── onnx/
│   └── model_quantized.onnx     ~23 MB
├── tokenizer.json                ~1 MB
├── tokenizer_config.json
├── config.json
├── special_tokens_map.json
└── vocab.txt
```

## Electron 打包配置

确保 vendor/ 目录被打包：

`electron-builder.yml`（如果有）：
```yaml
files:
  - "**/*"
  - "vendor/models/**/*"  # 显式包含
```

或 `electron-packager`：
```bash
electron-packager . tianming --extra-resource=vendor/models
```

打包后·`tm-semantic-recall.js` 会自动检测 `window.tianming`（Electron 注入的 IPC 桥）·走本地路径加载·完全离线。

## 网页版（GitHub Pages）

不需要预下载——用户首次启用语义检索时·从 hf-mirror.com 自动下载到 IndexedDB·之后秒开。

## 验证

启动游戏 → Ctrl+M → 🔍 语义按钮 → 看 STATE：
- `loadSource: 'local-vendor'` → Electron 本地加载（最佳）
- `loadSource: 'hf-mirror'` → 网页镜像下载（中国友好）
- `loadSource: 'hf-fallback'` → 镜像失败·走主站

## .gitignore

vendor/models/ 应在 .gitignore 内。如果不在·加：

```
vendor/models/
```

避免大文件入仓库。
