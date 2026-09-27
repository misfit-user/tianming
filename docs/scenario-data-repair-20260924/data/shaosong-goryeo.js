// 绍宋·高丽 11 块（外藩）：分路框架与逐块数据。
// 户数权重：《高丽史·地理志》（卷五十六至五十八）无户口，逐一列了各界首官（京、牧、都护府、州）与所领郡县镇。
//   把各界首官治所按今地经纬度落到地图上（tools/locate-points.js），每块权重 = 所含界首官数 + 所领郡县镇数。
//   咸州大都督府、北青州、甲州府与北界江界府、泥城府为恭愍王以后收复或新置，不计；
//   地图「东界」块在定州关门以北，睿宗四年（1109）九城已还女真，志中无郡县，按东女真诸部估三县。
//   势力全国合计不动。
'use strict';

const { foreignTree, block } = require('./shaosong-foreign');

const GS = '《高丽史·地理志》';
const LEAVES = {
  开京: { households: 37, economy: 'farm', commerceFactor: 1.5, basis: GS + '王京开城府及畿县 14，江华县 4，西海道海州 4、瓮津 3、平州 2、白翎镇 1，交州道东州 9，共 37' },
  西京: { households: 36, economy: 'farm', basis: GS + '西京留守官及属县 5，安北大都护府宁州 1 与其南部诸州县 19，西海道丰州 7、黄州 4，共 36' },
  西北界: { households: 25, economy: 'mixed', basis: GS + '北界鸭绿江下游义、静、麟、龙、铁、宣、郭、龟、泰、朔、昌、云、灵十三州与宁德等十二镇，共 25' },
  南京汉阳: { households: 20, economy: 'farm', basis: GS + '南京留守官杨州 10、安南都护府树州 7、仁州 3，共 20' },
  广州高丽: { households: 48, economy: 'farm', basis: GS + '广州牧 8、水州 8、原州 8、天安府 9、富城县 3，交州道春州 12，共 48' },
  尚州: { households: 73, economy: 'farm', basis: GS + '尚州牧 25、京山府 16、安东府 15，杨广道忠州牧 7、清州牧 10，共 73' },
  庆州高丽: { households: 71, economy: 'farm', basis: GS + '东京留守官庆州 15、蔚州 3、礼州 7、金州 6、梁州 3、密城郡 7、晋州牧 10、陕州 13、固城 1、巨济 4，东界三陟、蔚珍各 1，共 71' },
  全州高丽: { households: 139, economy: 'farm', basis: GS + '全罗道全州牧、罗州牧、南原府等十六界首官 102，杨广道公州 13、洪州 15、嘉林县 6，庆尚道南海县 3，共 139' },
  耽罗: { households: 3, economy: 'mixed', basis: GS + '耽罗县无属县，海岛自有星主，按三县估' },
  安边: { households: 54, economy: 'farm', basis: GS + '安边都护府登州及和、定、宜、长诸州镇 27，交州 7、谷州 4、溟州 4、金壤 4、歙谷 1、高城 3、杆城 2、翼岭 2，共 54' },
  东界: { households: 3, economy: 'pastoral', basis: '定州关门以北东女真诸部，' + GS + '无郡县，按三县估' }
};

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const F = [0.76, 0.07];
const KAEGYONG = {
  开京: block({
    name: '开京', divisionType: '京', officialPosition: '知开城府事', terrain: '丘陵', regionType: 'normal',
    specialResources: '人参·纸墨·青瓷', taxLevel: '中', tags: { hasPort: true },
    description: '王京开城府，松岳山下，高丽建都于此，宫阙、国子监与诸司所在；礼成江口碧澜渡泊宋商舶。文宗十六年复置知开城府事，统畿内诸县。',
    idx: [54, 28, 52, 52, 18, 54, 14, 36], fisc: F, keju: 2.0, corridor: 1.3,
    notes: '碧澜渡为宋丽海道终点。'
  })
};

const SOGYONG = {
  西京: block({
    name: '西京', divisionType: '京', officialPosition: '西京留守官', terrain: '丘陵', regionType: 'normal',
    specialResources: '粮·麻布', taxLevel: '中', tags: {},
    description: '平壤府，古朝鲜旧都；太祖以平壤荒废，徙盐、白、黄、海、凤诸州民实之，为大都护府，成宗十四年称西京留守。大同江畔，兼领黄州、丰州与安北大都护府以南诸州县。',
    idx: [52, 28, 44, 44, 20, 52, 16, 36], fisc: F, keju: 1.3,
    notes: '西京畿与北界南部。'
  }),
  西北界: block({
    name: '西北界', divisionType: '道', officialPosition: '北界兵马使', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '粮·马·木材', taxLevel: '中', tags: { horseRegion: true },
    description: '北界鸭绿江下游诸州镇：义州（睿宗十二年自辽收保州，改名义州）与静、麟、龙、铁、宣、郭、龟、泰、朔、昌、云诸州，宁德、威远等镇，千里长城西段所在，北界兵马使统之。',
    idx: [54, 28, 34, 34, 18, 48, 20, 34], fisc: F,
    notes: '两界之北界。'
  })
};

