// 舆图设色（青绿山水）。颜色一律按 sRGB 书写，着色器出屏不再换算（风格化画法，不求物理正确）。
// amp：起伏多大算丘陵、算山、大小两种半径的比重；band：赭→绿起止、绿→青起点、晕染边缘笔意；
// shade：明暗力度、包浆、颜料颗粒、山脊墨线。
export const LOOK_QINGLV = {
  silk: '#e0d0ad', ochre: '#b8956a', green: '#6f9c78', blue: '#43738c', ink: '#3b3025', deep: '#a8bad1',
  sea: '#b5c2a8', seaDeep: '#94ab9e', veil: '#fff2d6', amp: [0.08, 0.22, 0.75, 0], band: [0.28, 0.56, 0.62, 0.22], shade: [0.85, 0.3, 0.12, 0.4]
};
// 案上那幅：同一套青绿，旧一些、淡一些（入图时由它过渡到鲜亮的 LOOK_QINGLV）
export const LOOK_QINGLV_AGED = {
  silk: '#dccba4', ochre: '#b39270', green: '#7c9c80', blue: '#58798a', ink: '#3b3025', deep: '#b0bccb',
  sea: '#b3bea6', seaDeep: '#98aa9c', veil: '#fbeccd', amp: [0.08, 0.22, 0.75, 0], band: [0.28, 0.56, 0.62, 0.22], shade: [0.8, 0.36, 0.14, 0.34]
};
export const RELIEF = 20;                     // 起伏倍数（入图时由 0 升到这里）
export const BACKGROUND = '#d9c8a4';
// 势力设色：大明（或剧本主势力）用第一色，其余按原色色相分到后几色
export const SWATCHES = ['#e2bf63', '#d0654c', '#6f9f86', '#9a7fb0', '#c08650', '#7a93b8'];

export const VIEWS = {
  world: { target: [1190, 0, 690], dist: 1500, polar: 0.52, az: 0 },
  central: { target: [1215, 0, 650], dist: 640, polar: 0.80, az: 0.06 },
  liaodong: { target: [1335, 0, 500], dist: 480, polar: 0.84, az: -0.08 }
};

export const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const LOOK_COLORS = ['silk', 'ochre', 'green', 'blue', 'ink', 'deep', 'sea', 'seaDeep', 'veil'].map((key) => ({ key, u: 'u' + key[0].toUpperCase() + key.slice(1) }));

// 两套设色按 t 插值（颜色在 sRGB 里插，参数直接插）
export function mixLook(a, b, t) {
  const out = {};
  for (const { key } of LOOK_COLORS) {
    const ca = typeof a[key] === 'string' ? hexRgb(a[key]) : a[key];
    const cb = typeof b[key] === 'string' ? hexRgb(b[key]) : b[key];
    out[key] = ca.map((v, i) => v + (cb[i] - v) * t);
  }
  for (const k of ['amp', 'band', 'shade']) out[k] = a[k].map((v, i) => v + (b[k][i] - v) * t);
  return out;
}

export function swatchFor(name, color, { primary = /明朝廷|大明/ } = {}) {
  if (primary.test(name)) return SWATCHES[0];
  const [r, g, b] = hexRgb(color || '#999999').map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return SWATCHES[1 + Math.floor(((hue + 30) % 360) / 72) % (SWATCHES.length - 1)];
}
