# 天启七年·九月（官方）.json · 税基重接

税表与史料部分由标准真源补丁生成；开局实测附于文末。逐税目实收、名义额和响应见 tax-base-comparison.md 与 tax-base-*-{before,after}.json。

## 判定

| 税目 | 接法 | 理由 |
| --- | --- | --- |
| 盐课 | 接 saltProduction | 按运司额盐和课银推出有效课银/斤，适用于已登记可销额盐；增减产同比增减。不是天启逐引法定价目。 |
| 月港陆饷 | 接 maritimeTradeVolume，仅漳州府 | 计价一两征二分，留本府海防；船宽水饷和吕宋加增饷无船数，不混成按货价税。 |
| 辽饷分账 | 保留原全额上解 | 新增盐课perTax时显式保留原100%起运，不让引擎95%下限成为新的分账比例。 |
| 坑冶 | 不新增钱税 | 矿监九年累计不能充当天启年额；未证明现有综矿产值的可税矿种和现行税率。 |
| 渔课 | 不新增钱税 | 河泊鱼课有制度明文，无适配本数据计价渔产的税率。 |
| 马政 | 不接钱税 | 易马与产马不同，实物仍进军备。茶马司旧额不当产马收入。 |
| 皇庄子粒 | 不接国库钱税 | 已有内帑按叶子田亩取租；缺天启全国实征率，不另叠一份。 |

## 改前税表

| ID | 税名 | 税基 | 基数系数 | 单位价 | 抽分率/旧率 | 口径 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| land_silver | 田赋折银（条编） | arableLand | 1 | — | 0.014 | 原税表 |
| caoliang | 漕粮（本色） | arableLand | 0.3 | — | 0.024 | 原税表 |
| salt_iron | 盐课 | mouths | 0.04 | — | 1 | 原税表 |

## 改后税表

| ID | 税名 | 税基 | 基数系数 | 单位价 | 抽分率/旧率 | 口径 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| land_silver | 田赋折银（条编） | arableLand | 1 | — | 0.014 | 原税表 |
| caoliang | 漕粮（本色） | arableLand | 0.3 | — | 0.024 | 原税表 |
| salt_iron | 两淮盐课 | saltProduction | 1 | 0.008011049723756906 | 1 | 按量 |
| salt_zhe | 两浙盐课 | saltProduction | 1 | 0.001588021778584392 | 1 | 按量 |
| salt_lu | 长芦盐课 | saltProduction | 1 | 0.00331858407079646 | 1 | 按量 |
| salt_lu_shandong | 山东盐课 | saltProduction | 1 | 0.0026014568158168575 | 1 | 按量 |
| salt_fujian | 福建盐课 | saltProduction | 1 | 0.000527831094049904 | 1 | 按量 |
| salt_hedong | 河东盐课 | saltProduction | 1 | 0.001848249027237354 | 1 | 按量 |
| salt_shaanxi | 陕西盐课 | saltProduction | 1 | 0.002871362940275651 | 1 | 按量 |
| salt_guangdong | 广东海北盐课 | saltProduction | 1 | 0.0007124352331606218 | 1 | 按量 |
| salt_sichuan | 四川盐课 | saltProduction | 1 | 0.007200081127674678 | 1 | 按量 |
| salt_yunnan | 云南盐课 | saltProduction | 1 | 0.0049157303370786515 | 1 | 按量 |
| guanshui | 月港陆饷 | maritimeTradeVolume | 1 | 1 | 0.02 | 按量 |

## 原文与推导边界