const HANYANG = {
  南京汉阳: block({
    name: '南京汉阳', divisionType: '京', officialPosition: '南京留守官', terrain: '丘陵', regionType: 'normal',
    specialResources: '粮·麻布', taxLevel: '中', tags: {},
    description: '南京留守官杨州，汉江北岸，肃宗九年营南京，与开京、西京并为三京；兼领树州（富平）、仁州诸郡县。',
    idx: [54, 28, 46, 46, 18, 54, 14, 36], fisc: F, keju: 1.2,
    notes: '三京之一。'
  }),
  广州高丽: block({
    name: '广州高丽', divisionType: '州', officialPosition: '广州牧使', terrain: '丘陵', regionType: 'normal',
    specialResources: '粮·苎麻·纸', taxLevel: '中', tags: {},
    description: '广州牧，汉江之南，杨广道大牧；兼有水州、原州、天安府诸郡县与交州道春州一带山地。',
    idx: [54, 28, 46, 46, 18, 54, 14, 36], fisc: F,
    notes: '杨广道北部与交州道西部。'
  })
};

const GYEONGSANG = {
  庆州高丽: block({
    name: '庆州高丽', divisionType: '京', officialPosition: '东京留守官', terrain: '丘陵', regionType: 'normal',
    specialResources: '粮·铜器·海产', taxLevel: '中', tags: { fishingRegion: true },
    description: '东京留守官庆州，新罗千年旧都，佛国寺、瞻星台在焉；兼领蔚州、金州、梁州、晋州、陕州诸州与东海岸三陟、蔚珍。',
    idx: [54, 28, 46, 46, 18, 54, 14, 36], fisc: F, keju: 1.2,
    notes: '庆尚道南部。'
  }),
  尚州: block({
    name: '尚州', divisionType: '州', officialPosition: '尚州牧使', terrain: '丘陵', regionType: 'normal',
    specialResources: '粮·丝', taxLevel: '中', tags: {},
    description: '尚州牧，洛东江上游，庆尚道北部大牧；兼有京山府（星州）、安东府与杨广道忠州、清州二牧诸郡县。',
    idx: [54, 28, 46, 46, 18, 54, 14, 36], fisc: F,
    notes: '庆尚道北部与杨广道东南。'
  })
};

const JEOLLA = {
  全州高丽: block({
    name: '全州高丽', divisionType: '州', officialPosition: '全州牧使', terrain: '平原', regionType: 'normal',
    specialResources: '稻·纸·海产', taxLevel: '中', tags: { fishingRegion: true },
    description: '全州牧，后百济甄萱旧都，全罗道首府；兼领罗州牧、南原府、灵光、宝城诸郡与杨广道公州、洪州一带，湖南平野为高丽粮仓。',
    idx: [54, 28, 44, 44, 20, 52, 14, 36], fisc: F,
    notes: '全罗道与杨广道西南。'
  }),
  耽罗: block({
    name: '耽罗', divisionType: '岛', officialPosition: '耽罗星主', terrain: '岛屿', regionType: 'normal',
    specialResources: '柑橘·鲍鱼·海产', taxLevel: '轻', tags: { hasPort: true, fishingRegion: true },
    description: '海中耽罗，本乇罗国，高、良、夫三姓相传，长子称星主；肃宗十年改为耽罗郡，星主仍世袭。',
    idx: [54, 28, 30, 30, 20, 50, 16, 34], fisc: F,
    notes: '肃宗十年（1105）置耽罗郡。'
  })
};

const DONGGYE = {
  安边: block({
    name: '安边', divisionType: '府', officialPosition: '安边都护府使', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '粮·海产·木材', taxLevel: '中', tags: { fishingRegion: true },
    description: '安边都护府登州，东界南段；兼领和州、定州、宜州、长州诸州镇与交州、谷州、溟州（江陵）、金壤、高城、杆城、翼岭诸郡县，定州关门为东北界限。',
    idx: [54, 28, 44, 44, 18, 52, 16, 36], fisc: F,
    notes: '东界兵马使驻和州。'
  }),
  东界: block({
    name: '东界', divisionType: '部', officialPosition: '东界兵马使', terrain: '山林', regionType: 'tribal_frontier',
    specialResources: '貂皮·人参·马', taxLevel: '轻', tags: { horseRegion: true },
    description: '定州关门以北的东女真诸部之地；睿宗二年尹瓘筑九城，四年还付女真，此后高丽东北以定州为界，东界兵马使羁縻诸部。',
    idx: [54, 28, 30, 30, 20, 50, 18, 34], fisc: F,
    notes: '九城还付女真在睿宗四年（1109）。'
  })
};

