// 绍宋·宋廷分路框架：大宋行政树补路一级，按史料定各路总数（全国合计不动）。
// 路的名单与下辖地块取自地图 circuitRegistry；各块的户数、商税、田亩、两税权重见 shaosong-sources.js。
// 用法见 patches/shaosong-circuits.js。
//
// 路长官：以建炎元年八月实际统辖全路的官为准，逐路核《宋史·地理志》治所条：
//   志载此前已设帅府、安抚司的写安抚使（京东东西、永兴军、淮南东、江南东、荆湖南），陕西四路与广南两路写经略安抚使；
//   建炎二年以后才设帅司（荆湖北、淮南西、利州、夔州、福建、成都府）或志无载（京西南北、江南西），以及两浙（帅司分东西）、
//   潼川府（帅司只辖泸南沿边），写转运使——转运司各路皆有。京畿写东京留守，河北西路写招抚使，麟府写兵马钤辖。
// 人物表里有其人才写 governor。
// flee、hide：逃户、隐户相对全国的倍数（靖康以来兵祸、溪峒不入版籍）；textile：布帛相对倍数。
// trade：商贸折减。商税权重出自熙宁十年以前的岁额，不反映靖康兵祸。《文献通考·征榷考一》：建炎元年诏「京城久閉，
// 道路方通，有販貨上京者，與免稅」，又诏「應殘破州縣合用竹木磚瓦並免收稅」——东京商旅断绝、贩货入京免税，京畿折至 0.3；
// 河北、河东、京西北、京东为金兵往来、州县残破之地，按兵祸轻重折减（系数为估）；未写的路为 1。
'use strict';

