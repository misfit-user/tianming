// 绍宋·西南八棵外藩树：大理国、滇中南诸部、建昌诸部、滇西北诸部、乌蒙乌撒诸部、金齿诸部、罗殿国、自杞国。
// 这一带无户口可考（《元史·地理志》云南诸路只记建置沿革，不记户数），各块按原账户数分，势力合计不动；
// 这里重写的是路一级、官称、地形物产与描述。官称与剧本人物表对得上的（乌蒙大酋、罗殿王、自杞国主等）照人物写，
// 游戏按官称活绑定主官。用法见 rebuild-shaosong.js（shaosong-southwest.js#序号）。
'use strict';

const { foreignTree, block } = require('./shaosong-foreign');

const O = 'original';
// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function b(name, prosperity, fields, fisc) {
  return block(Object.assign({
    name, divisionType: '部', regionType: 'tusi', taxLevel: '轻', tags: {},
    idx: [44, 18, prosperity, prosperity, 20, 40, 28, 30], fisc: fisc || [0.75, 0.05]
  }, fields));
}
function frame(name, officialPosition, capital, fields) {
  return Object.assign({ name, officialPosition, capital, taxLevel: '轻', threats: [], flee: 1.0, hide: 1.3, textile: 0.6 }, fields);
}

// ---------------- 大理国 ----------------
const DALI_F = [0.76, 0.06];
const dali = foreignTree({
  treeKey: 'fac_dali', idPrefix: 'div_ss_dl_', faction: '大理国',
  treeLabel: '大理国行政树去掉「大理国」国号节点，',
  reportNotes: ['户数：大理国无户口可考，按原账户数分；大理「八府四郡三十七部」，地图八块取其主要府郡。'],
  leaves: {
    大理: { households: O, economy: 'farm', commerceFactor: 1.5 }, 永昌府: { households: O, economy: 'mixed' },
    弄栋府: { households: O, economy: 'farm' }, 鄯阐府: { households: O, economy: 'farm', commerceFactor: 1.2 },
    威楚府: { households: O, economy: 'farm' }, 秀山郡: { households: O, economy: 'farm' },
    统矢府: { households: O, economy: 'mixed' }, 会川府: { households: O, economy: 'mixed' }
  },
  circuits: [
    {
      name: '洱海—永昌',
      frame: frame('洱海—永昌', '清平官', '大理', {
        terrain: '盆地', specialResources: '稻·马·茶·盐', taxLevel: '中',
        description: '洱海、苍山之间的大理国都与西部永昌、姚州诸府；段氏为国主，高氏世为相国秉政。',
        strategicValue: '国都与西通骠国、天竺之路。', threats: ['高氏专权'], hide: 1.1, textile: 0.8
      }),
      blocks: {
        大理: b('大理', 60, {
          divisionType: '都城', regionType: 'normal', officialPosition: '清平官', terrain: '盆地', taxLevel: '中',
          specialResources: '稻·马·大理石', tags: { horseRegion: true },
          description: '大理国都羊苴咩城，洱海西岸、苍山东麓，崇圣寺三塔在焉；段氏世为国主，高氏世袭相国，号中国公。',
          notes: '南诏旧都。'
        }, DALI_F),
        永昌府: b('永昌府', 54, {
          divisionType: '府', regionType: 'normal', officialPosition: '永昌府主', terrain: '山地', taxLevel: '中',
          specialResources: '象·琥珀·木棉',
          description: '南诏永昌节度故地，澜沧江以西，西通骠国、天竺，金齿诸部在其西南。',
          notes: '唐永昌郡。'
        }, DALI_F),
        弄栋府: b('弄栋府', 56, {
          divisionType: '府', regionType: 'normal', officialPosition: '弄栋府主', terrain: '丘陵', taxLevel: '中',
          specialResources: '稻·盐',
          description: '唐姚州都督府故地，南诏置弄栋节度，大理为弄栋府，东通威楚、鄯阐。',
          notes: '唐姚州。'
        }, DALI_F)
      },
      regionMeans: { development: 58, unrest: 20, taxBurden: 50, armyPressure: 12 }
    },
    {
      name: '鄯阐—威楚',
      frame: frame('鄯阐—威楚', '善阐侯', '鄯阐府', {
        terrain: '盆地', specialResources: '稻·盐·马·铜', taxLevel: '中',
        description: '滇池之滨的鄯阐（东京）与威楚、通海诸府郡，高氏子弟分镇其地，东接三十七部。',
        strategicValue: '大理东部重镇。', threats: ['三十七部'], hide: 1.1, textile: 0.8
      }),
      blocks: {
        鄯阐府: b('鄯阐府', 60, {
          divisionType: '府', regionType: 'normal', officialPosition: '善阐侯', governor: '高顺贞', terrain: '盆地', taxLevel: '中',
          specialResources: '稻·马·鱼', tags: { horseRegion: true, fishingRegion: true },
          description: '南诏拓东城，改善阐，为大理东京；滇池之滨，高氏子弟世镇其地。',
          notes: '《元史·地理志》中庆路：「凤伽异增筑城曰柘东，六世孙券丰祐改曰善阐」。'
        }, DALI_F),
        威楚府: b('威楚府', 56, {
          divisionType: '府', regionType: 'normal', officialPosition: '威楚府主', terrain: '盆地', taxLevel: '中',
          specialResources: '盐·稻', tags: { saltRegion: true },
          description: '爨酋威楚筑城俄碌睒居之，故名；段氏以威楚封高明量，其后高氏世守，境有黑、白诸盐井。',
          notes: '《元史·地理志》：「至段氏封高明量于威楚」。'
        }, DALI_F),
        秀山郡: b('秀山郡', 54, {
          divisionType: '郡', regionType: 'normal', officialPosition: '秀山郡守', terrain: '丘陵', taxLevel: '中',
          specialResources: '稻·鱼', tags: { fishingRegion: true },
          description: '通海，南诏置通海都督，大理为秀山郡，杞麓湖畔，南通交趾。',
          notes: '大理四郡之一。'
        }, DALI_F)
      },
      regionMeans: { development: 58, unrest: 20, taxBurden: 50, armyPressure: 12 }
    },
    {
      name: '会川—统矢',
      frame: frame('会川—统矢', '会川府主', '会川府', {
        terrain: '山地', specialResources: '马·铜·木材', taxLevel: '中',
        description: '金沙江两岸的会川、统矢诸府，乌蛮、白蛮杂居，北接建昌诸部。',
        strategicValue: '北通建昌、黎州。', threats: ['乌蛮诸部'], hide: 1.2, textile: 0.6
      }),
      blocks: {
        统矢府: b('统矢府', 54, {
          divisionType: '府', regionType: 'normal', officialPosition: '统矢府主', terrain: '山地', taxLevel: '中',
          specialResources: '马·木材',
          description: '大理北部诸府之一，金沙江南岸山地，乌蛮、白蛮杂居。',
          notes: '大理八府之一。'
        }, DALI_F),
        会川府: b('会川府', 56, {
          divisionType: '府', regionType: 'normal', officialPosition: '会川府主', terrain: '山地', taxLevel: '中',
          specialResources: '马·铜·木材', tags: { horseRegion: true },
          description: '唐会同川，南诏置会川都督，扼金沙江以北、建昌以南的通道。',
          notes: '大理八府之一。'
        }, DALI_F)
      },
      regionMeans: { development: 58, unrest: 20, taxBurden: 50, armyPressure: 12 }
    }
  ]
});

