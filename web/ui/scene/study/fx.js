// 书房的空气：窗里斜进来的光柱（后期逐像素积分）、光里的浮尘、香炉的一缕烟。
// 三者都用 room.js 的 windowOpen() 判断某一点是否在窗光里，光柱、浮尘、烟亮处与地上窗影一致。
// 后期这一道同时做色调映射（ACES）与 sRGB 编码：画进舞台给的任何目标（屏或转场离屏）都是可直接上屏的颜色。
import * as THREE from 'three';
import { WINDOW_GLSL, WIN, DESK, SUN_UNIFORM } from './room.js';
import { quality } from '../../core/quality.js';

export const NOISE_GLSL = /* glsl */`
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

// 与 Three.js r171 的 ACESFilmicToneMapping、sRGBTransferOETF 逐字相同（自己写是为了画进离屏时也照样做）
const TONE_GLSL = /* glsl */`
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color, float exposure) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 srgbOETF(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}`;

// ---------- 后期：场景先画进离屏（带深度），再逐像素沿视线积分窗光，最后色调映射出图 ----------
export function createPost(renderer, { exposure = 1.12 } = {}) {
  const q = quality();
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const depth = new THREE.DepthTexture(size.x, size.y);
  depth.type = THREE.FloatType;
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.antialias ? 4 : 0, depthTexture: depth });
  const uniforms = {
    tColor: { value: rt.texture }, tDepth: { value: depth },
    uInvProj: { value: new THREE.Matrix4() }, uInvView: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
    uTime: { value: 0 }, uStrength: { value: 1.5 }, uG: { value: 0.6 }, uTint: { value: new THREE.Color(1.0, 0.84, 0.62) }, uSunDir: SUN_UNIFORM,
    uExposure: { value: exposure }, uTone: { value: 1 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    defines: { SHAFTS: q.shafts ? 1 : 0 },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform mat4 uInvProj;
      uniform mat4 uInvView;
      uniform vec3 uCamPos;
      uniform float uTime;
      uniform float uStrength;
      uniform float uG;
      uniform vec3 uTint;
      uniform float uExposure;
      uniform float uTone;
      varying vec2 vUv;
      ${WINDOW_GLSL}
      ${NOISE_GLSL}
      ${TONE_GLSL}
      void main() {
        vec4 col = texture2D(tColor, vUv);
      #if SHAFTS
        if (uStrength > 0.001) {
          float d = texture2D(tDepth, vUv).r;
          vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vp /= vp.w;
          vec3 wp = (uInvView * vp).xyz;
          vec3 rd = wp - uCamPos;
          float tMax = min(length(rd), 9000.0);
          rd = normalize(rd);
          const int N = 48;
          float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float dt = tMax / float(N);
          float acc = 0.0;
          for (int i = 0; i < N; i++) {
            vec3 q = uCamPos + rd * ((float(i) + dither) * dt);
            if (q.z < ${(WIN.z + WIN.wallT / 2).toFixed(1)} || q.y < ${DESK.floor.toFixed(1)}) continue;
            float lit = windowOpen(q, 9.0);
            if (lit <= 0.0) continue;
            float dens = 0.45 + 1.1 * vnoise(q * 0.0021 + vec3(0.0, uTime * 0.03, uTime * 0.012));
            acc += lit * dens;
          }
          acc *= dt / 1000.0;
          float mu = dot(rd, uSunDir);
          float g = uG;                                   // 前向散射强弱：背着太阳的镜头调小，光柱才看得见
          float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.0796;
          col.rgb += uTint * acc * phase * uStrength;
        }
      #endif
        vec3 c = uTone > 0.5 ? acesFilmic(col.rgb, uExposure) : col.rgb;
        gl_FragColor = vec4(srgbOETF(clamp(c, 0.0, 1.0)), 1.0);
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene().add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    uniforms,
    material,
    render(scene, camera, t, target = null) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
      uniforms.uInvView.value.copy(camera.matrixWorld);
      uniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      uniforms.uTime.value = t;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, quadCam);
    },
    setSize() {
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      rt.setSize(s.x, s.y);
      depth.image.width = s.x;
      depth.image.height = s.y;
    },
    dispose() {
      rt.dispose();
      depth.dispose();
      material.dispose();
    }
  };
}

// ---------- 浮尘：光柱里慢慢飘的亮点，出了光就看不见 ----------
export function createDust(count = 5200) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  let s = 97;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    // 浮尘撒在西窗进光的那一片（窗在 x -4300~-1700；光往东北斜进屋）
    pos[i * 3] = -4300 + r() * 5600;
    pos[i * 3 + 1] = -700 + r() * 2900;
    pos[i * 3 + 2] = -1880 + r() * 3600;
    seed[i] = r() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uAmount: { value: 1 }, uPx: { value: 800 }, uSunDir: SUN_UNIFORM };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      uniform float uPx;
      varying float vLit;
      varying float vTw;
      ${WINDOW_GLSL}
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.11 + aSeed) * 40.0 + sin(uTime * 0.043 + aSeed * 1.7) * 60.0;
        p.y += sin(uTime * 0.07 + aSeed * 2.3) * 30.0 - mod(uTime * 6.0 + aSeed * 13.0, 60.0);
        p.z += cos(uTime * 0.09 + aSeed * 0.7) * 40.0;
        vLit = windowOpen(p, 3.0);
        vTw = 0.55 + 0.45 * sin(uTime * (1.3 + fract(aSeed) * 2.0) + aSeed * 7.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.6 + fract(aSeed * 3.1) * 2.4) * uPx / -mv.z * 1.6, 1.0, 5.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uAmount;
      varying float vLit;
      varying float vTw;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.1, 0.5, r)) * vLit * vTw * uAmount;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * a * 0.9, a);
      }`
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { object: points, uniforms };
}

