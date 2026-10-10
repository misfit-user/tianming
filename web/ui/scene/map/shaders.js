// 舆图着色器：青绿山水。绢地 → 赭石打底 → 石绿 → 石青；每座山按它在本山里的高低（山脚 0 → 山巅 1）整座晕染，
// 明暗只在同一色相里深浅（受光露赭底、背光同色加深），不往灰里压。海是鱼鳞纹，近岸几道浪线；疆界朱线、界内晕一窄条势力色。
export const terrainVertex = /* glsl */`
uniform sampler2D uTerrain;
uniform float uRelief;
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vec3 p = position;
  p.y = texture2D(uTerrain, uv).g * uRelief;
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const terrainFragment = /* glsl */`
precision highp float;
uniform sampler2D uTerrain;      // R 高度 · G 微糊高度 · B 大半径糊高度
uniform sampler2D uBorder;       // R 到势力分界的距离（世界像素，随易主重算）
uniform sampler2D uAux;          // R 山系场 · G 海深（海拔/6000）
uniform sampler2D uHeightHi;     // 真实高程原分辨率，逐像素算光照与山脊
uniform vec2 uTexelHi;
uniform sampler2D uCoast;
uniform sampler2D uWater;         // 2 倍覆盖率：R 陆、G 湖与大江水面
uniform sampler2D uRegion;
uniform sampler2D uRegionInfo;
uniform sampler2D uPalette;
uniform vec2 uTexel;
uniform float uRelief;
uniform float uTime;
uniform float uZoom;             // 0 远 → 1 近
uniform float uHover;
uniform float uFocus;        // 有无辖区视野：1 时辖区之外略淡
uniform float uLayer;        // 看法设色的浓淡（0 不染）
uniform sampler2D uLayerTex; // 每府州一色（A 为有无）
uniform float uSelected;
uniform vec3 uCam;
uniform vec3 uFogColor;          // 远景雾：低角度时让远山融进绢色；平时 near 很远等于关闭
uniform float uFogNear;
uniform float uFogFar;
uniform float uPolitical;        // 1 显示疆界与势力色，0 纯山水
uniform sampler2D uRange;        // 局部起伏范围：RG 小半径内最低/最高 · BA 大半径内最低/最高
uniform vec3 uSilk, uOchre, uGreen, uBlue, uInk, uDeep, uSea, uSeaDeep, uVeil;
uniform vec4 uAmp;
uniform vec4 uBand;
uniform vec4 uShade;
varying vec2 vUv;
varying vec3 vPos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
float hgt(vec2 uv) { return texture2D(uHeightHi, uv).r; }
float regionAt(vec2 uv) {
  vec2 rg = texture2D(uRegion, uv).rg;
  return floor(rg.r * 255.0 + 0.5) + floor(rg.g * 255.0 + 0.5) * 256.0;
}
// 府州 → 势力编号查表（4096 宽，一格一州）；势力 → 设色查表（256 宽）
float realmOf(float id) { return floor(texture2D(uRegionInfo, vec2((id + 0.5) / 4096.0, 0.5)).r * 255.0 + 0.5); }
// 辖区（身份视野）：府州信息表 G 通道，1 为本辖
float focusOf(float id) { return id > 0.5 ? texture2D(uRegionInfo, vec2((id + 0.5) / 4096.0, 0.5)).g : 0.0; }
vec3 realmColor(float realm) { return texture2D(uPalette, vec2((realm + 0.5) / 256.0, 0.5)).rgb; }

// 冲沟似的小褶：脊状噪声两层
float microRelief(vec2 p) {
  float a = 1.0 - abs(noise(p) * 2.0 - 1.0);
  float b = 1.0 - abs(noise(p * 2.3 + 5.0) * 2.0 - 1.0);
  return a * a * 0.65 + b * b * 0.35;
}
// 随缩放换档的噪声：格子约 cell 世界像素，两档交叉淡（拉近拉远都是同样粗细的颗粒，不闪不糊）
float zoomNoise(vec2 wp, float cell, float seed) {
  float lv = log2(max(cell, 1e-3));
  float f = floor(lv), t = lv - f;
  return mix(noise(wp / exp2(f) + seed), noise(wp / exp2(f + 1.0) + seed + 37.1), t);
}
// 网巾水：一行行相错的半圆弧（舆图画海的老法子）。p 以格为单位，w 线宽（格）
float netWave(vec2 p, float w) {
  p.x += 0.5 * mod(floor(p.y), 2.0);
  vec2 c = fract(p) - vec2(0.5, 0.0);
  float arc = abs(length(c) - 0.5);
  return (1.0 - smoothstep(w * 0.5, w * 1.5, arc)) * smoothstep(0.0, 0.14, c.y);
}

