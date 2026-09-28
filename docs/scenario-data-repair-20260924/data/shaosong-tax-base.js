'use strict';
module.exports = {
  legacy:require('./tax-base-legacy.json').shaosong,
  scenario:'绍宋·建炎元年八月（官方）.json', mode:'song',
  saltNames:['楚州','通州','泰州','海州','涟水军','杭州','昌国县','秀州','温州','台州'],
  legacySaltExcludeCircuits:['淮南东路','淮南西路','两浙路'],
  saltPrice:18/(50*6), maritimeRate:1/10, miningRate:2/10, legacySaltRate:0.06,
  maritimeMode:'legacy-commerce',
  references:['songHuai','songHai','songZhe','songUnitPrice','songSaltSale','songSaltBenchmark','songSaltCost','songFujianTax','songFujianQuota','songGuangSalt','songSichuanQuota','songShip','songShipLimit','songMineRate','songMineRemit','songMineRemission'],
  decisions:[
    ['淮浙盐钞','接 saltProduction','只在已有史载产额的十处产区按五十斤/石、六石/袋、十八贯/袋征钞款。'],
    ['其余盐课','仅在其它明示盐产地保留旧估额','闽下四州产盐法不是按产盐斤征；川盐旧额也不自动随井源减。未拿淮浙钞价强套闽广川；排除整个淮浙盐区和无盐产的消费地，避免盐钞之外再收一层人口盐课。'],
    ['坑冶抽分','接 mineralProduction','以熙丰旧法的金银民采二分抽分作本位钱计价模型；矿值未分矿种，不能冒称铜铁官营净利。'],
    ['市舶','暂回原 commerceVolume × 0.3 × 0.05','已核原文未分离同期抽解与和买年额；原78696是港口人口模型量，无法充当全国海贸货值。按审查授权回退旧估算，不伪称史实货值税。'],
    ['渔课','不新增','尚无全国计价渔产适用的统一鱼课率，避免叠加商税。'],
    ['马政','不接钱税','马匹沿军备实物链处理。'],
    ['皇庄子粒','不新增','保留内帑田亩租源；不能将官田、营田、皇庄混并或重复征收。']
  ],
  unresolved:[
    '盐钞十八贯是南渡制度参照，原产量又取北宋旧额，非建炎元年当年实测。只接淮浙有据十处，未核盐课残项只限其它明示盐产叶子保留原人口估额；淮浙整路及无盐产消费地不再另征。未核残项单列，不伪称历史定额。',
    '盐钞为毛收款，不是净盐利。亭户本钱有绍圣淮南六十四万的跨年参照，无法得出1127年淮浙每斤工本，故不从毛收款臆扣统一工本，也不把未知成本写成0事实。',
    '坑冶20%见绍兴七年重申熙丰法，范围是江浙金银；将剧本未分矿种的计价矿产按民采抽分建模是显式近似，不是1127年全国金银铜铁统一法定税率。缺矿种拆分，须后续补数。',
    '盐钞55/45、市舶60/40、其它28/72起运留用均为原剧本开局军前截留模型，未找到可逐字证明比例的史料，本轮不另造比例或把它们称作史实。',
    '市舶海贸量全境78696来自港口人口×0.02模型，非贸易统计。暂恢复原商贸税基；现存78696不再参与市舶征税，也不当作核准海贸产值。百万级旧估额仍未完全核定；找到同域同年纯抽解与适用率后再重接。'
  ]
};
