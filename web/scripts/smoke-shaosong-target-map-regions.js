#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SCENARIO_DIR = path.join(ROOT, 'scenarios');

function fail(message) {
  console.error(`[smoke-shaosong-target-map-regions] ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function findScenarioFile(label) {
  const file = fs.readdirSync(SCENARIO_DIR).find((name) => (
    name.includes('绍宋') &&
    name.includes(label) &&
    name.endsWith('.json') &&
    !name.includes('.bak')
  ));
  if (!file) fail(`missing scenario file for ${label}`);
  return path.join(SCENARIO_DIR, file);
}

function centerOf(region) {
  return region.center || region.centroid || [NaN, NaN];
}

function assertRegionWindow(region, bounds, label) {
  const [x, y] = centerOf(region);
  const [minX, maxX, minY, maxY] = bounds;
  assert(x >= minX && x <= maxX && y >= minY && y <= maxY, `${label} center out of expected window: ${region.id} ${region.name} (${Math.round(x)},${Math.round(y)})`);
}

function assertFactionWindow(regions, ownerKey, expectedCount, bounds, label) {
  const owned = regions.filter((region) => region.ownerKey === ownerKey);
  assert(owned.length === expectedCount, `${label} ${ownerKey} region count changed: ${owned.length}`);
  for (const region of owned) {
    assertRegionWindow(region, bounds, `${label} ${ownerKey} ${region.name}`);
  }
}

function sumNumeric(regions, field) {
  return regions.reduce((total, region) => total + (Number(region[field]) || 0), 0);
}

function fiscalTotal(region) {
  return Number(region.fiscalDetail?.['岁入总']) || 0;
}

function mapFactionEntry(scenario, ownerKey) {
  const scenarioFactionId = ownerKey.replace(/-/g, '_');
  for (const source of [scenario.map?.factions, scenario.mapData?.factions]) {
    if (!source) continue;
    if (Array.isArray(source)) {
      const entry = source.find((faction) => faction.id === scenarioFactionId || faction.id === ownerKey || faction.ownerKey === ownerKey);
      if (entry) return entry;
    } else if (typeof source === 'object') {
      const entry = source[scenarioFactionId] || source[ownerKey];
      if (entry) return entry;
    }
  }
  return null;
}

function assertFiscalNormal(region, label) {
  assert(region.population > 0, `${label} missing population`);
  assert(region.populationDetail?.mouths === region.population, `${label} populationDetail mouths mismatch`);
  assert(region.populationDetail?.households > 0, `${label} missing households`);
  assert(region.economyBase && Number.isFinite(Number(region.economyBase.commerceVolume)), `${label} missing economyBase`);
  assert(fiscalTotal(region) > 0, `${label} missing fiscal total`);
  assert(region.fiscalDetail?.claimedRevenue > 0, `${label} missing panel fiscal claimedRevenue`);
  assert(region.fiscalDetail?.actualRevenue > 0, `${label} missing panel fiscal actualRevenue`);
  assert(region.fiscalDetail?.remittedToCenter > 0, `${label} missing panel fiscal remittedToCenter`);
  assert(region.fiscalDetail?.retainedBudget >= 0, `${label} missing panel fiscal retainedBudget`);
  assert(region.fiscalDetail?.compliance > 0, `${label} missing panel fiscal compliance`);
  assert(region.publicTreasuryInit?.['库存折贯'] >= 0, `${label} missing public treasury`);
  assert(region.publicTreasuryInit?.money > 0, `${label} missing panel treasury money`);
  assert(region.publicTreasuryInit?.grain > 0, `${label} missing panel treasury grain`);
  assert(region.publicTreasuryInit?.cloth > 0, `${label} missing panel treasury cloth`);
  assert(region.carryingCapacity >= region.population, `${label} carrying capacity below population`);
}

function assertPanelShareField(source, field, label) {
  const value = source?.[field];
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} missing panel ${field}`);
  const entries = Object.entries(value);
  assert(entries.length > 0, `${label} empty panel ${field}`);
  for (const [key, raw] of entries) {
    assert(typeof raw === 'string' && /%$/.test(raw), `${label} panel ${field}.${key} should render as percent text, got ${raw}`);
    const number = Number(raw.replace('%', ''));
    assert(number > 0 && number <= 100, `${label} panel ${field}.${key} invalid percent ${raw}`);
  }
}

