// 绍宋·大金 87 块（外藩）。户数、商税、田亩权重见 shaosong-jin-frame.js，这里写定性字段。
// 官称：原宋地（河东、河北东西路）天会五年仍用宋州县旧制，写知府、知州、知军；辽地按《金史·地理志》写节度使、刺史、留守。
// 地块归属以地图为准，描述只写「为金所据」，不写与地图冲突的具体陷落日期。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');
const frame = require('./shaosong-jin-frame');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function jb(name, fields) {
  const suffix = name.match(/(府|州|军|县)$/);
  return block(Object.assign({
    name,
    divisionType: suffix ? suffix[1] : '部',
    officialPosition: '知' + name,
    regionType: 'occupied_frontier',
    taxLevel: '中',
    tags: {},
    fisc: [0.63, 0.09]
  }, fields));
}

// ---- 河东路（原宋地） ----
const HEDONG = {
  太原府: jb('太原府', { terrain: '盆地', specialResources: '铁·铜鉴·矾石·人参', tags: { mineralRegion: true },
    description: '太原郡，河东节度，汾水上游的河东首府；靖康元年九月城破，守臣张孝纯被执，王禀战死。',
    idx: [26, 36, 38, 38, 28, 44, 42, 38], notes: '宋河东路治所，金西路军所得第一大城；交城有大通监（冶铁）。' }),
  隆德府: jb('隆德府', { terrain: '山地', specialResources: '人参·蜜·墨', tags: {},
    description: '本潞州，上党郡，昭义军节度，太行之巅，旧领河东路兵马钤辖；产铁、墨与上党人参。',
    idx: [28, 36, 32, 32, 26, 44, 42, 36], notes: '崇宁户五万二千余。' }),
  泽州: jb('泽州', { terrain: '山地', specialResources: '白石英·禹余粮·人参', tags: {},
    description: '高平郡，晋城、高平、阳城诸县，太行南端，冶铁、采煤之利甚盛；南出太行陉即怀州。',
    idx: [28, 36, 32, 32, 26, 44, 44, 36], notes: '崇宁户四万四千余。' }),
  平阳府: jb('平阳府', { terrain: '河谷', specialResources: '蜜·蜡烛·刻书', taxLevel: '中',
    description: '本晋州，建雄军节度，政和六年升府，汾水中游，临汾、洪洞诸县平野沃饶，平阳书坊刻书闻名。',
    idx: [28, 36, 36, 36, 26, 44, 40, 36], notes: '户七万五千余。' }),
  绛州: jb('绛州', { terrain: '河谷', specialResources: '防风·蜡烛·墨', tags: {},
    description: '绛郡，正平、曲沃诸县，汾水下游，土贡防风、蜡烛与墨，绛州园池为唐宋名迹。',
    idx: [28, 36, 36, 36, 26, 44, 40, 36], notes: '崇宁户五万九千余。' }),
  解州: jb('解州', { terrain: '河谷', specialResources: '解盐·盐花', tags: { saltRegion: true },
    description: '解、闻喜、安邑三县，解池产盐，为北方池盐之源，关羽故里；土贡盐花。',
    idx: [28, 36, 34, 34, 26, 46, 44, 38], notes: '解池盐利，志属永兴军路，地图归河东。' }),
  河中府: jb('河中府', { terrain: '河谷', specialResources: '五味子·龙骨·粮', tags: {},
    description: '河东郡，护国军节度，黄河东岸，蒲津浮桥为河东入关中之要津。',
    idx: [28, 36, 34, 34, 26, 44, 46, 36], notes: '蒲津渡口，志属永兴军路。' }),
  辽州: jb('辽州', { terrain: '山地', specialResources: '人参·粮', tags: {},
    description: '乐平郡，辽山、和顺、榆社、平城四县，太行山中小州，熙宁间一度废而复置。',
    idx: [28, 36, 30, 30, 26, 42, 42, 34], notes: '崇宁户七千余，熙宁间一度废州。' }),
  沁州: jb('沁州', { terrain: '山地', specialResources: '土絁·粮', tags: {},
    description: '宋威胜军，领铜鞮、武乡、沁源、绵上四县，太岳山东麓，沁水上游；金人改名沁州。',
    idx: [28, 36, 30, 30, 26, 42, 42, 34], officialPosition: '知沁州', notes: '宋名威胜军，地块名沁州为金所改。' }),
  汾州: jb('汾州', { terrain: '河谷', specialResources: '土絁·石膏·盐', tags: { saltRegion: true },
    description: '西河郡，西河、平遥、介休、灵石、孝义五县，汾水中游，汾酒与永利监盐。',
    idx: [28, 36, 38, 38, 26, 44, 40, 36], notes: '户五万余；永利西监煮盐。' }),
  石州: jb('石州', { terrain: '山地', specialResources: '蜜·蜡', tags: {},
    description: '昌化郡，离石、平夷、方山三县与葭芦、吴堡二砦，吕梁山西，隔河与西夏、鄜延相望。',
    idx: [28, 36, 34, 34, 26, 42, 40, 36], notes: '崇宁户一万五千余，葭芦砦已升晋宁军。' }),
  隰州: jb('隰州', { terrain: '山地', specialResources: '蜜·蜡', tags: {},
    description: '大宁郡，隰川、温泉、蒲、大宁、石楼、永和诸县，吕梁山南段，西临黄河。',
    idx: [28, 36, 34, 34, 26, 42, 40, 36], notes: '崇宁户三万八千余。' }),
  忻州: jb('忻州', { terrain: '河谷', specialResources: '麝·解玉砂', tags: {},
    description: '定襄郡，秀容、定襄二县，太原以北，南扼石岭关。',
    idx: [28, 36, 36, 36, 26, 44, 38, 36], notes: '石岭关在境，崇宁户一万八千余。' }),
  代州: jb('代州', { terrain: '边塞', specialResources: '麝香·石青·石绿', tags: {},
    description: '雁门郡，雁门关、五台山在境，旧置沿边安抚司，宋辽旧界所在。',
    idx: [36, 30, 36, 36, 24, 40, 46, 36], notes: '崇宁户三万三千余。' }),
  岚州: jb('岚州', { terrain: '山地', specialResources: '麝香·木材', tags: {},
    description: '昌烦郡，宜芳、合河、楼烦三县，管涔山区，汾水发源之地。',
    idx: [28, 36, 36, 36, 26, 42, 38, 36], notes: '崇宁户一万三千余。' }),
  保德军: jb('保德军', { terrain: '边塞', specialResources: '绢·粮', regionType: 'frontier_defense', tags: {},
    description: '淳化四年析岚州地置定羌军，景德元年改名，濒黄河，大堡、沙谷二津渡河通府州。',
    idx: [26, 36, 24, 24, 24, 40, 48, 34], notes: '崇宁户不足千。' }),
  宁化军: jb('宁化军', { terrain: '山地', specialResources: '绢·木材', tags: {},
    description: '宁化县地，管涔山中，崇宁三年废县为镇；诸堡寨扼汾水上源。',
    idx: [28, 36, 34, 34, 26, 42, 38, 34], notes: '崇宁户一千七百余。' }),
  火山军: jb('火山军', { terrain: '边塞', specialResources: '柴胡·粮', regionType: 'frontier_defense', tags: {},
    description: '本岚州之地，太平兴国七年建军，濒黄河，下镇砦为渡口。',
    idx: [26, 36, 24, 24, 24, 40, 48, 34], notes: '崇宁户五千余，领下镇砦。' }),
  岢岚军: jb('岢岚军', { terrain: '山地', specialResources: '绢·粮', tags: {},
    description: '太平兴国五年以岚州岚谷县建军，岢岚山下，宋辽旧界的后方。',
    idx: [28, 36, 34, 34, 26, 42, 38, 34], notes: '崇宁户二千九百余。' })
};

