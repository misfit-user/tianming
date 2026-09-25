// 绍宋·南方与海上八棵外藩树：大越李朝、蒲甘王朝、吕宋诸邦、流求诸部、麻逸、米沙鄢诸邦、蒲端国、北海诸部。
// 均无户口可考，各块按原账户数分，势力合计不动；重写路一级、官称、地形物产与描述。
// 城镇要地按今地核过所在块（tools/locate-points.js）：皎施灌区在实皆块，直通、马都八在萨尔温河口块，华闾在长安府块。
// 官称与剧本人物表对得上的照人物写（游戏按官称活绑定主官）。
'use strict';

const { foreignTree, block } = require('./shaosong-foreign');

const O = 'original';
// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function mk(minxin, corruption, fisc, defaults) {
  return (name, prosperity, fields) => block(Object.assign({
    name, divisionType: '部', regionType: 'normal', taxLevel: '中', tags: {},
    idx: [minxin, corruption, prosperity, prosperity, 22, 42, 25, 30], fisc
  }, defaults, fields, { notes: fields.notes || '户数按原账（无户口可考）。' }));
}
function frame(name, officialPosition, capital, fields) {
  return Object.assign({ name, officialPosition, capital, taxLevel: '中', threats: [], flee: 1.0, hide: 1.1, textile: 0.8 }, fields);
}
const L = (economy, extra) => Object.assign({ households: O, economy }, extra);

// ---------------- 大越李朝 ----------------
const dv = mk(52, 24, [0.76, 0.06], { divisionType: '府' });
const daiviet = foreignTree({
  treeKey: 'fac_daiviet', idPrefix: 'div_ss_dy_', faction: '大越李朝',
  treeLabel: '大越李朝行政树去掉国号节点（广源州原账广源、农州两笔核算项，并回一块），',
  reportNotes: ['户数：李朝无户口可考，按原账户数分。'],
  leaves: {
    升龙: L('farm', { commerceFactor: 1.5 }), 海东: L('farm', { commerceFactor: 1.2 }), 富良: L('farm'), 峰州: L('mixed'), 长安府: L('farm'),
    谅州: L('mixed'), 广源州: L('mixed'), 清化: L('farm'), 乂安: L('farm')
  },
  circuits: [
    {
      name: '升龙平原',
      frame: frame('升龙平原', '升龙京尹', '升龙', {
        terrain: '水乡', specialResources: '稻·丝·海产·瓷',
        description: '红河三角洲，李朝京畿与腹地；仁宗李乾德在位五十余年，皇太子李阳焕已立。',
        strategicValue: '国都与粮仓。', threats: ['宋广南西路']
      }),
      blocks: {
        升龙: dv('升龙', 56, {
          divisionType: '京', officialPosition: '升龙京尹', terrain: '水乡', specialResources: '稻·丝·瓷',
          description: '大越都城升龙，李太祖顺天元年自华闾迁都于此；文庙、国子监所在，北宁、海阳诸县环之。',
          notes: '海阳、北宁在块内。'
        }),
        海东: dv('海东', 44, {
          divisionType: '路', officialPosition: '海东路守', terrain: '沿海', specialResources: '海产·盐·稻', tags: { hasPort: true, fishingRegion: true, saltRegion: true },
          description: '红河三角洲以东的海东路，白藤江与下龙湾沿岸，海道通宋钦州、廉州。',
          notes: ''
        }),
        富良: dv('富良', 48, {
          officialPosition: '富良府守', terrain: '丘陵', specialResources: '稻·木材',
          description: '升龙以北的富良江（如月江）一线；熙宁十年宋郭逵南征至富良江，隔江相持而还。',
          notes: ''
        }),
        峰州: dv('峰州', 40, {
          divisionType: '州', officialPosition: '峰州知州', terrain: '河谷', specialResources: '稻·木材·象牙',
          description: '红河上游峰州（越池一带），唐峰州故地，山地诸部杂处。',
          notes: '越池在块内。'
        }),
        长安府: dv('长安府', 60, {
          officialPosition: '长安府守', terrain: '水乡', specialResources: '稻·石料',
          description: '红河三角洲南缘的长安府，丁、前黎两朝旧都华闾在焉，平野稻田最密。',
          notes: '华闾在块内。'
        })
      },
      regionMeans: { development: 51.93, unrest: 22, taxBurden: 46.42, armyPressure: 30.36 }
    },
    {
      name: '大越北部',
      frame: frame('大越北部', '谅州知州', '谅州', {
        terrain: '山地', specialResources: '木材·马·铜',
        description: '北接宋邕州、左右江的谅州、广源州山地，侬、黄诸土豪据地。',
        strategicValue: '宋越边界。', threats: ['宋邕州'], hide: 1.3
      }),
      blocks: {
        谅州: dv('谅州', 32, {
          divisionType: '州', officialPosition: '谅州知州', terrain: '山地', regionType: 'frontier_defense', specialResources: '木材·马', tags: { horseRegion: true },
          description: '谅州（谅山），北接宋邕州，熙宁战事中宋军曾入其地，土豪世守。',
          notes: ''
        }),
        广源州: dv('广源州', 28, {
          divisionType: '州', officialPosition: '广源州土官', terrain: '山地', regionType: 'tusi', specialResources: '金·木材', tags: { mineralRegion: true },
          description: '广源州，侬智高起兵之地；宋熙宁间一度取之，元丰七年两国划界归大越；原账另有农州一笔并入。',
          notes: '广源产金，宋人所称。'
        })
      },
      regionMeans: { development: 30.56, unrest: 22, taxBurden: 44.47, armyPressure: 43.12 }
    },
    {
      name: '清化—乂安',
      frame: frame('清化—乂安', '清化府守', '清化', {
        terrain: '平原', specialResources: '稻·海产·木材',
        description: '马江、蓝江流域的清化、乂安，大越南部，与占城相邻，屡为兵冲。',
        strategicValue: '南备占城。', threats: ['占城', '真腊']
      }),
      blocks: {
        清化: dv('清化', 44, {
          officialPosition: '清化府守', terrain: '平原', specialResources: '稻·海产', tags: { fishingRegion: true },
          description: '清化府（爱州），马江流域，前黎黎桓故乡，南部重镇。',
          notes: ''
        }),
        乂安: dv('乂安', 38, {
          divisionType: '州', officialPosition: '乂安州知州', terrain: '平原', regionType: 'frontier_defense', specialResources: '稻·木材·海产',
          description: '乂安州（驩州），蓝江流域，南邻占城，屡为兵冲。',
          notes: ''
        })
      },
      regionMeans: { development: 42.76, unrest: 22, taxBurden: 44.6, armyPressure: 32.67 }
    }
  ]
});

