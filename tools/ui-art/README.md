# 新前端素材管线

新前端（`web/ui/`）的二进制资产不进 git，全在 `web/ui/assets/` 下，由本目录的脚本从源件重建，逐件记在 `web/ui/assets/manifest.json`（字节、sha256、重建方法）。

- 源件常驻 `D:/tianming-ui-rebuild-20260926/`：`art/`（生图原稿 r3、r4，公有领域名画 pd）、`fonts/`（字体原件，均 OFL）、`dem/tiles/`（高程瓦片缓存）。不放 Temp。
- 美术源件（生图）的描述由 Claude 写，Codex 原样执行生图；原图不得裁剪缩放（见 `art/r4/instruction.txt`）。

## 重建

| 资产 | 命令 | 备注 |
|---|---|---|
| 字体分片 `fonts/` | `python tools/ui-art/fonts/build-fonts.py` | 按游戏用字频率切 woff2，写出 `web/ui/kit/fonts.css` |
| 书房贴图 `study/tex/` | `python tools/ui-art/tex/make_textures.py` | 源件目录可用 `TM_ART_SRC` 改 |
| 屋子 `study/room.glb` + 光照贴图 `study/room-lightmap.hdr` | `blender -b --factory-startup -P tools/ui-art/blender/build_room.py -- <出目录> bake=2048 samples=192` | Blender 5.2（`D:/tools/blender-5.2.2-windows-x64`）；烘光约 5～7 分钟，降噪另起 Blender 跑 `denoise_hdr.py`。改屋子几何必须重烘 |
| 案上器物 `study/props.glb` | `blender -b --factory-startup -P tools/ui-art/blender/build_props.py -- <出目录>` | |
| 真实高程 `map/dem.png` | `python tools/ui-art/map/build_dem.py` | 拼 Terrain Tiles 第 6 级，瓦片缓存目录可用 `TM_DEM_TILES` 改 |
| 舆图干流 `web/ui/scene/map/trunks.js`（进 git 的源码数据） | `node tools/ui-art/map/build_trunks.cjs` | 取 Natural Earth 50m 大河（经 `web/preview/img/east-asia-basemap-data.js`），换到舆图世界坐标、首尾接成干流；只用来给山河境细河分干支、题河名 |

出目录省略时默认写进 `web/ui/assets/` 对应处。重建完跑：

```
node tools/ui-art/manifest.cjs build    # 重写清单
node tools/ui-art/manifest.cjs check    # 核对（发版前置：缺、改、多一律报出）
```

## 运行时的取舍

- 舆图地形场（模糊、起伏范围、海岸距离）不预先烘好，而是开局时在显卡上由 `dem.png` 现算（`web/ui/scene/map/fields.js`，约 1.5 秒；不支持浮点离屏的设备退回 CPU）。所以没有「场」类资产要维护。
- 案面、立轴、匾、楹联等程序画的大贴图首次画完存进 IndexedDB（`web/ui/core/texcache.js`），之后直接取。
