#!/usr/bin/env node
// smoke-office-seat-claims.js — 开局按官衔认座的几条规矩（11-13）：
//   1. 旧衔与贬谪处分（「前某官」「某州安置」「责授」「除名」「某处居住」）不据以认座，也不进编制外名单；「前军统制」「贬知某州」照旧算现任。
//   2. 跨部不配：座位点了某部、官衔点了别的部就不配（「户部尚书」不坐礼部尚书）。
//   3. 南京诸衙门不是北京诸部：「南京兵部添设左侍郎」不坐兵部左侍郎。
//   4. 开局给空座找人（_offPickVacantSeatHolder，tm-patches-start.js 调用）带衙门名评分、取分最高者：
//      座名只写「左侍郎」时不再按官衔里有没有这三个字乱排；礼部右侍郎给官衔就是礼部右侍郎的人，不给阁臣的部衔。
//   5. 认座第二步同分时主衔先于兼衔/title 拆出的段。
//   6. 按制不除的座位不凭官衔模糊补人。
//   7. title 拆段不再剥「前」字：「前尚书右丞」不当现任；title 整串写告归、贬谪的，各段都不算；「（前……）」注语也算旧衔。
//   8. 官衔与座名按隔点分段比，不跨隔点凑字；官衔某段含座名头一段也算相合；括号注语、「假」「后」开头的段不算。
//   9. 分路不配：「大名府路安抚使」不坐福建路安抚使，「淮南东路」不坐淮南西路。
//  10. 树上已坐着的人，开局不再凭「title 含座名」被排进别的空座（殿中侍御史张浚不另占侍御史）。
//  11. 一人一官只占一员：开局把座名记成兼衔后，人物自己说这同一座的官衔不再另占一员；
//      「姓名未详一员」不翻成两员；剧本写明满员的座位不让只是模糊相似的人顶替。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); assertions++; }

