// 军务：诸军名册、单军详情、战事、流寇。读法与现行右栏（phase8-formal-rightrail.js rightArmy*）一致——
// 只列本朝之军（找不到本朝之军时列全部）；兵额走奏报失真层（名册显据奏名员，核饷点验才掀实额）；军心走内核 _armyMorale。
// 动作照现行右栏：核饷点验、补饷（MilitarySystems 实付）、整训与调防入议事清册、易将（内核拜帅，候选为在世将才）、
// 付廷议（屏幕层开朝议并带上议题）、接战预勾三态。老军务面板的「犒军」（白给士气）与 prompt 调兵现行界面已不用，这里也不接。
import { bus } from '../core/bus.js';
import { suggest } from './edict.js';
import { num, turnTag } from '../core/numerals.js';
import { money } from './currency.js';

const w = window;
const G = () => w.GM || {};
const changed = (what) => bus.emit('game:changed', { what });
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);

const first = (a, keys, fb) => { for (const k of keys) { const v = a && a[k]; if (v != null && v !== '') return v; } return fb; };
const numOf = (a, keys, fb) => { let v = first(a, keys, null); if (typeof v === 'string') v = v.replace(/,/g, ''); const n = Number(v); return v != null && Number.isFinite(n) ? n : fb; };
const pct = (a, keys, fb) => Math.max(0, Math.min(100, numOf(a, keys, fb)));
const COMMANDER = ['commander', 'commanderName', 'commanderDisplayName', 'commander_name', 'general', 'generalName', 'leader', 'leaderName', 'commandingOfficer', 'chiefCommander', 'chiefGeneral', 'mainGeneral'];
const FACTION = ['faction', 'factionName', 'owner', 'camp', 'force', 'realm', 'country', 'polity'];
const dateOf = (turn) => { const f = fn('getTSText'); return f && turn != null ? f(turn) : turnTag(turn); };

