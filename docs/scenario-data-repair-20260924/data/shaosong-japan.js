// 绍宋·日本 47 块（外藩）：分路框架与逐块数据。建炎元年即日本大治二年，白河法皇院政。
// 户数权重与田亩：《和名类聚抄》二十卷本国郡部各国田积（sources/wamyosho-densu.json，六十八国合 852767 町）。
//   人口按田积分（势力全国合计不动）；田亩直接用田积，一町约合二十宋亩
//   （町 = 十段 = 三千六百步，步六尺见方；宋亩 = 二百四十步，步五尺见方）。
//   地图 47 块多以国名命名：同名的国归同名块；地图未单列的二十一国按国府所在落块（tools/locate-points.js），
//   如河内、和泉入摄津，常陆、上总、安房入下总，美浓入尾张。
'use strict';

const path = require('path');
const { foreignTree, block } = require('./shaosong-foreign');
const WAMYO = require(path.join(__dirname, '..', 'sources', 'wamyosho-densu.json'));

const MU_PER_CHO = 20;

// 地块 ← 《和名抄》国名（翻字本字形）
const BLOCK_PROVINCES = {
  山城国: ['山城国'], 大和国: ['大和国'], 摄津国: ['摂津国', '河内国', '和泉国'],
  近江国: ['近江国', '伊賀国'], 上野国: ['上野国'], 陆奥国: ['陸奥国'], 出羽国: ['出羽国'], 信浓国: ['信濃国', '甲斐国'],
  伊势国: ['伊勢国', '志摩国'], 尾张国: ['尾張国', '美濃国'], 三河国: ['参河国', '遠江国'], 骏河国: ['駿河国'],
  武藏国: ['武蔵国', '下野国'], 相模国: ['相模国', '伊豆国'], 下总国: ['下総国', '上総国', '常陸国', '安房国'],
  越前国: ['越前国'], 加贺国: ['加賀国', '能登国', '越中国', '飛驒国'], 越后国: ['越後国'], 若狭国: ['若狭国'], 佐渡国: ['佐渡国'],
  丹波国: ['丹波国', '丹後国'], 但马国: ['但馬国'], 因幡国: ['因幡国', '伯耆国'], 出云国: ['出雲国', '石見国'], 隐岐国: ['隠岐国'],
  播磨国: ['播磨国'], 备前国: ['備前国', '美作国', '備中国'], 安艺国: ['安芸国', '備後国'], 周防国: ['周防国'], 长门国: ['長門国'],
  纪伊国: ['紀伊国'], 阿波国: ['阿波国'], 赞岐国: ['讚岐国'], 伊予国: ['伊予国'], 土佐国: ['土佐国'], 淡路国: ['淡路国'],
  筑前国: ['筑前国'], 筑后国: ['筑後国'], 肥前国: ['肥前国'], 肥后国: ['肥後国'], 丰前国: ['豊前国'], 丰后国: ['豊後国'],
  日向国: ['日向国'], 萨摩国: ['薩摩国'], 大隅国: ['大隅国'], 对马国: ['対馬島'], 壹岐国: ['壱岐島']
};
// 平安京城居人口不在田积里：按约十万口另计，折成田积当量（势力原账合计 616 万口，每町约 7.2 口）
const CITY = { 山城国: { mouths: 100000, note: '另计平安京城居约十万口' } };
const FACTION_MOUTHS = 6160000;
const TOTAL_CHO = WAMYO.reduce((a, r) => a + r.fieldCho, 0);
function cityCho(mouths) { return Math.round(mouths * TOTAL_CHO / (FACTION_MOUTHS - mouths)); }

const ECONOMY = { 陆奥国: 'mixed', 出羽国: 'mixed', 对马国: 'mixed', 壹岐国: 'mixed', 隐岐国: 'mixed', 佐渡国: 'mixed' };
const COMMERCE = { 山城国: 1.5, 筑前国: 1.5, 摄津国: 1.3 };

