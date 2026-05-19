# 天命工坊包格式

桌面版支持导入 `.tm-pack`、`.zip` 或单个剧本 `.json`。`.tm-pack` 本质是 zip 包，包内必须包含 `manifest.json`。

也支持服务器发布在线目录 `catalog.json`。玩家在“内容管理 -> 工坊”里刷新目录后，可以直接在线安装目录中的 `.tm-pack`。

## manifest.json

```json
{
  "id": "example-tianming-scenario",
  "title": "示例剧本",
  "version": "1.0.0",
  "type": "scenario",
  "entry": "scenario.json",
  "author": "作者名",
  "description": "剧本简介",
  "tags": ["明代", "架空"]
}
```

字段说明：

- `id`：包 ID，只允许英文字母、数字、点、短横线、下划线。重复 ID 导入时需要覆盖。
- `title`：玩家在工坊管理里看到的名称。
- `version`：内容包版本。
- `type`：目前正式支持 `scenario`。
- `entry`：入口剧本 JSON，默认 `scenario.json`。
- `author`、`description`、`tags`：展示字段。

## 允许的文件类型

- 数据：`.json`、`.geojson`
- 图片：`.png`、`.jpg`、`.jpeg`、`.webp`、`.bmp`
- 音频：`.mp3`、`.ogg`、`.wav`
- 文本：`.md`、`.txt`、`.csv`

工坊包不得包含脚本、网页、可执行文件、快捷方式、注册表文件或符号链接。单包总大小上限为 250MB。

## 剧本数据规则

单剧本包可以直接把完整剧本放在 `scenario.json`，也可以使用带 `scenarios`、`characters`、`factions`、`variables` 等数组的工程式 JSON。

导入后：

- 启用的剧本包会在“开卷”前合入剧本列表。
- 剧本选择页会标记“工坊”。
- 停用或卸载包后，当前内存中的对应剧本、人物、势力、变量等会被移除。

## 包内资源引用

工坊包内的立绘、地图、音频等资源可以随包一起放入目录，例如：

```text
manifest.json
scenario.json
assets/portraits/hero.png
assets/audio/theme.mp3
```

在剧本 JSON 中引用包内资源时，请使用 `./` 或 `@pack/` 前缀：

```json
{
  "portrait": "./assets/portraits/hero.png",
  "bgm": "@pack/assets/audio/theme.mp3"
}
```

游戏会在载入工坊剧本时把这些路径转换为受控的 `tm-content://workshop/...` 地址。普通 `assets/...` 路径会被视为游戏本体资源，不会自动改写。

## 在线工坊目录

```json
{
  "type": "tianming-workshop-catalog",
  "title": "天命创意工坊",
  "updatedAt": "2026-05-19",
  "packs": [
    {
      "id": "sample-scenario",
      "title": "示例剧本",
      "version": "1.0.0",
      "author": "作者",
      "type": "scenario",
      "description": "示例说明",
      "packageUrl": "packs/sample.tm-pack",
      "sha256": "tm-pack 文件 sha256",
      "size": 123456
    }
  ]
}
```

`packageUrl` 可以是相对目录，也可以是 HTTPS 绝对地址。客户端会在安装时校验 `sha256`。生产环境要求 HTTPS；本地调试允许 `localhost`。

## 在线更新发布目录

桌面本体更新使用 electron-builder generic 发布目录。发布目录应至少包含：

- `latest.yml`
- `天命-测试版...exe`
- 对应 `.blockmap`

游戏只允许安装高于当前版本的更新；等于或低于当前版本会被拒绝下载和安装。
