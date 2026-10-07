// 文苑：GM.culturalWorks 诗文总集。字段与名目照老文苑页（tm-player-core.js renderWenyuan / _showWorkDetail）与推演写口
// （tm-endturn-apply.js 文事作品一段、tm-endturn-ai.js cultural_works 的字段表）。作品有三种来路：
//   · 推演所作：有正文、体裁、缘起、品第、政险、创作背景……；
//   · 剧本预置典籍（_scenarioPreset）：只有 type（门类）、year、status（刊行／稿本）、desc 提要、note；
//   · 后妃之作（authorIsSpouse）：先记体裁与动机，题名正文待下回合推演补（_pendingAIComplete）。
// 动作（赏析、题序、追和、传抄、查禁、解禁）走内核 _workAction（写议事清册并记玩家动作信号），与老文苑同一写口；
// 已拟未颁的同类动作，从议事清册里认出来，免得重复拟。
import { suggest } from './edict.js';

const w = window;
const G = () => w.GM || {};
const n0 = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const str = (v) => (v == null ? '' : String(v).trim());

export const GENRES = { shi: '诗', ci: '词', fu: '赋', qu: '曲', ge: '歌行', wen: '散文', apply: '应用文', ji: '记叙', ritual: '祭碑', paratext: '序跋' };
const VERSE = new Set(['shi', 'ci', 'qu', 'ge', '诗', '词', '曲', '小令', '歌行']);
export const CATS = [
  ['career', '科举宦途'], ['adversity', '逆境贬谪'], ['social', '社交酬酢'], ['duty', '任上施政'],
  ['travel', '游历山水'], ['private', '家事私情'], ['times', '时局天下'], ['mood', '情感心境'], ['preset', '典籍']
];
const CAT_NAME = Object.fromEntries(CATS);
const MOTIVE = { spontaneous: '自发', commissioned: '受命', flattery: '干谒', response: '酬答', mourning: '哀悼', critique: '讽谕', celebration: '颂扬',
  farewell: '送别', memorial: '纪念', ghostwrite: '代笔', duty: '应制', self_express: '自抒' };
const TRIGGER = { seeking_official: '干谒', pass_exam: '登科', demoted_exile: '被贬', mourning_parent: '丁忧', farewell_friend: '送别', banquet: '宴饮',
  imperial_order: '应制', visit_temple: '访寺', travel_scenery: '游山', war_outing: '出征', disaster_famine: '灾荒', casual_mood: '闲情' };
const STAGE = { early_seeking: '求仕之初', young_official: '初入仕途', mid_career: '宦途中年', exiled: '谪居', mourning: '居丧', retired: '致仕', elder: '晚岁' };
const ELEGANCE = { refined: '雅', vernacular: '俗', mixed: '雅俗兼融' };
export const RISK = { low: '平和', medium: '有议论', high: '争议甚广' };
export const ACTS = ['appreciate', 'inscribe', 'echo', 'circulate', 'ban', 'unban'];

const bare = (t) => str(t).replace(/[《》]/g, '');
const titled = (t) => (/《/.test(t) ? t : `《${t}》`);
const charByName = (n) => (G().chars || []).find((c) => c && c.name === n) || null;
export const known = (n) => !!charByName(n);
// 作者栏常是「利玛窦/徐光启」「冯梦龙/凌濛初」「解缙等」
const splitNames = (s) => str(s).replace(/等$/, '').split(/[/、，,]/).map((x) => x.trim()).filter(Boolean);

// 议事清册里已拟、未颁的文事动作（写法同内核 _workAction）
function pendingOf(title) {
  const t = bare(title);
  if (!t) return new Set();
  const out = new Set();
  for (const s of G()._edictSuggestions || []) {
    if (!s || s.used || s.source !== '文事') continue;
    const c = str(s.content);
    if (!c.replace(/[《》]/g, '').includes(t)) continue;
    if (/^赐阅 /.test(c)) out.add('appreciate');
    else if (/^御题 /.test(c)) out.add('inscribe');
    else if (/追和《/.test(c)) out.add('echo');
    else if (/缮写副本/.test(c)) out.add('circulate');
    else if (/^查禁 /.test(c)) out.add('ban');
    else if (/^解禁 /.test(c)) out.add('unban');
  }
  return out;
}

