// 记数：汉字记数为默认（设置里可改阿拉伯数字），九品等第，干支，亏盈。
// 写法由设置项 numerals 决定：'cn'（一千二百三十万）或 'arabic'（1230万）。

let style = 'cn';
export function setNumeralStyle(s) {
  style = s === 'arabic' ? 'arabic' : 'cn';
}
export function numeralStyle() {
  return style;
}

const D = '零一二三四五六七八九';
function cn4(n) {
  const units = ['', '十', '百', '千'];
  const ds = String(n).split('').map(Number);
  let s = '', zero = false;
  ds.forEach((d, i) => {
    const u = ds.length - 1 - i;
    if (d === 0) { zero = true; return; }
    if (zero && s) s += '零';
    zero = false;
    s += (d === 1 && u === 1 && i === 0 ? '' : D[d]) + units[u];
  });
  return s || '零';
}

// 整数 → 汉字：一千二百三十万、九千一百五十、三亿零五百万（万以下的零头在亿级时略去）
export function cnNum(n) {
  n = Math.round(Math.abs(n));
  if (n >= 1e8) {
    const y = Math.floor(n / 1e8), r = Math.round((n % 1e8) / 1e4);
    return cn4(y) + '亿' + (r ? (r < 1000 ? '零' : '') + cn4(r) + '万' : '');
  }
  if (n >= 1e4) {
    const w = Math.floor(n / 1e4), r = n % 1e4;
    return cn4(w) + '万' + (r ? (r < 1000 ? '零' : '') + cn4(r) : '');
  }
  return cn4(n);
}

// 阿拉伯数字也按万、亿进位（1230万、3.05亿），读起来与汉字版一致
export function arabicNum(n) {
  n = Math.round(Math.abs(n));
  if (n >= 1e8) return trim(n / 1e8) + '亿';
  if (n >= 1e4) return trim(n / 1e4) + '万';
  return String(n);
}
function trim(x) {
  return x >= 100 ? String(Math.round(x)) : x.toFixed(x >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

// 按当前设置写一个数
export function num(n) {
  if (n == null || Number.isNaN(n)) return '无考';
  return style === 'arabic' ? arabicNum(n) : cnNum(n);
}

// 增减：「亏八十二万」「盈三万」；零返回空串
export function delta(v) {
  if (!v || Number.isNaN(v)) return '';
  return (v < 0 ? '亏' : '盈') + num(v);
}

// 「13万」「-82万」「-9150」这类写法 → 数
export function parseAmount(s) {
  if (typeof s === 'number') return s;
  const m = String(s).trim().match(/^([+-]?)([\d.]+)\s*(万|亿)?$/);
  if (!m) return NaN;
  return (m[1] === '-' ? -1 : 1) * parseFloat(m[2]) * (m[3] === '亿' ? 1e8 : m[3] === '万' ? 1e4 : 1);
}

// 九品：百分制，每 100/9 分一品，下下 … 上上
export const GRADES = ['下下', '下中', '下上', '中下', '中中', '中上', '上下', '上中', '上上'];
export function gradeIndex(v) {
  return Math.max(0, Math.min(8, Math.floor((v / 100) * 9)));
}
export function grade(v) {
  return GRADES[gradeIndex(v)];
}

// 公元年 → 干支
export function ganzhi(year) {
  const g = '甲乙丙丁戊己庚辛壬癸', z = '子丑寅卯辰巳午未申酉戌亥';
  const k = ((year - 4) % 60 + 60) % 60;
  return g[k % 10] + z[k % 12];
}

// 月份：正月、二月 … 十一月、腊月
const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '腊月'];
export function monthName(m) {
  return MONTHS[(m - 1 + 12) % 12];
}
export function season(m) {
  return ['春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬', '冬', '冬'][(m - 1 + 12) % 12];
}
// 日：初一 … 初十、十一 … 二十、廿一 … 三十
export function dayName(d) {
  if (d <= 10) return '初' + (d === 10 ? '十' : D[d]);
  if (d < 20) return '十' + D[d - 10];
  if (d === 20) return '二十';
  if (d < 30) return '廿' + D[d - 20];
  return '三十';
}
