/**
 * 官方剧本：天启七年·九月（公元 1627 年 10 月）
 * ===============================================================
 *
 * 历史坐标：
 *   · 天启七年八月乙卯（1627-08-22）明熹宗朱由校崩，年二十三
 *   · 八月丁巳（1627-10-02）信王朱由检即皇帝位，年十七
 *   · 本剧本始于九月（十月西历），新帝登基约一月
 *   · 魏忠贤仍据司礼监、东厂；客氏刚被逐出宫，阉党震恐
 *   · 崇祯改元待明年元旦
 *
 * 玩家扮演：明思宗·朱由检
 *
 * 开局戏眼：处置魏忠贤之时机与手段；辽东经略之人选；陕北赈饥之财源
 *
 * 扩充数据（v2）：
 *   · 朝臣/后妃/宦官/外镇/敌方/逆雄  46 人（含历史低阶但将崛起者）
 *   · 势力 7（明朝廷 / 后金 / 察哈尔 / 朝鲜 / 播州土司 / 郑氏海商 / 陕北饥民）
 *   · 党派 7（阉党 / 东林 / 浙党 / 楚党 / 齐党 / 宣党 / 昆党）
 *   · 阶层 9（宗室 / 士大夫 / 缙绅 / 自耕农 / 佃农流民 / 商人 / 工匠 / 军户 / 僧道）
 *   · 官制 ~35 职位（内阁/六部/都察院/司礼监/锦衣卫/五军都督府/翰林院/地方督抚）
 *   · 行政区划 4 省下沉到府级
 *   · 变量 22
 *   · 开局事件 18
 *   · 人物间关系 32 条
 *   · 紫禁城宫殿 8 座
 *   · 时间轴 14 条（原史重要节点，供 AI 参考）
 *   · 规则 6 条
 *   · 世界观 6 大类
 *   · 自定义徭役/兵制预设
 */
