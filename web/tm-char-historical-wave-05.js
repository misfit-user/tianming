// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-char-historical-wave-05.js
// Domain: NPC / 历史人物 data
// 来源·波 5
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
  };
  Object.assign(global.HISTORICAL_CHAR_PROFILES, WAVE_PROFILES);
  console.log('[historical-wave-05] 加载 ' + Object.keys(WAVE_PROFILES).length + ' 条');
})(typeof window !== 'undefined' ? window : globalThis);
