// 晚唐剧本·唐廷与河朔、昭义四镇的户口重建（阶段三第二刀）
//
// 原账各道总数是作者按开成年间估定的（唐廷在籍户合计与开成四年户籍相当），但道内各州是按几档系数摊的：
// 慈州、隰州各项相同，陕、虢二州户数相同，207 处同一道下三个以上州人口相同。
// 本补丁：各道合计一概不动，道内各州改按《新唐书·地理志》天宝户定权重重分（《元和郡县图志》元和户列作参考）。
//   - 天宝以后才设的州（宿、池、信、昌、澶、涿、孟即河阳三城），志里只有属县没有户数，按所领县数乘本道每县平均户估；
//   - 志与县名都没有的（天德军、南部羁縻），保持原账在本道所占份额；
//   - 新唐书用州的终名：唐州作泌州、随州作隋州、交州作安南中都护府、单于都护府作单于大都护府、磁州作惠州，
//     开成年间的仪州时名辽州（中和三年始改仪州，名目在第三刀改）。
// 随人口走的量（户口账各项、田亩、商贸额、府库开局存量、城市人口、地方水利驿路仓储开支与吏员，
// 河朔四镇按人头的销盐课 saltOutput）都按「各州原账数 × 本州人口变动倍数」重分，再按本道合计归一，
// 因此道与全国合计不变，原账为零的项仍为零、各州原有的在籍率、垦田率等差别保留。
// 课额（盐池、海盐、井盐、茶、酒、商税、舶货、坑冶）是按州定的旧额，连同酒坊工本都不动。最后用财政引擎按年预算重算各州开局账 fiscalDetail
// （原账的开局账正是引擎按年预算的结果，先核对这一点再重算）。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-households.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const { TANG_TREES: TREES, NO_YUANHE_TREES, leavesOf, resolveSources, yuanheFor } = require(path.join(DIR, 'data/tang-sources.js'));

// 随人口走的户口账字段（mouthsPerDing 是比率，不在内）
const POP_FIELDS = ['mouths', 'households', 'ding', 'registeredMouths', 'registeredHouseholds', 'taxableMouths', 'taxableHouseholds',
  'hiddenCount', 'hidden', 'fugitives', 'registeredDing', 'hiddenDing', 'fledDing', 'baselineExemptDing', 'exemptDing', 'registeredLand'];
// 课额（盐、茶、酒、商税、舶货、坑冶）是按州定的旧额，不随人口走；只重分经济底数
const ECON_FIELDS = ['farmland', 'taxableLand', 'commerceVolume'];
const ECON_FIELDS_HEBEI = ECON_FIELDS.concat(['saltOutput']); // 河朔四镇的盐课是境内销盐，按人头
const INT_ECON = new Set(['farmland', 'taxableLand', 'commerceVolume']);
const MONEY_KEYS = ['claimedRevenue', 'actualRevenue', 'collectedRevenue', 'remittedToCenter', 'retainedBudget', 'skimmed', 'lostInTransit'];

// 按份额分整数，保持合计不变（最大余数法）
function apportion(total, shares) {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (!sum) return shares.map(() => 0);
  const exact = shares.map((s) => (total * s) / sum);
  const out = exact.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { out[i] += 1; rest -= 1; } });
  return out;
}

// 一组量按「原值 × 倍数」重分并归一到原合计
function redistribute(values, factors, integer) {
  const total = values.reduce((a, b) => a + b, 0);
  const raw = values.map((v, i) => v * factors[i]);
  if (integer) return apportion(Math.round(total), raw);
  const sum = raw.reduce((a, b) => a + b, 0);
  return sum ? raw.map((r) => (total * r) / sum) : values.slice();
}