function assertHukouPanelData(region, label) {
  for (const field of ['byGender', 'byAge', 'byEthnicity', 'byFaith', 'bySettlement']) {
    assert(region[field] && typeof region[field] === 'object' && !Array.isArray(region[field]), `${label} missing numeric ${field}`);
    assertPanelShareField(region.data, field, label);
  }
}

function assertRegionDataComplete(region, label) {
  assertFiscalNormal(region, label);
  assert(region.publicTreasuryInit?.['库存折贯'] > 0, `${label} public treasury money not populated`);
  assert(region.publicTreasuryInit?.['常平仓石'] > 0, `${label} public treasury grain not populated`);
  assert(region.publicTreasuryInit?.['军资库'] > 0, `${label} military treasury not populated`);
  for (const field of ['commerceVolume', 'postRelays', 'landsSurveyed', 'landsReclaimed', 'landsAnnexed']) {
    assert(Number(region.economyBase?.[field]) > 0, `${label} economyBase.${field} not populated`);
  }
  assert(Number(region.troops) > 0, `${label} troops not populated for real region panel`);
  assert(Number(region.armyPressure) > 0, `${label} armyPressure not populated for real region panel`);
  assert(Number(region.militaryRecruits) > 0, `${label} militaryRecruits not populated`);
  assert(Number(region.recruits) === Number(region.militaryRecruits), `${label} recruits not synced to militaryRecruits`);
  assert(Number(region.levyPool) === Number(region.militaryRecruits), `${label} levyPool not synced to militaryRecruits`);
  assert(Number(region.militaryDetail?.availableRecruits) === Number(region.militaryRecruits), `${label} militaryDetail.availableRecruits not synced`);
  assert(Number(region.localMilitaryCost) > 0, `${label} localMilitaryCost not populated`);
  assert(region.tags && typeof region.tags === 'object' && !Array.isArray(region.tags), `${label} tags should be an object for real region panel`);
  for (const tag of ['hasPort', 'saltRegion', 'mineralRegion', 'horseRegion', 'fishingRegion', 'imperialDomain']) {
    assert(typeof region.tags[tag] === 'boolean', `${label} tags.${tag} missing boolean value`);
  }
  assert(region.armyDetail?.troops === region.troops, `${label} armyDetail troops not synced`);
  assert(region.data?.population === region.population, `${label} region.data population mirror missing`);
  assert(region.data?.tags && typeof region.data.tags === 'object' && !Array.isArray(region.data.tags), `${label} region.data tags mirror missing`);
  assertHukouPanelData(region, label);
  assert(region.data?.fiscalDetail?.actualRevenue === region.fiscalDetail.actualRevenue, `${label} region.data fiscal mirror missing`);
  assert(region.data?.publicTreasuryInit?.money === region.publicTreasuryInit.money, `${label} region.data treasury mirror missing`);
  assert(region.data?.armyDetail?.troops === region.troops, `${label} region.data army mirror missing`);
  assert(Number(region.data?.recruits) === Number(region.militaryRecruits), `${label} region.data recruits mirror missing`);
  assert(Number(region.data?.levyPool) === Number(region.militaryRecruits), `${label} region.data levyPool mirror missing`);
  assert(Number(region.data?.militaryDetail?.availableRecruits) === Number(region.militaryRecruits), `${label} region.data militaryDetail mirror missing`);
  const assets = region.economyBase?.imperialAssets || {};
  for (const field of ['zhizao', 'kuangchang', 'yuyao']) {
    assert(Number.isFinite(Number(assets[field] || 0)), `${label} imperialAssets.${field} missing`);
  }
}

function assertEthnicityClean(region, forbidden, label) {
  const text = Object.keys(region.byEthnicity || {}).join('/');
  for (const word of forbidden) {
    assert(!text.includes(word), `${label} stale ethnicity ${word}: ${text}`);
  }
}

