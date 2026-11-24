// 刻本字用的简→繁。邸报、实录、金榜、书签这几处用齐伋体（--f-print），那字体自己只会一字对一字地换：
// 灾印成災，后、里、于这类一简多繁的字它不敢换，印出来就是「十日后匿災」，简繁混排。
// 这里先按词转成繁体再交给字体：OpenCC 词表最长匹配，余下按字取首选（十日后→十日後、皇后照旧、三百里不作三百裏）。
// 人名另算：一简多繁、候选里又有它自己的字，人名里照原字（范景文、于谦、涂文辅不作範、於、塗）；
// 叶、万、云三字人名里本作葉、萬、雲。人名单由 adapter 登记（setHantNames），文中先把人名切出来再转其余各段，
// 免得「督师范景文」切成「師範」。
//   hant(text)      一段文字
//   hantName(name)  单个人名（金榜上的名字）
import { CHARS, KEEP, PHRASES } from '../../vendor/opencc/s2t.js';

// 本朝专名补正：OpenCC 词表里没有，或取了今义今形。优先于词表
const OURS = {
  台吉: '台吉', 咸福宫: '咸福宮', 岳州: '岳州', 岳阳: '岳陽', 征夷: '征夷', 征虏: '征虜', 升龙: '昇龍', 历算: '曆算',
  // 今繁体多作「佈」，明清刻本作「布」
  颁布: '頒布', 公布: '公布', 宣布: '宣布', 发布: '發布', 布防: '布防', 布置: '布置', 布告: '布告', 散布: '散布', 分布: '分布', 遍布: '遍布'
};
const NAME_PREFER = { 叶: '葉', 万: '萬', 云: '雲' };

let CH = null;
let PH = null;
let KEEPS = null;
let MAX = 1;
function ready() {
  if (CH) return;
  CH = new Map();
  const cps = [...CHARS];
  for (let i = 0; i + 1 < cps.length; i += 2) CH.set(cps[i], cps[i + 1]);
  KEEPS = new Set(KEEP);
  PH = new Map();
  for (const e of PHRASES.split('|')) {
    const at = e.indexOf('=');
    const src = at < 0 ? e : e.slice(0, at);
    const out = [...src].map((c) => CH.get(c) || c);
    if (at >= 0) {
      const d = [...e.slice(at + 1)];
      for (let i = 0; i + 1 < d.length; i += 2) out[parseInt(d[i], 36)] = d[i + 1];
    }
    PH.set(src, out.join(''));
    if (src.length > MAX) MAX = src.length;
  }
  for (const [s, t] of Object.entries(OURS)) {
    PH.set(s, t);
    if (s.length > MAX) MAX = s.length;
  }
}

// 建表约一百毫秒：开机后趁空闲先建好，头一回翻开邸报、实录不卡
export function warmHant() {
  const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(() => ready());
}

// 人名单：首字 → 以此字起头的人名（长的在前）。登记的是取名单的函数，名单变了（新人入册）下回自然重建
let source = null;
let sig = '';
let byFirst = null;
let fresh = false;   // 同一轮里（邸报一页上百条题）只取一回名单，下一轮再看变没变
export function setHantNames(fn) {
  source = typeof fn === 'function' ? fn : null;
  sig = '';
  byFirst = null;
  fresh = false;
}
function names() {
  if (!source) return null;
  if (fresh) return byFirst;
  fresh = true;
  queueMicrotask(() => { fresh = false; });
  const list = (source() || []).filter((n) => typeof n === 'string' && /^[㐀-鿿]{2,8}$/.test(n));
  const now = `${list.length}|${list.join('').length}|${list[0] || ''}|${list[list.length - 1] || ''}`;
  if (now !== sig) {
    sig = now;
    byFirst = new Map();
    for (const n of new Set(list)) {
      if (!byFirst.has(n[0])) byFirst.set(n[0], []);
      byFirst.get(n[0]).push(n);
    }
    for (const v of byFirst.values()) v.sort((a, b) => b.length - a.length);
  }
  return byFirst;
}

// 不含人名的一段：词表最长匹配，余下按字（扩展区的字一字两个 UTF-16 单元，按码位取）
function plain(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    let hit = 0;
    for (let n = Math.min(MAX, s.length - i); n > 1; n--) {
      const t = PH.get(s.substr(i, n));
      if (t !== undefined) { out += t; hit = n; break; }
    }
    if (hit) { i += hit; continue; }
    const c = String.fromCodePoint(s.codePointAt(i));
    out += CH.get(c) || c;
    i += c.length;
  }
  return out;
}

export function hantName(name) {
  ready();
  return [...String(name == null ? '' : name)].map((c) => NAME_PREFER[c] || (KEEPS.has(c) ? c : CH.get(c) || c)).join('');
}

export function hant(text) {
  if (text == null || text === '') return '';
  ready();
  const s = String(text);
  const nm = names();
  if (!nm || !nm.size) return plain(s);
  let out = '';
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const list = nm.get(s[i]);
    if (!list) continue;
    const n = list.find((w) => s.startsWith(w, i));
    if (!n) continue;
    out += plain(s.slice(from, i)) + hantName(n);
    i += n.length - 1;
    from = i + 1;
  }
  return out + plain(s.slice(from));
}