function shape(x, idx) {
  const preset = !!x._scenarioPreset || (!x.content && !x.genre && (x.type || x.desc));
  const g = str(x.genre);
  const genre = GENRES[g] || g || (preset ? str(x.type) : '');
  const cat = preset ? 'preset' : CAT_NAME[x.triggerCategory] ? x.triggerCategory : 'mood';
  const content = str(x.content || x.preview);
  const title = str(x.title) || (x.authorIsSpouse ? `无题（${genre || '诗'}）` : '无题');
  const authors = splitNames(x.author);
  const date = str(x.date) || str(x.year) || str(x.era) || '';
  const quality = n0(x.quality, 0);
  const risk = RISK[x.politicalRisk] ? x.politicalRisk : 'low';
  const motive = MOTIVE[x.motivation] || str(x.motive || x.motivation);
  return {
    id: str(x.id) || `wy-${idx}`, idx, preset, consort: !!x.authorIsSpouse, waiting: !!x._pendingAIComplete && !content,
    title, author: str(x.author) || '无名', authors, known: authors.filter((n) => charByName(n)),
    genre, genreKey: g, verse: VERSE.has(g) || VERSE.has(genre), subtype: str(x.subtype),
    cat, catLabel: CAT_NAME[cat], trigger: TRIGGER[x.trigger] || (x.trigger && !/_/.test(x.trigger) ? str(x.trigger) : ''),
    motive: motive === '自发' ? '' : motive, stage: STAGE[x.lifeStage] || '', elegance: ELEGANCE[x.elegance] || str(x.elegance),
    mood: str(x.mood), theme: str(x.theme), location: str(x.location), date, turn: x.turn == null ? null : n0(x.turn),
    content, desc: str(x.desc), status: str(x.status), note: str(x.note), context: str(x.narrativeContext), circulation: str(x.circulation),
    quality, rated: quality > 0, risk, implication: str(x.politicalImplication), praise: str(x.praiseTarget), satire: str(x.satireTarget),
    dedicated: (Array.isArray(x.dedicatedTo) ? x.dedicatedTo : []).map(str).filter(Boolean), commissioned: str(x.commissionedBy), inspiredBy: str(x.inspiredBy),
    appreciated: (Array.isArray(x.appreciatedBy) ? x.appreciatedBy : []).map((v) => (typeof v === 'object' ? str(v && (v.name || v.by)) : str(v))).filter(Boolean),
    preserved: !!(x.isPreserved || x.preserved || x.status === '传世'), forbidden: !!x.isForbidden,
    pending: pendingOf(x.title),
    needle: [x.author, x.title, x.content, x.preview, x.desc, x.trigger, x.location, x.theme, x.subtype, x.type].map(str).join('\n')
  };
}

// 全集：推演所作在前（新者先），典籍随后
export function works() {
  const list = (Array.isArray(G().culturalWorks) ? G().culturalWorks : []).map((x, i) => (x && typeof x === 'object' ? shape(x, i) : null)).filter(Boolean);
  for (const x of list) x.echoes = list.filter((y) => y.inspiredBy && (y.inspiredBy === x.id || bare(y.inspiredBy) === bare(x.title))).map((y) => y.id);
  return list;
}

export function stats(list = works()) {
  const turn = n0(G().turn, 1);
  return {
    all: list.length,
    preserved: list.filter((x) => x.preserved).length,
    forbidden: list.filter((x) => x.forbidden).length,
    risky: list.filter((x) => x.risk === 'high' || x.risk === 'medium').length,
    recent: list.filter((x) => !x.preset && x.turn != null && x.turn >= turn - 8).length,
    authors: new Set(list.flatMap((x) => x.authors)).size,
    lost: (G()._forgottenWorks || []).length
  };
}

// 拟一项文事动作入议事清册
export function act(id, action) {
  if (!ACTS.includes(action)) throw new Error('无此动作');
  const list = G().culturalWorks || [];
  const x = works().find((y) => y.id === id);
  if (!x || !list[x.idx]) throw new Error('作品已不在文苑');
  const before = (G()._edictSuggestions || []).length;
  if (typeof w._workAction === 'function') {
    w._workAction(x.idx, action);
  } else {
    const t = `${x.author}${titled(x.title)}`;
    const text = { appreciate: `赐阅 ${t}，表嘉赏之意`, inscribe: `御题 ${t}——亲笔题跋或作序，准其刊行`, echo: `命朝中文臣追和${titled(x.title)}——再作一篇次韵酬答`,
      circulate: `将 ${t}缮写副本，传抄流布`, ban: `查禁 ${t}——不宜流布`, unban: `解禁 ${t}——准其重新流布，刊本发还` }[action];
    suggest('文事', '御前', x.title, text);
  }
  // 典籍题名自带书名号（如「《几何原本》前六卷」），内核又套一层：还原成题名本来的样子
  const s = (G()._edictSuggestions || [])[before];
  const raw = str(list[x.idx].title);
  if (s && typeof s.content === 'string' && /《/.test(raw)) s.content = s.content.split(`《${raw}》`).join(raw);
  return (G()._edictSuggestions || []).length > before;
}
