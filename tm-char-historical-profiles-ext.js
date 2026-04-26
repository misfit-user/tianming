// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// tm-char-historical-profiles-ext.js — 历史人物档案库扩充
//
// 与 tm-char-historical-profiles.js 共用 HISTORICAL_CHAR_PROFILES 命名空间
// 通过 Object.assign 合并·不覆盖核心 27 条
//
// 当前条目按朝代分组：
//   §1 周/春秋战国: 姜尚/周公/管仲/晏婴/范蠡/孔子/老子/孙武/吴起/屈原/廉颇/蔺相如/白起/王翦
//   §2 两汉:        张良/陈平/贾谊/董仲舒/卫青/霍去病/张骞/王莽/刘秀/班超/蔡邕
//   §3 三国:        刘备/关羽/张飞/赵云/周瑜/荀彧/郭嘉
//   §4 两晋南北朝:   谢安/王猛/陶渊明
//   §5 隋唐:        魏征/长孙无忌/狄仁杰/上官婉儿/郭子仪/李泌/韩愈/白居易/刘晏
//   §6 宋:          赵普/欧阳修/苏轼/朱熹/沈括
//   §7 明:          刘伯温/于谦/王守仁/戚继光/解缙/杨士奇
//   §8 清:          多尔衮/吴三桂/张廷玉/林则徐/曾国藩/左宗棠
//
// 扩充进度：本批 ~60 人·目标 500 人·剩余按朝代续写
// ═══════════════════════════════════════════════════════════════

