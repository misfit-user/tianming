// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-04.js
// Domain: NPC / 历史人物 data
// 来源·波 4
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
    zichan: {
      id: 'zichan', name: '公孙侨', zi: '子产',
      birthYear: -582, deathYear: -522, alternateNames: ['子美'],
      era: '春秋', dynasty: '郑', role: 'reformer',
      title: '郑国相', officialTitle: '执政',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 65, intelligence: 95,
                    charisma: 80, integrity: 90, benevolence: 88,
                    diplomacy: 92, scholarship: 92, finance: 85, cunning: 85 },
      loyalty: 95, ambition: 60,
      traits: ['rigorous','reformist','sage','scholarly'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '郑国公孙·执政二十二年·铸刑书·改革田制·孔子尊为古之遗爱。',
      famousQuote: '众怒难犯·专欲难成。',
      historicalFate: '鲁昭公二十年病殁',
      fateHint: 'peacefulDeath'
    },

    jieZitui: {
      id: 'jieZitui', name: '介子推', zi: '',
      birthYear: -636, deathYear: -636, alternateNames: ['介之推','介推'],
      era: '春秋', dynasty: '晋', role: 'loyal',
      title: '', officialTitle: '从亡者',
      rankLevel: 8, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 40, intelligence: 75,
                    charisma: 70, integrity: 100, benevolence: 88,
                    diplomacy: 50, scholarship: 60, finance: 40, cunning: 50 },
      loyalty: 100, ambition: 30,
      traits: ['loyal','reclusive','heroic','ascetic'],
      resources: {
        privateWealth: { money: 5000, land: 0, treasure: 0, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 100,
      background: '从晋公子重耳流亡十九年·割股啖君·重耳归国后不言禄·偕母隐绵山。',
      famousQuote: '言·身之文也·身将隐·焉用文之。',
      historicalFate: '晋文公二年绵山火焚·与母俱亡',
      fateHint: 'martyrdom'
    },

    zhuangzi: {
      id: 'zhuangzi', name: '庄周', zi: '子休',
      birthYear: -369, deathYear: -286, alternateNames: ['庄子','南华真人'],
      era: '战国', dynasty: '宋', role: 'scholar',
      title: '漆园吏', officialTitle: '蒙漆园吏',
      rankLevel: 5, socialClass: 'commoner', department: '',
      abilities: { governance: 40, military: 25, intelligence: 100,
                    charisma: 80, integrity: 95, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 30, cunning: 70 },
      loyalty: 50, ambition: 20,
      traits: ['sage','reclusive','literary','scholarly'],
      resources: {
        privateWealth: { money: 5000, land: 50, treasure: 1000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 900, virtueStage: 6
      },
      integrity: 100,
      background: '宋国蒙人·道家集大成者·撰《庄子》三十三篇·楚威王聘相不应·守贫乐道。',
      famousQuote: '相濡以沫，不如相忘于江湖。',
      historicalFate: '终于乡里·寿八十三',
      fateHint: 'retirement'
    },

    hanFei: {
      id: 'hanFei', name: '韩非', zi: '',
      birthYear: -281, deathYear: -233, alternateNames: ['韩非子','韩子'],
      era: '战国末', dynasty: '韩', role: 'scholar',
      title: '韩国公子', officialTitle: '使秦',
      rankLevel: 10, socialClass: 'noble', department: '',
      abilities: { governance: 95, military: 50, intelligence: 100,
                    charisma: 60, integrity: 85, benevolence: 50,
                    diplomacy: 65, scholarship: 100, finance: 70, cunning: 92 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','rigorous','scholarly','idealist'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '韩国公子·荀子弟子·法家集大成者·秦王政欲见不得·使秦遭李斯陷害下狱。',
      famousQuote: '法不阿贵·绳不挠曲。',
      historicalFate: '秦王政十四年下狱·李斯逼饮鸩',
      fateHint: 'forcedDeath'
    },

    mengChangjun: {
      id: 'mengChangjun', name: '田文', zi: '',
      birthYear: -340, deathYear: -279, alternateNames: ['孟尝君','薛公'],
      era: '战国', dynasty: '齐', role: 'regent',
      title: '孟尝君', officialTitle: '齐相',
      rankLevel: 28, socialClass: 'noble', department: 'central',
      abilities: { governance: 75, military: 70, intelligence: 88,
                    charisma: 95, integrity: 70, benevolence: 90,
                    diplomacy: 92, scholarship: 80, finance: 75, cunning: 85 },
      loyalty: 70, ambition: 80,
      traits: ['benevolent','clever','luxurious','heroic'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 700, virtueStage: 5
      },
      integrity: 70,
      background: '齐国王族·薛邑·门客三千·鸡鸣狗盗·战国四公子之一·入秦为相险些被囚。',
      famousQuote: '客无所择·有食无虞。',
      historicalFate: '齐湣王末病殁·薛地后被齐灭',
      fateHint: 'peacefulDeath'
    },

    yueyi: {
      id: 'yueyi', name: '乐毅', zi: '',
      birthYear: -324, deathYear: -262, alternateNames: ['昌国君'],
      era: '战国', dynasty: '燕', role: 'military',
      title: '昌国君', officialTitle: '上将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 80, military: 95, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 78,
                    diplomacy: 88, scholarship: 80, finance: 70, cunning: 88 },
      loyalty: 88, ambition: 70,
      traits: ['brilliant','heroic','rigorous','sage'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '中山灵寿人·辅燕昭王·联五国伐齐下七十余城·燕惠王疑去赵·封望诸君。',
      famousQuote: '夫免身全功·以明先王之迹者·臣之上计也。',
      historicalFate: '终于赵·受赵燕共礼',
      fateHint: 'retirement'
    },

    tianDan: {
      id: 'tianDan', name: '田单', zi: '',
      birthYear: -331, deathYear: -250, alternateNames: ['安平君'],
      era: '战国', dynasty: '齐', role: 'military',
      title: '安平君', officialTitle: '相国',
      rankLevel: 28, socialClass: 'noble', department: 'military',
      abilities: { governance: 78, military: 92, intelligence: 95,
                    charisma: 80, integrity: 85, benevolence: 75,
                    diplomacy: 70, scholarship: 75, finance: 70, cunning: 95 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','clever','heroic','patient'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 88,
      background: '齐国王族远支·乐毅破齐七十余城仅余即墨·火牛阵复七十余城·中兴齐国。',
      famousQuote: '夫始如处女·后如脱兔。',
      historicalFate: '终于赵·客死异乡',
      fateHint: 'exileDeath'
    },

    chunshenJun: {
      id: 'chunshenJun', name: '黄歇', zi: '',
      birthYear: -314, deathYear: -238, alternateNames: ['春申君'],
      era: '战国', dynasty: '楚', role: 'regent',
      title: '春申君', officialTitle: '楚相',
      rankLevel: 30, socialClass: 'noble', department: 'central',
      abilities: { governance: 85, military: 70, intelligence: 92,
                    charisma: 90, integrity: 70, benevolence: 80,
                    diplomacy: 95, scholarship: 88, finance: 80, cunning: 88 },
      loyalty: 75, ambition: 80,
      traits: ['brilliant','clever','luxurious','scheming'],
      resources: {
        privateWealth: { money: 8000000, land: 200000, treasure: 20000000, slaves: 8000, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 600, virtueStage: 5
      },
      integrity: 72,
      background: '楚国人·门客三千·相楚二十五年·谋移夫人之子为太子·后被李园门客所杀。',
      famousQuote: '当断不断·反受其乱。',
      historicalFate: '楚考烈王二十五年棘门遇刺',
      fateHint: 'execution'
    },

    caoshen: {
      id: 'caoshen', name: '曹参', zi: '',
      birthYear: -250, deathYear: -190, alternateNames: ['平阳侯','懿'],
      era: '汉初', dynasty: '西汉', role: 'regent',
      title: '平阳侯', officialTitle: '相国',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 88, intelligence: 88,
                    charisma: 78, integrity: 88, benevolence: 85,
                    diplomacy: 75, scholarship: 70, finance: 80, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['brave','rigorous','patient','heroic'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 88,
      background: '沛县人·随高祖灭项羽·继萧何为相·萧规曹随·相国三年而薨。',
      famousQuote: '萧规曹随。',
      historicalFate: '惠帝五年病殁',
      fateHint: 'peacefulDeath'
    },

    zhouYafu: {
      id: 'zhouYafu', name: '周亚夫', zi: '',
      birthYear: -199, deathYear: -143, alternateNames: ['条侯'],
      era: '文景朝', dynasty: '西汉', role: 'military',
      title: '条侯', officialTitle: '太尉·丞相',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 80, military: 95, intelligence: 88,
                    charisma: 70, integrity: 92, benevolence: 70,
                    diplomacy: 50, scholarship: 60, finance: 60, cunning: 80 },
      loyalty: 90, ambition: 65,
      traits: ['brave','rigorous','heroic','proud'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 92,
      background: '周勃次子·细柳营·三月平七国之乱·后为景帝忌·下狱不食而死。',
      famousQuote: '军中闻将军令·不闻天子之诏。',
      historicalFate: '景帝中元三年下狱·绝食五日呕血而亡',
      fateHint: 'forcedDeath'
    },

    liGuang: {
      id: 'liGuang', name: '李广', zi: '',
      birthYear: -184, deathYear: -119, alternateNames: ['飞将军'],
      era: '武帝朝', dynasty: '西汉', role: 'military',
      title: '右北平太守', officialTitle: '前将军',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 95, intelligence: 78,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 50, scholarship: 50, finance: 50, cunning: 65 },
      loyalty: 100, ambition: 80,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 800, virtueStage: 6
      },
      integrity: 95,
      background: '陇西成纪人·与匈奴大小七十余战·飞将军·终生未得封侯·迷路羞愤自刎。',
      famousQuote: '广不为后人·然终无尺寸之功以得封邑者·何也。',
      historicalFate: '元狩四年漠北之战迷路·自刎',
      fateHint: 'martyrdom'
    },

    sangHongyang: {
      id: 'sangHongyang', name: '桑弘羊', zi: '',
      birthYear: -152, deathYear: -80, alternateNames: [],
      era: '武帝-昭帝', dynasty: '西汉', role: 'reformer',
      title: '御史大夫', officialTitle: '御史大夫',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92,
                    charisma: 70, integrity: 70, benevolence: 60,
                    diplomacy: 65, scholarship: 80, finance: 100, cunning: 88 },
      loyalty: 80, ambition: 80,
      traits: ['rigorous','reformist','scholarly','clever'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 1000000 },
        hiddenWealth: 200000, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 75,
      background: '洛阳商人之子·武帝朝主盐铁酒榷·均输平准·盐铁之议·后牵涉燕王旦谋反案。',
      famousQuote: '兴利除害·均输天下。',
      historicalFate: '昭帝元凤元年燕王案被诛·夷三族',
      fateHint: 'executionByClanDestruction'
    },

    dengyu: {
      id: 'dengyu', name: '邓禹', zi: '仲华',
      birthYear: 2, deathYear: 58, alternateNames: ['高密侯','元'],
      era: '光武朝', dynasty: '东汉', role: 'regent',
      title: '高密侯', officialTitle: '太傅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 85, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 88,
                    diplomacy: 80, scholarship: 92, finance: 75, cunning: 80 },
      loyalty: 100, ambition: 60,
      traits: ['scholarly','loyal','rigorous','sage'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '南阳新野人·光武发小·云台二十八将之首·辅光武定河北·年十三即从游学。',
      famousQuote: '名爵不可虚授·荣身不可苟得。',
      historicalFate: '永平元年病殁',
      fateHint: 'peacefulDeath'
    },

    wangYun: {
      id: 'wangYun', name: '王允', zi: '子师',
      birthYear: 137, deathYear: 192, alternateNames: ['王司徒'],
      era: '汉末', dynasty: '东汉', role: 'loyal',
      title: '温侯', officialTitle: '司徒·尚书令',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 50, intelligence: 88,
                    charisma: 78, integrity: 92, benevolence: 75,
                    diplomacy: 78, scholarship: 88, finance: 70, cunning: 88 },
      loyalty: 100, ambition: 70,
      traits: ['loyal','heroic','scheming','idealist'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 92,
      background: '太原祁人·美人计连环计·借吕布手诛董卓·拒赦凉州军·李傕郭汜入长安被杀。',
      famousQuote: '社稷不可一日无君。',
      historicalFate: '初平三年长安城破·李傕诛之',
      fateHint: 'martyrdom'
    },

    huangFusong: {
      id: 'huangFusong', name: '皇甫嵩', zi: '义真',
      birthYear: 129, deathYear: 195, alternateNames: ['槐里侯'],
      era: '汉末', dynasty: '东汉', role: 'military',
      title: '槐里侯', officialTitle: '太尉',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 92, intelligence: 85,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 60, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '安定朝那人·镇黄巾·破张角·守长安·东汉末年最后名将·终为董卓所抑。',
      famousQuote: '使天下安·愿陛下稍息征役。',
      historicalFate: '兴平二年病殁',
      fateHint: 'peacefulDeath'
    },

    zhangliao: {
      id: 'zhangliao', name: '张辽', zi: '文远',
      birthYear: 169, deathYear: 222, alternateNames: ['晋阳侯','刚'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '晋阳侯', officialTitle: '前将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 95, intelligence: 85,
                    charisma: 85, integrity: 90, benevolence: 75,
                    diplomacy: 60, scholarship: 50, finance: 55, cunning: 80 },
      loyalty: 92, ambition: 70,
      traits: ['brave','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '雁门马邑人·先后事丁原何进董卓吕布·下邳归曹·合肥八百破孙权十万·吓哭江东小儿。',
      famousQuote: '此王命也·吾受国厚恩·岂可纵敌耳。',
      historicalFate: '黄初三年病殁江都',
      fateHint: 'peacefulDeath'
    },

    zhangHe: {
      id: 'zhangHe', name: '张郃', zi: '儁乂',
      birthYear: 167, deathYear: 231, alternateNames: ['鄚侯','壮'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '鄚侯', officialTitle: '征西车骑将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 92, intelligence: 88,
                    charisma: 80, integrity: 85, benevolence: 75,
                    diplomacy: 60, scholarship: 75, finance: 60, cunning: 88 },
      loyalty: 88, ambition: 65,
      traits: ['brilliant','brave','rigorous','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 12000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '河间鄚人·官渡降曹·街亭破马谡·诸葛亮畏之·木门道追蜀军中箭而亡。',
      famousQuote: '',
      historicalFate: '太和五年木门道追击中箭殁',
      fateHint: 'martyrdom'
    },

    xiahouDun: {
      id: 'xiahouDun', name: '夏侯惇', zi: '元让',
      birthYear: 165, deathYear: 220, alternateNames: ['高安乡侯','忠'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '高安乡侯', officialTitle: '大将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 88, intelligence: 78,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 60, finance: 65, cunning: 70 },
      loyalty: 100, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 12000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '沛国谯人·夏侯婴后裔·曹操从弟·拔矢啖睛·一目将军·曹魏宗室第一功臣。',
      famousQuote: '父精母血·不可弃也。',
      historicalFate: '黄初元年病殁',
      fateHint: 'peacefulDeath'
    },

    pangtong: {
      id: 'pangtong', name: '庞统', zi: '士元',
      birthYear: 179, deathYear: 214, alternateNames: ['凤雏','靖侯'],
      era: '三国初', dynasty: '蜀汉', role: 'scholar',
      title: '关内侯', officialTitle: '军师中郎将',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 75, military: 80, intelligence: 100,
                    charisma: 70, integrity: 80, benevolence: 70,
                    diplomacy: 75, scholarship: 92, finance: 60, cunning: 95 },
      loyalty: 90, ambition: 80,
      traits: ['brilliant','clever','scholarly','heroic'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 700, virtueStage: 5
      },
      integrity: 82,
      background: '襄阳人·与诸葛亮齐名·凤雏·辅刘备入蜀·落凤坡中流矢而亡·年仅三十六。',
      famousQuote: '伏龙凤雏·得一可安天下。',
      historicalFate: '建安十九年雒城落凤坡中流矢殁',
      fateHint: 'martyrdom'
    },

    jiangwan: {
      id: 'jiangwan', name: '蒋琬', zi: '公琰',
      birthYear: 183, deathYear: 246, alternateNames: ['安阳亭侯','恭'],
      era: '蜀汉', dynasty: '蜀汉', role: 'regent',
      title: '安阳亭侯', officialTitle: '大司马',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 70, intelligence: 88,
                    charisma: 80, integrity: 92, benevolence: 88,
                    diplomacy: 75, scholarship: 88, finance: 80, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['rigorous','patient','loyal','sage'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 82, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '零陵湘乡人·诸葛亮死前荐继·继丞相位执蜀政十二年·稳健持重。',
      famousQuote: '吾以为·非其人·则·人主何能用。',
      historicalFate: '延熙九年病殁',
      fateHint: 'peacefulDeath'
    },

    sima_Shi: {
      id: 'sima_Shi', name: '司马师', zi: '子元',
      birthYear: 208, deathYear: 255, alternateNames: ['景帝','晋景帝'],
      era: '曹魏末', dynasty: '曹魏', role: 'usurper',
      title: '舞阳侯·大将军', officialTitle: '大将军',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 85, military: 88, intelligence: 95,
                    charisma: 75, integrity: 50, benevolence: 50,
                    diplomacy: 78, scholarship: 88, finance: 75, cunning: 95 },
      loyalty: 30, ambition: 95,
      traits: ['brilliant','scheming','ruthless','patient'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 1000000, fame: 30, virtueMerit: 400, virtueStage: 4
      },
      integrity: 55,
      background: '司马懿长子·继其父辅曹魏·废齐王芳立曹髦·平毌丘俭文钦·阵前疮痛而亡。',
      famousQuote: '',
      historicalFate: '正元二年许昌病殁',
      fateHint: 'peacefulDeath'
    },

    sima_Zhao: {
      id: 'sima_Zhao', name: '司马昭', zi: '子上',
      birthYear: 211, deathYear: 265, alternateNames: ['晋文帝','文帝'],
      era: '曹魏末', dynasty: '曹魏', role: 'usurper',
      title: '晋王', officialTitle: '相国·大将军',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 88, intelligence: 92,
                    charisma: 78, integrity: 50, benevolence: 55,
                    diplomacy: 80, scholarship: 85, finance: 80, cunning: 95 },
      loyalty: 25, ambition: 100,
      traits: ['scheming','brilliant','ruthless','patient'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 20000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 2000000, fame: -10, virtueMerit: 350, virtueStage: 3
      },
      integrity: 50,
      background: '司马懿次子·继兄晋位·灭蜀·杀曹髦于南阙·司马昭之心·路人皆知·其子炎篡魏建晋。',
      famousQuote: '',
      historicalFate: '咸熙二年病殁洛阳',
      fateHint: 'peacefulDeath'
    },

    zhaoKuangyin: {
      id: 'zhaoKuangyin', name: '赵匡胤', zi: '元朗',
      birthYear: 927, deathYear: 976, alternateNames: ['宋太祖'],
      era: '北宋初', dynasty: '北宋', role: 'usurper',
      title: '宋太祖', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 92, military: 95, intelligence: 92,
                    charisma: 95, integrity: 85, benevolence: 88,
                    diplomacy: 88, scholarship: 80, finance: 80, cunning: 92 },
      loyalty: 60, ambition: 100,
      traits: ['brilliant','heroic','patient','benevolent'],
      resources: {
        privateWealth: { money: 100000000, land: 5000000, treasure: 200000000, slaves: 100000, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 88,
      background: '涿郡人·后周殿前都点检·陈桥兵变·黄袍加身·杯酒释兵权·开宋三百年。',
      famousQuote: '卧榻之侧·岂容他人鼾睡。',
      historicalFate: '开宝九年烛影斧声·暴崩·年五十',
      fateHint: 'forcedDeath'
    },

    zhanghui: {
      id: 'zhanghui', name: '章惇', zi: '子厚',
      birthYear: 1035, deathYear: 1105, alternateNames: ['申国公','文简'],
      era: '神哲徽朝', dynasty: '北宋', role: 'reformer',
      title: '申国公', officialTitle: '尚书左仆射',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 60, intelligence: 92,
                    charisma: 70, integrity: 70, benevolence: 50,
                    diplomacy: 75, scholarship: 90, finance: 80, cunning: 90 },
      loyalty: 80, ambition: 90,
      traits: ['brilliant','reformist','rigorous','ruthless'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 200000, fame: -20, virtueMerit: 400, virtueStage: 4
      },
      integrity: 70,
      background: '建州浦城人·新党继任·哲宗朝绍述新法·贬司马光等元祐党人·拒立徽宗谓端王轻佻。',
      famousQuote: '端王轻佻·不可以君天下。',
      historicalFate: '崇宁四年贬越州·途中殁',
      fateHint: 'exileDeath'
    },

    caixiang: {
      id: 'caixiang', name: '蔡襄', zi: '君谟',
      birthYear: 1012, deathYear: 1067, alternateNames: ['忠惠'],
      era: '仁宗英宗', dynasty: '北宋', role: 'scholar',
      title: '端明殿学士', officialTitle: '翰林学士',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 88,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 100, finance: 75, cunning: 65 },
      loyalty: 92, ambition: 60,
      traits: ['scholarly','literary','upright','rigorous'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '兴化仙游人·宋四家书法之一·泉州万安桥·茶录·荔枝谱·官清而文盛。',
      famousQuote: '',
      historicalFate: '治平四年病殁',
      fateHint: 'peacefulDeath'
    },

    ligang: {
      id: 'ligang', name: '李纲', zi: '伯纪',
      birthYear: 1083, deathYear: 1140, alternateNames: ['梁溪先生','忠定'],
      era: '北宋末-南宋初', dynasty: '南宋', role: 'loyal',
      title: '观文殿大学士', officialTitle: '尚书右仆射',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 80, intelligence: 92,
                    charisma: 85, integrity: 95, benevolence: 80,
                    diplomacy: 70, scholarship: 92, finance: 80, cunning: 75 },
      loyalty: 100, ambition: 75,
      traits: ['loyal','heroic','idealist','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '邵武人·靖康守汴京·力主抗金·高宗朝拜相七十七日·罢相·一生主战。',
      famousQuote: '臣愿陛下毋忘北狩之痛。',
      historicalFate: '绍兴十年病殁福州',
      fateHint: 'peacefulDeath'
    },

    zongze: {
      id: 'zongze', name: '宗泽', zi: '汝霖',
      birthYear: 1060, deathYear: 1128, alternateNames: ['忠简'],
      era: '北宋末', dynasty: '南宋', role: 'military',
      title: '观文殿学士', officialTitle: '东京留守',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 85, military: 90, intelligence: 88,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 60, scholarship: 80, finance: 75, cunning: 75 },
      loyalty: 100, ambition: 75,
      traits: ['heroic','loyal','brave','rigorous'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 900, virtueStage: 6
      },
      integrity: 100,
      background: '婺州义乌人·守东京整顿八字军·三呼过河而崩·岳飞之伯乐·南宋初抗金第一人。',
      famousQuote: '过河！过河！过河！',
      historicalFate: '建炎二年忧愤病殁·临终三呼过河',
      fateHint: 'forcedDeath'
    },

    yuYunwen: {
      id: 'yuYunwen', name: '虞允文', zi: '彬甫',
      birthYear: 1110, deathYear: 1174, alternateNames: ['雍国公','忠肃'],
      era: '南宋', dynasty: '南宋', role: 'military',
      title: '雍国公', officialTitle: '左丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 92, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 80, scholarship: 90, finance: 80, cunning: 85 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','heroic','rigorous','loyal'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '隆州仁寿人·绍兴进士·采石矶之战以书生退完颜亮·南宋中兴之名相。',
      famousQuote: '今日之事·有进无退。',
      historicalFate: '淳熙元年病殁',
      fateHint: 'peacefulDeath'
    },

    liQingzhao: {
      id: 'liQingzhao', name: '李清照', zi: '',
      birthYear: 1084, deathYear: 1155, alternateNames: ['易安居士','千古第一才女'],
      era: '北宋末-南宋初', dynasty: '南宋', role: 'scholar',
      title: '', officialTitle: '',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 60, military: 30, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 78,
                    diplomacy: 50, scholarship: 100, finance: 65, cunning: 65 },
      loyalty: 80, ambition: 50,
      traits: ['literary','idealist','reclusive','heroic'],
      resources: {
        privateWealth: { money: 100000, land: 1000, treasure: 200000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '济南人·赵明诚妻·靖康南渡夫亡·收藏散佚·婉约词宗·千古第一才女。',
      famousQuote: '生当作人杰，死亦为鬼雄。',
      historicalFate: '绍兴二十五年病殁临安',
      fateHint: 'exileDeath'
    },

    chengHao: {
      id: 'chengHao', name: '程颢', zi: '伯淳',
      birthYear: 1032, deathYear: 1085, alternateNames: ['明道先生','纯公'],
      era: '神宗朝', dynasty: '北宋', role: 'scholar',
      title: '太子中允', officialTitle: '监察御史里行',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 95,
                    charisma: 85, integrity: 95, benevolence: 90,
                    diplomacy: 50, scholarship: 100, finance: 60, cunning: 50 },
      loyalty: 88, ambition: 50,
      traits: ['scholarly','sage','benevolent','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '洛阳人·二程之兄·开洛学·与王安石新法争·定胜义利之辨·理学奠基。',
      famousQuote: '万物皆备于我。',
      historicalFate: '元丰八年病殁',
      fateHint: 'peacefulDeath'
    },

    zhangzai: {
      id: 'zhangzai', name: '张载', zi: '子厚',
      birthYear: 1020, deathYear: 1077, alternateNames: ['横渠先生','明诚'],
      era: '神宗朝', dynasty: '北宋', role: 'scholar',
      title: '崇文院校书', officialTitle: '同知太常礼院',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 35, intelligence: 95,
                    charisma: 75, integrity: 92, benevolence: 88,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 55 },
      loyalty: 90, ambition: 55,
      traits: ['scholarly','sage','idealist','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 900, virtueStage: 6
      },
      integrity: 95,
      background: '凤翔郿县横渠镇人·关学开山·撰《正蒙》《西铭》·北宋五子之一。',
      famousQuote: '为天地立心，为生民立命，为往圣继绝学，为万世开太平。',
      historicalFate: '熙宁十年病殁',
      fateHint: 'peacefulDeath'
    },

    zhuYuanzhang: {
      id: 'zhuYuanzhang', name: '朱元璋', zi: '国瑞',
      birthYear: 1328, deathYear: 1398, alternateNames: ['明太祖','重八','洪武帝'],
      era: '元末明初', dynasty: '明', role: 'usurper',
      title: '明太祖', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 95, military: 95, intelligence: 95,
                    charisma: 92, integrity: 80, benevolence: 65,
                    diplomacy: 80, scholarship: 60, finance: 85, cunning: 100 },
      loyalty: 50, ambition: 100,
      traits: ['brilliant','ruthless','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 200000000, land: 10000000, treasure: 500000000, slaves: 200000, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 78,
      background: '濠州钟离人·和尚乞丐出身·从郭子兴起兵·灭元·驱胡复汉·开明二百七十六年。',
      famousQuote: '高筑墙·广积粮·缓称王。',
      historicalFate: '洪武三十一年崩于应天·年七十一',
      fateHint: 'peacefulDeath'
    },

    zhuDi: {
      id: 'zhuDi', name: '朱棣', zi: '',
      birthYear: 1360, deathYear: 1424, alternateNames: ['明成祖','永乐帝','文皇帝'],
      era: '永乐', dynasty: '明', role: 'usurper',
      title: '明成祖', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 92, military: 95, intelligence: 92,
                    charisma: 90, integrity: 60, benevolence: 60,
                    diplomacy: 88, scholarship: 80, finance: 80, cunning: 92 },
      loyalty: 30, ambition: 100,
      traits: ['brilliant','ruthless','heroic','ambitious'],
      resources: {
        privateWealth: { money: 250000000, land: 12000000, treasure: 600000000, slaves: 250000, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 65,
      background: '朱元璋四子·靖难夺位·迁都北京·郑和下西洋·五征蒙古·永乐大典·开盛世。',
      famousQuote: '吾治天下·欲使万方咸宁。',
      historicalFate: '永乐二十二年北征途中崩于榆木川',
      fateHint: 'peacefulDeath'
    },

    lanyu: {
      id: 'lanyu', name: '蓝玉', zi: '',
      birthYear: 1343, deathYear: 1393, alternateNames: ['凉国公'],
      era: '洪武', dynasty: '明', role: 'military',
      title: '凉国公', officialTitle: '大将军',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 95, intelligence: 80,
                    charisma: 78, integrity: 50, benevolence: 50,
                    diplomacy: 50, scholarship: 50, finance: 60, cunning: 70 },
      loyalty: 70, ambition: 90,
      traits: ['brave','heroic','arrogant','ruthless'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 55,
      background: '定远人·常遇春妻弟·捕鱼儿海大破北元·跋扈强奸元妃·蓝玉案诛连一万五千人。',
      famousQuote: '',
      historicalFate: '洪武二十六年以谋反诛·剥皮实草',
      fateHint: 'executionByClanDestruction'
    },

    liShanchang: {
      id: 'liShanchang', name: '李善长', zi: '百室',
      birthYear: 1314, deathYear: 1390, alternateNames: ['韩国公','文宪'],
      era: '元末明初', dynasty: '明', role: 'regent',
      title: '韩国公', officialTitle: '中书省左丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 92,
                    charisma: 80, integrity: 65, benevolence: 70,
                    diplomacy: 88, scholarship: 88, finance: 85, cunning: 88 },
      loyalty: 75, ambition: 80,
      traits: ['brilliant','patient','rigorous','clever'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 500, virtueStage: 4
      },
      integrity: 70,
      background: '濠州定远人·朱元璋萧何·开国第一文臣·定开国制度·胡惟庸案诛连七十七岁全家。',
      famousQuote: '',
      historicalFate: '洪武二十三年坐胡党案诛·全家七十余人',
      fateHint: 'executionByClanDestruction'
    },

    zhenghe: {
      id: 'zhenghe', name: '郑和', zi: '',
      birthYear: 1371, deathYear: 1433, alternateNames: ['马三宝','三宝太监'],
      era: '永乐宣德', dynasty: '明', role: 'eunuch',
      title: '太监', officialTitle: '内官监太监·正使',
      rankLevel: 24, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 80, military: 85, intelligence: 88,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 95, scholarship: 75, finance: 85, cunning: 78 },
      loyalty: 100, ambition: 65,
      traits: ['heroic','rigorous','loyal','patient'],
      resources: {
        privateWealth: { money: 500000, land: 5000, treasure: 1000000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '云南昆阳人·回族·靖难有功·七下西洋·历三十余国·中国大航海第一人。',
      famousQuote: '欲国家富强·不可置海洋于不顾。',
      historicalFate: '宣德八年第七次航海归途殁于古里',
      fateHint: 'peacefulDeath'
    },

    shiKefa: {
      id: 'shiKefa', name: '史可法', zi: '宪之',
      birthYear: 1601, deathYear: 1645, alternateNames: ['道邻','忠靖','忠正'],
      era: '明末', dynasty: '明', role: 'loyal',
      title: '兵部尚书·东阁大学士', officialTitle: '督师扬州',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 80, military: 78, intelligence: 88,
                    charisma: 85, integrity: 100, benevolence: 88,
                    diplomacy: 65, scholarship: 90, finance: 70, cunning: 70 },
      loyalty: 100, ambition: 70,
      traits: ['loyal','heroic','idealist','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '河南祥符人·明亡后辅弘光督师扬州·城破不屈·与扬州十日同尽·衣冠葬梅花岭。',
      famousQuote: '城存与存·城亡与亡·我意已决。',
      historicalFate: '弘光元年扬州城破·被俘不屈死',
      fateHint: 'martyrdom'
    },

    luXiangsheng: {
      id: 'luXiangsheng', name: '卢象升', zi: '建斗',
      birthYear: 1600, deathYear: 1639, alternateNames: ['九台','忠烈','忠肃'],
      era: '明末', dynasty: '明', role: 'military',
      title: '兵部尚书', officialTitle: '督师·宣大总督',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 78, military: 92, intelligence: 88,
                    charisma: 85, integrity: 100, benevolence: 80,
                    diplomacy: 60, scholarship: 88, finance: 65, cunning: 75 },
      loyalty: 100, ambition: 75,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 100,
      background: '常州宜兴人·天启进士·平流寇·镇宣大·崇祯朝主战·清军入塞·孤军奋战巨鹿殉国。',
      famousQuote: '将军死绥·有进无退。',
      historicalFate: '崇祯十二年巨鹿贾庄之战殉国·年三十九',
      fateHint: 'martyrdom'
    },

    guYanwu: {
      id: 'guYanwu', name: '顾炎武', zi: '宁人',
      birthYear: 1613, deathYear: 1682, alternateNames: ['亭林先生','蒋山佣'],
      era: '明末清初', dynasty: '明', role: 'scholar',
      title: '', officialTitle: '',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 80, military: 50, intelligence: 95,
                    charisma: 78, integrity: 95, benevolence: 88,
                    diplomacy: 55, scholarship: 100, finance: 60, cunning: 70 },
      loyalty: 100, ambition: 60,
      traits: ['scholarly','idealist','rigorous','heroic'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '昆山人·明亡参与抗清·终身不仕清·撰《日知录》《天下郡国利病书》·考据学开山。',
      famousQuote: '天下兴亡，匹夫有责。',
      historicalFate: '康熙二十一年病殁山西曲沃',
      fateHint: 'exileDeath'
    },

    wangFuzhi: {
      id: 'wangFuzhi', name: '王夫之', zi: '而农',
      birthYear: 1619, deathYear: 1692, alternateNames: ['船山先生','姜斋'],
      era: '明末清初', dynasty: '明', role: 'scholar',
      title: '', officialTitle: '行人司行人',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 75, military: 50, intelligence: 95,
                    charisma: 75, integrity: 92, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 65 },
      loyalty: 100, ambition: 50,
      traits: ['scholarly','idealist','reclusive','sage'],
      resources: {
        privateWealth: { money: 20000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '衡阳人·南明礼部主事·清军南下隐石船山四十年·气一元论·朴素唯物·明遗民三大儒之一。',
      famousQuote: '六经责我开生面·七尺从天乞活埋。',
      historicalFate: '康熙三十一年病殁石船山·明遗民身份',
      fateHint: 'retirement'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-04] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
