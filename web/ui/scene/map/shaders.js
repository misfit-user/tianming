// 舆图着色器：青绿山水。分两道：
// · 底色（paintFragment）：绢地 → 赭石打底 → 石绿 → 石青，每座山按它在本山里的高低整座晕染，明暗只在同一色相里深浅；
//   气候干湿、水色晕、颜料颗粒、雪、山脊墨线。与镜头无关，开图时烘成一张大贴图（paint.js），每帧只取一下。
// · 每帧（terrainFragment）：取底色；近看时补皴笔、细褶、山脊、山形外廓；层级设色（天下按势力、省道按省道整片设色，
//   府州档只留界内晕带）、湖水、海（网巾水纹、近岸浪）、看法设色、云气、绢的颗粒、辖区视野、悬停点选、远雾——
//   跟镜头、时间、局势走的都在这里。
// 疆界、海岸、江河是矢量线（lines.js），不在这里画。
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

// 两道共用：值噪声（底色那道一次烘成，用算的；每帧那道取噪声贴图，省算力）
const ALU_NOISE = /* glsl */`
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
}`;

// ---------- 底色：烘一次 ----------
// 输出 RGB 底色，A 为「山体」浓度（山形外廓由每帧那道按它描）
export const paintFragment = /* glsl */`
precision highp float;
uniform sampler2D uTerrain;      // R 高度 · G 微糊高度 · B 大半径糊高度
uniform sampler2D uHeightHi;     // 真实高程原分辨率
uniform sampler2D uRange;        // 局部起伏范围：RG 小半径内最低/最高 · BA 大半径内最低/最高
uniform sampler2D uCoast;        // 有符号海岸距离（世界像素，陆正海负）
uniform vec2 uTexelHi;
uniform vec2 uTexel;
uniform vec2 uBake;              // 一个烘焙像素合多少 uv
uniform float uRelief;
uniform vec3 uSilk, uOchre, uGreen, uBlue, uInk, uDeep;
uniform vec3 uField, uPaddy, uSteppe;
uniform vec4 uAmp, uBand, uShade;
uniform float uMode;             // 0 烘底色；1 烘明暗（R 受光、G 沟脊），层级设色时透上来用；2 烘投影
uniform sampler2D uShadow;       // 烘好的投影（1 受光、0 全在影里）
varying vec2 vUv;
${ALU_NOISE}
float hgt(vec2 uv) { return texture2D(uHeightHi, uv).r; }
// 投影：从此处朝光走二十四像素，沿途地面高过光线就落影；离得越远影越虚（软影）
float castShadow(vec2 uv) {
  vec2 dir = normalize(vec2(-0.55, -0.35));
  float tanE = 0.75 / length(vec2(0.55, 0.35));
  float h0 = texture2D(uTerrain, uv).g * uRelief;
  float lit = 1.0;
  for (int i = 1; i <= 40; i++) {
    float t = float(i) * 0.6;
    float hq = texture2D(uTerrain, uv + dir * t / vec2(2100.0, 1540.0)).g * uRelief;
    lit = min(lit, clamp((h0 + t * tanE - hq) / (0.18 * t) + 0.5, 0.0, 1.0));
  }
  return lit;
}
void main() {
  vec2 uv = vUv;
  if (uMode > 1.5) { gl_FragColor = vec4(castShadow(uv), 0.0, 0.0, 1.0); return; }
  vec2 wp = uv * vec2(2100.0, 1540.0);
  float pxW = uBake.x * 2100.0;
  vec4 T = texture2D(uTerrain, uv);
  float hb = T.b;

  // 高程与法线：差分步长取烘焙像素与原高程像素中大的那个
  vec2 oh = max(uTexelHi, uBake);
  float h = hgt(uv);
  float hl = hgt(uv - vec2(oh.x, 0.0)), hr = hgt(uv + vec2(oh.x, 0.0));
  float hu = hgt(uv - vec2(0.0, oh.y)), hd = hgt(uv + vec2(0.0, oh.y));
  vec2 slopeHi = vec2(hl - hr, hu - hd) * uRelief / (2.0 * oh * vec2(2100.0, 1540.0));
  vec3 nHi = normalize(vec3(slopeHi.x, 1.0, slopeHi.y));
  vec2 ob = uTexel * 1.5;
  float s0 = texture2D(uTerrain, uv - vec2(ob.x, 0.0)).g, s1 = texture2D(uTerrain, uv + vec2(ob.x, 0.0)).g;
  float s2 = texture2D(uTerrain, uv - vec2(0.0, ob.y)).g, s3 = texture2D(uTerrain, uv + vec2(0.0, ob.y)).g;
  vec2 slopeLo = vec2(s0 - s1, s2 - s3) * uRelief / (2.0 * ob * vec2(2100.0, 1540.0));
  vec3 nLo = normalize(vec3(slopeLo.x, 1.0, slopeLo.y));
  vec3 nm = normalize(mix(nLo, nHi, 0.5));
  float lap = (hl + hr + hu + hd - 4.0 * h) / max(oh.x * 4200.0, 1.0);
  vec3 L = normalize(vec3(-0.55, 0.75, -0.35));

  // 平地：大片水色晕；气候（离海远、偏北则干黄，东南湿润稻绿，关东林草微绿）
  float sd = texture2D(uCoast, uv).r;
  float lat = 67.0 - wp.y / 20.0;
  float inland = max(sd, 0.0);
  float arid = smoothstep(150.0, 480.0, inland) * (1.0 - smoothstep(49.0, 56.0, lat));
  arid = max(arid, smoothstep(0.45, 0.75, hb) * 0.55);
  float humid = (1.0 - arid) * (1.0 - smoothstep(30.0, 37.0, lat));
  float guandong = (1.0 - arid) * smoothstep(1240.0, 1400.0, wp.x) * smoothstep(38.0, 42.0, lat) * (1.0 - smoothstep(50.0, 55.0, lat));
  vec3 plain = uField * (0.955 + 0.09 * fbm(wp * 0.0042 + 1.3));
  plain = mix(plain, uSteppe, arid * 0.85);
  plain = mix(plain, uPaddy, (humid * 0.85 + guandong * 0.5) * (1.0 - smoothstep(0.03, 0.2, h)));
  plain = mix(plain, plain * vec3(1.03, 0.99, 0.9), smoothstep(0.55, 0.75, fbm(wp * 0.012 + 2.4)) * 0.6);   // 一片片熟地略黄
  plain = mix(plain, plain * vec3(0.9, 0.97, 0.86), smoothstep(0.5, 0.72, fbm(wp * 0.05 + 8.8)) * (0.35 + 0.4 * humid));   // 草木深浅斑驳
  float wv = fbm(wp * 0.021 + 5.1);
  float blot = smoothstep(0.47, 0.57, wv);
  float rim = blot * (1.0 - blot) * 4.0;
  plain *= 1.0 - (0.03 * blot + 0.04 * rim);
  plain *= 0.95 + 0.05 * fbm(uv * 4.0 + 9.0);

  // 山：赭石打底 → 石绿 → 石青
  vec4 RR = texture2D(uRange, uv);
  vec2 rg = mix(RR.rg, RR.ba, uAmp.z);
  float amp = max(rg.y - rg.x, 1e-4);
  float u = mix(clamp((h - RR.r) / max(RR.g - RR.r, 1e-4), 0.0, 1.0), clamp((h - RR.b) / max(RR.a - RR.b, 1e-4), 0.0, 1.0), uAmp.z);
  float uu = u + (fbm(wp * 0.045 + 3.7) - 0.5) * uBand.w;
  float mtn = smoothstep(uAmp.x, uAmp.y, amp);
  float hillA = smoothstep(uAmp.x * 0.3, uAmp.x, amp) * (1.0 - mtn);
  plain = mix(plain, mix(uSilk, uOchre, 0.32), smoothstep(0.35, 0.7, rg.x));
  plain = mix(plain, mix(plain, uOchre, 0.5), hillA * smoothstep(0.3, 0.9, uu));
  vec3 mcol = mix(uOchre, uGreen, smoothstep(uBand.x, uBand.y, uu));
  mcol = mix(mcol, uBlue, smoothstep(uBand.z, uBand.z + 0.22, uu) * smoothstep(0.12, 0.3, amp));
  float massK = mtn * smoothstep(0.04, 0.3, uu);
  vec3 ground = mix(plain, mcol, massK);
  // 明暗：背光、中调、受光三调
  float dl = dot(nm, L) - L.y;
  float relief = max(mtn, hillA);
  float k = uShade.x * (0.12 + 0.88 * relief);
  ground = mix(ground, ground * uDeep, smoothstep(0.0, -0.22, dl) * k * 0.95);
  ground = mix(ground, mix(ground, mix(uSilk, uOchre, 0.2) * 1.06, 0.36), smoothstep(0.02, 0.2, dl) * k * 0.75);
  // 投影：落在影里的偏冷偏暗（沙盘上山的背光一侧拖一片影）
  float shadow = texture2D(uShadow, uv).r;
  ground = mix(ground, ground * uDeep * 0.9, (1.0 - shadow) * 0.5 * uShade.x);
  // 矿物颜料颗粒（石青、石绿处）
  ground *= 1.0 + (noise(wp / max(pxW * 1.6, 0.3) + 7.0) - 0.5) * uShade.z * 1.4 * massK * smoothstep(0.4, 0.8, uu);
  // 雪
  ground = mix(ground, vec3(0.95, 0.94, 0.90), smoothstep(0.82, 0.97, h) * smoothstep(0.7, 0.95, u));
  // 山脊墨线（远看那一份；近看每帧再补一笔细的）
  float ridge = smoothstep(0.004, 0.02, -lap) * smoothstep(0.42, 0.8, u) * max(mtn, hillA * 0.5);
  ground = mix(ground, uInk, ridge * uShade.w * 0.4);
  if (uMode > 0.5) {
    // 明暗那张：多取原分辨率的法线（层级设色时透上来的山川要清楚）
    float dh = dot(normalize(mix(nLo, nHi, 0.8)), L) - L.y;
    gl_FragColor = vec4(clamp(0.62 + dh * 0.9, 0.0, 1.0) * mix(0.72, 1.0, shadow), clamp(0.5 - lap * 6.0, 0.0, 1.0), 0.0, 1.0);
    return;
  }
  gl_FragColor = vec4(clamp(ground, 0.0, 1.0), massK);
}`;

