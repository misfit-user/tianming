// 绍宋·藏区与西域六棵外藩树：卫藏诸部、古格王国、多康诸部、东喀喇汗国、西喀喇汗国、高昌回鹘。
// 这一带无户口可考，各块按原账户数分，势力合计不动（原账把同一地块拆成几笔「核算项」的已并回一块）；
// 重写路一级、官称、地形物产与描述。官称与剧本人物表对得上的照人物写（游戏按官称活绑定主官），
// 寺院、城镇的所在块用 tools/locate-points.js 按今地核过（萨迦在拉堆块，热振寺在当雄块，甘孜在理塘块，吉隆在芒域块）。
'use strict';

const { foreignTree, block } = require('./shaosong-foreign');

const O = 'original';
// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function mk(minxin, corruption, fisc) {
  return (name, prosperity, fields) => block(Object.assign({
    name, divisionType: '部', regionType: 'tribal_frontier', taxLevel: '轻', tags: {},
    idx: [minxin, corruption, prosperity, prosperity, 22, 38, 30, 30], fisc
  }, fields, { notes: fields.notes || '户数按原账（无户口可考）。' }));
}
function frame(name, officialPosition, capital, fields) {
  return Object.assign({ name, officialPosition, capital, taxLevel: '轻', threats: [], flee: 1.0, hide: 1.3, textile: 0.5 }, fields);
}
function orig(economy, extra) { return Object.assign({ households: O, economy }, extra); }