// ---------------- 蒲甘王朝 ----------------
const pg = mk(50, 24, [0.75, 0.06], { divisionType: '城', taxLevel: '轻' });
const pagan = foreignTree({
  treeKey: 'fac_pagan', idPrefix: 'div_ss_pg_', faction: '蒲甘王朝',
  reportNotes: ['户数：蒲甘无户口可考，按原账户数分。'],
  leaves: {
    蒲甘: L('farm', { commerceFactor: 1.3 }), 卑谬: L('farm'), 实皆: L('farm'), 勃固: L('farm', { commerceFactor: 1.2 }),
    萨尔温河口: L('farm', { commerceFactor: 1.2 }), 若开山地: L('mixed')
  },
  circuits: [
    {
      name: '蒲甘河谷',
      frame: frame('蒲甘河谷', '蒲甘城主', '蒲甘', {
        terrain: '河谷', specialResources: '稻·棉·漆器·象',
        description: '伊洛瓦底江中上游的蒲甘王畿，阿朗悉都在位，塔寺林立，皎施、敏巫诸灌区为粮仓。',
        strategicValue: '王畿。', threats: []
      }),
      blocks: {
        蒲甘: pg('蒲甘', 48, {
          divisionType: '都城', officialPosition: '蒲甘城主', terrain: '河谷', specialResources: '棉·漆器·佛塔营造',
          description: '伊洛瓦底江中游干燥地带的王都蒲甘，江喜陀所建阿难陀寺等塔寺林立，上座部佛教中心。',
          notes: '阿难陀寺建于宋崇宁四年前后。'
        }),
        卑谬: pg('卑谬', 30, {
          officialPosition: '卑谬城主', terrain: '河谷', specialResources: '稻·木材',
          description: '卑谬（室利差呾罗），骠国旧都，伊洛瓦底江下游门户。',
          notes: ''
        }),
        实皆: pg('实皆', 34, {
          officialPosition: '蒲甘属部·掸地山寨头人', terrain: '河谷', specialResources: '稻·柚木·宝石',
          description: '伊洛瓦底江与钦敦江交汇之地以北的上缅甸，皎施灌区在其南缘，东接掸地山寨。',
          notes: '皎施在块内。'
        })
      },
      regionMeans: { development: 42.05, unrest: 20, taxBurden: 47.57, armyPressure: 15.58 }
    },
    {
      name: '孟地沿海',
      frame: frame('孟地沿海', '蒲甘属部·直通孟人首领', '萨尔温河口', {
        terrain: '沿海', specialResources: '稻·海产·香料·海舶',
        description: '下缅甸孟人故地，阿奴律陀取直通后归于蒲甘，孟人文字与上座部经典由此北传，海口通南海诸国。',
        strategicValue: '海口。', threats: []
      }),
      blocks: {
        勃固: pg('勃固', 40, {
          officialPosition: '勃固城主', terrain: '水乡', specialResources: '稻·海产', tags: { fishingRegion: true },
          description: '勃固（汉达瓦底），孟人旧都，伊洛瓦底江三角洲东部稻区。',
          notes: ''
        }),
        萨尔温河口: pg('萨尔温河口', 40, {
          officialPosition: '蒲甘属部·直通孟人首领', terrain: '沿海', specialResources: '海产·香料·海舶', tags: { hasPort: true, fishingRegion: true },
          description: '萨尔温江口的直通与马都八，孟人上座部佛教之源；嘉祐二年阿奴律陀取直通，海舶往来南海。',
          notes: '直通、马都八在块内。'
        })
      },
      regionMeans: { development: 40, unrest: 20, taxBurden: 48, armyPressure: 18 }
    },
    {
      name: '若开山地',
      frame: frame('若开山地', '若开王', '若开山地', {
        terrain: '山地', specialResources: '稻·海产·木材',
        description: '若开山脉以西的若开（阿拉干）海岸，诸王奉蒲甘为宗主。',
        strategicValue: '', threats: []
      }),
      blocks: {
        若开山地: pg('若开山地', 24, {
          divisionType: '国', officialPosition: '若开王', terrain: '沿海', regionType: 'fanbang', specialResources: '稻·海产', tags: { fishingRegion: true },
          description: '若开（阿拉干）沿海与山地，阿朗悉都曾扶立若开王复位，奉蒲甘为宗主。',
          notes: '妙乌一带在块内。'
        })
      },
      regionMeans: { development: 24, unrest: 20, taxBurden: 43, armyPressure: 18 }
    }
  ]
});

