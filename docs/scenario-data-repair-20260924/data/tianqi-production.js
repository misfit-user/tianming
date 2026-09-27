'use strict';
// 额盐斤数是史载登记生产/销售额度的保守下界，非含私盐的全国总产量；「余」均取整下限。
module.exports = {
  key: 'tianqi', scenario: '天启七年·九月（官方）.json',
  allocations: [
    { names: ['扬州府','淮安府'], weights: [2,1], total: (705000 + 200000) * 200, sources: ['mingHuai','mingUnit'], rule: '常额加边引；泰州、通州在扬州府，淮安一分司，按分司数2:1估分。' },
    { names: ['嘉兴府','松江府','宁波府','绍兴府','温州府','台州府'], weights: [2,2,1,1,1,1], total: 220400 * 2 * 200, sources: ['mingZhe','mingUnit'], rule: '四分司嘉兴、松江、宁绍、温台各一份，跨府分司均分；是分布估计。' },
    { names: ['顺天府','河间府','永平府'], total: 180800 * 200, sources: ['mingLu','mingUnit'] },
    { province: '山东布政使司', total: 96100 * 200, sources: ['mingShandong','mingUnit'] },
    { province: '福建布政使司', total: (104500 + 700 - 1000) * 400, sources: ['mingFujian','mingUnit'] },
    { names: ['平阳府'], total: (304000 + 10000 + 200000) * 200, sources: ['mingHedong','mingHedongAdd','mingUnit'], rule: '按本卷万历叙数相加；卷中另见嘉靖六十二万引，年代/额别有异，不相加。' },
    { province: '陕西布政使司', total: 12537600, sources: ['mingShaanxi'] },
    { names: ['广州府','惠州府','潮州府','肇庆府'], total: (30200 + 34600) * 200, sources: ['mingGuangdong','mingUnit'] },
    { names: ['高州府','雷州府','廉州府','琼州府'], total: 12400 * 200, sources: ['mingGuangdong','mingUnit'] },
    { province: '四川布政使司', total: 9861000, sources: ['mingSichuan'] },
    { names: ['云南府','楚雄府','大理府'], weights: [1,1,1], total: 17800 * 400, sources: ['mingYunnan','mingUnit'], rule: '五井总额按三处有盐井的府等分，仅为分布估计；缺各井万历分额。' }
  ],
  saltTax: null,
  unresolved: [
    '矿产1120万两、渔产496万两、海贸1487.6万两：原作估值无逐年产量原文；保留且不新增税目。万历矿税九年累计不能拿来定1627年产值。',
    '陕西马12000与六茶司9600+天启增2400同数，但易入军马不是繁殖产马。原马字段保留，不把易马额另加一次。其他地区马额尚无对应原文。',
    '皇庄田1395万亩包含省级5%模板及可能的王庄，不能以弘治畿内皇庄128万亩替换天启全国皇产。保留旧数，停止引擎强改。',
    '盐额按万历旧额作天启开局基准；不是已证1627实收。盐税当前仍按人口，税目重接须单独判断课额、引价、起运与存留。'
  ], references: ['mingHorse','mingMine','mingFish','mingEstate','mingShip','mingSaltMoney']
};
