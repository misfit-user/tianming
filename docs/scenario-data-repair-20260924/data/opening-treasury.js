'use strict';
// 库存与岁入、拨款、欠解分开。未找到同日库存总簿，不以邻年支出或其它库余额倒填。
const references={
  mingTaicangGrant:{file:'treasury/raw/崇禎長編_卷001.wiki',quote:'壬戌，發戶部太倉銀三十萬兩，工部銀二十萬兩，光祿寺銀三萬兩，順天府稅契等項銀一萬兩，為邊軍登極恩賚，人二金。',scope:'天启七年八月壬戌的拨款，不是拨后实存。'},
  mingChangying:{file:'treasury/raw/崇禎長編_卷002.txt',quote:'副都御史管太僕寺事事郭興治會同廵視京營科道查核常盈老庫及東西二庫存貯銀僅一萬八千三百二十一兩',scope:'天启七年九月戊寅，太仆寺三库合数18321两，不是户部太仓银库。原电子本重出“事”字照录。'},
  mingInnerGrant:{file:'treasury/raw/崇禎長編_卷002.txt',quote:'查慶陵曾發內帑百萬謹援例以請帝允其半給貯節慎庫',scope:'援庆陵例请求拨内帑百万，允其半；五十万是陵工拨款，非内帑全库余额。'},
  mingCrisis:{file:'treasury/raw/明熹宗實錄_卷086.txt',quote:'蓋太倉之歲入僅三百三十萬，而歲出該五百餘萬',scope:'天启七年七月辛巳，郭允厚论岁入岁出，证明危机，不证明某日存银。'},
  mingGranaries:{file:'treasury/raw/度支奏議_雲南司卷三.txt',quote:'盖漕粮入京仓者三分之二入通仓者三分之一是以京仓每年放六个月通仓每年放四个月',scope:'崇祯二年十月初十日疏的京通收放制度，不是天启七年九月库存总数；电子录文存OCR疑字，未用于数值校准。'},
  mingArrears:{file:'treasury/raw/度支奏議_堂稿卷二.txt',quote:'詳查原題，開欠八百二十六萬九千四百四十九兩零',scope:'《钦奉上传覆查外解拖欠疏》追查各省欠解，不是太仓现银；不把应收款加进国库。'},
  songOpening:{file:'treasury/raw/建炎以來繫年要錄 (四庫全書本)_卷008.wiki',quote:'建炎元年',scope:'核查卷七、八（建炎元年七、八月），未找到400万贯、500万石的行在国库实存清册。'},
  songShippingMixed:{file:'treasury/raw/建炎以來朝野雜記_甲集_卷十五.wiki',quote:'至紹興末，两舶司抽分及和買，歲得息錢二百萬緡',scope:'明确合并抽分与和买，不能全除以一成当货值。'},
  songShippingYears:{file:'treasury/raw/建炎以來朝野雜記_甲集_卷十五.wiki',quote:'六年冬，福建市舶司言自建炎二年至紹興四年，收息錢九十八萬緡',scope:'1128—1134多年累计、且称息钱，既不是1127单年全国数，也未剔除博买收益。'},
  tangOpening:{file:'treasury/raw/資治通鑑_卷246.wiki',quote:'文宗元聖昭獻孝皇帝下開成五年',scope:'核查开成五年及同卷前后，未找到280万贯、220万石的中央库存清册；既有唐财政资料为岁课、支给，不能冒作存量。'}
};
module.exports={references,
 tianqi:{
  expected:{initialMoney:850000,initialGrain:13000000,initialCloth:500000},
  guoku:{historicalContext:'开局银85万两、粮1300万石、布50万匹沿用原剧本模型值，尚未核得天启七年八九月太仓银库及京通诸仓同日实存总簿。原称《明史·食货志》载80—120万两、1100—1500万石的范围未有逐字原文支持，撤销该引述。《崇祯长编》卷一八月壬戌发太仓银30万两属拨款；卷二九月戊寅太仆寺常盈等三库存18321两属另库，均不代替太仓库存。',source:'户部太仓银库；京通诸仓；布匹另库保管。各库存量为未核定开局模型值。',deficitNote:'天启末财政危机按原税制、军费与征收损耗呈现；首期收支在第一次过回合结算，不为消除赤字加税或调平。'},
  neitang:{historicalContext:'开局银250万两、粮12万石、布28万匹沿用未核定模型值，未找到天启七年八九月内承运库同日实存总簿。撤销原250万两及万历末500—600万两的无据断言。《崇祯长编》卷二允内帑拨陵工银50万两，是支出批款，不能据此断定全库余额。'},
  refs:['mingTaicangGrant','mingChangying','mingInnerGrant','mingCrisis','mingGranaries','mingArrears']
 },
 shaosong:{
  expected:{initialMoney:4000000,initialGrain:5000000,initialCloth:500000},
  guoku:{historicalContext:'开局钱400万贯、粮500万石、布50万匹沿用绍宋剧本模型值。核查《建炎以来系年要录》卷七、八，未得建炎元年八月同口径行在国库存量；原文案约100万贯既与配置400万贯矛盾，也没有对应原文，撤销其引书断言。岁入、军费拨款与靖康损失不当作开局库存。',deficitNote:'开局收支用现行税表和固定支出只读预估；钱粮布分列，首期在第一次过回合结算。存量与收支均不按平衡目标倒调。'},
  neitang:{historicalContext:'开局钱800万贯、粮10万石、布15万匹沿用绍宋剧本未核定模型值；未找到赵构在建炎元年八月携带150万贯或内库现存800万贯的逐字原文，撤销原文案的携款断言。'},
  refs:['songOpening','songShippingMixed','songShippingYears']
 },
 tang:{
  expected:{initialMoney:2800000,initialGrain:2200000,initialCloth:620000},
  guoku:{historicalContext:'度支掌上供与支给，地方留州留使另有用途。开局钱280万贯、粮220万石、绢布62万匹为原剧本中央可支存量模型，未在已核《资治通鉴》卷246开成五年及既有唐财政原文中找到同日盘库数；盐铁岁课、漕运年额均不冒作府库存量。'},
  neitang:{historicalContext:'宫中岁给由外库交割，内库与藩邸家资分册。开局钱65万贯、粮9万石、绢布8.5万匹为原剧本未核定模型值；未找到开成五年正月同日内库盘点总簿。'},
  refs:['tangOpening']
 }
};