// ---------- 本朝之军 ----------
// 认本方按势力本身：军上记的势力编号或全名在势力表里查得到哪一家，就看那一家是不是玩家的。
//   原先去掉「大」「朝廷」后按字面包含认，晚唐「唐·魏博镇」里含个「唐」、绍宋「吕宋诸邦」里含个「宋」，魏博、成德诸镇与吕宋的兵
//   都算成本方——插红旗、进军务册、还能易将调防（11-22 查出）。表里查不到的写法（工坊剧本的「后金军」「明军」）才按名比，取对得最贴的一家
const cleanFac = (v) => String(v || '').replace(/[\s·\-—_]/g, '').replace(/^大/, '').replace(/(朝廷|王朝|政权|汗国|幕府|朝)$/g, '');
const genericCourt = (v) => /^(朝廷|本朝|官府|内廷|宫廷|皇室|王室|帝室|朝中|中枢)$/.test(String(v || '').trim());
const facKey = (f) => String(f.id || f.name || '');
const facTable = () => { const g = G(); return [g.facs, g.factions].flatMap((l) => (Array.isArray(l) ? l : [])).filter((f) => f && (f.id || f.name)); };
const facRecord = (v, facs) => { const s = String(v == null ? '' : v).trim(); return s ? facs.find((f) => f.id === s || f.name === s) || null : null; };
function playerFactions() {
  const g = G(), p = w.P || {}, out = [];
  const add = (v) => { if (!v) return; if (typeof v === 'object') return add(v.name || v.factionName || v.id || v.key); v = String(v).trim(); if (v && !out.includes(v)) out.push(v); };
  const pi = p.playerInfo || {};
  add(pi.factionName); add(pi.characterFaction); add(g.playerFaction);
  const pc = Array.isArray(g.chars) ? g.chars.find((c) => c && c.isPlayer) : null;
  add(pc && (pc.factionId || pc.faction || pc.factionName));
  [g.facs, g.factions].forEach((list) => (Array.isArray(list) ? list : []).forEach((f) => { if (f && (f.isPlayer || f.player || f.isPlayerFaction || (g.playerFaction && f.name === g.playerFaction))) add(f.name || f.id); }));
  return out;
}
// 表外的写法对哪一家：去掉「大」「朝廷」后整名相等的先；不然取它所含的最长一家（「后金军」对「后金」、「唐魏博镇军」对「唐魏博镇」不对「唐」）；
//   再不然它只被唯一一家所含才算
function nearestFaction(v, rows) {
  const c = cleanFac(v);
  if (!c) return null;
  const named = rows.map((r) => ({ r, m: cleanFac(r.v) })).filter((x) => x.m);
  const same = named.find((x) => x.m === c);
  if (same) return same.r;
  const inner = named.filter((x) => c.includes(x.m)).sort((a, b) => b.m.length - a.m.length)[0];
  if (inner) return inner.r;
  const outer = named.filter((x) => x.m.includes(c));
  return outer.length === 1 ? outer[0].r : null;
}
function factionCtx() {
  const facs = facTable(), player = playerFactions();
  const mineKeys = new Set(player.map((v) => facRecord(v, facs)).filter(Boolean).map(facKey));
  const rows = [];
  facs.forEach((f) => [f.name, f.id].forEach((v) => { if (v) rows.push({ v: String(v), mine: mineKeys.has(facKey(f)) }); }));
  player.forEach((v) => { if (!facRecord(v, facs)) rows.push({ v, mine: true }); });
  return { player, facs, mineKeys, rows };
}
function mine(a, ctx) {
  if (!a || a.destroyed || a.disbanded || a.active === false) return false;
  // 民变各股的军（tm-revolt-band.js 立，带 _revoltBand、势力记「民变」，不在势力表里）不是本方的：原先因「势力不在表里」落到下面末一句
  //   当成本方，列进诸军、插上红色军旗（11-22 查出）。它列在「战事」页签的「民变」组与墨旗上；成势时军上这个记号随之撤掉，归新势力
  if (a._revoltBand) return false;
  const explicit = ['factionId', ...FACTION].map((k) => a[k]).filter((x) => x != null && String(x).trim());
  if (!explicit.length || explicit.some(genericCourt) || !ctx.player.length) return true;
  const rec = explicit.map((x) => facRecord(x, ctx.facs)).find(Boolean);
  if (rec && ctx.mineKeys.size) return ctx.mineKeys.has(facKey(rec));
  const near = explicit.map((x) => nearestFaction(x, ctx.rows)).find(Boolean);
  return near ? near.mine : true;
}
const liveArmies = () => {
  const g = G();
  return (Array.isArray(g.armies) && g.armies.length ? g.armies : (w.P && Array.isArray(w.P.armies) ? w.P.armies : [])).filter((a) => a && !a.destroyed && !a.disbanded && a.active !== false);
};
function armies() {
  const raw = liveArmies();
  const ctx = factionCtx();
  const own = raw.filter((a) => mine(a, ctx));
  return own.length || !raw.length ? own : raw;
}
const keyOf = (a, i) => String(first(a, ['id', 'name'], 'army-' + i));
function find(key) {
  const list = armies();
  const i = list.findIndex((a, k) => keyOf(a, k) === key || a.name === key || String(a.id || '') === key);
  if (i < 0) throw new Error('此军已不在册');
  return list[i];
}

