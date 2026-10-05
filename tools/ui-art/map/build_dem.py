"""真实高程：从 AWS 开放数据的 Terrarium 瓦片（SRTM / GMTED / ETOPO1 等公开数据）拼出天命舆图范围的高程。

范围与游戏山河境世界坐标一致：经度 55~160°E、纬度 -10~67°N，等经纬度网格。
输出 dem-4200x3080.png：16 位高程，R 高字节、G 低字节，值 = 海拔(米) + 11000（与山河境 height.png 同一种打包方式，便于前端解码）。
用法：python build_dem.py [缩放级别=6] [输出宽=4200]
"""
import concurrent.futures as cf
import io
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image

Z = int(sys.argv[1]) if len(sys.argv) > 1 else 6
OUT_W = int(sys.argv[2]) if len(sys.argv) > 2 else 4200
LON0, LON1, LAT0, LAT1 = 55.0, 160.0, -10.0, 67.0
OUT_H = round(OUT_W * (LAT1 - LAT0) / (LON1 - LON0))
HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.environ.get('TM_DEM_TILES', os.path.join('D:/tianming-ui-rebuild-20260926/dem', 'tiles', str(Z)))   # 瓦片缓存放源件处，不进仓
URL = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
OFFSET = 11000


def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.log(math.tan(math.radians(lat)) + 1.0 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch(xy):
    x, y = xy
    path = os.path.join(TILES, f'{x}_{y}.png')
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    last = None
    for _ in range(4):
        try:
            data = urllib.request.urlopen(URL.format(z=Z, x=x, y=y), timeout=40).read()
            with open(path, 'wb') as f:
                f.write(data)
            return path
        except Exception as e:  # noqa: BLE001 瓦片服务偶尔断流，重试
            last = e
    raise RuntimeError(f'瓦片 {x},{y} 取不到：{last}')


def main():
    os.makedirs(TILES, exist_ok=True)
    x0, y0 = tile_xy(LON0, LAT1, Z)
    x1, y1 = tile_xy(LON1, LAT0, Z)
    xs = range(int(x0), int(x1) + 1)
    ys = range(int(y0), int(y1) + 1)
    todo = [(x, y) for y in ys for x in xs]
    print(f'z{Z}: {len(xs)} x {len(ys)} = {len(todo)} 张瓦片')
    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(fetch, todo))

    # 拼成墨卡托大图（米）
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), dtype=np.float32)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            im = np.asarray(Image.open(os.path.join(TILES, f'{x}_{y}.png')).convert('RGB'), dtype=np.float32)
            mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768

    # 按输出网格每个像素的经纬度，回墨卡托坐标双线性取样
    lons = LON0 + (np.arange(OUT_W) + 0.5) / OUT_W * (LON1 - LON0)
    lats = LAT1 - (np.arange(OUT_H) + 0.5) / OUT_H * (LAT1 - LAT0)
    n = 2 ** Z
    px = ((lons + 180.0) / 360.0 * n - xs[0]) * 256 - 0.5
    lat_r = np.radians(lats)
    py = ((1.0 - np.log(np.tan(lat_r) + 1.0 / np.cos(lat_r)) / math.pi) / 2.0 * n - ys[0]) * 256 - 0.5
    PX, PY = np.meshgrid(px, py)
    ix = np.clip(np.floor(PX).astype(np.int64), 0, mosaic.shape[1] - 2)
    iy = np.clip(np.floor(PY).astype(np.int64), 0, mosaic.shape[0] - 2)
    fx = np.clip(PX - ix, 0, 1)
    fy = np.clip(PY - iy, 0, 1)
    a = mosaic[iy, ix] * (1 - fx) + mosaic[iy, ix + 1] * fx
    b = mosaic[iy + 1, ix] * (1 - fx) + mosaic[iy + 1, ix + 1] * fx
    elev = a * (1 - fy) + b * fy

    enc = np.clip(np.round(elev + OFFSET), 0, 65535).astype(np.uint32)
    rgb = np.zeros((OUT_H, OUT_W, 3), dtype=np.uint8)
    rgb[..., 0] = enc >> 8
    rgb[..., 1] = enc & 255
    out_dir = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'web', 'ui', 'assets', 'map'))
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'dem.png')                    # 前端只认这一个名字
    Image.fromarray(rgb, 'RGB').save(out, optimize=True)
    land = elev[elev > 0]
    print(f'写出 {out}：{OUT_W}x{OUT_H}，海拔 {elev.min():.0f}~{elev.max():.0f} 米，陆地中位 {np.median(land):.0f} 米，{os.path.getsize(out) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