// ---- 河北东路（原宋地） ----
const HEBEI_EAST = {
  大名府: jb('大名府', { terrain: '平原', specialResources: '紬·绢·紫草·梨', taxLevel: '中',
    description: '北京魏郡，庆历二年建为北京，河北重镇，御河所经；土贡花绸、绵绸、紫草。',
    idx: [28, 36, 40, 40, 28, 46, 26, 38], keju: 1.3, notes: '宋北京留守司所在。' }),
  开德府: jb('开德府', { terrain: '平原', specialResources: '席·南粉', taxLevel: '中',
    description: '本澶州，澶渊郡，镇宁军节度，黄河北岸；真宗与辽订澶渊之盟于此。',
    idx: [28, 36, 38, 38, 28, 44, 26, 36], notes: '崇宁户三万一千余。' }),
  沧州: jb('沧州', { terrain: '沿海', specialResources: '海盐·绢·柳箱', tags: { saltRegion: true, fishingRegion: true },
    description: '景城郡，横海军节度，濒海盐场密布，御河北通；土贡大绢、大柳箱。',
    idx: [28, 36, 36, 36, 26, 44, 24, 36], notes: '户六万余。' }),
  冀州: jb('冀州', { terrain: '平原', specialResources: '绢·粮', tags: {},
    description: '信都郡，河北腹地平原，滹沱河、漳水之间，土贡绢。',
    idx: [28, 36, 36, 36, 26, 44, 24, 36], notes: '崇宁户六万六千余。' }),
  河间府: jb('河间府', { terrain: '平原', specialResources: '绢·无缝绵·蔺席', tags: {},
    description: '本瀛州，河间郡，瀛海军节度，大观二年升府，宋辽旧界南侧重镇，城坚兵众。',
    idx: [30, 34, 36, 36, 28, 44, 26, 38], notes: '河北东路治所。' }),
  博州: jb('博州', { terrain: '平原', specialResources: '平绢·粮', tags: {},
    description: '博平郡，黄河以北、御河以东，土贡平绢。',
    idx: [28, 36, 36, 36, 26, 44, 22, 36], notes: '崇宁户四万六千余。' }),
  棣州: jb('棣州', { terrain: '平原', specialResources: '绢·粮', tags: {},
    description: '乐安郡，黄河下游近海，土贡绢，濒海有盐场。',
    idx: [28, 36, 36, 36, 26, 44, 22, 36], notes: '崇宁户三万九千余。' }),
  德州: jb('德州', { terrain: '平原', specialResources: '绢·粮', tags: {},
    description: '平原郡，御河所经，河北、京东之间的漕运要地。',
    idx: [28, 36, 36, 36, 26, 44, 22, 36], notes: '崇宁户四万四千余。' }),
  滨州: jb('滨州', { terrain: '沿海', specialResources: '海盐·绢·鱼', tags: { saltRegion: true, fishingRegion: true },
    description: '渤海之滨，渤海、招安二县，盐场相望，土贡绢。',
    idx: [28, 36, 34, 34, 26, 44, 22, 36], notes: '崇宁户近五万。' }),
  恩州: jb('恩州', { terrain: '平原', specialResources: '绢·白毯', tags: {},
    description: '清河郡，唐贝州，庆历八年王则起事平定后改名恩州，御河所经。',
    idx: [28, 36, 36, 36, 26, 44, 22, 36], notes: '崇宁户五万一千余。' }),
  清州: jb('清州', { terrain: '沿海', specialResources: '绢·鱼', tags: { fishingRegion: true },
    description: '本乾宁军，大观二年升州，界河入海处，旧为宋辽塘泺防线东端。',
    idx: [28, 36, 32, 32, 26, 42, 24, 36], notes: '崇宁户六千六百余。' }),
  莫州: jb('莫州', { terrain: '水乡', specialResources: '绵·鱼', tags: { fishingRegion: true },
    description: '文安郡，塘泺之间，宋辽旧界南侧，宋人广植塘泺以阻契丹骑兵。',
    idx: [28, 36, 32, 32, 26, 42, 26, 36], notes: '崇宁户一万四千余。' }),
  雄州: jb('雄州', { terrain: '水乡', specialResources: '紬·鱼', tags: { fishingRegion: true },
    description: '白沟河南岸，宋辽旧界所在，置榷场互市，白沟驿为两国使节往来之地。',
    idx: [28, 36, 34, 34, 26, 42, 28, 36], notes: '宋辽界河榷场。' }),
  霸州: jb('霸州', { terrain: '水乡', specialResources: '绢·鱼', tags: { fishingRegion: true },
    description: '霸州文安、大城二县，塘泺之地，宋辽旧界南侧。',
    idx: [28, 36, 32, 32, 26, 42, 26, 36], notes: '崇宁户一万五千余。' }),
  保定军: jb('保定军', { terrain: '水乡', specialResources: '絁·鱼', tags: { fishingRegion: true },
    description: '塘泺间的军城，宋辽旧界防线之一，领保定一县。',
    idx: [28, 36, 30, 30, 26, 42, 26, 34], notes: '崇宁户一千余。' }),
  信安军: jb('信安军', { terrain: '水乡', specialResources: '绢·鱼', tags: { fishingRegion: true },
    description: '宋辽界河南岸塘泺中的军城，扼白沟、界河之会。',
    idx: [28, 36, 30, 30, 26, 42, 26, 34], notes: '崇宁户七百余，领砦七。' }),
  永静军: jb('永静军', { terrain: '平原', specialResources: '簟·绢', tags: {},
    description: '东光、将陵、阜城三县，御河所经，土贡簟、绢。',
    idx: [28, 36, 34, 34, 26, 44, 22, 36], notes: '崇宁户三万四千余。' })
};

