// 晚唐剧本·外藩补入史实人物（阶段三第六刀之三）
//
// 外藩批量代表删去后，许多势力一个人也没有。按两份核查与日本诸人薨卒传，补入开局时在世、史籍有名、开局前身份可考的 29 人：
// 回鹘宰相掘罗勿（开成四年借沙陀兵攻杀彰信可汗、另立新汗的实际掌权者）与赤心、馺职、别将句录莫贺、特勒厖、那颉啜、乌希；
// 黠戛斯君长阿热；吐蕃鄯州节度使尚婢婢、落门川讨击使论恐热、大相结都那、宰相尚思罗、赞普妃綝氏、东北道元帅论夷加羌；
// 南诏权臣王嵯巅；日本中纳言藤原爱发、藤原吉野、橘氏公，参议文室秋津，配流隐岐的小野篁；新罗上大等礼徵、伊飡良顺、武州阎长；
// 开成四年十二月入唐朝贡的渤海王子大延广、契丹首领萨葛、奚大首领温讷骨、室韦大都督秩虫；迦摩缕波王、环王（铭文研究，L）。
// 写法与数据见 data/tang-foreign-newpeople.js；黠戛斯、迦摩缕波、环王原无首领，写上。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-foreign-newpeople.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const WUCHANG_FILE = path.join(REPO, 'web/assets/reference/tang840-wuchang.json');
const { NEW_PEOPLE } = require(path.join(DIR, 'data/tang-foreign-newpeople.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));

// 家产史无可考，按外藩原有史实人物的中位数估（与唐廷补人按唐廷节帅中位数估同一办法）
const FOREIGN_WEALTH = { money: 1275, grain: 55, cloth: 55, treasure: 500, slaves: 4, fame: 0, household: { money: 18, grain: 4, cloth: 0.2 } };
const POLARITY = {
  positive: { affinity: 62.5, trust: 40, respect: 50, fear: 0, hostility: 0, value: 25 },
  negative: { affinity: 40, trust: 25, respect: 45, fear: 0, hostility: 25, value: -20 }
};

function stableId(prefix, text) {
  return prefix + crypto.createHash('sha1').update('sc-tang840-840:' + text).digest('hex').slice(0, 12);
}

function sameFormat(raw, obj) {
  let out = JSON.stringify(obj, null, /^\{\r?\n {2}"/.test(raw) ? 2 : 0);
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n';
  return out;
}

function healthByAge(age) { return age >= 65 ? 70 : age >= 55 ? 76 : age >= 45 ? 82 : 86; }

function buildCharacter(spec, scenario) {
  const id = stableId('char-', spec.name);
  const faction = lib.factionByName(scenario, spec.faction);
  const region = scenario.map.regions.find((r) => r.name === spec.location && r.owner === faction.name);
  if (!region) throw new Error(spec.name + ' 的所在「' + spec.location + '」不是 ' + spec.faction + ' 的地块');
  const official = spec.official || '';
  const full = spec.title || [official, ...(spec.concurrent || [])].filter(Boolean).join('·');
  const s = spec.stats;
  const personalGoal = '';
  const c = {
    id, sid: scenario.id, name: spec.name, title: full, officialTitle: official, role: full, occupation: full,
    isPlayer: false, isRoyal: spec.socialClass === 'imperial', alive: true, age: spec.age, gender: spec.gender || '男',
    location: spec.location, regionId: region.id, faction: faction.name, party: '', partyRank: '成员', rankLevel: 12,
    faith: '', culture: faction.name, traits: [], traitIds: [],
    loyalty: s.loyalty, ambition: s.ambition, intelligence: s.intelligence, valor: s.valor, military: s.military,
    administration: s.administration, management: s.management, charisma: s.charisma, diplomacy: s.diplomacy,
    benevolence: s.benevolence, integrity: s.integrity, health: healthByAge(spec.age), stress: 35,
    resources: {
      privateWealth: {
        accounting: { schema: 'tm-character-economy/2' },
        money: FOREIGN_WEALTH.money, grain: FOREIGN_WEALTH.grain, cloth: FOREIGN_WEALTH.cloth, land: 0,
        treasure: FOREIGN_WEALTH.treasure, commerce: 0, slaves: FOREIGN_WEALTH.slaves, debt: 0,
        landHoldings: [], houses: [], shops: [], treasures: [], livestock: [], investments: [], debts: [], receivables: [], familyBusiness: []
      },
      fame: FOREIGN_WEALTH.fame, hiddenWealth: 0
    },
    relations: {}, partyIds: [], _memory: [], isHistorical: true,
    personality: spec.personality || '', personalGoal, innerThought: '', stressSources: [], diction: '', speechStyle: '', stance: '',
    learning: spec.learning || '', family: spec.family || '', familyRole: '', personalGoals: [],
    bio: [spec.background, spec.description].filter(Boolean).join('\n\n'), aiPersonaText: '',
    portrait: 'assets/portraits/tang840/generic/' + spec.portrait + '.png', rosterRole: spec.roster, works: [],
    economyConfig: {
      accounting: { schema: 'tm-character-economy/2' }, incomeStreams: [],
      expenseStreams: [{ id: id + '-household', kind: 'household', label: '衣食、燃料与日用', monthly: Object.assign({}, FOREIGN_WEALTH.household) }],
      supportArrangements: []
    },
    socialClass: spec.socialClass, appearance: '', ethnicity: '', birthplace: '', birthTime: '', zi: '', haoName: '',
    familyTier: '', familyStatus: '', mentor: '', hobbies: '', secret: '',
    familyMembers: spec.father ? [{ name: spec.father, relation: '父' }] : [], redLines: [], personalGrudges: [], skills: [],
    historicalSources: spec.sources.slice(), type: 'historical', isFictional: false, factionId: faction.name, career: []
  };
  if (spec.father) c.father = spec.father;
  if (spec.birthYear) c.birthYear = spec.birthYear;
  if (spec.aliases) c.aliases = spec.aliases.slice();
  if (spec.concurrent) {
    c.officialTitles = [official, ...spec.concurrent];
    c.concurrentTitles = spec.concurrent.slice();
    c.concurrentTitle = spec.concurrent.join('、');
  }
  c.wuchangOverride = Object.assign({}, spec.wuchang.scores);
  c.wuchangAssessment = { version: 1, kind: 'historical-inference', confidence: Object.assign({}, spec.wuchang.confidence), reference: 'assets/reference/tang840-wuchang.json', key: id };
  c.aiPersonaText = [c.name + '，' + full + '。', c.bio, c.personality].filter(Boolean).join('\n');
  return c;
}

function addRelations(scenario, c, list) {
  const byName = new Map(scenario.characters.map((x) => [x.name, x]));
  (list || []).forEach(([otherName, label, polarity, labelBack]) => {
    const other = byName.get(otherName);
    if (!other) throw new Error(c.name + ' 的交往对象 ' + otherName + ' 不在人物表');
    const p = POLARITY[polarity];
    [[c, other, label], [other, c, labelBack || label]].forEach(([from, to, type]) => {
      from.relations = from.relations || {};
      from.relations[to.name] = { affinity: p.affinity, trust: p.trust, respect: p.respect, fear: p.fear, hostility: p.hostility, labels: [type] };
      scenario.relations.push({ id: stableId('tang840-rel-', from.name + '→' + to.name), sid: scenario.id, from: from.name, to: to.name, fromId: from.id, toId: to.id, type, value: p.value });
    });
  });
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  const wuchangRaw = fs.readFileSync(WUCHANG_FILE, 'utf8');
  const wuchang = JSON.parse(wuchangRaw);

  // 先建人，再接关系（交往对象可能排在后面）
  const built = NEW_PEOPLE.map((spec) => {
    if (scenario.characters.some((x) => x.name === spec.name)) throw new Error(spec.name + ' 已在人物表');
    const c = buildCharacter(spec, scenario);
    scenario.characters.push(c);
    wuchang.characters[c.id] = { name: c.name, kind: 'historical-inference', initialScores: Object.assign({}, spec.wuchang.scores), confidence: Object.assign({}, spec.wuchang.confidence), note: spec.wuchang.note, sources: spec.wuchang.sources };
    return { spec, c };
  });
  built.forEach(({ spec, c }) => addRelations(scenario, c, spec.relations));

  // 原无首领的势力写上首领
  const leaderRows = [];
  built.filter(({ spec }) => spec.leader).forEach(({ spec, c }) => {
    const f = lib.factionByName(scenario, spec.faction);
    if (f.leader) throw new Error(spec.faction + ' 已有首领 ' + f.leader);
    f.leader = c.name;
    if (spec.leaderTitle) f.leaderTitle = spec.leaderTitle;
    leaderRows.push('| ' + spec.faction + ' | ' + c.name + ' | ' + (spec.leaderTitle || '') + ' |');
  });

  const byFaction = {};
  built.forEach(({ spec, c }) => { (byFaction[spec.faction] = byFaction[spec.faction] || []).push(c.name); });
  const rows = built.map(({ spec, c }) => '| ' + c.name + ' | ' + spec.faction + ' | ' + c.title + ' | ' + c.location + ' | ' + c.age + '（' + spec.ageBasis + '） | ' +
    (spec.relations || []).map(([n, l]) => n + '·' + l).join('、') + ' | ' + spec.sources.length + ' 条 |');
  const report = ['# 晚唐·外藩补入史实人物报告', '',
    '补入 ' + built.length + ' 人，全剧本 ' + scenario.characters.length + ' 人（外藩 ' + scenario.characters.filter((c) => !/^唐/.test(c.faction)).length + ' 人）；黠戛斯、迦摩缕波、环王写上首领。',
    '生平只写开局前史料所见，性情只写史料明文；家产按外藩原有史实人物的中位数估，才具与五常按唐廷文臣（或军将）中位数略低一档，有行迹的逐项加减。', '',
    '| 人物 | 势力 | 称衔 | 所在 | 年龄（依据） | 交往 | 引文 |', '| --- | --- | --- | --- | --- | --- | --- |', ...rows, '',
    '## 首领', '', '| 势力 | 首领 | 称号 |', '| --- | --- | --- |', ...leaderRows, '',
    '## 按势力', '', '| 势力 | 人物 |', '| --- | --- |', ...Object.keys(byFaction).map((f) => '| ' + f + ' | ' + byFaction[f].join('、') + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    fs.writeFileSync(WUCHANG_FILE, sameFormat(wuchangRaw, wuchang));
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, WUCHANG_FILE));
  }
}

main();