// ---------------- 滇中南诸部 ----------------
const xinan = foreignTree({
  treeKey: 'fac_xinan_tribes', idPrefix: 'div_ss_dzn_', faction: '滇中南诸部',
  treeLabel: '滇中南诸部行政树去掉国号节点（石城郡、步头、银生原账各拆两笔核算项，并回一块），',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: {
    石城郡: { households: O, economy: 'mixed' }, 嶍峨: { households: O, economy: 'mixed' }, 特磨道: { households: O, economy: 'mixed' },
    步头: { households: O, economy: 'mixed' }, 银生: { households: O, economy: 'mixed' }
  },
  circuits: [{
    name: '滇中南',
    frame: frame('滇中南', '滇中南乌蛮大酋', '石城郡', {
      terrain: '山地', specialResources: '马·茶·铜鼓',
      description: '滇池以东、以南的三十七部之地，名隶大理而诸部自治，乌蛮、白蛮、和泥诸部杂居，东以马道通宋邕州。',
      strategicValue: '大理与宋邕州之间的马道。', threats: ['大理高氏', '诸部相攻']
    }),
    blocks: {
      石城郡: b('石城郡', 26, {
        divisionType: '郡', officialPosition: '滇中南乌蛮大酋', terrain: '丘陵', specialResources: '马·粮', tags: { horseRegion: true },
        description: '今曲靖，爨氏旧治石城，大理四郡之一，滇黔边乌蛮诸部会盟之地。',
        notes: '南诏石城郡。'
      }),
      嶍峨: b('嶍峨', 22, {
        terrain: '山地', officialPosition: '嶍峨部酋长', specialResources: '粮·木材',
        description: '滇池以南山地，僰、和泥诸部所居。',
        notes: '今峨山一带。'
      }),
      特磨道: b('特磨道', 22, {
        divisionType: '道', officialPosition: '滇中南乌蛮东部酋长', terrain: '山地', specialResources: '马·铜鼓', tags: { horseRegion: true },
        description: '滇东南与宋广南西路邕州相接；侬智高败走大理后，其母阿侬曾率余众依特磨道侬夏卿。',
        notes: '宋皇祐五年事。'
      }),
      步头: b('步头', 22, {
        terrain: '山地', officialPosition: '步头部酋长', specialResources: '粮·木材',
        description: '红河上游，唐时自步头循红河可通安南，和泥诸部所居。',
        notes: '红河水道。'
      }),
      银生: b('银生', 24, {
        terrain: '山林', officialPosition: '银生部酋长', specialResources: '茶·象·木材',
        description: '南诏银生节度故地，扑子、和泥诸部所居；《蛮书》称茶出银生城界诸山。',
        notes: '今景东以南。'
      })
    },
    regionMeans: { development: 23.17, unrest: 20, taxBurden: 41.29, armyPressure: 31 }
  }]
});

