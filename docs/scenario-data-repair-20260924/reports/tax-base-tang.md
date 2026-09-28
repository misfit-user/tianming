# 晚唐·开成五年（官方）.json · 税基重接

税表与史料部分由标准真源补丁生成；开局实测附于文末。逐税目实收、名义额和响应见 tax-base-comparison.md 与 tax-base-*-{before,after}.json。

## 判定

| 税目 | 接法 | 理由 |
| --- | --- | --- |
| 两池盐利 | 保留 poolSaltFiscalAssessment 定额 | 太和三年敕定实钱百万贯；无自动按产量减免条文，不自行加入减产折额。 |
| 东南海盐、川峡井盐、留镇盐利 | 保留三本财政课额 | 盐利是财政收益，盐价是售价，未得同时同域工本和斤斗换算，不能用课利/售价伪造盐斤。 |
| 坑冶 | 保留 miningFiscalAssessment | 七万余缗是地方课利；P1-B2用10%反推70万只是旧引擎计量尺，未有唐代10%抽分原文，不接成新法定率。 |
| 蕃舶 | 保留 maritimeFiscalAssessment | 现有舶脚与货课混合额缺840年抽分价率，不套宋代十分之一。 |
| 茶课 | 保留既有茶销售额×10% | 本来已读 teaTaxableSales；本轮不改。 |
| 渔课 | 不新增 | 缺当年适用鱼课率。 |
| 马政 | 不接钱税 | 实物马进军备，saltOutput等独立旧字段不并入产量。 |
| 皇庄子粒 | 不新增 | 显式内帑账制已关旧皇庄估算，不叠加默认亩租。 |

## 改前税表

| ID | 税名 | 税基 | 基数系数 | 单位价 | 抽分率/旧率 | 口径 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| land_silver | 夏秋两税钱 | taxableHouseholds | 1 | — | 6.44868459 | 原税表 |
| salt_iron | 东南海盐课利 | seaSaltFiscalAssessment | 1 | — | 1 | 原税表 |
| salt_hedong | 河东两池盐利 | poolSaltFiscalAssessment | 1 | — | 1 | 原税表 |
| salt_sichuan | 川峡井盐课利 | wellSaltFiscalAssessment | 1 | — | 1 | 原税表 |
| salt_retained | 淄青兖郓留镇盐利 | retainedSaltFiscalAssessment | 1 | — | 1 | 原税表 |
| tea | 茶课 | teaTaxableSales | 1 | — | 0.1 | 原税表 |
| wine | 榷酒与榷曲课 | wineFiscalAssessment | 1 | — | 1 | 原税表 |
| commerce | 津堰商货课利 | ordinaryTradeFiscalAssessment | 1 | — | 1 | 原税表 |
| maritime | 蕃舶舶脚与货课 | maritimeFiscalAssessment | 1 | — | 1 | 原税表 |
| mining | 坑冶课利 | miningFiscalAssessment | 1 | — | 1 | 原税表 |
| land_grain | 两税米粟 | arableLand | 1 | — | 0.23015086 | 原税表 |
| land_cloth | 两税折纳绢布 | taxableHouseholds | 1 | — | 2.61678539 | 原税表 |

## 改后税表

