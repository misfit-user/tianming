// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-07.js
// Domain: NPC / 历史人物 data
// 来源·波 7
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
    zigong: {
      id: 'zigong', name: '端木赐', zi: '子贡',
      birthYear: -520, deathYear: -456, alternateNames: ['子贡','端木子'],
      era: '春秋', dynasty: '鲁', role: 'scholar',
      title: '鲁卫相', officialTitle: '相国',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 60, intelligence: 95,
                    charisma: 92, integrity: 90, benevolence: 88,
                    diplomacy: 100, scholarship: 95, finance: 95, cunning: 88 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','clever','literary','sage'],
      resources: {
        privateWealth: { money: 5000000, land: 50000, treasure: 10000000, slaves: 1000, commerce: 30000000 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '卫国人·孔门十哲·一出存鲁乱齐破吴强晋而霸越·儒商鼻祖·孔子身后传道。',
      famousQuote: '己所不欲·勿施于人。',
      historicalFate: '鲁哀公末病殁',
      fateHint: 'peacefulDeath'
    },

    mozi: {
      id: 'mozi', name: '墨翟', zi: '',
      birthYear: -470, deathYear: -391, alternateNames: ['墨子','墨翟'],
      era: '战国', dynasty: '宋', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 5, socialClass: 'commoner', department: '',
      abilities: { governance: 80, military: 80, intelligence: 95,
                    charisma: 88, integrity: 100, benevolence: 100,
                    diplomacy: 88, scholarship: 100, finance: 70, cunning: 78 },
      loyalty: 70, ambition: 60,
      traits: ['scholarly','sage','idealist','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '宋国人·墨家学派开宗·兼爱非攻·止楚攻宋·门徒守城技尤精·与儒家并称显学。',
      famousQuote: '兼相爱·交相利。',
      historicalFate: '终于鲁地·寿八十',
      fateHint: 'peacefulDeath'
    },

    mengzi: {
      id: 'mengzi', name: '孟轲', zi: '子舆',
      birthYear: -372, deathYear: -289, alternateNames: ['孟子','亚圣'],
      era: '战国', dynasty: '邹', role: 'scholar',
      title: '稷下先生', officialTitle: '客卿',
      rankLevel: 18, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 80, military: 35, intelligence: 95,
                    charisma: 92, integrity: 100, benevolence: 100,
                    diplomacy: 80, scholarship: 100, finance: 60, cunning: 65 },
      loyalty: 80, ambition: 70,
      traits: ['scholarly','sage','idealist','heroic'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 1000, virtueStage: 6
      },
      integrity: 100,
      background: '邹国人·孔子之孙子思之徒·游列国劝行仁政·撰《孟子》七篇·儒学亚圣·性善论。',
      famousQuote: '富贵不能淫·贫贱不能移·威武不能屈。',
      historicalFate: '齐宣王末归邹·寿八十四',
      fateHint: 'retirement'
    },

    fanZeng: {
      id: 'fanZeng', name: '范增', zi: '',
      birthYear: -277, deathYear: -204, alternateNames: ['亚父'],
      era: '秦末', dynasty: '楚', role: 'scholar',
      title: '历阳侯', officialTitle: '军师',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 75, military: 75, intelligence: 95,
                    charisma: 70, integrity: 80, benevolence: 60,
                    diplomacy: 70, scholarship: 88, finance: 60, cunning: 95 },
      loyalty: 90, ambition: 75,
      traits: ['brilliant','patient','scheming','heroic'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 85,
      background: '居鄛人·七十出山辅项梁项羽·亚父·鸿门宴举玦三示·陈平反间失宠·愤然归乡途中疽发背死。',
      famousQuote: '竖子不足与谋。',
      historicalFate: '汉三年遭项羽疏弃·归途疽发背死',
      fateHint: 'forcedDeath'
    },

    yuanShao: {
      id: 'yuanShao', name: '袁绍', zi: '本初',
      birthYear: 154, deathYear: 202, alternateNames: ['邺侯'],
      era: '汉末', dynasty: '东汉', role: 'usurper',
      title: '邺侯·大将军', officialTitle: '冀州牧·大将军',
      rankLevel: 28, socialClass: 'noble', department: 'military',
      abilities: { governance: 75, military: 70, intelligence: 75,
                    charisma: 88, integrity: 60, benevolence: 70,
                    diplomacy: 78, scholarship: 78, finance: 75, cunning: 65 },
      loyalty: 50, ambition: 95,
      traits: ['ambitious','vain','luxurious','proud'],
      resources: {
        privateWealth: { money: 10000000, land: 300000, treasure: 30000000, slaves: 5000, commerce: 1000000 },
        hiddenWealth: 0, fame: 50, virtueMerit: 400, virtueStage: 4
      },
      integrity: 60,
      background: '汝南人·四世三公·讨董卓盟主·据河北四州·官渡败于曹·忧愤吐血而亡·诸子争立而亡。',
      famousQuote: '名门之后·岂可负天下。',
      historicalFate: '建安七年官渡败后忧愤吐血而亡',
      fateHint: 'forcedDeath'
    },

    pangde: {
      id: 'pangde', name: '庞德', zi: '令明',
      birthYear: 170, deathYear: 219, alternateNames: ['关门亭侯','壮'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '关门亭侯', officialTitle: '立义将军',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 50, military: 92, intelligence: 75,
                    charisma: 78, integrity: 95, benevolence: 65,
                    diplomacy: 50, scholarship: 50, finance: 50, cunning: 65 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 850, virtueStage: 6
      },
      integrity: 100,
      background: '南安狟道人·原马超部·后归曹·樊城抬棺战关羽·水淹七军被擒·拒降被斩。',
      famousQuote: '吾闻良将不怯死以苟免·烈士不毁节而求生。',
      historicalFate: '建安二十四年水淹七军·拒降被关羽斩',
      fateHint: 'martyrdom'
    },

    yangsu: {
      id: 'yangsu', name: '杨素', zi: '处道',
      birthYear: 544, deathYear: 606, alternateNames: ['楚景武公','越国公'],
      era: '隋', dynasty: '隋', role: 'usurper',
      title: '越国公', officialTitle: '尚书右仆射',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 95, intelligence: 92,
                    charisma: 85, integrity: 50, benevolence: 50,
                    diplomacy: 80, scholarship: 92, finance: 80, cunning: 95 },
      loyalty: 60, ambition: 95,
      traits: ['brilliant','ruthless','heroic','ambitious'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 30000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 0, fame: 30, virtueMerit: 400, virtueStage: 4
      },
      integrity: 55,
      background: '弘农华阴人·灭陈大将·助杨广夺嫡·征突厥·权倾天下·累朝功臣·后被炀帝忌·郁郁而亡。',
      famousQuote: '我若死时·此人复何用。',
      historicalFate: '大业二年病殁·炀帝喜其死',
      fateHint: 'forcedDeath'
    },

    gaojiong: {
      id: 'gaojiong', name: '高颎', zi: '昭玄',
      birthYear: 541, deathYear: 607, alternateNames: ['独孤','开府仪同三司'],
      era: '隋', dynasty: '隋', role: 'regent',
      title: '齐国公', officialTitle: '尚书左仆射',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 80, intelligence: 95,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 88, scholarship: 92, finance: 88, cunning: 88 },
      loyalty: 95, ambition: 65,
      traits: ['brilliant','rigorous','sage','heroic'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '渤海蓚人·辅杨坚开隋·灭陈·开皇之治第一相·谏阻废太子勇·炀帝即位忌之被斩。',
      famousQuote: '此事·圣意所定·岂臣下所敢言。',
      historicalFate: '大业三年坐谤讪朝政被斩',
      fateHint: 'executionByFraming'
    },

    zhangsunSheng: {
      id: 'zhangsunSheng', name: '长孙晟', zi: '季晟',
      birthYear: 552, deathYear: 609, alternateNames: ['薛国公','献'],
      era: '隋', dynasty: '隋', role: 'military',
      title: '薛国公', officialTitle: '右骁卫将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 92, intelligence: 95,
                    charisma: 88, integrity: 90, benevolence: 78,
                    diplomacy: 100, scholarship: 88, finance: 65, cunning: 92 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','brave','clever','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '河南洛阳人·长孙皇后父·分化突厥·一箭双雕·使突厥东西分治·隋开皇外交家。',
      famousQuote: '一箭双雕。',
      historicalFate: '大业五年病殁',
      fateHint: 'peacefulDeath'
    },

    hanQinhu: {
      id: 'hanQinhu', name: '韩擒虎', zi: '子通',
      birthYear: 538, deathYear: 592, alternateNames: ['寿光县公'],
      era: '隋', dynasty: '隋', role: 'military',
      title: '寿光县公', officialTitle: '上柱国·凉州总管',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 80,
                    charisma: 80, integrity: 85, benevolence: 65,
                    diplomacy: 60, scholarship: 60, finance: 55, cunning: 78 },
      loyalty: 90, ambition: 70,
      traits: ['brave','heroic','rigorous','proud'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 85,
      background: '河南东垣人·原名豹·十三岁擒虎易名·灭陈先锋·捉陈后主·与贺若弼争功而亡。',
      famousQuote: '吾死后将为阎罗王。',
      historicalFate: '开皇十二年病殁',
      fateHint: 'peacefulDeath'
    },

    liDeyu: {
      id: 'liDeyu', name: '李德裕', zi: '文饶',
      birthYear: 787, deathYear: 850, alternateNames: ['卫国公','文忠'],
      era: '武宗朝', dynasty: '唐', role: 'reformer',
      title: '卫国公', officialTitle: '尚书右仆射·门下侍郎',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 75, intelligence: 95,
                    charisma: 80, integrity: 85, benevolence: 75,
                    diplomacy: 88, scholarship: 95, finance: 88, cunning: 92 },
      loyalty: 92, ambition: 88,
      traits: ['brilliant','rigorous','reformist','ambitious'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 85,
      background: '赵郡人·李吉甫子·武宗会昌中兴主导·灭佛·破回鹘·李党魁·宣宗朝贬崖州司户·客死。',
      famousQuote: '论天下之事·当先问其大。',
      historicalFate: '大中三年贬崖州司户·四年殁',
      fateHint: 'exileDeath'
    },

    niuSengru: {
      id: 'niuSengru', name: '牛僧孺', zi: '思黯',
      birthYear: 780, deathYear: 849, alternateNames: ['奇章公'],
      era: '宪穆敬文武宣朝', dynasty: '唐', role: 'regent',
      title: '奇章郡公', officialTitle: '同中书门下平章事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 50, intelligence: 92,
                    charisma: 80, integrity: 80, benevolence: 75,
                    diplomacy: 85, scholarship: 92, finance: 75, cunning: 88 },
      loyalty: 88, ambition: 75,
      traits: ['scholarly','patient','clever','rigorous'],
      resources: {
        privateWealth: { money: 1000000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 65, virtueMerit: 600, virtueStage: 5
      },
      integrity: 80,
      background: '安定鹑觚人·牛党魁·与李德裕党争数十年·历仕六朝·撰《玄怪录》·小说先驱。',
      famousQuote: '同则相亲·异则相忌·人之常情。',
      historicalFate: '大中三年病殁洛阳',
      fateHint: 'peacefulDeath'
    },

    yangyan: {
      id: 'yangyan', name: '杨炎', zi: '公南',
      birthYear: 727, deathYear: 781, alternateNames: ['两税法'],
      era: '德宗朝', dynasty: '唐', role: 'reformer',
      title: '尚书左仆射', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92,
                    charisma: 78, integrity: 75, benevolence: 70,
                    diplomacy: 75, scholarship: 88, finance: 100, cunning: 88 },
      loyalty: 80, ambition: 88,
      traits: ['reformist','rigorous','scheming','clever'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '凤翔天兴人·建中元年推行两税法·中唐财政转轨·与卢杞争·贬崖州·赐自尽。',
      famousQuote: '两税法·量出为入。',
      historicalFate: '建中二年贬崖州·途中赐自尽',
      fateHint: 'forcedDeath'
    },

    luzhi: {
      id: 'luzhi', name: '陆贽', zi: '敬舆',
      birthYear: 754, deathYear: 805, alternateNames: ['陆相','宣公'],
      era: '德宗朝', dynasty: '唐', role: 'scholar',
      title: '宣国公', officialTitle: '中书侍郎·同平章事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 95,
                    charisma: 80, integrity: 95, benevolence: 88,
                    diplomacy: 80, scholarship: 100, finance: 80, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['scholarly','rigorous','upright','sage'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '苏州嘉兴人·德宗朝制诰·朱泚之乱奉天奏议·中唐文章大家·裴延龄构陷贬忠州。',
      famousQuote: '知人则哲·惟帝其难之。',
      historicalFate: '永贞元年病殁忠州贬所',
      fateHint: 'exileDeath'
    },

    fengdao: {
      id: 'fengdao', name: '冯道', zi: '可道',
      birthYear: 882, deathYear: 954, alternateNames: ['长乐老','文懿'],
      era: '五代十国', dynasty: '后唐', role: 'regent',
      title: '燕国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 30, intelligence: 92,
                    charisma: 80, integrity: 60, benevolence: 80,
                    diplomacy: 95, scholarship: 95, finance: 75, cunning: 92 },
      loyalty: 50, ambition: 75,
      traits: ['scholarly','patient','clever','sage'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: -10, virtueMerit: 400, virtueStage: 4
      },
      integrity: 65,
      background: '瀛州景城人·历仕四朝十君·官至宰相·儒林讥不忠·主修印本《九经》·留长乐老叙。',
      famousQuote: '但教方寸无诸恶·狼虎丛中也立身。',
      historicalFate: '显德元年病殁·后世评价两极',
      fateHint: 'peacefulDeath'
    },

    wangQinruo: {
      id: 'wangQinruo', name: '王钦若', zi: '定国',
      birthYear: 962, deathYear: 1025, alternateNames: ['冀国公','文穆'],
      era: '真宗朝', dynasty: '北宋', role: 'corrupt',
      title: '冀国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 40, intelligence: 90,
                    charisma: 75, integrity: 30, benevolence: 50,
                    diplomacy: 78, scholarship: 88, finance: 75, cunning: 95 },
      loyalty: 60, ambition: 90,
      traits: ['scheming','flatterer','clever','luxurious'],
      resources: {
        privateWealth: { money: 2000000, land: 50000, treasure: 5000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 500000, fame: -50, virtueMerit: 200, virtueStage: 2
      },
      integrity: 35,
      background: '临江军新喻人·五鬼之首·力主真宗东封西祀·撰《册府元龟》·与寇准为敌·两度拜相。',
      famousQuote: '城下之盟·春秋耻之。',
      historicalFate: '天圣三年病殁',
      fateHint: 'peacefulDeath'
    },

    yuanHaowen: {
      id: 'yuanHaowen', name: '元好问', zi: '裕之',
      birthYear: 1190, deathYear: 1257, alternateNames: ['遗山','元才子'],
      era: '金元之际', dynasty: '元', role: 'scholar',
      title: '尚书省左司员外郎', officialTitle: '左司员外郎',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 30, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 65 },
      loyalty: 88, ambition: 60,
      traits: ['literary','scholarly','idealist','heroic'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '太原秀容人·金末状元·金亡不仕元·撰《中州集》《壬辰杂编》·北方文宗。',
      famousQuote: '问世间情是何物·直教生死相许。',
      historicalFate: '元宪宗七年病殁',
      fateHint: 'retirement'
    },

    zhaoMengfu: {
      id: 'zhaoMengfu', name: '赵孟頫', zi: '子昂',
      birthYear: 1254, deathYear: 1322, alternateNames: ['松雪道人','水精宫道人','文敏'],
      era: '元', dynasty: '元', role: 'scholar',
      title: '魏国公', officialTitle: '翰林学士承旨',
      rankLevel: 26, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 25, intelligence: 92,
                    charisma: 88, integrity: 65, benevolence: 75,
                    diplomacy: 75, scholarship: 100, finance: 70, cunning: 65 },
      loyalty: 70, ambition: 70,
      traits: ['literary','scholarly','luxurious','idealist'],
      resources: {
        privateWealth: { money: 800000, land: 10000, treasure: 1500000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 700, virtueStage: 5
      },
      integrity: 70,
      background: '吴兴人·宋宗室·入元仕至尚书·赵体书风·楷书四大家之一·元代书画第一人·有亏宋忠之议。',
      famousQuote: '青山不改·绿水长流。',
      historicalFate: '至治二年病殁',
      fateHint: 'peacefulDeath'
    },

    muying: {
      id: 'muying', name: '沐英', zi: '文英',
      birthYear: 1344, deathYear: 1392, alternateNames: ['黔宁王','昭靖'],
      era: '明初', dynasty: '明', role: 'military',
      title: '西平侯·黔宁王', officialTitle: '征南将军·云南镇守',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 88, military: 92, intelligence: 88,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 75, scholarship: 75, finance: 75, cunning: 80 },
      loyalty: 100, ambition: 65,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 2000000, land: 80000, treasure: 5000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '濠州定远人·朱元璋养子·定云南世镇黔国·马皇后死哭至吐血·太子标死悲恸而亡。',
      famousQuote: '为君效死·吾愿足矣。',
      historicalFate: '洪武二十五年闻太子标薨悲恸吐血而亡',
      fateHint: 'forcedDeath'
    },

    zhuBiao: {
      id: 'zhuBiao', name: '朱标', zi: '',
      birthYear: 1355, deathYear: 1392, alternateNames: ['懿文太子','明兴宗'],
      era: '洪武', dynasty: '明', role: 'loyal',
      title: '皇太子', officialTitle: '太子',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 65, intelligence: 88,
                    charisma: 90, integrity: 92, benevolence: 95,
                    diplomacy: 80, scholarship: 92, finance: 75, cunning: 65 },
      loyalty: 100, ambition: 60,
      traits: ['benevolent','loyal','idealist','sage'],
      resources: {
        privateWealth: { money: 50000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '朱元璋长子·宋濂等大儒所授·仁厚·制衡父之严酷·三十八岁先薨·朱棣靖难之远因。',
      famousQuote: '陛下杀人过滥·恐伤国本。',
      historicalFate: '洪武二十五年视陕归途感寒疾殁',
      fateHint: 'peacefulDeath'
    },

    yangSichang: {
      id: 'yangSichang', name: '杨嗣昌', zi: '文弱',
      birthYear: 1588, deathYear: 1641, alternateNames: ['文弱'],
      era: '明末', dynasty: '明', role: 'military',
      title: '兵部尚书·东阁大学士', officialTitle: '督师·礼部尚书',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 80, military: 80, intelligence: 88,
                    charisma: 75, integrity: 70, benevolence: 60,
                    diplomacy: 70, scholarship: 88, finance: 70, cunning: 88 },
      loyalty: 88, ambition: 88,
      traits: ['brilliant','rigorous','idealist','scheming'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 30, virtueMerit: 400, virtueStage: 4
      },
      integrity: 75,
      background: '武陵人·崇祯朝兵部尚书·四正六隅十面网·攘外安内·张献忠破襄阳·绝食殁军中。',
      famousQuote: '攘外必先安内。',
      historicalFate: '崇祯十四年襄阳陷·绝食殁军中',
      fateHint: 'martyrdom'
    },

    sunChuanting: {
      id: 'sunChuanting', name: '孙传庭', zi: '伯雅',
      birthYear: 1593, deathYear: 1643, alternateNames: ['白谷','忠靖'],
      era: '明末', dynasty: '明', role: 'military',
      title: '兵部尚书', officialTitle: '督师·三边总督',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 78, military: 90, intelligence: 88,
                    charisma: 82, integrity: 92, benevolence: 75,
                    diplomacy: 60, scholarship: 80, finance: 65, cunning: 80 },
      loyalty: 100, ambition: 75,
      traits: ['brave','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 92,
      background: '代州振武卫人·崇祯朝平流寇大将·黑水峪生擒高迎祥·奉旨出潼关战死汝州·明史孙传庭死而明亡。',
      famousQuote: '吾死·则明亡。',
      historicalFate: '崇祯十六年潼关汝州大败殁阵中',
      fateHint: 'martyrdom'
    },

    zuoGuangdou: {
      id: 'zuoGuangdou', name: '左光斗', zi: '遗直',
      birthYear: 1575, deathYear: 1625, alternateNames: ['浮丘','忠毅'],
      era: '天启', dynasty: '明', role: 'loyal',
      title: '左佥都御史', officialTitle: '左佥都御史',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 25, intelligence: 88,
                    charisma: 78, integrity: 100, benevolence: 80,
                    diplomacy: 50, scholarship: 88, finance: 60, cunning: 60 },
      loyalty: 100, ambition: 65,
      traits: ['upright','loyal','heroic','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '桐城人·东林党六君子之一·与杨涟同劾魏忠贤·下诏狱受拷成残·铁锤击额而死。',
      famousQuote: '吾辈风骨·岂为奴所夺。',
      historicalFate: '天启五年下诏狱·铁锤额死狱中',
      fateHint: 'martyrdom'
    },

    niYuanlu: {
      id: 'niYuanlu', name: '倪元璐', zi: '玉汝',
      birthYear: 1593, deathYear: 1644, alternateNames: ['鸿宝','文正'],
      era: '崇祯', dynasty: '明', role: 'loyal',
      title: '户部尚书', officialTitle: '户部尚书·翰林学士',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 92,
                    charisma: 80, integrity: 100, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 80, cunning: 60 },
      loyalty: 100, ambition: 65,
      traits: ['literary','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '上虞人·明末书法大家·崇祯朝户部尚书·李自成入北京·与全家自缢殉国。',
      famousQuote: '南都尚可为·吾死犹可有所赖。',
      historicalFate: '崇祯十七年京破自缢·全家殉国',
      fateHint: 'martyrdom'
    },

    dengShichang: {
      id: 'dengShichang', name: '邓世昌', zi: '正卿',
      birthYear: 1849, deathYear: 1894, alternateNames: ['壮节'],
      era: '光绪', dynasty: '清', role: 'military',
      title: '提督衔', officialTitle: '致远舰管带',
      rankLevel: 18, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 88, intelligence: 80,
                    charisma: 85, integrity: 100, benevolence: 75,
                    diplomacy: 60, scholarship: 75, finance: 60, cunning: 65 },
      loyalty: 100, ambition: 70,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '广东番禺人·北洋海军致远舰管带·甲午黄海海战·撞击吉野舰中鱼雷·拒援与舰俱沉。',
      famousQuote: '吾辈从军·卫国岂能贪生。',
      historicalFate: '光绪二十年九月十七日黄海海战与致远舰俱沉',
      fateHint: 'martyrdom'
    },

    linXu: {
      id: 'linXu', name: '林旭', zi: '暾谷',
      birthYear: 1875, deathYear: 1898, alternateNames: ['暾谷','晚翠'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '军机章京', officialTitle: '四品衔军机章京',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 25, intelligence: 92,
                    charisma: 80, integrity: 100, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 55, cunning: 60 },
      loyalty: 100, ambition: 80,
      traits: ['literary','heroic','idealist','reformist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '福建侯官人·戊戌六君子·年仅二十四·京师菜市口与谭嗣同等同就义。',
      famousQuote: '青蒲饮泣知何补·慷慨难酬国士恩。',
      historicalFate: '光绪二十四年菜市口就义',
      fateHint: 'martyrdom'
    },

    liuGuangdi: {
      id: 'liuGuangdi', name: '刘光第', zi: '裴邨',
      birthYear: 1859, deathYear: 1898, alternateNames: ['裴邨'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '军机章京', officialTitle: '刑部主事',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 25, intelligence: 88,
                    charisma: 78, integrity: 100, benevolence: 85,
                    diplomacy: 50, scholarship: 92, finance: 55, cunning: 55 },
      loyalty: 100, ambition: 75,
      traits: ['upright','heroic','idealist','reformist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '四川富顺人·戊戌六君子·与谭嗣同同上变法疏·政变后下诏狱·京师菜市口就义。',
      famousQuote: '吾属死·正气存。',
      historicalFate: '光绪二十四年菜市口就义',
      fateHint: 'martyrdom'
    },

    yangrui: {
      id: 'yangrui', name: '杨锐', zi: '叔峤',
      birthYear: 1857, deathYear: 1898, alternateNames: ['叔峤'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '军机章京', officialTitle: '内阁中书',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 25, intelligence: 88,
                    charisma: 78, integrity: 100, benevolence: 80,
                    diplomacy: 55, scholarship: 92, finance: 55, cunning: 55 },
      loyalty: 100, ambition: 75,
      traits: ['upright','heroic','idealist','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '四川绵竹人·张之洞门生·戊戌六君子·与林旭等共预新政·京师菜市口就义。',
      famousQuote: '英气未消·肝胆亦昭日月。',
      historicalFate: '光绪二十四年菜市口就义',
      fateHint: 'martyrdom'
    },

    kangGuangren: {
      id: 'kangGuangren', name: '康广仁', zi: '幼博',
      birthYear: 1867, deathYear: 1898, alternateNames: ['幼博','大成','广仁'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 65, military: 25, intelligence: 85,
                    charisma: 78, integrity: 100, benevolence: 85,
                    diplomacy: 55, scholarship: 88, finance: 55, cunning: 55 },
      loyalty: 100, ambition: 70,
      traits: ['heroic','idealist','reformist','reclusive'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '广东南海人·康有为弟·主办澳门《知新报》·变法被捕·京师菜市口就义。',
      famousQuote: '若死而中国可强·死亦无憾。',
      historicalFate: '光绪二十四年菜市口就义',
      fateHint: 'martyrdom'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-07] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
