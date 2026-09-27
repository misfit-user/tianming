// 晚唐剧本·外藩补入的史实人物（阶段三第六刀之三用）
//
// 外藩批量代表删去后，许多势力没有一个人。这里补入开局时在世、史籍有名、开局前已有身份可考的人物。
// 核查见 sources/tang-research/foreign-east.json、foreign-west-south.json 的 people 一节；日本四位公卿与小野篁的生年、性情
// 另据《续日本后纪》卷十三、十六、十七与《文德实录》卷四的薨卒传（原文存 E:/tianming-tmp/tang/research/raw，引文照录）。
//
// 写法同唐廷补人（data/tang-people-new.js）：
//   - 生平只写开局前史料所见的身份与事迹；开局以后的事（回鹘牙帐被破、吐蕃内乱等）一概不写。
//   - 性情只写史料明文（日本诸人薨传、尚婢婢传），其余留空，由推演按引擎本来的做法生成。
//   - 年龄：史载享年可推的照算开局周岁；无考的，官员、将领、君长取五十五岁（同唐廷补人），王子、特勒取三十五岁，妃取三十岁。
//   - 才具与五常：按唐廷文臣（或军将）中位数略低一档（同唐廷补人），有行迹的逐项加减并在 wuchang.note 写明。
//     这里只是补人时的起点，第七刀之三按史料逐人重定（data/tang-abilities.js）。
//   - 所在：史料不明的，王廷人物放在都城或牙帐；开成四年十二月入唐朝贡的渤海王子、契丹奚室韦首领，开局时是否仍在长安不可考，放在本部。
//   - 迦摩缕波、环王两位国王只有铭文研究的二手年代，可信度 L。
'use strict';

const { CIVIL, MILITARY, stats, wuchang } = require('./tang-people-new.js');

const TJ246 = '《资治通鉴》卷二百四十六·开成四年：“回鶻相安允合、特勒柴革謀作亂，彰信可汗殺之。相掘羅勿將兵在外，以馬三百賂沙陀朱邪赤心，借其兵共攻可汗。可汗兵敗，自殺，國人立馺特勒爲可汗。會歳疫，大雪，羊、馬多死，回鶻遂衰。”';
const TJ246_AFTER = '《资治通鉴》卷二百四十六·开成五年（开局后事，只取身份）：“回鶻別將句録莫賀引黠戛斯十萬騎攻回鶻……其相馺職、特勒厖等……西奔葛邏祿……可汗兄弟嗢沒斯等及其相赤心、僕固、特勒那頡啜各帥其眾抵天德塞下”';
const JTS195 = '《旧唐书》卷一百九十五·回纥传：“又有回鶻相掘羅勿者，擁兵在外，怨誅柴草、安允合，又殺薩特勒可汗……有將軍句錄末賀恨掘羅勿，走引黠戛斯領十萬騎破回鶻城”';
const JTS195_SAZHI = '《旧唐书》卷一百九十五·回纥传（开局后事，只取身份）：“有回鶻相馺職者，擁外甥龐特勒及男鹿並遏粉等兄弟五人、一十五部西奔葛邏祿”';
const XTS216 = (q) => '《新唐书》卷二百一十六下·吐蕃传下：“' + q + '”';
const CFYG972 = '《册府元龟》卷九百七十二·外臣部·朝贡五（开成四年）：“十二月戊辰渤海王子大延廣契丹首領薩葛奚大首領温訥骨室韋大都督秩䖝等朝貢”';
const SGSG11 = '《三国史记》卷十一·新罗本纪·文圣王：“二年，春正月，以禮徵爲上大等，義琮爲侍中，良順爲伊飡。”';