// ---------------- 海岛诸邦 ----------------
const isl = mk(46, 16, [0.76, 0.04], { taxLevel: '轻', regionType: 'fanbang' });
function islandTree(treeKey, idPrefix, faction, circuitName, circuitFrame, blocks, leaves, regionMeans) {
  return foreignTree({
    treeKey, idPrefix, faction,
    reportNotes: ['户数：无户口可考，按原账户数分。'],
    leaves,
    circuits: [{ name: circuitName, frame: circuitFrame, blocks, regionMeans }]
  });
}

const luzon = islandTree('fac_nanhai', 'div_ss_lz_', '吕宋诸邦', '吕宋',
  frame('吕宋', '吕宋大邦拉者', '吕宋中原', {
    terrain: '林地', specialResources: '稻·黄蜡·木棉·海产', taxLevel: '轻',
    description: '吕宋岛上各据河口、平原的巴朗盖诸邦，拉者（达图）为长，与宋商舶以黄蜡、木棉易瓷器、铁器。',
    strategicValue: '', threats: []
  }),
  {
    吕宋北港: isl('吕宋北港', 28, {
      officialPosition: '对宋海贸大首领', terrain: '沿海', specialResources: '黄蜡·海产', tags: { hasPort: true, fishingRegion: true },
      description: '吕宋西北海岸的港湾聚落，宋商舶北来泊舟易货。',
      notes: '维甘一带在块内。'
    }),
    卡加延河谷: isl('卡加延河谷', 28, {
      officialPosition: '邻河大邦拉者', terrain: '河谷', specialResources: '稻·木材',
      description: '吕宋北部卡加延河谷的巴朗盖诸邦，沿河种稻。',
      notes: ''
    }),
    吕宋中原: isl('吕宋中原', 28, {
      officialPosition: '吕宋大邦拉者', terrain: '平原', specialResources: '稻·木棉',
      description: '吕宋中部平原的内河大邦，稻作最盛，诸邦以拉者为长。',
      notes: '邦板牙一带在块内。'
    }),
    马尼拉湾诸聚落: isl('马尼拉湾诸聚落', 28, {
      officialPosition: '近海分邦拉者', terrain: '沿海', specialResources: '海产·黄蜡', tags: { hasPort: true, fishingRegion: true },
      description: '马尼拉湾沿岸的近海巴朗盖，渔捞与海舶贸易并兴。',
      notes: ''
    })
  },
  { 吕宋北港: L('mixed'), 卡加延河谷: L('farm'), 吕宋中原: L('farm'), 马尼拉湾诸聚落: L('mixed') },
  { development: 28, unrest: 22, taxBurden: 39, armyPressure: 25 });