// ---------- 读数 ----------
// 兵额：奏报失真层开着时显据奏名员（吃空饷虚增），核饷点验揭实额
function soldiers(a) {
  const t = Math.max(0, Math.round(numOf(a, ['soldiers', 'size', 'strength', 'troops', 'initialTroops'], 0)));
  const RV = w.TM && w.TM.ReportedView;
  if (!RV || !RV.active(w.P || null)) return t;
  let handler = null;
  try { const cn = a.commander || a.commanderName || a.general; if (cn && fn('findCharByName')) handler = w.findCharByName(cn); } catch (_e) { /* 无主帅 */ }
  return RV.value('army', 'soldiers.' + String(a.name || a.id || ''), t, { direction: 'good', dept: 'military', handler }).shown;
}
function morale(a) {
  let v = null;
  if (fn('_armyMorale')) { try { v = w._armyMorale(a); } catch (_e) { v = null; } }
  if (v == null) v = a.morale != null ? a.morale : a.moraleValue != null ? a.moraleValue : 60;
  const n = Number(v);
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 60));
}
function supply(a) {
  if (a.supplyRatio != null) { const r = Number(a.supplyRatio); if (Number.isFinite(r)) return Math.max(0, Math.min(100, r * 100)); }
  return pct(a, ['supply', 'supplies'], 70);
}
const typeOf = (a) => String(first(a, ['armyType', 'type', 'branch', 'category', 'kind'], '其他'));
const commanderOf = (a) => String(first(a, COMMANDER, ''));
function locationOf(a) {
  const v = first(a, ['location', 'garrison', 'station', 'theater', 'region'], '');
  const regions = (G().mapData && G().mapData.regions) || [];
  const r = regions.find((x) => x && (x.id === v || x.name === v));
  return String((r && r.name) || first(a, ['locationName', 'garrisonName'], v) || '');
}
// 驻地落在哪块地块：读内核的绑定（tm-map-locations.js——开局、读档、行军到达、AI 改军时按驻地写定地块；剧本给粗区部署记的代表点
//   也在里头；行在、随驾跟着天子走），舆图军旗照此落点。原先舆图拿驻地文字另认一遍：认不得行在、东京留守司、关陕这些写法，
//   绍宋十五支军上不了图；又照明朝的别名把建康认成应天府（宋图的应天府是商丘），建康水军插到了商丘（11-22 查出）。
//   绑到一块的给一块；只认到几块（「宁远-锦州」）或一片（「福建沿海」）的给候选、记 area，由舆图挑落点、注明约略；认不出的给空
function siteOf(a) {
  const L = w.TMMapLocations;
  if (!L || typeof L.read !== 'function') return null;
  let b = null;
  try { b = L.read(a, 'army', G()); } catch (_e) { b = null; /* 舆图未载：返回空，舆图按驻地文字认 */ }
  if (!b) return null;
  // 剧本写明散驻各地的总账（全国卫所军·总览）：不是驻在某处的一支军，舆图不插旗，也不按文字去猜
  if (b.status === 'dispersed') return { ids: [], exact: false, area: false, dispersed: true };
  if (b.regionId) return { ids: [String(b.regionId)], exact: b.precision !== 'representative', area: false };
  const ids = (b.candidateRegionIds || []).map(String);
  return ids.length ? { ids, exact: false, area: b.status === 'area' } : null;
}
// 一段地名落在哪些地块（行军去处用；通称先换成实地）
function placeIds(text) {
  const L = w.TMMapLocations;
  if (!L || typeof L.placeRegionIds !== 'function' || !text) return [];
  try { return L.placeRegionIds(String(text), G()).map(String); } catch (_e) { return []; /* 认不出：舆图按文字认 */ }
}
const ACTIVITY = { garrison: '驻防', stationed: '驻防', idle: '待命', marching: '行军', march: '行军', moving: '行军', siege: '围城', sieging: '围城', battle: '交战', fighting: '交战', training: '操练', patrol: '巡防', routed: '溃散', disbanded: '裁撤' };
const activityText = (v) => { const raw = String(v || '').trim(); return raw ? ACTIVITY[raw.toLowerCase()] || raw : '驻防'; };
function marchOf(a) {
  const mo = (G().marchOrders || []).find((o) => o && o.status === 'marching' && (o.armyId === a.id || o.armyName === a.name));
  return mo ? { to: mo.to || '', toIds: placeIds(mo.to), progress: mo.progress || 0, total: mo.totalTurns || 0 } : null;
}
const hotOf = (a) => morale(a) < 45 || supply(a) < 35 || pct(a, ['mutinyRisk', 'rebellionRisk'], 0) >= 55;
function commanderState(name) {
  if (!name) return 'vacant';
  const ch = fn('findCharByName') ? w.findCharByName(name) : null;
  return ch && (ch.alive === false || ch.dead === true) ? 'dead' : 'ok';
}

// 水师：番号或兵种写着水师、水军、舟、船、舰、水寨的（舆图上换一种旗形）
const navalOf = (a) => /水师|水军|舟|船|舰|水营|水寨/.test(String(first(a, ['name'], ''))) || /水|舟|船|navy|naval|fleet/i.test(typeOf(a));