// ---------------- 建昌诸部 ----------------
const jianchang = foreignTree({
  treeKey: 'fac_jianchang', idPrefix: 'div_ss_jc_', faction: '建昌诸部',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 建昌府: { households: O, economy: 'mixed' }, 邛部: { households: O, economy: 'mixed' } },
  circuits: [{
    name: '建昌',
    frame: frame('建昌', '建昌府主', '建昌府', {
      terrain: '山地', specialResources: '马·粮·木材', taxLevel: '中',
      description: '大渡河以南、金沙江以北的建昌与邛部川，乌蛮诸部所居；名隶大理，北与宋黎州互市。',
      strategicValue: '宋黎州以南的屏障。', threats: ['诸部相攻']
    }),
    blocks: {
      建昌府: b('建昌府', 32, {
        divisionType: '府', officialPosition: '建昌府主', terrain: '河谷', taxLevel: '中', specialResources: '马·粮', tags: { horseRegion: true },
        description: '今西昌，唐嶲州，南诏置建昌府，大理因之，安宁河谷乌蛮诸部所居。',
        notes: '唐嶲州。'
      }),
      邛部: b('邛部', 30, {
        officialPosition: '邛部川大首领', terrain: '山地', taxLevel: '中', specialResources: '马·羊',
        description: '邛部川蛮，宋黎州以南，岁至黎州互市，受宋封号。',
        notes: '宋有「邛部川蛮」。'
      })
    },
    regionMeans: { development: 31.05, unrest: 20, taxBurden: 41.61, armyPressure: 27.35 }
  }]
});

