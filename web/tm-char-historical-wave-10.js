// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-10.js
// Domain: NPC / 历史人物 data
// 来源·波 10
// (Phase 2 split·from tm-char-historical-profiles-ext.js·12 waves)
//
// Owns:
//   - 本波历史人物数据 (与其他 wave + base 共用 HISTORICAL_CHAR_PROFILES)
// Does not own:
//   - 角色 schema (→ tm-char-full-schema.js)
//   - autogen (→ tm-char-autogen.js)
//   - base 27 条 (→ tm-char-historical-profiles.js)
// Public API:
//   - HISTORICAL_CHAR_PROFILES (global·via Object.assign)
// Depends on:
//   - global HISTORICAL_CHAR_PROFILES (initialized by tm-char-historical-profiles.js)
// Used by:
//   - tm-npc-engine / tm-char-autogen / tm-char-historical-profiles consumers
// Tests:
//   - official-scenario-smoke
// Refactor notes:
//   - Phase 2 split done·原 tm-char-historical-profiles-ext.js (10298) → 12 wave 文件
//   - Phase 5 namespace·TM.Char.Historical
// ============================================================

(function(global){
  'use strict';
  if (!global.HISTORICAL_CHAR_PROFILES) {
    global.HISTORICAL_CHAR_PROFILES = {};
  }
  var WAVE_PROFILES = {
    pingyuanJun: {
      id: 'pingyuanJun', name: '赵胜', zi: '',
      birthYear: -308, deathYear: -251, alternateNames: ['平原君'],
      era: '战国', dynasty: '赵', role: 'regent',
      title: '平原君', officialTitle: '相国',
      rankLevel: 28, socialClass: 'noble', department: 'central',
      abilities: { governance: 78, military: 70, intelligence: 88,
                    charisma: 92, integrity: 80, benevolence: 88,
                    diplomacy: 92, scholarship: 80, finance: 75, cunning: 80 },
      loyalty: 85, ambition: 75,
      traits: ['benevolent','clever','luxurious','heroic'],
      resources: {
        privateWealth: { money: 3000000, land: 80000, treasure: 8000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 80,
      background: '赵武灵王子·三任赵相·礼贤下士门客三千·毛遂自荐·邯郸保卫战·战国四公子之一。',
      famousQuote: '士之处世·譬若锥之处囊中。',
      historicalFate: '赵孝成王十五年病殁',
      fateHint: 'peacefulDeath'
    },

    wangli: {
      id: 'wangli', name: '王离', zi: '',
      birthYear: -255, deathYear: -207, alternateNames: ['武城侯'],
      era: '秦末', dynasty: '秦', role: 'military',
      title: '武城侯', officialTitle: '裨将',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 55, military: 80, intelligence: 70,
                    charisma: 70, integrity: 75, benevolence: 60,
                    diplomacy: 50, scholarship: 50, finance: 50, cunning: 60 },
      loyalty: 88, ambition: 65,
      traits: ['brave','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 400, virtueStage: 4
      },
      integrity: 78,
      background: '王翦孙·王贲子·将秦九原边军南下·巨鹿之战被项羽破釜沉舟·所部覆灭被俘。',
      famousQuote: '',
      historicalFate: '秦二世三年巨鹿被俘·下落不明',
      fateHint: 'exileDeath'
    },

    longju: {
      id: 'longju', name: '龙且', zi: '',
      birthYear: -255, deathYear: -203, alternateNames: [],
      era: '秦末', dynasty: '楚', role: 'military',
      title: '上将军', officialTitle: '上将军',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 50, military: 88, intelligence: 65,
                    charisma: 78, integrity: 80, benevolence: 60,
                    diplomacy: 45, scholarship: 35, finance: 45, cunning: 55 },
      loyalty: 100, ambition: 60,
      traits: ['brave','heroic','loyal','proud'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 65, virtueMerit: 500, virtueStage: 4
      },
      integrity: 88,
      background: '楚国名将·项羽心腹·平英布反·潍水之战中韩信沙袋决水之计被斩于阵前。',
      famousQuote: '吾平生知韩信易耳。',
      historicalFate: '汉四年潍水之战阵亡',
      fateHint: 'martyrdom'
    },

    wangling: {
      id: 'wangling', name: '王陵', zi: '',
      birthYear: -240, deathYear: -180, alternateNames: ['安国侯','武'],
      era: '汉初', dynasty: '西汉', role: 'loyal',
      title: '安国侯', officialTitle: '右丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 70, intelligence: 80,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 60, scholarship: 60, finance: 60, cunning: 65 },
      loyalty: 100, ambition: 60,
      traits: ['upright','loyal','rigorous','heroic'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 750, virtueStage: 5
      },
      integrity: 95,
      background: '沛县人·随高祖起兵·惠帝朝右丞相·吕后欲立诸吕·王陵直争·罢相归乡。',
      famousQuote: '高帝刑白马盟·非刘氏不王·今欲立诸吕·非约也。',
      historicalFate: '吕后七年杜门不出·寿终',
      fateHint: 'retirement'
    },

    zhanger: {
      id: 'zhanger', name: '张耳', zi: '',
      birthYear: -264, deathYear: -202, alternateNames: ['赵王','景'],
      era: '秦末汉初', dynasty: '西汉', role: 'usurper',
      title: '赵王', officialTitle: '赵王',
      rankLevel: 30, socialClass: 'noble', department: 'central',
      abilities: { governance: 78, military: 75, intelligence: 88,
                    charisma: 88, integrity: 70, benevolence: 75,
                    diplomacy: 80, scholarship: 65, finance: 65, cunning: 80 },
      loyalty: 75, ambition: 88,
      traits: ['heroic','clever','patient','ambitious'],
      resources: {
        privateWealth: { money: 1500000, land: 50000, treasure: 3000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '大梁人·与陈余刎颈交·后反目·韩信破赵立耳为赵王·汉初异姓七王之一·善终而国传子孙。',
      famousQuote: '',
      historicalFate: '汉五年病殁·赵国传子张敖',
      fateHint: 'peacefulDeath'
    },

    yanzhu: {
      id: 'yanzhu', name: '严助', zi: '',
      birthYear: -180, deathYear: -122, alternateNames: ['会稽太守'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '会稽太守', officialTitle: '中大夫',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 50, intelligence: 92,
                    charisma: 88, integrity: 75, benevolence: 70,
                    diplomacy: 88, scholarship: 92, finance: 60, cunning: 80 },
      loyalty: 80, ambition: 80,
      traits: ['scholarly','literary','clever','idealist'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 60, virtueMerit: 500, virtueStage: 4
      },
      integrity: 75,
      background: '会稽吴人·武帝朝近臣·内朝建议者·伐闽越定西南夷·后牵涉淮南王安谋反案被诛。',
      famousQuote: '',
      historicalFate: '元狩元年坐淮南王案被诛',
      fateHint: 'execution'
    },

    dengtong: {
      id: 'dengtong', name: '邓通', zi: '',
      birthYear: -202, deathYear: -157, alternateNames: [],
      era: '文帝朝', dynasty: '西汉', role: 'corrupt',
      title: '上大夫', officialTitle: '上大夫',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 30, intelligence: 65,
                    charisma: 88, integrity: 60, benevolence: 60,
                    diplomacy: 65, scholarship: 50, finance: 92, cunning: 70 },
      loyalty: 95, ambition: 70,
      traits: ['flatterer','luxurious','clever','vain'],
      resources: {
        privateWealth: { money: 30000000, land: 1000000, treasure: 100000000, slaves: 30000, commerce: 5000000 },
        hiddenWealth: 0, fame: -30, virtueMerit: 200, virtueStage: 2
      },
      integrity: 60,
      background: '蜀郡南安人·文帝宠臣·赐铜山·邓氏钱布天下·吮文帝痈·景帝即位收山·终饿死人家。',
      famousQuote: '',
      historicalFate: '景帝初罢职·没收家产·寄食他门饿死',
      fateHint: 'forcedDeath'
    },

    banbiao: {
      id: 'banbiao', name: '班彪', zi: '叔皮',
      birthYear: 3, deathYear: 54, alternateNames: ['司隶校尉'],
      era: '光武明帝朝', dynasty: '东汉', role: 'scholar',
      title: '徐令', officialTitle: '司徒掾',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 30, intelligence: 92,
                    charisma: 75, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 65 },
      loyalty: 92, ambition: 60,
      traits: ['scholarly','rigorous','sage','idealist'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6
      },
      integrity: 95,
      background: '扶风安陵人·班固班超班昭父·王命论·光武奇之·撰《史记后传》六十五篇·班固继其业。',
      famousQuote: '宁得罪于君子·勿得罪于小人。',
      historicalFate: '永平末病殁',
      fateHint: 'peacefulDeath'
    },

    zhuJun: {
      id: 'zhuJun', name: '朱儁', zi: '公伟',
      birthYear: 137, deathYear: 195, alternateNames: ['钱塘侯'],
      era: '汉末', dynasty: '东汉', role: 'military',
      title: '钱塘侯', officialTitle: '太尉',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 75, military: 90, intelligence: 85,
                    charisma: 80, integrity: 92, benevolence: 78,
                    diplomacy: 60, scholarship: 75, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '会稽上虞人·与皇甫嵩并为讨黄巾名将·破波才·征长沙·官至太尉·见李傕之乱忧愤而亡。',
      famousQuote: '',
      historicalFate: '兴平二年见李傕逼献帝忧愤而殁',
      fateHint: 'forcedDeath'
    },

    juShou: {
      id: 'juShou', name: '沮授', zi: '',
      birthYear: 156, deathYear: 200, alternateNames: [],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '冀州监军', officialTitle: '监军',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 85, military: 75, intelligence: 95,
                    charisma: 70, integrity: 95, benevolence: 75,
                    diplomacy: 60, scholarship: 88, finance: 65, cunning: 92 },
      loyalty: 100, ambition: 65,
      traits: ['brilliant','rigorous','heroic','loyal'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6
      },
      integrity: 100,
      background: '广平人·袁绍主谋·议挟天子以令诸侯·力谏勿急战曹·官渡被俘·拒降曹密谋逃归被斩。',
      famousQuote: '我归绍·绍待我厚·我虽分曹·必死无二。',
      historicalFate: '建安五年官渡之战被俘·拒降被曹操所斩',
      fateHint: 'martyrdom'
    },

    wangcan: {
      id: 'wangcan', name: '王粲', zi: '仲宣',
      birthYear: 177, deathYear: 217, alternateNames: ['关内侯'],
      era: '汉末', dynasty: '曹魏', role: 'scholar',
      title: '关内侯', officialTitle: '侍中',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 30, intelligence: 92,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 65 },
      loyalty: 88, ambition: 60,
      traits: ['literary','scholarly','idealist','sage'],
      resources: {
        privateWealth: { money: 100000, land: 1500, treasure: 80000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '山阳高平人·建安七子之首·先依刘表·归曹·登楼赋·七哀诗·随曹操征吴途中病殁。',
      famousQuote: '虽信美而非吾土兮·曾何足以少留。',
      historicalFate: '建安二十二年随征途中病殁',
      fateHint: 'peacefulDeath'
    },

    caiWenji: {
      id: 'caiWenji', name: '蔡琰', zi: '昭姬',
      birthYear: 177, deathYear: 249, alternateNames: ['蔡文姬','文姬'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '', officialTitle: '',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 80, ambition: 35,
      traits: ['literary','heroic','sage','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '陈留圉县人·蔡邕女·乱中没匈奴十二年·曹操赎归·撰胡笳十八拍·背诵亡书四百卷。',
      famousQuote: '人生几何时·怀忧终年岁。',
      historicalFate: '魏正始末病殁',
      fateHint: 'peacefulDeath'
    },

    ganning: {
      id: 'ganning', name: '甘宁', zi: '兴霸',
      birthYear: 180, deathYear: 220, alternateNames: ['锦帆贼'],
      era: '汉末三国', dynasty: '东吴', role: 'military',
      title: '折冲将军', officialTitle: '西陵太守',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 55, military: 92, intelligence: 78,
                    charisma: 82, integrity: 70, benevolence: 60,
                    diplomacy: 50, scholarship: 50, finance: 55, cunning: 70 },
      loyalty: 92, ambition: 70,
      traits: ['brave','heroic','luxurious','rigorous'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 75,
      background: '巴郡临江人·锦帆贼出身·百骑劫魏营·濡须口威震敌阵·孙权曰孟德有张辽·孤有甘兴霸。',
      famousQuote: '吾此战一夜·无伤一卒。',
      historicalFate: '建安二十五年病殁',
      fateHint: 'peacefulDeath'
    },

    huanggai: {
      id: 'huanggai', name: '黄盖', zi: '公覆',
      birthYear: 145, deathYear: 215, alternateNames: ['偏将军'],
      era: '汉末三国', dynasty: '东吴', role: 'military',
      title: '武锋中郎将', officialTitle: '偏将军·武陵太守',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 88, intelligence: 80,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 55, scholarship: 50, finance: 55, cunning: 80 },
      loyalty: 100, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '零陵泉陵人·孙坚旧部·三朝元老·苦肉计·赤壁火攻先锋·大败曹军于乌林。',
      famousQuote: '愿率本部火攻·定破曹奸。',
      historicalFate: '建安二十年武陵任上殁',
      fateHint: 'peacefulDeath'
    },

    murongChui: {
      id: 'murongChui', name: '慕容垂', zi: '道明',
      birthYear: 326, deathYear: 396, alternateNames: ['后燕成武皇帝'],
      era: '前燕后燕', dynasty: '后燕', role: 'usurper',
      title: '燕皇帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 95, intelligence: 92,
                    charisma: 92, integrity: 78, benevolence: 75,
                    diplomacy: 80, scholarship: 78, finance: 78, cunning: 92 },
      loyalty: 50, ambition: 100,
      traits: ['brilliant','brave','heroic','patient'],
      resources: {
        privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 80,
      background: '前燕慕容皝子·苻坚朝降臣·淝水后趁势复燕·中兴慕容氏·五胡十六国第一名将。',
      famousQuote: '吾本无求·乱世逼之。',
      historicalFate: '建兴十一年北伐途中病殁·年七十一',
      fateHint: 'peacefulDeath'
    },

    gaoHuan: {
      id: 'gaoHuan', name: '高欢', zi: '贺六浑',
      birthYear: 496, deathYear: 547, alternateNames: ['北齐高祖','神武皇帝'],
      era: '东魏', dynasty: '东魏', role: 'usurper',
      title: '神武皇帝', officialTitle: '大丞相',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 88, military: 92, intelligence: 92,
                    charisma: 92, integrity: 70, benevolence: 75,
                    diplomacy: 88, scholarship: 70, finance: 80, cunning: 95 },
      loyalty: 30, ambition: 100,
      traits: ['brilliant','brave','heroic','clever'],
      resources: {
        privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '渤海蓚人·东魏实际统治者·与宇文泰二分北方·北齐基业·子高洋称帝建北齐。',
      famousQuote: '一只狐独·千狐共毙。',
      historicalFate: '武定五年玉壁之战败归病殁',
      fateHint: 'peacefulDeath'
    },

    yuwenTai: {
      id: 'yuwenTai', name: '宇文泰', zi: '黑獭',
      birthYear: 507, deathYear: 556, alternateNames: ['北周文帝'],
      era: '西魏', dynasty: '西魏', role: 'usurper',
      title: '太师·安定郡公', officialTitle: '大丞相',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 92, military: 92, intelligence: 95,
                    charisma: 92, integrity: 80, benevolence: 80,
                    diplomacy: 88, scholarship: 80, finance: 88, cunning: 95 },
      loyalty: 40, ambition: 100,
      traits: ['brilliant','heroic','reformist','rigorous'],
      resources: {
        privateWealth: { money: 25000000, land: 800000, treasure: 60000000, slaves: 25000, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 85,
      background: '武川人·西魏实际统治者·创府兵制·六官制·关陇集团之祖·隋唐两朝渊源。',
      famousQuote: '为政在德·岂在严刑。',
      historicalFate: '恭帝三年病殁·北周建国前夕',
      fateHint: 'peacefulDeath'
    },

    baozhao: {
      id: 'baozhao', name: '鲍照', zi: '明远',
      birthYear: 414, deathYear: 466, alternateNames: ['鲍参军'],
      era: '南朝宋', dynasty: '南朝宋', role: 'scholar',
      title: '前军参军', officialTitle: '前军参军',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 50, military: 30, intelligence: 88,
                    charisma: 80, integrity: 80, benevolence: 70,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 60 },
      loyalty: 80, ambition: 65,
      traits: ['literary','idealist','heroic','reclusive'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 750, virtueStage: 5
      },
      integrity: 85,
      background: '东海人·寒门出身·七言诗大成·与谢灵运颜延之并称元嘉三大家·乱军中被杀。',
      famousQuote: '人生亦有命·安能行叹复坐愁。',
      historicalFate: '泰始二年江州乱军中遇害',
      fateHint: 'martyrdom'
    },

    fanZhen: {
      id: 'fanZhen', name: '范缜', zi: '子真',
      birthYear: 450, deathYear: 510, alternateNames: ['尚书左丞'],
      era: '齐梁', dynasty: '南朝梁', role: 'scholar',
      title: '尚书左丞', officialTitle: '尚书左丞',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 25, intelligence: 95,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 70 },
      loyalty: 88, ambition: 60,
      traits: ['scholarly','idealist','rigorous','sage'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '南乡舞阴人·撰《神灭论》·梁武帝崇佛而独抗辩·形质神用·古代朴素唯物主义旗帜。',
      famousQuote: '形即神也·神即形也。',
      historicalFate: '天监九年病殁',
      fateHint: 'peacefulDeath'
    },

    laiHurer: {
      id: 'laiHurer', name: '来护儿', zi: '崇善',
      birthYear: 558, deathYear: 618, alternateNames: ['荣国公','襄'],
      era: '隋', dynasty: '隋', role: 'military',
      title: '荣国公', officialTitle: '右翊卫大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 92, intelligence: 80,
                    charisma: 78, integrity: 85, benevolence: 75,
                    diplomacy: 60, scholarship: 65, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 92,
      background: '江都人·灭陈先锋·三征高句丽水军主帅·宇文化及之乱不屈·与诸子同时被杀。',
      famousQuote: '吾为国家世受恩·不能荡涤逆贼·终是负国。',
      historicalFate: '大业十四年宇文化及弑炀帝·全家殉难',
      fateHint: 'martyrdom'
    },

    chengZhijie: {
      id: 'chengZhijie', name: '程知节', zi: '义贞',
      birthYear: 593, deathYear: 665, alternateNames: ['程咬金','卢国公','襄'],
      era: '初唐', dynasty: '唐', role: 'military',
      title: '卢国公', officialTitle: '镇军大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 88, intelligence: 70,
                    charisma: 88, integrity: 88, benevolence: 75,
                    diplomacy: 55, scholarship: 50, finance: 55, cunning: 75 },
      loyalty: 100, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '济州东阿人·原瓦岗李密部·归李世民·凌烟阁二十四功臣·三板斧故事民间流传。',
      famousQuote: '',
      historicalFate: '麟德二年寿终',
      fateHint: 'peacefulDeath'
    },

    zhangsunHou: {
      id: 'zhangsunHou', name: '长孙皇后', zi: '观音婢',
      birthYear: 601, deathYear: 636, alternateNames: ['文德皇后','文德顺圣皇后'],
      era: '贞观', dynasty: '唐', role: 'loyal',
      title: '皇后', officialTitle: '皇后',
      rankLevel: 30, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 88, military: 50, intelligence: 95,
                    charisma: 95, integrity: 100, benevolence: 95,
                    diplomacy: 88, scholarship: 92, finance: 78, cunning: 80 },
      loyalty: 100, ambition: 60,
      traits: ['benevolent','sage','loyal','rigorous'],
      resources: {
        privateWealth: { money: 20000000, land: 500000, treasure: 50000000, slaves: 10000, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 1000, virtueStage: 6
      },
      integrity: 100,
      background: '长孙晟女·长孙无忌妹·太宗皇后·贤后典范·制止外戚干政·撰《女则》·崩后太宗痛失内辅。',
      famousQuote: '不以君不闻而黜·不以妻而贵。',
      historicalFate: '贞观十年病崩立政殿·年三十六',
      fateHint: 'peacefulDeath'
    },

    weigao: {
      id: 'weigao', name: '韦皋', zi: '城武',
      birthYear: 745, deathYear: 805, alternateNames: ['南康郡王','忠武'],
      era: '德宪朝', dynasty: '唐', role: 'military',
      title: '南康郡王', officialTitle: '剑南西川节度使',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 88, military: 92, intelligence: 92,
                    charisma: 88, integrity: 80, benevolence: 75,
                    diplomacy: 92, scholarship: 80, finance: 80, cunning: 88 },
      loyalty: 88, ambition: 85,
      traits: ['brilliant','brave','heroic','rigorous'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 82,
      background: '京兆万年人·镇蜀二十一年·破吐蕃二十余战·联南诏抗吐蕃·中唐西南屏障。',
      famousQuote: '吐蕃之入·非韦相不退。',
      historicalFate: '永贞元年成都殁',
      fateHint: 'peacefulDeath'
    },

    duanXiushi: {
      id: 'duanXiushi', name: '段秀实', zi: '成公',
      birthYear: 719, deathYear: 783, alternateNames: ['张掖郡王','忠烈'],
      era: '玄肃代德', dynasty: '唐', role: 'loyal',
      title: '张掖郡王', officialTitle: '司农卿',
      rankLevel: 24, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 78, military: 88, intelligence: 88,
                    charisma: 85, integrity: 100, benevolence: 80,
                    diplomacy: 60, scholarship: 80, finance: 65, cunning: 78 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '陇州汧阳人·郭子仪部·朱泚之乱·夺笏击其额·唾面骂之·被乱兵所杀。',
      famousQuote: '臣愿闻其杀身殉国之意。',
      historicalFate: '建中四年朱泚之乱被杀于含元殿',
      fateHint: 'martyrdom'
    },

    wangzeng: {
      id: 'wangzeng', name: '王曾', zi: '孝先',
      birthYear: 978, deathYear: 1038, alternateNames: ['沂国公','文正'],
      era: '真仁朝', dynasty: '北宋', role: 'regent',
      title: '沂国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 80, scholarship: 100, finance: 78, cunning: 78 },
      loyalty: 95, ambition: 65,
      traits: ['scholarly','rigorous','sage','patient'],
      resources: {
        privateWealth: { money: 300000, land: 6000, treasure: 200000, slaves: 80, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '青州益都人·咸平连中三元·真宗朝相·定策垂帘·仁宗朝罢章献太后·宋初四相之一。',
      famousQuote: '夫执政者·不可立异。',
      historicalFate: '宝元元年病殁',
      fateHint: 'peacefulDeath'
    },

    hanTuozhou: {
      id: 'hanTuozhou', name: '韩侂胄', zi: '节夫',
      birthYear: 1152, deathYear: 1207, alternateNames: ['平章军国事'],
      era: '南宋光宁', dynasty: '南宋', role: 'usurper',
      title: '平原郡王', officialTitle: '平章军国事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 60, intelligence: 80,
                    charisma: 78, integrity: 40, benevolence: 50,
                    diplomacy: 70, scholarship: 75, finance: 70, cunning: 88 },
      loyalty: 60, ambition: 95,
      traits: ['scheming','ambitious','luxurious','proud'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 1000000 },
        hiddenWealth: 1000000, fame: -50, virtueMerit: 250, virtueStage: 2
      },
      integrity: 45,
      background: '相州安阳人·韩琦曾孙·以皇太后侄身份揽权·禁伪学党·开禧北伐失败·被史弥远诛于函首送金。',
      famousQuote: '',
      historicalFate: '开禧三年史弥远密谋杀之·函首送金求和',
      fateHint: 'execution'
    },

    wangYucheng: {
      id: 'wangYucheng', name: '王禹偁', zi: '元之',
      birthYear: 954, deathYear: 1001, alternateNames: ['黄州'],
      era: '太宗真宗朝', dynasty: '北宋', role: 'scholar',
      title: '翰林学士', officialTitle: '工部郎中·黄州知州',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 92,
                    charisma: 80, integrity: 95, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 60, cunning: 60 },
      loyalty: 92, ambition: 65,
      traits: ['literary','upright','idealist','scholarly'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '济州巨野人·北宋古文运动先驱·三入翰林·三遭贬谪·开欧苏古文之先。',
      famousQuote: '兼磨断佞剑·拟树直言旗。',
      historicalFate: '咸平四年病殁黄州任所',
      fateHint: 'exileDeath'
    },

    susong: {
      id: 'susong', name: '苏颂', zi: '子容',
      birthYear: 1020, deathYear: 1101, alternateNames: ['赵郡公','正简'],
      era: '神哲徽朝', dynasty: '北宋', role: 'scholar',
      title: '赵郡公', officialTitle: '尚书左仆射',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 95,
                    charisma: 80, integrity: 95, benevolence: 88,
                    diplomacy: 78, scholarship: 100, finance: 80, cunning: 78 },
      loyalty: 92, ambition: 60,
      traits: ['brilliant','scholarly','rigorous','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '泉州同安人·撰《新仪象法要》·建造水运仪象台·中国天文机械史最高成就·哲宗朝拜相。',
      famousQuote: '为天下立心·为民立命。',
      historicalFate: '建中靖国元年病殁',
      fateHint: 'peacefulDeath'
    },

    xuheng: {
      id: 'xuheng', name: '许衡', zi: '仲平',
      birthYear: 1209, deathYear: 1281, alternateNames: ['鲁斋','文正'],
      era: '蒙元', dynasty: '元', role: 'scholar',
      title: '魏国公', officialTitle: '集贤大学士',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 30, intelligence: 92,
                    charisma: 78, integrity: 95, benevolence: 88,
                    diplomacy: 65, scholarship: 100, finance: 70, cunning: 65 },
      loyalty: 88, ambition: 60,
      traits: ['scholarly','sage','rigorous','idealist'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '怀州河内人·元初理学北传第一人·定授时历·教蒙古子弟·与刘秉忠等建元朝制度。',
      famousQuote: '梨虽无主·我心有主。',
      historicalFate: '至元十八年病殁',
      fateHint: 'peacefulDeath'
    },

    wangmian: {
      id: 'wangmian', name: '王冕', zi: '元章',
      birthYear: 1287, deathYear: 1359, alternateNames: ['煮石山农','梅花屋主'],
      era: '元末', dynasty: '元', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 25, intelligence: 88,
                    charisma: 80, integrity: 95, benevolence: 80,
                    diplomacy: 45, scholarship: 100, finance: 55, cunning: 50 },
      loyalty: 70, ambition: 30,
      traits: ['literary','reclusive','sage','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 95,
      background: '诸暨人·放牛娃出身·元末隐士·墨梅画始祖·朱元璋请之不就·终于乡里。',
      famousQuote: '不要人夸好颜色·只留清气满乾坤。',
      historicalFate: '至正十九年病殁会稽',
      fateHint: 'retirement'
    },

    wangzhen: {
      id: 'wangzhen', name: '王振', zi: '',
      birthYear: 1395, deathYear: 1449, alternateNames: ['司礼太监'],
      era: '正统', dynasty: '明', role: 'eunuch',
      title: '', officialTitle: '司礼监掌印太监',
      rankLevel: 25, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 60, military: 35, intelligence: 75,
                    charisma: 70, integrity: 15, benevolence: 25,
                    diplomacy: 60, scholarship: 70, finance: 70, cunning: 88 },
      loyalty: 50, ambition: 100,
      traits: ['flatterer','greedy','vain','ruthless'],
      resources: {
        privateWealth: { money: 8000000, land: 200000, treasure: 30000000, slaves: 3000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -90, virtueMerit: 50, virtueStage: 1
      },
      integrity: 18,
      background: '蔚州人·英宗宠信·明朝第一权阉·怂恿英宗亲征瓦剌·土木堡之变·乱军中被樊忠所杀。',
      famousQuote: '',
      historicalFate: '正统十四年土木堡之变·乱军中被锤杀',
      fateHint: 'execution'
    },

    yanshifan: {
      id: 'yanshifan', name: '严世蕃', zi: '德球',
      birthYear: 1513, deathYear: 1565, alternateNames: ['东楼'],
      era: '嘉靖', dynasty: '明', role: 'corrupt',
      title: '太常寺卿', officialTitle: '工部左侍郎',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 30, intelligence: 88,
                    charisma: 65, integrity: 5, benevolence: 15,
                    diplomacy: 60, scholarship: 75, finance: 78, cunning: 95 },
      loyalty: 50, ambition: 100,
      traits: ['scheming','greedy','ruthless','vain'],
      resources: {
        privateWealth: { money: 10000000, land: 300000, treasure: 30000000, slaves: 3000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -95, virtueMerit: 0, virtueStage: 1
      },
      integrity: 5,
      background: '严嵩独子·才思敏捷·替父批阅·揽政干禄·势倾朝野·徐阶联诸臣构罪·斩西市·父亦罢。',
      famousQuote: '',
      historicalFate: '嘉靖四十四年弃市·抄家',
      fateHint: 'executionByClanDestruction'
    },

    puSongling: {
      id: 'puSongling', name: '蒲松龄', zi: '留仙',
      birthYear: 1640, deathYear: 1715, alternateNames: ['柳泉居士','聊斋'],
      era: '康熙', dynasty: '清', role: 'scholar',
      title: '', officialTitle: '岁贡生',
      rankLevel: 5, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 65 },
      loyalty: 70, ambition: 35,
      traits: ['literary','reclusive','idealist','sage'],
      resources: {
        privateWealth: { money: 10000, land: 100, treasure: 3000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '淄川人·屡试不第·七十一岁始援例为岁贡生·撰《聊斋志异》四百九十一篇·中国文言短篇之冠。',
      famousQuote: '集腋为裘·妄续幽冥之录。',
      historicalFate: '康熙五十四年病殁聊斋',
      fateHint: 'retirement'
    },

    caoXueqin: {
      id: 'caoXueqin', name: '曹霑', zi: '梦阮',
      birthYear: 1715, deathYear: 1763, alternateNames: ['雪芹','芹圃','芹溪居士'],
      era: '乾隆', dynasty: '清', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 45, military: 25, intelligence: 92,
                    charisma: 80, integrity: 85, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 30, cunning: 60 },
      loyalty: 65, ambition: 35,
      traits: ['literary','luxurious','reclusive','sage'],
      resources: {
        privateWealth: { money: 5000, land: 50, treasure: 1000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '汉军正白旗·曹寅孙·家被抄·西山黄叶村卖画为生·撰《红楼梦》八十回·中国小说巅峰。',
      famousQuote: '满纸荒唐言·一把辛酸泪。',
      historicalFate: '乾隆二十八年除夕贫病而殁·年仅四十九',
      fateHint: 'exileDeath'
    },

    zhangTaiyan: {
      id: 'zhangTaiyan', name: '章炳麟', zi: '枚叔',
      birthYear: 1869, deathYear: 1936, alternateNames: ['太炎','膏兰室主人'],
      era: '光绪宣统民国', dynasty: '清', role: 'reformer',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 65, military: 25, intelligence: 95,
                    charisma: 88, integrity: 92, benevolence: 75,
                    diplomacy: 70, scholarship: 100, finance: 50, cunning: 70 },
      loyalty: 60, ambition: 80,
      traits: ['scholarly','idealist','reformist','heroic'],
      resources: {
        privateWealth: { money: 200000, land: 2000, treasure: 100000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '浙江余杭人·苏报案下狱·光复会·清末民初国学大师·骂袁世凯被禁锢·一代经师人师。',
      famousQuote: '我手写我心。',
      historicalFate: '民国二十五年病殁苏州',
      fateHint: 'retirement'
    },

    zhongjun: {
      id: 'zhongjun', name: '终军', zi: '子云',
      birthYear: -133, deathYear: -112, alternateNames: ['终童'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '谏大夫', officialTitle: '谏大夫',
      rankLevel: 15, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 50, intelligence: 92,
                    charisma: 88, integrity: 90, benevolence: 70,
                    diplomacy: 92, scholarship: 92, finance: 55, cunning: 80 },
      loyalty: 100, ambition: 92,
      traits: ['heroic','idealist','clever','brave'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '济南人·十八岁举博士弟子·请缨南越·愿受长缨·被南越相吕嘉所杀·终童典出。',
      famousQuote: '愿受长缨·必羁南越王而致之阙下。',
      historicalFate: '元鼎五年使南越遇害·年二十二',
      fateHint: 'martyrdom'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-10] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