// 主将与旗号之姓（同志 11-22 依议：军是有人统的，舆图旗上写主将之姓，换了将旗跟着变；缺帅的旗写番号、褪色）。
//   取姓要稳：主将在世，名是两三个字，头一字是常见单姓；复姓（欧阳、完颜、耶律）、带汗号的、人物记了非汉族属的（皇太极记「女真」）
//   都不取，舆图照旧写番号。人物没记族属的（晚唐一概没记）只凭名字认
const SURNAMES = new Set([...'赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公仝佟岳帅缑亢况归晋楚闫法汝鄢涂钦商牟佘伯墨谯言浑渠沐种折綦麦栗冼揭丘覃侬奢苻']);
const COMPOUND = /^(欧阳|司马|诸葛|上官|长孙|慕容|宇文|尉迟|独孤|令狐|皇甫|东方|公孙|夏侯|赫连|呼延|澹台|万俟|端木|完颜|耶律|拓跋|轩辕|南宫|西门|司徒|司空|太史|申屠|闻人|百里|鲜于|钟离|宗政|淳于|单于|仲孙|左丘|公羊|东郭|乌古|仆散|纥石|徒单|夹谷|蒲察|赫舍|爱新|叶赫)/;
// 主将一栏常写成说明（「(崔呈秀总督·都指挥分统)」「(毛文龙节制)」「武之望(兼)」「沐天波节制」）：取头一个人名——去掉整栏外的括号与括注，
//   按「·、，/」切开取头一段，再去掉段尾的职衔
function leadName(raw) {
  let s = String(raw || '').trim();
  if (/^[（(].*[）)]$/.test(s)) s = s.slice(1, -1);
  s = s.replace(/[（(][^）)]*[）)]/g, '').split(/[·、，,/\s]/)[0] || '';
  return s.replace(/(总督|节制|提督|总兵|统领|分统|兼|领|摄)$/, '').trim();
}
function commandOf(a) {
  const name = commanderOf(a);
  if (!name) return { name, vacant: true, surname: '' };
  const lead = leadName(name);
  const ch = fn('findCharByName') ? w.findCharByName(name) || (lead && lead !== name ? w.findCharByName(lead) : null) : null;
  if (ch && (ch.alive === false || ch.dead === true)) return { name, vacant: true, surname: '' };
  const kin = ch ? String(ch.ethnicity || ch.culture || '') : '';
  // 写的是一群人（「和硕特、准噶尔、杜尔伯特诸台吉」「(各酋)」「各土司首领」）不取姓
  const group = /[诸各]|酋|首领|部众/.test(name);
  const han = !group && /^[一-鿿]{2,3}$/.test(lead) && !COMPOUND.test(lead) && !/(汗|赞普|台吉|贝勒|特勤|叶护|单于)$/.test(lead) && SURNAMES.has(lead[0]) && (!kin || /^汉/.test(kin));
  return { name, vacant: false, surname: han ? lead[0] : '' };
}

// 名册：按兵种分组（同右栏），附总额
export function roster() {
  const groups = new Map();
  let total = 0, hot = 0, arrears = 0, marching = 0;
  armies().forEach((a, i) => {
    const cmd = commandOf(a);
    const row = { key: keyOf(a, i), name: String(first(a, ['name', 'id'], '未名部队')), commander: cmd.name, location: locationOf(a), site: siteOf(a), soldiers: soldiers(a),
      hot: hotOf(a), arrears: Math.max(0, Math.round(Number(a.payArrearsMonths) || 0)), march: marchOf(a), vacant: cmd.vacant, surname: cmd.surname, naval: navalOf(a) };
    const t = typeOf(a);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(row);
    total += row.soldiers; hot += row.hot ? 1 : 0; arrears += row.arrears ? 1 : 0; marching += row.march ? 1 : 0;
  });
  return { groups: [...groups].map(([type, rows]) => ({ type, rows, soldiers: rows.reduce((s, r) => s + r.soldiers, 0) })), count: [...groups.values()].reduce((s, r) => s + r.length, 0), total, hot, arrears, marching };
}

// ---------- 别家之军（舆图照所知之律插旗用） ----------
// 不是本方、也不是民变各股（墨旗另列）的军：番号、主将、兵数（照实——舆图按所知只露确数或大概）、落点、哪一家与其底色、是否水师
export function foreign() {
  const own = new Set(armies());
  const facs = facTable();
  const out = [];
  liveArmies().forEach((a, i) => {
    if (own.has(a) || a._revoltBand) return;
    const rec = ['factionId', ...FACTION].map((k) => facRecord(a[k], facs)).find(Boolean);
    const cmd = commandOf(a);
    out.push({
      key: keyOf(a, i), name: String(first(a, ['name', 'id'], '未名部队')), commander: cmd.name, vacant: cmd.vacant, surname: cmd.surname,
      soldiers: Math.max(0, Math.round(numOf(a, ['soldiers', 'size', 'strength', 'troops', 'initialTroops'], 0))),
      location: locationOf(a), site: siteOf(a), naval: navalOf(a),
      faction: rec ? String(rec.name || rec.id) : String(first(a, FACTION, '') || ''), factionKey: rec ? facKey(rec) : '', color: rec ? String(rec.color || rec.colour || '') : ''
    });
  });
  return out;
}
// 本方是哪一家：势力表里的编号与名（舆图认本境用——府州记的是哪家的编号）
export function sides() {
  const ctx = factionCtx();
  const mine = new Set(ctx.player);
  ctx.facs.forEach((f) => { if (ctx.mineKeys.has(facKey(f))) [f.id, f.name].forEach((v) => { if (v) mine.add(String(v)); }); });
  return { mine: [...mine] };
}

