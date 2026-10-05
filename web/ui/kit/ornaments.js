// 纹饰：回纹边、云头、连珠圈、鱼尾、纸纹、朱丝栏。现画成 SVG / Canvas，装进 CSS 变量，样式表里直接用。
import { rand } from '../core/rand.js';

const svgURI = (w, h, body) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

// 回纹边：九宫切片用（四边每格一个方回旋、四角一个回字方），border-image-slice = 14
function huiwen(color, { w = 1.25, rails = true } = {}) {
  const B = 14, U = 16, N = 4, S = B * 2 + U * N;
  const unit = [[0, 10.5], [2.5, 10.5], [2.5, 3.5], [13.5, 3.5], [13.5, 9], [6, 9], [6, 6.5], [10.5, 6.5]];
  let d = '';
  const edge = (map) => {
    for (let k = 0; k < N; k++) d += 'M' + unit.map(([a, b]) => map(B + k * U + a, b).map((v) => v.toFixed(2)).join(' ')).join('L');
  };
  edge((a, b) => [a, b]);
  edge((a, b) => [S - a, S - b]);
  edge((a, b) => [b, S - a]);
  edge((a, b) => [S - b, a]);
  if (rails) {
    for (const t of [1, 12.8]) d += `M0 ${t}H${S}M0 ${S - t}H${S}M${t} 0V${S}M${S - t} 0V${S}`;
  }
  let corners = '';
  for (const [x, y] of [[0, 0], [S - B, 0], [0, S - B], [S - B, S - B]]) {
    corners += `<rect x='${x + 3.5}' y='${y + 3.5}' width='7' height='7' fill='none' stroke='${color}' stroke-width='${w}'/>` +
      `<rect x='${x + 5.8}' y='${y + 5.8}' width='2.4' height='2.4' fill='${color}'/>`;
  }
  return svgURI(S, S, `<path d='${d}' fill='none' stroke='${color}' stroke-width='${w}' stroke-linecap='square'/>${corners}`);
}

// 云头：如意云一朵（牌子顶上、题头前）
function yuntou(fill, stroke) {
  return svgURI(48, 18,
    `<path d='M2 17C2 11 8 10 11 13C11 6 17 2 24 2C31 2 37 6 37 13C40 10 46 11 46 17Z' fill='${fill}' stroke='${stroke}' stroke-width='1.2'/>` +
    `<path d='M19 12C19 8 29 8 29 12M22 12C22 10.5 26 10.5 26 12' fill='none' stroke='${stroke}' stroke-width='1.1'/>`);
}

// 连珠圈：圆章外一圈联珠（瓦当、铜镜的边）
function lianzhu(color) {
  let dots = '';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    dots += `<circle cx='${(29 + 24.2 * Math.cos(a)).toFixed(2)}' cy='${(29 + 24.2 * Math.sin(a)).toFixed(2)}' r='1.15' fill='${color}'/>`;
  }
  return svgURI(58, 58,
    `<circle cx='29' cy='29' r='27.3' fill='none' stroke='${color}' stroke-width='1.3'/><circle cx='29' cy='29' r='21' fill='none' stroke='${color}' stroke-width='.8'/>${dots}`);
}

// 鱼尾：古籍版心的黑鱼尾
function yuwei(color) {
  return svgURI(28, 14, `<path d='M0 0H28V12L14 5L0 12Z' fill='${color}'/>`);
}

// 盘长结：牙牌系绳上的小结
function panchang(color) {
  return svgURI(20, 20,
    `<g fill='none' stroke='${color}' stroke-width='1.6'><rect x='5' y='5' width='10' height='10' transform='rotate(45 10 10)'/>` +
    `<path d='M6.5 10H13.5M10 6.5V13.5'/><circle cx='10' cy='1.8' r='1.2'/><circle cx='10' cy='18.2' r='1.2'/><circle cx='1.8' cy='10' r='1.2'/><circle cx='18.2' cy='10' r='1.2'/></g>`);
}

