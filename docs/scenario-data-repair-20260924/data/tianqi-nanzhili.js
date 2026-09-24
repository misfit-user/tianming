// 天启剧本·南直隶 14 个府州地块的重写数据（阶段一样板）
//
// 用法：由 patches/tianqi-prefectures.js 读入。它把南直隶省级总数（人口、户、丁、钱粮、田亩……）按下列权重
// 重新分给 14 个地块，省总数一律不动；定性字段（地形、物产、标签、描述、官守、民情）逐块改写。
//
// 权重依据（出处与原始数字见 ../sources/）：
//   人口：洪武二十六年册籍户口（《明史·地理志》卷40）。册籍在江南后来变成赋役定额，不能反映人口，
//         故江南、皖南各府按洪武份额不变；江北与留都的册籍增减有实据（江北垦复移民、永乐迁都），
//         按「万历六年册口 / 洪武二十六年册口」的平方根调整（只取一半的增减）。
//   户数：各府洪武二十六年口户比。
//   税额：洪武二十六年夏税秋粮米麦（《大明会典》卷24）。明代田赋定额相沿，份额可代表明末。
//   田亩：洪武二十六年田土（《诸司职掌》）；凤阳、淮安两府洪武数畸高、安庆府畸低（学界已有考证），
//         凤阳、安庆、庐州、和州改用万历六年田地（梁方仲乙表32），淮安无万历数，按扬州口均田地的
//         1.5 倍估；皖南山区（徽州、宁国、池州、广德）洪武数含山地，改用万历折实田数。
//   地块与历史府州不是一一对应：地图上 14 块，历史上 14 府 4 直隶州。有同名地块的府州，所辖县一律归本府；
//   地图上没有自己地块的庐州府、滁州、和州、广德州，按县治坐标落到所在地块。府州的数字按所辖县数平分给
//   各县再汇总（庐州府的合肥、六安、霍山归凤阳块，舒城、英山归安庆块，庐江归池州块，无为、巢县与和州
//   归太平块；滁州与广德州的建平归应天块，广德州城归常州块）。
//   其余字段（商贸强弱、城镇比例、民情、盐场、渔业、科举等）是按明代经济地理与天启末时势的定性分档，
//   每块在 notes 里写明理由。
'use strict';