// ---------- 每帧 ----------
export const terrainFragment = /* glsl */`
precision highp float;
uniform sampler2D uPaint;        // 底色（今设色）
uniform sampler2D uPaintAged;    // 底色（案上旧绢）
uniform sampler2D uShadeTex;     // 烘好的明暗：R 受光（0.62 为平地）、G 沟脊
uniform float uLookT;            // 0 旧绢 → 1 今设色
uniform sampler2D uNoise;        // 噪声贴图（四通道各一张值噪声，可平铺）
uniform sampler2D uTerrain;
uniform sampler2D uBorder;       // 到分界的距离（四分之一世界像素一级，一字节；随易主重算）：R 势力之间、G 省道之间
uniform sampler2D uAux;          // R 山系场 · G 海深（海拔/6000）
uniform sampler2D uHeightHi;
uniform vec2 uTexelHi;
uniform sampler2D uCoast;
uniform sampler2D uWater;        // 2 倍覆盖率：R 陆、G 湖与大江水面
uniform sampler2D uRegion;
uniform sampler2D uRegionInfo;   // 每府州：R 势力下标、G 辖区、B 省道下标
uniform sampler2D uPalette;      // 每势力一色
uniform sampler2D uFillTex;      // 每府州所属省道的色
uniform float uFill;             // 层级设色浓淡：府州档 0、省道与天下档 1
uniform float uTierMid;          // 设色按省道（1）还是按势力（0）
uniform vec2 uTexel;
uniform sampler2D uRange;
uniform float uRelief;
uniform float uTime;
uniform float uHover;            // 悬停的键：uHoverMode 0 府州编号、1 省道下标、2 势力下标
uniform float uHoverMode;
uniform float uSelMode;
uniform float uFocus;            // 有无辖区视野：1 时辖区之外略淡
uniform float uLayer;            // 看法设色的浓淡（0 不染）
uniform sampler2D uLayerTex;     // 每府州一色（A 为有无）
uniform float uSelected;
uniform vec3 uCam;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uPolitical;        // 1 显示势力色，0 纯山水
uniform vec3 uSilk, uOchre, uBlue, uInk, uDeep, uSea, uSeaDeep, uVeil;
uniform vec4 uAmp, uShade;
varying vec2 vUv;
varying vec3 vPos;

// 噪声贴图：64 格一周（一格四像素，CPU 上按平滑插值画好），c 选通道
float tnoise(vec2 p, int c) {
  vec4 n = texture2D(uNoise, p / 64.0);
  return c == 0 ? n.r : c == 1 ? n.g : c == 2 ? n.b : n.a;
}
float tfbm(vec2 p) { return texture2D(uNoise, p / 64.0).r * 0.5 + texture2D(uNoise, p / 32.0 + 0.37).g * 0.3 + texture2D(uNoise, p / 16.0 + 0.71).b * 0.2; }
// 随缩放换档的颗粒：格子约 cell 世界像素，两档交叉淡（拉近拉远都是同样粗细的颗粒）
float zoomNoise(vec2 wp, float cell, int c) {
  float lv = log2(max(cell, 1e-3));
  float f = floor(lv), t = lv - f;
  return mix(tnoise(wp / exp2(f), c), tnoise(wp / exp2(f + 1.0) + 37.1, c), t);
}
float hgt(vec2 uv) { return texture2D(uHeightHi, uv).r; }
float regionAt(vec2 uv) {
  vec2 rg = texture2D(uRegion, uv).rg;
  return floor(rg.r * 255.0 + 0.5) + floor(rg.g * 255.0 + 0.5) * 256.0;
}
vec4 infoOf(float id) { return texture2D(uRegionInfo, vec2((id + 0.5) / 4096.0, 0.5)); }
vec3 realmColor(float realm) { return texture2D(uPalette, vec2((realm + 0.5) / 256.0, 0.5)).rgb; }
// 网巾水：一行行相错的半圆弧（舆图画海的老法子）。p 以格为单位，w 线宽（格）
float netWave(vec2 p, float w) {
  p.x += 0.5 * mod(floor(p.y), 2.0);
  vec2 c = fract(p) - vec2(0.5, 0.0);
  float arc = abs(length(c) - 0.5);
  return (1.0 - smoothstep(w * 0.5, w * 1.5, arc)) * smoothstep(0.0, 0.14, c.y);
}
// 冲沟似的小褶：脊状噪声两层
float microRelief(vec2 p) {
  float a = 1.0 - abs(tnoise(p, 1) * 2.0 - 1.0);
  float b = 1.0 - abs(tnoise(p * 2.3 + 5.0, 2) * 2.0 - 1.0);
  return a * a * 0.65 + b * b * 0.35;
}

void main() {
  vec2 uv = vUv;
  vec2 wp = uv * vec2(2100.0, 1540.0);
  // 一个屏幕像素合多少世界像素：全图约 0.75，华北近景约 0.1
  float pxW = max(length(vec2(dFdx(wp.x), dFdy(wp.x))), length(vec2(dFdx(wp.y), dFdy(wp.y))));
  float nearK = 1.0 - smoothstep(0.16, 0.7, pxW);        // 近 1 → 远 0
  vec4 base = texture2D(uPaint, uv);
  if (uLookT < 0.999) base = mix(texture2D(uPaintAged, uv), base, uLookT);   // 只在入图、起身那两秒
  vec3 ground = base.rgb;
  float massK = base.a;

  // ---------- 近看细节（远处不算） ----------
  if (nearK > 0.01) {
    vec2 fu = fwidth(uv);
    vec2 oh = max(uTexelHi, fu * 0.75);
    float h = hgt(uv);
    float hl = hgt(uv - vec2(oh.x, 0.0)), hr = hgt(uv + vec2(oh.x, 0.0));
    float hu = hgt(uv - vec2(0.0, oh.y)), hd = hgt(uv + vec2(0.0, oh.y));
    vec2 slope2 = vec2(hl - hr, hu - hd) * uRelief / (2.0 * oh * vec2(2100.0, 1540.0));
    vec3 n = normalize(vec3(slope2.x, 1.0, slope2.y));
    vec3 L = normalize(vec3(-0.55, 0.75, -0.35));
    float dl = dot(n, L) - L.y;
    float slope = 1.0 - n.y;
    float lap = (hl + hr + hu + hd - 4.0 * h) / max(oh.x * 4200.0, 1.0);
    vec4 RR = texture2D(uRange, uv);
    float amp = mix(RR.g - RR.r, RR.a - RR.b, uAmp.z);
    float mtn = smoothstep(uAmp.x, uAmp.y, amp);
    float hillA = smoothstep(uAmp.x * 0.3, uAmp.x, amp) * (1.0 - mtn);
    float u = clamp((h - RR.b) / max(RR.a - RR.b, 1e-4), 0.0, 1.0);
    // 细褶：高程只有约五里一格，近处山形发糊；按噪声梯度给山坡添一层冲沟似的小褶
    float dn = nearK * nearK * smoothstep(uAmp.x, uAmp.y * 1.4, RR.g - RR.r);
    if (dn > 0.01) {
      vec2 dp = (wp + 6.0 * vec2(tnoise(wp * 0.05, 0), tnoise(wp * 0.05 + 9.0, 3))) * 1.1;
      float m0 = microRelief(dp), mx = microRelief(dp + vec2(0.12, 0.0)), my = microRelief(dp + vec2(0.0, 0.12));
      vec3 nn = normalize(n + vec3(m0 - mx, 0.0, m0 - my) / 0.12 * 0.1 * dn);
      float dd = (dot(nn, L) - dot(n, L));
      ground *= 1.0 + clamp(dd * 1.6, -0.25, 0.2) * uShade.x;
      dl += dd;
    }
    // 皴：顺坡的短笔，落在背光面
    vec2 gd2 = normalize(vec2(hr - hl, hd - hu) + 1e-6);
    vec2 q = vec2(dot(wp, gd2), dot(wp, vec2(-gd2.y, gd2.x)));
    float cun = smoothstep(0.6, 0.88, tnoise(vec2(q.x * 0.09, q.y * 1.2), 1));
    float cun2 = smoothstep(0.62, 0.9, tnoise(vec2(q.x * 0.28, q.y * 3.4) + 11.0, 2));
    float cunVis = nearK * smoothstep(0.04, 0.35, slope) * clamp(0.25 - dl * 4.0, 0.0, 1.0) * max(mtn, hillA * 0.6);
    ground = mix(ground, ground * 0.74, (cun * 0.55 + cun2 * 0.35 * nearK) * cunVis);
    // 山脊：细墨一笔
    float ridge = smoothstep(0.004, 0.02, -lap) * smoothstep(0.42, 0.8, u) * max(mtn, hillA * 0.5);
    ground = mix(ground, uInk, ridge * uShade.w * 0.6 * nearK);
    // 山形外廓：整座山晕色的边上一道淡墨（等值线，约一像素宽）
    float edgeW = fwidth(massK) * 1.2 + 1e-4;
    ground = mix(ground, ground * 0.72, (1.0 - smoothstep(0.0, edgeW, abs(massK - 0.45))) * 0.5 * nearK);
    // 沙盘：陡坡露出赭色山石，沟谷积一层暗
    float rock = smoothstep(0.32, 0.62, slope) * nearK * max(mtn, hillA * 0.5);
    ground = mix(ground, mix(ground, uOchre * 0.82, 0.55) * (0.9 + 0.2 * tnoise(wp * 1.7, 2)), rock * 0.6);
    ground *= 1.0 - smoothstep(0.003, 0.02, lap) * 0.16 * nearK;
    // 田畴：平地上一块块的田（一块约一像素见方，一大片一个走向），每块田色略异，田埂一线深；格子小过屏上五六像素就淡去
    float flatK = (1.0 - smoothstep(0.03, 0.12, slope)) * (1.0 - massK) * smoothstep(0.32, 0.16, pxW);
    if (flatK > 0.01) {
      float ang = tnoise(wp * 0.006, 3) * 3.1416;
      vec2 q = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * wp / vec2(1.15, 0.8);
      q.x += floor(q.y) * 0.37;
      vec2 cell = floor(q), fq = fract(q);
      float hs = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      vec3 tint = hs < 0.3 ? vec3(1.04, 1.03, 0.9) : hs < 0.55 ? vec3(0.93, 0.99, 0.86) : hs < 0.8 ? vec3(1.0) : vec3(1.05, 0.98, 0.92);
      float patchK = flatK * smoothstep(0.35, 0.6, tnoise(wp * 0.03 + 7.0, 1));      // 田一片一片，不铺满
      ground = mix(ground, ground * tint, patchK * 0.75);
      vec2 fw = fwidth(q) * 1.3;
      vec2 e = smoothstep(vec2(0.0), fw, fq) * smoothstep(vec2(0.0), fw, 1.0 - fq);
      ground *= 1.0 - (1.0 - e.x * e.y) * 0.09 * patchK;
    }
  }

  // ---------- 陆、湖与大江水面 ----------
  vec2 wm = texture2D(uWater, uv).rg;
  float aw = max(fwidth(wm.r) * 0.7, 0.01);
  float land = smoothstep(0.5 - aw, 0.5 + aw, wm.r);
  float awg = max(fwidth(wm.g) * 0.7, 0.01);
  float lake = smoothstep(0.5 - awg, 0.5 + awg, wm.g) * land;

  // ---------- 层级设色：天下、省道两档整片设色，透出山川明暗，界边积一道深色（水色）；府州档只留界内一条本色晕带 ----------
  vec4 T = texture2D(uTerrain, uv);
  float id = regionAt(uv);
  vec4 info = id > 0.5 ? infoOf(id) : vec4(1.0, 0.0, 1.0, 0.0);
  float realm = floor(info.r * 255.0 + 0.5);
  float circ = floor(info.b * 255.0 + 0.5);
  float owned = id > 0.5 && realm < 254.5 ? uPolitical : 0.0;
  float fillA = uFill * owned * (1.0 - uLayer);
  if (owned > 0.0) {
    vec2 bd = texture2D(uBorder, uv).rg * 63.75;
    vec3 rc = realmColor(realm);
    float band = exp(-bd.r / mix(10.0, 5.0, nearK));
    ground = mix(ground, mix(ground, rc, 0.75), owned * band * mix(0.62, 0.5, nearK) * (1.0 - uLayer) * (1.0 - fillA));
    if (fillA > 0.003) {
      vec3 fc = mix(rc, texture2D(uFillTex, vec2((id + 0.5) / 4096.0, 0.5)).rgb, uTierMid);
      // 山川明暗：取烘好的明暗（与底色同一套光，起伏取定值，与地势压平无关）
      vec2 sh = texture2D(uShadeTex, uv).rg;
      fc = mix(vec3(dot(fc, vec3(0.3, 0.59, 0.11))), fc, 0.86);                   // 颜料不那么艳
      fc *= clamp(1.0 + (sh.r - 0.62) * 1.25, 0.5, 1.2) * (1.0 - 0.12 * clamp((0.5 - sh.g) * 3.0, 0.0, 1.0));
      fc = mix(fc, vec3(0.95, 0.94, 0.90), smoothstep(0.72, 0.92, T.r) * 0.55);     // 高处积雪
      fc *= 0.955 + 0.09 * tnoise(wp * 0.03 + 3.0, 2);                              // 水色不匀
      float rim = exp(-mix(bd.r, min(bd.r, bd.g), uTierMid) / 1.8);
      fc = mix(fc, fc * vec3(0.76, 0.72, 0.70), rim * 0.6);
      ground = mix(ground, fc, fillA * 0.9);
    }
  } else if (uFill > 0.0) {
    // 无主之地：远看褪成素纸，衬出诸国
    float gl0 = dot(ground, vec3(0.3, 0.59, 0.11));
    ground = mix(ground, mix(vec3(gl0), uSilk, 0.55) * 1.03, uFill * 0.5);
  }
  ground = mix(ground, mix(uSea, vec3(0.78, 0.84, 0.78), 0.25), lake);
  if (uLayer > 0.0 && id > 0.5) {
    vec4 lc = texture2D(uLayerTex, vec2((id + 0.5) / 4096.0, 0.5));
    float gl = dot(ground, vec3(0.3, 0.59, 0.11));
    ground = mix(ground, lc.rgb * (0.62 + 0.55 * gl), uLayer * lc.a * 0.6);
  }

  // ---------- 海：近岸浅、远洋深；网巾水纹（格约 30 屏幕像素，随缩放换档）；近岸两道浪 ----------
  vec3 col = ground;
  if (land < 0.999) {
    float sd = texture2D(uCoast, uv).r;
    float seaDepth = texture2D(uAux, uv).g;
    float d = max(-sd, 0.0);
    vec3 sea = mix(mix(uSea, vec3(0.83, 0.86, 0.78), 0.4), uSea, smoothstep(0.3, 3.5, d));
    sea = mix(sea, uSeaDeep, smoothstep(0.02, 0.45, seaDepth));
    sea *= 0.97 + 0.06 * tfbm(wp * 0.006 + vec2(uTime * 0.002, 0.0));
    float lv = log2(30.0 * pxW), lf = floor(lv), lt = lv - lf;
    float c0 = exp2(lf), c1 = exp2(lf + 1.0);
    vec2 squash = vec2(1.0, 1.7);
    float net = mix(netWave(wp / c0 * squash, 1.1 * pxW / c0 * 1.7), netWave(wp / c1 * squash + 7.3, 1.1 * pxW / c1 * 1.7), lt);
    float netPatch = 0.45 + 0.55 * smoothstep(0.3, 0.7, tnoise(wp * 0.011 + 4.0, 3));
    sea = mix(sea, vec3(0.90, 0.91, 0.84), net * 0.3 * netPatch * smoothstep(3.0, 12.0, d / max(pxW, 0.05)));
    float breathe = sin(uTime * 0.5) * 0.25;
    float wd = max(pxW * 0.9, 0.1);
    float waves = (1.0 - smoothstep(wd * 0.5, wd * 1.4, abs(d - 1.4 - breathe)))
                + (1.0 - smoothstep(wd * 0.5, wd * 1.4, abs(d - 3.6 - breathe * 2.0))) * 0.6;
    sea = mix(sea, vec3(0.94, 0.94, 0.88), clamp(waves, 0.0, 1.0) * 0.45 * smoothstep(0.6, 0.25, pxW));
    col = mix(sea, ground, land);
  }

  // ---------- 云气、绢的颗粒、包浆 ----------
  float hb = T.b;
  vec2 mp = uv * vec2(6.0, 11.0) + vec2(uTime * 0.003, 0.0);
  float mist = smoothstep(0.58, 0.82, texture2D(uNoise, mp / 64.0).r * 0.62 + texture2D(uNoise, mp / 32.0 + 0.37).g * 0.38);
  mist *= smoothstep(0.02, 0.12, hb) * (1.0 - smoothstep(0.35, 0.6, hb)) * land * (0.4 + 0.6 * (1.0 - nearK)) * (1.0 - 0.8 * fillA);
  col = mix(col, vec3(0.93, 0.91, 0.85), mist * 0.36);
  float grain = zoomNoise(wp, 2.2 * pxW, 0);
  float fiber = nearK > 0.01 ? zoomNoise(wp * vec2(1.0, 0.18), 1.6 * pxW, 1) : 0.5;   // 绢丝：近看才看得出
  col *= 0.975 + 0.035 * grain + 0.02 * fiber;
  col = mix(col, col * uVeil, uShade.y);
  float edgeFade = smoothstep(0.0, 0.045, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  col = mix(uSilk * 0.97, col, edgeFade);

  // ---------- 辖区视野、悬停、点选、远雾 ----------
  // 辖区之外褪色：府州档才褪足；天下、省道两档整片设色时只略褪（看大势时诸国颜色要在），辖区靠描金边认
  if (uFocus > 0.0) {
    float gray = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, mix(col, vec3(gray), 0.45) * 0.86, (1.0 - info.g) * uFocus * land * (1.0 - 0.75 * uFill));
  }
  float hk = uHoverMode > 1.5 ? realm : uHoverMode > 0.5 ? circ : id;
  float sk = uSelMode > 1.5 ? realm : uSelMode > 0.5 ? circ : id;
  float hover = step(0.5, id) * (1.0 - step(0.5, abs(hk - uHover)));
  float picked = step(0.5, id) * (1.0 - step(0.5, abs(sk - uSelected)));
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