void main() {
  vec2 uv = vUv;
  vec2 wp = uv * vec2(2100.0, 1540.0);
  // 一个屏幕像素合多少世界像素：全图约 0.75，华北近景约 0.1
  float pxW = max(length(vec2(dFdx(wp.x), dFdy(wp.x))), length(vec2(dFdx(wp.y), dFdy(wp.y))));
  float nearK = 1.0 - smoothstep(0.16, 0.7, pxW);        // 近 1 → 远 0
  vec4 T = texture2D(uTerrain, uv);
  float hb = T.b;
  float bd = texture2D(uBorder, uv).r;
  float seaDepth = texture2D(uAux, uv).g;

  // ---------- 高程与法线：差分步长随像素足迹放大（远看自然平滑，不起碎点） ----------
  vec2 fu = fwidth(uv);
  vec2 oh = max(uTexelHi, fu * 0.75);
  float h = hgt(uv);
  float hl = hgt(uv - vec2(oh.x, 0.0)), hr = hgt(uv + vec2(oh.x, 0.0));
  float hu = hgt(uv - vec2(0.0, oh.y)), hd = hgt(uv + vec2(0.0, oh.y));
  vec2 slopeHi = vec2(hl - hr, hu - hd) * uRelief / (2.0 * oh * vec2(2100.0, 1540.0));
  vec3 nHi = normalize(vec3(slopeHi.x, 1.0, slopeHi.y));
  vec2 ob = max(uTexel * 1.5, fu * 1.5);
  float s0 = texture2D(uTerrain, uv - vec2(ob.x, 0.0)).g, s1 = texture2D(uTerrain, uv + vec2(ob.x, 0.0)).g;
  float s2 = texture2D(uTerrain, uv - vec2(0.0, ob.y)).g, s3 = texture2D(uTerrain, uv + vec2(0.0, ob.y)).g;
  vec2 slopeLo = vec2(s0 - s1, s2 - s3) * uRelief / (2.0 * ob * vec2(2100.0, 1540.0));
  vec3 nLo = normalize(vec3(slopeLo.x, 1.0, slopeLo.y));
  vec3 nm = normalize(mix(nLo, nHi, 0.35 + 0.35 * nearK));
  // 近看补细褶：高程只有约五里一格，近处山形发糊；按程序噪声的梯度给山坡添一层冲沟似的小褶（只在山地、只在近看）
  vec4 RR0 = texture2D(uRange, uv);
  float reliefAmp = smoothstep(uAmp.x, uAmp.y * 1.4, RR0.g - RR0.r);
  float dn = nearK * nearK * reliefAmp;
  if (dn > 0.01) {
    vec2 dp = (wp + 6.0 * vec2(fbm(wp * 0.05), fbm(wp * 0.05 + 9.0))) * 1.1;
    float m0 = microRelief(dp), mx = microRelief(dp + vec2(0.12, 0.0)), my = microRelief(dp + vec2(0.0, 0.12));
    nm = normalize(nm + vec3(m0 - mx, 0.0, m0 - my) / 0.12 * 0.1 * dn);
  }
  float lap = (hl + hr + hu + hd - 4.0 * h) / max(oh.x * 4200.0, 1.0);   // 按步长归一的曲率（负为脊）
  float slope = 1.0 - nm.y;

  // ---------- 陆、海、湖 ----------
  float sd = texture2D(uCoast, uv).r;
  vec2 wm = texture2D(uWater, uv).rg;
  float aw = max(fwidth(wm.r) * 0.7, 0.01);
  float land = smoothstep(0.5 - aw, 0.5 + aw, wm.r);
  float awg = max(fwidth(wm.g) * 0.7, 0.01);
  float lake = smoothstep(0.5 - awg, 0.5 + awg, wm.g) * land;

  float id = regionAt(uv);
  float realm = id > 0.5 ? realmOf(id) : -1.0;
  float focus = focusOf(id);
  vec3 tint = realm >= 0.0 ? realmColor(realm) : vec3(1.0);
  float owned = realm >= 0.0 ? uPolitical : 0.0;
  float hover = step(0.5, id) * (1.0 - step(0.5, abs(id - uHover)));
  float picked = step(0.5, id) * (1.0 - step(0.5, abs(id - uSelected)));

  vec3 L = normalize(vec3(-0.55, 0.75, -0.35));
  float edgeFade = smoothstep(0.0, 0.045, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));

  // ---------- 绢地：大片水色晕；气候（离海远、偏北则干黄，东南湿润微绿） ----------
  float lat = 67.0 - wp.y / 20.0;
  float inland = max(sd, 0.0);
  float arid = smoothstep(150.0, 480.0, inland) * (1.0 - smoothstep(49.0, 56.0, lat));
  arid = max(arid, smoothstep(0.45, 0.75, hb) * 0.55);                 // 高原寒漠
  float humid = (1.0 - arid) * (1.0 - smoothstep(30.0, 37.0, lat));
  float washBig = fbm(wp * 0.0042 + 1.3);
  vec3 plain = uSilk * (0.955 + 0.09 * washBig);
  plain = mix(plain, mix(uSilk, vec3(0.89, 0.79, 0.58), 0.6), arid * 0.85);
  plain = mix(plain, mix(uSilk, uGreen, 0.22), humid * 0.55 * (1.0 - smoothstep(0.03, 0.2, h)));
  // 水色晕：小片深浅与积色的边（近看才明显）
  float wv = fbm(wp * 0.021 + 5.1);
  float blot = smoothstep(0.47, 0.57, wv);
  float rim = blot * (1.0 - blot) * 4.0;
  plain *= 1.0 - (0.035 * blot + 0.045 * rim) * (0.3 + 0.7 * nearK);
  // 沙漠起沙纹（近看）
  float dune = sin(wp.x * 0.9 + wp.y * 0.35 + 3.0 * fbm(wp * 0.08));
  plain *= 1.0 - 0.04 * arid * nearK * smoothstep(0.6, 1.0, dune);

  // ---------- 山：赭石打底 → 石绿 → 石青；远看整座晕，近看逐峰 ----------
  vec4 RR = texture2D(uRange, uv);
  float wide = mix(1.0, uAmp.z, nearK);
  vec2 rg = mix(RR.rg, RR.ba, wide);
  float amp = max(rg.y - rg.x, 1e-4);
  float u = mix(clamp((h - RR.r) / max(RR.g - RR.r, 1e-4), 0.0, 1.0), clamp((h - RR.b) / max(RR.a - RR.b, 1e-4), 0.0, 1.0), wide);
  float uu = u + (fbm(wp * 0.045 + 3.7) - 0.5) * uBand.w;
  float mtn = smoothstep(uAmp.x, uAmp.y, amp);
  float hillA = smoothstep(uAmp.x * 0.3, uAmp.x, amp) * (1.0 - mtn);
  plain = mix(plain, mix(uSilk, uOchre, 0.32), smoothstep(0.35, 0.7, rg.x));           // 高原：山脚本身就高
  plain = mix(plain, mix(plain, uOchre, 0.5), hillA * smoothstep(0.3, 0.9, uu));       // 丘陵：赭
  vec3 mcol = mix(uOchre, uGreen, smoothstep(uBand.x, uBand.y, uu));
  mcol = mix(mcol, uBlue, smoothstep(uBand.z, uBand.z + 0.22, uu) * smoothstep(0.12, 0.3, amp));
  float massK = mtn * smoothstep(0.04, 0.3, uu);
  vec3 ground = mix(plain, mcol, massK);
  // 明暗：同色相里深浅，分背光、中调、受光三调，边上柔
  float dl = dot(nm, L) - L.y;
  float relief = max(mtn, hillA);
  float k = uShade.x * (0.12 + 0.88 * relief);
  float shadow = smoothstep(0.0, -0.22, dl);
  float lit = smoothstep(0.02, 0.2, dl);
  ground = mix(ground, ground * uDeep, shadow * k * 0.95);
  ground = mix(ground, mix(ground, mix(uSilk, uOchre, 0.2) * 1.06, 0.36), lit * k * 0.75);
  // 皴：顺坡的短笔，落在背光面（近看）
  vec2 g2 = vec2(hr - hl, hd - hu);
  vec2 gd2 = g2 / (length(g2) + 1e-6);
  vec2 q = vec2(dot(wp, gd2), dot(wp, vec2(-gd2.y, gd2.x)));
  float cun = smoothstep(0.6, 0.88, noise(vec2(q.x * 0.09, q.y * 1.2)));
  float cun2 = smoothstep(0.62, 0.9, noise(vec2(q.x * 0.28, q.y * 3.4) + 11.0));
  float cunVis = nearK * smoothstep(0.04, 0.35, slope) * clamp(0.25 - dl * 4.0, 0.0, 1.0) * max(mtn, hillA * 0.6);
  ground = mix(ground, ground * 0.74, (cun * 0.55 + cun2 * 0.35 * nearK) * cunVis);
  // 矿物颜料颗粒（石青、石绿处）
  ground *= 1.0 + (zoomNoise(wp, 1.6 * pxW, 7.0) - 0.5) * uShade.z * 1.4 * massK * smoothstep(0.4, 0.8, uu);
  // 雪
  ground = mix(ground, vec3(0.95, 0.94, 0.90), smoothstep(0.82, 0.97, h) * smoothstep(0.7, 0.95, u));
  // 勾勒：山脊墨线（曲率按步长归一，远看淡去）
  float ridge = smoothstep(0.004, 0.02, -lap) * smoothstep(0.42, 0.8, u) * max(mtn, hillA * 0.5);
  ground = mix(ground, uInk, ridge * uShade.w * (0.35 + 0.65 * nearK));
  // 山形外廓：整座山晕色的边上一道淡墨（等值线，约一像素宽）
  float edgeW = fwidth(massK) * 1.2 + 1e-4;
  float outline = 1.0 - smoothstep(0.0, edgeW, abs(massK - 0.45));
  ground = mix(ground, ground * 0.72, outline * 0.5 * nearK);

  // ---------- 湖与大江水面 ----------
  vec3 water = mix(uSea, vec3(0.78, 0.84, 0.78), 0.25);
  ground = mix(ground, water, lake);

  // ---------- 势力：界内一条晕带；远看整片薄染 ----------
  float band = exp(-bd / mix(9.0, 4.0, nearK));
  float realmWash = owned * (band * mix(0.55, 0.45, nearK) + (1.0 - nearK) * 0.1) * (1.0 - uLayer);
  ground = mix(ground, mix(ground, tint, 0.6), realmWash);
  // 看法设色：一层水色淡染，留住山川明暗
  vec4 lc = id > 0.5 ? texture2D(uLayerTex, vec2((id + 0.5) / 4096.0, 0.5)) : vec4(0.0);
  float gl = dot(ground, vec3(0.3, 0.59, 0.11));
  ground = mix(ground, lc.rgb * (0.62 + 0.55 * gl), uLayer * lc.a * 0.6);

  // ---------- 海：近岸浅、远洋深；网巾水纹（格约 30 屏幕像素，随缩放换档）；近岸三道浪 ----------
  float d = max(-sd, 0.0);
  vec3 sea = mix(mix(uSea, vec3(0.83, 0.86, 0.78), 0.4), uSea, smoothstep(0.3, 3.5, d));
  sea = mix(sea, uSeaDeep, smoothstep(0.02, 0.45, seaDepth));
  sea *= 0.97 + 0.06 * fbm(wp * 0.006 + vec2(uTime * 0.002, 0.0));
  float lv = log2(30.0 * pxW), lf = floor(lv), lt = lv - lf;
  float c0 = exp2(lf), c1 = exp2(lf + 1.0);
  vec2 squash = vec2(1.0, 1.7);
  float net = mix(netWave(wp / c0 * squash, 1.1 * pxW / c0 * 1.7), netWave(wp / c1 * squash + 7.3, 1.1 * pxW / c1 * 1.7), lt);
  float netPatch = 0.45 + 0.55 * smoothstep(0.3, 0.7, fbm(wp * 0.011 + 4.0));
  sea = mix(sea, vec3(0.90, 0.91, 0.84), net * 0.3 * netPatch * smoothstep(3.0, 12.0, d / max(pxW, 0.05)));
  // 近岸浪线：离岸约 1.6、4.2、7.8 世界像素，缓缓呼吸；远看隐去
  float breathe = sin(uTime * 0.5) * 0.25;
  float waves = 0.0;
  for (int i = 0; i < 2; i++) {
    float r = i == 0 ? 1.4 : 3.6;
    float wd = max(pxW * 0.9, 0.1);
    waves += (1.0 - smoothstep(wd * 0.5, wd * 1.4, abs(d - r - breathe * (float(i) + 1.0)))) * (1.0 - float(i) * 0.4);
  }
  sea = mix(sea, vec3(0.94, 0.94, 0.88), clamp(waves, 0.0, 1.0) * 0.45 * smoothstep(0.6, 0.25, pxW));
  vec3 col = mix(sea, ground, land);

  // ---------- 云气、绢的颗粒、包浆 ----------
  float mist = smoothstep(0.58, 0.82, fbm(uv * vec2(6.0, 11.0) + vec2(uTime * 0.003, 0.0)));
  mist *= smoothstep(0.02, 0.12, hb) * (1.0 - smoothstep(0.35, 0.6, hb)) * land * (0.4 + 0.6 * (1.0 - nearK));
  col = mix(col, vec3(0.93, 0.91, 0.85), mist * 0.36);
  float grain = zoomNoise(wp, 2.2 * pxW, 3.0);
  float fiber = zoomNoise(wp * vec2(1.0, 0.18), 1.6 * pxW, 9.0);
  col *= 0.975 + 0.035 * grain + 0.02 * fiber;
  col *= 0.95 + 0.05 * fbm(uv * 4.0 + 9.0);
  col = mix(col, col * uVeil, uShade.y);
  col = mix(uSilk * 0.97, col, edgeFade);

  // ---------- 辖区视野、悬停、点选 ----------
  float gray = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, mix(col, vec3(gray), 0.45) * 0.86, (1.0 - focus) * uFocus * land);
  col = mix(col, col * 1.08 + 0.03, hover * 0.7 * land);
  col = mix(col, col * vec3(1.05, 0.98, 0.9) + vec3(0.04, 0.02, -0.01), picked * 0.6 * land);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, distance(vPos, uCam)));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// 点景：竖贴在地上的小图（图集 4×2 格，见 sprites.js）。大小按世界尺寸随远近缩放，太小时淡去；下沿落在所在点上