// ---------------- 卫藏诸部 ----------------
const tb = mk(45, 20, [0.74, 0.05]);
const tubo = foreignTree({
  treeKey: 'fac_tubo', idPrefix: 'div_ss_wz_', faction: '卫藏诸部',
  treeLabel: '卫藏诸部行政树去掉国号节点（柴达木、宗喀西境原账各拆两笔核算项，并回一块），',
  reportNotes: ['户数：吐蕃分裂以后无户口可考，按原账户数分。'],
  leaves: {
    逻些: orig('farm', { commerceFactor: 1.3 }), 雅隆: orig('farm'), 当雄: orig('pastoral'), 工布: orig('mixed'),
    年楚河谷: orig('farm'), 拉堆: orig('mixed'), 那曲: orig('pastoral'), 柴达木: orig('pastoral'), 宗喀西境: orig('pastoral')
  },
  circuits: [
    {
      name: '卫地',
      frame: frame('卫地', '逻些诸部首领', '逻些', {
        terrain: '河谷', specialResources: '青稞·牦牛·氆氇·木材',
        description: '雅鲁藏布江中游以北的伍茹、约茹，吐蕃王统崩解后，王室后裔、豪族与噶当、噶举诸派寺院分据。',
        strategicValue: '吐蕃旧都所在。', threats: ['诸王系、诸教派相争']
      }),
      blocks: {
        逻些: tb('逻些', 36, {
          divisionType: '城', officialPosition: '逻些诸部首领', terrain: '河谷', specialResources: '青稞·氆氇·佛像',
          description: '吐蕃旧都逻些，大昭寺、小昭寺所在；王统崩解后，王室后裔与诸豪族分据伍茹。',
          notes: '拉萨。'
        }),
        雅隆: tb('雅隆', 34, {
          officialPosition: '雅隆觉阿王系', terrain: '河谷', specialResources: '青稞·牦牛',
          description: '雅隆河谷，吐蕃王族发祥之地，王室后裔雅隆觉阿王系据之；东邻塔布，冈波巴建岗波寺（宣和三年），噶举派由此兴。',
          notes: '泽当、岗波寺在块内。'
        }),
        当雄: tb('当雄', 24, {
          officialPosition: '噶当派·堪布', terrain: '高原', specialResources: '牦牛·羊毛',
          description: '念青唐古拉山南麓牧场；噶当派祖寺热振寺（嘉祐二年仲敦巴建）在其南。',
          notes: '热振寺在块内。'
        }),
        工布: tb('工布', 28, {
          officialPosition: '工布诸部首领', terrain: '山林', specialResources: '木材·药材·麝香',
          description: '雅鲁藏布江下游工布地方，林木茂密，王族后裔工布王系世居，第穆摩崖刻吐蕃工布王事。',
          notes: '林芝一带。'
        })
      },
      regionMeans: { development: 30.8, unrest: 22, taxBurden: 34, armyPressure: 28.57 }
    },
    {
      name: '藏地',
      frame: frame('藏地', '后藏豪族', '年楚河谷', {
        terrain: '河谷', specialResources: '青稞·盐·牦牛·羊毛',
        description: '雅鲁藏布江中游以南以西的后藏，豪族分据诸城，萨迦昆氏、夏鲁诸寺渐兴。',
        strategicValue: '后藏腹地。', threats: ['豪族相争']
      }),
      blocks: {
        年楚河谷: tb('年楚河谷', 26, {
          officialPosition: '后藏豪族', terrain: '河谷', specialResources: '青稞·羊毛',
          description: '年楚河谷，后藏腹地，江孜、日喀则诸城，夏鲁寺（元祐二年建）在焉，豪族分据。',
          notes: '日喀则、江孜在块内。'
        }),
        拉堆: tb('拉堆', 22, {
          officialPosition: '萨迦·昆氏法主', terrain: '高原', specialResources: '青稞·牦牛·盐',
          description: '后藏西部拉堆之地；萨迦寺熙宁六年昆·贡却杰布所建，政和元年起其子贡噶宁布主寺，萨迦派渐兴。',
          notes: '萨迦在块内。'
        })
      },
      regionMeans: { development: 24, unrest: 22, taxBurden: 34, armyPressure: 31 }
    },
    {
      name: '藏北地区',
      frame: frame('藏北地区', '藏北牧部首领', '那曲', {
        terrain: '高原', specialResources: '牦牛·羊·盐·羊毛',
        description: '念青唐古拉山以北的羌塘高原，牧部游牧，湖盐南运卫藏。',
        strategicValue: '', threats: []
      }),
      blocks: {
        那曲: tb('那曲', 24, {
          officialPosition: '藏北牧部首领', terrain: '高原', specialResources: '牦牛·羊·湖盐', tags: { saltRegion: true },
          description: '藏北羌塘，牧部逐水草游牧，采湖盐与卫藏交易青稞。',
          notes: '羌塘盐湖。'
        })
      },
      regionMeans: { development: 24, unrest: 22, taxBurden: 34, armyPressure: 31 }
    },
    {
      name: '宗喀—柴达木',
      frame: frame('宗喀—柴达木', '宗喀诸部首领', '宗喀西境', {
        terrain: '荒漠', specialResources: '马·羊·盐·牦牛',
        description: '青海湖以西至柴达木盆地，唃厮啰旧部与吐谷浑遗部游牧其间；宋崇宁间取青唐，其西诸部仍自立。',
        strategicValue: '青海通西域之路。', threats: ['西夏', '宋熙河路']
      }),
      blocks: {
        柴达木: tb('柴达木', 20, {
          officialPosition: '柴达木诸部首领', terrain: '荒漠', specialResources: '盐·羊·驼', tags: { saltRegion: true },
          description: '柴达木盆地，吐谷浑遗部与诸蕃游牧，盐湖遍布，阿尔金山北麓通西域南道。',
          notes: '原账两笔：阿尔金山北麓诸部、柴达木北缘诸部。'
        }),
        宗喀西境: tb('宗喀西境', 20, {
          officialPosition: '宗喀诸部首领', terrain: '高原', specialResources: '马·牦牛·羊', tags: { horseRegion: true },
          description: '青海湖以西，唃厮啰旧部诸蕃游牧；宋崇宁三年取青唐（鄯州），湟水以西诸部仍各自为政。',
          notes: '原账两笔：青海西部诸部、青唐北界诸部。'
        })
      },
      regionMeans: { development: 20.18, unrest: 20.94, taxBurden: 39.46, armyPressure: 31 }
    }
  ]
});

