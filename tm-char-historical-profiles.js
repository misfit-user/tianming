// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 历史人物档案库（25+）
// 设计方案：设计方案-角色经济.md §历史人物档案库
//
// 用途：
//   1) 剧本加载时若剧本指定了"历史人物 id"，自动套用完整档案
//   2) AI 生成角色时的风格参考
//   3) 玩家在编辑器中可一键插入历史原型
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // 归档角色类型标签：
  // usurper  (篡位权臣，如曹操、司马懿)
  // regent   (摄政/首辅，如霍光、张居正)
  // corrupt  (巨贪，如和珅、严嵩)
  // reformer (改革家，如王安石、商鞅)
  // clean    (清官，如包拯、海瑞)
  // eunuch   (宦官权臣，如魏忠贤、刘瑾)
  // military (名将，如岳飞、韩信)
  // scholar  (文宗，如司马光、范仲淹)
  // loyal    (忠臣，如文天祥、于谦)

  var HISTORICAL_CHAR_PROFILES = {

    // ─── 巨贪系 ───
    heshen: {
      id: 'heshen', name: '和珅', zi: '致斋',
      birthYear: 1750, deathYear: 1799, alternateNames: ['和致斋'],
      era: '乾嘉', dynasty: '清', role: 'corrupt', historicalFaction: '清朝廷',
      title: '文华殿大学士', officialTitle: '领班军机大臣',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 40, intelligence: 92,
                    charisma: 88, integrity: 5, benevolence: 25,
                    diplomacy: 80, scholarship: 70, finance: 98, cunning: 95 },
      loyalty: 60, ambition: 88,
      traits: ['flatterer','greedy','brilliant','vain'],
      resources: {
        privateWealth: { money: 50000000, land: 800000, treasure: 200000000,
                          slaves: 3000, commerce: 100000000 },
        hiddenWealth: 200000000,
        fame: -40, virtueMerit: 120, virtueStage: 2
      },
      integrity: 5, fame_reason: '巨贪·太上皇宠信',
      background: '满洲正红旗，由侍卫起家，入军机廿年，权倾朝野。精于理财，同时广结党羽，家产相当于清廷十五年国库。',
      famousQuote: '人以财生，财以权生。',
      historicalFate: '嘉庆帝即位后立斩，抄家入内帑',
      fateHint: 'confiscation'
    },

    yansong: {
      id: 'yansong', name: '严嵩', zi: '惟中',
      birthYear: 1480, deathYear: 1567, alternateNames: ['介溪','勉庵'],
      era: '嘉靖', dynasty: '明', role: 'corrupt', historicalFaction: '明朝廷',
      title: '武英殿大学士', officialTitle: '首辅',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 45, intelligence: 88,
                    charisma: 78, integrity: 15, benevolence: 30,
                    diplomacy: 85, scholarship: 82, finance: 70, cunning: 92 },
      loyalty: 55, ambition: 85,
      traits: ['flatterer','ruthless','literary','scheming'],
      resources: {
        privateWealth: { money: 8000000, land: 300000, treasure: 30000000,
                          slaves: 1500, commerce: 5000000 },
        hiddenWealth: 15000000,
        fame: -50, virtueMerit: 80, virtueStage: 2
      },
      integrity: 15,
      background: '江西分宜人，弘治进士，以青词媚世宗得宠，掌权二十年，与子严世蕃形成严党。',
      famousQuote: '臣一日不在君侧，此心终夕不安。',
      historicalFate: '嘉靖四十一年弹劾罢职，抄家子斩',
      fateHint: 'confiscation'
    },

    lubuwei: {
      id: 'lubuwei', name: '吕不韦', zi: '文信',
      birthYear: -291, deathYear: -235, alternateNames: ['文信侯'], historicalFaction: '秦',
      era: '战国末', dynasty: '秦', role: 'regent',
      title: '文信侯', officialTitle: '相国',
      rankLevel: 30, socialClass: 'noble', department: 'central',
      abilities: { governance: 90, military: 70, intelligence: 95,
                    charisma: 80, integrity: 40, benevolence: 50,
                    diplomacy: 92, scholarship: 80, finance: 95, cunning: 90 },
      loyalty: 60, ambition: 95,
      traits: ['merchant','ambitious','scheming','brilliant'],
      resources: {
        privateWealth: { money: 5000000, land: 200000, treasure: 20000000,
                          slaves: 10000, commerce: 50000000 },
        hiddenWealth: 5000000,
        fame: 20, virtueMerit: 200, virtueStage: 3
      },
      integrity: 40,
      background: '阳翟大商人，奇货可居，以秦异人为赌注，终得相国之位，门客三千。',
      famousQuote: '奇货可居。',
      historicalFate: '嫪毐之乱后饮鸩自尽',
      fateHint: 'forcedDeath'
    },

    weizhongxian: {
      id: 'weizhongxian', name: '魏忠贤', zi: '完吾',
      birthYear: 1568, deathYear: 1627, alternateNames: ['李进忠'],
      era: '天启', dynasty: '明', role: 'eunuch', historicalFaction: '明朝廷',
      title: '九千岁', officialTitle: '司礼秉笔太监·东厂提督',
      rankLevel: 28, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 60, military: 30, intelligence: 75,
                    charisma: 65, integrity: 10, benevolence: 10,
                    diplomacy: 40, scholarship: 20, finance: 60, cunning: 95 },
      loyalty: 70, ambition: 95,
      traits: ['ruthless','vain','illiterate','violent'],
      resources: {
        privateWealth: { money: 10000000, land: 500000, treasure: 20000000,
                          slaves: 5000, commerce: 8000000 },
        hiddenWealth: 20000000,
        fame: -70, virtueMerit: 0, virtueStage: 1
      },
      integrity: 10,
      background: '河北肃宁人，破家入宫，由客氏引荐得宠，阉党权倾朝野，东林党人多被其害。',
      famousQuote: '九千岁！',
      historicalFate: '崇祯即位后贬谪，自缢于阜城',
      fateHint: 'abdication'
    },

    // ─── 改革家系 ───
    zhangjuzheng: {
      id: 'zhangjuzheng', name: '张居正', zi: '叔大',
      birthYear: 1525, deathYear: 1582, alternateNames: ['张白圭','文忠'],
      era: '万历', dynasty: '明', role: 'reformer', historicalFaction: '明朝廷',
      title: '太师', officialTitle: '内阁首辅',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 98, military: 70, intelligence: 95,
                    charisma: 85, integrity: 60, benevolence: 55,
                    diplomacy: 88, scholarship: 92, finance: 95, cunning: 85 },
      loyalty: 75, ambition: 80,
      traits: ['rigorous','scholarly','reformist','authoritarian'],
      resources: {
        privateWealth: { money: 2000000, land: 150000, treasure: 5000000,
                          slaves: 500, commerce: 1000000 },
        hiddenWealth: 1500000,
        fame: 50, virtueMerit: 450, virtueStage: 4
      },
      integrity: 60, historicalReform: ['oneWhip'],
      background: '湖广江陵人，嘉靖进士，辅幼主万历十年，推行考成法、一条鞭法，国库大盈。',
      famousQuote: '苟利社稷，死生以之。',
      historicalFate: '万历十年病殁；死后被清算抄家',
      fateHint: 'posthumousConfiscation'
    },

    wanganshi: {
      id: 'wanganshi', name: '王安石', zi: '介甫',
      birthYear: 1021, deathYear: 1086, alternateNames: ['王半山','文公','临川先生'],
      era: '熙宁', dynasty: '北宋', role: 'reformer', historicalFaction: '宋朝廷',
      title: '司空', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 90, military: 55, intelligence: 95,
                    charisma: 70, integrity: 85, benevolence: 70,
                    diplomacy: 50, scholarship: 98, finance: 92, cunning: 60 },
      loyalty: 80, ambition: 70,
      traits: ['stubborn','scholarly','reformist','ascetic'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 100000,
                          slaves: 20, commerce: 0 },
        hiddenWealth: 0,
        fame: 40, virtueMerit: 600, virtueStage: 5
      },
      integrity: 92, historicalReform: ['fieldEquity'],
      background: '抚州临川人，庆历进士。神宗朝推新法（青苗/募役/方田均税），党争激烈。',
      famousQuote: '天变不足畏，祖宗不足法，人言不足恤。',
      historicalFate: '元丰末罢相，闲居金陵，不以家资自顾',
      fateHint: 'retirement'
    },

    shangyang: {
      id: 'shangyang', name: '商鞅', zi: '公孙',
      birthYear: -390, deathYear: -338, alternateNames: ['卫鞅','公孙鞅'],
      era: '战国', dynasty: '秦孝公', role: 'reformer', historicalFaction: '秦',
      title: '商君', officialTitle: '大良造',
      rankLevel: 28, socialClass: 'noble', department: 'central',
      abilities: { governance: 98, military: 85, intelligence: 95,
                    charisma: 60, integrity: 70, benevolence: 25,
                    diplomacy: 75, scholarship: 90, finance: 90, cunning: 85 },
      loyalty: 70, ambition: 85,
      traits: ['rigorous','ruthless','reformist','legalist'],
      resources: {
        privateWealth: { money: 500000, land: 50000, treasure: 200000,
                          slaves: 200, commerce: 0 },
        hiddenWealth: 0,
        fame: 30, virtueMerit: 400, virtueStage: 4
      },
      integrity: 75,
      background: '卫国人，仕秦孝公。两次变法：废井田，开阡陌，奖军功，连坐法，奠定秦强基础。',
      famousQuote: '治世不一道，便国不法古。',
      historicalFate: '孝公死，被旧贵族诬谋反，车裂于咸阳',
      fateHint: 'execution'
    },

    // ─── 权臣系 ───
    caocao: {
      id: 'caocao', name: '曹操', zi: '孟德',
      birthYear: 155, deathYear: 220, alternateNames: ['阿瞒','吉利','魏武帝'],
      era: '汉末', dynasty: '东汉', role: 'usurper', historicalFaction: '曹魏',
      title: '魏王', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'noble', department: 'central',
      abilities: { governance: 92, military: 95, intelligence: 95,
                    charisma: 88, integrity: 50, benevolence: 55,
                    diplomacy: 90, scholarship: 85, finance: 85, cunning: 95 },
      loyalty: 30, ambition: 95,
      traits: ['brilliant','ruthless','literary','ambitious'],
      resources: {
        privateWealth: { money: 3000000, land: 500000, treasure: 10000000,
                          slaves: 5000, commerce: 2000000 },
        hiddenWealth: 0,
        fame: 10, virtueMerit: 500, virtueStage: 4
      },
      integrity: 50,
      background: '沛国谯人，宦官之后。挟天子以令诸侯，统一北方，奠定魏基。',
      famousQuote: '宁教我负天下人，休教天下人负我。',
      historicalFate: '建安二十五年病殁洛阳，次年其子曹丕篡汉',
      fateHint: 'usurpation'
    },

    simayi: {
      id: 'simayi', name: '司马懿', zi: '仲达',
      birthYear: 179, deathYear: 251, alternateNames: ['宣帝','晋宣帝'],
      era: '三国末', dynasty: '曹魏', role: 'usurper', historicalFaction: '曹魏',
      title: '舞阳侯', officialTitle: '太尉',
      rankLevel: 30, socialClass: 'noble', department: 'military',
      abilities: { governance: 88, military: 92, intelligence: 98,
                    charisma: 75, integrity: 45, benevolence: 40,
                    diplomacy: 80, scholarship: 90, finance: 70, cunning: 98 },
      loyalty: 30, ambition: 92,
      traits: ['patient','scheming','brilliant','ruthless'],
      resources: {
        privateWealth: { money: 2000000, land: 300000, treasure: 5000000,
                          slaves: 2000, commerce: 500000 },
        hiddenWealth: 500000,
        fame: 20, virtueMerit: 400, virtueStage: 4
      },
      integrity: 50,
      background: '河内温县人，历仕曹魏四朝。高平陵之变诛曹爽，为晋朝奠基。',
      famousQuote: '能忍人之不能忍。',
      historicalFate: '嘉平三年殁；孙司马炎篡魏建晋',
      fateHint: 'usurpation'
    },

    huoguang: {
      id: 'huoguang', name: '霍光', zi: '子孟',
      birthYear: -135, deathYear: -68, alternateNames: ['霍子孟','宣成侯'],
      era: '昭宣', dynasty: '西汉', role: 'regent', historicalFaction: '汉朝廷',
      title: '大司马大将军', officialTitle: '博陆侯',
      rankLevel: 30, socialClass: 'noble', department: 'central',
      abilities: { governance: 90, military: 80, intelligence: 88,
                    charisma: 70, integrity: 65, benevolence: 55,
                    diplomacy: 75, scholarship: 70, finance: 75, cunning: 85 },
      loyalty: 80, ambition: 80,
      traits: ['rigorous','patient','authoritarian','loyal'],
      resources: {
        privateWealth: { money: 2000000, land: 200000, treasure: 5000000,
                          slaves: 1500, commerce: 0 },
        hiddenWealth: 0,
        fame: 30, virtueMerit: 500, virtueStage: 4
      },
      integrity: 65,
      background: '河东平阳人，霍去病异母弟。武帝托孤，辅昭帝、立宣帝，废刘贺。',
      famousQuote: '伊尹行之于前，霍光行之于后。',
      historicalFate: '地节二年殁；后霍氏族灭',
      fateHint: 'posthumousClanDestruction'
    },

    aobai: {
      id: 'aobai', name: '鳌拜', zi: '',
      birthYear: 1610, deathYear: 1669, alternateNames: [],
      era: '康熙初', dynasty: '清', role: 'regent', historicalFaction: '清朝廷',
      title: '太师', officialTitle: '辅政大臣',
      rankLevel: 30, socialClass: 'noble', department: 'military',
      abilities: { governance: 55, military: 95, intelligence: 65,
                    charisma: 75, integrity: 45, benevolence: 35,
                    diplomacy: 40, scholarship: 30, finance: 55, cunning: 75 },
      loyalty: 55, ambition: 85,
      traits: ['brave','arrogant','authoritarian','illiterate'],
      resources: {
        privateWealth: { money: 1500000, land: 200000, treasure: 3000000,
                          slaves: 1500, commerce: 0 },
        hiddenWealth: 1000000,
        fame: -10, virtueMerit: 150, virtueStage: 2
      },
      integrity: 45,
      background: '满洲镍黄旗，立战功无数。顺治遗诏为辅政四大臣之首，专权跋扈。',
      famousQuote: '',
      historicalFate: '康熙八年被智擒，禁锢终身',
      fateHint: 'imprisonment'
    },

    // ─── 清官系 ───
    baozheng: {
      id: 'baozheng', name: '包拯', zi: '希仁',
      birthYear: 999, deathYear: 1062, alternateNames: ['包青天','包公','孝肃'],
      era: '仁宗朝', dynasty: '北宋', role: 'clean', historicalFaction: '宋朝廷',
      title: '枢密副使', officialTitle: '权知开封府',
      rankLevel: 25, socialClass: 'civilOfficial', department: 'judicial',
      abilities: { governance: 85, military: 40, intelligence: 85,
                    charisma: 75, integrity: 98, benevolence: 90,
                    diplomacy: 55, scholarship: 80, finance: 60, cunning: 50 },
      loyalty: 95, ambition: 40,
      traits: ['upright','brave','fair','strict'],
      resources: {
        privateWealth: { money: 50000, land: 1000, treasure: 20000,
                          slaves: 10, commerce: 0 },
        hiddenWealth: 0,
        fame: 85, virtueMerit: 750, virtueStage: 5
      },
      integrity: 98,
      background: '庐州合肥人，天圣进士。铁面无私，陈州粜粮、断牛舌案、狸猫换太子，民称包青天。',
      famousQuote: '廉者，民之表也；贪者，民之贼也。',
      historicalFate: '嘉祐七年病殁',
      fateHint: 'peacefulDeath'
    },

    hairui: {
      id: 'hairui', name: '海瑞', zi: '汝贤',
      birthYear: 1514, deathYear: 1587, alternateNames: ['刚峰','忠介'],
      era: '嘉靖-万历', dynasty: '明', role: 'clean', historicalFaction: '明朝廷',
      title: '南京右都御史', officialTitle: '右佥都御史巡抚应天',
      rankLevel: 26, socialClass: 'civilOfficial', department: 'judicial',
      abilities: { governance: 75, military: 30, intelligence: 75,
                    charisma: 65, integrity: 100, benevolence: 85,
                    diplomacy: 30, scholarship: 75, finance: 55, cunning: 30 },
      loyalty: 90, ambition: 35,
      traits: ['upright','stubborn','ascetic','idealist'],
      resources: {
        privateWealth: { money: 20000, land: 200, treasure: 5000,
                          slaves: 2, commerce: 0 },
        hiddenWealth: 0,
        fame: 90, virtueMerit: 800, virtueStage: 6
      },
      integrity: 100,
      background: '琼州琼山人，嘉靖举人。抬棺上《治安疏》骂世宗，一生清苦，死时仅余俸金八两。',
      famousQuote: '天下之事，坏于不公。',
      historicalFate: '万历十五年殁于南京官署，丧事无钱，同僚凑银',
      fateHint: 'peacefulDeath'
    },

    // ─── 忠臣系 ───
    wentianxiang: {
      id: 'wentianxiang', name: '文天祥', zi: '宋瑞',
      birthYear: 1236, deathYear: 1283, alternateNames: ['履善','文山','信国'],
      era: '宋末', dynasty: '南宋', role: 'loyal', historicalFaction: '宋朝廷',
      title: '少保·信国公', officialTitle: '右丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 75, military: 65, intelligence: 90,
                    charisma: 95, integrity: 100, benevolence: 85,
                    diplomacy: 70, scholarship: 95, finance: 60, cunning: 50 },
      loyalty: 100, ambition: 70,
      traits: ['loyal','literary','heroic','upright'],
      resources: {
        privateWealth: { money: 100000, land: 5000, treasure: 200000,
                          slaves: 100, commerce: 0 },
        hiddenWealth: 0,
        fame: 95, virtueMerit: 900, virtueStage: 6
      },
      integrity: 100,
      background: '吉州吉水人，宝祐进士。临安陷，散家资募兵抗元，被俘三年不屈。',
      famousQuote: '人生自古谁无死，留取丹心照汗青。',
      historicalFate: '至元十九年就义于大都柴市',
      fateHint: 'martyrdom'
    },

    fanzhongyan: {
      id: 'fanzhongyan', name: '范仲淹', zi: '希文',
      birthYear: 989, deathYear: 1052, alternateNames: ['朱说','文正'],
      era: '仁宗朝', dynasty: '北宋', role: 'scholar', historicalFaction: '宋朝廷',
      title: '资政殿学士', officialTitle: '参知政事',
      rankLevel: 27, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 90, military: 75, intelligence: 92,
                    charisma: 85, integrity: 95, benevolence: 95,
                    diplomacy: 70, scholarship: 98, finance: 75, cunning: 55 },
      loyalty: 95, ambition: 60,
      traits: ['scholarly','benevolent','reformist','upright'],
      resources: {
        privateWealth: { money: 80000, land: 2000, treasure: 50000,
                          slaves: 30, commerce: 0 },
        hiddenWealth: 0,
        fame: 92, virtueMerit: 850, virtueStage: 6
      },
      integrity: 95,
      background: '苏州吴县人，大中祥符进士。庆历新政先驱；镇陕西拒西夏；设范氏义庄济族人。',
      famousQuote: '先天下之忧而忧，后天下之乐而乐。',
      historicalFate: '皇祐四年病殁',
      fateHint: 'peacefulDeath'
    },

    simaguang: {
      id: 'simaguang', name: '司马光', zi: '君实',
      birthYear: 1019, deathYear: 1086, alternateNames: ['迂叟','文正','涑水先生'],
      era: '哲宗朝', dynasty: '北宋', role: 'scholar', historicalFaction: '宋朝廷',
      title: '温国公', officialTitle: '同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 30, intelligence: 95,
                    charisma: 70, integrity: 90, benevolence: 80,
                    diplomacy: 50, scholarship: 100, finance: 65, cunning: 50 },
      loyalty: 95, ambition: 50,
      traits: ['scholarly','conservative','rigorous','upright'],
      resources: {
        privateWealth: { money: 100000, land: 3000, treasure: 80000,
                          slaves: 20, commerce: 0 },
        hiddenWealth: 0,
        fame: 80, virtueMerit: 820, virtueStage: 6
      },
      integrity: 92,
      background: '陕州夏县人，宝元进士。编《资治通鉴》十九年；保守派领袖，尽废新法。',
      famousQuote: '鉴前世之兴衰，考当今之得失。',
      historicalFate: '元祐元年拜相，同年殁',
      fateHint: 'peacefulDeath'
    },

    // ─── 名将系 ───
    yuefei: {
      id: 'yuefei', name: '岳飞', zi: '鹏举',
      birthYear: 1103, deathYear: 1142, alternateNames: ['岳武穆','武穆王','忠武'],
      era: '南宋初', dynasty: '南宋', role: 'military', historicalFaction: '宋朝廷',
      title: '鄂王', officialTitle: '枢密副使',
      rankLevel: 28, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 98, intelligence: 85,
                    charisma: 90, integrity: 95, benevolence: 85,
                    diplomacy: 55, scholarship: 80, finance: 60, cunning: 50 },
      loyalty: 100, ambition: 70,
      traits: ['loyal','brave','rigorous','heroic'],
      resources: {
        privateWealth: { money: 300000, land: 10000, treasure: 500000,
                          slaves: 200, commerce: 0 },
        hiddenWealth: 0,
        fame: 95, virtueMerit: 900, virtueStage: 6
      },
      integrity: 98,
      background: '相州汤阴人。岳家军战无不胜，大破金兀术。风波亭被秦桧构陷。',
      famousQuote: '还我河山！',
      historicalFate: '绍兴十一年"莫须有"罪名被害风波亭',
      fateHint: 'executionByFraming'
    },

    hanxin: {
      id: 'hanxin', name: '韩信', zi: '',
      birthYear: -231, deathYear: -196, alternateNames: ['淮阴侯','齐王','楚王'],
      era: '楚汉之际', dynasty: '西汉', role: 'military', historicalFaction: '汉朝廷',
      title: '淮阴侯', officialTitle: '大将军·楚王',
      rankLevel: 30, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 65, military: 100, intelligence: 92,
                    charisma: 75, integrity: 60, benevolence: 65,
                    diplomacy: 55, scholarship: 50, finance: 40, cunning: 75 },
      loyalty: 70, ambition: 80,
      traits: ['brilliant','proud','humble_origin','brave'],
      resources: {
        privateWealth: { money: 300000, land: 30000, treasure: 500000,
                          slaves: 500, commerce: 0 },
        hiddenWealth: 0,
        fame: 80, virtueMerit: 500, virtueStage: 4
      },
      integrity: 65,
      background: '淮阴人，少时胯下之辱，后成汉初三杰之一，平齐破项，功盖天下。',
      famousQuote: '成也萧何，败也萧何。',
      historicalFate: '汉高祖十一年被吕后诱杀于长乐宫',
      fateHint: 'executionByClanDestruction'
    },

    // ─── 清代其他 ───
    nianGengyao: {
      id: 'nianGengyao', name: '年羹尧', zi: '亮工',
      birthYear: 1679, deathYear: 1726, alternateNames: ['双峰'],
      era: '雍正初', dynasty: '清', role: 'military', historicalFaction: '清朝廷',
      title: '一等公', officialTitle: '川陕总督·抚远大将军',
      rankLevel: 29, socialClass: 'militaryOfficial', department: 'military',
      abilities: { governance: 75, military: 92, intelligence: 80,
                    charisma: 82, integrity: 35, benevolence: 40,
                    diplomacy: 65, scholarship: 70, finance: 70, cunning: 80 },
      loyalty: 55, ambition: 90,
      traits: ['arrogant','brave','ambitious','ruthless'],
      resources: {
        privateWealth: { money: 3000000, land: 100000, treasure: 8000000,
                          slaves: 2000, commerce: 1000000 },
        hiddenWealth: 5000000,
        fame: 30, virtueMerit: 300, virtueStage: 3
      },
      integrity: 35,
      background: '汉军镶黄旗，康熙进士。平青海罗卜藏丹津有功，位极人臣后恃功骄横。',
      famousQuote: '',
      historicalFate: '雍正三年被赐自尽，九十二款大罪',
      fateHint: 'forcedDeath'
    },

    // ─── 更多经典 ───
    liusi: {
      id: 'liusi', name: '李斯', zi: '通古',
      birthYear: -284, deathYear: -208, alternateNames: [],
      era: '秦', dynasty: '秦', role: 'regent', historicalFaction: '秦',
      title: '廷尉·丞相', officialTitle: '左丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 55, intelligence: 95,
                    charisma: 75, integrity: 40, benevolence: 35,
                    diplomacy: 85, scholarship: 95, finance: 85, cunning: 95 },
      loyalty: 65, ambition: 95,
      traits: ['brilliant','ambitious','scheming','legalist'],
      resources: {
        privateWealth: { money: 2000000, land: 50000, treasure: 3000000,
                          slaves: 500, commerce: 0 },
        hiddenWealth: 500000,
        fame: 10, virtueMerit: 400, virtueStage: 4
      },
      integrity: 45,
      background: '上蔡人，荀子弟子。辅秦始皇统一六国；焚书坑儒；沙丘之谋助胡亥篡位。',
      famousQuote: '鼠在仓廪之中，食积粟，居大庑之下。',
      historicalFate: '二世二年被赵高构陷腰斩咸阳',
      fateHint: 'execution'
    },

    zhugeLiang: {
      id: 'zhugeLiang', name: '诸葛亮', zi: '孔明',
      birthYear: 181, deathYear: 234, alternateNames: ['卧龙','武乡侯','忠武侯'],
      era: '三国初', dynasty: '蜀汉', role: 'scholar', historicalFaction: '蜀汉',
      title: '武乡侯', officialTitle: '丞相',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 100, military: 90, intelligence: 100,
                    charisma: 95, integrity: 98, benevolence: 90,
                    diplomacy: 98, scholarship: 100, finance: 85, cunning: 92 },
      loyalty: 100, ambition: 75,
      traits: ['brilliant','loyal','rigorous','scholarly'],
      resources: {
        privateWealth: { money: 80000, land: 800, treasure: 30000,
                          slaves: 20, commerce: 0 },
        hiddenWealth: 0,
        fame: 100, virtueMerit: 1000, virtueStage: 6
      },
      integrity: 100,
      background: '琅琊阳都人。三顾茅庐出山佐刘备，六出祁山。死时遗产仅成都桑八百株、薄田十五顷。',
      famousQuote: '鞠躬尽瘁，死而后已。',
      historicalFate: '建兴十二年殁于五丈原',
      fateHint: 'peacefulDeath'
    },

    xiaohe: {
      id: 'xiaohe', name: '萧何', zi: '',
      birthYear: -257, deathYear: -193, alternateNames: ['酂文终侯'],
      era: '秦末汉初', dynasty: '西汉', role: 'regent', historicalFaction: '汉朝廷',
      title: '酂侯', officialTitle: '相国',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 98, military: 55, intelligence: 90,
                    charisma: 85, integrity: 70, benevolence: 80,
                    diplomacy: 85, scholarship: 85, finance: 95, cunning: 80 },
      loyalty: 95, ambition: 60,
      traits: ['rigorous','loyal','benevolent','patient'],
      resources: {
        privateWealth: { money: 500000, land: 20000, treasure: 500000,
                          slaves: 300, commerce: 0 },
        hiddenWealth: 0,
        fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 75,
      background: '沛县人，刘邦发小。入咸阳第一件事是收秦宫图籍律令；后方供输，汉初三杰之首。',
      famousQuote: '成也萧何，败也萧何（指韩信事）。',
      historicalFate: '惠帝二年病殁',
      fateHint: 'peacefulDeath'
    },

    fangxuanling: {
      id: 'fangxuanling', name: '房玄龄', zi: '乔',
      birthYear: 579, deathYear: 648, alternateNames: ['房乔','文昭'],
      era: '贞观', dynasty: '唐', role: 'scholar', historicalFaction: '唐朝廷',
      title: '梁国公', officialTitle: '尚书左仆射',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 50, intelligence: 92,
                    charisma: 80, integrity: 90, benevolence: 85,
                    diplomacy: 75, scholarship: 95, finance: 80, cunning: 60 },
      loyalty: 95, ambition: 55,
      traits: ['rigorous','scholarly','patient','benevolent'],
      resources: {
        privateWealth: { money: 300000, land: 8000, treasure: 300000,
                          slaves: 100, commerce: 0 },
        hiddenWealth: 0,
        fame: 80, virtueMerit: 780, virtueStage: 5
      },
      integrity: 90,
      background: '齐州临淄人。太宗朝辅政十五年，修贞观律，撰梁陈齐周隋五书。',
      famousQuote: '君臣同心，斯固美矣。',
      historicalFate: '贞观二十二年病殁，配飨太庙',
      fateHint: 'peacefulDeath'
    },

    qinhui: {
      id: 'qinhui', name: '秦桧', zi: '会之',
      birthYear: 1090, deathYear: 1155, alternateNames: ['秦会之','缪丑'],
      era: '南宋初', dynasty: '南宋', role: 'corrupt', historicalFaction: '宋朝廷',
      title: '申王', officialTitle: '右仆射同中书门下平章事',
      rankLevel: 30, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 70, military: 20, intelligence: 85,
                    charisma: 70, integrity: 20, benevolence: 25,
                    diplomacy: 90, scholarship: 85, finance: 65, cunning: 95 },
      loyalty: 35, ambition: 85,
      traits: ['scheming','ruthless','flatterer','vain'],
      resources: {
        privateWealth: { money: 3000000, land: 100000, treasure: 5000000,
                          slaves: 800, commerce: 500000 },
        hiddenWealth: 2000000,
        fame: -85, virtueMerit: 100, virtueStage: 2
      },
      integrity: 20,
      background: '建康人。靖康之变被俘，南返主和派，构陷岳飞于风波亭，专权十九年。',
      famousQuote: '莫须有。',
      historicalFate: '绍兴二十五年病殁；后追夺王爵，名列《宋史·奸臣传》',
      fateHint: 'posthumousDishonor'
    },

    kouzhun: {
      id: 'kouzhun', name: '寇准', zi: '平仲',
      birthYear: 961, deathYear: 1023, alternateNames: ['莱国忠愍'],
      era: '真宗朝', dynasty: '北宋', role: 'loyal', historicalFaction: '宋朝廷',
      title: '莱国公', officialTitle: '同中书门下平章事',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 85, military: 70, intelligence: 88,
                    charisma: 85, integrity: 85, benevolence: 75,
                    diplomacy: 90, scholarship: 85, finance: 70, cunning: 75 },
      loyalty: 95, ambition: 70,
      traits: ['brave','luxurious','upright','proud'],
      resources: {
        privateWealth: { money: 400000, land: 10000, treasure: 800000,
                          slaves: 200, commerce: 0 },
        hiddenWealth: 0,
        fame: 70, virtueMerit: 600, virtueStage: 5
      },
      integrity: 85,
      background: '华州下邽人，太平兴国进士。景德元年力主真宗亲征，达成澶渊之盟。后遭丁谓构陷贬雷州。',
      famousQuote: '纵无横草之功，亦不失为栋梁之才。',
      historicalFate: '天圣元年殁于雷州贬所',
      fateHint: 'exileDeath'
    },

    yaoChong: {
      id: 'yaoChong', name: '姚崇', zi: '元之',
      birthYear: 651, deathYear: 721, alternateNames: ['姚元崇','文献','救时宰相'],
      era: '开元', dynasty: '唐', role: 'reformer', historicalFaction: '唐朝廷',
      title: '梁国公', officialTitle: '紫微令',
      rankLevel: 29, socialClass: 'civilOfficial', department: 'central',
      abilities: { governance: 95, military: 55, intelligence: 92,
                    charisma: 78, integrity: 85, benevolence: 75,
                    diplomacy: 75, scholarship: 88, finance: 82, cunning: 70 },
      loyalty: 90, ambition: 60,
      traits: ['rigorous','reformist','pragmatic','upright'],
      resources: {
        privateWealth: { money: 200000, land: 5000, treasure: 300000,
                          slaves: 50, commerce: 0 },
        hiddenWealth: 0,
        fame: 75, virtueMerit: 700, virtueStage: 5
      },
      integrity: 88,
      background: '陕州硖石人。武后朝三起三落，玄宗朝《十事要说》开启开元盛世。',
      famousQuote: '以不贪为宝，以清慎自守。',
      historicalFate: '开元九年殁，临终戒子薄葬',
      fateHint: 'peacefulDeath'
    },

    liuji: {
      id: 'liuji', name: '刘瑾', zi: '',
      birthYear: 1451, deathYear: 1510, alternateNames: ['立皇帝','八虎之首'],
      era: '正德', dynasty: '明', role: 'eunuch', historicalFaction: '明朝廷',
      title: '立皇帝', officialTitle: '司礼监掌印',
      rankLevel: 28, socialClass: 'imperial', department: 'imperial',
      abilities: { governance: 60, military: 35, intelligence: 80,
                    charisma: 70, integrity: 10, benevolence: 20,
                    diplomacy: 55, scholarship: 40, finance: 85, cunning: 92 },
      loyalty: 60, ambition: 92,
      traits: ['greedy','flatterer','ruthless','scheming'],
      resources: {
        privateWealth: { money: 15000000, land: 500000, treasure: 30000000,
                          slaves: 3000, commerce: 5000000 },
        hiddenWealth: 50000000,
        fame: -65, virtueMerit: 0, virtueStage: 1
      },
      integrity: 8,
      background: '陕西兴平人。武宗朝"八虎"之首，党羽遍朝，抄家时白银数百万。',
      famousQuote: '',
      historicalFate: '正德五年凌迟处死，抄家银 251 万两',
      fateHint: 'execution'
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 工具函数
  // ═════════════════════════════════════════════════════════════

  // 列出指定朝代/角色类型的档案
  function listProfilesByDynasty(dynasty) {
    return Object.values(HISTORICAL_CHAR_PROFILES).filter(function(p) {
      return dynasty && p.dynasty && p.dynasty.indexOf(dynasty) !== -1;
    });
  }

  function listProfilesByRole(role) {
    return Object.values(HISTORICAL_CHAR_PROFILES).filter(function(p) { return p.role === role; });
  }

  // 从档案生成 char 对象（用于剧本加载或编辑器插入）
  function createCharFromProfile(profileId, opts) {
    var p = HISTORICAL_CHAR_PROFILES[profileId];
    if (!p) return null;
    opts = opts || {};
    var ch = {
      id: opts.id || 'char_' + profileId + '_' + Math.random().toString(36).slice(2, 5),
      name: p.name,
      zi: p.zi,
      title: p.title,
      officialTitle: p.officialTitle,
      rankLevel: p.rankLevel,
      socialClass: p.socialClass,
      department: p.department,
      loyalty: p.loyalty,
      ambition: p.ambition,
      integrity: p.integrity,
      abilities: Object.assign({}, p.abilities),
      traits: p.traits ? p.traits.slice() : [],
      resources: {
        privateWealth: Object.assign({}, p.resources.privateWealth || {}),
        hiddenWealth: p.resources.hiddenWealth || 0,
        fame: p.resources.fame || 0,
        virtueMerit: p.resources.virtueMerit || 0,
        virtueStage: p.resources.virtueStage || 1,
        publicTreasury: { balance: 0, isReadOnly: true }
      },
      background: p.background,
      famousQuote: p.famousQuote,
      historicalFate: p.historicalFate,
      fateHint: p.fateHint,
      era: p.era,
      dynasty: p.dynasty,
      historicalFaction: p.historicalFaction || '',
      faction: (typeof global._resolveFactionForChar === 'function')
        ? global._resolveFactionForChar({
            profile: p,
            location: opts.location || p.location,
            timelineStatus: 'alive'
          })
        : '',
      _fromProfile: profileId
    };
    return ch;
  }

  // 批量从剧本的 historicalChars 字段加载
  // sc.historicalChars = ['heshen', 'yansong', 'zhangjuzheng']
  function loadHistoricalCharsFromScenario(scenarioObj) {
    if (!scenarioObj || !Array.isArray(scenarioObj.historicalChars)) return 0;
    var loaded = 0;
    if (!GM.chars) GM.chars = [];
    scenarioObj.historicalChars.forEach(function(pid) {
      if (typeof pid === 'string') {
        var ch = createCharFromProfile(pid);
        if (ch) { GM.chars.push(ch); loaded++; }
      } else if (typeof pid === 'object' && pid.id) {
        var ch2 = createCharFromProfile(pid.id, pid);
        if (ch2) { GM.chars.push(ch2); loaded++; }
      }
    });
    return loaded;
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.HISTORICAL_CHAR_PROFILES = HISTORICAL_CHAR_PROFILES;
  global.listProfilesByDynasty = listProfilesByDynasty;
  global.listProfilesByRole = listProfilesByRole;
  global.createCharFromProfile = createCharFromProfile;
  global.loadHistoricalCharsFromScenario = loadHistoricalCharsFromScenario;

  console.log('[historical] 加载 ' + Object.keys(HISTORICAL_CHAR_PROFILES).length + ' 条历史人物档案');

})(typeof window !== 'undefined' ? window : this);