// ---------------- 滇西北诸部 ----------------
const nwyunnan = foreignTree({
  treeKey: 'fac_nw_yunnan', idPrefix: 'div_ss_dxb_', faction: '滇西北诸部',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 磨些部: { households: O, economy: 'mixed' }, 剑川: { households: O, economy: 'mixed' }, 丽水上游: { households: O, economy: 'pastoral' } },
  circuits: [{
    name: '滇西北',
    frame: frame('滇西北', '磨些大酋', '磨些部', {
      terrain: '山地', specialResources: '盐·马·木材', taxLevel: '中',
      description: '金沙江上游与西洱河以北的磨些、施、顺诸部，名隶大理，北通吐蕃多康。',
      strategicValue: '大理北通吐蕃之路。', threats: ['吐蕃诸部']
    }),
    blocks: {
      磨些部: b('磨些部', 36, {
        officialPosition: '磨些大酋', terrain: '山地', taxLevel: '中', specialResources: '马·盐·木材', tags: { horseRegion: true },
        description: '金沙江上游丽江一带的磨些诸部，以部落自治，名隶大理。',
        notes: '纳西先民。'
      }),
      剑川: b('剑川', 40, {
        officialPosition: '西洱河蛮部酋', terrain: '河谷', taxLevel: '中', specialResources: '粮·木材·盐',
        description: '南诏六节度之一剑川节度故地；浪穹诏战败退保剑川，西洱河以北诸部所居。',
        notes: '《元史·地理志》鹤庆路剑川县。'
      }),
      丽水上游: b('丽水上游', 34, {
        officialPosition: '丽水诸部酋长', terrain: '山林', taxLevel: '中', specialResources: '金·木材', tags: { mineralRegion: true },
        description: '丽水（伊洛瓦底江上游）山地，南诏丽水节度故地，寻传、裸形诸部所居，产金。',
        notes: '《蛮书》丽水出金。'
      })
    },
    regionMeans: { development: 38, unrest: 20, taxBurden: 42.67, armyPressure: 18 }
  }]
});

// ---------------- 乌蒙乌撒诸部 ----------------
const wumeng = foreignTree({
  treeKey: 'fac_wumeng', idPrefix: 'div_ss_wm_', faction: '乌蒙乌撒诸部',
  treeLabel: '乌蒙乌撒诸部行政树去掉国号节点（乌蒙、乌撒原账各拆两笔核算项，并回一块），',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 乌蒙: { households: O, economy: 'mixed' }, 乌撒: { households: O, economy: 'mixed' }, 罗婺: { households: O, economy: 'mixed' } },
  circuits: [{
    name: '乌蒙乌撒',
    frame: frame('乌蒙乌撒', '乌蒙大酋', '乌蒙', {
      terrain: '山地', specialResources: '马·铜·木材', taxLevel: '中',
      description: '乌蒙山区的乌蒙、乌撒与金沙江南岸的罗婺诸部，乌蛮三十七部中的大部，产良马。',
      strategicValue: '滇东北通川南之路。', threats: ['诸部相攻']
    }),
    blocks: {
      乌蒙: b('乌蒙', 30, {
        officialPosition: '乌蒙大酋', terrain: '山地', specialResources: '马·铜', tags: { horseRegion: true },
        description: '乌蒙山区（今昭通一带），乌蛮乌蒙部所居，北通宋叙州、泸州。',
        notes: '乌蛮三十七部之一。'
      }),
      乌撒: b('乌撒', 30, {
        officialPosition: '乌撒部首领', terrain: '高原', taxLevel: '中', specialResources: '马·羊', tags: { horseRegion: true },
        description: '乌撒部（今威宁一带），高原草场，乌撒马闻名。',
        notes: '乌撒马。'
      }),
      罗婺: b('罗婺', 30, {
        officialPosition: '罗婺部酋', terrain: '山地', taxLevel: '中', specialResources: '马·粮',
        description: '罗婺部（今武定一带），段氏使乌蛮阿𠠝治纳洟胒共龙城，其裔以远祖罗婺为部名。',
        notes: '《元史·地理志》武定路。'
      })
    },
    regionMeans: { development: 29.86, unrest: 20, taxBurden: 41.75, armyPressure: 25.59 }
  }]
});