const CIRCUITS = [
  {
    name: '京畿路', officialPosition: '东京留守', governor: '宗泽', capital: '开封府',
    terrain: '平原', specialResources: '京师百货·汴河漕运', taxLevel: '重',
    description: '东京开封府及其畿县。靖康二年金兵两陷京城，掳徽、钦二帝与宗室北去，府库一空；围城之后饥疫相继，死者甚众。今春金军北撤，宗泽以东京留守修城备战，收编河北溃兵义军，屡请车驾还京。',
    strategicValue: '旧都与宗庙所在，守住东京方能号召河北、河东。',
    threats: ['金军秋后再度南下', '京城粮乏', '溃兵与群盗'],
    flee: 2.0, hide: 1.0, textile: 1.0, trade: 0.3
  },
  {
    name: '京东西路', officialPosition: '京东西路安抚使', capital: '应天府',
    terrain: '平原', specialResources: '汴泗漕运·绢', taxLevel: '中',
    description: '应天府为南京，今上五月即位于此。领郓、兖、徐、济、单、濮、曹、拱诸州，汴河、五丈河漕路所经，北境与金人隔河相望。',
    strategicValue: '南京与汴泗漕路所系，是行在与东京之间的腹地。',
    threats: ['金军渡河南下', '溃兵群盗'],
    flee: 1.5, hide: 1.0, textile: 1.2, trade: 0.8
  },
  {
    name: '京东东路', officialPosition: '京东东路安抚使', capital: '青州',
    terrain: '丘陵', specialResources: '海盐·绢·渔', taxLevel: '中',
    description: '青、齐、密、沂、登、莱、潍、淄诸州，负海之地。密州板桥镇设有市舶，登州与辽东隔海相望。河北陷后，北来流民与溃兵充斥州县。',
    strategicValue: '山东半岛屏蔽淮北，海道可通辽东。',
    threats: ['金军自河北南下', '流民与群盗'],
    flee: 1.5, hide: 1.0, textile: 1.2, trade: 0.8
  },
  {
    name: '京西北路', officialPosition: '京西北路转运使', capital: '河南府',
    terrain: '平原', specialResources: '牡丹·瓷·粮', taxLevel: '中',
    description: '西京河南府与许、汝、蔡、陈、颍、郑、陕、虢诸州，旧为畿辅。宋室祖陵在巩县，洛阳宫阙尚存。河东失守后，金兵可自河阳渡河直逼西京。',
    strategicValue: '西京与祖陵所在，东连汴京，西通关陕。',
    threats: ['金军自河东南下', '溃兵'],
    flee: 1.5, hide: 1.0, textile: 1.0, trade: 0.7
  },
  {
    name: '京西南路', officialPosition: '京西南路转运使', capital: '襄阳府',
    terrain: '丘陵', specialResources: '粮·麻·漆', taxLevel: '中',
    description: '襄、邓、唐、随、郢、均、房诸州与信阳、光化二军，汉水中游。襄阳为荆湖门户，朝中李纲一派主张车驾西幸南阳，以邓州为行在。',
    strategicValue: '上可援关陕，下可屏荆湖，是中原退守的第二道门户。',
    threats: ['金军南下', '溃兵'],
    flee: 1.2, hide: 1.0, textile: 1.0
  },
  {
    name: '永兴军路', officialPosition: '永兴军路安抚使', capital: '京兆府',
    terrain: '河谷', specialResources: '粮·麻·马', taxLevel: '中',
    description: '京兆府与同、华、耀、商、金诸州，关中腹地，八百里秦川。去冬西军精锐东调勤王，关中兵力空虚，金人已有窥陕之意。',
    strategicValue: '关中形胜，据之可东出潼关，亦可南屏巴蜀。',
    threats: ['金军西进关中', '西军诸将不相统属'],
    flee: 1.2, hide: 1.0, textile: 0.8
  },
  {
    name: '淮南东路', officialPosition: '淮南东路安抚使', capital: '扬州',
    terrain: '水乡', specialResources: '淮盐·漕运·粮', taxLevel: '重',
    description: '扬、楚、泗、亳、宿、真、通、泰、海诸州与高邮、涟水二军，运河贯通南北，真州、扬州为东南漕运枢纽。通、泰、楚、海沿海盐场所出为天下淮盐之冠。朝中已有驻跸扬州之议。',
    strategicValue: '控运河与淮盐，东南财赋北上的咽喉。',
    threats: ['金军南下淮北', '群盗'],
    flee: 1.2, hide: 1.0, textile: 1.0
  },
  {
    name: '淮南西路', officialPosition: '淮南西路转运使', capital: '庐州',
    terrain: '丘陵', specialResources: '茶·粮·麻', taxLevel: '中',
    description: '寿、庐、濠、和、舒、蕲、黄、光诸州与六安、无为二军，淮水之南、大江之北，巢湖居中。蕲、黄、舒、光诸州山场产茶。',
    strategicValue: '江北屏障，守淮方能保江。',
    threats: ['金军南下', '溃兵群盗'],
    flee: 1.2, hide: 1.0, textile: 0.9
  },
  {
    name: '江南东路', officialPosition: '江南东路安抚使', capital: '江宁府',
    terrain: '丘陵', specialResources: '稻米·银·铜·纸墨', taxLevel: '重',
    description: '江宁府与宣、太平、池、饶、信、徽诸州及广德、南康二军。江宁为六朝旧都，扼长江下游；饶州产银、铜，永平监铸钱，徽州出纸墨。',
    strategicValue: '长江下游重镇，江宁可为东南根本。',
    threats: ['溃兵流入', '宣和以来方腊余党'],
    flee: 1.0, hide: 1.0, textile: 1.2
  },
  {
    name: '江南西路', officialPosition: '江南西路转运使', capital: '洪州',
    terrain: '丘陵', specialResources: '稻米·茶·纸·瓷', taxLevel: '中',
    description: '洪、吉、抚、袁、虔、江、筠诸州及兴国、临江、建昌、南安四军，赣江贯通南北，稻米岁运东南。虔州山深，私盐贩与盗寇出没。',
    strategicValue: '江西粮仓，东南漕米大宗所出。',
    threats: ['虔州盗寇', '私盐'],
    flee: 1.0, hide: 1.1, textile: 0.9
  },
  {
    name: '两浙路', officialPosition: '两浙转运使', capital: '杭州',
    terrain: '水乡', specialResources: '丝绸·稻米·海盐·茶·海贸', taxLevel: '重',
    description: '杭、苏（平江府）、湖、秀、常、润（镇江府）、越、明、台、温、婺、衢、处、严诸州与江阴军，天下财赋所出，丝帛、稻米、海盐为国用所赖。宣和二年方腊起于睦州青溪，杭、睦、歙、婺、衢、处诸州残破，至今元气未尽复。杭州、明州设市舶司，海舶往来。',
    strategicValue: '国用所出之地，东南之本。',
    threats: ['溃兵入境', '方腊余党', '海寇'],
    flee: 1.1, hide: 1.1, textile: 1.6
  },
  {
    name: '荆湖北路', officialPosition: '荆湖北路转运使', capital: '江陵府',
    terrain: '水乡', specialResources: '稻米·鱼·茶', taxLevel: '中',
    description: '江陵、鄂、岳、澧、鼎、峡、归、复诸州与德安府、荆门、汉阳二军，并辰、沅、靖三州溪峒之地。江汉交汇，鄂州为长江水运要冲，洞庭湖区渔米丰饶。',
    strategicValue: '上游形胜，江陵、鄂州控扼长江中游。',
    threats: ['溃兵', '溪峒蛮夷'],
    flee: 1.0, hide: 1.1, textile: 0.9
  },
  {
    name: '荆湖南路', officialPosition: '荆湖南路安抚使', capital: '潭州',
    terrain: '丘陵', specialResources: '稻米·茶·银', taxLevel: '中',
    description: '潭、衡、永、道、郴、邵、全诸州与桂阳监、武冈军，湘江贯通，产米、茶，郴、桂阳出银。南连两广，西接溪峒。',
    strategicValue: '湖湘腹地，粮米与兵源之地。',
    threats: ['溪峒蛮夷'],
    flee: 1.0, hide: 1.1, textile: 0.8
  },
  {
    name: '福建路', officialPosition: '福建路转运使', capital: '福州',
    terrain: '山地', specialResources: '茶·荔枝·瓷·海贸', taxLevel: '中',
    description: '福、建、泉、漳、汀、南剑诸州与邵武、兴化二军，山多田少，人稠地狭，民多出海为商。泉州市舶为东南巨港，建州北苑贡茶天下第一。',
    strategicValue: '海贸与科第之乡，山海屏障东南。',
    threats: ['海寇', '汀漳山寇'],
    flee: 1.0, hide: 1.2, textile: 0.8
  },
  {
    name: '广南东路', officialPosition: '广南东路经略安抚使', capital: '广州',
    terrain: '丘陵', specialResources: '海贸·香药·银·盐', taxLevel: '轻',
    description: '广州市舶为天下之最，番商云集，香药珠宝经此入中国。韶、潮、惠、循、梅诸州地广人稀，岭南多瘴。',
    strategicValue: '海贸财源，南方后路。',
    threats: ['海寇', '瘴疠'],
    flee: 1.0, hide: 1.2, textile: 0.6
  },
  {
    name: '广南西路', officialPosition: '广南西路经略安抚使', capital: '桂州',
    terrain: '山地', specialResources: '银·盐·香药·珠', taxLevel: '轻',
    description: '桂、邕、容、宜、融诸州与海南琼州及昌化、万安、吉阳三军，溪峒杂居。桂州灵渠沟通湘漓，邕州控扼左右江溪峒，南接交趾。地瘠民贫，赋入不足自给。',
    strategicValue: '西南藩篱，控扼交趾与溪峒。',
    threats: ['溪峒蛮夷', '交趾', '瘴疠'],
    flee: 1.0, hide: 1.3, textile: 0.6
  },
  {
    name: '成都府路', officialPosition: '成都府路转运使', capital: '成都府',
    terrain: '盆地', specialResources: '蜀锦·茶·井盐·交子', taxLevel: '重',
    description: '成都平原沃野千里，都江堰灌溉之利，蜀锦、茶、井盐甚盛；交子始于此地。四川行铁钱，自成一财政区，茶马司以蜀茶易西蕃之马。',
    strategicValue: '天府之国，若中原不守，蜀为退守与供饷之地。',
    threats: ['边夷', '茶马之政扰民'],
    flee: 1.0, hide: 1.0, textile: 1.6
  },
  {
    name: '潼川府路', officialPosition: '潼川府路转运使', capital: '潼川府',
    terrain: '丘陵', specialResources: '井盐·糖·麻布', taxLevel: '中',
    description: '潼川府（梓州）、遂宁府与果、资、普、昌、合、渠、荣诸州，泸、叙、长宁沿边。井盐遍布州县，遂宁产糖霜；泸南夷人时有侵扰，设泸南安抚司镇之。',
    strategicValue: '川中盐利与泸南边防所系。',
    threats: ['泸南夷人'],
    flee: 1.0, hide: 1.1, textile: 1.1
  },
  {
    name: '夔州路', officialPosition: '夔州路转运使', capital: '夔州',
    terrain: '山地', specialResources: '井盐·丹砂·茶', taxLevel: '轻',
    description: '三峡与川东诸州，夔州扼长江峡口，大宁监、云安军产盐。施、黔、珍、播、思诸州多溪峒蛮夷，羁縻而已。',
    strategicValue: '长江入蜀门户。',
    threats: ['溪峒蛮夷'],
    flee: 1.0, hide: 1.3, textile: 0.8
  },
  {
    name: '利州路', officialPosition: '利州路转运使', capital: '兴元府',
    terrain: '山地', specialResources: '茶·漆·马', taxLevel: '中',
    description: '兴元府与利、洋、阆、剑、巴、蓬、文、兴、政诸州，秦岭、大巴山之间，金牛道、米仓道所经，蜀道咽喉。',
    strategicValue: '控扼入蜀诸道，关陕与巴蜀的枢纽。',
    threats: ['金军自关陕南窥'],
    flee: 1.0, hide: 1.0, textile: 0.9
  },
  {
    name: '秦凤路', officialPosition: '秦凤路经略安抚使', capital: '秦州',
    terrain: '河谷', specialResources: '马·木材·粮', taxLevel: '中',
    description: '秦、凤翔、陇、成、阶、凤诸州，渭水上游，西接吐蕃诸部，市马要地，秦州为西军重镇。',
    strategicValue: '陇右门户，西军兵马所出。',
    threats: ['金军西进', '吐蕃诸部'],
    flee: 1.1, hide: 1.0, textile: 0.7
  },
  {
    name: '三泉直隶', officialPosition: '知三泉县', capital: '三泉县',
    terrain: '山地', specialResources: '金牛道转输', taxLevel: '中',
    description: '三泉县直隶朝廷，不属诸路，嘉陵江上游，金牛道所经，为入蜀漕运转输之地。',
    strategicValue: '入蜀转输要地。',
    threats: [],
    flee: 1.0, hide: 1.0, textile: 0.8
  },
  {
    name: '泾原路', officialPosition: '泾原路经略安抚使', capital: '渭州',
    terrain: '边塞', specialResources: '马·粮', taxLevel: '中',
    description: '渭、泾、原诸州与德顺、镇戎诸军，西夏南下必经之地，堡寨林立，西军劲旅所在。',
    strategicValue: '西军精兵之地，对夏前线。',
    threats: ['西夏', '金军西进'],
    flee: 1.1, hide: 1.0, textile: 0.6
  },
  {
    name: '环庆路', officialPosition: '环庆路经略安抚使', capital: '庆州',
    terrain: '边塞', specialResources: '马·粮', taxLevel: '中',
    description: '庆、环、邠、乾（醴州）诸州，横山以南，与西夏犬牙交错，堡寨相望。',
    strategicValue: '对夏前线，屏蔽关中北境。',
    threats: ['西夏'],
    flee: 1.1, hide: 1.0, textile: 0.6
  },
  {
    name: '鄜延路', officialPosition: '鄜延路经略安抚使', capital: '延安府',
    terrain: '边塞', specialResources: '马·石油·粮', taxLevel: '中',
    description: '延安府与鄜、丹诸州及绥德、保安二军，横山东麓，对西夏的前沿。延州产石油，沈括尝记其事。',
    strategicValue: '对夏前线，屏蔽关中东北。',
    threats: ['西夏', '金军自河东西渡'],
    flee: 1.1, hide: 1.0, textile: 0.6
  },
  {
    name: '熙河兰湟路', officialPosition: '熙河兰湟路经略安抚使', capital: '熙州',
    terrain: '高原', specialResources: '马·青盐·畜产', taxLevel: '轻',
    description: '熙、河、兰、巩、岷、洮、廓、湟诸州与积石军，熙宁以来开边所得，蕃汉杂处，产马，羌部叛服不常。',
    strategicValue: '断西夏右臂，市马之源。',
    threats: ['西夏', '吐蕃诸部叛服'],
    flee: 1.0, hide: 1.2, textile: 0.5
  },
  {
    name: '河东路', officialPosition: '麟府路兵马钤辖', governor: '折可求', capital: '府州',
    terrain: '边塞', specialResources: '马·盐', taxLevel: '轻',
    description: '河东诸州多已陷金，宋廷所有者仅黄河以西的麟、府、丰三州。折氏世守府州，三州孤悬河外，北邻西夏，东隔河即金人。',
    strategicValue: '河外孤垒，牵制金人西渡。',
    threats: ['金军', '西夏'],
    flee: 1.5, hide: 1.0, textile: 0.5, trade: 0.5
  },
  {
    name: '河北西路', officialPosition: '河北西路招抚使', governor: '张所', capital: '卫州',
    terrain: '平原', specialResources: '粮·绢·煤铁', taxLevel: '中',
    description: '河北西路北部州县多已陷金，宋廷所有者为黄河以北的卫、怀二州与太行南麓。张所新任河北西路招抚使，联络河北忠义民兵，王彦八字军屯于太行。',
    strategicValue: '河北恢复的立足之地，太行义军所依。',
    threats: ['金军', '粮道断绝'],
    flee: 2.0, hide: 1.0, textile: 1.2, trade: 0.5
  }
];

// 市舶：北宋末市舶司、务设于广州、泉州、明州、杭州、密州板桥镇、秀州华亭。
// 剧本全国海贸额按下列相对份额分给这些州（广州最大、泉州次之；份额为估数，史载各司岁入不全）
const PORTS = { 广州: 5, 泉州: 3, 明州: 1.5, 杭州: 1.5, 秀州: 0.5, 密州: 0.5 };

module.exports = { CIRCUITS, PORTS };