const liuqiu = islandTree('fac_liuqiu', 'div_ss_lq_', '流求诸部', '流求',
  frame('流求', '流求·大社头目', '流求中部', {
    terrain: '山林', specialResources: '鹿皮·粟·海产', taxLevel: '轻',
    description: '泉州东海中的流求（台湾），诸社无君长，以渔猎、粟作为生，宋人罕至。',
    strategicValue: '', threats: []
  }),
  {
    流求北部: isl('流求北部', 26, {
      officialPosition: '流求北部社长', terrain: '山林', taxLevel: '中', specialResources: '鹿皮·海产', tags: { fishingRegion: true },
      description: '流求北部的平埔诸社，渔猎与山田并作。',
      notes: ''
    }),
    流求中部: isl('流求中部', 26, {
      officialPosition: '流求·大社头目', terrain: '山林', taxLevel: '中', specialResources: '鹿皮·粟·藤',
      description: '流求中部山前平原与高山诸社，猎鹿为生，有大社统诸小社。',
      notes: ''
    }),
    流求南部: isl('流求南部', 26, {
      officialPosition: '流求南部社长', terrain: '沿海', taxLevel: '中', specialResources: '海产·鹿皮', tags: { fishingRegion: true },
      description: '流求西南海岸诸社，与澎湖相望，渔捞为业。',
      notes: ''
    })
  },
  { 流求北部: L('pastoral'), 流求中部: L('pastoral'), 流求南部: L('pastoral') },
  { development: 26, unrest: 14, taxBurden: 41, armyPressure: 25 });

const mai = islandTree('fac_mai', 'div_ss_my_', '麻逸', '麻逸',
  frame('麻逸', '麻逸·拉贾', '麻逸', {
    terrain: '沿海', specialResources: '黄蜡·吉贝布·海舶', taxLevel: '轻',
    description: '民都洛岛的麻逸国，宋太平兴国七年即有商人载宝货至广州，以黄蜡、吉贝布、玳瑁易瓷器。',
    strategicValue: '宋舶南来之地。', threats: []
  }),
  {
    麻逸: isl('麻逸', 26, {
      divisionType: '国', officialPosition: '麻逸·拉贾', terrain: '沿海', specialResources: '黄蜡·吉贝布·玳瑁', tags: { hasPort: true, fishingRegion: true },
      description: '麻逸国，民都洛岛港市，宋商舶至则泊官场前，蛮贾丛至，以货易货。',
      notes: '《宋史·阇婆传》附记摩逸国太平兴国七年载宝货至广州。'
    })
  },
  { 麻逸: L('mixed', { commerceFactor: 1.3 }) },
  { development: 26, unrest: 22, taxBurden: 39, armyPressure: 25 });

