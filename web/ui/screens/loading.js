// 载入：一方朱印「春秋」、一道金线由中间向两边长、一行小字报步（研墨、张灯、展图……）。
import { h } from '../core/dom.js';
import { sealCanvas, loadFonts } from '../kit/brush.js';

// veil：半透的一层，压在书房上（开局、启封时用），书房隐约还在
export function loadingScreen(root, { veil = false } = {}) {
  const seal = h('div.seal');
  const bar = h('i');
  const cap = h('div.cap', '');
  const sub = h('div.sub', '');
  const el = h('div.scr.scr-load' + (veil ? '.veil' : ''), h('div.box', seal, h('div.line', bar), cap, sub));
  root.append(el);
  loadFonts({ 'TM-Seal': '春秋', 'TM-WenKai': '研墨张灯展图启卷就绪' }).then(() => {
    seal.style.backgroundImage = `url(${sealCanvas({ chars: ['春', '秋'], style: 'zhu', w: 144, seed: 11 }).toDataURL()})`;
  });
  return {
    set(text, k) {
      cap.textContent = text;
      if (typeof k === 'number') bar.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 22)}rem`;
    },
    sub(text) { sub.textContent = text || ''; },
    async done() {
      el.classList.add('out');
      await new Promise((r) => setTimeout(r, 950));
      el.remove();
    }
  };
}

// 内核报的步名多是开发口吻（「进入游戏世界」「构建索引」「NPC 动机与危机分岔」），墨幕上换作书房里的话；
// 认不得的照录，带洋字、术语的不报（留着上一句）
const SAY = [
  [/读取(官方)?剧本|加载剧本配置/, '检阅卷宗'], [/地方区划/, '勘定州县'], [/建筑与经济/, '清点府库'], [/构建索引/, '编次名册'],
  [/进入游戏世界/, '诸事就绪'], [/深度阅读完成/, '史官研读已毕'], [/深度阅读/, '史官研读典籍'], [/推演锚点|动机与危机/, '揣摩人心时势'],
  [/首回合候选事件/, '预拟本季时事'], [/势力动态|国际格局/, '揣度四方动静'], [/逻辑审查|史实校验|历史检查|证据校验/, '校核史实'],
  [/生成|初始化/, '铺陈案牍']
];
function inWorld(text) {
  const t = String(text || '').trim();
  const hit = SAY.find(([re]) => re.test(t));
  if (hit) return hit[1];
  return /[A-Za-z]|缓存|索引|数据|模型|调用|队列/.test(t) ? '' : t;
}

// 开局、启封这几段长等（读剧本到开场白、临朝到落座、启封旧卷）：内核要独占主线程好一阵，原先画面就僵在那里、点了像没点。
// 铺一层墨幕，报内核的进度（showLoading 转来的 kernel:loading）；painted 等这一帧真画出来，再把主线程交给内核
export function cover(root, game, cap, sub = '') {
  const ld = loadingScreen(root, { veil: true });
  ld.set(cap, 0.04);
  ld.sub(sub);
  loadFonts({ 'TM-WenKai': cap + sub + SAY.map((x) => x[1]).join('') }).catch(() => { /* 字未到就用楷体垫着 */ });
  const off = game.on('kernel:loading', ({ text, pct }) => {
    const say = inWorld(text);
    if (say) ld.sub(say);
    if (pct != null) ld.set(cap, Math.max(0.04, pct / 100));
  });
  const painted = new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let closed = false;
  return { painted, done: () => { if (closed) return Promise.resolve(); closed = true; off(); return ld.done(); } };
}
