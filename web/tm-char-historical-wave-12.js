// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-12.js
// Domain: NPC / 历史人物 data
// 来源·波 12·收官·补遗·冲刺 500
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
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-12] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
