// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-09.js
// Domain: NPC / 历史人物 data
// 来源·波 9
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
    gongsunLong: {
      id: 'gongsunLong', name: '公孙龙', zi: '子秉',
      birthYear: -320, deathYear: -250, alternateNames: ['平原君门客'],
      era: '战国', dynasty: '赵', role: 'scholar',
      title: '', officialTitle: '平原君门客',
      rankLevel: 8, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 50, military: 25, intelligence: 95,
                    charisma: 78, integrity: 80, benevolence: 65,
                    diplomacy: 70, scholarship: 100, finance: 50, cunning: 80 },
      loyalty: 70, ambition: 50,
      traits: ['scholarly','sage','clever','reclusive'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 80,
      background: '赵国人·名家代表·平原君门客·白马非马·坚白论·先秦名学集大成。',
      famousQuote: '白马非马。',
      historicalFate: '赵孝成王末病殁',
      fateHint: 'peacefulDeath'
    },

    zouji: {
      id: 'zouji', name: '邹忌', zi: '',
      birthYear: -385, deathYear: -319, alternateNames: ['成侯'],
      era: '战国', dynasty: '齐', role: 'reformer',
      title: '成侯', officialTitle: '相国',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 95,
                    charisma: 92, integrity: 88, benevolence: 80,
                    diplomacy: 95, scholarship: 92, finance: 75, cunning: 88 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','clever','reformist','sage'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '齐威王相·讽齐王纳谏·与徐公比美·齐国战国早期最强·桂陵之战策划者之一。',
      famousQuote: '吾妻之美我者·私我也。',
      historicalFate: '齐宣王初病殁',
      fateHint: 'peacefulDeath'
    },

    zhaokuo: {
      id: 'zhaokuo', name: '赵括', zi: '',
      birthYear: -280, deathYear: -260, alternateNames: ['马服子'],
      era: '战国', dynasty: '赵', role: 'military',
      title: '马服君·上将军', officialTitle: '将军',
      rankLevel: 26, socialClass: 'noble', department: 'military',
      abilities: { governance: 50, military: 60, intelligence: 80,
                    charisma: 70, integrity: 75, benevolence: 60,
                    diplomacy: 50, scholarship: 92, finance: 50, cunning: 50 },
      loyalty: 80, ambition: 80,
      traits: ['scholarly','proud','idealist','vain'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: -30, virtueMerit: 200, virtueStage: 2
      },
      integrity: 78,
      background: '赵奢子·熟读兵书·纸上谈兵典出此·替廉颇守长平·中白起之计·四十万降卒被坑。',
      famousQuote: '使赵不将括即已·若必将之·破赵军者必括也。',
      historicalFate: '长平之战中流矢殁',
      fateHint: 'martyrdom'
    },

    libing: {
      id: 'libing', name: '李冰', zi: '',
      birthYear: -302, deathYear: -235, alternateNames: ['川主大帝'],
      era: '战国', dynasty: '秦', role: 'reformer',
      title: '蜀郡守', officialTitle: '蜀郡守',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 95, military: 30, intelligence: 95,
                    charisma: 78, integrity: 95, benevolence: 95,
                    diplomacy: 60, scholarship: 92, finance: 88, cunning: 80 },
      loyalty: 92, ambition: 60,
      traits: ['rigorous','reformist','benevolent','sage'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 98,
      background: '秦昭襄王朝蜀郡守·父子主修都江堰·治水分洪通灌·成都平原天府之始·四川人立祠万代。',
      famousQuote: '深淘滩·低作堰。',
      historicalFate: '秦昭襄王末终于任所',
      fateHint: 'peacefulDeath'
    },

    shusunTong: {
      id: 'shusunTong', name: '叔孙通', zi: '希',
      birthYear: -245, deathYear: -190, alternateNames: ['稷嗣君'],
      era: '汉初', dynasty: '西汉', role: 'scholar',
      title: '稷嗣君', officialTitle: '太子太傅',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 25, intelligence: 92,
                    charisma: 80, integrity: 60, benevolence: 75,
                    diplomacy: 88, scholarship: 100, finance: 65, cunning: 92 },
      loyalty: 75, ambition: 70,
      traits: ['scholarly','clever','patient','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 70,
      background: '薛人·历仕秦楚汉·汉初制朝仪·使群臣有序朝拜·儒家与庙堂结合之始。',
      famousQuote: '吾乃今日知为皇帝之贵也。',
      historicalFate: '惠帝末病殁',
      fateHint: 'peacefulDeath'
    },

    xiaoWangzhi: {
      id: 'xiaoWangzhi', name: '萧望之', zi: '长倩',
      birthYear: -114, deathYear: -47, alternateNames: ['关内侯','文'],
      era: '宣元朝', dynasty: '西汉', role: 'loyal',
      title: '关内侯', officialTitle: '前将军·光禄勋',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 60, intelligence: 92,
                    charisma: 80, integrity: 95, benevolence: 80,
                    diplomacy: 70, scholarship: 95, finance: 70, cunning: 70 },
      loyalty: 95, ambition: 70,
      traits: ['scholarly','upright','rigorous','heroic'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '东海兰陵人·宣帝重臣·元帝太傅·与宦官石显斗·被构陷下狱·饮鸩死。',
      famousQuote: '吾尝备位将相·年踰六十·老入牢狱·苟求生·不亦鄙乎。',
      historicalFate: '初元二年遭石显构陷·饮鸩自杀',
      fateHint: 'forcedDeath'
    },

    kuangheng: {
      id: 'kuangheng', name: '匡衡', zi: '稚圭',
      birthYear: -95, deathYear: -30, alternateNames: ['乐安侯'],
      era: '元成朝', dynasty: '西汉', role: 'scholar',
      title: '乐安侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 25, intelligence: 92,
                    charisma: 78, integrity: 65, benevolence: 75,
                    diplomacy: 75, scholarship: 100, finance: 70, cunning: 78 },
      loyalty: 85, ambition: 80,
      traits: ['scholarly','clever','humble_origin','idealist'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 70,
      background: '东海承人·凿壁偷光·治《诗》·元帝朝丞相·后侵占封地被免为庶人。',
      famousQuote: '凿壁偷光。',
      historicalFate: '永始末贬庶人·终于本籍',
      fateHint: 'retirement'
    },

    yangzhen: {
      id: 'yangzhen', name: '杨震', zi: '伯起',
      birthYear: 59, deathYear: 124, alternateNames: ['关西夫子','弘农杨'],
      era: '安顺朝', dynasty: '东汉', role: 'clean',
      title: '太尉', officialTitle: '太尉',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 30, intelligence: 92,
                    charisma: 85, integrity: 100, benevolence: 90,
                    diplomacy: 70, scholarship: 100, finance: 75, cunning: 70 },
      loyalty: 95, ambition: 65,
      traits: ['upright','scholarly','heroic','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 100,
      background: '弘农华阴人·关西夫子·四知拒贿·遭外戚樊丰构陷罢官·饮鸩自尽。',
      famousQuote: '天知·神知·我知·子知·何谓无知。',
      historicalFate: '延光三年遭樊丰构陷·饮鸩自尽',
      fateHint: 'forcedDeath'
    },

    chenfan: {
      id: 'chenfan', name: '陈蕃', zi: '仲举',
      birthYear: 90, deathYear: 168, alternateNames: ['不其乡侯'],
      era: '汉末', dynasty: '东汉', role: 'loyal',
      title: '不其乡侯', officialTitle: '太傅·尚书令',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 50, intelligence: 88,
                    charisma: 80, integrity: 100, benevolence: 80,
                    diplomacy: 60, scholarship: 92, finance: 60, cunning: 70 },
      loyalty: 100, ambition: 75,
      traits: ['upright','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '汝南平舆人·桓灵之际清流领袖·窦武谋诛宦官·事败入禁中力战而死。',
      famousQuote: '一屋不扫·何以扫天下。',
      historicalFate: '建宁元年宦官曹节作乱被害',
      fateHint: 'martyrdom'
    },

    zhongYou: {
      id: 'zhongYou', name: '钟繇', zi: '元常',
      birthYear: 151, deathYear: 230, alternateNames: ['定陵侯','成'],
      era: '汉末三国', dynasty: '曹魏', role: 'scholar',
      title: '定陵侯', officialTitle: '太傅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92,
                    charisma: 80, integrity: 88, benevolence: 78,
                    diplomacy: 75, scholarship: 100, finance: 75, cunning: 78 },
      loyalty: 92, ambition: 65,
      traits: ['scholarly','literary','rigorous','sage'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 88,
      background: '颍川长社人·钟会父·楷书之祖·曹魏三朝元老·与王羲之并称钟王。',
      famousQuote: '书者·散也。',
      historicalFate: '太和四年寿终·年八十',
      fateHint: 'peacefulDeath'
    },

    chenqun: {
      id: 'chenqun', name: '陈群', zi: '长文',
      birthYear: 170, deathYear: 237, alternateNames: ['颍乡侯','靖'],
      era: '三国', dynasty: '曹魏', role: 'reformer',
      title: '颍乡侯', officialTitle: '司空',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 50, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 80, scholarship: 92, finance: 80, cunning: 85 },
      loyalty: 95, ambition: 65,
      traits: ['brilliant','scholarly','rigorous','reformist'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '颍川许昌人·陈寔孙·制九品中正制·辅曹操曹丕曹叡三代·中国选官制度史关键。',
      famousQuote: '人之为政·首在用人。',
      historicalFate: '青龙五年病殁',
      fateHint: 'peacefulDeath'
    },

    yangxiu: {
      id: 'yangxiu', name: '杨修', zi: '德祖',
      birthYear: 175, deathYear: 219, alternateNames: ['弘农杨'],
      era: '汉末', dynasty: '曹魏', role: 'scholar',
      title: '主簿', officialTitle: '丞相主簿',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 30, intelligence: 95,
                    charisma: 80, integrity: 78, benevolence: 70,
                    diplomacy: 65, scholarship: 100, finance: 55, cunning: 88 },
      loyalty: 75, ambition: 80,
      traits: ['literary','clever','idealist','vain'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 600, virtueStage: 5
      },
      integrity: 78,
      background: '弘农华阴人·杨彪子·袁术外甥·才思敏捷·七步即猜·助曹植夺嫡·鸡肋谶被斩。',
      famousQuote: '鸡肋者·食之无味·弃之可惜。',
      historicalFate: '建安二十四年汉中以惑众罪斩',
      fateHint: 'execution'
    },

    kongrong: {
      id: 'kongrong', name: '孔融', zi: '文举',
      birthYear: 153, deathYear: 208, alternateNames: ['孔北海'],
      era: '汉末', dynasty: '东汉', role: 'loyal',
      title: '太中大夫', officialTitle: '北海相·太中大夫',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 50, intelligence: 88,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 70, scholarship: 100, finance: 50, cunning: 65 },
      loyalty: 100, ambition: 65,
      traits: ['literary','heroic','idealist','proud'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '鲁国曲阜人·孔子二十世孙·建安七子之一·让梨典故·屡讽曹操·终被构陷弃市。',
      famousQuote: '父之于子·当有何亲·论其本意·实为情欲发耳。',
      historicalFate: '建安十三年弃市·全家被诛',
      fateHint: 'executionByClanDestruction'
    },

    tianfeng: {
      id: 'tianfeng', name: '田丰', zi: '元皓',
      birthYear: 145, deathYear: 200, alternateNames: [],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '别驾', officialTitle: '冀州别驾',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 80, military: 70, intelligence: 95,
                    charisma: 60, integrity: 92, benevolence: 70,
                    diplomacy: 55, scholarship: 88, finance: 60, cunning: 88 },
      loyalty: 95, ambition: 65,
      traits: ['brilliant','rigorous','heroic','proud'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 95,
      background: '巨鹿人·袁绍谋主·力谏勿与曹决战·官渡战前下狱·袁绍败后愧而杀之。',
      famousQuote: '若军有利·当复见原·今军败·吾其死矣。',
      historicalFate: '建安五年袁绍败于官渡·下狱被斩',
      fateHint: 'execution'
    },

    duYu: {
      id: 'duYu', name: '杜预', zi: '元凯',
      birthYear: 222, deathYear: 285, alternateNames: ['当阳侯','成'],
      era: '魏晋', dynasty: '西晋', role: 'military',
      title: '当阳县侯', officialTitle: '镇南大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 88, military: 92, intelligence: 95,
                    charisma: 80, integrity: 88, benevolence: 78,
                    diplomacy: 75, scholarship: 100, finance: 75, cunning: 88 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','scholarly','heroic','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 88,
      background: '京兆杜陵人·灭吴主帅·撰《春秋左氏经传集解》·武库之号·史称杜武库。',
      famousQuote: '譬如破竹·数节之后·皆迎刃而解。',
      historicalFate: '太康六年还洛·途中病殁',
      fateHint: 'peacefulDeath'
    },

    yanghu: {
      id: 'yanghu', name: '羊祜', zi: '叔子',
      birthYear: 221, deathYear: 278, alternateNames: ['钜平侯','成'],
      era: '魏晋', dynasty: '西晋', role: 'military',
      title: '钜平侯', officialTitle: '征南大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 92, military: 88, intelligence: 92,
                    charisma: 92, integrity: 95, benevolence: 95,
                    diplomacy: 88, scholarship: 92, finance: 78, cunning: 80 },
      loyalty: 95, ambition: 65,
      traits: ['benevolent','heroic','sage','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 98,
      background: '泰山南城人·镇襄阳十年·与陆抗对峙互敬·拜表灭吴而未得见·百姓泪堕碑。',
      famousQuote: '天下不如意事十常居七八。',
      historicalFate: '咸宁四年病殁·百姓巷哭立堕泪碑',
      fateHint: 'peacefulDeath'
    },

    jikang: {
      id: 'jikang', name: '嵇康', zi: '叔夜',
      birthYear: 224, deathYear: 263, alternateNames: ['中散大夫'],
      era: '魏晋', dynasty: '曹魏', role: 'scholar',
      title: '中散大夫', officialTitle: '中散大夫',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 30, intelligence: 95,
                    charisma: 95, integrity: 100, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 60 },
      loyalty: 88, ambition: 35,
      traits: ['literary','sage','reclusive','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 920, virtueStage: 6
      },
      integrity: 100,
      background: '谯国铚人·竹林七贤之首·锻铁柳下·拒钟会·与山涛绝交·临刑前奏《广陵散》。',
      famousQuote: '广陵散于今绝矣。',
      historicalFate: '景元四年遭钟会构陷·东市就刑',
      fateHint: 'executionByFraming'
    },

    ruanji: {
      id: 'ruanji', name: '阮籍', zi: '嗣宗',
      birthYear: 210, deathYear: 263, alternateNames: ['阮步兵'],
      era: '魏晋', dynasty: '曹魏', role: 'scholar',
      title: '步兵校尉', officialTitle: '步兵校尉·关内侯',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 30, intelligence: 95,
                    charisma: 90, integrity: 88, benevolence: 75,
                    diplomacy: 60, scholarship: 100, finance: 50, cunning: 80 },
      loyalty: 78, ambition: 35,
      traits: ['literary','sage','reclusive','luxurious'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '陈留尉氏人·阮瑀子·竹林七贤·青白眼·穷途之哭·避世佯狂全身·五言咏怀八十二首。',
      famousQuote: '时无英雄·使竖子成名。',
      historicalFate: '景元四年病殁',
      fateHint: 'peacefulDeath'
    },

    gehong: {
      id: 'gehong', name: '葛洪', zi: '稚川',
      birthYear: 283, deathYear: 343, alternateNames: ['抱朴子','勾漏令'],
      era: '东晋', dynasty: '东晋', role: 'scholar',
      title: '关内侯', officialTitle: '勾漏令',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 60, military: 50, intelligence: 95,
                    charisma: 75, integrity: 92, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 65 },
      loyalty: 75, ambition: 40,
      traits: ['scholarly','sage','reclusive','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '丹阳句容人·东晋道士医师·撰《抱朴子》《肘后备急方》·中国炼丹术化学先驱。',
      famousQuote: '志道者士·上士求道·中士求名·下士求利。',
      historicalFate: '建元元年罗浮山尸解仙逝',
      fateHint: 'retirement'
    },

    cuihao: {
      id: 'cuihao', name: '崔浩', zi: '伯渊',
      birthYear: 381, deathYear: 450, alternateNames: ['白马公'],
      era: '北魏', dynasty: '北魏', role: 'reformer',
      title: '白马公', officialTitle: '司徒',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 75, intelligence: 100,
                    charisma: 78, integrity: 80, benevolence: 65,
                    diplomacy: 80, scholarship: 100, finance: 75, cunning: 95 },
      loyalty: 92, ambition: 88,
      traits: ['brilliant','scholarly','reformist','proud'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 80,
      background: '清河东武城人·三朝重臣·汉化派核心·灭佛·谋统一华北·后因国史案被夷三族。',
      famousQuote: '与北魏君臣·尽其谋略。',
      historicalFate: '太平真君十一年因国史案夷三族',
      fateHint: 'executionByClanDestruction'
    },

    guKaizhi: {
      id: 'guKaizhi', name: '顾恺之', zi: '长康',
      birthYear: 348, deathYear: 409, alternateNames: ['虎头','三绝'],
      era: '东晋', dynasty: '东晋', role: 'scholar',
      title: '散骑常侍', officialTitle: '散骑常侍',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 80, integrity: 78, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 78, ambition: 40,
      traits: ['literary','reclusive','vain','sage'],
      resources: {
        privateWealth: { money: 200000, land: 2000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 80,
      background: '晋陵无锡人·才绝画绝痴绝·撰《女史箴图》《洛神赋图》·中国人物画奠基。',
      famousQuote: '传神写照·正在阿堵中。',
      historicalFate: '义熙五年病殁',
      fateHint: 'peacefulDeath'
    },

    xieLingyun: {
      id: 'xieLingyun', name: '谢灵运', zi: '',
      birthYear: 385, deathYear: 433, alternateNames: ['谢康乐','谢客'],
      era: '南朝宋', dynasty: '南朝宋', role: 'scholar',
      title: '康乐县公', officialTitle: '永嘉太守',
      rankLevel: 20, socialClass: 'noble', department: 'local',
      abilities: { governance: 50, military: 25, intelligence: 88,
                    charisma: 88, integrity: 75, benevolence: 70,
                    diplomacy: 50, scholarship: 100, finance: 70, cunning: 65 },
      loyalty: 65, ambition: 80,
      traits: ['literary','luxurious','proud','reclusive'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 700, virtueStage: 5
      },
      integrity: 70,
      background: '陈郡阳夏人·谢玄孙·山水诗派开山·才高八斗·恃才放旷·谋反被斩广州。',
      famousQuote: '天下才共一石·曹子建独得八斗·我得一斗·天下共分一斗。',
      historicalFate: '元嘉十年广州弃市',
      fateHint: 'execution'
    },

    yanGaoqing: {
      id: 'yanGaoqing', name: '颜杲卿', zi: '昕',
      birthYear: 692, deathYear: 756, alternateNames: ['颜常山','文忠'],
      era: '玄宗朝', dynasty: '唐', role: 'loyal',
      title: '常山太守', officialTitle: '常山太守',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 78, military: 80, intelligence: 88,
                    charisma: 85, integrity: 100, benevolence: 80,
                    diplomacy: 60, scholarship: 88, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 70,
      traits: ['heroic','loyal','brave','rigorous'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '京兆万年人·颜真卿堂兄·安史之乱率常山起义·城破被俘·骂安禄山被钩舌而死。',
      famousQuote: '吾世为唐臣·常守忠义。',
      historicalFate: '至德元载洛阳被俘·钩舌肢解而死',
      fateHint: 'martyrdom'
    },

    lisu: {
      id: 'lisu', name: '李愬', zi: '元直',
      birthYear: 773, deathYear: 821, alternateNames: ['凉国公','武'],
      era: '宪宗朝', dynasty: '唐', role: 'military',
      title: '凉国公', officialTitle: '检校左仆射',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 95, intelligence: 95,
                    charisma: 85, integrity: 90, benevolence: 80,
                    diplomacy: 70, scholarship: 80, finance: 65, cunning: 95 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','brave','clever','heroic'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 400, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '洮州临潭人·李晟子·夜袭蔡州生擒吴元济·中唐削藩第一功·元和中兴关键。',
      famousQuote: '出其不意·攻其无备。',
      historicalFate: '长庆元年病殁',
      fateHint: 'peacefulDeath'
    },

    huangTingjian: {
      id: 'huangTingjian', name: '黄庭坚', zi: '鲁直',
      birthYear: 1045, deathYear: 1105, alternateNames: ['山谷道人','涪翁','文节'],
      era: '神哲徽朝', dynasty: '北宋', role: 'scholar',
      title: '宣州知州', officialTitle: '宜州安置',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 60, military: 25, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 88, ambition: 55,
      traits: ['literary','scholarly','idealist','luxurious'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '洪州分宁人·苏门四学士之一·江西诗派开山·宋四家书法·元祐党案累贬岭外。',
      famousQuote: '士大夫三日不读书·则义理不交于胸中。',
      historicalFate: '崇宁四年贬宜州·秋雨中病殁',
      fateHint: 'exileDeath'
    },

    qinguan: {
      id: 'qinguan', name: '秦观', zi: '少游',
      birthYear: 1049, deathYear: 1100, alternateNames: ['淮海居士'],
      era: '哲宗朝', dynasty: '北宋', role: 'scholar',
      title: '太学博士', officialTitle: '雷州编管',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 25, intelligence: 88,
                    charisma: 88, integrity: 85, benevolence: 78,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 55 },
      loyalty: 80, ambition: 60,
      traits: ['literary','idealist','reclusive','luxurious'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 750, virtueStage: 5
      },
      integrity: 85,
      background: '高邮人·苏门四学士·婉约词宗·元祐党案累贬岭外·北归途中藤州殁。',
      famousQuote: '两情若是久长时·又岂在朝朝暮暮。',
      historicalFate: '元符三年北归途中藤州殁',
      fateHint: 'exileDeath'
    },

    jiaSidao: {
      id: 'jiaSidao', name: '贾似道', zi: '师宪',
      birthYear: 1213, deathYear: 1275, alternateNames: ['秋壑','悦生'],
      era: '南宋末', dynasty: '南宋', role: 'corrupt',
      title: '太师·平章军国重事', officialTitle: '右丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 40, intelligence: 80,
                    charisma: 75, integrity: 20, benevolence: 30,
                    diplomacy: 70, scholarship: 75, finance: 70, cunning: 90 },
      loyalty: 35, ambition: 95,
      traits: ['scheming','luxurious','flatterer','ruthless'],
      resources: {
        privateWealth: { money: 8000000, land: 200000, treasure: 30000000, slaves: 5000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -90, virtueMerit: 50, virtueStage: 1
      },
      integrity: 20,
      background: '台州人·贾贵妃弟·南宋末权相·公田法害民·鄂州瞒报议和·丁家洲大败·贬循州被杀。',
      famousQuote: '朝中无人莫做官。',
      historicalFate: '德祐元年贬循州·途中被押解郑虎臣杀于木绵庵',
      fateHint: 'execution'
    },

    shenZhou: {
      id: 'shenZhou', name: '沈周', zi: '启南',
      birthYear: 1427, deathYear: 1509, alternateNames: ['石田','白石翁','玉田生'],
      era: '成化弘治', dynasty: '明', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 50, scholarship: 100, finance: 70, cunning: 60 },
      loyalty: 75, ambition: 30,
      traits: ['literary','reclusive','sage','benevolent'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '苏州长洲人·吴门画派开山·与文徵明唐寅仇英并称明四家·终生不仕·诗书画三绝。',
      famousQuote: '画原是为意所役·今乃以意从画。',
      historicalFate: '正德四年寿终·年八十三',
      fateHint: 'retirement'
    },

    wenZhengming: {
      id: 'wenZhengming', name: '文徵明', zi: '徵仲',
      birthYear: 1470, deathYear: 1559, alternateNames: ['衡山居士','停云'],
      era: '弘治正德嘉靖', dynasty: '明', role: 'scholar',
      title: '翰林院待诏', officialTitle: '翰林待诏',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 60, military: 25, intelligence: 92,
                    charisma: 88, integrity: 95, benevolence: 85,
                    diplomacy: 55, scholarship: 100, finance: 65, cunning: 60 },
      loyalty: 85, ambition: 40,
      traits: ['literary','scholarly','sage','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '苏州长洲人·沈周弟子·明四家之一·授翰林待诏三年辞归·一生书画八十年·吴门四才子。',
      famousQuote: '人品不高·用墨无法。',
      historicalFate: '嘉靖三十八年寿终·年九十',
      fateHint: 'peacefulDeath'
    },

    wengTonghe: {
      id: 'wengTonghe', name: '翁同龢', zi: '叔平',
      birthYear: 1830, deathYear: 1904, alternateNames: ['松禅','瓶庵居士','文恭'],
      era: '同光', dynasty: '清', role: 'scholar',
      title: '协办大学士', officialTitle: '军机大臣·户部尚书',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 30, intelligence: 92,
                    charisma: 85, integrity: 90, benevolence: 80,
                    diplomacy: 78, scholarship: 100, finance: 80, cunning: 80 },
      loyalty: 92, ambition: 80,
      traits: ['scholarly','literary','rigorous','idealist'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '常熟人·两朝帝师·光绪戊戌支持变法·与李鸿章不合·政变后被开缺回籍永不叙用。',
      famousQuote: '天下事·惟可可然者难。',
      historicalFate: '光绪三十年病殁常熟',
      fateHint: 'exileDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-09] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