// 历史府州：洪武户口、税粮、田亩、增长调整、所辖县（县治经纬度，取今县城位置，精度约 0.1 度）
const UNITS = [
  { name: '应天府', households: 163915, mouths: 1193620, wanliMouths: 790513, grain: 331876, land: 7270125, landSource: '洪武',
    growthRule: '留都：永乐迁都后人口北移，按万历/洪武平方根',
    counties: [['上元', 118.78, 32.05], ['江宁', 118.78, 32.04], ['句容', 119.16, 31.95], ['溧阳', 119.48, 31.42],
      ['溧水', 119.03, 31.65], ['高淳', 118.88, 31.33], ['江浦', 118.63, 32.07], ['六合', 118.84, 32.34]] },
  { name: '凤阳府', households: 79107, mouths: 427303, wanliMouths: 1202349, grain: 230475, land: 6019197, landSource: '万历（洪武数畸高）',
    growthRule: '江北垦复移民',
    counties: [['凤阳', 117.56, 32.87], ['临淮', 117.65, 32.93], ['怀远', 117.19, 32.97], ['定远', 117.68, 32.53],
      ['五河', 117.89, 33.13], ['虹县', 117.88, 33.48], ['寿州', 116.79, 32.57], ['霍丘', 116.29, 32.35],
      ['蒙城', 116.56, 33.27], ['泗州', 118.52, 33.10], ['盱眙', 118.55, 33.01], ['天长', 119.00, 32.69],
      ['宿州', 116.98, 33.63], ['灵璧', 117.56, 33.54], ['颍州', 115.81, 32.89], ['颍上', 116.26, 32.64],
      ['太和', 115.62, 33.16], ['亳州', 115.78, 33.85]] },
  { name: '淮安府', households: 80689, mouths: 632541, wanliMouths: 906033, grain: 354710, land: null, landSource: '估（洪武数畸高）',
    growthRule: '江北',
    counties: [['山阳', 119.14, 33.50], ['清河', 119.02, 33.60], ['盐城', 120.16, 33.35], ['安东', 119.40, 33.79],
      ['桃源', 118.68, 33.72], ['沭阳', 118.77, 34.13], ['海州', 119.18, 34.60], ['赣榆', 119.13, 34.84],
      ['邳州', 117.96, 34.33], ['宿迁', 118.29, 33.96], ['睢宁', 117.95, 33.91]] },
  { name: '扬州府', households: 123097, mouths: 736165, wanliMouths: 817856, grain: 297806, land: 4276734, landSource: '洪武',
    growthRule: '江北',
    counties: [['江都', 119.42, 32.39], ['仪真', 119.18, 32.27], ['泰兴', 120.02, 32.17], ['高邮', 119.46, 32.78],
      ['宝应', 119.31, 33.24], ['兴化', 119.85, 32.93], ['泰州', 119.92, 32.46], ['如皋', 120.57, 32.39],
      ['通州', 120.86, 32.01], ['海门', 121.17, 31.89]] },
  { name: '苏州府', households: 491514, mouths: 2355030, wanliMouths: null, grain: 2810490, land: 9850671, landSource: '洪武',
    growthRule: '江南：册籍成定额，不调',
    counties: [['吴县', 120.62, 31.30], ['长洲', 120.63, 31.31], ['昆山', 120.95, 31.39], ['常熟', 120.75, 31.65],
      ['吴江', 120.64, 31.16], ['嘉定', 121.25, 31.38], ['太仓', 121.10, 31.45], ['崇明', 121.40, 31.62]] },
  { name: '松江府', households: 249950, mouths: 1219937, wanliMouths: null, grain: 1219896, land: 5132290, landSource: '洪武',
    growthRule: '江南',
    counties: [['华亭', 121.23, 31.03], ['上海', 121.49, 31.23], ['青浦', 121.12, 31.15]] },
  { name: '常州府', households: 152164, mouths: 775513, wanliMouths: null, grain: 652835, land: 7973188, landSource: '洪武',
    growthRule: '江南',
    counties: [['武进', 119.95, 31.78], ['无锡', 120.30, 31.57], ['宜兴', 119.82, 31.36], ['江阴', 120.27, 31.91],
      ['靖江', 120.27, 32.02]] },
  { name: '镇江府', households: 87364, mouths: 522383, wanliMouths: null, grain: 324046, land: 3845270, landSource: '洪武',
    growthRule: '江南',
    counties: [['丹徒', 119.45, 32.20], ['丹阳', 119.58, 32.00], ['金坛', 119.57, 31.74]] },
  { name: '庐州府', households: 48720, mouths: 367200, wanliMouths: 622698, grain: 91190, land: 6838911, landSource: '万历（江北垦复）',
    growthRule: '江北',
    counties: [['合肥', 117.27, 31.86], ['舒城', 116.95, 31.46], ['庐江', 117.29, 31.26], ['巢县', 117.87, 31.60],
      ['无为', 117.90, 31.30], ['六安', 116.52, 31.73], ['英山', 115.68, 30.73], ['霍山', 116.33, 31.40]] },
  { name: '安庆府', households: 55573, mouths: 422804, wanliMouths: 543476, grain: 131636, land: 2190531, landSource: '万历（洪武数畸低）',
    growthRule: '江北岸',
    counties: [['怀宁', 117.05, 30.53], ['桐城', 116.95, 31.05], ['潜山', 116.57, 30.63], ['太湖', 116.30, 30.42],
      ['宿松', 116.12, 30.15], ['望江', 116.69, 30.13]] },
  { name: '太平府', households: 39290, mouths: 259937, wanliMouths: null, grain: 67680, land: 3621179, landSource: '洪武',
    growthRule: '江南',
    counties: [['当涂', 118.49, 31.56], ['芜湖', 118.38, 31.33], ['繁昌', 118.20, 31.08]] },
  { name: '池州府', households: 35826, mouths: 198574, wanliMouths: null, grain: 128961, land: 908923, landSource: '万历（山地折实）',
    growthRule: '皖南',
    counties: [['贵池', 117.49, 30.66], ['青阳', 117.85, 30.64], ['铜陵', 117.81, 30.93], ['石埭', 117.85, 30.23],
      ['建德', 117.02, 30.12], ['东流', 116.88, 30.23]] },
  { name: '宁国府', households: 99732, mouths: 532259, wanliMouths: null, grain: 244660, land: 3033078, landSource: '万历（山地折实）',
    growthRule: '皖南',
    counties: [['宣城', 118.75, 30.95], ['南陵', 118.33, 30.92], ['泾县', 118.41, 30.69], ['宁国', 118.98, 30.63],
      ['旌德', 118.54, 30.29], ['太平县', 118.13, 30.30]] },
  { name: '徽州府', households: 125548, mouths: 592364, wanliMouths: null, grain: 165404, land: 2547828, landSource: '万历（山地折实）',
    growthRule: '皖南',
    counties: [['歙县', 118.43, 29.87], ['休宁', 118.19, 29.79], ['婺源', 117.86, 29.25], ['祁门', 117.72, 29.86],
      ['黟县', 117.94, 29.93], ['绩溪', 118.58, 30.07]] },
  { name: '徐州', households: 22683, mouths: 180821, wanliMouths: 345766, grain: 141640, land: 2834154, landSource: '洪武',
    growthRule: '江北',
    counties: [['徐州', 117.18, 34.26], ['萧县', 116.94, 34.19], ['砀山', 116.35, 34.43], ['丰县', 116.60, 34.70],
      ['沛县', 116.93, 34.73]] },
  { name: '滁州', households: 3944, mouths: 24797, wanliMouths: 67277, grain: 5511, land: 315045, landSource: '洪武',
    growthRule: '江北',
    counties: [['滁州', 118.31, 32.30], ['全椒', 118.27, 32.09], ['来安', 118.43, 32.45]] },
  { name: '和州', households: 9531, mouths: 66711, wanliMouths: 104960, grain: 4834, land: 621580, landSource: '万历（江北垦复）',
    growthRule: '江北',
    counties: [['和州', 118.35, 31.72], ['含山', 118.10, 31.73]] },
  { name: '广德州', households: 44267, mouths: 247979, wanliMouths: null, grain: 30570, land: 2167245, landSource: '万历（山地折实）',
    growthRule: '皖南',
    counties: [['广德', 119.42, 30.89], ['建平', 119.17, 31.13]] }
];