| ID | 税名 | 税基 | 基数系数 | 单位价 | 抽分率/旧率 | 口径 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| land_silver | 夏秋两税钱 | taxableHouseholds | 1 | — | 6.44868459 | 原税表 |
| salt_iron | 东南海盐课利 | seaSaltFiscalAssessment | 1 | — | 1 | retained-assessment |
| salt_hedong | 河东两池盐利 | poolSaltFiscalAssessment | 1 | — | 1 | retained-assessment |
| salt_sichuan | 川峡井盐课利 | wellSaltFiscalAssessment | 1 | — | 1 | retained-assessment |
| salt_retained | 淄青兖郓留镇盐利 | retainedSaltFiscalAssessment | 1 | — | 1 | retained-assessment |
| tea | 茶课 | teaTaxableSales | 1 | — | 0.1 | 原税表 |
| wine | 榷酒与榷曲课 | wineFiscalAssessment | 1 | — | 1 | retained-assessment |
| commerce | 津堰商货课利 | ordinaryTradeFiscalAssessment | 1 | — | 1 | retained-assessment |
| maritime | 蕃舶舶脚与货课 | maritimeFiscalAssessment | 1 | — | 1 | retained-assessment |
| mining | 坑冶课利 | miningFiscalAssessment | 1 | — | 1 | retained-assessment |
| land_grain | 两税米粟 | arableLand | 1 | — | 0.23015086 | 原税表 |
| land_cloth | 两税折纳绢布 | taxableHouseholds | 1 | — | 2.61678539 | 原税表 |

## 原文与推导边界

- tangPool · [唐會要_卷088.wiki](../sources/p1b2/raw/唐會要_卷088.wiki)：「三年四月敕。安邑解縣兩池榷課。以實錢一百萬貫為定額。」
- tangSea · [新唐書_卷054.wiki](../sources/p1b2/raw/新唐書_卷054.wiki)：「鹽利歲纔四十萬緡，至大曆末，六百餘萬緡。」
- tangMine · [新唐書_卷054.wiki](../sources/p1b2/raw/新唐書_卷054.wiki)：「開成元年，復以山澤之利歸州縣，刺史選吏主之。其後諸州牟利以自殖，舉天下不過七萬餘緡」
- tangPrice · [新唐書_卷054.wiki](../sources/p1b2/raw/新唐書_卷054.wiki)：「順宗時始減江淮鹽價，每斗為錢二百五十，河中兩池鹽，斗錢三百。」
- tangSaleNotProfit · [新唐書_卷054.wiki](../sources/p1b2/raw/新唐書_卷054.wiki)：「盡榷天下鹽，斗加時價百錢而出之，為錢一百一十。」
- tangWell · [新唐書_卷054.wiki](../sources/p1b2/raw/新唐書_卷054.wiki)：「皆隨月督課。」

## 开局存量与收支时点

度支掌上供与支给，地方留州留使另有用途。开局钱280万贯、粮220万石、绢布62万匹为原剧本中央可支存量模型，未在已核《资治通鉴》卷246开成五年及既有唐财政原文中找到同日盘库数；盐铁岁课、漕运年额均不冒作府库存量。

宫中岁给由外库交割，内库与藩邸家资分册。开局钱65万贯、粮9万石、绢布8.5万匹为原剧本未核定模型值；未找到开成五年正月同日内库盘点总簿。

新开局保留 initialMoney/initialGrain/initialCloth；只写收支预估，第一次过回合在回合号递增前收税和扣支。实际开局/12回合走势见 tax-base-opening-*-after.json 与 tax-base-comparison.md。

- [treasury/raw/資治通鑑_卷246.wiki](../sources/treasury/raw/資治通鑑_卷246.wiki)：「文宗元聖昭獻孝皇帝下開成五年」 核查开成五年及同卷前后，未找到280万贯、220万石的中央库存清册；既有唐财政资料为岁课、支给，不能冒作存量。

## 未核定

- saltProduction登记仅1660斤，运行时缺项还会补人口产量；它们没有足以取代课额的统计基础。
- 盐价江淮250文/斗、两池300文/斗是顺宗时售价；直接除岁课既混毛收与课利，也缺斤斗换算。故本轮选择保留定额/既有课利账，不虚构反推产销。
- 除两池外，保留课利账不等于断言历史上按死额包征。它是缺乏毛产量和同时价率时的保守模型；产量±20%仍0响应，未来必须补证后再接。
- 坑冶现有实收7.5万贯与七万余缗下限相差0.5万（7.14%）；其模型名义课额约15.3244万，须扣既有征收损耗，不能把实收7.5万写成名义额。起运留用与工本沿现有独立财政账，不新调系数。