// ---- 河北西路（原宋地，金所据部分） ----
const HEBEI_WEST = {
  真定府: jb('真定府', { terrain: '平原', specialResources: '罗·瓷·铜铁', tags: { mineralRegion: true }, taxLevel: '中',
    description: '常山郡，唐成德军节度，河北西路首府，滹沱河所经；靖康元年冬城破，金人于此置帅府镇抚新附州县。',
    idx: [28, 36, 38, 38, 28, 44, 36, 38], keju: 1.2, notes: '河北西路治所；《金史》真定府产瓷器、铜、铁。' }),
  中山府: jb('中山府', { terrain: '平原', specialResources: '罗·大花绫·瓷', taxLevel: '中',
    description: '本定州，博陵郡，政和三年升府，定窑白瓷与花绫闻名，宋辽旧界西段重镇。',
    idx: [28, 36, 38, 38, 28, 44, 36, 38], notes: '定窑。北平县另见顺平军。' }),
  洺州: jb('洺州', { terrain: '平原', specialResources: '紬·粮', tags: {},
    description: '广平郡，永年、肥乡诸县，漳水、洺水之间。',
    idx: [28, 36, 34, 34, 26, 44, 34, 36], notes: '崇宁户三万八千余。' }),
  邢州: jb('邢州', { terrain: '平原', specialResources: '绢·白瓷盏·解玉砂·铁', tags: { mineralRegion: true },
    description: '宋宣和元年升信德府，钜鹿郡，邢窑白瓷与綦村铁冶；金人复称邢州。',
    idx: [28, 36, 34, 34, 26, 44, 34, 36], officialPosition: '知邢州', notes: '宋名信德府，地块名为金复旧名。' }),
  赵州: jb('赵州', { terrain: '平原', specialResources: '绢·绵', tags: {},
    description: '宋宣和元年升庆源府，赵郡，平棘、宁晋诸县，赵州桥横跨洨河；属县赞皇今为河北义军所据。',
    idx: [28, 36, 34, 34, 26, 44, 34, 36], officialPosition: '知赵州', notes: '宋名庆源府。' }),
  深州: jb('深州', { terrain: '平原', specialResources: '绢·粮', tags: {},
    description: '饶阳郡，滹沱河下游平原，土贡绢。',
    idx: [28, 36, 34, 34, 26, 44, 32, 36], notes: '崇宁户三万八千余。' }),
  祁州: jb('祁州', { terrain: '平原', specialResources: '花絁·药材', tags: {},
    description: '蒲阴郡，蒲阴、鼓城、深泽三县，土贡花絁。',
    idx: [28, 36, 32, 32, 26, 42, 34, 36], notes: '崇宁户二万四千余。' }),
  保州: jb('保州', { terrain: '平原', specialResources: '绢·粮', tags: {},
    description: '本莫州清苑县，太平兴国六年建州，宋辽旧界西段的前沿。',
    idx: [28, 36, 32, 32, 26, 42, 36, 36], notes: '崇宁户二万七千余。' }),
  顺安军: jb('顺安军', { terrain: '水乡', specialResources: '绢·鱼', tags: { fishingRegion: true },
    description: '本瀛州高阳关砦，淳化三年建军，高阳关为河北三关之一。',
    idx: [28, 36, 30, 30, 26, 42, 36, 34], notes: '崇宁户八千六百余。' }),
  安肃军: jb('安肃军', { terrain: '平原', specialResources: '素丝·粮', tags: {},
    description: '本易州遂城县，太平兴国六年建静戎军，景德元年改安肃军，宋辽旧界前沿。',
    idx: [28, 36, 30, 30, 26, 42, 36, 34], notes: '崇宁户七千余。' }),
  广信军: jb('广信军', { terrain: '平原', specialResources: '紬·栗', tags: {},
    description: '易州遂城县地，景德元年改广信军，杨延昭守遂城即此，号铁遂城。',
    idx: [28, 36, 30, 30, 26, 42, 36, 34], notes: '崇宁户四千四百余。' }),
  顺平军: jb('顺平军', { divisionType: '县', officialPosition: '知北平县', terrain: '丘陵', specialResources: '粮·木材', tags: {},
    description: '宋中山府北平县地，太行东麓，北平寨扼入易州之路；「顺平」为后世县名。',
    idx: [28, 36, 30, 30, 26, 42, 36, 34], notes: '按中山府北平县切出（九域志无定州乡数，按县等）。' }),
  井陉县: jb('井陉县', { terrain: '山地', specialResources: '粮·关隘', tags: {},
    description: '真定府属县，井陉关（土门）为太行八陉之五，河东入河北的咽喉。',
    idx: [28, 36, 30, 30, 26, 42, 40, 34], notes: '九域志：一乡。' })
};