module.exports = foreignTree({
  treeKey: 'fac_goryeo',
  idPrefix: 'div_ss_gr_',
  faction: '高丽',
  treeLabel: '高丽行政树去掉「高丽国」国号节点，',
  reportNotes: [
    '户数：《高丽史·地理志》无户口；各界首官治所按今地落到地图上，每块权重为所含界首官与所领郡县镇之数（恭愍王以后新置者不计）；势力全国合计不动。'
  ],
  PORTS: { 开京: 1, 耽罗: 1 },
  leaves: LEAVES,
  circuits: [
    {
      name: '开京畿内',
      frame: {
        name: '开京畿内', officialPosition: '知开城府事', capital: '开京',
        terrain: '丘陵', specialResources: '人参·青瓷·纸墨·商舶', taxLevel: '中',
        description: '王京开城府与畿内诸县，礼成江口碧澜渡为宋丽海道终点；仁宗即位以来外戚李资谦专权，去年（仁宗四年）李资谦之乱焚宫阙，拓俊京倒戈平之。',
        strategicValue: '国都。', threats: ['外戚与武臣争权'],
        flee: 1.0, hide: 1.0, textile: 1.0
      },
      blocks: KAEGYONG,
      regionMeans: { development: 46, unrest: 19, taxBurden: 53, armyPressure: 14 }
    },
    {
      name: '西京与西北界',
      frame: {
        name: '西京与西北界', officialPosition: '西京留守官', capital: '西京',
        terrain: '丘陵', specialResources: '粮·麻布·马', taxLevel: '中',
        description: '西京平壤与北界鸭绿江诸州镇，千里长城西段所在；仁宗今春幸西京，颁维新之令。',
        strategicValue: '北备金国。', threats: ['金'],
        flee: 1.0, hide: 1.0, textile: 0.8
      },
      blocks: SOGYONG,
      regionMeans: { development: 37.92, unrest: 19, taxBurden: 51.18, armyPressure: 16.82 }
    },
    {
      name: '汉阳—广州',
      frame: {
        name: '汉阳—广州', officialPosition: '南京留守官', capital: '南京汉阳',
        terrain: '丘陵', specialResources: '粮·苎麻·纸·麻布', taxLevel: '中',
        description: '汉江南北的南京杨州与广州牧，杨广道北部腹地。',
        strategicValue: '王京以南的腹地。', threats: [],
        flee: 1.0, hide: 1.0, textile: 1.0
      },
      blocks: HANYANG,
      regionMeans: { development: 46, unrest: 19, taxBurden: 53, armyPressure: 14 }
    },
    {
      name: '庆尚地区',
      frame: {
        name: '庆尚地区', officialPosition: '庆尚晋州道按察使', capital: '庆州高丽',
        terrain: '丘陵', specialResources: '粮·丝·铜器', taxLevel: '中',
        description: '洛东江流域的庆尚晋州道，新罗旧地，东京庆州与尚州、晋州诸大邑所在。',
        strategicValue: '东南财赋之地。', threats: ['日本海寇'],
        flee: 1.0, hide: 1.0, textile: 1.0
      },
      blocks: GYEONGSANG,
      regionMeans: { development: 46, unrest: 19, taxBurden: 53, armyPressure: 14 }
    },
    {
      name: '全罗与耽罗',
      frame: {
        name: '全罗与耽罗', officialPosition: '全罗道按察使', capital: '全州高丽',
        terrain: '平原', specialResources: '稻·海产·柑橘', taxLevel: '中',
        description: '湖南平野的全罗道与海中耽罗，高丽粮仓，漕船自诸浦北运开京。',
        strategicValue: '漕粮所出。', threats: [],
        flee: 1.0, hide: 1.0, textile: 1.0
      },
      blocks: JEOLLA,
      regionMeans: { development: 42.45, unrest: 19.67, taxBurden: 51.67, armyPressure: 14.89 }
    },
    {
      name: '高丽东界',
      frame: {
        name: '高丽东界', officialPosition: '东界兵马使', capital: '安边',
        terrain: '山地', specialResources: '海产·木材·貂皮', taxLevel: '中',
        description: '东海岸的东界，安边都护府以南为高丽州县，定州关门以北为东女真诸部；九城还付女真后，东界兵马使守定州一线。',
        strategicValue: '东北备女真。', threats: ['东女真'],
        flee: 1.0, hide: 1.2, textile: 0.8
      },
      blocks: DONGGYE,
      regionMeans: { development: 44.55, unrest: 19, taxBurden: 53, armyPressure: 14.73 }
    }
  ]
});
