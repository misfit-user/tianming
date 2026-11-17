// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-06.js
// Domain: NPC / 历史人物 data
// 来源·波 6
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
    guanying: {
      id: 'guanying', name: '灌婴', zi: '',
      birthYear: -250, deathYear: -176, alternateNames: ['颍阴侯','懿'],
      era: '汉初', dynasty: '西汉', role: 'military',
      title: '颍阴侯', officialTitle: '太尉·丞相',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 78, military: 92, intelligence: 80,
                    charisma: 78, integrity: 85, benevolence: 70,
                    diplomacy: 65, scholarship: 50, finance: 60, cunning: 75 },
      loyalty: 95, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 88,
      background: '睢阳人·贩缯起家·从高祖战项羽·诛诸吕·文帝朝丞相·汉初骑兵第一将。',
      famousQuote: '',
      historicalFate: '文帝四年病殁',
      fateHint: 'peacefulDeath'
    },

    gongsunHong: {
      id: 'gongsunHong', name: '公孙弘', zi: '次卿',
      birthYear: -200, deathYear: -121, alternateNames: ['平津侯','献'],
      era: '武帝朝', dynasty: '西汉', role: 'regent',
      title: '平津侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 35, intelligence: 90,
                    charisma: 78, integrity: 75, benevolence: 70,
                    diplomacy: 80, scholarship: 92, finance: 75, cunning: 88 },
      loyalty: 88, ambition: 80,
      traits: ['scholarly','patient','clever','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 700, virtueStage: 5
      },
      integrity: 78,
      background: '齐国菑川人·四十而学《春秋》·六十拜博士·七十拜相·首位以丞相封侯者。',
      famousQuote: '智者贵乎察事·愚者智不能察。',
      historicalFate: '元狩二年丞相任上殁',
      fateHint: 'peacefulDeath'
    },

    simaXiangru: {
      id: 'simaXiangru', name: '司马相如', zi: '长卿',
      birthYear: -179, deathYear: -117, alternateNames: ['司马长卿','犬子'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '孝文园令', officialTitle: '中郎将',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 60, military: 50, intelligence: 92,
                    charisma: 92, integrity: 70, benevolence: 70,
                    diplomacy: 80, scholarship: 100, finance: 50, cunning: 70 },
      loyalty: 75, ambition: 70,
      traits: ['literary','luxurious','clever','idealist'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '蜀郡成都人·汉赋大家·琴挑卓文君当垆卖酒·上《子虚》《上林》武帝奇之·通西南夷。',
      famousQuote: '凤兮凤兮归故乡，遨游四海求其凰。',
      historicalFate: '元狩五年病殁茂陵',
      fateHint: 'peacefulDeath'
    },

    zhuoWenjun: {
      id: 'zhuoWenjun', name: '卓文君', zi: '',
      birthYear: -175, deathYear: -121, alternateNames: ['文君'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '', officialTitle: '',
      rankLevel: 0, socialClass: 'noble', department: '',
      abilities: { governance: 60, military: 25, intelligence: 88,
                    charisma: 95, integrity: 88, benevolence: 75,
                    diplomacy: 75, scholarship: 92, finance: 75, cunning: 70 },
      loyalty: 80, ambition: 50,
      traits: ['literary','idealist','heroic','luxurious'],
      resources: {
        privateWealth: { money: 1000000, land: 20000, treasure: 2000000, slaves: 500, commerce: 500000 },
        hiddenWealth: 0, fame: 92, virtueMerit: 700, virtueStage: 5
      },
      integrity: 85,
      background: '临邛巨商卓王孙女·夜奔司马相如·当垆卖酒·撰《白头吟》以拒纳妾。',
      famousQuote: '愿得一心人，白头不相离。',
      historicalFate: '元狩六年病殁',
      fateHint: 'peacefulDeath'
    },

    zhuMaichen: {
      id: 'zhuMaichen', name: '朱买臣', zi: '翁子',
      birthYear: -174, deathYear: -115, alternateNames: [],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '会稽太守', officialTitle: '会稽太守·丞相长史',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 78, military: 60, intelligence: 88,
                    charisma: 75, integrity: 70, benevolence: 70,
                    diplomacy: 65, scholarship: 92, finance: 65, cunning: 80 },
      loyalty: 80, ambition: 88,
      traits: ['scholarly','humble_origin','heroic','idealist'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '吴郡人·樵者出身·五十而显·破闽越·覆水难收典出此·张汤之死案下狱被杀。',
      famousQuote: '富贵不还乡·如锦衣夜行。',
      historicalFate: '元封元年坐张汤事下狱·诛',
      fateHint: 'execution'
    },

    kouxun: {
      id: 'kouxun', name: '寇恂', zi: '子翼',
      birthYear: -3, deathYear: 36, alternateNames: ['雍奴侯','威'],
      era: '光武朝', dynasty: '东汉', role: 'military',
      title: '雍奴侯', officialTitle: '颍川太守',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'local',
      abilities: { governance: 92, military: 88, intelligence: 88,
                    charisma: 85, integrity: 92, benevolence: 88,
                    diplomacy: 75, scholarship: 80, finance: 75, cunning: 75 },
      loyalty: 100, ambition: 60,
      traits: ['brilliant','rigorous','benevolent','heroic'],
      resources: {
        privateWealth: { money: 400000, land: 10000, treasure: 600000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '上谷昌平人·云台二十八将·光武萧何·镇河内供军用·百姓借寇君一年之传。',
      famousQuote: '愿从陛下复借寇君一年。',
      historicalFate: '建武十二年病殁',
      fateHint: 'peacefulDeath'
    },

    fengyi: {
      id: 'fengyi', name: '冯异', zi: '公孙',
      birthYear: -10, deathYear: 34, alternateNames: ['阳夏侯','节','大树将军'],
      era: '光武朝', dynasty: '东汉', role: 'military',
      title: '阳夏侯', officialTitle: '征西大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 88,
                    charisma: 82, integrity: 95, benevolence: 80,
                    diplomacy: 65, scholarship: 75, finance: 65, cunning: 80 },
      loyalty: 100, ambition: 60,
      traits: ['brilliant','brave','heroic','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 12000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '颍川父城人·云台将·破赤眉于崤底·镇关中·诸将论功立·独立大树下不与争·大树将军。',
      famousQuote: '失之东隅·收之桑榆。',
      historicalFate: '建武十年病殁军中',
      fateHint: 'peacefulDeath'
    },

    chentang: {
      id: 'chentang', name: '陈汤', zi: '子公',
      birthYear: -100, deathYear: -10, alternateNames: ['关内侯'],
      era: '元成朝', dynasty: '西汉', role: 'military',
      title: '关内侯', officialTitle: '射声校尉',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 92, intelligence: 95,
                    charisma: 75, integrity: 60, benevolence: 60,
                    diplomacy: 75, scholarship: 80, finance: 60, cunning: 92 },
      loyalty: 80, ambition: 90,
      traits: ['brilliant','brave','heroic','clever'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 600, virtueStage: 5
      },
      integrity: 65,
      background: '山阳瑕丘人·矫诏发兵远征·斩郅支单于·明犯强汉者虽远必诛·后牵涉案下狱多次。',
      famousQuote: '明犯强汉者，虽远必诛。',
      historicalFate: '哀帝建平四年病殁',
      fateHint: 'peacefulDeath'
    },

    luZhonglian: {
      id: 'luZhonglian', name: '鲁仲连', zi: '',
      birthYear: -305, deathYear: -245, alternateNames: ['鲁连子','鲁仲连子'],
      era: '战国', dynasty: '齐', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 5, socialClass: 'commoner', department: '',
      abilities: { governance: 60, military: 50, intelligence: 95,
                    charisma: 92, integrity: 100, benevolence: 88,
                    diplomacy: 100, scholarship: 95, finance: 50, cunning: 88 },
      loyalty: 80, ambition: 30,
      traits: ['heroic','reclusive','clever','sage'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 100,
      background: '齐国茌平人·辩士·邯郸劝平原君拒帝秦·一封信射入聊城·终生不仕。',
      famousQuote: '吾与富贵而诎于人·宁贫贱而轻世肆志焉。',
      historicalFate: '终隐海上',
      fateHint: 'retirement'
    },

    simaRangju: {
      id: 'simaRangju', name: '田穰苴', zi: '',
      birthYear: -570, deathYear: -490, alternateNames: ['司马穰苴','司马子'],
      era: '春秋', dynasty: '齐', role: 'military',
      title: '大司马', officialTitle: '大司马',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 95, intelligence: 92,
                    charisma: 80, integrity: 90, benevolence: 75,
                    diplomacy: 65, scholarship: 92, finance: 65, cunning: 85 },
      loyalty: 92, ambition: 65,
      traits: ['brilliant','rigorous','heroic','brave'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '齐国田氏旁支·斩庄贾立威·破晋燕·撰《司马法》·齐国军事改革家·孙武之先驱。',
      famousQuote: '将受命之日则忘其家。',
      historicalFate: '齐景公末忧愤而殁',
      fateHint: 'forcedDeath'
    },

    wangXuance: {
      id: 'wangXuance', name: '王玄策', zi: '',
      birthYear: 600, deathYear: 668, alternateNames: [],
      era: '太宗高宗朝', dynasty: '唐', role: 'military',
      title: '朝散大夫', officialTitle: '右卫率府长史',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 92, intelligence: 95,
                    charisma: 80, integrity: 90, benevolence: 75,
                    diplomacy: 95, scholarship: 80, finance: 65, cunning: 92 },
      loyalty: 95, ambition: 65,
      traits: ['heroic','brave','clever','rigorous'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 90,
      background: '洛阳人·三次出使天竺·吐蕃尼婆罗借兵·一人灭一国·破阿罗那顺·俘虏押回长安。',
      famousQuote: '',
      historicalFate: '咸亨年间病殁',
      fateHint: 'peacefulDeath'
    },

    suDingfang: {
      id: 'suDingfang', name: '苏定方', zi: '烈',
      birthYear: 592, deathYear: 667, alternateNames: ['邢国公','庄'],
      era: '太宗高宗朝', dynasty: '唐', role: 'military',
      title: '邢国公', officialTitle: '左武卫大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 95, intelligence: 88,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 65, scholarship: 60, finance: 60, cunning: 80 },
      loyalty: 95, ambition: 65,
      traits: ['brave','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 88,
      background: '冀州武邑人·三箭定天山·灭西突厥·百济·吐火罗·一人破三国·唐扩疆第一将。',
      famousQuote: '',
      historicalFate: '乾封二年病殁',
      fateHint: 'peacefulDeath'
    },

    liuYuxi: {
      id: 'liuYuxi', name: '刘禹锡', zi: '梦得',
      birthYear: 772, deathYear: 842, alternateNames: ['诗豪','彭城'],
      era: '德宪穆敬文朝', dynasty: '唐', role: 'scholar',
      title: '检校礼部尚书', officialTitle: '太子宾客',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 30, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 70 },
      loyalty: 90, ambition: 70,
      traits: ['literary','heroic','idealist','reformist'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '洛阳人·永贞革新·与柳宗元同贬·二十三年弃置身·诗豪·陋室铭·雅好南国民歌。',
      famousQuote: '沉舟侧畔千帆过，病树前头万木春。',
      historicalFate: '会昌二年病殁洛阳',
      fateHint: 'peacefulDeath'
    },

    censhen: {
      id: 'censhen', name: '岑参', zi: '',
      birthYear: 715, deathYear: 770, alternateNames: ['岑嘉州'],
      era: '玄肃代朝', dynasty: '唐', role: 'scholar',
      title: '嘉州刺史', officialTitle: '嘉州刺史',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 65, military: 50, intelligence: 88,
                    charisma: 80, integrity: 85, benevolence: 75,
                    diplomacy: 55, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 88, ambition: 65,
      traits: ['literary','heroic','idealist','brave'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '南阳人·边塞诗派代表·两次入边塞·北庭安西·撰白雪歌走马川·盛唐边塞诗双璧。',
      famousQuote: '忽如一夜春风来，千树万树梨花开。',
      historicalFate: '大历五年病殁成都',
      fateHint: 'peacefulDeath'
    },

    mengHaoran: {
      id: 'mengHaoran', name: '孟浩然', zi: '',
      birthYear: 689, deathYear: 740, alternateNames: ['孟襄阳','孟山人'],
      era: '玄宗朝', dynasty: '唐', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 50, military: 25, intelligence: 88,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 50 },
      loyalty: 70, ambition: 35,
      traits: ['literary','reclusive','idealist','sage'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '襄阳人·一生未仕·唐代田园诗派代表·与王维齐名王孟·背疽风疾而亡。',
      famousQuote: '气蒸云梦泽，波撼岳阳城。',
      historicalFate: '开元二十八年食鲜致病疽发而殁',
      fateHint: 'peacefulDeath'
    },

    shaoYong: {
      id: 'shaoYong', name: '邵雍', zi: '尧夫',
      birthYear: 1011, deathYear: 1077, alternateNames: ['安乐先生','百源先生','康节'],
      era: '神宗朝', dynasty: '北宋', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 60, military: 25, intelligence: 95,
                    charisma: 80, integrity: 92, benevolence: 85,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 65 },
      loyalty: 85, ambition: 35,
      traits: ['scholarly','sage','reclusive','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '范阳人·北宋五子之一·撰《皇极经世》·象数易学·与司马光二程友·终生不仕。',
      famousQuote: '安乐窝中无个事·闲日月·自由身。',
      historicalFate: '熙宁十年病殁洛阳',
      fateHint: 'retirement'
    },

    luJiuyuan: {
      id: 'luJiuyuan', name: '陆九渊', zi: '子静',
      birthYear: 1139, deathYear: 1193, alternateNames: ['象山先生','存斋','文安'],
      era: '南宋', dynasty: '南宋', role: 'scholar',
      title: '荆门军', officialTitle: '知荆门军',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 75, military: 30, intelligence: 95,
                    charisma: 85, integrity: 92, benevolence: 88,
                    diplomacy: 55, scholarship: 100, finance: 55, cunning: 60 },
      loyalty: 90, ambition: 50,
      traits: ['scholarly','sage','idealist','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 900, virtueStage: 6
      },
      integrity: 95,
      background: '抚州金溪人·心学开山·鹅湖之会与朱熹大辩·陆王心学之祖·与朱熹分庭抗礼。',
      famousQuote: '六经注我，我注六经。',
      historicalFate: '绍熙四年病殁荆门任所',
      fateHint: 'peacefulDeath'
    },

    zenggong: {
      id: 'zenggong', name: '曾巩', zi: '子固',
      birthYear: 1019, deathYear: 1083, alternateNames: ['南丰先生','文定'],
      era: '仁英神朝', dynasty: '北宋', role: 'scholar',
      title: '中书舍人', officialTitle: '中书舍人',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 88,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 55, scholarship: 100, finance: 65, cunning: 60 },
      loyalty: 92, ambition: 55,
      traits: ['scholarly','literary','rigorous','sage'],
      resources: {
        privateWealth: { money: 50000, land: 800, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '南丰人·欧阳修门生·唐宋八大家之一·主校北宋藏书·文章谨严·与王安石早年交厚。',
      famousQuote: '后世学者·多读其书。',
      historicalFate: '元丰六年病殁',
      fateHint: 'peacefulDeath'
    },

    shiTianze: {
      id: 'shiTianze', name: '史天泽', zi: '润甫',
      birthYear: 1202, deathYear: 1275, alternateNames: ['镇阳王','忠武'],
      era: '蒙元初', dynasty: '元', role: 'military',
      title: '镇阳王', officialTitle: '中书右丞相',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 88, military: 92, intelligence: 88,
                    charisma: 85, integrity: 88, benevolence: 80,
                    diplomacy: 75, scholarship: 70, finance: 75, cunning: 85 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','brave','heroic','rigorous'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '永清人·元朝汉人世侯·灭金平宋·辅元世祖忽必烈·汉法派支柱之一。',
      famousQuote: '',
      historicalFate: '至元十二年病殁伐宋途中',
      fateHint: 'peacefulDeath'
    },

    zhangHongFan: {
      id: 'zhangHongFan', name: '张弘范', zi: '仲畴',
      birthYear: 1238, deathYear: 1280, alternateNames: ['淮阳武献王'],
      era: '蒙元', dynasty: '元', role: 'military',
      title: '淮阳郡侯', officialTitle: '蒙古汉军都元帅',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 92, intelligence: 88,
                    charisma: 80, integrity: 78, benevolence: 65,
                    diplomacy: 70, scholarship: 78, finance: 70, cunning: 80 },
      loyalty: 92, ambition: 75,
      traits: ['brave','heroic','rigorous','clever'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 80,
      background: '易州定兴人·张柔子·崖山海战灭南宋·俘文天祥·勒石纪功·汉人臣元争议者。',
      famousQuote: '',
      historicalFate: '至元十七年病殁',
      fateHint: 'peacefulDeath'
    },

    lianXixian: {
      id: 'lianXixian', name: '廉希宪', zi: '善甫',
      birthYear: 1231, deathYear: 1280, alternateNames: ['魏国忠武公','廉孟子'],
      era: '蒙元', dynasty: '元', role: 'reformer',
      title: '魏国公', officialTitle: '中书平章政事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 88,
                    diplomacy: 88, scholarship: 92, finance: 80, cunning: 80 },
      loyalty: 92, ambition: 65,
      traits: ['scholarly','reformist','rigorous','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '畏兀儿人·世祖朝丞相·崇汉法·廉孟子·与阿合马党争失败·罢相忧愤而殁。',
      famousQuote: '为政之先·修身正心。',
      historicalFate: '至元十七年忧愤而殁',
      fateHint: 'forcedDeath'
    },

    zhengChenggong: {
      id: 'zhengChenggong', name: '郑成功', zi: '明俨',
      birthYear: 1624, deathYear: 1662, alternateNames: ['国姓爷','延平郡王','森','大木'],
      era: '南明清初', dynasty: '南明', role: 'loyal',
      title: '延平郡王', officialTitle: '招讨大将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 92, intelligence: 88,
                    charisma: 92, integrity: 95, benevolence: 80,
                    diplomacy: 75, scholarship: 88, finance: 80, cunning: 88 },
      loyalty: 100, ambition: 92,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 8000000, land: 100000, treasure: 20000000, slaves: 5000, commerce: 5000000 },
        hiddenWealth: 0, fame: 95, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '泉州南安人·郑芝龙子·赐姓朱·焚青衣抗清·驱荷复台·开台第一人·崩于台湾。',
      famousQuote: '田横尚有岛千古·吾岂其为汉降臣。',
      historicalFate: '永历十六年崩于台湾·年三十九',
      fateHint: 'peacefulDeath'
    },

    zhangHuangyan: {
      id: 'zhangHuangyan', name: '张煌言', zi: '玄著',
      birthYear: 1620, deathYear: 1664, alternateNames: ['苍水','忠烈'],
      era: '南明', dynasty: '南明', role: 'loyal',
      title: '兵部尚书', officialTitle: '兵部尚书',
      rankLevel: 24, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 75, military: 88, intelligence: 88,
                    charisma: 85, integrity: 100, benevolence: 80,
                    diplomacy: 65, scholarship: 92, finance: 65, cunning: 78 },
      loyalty: 100, ambition: 75,
      traits: ['loyal','heroic','idealist','literary'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '鄞县人·与郑成功联抗清·三入长江·散兵入海岛十九年·被俘不屈杭州弼教坊就义。',
      famousQuote: '日月双悬·天地大愿。',
      historicalFate: '康熙三年杭州弼教坊就义',
      fateHint: 'martyrdom'
    },

    xiaWanchun: {
      id: 'xiaWanchun', name: '夏完淳', zi: '存古',
      birthYear: 1631, deathYear: 1647, alternateNames: ['小隐','灵首','节愍'],
      era: '南明', dynasty: '南明', role: 'loyal',
      title: '中书舍人', officialTitle: '中书舍人',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 60, military: 65, intelligence: 88,
                    charisma: 88, integrity: 100, benevolence: 78,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 55 },
      loyalty: 100, ambition: 70,
      traits: ['literary','heroic','idealist','loyal'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '松江华亭人·陈子龙弟子·十四从军抗清·父夏允彝殉国·南明少年英雄·十六就义。',
      famousQuote: '志士仁人·岂以一时之挫·而坠青云之志。',
      historicalFate: '永历元年南京就义·年仅十六',
      fateHint: 'martyrdom'
    },

    duoduo: {
      id: 'duoduo', name: '多铎', zi: '',
      birthYear: 1614, deathYear: 1649, alternateNames: ['豫亲王','通'],
      era: '清初', dynasty: '清', role: 'military',
      title: '豫亲王', officialTitle: '定国大将军',
      rankLevel: 30, socialClass: 'imperial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 80,
                    charisma: 78, integrity: 50, benevolence: 35,
                    diplomacy: 65, scholarship: 60, finance: 65, cunning: 75 },
      loyalty: 90, ambition: 80,
      traits: ['brave','heroic','ruthless','luxurious'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: -50, virtueMerit: 300, virtueStage: 3
      },
      integrity: 55,
      background: '努尔哈赤十五子·多尔衮亲弟·破李自成·下江南·扬州十日嘉定三屠·清初罪行较著。',
      famousQuote: '',
      historicalFate: '顺治六年染天花殁',
      fateHint: 'peacefulDeath'
    },

    yuChengLong: {
      id: 'yuChengLong', name: '于成龙', zi: '北溟',
      birthYear: 1617, deathYear: 1684, alternateNames: ['天下廉吏第一','清端'],
      era: '康熙', dynasty: '清', role: 'clean',
      title: '兵部尚书·两江总督', officialTitle: '两江总督',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 88,
                    charisma: 85, integrity: 100, benevolence: 95,
                    diplomacy: 65, scholarship: 75, finance: 80, cunning: 70 },
      loyalty: 95, ambition: 60,
      traits: ['upright','rigorous','benevolent','heroic'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 100,
      background: '山西永宁人·四十五而仕·清节冠时·终生粝食蔬·康熙誉为天下廉吏第一。',
      famousQuote: '人为官·心为民·一念之差·万劫不复。',
      historicalFate: '康熙二十三年两江任上殁·遗物只布袍蔬食',
      fateHint: 'peacefulDeath'
    },

    songEetu: {
      id: 'songEetu', name: '索额图', zi: '',
      birthYear: 1636, deathYear: 1703, alternateNames: ['赫舍里·索额图'],
      era: '康熙', dynasty: '清', role: 'corrupt',
      title: '一等公·议政大臣', officialTitle: '内大臣·领侍卫内大臣',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 80, military: 50, intelligence: 88,
                    charisma: 75, integrity: 35, benevolence: 50,
                    diplomacy: 88, scholarship: 75, finance: 75, cunning: 92 },
      loyalty: 50, ambition: 95,
      traits: ['scheming','greedy','clever','luxurious'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 2000000, fame: -30, virtueMerit: 300, virtueStage: 3
      },
      integrity: 40,
      background: '满洲正黄旗·赫舍里氏·索尼三子·助康熙擒鳌拜·尼布楚定约·后牵涉太子事下狱饿死。',
      famousQuote: '',
      historicalFate: '康熙四十二年坐太子事下狱·饿死宗人府',
      fateHint: 'forcedDeath'
    },

    mingZhu: {
      id: 'mingZhu', name: '明珠', zi: '端范',
      birthYear: 1635, deathYear: 1708, alternateNames: ['纳兰明珠'],
      era: '康熙', dynasty: '清', role: 'corrupt',
      title: '武英殿大学士', officialTitle: '武英殿大学士',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 82, military: 50, intelligence: 90,
                    charisma: 85, integrity: 40, benevolence: 55,
                    diplomacy: 88, scholarship: 80, finance: 80, cunning: 92 },
      loyalty: 70, ambition: 92,
      traits: ['scheming','clever','flatterer','luxurious'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 1500000, fame: -20, virtueMerit: 350, virtueStage: 3
      },
      integrity: 45,
      background: '满洲正黄旗·叶赫那拉氏·纳兰性德父·相位二十余年·与索额图明索之争·康熙朝二十七年罢相。',
      famousQuote: '',
      historicalFate: '康熙四十七年病殁·明氏家道中落',
      fateHint: 'peacefulDeath'
    },

    fukangAn: {
      id: 'fukangAn', name: '福康安', zi: '瑶林',
      birthYear: 1754, deathYear: 1796, alternateNames: ['嘉勇忠锐贝子','文襄'],
      era: '乾嘉', dynasty: '清', role: 'military',
      title: '嘉勇忠锐贝子', officialTitle: '武英殿大学士·两广总督',
      rankLevel: 30, socialClass: 'imperial', department: 'military',
      abilities: { governance: 75, military: 92, intelligence: 85,
                    charisma: 80, integrity: 65, benevolence: 65,
                    diplomacy: 75, scholarship: 70, finance: 70, cunning: 80 },
      loyalty: 90, ambition: 85,
      traits: ['brave','heroic','luxurious','rigorous'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 700, virtueStage: 5
      },
      integrity: 70,
      background: '富察氏·傅恒子·乾隆传为私生子·平台湾林爽文·廓尔喀·乾隆十全武功之核心执行者。',
      famousQuote: '',
      historicalFate: '嘉庆元年病殁军中',
      fateHint: 'peacefulDeath'
    },

    longKeduo: {
      id: 'longKeduo', name: '隆科多', zi: '',
      birthYear: 1664, deathYear: 1728, alternateNames: ['佟佳·隆科多','舅舅'],
      era: '康雍', dynasty: '清', role: 'regent',
      title: '一等公', officialTitle: '吏部尚书·步军统领',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 78, military: 70, intelligence: 80,
                    charisma: 75, integrity: 50, benevolence: 50,
                    diplomacy: 70, scholarship: 70, finance: 70, cunning: 88 },
      loyalty: 60, ambition: 95,
      traits: ['scheming','ambitious','clever','proud'],
      resources: {
        privateWealth: { money: 3000000, land: 80000, treasure: 8000000, slaves: 1500, commerce: 0 },
        hiddenWealth: 1000000, fame: -10, virtueMerit: 300, virtueStage: 3
      },
      integrity: 55,
      background: '佟佳氏·孝懿仁皇后弟·康熙临终顾命·助雍正即位·后被囚畅春园·四十一款大罪饥死。',
      famousQuote: '',
      historicalFate: '雍正六年囚畅春园饥渴而亡',
      fateHint: 'imprisonment'
    },

    yinXiang: {
      id: 'yinXiang', name: '胤祥', zi: '',
      birthYear: 1686, deathYear: 1730, alternateNames: ['怡亲王','贤'],
      era: '康雍', dynasty: '清', role: 'loyal',
      title: '怡亲王', officialTitle: '总理事务大臣',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 92, military: 70, intelligence: 92,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 85, scholarship: 80, finance: 92, cunning: 75 },
      loyalty: 100, ambition: 60,
      traits: ['brilliant','loyal','rigorous','heroic'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '康熙十三子·雍正同母弟·清初铁帽子王第九·辅雍正改革·治河·疏浚·雍正最敬之兄弟。',
      famousQuote: '',
      historicalFate: '雍正八年积劳病殁·配享太庙',
      fateHint: 'peacefulDeath'
    },

    tanSitong: {
      id: 'tanSitong', name: '谭嗣同', zi: '复生',
      birthYear: 1865, deathYear: 1898, alternateNames: ['壮飞','华相众生'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '军机章京', officialTitle: '四品衔军机章京',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 50, intelligence: 92,
                    charisma: 92, integrity: 100, benevolence: 90,
                    diplomacy: 60, scholarship: 100, finance: 60, cunning: 65 },
      loyalty: 100, ambition: 88,
      traits: ['heroic','idealist','literary','reformist'],
      resources: {
        privateWealth: { money: 200000, land: 2000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '湖南浏阳人·戊戌六君子之首·撰《仁学》·力主变法·政变后不走·我自横刀向天笑。',
      famousQuote: '我自横刀向天笑·去留肝胆两昆仑。',
      historicalFate: '光绪二十四年菜市口就义·年仅三十三',
      fateHint: 'martyrdom'
    },

    kangYouwei: {
      id: 'kangYouwei', name: '康有为', zi: '广厦',
      birthYear: 1858, deathYear: 1927, alternateNames: ['长素','南海先生'],
      era: '光绪宣统民初', dynasty: '清', role: 'reformer',
      title: '工部主事', officialTitle: '工部主事',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 92,
                    charisma: 92, integrity: 60, benevolence: 70,
                    diplomacy: 78, scholarship: 100, finance: 70, cunning: 80 },
      loyalty: 60, ambition: 100,
      traits: ['scholarly','idealist','reformist','vain'],
      resources: {
        privateWealth: { money: 800000, land: 5000, treasure: 1500000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 65,
      background: '广东南海人·公车上书·万木草堂·主导戊戌变法·政变后流亡·后期保皇·与孙中山殊途。',
      famousQuote: '物之新者壮丽·旧者老蠹。',
      historicalFate: '民国十六年食物中毒殁青岛',
      fateHint: 'peacefulDeath'
    },

    liangQichao: {
      id: 'liangQichao', name: '梁启超', zi: '卓如',
      birthYear: 1873, deathYear: 1929, alternateNames: ['任公','饮冰室主人'],
      era: '光绪宣统民初', dynasty: '清', role: 'reformer',
      title: '司法总长', officialTitle: '财政总长',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 25, intelligence: 95,
                    charisma: 95, integrity: 85, benevolence: 85,
                    diplomacy: 88, scholarship: 100, finance: 78, cunning: 85 },
      loyalty: 80, ambition: 88,
      traits: ['literary','scholarly','reformist','idealist'],
      resources: {
        privateWealth: { money: 800000, land: 5000, treasure: 1500000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 880, virtueStage: 6
      },
      integrity: 85,
      background: '广东新会人·康有为弟子·戊戌六君子之一·后倒袁护国·清华国学院四大导师·影响一代。',
      famousQuote: '少年强则国强·少年富则国富。',
      historicalFate: '民国十八年病殁北京·五十六岁',
      fateHint: 'peacefulDeath'
    },

    yanFu: {
      id: 'yanFu', name: '严复', zi: '又陵',
      birthYear: 1854, deathYear: 1921, alternateNames: ['几道','严宗光'],
      era: '光绪宣统民初', dynasty: '清', role: 'scholar',
      title: '京师大学堂总监督', officialTitle: '京师大学堂总监督',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 50, intelligence: 95,
                    charisma: 80, integrity: 88, benevolence: 80,
                    diplomacy: 75, scholarship: 100, finance: 60, cunning: 70 },
      loyalty: 80, ambition: 65,
      traits: ['scholarly','reformist','idealist','sage'],
      resources: {
        privateWealth: { money: 200000, land: 2000, treasure: 100000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 88,
      background: '福建侯官人·北洋水师学堂·译《天演论》《国富论》·物竞天择·中国近代启蒙思想第一人。',
      famousQuote: '物竞天择·适者生存。',
      historicalFate: '民国十年病殁福州',
      fateHint: 'peacefulDeath'
    },

    qianQianyi: {
      id: 'qianQianyi', name: '钱谦益', zi: '受之',
      birthYear: 1582, deathYear: 1664, alternateNames: ['牧斋','蒙叟','虞山宗伯'],
      era: '明末清初', dynasty: '明', role: 'usurper',
      title: '礼部尚书', officialTitle: '礼部尚书',
      rankLevel: 24, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 25, intelligence: 92,
                    charisma: 88, integrity: 35, benevolence: 60,
                    diplomacy: 80, scholarship: 100, finance: 70, cunning: 80 },
      loyalty: 35, ambition: 80,
      traits: ['literary','scholarly','flatterer','luxurious'],
      resources: {
        privateWealth: { money: 1000000, land: 10000, treasure: 2000000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: -30, virtueMerit: 200, virtueStage: 2
      },
      integrity: 40,
      background: '常熟人·明末文宗·东林党魁·南明礼部·清军南下率众降·水太凉·柳如是欲投水死之·乾隆列贰臣传。',
      famousQuote: '水太凉·头皮痒。',
      historicalFate: '康熙三年病殁',
      fateHint: 'peacefulDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-06] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