// ---- 燕山地区（辽南京道旧地） ----
const YAN = {
  燕京: jb('燕京', { divisionType: '府', officialPosition: '燕京留守', governor: '时立爱', regionType: 'normal',
    terrain: '平原', specialResources: '金银铜铁·粮·百货', taxLevel: '中', tags: { mineralRegion: true },
    description: '辽南京析津府，宣和五年宋人赎还，号燕山府，靖康前复为金人所夺；金东路军根本，枢密院与留守司所在，城中汉人官吏多辽旧臣。',
    idx: [32, 34, 40, 40, 26, 44, 28, 38], keju: 1.5, corridor: 1.6, notes: '户数取金大兴府与通州。时立爱为燕京留守。' }),
  涿州: jb('涿州', { officialPosition: '涿州刺史', regionType: 'normal', terrain: '平原', specialResources: '罗·粮', tags: {},
    description: '涿郡，燕京西南门户，拒马河所经，宋辽旧界北侧。',
    idx: [30, 34, 36, 36, 26, 44, 26, 36], notes: '辽为永泰军；《金史》贡罗。' }),
  易州: jb('易州', { officialPosition: '易州刺史', regionType: 'normal', terrain: '丘陵', specialResources: '墨·粮', tags: {},
    description: '上谷郡，易水之滨，易州墨闻名；燕赵之间的山前之地。',
    idx: [30, 34, 34, 34, 26, 42, 26, 36], notes: '辽置高阳军。' }),
  蓟州: jb('蓟州', { officialPosition: '蓟州刺史', regionType: 'normal', terrain: '丘陵', specialResources: '粟·栗', tags: {},
    description: '渔阳郡，燕山南麓，东控卢龙塞，燕京东面屏障。',
    idx: [30, 34, 34, 34, 26, 42, 26, 36], notes: '辽置上武军；《金史》产粟。' }),
  檀州: jb('檀州', { officialPosition: '檀州刺史', regionType: 'normal', terrain: '山地', specialResources: '粮·木材', tags: {},
    description: '密云县地，古北口在境，燕京北出塞外的关口。',
    idx: [30, 34, 30, 30, 26, 40, 28, 34], notes: '金省檀州入顺州，户取顺州之半。' }),
  顺州: jb('顺州', { officialPosition: '顺州刺史', regionType: 'normal', terrain: '平原', specialResources: '粮', tags: {},
    description: '怀柔县地，燕京东北，白河所经。',
    idx: [30, 34, 34, 34, 26, 42, 26, 34], notes: '户取金顺州之半。' }),
  平州: jb('平州', { officialPosition: '平州节度使', regionType: 'normal', terrain: '沿海', specialResources: '樱桃·绫·鱼·粮', tags: { fishingRegion: true },
    description: '卢龙旧地，辽兴平军，领卢龙、滦州诸县，濒海；宣和间张觉据平州降宋，为金人南侵口实。',
    idx: [30, 34, 34, 34, 28, 42, 26, 36], notes: '户取金平州、滦州。' }),
  营州: jb('营州', { officialPosition: '兴中府尹', regionType: 'normal', terrain: '丘陵', specialResources: '粮·马', tags: { horseRegion: true },
    description: '唐营州柳城故地，辽为霸州、兴中府，大凌河流域，燕京通辽东的中道。',
    idx: [32, 32, 32, 32, 26, 40, 24, 34], notes: '户取金兴中府、建州。' })
};

