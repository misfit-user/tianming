// 朝野：势力、党派、阶层。本文件先接势力——内容照老舆图「势力谱牒」（phase8-formal-map-dossier.js renderFactionBookNow）
// 的六卷：君臣、版图、军略、财计、邦交、史略。数值与字段转写借老舆图共用的 ppValue / fieldLabel / mapNum
// （TMPhase8FormalBridge.__p8MapParts），标签与老卷一致；总兵、人物、领地取内核势力索引 GM._facIndex。
// 不显给玩家的：AI 推演用的画像、决策提示、禁忌动作、暗中议程、首领私心（aiProfile / decisionHints / npcDecisionHints /
// tabooMoves / hiddenAgenda / leaderPrivate）——老卷照列，新界面不列；胜局、败局只列本朝。
// 版图卷按省道收拢、本方区划预警，取数在 adapter/fangzhi.js（bantu）。
import { bantu as bantuOf } from './fangzhi.js';

const w = window;
const G = () => w.GM || {};
const parts = () => (w.TMPhase8FormalBridge && w.TMPhase8FormalBridge.__p8MapParts) || {};
const has = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const first = (...vs) => vs.find(has);
function pp(v) {
  const f = parts().ppValue;
  if (f) { const s = f(v, ''); return s === '未记' ? '' : String(s || ''); }
  if (!has(v)) return '';
  if (typeof v === 'number') return mapNum(v);
  if (Array.isArray(v)) return v.map(pp).filter(Boolean).join('、');
  if (typeof v === 'object') return Object.keys(v).slice(0, 6).map((k) => `${label(k)}：${pp(v[k])}`).join(' / ');
  return String(v).trim();
}
const label = (k) => (parts().fieldLabel ? parts().fieldLabel(k) : k);
function mapNum(v) {
  const f = parts().mapNum;
  if (f) return String(f(v));
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const a = Math.abs(n);
  return a >= 1e8 ? `${(n / 1e8).toFixed(2)}亿` : a >= 1e4 ? `${(n / 1e4).toFixed(1).replace(/\.0$/, '')}万` : String(Math.round(n));
}
const ENUM_CN = { heavy_from_land: '重赋于田', light_touch: '轻徭薄赋', restricted: '有禁', open: '开放', silver_standard: '银本位', gold_silver: '金银并行', coin_standard: '钱法', barter: '以物易物',
  primogeniture: '嫡长承袭', election: '推举', tanistry: '幼子守灶', merit: '择贤', declining: '渐衰', rising: '方兴', stable: '安稳', tribute_conquest: '贡赋掳掠',
  corvee: '力役', imperial: '宗室', noble: '勋贵', gentry: '士绅', commoner: '庶民' };
const enumText = (v) => { const s = pp(v); return /[a-z_]/i.test(s) ? s.split('·').map((seg) => ENUM_CN[seg.trim()] || seg).join('·') : s; };
const LEAD_LABEL = { ruler: '君主', regent: '摄政', general: '主将', chancellor: '宰辅', spy: '耳目', heir: '继嗣' };
const MB_LABEL = { elite: '精锐', standingArmy: '常备', militia: '民兵', fleet: '水师' };

// 打分的对象（凝聚、族裔、经济结构、舆情、技术）→ 签
const chips = (obj, warnBelow = 0) => (obj && typeof obj === 'object' && !Array.isArray(obj)
  ? Object.keys(obj).filter((k) => Number.isFinite(Number(obj[k]))).map((k) => ({ label: label(k), value: mapNum(obj[k]), warn: Number(obj[k]) < warnBelow })) : null);
const row = (k, v, tone) => (has(v) && pp(v) ? { k, v: pp(v), tone } : null);
// 已知耳目：剧本以代号记安插之处（in_ming、in_dutch_formosa……），逐段译成地名；不识的段照原样
const SPY_WORD = { ming: '明廷', liaodong: '辽东', manchu: '后金', mongol: '蒙古', pirate: '海寇', japan: '日本', moro: '摩洛',
  dutch: '荷兰', formosa: '台湾', spain: '西班牙', manila: '马尼拉', portugal: '葡萄牙', macao: '澳门',
  fujian: '福建', sichuan: '四川', guizhou: '贵州', bozhou: '播州', remnant: '余部' };