// ---------- 一缕香烟：竖条面片始终侧对镜头，随高度摆动、散开、变淡；进了窗光就亮 ----------
export function createSmoke(origin, { height = 560, width = 46, seed = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 90);
  geo.translate(0, 0.5, 0);
  const uniforms = { uTime: { value: 0 }, uOrigin: { value: origin.clone() }, uHeight: { value: height }, uWidth: { value: width }, uSeed: { value: seed }, uSunDir: SUN_UNIFORM };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime, uHeight, uWidth, uSeed;
      uniform vec3 uOrigin;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        float v = uv.y;
        float t = uTime * 0.35 + uSeed;
        float sway = sin(v * 5.0 - t * 1.3) * 0.5 + sin(v * 11.0 - t * 2.1 + 1.7) * 0.25;
        vec3 center = uOrigin + vec3(sway * pow(v, 1.25) * 90.0 + v * v * 60.0, v * uHeight, cos(v * 4.0 - t) * pow(v, 1.4) * 60.0);
        vec3 toCam = normalize(cameraPosition - center);
        vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        float w = 2.0 + uWidth * pow(v, 0.9);
        vec3 p = center + side * (uv.x - 0.5) * w;
        vWorld = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uSeed;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${WINDOW_GLSL}
      ${NOISE_GLSL}
      void main() {
        float v = vUv.y;
        float across = max(1.0 - pow(min(abs(vUv.x - 0.5) * 2.0, 1.0), 1.6), 0.0);
        float wisp = vnoise(vec3(vUv.x * 3.0, v * 9.0 - uTime * 0.5, uSeed)) * 0.7 + vnoise(vec3(vUv.x * 7.0, v * 22.0 - uTime * 0.9, uSeed + 3.0)) * 0.5;
        float a = across * smoothstep(0.0, 0.04, v) * pow(max(1.0 - v, 0.0), 1.9) * smoothstep(0.35, 0.95, wisp);   // max：插值略超 1 时 pow 出 NaN（黑线）
        float lit = windowOpen(vWorld, 6.0);
        vec3 col = mix(vec3(0.8, 0.8, 0.82), vec3(1.0, 0.96, 0.88), lit);
        a *= 0.12 + 0.55 * lit;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { object: mesh, uniforms };
}