(function (global) {
  'use strict';

  var SID = 'sc-tianqi7-1627';

  function _uid(prefix) {
    return (prefix || 'x_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  人物字段标准化（对齐 CharFullSchema）
  //  · 补齐字/号/籍贯/族/信仰/门第/品级
  //  · 补齐八才缺失项（武勇/智力/政务/管理/军事/魅力/外交/仁厚）
  //  · 修正 privateWealth.cash → .money（schema 规定）
  //  · learning 误用为数字时保留，另加 _academicScore 兼容；若未设则按科举出身默认
  //  · traits ↔ traitIds 双向兼容
  // ═══════════════════════════════════════════════════════════════════
  function _normalizeChar(c) {
    if (!c) return c;
    // 籍贯/民族/信仰/门第
    if (!c.ethnicity) c.ethnicity = (c.faction === '后金') ? '女真' : (c.faction === '察哈尔' ? '蒙古' : (c.faction === '朝鲜' ? '朝鲜' : '汉'));
    if (!c.faith) c.faith = (c.faction === '后金' ? '萨满' : (c.faction === '察哈尔' ? '藏传佛教' : (c.faction === '朝鲜' ? '儒教' : '儒')));
    if (!c.familyTier) {
      if (c.isRoyal || c.royalRelation) c.familyTier = 'imperial';
      else if ((c.officialTitle || '').match(/尚书|大学士|都督|总兵|巡抚|总督|经略|皇后/)) c.familyTier = 'gentry';
      else c.familyTier = 'common';
    }
    // 学识：若为数字（旧字段），保留原始数字到 _intellectScore
    if (typeof c.learning === 'number') { c._intellectScore = c.learning; delete c.learning; }
    if (!c.learning) {
      if (c.isRoyal) c.learning = '皇子·经筵';
      else if ((c.officialTitle||'').match(/大学士|尚书|侍郎|御史|主事|翰林/)) c.learning = '进士';
      else if ((c.officialTitle||'').match(/太监/)) c.learning = '白身·不识字';
      else if ((c.officialTitle||'').match(/总兵|都督|参将|游击/)) c.learning = '武举/行伍';
      else c.learning = '白身';
    }
    // 品级
    if (c.rankLevel == null) {
      var rankMap = { '正一品': 1, '从一品': 2, '正二品': 3, '从二品': 4, '正三品': 5, '从三品': 6, '正四品': 7, '从四品': 8, '正五品': 9, '从五品': 10, '正六品': 11, '正七品': 13 };
      c.rankLevel = 18;
      var title = (c.officialTitle || '') + (c.title || '');
      Object.keys(rankMap).forEach(function(r) { if (title.indexOf(r) >= 0) c.rankLevel = rankMap[r]; });
      if (c.isPlayer) c.rankLevel = 0;
    }
    // 八才补齐
    if (c.military == null) c.military = Math.max(20, Math.min(95, (c.valor || 50) * 0.6 + (c.intelligence || 50) * 0.4 - 5));
    if (c.charisma == null) c.charisma = Math.max(20, Math.min(95, (c.benevolence || 50) * 0.5 + (c.intelligence || 50) * 0.3 + (c.ambition || 50) * 0.2));
    if (c.diplomacy == null) c.diplomacy = Math.max(20, Math.min(95, (c.intelligence || 50) * 0.5 + (c.charisma || 50) * 0.5 - 10));
    ['military', 'charisma', 'diplomacy'].forEach(function(k) { c[k] = Math.round(c[k]); });
    // traits ↔ traitIds
    if (Array.isArray(c.traits) && !Array.isArray(c.traitIds)) c.traitIds = c.traits.slice();
    if (Array.isArray(c.traitIds) && !Array.isArray(c.traits)) c.traits = c.traitIds.slice();
    // resources.privateWealth.cash → .money
    if (c.resources && c.resources.privateWealth) {
      var pw = c.resources.privateWealth;
      if (pw.cash != null && pw.money == null) { pw.money = pw.cash; delete pw.cash; }
      if (pw.money == null) pw.money = 0;
      if (pw.grain == null) pw.grain = 0;
      if (pw.cloth == null) pw.cloth = 0;
    }
    if (!c.resources) c.resources = {};
    if (!c.resources.privateWealth) c.resources.privateWealth = { money: 0, grain: 0, cloth: 0 };
    if (!c.resources.publicPurse) c.resources.publicPurse = { money: 0, grain: 0, cloth: 0 };
    if (c.resources.fame == null) c.resources.fame = 0;
    if (c.resources.health == null) c.resources.health = 80;
    if (c.resources.stress == null) c.resources.stress = 20;
    // stressSources / career / familyMembers 规范
    if (!Array.isArray(c.stressSources)) c.stressSources = [];
    if (!Array.isArray(c.career)) c.career = [];
    if (!Array.isArray(c.familyMembers)) c.familyMembers = [];
    return c;
  }

  function register() {
    if (typeof global.P === 'undefined' || !global.P || !Array.isArray(global.P.scenarios)) {
      setTimeout(register, 200);
      return;
    }
    if (global.P.scenarios.find(function (s) { return s.id === SID; })) return;

    // ═══════════════════════════════════════════════════════════════════
    // § 1. 剧本元信息
    // ═══════════════════════════════════════════════════════════════════
    var scenario = {
      id: SID,
      name: '天启七年·九月——君王初立，权阉当国',
      era: '明末·天启朝尾',
      dynasty: '明',
      role: '明思宗·朱由检',
      tags: ['明末', '天启', '崇祯即位', '魏忠贤', '阉党', '皇帝视角', '官方'],
      active: true,
      background:
        '天启七年八月，熹宗朱由校因落水染疾崩于乾清宫，年二十三，无嗣。信王朱由检以皇弟入继大统，年十七。\n' +
        '时魏忠贤提督东厂、掌司礼监印，九千岁之号响彻天下。其党羽黄立极辅政、崔呈秀总兵政、阎鸣泰督抚疆场，号"五虎、十狗、十孩儿、四十孙"。\n' +
        '东林党自天启四年"移宫案""三案"余波后被清洗殆尽——杨涟、左光斗、魏大中等六君子死于诏狱，高攀龙自沉湖中；硕果仅存者韩爌、钱龙锡、郭允厚、徐光启皆贬居乡里。\n' +
        '辽东袁崇焕于宁远、宁锦两役后因与阉党不合辞官归里；孙承宗督师被罢。关宁防线无主。\n' +
        '后金皇太极继位已一年，整顿八旗、东伐朝鲜定兄弟之盟、谋图关内。察哈尔林丹汗西迁归化，欲与明议和共抗后金。\n' +
        '陕西久旱，民食树皮观音土，殃变之机隐隐；宫中客氏（熹宗乳母）方被新帝逐出——此事已使阉党寒心。\n' +
        '新帝孤身入乾清宫，身边仅信邸旧侍王承恩可倚。处置九千岁，既是君心之初试，亦是国运之大考。',
      opening:
        '乾清宫帷幕尚新，熹宗梓宫停殡未久。\n' +
        '朕即位月余，朝中大半非朕旧识。黄立极、施凤来票拟日以继夜，内阁仿若九千岁外廷；东厂缇骑络绎，凡朕所问，魏忠贤先知之。\n' +
        '昨夜读天启朝诏狱旧档，杨涟"二十四大罪"一折仍触目惊心；左光斗父子骨已寒。\n' +
        '辽东王之臣告急，奏请饷银五十万。户部尚书郭允厚言太仓仅有银二百万，辽饷岁需四百万，半数仰给于加派。\n' +
        '陕西抚按告饥。司礼监却为朕奏上魏忠贤生辰贺仪，请朕加之"上公"号，号令天下立祠。\n' +
        '朕……当先观之，还是即除之？权阉在握，发之则兵变京师；姑息则东林枯骨不瞑，天下正气永沉。\n' +
        '此一年，不，此一月，将定国运。',
      winCond:
        '短期（1 年内）：妥善处置魏忠贤及阉党，不致京师兵变；起用韩爌、孙承宗、袁崇焕等贤能。\n' +
        '中期（3 年内）：辽东防线稳固，关宁锦防线不失；陕北民变控制在局部。\n' +
        '长期（10-17 年）：避免崇祯十七年（1644）之亡国——至少不重蹈原史覆辙。',
      loseCond:
        '① 处置阉党失当引发京师兵变，新帝被逼退位或弑君。\n' +
        '② 辽东山海关陷落。\n' +
        '③ 闯军/大西军攻入京师。\n' +
        '④ 内帑帑廪双绝、朝纲崩坏、党争致宰辅更替频繁失序。',
      refText:
        '【天启末至崇祯初的关键史实，供 AI 严格史实校验参考】\n' +
        '• 天启七年八月朱由校崩，朱由检以皇弟入继。\n' +
        '• 九月客氏出宫；十月阉党崔呈秀首罢。\n' +
        '• 十一月六日，魏忠贤贬凤阳守陵；六日夜闻讯于阜城，自缢死。\n' +
        '• 十二月客氏杖毙浣衣局。\n' +
        '• 崇祯元年（1628）七月袁崇焕召见平台，君臣"五年复辽"之约。\n' +
        '• 崇祯元年陕北王嘉胤、高迎祥起事；二年后金皇太极绕道蒙古破塞；三年袁崇焕下狱磔死。\n' +
        '• 崇祯末年（1644）李自成破京、帝自缢煤山。\n' +
        '【关键角色命运原史】\n' +
        '• 黄立极（阉党首辅）——崇祯元年罢归，卒于家。\n' +
        '• 韩爌（东林老臣）——召还为首辅，崇祯三年致仕。\n' +
        '• 毕自严——崇祯元年升户部尚书，理财八年有功，病卒。\n' +
        '• 袁崇焕——崇祯元年督师蓟辽，二年入援，三年磔于市。\n' +
        '• 孙承宗——崇祯二年再督蓟辽，守拱卫；清兵攻高阳，阖门殉国。\n' +
        '• 毛文龙——崇祯二年被袁崇焕矫诏斩于双岛；旋东江镇变。\n' +
        '• 温体仁——崇祯二年入阁，次年为首辅，结党八年，崇祯十年罢。\n' +
        '• 周延儒——崇祯二年入阁首辅，三年罢；崇祯十四年再首辅，十六年赐死。\n' +
        '• 洪承畴——崇祯十五年松锦之战降清，原史变节。\n' +
        '• 卢象升——崇祯十一年鹿庄之战战死。\n' +
        '• 孙传庭——崇祯十六年潼关战败死。\n' +
        '• 徐光启——崇祯二年礼部尚书，六年病卒。\n' +
        '• 魏忠贤——天启七年冬自缢；阉党次第追究。\n' +
        '• 崔呈秀——天启七年罢，自缢。\n' +
        '• 李自成——崇祯二年银川驿革驿而起事；崇祯十七年破京。\n' +
        '• 张献忠——崇祯三年米脂十八寨起事；崇祯十六年据武昌建大西。\n' +
        '• 周皇后——崇祯十七年三月自缢殉国。',
      customPrompt:
        '本剧本严格以天启末崇祯初历史为依据。AI 推演应反映：\n' +
        '① 阉党倾覆的仓促与必然；\n' +
        '② 东林党复起后内部浙党楚党齐党之间的新党争；\n' +
        '③ 小冰河期（1580-1680）对北方农业的持续打击；\n' +
        '④ 后金（1636 改号清）对明的战略包围；\n' +
        '⑤ 财政——辽饷、剿饷、练饷三饷加派的恶性循环；\n' +
        '⑥ 宗室禄米对内帑的致命拖累（万历末年宗室逾二十万，禄米岁需六百万石以上）；\n' +
        '⑦ 江南工商税抵制与北方田赋负担失衡；\n' +
        '⑧ 辽东军头（毛文龙/祖大寿/吴三桂父子）的独立化倾向。\n' +
        '玩家为新帝朱由检，AI 不应替玩家决策阉党处置、边臣任免、加派起征、加赋免赋等"帝王心术"事务——须通过奏疏/朝议/问对/诏令让玩家自行裁决。',
      scnStyle: '编年体',
      scnStyleRule: '仿《明实录》编年体：以月为纲，起居注为目。记君臣应对如实。',
      masterScript: '',
      refFiles: [],

      // ──── 朝代状态（影响七大核心初值的自然推导） ────
      // 明末天启七年：政治分裂严重（阉党专权）/ 中央对边镇控制弱化 / 经济崩坏 / 文化心学鼎盛 / 军事专业化低 / 王朝末期
      eraState: {
        politicalUnity: 0.35,         // 政治统一度：阉党虽专权但东林仍在野掣肘
        centralControl: 0.45,         // 中央对地方控制：辽东/陕西渐脱节
        legitimacySource: 'hereditary', // 合法性：血统继承
        socialStability: 0.30,        // 社会稳定：北方饥民渐起
        economicProsperity: 0.35,     // 经济繁荣：北衰南盛
        culturalVibrancy: 0.75,       // 文化活跃：晚明文学/心学/西学井喷
        bureaucracyStrength: 0.40,    // 官僚体系：阉党把持+贪腐极重，效能低下
        militaryProfessionalism: 0.35, // 军事专业化：九边军户虚额严重
        landSystemType: 'mixed',      // 田制：私田 + 官田 + 皇庄 + 藩田 混合
        dynastyPhase: 'decline',      // 王朝阶段：由盛转衰/末路前夜
        contextDescription: '万历怠政、天启阉祸之后，崇祯即位。表面完整的大明帝国已是危房：北有后金虎视，西北有饥民啸聚，江南有缙绅抵税，朝堂有党争血仇。一代新君承百年积弊。'
      },

      // ──── 时间/年号 ────
      gameSettings: {
        enabledSystems: { items: true, military: true, techTree: false, civicTree: false, events: true, map: true, characters: true, factions: true, classes: true, rules: true, officeTree: true },
        startYear: 1627, startMonth: 9, startDay: 1,
        enableGanzhi: true, enableGanzhiDay: true, enableEraName: true, eraName: '天启',
        eraNames: [
          { name: '天启', startYear: 1621, startMonth: 1, startDay: 1 },
          { name: '崇祯', startYear: 1628, startMonth: 1, startDay: 1 }
        ],
        daysPerTurn: 30, turnDuration: 1, turnUnit: '月'
      },

      // ──── 财政 ────
      fiscalConfig: {
        unit: { money: '两', grain: '石', cloth: '匹' },
        silverToCoin: 1000,
        taxesEnabled: {
          tianfu: true, dingshui: true, caoliang: true, yanlizhuan: true,
          shipaiShui: true, quanShui: true, juanNa: false, qita: true
        },
        customTaxes: [
          { id: 'liaoxiang', name: '辽饷加派', formulaType: 'perMu', rate: 0.009, description: '万历四十六年始征，每亩九厘银；天启朝已翻番' },
          { id: 'mukou', name: '茶马互市', formulaType: 'flat', amount: 120000, description: '陕甘茶马司年入；为边军备马' }
        ],
        centralLocalRules: { preset: 'ming-qiyun-cunliu', mode: 'qiyun_cunliu' },
        floatingCollectionRate: 0.28,
        fixedExpense: {
          salaryMonthlyPerRank: {
            '正一品': 88, '从一品': 72, '正二品': 61, '从二品': 48,
            '正三品': 35, '从三品': 26, '正四品': 24, '从四品': 21,
            '正五品': 16, '从五品': 14, '正六品': 10, '从六品': 8,
            '正七品': 7, '从七品': 6, '正八品': 6, '从八品': 5,
            '正九品': 5, '从九品': 5
          },
          armyMonthlyPay: { money: 1.5, grain: 0.6, cloth: 0.05 },
          // 明末宫廷月支：内廷供奉 + 赏赐 + 妃嫔月银 + 陵寝维护 + 宗禄内殿供。岁支百余万两不为过。
          imperialMonthly: { money: 95000, grain: 18000, cloth: 4500 }
        }
      },

      // ──── 世界观（明末文化/气候/宗教/经济/科技/外交） ────
      worldSettings: {
        culture: '万历末以来，心学（阳明学）与程朱理学并存。江南刻书业兴盛，市民文学（《金瓶梅》《三言二拍》）流行。东林书院讲学之风复炽又遭禁毁。',
        weather: '小冰河期（1580-1680）。华北年均气温较常年低 1.5°C，霜冻频发；陕西、山西、河南连年干旱；淮河黄河水患不断；华南偶有台风。',
        religion: '官方尊儒。佛教（临济/曹洞）、道教（正一/全真）并重。天启末官商多奉佛，市民多信道。西洋天主教（利玛窦以来）入传，徐光启、李之藻等士大夫入教。回回（伊斯兰）在西北、西南大量存在。',
        economy: '银两为本位，铜钱为辅。南北方经济严重失衡——江南（苏松常镇）占天下赋税半数以上。海禁松弛，郑氏海商崛起；日本银、美洲银大量流入。然北方田赋激增，小农破产严重。',
        technology: '造船（福建/广东/浙江海船冠亚洲）、火器（红衣大炮、鸟铳）、农学（《农政全书》徐光启修纂中）、医学（李时珍《本草纲目》已成）、印刷（活字普及）。但科学未能脱儒学独立。',
        diplomacy: '东亚朝贡体系：朝鲜/琉球/安南/暹罗/爪哇等为藩属。北方蒙古察哈尔、科尔沁形同独立；辽东后金为心腹大敌。海上日本闭关、西洋商人渐至马尼拉台湾。'
      },

      // ──── 宫殿系统 ────
      palaceSystem: {
        enabled: true,
        capitalName: '紫禁城',
        capitalDescription: '明永乐十八年（1420）建成。南北长 961 米，东西宽 753 米。外朝三大殿（皇极/中极/建极，清改称太和/中和/保和）+ 内廷三宫（乾清/交泰/坤宁）+ 东西六宫。',
        palaces: [
          { id: 'huangji', name: '皇极殿', type: '外朝·正殿', function: '大朝会·登极·册立·颁诏', description: '外朝三大殿之首，清改称太和殿。仅重大典礼开放。', location: '紫禁城中轴·前', capacity: 2000, subHalls: [], status: '完好', builtYear: 1420, isHistorical: true, level: 1 },
          { id: 'zhongji', name: '中极殿', type: '外朝·中殿', function: '皇帝休憩·召见近臣', description: '皇极殿后，规模稍小。清改中和殿。', location: '紫禁城中轴·中前', capacity: 100, subHalls: [], status: '完好', builtYear: 1420, isHistorical: true, level: 2 },
          { id: 'jianji', name: '建极殿', type: '外朝·后殿', function: '殿试·赐宴', description: '外朝最后一殿。清改保和殿。', location: '紫禁城中轴·中', capacity: 500, subHalls: [], status: '完好', builtYear: 1420, isHistorical: true, level: 2 },
          { id: 'qianqing', name: '乾清宫', type: '内廷·正殿', function: '皇帝日常起居·批阅奏疏·召见重臣', description: '明代帝寝所在。崇祯即位后移此居住理政。', location: '紫禁城中轴·中后', capacity: 50, subHalls: [{ id: 'nuange', name: '暖阁', role: 'main', capacity: 10, occupants: ['朱由检'], rankRestriction: ['皇帝'] }], status: '完好', builtYear: 1420, isHistorical: true, level: 1 },
          { id: 'jiaotai', name: '交泰殿', type: '内廷·中殿', function: '存二十五玺·册封命妇', description: '乾清/坤宁之间。', location: '紫禁城中轴·后中', capacity: 30, subHalls: [], status: '完好', builtYear: 1420, isHistorical: true, level: 3 },
          { id: 'kunning', name: '坤宁宫', type: '内廷·后殿', function: '皇后正寝', description: '周皇后居此。', location: '紫禁城中轴·后', capacity: 30, subHalls: [], status: '完好', builtYear: 1420, isHistorical: true, level: 1, occupants: ['周皇后'] },
          { id: 'cining', name: '慈宁宫', type: '内廷·太后宫', function: '太后/太妃居所', description: '此时张懿安皇后居此。', location: '紫禁城西路', capacity: 80, subHalls: [], status: '完好', builtYear: 1536, isHistorical: true, level: 2, occupants: ['张懿安'] },
          { id: 'wenyuange', name: '文渊阁', type: '外朝·附属', function: '内阁办公·藏书', description: '内阁大学士票拟之地。', location: '紫禁城东路', capacity: 40, subHalls: [], status: '完好', builtYear: 1420, isHistorical: true, level: 2 }
        ]
      },

      // ──── 官制 ────
      officeTree: buildOfficeTree(),

      // ──── 行政区划 ────
      adminHierarchy: buildAdminHierarchy(),

      // ──── 时间轴（重大历史节点参考） ────
      timeline: [
        { turn: 2, date: '天启七年十月', title: '崔呈秀罢', note: '阉党五虎之首首罢官。魏忠贤震恐。', category: '阉党', isHistorical: true },
        { turn: 3, date: '天启七年十一月', title: '魏忠贤贬凤阳守陵', note: '钱嘉徵劾十大罪。魏忠贤贬后于阜城自缢。', category: '阉党', isHistorical: true },
        { turn: 4, date: '天启七年十二月', title: '客氏杖毙', note: '客氏死于浣衣局。阉党清算全面展开。', category: '阉党', isHistorical: true },
        { turn: 5, date: '崇祯元年正月', title: '改元崇祯', note: '年号自天启改崇祯。内阁黄立极去，钱龙锡、李标、刘鸿训、周道登等依次入阁。', category: '政治', isHistorical: true },
        { turn: 11, date: '崇祯元年七月', title: '平台召对', note: '袁崇焕召见于平台，君臣五年复辽之约。授督师蓟辽。', category: '辽东', isHistorical: true },
        { turn: 14, date: '崇祯元年十月', title: '陕北王嘉胤起事', note: '府谷饥民大起。民变时代启。', category: '民变', isHistorical: true },
        { turn: 22, date: '崇祯二年六月', title: '袁崇焕斩毛文龙', note: '双岛矫诏。东江镇次第哗变，刘兴祚等降后金。', category: '辽东', isHistorical: true },
        { turn: 26, date: '崇祯二年十月', title: '己巳之变', note: '皇太极绕蒙古破长城，围京师。袁崇焕入援勤王。', category: '辽东', isHistorical: true },
        { turn: 29, date: '崇祯三年八月', title: '袁崇焕磔死', note: '诏狱论死。关宁军心涣散。', category: '辽东', isHistorical: true },
        { turn: 35, date: '崇祯五年', title: '温体仁入阁', note: '奸相之局开。', category: '政治', isHistorical: true },
        { turn: 68, date: '崇祯十一年', title: '卢象升战死鹿庄', note: '杨嗣昌掣肘。', category: '军事', isHistorical: true },
        { turn: 121, date: '崇祯十五年', title: '松锦之战', note: '洪承畴降清。明九边主力尽丧。', category: '军事', isHistorical: true },
        { turn: 140, date: '崇祯十六年十月', title: '孙传庭战死潼关', note: '陕西总督最后的希望。"传庭死而明亡矣"。', category: '军事', isHistorical: true },
        { turn: 146, date: '崇祯十七年三月', title: '煤山自缢', note: '李自成破京，帝自缢。明亡。', category: '亡国', isHistorical: true }
      ],

      // ──── 规则（条件触发） ────
      rules: [
        { name: '阉党处置失当激兵变', enabled: true, trigger: { type: 'threshold', variable: '阉党权势值', op: '<', value: 30, window: 3 }, effect: { narrative: '魏忠贤党羽闻风，崔呈秀、田尔耕等阉党武将密谋京营兵变。', varChg: { '皇威': -15, '皇权': -10 } } },
        { name: '辽饷积欠过重引哗变', enabled: true, trigger: { type: 'threshold', variable: '辽饷积欠', op: '>', value: 300 }, effect: { narrative: '宁远/锦州戍卒索饷鼓噪。', varChg: { '辽东防线稳固度': -8, '民心': -3 } } },
        { name: '小冰河凛冬引疫', enabled: true, trigger: { type: 'threshold', variable: '小冰河凛冬指数', op: '>', value: 80 }, effect: { narrative: '华北疫气大行。', varChg: { '人口': -200000, '西北灾荒怨气': +10 } } },
        { name: '流民过百万引民变', enabled: true, trigger: { type: 'threshold', variable: '流民数量', op: '>', value: 1500000 }, effect: { narrative: '陕北山西流民啸聚，已成军镇规模。', varChg: { '民心': -8, '党争烈度': +5 } } },
        { name: '国库空虚引弹劾', enabled: true, trigger: { type: 'threshold', variable: '国库资金', op: '<', value: 500000 }, effect: { narrative: '科道合疏弹劾户部尚书无能，实则党争借题。', varChg: { '党争烈度': +5 } } },
        { name: '东林复起引新党争', enabled: true, trigger: { type: 'threshold', variable: '东林党复苏进度', op: '>', value: 60 }, effect: { narrative: '东林骨干重返朝堂，与浙党楚党齐党之间结怨渐深，门户之争迭起。', varChg: { '党争烈度': +8, '全局腐败': -3 } } }
      ],

      // ──── 封臣/藩属 ────
      vassalSystem: {
        vassalRelations: [
          { vassal: '朝鲜', liege: '明朝廷', tributeRate: 0.1, vassalType: '朝贡', loyalty: 70 },
          { vassal: '朝鲜', liege: '后金', tributeRate: 0.15, vassalType: '被迫兄弟盟', loyalty: 20 },
          { vassal: '播州土司', liege: '明朝廷', tributeRate: 0.2, vassalType: '土司', loyalty: 50 },
          { vassal: '科尔沁蒙古', liege: '后金', tributeRate: 0.1, vassalType: '联姻盟友', loyalty: 90 }
        ]
      },

      // ──── 自定义预设（明代特色徭役/兵制） ────
      customPresets: {
        corveeTypes: [
          { id: 'lijia', name: '里甲差役', intensity: 0.8, target: '自耕农', effect: '地方差役/催征', deathRate: 0.01, desc: '十年一轮，一甲十户轮当。' },
          { id: 'jundian', name: '军屯', intensity: 0.6, target: '军户', effect: '屯田自给', deathRate: 0.02, desc: '九边军户耕种卫所土地，饷不足则屯田济之。' },
          { id: 'caojun', name: '漕卒', intensity: 1.0, target: '军户/民夫', effect: '漕运京师', deathRate: 0.03, desc: '岁运四百万石京师，夫役十五万人。' },
          { id: 'yanfu', name: '盐夫', intensity: 0.9, target: '灶户', effect: '煮盐', deathRate: 0.04, desc: '两淮两浙盐场劳役。' },
          { id: 'kuangding', name: '矿丁', intensity: 1.2, target: '矿户', effect: '官采银/铁/铜', deathRate: 0.06, desc: '万历矿税后多已撤，云贵滇川仍存。' },
          { id: 'yingshanyi', name: '营缮役', intensity: 1.5, target: '工匠/流民', effect: '宫室陵寝营造', deathRate: 0.08, desc: '历代皇陵、宫殿营造。成祖永陵、神宗定陵皆此。' }
        ],
        militarySystems: [
          { id: 'weisuo', name: '卫所制', era: '明初至今', desc: '军户世袭。卫（5600 人）-千户所-百户所三级。明中叶后虚化。', active: true },
          { id: 'mubing', name: '募兵制', era: '嘉靖以降', desc: '九边/京营/戚家军/关宁军皆募兵。饷为银米。', active: true },
          { id: 'jiading', name: '家丁制', era: '万历以降', desc: '总兵私募亲兵。战力最强但独立性强。', active: true }
        ]
      },

      // ──── 刚性历史事件（时间固定触发） ────
      rigidHistoryEvents: [
        { id: 'rh_weiSuicide', triggerTurn: 3, name: '魏忠贤自缢阜城', trigger: '阉党权势值 < 50 且 皇威 > 50', historical: true, narrative: '去凤阳路上，闻钱嘉徵劾章传下，夜宿阜城，闻"歌小曲骂九千岁"，遂自缢。' },
        { id: 'rh_keshiDie', triggerTurn: 4, name: '客氏杖毙', trigger: '魏忠贤已死', historical: true, narrative: '杖毙于浣衣局，尸被分。' }
      ],

      civicTree: [],
      techTree: []
    };

    global.P.scenarios.push(scenario);

    // ═══════════════════════════════════════════════════════════════════
    // § 2. 人物——46 位
    // ═══════════════════════════════════════════════════════════════════
    var chars = buildCharacters().map(_normalizeChar);
    chars.forEach(function (c) { c.sid = SID; c.id = _uid('char_'); global.P.characters.push(c); });

    // ═══════════════════════════════════════════════════════════════════
    // § 3. 势力
    // ═══════════════════════════════════════════════════════════════════
    var facs = [
      { name: '明朝廷', leader: '朱由检', color: '#c9a84c', strength: 70, militaryStrength: 62, economy: 55, territory: '两京十三省+辽东都司+贵州土司', ideology: '礼法·儒教·天下共主', desc: '大明享国二百六十年。神宗怠政后，政局每况愈下。熹宗末年阉党专擅，士林溃散。新帝立，国本未定。', traits: ['儒教', '天朝', '大一统'] },
      { name: '后金', leader: '皇太极', color: '#6a4c93', strength: 58, militaryStrength: 72, economy: 32, territory: '辽东沈阳·赫图阿拉·辽西诸卫', ideology: '萨满·汗权·八旗', desc: '努尔哈赤称汗于天命元年（1616）。皇太极继位改革政制，结纳蒙汉，将成大患。', traits: ['八旗劲旅', '渔猎游牧', '多民族'] },
      { name: '察哈尔', leader: '林丹汗', color: '#8b4513', strength: 30, militaryStrength: 40, economy: 18, territory: '漠南蒙古·归化城', ideology: '藏传佛教·蒙古正统', desc: '元裔。名义漠南蒙古共主。屡败于后金，西迁归化。欲与明结盟共抗后金。', traits: ['骑射', '游牧'] },
      { name: '朝鲜', leader: '仁祖·李倧', color: '#4a7c2c', strength: 28, militaryStrength: 20, economy: 30, territory: '朝鲜八道', ideology: '儒教·事大', desc: '光海君被废（1623），仁祖反正立国。天启七年春被后金所伐，定江都兄弟盟。明之东藩。', traits: ['事大至诚', '衰弱'] },
      { name: '播州土司·杨氏', leader: '杨朝栋', color: '#9c6633', strength: 8, militaryStrength: 12, economy: 5, territory: '贵州遵义·播州', ideology: '土司自治', desc: '万历二十八年播州之役后，杨氏后裔仅存，然西南土司网络犹在。', traits: ['山地', '土司'] },
      { name: '郑氏海商', leader: '郑芝龙', color: '#2a6f9c', strength: 18, militaryStrength: 26, economy: 42, territory: '福建沿海·台湾海峡', ideology: '海权·商贸', desc: '海商兼海盗。1624 年助荷兰人据台湾。1628 年将受明招抚为游击。日后东亚海上霸主。', traits: ['海军强盛', '商人集团', '海盗转正'] },
      { name: '陕北饥民', leader: '王嘉胤', color: '#7a4e3b', strength: 6, militaryStrength: 4, economy: 1, territory: '陕西延安府·榆林', ideology: '求活·均田免赋（后发展）', desc: '连年大旱，赋重饷严，逃兵饥民聚啸成伙。今秋尚未成势，一二年内将燎原。', traits: ['饥民', '逃兵'] }
    ];
    facs.forEach(function (f) { f.sid = SID; f.id = _uid('fac_'); global.P.factions.push(f); });

    // ═══════════════════════════════════════════════════════════════════
    // § 4. 党派
    // ═══════════════════════════════════════════════════════════════════
    var parties = [
      { name: '阉党', desc: '魏忠贤党羽集团。崔呈秀为"五虎"文官，田尔耕、许显纯为"五彪"武官。占据内阁、六部、都察院。', influence: 85, satisfaction: 60, leader: '魏忠贤', ideology: '阉寺弄权·排除异己·罗织罪名' },
      { name: '东林党', desc: '无锡东林书院讲学起家。主清议、重吏治、反矿税、抑宦官。天启朝被阉党诏狱几尽。', influence: 15, satisfaction: 20, leader: '韩爌', ideology: '正心诚意·清君侧·顾宪成"讽议朝政"遗风' },
      { name: '浙党', desc: '浙江籍京官为核心的同乡派系。万历末与东林党抗衡。天启朝附阉党者多。', influence: 35, satisfaction: 50, leader: '施凤来', ideology: '同乡互助·中央维稳' },
      { name: '楚党', desc: '湖广籍官员同乡派系。万历三十年前后称盛。今已分化归入阉党或中立。', influence: 15, satisfaction: 40, leader: '官应震', ideology: '同乡互助' },
      { name: '齐党', desc: '山东籍官员。万历末与东林抗衡之一支。天启朝多附阉党。', influence: 20, satisfaction: 45, leader: '亓诗教(已罢)', ideology: '同乡' },
      { name: '宣党', desc: '宣城（安徽宣州）籍官员，以汤宾尹为首。与东林夙怨。', influence: 10, satisfaction: 40, leader: '汤宾尹(已死)', ideology: '地域' },
      { name: '昆党', desc: '昆山(苏州昆山)籍官员，顾天峻为首。与东林密切（顾宪成为昆山人）但自成一支。', influence: 8, satisfaction: 35, leader: '顾天峻', ideology: '地域' }
    ];
    parties.forEach(function (p) { p.sid = SID; p.id = _uid('pty_'); global.P.parties.push(p); });

    // ═══════════════════════════════════════════════════════════════════
    // § 5. 阶层
    // ═══════════════════════════════════════════════════════════════════
    var classes = [
      { name: '宗室', desc: '朱氏皇族及分封藩王。万历末在籍逾 20 万，岁耗宗禄六百万石。福王、潞王、瑞王等亲王富可敌国。', privileges: '封爵·俸禄·不服役·不纳税·不科举', restrictions: '不得干政·不许出封地', population: '约 25 万', influence: 40, satisfaction: 58 },
      { name: '士大夫', desc: '科举出身的读书人与官吏。儒学正统承载者。分为京官/外官/翰林/地方学官。', privileges: '免徭役·免杂税·特典·科举续命', restrictions: '须遵儒礼', population: '约 50 万', influence: 88, satisfaction: 32 },
      { name: '缙绅', desc: '地方乡绅。退休官员/举人/监生。土地所有者，包揽赋税，掌控乡村。明末兼并日益严重。', privileges: '免徭役·包揽赋税·操纵里甲·免科', restrictions: '须遵礼法', population: '约 300 万', influence: 72, satisfaction: 62 },
      { name: '自耕农', desc: '拥有小块土地的农户。赋役最重，最易破产。占总人口半数但土地份额仅三分之一。', privileges: '编户齐民', restrictions: '田赋·徭役·丁银·加派', population: '约 3000 万', influence: 25, satisfaction: 28 },
      { name: '佃农与流民', desc: '无地租种、或失地流亡。小冰河期与辽饷加派下急速膨胀。将成民变主力。', privileges: '无', restrictions: '受缙绅盘剥·无籍可查', population: '约 5000 万', influence: 10, satisfaction: 10 },
      { name: '商人', desc: '徽商/晋商/江南牙行。盐商巨富。徽商"挟盐策以走郡国"。晋商控九边茶马。', privileges: '实际巨富但社会地位低', restrictions: '四民末流·子弟科举被歧视·商税重', population: '约 500 万', influence: 55, satisfaction: 48 },
      { name: '工匠', desc: '官匠（匠户）+ 民匠。织造局、军器局、宫廷营造。明中叶匠户改为"班匠银"折纳。', privileges: '官匠免徭', restrictions: '匠籍世袭·受工部/内府调遣', population: '约 400 万', influence: 15, satisfaction: 35 },
      { name: '军户', desc: '军籍世袭。九边戍卒、京营、卫所守备。明初 280 万军户，至天启虚报虚额过半。', privileges: '世袭卫所田', restrictions: '军籍不能脱·应世世当兵·无饷即逃', population: '约 200 万', influence: 30, satisfaction: 22 },
      { name: '僧道·外籍', desc: '佛教僧尼/道士/天主教/回教/西域/日本侨民。僧道不输赋税，朝廷屡禁未果。', privileges: '免徭役免税', restrictions: '须有度牒·不得与世俗争利', population: '约 50 万', influence: 18, satisfaction: 55 }
    ];
    classes.forEach(function (c) { c.sid = SID; c.id = _uid('cls_'); global.P.classes.push(c); });

    // ═══════════════════════════════════════════════════════════════════
    // § 6. 变量
    // ═══════════════════════════════════════════════════════════════════
    // ※ 七大核心变量（帑廪/内帑/皇权/皇威/民心/腐败/环境/人口）由游戏系统自管理：
    //   · 国库资金：由 adminHierarchy 各区划 publicTreasuryInit + 官制 publicTreasuryInit + CascadeTax + FixedExpense 自然聚合
    //   · 皇权/皇威/民心/腐败：由 eraState × CorruptionEngine.initFromDynasty × 朝代预设推出初值
    //   · 人口：由 adminHierarchy 叶子 populationDetail.mouths 自动汇总
    //   · 环境承载力：由 adminHierarchy carryingCapacity 自动汇总
    //   此处 P.variables 只定义本剧本额外的"专题变量"——避免与七大核心重复。
    var variables = [
      // ──── 党派·权阉 ────
      { name: '阉党权势值', value: 92, min: 0, max: 100, cat: '党派', desc: '魏忠贤集团的朝堂支配度。内阁、六部、都察院过半阉党或附阉者。', inversed: true },
      { name: '东林党复苏进度', value: 4, min: 0, max: 100, cat: '党派', desc: '东林骨干多在籍或戍边，归朝尚需圣旨。' },
      { name: '党争烈度', value: 58, min: 0, max: 100, cat: '党派', desc: '阉党打压东林尚未终结。东林反扑将爆发。', inversed: true },
      { name: '宦官干政度', value: 85, min: 0, max: 100, cat: '皇权', desc: '司礼监批红直达天听，内外阁票拟形同虚设。', inversed: true },
      { name: '士人风骨指数', value: 30, min: 0, max: 100, cat: '皇权', desc: '东林六君子诏狱血案后，士林多噤声。' },
      // ──── 财政·专项欠饷 ────
      { name: '辽饷积欠', value: 460, min: 0, max: 1000, unit: '万两', cat: '财政', desc: '辽东欠饷累计。袁崇焕去后更甚。宁远、锦州戍卒哗变警报不断。', inversed: true },
      { name: '九边欠饷总数', value: 720, min: 0, max: 2000, unit: '万两', cat: '财政', desc: '九边（辽东/蓟州/宣府/大同/山西/延绥/宁夏/甘肃/固原）总欠饷。超 1000 万引全面哗变。', inversed: true },
      { name: '宗禄拖欠', value: 280, min: 0, max: 1000, unit: '万石', cat: '财政', desc: '宗室禄米历年拖欠。万历末宗室逾 20 万，岁禄理论 600 万石，实际拨发不足一半。', inversed: true },
      { name: '太仓粮实存', value: 130, min: 0, max: 1000, unit: '万石', cat: '财政', desc: '太仓米粮实有。漕运岁运 400 万石，多虚报。京通仓存粮难支半年。', inversed: true },
      { name: '太仓银储量比', value: 11, min: 0, max: 100, cat: '财政', desc: '太仓库银占岁入基准百分比。史实：20%为常态，低于 15% 危机。' },
      // ──── 经济 ────
      { name: '江南商税抵制度', value: 75, min: 0, max: 100, cat: '经济', desc: '江南缙绅对商税/矿税的抵制程度。矿税于 1625 年罢。', inversed: true },
      { name: '海商势力', value: 25, min: 0, max: 100, cat: '经济', desc: '郑芝龙为首的海商集团崛起程度。' },
      { name: '漕运通畅度', value: 58, min: 0, max: 100, cat: '经济', desc: '京杭大运河江南至通州段。淤堵频发。' },
      // ──── 军事 ────
      { name: '辽东防线稳固度', value: 42, min: 0, max: 100, cat: '军事', desc: '袁崇焕去后，辽东经略未定。王之臣老病。关宁锦防线核心未失。' },
      // ──── 民生/环境 ────
      { name: '流民数量', value: 900000, min: 0, max: 50000000, unit: '口', cat: '民生', desc: '北直隶/陕西/山东流民估数。三年连旱将加速。', inversed: true },
      { name: '小冰河凛冬指数', value: 68, min: 0, max: 100, cat: '环境', desc: '1627 冬寒异常。未来三年将更严酷。', inversed: true },
      { name: '西北灾荒怨气', value: 76, min: 0, max: 100, cat: '民生', desc: '陕北已三年大旱，观音土食尽，草根掘尽。民变在即。', inversed: true }
    ];
    variables.forEach(function (v) { v.sid = SID; v.id = _uid('var_'); v.color = '#c9a84c'; v.icon = ''; v.visible = true; global.P.variables.push(v); });

    // ═══════════════════════════════════════════════════════════════════
    // § 7. 关系（NPC ↔ NPC 关系图，走 P.relations）
    // ═══════════════════════════════════════════════════════════════════
    var relations = [
      // 皇帝与身边
      { from: '朱由检', to: '周皇后', type: '夫妻', value: 85, desc: '信邸共患难，情谊深厚。' },
      { from: '朱由检', to: '王承恩', type: '主仆', value: 95, desc: '信邸旧侍，一生倚之。' },
      { from: '朱由检', to: '张懿安', type: '嫂叔', value: 65, desc: '皇嫂，通明大义。' },
      { from: '朱由检', to: '魏忠贤', type: '君臣·敌意', value: -70, desc: '表面隆礼，心已定诛。' },
      // 阉党内部
      { from: '魏忠贤', to: '崔呈秀', type: '义父子', value: 90, desc: '五虎之首。' },
      { from: '魏忠贤', to: '客氏', type: '盟友', value: 85, desc: '内外相依二十年。' },
      { from: '魏忠贤', to: '黄立极', type: '党羽', value: 60, desc: '票拟秉意。' },
      { from: '魏忠贤', to: '田尔耕', type: '党羽·武', value: 80, desc: '锦衣卫爪牙。' },
      { from: '崔呈秀', to: '许显纯', type: '同党', value: 75, desc: '诏狱合谋。' },
      // 东林党内部
      { from: '韩爌', to: '钱龙锡', type: '同道', value: 85, desc: '共历阉祸，相约复兴。' },
      { from: '韩爌', to: '成基命', type: '同道', value: 80, desc: '老成持重。' },
      { from: '徐光启', to: '孙元化', type: '师生', value: 90, desc: '传授西学火器。' },
      { from: '钱龙锡', to: '袁崇焕', type: '同道·举荐', value: 75, desc: '后来钱龙锡将因袁崇焕案连坐。' },
      // 辽东将领
      { from: '袁崇焕', to: '孙承宗', type: '师长', value: 88, desc: '孙督师于宁远一役成就袁崇焕。' },
      { from: '袁崇焕', to: '满桂', type: '同袍·龃龉', value: 15, desc: '宁锦争功已有隙。' },
      { from: '袁崇焕', to: '赵率教', type: '同袍', value: 72, desc: '宁远并肩。' },
      { from: '袁崇焕', to: '毛文龙', type: '同级·不睦', value: -40, desc: '日后酿成斩帅之祸。' },
      { from: '袁崇焕', to: '祖大寿', type: '同袍·部属', value: 80, desc: '祖大寿为袁崇焕所倚重。' },
      { from: '祖大寿', to: '赵率教', type: '同袍', value: 70 },
      { from: '祖大寿', to: '满桂', type: '同袍·微隙', value: 45 },
      // 未来逆雄
      { from: '李自成', to: '高迎祥', type: '舅甥', value: 85, desc: '高迎祥为李自成之舅，日后闯营首领。' },
      { from: '张献忠', to: '王嘉胤', type: '同乡·未识', value: 30, desc: '此时互不相识，将来各为王。' },
      // 后金
      { from: '皇太极', to: '代善', type: '兄弟·礼亲王', value: 60, desc: '四大贝勒之兄。' },
      { from: '皇太极', to: '多尔衮', type: '兄弟·幼弟', value: 70, desc: '努尔哈赤爱子，皇太极倚之。' },
      { from: '皇太极', to: '范文程', type: '君臣·谋主', value: 85, desc: '大明秀才入后金，赞襄机密。' },
      { from: '皇太极', to: '阿敏', type: '堂兄·猜忌', value: 40 },
      { from: '皇太极', to: '莽古尔泰', type: '兄长·猜忌', value: 35 },
      // 妃后
      { from: '周皇后', to: '袁贵妃', type: '妃嫔', value: 60 },
      { from: '张懿安', to: '周皇后', type: '嫂弟妹', value: 80 },
      // 中立
      { from: '毕自严', to: '郭允厚', type: '同僚·理财', value: 70, desc: '皆精度支，然毕更有担当。' },
      { from: '温体仁', to: '周延儒', type: '同榜·将仇', value: 50, desc: '此时尚可，日后同列首辅交恶。' },
      // 朝鲜
      { from: '仁祖李倧', to: '朱由检', type: '藩臣', value: 80, desc: '事大至诚，又苦后金。' }
    ];
    relations.forEach(function (r) { r.sid = SID; r.id = _uid('rel_'); global.P.relations.push(r); });

    // ═══════════════════════════════════════════════════════════════════
    // § 8. 事件（18 条开局/早期触发）
    // ═══════════════════════════════════════════════════════════════════
    var events = buildEvents();
    events.forEach(function (e) { e.sid = SID; e.id = _uid('evt_'); e.triggered = false; e.type = 'scripted'; global.P.events.push(e); });

    console.log('[scenario] 天启七年·九月（v2 扩充版）已注册，sid=' + SID + '，人物' + chars.length + '·势力' + facs.length + '·党派' + parties.length + '·阶层' + classes.length + '·变量' + variables.length + '·关系' + relations.length + '·事件' + events.length);
  }

  // ═══════════════════════════════════════════════════════════════════
  // § 人物构建（46 人）
  // ═══════════════════════════════════════════════════════════════════
  function buildCharacters() {
    return [
      // ──── 皇帝本尊 ────
      {
        name: '朱由检', zi: '', haoName: '',
        title: '明思宗·崇祯帝', officialTitle: '皇帝', role: '皇帝',
        isPlayer: true, isRoyal: true, royalRelation: 'emperor_family', alive: true,
        age: 17, gender: '男', birthYear: 1611, birthplace: '北京·慈庆宫',
        ethnicity: '汉', faith: '儒', culture: '汉', learning: '皇子·经筵',
        appearance: '面目清癯，额高鼻直，目光锐利。十七岁身高已成，然身量偏瘦。',
        diction: '辞令凝重，出语果断，然时有迟疑。',
        personality: '刚烈·多疑·勤政·急切·寡恩·自苦', location: '紫禁城·乾清宫',
        rankLevel: 0,
        loyalty: 100, ambition: 90, intelligence: 76, valor: 50,
        military: 40, administration: 60, management: 58, charisma: 62, diplomacy: 38, benevolence: 48,
        integrity: 82,
        traits: ['ambitious', 'diligent', 'paranoid', 'impatient', 'stubborn', 'wrathful'],
        stance: '中兴之主', faction: '明朝廷', party: '', partyRank: '',
        family: '朱氏·明', familyTier: 'imperial', familyRole: '嗣位之君', clanPrestige: 100,
        mentor: '', hobbies: '读书,书法,骑射,研兵',
        innerThought: '祖宗二百六十年江山，岂能毁于朕手？然九千岁爪牙满朝，朕孤身入此乾清宫——每夜辗转，思杨涟、左光斗在诏狱血骨，思三叔父福王肥居洛阳，思北疆辽卒索饷哗变。朕当以何自处？当以何自作？',
        personalGoal: '中兴大明，重整吏治，扫平虏寇；非我太祖、成祖之业，亦应保祖宗宗庙于不坠。',
        stressSources: ['阉党盘踞内外', '辽东军饷告急', '陕西饥民将起', '兄嫂未育血脉', '朕年少无根基'],
        resources: { privateWealth: { money: 0, grain: 0, cloth: 0 }, publicPurse: { money: 0, grain: 0, cloth: 0 }, fame: 72, virtueMerit: 15, health: 78, stress: 62 },
        career: [
          { year: 1622, title: '信王', note: '天启二年五岁封信王。' },
          { year: 1627, title: '皇帝', note: '天启七年八月即位。' }
        ],
        familyMembers: [
          { name: '朱由校', relation: '兄长', note: '明熹宗，天启七年八月崩' },
          { name: '张懿安', relation: '嫂', note: '熹宗皇后' },
          { name: '周皇后', relation: '妻', note: '苏州人，信王妃' },
          { name: '朱常洛', relation: '父(殁)', note: '明光宗，在位一月崩' }
        ],
        _memory: [
          { event: '兄长熹宗落水染疾崩于乾清宫，遗命"来，吾弟当为尧舜"', emotion: '悲', weight: 10, turn: 0 },
          { event: '即位次日，魏忠贤叩首请辞司礼监，朕温言慰留——实则观其党心', emotion: '惧', weight: 8, turn: 0 },
          { event: '读天启朝诏狱旧档，杨涟二十四罪疏血泪俱下', emotion: '怒', weight: 9, turn: 0 }
        ],
        bio: '明熹宗朱由校之弟，封信王，就藩未果。天启七年八月即位，刚烈而猜忌，急于有为。原史在位十七年，励精图治而多疑寡恩，十七年中换辅臣五十人、尚书侍郎百余人。终亡国自缢于煤山寿皇亭古槐。'
      },
      // ──── 后妃 ────
      {
        name: '周皇后', title: '皇后', officialTitle: '皇后', isRoyal: true, royalRelation: 'emperor_family', alive: true,
        age: 16, gender: '女', personality: '贤淑·节俭·有胆识', spouse: '朱由检', location: '坤宁宫',
        loyalty: 100, ambition: 20, intelligence: 72, benevolence: 85, morale: 75, integrity: 90,
        stance: '贤后', faction: '明朝廷', party: '', family: '周氏',
        traits: ['chaste', 'humble', 'compassionate', 'diligent'],
        _memory: [ { event: '自苏州寒门入信王府，十五岁册信王妃；朱由检即位，册立为皇后', emotion: '敬', weight: 9, turn: 0 } ],
        bio: '苏州人，出身寒微。贤明节俭，与崇祯同甘共苦。原史崇祯十七年三月自缢殉国。'
      },
      {
        name: '张懿安', title: '懿安皇后·皇嫂', officialTitle: '懿安皇后', isRoyal: true, royalRelation: 'former_empress', alive: true,
        age: 22, gender: '女', personality: '端庄·刚正·反阉', spouse: '朱由校(殁)', location: '慈宁宫',
        loyalty: 90, ambition: 30, intelligence: 80, benevolence: 80, morale: 65, integrity: 95,
        stance: '清流', faction: '明朝廷', party: '东林党', family: '张氏',
        traits: ['just', 'honest', 'stubborn', 'compassionate'],
        _memory: [ { event: '熹宗在世时屡劝除客氏魏忠贤；客氏诬后流产怀仇', emotion: '恨', weight: 9, turn: 0 } ],
        bio: '熹宗皇后。河南祥符人。素恶魏忠贤与客氏，多次劝熹宗除阉。新帝即位，可咨其计。原史活至崇祯十七年，京师陷落时自缢。'
      },
      {
        name: '袁贵妃', title: '贵妃', officialTitle: '贵妃', isRoyal: true, royalRelation: 'emperor_family', alive: true,
        age: 18, gender: '女', personality: '温顺·识字·体弱', spouse: '朱由检', location: '东六宫',
        loyalty: 85, ambition: 15, intelligence: 65, benevolence: 75, integrity: 80,
        stance: '内廷', faction: '明朝廷', party: '', family: '袁氏',
        traits: ['shy', 'temperate'],
        bio: '天启末信王府选侍，新帝即位册贵妃。'
      },
      {
        name: '李选侍', title: '选侍·万历遗妃', officialTitle: '先朝选侍', isRoyal: true, royalRelation: 'former_consort', alive: true,
        age: 48, gender: '女', personality: '贪利·好权·已败', location: '哕鸾宫',
        loyalty: 40, ambition: 55, intelligence: 65, integrity: 30,
        stance: '失势', faction: '明朝廷', party: '', family: '李氏',
        bio: '万历末年选侍。与光宗有子。移宫案中被东林党逼出乾清宫。'
      },
      // ──── 阉党核心 ────
      {
        name: '魏忠贤', zi: '', haoName: '九千岁',
        title: '司礼监掌印·东厂提督·上公', officialTitle: '司礼监掌印太监·提督东厂',
        role: '内廷首宦',
        alive: true, age: 59, gender: '男', birthYear: 1568, birthplace: '北直隶·肃宁',
        ethnicity: '汉', faith: '民间/自立生祠', culture: '汉',
        learning: '白身·不识字', diction: '粗豪直率，然善察言观色',
        appearance: '身材短小，面白无须（阉人），瞳仁昏黄。常朝常戴珠冠。',
        personality: '阴狠·贪权·好谄·睚眦必报·精于笼络',
        location: '紫禁城·司礼监',
        rankLevel: 7, // 正四品(阉官)但实权远超
        loyalty: 10, ambition: 98, intelligence: 72, valor: 40,
        military: 55, administration: 55, management: 85, charisma: 62, diplomacy: 45, benevolence: 5,
        integrity: 3,
        traits: ['deceitful', 'ambitious', 'callous', 'vengeful', 'gregarious', 'paranoid', 'arbitrary', 'greedy'],
        stance: '权阉·篡权之渐', faction: '明朝廷', party: '阉党', partyRank: '首领·上公',
        family: '魏氏(义子义孙满朝)', familyTier: 'common', familyRole: '进内充饷',
        clanPrestige: 25,
        mentor: '王安(殁)·早年恩主', superior: '(实际无上司)',
        hobbies: '斗鸡,走狗,蹴鞠,观戏,诵佛',
        innerThought: '客氏已出宫，是天变之前兆。杨涟六君子之骨犹在诏狱未冷，那个"杀尽东林党"的九千岁之名，日后将是朕之索命符。急流勇退乎？然九千岁岂有余地？或可献贵重礼宝以探帝意；或可借周道登、施凤来为盾。然朕最忧者，是朝中竟无一可托之人。义子义孙虽众，仓卒之变能恃者几？',
        personalGoal: '延续阉党之局，身后亦不许清算。',
        stressSources: ['新帝年少而刚猜', '客氏被逐', '东林党人将归', '田尔耕提督京营心思不齐', '地方督抚纷传异动'],
        resources: { privateWealth: { money: 4500000, grain: 50000, cloth: 30000 }, publicPurse: { money: 3000000, grain: 100000, cloth: 50000 }, fame: -50, virtueMerit: -80, health: 68, stress: 92 },
        career: [
          { year: 1589, title: '入宫充饷', note: '二十一岁因赌博欠债入宫。' },
          { year: 1605, title: '入内膳监', note: '与魏朝对食客氏，得王安赏识。' },
          { year: 1620, title: '司礼监秉笔', note: '光宗泰昌元年熹宗即位后逐王安，秉笔太监。' },
          { year: 1623, title: '司礼监掌印·提督东厂', note: '罢王安，掌印握权。' },
          { year: 1625, title: '上公', note: '赐"顾命元臣"印，立生祠始于浙江。' },
          { year: 1627, title: '贬凤阳守陵(原史十一月)', note: '魏自缢于阜城。' }
        ],
        familyMembers: [
          { name: '客氏', relation: '对食', note: '内廷情侣二十年' },
          { name: '崔呈秀', relation: '义子', note: '五虎之首' },
          { name: '田尔耕', relation: '义子', note: '五彪之首·锦衣卫' },
          { name: '许显纯', relation: '义子', note: '北镇抚司·诛东林' },
          { name: '魏良卿', relation: '侄', note: '封宁国公' }
        ],
        _memory: [
          { event: '天启三年诱帝魏氏赐姓，号"九千岁"，建生祠遍天下', emotion: '喜', weight: 10, turn: -1800 },
          { event: '天启四年命锦衣卫诛杨涟、左光斗于诏狱，尸骨无存', emotion: '快', weight: 9, turn: -1200 },
          { event: '天启六年浙江潘汝桢首建生祠，天下响应二十五处', emotion: '傲', weight: 8, turn: -300 },
          { event: '天启七年七月熹宗薨，信王入继——心知大变', emotion: '惧', weight: 10, turn: -30 },
          { event: '新帝即位数日，客氏被逐出宫', emotion: '恐', weight: 10, turn: 0 }
        ],
        bio: '直隶肃宁人。少无赖，赌博欠债自阉入宫充饷。历二十五年攀附魏朝、王安、客氏而起。天启三年（1623）罢王安掌司礼监，兼提督东厂。以恢复矿税、诛杀东林党称"九千岁"，义子义孙遍六部。所积金帛据崇祯朝清算达数百万两。原史天启七年十一月六日贬凤阳守陵途中，夜宿阜城旅店，闻邻房乡人歌小曲骂"九千岁"，遂于当夜自缢。'
      },
      {
        name: '客氏', title: '奉圣夫人·前熹宗乳母', officialTitle: '奉圣夫人', alive: true,
        age: 37, gender: '女', personality: '恶毒·放荡·贪酷', location: '出宫暂居私第',
        loyalty: 20, ambition: 60, intelligence: 55, benevolence: 5, integrity: 5,
        stance: '失势', faction: '明朝廷', party: '阉党', family: '客氏',
        traits: ['deceitful', 'sadistic', 'lustful', 'vengeful'],
        _memory: [ { event: '即位数日被新帝遣出宫，居私第未被杖毙', emotion: '恐', weight: 10, turn: 0 } ],
        bio: '熹宗乳母。与魏忠贤"对食"（内廷情侣）。内廷多少宫人宫婢死于其手。原史崇祯元年初即被追究杖毙。'
      },
      {
        name: '崔呈秀', title: '兵部尚书·总督京营戎政', officialTitle: '兵部尚书·总督京营戎政', alive: true,
        age: 45, gender: '男', personality: '阴鸷·党附·贪墨', location: '京师', party: '阉党',
        loyalty: 20, ambition: 85, intelligence: 68, valor: 45, benevolence: 10,
        administration: 58, integrity: 10,
        stance: '阉党鹰犬', faction: '明朝廷', family: '崔氏',
        traits: ['deceitful', 'ambitious', 'greedy', 'callous'],
        resources: { privateWealth: { cash: 800000, grain: 10000, cloth: 5000 } },
        bio: '蓟州人。万历四十一年进士。魏忠贤义子，为阉党"五虎"之首。原史天启七年十月罢官，十一月自缢。'
      },
      {
        name: '田尔耕', title: '锦衣卫指挥使·左都督', officialTitle: '锦衣卫指挥使', alive: true,
        age: 48, gender: '男', personality: '残忍·狡黠·巴结', location: '锦衣卫·北镇抚司',
        loyalty: 15, ambition: 70, intelligence: 60, valor: 55, benevolence: 5, integrity: 8,
        stance: '阉党五彪·武官', faction: '明朝廷', party: '阉党', family: '田氏',
        traits: ['deceitful', 'sadistic', 'callous'],
        bio: '世袭锦衣卫官，阉党"五彪"之首。天启中掌诏狱，诛东林无数。原史崇祯元年伏法。'
      },
      {
        name: '许显纯', title: '锦衣卫北镇抚使', officialTitle: '锦衣卫北镇抚使', alive: true,
        age: 52, gender: '男', personality: '酷烈·阴险·擅刑', location: '北镇抚司诏狱',
        loyalty: 10, ambition: 50, intelligence: 58, integrity: 5,
        stance: '阉党五彪', faction: '明朝廷', party: '阉党', family: '许氏',
        traits: ['sadistic', 'callous', 'deceitful'],
        bio: '辽东定辽人，武进士。阉党五彪之一。天启四年手刃杨涟、左光斗、袁化中、魏大中、顾大章、周朝瑞于诏狱。原史崇祯元年弃市。'
      },
      {
        name: '黄立极', title: '内阁首辅·建极殿大学士', officialTitle: '内阁首辅·建极殿大学士', alive: true,
        age: 59, gender: '男', personality: '谨小·附势·无骨',
        location: '京师·文渊阁', loyalty: 30, ambition: 40, intelligence: 65, benevolence: 40,
        administration: 55, integrity: 20,
        stance: '阉党文臣', faction: '明朝廷', party: '阉党', family: '黄氏',
        traits: ['shy', 'deceitful', 'content'],
        bio: '河南元氏人。万历三十二年进士。天启六年入阁。票拟多秉魏忠贤意。原史崇祯元年罢归。'
      },
      {
        name: '施凤来', title: '文华殿大学士', officialTitle: '文华殿大学士', alive: true,
        age: 63, gender: '男', personality: '圆滑·附势·工诗', party: '阉党',
        loyalty: 35, ambition: 35, intelligence: 62, integrity: 25,
        stance: '阉党文臣', faction: '明朝廷', family: '施氏', location: '京师',
        traits: ['deceitful', 'gregarious'],
        bio: '浙江平湖人。万历三十五年进士。天启六年入阁。阉党"外相"之一。'
      },
      {
        name: '冯铨', title: '武英殿大学士', officialTitle: '武英殿大学士', alive: true,
        age: 32, gender: '男', personality: '圆滑·多才·奸巧', party: '阉党',
        loyalty: 30, ambition: 70, intelligence: 78, integrity: 15,
        stance: '阉党文臣', faction: '明朝廷', family: '冯氏', location: '京师',
        traits: ['deceitful', 'ambitious', 'lustful'],
        bio: '北直隶涿州人。年少以献媚魏忠贤骤进。原史崇祯元年罢归。清入关后复出仕清。'
      },
      {
        name: '阎鸣泰', title: '辽东经略(前任)·兵部侍郎', officialTitle: '兵部侍郎·原辽东经略', alive: true,
        age: 55, gender: '男', personality: '畏敌·附势·建祠', party: '阉党',
        loyalty: 30, ambition: 45, intelligence: 55, valor: 20, integrity: 20,
        stance: '阉党督抚', faction: '明朝廷', family: '阎氏', location: '京师',
        traits: ['craven', 'deceitful'],
        bio: '山西太原人。阉党督抚。为魏忠贤建生祠 25 处。原史崇祯元年戍边，后戍死。'
      },
      // ──── 东林党/中立老臣 ────
      {
        name: '韩爌', title: '前礼部尚书·东阁大学士（罢归）', officialTitle: '东阁大学士（已罢居乡）', alive: true,
        age: 63, gender: '男', personality: '稳重·公正·老成', location: '山西蒲州',
        loyalty: 85, ambition: 30, intelligence: 80, benevolence: 80,
        administration: 78, integrity: 90,
        stance: '东林老臣', faction: '明朝廷', party: '东林党', family: '韩氏',
        traits: ['honest', 'patient', 'just', 'calm'],
        _memory: [
          { event: '天启四年杨涟、左光斗等六君子死于诏狱；遭阉党构陷罢归乡', emotion: '恨', weight: 10, turn: -1100 },
          { event: '蒲州闻帝崩新帝立，沉吟未发', emotion: '疑', weight: 7, turn: 0 }
        ],
        bio: '山西蒲州人。万历二十年进士。万历末入阁，天启四年被阉党构陷罢归。原史崇祯元年召还为首辅，三年致仕。'
      },
      {
        name: '钱龙锡', title: '前礼部右侍郎（罢归）', officialTitle: '礼部右侍郎（已罢）', alive: true,
        age: 48, gender: '男', personality: '清俊·持正·稍弱', location: '南直隶华亭',
        loyalty: 80, ambition: 35, intelligence: 75, integrity: 82,
        stance: '东林', faction: '明朝廷', party: '东林党', family: '钱氏',
        traits: ['honest', 'just', 'shy'],
        bio: '松江华亭人。万历三十五年进士。东林干将，天启五年被贬。原史崇祯元年入阁。三年因袁崇焕案连坐遣戍。'
      },
      {
        name: '成基命', title: '礼部右侍郎（罢归）', officialTitle: '礼部右侍郎（已罢）', alive: true,
        age: 67, gender: '男', personality: '敦厚·公忠·沉稳', location: '河南大名',
        loyalty: 85, ambition: 25, intelligence: 72, integrity: 88,
        stance: '东林老成', faction: '明朝廷', party: '东林党', family: '成氏',
        traits: ['honest', 'patient', 'humble'],
        bio: '河南大名人。万历三十五年进士。东林之老成者。原史崇祯二年入阁。'
      },
      {
        name: '刘鸿训', title: '礼部右侍郎·告归', officialTitle: '礼部右侍郎（已罢）', alive: true,
        age: 62, gender: '男', personality: '才敏·急直·刚骨', location: '山东长山',
        loyalty: 82, ambition: 45, intelligence: 82, integrity: 78,
        stance: '东林/中立', faction: '明朝廷', party: '东林党', family: '刘氏',
        traits: ['just', 'impatient', 'diligent'],
        bio: '山东长山人。万历四十一年进士。才学出众。原史崇祯元年入阁，二年因加藻饰被崇祯罢戍。'
      },
      {
        name: '李标', title: '礼部右侍郎', officialTitle: '礼部右侍郎', alive: true,
        age: 61, gender: '男', personality: '清正·谨厚', location: '京师',
        loyalty: 80, ambition: 30, intelligence: 72, integrity: 85,
        stance: '中立', faction: '明朝廷', party: '', family: '李氏',
        traits: ['honest', 'patient'],
        bio: '北直隶高邑人。万历三十五年进士。原史崇祯元年入阁。'
      },
      {
        name: '郭允厚', title: '户部尚书', officialTitle: '户部尚书', alive: true,
        age: 55, gender: '男', personality: '精明·刻板·理财', location: '京师',
        loyalty: 70, ambition: 40, intelligence: 82, administration: 85, integrity: 75,
        stance: '中立理财', faction: '明朝廷', party: '', family: '郭氏',
        traits: ['diligent', 'patient', 'stubborn'],
        bio: '山东福山人。万历二十六年进士。管钱粮八年，心力交瘁。原史崇祯元年罢。'
      },
      {
        name: '毕自严', title: '南京户部尚书', officialTitle: '南京户部尚书', alive: true,
        age: 58, gender: '男', personality: '忠谨·明练·善理财', location: '南京',
        loyalty: 85, ambition: 40, intelligence: 85, administration: 88, integrity: 88,
        stance: '能吏', faction: '明朝廷', party: '', family: '毕氏',
        traits: ['honest', 'diligent', 'just'],
        _memory: [ { event: '理南京户部数年，熟南漕北运，眼见天下财计日蹙', emotion: '忧', weight: 8, turn: -300 } ],
        bio: '山东淄川人。万历二十年进士。善度支。原史崇祯元年召入掌户部，支撑危局八年，病卒任上。'
      },
      {
        name: '王在晋', title: '南京兵部尚书', officialTitle: '南京兵部尚书', alive: true,
        age: 62, gender: '男', personality: '谨慎·保守·稳妥', location: '南京',
        loyalty: 75, ambition: 40, intelligence: 70, administration: 72, integrity: 75,
        stance: '主守派', faction: '明朝廷', party: '', family: '王氏',
        traits: ['craven', 'patient'],
        bio: '江苏太仓人。万历二十年进士。主张"弃宁锦守山海"——与孙承宗主战派不合。'
      },
      {
        name: '徐光启', title: '前礼部左侍郎·告归', officialTitle: '礼部左侍郎（告归养病）', alive: true,
        age: 65, gender: '男', personality: '博学·通实·西学·诚笃', location: '上海',
        loyalty: 88, ambition: 35, intelligence: 92, benevolence: 80,
        administration: 78, management: 75, learning: 95, integrity: 90,
        stance: '东林实学', faction: '明朝廷', party: '东林党', family: '徐氏',
        traits: ['honest', 'diligent', 'patient', 'humble'],
        _memory: [ { event: '受洗入天主教，与利玛窦合作译《几何原本》', emotion: '喜', weight: 9, turn: -7000 } ],
        bio: '松江上海人。万历三十二年进士。天主教徒。与利玛窦译《几何原本》《农政全书》。精通西学火器历法。原史崇祯元年礼部尚书，五年入阁，六年病卒。'
      },
      // ──── 将崛起者 ────
      {
        name: '温体仁', title: '礼部侍郎', officialTitle: '礼部侍郎', alive: true,
        age: 54, gender: '男', personality: '阴狡·柔佞·工心术', location: '京师',
        loyalty: 60, ambition: 88, intelligence: 85, integrity: 20,
        stance: '中立·将崛起', faction: '明朝廷', party: '浙党', family: '温氏',
        traits: ['deceitful', 'ambitious', 'patient', 'vengeful'],
        bio: '浙江乌程人。万历二十六年进士。以柔佞得崇祯宠信。原史崇祯二年入阁，三年首辅，结党八年，十年罢。'
      },
      {
        name: '周延儒', title: '翰林院侍读学士', officialTitle: '翰林院侍读学士', alive: true,
        age: 34, gender: '男', personality: '才俊·骄矜·机变', location: '京师',
        loyalty: 65, ambition: 85, intelligence: 88, integrity: 30,
        stance: '清流·将崛起', faction: '明朝廷', party: '', family: '周氏',
        traits: ['arrogant', 'ambitious', 'deceitful'],
        bio: '南直隶宜兴人。万历四十一年状元。以才名。原史崇祯二年入阁，三年首辅，六年罢；十四年再首辅，十六年赐死。'
      },
      // ──── 辽东/边关将帅 ────
      {
        name: '袁崇焕', title: '前辽东巡抚（闲居）', officialTitle: '辽东巡抚（已丁忧归乡）', alive: true,
        age: 43, gender: '男', personality: '刚烈·自负·有谋·急进', location: '广东东莞',
        loyalty: 82, ambition: 72, intelligence: 82, valor: 78, benevolence: 60,
        administration: 76, management: 75, integrity: 80,
        stance: '主战复辽', faction: '明朝廷', party: '', family: '袁氏',
        traits: ['ambitious', 'brave', 'arrogant', 'impatient', 'stubborn'],
        resources: { privateWealth: { cash: 20000, grain: 5000, cloth: 500 } },
        _memory: [
          { event: '宁远一役，红衣大炮退努尔哈赤，不数月汗死', emotion: '骄', weight: 10, turn: -800 },
          { event: '宁锦战后功不录赏，因与魏忠贤不合愤而告归', emotion: '愤', weight: 9, turn: -200 }
        ],
        bio: '广东东莞人。万历四十七年进士。天启六年宁远大捷。天启七年宁锦战功不录，愤而告归。原史崇祯元年平台召见，五年复辽之约；三年下狱磔死。'
      },
      {
        name: '孙承宗', title: '前辽东督师（闲居）', officialTitle: '辽东督师（已罢归）', alive: true,
        age: 65, gender: '男', personality: '沉稳·老成·谋国', location: '保定高阳',
        loyalty: 95, ambition: 20, intelligence: 88, valor: 72, benevolence: 80,
        administration: 88, management: 82, integrity: 95,
        stance: '主战稳守', faction: '明朝廷', party: '', family: '孙氏',
        traits: ['honest', 'patient', 'calm', 'just'],
        resources: { privateWealth: { cash: 50000, grain: 10000, cloth: 1000 } },
        bio: '北直隶高阳人。万历三十二年进士。天启二年督师蓟辽，筑关宁防线（宁远/锦州/杏山/塔山/松山/大凌河）。被阉党排挤，天启五年罢。原史崇祯二年再督蓟辽；十一年清兵攻高阳，阖门殉国。'
      },
      {
        name: '毛文龙', title: '东江总兵·左都督·太子太保', officialTitle: '左都督·东江总兵', alive: true,
        age: 51, gender: '男', personality: '骄横·能战·跋扈·取巧', location: '皮岛',
        loyalty: 55, ambition: 75, intelligence: 65, valor: 78, benevolence: 35,
        administration: 45, integrity: 30,
        stance: '东江镇军头', faction: '明朝廷', party: '', family: '毛氏',
        traits: ['arrogant', 'ambitious', 'deceitful', 'greedy'],
        resources: { privateWealth: { cash: 300000, grain: 50000, cloth: 8000 } },
        bio: '浙江仁和人。天启元年袭据镇江，开东江镇于皮岛，屡扰后金后方。跋扈自雄，开销无度。原史崇祯二年被袁崇焕矫诏斩于双岛，旋东江镇次第哗变。'
      },
      {
        name: '满桂', title: '宁远总兵·右都督', officialTitle: '宁远总兵·右都督', alive: true,
        age: 43, gender: '男', personality: '骁勇·暴躁·不识字', location: '宁远',
        loyalty: 80, ambition: 50, intelligence: 55, valor: 88, benevolence: 50, integrity: 70,
        stance: '蒙古裔骁将', faction: '明朝廷', party: '', family: '满氏',
        traits: ['brave', 'wrathful', 'stubborn'],
        bio: '蒙古人。行伍出身。宁远大战与袁崇焕同守城。与袁崇焕争功有隙。原史崇祯二年己巳之变战死永定门外。'
      },
      {
        name: '赵率教', title: '山海关总兵·左都督', officialTitle: '山海关总兵·左都督', alive: true,
        age: 58, gender: '男', personality: '勇毅·重义·沉练', location: '山海关',
        loyalty: 88, ambition: 40, intelligence: 65, valor: 82, benevolence: 68, integrity: 80,
        stance: '关宁骁将', faction: '明朝廷', party: '', family: '赵氏',
        traits: ['brave', 'honest', 'just'],
        bio: '陕西靖虏卫人。袁崇焕旧部。原史崇祯二年战死遵化。'
      },
      {
        name: '祖大寿', title: '宁远副总兵·后都督', officialTitle: '宁远副总兵', alive: true,
        age: 40, gender: '男', personality: '骁勇·重情·多疑', location: '宁远',
        loyalty: 70, ambition: 55, intelligence: 62, valor: 82, integrity: 58,
        stance: '辽东武将世家', faction: '明朝廷', party: '', family: '祖氏·辽东',
        traits: ['brave', 'paranoid', 'stubborn'],
        bio: '辽东宁远人。辽东世将。与袁崇焕关系紧密。原史己巳之变随袁崇焕入卫；袁下狱后率军出走。松锦战后降清。'
      },
      {
        name: '洪承畴', title: '陕西布政使司参政', officialTitle: '陕西参政', alive: true,
        age: 34, gender: '男', personality: '刚毅·多才·阴狠', location: '西安',
        loyalty: 80, ambition: 78, intelligence: 85, valor: 70,
        administration: 82, management: 78, integrity: 65,
        stance: '待崛起', faction: '明朝廷', party: '', family: '洪氏',
        traits: ['ambitious', 'brave', 'patient', 'deceitful'],
        bio: '福建南安人。万历四十四年进士。原史崇祯二年迁延绥巡抚剿陕北民变，崛起为三边总督、蓟辽总督。十五年松锦战败降清。'
      },
      {
        name: '卢象升', title: '大名府知府', officialTitle: '大名知府', alive: true,
        age: 27, gender: '男', personality: '刚烈·勇武·书生儒将', location: '大名府',
        loyalty: 95, ambition: 50, intelligence: 78, valor: 85,
        administration: 75, integrity: 92,
        stance: '待崛起', faction: '明朝廷', party: '', family: '卢氏',
        traits: ['brave', 'honest', 'diligent', 'zealous'],
        bio: '南直隶宜兴人。天启二年进士。力能引八石弓。原史崇祯二年入卫京师崭露头角，后历任宣大总督、兵部尚书。十一年鹿庄战死。'
      },
      {
        name: '孙传庭', title: '吏部验封司主事', officialTitle: '吏部主事', alive: true,
        age: 34, gender: '男', personality: '沉毅·有谋·刚正', location: '京师',
        loyalty: 90, ambition: 55, intelligence: 82, valor: 72,
        administration: 78, integrity: 88,
        stance: '待崛起', faction: '明朝廷', party: '', family: '孙氏',
        traits: ['stubborn', 'honest', 'brave', 'just'],
        bio: '山西代州人。万历四十七年进士。原史崇祯八年起陕西巡抚，擒高迎祥。十六年潼关战死。"传庭死而明亡矣"。'
      },
      {
        name: '孙元化', title: '兵部职方司主事', officialTitle: '兵部主事', alive: true,
        age: 46, gender: '男', personality: '通西学·善火器·实干', location: '京师',
        loyalty: 85, ambition: 40, intelligence: 88, valor: 62,
        administration: 75, learning: 92, integrity: 85,
        stance: '实学派', faction: '明朝廷', party: '东林党', family: '孙氏',
        traits: ['honest', 'diligent', 'humble'],
        bio: '南直隶嘉定人。徐光启门生。天主教徒。通红衣大炮铸造与操法。原史崇祯三年登莱巡抚，四年孔有德吴桥兵变被杀。'
      },
      // ──── 宦官 ────
      {
        name: '王承恩', title: '内侍太监', officialTitle: '乾清宫近侍', alive: true,
        age: 42, gender: '男', personality: '忠贞·沉稳·识大体', location: '乾清宫',
        loyalty: 100, ambition: 15, intelligence: 68, benevolence: 70, integrity: 95,
        stance: '帝之心腹', faction: '明朝廷', party: '', family: '王氏',
        traits: ['honest', 'diligent', 'humble', 'zealous'],
        bio: '信邸旧侍。朱由检入继大统后倚为耳目。原史崇祯十七年随帝自缢煤山。'
      },
      {
        name: '曹化淳', title: '司礼监秉笔·东厂掌刑', officialTitle: '司礼监秉笔太监', alive: true,
        age: 38, gender: '男', personality: '精明·善迎合·首鼠两端', location: '司礼监',
        loyalty: 55, ambition: 55, intelligence: 75, benevolence: 50, integrity: 40,
        stance: '骑墙宦官', faction: '明朝廷', party: '', family: '曹氏',
        traits: ['deceitful', 'gregarious'],
        bio: '天津武清人。王安旧徒，后归魏忠贤。新帝即位后转倚周后一脉。原史崇祯朝重用。'
      },
      {
        name: '方正化', title: '司礼监秉笔', officialTitle: '司礼监秉笔太监', alive: true,
        age: 45, gender: '男', personality: '刚直·能战·不苟', location: '司礼监',
        loyalty: 90, ambition: 25, intelligence: 65, valor: 78, integrity: 85,
        stance: '忠宦', faction: '明朝廷', party: '', family: '方氏',
        traits: ['brave', 'honest', 'zealous'],
        bio: '宦官少见武勇者。原史崇祯十七年监军保定，城破搏斗而死。'
      },
      // ──── 后金 ────
      {
        name: '皇太极', title: '后金天聪汗', officialTitle: '后金汗', alive: true,
        age: 35, gender: '男', personality: '深沉·多谋·隐忍·野心', location: '沈阳',
        loyalty: 100, ambition: 98, intelligence: 92, valor: 82, benevolence: 55,
        administration: 85, management: 88, integrity: 70,
        stance: '后金主', faction: '后金', party: '', family: '爱新觉罗',
        traits: ['ambitious', 'patient', 'just', 'calm', 'stubborn'],
        _memory: [
          { event: '天命十一年父汗努尔哈赤崩，与三兄共议继位，终以智谋夺之', emotion: '喜', weight: 10, turn: -400 },
          { event: '天聪元年春伐朝鲜，江都兄弟之盟成', emotion: '喜', weight: 9, turn: -200 }
        ],
        bio: '努尔哈赤第八子。天命十一年（1626）继位。天聪元年（1627）伐朝鲜，定江都盟。原史 1636 改元崇德，国号清。1643 病逝，子福临即位。'
      },
      {
        name: '代善', title: '礼亲王·大贝勒', officialTitle: '礼亲王', alive: true,
        age: 44, gender: '男', personality: '沉稳·谨慎·厚重', location: '沈阳',
        loyalty: 85, ambition: 40, intelligence: 72, valor: 85, integrity: 75,
        stance: '后金宗室长兄', faction: '后金', party: '', family: '爱新觉罗',
        traits: ['patient', 'calm', 'honest'],
        bio: '努尔哈赤次子。四大贝勒之首，与皇太极并立。'
      },
      {
        name: '多尔衮', title: '贝勒（此时未封）', officialTitle: '贝勒', alive: true,
        age: 15, gender: '男', personality: '精明·野心·早慧', location: '沈阳',
        loyalty: 80, ambition: 90, intelligence: 88, valor: 75,
        stance: '后金幼弟·潜龙', faction: '后金', party: '', family: '爱新觉罗',
        traits: ['ambitious', 'patient', 'just'],
        bio: '努尔哈赤第十四子。此时十五岁。原史崇德元年封睿亲王，入主中原之元勋，顺治摄政王。'
      },
      {
        name: '阿敏', title: '二大贝勒', officialTitle: '二大贝勒', alive: true,
        age: 41, gender: '男', personality: '骄横·忿激·难制', location: '沈阳',
        loyalty: 50, ambition: 75, intelligence: 65, valor: 82,
        stance: '后金宗室·不睦', faction: '后金', party: '', family: '爱新觉罗',
        traits: ['wrathful', 'arrogant', 'ambitious'],
        bio: '努尔哈赤侄。与皇太极龃龉。原史天聪四年因永平失守被幽禁。'
      },
      {
        name: '范文程', title: '文馆大学士', officialTitle: '文馆大学士', alive: true,
        age: 30, gender: '男', personality: '深谋·老成·识时务', location: '沈阳',
        loyalty: 85, ambition: 55, intelligence: 90, benevolence: 55,
        administration: 85, management: 80, integrity: 70,
        stance: '汉人谋主', faction: '后金', party: '', family: '范氏',
        traits: ['patient', 'just', 'calm'],
        bio: '沈阳降人，秀才出身。天命十年入仕后金。为皇太极赞画军政。后助清入关。原史顺治十三年致仕。'
      },
      // ──── 蒙古 ────
      {
        name: '林丹汗', title: '察哈尔可汗', officialTitle: '蒙古大汗·察哈尔可汗', alive: true,
        age: 35, gender: '男', personality: '骄矜·急躁·黄教狂热', location: '归化城',
        loyalty: 100, ambition: 80, intelligence: 65, valor: 70, benevolence: 40,
        stance: '蒙古共主(名存实亡)', faction: '察哈尔', party: '', family: '孛儿只斤',
        traits: ['arrogant', 'wrathful', 'zealous'],
        bio: '元裔。欲统合漠南蒙古对抗后金。天启七年西迁归化。原史崇祯五年败于皇太极走青海，明年病死。'
      },
      // ──── 朝鲜 ────
      {
        name: '仁祖李倧', title: '朝鲜国王', officialTitle: '朝鲜国王', alive: true,
        age: 32, gender: '男', personality: '怯懦·事大·无奈', location: '汉城',
        loyalty: 80, ambition: 30, intelligence: 60, valor: 40, integrity: 65,
        stance: '明藩·夹缝', faction: '朝鲜', party: '', family: '李氏·朝鲜',
        traits: ['craven', 'honest'],
        bio: '李氏朝鲜第十六代国王。1623 反正废光海君。1627 被后金所伐，被迫定兄弟之盟。原史 1637 丙子胡乱后再被迫兄称后金为君。'
      },
      // ──── 海商 ────
      {
        name: '郑芝龙', title: '海商·前海盗首领', officialTitle: '(将受明招抚为游击)', alive: true,
        age: 23, gender: '男', personality: '机变·豪迈·贪利', location: '福建沿海',
        loyalty: 40, ambition: 85, intelligence: 80, valor: 82,
        administration: 60, integrity: 45,
        stance: '海商·游走', faction: '郑氏海商', party: '', family: '郑氏',
        traits: ['ambitious', 'gregarious', 'brave', 'deceitful'],
        bio: '福建南安人。天启六年据台湾，大战荷兰。原史崇祯元年受招抚为海防游击。日后福建海上霸主，清入关降清。子郑成功复起抗清。'
      },
      // ──── 逆雄（此时未起） ────
      {
        name: '王嘉胤', title: '流民魁首(将起)', officialTitle: '', alive: true,
        age: 42, gender: '男', personality: '豪猛·不学·能聚众', location: '陕西府谷',
        loyalty: 10, ambition: 72, intelligence: 45, valor: 78, benevolence: 50,
        stance: '流民首', faction: '陕北饥民', party: '', family: '王氏',
        traits: ['brave', 'wrathful', 'gregarious'],
        bio: '陕西府谷人。明边军逃兵。原史崇祯元年起事，为陕北民变第一把火；四年被招抚而杀于内讧。'
      },
      {
        name: '高迎祥', title: '贩马贩子', officialTitle: '', alive: true,
        age: 37, gender: '男', personality: '豪勇·粗朴', location: '陕西安塞',
        loyalty: 30, ambition: 60, intelligence: 55, valor: 82,
        stance: '将为闯王', faction: '陕北饥民', party: '', family: '高氏',
        traits: ['brave', 'gregarious'],
        bio: '陕西安塞人。以贩马为业。原史崇祯元年起事自号闯王。九年被孙传庭擒斩。'
      },
      {
        name: '李自成', title: '银川驿驿卒', officialTitle: '驿卒', alive: true,
        age: 21, gender: '男', personality: '沉毅·凶猛·善骑射', location: '甘肃银川驿',
        loyalty: 25, ambition: 75, intelligence: 70, valor: 82, integrity: 50,
        stance: '蛰伏·未起', faction: '陕北饥民', party: '', family: '李氏',
        traits: ['brave', 'patient', 'ambitious'],
        bio: '陕西米脂人。此时二十一岁银川驿驿卒。原史崇祯二年驿站被裁，随众起事。崇祯十七年破京称大顺帝。'
      },
      {
        name: '张献忠', title: '延安卫军卒', officialTitle: '军卒', alive: true,
        age: 21, gender: '男', personality: '狠辣·果决·多疑', location: '陕西米脂',
        loyalty: 20, ambition: 72, intelligence: 62, valor: 85,
        stance: '蛰伏·未起', faction: '陕北饥民', party: '', family: '张氏',
        traits: ['brave', 'wrathful', 'callous'],
        bio: '陕西延安定边人。初为延安府捕快，后在延绥镇为军。原史崇祯三年米脂十八寨起事。十六年据武昌建大西。'
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // § 事件构建
  // ═══════════════════════════════════════════════════════════════════
  function buildEvents() {
    return [
      {
        name: '阉党请加魏忠贤上公号',
        narrative: '黄立极率内阁阉党诸员，联名请加魏忠贤"上公"之号，请陛下旨意天下立生祠、免其跪拜。',
        triggerTurn: 1, oneTime: true, priority: 'urgent',
        choices: [
          { text: '准。(示弱以观其变)', effect: { '皇威': -5, '阉党权势值': +3, '皇权': -2 } },
          { text: '驳。此非臣下所当议。', effect: { '皇威': +3, '阉党权势值': -2, '党争烈度': +3 } },
          { text: '留中不发。', effect: {} }
        ]
      },
      {
        name: '客氏遣出宫外',
        narrative: '熹宗乳母客氏，阉党内援。陛下即位后诏命出宫。此举已令魏忠贤闻风胆寒。',
        triggerTurn: 1, oneTime: true, priority: 'normal',
        choices: [{ text: '诏命已下。', effect: { '皇威': +5, '阉党权势值': -5, '宦官干政度': -4 } }]
      },
      {
        name: '户部告急：辽饷无出',
        narrative: '户部尚书郭允厚奏：太仓现银二百万，辽饷岁需四百万，九边合计岁支八百万。如此缺口，非加派不能补。',
        triggerTurn: 2, oneTime: true, priority: 'urgent',
        choices: [
          { text: '准加派辽饷。(饮鸩止渴)', effect: { '国库资金': +800000, '民心': -5, '流民数量': +100000, '辽饷积欠': -20 } },
          { text: '先发内帑五十万济急。', effect: { '国库资金': +500000, '皇威': +5, '阉党权势值': -2 } },
          { text: '发廷议。令百官各抒己见。', effect: { '党争烈度': +5 } }
        ]
      },
      {
        name: '东江毛文龙请饷十五万',
        narrative: '东江总兵毛文龙奏：皮岛孤悬海外，兵十万需饷。然朝廷查实其兵不过三万。如何处？',
        triggerTurn: 2, oneTime: true, priority: 'normal',
        choices: [
          { text: '如数拨饷。', effect: { '国库资金': -150000, '辽东防线稳固度': +2 } },
          { text: '按实数拨饷五万。', effect: { '国库资金': -50000, '辽东防线稳固度': +1 } },
          { text: '遣科道查实。', effect: { '全局腐败': -3 } }
        ]
      },
      {
        name: '陕西抚按奏饥',
        narrative: '陕西巡抚胡廷宴、三边总督武之望联名奏：陕北延安、榆林三年大旱，民食观音土，饥民逃亡者十万。赈之则无银，不赈则必为盗。',
        triggerTurn: 3, oneTime: true, priority: 'urgent',
        choices: [
          { text: '拨内帑十万赈之。', effect: { '国库资金': -100000, '西北灾荒怨气': -10, '民心': +4 } },
          { text: '免陕西本年田赋。', effect: { '国库资金': -300000, '西北灾荒怨气': -15, '民心': +6 } },
          { text: '令地方自赈。', effect: { '西北灾荒怨气': +8, '流民数量': +200000 } }
        ]
      },
      {
        name: '皇嫂张懿安密进言',
        narrative: '懿安皇后密召于坤宁宫：魏忠贤当速除。若过冬，则其党羽在京营军、在东厂、在各镇皆已定盘，发难必败。',
        triggerTurn: 1, oneTime: true, priority: 'normal',
        choices: [
          { text: '速图之。', effect: { '阉党权势值': -3, '党争烈度': +10 } },
          { text: '姑徐之，观其势。', effect: { '皇权': -2 } }
        ]
      },
      {
        name: '御史钱嘉徵劾魏忠贤十大罪',
        narrative: '贡士钱嘉徵上疏，劾魏忠贤十大罪：并帝、蔑后、弄兵、无二祖列宗、克削藩封、无圣、滥爵、掩边功、朘民、通关节。',
        triggerTurn: 4, oneTime: true, priority: 'urgent',
        choices: [
          { text: '留中不发。', effect: { '党争烈度': +3 } },
          { text: '召魏忠贤面质十罪。', effect: { '皇威': +10, '阉党权势值': -15, '皇权': +5 } },
          { text: '黜钱嘉徵以安魏忠贤。', effect: { '皇威': -10, '党争烈度': -5, '民心': -5 } }
        ]
      },
      {
        name: '皇太极遣使议和',
        narrative: '后金汗皇太极遣方金纳来书：欲约兄弟之国，岁输银帛，互开马市。书中字迹倨傲，称明为"南朝"。',
        triggerTurn: 5, oneTime: true, priority: 'normal',
        choices: [
          { text: '斩使以示天威。', effect: { '皇威': +5, '辽东防线稳固度': -3 } },
          { text: '扣使观望。', effect: {} },
          { text: '许岁币暂缓辽事。', effect: { '国库资金': -200000, '辽东防线稳固度': +5, '皇威': -8 } }
        ]
      },
      // ──── 新增事件 ────
      {
        name: '辽东王之臣告老',
        narrative: '辽东经略王之臣奏：精力不济，乞骸骨归里。关宁无主，急需择人。',
        triggerTurn: 3, oneTime: true, priority: 'urgent',
        choices: [
          { text: '召孙承宗再督。', effect: { '辽东防线稳固度': +10, '皇威': +3 } },
          { text: '召袁崇焕督师。', effect: { '辽东防线稳固度': +8, '党争烈度': +5 } },
          { text: '升王在晋稳守。', effect: { '辽东防线稳固度': -3 } },
          { text: '令王之臣再勉一年。', effect: { '辽东防线稳固度': -2 } }
        ]
      },
      {
        name: '福王奏请加增禄米',
        narrative: '福王朱常洵（神宗爱子，就国洛阳）奏：宗禄拖欠三年，请加岁禄三万石、增田一万顷。',
        triggerTurn: 4, oneTime: true, priority: 'normal',
        choices: [
          { text: '准所请。', effect: { '国库资金': -200000, '皇威': -3, '全局腐败': +3 } },
          { text: '驳回。宗禄当依祖制。', effect: { '皇威': +5 } },
          { text: '令河南自筹。', effect: { '西北灾荒怨气': +5 } }
        ]
      },
      {
        name: '徐光启献《农政全书》稿',
        narrative: '前礼部左侍郎徐光启遣门生呈《农政全书》稿，论救荒、水利、屯田之法。内言红薯、马铃薯等新作物宜广植北方。',
        triggerTurn: 3, oneTime: true, priority: 'normal',
        choices: [
          { text: '诏发工部试行。', effect: { '环境承载力': +3, '民心': +3, '士人风骨指数': +5 } },
          { text: '召徐光启复职。', effect: { '东林党复苏进度': +5, '士人风骨指数': +8 } },
          { text: '置之不理。', effect: { '士人风骨指数': -3 } }
        ]
      },
      {
        name: '宁远哗变警报',
        narrative: '辽东宁远卫报：兵无饷五月，昨夜军士鼓噪街头，挟参将入衙索饷。满桂率亲兵弹压，暂定。',
        triggerTurn: 4, oneTime: true, priority: 'urgent',
        choices: [
          { text: '急拨内帑五十万。', effect: { '国库资金': -500000, '辽饷积欠': -30, '辽东防线稳固度': +5 } },
          { text: '催户部加派辽饷。', effect: { '辽饷积欠': -20, '民心': -4 } },
          { text: '令满桂就地处置。', effect: { '辽东防线稳固度': -5, '皇威': -3 } }
        ]
      },
      {
        name: '林丹汗遣使乞援',
        narrative: '察哈尔林丹汗遣使至宣府：欲与明共抗后金，乞岁赐银八万两、粟米万石。',
        triggerTurn: 6, oneTime: true, priority: 'normal',
        choices: [
          { text: '准。结盟共击后金。', effect: { '国库资金': -100000, '辽东防线稳固度': +8 } },
          { text: '许市不许盟。', effect: { '国库资金': -50000 } },
          { text: '斥之。夷狄非我族类。', effect: { '皇威': +3 } }
        ]
      },
      {
        name: '江南奏请罢矿税（已罢）查禁',
        narrative: '南京户部尚书毕自严奏：矿税已罢，然各地仍有以督矿为名巧立课款者。请严查以安商民。',
        triggerTurn: 5, oneTime: true, priority: 'normal',
        choices: [
          { text: '准其所奏，严旨禁革。', effect: { '江南商税抵制度': -8, '民心': +3, '全局腐败': -3 } },
          { text: '付廷议。', effect: { '党争烈度': +3 } }
        ]
      },
      {
        name: '郑芝龙乞抚',
        narrative: '福建海商郑芝龙遣人至京：愿受招抚，献舟船百艘、银十万两。请授海防游击。',
        triggerTurn: 8, oneTime: true, priority: 'normal',
        choices: [
          { text: '准抚，授海防游击。', effect: { '国库资金': +100000, '海商势力': +10 } },
          { text: '遣官招抚，不授官衔。', effect: { '海商势力': +3 } },
          { text: '斥海寇不可容。', effect: { '海商势力': -5, '江南商税抵制度': +3 } }
        ]
      },
      {
        name: '阉党立祠二十五处——毁还是留？',
        narrative: '魏忠贤生祠自天启六年起遍立天下。自浙江到九边，计有生祠二十五处。科道请毁，士民观望。',
        triggerTurn: 4, oneTime: true, priority: 'normal',
        choices: [
          { text: '诏令尽毁。', effect: { '阉党权势值': -10, '皇威': +8, '士人风骨指数': +10 } },
          { text: '毁北直/辽东者，南者留以观望。', effect: { '阉党权势值': -5, '皇威': +4 } },
          { text: '留中不发。', effect: {} }
        ]
      },
      {
        name: '孙承宗上疏辞荐',
        narrative: '原辽东督师孙承宗自高阳上疏：老臣衰朽，不堪再起；然愿荐毕自严掌户部，袁崇焕督辽东。',
        triggerTurn: 6, oneTime: true, priority: 'normal',
        choices: [
          { text: '准所荐，一体召用。', effect: { '辽东防线稳固度': +8, '国库资金': +100000, '东林党复苏进度': +5 } },
          { text: '留用毕自严，辽事再议。', effect: { '国库资金': +80000 } },
          { text: '慰谕，未用其荐。', effect: { '士人风骨指数': -3 } }
        ]
      },
      {
        name: '陕西洪承畴请剿饥民',
        narrative: '陕西参政洪承畴奏：饥民聚啸于延安府谷，有王嘉胤、吴延贵等数百人。请拨兵千人剿之。',
        triggerTurn: 8, oneTime: true, priority: 'urgent',
        choices: [
          { text: '准剿。', effect: { '西北灾荒怨气': +5, '流民数量': -50000, '国库资金': -30000 } },
          { text: '抚之。发饥民粮。', effect: { '国库资金': -60000, '西北灾荒怨气': -10, '流民数量': -100000 } },
          { text: '抚剿并举。', effect: { '国库资金': -40000, '西北灾荒怨气': -5, '流民数量': -80000 } }
        ]
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // § 官制树
  // ═══════════════════════════════════════════════════════════════════
  function buildOfficeTree() {
    return [
      {
        id: _uid('off_'), name: '内阁', desc: '正五品大学士，然票拟天下事，实掌相权',
        positions: [
          { name: '首辅·建极殿大学士', rank: '正五品', holder: '黄立极', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '总摄票拟，调和阴阳。实际朝政之枢。', publicTreasuryInit: { money: 0, grain: 0, cloth: 0, quotaMoney: 0, quotaGrain: 0, quotaCloth: 0 }, bindingHint: 'ministry', privateIncome: { bonusType: '恩赏', illicitRisk: 'medium' }, powers: { appointment: true, impeach: true, supervise: false } },
          { name: '次辅·文华殿大学士', rank: '正五品', holder: '施凤来', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '辅佐首辅，分理庶政。' },
          { name: '武英殿大学士', rank: '正五品', holder: '冯铨', establishedCount: 1, vacancyCount: 0, authority: 'execution', succession: 'appointment', duties: '入值文渊，参与票拟。' },
          { name: '东阁大学士(缺)', rank: '正五品', holder: '', establishedCount: 2, vacancyCount: 2, authority: 'execution', succession: 'appointment', duties: '储相之位，常由东阁调用。目前空缺。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '吏部', desc: '天官。掌铨选、考课、封爵',
        positions: [
          { name: '吏部尚书', rank: '正二品', holder: '王绍徽', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '掌文选考课。阉党王绍徽在任，以《东林点将录》为进身之阶。', publicTreasuryInit: { money: 50000, grain: 0, cloth: 0 }, bindingHint: 'ministry', powers: { appointment: true } },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '右侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '户部', desc: '地官。掌户口、田赋、钱粮',
        positions: [
          { name: '户部尚书', rank: '正二品', holder: '郭允厚', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '掌天下钱粮。太仓银库出纳总纲。', publicTreasuryInit: { money: 2000000, grain: 5000000, cloth: 100000, quotaMoney: 8000000, quotaGrain: 20000000, quotaCloth: 500000 }, bindingHint: 'ministry', powers: { taxCollect: true } },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '右侍郎·总督仓场', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '驻通州，掌京通十三仓。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '礼部', desc: '春官。掌礼仪祭祀、科举、外藩',
        positions: [
          { name: '礼部尚书', rank: '正二品', holder: '来宗道', establishedCount: 1, vacancyCount: 0, authority: 'decision' },
          { name: '左侍郎', rank: '正三品', holder: '温体仁', establishedCount: 1, vacancyCount: 0, duties: '主持会试外，兼管外藩朝贡。温体仁将以此进身。' },
          { name: '右侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '兵部', desc: '夏官。掌武选、武职、边防',
        positions: [
          { name: '兵部尚书', rank: '正二品', holder: '崔呈秀', establishedCount: 1, vacancyCount: 0, authority: 'decision', duties: '总督京营戎政。阉党之鹰犬。', publicTreasuryInit: { money: 500000, grain: 1000000, cloth: 50000, quotaMoney: 5000000, quotaGrain: 10000000 }, bindingHint: 'military', privateIncome: { illicitRisk: 'high' }, powers: { militaryCommand: true } },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '武选司主事', rank: '正六品', holder: '孙传庭', establishedCount: 10, vacancyCount: 0, duties: '（原史此时在吏部，此处归兵部备战场需要）' },
          { name: '职方司主事', rank: '正六品', holder: '孙元化', establishedCount: 4, vacancyCount: 0, duties: '掌地图军机，火器。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '刑部', desc: '秋官。掌刑名、审录',
        positions: [
          { name: '刑部尚书', rank: '正二品', holder: '薛贞', establishedCount: 1, vacancyCount: 0, authority: 'decision' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '工部', desc: '冬官。掌营造、工役',
        positions: [
          { name: '工部尚书', rank: '正二品', holder: '薛凤翔', establishedCount: 1, vacancyCount: 0, authority: 'decision' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '都察院', desc: '掌风宪，监察百官',
        positions: [
          { name: '左都御史', rank: '正二品', holder: '贾继春', establishedCount: 1, vacancyCount: 0, authority: 'supervision', powers: { impeach: true, supervise: true } },
          { name: '右都御史', rank: '正二品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '十三道监察御史', rank: '正七品', holder: '', establishedCount: 110, vacancyCount: 20, authority: 'supervision', duties: '按道分察各省官员与吏治。', powers: { impeach: true } }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '大理寺', desc: '掌审谳。与刑部、都察院合称三法司',
        positions: [
          { name: '大理寺卿', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '通政使司', desc: '掌奏疏转达',
        positions: [
          { name: '通政使', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '百官奏章由此递入。阉党常扣压东林奏本于此。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '司礼监', desc: '内廷宦官首衙。掌御前批红',
        positions: [
          { name: '掌印太监·提督东厂·上公', rank: '正四品', holder: '魏忠贤', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '内廷首宦。批红盖印，直达天听。兼提督东厂。', publicTreasuryInit: { money: 3000000, grain: 100000, cloth: 50000 }, bindingHint: 'imperial', privateIncome: { illicitRisk: 'high' }, powers: { appointment: true, impeach: true, supervise: true } },
          { name: '秉笔太监·东厂掌刑', rank: '从四品', holder: '曹化淳', establishedCount: 4, vacancyCount: 0, authority: 'execution', duties: '代帝批红奏疏。', privateIncome: { illicitRisk: 'medium' } },
          { name: '秉笔太监', rank: '从四品', holder: '方正化', establishedCount: 1, vacancyCount: 0, authority: 'execution' },
          { name: '随堂太监', rank: '从四品', holder: '', establishedCount: 8, vacancyCount: 3 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '锦衣卫', desc: '天子亲军二十六卫之首。掌侍卫、缉察、诏狱',
        positions: [
          { name: '指挥使', rank: '正三品', holder: '田尔耕', establishedCount: 1, vacancyCount: 0, authority: 'execution', duties: '阉党"五彪"之首。掌诏狱。', publicTreasuryInit: { money: 200000, grain: 0, cloth: 0 }, bindingHint: 'imperial', privateIncome: { illicitRisk: 'high' }, powers: { impeach: true, supervise: true } },
          { name: '北镇抚使·专理诏狱', rank: '正四品', holder: '许显纯', establishedCount: 1, vacancyCount: 0, duties: '阉党"五彪"之一。天启中诛杀东林六君子之手。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '五军都督府', desc: '中·左·右·前·后 五都督',
        positions: [
          { name: '中军都督', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '左军都督·山海关总兵', rank: '正一品', holder: '赵率教', establishedCount: 1, vacancyCount: 0 },
          { name: '右军都督·宁远总兵', rank: '正一品', holder: '满桂', establishedCount: 1, vacancyCount: 0 },
          { name: '前军都督·东江总兵', rank: '正一品', holder: '毛文龙', establishedCount: 1, vacancyCount: 0, duties: '驻皮岛，扰后金后方。', publicTreasuryInit: { money: 50000, grain: 200000, cloth: 20000 }, bindingHint: 'military', privateIncome: { illicitRisk: 'high' } },
          { name: '后军都督', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '宁远副总兵', rank: '从二品', holder: '祖大寿', establishedCount: 1, vacancyCount: 0 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '翰林院·詹事府', desc: '清要之衙。儲相养望之地',
        positions: [
          { name: '翰林院掌院学士', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '翰林院侍读学士', rank: '从五品', holder: '周延儒', establishedCount: 2, vacancyCount: 0, duties: '翰林清要。日后崇祯倚之。' },
          { name: '詹事府詹事', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '辅导东宫（今暂无太子）。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '地方督抚', desc: '巡抚/总督，封疆大吏',
        positions: [
          { name: '辽东经略', rank: '正二品(加兵部尚书衔)', holder: '王之臣', establishedCount: 1, vacancyCount: 0, duties: '节制关宁、东江两镇。', publicTreasuryInit: { money: 300000, grain: 600000, cloth: 30000 }, bindingHint: 'region' },
          { name: '三边总督', rank: '从一品(加兵部尚书衔)', holder: '武之望', establishedCount: 1, vacancyCount: 0, duties: '节制陕西/甘肃/宁夏/延绥四镇。', publicTreasuryInit: { money: 150000, grain: 400000, cloth: 15000 }, bindingHint: 'region' },
          { name: '陕西巡抚', rank: '正二品', holder: '胡廷宴', establishedCount: 1, vacancyCount: 0, publicTreasuryInit: { money: 50000, grain: 80000, cloth: 5000 }, bindingHint: 'region' },
          { name: '应天巡抚(南直隶)', rank: '正二品', holder: '毛一鹭', establishedCount: 1, vacancyCount: 0, publicTreasuryInit: { money: 600000, grain: 1200000, cloth: 150000 }, bindingHint: 'region' },
          { name: '顺天巡抚(北直隶)', rank: '正二品', holder: '刘诏', establishedCount: 1, vacancyCount: 0, publicTreasuryInit: { money: 300000, grain: 600000, cloth: 50000 }, bindingHint: 'region' },
          { name: '浙江巡抚', rank: '正二品', holder: '潘汝桢', establishedCount: 1, vacancyCount: 0, duties: '阉党，为魏忠贤建生祠第一人。' },
          { name: '大名府知府', rank: '正四品', holder: '卢象升', establishedCount: 1, vacancyCount: 0, duties: '北直隶南部要冲。' }
        ],
        subs: []
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // § 行政区划
  // ═══════════════════════════════════════════════════════════════════
  function buildAdminHierarchy() {
    function division(opts) {
      var d = Object.assign({
        id: _uid('div_'),
        regionType: 'normal',
        populationDetail: { households: 0, mouths: 0, ding: 0, fugitives: 0, hiddenCount: 0 },
        byGender: { male: 0, female: 0, sexRatio: 1.05 },
        byAge: { old: { count: 0, ratio: 0.14 }, ding: { count: 0, ratio: 0.56 }, young: { count: 0, ratio: 0.30 } },
        byEthnicity: { '汉': 0.96, '其他': 0.04 },
        byFaith: { '儒': 0.35, '佛': 0.20, '道': 0.15, '民间': 0.30 },
        baojia: { baoCount: 0, jiaCount: 0, paiCount: 0, registerAccuracy: 0.62 },
        carryingCapacity: { arable: 0, water: 0, climate: 1.0, historicalCap: 0, currentLoad: 0.85, carryingRegime: 'strained' },
        minxinLocal: 45, corruptionLocal: 60,
        fiscalDetail: { claimedRevenue: 0, actualRevenue: 0, remittedToCenter: 0, retainedBudget: 0, compliance: 0.58, skimmingRate: 0.18, autonomyLevel: 0.2 },
        publicTreasuryInit: { money: 50000, grain: 100000, cloth: 10000 },
        children: []
      }, opts);
      if (d.populationDetail.mouths > 0) {
        if (!d.populationDetail.households) d.populationDetail.households = Math.floor(d.populationDetail.mouths / 5.2);
        if (!d.populationDetail.ding) d.populationDetail.ding = Math.floor(d.populationDetail.mouths * 0.26);
        d.population = d.populationDetail.mouths;
        d.byGender.male = Math.floor(d.populationDetail.mouths * 0.51);
        d.byGender.female = d.populationDetail.mouths - d.byGender.male;
        d.byAge.old.count = Math.floor(d.populationDetail.mouths * d.byAge.old.ratio);
        d.byAge.ding.count = Math.floor(d.populationDetail.mouths * d.byAge.ding.ratio);
        d.byAge.young.count = d.populationDetail.mouths - d.byAge.old.count - d.byAge.ding.count;
        d.baojia.baoCount = Math.floor(d.populationDetail.households / 100);
        d.baojia.jiaCount = Math.floor(d.populationDetail.households / 10);
        d.baojia.paiCount = d.baojia.jiaCount;
        d.carryingCapacity.arable = Math.round(d.populationDetail.mouths * 1.3);
        d.carryingCapacity.water = Math.round(d.populationDetail.mouths * 1.1);
        d.carryingCapacity.historicalCap = Math.round(d.populationDetail.mouths * 1.4);
        var annual = Math.round(d.populationDetail.mouths * 1.3);
        d.fiscalDetail.claimedRevenue = annual;
        d.fiscalDetail.actualRevenue = Math.round(annual * 0.82);
        d.fiscalDetail.remittedToCenter = Math.round(annual * 0.55);
        d.fiscalDetail.retainedBudget = Math.round(annual * 0.27);
      }
      return d;
    }

    return {
      player: {
        factionId: 'fac-ming',
        factionName: '明朝廷',
        divisions: [
          division({
            name: '北直隶', level: 'province', officialPosition: '顺天巡抚', governor: '刘诏',
            description: '京师所在，天下首善。下辖顺天/保定/河间/真定/大名/永平/顺德/广平/宣府 八府一镇。',
            populationDetail: { mouths: 8200000, households: 0, ding: 0, fugitives: 180000, hiddenCount: 200000 },
            terrain: '平原', specialResources: '漕运·煤·铁', taxLevel: '重',
            publicTreasuryInit: { money: 400000, grain: 800000, cloth: 60000 },
            minxinLocal: 48, corruptionLocal: 72,
            children: [
              division({ name: '顺天府', level: 'prefecture', officialPosition: '顺天府尹',
                description: '京师。含大兴、宛平等县。', populationDetail: { mouths: 1500000 }, terrain: '平原' }),
              division({ name: '保定府', level: 'prefecture', populationDetail: { mouths: 900000 }, terrain: '平原' }),
              division({ name: '永平府', level: 'prefecture', populationDetail: { mouths: 450000 },
                description: '榆关所在，山海关节度于此。', terrain: '沿海' }),
              division({ name: '大名府', level: 'prefecture', officialPosition: '大名知府', governor: '卢象升',
                description: '北直隶南门户。漳河冲积平原。', populationDetail: { mouths: 600000 }, terrain: '平原' }),
              division({ name: '宣府镇', level: 'prefecture', regionType: 'normal',
                description: '九边之一，控蒙古。', populationDetail: { mouths: 300000 }, terrain: '山地',
                publicTreasuryInit: { money: 200000, grain: 400000, cloth: 30000 } })
            ]
          }),
          division({
            name: '南直隶', level: 'province', officialPosition: '应天巡抚', governor: '毛一鹭',
            description: '留都所在。财赋半天下。下辖应天/苏州/松江/常州/镇江/扬州/淮安/凤阳/徐州等十四府。',
            populationDetail: { mouths: 16500000, fugitives: 150000, hiddenCount: 500000 },
            terrain: '平原', specialResources: '丝绸·棉布·茶·漕米', taxLevel: '重',
            publicTreasuryInit: { money: 800000, grain: 1500000, cloth: 200000 },
            minxinLocal: 55, corruptionLocal: 65,
            children: [
              division({ name: '应天府', level: 'prefecture', officialPosition: '应天府尹',
                description: '南京。留都。', populationDetail: { mouths: 2100000 } }),
              division({ name: '苏州府', level: 'prefecture',
                description: '天下首府，赋最重。', populationDetail: { mouths: 2000000 }, specialResources: '丝绸·米', taxLevel: '重' }),
              division({ name: '松江府', level: 'prefecture',
                description: '东南布帛重镇，"衣被天下"。徐光启故里。', populationDetail: { mouths: 1100000 }, specialResources: '棉布' }),
              division({ name: '扬州府', level: 'prefecture',
                description: '盐运总司驻地。', populationDetail: { mouths: 900000 }, specialResources: '盐' }),
              division({ name: '凤阳府', level: 'prefecture',
                description: '中都。太祖龙兴之地。皇陵所在。', populationDetail: { mouths: 700000 }, terrain: '平原', taxLevel: '轻' })
            ]
          }),
          division({
            name: '陕西布政使司', level: 'province', officialPosition: '陕西巡抚', governor: '胡廷宴',
            description: '三边总督武之望节制。秦地饥馑，民变之薪积。',
            populationDetail: { mouths: 5800000, fugitives: 350000, hiddenCount: 200000 },
            terrain: '山地', specialResources: '棉·盐·铁', taxLevel: '重',
            publicTreasuryInit: { money: 60000, grain: 80000, cloth: 10000 },
            minxinLocal: 22, corruptionLocal: 75,
            carryingCapacity: { arable: 6000000, water: 5500000, climate: 0.7, historicalCap: 7000000, currentLoad: 1.1, carryingRegime: 'famine' },
            children: [
              division({ name: '西安府', level: 'prefecture', populationDetail: { mouths: 1800000 }, terrain: '平原' }),
              division({ name: '延安府', level: 'prefecture',
                description: '旱魃三年，民食草根。', populationDetail: { mouths: 700000, fugitives: 120000 },
                terrain: '山地', minxinLocal: 12, taxLevel: '重',
                carryingCapacity: { arable: 600000, water: 400000, climate: 0.55, historicalCap: 800000, currentLoad: 1.3, carryingRegime: 'famine' } }),
              division({ name: '榆林镇', level: 'prefecture', regionType: 'normal',
                description: '九边之一。逃兵饥民最多。', populationDetail: { mouths: 250000, fugitives: 80000 },
                terrain: '山地', minxinLocal: 15 }),
              division({ name: '府谷县', level: 'county',
                description: '黄土高原。王嘉胤、李自成活动之地。', populationDetail: { mouths: 60000, fugitives: 35000 }, minxinLocal: 8 })
            ]
          }),
          division({
            name: '辽东都指挥使司', level: 'province', officialPosition: '辽东经略', governor: '王之臣',
            description: '九边之首。袁崇焕去后，现由王之臣兼领。宁远/山海关为关宁防线核心。',
            populationDetail: { mouths: 850000, fugitives: 200000 },
            terrain: '山地', specialResources: '马·皮毛·人参', taxLevel: '轻',
            publicTreasuryInit: { money: 150000, grain: 300000, cloth: 20000 },
            regionType: 'normal', minxinLocal: 40, corruptionLocal: 58,
            children: [
              division({ name: '宁远卫', level: 'prefecture', officialPosition: '宁远总兵', governor: '满桂',
                description: '关外要冲。宁远大战故地。', populationDetail: { mouths: 120000 }, terrain: '沿海' }),
              division({ name: '山海关', level: 'prefecture', officialPosition: '山海关总兵', governor: '赵率教',
                description: '天下第一关。', populationDetail: { mouths: 180000 }, terrain: '山地' }),
              division({ name: '东江镇·皮岛', level: 'prefecture', officialPosition: '东江总兵', governor: '毛文龙',
                description: '鸭绿江口海岛。孤悬海外，扰后金后方。', populationDetail: { mouths: 80000 }, terrain: '沿海',
                regionType: 'normal', minxinLocal: 55 })
            ]
          })
        ]
      }
    };
  }

  // DOM ready 后注册
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', register);
    } else {
      register();
    }
  } else {
    setTimeout(register, 50);
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