function spyPlace(k) {
  const m = /^in_(.+)$/.exec(String(k));
  if (!m) return label(k);
  return '在' + m[1].split('_').map((x) => SPY_WORD[x] || x).join('');
}
// 盟约：GM.treaties 里有此势力一方者。内核三处写入，字段不一：
//   TreatySystem.createTreaty —— typeName、parties[{id,name}]、startTurn、expiryTurn（0=永久）、active；
//   议约签成（tm-faction-diplomacy）—— 在上者之上再添 from/to、fromId/toId、status；
//   势力自行结约（tm-faction-action-engine）—— title、from/to（名）、turn、expiresTurn、status
const TREATY_STATUS = { broken: '已毁', expired: '已满期', ended: '已止', dissolved: '已解' };
const PROPOSAL_TYPE = { alliance: '结盟', nonaggression: '互不侵犯', joint_action: '联手', peace: '媾和', truce: '停战', deal: '交易', ultimatum: '最后通牒' };
function treatyRow(f) {
  const facs = Array.isArray(G().facs) ? G().facs : [];
  const nameOf = (v) => {
    if (v && typeof v === 'object') return String(v.name || v.faction || nameOf(v.id));
    const x = facs.find((y) => y && (y.id === v || y.name === v));
    return x ? x.name : String(v || '');
  };
  const sides = (t) => (Array.isArray(t.parties) && t.parties.length ? t.parties : [t.from || t.fromId, t.to || t.toId]).map(nameOf).filter(Boolean);
  const rows = (Array.isArray(G().treaties) ? G().treaties : []).filter((t) => t && sides(t).includes(f.name)).map((t) => {
    const other = sides(t).filter((x) => x !== f.name).join('、');
    const start = t.startTurn || t.turn;
    const end = t.expiryTurn || t.expiresTurn;
    const live = t.active !== false && !TREATY_STATUS[t.status] && (!end || G().turn < end);
    const name = t.title || t.typeName || PROPOSAL_TYPE[t.type] || t.type || '条约';
    return `${name}·与${other || '某方'}${start ? `·第${start}回合起` : ''}${end ? `·至第${end}回合` : '·不限期'}${live ? '' : `（${TREATY_STATUS[t.status] || '已止'}）`}`;
  });
  return rows.length ? { k: '盟约', v: rows.slice(-8).join('\n') } : null;
}
// 议约：诸势力 _incomingProposals 里此势力为一方者（FactionDiplomacy：type、status、version；同一提案可能抄在两家，按 id 去重）
const PROPOSAL_STATUS = { draft: '草拟', in_transit: '使者在途', pending: '在议', accepted: '已成', rejected: '被拒', cancelled: '撤回', lapsed: '作废' };
function proposalRow(f) {
  const facs = Array.isArray(G().facs) ? G().facs : [];
  const nameOf = (id) => { const x = facs.find((y) => y && (y.id === id || y.name === id)); return x ? x.name : String(id || ''); };
  const seen = new Set();
  const rows = [];
  for (const fx of facs) for (const p of (fx && fx._incomingProposals) || []) {
    if (!p || p.proposalRef || seen.has(p.id)) continue;
    const from = p.from || nameOf(p.fromId);
    const to = p.to || nameOf(p.toId);
    if (from !== f.name && to !== f.name) continue;
    if (p.id) seen.add(p.id);
    rows.push(`${from}→${to}·${PROPOSAL_TYPE[p.type] || p.type || '议'}·${PROPOSAL_STATUS[p.status] || '在议'}${p.version > 1 ? `·第${p.version}稿` : ''}`);
  }
  return rows.length ? { k: '议约', v: rows.slice(-8).join('\n') } : null;
}
function person(title, p, main) {
  if (!has(p)) return null;
  const obj = p && typeof p === 'object';
  let name = obj ? first(p.name, p.ruler, p.general, p.chancellor) : p;
  if (obj && !has(name)) { if (!has(p.bio)) return null; name = '（虚位）'; }
  const meta = obj ? [p.title, p.role, p.age ? `${pp(p.age)} 岁` : '', p.personality].filter(has).map(pp).join(' / ') : '';
  return { title, name: pp(name), meta, bio: obj && has(p.bio) ? pp(p.bio) : '', main: !!main };
}

function facIndex(f) {
  const idx = G()._facIndex || {};
  return idx[f.name] || idx[f.id] || null;
}
const isMine = (f) => !!(f.isPlayer || (G().playerFaction && f.name === G().playerFaction) || (w.P && w.P.playerInfo && w.P.playerInfo.factionName === f.name));
function attitudeOf(f) {
  const a = f.attitude && typeof f.attitude === 'object' ? f.attitude.self : f.attitude;
  return pp(first(a, f.playerRelation));
}

