// 晚唐承载力的推算口径。所有地区数从现有府州田亩、农政种子和口数计算，不抄 environmentConfig 的未核数字。
// 史料提供量纲与参照范围，不能把一个屯田考课额说成开成五年每州的实测亩产。推估统一标 L。
'use strict';

const TREE_KEYS = ['player', '唐·魏博镇', '唐·成德镇', '唐·卢龙镇', '唐·昭义镇'];
const SOURCES = [
  { id: 'tuntian', source: '李筌《太白陰經》卷五·屯田篇', file: '太白陰經_卷五.wiki', url: 'https://zh.wikisource.org/wiki/太白陰經/卷五',
    text: '合屯田六十頃：四十頃種子，五頃大荳種子，五頃麥種子，五頃麻種子，五頃蕎種子。', confidence: 'H',
    use: '屯田规模及作物并非全为同一种粮；不能把田亩直接当可养口数。' },
  { id: 'yield', source: '李筌《太白陰經》卷五·屯田篇', file: '太白陰經_卷五.wiki', url: 'https://zh.wikisource.org/wiki/太白陰經/卷五',
    text: '等級，殊等九千石，第一等七千石，第二等六千石，第三等五千石。歲無水旱、災蝗，滿四千石者，屯官有殿。', confidence: 'H',
    use: '按一顷百亩，六十顷的考课额折合约 0.67–1.5 石/亩；这是屯田考课，不是全国通行的毛产量，更未扣籽种、饲料和损耗。只用作量级参照。' },
  { id: 'ration', source: '李筌《太白陰經》卷五·人糧馬料篇', file: '太白陰經_卷五.wiki', url: 'https://zh.wikisource.org/wiki/太白陰經/卷五',
    text: '經曰：一軍一萬二千五百人，人日支米二升，一月六斗，一年七石二斗。', confidence: 'H',
    use: '成年军人的年米口粮 7.2 石是可核参照；不得直接给老幼各算一份军人粮。' },
  { id: 'millet', source: '李筌《太白陰經》卷五·人糧馬料篇', file: '太白陰經_卷五.wiki', url: 'https://zh.wikisource.org/wiki/太白陰經/卷五',
    text: '以六分支粟，一人日支粟三升三合三勺三抄三圭三粒，一月一石，一年一十二石。', confidence: 'H',
    use: '同一军人按粟为年 12 石，不能把粟的亩产与米的口粮直接相除；该篇军级合计有算术疑文，仅引用自洽的逐人项。' },
  { id: 'conversion', source: '《通典》卷六·食貨六', file: '通典_卷006.wiki', url: 'https://zh.wikisource.org/wiki/通典/卷006',
    text: '應貯米處，折粟一斛，輸米六斗。', confidence: 'H',
    use: '再次核实粟米折算。这里不擅自把原剧本同一农政模块里的粮食数再乘 0.6，以免重复换算。' },
  { id: 'soil', source: '《新唐書》卷五十一·食貨一', file: '新唐書_卷051.wiki', url: 'https://zh.wikisource.org/wiki/新唐書/卷051',
    text: '其地有薄厚，歲一易者，倍授之。', confidence: 'H',
    use: '田有肥瘠与休耕；沿用第二刀已按州重分、保留原垦田差异的 farmland，不再凭地形另造亩产折扣。' }
];

const METHOD = [
  '府州 arable = round(economyBase.farmland × renliSeed.annualYieldPerMu × renliSeed.doubleCropping ÷ renliSeed.annualFoodNeedPerMouth)。这几个输入都是剧本已有的同一农政粮食口径，不改它们；是常年粮食潜在可养口数，不是亩数。',
  '此刀不把未经核实的 environmentConfig.initialCarrying.arableArea、soilFertility 等当史料，也不以当前人口乘固定宽裕倍数反推承载。',
  '现有亩产、口粮种子本身未逐州史证：唐地亩产 1.05–1.85、年口粮 4.8–5.5；其南北差和全口平均粮只能作原剧本模型估计。太白阴经屯额与军人粮不是对这些数的直接证明。结果可信度 L，不标 H/M。',
  'terrain 逐州列出；既有 farmland 已含各州垦田差异，本刀不再叠加无来源的山地/丘陵系数。没有把军屯考课一档直接推为全境亩产。',
  'water = arable：沿用绍宋框架在缺独立水文测量时不区分两项的办法，表示本模型没有另设水源瓶颈，绝非河川流量或灌溉亩数的史实测定（L）。',
  'climate = 1：常年基准，沿绍宋中性值，不虚构 840 年逐州气候数。historicalCap = min(arable, water) × climate，此处等于 arable；它是供户籍分母使用的基准承载，不是历史人口峰值。',
  'currentLoad = mouths ÷ historicalCap，保留八位小数，不做天启分摊时的 0.5 下限钳位；本次所有唐地都在户口引擎的 1.5 上限以内。档位按未舍入比值：<0.55 abundant，<0.75 sustainable，<0.97 strained，否则 overload。',
  '道的 arable、water、historicalCap 严格为府州整数之和；道的 currentLoad 从合计人口/合计承载重算，不平均府州的比率。',
  '不把税收、私租或漕运再次从能力扣除，不加入人口倍增、商业进口与非粮食来源的假定；此数也不是已收割的现实粮产或实际饥荒预测。'
];

module.exports = { TREE_KEYS, SOURCES, METHOD };
