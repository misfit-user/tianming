// 地名落图：人物所在地、军队驻地这类自由写的地名，认到舆图上的哪一块府州。书案镜头落点、舆图军旗共用一份。
// 写法五花八门：「京师·紫禁城·坤宁宫」「南京」「南直隶·苏州府太仓」「保定高阳」「广东东莞」「福建·漳州府漳浦(在翰林)」。
// 认法依次：
//   一、别名：京师、紫禁城、宫中……落到本方京城；南京、金陵落到应天府（同内核 tm-utils.js _LOC_ALIASES 的分组）
//   二、从后往前逐段认府州：全名、段以府名开头、府名以段开头（段至少两字）、段以府名去「府州卫城」后的字干开头（保定高阳 → 保定府）
//   三、段以省名（或省名简称：北直、南直）开头而府州认不出（广东东莞）：落到该省省会
// placeIndex(text, regions, { capital, seats }) → 下标或 -1
//   regions：舆图府州 [{ name, circuit }]；capital：本方京城的下标；seats：省会名的集合
const CAPITAL = /^(京师|京城|北京|燕京|紫禁城|皇城|宫中|内廷|禁中|大内)/;
// 别名：段等于键、或以键开头（天津三卫 → 天津），依次试所列府州，舆图上有哪块落哪块。
// 后半是舆图上不单列的镇城、卫所、州县，按明代所属落到府（剧本区划里查不到上级，军队驻地常写这些）：
// 蓟州、通州属顺天府；固原州属平凉府；天津三卫在河间府静海境；上海县属松江府；澳门在广州府香山境；陕北即延安、榆林一带
const ALIAS = {
  南京: '应天府', 金陵: '应天府', 陪都: '应天府', 建康: '应天府', 留都: '应天府', 盛京: '沈阳', 姑苏: '苏州府', 长安: '西安府', 临安: '杭州府',
  蓟州: '顺天府', 蓟镇: '顺天府', 通州: '顺天府', 密云: '顺天府', 昌平: '顺天府', 固原: '平凉府', 天津: '河间府', 上海: '松江府', 澳门: '广州府',
  陕北: ['延安府', '榆林镇'], 延绥: ['榆林镇', '延安府'], 甘肃: ['甘州卫'], 汉城: ['京畿道'], 汉阳: ['京畿道']
};
const aliasOf = (seg) => {
  if (ALIAS[seg]) return [].concat(ALIAS[seg]);
  const key = Object.keys(ALIAS).filter((k) => k.length >= 2 && seg.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return key ? [].concat(ALIAS[key]) : [];
};
// 字干：去掉通名（保定府 → 保定、山海关 → 山海、宁夏镇 → 宁夏）
const stem = (name) => String(name).replace(/(府|州|卫|城|所|司|关|镇)$/, '');

export function placeIndex(text, regions, { capital = -1, seats = null } = {}) {
  const t = String(text || '').replace(/[（(][^）)]*[）)]/g, '').trim();
  if (!t || !regions || !regions.length) return -1;
  if (CAPITAL.test(t) && capital >= 0) return capital;
  const segs = t.split(/[·・,，、\s/→>-]+/).filter(Boolean);
  const match = (s) => {
    let i = regions.findIndex((r) => r && r.name === s);
    if (i < 0) i = regions.findIndex((r) => r && r.name && s.startsWith(r.name));
    if (i < 0 && s.length >= 2) i = regions.findIndex((r) => r && r.name && r.name.startsWith(s));
    if (i < 0) i = regions.findIndex((r) => r && r.name && stem(r.name).length >= 2 && s.startsWith(stem(r.name)));
    return i;
  };
  const named = (seg) => {
    for (const a of aliasOf(seg)) { const i = match(a); if (i >= 0) return i; }
    return match(seg);
  };
  for (const seg of segs.slice().reverse()) {
    if (CAPITAL.test(seg) && capital >= 0) return capital;
    const i = named(seg);
    if (i >= 0) return i;
  }
  // 只认得出省：落到省会（没有省会名单就取该省头一块）
  for (const seg of segs) {
    const hits = regions.map((r, i) => (r && r.circuit && (seg.startsWith(r.circuit) || (seg.length >= 2 && r.circuit.startsWith(seg))) ? i : -1)).filter((i) => i >= 0);
    if (!hits.length) continue;
    const seat = seats ? hits.find((i) => seats.has(regions[i].name)) : undefined;
    return seat != null ? seat : hits[0];
  }
  return -1;
}