// ---- 云中地区（辽西京道旧地） ----
const YUNZHONG = {
  云州: jb('云州', { divisionType: '府', officialPosition: '西京兵马都部署', regionType: 'normal', terrain: '边塞', specialResources: '马·盐·铁·石绿·绿矾', tags: { saltRegion: true, mineralRegion: true, horseRegion: true },
    description: '辽西京大同府，金西路军元帅府驻此，宗翰以云中节制河东诸军；云冈石窟在城西。',
    idx: [34, 32, 36, 36, 24, 40, 48, 38], fisc: [0.69, 0.07], corridor: 1.4, notes: '户取金大同府。' }),
  应州: jb('应州', { officialPosition: '应州节度使', regionType: 'normal', terrain: '边塞', specialResources: '马·粮', tags: { horseRegion: true },
    description: '辽彰国军，金城、浑源、河阴三县，佛宫寺木塔（应县木塔）立于城中。',
    idx: [36, 32, 32, 32, 24, 40, 44, 36], fisc: [0.69, 0.07], notes: '《金史》应州彰国军节度使。' }),
  朔州: jb('朔州', { officialPosition: '朔州节度使', regionType: 'normal', terrain: '边塞', specialResources: '铁·马·枸杞', tags: { mineralRegion: true, horseRegion: true },
    description: '辽顺义军，马邑古地，武州并入，扼雁门关北。',
    idx: [36, 32, 32, 32, 24, 40, 46, 36], fisc: [0.69, 0.07], notes: '户取金朔州、武州。' }),
  蔚州: jb('蔚州', { officialPosition: '蔚州节度使', regionType: 'normal', terrain: '山地', specialResources: '地蕈·玛瑙·粮', tags: {},
    description: '辽忠顺军，飞狐、灵丘诸县，飞狐口通河北；弘州（阳原）在其西。',
    idx: [36, 32, 32, 32, 24, 40, 44, 36], fisc: [0.69, 0.07], notes: '户取金蔚州、弘州；《金史》蔚州贡地蕈、弘州产玛瑙。' }),
  燕云新州: jb('燕云新州', { divisionType: '州', officialPosition: '归化州刺史', regionType: 'normal', terrain: '草原', specialResources: '马·羊·皮毛', tags: { horseRegion: true },
    description: '奉圣州以北的桑干河上游与长城外坝上草原，辽归化州与抚、桓、昌诸州之地，契丹、奚人群牧所在。',
    idx: [36, 32, 30, 30, 24, 38, 44, 34], fisc: [0.69, 0.07], notes: '户取金宣德州（辽归化州）与抚、桓、昌州。' }),
  奉圣州: jb('奉圣州', { officialPosition: '奉圣州节度使', regionType: 'normal', terrain: '河谷', specialResources: '粮·马', tags: {},
    description: '晋新州，辽改奉圣州武定军，桑干河谷，居庸关外燕京西北屏障。',
    idx: [36, 32, 34, 34, 24, 40, 44, 36], fisc: [0.69, 0.07], notes: '户取金德兴府（奉圣州大安元年升府）。' }),
  云内州: jb('云内州', { officialPosition: '云内州节度使', regionType: 'normal', terrain: '草原', specialResources: '青镔铁·马', tags: { mineralRegion: true, horseRegion: true },
    description: '辽开远军，阴山南麓、黄河东岸，产青镔铁；与西夏相邻。',
    idx: [34, 32, 30, 30, 24, 38, 48, 36], fisc: [0.69, 0.07], notes: '户取金云内州、东胜州。' }),
  丰州天德军: jb('丰州天德军', { divisionType: '州', officialPosition: '天德军节度使', regionType: 'frontier_defense', terrain: '草原', specialResources: '马·羊·不灰木·地蕈', tags: { horseRegion: true },
    description: '辽丰州天德军，阴山以南的丰州滩，汉人屯垦与诸部游牧相杂，北通漠北。',
    idx: [34, 32, 30, 30, 24, 38, 48, 36], fisc: [0.69, 0.07], notes: '户取金丰州、净州。' })
};