// 古活字本日向、大隅、萨摩三国都作「田四千八百余町」，同数显系传写之误：三国合 14400 町按《和名抄》郷数
// （日向 28、大隅 37、萨摩 35，据日文维基百科各国条）分
const SOUTH_XIANG = { 日向国: 28, 大隅国: 37, 薩摩国: 35 };
const SOUTH_TOTAL = 14400;
const SOUTH_XIANG_SUM = Object.values(SOUTH_XIANG).reduce((a, b) => a + b, 0);
function fieldOf(n) {
  const r = WAMYO.find((x) => x.name === n);
  if (!r) throw new Error('《和名抄》表里没有 ' + n);
  if (!SOUTH_XIANG[n]) return r;
  return Object.assign({}, r, { fieldCho: Math.round(SOUTH_TOTAL * SOUTH_XIANG[n] / SOUTH_XIANG_SUM), fixed: true });
}

function leafSpec(blockName) {
  const provs = BLOCK_PROVINCES[blockName].map(fieldOf);
  const cho = provs.reduce((a, r) => a + r.fieldCho, 0);
  const detail = provs.map((r) => r.name + ' ' + r.fieldCho + ' 町' + (r.fixed ? '（三国同作四千八百余町，合计按郷数分）' : '')).join('、');
  const city = CITY[blockName];
  return {
    households: cho + (city ? cityCho(city.mouths) : 0),
    economy: ECONOMY[blockName] || 'farm',
    commerceFactor: COMMERCE[blockName],
    counties: provs.reduce((a, r) => a + r.districts, 0),
    land: cho * MU_PER_CHO,
    landBasis: '《和名抄》田积 ' + cho + ' 町 × ' + MU_PER_CHO,
    basis: '《和名类聚抄》田积：' + detail + (provs.length > 1 ? '，合 ' + cho + ' 町' : '') +
      (city ? '；' + city.note + '，折田积当量 ' + cityCho(city.mouths) + ' 町' : '')
  };
}
const LEAVES = {};
Object.keys(BLOCK_PROVINCES).forEach((b) => { LEAVES[b] = leafSpec(b); });

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function jp(name, prosperity, fields) {
  // 依据栏空的按所含诸国田积补
  if (!fields.notes) fields = Object.assign({}, fields, { notes: '《和名抄》田积 ' + LEAVES[name].households + ' 町。' });
  return block(Object.assign({
    name, divisionType: '国', officialPosition: name.replace(/国$/, '守'), regionType: 'normal', taxLevel: '中',
    idx: [50, 32, prosperity, prosperity, 22, 48, 16, 36], fisc: [0.73, 0.08]
  }, fields));
}

const KINAI = {
  山城国: jp('山城国', 58, {
    terrain: '盆地', specialResources: '绢织·漆器·纸', tags: {}, keju: 2.0, corridor: 1.4,
    urban: { fang: 0.4, shi: 0.2, zhen: 0.08, cun: 0.32 },
    description: '平安京所在，白河法皇居鸟羽殿、白河殿行院政；石清水八幡宫、宇治平等院在境，国府以河阳离宫为之。',
    notes: '《和名抄》：以河阳离宫为国府。'
  }),
  大和国: jp('大和国', 52, {
    terrain: '盆地', specialResources: '稻·吉野木材·寺社庄园', tags: {},
    description: '南都所在，东大寺、兴福寺诸大寺广有庄园，兴福寺众徒屡起强诉；国府在高市郡。',
    notes: '南都七大寺。'
  }),
  摄津国: jp('摄津国', 54, {
    terrain: '沿海', specialResources: '稻·盐·海产', tags: { hasPort: true, fishingRegion: true },
    description: '难波旧都之地，难波津、大轮田泊为濑户内海航路要津；兼河内、和泉二国，河内源氏兴于河内国石川郡。',
    notes: '含河内、和泉。'
  })
};

