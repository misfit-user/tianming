// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-02.js
// Domain: NPC / 历史人物 data
// 来源·波 2·春秋战国-清·名相名将名儒
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
    suqin: {
      id: 'suqin', name: '苏秦', zi: '季子',
      birthYear: -337, deathYear: -284, alternateNames: ['武安君'],
      era: '战国', dynasty: '燕', role: 'scholar',
      title: '武安君', officialTitle: '六国相印',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 60, intelligence: 95,
                    charisma: 95, integrity: 60, benevolence: 55,
                    diplomacy: 100, scholarship: 88, finance: 70, cunning: 92 },
      loyalty: 70, ambition: 90,
      traits: ['brilliant','clever','literary','ambitious'],
      resources: {
        privateWealth: { money: 800000, land: 5000, treasure: 1500000, slaves: 100, commerce: 0 },
        hiddenWealth: 200000, fame: 75, virtueMerit: 500, virtueStage: 4
      },
      integrity: 60,
      background: '雒阳人·鬼谷子弟子·合纵六国抗秦·身佩六国相印·战国纵横家代表。',
      famousQuote: '锥刺股，悬梁夜读。',
      historicalFate: '齐闵王七年被刺客车裂于齐',
      fateHint: 'execution'
    },

    zhangyi: {
      id: 'zhangyi', name: '张仪', zi: '',
      birthYear: -373, deathYear: -310, alternateNames: ['武信君'],
      era: '战国', dynasty: '秦', role: 'scholar',
      title: '武信君', officialTitle: '秦相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 60, intelligence: 95,
                    charisma: 92, integrity: 50, benevolence: 50,
                    diplomacy: 100, scholarship: 88, finance: 75, cunning: 95 },
      loyalty: 80, ambition: 85,
      traits: ['brilliant','scheming','clever','literary'],
      resources: {
        privateWealth: { money: 1000000, land: 10000, treasure: 2000000, slaves: 300, commerce: 0 },
        hiddenWealth: 200000, fame: 70, virtueMerit: 450, virtueStage: 4
      },
      integrity: 55,
      background: '魏国安邑人·鬼谷子弟子·连横破苏秦合纵·欺楚怀王·秦相·开秦统一外交格局。',
      famousQuote: '舌在尚可。',
      historicalFate: '秦武王元年免相奔魏·一年而殁',
      fateHint: 'exileDeath'
    },

    xinlingjun: {
      id: 'xinlingjun', name: '魏无忌', zi: '',
      birthYear: -276, deathYear: -243, alternateNames: ['信陵君','魏公子'],
      era: '战国', dynasty: '魏', role: 'loyal',
      title: '信陵君', officialTitle: '上将军',
      rankLevel: 28, socialClass: 'noble', department: 'military',
      abilities: { governance: 78, military: 88, intelligence: 92,
                    charisma: 95, integrity: 88, benevolence: 92,
                    diplomacy: 90, scholarship: 80, finance: 70, cunning: 80 },
      loyalty: 95, ambition: 70,
      traits: ['benevolent','heroic','brave','scholarly'],
      resources: {
        privateWealth: { money: 2000000, land: 50000, treasure: 5000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 90,
      background: '魏昭王少子·窃符救赵·礼贤下士门客三千·五国攻秦·战国四公子之首。',
      famousQuote: '能忍能让。',
      historicalFate: '魏安釐王三十四年酒色而死',
      fateHint: 'peacefulDeath'
    },

    jingke: {
      id: 'jingke', name: '荆轲', zi: '',
      birthYear: -250, deathYear: -227, alternateNames: ['庆卿'],
      era: '战国末', dynasty: '燕', role: 'loyal',
      title: '上卿', officialTitle: '刺客',
      rankLevel: 18, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 80, intelligence: 80,
                    charisma: 78, integrity: 95, benevolence: 70,
                    diplomacy: 65, scholarship: 75, finance: 50, cunning: 75 },
      loyalty: 100, ambition: 75,
      traits: ['brave','loyal','heroic','literary'],
      resources: {
        privateWealth: { money: 50000, land: 0, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 750, virtueStage: 5
      },
      integrity: 95,
      background: '卫国人·田光荐于燕太子丹·图穷匕首见·刺秦未果被杀·风萧萧兮易水寒。',
      famousQuote: '风萧萧兮易水寒，壮士一去兮不复还。',
      historicalFate: '秦王政二十年咸阳殿被斩',
      fateHint: 'martyrdom'
    },

    xiangyu: {
      id: 'xiangyu', name: '项羽', zi: '羽',
      birthYear: -232, deathYear: -202, alternateNames: ['项籍','西楚霸王'],
      era: '秦末', dynasty: '楚', role: 'usurper',
      title: '西楚霸王', officialTitle: '霸王',
      rankLevel: 30, socialClass: 'noble', department: 'military',
      abilities: { governance: 60, military: 100, intelligence: 75,
                    charisma: 90, integrity: 80, benevolence: 65,
                    diplomacy: 50, scholarship: 60, finance: 55, cunning: 60 },
      loyalty: 60, ambition: 100,
      traits: ['brave','heroic','proud','ruthless'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 20000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '下相人·力能扛鼎·破釜沉舟·巨鹿大破秦·鸿门设宴·楚汉相争·乌江自刎。',
      famousQuote: '力拔山兮气盖世。',
      historicalFate: '汉五年乌江自刎·年仅三十一',
      fateHint: 'martyrdom'
    },

    liubang: {
      id: 'liubang', name: '刘邦', zi: '季',
      birthYear: -256, deathYear: -195, alternateNames: ['汉高祖','汉太祖'],
      era: '秦末汉初', dynasty: '西汉', role: 'usurper',
      title: '汉高皇帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 80, intelligence: 92,
                    charisma: 95, integrity: 65, benevolence: 80,
                    diplomacy: 92, scholarship: 60, finance: 75, cunning: 95 },
      loyalty: 50, ambition: 100,
      traits: ['brilliant','clever','humble_origin','patient'],
      resources: {
        privateWealth: { money: 100000000, land: 5000000, treasure: 500000000, slaves: 100000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 70,
      background: '沛县丰邑人·泗水亭长·斩白蛇起义·与项羽五年争天下·开汉四百年。',
      famousQuote: '大风起兮云飞扬，安得猛士兮守四方。',
      historicalFate: '汉高祖十二年崩于长乐宫',
      fateHint: 'peacefulDeath'
    },

    fanKuai: {
      id: 'fanKuai', name: '樊哙', zi: '',
      birthYear: -242, deathYear: -189, alternateNames: ['舞阳侯'],
      era: '秦末汉初', dynasty: '西汉', role: 'military',
      title: '舞阳侯', officialTitle: '左丞相·大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 50, military: 92, intelligence: 70,
                    charisma: 78, integrity: 80, benevolence: 65,
                    diplomacy: 50, scholarship: 35, finance: 50, cunning: 60 },
      loyalty: 95, ambition: 65,
      traits: ['brave','loyal','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 82,
      background: '沛县人·屠狗为业·吕雉妹夫·鸿门救主·从平定诸侯。',
      famousQuote: '臣愿入·与之同命。',
      historicalFate: '汉惠帝六年病殁',
      fateHint: 'peacefulDeath'
    },

    zhoubo: {
      id: 'zhoubo', name: '周勃', zi: '',
      birthYear: -240, deathYear: -169, alternateNames: ['绛侯','武'],
      era: '秦末-文帝', dynasty: '西汉', role: 'military',
      title: '绛侯', officialTitle: '太尉·右丞相',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 75, military: 88, intelligence: 80,
                    charisma: 75, integrity: 80, benevolence: 70,
                    diplomacy: 70, scholarship: 50, finance: 60, cunning: 78 },
      loyalty: 95, ambition: 60,
      traits: ['brave','loyal','rigorous','humble_origin'],
      resources: {
        privateWealth: { money: 500000, land: 15000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 85,
      background: '沛县人·从高祖起兵·吕后死后联陈平诛诸吕·迎立文帝·安刘氏天下。',
      famousQuote: '安刘氏者必勃也。',
      historicalFate: '文帝十一年病殁',
      fateHint: 'peacefulDeath'
    },

    chaocuo: {
      id: 'chaocuo', name: '晁错', zi: '',
      birthYear: -200, deathYear: -154, alternateNames: ['晁大夫'],
      era: '文景', dynasty: '西汉', role: 'reformer',
      title: '御史大夫', officialTitle: '御史大夫',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 95,
                    charisma: 70, integrity: 88, benevolence: 70,
                    diplomacy: 50, scholarship: 95, finance: 88, cunning: 75 },
      loyalty: 95, ambition: 75,
      traits: ['rigorous','reformist','idealist','scholarly'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 650, virtueStage: 5
      },
      integrity: 90,
      background: '颍川人·主父削藩策·开七国之乱·景帝腰斩晁错于东市以解兵祸。',
      famousQuote: '安天下，欲计久远。',
      historicalFate: '景帝前三年腰斩东市',
      fateHint: 'executionByFraming'
    },

    simaQian: {
      id: 'simaQian', name: '司马迁', zi: '子长',
      birthYear: -145, deathYear: -86, alternateNames: ['太史公','史迁'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '中书令', officialTitle: '太史令',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 30, intelligence: 95,
                    charisma: 70, integrity: 92, benevolence: 78,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 88, ambition: 70,
      traits: ['scholarly','literary','rigorous','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 95,
      background: '夏阳龙门人·继父业为太史令·为李陵辩遭宫刑·忍辱撰《史记》一百三十篇。',
      famousQuote: '人固有一死，或重于泰山，或轻于鸿毛。',
      historicalFate: '武帝晚年莫知所终',
      fateHint: 'retirement'
    },

    suwu: {
      id: 'suwu', name: '苏武', zi: '子卿',
      birthYear: -140, deathYear: -60, alternateNames: ['关内侯','典属国'],
      era: '武昭宣朝', dynasty: '西汉', role: 'loyal',
      title: '关内侯', officialTitle: '典属国',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 60, intelligence: 80,
                    charisma: 78, integrity: 100, benevolence: 80,
                    diplomacy: 92, scholarship: 78, finance: 50, cunning: 60 },
      loyalty: 100, ambition: 50,
      traits: ['loyal','heroic','patient','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '杜陵人·使匈奴被扣留·北海牧羊十九年·渴饮雪饥吞毡·节杖毛尽不屈。',
      famousQuote: '大汉天子，吾敢叛之。',
      historicalFate: '宣帝神爵二年病殁·年八十',
      fateHint: 'peacefulDeath'
    },

    zhangZhongjing: {
      id: 'zhangZhongjing', name: '张机', zi: '仲景',
      birthYear: 150, deathYear: 219, alternateNames: ['医圣','张长沙'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '长沙太守', officialTitle: '太守',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 65, military: 30, intelligence: 95,
                    charisma: 78, integrity: 95, benevolence: 100,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 50 },
      loyalty: 80, ambition: 40,
      traits: ['scholarly','benevolent','sage','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '南阳涅阳人·撰《伤寒杂病论》·辨证施治·中医方剂学之祖·医圣。',
      famousQuote: '勤求古训，博采众方。',
      historicalFate: '建安末病殁',
      fateHint: 'peacefulDeath'
    },

    huatuo: {
      id: 'huatuo', name: '华佗', zi: '元化',
      birthYear: 145, deathYear: 208, alternateNames: ['敷'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '', officialTitle: '游医',
      rankLevel: 5, socialClass: 'commoner', department: '',
      abilities: { governance: 30, military: 20, intelligence: 95,
                    charisma: 75, integrity: 88, benevolence: 95,
                    diplomacy: 50, scholarship: 100, finance: 40, cunning: 60 },
      loyalty: 70, ambition: 30,
      traits: ['scholarly','benevolent','sage','reclusive'],
      resources: {
        privateWealth: { money: 10000, land: 200, treasure: 3000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 90,
      background: '沛国谯人·中国外科鼻祖·麻沸散·五禽戏·拒为曹操治脑而下狱。',
      famousQuote: '人体欲得劳动，但不当使极尔。',
      historicalFate: '建安十三年被曹操所杀',
      fateHint: 'execution'
    },

    sunquan: {
      id: 'sunquan', name: '孙权', zi: '仲谋',
      birthYear: 182, deathYear: 252, alternateNames: ['吴大帝','长沙桓王'],
      era: '三国', dynasty: '东吴', role: 'usurper',
      title: '吴大帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 75, intelligence: 92,
                    charisma: 90, integrity: 70, benevolence: 75,
                    diplomacy: 95, scholarship: 80, finance: 80, cunning: 92 },
      loyalty: 75, ambition: 90,
      traits: ['brilliant','patient','clever','heroic'],
      resources: {
        privateWealth: { money: 50000000, land: 1500000, treasure: 100000000, slaves: 50000, commerce: 5000000 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 78,
      background: '富春人·继父兄之业据江东·赤壁联刘破曹·夷陵破蜀·三国分立之主。',
      famousQuote: '生子当如孙仲谋。',
      historicalFate: '神凤元年崩',
      fateHint: 'peacefulDeath'
    },

    lvbu: {
      id: 'lvbu', name: '吕布', zi: '奉先',
      birthYear: 161, deathYear: 199, alternateNames: ['温侯','人中吕布'],
      era: '汉末', dynasty: '东汉', role: 'usurper',
      title: '温侯', officialTitle: '徐州刺史',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 40, military: 100, intelligence: 60,
                    charisma: 80, integrity: 25, benevolence: 40,
                    diplomacy: 40, scholarship: 30, finance: 40, cunning: 60 },
      loyalty: 20, ambition: 90,
      traits: ['brave','greedy','ruthless','arrogant'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 65, virtueMerit: 200, virtueStage: 2
      },
      integrity: 25,
      background: '九原人·人中吕布马中赤兔·三姓家奴·先后杀丁原董卓·反复无常·下邳被擒。',
      famousQuote: '大耳贼，最叵信者。',
      historicalFate: '建安三年下邳被曹操缢杀',
      fateHint: 'execution'
    },

    dongzhuo: {
      id: 'dongzhuo', name: '董卓', zi: '仲颖',
      birthYear: 138, deathYear: 192, alternateNames: ['太师'],
      era: '汉末', dynasty: '东汉', role: 'usurper',
      title: '郿侯·太师', officialTitle: '相国',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 50, military: 85, intelligence: 70,
                    charisma: 65, integrity: 15, benevolence: 15,
                    diplomacy: 50, scholarship: 40, finance: 60, cunning: 80 },
      loyalty: 20, ambition: 95,
      traits: ['ruthless','greedy','brave','vain'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 30000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 5000000, fame: -85, virtueMerit: 50, virtueStage: 1
      },
      integrity: 15,
      background: '陇西临洮人·西凉军阀·入洛废少帝立献帝·建郿坞屯粟·暴虐天怒人怨。',
      famousQuote: '',
      historicalFate: '初平三年王允貂蝉离间·吕布所杀·尸体点天灯',
      fateHint: 'execution'
    },

    jiangwei: {
      id: 'jiangwei', name: '姜维', zi: '伯约',
      birthYear: 202, deathYear: 264, alternateNames: ['天水麒麟儿'],
      era: '蜀汉末', dynasty: '蜀汉', role: 'military',
      title: '平襄侯', officialTitle: '大将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 90, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 75,
                    diplomacy: 65, scholarship: 88, finance: 60, cunning: 88 },
      loyalty: 95, ambition: 75,
      traits: ['brilliant','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 100000, land: 1000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '天水冀县人·诸葛亮收徒·继其志九伐中原·蜀亡后诈降钟会图复·事败被杀。',
      famousQuote: '臣等正欲死战，陛下何故先降。',
      historicalFate: '魏咸熙元年成都之乱被乱兵所杀',
      fateHint: 'martyrdom'
    },

    wangXizhi: {
      id: 'wangXizhi', name: '王羲之', zi: '逸少',
      birthYear: 303, deathYear: 361, alternateNames: ['书圣','王右军'],
      era: '东晋', dynasty: '东晋', role: 'scholar',
      title: '右军将军', officialTitle: '会稽内史',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 65, military: 50, intelligence: 90,
                    charisma: 85, integrity: 88, benevolence: 75,
                    diplomacy: 60, scholarship: 100, finance: 60, cunning: 50 },
      loyalty: 80, ambition: 40,
      traits: ['scholarly','literary','sage','luxurious'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 850, virtueStage: 6
      },
      integrity: 90,
      background: '琅琊临沂人·琅琊王氏·兰亭集序·中国书圣·七子皆能书。',
      famousQuote: '群贤毕至，少长咸集。',
      historicalFate: '升平五年病殁',
      fateHint: 'peacefulDeath'
    },

    liuyu: {
      id: 'liuyu', name: '刘裕', zi: '德舆',
      birthYear: 363, deathYear: 422, alternateNames: ['宋武帝','寄奴'],
      era: '南朝初', dynasty: '南朝宋', role: 'usurper',
      title: '宋武皇帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 95, intelligence: 90,
                    charisma: 88, integrity: 75, benevolence: 78,
                    diplomacy: 80, scholarship: 60, finance: 78, cunning: 88 },
      loyalty: 60, ambition: 100,
      traits: ['brilliant','brave','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 700, virtueStage: 5
      },
      integrity: 78,
      background: '彭城人·寄奴出身·北府兵·灭桓玄·北伐灭南燕后秦·篡晋立宋。',
      famousQuote: '气吞万里如虎。',
      historicalFate: '永初三年崩',
      fateHint: 'peacefulDeath'
    },

    wangdao: {
      id: 'wangdao', name: '王导', zi: '茂弘',
      birthYear: 276, deathYear: 339, alternateNames: ['始兴文献公','江左管夷吾'],
      era: '东晋初', dynasty: '东晋', role: 'regent',
      title: '始兴郡公', officialTitle: '丞相·太傅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 60, intelligence: 92,
                    charisma: 95, integrity: 88, benevolence: 88,
                    diplomacy: 95, scholarship: 88, finance: 75, cunning: 88 },
      loyalty: 92, ambition: 65,
      traits: ['brilliant','patient','sage','clever'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 3000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 88,
      background: '琅琊临沂人·琅琊王氏·辅司马睿渡江立东晋·王与马共天下·辅三朝。',
      famousQuote: '当共戮力王室，克复神州。',
      historicalFate: '咸康五年病殁',
      fateHint: 'peacefulDeath'
    },

    lijing: {
      id: 'lijing', name: '李靖', zi: '药师',
      birthYear: 571, deathYear: 649, alternateNames: ['卫国景武公'],
      era: '初唐', dynasty: '唐', role: 'military',
      title: '卫国公', officialTitle: '尚书右仆射',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 85, military: 100, intelligence: 95,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 80, scholarship: 90, finance: 70, cunning: 92 },
      loyalty: 95, ambition: 65,
      traits: ['brilliant','brave','rigorous','sage'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 920, virtueStage: 6
      },
      integrity: 92,
      background: '雍州三原人·开唐第一将·灭东突厥擒颉利可汗·破吐谷浑·撰《李卫公问对》。',
      famousQuote: '兵不厌诈。',
      historicalFate: '贞观二十三年病殁',
      fateHint: 'peacefulDeath'
    },

    qinqiong: {
      id: 'qinqiong', name: '秦琼', zi: '叔宝',
      birthYear: 575, deathYear: 638, alternateNames: ['翼国公','胡国公'],
      era: '初唐', dynasty: '唐', role: 'military',
      title: '胡国公', officialTitle: '左武卫大将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 78,
                    charisma: 85, integrity: 88, benevolence: 75,
                    diplomacy: 60, scholarship: 50, finance: 55, cunning: 70 },
      loyalty: 95, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '齐州历城人·初仕来护儿·后归李渊·凌烟阁二十四功臣末位·门神之一。',
      famousQuote: '',
      historicalFate: '贞观十二年病殁',
      fateHint: 'peacefulDeath'
    },

    yuchiJingde: {
      id: 'yuchiJingde', name: '尉迟敬德', zi: '',
      birthYear: 585, deathYear: 658, alternateNames: ['鄂国公','尉迟恭'],
      era: '初唐', dynasty: '唐', role: 'military',
      title: '鄂国公', officialTitle: '右武候大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 50, military: 95, intelligence: 70,
                    charisma: 80, integrity: 85, benevolence: 70,
                    diplomacy: 50, scholarship: 40, finance: 50, cunning: 65 },
      loyalty: 100, ambition: 60,
      traits: ['brave','loyal','heroic','proud'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '朔州善阳人·原刘武周部·归李世民·玄武门之变射杀齐王·门神之一。',
      famousQuote: '',
      historicalFate: '显庆三年病殁',
      fateHint: 'peacefulDeath'
    },

    xueRengui: {
      id: 'xueRengui', name: '薛仁贵', zi: '',
      birthYear: 614, deathYear: 683, alternateNames: ['平阳郡公'],
      era: '太宗高宗朝', dynasty: '唐', role: 'military',
      title: '平阳郡公', officialTitle: '右领军卫将军',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 95, intelligence: 78,
                    charisma: 80, integrity: 85, benevolence: 70,
                    diplomacy: 55, scholarship: 50, finance: 55, cunning: 75 },
      loyalty: 90, ambition: 65,
      traits: ['brave','heroic','rigorous','humble_origin'],
      resources: {
        privateWealth: { money: 400000, land: 8000, treasure: 600000, slaves: 150, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '绛州龙门人·三箭定天山·脱帽退万敌·征高句丽·镇守朔方。',
      famousQuote: '',
      historicalFate: '永淳二年病殁',
      fateHint: 'peacefulDeath'
    },

    wuZetian: {
      id: 'wuZetian', name: '武则天', zi: '',
      birthYear: 624, deathYear: 705, alternateNames: ['武曌','则天大圣皇帝'],
      era: '高宗武周', dynasty: '武周', role: 'usurper',
      title: '则天大圣皇帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 95, military: 75, intelligence: 100,
                    charisma: 92, integrity: 50, benevolence: 60,
                    diplomacy: 90, scholarship: 92, finance: 80, cunning: 100 },
      loyalty: 30, ambition: 100,
      traits: ['brilliant','ruthless','scheming','ambitious'],
      resources: {
        privateWealth: { money: 80000000, land: 3000000, treasure: 200000000, slaves: 80000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 600, virtueStage: 5
      },
      integrity: 55,
      background: '并州文水人·太宗才人·高宗皇后·废子立周·中国唯一女皇帝·开元前奠基。',
      famousQuote: '内举不避亲，外举不避仇。',
      historicalFate: '神龙元年退位·当年病殁',
      fateHint: 'peacefulDeath'
    },

    anLushan: {
      id: 'anLushan', name: '安禄山', zi: '',
      birthYear: 703, deathYear: 757, alternateNames: ['轧荦山','大燕雄武皇帝'],
      era: '玄宗朝', dynasty: '唐', role: 'usurper',
      title: '东平郡王·大燕皇帝', officialTitle: '范阳节度使',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 88, intelligence: 78,
                    charisma: 88, integrity: 25, benevolence: 30,
                    diplomacy: 75, scholarship: 50, finance: 70, cunning: 92 },
      loyalty: 15, ambition: 100,
      traits: ['scheming','greedy','ruthless','clever'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 30000000, slaves: 8000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -90, virtueMerit: 50, virtueStage: 1
      },
      integrity: 25,
      background: '营州柳城胡人·玄宗杨贵妃宠·身兼三镇节度使·天宝十四年起兵·开盛唐转衰。',
      famousQuote: '',
      historicalFate: '至德二年被亲子安庆绪所杀',
      fateHint: 'forcedDeath'
    },

    zhangJiuling: {
      id: 'zhangJiuling', name: '张九龄', zi: '子寿',
      birthYear: 678, deathYear: 740, alternateNames: ['始兴伯','文献'],
      era: '开元', dynasty: '唐', role: 'scholar',
      title: '始兴伯', officialTitle: '中书令',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 90, military: 50, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 85,
                    diplomacy: 80, scholarship: 100, finance: 75, cunning: 78 },
      loyalty: 92, ambition: 60,
      traits: ['scholarly','literary','upright','reformist'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '韶州曲江人·开元盛世末相·谏玄宗早察安禄山有反相·罢相而玄宗终悔之。',
      famousQuote: '海上生明月，天涯共此时。',
      historicalFate: '开元二十八年病殁',
      fateHint: 'peacefulDeath'
    },

    libai: {
      id: 'libai', name: '李白', zi: '太白',
      birthYear: 701, deathYear: 762, alternateNames: ['青莲居士','谪仙人','诗仙'],
      era: '玄肃朝', dynasty: '唐', role: 'scholar',
      title: '翰林供奉', officialTitle: '翰林供奉',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 30, intelligence: 95,
                    charisma: 95, integrity: 85, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 30, cunning: 50 },
      loyalty: 70, ambition: 75,
      traits: ['literary','luxurious','heroic','reclusive'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 900, virtueStage: 6
      },
      integrity: 88,
      background: '陇西成纪人·诗仙·斗酒诗百篇·力士脱靴·永王璘事件流夜郎·终于当涂。',
      famousQuote: '天生我材必有用，千金散尽还复来。',
      historicalFate: '宝应元年病殁当涂·李阳冰治丧',
      fateHint: 'peacefulDeath'
    },

    dufu: {
      id: 'dufu', name: '杜甫', zi: '子美',
      birthYear: 712, deathYear: 770, alternateNames: ['少陵野老','杜工部','诗圣'],
      era: '玄肃代朝', dynasty: '唐', role: 'scholar',
      title: '检校工部员外郎', officialTitle: '左拾遗',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 60, military: 30, intelligence: 92,
                    charisma: 75, integrity: 95, benevolence: 95,
                    diplomacy: 50, scholarship: 100, finance: 35, cunning: 50 },
      loyalty: 95, ambition: 60,
      traits: ['literary','benevolent','idealist','scholarly'],
      resources: {
        privateWealth: { money: 5000, land: 50, treasure: 1000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 950, virtueStage: 6
      },
      integrity: 98,
      background: '巩县人·诗圣·安史亲历·三吏三别·茅屋为秋风所破·贫病漂泊。',
      famousQuote: '安得广厦千万间，大庇天下寒士俱欢颜。',
      historicalFate: '大历五年贫病殁于湘江舟中',
      fateHint: 'exileDeath'
    },

    licezong: {
      id: 'licezong', name: '李煜', zi: '重光',
      birthYear: 937, deathYear: 978, alternateNames: ['南唐后主','钟隐','莲峰居士'],
      era: '五代南唐', dynasty: '南唐', role: 'scholar',
      title: '南唐国主', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 50, military: 30, intelligence: 88,
                    charisma: 90, integrity: 75, benevolence: 80,
                    diplomacy: 65, scholarship: 100, finance: 60, cunning: 50 },
      loyalty: 50, ambition: 30,
      traits: ['literary','luxurious','idealist','reclusive'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 30000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 700, virtueStage: 5
      },
      integrity: 80,
      background: '徐州人·南唐第三主·亡国之君·词宗·宋灭南唐后被俘汴京·七夕生日饮鸩而亡。',
      famousQuote: '问君能有几多愁，恰似一江春水向东流。',
      historicalFate: '太平兴国三年七夕被宋太宗赐牵机药毒死',
      fateHint: 'forcedDeath'
    },

    caijing: {
      id: 'caijing', name: '蔡京', zi: '元长',
      birthYear: 1047, deathYear: 1126, alternateNames: ['鲁国公'],
      era: '徽宗朝', dynasty: '北宋', role: 'corrupt',
      title: '太师·鲁国公', officialTitle: '太师·尚书左仆射',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 92,
                    charisma: 80, integrity: 15, benevolence: 25,
                    diplomacy: 88, scholarship: 95, finance: 75, cunning: 95 },
      loyalty: 30, ambition: 95,
      traits: ['scheming','flatterer','greedy','literary'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 30000000, slaves: 3000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -85, virtueMerit: 100, virtueStage: 2
      },
      integrity: 18,
      background: '兴化仙游人·四度入相·六贼之首·改盐法茶法·徽宗奢靡·北宋亡之祸首。',
      famousQuote: '丰亨豫大。',
      historicalFate: '靖康元年贬岭南·途中饿死潭州',
      fateHint: 'exileDeath'
    },

    hanShizhong: {
      id: 'hanShizhong', name: '韩世忠', zi: '良臣',
      birthYear: 1090, deathYear: 1151, alternateNames: ['咸安郡王','清凉居士','忠武'],
      era: '南宋初', dynasty: '南宋', role: 'military',
      title: '咸安郡王', officialTitle: '太傅·节度使',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 95, intelligence: 85,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 60, finance: 65, cunning: 80 },
      loyalty: 100, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '延安人·黄天荡梁红玉击鼓退金兵·岳飞死后唯一敢质秦桧者·愤而辞官。',
      famousQuote: '相公·岳飞何罪？莫须有三字何以服天下！',
      historicalFate: '绍兴二十一年病殁',
      fateHint: 'retirement'
    },

    xinQiji: {
      id: 'xinQiji', name: '辛弃疾', zi: '幼安',
      birthYear: 1140, deathYear: 1207, alternateNames: ['稼轩','忠敏'],
      era: '南宋', dynasty: '南宋', role: 'military',
      title: '龙图阁待制', officialTitle: '湖南安抚使',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 85, military: 88, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 80,
                    diplomacy: 70, scholarship: 100, finance: 75, cunning: 80 },
      loyalty: 95, ambition: 78,
      traits: ['literary','heroic','brave','reformist'],
      resources: {
        privateWealth: { money: 300000, land: 8000, treasure: 300000, slaves: 80, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 900, virtueStage: 6
      },
      integrity: 90,
      background: '济南历城人·二十二岁率军南归·豪放词宗·壮志难酬·一生郁郁。',
      famousQuote: '醉里挑灯看剑，梦回吹角连营。',
      historicalFate: '开禧三年病殁铅山',
      fateHint: 'peacefulDeath'
    },

    luyou: {
      id: 'luyou', name: '陆游', zi: '务观',
      birthYear: 1125, deathYear: 1210, alternateNames: ['放翁'],
      era: '南宋', dynasty: '南宋', role: 'scholar',
      title: '宝章阁待制', officialTitle: '礼部郎中',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 50, intelligence: 88,
                    charisma: 80, integrity: 92, benevolence: 88,
                    diplomacy: 55, scholarship: 100, finance: 60, cunning: 55 },
      loyalty: 95, ambition: 60,
      traits: ['literary','idealist','heroic','scholarly'],
      resources: {
        privateWealth: { money: 80000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '越州山阴人·爱国诗人·一生主战·释放翁·诗存九千余首·示儿绝笔。',
      famousQuote: '王师北定中原日，家祭无忘告乃翁。',
      historicalFate: '嘉定二年病殁山阴·年八十五',
      fateHint: 'peacefulDeath'
    },

    yelvChucai: {
      id: 'yelvChucai', name: '耶律楚材', zi: '晋卿',
      birthYear: 1190, deathYear: 1244, alternateNames: ['玉泉老人','文正'],
      era: '蒙元初', dynasty: '元', role: 'reformer',
      title: '广宁王', officialTitle: '中书令',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 60, intelligence: 95,
                    charisma: 85, integrity: 92, benevolence: 92,
                    diplomacy: 88, scholarship: 95, finance: 88, cunning: 80 },
      loyalty: 88, ambition: 65,
      traits: ['scholarly','benevolent','reformist','sage'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '辽东丹王后裔·辅成吉思汗、窝阔台·劝阻屠汉地·定赋税·汉化奠基。',
      famousQuote: '兴一利不如除一害。',
      historicalFate: '乃马真后三年病殁·遗物仅琴书。',
      fateHint: 'peacefulDeath'
    },

    xudaTang: {
      id: 'xudaTang', name: '徐达', zi: '天德',
      birthYear: 1332, deathYear: 1385, alternateNames: ['中山武宁王'],
      era: '明初', dynasty: '明', role: 'military',
      title: '中山王', officialTitle: '右丞相·魏国公',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 85, military: 98, intelligence: 92,
                    charisma: 88, integrity: 95, benevolence: 85,
                    diplomacy: 80, scholarship: 70, finance: 75, cunning: 88 },
      loyalty: 100, ambition: 65,
      traits: ['brilliant','loyal','rigorous','heroic'],
      resources: {
        privateWealth: { money: 1500000, land: 50000, treasure: 3000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 95,
      background: '濠州钟离人·朱元璋发小·北伐元都·明开国第一功臣·谨慎自守得善终。',
      famousQuote: '为将之道·廉、勇、智。',
      historicalFate: '洪武十八年病殁·一说蒸鹅毒杀',
      fateHint: 'peacefulDeath'
    },

    changYuchun: {
      id: 'changYuchun', name: '常遇春', zi: '伯仁',
      birthYear: 1330, deathYear: 1369, alternateNames: ['开平王','常十万'],
      era: '明初', dynasty: '明', role: 'military',
      title: '开平王', officialTitle: '中书平章·副将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 98, intelligence: 80,
                    charisma: 85, integrity: 88, benevolence: 60,
                    diplomacy: 60, scholarship: 50, finance: 60, cunning: 75 },
      loyalty: 95, ambition: 70,
      traits: ['brave','heroic','ruthless','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '安徽怀远人·常十万自夸·勇冠三军·北伐途中暴卒柳河川·年仅四十。',
      famousQuote: '吾领十万众·横行天下。',
      historicalFate: '洪武二年北伐途中暴卒柳河川',
      fateHint: 'peacefulDeath'
    },

    huWeiyong: {
      id: 'huWeiyong', name: '胡惟庸', zi: '',
      birthYear: 1320, deathYear: 1380, alternateNames: [],
      era: '洪武', dynasty: '明', role: 'corrupt',
      title: '韩国公', officialTitle: '中书省左丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 40, intelligence: 88,
                    charisma: 70, integrity: 30, benevolence: 30,
                    diplomacy: 75, scholarship: 75, finance: 65, cunning: 92 },
      loyalty: 30, ambition: 95,
      traits: ['scheming','ambitious','flatterer','ruthless'],
      resources: {
        privateWealth: { money: 3000000, land: 80000, treasure: 8000000, slaves: 1500, commerce: 0 },
        hiddenWealth: 2000000, fame: -70, virtueMerit: 200, virtueStage: 2
      },
      integrity: 30,
      background: '濠州定远人·李善长荐·任丞相七年专权·胡党案株连三万·罢中书省废丞相制。',
      famousQuote: '',
      historicalFate: '洪武十三年以谋反诛·灭九族',
      fateHint: 'executionByClanDestruction'
    },

    yaoGuangxiao: {
      id: 'yaoGuangxiao', name: '姚广孝', zi: '斯道',
      birthYear: 1335, deathYear: 1418, alternateNames: ['道衍','黑衣宰相','独庵老人'],
      era: '洪武永乐', dynasty: '明', role: 'scholar',
      title: '太子少师', officialTitle: '资善大夫',
      rankLevel: 26, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 92, intelligence: 100,
                    charisma: 75, integrity: 60, benevolence: 60,
                    diplomacy: 80, scholarship: 95, finance: 70, cunning: 100 },
      loyalty: 90, ambition: 75,
      traits: ['brilliant','scheming','reclusive','sage'],
      resources: {
        privateWealth: { money: 50000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 70,
      background: '苏州长洲人·和尚出身·从燕王朱棣·靖难第一谋主·永乐朝总裁《永乐大典》。',
      famousQuote: '殿下若用贫僧·当奉一白帽与王。',
      historicalFate: '永乐十六年病殁',
      fateHint: 'peacefulDeath'
    },

    fangXiaoru: {
      id: 'fangXiaoru', name: '方孝孺', zi: '希直',
      birthYear: 1357, deathYear: 1402, alternateNames: ['正学先生','文正'],
      era: '建文', dynasty: '明', role: 'loyal',
      title: '翰林侍讲学士', officialTitle: '翰林侍读学士',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 90,
                    charisma: 78, integrity: 100, benevolence: 88,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 50 },
      loyalty: 100, ambition: 60,
      traits: ['loyal','scholarly','idealist','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '宁海人·宋濂弟子·建文朝主事·靖难后拒草登极诏·诛十族八百四十七人。',
      famousQuote: '便诛十族·又何如！',
      historicalFate: '永乐元年凌迟于市·诛十族',
      fateHint: 'executionByClanDestruction'
    },

    tangyin: {
      id: 'tangyin', name: '唐寅', zi: '伯虎',
      birthYear: 1470, deathYear: 1524, alternateNames: ['唐解元','六如居士','桃花庵主','子畏'],
      era: '弘治正德', dynasty: '明', role: 'scholar',
      title: '解元', officialTitle: '生员',
      rankLevel: 8, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 50, military: 25, intelligence: 92,
                    charisma: 92, integrity: 70, benevolence: 78,
                    diplomacy: 60, scholarship: 100, finance: 50, cunning: 65 },
      loyalty: 70, ambition: 50,
      traits: ['literary','luxurious','reclusive','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '苏州人·吴中四才子之首·弘治戊午乡试解元·因徐经科场案永禁科举·卖画为生。',
      famousQuote: '别人笑我太疯癫，我笑他人看不穿。',
      historicalFate: '嘉靖三年贫病而殁',
      fateHint: 'peacefulDeath'
    },

    yuanChonghuan: {
      id: 'yuanChonghuan', name: '袁崇焕', zi: '元素',
      birthYear: 1584, deathYear: 1630, alternateNames: ['自如'],
      era: '明末', dynasty: '明', role: 'military',
      title: '兵部尚书·蓟辽督师', officialTitle: '兵部尚书·督师',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 78, military: 92, intelligence: 88,
                    charisma: 75, integrity: 90, benevolence: 70,
                    diplomacy: 65, scholarship: 80, finance: 70, cunning: 78 },
      loyalty: 95, ambition: 80,
      traits: ['brave','heroic','rigorous','idealist'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 30000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '广东东莞人·宁远大捷炮伤努尔哈赤·宁锦大捷·五年复辽之约·中皇太极反间计。',
      famousQuote: '臣愿意为陛下复全辽。',
      historicalFate: '崇祯三年凌迟磔于西市·百姓争啖其肉',
      fateHint: 'executionByFraming'
    },

    sunChengzong: {
      id: 'sunChengzong', name: '孙承宗', zi: '稚绳',
      birthYear: 1563, deathYear: 1638, alternateNames: ['恺阳','文忠'],
      era: '天启崇祯', dynasty: '明', role: 'military',
      title: '太保·宁远伯', officialTitle: '兵部尚书·督师',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 88, military: 90, intelligence: 92,
                    charisma: 85, integrity: 95, benevolence: 80,
                    diplomacy: 75, scholarship: 90, finance: 80, cunning: 80 },
      loyalty: 100, ambition: 65,
      traits: ['brilliant','rigorous','loyal','heroic'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '保定高阳人·万历进士·辽东督师筑宁锦防线·荐袁崇焕·明末长城式人物。',
      famousQuote: '边臣不当持议和。',
      historicalFate: '崇祯十一年清军围高阳·率家人巷战·城破自缢',
      fateHint: 'martyrdom'
    },

    fanWencheng: {
      id: 'fanWencheng', name: '范文程', zi: '宪斗',
      birthYear: 1597, deathYear: 1666, alternateNames: ['辉岳','文肃'],
      era: '清初', dynasty: '清', role: 'reformer',
      title: '太傅·一等子', officialTitle: '内秘书院大学士',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 95,
                    charisma: 78, integrity: 80, benevolence: 75,
                    diplomacy: 88, scholarship: 92, finance: 80, cunning: 92 },
      loyalty: 88, ambition: 70,
      traits: ['brilliant','patient','scholarly','reformist'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 60, virtueMerit: 600, virtueStage: 5
      },
      integrity: 78,
      background: '辽东沈阳人·范仲淹后裔·投皇太极·开清制·清初汉臣第一·四朝元老。',
      famousQuote: '治天下在得民心。',
      historicalFate: '康熙五年病殁',
      fateHint: 'peacefulDeath'
    },

    hongChengchou: {
      id: 'hongChengchou', name: '洪承畴', zi: '彦演',
      birthYear: 1593, deathYear: 1665, alternateNames: ['亨九'],
      era: '明末清初', dynasty: '清', role: 'usurper',
      title: '太傅·三等阿达哈哈番', officialTitle: '兵部尚书·内院大学士',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 90, intelligence: 92,
                    charisma: 80, integrity: 50, benevolence: 60,
                    diplomacy: 80, scholarship: 88, finance: 75, cunning: 88 },
      loyalty: 40, ambition: 80,
      traits: ['brilliant','patient','scheming','clever'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: -30, virtueMerit: 300, virtueStage: 3
      },
      integrity: 50,
      background: '泉州南安人·明末蓟辽总督·松锦战败被俘·降清·经略南方平定西南·贰臣。',
      famousQuote: '',
      historicalFate: '康熙四年病殁·乾隆列贰臣传',
      fateHint: 'peacefulDeath'
    },

    shiLang: {
      id: 'shiLang', name: '施琅', zi: '尊侯',
      birthYear: 1621, deathYear: 1696, alternateNames: ['琢公','靖海侯','襄壮'],
      era: '康熙', dynasty: '清', role: 'military',
      title: '靖海侯', officialTitle: '福建水师提督',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 95, intelligence: 88,
                    charisma: 80, integrity: 70, benevolence: 65,
                    diplomacy: 65, scholarship: 60, finance: 70, cunning: 85 },
      loyalty: 80, ambition: 78,
      traits: ['brave','rigorous','heroic','ruthless'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '泉州晋江人·原郑成功部·因家被郑斩降清·澎湖海战平台湾·清朝海军元勋。',
      famousQuote: '海邦虽僻·圣化所宜先施。',
      historicalFate: '康熙三十五年病殁',
      fateHint: 'peacefulDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-02] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