// 淮安田亩估算：洪武数（1933 万亩）畸高、无万历数，按扬州口均田地（5.81 亩）的 1.5 倍
UNITS.find((u) => u.name === '淮安府').land = Math.round(632541 * (4276734 / 736165) * 1.5);

// 地图块（按地图 id）：定性字段与分档。数值型的分档在补丁里按省总数归一。
//   commerce  商贸强度（乘以人口）；urban 坊/市/镇/村人口比例的先验；maritime/fishing/salt/imperial/textile 分配权重
//   corridor  驿路冲要系数（乘以所辖县数）；keju 科举解额权重；gentry 缙绅兼并强度（乘以田亩）
//   hide/flee 隐户、逃户倾向（乘以人口）；yieldFactor 田亩产出系数（乘以田亩，定承载）
//   minxin/corruption/prosperity 与地块层的 development/unrest/taxPressure/armyPressure/officeRisk 是目标值，
//   补丁按人口加权把均值拉回省里原值
const BLOCKS = {
  'ming-02-p01': {
    name: '应天府', divisionType: '府', officialPosition: '应天府尹', terrain: '丘陵',
    specialResources: '云锦·书坊·漕运', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: true },
    description: '留都南京所在，钟山龙蟠、石城虎踞，六部与守备衙门俱在，而权柄多虚。城中坊市繁盛，云锦、书坊甲于东南；江北江浦、六合与滁州一线是留都屏障。',
    commerce: 2.4, urban: { fang: 0.30, shi: 0.12, zhen: 0.16, cun: 0.42 }, maritime: 0, fishing: 1.0, salt: 0, imperial: 0.20, textile: 2.0, zhizao: 1,
    corridor: 1.4, keju: 3.0, gentry: 1.2, hide: 1.2, flee: 0.8, yieldFactor: 1.1, roadQuality: 70, commerceCoefficient: 2.3,
    minxin: 57, corruption: 70, prosperity: 92, development: 92, unrest: 52, taxPressure: 48, armyPressure: 45, officeRisk: 62, compliance: 0.74, skimmingRate: 0.20,
    notes: '南京城是明末东南最大的消费与出版中心；守备太监、六部冗官多，吏治偏浊；京营与操江驻军，军压偏高。'
  },
  'ming-02-p02': {
    name: '苏州府', divisionType: '府', officialPosition: '知府', terrain: '水乡',
    specialResources: '丝绸·棉布·稻米', taxLevel: '重', regionType: 'normal',
    tags: { hasPort: true, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '东南财赋之首，丝织与市镇经济冠绝天下，阊门内外商贾辐辏，太仓刘家港可通海舶。去年缇骑逮周顺昌，市民激变，颜佩韦等五人就义，吴中士民与阉党积怨未消。',
    commerce: 2.6, urban: { fang: 0.15, shi: 0.12, zhen: 0.28, cun: 0.45 }, maritime: 0.35, fishing: 3.0, salt: 0, imperial: 0.30, textile: 4.0, zhizao: 1,
    corridor: 1.3, keju: 5.0, gentry: 1.5, hide: 1.5, flee: 0.9, yieldFactor: 1.35, roadQuality: 68, commerceCoefficient: 2.6,
    minxin: 47, corruption: 72, prosperity: 96, development: 97, unrest: 64, taxPressure: 82, armyPressure: 25, officeRisk: 66, compliance: 0.60, skimmingRate: 0.20,
    notes: '苏州一府税粮占南直隶近四成（洪武秋粮 274 万石）；逋赋积年；天启六年开读之变，民情激愤；织造太监李实在此。'
  },
  'ming-02-p03': {
    name: '松江府', divisionType: '府', officialPosition: '知府', terrain: '水乡',
    specialResources: '棉布·稻米·海盐', taxLevel: '重', regionType: 'normal',
    tags: { hasPort: true, saltRegion: true, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '棉布“衣被天下”，朱泾、枫泾诸镇机杼不绝，华亭董其昌等缙绅名重一时。赋额之重仅次苏州，逋欠积年；浦东下沙一带盐场属两浙，海塘须岁岁修治。',
    commerce: 2.3, urban: { fang: 0.10, shi: 0.10, zhen: 0.30, cun: 0.50 }, maritime: 0.35, fishing: 2.5, salt: 0.10, imperial: 0.25, textile: 3.5, zhizao: 1,
    corridor: 1.0, keju: 3.0, gentry: 1.4, hide: 1.4, flee: 0.9, yieldFactor: 1.3, roadQuality: 62, commerceCoefficient: 2.3,
    minxin: 50, corruption: 66, prosperity: 93, development: 94, unrest: 56, taxPressure: 80, armyPressure: 30, officeRisk: 60, compliance: 0.62, skimmingRate: 0.18,
    notes: '洪武税粮 122 万石，与苏州并称重赋；棉纺织业最盛；沿海有两浙下沙盐场。'
  },
  'ming-02-p04': {
    name: '常州府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '稻米·蚕丝·茶', taxLevel: '重', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '太湖北岸膏腴之地。无锡东林书院前年被毁，去年高攀龙投水殉节，士林余愤犹在；宜兴、武进科第鼎盛，缙绅田连阡陌。西南广德州城一带山乡亦在此境。',
    commerce: 1.5, urban: { fang: 0.08, shi: 0.08, zhen: 0.22, cun: 0.62 }, maritime: 0.05, fishing: 2.0, salt: 0, imperial: 0.10, textile: 1.5, zhizao: 0,
    corridor: 1.3, keju: 4.0, gentry: 1.3, hide: 1.3, flee: 0.9, yieldFactor: 1.25, roadQuality: 65, commerceCoefficient: 1.7,
    minxin: 52, corruption: 64, prosperity: 90, development: 90, unrest: 50, taxPressure: 72, armyPressure: 25, officeRisk: 58, compliance: 0.66, skimmingRate: 0.18,
    notes: '东林党人根据地（东林书院天启五年毁，高攀龙天启六年殉节）；洪武税粮 65 万石。'
  },
  'ming-02-p05': {
    name: '镇江府', divisionType: '府', officialPosition: '知府', terrain: '丘陵',
    specialResources: '漕运·稻米', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '扼长江与运河交汇之口，京口、瓜洲一水之隔，漕船北上必经于此。地狭而冲要，驻军与漕务之费常累及地方。',
    commerce: 1.8, urban: { fang: 0.12, shi: 0.10, zhen: 0.18, cun: 0.60 }, maritime: 0, fishing: 1.2, salt: 0, imperial: 0.05, textile: 1.0, zhizao: 0,
    corridor: 1.5, keju: 2.0, gentry: 1.1, hide: 1.1, flee: 0.8, yieldFactor: 1.1, roadQuality: 66, commerceCoefficient: 1.9,
    minxin: 55, corruption: 64, prosperity: 88, development: 88, unrest: 46, taxPressure: 62, armyPressure: 42, officeRisk: 56, compliance: 0.70, skimmingRate: 0.18,
    notes: '江南运河入江处，漕运枢纽；镇江卫驻军。'
  },
  'ming-02-p06': {
    name: '扬州府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '两淮盐·漕运·稻米', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: true, saltRegion: true, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '两淮都转运盐使司驻节之地，盐商豪富甲于天下，园林声伎之盛冠于江北。泰州、通州沿海盐场星列，灶户煎盐终岁劳苦。',
    commerce: 2.3, urban: { fang: 0.12, shi: 0.12, zhen: 0.18, cun: 0.58 }, maritime: 0.15, fishing: 2.5, salt: 0.60, imperial: 0.05, textile: 0.8, zhizao: 0,
    corridor: 1.4, keju: 2.0, gentry: 1.2, hide: 1.1, flee: 1.0, yieldFactor: 1.0, roadQuality: 64, commerceCoefficient: 2.2,
    minxin: 55, corruption: 74, prosperity: 90, development: 88, unrest: 46, taxPressure: 58, armyPressure: 30, officeRisk: 66, compliance: 0.74, skimmingRate: 0.22,
    notes: '两淮三十盐场，泰州、通州两分司共二十场在扬州府境（约三分之二）；盐政积弊，吏治偏浊。'
  },
  'ming-02-p07': {
    name: '淮安府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '漕运·淮北盐·麦豆', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: true, saltRegion: true, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '漕运总督驻节之所，清江浦舟车鳞集，南北货物于此转输。黄河夺淮入海，堤防屡决，沿河州县水患频仍；盐城、海州一带另有淮北盐场。',
    commerce: 1.5, urban: { fang: 0.08, shi: 0.10, zhen: 0.14, cun: 0.68 }, maritime: 0.15, fishing: 2.5, salt: 0.30, imperial: 0.05, textile: 0.4, zhizao: 0,
    corridor: 1.4, keju: 1.0, gentry: 0.9, hide: 1.0, flee: 1.5, yieldFactor: 0.85, roadQuality: 55, commerceCoefficient: 1.6,
    minxin: 48, corruption: 72, prosperity: 76, development: 74, unrest: 56, taxPressure: 56, armyPressure: 36, officeRisk: 64, compliance: 0.68, skimmingRate: 0.22,
    notes: '淮安分司十场；黄淮交汇，水患频繁；漕运积弊。'
  },
  'ming-02-p08': {
    name: '凤阳府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '麦·豆·淮河渔', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: true },
    description: '太祖龙兴之地，中都城阙与皇陵在焉，中都留守司统守陵诸卫。地瘠多灾，“十年倒有九年荒”，淮北寿、颍、亳、宿诸州民多流徙；合肥、六安一带庐州旧地亦在其境。',
    commerce: 0.6, urban: { fang: 0.05, shi: 0.05, zhen: 0.12, cun: 0.78 }, maritime: 0, fishing: 1.5, salt: 0, imperial: 0.25, textile: 0.4, zhizao: 0,
    corridor: 1.0, keju: 1.0, gentry: 0.8, hide: 0.8, flee: 1.8, yieldFactor: 0.8, roadQuality: 50, commerceCoefficient: 0.9,
    minxin: 42, corruption: 66, prosperity: 58, development: 58, unrest: 68, taxPressure: 60, armyPressure: 46, officeRisk: 58, compliance: 0.64, skimmingRate: 0.18,
    notes: '中都与皇陵役重；淮北水旱频仍，流民多出于此（崇祯八年即有农民军焚皇陵之事，此时已见端倪）。'
  },
  'ming-02-p09': {
    name: '安庆府', divisionType: '府', officialPosition: '知府', terrain: '丘陵',
    specialResources: '稻米·茶·苎麻', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '长江中游门户，扼皖江上下，桐城文风渐盛。明初多由江西饶州与徽州移民垦殖，如今人稠地少，沿江圩田仰赖堤防。',
    commerce: 0.8, urban: { fang: 0.06, shi: 0.06, zhen: 0.12, cun: 0.76 }, maritime: 0, fishing: 1.5, salt: 0, imperial: 0.02, textile: 0.6, zhizao: 0,
    corridor: 1.0, keju: 1.5, gentry: 0.9, hide: 0.9, flee: 1.0, yieldFactor: 1.0, roadQuality: 52, commerceCoefficient: 1.1,
    minxin: 56, corruption: 60, prosperity: 76, development: 74, unrest: 42, taxPressure: 55, armyPressure: 30, officeRisk: 54, compliance: 0.74, skimmingRate: 0.16,
    notes: '洪武时土著仅占两成余，余为江西、徽州移民（曹树基）；人均田地为南直隶最少之列。'
  },
  'ming-02-p10': {
    name: '徽州府', divisionType: '府', officialPosition: '知府', terrain: '山地',
    specialResources: '茶·墨·纸·木材', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: false, imperialDomain: false },
    description: '山多田少，“八分半山一分水，半分农田和庄园”，民多出外经商，徽商足迹遍天下。茶、墨、纸、木为大宗，宗族祠堂林立，讼风亦盛。',
    commerce: 1.3, urban: { fang: 0.08, shi: 0.08, zhen: 0.16, cun: 0.68 }, maritime: 0, fishing: 0.3, salt: 0, imperial: 0.02, textile: 0.5, zhizao: 0,
    corridor: 0.7, keju: 2.5, gentry: 1.2, hide: 1.1, flee: 0.7, yieldFactor: 0.75, roadQuality: 42, commerceCoefficient: 1.6,
    minxin: 60, corruption: 58, prosperity: 84, development: 80, unrest: 36, taxPressure: 55, armyPressure: 20, officeRisk: 52, compliance: 0.80, skimmingRate: 0.15,
    notes: '人均田地仅四五亩（徐国利 2020）；徽商财富汇回本籍，宗族势大。'
  },
  'ming-02-p11': {
    name: '宁国府', divisionType: '府', officialPosition: '知府', terrain: '丘陵',
    specialResources: '宣纸·宣笔·茶·竹', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: false, imperialDomain: false },
    description: '皖南丘陵，泾县所出宣纸、宣笔名闻天下。山乡以茶竹为业，宣城、南陵沿水一带稻田稍腴。',
    commerce: 0.8, urban: { fang: 0.06, shi: 0.06, zhen: 0.12, cun: 0.76 }, maritime: 0, fishing: 0.5, salt: 0, imperial: 0.02, textile: 0.6, zhizao: 0,
    corridor: 0.8, keju: 2.0, gentry: 1.0, hide: 1.0, flee: 0.8, yieldFactor: 0.85, roadQuality: 46, commerceCoefficient: 1.2,
    minxin: 58, corruption: 60, prosperity: 78, development: 76, unrest: 38, taxPressure: 55, armyPressure: 20, officeRisk: 52, compliance: 0.78, skimmingRate: 0.16,
    notes: '泾县宣纸；洪武田土 775 万亩而人口 53 万，山地多，折实田远少于册面。'
  },
  'ming-02-p12': {
    name: '太平府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '稻米·鱼·竹木', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '当涂、芜湖、繁昌三县沿江，芜湖为长江商埠，工部抽分厂设于此。北岸和州、含山与庐州无为、巢县一带湖圩相连，亦在其境。',
    commerce: 1.4, urban: { fang: 0.08, shi: 0.10, zhen: 0.16, cun: 0.66 }, maritime: 0, fishing: 1.5, salt: 0, imperial: 0.02, textile: 0.5, zhizao: 0,
    corridor: 1.1, keju: 1.0, gentry: 1.0, hide: 1.0, flee: 0.9, yieldFactor: 1.05, roadQuality: 56, commerceCoefficient: 1.5,
    minxin: 57, corruption: 64, prosperity: 82, development: 80, unrest: 42, taxPressure: 55, armyPressure: 26, officeRisk: 56, compliance: 0.75, skimmingRate: 0.18,
    notes: '芜湖抽分厂（竹木税）；巢湖、无为一带圩田。'
  },
  'ming-02-p13': {
    name: '池州府', divisionType: '府', officialPosition: '知府', terrain: '山地',
    specialResources: '茶·木材·铜', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '九华山佛寺香火甚盛，铜陵古称产铜之地。境内多山林，户口稀少；北岸庐江一带亦归此统摄。',
    commerce: 0.7, urban: { fang: 0.05, shi: 0.05, zhen: 0.10, cun: 0.80 }, maritime: 0, fishing: 1.5, salt: 0, imperial: 0.02, textile: 0.3, zhizao: 0,
    corridor: 0.8, keju: 0.8, gentry: 0.8, hide: 0.9, flee: 0.9, yieldFactor: 0.8, roadQuality: 45, commerceCoefficient: 1.0,
    minxin: 58, corruption: 58, prosperity: 70, development: 68, unrest: 36, taxPressure: 50, armyPressure: 20, officeRisk: 50, compliance: 0.78, skimmingRate: 0.15,
    notes: '南直隶户口最少的府之一；九华山。'
  },
  'ming-02-p14': {
    name: '徐州', divisionType: '州', officialPosition: '知州', terrain: '平原',
    specialResources: '麦·豆·煤', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: false, imperialDomain: false },
    description: '运河与黄河交汇的咽喉，徐州洪、吕梁洪险滩漕船艰行，北接山东、西连河南，兵家必争。天启四年河决灌城，州治迁于云龙山。',
    commerce: 1.0, urban: { fang: 0.07, shi: 0.07, zhen: 0.12, cun: 0.74 }, maritime: 0, fishing: 0.5, salt: 0, imperial: 0.02, textile: 0.3, zhizao: 0,
    corridor: 1.5, keju: 0.6, gentry: 0.8, hide: 0.9, flee: 1.5, yieldFactor: 0.85, roadQuality: 56, commerceCoefficient: 1.1,
    minxin: 46, corruption: 66, prosperity: 62, development: 60, unrest: 58, taxPressure: 56, armyPressure: 50, officeRisk: 58, compliance: 0.68, skimmingRate: 0.18,
    notes: '直隶州，长官知州；天启四年黄河决口，州治迁云龙山（《明史·地理志》卷40）。'
  }
};

// 省节点描述：原文漏了徽州府，又把直隶州徐州算作府，顺手订正
const provinceDescription = '留都应天府所在，财赋半天下。下辖应天、凤阳、淮安、扬州、苏州、松江、常州、镇江、庐州、安庆、太平、池州、宁国、徽州十四府，与徐、滁、和、广德四直隶州。苏松赋甲天下。';

module.exports = { province: '南直隶', UNITS, BLOCKS, provinceDescription };
