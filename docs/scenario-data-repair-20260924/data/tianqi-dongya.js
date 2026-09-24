// 天启剧本·东亚诸国 42 块（朝鲜八道、日本本州 8 九州 7 四国 4、虾夷地 8、大越 7）
//
// 天启七年（1627）：
//   朝鲜——仁祖李倧四年前废光海君即位（仁祖反正），三年前李适叛兵一度攻入汉城；今年正月后金阿敏率军渡鸭绿江，
//         连陷义州、安州、平壤，国王避入江华岛，三月结「兄弟之盟」而后金退兵（丁卯胡乱）。
//   日本——宽永四年，三代将军德川家光在江户，大御所秀忠仍握实权；幕府今年收回天皇所赐紫衣（紫衣事件），
//         长崎、岛原禁教日严；荷兰人在平户设商馆，葡萄牙船入长崎；萨摩岛津氏控制琉球。
//   虾夷地——松前氏据渡岛半岛南端，垄断与阿伊努的交易；其余沿海与内陆是阿伊努诸部的渔猎之地。
//   大越——后黎皇帝在升龙为郑主郑梉所挟，南方阮主阮福源据顺化以南自立；今年郑军南攻阮氏，郑阮战争由此开端。
// 人口：朝鲜按后世各道人口比例分；日本按畿内、关东、东海、北陆、奥羽诸区的规模分；虾夷地按和人据点与阿伊努诸部估；
// 大越按红河三角洲、清乂、顺广诸区分。各省数字都是剧本原值，只重分到各块。
// 各块沿用省里的征到比例与截留率（与改前各叶子相同）；聚落写比例的省份各块照抄。
// 剧本的「严寒歉获」改为正规灾异；「内战初起」不是灾害，写进描述。
'use strict';

const { block } = require('./lib-blocks');

const unit = (name, mouths, grain, land, countyCount) => ({
  name, countyCount, weights: { pop: mouths, households: mouths, grain, land },
  basis: '外国无本朝册籍，按其国诸区人口规模估。'
});

