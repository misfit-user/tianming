// 绍宋·荆湖北路、荆湖南路、福建路。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 建置据《宋史·地理志》：江陵府「建炎二年，陞帅府」；潭州「旧领荆湖南路安抚使，大观元年陞为帅府，建炎元年复为总管安抚司」；
// 福州「旧领福建路钤辖，建炎三年陞帅府」。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const HUBEI = {
  江陵府: block({
    name: '江陵府', divisionType: '府', officialPosition: '知江陵府', terrain: '水乡',
    specialResources: '稻米·鱼·漕运', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '荆南节度，旧领荆湖北路兵马钤辖，兼提举本路及施、夔州兵马巡检事；长江中游重镇，领江陵、公安、潜江、监利等八县。',
    idx: [58, 28, 60, 60, 18, 58, 56, 36], fisc: [0.77, 0.07], keju: 1.2, corridor: 1.3,
    notes: '一路治所，建炎二年方升帅府。'
  }),
  鄂州: block({
    name: '鄂州', divisionType: '州', officialPosition: '知鄂州', terrain: '水乡',
    specialResources: '稻米·鱼·茶·漕运', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '江夏郡，武昌军节度，长江与汉水交汇之处，江夏为长江中游水运要冲，商旅辐辏。',
    idx: [58, 28, 62, 62, 18, 60, 54, 36], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '江汉之交。'
  }),
  岳州: block({
    name: '岳州', divisionType: '州', officialPosition: '知岳州', terrain: '水乡',
    specialResources: '鱼·稻米·茶', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '巴陵郡，宣和元年赐岳阳军额，洞庭湖东岸，岳阳楼在焉，范仲淹为作记。',
    idx: [58, 28, 56, 56, 18, 58, 52, 34], fisc: [0.77, 0.07],
    notes: '洞庭渔利。'
  }),
  澧州: block({
    name: '澧州', divisionType: '州', officialPosition: '知澧州', terrain: '丘陵',
    specialResources: '绫·竹簟·稻米', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '澧阳郡，澧阳、安乡、石门、慈利四县，洞庭湖西北，西接溪峒，土贡绫、竹簟。',
    idx: [58, 28, 54, 54, 18, 56, 52, 34], fisc: [0.77, 0.07],
    notes: '户八万余。'
  }),
  鼎州: block({
    name: '鼎州', divisionType: '州', officialPosition: '知鼎州', terrain: '丘陵',
    specialResources: '稻米·鱼·茶', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本朗州，大中祥符五年改名鼎州，武陵、桃源、龙阳、沅江诸县，沅水下游，桃源县即桃花源之地。',
    idx: [58, 28, 54, 54, 18, 56, 52, 34], fisc: [0.77, 0.07],
    notes: '志中标题常德府（后升）。'
  }),
  辰州: block({
    name: '辰州', divisionType: '州', officialPosition: '知辰州', terrain: '山地',
    specialResources: '朱砂·木材', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '卢溪郡，沅陵、溆浦、辰溪、卢溪诸县，溪峒蛮夷杂居；辰砂天下知名。',
    idx: [56, 28, 44, 44, 22, 50, 54, 34], fisc: [0.76, 0.07], hide: 1.3,
    notes: '溪峒之地，隐户略多。'
  }),
  沅州: block({
    name: '沅州', divisionType: '州', officialPosition: '知沅州', terrain: '山地',
    specialResources: '木材·朱砂', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '本懿州，熙宁七年收复溪峒置州，卢阳、麻阳、黔阳诸县与诸砦，蛮汉杂处。',
    idx: [54, 28, 40, 40, 24, 48, 56, 34], fisc: [0.75, 0.08], hide: 1.4,
    notes: '熙宁开边所置，砦堡多。'
  }),
  靖州: block({
    name: '靖州', divisionType: '州', officialPosition: '知靖州', terrain: '山地',
    specialResources: '木材', taxLevel: '轻',
    tags: {},
    description: '熙宁九年收复唐溪洞诚州，元丰四年建州，后改靖州，领永平、会同二县，溪峒之地。',
    idx: [52, 28, 36, 36, 26, 46, 58, 34], fisc: [0.74, 0.08], hide: 1.5,
    notes: '溪峒新附。'
  }),
  峡州: block({
    name: '峡州', divisionType: '州', officialPosition: '知峡州', terrain: '山地',
    specialResources: '茶·木材', taxLevel: '轻',
    tags: { fishingRegion: true },
    description: '夷陵郡，长江出三峡之口，夷陵、宜都、长杨、远安四县。',
    idx: [58, 28, 50, 50, 18, 54, 50, 34], fisc: [0.77, 0.07],
    notes: '三峡东口。'
  }),
  归州: block({
    name: '归州', divisionType: '州', officialPosition: '知归州', terrain: '山地',
    specialResources: '茶·柑橘', taxLevel: '轻',
    tags: {},
    description: '巴东郡，秭归、巴东、兴山三县，地在三峡之中，屈原、王昭君故里。',
    idx: [58, 26, 46, 46, 18, 52, 48, 32], fisc: [0.77, 0.07],
    notes: '三峡之中，山田瘠薄。'
  }),
  复州: block({
    name: '复州', divisionType: '州', officialPosition: '知复州', terrain: '水乡',
    specialResources: '鱼·稻米', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '景陵郡，景陵、玉沙二县，汉水下游湖泽之地。',
    idx: [58, 28, 50, 50, 18, 54, 50, 34], fisc: [0.77, 0.07],
    notes: '志无户数，土贡阙；按所领县等估户。'
  }),
  德安府: block({
    name: '德安府', divisionType: '府', officialPosition: '知德安府', terrain: '丘陵',
    specialResources: '稻米·绢', taxLevel: '中',
    tags: {},
    description: '本安州，安远军节度，宣和元年升德安府，领安陆、应城、孝感、应山、云梦五县。',
    idx: [58, 28, 54, 54, 18, 56, 52, 34], fisc: [0.77, 0.07],
    notes: '五县皆中县。'
  }),
  荆门军: block({
    name: '荆门军', divisionType: '军', officialPosition: '知荆门军', terrain: '丘陵',
    specialResources: '粮·茶', taxLevel: '中',
    tags: {},
    description: '开宝五年以江陵府长林、当阳二县建军，熙宁六年废，元祐三年复置；当阳有玉泉山。',
    idx: [58, 28, 52, 52, 18, 54, 52, 34], fisc: [0.77, 0.07],
    notes: '志无户数，按所领二县县等估户。'
  }),
  汉阳军: block({
    name: '汉阳军', divisionType: '军', officialPosition: '知汉阳军', terrain: '水乡',
    specialResources: '鱼·稻米', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '汉阳、汉川二县，汉水入江之口，与鄂州隔江相望；熙宁四年废为县，元祐元年复置。',
    idx: [58, 28, 54, 54, 18, 56, 52, 34], fisc: [0.77, 0.07],
    notes: '志无户数，按所领二县县等估户。'
  })
};