(function(global){
  'use strict';

  if (!global.HISTORICAL_CHAR_PROFILES) {
    global.HISTORICAL_CHAR_PROFILES = {};
  }

  var EXT_PROFILES = {

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

    // ═════════════════════════════════════════
    // 波 2 扩充（春秋战国-清·名相名将名儒）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 3 扩充（春秋-清·名臣武将谋士）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 4 扩充（春秋-清·名臣武将思想家）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 5 扩充（唐宋盛世名相 + 明清清流 + 武将）
    // ═════════════════════════════════════════

    duruHui: {
      id: 'duruHui', name: '杜如晦', zi: '克明',
      birthYear: 585, deathYear: 630, alternateNames: ['莱国成公'],
      era: '初唐', dynasty: '唐', role: 'regent',
      title: '莱国公', officialTitle: '尚书右仆射',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 65, intelligence: 95,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 80, scholarship: 92, finance: 78, cunning: 88 },
      loyalty: 95, ambition: 60,
      traits: ['brilliant','rigorous','patient','sage'],
      resources: {
        privateWealth: { money: 300000, land: 8000, treasure: 300000, slaves: 100, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '京兆杜陵人·房玄龄并称房谋杜断·凌烟阁第三·玄武门首谋·英年早逝。',
      famousQuote: '论事如断·绝无二想。',
      historicalFate: '贞观四年病殁·年仅四十六',
      fateHint: 'peacefulDeath'
    },

    yanZhenqing: {
      id: 'yanZhenqing', name: '颜真卿', zi: '清臣',
      birthYear: 709, deathYear: 785, alternateNames: ['颜鲁公','文忠'],
      era: '玄宗-德宗朝', dynasty: '唐', role: 'loyal',
      title: '鲁郡公', officialTitle: '吏部尚书·太子太师',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 70, intelligence: 88,
                    charisma: 80, integrity: 100, benevolence: 85,
                    diplomacy: 65, scholarship: 100, finance: 65, cunning: 65 },
      loyalty: 100, ambition: 70,
      traits: ['loyal','heroic','literary','rigorous'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 920, virtueStage: 6
      },
      integrity: 100,
      background: '京兆万年人·颜氏家训之后·安史之乱率二十郡抗·唐楷四大家·使李希烈不屈被缢杀。',
      famousQuote: '吾年且八十·官至太师·吾守吾节·死而后已。',
      historicalFate: '兴元元年使李希烈·拒降被缢杀',
      fateHint: 'martyrdom'
    },

    zhangXun: {
      id: 'zhangXun', name: '张巡', zi: '',
      birthYear: 708, deathYear: 757, alternateNames: ['通真三太子','忠烈'],
      era: '玄宗朝', dynasty: '唐', role: 'loyal',
      title: '邓国公', officialTitle: '河南节度副使',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 95,
                    charisma: 85, integrity: 100, benevolence: 75,
                    diplomacy: 60, scholarship: 88, finance: 60, cunning: 92 },
      loyalty: 100, ambition: 70,
      traits: ['heroic','loyal','brave','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 100, virtueMerit: 1000, virtueStage: 6
      },
      integrity: 100,
      background: '邓州南阳人·安史时与许远死守睢阳十月·一城阻安史南下·城破不屈被害。',
      famousQuote: '吾欲杀此贼·恨力不及·徒以身殉社稷·岂悔哉。',
      historicalFate: '至德二载睢阳城破被害',
      fateHint: 'martyrdom'
    },

    yuanZhen: {
      id: 'yuanZhen', name: '元稹', zi: '微之',
      birthYear: 779, deathYear: 831, alternateNames: ['威明','元才子'],
      era: '宪穆敬文朝', dynasty: '唐', role: 'scholar',
      title: '武昌军节度使', officialTitle: '尚书右丞',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 35, intelligence: 92,
                    charisma: 88, integrity: 75, benevolence: 75,
                    diplomacy: 65, scholarship: 100, finance: 60, cunning: 70 },
      loyalty: 80, ambition: 75,
      traits: ['literary','luxurious','idealist','clever'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '河南人·与白居易并称元白·新乐府运动·撰《莺莺传》·历历贬官·武昌任上殁。',
      famousQuote: '曾经沧海难为水，除却巫山不是云。',
      historicalFate: '太和五年武昌任上暴病而殁',
      fateHint: 'peacefulDeath'
    },

    liuZongyuan: {
      id: 'liuZongyuan', name: '柳宗元', zi: '子厚',
      birthYear: 773, deathYear: 819, alternateNames: ['柳河东','柳柳州','柳子厚'],
      era: '德宪朝', dynasty: '唐', role: 'scholar',
      title: '柳州刺史', officialTitle: '柳州刺史',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 85, military: 30, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 92,
                    diplomacy: 50, scholarship: 100, finance: 65, cunning: 60 },
      loyalty: 95, ambition: 70,
      traits: ['literary','idealist','reformist','scholarly'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '河东解人·永贞革新参与·失败贬永州·后柳州·辟瘴改俗·唐宋八大家之一。',
      famousQuote: '苛政猛于虎也。',
      historicalFate: '元和十四年柳州任上殁',
      fateHint: 'exileDeath'
    },

    duMu: {
      id: 'duMu', name: '杜牧', zi: '牧之',
      birthYear: 803, deathYear: 852, alternateNames: ['樊川居士','小杜'],
      era: '文宣朝', dynasty: '唐', role: 'scholar',
      title: '中书舍人', officialTitle: '中书舍人',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 50, intelligence: 92,
                    charisma: 88, integrity: 80, benevolence: 78,
                    diplomacy: 60, scholarship: 100, finance: 55, cunning: 70 },
      loyalty: 80, ambition: 65,
      traits: ['literary','luxurious','idealist','heroic'],
      resources: {
        privateWealth: { money: 100000, land: 1500, treasure: 80000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 82,
      background: '京兆万年人·杜佑孙·小杜·樊川集·阿房宫赋·过华清宫·与李商隐并称小李杜。',
      famousQuote: '商女不知亡国恨，隔江犹唱后庭花。',
      historicalFate: '大中六年病殁长安',
      fateHint: 'peacefulDeath'
    },

    liShangyin: {
      id: 'liShangyin', name: '李商隐', zi: '义山',
      birthYear: 813, deathYear: 858, alternateNames: ['玉溪生','樊南生'],
      era: '文武宣朝', dynasty: '唐', role: 'scholar',
      title: '盐铁推官', officialTitle: '检校工部员外郎',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 55, military: 25, intelligence: 92,
                    charisma: 80, integrity: 88, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 75, ambition: 60,
      traits: ['literary','idealist','reclusive','sage'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 750, virtueStage: 5
      },
      integrity: 88,
      background: '怀州河内人·牛李党争夹缝·令狐楚弟子娶王茂元女·一生郁郁·朦胧诗鼻祖。',
      famousQuote: '春蚕到死丝方尽，蜡炬成灰泪始干。',
      historicalFate: '大中十二年病殁郑州',
      fateHint: 'peacefulDeath'
    },

    gaoshi: {
      id: 'gaoshi', name: '高适', zi: '达夫',
      birthYear: 704, deathYear: 765, alternateNames: ['渤海县侯','忠'],
      era: '玄肃代朝', dynasty: '唐', role: 'scholar',
      title: '渤海县侯', officialTitle: '剑南西川节度使',
      rankLevel: 24, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 78, military: 80, intelligence: 88,
                    charisma: 85, integrity: 88, benevolence: 78,
                    diplomacy: 70, scholarship: 100, finance: 65, cunning: 75 },
      loyalty: 92, ambition: 75,
      traits: ['literary','heroic','brave','idealist'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '渤海蓨人·边塞诗派·五十而仕·玄宗西狩从行·唐代诗人封侯第一人。',
      famousQuote: '莫愁前路无知己，天下谁人不识君。',
      historicalFate: '永泰元年病殁',
      fateHint: 'peacefulDeath'
    },

    chengyi: {
      id: 'chengyi', name: '程颐', zi: '正叔',
      birthYear: 1033, deathYear: 1107, alternateNames: ['伊川先生'],
      era: '神哲徽朝', dynasty: '北宋', role: 'scholar',
      title: '崇政殿说书', officialTitle: '崇政殿说书',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 25, intelligence: 95,
                    charisma: 75, integrity: 95, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 55 },
      loyalty: 92, ambition: 50,
      traits: ['scholarly','sage','rigorous','ascetic'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 98,
      background: '洛阳人·二程之弟·程门立雪·与兄共开洛学·主张存天理灭人欲·程朱理学奠基。',
      famousQuote: '存天理·灭人欲。',
      historicalFate: '大观元年病殁',
      fateHint: 'peacefulDeath'
    },

    zhouDunyi: {
      id: 'zhouDunyi', name: '周敦颐', zi: '茂叔',
      birthYear: 1017, deathYear: 1073, alternateNames: ['濂溪先生','元'],
      era: '仁宗英宗', dynasty: '北宋', role: 'scholar',
      title: '尚书都官员外郎', officialTitle: '广南东路转运判官',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 75, military: 30, intelligence: 92,
                    charisma: 78, integrity: 95, benevolence: 88,
                    diplomacy: 50, scholarship: 100, finance: 55, cunning: 55 },
      loyalty: 90, ambition: 50,
      traits: ['scholarly','sage','reclusive','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 500, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '道州营道人·二程之师·撰《太极图说》《通书》·爱莲说·宋明理学开山。',
      famousQuote: '出淤泥而不染，濯清涟而不妖。',
      historicalFate: '熙宁六年病殁',
      fateHint: 'peacefulDeath'
    },

    liuyong: {
      id: 'liuyong', name: '柳永', zi: '耆卿',
      birthYear: 984, deathYear: 1053, alternateNames: ['柳七','柳屯田','三变'],
      era: '真仁朝', dynasty: '北宋', role: 'scholar',
      title: '屯田员外郎', officialTitle: '屯田员外郎',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 50, military: 20, intelligence: 88,
                    charisma: 95, integrity: 70, benevolence: 70,
                    diplomacy: 55, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 65, ambition: 55,
      traits: ['literary','luxurious','reclusive','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '崇安人·奉旨填词柳三变·屯田词·凡有井水处皆能歌柳词·北宋婉约第一。',
      famousQuote: '衣带渐宽终不悔，为伊消得人憔悴。',
      historicalFate: '皇祐五年贫病殁润州·歌妓集资葬之',
      fateHint: 'exileDeath'
    },

    yanShu: {
      id: 'yanShu', name: '晏殊', zi: '同叔',
      birthYear: 991, deathYear: 1055, alternateNames: ['临淄公','元献'],
      era: '真仁朝', dynasty: '北宋', role: 'regent',
      title: '临淄公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92,
                    charisma: 88, integrity: 92, benevolence: 85,
                    diplomacy: 80, scholarship: 100, finance: 78, cunning: 75 },
      loyalty: 92, ambition: 60,
      traits: ['literary','rigorous','patient','sage'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 800, virtueStage: 6
      },
      integrity: 92,
      background: '抚州临川人·神童入仕·荐范仲淹欧阳修·北宋第一词宗之一·珠玉词。',
      famousQuote: '无可奈何花落去，似曾相识燕归来。',
      historicalFate: '至和二年病殁',
      fateHint: 'peacefulDeath'
    },

    tongguan: {
      id: 'tongguan', name: '童贯', zi: '道夫',
      birthYear: 1054, deathYear: 1126, alternateNames: ['広阳郡王','媪相'],
      era: '徽宗朝', dynasty: '北宋', role: 'eunuch',
      title: '広阳郡王', officialTitle: '太尉·开府仪同三司',
      rankLevel: 30, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 70, military: 65, intelligence: 80,
                    charisma: 75, integrity: 15, benevolence: 30,
                    diplomacy: 78, scholarship: 60, finance: 75, cunning: 92 },
      loyalty: 25, ambition: 95,
      traits: ['scheming','greedy','flatterer','vain'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 30000000, slaves: 3000, commerce: 1000000 },
        hiddenWealth: 5000000, fame: -85, virtueMerit: 50, virtueStage: 1
      },
      integrity: 18,
      background: '开封人·宦官封王第一人·六贼之一·握兵二十年·联金灭辽·靖康之变后被斩。',
      famousQuote: '',
      historicalFate: '靖康元年钦宗诛之',
      fateHint: 'execution'
    },

    huangzhong: {
      id: 'huangzhong', name: '黄忠', zi: '汉升',
      birthYear: 145, deathYear: 220, alternateNames: ['关内侯','刚'],
      era: '汉末三国', dynasty: '蜀汉', role: 'military',
      title: '关内侯', officialTitle: '后将军',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 55, military: 92, intelligence: 75,
                    charisma: 80, integrity: 92, benevolence: 75,
                    diplomacy: 50, scholarship: 50, finance: 50, cunning: 65 },
      loyalty: 95, ambition: 60,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 92,
      background: '南阳人·定军山阵斩夏侯渊·六十而尤勇·五虎上将之老将·夷陵前殁。',
      famousQuote: '老当益壮·宁移白首之心。',
      historicalFate: '建安二十五年病殁',
      fateHint: 'peacefulDeath'
    },

    weiyan: {
      id: 'weiyan', name: '魏延', zi: '文长',
      birthYear: 175, deathYear: 234, alternateNames: ['南郑侯'],
      era: '三国', dynasty: '蜀汉', role: 'military',
      title: '南郑侯', officialTitle: '前军师·征西大将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 92, intelligence: 80,
                    charisma: 70, integrity: 75, benevolence: 60,
                    diplomacy: 50, scholarship: 55, finance: 55, cunning: 78 },
      loyalty: 80, ambition: 90,
      traits: ['brave','heroic','proud','ambitious'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 75, virtueMerit: 500, virtueStage: 4
      },
      integrity: 75,
      background: '义阳人·随刘备入蜀·镇汉中十余年·子午谷奇谋·诸葛亮死后与杨仪争权被杀。',
      famousQuote: '丞相虽亡·吾自见在·岂可便以一人死废天下事耶。',
      historicalFate: '建兴十二年汉中军中被马岱所斩',
      fateHint: 'executionByFraming'
    },

    lvmeng: {
      id: 'lvmeng', name: '吕蒙', zi: '子明',
      birthYear: 178, deathYear: 220, alternateNames: ['孱陵侯'],
      era: '三国', dynasty: '东吴', role: 'military',
      title: '孱陵侯', officialTitle: '南郡太守',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 92, intelligence: 92,
                    charisma: 80, integrity: 85, benevolence: 70,
                    diplomacy: 70, scholarship: 75, finance: 60, cunning: 92 },
      loyalty: 95, ambition: 75,
      traits: ['brilliant','brave','clever','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 700, virtueStage: 5
      },
      integrity: 85,
      background: '汝南富陂人·吴下阿蒙·士别三日刮目相看·白衣渡江袭荆州擒关羽·寻亦病亡。',
      famousQuote: '士别三日·即更刮目相待。',
      historicalFate: '建安二十五年关羽事后旋即病殁',
      fateHint: 'peacefulDeath'
    },

    taiShici: {
      id: 'taiShici', name: '太史慈', zi: '子义',
      birthYear: 166, deathYear: 206, alternateNames: ['信义子'],
      era: '汉末三国', dynasty: '东吴', role: 'military',
      title: '建昌都尉', officialTitle: '建昌都尉',
      rankLevel: 18, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 92, intelligence: 80,
                    charisma: 85, integrity: 95, benevolence: 75,
                    diplomacy: 65, scholarship: 65, finance: 50, cunning: 75 },
      loyalty: 95, ambition: 65,
      traits: ['brave','heroic','loyal','rigorous'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 50000, slaves: 20, commerce: 0 },
        hiddenWealth: 0, fame: 85, virtueMerit: 800, virtueStage: 6
      },
      integrity: 95,
      background: '东莱黄人·北海救孔融·与孙策小将神亭对枪·镇南方诸郡·英年病殁。',
      famousQuote: '丈夫生世·当带七尺之剑·以升天子之阶·今所志未从·奈何而死乎。',
      historicalFate: '建安十一年病殁·年仅四十一',
      fateHint: 'peacefulDeath'
    },

    xuchu: {
      id: 'xuchu', name: '许褚', zi: '仲康',
      birthYear: 170, deathYear: 232, alternateNames: ['牟乡壮侯','虎痴'],
      era: '汉末三国', dynasty: '曹魏', role: 'military',
      title: '牟乡侯', officialTitle: '武卫将军',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 50, military: 95, intelligence: 65,
                    charisma: 75, integrity: 92, benevolence: 70,
                    diplomacy: 40, scholarship: 30, finance: 50, cunning: 50 },
      loyalty: 100, ambition: 50,
      traits: ['brave','loyal','heroic','rigorous'],
      resources: {
        privateWealth: { money: 300000, land: 5000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5
      },
      integrity: 95,
      background: '谯国谯县人·虎痴·力大如牛·裸衣斗马超·渭水救曹·曹魏三朝护卫。',
      famousQuote: '',
      historicalFate: '太和六年病殁',
      fateHint: 'peacefulDeath'
    },

    dianwei: {
      id: 'dianwei', name: '典韦', zi: '',
      birthYear: 165, deathYear: 197, alternateNames: ['古之恶来'],
      era: '汉末', dynasty: '曹魏', role: 'military',
      title: '都尉', officialTitle: '校尉',
      rankLevel: 16, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 45, military: 95, intelligence: 65,
                    charisma: 75, integrity: 95, benevolence: 70,
                    diplomacy: 35, scholarship: 25, finance: 40, cunning: 50 },
      loyalty: 100, ambition: 50,
      traits: ['brave','loyal','heroic','humble_origin'],
      resources: {
        privateWealth: { money: 100000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 100,
      background: '陈留己吾人·古之恶来·双戟力可万夫·宛城死战护曹操·身被数十创立而死。',
      famousQuote: '',
      historicalFate: '建安二年宛城之变·力战护主而殁',
      fateHint: 'martyrdom'
    },

    xieXuan: {
      id: 'xieXuan', name: '谢玄', zi: '幼度',
      birthYear: 343, deathYear: 388, alternateNames: ['康乐县公','献武'],
      era: '东晋', dynasty: '东晋', role: 'military',
      title: '康乐县公', officialTitle: '东部都督',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 78, military: 95, intelligence: 92,
                    charisma: 85, integrity: 90, benevolence: 80,
                    diplomacy: 70, scholarship: 88, finance: 70, cunning: 88 },
      loyalty: 95, ambition: 70,
      traits: ['brilliant','brave','heroic','rigorous'],
      resources: {
        privateWealth: { money: 1000000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 92,
      background: '陈郡阳夏人·谢安侄·组建北府兵·淝水之战大破前秦百万·东晋中兴名将。',
      famousQuote: '小儿辈大破贼。',
      historicalFate: '太元十三年病殁',
      fateHint: 'peacefulDeath'
    },

    zhanghan: {
      id: 'zhanghan', name: '章邯', zi: '',
      birthYear: -260, deathYear: -205, alternateNames: ['雍王'],
      era: '秦末', dynasty: '秦', role: 'military',
      title: '雍王', officialTitle: '少府·上将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 90, intelligence: 80,
                    charisma: 75, integrity: 78, benevolence: 60,
                    diplomacy: 60, scholarship: 50, finance: 70, cunning: 75 },
      loyalty: 70, ambition: 70,
      traits: ['brave','rigorous','heroic','patient'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 65, virtueMerit: 500, virtueStage: 4
      },
      integrity: 75,
      background: '秦末名将·少府·率刑徒大破陈胜项梁·巨鹿败于项羽·降为雍王·汉攻楚自刎。',
      famousQuote: '',
      historicalFate: '汉二年汉攻楚围废丘·城破自刎',
      fateHint: 'martyrdom'
    },

    zhuFuyan: {
      id: 'zhuFuyan', name: '主父偃', zi: '',
      birthYear: -169, deathYear: -126, alternateNames: [],
      era: '武帝朝', dynasty: '西汉', role: 'reformer',
      title: '齐相', officialTitle: '齐相',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 30, intelligence: 95,
                    charisma: 70, integrity: 50, benevolence: 35,
                    diplomacy: 75, scholarship: 88, finance: 75, cunning: 95 },
      loyalty: 75, ambition: 95,
      traits: ['brilliant','scheming','ambitious','ruthless'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 30, virtueMerit: 400, virtueStage: 4
      },
      integrity: 50,
      background: '齐国临淄人·四十余穷困·武帝召见·推恩令削藩·齐王自杀·公孙弘构陷·夷三族。',
      famousQuote: '生不五鼎食·死即五鼎烹耳。',
      historicalFate: '元朔二年坐齐王自杀案·夷三族',
      fateHint: 'executionByClanDestruction'
    },

    dongFangshuo: {
      id: 'dongFangshuo', name: '东方朔', zi: '曼倩',
      birthYear: -154, deathYear: -93, alternateNames: ['曼倩','滑稽之雄'],
      era: '武帝朝', dynasty: '西汉', role: 'scholar',
      title: '太中大夫', officialTitle: '常侍郎',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 30, intelligence: 100,
                    charisma: 95, integrity: 80, benevolence: 78,
                    diplomacy: 88, scholarship: 100, finance: 60, cunning: 95 },
      loyalty: 80, ambition: 60,
      traits: ['clever','literary','luxurious','sage'],
      resources: {
        privateWealth: { money: 100000, land: 2000, treasure: 80000, slaves: 30, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 700, virtueStage: 5
      },
      integrity: 82,
      background: '平原厌次人·武帝朝弄臣·滑稽善辩·讽谏直言·三冬文史足用·岁星谪人。',
      famousQuote: '宁可玩世·不可苟世。',
      historicalFate: '武帝太始四年病殁',
      fateHint: 'peacefulDeath'
    },

    zhaoChongguo: {
      id: 'zhaoChongguo', name: '赵充国', zi: '翁孙',
      birthYear: -137, deathYear: -52, alternateNames: ['营平壮侯'],
      era: '武昭宣朝', dynasty: '西汉', role: 'military',
      title: '营平侯', officialTitle: '后将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 85, military: 95, intelligence: 92,
                    charisma: 80, integrity: 92, benevolence: 80,
                    diplomacy: 75, scholarship: 78, finance: 75, cunning: 88 },
      loyalty: 95, ambition: 65,
      traits: ['brave','heroic','rigorous','patient'],
      resources: {
        privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '陇西上邽人·武宣朝大将·征匈奴·平西羌·七十而出·屯田疏长策传世。',
      famousQuote: '百闻不如一见。',
      historicalFate: '宣帝甘露二年寿终',
      fateHint: 'peacefulDeath'
    },

    huangZongxi: {
      id: 'huangZongxi', name: '黄宗羲', zi: '太冲',
      birthYear: 1610, deathYear: 1695, alternateNames: ['梨洲先生','南雷'],
      era: '明末清初', dynasty: '明', role: 'scholar',
      title: '', officialTitle: '',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 80, military: 50, intelligence: 95,
                    charisma: 78, integrity: 95, benevolence: 88,
                    diplomacy: 50, scholarship: 100, finance: 60, cunning: 70 },
      loyalty: 100, ambition: 65,
      traits: ['scholarly','idealist','heroic','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6
      },
      integrity: 98,
      background: '余姚人·东林党人黄尊素子·明亡参与抗清·撰《明夷待访录》·天下为主君为客·近代民主先声。',
      famousQuote: '天下为主，君为客。',
      historicalFate: '康熙三十四年病殁',
      fateHint: 'retirement'
    },

    yangShen: {
      id: 'yangShen', name: '杨慎', zi: '用修',
      birthYear: 1488, deathYear: 1559, alternateNames: ['升庵','文宪'],
      era: '正德嘉靖', dynasty: '明', role: 'scholar',
      title: '翰林修撰', officialTitle: '翰林修撰',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 25, intelligence: 92,
                    charisma: 80, integrity: 95, benevolence: 78,
                    diplomacy: 50, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 95, ambition: 50,
      traits: ['literary','scholarly','idealist','sage'],
      resources: {
        privateWealth: { money: 80000, land: 1000, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '新都人·杨廷和子·正德六年状元·大礼议廷杖戍云南三十余年·明三大才子之首。',
      famousQuote: '滚滚长江东逝水，浪花淘尽英雄。',
      historicalFate: '嘉靖三十八年戍所殁',
      fateHint: 'exileDeath'
    },

    shenShixing: {
      id: 'shenShixing', name: '申时行', zi: '汝默',
      birthYear: 1535, deathYear: 1614, alternateNames: ['瑶泉','文定'],
      era: '万历', dynasty: '明', role: 'regent',
      title: '太师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 35, intelligence: 92,
                    charisma: 80, integrity: 78, benevolence: 75,
                    diplomacy: 88, scholarship: 92, finance: 78, cunning: 88 },
      loyalty: 88, ambition: 70,
      traits: ['patient','clever','scheming','sage'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2000000, slaves: 500, commerce: 0 },
        hiddenWealth: 200000, fame: 50, virtueMerit: 600, virtueStage: 5
      },
      integrity: 80,
      background: '苏州长洲人·张居正死后继首辅九年·和稀泥·万历怠政之始·以中庸立朝。',
      famousQuote: '不立异·不党同。',
      historicalFate: '万历四十二年寿终',
      fateHint: 'peacefulDeath'
    },

    yanglian: {
      id: 'yanglian', name: '杨涟', zi: '文孺',
      birthYear: 1572, deathYear: 1625, alternateNames: ['大洪','忠烈','忠愍'],
      era: '天启', dynasty: '明', role: 'loyal',
      title: '左副都御史', officialTitle: '左副都御史',
      rankLevel: 23, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 25, intelligence: 88,
                    charisma: 80, integrity: 100, benevolence: 80,
                    diplomacy: 55, scholarship: 88, finance: 60, cunning: 60 },
      loyalty: 100, ambition: 70,
      traits: ['upright','loyal','heroic','idealist'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6
      },
      integrity: 100,
      background: '应山人·东林党六君子·疏劾魏忠贤二十四大罪·下诏狱被铁钉钉颅而死。',
      famousQuote: '大笑大笑还大笑·刀砍东风·于我何有哉。',
      historicalFate: '天启五年下诏狱·土囊压身铁钉钉颅而死',
      fateHint: 'martyrdom'
    },

    eErTai: {
      id: 'eErTai', name: '鄂尔泰', zi: '毅庵',
      birthYear: 1677, deathYear: 1745, alternateNames: ['西林','文端'],
      era: '雍乾', dynasty: '清', role: 'reformer',
      title: '太傅·一等伯', officialTitle: '保和殿大学士·军机大臣',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 70, intelligence: 92,
                    charisma: 80, integrity: 88, benevolence: 78,
                    diplomacy: 80, scholarship: 88, finance: 85, cunning: 88 },
      loyalty: 92, ambition: 75,
      traits: ['rigorous','reformist','patient','scholarly'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 70, virtueMerit: 700, virtueStage: 5
      },
      integrity: 85,
      background: '满洲镶蓝旗·雍正朝改土归流·西南六省总督·配享太庙·与张廷玉齐名。',
      famousQuote: '为政之道·首在养民。',
      historicalFate: '乾隆十年病殁·配享太庙',
      fateHint: 'peacefulDeath'
    },

    liwei: {
      id: 'liwei', name: '李卫', zi: '又玠',
      birthYear: 1687, deathYear: 1738, alternateNames: ['敏达'],
      era: '雍乾', dynasty: '清', role: 'clean',
      title: '直隶总督', officialTitle: '直隶总督',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 85, military: 70, intelligence: 80,
                    charisma: 80, integrity: 88, benevolence: 80,
                    diplomacy: 65, scholarship: 60, finance: 88, cunning: 78 },
      loyalty: 95, ambition: 70,
      traits: ['rigorous','heroic','humble_origin','clever'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 80, virtueMerit: 800, virtueStage: 6
      },
      integrity: 88,
      background: '徐州丰县人·捐钱入官·雍正心腹·肃盐枭·治江南·为能臣典范·乾隆朝失宠。',
      famousQuote: '为官不为民·不如归田去。',
      historicalFate: '乾隆三年病殁',
      fateHint: 'peacefulDeath'
    },

    aGui: {
      id: 'aGui', name: '阿桂', zi: '广廷',
      birthYear: 1717, deathYear: 1797, alternateNames: ['一等诚谋英勇公','文成'],
      era: '乾嘉', dynasty: '清', role: 'military',
      title: '一等诚谋英勇公', officialTitle: '武英殿大学士·军机大臣',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'central',
      abilities: { governance: 85, military: 95, intelligence: 88,
                    charisma: 82, integrity: 88, benevolence: 78,
                    diplomacy: 75, scholarship: 80, finance: 78, cunning: 85 },
      loyalty: 95, ambition: 70,
      traits: ['brave','rigorous','heroic','loyal'],
      resources: {
        privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 88,
      background: '满洲正白旗·阿克敦子·平大小金川·定回部·乾隆朝十全武功之执行人·与和珅不合。',
      famousQuote: '军中无戏言。',
      historicalFate: '嘉庆二年病殁',
      fateHint: 'peacefulDeath'
    },

    jiyun: {
      id: 'jiyun', name: '纪昀', zi: '晓岚',
      birthYear: 1724, deathYear: 1805, alternateNames: ['纪晓岚','石云','文达'],
      era: '乾嘉', dynasty: '清', role: 'scholar',
      title: '太子太保', officialTitle: '协办大学士',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 25, intelligence: 95,
                    charisma: 88, integrity: 78, benevolence: 75,
                    diplomacy: 70, scholarship: 100, finance: 60, cunning: 80 },
      loyalty: 88, ambition: 65,
      traits: ['literary','clever','scholarly','luxurious'],
      resources: {
        privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 300, commerce: 0 },
        hiddenWealth: 0, fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 78,
      background: '直隶献县人·乾隆朝总裁《四库全书》·撰《阅微草堂笔记》·机敏好烟·与和珅周旋。',
      famousQuote: '书是案头之圣·烟是手中之云。',
      historicalFate: '嘉庆十年病殁',
      fateHint: 'peacefulDeath'
    },

    liuYong: {
      id: 'liuYong', name: '刘墉', zi: '崇如',
      birthYear: 1719, deathYear: 1804, alternateNames: ['石庵','刘罗锅','文清'],
      era: '乾嘉', dynasty: '清', role: 'clean',
      title: '太子太保', officialTitle: '体仁阁大学士',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 25, intelligence: 92,
                    charisma: 78, integrity: 92, benevolence: 80,
                    diplomacy: 75, scholarship: 100, finance: 70, cunning: 78 },
      loyalty: 92, ambition: 60,
      traits: ['upright','scholarly','literary','rigorous'],
      resources: {
        privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '诸城人·刘统勋子·清四大书家·治讼明察·查办和珅·政事文章并美·乾隆嘉庆朝重臣。',
      famousQuote: '问心无愧·便是为官。',
      historicalFate: '嘉庆九年寿终',
      fateHint: 'peacefulDeath'
    },

    wangChangling: {
      id: 'wangChangling', name: '王昌龄', zi: '少伯',
      birthYear: 698, deathYear: 757, alternateNames: ['七绝圣手','诗家天子'],
      era: '玄宗朝', dynasty: '唐', role: 'scholar',
      title: '龙标尉', officialTitle: '龙标尉',
      rankLevel: 8, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 50, military: 50, intelligence: 92,
                    charisma: 88, integrity: 88, benevolence: 75,
                    diplomacy: 50, scholarship: 100, finance: 45, cunning: 60 },
      loyalty: 88, ambition: 55,
      traits: ['literary','heroic','idealist','rigorous'],
      resources: {
        privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6
      },
      integrity: 90,
      background: '京兆万年人·七绝圣手·边塞诗人·安史乱中归乡途中被刺史闾丘晓所杀。',
      famousQuote: '秦时明月汉时关，万里长征人未还。',
      historicalFate: '至德二年被亳州刺史闾丘晓所杀',
      fateHint: 'execution'
    },

    fanChengda: {
      id: 'fanChengda', name: '范成大', zi: '致能',
      birthYear: 1126, deathYear: 1193, alternateNames: ['石湖居士','文穆'],
      era: '南宋', dynasty: '南宋', role: 'scholar',
      title: '崇国公', officialTitle: '吏部尚书',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 88,
                    charisma: 85, integrity: 92, benevolence: 88,
                    diplomacy: 88, scholarship: 100, finance: 75, cunning: 75 },
      loyalty: 92, ambition: 65,
      traits: ['literary','rigorous','heroic','scholarly'],
      resources: {
        privateWealth: { money: 200000, land: 3000, treasure: 200000, slaves: 50, commerce: 0 },
        hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6
      },
      integrity: 92,
      background: '吴郡人·绍兴进士·使金不辱·四川制置使·中兴四大诗人·田园诗集大成。',
      famousQuote: '使节凌空·气压燕山。',
      historicalFate: '绍熙四年病殁',
      fateHint: 'peacefulDeath'
    },

    yangWanli: {
      id: 'yangWanli', name: '杨万里', zi: '廷秀',
      birthYear: 1127, deathYear: 1206, alternateNames: ['诚斋','文节'],
      era: '南宋', dynasty: '南宋', role: 'scholar',
      title: '宝谟阁直学士', officialTitle: '秘书监',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 30, intelligence: 88,
                    charisma: 78, integrity: 95, benevolence: 88,
                    diplomacy: 55, scholarship: 100, finance: 60, cunning: 60 },
      loyalty: 95, ambition: 60,
      traits: ['literary','idealist','heroic','rigorous'],
      resources: {
        privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 10, commerce: 0 },
        hiddenWealth: 0, fame: 92, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '吉州吉水人·绍兴进士·诚斋体·中兴四大诗人·韩侂胄北伐失败忧愤而殁。',
      famousQuote: '小荷才露尖尖角，早有蜻蜓立上头。',
      historicalFate: '开禧二年闻韩侂胄北伐忧愤而殁',
      fateHint: 'forcedDeath'
    },

    gaoQiu: {
      id: 'gaoQiu', name: '高俅', zi: '',
      birthYear: 1064, deathYear: 1126, alternateNames: ['踢球者'],
      era: '徽宗朝', dynasty: '北宋', role: 'corrupt',
      title: '殿前都指挥使·开府仪同三司', officialTitle: '殿帅',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 50, military: 50, intelligence: 70,
                    charisma: 80, integrity: 20, benevolence: 30,
                    diplomacy: 70, scholarship: 60, finance: 70, cunning: 88 },
      loyalty: 50, ambition: 90,
      traits: ['flatterer','greedy','luxurious','vain'],
      resources: {
        privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 },
        hiddenWealth: 1000000, fame: -75, virtueMerit: 100, virtueStage: 2
      },
      integrity: 25,
      background: '开封人·苏轼小书童·因蹴鞠近徽宗·掌禁军二十年·废池苑·禁军糜烂·靖康前夕病殁。',
      famousQuote: '',
      historicalFate: '靖康元年病殁·六贼之一',
      fateHint: 'peacefulDeath'
    },

    // ═════════════════════════════════════════
    // 波 6 扩充（汉唐宋元清·补遗 + 近代变法者）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 7 扩充（春秋战国 + 隋 + 五代 + 明末殉国 + 戊戌六君子）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 8 扩充（孔门 + 战国诸子 + 三国名将 + 北朝隋 + 明清要员）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 9 扩充（战国-清·补遗 30 条）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 10 扩充（战国-清末·补遗 35 条）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 11 扩充（先秦诸子+汉魏名臣+五代+清末·35 条）
    // ═════════════════════════════════════════

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

    // ═════════════════════════════════════════
    // 波 12 收官（春秋-清末·补遗 43 条·冲刺 500）
    // ═════════════════════════════════════════

    gongyiXiu: {
      id: 'gongyiXiu', name: '公仪休', zi: '',
      birthYear: -390, deathYear: -310, alternateNames: [],
      era: '春秋末', dynasty: '鲁', role: 'clean',
      title: '鲁相', officialTitle: '相国',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 30, intelligence: 88, charisma: 78, integrity: 100, benevolence: 88, diplomacy: 70, scholarship: 88, finance: 75, cunning: 60 },
      loyalty: 92, ambition: 50, traits: ['upright','rigorous','sage','idealist'],
      resources: { privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 5, commerce: 0 }, hiddenWealth: 0, fame: 85, virtueMerit: 850, virtueStage: 6 },
      integrity: 100,
      background: '鲁国博士·拒嗜鱼之贿·拔家中葵·去家中织·为相而亲不与民争利。',
      famousQuote: '夫唯嗜鱼·故不受也。',
      historicalFate: '鲁相任上寿终', fateHint: 'peacefulDeath'
    },

    mengao: {
      id: 'mengao', name: '蒙骜', zi: '',
      birthYear: -290, deathYear: -240, alternateNames: [],
      era: '战国末', dynasty: '秦', role: 'military',
      title: '上卿', officialTitle: '上将军',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 88, intelligence: 80, charisma: 75, integrity: 88, benevolence: 70, diplomacy: 50, scholarship: 50, finance: 55, cunning: 70 },
      loyalty: 95, ambition: 65, traits: ['brave','heroic','rigorous','loyal'],
      resources: { privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 700, virtueStage: 5 },
      integrity: 90,
      background: '齐人入秦·蒙武父·蒙恬祖·三朝大将·破赵韩魏·夺三十余城·秦统一大业奠基者。',
      famousQuote: '', historicalFate: '秦王政七年病殁', fateHint: 'peacefulDeath'
    },

    tianFen: {
      id: 'tianFen', name: '田蚡', zi: '',
      birthYear: -180, deathYear: -131, alternateNames: ['武安侯'],
      era: '景武朝', dynasty: '西汉', role: 'corrupt',
      title: '武安侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 65, military: 35, intelligence: 78, charisma: 75, integrity: 30, benevolence: 40, diplomacy: 70, scholarship: 75, finance: 75, cunning: 92 },
      loyalty: 60, ambition: 95, traits: ['scheming','greedy','flatterer','vain'],
      resources: { privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 }, hiddenWealth: 1000000, fame: -50, virtueMerit: 200, virtueStage: 2 },
      integrity: 35,
      background: '王太后异父弟·武帝舅·与窦婴争·构陷致灌夫族·田蚡得疾梦窦灌索命惊死。',
      famousQuote: '', historicalFate: '元光四年发狂而亡·疑梦窦婴灌夫索命', fateHint: 'forcedDeath'
    },

    guanfu: {
      id: 'guanfu', name: '灌夫', zi: '仲孺',
      birthYear: -176, deathYear: -131, alternateNames: [],
      era: '景武朝', dynasty: '西汉', role: 'military',
      title: '太仆', officialTitle: '燕相·中郎将',
      rankLevel: 22, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 55, military: 88, intelligence: 70, charisma: 78, integrity: 78, benevolence: 65, diplomacy: 45, scholarship: 50, finance: 60, cunning: 60 },
      loyalty: 90, ambition: 75, traits: ['brave','heroic','proud','luxurious'],
      resources: { privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 }, hiddenWealth: 0, fame: 70, virtueMerit: 500, virtueStage: 4 },
      integrity: 78,
      background: '颍阴人·七国之乱杀身陷阵立功·使酒骂座·与窦婴交厚·田蚡构陷·族灭。',
      famousQuote: '骂座·岂为我哉。', historicalFate: '元光四年遭田蚡构陷·夷三族', fateHint: 'executionByClanDestruction'
    },

    zhangchang: {
      id: 'zhangchang', name: '张敞', zi: '子高',
      birthYear: -120, deathYear: -47, alternateNames: [],
      era: '宣元朝', dynasty: '西汉', role: 'clean',
      title: '京兆尹', officialTitle: '京兆尹·冀州刺史',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92, charisma: 85, integrity: 88, benevolence: 80, diplomacy: 70, scholarship: 88, finance: 75, cunning: 88 },
      loyalty: 92, ambition: 70, traits: ['rigorous','clever','heroic','luxurious'],
      resources: { privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 750, virtueStage: 5 },
      integrity: 85,
      background: '河东平阳人·宣帝朝京兆尹·治长安·破豪强·画眉故事·与赵广汉并称汉名守。',
      famousQuote: '画眉之乐·有甚于画眉者。', historicalFate: '元帝初病殁', fateHint: 'peacefulDeath'
    },

    dengsui: {
      id: 'dengsui', name: '邓绥', zi: '',
      birthYear: 81, deathYear: 121, alternateNames: ['和熹邓后'],
      era: '和帝-安帝朝', dynasty: '东汉', role: 'regent',
      title: '皇太后', officialTitle: '临朝称制',
      rankLevel: 30, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 92, military: 60, intelligence: 95, charisma: 92, integrity: 92, benevolence: 92, diplomacy: 88, scholarship: 92, finance: 85, cunning: 88 },
      loyalty: 90, ambition: 75, traits: ['brilliant','benevolent','sage','rigorous'],
      resources: { privateWealth: { money: 50000000, land: 1500000, treasure: 100000000, slaves: 50000, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6 },
      integrity: 92,
      background: '南阳新野人·邓禹孙女·和帝皇后·临朝称制十六年·节俭抚民·震西羌定西北·东汉贤后。',
      famousQuote: '吾不敢以世有忽国家之事。', historicalFate: '永宁二年病殁', fateHint: 'peacefulDeath'
    },

    guyong: {
      id: 'guyong', name: '顾雍', zi: '元叹',
      birthYear: 168, deathYear: 243, alternateNames: ['醴陵侯','肃'],
      era: '三国', dynasty: '东吴', role: 'regent',
      title: '醴陵侯', officialTitle: '丞相·尚书令',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 50, intelligence: 92, charisma: 80, integrity: 92, benevolence: 85, diplomacy: 80, scholarship: 95, finance: 80, cunning: 78 },
      loyalty: 95, ambition: 60, traits: ['brilliant','rigorous','sage','patient'],
      resources: { privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 }, hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6 },
      integrity: 92,
      background: '吴郡吴县人·蔡邕弟子·东吴第二任丞相·任内十九年·拜相而不语·孙权敬之。',
      famousQuote: '居敬而行简·临政而不烦。', historicalFate: '赤乌六年寿终', fateHint: 'peacefulDeath'
    },

    luKang: {
      id: 'luKang', name: '陆抗', zi: '幼节',
      birthYear: 226, deathYear: 274, alternateNames: ['江陵侯','武'],
      era: '三国吴末', dynasty: '东吴', role: 'military',
      title: '江陵侯', officialTitle: '大司马',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 85, military: 95, intelligence: 92, charisma: 88, integrity: 92, benevolence: 80, diplomacy: 80, scholarship: 88, finance: 70, cunning: 88 },
      loyalty: 95, ambition: 65, traits: ['brilliant','heroic','rigorous','sage'],
      resources: { privateWealth: { money: 800000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6 },
      integrity: 92,
      background: '吴郡吴县人·陆逊子·东吴末柱国·与羊祜对峙互敬·西陵之战大破晋军·东吴最后名将。',
      famousQuote: '彼专力守·我专力攻·斯不亦可忧乎。', historicalFate: '凤凰三年病殁', fateHint: 'peacefulDeath'
    },

    gongsunZan: {
      id: 'gongsunZan', name: '公孙瓒', zi: '伯圭',
      birthYear: 155, deathYear: 199, alternateNames: ['白马将军'],
      era: '汉末', dynasty: '东汉', role: 'usurper',
      title: '前将军·易侯', officialTitle: '幽州牧',
      rankLevel: 26, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 88, intelligence: 75, charisma: 80, integrity: 65, benevolence: 50, diplomacy: 55, scholarship: 65, finance: 60, cunning: 70 },
      loyalty: 50, ambition: 90, traits: ['brave','heroic','proud','ruthless'],
      resources: { privateWealth: { money: 3000000, land: 80000, treasure: 8000000, slaves: 2000, commerce: 0 }, hiddenWealth: 0, fame: 60, virtueMerit: 400, virtueStage: 4 },
      integrity: 65,
      background: '辽西令支人·白马义从·镇幽州·破乌桓·界桥之战败于袁绍·易京困死·焚妻子自尽。',
      famousQuote: '', historicalFate: '建安四年易京自焚而死', fateHint: 'martyrdom'
    },

    liubiao: {
      id: 'liubiao', name: '刘表', zi: '景升',
      birthYear: 142, deathYear: 208, alternateNames: ['成武侯'],
      era: '汉末', dynasty: '东汉', role: 'regent',
      title: '成武侯', officialTitle: '荆州牧',
      rankLevel: 27, socialClass: 'noble', department: 'local',
      abilities: { governance: 80, military: 60, intelligence: 80, charisma: 88, integrity: 80, benevolence: 85, diplomacy: 75, scholarship: 88, finance: 75, cunning: 65 },
      loyalty: 60, ambition: 70, traits: ['scholarly','benevolent','patient','vain'],
      resources: { privateWealth: { money: 8000000, land: 200000, treasure: 20000000, slaves: 5000, commerce: 0 }, hiddenWealth: 0, fame: 65, virtueMerit: 500, virtueStage: 4 },
      integrity: 78,
      background: '山阳高平人·汉末八俊·单骑入荆州·治民有方·拥兵自保·不能用武·死后子琮降曹。',
      famousQuote: '', historicalFate: '建安十三年病殁·子刘琮降曹', fateHint: 'peacefulDeath'
    },

    zhangfei: {
      id: 'zhangfei', name: '张飞', zi: '益德',
      birthYear: 168, deathYear: 221, alternateNames: ['桓侯','张益德'],
      era: '三国初', dynasty: '蜀汉', role: 'military',
      title: '西乡侯', officialTitle: '车骑将军',
      rankLevel: 27, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 60, military: 95, intelligence: 78, charisma: 88, integrity: 88, benevolence: 65, diplomacy: 50, scholarship: 50, finance: 55, cunning: 75 },
      loyalty: 100, ambition: 65, traits: ['brave','heroic','loyal','ruthless'],
      resources: { privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 }, hiddenWealth: 0, fame: 95, virtueMerit: 850, virtueStage: 6 },
      integrity: 88,
      background: '涿郡涿县人·桃园结义·当阳桥喝退曹军·义释严颜·虎牢战吕布·伐吴前夜被部下范疆张达所杀。',
      famousQuote: '燕人张翼德在此·谁敢决一死战。', historicalFate: '章武元年阆中军中被部下所杀', fateHint: 'execution'
    },

    dengzhi: {
      id: 'dengzhi', name: '邓芝', zi: '伯苗',
      birthYear: 178, deathYear: 251, alternateNames: ['阳武亭侯'],
      era: '三国', dynasty: '蜀汉', role: 'scholar',
      title: '阳武亭侯', officialTitle: '车骑将军·尚书令',
      rankLevel: 24, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 80, military: 75, intelligence: 88, charisma: 88, integrity: 92, benevolence: 80, diplomacy: 95, scholarship: 80, finance: 65, cunning: 80 },
      loyalty: 95, ambition: 65, traits: ['rigorous','heroic','loyal','clever'],
      resources: { privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6 },
      integrity: 92,
      background: '义阳新野人·使吴重修盟好·孙权重之·镇江州二十余年·不治生·身后无余财。',
      famousQuote: '蜀有重险·吴有三江·合二国之优·并力制魏。', historicalFate: '延熙十四年病殁', fateHint: 'peacefulDeath'
    },

    buzhi: {
      id: 'buzhi', name: '步骘', zi: '子山',
      birthYear: 175, deathYear: 247, alternateNames: ['临湘侯'],
      era: '三国', dynasty: '东吴', role: 'regent',
      title: '临湘侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 70, intelligence: 88, charisma: 80, integrity: 92, benevolence: 80, diplomacy: 88, scholarship: 88, finance: 70, cunning: 75 },
      loyalty: 95, ambition: 60, traits: ['rigorous','sage','patient','heroic'],
      resources: { privateWealth: { money: 500000, land: 10000, treasure: 800000, slaves: 200, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6 },
      integrity: 92,
      background: '临淮淮阴人·孙权佐吏·镇交州二十余年·定南海·继顾雍为丞相·终于任所。',
      famousQuote: '为政之要·先得人心。', historicalFate: '赤乌十年丞相任上殁', fateHint: 'peacefulDeath'
    },

    kanze: {
      id: 'kanze', name: '阚泽', zi: '德润',
      birthYear: 170, deathYear: 243, alternateNames: ['都乡侯'],
      era: '三国', dynasty: '东吴', role: 'scholar',
      title: '都乡侯', officialTitle: '太子太傅',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 50, intelligence: 92, charisma: 78, integrity: 92, benevolence: 80, diplomacy: 80, scholarship: 100, finance: 65, cunning: 78 },
      loyalty: 92, ambition: 55, traits: ['scholarly','sage','rigorous','idealist'],
      resources: { privateWealth: { money: 100000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 }, hiddenWealth: 0, fame: 75, virtueMerit: 800, virtueStage: 6 },
      integrity: 92,
      background: '会稽山阴人·寒门博学·赤壁前替黄盖献诈降书·孙权重其学问·东吴文教首任。',
      famousQuote: '泽愿与天地同其无穷。', historicalFate: '赤乌六年病殁', fateHint: 'peacefulDeath'
    },

    chengong: {
      id: 'chengong', name: '陈宫', zi: '公台',
      birthYear: 161, deathYear: 198, alternateNames: [],
      era: '汉末', dynasty: '东汉', role: 'scholar',
      title: '从事中郎', officialTitle: '吕布军师',
      rankLevel: 16, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 75, military: 75, intelligence: 92, charisma: 78, integrity: 92, benevolence: 75, diplomacy: 60, scholarship: 88, finance: 60, cunning: 90 },
      loyalty: 92, ambition: 70, traits: ['brilliant','heroic','idealist','rigorous'],
      resources: { privateWealth: { money: 100000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 }, hiddenWealth: 0, fame: 75, virtueMerit: 700, virtueStage: 5 },
      integrity: 95,
      background: '东郡人·原曹操心腹·捉放曹·因吕伯奢事弃曹·辅吕布·下邳被擒·拒降被斩。',
      famousQuote: '请出就戮·以明军法。', historicalFate: '建安三年下邳被曹操所斩', fateHint: 'martyrdom'
    },

    murongKe: {
      id: 'murongKe', name: '慕容恪', zi: '玄恭',
      birthYear: 321, deathYear: 367, alternateNames: ['太原王','桓'],
      era: '前燕', dynasty: '前燕', role: 'regent',
      title: '太原王', officialTitle: '太宰',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 92, military: 95, intelligence: 92, charisma: 92, integrity: 95, benevolence: 88, diplomacy: 80, scholarship: 80, finance: 75, cunning: 88 },
      loyalty: 100, ambition: 65, traits: ['brilliant','brave','heroic','sage'],
      resources: { privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6 },
      integrity: 98,
      background: '前燕慕容皝四子·破冉闵·辅幼主慕容暐·一代名将兼贤相·五胡十六国第一英才。',
      famousQuote: '为政之道·宽严相济。', historicalFate: '建熙八年病殁', fateHint: 'peacefulDeath'
    },

    yuLiang: {
      id: 'yuLiang', name: '庾亮', zi: '元规',
      birthYear: 289, deathYear: 340, alternateNames: ['都亭侯','文康'],
      era: '东晋初', dynasty: '东晋', role: 'regent',
      title: '都亭侯', officialTitle: '司空·都督江豫诸军事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'military',
      abilities: { governance: 80, military: 65, intelligence: 88, charisma: 88, integrity: 78, benevolence: 75, diplomacy: 70, scholarship: 88, finance: 65, cunning: 75 },
      loyalty: 90, ambition: 80, traits: ['scholarly','heroic','proud','vain'],
      resources: { privateWealth: { money: 1500000, land: 30000, treasure: 2500000, slaves: 800, commerce: 0 }, hiddenWealth: 0, fame: 65, virtueMerit: 600, virtueStage: 5 },
      integrity: 80,
      background: '颍川鄢陵人·明帝皇后兄·辅成帝·苏峻之乱·避镇芜湖·庾氏门阀代表·名士风流。',
      famousQuote: '风月不殊·举目有山河之异。', historicalFate: '咸康六年病殁', fateHint: 'peacefulDeath'
    },

    huanyi: {
      id: 'huanyi', name: '桓伊', zi: '叔夏',
      birthYear: 332, deathYear: 391, alternateNames: ['永修县侯'],
      era: '东晋', dynasty: '东晋', role: 'military',
      title: '永修县侯', officialTitle: '右军将军·豫州刺史',
      rankLevel: 25, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 88, intelligence: 88, charisma: 92, integrity: 92, benevolence: 80, diplomacy: 70, scholarship: 95, finance: 65, cunning: 75 },
      loyalty: 95, ambition: 60, traits: ['literary','brave','heroic','sage'],
      resources: { privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 }, hiddenWealth: 0, fame: 88, virtueMerit: 850, virtueStage: 6 },
      integrity: 92,
      background: '谯国铚人·淝水之战副将·吹笛绝伦·一曲解谢安孝武君臣猜忌·江左第一笛。',
      famousQuote: '笛声三弄·胜过雄辩。', historicalFate: '太元十六年病殁', fateHint: 'peacefulDeath'
    },

    shenyue: {
      id: 'shenyue', name: '沈约', zi: '休文',
      birthYear: 441, deathYear: 513, alternateNames: ['建昌县侯','隐'],
      era: '南朝齐梁', dynasty: '南朝梁', role: 'scholar',
      title: '建昌县侯', officialTitle: '尚书令',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 78, military: 25, intelligence: 92, charisma: 80, integrity: 78, benevolence: 75, diplomacy: 70, scholarship: 100, finance: 65, cunning: 75 },
      loyalty: 85, ambition: 70, traits: ['literary','scholarly','rigorous','sage'],
      resources: { privateWealth: { money: 500000, land: 8000, treasure: 800000, slaves: 200, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 800, virtueStage: 6 },
      integrity: 80,
      background: '吴兴武康人·助萧衍代齐建梁·首倡四声八病说·撰《宋书》·永明体诗派代表。',
      famousQuote: '梁尚四声·永明定律。', historicalFate: '天监十二年病殁', fateHint: 'peacefulDeath'
    },

    jiangyan: {
      id: 'jiangyan', name: '江淹', zi: '文通',
      birthYear: 444, deathYear: 505, alternateNames: ['醴陵侯','宪'],
      era: '南朝齐梁', dynasty: '南朝梁', role: 'scholar',
      title: '醴陵侯', officialTitle: '光禄大夫',
      rankLevel: 22, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 25, intelligence: 88, charisma: 78, integrity: 80, benevolence: 70, diplomacy: 60, scholarship: 100, finance: 60, cunning: 60 },
      loyalty: 80, ambition: 65, traits: ['literary','idealist','reclusive','sage'],
      resources: { privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 }, hiddenWealth: 0, fame: 88, virtueMerit: 750, virtueStage: 5 },
      integrity: 80,
      background: '济阳考城人·历仕宋齐梁三朝·别赋恨赋传世·江郎才尽之典·晚年不复有佳作。',
      famousQuote: '黯然销魂者·唯别而已矣。', historicalFate: '天监四年病殁', fateHint: 'peacefulDeath'
    },

    yuxin: {
      id: 'yuxin', name: '庾信', zi: '子山',
      birthYear: 513, deathYear: 581, alternateNames: ['庾开府'],
      era: '南北朝', dynasty: '北周', role: 'scholar',
      title: '义城县侯', officialTitle: '骠骑大将军·开府仪同三司',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 30, intelligence: 92, charisma: 80, integrity: 75, benevolence: 75, diplomacy: 60, scholarship: 100, finance: 60, cunning: 60 },
      loyalty: 65, ambition: 60, traits: ['literary','idealist','sage','reclusive'],
      resources: { privateWealth: { money: 500000, land: 8000, treasure: 800000, slaves: 200, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 750, virtueStage: 5 },
      integrity: 75,
      background: '南阳新野人·梁朝南来名士·留北周不归·哀江南赋·北朝文宗·南北文学合流之代表。',
      famousQuote: '哀江南赋·凄怆千古。', historicalFate: '大象三年病殁北周', fateHint: 'exileDeath'
    },

    suchuo: {
      id: 'suchuo', name: '苏绰', zi: '令绰',
      birthYear: 498, deathYear: 546, alternateNames: ['美阳伯'],
      era: '西魏', dynasty: '西魏', role: 'reformer',
      title: '美阳伯', officialTitle: '大行台度支尚书',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 35, intelligence: 95, charisma: 80, integrity: 92, benevolence: 80, diplomacy: 70, scholarship: 100, finance: 88, cunning: 78 },
      loyalty: 95, ambition: 65, traits: ['brilliant','reformist','sage','rigorous'],
      resources: { privateWealth: { money: 100000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 850, virtueStage: 6 },
      integrity: 95,
      background: '武功人·宇文泰股肱·六条诏书·均田制·府兵制·关陇集团制度奠基者·隋唐渊源。',
      famousQuote: '使百官·清廉自守。', historicalFate: '大统十二年积劳病殁', fateHint: 'peacefulDeath'
    },

    yangyin: {
      id: 'yangyin', name: '杨愔', zi: '遵彦',
      birthYear: 511, deathYear: 560, alternateNames: ['开府仪同三司'],
      era: '北齐初', dynasty: '北齐', role: 'regent',
      title: '阳夏王', officialTitle: '尚书令·特进',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 30, intelligence: 95, charisma: 88, integrity: 92, benevolence: 85, diplomacy: 88, scholarship: 95, finance: 80, cunning: 85 },
      loyalty: 95, ambition: 70, traits: ['brilliant','rigorous','sage','heroic'],
      resources: { privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 400, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6 },
      integrity: 92,
      background: '弘农华阴人·北齐文宣帝重臣·辅幼主·与高演高湛宫廷之乱·被高演杀于殿前。',
      famousQuote: '吾位极人臣·敢忘报国。', historicalFate: '乾明元年宫变被害', fateHint: 'martyrdom'
    },

    taipingGongzhu: {
      id: 'taipingGongzhu', name: '李令月', zi: '',
      birthYear: 665, deathYear: 713, alternateNames: ['太平公主'],
      era: '武周-玄宗', dynasty: '唐', role: 'usurper',
      title: '镇国太平公主', officialTitle: '镇国公主',
      rankLevel: 30, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 75, military: 50, intelligence: 92, charisma: 92, integrity: 50, benevolence: 65, diplomacy: 88, scholarship: 80, finance: 80, cunning: 95 },
      loyalty: 30, ambition: 100, traits: ['scheming','ambitious','luxurious','vain'],
      resources: { privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 }, hiddenWealth: 0, fame: 30, virtueMerit: 300, virtueStage: 3 },
      integrity: 50,
      background: '武则天女·参与神龙政变·诛韦后·拥李隆基即位·后与玄宗争权·开元元年赐死。',
      famousQuote: '', historicalFate: '开元元年与玄宗争权失败赐死', fateHint: 'forcedDeath'
    },

    yangGuifei: {
      id: 'yangGuifei', name: '杨玉环', zi: '',
      birthYear: 719, deathYear: 756, alternateNames: ['杨贵妃','太真'],
      era: '玄宗朝', dynasty: '唐', role: 'usurper',
      title: '贵妃', officialTitle: '贵妃',
      rankLevel: 28, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 50, military: 25, intelligence: 80, charisma: 100, integrity: 65, benevolence: 70, diplomacy: 70, scholarship: 88, finance: 75, cunning: 75 },
      loyalty: 70, ambition: 60, traits: ['literary','luxurious','vain','idealist'],
      resources: { privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 500, virtueStage: 4 },
      integrity: 70,
      background: '蒲州永乐人·原寿王妃·玄宗夺为己有·三千宠爱在一身·安史之乱马嵬被赐死。',
      famousQuote: '春寒赐浴华清池·温泉水滑洗凝脂。', historicalFate: '至德元载马嵬驿被赐缢死', fateHint: 'forcedDeath'
    },

    wuSansi: {
      id: 'wuSansi', name: '武三思', zi: '',
      birthYear: 649, deathYear: 707, alternateNames: ['梁王'],
      era: '武周-中宗', dynasty: '唐', role: 'corrupt',
      title: '梁王', officialTitle: '司空·同中书门下三品',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 65, military: 30, intelligence: 80, charisma: 70, integrity: 20, benevolence: 25, diplomacy: 65, scholarship: 70, finance: 75, cunning: 92 },
      loyalty: 30, ambition: 100, traits: ['scheming','flatterer','greedy','vain'],
      resources: { privateWealth: { money: 8000000, land: 200000, treasure: 30000000, slaves: 5000, commerce: 1000000 }, hiddenWealth: 0, fame: -85, virtueMerit: 50, virtueStage: 1 },
      integrity: 20,
      background: '武则天侄·中宗朝构陷张柬之等五王·与韦后秽乱·被太子重俊兵变所杀。',
      famousQuote: '我不知代间何者谓之善人·何者谓之恶人。', historicalFate: '景龙元年重俊兵变被杀', fateHint: 'execution'
    },

    zhangJianzhi: {
      id: 'zhangJianzhi', name: '张柬之', zi: '孟将',
      birthYear: 625, deathYear: 706, alternateNames: ['汉阳郡公','文贞'],
      era: '武周-中宗', dynasty: '唐', role: 'loyal',
      title: '汉阳郡公', officialTitle: '中书令',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 70, intelligence: 92, charisma: 85, integrity: 95, benevolence: 80, diplomacy: 80, scholarship: 92, finance: 75, cunning: 88 },
      loyalty: 95, ambition: 80, traits: ['brilliant','heroic','rigorous','idealist'],
      resources: { privateWealth: { money: 200000, land: 3000, treasure: 100000, slaves: 30, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6 },
      integrity: 95,
      background: '襄州襄阳人·狄仁杰荐·神龙政变诛二张迎中宗复唐·五王之首·后被武三思流泷州。',
      famousQuote: '复唐之业·吾等所为。', historicalFate: '神龙二年贬泷州·途中忧愤而殁', fateHint: 'exileDeath'
    },

    weiYingwu: {
      id: 'weiYingwu', name: '韦应物', zi: '',
      birthYear: 737, deathYear: 791, alternateNames: ['韦江州','韦苏州'],
      era: '德宗朝', dynasty: '唐', role: 'scholar',
      title: '苏州刺史', officialTitle: '苏州刺史',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 78, military: 50, intelligence: 88, charisma: 80, integrity: 92, benevolence: 88, diplomacy: 60, scholarship: 100, finance: 65, cunning: 65 },
      loyalty: 88, ambition: 55, traits: ['literary','sage','rigorous','reclusive'],
      resources: { privateWealth: { money: 50000, land: 500, treasure: 30000, slaves: 10, commerce: 0 }, hiddenWealth: 0, fame: 90, virtueMerit: 850, virtueStage: 6 },
      integrity: 92,
      background: '京兆万年人·世为关中望族·原玄宗近卫·安史乱后改业读书·中唐田园诗人。',
      famousQuote: '春潮带雨晚来急·野渡无人舟自横。', historicalFate: '贞元七年苏州任所殁', fateHint: 'peacefulDeath'
    },

    xuanzang: {
      id: 'xuanzang', name: '陈祎', zi: '玄奘',
      birthYear: 602, deathYear: 664, alternateNames: ['唐三藏','唐僧'],
      era: '太宗高宗朝', dynasty: '唐', role: 'scholar',
      title: '大遍觉', officialTitle: '三藏法师',
      rankLevel: 16, socialClass: 'commoner', department: '',
      abilities: { governance: 60, military: 30, intelligence: 95, charisma: 92, integrity: 100, benevolence: 95, diplomacy: 92, scholarship: 100, finance: 60, cunning: 75 },
      loyalty: 88, ambition: 70, traits: ['scholarly','sage','heroic','rigorous'],
      resources: { privateWealth: { money: 80000, land: 0, treasure: 30000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 100, virtueMerit: 1000, virtueStage: 6 },
      integrity: 100,
      background: '洛州缑氏人·西行十七年取经·撰《大唐西域记》·译经七十五部·中国佛教史第一人。',
      famousQuote: '宁向西而死·不向东而生。', historicalFate: '麟德元年圆寂玉华宫', fateHint: 'peacefulDeath'
    },

    jianzhen: {
      id: 'jianzhen', name: '鉴真', zi: '',
      birthYear: 688, deathYear: 763, alternateNames: ['过海大师'],
      era: '玄肃代朝', dynasty: '唐', role: 'scholar',
      title: '大和上', officialTitle: '律宗大德',
      rankLevel: 14, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 25, intelligence: 88, charisma: 92, integrity: 100, benevolence: 95, diplomacy: 92, scholarship: 100, finance: 60, cunning: 70 },
      loyalty: 80, ambition: 65, traits: ['heroic','sage','rigorous','idealist'],
      resources: { privateWealth: { money: 30000, land: 0, treasure: 10000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6 },
      integrity: 100,
      background: '扬州江阳人·律宗高僧·六次东渡日本·失明仍至·传戒律建唐招提寺·中日文化使者。',
      famousQuote: '为是法事·何惜身命。', historicalFate: '广德元年圆寂日本唐招提寺', fateHint: 'peacefulDeath'
    },

    yixing: {
      id: 'yixing', name: '张遂', zi: '一行',
      birthYear: 683, deathYear: 727, alternateNames: ['一行大师'],
      era: '玄宗朝', dynasty: '唐', role: 'scholar',
      title: '大慧禅师', officialTitle: '太子太傅·昭文馆学士',
      rankLevel: 14, socialClass: 'commoner', department: '',
      abilities: { governance: 50, military: 25, intelligence: 100, charisma: 80, integrity: 95, benevolence: 80, diplomacy: 50, scholarship: 100, finance: 60, cunning: 78 },
      loyalty: 88, ambition: 50, traits: ['scholarly','sage','rigorous','reclusive'],
      resources: { privateWealth: { money: 30000, land: 0, treasure: 10000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '魏州昌乐人·张柬之孙·密宗高僧·制大衍历·测子午线·世界最早的天文学家之一。',
      famousQuote: '日月之行·万古不易。', historicalFate: '开元十五年圆寂', fateHint: 'peacefulDeath'
    },

    liKeyong: {
      id: 'liKeyong', name: '李克用', zi: '翼圣',
      birthYear: 856, deathYear: 908, alternateNames: ['独眼龙','晋王'],
      era: '唐末', dynasty: '后唐', role: 'usurper',
      title: '晋王', officialTitle: '河东节度使',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 70, military: 95, intelligence: 80, charisma: 92, integrity: 75, benevolence: 70, diplomacy: 75, scholarship: 60, finance: 65, cunning: 80 },
      loyalty: 65, ambition: 95, traits: ['brave','heroic','proud','luxurious'],
      resources: { privateWealth: { money: 25000000, land: 800000, treasure: 60000000, slaves: 25000, commerce: 0 }, hiddenWealth: 0, fame: 75, virtueMerit: 600, virtueStage: 5 },
      integrity: 75,
      background: '沙陀部·独眼龙·讨黄巢·破朱温·晋王·临终遗子三矢·后唐基业奠定。',
      famousQuote: '此三矢·汝其复仇。', historicalFate: '开平二年病殁太原', fateHint: 'peacefulDeath'
    },

    qianliu: {
      id: 'qianliu', name: '钱镠', zi: '具美',
      birthYear: 852, deathYear: 932, alternateNames: ['吴越国王','武肃'],
      era: '五代吴越', dynasty: '吴越', role: 'usurper',
      title: '吴越国王', officialTitle: '吴越国王',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 88, military: 88, intelligence: 92, charisma: 92, integrity: 88, benevolence: 88, diplomacy: 92, scholarship: 80, finance: 92, cunning: 88 },
      loyalty: 80, ambition: 90, traits: ['brilliant','heroic','benevolent','clever'],
      resources: { privateWealth: { money: 30000000, land: 1000000, treasure: 80000000, slaves: 30000, commerce: 5000000 }, hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6 },
      integrity: 92,
      background: '杭州临安人·私盐贩出身·建吴越国·治钱塘·修海塘·保境安民·遗训子孙降宋免战。',
      famousQuote: '陌上花开·可缓缓归矣。', historicalFate: '长兴三年寿终', fateHint: 'peacefulDeath'
    },

    fengYansi: {
      id: 'fengYansi', name: '冯延巳', zi: '正中',
      birthYear: 904, deathYear: 960, alternateNames: ['冯延嗣','冯仁宗'],
      era: '南唐', dynasty: '南唐', role: 'scholar',
      title: '太子太傅', officialTitle: '同中书门下平章事',
      rankLevel: 28, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 60, military: 25, intelligence: 88, charisma: 88, integrity: 60, benevolence: 70, diplomacy: 70, scholarship: 100, finance: 60, cunning: 75 },
      loyalty: 75, ambition: 75, traits: ['literary','flatterer','luxurious','scheming'],
      resources: { privateWealth: { money: 1000000, land: 20000, treasure: 1500000, slaves: 500, commerce: 0 }, hiddenWealth: 0, fame: 88, virtueMerit: 600, virtueStage: 5 },
      integrity: 60,
      background: '广陵人·南唐三度拜相·与中主李璟交厚·五鬼之首·词风婉丽·阳春集·开北宋婉约词风。',
      famousQuote: '风乍起·吹皱一池春水。', historicalFate: '建隆元年病殁', fateHint: 'peacefulDeath'
    },

    zhanglei: {
      id: 'zhanglei', name: '张耒', zi: '文潜',
      birthYear: 1054, deathYear: 1114, alternateNames: ['柯山先生','宛丘'],
      era: '神哲徽朝', dynasty: '北宋', role: 'scholar',
      title: '太常少卿', officialTitle: '太常少卿',
      rankLevel: 18, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 25, intelligence: 88, charisma: 78, integrity: 88, benevolence: 80, diplomacy: 50, scholarship: 100, finance: 55, cunning: 60 },
      loyalty: 88, ambition: 60, traits: ['literary','scholarly','idealist','reclusive'],
      resources: { privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 }, hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5 },
      integrity: 88,
      background: '楚州淮阴人·苏门四学士之一·元祐党案累贬·黄州团练副使·诗文学风格平易近人。',
      famousQuote: '前贤多苦节·后辈遥钦慕。', historicalFate: '政和四年陈州病殁', fateHint: 'exileDeath'
    },

    zhouBida: {
      id: 'zhouBida', name: '周必大', zi: '子充',
      birthYear: 1126, deathYear: 1204, alternateNames: ['益国公','文忠'],
      era: '南宋孝光', dynasty: '南宋', role: 'regent',
      title: '益国公', officialTitle: '左丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 50, intelligence: 92, charisma: 88, integrity: 92, benevolence: 88, diplomacy: 80, scholarship: 100, finance: 80, cunning: 78 },
      loyalty: 95, ambition: 65, traits: ['rigorous','sage','scholarly','patient'],
      resources: { privateWealth: { money: 600000, land: 12000, treasure: 1000000, slaves: 300, commerce: 0 }, hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6 },
      integrity: 92,
      background: '吉州庐陵人·绍兴进士·孝宗朝左丞相·主修国史·与朱熹陆游友·南宋朝中调和派。',
      famousQuote: '为相·宜温恭克让。', historicalFate: '嘉泰四年寿终', fateHint: 'peacefulDeath'
    },

    zhangYanghao: {
      id: 'zhangYanghao', name: '张养浩', zi: '希孟',
      birthYear: 1270, deathYear: 1329, alternateNames: ['云庄','文忠'],
      era: '元', dynasty: '元', role: 'reformer',
      title: '滨国公', officialTitle: '陕西行台御史中丞',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 92, military: 30, intelligence: 92, charisma: 88, integrity: 100, benevolence: 95, diplomacy: 70, scholarship: 100, finance: 78, cunning: 70 },
      loyalty: 92, ambition: 70, traits: ['upright','heroic','benevolent','rigorous'],
      resources: { privateWealth: { money: 100000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6 },
      integrity: 100,
      background: '济南人·辞官归隐·关中大旱奉诏赈灾·散家财·过华山感而作潼关怀古·积劳殁任所。',
      famousQuote: '兴·百姓苦·亡·百姓苦。', historicalFate: '天历二年关中赈灾积劳殁', fateHint: 'martyrdom'
    },

    zhuQuan: {
      id: 'zhuQuan', name: '朱权', zi: '臞仙',
      birthYear: 1378, deathYear: 1448, alternateNames: ['宁王','涵虚子','献'],
      era: '洪武-正统', dynasty: '明', role: 'scholar',
      title: '宁王', officialTitle: '宁王',
      rankLevel: 30, socialClass: 'imperial', department: 'central',
      abilities: { governance: 78, military: 80, intelligence: 92, charisma: 85, integrity: 78, benevolence: 75, diplomacy: 75, scholarship: 100, finance: 70, cunning: 80 },
      loyalty: 60, ambition: 75, traits: ['brilliant','literary','reclusive','heroic'],
      resources: { privateWealth: { money: 5000000, land: 100000, treasure: 10000000, slaves: 2000, commerce: 0 }, hiddenWealth: 0, fame: 85, virtueMerit: 750, virtueStage: 5 },
      integrity: 80,
      background: '朱元璋十七子·初封大宁·朵颜三卫·靖难被胁迫·后封南昌·研道琴学·撰太和正音谱。',
      famousQuote: '事来则应·物去则定。', historicalFate: '正统十三年寿终', fateHint: 'retirement'
    },

    zhuda: {
      id: 'zhuda', name: '朱耷', zi: '雪个',
      birthYear: 1626, deathYear: 1705, alternateNames: ['八大山人','雪个','个山'],
      era: '明末清初', dynasty: '明', role: 'scholar',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'imperial', department: '',
      abilities: { governance: 30, military: 25, intelligence: 95, charisma: 80, integrity: 95, benevolence: 75, diplomacy: 45, scholarship: 100, finance: 50, cunning: 75 },
      loyalty: 100, ambition: 30, traits: ['literary','reclusive','idealist','sage'],
      resources: { privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 100, virtueMerit: 900, virtueStage: 6 },
      integrity: 100,
      background: '宁王朱权后裔·明亡为僧·后还俗·癫狂作画·画风奇崛冷艳·清初四大画僧之首。',
      famousQuote: '墨点无多泪点多·山河仍是旧山河。', historicalFate: '康熙四十四年病殁南昌', fateHint: 'retirement'
    },

    chenZilong: {
      id: 'chenZilong', name: '陈子龙', zi: '人中',
      birthYear: 1608, deathYear: 1647, alternateNames: ['卧子','大樽','忠裕'],
      era: '明末南明', dynasty: '南明', role: 'loyal',
      title: '兵科给事中', officialTitle: '兵科给事中',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 80, intelligence: 92, charisma: 88, integrity: 100, benevolence: 80, diplomacy: 60, scholarship: 100, finance: 60, cunning: 75 },
      loyalty: 100, ambition: 75, traits: ['literary','heroic','idealist','loyal'],
      resources: { privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6 },
      integrity: 100,
      background: '松江华亭人·几社领袖·夏完淳师·崇祯进士·明亡奉鲁王图复·被俘投水殉国。',
      famousQuote: '东风不负秋日恨·江花长伴白头吟。', historicalFate: '永历元年被俘投水殉国', fateHint: 'martyrdom'
    },

    qiujin: {
      id: 'qiujin', name: '秋瑾', zi: '璇卿',
      birthYear: 1875, deathYear: 1907, alternateNames: ['鉴湖女侠','竞雄'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '', officialTitle: '光复军白衣领袖',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 65, military: 70, intelligence: 88, charisma: 95, integrity: 100, benevolence: 80, diplomacy: 65, scholarship: 92, finance: 55, cunning: 70 },
      loyalty: 92, ambition: 88, traits: ['heroic','literary','idealist','brave'],
      resources: { privateWealth: { money: 50000, land: 500, treasure: 20000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 100, virtueMerit: 950, virtueStage: 6 },
      integrity: 100,
      background: '绍兴人·留日革命·光复会·女子近代革命第一人·徐锡麟事败被捕·绍兴轩亭口就义。',
      famousQuote: '秋风秋雨愁煞人。', historicalFate: '光绪三十三年绍兴轩亭口就义·年三十三', fateHint: 'martyrdom'
    },

    zourong: {
      id: 'zourong', name: '邹容', zi: '蔚丹',
      birthYear: 1885, deathYear: 1905, alternateNames: ['桂文'],
      era: '光绪', dynasty: '清', role: 'reformer',
      title: '', officialTitle: '布衣',
      rankLevel: 0, socialClass: 'civilOfficial', department: '',
      abilities: { governance: 60, military: 30, intelligence: 88, charisma: 88, integrity: 100, benevolence: 80, diplomacy: 50, scholarship: 92, finance: 50, cunning: 60 },
      loyalty: 88, ambition: 80, traits: ['literary','heroic','idealist','reformist'],
      resources: { privateWealth: { money: 30000, land: 200, treasure: 5000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 950, virtueStage: 6 },
      integrity: 100,
      background: '巴县人·留日·撰《革命军》宣传共和·苏报案下狱·二十一岁瘐死狱中·辛亥革命之先声。',
      famousQuote: '革命!革命!得之则生·不得则死。', historicalFate: '光绪三十一年瘐死上海狱中·年仅二十一', fateHint: 'martyrdom'
    },

    liuzheng: {
      id: 'liuzheng', name: '留正', zi: '仲至',
      birthYear: 1129, deathYear: 1206, alternateNames: ['卫国公','忠宣'],
      era: '南宋光宁', dynasty: '南宋', role: 'regent',
      title: '卫国公', officialTitle: '左丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 50, intelligence: 88, charisma: 80, integrity: 92, benevolence: 80, diplomacy: 75, scholarship: 92, finance: 75, cunning: 70 },
      loyalty: 92, ambition: 65, traits: ['rigorous','sage','patient','loyal'],
      resources: { privateWealth: { money: 800000, land: 15000, treasure: 1500000, slaves: 400, commerce: 0 }, hiddenWealth: 0, fame: 78, virtueMerit: 800, virtueStage: 6 },
      integrity: 92,
      background: '泉州永春人·光宗朝相·力挽光宗与孝宗矛盾·绍熙内禅·后被韩侂胄排挤罢相。',
      famousQuote: '天下不可一日无君。', historicalFate: '开禧二年寿终', fateHint: 'peacefulDeath'
    },

    chaoBuzhi: {
      id: 'chaoBuzhi', name: '晁补之', zi: '无咎',
      birthYear: 1053, deathYear: 1110, alternateNames: ['归来子'],
      era: '神哲徽朝', dynasty: '北宋', role: 'scholar',
      title: '泗州知州', officialTitle: '泗州知州',
      rankLevel: 14, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 65, military: 25, intelligence: 88, charisma: 78, integrity: 88, benevolence: 75, diplomacy: 50, scholarship: 100, finance: 55, cunning: 60 },
      loyalty: 85, ambition: 60, traits: ['literary','scholarly','idealist','reclusive'],
      resources: { privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 }, hiddenWealth: 0, fame: 80, virtueMerit: 750, virtueStage: 5 },
      integrity: 88,
      background: '济州巨野人·苏门四学士之一·元祐党案累贬·诗词文章兼擅·与张耒齐名晁张。',
      famousQuote: '何处合成愁·离人心上秋。', historicalFate: '大观四年泗州任所殁', fateHint: 'exileDeath'
    },

    zhangyong: {
      id: 'zhangyong', name: '张永', zi: '德延',
      birthYear: 1465, deathYear: 1529, alternateNames: ['八虎之一'],
      era: '正德嘉靖初', dynasty: '明', role: 'eunuch',
      title: '宣府总兵', officialTitle: '司礼监太监',
      rankLevel: 26, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 70, military: 80, intelligence: 80, charisma: 78, integrity: 70, benevolence: 60, diplomacy: 70, scholarship: 65, finance: 75, cunning: 88 },
      loyalty: 85, ambition: 80, traits: ['brave','heroic','clever','rigorous'],
      resources: { privateWealth: { money: 3000000, land: 80000, treasure: 8000000, slaves: 1500, commerce: 0 }, hiddenWealth: 0, fame: 30, virtueMerit: 500, virtueStage: 4 },
      integrity: 70,
      background: '保定新城人·正德八虎之一·平宁王朱宸濠之乱·与王阳明合作·诛杀刘瑾·宦官中之能将。',
      famousQuote: '', historicalFate: '嘉靖八年寿终', fateHint: 'peacefulDeath'
    },

    wangChongyang: {
      id: 'wangChongyang', name: '王嚞', zi: '知明',
      birthYear: 1112, deathYear: 1170, alternateNames: ['重阳真人','王重阳'],
      era: '金中期', dynasty: '金', role: 'scholar',
      title: '', officialTitle: '道士',
      rankLevel: 0, socialClass: 'commoner', department: '',
      abilities: { governance: 60, military: 50, intelligence: 92, charisma: 92, integrity: 95, benevolence: 88, diplomacy: 70, scholarship: 100, finance: 60, cunning: 75 },
      loyalty: 70, ambition: 50, traits: ['sage','reclusive','heroic','idealist'],
      resources: { privateWealth: { money: 30000, land: 200, treasure: 10000, slaves: 0, commerce: 0 }, hiddenWealth: 0, fame: 95, virtueMerit: 950, virtueStage: 6 },
      integrity: 98,
      background: '咸阳人·金朝武进士·中年悟道·全真派开山·授全真七子·北方道教中兴之主。',
      famousQuote: '人之为道·不在远求。', historicalFate: '金大定十年羽化', fateHint: 'retirement'
    },

    songCijian: {
      id: 'songCijian', name: '宋慈', zi: '惠父',
      birthYear: 1186, deathYear: 1249, alternateNames: ['世界法医学之祖'],
      era: '南宋理宗', dynasty: '南宋', role: 'scholar',
      title: '广东经略安抚使', officialTitle: '广东经略安抚使',
      rankLevel: 20, socialClass: 'civilOfficial', department: 'local',
      abilities: { governance: 85, military: 35, intelligence: 95, charisma: 80, integrity: 95, benevolence: 92, diplomacy: 60, scholarship: 100, finance: 70, cunning: 88 },
      loyalty: 92, ambition: 65, traits: ['scholarly','rigorous','heroic','sage'],
      resources: { privateWealth: { money: 100000, land: 1500, treasure: 50000, slaves: 20, commerce: 0 }, hiddenWealth: 0, fame: 92, virtueMerit: 920, virtueStage: 6 },
      integrity: 95,
      background: '建阳人·撰《洗冤集录》·世界法医学第一书·主理刑狱二十余年·沉冤千古昭雪。',
      famousQuote: '狱事莫重于大辟·大辟莫重于初情。', historicalFate: '淳祐九年广州任上殁', fateHint: 'peacefulDeath'
    },

    quanZuwang: {
      id: 'quanZuwang', name: '全祖望', zi: '绍衣',
      birthYear: 1705, deathYear: 1755, alternateNames: ['谢山'],
      era: '雍乾', dynasty: '清', role: 'scholar',
      title: '翰林院庶吉士', officialTitle: '翰林院庶吉士',
      rankLevel: 12, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 65, military: 25, intelligence: 95, charisma: 78, integrity: 95, benevolence: 80, diplomacy: 50, scholarship: 100, finance: 50, cunning: 60 },
      loyalty: 88, ambition: 55, traits: ['scholarly','idealist','rigorous','reclusive'],
      resources: { privateWealth: { money: 30000, land: 300, treasure: 10000, slaves: 5, commerce: 0 }, hiddenWealth: 0, fame: 88, virtueMerit: 880, virtueStage: 6
      },
      integrity: 95,
      background: '鄞县人·补黄宗羲《宋元学案》·撰《鲒埼亭集》·考据学浙东学派代表·明遗民学问续脉者。',
      famousQuote: '士之欲立·必厚自修。', historicalFate: '乾隆二十年贫病而殁', fateHint: 'exileDeath'
    },

    daihongci: {
      id: 'daihongci', name: '戴鸿慈', zi: '光孺',
      birthYear: 1853, deathYear: 1910, alternateNames: ['少怀','文诚'],
      era: '光绪宣统', dynasty: '清', role: 'reformer',
      title: '协办大学士', officialTitle: '法部尚书·军机大臣',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 88, military: 30, intelligence: 92, charisma: 80, integrity: 92, benevolence: 80, diplomacy: 88, scholarship: 92, finance: 80, cunning: 75 },
      loyalty: 92, ambition: 75, traits: ['reformist','scholarly','rigorous','heroic'],
      resources: { privateWealth: { money: 500000, land: 8000, treasure: 800000, slaves: 200, commerce: 0 }, hiddenWealth: 0, fame: 80, virtueMerit: 850, virtueStage: 6 },
      integrity: 92,
      background: '广东南海人·清末出洋考察五大臣之一·考察十五国宪政·清末预备立宪推动者·法部尚书。',
      famousQuote: '宪政不立·国无以立。', historicalFate: '宣统二年病殁', fateHint: 'peacefulDeath'
    }

  };

  Object.assign(global.HISTORICAL_CHAR_PROFILES, EXT_PROFILES);

  console.log('[historical-ext] 加载扩展 ' + Object.keys(EXT_PROFILES).length + ' 条·总计 ' + Object.keys(global.HISTORICAL_CHAR_PROFILES).length + ' 条');

})(typeof window !== 'undefined' ? window : globalThis);