// ---------------- 古格王国 ----------------
const gg = mk(44, 18, [0.75, 0.05]);
const guge = foreignTree({
  treeKey: 'fac_guge', idPrefix: 'div_ss_gg_', faction: '古格王国',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 扎不让: orig('mixed', { commerceFactor: 1.2 }), 托林: orig('mixed'), 普兰: orig('mixed'), 芒域: orig('mixed') },
  circuits: [{
    name: '古格',
    frame: frame('古格', '古格·赞普', '扎不让', {
      terrain: '河谷', specialResources: '青稞·羊毛·黄金·盐',
      description: '阿里象泉河谷的古格王国，吐蕃王族吉德尼玛衮之后，托林寺为西部后弘期佛教中心，西通克什米尔、拉达克。',
      strategicValue: '西部后弘期中心。', threats: ['喀喇汗诸部']
    }),
    blocks: {
      扎不让: gg('扎不让', 30, {
        divisionType: '都城', officialPosition: '古格·赞普', terrain: '河谷', specialResources: '青稞·羊毛·黄金', tags: { mineralRegion: true },
        description: '古格王都扎布让，象泉河谷土林之间，吉德尼玛衮之后古格王系世居于此，阿里产金。',
        notes: '札达县境。'
      }),
      托林: gg('托林', 28, {
        divisionType: '寺', officialPosition: '托林寺·堪布', terrain: '河谷', specialResources: '青稞·经籍',
        description: '托林寺，益西沃所建，阿底峡曾驻锡于此，仁钦桑布译经，为西部后弘期佛教中心。',
        notes: '宋咸平间建寺。'
      }),
      普兰: gg('普兰', 28, {
        officialPosition: '普兰首领', terrain: '高原', specialResources: '羊毛·盐·青稞', tags: { saltRegion: true },
        description: '冈仁波齐与玛旁雍错之南的普兰，南通尼婆罗，以羊毛、湖盐易谷。',
        notes: ''
      }),
      芒域: gg('芒域', 26, {
        officialPosition: '芒域首领', terrain: '山地', specialResources: '青稞·木材',
        description: '芒域贡塘，吉隆河谷，吐蕃以来通尼婆罗的孔道。',
        notes: '吉隆在块内。'
      })
    },
    regionMeans: { development: 28, unrest: 22, taxBurden: 37, armyPressure: 31 }
  }]
});

