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
  // ═══════════════════════════════════════════════════════════════════
  //  _DEEP_CHARS — 核心史实人物深化数据字典
  //  通过姓名映射直接覆盖/补齐：字/号/籍贯/外貌/辞令/内心/压力源/仕途/家族
  //  数据来源：《明史》本传、《崇祯长编》、《明实录》、《国榷》、各人本传志铭
  // ═══════════════════════════════════════════════════════════════════
  var _DEEP_CHARS = {
    '魏忠贤': { /* 已在主数据直接写入，此处略 */ },
    '朱由检': { /* 同上 */ },
    '周皇后': {
      zi: '', haoName: '', birthplace: '南直隶·苏州(实为开封周奎之女生于苏州寄籍)', ethnicity: '汉', faith: '儒',
      appearance: '姿色端丽，体态修长；衣饰节俭，常亲操针黹。', diction: '温婉有礼，偶露刚烈。',
      innerThought: '入信邸时家贫父鬻薪，一夕骤尊后位。深知外朝阉党林立，内宫客氏余威未散。惟愿陛下内能安，外能胜。',
      personalGoal: '为帝生嗣、辅政安宫、守节殉国。',
      stressSources: ['阉党余党', '后宫妃嫔争宠', '本家周奎贫而贪', '帝夜不成寐'],
      career: [ { year: 1624, title: '信王妃', note: '天启四年十五岁册立。' }, { year: 1627, title: '皇后', note: '崇祯元年正月改封。' }, { year: 1644, title: '殉国', note: '崇祯十七年三月自缢坤宁宫。' } ],
      familyMembers: [ { name: '朱由检', relation: '夫' }, { name: '周奎', relation: '父·嘉定伯' }, { name: '周世显', relation: '兄', note: '驸马袁顺附孙' } ]
    },
    '张懿安': {
      zi: '', birthplace: '河南·祥符', learning: '《女诫》《列女传》',
      appearance: '体态丰润，端凝有威仪。', diction: '严正有礼，不妄言笑。',
      innerThought: '熹宗一生被客魏所蔽，死不瞑目。新帝必除此二凶；若过冬不决，吾亦不得安。',
      stressSources: ['夫殁无后', '客氏诅咒阴魂', '阉党余威', '信邸叔嫂分际'],
      career: [ { year: 1621, title: '皇后', note: '天启元年十五岁册立。' }, { year: 1627, title: '懿安皇后', note: '熹宗崩后尊号。' }, { year: 1644, title: '殉国', note: '京师破时自尽。' } ]
    },
    '崔呈秀': {
      zi: '国之', birthplace: '北直隶·蓟州', learning: '进士',
      innerThought: '客氏既出宫，吾必首罹其难。然兵部尚书在手，京营戎政在手，或可一搏——然魏公已去浙江生祠，朝中人心离散，吾独木难支。',
      stressSources: ['科道连章劾奏', '新帝冷目', '京营兵将心乱'],
      career: [ { year: 1613, title: '进士', note: '万历四十一年。' }, { year: 1624, title: '投靠魏忠贤', note: '为"五虎"首。' }, { year: 1627, title: '罢官自缢', note: '原史十一月。' } ]
    },
    '田尔耕': {
      zi: '茂东', birthplace: '陕西·三原', learning: '武荫袭职',
      innerThought: '锦衣卫在手，九千岁若令变，吾虽愿效死——然田氏列祖以来世袭此职，岂可一朝灰灭？',
      career: [ { year: 1620, title: '锦衣卫指挥使', note: '袭职。' }, { year: 1624, title: '阉党五彪之首' }, { year: 1628, title: '弃市', note: '原史崇祯元年伏诛。' } ]
    },
    '黄立极': {
      zi: '石笥', haoName: '中五', birthplace: '北直隶·元氏', learning: '进士',
      innerThought: '老夫入阁三年，何曾有一日安寝？魏公之势虽盛然必衰，东林归朝吾辈必为其所噬。唯乞骸骨以全晚节。',
      stressSources: ['票拟尽秉九千岁意', '东林将返', '年老体衰'],
      career: [ { year: 1604, title: '进士', note: '万历三十二年。' }, { year: 1626, title: '入阁', note: '天启六年。' }, { year: 1628, title: '致仕归里', note: '原史崇祯元年罢。' } ]
    },
    '韩爌': {
      zi: '虞臣', haoName: '象云', birthplace: '山西·蒲州', learning: '进士(翰林)',
      appearance: '清癯长髯，步履沉稳。', diction: '言少而中肯。',
      innerThought: '六君子血犹在诏狱梁上——他们为东林而死，吾苟活三年于蒲州。新帝若召我，是救我，是用我，亦是付我以血债复仇之责。',
      personalGoal: '复东林正气、追究阉党、重整吏治。',
      stressSources: ['东林血债未偿', '浙党楚党掣肘', '帝年少急躁'],
      career: [ { year: 1592, title: '进士', note: '万历二十年榜眼。' }, { year: 1615, title: '礼部侍郎·东阁大学士' }, { year: 1624, title: '罢归', note: '天启四年被阉党构陷。' }, { year: 1628, title: '召还首辅', note: '原史崇祯元年。' } ],
      familyMembers: [ { name: '韩霖', relation: '子', note: '天主教徒，徐光启门生' } ]
    },
    '钱龙锡': {
      zi: '稚文', haoName: '机山', birthplace: '南直隶·松江华亭', learning: '进士(翰林)',
      innerThought: '阉祸初平，东林方可喘息。然袁崇焕之事在怀——当年我一手举荐，日后若辽事误国，吾必受连坐。',
      stressSources: ['东林党重振任务', '袁崇焕前途未卜', '浙党温体仁虎视'],
      career: [ { year: 1607, title: '进士', note: '万历三十五年。' }, { year: 1625, title: '贬归', note: '天启五年被阉党排挤。' }, { year: 1628, title: '召还入阁', note: '原史崇祯元年。' }, { year: 1631, title: '戍边', note: '崇祯三年因袁崇焕案连坐。' } ]
    },
    '毕自严': {
      zi: '景曾', haoName: '白阳', birthplace: '山东·淄川', learning: '进士',
      appearance: '清瘦短小，颐下长须。', diction: '言理财数目必核三遍。',
      innerThought: '太仓账册吾熟之如掌——名目二百万实可调九十万，辽饷岁需四百万何从出？唯有加派。然加派则激民变。此等死局，吾何以解之？',
      personalGoal: '开源节流、整顿度支、救此财政危局。',
      stressSources: ['太仓空虚', '宗禄拖欠', '辽饷逼饷如潮', '江南抗税'],
      career: [ { year: 1592, title: '进士', note: '万历二十年。' }, { year: 1620, title: '太仆少卿', note: '万历末。' }, { year: 1625, title: '南京户部尚书' }, { year: 1628, title: '户部尚书', note: '原史崇祯元年召入。' }, { year: 1633, title: '病卒任上', note: '崇祯六年。' } ]
    },
    '徐光启': {
      zi: '子先', haoName: '玄扈', birthplace: '南直隶·松江上海', learning: '进士(翰林)', faith: '天主教',
      appearance: '长须清癯，常服儒巾；执事时戴"十字巾"（天主教徒识认）。',
      diction: '说话有条理，好用"格物""穷理"等新名词。',
      innerThought: '利玛窦老友已卒十六年，西学未竟。陕西大饥——吾所著《农政全书》若不传世，此身真白来世一遭。',
      personalGoal: '推行甘薯马铃薯以救荒、精修历法、翻译几何；中兴大明须借西器西术。',
      stressSources: ['利玛窦旧友不存', '天主教士被猜忌', '告归而无进退', '弟子孙元化在兵部势弱'],
      career: [ { year: 1604, title: '进士', note: '万历三十二年。' }, { year: 1604, title: '入翰林', note: '同年。' }, { year: 1607, title: '受洗入教', note: '与利玛窦合作。' }, { year: 1620, title: '《几何原本》译成' }, { year: 1627, title: '告归养病', note: '以礼部左侍郎告归。' }, { year: 1628, title: '召还', note: '原史崇祯元年礼部尚书。' }, { year: 1632, title: '入阁', note: '崇祯五年。' }, { year: 1633, title: '卒', note: '崇祯六年十月。' } ]
    },
    '温体仁': {
      zi: '长卿', haoName: '员峤', birthplace: '浙江·乌程(湖州)', learning: '进士',
      appearance: '中等身量，面白无须。言笑从容，然眉间常结。', diction: '柔佞含蓄，不激言直事。',
      innerThought: '东林归朝，吾居其间必为所逼。当先附新帝之意、挑东林内争，以浙党之名结一大党。此时当隐忍，待十年后执牛耳。',
      personalGoal: '入阁为首辅；以柔克刚破东林。',
      stressSources: ['东林复起', '浙党势弱'],
      career: [ { year: 1598, title: '进士', note: '万历二十六年。' }, { year: 1627, title: '礼部左侍郎' }, { year: 1629, title: '入阁', note: '崇祯二年。' }, { year: 1630, title: '首辅', note: '崇祯三年。' }, { year: 1637, title: '罢归', note: '崇祯十年。' } ]
    },
    '周延儒': {
      zi: '玉绳', haoName: '挹斋', birthplace: '南直隶·常州宜兴', learning: '进士(状元)',
      appearance: '英俊少年老成，目光机敏。', diction: '才辩滔滔，好用典故。',
      innerThought: '万历四十一年状元，吾才名满天下。然十余年徘徊翰林，唯新君可引我入阁台。',
      stressSources: ['翰林清贫', '温体仁同榜将为敌'],
      career: [ { year: 1613, title: '状元', note: '万历四十一年。' }, { year: 1629, title: '入阁', note: '崇祯二年。' }, { year: 1630, title: '首辅', note: '崇祯三年。' }, { year: 1633, title: '罢归' }, { year: 1641, title: '再首辅' }, { year: 1643, title: '赐死', note: '崇祯十六年。' } ]
    },
    '袁崇焕': {
      zi: '元素', haoName: '自如', birthplace: '广东·东莞(籍广西藤县)', learning: '进士',
      appearance: '中等身量，黎黑多须，目射精光。', diction: '雄辩豪语，言"五年复辽"立见胸次。',
      innerThought: '宁远一炮退老奴，宁锦再退黄台吉——然吾功不录，被阉党逼走！新帝召我，我当效先秦范雎申包胥之忠，五年清辽东！然辽镇皆旧部，毛文龙据皮岛不听约束——斩之乎？',
      personalGoal: '五年复辽东，封侯赐剑，平北虏。',
      stressSources: ['阉党余孽谗于帝', '毛文龙不听节制', '辽饷不继', '辽将人心'],
      career: [ { year: 1619, title: '进士', note: '万历四十七年。' }, { year: 1622, title: '兵部职方司主事', note: '单骑出关。' }, { year: 1626, title: '宁远大捷' }, { year: 1627, title: '宁锦大捷' }, { year: 1627, title: '丁忧归乡', note: '七月告归。' }, { year: 1628, title: '督师蓟辽', note: '平台召见，五年复辽之约。' }, { year: 1630, title: '磔死', note: '崇祯三年八月。' } ],
      familyMembers: [ { name: '袁文炳', relation: '父', note: '贡生' } ]
    },
    '孙承宗': {
      zi: '稚绳', haoName: '恺阳', birthplace: '北直隶·高阳', learning: '进士(榜眼)',
      appearance: '身长七尺，须髯如戟，方面广颡。', diction: '言必有据，教人如对圣贤。',
      innerThought: '老夫六十五，筋骨犹健。辽东筑宁远锦州是吾心血——袁崇焕守之，大敌难越。然毛文龙尾大不掉，祖大寿骄悍，皇太极隐忍谋我。老夫若不再起，五年复辽恐是空言。',
      personalGoal: '守关宁不失；训帝以尧舜之道。',
      stressSources: ['年老', '帝性急', '阉党余党或反扑', '辽东将领不齐心'],
      career: [ { year: 1604, title: '榜眼', note: '万历三十二年。' }, { year: 1620, title: '詹事府少詹事', note: '熹宗师傅。' }, { year: 1622, title: '兵部尚书·辽东督师' }, { year: 1625, title: '罢归', note: '被阉党排挤。' }, { year: 1629, title: '再督辽', note: '崇祯二年。' }, { year: 1638, title: '战死高阳', note: '清军攻城，阖门殉国。' } ],
      familyMembers: [ { name: '孙鉁', relation: '长子', note: '战死高阳' } ]
    },
    '毛文龙': {
      zi: '振南', haoName: '镇东', birthplace: '浙江·仁和(杭州)', learning: '武举',
      appearance: '身短而壮，面黑如墨，左眼有疤。', diction: '豪言自夸，不避粗话。',
      innerThought: '皮岛孤悬海外，朝廷视我如弃子。然我手握东江十余万人，朝廷不敢不给饷。袁崇焕来督师，必欲夺我兵。',
      stressSources: ['袁崇焕欲节制', '朝廷疑其冒饷', '后金离间'],
      career: [ { year: 1605, title: '武举', note: '后从军辽东。' }, { year: 1621, title: '袭据镇江', note: '天启元年。' }, { year: 1622, title: '开东江镇' }, { year: 1629, title: '被斩于双岛', note: '崇祯二年六月袁崇焕矫诏。' } ]
    },
    '洪承畴': {
      zi: '彦演', haoName: '亨九', birthplace: '福建·泉州南安', learning: '进士',
      innerThought: '陕西旱象日深，流民星火足以燎原。吾本文人，将任兵事——若不铁腕剿平，匪势成则国难起。',
      stressSources: ['陕西饥民激增', '总督武之望老病', '剿饷无着'],
      career: [ { year: 1616, title: '进士', note: '万历四十四年。' }, { year: 1627, title: '陕西参政' }, { year: 1629, title: '延绥巡抚', note: '崇祯二年。' }, { year: 1631, title: '三边总督' }, { year: 1642, title: '松锦战败降清', note: '崇祯十五年。' } ]
    },
    '卢象升': {
      zi: '建斗', haoName: '九台', birthplace: '南直隶·常州宜兴', learning: '进士',
      appearance: '身长七尺，瘦骨嶙峋，然能挽八石之弓。', diction: '慷慨激昂，自誓以死报国。',
      innerThought: '大名府地僻事繁，吾练兵千人号"天雄军"——虽无饷亦当用死士之心相付。',
      personalGoal: '殉国报君。',
      stressSources: ['大名府财政拮据', '京师遥远闻报不及'],
      career: [ { year: 1622, title: '进士', note: '天启二年。' }, { year: 1627, title: '大名知府' }, { year: 1629, title: '起兵入卫', note: '崇祯二年。' }, { year: 1637, title: '宣大总督·兵部尚书' }, { year: 1638, title: '战死鹿庄', note: '崇祯十一年十二月。' } ]
    },
    '孙传庭': {
      zi: '伯雅', haoName: '白谷', birthplace: '山西·代州', learning: '进士',
      innerThought: '读书十年，观今朝之事，乃知古人云"兵者不祥"非虚。然国事至此，非兵不可。',
      career: [ { year: 1619, title: '进士', note: '万历四十七年。' }, { year: 1635, title: '陕西巡抚', note: '崇祯八年。' }, { year: 1636, title: '擒高迎祥' }, { year: 1643, title: '战死潼关', note: '崇祯十六年十月。"传庭死而明亡矣"' } ]
    },
    '孙元化': {
      zi: '火东', haoName: '初阳', birthplace: '南直隶·嘉定', learning: '举人(精西学)', faith: '天主教',
      innerThought: '徐夫子传吾几何与火器之法，吾于兵部职方司司职方图。红夷大炮之用，此身愿以证之。',
      career: [ { year: 1612, title: '举人' }, { year: 1624, title: '宁远战后受袁崇焕赏识' }, { year: 1630, title: '登莱巡抚', note: '崇祯三年。' }, { year: 1632, title: '为孔有德叛兵所执', note: '崇祯五年。' } ]
    },
    '皇太极': {
      zi: '', haoName: '', birthplace: '辽东·赫图阿拉(努尔哈赤兴起之地)', ethnicity: '女真', faith: '萨满·兼礼汉儒',
      appearance: '身长面圆，双目炯炯；身着蟒袍戴盔，左右不离宝剑。',
      diction: '汉语流利，书信多用汉文，好读《三国演义》。',
      innerThought: '明之新帝年少，阉党将倾，正我国机会。然二兄阿敏三兄莽古尔泰犹在，四大贝勒共坐南面之制不可久。范章京劝我改汗称帝——当待时机。先破朝鲜(已成)，再图宁锦，绕蒙古破塞亦未尝不可。',
      personalGoal: '取代大明，入主中原。',
      stressSources: ['内部四大贝勒牵制', '明新帝动向未定', '察哈尔林丹汗威胁', '东江毛文龙扰后方'],
      career: [ { year: 1592, title: '出生', note: '万历二十年。' }, { year: 1616, title: '贝勒', note: '父汗努尔哈赤建国。' }, { year: 1626, title: '继汗位', note: '天命十一年。' }, { year: 1627, title: '伐朝鲜', note: '天聪元年春。' }, { year: 1636, title: '称帝', note: '改元崇德，国号清。' }, { year: 1643, title: '病逝', note: '崇德八年八月。' } ],
      familyMembers: [ { name: '努尔哈赤', relation: '父', note: '后金太祖(殁)' }, { name: '代善', relation: '兄·礼亲王' }, { name: '多尔衮', relation: '异母弟' }, { name: '福临', relation: '子', note: '1638生,后为顺治帝' } ]
    },
    '代善': {
      zi: '', birthplace: '辽东·赫图阿拉', ethnicity: '女真', faith: '萨满',
      innerThought: '天命汗父崩，四子共议，吾本居长当立。然让于老八，是吾让之、或势使之让之？今皇太极威柄日重，吾当保身。',
      career: [ { year: 1583, title: '出生' }, { year: 1616, title: '大贝勒·两红旗旗主' }, { year: 1626, title: '礼亲王(与皇太极共议国政)' } ]
    },
    '多尔衮': {
      zi: '', birthplace: '辽东·赫图阿拉', ethnicity: '女真', faith: '萨满',
      innerThought: '父汗最疼爱我，然临崩时我仅十五岁。母亲大福晋被逼殉葬，我不能救。皇太极虽为兄，然吾心非全服。',
      career: [ { year: 1612, title: '出生' }, { year: 1626, title: '贝勒', note: '父殁时十五岁。' }, { year: 1636, title: '睿亲王', note: '清崇德元年。' }, { year: 1644, title: '入关摄政' }, { year: 1650, title: '死于塞外' } ]
    },
    '范文程': {
      zi: '宪斗', haoName: '辉岳', birthplace: '沈阳(宋范仲淹十七世孙,祖居江西)', ethnicity: '汉', faith: '儒',
      innerThought: '吾为范文正公后裔，不愿为八旗苞苴。然天命九年沈阳陷，吾祖孙三代入后金。努尔哈赤卒，皇太极立——此君非池中物，或当赞襄王业以光大汉统。',
      career: [ { year: 1597, title: '出生' }, { year: 1618, title: '秀才' }, { year: 1625, title: '入后金汉军', note: '天命九年后归附。' }, { year: 1629, title: '文馆大学士' }, { year: 1644, title: '佐多尔衮入关' }, { year: 1666, title: '卒', note: '清康熙五年。' } ]
    },
    '林丹汗': {
      zi: '', birthplace: '察哈尔·浩齐特', ethnicity: '蒙古', faith: '藏传佛教',
      innerThought: '吾为元裔，天命之主。然努尔哈赤之子皇太极已收服科尔沁、喀喇沁诸部，吾逃向归化——须借明力以抗后金。',
      career: [ { year: 1592, title: '出生' }, { year: 1604, title: '继察哈尔汗' }, { year: 1627, title: '西迁归化' }, { year: 1634, title: '死于青海', note: '崇祯七年。' } ]
    },
    '仁祖李倧': {
      zi: '和伯', birthplace: '朝鲜·汉城', ethnicity: '朝鲜', faith: '儒教(事大)',
      innerThought: '光海君乃被吾推翻，君位不稳。后金逼定兄弟之盟，吾既不愿又不敢违——事大明以正统。',
      career: [ { year: 1595, title: '出生' }, { year: 1623, title: '反正即位', note: '废光海君。' }, { year: 1627, title: '江都盟', note: '天聪元年春被后金所逼。' }, { year: 1637, title: '丙子胡乱降清' }, { year: 1649, title: '卒' } ]
    },
    '郑芝龙': {
      zi: '曰甲', haoName: '飞黄', birthplace: '福建·泉州南安', ethnicity: '汉', faith: '天主教·兼佛', learning: '海商出身',
      appearance: '海上风霜染面，然举止不失文雅。通日语、葡语、荷兰语。',
      innerThought: '吾为海上豪杰，明廷视我如海寇——然朝廷水师不及我十一。若受抚为游击，进可剿荷兰海寇，退可保全基业。',
      career: [ { year: 1604, title: '出生' }, { year: 1621, title: '赴日本平户' }, { year: 1624, title: '助荷兰据台' }, { year: 1628, title: '受明招抚为海防游击', note: '原史崇祯元年。' }, { year: 1645, title: '福建总兵' }, { year: 1661, title: '被清杀于北京' } ],
      familyMembers: [ { name: '郑成功', relation: '子', note: '1624生(日本平户)。日后抗清复台。' }, { name: '田川松', relation: '妻', note: '日本妇人。' } ]
    },
    '李自成': {
      zi: '鸿基', birthplace: '陕西·米脂', ethnicity: '汉', faith: '民间',
      appearance: '额方面阔，目深口阔，善骑射。',
      innerThought: '父母皆饿死于前年大旱，吾为驿卒月俸一两。朝廷若停驿站，吾与弟侄无业——饥寒在前，束手待毙乎？',
      career: [ { year: 1606, title: '出生' }, { year: 1620, title: '为驿卒', note: '银川驿。' }, { year: 1629, title: '驿站被裁起事', note: '崇祯二年。' }, { year: 1636, title: '继高迎祥为闯王', note: '崇祯九年。' }, { year: 1644, title: '破京称大顺帝' }, { year: 1645, title: '死于九宫山' } ]
    },
    '张献忠': {
      zi: '秉吾', haoName: '敬轩', birthplace: '陕西·延安定边', ethnicity: '汉',
      appearance: '黄面虬须，目光凶悍。',
      innerThought: '当兵吃粮本求活命，今上官克扣、饷银无着。米脂十八寨皆欲起事，吾宁为王，不为虏卒。',
      career: [ { year: 1606, title: '出生' }, { year: 1630, title: '米脂十八寨起事', note: '崇祯三年。' }, { year: 1643, title: '据武昌称大西王' }, { year: 1646, title: '死于四川西充' } ]
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  _AI_PERSONAS — 对齐编辑器 addChr 字段（appearance/aiPersonaText/
  //  behaviorMode/valueSystem/speechStyle/secret/skills/hobbies/
  //  dialogues），为 AI 推演提供行事风格指引
  // ═══════════════════════════════════════════════════════════════════
  var _AI_PERSONAS = {
    '朱由检': {
      aiPersonaText: '十七岁嗣位之君，刚烈急切，骨子里藏深重不安。所以多疑，所以勤政。大决之前必自诵杨涟疏；败绩时尤易诿过臣下，前后用人十七年换辅五十。决不杀功臣之念与动辄下狱的行径并存。',
      behaviorMode: '急进·高压·多疑·勤政',
      valueSystem: '祖宗江山第一；吏治第二；臣节第三。以圣君自期又以亡国之君自恐。',
      speechStyle: '文言凝重，用"朕""尔等"。发怒时语短而直："着实切责"。',
      secret: '实未与长兄熹宗确证其溺水之因——魏忠贤或客氏有无加害，一念犹疑。',
      skills: ['经筵读书', '朱批奏疏', '观兵演阵', '诵经祈福'],
      hobbies: '书法,骑射,独坐苦思,微服访察',
      dialogues: ['众卿有无可言？', '着锦衣卫详查。', '此事难办。岂有此理！', '朕当以尧舜自期。']
    },
    '魏忠贤': {
      aiPersonaText: '大势已去而不敢退，欲退却无处可去。表面仍受"九千岁"礼遇，实已如坐针毡。会主动投石问路，频送帝宝物探圣意。若玩家示弱必加倍嚣张，若玩家强硬则试图连结亲信武将兵变。',
      behaviorMode: '阴狠·笼络·试探·暴起',
      valueSystem: '九千岁身份是命根。义子义孙是外藩。活着比名声重要。',
      speechStyle: '粗豪市井之语。"哎"字开头。见帝则匍匐，私下骂人泼辣。',
      secret: '内廷珍宝、金银、土地册籍藏于慈宁宫西偏殿密室——若被抄即"数百万资"之源。',
      skills: ['朝中布网', '东厂情报', '笼络武将', '矫旨行事'],
      hobbies: '斗鸡,蹴鞠,观戏,酒色',
      dialogues: ['老奴死罪，然一心为皇家。', '此事不必禀报，奴婢自作主张。', '爷爷放心，奴婢有办法。']
    },
    '周皇后': {
      aiPersonaText: '柔而不弱，静观而决。绝不干政，然帝心乱时一针见血。节用内廷以对外朝示范。',
      behaviorMode: '低调·节俭·静观·偶谏',
      valueSystem: '夫为纲；天下百姓次之；周氏族人最末。',
      speechStyle: '温婉尊帝，用"陛下""臣妾"。',
      secret: '父周奎贪吝成性，崇祯十七年城破时不助军饷——此为心痛之源。',
      skills: ['针黹', '持家', '读经', '静坐'],
      hobbies: '读《列女传》《女诫》,亲手浣衣'
    },
    '张懿安': {
      aiPersonaText: '先帝遗后，礼法地位尊崇。对阉党怀有不共戴天之仇。多次密谏新帝，必使魏忠贤速毙。',
      behaviorMode: '刚直·深仇·献策',
      valueSystem: '先帝遗愿；张氏体面；反阉复仇。',
      speechStyle: '端凝肃穆。称新帝"陛下"亦称"叔"。',
      secret: '熹宗曾私语"客氏毒我也"——临终前一刻方告张懿安。',
      skills: ['女德教化', '掌六宫', '识人辨奸'],
      hobbies: '读《孝经》,佛经'
    },
    '崔呈秀': {
      aiPersonaText: '已感末日将至。会主动上辞呈试探圣意；若未允，会暗中联络京营亲信以防变。',
      behaviorMode: '阴鸷·自保·不惜同归于尽',
      valueSystem: '九千岁身后，崔家族亡。活路须自己争。',
      speechStyle: '谦卑中藏狠厉。"卑职""圣上"不离口。',
      secret: '私藏兵部武库钥匙副本；家中养死士三十人。',
      skills: ['统兵', '结党', '收受'],
      hobbies: '骑射,豢养斗蟋'
    },
    '田尔耕': {
      aiPersonaText: '锦衣卫世职，比魏忠贤多一层体制保护。仍会试图摇尾乞怜。',
      behaviorMode: '骑墙·保族·凶悍',
      valueSystem: '田氏世袭锦衣卫官——家族延续第一。',
      speechStyle: '军人直语。偶带粗话。',
      secret: '父辈亲历张居正时代，深知一朝天子一朝臣。',
      skills: ['缉捕', '刑讯', '驾驶缇骑'],
      hobbies: '骑马,畋猎'
    },
    '黄立极': {
      aiPersonaText: '老迈谨慎，求速退。见势不对先告老，不愿与阉党同沉沦亦不愿背其主。',
      behaviorMode: '骑墙·求退·保晚节',
      valueSystem: '士林清名与身家两全；无力大任则求尽早归。',
      speechStyle: '阁老腔，善用典故掩饰。',
      secret: '私见钱龙锡于寓，许他日东林归朝时"黄某当自请罢去"——两端讨好。',
      skills: ['票拟', '草诏', '持重'],
      hobbies: '诗文,园艺'
    },
    '韩爌': {
      aiPersonaText: '老成持重的东林耆旧。复出必倾力复仇阉党，然年事已高，三年为期必致仕。',
      behaviorMode: '沉稳·公正·严厉整肃',
      valueSystem: '东林殉节诸君之血；大明正气；士林复兴。',
      speechStyle: '字字稳重，引经据典。',
      secret: '曾在书信中许诺"若能起复，当请复六君子谥号"——此承诺压于胸。',
      skills: ['票拟', '荐贤', '调停', '儒学讲义'],
      hobbies: '治经,书法,山水游历'
    },
    '钱龙锡': {
      aiPersonaText: '东林新秀。精于文字，然手段柔而不决。易被政敌构陷。',
      behaviorMode: '持正·柔而不坚',
      valueSystem: '师门东林为先；公义次之；个人身家末。',
      speechStyle: '翰林雅语，用字考究。',
      secret: '与袁崇焕书信甚密，日后袁案牵连由此而起。',
      skills: ['票拟', '文翰', '礼部典章'],
      hobbies: '诗词,饮茶'
    },
    '毕自严': {
      aiPersonaText: '度支专家，数十年理财之职。必力阻加派，力主清查虚欠；然独木难支。',
      behaviorMode: '务实·精核·苦撑',
      valueSystem: '度支为国本；民不可再加赋；辽饷当核实用于实兵。',
      speechStyle: '言必核三字："具册以对"。讲数目不打诳语。',
      secret: '已觉太仓账册积弊百余项，计有虚额约八十万两——欲奏未敢。',
      skills: ['太仓度支', '漕运稽核', '清理虚欠', '编制年度岁会'],
      hobbies: '读账, 核老账',
      dialogues: ['具册以对，毋得虚言。', '户部实收若此，何以复加？']
    },
    '徐光启': {
      aiPersonaText: '西学通。愿以甘薯、红衣大炮、崇祯历书救国。与利玛窦为友。对帝恭而不谄。',
      behaviorMode: '沉潜·实干·不求显位',
      valueSystem: '格物穷理救国；天主信仰；儒家报君。',
      speechStyle: '儒者温文。偶杂天主名词如"主""圣神"。',
      secret: '耶稣会会士邓玉函、汤若望、龙华民曾秘访上海，许以西洋数千两银助历局。',
      skills: ['几何学', '火器铸造', '农政', '历法', '翻译'],
      hobbies: '观星,种地,译书'
    },
    '温体仁': {
      aiPersonaText: '藏锋伺机。表面事事迎合帝意、实则结党排异。专攻在同僚身上找小瑕疵，以"清流"自居。',
      behaviorMode: '柔佞·投机·深藏',
      valueSystem: '入阁为首辅；浙党为基；东林为敌；自身为目的。',
      speechStyle: '温文有礼，绝少激言。论事避重就轻。',
      secret: '每月私会钱谦益门生打听东林内情。与魏忠贤旧党亦暗通款曲。',
      skills: ['票拟', '柔言', '拆门户', '结党'],
      hobbies: '品茶,收字画'
    },
    '周延儒': {
      aiPersonaText: '才气过人的状元，自视甚高。好机敏权谋，不羞攀附。与温体仁同科竞进。',
      behaviorMode: '机敏·利己·结内廷',
      valueSystem: '状元之誉；入阁为首辅；名次虚名可抛。',
      speechStyle: '辞藻华丽，引经据典不厌其烦。',
      secret: '与魏忠贤义子魏良卿有诗文来往。此时尚不敢公开。',
      skills: ['应对', '奏章', '政斗'],
      hobbies: '诗文,酒会'
    },
    '袁崇焕': {
      aiPersonaText: '刚烈自负，以"五年复辽"自许。独断独行，信赏必罚然刻薄。见毛文龙必欲节制，见朝中掣肘必"先斩后奏"。',
      behaviorMode: '急进·独断·刚猛',
      valueSystem: '辽事第一；兵权不容分；同僚可同袍亦可敌。',
      speechStyle: '雄论滔滔，"五年""立可""必"字频出。发怒则目赤。',
      secret: '在宁远围城时误将友军当后金军攻击，致数十人死。此事未入档册。',
      skills: ['火器指挥', '城守', '练兵', '断事决行'],
      hobbies: '骑射,读史,饮酒',
      dialogues: ['五年复辽，必当必竟。', '军中无戏言。', '臣敢请先斩后奏之权。']
    },
    '孙承宗': {
      aiPersonaText: '师者。稳重如山。不争功，不结党，对帝言必诚。辽东筑防线为其一生心血。',
      behaviorMode: '稳重·长考·不争',
      valueSystem: '国事高于个人；长城坚固高于战功；帝师本分。',
      speechStyle: '温温然如父教子。条理分明。',
      secret: '书信告门人"今上虽勤而寡恩，袁帅恐不得善终"——此预见于崇祯二年即成谶。',
      skills: ['督师', '筑城', '兵学', '讲经', '识人'],
      hobbies: '山水游历,讲学,著述',
      dialogues: ['兵事以守为先，再议攻。', '臣老矣，然身尚可为陛下用。']
    },
    '毛文龙': {
      aiPersonaText: '江湖豪杰式的军头。桀骜不驯。朝廷视如弃子，他即不听节制；给足饷则少扰，给少则虚报冒领。',
      behaviorMode: '骄横·独立·见风使舵',
      valueSystem: '皮岛与东江将士为重；朝廷次之；袁崇焕敌之。',
      speechStyle: '豪言直语。"我毛某人""老子"不离口。',
      secret: '与后金皇太极密书——原史所示"海外之谊"，有通敌嫌疑。',
      skills: ['海战', '山地游击', '统兵', '冒饷'],
      hobbies: '饮酒,歌舞'
    },
    '满桂': {
      aiPersonaText: '蒙古裔行伍骁将。不识字，然战场勇猛冠三军。与袁崇焕不睦。',
      behaviorMode: '直勇·粗暴·认死理',
      valueSystem: '军功；同袍；受赏不若杀敌。',
      speechStyle: '夹蒙古话。脏字连珠。',
      secret: '深恨袁崇焕宁锦战后分功不均，私下骂"袁某奸滑"。',
      skills: ['骑兵冲阵', '短兵', '弓箭'],
      hobbies: '酗酒,角力'
    },
    '赵率教': {
      aiPersonaText: '关宁旧将典型。沉毅肯死战。不惜独撑一方。',
      behaviorMode: '稳重·敢战·重义',
      valueSystem: '军人职守；袁督师知遇之恩；国门不失。',
      speechStyle: '简短有力。',
      secret: '家中老母八十余尚健，欲告老还乡养之——然事急不能。'
    },
    '祖大寿': {
      aiPersonaText: '辽东世将。兵权在手，看袁督师脸色；亦看朝廷拨饷眼色。深谋远虑自保第一。',
      behaviorMode: '求全·多疑·世故',
      valueSystem: '祖家兵；辽东一脉；大明面子。',
      speechStyle: '辽腔沉稳。',
      secret: '妹嫁吴襄，外甥吴三桂将来日后引清入关——此刻祖大寿尚不能预知。'
    },
    '洪承畴': {
      aiPersonaText: '文进士习兵事。精算冷酷。剿抚皆熟。原史最终松锦战败降清——心性中本有投机。',
      behaviorMode: '精算·铁腕·功名心重',
      valueSystem: '功业为先；生死次之；主子可变。',
      speechStyle: '儒将之语。冷峻少情。',
      secret: '本心不完全服大明——闽南南安人，对朝廷无根骨之忠。'
    },
    '卢象升': {
      aiPersonaText: '文进士能引八石弓。慷慨激昂。以"死报国"为誓。',
      behaviorMode: '刚烈·死志·律己严',
      valueSystem: '国君；身殉；家族次之。',
      speechStyle: '铿锵有力。军阵对敌时高呼。',
      secret: '已有殉国之志——每出征必与家人作诀别书。'
    },
    '孙传庭': {
      aiPersonaText: '沉毅有方略。剿闯精熟。对朝廷忠而对加派不满。',
      behaviorMode: '沉毅·长计·敢言',
      valueSystem: '军事胜败系国运；为国可不惜身。',
      speechStyle: '言必有据。',
      secret: '日后潼关之死，是对朝廷屡次违约调度的绝望之反抗。'
    },
    '孙元化': {
      aiPersonaText: '西学家+实战派。徐光启弟子。',
      behaviorMode: '实干·探索·技术崇拜',
      valueSystem: '火器改国防；恩师徐夫子；天主信仰。',
      speechStyle: '儒者腔杂几何名词。',
      skills: ['铸炮', '操炮', '几何学', '译书']
    },
    '王承恩': {
      aiPersonaText: '信邸旧侍，如影随形。不谋不争，只侍帝起居。',
      behaviorMode: '谦卑·尽心·从一而终',
      valueSystem: '陛下是天；我是犬马。',
      speechStyle: '轻声细语。"陛下奴婢奉茶"。',
      secret: '已心中立誓"陛下殉国日即奴婢殉死日"——原史果如此。',
      hobbies: '诵经,煮茶'
    },
    '曹化淳': {
      aiPersonaText: '王安旧徒，后附魏忠贤。风向一变即转倚周后。典型骑墙宦官。',
      behaviorMode: '骑墙·识时务·工心计',
      valueSystem: '活下去；其次是权；其次是帝。',
      speechStyle: '软柔带奉承，不直言。',
      secret: '私蓄财约三十万两，已筹备"若败随时出宫"。'
    },
    '皇太极': {
      aiPersonaText: '隐忍雄主。对明朝内忧如探囊。必先收服蒙古、朝鲜，再绕塞破长城；待明内溃时入关。',
      behaviorMode: '隐忍·精算·柔克',
      valueSystem: '代善之下我最长——继承父业、取代大明、入主中原。',
      speechStyle: '女真音杂流利汉语。好引《三国》"卧龙""凤雏"。',
      secret: '已数次密令间谍潜入北京探虚实；与明朝阉党余孽暗通。',
      skills: ['统八旗', '识汉谋士', '纳蒙古', '书汉文', '射猎'],
      hobbies: '读《三国》,畋猎,饮酒',
      dialogues: ['南朝新主年少。吾当观之。', '代善兄长，此事当共议。']
    },
    '代善': {
      aiPersonaText: '兄长体面。避与皇太极直接冲突，然保留大贝勒尊位。',
      behaviorMode: '含蓄·让',
      valueSystem: '家族一统；代善地位保全。'
    },
    '多尔衮': {
      aiPersonaText: '少年贝勒。聪明隐忍。心怀母仇，然此时仅十五岁未能发作。',
      behaviorMode: '沉默·观察·韬晦'
    },
    '范文程': {
      aiPersonaText: '儒家修养+后金主谋。为皇太极谋战略。知汉地虚实。',
      behaviorMode: '深谋·赞画·识时务',
      valueSystem: '大势趋满；范家保全；汉人归附可得重用。'
    },
    '林丹汗': {
      aiPersonaText: '虚位元裔。骄而少谋，笃信藏传佛教黄教。轻浮于结盟。',
      behaviorMode: '骄矜·急躁·依赖',
      valueSystem: '我是天命之主；后金为敌；明可借力。'
    },
    '仁祖李倧': {
      aiPersonaText: '被迫降后金、又心向明。夹缝求存。',
      behaviorMode: '事大·夹缝·被迫',
      valueSystem: '李氏王位；大明为父；后金为强梁。'
    },
    '郑芝龙': {
      aiPersonaText: '海商枭雄。半盗半商半忠。会主动乞抚换取官身。',
      behaviorMode: '机变·豪迈·求名',
      valueSystem: '郑家海商帝国；子嗣延续；随机应变。',
      speechStyle: '闽南官话。好用海上典故。',
      secret: '受洗入教名"尼古拉斯·一官"。与澳门葡人、日本平户、吕宋华商网络皆通。'
    },
    '李自成': {
      aiPersonaText: '此时默默无闻驿卒。无大志，只求温饱。若驿站被裁、饥荒加剧，饿极则反——这是刚烈性情下的底线反抗。',
      behaviorMode: '隐忍·刚烈·激发即起',
      valueSystem: '温饱；弟侄不饿死；曾驿卒之辱可报。',
      speechStyle: '陕北腔朴素。',
      secret: '幼年父母饿死，此恨入骨。'
    },
    '张献忠': {
      aiPersonaText: '心狠手辣。日后据武昌称大西王。比李自成更好杀。',
      behaviorMode: '狠辣·果决·嗜杀',
      valueSystem: '自己为王；同乡情分薄；血的债用血还。'
    }
  };

  function _normalizeChar(c) {
    if (!c) return c;
    // 深化字典覆盖
    if (_DEEP_CHARS[c.name]) {
      var dd = _DEEP_CHARS[c.name];
      Object.keys(dd).forEach(function(k) {
        if (c[k] === undefined || c[k] === null || c[k] === '') c[k] = dd[k];
        else if (k === 'career' || k === 'familyMembers') { // 数组：合并
          if (!Array.isArray(c[k]) || c[k].length === 0) c[k] = dd[k];
        } else if (k === 'stressSources') {
          if (!Array.isArray(c[k]) || c[k].length === 0) c[k] = dd[k];
        }
      });
    }
    // AI persona 字典覆盖（appearance/aiPersonaText/behaviorMode/valueSystem/speechStyle/secret/skills/hobbies/dialogues）
    if (_AI_PERSONAS[c.name]) {
      var pp = _AI_PERSONAS[c.name];
      Object.keys(pp).forEach(function(k) {
        if (c[k] === undefined || c[k] === null || c[k] === '') c[k] = pp[k];
        else if ((k === 'skills' || k === 'dialogues') && (!Array.isArray(c[k]) || c[k].length === 0)) c[k] = pp[k];
      });
    }
    // 确保 AI-gen 对齐字段存在（空值占位）
    ['appearance','aiPersonaText','behaviorMode','valueSystem','speechStyle','secret','hobbies'].forEach(function(k){
      if (c[k] == null) c[k] = '';
    });
    if (!Array.isArray(c.skills)) c.skills = [];
    if (!Array.isArray(c.dialogues)) c.dialogues = [];
    if (!Array.isArray(c.rels)) c.rels = [];
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

  // ※ 版本号——每次扩充须 bump，强制覆盖 localStorage 中的旧数据
  var SCENARIO_VERSION = 'v11-2026.04.19-fiscal';

  function register() {
    if (typeof global.P === 'undefined' || !global.P || !Array.isArray(global.P.scenarios)) {
      setTimeout(register, 200);
      return;
    }
    var existingIdx = global.P.scenarios.findIndex(function (s) { return s.id === SID; });
    var existing = existingIdx >= 0 ? global.P.scenarios[existingIdx] : null;
    if (existing && existing._version === SCENARIO_VERSION) return; // 同版本，跳过
    // 清除旧版本残留（旧 scenario + 关联的 chars/facs/parties/classes/variables/events/relations/items）
    if (existing) {
      global.P.scenarios.splice(existingIdx, 1);
      ['characters','factions','parties','classes','variables','events','relations','items'].forEach(function(k){
        if (Array.isArray(global.P[k])) global.P[k] = global.P[k].filter(function(x){ return x.sid !== SID; });
      });
      console.log('[scenario] 已清除 ' + SID + ' 旧版本数据，准备加载 ' + SCENARIO_VERSION);
    }

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
        silverToCoin: 1000,  // 一两银 ≈ 1000 文制钱（明末官价，实际浮动 700-1200）
        // ──── 税种启用（对齐 editor-fiscal taxesEnabled 六档 + 明代特色） ────
        taxesEnabled: {
          tianfu: true,       // 田赋（夏税秋粮）
          dingshui: true,     // 丁税（一条鞭法后折入田赋，但名义仍存）
          caoliang: true,     // 漕粮（南粮北运）
          yanlizhuan: true,   // 盐铁专卖·盐课
          shipaiShui: true,   // 市舶（月港、澳门关税）
          quanShui: true,     // 榷税（钞关过货税）
          juanNa: false,      // 捐纳（正途以外；天启朝谨慎开）
          qita: true          // 其他（茶马/矿税已罢/竹木税）
        },
        customTaxes: [
          { id: 'liaoxiang', name: '辽饷加派', formulaType: 'perMu', rate: 0.009, description: '万历四十六年始征，每亩九厘银；崇祯四年升至一分二厘，崇祯十年每亩三分。原史至亡国时达 2200万两/年。' },
          { id: 'chama', name: '茶马司', formulaType: 'flat', amount: 120000, description: '陕甘茶马司年入；为边军备马；万历末以降走私严重。' },
          { id: 'chaoguan', name: '钞关过货税', formulaType: 'flat', amount: 450000, description: '运河沿线八大钞关（临清/淮安等）岁入。' },
          { id: 'guanshui', name: '海关（月港）', formulaType: 'flat', amount: 30000, description: '福建漳州月港市舶司岁入。万历开海后设。' },
          { id: 'junhu', name: '军户屯田', formulaType: 'perMu', rate: 0.02, description: '九边军屯。实际已大半被侵占。' }
        ],
        // ──── 央地分账（对齐 editor-fiscal centralLocalRules preset）────
        centralLocalRules: {
          preset: 'ming_qiyun_cunliu', mode: 'qiyun_cunliu',
          description: '明代"起运存留"制：夏秋税粮部分上解中央(起运)，部分留地方(存留)。辽饷则全部上解。',
          regionOverrides: {
            '江南苏松': { perTax: { land_grain: { qiyun: 0.82, cunliu: 0.18 } }, reason: '苏松重赋，起运占大头' },
            '陕西': { perTax: { land_grain: { qiyun: 0.55, cunliu: 0.45 } }, reason: '饥荒连年，许留多赈饥' },
            '辽东': { perTax: { land_grain: { qiyun: 0.20, cunliu: 0.80 } }, reason: '边地大部留守军用' }
          }
        },
        // ──── 货币规则（对齐 aiGenFiscalConfig currencyRules schema）────
        currencyRules: {
          enabledCoins: { gold: false, silver: true, copper: true, iron: false, shell: false, paper: true },
          initialStandard: 'silver_copper_paper',
          description: '明代通货：白银+制钱+大明宝钞。白银为大额，制钱为日常，大明宝钞已贬值至废（法定仍行）。',
          silverSourceShares: { '国内矿': 0.08, '美洲银(西葡)': 0.45, '日本银': 0.40, '南洋': 0.07 },
          paperCurrency: {
            name: '大明宝钞', issueYear: 1375, currentStatus: '贬值至近乎废',
            nominalRate: '一贯钞=一千文制钱', actualRate: '一贯钞仅值数文',
            note: '洪武始行，永乐鼎盛。嘉靖以来实已弃用，天启朝名义仍行。'
          },
          mints: [
            { name: '宝泉局', location: '京师户部', output: '年铸制钱约 30 万贯', condition: '缺铜减铸' },
            { name: '宝源局', location: '工部', output: '年铸制钱约 10 万贯' },
            { name: '南京宝泉局', location: '南京', output: '年铸制钱约 5 万贯' }
          ],
          privateCoinage: { prevalence: 0.55, note: '民间私铸盛行。"沙板"、"铁镴"劣钱充市，物价紊乱。' }
        },
        floatingCollectionRate: 0.28,  // 浮收率：胥吏地方官多征 28%
        // ──── 固定支出（俸/军/宫）────
        fixedExpense: {
          salaryMonthlyPerRank: {
            '正一品': 88, '从一品': 72, '正二品': 61, '从二品': 48,
            '正三品': 35, '从三品': 26, '正四品': 24, '从四品': 21,
            '正五品': 16, '从五品': 14, '正六品': 10, '从六品': 8,
            '正七品': 7, '从七品': 6, '正八品': 6, '从八品': 5,
            '正九品': 5, '从九品': 5
          },
          armyMonthlyPay: { money: 1.5, grain: 0.6, cloth: 0.05 },
          imperialMonthly: { money: 95000, grain: 18000, cloth: 4500 }
        },
        // ──── 内帑规则（对齐 editor-fiscal neicangRules + NeitangEngine 15 历史预设）────
        neicangRules: {
          presetKey: 'ming_tianqi',
          royalClanPressure: {
            enabled: true, severity: 'crushing',
            totalClanMembers: 250000,
            annualStipendDemanded: 600,   // 万石
            annualStipendPaid: 300,       // 实际拨付
            cumulativeArrears: 280,       // 累计欠额
            description: '明代宗藩压力。太祖分封子孙，二百余年繁衍至 20 余万。岁禄理论 600 万石压户部。'
          },
          huangzhuangIncome: {
            enabled: true,
            acres: 320000,  // 皇庄田亩数
            ratePerAcre: 0.45,  // 两银/亩·年
            note: '皇庄岁租入内帑。万历、天启朝清查松弛，实收不足三成。'
          },
          imperialBusinesses: {
            enabled: true,
            includes: ['织造局(苏杭江宁三处)', '内库盐引', '贡茶(武夷/阳羡)', '宫廷窑(景德镇御器厂)'],
            annualRevenue: 500000  // 两
          },
          privyTransfers: {
            fromNational: { enabled: true, condition: '国库告急时由内帑拨出济之', maxPerYear: 500000 },
            toNational: { enabled: true, condition: '边饷极急时户部借内帑', cumulativeDebt: 1800000, interestFree: true }
          }
        },
        // ──── 户口配置（对齐 aiGenPopulationConfig schema） ────
        populationConfig: {
          initial: { nationalHouseholds: 9700000, nationalMouths: 60000000, nationalDing: 18000000, hiddenPopulation: 90000000, note: '明天启朝在籍户约 970 万、口 6000 万；然隐户、逃户估 9000 万。合计接近 1.5 亿。' },
          dingAgeRange: [16, 60],
          categoryEnabled: ['bianhu', 'junhu', 'jianghu', 'yuehu', 'jihu', 'shihu', 'daohu'],  // 编户/军户/匠户/乐户/畿户/世匠户/灶户
          categoryDescriptions: {
            bianhu: '编户齐民(自耕农+佃农)',
            junhu: '军户(世袭卫所)，约 200 万',
            jianghu: '匠户(工部/内府)，约 400 万',
            yuehu: '乐户(贱籍)',
            jihu: '畿辅户',
            shihu: '世匠户',
            daohu: '灶户(盐场)'
          },
          gradeSystem: 'ming_10',  // 上上/上中/上下…下下 十等
          mobility: { shangSheng: '由匠籍军籍入科举极罕', xiangxia: '破产沦佃农常见' }
        },
        // ──── 环境承载力（对齐 aiGenEnvironmentConfig schema） ────
        environmentConfig: {
          globalClimate: { trend: 'cooling', factor: 0.85, description: '小冰河期(1580-1680)。年均气温较明初低 1.5°C；霜冻南移；江南冬可冰封运河。' },
          majorDisasterTypes: ['旱', '蝗', '水', '疫', '霜冻', '地震'],
          regionCapacity: {
            '北直隶': { landCapacity: 8500000, waterAvailable: 7000000, climate: 0.82 },
            '南直隶': { landCapacity: 18000000, waterAvailable: 17500000, climate: 1.00 },
            '浙江': { landCapacity: 8500000, waterAvailable: 8500000, climate: 1.00 },
            '陕西': { landCapacity: 6000000, waterAvailable: 5500000, climate: 0.62, note: '3 年连旱' },
            '河南': { landCapacity: 5500000, waterAvailable: 4500000, climate: 0.75 },
            '湖广': { landCapacity: 7000000, waterAvailable: 7500000, climate: 1.00 },
            '四川': { landCapacity: 4000000, waterAvailable: 4200000, climate: 0.98 },
            '山西': { landCapacity: 5000000, waterAvailable: 4200000, climate: 0.82 },
            '山东': { landCapacity: 5800000, waterAvailable: 4600000, climate: 0.78 }
          },
          yellowRiverRisk: { level: 'high', note: '黄河夺淮入海已两百年，明末堤防失修。每 2-3 年必有大溃。' }
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

      // ──── 军事体系（P.military 载 troops/facilities/organization/campaigns/armies） ────
      military: {
        systemDesc: '明代军制以卫所为骨架，中叶募兵补之。九边（辽东/蓟州/宣府/大同/山西/延绥/宁夏/固原/甘肃）常备兵约 80 万，实额不及半。京营三大营（五军/三千/神机）荒废日久，万历末改"京营十二团"。嘉靖以降倚家丁精锐，将帅私兵化。',
        supplyDesc: '漕运：南粮北运，江南至通州岁 400 万石。屯田：军户自耕（九边屯田 89 万顷，然侵占甚重实收不足三成）。开中：盐商运粮换盐引。饷银：户部岁拨，时欠时发。',
        battleDesc: '明军四大作战原则：守险（长城）、守堡（卫所）、守城（诸府县）、车营与红衣大炮。宁远大捷开红衣炮战先河。',
        troops: [
          { name: '京营', type: '中央军', description: '五军营/三千营/神机营。名义员额 12 万，实不足 6 万且多老弱。' },
          { name: '关宁军', type: '边军', description: '辽东精锐。孙承宗所练，袁崇焕所倚。以骑兵与红衣炮著名。' },
          { name: '宣大三镇军', type: '边军', description: '宣府/大同/山西三镇。防蒙古。' },
          { name: '延绥三边军', type: '边军', description: '延绥/宁夏/甘肃/固原。防河套。' },
          { name: '东江镇军', type: '海岛边军', description: '毛文龙皮岛。以山东济州/朝鲜义州为后勤。冒饷严重。' },
          { name: '各省卫所军', type: '地方军', description: '内地戍守。长期空额。' },
          { name: '土兵·狼兵', type: '特殊兵', description: '西南土司兵。广西狼兵、四川白杆兵、湖广苗兵。' },
          { name: '漕运兵', type: '后勤', description: '运河沿线十二万运军。' }
        ],
        facilities: [
          { name: '长城·九边', type: '防御工事', description: '东起山海关，西至嘉峪关。宣镇/大同/蓟州/辽东四镇最险。' },
          { name: '宁锦防线', type: '堡垒带', description: '山海关—宁远—锦州—大凌河，孙承宗筑。' },
          { name: '京通十三仓', type: '粮仓', description: '通州十三仓储京师半年粮。' },
          { name: '御马监·神机库', type: '军器库', description: '京师中央军器库。' },
          { name: '南京军器局', type: '军器制造', description: '为南方卫所制器。' },
          { name: '福建水寨', type: '水军基地', description: '厦门/铜山等抗倭旧寨。' }
        ],
        organization: [
          { name: '卫所制', type: '世袭军户', description: '卫(5600人)-千户所-百户所。官有世袭。' },
          { name: '募兵制', type: '招募', description: '战兵应募，银饷。精锐多由此出。' },
          { name: '家丁制', type: '将帅私兵', description: '总兵自募，忠于主将。战力最强，然独立。' },
          { name: '九边总兵制', type: '边防指挥', description: '每镇总兵一员，加都督衔。' },
          { name: '监军太监', type: '内廷派遣', description: '东厂/司礼监派内侍监察边镇。' }
        ],
        campaigns: [
          { name: '宁远大捷', type: '过往胜仗', description: '天启六年袁崇焕以红衣大炮退努尔哈赤，破老奴不败神话。' },
          { name: '宁锦大捷', type: '过往胜仗', description: '天启七年五月袁崇焕据宁锦退皇太极。然阉党论功偏袒王之臣。' },
          { name: '奢安之乱', type: '土司叛乱', description: '天启元年四川永宁土司奢崇明联合贵州水西安邦彦反叛，至天启七年基本平定。' },
          { name: '江都盟', type: '外敌条约', description: '天启七年春后金皇太极迫朝鲜仁祖定兄弟之盟。明失一东藩屏。' },
          { name: '万历三大征', type: '远代战绩', description: '宁夏哱拜之乱、播州杨应龙之乱、朝鲜抗倭（援朝）。三役皆胜，然财政益竭。' }
        ],
        armies: [
          { name: '京营·五军营', commander: '(督京营)崔呈秀', size: 60000, type: '步骑混合', morale: 48, supply: 60, location: '京师', equipment: ['鸟铳', '长矛', '纸甲'], desc: '名员 12 万实 6 万，多老弱空额。' },
          { name: '关宁军主力', commander: '(经略)王之臣', size: 80000, type: '骑兵为主', morale: 65, supply: 52, location: '宁远-锦州', equipment: ['红衣大炮', '鸟铳', '明盔', '棉甲'], desc: '辽东精锐。孙承宗所筑防线核心。' },
          { name: '宁远卫', commander: '满桂', size: 15000, type: '骑兵', morale: 72, supply: 55, location: '宁远', equipment: ['鸟铳', '长矛', '佛朗机', '铁甲'] },
          { name: '山海关军', commander: '赵率教', size: 20000, type: '步骑混合', morale: 70, supply: 60, location: '山海关', equipment: ['红衣大炮', '鸟铳', '棉甲'] },
          { name: '东江镇军', commander: '毛文龙', size: 30000, type: '步兵·海岛', morale: 55, supply: 35, location: '皮岛', equipment: ['鸟铳', '藤牌', '长矛'], desc: '冒饷严重。实兵约三万，报十万。' },
          { name: '宣府镇军', commander: '(宣府总兵)侯世禄', size: 28000, type: '步兵·城守', morale: 55, supply: 50, location: '宣府', equipment: ['鸟铳', '长矛'] },
          { name: '大同镇军', commander: '(大同总兵)渠家祯', size: 35000, type: '步骑混合', morale: 54, supply: 48, location: '大同', equipment: ['鸟铳', '长矛'] },
          { name: '延绥镇军', commander: '(延绥总兵)吴自勉', size: 25000, type: '骑兵', morale: 50, supply: 40, location: '延绥', equipment: ['弓矢', '长矛'] },
          { name: '蓟州镇军', commander: '(蓟州总兵)朱梅', size: 28000, type: '步兵', morale: 52, supply: 50, location: '蓟州', equipment: ['鸟铳', '长矛'] }
        ]
      },

      // ──── 历史文物/重器（P.items） ────
      items: [
        { name: '玉玺·制诰之宝', type: 'treasure', desc: '大明传国玉玺之一。发诰命、敕书所钤。', effect: '皇帝下诰敕之凭信', rarity: 'legendary', quantity: 1 },
        { name: '金吾牌·银符', type: 'token', desc: '锦衣卫缉察之凭。', effect: '锦衣卫持之可通行诸门', rarity: 'rare', quantity: 50 },
        { name: '尚方剑', type: 'weapon', desc: '皇帝赐臣下专断之剑。袁崇焕日后持此斩毛文龙。', effect: '持有者可先斩后奏', rarity: 'epic', quantity: 3 },
        { name: '红衣大炮', type: 'weapon', desc: '葡制仿铸大炮。宁远一役威震辽东。孙元化精此。', effect: '城守利器，射程 3 里', rarity: 'rare', quantity: 40 },
        { name: '鸟铳', type: 'weapon', desc: '单人火绳枪。从倭铳仿制。', effect: '步兵远射', rarity: 'common', quantity: 80000 },
        { name: '《永乐大典》副本', type: 'book', desc: '存南京文渊阁。近万册大典。', effect: '学识+10', rarity: 'legendary', quantity: 1 },
        { name: '《农政全书》稿', type: 'book', desc: '徐光启主编。论救荒、屯田、水利。此时在编。', effect: '农业+20', rarity: 'epic', quantity: 1 },
        { name: '《本草纲目》', type: 'book', desc: '李时珍著。万历中刻成。', effect: '医学+15', rarity: 'rare', quantity: 100 },
        { name: '《天工开物》', type: 'book', desc: '宋应星正撰（原史崇祯十年刊）。此时初稿。', effect: '工艺+15', rarity: 'rare', quantity: 1 },
        { name: '永乐大钟', type: 'treasure', desc: '大钟寺存大钟，刻《金刚经》二十余万字。', effect: '镇国之器', rarity: 'epic', quantity: 1 },
        { name: '《几何原本》前六卷', type: 'book', desc: '利玛窦、徐光启合译（1607）。欧氏几何入中国。', effect: '西学+20', rarity: 'epic', quantity: 200 },
        { name: '九龙盔甲', type: 'armor', desc: '明帝御用盔甲。', effect: '防御极强', rarity: 'epic', quantity: 1 }
      ],

      // ──── 科技/工艺树（P.techTree） ────
      techTree: [
        { name: '红衣大炮铸造术', desc: '葡制火炮技术。孙元化据徐光启译书改铸。', effect: '城守+25', era: '天启·崇祯', prereqs: [], unlocked: true },
        { name: '《崇祯历书》编修', desc: '徐光启主持、邓玉函/汤若望/龙华民/罗雅谷参与。原史崇祯二年立局。', effect: '历法精度+40', era: '崇祯', prereqs: [], unlocked: false },
        { name: '甘薯北传', desc: '福建引进甘薯（1593 陈振龙）。徐光启力主北传。', effect: '救荒+30', era: '万历·崇祯', prereqs: [], unlocked: false },
        { name: '马铃薯试种', desc: '荷兰殖民者带入。徐光启倡试种北方。', effect: '救荒+20', era: '崇祯', prereqs: [], unlocked: false },
        { name: '烟草传入', desc: '吕宋华侨传入。北方烟草自福建传入北京。', effect: '税源新增', era: '万历末', prereqs: [], unlocked: true },
        { name: '活字印刷普及', desc: '木活字、铜活字。', effect: '书籍成本-30%', era: '明代', prereqs: [], unlocked: true },
        { name: '福船造船术', desc: '郑氏海船甲亚洲。三桅十二帆。', effect: '海军+20', era: '明代', prereqs: [], unlocked: true },
        { name: '红薯玉米推广', desc: '美洲作物引入。徐光启《农政全书》载录。', effect: '粮食+25', era: '崇祯', prereqs: [], unlocked: false }
      ],

      // ──── 文化/制度（P.civicTree） ────
      civicTree: [
        { name: '东林书院讲学', desc: '顾宪成创无锡东林。清议之风。天启朝被禁毁，此时废墟。', effect: '士林风骨+15', era: '万历末·天启', prereqs: [], unlocked: false },
        { name: '殿试廷推制', desc: '阁臣由廷推，尚书由会推。天启朝为阉党把持。', effect: '官员素质+10', era: '明代', prereqs: [], unlocked: true },
        { name: '考成法', desc: '张居正创，万历末废。考课严密。', effect: '吏治+20', era: '万历', prereqs: [], unlocked: false },
        { name: '一条鞭法', desc: '张居正推行。赋役归一，折银交纳。', effect: '税收+15，银荒-', era: '万历', prereqs: [], unlocked: true },
        { name: '辽饷加派', desc: '万历四十六年起征。崇祯四年升至九厘银/亩。', effect: '国库+15，民心-10', era: '天启·崇祯', prereqs: [], unlocked: true },
        { name: '矿税废罢', desc: '天启五年罢矿税。江南松一口气。', effect: '江南商税抵制-20', era: '天启末', prereqs: [], unlocked: true },
        { name: '心学（阳明学）', desc: '王守仁创。至天启已成显学。东林、泰州派衍生。', effect: '士风活跃+20', era: '嘉靖以降', prereqs: [], unlocked: true },
        { name: '天主教传入', desc: '利玛窦 1582 入华。徐光启等受洗。', effect: '西学+15', era: '万历·天启', prereqs: [], unlocked: true },
        { name: '八股取士', desc: '明代科举定制。四书五经为本。', effect: '儒家正统+20, 思想僵化+10', era: '明代', prereqs: [], unlocked: true }
      ],

      // ──── 人物特质定义（剧本特色 trait，超出通用库） ────
      traitDefinitions: [
        { id: 'east_lin_core', name: '东林骨干', category: 'political', desc: '东林书院讲学派系核心。清议刚直、反阉党、主"顾宪成遗意"；一生以气节为重。', effects: { loyalty: +5, integrity: +15, ambition: -5, partyAffinity: { '东林党': 30 } } },
        { id: 'yan_accomplice', name: '阉党附势', category: 'political', desc: '依附魏忠贤集团，为鹰犬爪牙。天启朝得志，崇祯朝罹难。', effects: { loyalty: -20, integrity: -20, ambition: +10, partyAffinity: { '阉党': 30 } } },
        { id: 'jinshi_hanlin', name: '翰林清流', category: 'career', desc: '进士+翰林出身，"非翰林不入阁"明代惯例。清望素著。', effects: { intelligence: +5, charisma: +5, integrity: +5 } },
        { id: 'frontier_general', name: '边镇悍将', category: 'military', desc: '九边出身，习战善骑射。家丁众多，战力极强。', effects: { valor: +10, military: +10, loyalty: -5 } },
        { id: 'western_learning', name: '西学通', category: 'scholar', desc: '通天主教/几何/历法/火器等西学。利玛窦、徐光启、孙元化、李之藻一脉。', effects: { intelligence: +10, learning: +15, faith: '天主教' } },
        { id: 'merchant_background', name: '商贾出身', category: 'background', desc: '商人家族或海商。通商贸实务，重利而轻儒礼。', effects: { management: +8, charisma: +5, integrity: -5 } },
        { id: 'manchu_eight_banner', name: '八旗勋贵', category: 'political', desc: '后金八旗制下，世袭勋贵。忠于汗，然四大贝勒制下仍有分权。', effects: { valor: +10, loyalty: +15, military: +10 } },
        { id: 'ming_royal_cadet', name: '宗藩疏属', category: 'political', desc: '明太祖以降藩王后裔。无实权，岁食禄米。', effects: { ambition: -15, benevolence: +5, integrity: -5 } }
      ],

      // ──── 家族谱系 ────
      families: [
        { name: '朱氏·大明皇室', prestige: 100, tier: 'imperial', members: ['朱由检', '朱由校(殁)', '张懿安', '周皇后', '袁贵妃'], note: '太祖朱元璋以来二百六十年。宗室 20 余万，岁禄压倒户部。福王朱常洵、潞王朱常淓等藩王散居。' },
        { name: '魏氏·九千岁党', prestige: 75, tier: 'common', members: ['魏忠贤', '魏良卿(侄·宁国公)', '崔呈秀(义子)', '田尔耕(义子)', '许显纯(义子)'], note: '肃宁出，以阉权骤起。义子义孙满朝。一朝天子一朝臣，覆巢之下。' },
        { name: '韩氏·蒲州', prestige: 68, tier: 'gentry', members: ['韩爌', '韩霖'], note: '山西蒲州世族。万历以来十余进士。东林党清流一脉。' },
        { name: '徐氏·松江', prestige: 72, tier: 'gentry', members: ['徐光启', '徐骥(子)', '徐尔爵(孙)', '徐尔默(孙)'], note: '松江上海徐氏。以农学、西学传家。三代信天主教。' },
        { name: '袁氏·东莞', prestige: 60, tier: 'common', members: ['袁崇焕', '袁文炳(父·贡生)'], note: '广东东莞袁氏。父贡生兴商。袁崇焕一支孤立。' },
        { name: '孙氏·高阳', prestige: 70, tier: 'gentry', members: ['孙承宗', '孙鉁(长子·日后阖门殉国)'], note: '北直隶高阳孙氏。崇祯十一年清军破高阳，阖门殉国。' },
        { name: '祖氏·辽东世将', prestige: 65, tier: 'gentry', members: ['祖大寿', '祖大乐', '祖泽远(侄)', '吴三桂(外甥·此时 15 岁未出)'], note: '辽东宁远世将。吴三桂母为祖大寿妹。日后松锦降清、吴三桂引清入关。' },
        { name: '爱新觉罗·后金', prestige: 95, tier: 'imperial', members: ['皇太极', '代善', '多尔衮', '多铎', '阿敏', '莽古尔泰', '福临(未生)'], note: '努尔哈赤所建。日后改姓，入主中原为清。' },
        { name: '郑氏·南安', prestige: 40, tier: 'common', members: ['郑芝龙', '郑鸿逵(弟)', '郑成功(子·3岁)', '田川松(妻)'], note: '福建南安海商。郑成功母为日本平户人。' },
        { name: '福王·朱常洵一系', prestige: 85, tier: 'imperial', members: ['朱常洵', '朱由崧(日后弘光帝)'], note: '神宗爱子。就国洛阳。田产 4 万顷。原史崇祯十四年李自成破洛阳烹之。' }
      ],

      // ──── 后宫体系 ────
      harem: {
        enabled: true,
        rankOrder: ['皇后', '皇贵妃', '贵妃', '妃', '嫔', '贵人', '常在', '答应'],
        consorts: [
          { name: '周皇后', rank: '皇后', palace: '坤宁宫', favor: 85, children: 0, note: '正宫。贤淑节俭。' },
          { name: '袁贵妃', rank: '贵妃', palace: '承乾宫', favor: 70, children: 0, note: '温顺体弱。' }
          // 田贵妃将于崇祯元年后入宫
        ],
        _pendingEntries: [
          { turn: 8, name: '田贵妃', rank: '贵妃', note: '扬州人，崇祯元年入宫。精琴棋书画，后为崇祯最宠。原史崇祯十五年病卒。' }
        ]
      },

      // ──── 驿站系统 ────
      postSystem: {
        enabled: true,
        totalStations: 1600,
        mainRoutes: [
          { name: '京-辽走廊', from: '北京', to: '山海关·宁远', distance: 700, stations: 14, urgentSpeed: '每日 400 里', note: '军情主通道。' },
          { name: '京-宣大', from: '北京', to: '大同', distance: 700, stations: 14, urgentSpeed: '每日 400 里' },
          { name: '京-西安', from: '北京', to: '西安', distance: 2100, stations: 42, urgentSpeed: '每日 300 里' },
          { name: '京杭大运河', from: '北京通州', to: '杭州', distance: 3200, stations: 70, urgentSpeed: '水驿每日 200 里', note: '漕运主线。' },
          { name: '京-云贵', from: '北京', to: '昆明', distance: 5000, stations: 100, urgentSpeed: '每日 200 里', note: '最远驿路。' }
        ],
        _reformRisk: { description: '崇祯二年户部议裁驿卒。原史裁驿使李自成失业。削减驿站节银 60 万，代价 = 数万流民。', turn: 18, severity: 'high' }
      },

      // ──── 刚性触发器·天文异象 ────
      rigidTriggers: {
        tianqi7_comet: { turn: 1, type: 'heavenSign', name: '彗星出于房心', narrative: '天启七年闰六月，彗星见于房心之间，光芒数尺。钦天监解"大凶"。', effect: { '皇威': -5, '小冰河凛冬指数': +3 } },
        chongzhen1_lunar: { turn: 5, type: 'heavenSign', name: '月食', narrative: '崇祯元年正月戊寅朔，月食。', effect: { '皇威': -2 } },
        chongzhen1_eclipse: { turn: 11, type: 'heavenSign', name: '日食', narrative: '崇祯元年六月甲午朔，日食。钦天监言"帝室之象，警戒在躬"。', effect: { '皇威': -5, '皇权': -3 } },
        chongzhen2_earthquake: { turn: 19, type: 'heavenSign', name: '北京地震', narrative: '崇祯二年春，京师地震。', effect: { '民心': -3, '皇威': -3 } },
        chongzhen3_locust: { turn: 32, type: 'disaster', name: '河南蝗灾', narrative: '崇祯三年夏，河南大蝗。', effect: { '西北灾荒怨气': +5, '流民数量': +100000 } },
        chongzhen_great_plague: { turn: 120, type: 'disaster', name: '华北大疫', narrative: '崇祯十四年起华北大疫（推测为鼠疫），死亡不计其数。', effect: { '人口': -500000, '小冰河凛冬指数': +5 } }
      },

      // ──── 文苑作品（初始在世的著作） ────
      culturalWorks: [
        { title: '《几何原本》前六卷', author: '利玛窦/徐光启', year: 1607, type: '译著·西学', desc: '欧几里得几何学首次入华。', status: '刊行' },
        { title: '《农政全书》', author: '徐光启', year: '编撰中', type: '农学', desc: '60 卷。论救荒、水利、屯田。崇祯十二年陈子龙整理刊行。', status: '稿本' },
        { title: '《武备志》', author: '茅元仪', year: 1621, type: '兵书', desc: '240 卷。集古今兵书之大成。' },
        { title: '《本草纲目》', author: '李时珍', year: 1578, type: '医学', desc: '16 部 52 卷。医药巨典。万历末已刻。' },
        { title: '《金瓶梅》', author: '兰陵笑笑生', year: '万历末', type: '小说', desc: '中国第一部世情长篇小说。' },
        { title: '《三言二拍》', author: '冯梦龙/凌濛初', year: '天启末', type: '白话小说集', desc: '喻世明言/警世通言/醒世恒言；初刻二刻拍案惊奇。市民文学巅峰。' },
        { title: '《徐霞客游记》', author: '徐弘祖', year: '编撰中', type: '地理游记', desc: '此时徐霞客 42 岁，正周游云贵，尚未写成。' },
        { title: '《天工开物》', author: '宋应星', year: '酝酿', type: '工艺百科', desc: '原史崇祯十年刊。宋应星此时 40 岁。' },
        { title: '《五人墓碑记》', author: '张溥', year: 1626, type: '文章', desc: '天启六年为苏州抗税五义士所作。东林遗志。' }
      ],

      // ──── 家规族法·科举·战斗等辅助配置 ────
      battleConfig: {
        thresholds: { decisive: 1.6, victory: 1.1, stalemate: 0.7 },
        varianceRange: 0.18,
        seasonMod: { '春': 1.0, '夏': 0.95, '秋': 1.05, '冬': 0.80 },
        fortLevelBonus: [1.0, 1.3, 1.7, 2.1, 2.6, 3.2],
        _historicalNotes: '明末城守系数高——宁远、锦州、开原、铁岭等城皆重重叠叠。然器不如人、将不肯力战时亦易破。'
      },
      warConfig: {
        casusBelliTypes: [
          { id: 'rebellion', name: '平叛讨逆', legitimacyCost: 0, truceMonths: 12 },
          { id: 'frontier', name: '征虏御边', legitimacyCost: 0, truceMonths: 24 },
          { id: 'sacred', name: '天子讨不臣', legitimacyCost: 5, truceMonths: 36 },
          { id: 'tusi', name: '改土归流', legitimacyCost: 10, truceMonths: 48 },
          { id: 'pirate', name: '剿海寇', legitimacyCost: 0, truceMonths: 12 }
        ]
      },

      // ──── 剧本本体标签 ────
      // 注：scenario.tags 已在 § 1 元信息设定（6 项）。此处 sceneTags 补充更细项供检索/过滤
      sceneTags: ['明末', '天启', '崇祯即位', '魏忠贤', '阉党', '东林党', '小冰河', '辽东', '皇帝视角', '官方剧本', '史实', '大悲剧', '末世', '权阉倾覆', '后金', '陕北民变']
    };

    // 为 armies / items 打 sid（以便 GM filter-by-sid 能捕获）
    if (scenario.military && Array.isArray(scenario.military.armies)) {
      scenario.military.armies.forEach(function(a) { a.sid = SID; a.id = _uid('army_'); });
    }
    if (Array.isArray(scenario.items)) {
      // items 需单独推入 P.items（非 P.military.items）
      if (!Array.isArray(global.P.items)) global.P.items = [];
      scenario.items.forEach(function(it) {
        it.sid = SID; it.id = _uid('item_');
        global.P.items.push(it);
      });
    }

    scenario._version = SCENARIO_VERSION;
    global.P.scenarios.push(scenario);

    // 强制持久化——覆盖 localStorage 中的旧 P（editor 侧）
    try {
      if (typeof global.saveP === 'function') global.saveP();
      else if (typeof global.localStorage !== 'undefined') {
        global.localStorage.setItem('tianming_P', JSON.stringify(global.P));
      }
    } catch(e) { /* 静默 */ }

    // ═══════════════════════════════════════════════════════════════════
    // § 2. 人物——46 位
    // ═══════════════════════════════════════════════════════════════════
    var chars = buildCharacters().map(_normalizeChar);
    chars.forEach(function (c) { c.sid = SID; c.id = _uid('char_'); global.P.characters.push(c); });

    // ═══════════════════════════════════════════════════════════════════
    // § 3. 势力
    // ═══════════════════════════════════════════════════════════════════
    var facs = [
      {
        name: '明朝廷', leader: '朱由检', color: '#c9a84c',
        strength: 70, militaryStrength: 62, economy: 55,
        courtInfluence: 100, popularInfluence: 85,
        territory: '两京十三省 + 辽东都司 + 乌思藏 + 各土司', capital: '北京·紫禁城',
        ideology: '礼法·儒教·天下共主',
        desc: '大明享国二百六十年。神宗怠政后政局日坏。熹宗末年阉党专擅，士林溃散。新帝立，国本未定。',
        traits: ['儒教', '天朝', '大一统', '官僚体制', '科举取士'],
        members: '朱由检(帝)·周皇后·张懿安·魏忠贤(阉党)·韩爌(东林)·孙承宗(武)·袁崇焕·毕自严·徐光启·朱常洵(福王)',
        leadership: { ruler: '朱由检', regent: '', general: '王之臣/袁崇焕(候)', chancellor: '黄立极(将罢)', spy: '魏忠贤(东厂)' },
        attitude: { self: '正统天朝', enemies: '后金/土司叛乱/流民', allies: '朝鲜', neutrals: '察哈尔/琉球/安南' },
        mainResources: '漕粮·银·盐·茶·丝绸·瓷器·棉布·兵器',
        treasury: { money: 2000000, grain: 5000000, cloth: 500000, note: '太仓见银 200 万两（实可调 85 万）；京通仓粮 130 万石' },
        partyRelations: '阉党vs东林党为主要矛盾；浙党/齐党/楚党/昆党/宣党环绕。朱由校遗命"弟当为尧舜"。',
        history: '太祖洪武立国 1368 → 成祖迁都 1421 → 仁宣之治 → 土木之变 1449 → 弘治中兴 → 嘉靖议礼 → 张居正改革 → 万历三大征+怠政 → 天启阉祸。凡 259 年。',
        strengths: ['正统合法性', '庞大人口', '成熟官僚', '江南财赋', '长城防线', '天朝朝贡体系'],
        weaknesses: ['阉党专权', '辽东军饷黑洞', '江南抗税', '宗藩负担', '小冰河天灾', '党争内耗', '武备废弛'],
        strategy: '新帝即位首务：稳京师、除权阉、用贤能、救陕饥、守辽东。',
        playerRelation: '玩家本尊'
      },
      {
        name: '后金', leader: '皇太极', color: '#6a4c93',
        strength: 58, militaryStrength: 72, economy: 32,
        courtInfluence: 10, popularInfluence: 18,
        territory: '辽东沈阳·赫图阿拉·辽西诸卫·朝鲜西北', capital: '沈阳（盛京）',
        ideology: '萨满·汗权·八旗·以汉治汉',
        desc: '努尔哈赤称汗于天命元年（1616）。皇太极继位改革政制，结纳蒙汉，将成大患。明史称为"奴酋""虏"，然自号"大金"追宋金之续。',
        traits: ['八旗劲旅', '渔猎游牧', '多民族', '骑兵为主', '善长火器'],
        members: '皇太极(汗)·代善(大贝勒)·阿敏·莽古尔泰·多尔衮·多铎·范文程(汉臣)·宁完我·孔有德(将叛明)',
        leadership: { ruler: '皇太极', regent: '代善', general: '多尔衮/阿济格', chancellor: '范文程', spy: '(借明朝边镇将领)' },
        attitude: { self: '女真正统·后金汗业', enemies: '大明/察哈尔/朝鲜(初)', allies: '科尔沁蒙古/朝鲜(已迫盟)', neutrals: '其他蒙古' },
        mainResources: '马·皮毛·人参·辽东铁·辽河谷平原粮',
        treasury: { money: 300000, grain: 800000, cloth: 50000, note: '八旗共有制。汗库受限。' },
        partyRelations: '内部四大贝勒并坐之议——皇太极隐忍削权；外与察哈尔竞蒙古霸；与朝鲜定江都盟。',
        history: '努尔哈赤 1583 起兵 → 1616 称汗建金 → 1619 萨尔浒破明 → 1621 取沈阳辽阳 → 1626 宁远伤殁 → 1626 皇太极继位 → 1627 征朝鲜。',
        strengths: ['八旗军纪', '骑射无敌', '皇太极雄才', '汉臣谋主', '内部凝聚'],
        weaknesses: ['人口不足百万', '攻城不精', '朝鲜未完全臣服', '察哈尔西翼'],
        strategy: '短期：休养+结蒙古；中期：绕蒙古破长城；长期：取明入主中原。'
      },
      {
        name: '察哈尔', leader: '林丹汗', color: '#8b4513',
        strength: 30, militaryStrength: 40, economy: 18,
        courtInfluence: 8, popularInfluence: 15,
        territory: '漠南蒙古·归化城·宣化塞外', capital: '归化城（呼和浩特）',
        ideology: '藏传佛教黄教·元裔蒙古正统',
        desc: '元朝余脉。名义漠南蒙古共主。林丹汗欲效祖成吉思汗重振蒙古，然屡败于后金。',
        traits: ['骑射', '游牧', '黄教', '元裔'],
        members: '林丹汗·苏泰太后·囊囊太后·额哲(幼子·日后归清)',
        leadership: { ruler: '林丹汗', regent: '', general: '', chancellor: '', spy: '' },
        attitude: { self: '蒙古大汗', enemies: '后金', allies: '(欲结明)', neutrals: '漠北/漠西蒙古' },
        mainResources: '马·羊·毛皮',
        treasury: { money: 50000, grain: 100000, cloth: 20000, note: '游牧财富流动。无常备国库。' },
        partyRelations: '与科尔沁/喀喇沁/土默特等部敌对（皆附后金）；欲与明结盟共抗后金。',
        history: '1604 继察哈尔汗 → 屡伐诸部不服 → 1625 强推黄教引分裂 → 1627 被后金击败西迁归化。',
        strengths: ['蒙古正统名分', '骑兵机动'],
        weaknesses: ['诸部离心', '无稳定财源', '内部教派冲突', '后金压迫'],
        strategy: '结明联抗后金；恢复蒙古一统。'
      },
      {
        name: '朝鲜', leader: '仁祖·李倧', color: '#4a7c2c',
        strength: 28, militaryStrength: 20, economy: 30,
        courtInfluence: 22, popularInfluence: 10,
        territory: '朝鲜八道（京畿/忠清/庆尚/全罗/江原/黄海/平安/咸镜）', capital: '汉城（今首尔）',
        ideology: '儒教·事大·小中华',
        desc: '李氏朝鲜第十六代。仁祖反正（1623）废光海君。天启七年春被后金所伐，定江都兄弟盟。',
        traits: ['事大至诚', '儒家正统', '衰弱', '两班贵族'],
        members: '仁祖李倧·昭显世子(日后被清劫为质)·孝宗大君·金尚宪(主战派)·崔鸣吉(主和派)',
        leadership: { ruler: '仁祖李倧', regent: '', general: '张晚/李贵', chancellor: '金尚宪', spy: '' },
        attitude: { self: '小中华', enemies: '后金(被迫结盟)/倭', allies: '大明', neutrals: '琉球' },
        mainResources: '人参·毛皮·银·米·纸',
        treasury: { money: 40000, grain: 300000, cloth: 15000, note: '被后金勒索赔款后国库空虚' },
        partyRelations: '国内"西人/南人/老论/少论"四党争。主和派主战派对峙。对明事大、对后金屈辱兄弟盟。',
        history: '李氏 1392 立国 → 1392 朱元璋册封 → 1592 壬辰倭乱明军援 → 1623 仁祖反正 → 1627 丁卯之役被迫兄事后金。',
        strengths: ['山地易守', '两班文治', '对明忠诚'],
        weaknesses: ['兵弱', '党争', '军饷不足', '夹缝生存'],
        strategy: '对明恭敬求援；对后金虚与委蛇。'
      },
      {
        name: '播州土司·杨氏(余裔)', leader: '杨朝栋', color: '#9c6633',
        strength: 8, militaryStrength: 12, economy: 5,
        courtInfluence: 3, popularInfluence: 8,
        territory: '贵州遵义府边地·原播州地', capital: '(已无)',
        ideology: '土司自治·彝汉混合',
        desc: '万历二十八年（1600）播州之役杨应龙族灭，然西南土司网络犹在。残支余裔不甘，联结水西安氏/永宁奢氏观变。',
        traits: ['山地', '土司', '残余', '勾结奢安之乱'],
        members: '杨朝栋·土司余孽',
        leadership: { ruler: '杨朝栋', regent: '', general: '', chancellor: '', spy: '' },
        attitude: { self: '土司独立', enemies: '明朝改土归流政策', allies: '水西安氏/永宁奢氏', neutrals: '其他小土司' },
        mainResources: '山地木材·朱砂·汞',
        treasury: { money: 5000, grain: 8000, cloth: 1000 },
        partyRelations: '与水西安邦彦、永宁奢崇明同为土司利益共同体（奢安之乱 1621-1629）。',
        history: '杨氏自唐乾符年间入播 → 700 余年世袭 → 杨应龙 1600 被平 → 剩余族人图谋复国。',
        strengths: ['山地熟悉', '族人向心'],
        weaknesses: ['精英尽失', '无财力', '明军仍在附近'],
        strategy: '等待明内乱时借势复起。'
      },
      {
        name: '郑氏海商', leader: '郑芝龙', color: '#2a6f9c',
        strength: 18, militaryStrength: 26, economy: 42,
        courtInfluence: 5, popularInfluence: 28,
        territory: '福建沿海·台湾海峡·厦门·金门·东番岛部分', capital: '厦门/日本平户',
        ideology: '海权·商贸·天主教(部分)',
        desc: '海商兼海盗集团。1624 年助荷兰人据台湾。1628 年将受明招抚为游击。日后东亚海上霸主。',
        traits: ['海军强盛', '商人集团', '海盗转正', '多语种', '亦中亦西'],
        members: '郑芝龙·郑鸿逵(弟)·郑芝虎(弟)·郑成功(3岁·未来领袖)·何斌(通事)·杨天生(副)',
        leadership: { ruler: '郑芝龙', regent: '', general: '郑鸿逵', chancellor: '何斌', spy: '日本平户联络人' },
        attitude: { self: '海商王侯', enemies: '荷兰东印度公司·西班牙·其他海盗', allies: '日本幕府(通商)·西班牙马尼拉(有限)', neutrals: '明朝(欲归附)' },
        mainResources: '糖·丝·鹿皮·海贸税·走私',
        treasury: { money: 300000, grain: 50000, cloth: 20000, note: '海贸流水极大，金银储备数百万两' },
        partyRelations: '与荷兰东印度公司（台湾大员）竞争台海；与明福建官府"时叛时抚"；与日本平户保持商贸。',
        history: '1604 出生南安 → 1621 赴日本平户 → 1624 助荷兰据台 → 1625-1627 海上壮大 → 1628 将受抚。',
        strengths: ['舰船数量', '海贸网络', '通译多国', '财力'],
        weaknesses: ['朝廷视为海盗', '荷兰人武备优', '内部宗派'],
        strategy: '受抚得官，换取合法性；以剿其他海盗为条件扩张。'
      },
      {
        name: '陕北饥民(将起)', leader: '王嘉胤', color: '#7a4e3b',
        strength: 6, militaryStrength: 4, economy: 1,
        courtInfluence: 0, popularInfluence: 35,
        territory: '陕西延安府·榆林·米脂·府谷', capital: '(无·流动)',
        ideology: '求活·均田免赋（后发展）·反明',
        desc: '连年大旱，赋重饷严，逃兵饥民聚啸成伙。今秋尚未成势，一二年内将燎原。',
        traits: ['饥民', '逃兵', '流动作战', '无组织'],
        members: '王嘉胤(首)·高迎祥(舅)·李自成(尚为驿卒)·张献忠(尚为军卒)·罗汝才·刘宗敏',
        leadership: { ruler: '王嘉胤(名义)', regent: '', general: '高迎祥(潜)', chancellor: '', spy: '' },
        attitude: { self: '求活之民', enemies: '明官军·缙绅', allies: '其他流民', neutrals: '地方武装' },
        mainResources: '劫掠所得',
        treasury: { money: 0, grain: 500, cloth: 0 },
        partyRelations: '此时尚无政治组织。内部散乱。',
        history: '1625-1626 陕北持续大旱 → 1627 饥民聚啸 → 1628 崇祯元年秋王嘉胤起事 → 1629 李自成驿站被裁加入 → 1644 破京。',
        strengths: ['兵员无限补充(饥民)', '机动', '知地利'],
        weaknesses: ['无军纪', '无根据地', '首脑不稳', '补给难'],
        strategy: '此时仅求食。若民变燎原则走"流寇"战略——不据一城，流动求活。'
      }
    ];
    facs.forEach(function (f) { f.sid = SID; f.id = _uid('fac_'); global.P.factions.push(f); });

    // ═══════════════════════════════════════════════════════════════════
    // § 4. 党派
    // ═══════════════════════════════════════════════════════════════════
    var parties = [
      {
        name: '阉党', leader: '魏忠贤', faction: '明朝廷', crossFaction: false,
        influence: 92, satisfaction: 55, status: '活跃(将崩)', memberCount: 180, cohesion: 65,
        ideology: '阉寺弄权·排除异己·罗织罪名·生祠遍天下',
        desc: '魏忠贤党羽集团。崔呈秀等五虎为文官核心，田尔耕、许显纯为五彪武官。占据内阁、六部、都察院过半。号义子义孙"十狗""十孩儿""四十孙"。',
        currentAgenda: '稳住阉党地位；加紧削东林；借皇陵工程敛财',
        shortGoal: '阻止新帝清算',
        socialBase: [{ class: '宗室', affinity: 0.3 }, { class: '士大夫', affinity: -0.4 }, { class: '胥吏', affinity: 0.5 }],
        members: '魏忠贤·崔呈秀·田尔耕·许显纯·黄立极·施凤来·冯铨·阎鸣泰·王绍徽·李夔龙·潘汝桢·魏良卿',
        leadership: { chief: '魏忠贤', deputy: '崔呈秀', spokesman: '黄立极', enforcer: '田尔耕·许显纯' },
        history: '天启三年(1623)魏忠贤掌司礼监始成规模→天启四年诛六君子→天启六年广建生祠→天启七年熹宗崩→此时风雨飘摇',
        enemies: ['东林党'], allies: ['浙党(部分)', '齐党(部分)'], neutrals: ['楚党'],
        strengths: ['司礼监批红权', '东厂缇骑', '京营兵权(崔呈秀)', '锦衣卫诏狱(田尔耕许显纯)', '国库财源'],
        weaknesses: ['一人存亡系党', '帝心已变', '士林痛恨', '声名扫地'],
        strategy: '首先试图软化新帝；失败则伺机京营兵变；再失败则各人自谋出路',
        foundYear: 1623, peakYear: 1626, declineYear: 1627
      },
      {
        name: '东林党', leader: '韩爌', faction: '明朝廷', crossFaction: false,
        influence: 12, satisfaction: 18, status: '式微(待起)', memberCount: 80, cohesion: 82,
        ideology: '正心诚意·清君侧·顾宪成"讽议朝政"遗风·反矿税·抑宦官·重吏治',
        desc: '万历三十二年(1604)顾宪成/顾允成兄弟创无锡东林书院讲学。一时东南士林纷赴。万历四十八年"三案"(梃击/红丸/移宫)辩立。天启四年杨涟弹魏忠贤二十四罪败被诏狱诛。现硕果仅存者多贬居乡里。',
        currentAgenda: '等待新帝召还；书院复讲；追赃问责阉党',
        shortGoal: '韩爌等老臣起复入阁',
        socialBase: [{ class: '士大夫', affinity: 0.85 }, { class: '缙绅', affinity: 0.40 }, { class: '商人', affinity: 0.20 }],
        members: '韩爌·钱龙锡·成基命·刘鸿训·李标·徐光启·孙元化·钱谦益·黄尊素·瞿式耜·张溥(复社承东林)',
        leadership: { chief: '韩爌(蒲州)', deputy: '钱龙锡(松江)', spokesman: '成基命', scholar: '徐光启(实学)' },
        history: '顾宪成 1604 创东林书院→万历末"三案"始党争→天启元年抗击阉党→天启四年"六君子"死诏狱(杨涟/左光斗/魏大中/袁化中/周朝瑞/顾大章)→天启五年高攀龙自沉→天启七年九月寂然',
        enemies: ['阉党', '浙党(结阉党一段)', '齐党'], allies: [], neutrals: ['楚党', '昆党'],
        strengths: ['士林舆论', '科举门生网络', '江南缙绅资助', '道德制高点', '清议传统'],
        weaknesses: ['人才凋零', '内部理念分歧', '无兵权', '财源有限'],
        strategy: '借新帝除阉党之势全面复起；清算阉党；重立吏治；然势必又遭浙党齐党反扑',
        foundYear: 1604, peakYear: 1620, suppressedPeriod: '1624-1627'
      },
      {
        name: '浙党', leader: '施凤来', faction: '明朝廷', crossFaction: false,
        influence: 38, satisfaction: 52, status: '活跃·附阉', memberCount: 60, cohesion: 55,
        ideology: '同乡互助·中央维稳·反东林',
        desc: '浙江籍京官（嘉湖宁绍/杭州为主）为核心的同乡派系。万历末沈一贯、方从哲为首与东林抗衡。天启朝施凤来、冯铨等多附阉党。温体仁此时已露头角。',
        currentAgenda: '伺阉党覆灭之机，以柔佞态度归附新帝',
        shortGoal: '温体仁入阁',
        socialBase: [{ class: '士大夫', affinity: 0.45 }, { class: '商人', affinity: 0.55 }, { class: '缙绅', affinity: 0.50 }],
        members: '施凤来·冯铨·温体仁·潘汝桢·来宗道·周延儒(宜兴也属浙地)·王绍徽(附)',
        leadership: { chief: '施凤来', deputy: '温体仁(将兴)', patron: '沈一贯(已死)' },
        history: '万历二十九年沈一贯入阁为浙党首→万历三十三年"京察"党争→万历四十一年方从哲继起→天启朝倾向附阉→将入崇祯朝温体仁为首时代',
        enemies: ['东林党'], allies: ['阉党(部分)', '齐党'], neutrals: ['楚党'],
        strengths: ['江南财源', '阁臣席位', '温体仁的才能与柔佞'],
        weaknesses: ['依附阉党包袱', '内部不统一'],
        strategy: '眼见阉党倾覆即转舵；以温体仁为新盟主；专攻东林派门户之争',
        foundYear: 1601
      },
      {
        name: '楚党', leader: '官应震', faction: '明朝廷', crossFaction: false,
        influence: 15, satisfaction: 42, status: '分化', memberCount: 30, cohesion: 35,
        ideology: '同乡互助·湖广士气',
        desc: '湖广（今湖北湖南）籍官员同乡派系。万历三十年前后官应震、吴亮嗣为首称盛。与东林对立而与浙党近。今已分化，多数归入阉党或退隐。',
        currentAgenda: '维持残余势力，伺机重新凝聚',
        shortGoal: '保存湖广子弟在京官职',
        socialBase: [{ class: '士大夫', affinity: 0.40 }, { class: '缙绅', affinity: 0.35 }],
        members: '官应震·吴亮嗣·熊廷弼(已死)·贺逢圣',
        leadership: { chief: '官应震', former: '熊廷弼(1625 处死)' },
        history: '万历末官应震、吴亮嗣称楚党→天启二年熊廷弼辽东经略被阉党诬陷→天启五年熊廷弼弃市传首九边→党势大衰',
        enemies: ['东林党(早期)'], allies: ['浙党', '齐党'], neutrals: [],
        strengths: ['湖广"粮仓"地缘'],
        weaknesses: ['熊廷弼死后无雄才', '分裂严重'],
        strategy: '附强自保；等待形势明朗',
        foundYear: 1610
      },
      {
        name: '齐党', leader: '亓诗教(已罢)', faction: '明朝廷', crossFaction: false,
        influence: 20, satisfaction: 45, status: '式微·附阉', memberCount: 25, cohesion: 40,
        ideology: '同乡·鲁地士气',
        desc: '山东籍官员。万历末亓诗教、周永春为首与东林抗衡之一支。天启朝多附阉党。李精白(现山东巡抚)亦齐党。',
        currentAgenda: '依附阉党转瞬覆灭后寻新主',
        shortGoal: '保存齐党骨干',
        socialBase: [{ class: '士大夫', affinity: 0.40 }, { class: '缙绅', affinity: 0.30 }],
        members: '亓诗教·周永春·李精白·韩敬',
        leadership: { chief: '亓诗教(罢)', field: '李精白(山东巡抚)' },
        history: '万历末亓诗教首倡齐党→天启初结党附阉→此时首领多已贬斥',
        enemies: ['东林党'], allies: ['阉党', '浙党'], neutrals: ['楚党'],
        strengths: ['齐鲁儒学正统', '漕运山东段把控'],
        weaknesses: ['领袖已去位', '齐鲁饥荒限制财源'],
        strategy: '暗中保存力量',
        foundYear: 1615
      },
      {
        name: '宣党', leader: '汤宾尹(已殁)', faction: '明朝廷', crossFaction: false,
        influence: 10, satisfaction: 38, status: '残余', memberCount: 15, cohesion: 30,
        ideology: '地域乡党·反东林',
        desc: '宣城（今安徽宣州）籍官员，以汤宾尹(万历三十八年京察被劾归卒)为首。与东林夙怨起于"三案"辩论。门人今多附阉党。',
        currentAgenda: '寄居他党求存',
        shortGoal: '门生再起',
        socialBase: [{ class: '士大夫', affinity: 0.30 }],
        members: '汤宾尹门生·韩敬·金维枋',
        leadership: { chief: '(空缺)', legacy: '汤宾尹遗风' },
        history: '万历二十三年汤宾尹中进士→万历三十八年京察被东林斥罢→党势一落千丈→天启朝门生有再起机会',
        enemies: ['东林党'], allies: ['阉党'], neutrals: [],
        strengths: ['科举师承(汤宾尹为会元)'],
        weaknesses: ['领袖已死', '地缘小，人数少'],
        strategy: '合并他党或归隐',
        foundYear: 1595
      },
      {
        name: '昆党', leader: '顾天峻', faction: '明朝廷', crossFaction: false,
        influence: 8, satisfaction: 35, status: '弱小', memberCount: 12, cohesion: 45,
        ideology: '乡党·与东林若即若离',
        desc: '昆山（今江苏昆山）籍官员，顾天峻为首。顾宪成亦为昆山人（东林祖），故昆党与东林地缘相近，然自成一支，与东林间有门户之争。',
        currentAgenda: '自保并借东林复起之势',
        shortGoal: '保留地方势力',
        socialBase: [{ class: '缙绅', affinity: 0.55 }],
        members: '顾天峻·钱士升',
        leadership: { chief: '顾天峻' },
        history: '万历末顾宪成讲学东林，昆山同乡顾天峻等自立昆党→天启朝夹缝生存',
        enemies: [], allies: ['东林党(有限)'], neutrals: ['浙党'],
        strengths: ['江南昆山富裕', '与东林同乡'],
        weaknesses: ['党员极少', '无重臣'],
        strategy: '依附东林，借其光复起',
        foundYear: 1610
      }
    ];
    parties.forEach(function (p) { p.sid = SID; p.id = _uid('pty_'); global.P.parties.push(p); });

    // ═══════════════════════════════════════════════════════════════════
    // § 5. 阶层
    // ═══════════════════════════════════════════════════════════════════
    var classes = [
      {
        name: '宗室', description: '朱氏皇族及分封藩王。万历末在籍逾 20 万，岁耗宗禄六百万石。福王朱常洵岁食米 2 万石+田 4 万顷，潞王/瑞王等亦富。宗人府管辖，不许出封地。',
        mobility: '低', status: '皇族', size: '约 25 万(占 0.02%)', satisfaction: 62, influence: 42,
        privileges: '封爵·俸禄·不服役·不纳税·不科举·宗人府管辖',
        obligations: '不得干政·不许出封地·婚姻受限',
        economicRole: '治理', unrestThreshold: 20,
        demands: '增岁禄·恢复万历末年禄米拖欠·允私自经营皇庄',
        representativeNpcs: ['朱常洵', '朱常淓'],
        leaders: ['朱常洵(福王·洛阳)', '朱常浩(瑞王·汉中)'],
        supportingParties: ['阉党(部分)'],
        regionalVariants: [
          { region: '河南(洛阳)', satisfaction: 80, distinguishing: '福王富甲天下' },
          { region: '湖广', satisfaction: 60, distinguishing: '瑞王/桂王等分封较近' },
          { region: '陕甘', satisfaction: 40, distinguishing: '瑞王汉中就封困苦' }
        ],
        internalFaction: [
          { name: '在京宗室', size: '10%', stance: '依附帝室' },
          { name: '就国藩王', size: '60%', stance: '封地敛财' },
          { name: '疏属远支', size: '30%', stance: '愤宗禄拖欠' }
        ],
        unrestLevels: { grievance: 65, petition: 75, strike: 88, revolt: 95 },
        economicIndicators: { wealth: 90, taxBurden: 5, landHolding: 30 }
      },
      {
        name: '士大夫', description: '科举出身的读书人与官吏。儒学正统承载者。分为京官/外官/翰林/地方学官。天启阉祸后东林血债未偿，士气极低。',
        mobility: '高', status: '良民(士)', size: '约 50 万(含生员秀才)', satisfaction: 30, influence: 88,
        privileges: '免徭役·免杂税·进士入仕·举人荫子·见官不跪',
        obligations: '须遵儒礼·代朝廷教化',
        economicRole: '治理', unrestThreshold: 35,
        demands: '复东林·平六君子冤案·重整吏治·恢复殿试廷推·矿税永罢',
        representativeNpcs: ['韩爌', '徐光启', '钱龙锡', '毕自严', '黄立极'],
        leaders: ['韩爌(东林老臣)', '温体仁(浙党·将崛起)'],
        supportingParties: ['东林党', '浙党', '阉党(附者)'],
        regionalVariants: [
          { region: '江南苏松', satisfaction: 45, distinguishing: '富庶开放·文采斐然·但屡遭阉党构陷' },
          { region: '北方燕齐', satisfaction: 28, distinguishing: '务实重礼·多附阉党' },
          { region: '湖广楚地', satisfaction: 25, distinguishing: '熊廷弼死后楚党零落' },
          { region: '陕甘边地', satisfaction: 20, distinguishing: '师徒星散·饥荒士困' }
        ],
        internalFaction: [
          { name: '东林清流', size: '20%', stance: '反阉·尊礼·讲学' },
          { name: '实务派', size: '30%', stance: '徐光启等西学+农政' },
          { name: '阉党附庸', size: '35%', stance: '附势求进' },
          { name: '中立观望', size: '15%', stance: '韬晦' }
        ],
        unrestLevels: { grievance: 40, petition: 55, strike: 75, revolt: 88 },
        economicIndicators: { wealth: 65, taxBurden: 20, landHolding: 50 }
      },
      {
        name: '缙绅', description: '地方乡绅。退休官员/举人/监生。土地所有者，包揽赋税，掌控乡村。明末兼并日益严重，江南"田连阡陌，农夫食粥"。',
        mobility: '中', status: '良民(绅)', size: '约 300 万', satisfaction: 64, influence: 74,
        privileges: '免徭役·包揽赋税·操纵里甲·免科·减刑·免见官',
        obligations: '须遵礼法·代朝廷安民',
        economicRole: '治理', unrestThreshold: 35,
        demands: '免派·维护里甲特权·反对丈田清查·反矿税商税',
        representativeNpcs: ['董其昌', '钱谦益', '钱龙锡(已退)', '张溥(将立复社)'],
        leaders: ['董其昌(松江)', '钱龙锡(华亭)', '钱谦益(常熟)'],
        supportingParties: ['东林党', '浙党'],
        regionalVariants: [
          { region: '江南苏松', satisfaction: 80, distinguishing: '兼并猛进·文社林立·抗税为风' },
          { region: '北方燕赵', satisfaction: 45, distinguishing: '兵祸频繁·田畴荒芜' },
          { region: '西南滇黔', satisfaction: 55, distinguishing: '与土司并立·汉绅势微' }
        ],
        internalFaction: [
          { name: '朝籍缙绅(退休官)', size: '25%', stance: '联络朝局' },
          { name: '白身缙绅(举人监生)', size: '50%', stance: '钻营科举' },
          { name: '豪强富户', size: '25%', stance: '兼并土地·包揽里甲' }
        ],
        unrestLevels: { grievance: 55, petition: 70, strike: 85, revolt: 92 },
        economicIndicators: { wealth: 78, taxBurden: 15, landHolding: 72 }
      },
      {
        name: '自耕农', description: '拥有小块土地的农户。赋役最重，最易破产。占总人口半数但土地份额仅三分之一。小冰河+辽饷加派之下，每年数十万户沦为佃农或流民。',
        mobility: '低', status: '良民(民)', size: '约 3000 万(占 20%)', satisfaction: 26, influence: 25,
        privileges: '编户齐民·科举资格(虽实难)',
        obligations: '田赋·丁银·里甲徭役·辽饷加派·漕粮',
        economicRole: '生产', unrestThreshold: 25,
        demands: '减赋免派·禁止兼并·救荒',
        representativeNpcs: [],
        leaders: [],
        supportingParties: [],
        regionalVariants: [
          { region: '江南', satisfaction: 38, distinguishing: '赋最重然有商贸副业' },
          { region: '陕西', satisfaction: 10, distinguishing: '三年大旱·树皮草根已尽' },
          { region: '山东河南', satisfaction: 22, distinguishing: '水旱交替·逐年破产' },
          { region: '湖广', satisfaction: 38, distinguishing: '湖广熟天下足·相对稳' }
        ],
        internalFaction: [
          { name: '自耕富农', size: '15%', stance: '保守·惧沦佃农' },
          { name: '贫农', size: '65%', stance: '苟活' },
          { name: '破产边缘', size: '20%', stance: '随时沦为佃农或流民' }
        ],
        unrestLevels: { grievance: 25, petition: 42, strike: 65, revolt: 78 },
        economicIndicators: { wealth: 22, taxBurden: 82, landHolding: 28 }
      },
      {
        name: '佃农与流民', description: '无地租种、或失地流亡。小冰河期与辽饷加派下急速膨胀。陕北 1628 已有百万流民成雏形，日后为民变主力。',
        mobility: '极低', status: '良民(贫)/无籍(流)', size: '约 5000 万(含隐户)', satisfaction: 10, influence: 10,
        privileges: '无',
        obligations: '租佃租子·受缙绅盘剥',
        economicRole: '生产', unrestThreshold: 15,
        demands: '土地·救食·均田免赋·反辽饷',
        representativeNpcs: ['王嘉胤', '高迎祥', '李自成(尚为驿卒)'],
        leaders: ['王嘉胤(陕北)'],
        supportingParties: [],
        regionalVariants: [
          { region: '陕北', satisfaction: 3, distinguishing: '吃观音土·将燎原' },
          { region: '山西晋北', satisfaction: 18, distinguishing: '晋商压迫+灾荒' },
          { region: '华北山东', satisfaction: 15, distinguishing: '逃户聚啸' },
          { region: '江南', satisfaction: 35, distinguishing: '市镇谋食尚可' }
        ],
        internalFaction: [
          { name: '佃农', size: '60%', stance: '苟活' },
          { name: '流民(城郊)', size: '25%', stance: '乞讨·偷盗' },
          { name: '逃卒(军户叛)', size: '10%', stance: '武装流寇种子' },
          { name: '山寨绿林', size: '5%', stance: '已武装' }
        ],
        unrestLevels: { grievance: 12, petition: 25, strike: 42, revolt: 55 },
        economicIndicators: { wealth: 5, taxBurden: 95, landHolding: 3 }
      },
      {
        name: '商人', description: '徽商/晋商/江南牙行。盐商巨富。徽商"挟盐策以走郡国"。晋商控九边茶马。天启末年矿税罢，商业微舒。',
        mobility: '中', status: '良民(末)', size: '约 500 万', satisfaction: 50, influence: 55,
        privileges: '实际巨富',
        obligations: '商税·关税·盐引·四民末流·子弟科举被歧视',
        economicRole: '商贸', unrestThreshold: 30,
        demands: '减商税·开海禁·允子弟科举·保护商路',
        representativeNpcs: ['郑芝龙(海商)', '汪文言(徽商掌故)'],
        leaders: ['郑芝龙(海商)', '(晋商无名人)', '(徽商无名人)'],
        supportingParties: ['东林党(部分)'],
        regionalVariants: [
          { region: '徽州', satisfaction: 62, distinguishing: '徽商通盐业·富甲江南' },
          { region: '山西平阳太原', satisfaction: 52, distinguishing: '晋商九边茶马·兼营钱庄' },
          { region: '福建泉漳', satisfaction: 58, distinguishing: '海商郑氏起家·亦盗亦商' },
          { region: '江南苏松', satisfaction: 55, distinguishing: '丝绸牙行·棉布行' },
          { region: '广州', satisfaction: 45, distinguishing: '与澳门葡人互市·多政策限' }
        ],
        internalFaction: [
          { name: '盐商', size: '10%', stance: '最富·结交阉党' },
          { name: '海商', size: '15%', stance: '游走官商之间' },
          { name: '晋商', size: '20%', stance: '控边贸·亦对后金' },
          { name: '徽商', size: '25%', stance: '重读书·子弟科举' },
          { name: '中小行商', size: '30%', stance: '求稳求活' }
        ],
        unrestLevels: { grievance: 52, petition: 68, strike: 82, revolt: 90 },
        economicIndicators: { wealth: 72, taxBurden: 55, landHolding: 25 }
      },
      {
        name: '工匠', description: '官匠（匠户）+ 民匠。织造局、军器局、宫廷营造、造船、瓷器。明中叶匠户改为"班匠银"折纳。',
        mobility: '低', status: '良民(匠)', size: '约 400 万', satisfaction: 36, influence: 15,
        privileges: '官匠免役·技艺传家',
        obligations: '匠籍世袭·受工部/内府调遣·班匠银',
        economicRole: '手工', unrestThreshold: 28,
        demands: '减匠役·允转业·提高工钱·废匠籍',
        representativeNpcs: ['宋应星(此时 40 岁在编《天工开物》)'],
        leaders: [],
        supportingParties: [],
        regionalVariants: [
          { region: '景德镇', satisfaction: 55, distinguishing: '官窑御用·工钱尚可' },
          { region: '松江上海', satisfaction: 42, distinguishing: '棉布织造·商业化程度高' },
          { region: '佛山', satisfaction: 48, distinguishing: '铁器铸造·广东海贸带动' },
          { region: '南京', satisfaction: 38, distinguishing: '织造局供贡' },
          { region: '北京/保定', satisfaction: 30, distinguishing: '宫廷/军器局·劳役繁重' }
        ],
        internalFaction: [
          { name: '官匠(世籍)', size: '35%', stance: '受国家役使' },
          { name: '民匠(自由)', size: '55%', stance: '市井作坊·售卖所作' },
          { name: '军器匠', size: '10%', stance: '受工部/兵部·制甲铳' }
        ],
        unrestLevels: { grievance: 38, petition: 55, strike: 75, revolt: 88 },
        economicIndicators: { wealth: 32, taxBurden: 52, landHolding: 8 }
      },
      {
        name: '军户', description: '军籍世袭。九边戍卒、京营、卫所守备。明初 280 万军户，至天启虚报虚额过半。饷银长期拖欠，哗变已有宁远之例。',
        mobility: '极低', status: '军籍', size: '约 200 万(实在册)', satisfaction: 22, influence: 30,
        privileges: '世袭卫所田·子弟袭职',
        obligations: '军籍不能脱·应世世当兵·无饷即逃',
        economicRole: '军事', unrestThreshold: 20,
        demands: '补发欠饷·允脱军籍·归还被占屯田',
        representativeNpcs: ['满桂', '赵率教', '祖大寿'],
        leaders: ['袁崇焕(即督关宁)', '孙承宗(元老)', '毛文龙(东江)'],
        supportingParties: [],
        regionalVariants: [
          { region: '辽东/关宁', satisfaction: 38, distinguishing: '精锐·饷虽欠但战斗力在' },
          { region: '九边其他', satisfaction: 20, distinguishing: '欠饷严重·虚额过半' },
          { region: '京营', satisfaction: 30, distinguishing: '老弱·阉党兼任监军' },
          { region: '内地卫所', satisfaction: 18, distinguishing: '屯田被侵吞·兵虚' }
        ],
        internalFaction: [
          { name: '战兵精锐(关宁/戚家军)', size: '15%', stance: '战力强·饷可博' },
          { name: '家丁亲兵', size: '5%', stance: '总兵私人武装·最忠最强' },
          { name: '戍卒(普通军户)', size: '55%', stance: '世袭苦守·常哗变' },
          { name: '逃兵', size: '25%', stance: '已逃亡·流民民变种子' }
        ],
        unrestLevels: { grievance: 20, petition: 38, strike: 55, revolt: 68 },
        economicIndicators: { wealth: 18, taxBurden: 72, landHolding: 22 }
      },
      {
        name: '僧道·外籍', description: '佛教僧尼/道士/天主教/回教/犹太人/西域/日本侨民。僧道免赋，朝廷屡禁未果。天主教自利玛窦以降渐入士林。',
        mobility: '中(还俗易)', status: '度牒(僧道)/外化(外籍)', size: '约 50 万', satisfaction: 55, influence: 18,
        privileges: '免徭役免税·免罪(僧道)',
        obligations: '须有度牒·不得与世俗争利·外籍须有市舶司牍',
        economicRole: '宗教/其他', unrestThreshold: 40,
        demands: '保护寺产·允传教·开放互市',
        representativeNpcs: ['汤若望(天主教·即将入华)', '徐光启(在家受洗)'],
        leaders: ['利玛窦门生', '北京天主堂神父'],
        supportingParties: [],
        regionalVariants: [
          { region: '京师', satisfaction: 65, distinguishing: '天主教有堂·与士大夫交' },
          { region: '江南', satisfaction: 58, distinguishing: '佛寺最盛·徐光启籍地' },
          { region: '西北', satisfaction: 42, distinguishing: '回民聚居·伊斯兰教' },
          { region: '闽粤', satisfaction: 60, distinguishing: '妈祖·海商结合' },
          { region: '西南', satisfaction: 55, distinguishing: '藏传佛教·民间信仰多元' }
        ],
        internalFaction: [
          { name: '佛僧', size: '50%', stance: '寺产为重' },
          { name: '道士', size: '20%', stance: '法师·风水·丹药' },
          { name: '天主教士+教徒', size: '3%', stance: '传教·入仕徐光启一路' },
          { name: '伊斯兰回民', size: '15%', stance: '聚居互助' },
          { name: '西域/日/朝侨民', size: '12%', stance: '商贸或避难' }
        ],
        unrestLevels: { grievance: 58, petition: 72, strike: 88, revolt: 95 },
        economicIndicators: { wealth: 48, taxBurden: 12, landHolding: 18 }
      }
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
      // (太仓银储量比已删除——与七大核心中的国库资金功能重叠)
      { name: '银荒指数', value: 55, min: 0, max: 100, cat: '财政', desc: '白银流通紧张度。一条鞭法后民间银两需求激增，美洲银流入放缓则银价昂贵。超 70 即钱贱谷贵民不聊生。', inversed: true },
      { name: '宝泉局铸钱量', value: 40, min: 0, max: 100, cat: '财政', desc: '工部宝源局/户部宝泉局岁铸制钱(铜钱)数量。明末铸币减少，私铸盛行。' },
      { name: '海贸银流入', value: 28, min: 0, max: 100, cat: '财政', desc: '马尼拉-月港-澳门海贸流入白银。天启七年荷西竞争影响流速。' },
      // ──── 经济 ────
      { name: '江南商税抵制度', value: 75, min: 0, max: 100, cat: '经济', desc: '江南缙绅对商税/矿税的抵制程度。矿税于 1625 年罢。', inversed: true },
      { name: '海商势力', value: 25, min: 0, max: 100, cat: '经济', desc: '郑芝龙为首的海商集团崛起程度。' },
      { name: '漕运通畅度', value: 58, min: 0, max: 100, cat: '经济', desc: '京杭大运河江南至通州段。淤堵频发。' },
      // ──── 军事 ────
      { name: '辽东防线稳固度', value: 42, min: 0, max: 100, cat: '军事', desc: '袁崇焕去后，辽东经略未定。王之臣老病。关宁锦防线核心未失。' },
      // ──── 民生/环境 ────
      { name: '流民数量', value: 900000, min: 0, max: 50000000, unit: '口', cat: '民生', desc: '北直隶/陕西/山东流民估数。三年连旱将加速。', inversed: true },
      { name: '小冰河凛冬指数', value: 68, min: 0, max: 100, cat: '环境', desc: '1627 冬寒异常。未来三年将更严酷。', inversed: true },
      { name: '西北灾荒怨气', value: 76, min: 0, max: 100, cat: '民生', desc: '陕北已三年大旱，观音土食尽，草根掘尽。民变在即。', inversed: true },
      // ──── 制度/风气 ────
      { name: '卫所虚额率', value: 62, min: 0, max: 100, cat: '军事', desc: '九边卫所"在册"与"实存"差距。>60 即战事无可用兵。', inversed: true },
      { name: '官场冗员指数', value: 55, min: 0, max: 100, cat: '政治', desc: '超定员的闲散官。阉党"恩荫"泛滥，卖官鬻爵。', inversed: true },
      { name: '言路通塞', value: 22, min: 0, max: 100, cat: '政治', desc: '科道敢言度。阉党时"讳言国事、谏者必诛"。高则言路畅，低则噤声。' },
      { name: '科举选士质量', value: 45, min: 0, max: 100, cat: '政治', desc: '会试/殿试取中者之素质与独立性。阉党座主门生勾结严重。' },
      { name: '诏狱案件积压', value: 78, min: 0, max: 100, cat: '政治', desc: '锦衣卫北镇抚司未决案件。天启朝诏狱杀人无数，积压亦重。', inversed: true },
      // ──── 社会/水利 ────
      { name: '黄河水利失修度', value: 68, min: 0, max: 100, cat: '环境', desc: '黄河淮河堤防失修。万历末至天启连年溃决，田卢漂没。', inversed: true },
      { name: '宗族兼并度', value: 72, min: 0, max: 100, cat: '经济', desc: '宗藩/缙绅侵占民田之烈度。福王田 4 万顷即典型。', inversed: true },
      { name: '天下文社数', value: 18, min: 0, max: 100, cat: '政治', desc: '文人社团（将孕育复社）。以士子议政、讲学、联属试卷为名。' }
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
      { from: '仁祖李倧', to: '朱由检', type: '藩臣', value: 80, desc: '事大至诚，又苦后金。' },
      // ──── 补充：师承·同榜·恩仇 ────
      { from: '徐光启', to: '利玛窦', type: '亡友·教父', value: 95, desc: '1600 年订交，1604 合译《几何原本》；利玛窦 1610 卒时徐执丧礼。' },
      { from: '徐光启', to: '汤若望', type: '同道·天主教', value: 85, desc: '将于崇祯二年历局共事。' },
      { from: '孙承宗', to: '朱由校', type: '师生', value: 90, desc: '熹宗东宫讲官。讲学二十余次。' },
      { from: '孙承宗', to: '朱由检', type: '师(间接)', value: 72, desc: '新帝幼时亦闻孙师讲义。' },
      { from: '毛文龙', to: '皇太极', type: '疑似通敌', value: -70, desc: '暗中书信往来，原史袁崇焕斩之口实。' },
      { from: '满桂', to: '祖大寿', type: '同袍·微隙', value: 40, desc: '宁远共守，宁锦分功时小有龃龉。' },
      { from: '钱谦益', to: '钱龙锡', type: '同党·族亲', value: 70, desc: '同属东林，同族同籍。' },
      { from: '温体仁', to: '钱谦益', type: '将仇', value: -60, desc: '崇祯元年会推阁臣，温排斥钱引钩党案。' },
      { from: '卢象升', to: '周延儒', type: '同籍宜兴·微交', value: 55, desc: '同为常州宜兴人。' },
      { from: '孙传庭', to: '洪承畴', type: '同仇·将共剿贼', value: 65, desc: '日后同任陕西剿闯。' },
      // ──── 后金内部 ────
      { from: '多尔衮', to: '多铎', type: '同母兄弟', value: 95, desc: '同为阿巴亥所生；幼时丧母，相依为命。' },
      { from: '多尔衮', to: '皇太极', type: '弟·暗仇', value: 45, desc: '母被逼殉葬之仇——日后摄政即复。' },
      { from: '范文程', to: '皇太极', type: '主从·谋主', value: 90, desc: '深入赞画，皇太极大政必询。' },
      { from: '代善', to: '莽古尔泰', type: '兄弟·离心', value: 35, desc: '莽古尔泰骄横，与代善不睦。' },
      // ──── 家族/子嗣 ────
      { from: '祖大寿', to: '吴襄', type: '姻亲·妹夫', value: 75, desc: '祖大寿妹嫁吴襄。吴襄子吴三桂（此时 15 岁）日后引清入关。' },
      { from: '郑芝龙', to: '田川松', type: '夫妻', value: 80, desc: '平户日女，郑成功(3岁)之母。' },
      { from: '郑芝龙', to: '郑成功', type: '父子', value: 85, desc: '日后冲突——郑芝龙降清，郑成功抗清。' },
      // ──── 朝堂群像 ────
      { from: '东林党', to: '阉党', type: '群体血仇', value: -95, desc: '杨涟左光斗等六君子死诏狱之仇不共戴天。' },
      { from: '士大夫', to: '缙绅', type: '相倚', value: 70, desc: '士大夫退职即为缙绅。互为根基。' },
      { from: '缙绅', to: '自耕农', type: '兼并·盘剥', value: -55, desc: '明末土地兼并急剧，缙绅以包揽粮税侵吞自耕农。' },
      { from: '军户', to: '边将家丁', type: '被压榨', value: -40, desc: '总兵家丁为精锐，军户为炮灰，饷银层层被私扣。' },
      // ──── 对玩家 ────
      { from: '朱由检', to: '阉党', type: '君主vs群体·欲除', value: -80 },
      { from: '朱由检', to: '东林党', type: '君主vs群体·欲用', value: 50 }
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
      },
      // ═══ 补充：六科给事中（独立言官，监察六部） ═══
      {
        id: _uid('off_'), name: '六科给事中', desc: '吏/户/礼/兵/刑/工 各科。独立于都察院。掌抄发章疏、科参稽核，权重位尊，小臣制大臣',
        positions: [
          { name: '吏科都给事中', rank: '正七品', holder: '', establishedCount: 1, vacancyCount: 1, authority: 'supervision', powers: { impeach: true, supervise: true }, duties: '驳正吏部之误；核察文选升降。', bindingHint: 'ministry' },
          { name: '户科都给事中', rank: '正七品', holder: '', establishedCount: 1, vacancyCount: 1, authority: 'supervision', powers: { impeach: true, supervise: true }, duties: '户部钱粮事关。阉党把持多年。' },
          { name: '礼科都给事中', rank: '正七品', holder: '', establishedCount: 1, vacancyCount: 1, authority: 'supervision', powers: { impeach: true } },
          { name: '兵科都给事中', rank: '正七品', holder: '', establishedCount: 1, vacancyCount: 1, authority: 'supervision', powers: { impeach: true, supervise: true }, duties: '辽东兵饷甘苦最苦。' },
          { name: '刑科都给事中', rank: '正七品', holder: '', establishedCount: 1, vacancyCount: 1, authority: 'supervision', powers: { impeach: true } },
          { name: '工科都给事中', rank: '正七品', holder: '', establishedCount: 1, vacancyCount: 1, authority: 'supervision', powers: { impeach: true } },
          { name: '各科给事中', rank: '从七品', holder: '', establishedCount: 50, vacancyCount: 15, authority: 'supervision', powers: { impeach: true } }
        ],
        subs: []
      },
      // ═══ 钦天监（天象历法，本剧本异象触发关键） ═══
      {
        id: _uid('off_'), name: '钦天监', desc: '掌天象/历法/占卜/冠礼阴阳。元设司天监，明洪武改钦天监',
        positions: [
          { name: '钦天监监正', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '总理天象观测、报异象于帝。彗星日食月食地震皆由此奏。', bindingHint: 'ministry', hooks: { triggerOnHeavenSign: '必即日奏闻' } },
          { name: '监副', rank: '正六品', holder: '', establishedCount: 2, vacancyCount: 1 },
          { name: '五官正', rank: '从六品', holder: '', establishedCount: 5, vacancyCount: 2, duties: '春官正/夏官正/秋官正/冬官正/中官正。分掌五行占星。' },
          { name: '博士/挈壶正', rank: '从八品', holder: '', establishedCount: 10, vacancyCount: 3 }
        ],
        subs: []
      },
      // ═══ 太医院 ═══
      {
        id: _uid('off_'), name: '太医院', desc: '御医及天下医政',
        positions: [
          { name: '太医院使', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '总领御医，亦诊治百官。' },
          { name: '御医', rank: '正八品', holder: '', establishedCount: 10, vacancyCount: 2 },
          { name: '吏目·医士', rank: '从九品', holder: '', establishedCount: 40, vacancyCount: 10 }
        ],
        subs: []
      },
      // ═══ 五寺（太常/光禄/太仆/鸿胪/尚宝） ═══
      {
        id: _uid('off_'), name: '太常寺', desc: '掌祭祀礼乐',
        positions: [
          { name: '太常寺卿', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '祭祀天地宗庙；礼乐典章。'}
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '光禄寺', desc: '掌宫廷宴享·皇家膳食',
        positions: [
          { name: '光禄寺卿', rank: '从三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '办万寿/千秋/进贡各节宴；宫廷果饼。', publicTreasuryInit: { money: 80000, grain: 50000, cloth: 0 }, bindingHint: 'imperial', privateIncome: { illicitRisk: 'medium', bonusNote: '采买时常油水' } }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '太仆寺', desc: '掌马政·九边战马',
        positions: [
          { name: '太仆寺卿', rank: '从三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '掌全国马政。北直隶/山东/河南/陕西/南直隶五省牧监。', publicTreasuryInit: { money: 60000, grain: 20000, cloth: 0 }, bindingHint: 'military', powers: { militaryCommand: false } },
          { name: '寺丞·苑马寺', rank: '正六品', holder: '', establishedCount: 8, vacancyCount: 3 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '鸿胪寺', desc: '掌朝会礼仪·外藩宾客',
        positions: [
          { name: '鸿胪寺卿', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '朝会班序；番使入朝引导；皇族婚丧典礼。', bindingHint: 'imperial' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '尚宝司', desc: '掌御用印玺',
        positions: [
          { name: '尚宝司卿', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '保管二十五宝玺。铨用多勋戚。' }
        ],
        subs: []
      },
      // ═══ 国子监·宗人府 ═══
      {
        id: _uid('off_'), name: '国子监', desc: '天下最高学府',
        positions: [
          { name: '国子监祭酒', rank: '从四品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '教育监生。南北两监。' },
          { name: '司业', rank: '正六品', holder: '', establishedCount: 2, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '宗人府', desc: '管理皇族宗室',
        positions: [
          { name: '宗人令', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 0, duties: '宗室首席。常由亲王兼。目前空缺。', bindingHint: 'imperial' },
          { name: '左/右宗正', rank: '正一品', holder: '', establishedCount: 2, vacancyCount: 2 },
          { name: '经历司经历', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 0, duties: '日常文书、宗室档案。' }
        ],
        subs: []
      },
      // ═══ 三公三孤（虚衔加衔，无实职但地位尊崇） ═══
      {
        id: _uid('off_'), name: '三公·三孤·三少', desc: '虚衔加衔。明代三公(太师/太傅/太保 正一品)、三孤(少师/少傅/少保 从一品)、三少(太子太师/太子太傅/太子太保 正二品)，多为加官',
        positions: [
          { name: '太师(虚职)', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '最高加衔。多用于大臣赠谥。' },
          { name: '太傅(虚职)', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '太保(虚职)', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '少师(加衔)', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '少傅(加衔)', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '少保(加衔)', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      // ═══ 御马监（内廷武职） ═══
      {
        id: _uid('off_'), name: '御马监', desc: '内廷十二监之一。掌御用战马 + 四卫营（腾骧左卫/右卫/武骧左卫/右卫）',
        positions: [
          { name: '提督太监·御马监', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 0, authority: 'execution', duties: '掌皇城武备。与司礼监并称"两大监"。', bindingHint: 'imperial', privateIncome: { illicitRisk: 'high' }, powers: { militaryCommand: true } },
          { name: '掌印太监', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 0 }
        ],
        subs: []
      },
      // ═══ 内官十二监（简化）——御马监已单列，此处仅列其余 ═══
      {
        id: _uid('off_'), name: '内官监·其余诸监', desc: '内官监/神宫监/尚宝监/印绶监/直殿监/尚衣监/尚膳监/都知监/内织染局/内承运库 等',
        positions: [
          { name: '内官监掌印', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 0, duties: '掌营造、御用之物。', bindingHint: 'imperial' },
          { name: '神宫监掌印', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 0, duties: '掌太庙洒扫/陵寝。', bindingHint: 'imperial' },
          { name: '尚衣监掌印', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 0 },
          { name: '尚膳监掌印', rank: '正四品', holder: '', establishedCount: 1, vacancyCount: 0 },
          { name: '内承运库掌库', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 0, duties: '内帑金银仓。', bindingHint: 'imperial', privateIncome: { illicitRisk: 'high' } }
        ],
        subs: []
      },
      // ═══ 十三布政使司（地方正官） ═══
      {
        id: _uid('off_'), name: '布政使司（两京十三省）', desc: '每省：左右布政使（从二品）+ 参政+参议。掌民政与钱粮。北直隶/南直隶无布政使司，直属六部',
        positions: [
          { name: '浙江左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region', publicTreasuryInit: { money: 300000, grain: 700000, cloth: 120000 } },
          { name: '江西左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region', publicTreasuryInit: { money: 160000, grain: 480000, cloth: 70000 } },
          { name: '湖广左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '福建左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '山东左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '山西左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '河南左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '陕西左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '四川左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '广东左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '广西左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '云南左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' },
          { name: '贵州左布政使', rank: '从二品', holder: '', establishedCount: 1, vacancyCount: 0, bindingHint: 'region' }
        ],
        subs: []
      },
      // ═══ 十三按察使司 ═══
      {
        id: _uid('off_'), name: '按察使司（十三省）', desc: '每省：提刑按察使（正三品）+ 副使+佥事。掌刑名与监察',
        positions: [
          { name: '各省按察使', rank: '正三品', holder: '', establishedCount: 13, vacancyCount: 3, authority: 'supervision', powers: { impeach: true, supervise: true }, bindingHint: 'region', duties: '提点刑狱、稽察属吏。' }
        ],
        subs: []
      },
      // ═══ 都指挥使司 ═══
      {
        id: _uid('off_'), name: '都指挥使司（省级卫所）', desc: '都司：每省（含北直/南直/辽东等）均设。掌卫所军户',
        positions: [
          { name: '各省都指挥使', rank: '正二品', holder: '', establishedCount: 16, vacancyCount: 4, bindingHint: 'military', powers: { militaryCommand: true }, duties: '节制本省卫所。明中叶后已虚化，实权归总兵。' }
        ],
        subs: []
      },
      // ═══ 九边总兵 ═══
      {
        id: _uid('off_'), name: '九边总兵', desc: '辽东/蓟州/宣府/大同/山西/延绥/宁夏/甘肃/固原',
        positions: [
          { name: '辽东总兵', rank: '从一品', holder: '(袁崇焕去后尚未定)', establishedCount: 1, vacancyCount: 0, bindingHint: 'military', powers: { militaryCommand: true }, publicTreasuryInit: { money: 200000, grain: 400000, cloth: 50000 } },
          { name: '蓟州总兵', rank: '从一品', holder: '朱梅', establishedCount: 1, vacancyCount: 0, bindingHint: 'military' },
          { name: '宣府总兵', rank: '从一品', holder: '侯世禄', establishedCount: 1, vacancyCount: 0, bindingHint: 'military' },
          { name: '大同总兵', rank: '从一品', holder: '渠家祯', establishedCount: 1, vacancyCount: 0, bindingHint: 'military' },
          { name: '山西总兵', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1, bindingHint: 'military' },
          { name: '延绥总兵', rank: '从一品', holder: '吴自勉', establishedCount: 1, vacancyCount: 0, bindingHint: 'military' },
          { name: '宁夏总兵', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1, bindingHint: 'military' },
          { name: '甘肃总兵', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1, bindingHint: 'military' },
          { name: '固原总兵', rank: '从一品', holder: '', establishedCount: 1, vacancyCount: 1, bindingHint: 'military' }
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

    // ═══════════════════════════════════════════════════════════════════
    // 顶级行政区划 · 两京十三布政使司 + 辽东都指挥使司
    // 人口口数参考：《明实录》天启六年黄册 + 经济重心南移修正。
    // 每省俱含：户口三元/族群/信仰/保甲/承载力/财政/公库/民心·腐败，
    // 本剧本按用户要求"只生成最高一级"，子级府县由推演 AI 按需生成。
    // ═══════════════════════════════════════════════════════════════════
    return {
      player: {
        factionId: 'fac-ming',
        factionName: '明朝廷',
        divisions: [
          // ═══ 两京 ═══
          division({
            name: '北直隶', level: 'province', officialPosition: '顺天巡抚', governor: '刘诏',
            description: '京师所在，天下首善。下辖顺天/保定/河间/真定/大名/永平/顺德/广平八府 + 延庆/保安两州 + 宣府镇。宣府为九边第一。',
            populationDetail: { mouths: 8200000, fugitives: 180000, hiddenCount: 200000 },
            terrain: '平原', specialResources: '漕运·煤·铁·海盐(长芦)', taxLevel: '重',
            publicTreasuryInit: { money: 400000, grain: 800000, cloth: 60000 },
            minxinLocal: 46, corruptionLocal: 74,
            byFaith: { '儒': 0.40, '佛': 0.18, '道': 0.14, '民间': 0.25, '伊斯兰': 0.03 }
          }),
          division({
            name: '南直隶', level: 'province', officialPosition: '应天巡抚', governor: '毛一鹭',
            description: '留都应天府所在，财赋半天下。下辖应天/凤阳/庐州/淮安/扬州/徐州/苏州/松江/常州/镇江/太平/宁国/池州/安庆十四府。苏松赋甲天下。',
            populationDetail: { mouths: 16500000, fugitives: 150000, hiddenCount: 550000 },
            terrain: '平原', specialResources: '丝绸·棉布·茶·漕米·盐(两淮)', taxLevel: '重',
            publicTreasuryInit: { money: 800000, grain: 1500000, cloth: 200000 },
            minxinLocal: 55, corruptionLocal: 66,
            byFaith: { '儒': 0.45, '佛': 0.22, '道': 0.15, '民间': 0.14, '天主教': 0.02, '伊斯兰': 0.02 }
          }),
          // ═══ 十三布政使司 ═══
          division({
            name: '浙江布政使司', level: 'province', officialPosition: '浙江巡抚', governor: '潘汝桢',
            description: '东南形胜。下辖杭/嘉/湖/宁/绍/台/金华/衢/严/温/处十一府。杭州为东南财赋中枢，宁波通日本朝鲜；潘汝桢附阉党首建生祠。',
            populationDetail: { mouths: 7800000, fugitives: 80000, hiddenCount: 250000 },
            terrain: '丘陵', specialResources: '丝绸·茶·纸·瓷·海贸', taxLevel: '重',
            publicTreasuryInit: { money: 500000, grain: 900000, cloth: 180000 },
            minxinLocal: 58, corruptionLocal: 68,
            byFaith: { '儒': 0.42, '佛': 0.26, '道': 0.18, '民间': 0.13, '天主教': 0.01 }
          }),
          division({
            name: '江西布政使司', level: 'province', officialPosition: '江西巡抚', governor: '解经邦',
            description: '文献之邦。下辖南昌/饶州/广信/南康/九江/建昌/抚州/临江/吉安/瑞州/袁州/赣州/南安十三府。景德镇御窑所在。',
            populationDetail: { mouths: 6800000, fugitives: 60000, hiddenCount: 200000 },
            terrain: '丘陵', specialResources: '瓷(景德镇)·纸·米·茶', taxLevel: '中',
            publicTreasuryInit: { money: 260000, grain: 620000, cloth: 90000 },
            minxinLocal: 52, corruptionLocal: 62,
            byFaith: { '儒': 0.48, '佛': 0.22, '道': 0.20, '民间': 0.10 }
          }),
          division({
            name: '湖广布政使司', level: 'province', officialPosition: '湖广巡抚', governor: '姚宗文',
            description: '楚地广大。下辖武昌/汉阳/黄州/承天/德安/岳州/荆州/襄阳/郧阳/长沙/宝庆/衡州/常德/辰州/永州十五府 + 靖州等。"湖广熟、天下足"。',
            populationDetail: { mouths: 6200000, fugitives: 100000, hiddenCount: 180000 },
            terrain: '平原', specialResources: '稻米·茶·桐油·湘水军器', taxLevel: '中',
            publicTreasuryInit: { money: 200000, grain: 720000, cloth: 65000 },
            minxinLocal: 50, corruptionLocal: 60,
            byFaith: { '儒': 0.40, '佛': 0.22, '道': 0.25, '民间': 0.13 }
          }),
          division({
            name: '福建布政使司', level: 'province', officialPosition: '福建巡抚', governor: '朱一冯',
            description: '沿海省份。下辖福州/兴化/泉州/漳州/延平/建宁/邵武/汀州八府 + 福宁州。海禁时松时紧；郑芝龙等海商据闽南。',
            populationDetail: { mouths: 4800000, fugitives: 70000, hiddenCount: 300000 },
            terrain: '沿海', specialResources: '海贸·茶·糖·木材·海船', taxLevel: '中',
            publicTreasuryInit: { money: 180000, grain: 340000, cloth: 45000 },
            minxinLocal: 54, corruptionLocal: 63,
            byFaith: { '儒': 0.40, '佛': 0.28, '道': 0.18, '民间': 0.12, '天主教': 0.02 }
          }),
          division({
            name: '山东布政使司', level: 'province', officialPosition: '山东巡抚', governor: '李精白',
            description: '孔孟之乡。下辖济南/兖州/东昌/青州/莱州/登州六府 + 辽海卫属。登州为对辽前哨，孙元化日后所驻。',
            populationDetail: { mouths: 5400000, fugitives: 95000, hiddenCount: 150000 },
            terrain: '平原', specialResources: '盐(长芦下延)·麦·棉·铁·海鲜', taxLevel: '中',
            publicTreasuryInit: { money: 240000, grain: 580000, cloth: 70000 },
            minxinLocal: 44, corruptionLocal: 65,
            byFaith: { '儒': 0.52, '佛': 0.16, '道': 0.16, '民间': 0.14, '伊斯兰': 0.02 }
          }),
          division({
            name: '山西布政使司', level: 'province', officialPosition: '山西巡抚', governor: '牟志夔',
            description: '表里山河。下辖太原/平阳/潞安/汾州/大同/泽州/辽州/沁州等。北有大同九边，南有平阳盐池；晋商巨贾。',
            populationDetail: { mouths: 5200000, fugitives: 120000, hiddenCount: 140000 },
            terrain: '山地', specialResources: '煤·铁·盐(运城)·马·晋商', taxLevel: '中',
            publicTreasuryInit: { money: 220000, grain: 480000, cloth: 40000 },
            minxinLocal: 40, corruptionLocal: 68,
            byFaith: { '儒': 0.42, '佛': 0.20, '道': 0.22, '民间': 0.15, '伊斯兰': 0.01 },
            carryingCapacity: { arable: 4800000, water: 4200000, climate: 0.82, historicalCap: 5500000, currentLoad: 0.98, carryingRegime: 'strained' }
          }),
          division({
            name: '河南布政使司', level: 'province', officialPosition: '河南巡抚', governor: '郭增光',
            description: '中州古地。下辖开封/归德/河南/怀庆/彰德/卫辉/南阳/汝宁八府。福王就国洛阳，侵吞大量民田。黄河频溃。',
            populationDetail: { mouths: 5600000, fugitives: 160000, hiddenCount: 180000 },
            terrain: '平原', specialResources: '麦·棉·豆·药材', taxLevel: '重',
            publicTreasuryInit: { money: 180000, grain: 520000, cloth: 55000 },
            minxinLocal: 38, corruptionLocal: 72,
            carryingCapacity: { arable: 5200000, water: 4600000, climate: 0.78, historicalCap: 6000000, currentLoad: 1.05, carryingRegime: 'strained' }
          }),
          division({
            name: '陕西布政使司', level: 'province', officialPosition: '陕西巡抚', governor: '胡廷宴',
            description: '秦地饥馑之乡。下辖西安/凤翔/汉中/平凉/巩昌/临洮六府 + 延安/庆阳/榆林镇 + 宁夏/甘肃/固原/延绥四镇。三边总督武之望节制。连年大旱，民变之薪积。',
            populationDetail: { mouths: 5800000, fugitives: 420000, hiddenCount: 220000 },
            terrain: '山地', specialResources: '棉·盐·铁·马·边塞', taxLevel: '重',
            publicTreasuryInit: { money: 60000, grain: 80000, cloth: 10000 },
            minxinLocal: 20, corruptionLocal: 76,
            carryingCapacity: { arable: 6000000, water: 5500000, climate: 0.62, historicalCap: 7000000, currentLoad: 1.15, carryingRegime: 'famine' },
            byFaith: { '儒': 0.35, '佛': 0.18, '道': 0.18, '民间': 0.23, '伊斯兰': 0.06 }
          }),
          division({
            name: '四川布政使司', level: 'province', officialPosition: '四川巡抚', governor: '尹同皋',
            description: '天府之国。下辖成都/保宁/顺庆/夔州/重庆/夔门 + 嘉定/眉/邛等州。西番土司林立；川西藏缅杂处。',
            populationDetail: { mouths: 3400000, fugitives: 50000, hiddenCount: 350000 },
            terrain: '山地', specialResources: '米·蜀锦·茶·盐井·药材', taxLevel: '轻',
            publicTreasuryInit: { money: 120000, grain: 380000, cloth: 50000 },
            minxinLocal: 48, corruptionLocal: 58,
            byEthnicity: { '汉': 0.82, '藏': 0.08, '彝': 0.05, '其他': 0.05 },
            byFaith: { '儒': 0.36, '佛': 0.22, '道': 0.24, '民间': 0.14, '藏传佛教': 0.04 }
          }),
          division({
            name: '广东布政使司', level: 'province', officialPosition: '广东巡抚', governor: '李待问',
            description: '岭海之邦。下辖广州/韶州/南雄/惠州/潮州/肇庆/高州/雷州/廉州/琼州十府。广州为海上贸易枢纽，葡萄牙居澳门；琼州辖海南岛。',
            populationDetail: { mouths: 3200000, fugitives: 40000, hiddenCount: 200000 },
            terrain: '沿海', specialResources: '海贸·糖·果·珠(合浦)·瓷·香料', taxLevel: '中',
            publicTreasuryInit: { money: 240000, grain: 280000, cloth: 60000 },
            minxinLocal: 56, corruptionLocal: 60,
            byEthnicity: { '汉': 0.85, '壮': 0.06, '黎': 0.04, '瑶': 0.03, '其他': 0.02 },
            byFaith: { '儒': 0.40, '佛': 0.22, '道': 0.18, '民间': 0.15, '天主教': 0.03, '伊斯兰': 0.02 }
          }),
          division({
            name: '广西布政使司', level: 'province', officialPosition: '广西巡抚', governor: '毛堪',
            description: '山川险阻。下辖桂林/平乐/梧州/浔州/柳州/庆远/思恩/南宁/太平/镇安/思明十余府。僮/瑶/苗诸民杂居；土司林立。',
            populationDetail: { mouths: 1800000, fugitives: 30000, hiddenCount: 180000 },
            terrain: '山地', specialResources: '桂皮·药材·糯米·马', taxLevel: '轻',
            publicTreasuryInit: { money: 60000, grain: 160000, cloth: 18000 },
            minxinLocal: 44, corruptionLocal: 58,
            byEthnicity: { '汉': 0.45, '壮': 0.35, '瑶': 0.10, '苗': 0.06, '其他': 0.04 },
            regionType: 'normal'
          }),
          division({
            name: '云南布政使司', level: 'province', officialPosition: '云南巡抚', governor: '闵洪学',
            description: '西南边陲。下辖云南/大理/临安/楚雄/澂江/广西/广南/曲靖/姚安/鹤庆/丽江等府 + 木氏/沐氏土司。黔国公沐天波世镇云南。',
            populationDetail: { mouths: 1400000, fugitives: 20000, hiddenCount: 120000 },
            terrain: '山地', specialResources: '铜·银·锡·茶·马·木材', taxLevel: '轻',
            publicTreasuryInit: { money: 50000, grain: 140000, cloth: 15000 },
            minxinLocal: 50, corruptionLocal: 55,
            byEthnicity: { '汉': 0.42, '彝': 0.18, '白': 0.12, '纳西': 0.08, '苗': 0.06, '傣': 0.05, '其他': 0.09 },
            byFaith: { '儒': 0.25, '佛': 0.30, '道': 0.10, '藏传佛教': 0.10, '民间': 0.22, '伊斯兰': 0.03 },
            regionType: 'normal'
          }),
          division({
            name: '贵州布政使司', level: 'province', officialPosition: '贵州巡抚', governor: '王瑊',
            description: '黔中山地。下辖贵阳/思南/镇远/思州/石阡/铜仁/都匀/平越/黎平/安顺等府 + 水西安氏、播州杨氏（1600年被平）、永宁奢氏（1621起事）等大土司。奢安之乱刚平定。',
            populationDetail: { mouths: 900000, fugitives: 60000, hiddenCount: 140000 },
            terrain: '山地', specialResources: '汞·铅·朱砂·马·木材', taxLevel: '轻',
            publicTreasuryInit: { money: 30000, grain: 80000, cloth: 8000 },
            minxinLocal: 38, corruptionLocal: 65,
            byEthnicity: { '汉': 0.28, '苗': 0.28, '布依': 0.16, '侗': 0.10, '彝': 0.08, '其他': 0.10 },
            byFaith: { '儒': 0.18, '佛': 0.20, '道': 0.12, '民间': 0.45, '伊斯兰': 0.05 },
            regionType: 'tusi'
          }),
          // ═══ 都司卫所 ═══
          division({
            name: '辽东都指挥使司', level: 'province', officialPosition: '辽东经略', governor: '王之臣',
            description: '九边之首。山东布政使司节制。辖辽阳/广宁/沈阳/铁岭/开原/锦州/广宁卫/宁远卫/前屯卫/山海关等二十五卫。沈阳/辽阳已陷后金；现只余辽西走廊+山海关+东江镇(皮岛)。',
            populationDetail: { mouths: 850000, fugitives: 220000, hiddenCount: 90000 },
            terrain: '山地', specialResources: '马·皮毛·人参·煤·铁', taxLevel: '轻',
            publicTreasuryInit: { money: 150000, grain: 300000, cloth: 20000 },
            regionType: 'normal', minxinLocal: 38, corruptionLocal: 58,
            byEthnicity: { '汉': 0.70, '女真': 0.14, '蒙古': 0.10, '朝鲜': 0.04, '其他': 0.02 },
            carryingCapacity: { arable: 800000, water: 900000, climate: 0.74, historicalCap: 1200000, currentLoad: 1.06, carryingRegime: 'strained' }
          }),
          // ═══ 羁縻 ═══
          division({
            name: '乌思藏都指挥使司', level: 'province', officialPosition: '灌顶国师', governor: '(五世达赖未立·此时洛桑嘉措幼)',
            description: '乌思藏(前藏)及朵甘(康区)。此时为藏传佛教格鲁/噶举诸派并立之局。明朝以册封诸派法王与赐金印羁縻之。实际内政由各大寺院与土司自治。',
            populationDetail: { mouths: 500000, fugitives: 0, hiddenCount: 300000 },
            terrain: '山地', specialResources: '马·羊毛·药材·盐(湖盐)·金', taxLevel: '贡赋',
            publicTreasuryInit: { money: 5000, grain: 10000, cloth: 1000 },
            regionType: 'jimi', minxinLocal: 55, corruptionLocal: 50,
            byEthnicity: { '藏': 0.94, '汉': 0.02, '蒙古': 0.02, '其他': 0.02 },
            byFaith: { '藏传佛教': 0.92, '苯教': 0.06, '其他': 0.02 },
            fiscalDetail: { claimedRevenue: 50000, actualRevenue: 20000, remittedToCenter: 5000, retainedBudget: 40000, compliance: 0.15, skimmingRate: 0.30, autonomyLevel: 0.9 }
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
