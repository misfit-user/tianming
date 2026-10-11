// 舆图之外是御案（同志 10-11：「地图以外地区应该有御案作为边缘，而不应该是纯白色」）。
// 与书房案上那张绢图同一套陈设（scene/study/index.js buildMapSheet）：图心四周一道绫边（同一色的暗花绫，书房里 46 毫米，按图宽比例放到舆图上），
// 绫边内外各压一线金；绫边之外是黄花梨案面（木纹顺长边走，与 deskTopTexture 同一张木样），贴着绫边有一圈落影，往外渐暗，远处与舆图同一层远雾。
// 只画图心以外：一块带方孔的大板，图心那块留给舆图本身（海底有低于零的地方，整块垫底会从海里透上来）。不受光照，与舆图着色器同一套色彩口径（贴图不做 sRGB 解码）。
import * as THREE from 'three';
import { imageTexture, damaskTexture } from '../study/textures.js';

const SHEET_W = 1300, BORDER = 46;                  // 书房里那张图：宽 1300（毫米），绫边 46
const vert = /* glsl */`
varying vec3 vPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */`
uniform sampler2D uWood;
uniform sampler2D uDamask;
uniform vec4 uRect;            // 图心 x0, z0, x1, z1
uniform float uMount;          // 绫边宽
uniform vec2 uGrain;           // 木纹一张贴图在 x、z 上管多宽
uniform vec3 uCam;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vPos;
void main() {
  vec2 p = vPos.xz;
  vec2 o = max(vec2(uRect.x - p.x, uRect.y - p.y), vec2(p.x - uRect.z, p.y - uRect.w));
  float dOut = max(max(o.x, o.y), 0.0);           // 方角：绫边、落影都是方的（装裱不圆角）
  vec3 col;
  if (dOut < uMount) {
    // 绫边：暗花绫，内外各压一线金，近图心一侧略压暗（绢心比绫边高一纸）
    col = texture2D(uDamask, p / 150.0).rgb * vec3(0.9, 0.86, 0.78);
    float aw = fwidth(dOut) * 1.2 + 0.4;
    float pip = (1.0 - smoothstep(0.0, aw, abs(dOut - 5.0))) + (1.0 - smoothstep(0.0, aw, abs(dOut - (uMount - 6.0))));
    col = mix(col, vec3(0.66, 0.5, 0.25), clamp(pip, 0.0, 1.0) * 0.75);
    col *= 0.9 + 0.1 * smoothstep(0.0, 10.0, dOut);
  } else {
    float e = dOut - uMount;
    // 黄花梨：照片色太艳，压暗、略褪，像书房里灯下的案面
    col = texture2D(uWood, p / uGrain).rgb;
    col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 0.78) * vec3(0.7, 0.6, 0.52);
    col *= 1.0 - 0.5 * exp(-e / 22.0);                                             // 绢图落在案上的影
    vec2 c = (uRect.xy + uRect.zw) * 0.5;
    float r = length((p - c) / (uRect.zw - uRect.xy));
    col *= mix(1.0, 0.62, smoothstep(0.6, 1.6, r));                                // 案上一灯，往外渐暗
  }
  float fog = smoothstep(uFogNear, uFogFar, distance(vPos, uCam));
  gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
}`;

// 图心 w×h（世界单位，左上为原点）；shared 取舆图那一套远雾与镜头位置
export async function createDesk({ w, h, shared }) {
  const k = w / SHEET_W;
  const mount = BORDER * k;
  const [wood, damask] = await Promise.all([imageTexture('huanghuali.jpg', { srgb: false }), Promise.resolve(damaskTexture('#b9ab86'))]);
  damask.colorSpace = THREE.NoColorSpace;
  damask.wrapS = damask.wrapT = THREE.RepeatWrapping;
  damask.needsUpdate = true;
  // 带方孔的一大块：外框远到看不见边，孔正是图心
  const R = Math.max(w, h) * 14;
  const outer = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(w + R, -R), new THREE.Vector2(w + R, h + R), new THREE.Vector2(-R, h + R)]);
  outer.holes.push(new THREE.Path([new THREE.Vector2(0, 0), new THREE.Vector2(0, h), new THREE.Vector2(w, h), new THREE.Vector2(w, 0)]));
  const geo = new THREE.ShapeGeometry(outer);
  geo.rotateX(Math.PI / 2);                          // 形在 xy 上，转到 xz（y 朝上），z 即形的 y
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
    uniforms: {
      uWood: { value: wood }, uDamask: { value: damask }, uRect: { value: new THREE.Vector4(0, 0, w, h) }, uMount: { value: mount },
      // 木样 0.3 米一张、顺纹拉长 2.2 倍（与案面同）：书房 1 单位 1 毫米，舆图 1 单位 = 1300/2100 毫米
      uGrain: { value: new THREE.Vector2(300 * 2.2 / (SHEET_W / w), 300 * 0.8 / (SHEET_W / w)) },
      uCam: shared.uCam, uFogColor: shared.uFogColor, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar
    }
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.2;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