// ---- 辽东地区（辽东京道旧地） ----
const LIAODONG = {
  辽阳府: jb('辽阳府', { officialPosition: '东京兵马都部署', regionType: 'normal', terrain: '平原', specialResources: '粮·人参·白附子', tags: {},
    description: '辽东京辽阳府，渤海遗民聚居，天辅初高永昌据此自立，旋为金人所并，置兵马都部署司（天德以后方改留守司）。',
    idx: [38, 30, 36, 36, 26, 42, 32, 36], fisc: [0.69, 0.07], keju: 1.2, notes: '户取金辽阳府、澄州。' }),
  沈州: jb('沈州', { officialPosition: '沈州刺史', regionType: 'normal', terrain: '平原', specialResources: '粮', tags: {},
    description: '辽昭德军，浑河之滨，贵德州（抚顺）在其东。',
    idx: [38, 30, 34, 34, 26, 42, 32, 36], fisc: [0.69, 0.07], notes: '户取金沈州、贵德州。' }),
  辽东复州: jb('辽东复州', { divisionType: '州', officialPosition: '复州刺史', regionType: 'normal', terrain: '沿海', specialResources: '鹿筋·鱼', tags: { fishingRegion: true },
    description: '辽南海滨的复州，渤海遗民与汉人杂处，煮海为盐。',
    idx: [38, 30, 32, 32, 26, 40, 30, 34], fisc: [0.69, 0.07], notes: '辽为节度州，旧贡鹿筋。' }),
  辽东辰州: jb('辽东辰州', { divisionType: '州', officialPosition: '辰州节度使', regionType: 'normal', terrain: '沿海', specialResources: '鱼·粮', tags: { fishingRegion: true },
    description: '辽辰州（金改盖州），辽东半岛西岸，渤海盐场所在。',
    idx: [38, 30, 32, 32, 26, 40, 30, 34], fisc: [0.69, 0.07], notes: '户取金盖州。' }),
  来州: jb('来州', { officialPosition: '来州节度使', regionType: 'normal', terrain: '沿海', specialResources: '鱼·粮', tags: { fishingRegion: true },
    description: '辽来州归德军（金改宗州、瑞州），辽西走廊濒海之地。',
    idx: [38, 30, 32, 32, 26, 40, 32, 34], fisc: [0.69, 0.07], notes: '户取金瑞州。' }),
  锦州: jb('锦州', { officialPosition: '锦州节度使', regionType: 'normal', terrain: '丘陵', specialResources: '粮', tags: {},
    description: '辽临海军，辽西走廊要地，义州（辽宜州）在其北。',
    idx: [38, 30, 34, 34, 26, 42, 32, 36], fisc: [0.69, 0.07], notes: '户取金锦州、义州。' }),
  显州: jb('显州', { officialPosition: '显州节度使', regionType: 'normal', terrain: '丘陵', specialResources: '粮·马', tags: {},
    description: '辽显州奉先军，医巫闾山下，辽世宗、景宗显陵、乾陵所在；懿州在其北。',
    idx: [38, 30, 34, 34, 26, 42, 32, 36], fisc: [0.69, 0.07], notes: '户取金广宁府、懿州。' }),
  咸州: jb('咸州', { officialPosition: '咸州路都统', regionType: 'normal', terrain: '平原', specialResources: '粮·马', tags: {},
    description: '辽咸州，金初为咸州路，置都统，扼女真南下辽东的通道；韩州在其北。',
    idx: [38, 30, 34, 34, 26, 42, 34, 36], fisc: [0.69, 0.07], notes: '《金史》：国初为咸州路，置都统。户取金咸平府、韩州。' })
};