- mingUnquantified · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「天啟時，言利者恣蒐括，務增引超掣。魏忠賢黨郭興治、崔呈秀等，巧立名目以取之，所入無算。」
- mingShip · [東西洋考_卷七.wiki](../sources/p1b2/raw/東西洋考_卷七.wiki)：「其徵稅之規有水餉，有陸餉，有加增餉。水餉者，以船廣狹為準，其餉出於船商。陸餉者，以貨多寡計值徵輸，其餉出於鋪商。」
- mingShipRate · [東西洋考_卷七.wiki](../sources/p1b2/raw/東西洋考_卷七.wiki)：「陸餉胡椒、蘇木等貨計值一兩者，徵餉二分。」
- mingShipLocal · [東西洋考_卷七.wiki](../sources/p1b2/raw/東西洋考_卷七.wiki)：「而水陸官兵月糧、修船、直器、犒賞諸費，歲不下六萬。」
- mingShipYear · [東西洋考_卷七.wiki](../sources/p1b2/raw/東西洋考_卷七.wiki)：「二十二年，餉驟溢至二萬九千有奇。」
- mingMine · [明史_卷81.wiki](../sources/p1b2/raw/明史_卷81.wiki)：「自二十五年至三十三年，諸璫所進礦稅銀幾及三百萬兩」
- mingFish · [明史_卷81.wiki](../sources/p1b2/raw/明史_卷81.wiki)：「凡稅課，徵商估物貨；抽分，科竹木柴薪；河泊，取魚課。」
- mingHorse · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「西寧、河、洮、岷、甘、莊浪六茶司共易馬九千六百匹，著為令。天啟時，增中馬二千四百匹。」
- mingEstate · [明史_卷77.wiki](../sources/p1b2/raw/明史_卷77.wiki)：「畿內皇莊有五，共地萬二千八百餘頃；勳戚、中官莊田三百三十有二，共地三萬三千餘頃。」
- mingHuai · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「淮額歲課七十萬五千餘引，又增各邊新引歲二十萬。」
- mingUnit · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「凡大引四百斤，小引二百斤。」
- mingSaltMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「時兩淮引價餘銀百二十餘萬增至百四十五萬」
- mingRemit · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「商人困守支，戶部尚書葉淇請召商納銀運司，類解太倉，分給各邊。」
- mingZhe · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「洪武時，歲辦大引鹽二十二萬四百餘引。弘治時，改辦小引鹽，倍之。萬歷時同。」
- mingZheMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉餘鹽銀十四萬兩。」
- mingLuQuota · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「弘治時，改辦小引鹽十八萬八百餘引。萬歷時同。」
- mingLuMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉餘鹽銀十二萬兩。」
- mingShandong · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「萬歷時，九萬六千一百餘引。」
- mingShandongMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉餘鹽銀五萬兩。」
- mingFujian · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「洪武時，歲辦大引鹽十萬四千五百餘引。弘治時，增七百餘引。萬歷時，減千引。」
- mingFujianMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉銀二萬二千餘兩。」
- mingHedong · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「洪武時，歲辦小引鹽三十萬四千引。」
- mingHedongAdd · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「增入萬引。萬曆中，又增二十萬引。」
- mingHedongMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉銀四千餘兩，給宣府鎮及大同代府祿糧，抵補山西民糧銀，共十九萬兩有奇。」
- mingShaanxi · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「萬歷時，三處共辦千二百五十三萬七千六百餘斤。」
- mingShaanxiMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲解寧夏、延綏、固原餉銀三萬六千餘兩。」
- mingGuangdong · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「萬歷時，廣東小引生鹽三萬二百餘引，小引熟鹽三萬四千六百餘引；海北小引正耗鹽一萬二千四百餘引。」
- mingGuangdongMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉鹽課銀萬一千餘兩。」
- mingSichuan · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「萬曆中，九百八十六萬一千餘斤。」
- mingSichuanMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲解陝西鎮鹽課銀七萬一千餘兩。」
- mingYunnan · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「洪武時，歲辦大引鹽萬七千八百餘引。弘治時，各井多寡不一。萬歷時與洪武同。」
- mingYunnanMoney · [明史_卷80.wiki](../sources/p1b2/raw/明史_卷80.wiki)：「歲入太倉鹽課銀三萬五千餘兩。」

## 开局存量与收支时点

