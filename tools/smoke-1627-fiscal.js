// Smoke: 1627 剧本财政三处修复
//   T1 fc.taxes 显式定义 → cascade 不再用 DEFAULT_TAXES (避免田赋三重计 land_grain+land_silver+head_tax)
//   T2 customTaxes.junhu 改 flat amount=350000 (避免 perMu × 5.67亿亩 爆出 2268 万两)
//   T3 treasury 银/粮 与备注一致 (85 万两 / 1300 万石)
//   T4 数学验证：以 16 省合计 5.67亿亩 + 6000万口 + 1800万丁 推算年化总额 → 应在史实 1500-1800万两区间

const fs = require('fs');
const path = require('path');

const sc = fs.readFileSync(path.join(__dirname, '..', 'scenarios', 'tianqi7-1627.js'), 'utf8');
const cascade = fs.readFileSync(path.join(__dirname, '..', 'tm-fiscal-cascade.js'), 'utf8');

// === T1 fc.taxes 显式数组 ===
function testTaxesArray() {
  const taxesIdx = sc.search(/\btaxes:\s*\[/);
  const customIdx = sc.indexOf('customTaxes:');
  const block = (taxesIdx > 0 && customIdx > taxesIdx) ? sc.slice(taxesIdx, customIdx) : '';
  const hasLandSilver = /id:\s*'land_silver'/.test(block);
  const hasCaoliang = /id:\s*'caoliang'/.test(block);
  const hasSaltIron = /id:\s*'salt_iron'/.test(block);
  const hasTaxes = hasLandSilver && hasCaoliang && hasSaltIron;
  const noHeadTax = !/\bid:\s*'head_tax'/.test(sc);
  const noCorvee = !/\bid:\s*'corvee_cloth'/.test(sc);
  console.log('[T1a] fc.taxes 含 land_silver/caoliang/salt_iron 三项:', hasTaxes ? 'OK' : 'FAIL');
  console.log('[T1b] 不含 head_tax (一条鞭法已折入):', noHeadTax ? 'OK' : 'FAIL');
  console.log('[T1c] 不含 corvee_cloth (鞭法后废布):', noCorvee ? 'OK' : 'FAIL');
  // cascade 行为：fc.taxes.length>0 时不用 DEFAULT_TAXES
  const cascadeRoute = /var\s+taxes\s*=\s*\(fc\.taxes\s*&&\s*fc\.taxes\.length\s*>\s*0\)\s*\?\s*fc\.taxes\.slice\(\)\s*:\s*DEFAULT_TAXES\.slice\(\)/.test(cascade);
  console.log('[T1d] cascade 优先 fc.taxes 路径仍生效:', cascadeRoute ? 'OK' : 'FAIL');
  return hasTaxes && noHeadTax && noCorvee && cascadeRoute;
}

// === T2 军户屯田 flat 修复 ===
function testJunhuFlat() {
  const flatJunhu = /\{\s*id:\s*'junhu'[\s\S]{0,200}formulaType:\s*'flat'[\s\S]{0,80}amount:\s*350000/.test(sc);
  const noPerMuJunhu = !/id:\s*'junhu'[\s\S]{0,200}formulaType:\s*'perMu'/.test(sc);
  console.log('[T2a] junhu formulaType=flat amount=350000:', flatJunhu ? 'OK' : 'FAIL');
  console.log('[T2b] 旧 perMu 模式已移除:', noPerMuJunhu ? 'OK' : 'FAIL');
  return flatJunhu && noPerMuJunhu;
}

// === T3 太仓初值修复 ===
function testTreasuryFix() {
  // factions[0].treasury（势力卡片显示用）
  const moneyFix = /treasury:\s*\{\s*money:\s*850000\b/.test(sc);
  const grainFix = /treasury:\s*\{\s*money:\s*850000\s*,\s*grain:\s*13000000\b/.test(sc);
  console.log('[T3a] factions[0].treasury.money = 850000:', moneyFix ? 'OK' : 'FAIL');
  console.log('[T3b] factions[0].treasury.grain = 13000000:', grainFix ? 'OK' : 'FAIL');

  // ★ 关键：顶层 sc.guoku（GuokuEngine.initFromDynasty 实际读这里→GM.guoku.balance/ledgers.stock）
  const scGuokuIdx = sc.indexOf('\n      guoku: {');
  const block = scGuokuIdx > 0 ? sc.slice(scGuokuIdx, scGuokuIdx + 2000) : '';
  const initialMoney = /initialMoney:\s*850000\b/.test(block);
  const initialGrain = /initialGrain:\s*13000000\b/.test(block);
  const initialCloth = /initialCloth:\s*500000\b/.test(block);
  console.log('[T3c] sc.guoku.initialMoney = 850000 (流入 GM.guoku.balance):', initialMoney ? 'OK' : 'FAIL');
  console.log('[T3d] sc.guoku.initialGrain = 13000000 (流入 GM.guoku.ledgers.grain.stock):', initialGrain ? 'OK' : 'FAIL');
  console.log('[T3e] sc.guoku.initialCloth = 500000:', initialCloth ? 'OK' : 'FAIL');

  return moneyFix && grainFix && initialMoney && initialGrain && initialCloth;
}

// === T6 cache-bust 已更新 ===
function testCacheBust() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const bumped = /tianqi7-1627\.js\?v=2026042821/.test(html);
  console.log('[T6] index.html scenario cache-bust = v=2026042821:', bumped ? 'OK' : 'FAIL');
  return bumped;
}

// === T7 数据流路径完整 ===
function testDataFlowComplete() {
  // GuokuEngine.initFromDynasty 读 sc.guoku
  const guokuEng = fs.readFileSync(path.join(__dirname, '..', 'tm-guoku-engine.js'), 'utf8');
  const readsScGuoku = /scenarioOverride\.guoku/.test(guokuEng) && /go\.initialMoney/.test(guokuEng);
  console.log('[T7a] GuokuEngine.initFromDynasty 读 sc.guoku.initialMoney:', readsScGuoku ? 'OK' : 'FAIL');

  // cascade collect 读 sc.fiscalConfig.taxes
  const cascadeReads = /var\s+fc\s*=\s*\(sc\s*&&\s*sc\.fiscalConfig\)/.test(cascade) && /\bfc\.taxes\b/.test(cascade);
  console.log('[T7b] CascadeTax.collect 读 sc.fiscalConfig.taxes:', cascadeReads ? 'OK' : 'FAIL');

  // enterGame 调 GuokuEngine.initFromDynasty 和 CascadeTax.collect
  const gameLoop = fs.readFileSync(path.join(__dirname, '..', 'tm-game-loop.js'), 'utf8');
  const callsInit = /GuokuEngine\.initFromDynasty\([^)]*sc\d?[^)]*\)/.test(gameLoop);
  const callsCollect = /CascadeTax\.collect\(\)/.test(gameLoop);
  console.log('[T7c] enterGame 调 GuokuEngine.initFromDynasty:', callsInit ? 'OK' : 'FAIL');
  console.log('[T7d] enterGame 调 CascadeTax.collect:', callsCollect ? 'OK' : 'FAIL');

  return readsScGuoku && cascadeReads && callsInit && callsCollect;
}

// === T4 年化数学验证 ===
function testAnnualMath() {
  const arable = 566630000;     // 16 省合计 5.67亿亩
  const mouths = 60000000;      // 6000 万口
  const ding = 18000000;        // 1800 万丁

  // fc.taxes 三项年额
  const landSilver = arable * 1 * 0.014;          // 794 万两
  const caoliang = arable * 0.3 * 0.024;          // 408 万石
  const saltIron = mouths * 0.04 * 1.0;           // 240 万两

  // customTaxes 五项年额(实收·已扣 occupation)
  const liaoxiang = arable * 0.009 * (1 - 0);     // 510 万两
  const chama = 300000 * (1 - 0.6);               // 12 万两
  const chaoguan = 1200000 * (1 - 0.5);           // 60 万两
  const guanshui = 80000 * (1 - 0.5);             // 4 万两
  const junhu = 350000;                            // 35 万两 (flat)

  const totalSilver = landSilver + saltIron + liaoxiang + chama + chaoguan + guanshui + junhu;
  const totalGrain = caoliang;

  // 史实区间：白银 1500-1800 万两/年, 粮 ~400 万石/年
  const silverInRange = totalSilver >= 12000000 && totalSilver <= 19000000;
  const grainInRange = totalGrain >= 3500000 && totalGrain <= 4500000;

  console.log('[T4a] 年化白银总额 = ' + Math.round(totalSilver/10000) + ' 万两 (期望 1200-1900 万):', silverInRange ? 'OK' : 'FAIL');
  console.log('[T4b] 年化漕粮 = ' + Math.round(totalGrain/10000) + ' 万石 (期望 350-450 万):', grainInRange ? 'OK' : 'FAIL');
  // 一回合 (30 天) 折算
  const turnFrac = 30 / 365;
  console.log('[T4c] 一回合(30天)·中央实收上限 = ' + Math.round(totalSilver*turnFrac/10000) + ' 万两 + ' + Math.round(totalGrain*turnFrac/10000) + ' 万石 (cascade 实算还会扣 qiyun/侵占/transit)');
  return silverInRange && grainInRange;
}

// === T5 customTaxes 其他四项未动 ===
function testOtherCustomTaxes() {
  const liao = /id:\s*'liaoxiang'[\s\S]{0,200}nominalRate:\s*0\.009/.test(sc);
  const cha = /id:\s*'chama'[\s\S]{0,200}amount:\s*300000/.test(sc);
  const guan = /id:\s*'chaoguan'[\s\S]{0,200}amount:\s*1200000/.test(sc);
  const yue = /id:\s*'guanshui'[\s\S]{0,200}amount:\s*80000/.test(sc);
  console.log('[T5] 其他 customTaxes 未误改: liao=' + (liao?'OK':'FAIL') + ' chama=' + (cha?'OK':'FAIL') + ' chaoguan=' + (guan?'OK':'FAIL') + ' yuegang=' + (yue?'OK':'FAIL'));
  return liao && cha && guan && yue;
}

(function() {
  const r1 = testTaxesArray();
  const r2 = testJunhuFlat();
  const r3 = testTreasuryFix();
  const r4 = testAnnualMath();
  const r5 = testOtherCustomTaxes();
  const r6 = testCacheBust();
  const r7 = testDataFlowComplete();
  const all = r1 && r2 && r3 && r4 && r5 && r6 && r7;
  console.log('\n=== ' + (all ? 'ALL PASS' : 'FAIL') + ' ===');
  process.exit(all ? 0 : 1);
})();
