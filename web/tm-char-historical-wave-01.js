// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-01.js
// Domain: NPC / 历史人物 data
// 来源·§1-§8 朝代 (周/汉/三国/两晋南北朝/隋唐/宋/明/清)
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
    // ─────────────────────────────────────────
    // §1 周/春秋战国
    // ─────────────────────────────────────────
    jiangShang: {
      id: 'jiangShang', name: '姜尚', zi: '子牙',
      birthYear: -1156, deathYear: -1017, alternateNames: ['姜子牙','吕尚','太公望','齐太公'],
      era: '周初', dynasty: '周', role: 'scholar',
      title: '齐太公', officialTitle: '太师·齐侯',
      rankLevel: 30, socialClass: 'noble', department: 'central',
      abilities: { governance: 90, military: 95, intelligence: 98,
                    charisma: 88, integrity: 90, benevolence: 85,
                    diplomacy: 92, scholarship: 95, finance: 80, cunning: 92 },
      loyalty: 95, ambition: 70,
      traits: ['scholarly','patient','heroic','sage'],
      resources: {
        privateWealth: { money: 100000, land: 50000, treasure: 200000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 92,
      background: '渭水垂钓遇文王·武王伐纣居首功·封齐建国，开姜齐八百年。',
      famousQuote: '愿者上钩。',
      historicalFate: '寿百三十九·配享周庙',
      fateHint: 'peacefulDeath'
    },

    zhouGongDan: {
      id: 'zhouGongDan', name: '周公旦', zi: '',
      birthYear: -1100, deathYear: -1033, alternateNames: ['姬旦','周文公','元圣'],
      era: '西周', dynasty: '周', role: 'regent',
      title: '周公', officialTitle: '太宰·摄政',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 100, military: 80, intelligence: 95,
                    charisma: 90, integrity: 100, benevolence: 95,
                    diplomacy: 90, scholarship: 100, finance: 85, cunning: 70 },
      loyalty: 100, ambition: 50,
      traits: ['loyal','scholarly','rigorous','sage'],
      resources: {
        privateWealth: { money: 80000, land: 30000, treasure: 150000, slaves: 80, commerce: 0 },
        hiddenWealth: 0, fame: 98, virtueMerit: 1000, virtueStage: 6
      },
      integrity: 100,
      background: '武王弟·摄政七年还政成王·制礼作乐·定周制·孔子尊为元圣。',
      famousQuote: '一沐三捉发，一饭三吐哺。',
      historicalFate: '成王亲政后归隐·终于丰京',
      fateHint: 'peacefulDeath'
    },

    guanzhong: {
      id: 'guanzhong', name: '管仲', zi: '夷吾',
      birthYear: -723, deathYear: -645, alternateNames: ['管敬仲','管子'],
      era: '春秋', dynasty: '齐', role: 'reformer',
      title: '齐相', officialTitle: '相国',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 98, military: 75, intelligence: 95,
                    charisma: 85, integrity: 80, benevolence: 80,
                    diplomacy: 95, scholarship: 92, finance: 100, cunning: 85 },
      loyalty: 90, ambition: 75,
      traits: ['reformist','pragmatic','brilliant','scholarly'],
      resources: {
        privateWealth: { money: 500000, land: 30000, treasure: 800000, slaves: 500, commerce: 200000 },
        hiddenWealth: 100000, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 80,
      background: '辅齐桓公·改革内政·设盐铁专卖·尊王攘夷·九合诸侯·成春秋首霸。',
      famousQuote: '仓廪实而知礼节，衣食足而知荣辱。',
      historicalFate: '齐桓公四十一年病殁·临终荐贤拒佞',
      fateHint: 'peacefulDeath'
    },

    yanying: {
      id: 'yanying', name: '晏婴', zi: '仲',
      birthYear: -578, deathYear: -500, alternateNames: ['晏子','晏平仲'],
      era: '春秋', dynasty: '齐', role: 'clean',
      title: '齐相', officialTitle: '相国',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 60, intelligence: 95,
                    charisma: 90, integrity: 95, benevolence: 88,
                    diplomacy: 98, scholarship: 88, finance: 75, cunning: 80 },
      loyalty: 95, ambition: 50,
      traits: ['upright','clever','frugal','witty'],
      resources: {
        privateWealth: { money: 50000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '历仕齐灵公、庄公、景公·身长不满六尺·智辩绝伦·使楚不辱·节俭名传后世。',
      famousQuote: '为者常成，行者常至。',
      historicalFate: '齐景公四十八年殁',
      fateHint: 'peacefulDeath'
    },

    fanli: {
      id: 'fanli', name: '范蠡', zi: '少伯',
      birthYear: -536, deathYear: -448, alternateNames: ['陶朱公','鸱夷子皮'],
      era: '春秋末', dynasty: '越', role: 'reformer',
      title: '上将军', officialTitle: '相国',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 88, intelligence: 100,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 92, scholarship: 90, finance: 100, cunning: 95 },
      loyalty: 80, ambition: 65,
      traits: ['brilliant','patient','merchant','scholarly'],
      resources: {
        privateWealth: { money: 5000000, land: 50000, treasure: 10000000, slaves: 1000, commerce: 30000000 },
        hiddenWealth: 1000000, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '辅越王勾践卧薪尝胆灭吴·功成隐退·三致千金散于贫族·商圣之祖。',
      famousQuote: '飞鸟尽，良弓藏；狡兔死，走狗烹。',
      historicalFate: '陶地经商·寿八十八而终',
      fateHint: 'retirement'
    },

    kongzi: {
      id: 'kongzi', name: '孔丘', zi: '仲尼',
      birthYear: -551, deathYear: -479, alternateNames: ['孔子','至圣','宣父','文宣王'],
      era: '春秋', dynasty: '鲁', role: 'scholar',
      title: '鲁司寇', officialTitle: '大司寇·相事',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 100,
                    charisma: 95, integrity: 100, benevolence: 100,
                    diplomacy: 85, scholarship: 100, finance: 60, cunning: 50 },
      loyalty: 90, ambition: 70,
      traits: ['scholarly','sage','benevolent','upright'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 1000, virtueStage: 6
      },
      integrity: 100,
      background: '鲁国陬邑人·删定六经·开门授徒三千·周游列国十四年·儒家始祖。',
      famousQuote: '己所不欲，勿施于人。',
      historicalFate: '鲁哀公十六年卒于曲阜·享年七十三',
      fateHint: 'peacefulDeath'
    },

    laozi: {
      id: 'laozi', name: '李耳', zi: '聃',
      birthYear: -571, deathYear: -471, alternateNames: ['老子','老聃','太上老君'],
      era: '春秋', dynasty: '周', role: 'scholar',
      title: '柱下史', officialTitle: '周守藏室之史',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 100,
                    charisma: 80, integrity: 95, benevolence: 90,
                    diplomacy: 70, scholarship: 100, finance: 50, cunning: 75 },
      loyalty: 70, ambition: 30,
      traits: ['sage','scholarly','ascetic','reclusive'],
      resources: {
        privateWealth: { money: 10000, land: 100, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '楚国苦县人·守周藏室·过函谷关留《道德经》五千言·西出不知所终。',
      famousQuote: '道可道，非常道；名可名，非常名。',
      historicalFate: '出关西游·莫知其终',
      fateHint: 'retirement'
    },

    sunwu: {
      id: 'sunwu', name: '孙武', zi: '长卿',
      birthYear: -545, deathYear: -470, alternateNames: ['孙子','兵圣'],
      era: '春秋', dynasty: '吴', role: 'military',
      title: '吴上将军', officialTitle: '将军',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 100, intelligence: 100,
                    charisma: 80, integrity: 85, benevolence: 60,
                    diplomacy: 70, scholarship: 95, finance: 50, cunning: 95 },
      loyalty: 80, ambition: 60,
      traits: ['brilliant','rigorous','reclusive','sage'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 300000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '齐国乐安人·作《孙子兵法》十三篇·辅吴王阖闾大破强楚·兵家鼻祖。',
      famousQuote: '兵者，国之大事，死生之地，存亡之道。',
      historicalFate: '伍子胥死后归隐姑苏·撰兵法终',
      fateHint: 'retirement'
    },

    wuqi: {
      id: 'wuqi', name: '吴起', zi: '',
      birthYear: -440, deathYear: -381, alternateNames: ['吴子'],
      era: '战国', dynasty: '楚', role: 'military',
      title: '楚令尹', officialTitle: '令尹',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 88, military: 98, intelligence: 92,
                    charisma: 78, integrity: 50, benevolence: 60,
                    diplomacy: 70, scholarship: 88, finance: 75, cunning: 88 },
      loyalty: 65, ambition: 90,
      traits: ['brilliant','ruthless','reformist','ambitious'],
      resources: {
        privateWealth: { money: 500000, land: 20000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 500, virtueStage: 4
      },
      integrity: 60,
      background: '卫国左氏人·历仕鲁魏楚·魏武卒制·楚悼王变法·杀妻求将·母死不归。',
      famousQuote: '在德不在险。',
      historicalFate: '楚悼王死后被旧贵族箭射于王尸之上',
      fateHint: 'execution'
    },

    quyuan: {
      id: 'quyuan', name: '屈原', zi: '原',
      birthYear: -340, deathYear: -278, alternateNames: ['屈平','灵均','三闾大夫'],
      era: '战国', dynasty: '楚', role: 'loyal',
      title: '三闾大夫', officialTitle: '左徒',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 40, intelligence: 92,
                    charisma: 85, integrity: 100, benevolence: 90,
                    diplomacy: 75, scholarship: 100, finance: 55, cunning: 50 },
      loyalty: 100, ambition: 60,
      traits: ['loyal','literary','idealist','ascetic'],
      resources: {
        privateWealth: { money: 50000, land: 2000, treasure: 30000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 900, virtueStage: 6
      },
      integrity: 100,
      background: '楚怀王朝左徒·主张联齐抗秦·遭谗见疏·作《离骚》《九歌》·楚辞之祖。',
      famousQuote: '路漫漫其修远兮，吾将上下而求索。',
      historicalFate: '楚顷襄王二十一年怀沙投汨罗',
      fateHint: 'martyrdom'
    },

    lianpo: {
      id: 'lianpo', name: '廉颇', zi: '',
      birthYear: -327, deathYear: -243, alternateNames: ['信平君'],
      era: '战国', dynasty: '赵', role: 'military',
      title: '上将军', officialTitle: '相国',
      rankLevel: 29, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 95, intelligence: 78,
                    charisma: 75, integrity: 80, benevolence: 70,
                    diplomacy: 50, scholarship: 50, finance: 55, cunning: 60 },
      loyalty: 90, ambition: 75,
      traits: ['brave','proud','loyal','rigorous'],
      resources: {
        privateWealth: { money: 800000, land: 30000, treasure: 1000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 700, virtueStage: 5
      },
      integrity: 82,
      background: '赵国上将军·攻齐拔阳晋·拒秦于长平·负荆请罪·赵亡前夜奔魏。',
      famousQuote: '廉颇老矣，尚能饭否。',
      historicalFate: '客死寿春',
      fateHint: 'exileDeath'
    },

    linxiangru: {
      id: 'linxiangru', name: '蔺相如', zi: '',
      birthYear: -329, deathYear: -259, alternateNames: [],
      era: '战国', dynasty: '赵', role: 'clean',
      title: '上卿', officialTitle: '相国',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 50, intelligence: 95,
                    charisma: 88, integrity: 90, benevolence: 80,
                    diplomacy: 100, scholarship: 80, finance: 60, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['brave','clever','upright','patient'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 300000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 750, virtueStage: 5
      },
      integrity: 90,
      background: '赵惠文王朝·完璧归赵·渑池之会·将相和·廉颇负荆请罪。',
      famousQuote: '先国家之急而后私仇。',
      historicalFate: '赵孝成王初病殁',
      fateHint: 'peacefulDeath'
    },

    baiqi: {
      id: 'baiqi', name: '白起', zi: '',
      birthYear: -332, deathYear: -257, alternateNames: ['公孙起','武安君','人屠'],
      era: '战国', dynasty: '秦', role: 'military',
      title: '武安君', officialTitle: '大良造',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 100, intelligence: 88,
                    charisma: 70, integrity: 60, benevolence: 20,
                    diplomacy: 45, scholarship: 50, finance: 50, cunning: 85 },
      loyalty: 75, ambition: 70,
      traits: ['brilliant','ruthless','brave','rigorous'],
      resources: {
        privateWealth: { money: 1000000, land: 50000, treasure: 2000000, slaves: 1000, commerce: 0 },
        hiddenWealth: 0, fame: 50, virtueMerit: 300, virtueStage: 3
      },
      integrity: 65,
      background: '秦昭襄王朝·伊阙斩首二十四万·长平坑赵卒四十万·斩级百二十万。',
      famousQuote: '将之所恃者勇也，士之所恃者利也。',
      historicalFate: '昭襄王五十年赐剑自刎杜邮',
      fateHint: 'forcedDeath'
    },

    wangjian: {
      id: 'wangjian', name: '王翦', zi: '',
      birthYear: -304, deathYear: -214, alternateNames: ['武成侯'],
      era: '战国末', dynasty: '秦', role: 'military',
      title: '武成侯', officialTitle: '大将军',
      rankLevel: 29, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 95, intelligence: 92,
                    charisma: 80, integrity: 78, benevolence: 70,
                    diplomacy: 65, scholarship: 60, finance: 65, cunning: 92 },
      loyalty: 88, ambition: 60,
      traits: ['brilliant','patient','brave','clever'],
      resources: {
        privateWealth: { money: 2000000, land: 80000, treasure: 5000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 650, virtueStage: 5
      },
      integrity: 80,
      background: '频阳东乡人·六十万兵灭楚·破赵入燕·秦统一战四大名将之首·全身而退。',
      famousQuote: '为大王将，有功终不得封侯。',
      historicalFate: '秦统一后告老·寿终',
      fateHint: 'retirement'
    },

    // ─────────────────────────────────────────
    // §2 两汉
    // ─────────────────────────────────────────
    zhangliang: {
      id: 'zhangliang', name: '张良', zi: '子房',
      birthYear: -250, deathYear: -186, alternateNames: ['留侯','文成'],
      era: '楚汉之际', dynasty: '西汉', role: 'scholar',
      title: '留侯', officialTitle: '太子少傅',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 75, intelligence: 100,
                    charisma: 80, integrity: 88, benevolence: 80,
                    diplomacy: 95, scholarship: 95, finance: 65, cunning: 100 },
      loyalty: 90, ambition: 50,
      traits: ['brilliant','patient','clever','sage'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 500000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 90,
      background: '韩国贵族·博浪沙刺秦·圮上受书·辅高祖定汉·汉初三杰之一·功成身退辟谷。',
      famousQuote: '运筹帷幄之中，决胜千里之外。',
      historicalFate: '惠帝六年辟谷成仙之说·一说病殁',
      fateHint: 'retirement'
    },

    chenping: {
      id: 'chenping', name: '陈平', zi: '',
      birthYear: -255, deathYear: -178, alternateNames: ['曲逆献侯'],
      era: '西汉初', dynasty: '西汉', role: 'regent',
      title: '曲逆侯', officialTitle: '右丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 70, intelligence: 98,
                    charisma: 78, integrity: 65, benevolence: 65,
                    diplomacy: 90, scholarship: 85, finance: 80, cunning: 100 },
      loyalty: 85, ambition: 70,
      traits: ['brilliant','clever','scheming','patient'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 300, commerce: 0 },
        hiddenWealth: 200000, fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 65,
      background: '阳武户牖人·六出奇计辅高祖·智擒韩信·诛诸吕·两朝丞相·与周勃合诛诸吕。',
      famousQuote: '我多阴谋，是道家之所禁。',
      historicalFate: '文帝二年病殁',
      fateHint: 'peacefulDeath'
    },

    jiayi: {
      id: 'jiayi', name: '贾谊', zi: '',
      birthYear: -200, deathYear: -168, alternateNames: ['贾长沙','贾太傅'],
      era: '文帝朝', dynasty: '西汉', role: 'reformer',
      title: '梁怀王太傅', officialTitle: '太中大夫',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 95,
                    charisma: 80, integrity: 90, benevolence: 80,
                    diplomacy: 70, scholarship: 98, finance: 75, cunning: 60 },
      loyalty: 95, ambition: 75,
      traits: ['scholarly','reformist','idealist','literary'],
      resources: {
        privateWealth: { money: 50000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 92,
      background: '洛阳人·二十而召·上《治安策》《过秦论》·贬长沙·梁怀王坠马而死忧恨而终。',
      famousQuote: '仁义不施而攻守之势异也。',
      historicalFate: '文帝十二年忧伤而殁·年仅三十三',
      fateHint: 'exileDeath'
    },

    dongzhongshu: {
      id: 'dongzhongshu', name: '董仲舒', zi: '',
      birthYear: -179, deathYear: -104, alternateNames: ['董相','江都相'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '江都相', officialTitle: '胶西王相',
      rankLevel: 24, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 30, intelligence: 95,
                    charisma: 75, integrity: 92, benevolence: 80,
                    diplomacy: 65, scholarship: 100, finance: 60, cunning: 55 },
      loyalty: 95, ambition: 60,
      traits: ['scholarly','rigorous','idealist','sage'],
      resources: {
        privateWealth: { money: 80000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '广川人·武帝朝《天人三策》·罢黜百家·独尊儒术·开两千年儒治格局。',
      famousQuote: '正其谊不谋其利，明其道不计其功。',
      historicalFate: '武帝太初元年病殁',
      fateHint: 'peacefulDeath'
    },

    weiqing: {
      id: 'weiqing', name: '卫青', zi: '仲卿',
      birthYear: -156, deathYear: -106, alternateNames: ['长平烈侯'],
      era: '武帝朝', dynasty: '西汉', role: 'military',
      title: '长平侯', officialTitle: '大司马大将军',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 95, intelligence: 88,
                    charisma: 82, integrity: 85, benevolence: 80,
                    diplomacy: 65, scholarship: 60, finance: 60, cunning: 75 },
      loyalty: 95, ambition: 60,
      traits: ['brave','humble_origin','loyal','rigorous'],
      resources: {
        privateWealth: { money: 2000000, land: 80000, treasure: 5000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '河东平阳人·平阳公主家奴出身·七战七胜匈奴·卫子夫弟·霍去病舅。',
      famousQuote: '臣职奉法遵职而已，何与大将军报私恩。',
      historicalFate: '武帝元封五年病殁',
      fateHint: 'peacefulDeath'
    },

    huoQubing: {
      id: 'huoQubing', name: '霍去病', zi: '',
      birthYear: -140, deathYear: -117, alternateNames: ['冠军侯','景桓侯'],
      era: '武帝朝', dynasty: '西汉', role: 'military',
      title: '冠军侯', officialTitle: '大司马骠骑将军',
      rankLevel: 29, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 100, intelligence: 90,
                    charisma: 85, integrity: 80, benevolence: 60,
                    diplomacy: 50, scholarship: 50, finance: 55, cunning: 80 },
      loyalty: 95, ambition: 75,
      traits: ['brilliant','brave','heroic','proud'],
      resources: {
        privateWealth: { money: 3000000, land: 100000, treasure: 8000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 700, virtueStage: 5
      },
      integrity: 82,
      background: '霍仲孺私生子·十八封冠军侯·封狼居胥·勒石燕然·历来少年战神之首。',
      famousQuote: '匈奴未灭，何以家为。',
      historicalFate: '武帝元狩六年早殁·年仅二十四',
      fateHint: 'peacefulDeath'
    },

    zhangqian: {
      id: 'zhangqian', name: '张骞', zi: '子文',
      birthYear: -164, deathYear: -114, alternateNames: ['博望侯'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '博望侯', officialTitle: '大行令',
      rankLevel: 24, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 70, intelligence: 92,
                    charisma: 78, integrity: 88, benevolence: 75,
                    diplomacy: 95, scholarship: 85, finance: 70, cunning: 80 },
      loyalty: 95, ambition: 70,
      traits: ['brave','patient','heroic','scholarly'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 90,
      background: '汉中成固人·两次出使西域·凿空之旅·奠定丝路基石·拘匈奴十年持节不失。',
      famousQuote: '不入虎穴，焉得虎子。',
      historicalFate: '武帝元鼎三年病殁',
      fateHint: 'peacefulDeath'
    },

    wangmang: {
      id: 'wangmang', name: '王莽', zi: '巨君',
      birthYear: -45, deathYear: 23, alternateNames: ['假皇帝','新室'],
      era: '新莽', dynasty: '新', role: 'usurper',
      title: '新皇帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 75, military: 50, intelligence: 88,
                    charisma: 70, integrity: 50, benevolence: 65,
                    diplomacy: 70, scholarship: 90, finance: 70, cunning: 95 },
      loyalty: 30, ambition: 100,
      traits: ['scheming','reformist','idealist','ambitious'],
      resources: {
        privateWealth: { money: 10000000, land: 500000, treasure: 50000000, slaves: 5000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -40, virtueMerit: 100, virtueStage: 2
      },
      integrity: 45,
      background: '元后侄·辅孺子婴·篡汉自立·托古改制·王田制·六筦·变法激进招天下叛。',
      famousQuote: '天生德于予，汉兵其如予何。',
      historicalFate: '新地皇四年绿林军入长安·渐台被斩',
      fateHint: 'execution'
    },

    liuxiu: {
      id: 'liuxiu', name: '刘秀', zi: '文叔',
      birthYear: -5, deathYear: 57, alternateNames: ['汉光武帝'],
      era: '东汉初', dynasty: '东汉', role: 'usurper',
      title: '光武皇帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 95, military: 92, intelligence: 95,
                    charisma: 92, integrity: 88, benevolence: 92,
                    diplomacy: 88, scholarship: 90, finance: 80, cunning: 85 },
      loyalty: 70, ambition: 95,
      traits: ['brilliant','benevolent','patient','heroic'],
      resources: {
        privateWealth: { money: 50000000, land: 2000000, treasure: 100000000, slaves: 50000, commerce: 5000000 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 90,
      background: '南阳蔡阳人·昆阳之战大破王莽·中兴汉室·光武中兴·开东汉一百九十五年。',
      famousQuote: '仕宦当作执金吾，娶妻当得阴丽华。',
      historicalFate: '建武中元二年崩于洛阳',
      fateHint: 'peacefulDeath'
    },

    banchao: {
      id: 'banchao', name: '班超', zi: '仲升',
      birthYear: 32, deathYear: 102, alternateNames: ['定远侯'],
      era: '明章帝朝', dynasty: '东汉', role: 'military',
      title: '定远侯', officialTitle: '西域都护',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 80, military: 92, intelligence: 95,
                    charisma: 88, integrity: 88, benevolence: 75,
                    diplomacy: 100, scholarship: 80, finance: 65, cunning: 92 },
      loyalty: 95, ambition: 75,
      traits: ['brilliant','brave','heroic','clever'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 500000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 90,
      background: '扶风安陵人·投笔从戎·三十六骑定西域·使五十余国朝贡·镇西域三十一年。',
      famousQuote: '不入虎穴，不得虎子。',
      historicalFate: '和帝永元十四年还洛·一月而殁',
      fateHint: 'peacefulDeath'
    },

    caiyong: {
      id: 'caiyong', name: '蔡邕', zi: '伯喈',
      birthYear: 133, deathYear: 192, alternateNames: ['蔡中郎'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '左中郎将', officialTitle: '议郎',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 30, intelligence: 92,
                    charisma: 78, integrity: 85, benevolence: 75,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 50 },
      loyalty: 80, ambition: 50,
      traits: ['scholarly','literary','idealist','reclusive'],
      resources: {
        privateWealth: { money: 80000, land: 2000, treasure: 50000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '陈留圉县·熹平石经·蔡文姬之父·董卓相辟为侍中·董卓被杀·哭于尸侧而被王允下狱。',
      famousQuote: '当其欣于所遇，暂得于己。',
      historicalFate: '初平三年王允下狱死',
      fateHint: 'execution'
    },

    // ─────────────────────────────────────────
    // §3 三国
    // ─────────────────────────────────────────
    liubei: {
      id: 'liubei', name: '刘备', zi: '玄德',
      birthYear: 161, deathYear: 223, alternateNames: ['汉昭烈帝','先主'],
      era: '三国初', dynasty: '蜀汉', role: 'usurper',
      title: '蜀汉昭烈帝', officialTitle: '皇帝',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 85, military: 80, intelligence: 88,
                    charisma: 95, integrity: 80, benevolence: 92,
                    diplomacy: 92, scholarship: 75, finance: 70, cunning: 80 },
      loyalty: 70, ambition: 95,
      traits: ['benevolent','patient','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 30000000, land: 800000, treasure: 80000000, slaves: 30000, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 80,
      background: '涿郡涿县人·汉景帝玄孙·桃园结义·三顾茅庐·入蜀建汉·伐吴大败白帝托孤。',
      famousQuote: '勿以善小而不为，勿以恶小而为之。',
      historicalFate: '章武三年病殁白帝城',
      fateHint: 'peacefulDeath'
    },

    guanyu: {
      id: 'guanyu', name: '关羽', zi: '云长',
      birthYear: 160, deathYear: 220, alternateNames: ['关云长','美髯公','关帝','武圣'],
      era: '三国初', dynasty: '蜀汉', role: 'military',
      title: '汉寿亭侯', officialTitle: '前将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 95, intelligence: 80,
                    charisma: 90, integrity: 95, benevolence: 70,
                    diplomacy: 50, scholarship: 65, finance: 55, cunning: 60 },
      loyalty: 100, ambition: 70,
      traits: ['brave','loyal','proud','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 950, virtueStage: 6
      },
      integrity: 95,
      background: '河东解县人·桃园结义·斩颜良·过五关·水淹七军·大意失荆州·走麦城被擒。',
      famousQuote: '玉可碎而不可改其白，竹可焚而不可毁其节。',
      historicalFate: '建安二十四年被吕蒙俘斩于临沮',
      fateHint: 'martyrdom'
    },

    zhaoyun: {
      id: 'zhaoyun', name: '赵云', zi: '子龙',
      birthYear: 168, deathYear: 229, alternateNames: ['顺平侯'],
      era: '三国初', dynasty: '蜀汉', role: 'military',
      title: '永昌亭侯', officialTitle: '镇东将军',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 92, intelligence: 88,
                    charisma: 88, integrity: 95, benevolence: 88,
                    diplomacy: 60, scholarship: 65, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 50,
      traits: ['brave','loyal','rigorous','heroic'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 300000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '常山真定人·长坂坡七进七出·汉水空营计·一身是胆·五虎上将·终蜀亡前归隐。',
      famousQuote: '吾乃常山赵子龙也。',
      historicalFate: '建兴七年病殁',
      fateHint: 'peacefulDeath'
    },

    zhouyu: {
      id: 'zhouyu', name: '周瑜', zi: '公瑾',
      birthYear: 175, deathYear: 210, alternateNames: ['周郎'],
      era: '三国初', dynasty: '东吴', role: 'military',
      title: '南郡太守', officialTitle: '前部大都督',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 80, military: 95, intelligence: 95,
                    charisma: 95, integrity: 88, benevolence: 80,
                    diplomacy: 88, scholarship: 90, finance: 70, cunning: 88 },
      loyalty: 95, ambition: 80,
      traits: ['brilliant','brave','literary','heroic'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '庐江舒县人·与孙策总角之交·赤壁火攻破曹·欲伐益州未果·三十六殁巴丘。',
      famousQuote: '既生瑜，何生亮。（小说语）',
      historicalFate: '建安十五年病殁巴丘',
      fateHint: 'peacefulDeath'
    },

    xunyu: {
      id: 'xunyu', name: '荀彧', zi: '文若',
      birthYear: 163, deathYear: 212, alternateNames: ['荀令君','王佐之才'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '万岁亭侯', officialTitle: '尚书令',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 75, intelligence: 100,
                    charisma: 88, integrity: 92, benevolence: 85,
                    diplomacy: 92, scholarship: 95, finance: 80, cunning: 92 },
      loyalty: 100, ambition: 60,
      traits: ['brilliant','loyal','rigorous','scholarly'],
      resources: {
        privateWealth: { money: 600000, land: 20000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '颍川人·王佐之才·辅曹操二十年·谏阻九锡·空盒之忌·忧愤而终。',
      famousQuote: '盘飧无肉，止有蔬菜。',
      historicalFate: '建安十七年忧愤而殁·一说服毒',
      fateHint: 'forcedDeath'
    },

    guojia: {
      id: 'guojia', name: '郭嘉', zi: '奉孝',
      birthYear: 170, deathYear: 207, alternateNames: ['鬼才'],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '洧阳亭侯', officialTitle: '司空军祭酒',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 70, military: 88, intelligence: 100,
                    charisma: 75, integrity: 70, benevolence: 60,
                    diplomacy: 75, scholarship: 88, finance: 50, cunning: 100 },
      loyalty: 95, ambition: 60,
      traits: ['brilliant','clever','luxurious','reclusive'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 300000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 600, virtueStage: 5
      },
      integrity: 70,
      background: '颍川阳翟人·荀彧荐于曹·官渡之谋·十胜十败论·北征乌桓殁柳城·年仅三十八。',
      famousQuote: '兵贵神速。',
      historicalFate: '建安十二年病殁柳城',
      fateHint: 'peacefulDeath'
    },

    // ─────────────────────────────────────────
    // §4 两晋南北朝
    // ─────────────────────────────────────────
    xiean: {
      id: 'xiean', name: '谢安', zi: '安石',
      birthYear: 320, deathYear: 385, alternateNames: ['谢太傅','文靖'],
      era: '东晋', dynasty: '东晋', role: 'regent',
      title: '太保·建昌县公', officialTitle: '中书监录尚书事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 75, intelligence: 95,
                    charisma: 95, integrity: 92, benevolence: 88,
                    diplomacy: 92, scholarship: 92, finance: 75, cunning: 85 },
      loyalty: 92, ambition: 60,
      traits: ['brilliant','patient','sage','literary'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '陈郡阳夏人·东山再起四十一岁·淝水之战指挥若定·侄谢玄破符坚百万。',
      famousQuote: '小儿辈遂已破贼。',
      historicalFate: '太元十年病殁建康',
      fateHint: 'peacefulDeath'
    },

    wangmeng: {
      id: 'wangmeng', name: '王猛', zi: '景略',
      birthYear: 325, deathYear: 375, alternateNames: ['苻坚相国'],
      era: '前秦', dynasty: '前秦', role: 'reformer',
      title: '清河郡侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 100, military: 88, intelligence: 95,
                    charisma: 80, integrity: 90, benevolence: 75,
                    diplomacy: 85, scholarship: 80, finance: 92, cunning: 88 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','rigorous','reformist','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '北海剧县人·扪虱论天下·辅符坚十八载·五胡第一相·临终戒勿伐东晋。',
      famousQuote: '不图细事，固能为天下道也。',
      historicalFate: '前秦建元十一年病殁',
      fateHint: 'peacefulDeath'
    },

    taoyuanming: {
      id: 'taoyuanming', name: '陶潜', zi: '渊明',
      birthYear: 365, deathYear: 427, alternateNames: ['五柳先生','靖节先生'],
      era: '东晋末', dynasty: '东晋', role: 'scholar',
      title: '彭泽令', officialTitle: '彭泽县令',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 70, military: 30, intelligence: 88,
                    charisma: 75, integrity: 100, benevolence: 85,
                    diplomacy: 50, scholarship: 100, finance: 40, cunning: 40 },
      loyalty: 80, ambition: 20,
      traits: ['scholarly','reclusive','literary','ascetic'],
      resources: {
        privateWealth: { money: 5000, land: 50, treasure: 1000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '浔阳柴桑人·不为五斗米折腰·归园田居·田园诗鼻祖·桃花源记。',
      famousQuote: '不为五斗米折腰。',
      historicalFate: '宋元嘉四年病殁',
      fateHint: 'retirement'
    },

    // ─────────────────────────────────────────
    // §5 隋唐
    // ─────────────────────────────────────────
    weizheng: {
      id: 'weizheng', name: '魏征', zi: '玄成',
      birthYear: 580, deathYear: 643, alternateNames: ['郑国公','文贞'],
      era: '贞观', dynasty: '唐', role: 'loyal',
      title: '郑国公', officialTitle: '侍中·秘书监',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92,
                    charisma: 80, integrity: 100, benevolence: 85,
                    diplomacy: 85, scholarship: 95, finance: 70, cunning: 65 },
      loyalty: 95, ambition: 60,
      traits: ['upright','loyal','rigorous','scholarly'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 100,
      background: '巨鹿人·先仕李密·后归唐·太宗朝犯颜直谏二百余事·人镜·君臣相得之典范。',
      famousQuote: '兼听则明，偏信则暗。',
      historicalFate: '贞观十七年病殁·太宗哭曰失一镜',
      fateHint: 'peacefulDeath'
    },

    zhangsunWuji: {
      id: 'zhangsunWuji', name: '长孙无忌', zi: '辅机',
      birthYear: 594, deathYear: 659, alternateNames: ['赵国公','文献'],
      era: '贞观-永徽', dynasty: '唐', role: 'regent',
      title: '赵国公', officialTitle: '太尉·同中书门下三品',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 90, military: 70, intelligence: 92,
                    charisma: 80, integrity: 78, benevolence: 70,
                    diplomacy: 88, scholarship: 90, finance: 78, cunning: 88 },
      loyalty: 90, ambition: 80,
      traits: ['brilliant','patient','rigorous','loyal'],
      resources: {
        privateWealth: { money: 3000000, land: 100000, treasure: 5000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 500000, fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 78,
      background: '长孙皇后兄·凌烟阁第一·辅高宗·武则天起后构陷流黔州自缢。',
      famousQuote: '',
      historicalFate: '显庆四年贬黔州自缢',
      fateHint: 'forcedDeath'
    },

    direnjie: {
      id: 'direnjie', name: '狄仁杰', zi: '怀英',
      birthYear: 630, deathYear: 700, alternateNames: ['梁国公','文惠','狄公'],
      era: '武周', dynasty: '唐', role: 'clean',
      title: '梁国公', officialTitle: '内史·同凤阁鸾台平章事',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 65, intelligence: 100,
                    charisma: 85, integrity: 95, benevolence: 90,
                    diplomacy: 88, scholarship: 92, finance: 75, cunning: 92 },
      loyalty: 88, ambition: 60,
      traits: ['brilliant','upright','clever','sage'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 95,
      background: '并州太原人·任大理寺丞断积案·武周朝两度拜相·荐张柬之等·李唐再续之关键。',
      famousQuote: '臣本布衣，蒙陛下拔擢。',
      historicalFate: '久视元年病殁',
      fateHint: 'peacefulDeath'
    },

    shangguanWanEr: {
      id: 'shangguanWanEr', name: '上官婉儿', zi: '',
      birthYear: 664, deathYear: 710, alternateNames: ['上官昭容','巾帼宰相'],
      era: '武周-中宗', dynasty: '唐', role: 'scholar',
      title: '昭容', officialTitle: '掌制诰',
      rankLevel: 25, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 80, military: 30, intelligence: 95,
                    charisma: 92, integrity: 60, benevolence: 60,
                    diplomacy: 88, scholarship: 100, finance: 65, cunning: 92 },
      loyalty: 65, ambition: 85,
      traits: ['literary','clever','scheming','vain'],
      resources: {
        privateWealth: { money: 500000, land: 5000, treasure: 1000000, slaves: 100, commerce: 0 },
        hiddenWealth: 200000, fame: 70, virtueMerit: 500, virtueStage: 4
      },
      integrity: 65,
      background: '上官仪孙女·没入掖庭·武则天召为内舍人·唐中宗朝实掌制诰·诗坛盟主。',
      famousQuote: '叶下洞庭初，思君万里余。',
      historicalFate: '景云元年韦后之乱被李隆基所杀',
      fateHint: 'execution'
    },

    guoZiyi: {
      id: 'guoZiyi', name: '郭子仪', zi: '',
      birthYear: 697, deathYear: 781, alternateNames: ['汾阳郡王','忠武'],
      era: '玄肃代德', dynasty: '唐', role: 'military',
      title: '汾阳郡王', officialTitle: '太尉·中书令',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 85, military: 95, intelligence: 92,
                    charisma: 92, integrity: 92, benevolence: 88,
                    diplomacy: 88, scholarship: 80, finance: 75, cunning: 80 },
      loyalty: 100, ambition: 60,
      traits: ['brilliant','loyal','heroic','patient'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 10000000, slaves: 3000, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 92,
      background: '华州郑县人·安史之乱中流砥柱·两复京师·单骑退回纥·权倾天下而朝不忌·寿八十五。',
      famousQuote: '权倾天下而朝不忌，功盖一代而主不疑。',
      historicalFate: '建中二年寿终·配享代宗庙廷',
      fateHint: 'peacefulDeath'
    },

    libi: {
      id: 'libi', name: '李泌', zi: '长源',
      birthYear: 722, deathYear: 789, alternateNames: ['邺侯'],
      era: '玄肃代德', dynasty: '唐', role: 'scholar',
      title: '邺县侯', officialTitle: '中书侍郎·同平章事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 70, intelligence: 100,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 92, scholarship: 95, finance: 80, cunning: 92 },
      loyalty: 90, ambition: 50,
      traits: ['brilliant','sage','reclusive','scholarly'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '京兆人·四朝元老·三隐三仕·安史中辅肃宗·建中辅德宗·神算贯日。',
      famousQuote: '臣绝粒无家，可信无他。',
      historicalFate: '贞元五年病殁',
      fateHint: 'peacefulDeath'
    },

    hanyu: {
      id: 'hanyu', name: '韩愈', zi: '退之',
      birthYear: 768, deathYear: 824, alternateNames: ['韩昌黎','韩文公','文起八代之衰'],
      era: '德宪穆敬', dynasty: '唐', role: 'scholar',
      title: '昌黎伯', officialTitle: '吏部侍郎',
      rankLevel: 23, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 60, cunning: 50 },
      loyalty: 90, ambition: 70,
      traits: ['scholarly','literary','upright','idealist'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '河阳人·古文运动领袖·谏迎佛骨贬潮州·唐宋八大家之首·文起八代之衰。',
      famousQuote: '业精于勤荒于嬉。',
      historicalFate: '长庆四年病殁',
      fateHint: 'peacefulDeath'
    },

    baijuyi: {
      id: 'baijuyi', name: '白居易', zi: '乐天',
      birthYear: 772, deathYear: 846, alternateNames: ['香山居士','醉吟先生'],
      era: '德宪穆敬武宣', dynasty: '唐', role: 'scholar',
      title: '冯翊县侯', officialTitle: '太子少傅',
      rankLevel: 23, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 25, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 88,
                    diplomacy: 65, scholarship: 100, finance: 60, cunning: 55 },
      loyalty: 88, ambition: 50,
      traits: ['literary','benevolent','reclusive','scholarly'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 880, virtueStage: 6
      },
      integrity: 88,
      background: '太原人·新乐府运动·讽喻诗·长恨歌·琵琶行·晚年香山九老·诗存近三千首。',
      famousQuote: '同是天涯沦落人，相逢何必曾相识。',
      historicalFate: '会昌六年病殁洛阳',
      fateHint: 'peacefulDeath'
    },

    liuyan: {
      id: 'liuyan', name: '刘晏', zi: '士安',
      birthYear: 716, deathYear: 780, alternateNames: ['彭城郡侯'],
      era: '肃代德', dynasty: '唐', role: 'reformer',
      title: '吏部尚书', officialTitle: '盐铁转运使',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 50, intelligence: 95,
                    charisma: 78, integrity: 88, benevolence: 80,
                    diplomacy: 75, scholarship: 88, finance: 100, cunning: 80 },
      loyalty: 92, ambition: 65,
      traits: ['reformist','rigorous','scholarly','patient'],
      resources: {
        privateWealth: { money: 150000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '曹州南华人·神童早慧·安史后整顿盐铁漕运二十年·中唐财政赖此撑持。',
      famousQuote: '理财以爱民为先。',
      historicalFate: '建中元年被卢杞构陷赐死',
      fateHint: 'forcedDeath'
    },

    // ─────────────────────────────────────────
    // §6 宋
    // ─────────────────────────────────────────
    zhaopu: {
      id: 'zhaopu', name: '赵普', zi: '则平',
      birthYear: 922, deathYear: 992, alternateNames: ['韩王','忠献','半部论语治天下'],
      era: '太祖太宗', dynasty: '北宋', role: 'regent',
      title: '韩王', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 70, intelligence: 92,
                    charisma: 78, integrity: 75, benevolence: 70,
                    diplomacy: 85, scholarship: 70, finance: 80, cunning: 92 },
      loyalty: 90, ambition: 75,
      traits: ['brilliant','patient','scheming','rigorous'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 200000, fame: 70, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '幽州蓟人·黄袍加身·杯酒释兵权·建立宋初制度·三度拜相。',
      famousQuote: '半部论语治天下。',
      historicalFate: '淳化三年病殁',
      fateHint: 'peacefulDeath'
    },

    ouyangxiu: {
      id: 'ouyangxiu', name: '欧阳修', zi: '永叔',
      birthYear: 1007, deathYear: 1072, alternateNames: ['醉翁','六一居士','文忠'],
      era: '仁宗英宗', dynasty: '北宋', role: 'scholar',
      title: '兖国公', officialTitle: '参知政事·枢密副使',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 40, intelligence: 92,
                    charisma: 85, integrity: 88, benevolence: 85,
                    diplomacy: 75, scholarship: 100, finance: 65, cunning: 65 },
      loyalty: 92, ambition: 65,
      traits: ['scholarly','literary','upright','reformist'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 90,
      background: '庐陵人·唐宋八大家之一·主修《新唐书》《新五代史》·荐苏氏父子·北宋诗文革新运动领袖。',
      famousQuote: '醉翁之意不在酒。',
      historicalFate: '熙宁五年病殁',
      fateHint: 'peacefulDeath'
    },

    sushi: {
      id: 'sushi', name: '苏轼', zi: '子瞻',
      birthYear: 1037, deathYear: 1101, alternateNames: ['东坡居士','文忠','苏东坡'],
      era: '神哲徽', dynasty: '北宋', role: 'scholar',
      title: '昌化军安置', officialTitle: '翰林学士·礼部尚书',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 35, intelligence: 95,
                    charisma: 92, integrity: 92, benevolence: 92,
                    diplomacy: 70, scholarship: 100, finance: 60, cunning: 60 },
      loyalty: 90, ambition: 50,
      traits: ['literary','benevolent','luxurious','scholarly'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 950, virtueStage: 6
      },
      integrity: 92,
      background: '眉州眉山人·嘉祐进士·旧党新党两不容·乌台诗案贬黄州·三贬岭海·豪放词宗。',
      famousQuote: '大江东去，浪淘尽千古风流人物。',
      historicalFate: '建中靖国元年遇赦北归殁常州',
      fateHint: 'exileDeath'
    },

    zhuxi: {
      id: 'zhuxi', name: '朱熹', zi: '元晦',
      birthYear: 1130, deathYear: 1200, alternateNames: ['晦庵','紫阳','文公','朱子'],
      era: '高孝光宁', dynasty: '南宋', role: 'scholar',
      title: '徽国公', officialTitle: '焕章阁待制',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 100,
                    charisma: 80, integrity: 95, benevolence: 80,
                    diplomacy: 60, scholarship: 100, finance: 60, cunning: 50 },
      loyalty: 92, ambition: 50,
      traits: ['scholarly','rigorous','sage','ascetic'],
      resources: {
        privateWealth: { money: 50000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 98,
      background: '徽州婺源人·绍兴进士·集理学之大成·四书章句集注·儒学第二期奠基人。',
      famousQuote: '存天理，灭人欲。',
      historicalFate: '庆元六年病殁·朱学曾被禁为伪学',
      fateHint: 'peacefulDeath'
    },

    shenkuo: {
      id: 'shenkuo', name: '沈括', zi: '存中',
      birthYear: 1031, deathYear: 1095, alternateNames: ['梦溪丈人'],
      era: '神哲', dynasty: '北宋', role: 'scholar',
      title: '龙图阁直学士', officialTitle: '翰林学士',
      rankLevel: 23, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 65, intelligence: 100,
                    charisma: 75, integrity: 80, benevolence: 75,
                    diplomacy: 75, scholarship: 100, finance: 78, cunning: 80 },
      loyalty: 88, ambition: 65,
      traits: ['brilliant','scholarly','reformist','rigorous'],
      resources: {
        privateWealth: { money: 150000, land: 3000, treasure: 150000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 80,
      background: '杭州钱塘人·王安石党·撰《梦溪笔谈》·载科技天文百家·中国科学史巨擘。',
      famousQuote: '盖术者，先识其理，后会其意。',
      historicalFate: '绍圣二年病殁润州',
      fateHint: 'peacefulDeath'
    },

    // ─────────────────────────────────────────
    // §7 明
    // ─────────────────────────────────────────
    liubowen: {
      id: 'liubowen', name: '刘基', zi: '伯温',
      birthYear: 1311, deathYear: 1375, alternateNames: ['诚意伯','文成','刘青田'],
      era: '元末明初', dynasty: '明', role: 'scholar',
      title: '诚意伯', officialTitle: '御史中丞',
      rankLevel: 26, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 75, intelligence: 100,
                    charisma: 78, integrity: 88, benevolence: 75,
                    diplomacy: 80, scholarship: 95, finance: 75, cunning: 95 },
      loyalty: 90, ambition: 60,
      traits: ['brilliant','scholarly','clever','scheming'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 300000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '处州青田人·辅朱元璋定天下·陈友谅鄱阳湖之战决胜·烧饼歌之神算。',
      famousQuote: '夫圣人之治天下也，先足而后教。',
      historicalFate: '洪武八年忧愤而殁·一说被胡惟庸毒杀',
      fateHint: 'forcedDeath'
    },

    yuqian: {
      id: 'yuqian', name: '于谦', zi: '廷益',
      birthYear: 1398, deathYear: 1457, alternateNames: ['节庵','忠肃'],
      era: '土木堡前后', dynasty: '明', role: 'loyal',
      title: '少保', officialTitle: '兵部尚书',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 90, intelligence: 92,
                    charisma: 88, integrity: 100, benevolence: 88,
                    diplomacy: 75, scholarship: 90, finance: 85, cunning: 80 },
      loyalty: 100, ambition: 70,
      traits: ['loyal','heroic','upright','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '钱塘人·土木之变力挽狂澜·北京保卫战·夺门之变后被冤斩西市·家无余资。',
      famousQuote: '粉身碎骨浑不怕，要留清白在人间。',
      historicalFate: '天顺元年夺门之变被杀·成化初年昭雪',
      fateHint: 'executionByFraming'
    },

    wangshouren: {
      id: 'wangshouren', name: '王守仁', zi: '伯安',
      birthYear: 1472, deathYear: 1529, alternateNames: ['王阳明','文成','新建伯','阳明先生'],
      era: '正德嘉靖', dynasty: '明', role: 'scholar',
      title: '新建伯', officialTitle: '南京兵部尚书',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 90, military: 92, intelligence: 100,
                    charisma: 92, integrity: 95, benevolence: 88,
                    diplomacy: 88, scholarship: 100, finance: 78, cunning: 95 },
      loyalty: 92, ambition: 70,
      traits: ['brilliant','scholarly','sage','heroic'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 95,
      background: '余姚人·心学集大成·龙场悟道·平宁王朱宸濠之乱·三不朽·开陆王心学一派。',
      famousQuote: '知行合一·致良知。',
      historicalFate: '嘉靖七年于归途病殁江西',
      fateHint: 'peacefulDeath'
    },

    qijiguang: {
      id: 'qijiguang', name: '戚继光', zi: '元敬',
      birthYear: 1528, deathYear: 1588, alternateNames: ['南塘','孟诸','武毅'],
      era: '嘉靖隆庆万历', dynasty: '明', role: 'military',
      title: '少保', officialTitle: '蓟州总兵',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 92,
                    charisma: 85, integrity: 88, benevolence: 80,
                    diplomacy: 70, scholarship: 88, finance: 70, cunning: 88 },
      loyalty: 90, ambition: 70,
      traits: ['brilliant','rigorous','brave','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 85,
      background: '山东蓬莱人·组戚家军平倭·北镇蓟门十六年防鞑靼·撰《纪效新书》《练兵实纪》。',
      famousQuote: '封侯非我意，但愿海波平。',
      historicalFate: '万历十六年罢职归乡贫病而殁',
      fateHint: 'retirement'
    },

    xiejin: {
      id: 'xiejin', name: '解缙', zi: '大绅',
      birthYear: 1369, deathYear: 1415, alternateNames: ['春雨','喜易'],
      era: '洪武永乐', dynasty: '明', role: 'scholar',
      title: '右春坊大学士', officialTitle: '内阁首辅',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 30, intelligence: 95,
                    charisma: 78, integrity: 70, benevolence: 70,
                    diplomacy: 60, scholarship: 100, finance: 60, cunning: 65 },
      loyalty: 80, ambition: 80,
      traits: ['brilliant','literary','proud','ambitious'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5
      },
      integrity: 70,
      background: '吉水人·总裁《永乐大典》·首批阁臣之一·言事得罪·下诏狱被埋雪中冻死。',
      famousQuote: '太子之诚仁明孝友，臣以为可托天下。',
      historicalFate: '永乐十三年狱中被埋雪冻死',
      fateHint: 'executionByFraming'
    },

    yangshiqi: {
      id: 'yangshiqi', name: '杨士奇', zi: '士奇',
      birthYear: 1366, deathYear: 1444, alternateNames: ['东里','文贞'],
      era: '永乐-正统', dynasty: '明', role: 'scholar',
      title: '少师', officialTitle: '内阁首辅',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92,
                    charisma: 80, integrity: 88, benevolence: 80,
                    diplomacy: 85, scholarship: 92, finance: 75, cunning: 80 },
      loyalty: 92, ambition: 65,
      traits: ['rigorous','scholarly','patient','clever'],
      resources: {
        privateWealth: { money: 300000, land: 8000, treasure: 300000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 82, virtueMerit: 800, virtueStage: 6
      },
      integrity: 85,
      background: '泰和人·三杨之首·历事五朝·辅太子高炽即仁宗·主导仁宣之治·内阁制完善。',
      famousQuote: '为政以宽。',
      historicalFate: '正统九年病殁',
      fateHint: 'peacefulDeath'
    },

    // ─────────────────────────────────────────
    // §8 清
    // ─────────────────────────────────────────
    duoergun: {
      id: 'duoergun', name: '多尔衮', zi: '',
      birthYear: 1612, deathYear: 1650, alternateNames: ['睿亲王','成宗义皇帝'],
      era: '清初', dynasty: '清', role: 'regent',
      title: '皇父摄政王', officialTitle: '摄政王',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 95, intelligence: 92,
                    charisma: 85, integrity: 65, benevolence: 50,
                    diplomacy: 88, scholarship: 70, finance: 75, cunning: 92 },
      loyalty: 70, ambition: 95,
      traits: ['brilliant','ruthless','brave','ambitious'],
      resources: {
        privateWealth: { money: 10000000, land: 500000, treasure: 30000000, slaves: 5000, commerce: 0 },
        hiddenWealth: 5000000, fame: 30, virtueMerit: 400, virtueStage: 4
      },
      integrity: 65,
      background: '努尔哈赤十四子·入关定鼎·辅幼主顺治·权倾天下·死后三月被追夺。',
      famousQuote: '',
      historicalFate: '顺治七年坠马而殁·后被追夺爵位毁陵',
      fateHint: 'posthumousConfiscation'
    },

    wuSangui: {
      id: 'wuSangui', name: '吴三桂', zi: '长伯',
      birthYear: 1612, deathYear: 1678, alternateNames: ['平西王','大周昭武皇帝'],
      era: '明末清初', dynasty: '清', role: 'usurper',
      title: '平西王·大周皇帝', officialTitle: '平西王',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 92, intelligence: 80,
                    charisma: 78, integrity: 30, benevolence: 40,
                    diplomacy: 65, scholarship: 70, finance: 75, cunning: 88 },
      loyalty: 25, ambition: 95,
      traits: ['brave','scheming','ambitious','ruthless'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 20000000, slaves: 5000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -50, virtueMerit: 200, virtueStage: 2
      },
      integrity: 30,
      background: '辽东人·冲冠一怒为红颜·开山海关引清入关·云南藩王·三藩之乱称帝衡州。',
      famousQuote: '',
      historicalFate: '吴周昭武元年病殁·三藩之乱败',
      fateHint: 'forcedDeath'
    },

    zhangtingyu: {
      id: 'zhangtingyu', name: '张廷玉', zi: '衡臣',
      birthYear: 1672, deathYear: 1755, alternateNames: ['砚斋','文和'],
      era: '康雍乾', dynasty: '清', role: 'regent',
      title: '太保·三等伯', officialTitle: '保和殿大学士',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 50, intelligence: 92,
                    charisma: 78, integrity: 88, benevolence: 75,
                    diplomacy: 88, scholarship: 92, finance: 80, cunning: 88 },
      loyalty: 95, ambition: 65,
      traits: ['rigorous','patient','scholarly','loyal'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 750, virtueStage: 5
      },
      integrity: 88,
      background: '安徽桐城人·历仕康雍乾三朝五十年·军机处奠基·清代汉臣配享太庙独此一人。',
      famousQuote: '万言万当，不如一默。',
      historicalFate: '乾隆二十年病殁·配享太庙',
      fateHint: 'peacefulDeath'
    },

    linZexu: {
      id: 'linZexu', name: '林则徐', zi: '元抚',
      birthYear: 1785, deathYear: 1850, alternateNames: ['少穆','文忠'],
      era: '道光', dynasty: '清', role: 'clean',
      title: '太子太保', officialTitle: '湖广总督·钦差大臣',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 70, intelligence: 92,
                    charisma: 85, integrity: 100, benevolence: 90,
                    diplomacy: 80, scholarship: 92, finance: 85, cunning: 75 },
      loyalty: 100, ambition: 70,
      traits: ['upright','rigorous','heroic','loyal'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 98, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '福建侯官人·虎门销烟·主持《海国图志》编纂·中国近代睁眼看世界第一人。',
      famousQuote: '苟利国家生死以，岂因祸福避趋之。',
      historicalFate: '道光三十年起复途中病殁普宁',
      fateHint: 'peacefulDeath'
    },

    zengGuofan: {
      id: 'zengGuofan', name: '曾国藩', zi: '伯涵',
      birthYear: 1811, deathYear: 1872, alternateNames: ['涤生','文正','曾文正'],
      era: '咸同', dynasty: '清', role: 'scholar',
      title: '一等毅勇侯', officialTitle: '两江总督·直隶总督',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 88, intelligence: 92,
                    charisma: 85, integrity: 92, benevolence: 80,
                    diplomacy: 88, scholarship: 95, finance: 80, cunning: 88 },
      loyalty: 95, ambition: 75,
      traits: ['rigorous','scholarly','patient','heroic'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 90,
      background: '湖南湘乡人·组湘军镇太平天国·中兴第一名臣·洋务派领袖·一日三省家书传家。',
      famousQuote: '慎独则心安·主敬则身强。',
      historicalFate: '同治十一年病殁两江督署',
      fateHint: 'peacefulDeath'
    },

    zuoZongtang: {
      id: 'zuoZongtang', name: '左宗棠', zi: '季高',
      birthYear: 1812, deathYear: 1885, alternateNames: ['今亮','文襄','左文襄'],
      era: '咸同光', dynasty: '清', role: 'military',
      title: '二等恪靖侯', officialTitle: '军机大臣·两江总督',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 90, military: 95, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 80,
                    diplomacy: 80, scholarship: 88, finance: 82, cunning: 85 },
      loyalty: 95, ambition: 78,
      traits: ['brilliant','heroic','rigorous','proud'],
      resources: {
        privateWealth: { money: 600000, land: 15000, treasure: 1000000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 88,
      background: '湖南湘阴人·组楚军镇捻平回·抬棺西征收复新疆·办洋务·近代海防陆防之重臣。',
      famousQuote: '身无半亩，心忧天下。',
      historicalFate: '光绪十一年病殁福州',
      fateHint: 'peacefulDeath'
    },
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-01] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
