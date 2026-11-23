// 聚落等第：舆图上每个府州画什么样的聚落，由它自己的数定——越繁华，城越大、楼越多、四郊村舍越密；凋敝了城垣残破。
// 纯算，不碰内核：数由 adapter/select.js 的 settlements() 读来，面积由舆图按府州轮廓量。
// 分档线照三部官方剧本开局的分布定（天启：繁荣中位 47、商贸中位约二十万、户口中位约二十四万口；晚唐、绍宋同量级）。
// 带回差：升档要越过线一截才升，降档也要跌过一截才降，月月微动的数不让城郭来回换样。

// 样子：定居之地画城郭，草原游牧之地画帐幕，土司、部落之地画山寨（照 CK3 按领地类别换建筑图）
export const STYLE = { city: 'city', nomad: 'nomad', tribal: 'tribal' };
// 城郭四档（京城另画）：小城、府城、大府、都会；帐幕、山寨各两档
export const CITY_TIER = ['小城', '府城', '大府', '都会'];
const CITY_LINES = [36, 56, 76];          // 天启开局：小城约三成、府城三成、大府三成、都会约二十处；晚唐、绍宋都会只几处
const CAMP_LINES = [40];
const BAND = 4;
// 残破：定居之地繁荣跌破 14 就算，回到 18 以上才算复起；天灾兵燹把耕地或商贸砍去一半以上也算
const RUIN_IN = 14, RUIN_OUT = 18, RUIN_DAMAGE = 0.5;
// 市镇、港口：商贸量（两）到这些数才有
export const MARKET_LINES = [2e6, 6e6, 2e7];
export const PORT_LINE = 1e6;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const lg = (v) => Math.log10(Math.max(1, num(v)));

// 繁华分（0～100）：繁荣（本是百分指数）占四成五，商贸（对数）占三成，户口（对数）占两成五。
// 商贸一万两、户口一万口以下记零；商贸两千万两、户口三百一十六万口记满
export function prosperityScore({ prosperity, commerce, mouths } = {}) {
  const P = clamp01(num(prosperity) / 100);
  const C = clamp01((lg(commerce) - 4) / 3.3);
  const M = clamp01((lg(mouths) - 4) / 2.5);
  return Math.round((0.45 * P + 0.3 * C + 0.25 * M) * 1000) / 10;
}

// 按线分档，带回差。lines 由低到高；prev 是上回的档（没有就照分数直接定）
export function tierOf(score, lines, prev = null) {
  const raw = lines.filter((x) => score >= x).length;
  if (prev == null || prev === raw || !(prev >= 0 && prev <= lines.length)) return raw;
  let t = prev;
  if (raw > prev) while (t < raw && score >= lines[t] + BAND) t++;
  else while (t > raw && score < lines[t - 1] - BAND) t--;
  return t;
}

// 地块类别（剧本的政区类别，如「直辖政区」「土司辖地」「牧地」「城」）、地貌、所属势力的类别 → 样子
const NOMAD_KIND = /牧地|牙帐|碛地/;
const TRIBAL_KIND = /土司|峒|部落地|村落|山洞|寨/;
const SETTLED_KIND = /城|港|府|州|郡|京|军|镇|县|道|节度|都督|令制国|王都/;
export function styleOf({ kind = '', terrain = '', factionType = '' } = {}) {
  const k = String(kind), t = String(terrain), f = String(factionType);
  if (/城|港/.test(k)) return STYLE.city;
  // 游牧、部族只看地块本身（类别、地貌），不看此刻谁占着：汉地的城被草原上的势力占了，城还是城
  if (NOMAD_KIND.test(k) || (/草原/.test(t) && !SETTLED_KIND.test(k))) return STYLE.nomad;
  if (TRIBAL_KIND.test(k) || (/羁縻之地/.test(k) && /山|河谷|林/.test(t))) return STYLE.tribal;
  // 林海、寒地、海岛上的部落联盟（野人女真、虾夷之类）：剧本记作「政区」，只能看势力类别认
  if (/部落|部族|部盟/.test(f) && /林|寒|沿海|岛/.test(t) && !SETTLED_KIND.test(k)) return STYLE.tribal;
  return STYLE.city;
}

// 四郊村舍的疏密（乘在按地形撒的村舍上，1 为原样）：户口密度（口/世界像素²，一世界像素约二十五平方公里）取对数。
// 三十口 → 0.14，三百 → 0.6，一千五 → 0.94，五千 → 1.18，封顶 1.6
export function villageFactor(mouths, area) {
  const a = num(area), m = num(mouths);
  if (!(a > 0) || !(m > 0)) return 0.5;
  return Math.max(0.1, Math.min(1.6, 0.15 + (Math.log10(m / a) - 1.5) * 0.47));
}

// 一处府州的聚落。info：{ prosperity, commerce, mouths, damage（耕地、商贸被砍去的较大一项，0～1）, kind, terrain, factionType, capital }；
// prev：上回给这一处的结果（回差用）。返回 { style, score, tier, ruined, markets, port }
// tier：城郭 0 小城 … 3 都会；帐幕、山寨 0 小、1 大。ruined 只给定居之地。markets：市镇几处；port：够不够设港（还要治所近海，由舆图判）
export function settlementOf(info = {}, prev = null) {
  const style = styleOf(info);
  const score = prosperityScore(info);
  const same = prev && prev.style === style ? prev : null;
  const tier = tierOf(score, style === STYLE.city ? CITY_LINES : CAMP_LINES, same ? same.tier : null);
  let ruined = false;
  if (style === STYLE.city && !info.capital) {
    const p = num(info.prosperity), dmg = num(info.damage);
    ruined = dmg >= RUIN_DAMAGE || (same && same.ruined ? p < RUIN_OUT : p < RUIN_IN);
  }
  const c = num(info.commerce);
  const markets = style === STYLE.city && !ruined ? MARKET_LINES.filter((x) => c >= x).length : 0;
  const port = style === STYLE.city && !ruined && c >= PORT_LINE;
  return { style, score, tier, ruined, markets, port };
}