const TOSANDO = {
  近江国: jp('近江国', 44, {
    terrain: '水乡', specialResources: '稻·湖鱼·木材', tags: { fishingRegion: true },
    description: '琵琶湖环抱，比叡山延历寺与园城寺在境，山门众徒强诉常动京师；兼伊贺国，国府在栗太郡。',
    notes: '含伊贺。'
  }),
  上野国: jp('上野国', 32, {
    officialPosition: '上野介', terrain: '丘陵', specialResources: '马·绢', tags: { horseRegion: true },
    description: '亲王任国，以上野介掌国务，官牧所在；天仁元年浅间山大喷发，国中田亩多为火山灰所覆。',
    notes: '天仁元年（1108）浅间山喷发。'
  }),
  陆奥国: jp('陆奥国', 30, {
    terrain: '山地', specialResources: '砂金·马·鹰羽', tags: { mineralRegion: true, horseRegion: true },
    description: '国府在宫城郡多贺城，镇守府在胆泽；后三年之役后藤原清衡据平泉，天治元年中尊寺金色堂落成，产砂金、良马。',
    notes: '奥州藤原氏。'
  }),
  出羽国: jp('出羽国', 30, {
    terrain: '河谷', specialResources: '马·鹰羽·稻', tags: { horseRegion: true },
    description: '国府在平鹿郡，雄物川、最上川流域，清原氏旧地，今奥州藤原氏势力所及。',
    notes: '后三年之役后清原氏亡。'
  }),
  信浓国: jp('信浓国', 34, {
    terrain: '山地', specialResources: '马·麻布·稻', tags: { horseRegion: true },
    description: '国府在筑摩郡，官牧众多，岁贡驹马；兼甲斐国，甲斐源氏兴于此。',
    notes: '含甲斐。'
  })
};

const TOKAIDO = {
  伊势国: jp('伊势国', 46, {
    terrain: '沿海', specialResources: '稻·盐·鲍', tags: { saltRegion: true, fishingRegion: true },
    description: '伊势神宫所在，伊势平氏根据之地，平正盛、忠盛父子以院近臣受领起家；兼志摩国，鲍与海产供神宫御贄。',
    notes: '含志摩。'
  }),
  尾张国: jp('尾张国', 46, {
    terrain: '平原', specialResources: '稻·盐·陶器', tags: { saltRegion: true },
    description: '浓尾平野，热田神宫在焉，猿投窑烧造灰釉陶器，知多半岛产盐；兼美浓国，国府在中岛郡。',
    notes: '含美浓。'
  }),
  三河国: jp('三河国', 44, {
    terrain: '丘陵', specialResources: '稻·绢', tags: {},
    description: '国府在宝饭郡；兼远江国，东海道驿路所经。',
    notes: '含远江。'
  }),
  骏河国: jp('骏河国', 42, {
    terrain: '沿海', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '富士山下，国府在安倍郡，东海道要道。',
    notes: ''
  }),
  武藏国: jp('武藏国', 42, {
    terrain: '平原', specialResources: '马·稻·布', tags: { horseRegion: true },
    description: '国府在多磨郡，关东平野中部，官牧所在，诸党武士兴起；兼下野国。',
    notes: '含下野。'
  }),
  相模国: jp('相模国', 42, {
    terrain: '丘陵', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '国府在大住郡，三浦、镰仓诸氏兴起，源赖义于镰仓由比乡奉八幡；兼伊豆国。',
    notes: '含伊豆。'
  }),
  下总国: jp('下总国', 44, {
    terrain: '平原', specialResources: '稻·马·布', tags: { horseRegion: true },
    description: '平将门旧起之地，千叶等平氏武士盘踞；兼上总、常陆、安房三国，上总、常陆为亲王任国，以介掌国务。',
    notes: '含上总、常陆、安房。'
  })
};

const HOKURIKUDO = {
  越前国: jp('越前国', 40, {
    terrain: '丘陵', specialResources: '稻·绢·海产', tags: { hasPort: true, fishingRegion: true },
    description: '国府在丹生郡，气比神宫与敦贺津在境，北陆海道通京，宋商舶亦间至敦贺。',
    notes: ''
  }),
  加贺国: jp('加贺国', 38, {
    terrain: '平原', specialResources: '稻·绢', tags: {},
    description: '弘仁十四年析越前加贺、江沼二郡置，白山信仰所在；兼能登、越中、飞驒三国。',
    notes: '含能登、越中、飞驒。'
  }),
  越后国: jp('越后国', 36, {
    terrain: '平原', specialResources: '稻·布·鲑', tags: { fishingRegion: true },
    description: '国府在颈城郡，北陆道极北，城氏等豪族据地，产布与鲑。',
    notes: ''
  }),
  若狭国: jp('若狭国', 36, {
    terrain: '沿海', specialResources: '盐·海产', tags: { saltRegion: true, fishingRegion: true },
    description: '国府在远敷郡，小滨湾调盐与海产输京。',
    notes: '若狭调盐见平城京木简。'
  }),
  佐渡国: jp('佐渡国', 30, {
    terrain: '岛屿', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '国府在杂太郡，日本海中之岛，远流之地。',
    notes: ''
  })
};

