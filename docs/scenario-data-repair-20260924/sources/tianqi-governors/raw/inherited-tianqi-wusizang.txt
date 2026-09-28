// 天启剧本·乌思藏都指挥使司 6 块（羁縻）
//
// 天启七年的卫藏：第悉藏巴噶玛丹迥旺布（1620 年起）以日喀则桑珠孜为都，统有后藏并兼前藏大半，崇奉噶玛噶举；
// 格鲁派据拉萨三大寺，五世达赖年方十岁，居哲蚌寺，四世班禅驻扎什伦布居中调停；天启元年蒙古兵入藏助格鲁收回寺产，
// 双方积怨未解。山南帕竹政权已衰；阿里为古格王国，天启四年西洋耶稣会士安夺德入其都城传教。明廷只以册封诸法王羁縻。
// 本省没有州县户口可据，剧本也没写经济底账（这一项不分）。权重按河谷农区与牧区的轻重估：
//   拉萨、日喀则两处河谷人口与寺院最盛，山南、江孜次之；藏北牧区与阿里地广人稀。
// 各块沿用省里的征到比例与截留率（羁縻之地的账不按「应征×(1−截留率)」相扣）。
// 地图上名为「乌思藏本部地域」的一块在念青唐古拉山以北，写作藏北牧区；叶子名沿用剧本原名不改。
// 剧本地块层「税压」原值为 100，读数上限 99，重分后为 99。
'use strict';

const { block } = require('./lib-blocks');

const unit = (name, mouths, grain, land) => ({ name, weights: { pop: mouths, households: mouths, grain, land } });

const UNITS = [
  unit('乌思藏都指挥使司', 200000, 4, 2),
  unit('拉萨城', 450000, 25, 25),
  unit('日喀则宗', 400000, 25, 25),
  unit('江孜宗', 250000, 18, 20),
  unit('山南诸宗', 300000, 20, 20),
  unit('阿里三围', 200000, 8, 8)
];
UNITS.forEach((u) => { u.basis = '按河谷农区与牧区的人口轻重估，无册籍可据。'; });

const BLOCKS = {
  乌思藏都指挥使司: block({
    name: '乌思藏都指挥使司', terrain: '高原', divisionType: '部', regionType: 'jimi', officialPosition: '头人',
    specialResources: '牦牛·羊毛·湖盐', tags: {},
    description: '念青唐古拉山以北的羌塘高原，那曲一带草场辽阔，诸部游牧为生，牛羊、酥油与盐湖之利为主；地广人稀，冬春多雪灾。',
    commerce: 0.6, fishing: 0, corridor: 0.8, keju: 0, hide: 1.2,
    idx: [56, 48, 18, 18, 72, 99, 60, 70], fisc: [0.15, 0.30],
    notes: '地图名「乌思藏本部地域」，实为藏北牧区。'
  }),
  拉萨城: block({
    name: '拉萨城', terrain: '河谷', divisionType: '城', regionType: 'jimi', officialPosition: '第巴',
    specialResources: '青稞·氆氇·藏香', tags: {},
    description: '吉曲河谷中的圣城，大昭寺为全藏朝礼之地，哲蚌、色拉、甘丹三大寺环列，格鲁派僧众云集，五世达赖幼年居于哲蚌寺。藏巴汗与格鲁派积怨已深，天启元年蒙古兵入藏，助格鲁派收回寺产，前藏局势至今未稳。',
    commerce: 1.6, fishing: 0, corridor: 1.3, keju: 0,
    idx: [52, 50, 34, 34, 82, 99, 75, 76], fisc: [0.15, 0.30],
    notes: '五世达赖生于万历四十五年（1617）。'
  }),
  日喀则宗: block({
    name: '日喀则宗', terrain: '河谷', divisionType: '宗', regionType: 'jimi', officialPosition: '第悉藏巴',
    specialResources: '青稞·氆氇·金银器', tags: {},
    description: '年楚河与雅鲁藏布江交汇处，第悉藏巴噶玛丹迥旺布以桑珠孜宗堡为都，统有后藏并兼前藏大半，崇奉噶玛噶举；四世班禅驻扎什伦布寺，居中调停诸派。',
    commerce: 1.4, fishing: 0, corridor: 1.2, keju: 0,
    idx: [56, 50, 32, 32, 74, 99, 72, 74], fisc: [0.15, 0.30],
    notes: '藏巴汗政权（1618 年据有前藏）。'
  }),
  江孜宗: block({
    name: '江孜宗', terrain: '河谷', divisionType: '宗', regionType: 'jimi', officialPosition: '宗本',
    specialResources: '青稞·卡垫·羊毛', tags: {},
    description: '年楚河上游的宗堡，白居寺十万佛塔闻名全藏；南通帕里、竹巴的商道经此，归藏巴汗统辖。',
    commerce: 1.1, fishing: 0, corridor: 1.1, keju: 0,
    idx: [56, 50, 28, 28, 72, 99, 66, 72], fisc: [0.15, 0.30],
    notes: '白居寺。'
  }),
  山南诸宗: block({
    name: '山南诸宗', terrain: '河谷', divisionType: '宗', regionType: 'jimi', officialPosition: '宗本',
    specialResources: '青稞·氆氇·木材', tags: {},
    description: '雅砻河谷是吐蕃发祥之地，桑耶寺、昌珠寺在焉；帕木竹巴旧都乃东、泽当已衰，明廷册封的阐化王名号犹存，实权归于藏巴汗。',
    commerce: 1.0, fishing: 0, corridor: 1.0, keju: 0,
    idx: [54, 50, 26, 26, 76, 99, 70, 74], fisc: [0.15, 0.30],
    notes: '帕竹政权万历四十六年后失势。'
  }),
  阿里三围: block({
    name: '阿里三围', terrain: '高原', divisionType: '王国', regionType: 'jimi', officialPosition: '古格王',
    specialResources: '羊绒·湖盐·黄金', tags: {},
    description: '西部高原的古格王国据札布让为都，托林寺为佛法重地；天启四年西洋耶稣会士安夺德来此传教，得国王礼遇，引起僧侣不满；西邻拉达克虎视眈眈。',
    commerce: 0.8, fishing: 0, corridor: 0.7, keju: 0, hide: 1.2,
    idx: [56, 48, 20, 20, 74, 99, 66, 72], fisc: [0.15, 0.30],
    notes: '安夺德（António de Andrade）天启四年抵札布让。'
  })
};

const regionMeans = { development: 25, unrest: 76, taxPressure: 100, armyPressure: 70, officeRisk: 74 };

module.exports = { province: '乌思藏都指挥使司', UNITS, BLOCKS, regionMeans, fiscalRates: 'province' };