export function factions() {
  return (G().facs || []).filter((f) => f && f.name).map((f) => {
    const ix = facIndex(f);
    const m = (ix && ix.metrics) || {};
    return { key: String(f.id || f.name), name: String(f.name), type: pp(first(f.type, f.factionType)), leader: pp(first(f.leader, f.leaderName, f.ruler)).split(/[（(]/)[0].trim(),
      strength: Math.round(Number(f.strength) || 0), soldiers: m.armyCount > 0 ? Number(m.totalSoldiers) || 0 : Number(f.militaryStrength) || 0,
      attitude: attitudeOf(f), hostile: /敌/.test(attitudeOf(f)), mine: isMine(f), collapsing: !!f._collapsing };
  }).sort((a, b) => (b.mine - a.mine) || (b.strength - a.strength));
}

export function faction(key) {
  const f = (G().facs || []).find((x) => x && (String(x.id || x.name) === key || x.name === key));
  if (!f) throw new Error('此势力已不在');
  const ix = facIndex(f);
  const m = (ix && ix.metrics) || {};
  const mine = isMine(f);
  const provinces = (ix && Array.isArray(ix.provinces) ? ix.provinces : []).map((p) => (typeof p === 'object' ? pp(first(p.name, p.title, p.id)) : String(p))).filter(Boolean);
  const troops = m.armyCount > 0 ? Number(m.totalSoldiers) : Number(first(f.militaryStrength, f.strength));
  const pop = f.population && typeof f.population === 'object' ? f.population : null;
  const attitudeObj = f.attitude && typeof f.attitude === 'object' ? f.attitude : null;

  // 一、君臣
  const people = [person(pp(first(f.leaderTitle, '首领')), first(f.leaderInfo, f.leader, f.leaderName, f.ruler), true), person('继嗣', first(f.heirInfo, f.heir))];
  if (f.leadership && typeof f.leadership === 'object') Object.keys(f.leadership).slice(0, 6).forEach((k) => { if (k !== 'ruler') people.push(person(LEAD_LABEL[k] || label(k), f.leadership[k])); });
  const memberNames = ix && Array.isArray(ix.chars) ? ix.chars.map((c) => (typeof c === 'object' ? c && c.name : c)).filter(Boolean) : [];
  const junchen = { people: people.filter(Boolean), rows: [
    memberNames.length ? { k: '在册人物', v: `共 ${memberNames.length} 人：${memberNames.slice(0, 40).join('、')}${memberNames.length > 40 ? '……' : ''}` } : null,
    row('政体', first(f.government, f.type)), row('战略目标', first(f.goal, f.strategy)), row('意识形态', first(f.ideology, f.mainstream)), row('文化', f.culture),
    row('开局问题', f.openingProblems)
  ].filter(Boolean), chips: chips(f.cohesion, 50) ? [{ title: '凝聚', items: chips(f.cohesion, 50) }] : [] };
  if (!junchen.chips.length) { const c = row('凝聚', f.cohesion); if (c) junchen.rows.push(c); }

  // 二、版图
  // 舆图上据有的府州按省道收拢（本方另出区划预警）；舆图未载时退回势力索引的地名平铺
  let dao = null;
  try { dao = bantuOf(f, key, mine); } catch (e) { console.warn('[newui] 版图按省道收拢失败', e); }
  const bantu = { dao, places: dao ? [] : provinces, rows: [row('剧本领土', f.territory), row('资源', first(f.resources, f.mainResources))].filter(Boolean) };

  // 三、军略
  const mb = f.militaryBreakdown && typeof f.militaryBreakdown === 'object' ? f.militaryBreakdown : null;
  const ws = f.warState && typeof f.warState === 'object' && !Array.isArray(f.warState) ? f.warState : null;
  const junlue = {
    breakdown: mb ? Object.keys(mb).filter((k) => Number(mb[k]) > 0).map((k) => ({ label: MB_LABEL[k] || label(k), value: Number(mb[k]) })) : [],
    rows: [row('总兵力', troops), mb ? null : row('军力构成', f.militaryBreakdown),
      ws ? row('现战', ws.active, 'zhu') : row('战争状态', f.warState, 'zhu'), ws ? row('将起', ws.pending) : null, ws ? row('近役', ws.recent) : null,
      row('动员', first(f.mobilization, f.manpower)), row('战略优先', f.strategicPriorities),
      mine ? null : row('统兵', m.totalCommanders ? `将领 ${m.totalCommanders} 员` : '')].filter(Boolean)
  };

  // 四、财计（总库：新式公帑走 FiscalEngine 合并视图，否则势力自带库藏）
  let tre = f.treasury && typeof f.treasury === 'object' ? { ...f.treasury } : null;
  const g = G();
  if (g.publicTreasuryConfig && g.publicTreasuryConfig.schema === 'tm-public-treasury/2' && w.FiscalEngine && w.FiscalEngine.getConsolidatedView) {
    try {
      const live = w.FiscalEngine.getConsolidatedView({ game: g, factionId: f.id || f.name, scope: f.isUnifiedPolity === false ? 'regional' : 'central' });
      tre = {};
      ['money', 'grain', 'cloth'].forEach((k) => { tre[k] = live.resources[k].known ? live.resources[k].stock : '未具数'; });
      tre.note = f.isUnifiedPolity === false ? '分藏各地，按本地议定用途支给。' : '总库与已拨诸署余存合计，仍各按储处掌管。';
    } catch (_e) { /* 账未齐则用势力自带 */ }
  }
  const eco = f.economicPolicy && typeof f.economicPolicy === 'object' ? f.economicPolicy : null;
  const succ = f.succession && typeof f.succession === 'object' ? f.succession : null;
  const caiji = {
    rows: [row('经济', f.economy), row('库钱', tre && tre.money), row('库藏粮', tre && tre.grain), row('库帛', tre && tre.cloth), row('战马', tre && tre.horses), row('库藏注', tre && tre.note),
      pop ? row('编户 / 实口', [pop.registered, pop.actual].filter(has).map(mapNum).join(' / ')) : row('户口', f.population),
      eco ? row('赋税之政', enumText(eco.taxation)) : row('经济政策', f.economicPolicy), eco ? row('商贸之政', enumText(eco.trade)) : null,
      eco ? row('币制', enumText(eco.currency)) : null, eco ? row('役法', enumText(eco.labor)) : null, row('文教', f.cultureLevel),
      succ ? row('继承', [enumText(succ.rule), has(succ.designatedHeir) ? `储 ${pp(succ.designatedHeir)}` : '储位未定', Number.isFinite(Number(succ.stability)) ? `稳定 ${succ.stability}` : ''].filter(Boolean).join(' · ')) : row('继承', f.succession)
    ].filter(Boolean),
    chips: [['族裔', pop && pop.ethnicities, -1], ['经济结构', f.economicStructure, -1], ['公共舆情', f.publicOpinion, 0], ['技术', f.techLevel, 40]]
      .map(([title, obj, lim]) => (chips(obj, lim) ? { title, items: chips(obj, lim) } : null)).filter(Boolean)
  };

  // 五、邦交（盟约读 GM.treaties，议约读诸势力 _incomingProposals——老界面没有专页，这里只列不动）
  const rel = [];
  const many = (v, kind) => { if (!has(v)) return; (Array.isArray(v) ? v : [v]).forEach((x) => { const name = typeof x === 'object' ? pp(first(x.name, x)) : pp(x); if (name) rel.push({ name, kind, note: typeof x === 'object' ? pp(first(x.note, x.attitude)) : '' }); }); };
  many(f.allies, 'meng'); many(f.enemies, 'di'); many(f.neutrals, 'zhong');
  if (f.relations && typeof f.relations === 'object' && !Array.isArray(f.relations)) Object.keys(f.relations).filter((k) => Number.isFinite(Number(f.relations[k]))).forEach((k) => {
    const n = Number(f.relations[k]);
    rel.push({ name: k, kind: n >= 50 ? 'meng' : n < 0 ? 'di' : 'zhong', note: `亲疏 ${n}` });
  });
  const spies = f.knownSpies && typeof f.knownSpies === 'object' && !Array.isArray(f.knownSpies) ? f.knownSpies : null;
  const thresholds = Array.isArray(f.offendThresholds) ? f.offendThresholds.map((t) => (t && typeof t === 'object'
    ? `${Number.isFinite(Number(t.score)) ? `至 ${t.score}：` : ''}${pp(first(t.description, t.desc))}${Array.isArray(t.consequences) && t.consequences.length ? `（${t.consequences.join('·')}）` : ''}` : pp(t))).filter(Boolean) : [];
  const bangjiao = { relations: rel, rows: [
    rel.length ? null : row('关系', f.relations),
    attitudeObj ? row('自居', attitudeObj.self) : row('态度', first(f.attitudeDetail, f.attitude)),
    attitudeObj ? row('所敌', attitudeObj.enemies, 'zhu') : null, attitudeObj ? row('所盟', attitudeObj.allies) : null, attitudeObj ? row('所持中立', attitudeObj.neutrals) : null,
    row('与本朝', f.playerRelation), thresholds.length ? { k: '冒犯阈值', v: thresholds.join('\n'), tone: 'zhu' } : row('冒犯阈值', f.offendThresholds),
    row('内部派系', f.internalParties), row('党派关系', f.partyRelations),
    treatyRow(f), proposalRow(f),
    spies ? row('已知耳目', Object.keys(spies).filter((k) => Number.isFinite(Number(spies[k]))).map((k) => `${spyPlace(k)} ${spies[k]}`).join(' · ')) : row('已知耳目', f.knownSpies)
  ].filter(Boolean) };

  // 六、史略
  const list = (v) => (Array.isArray(v) ? v.map(pp) : has(v) ? [pp(v)] : []).filter(Boolean).slice(0, 6);
  const events = Array.isArray(f.historicalEvents) ? f.historicalEvents.map((e) => (e && typeof e === 'object' ? [pp(first(e.event, e.name)), pp(first(e.impact, e.note))].filter(Boolean).join('——') : pp(e))).filter(Boolean).join('\n') : pp(f.historicalEvents);
  const shilue = { strengths: list(f.strengths), weaknesses: list(f.weaknesses), texts: [
    ['大略', pp(f.strategy)], ['长策', pp(f.longTermStrategy)], ['国史', pp(f.history)], ['年表', events],
    ...(mine ? [['胜局', pp(f.victoryConditions)], ['败局', pp(f.defeatConditions)]] : [])
  ].filter(([, t]) => t && t.length > 5) };

  return {
    key, name: String(f.name), short: pp(first(f.short, f.name)).slice(0, 2), type: pp(first(f.type, f.factionType, '势力')), desc: pp(first(f.description, f.desc, f.note)), mine,
    pills: [has(first(f.leader, f.leaderName, f.ruler)) ? `${pp(first(f.leaderTitle, '首领'))} ${pp(first(f.leader, f.leaderName, f.ruler))}` : '',
      has(first(f.capital, f.home)) ? `都 ${pp(first(f.capital, f.home))}` : '', mine ? '' : attitudeOf(f), pp(first(f.government, f.ideology)).slice(0, 12)].filter(Boolean),
    hostile: !mine && /敌/.test(attitudeOf(f)),
    stats: [['领地', provinces.length ? `${provinces.length} 块` : ''], ['总兵', Number.isFinite(troops) && troops ? mapNum(troops) : ''], ['户口', pop ? mapNum(first(pop.actual, pop.registered)) : pp(f.population)],
      ['实力', has(f.strength) ? String(Math.round(Number(f.strength))) : ''], ['人物', m.charCount ? `${m.charCount} 人` : '']].filter(([, v]) => v),
    juan: [['君臣', '首脑重臣', junchen], ['版图', '所辖之地', bantu], ['军略', '兵制方略', junlue], ['财计', '库藏经济', caiji], ['邦交', '与国之谊', bangjiao], ['史略', '优劣大略', shilue]]
  };
}

// ---------- 家族 ----------
// 天下门第（GM.families）：剧本写定的显姓与按人物自生的家族。照老抽屉「家族门第」按声望排，新界面另展一族之谱——
// 门第、族人（宗主、嗣、支系，在册者可点）、姻仇、近况与家史。剧本作者的按语（note）多写身后事，不列。
// 门第之称照剧本编辑器的 familyTier 名表
const FAMILY_TIER = { imperial: '宗室帝胄', royal: '宗室', imperial_relative: '宗亲', imperial_consort: '后妃外戚', common: '平民', commoner: '平民', gentry: '士绅',
  scholar_official: '士大夫', civil: '文官', military: '将门', noble: '世家', great_clan: '巨族', lesser_clan: '小族', eunuch: '宦官', steppe_noble: '草原贵族',
  steppe_royal: '草原汗室', samurai_elite: '武士门第', daimyo: '大名', shogunal: '幕府', princely: '藩王', yangban: '两班', tusi: '土司', tusi_remnant: '土司残部',
  colonial_elite: '殖民权贵', religious_order: '教团', company_officer: '商团军官', regional_lord: '地方领主', local_elite: '地方望族', tribal: '部族' };
const PROMINENCE = { rising: '方兴', stable: '安稳', declining: '渐衰' };
const tierText = (t) => FAMILY_TIER[t] || (/^[a-z_]+$/i.test(String(t || '')) ? '' : String(t || ''));
// 「declining(暂)」→ 渐衰（暂）；「rising(rapid)」→ 方兴（急）
const promText = (p) => {
  const s = String(p || '').trim();
  const m = /^([a-z]+)\s*[（(]?([^）)]*)[）)]?$/i.exec(s);
  if (!m) return /[a-z]/i.test(s) ? '' : s;
  const base = PROMINENCE[m[1]] || '';
  const tail = m[2] ? ({ rapid: '急' }[m[2]] || (/[a-z]/i.test(m[2]) ? '' : m[2])) : '';
  return base && tail ? `${base}（${tail}）` : base;
};
const renownOf = (f) => Number(first(f.renown, f.prestige)) || 0;
// 「魏良卿(侄·宁国公)」→ 名「魏良卿」、注「侄·宁国公」；在人物册里的可点
function kin(s) {
  const t = String(s || '').trim();
  const m = /^([^（(]+)[（(](.+)[）)]$/.exec(t);
  const name = (m ? m[1] : t).trim(), note = m ? m[2].trim() : '';
  const known = !!(name && typeof w.findCharByName === 'function' && w.findCharByName(name));
  return { name, note, known };
}
export function families() {
  const all = G().families || {};
  return Object.keys(all).map((k) => {
    const f = all[k] || {};
    const members = Array.isArray(f.members) ? f.members.length : (f.branches || []).reduce((s, b) => s + ((b && b.members) || []).length, 0);
    return { key: k, name: String(f.name || k), tier: tierText(f.tier), renown: Math.round(renownOf(f)), head: kin(first(f.currentHead, (f.branches || [])[0] && f.branches[0].head)).name, members,
      prominence: promText(f.prominence), declining: /declin/.test(String(f.prominence || '')) };
  }).sort((a, b) => b.renown - a.renown || a.name.localeCompare(b.name, 'zh-CN'));
}
export function family(key) {
  const f = (G().families || {})[key];
  if (!f) throw new Error('此族已不在册');
  const branches = (Array.isArray(f.branches) ? f.branches : []).filter((b) => b && ((b.members || []).length || b.head));
  const members = Array.isArray(f.members) ? f.members.map(kin) : [];
  const head = has(f.currentHead) ? kin(f.currentHead) : branches[0] && branches[0].head ? kin(branches[0].head) : null;
  const heir = has(f.heir) ? kin(f.heir) : null;
  const relations = f.relations && typeof f.relations === 'object' && !Array.isArray(f.relations) ? Object.keys(f.relations).map((k) => `${k}：${pp(f.relations[k])}`).filter((x) => !/：$/.test(x)) : [];
  const hist = (Array.isArray(f.history) ? f.history : []).filter((x) => x && (x.event || x.desc)).slice(-12).reverse();
  return {
    name: String(f.name || key), tier: tierText(f.tier), renown: Math.round(renownOf(f)), prominence: promText(f.prominence), declining: /declin/.test(String(f.prominence || '')),
    seat: pp(f.ancestralSeat), fortunes: pp(f.recentFortunes), head, heir,
    menDi: [row('祖籍', f.ancestralSeat), row('始祖', f.founder), row('先人', f.notableAncestors), row('家业', f.wealth), row('立场', f.politicalStance), row('家训', f.motto), row('家风', f.tradition)].filter(Boolean),
    members,
    branches: branches.map((b) => ({ name: String(b.name || '支系'), head: b.head ? kin(b.head) : null, members: (b.members || []).map(kin) })),
    yinChou: [row('联姻', f.marriages), row('宿怨', f.feuds, 'zhu'), relations.length ? { k: '往来', v: relations.join('；') } : null].filter(Boolean),
    history: hist.map((x) => ({ turn: x.turn, event: String(x.event || ''), desc: String(x.desc || '') }))
  };
}