function loadScenario(label) {
  const scenarioPath = findScenarioFile(label);
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  assert(scenario.map?.id === 'shaosong-1127-182', `${label} map id mismatch`);
  assert(scenario.mapData?.id === 'shaosong-1127-182', `${label} mapData id mismatch`);
  assert(Array.isArray(scenario.map.regions), `${label} missing map regions`);
  assert(scenario.map.regions.length === 182, `${label} map region count mismatch`);
  assert(scenario.mapData.regions.length === 182, `${label} mapData region count mismatch`);
  return { scenarioPath, scenario };
}

function collectAdminLeaves(node, out) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const child of node) collectAdminLeaves(child, out);
    return out;
  }
  if (node.mapRegionId) out.push(node);
  if (Array.isArray(node.children)) collectAdminLeaves(node.children, out);
  if (Array.isArray(node.divisions)) collectAdminLeaves(node.divisions, out);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) collectAdminLeaves(value, out);
  }
  return out;
}

function assertCriticalArmyHints(scenario, label) {
  const names = new Set(scenario.map.regions.map((region) => region.name));
  const expected = new Map([
    ['西夏·铁鹞子', '灵州·盐州'],
    ['西夏·铁鹞子重骑', '中兴府'],
    ['西夏·步跋子强弩', '夏州·宥州'],
    ['蒙兀·合不勒汗大纛本部', '蒙兀诸部·三河源'],
    ['泰赤乌·俺巴孩部', '蒙兀诸部·鄂嫩河'],
    ['忽图剌勇士部', '蒙兀诸部·肯特山'],
    ['乃蛮·汗金印军', '乃蛮部·阿尔泰东麓'],
    ['乃蛮·镇山那颜军', '漠北西南诸部'],
    ['塔塔儿·盟主大纛本部', '塔塔儿·捕鱼儿湖西部'],
    ['塔塔儿·诸支联骑', '塔塔儿·捕鱼儿湖东部'],
    ['大越·李朝禁军', '升龙京畿'],
    ['大越·南疆御占军', '乂安州'],
    ['金西路军(粘罕)', '西京路·大同府'],
    ['金东路军(斡离不)', '河北西路·真定府'],
    ['金·东京辽阳镇兵', '辽阳府·复州'],
    ['东喀喇汗·突厥游骑', '八剌沙衮'],
    ['东喀喇汗·怛逻斯边军', '怛罗斯'],
    ['高昌·回鹘统军', '高昌'],
    ['高昌·西陲戍军', '焉耆']
  ]);
  const troops = new Map((scenario.military?.initialTroops || []).map((army) => [army.name, army]));
  for (const [armyName, regionName] of expected.entries()) {
    assert(names.has(regionName), `${label} critical army target region missing: ${regionName}`);
    const army = troops.get(armyName);
    assert(army, `${label} critical army missing: ${armyName}`);
    assert(army.regionHint === regionName, `${label} critical army ${armyName} regionHint not synced: ${army.regionHint}`);
  }
}

