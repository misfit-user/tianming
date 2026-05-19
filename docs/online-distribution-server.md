# 在线更新与工坊服务器部署说明

服务器不是必须的：GitHub Pages 也能托管热更新和工坊目录。自有服务器的好处是容量、带宽、访问统计、灰度发布和后续账号体系更可控。

当前已部署在：

```text
https://api.themisfitserspeople.top/tianming/
https://api.themisfitserspeople.top/tianming-api/health
```

推荐长期独立域名仍是 `update.themisfitserspeople.top`。等 DNS 指向服务器并签好证书后，可以把客户端默认源迁过去。

## 需要准备

- 一个域名，例如 `update.example.com`。
- 域名 A 记录指向服务器公网 IP。
- HTTPS 证书，推荐 Caddy 自动签发，或 Nginx + Certbot。
- 不建议使用裸 IP 做生产更新源；客户端默认要求 HTTPS，裸 IP 通常无法获得常规浏览器信任证书。
- 不建议用 `root` 密码做长期发布账号；建议新建低权限 `deploy` 用户，仅允许写入发布目录。

## 推荐目录结构

```text
/srv/tianming/
  releases/win/
    latest.yml
    天命-测试版1.2.0.0-x64.exe
  hot/
    hot-latest.json
    tianming-hot-1.2.0.1.zip
  workshop/
    catalog.json
    packs/
      sample.tm-pack
```

对应地址：

```text
https://api.themisfitserspeople.top/tianming/releases/win/
https://api.themisfitserspeople.top/tianming/hot/hot-latest.json
https://api.themisfitserspeople.top/tianming/workshop/catalog.json
https://api.themisfitserspeople.top/tianming-api/health
https://api.themisfitserspeople.top/tianming-api/hot/latest
https://api.themisfitserspeople.top/tianming-api/workshop/catalog
```

## 游戏内在线服务 API

当前服务器上运行 `tianming-online.service`，由 OpenResty 转发：

```text
/tianming-api/ -> http://127.0.0.1:39127/
```

已提供：

- `GET /health`：游戏内联网服务状态、能力开关、端点列表。
- `GET /hot/latest`：读取热更新清单。
- `GET /workshop/catalog`：读取在线工坊目录，会合并静态目录与账号作者登记发布的动态目录。
- `GET /account/status`：账号系统状态。
- `POST /account/register`：注册账号并返回登录 token。
- `POST /account/login`：登录账号并返回登录 token。
- `GET /account/me`：按 `Authorization: Bearer <token>` 返回当前用户。
- `POST /account/logout`：注销当前 token。
- `POST /workshop/publish`：登录作者登记发布已托管的 `.tm-pack` 元数据。

客户端会在“内容管理 -> 联网总览 / 账号登录 / 创意工坊”里调用这组 API。API 不可用时，游戏仍可离线启动，本地存档、本地剧本和本地工坊不受影响。

## 账号与在线工坊

当前账号系统使用服务器本地 SQLite 保存用户、session 与动态工坊目录：

```text
/opt/tianming-online/data/tianming-online.sqlite3
```

密码使用 PBKDF2-HMAC-SHA256 加盐保存；客户端只保存 token 和公开用户信息，不保存明文密码。账号登录不是启动门槛，只用于在线工坊作者身份和后续云存档、订阅、分组更新等联网能力。

在线工坊发布分两步：

1. 作者先把 `.tm-pack` 托管到 HTTPS 地址。
2. 在游戏内登录账号，登记标题、版本、简介、标签、下载地址、SHA256 和大小。

登记成功后，`GET /workshop/catalog` 会返回该内容，其他玩家可在游戏内刷新目录并安装。真正的二进制上传通道后续可以接对象存储或服务器上传接口。

## Caddy 示例

```caddyfile
update.example.com {
  root * /srv
  file_server

  header {
    Access-Control-Allow-Origin "*"
    X-Content-Type-Options "nosniff"
  }
}
```

## Nginx 示例

```nginx
server {
  listen 443 ssl http2;
  server_name update.example.com;

  root /srv;

  add_header Access-Control-Allow-Origin "*" always;
  add_header X-Content-Type-Options "nosniff" always;

  location /tianming/ {
    try_files $uri =404;
  }
}
```

## 工坊 catalog.json

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

客户端会把相对 `packageUrl` 按 `catalog.json` 所在目录解析，并在安装时校验 `sha256`。

## 发布流程

1. 正式安装包更新：打包后上传 `latest.yml` 和安装包到 `releases/win/`。
2. 热更新：运行 `node web\tools\build-hot-update-package.js --version x.y.z.n --out release-hot`，上传生成的两个文件到 `hot/`。
3. 工坊：作者登录后登记已托管 `.tm-pack`；官方也可继续维护静态 `workshop/catalog.json`。
4. 客户端打开“内容管理 -> 游戏更新 / 创意工坊”，检查更新或刷新在线工坊目录。