// ---------------- 多康诸部 ----------------
const dk = mk(44, 18, [0.75, 0.05]);
const kham = foreignTree({
  treeKey: 'fac_kham', idPrefix: 'div_ss_dk_', faction: '多康诸部',
  treeLabel: '多康诸部行政树去掉国号节点（理塘、打箭炉地域原账各拆两笔核算项，并回一块），',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: {
    昌都: orig('mixed'), 类乌齐: orig('mixed'), 德钦河谷: orig('mixed'), 囊谦: orig('pastoral'), 玉树: orig('pastoral'),
    理塘: orig('pastoral'), 巴塘: orig('mixed'), 打箭炉地域: orig('mixed', { commerceFactor: 1.2 }), 松州: orig('mixed')
  },
  circuits: [
    {
      name: '昌都河谷',
      frame: frame('昌都河谷', '朵甘思大酋', '昌都', {
        terrain: '山地', specialResources: '牦牛·青稞·盐·木材',
        description: '澜沧江上游的朵甘思诸部，河谷农耕、高原游牧相兼，南通滇西北。',
        strategicValue: '多康之中。', threats: ['诸部相攻']
      }),
      blocks: {
        昌都: dk('昌都', 24, {
          officialPosition: '朵甘思大酋', terrain: '河谷', specialResources: '青稞·牦牛',
          description: '澜沧江上游扎曲、昂曲交汇之地，朵甘思诸部聚居，为多康之中。',
          notes: ''
        }),
        类乌齐: dk('类乌齐', 22, {
          officialPosition: '佛寺堪布', terrain: '河谷', specialResources: '青稞·牦牛',
          description: '昌都西北的紫曲河谷，诸部与佛寺杂处。',
          notes: ''
        }),
        德钦河谷: dk('德钦河谷', 22, {
          officialPosition: '德钦诸部首领', terrain: '山地', specialResources: '青稞·木材·药材',
          description: '澜沧江峡谷南段，卡瓦格博山下，南通滇西北磨些诸部。',
          notes: ''
        })
      },
      regionMeans: { development: 22.72, unrest: 22, taxBurden: 37.31, armyPressure: 31 }
    },
    {
      name: '玉树—囊谦',
      frame: frame('玉树—囊谦', '玉树边部土酋', '玉树', {
        terrain: '高原', specialResources: '牦牛·羊·马·盐', taxLevel: '中',
        description: '通天河与扎曲上游的高原牧区，玉树、囊谦诸部游牧，丁青一带苯教兴盛。',
        strategicValue: '', threats: []
      }),
      blocks: {
        囊谦: dk('囊谦', 24, {
          officialPosition: '囊谦诸部首领', terrain: '高原', taxLevel: '中', specialResources: '牦牛·羊·盐', tags: { saltRegion: true },
          description: '扎曲上游，囊谦诸部所居，产盐；丁青一带苯教兴盛。',
          notes: '丁青在块内。'
        }),
        玉树: dk('玉树', 24, {
          officialPosition: '玉树边部土酋', terrain: '高原', taxLevel: '中', specialResources: '牦牛·马·羊', tags: { horseRegion: true },
          description: '通天河流域，玉树诸部游牧，北通青海湖、宗喀。',
          notes: ''
        })
      },
      regionMeans: { development: 24, unrest: 19, taxBurden: 42.47, armyPressure: 31 }
    },
    {
      name: '川西诸谷',
      frame: frame('川西诸谷', '甘孜土酋', '理塘', {
        terrain: '山地', specialResources: '马·茶·盐·牦牛', taxLevel: '中',
        description: '雅砻江、金沙江、大渡河诸谷的诸蕃部落，东与宋黎州、雅州、茂州边外互市茶马。',
        strategicValue: '宋川西茶马之路。', threats: ['宋黎、雅诸州边军']
      }),
      blocks: {
        理塘: dk('理塘', 26, {
          officialPosition: '甘孜土酋', terrain: '高原', taxLevel: '中', specialResources: '牦牛·马·羊', tags: { horseRegion: true },
          description: '雅砻江流域的高原牧场，甘孜、理塘诸部所居。',
          notes: '甘孜在块内；原账两笔：多康东南缘诸部、多康东南诸部。'
        }),
        巴塘: dk('巴塘', 24, {
          officialPosition: '茶马互市部酋', terrain: '河谷', taxLevel: '中', specialResources: '盐·青稞', tags: { saltRegion: true },
          description: '金沙江河谷，巴塘、芒康诸部，澜沧江畔盐井晒盐。',
          notes: '芒康在块内。'
        }),
        打箭炉地域: dk('打箭炉地域', 26, {
          officialPosition: '打箭炉诸部首领', terrain: '山地', taxLevel: '中', specialResources: '马·茶·木材', tags: { horseRegion: true },
          description: '大渡河以西，宋黎州、雅州边外诸蕃，岁至雅州碉门互市茶马。',
          notes: '原账两笔：多康川西诸部、多康东部诸部。'
        }),
        松州: dk('松州', 24, {
          officialPosition: '松州诸部首领', terrain: '山地', taxLevel: '中', specialResources: '马·牦牛·药材',
          description: '岷江上游，唐松州故地，吐蕃诸部与宋茂州、威州边外羌部杂居。',
          notes: '松潘在块内。'
        })
      },
      regionMeans: { development: 25.31, unrest: 20.08, taxBurden: 42.2, armyPressure: 31 }
    }
  ]
});