function checkScenario(label) {
  const { scenarioPath, scenario } = loadScenario(label);
  const regions = scenario.map.regions;
  const names = new Set();
  for (const region of regions) {
    assert(!names.has(region.name), `${label} duplicate region name ${region.name}`);
    names.add(region.name);
  }
  for (const [regionSetLabel, regionSet] of [[`${label} map`, scenario.map.regions], [`${label} mapData`, scenario.mapData.regions]]) {
    for (const region of regionSet) assertRegionDataComplete(region, `${regionSetLabel} ${region.ownerKey} ${region.name}`);
  }

  const byName = new Map(regions.map((region) => [region.name, region]));
  const byId = new Map(regions.map((region) => [region.id, region]));
  const adminLeaves = collectAdminLeaves(scenario.adminHierarchy, []);
  const adminByRegionId = new Map(adminLeaves.map((leaf) => [leaf.mapRegionId, leaf]));
  for (const leaf of adminLeaves) {
    for (const field of ['byGender', 'byAge', 'byEthnicity', 'byFaith', 'bySettlement']) {
      assertPanelShareField(leaf, field, `${label} adminHierarchy ${leaf.name || leaf.mapRegionId}`);
    }
    assert(Number(leaf.militaryRecruits) > 0, `${label} adminHierarchy ${leaf.name || leaf.mapRegionId} missing militaryRecruits`);
    assert(Number(leaf.recruits) === Number(leaf.militaryRecruits), `${label} adminHierarchy ${leaf.name || leaf.mapRegionId} recruits not synced`);
    assert(Number(leaf.levyPool) === Number(leaf.militaryRecruits), `${label} adminHierarchy ${leaf.name || leaf.mapRegionId} levyPool not synced`);
    assert(Number(leaf.militaryDetail?.availableRecruits) === Number(leaf.militaryRecruits), `${label} adminHierarchy ${leaf.name || leaf.mapRegionId} militaryDetail not synced`);
  }
  assertCriticalArmyHints(scenario, label);

  const zhongxing = byName.get('中兴府');
  assert(zhongxing, `${label} missing corrected Zhongxing Fu`);
  assert(zhongxing.ownerKey === 'fac-xixia', `${label} Zhongxing Fu owner mismatch`);
  assert(zhongxing.isCapital === true, `${label} Zhongxing Fu should be marked as capital`);
  assertRegionWindow(zhongxing, [1000, 1060, 540, 575], `${label} Zhongxing Fu`);

  const lingyan = byName.get('灵州·盐州');
  assert(lingyan, `${label} missing Lingzhou/Yanzhou block`);
  assert(lingyan.ownerKey === 'fac-xixia', `${label} Lingzhou/Yanzhou owner mismatch`);
  assertRegionWindow(lingyan, [1020, 1065, 540, 575], `${label} Lingzhou/Yanzhou`);

  for (const id of ['div_1781355155816_8574', 'div_1781355214960_3469']) {
    const region = byId.get(id);
    assert(region, `${label} missing western plateau correction id ${id}`);
    assert(region.ownerKey === 'fac-tubo', `${label} ${region.name} should no longer be Western Xia`);
    assert(region.officialPosition === '吐蕃部首', `${label} ${region.name} still has stale officialPosition`);
  }

  const northernSteppe = byName.get('可敦城北境');
  assert(northernSteppe, `${label} missing Kereit northern steppe block`);
  assert(northernSteppe.ownerKey === 'fac-kereit', `${label} Kereit northern steppe owner mismatch`);
  assertRegionWindow(northernSteppe, [900, 1100, 300, 390], `${label} Kereit northern steppe`);

  const badNorthernXia = regions.filter((region) => region.ownerKey === 'fac-xixia' && centerOf(region)[0] > 1000 && centerOf(region)[1] < 400);
  assert(badNorthernXia.length === 0, `${label} has Western Xia blocks in far northern steppe: ${badNorthernXia.map((region) => region.name).join(', ')}`);

  const steppeIsland = byId.get('div_1781353164644_1158');
  assert(steppeIsland, `${label} missing corrected steppe island`);
  assert(steppeIsland.ownerKey === 'fac-caoyuan', `${label} ${steppeIsland.name} should no longer be Western Xia`);

  const xixia = regions.filter((region) => region.ownerKey === 'fac-xixia');
  const xixiaMongolNames = xixia.filter((region) => /蒙兀|克烈|蔑儿乞|弘吉剌|合答斤|札只剌|塔塔儿|漠北/.test(region.name));
  assert(xixiaMongolNames.length === 0, `${label} has Mongolian/steppe names under Western Xia: ${xixiaMongolNames.map((region) => region.name).join(', ')}`);
  const xixiaPopulation = sumNumeric(xixia, 'population');
  assert(xixiaPopulation >= 1900000 && xixiaPopulation <= 2400000, `${label} Western Xia population out of historical-gameplay band: ${xixiaPopulation}`);
  assert(xixia.reduce((total, region) => total + fiscalTotal(region), 0) >= 300000, `${label} Western Xia fiscal data too low or missing`);
  for (const region of xixia) {
    assertFiscalNormal(region, `${label} Western Xia ${region.name}`);
    assert((region.byEthnicity || {})['党项'] > 0, `${label} Western Xia ${region.name} missing Tangut population share`);
    assertEthnicityClean(region, ['蒙兀', '蒙古', '克烈', '乃蛮', '塔塔儿'], `${label} Western Xia ${region.name}`);
    assert(region.economyBase.horseProduction <= 35, `${label} Western Xia ${region.name} inherited excessive steppe horse output`);
  }
  assert(zhongxing.population >= 200000, `${label} Zhongxing Fu population too low for capital block`);
  assert((zhongxing.bySettlement || {})['城'] >= 0.25, `${label} Zhongxing Fu settlement mix is not capital-like`);
  const xixiaFaction = scenario.factions?.find((faction) => faction.id === 'fac_xixia');
  assert(xixiaFaction, `${label} missing Western Xia faction`);
  assert(xixiaFaction.population?.actual === xixiaPopulation, `${label} Western Xia faction population not synced to map`);
  assert(xixiaFaction.territorySummary?.mapRegionCount === 13, `${label} Western Xia territory summary missing map count`);
  assert(xixiaFaction.territorySummary?.fiscalAnnual >= 300000, `${label} Western Xia territory summary fiscal missing`);
  assert(xixiaFaction.partyRelations?.['党项宗室与嵬名诸部'], `${label} Western Xia partyRelations missing Tangut clan block`);
  assert(xixiaFaction.militarySystem?.eliteUnits?.includes('铁鹞子重骑'), `${label} Western Xia military system missing Iron Hawk cavalry`);
  assert(xixiaFaction.diplomacyMatrix?.jin?.stance, `${label} Western Xia diplomacy matrix missing Jin stance`);
  assert(Array.isArray(xixiaFaction.openingDilemmas) && xixiaFaction.openingDilemmas.length >= 4, `${label} Western Xia opening dilemmas too thin`);
  assert(/任得敬/.test(JSON.stringify(xixiaFaction.aiBehaviorHints || [])), `${label} Western Xia AI hints missing Ren Dejing risk`);
  assert(xixiaFaction.aiPersonality?.voice && /自保|扩边|臣金/.test(xixiaFaction.aiPersonality.voice), `${label} Western Xia AI personality missing self-preserving vassal voice`);
  assert(xixiaFaction.aiDecisionWeights?.avoidOverextension >= 80, `${label} Western Xia AI should avoid overextension`);
  assert(Array.isArray(xixiaFaction.aiConditionalBehaviors) && xixiaFaction.aiConditionalBehaviors.length >= 5, `${label} Western Xia conditional AI too thin`);
  assert((xixiaFaction.aiImmersionHooks || []).includes('铁鹞子惜用'), `${label} Western Xia immersion hooks missing Iron Hawk restraint`);
  assert(/机会主义守成扩边/.test(xixiaFaction.aiStrategy || ''), `${label} Western Xia AI strategy missing opportunistic posture`);
  const xixiaForce = scenario.externalForces?.find((force) => force.name === '西夏');
  assert(xixiaForce?.territorySummary?.population === xixiaPopulation, `${label} Western Xia external force summary not synced`);
  assert((xixiaForce?.policyHooks || []).includes('横山新附地治理'), `${label} Western Xia external force lacks policy hooks`);
  assert((xixiaForce?.policyHooks || []).includes('称臣金国但避免充当前驱'), `${label} Western Xia external force lacks vassal-but-not-vanguard hook`);

  const jin = regions.filter((region) => region.ownerKey === 'fac-jin');
  assert(jin.length === 18, `${label} Jin region count changed: ${jin.length}`);
  const jinPopulation = sumNumeric(jin, 'population');
  const jinFiscal = jin.reduce((total, region) => total + fiscalTotal(region), 0);
  assert(jinPopulation >= 15000000 && jinPopulation <= 19000000, `${label} Jin population out of strengthened historical-gameplay band: ${jinPopulation}`);
  assert(jinFiscal >= 1200000, `${label} Jin fiscal data too low or missing: ${jinFiscal}`);
  const hejian = byId.get('div_1781498010824_6498');
  assert(hejian, `${label} missing Hebei East Hejian Fu`);
  assert(hejian.ownerKey === 'fac-jin', `${label} Hejian Fu should belong to Jin`);
  assert(hejian.color === '#7E57C2', `${label} Hejian Fu should use Jin purple`);
  for (const region of jin) {
    assertFiscalNormal(region, `${label} Jin ${region.name}`);
    assertEthnicityClean(region, ['鞑靼蒙古', '克烈乃蛮'], `${label} Jin ${region.name}`);
    assert((region.byEthnicity || {})['女真'] > 0 || (region.byEthnicity || {})['汉'] > 0 || (region.byEthnicity || {})['契丹'] > 0, `${label} Jin ${region.name} missing Jin-era population mix`);
    assert(region.economyBase.horseProduction <= 35, `${label} Jin ${region.name} inherited excessive steppe horse output`);
  }
  const jinFaction = scenario.factions?.find((faction) => faction.id === 'fac_jin');
  assert(jinFaction, `${label} missing Jin faction`);
  assert(jinFaction.population?.actual === jinPopulation, `${label} Jin faction population not synced to map`);
  assert(jinFaction.territorySummary?.mapRegionCount === 18, `${label} Jin territory summary missing map count`);
  assert(jinFaction.territorySummary?.fiscalAnnual === jinFiscal, `${label} Jin territory summary fiscal not synced`);
  const jinMapFaction = mapFactionEntry(scenario, 'fac-jin');
  const kereitMapFaction = mapFactionEntry(scenario, 'fac-kereit');
  assert(jinMapFaction?.scenarioFactionColor === '#7E57C2' || jinMapFaction?.color === '#7E57C2', `${label} Jin map faction should be purple`);
  assert(kereitMapFaction?.scenarioFactionColor === '#455A64' || kereitMapFaction?.color === '#455A64', `${label} Kereit map faction should use old Jin color`);
  assert(jinFaction.strength >= 98 && jinFaction.aggression >= 99, `${label} Jin faction not strengthened enough`);
  assert(jinFaction.aiAggressionProfile?.score >= 95, `${label} Jin AI aggression profile too weak`);
  assert((jinFaction.aiAggressionProfile?.strategicPriorities || []).includes('secure-hejian-corridor'), `${label} Jin AI missing Hejian corridor priority`);
  assert(jinFaction.aiPersonality?.voice && /军令式/.test(jinFaction.aiPersonality.voice), `${label} Jin AI personality missing command voice`);
  assert(jinFaction.aiDecisionWeights?.huntEmperor >= 95, `${label} Jin AI should prioritize hunting the emperor`);
  assert(Array.isArray(jinFaction.aiConditionalBehaviors) && jinFaction.aiConditionalBehaviors.length >= 5, `${label} Jin conditional AI too thin`);
  assert((jinFaction.aiImmersionHooks || []).includes('河间转运廊道'), `${label} Jin immersion hooks missing Hejian corridor`);
  assert(jinFaction.partyRelations?.['西路宗翰系'], `${label} Jin partyRelations missing Zonghan block`);
  assert(jinFaction.partyRelations?.['东路宗望旧部与宗弼新锐'], `${label} Jin partyRelations missing east-route succession block`);
  assert(jinFaction.militarySystem?.eliteUnits?.includes('猛安谋克女真骑军'), `${label} Jin military system missing Meng'an Mouke cavalry`);
  assert(Array.isArray(jinFaction.openingDilemmas) && jinFaction.openingDilemmas.length >= 5, `${label} Jin opening dilemmas too thin`);
  assert(/南侵/.test(JSON.stringify(jinFaction.aiBehaviorHints || [])), `${label} Jin AI hints missing invasion pressure`);
  assert(!/不能提前稳占河间/.test(JSON.stringify(jinFaction)), `${label} Jin AI still treats Hejian as not occupied`);
  const jinForce = scenario.externalForces?.find((force) => force.name === '金 (大金国)');
  assert(jinForce?.territorySummary?.population === jinPopulation, `${label} Jin external force summary not synced`);
  assert(jinForce?.threatLevel >= 10, `${label} Jin external force threat level too low`);
  assert((jinForce?.policyHooks || []).includes('秋冬高强度南侵'), `${label} Jin external force lacks aggression policy hook`);
  assert((jinForce?.policyHooks || []).includes('河间转运廊道治理'), `${label} Jin external force lacks Hejian corridor hook`);

  assertFactionWindow(regions, 'fac-jin', 18, [1130, 1500, 340, 610], `${label} Jin`);
  assertFactionWindow(regions, 'fac-xixia', 13, [890, 1085, 340, 610], `${label} Western Xia`);
  assertFactionWindow(regions, 'fac-mongol', 4, [1120, 1160, 440, 500], `${label} Mongol`);
  assertFactionWindow(regions, 'fac-tatar', 5, [1170, 1240, 410, 485], `${label} Tatar`);
  assertFactionWindow(regions, 'fac-kereit', 3, [1030, 1170, 330, 480], `${label} Kereit`);
  assertFactionWindow(regions, 'fac-karakhan-east', 16, [520, 770, 350, 610], `${label} Eastern Karakhanid`);
  assertFactionWindow(regions, 'fac-qocho', 11, [720, 875, 330, 550], `${label} Qocho`);

  const daivietCapital = byName.get('升龙京畿');
  assert(daivietCapital, `${label} missing Dai Viet capital block`);
  assert(daivietCapital.ownerKey === 'fac-daiviet', `${label} Dai Viet capital owner mismatch`);
  assert(daivietCapital.isCapital === true, `${label} Dai Viet capital should be marked as capital`);
  assertRegionWindow(daivietCapital, [1030, 1090, 820, 855], `${label} Dai Viet capital`);

  const daiviet = regions.filter((region) => region.ownerKey === 'fac-daiviet');
  assert(daiviet.length === 10, `${label} Dai Viet region count changed: ${daiviet.length}`);
  for (const name of ['广源州', '谅州', '峰州', '富良府', '农州', '红河三角洲南缘', '清化府', '海东路', '乂安州']) {
    assert(byName.get(name)?.ownerKey === 'fac-daiviet', `${label} Dai Viet missing or misplaced ${name}`);
  }
  for (const region of daiviet) {
    assertRegionWindow(region, [990, 1090, 830, 905], `${label} Dai Viet ${region.name}`);
  }
  const daivietPopulation = sumNumeric(daiviet, 'population');
  assert(daivietPopulation >= 1500000 && daivietPopulation <= 2100000, `${label} Dai Viet population out of historical-gameplay band: ${daivietPopulation}`);
  assert(daiviet.reduce((total, region) => total + fiscalTotal(region), 0) >= 260000, `${label} Dai Viet fiscal data too low or missing`);
  for (const region of daiviet) {
    assertFiscalNormal(region, `${label} Dai Viet ${region.name}`);
    assert((region.byEthnicity || {})['京越'] > 0, `${label} Dai Viet ${region.name} missing Kinh/Viet population share`);
    assert(region.economyBase.horseProduction === 0, `${label} Dai Viet ${region.name} inherited steppe horse economy`);
  }

  const japan = regions.filter((region) => region.ownerKey === 'fac-japan');
  const japanPopulation = sumNumeric(japan, 'population');
  assert(japan.length === 7, `${label} Japan region count changed: ${japan.length}`);
  assert(japanPopulation >= 5800000 && japanPopulation <= 6800000, `${label} Japan population out of late-Heian band: ${japanPopulation}`);
  for (const region of japan) {
    assertFiscalNormal(region, `${label} Japan ${region.name}`);
  }

  const pagan = regions.filter((region) => region.ownerKey === 'fac-pagan');
  const paganPopulation = sumNumeric(pagan, 'population');
  assert(pagan.length === 4, `${label} Pagan region count changed: ${pagan.length}`);
  assert(paganPopulation >= 1500000 && paganPopulation <= 2000000, `${label} Pagan population out of historical band: ${paganPopulation}`);
  for (const region of pagan) {
    assertFiscalNormal(region, `${label} Pagan ${region.name}`);
  }

  const steppeOwnerKeys = new Set(['fac-caoyuan', 'fac-kereit', 'fac-merkit', 'fac-mongol', 'fac-tatar', 'fac-qongirat', 'fac-ongud']);
  const steppe = regions.filter((region) => steppeOwnerKeys.has(region.ownerKey));
  const steppePopulation = sumNumeric(steppe, 'population');
  assert(steppePopulation >= 700000 && steppePopulation <= 1050000, `${label} steppe population out of nomad band: ${steppePopulation}`);
  for (const region of steppe) {
    assertFiscalNormal(region, `${label} steppe ${region.name}`);
    assert(region.population <= 100000, `${label} steppe ${region.name} population too high for one tribal block`);
    assert(region.economyBase.farmland <= 8, `${label} steppe ${region.name} inherited agrarian farmland`);
    assert(fiscalTotal(region) <= 12000, `${label} steppe ${region.name} fiscal too high for tribal tribute`);
  }

  const tubo = regions.filter((region) => region.ownerKey === 'fac-tubo');
  const tuboPopulation = sumNumeric(tubo, 'population');
  assert(tuboPopulation >= 650000 && tuboPopulation <= 900000, `${label} Tubo plateau population out of band: ${tuboPopulation}`);
  for (const id of ['div_1781355155816_8574', 'div_1781355214960_3469']) {
    const region = byId.get(id);
    assert(region.population <= 50000, `${label} ${region.name} still has stale high Western Xia population`);
    assert((region.byEthnicity || {})['吐蕃'] >= 0.5, `${label} ${region.name} should be Tibetan-led after correction`);
    assert(fiscalTotal(region) <= 9000, `${label} ${region.name} still has stale high fiscal data`);
  }

  for (const region of [zhongxing, lingyan, steppeIsland, hejian, daivietCapital, byId.get('div_1781355155816_8574'), byId.get('div_1781355214960_3469')]) {
    const admin = adminByRegionId.get(region.id);
    assert(admin, `${label} adminHierarchy missing ${region.name}`);
    assert(admin.populationDetail?.mouths === region.population, `${label} adminHierarchy population stale for ${region.name}`);
    assert(fiscalTotal(admin) === fiscalTotal(region), `${label} adminHierarchy fiscal stale for ${region.name}`);
    assert(Object.keys(admin.byEthnicity || {}).join('/') === Object.keys(region.byEthnicity || {}).join('/'), `${label} adminHierarchy ethnicity stale for ${region.name}`);
    assert(Number(admin.militaryDetail?.availableRecruits) === Number(region.militaryRecruits), `${label} adminHierarchy recruit source stale for ${region.name}`);
  }

  console.log(`[smoke-shaosong-target-map-regions] ok ${label}: ${scenarioPath}`);
}

