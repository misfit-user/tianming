'use strict';
module.exports = {
  legacy:require('./tax-base-legacy.json').tianqi,
  scenario:'天启七年·九月（官方）.json', mode:'ming', maritimeRate:2/100,
  // 原 DEFAULT_ALLOCATION 与剧本说明均为辽饷全额上解；新增 perTax 不能遮掉这条。
  preservedAllocation:{liaoxiang:{qiyun:1,cunliu:0}},
  // 明史同一运司的额盐与课银配对，求每斤有效课银；不是零售盐价，也不反校准实收。
  // “余”取明载整数下限。两淮用万历后段引价余银，不能再叠前段六十万。
  salt: [
    { id:'salt_iron', name:'两淮盐课', provinces:['南直隶'], names:['扬州府','淮安府'], quantity:(705000+200000)*200, receipts:1450000, central:1, sources:['mingHuai','mingUnit','mingSaltMoney','mingRemit'] },
    { id:'salt_zhe', name:'两浙盐课', names:['嘉兴府','松江府','宁波府','绍兴府','温州府','台州府'], quantity:220400*400, receipts:140000, central:1, sources:['mingZhe','mingZheMoney','mingRemit'] },
    { id:'salt_lu', name:'长芦盐课', names:['顺天府','河间府','永平府'], quantity:180800*200, receipts:120000, central:1, sources:['mingLuQuota','mingUnit','mingLuMoney','mingRemit'] },
    { id:'salt_lu_shandong', name:'山东盐课', provinces:['山东布政使司'], quantity:96100*200, receipts:50000, central:1, sources:['mingShandong','mingUnit','mingShandongMoney','mingRemit'] },
    { id:'salt_fujian', name:'福建盐课', provinces:['福建布政使司'], quantity:(104500+700-1000)*400, receipts:22000, central:1, sources:['mingFujian','mingUnit','mingFujianMoney'] },
    { id:'salt_hedong', name:'河东盐课', names:['平阳府'], quantity:(304000+10000+200000)*200, receipts:190000, central:4000/190000, sources:['mingHedong','mingHedongAdd','mingUnit','mingHedongMoney'] },
    { id:'salt_shaanxi', name:'陕西盐课', provinces:['陕西布政使司'], quantity:12537600, receipts:36000, central:0, sources:['mingShaanxi','mingShaanxiMoney'] },
    { id:'salt_guangdong', name:'广东海北盐课', names:['广州府','惠州府','潮州府','肇庆府','高州府','雷州府','廉州府','琼州府'], quantity:(30200+34600+12400)*200, receipts:11000, central:1, sources:['mingGuangdong','mingUnit','mingGuangdongMoney'] },
    { id:'salt_sichuan', name:'四川盐课', provinces:['四川布政使司'], quantity:9861000, receipts:71000, central:0, sources:['mingSichuan','mingSichuanMoney'] },
    { id:'salt_yunnan', name:'云南盐课', names:['云南府','楚雄府','大理府'], quantity:17800*400, receipts:35000, central:1, sources:['mingYunnan','mingUnit','mingYunnanMoney'] }
  ],
  references:['mingUnquantified','mingShip','mingShipRate','mingShipLocal','mingShipYear','mingMine','mingFish','mingHorse','mingEstate'],
  decisions:[
    ['盐课','接 saltProduction','按运司额盐和课银推出有效课银/斤，适用于已登记可销额盐；增减产同比增减。不是天启逐引法定价目。'],
    ['月港陆饷','接 maritimeTradeVolume，仅漳州府','计价一两征二分，留本府海防；船宽水饷和吕宋加增饷无船数，不混成按货价税。'],
    ['辽饷分账','保留原全额上解','新增盐课perTax时显式保留原100%起运，不让引擎95%下限成为新的分账比例。'],
    ['坑冶','不新增钱税','矿监九年累计不能充当天启年额；未证明现有综矿产值的可税矿种和现行税率。'],
    ['渔课','不新增钱税','河泊鱼课有制度明文，无适配本数据计价渔产的税率。'],
    ['马政','不接钱税','易马与产马不同，实物仍进军备。茶马司旧额不当产马收入。'],
    ['皇庄子粒','不接国库钱税','已有内帑按叶子田亩取租；缺天启全国实征率，不另叠一份。']
  ],
  unresolved:[
    '两淮有效课银/斤用万历额引和引价余银配对，是有据的平均财政收益率，不是同年盐商价目；天启无算浮课不造数。其它运司太仓课银未必包含全部边引收益，故这是一份可核来源的保守账。',
    '河东十九万按含太仓四千的合计解释；陕西、四川解边及河东直支归地方军需，中央以后拨边不另造第二笔收入。',
    '原盐斤主要为额盐，未有独立销售、库存、私盐份额。模型假定本年可销额盐等于产量，未售积盐并未建模。',
    '盐课价率是课银净口径，不再减明初工本米；未知天启工本另未量化。月港仅计陆饷，海贸量沿用原估值。',
    '旧 taxes 数组整体转为 taxList，田赋折银与漕粮恢复剧本已声明的参数；默认丁税、庸布、商税不再越过作者税表自动追加。其它 customTaxes 保留。'
  ]
};