const ctx = {
  console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN,
  window: null, P: {}, scriptData: {},
  GM: { turn: 1, playerFaction: '明朝廷', officeTree: [], chars: [] }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
load('tm-office-holder-state.js');
load('tm-office-runtime.js'); load('tm-office-runtime-summary-appoint.js');
load('tm-office-system.js');

function seatsOf(name) {
  const out = [];
  (function walk(ns) { (ns || []).forEach((n) => {
    (n.positions || []).forEach((p) => {
      const named = (Array.isArray(p.actualHolders) ? p.actualHolders : []).filter((h) => h && h.name && h.generated !== false).map((h) => h.name);
      if (named.indexOf(name) >= 0 || p.holder === name) out.push((n._offDynamic ? '[编制外]' : '') + n.name + '/' + p.name);
    });
    walk(n.subs);
  }); })(ctx.GM.officeTree);
  return out;
}
function holderOf(deptName, posName) {
  let r = null;
  (function walk(ns) { (ns || []).forEach((n) => {
    if (n.name === deptName) (n.positions || []).forEach((p) => { if (p.name === posName) r = p.holder || ''; });
    walk(n.subs);
  }); })(ctx.GM.officeTree);
  return r;
}
function seat(name, holder) {
  return { name, holder: holder || '', establishedCount: 1, vacancyCount: holder ? 0 : 1 };
}
// 照 tm-patches-start.js「官制任职者自动匹配」：先收树上已坐名单；有人的座把座名记进在任者官衔（已有官衔的记作兼衔）；
//   空座里未考定、按制不除的不补，其余交 _offPickVacantSeatHolder（带已坐名单）
function holdersOf(pos) {
  let hs = [];
  try { hs = ctx._offAllHolders(pos) || []; } catch (_) { hs = []; }
  if (!hs.length && pos.holder) hs = [pos.holder];
  return hs.filter(Boolean);
}
function prestep() {
  const seated = Object.create(null);
  (function collect(ns) { (ns || []).forEach((d) => { (d.positions || []).forEach((p) => holdersOf(p).forEach((h) => { seated[h] = true; })); collect(d.subs); }); })(ctx.GM.officeTree);
  (function walk(ns) { (ns || []).forEach((dept) => {
    (dept.positions || []).forEach((pos) => {
      const hs = holdersOf(pos);
      if (hs.length) {
        hs.forEach((hn, idx) => {
          const ch = ctx.GM.chars.find((c) => c.name === hn && c.alive !== false);
          if (ch) ctx._offAddCharOfficeTitle(ch, pos.name, { concurrent: idx > 0 || !!ch.officialTitle });
        });
        return;
      }
      if (pos.occupancyStatus === 'unrecorded' || pos.vacantByRule) return;
      const m = ctx._offPickVacantSeatHolder(ctx.GM.chars, dept.name || '', pos.name, { seated });
      if (m) { pos.holder = m.name; seated[m.name] = true; if (!m.officialTitle) m.officialTitle = pos.name; }
    });
    walk(dept.subs);
  }); })(ctx.GM.officeTree);
}
function posOf(deptName, posName) {
  let r = null;
  (function walk(ns) { (ns || []).forEach((n) => {
    if (n.name === deptName) (n.positions || []).forEach((p) => { if (p.name === posName) r = p; });
    walk(n.subs);
  }); })(ctx.GM.officeTree);
  return r;
}
function ming() {
  return [
    { name: '毛一鹭', faction: '明朝廷', officialTitle: '前南京兵部左侍郎', title: '前南京兵部左侍郎' },
    { name: '李国普', faction: '明朝廷', officialTitle: '东阁大学士', title: '东阁大学士·礼部右侍郎' },
    { name: '阎鸣泰', faction: '明朝廷', officialTitle: '兵部侍郎·原辽东经略', title: '辽东经略(前任)·兵部侍郎' },
    { name: '潘汝桢', faction: '明朝廷', officialTitle: '南京兵部添设左侍郎', title: '南京兵部添设左侍郎' },
    { name: '李标', faction: '明朝廷', officialTitle: '礼部右侍郎', title: '礼部右侍郎' }
  ];
}

// ── 1. 旧衔与贬谪处分 ──
const former = ctx._offIsFormerTitle;
assert(typeof former === 'function', '应有 _offIsFormerTitle');
['前南京兵部左侍郎', '前尚书右丞（建炎七月罢）', '前尚书左丞·建炎初贬·南方安置', '责授昭化军节度副使·潭州安置',
  '（伪楚故相·除名·高州安置）', '落职·筠州居住', '前尚书右丞·罢闲'].forEach((t) => assert(former(t), '「' + t + '」应算旧衔/贬谪'));
['前军统制', '前锋都统', '贬知单州', '户部尚书', '东阁大学士·礼部右侍郎'].forEach((t) => assert(!former(t), '「' + t + '」应算现任'));

// ── 2/3. 评分：跨部、南京 ──
const S = ctx._offTitleSlotScore;
assert(S('户部侍郎', '礼部', '礼部侍郎', false) === 0, '户部侍郎不配礼部侍郎');
assert(S('户部尚书', '兵部', '兵部尚书', false) === 0, '户部尚书不配兵部尚书');
assert(S('南京兵部添设左侍郎', '兵部', '左侍郎', false) === 0, '南京兵部添设左侍郎不配兵部左侍郎');
assert(S('南京户部尚书', '户部', '户部尚书', false) === 0, '南京户部尚书不配户部尚书');
assert(S('兵部尚书', '南京兵部', '尚书', false) === 0, '兵部尚书不配南京兵部尚书');
assert(S('南京兵部尚书', '南京兵部', '尚书', false) >= 40, '南京兵部尚书配南京兵部尚书');
assert(S('兵部侍郎·原辽东经略', '兵部', '左侍郎', false) >= 40, '同部的兵部侍郎仍可配兵部左侍郎');
assert(S('礼部尚书兼东阁大学士', '内阁', '东阁大学士', false) >= 40, '座位不点部的内阁大学士仍可由带部衔的官衔认座');

// ── 4. 开局给空座找人 ──
const pick = ctx._offPickVacantSeatHolder;
assert(typeof pick === 'function', '应有 _offPickVacantSeatHolder');
let cs = ming();
assert(pick(cs, '吏部', '左侍郎') === null, '吏部左侍郎不该排南京兵部或旧衔的人');
assert(pick(cs, '户部', '左侍郎') === null, '户部左侍郎不该排南京兵部的人');
assert(pick(cs, '兵部', '左侍郎') === null, '兵部左侍郎不由预处理排南京兵部的人（留给认座按分排）');
assert(pick(cs, '吏部', '右侍郎') === null, '吏部右侍郎不该排礼部右侍郎的人');
assert(pick(cs, '礼部', '右侍郎') && pick(cs, '礼部', '右侍郎').name === '李标', '礼部右侍郎给官衔就是它的李标，不给阁臣部衔');
cs = [{ name: '甲', title: '尚书右丞·兼权门下侍郎' }, { name: '乙', officialTitle: '尚书右丞', title: '' }];
assert(pick(cs, '尚书省', '尚书右丞').name === '乙', 'officialTitle 恰是座名者最优先');
assert(pick([{ name: '丙', title: '前尚书右丞（建炎七月罢）' }], '尚书省', '尚书右丞') === null, '旧衔不排');
assert(pick([{ name: '丁', title: '尚书右丞', alive: false }], '尚书省', '尚书右丞') === null, '死人不排');
const startSrc = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');
assert(/_offPickVacantSeatHolder\(GM\.chars, dept\.name \|\| '', posName, \{ seated: _seatedNames \}\)/.test(startSrc), '开局预处理应交 _offPickVacantSeatHolder 挑人并带已坐名单');
assert(/_seatedNames\[matched\.name\] = true/.test(startSrc), '开局预处理补了空座的人也记进已坐名单');

// ── 整条开局：预处理 + 认座 ──
ctx.GM.playerFaction = '明朝廷';
ctx.GM.officeTree = [
  { name: '内阁', positions: [seat('东阁大学士', '李国普')], subs: [] },
  { name: '吏部', positions: [seat('左侍郎'), seat('右侍郎')], subs: [] },
  { name: '户部', positions: [seat('左侍郎')], subs: [] },
  { name: '礼部', positions: [seat('右侍郎')], subs: [] },
  { name: '兵部', positions: [seat('左侍郎')], subs: [] }
];
ctx.GM.chars = ming();
prestep();
ctx._offSyncHoldersFromChars({ importSeats: true, force: true });
assert(holderOf('礼部', '右侍郎') === '李标', '礼部右侍郎=李标·实际:' + holderOf('礼部', '右侍郎'));
assert(holderOf('兵部', '左侍郎') === '阎鸣泰', '兵部左侍郎=阎鸣泰·实际:' + holderOf('兵部', '左侍郎'));
assert(!holderOf('吏部', '左侍郎') && !holderOf('吏部', '右侍郎') && !holderOf('户部', '左侍郎'), '吏部两侍郎、户部左侍郎出缺');
assert(seatsOf('李国普').join() === '内阁/东阁大学士', '李国普只坐东阁大学士·实际:' + seatsOf('李国普').join());
assert(seatsOf('毛一鹭').length === 0, '毛一鹭（前南京兵部左侍郎）不进官制·实际:' + seatsOf('毛一鹭').join());
const pan = seatsOf('潘汝桢');
assert(pan.length === 1 && /^\[编制外\].*\/南京兵部添设左侍郎$/.test(pan[0]), '潘汝桢只列编制外·南京兵部添设左侍郎·实际:' + pan.join());

// ── 1. 旧衔、贬谪不进官制（含编制外） ──
ctx.GM.playerFaction = '大宋';
ctx.GM.officeTree = [
  { name: '尚书省', positions: [seat('尚书左丞'), seat('尚书右丞')], subs: [] },
  { name: '礼部', positions: [seat('礼部尚书')], subs: [] },
  { name: '户部', positions: [seat('户部尚书', '黄潜厚'), Object.assign(seat('户部侍郎'), { vacantByRule: true })], subs: [] }
];
ctx.GM.chars = [
  { name: '耿南仲', faction: '大宋', officialTitle: '前尚书左丞·建炎初贬·南方安置', title: '前钦宗朝主和宰相·建炎初被贬' },
  { name: '吕好问', faction: '大宋', officialTitle: '前尚书右丞·罢闲', title: '前尚书右丞（建炎七月罢）' },
  { name: '张邦昌', faction: '大宋', officialTitle: '责授昭化军节度副使·潭州安置', title: '' },
  { name: '张悫', faction: '大宋', officialTitle: '户部尚书', title: '' },
  { name: '黄潜厚', faction: '大宋', officialTitle: '户部尚书', title: '' },
  { name: '李擢', faction: '大宋', officialTitle: '户部侍郎', title: '' }
];
prestep();
ctx._offSyncHoldersFromChars({ importSeats: true, force: true });
assert(!holderOf('尚书省', '尚书左丞'), '耿南仲（前尚书左丞·南方安置）不坐尚书左丞·实际:' + holderOf('尚书省', '尚书左丞'));
assert(!holderOf('尚书省', '尚书右丞'), '吕好问（前尚书右丞）不坐尚书右丞·实际:' + holderOf('尚书省', '尚书右丞'));
['耿南仲', '吕好问', '张邦昌'].forEach((n) => assert(seatsOf(n).length === 0, n + ' 不进官制与编制外·实际:' + seatsOf(n).join()));
// ── 2. 跨部：户部尚书不坐礼部尚书 ──
assert(!holderOf('礼部', '礼部尚书'), '礼部尚书不由户部尚书张悫坐·实际:' + holderOf('礼部', '礼部尚书'));
assert(holderOf('户部', '户部尚书') === '黄潜厚', '户部尚书仍是树上写的黄潜厚');
// ── 6. 按制不除：户部侍郎不凭官衔补人 ──
assert(!holderOf('户部', '户部侍郎'), '按制不除的户部侍郎不补李擢·实际:' + holderOf('户部', '户部侍郎'));
assert(seatsOf('李擢').length === 1 && seatsOf('李擢')[0].indexOf('[编制外]') === 0, '李擢列编制外·实际:' + seatsOf('李擢').join());

// ── 5. 认座第二步同分：主衔先于 title 拆出的段（不经预处理，人物先后不利于主衔者） ──
ctx.GM.playerFaction = '明朝廷';
ctx.GM.officeTree = [{ name: '礼部', positions: [seat('右侍郎')], subs: [] }];
ctx.GM.chars = [
  { name: '李国普', faction: '明朝廷', officialTitle: '东阁大学士', title: '东阁大学士·礼部右侍郎' },
  { name: '李标', faction: '明朝廷', officialTitle: '礼部右侍郎', title: '礼部右侍郎' }
];
ctx._offSyncHoldersFromChars({ force: true });
assert(holderOf('礼部', '右侍郎') === '李标', '同分时主衔者李标先坐·实际:' + holderOf('礼部', '右侍郎'));

// ── 7. title 拆段与旧衔 ──
const T = (c) => ctx._offGetCharOfficeTitles(c);
assert(T({ officialTitle: '资政殿学士·提举洞霄宫', title: '前尚书右丞' }).join('|') === '资政殿学士·提举洞霄宫', 'title「前尚书右丞」不剥前字当现任·实际:' + T({ officialTitle: '资政殿学士·提举洞霄宫', title: '前尚书右丞' }).join('|'));
assert(T({ officialTitle: '', title: '翰林侍读学士·告归' }).length === 0, 'title 整串写告归，各段都不算现任');
assert(T({ officialTitle: '责授单州团练副使·南雄州安置', title: '前门下侍郎·建炎初被贬' }).join('|').indexOf('侍郎') < 0, 'title「前门下侍郎·建炎初被贬」不出门下侍郎诉求');
assert(T({ officialTitle: '礼部尚书', title: '礼部尚书·前东阁大学士' }).indexOf('前东阁大学士') < 0, 'title 里单一段写旧衔（「前东阁大学士」）也不收');
assert(T({ officialTitle: '知州', title: '前军都督府都督' }).indexOf('前军都督府都督') >= 0, '「前军都督府都督」的前是军号，照原样留');
assert(former('（前入内内侍省·都知·靖康后游离）'), '括号里的「前……」注语也算旧衔');

// ── 8. 分段比对 ──
assert(S('资政殿学士·知宣州', '翰林学士院 (内制)', '翰林学士·知制诰', false) < 40, '隔点两边不跨着凑字：资政殿学士·知宣州不配翰林学士·知制诰');
assert(S('枢密院编修官·破格起用', '枢密院', '编修官·计议官', false) >= 76, '官衔一段含座名头一段：枢密院编修官配编修官·计议官');
assert(S('太常少卿·假给事中·大金通问使', '门下省 (封驳·审读)', '给事中 (掌封驳)', false) < 40, '「假给事中」不是给事中');
assert(S('（建炎初尚未授官·后破格起用为枢密院编修官）', '枢密院', '编修官·计议官', false) < 40, '括号注语不认座');
assert(S('起居郎·后参政', '政事堂', '参知政事 (执政)', false) < 40, '「后……」写的是日后，不认座');

// ── 9. 分路 ──
assert(S('大名府路安抚使·知大名府', '诸路帅司', '福建路安抚使', false) === 0, '大名府路不配福建路');
assert(S('淮南东路安抚使·知扬州', '诸路帅司', '淮南西路安抚使', false) === 0, '淮南东路不配淮南西路');
assert(S('淮南东路安抚使·知扬州', '诸路帅司', '淮南东路安抚使', false) >= 86, '同路照配');

// ── 10. 空座挑人：已坐者不凭 title 含座名另占 ──
cs = [{ name: '张浚', officialTitle: '殿中侍御史', title: '殿中侍御史' }];
assert(pick(cs, '御史台', '侍御史') && pick(cs, '御史台', '侍御史').name === '张浚', '（对照）不给已坐名单时「殿中侍御史」含「侍御史」会被挑上');
assert(pick(cs, '御史台', '侍御史', { seated: { 张浚: true } }) === null, '已坐殿中侍御史的张浚不再被挑进侍御史');
assert(pick([{ name: '乙', officialTitle: '侍御史' }], '御史台', '侍御史', { seated: { 乙: true } }).name === '乙', '官衔恰是座名的照旧');

// ── 11. 整条开局：一人一官只占一员、匿名员额不翻倍、满员座不被模糊顶替、分路、注语 ──
ctx.GM.playerFaction = '大宋';
const anonSeat = (name, est, anon) => ({ name, holder: '', establishedCount: est, vacancyCount: est - anon, unrecordedCount: anon });
ctx.GM.officeTree = [
  { name: '政事堂', positions: [{ name: '中书舍人 (掌外制)', holder: '刘珏', additionalHolders: ['汪藻'], establishedCount: 4, vacancyCount: 2 }], subs: [] },
  { name: '门下省', positions: [anonSeat('给事中 (掌封驳)', 4, 1)], subs: [] },
  { name: '御史台', positions: [anonSeat('侍御史', 2, 1), { name: '殿中侍御史', holder: '张浚', occupancyStatus: 'unrecorded', establishedCount: 2, vacancyCount: 0 }], subs: [] },
  { name: '入内内侍省·内侍省 (内廷宦寺)', positions: [{ name: '入内内侍省副都知·押班', holder: '蓝珪', establishedCount: 3, vacancyCount: 0 }], subs: [] },
  { name: '诸路帅司', positions: [seat('福建路安抚使')], subs: [] }
];
ctx.GM.chars = [
  { name: '刘珏', faction: '大宋', officialTitle: '中书舍人' },
  { name: '汪藻', faction: '大宋', officialTitle: '中书舍人' },
  { name: '张浚', faction: '大宋', officialTitle: '殿中侍御史', title: '殿中侍御史' },
  { name: '蓝珪', faction: '大宋', officialTitle: '入内内侍省·押班·赵构亲信内侍', title: '入内内侍省·押班' },
  { name: '张去为', faction: '大宋', officialTitle: '入内内侍·近习' },
  { name: '杜充', faction: '大宋', officialTitle: '大名府路安抚使·知大名府' },
  { name: '黄经臣', faction: '大宋', officialTitle: '（前入内内侍省·都知·靖康后游离）' }
];
prestep();
ctx._offSyncHoldersFromChars({ importSeats: true, force: true });
const HS = ctx.TM.OfficeHolderState;
const cnt = (d, p) => HS.read(ctx.GM, posOf(d, p)).actualCount;
assert(cnt('政事堂', '中书舍人 (掌外制)') === 2, '中书舍人刘珏、汪藻各占一员，不因自己官衔另占·实际:' + cnt('政事堂', '中书舍人 (掌外制)'));
assert(cnt('门下省', '给事中 (掌封驳)') === 1, '给事中姓名未详一员不翻成两员·实际:' + cnt('门下省', '给事中 (掌封驳)'));
assert(cnt('御史台', '侍御史') === 1 && !holderOf('御史台', '侍御史'), '侍御史只算姓名未详一员，张浚不另占·实际:' + cnt('御史台', '侍御史') + '/' + holderOf('御史台', '侍御史'));
assert(seatsOf('张浚').join() === '御史台/殿中侍御史', '张浚只坐殿中侍御史·实际:' + seatsOf('张浚').join());
assert(cnt('入内内侍省·内侍省 (内廷宦寺)', '入内内侍省副都知·押班') === 3 && seatsOf('张去为').every((s) => s.indexOf('[编制外]') === 0), '满员的副都知·押班不让「入内内侍·近习」模糊顶替·实际:' + seatsOf('张去为').join());
assert(!holderOf('诸路帅司', '福建路安抚使'), '大名府路安抚使不坐福建路安抚使·实际:' + holderOf('诸路帅司', '福建路安抚使'));
assert(seatsOf('黄经臣').length === 0, '（前……）注语算旧衔，不进官制与编制外·实际:' + seatsOf('黄经臣').join());

console.log('[smoke-office-seat-claims] ok · ' + assertions + ' assertions');
