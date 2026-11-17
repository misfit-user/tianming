// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-03.js
// Domain: NPC / 历史人物 data
// 来源·波 3·春秋-清·名臣武将谋士
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
    wuZixu: {
      id: 'wuZixu', name: '伍员', zi: '子胥',
      birthYear: -559, deathYear: -484, alternateNames: ['申胥'],
      era: '春秋', dynasty: '吴', role: 'loyal',
      title: '相国公', officialTitle: '相国',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 88, intelligence: 92,
                    charisma: 75, integrity: 88, benevolence: 60,
                    diplomacy: 75, scholarship: 80, finance: 70, cunning: 85 },
      loyalty: 95, ambition: 75,
      traits: ['heroic','rigorous','loyal','brave'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '楚国人·父兄被楚平王杀·奔吴助阖闾·破楚鞭楚平王尸·吴亡谏夫差死。',
      famousQuote: '抉吾眼悬吴东门·以观越寇之入也。',
      historicalFate: '吴王夫差十二年赐死',
      fateHint: 'forcedDeath'
    },

    sunbin: {
      id: 'sunbin', name: '孙膑', zi: '',
      birthYear: -382, deathYear: -316, alternateNames: ['孙伯灵'],
      era: '战国', dynasty: '齐', role: 'military',
      title: '军师', officialTitle: '齐军师',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 100, intelligence: 100,
                    charisma: 75, integrity: 78, benevolence: 60,
                    diplomacy: 65, scholarship: 92, finance: 50, cunning: 100 },
      loyalty: 85, ambition: 70,
      traits: ['brilliant','clever','patient','scheming'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 750, virtueStage: 5
      },
      integrity: 80,
      background: '齐国阿邑人·鬼谷子弟子·遭庞涓陷害断膝刖·桂陵马陵两破魏军·撰《孙膑兵法》。',
      famousQuote: '兵者，凶器也，争者，逆德也。',
      historicalFate: '功成归隐著兵法·终于山林',
      fateHint: 'retirement'
    },

    pangjuan: {
      id: 'pangjuan', name: '庞涓', zi: '',
      birthYear: -375, deathYear: -341, alternateNames: [],
      era: '战国', dynasty: '魏', role: 'military',
      title: '上将军', officialTitle: '将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 88, intelligence: 80,
                    charisma: 70, integrity: 30, benevolence: 30,
                    diplomacy: 50, scholarship: 80, finance: 45, cunning: 85 },
      loyalty: 75, ambition: 95,
      traits: ['brave','scheming','jealous','ruthless'],
      resources: {
        privateWealth: { money: 300000, land: 8000, treasure: 500000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 30, virtueMerit: 200, virtueStage: 2
      },
      integrity: 35,
      background: '与孙膑同窗鬼谷子·嫉妒陷害断其膝·桂陵之败·马陵道中孙膑伏兵·遂自刎。',
      famousQuote: '遂成竖子之名。',
      historicalFate: '马陵之战中孙膑伏兵·自刎',
      fateHint: 'martyrdom'
    },

    mengtian: {
      id: 'mengtian', name: '蒙恬', zi: '',
      birthYear: -250, deathYear: -210, alternateNames: ['内史'],
      era: '秦', dynasty: '秦', role: 'military',
      title: '内史', officialTitle: '上将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 88,
                    charisma: 82, integrity: 90, benevolence: 78,
                    diplomacy: 60, scholarship: 75, finance: 65, cunning: 80 },
      loyalty: 100, ambition: 65,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 30000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '齐人后裔·北却匈奴七百里·主修长城·制秦笔·与扶苏共戍边十余年。',
      famousQuote: '吾何罪于天，无过而死乎。',
      historicalFate: '二世元年沙丘之谋后被赐死阳周',
      fateHint: 'forcedDeath'
    },

    fusu: {
      id: 'fusu', name: '扶苏', zi: '',
      birthYear: -242, deathYear: -210, alternateNames: ['公子扶苏'],
      era: '秦', dynasty: '秦', role: 'loyal',
      title: '公子', officialTitle: '监军',
      rankLevel: 28, socialClass: 'imperial', department: 'central',
      abilities: { governance: 80, military: 70, intelligence: 88,
                    charisma: 88, integrity: 95, benevolence: 92,
                    diplomacy: 75, scholarship: 88, finance: 65, cunning: 50 },
      loyalty: 100, ambition: 60,
      traits: ['benevolent','loyal','idealist','heroic'],
      resources: {
        privateWealth: { money: 1000000, land: 50000, treasure: 5000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '秦始皇长子·因谏阻坑儒被遣戍上郡·与蒙恬戍边·沙丘之谋后伪诏赐死。',
      famousQuote: '父赐子死·尚安复请。',
      historicalFate: '二世元年伪诏赐死',
      fateHint: 'forcedDeath'
    },

    zhaogao: {
      id: 'zhaogao', name: '赵高', zi: '',
      birthYear: -258, deathYear: -207, alternateNames: ['中车府令'],
      era: '秦', dynasty: '秦', role: 'eunuch',
      title: '丞相', officialTitle: '中丞相',
      rankLevel: 30, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 70, military: 30, intelligence: 90,
                    charisma: 70, integrity: 5, benevolence: 5,
                    diplomacy: 75, scholarship: 75, finance: 65, cunning: 100 },
      loyalty: 5, ambition: 100,
      traits: ['scheming','ruthless','greedy','flatterer'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 30000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 5000000, fame: -100, virtueMerit: 0, virtueStage: 1
      },
      integrity: 5,
      background: '赵国王族远支·入秦为宦·沙丘之谋立胡亥·指鹿为马·杀李斯·杀二世·秦亡之祸首。',
      famousQuote: '指鹿为马。',
      historicalFate: '子婴诛之·夷三族',
      fateHint: 'execution'
    },

    mayuan: {
      id: 'mayuan', name: '马援', zi: '文渊',
      birthYear: -14, deathYear: 49, alternateNames: ['新息侯','忠成'],
      era: '光武朝', dynasty: '东汉', role: 'military',
      title: '新息侯', officialTitle: '伏波将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 80, military: 92, intelligence: 88,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 75, scholarship: 78, finance: 70, cunning: 80 },
      loyalty: 95, ambition: 70,
      traits: ['brave','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '扶风茂陵人·伏波将军·平交趾立铜柱·南征武陵蛮·马革裹尸·刘秀朝名将。',
      famousQuote: '男儿要当死于边野，以马革裹尸还葬耳。',
      historicalFate: '建武二十五年殁于军中·后被构陷夺爵',
      fateHint: 'martyrdom'
    },

    banzhao: {
      id: 'banzhao', name: '班昭', zi: '惠班',
      birthYear: 49, deathYear: 120, alternateNames: ['曹大家'],
      era: '和帝朝', dynasty: '东汉', role: 'scholar',
      title: '大家', officialTitle: '皇后师',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'imperial',
      abilities: { governance: 70, military: 25, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 88,
                    diplomacy: 75, scholarship: 100, finance: 60, cunning: 65 },
      loyalty: 90, ambition: 50,
      traits: ['scholarly','literary','sage','rigorous'],
      resources: {
        privateWealth: { money: 80000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '扶风安陵人·班彪女·班固妹·续《汉书》·入宫教皇后嫔妃·女史第一人。',
      famousQuote: '清闲贞静·守节整齐。',
      historicalFate: '永宁元年病殁',
      fateHint: 'peacefulDeath'
    },

    zhangheng: {
      id: 'zhangheng', name: '张衡', zi: '平子',
      birthYear: 78, deathYear: 139, alternateNames: ['张河间'],
      era: '安顺朝', dynasty: '东汉', role: 'scholar',
      title: '尚书', officialTitle: '河间相',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 100,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 65, cunning: 70 },
      loyalty: 88, ambition: 50,
      traits: ['brilliant','scholarly','literary','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 92,
      background: '南阳西鄂人·浑天仪地动仪·撰《二京赋》《思玄赋》·中国天文数学先驱。',
      famousQuote: '不患位之不尊·而患德之不崇。',
      historicalFate: '永和四年病殁',
      fateHint: 'peacefulDeath'
    },

    cailun: {
      id: 'cailun', name: '蔡伦', zi: '敬仲',
      birthYear: 63, deathYear: 121, alternateNames: ['龙亭侯'],
      era: '和安朝', dynasty: '东汉', role: 'eunuch',
      title: '龙亭侯', officialTitle: '尚方令',
      rankLevel: 22, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 65, military: 25, intelligence: 92,
                    charisma: 70, integrity: 70, benevolence: 70,
                    diplomacy: 65, scholarship: 88, finance: 65, cunning: 75 },
      loyalty: 85, ambition: 60,
      traits: ['brilliant','rigorous','scholarly','clever'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 850, virtueStage: 6
      },
      integrity: 78,
      background: '桂阳人·宦官·改良造纸法·蔡侯纸·改写人类文明史·安帝朝因牵涉宫廷案饮鸩而亡。',
      famousQuote: '',
      historicalFate: '建光元年自服毒',
      fateHint: 'forcedDeath'
    },

    bangu: {
      id: 'bangu', name: '班固', zi: '孟坚',
      birthYear: 32, deathYear: 92, alternateNames: ['班兰台'],
      era: '明章朝', dynasty: '东汉', role: 'scholar',
      title: '兰台令史', officialTitle: '玄武司马',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 35, intelligence: 92,
                    charisma: 75, integrity: 80, benevolence: 75,
                    diplomacy: 55, scholarship: 100, finance: 55, cunning: 65 },
      loyalty: 85, ambition: 65,
      traits: ['scholarly','literary','rigorous','idealist'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 82,
      background: '扶风安陵人·班彪子·班超兄·撰《汉书》·随窦宪北征匈奴勒石燕然·后下狱死。',
      famousQuote: '亡一日而失千秋。',
      historicalFate: '永元四年窦宪事下狱·死于洛阳狱中',
      fateHint: 'execution'
    },

    sunjian: {
      id: 'sunjian', name: '孙坚', zi: '文台',
      birthYear: 155, deathYear: 191, alternateNames: ['乌程侯','武烈皇帝','江东猛虎'],
      era: '汉末', dynasty: '东汉', role: 'military',
      title: '乌程侯', officialTitle: '破虏将军·豫州刺史',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 95, intelligence: 80,
                    charisma: 88, integrity: 80, benevolence: 70,
                    diplomacy: 60, scholarship: 50, finance: 65, cunning: 78 },
      loyalty: 75, ambition: 85,
      traits: ['brave','heroic','ambitious','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 78,
      background: '吴郡富春人·讨黄巾·破董卓·夺洛阳得传国玉玺·初平二年死于刘表军中流矢。',
      famousQuote: '帐下儿郎·随我冲杀。',
      historicalFate: '初平二年攻荆州中流矢殁岘山',
      fateHint: 'martyrdom'
    },

    sunce: {
      id: 'sunce', name: '孙策', zi: '伯符',
      birthYear: 175, deathYear: 200, alternateNames: ['长沙桓王','小霸王'],
      era: '汉末', dynasty: '东吴', role: 'usurper',
      title: '长沙桓王', officialTitle: '会稽太守·讨逆将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 95, intelligence: 80,
                    charisma: 92, integrity: 75, benevolence: 70,
                    diplomacy: 70, scholarship: 60, finance: 65, cunning: 75 },
      loyalty: 80, ambition: 95,
      traits: ['brave','heroic','ambitious','proud'],
      resources: {
        privateWealth: { money: 800000, land: 30000, treasure: 1500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 750, virtueStage: 5
      },
      integrity: 78,
      background: '吴郡富春人·孙坚长子·三年定江东六郡·小霸王·欲北伐途中遇刺。',
      famousQuote: '内事不决问张昭·外事不决问周瑜。',
      historicalFate: '建安五年许贡门客刺杀·年仅二十六',
      fateHint: 'martyrdom'
    },

    zhangzhao: {
      id: 'zhangzhao', name: '张昭', zi: '子布',
      birthYear: 156, deathYear: 236, alternateNames: ['娄侯','文'],
      era: '三国', dynasty: '东吴', role: 'regent',
      title: '娄侯', officialTitle: '辅吴将军',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 65, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 78,
                    diplomacy: 80, scholarship: 95, finance: 80, cunning: 75 },
      loyalty: 90, ambition: 60,
      traits: ['rigorous','scholarly','upright','patient'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '彭城人·孙策托孤·孙权师·赤壁主和遭忌·一生峻直·孙权敬而疏之。',
      famousQuote: '孤所以不立子布者·欲以使其守内。',
      historicalFate: '嘉禾五年病殁·年八十一',
      fateHint: 'peacefulDeath'
    },

    lusu: {
      id: 'lusu', name: '鲁肃', zi: '子敬',
      birthYear: 172, deathYear: 217, alternateNames: ['横江将军'],
      era: '汉末三国', dynasty: '东吴', role: 'scholar',
      title: '横江将军', officialTitle: '汉昌太守·偏将军',
      rankLevel: 23, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 80, military: 75, intelligence: 92,
                    charisma: 85, integrity: 90, benevolence: 88,
                    diplomacy: 95, scholarship: 88, finance: 80, cunning: 80 },
      loyalty: 92, ambition: 65,
      traits: ['brilliant','benevolent','patient','sage'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '临淮东城人·赠粮于周瑜·榻上策·赤壁联刘抗曹·继瑜为大都督·维持孙刘联盟。',
      famousQuote: '汉室不可复兴·曹操不可卒除。',
      historicalFate: '建安二十二年病殁',
      fateHint: 'peacefulDeath'
    },

    luxun: {
      id: 'luxun', name: '陆逊', zi: '伯言',
      birthYear: 183, deathYear: 245, alternateNames: ['江陵侯','昭'],
      era: '三国', dynasty: '东吴', role: 'military',
      title: '江陵侯', officialTitle: '丞相·上大将军',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 92, military: 95, intelligence: 95,
                    charisma: 85, integrity: 90, benevolence: 80,
                    diplomacy: 80, scholarship: 88, finance: 75, cunning: 92 },
      loyalty: 92, ambition: 65,
      traits: ['brilliant','patient','rigorous','sage'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 90,
      background: '吴郡吴县人·夷陵之战火烧连营·破刘备·石亭破曹休·两朝顾命·二宫之争忧愤而殁。',
      famousQuote: '兵犹火也·不戢将自焚。',
      historicalFate: '赤乌八年忧愤而殁',
      fateHint: 'forcedDeath'
    },

    dengAi: {
      id: 'dengAi', name: '邓艾', zi: '士载',
      birthYear: 197, deathYear: 264, alternateNames: ['邓征西','武'],
      era: '曹魏末', dynasty: '曹魏', role: 'military',
      title: '邓侯', officialTitle: '征西将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 80, military: 95, intelligence: 92,
                    charisma: 70, integrity: 88, benevolence: 75,
                    diplomacy: 60, scholarship: 78, finance: 75, cunning: 88 },
      loyalty: 90, ambition: 75,
      traits: ['brilliant','brave','rigorous','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 12000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 90,
      background: '义阳棘阳人·农家寒门·偷渡阴平灭蜀·后被钟会构陷·父子被押途中遇害。',
      famousQuote: '士无礼，则不足以全身。',
      historicalFate: '咸熙元年钟会构陷·乱兵杀于绵竹道',
      fateHint: 'executionByFraming'
    },

    zhonghui: {
      id: 'zhonghui', name: '钟会', zi: '士季',
      birthYear: 225, deathYear: 264, alternateNames: ['县侯'],
      era: '曹魏末', dynasty: '曹魏', role: 'usurper',
      title: '县侯', officialTitle: '司徒·镇西将军',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 78, military: 85, intelligence: 95,
                    charisma: 78, integrity: 50, benevolence: 50,
                    diplomacy: 70, scholarship: 92, finance: 70, cunning: 92 },
      loyalty: 50, ambition: 95,
      traits: ['brilliant','scheming','ambitious','proud'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 200000, fame: 50, virtueMerit: 400, virtueStage: 4
      },
      integrity: 55,
      background: '颍川长社人·钟繇幼子·神童早慧·助司马昭·灭蜀后联姜维谋反·乱兵所杀。',
      famousQuote: '事成可得天下·不成退保蜀汉·不失刘备。',
      historicalFate: '咸熙元年成都之乱·乱军所杀',
      fateHint: 'executionByFraming'
    },

    jiaxu: {
      id: 'jiaxu', name: '贾诩', zi: '文和',
      birthYear: 147, deathYear: 223, alternateNames: ['寿乡侯','毒士'],
      era: '汉末三国', dynasty: '曹魏', role: 'scholar',
      title: '寿乡侯', officialTitle: '太尉',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 70, intelligence: 100,
                    charisma: 70, integrity: 60, benevolence: 50,
                    diplomacy: 80, scholarship: 88, finance: 65, cunning: 100 },
      loyalty: 80, ambition: 60,
      traits: ['brilliant','patient','scheming','reclusive'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 65,
      background: '武威姑臧人·先后事董卓李傕张绣曹操·宛城反乱杀典韦·官渡献策·谋立曹丕·大智若愚。',
      famousQuote: '三思而后行。',
      historicalFate: '黄初四年病殁·年七十七',
      fateHint: 'peacefulDeath'
    },

    machao: {
      id: 'machao', name: '马超', zi: '孟起',
      birthYear: 176, deathYear: 222, alternateNames: ['斄乡侯','锦马超','威'],
      era: '三国', dynasty: '蜀汉', role: 'military',
      title: '斄乡侯', officialTitle: '骠骑将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 95, intelligence: 75,
                    charisma: 88, integrity: 78, benevolence: 65,
                    diplomacy: 55, scholarship: 50, finance: 55, cunning: 70 },
      loyalty: 75, ambition: 80,
      traits: ['brave','heroic','proud','ambitious'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 700, virtueStage: 5
      },
      integrity: 78,
      background: '扶风茂陵人·马腾子·渭水大战曹操割须弃袍·父族被诛·归刘备·五虎上将。',
      famousQuote: '阖门百口·惟有从弟岱·当以微宗血食之亲·君以为托。',
      historicalFate: '章武二年病殁·托弟马岱',
      fateHint: 'peacefulDeath'
    },

    zudi: {
      id: 'zudi', name: '祖逖', zi: '士稚',
      birthYear: 266, deathYear: 321, alternateNames: ['车骑将军'],
      era: '东晋初', dynasty: '东晋', role: 'military',
      title: '车骑将军', officialTitle: '豫州刺史',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 90, intelligence: 88,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 70, scholarship: 70, finance: 65, cunning: 75 },
      loyalty: 100, ambition: 80,
      traits: ['brave','heroic','idealist','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '范阳遒人·闻鸡起舞·中流击楫·北伐收复黄河以南·朝廷掣肘忧愤而终。',
      famousQuote: '祖逖不能清中原而复济者·有如大江。',
      historicalFate: '太兴四年忧愤而殁',
      fateHint: 'forcedDeath'
    },

    wangbo: {
      id: 'wangbo', name: '王勃', zi: '子安',
      birthYear: 650, deathYear: 676, alternateNames: ['初唐四杰之首'],
      era: '高宗朝', dynasty: '唐', role: 'scholar',
      title: '虢州参军', officialTitle: '参军',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 88, integrity: 80, benevolence: 70,
                    diplomacy: 50, scholarship: 100, finance: 40, cunning: 55 },
      loyalty: 80, ambition: 70,
      traits: ['literary','idealist','heroic','reclusive'],
      resources: {
        privateWealth: { money: 20000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 700, virtueStage: 5
      },
      integrity: 85,
      background: '绛州龙门人·神童早慧·初唐四杰之首·撰《滕王阁序》·渡海溺亡。',
      famousQuote: '海内存知己，天涯若比邻。',
      historicalFate: '上元三年探父交趾归途溺亡·年仅二十六',
      fateHint: 'martyrdom'
    },

    gaoXianzhi: {
      id: 'gaoXianzhi', name: '高仙芝', zi: '',
      birthYear: 700, deathYear: 756, alternateNames: ['密云郡公'],
      era: '玄宗朝', dynasty: '唐', role: 'military',
      title: '密云郡公', officialTitle: '安西节度使',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 92, intelligence: 85,
                    charisma: 80, integrity: 78, benevolence: 70,
                    diplomacy: 70, scholarship: 60, finance: 70, cunning: 80 },
      loyalty: 85, ambition: 75,
      traits: ['brave','heroic','rigorous','proud'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 80,
      background: '高句丽人·安西名将·破小勃律·怛罗斯之战败于阿拉伯·安史之乱时被诬谋反斩潼关。',
      famousQuote: '我退兵·有罪·然今主上以为我私退·则诬也。',
      historicalFate: '至德元载在军中被宦官边令诚监斩',
      fateHint: 'executionByFraming'
    },

    geShuhan: {
      id: 'geShuhan', name: '哥舒翰', zi: '',
      birthYear: 699, deathYear: 757, alternateNames: ['西平郡王'],
      era: '玄肃朝', dynasty: '唐', role: 'military',
      title: '西平郡王', officialTitle: '陇右节度使',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 90, intelligence: 78,
                    charisma: 80, integrity: 70, benevolence: 65,
                    diplomacy: 60, scholarship: 55, finance: 60, cunning: 70 },
      loyalty: 75, ambition: 75,
      traits: ['brave','heroic','luxurious','rigorous'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 500, virtueStage: 4
      },
      integrity: 70,
      background: '突骑施哥舒部·破吐蕃定石堡城·河西陇右节度使·安史时被迫出潼关大败被俘降。',
      famousQuote: '北斗七星高·哥舒夜带刀。',
      historicalFate: '至德二年被安庆绪所杀',
      fateHint: 'execution'
    },

    liLinfu: {
      id: 'liLinfu', name: '李林甫', zi: '哥奴',
      birthYear: 683, deathYear: 753, alternateNames: ['口蜜腹剑'],
      era: '玄宗朝', dynasty: '唐', role: 'corrupt',
      title: '晋国公', officialTitle: '中书令',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 90,
                    charisma: 75, integrity: 20, benevolence: 25,
                    diplomacy: 88, scholarship: 75, finance: 75, cunning: 100 },
      loyalty: 30, ambition: 95,
      traits: ['scheming','flatterer','ruthless','vain'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 30000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 5000000, fame: -75, virtueMerit: 100, virtueStage: 2
      },
      integrity: 20,
      background: '宗室远支·玄宗朝中后期相十九年·口蜜腹剑·荐胡将·种安史之乱祸根·盛唐转衰之罪魁。',
      famousQuote: '陛下用之·彼当尽忠。',
      historicalFate: '天宝十一载病殁·死后被构陷削爵',
      fateHint: 'posthumousConfiscation'
    },

    songJing: {
      id: 'songJing', name: '宋璟', zi: '广平',
      birthYear: 663, deathYear: 737, alternateNames: ['广平郡公','文贞'],
      era: '武周-玄宗', dynasty: '唐', role: 'clean',
      title: '广平郡公', officialTitle: '尚书右丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92,
                    charisma: 78, integrity: 95, benevolence: 85,
                    diplomacy: 80, scholarship: 92, finance: 78, cunning: 78 },
      loyalty: 95, ambition: 60,
      traits: ['upright','rigorous','scholarly','reformist'],
      resources: {
        privateWealth: { money: 200000, land: 4000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '邢州南和人·武周朝拒张易之·与姚崇并称姚宋·开元贤相·峻法肃吏。',
      famousQuote: '为相在朝·不可使一物失所。',
      historicalFate: '开元二十五年病殁',
      fateHint: 'peacefulDeath'
    },

    suzhe: {
      id: 'suzhe', name: '苏辙', zi: '子由',
      birthYear: 1039, deathYear: 1112, alternateNames: ['颍滨遗老','文定'],
      era: '神哲徽', dynasty: '北宋', role: 'scholar',
      title: '门下侍郎', officialTitle: '尚书右丞',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 35, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 88,
                    diplomacy: 70, scholarship: 100, finance: 70, cunning: 65 },
      loyalty: 90, ambition: 60,
      traits: ['scholarly','literary','upright','patient'],
      resources: {
        privateWealth: { money: 80000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '眉州眉山人·苏轼弟·嘉祐进士·唐宋八大家·与父兄并称三苏·晚年闭门著书。',
      famousQuote: '人之难知·古人所患。',
      historicalFate: '政和二年病殁',
      fateHint: 'peacefulDeath'
    },

    suxun: {
      id: 'suxun', name: '苏洵', zi: '明允',
      birthYear: 1009, deathYear: 1066, alternateNames: ['老苏','文安'],
      era: '仁宗朝', dynasty: '北宋', role: 'scholar',
      title: '霸州文安县主簿', officialTitle: '主簿',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 65, military: 30, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 78,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 60 },
      loyalty: 88, ambition: 70,
      traits: ['scholarly','literary','rigorous','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 92,
      background: '眉州眉山人·二十七岁始发愤·教二子·携子赴汴·欧阳修荐之·六国论传世。',
      famousQuote: '苟为不畜·终身不得。',
      historicalFate: '治平三年病殁汴京',
      fateHint: 'peacefulDeath'
    },

    mifu: {
      id: 'mifu', name: '米芾', zi: '元章',
      birthYear: 1051, deathYear: 1107, alternateNames: ['襄阳漫士','海岳外史','米南宫','米颠'],
      era: '神哲徽', dynasty: '北宋', role: 'scholar',
      title: '礼部员外郎', officialTitle: '书画学博士',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 25, intelligence: 90,
                    charisma: 78, integrity: 80, benevolence: 70,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 60 },
      loyalty: 75, ambition: 50,
      traits: ['literary','luxurious','reclusive','vain'],
      resources: {
        privateWealth: { money: 500000, land: 5000, treasure: 1000000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 750, virtueStage: 5
      },
      integrity: 80,
      background: '太原人·宋四家之一·癫狂爱石·拜石为兄·书画双绝·开米家山水。',
      famousQuote: '吾家洗砚池头树，个个花开淡墨痕。',
      historicalFate: '大观元年病殁淮阳军',
      fateHint: 'peacefulDeath'
    },

    hanqi: {
      id: 'hanqi', name: '韩琦', zi: '稚圭',
      birthYear: 1008, deathYear: 1075, alternateNames: ['魏国公','忠献'],
      era: '仁英神朝', dynasty: '北宋', role: 'regent',
      title: '魏国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 80, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 85,
                    diplomacy: 88, scholarship: 88, finance: 82, cunning: 85 },
      loyalty: 95, ambition: 65,
      traits: ['rigorous','patient','sage','heroic'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 900, virtueStage: 6
      },
      integrity: 92,
      background: '相州安阳人·天圣进士·镇陕西拒西夏·辅三朝·定策立英宗神宗·北宋名臣典范。',
      famousQuote: '为天下做长久计。',
      historicalFate: '熙宁八年病殁',
      fateHint: 'peacefulDeath'
    },

    fubi: {
      id: 'fubi', name: '富弼', zi: '彦国',
      birthYear: 1004, deathYear: 1083, alternateNames: ['郑国公','文忠'],
      era: '仁英神朝', dynasty: '北宋', role: 'scholar',
      title: '郑国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 88,
                    diplomacy: 95, scholarship: 88, finance: 80, cunning: 80 },
      loyalty: 95, ambition: 65,
      traits: ['scholarly','rigorous','patient','sage'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 900, virtueStage: 6
      },
      integrity: 92,
      background: '河南洛阳人·使辽四议·拒割地·安抚河北饥民·与韩琦并称韩富。',
      famousQuote: '日中而至·望日始至·非礼也。',
      historicalFate: '元丰六年病殁',
      fateHint: 'peacefulDeath'
    },

    wenYanbo: {
      id: 'wenYanbo', name: '文彦博', zi: '宽夫',
      birthYear: 1006, deathYear: 1097, alternateNames: ['潞国公','忠烈'],
      era: '仁英神哲', dynasty: '北宋', role: 'regent',
      title: '潞国公', officialTitle: '太师·同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 65, intelligence: 92,
                    charisma: 85, integrity: 90, benevolence: 85,
                    diplomacy: 88, scholarship: 90, finance: 80, cunning: 88 },
      loyalty: 92, ambition: 65,
      traits: ['rigorous','patient','sage','clever'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 90,
      background: '汾州介休人·四朝元老五十年·拜相五十一年·与韩琦富弼并辅·儒林典范·年九十二。',
      famousQuote: '为与士大夫治天下·非与百姓治天下。',
      historicalFate: '绍圣四年寿终',
      fateHint: 'peacefulDeath'
    },

    guanHanqing: {
      id: 'guanHanqing', name: '关汉卿', zi: '汉卿',
      birthYear: 1234, deathYear: 1300, alternateNames: ['己斋','一斋','已斋叟'],
      era: '元代', dynasty: '元', role: 'scholar',
      title: '太医院尹', officialTitle: '太医院户',
      rankLevel: 8, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 88,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 75 },
      loyalty: 70, ambition: 50,
      traits: ['literary','idealist','reclusive','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '大都人·元曲四大家之首·撰《窦娥冤》《救风尘》六十余种·中国戏剧之父。',
      famousQuote: '我是个蒸不烂、煮不熟、捶不扁、炒不爆、响珰珰一粒铜豌豆。',
      historicalFate: '大德四年病殁',
      fateHint: 'peacefulDeath'
    },

    songLian: {
      id: 'songLian', name: '宋濂', zi: '景濂',
      birthYear: 1310, deathYear: 1381, alternateNames: ['潜溪','玄真子','文宪'],
      era: '元末明初', dynasty: '明', role: 'scholar',
      title: '翰林学士承旨', officialTitle: '太子讲读',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 25, intelligence: 92,
                    charisma: 80, integrity: 95, benevolence: 88,
                    diplomacy: 65, scholarship: 100, finance: 60, cunning: 60 },
      loyalty: 95, ambition: 50,
      traits: ['scholarly','literary','rigorous','sage'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 95,
      background: '浦江人·开国文臣之首·总裁《元史》·教太子标二十年·胡惟庸案孙犯流茂州途中殁。',
      famousQuote: '善学者，假人之长以补其短。',
      historicalFate: '洪武十四年牵连胡惟庸案流茂州·途中病殁夔州',
      fateHint: 'exileDeath'
    },

    xiaYuanji: {
      id: 'xiaYuanji', name: '夏原吉', zi: '维喆',
      birthYear: 1366, deathYear: 1430, alternateNames: ['忠靖'],
      era: '永乐宣德', dynasty: '明', role: 'reformer',
      title: '太师', officialTitle: '户部尚书',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 50, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 75, scholarship: 88, finance: 100, cunning: 80 },
      loyalty: 92, ambition: 65,
      traits: ['rigorous','reformist','patient','scholarly'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '湘阴人·永乐六任户部尚书·治财有方·郑和下西洋・北征蒙古均赖其度支。',
      famousQuote: '夏原吉爱我。',
      historicalFate: '宣德五年病殁',
      fateHint: 'peacefulDeath'
    },

    kuangZhong: {
      id: 'kuangZhong', name: '况钟', zi: '伯律',
      birthYear: 1383, deathYear: 1443, alternateNames: ['况青天'],
      era: '宣德正统', dynasty: '明', role: 'clean',
      title: '苏州知府', officialTitle: '苏州知府',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 92, military: 30, intelligence: 88,
                    charisma: 78, integrity: 100, benevolence: 95,
                    diplomacy: 65, scholarship: 75, finance: 88, cunning: 65 },
      loyalty: 95, ambition: 50,
      traits: ['upright','rigorous','benevolent','humble_origin'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 100,
      background: '靖安人·小吏出身·苏州知府十三年·减赋百万·治讼如神·三离三留·百姓罢市。',
      famousQuote: '清白做官·实心做事。',
      historicalFate: '正统八年病殁苏州任上',
      fateHint: 'peacefulDeath'
    },

    xujie: {
      id: 'xujie', name: '徐阶', zi: '子升',
      birthYear: 1503, deathYear: 1583, alternateNames: ['少湖','存斋','文贞'],
      era: '嘉靖隆庆', dynasty: '明', role: 'regent',
      title: '太师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 95,
                    charisma: 85, integrity: 80, benevolence: 75,
                    diplomacy: 92, scholarship: 92, finance: 85, cunning: 95 },
      loyalty: 88, ambition: 80,
      traits: ['brilliant','patient','scheming','clever'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 1000000, fame: 60, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '松江华亭人·嘉靖朝首辅·扳倒严嵩·荐张居正·田产二十四万亩遭海瑞清丈。',
      famousQuote: '事难毋避·上恩可恃。',
      historicalFate: '万历十一年寿终·年八十一',
      fateHint: 'peacefulDeath'
    },

    gaogong: {
      id: 'gaogong', name: '高拱', zi: '肃卿',
      birthYear: 1513, deathYear: 1578, alternateNames: ['中玄','文襄'],
      era: '隆庆万历', dynasty: '明', role: 'reformer',
      title: '太师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 95,
                    charisma: 78, integrity: 85, benevolence: 70,
                    diplomacy: 85, scholarship: 92, finance: 88, cunning: 88 },
      loyalty: 90, ambition: 88,
      traits: ['brilliant','rigorous','reformist','proud'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 200000, fame: 68, virtueMerit: 700, virtueStage: 5
      },
      integrity: 82,
      background: '河南新郑人·裕王讲读·隆庆首辅·改革吏治·封贡互市俺答·万历初被张居正联李太后斥逐。',
      famousQuote: '才者·性之所辐辏。',
      historicalFate: '万历六年罢相后病殁新郑',
      fateHint: 'retirement'
    },

    lizhi: {
      id: 'lizhi', name: '李贽', zi: '宏甫',
      birthYear: 1527, deathYear: 1602, alternateNames: ['卓吾','温陵居士','百泉居士'],
      era: '万历', dynasty: '明', role: 'scholar',
      title: '姚安知府', officialTitle: '姚安知府',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 70, military: 25, intelligence: 95,
                    charisma: 78, integrity: 88, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 70 },
      loyalty: 65, ambition: 60,
      traits: ['literary','idealist','reclusive','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 600, virtueStage: 5
      },
      integrity: 88,
      background: '泉州晋江人·辞官落发龙湖芝佛院·童心说·撰《焚书》《藏书》·礼教反叛者·明末思想异端。',
      famousQuote: '夫童心者，真心也。',
      historicalFate: '万历三十年下狱·剃发自刎于通州狱中',
      fateHint: 'martyrdom'
    },

    tangXianzu: {
      id: 'tangXianzu', name: '汤显祖', zi: '义仍',
      birthYear: 1550, deathYear: 1616, alternateNames: ['海若','若士','清远道人'],
      era: '万历', dynasty: '明', role: 'scholar',
      title: '遂昌知县', officialTitle: '遂昌知县',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 65, military: 25, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 75, ambition: 55,
      traits: ['literary','idealist','reclusive','sage'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '抚州临川人·万历进士·辞官归·撰临川四梦·《牡丹亭》传世·东方莎士比亚。',
      famousQuote: '情不知所起·一往而深。',
      historicalFate: '万历四十四年病殁',
      fateHint: 'peacefulDeath'
    },

    yuDayou: {
      id: 'yuDayou', name: '俞大猷', zi: '志辅',
      birthYear: 1503, deathYear: 1579, alternateNames: ['虚江','武襄'],
      era: '嘉靖', dynasty: '明', role: 'military',
      title: '后军都督府都督', officialTitle: '右都督',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 92, intelligence: 88,
                    charisma: 80, integrity: 92, benevolence: 75,
                    diplomacy: 65, scholarship: 88, finance: 65, cunning: 78 },
      loyalty: 95, ambition: 65,
      traits: ['brave','rigorous','heroic','scholarly'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '泉州人·与戚继光齐名抗倭·撰《剑经》·正气堂集·一生七十战·屡贬屡起。',
      famousQuote: '人生如朝露·时光当珍。',
      historicalFate: '万历七年病殁',
      fateHint: 'peacefulDeath'
    },

    liHongzhang: {
      id: 'liHongzhang', name: '李鸿章', zi: '渐甫',
      birthYear: 1823, deathYear: 1901, alternateNames: ['少荃','文忠','李傅相','李中堂'],
      era: '同光', dynasty: '清', role: 'reformer',
      title: '一等肃毅伯', officialTitle: '直隶总督·北洋大臣',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 80, intelligence: 95,
                    charisma: 85, integrity: 60, benevolence: 70,
                    diplomacy: 95, scholarship: 88, finance: 88, cunning: 92 },
      loyalty: 88, ambition: 80,
      traits: ['brilliant','patient','reformist','clever'],
      resources: {
        privateWealth: { money: 30000000, land: 200000, treasure: 50000000, slaves: 2000, commerce: 5000000 },
        hiddenWealth: 5000000, fame: -10, virtueMerit: 600, virtueStage: 5
      },
      integrity: 65,
      background: '安徽合肥人·组淮军·镇太平捻军·办洋务·签马关辛丑·中国近代化第一人·亦背骂名。',
      famousQuote: '吾敬李之才·惜李之识·悲李之遇。',
      historicalFate: '光绪二十七年签辛丑后病殁',
      fateHint: 'peacefulDeath'
    },

    zhangZhidong: {
      id: 'zhangZhidong', name: '张之洞', zi: '孝达',
      birthYear: 1837, deathYear: 1909, alternateNames: ['香涛','文襄','张广雅'],
      era: '同光宣', dynasty: '清', role: 'reformer',
      title: '太子太保·体仁阁大学士', officialTitle: '湖广总督·军机大臣',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 95,
                    charisma: 80, integrity: 85, benevolence: 75,
                    diplomacy: 88, scholarship: 100, finance: 85, cunning: 85 },
      loyalty: 92, ambition: 75,
      traits: ['brilliant','reformist','scholarly','rigorous'],
      resources: {
        privateWealth: { money: 1000000, land: 20000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 88,
      background: '直隶南皮人·咸丰探花·办洋务·汉阳铁厂·两湖书院·中体西用·废科举立学堂·清流派。',
      famousQuote: '中学为体·西学为用。',
      historicalFate: '宣统元年病殁',
      fateHint: 'peacefulDeath'
    },

    yuanChongHuanXing: {
      id: 'yuanChongHuanXing', name: '袁世凯', zi: '慰亭',
      birthYear: 1859, deathYear: 1916, alternateNames: ['容庵','洪宪皇帝'],
      era: '光宣民初', dynasty: '清', role: 'usurper',
      title: '一等侯', officialTitle: '内阁总理大臣',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 88, military: 88, intelligence: 92,
                    charisma: 78, integrity: 30, benevolence: 50,
                    diplomacy: 88, scholarship: 70, finance: 80, cunning: 95 },
      loyalty: 20, ambition: 100,
      traits: ['scheming','ruthless','ambitious','clever'],
      resources: {
        privateWealth: { money: 20000000, land: 300000, treasure: 50000000, slaves: 3000, commerce: 5000000 },
        hiddenWealth: 5000000, fame: -50, virtueMerit: 200, virtueStage: 2
      },
      integrity: 35,
      background: '河南项城人·小站练兵·戊戌告密·新政·辛亥逼清帝退位·窃国大总统·洪宪称帝八十三日。',
      famousQuote: '',
      historicalFate: '洪宪元年称帝失败·忧愤而殁',
      fateHint: 'forcedDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-03] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