const HUNAN = {
  潭州: block({
    name: '潭州', divisionType: '州', officialPosition: '知潭州', terrain: '丘陵',
    specialResources: '稻米·茶·纸', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '长沙郡，武安军节度，旧领荆湖南路安抚使，建炎元年复为总管安抚司。湘江下游，领长沙、衡山等十二县，南岳衡山在衡山县，岳麓书院在城西。',
    idx: [58, 28, 64, 64, 14, 72, 58, 36], fisc: [0.77, 0.07], keju: 1.3, corridor: 1.3,
    notes: '一路帅府。'
  }),
  衡州: block({
    name: '衡州', divisionType: '州', officialPosition: '知衡州', terrain: '丘陵',
    specialResources: '稻米·麸金·茶', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '衡阳郡，湘江中游与蒸水、耒水交汇，领衡阳、耒阳、常宁、安仁诸县，土贡麸金、犀。',
    idx: [58, 28, 60, 60, 14, 70, 54, 34], fisc: [0.77, 0.07],
    notes: '户十六万余；茶陵县已另成地块。'
  }),
  邵州: block({
    name: '邵州', divisionType: '州', officialPosition: '知邵州', terrain: '丘陵',
    specialResources: '稻米·木材', taxLevel: '中',
    tags: {},
    description: '邵阳郡，资水上游，邵阳、新化二县；熙宁五年开梅山，置新化县。',
    idx: [58, 28, 56, 56, 16, 68, 54, 34], fisc: [0.77, 0.07], hide: 1.2,
    notes: '志中标题宝庆府（宝庆元年升）。武冈县已另成武冈军地块。'
  }),
  永州: block({
    name: '永州', divisionType: '州', officialPosition: '知永州', terrain: '丘陵',
    specialResources: '葛·石燕·稻米', taxLevel: '中',
    tags: {},
    description: '零陵郡，潇、湘二水汇流，零陵、祁阳、东安三县；柳宗元贬居于此，作永州诸记。',
    idx: [58, 28, 56, 56, 14, 68, 52, 34], fisc: [0.77, 0.07],
    notes: '潇湘之会。'
  }),
  道州: block({
    name: '道州', divisionType: '州', officialPosition: '知道州', terrain: '丘陵',
    specialResources: '稻米·茶', taxLevel: '中',
    tags: {},
    description: '江华郡，营道、江华、宁远、永明四县，九嶷山在宁远；周敦颐故里。',
    idx: [58, 28, 54, 54, 14, 66, 52, 34], fisc: [0.77, 0.07], keju: 1.2,
    notes: '四县皆紧县以上。'
  }),
  郴州: block({
    name: '郴州', divisionType: '州', officialPosition: '知郴州', terrain: '山地',
    specialResources: '银·铜·纻布', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '桂阳郡，郴、桂阳、宜章、永兴诸县，南岭北麓，有银铜坑冶，南通广东韶州。',
    idx: [58, 28, 52, 52, 16, 66, 54, 34], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '湘粤驿路。'
  }),
  全州: block({
    name: '全州', divisionType: '州', officialPosition: '知全州', terrain: '丘陵',
    specialResources: '葛·零陵香', taxLevel: '中',
    tags: {},
    description: '清湘、灌阳二县，湘江上游，西南通广西桂州，土贡葛、零陵香。',
    idx: [58, 28, 50, 50, 16, 64, 54, 34], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '湘桂驿路。'
  }),
  桂阳监: block({
    name: '桂阳监', divisionType: '监', officialPosition: '知桂阳监', terrain: '山地',
    specialResources: '银·铜', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '平阳、蓝山、临武诸县，以银冶置监，土贡银，为东南银坑大宗。',
    idx: [58, 28, 52, 52, 16, 66, 52, 34], fisc: [0.77, 0.07], kuangchang: 1,
    notes: '监以银冶设，记官营矿场一处。志中标题桂阳军（绍兴三年升）。'
  }),
  武冈军: block({
    name: '武冈军', divisionType: '军', officialPosition: '知武冈军', terrain: '山地',
    specialResources: '木材·粮', taxLevel: '轻',
    tags: {},
    description: '崇宁五年以邵州武冈县升军，领武冈、绥宁、临冈三县，西接溪峒。',
    idx: [56, 28, 46, 46, 18, 60, 56, 34], fisc: [0.76, 0.07], hide: 1.3,
    notes: '户数从邵州按九域志乡数切出。'
  }),
  茶陵县: block({
    name: '茶陵县', divisionType: '县', officialPosition: '知茶陵县', terrain: '丘陵',
    specialResources: '茶·稻米', taxLevel: '中',
    tags: {},
    description: '衡州属县，洣水所经，东接江西；绍兴九年方升茶陵军。',
    idx: [58, 28, 52, 52, 14, 64, 52, 32], fisc: [0.77, 0.07],
    notes: '九域志：七乡。'
  })
};

