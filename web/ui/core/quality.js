// 画质分档：高（烘焙光照＋面光＋后期光柱浮尘＋舆图全精度）/ 中 / 低（安卓、核显）。
// 首启按显卡名、内存、是否移动端粗定一档；设置里可改（settings.quality：auto | high | medium | low）。
import { getSetting } from './settings.js';

export const PROFILES = {
  high: {
    tier: 'high', maxPixelRatio: 2, antialias: true, shadowMapSize: 4096, post: true, shafts: true, dust: 5200,
    envCubeSize: 256, mapGrid: [840, 616], mapHiRes: true, trees: true, anisotropy: 8
  },
  medium: {
    tier: 'medium', maxPixelRatio: 1.25, antialias: true, shadowMapSize: 2048, post: true, shafts: false, dust: 1800,
    envCubeSize: 128, mapGrid: [560, 410], mapHiRes: true, trees: true, anisotropy: 4
  },
  low: {
    tier: 'low', maxPixelRatio: 1, antialias: false, shadowMapSize: 1024, post: false, shafts: false, dust: 0,
    envCubeSize: 64, mapGrid: [420, 308], mapHiRes: false, trees: false, anisotropy: 2
  }
};

// 粗测：拿显卡名与环境判断。不跑测速（首帧前没有场景可测），场景起来后可按帧时再降档
export function detectTier() {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (_e) {
    gpu = '';
  }
  const mem = navigator.deviceMemory || 8;
  if (mobile) return { tier: mem >= 8 ? 'medium' : 'low', gpu, reason: '移动端' };
  if (/SwiftShader|llvmpipe|Software/i.test(gpu)) return { tier: 'low', gpu, reason: '软件渲染' };
  const discrete = /NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Arc A|Apple M[1-9] (Pro|Max|Ultra)/i.test(gpu);
  if (discrete && mem >= 8) return { tier: 'high', gpu, reason: '独显' };
  if (/Intel|UHD|Iris|Radeon\(TM\) Graphics|Vega|Apple M/i.test(gpu)) return { tier: 'medium', gpu, reason: '核显' };
  return { tier: 'medium', gpu, reason: '未识别' };
}

let current = null;
export function resolveQuality() {
  const want = getSetting('quality');
  const auto = detectTier();
  const tier = want && want !== 'auto' && PROFILES[want] ? want : auto.tier;
  current = { ...PROFILES[tier], detected: auto };
  return current;
}

export function quality() {
  return current || resolveQuality();
}