// ---------------------------------------------------------------- 朝鲜
const JOSEON = {
  faction: '朝鲜', province: '朝鲜八道', fiscalRates: 'province',
  UNITS: [
    unit('京畿道', 903500, 12, 11, 30),
    unit('黄海道', 625500, 9, 10, 22),
    unit('平安道', 903500, 10, 12, 30),
    unit('咸镜道', 625500, 6, 7, 20),
    unit('江原道', 417000, 5, 5, 20),
    unit('忠清道', 834000, 13, 13, 22),
    unit('全罗道', 1181500, 19, 20, 26),
    unit('庆尚道', 1459500, 20, 22, 24)
  ],
  BLOCKS: {
    京畿道: block({
      name: '京畿道', terrain: '丘陵', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '稻米·人参·书籍', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '王都汉城所在。四年前仁祖反正废光海君，三年前李适叛兵一度攻入京城；今年正月后金兵南下，国王避入江华岛，三月在江都与后金结兄弟之盟而退兵。',
      commerce: 1.8, maritime: 0.1, salt: 0.1, fishing: 0.05, corridor: 1.4, keju: 0,
      idx: [48, 48, 54, 54, 66, 50, 82, 66], fisc: [0.55, 0.12],
      notes: '仁祖反正（1623）；李适之乱（1624）；丁卯胡乱（1627）。'
    }),
    黄海道: block({
      name: '黄海道', terrain: '丘陵', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '稻米·盐·鱼', tags: { saltRegion: true, fishingRegion: true, mineralRegion: true },
      description: '汉城以北、平安道以南的沿海之道，今年后金兵南下攻至平山，地方残破；海州、延安一带产盐与鱼。',
      commerce: 1.0, maritime: 0.1, salt: 0.1, mineral: 0.1, horse: 0.1, fishing: 0.1, corridor: 1.2, keju: 0,
      idx: [42, 46, 42, 42, 76, 48, 84, 66], fisc: [0.55, 0.12],
      notes: '丁卯胡乱中后金兵至平山。'
    }),
    平安道: block({
      name: '平安道', terrain: '丘陵', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '粮·人参·铁', tags: { hasPort: true, saltRegion: true, mineralRegion: true, horseRegion: true },
      description: '朝鲜西北门户。今年正月后金兵自义州渡鸭绿江，连陷定州、安州、平壤，所过焚掠；毛文龙的东江军据海中椵岛，与后金隔江相持，本道军民两受其累。',
      commerce: 0.9, maritime: 0.2, salt: 0.1, mineral: 0.2, horse: 0.2, fishing: 0.05, corridor: 1.3, keju: 0, flee: 1.5,
      idx: [34, 48, 34, 34, 84, 48, 92, 68], fisc: [0.55, 0.12],
      notes: '义州、安州、平壤相继失陷（丁卯胡乱）。'
    }),
    咸镜道: block({
      name: '咸镜道', terrain: '山地', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '银·鱼·人参', tags: { mineralRegion: true, horseRegion: true, fishingRegion: true, saltRegion: true },
      description: '东北狭长的山地与海岸，北有六镇与野人女真相邻，端川银矿闻名；地寒田少，民以捕鱼、采参为业。',
      commerce: 0.7, salt: 0.05, mineral: 0.4, kuangchang: 1, horse: 0.2, fishing: 0.15, corridor: 1.0, keju: 0,
      idx: [44, 46, 36, 36, 72, 46, 84, 64], fisc: [0.55, 0.12],
      notes: '端川银矿；北关六镇。'
    }),
    江原道: block({
      name: '江原道', terrain: '山地', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '木材·鱼·药材', tags: { mineralRegion: true, fishingRegion: true, saltRegion: true },
      description: '太白山脉纵贯的山地之道，岭东沿海渔盐，岭西山田稀少，金刚山佛寺林立。',
      commerce: 0.7, salt: 0.05, mineral: 0.1, fishing: 0.1, corridor: 0.9, keju: 0,
      idx: [48, 44, 38, 38, 68, 46, 78, 64], fisc: [0.55, 0.12],
      notes: '金刚山。'
    }),
    忠清道: block({
      name: '忠清道', terrain: '丘陵', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '稻米·苎麻·盐', tags: { saltRegion: true, fishingRegion: true },
      description: '汉城以南的湖西之地，三年前李适之乱时国王曾避入公州；稻米丰饶，两班士族聚居。',
      commerce: 1.0, salt: 0.15, fishing: 0.1, corridor: 1.2, keju: 0,
      idx: [50, 46, 50, 50, 66, 50, 80, 66], fisc: [0.55, 0.12],
      notes: '李适之乱时仁祖避公州。'
    }),
    全罗道: block({
      name: '全罗道', terrain: '平原', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '稻米·盐·济州马', tags: { hasPort: true, saltRegion: true, fishingRegion: true, horseRegion: true, mineralRegion: true },
      description: '湖南平原为朝鲜第一粮仓，漕粮北运汉城；海外济州岛牧马闻名，沿海多盐场渔村。',
      commerce: 1.1, maritime: 0.2, salt: 0.25, mineral: 0.1, horse: 0.5, fishing: 0.2, corridor: 1.1, keju: 0,
      idx: [48, 46, 52, 52, 70, 52, 80, 66], fisc: [0.55, 0.12],
      notes: '济州牧马。'
    }),
    庆尚道: block({
      name: '庆尚道', terrain: '盆地', divisionType: '道', regionType: 'fanbang', officialPosition: '观察使',
      specialResources: '稻米·棉布·倭馆贸易', tags: { hasPort: true, saltRegion: true, fishingRegion: true, mineralRegion: true },
      description: '洛东江流域的岭南之地，儒学之乡；釜山倭馆依己酉约条与对马岛通商，壬辰倭乱的创伤尚未全复。',
      commerce: 1.2, maritime: 0.4, salt: 0.2, mineral: 0.1, fishing: 0.25, corridor: 1.2, keju: 0,
      idx: [50, 46, 52, 52, 66, 50, 80, 66], fisc: [0.55, 0.12],
      notes: '釜山倭馆（己酉约条，1609）。'
    })
  },
  regionMeans: { development: 46, unrest: 71, taxPressure: 49, armyPressure: 83, officeRisk: 66 }
};