const SANINDO = {
  丹波国: jp('丹波国', 42, {
    terrain: '山地', specialResources: '稻·栗·木材', tags: {},
    description: '国府在桑田郡，京西北门户；兼丹后国（和铜六年割丹波五郡置）。',
    notes: '含丹后。'
  }),
  但马国: jp('但马国', 40, {
    terrain: '山地', specialResources: '稻·木材', tags: {},
    description: '国府在气多郡，山阴道要冲。',
    notes: ''
  }),
  因幡国: jp('因幡国', 42, {
    terrain: '丘陵', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '国府在法美郡；兼伯耆国，伯耆国府在久米郡。',
    notes: '含伯耆。'
  }),
  出云国: jp('出云国', 44, {
    terrain: '平原', specialResources: '稻·铁·玉石', tags: {},
    description: '国府在意宇郡，杵筑大社（出云大社）所在；兼石见国。',
    notes: '含石见。'
  }),
  隐岐国: jp('隐岐国', 30, {
    terrain: '岛屿', specialResources: '鲍·海产', tags: { fishingRegion: true },
    description: '国府在周吉郡，日本海中诸岛，远流之地。',
    notes: ''
  })
};

const SANYODO = {
  播磨国: jp('播磨国', 46, {
    terrain: '平原', specialResources: '稻·绢', tags: {},
    description: '大国，国府在饰磨郡，受领肥缺，院近臣多求为播磨守。',
    notes: ''
  }),
  备前国: jp('备前国', 44, {
    terrain: '平原', specialResources: '稻·铁·陶', tags: {},
    description: '国府在御野郡；兼美作、备中二国，吉备旧地，产铁。',
    notes: '含美作、备中。'
  }),
  安艺国: jp('安艺国', 40, {
    terrain: '丘陵', specialResources: '稻·木材·海产', tags: { fishingRegion: true },
    description: '国府在安艺郡，严岛神社所在；兼备后国。',
    notes: '含备后。'
  }),
  周防国: jp('周防国', 40, {
    terrain: '丘陵', specialResources: '盐·稻·海产', tags: { saltRegion: true, fishingRegion: true },
    description: '国府在佐波郡，濑户内海沿岸煮盐，大岛调盐见于木简。',
    notes: ''
  }),
  长门国: jp('长门国', 38, {
    terrain: '沿海', specialResources: '铜·海产', tags: { hasPort: true, mineralRegion: true, fishingRegion: true },
    description: '国府在丰浦郡，赤间关扼关门海峡；长登铜山曾供东大寺大佛之铜。',
    notes: ''
  })
};

const NANKAIDO = {
  纪伊国: jp('纪伊国', 40, {
    terrain: '山地', specialResources: '木材·海产', tags: { fishingRegion: true },
    description: '国府在名草郡，高野山与熊野三山所在，白河法皇屡行熊野诣。',
    notes: ''
  }),
  阿波国: jp('阿波国', 38, {
    terrain: '河谷', specialResources: '稻·布', tags: {},
    description: '国府在名方郡，吉野川下游，南海道东端。',
    notes: ''
  }),
  赞岐国: jp('赞岐国', 44, {
    terrain: '平原', specialResources: '稻·盐', tags: { saltRegion: true },
    description: '国府在阿野郡，空海故里，田积为南海道诸国之首，濒海产盐。',
    notes: ''
  }),
  伊予国: jp('伊予国', 40, {
    terrain: '沿海', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '国府在越智郡，濑户内海海上势力所聚，昔藤原纯友据日振岛为乱。',
    notes: ''
  }),
  土佐国: jp('土佐国', 36, {
    terrain: '山地', specialResources: '木材·海产·纸', tags: { fishingRegion: true },
    description: '国府在长冈郡，远流之地，多山林。',
    notes: ''
  }),
  淡路国: jp('淡路国', 38, {
    terrain: '岛屿', specialResources: '盐·海产', tags: { saltRegion: true, fishingRegion: true },
    description: '国府在三原郡，濑户内海东口，御食国，贡海产。',
    notes: ''
  })
};

