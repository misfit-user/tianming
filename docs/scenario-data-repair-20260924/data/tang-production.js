'use strict';
module.exports = {
  key:'tang', scenario:'晚唐·开成五年（官方）.json',
  resetField:'mineralProduction',
  allocations:[{field:'mineralProduction',tag:'mineralRegion',positive:'miningFiscalAssessment',weightField:'miningFiscalAssessment',total:70000/0.1,sources:['tangMine'],
    rule:'七万余缗取七万下限；沿用引擎坑冶税率0.1作计量尺，反推可税矿业产值70万贯/年（模型等值，非史载毛产值或银两产量）；按原坑冶课额份额估分。财政仍读原独立课额，不二次征收。'}],
  unresolved:[
    '唐廷saltOutput合计4910万，盐斤/斗/石在原作无可核定说明；不与saltProduction擅自换算或合并。河朔税表确实按saltOutput读税，必须保留。',
    '两池一百万贯定额出唐会要卷88太和三年；新唐书卷54的一百五十余万是李巽时期，两者不可冒作同年账。现有两池课额一百万原样保留。',
    '海盐六百余万缗为大历末参照，现有独立财政课额已另计征到、截留与上供，不搬到斤/年的saltProduction。',
    '坑冶七万余缗是财政课利，不能当作矿产毛值或铸钱额；现有miningFiscalAssessment与地方留用规则保留。',
    '矿业70万贯是由史载财政课利和既有引擎10%计量尺推出的模型量，不是开成五年实测毛产值；未考定逐州份额。',
    '全国矿业模型总计仅在原有坑冶课额的13州分配；其余州矿产记0份额，避免人口兜底再叠一份。0不是断言这些州在历史上没有任何采矿。',
    '盐、马、渔、海贸与皇庄的现有值及缺值语义保留待核；马产648匹是原作估数，不冒充国马存量。缺值仍走引擎原兜底，不声称已考定。',
    '此补丁只处理player树。外藩与河朔原税基、人物、俸给、环境承载均不改。'
  ], references:['tangPool','tangSea','tangMine','tangPrice']
};