const TAC = { 'step/spear': '长枪', 'step/sword': '刀盾', 'step/halberd': '镋钯', 'bow/bow': '弓手', 'bow/crossbow': '弩手', 'bow/musket': '火铳', 'art/cannon': '火炮', 'cav/horse': '骑', 'cav/heavy': '重骑', 'cav/shock': '突骑', 'guard/guard': '亲军' };
function units(a) {
  const us = w.TMArmyUnits ? w.TMArmyUnits.ensureArmyUnits(a) : a.units || [];
  const groups = [];
  let cur = null;
  for (const u of us || []) {
    const tac = TAC[`${u.arm || ''}/${u.sub || ''}`] || '杂兵';
    if (!cur || cur.name !== u['番号'] || cur.tac !== tac) { cur = { name: String(u['番号'] || ''), tac, sizes: [], vet: Math.round(u['历练'] || 0) }; groups.push(cur); }
    cur.sizes.push(u.men);
  }
  return groups;
}
function composition(v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? { type: x, count: 0 } : x ? { type: String(x.type || x.name || x.kind || x.unit || '兵种'), count: Number(x.count || x.soldiers || x.size || x.strength || 0) } : null)).filter(Boolean);
  if (v && typeof v === 'object') return Object.keys(v).map((k) => ({ type: k, count: Number(v[k]) || 0 }));
  return [];
}
const PAY = { grain: '粮', cloth: '帛', silver: '银' };
const payName = (k) => (k === 'money' ? money().noun : PAY[k] || k);
function pay(a) {
  const v = first(a, ['salary', 'annualSalary', 'yearlySalary', 'upkeep', 'cost', 'monthlyCost'], '');
  if (Array.isArray(v)) return v.filter((r) => r && typeof r === 'object').map((r) => { const k = r.resource || r.type || r.name || r.currency || ''; return { label: payName(k), amount: Number(r.amount != null ? r.amount : r.value) || 0, unit: r.unit || '', period: r.period || '' }; });
  if (v && typeof v === 'object') return Object.keys(v).map((k) => ({ label: payName(k), amount: Number(v[k]) || 0, unit: '', period: '' }));
  return v !== '' ? [{ label: '', amount: Number(v) || 0, unit: '', period: '' }] : [];
}
function equipment(a) {
  const eq = a.equipment;
  const list = Array.isArray(eq) ? eq.map((x) => (typeof x === 'string' ? { name: x, count: 0, condition: '' } : x ? { name: String(x.name || x.type || '装备'), count: Number(x.count) || 0, condition: String(x.condition || '') } : null)).filter(Boolean) : [];
  return { condition: String(first(a, ['equipmentCondition', 'equipmentStatus', 'equipmentLevel'], '') || (typeof eq === 'string' ? eq : '')), list };
}

export const STANCES = { ask: '若接战·问我', always: '若接战·必亲征', delegate: '若接战·必委之' };
export function detail(key) {
  const a = find(key);
  const cmd = commanderOf(a);
  const CA = w.TM && w.TM.CommandAuthority;
  let command = '';
  try { if (CA && CA.enabled(a)) command = String(CA.describe(a) || ''); } catch (_e) { command = ''; }
  const ctx = factionCtx();
  return {
    key, name: String(first(a, ['name', 'id'], '未名部队')), type: typeOf(a), soldiers: soldiers(a),
    commander: cmd, commanderTitle: String(a.commanderTitle || ''), commanderState: commanderState(cmd),
    location: locationOf(a), quality: String(first(a, ['quality', 'grade', 'eliteLevel'], '') || ''), equipment: equipment(a),
    activity: activityText(first(a, ['activity', 'state', 'status', 'currentAction'], '')), march: marchOf(a),
    desc: String(first(a, ['description', 'desc', 'note', 'memo', 'reason'], '') || ''), faction: String(first(a, FACTION, '') || ''),
    morale: morale(a), training: pct(a, ['training', 'trainingValue'], 50), loyalty: pct(a, ['loyalty', 'cohesion'], 50), control: pct(a, ['control', 'discipline', 'commandControl'], 50),
    supply: supply(a), mutiny: pct(a, ['mutinyRisk', 'rebellionRisk'], 0), hot: hotOf(a),
    composition: composition(a.composition || a.unitsComposition || a.units), units: units(a), pay: pay(a),
    logistics: String(first(a, ['logistics', 'supplyState', 'supplyDepotId'], '') || ''), arrears: Math.max(0, Math.round(Number(a.payArrearsMonths) || 0)),
    command, own: mine(a, ctx), stance: a._battleStance === 'always' ? 'always' : a._battleStance === 'delegate' ? 'delegate' : 'ask'
  };
}