// ---- 女真本部与北方诸组 ----
const NORTHLAND = {
  会宁: jb('会宁', { divisionType: '府', officialPosition: '会宁府尹', regionType: 'banner_homeland', taxLevel: '轻', terrain: '寒地', specialResources: '马·貂皮·人参·秦王鱼', tags: { horseRegion: true, fishingRegion: true },
    description: '按出虎水之滨，完颜部兴起之地，太宗吴乞买建都会宁，御寨所在，诸猛安谋克环居。',
    idx: [58, 20, 36, 36, 20, 34, 46, 34], fisc: [0.78, 0.05], notes: '《金史》：初为会宁州，太宗以建都升为府。' }),
  出河店: jb('出河店', { divisionType: '州', officialPosition: '出河店猛安', regionType: 'banner_homeland', taxLevel: '轻', terrain: '寒地', specialResources: '鱼·马', tags: { horseRegion: true, fishingRegion: true },
    description: '松花江北岸，阿骨打收国元年大破辽军于此；后建肇州。',
    idx: [56, 22, 32, 32, 22, 36, 44, 34], fisc: [0.78, 0.05], notes: '《金史》肇州「旧出河店也」，天会八年方建州。' }),
  按出虎水东部: jb('按出虎水东部', { divisionType: '部', officialPosition: '猛安', regionType: 'banner_homeland', taxLevel: '轻', terrain: '林地', specialResources: '貂皮·人参·木材', tags: { fishingRegion: true },
    description: '按出虎水以东的山林，女真诸猛安谋克渔猎耕作之地。',
    idx: [56, 22, 30, 30, 22, 34, 44, 32], fisc: [0.78, 0.05], notes: '户数为估数。' }),
  合懒甸: jb('合懒甸', { divisionType: '部', officialPosition: '合懒路万户', regionType: 'banner_homeland', taxLevel: '轻', terrain: '林地', specialResources: '貂皮·人参·海东青', tags: {},
    description: '合懒水流域，东南接高丽，女真合懒路万户所辖，曾与高丽争地筑城。',
    idx: [54, 22, 28, 28, 24, 32, 48, 32], fisc: [0.78, 0.05], notes: '户数为估数。' }),
  胡里改: jb('胡里改', { divisionType: '部', officialPosition: '胡里改路万户', regionType: 'banner_homeland', taxLevel: '轻', terrain: '林地', specialResources: '貂皮·鱼·海东青', tags: { fishingRegion: true },
    description: '胡里改江（牡丹江）流域，国初置万户，五国部与兀惹诸部杂处，海东青所出。',
    idx: [54, 22, 28, 28, 24, 32, 46, 32], fisc: [0.78, 0.05], notes: '《金史》：国初置万户。' }),
  曷苏馆: jb('曷苏馆', { divisionType: '部', officialPosition: '曷苏馆路都统', regionType: 'banner_homeland', taxLevel: '轻', terrain: '丘陵', specialResources: '粮·鱼', tags: { fishingRegion: true },
    description: '辽东半岛上的熟女真曷苏馆部，辽时编入籍户，收国后归附。',
    idx: [52, 24, 30, 30, 22, 34, 42, 32], fisc: [0.78, 0.05], notes: '户数为估数。' }),
  临潢府: jb('临潢府', { officialPosition: '临潢府尹', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', specialResources: '马·羊·皮毛·绫锦', tags: { horseRegion: true },
    description: '辽上京临潢府，地名西楼，契丹宫帐与祖庙所在，天辅四年为金所破；辽时南城汉人聚居，置绫锦院。',
    idx: [40, 28, 32, 32, 24, 40, 34, 36], fisc: [0.69, 0.07], notes: '《金史》临潢府「地名西楼，辽为上京」。' }),
  饶州北地: jb('饶州北地', { divisionType: '部', officialPosition: '详稳', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', specialResources: '马·羊', tags: { horseRegion: true },
    description: '辽饶州以北的潢水上游草原，契丹诸部牧地。',
    idx: [42, 28, 28, 28, 24, 38, 34, 34], fisc: [0.69, 0.07], notes: '户数为估数。' }),
  契丹庆州: jb('契丹庆州', { divisionType: '州', officialPosition: '庆州刺史', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', specialResources: '马·羊', tags: { horseRegion: true },
    description: '辽庆州，辽圣宗、兴宗、道宗庆陵所在，城中有辽行宫，契丹贵族旧居。',
    idx: [40, 28, 30, 30, 26, 38, 34, 36], fisc: [0.69, 0.07], notes: '《金史》庆州条。' }),
  临潢北境: jb('临潢北境', { divisionType: '部', officialPosition: '详稳', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', specialResources: '马·羊·皮毛', tags: { horseRegion: true },
    description: '临潢以北的草原，契丹与乌古、敌烈诸部游牧之地。',
    idx: [42, 28, 26, 26, 26, 36, 36, 34], fisc: [0.69, 0.07], notes: '户数为估数。' }),
  大定府: jb('大定府', { officialPosition: '大定府尹', regionType: 'normal', terrain: '丘陵', specialResources: '粮·马·羊·酥乳', tags: { horseRegion: true },
    description: '辽中京大定府，奚王旧牙帐之地，城郭仿汴京，奚人与汉人杂居；利州、兴州在其南。',
    idx: [38, 30, 36, 36, 24, 40, 32, 36], fisc: [0.69, 0.07], notes: '户取金大定府、利州、兴州。' }),
  长春州: jb('长春州', { officialPosition: '长春州节度使', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', specialResources: '鱼·马·牛羊', tags: { horseRegion: true, fishingRegion: true },
    description: '辽长春州，辽帝春捺钵于此钩鱼捕鹅；黄龙府（金隆州）与信州在其东，为女真西面屏障。',
    idx: [42, 28, 32, 32, 24, 38, 46, 34], fisc: [0.78, 0.05], notes: '户取金泰州、隆州、信州。' }),
  泰州北地: jb('泰州北地', { divisionType: '部', officialPosition: '详稳', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', specialResources: '马·牛羊', tags: { horseRegion: true },
    description: '辽旧泰州以北，契丹二十部族牧地。',
    idx: [40, 28, 28, 28, 26, 38, 48, 34], fisc: [0.78, 0.05], notes: '户数为估数。' }),
  兴安岭西麓: jb('兴安岭西麓', { divisionType: '部', officialPosition: '详稳', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '林地', specialResources: '马·皮毛', tags: { horseRegion: true },
    description: '大兴安岭西麓，室韦与乌古诸部游猎之地。',
    idx: [40, 28, 26, 26, 26, 36, 48, 34], fisc: [0.78, 0.05], notes: '户数为估数。' })
};