// 纸纹：细纤维与淡斑（叠在纸色渐变上）
function paperGrain(seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = rand(seed);
  for (let i = 0; i < 26; i++) {
    const x = r() * 256, y = r() * 256, rad = 20 + r() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(140,105,60,${r() * 0.06})`);
    grad.addColorStop(1, 'rgba(140,105,60,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 1400; i++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI, len = 2 + r() * 10;
    g.strokeStyle = r() < 0.5 ? `rgba(255,252,240,${r() * 0.3})` : `rgba(110,85,50,${r() * 0.12})`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  return `url(${c.toDataURL('image/png')})`;
}

// 漆面：极细的断纹与刷痕（叠在黑漆渐变上，近看才见）
function lacquerGrain(seed = 13) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = rand(seed);
  for (let i = 0; i < 700; i++) {
    const x = r() * 256, y = r() * 256;
    g.strokeStyle = r() < 0.6 ? `rgba(0,0,0,${0.08 + r() * 0.12})` : `rgba(150,100,60,${r() * 0.07})`;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 34, y + (r() - 0.5) * 4);
    g.stroke();
  }
  return `url(${c.toDataURL('image/png')})`;
}

// 绫：本色地上同色暗花小朵云（隔行错开），可平铺。手卷天头、立轴边用
function lingTile(ground, { light = 'rgba(255,250,236,0.14)', dark = 'rgba(0,0,0,0.06)', seed = 3 } = {}) {
  const step = 36, W = step * 2, H = Math.round(step * 1.6);
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext('2d');
  const r = rand(seed);
  g.fillStyle = ground;
  g.fillRect(0, 0, c.width, c.height);
  const cloud = (x, y) => {
    const s = step * 0.16;
    g.strokeStyle = light;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x, y, s, Math.PI * 0.9, Math.PI * 2.1);
    g.arc(x + s * 1.1, y + s * 0.35, s * 0.6, Math.PI * 1.1, Math.PI * 2.4);
    g.arc(x - s * 1.1, y + s * 0.35, s * 0.6, Math.PI * 0.6, Math.PI * 1.9);
    g.stroke();
    g.strokeStyle = dark;
    g.beginPath();
    g.moveTo(x - s * 1.6, y + s * 0.95);
    g.lineTo(x + s * 1.6, y + s * 0.95);
    g.stroke();
  };
  // 两倍大小画一遍，四邻各补一份，接缝处不断
  for (let j = 0; j < 4; j++) {
    for (let i = -1; i < 5; i++) cloud(i * step + (j % 2) * step / 2, j * H / 2 + step * 0.4);
  }
  for (let y = 0; y < c.height; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.012 + r() * 0.018})`;
    g.fillRect(0, y, c.width, 1);
  }
  return `url(${c.toDataURL('image/png')})`;
}

export function installOrnaments() {
  const root = document.documentElement.style;
  root.setProperty('--huiwen', huiwen('#c9a45c'));
  root.setProperty('--huiwen-thin', huiwen('#c9a45c', { w: 1, rails: false }));
  root.setProperty('--huiwen-ink', huiwen('#7a2a1c', { w: 1.1 }));
  root.setProperty('--yuntou', yuntou('#24150e', '#c9a45c'));
  root.setProperty('--yuntou-red', yuntou('#8a2216', '#e8c982'));
  root.setProperty('--lianzhu', lianzhu('#c9a45c'));
  root.setProperty('--yuwei', yuwei('#2a1d14'));
  root.setProperty('--panchang', panchang('#b3301d'));
  root.setProperty('--paper-grain', paperGrain());
  root.setProperty('--lac-grain', lacquerGrain());
  root.setProperty('--ling-qing', lingTile('#76837f'));
  root.setProperty('--ling-brown', lingTile('#6b5a3e', { light: 'rgba(255,240,210,0.12)', seed: 5 }));
  root.setProperty('--ling-mi', lingTile('#d4c49c', { light: 'rgba(255,252,240,0.22)', seed: 7 }));
}
