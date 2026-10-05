# 真实高程来源

`dem-4200x3080.png` 由 `build_dem.py` 从 AWS 开放数据集 Terrain Tiles（Terrarium 编码，第 6 级）拼接、重投影到山河境世界网格（经度 55~160°E、纬度 -10~67°N，等经纬度）。
该数据集汇编自 SRTM、GMTED2010、ETOPO1 等公开高程数据（亚洲范围主要为美国政府公有领域数据）。正式发布时在游戏致谢页注明：
"Terrain Tiles (Mapzen / Amazon Web Services Open Data) — SRTM, GMTED2010, ETOPO1"。
编码：16 位，R 高字节、G 低字节，值 = 海拔(米) + 11000。