// ---------------------------------------------------------------- 日本
const HONSHU = {
  faction: '日本幕府', province: '本州', fiscalRates: 'province',
  UNITS: [
    unit('江户', 3500000, 22, 22, 2),
    unit('京都', 2300000, 14, 14, 1),
    unit('大坂', 2500000, 15, 14, 1),
    unit('仙台', 1500000, 10, 11, 0.5),
    unit('金泽', 1500000, 10, 11, 0.5),
    unit('尾张', 2000000, 13, 13, 1),
    unit('骏府', 1300000, 8, 8, 1),
    unit('会津', 1900000, 8, 7, 0.5)
  ],
  BLOCKS: {
    江户: block({
      name: '江户', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '征夷大将军', governor: '德川家光',
      specialResources: '稻米·行德盐·商货', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '关东平原上的幕府所在，三代将军德川家光居本丸，大御所秀忠居西之丸，诸大名轮流参府，城下町日益繁盛；今年幕府收回天皇所赐紫衣，与京都朝廷龃龉。',
      commerce: 1.8, maritime: 0.25, salt: 0.2, fishing: 0.2, corridor: 1.4, keju: 0,
      idx: [70, 18, 72, 72, 54, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '紫衣事件（宽永四年）。'
    }),
    京都: block({
      name: '京都', terrain: '盆地', divisionType: '都', regionType: 'foreign_shogunate', officialPosition: '所司代',
      specialResources: '丝织·漆器·书籍', tags: { mineralRegion: false },
      description: '天皇与公家所居的旧都，京都所司代监视朝廷；西阵织、漆器、刊本行销全国。后水尾天皇因紫衣事件与幕府不睦。',
      commerce: 1.8, maritime: 0.1, fishing: 0.05, corridor: 1.3, keju: 0,
      idx: [66, 18, 70, 70, 58, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '京都所司代。'
    }),
    大坂: block({
      name: '大坂', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '城代',
      specialResources: '米市·商货·银', tags: { hasPort: true, saltRegion: true, fishingRegion: true, mineralRegion: true },
      description: '丰臣氏灭亡后由幕府直辖、重建的大坂城下，诸藩年贡米在此集散，号为天下的厨房；堺与兵库的商船往来濑户内海，石见、生野的白银由此流通。',
      commerce: 2.4, maritime: 0.4, salt: 0.35, mineral: 0.4, fishing: 0.15, corridor: 1.3, keju: 0,
      idx: [66, 18, 74, 74, 56, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '大坂城代；大坂之阵（1615）后重建。'
    }),
    仙台: block({
      name: '仙台', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·马·鱼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '奥州伊达政宗的仙台藩，开垦新田、疏通北上川；十余年前曾遣支仓常长出使罗马。',
      commerce: 1.1, maritime: 0.05, salt: 0.1, fishing: 0.15, corridor: 1.0, keju: 0,
      idx: [68, 18, 64, 64, 56, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '庆长遣欧使节（1613）。'
    }),
    金泽: block({
      name: '金泽', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·金·漆器', tags: { hasPort: true, saltRegion: true, fishingRegion: true, mineralRegion: true },
      description: '北陆加贺前田氏的百万石领地，为外样大名之冠；日本海沿岸航运渐兴，海上佐渡金山为幕府直辖。',
      commerce: 1.2, maritime: 0.07, salt: 0.1, mineral: 0.4, kuangchang: 1, fishing: 0.15, corridor: 1.0, keju: 0,
      idx: [68, 18, 66, 66, 54, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '加贺百万石；佐渡金山。'
    }),
    尾张: block({
      name: '尾张', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·陶瓷·棉', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '德川御三家之首的尾张藩，名古屋城雄踞浓尾平原，濑户烧陶瓷行销各地。',
      commerce: 1.3, maritime: 0.08, salt: 0.15, fishing: 0.1, corridor: 1.3, keju: 0,
      idx: [70, 18, 70, 70, 52, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '尾张德川家。'
    }),
    骏府: block({
      name: '骏府', terrain: '丘陵', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '茶·稻米·鱼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '家康隐居终老之地，东海道要冲；今为将军之弟德川忠长的封地，忠长行事乖张，兄弟嫌隙渐深。',
      commerce: 1.1, maritime: 0.05, salt: 0.1, fishing: 0.1, corridor: 1.4, keju: 0,
      idx: [66, 18, 64, 64, 58, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '德川忠长（骏河大纳言）。'
    }),
    会津: block({
      name: '会津', terrain: '山地', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·漆器·银', tags: { mineralRegion: true, fishingRegion: true },
      description: '奥羽南部的会津盆地，今年蒲生忠乡无嗣而卒，幕府移加藤嘉明入封；出羽、越后一带山多雪深。',
      commerce: 0.9, mineral: 0.2, fishing: 0.1, corridor: 0.9, keju: 0,
      idx: [66, 18, 58, 58, 58, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '加藤嘉明入封会津（宽永四年）。'
    })
  },
  regionMeans: { development: 68, unrest: 58, taxPressure: 56, armyPressure: 83, officeRisk: 49 }
};

const KYUSHU = {
  faction: '日本幕府', province: '九州', fiscalRates: 'province',
  UNITS: [
    unit('博多', 640000, 20, 20, 1),
    unit('熊本', 620000, 20, 21, 1),
    unit('鹿儿岛', 600000, 18, 18, 1),
    unit('长崎', 250000, 6, 5, 0.5),
    unit('平户', 220000, 6, 6, 0.5),
    unit('小仓', 460000, 15, 15, 1),
    unit('日向', 310000, 10, 10, 0.5)
  ],
  BLOCKS: {
    博多: block({
      name: '博多', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '商货·稻米·鱼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '筑前黑田氏的福冈城下，博多商人自古经营大陆与朝鲜贸易，港町繁盛。',
      commerce: 1.4, maritime: 0.12, salt: 0.2, fishing: 0.2, corridor: 1.2, keju: 0,
      idx: [60, 18, 60, 60, 60, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '福冈藩黑田氏。'
    }),
    熊本: block({
      name: '熊本', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·马·银', tags: { saltRegion: true, fishingRegion: true, mineralRegion: true },
      description: '肥后加藤氏的熊本城，加藤清正所筑坚城；清正死后其子忠广年幼，家臣争权，幕府侧目。',
      commerce: 1.0, maritime: 0.03, salt: 0.2, mineral: 0.5, fishing: 0.15, corridor: 1.1, keju: 0,
      idx: [58, 18, 58, 58, 64, 56, 84, 49], fisc: [0.42, 0.08],
      notes: '加藤忠广。'
    }),
    鹿儿岛: block({
      name: '鹿儿岛', terrain: '丘陵', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·砂糖·琉球贸易', tags: { hasPort: true, saltRegion: true, fishingRegion: true, mineralRegion: true },
      description: '萨摩岛津氏的领国，庆长十四年出兵琉球，挟琉球王国向明朝进贡以取贸易之利；武士比例冠于诸藩。',
      commerce: 1.1, maritime: 0.1, salt: 0.2, mineral: 0.5, kuangchang: 1, fishing: 0.2, corridor: 0.9, keju: 0,
      idx: [58, 18, 56, 56, 58, 56, 84, 49], fisc: [0.42, 0.08],
      notes: '萨摩入侵琉球（1609）。'
    }),
    长崎: block({
      name: '长崎', terrain: '沿海', divisionType: '港', regionType: 'foreign_shogunate', officialPosition: '奉行',
      specialResources: '生丝·白银·南蛮货', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '幕府直辖的对外港口，长崎奉行掌管；葡萄牙船年年运来中国生丝换取白银，唐船亦多来泊。奉行严禁天主教，近年搜捕殉教者不绝。',
      commerce: 2.6, maritime: 0.45, salt: 0.1, fishing: 0.1, corridor: 1.0, keju: 0,
      idx: [54, 18, 62, 62, 66, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '长崎奉行；禁教。'
    }),
    平户: block({
      name: '平户', terrain: '岛屿', divisionType: '港', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '商货·鱼·白银', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '肥前松浦氏的平户岛，荷兰东印度公司在此设商馆，与葡萄牙人争夺对日贸易；郑芝龙早年亦曾寓居于此。',
      commerce: 2.0, maritime: 0.25, salt: 0.1, fishing: 0.1, corridor: 0.8, keju: 0,
      idx: [58, 18, 58, 58, 60, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '平户荷兰商馆（1609）。'
    }),
    小仓: block({
      name: '小仓', terrain: '平原', divisionType: '城下', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·煤·鱼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '丰前细川氏的小仓城，扼关门海峡，九州与本州往来的门户。',
      commerce: 1.1, maritime: 0.05, salt: 0.1, fishing: 0.15, corridor: 1.3, keju: 0,
      idx: [60, 18, 58, 58, 58, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '小仓藩细川氏。'
    }),
    日向: block({
      name: '日向', terrain: '山地', divisionType: '国', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '木材·稻米·马', tags: { saltRegion: true, fishingRegion: true },
      description: '九州东南的日向国，延冈、饫肥诸小藩分治，山深林密。',
      commerce: 0.8, salt: 0.1, fishing: 0.1, corridor: 0.8, keju: 0,
      idx: [58, 18, 50, 50, 58, 56, 80, 49], fisc: [0.42, 0.08],
      notes: '延冈、饫肥诸藩。'
    })
  },
  regionMeans: { development: 58, unrest: 63, taxPressure: 56, armyPressure: 83, officeRisk: 49 }
};

const SHIKOKU = {
  faction: '日本幕府', province: '四国', fiscalRates: 'province',
  UNITS: [
    unit('阿波', 315000, 30, 30, 1),
    unit('赞岐', 231000, 22, 22, 1),
    unit('伊予', 315000, 30, 30, 1),
    unit('土佐', 189000, 18, 18, 1)
  ],
  BLOCKS: {
    阿波: block({
      name: '阿波', terrain: '丘陵', divisionType: '国', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '蓝靛·盐·稻米', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '蜂须贺氏的德岛藩，吉野川流域种蓝制靛，鸣门海峡产盐。',
      commerce: 1.1, maritime: 0.3, salt: 0.3, fishing: 0.3, corridor: 1.0, keju: 0,
      idx: [50, 18, 52, 52, 66, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '德岛藩。'
    }),
    赞岐: block({
      name: '赞岐', terrain: '平原', divisionType: '国', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '盐·稻米·鱼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '生驹氏的高松藩，濑户内海沿岸平原少雨，多开溜池灌田，海滨晒盐。',
      commerce: 1.0, maritime: 0.3, salt: 0.4, fishing: 0.25, corridor: 1.0, keju: 0,
      idx: [50, 18, 50, 50, 66, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '高松藩生驹氏。'
    }),
    伊予: block({
      name: '伊予', terrain: '丘陵', divisionType: '国', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '稻米·鱼·木蜡', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '四国西北的伊予，今年松山的加藤嘉明移封会津，蒲生忠知入松山；宇和岛、今治诸藩分治，濑户内海水军旧地。',
      commerce: 1.0, maritime: 0.3, salt: 0.2, fishing: 0.3, corridor: 1.0, keju: 0,
      idx: [50, 18, 50, 50, 68, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '松山藩易主（宽永四年）。'
    }),
    土佐: block({
      name: '土佐', terrain: '山地', divisionType: '国', regionType: 'foreign_shogunate', officialPosition: '藩主',
      specialResources: '木材·鲣鱼·纸', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '山内氏的土佐藩，背靠四国山地、面向太平洋，以木材、和纸与鲣鱼为利。',
      commerce: 0.8, maritime: 0.1, salt: 0.1, fishing: 0.15, corridor: 0.8, keju: 0,
      idx: [50, 18, 46, 46, 68, 56, 84, 49], fisc: [0.42, 0.08],
      notes: '土佐藩山内氏。'
    })
  },
  regionMeans: { development: 50, unrest: 67, taxPressure: 56, armyPressure: 83, officeRisk: 49 }
};

// ---------------------------------------------------------------- 虾夷地
const COLD = { type: 'cold', severity: 1, startTurn: 1, note: '严寒歉获' };
const EZO = {
  faction: '虾夷地与松前氏', province: '北海道', fiscalRates: 'province',
  UNITS: [
    unit('松前', 12000, 10, 10, 1),
    unit('箱馆', 6000, 4, 3, 0.5),
    unit('江差', 6000, 4, 3, 0.5),
    unit('石狩', 11000, 3, 1, 0.1),
    unit('胆振', 9000, 2, 1, 0.1),
    unit('十胜', 7500, 1, 1, 0.1),
    unit('钏路', 6500, 1, 1, 0.1),
    unit('宗谷', 7000, 1, 1, 0.1)
  ],
  BLOCKS: {
    松前: block({
      name: '松前', terrain: '沿海', divisionType: '城下', regionType: 'frontier_trade_zone', officialPosition: '藩主', governor: '松前公广',
      specialResources: '鲱鱼·海带·交易货', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '渡岛半岛南端的松前氏城下，受幕府认可独占与阿伊努的交易，以米、酒、铁器换取鲑鱼、海带、毛皮。',
      commerce: 1.6, maritime: 0.5, salt: 1, fishing: 0.2, corridor: 1.0, keju: 0,
      idx: [36, 28, 40, 40, 80, 70, 80, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '松前藩交易独占（1604 年黑印状）。'
    }),
    箱馆: block({
      name: '箱馆', terrain: '沿海', divisionType: '港', regionType: 'frontier_trade_zone', officialPosition: '代官',
      specialResources: '海带·鱼', tags: { hasPort: true, fishingRegion: true },
      description: '津轻海峡北岸的和人渔港，与本州津轻往来最近，海带采集为业。',
      commerce: 1.2, maritime: 0.15, fishing: 0.15, corridor: 0.9, keju: 0,
      idx: [34, 28, 34, 34, 82, 70, 80, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '和人地。'
    }),
    江差: block({
      name: '江差', terrain: '沿海', divisionType: '港', regionType: 'frontier_trade_zone', officialPosition: '代官',
      specialResources: '鲱鱼·木材', tags: { hasPort: true, fishingRegion: true },
      description: '渡岛半岛西岸的鲱鱼渔场，春汛时渔船云集，和人渐来定居。',
      commerce: 1.2, maritime: 0.2, fishing: 0.25, corridor: 0.9, keju: 0,
      idx: [34, 28, 34, 34, 82, 70, 80, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '和人地。'
    }),
    石狩: block({
      name: '石狩', terrain: '林地', divisionType: '部', regionType: 'frontier_trade_zone', officialPosition: '部落首领',
      specialResources: '鲑鱼·毛皮', tags: { fishingRegion: true },
      description: '石狩川流域的阿伊努诸部，秋季鲑鱼溯河，为虾夷地物产最丰之处，松前商船定期来此交易。',
      commerce: 0.7, maritime: 0.05, fishing: 0.15, corridor: 0.6, keju: 0,
      idx: [26, 28, 26, 26, 88, 70, 84, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '阿伊努地。'
    }),
    胆振: block({
      name: '胆振', terrain: '林地', divisionType: '部', regionType: 'frontier_trade_zone', officialPosition: '部落首领',
      specialResources: '鱼·毛皮', tags: { fishingRegion: true },
      description: '内浦湾一带的阿伊努诸部，有珠山、白老沿海渔猎为生。',
      commerce: 0.6, maritime: 0.03, fishing: 0.05, corridor: 0.6, keju: 0,
      idx: [26, 28, 24, 24, 88, 70, 84, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '阿伊努地。'
    }),
    十胜: block({
      name: '十胜', terrain: '寒地', divisionType: '部', regionType: 'frontier_trade_zone', officialPosition: '部落首领',
      specialResources: '毛皮·鹿', tags: { fishingRegion: true },
      description: '日高山脉以东的十胜平原，阿伊努诸部猎鹿捕鱼，与松前少有往来。',
      commerce: 0.5, maritime: 0.01, fishing: 0.05, corridor: 0.5, keju: 0,
      idx: [24, 28, 22, 22, 90, 70, 86, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '阿伊努地。'
    }),
    钏路: block({
      name: '钏路', terrain: '寒地', divisionType: '部', regionType: 'frontier_trade_zone', officialPosition: '部落首领',
      specialResources: '鱼·海豹皮', tags: { fishingRegion: true },
      description: '东部太平洋岸的阿伊努诸部，湿原与海岸相连，渔猎海兽，东与千岛诸岛往来。',
      commerce: 0.5, maritime: 0.01, fishing: 0.1, corridor: 0.5, keju: 0,
      idx: [24, 28, 22, 22, 90, 70, 86, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '阿伊努地。'
    }),
    宗谷: block({
      name: '宗谷', terrain: '寒地', divisionType: '部', regionType: 'frontier_trade_zone', officialPosition: '部落首领',
      specialResources: '毛皮·山丹锦', tags: { hasPort: true, fishingRegion: true },
      description: '虾夷地北端，阿伊努人渡海与库页岛、黑龙江下游诸部交易，山丹锦与鹰羽由此南传。',
      commerce: 0.6, maritime: 0.05, fishing: 0.05, corridor: 0.5, keju: 0,
      idx: [24, 28, 22, 22, 90, 70, 86, 42], fisc: [0.42, 0.14],
      disasterRecord: [COLD],
      notes: '山丹交易。'
    })
  },
  regionMeans: { development: 29, unrest: 87, taxPressure: 70, armyPressure: 83, officeRisk: 42 }
};

// ---------------------------------------------------------------- 大越
const DAIVIET = {
  faction: '大越黎郑阮格局', province: '交趾', fiscalRates: 'province',
  UNITS: [
    unit('升龙', 1600000, 30, 30, 1),
    unit('清化', 900000, 16, 16, 1),
    unit('乂安', 700000, 12, 12, 1),
    unit('顺化', 600000, 10, 10, 1),
    unit('广南', 700000, 12, 12, 0.5),
    unit('广义', 400000, 7, 7, 0.25),
    unit('占城旧地', 300000, 5, 5, 0.25)
  ],
  BLOCKS: {
    升龙: block({
      name: '升龙', terrain: '水乡', divisionType: '京', regionType: 'foreign_kingdom_split', officialPosition: '郑主', governor: '郑梉',
      specialResources: '稻米·丝·漆器', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '红河三角洲上的东京升龙，后黎皇帝黎神宗居宫中，实权在郑主郑梉的王府；今年郑军南攻阮氏，郑阮战争开端。庯宪港有华商与葡萄牙、日本商人往来。',
      commerce: 1.6, maritime: 0.25, salt: 0.15, fishing: 0.2, corridor: 1.3, keju: 0,
      idx: [52, 18, 56, 56, 64, 56, 84, 49], fisc: [0.42, 0.08],
      notes: '郑阮战争（1627 年起）。'
    }),
    清化: block({
      name: '清化', terrain: '平原', divisionType: '镇', regionType: 'foreign_kingdom_split', officialPosition: '镇守',
      specialResources: '稻米·盐·木材', tags: { saltRegion: true, fishingRegion: true },
      description: '黎朝与郑氏的发祥之地，马江平原产稻，为郑主南征的后方兵源。',
      commerce: 1.0, maritime: 0.05, salt: 0.2, fishing: 0.15, corridor: 1.1, keju: 0,
      idx: [52, 18, 50, 50, 64, 56, 84, 49], fisc: [0.42, 0.08],
      notes: '黎、郑故乡。'
    }),
    乂安: block({
      name: '乂安', terrain: '沿海', divisionType: '镇', regionType: 'foreign_kingdom_split', officialPosition: '镇守',
      specialResources: '稻米·盐·鱼', tags: { saltRegion: true, fishingRegion: true },
      description: '郑氏南境，与阮氏以灵江相隔；今年郑军由此南下，屯兵筹粮，民多困于征役。',
      commerce: 0.9, maritime: 0.05, salt: 0.2, fishing: 0.15, corridor: 1.1, keju: 0,
      idx: [46, 18, 46, 46, 72, 56, 90, 49], fisc: [0.42, 0.08],
      notes: '郑阮交战前线。'
    }),
    顺化: block({
      name: '顺化', terrain: '沿海', divisionType: '镇', regionType: 'foreign_kingdom_split', officialPosition: '阮主', governor: '阮福源',
      specialResources: '稻米·木材·鱼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '阮主阮福源的府治，去年移府福安；阮氏拒纳郑主赋税，谋臣陶维慈新投阮氏，献守御之策。',
      commerce: 1.1, maritime: 0.1, salt: 0.15, fishing: 0.15, corridor: 1.1, keju: 0,
      idx: [50, 18, 50, 50, 66, 56, 86, 49], fisc: [0.42, 0.08],
      notes: '阮主府治；陶维慈。'
    }),
    广南: block({
      name: '广南', terrain: '沿海', divisionType: '营', regionType: 'foreign_kingdom_split', officialPosition: '镇守',
      specialResources: '生丝·沉香·商货', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
      description: '阮氏的财源所在，会安港有日本町与唐人街，葡萄牙、日本商船年年来泊，以生丝、沉香、砂糖交易白银。',
      commerce: 2.2, maritime: 0.45, salt: 0.1, fishing: 0.15, corridor: 1.1, keju: 0,
      idx: [52, 18, 58, 58, 62, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '会安港。'
    }),
    广义: block({
      name: '广义', terrain: '沿海', divisionType: '府', regionType: 'foreign_kingdom_split', officialPosition: '镇守',
      specialResources: '稻米·糖·鱼', tags: { saltRegion: true, fishingRegion: true },
      description: '广南以南的沿海平原，阮氏移民垦殖，种稻制糖。',
      commerce: 0.9, maritime: 0.05, salt: 0.1, fishing: 0.1, corridor: 0.9, keju: 0,
      idx: [50, 18, 48, 48, 64, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '阮氏垦殖。'
    }),
    占城旧地: block({
      name: '占城旧地', terrain: '沿海', divisionType: '府', regionType: 'foreign_kingdom_split', officialPosition: '镇守',
      specialResources: '沉香·象·稻米', tags: { saltRegion: true, fishingRegion: true },
      description: '占城国故地，阮氏近年南拓设富安营，占人与越人杂处，南方占城余国尚存。',
      commerce: 0.8, maritime: 0.05, salt: 0.1, fishing: 0.1, corridor: 0.8, keju: 0,
      idx: [48, 18, 42, 42, 68, 56, 82, 49], fisc: [0.42, 0.08],
      notes: '富安营（1611）。'
    })
  },
  regionMeans: { development: 50, unrest: 67, taxPressure: 56, armyPressure: 83, officeRisk: 49 }
};

module.exports = [JOSEON, HONSHU, KYUSHU, SHIKOKU, EZO, DAIVIET];
