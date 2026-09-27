// 晚唐剧本·唐廷与河朔、昭义四镇府州的官守、治所、物产与名目（阶段三第三刀）
//
// 原账唐廷府州没有 divisionType、officialPosition、capital、specialResources（体检所见，Codex 说明为「未核实所以不写」），
// 道节点也不知治所。本补丁按唐制与志书补上：
//   - 名目：仪州开成年间仍名辽州（《新唐书·地理志》：中和三年更名仪州），全剧本改回辽州；
//   - divisionType：府、州、都护府、军；
//   - officialPosition：府写尹（京兆尹、河南尹、太原尹、河中尹、凤翔尹、江陵尹、兴元尹、成都尹），大都督府（扬、潞、幽、镇、魏）写长史，州写某州刺史，
//     单于都护府写单于大都护，天德军写天德军防御使，河阳三城写河阳三城使，交州即安南都护府治所写安南都护，
//     侨治的行原州、行渭州与巂州仍写本州刺史；
//   - 治所：每道一州 capital 为真，道节点写 capitalChildId；治所州的长官即道长官（节帅例兼治所州刺史或尹）；
//   - specialResources：《新唐书·地理志》土贡（开元、天宝间所定，是各州物产的通行记载），取前八项；
//     天宝后置州志无土贡的不写。
// 盐、马、渔等 tags 与 taxLevel 暂不写：打上盐、马标签后引擎每回合按人口重算该项产出（待同志定的 P1-B2），
// 年龄、性别、族属、信仰分布原账注明未核实，也不补。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-offices.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { TANG_TREES, leavesOf, resolveSources } = require(path.join(DIR, 'data/tang-sources.js'));

// 各道治所（开成年间）
const SEATS = {
  京畿: '京兆府·长安', 河中: '河中府', 金商: '金州', 东都: '河南府·洛阳', 陕虢: '陕州', 河阳: '河阳三城', 河东: '太原府',
  振武: '单于都护府', 天德: '天德军', 灵盐: '灵州', 夏绥银: '夏州', 鄜坊: '鄜州', 丹州防御: '丹州', 邠宁: '邠州', 泾原: '泾州',
  凤翔: '凤翔府', 义武: '定州', 义昌: '沧州', 平卢: '青州', 天平: '郓州', 兖海: '兖州', 宣武: '汴州', 义成: '滑州', 忠武: '许州',
  武宁: '徐州', 淮南: '扬州', 鄂岳: '鄂州', 浙西: '润州', 浙东: '越州', 宣歙: '宣州', 福建: '福州', 江西: '洪州', 湖南: '潭州',
  荆南: '江陵府', 山南东道: '襄州', 山南西道: '兴元府', 剑南西川: '成都府', 剑南东川: '梓州', 黔中: '黔州', 岭南: '广州',
  桂管: '桂州', 容管: '容州', 邕管: '邕州', 安南: '交州', 魏博: '魏州', 成德: '镇州', 卢龙: '幽州', 昭义: '潞州'
};

// 府尹与特别的官称
const SPECIAL_TITLES = {
  '京兆府·长安': '京兆尹', '河南府·洛阳': '河南尹', 太原府: '太原尹', 河中府: '河中尹', 凤翔府: '凤翔尹', 江陵府: '江陵尹',
  兴元府: '兴元尹', 成都府: '成都尹', 单于都护府: '单于大都护', 天德军: '天德军防御使', 河阳三城: '河阳三城使', 交州: '安南都护',
  '行原州·临泾': '原州刺史', '行渭州·平凉': '渭州刺史', '巂州·台登': '巂州刺史', 南部羁縻: '羁縻州刺史',
  // 大都督府以长史为实任长官（节帅例兼），如王元逵兼镇州大都督府长史
  扬州: '扬州大都督府长史', 潞州: '潞州大都督府长史', 幽州: '幽州大都督府长史', 镇州: '镇州大都督府长史', 魏州: '魏州大都督府长史'
};

function divisionTypeOf(name) {
  const base = name.split('·')[0];
  if (/都护府$/.test(base)) return '都护府';
  if (/府$/.test(base)) return '府';
  if (/军$|三城$/.test(base)) return '军';
  return '州';
}

function titleOf(name) {
  return SPECIAL_TITLES[name] || name.split('·')[0].replace(/^行/, '') + '刺史';
}

// 全剧本改名（含地图与 id；仪州只作此州之名，别无他义）
function renameEverywhere(scenario, from, to) {
  let count = 0;
  (function walk(node) {
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (typeof v === 'string') { if (v.includes(from)) { node[k] = v.split(from).join(to); count++; } }
      else if (v && typeof v === 'object') walk(v);
      if (k.includes(from)) { node[k.split(from).join(to)] = node[k]; delete node[k]; count++; }
    });
  })(scenario);
  return count;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  // 名目：仪州 → 辽州（先查无撞名）
  if (raw.includes('辽州')) throw new Error('剧本里已有辽州，不能直接改名');
  delete scenario.mapData;
  const renamed = renameEverywhere(scenario, '仪州', '辽州');

  const rows = [];
  TANG_TREES.forEach((treeKey) => {
    scenario.adminHierarchy[treeKey].divisions.forEach((circuit) => {
      const leaves = leavesOf([circuit], []);
      const seatName = SEATS[circuit.name];
      const seat = leaves.find((l) => l.name === seatName);
      if (!seat) throw new Error(circuit.name + ' 的治所 ' + seatName + ' 不在本道');
      circuit.capitalChildId = seat.id;
      const sources = resolveSources(leaves);
      leaves.forEach((l, i) => {
        l.divisionType = divisionTypeOf(l.name);
        l.officialPosition = titleOf(l.name);
        l.capital = l === seat;
        l.parentDivisionId = circuit.id;
        const tribute = ((sources[i] && sources[i].tributeS) || []).slice(0, 8);
        if (tribute.length) l.specialResources = tribute.join('·');
        if (l === seat && circuit.governor) l.governor = circuit.governor;
        rows.push('| ' + circuit.name + ' | ' + l.name + (l.capital ? '（治所）' : '') + ' | ' + l.divisionType + ' | ' + l.officialPosition + ' | ' + (l.governor || '') + ' | ' + (l.specialResources || '') + ' |');
      });
    });
  });

  // 地块 data 按府州重新生成；mapData 与 map 一致
  const byMap = new Map(scenario.map.regions.map((r) => [r.id, r]));
  TANG_TREES.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const data = JSON.parse(JSON.stringify(l));
    delete data.treasuryBinding;
    byMap.get(l.mapRegionId).data = data;
  }));
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));

  const report = ['# 晚唐·府州官守、治所与物产报告', '',
    '仪州开成年间仍名辽州（中和三年始改仪州），全剧本改回辽州，共 ' + renamed + ' 处（含 id、道路与账户）。唐廷与河朔、昭义四镇 ' + rows.length +
      ' 个府州补 divisionType、officialPosition、capital、parentDivisionId，物产取《新唐书·地理志》土贡前八项；治所州长官即道长官。', '',
    '| 道 | 府州 | 类 | 官称 | 长官 | 物产（土贡） |', '| --- | --- | --- | --- | --- | --- |', ...rows];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