const FUJIAN = {
  福州: block({
    name: '福州', divisionType: '州', officialPosition: '知福州', terrain: '沿海',
    specialResources: '荔枝·紫菜·海盐·纸', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '长乐郡，威武军节度，旧领福建路钤辖；闽江下游，领闽、侯官等十一县，土贡荔枝、紫菜。',
    idx: [58, 28, 74, 74, 14, 72, 36, 36], fisc: [0.77, 0.07], keju: 1.5,
    notes: '一路治所，建炎三年方升帅府；长溪县已另成地块。'
  }),
  建州: block({
    name: '建州', divisionType: '州', officialPosition: '知建州', terrain: '山地',
    specialResources: '龙凤团茶·建盏·纸', taxLevel: '中',
    tags: {},
    description: '建安郡，建宁军节度，北苑贡茶天下第一，土贡龙茶、石乳；建窑黑釉盏为斗茶所重。',
    idx: [58, 28, 74, 74, 14, 72, 32, 34], fisc: [0.77, 0.07], keju: 1.5,
    notes: '志中标题建宁府（绍兴三十二年升）。北苑为官焙贡茶，不入官营三项。'
  }),
  南剑州: block({
    name: '南剑州', divisionType: '州', officialPosition: '知南剑州', terrain: '山地',
    specialResources: '茶·木材·纸', taxLevel: '中',
    tags: {},
    description: '剑浦郡，剑浦、将乐、顺昌、沙、尤溪五县，闽江上游，山多田少。',
    idx: [58, 28, 66, 66, 16, 70, 34, 34], fisc: [0.77, 0.07],
    notes: '闽江上游山区。'
  }),
  泉州: block({
    name: '泉州', divisionType: '州', officialPosition: '知泉州', terrain: '沿海',
    specialResources: '海贸·香药·瓷·海盐', taxLevel: '中',
    tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '清源郡，平海军节度，元祐二年置市舶司，番舶云集，为东南大港；领晋江、南安等七县。',
    idx: [60, 30, 78, 78, 12, 72, 34, 38], fisc: [0.77, 0.07], keju: 1.3,
    notes: '市舶司所在。'
  }),
  漳州: block({
    name: '漳州', divisionType: '州', officialPosition: '知漳州', terrain: '沿海',
    specialResources: '海盐·甲香·鲛鱼皮', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '漳浦郡，龙溪、漳浦、龙岩、长泰四县，濒海多山，土贡甲香、鲛鱼皮。',
    idx: [56, 28, 66, 66, 18, 70, 36, 34], fisc: [0.77, 0.07], hide: 1.2,
    notes: '山海之交，盐寇时有。'
  }),
  汀州: block({
    name: '汀州', divisionType: '州', officialPosition: '知汀州', terrain: '山地',
    specialResources: '蜡烛·木材·纸', taxLevel: '轻',
    tags: {},
    description: '临汀郡，长汀、宁化、上杭、武平、清流五县，山深林密，西与虔州相接，私盐贩出没。',
    idx: [54, 28, 58, 58, 20, 66, 38, 34], fisc: [0.76, 0.08], hide: 1.3,
    notes: '汀虔之间盐寇，不稳略高。'
  }),
  邵武军: block({
    name: '邵武军', divisionType: '军', officialPosition: '知邵武军', terrain: '山地',
    specialResources: '纸·茶·木材', taxLevel: '中',
    tags: {},
    description: '太平兴国五年以建州邵武县建军，领邵武、光泽、泰宁、建宁四县，闽北山区。',
    idx: [58, 28, 66, 66, 14, 70, 32, 34], fisc: [0.77, 0.07],
    notes: '四县皆望县。'
  }),
  兴化军: block({
    name: '兴化军', divisionType: '军', officialPosition: '知兴化军', terrain: '沿海',
    specialResources: '荔枝·海盐·绵·葛布', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '太平兴国四年以泉州游洋、百丈二镇地置军，领莆田、仙游、兴化三县；莆田科第之盛甲于闽中。',
    idx: [60, 28, 70, 70, 12, 70, 34, 34], fisc: [0.77, 0.07], keju: 1.6,
    notes: '科第之乡。'
  }),
  长溪县: block({
    name: '长溪县', divisionType: '县', officialPosition: '知长溪县', terrain: '沿海',
    specialResources: '海盐·鱼', taxLevel: '轻',
    tags: { saltRegion: true, fishingRegion: true },
    description: '福州东北属县，濒海多山，民以渔盐为业。',
    idx: [58, 28, 62, 62, 14, 66, 34, 32], fisc: [0.77, 0.07],
    notes: '九域志：四乡。'
  })
};

module.exports = [
  circuitModule('荆湖北路', { BLOCKS: HUBEI, regionMeans: { development: 56, unrest: 19, taxBurden: 58, armyPressure: 52 } }),
  circuitModule('荆湖南路', { BLOCKS: HUNAN, regionMeans: { development: 60, unrest: 14, taxBurden: 70, armyPressure: 54 } }),
  circuitModule('福建路', { BLOCKS: FUJIAN, regionMeans: { development: 72, unrest: 14, taxBurden: 72, armyPressure: 34 } })
];