// ---------------- 东喀喇汗国 ----------------
const ek = mk(48, 24, [0.74, 0.06]);
const eastKarakhan = foreignTree({
  treeKey: 'fac_karakhan_east', idPrefix: 'div_ss_ekh_', faction: '东喀喇汗国',
  treeLabel: '东喀喇汗国行政树去掉国号节点（疏勒、莎车、于阗、姑墨、尼雅绿洲原账各拆几笔核算项，并回一块），',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: {
    疏勒: orig('farm', { commerceFactor: 1.3 }), 莎车: orig('farm'), 阿图什: orig('farm'),
    于阗: orig('farm', { commerceFactor: 1.2 }), 且末: orig('mixed'), 尼雅绿洲: orig('mixed'),
    姑墨: orig('farm'), 龟兹: orig('farm', { commerceFactor: 1.2 }),
    八剌沙衮: orig('mixed', { commerceFactor: 1.3 }), 怛罗斯: orig('mixed')
  },
  circuits: [
    {
      name: '疏勒地区',
      frame: frame('疏勒地区', '东喀喇汗·特勤', '疏勒', {
        terrain: '绿洲', specialResources: '棉布·瓜果·玉石·马', taxLevel: '中',
        description: '喀什噶尔绿洲诸城，东喀喇汗陪都，王族归信伊斯兰之地，丝路南北两道在此交会。',
        strategicValue: '葱岭以东的枢纽。', threats: ['西喀喇汗', '契丹余众西来'], hide: 1.0, textile: 0.8
      }),
      blocks: {
        疏勒: ek('疏勒', 40, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '东喀喇汗·特勤', terrain: '绿洲', taxLevel: '中',
          specialResources: '棉布·瓜果·铜器',
          description: '喀什噶尔，东喀喇汗陪都，麻赫穆德·喀什噶里于此编成《突厥语大词典》；原账另有据史德一笔并入。',
          notes: '《突厥语大词典》成书于熙宁年间。'
        }),
        莎车: ek('莎车', 36, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '莎车伯克', terrain: '绿洲', taxLevel: '中',
          specialResources: '瓜果·棉布',
          description: '叶尔羌河绿洲，丝路南道西段城邑；原账另有英吉沙一笔并入。',
          notes: ''
        }),
        阿图什: ek('阿图什', 34, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '阿图什伯克', terrain: '绿洲', taxLevel: '中',
          specialResources: '瓜果·棉布',
          description: '疏勒北郊，萨图克·博格拉汗归信伊斯兰后葬于此，喀喇汗王族圣地。',
          notes: ''
        })
      },
      regionMeans: { development: 36.9, unrest: 22, taxBurden: 56.41, armyPressure: 28.91 }
    },
    {
      name: '于阗—且末',
      frame: frame('于阗—且末', '东喀喇汗·埃米尔', '于阗', {
        terrain: '绿洲', specialResources: '玉石·丝·棉布', taxLevel: '中',
        description: '昆仑山北麓的丝路南道诸绿洲，于阗景德前后为喀喇汗所并，佛国旧地改宗伊斯兰。',
        strategicValue: '丝路南道。', threats: [], hide: 1.0, textile: 0.9
      }),
      blocks: {
        于阗: ek('于阗', 34, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '东喀喇汗·埃米尔', terrain: '绿洲', taxLevel: '中',
          specialResources: '玉石·丝·毡毯', tags: { mineralRegion: true },
          description: '于阗，玉河出美玉，景德三年前后为喀喇汗所并，仍以于阗之名入贡于宋；原账另有克里雅一笔并入。',
          notes: '和田玉。'
        }),
        且末: ek('且末', 28, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '且末伯克', terrain: '绿洲', taxLevel: '中',
          specialResources: '瓜果·玉石',
          description: '且末河绿洲，昆仑山北麓，丝路南道东段小邑。',
          notes: ''
        }),
        尼雅绿洲: ek('尼雅绿洲', 28, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '尼雅伯克', terrain: '绿洲', taxLevel: '中',
          specialResources: '瓜果·羊',
          description: '尼雅河尾闾，汉精绝国故地，南道小邑。',
          notes: '原账两笔：精绝、尼雅。'
        })
      },
      regionMeans: { development: 32.8, unrest: 22, taxBurden: 55.27, armyPressure: 31.55 }
    },
    {
      name: '龟兹—姑墨',
      frame: frame('龟兹—姑墨', '龟兹伯克', '龟兹', {
        terrain: '绿洲', specialResources: '铁·铜·瓜果·棉布', taxLevel: '中',
        description: '天山南麓的龟兹、姑墨诸绿洲，旧安西都护府之地，佛窟犹存。',
        strategicValue: '天山南路中段。', threats: ['高昌回鹘'], hide: 1.0, textile: 0.8
      }),
      blocks: {
        姑墨: ek('姑墨', 38, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '姑墨伯克', terrain: '绿洲', taxLevel: '中',
          specialResources: '瓜果·稻·棉布',
          description: '阿克苏绿洲，汉姑墨、温宿故地，天山南麓；原账拨换、姑墨、温宿三笔并入。',
          notes: ''
        }),
        龟兹: ek('龟兹', 40, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '龟兹伯克', terrain: '绿洲', taxLevel: '中',
          specialResources: '铁·铜·瓜果', tags: { mineralRegion: true },
          description: '龟兹，唐安西都护府治，克孜尔千佛洞所在，山中产铁、铜。',
          notes: ''
        })
      },
      regionMeans: { development: 39.2, unrest: 22, taxBurden: 56.87, armyPressure: 29.6 }
    },
    {
      name: '七河地区',
      frame: frame('七河地区', '东喀喇汗·桃花石阿尔斯兰汗', '八剌沙衮', {
        terrain: '河谷', specialResources: '马·羊·粮·毛毡', taxLevel: '中',
        description: '楚河、怛罗斯河流域，东喀喇汗汗廷所在，葛逻禄、康里诸部环伺，汗权日衰。',
        strategicValue: '汗廷。', threats: ['葛逻禄、康里诸部', '契丹余众西来'], hide: 1.1, textile: 0.6
      }),
      blocks: {
        八剌沙衮: ek('八剌沙衮', 38, {
          divisionType: '都城', regionType: 'normal', officialPosition: '东喀喇汗·桃花石阿尔斯兰汗', terrain: '河谷', taxLevel: '中',
          specialResources: '马·粮·毛毡', tags: { horseRegion: true },
          description: '东喀喇汗国都，楚河流域；玉素甫·哈斯·哈吉甫故里，熙宁二年著《福乐智慧》献于汗廷。',
          notes: ''
        }),
        怛罗斯: ek('怛罗斯', 34, {
          divisionType: '城', regionType: 'frontier_defense', officialPosition: '东喀喇汗·边境守将', terrain: '河谷', taxLevel: '中',
          specialResources: '马·羊·粮', tags: { horseRegion: true },
          description: '怛罗斯河谷，唐天宝十载高仙芝败于此，七河西部商镇与边戍。',
          notes: ''
        })
      },
      regionMeans: { development: 36.56, unrest: 23.28, taxBurden: 49.25, armyPressure: 30.11 }
    }
  ]
});