const visayas = islandTree('fac_visayas', 'div_ss_ms_', '米沙鄢诸邦', '米沙鄢',
  frame('米沙鄢', '宿务大邦·拉者', '宿务诸邦', {
    terrain: '沿海', specialResources: '海产·珍珠·黄蜡', taxLevel: '轻',
    description: '班乃、宿务、莱特诸岛的岛邦，纹身勇士善航海，采珠渔捞。',
    strategicValue: '', threats: []
  }),
  {
    班乃诸邦: isl('班乃诸邦', 26, {
      officialPosition: '班乃岛邦·拉者', terrain: '沿海', specialResources: '稻·海产', tags: { fishingRegion: true },
      description: '班乃岛诸邦，沿海平原种稻，渔捞为业。',
      notes: '伊洛伊洛一带在块内。'
    }),
    宿务诸邦: isl('宿务诸邦', 26, {
      officialPosition: '宿务大邦·拉者', terrain: '沿海', specialResources: '珍珠·海产', tags: { hasPort: true, fishingRegion: true },
      description: '宿务岛大邦，港湾聚落，采珠海商往来诸岛。',
      notes: ''
    }),
    雷伊泰诸邦: isl('雷伊泰诸邦', 26, {
      officialPosition: '莱特岛邦·拉者', terrain: '沿海', specialResources: '海产·木材', tags: { fishingRegion: true },
      description: '莱特（雷伊泰）岛诸邦，东临大洋。',
      notes: '塔克洛班一带在块内。'
    })
  },
  { 班乃诸邦: L('mixed'), 宿务诸邦: L('mixed', { commerceFactor: 1.2 }), 雷伊泰诸邦: L('mixed') },
  { development: 26, unrest: 22, taxBurden: 39, armyPressure: 25 });

const butuan = islandTree('fac_butuan', 'div_ss_pd_', '蒲端国', '蒲端',
  frame('蒲端', '蒲端国主·拉惹', '蒲端', {
    terrain: '沿海', specialResources: '金·海舶·玳瑁', taxLevel: '轻',
    description: '棉兰老岛北岸的蒲端国，宋咸平四年起数遣使朝贡，产金，以大舟航海。',
    strategicValue: '', threats: []
  }),
  {
    蒲端: isl('蒲端', 28, {
      divisionType: '国', officialPosition: '蒲端国主·拉惹', terrain: '沿海', specialResources: '金·玳瑁·海舶', tags: { hasPort: true, mineralRegion: true, fishingRegion: true },
      description: '蒲端国，棉兰老岛北岸武端河口，产金，以大舟航海；咸平四年、景德四年、大中祥符四年遣使入宋。',
      notes: '《宋史·蒲端传》。'
    })
  },
  { 蒲端: L('mixed', { commerceFactor: 1.3 }) },
  { development: 28, unrest: 22, taxBurden: 40, armyPressure: 25 });