// ---------- 战事、民变 ----------
const PHASE = { march: '行军接敌', 'awaiting-command': '候旨临阵', battle: '交锋', siege: '围城' };
export function battles() {
  const g = G();
  const active = (g.activeBattles || []).filter((b) => b && b.phase !== 'resolved').map((b) => ({
    id: String(b.id || ''), attacker: String(b.attackerArmy || b.attacker || ''), defender: String(b.defenderArmy || b.defender || ''), location: String(b.location || ''), phase: PHASE[b.phase] || String(b.phase || '')
  }));
  const history = (g.battleHistory || []).slice(-12).reverse().map((r) => ({
    when: dateOf(r.turn), attacker: String(r.attacker || r.attackerFaction || ''), defender: String(r.defender || r.defenderFaction || ''), winner: String(r.winner || ''), loser: String(r.loser || ''),
    attackerLoss: Math.round(Number(r.attackerLoss) || 0), defenderLoss: Math.round(Number(r.defenderLoss) || 0), location: String(r.location || r.terrain || '')
  }));
  return { active, history };
}
// 民变各股（GM.minxin.revolts 里正闹着的，与民心页同一口径）：首领、在哪州、众多少、它那支军。
//   流寇池 11-21 删旧时没了，这里原读的 GM.rovingRebels 此后恒空，11-22 改读各股。剿、抚、赈从诏令进，由推演判，这里只列。
//   军照 TM.RevoltBand.bandArmy 认；撤了、散了的不算，溃了的照列、注明
export function rebels() {
  const g = G();
  const RB = w.TM && w.TM.RevoltBand;
  const list = g.minxin && Array.isArray(g.minxin.revolts) ? g.minxin.revolts : [];
  return list.filter((r) => r && r.status === 'ongoing').map((r) => {
    let a = null;
    try { a = RB && typeof RB.bandArmy === 'function' ? RB.bandArmy(g, r) : null; } catch (_e) { a = null; /* 认不出军只少一行「能战」，各股照列 */ }
    const live = !!a && a.destroyed !== true && a.disbanded !== true && a.state !== 'disbanded';
    return {
      id: String(r.id || ''), leader: String(r.leaderName || '') || '无名', region: String(r.region || ''),
      place: (r.province ? String(r.province) + '·' : '') + String(r.region || '某地'),
      followers: Math.max(0, Math.round(Number(r.followers != null ? r.followers : r.scale) || 0)),
      army: live ? String(a.name || '') : '', soldiers: live ? Math.max(0, Math.round(Number(a.soldiers != null ? a.soldiers : a.strength) || 0)) : 0,
      routed: live && (a.routed === true || a.state === 'routed'),
      since: r.turn != null ? dateOf(r.turn) : '', cause: String(r.cause || '')
    };
  }).sort((x, y) => y.followers - x.followers);
}

