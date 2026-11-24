#!/usr/bin/env node
// 新界面舆图的聚落等第（web/ui/model/settlement.js）：繁华分、分档与回差、样子（城郭/帐幕/山寨）、地域（日本按年份、朝鲜、大越、南洋、西洋据点）、残破进出、村舍疏密、市镇与港。
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

    // 地域（三部官方剧本里的写法）：日本按年份分有没有天守；法理所属定样子，此刻谁占着不算；中原照旧
    const cu = m.cultureOf;
    check(cu({ dejure: '德川幕府', regionType: 'foreign_shogunate', kind: '城下', year: 1627 }) === 'japan', '天启的江户：城下町');
    check(cu({ dejure: '德川幕府下诸藩', regionType: 'foreign_shogunate', kind: '国', year: 1627 }) === 'japan', '天启四国诸藩：城下町');
    check(cu({ dejure: '虾夷地诸部', regionType: 'frontier_trade_zone', kind: '城下', year: 1627 }) === 'japan', '松前氏的城下');
    check(cu({ dejure: '虾夷地诸部', regionType: 'frontier_trade_zone', kind: '港', year: 1627 }) === 'japan', '箱馆、江差两港');
    check(cu({ dejure: '日本', regionType: '令制国', kind: '', year: 840 }) === 'japanOld', '晚唐的平安京：不筑天守');
    check(cu({ dejure: '日本', regionType: 'normal', kind: '国', year: 1127 }) === 'japanOld', '绍宋的日本诸国：不筑天守');
    check(cu({ dejure: '日本', year: 1580 }) === 'japan' && cu({ dejure: '日本', year: 1579 }) === 'japanOld', '安土城（一五七九）为界');
    check(cu({ dejure: '朝鲜', regionType: 'fanbang', kind: '道', year: 1627 }) === 'korea', '天启朝鲜八道');
    check(cu({ dejure: '高丽', regionType: 'normal', kind: '京', year: 1127 }) === 'korea', '绍宋高丽');
    check(cu({ dejure: '新罗', kind: '州', year: 840 }) === 'korea', '晚唐新罗');
    check(cu({ dejure: '渤海', kind: '府', year: 840 }) === null, '渤海照中原');
    check(cu({ dejure: '明朝廷', regionType: 'frontier_defense', kind: '镇', year: 1627 }) === null, '明朝的城照中原');
    check(cu({ dejure: '后金', regionType: 'banner_core', kind: '城', year: 1627 }) === null, '后金照中原');
    check(cu({}) === null, '什么都没有照中原');
    check(cu({ dejure: '大越', regionType: 'foreign_kingdom_split', divisionType: '京', year: 1627 }) === 'viet', '天启的升龙');
    check(cu({ dejure: '大越李朝', divisionType: '京', year: 1127 }) === 'viet', '绍宋的大越李朝');
    check(cu({ dejure: '大越', divisionType: '府', name: '占城旧地', year: 1627 }) === 'seasia', '占城旧地画占婆那一路');
    check(cu({ dejure: '蒲甘王朝', divisionType: '都城', year: 1127 }) === 'seasia' && cu({ dejure: '骠国', year: 840 }) === 'seasia' && cu({ dejure: '环王', year: 840 }) === 'seasia', '蒲甘、骠国、环王');
    check(cu({ dejure: '西班牙·马尼拉', regionType: 'colonial_governorate', divisionType: '城', year: 1627 }) === 'west', '马尼拉');
    check(cu({ dejure: '葡萄牙·澳门', divisionType: '城', year: 1627 }) === 'west' && cu({ dejure: '荷兰·台海(东印度公司)', divisionType: '城', year: 1627 }) === 'west', '澳门、大员');
    check(cu({ dejure: '', regionType: 'leased_port', year: 1627 }) === 'west', '澳门：上一级只记了租借港');
    check(cu({ dejure: '唐朝廷', name: '安南都护府', year: 840 }) === null && cu({ dejure: '南诏', year: 840 }) === null, '唐的安南、南诏照中原');
    check(m.styleOf({ kind: '政区', terrain: '平原', factionType: '公司', divisionType: '社' }) === 'tribal', '台湾的番社画山寨');
    // 游戏里读到的样子：剧本政区类别只写「政区」，区划自己记「城下」「港」；所属是部落联盟（松前氏）也认得是城
    check(m.styleOf({ kind: '政区', terrain: '沿海', factionType: '部落联盟', divisionType: '城下' }) === 'city', '松前氏的城下是城');
    check(m.styleOf({ kind: '政区', terrain: '沿海', factionType: '部落联盟', divisionType: '港' }) === 'city', '箱馆、江差是港');
    check(m.styleOf({ kind: '政区', terrain: '沿海', factionType: '部落联盟', divisionType: '部' }) === 'tribal', '虾夷各部照旧画山寨');
    check(cu({ dejure: '德川幕府', regionType: 'foreign_shogunate', kind: '政区', divisionType: '城下', year: 1627 }) === 'japan', '政区类别只写政区，看区划类别');
    check(cu({ dejure: '', regionType: '', kind: '政区', divisionType: '城下', year: 1627 }) === 'japan', '法理所属没读到，城下二字也认得');
    const ownerChanged = m.settlementOf({ prosperity: 60, commerce: 3e6, mouths: 5e5, kind: '城下', terrain: '平原', factionType: '主权国', dejure: '德川幕府', year: 1627 });
    check(ownerChanged.style === 'city' && ownerChanged.culture === 'japan', `别国占着的日本城下町还是城下町（${JSON.stringify(ownerChanged)}）`);
    const koCamp = m.settlementOf({ prosperity: 50, kind: '牧地', terrain: '草原', dejure: '朝鲜', year: 1627 });
    check(koCamp.style === 'nomad' && koCamp.culture === null, '帐幕、山寨不分地域');

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

    // 营造地标：按名字归类（三部官方剧本的营造类型名，加几个易混的），认不出看类别，都认不出不画
    const KIND = {
      书院: 'academy', '文庙·学宫': 'academy', 贡院: 'academy', 学校: 'academy',
      城隍庙: 'shrine', 关帝庙: 'shrine', '宗祠·祠堂': 'shrine', 生祠: 'shrine', 道观: 'shrine', 清真寺: 'shrine', 礼拜寺: 'shrine', 妈祖庙: 'shrine',
      天主堂: 'church', 教堂: 'church', 礼拜堂: 'church',
      佛寺: 'temple', 观音寺: 'temple', 寺院救济所: 'temple',
      '箭楼·敌台': 'fort', 城墙: 'fort', '长城·关隘': 'fort', 关城: 'fort', 卫所: 'fort', '边镇·总兵府': 'fort', 水寨: 'fort',
      烽火台: 'beacon', 烽候: 'beacon', 巡检司: 'beacon',
      钞关: 'market', 会馆: 'market', '街市·商铺街区': 'market', 坊市设施: 'market',
      市舶司: 'port', 漕运码头: 'port', 渡津: 'port', 港埠: 'port',
      海塘: 'waterworks', '水利·河工': 'waterworks', 堰渠: 'waterworks',
      '漕仓·京通十三仓': 'granary', '府仓·官仓': 'granary', 仓廪: 'granary',
      织造局: 'workshop', '盐场·盐课提举司': 'workshop', 盐灶: 'workshop', 军械作坊: 'workshop',
      驿站: 'relay', 驿舍: 'relay', 养马场: 'relay', '石桥·拱桥': 'bridge',
      '府衙·县衙': 'yamen', '巡抚衙门·总督府': 'yamen', 文书库: 'yamen'
    };
    const wrong = Object.entries(KIND).filter(([name, k]) => m.landmarkOf({ name }) !== k).map(([name, k]) => `${name}→${m.landmarkOf({ name })}（应 ${k}）`);
    check(!wrong.length, `营造按名字归类：${wrong.join('；')}`);
    check(m.landmarkOf({ name: '劝农亭', category: 'administrative' }) === 'yamen', '名字认不出看类别');
    check(m.landmarkOf({ name: '药舍', category: 'social' }) === null && m.landmarkOf({ name: '奇物' }) === null, '都认不出不画');

    // 一处的营造：同样的只画一座；建成的至多四样，在建另画脚手架、半损另画残垣；失修照画；港、市不画地标
    const B = (name, status = 'completed') => ({ name, status });
    const w1 = m.worksOf([B('书院'), B('府学'), B('城墙', 'neglected'), B('佛寺'), B('常平仓'), B('织造局'), B('驿站', 'building'), B('烽火台', 'damaged'), B('市舶司'), B('钞关'), B('会馆')]);
    check(JSON.stringify(w1.landmarks) === JSON.stringify(['academy', 'fort', 'temple', 'granary', 'scaffold', 'ruin']), `地标：${JSON.stringify(w1.landmarks)}`);
    check(w1.port === true && w1.markets === 2, `建成的港、市：${JSON.stringify(w1)}`);
    check(m.worksOf([B('市舶司', 'building')]).port === false, '在建的港不算港');
    check(JSON.stringify(m.worksOf([B('药舍', 'building')]).landmarks) === '["scaffold"]', '认不出是什么的在建也画脚手架');
    check(m.worksOf(null).landmarks.length === 0 && m.worksOf([null]).landmarks.length === 0, '没有营造不画');

    // 接进聚落：建了港，商贸不够也设港（portBuilt）；残城不设；市镇连商贸带营造至多三处；帐幕之地建了互市也有市镇
    const poorPort = m.settlementOf({ ...base, commerce: 5e5, kind: '直辖政区', buildings: [B('市舶司')] }, null);
    check(poorPort.port && poorPort.portBuilt, '商贸五十万建了市舶司也设港');
    check(!m.settlementOf({ ...poor, buildings: [B('市舶司'), B('钞关')] }, null).port, '残城建过港也不设');
    check(m.settlementOf({ ...poor, buildings: [B('钞关')] }, null).markets === 0, '残城建过钞关也不设市镇');
    check(m.settlementOf({ ...rich, buildings: [B('钞关'), B('会馆')] }, null).markets === 3, '市镇至多三处');
    check(m.settlementOf({ ...rich, commerce: 3e6, buildings: [B('钞关')] }, null).markets === 2, '商贸一处加钞关一处');
    check(m.settlementOf({ prosperity: 40, kind: '牧地', terrain: '草原', buildings: [B('互市')] }, null).markets === 1, '草原建了互市有市镇');
    const withWorks = m.settlementOf({ ...poor, buildings: [B('书院'), B('城墙', 'building')] }, null);
    check(withWorks.ruined && JSON.stringify(withWorks.landmarks) === '["academy","scaffold"]', '残城里建了的照画地标');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[smoke-newui-settlement] pass assertions=${passed}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