const SAIKAIDO = {
  筑前国: jp('筑前国', 52, {
    officialPosition: '大宰大弐', terrain: '沿海', specialResources: '宋货·稻·海产', tags: { hasPort: true, fishingRegion: true },
    description: '大宰府与国府并在御笠郡，统西海道九国二岛；博多津宋商聚居，为宋日往来门户。',
    notes: '大宰府。'
  }),
  筑后国: jp('筑后国', 48, {
    terrain: '平原', specialResources: '稻', tags: {},
    description: '国府在御井郡，筑后川流域平野。',
    notes: ''
  }),
  肥前国: jp('肥前国', 46, {
    terrain: '沿海', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '国府在佐贺郡，松浦诸党以舟楫为业，濒海多岛。',
    notes: ''
  }),
  肥后国: jp('肥后国', 48, {
    terrain: '平原', specialResources: '稻·马', tags: {},
    description: '大国，阿苏山西麓，田积为西海道之首，阿苏神社所在。',
    notes: ''
  }),
  丰前国: jp('丰前国', 46, {
    terrain: '丘陵', specialResources: '稻·铜', tags: { mineralRegion: true },
    description: '国府在京都郡，宇佐八幡宫所在，香春岳产铜。',
    notes: ''
  }),
  丰后国: jp('丰后国', 44, {
    terrain: '山地', specialResources: '稻·木材', tags: {},
    description: '国府在大分郡，九重、由布诸山环列。',
    notes: ''
  }),
  日向国: jp('日向国', 44, {
    terrain: '沿海', specialResources: '稻·马', tags: {},
    description: '国府在儿汤郡，岛津庄自万寿年间开发，寄进摄关家，为天下大庄。',
    notes: ''
  }),
  萨摩国: jp('萨摩国', 44, {
    terrain: '丘陵', specialResources: '硫黄·稻', tags: { mineralRegion: true },
    description: '国府在高城郡，硫黄岛所产硫黄随宋商舶输出。',
    notes: ''
  }),
  大隅国: jp('大隅国', 42, {
    terrain: '丘陵', specialResources: '稻·海产', tags: { fishingRegion: true },
    description: '和铜六年割日向四郡置，天长元年并多褹岛；国府在桑原郡。',
    notes: ''
  }),
  对马国: jp('对马国', 40, {
    terrain: '岛屿', specialResources: '银·海产', tags: { hasPort: true, mineralRegion: true, fishingRegion: true },
    description: '朝鲜海峡中，产银，宽仁三年刀伊入寇曾受掠；与高丽往来多经此岛。',
    notes: ''
  }),
  壹岐国: jp('壹岐国', 40, {
    terrain: '岛屿', specialResources: '海产·稻', tags: { fishingRegion: true },
    description: '玄界滩中，宽仁三年刀伊入寇，壹岐守藤原理忠战死。',
    notes: ''
  })
};

function circuit(name, officialPosition, capital, fields, blocks, regionMeans) {
  return {
    name,
    frame: Object.assign({ name, officialPosition, capital, taxLevel: '中', threats: [], flee: 1.0, hide: 1.0, textile: 1.0 }, fields),
    blocks,
    regionMeans
  };
}

