# 天命热更新包格式

热更新只覆盖 `web/` 前端资源：HTML、JS、CSS、剧本、地图、立绘、音频、字体、文档等。以下内容不能靠热更新替换，必须走安装包更新：

- `main.js`
- `preload.js`
- Electron 版本
- 原生依赖、安装器、系统权限

## 服务器目录

推荐目录：

```text
https://api.themisfitserspeople.top/tianming/hot/
  hot-latest.json
  tianming-hot-1.2.0.1.zip
```

客户端默认读取：

```text
https://api.themisfitserspeople.top/tianming/hot/hot-latest.json
```

生产环境要求 HTTPS；只有本机调试允许 `http://localhost`。

## hot-latest.json

```json
{
  "type": "tianming-hot-update-feed",
  "version": "1.2.0.1",
  "packageUrl": "tianming-hot-1.2.0.1.zip",
  "sha256": "zip 文件 sha256",
  "size": 123456,
  "notes": "本次热更新说明",
  "generatedAt": "2026-05-19T00:00:00.000Z"
}
```

规则：

- `version` 必须严格高于当前前端版本，否则客户端拒绝安装。
- `packageUrl` 可以是相对地址，也可以是 HTTPS 绝对地址。
- `sha256` 存在时必须与下载到的 zip 完全一致。

## zip 内 manifest.json

```json
{
  "type": "tianming-hot-update",
  "version": "1.2.0.1",
  "entry": "index.html",
  "minAppVersion": "1.2.0.0",
  "generatedAt": "2026-05-19T00:00:00.000Z",
  "files": [
    {
      "path": "index.html",
      "sha256": "文件 sha256",
      "size": 1234
    }
  ],
  "remove": []
}
```

客户端会逐项检查：

- 路径不得越界，不得包含 `..`。
- 扩展名必须是允许的前端资源类型。
- 每个文件必须存在。
- `size` 和 `sha256` 必须匹配。
- 安装后必须有 `index.html`。

## 生成命令

在项目根目录执行：

```powershell
node web\tools\build-hot-update-package.js --version 1.2.0.1 --out release-hot --notes "修复回合结果显示"
```

输出：

```text
release-hot/hot-latest.json
release-hot/tianming-hot-1.2.0.1.zip
```

把这两个文件上传到服务器的 `hot/` 目录即可。

## 回滚

客户端保留上一版热更目录。玩家可以在“内容管理 -> 热更”里：

- 暂停热更，回到安装包内置前端。
- 回滚上个热更版本。
- 重新载入前端，让变更立即生效。
