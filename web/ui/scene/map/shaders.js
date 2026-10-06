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
uniform sampler2D uRiver;
uniform sampler2D uRegion;
uniform sampler2D uRegionInfo;
uniform sampler2D uPalette;
uniform vec2 uTexel;
uniform float uRelief;
uniform float uTime;
uniform float uZoom;             // 0 远 → 1 近
uniform float uHover;
uniform float uFocus;        // 有无辖区视野：1 时辖区之外略淡
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
float line(float d, float w) { return 1.0 - smoothstep(0.0, w, abs(d)); }

void main() {
  vec2 uv = vUv;
  vec2 tx = uTexel;
  vec4 T = texture2D(uTerrain, uv);
  float hb = T.b;
  float bd = texture2D(uBorder, uv).r;
  vec2 AUX = texture2D(uAux, uv).rg;
  float seaDepth = AUX.g;
  vec2 th = uTexelHi;
  float h = hgt(uv);
  float hl = hgt(uv - vec2(th.x, 0.0)), hr = hgt(uv + vec2(th.x, 0.0));
  float hu = hgt(uv - vec2(0.0, th.y)), hd = hgt(uv + vec2(0.0, th.y));
  vec3 n = normalize(vec3((hl - hr) * uRelief, 1.0, (hu - hd) * uRelief));
  float lap = hl + hr + hu + hd - 4.0 * h;
  float slope = 1.0 - n.y;
  vec2 wp = uv * vec2(2100.0, 1540.0);

  float sd = texture2D(uCoast, uv).r;
  float aa = max(fwidth(sd) * 0.75, 0.02);
  float land = smoothstep(-aa, aa, sd);
  vec2 rv = texture2D(uRiver, uv).rg;

  vec2 fw = fwidth(uv);
  float e = max(max(fw.x, fw.y) * 0.9, 0.35 / 4200.0);
  float id = regionAt(uv);
  float realm = id > 0.5 ? realmOf(id) : -1.0;
  float focus = focusOf(id);
  float prefEdge = 0.0, realmEdge = 0.0, focusEdge = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = k == 0 ? vec2(e, 0.0) : k == 1 ? vec2(-e, 0.0) : k == 2 ? vec2(0.0, e) : vec2(0.0, -e);
    float nid = regionAt(uv + o);
    float nrealm = nid > 0.5 ? realmOf(nid) : -1.0;
    prefEdge += step(0.5, abs(nid - id)) * step(0.5, nid) * step(0.5, id);
    realmEdge += step(0.5, abs(nrealm - realm)) * step(-0.5, nrealm) * step(-0.5, realm);
    focusEdge += step(0.5, abs(focusOf(nid) - focus));
  }
  prefEdge = min(prefEdge * 0.5, 1.0) * land * uPolitical;
  realmEdge = min(realmEdge * 0.5, 1.0) * land * uPolitical;
  focusEdge = min(focusEdge * 0.5, 1.0) * land * uFocus;
  vec3 tint = realm >= 0.0 ? realmColor(realm) : vec3(1.0);
  float owned = realm >= 0.0 ? uPolitical : 0.0;
  float hover = step(0.5, id) * (1.0 - step(0.5, abs(id - uHover)));
  float picked = step(0.5, id) * (1.0 - step(0.5, abs(id - uSelected)));

  vec3 L = normalize(vec3(-0.55, 0.75, -0.35));
  float edgeFade = smoothstep(0.0, 0.045, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  float ridgeVis = 1.0 - smoothstep(1.2, 3.2, fwidth(wp.x));          // 拉远时山脊线与皴笔淡出

  // ---------- 设色底：绢地 → 赭石 → 石绿 → 石青 ----------
  vec4 RR = texture2D(uRange, uv);
  vec2 rg = mix(RR.rg, RR.ba, uAmp.z);
  float amp = max(rg.y - rg.x, 1e-4);
  float u = mix(clamp((h - RR.r) / max(RR.g - RR.r, 1e-4), 0.0, 1.0), clamp((h - RR.b) / max(RR.a - RR.b, 1e-4), 0.0, 1.0), uAmp.z);
  float uu = u + (fbm(wp * 0.05 + 3.7) - 0.5) * uBand.w;             // 晕染边缘的笔意
  float mtn = smoothstep(uAmp.x, uAmp.y, amp);
  float hillA = smoothstep(uAmp.x * 0.3, uAmp.x, amp) * (1.0 - mtn);
  float wash = fbm(uv * vec2(14.0, 10.0));
  vec3 plain = mix(uSilk, uSilk * vec3(0.96, 0.91, 0.81), 0.2 + 0.4 * wash);
  plain = mix(plain, mix(uSilk, uOchre, 0.3), smoothstep(0.35, 0.7, rg.x));          // 高原：山脚本身就高
  plain = mix(plain, mix(plain, uOchre, 0.5), hillA * smoothstep(0.3, 0.9, uu));      // 丘陵：赭
  vec3 mcol = mix(uOchre, uGreen, smoothstep(uBand.x, uBand.y, uu));
  mcol = mix(mcol, uBlue, smoothstep(uBand.z, uBand.z + 0.24, uu));
  vec3 ground = mix(plain, mcol, mtn * smoothstep(0.04, 0.32, uu));
  float s0 = texture2D(uTerrain, uv - vec2(tx.x, 0.0)).g, s1 = texture2D(uTerrain, uv + vec2(tx.x, 0.0)).g;
  float s2 = texture2D(uTerrain, uv - vec2(0.0, tx.y)).g, s3 = texture2D(uTerrain, uv + vec2(0.0, tx.y)).g;
  vec3 nSoft = normalize(vec3((s0 - s1) * uRelief * 0.5, 1.0, (s2 - s3) * uRelief * 0.5));
  vec3 nm = normalize(mix(nSoft, n, 0.45));                            // 微糊高度与原分辨率各半，去掉过碎的褶子
  float dl = dot(nm, L) - L.y;                                         // 相对平地：正=受光，负=背光
  float k = uShade.x * (0.35 + 0.65 * max(mtn, hillA));
  ground = mix(ground, ground * uDeep, clamp(-dl * 2.2, 0.0, 1.0) * k);
  ground = mix(ground, mix(ground, mix(uSilk, uOchre, 0.22) * 1.05, 0.32), clamp(dl * 2.6, 0.0, 1.0) * k * 0.7);
  vec2 g2 = vec2(hr - hl, hd - hu);                                    // 皴：顺坡的短笔，落在背光面
  vec2 gd2 = g2 / (length(g2) + 1e-6);
  vec2 q = vec2(dot(wp, gd2), dot(wp, vec2(-gd2.y, gd2.x)));
  float cun = smoothstep(0.62, 0.9, noise(vec2(q.x * 0.08, q.y * 1.1)));
  ground = mix(ground, ground * 0.78, cun * 0.5 * ridgeVis * smoothstep(0.05, 0.4, slope) * clamp(0.3 - dl * 4.0, 0.0, 1.0) * max(mtn, hillA * 0.6));
  ground *= 1.0 + (noise(uv * vec2(6300.0, 4620.0)) - 0.5) * uShade.z * mtn * smoothstep(0.45, 0.8, uu);   // 矿物颜料颗粒
  ground = mix(ground, vec3(0.95, 0.94, 0.90), smoothstep(0.82, 0.97, h) * smoothstep(0.7, 0.95, u));      // 雪
  float ridge = smoothstep(0.012, 0.05, -lap) * smoothstep(0.45, 0.8, u) * max(mtn, hillA * 0.5) * ridgeVis;
  ground = mix(ground, uInk, ridge * uShade.w);                                                           // 山脊墨线

  // ---------- 河湖、疆界、海 ----------
  ground = mix(ground, mix(uBlue, uSilk, 0.5), max(rv.r * 0.85, rv.g * 0.45 * (0.3 + 0.7 * uZoom)));
  ground = mix(ground, mix(ground, tint, 0.55), owned * exp(-bd / 4.0) * 0.8);   // 界内晕一窄条势力色
  float d = max(-sd, 0.0);
  vec3 sea = mix(uSea, uSeaDeep, smoothstep(0.02, 0.45, seaDepth));
  vec2 sp = wp / 7.0;
  sp.x += 0.5 * mod(floor(sp.y), 2.0);
  vec2 cell = fract(sp) - vec2(0.5, 0.0);
  float arc = abs(length(cell) - 0.55);
  float scaleVis = 1.0 - smoothstep(0.25, 0.6, fwidth(sp.x));
  float fishScale = (1.0 - smoothstep(0.0, 0.07, arc)) * step(0.0, cell.y) * scaleVis;
  sea = mix(sea, vec3(0.84, 0.86, 0.77), fishScale * 0.33 * smoothstep(8.0, 30.0, d));
  float wl = abs(fract(d * 0.25 - uTime * 0.03) - 0.5);
  float waveVis = 1.0 - smoothstep(0.15, 0.4, fwidth(d * 0.25));
  sea = mix(sea, vec3(0.90, 0.90, 0.82), (1.0 - smoothstep(0.0, 0.08, wl)) * (1.0 - smoothstep(3.0, 26.0, d)) * smoothstep(1.2, 3.0, d) * 0.6 * waveVis);
  vec3 col = mix(sea, ground, land);
  col = mix(col, vec3(0.20, 0.24, 0.22), line(sd, aa * 1.8) * 0.8);
  col = mix(col, vec3(0.55, 0.17, 0.11), realmEdge * 0.9);
  col = mix(col, vec3(0.30, 0.24, 0.18), prefEdge * 0.3 * uZoom);
  float mist = smoothstep(0.58, 0.82, fbm(uv * vec2(6.0, 11.0) + vec2(uTime * 0.003, 0.0)));
  mist *= smoothstep(0.02, 0.12, hb) * (1.0 - smoothstep(0.35, 0.6, hb)) * land;
  col = mix(col, vec3(0.93, 0.91, 0.85), mist * 0.42);
  col *= 0.985 + 0.015 * sin(uv.x * 7200.0) * sin(uv.y * 5300.0);    // 绢的经纬
  col *= 0.95 + 0.05 * fbm(uv * 4.0 + 9.0);
  col = mix(col, col * uVeil, uShade.y);                                // 包浆
  col = mix(uSilk * 0.97, col, edgeFade);

  // 辖区视野：辖区之外褪色略暗，辖区四周一道描金边
  float gray = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, mix(col, vec3(gray), 0.45) * 0.86, (1.0 - focus) * uFocus * land);
  col = mix(col, vec3(0.80, 0.60, 0.22), focusEdge * 0.95);
  col = mix(col, col * 1.18 + 0.04, hover * 0.6);
  col = mix(col, col * vec3(1.06, 0.97, 0.9) + vec3(0.05, 0.0, -0.02), picked * 0.7);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, distance(vPos, uCam)));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// 点叶：只落在山地，远看淡出
export const treeFragment = /* glsl */`
varying float vType; varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  float a = (1.0 - smoothstep(0.18, 0.5, r)) * vFade;
  vec3 col = mix(vec3(0.10, 0.30, 0.23), vec3(0.24, 0.42, 0.30), vType / 3.0);
  gl_FragColor = vec4(col, a * 0.75);
}`;

export function pointsVertex(sizeMul, fade, clampPx) {
  return /* glsl */`
    attribute float aSize; attribute float aType;
    uniform float uRelief; uniform float uPx; uniform float uFogNear; uniform float uFogFar; uniform vec3 uCam;
    varying float vType; varying float vFade;
    void main() {
      vec3 p = position; p.y = p.y * uRelief + 0.8;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float s = aSize * ${sizeMul.toFixed(2)} * uPx / -mv.z;
      gl_PointSize = clamp(s, ${clampPx[0].toFixed(1)}, ${clampPx[1].toFixed(1)});
      vFade = smoothstep(${fade[0].toFixed(2)}, ${fade[1].toFixed(2)}, s) * (1.0 - smoothstep(uFogNear, uFogFar, distance(p, uCam)));
      vType = aType;
    }`;
}