function pick(names) {
  const out = {};
  names.forEach((n) => { out[n] = NORTHLAND[n]; });
  return out;
}

// 权重走大金框架：宋地取《宋史》崇宁户，北方取《金史》泰和户折算（见 shaosong-jin-frame.js）
function jinCircuit(circuit, blocks, regionMeans) {
  const UNITS = Object.keys(blocks).map((name) => {
    const w = frame.weights(name, circuit);
    return {
      name,
      block: name,
      countyCount: w.counties,
      weights: { pop: w.households, households: w.households, grain: w.twoTax, land: w.land, commerce: w.commerce },
      basis: '户数：' + w.householdBasis + '。商税：' + w.commerceBasis + '。'
    };
  });
  return circuitModule(circuit, { faction: '大金', BLOCKS: blocks, UNITS, regionMeans });
}

module.exports = [
  jinCircuit('河东路', HEDONG, { development: 33.81, unrest: 26.95, taxBurden: 43.13, armyPressure: 40.11 }),
  jinCircuit('河北东路', HEBEI_EAST, { development: 35.77, unrest: 27, taxBurden: 43.96, armyPressure: 23.74 }),
  jinCircuit('河北西路', HEBEI_WEST, { development: 34.23, unrest: 27, taxBurden: 43.19, armyPressure: 34.56 }),
  jinCircuit('燕山地区', YAN, { development: 35.04, unrest: 26.82, taxBurden: 43.3, armyPressure: 25.58 }),
  jinCircuit('云中地区', YUNZHONG, { development: 33.1, unrest: 24, taxBurden: 40, armyPressure: 45.32 }),
  jinCircuit('辽东地区', LIAODONG, { development: 33.83, unrest: 26.78, taxBurden: 41.05, armyPressure: 32 }),
  jinCircuit('女真本部', pick(['会宁', '出河店', '按出虎水东部', '合懒甸', '胡里改', '曷苏馆']),
    { development: 34.19, unrest: 23.02, taxBurden: 35.53, armyPressure: 45.13 }),
  jinCircuit('临潢地区', pick(['临潢府', '饶州北地', '契丹庆州', '临潢北境']), { development: 30.47, unrest: 24.57, taxBurden: 39.23, armyPressure: 34.49 }),
  jinCircuit('大定地区', pick(['大定府']), { development: 35, unrest: 24, taxBurden: 40, armyPressure: 32 }),
  jinCircuit('长春—泰州', pick(['长春州', '泰州北地', '兴安岭西麓']), { development: 30.21, unrest: 25.39, taxBurden: 38.22, armyPressure: 47.14 })
];