checkScenario('182区草案');
const official = JSON.parse(fs.readFileSync(findScenarioFile('官方'), 'utf8'));
if (official.map.id === 'shaosong-1127-182') checkScenario('官方');
else {
  assert(official.map.id === 'shaosong-three-tiers-r6', 'unexpected official map revision');
  assert(official.map.regions.length === 566, 'R6 must retain all 566 regions');
  assert(JSON.stringify(official.map) === JSON.stringify(official.mapData), 'canonical map mirrors differ');
  assert(official.characters.length === 501 && official.military.initialTroops.length === 100, 'original character/army roster lost');
  const regions = new Set(official.map.regions.map(r => r.id));
  assert(regions.size === 566, 'duplicate region ID');
  const accounts = new Set();
  function walk(v) { if (!v || typeof v !== 'object') return; if (v.id) accounts.add(v.id); for (const x of Object.values(v)) if (x && typeof x === 'object') walk(x); }
  walk(official.adminHierarchy);
  for (const region of official.map.regions) {
    assert(region.accountingLeafIds && region.accountingLeafIds.length, region.id + ' lacks accounting lineage');
    for (const id of region.accountingLeafIds) assert(accounts.has(id), region.id + ' points to missing account ' + id);
    assert(Number.isFinite(region.population) && region.population >= 0, region.id + ' invalid population');
  }
  assert(official.map.locationBindingContract.schema === 'source-text-location-v2', 'missing live location contract');
  for (const entity of [...official.characters, ...official.military.initialTroops]) {
    if (entity.regionId) assert(regions.has(entity.regionId), 'entity points to missing region: ' + entity.name);
  }
  console.log('[smoke-shaosong-target-map-regions] official R6: all regions, accounts, rosters and location bindings PASS');
}
