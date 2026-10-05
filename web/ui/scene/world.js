// 舆图世界坐标的共用约定：每度 20 像素，经 55°E、纬 67°N 为原点，2100 × 1540（与山河境一致）。
export const WORLD = { W: 2100, H: 1540, lon0: 55, lat0: 67, perDeg: 20 };

// 案上那幅绢图画的是世界里的哪一块：以中土为中心、约六成见方（与第四轮定稿时案上那幅一致），
// 宽高比与世界相同。拾取、钉位、入图对齐都按它换算。
export const SHEET_EXTENT = { x0: 450, y0: 300, w: 1260, h: 1260 * 1540 / 2100 };

export const lonLatToWorld = (lon, lat) => [(lon - WORLD.lon0) * WORLD.perDeg, (WORLD.lat0 - lat) * WORLD.perDeg];
export const worldToLonLat = (x, y) => [WORLD.lon0 + x / WORLD.perDeg, WORLD.lat0 - y / WORLD.perDeg];
