'use strict';
// 北宋旧额给1127开局提供量级；不把后世茶盐钱当作当年的实收。斤/石沿宋史所载盐制。
module.exports = {
  key: 'shaosong', scenario: '绍宋·建炎元年八月（官方）.json',
  allocations: [
    ...[['楚州',417000],['通州',489000],['泰州',656000]].map(([name,shi]) => ({ names:[name], total:shi*50, sources:['songHuai','songUnitPrice'] })),
    ...[['海州',477000],['涟水军',115000]].map(([name,shi]) => ({ names:[name], total:shi*50, sources:['songHai','songUnitPrice'] })),
    ...[['杭州',77000],['昌国县',201000],['秀州',208000],['温州',74000],['台州',15000]].map(([name,shi]) => ({ names:[name], total:shi*50, sources:['songZhe','songUnitPrice'] })),
    { names:['福州','泉州','漳州','兴化军','长溪县'], total:(100300+48908)*50, sources:['songFujian','songUnitPrice'], rule:'福州含长溪县的旧属地；本路总额按现有产盐叶子份额估分。' },
    { names:['广州','惠州','潮州','南恩州','钦州','廉州','雷州','高州','化州','琼州','昌化军'], total:513686*50, sources:['songGuangdong','songUnitPrice'], rule:'广州总领两广西海场，不全压在广州一块；按两广现有产盐叶子份额估分。' }
  ],
  saltTax: null,
  unresolved: [
    '这些数是宋史所录旧额，部分在天圣以后下降；仅作登记额参考，非1127实测总产量。新法盐石与旧额盐石的跨期换算亦有不确定性。',
    '四川、山东及本表未列盐区暂留原人口模型值；川盐课包含钱银绢，不能把财政课利直接当作斤数。',
    '矿、马、渔、皇庄为上一轮人口/田亩公式估数，无1127逐州年产原文，保留并标为未核定。',
    '审查续：maritimeTradeVolume合计78696由港口人口×0.02形成，并非史载海贸货值。已核二百万缗包含抽解与和买，且货物抽分率随类与时期不同，无法据此反推纯抽解货值。故不改产值数字，税基补丁使市舶恢复原commerceVolume口径，明确为未核定估算。',
    '茶课单列：川茶元丰课额百万元与全宋茶课并非同一口径，不将茶课并到盐产中。'
  ], references:['songSichuan','songTea','songShip','songShipLimit']
};