const NEW_PEOPLE = [
  // ---------------- 回鹘 ----------------
  {
    name: '掘罗勿', faction: '回鹘', official: '回鹘宰相', location: '回鹘牙帐', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_01',
    background: '回鹘宰相。开成初宰相安允合、特勒柴革谋篡，彰信可汗诛之；掘罗勿时将兵在外，怨二人被诛，以马三百匹赂沙陀朱邪赤心，借其兵共攻可汗，可汗兵败自杀，国人立㕎馺特勒为可汗。',
    description: '拥立新可汗之后，是回鹘实际掌权的宰相。去年岁疫、大雪，羊马多死，回鹘由此衰落。',
    stats: stats(MILITARY, { ambition: 10, loyalty: -10 }),
    wuchang: wuchang({ 义: -8, 信: -8 }, { 仁: 'L', 义: 'M', 礼: 'L', 智: 'L', 信: 'M' }, '借沙陀兵攻杀本国可汗、另立新汗，义、信减；其余按保守起点。', []),
    sources: [TJ246, JTS195],
    relations: [['㕎馺可汗', '拥立', 'positive']]
  },
  {
    name: '赤心', faction: '回鹘', official: '回鹘宰相', location: '回鹘牙帐', age: 55, ageBasis: '生年无考，取常值',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'steppe_male_02',
    background: '回鹘宰相。史籍所见在开成五年秋牙帐破后，身份按其时推定。与沙陀朱邪赤心同名，不是一人。',
    description: '开局时在回鹘国中，所在营地不详，暂置牙帐。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其为相，开局前无可据的行迹，按保守起点。', []),
    sources: [TJ246_AFTER]
  },
  {
    name: '馺职', faction: '回鹘', official: '回鹘宰相', location: '回鹘牙帐', age: 55, ageBasis: '生年无考，取常值',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'steppe_male_01',
    background: '回鹘宰相，厖特勒之舅。史籍所见在开成五年秋牙帐破后，身份按其时推定。',
    description: '开局时在回鹘国中，所在营地不详，暂置牙帐。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其为相、拥外甥厖特勒，开局前无可据的行迹，按保守起点。', []),
    sources: [JTS195_SAZHI, TJ246_AFTER],
    relations: [['厖', '舅甥', 'positive']]
  },
  {
    name: '厖', faction: '回鹘', official: '回鹘特勒', aliases: ['厖特勒', '庞特勒', '龐特勒'], location: '回鹘牙帐', age: 35, ageBasis: '生年无考，特勒取三十五岁',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_02',
    background: '回鹘特勒（王族子弟），宰相馺职之甥。史籍所见在开成五年秋牙帐破后，身份按其时推定。',
    description: '开局时在回鹘国中，所在营地不详，暂置牙帐。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其身份，开局前无可据的行迹，按保守起点。', []),
    sources: [JTS195_SAZHI, TJ246_AFTER]
  },
  {
    name: '那颉啜', faction: '回鹘', official: '回鹘特勒', location: '回鹘牙帐', age: 35, ageBasis: '生年无考，特勒取三十五岁',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_01',
    background: '回鹘特勒（王族子弟）。史籍所见在开成五年秋牙帐破后，身份按其时推定。',
    description: '开局时在回鹘国中，所在营地不详，暂置牙帐。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其身份，开局前无可据的行迹，按保守起点。', []),
    sources: [TJ246_AFTER]
  },
  {
    name: '乌希', faction: '回鹘', official: '回鹘特勒', aliases: ['乌希特勒', '烏希特勒'], location: '回鹘牙帐', age: 35, ageBasis: '生年无考，特勒取三十五岁',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_02',
    background: '回鹘特勒（王族子弟），与近牙帐诸部相亲。史籍所见在会昌元年，开局时身份按其时推定。',
    description: '开局时在牙帐附近。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其身份，开局前无可据的行迹，按保守起点。', []),
    sources: ['《资治通鉴》卷二百四十六·会昌元年（开局后事，只取身份）：“回鶻十三部近牙帳者立烏希特勒爲烏介可汗”']
  },
  {
    name: '句录莫贺', faction: '回鹘', official: '回鹘别将', aliases: ['句录末贺', '句錄莫賀'], location: '回鹘牙帐', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_01',
    background: '回鹘别将。宰相掘罗勿攻杀彰信可汗、另立新汗，他因此怨恨掘罗勿。',
    description: '开局时在回鹘国中，何时离去不详，暂置牙帐。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其为别将、恨掘罗勿，开局前无可据的行迹，按保守起点。', []),
    sources: [JTS195, TJ246_AFTER],
    relations: [['掘罗勿', '怨恨', 'negative']]
  },
  // ---------------- 黠戛斯 ----------------
  {
    name: '阿热', faction: '黠戛斯', official: '黠戛斯可汗', leader: true, leaderTitle: '可汗', location: '青山牙帐', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'harem', socialClass: 'imperial', portrait: 'steppe_male_02',
    background: '黠戛斯君长称阿热，遂以为姓，本名不详。回鹘稍衰，阿热即自称可汗；母为突骑施女，称母可敦，妻为葛逻禄叶护之女，为可敦。回鹘遣宰相伐之，不胜，相攻二十年不解。',
    description: '驻牙青山，与回鹘相攻已二十余年，回鹘今岁疫雪相乘、内乱方定。',
    stats: stats(MILITARY, { military: 6, ambition: 8 }),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其自称可汗、与回鹘相攻不解，无可据的品行，按保守起点。', []),
    sources: [
      '《新唐书》卷二百一十七下·回鹘传下·黠戛斯：“其君曰「阿熱」，遂姓阿熱氏”',
      '《新唐书》卷二百一十七下·回鹘传下·黠戛斯：“回鶻稍衰，阿熱即自稱可汗。其母，突騎施女也，為母可敦；妻葛祿葉護女，為可敦。回鶻遣宰相伐之，不勝，挐鬥二十年不解。”'
    ]
  },
  // ---------------- 吐蕃 ----------------
  {
    name: '尚婢婢', faction: '吐蕃', official: '鄯州节度使', location: '鄯州', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'tibetan_male_01', aliases: ['没卢赞心牙'],
    family: '没卢氏（世为吐蕃贵相）',
    background: '姓没卢，名赞心牙，羊同国人，世为吐蕃贵相。不喜仕，赞普强官之，为鄯州节度使（二手资料系于可黎可足在位时，开局时在任属推定）。',
    description: '镇鄯州，湟水谷地的耕田、旧寺与驿路都在其境。',
    personality: '宽厚，略通书记，不喜仕进。',
    stats: stats(MILITARY, { benevolence: 6, intelligence: 4, ambition: -8 }),
    wuchang: wuchang({ 仁: 4, 智: 2 }, { 仁: 'M', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '本传称其宽厚、略通书记、不喜仕，仁略加，智微加；其余按保守起点。', []),
    sources: [XTS216('婢婢，姓沒盧，名贊心牙，羊同國人，世為吐蕃貴相，寬厚，略通書記，不喜仕，贊普強官之'), XTS216('擊鄯州節度使尚婢婢')]
  },
  {
    name: '论恐热', faction: '吐蕃', official: '落门川讨击使', aliases: ['尚恐热', '末农力'], location: '渭州', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'tibetan_male_01',
    background: '姓末，名农力（「热」犹中国称「郎」）。吐蕃别将，为落门川讨击使（据会昌二年的记载推定开局时已在任）。',
    description: '驻落门川，在渭州东南，是吐蕃东道守陇山诸路的军将。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '开局前只见官职，无可据的行迹，按保守起点。', []),
    sources: [XTS216('別將尚恐熱為落門川討擊使，姓末，名農力，「熱」猶中國號「郎」也')]
  },
  {
    name: '结都那', faction: '吐蕃', official: '吐蕃大相', location: '逻些', age: 55, ageBasis: '生年无考，取常值',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'tibetan_male_01',
    background: '吐蕃大相（首相）。史籍所见在会昌二年，开局时在任属推定。',
    description: '在逻些王庭。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '开局前只见官职，无可据的行迹，按保守起点。', []),
    sources: [XTS216('大相結都那見乞離胡不肯拜'), '《资治通鉴》卷二百四十六（会昌二年，只取身份）：“首相結都那見乞離胡不拜”'],
    relations: [['达磨赞普', '君臣', 'positive']]
  },
  {
    name: '尚思罗', faction: '吐蕃', official: '吐蕃宰相', aliases: ['尚与思罗'], location: '逻些', age: 55, ageBasis: '生年无考，取常值',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'tibetan_male_01',
    background: '吐蕃宰相（《新唐书》作尚与思罗，《通鉴》作国相尚思罗）。史籍所见在会昌二年，开局时在任属推定。',
    description: '在逻些王庭，所在另有河陇之说，暂置逻些。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '开局前只见官职，无可据的行迹，按保守起点。', []),
    sources: [XTS216('與宰相尚與思羅戰薄寒山'), '《资治通鉴》卷二百四十六（会昌二年，只取身份）：“遇國相尚思羅屯薄寒山”']
  },
  {
    name: '綝氏', faction: '吐蕃', official: '赞普妃', gender: '女', location: '逻些', age: 30, ageBasis: '生年无考，妃取三十岁',
    military: false, roster: 'harem', socialClass: 'imperial', portrait: 'tibetan_female_01',
    family: '綝氏（兄尚延力）',
    background: '赞普达磨之妃，兄为尚延力。',
    description: '在逻些王庭。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '开局前只见其为赞普之妃，无可据的行迹，按保守起点。', []),
    sources: [XTS216('以妃綝兄尚延力子乞離胡為贊普，始三歲，妃共治其國')],
    relations: [['达磨赞普', '夫妻', 'positive']]
  },
  {
    name: '论夷加羌', faction: '吐蕃', official: '吐蕃东北道元帅', location: '凉州', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'tibetan_male_01',
    background: '吐蕃东北道元帅，统河西北境。开成二年十一月遣使持信物、木夹致书天德军，天德军以其书奏闻。',
    description: '所驻不详，东北道在河西以北，暂置凉州。',
    stats: stats(MILITARY, { diplomacy: 4 }),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '只见其致书天德一事，无可据的品行，按保守起点。', []),
    sources: ['《册府元龟》卷九百八十·外臣部·通好（开成二年）：“二年十一月天徳奏吐蕃東北道元帥論夷加羌使信物乃木夾到本道以其書信上聞”']
  },
  // ---------------- 南诏 ----------------
  {
    name: '王嵯巅', faction: '南诏', official: '大容', aliases: ['蒙嵯巅', '王嵯颠'], location: '阳苴咩城', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'southwest_male_01',
    background: '原为弄栋节度。元和十一年杀南诏王劝龙晟，立其弟劝利；劝利德之，赐氏蒙，封「大容」。大和三年悉众袭陷邛、戎、巂三州，入成都，止西郛十日，慰赉居人，市不扰肆；将还，掠子女、工技数万而南，南诏自是工文织，与中国埒。明年上表请罪。',
    description: '劝利之弟劝丰祐在位已十七年，他仍是南诏最有权势的大臣，确切官职不详。',
    stats: stats(MILITARY, { military: 8, ambition: 10, loyalty: -6 }),
    wuchang: wuchang({ 义: -6, 智: 4 }, { 仁: 'L', 义: 'M', 礼: 'L', 智: 'M', 信: 'L' }, '弑君立弟，义减；入成都能约束部众、市不扰肆，又掠工技以兴织造，智略加。', []),
    sources: [
      '《新唐书》卷二百二十二中·南蛮传中·南诏下：“十一年，為弄棟節度王嵯巔所殺，立其弟勸利”',
      '《新唐书》卷二百二十二中·南蛮传中·南诏下：“勸利德嵯巔，賜氏蒙，封「大容」”',
      '《新唐书》卷二百二十二中·南蛮传中·南诏下：“嵯巔乃悉眾掩邛、戎、巂三州，陷之。入成都，止西郛十日，慰賚居人，市不擾肆。將還，乃掠子女、工技數萬引而南……南詔自是工文織，與中國埒。明年，上表請罪。”'
    ],
    relations: [['劝丰祐', '权臣', 'positive']]
  },
  // ---------------- 日本 ----------------
  {
    name: '藤原爱发', faction: '日本', official: '中纳言', concurrent: ['民部卿'], title: '中纳言·正三位·民部卿', location: '山城国·平安京',
    age: 52, birthYear: 787, ageBasis: '薨于承和十年，时年五十七，生于延历六年（787）',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'japan_male_01', aliases: ['藤原愛發'],
    family: '藤原北家（赠左大臣内麻吕第七子）', father: '藤原内麻吕',
    background: '大纳言真楯之孙，赠左大臣内麻吕第七子。大同中为文章生，屡献应诏之诗。弘仁六年叙从五位下，历近江介、民部少辅、左右少弁、右中弁；天长三年拜参议，历大藏卿、春宫大夫、式部大辅、左大弁，九年十一月授从三位，拜中纳言，兼民部卿。今年正月七日叙正三位。',
    description: '在平安京，列中纳言。',
    personality: '为人和柔，不妄发忿；在于政途，许为通熟。',
    stats: stats(CIVIL, { administration: 4, benevolence: 4 }),
    wuchang: wuchang({ 仁: 4, 礼: 2 }, { 仁: 'M', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '薨传称其为人和柔、不妄发忿，仁略加；其余按保守起点。', []),
    sources: [
      '《续日本后纪》卷九·承和七年正月：“詔授三品秀良親王二品。從三位藤原朝臣愛發正三位。”',
      '《续日本后纪》卷十三·承和十年：“正三位藤原朝臣愛發薨。愛發。大納言正二位眞楯之孫。贈左大臣從一位内麻呂朝臣第七子也。大同年中爲文章生。屡献應詔之詩。……十一月授從三位。拜中納言。兼民部卿。爲人和柔。不妄發忿。在於政塗。許爲通熟。……時年五十七。”'
    ]
  },
  {
    name: '藤原吉野', faction: '日本', official: '中纳言', title: '中纳言·正三位', location: '山城国·平安京',
    age: 53, birthYear: 786, ageBasis: '薨于承和十三年，时年六十一，生于延历五年（786）',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'japan_male_01',
    family: '藤原式家（大宰帅藏下麻吕之孙）', father: '藤原纲继',
    background: '参议藏下麻吕之孙，兵部卿纲继之子。少年游学，不耻下问。弘仁中历美浓少掾、春宫少进、骏河守，任内所部肃清；弘仁十四年淳和天皇受禅，以为中务少辅，寻任左近卫少将，天长中历畿内巡察使、皇后宫大夫、参议、春宫大夫、右近卫大将。天长九年任权中纳言，十年仁明天皇受禅，授正三位；此后辞去宿卫之职，追从后太上天皇（淳和）。承和元年改正中纳言。',
    description: '在平安京，列中纳言，与淳和上皇亲近。',
    personality: '性宽大，能容众；见贤思齐，手不释卷；教诲子弟尤是柔和，事亲至孝。',
    stats: stats(CIVIL, { intelligence: 4, benevolence: 4 }),
    wuchang: wuchang({ 仁: 4, 礼: 4, 智: 2 }, { 仁: 'M', 义: 'L', 礼: 'M', 智: 'L', 信: 'L' }, '薨传称其性宽大、能容众、事亲至孝，仁、礼略加，好学智微加。', []),
    sources: ['《续日本后纪》卷十六·承和十三年：“散位正三位藤原朝臣吉野薨。……少年遊學。不耻下問。性寛大。能容衆。見賢思齊。手不釋卷。教誨子弟。尤是柔和。……九年十一月授從三位。任權中納言。十年三月東宮受讓即帝位。授正三位。厥後辞脱宿衛之職。追從後太上天皇。承和元年改權爲正。……薨時年六十一。”'],
    relations: [['淳和上皇', '追从近臣', 'positive']]
  },
  {
    name: '橘氏公', faction: '日本', official: '中纳言', concurrent: ['右近卫大将'], title: '中纳言·从三位·右近卫大将', location: '山城国·平安京',
    age: 56, birthYear: 783, ageBasis: '薨于承和十四年，时年六十五，生于延历二年（783）',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'japan_male_01',
    family: '橘氏（赠太政大臣清友第七子，太后嘉智子之弟）', father: '橘清友',
    background: '赠太政大臣清友第七子，太后（嵯峨皇后嘉智子）之弟。弘仁初任左卫门大尉，历但马守，累至正四位下；天长十年授从三位，为右近卫大将，任参议；承和五年迁中纳言。以太后之弟历此显要。',
    description: '在平安京，列中纳言，兼右近卫大将。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '薨传只记历官，以外戚致显要，无可据的品行，按保守起点。', []),
    sources: [
      '《续日本后纪》卷九·承和七年：“中納言兼右近衛大將從三位橘朝臣氏公上表。”',
      '《续日本后纪》卷十七·承和十四年：“氏公者。贈太政大臣正一位清友朝臣之第七子也。……天長十年授從三位。爲右近衛大將。六月任參議。承和五年遷中納言。……以太后弟。歴此顯要焉。薨時年六十五。”'
    ],
    relations: [['仁明天皇', '舅甥', 'positive'], ['嵯峨上皇', '姻亲', 'positive']]
  },
  {
    name: '文室秋津', faction: '日本', official: '参议', concurrent: ['春宫大夫', '右卫门督'], title: '参议·从四位上·春宫大夫·右卫门督', location: '山城国·平安京',
    age: 52, birthYear: 787, ageBasis: '卒于承和十年，时年五十七，生于延历六年（787）',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'japan_male_01',
    family: '文室氏（大纳言智努王之孙）', father: '大原王',
    background: '大纳言智努王之孙，大原王第四子。弘仁七年叙从五位下，历甲斐守、武藏介、左兵卫权佐、左近卫中将；天长六年拜参议，历右大弁、武藏守、左大弁，十年兼春宫大夫；承和二年迁右近卫中将，任右卫门督。',
    description: '在平安京，以参议兼春宫大夫、右卫门督。',
    personality: '任右卫门督，监察非违最是其人；亦论武艺，足称骁将。但在饮酒席似非丈夫，每至酒三四坏，必有醉泣之癖。',
    stats: stats(CIVIL, { valor: 12, military: 8, integrity: 4 }),
    wuchang: wuchang({ 义: 4 }, { 仁: 'L', 义: 'M', 礼: 'L', 智: 'L', 信: 'L' }, '卒传称其监察非违最是其人、足称骁将，义略加；酒后醉泣之癖不计入五常。', []),
    sources: [
      '《续日本后纪》卷九·承和七年：“參議從四位上文室朝臣秋津爲兼丹後守。春宮大夫右衛門督如故。”',
      '《续日本后纪》卷十三·承和十年：“出雲權守正四位下文室朝臣秋津卒。大納言正二位智努王之孫。從四位下勳三等大原王之第四子也。……十年兼春宮大夫。……七月。任右衛門督。監察非違。最是其人也。亦論武藝。足稱驍將。但在飮酒席。似非丈夫。毎至酒三四坏。必有醉泣之癖故也。……時年五十七。”'
    ],
    relations: [['恒贞亲王', '春宫大夫', 'positive']]
  },
  {
    name: '小野篁', faction: '日本', official: '', title: '流人（除名为庶人，配流隐岐）', location: '隐岐国',
    age: 37, birthYear: 802, ageBasis: '薨于仁寿二年，时年五十一，生于延历二十一年（802）',
    military: false, roster: 'bu', socialClass: 'commoner', portrait: 'japan_male_01',
    family: '小野氏（参议岑守长子）', father: '小野岑守', learning: '弘仁十三年文章生试及第',
    background: '参议岑守长子。少随父在陆奥，便于据鞍，不事学业，嵯峨天皇闻而叹之，由是志学，弘仁十三年文章生试及第。历弹正少忠、大内记、式部少丞、大宰少贰、东宫学士、弹正少弼。承和元年为聘唐副使，五年遣唐使船次改易，以副使之舶改作大使常嗣之舶，篁抗论不复驾舶；六年正月以捍诏除名为庶人，配流隐岐国。在路赋《谪行吟》七言十韵，文章奇丽，知文之辈莫不吟诵。',
    description: '在隐岐配所。',
    personality: '执论确乎；文章天下无双，草隶之工比于二王。身长六尺二寸，家素清贫，事母至孝。',
    stats: stats(CIVIL, { intelligence: 8, integrity: 6, loyalty: -6 }),
    wuchang: wuchang({ 义: 6, 智: 6, 礼: -4 }, { 仁: 'L', 义: 'M', 礼: 'M', 智: 'M', 信: 'L' }, '抗论船次、不肯以己福利代他害损，义加；文章天下无双，智加；捍诏被除名，礼减。', []),
    sources: [
      '《续日本后纪》卷九·承和七年二月：“辛酉。召流人小野篁。”',
      '《文德实录》卷四·仁寿二年：“篁，參議-正四位下-岑守長子也。……承和元年，為聘唐副使。……篁抗論曰……執論確乎，不復駕舶。……六年春正月，遂以捍詔，除名為庶人，配流隱岐國。在路賦謫行吟七言十韻。文章奇麗，興味優遠。知文之輩，莫不吟誦。凡當時文章，天下無雙。……薨時年五十一。篁身長六尺二寸，家素清貧，事母至孝。”'
    ],
    relations: [['藤原常嗣', '船次之争', 'negative']]
  },
  // ---------------- 新罗 ----------------
  {
    name: '礼徵', faction: '新罗', official: '上大等', location: '金城王都', age: 55, ageBasis: '生年无考，取常值',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'korea_male_02',
    background: '文圣王二年春正月以礼徵为上大等（上大等为新罗百官之首）。',
    description: '在金城，新拜上大等。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其拜上大等，无可据的行迹，按保守起点。', []),
    sources: [SGSG11]
  },
  {
    name: '良顺', faction: '新罗', official: '伊飡', location: '金城王都', age: 55, ageBasis: '生年无考，取常值',
    military: false, roster: 'civil', socialClass: 'civilOfficial', portrait: 'korea_male_01',
    background: '文圣王二年春正月为伊飡。',
    description: '在金城。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其授伊飡，无可据的行迹，按保守起点。', []),
    sources: [SGSG11]
  },
  {
    name: '阎长', faction: '新罗', official: '武珍州军将', aliases: ['閻長', '阎丈'], location: '武珍州', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'korea_male_02',
    background: '武州（武珍州）人，以勇壮闻于时。开成三年冬金阳为平东将军，与阎长、张弁、郑年、骆金、张建荣、李顺行统军至武州铁冶县。',
    description: '在武珍州。',
    stats: stats(MILITARY, { valor: 10 }),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍称其以勇壮闻，勇力不计入五常，按保守起点。', []),
    sources: [
      '《三国史记》卷十·新罗本纪·闵哀王：“冬十二月，金陽爲平東將軍，與閻長、張弁、鄭年、駱金、張建榮、李順行統軍，至武州鐵冶縣”',
      '《三国史记》卷十一·新罗本纪·文圣王（开局后事，只取身份）：“武州人閻長者，以勇壯聞於時”'
    ],
    relations: [['金阳', '旧部', 'positive'], ['郑年', '同军', 'positive']]
  },
  // ---------------- 渤海、契丹、奚、室韦（开成四年十二月入唐朝贡） ----------------
  {
    name: '大延广', faction: '渤海', official: '渤海王子', location: '上京龙泉府', age: 35, ageBasis: '生年无考，王子取三十五岁',
    military: false, roster: 'harem', socialClass: 'imperial', portrait: 'bohai_male_01', aliases: ['大延廣'],
    background: '渤海王子。开成四年十二月戊辰与契丹、奚、室韦诸首领同日入唐朝贡。',
    description: '开局时是否仍在长安不可考，暂置上京。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其入唐朝贡，无可据的行迹，按保守起点。', []),
    sources: [CFYG972],
    relations: [['大彝震', '宗室', 'positive']]
  },
  {
    name: '萨葛', faction: '契丹诸部', official: '契丹首领', location: '松漠', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_01', aliases: ['薩葛'],
    background: '契丹首领。开成四年十二月戊辰入唐朝贡。其时契丹外附回鹘，用回鹘之印。',
    description: '开局时是否仍在长安不可考，暂置松漠。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其入唐朝贡，无可据的行迹，按保守起点。', []),
    sources: [CFYG972, '《唐会要》卷九十六（会昌二年幽州奏，只取其事）：“契丹舊用迴鶻印”']
  },
  {
    name: '温讷骨', faction: '奚诸部', official: '奚大首领', location: '土护真水', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'steppe_male_02', aliases: ['温訥骨'],
    background: '奚大首领。开成四年十二月戊辰入唐朝贡。',
    description: '开局时是否仍在长安不可考，暂置土护真水。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其入唐朝贡，无可据的行迹，按保守起点。', []),
    sources: [CFYG972]
  },
  {
    name: '秩虫', faction: '室韦诸部', official: '室韦大都督', location: '室韦', age: 55, ageBasis: '生年无考，取常值',
    military: true, roster: 'mili', socialClass: 'militaryOfficial', portrait: 'forest_male_01', aliases: ['祑虫', '秩䖝'],
    background: '唐授室韦大都督。开成四年十二月率三十人入唐朝贡（《唐会要》作祑虫，《册府元龟》作秩虫）。室韦无君长，诸部大酋各摄其部。',
    description: '开局时是否仍在长安不可考，暂置室韦。',
    stats: stats(MILITARY, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '史籍只见其入唐朝贡，无可据的行迹，按保守起点。', []),
    sources: [CFYG972, '《唐会要》卷九十六：“其年十二月，室韋大都督祑虫等三十人來朝貢。”']
  },
  // ---------------- 迦摩缕波、环王（铭文研究，二手，L） ----------------
  {
    name: '婆那摩罗跋摩', faction: '迦摩缕波', official: '迦摩缕波王', leader: true, leaderTitle: '王', aliases: ['Vanamālavarman'], location: '诃鲁佩湿伐罗',
    age: 55, ageBasis: '生年无考，取常值', military: false, roster: 'harem', socialClass: 'imperial', portrait: 'india_male_01',
    background: '迦摩缕波弥戾车王朝之王，约八三二年继诃阇罗跋摩即位（铜板铭文研究所定的年代，二手）。提斯浦尔铜板以其事迹为主。',
    description: '居王都诃鲁佩湿伐罗（今提斯浦尔）。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '只有铭文研究的二手记载，无可据的品行，按保守起点。', []),
    sources: ['英文维基百科 Mlechchha dynasty（二手，据 Hayunthal、Tezpur 铜板研究）：“Harjjaravarman (815–832) … Vanamalavarmadeva (832–855)”']
  },
  {
    name: '毗建多跋摩三世', faction: '环王', official: '环王', leader: true, leaderTitle: '王', aliases: ['Vikrāntavarman III'], location: '奔浪陀',
    age: 55, ageBasis: '生年无考，取常值', military: false, roster: 'harem', socialClass: 'imperial', portrait: 'cham_male_01',
    background: '环王（占婆）之王，约八一七年即位（碑铭研究所定的年代，二手），王统出自宾童龙（奔浪陀）。元和初环王不朝献，安南都护张舟击之。',
    description: '居奔浪陀。',
    stats: stats(CIVIL, {}),
    wuchang: wuchang({}, { 仁: 'L', 义: 'L', 礼: 'L', 智: 'L', 信: 'L' }, '只有碑铭研究的二手记载，无可据的品行，按保守起点。', []),
    sources: [
      '英文维基百科 Vikrantavarman III（二手）：“Vikrāntavarman III was a king of Champa, reigning from 817 to around 854.”',
      '《新唐书》卷二百二十二下·南蛮传下·环王：“至德後，更號環王。元和初不朝獻，安南都護張舟執其偽、愛州都統，斬三萬級，虜王子五十九”'
    ]
  }
];

module.exports = { NEW_PEOPLE };