module.exports = foreignTree({
  treeKey: 'fac_japan',
  idPrefix: 'div_ss_jp_',
  faction: '日本',
  treeLabel: '日本行政树去掉「日本」国号节点，按五畿七道分为 8 道，',
  reportNotes: [
    '户数与田亩：《和名类聚抄》二十卷本国郡部各国田积（国立国语研究所翻字本），人口按田积分（全国合计不动），田亩按一町约二十宋亩折；地图未单列的二十一国按国府所在并入邻块。'
  ],
  PORTS: { 摄津国: 1, 越前国: 1, 长门国: 1, 筑前国: 1, 对马国: 1 },
  // 原账日本的「城镇」指国府、大宰府等官衙町，归城（坊市）；「京」只在畿内
  settlementKeys: { 城镇: '城' },
  leaves: LEAVES,
  circuits: [
    circuit('畿内', '诸国受领', '山城国', {
      terrain: '盆地', specialResources: '绢织·稻·寺社庄园·盐',
      // 平安京城居约十万口，畿内城居约占四分之一（原账比例容不下京城）
      settlement: { 城: 0.25, 镇: 0.12, 乡: 0.63 },
      description: '山城、大和、摄津、河内、和泉五国，平安京与南都所在；白河法皇院政，院近臣受领与寺社强诉交织。',
      strategicValue: '京畿。', threats: ['寺社强诉']
    }, KINAI, { development: 54, unrest: 22, taxBurden: 52, armyPressure: 13 }),
    circuit('东山道', '陆奥出羽按察使', '陆奥国', {
      terrain: '山地', specialResources: '马·砂金·稻·湖鱼',
      description: '自近江越美浓、信浓至上野、下野与陆奥、出羽，官牧与砂金所出；奥羽两国今在奥州藤原氏掌中。',
      strategicValue: '东北边地与官牧。', threats: ['奥州藤原氏坐大']
    }, TOSANDO, { development: 36, unrest: 22, taxBurden: 47, armyPressure: 17 }),
    circuit('东海道', '诸国受领', '伊势国', {
      terrain: '平原', specialResources: '稻·马·布·盐',
      description: '自伊势、尾张沿太平洋岸至关东诸国，坂东武士兴起之地。',
      strategicValue: '坂东武士之源。', threats: ['坂东武士争斗']
    }, TOKAIDO, { development: 46, unrest: 22, taxBurden: 50, armyPressure: 14 }),
    circuit('北陆道', '诸国受领', '越前国', {
      terrain: '平原', specialResources: '稻·海产·布·盐',
      description: '日本海沿岸自若狭、越前至越后、佐渡，海道运粮输京。',
      strategicValue: '北陆海道。', threats: []
    }, HOKURIKUDO, { development: 38, unrest: 22, taxBurden: 48, armyPressure: 18 }),
    circuit('山阴道', '诸国受领', '出云国', {
      terrain: '山地', specialResources: '稻·木材·铁·海产',
      description: '中国山地以北的日本海沿岸诸国，自丹波至出云、石见与隐岐。',
      strategicValue: '', threats: []
    }, SANINDO, { development: 42, unrest: 22, taxBurden: 49, armyPressure: 17 }),
    circuit('山阳道', '诸国受领', '播磨国', {
      terrain: '平原', specialResources: '稻·铁·盐·铜',
      description: '濑户内海北岸自播磨至长门，西国大路与海路并行，受领肥缺多在于此。',
      strategicValue: '濑户内海航路。', threats: ['濑户内海海贼']
    }, SANYODO, { development: 42, unrest: 22, taxBurden: 49, armyPressure: 17 }),
    circuit('南海道', '诸国受领', '赞岐国', {
      terrain: '山地', specialResources: '稻·盐·木材·海产',
      description: '纪伊、淡路与四国诸国，高野山、熊野所在。',
      strategicValue: '', threats: ['濑户内海海贼']
    }, NANKAIDO, { development: 40, unrest: 22, taxBurden: 49, armyPressure: 18 }),
    circuit('西海道', '大宰大弐', '筑前国', {
      terrain: '平原', specialResources: '稻·宋货·铜·硫黄',
      description: '九州九国与壹岐、对马二岛，大宰府总其政；博多为宋日往来门户。',
      strategicValue: '对宋、高丽门户。', threats: []
    }, SAIKAIDO, { development: 48, unrest: 22, taxBurden: 50, armyPressure: 15 })
  ]
});