// ---------- 动作 ----------
// 核饷：失真层开着则点验名册、掀出实额（数回合后重蒙尘）；没开则只是去看度支
export function inspect(key) {
  const a = find(key);
  const name = String(a.name || a.id || '');
  const RV = w.TM && w.TM.ReportedView;
  if (RV && RV.active(w.P || null)) {
    RV.reveal('army', 'soldiers.' + name, 'hexiang');
    changed('army');
    return { revealed: true, text: `核饷点验：${name} 实额已掀见` };
  }
  return { revealed: false, text: '' };
}
// 补饷：内核按欠饷月数、军力与饷率自国库实付（有欠才可补）
export function settle(key) {
  const a = find(key);
  if (!fn('_tsSettleArrears')) throw new Error('内核缺 _tsSettleArrears');
  w._tsSettleArrears(a.name);
  changed('army');
}
// 整训、调防：照右栏原文入议事清册
export function train(key) {
  const name = String(find(key).name || key);
  suggest('军务边防', name, '整训军队', '命 ' + name + ' 整饬营伍、核实兵额、补足器械，并回奏训练成效。');
  changed('edict-suggestion');
  return '已纳入诏书建议库：整训 ' + name;
}
export function redeploy(key) {
  const name = String(find(key).name || key);
  suggest('军务边防', name, '调防军队', '议定 ' + name + ' 调防路线、粮饷供给与接防期限，不得擅离驻地。');
  changed('edict-suggestion');
  return '已纳入诏书建议库：调防 ' + name;
}
// 移防（确定性军令）：行军系统开着（MarchSystem._getConfig().enabled）、本朝之军、不在途时可下；目的地取各方行政区的末级（照老左栏 _leafDivisions）
export function marchable(key) {
  const M = w.MarchSystem;
  if (!M || typeof M.orderMarch !== 'function' || typeof M._getConfig !== 'function') return false;
  try { if (!M._getConfig().enabled) return false; } catch (_e) { return false; }
  const a = find(key);
  return mine(a, factionCtx()) && !marchOf(a);
}
export function destinations() {
  const names = [];
  const seen = new Set();
  const roots = G().adminHierarchy || {};
  const walk = (arr) => (Array.isArray(arr) ? arr : []).forEach((d) => {
    if (!d) return;
    const kids = d.divisions || d.children;
    if (kids && kids.length) walk(kids);
    else if (d.name && !seen.has(d.name)) { seen.add(d.name); names.push(String(d.name)); }
  });
  Object.keys(roots).forEach((k) => walk(roots[k] && (roots[k].divisions || roots[k].children)));
  return names.slice(0, 400);
}
export function march(key, to) {
  const a = find(key);
  const dest = String(to || '').trim();
  if (!dest) throw new Error('未定目的地');
  const r = w.MarchSystem.orderMarch(a.id || a.name, dest);
  if (!(r && r.ok)) throw new Error((r && r.reason) || '军令未能成行');
  changed('army');
  return `军令已发：${a.name}移防${dest}（约${r.order && r.order.totalTurns ? num(r.order.totalTurns) : '若干'}回合）`;
}
// 易将：候选为在世将才（同朝优先、武略为序，内核所排），至多六十名
export function candidates(key) {
  const a = find(key);
  const f = fn('_tsLivingCommanderCandidates');
  return f ? f(a).slice(0, 60).map((c) => ({ name: c.name, mil: c.mil, intel: c.intel, faction: c.faction, title: c.title, same: !!c.sameFac })) : [];
}
// 拜将走内核 _tsConfirmAppoint（防死人、有军令交接则发令候回报）；它读 #ts_appoint_sel，确认后还会去开老军务面板——临时代填、临时按住
export function appoint(key, name) {
  const a = find(key);
  if (!fn('_tsConfirmAppoint')) throw new Error('内核缺 _tsConfirmAppoint');
  const sel = document.createElement('select');
  sel.id = 'ts_appoint_sel';
  sel.style.display = 'none';
  sel.append(new Option(name, name, true, true));
  document.body.append(sel);
  const legacyPanel = w.openMilitaryDetailPanel;
  w.openMilitaryDetailPanel = () => {};
  try {
    w._tsConfirmAppoint(a.name);
  } finally {
    w.openMilitaryDetailPanel = legacyPanel;
    sel.remove();
  }
  changed('army');
}
// 接战预勾：问我 → 必亲征 → 必委之 → 问我（存在军上，随档）
export function cycleStance(key) {
  const a = find(key);
  const cur = a._battleStance;
  a._battleStance = cur === 'always' ? 'delegate' : cur === 'delegate' ? undefined : 'always';
  changed('army');
  const name = String(a.name || key);
  return name + '·' + (a._battleStance === 'always' ? '若接战必御驾亲征（免临场请旨）' : a._battleStance === 'delegate' ? '若接战必委之偏裨（庙算决之）' : '若接战临场请旨（会战阶段弹窗）');
}
// 付廷议的议题（同右栏）
export const courtTopic = (key) => String(find(key).name || key) + ' 军务处置';
