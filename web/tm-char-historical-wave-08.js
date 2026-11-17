// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-08.js
// Domain: NPC / 历史人物 data
// 来源·波 8
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
    zilu: {
      id: 'zilu', name: '仲由', zi: '子路',
      birthYear: -542, deathYear: -480, alternateNames: ['季路','卫太子'],
      era: '春秋', dynasty: '鲁', role: 'loyal',
      title: '蒲邑大夫', officialTitle: '卫国孔氏家宰',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 75, military: 78, intelligence: 75,
                    charisma: 80, integrity: 95, benevolence: 75,
                    diplomacy: 60, scholarship: 80, finance: 55, cunning: 60 },
      loyalty: 100, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 100,
      background: '卞人·孔门十哲·勇猛直率·孔子曰由也好勇过我·任卫孔氏家宰·卫乱中身殉。',
      famousQuote: '君子死·冠不免。',
      historicalFate: '鲁哀公十五年卫乱·结缨而死',
      fateHint: 'martyrdom'
    },

    zengzi: {
      id: 'zengzi', name: '曾参', zi: '子舆',
      birthYear: -505, deathYear: -435, alternateNames: ['宗圣','曾子'],
      era: '春秋末', dynasty: '鲁', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 70, military: 25, intelligence: 92,
                    charisma: 78, integrity: 100, benevolence: 95,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 50 },
      loyalty: 90, ambition: 30,
      traits: ['scholarly','sage','rigorous','idealist'],
      resources: {
        privateWealth: { money: 10000, land: 100, treasure: 3000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '南武城人·孔门后期高足·撰《大学》《孝经》·三省吾身·开宗圣一脉·教孔伋(子思)。',
      famousQuote: '吾日三省吾身。',
      historicalFate: '终于本籍·寿七十',
      fateHint: 'peacefulDeath'
    },

    shenBuhai: {
      id: 'shenBuhai', name: '申不害', zi: '',
      birthYear: -385, deathYear: -337, alternateNames: ['申子'],
      era: '战国', dynasty: '韩', role: 'reformer',
      title: '韩相', officialTitle: '相国',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 95,
                    charisma: 70, integrity: 75, benevolence: 50,
                    diplomacy: 65, scholarship: 92, finance: 75, cunning: 92 },
      loyalty: 90, ambition: 75,
      traits: ['brilliant','rigorous','reformist','scheming'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '郑国京邑人·法家术派·相韩昭侯十五年·内修政教外应诸侯·韩国一时强盛。',
      famousQuote: '为君之道·术也。',
      historicalFate: '韩昭侯二十二年病殁',
      fateHint: 'peacefulDeath'
    },

    zouyan: {
      id: 'zouyan', name: '邹衍', zi: '',
      birthYear: -305, deathYear: -240, alternateNames: ['谈天衍'],
      era: '战国', dynasty: '齐', role: 'scholar',
      title: '客卿', officialTitle: '稷下先生',
      rankLevel: 18, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 65, military: 25, intelligence: 95,
                    charisma: 88, integrity: 78, benevolence: 70,
                    diplomacy: 75, scholarship: 100, finance: 50, cunning: 65 },
      loyalty: 70, ambition: 60,
      traits: ['scholarly','sage','literary','clever'],
      resources: {
        privateWealth: { money: 100000, land: 1000, treasure: 50000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 80,
      background: '齐国临淄人·阴阳家代表·五德终始论·大九州说·游历六国·六月飞霜典出此。',
      famousQuote: '深观阴阳消息·而作怪迂之变。',
      historicalFate: '终于燕·一说被燕惠王下狱',
      fateHint: 'exileDeath'
    },

    xiangliang: {
      id: 'xiangliang', name: '项梁', zi: '',
      birthYear: -270, deathYear: -208, alternateNames: ['楚上柱国','武信君'],
      era: '秦末', dynasty: '楚', role: 'usurper',
      title: '武信君', officialTitle: '上柱国',
      rankLevel: 28, socialClass: 'noble', department: 'military',
      abilities: { governance: 75, military: 88, intelligence: 88,
                    charisma: 88, integrity: 80, benevolence: 75,
                    diplomacy: 80, scholarship: 75, finance: 70, cunning: 85 },
      loyalty: 70, ambition: 90,
      traits: ['brilliant','heroic','ambitious','patient'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 80,
      background: '下相人·项燕子·项羽叔父·避仇会稽·杀殷通起兵·立楚怀王·定陶轻敌战死。',
      famousQuote: '彼可取而代也。',
      historicalFate: '秦二世二年定陶之战中章邯偷袭·战死',
      fateHint: 'martyrdom'
    },

    pengyue: {
      id: 'pengyue', name: '彭越', zi: '仲',
      birthYear: -270, deathYear: -196, alternateNames: ['梁王'],
      era: '汉初', dynasty: '西汉', role: 'military',
      title: '梁王', officialTitle: '梁王',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 90, intelligence: 80,
                    charisma: 78, integrity: 75, benevolence: 65,
                    diplomacy: 60, scholarship: 50, finance: 60, cunning: 75 },
      loyalty: 75, ambition: 85,
      traits: ['brave','heroic','ambitious','rigorous'],
      resources: {
        privateWealth: { money: 1500000, land: 50000, treasure: 3000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 75,
      background: '昌邑人·渔者起家·游击战之祖·楚汉相持中扰项羽后方·汉初三大将之一·后被诬谋反诛。',
      famousQuote: '',
      historicalFate: '汉十一年被吕后诱杀·剁醢分赐诸侯',
      fateHint: 'executionByClanDestruction'
    },

    yingbu: {
      id: 'yingbu', name: '英布', zi: '',
      birthYear: -240, deathYear: -195, alternateNames: ['黥布','九江王','淮南王'],
      era: '秦末汉初', dynasty: '西汉', role: 'military',
      title: '淮南王', officialTitle: '淮南王',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 75,
                    charisma: 80, integrity: 65, benevolence: 60,
                    diplomacy: 55, scholarship: 40, finance: 60, cunning: 75 },
      loyalty: 50, ambition: 90,
      traits: ['brave','heroic','ruthless','ambitious'],
      resources: {
        privateWealth: { money: 1500000, land: 50000, treasure: 3000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 0, fame: 60, virtueMerit: 400, virtueStage: 4
      },
      integrity: 65,
      background: '六县人·秦末因罪受黥刑得名·先项后汉·汉初三大将之一·后造反兵败被杀。',
      famousQuote: '',
      historicalFate: '汉十一年起兵反汉·兵败被长沙王所诱杀',
      fateHint: 'execution'
    },

    zhangtang: {
      id: 'zhangtang', name: '张汤', zi: '',
      birthYear: -160, deathYear: -116, alternateNames: [],
      era: '武帝朝', dynasty: '西汉', role: 'corrupt',
      title: '御史大夫', officialTitle: '御史大夫',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 92,
                    charisma: 65, integrity: 60, benevolence: 35,
                    diplomacy: 65, scholarship: 80, finance: 80, cunning: 95 },
      loyalty: 88, ambition: 88,
      traits: ['rigorous','ruthless','scheming','clever'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 30, virtueMerit: 350, virtueStage: 3
      },
      integrity: 60,
      background: '杜陵人·武帝朝酷吏代表·治淮南衡山案·定见知故纵法·三千万家产·后被构陷自杀。',
      famousQuote: '审讯当极尽其辞。',
      historicalFate: '元鼎二年遭三长史构陷·自杀',
      fateHint: 'forcedDeath'
    },

    huangba: {
      id: 'huangba', name: '黄霸', zi: '次公',
      birthYear: -130, deathYear: -51, alternateNames: ['建成定侯'],
      era: '昭宣朝', dynasty: '西汉', role: 'clean',
      title: '建成侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 30, intelligence: 88,
                    charisma: 85, integrity: 95, benevolence: 95,
                    diplomacy: 70, scholarship: 88, finance: 88, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['benevolent','rigorous','sage','patient'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '淮阳阳夏人·循吏第一·颍川太守八年·治民有方·宣帝朝拜相·西汉三贤太守之首。',
      famousQuote: '为政贵在安民·勿贵苛察。',
      historicalFate: '甘露三年丞相任上殁',
      fateHint: 'peacefulDeath'
    },

    wangchong: {
      id: 'wangchong', name: '王充', zi: '仲任',
      birthYear: 27, deathYear: 97, alternateNames: ['论衡'],
      era: '东汉', dynasty: '东汉', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 25, intelligence: 95,
                    charisma: 70, integrity: 92, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 60 },
      loyalty: 75, ambition: 50,
      traits: ['scholarly','sage','reclusive','idealist'],
      resources: {
        privateWealth: { money: 5000, land: 50, treasure: 1000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '会稽上虞人·撰《论衡》八十五篇·疾虚妄·破天人感应·东汉朴素唯物主义思想家。',
      famousQuote: '事有证验·以效实然。',
      historicalFate: '永元末病殁',
      fateHint: 'retirement'
    },

    luzhi: {
      id: 'luzhi', name: '卢植', zi: '子干',
      birthYear: 139, deathYear: 192, alternateNames: ['卢中郎'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '尚书', officialTitle: '尚书·北中郎将',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 80, intelligence: 90,
                    charisma: 80, integrity: 95, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 60, cunning: 70 },
      loyalty: 100, ambition: 65,
      traits: ['scholarly','heroic','upright','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 100,
      background: '涿郡涿人·郑玄同门·刘备公孙瓒老师·讨黄巾·谏阻董卓废立·隐居上谷而终。',
      famousQuote: '此天下大事·岂可家天下。',
      historicalFate: '初平三年隐居上谷·岁余病殁',
      fateHint: 'retirement'
    },

    xuhuang: {
      id: 'xuhuang', name: '徐晃', zi: '公明',
      birthYear: 169, deathYear: 227, alternateNames: ['阳平侯','壮'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '阳平侯', officialTitle: '右将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 92, intelligence: 80,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 50, scholarship: 60, finance: 55, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['brave','rigorous','heroic','loyal'],
      resources: {
        privateWealth: { money: 400000, land: 8000, treasure: 600000, slaves: 150, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '河东杨人·原杨奉部·归曹·治军严整·樊城解围破关羽·五子良将之周亚夫风。',
      famousQuote: '魏武治军·殆不及周亚夫·徐晃乃当之。',
      historicalFate: '太和元年病殁',
      fateHint: 'peacefulDeath'
    },

    yujin: {
      id: 'yujin', name: '于禁', zi: '文则',
      birthYear: 152, deathYear: 221, alternateNames: ['益寿亭侯','厉'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '益寿亭侯', officialTitle: '左将军',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 68, military: 88, intelligence: 78,
                    charisma: 75, integrity: 70, benevolence: 60,
                    diplomacy: 50, scholarship: 50, finance: 55, cunning: 70 },
      loyalty: 78, ambition: 65,
      traits: ['rigorous','brave','heroic','clever'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 70,
      background: '泰山钜平人·五子良将·治军最严·樊城败于关羽水淹七军被俘降·后归魏·惭恚而死。',
      famousQuote: '',
      historicalFate: '黄初二年遭曹丕羞辱·惭愤而亡',
      fateHint: 'forcedDeath'
    },

    xiahouYuan: {
      id: 'xiahouYuan', name: '夏侯渊', zi: '妙才',
      birthYear: 156, deathYear: 219, alternateNames: ['博昌亭侯','愍'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '博昌亭侯', officialTitle: '征西将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 75,
                    charisma: 78, integrity: 88, benevolence: 70,
                    diplomacy: 50, scholarship: 50, finance: 55, cunning: 70 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 82, virtueMerit: 750, virtueStage: 5
      },
      integrity: 88,
      background: '沛国谯人·夏侯惇族弟·虎步关右·定凉州·镇汉中·定军山被黄忠斩于阵前。',
      famousQuote: '为将当有怯弱时·不可但任勇也。',
      historicalFate: '建安二十四年定军山阵亡',
      fateHint: 'martyrdom'
    },

    fazheng: {
      id: 'fazheng', name: '法正', zi: '孝直',
      birthYear: 176, deathYear: 220, alternateNames: ['翼侯'],
      era: '三国初', dynasty: '蜀汉', role: 'scholar',
      title: '翼侯', officialTitle: '尚书令·护军将军',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 80, intelligence: 95,
                    charisma: 75, integrity: 70, benevolence: 60,
                    diplomacy: 75, scholarship: 88, finance: 65, cunning: 95 },
      loyalty: 90, ambition: 80,
      traits: ['brilliant','clever','scheming','heroic'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 650, virtueStage: 5
      },
      integrity: 72,
      background: '右扶风郿人·原刘璋部·暗助刘备入川·汉中之战定军山策斩夏侯渊·诸葛亮叹其谋。',
      famousQuote: '主公不知·北面有曹操·东面有孙权。',
      historicalFate: '章武元年病殁·年仅四十五',
      fateHint: 'peacefulDeath'
    },

    huantemp: {
      id: 'huantemp', name: '桓温', zi: '元子',
      birthYear: 312, deathYear: 373, alternateNames: ['桓宣武','南郡公'],
      era: '东晋', dynasty: '东晋', role: 'usurper',
      title: '南郡公', officialTitle: '大司马·都督中外诸军事',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 88, military: 92, intelligence: 90,
                    charisma: 90, integrity: 60, benevolence: 65,
                    diplomacy: 80, scholarship: 88, finance: 75, cunning: 92 },
      loyalty: 40, ambition: 100,
      traits: ['brilliant','heroic','ambitious','proud'],
      resources: {
        privateWealth: { money: 8000000, land: 200000, treasure: 20000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 65,
      background: '谯国龙亢人·灭成汉·三北伐·三度攻关中·废海西公立简文帝·欲行篡而未及殁。',
      famousQuote: '不能流芳百世·亦当遗臭万年。',
      historicalFate: '宁康元年病殁·未及篡位',
      fateHint: 'peacefulDeath'
    },

    liukun: {
      id: 'liukun', name: '刘琨', zi: '越石',
      birthYear: 271, deathYear: 318, alternateNames: ['刘并州','愍'],
      era: '西晋东晋', dynasty: '西晋', role: 'loyal',
      title: '广武侯', officialTitle: '司空·并州刺史',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 75, military: 88, intelligence: 88,
                    charisma: 92, integrity: 92, benevolence: 80,
                    diplomacy: 80, scholarship: 100, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 80,
      traits: ['heroic','loyal','literary','idealist'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '中山魏昌人·闻鸡起舞与祖逖·镇晋阳孤城九年·清啸退胡骑·后被段匹磾忌而缢杀。',
      famousQuote: '吾枕戈待旦·志枭逆虏。',
      historicalFate: '太兴元年遭段匹磾构陷缢杀',
      fateHint: 'forcedDeath'
    },

    fujian: {
      id: 'fujian', name: '苻坚', zi: '永固',
      birthYear: 338, deathYear: 385, alternateNames: ['前秦宣昭帝'],
      era: '前秦', dynasty: '前秦', role: 'usurper',
      title: '大秦天王', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 92, military: 88, intelligence: 88,
                    charisma: 92, integrity: 85, benevolence: 92,
                    diplomacy: 88, scholarship: 88, finance: 80, cunning: 78 },
      loyalty: 60, ambition: 95,
      traits: ['benevolent','heroic','idealist','sage'],
      resources: {
        privateWealth: { money: 80000000, land: 3000000, treasure: 200000000, slaves: 100000, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '略阳临渭氐人·王猛辅政·一统北方·南下淝水之战大败·部众瓦解·后被姚苌缢杀新平。',
      famousQuote: '我以汉人胡人皆陛下之赤子。',
      historicalFate: '太元十年被姚苌缢杀新平',
      fateHint: 'forcedDeath'
    },

    lanlingWang: {
      id: 'lanlingWang', name: '高长恭', zi: '',
      birthYear: 541, deathYear: 573, alternateNames: ['兰陵王','高肃','武'],
      era: '北齐', dynasty: '北齐', role: 'military',
      title: '兰陵王', officialTitle: '大司马·并州刺史',
      rankLevel: 28, socialClass: 'imperial', department: 'military',
      abilities: { governance: 75, military: 92, intelligence: 80,
                    charisma: 95, integrity: 95, benevolence: 88,
                    diplomacy: 65, scholarship: 78, finance: 60, cunning: 70 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','loyal','sage'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 95,
      background: '高欢孙·貌柔心壮·阵戴狰狞面具·邙山之战入周军救金墉·后主忌·赐鸩而死。',
      famousQuote: '家事亲切·不觉遂然。',
      historicalFate: '武平四年被后主鸩杀',
      fateHint: 'forcedDeath'
    },

    suwei: {
      id: 'suwei', name: '苏威', zi: '无畏',
      birthYear: 542, deathYear: 623, alternateNames: ['房城公'],
      era: '隋', dynasty: '隋', role: 'regent',
      title: '房城公', officialTitle: '尚书右仆射',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 90, military: 50, intelligence: 90,
                    charisma: 80, integrity: 78, benevolence: 70,
                    diplomacy: 80, scholarship: 92, finance: 88, cunning: 78 },
      loyalty: 80, ambition: 75,
      traits: ['scholarly','rigorous','patient','reformist'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 80,
      background: '京兆武功人·苏绰子·辅杨坚·隋开皇之治四相之一·历仕隋唐·终于唐。',
      famousQuote: '治天下·恤民为先。',
      historicalFate: '武德六年终于唐',
      fateHint: 'peacefulDeath'
    },

    heRoubi: {
      id: 'heRoubi', name: '贺若弼', zi: '辅伯',
      birthYear: 544, deathYear: 607, alternateNames: ['宋国公'],
      era: '隋', dynasty: '隋', role: 'military',
      title: '宋国公', officialTitle: '右领军大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 80,
                    charisma: 75, integrity: 75, benevolence: 65,
                    diplomacy: 55, scholarship: 60, finance: 55, cunning: 75 },
      loyalty: 80, ambition: 88,
      traits: ['brave','heroic','proud','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 78,
      background: '河南洛阳人·灭陈先锋·与韩擒虎争功二十年·炀帝即位以诽谤朝政诛。',
      famousQuote: '臣若先言·则得行人之名。',
      historicalFate: '大业三年诽谤朝政被斩',
      fateHint: 'execution'
    },

    zhangshuo: {
      id: 'zhangshuo', name: '张说', zi: '道济',
      birthYear: 667, deathYear: 730, alternateNames: ['燕国公','文贞'],
      era: '武则天-玄宗', dynasty: '唐', role: 'scholar',
      title: '燕国公', officialTitle: '中书令',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 70, intelligence: 92,
                    charisma: 85, integrity: 78, benevolence: 75,
                    diplomacy: 88, scholarship: 100, finance: 75, cunning: 88 },
      loyalty: 90, ambition: 80,
      traits: ['brilliant','literary','reformist','clever'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 78,
      background: '河南洛阳人·开元前期文宗·三度拜相·玄宗东封泰山立功·改府兵为彍骑。',
      famousQuote: '人生百年·成败由己。',
      historicalFate: '开元十八年病殁',
      fateHint: 'peacefulDeath'
    },

    yangGuozhong: {
      id: 'yangGuozhong', name: '杨国忠', zi: '',
      birthYear: 711, deathYear: 756, alternateNames: ['杨钊'],
      era: '玄宗朝', dynasty: '唐', role: 'corrupt',
      title: '魏国公', officialTitle: '右相·吏部尚书',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 60, military: 30, intelligence: 75,
                    charisma: 78, integrity: 15, benevolence: 25,
                    diplomacy: 65, scholarship: 60, finance: 75, cunning: 90 },
      loyalty: 30, ambition: 100,
      traits: ['scheming','greedy','flatterer','vain'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 30000000, slaves: 5000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -85, virtueMerit: 50, virtueStage: 1
      },
      integrity: 15,
      background: '蒲州永乐人·杨贵妃族兄·继李林甫为相·身兼四十余职·激化与安禄山矛盾·马嵬被乱军所杀。',
      famousQuote: '',
      historicalFate: '至德元载马嵬驿乱军所杀',
      fateHint: 'execution'
    },

    shiSiming: {
      id: 'shiSiming', name: '史思明', zi: '',
      birthYear: 703, deathYear: 761, alternateNames: ['史窣干','燕昭武皇帝'],
      era: '玄肃朝', dynasty: '唐', role: 'usurper',
      title: '大燕皇帝', officialTitle: '燕皇帝',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 90, intelligence: 80,
                    charisma: 78, integrity: 25, benevolence: 30,
                    diplomacy: 70, scholarship: 50, finance: 70, cunning: 88 },
      loyalty: 15, ambition: 100,
      traits: ['ruthless','scheming','ambitious','brave'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 30000000, slaves: 8000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -90, virtueMerit: 50, virtueStage: 1
      },
      integrity: 20,
      background: '宁夷州突厥人·安禄山旧部·继安庆绪称燕帝·邺城之围解·后被亲子史朝义所杀。',
      famousQuote: '',
      historicalFate: '上元二年被亲子史朝义所杀',
      fateHint: 'forcedDeath'
    },

    dingwei: {
      id: 'dingwei', name: '丁谓', zi: '谓之',
      birthYear: 966, deathYear: 1037, alternateNames: ['晋国公'],
      era: '真宗仁宗', dynasty: '北宋', role: 'corrupt',
      title: '晋国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 30, intelligence: 92,
                    charisma: 70, integrity: 25, benevolence: 35,
                    diplomacy: 75, scholarship: 88, finance: 78, cunning: 95 },
      loyalty: 50, ambition: 95,
      traits: ['scheming','flatterer','clever','ambitious'],
      resources: {
        privateWealth: { money: 2000000, land: 50000, treasure: 5000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 500000, fame: -65, virtueMerit: 200, virtueStage: 2
      },
      integrity: 30,
      background: '苏州长洲人·五鬼之一·王钦若党·辅真宗·拍马奉迎·迎合天书·罢寇准·罢相贬崖州。',
      famousQuote: '',
      historicalFate: '景祐四年贬光州·途中殁',
      fateHint: 'exileDeath'
    },

    lvHuiqing: {
      id: 'lvHuiqing', name: '吕惠卿', zi: '吉甫',
      birthYear: 1032, deathYear: 1111, alternateNames: ['平章军国'],
      era: '神哲徽朝', dynasty: '北宋', role: 'reformer',
      title: '建宁军节度使', officialTitle: '同中书门下平章事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 50, intelligence: 92,
                    charisma: 70, integrity: 50, benevolence: 50,
                    diplomacy: 75, scholarship: 92, finance: 78, cunning: 92 },
      loyalty: 70, ambition: 92,
      traits: ['brilliant','scheming','reformist','ambitious'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 200000, fame: -30, virtueMerit: 350, virtueStage: 3
      },
      integrity: 55,
      background: '泉州晋江人·王安石新法主要执行者·王走后篡党·有福建子之讥·新党第二代领袖。',
      famousQuote: '',
      historicalFate: '政和元年病殁',
      fateHint: 'peacefulDeath'
    },

    wangdan: {
      id: 'wangdan', name: '王旦', zi: '子明',
      birthYear: 957, deathYear: 1017, alternateNames: ['魏国公','文正'],
      era: '真宗朝', dynasty: '北宋', role: 'regent',
      title: '魏国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92,
                    charisma: 88, integrity: 95, benevolence: 90,
                    diplomacy: 88, scholarship: 92, finance: 80, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['rigorous','sage','patient','benevolent'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 920, virtueStage: 6
      },
      integrity: 95,
      background: '大名莘县人·真宗朝相十二年·宽厚镇朝·与寇准并称·一身廉静而功在朝廷。',
      famousQuote: '事君诚直·不计利害。',
      historicalFate: '天禧元年病殁',
      fateHint: 'peacefulDeath'
    },

    huangGongwang: {
      id: 'huangGongwang', name: '黄公望', zi: '子久',
      birthYear: 1269, deathYear: 1354, alternateNames: ['大痴道人','一峰道人'],
      era: '元', dynasty: '元', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 35, military: 25, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 50 },
      loyalty: 70, ambition: 30,
      traits: ['literary','reclusive','sage','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '常熟人·元四家之首·撰《富春山居图》·五十而入道家·中国山水画里程碑。',
      famousQuote: '画不过意思而已。',
      historicalFate: '至正十四年寿终',
      fateHint: 'retirement'
    },

    nizan: {
      id: 'nizan', name: '倪瓒', zi: '元镇',
      birthYear: 1301, deathYear: 1374, alternateNames: ['云林子','幻霞子','迂'],
      era: '元末明初', dynasty: '元', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 30, military: 20, intelligence: 92,
                    charisma: 75, integrity: 92, benevolence: 70,
                    diplomacy: 45, scholarship: 100, finance: 75, cunning: 50 },
      loyalty: 65, ambition: 25,
      traits: ['literary','reclusive','vain','luxurious'],
      resources: {
        privateWealth: { money: 800000, land: 5000, treasure: 1500000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '无锡人·元四家之一·散家财·扁舟泛太湖二十年·洁癖·画风萧疏简远。',
      famousQuote: '画者·写胸中逸气耳。',
      historicalFate: '洪武七年病殁',
      fateHint: 'retirement'
    },

    zhangCong: {
      id: 'zhangCong', name: '张璁', zi: '秉用',
      birthYear: 1475, deathYear: 1539, alternateNames: ['罗峰','张孚敬','文忠'],
      era: '嘉靖', dynasty: '明', role: 'reformer',
      title: '太师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 30, intelligence: 92,
                    charisma: 75, integrity: 75, benevolence: 65,
                    diplomacy: 70, scholarship: 92, finance: 80, cunning: 92 },
      loyalty: 92, ambition: 88,
      traits: ['brilliant','reformist','rigorous','ambitious'],
      resources: {
        privateWealth: { money: 1000000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 60, virtueMerit: 600, virtueStage: 5
      },
      integrity: 78,
      background: '永嘉人·大礼议核心人物·助嘉靖追尊兴献王·清查皇庄勋贵田·改革宦官·张居正改革之先声。',
      famousQuote: '为政之道·先立其本。',
      historicalFate: '嘉靖十八年病殁·告老归乡',
      fateHint: 'retirement'
    },

    xiayan: {
      id: 'xiayan', name: '夏言', zi: '公谨',
      birthYear: 1482, deathYear: 1548, alternateNames: ['桂洲','文愍'],
      era: '嘉靖', dynasty: '明', role: 'loyal',
      title: '少师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 60, intelligence: 88,
                    charisma: 82, integrity: 88, benevolence: 75,
                    diplomacy: 75, scholarship: 92, finance: 75, cunning: 80 },
      loyalty: 95, ambition: 85,
      traits: ['brilliant','heroic','rigorous','proud'],
      resources: {
        privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '贵溪人·嘉靖朝首辅·主收复河套·与严嵩政争·终被严嵩构陷弃市·明朝唯一斩首首辅。',
      famousQuote: '河套不复·则边患难安。',
      historicalFate: '嘉靖二十七年遭严嵩构陷弃市',
      fateHint: 'executionByFraming'
    },

    yangTinghe: {
      id: 'yangTinghe', name: '杨廷和', zi: '介夫',
      birthYear: 1459, deathYear: 1529, alternateNames: ['石斋','文忠'],
      era: '武宗嘉靖初', dynasty: '明', role: 'regent',
      title: '太子太师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 85,
                    diplomacy: 88, scholarship: 100, finance: 80, cunning: 88 },
      loyalty: 95, ambition: 75,
      traits: ['brilliant','scholarly','rigorous','heroic'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 400, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '新都人·杨慎父·武宗死后定策迎兴献王子嗣帝位·主裁革武宗弊政·大礼议失败致仕。',
      famousQuote: '殿下当奉天命·继统继嗣。',
      historicalFate: '嘉靖八年病殁·后被夺爵',
      fateHint: 'forcedDeath'
    },

    yangrong: {
      id: 'yangrong', name: '杨荣', zi: '勉仁',
      birthYear: 1371, deathYear: 1440, alternateNames: ['东杨','文敏'],
      era: '永乐-正统', dynasty: '明', role: 'scholar',
      title: '少师', officialTitle: '内阁首辅·工部尚书',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 70, intelligence: 92,
                    charisma: 82, integrity: 80, benevolence: 75,
                    diplomacy: 88, scholarship: 95, finance: 78, cunning: 88 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','clever','heroic','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 400, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 82,
      background: '建安人·三杨之东杨·主谋·永乐五次北征皆从行·主导仁宣之治·内阁制完善之三杨之一。',
      famousQuote: '处事必当慎之。',
      historicalFate: '正统五年病殁',
      fateHint: 'peacefulDeath'
    },

    yangpu: {
      id: 'yangpu', name: '杨溥', zi: '弘济',
      birthYear: 1372, deathYear: 1446, alternateNames: ['南杨','文定'],
      era: '永乐-正统', dynasty: '明', role: 'scholar',
      title: '少保', officialTitle: '内阁首辅',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 30, intelligence: 88,
                    charisma: 75, integrity: 95, benevolence: 80,
                    diplomacy: 70, scholarship: 92, finance: 70, cunning: 70 },
      loyalty: 95, ambition: 65,
      traits: ['rigorous','scholarly','patient','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6
      },
      integrity: 95,
      background: '石首人·三杨之南杨·辅太子·下狱十年·释而辅成祖·仁宣之治·终为首辅·年老土木之变前殁。',
      famousQuote: '吾在位日浅·愿吾去后·朝廷得人。',
      historicalFate: '正统十一年病殁',
      fateHint: 'peacefulDeath'
    },

    xiongTingbi: {
      id: 'xiongTingbi', name: '熊廷弼', zi: '飞百',
      birthYear: 1569, deathYear: 1625, alternateNames: ['芝冈','襄愍'],
      era: '万历天启', dynasty: '明', role: 'military',
      title: '兵部尚书', officialTitle: '辽东经略',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 80, military: 92, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 65, scholarship: 88, finance: 70, cunning: 80 },
      loyalty: 95, ambition: 80,
      traits: ['brave','heroic','rigorous','proud'],
      resources: {
        privateWealth: { money: 100000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '湖广江夏人·两次经略辽东·三方布置策·与王化贞不和·广宁之败被诛传首九边。',
      famousQuote: '辽事·成于熊·败于王化贞。',
      historicalFate: '天启五年弃市传首九边',
      fateHint: 'executionByFraming'
    },

    soni: {
      id: 'soni', name: '索尼', zi: '',
      birthYear: 1601, deathYear: 1667, alternateNames: ['赫舍里·索尼'],
      era: '清初', dynasty: '清', role: 'regent',
      title: '一等公', officialTitle: '内大臣·辅政大臣',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 75, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 75,
                    diplomacy: 80, scholarship: 80, finance: 75, cunning: 88 },
      loyalty: 100, ambition: 60,
      traits: ['brilliant','patient','loyal','rigorous'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 750, virtueStage: 5
      },
      integrity: 92,
      background: '满洲正黄旗·赫舍里氏·孙女为康熙首位皇后·顺治四辅臣之首·制衡鳌拜·临终谋议除鳌。',
      famousQuote: '',
      historicalFate: '康熙六年病殁',
      fateHint: 'peacefulDeath'
    },

    tianWenJing: {
      id: 'tianWenJing', name: '田文镜', zi: '抑光',
      birthYear: 1662, deathYear: 1733, alternateNames: ['端肃'],
      era: '雍正', dynasty: '清', role: 'reformer',
      title: '太子太保', officialTitle: '河南山东总督',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 92, military: 30, intelligence: 88,
                    charisma: 70, integrity: 88, benevolence: 65,
                    diplomacy: 65, scholarship: 75, finance: 92, cunning: 85 },
      loyalty: 100, ambition: 80,
      traits: ['rigorous','reformist','heroic','ruthless'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 60, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '汉军正蓝旗·雍正心腹·与李卫鄂尔泰称雍正三大模范·摊丁入亩主推手·治河催赋皆严猛。',
      famousQuote: '为官·宁忍小怨·不损大计。',
      historicalFate: '雍正十年病殁',
      fateHint: 'peacefulDeath'
    },

    fuheng: {
      id: 'fuheng', name: '傅恒', zi: '春和',
      birthYear: 1722, deathYear: 1770, alternateNames: ['一等忠勇公','文忠'],
      era: '乾隆', dynasty: '清', role: 'regent',
      title: '一等忠勇公', officialTitle: '保和殿大学士·军机大臣',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 88, intelligence: 92,
                    charisma: 88, integrity: 90, benevolence: 80,
                    diplomacy: 88, scholarship: 88, finance: 78, cunning: 80 },
      loyalty: 100, ambition: 70,
      traits: ['brilliant','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '富察氏·孝贤纯皇后弟·乾隆朝首辅·平大小金川·征缅甸·配享太庙·福康安父。',
      famousQuote: '',
      historicalFate: '乾隆三十五年征缅归途病殁·年仅四十九',
      fateHint: 'peacefulDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-08] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