export const spriteVertex = /* glsl */`
attribute float aSize;
attribute float aType;
uniform float uRelief;
uniform float uPx;
uniform float uDpr;
uniform vec2 uHalfView;
uniform vec2 uFadePx;          // 屏上多大开始显、多大全显（CSS 像素）
uniform float uMaxPx;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCam;
varying float vType;
varying float vFade;
varying float vFog;
void main() {
  vec3 p = position;
  p.y = p.y * uRelief + 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = aSize * uPx / max(-mv.z, 1.0);
  float px = min(s, uMaxPx);
  gl_PointSize = px * uDpr;
  gl_Position.y += px * 0.5 / uHalfView.y * gl_Position.w;
  vFade = smoothstep(uFadePx.x, uFadePx.y, s);
  vFog = smoothstep(uFogNear, uFogFar, distance(p, uCam));
  vType = aType;
}`;
export const spriteFragment = /* glsl */`
uniform sampler2D uAtlas;
uniform vec3 uFogColor;
varying float vType;
varying float vFade;
varying float vFog;
void main() {
  float col = mod(vType, 4.0), row = floor(vType / 4.0 + 0.01);
  vec4 t = texture2D(uAtlas, (vec2(col, row) + gl_PointCoord) / vec2(4.0, 2.0));
  float a = t.a * vFade * (1.0 - vFog);
  if (a < 0.02) discard;
  gl_FragColor = vec4(mix(t.rgb, uFogColor, vFog * 0.6) * a, a);    // 预乘
}`;
