// 晚唐剧本·各道属州按开成年间制度改正（阶段三第五刀）
//
// 核查依据：《元和郡县图志》各道「管州」、《新唐书·方镇表》与《旧唐书·地理志》至德后方镇，以及开成年间的任命
// （核查结果在 sources/tang-research/north.json、south.json 的 membership 一节）。原账有几处挂错：
//   - 郢州属山南东道（元和志「襄陽節度使……管州八：襄州，鄧州，復州，郢州……」），原账挂在荆南；
//   - 连州属湖南（元和志「湖南觀察使……管州七：潭州，衡州，郴州，永州，連州，道州，邵州」），原账挂在桂管；
//   - 龚州属桂管（元和志「桂管經略使……管州十二：……龔州……」），原账挂在容管；
//   - 丹州：元和元年一度析置防御使，元和志已列在鄜坊观察使下，太和六年史孝章的官称是「鄜、坊、丹、延节度使」，
//     开成间查不到丹州防御使，并回鄜坊；
//   - 同州、华州：开成间是朝廷直接任命的防御使州（开成三年卢载为同州防御使，开成四年陈夷行为华州镇国军防御使），
//     不属河中、京畿，各自成道。
// 各州自身的户口、钱粮、描述不动（道合计随之变化）；地图地块、省道登记、诸库合计、阶层的道级处境、军队的钱粮来处、
// 官制树一并改。原丹州防御使府改作同州防御使府（同为防御使，俸额相同）。
// 颍州属宣武还是义成，元和志与方镇表记载矛盾，不动，列入待核。岭南勤州、黔中珍州、夏绥宥州、桂管富蒙思唐严诸州、
// 容管白禺牢党廉义岩顺诸州地图上没有地块，另议。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-membership.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');

// 属州改挂：州 → [原道, 新道]
const MOVES = [
  ['郢州', '荆南', '山南东道', '元和志山南东道（襄阳节度）管州八含郢州；旧唐书地理志荆南所管无郢州'],
  ['连州', '桂管', '湖南', '元和志湖南观察使管州七含连州'],
  ['龚州', '容管', '桂管', '元和志桂管经略使管州十二含龚州'],
  ['丹州', '丹州防御', '鄜坊', '元和志鄜坊观察使下列丹州；太和六年史孝章官称「鄜、坊、丹、延节度使」；开成间无丹州防御使']
];

// 另立一道的防御使州：州 → 道名、官称、自原道分出、道描述
const SPLITS = [
  {
    leaf: '同州', name: '同州防御', from: '河中', officialPosition: '同州防御使', governor: '卢载', office: '同州防御',
    description: '同州在京兆之东，隔黄河与河中相望，长春宫与朝邑、冯翊诸县都在境内。同州刺史兼本州防御、长春宫等使，由朝廷直接任命，不属河中节度。',
    source: '《旧唐书·文宗纪下》开成三年「左丞盧載為同州防禦使」；《全唐文》卷六〇一谢上表「守同州刺史兼御史中丞、充本州防禦長春宮等使」'
  },
  {
    leaf: '华州', name: '华州防御', from: '京畿', officialPosition: '镇国军防御使', governor: '陈夷行', office: '华州防御（镇国军）',
    description: '华州扼潼关，东出关外、西入京畿的驿路与漕运都经境内。华州刺史兼潼关防御、镇国军等使，由朝廷直接任命，不属京兆尹。',
    source: '《旧唐书·文宗纪下》开成四年「以吏部侍郎陳夷行為華州鎮國軍防禦使」；《旧唐书·陈夷行传》「檢校禮部尚書，出為華州刺史」'
  }
];

// 丹州并入鄜坊后，原丹州防御使府改作同州防御使府
const REPURPOSE_OFFICE = {
  from: '丹州防御使府', to: '同州防御使府', posts: { 丹州防御使: '同州防御使', 丹州防御判官: '同州防御判官' }, regionId: '同州', holder: { post: '同州防御使', name: '卢载' },
  desc: '同州刺史兼本州防御、长春宫等使。州境临黄河渡口，东与河中隔河相望，驻军、渡船与长春宫的供给都由使府经理。'
};

