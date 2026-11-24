// 聚落等第：舆图上每个府州画什么样的聚落，由它自己的数定——越繁华，城越大、楼越多、四郊村舍越密；凋敝了城垣残破；
// 真建了的营造（书院、仓廒、城堡……）在治所四周画成地标。
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

// ---------- 营造地标（照 CK3 地图上画出特殊建筑） ----------
// 府州名下真建了的营造，在治所四周画一座小景。营造的名字是自由文字（某某书院、某某织造局），按名字里的字归类：
// 照内核 tm-building-works 的关键词表，次序改成先认具体的——文庙、孔庙是学不是庙，城隍庙、关帝庙是庙不是城、关，
// 箭塔是堡不是塔，观音寺是寺不是观，钞关是市不是关，水寨是堡，海塘是水利；清真寺、天主堂那时多是中式殿宇，画祠庙那样的殿，不画佛塔。
// 名字认不出再看营造类别；都认不出（如药舍、水井）不画。
// 市舶司、码头、渡口之类不另画地标，给治所设港；钞关、榷场、会馆、街市之类添一处市镇。
// 在建的画脚手架，半损的画一小片残垣（不论认不认得出是什么），失修的照画原样。
const LANDMARK_WORDS = [
  ['academy', /书院|文庙|孔庙|夫子庙|学宫|儒学|县学|州学|府学|社学|学校|学堂|学舍|官学|国子|太学|贡院|庠/],
  ['beacon', /烽|燧|墩|哨|戍|巡检/],
  ['fort', /箭|敌楼|敌台|炮台|望楼/],
  ['shrine', /祠|庙|观(?!音)|城隍|道院|清真|礼拜|天主|教堂/],
  ['temple', /佛|禅|寺|塔|庵|浮屠|伽蓝|兰若|精舍/],
  ['port', /市舶|港|码头|船厂|船坞|渡/],
  ['market', /钞关|税关|榷场|互市|马市|会馆|街市|商铺|坊市|集市|市/],
  ['waterworks', /海塘|河工|水利|圩|梯田|屯田|营田|垦|灌|渠|堰|陂|闸|坝|堤|塘/],
  ['granary', /仓|廪|廒|常平/],
  ['fort', /水寨|水城|海防|靖海|水师|水军|战船|舰队|城|墙|关|堡|寨|垒|卫所|军府|营|武库|校场|总兵|边镇/],
  ['workshop', /织造|工坊|作坊|窑|冶|铸|矿|铁厂|盐|军械|兵仗|火药|厂/],
  ['relay', /驿|递|铺舍|道路|官道|驰道|栈道|马场|马政|牧场|养马/],
  ['bridge', /桥/],
  ['yamen', /衙|署|廨|府治|县治|察院|布政|按察|总督|巡抚|公馆|文书|架阁/]
];
const LANDMARK_CATEGORY = { economic: 'workshop', military: 'fort', cultural: 'academy', administrative: 'yamen', religious: 'shrine', infrastructure: 'relay' };
const LANDMARK_MAX = 4;                   // 建成的至多画四样（同样的只画一座），另加在建、半损各一
// 地标会有哪几样（舆图照这张备模型）：认得出的各样，港、市不在其列（另设港、添市镇），加在建、半损
export const LANDMARK_KINDS = [...new Set([...LANDMARK_WORDS.map(([kind]) => kind), ...Object.values(LANDMARK_CATEGORY)])]
  .filter((kind) => kind !== 'port' && kind !== 'market').concat(['scaffold', 'ruin']);
export function landmarkOf(b) {
  const name = String((b && (b.name || b.type)) || '');
  for (const [kind, re] of LANDMARK_WORDS) if (re.test(name)) return kind;
  return LANDMARK_CATEGORY[String((b && b.category) || '')] || null;
}
// 一处府州的营造（[{ name, category, status }]）→ { landmarks: 治所四周画的地标, port: 有没有建成的港, markets: 建成的市几处 }
export function worksOf(buildings) {
  const done = [];
  let building = false, damaged = false, port = false, markets = 0;
  for (const b of Array.isArray(buildings) ? buildings : []) {
    if (!b) continue;
    const status = String(b.status || '');
    if (status === 'building') { building = true; continue; }
    if (status === 'damaged') { damaged = true; continue; }
    const kind = landmarkOf(b);
    if (kind === 'port') port = true;
    else if (kind === 'market') markets++;
    else if (kind && !done.includes(kind)) done.push(kind);
  }
  const landmarks = done.slice(0, LANDMARK_MAX);
  if (building) landmarks.push('scaffold');
  if (damaged) landmarks.push('ruin');
  return { landmarks, port, markets };
}

// 一处府州的聚落。info：{ prosperity, commerce, mouths, damage（耕地、商贸被砍去的较大一项，0～1）, kind, terrain, factionType, capital, buildings }；
// prev：上回给这一处的结果（回差用）。返回 { style, score, tier, ruined, markets, port, portBuilt, landmarks }
// tier：城郭 0 小城 … 3 都会；帐幕、山寨 0 小、1 大。ruined 只给定居之地。markets：市镇几处（至多三处）；
// port：设不设港——商贸够了要治所近海才设；建了港（portBuilt）近海设在海岸、不近海设在河边、连河也不近就摆在治所旁，都由舆图判；landmarks：见 worksOf
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
  const works = worksOf(info.buildings);
  const byTrade = style === STYLE.city && !ruined;
  const markets = ruined ? 0 : Math.min(MARKET_LINES.length, (byTrade ? MARKET_LINES.filter((x) => c >= x).length : 0) + works.markets);
  const portBuilt = !ruined && works.port;
  const port = portBuilt || (byTrade && c >= PORT_LINE);
  return { style, score, tier, ruined, markets, port, portBuilt, landmarks: works.landmarks };
}