// ---------------- 西喀喇汗国 ----------------
const wk = mk(48, 24, [0.74, 0.06]);
const westKarakhan = foreignTree({
  treeKey: 'fac_karakhan_west', idPrefix: 'div_ss_wkh_', faction: '西喀喇汗国',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 撒马尔罕: orig('farm', { commerceFactor: 1.5 }), 石国: orig('farm', { commerceFactor: 1.2 }), 费尔干纳: orig('mixed') },
  circuits: [{
    name: '西喀喇汗',
    frame: frame('西喀喇汗', '西喀喇汗国·阿尔斯兰汗', '撒马尔罕', {
      terrain: '绿洲', specialResources: '丝·纸·棉布·马', taxLevel: '中',
      description: '河中泽拉夫尚河与锡尔河流域，西喀喇汗阿尔斯兰汗穆罕默德在位，奉塞尔柱苏丹桑贾尔为宗主。',
      strategicValue: '河中商都。', threats: ['塞尔柱宗主', '东喀喇汗'], hide: 1.0, textile: 1.0
    }),
    blocks: {
      撒马尔罕: wk('撒马尔罕', 46, {
        divisionType: '都城', regionType: 'normal', officialPosition: '西喀喇汗国·阿尔斯兰汗', terrain: '绿洲', taxLevel: '中',
        specialResources: '纸·丝·铜器',
        description: '西喀喇汗国都，泽拉夫尚河绿洲，撒马尔罕纸名闻四方；汗奉塞尔柱苏丹桑贾尔为宗主。',
        notes: '阿尔斯兰汗穆罕默德在位（1102—1130）。'
      }),
      石国: wk('石国', 42, {
        divisionType: '城', regionType: 'oasis_beglik', officialPosition: '石国伯克', terrain: '绿洲', taxLevel: '中',
        specialResources: '棉布·瓜果',
        description: '石国（赭时，今塔什干），锡尔河右岸绿洲，北接草原诸部。',
        notes: ''
      }),
      费尔干纳: wk('费尔干纳', 40, {
        divisionType: '部', regionType: 'oasis_beglik', officialPosition: '西喀喇汗国·突厥埃米尔', terrain: '盆地', taxLevel: '中',
        specialResources: '马·丝·瓜果', tags: { horseRegion: true },
        description: '费尔干纳盆地，汉大宛、唐拔汗那故地，产良马，喀喇汗诸系争夺之地。',
        notes: ''
      })
    },
    regionMeans: { development: 42, unrest: 22, taxBurden: 59, armyPressure: 25 }
  }]
});