// ---------------- 金齿诸部 ----------------
const jinchi = foreignTree({
  treeKey: 'fac_jinchi', idPrefix: 'div_ss_jcz_', faction: '金齿诸部',
  treeLabel: '金齿诸部行政树去掉国号节点（金齿诸部原账拆五笔核算项，并回一块），',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 金齿诸部: { households: O, economy: 'mixed' }, 寻传: { households: O, economy: 'mixed' }, 高黎贡山口: { households: O, economy: 'mixed' } },
  circuits: [{
    name: '金齿',
    frame: frame('金齿', '金齿大首领', '金齿诸部', {
      terrain: '山林', specialResources: '象·金·稻·木棉', taxLevel: '中',
      description: '永昌以西、伊洛瓦底江上游的金齿、寻传诸部，以金裹齿，勐坝稻作，名隶大理，西南接蒲甘。',
      strategicValue: '滇缅商道。', threats: ['蒲甘', '大理']
    }),
    blocks: {
      金齿诸部: b('金齿诸部', 28, {
        officialPosition: '金齿大首领', terrain: '河谷', taxLevel: '中', specialResources: '稻·象·木棉',
        description: '永昌西南的金齿诸部，以金裹齿，勐坝稻作，诸勐各有召长。',
        notes: '傣族先民。'
      }),
      寻传: b('寻传', 24, {
        officialPosition: '寻传部酋长', terrain: '山林', taxLevel: '中', specialResources: '金·木材', tags: { mineralRegion: true },
        description: '南诏开寻传，置丽水节度，寻传蛮所居，江中淘金。',
        notes: '《蛮书》寻传蛮。'
      }),
      高黎贡山口: b('高黎贡山口', 24, {
        officialPosition: '腾越分部', terrain: '山地', taxLevel: '中', specialResources: '木材·药材',
        description: '高黎贡山与怒江之间的山口，永昌西出腾越、骠国的要道。',
        notes: '南诏腾冲府。'
      })
    },
    regionMeans: { development: 26.59, unrest: 20, taxBurden: 41, armyPressure: 28.29 }
  }]
});

// ---------------- 罗殿国 ----------------
const luodian = foreignTree({
  treeKey: 'fac_luodian', idPrefix: 'div_ss_ld_', faction: '罗殿国',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 罗殿: { households: O, economy: 'mixed' }, 普里: { households: O, economy: 'mixed' } },
  circuits: [{
    name: '罗殿',
    frame: frame('罗殿', '罗殿王', '罗殿', {
      terrain: '山地', specialResources: '马·粮·木材',
      description: '黔西乌蛮所建罗殿国（罗甸），宋时通贡受封，与自杞、大理往来贩马。',
      strategicValue: '宋西南马道所经。', threats: ['自杞']
    }),
    blocks: {
      罗殿: b('罗殿', 24, {
        divisionType: '国', officialPosition: '罗殿王', terrain: '山地', specialResources: '马·粮', tags: { horseRegion: true },
        description: '罗殿国（罗甸），黔西乌蛮政权，宋时通贡受封，以则溪分治诸部。',
        notes: '宋封罗殿国王。'
      }),
      普里: b('普里', 24, {
        officialPosition: '普里部酋长', terrain: '山地', specialResources: '马·木材',
        description: '普里部（今普安一带），北盘江上游乌蛮诸部，隶罗殿。',
        notes: '元普安路。'
      })
    },
    regionMeans: { development: 24, unrest: 20, taxBurden: 40, armyPressure: 31 }
  }]
});

// ---------------- 自杞国 ----------------
const ziqi = foreignTree({
  treeKey: 'fac_ziqi', idPrefix: 'div_ss_zq_', faction: '自杞国',
  reportNotes: ['户数：无户口可考，按原账户数分。'],
  leaves: { 自杞: { households: O, economy: 'mixed' }, 弥鹿: { households: O, economy: 'mixed' } },
  circuits: [{
    name: '自杞',
    frame: frame('自杞', '自杞国主', '自杞', {
      terrain: '山地', specialResources: '马·粮·铜鼓',
      description: '南盘江流域乌蛮所建自杞国，以贩大理马至宋邕州为业。',
      strategicValue: '大理马东运之路。', threats: ['罗殿', '大理']
    }),
    blocks: {
      自杞: b('自杞', 34, {
        divisionType: '国', officialPosition: '自杞国主', terrain: '山地', specialResources: '马·粮', tags: { horseRegion: true },
        description: '自杞国（今师宗、罗平一带），乌蛮所建，转贩大理马东至宋邕州。',
        notes: '南宋横山寨马市即多赖自杞。'
      }),
      弥鹿: b('弥鹿', 34, {
        officialPosition: '弥鹿部酋长', terrain: '丘陵', specialResources: '粮·马',
        description: '弥鹿部（今弥勒一带），南盘江西岸乌蛮部，隶自杞。',
        notes: '元弥勒州。'
      })
    },
    regionMeans: { development: 34, unrest: 20, taxBurden: 42, armyPressure: 23 }
  }]
});

module.exports = { trees: [dali, xinan, jianchang, nwyunnan, wumeng, jinchi, luodian, ziqi] };
