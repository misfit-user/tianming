// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-11.js
// Domain: NPC / 历史人物 data
// 来源·波 11
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
    guiguzi: {
      id: 'guiguzi', name: '王禅', zi: '诩',
      birthYear: -400, deathYear: -320, alternateNames: ['鬼谷子','王诩','玄微子'],
      era: '战国', dynasty: '楚', role: 'scholar',
      title: '', officialTitle: '隐士',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 75, intelligence: 100,
                    charisma: 88, integrity: 88, benevolence: 70,
                    diplomacy: 100, scholarship: 100, finance: 60, cunning: 100 },
      loyalty: 50, ambition: 30,
      traits: ['sage','reclusive','scholarly','clever'],
      resources: {
        privateWealth: { money: 5000, land: 50, treasure: 1000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '楚国云梦山人·纵横家鼻祖·授徒苏秦张仪孙膑庞涓·撰《鬼谷子》·谋略学之祖。',
      famousQuote: '潜谋于无形·常胜于不争不费。',
      historicalFate: '终隐云梦山',
      fateHint: 'retirement'
    },

    luban: {
      id: 'luban', name: '公输班', zi: '依',
      birthYear: -507, deathYear: -444, alternateNames: ['鲁班','公输盘','公输子'],
      era: '春秋末战国', dynasty: '鲁', role: 'scholar',
      title: '', officialTitle: '匠师',
      rankLevel: 5, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 70, intelligence: 95,
                    charisma: 75, integrity: 88, benevolence: 75,
                    diplomacy: 50, scholarship: 95, finance: 75, cunning: 80 },
      loyalty: 75, ambition: 40,
      traits: ['brilliant','sage','rigorous','reclusive'],
      resources: {
        privateWealth: { money: 100000, land: 1000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 850, virtueStage: 6
      },
      integrity: 90,
      background: '鲁国匠师·中国土木工匠之祖·造云梯·墨子止之·发明锯锛刨钻规矩·百工奉为祖师。',
      famousQuote: '巧匠之子·必学其旁。',
      historicalFate: '终于本籍·寿六十三',
      fateHint: 'peacefulDeath'
    },

    zhibo: {
      id: 'zhibo', name: '荀瑶', zi: '伯',
      birthYear: -506, deathYear: -453, alternateNames: ['智伯瑶','智襄子'],
      era: '春秋末', dynasty: '晋', role: 'usurper',
      title: '智氏宗主', officialTitle: '晋国正卿',
      rankLevel: 28, socialClass: 'noble', department: 'central',
      abilities: { governance: 75, military: 85, intelligence: 80,
                    charisma: 78, integrity: 50, benevolence: 50,
                    diplomacy: 65, scholarship: 80, finance: 75, cunning: 78 },
      loyalty: 50, ambition: 100,
      traits: ['brave','heroic','proud','vain'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 30, virtueMerit: 300, virtueStage: 3
      },
      integrity: 50,
      background: '春秋晋国六卿之首·欲灭赵韩魏三家·围晋阳决水·三家反间联合反·身死国灭三家分晋。',
      famousQuote: '',
      historicalFate: '周贞定王十六年三家攻智氏·智伯被杀·头颅漆为饮器',
      fateHint: 'martyrdom'
    },

    zuoQiuming: {
      id: 'zuoQiuming', name: '左丘明', zi: '',
      birthYear: -502, deathYear: -422, alternateNames: ['左公'],
      era: '春秋末', dynasty: '鲁', role: 'scholar',
      title: '', officialTitle: '太史',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 25, intelligence: 92,
                    charisma: 75, integrity: 95, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 80, ambition: 40,
      traits: ['scholarly','rigorous','sage','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 95,
      background: '鲁国都君庄人·鲁国太史·撰《左传》《国语》·与孔子同时·中国史学之祖。',
      famousQuote: '匹夫匹妇之愚·不可强诘。',
      historicalFate: '寿八十而终',
      fateHint: 'peacefulDeath'
    },

    zhangCang: {
      id: 'zhangCang', name: '张苍', zi: '',
      birthYear: -256, deathYear: -152, alternateNames: ['北平文侯'],
      era: '汉初', dynasty: '西汉', role: 'scholar',
      title: '北平侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92,
                    charisma: 75, integrity: 80, benevolence: 75,
                    diplomacy: 75, scholarship: 100, finance: 88, cunning: 75 },
      loyalty: 92, ambition: 60,
      traits: ['scholarly','rigorous','patient','sage'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 85,
      background: '阳武人·秦为御史·荀子门徒·定历定律·汉初宰相·寿百岁·中国数学律历重要人物。',
      famousQuote: '',
      historicalFate: '景帝五年寿终·年百岁',
      fateHint: 'peacefulDeath'
    },

    jibu: {
      id: 'jibu', name: '季布', zi: '',
      birthYear: -240, deathYear: -170, alternateNames: ['河东守'],
      era: '汉初', dynasty: '西汉', role: 'loyal',
      title: '中郎将', officialTitle: '河东守',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'local',
      abilities: { governance: 75, military: 80, intelligence: 78,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 60, finance: 60, cunning: 70 },
      loyalty: 90, ambition: 60,
      traits: ['heroic','loyal','rigorous','brave'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '楚地人·原项羽部·得诺千金·黄金百斤不如季布一诺·汉初武人忠义之范。',
      famousQuote: '一诺千金。',
      historicalFate: '汉文帝中年寿终',
      fateHint: 'peacefulDeath'
    },

    douying: {
      id: 'douying', name: '窦婴', zi: '王孙',
      birthYear: -200, deathYear: -131, alternateNames: ['魏其侯'],
      era: '景武朝', dynasty: '西汉', role: 'regent',
      title: '魏其侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 80, military: 75, intelligence: 85,
                    charisma: 85, integrity: 85, benevolence: 80,
                    diplomacy: 75, scholarship: 80, finance: 70, cunning: 70 },
      loyalty: 92, ambition: 78,
      traits: ['heroic','rigorous','loyal','proud'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '观津人·窦太后从兄子·七国之乱守荥阳·武帝初为相·与田蚡相争·终被诬下狱弃市。',
      famousQuote: '',
      historicalFate: '元光四年下狱弃市',
      fateHint: 'executionByFraming'
    },

    yinLihua: {
      id: 'yinLihua', name: '阴丽华', zi: '',
      birthYear: 5, deathYear: 64, alternateNames: ['光烈皇后','明德'],
      era: '光武朝', dynasty: '东汉', role: 'loyal',
      title: '皇后', officialTitle: '皇后',
      rankLevel: 30, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 80, military: 25, intelligence: 88,
                    charisma: 95, integrity: 100, benevolence: 95,
                    diplomacy: 85, scholarship: 85, finance: 75, cunning: 75 },
      loyalty: 100, ambition: 50,
      traits: ['benevolent','sage','loyal','rigorous'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '南阳新野人·光武帝皇后·让位郭氏·二十年后复立·贤淑敦厚·明帝生母。',
      famousQuote: '仕宦当作执金吾·娶妻当得阴丽华。',
      historicalFate: '永平七年崩',
      fateHint: 'peacefulDeath'
    },

    liangji: {
      id: 'liangji', name: '梁冀', zi: '伯卓',
      birthYear: 100, deathYear: 159, alternateNames: ['跋扈将军'],
      era: '顺桓朝', dynasty: '东汉', role: 'corrupt',
      title: '大将军·乘氏侯', officialTitle: '大将军',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 50, military: 60, intelligence: 70,
                    charisma: 65, integrity: 5, benevolence: 5,
                    diplomacy: 60, scholarship: 50, finance: 70, cunning: 88 },
      loyalty: 20, ambition: 100,
      traits: ['ruthless','greedy','vain','luxurious'],
      resources: {
        privateWealth: { money: 30000000, land: 1000000, treasure: 100000000, slaves: 30000, commerce: 5000000 },
        hiddenWealth: 10000000, fame: -100, virtueMerit: 0, virtueStage: 1
      },
      integrity: 5,
      background: '安定乌氏人·梁皇后兄·跋扈将军·毒杀质帝·权倾朝野二十年·桓帝联宦官诛之·抄家三十亿。',
      famousQuote: '此跋扈将军也。',
      historicalFate: '延熹二年被桓帝联宦官诛·全族流尽',
      fateHint: 'executionByClanDestruction'
    },

    hejin: {
      id: 'hejin', name: '何进', zi: '遂高',
      birthYear: 135, deathYear: 189, alternateNames: ['慎侯'],
      era: '汉末', dynasty: '东汉', role: 'regent',
      title: '慎侯', officialTitle: '大将军',
      rankLevel: 30, socialClass: 'imperial', department: 'military',
      abilities: { governance: 60, military: 65, intelligence: 65,
                    charisma: 75, integrity: 60, benevolence: 60,
                    diplomacy: 55, scholarship: 50, finance: 60, cunning: 50 },
      loyalty: 80, ambition: 80,
      traits: ['humble_origin','vain','proud','idealist'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 400, virtueStage: 4
      },
      integrity: 65,
      background: '南阳宛人·屠夫出身·何皇后兄·诛蹇硕·欲尽诛宦官·召董卓入京·被宦官诱杀于宫。',
      famousQuote: '',
      historicalFate: '中平六年被十常侍设计诱杀于嘉德殿前',
      fateHint: 'execution'
    },

    feiyi: {
      id: 'feiyi', name: '费祎', zi: '文伟',
      birthYear: 200, deathYear: 253, alternateNames: ['成乡侯','敬'],
      era: '蜀汉', dynasty: '蜀汉', role: 'regent',
      title: '成乡侯', officialTitle: '大将军·录尚书事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 75, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 85,
                    diplomacy: 85, scholarship: 88, finance: 75, cunning: 78 },
      loyalty: 95, ambition: 60,
      traits: ['brilliant','clever','loyal','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '江夏鄳人·诸葛亮称之社稷之器·继蒋琬执蜀政·主守不主攻·节制姜维·后被魏降人郭循刺杀。',
      famousQuote: '吾等不如丞相亦远矣。',
      historicalFate: '延熙十六年被郭循刺杀',
      fateHint: 'execution'
    },

    wangping: {
      id: 'wangping', name: '王平', zi: '子均',
      birthYear: 180, deathYear: 248, alternateNames: ['安汉侯'],
      era: '三国', dynasty: '蜀汉', role: 'military',
      title: '安汉侯', officialTitle: '镇北大将军',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 88, intelligence: 78,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 50, scholarship: 50, finance: 60, cunning: 78 },
      loyalty: 95, ambition: 65,
      traits: ['brave','rigorous','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 750, virtueStage: 5
      },
      integrity: 95,
      background: '巴西宕渠人·原曹魏部·街亭之战·后镇汉中·兴势之战大破曹爽·蜀汉后期国之干城。',
      famousQuote: '',
      historicalFate: '延熙十一年病殁',
      fateHint: 'peacefulDeath'
    },

    liaohua: {
      id: 'liaohua', name: '廖化', zi: '元俭',
      birthYear: 190, deathYear: 264, alternateNames: ['中乡侯'],
      era: '三国蜀末', dynasty: '蜀汉', role: 'military',
      title: '中乡侯', officialTitle: '右车骑将军',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 78, intelligence: 75,
                    charisma: 75, integrity: 92, benevolence: 75,
                    diplomacy: 55, scholarship: 55, finance: 55, cunning: 65 },
      loyalty: 100, ambition: 55,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 95,
      background: '襄阳中庐人·初为关羽主簿·麦城突围·诈死归蜀·从诸葛姜维伐魏·蜀亡迁洛阳途中殁。',
      famousQuote: '蜀中无大将·廖化作先锋。',
      historicalFate: '咸熙元年迁洛阳途中病殁',
      fateHint: 'peacefulDeath'
    },

    taokan: {
      id: 'taokan', name: '陶侃', zi: '士行',
      birthYear: 259, deathYear: 334, alternateNames: ['长沙郡公','桓'],
      era: '东晋初', dynasty: '东晋', role: 'military',
      title: '长沙郡公', officialTitle: '太尉·荆江都督',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 92, military: 92, intelligence: 92,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 75, scholarship: 80, finance: 80, cunning: 85 },
      loyalty: 95, ambition: 65,
      traits: ['rigorous','brave','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 98,
      background: '鄱阳人·寒门崛起·平苏峻祖约之乱·镇荆江三十年·惜阴运甓·陶渊明曾祖。',
      famousQuote: '大禹圣者·乃惜寸阴·至于众人·当惜分阴。',
      historicalFate: '咸和九年寿终',
      fateHint: 'peacefulDeath'
    },

    weiXiaokuan: {
      id: 'weiXiaokuan', name: '韦孝宽', zi: '叔裕',
      birthYear: 509, deathYear: 580, alternateNames: ['上柱国','襄'],
      era: '西魏北周', dynasty: '北周', role: 'military',
      title: '郧国公', officialTitle: '上柱国',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 95,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 70, scholarship: 75, finance: 65, cunning: 92 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','brave','rigorous','clever'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '京兆杜陵人·守玉壁城·拒高欢十万军·破尉迟迥之乱·北周第一名将·与斛律光对峙不分胜负。',
      famousQuote: '兵贵神速·不在多寡。',
      historicalFate: '大象二年寿终',
      fateHint: 'peacefulDeath'
    },

    huluGuang: {
      id: 'huluGuang', name: '斛律光', zi: '明月',
      birthYear: 515, deathYear: 572, alternateNames: ['咸阳忠武王'],
      era: '北齐', dynasty: '北齐', role: 'military',
      title: '咸阳王', officialTitle: '左丞相·并州刺史',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 70, finance: 65, cunning: 88 },
      loyalty: 100, ambition: 65,
      traits: ['brilliant','brave','heroic','rigorous'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '高车人·北齐第一名将·与韦孝宽相持二十年·百战百胜·后主忌·赐死毡上·北齐失柱。',
      famousQuote: '军国大事·君何为不顾。',
      historicalFate: '武平三年被后主赐死',
      fateHint: 'forcedDeath'
    },

    niuhong: {
      id: 'niuhong', name: '牛弘', zi: '里仁',
      birthYear: 545, deathYear: 610, alternateNames: ['奇章郡公','宪'],
      era: '隋', dynasty: '隋', role: 'scholar',
      title: '奇章郡公', officialTitle: '吏部尚书',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 25, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 100, finance: 70, cunning: 70 },
      loyalty: 92, ambition: 65,
      traits: ['scholarly','rigorous','sage','patient'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '安定鹑觚人·隋开皇之治·主修隋律·开皇礼·撰书目·主持搜集天下藏书·开建国学。',
      famousQuote: '臣闻经籍者·先圣垂教之大典。',
      historicalFate: '大业六年东巡途中病殁江都',
      fateHint: 'peacefulDeath'
    },

    mengjiao: {
      id: 'mengjiao', name: '孟郊', zi: '东野',
      birthYear: 751, deathYear: 814, alternateNames: ['诗囚','贞曜先生'],
      era: '德宪朝', dynasty: '唐', role: 'scholar',
      title: '溧阳尉', officialTitle: '溧阳尉',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 50, military: 25, intelligence: 88,
                    charisma: 75, integrity: 92, benevolence: 88,
                    diplomacy: 50, scholarship: 100, finance: 40, cunning: 55 },
      loyalty: 75, ambition: 60,
      traits: ['literary','idealist','reclusive','heroic'],
      resources: {
        privateWealth: { money: 10000, land: 100, treasure: 3000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '湖州武康人·四十六登第·诗囚·郊瘦岛寒·韩愈称为唐之有道孟郊·游子吟传世。',
      famousQuote: '谁言寸草心·报得三春晖。',
      historicalFate: '元和九年病殁阌乡',
      fateHint: 'exileDeath'
    },

    jiadao: {
      id: 'jiadao', name: '贾岛', zi: '阆仙',
      birthYear: 779, deathYear: 843, alternateNames: ['碣石山人','无本'],
      era: '宪穆敬文武宣朝', dynasty: '唐', role: 'scholar',
      title: '长江县主簿', officialTitle: '普州司仓参军',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 45, military: 25, intelligence: 88,
                    charisma: 75, integrity: 88, benevolence: 75,
                    diplomacy: 45, scholarship: 100, finance: 40, cunning: 50 },
      loyalty: 75, ambition: 50,
      traits: ['literary','reclusive','idealist','rigorous'],
      resources: {
        privateWealth: { money: 10000, land: 100, treasure: 3000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '范阳人·原僧无本·还俗·推敲典出此·韩愈赏之·郊寒岛瘦·一生穷困。',
      famousQuote: '鸟宿池边树·僧敲月下门。',
      historicalFate: '会昌三年病殁普州任所',
      fateHint: 'exileDeath'
    },

    wenTingyun: {
      id: 'wenTingyun', name: '温庭筠', zi: '飞卿',
      birthYear: 812, deathYear: 870, alternateNames: ['温八叉','温八吟'],
      era: '宣懿朝', dynasty: '唐', role: 'scholar',
      title: '国子助教', officialTitle: '国子助教',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 45, military: 25, intelligence: 88,
                    charisma: 88, integrity: 65, benevolence: 70,
                    diplomacy: 50, scholarship: 100, finance: 40, cunning: 70 },
      loyalty: 70, ambition: 60,
      traits: ['literary','luxurious','idealist','vain'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 700, virtueStage: 5
      },
      integrity: 70,
      background: '太原祁人·花间词派鼻祖·温八叉八叉手成八韵·恃才放诞·一生失意·与李商隐并称温李。',
      famousQuote: '梧桐树·三更雨·不道离情正苦。',
      historicalFate: '咸通十一年贬方城尉途中殁',
      fateHint: 'exileDeath'
    },

    zhuwen: {
      id: 'zhuwen', name: '朱温', zi: '',
      birthYear: 852, deathYear: 912, alternateNames: ['朱全忠','后梁太祖','朱晃'],
      era: '唐末后梁', dynasty: '后梁', role: 'usurper',
      title: '后梁太祖', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 78, military: 92, intelligence: 88,
                    charisma: 78, integrity: 25, benevolence: 35,
                    diplomacy: 75, scholarship: 50, finance: 75, cunning: 95 },
      loyalty: 15, ambition: 100,
      traits: ['ruthless','brave','scheming','ambitious'],
      resources: {
        privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 },
        hiddenWealth: 0, fame: -60, virtueMerit: 200, virtueStage: 2
      },
      integrity: 25,
      background: '宋州砀山人·原黄巢部·降唐受赐名全忠·篡唐建梁·五代第一帝·荒淫被亲子朱友珪所弑。',
      famousQuote: '',
      historicalFate: '乾化二年被亲子朱友珪所弑',
      fateHint: 'forcedDeath'
    },

    liCunxu: {
      id: 'liCunxu', name: '李存勖', zi: '亚子',
      birthYear: 885, deathYear: 926, alternateNames: ['后唐庄宗'],
      era: '后唐', dynasty: '后唐', role: 'usurper',
      title: '后唐庄宗', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 60, military: 95, intelligence: 80,
                    charisma: 92, integrity: 60, benevolence: 60,
                    diplomacy: 70, scholarship: 88, finance: 60, cunning: 80 },
      loyalty: 50, ambition: 100,
      traits: ['brave','heroic','vain','luxurious'],
      resources: {
        privateWealth: { money: 25000000, land: 800000, treasure: 60000000, slaves: 25000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 400, virtueStage: 4
      },
      integrity: 65,
      background: '沙陀部李克用子·灭后梁·建后唐·盛极一时·宠伶人误国·兴教门之变·乱军所杀。',
      famousQuote: '今日方知义父三镞之命。',
      historicalFate: '同光四年兴教门之变·乱兵所杀',
      fateHint: 'execution'
    },

    shiHao: {
      id: 'shiHao', name: '史浩', zi: '直翁',
      birthYear: 1106, deathYear: 1194, alternateNames: ['鄞江','文惠'],
      era: '南宋孝宗', dynasty: '南宋', role: 'regent',
      title: '魏国公', officialTitle: '尚书右仆射·同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 88,
                    charisma: 85, integrity: 92, benevolence: 88,
                    diplomacy: 80, scholarship: 92, finance: 75, cunning: 75 },
      loyalty: 95, ambition: 65,
      traits: ['rigorous','sage','patient','benevolent'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 400, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '明州鄞县人·孝宗即位定策·昭雪岳飞·主导隆兴和议·两度入相·南宋朝中调和派代表。',
      famousQuote: '为相·当上不疑·下不诈。',
      historicalFate: '绍熙五年寿终',
      fateHint: 'peacefulDeath'
    },

    yangyi: {
      id: 'yangyi', name: '杨亿', zi: '大年',
      birthYear: 974, deathYear: 1020, alternateNames: ['西昆体'],
      era: '真宗朝', dynasty: '北宋', role: 'scholar',
      title: '工部侍郎', officialTitle: '翰林学士',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 25, intelligence: 92,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 60, scholarship: 100, finance: 65, cunning: 65 },
      loyalty: 88, ambition: 65,
      traits: ['literary','scholarly','rigorous','idealist'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 50000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '建州浦城人·神童早慧·西昆体盟主·撰《册府元龟》·与刘筠钱惟演倡和西昆酬唱集。',
      famousQuote: '雕花刻凤·遗韵清新。',
      historicalFate: '天禧四年病殁',
      fateHint: 'peacefulDeath'
    },

    muHuali: {
      id: 'muHuali', name: '木华黎', zi: '',
      birthYear: 1170, deathYear: 1223, alternateNames: ['国王'],
      era: '蒙古崛起', dynasty: '元', role: 'military',
      title: '国王', officialTitle: '太师·国王',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 80, military: 95, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 75,
                    diplomacy: 75, scholarship: 60, finance: 70, cunning: 88 },
      loyalty: 100, ambition: 70,
      traits: ['brilliant','brave','heroic','loyal'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '札剌儿氏·成吉思汗四杰之一·封国王专责伐金·镇华北·定河北河东·蒙古汉法之先。',
      famousQuote: '',
      historicalFate: '元光二年伐金途中病殁',
      fateHint: 'peacefulDeath'
    },

    wangYun: {
      id: 'wangYun', name: '王恽', zi: '仲谋',
      birthYear: 1227, deathYear: 1304, alternateNames: ['秋涧先生','文定'],
      era: '元世祖成宗', dynasty: '元', role: 'scholar',
      title: '翰林学士承旨', officialTitle: '翰林学士承旨',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 100, finance: 65, cunning: 70 },
      loyalty: 90, ambition: 65,
      traits: ['scholarly','literary','rigorous','sage'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '卫州汲县人·撰《秋涧集》·参修国史·元代文学诗文大家·儒林典范。',
      famousQuote: '',
      historicalFate: '大德八年病殁',
      fateHint: 'peacefulDeath'
    },

    jianyi: {
      id: 'jianyi', name: '蹇义', zi: '宜之',
      birthYear: 1363, deathYear: 1435, alternateNames: ['忠定'],
      era: '永乐宣德', dynasty: '明', role: 'regent',
      title: '太子太师', officialTitle: '吏部尚书',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 30, intelligence: 88,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 75, scholarship: 88, finance: 75, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['rigorous','patient','sage','loyal'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '巴县人·吏部尚书三十余年·历事五朝·考核制度·与夏原吉并称蹇夏·一代名臣。',
      famousQuote: '为吏部·必慎慎。',
      historicalFate: '宣德十年病殁',
      fateHint: 'peacefulDeath'
    },

    shanglu: {
      id: 'shanglu', name: '商辂', zi: '弘载',
      birthYear: 1414, deathYear: 1486, alternateNames: ['素庵','文毅'],
      era: '正统-成化', dynasty: '明', role: 'scholar',
      title: '太子少保', officialTitle: '内阁首辅',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 95,
                    charisma: 85, integrity: 95, benevolence: 88,
                    diplomacy: 75, scholarship: 100, finance: 75, cunning: 78 },
      loyalty: 95, ambition: 65,
      traits: ['brilliant','scholarly','rigorous','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '淳安人·明朝唯一三元及第者·辅三朝·土木后留守·成化辅佐·罢汪直西厂·一代名相。',
      famousQuote: '为相之要·惟在选材。',
      historicalFate: '成化二十二年寿终',
      fateHint: 'peacefulDeath'
    },

    daiZhen: {
      id: 'daiZhen', name: '戴震', zi: '东原',
      birthYear: 1724, deathYear: 1777, alternateNames: ['慎修'],
      era: '乾隆', dynasty: '清', role: 'scholar',
      title: '翰林院庶吉士', officialTitle: '翰林院庶吉士',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 25, intelligence: 100,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 65 },
      loyalty: 80, ambition: 60,
      traits: ['scholarly','sage','rigorous','idealist'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '徽州休宁人·乾嘉考据学集大成·撰《孟子字义疏证》·主修《四库全书》·与纪昀齐名。',
      famousQuote: '心之所同然者·谓理也·义也。',
      historicalFate: '乾隆四十二年病殁',
      fateHint: 'peacefulDeath'
    },

    gongZizhen: {
      id: 'gongZizhen', name: '龚自珍', zi: '璱人',
      birthYear: 1792, deathYear: 1841, alternateNames: ['定庵','龚定庵'],
      era: '道光', dynasty: '清', role: 'scholar',
      title: '礼部主事', officialTitle: '礼部主事',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 25, intelligence: 95,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 55, cunning: 70 },
      loyalty: 85, ambition: 80,
      traits: ['literary','idealist','heroic','reformist'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '杭州人·公羊学派·清末启蒙先驱·已亥杂诗三百一十五首·讥讽官场·辞官归途暴亡。',
      famousQuote: '我劝天公重抖擞·不拘一格降人才。',
      historicalFate: '道光二十一年丹阳暴卒·疑被毒杀',
      fateHint: 'forcedDeath'
    },

    weiYuan: {
      id: 'weiYuan', name: '魏源', zi: '默深',
      birthYear: 1794, deathYear: 1857, alternateNames: ['汉士','良图'],
      era: '道咸', dynasty: '清', role: 'reformer',
      title: '高邮州知州', officialTitle: '高邮州知州',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 78, military: 50, intelligence: 95,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 100, finance: 75, cunning: 75 },
      loyalty: 85, ambition: 80,
      traits: ['scholarly','reformist','idealist','heroic'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '湖南邵阳人·林则徐挚友·撰《海国图志》·师夷长技以制夷·中国近代睁眼看世界先驱。',
      famousQuote: '师夷长技以制夷。',
      historicalFate: '咸丰七年病殁杭州',
      fateHint: 'peacefulDeath'
    },

    ruanyuan: {
      id: 'ruanyuan', name: '阮元', zi: '伯元',
      birthYear: 1764, deathYear: 1849, alternateNames: ['芸台','文达'],
      era: '乾嘉道', dynasty: '清', role: 'scholar',
      title: '太傅·体仁阁大学士', officialTitle: '体仁阁大学士',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 95,
                    charisma: 85, integrity: 92, benevolence: 85,
                    diplomacy: 78, scholarship: 100, finance: 80, cunning: 78 },
      loyalty: 92, ambition: 75,
      traits: ['scholarly','rigorous','sage','reformist'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '仪征人·乾嘉学派后期领袖·总督两广五年·禁鸦片之先驱·主修《十三经注疏校勘记》。',
      famousQuote: '学者要有规矩方圆。',
      historicalFate: '道光二十九年寿终',
      fateHint: 'peacefulDeath'
    },

    caiE: {
      id: 'caiE', name: '蔡锷', zi: '松坡',
      birthYear: 1882, deathYear: 1916, alternateNames: ['艮寅'],
      era: '清末民初', dynasty: '清', role: 'military',
      title: '将军', officialTitle: '云南都督·四川督军',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 85, military: 92, intelligence: 92,
                    charisma: 92, integrity: 95, benevolence: 80,
                    diplomacy: 75, scholarship: 92, finance: 70, cunning: 80 },
      loyalty: 95, ambition: 80,
      traits: ['brilliant','heroic','rigorous','idealist'],
      resources: {
        privateWealth: { money: 200000, land: 1000, treasure: 100000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 95,
      background: '湖南邵阳人·梁启超弟子·辛亥昆明起义·护国战争首举义旗·讨袁护国·因病早殁。',
      famousQuote: '为将之道·先治心。',
      historicalFate: '民国五年赴日治病·死于福冈·年三十四',
      fateHint: 'martyrdom'
    },

    caiYuanpei: {
      id: 'caiYuanpei', name: '蔡元培', zi: '鹤卿',
      birthYear: 1868, deathYear: 1940, alternateNames: ['孑民','子民'],
      era: '清末民国', dynasty: '清', role: 'scholar',
      title: '北大校长', officialTitle: '中央研究院院长',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 25, intelligence: 95,
                    charisma: 92, integrity: 95, benevolence: 92,
                    diplomacy: 75, scholarship: 100, finance: 65, cunning: 65 },
      loyalty: 88, ambition: 75,
      traits: ['scholarly','sage','idealist','benevolent'],
      resources: {
        privateWealth: { money: 200000, land: 500, treasure: 50000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 98,
      background: '绍兴人·光绪进士·改革北大·兼容并包·中央研究院首任院长·中国现代教育之父。',
      famousQuote: '思想自由·兼容并包。',
      historicalFate: '民国二十九年病殁香港',
      fateHint: 'peacefulDeath'
    },

    huangXing: {
      id: 'huangXing', name: '黄兴', zi: '克强',
      birthYear: 1874, deathYear: 1916, alternateNames: ['廑午','庆午'],
      era: '清末民初', dynasty: '清', role: 'reformer',
      title: '陆军总长', officialTitle: '南京留守',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 78, military: 88, intelligence: 88,
                    charisma: 92, integrity: 92, benevolence: 88,
                    diplomacy: 75, scholarship: 88, finance: 65, cunning: 80 },
      loyalty: 88, ambition: 80,
      traits: ['heroic','brave','idealist','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 500, treasure: 50000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 920, virtueStage: 6
      },
      integrity: 92,
      background: '湖南善化人·与孙中山并称孙黄·华兴会·黄花岗起义·武昌战时总司令·辛亥革命第一功臣。',
      famousQuote: '革命非有不死之心·不能成功。',
      historicalFate: '民国五年劳累过度病殁上海',
      fateHint: 'peacefulDeath'
    },

    qiuying: {
      id: 'qiuying', name: '仇英', zi: '实父',
      birthYear: 1494, deathYear: 1552, alternateNames: ['十洲'],
      era: '嘉靖', dynasty: '明', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 30, military: 20, intelligence: 88,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 45, scholarship: 100, finance: 65, cunning: 60 },
      loyalty: 70, ambition: 30,
      traits: ['literary','reclusive','rigorous','sage'],
      resources: {
        privateWealth: { money: 100000, land: 500, treasure: 80000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '江苏太仓人·明四家之一·漆工出身·从周臣学画·设色绝精·清明上河图重摹本传世。',
      famousQuote: '设色之难·难于得真。',
      historicalFate: '嘉靖三十一年病殁',
      fateHint: 'peacefulDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-11] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
