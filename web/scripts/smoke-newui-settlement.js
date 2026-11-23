#!/usr/bin/env node
// 新界面舆图的聚落等第（web/ui/model/settlement.js）：繁华分、分档与回差、样子（城郭/帐幕/山寨）、残破进出、村舍疏密、市镇与港。
// 模块是 ES 模块，拷成 .mjs 再 import（CI 上的 Node 版本不论认不认得出 ES 写法都能跑）。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.resolve(__dirname, '..', 'ui', 'model', 'settlement.js');
let passed = 0;
function check(cond, msg) {
  if (!cond) throw new Error('[smoke-newui-settlement] FAIL ' + msg);
  passed++;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-settle-'));
  const tmp = path.join(dir, 'settlement.mjs');
  fs.copyFileSync(SRC, tmp);
  const m = await import(pathToFileURL(tmp).href);
  try {
    // 繁华分：0～100，繁荣、商贸、户口各自往上推它
    const base = { prosperity: 47, commerce: 2e5, mouths: 2.4e5 };
    const s0 = m.prosperityScore(base);
    check(s0 > 40 && s0 < 55, `天启中位那样的府州分在中段：${s0}`);
    check(m.prosperityScore({ ...base, prosperity: 80 }) > s0, '繁荣高了分高');
    check(m.prosperityScore({ ...base, commerce: 2e7 }) > s0, '商贸多了分高');
    check(m.prosperityScore({ ...base, mouths: 3e6 }) > s0, '户口多了分高');
    check(m.prosperityScore({}) === 0, '什么数都没有记零');
    check(m.prosperityScore({ prosperity: 100, commerce: 1e9, mouths: 1e9 }) === 100, '满了封顶一百');

    // 分档：线 36、56、76；没有上回的照分数直接定
    const L = [36, 56, 76];
    check(m.tierOf(30, L) === 0 && m.tierOf(40, L) === 1 && m.tierOf(60, L) === 2 && m.tierOf(80, L) === 3, '无上回照分数定档');
    // 回差四分：刚过线不升，越过一截才升；刚跌破不降，跌过一截才降
    check(m.tierOf(57, L, 1) === 1, '府城刚过大府线一分不升');
    check(m.tierOf(60, L, 1) === 2, '府城越过大府线四分升大府');
    check(m.tierOf(55, L, 2) === 2, '大府刚跌破线一分不降');
    check(m.tierOf(51, L, 2) === 1, '大府跌过线四分以上降府城');
    check(m.tierOf(90, L, 0) === 3, '小城一回涨到很高，直接到都会');
    check(m.tierOf(10, L, 3) === 0, '都会一回跌到很低，直接到小城');
    // 来回微动：在线上下两分晃，档不变
    let t = m.tierOf(58, L, null);
    for (const v of [55, 58, 54.5, 57, 55]) t = m.tierOf(v, L, t);
    check(t === 2, `线边上晃来晃去档不动（${t}）`);

    // 样子
    check(m.styleOf({ kind: '直辖政区', terrain: '水乡', factionType: '主权国' }) === 'city', '江南直辖政区画城郭');
    check(m.styleOf({ kind: '政区', terrain: '草原', factionType: '部落' }) === 'nomad', '草原上的政区画帐幕');
    check(m.styleOf({ kind: '牧地', terrain: '丘陵', factionType: '游牧' }) === 'nomad', '牧地画帐幕');
    check(m.styleOf({ kind: '土司辖地', terrain: '山地', factionType: '主权国' }) === 'tribal', '土司辖地画山寨');
    check(m.styleOf({ kind: '政区', terrain: '林地', factionType: '边外部落联盟' }) === 'tribal', '林海里的部落联盟画山寨');
    check(m.styleOf({ kind: '政区', terrain: '绿洲', factionType: '汗国' }) === 'city', '绿洲汗国是城');
    check(m.styleOf({ kind: '城', terrain: '平原', factionType: '游牧' }) === 'city', '剧本记作城的就是城');
    check(m.styleOf({ kind: '直辖政区', terrain: '边塞', factionType: '部落' }) === 'city', '汉地的城被部落占了，城还是城');
    check(m.styleOf({ kind: '军政或羁縻战略地块', terrain: '草原', factionType: '主权国' }) === 'city', '草原上的军镇是城');

    // 残破：繁荣跌破十四进，回到十八以上才出；京城不画残破；天灾兵燹砍去一半也算
    const poor = { prosperity: 11, commerce: 3e4, mouths: 6e5, kind: '直辖政区', terrain: '高原', factionType: '主权国' };
    const r1 = m.settlementOf(poor, null);
    check(r1.ruined && r1.style === 'city', '陕北那样繁荣十一的府州是残城');
    const r2 = m.settlementOf({ ...poor, prosperity: 16 }, r1);
    check(r2.ruined, '残城回到十六还算残城（回差）');
    const r3 = m.settlementOf({ ...poor, prosperity: 19 }, r2);
    check(!r3.ruined, '回到十九复起');
    check(!m.settlementOf({ ...poor, prosperity: 16 }, null).ruined, '没残过的府州繁荣十六不算残');
    check(!m.settlementOf({ ...poor, capital: true }, null).ruined, '京城不画残破');
    check(m.settlementOf({ ...poor, prosperity: 60, damage: 0.6 }, null).ruined, '耕地商贸被砍去六成算残');
    check(!m.settlementOf({ prosperity: 10, kind: '牧地', terrain: '草原' }, null).ruined, '帐幕不画残破');
    // 换了样子（比如剧本改了地块类别）不拿旧档作回差
    const camp = m.settlementOf({ prosperity: 50, commerce: 1e5, mouths: 1e5, kind: '牧地' }, { style: 'city', tier: 3, ruined: false });
    check(camp.style === 'nomad' && camp.tier === m.tierOf(camp.score, [40]), '样子变了按新样子重定档');

    // 市镇、港：商贸二百万、六百万、两千万各添一处市镇；一百万以上够设港；残城不设
    const rich = { prosperity: 80, commerce: 3e7, mouths: 2e6, kind: '直辖政区', terrain: '水乡' };
    const rr = m.settlementOf(rich, null);
    check(rr.tier === 3 && rr.markets === 3 && rr.port, `苏州那样的府州是都会、三处市镇、可设港（${JSON.stringify(rr)}）`);
    check(m.settlementOf({ ...rich, commerce: 3e6 }, null).markets === 1, '商贸三百万一处市镇');
    check(m.settlementOf({ ...rich, commerce: 5e5 }, null).port === false, '商贸五十万不设港');
    check(m.settlementOf({ ...rich, prosperity: 10, damage: 0.9 }, null).markets === 0, '残城不设市镇');

    // 村舍疏密：户口密度越大越密，有上下限；没有面积或户口给 0.5
    const v1 = m.villageFactor(3e4, 1000), v2 = m.villageFactor(3e5, 1000), v3 = m.villageFactor(3e6, 1000);
    check(v1 < v2 && v2 < v3, `密度大村舍密：${v1.toFixed(2)} < ${v2.toFixed(2)} < ${v3.toFixed(2)}`);
    check(m.villageFactor(1, 1e6) === 0.1 && m.villageFactor(1e9, 1) === 1.6, '疏密有上下限');
    check(m.villageFactor(0, 100) === 0.5 && m.villageFactor(100, 0) === 0.5, '缺数给中间值');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[smoke-newui-settlement] pass assertions=${passed}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