function stableId(text) {
  return 'circuit-' + crypto.createHash('sha1').update('sc-tang840-840:' + text).digest('hex').slice(0, 12);
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  delete scenario.mapData;

  const tree = scenario.adminHierarchy.player;
  const circuit = (name) => {
    const c = tree.divisions.find((d) => d.name === name);
    if (!c) throw new Error('没有这个道：' + name);
    return c;
  };
  const regionOf = (leaf) => scenario.map.regions.find((r) => r.id === leaf.mapRegionId);
  const registry = (c) => scenario.map.circuitRegistry.find((r) => r.key === c.id);
  const pool = (c) => scenario.publicTreasuryConfig.accounts.find((a) => a.id === 'pool:' + c.id);
  const byName = new Map(scenario.characters.map((c) => [c.name, c]));
  const rows = [];

  function moveLeaf(leafName, from, to, officeLabel) {
    const idx = from.children.findIndex((l) => l.name === leafName);
    if (idx < 0) throw new Error(leafName + ' 不在' + from.name);
    const leaf = from.children.splice(idx, 1)[0];
    to.children.push(leaf);
    Object.assign(leaf, { parentId: to.id, parentDivisionId: to.id, circuitName: to.name });
    const region = regionOf(leaf);
    const sibling = to.children.find((l) => l !== leaf);
    Object.assign(region, { parentId: to.id, circuitName: to.name, office: officeLabel || (sibling ? regionOf(sibling).office : to.name) });
    const fromReg = registry(from);
    fromReg.memberRegionIds = fromReg.memberRegionIds.filter((id) => id !== leaf.id);
    registry(to).memberRegionIds.push(leaf.id);
    const fromPool = pool(from);
    fromPool.members = fromPool.members.filter((m) => m !== 'region:' + leaf.id);
    pool(to).members.push('region:' + leaf.id);
    scenario.military.initialTroops.forEach((t) => {
      if (t.garrison === leaf.name && t.funding && t.funding.regionId === from.id) t.funding.regionId = to.id;
    });
    // 环境承载：道一级的耕地、林地、煤储是属州之和，随州移动；水位、河流、地力等比率不动
    const carrying = scenario.environmentConfig.initialCarrying.byRegion;
    const own = carrying[leaf.id];
    if (own && carrying[from.id] && carrying[to.id]) {
      ['arableArea', 'forestArea', 'coalReserve'].forEach((k) => {
        carrying[from.id][k] -= own[k];
        carrying[to.id][k] += own[k];
      });
    }
    return leaf;
  }

  // ---- 1. 属州改挂 ----
  const touchedLeaves = new Set();
  MOVES.forEach(([leafName, fromName, toName, why]) => {
    const leaf = moveLeaf(leafName, circuit(fromName), circuit(toName));
    touchedLeaves.add(leaf);
    rows.push('| ' + leafName + ' | ' + fromName + ' | ' + toName + ' | ' + why + ' |');
  });

  // ---- 2. 丹州防御并入鄜坊：删去空道及其登记、诸库合计、阶层道级处境 ----
  const dan = circuit('丹州防御');
  if (dan.children.length) throw new Error('丹州防御仍有属州');
  tree.divisions = tree.divisions.filter((d) => d !== dan);
  scenario.map.circuitRegistry = scenario.map.circuitRegistry.filter((r) => r.key !== dan.id);
  scenario.publicTreasuryConfig.accounts = scenario.publicTreasuryConfig.accounts.filter((a) => a.id !== 'pool:' + dan.id);
  delete scenario.environmentConfig.initialCarrying.byRegion[dan.id];
  delete scenario.environmentConfig.initialScars.byRegion[dan.id];
  let droppedVariants = 0;
  scenario.classes.forEach((cls) => {
    const before = (cls.regionalVariants || []).length;
    cls.regionalVariants = (cls.regionalVariants || []).filter((v) => v.regionId !== dan.id);
    droppedVariants += before - cls.regionalVariants.length;
  });
  // 鄜坊各州地块与道名号里的「丹州另防御」注记去掉
  circuit('鄜坊').children.forEach((leaf) => {
    const region = regionOf(leaf);
    region.office = String(region.office).replace('（丹州另防御）', '');
  });
  if (typeof circuit('鄜坊').historicalTitle === 'string') circuit('鄜坊').historicalTitle = circuit('鄜坊').historicalTitle.replace('（丹州另防御）', '');

  // ---- 3. 同州、华州各立一道 ----
  const splitRows = [];
  SPLITS.forEach((spec) => {
    const parent = circuit(spec.from);
    const leaf = parent.children.find((l) => l.name === spec.leaf);
    const gov = byName.get(spec.governor);
    if (!leaf || !gov) throw new Error('找不到 ' + spec.leaf + ' 或 ' + spec.governor);
    const id = stableId(spec.name);
    const node = {
      id, name: spec.name, level: parent.level, regionType: parent.regionType, factionId: parent.factionId,
      population: { mouths: 0, households: 0 }, description: spec.description,
      governor: gov.name, governorId: gov.id,
      fiscalDetail: { autonomyLevel: leaf.fiscalDetail.autonomyLevel },
      officialPosition: spec.officialPosition, capitalChildId: leaf.id, children: []
    };
    // 道的历史名号（通志页读）：他道有的，新道也写上
    if (typeof parent.historicalTitle === 'string') node.historicalTitle = spec.office;
    tree.divisions.splice(tree.divisions.indexOf(parent) + 1, 0, node);
    const parentReg = registry(parent);
    scenario.map.circuitRegistry.splice(scenario.map.circuitRegistry.indexOf(parentReg) + 1, 0, { key: id, name: spec.name, faction: parentReg.faction, memberRegionIds: [] });
    const parentPool = pool(parent);
    scenario.publicTreasuryConfig.accounts.splice(scenario.publicTreasuryConfig.accounts.indexOf(parentPool) + 1, 0,
      Object.assign(JSON.parse(JSON.stringify(parentPool)), { id: 'pool:' + id, name: spec.name + '诸库合计', members: [] }));
    // 阶层的道级处境：沿用所分出之道
    scenario.classes.forEach((cls) => {
      const variants = cls.regionalVariants || [];
      const src = variants.find((v) => v.regionId === parent.id);
      if (src) variants.splice(variants.indexOf(src) + 1, 0, Object.assign(JSON.parse(JSON.stringify(src)), { regionId: id, region: spec.name }));
    });
    // 环境承载与环境旧伤：新道先立空账（比率沿用原道），再随州移入耕地、林地
    const env = scenario.environmentConfig;
    env.initialCarrying.byRegion[id] = Object.assign(JSON.parse(JSON.stringify(env.initialCarrying.byRegion[parent.id])), { arableArea: 0, forestArea: 0, coalReserve: 0 });
    env.initialScars.byRegion[id] = JSON.parse(JSON.stringify(env.initialScars.byRegion[parent.id]));
    moveLeaf(spec.leaf, parent, node, spec.office);
    touchedLeaves.add(leaf);
    leaf.governor = gov.name;
    splitRows.push('| ' + spec.name + ' | ' + spec.officialPosition + ' | ' + gov.name + ' | 自' + spec.from + '分出 | ' + spec.source + ' |');
  });

  // ---- 4. 官制树：原丹州防御使府改作同州防御使府（势力、顶层、登记表三份） ----
  const fac = scenario.factions.find((f) => f.name === '唐朝廷');
  const tongPool = 'pool:' + stableId('同州防御');
  const holder = byName.get(REPURPOSE_OFFICE.holder.name);
  [fac.officeTree, scenario.officeTree, scenario.officeRegistryByFaction['唐朝廷']].forEach((list) => {
    const dept = list.find((o) => o.name === REPURPOSE_OFFICE.from);
    if (!dept) throw new Error('官制树里没有 ' + REPURPOSE_OFFICE.from);
    dept.name = REPURPOSE_OFFICE.to;
    ['desc', 'description'].forEach((k) => { if (k in dept) dept[k] = REPURPOSE_OFFICE.desc; });
    dept.positions.forEach((p) => {
      const to = REPURPOSE_OFFICE.posts[p.name];
      if (!to) throw new Error('未预期的官缺 ' + p.name);
      p.name = to;
      p.regionId = REPURPOSE_OFFICE.regionId;
      ['desc', 'duties', 'description'].forEach((k) => { if (typeof p[k] === 'string') p[k] = p[k].split('丹州').join('同州'); });
      if (p.treasuryBinding) p.treasuryBinding.accountRefs = p.treasuryBinding.accountRefs.map((ref) => ref === 'pool:' + dan.id ? tongPool : ref);
      if (to === REPURPOSE_OFFICE.holder.post) Object.assign(p, { holder: holder.name, holderId: holder.id, occupancyStatus: 'occupied' });
    });
  });

  // ---- 5. 地块 data 按府州重新生成；mapData 与 map 一致 ----
  touchedLeaves.forEach((leaf) => {
    const data = JSON.parse(JSON.stringify(leaf));
    delete data.treasuryBinding;
    regionOf(leaf).data = data;
  });
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));

  // 自检：丹州防御的 id 不再出现；各道登记与行政树一致
  const text = JSON.stringify(scenario);
  if (text.includes(dan.id)) {
    const left = [];
    (function walk(x, at) {
      if (typeof x === 'string') { if (x.includes(dan.id)) left.push(at); return; }
      if (x && typeof x === 'object') Object.keys(x).forEach((k) => { if (k.includes(dan.id)) left.push(at + '.{' + k + '}'); walk(x[k], at + '.' + k); });
    })(scenario, '$');
    throw new Error('丹州防御的 id 仍有残留：' + left.slice(0, 8).join('、'));
  }
  tree.divisions.forEach((d) => {
    const reg = registry(d);
    const ids = d.children.map((l) => l.id).sort().join(',');
    if (!reg || reg.memberRegionIds.slice().sort().join(',') !== ids) throw new Error(d.name + ' 的省道登记与行政树不一致');
    const members = pool(d).members.slice().sort().join(',');
    if (members !== d.children.map((l) => 'region:' + l.id).sort().join(',')) throw new Error(d.name + ' 的诸库合计与行政树不一致');
  });

  const report = ['# 晚唐·各道属州改正报告', '',
    '按元和志、方镇表与开成间任命改正属州：改挂 ' + MOVES.length + ' 州，丹州防御并回鄜坊，同州、华州各立一道。唐廷道数 ' + tree.divisions.length + '。各州户口、钱粮不动，道合计随之变化。', '',
    '## 改挂', '', '| 州 | 原道 | 新道 | 依据 |', '| --- | --- | --- | --- |', ...rows, '',
    '## 另立一道', '', '| 道 | 官称 | 长官 | 由来 | 依据 |', '| --- | --- | --- | --- | --- |', ...splitRows, '',
    '丹州防御删去后，阶层的道级处境少 ' + droppedVariants + ' 条（鄜坊已有本道处境）；原丹州防御使府改作同州防御使府，卢载任同州防御使。', '',
    '## 未改、待核', '',
    '- 颍州：元和志「汴宋节度使管州四：汴、宋、亳、颍」，方镇表开成前后又有颍州属义成（郑滑颍）的记载，两说并存，仍挂义成。',
    '- 地图上没有地块的：岭南勤州、黔中珍州、夏绥宥州、桂管富蒙思唐严诸州、容管白禺牢党廉义岩顺诸州，另议。'];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