// ---------------- 高昌回鹘 ----------------
const qc = mk(48, 24, [0.74, 0.06]);
const qocho = foreignTree({
  treeKey: 'fac_qocho', idPrefix: 'div_ss_gc_', faction: '高昌回鹘',
  treeLabel: '高昌回鹘行政树去掉国号节点（高昌、交河、蒲昌海北口原账各拆几笔核算项，并回一块），',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: {
    高昌: orig('farm', { commerceFactor: 1.3 }), 交河: orig('farm'), 伊州: orig('mixed', { commerceFactor: 1.2 }), 蒲昌海北口: orig('pastoral'),
    北庭: orig('mixed'), 焉耆: orig('farm'), 轮台: orig('mixed')
  },
  circuits: [
    {
      name: '高昌—伊州',
      frame: frame('高昌—伊州', '高昌回鹘·亦都护', '高昌', {
        terrain: '绿洲', specialResources: '棉布·葡萄·硇砂·马', taxLevel: '中',
        description: '吐鲁番盆地与哈密绿洲，西州回鹘（高昌回鹘）根本之地，亦都护冬居高昌，佛教、摩尼教、景教并行。',
        strategicValue: '丝路东段枢纽。', threats: ['西夏', '契丹余众西来'], hide: 1.0, textile: 0.9
      }),
      blocks: {
        高昌: qc('高昌', 42, {
          divisionType: '都城', regionType: 'normal', officialPosition: '高昌回鹘·亦都护', terrain: '绿洲', taxLevel: '中',
          specialResources: '棉布·葡萄·硇砂', tags: { mineralRegion: true },
          description: '西州回鹘都城高昌（火州），亦都护冬居于此，佛寺林立，柏孜克里克千佛洞在其北；原账柳中、高昌、西州三笔并入。',
          notes: '火焰山产硇砂。'
        }),
        交河: qc('交河', 36, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '交河城主', terrain: '绿洲', taxLevel: '中',
          specialResources: '葡萄·棉布',
          description: '交河故城与吐鲁番盆地西部，汉车师前国旧地；原账车师、交河两笔并入。',
          notes: ''
        }),
        伊州: qc('伊州', 36, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '伊州城主', terrain: '绿洲', taxLevel: '中',
          specialResources: '瓜果·马', tags: { horseRegion: true },
          description: '伊州（哈密），东接河西，丝路入西域的东门。',
          notes: ''
        }),
        蒲昌海北口: qc('蒲昌海北口', 30, {
          officialPosition: '蒲昌诸部首领', terrain: '荒漠', taxLevel: '轻', specialResources: '羊·盐·驼', tags: { saltRegion: true },
          description: '罗布泊（蒲昌海）以北，楼兰、鄯善故地，诸部零星散居；原账蒲昌、罗布泊东南诸部两笔并入。',
          notes: ''
        })
      },
      regionMeans: { development: 38.07, unrest: 21.85, taxBurden: 57.63, armyPressure: 29.8 }
    },
    {
      name: '北庭地区',
      frame: frame('北庭地区', '高昌回鹘·王子', '北庭', {
        terrain: '草原', specialResources: '马·羊·粮·毛毡', taxLevel: '中',
        description: '天山北麓别失八里一带，高昌回鹘夏都与牧场。',
        strategicValue: '亦都护夏都。', threats: ['漠北诸部'], hide: 1.1, textile: 0.6
      }),
      blocks: {
        北庭: qc('北庭', 42, {
          divisionType: '城', regionType: 'normal', officialPosition: '高昌回鹘·王子', terrain: '草原', taxLevel: '中',
          specialResources: '马·羊·粮', tags: { horseRegion: true },
          description: '别失八里（北庭），唐北庭都护府故地，天山北麓，高昌回鹘亦都护夏居之地。',
          notes: ''
        })
      },
      regionMeans: { development: 42, unrest: 22, taxBurden: 58, armyPressure: 33 }
    },
    {
      name: '焉耆—轮台',
      frame: frame('焉耆—轮台', '高昌回鹘·焉耆守将', '焉耆', {
        terrain: '绿洲', specialResources: '粮·鱼·马·羊', taxLevel: '中',
        description: '开都河与天山中段南北的焉耆、轮台，高昌回鹘西境。',
        strategicValue: '西境。', threats: ['东喀喇汗'], hide: 1.0, textile: 0.6
      }),
      blocks: {
        焉耆: qc('焉耆', 34, {
          divisionType: '城', regionType: 'oasis_beglik', officialPosition: '高昌回鹘·焉耆守将', terrain: '绿洲', taxLevel: '中',
          specialResources: '粮·鱼·马', tags: { fishingRegion: true },
          description: '焉耆，开都河与博斯腾湖畔绿洲，天山南路东段。',
          notes: ''
        }),
        轮台: qc('轮台', 30, {
          divisionType: '城', regionType: 'frontier_defense', officialPosition: '高昌回鹘·西陲守将', terrain: '草原', taxLevel: '中',
          specialResources: '马·羊', tags: { horseRegion: true },
          description: '天山北麓轮台，别失八里以西的牧地与边戍。',
          notes: ''
        })
      },
      regionMeans: { development: 32.21, unrest: 22, taxBurden: 54, armyPressure: 25.3 }
    }
  ]
});

module.exports = { trees: [tubo, guge, kham, eastKarakhan, westKarakhan, qocho] };