// ---------- 财政引擎（与 smoke-tang840-fiscal-detail 同样的开局构造） ----------
function fiscalPreview(scenario) {
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const s = scenario;
  const g = {
    sid: s.id, turn: 1, turnDays: 10, playerInfo: copy(s.playerInfo), facs: copy(s.factions), chars: copy(s.characters),
    officeTree: copy(s.officeTree), adminHierarchy: copy(s.adminHierarchy), armies: copy(s.military.initialTroops),
    fiscalConfig: copy(s.fiscalConfig), guoku: { money: s.guoku.initialMoney, grain: s.guoku.initialGrain, cloth: s.guoku.initialCloth },
    neitang: { money: s.neitang.initialMoney, grain: s.neitang.initialGrain, cloth: s.neitang.initialCloth }, publicTreasuryConfig: copy(s.publicTreasuryConfig)
  };
  const c = { GM: g, P: { time: copy(s.time), playerInfo: copy(s.playerInfo), fiscalConfig: copy(s.fiscalConfig) }, console: { log() {}, warn() {}, error() {} },
    Math, JSON, Date, setTimeout() {}, clearTimeout() {}, _getDaysPerTurn: () => 10, findScenarioById: () => s };
  c.window = c; c.globalThis = c; vm.createContext(c);
  ['tm-field-pipelines.js', 'tm-public-treasury.js', 'tm-char-economy-ledger.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js']
    .forEach((file) => vm.runInContext(fs.readFileSync(path.join(REPO, 'web', file), 'utf8'), c, { filename: file }));
  c.FiscalEngine.initializePublicTreasuries({ game: g, scenario: s });
  const byRegion = new Map();
  const factionIds = { player: '唐朝廷' };
  TREES.forEach((key) => {
    const budget = c.CascadeTax.previewBudget({ game: g, faction: factionIds[key] || key, turnDays: 360 });
    if (!budget) throw new Error(key + ' 没有财政预算');
    budget.regions.forEach((r) => byRegion.set(r.id, r.resources));
  });
  return byRegion;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  // 先核对：原账开局账就是引擎按年预算
  const before = fiscalPreview(scenario);
  TREES.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const r = before.get(l.id);
    if (!r || JSON.stringify(r) !== JSON.stringify(l.fiscalDetail.resources)) throw new Error(l.name + ' 的开局账不是引擎按年预算，不能按引擎重算');
  }));

  const cities = new Map(scenario.cities.map((c) => [c.regionId, c]));
  const byRegionPop = (scenario.populationConfig && scenario.populationConfig.initial && scenario.populationConfig.initial.byRegion) || {};
  const configs = [scenario.fiscalConfig].concat(scenario.factions.filter((f) => f.fiscalConfig && TREES.concat(['唐朝廷']).includes(f.id)).map((f) => f.fiscalConfig));
  const expenseItems = (id) => {
    const rows = [];
    configs.forEach((cfg) => {
      const fe = cfg.fixedExpense || {};
      // 只取本州的地方开支（local-州-…）；酒坊工本随酒课旧额，中枢各项即使写了所在州也不动
      (fe.recurringExpenses || []).forEach((x) => {
        if (String(x.id).startsWith('local-' + id + '-') || x.id === 'local-' + id) rows.push({ kind: 'local', item: x });

      });
      (fe.administrativeStaff || []).forEach((x) => { if (x.regionId === id) rows.push({ kind: 'staff', item: x }); });
    });
    return rows;
  };

  const tables = [];
  let equalBefore = 0;
  TREES.forEach((treeKey) => {
    const hebei = treeKey !== 'player';
    scenario.adminHierarchy[treeKey].divisions.forEach((circuit) => {
      const leaves = leavesOf([circuit], []);
      if (leaves.length < 2) return;
      const sources = resolveSources(leaves);
      const rows = leaves.map((l, i) => ({ leaf: l, src: sources[i], mouths: l.populationDetail.mouths, hh: l.populationDetail.households }));
      // 权重：天宝户（《新唐书·地理志》）。各道合计已是作者对开成年间的估计，安史乱后的区域消长在道一级已体现；
      // 道内各州的相对大小以天宝户最为齐整——元和户虽近，但各州括户程度悬殊、传抄多讹（申州 614、象州 233 之类脱字），
      // 只作参考列出。天宝以后才设的州：元和志有开元户的用开元户（与天宝同一口径），否则按所领县数乘本道每县平均户估，
      // 再没有才用元和户按本道中位比折算（河朔三镇元和户不可用）。
      rows.forEach((r) => { r.yh = yuanheFor(r.leaf.name, true); r.tb = r.src && r.src.households; });
      const medianOf = (xs) => { const v = xs.slice().sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
      const perKaiyuan = medianOf(rows.filter((r) => r.tb && r.yh && r.yh.kaiyuan).map((r) => r.tb / r.yh.kaiyuan));
      const perYuanhe = medianOf(rows.filter((r) => r.tb && r.yh && r.yh.yuanhe).map((r) => r.tb / r.yh.yuanhe));
      rows.forEach((r) => {
        if (r.tb) { r.weight = r.tb; r.basis = '天宝户 ' + r.tb; return; }
        if (r.yh && r.yh.kaiyuan) {
          const k = perKaiyuan || 1;
          r.weight = r.yh.kaiyuan * k; r.basis = '天宝后置州，开元户 ' + r.yh.kaiyuan + ' × 本道天宝/开元 ' + k.toFixed(2); return;
        }
      });
      // 其次按所领县数乘本道每县平均天宝户（元和户各州括户悬殊，按本道比例折算很不稳，放到最后）
      const weighted = rows.filter((r) => r.weight != null && r.src);
      const perCounty = weighted.reduce((a, r) => a + r.weight, 0) / Math.max(1, weighted.reduce((a, r) => a + (r.src.countyCount || r.src.counties.length || 1), 0));
      rows.forEach((r) => {
        if (r.weight != null) return;
        const counties = (r.src && (r.src.countyCount || r.src.counties.length)) || 0;
        if (counties && weighted.length) { r.weight = counties * perCounty; r.basis = '天宝后置州，' + counties + ' 县 × 本道每县 ' + Math.round(perCounty) + ' 户'; return; }
        if (r.yh && r.yh.yuanhe && perYuanhe && !NO_YUANHE_TREES.has(treeKey)) {
          r.weight = r.yh.yuanhe * perYuanhe; r.basis = '天宝后置州，元和户 ' + r.yh.yuanhe + ' × 本道天宝/元和 ' + perYuanhe.toFixed(2); return;
        }
        r.weight = null;
      });
      // 志无可据者保持原份额：按已定权重与原户数的比例折算
      const known = rows.filter((r) => r.weight != null);
      if (!known.length) return;
      const ratio = known.reduce((a, r) => a + r.weight, 0) / known.reduce((a, r) => a + r.hh, 0);
      rows.forEach((r) => { if (r.weight == null) { r.weight = r.hh * ratio; r.basis = '志无户与县，保持原账份额'; } });

      const totalMouths = rows.reduce((a, r) => a + r.mouths, 0);
      const totalWeight = rows.reduce((a, r) => a + r.weight, 0);
      const factors = rows.map((r) => (r.weight / totalWeight) / (r.mouths / totalMouths));
      const hhCount = {};
      rows.forEach((r) => { hhCount[r.hh] = (hhCount[r.hh] || 0) + 1; });
      equalBefore += Object.values(hhCount).filter((n) => n >= 3).reduce((a, n) => a + n, 0);

      // 户口账
      POP_FIELDS.forEach((k) => {
        if (!rows.some((r) => typeof r.leaf.populationDetail[k] === 'number')) return;
        const next = redistribute(rows.map((r) => r.leaf.populationDetail[k] || 0), factors, true);
        rows.forEach((r, i) => { if (typeof r.leaf.populationDetail[k] === 'number') r.leaf.populationDetail[k] = next[i]; });
      });
      rows.forEach((r) => {
        const p = r.leaf.populationDetail;
        r.leaf.population = p.mouths;
        const mirror = byRegionPop[r.leaf.id];
        if (mirror) Object.keys(mirror).forEach((k) => { if (k in p) mirror[k] = p[k]; });
      });
      // 经济与府库
      (hebei ? ECON_FIELDS_HEBEI : ECON_FIELDS).forEach((k) => {
        if (!rows.some((r) => typeof r.leaf.economyBase[k] === 'number')) return;
        const next = redistribute(rows.map((r) => r.leaf.economyBase[k] || 0), factors, INT_ECON.has(k));
        rows.forEach((r, i) => { if (typeof r.leaf.economyBase[k] === 'number') r.leaf.economyBase[k] = next[i]; });
      });
      ['money', 'grain', 'cloth'].forEach((k) => {
        const next = redistribute(rows.map((r) => (r.leaf.publicTreasuryInit || {})[k] || 0), factors, true);
        rows.forEach((r, i) => { if (r.leaf.publicTreasuryInit && k in r.leaf.publicTreasuryInit) r.leaf.publicTreasuryInit[k] = next[i]; });
      });
      const cityRows = rows.map((r) => cities.get(r.leaf.mapRegionId));
      if (cityRows.every(Boolean)) {
        const next = redistribute(cityRows.map((c) => c.population || 0), factors, true);
        cityRows.forEach((c, i) => { c.population = next[i]; });
      }
      // 地方开支：水利驿路仓储随人口，吏员人数随人口
      const items = rows.map((r) => expenseItems(r.leaf.id));
      ['local'].forEach((kind) => {
        const byId = {};
        items.forEach((list, i) => list.filter((x) => x.kind === kind).forEach((x) => {
          const key = x.item.id.replace(rows[i].leaf.id, '#');
          (byId[key] = byId[key] || []).push({ i, item: x.item });
        }));
        Object.values(byId).forEach((group) => {
          ['money', 'grain', 'cloth'].forEach((res) => {
            const vals = group.map((g) => (g.item.monthly || {})[res] || 0);
            const next = redistribute(vals, group.map((g) => factors[g.i]), false);
            group.forEach((g, j) => { if (g.item.monthly && res in g.item.monthly) g.item.monthly[res] = next[j]; });
          });
        });
      });
      const staff = [];
      items.forEach((list, i) => list.filter((x) => x.kind === 'staff').forEach((x) => staff.push({ i, item: x.item })));
      if (staff.length) {
        const next = redistribute(staff.map((s) => s.item.count || 0), staff.map((s) => factors[s.i]), true);
        staff.forEach((s, j) => { s.item.count = next[j]; });
      }

      tables.push('### ' + circuit.name + '\n\n| 州 | 依据 | 元和户（参考） | 原户 | 新户 |\n| --- | --- | --- | --- | --- |\n' +
        rows.map((r) => '| ' + r.leaf.name + ' | ' + r.basis + ' | ' + ((r.yh && r.yh.yuanhe) || '') + ' | ' + r.hh + ' | ' + r.leaf.populationDetail.households + ' |').join('\n'));
    });
  });
  // 唐廷的顶层 fiscalConfig 与唐廷势力的 fiscalConfig 是同一份拷贝，两处已同步改过
  const tang = scenario.factions.find((f) => f.id === '唐朝廷');
  if (JSON.stringify(tang.fiscalConfig) !== JSON.stringify(scenario.fiscalConfig)) throw new Error('唐廷两份 fiscalConfig 改后不一致');

  // 用引擎按年预算重算开局账
  const after = fiscalPreview(scenario);
  TREES.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const r = after.get(l.id);
    l.fiscalDetail.resources = JSON.parse(JSON.stringify(r));
    MONEY_KEYS.forEach((k) => { l.fiscalDetail[k] = r.money[k]; });
  }));

  // 地块 data 与 mapData
  const byMap = new Map(scenario.map.regions.map((r) => [r.id, r]));
  TREES.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const data = JSON.parse(JSON.stringify(l));
    delete data.treasuryBinding;
    byMap.get(l.mapRegionId).data = data;
  }));
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));

  const report = ['# 晚唐·户口重建报告', '',
    '唐廷与河朔、昭义四镇各道合计不变，道内各州按《新唐书·地理志》天宝户定权重重分（天宝后置州用《元和郡县图志》开元、元和户按本道比例折算，或按县数估）；《元和郡县图志》元和户列作参考。原账同一道下三个以上州户数相同的有 ' + equalBefore + ' 州次。',
    '随人口走的户口账、田亩、商贸额、府库开局存量、城市人口、地方开支与吏员按同一倍数重分并按道归一（河朔四镇的销盐课亦随人口）；按州定额的盐、茶、酒、商税、舶货、坑冶课额与酒坊工本不动；开局账按财政引擎按年预算重算。', '',
    ...tables];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}


main();