开局银85万两、粮1300万石、布50万匹沿用原剧本模型值，尚未核得天启七年八九月太仓银库及京通诸仓同日实存总簿。原称《明史·食货志》载80—120万两、1100—1500万石的范围未有逐字原文支持，撤销该引述。《崇祯长编》卷一八月壬戌发太仓银30万两属拨款；卷二九月戊寅太仆寺常盈等三库存18321两属另库，均不代替太仓库存。

开局银250万两、粮12万石、布28万匹沿用未核定模型值，未找到天启七年八九月内承运库同日实存总簿。撤销原250万两及万历末500—600万两的无据断言。《崇祯长编》卷二允内帑拨陵工银50万两，是支出批款，不能据此断定全库余额。

新开局保留 initialMoney/initialGrain/initialCloth；只写收支预估，第一次过回合在回合号递增前收税和扣支。实际开局/12回合走势见 tax-base-opening-*-after.json 与 tax-base-comparison.md。

- [treasury/raw/崇禎長編_卷001.wiki](../sources/treasury/raw/崇禎長編_卷001.wiki)：「壬戌，發戶部太倉銀三十萬兩，工部銀二十萬兩，光祿寺銀三萬兩，順天府稅契等項銀一萬兩，為邊軍登極恩賚，人二金。」 天启七年八月壬戌的拨款，不是拨后实存。
- [treasury/raw/崇禎長編_卷002.txt](../sources/treasury/raw/崇禎長編_卷002.txt)：「副都御史管太僕寺事事郭興治會同廵視京營科道查核常盈老庫及東西二庫存貯銀僅一萬八千三百二十一兩」 天启七年九月戊寅，太仆寺三库合数18321两，不是户部太仓银库。原电子本重出“事”字照录。
- [treasury/raw/崇禎長編_卷002.txt](../sources/treasury/raw/崇禎長編_卷002.txt)：「查慶陵曾發內帑百萬謹援例以請帝允其半給貯節慎庫」 援庆陵例请求拨内帑百万，允其半；五十万是陵工拨款，非内帑全库余额。
- [treasury/raw/明熹宗實錄_卷086.txt](../sources/treasury/raw/明熹宗實錄_卷086.txt)：「蓋太倉之歲入僅三百三十萬，而歲出該五百餘萬」 天启七年七月辛巳，郭允厚论岁入岁出，证明危机，不证明某日存银。
- [treasury/raw/度支奏議_雲南司卷三.txt](../sources/treasury/raw/度支奏議_雲南司卷三.txt)：「盖漕粮入京仓者三分之二入通仓者三分之一是以京仓每年放六个月通仓每年放四个月」 崇祯二年十月初十日疏的京通收放制度，不是天启七年九月库存总数；电子录文存OCR疑字，未用于数值校准。
- [treasury/raw/度支奏議_堂稿卷二.txt](../sources/treasury/raw/度支奏議_堂稿卷二.txt)：「詳查原題，開欠八百二十六萬九千四百四十九兩零」 《钦奉上传覆查外解拖欠疏》追查各省欠解，不是太仓现银；不把应收款加进国库。

## 未核定

- 两淮有效课银/斤用万历额引和引价余银配对，是有据的平均财政收益率，不是同年盐商价目；天启无算浮课不造数。其它运司太仓课银未必包含全部边引收益，故这是一份可核来源的保守账。
- 河东十九万按含太仓四千的合计解释；陕西、四川解边及河东直支归地方军需，中央以后拨边不另造第二笔收入。
- 原盐斤主要为额盐，未有独立销售、库存、私盐份额。模型假定本年可销额盐等于产量，未售积盐并未建模。
- 盐课价率是课银净口径，不再减明初工本米；未知天启工本另未量化。月港仅计陆饷，海贸量沿用原估值。
- 旧 taxes 数组整体转为 taxList，田赋折银与漕粮恢复剧本已声明的参数；默认丁税、庸布、商税不再越过作者税表自动追加。其它 customTaxes 保留。