// ---------------- 北海诸部 ----------------
const bh = mk(46, 16, [0.76, 0.04], { taxLevel: '轻', regionType: 'tribal_frontier', terrain: '林地' });
const beihai = foreignTree({
  treeKey: 'fac_beihai', idPrefix: 'div_ss_bh_', faction: '北海诸部',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: {
    虾夷渡岛: L('pastoral'), 石狩诸聚落: L('pastoral'), 日高诸聚落: L('pastoral'), 鄂霍次克沿岸: L('pastoral'),
    骨嵬诸聚落: L('pastoral'), 黑水下游诸部: L('pastoral'), 黑水中游诸部: L('pastoral'), 黑水入海口: L('pastoral')
  },
  circuits: [
    {
      name: '虾夷诸地',
      frame: frame('虾夷诸地', '虾夷诸聚落酋长', '石狩诸聚落', {
        terrain: '林地', specialResources: '鲑·鹿皮·海兽皮·昆布', taxLevel: '轻',
        description: '津轻海峡以北的虾夷之地，擦文诸聚落沿河渔猎鲑鱼，东北海岸有鄂霍次克海人。',
        strategicValue: '', threats: [], hide: 1.3, textile: 0.3
      }),
      blocks: {
        虾夷渡岛: bh('虾夷渡岛', 18, {
          officialPosition: '渡岛聚落酋长', terrain: '沿海', specialResources: '昆布·海产', tags: { fishingRegion: true },
          description: '渡岛半岛，隔津轻海峡与陆奥相望，聚落与本州往来易物。',
          notes: '松前一带在块内。'
        }),
        石狩诸聚落: bh('石狩诸聚落', 18, {
          officialPosition: '虾夷诸聚落酋长', specialResources: '鲑·鹿皮', tags: { fishingRegion: true },
          description: '石狩川流域的擦文诸聚落，竖穴居，溯河捕鲑。',
          notes: ''
        }),
        日高诸聚落: bh('日高诸聚落', 16, {
          officialPosition: '日高聚落酋长', terrain: '山林', specialResources: '鹿皮·鲑', tags: { fishingRegion: true },
          description: '日高山脉南麓沿海诸聚落，渔猎为生。',
          notes: ''
        }),
        鄂霍次克沿岸: bh('鄂霍次克沿岸', 16, {
          officialPosition: '鄂霍次克海人首领', terrain: '沿海', specialResources: '海兽皮·海产', tags: { fishingRegion: true },
          description: '虾夷东北鄂霍次克海岸，猎海兽的鄂霍次克海人聚落，与擦文诸聚落渐相交融。',
          notes: '网走一带在块内。'
        })
      },
      regionMeans: { development: 17.2, unrest: 22, taxBurden: 38.2, armyPressure: 25 }
    },
    {
      name: '骨嵬诸地',
      frame: frame('骨嵬诸地', '北海诸部·骨嵬岛首领', '骨嵬诸聚落', {
        terrain: '林地', specialResources: '貂皮·海产·鲑', taxLevel: '轻',
        description: '黑水口外的大岛（库页岛），骨嵬等诸部渔猎，与黑水诸部往来。',
        strategicValue: '', threats: [], hide: 1.3, textile: 0.3
      }),
      blocks: {
        骨嵬诸聚落: bh('骨嵬诸聚落', 14, {
          officialPosition: '北海诸部·骨嵬岛首领', specialResources: '貂皮·海产·鲑', tags: { fishingRegion: true },
          description: '库页岛上的骨嵬诸聚落，渔猎海兽、捕貂。',
          notes: ''
        })
      },
      regionMeans: { development: 14, unrest: 22, taxBurden: 41, armyPressure: 29 }
    },
    {
      name: '黑水诸部',
      frame: frame('黑水诸部', '北海诸部·众部共推之长', '黑水下游诸部', {
        terrain: '林地', specialResources: '貂皮·东珠·海东青·鲑', taxLevel: '轻',
        description: '混同江（黑龙江）中下游至入海口的渔猎诸部，吉里迷、兀的改等，向金输貂皮、海东青。',
        strategicValue: '金东北外缘。', threats: ['金'], hide: 1.3, textile: 0.3
      }),
      blocks: {
        黑水下游诸部: bh('黑水下游诸部', 22, {
          officialPosition: '北海诸部·众部共推之长', specialResources: '貂皮·鲑·东珠', tags: { fishingRegion: true },
          description: '混同江下游（今哈巴罗夫斯克一带）诸部，渔猎为生，产东珠、貂皮。',
          notes: ''
        }),
        黑水中游诸部: bh('黑水中游诸部', 20, {
          officialPosition: '北海诸部·掌贡赋头人', terrain: '山林', specialResources: '貂皮·鹿',
          description: '混同江中游与外兴安岭南麓的林中诸部，捕貂猎鹿，向金纳贡。',
          notes: ''
        }),
        黑水入海口: bh('黑水入海口', 20, {
          officialPosition: '北海诸部·吉里迷部酋', terrain: '沿海', specialResources: '鲑·海兽皮·海东青', tags: { fishingRegion: true },
          description: '混同江入海口的吉里迷诸部，捕鲑与海兽，海东青所出。',
          notes: ''
        })
      },
      regionMeans: { development: 20.59, unrest: 22, taxBurden: 38.47, armyPressure: 25 }
    }
  ]
});

module.exports = { trees: [daiviet, pagan, luzon, liuqiu, mai, visayas, butuan, beihai] };
