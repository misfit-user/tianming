// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-historical-presets.js — 6 文档第二期补完
 *
 * 覆盖：
 *  1. 25 条大徭役完整 JSON（秦长城→清河工）
 *  2. 9 大迁徙历史事件完整数据
 *  3. 7 大兵制完整详表（府兵/募兵/卫所/八旗/绿营/团练/藩镇）
 *  4. 8 朝代中期阶层比例矩阵
 *  5. 65 条诏令预设模板（5 虚空×13）
 *  6. 30 条历代典范诏书完整描述
 *  7. 抗疏 12 条历史典范
 *  8. 9 套制度模板（秦/汉/唐初/唐中/宋/元/明/清/近代）
 *  9. B3 徭役死亡率四维公式
 *  10. B5 逃役五因子
 *  11. D2 年龄金字塔精细化
 *  12. D5 迁徙通道成本
 *  13. D6 京畿虹吸四因子
 *  14. 瘟疫/战亡独立字段
 *  15. 制度 7 阶段生命周期
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  [1] 25 条大徭役完整 JSON
  // ═══════════════════════════════════════════════════════════════════

  var GREAT_CORVEE_PROJECTS = [
    { id:'qin_changcheng',      name:'秦始皇长城',   dynasty:'秦',     year:-214, labor:300000, deathRate:0.33, duration:9, legitimacyDelta:-5, minxinDelta:-10, outcomes:{ defense:+25, farmland:+0 }, notes:'孟姜女哭长城' },
    { id:'qin_afang',           name:'阿房宫',       dynasty:'秦',     year:-212, labor:700000, deathRate:0.25, duration:3, legitimacyDelta:-12, minxinDelta:-18, outcomes:{ prestige:+20, farmland:-0 }, notes:'天下苦秦久矣' },
    { id:'qin_shihuangling',    name:'始皇陵',       dynasty:'秦',     year:-246, labor:700000, deathRate:0.28, duration:39, legitimacyDelta:-8, minxinDelta:-14, outcomes:{ prestige:+15 }, notes:'兵马俑' },
    { id:'qin_lingqu',          name:'灵渠',         dynasty:'秦',     year:-219, labor:100000, deathRate:0.15, duration:5, legitimacyDelta:-2, minxinDelta:-5, outcomes:{ transport:+10, farmland:+5 }, notes:'沟通湘漓' },
    { id:'han_hanwu_lagoon',    name:'汉武塞决',     dynasty:'西汉',   year:-109, labor:200000, deathRate:0.10, duration:2, legitimacyDelta:+5, minxinDelta:+2, outcomes:{ farmland:+10, disaster:-5 }, notes:'瓠子堵口' },
    { id:'cao_wei_tuntian',     name:'曹魏屯田',     dynasty:'三国',   year:196, labor:300000, deathRate:0.05, duration:20, legitimacyDelta:+3, minxinDelta:+3, outcomes:{ farmland:+20, grain:+50000 }, notes:'军屯民屯并行' },
    { id:'sui_tongji',          name:'通济渠',       dynasty:'隋',     year:605, labor:1000000, deathRate:0.22, duration:1, legitimacyDelta:-15, minxinDelta:-20, outcomes:{ transport:+30, prestige:+5 }, notes:'大运河南段' },
    { id:'sui_yongji',          name:'永济渠',       dynasty:'隋',     year:608, labor:1000000, deathRate:0.20, duration:1, legitimacyDelta:-12, minxinDelta:-18, outcomes:{ transport:+25 }, notes:'大运河北段' },
    { id:'sui_jiangnan',        name:'江南运河',     dynasty:'隋',     year:610, labor:500000, deathRate:0.12, duration:1, legitimacyDelta:-8, minxinDelta:-12, outcomes:{ transport:+20 }, notes:'京杭段' },
    { id:'sui_daxingcheng',     name:'大兴城',       dynasty:'隋',     year:582, labor:500000, deathRate:0.08, duration:1, legitimacyDelta:-3, minxinDelta:-5, outcomes:{ prestige:+10 }, notes:'长安前身' },
    { id:'tang_luoyang',        name:'营洛阳',       dynasty:'唐',     year:657, labor:200000, deathRate:0.06, duration:2, legitimacyDelta:+2, minxinDelta:-3, outcomes:{ prestige:+8 }, notes:'东都' },
    { id:'tang_longmen',        name:'龙门石窟扩凿', dynasty:'唐',     year:680, labor:150000, deathRate:0.03, duration:30, legitimacyDelta:+5, minxinDelta:+5, outcomes:{ prestige:+12, faith:+8 }, notes:'佛教兴盛' },
    { id:'song_xuanfang',       name:'宣房塞河',     dynasty:'宋',     year:1048, labor:300000, deathRate:0.08, duration:2, legitimacyDelta:+3, minxinDelta:0, outcomes:{ disaster:-8 }, notes:'黄河治理' },
    { id:'yuan_dadu',           name:'营大都',       dynasty:'元',     year:1267, labor:280000, deathRate:0.10, duration:7, legitimacyDelta:-2, minxinDelta:-5, outcomes:{ prestige:+15 }, notes:'忽必烈' },
    { id:'yuan_tonghui',        name:'通惠河',       dynasty:'元',     year:1292, labor:150000, deathRate:0.08, duration:2, legitimacyDelta:+2, minxinDelta:0, outcomes:{ transport:+12 }, notes:'郭守敬' },
    { id:'ming_changcheng',     name:'明长城重修',   dynasty:'明',     year:1368, labor:400000, deathRate:0.07, duration:200, legitimacyDelta:-3, minxinDelta:-3, outcomes:{ defense:+40 }, notes:'戚继光/徐达' },
    { id:'ming_zijincheng',     name:'紫禁城',       dynasty:'明',     year:1406, labor:230000, deathRate:0.05, duration:14, legitimacyDelta:+5, minxinDelta:-2, outcomes:{ prestige:+25 }, notes:'永乐' },
    { id:'ming_yongle_dadian',  name:'永乐大典',     dynasty:'明',     year:1403, labor:3000, deathRate:0.01, duration:5, legitimacyDelta:+10, minxinDelta:+3, outcomes:{ culture:+30 }, notes:'文治' },
    { id:'ming_caoyun',         name:'大运河修',     dynasty:'明',     year:1411, labor:300000, deathRate:0.06, duration:12, legitimacyDelta:+2, minxinDelta:-2, outcomes:{ transport:+18 }, notes:'陈瑄/宋礼' },
    { id:'qing_yuanmingyuan',   name:'圆明园',       dynasty:'清',     year:1709, labor:200000, deathRate:0.04, duration:150, legitimacyDelta:-5, minxinDelta:-8, outcomes:{ prestige:+18 }, notes:'150年累修' },
    { id:'qing_chengde',        name:'承德避暑山庄', dynasty:'清',     year:1703, labor:80000, deathRate:0.03, duration:90, legitimacyDelta:+2, minxinDelta:-1, outcomes:{ prestige:+10 }, notes:'康熙' },
    { id:'qing_zhihe',          name:'治河工',       dynasty:'清',     year:1677, labor:150000, deathRate:0.06, duration:50, legitimacyDelta:+8, minxinDelta:+5, outcomes:{ disaster:-15, farmland:+10 }, notes:'靳辅/潘季驯' },
    { id:'tang_anshi_recovery', name:'安史重建',     dynasty:'唐',     year:770, labor:250000, deathRate:0.08, duration:20, legitimacyDelta:0, minxinDelta:+5, outcomes:{ farmland:+15 }, notes:'两京修缮' },
    { id:'song_yellow_shift',   name:'黄河改道堵',   dynasty:'宋',     year:1048, labor:100000, deathRate:0.15, duration:3, legitimacyDelta:-5, minxinDelta:-8, outcomes:{ disaster:-10 }, notes:'屡决屡修' },
    { id:'qing_xibei_tun',      name:'新疆屯田',     dynasty:'清',     year:1755, labor:120000, deathRate:0.10, duration:30, legitimacyDelta:+5, minxinDelta:+2, outcomes:{ defense:+8, farmland:+8 }, notes:'乾隆平准' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  [2] 9 大迁徙历史事件
  // ═══════════════════════════════════════════════════════════════════

  var MIGRATION_EVENTS_DETAIL = [
    { id:'yongjia_southward',   name:'永嘉南渡',   year:311,  scale:1000000, from:['中原'], to:['江南','荆扬'],  trigger:'heavy_war_center', legitimacyDelta:-10, culturalShift:'衣冠南渡' },
    { id:'anshi_southward',     name:'安史南迁',   year:755,  scale:2000000, from:['河北','关中'], to:['江南','荆湖'], trigger:'major_revolt', legitimacyDelta:-15, culturalShift:'江南开发' },
    { id:'jingkang_southward',  name:'靖康南渡',   year:1127, scale:5000000, from:['中原','河北'], to:['江南','两浙'], trigger:'capital_fall', legitimacyDelta:-20, culturalShift:'南北易位' },
    { id:'mongol_south',        name:'蒙古南下',   year:1279, scale:3000000, from:['中原','川陕'], to:['江南','岭南'], trigger:'conquest', legitimacyDelta:-25, culturalShift:'人口锐减' },
    { id:'hongwu_migration',    name:'洪武大移民', year:1370, scale:2500000, from:['山西','江南'], to:['华北','云南'], trigger:'policy', legitimacyDelta:+3, culturalShift:'均衡人口' },
    { id:'huguang_sichuan',     name:'湖广填四川', year:1681, scale:4000000, from:['湖广','陕西'], to:['四川'], trigger:'post_war_recovery', legitimacyDelta:+5, culturalShift:'蜀地重兴' },
    { id:'chuang_guandong',     name:'闯关东',     year:1860, scale:8000000, from:['山东','直隶'], to:['东北'], trigger:'famine_pressure', legitimacyDelta:-5, culturalShift:'满汉融合' },
    { id:'zou_xikou',           name:'走西口',     year:1850, scale:2000000, from:['山西','陕西'], to:['内蒙','甘肃'], trigger:'famine', legitimacyDelta:-3, culturalShift:'汉蒙杂居' },
    { id:'dingwu_jihuang',      name:'丁戊奇荒',   year:1877, scale:3000000, from:['华北'], to:['关东','南方'], trigger:'mega_famine', legitimacyDelta:-15, culturalShift:'千万饿死' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  [3] 七大兵制完整详表
  // ═══════════════════════════════════════════════════════════════════

  var MILITARY_SYSTEMS_DETAIL = {
    fubing_tang: {
      name:'府兵制', dynasty:'唐', era:'初唐', peakYear:634, fubing_unit:634,
      households:'均田户', selfEquipped:true, rotationYears:3,
      corps:{ '12卫':600, '折冲府':634 }, totalStrength:500000,
      collapse:'玄宗开元均田瓦解', successor:'募兵' },
    mubing_song: {
      name:'募兵制', dynasty:'宋', era:'北宋', peakYear:1068,
      paidSoldiers:true, wagePerMonth:1500, grainPerMonth:6, // 文 / 石
      corps:{ '禁军':826000, '厢军':430000, '乡兵':80000, '藩兵':50000 }, totalStrength:1386000,
      problems:['冗兵','饷银吃紧','军户化'], collapse:'靖康之乱' },
    weisuo_ming: {
      name:'卫所制', dynasty:'明', era:'初明', peakYear:1393,
      hereditary:true, landAllocation:50,  // 亩/兵
      corps:{ '在京卫':74000, '外卫':329, '守御千户所':65 },
      totalStrength:3200000, collapse:'嘉靖倭乱期已废弛', successor:'募兵（戚家军）' },
    baqi_qing: {
      name:'八旗', dynasty:'清', era:'康乾', peakYear:1700,
      hereditary:true, privileged:true,
      corps:{ '满洲八旗':250000, '蒙古八旗':100000, '汉军八旗':200000 },
      totalStrength:550000, collapse:'道光咸丰战力已废' },
    luying_qing: {
      name:'绿营', dynasty:'清', era:'康乾', peakYear:1700,
      paidSoldiers:true, hanChinese:true,
      corps:{ '标':66, '协':164, '营':1100 },
      totalStrength:630000, collapse:'太平军击溃' },
    tuanlian_qing: {
      name:'团练/湘淮军', dynasty:'清末', era:'咸丰同治', peakYear:1864,
      regional:true, local_fund:true,
      corps:{ '湘军':120000, '淮军':60000, '楚军':30000 },
      totalStrength:300000, collapse:'甲午溃灭' },
    fanzhen_tang: {
      name:'藩镇兵', dynasty:'唐后期', era:'安史之后', peakYear:780,
      autonomous:true, heritable:true,
      corps:{ '魏博':70000, '成德':50000, '卢龙':100000, '淮西':40000 },
      totalStrength:600000, collapse:'唐末五代' }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  [4] 8 朝代中期阶层比例矩阵
  // ═══════════════════════════════════════════════════════════════════

  var DYNASTY_CLASS_RATIOS = {
    '汉武':   { imperial:0.001, gentry_high:0.004, gentry_mid:0.015, scholar:0.01, merchant:0.02, landlord:0.04, peasant_self:0.55, peasant_tenant:0.25, craftsman:0.04, debased:0.02, clergy:0.005, slave:0.045 },
    '唐玄宗': { imperial:0.001, gentry_high:0.005, gentry_mid:0.02,  scholar:0.015,merchant:0.03, landlord:0.05, peasant_self:0.50, peasant_tenant:0.25, craftsman:0.05, debased:0.02, clergy:0.04,  slave:0.019 },
    '宋仁宗': { imperial:0.001, gentry_high:0.003, gentry_mid:0.02,  scholar:0.02, merchant:0.05, landlord:0.06, peasant_self:0.42, peasant_tenant:0.30, craftsman:0.06, debased:0.02, clergy:0.025, slave:0.021 },
    '元世祖': { imperial:0.002, gentry_high:0.002, gentry_mid:0.008, scholar:0.005,merchant:0.04, landlord:0.06, peasant_self:0.45, peasant_tenant:0.27, craftsman:0.05, debased:0.03, clergy:0.03,  slave:0.048 },
    '明宣宗': { imperial:0.001, gentry_high:0.004, gentry_mid:0.02,  scholar:0.015,merchant:0.04, landlord:0.05, peasant_self:0.48, peasant_tenant:0.28, craftsman:0.05, debased:0.015,clergy:0.02,  slave:0.017 },
    '清乾隆': { imperial:0.001, gentry_high:0.003, gentry_mid:0.015, scholar:0.012,merchant:0.04, landlord:0.05, peasant_self:0.43, peasant_tenant:0.32, craftsman:0.05, debased:0.015,clergy:0.025, slave:0.027 },
    '晚清':   { imperial:0.001, gentry_high:0.005, gentry_mid:0.02,  scholar:0.02, merchant:0.06, landlord:0.07, peasant_self:0.35, peasant_tenant:0.38, craftsman:0.04, debased:0.015,clergy:0.02,  slave:0.019 },
    '民国':   { imperial:0,     gentry_high:0.002, gentry_mid:0.01,  scholar:0.015,merchant:0.08, landlord:0.06, peasant_self:0.40, peasant_tenant:0.35, craftsman:0.06, debased:0.01, clergy:0.01,  slave:0.008 }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  [5] 65 条诏令预设模板（5 P0虚空）
  // ═══════════════════════════════════════════════════════════════════

  var EDICT_TEMPLATES = {
    large_corvee: [
      { id:'build_wall',         text:'筑长城千里，以御北寇',         labor:100000, years:5 },
      { id:'dig_canal',          text:'凿运河通江淮，以通漕运',       labor:200000, years:3 },
      { id:'build_palace',       text:'营建东都，以彰王道',           labor:150000, years:3 },
      { id:'dredge_yellow',      text:'塞河口决溃，以救平民',         labor:80000,  years:2 },
      { id:'build_tomb',         text:'营建皇陵，以奉先帝',           labor:120000, years:10 },
      { id:'yue_dike',           text:'筑淮堤百里，以御涝',           labor:60000,  years:3 },
      { id:'xianbao',            text:'修扩边塞城池，以御强敌',       labor:80000,  years:4 },
      { id:'xiu_caoyun',         text:'疏浚通惠河，以续漕路',         labor:40000,  years:1 },
      { id:'zhi_huai',           text:'治理淮河，以靖水患',           labor:70000,  years:3 },
      { id:'jian_si_guan',       text:'兴建驿站，以便朝廷政令',       labor:30000,  years:2 },
      { id:'kuang_shan',         text:'开国有矿山，以充军实',         labor:50000,  years:5 },
      { id:'yan_chang',          text:'拓盐场，以裕民用',             labor:40000,  years:3 },
      { id:'zu_xie',             text:'铸铁冶钢，以兴军器',           labor:30000,  years:4 }
    ],
    resettle_refugee: [
      { id:'zhaofu',             text:'敕令各路，减租免赋，招抚流民' },
      { id:'shi_zeng',           text:'拨粮万石，施以粥饭，令流民复业' },
      { id:'tun_shou',           text:'开屯所授田，令流民为佃户' },
      { id:'yi_min',             text:'准许流民入关东，耕荒自活' },
      { id:'kuangzhen',          text:'开官仓平粜，以稳粮价' },
      { id:'jiao_yi',            text:'命地方豪强出粮，以安乡里' },
      { id:'zaozou',              text:'听流民自愿入军屯，十年免税' },
      { id:'ji_nian',            text:'准流民入采矿冶铁，以资朝廷' },
      { id:'ren_shou',            text:'命各州县设收容所，临时救济' },
      { id:'you_min',            text:'遣使巡视，详察流民苦状' },
      { id:'kai_bu_jin',         text:'解除境内迁徙禁令，听流民择地安居' },
      { id:'shi_zi',             text:'对孤寡孤幼者施食赐衣' },
      { id:'fa_pin',             text:'分田一顷，以贷流民开垦' }
    ],
    garrison_tuntian: [
      { id:'ba_qi_zhu_beo',      text:'令八旗驻防边镇，以御外患' },
      { id:'jin_tun',            text:'设辽东屯田，军民合一' },
      { id:'xibei_zhu',          text:'设西北屯营，以拓边疆' },
      { id:'yun_gui_wei',        text:'增设云贵卫所，以镇土司' },
      { id:'hai_fang',           text:'增设沿海卫所，以御倭寇' },
      { id:'min_tun',            text:'开民屯于荒地，以安流民' },
      { id:'qi_tun',             text:'裁冗军置屯田，以节开支' },
      { id:'dun_tian',           text:'行"十分之三为军"的屯田制' },
      { id:'jun_jin',            text:'设军籍，令将子继父业' },
      { id:'xiang_bao',          text:'行寨堡制，以御山贼' },
      { id:'ma_zheng',           text:'设马监，以保战马' },
      { id:'an_bian',            text:'增兵安抚边陲，以息小蛮' },
      { id:'tu_gong',            text:'设屯田御营，以供军食' }
    ],
    env_policy: [
      { id:'feng_shan_yu_lin',   text:'封山育林，以御水土' },
      { id:'yi_he_shui',         text:'疏浚江河，以御洪水' },
      { id:'yu_jin_bu_lie',      text:'设渔禁期，以养育鱼苗' },
      { id:'xiu_shui_li',        text:'广修沟渠塘堰，以济灌溉' },
      { id:'tun_tian_er_dai',    text:'轮耕休田，以保地力' },
      { id:'jin_huo_shao',       text:'禁焚山烧田，以护森林' },
      { id:'zhi_yan_gan',        text:'引水淡化盐田，以防盐碱' },
      { id:'yu_gong',            text:'兴修公共卫生，以防疫病' },
      { id:'ji_wen',             text:'疏导城市排污，以清街市' },
      { id:'yang_huang',         text:'引荒地为草场，以固沙' },
      { id:'zhi_zhi',            text:'治理茔葬规矩，以净城郭' },
      { id:'xu_mu',              text:'发展畜牧轮作，以富民' },
      { id:'xing_bu',            text:'重修古道桥梁，以便行旅' }
    ],
    tax_corvee_alloc: [
      { id:'san_fen',            text:'三分法：留州三分、留使三分、上供三分' },
      { id:'qiyun_cunliu',       text:'起运存留：边镇存留多、财赋区起运多' },
      { id:'ding_se',            text:'丁银折银：役银合一，按亩摊' },
      { id:'tan_ding_ru_mu',     text:'摊丁入亩：永不加赋' },
      { id:'jian_yao',           text:'均徭：按丁田轮派，不偏一方' },
      { id:'jian_bian',          text:'一条鞭法：赋役合并征银' },
      { id:'wan_yi',             text:'万役：江南税重，诸省轻' },
      { id:'qiao_zhu_xie',       text:'桥柱协作：诸省按兵事轻重分摊' },
      { id:'di_ding_mu_ding',    text:'地丁合并：田赋包丁役' },
      { id:'ling_huo',           text:'灵活应变：战时加派，平时减征' },
      { id:'nian_jian',          text:'年定定额：各省出入长期比例稳定' },
      { id:'fei_fa_shui',        text:'废黜苛捐杂税，以纾民困' },
      { id:'zheng_dun_yin',      text:'整顿银两耗羡，规范火耗' }
    ]
  };

  // ═══════════════════════════════════════════════════════════════════
  //  [6] 30 条历代典范诏书
  // ═══════════════════════════════════════════════════════════════════

  var CLASSICAL_EDICTS = [
    { era:'秦',    name:'书同文车同轨',     decree:'书同文字，车同轨迹，度同长短', effect:'文化一统' },
    { era:'汉武',  name:'推恩令',           decree:'诸侯子弟皆可封国，以均其大国', effect:'削弱诸侯' },
    { era:'汉武',  name:'盐铁专卖',         decree:'盐铁收归大司农，以裕国用',   effect:'增收国库' },
    { era:'汉光武',name:'度田',             decree:'令州郡度田，以正赋役',         effect:'查隐户' },
    { era:'隋文帝',name:'开皇律',           decree:'废除肉刑，定五刑之制',         effect:'法治规范' },
    { era:'唐太宗',name:'贞观新律',         decree:'宽简刑罚，以息民怨',           effect:'民心归附' },
    { era:'唐太宗',name:'科举扩制',         decree:'增设进士明经，以广揽天下士',   effect:'寒门入仕' },
    { era:'唐玄宗',name:'开元新政',         decree:'整顿吏治，裁汰冗员',           effect:'官吏清明' },
    { era:'唐德宗',name:'两税法',           decree:'取消租庸调，夏秋两税合一',     effect:'赋役简化' },
    { era:'宋仁宗',name:'庆历新政',         decree:'革弊除旧，以强国本',           effect:'半途而废' },
    { era:'宋神宗',name:'王安石变法',       decree:'青苗均输免役保甲方田',         effect:'党争激烈' },
    { era:'宋神宗',name:'熙宁市易法',       decree:'设市易司，调节物价',           effect:'抑商贾' },
    { era:'明太祖',name:'大诰三编',         decree:'严刑峻法，以治吏治',           effect:'官吏生畏' },
    { era:'明太祖',name:'黄册制度',         decree:'十年大造黄册，以正户口',       effect:'户籍精化' },
    { era:'明太祖',name:'鱼鳞图册',         decree:'量田造册，以正田赋',           effect:'税基精化' },
    { era:'明英宗',name:'北狩之耻',         decree:'被虏于土木堡，兵祸大作',       effect:'朝纲震动' },
    { era:'明世宗',name:'议礼之争',         decree:'大礼议，廷争七年',             effect:'权臣跌宕' },
    { era:'明神宗',name:'张居正改革',       decree:'一条鞭法，考成法',             effect:'十年鼎盛' },
    { era:'明熹宗',name:'东林党议',         decree:'党争激化，阉党肆虐',           effect:'朝纲大乱' },
    { era:'清康熙',name:'平三藩',           decree:'平吴三桂等三藩之乱',           effect:'重稳江山' },
    { era:'清康熙',name:'治河兴漕',         decree:'重用靳辅，治河三十年',         effect:'民田丰登' },
    { era:'清康熙',name:'滋生人丁永不加赋', decree:'以康熙五十年丁额为准',         effect:'人口滋生' },
    { era:'清雍正',name:'摊丁入亩',         decree:'丁银摊入田赋',                 effect:'农民不流' },
    { era:'清雍正',name:'火耗归公',         decree:'火耗归公以养廉',               effect:'吏治暂清' },
    { era:'清雍正',name:'改土归流',         decree:'废西南土司，改设流官',         effect:'稳定边疆' },
    { era:'清乾隆',name:'四库全书',         decree:'敕编四库全书',                 effect:'文化巨典' },
    { era:'清嘉庆',name:'白莲教乱',         decree:'镇压白莲教起义',               effect:'国力损耗' },
    { era:'清咸丰',name:'太平天国',         decree:'镇压太平军，起用湘淮',         effect:'地方势起' },
    { era:'清同治',name:'洋务兴起',         decree:'师夷长技以制夷',               effect:'自强运动' },
    { era:'清光绪',name:'戊戌变法',         decree:'推行新政，百日而终',           effect:'保守反扑' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  [7] 抗疏 12 条历史典范
  // ═══════════════════════════════════════════════════════════════════

  var ABDUCTION_CLASSICAL_CASES = [
    { era:'汉',  objector:'汲黯',     emperor:'汉武帝',   topic:'谏汉武帝贪武',  outcome:'贬郡' },
    { era:'汉',  objector:'东方朔',   emperor:'汉武帝',   topic:'谏方士求仙',    outcome:'主不纳' },
    { era:'唐',  objector:'魏征',     emperor:'唐太宗',   topic:'十思疏',        outcome:'帝从之，封郡公' },
    { era:'唐',  objector:'狄仁杰',   emperor:'武则天',   topic:'请复唐室',       outcome:'武后默许' },
    { era:'宋',  objector:'包拯',     emperor:'宋仁宗',   topic:'弹劾亲贵',      outcome:'罢免' },
    { era:'宋',  objector:'司马光',   emperor:'宋神宗',   topic:'反对新法',       outcome:'罢相' },
    { era:'明',  objector:'于谦',     emperor:'明英宗',   topic:'谏天子不北狩',   outcome:'英宗不听，后诬杀' },
    { era:'明',  objector:'海瑞',     emperor:'明世宗',   topic:'直言天子失德',   outcome:'下狱' },
    { era:'明',  objector:'东林诸公', emperor:'明神宗',   topic:'争国本',         outcome:'党争大兴' },
    { era:'明',  objector:'杨涟',     emperor:'明熹宗',   topic:'弹劾魏忠贤',     outcome:'下狱死' },
    { era:'清',  objector:'张廷玉',   emperor:'乾隆',     topic:'谏乾隆奢靡',     outcome:'削爵' },
    { era:'清',  objector:'黄爵滋',   emperor:'道光',     topic:'严禁鸦片',       outcome:'纳，后败' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  [8] 9 套制度模板
  // ═══════════════════════════════════════════════════════════════════

  var INSTITUTION_TEMPLATES = {
    qin: { era:'秦', centralize:1.0, fubing:false, mubing:false, weisuo:false, keju:false, huangce:false, baojia:true, taxMode:'tang_three' },
    han_early: { era:'西汉前', centralize:0.6, feudal:true, fubing:true, tax:'suantu' },
    tang_early: { era:'唐初', centralize:0.85, fubing:true, kejuEarly:true, tax:'租庸调' },
    tang_mid: { era:'唐中后', centralize:0.5, fanzhen:true, liangshui:true },
    song: { era:'宋', centralize:0.9, mubing:true, keju:true, fubingless:true },
    yuan: { era:'元', centralize:0.7, zhiqu:true, tuttouxia:true },
    ming: { era:'明', centralize:0.85, weisuo:true, huangce:true, kejuRigid:true },
    qing: { era:'清', centralize:0.9, baqi:true, luying:true, baojia:true, tuoding:true },
    modern: { era:'近代', centralize:0.5, newArmy:true, kejuAbolished:true }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  [9] B3 徭役死亡率四维公式（替换 huji-deep-fill 的简化版）
  // ═══════════════════════════════════════════════════════════════════

  function computeCorveeDeathRateDetailed(opts) {
    opts = opts || {};
    var workType = opts.workType || 'general';
    var region = opts.region || {};
    var season = opts.season || 'spring';
    var food = opts.foodAvailable !== undefined ? opts.foodAvailable : 0.8;
    // 工种系数
    var workMod = { junyi:2.0, gongyi:1.0, caoyi:0.8, zhuzao:1.5, tunken:1.0, yuanzheng:3.0, yizhan:0.6, zahu:0.5, lingli:0.3, baojia:0.1 }[workType] || 1.0;
    // 地理危险系数
    var geoMod = 1.0;
    if (region.malaria) geoMod *= 1.8;
    if (region.cold) geoMod *= 1.4;
    if (region.rough) geoMod *= 1.3;
    if (region.waterHazard) geoMod *= 1.5;
    // 季节系数
    var seasonMod = { spring:1.0, summer:1.3, autumn:0.9, winter:1.5 }[season] || 1.0;
    // 食物供应
    var foodMod = food < 0.4 ? 2.5 : food < 0.6 ? 1.8 : food < 0.8 ? 1.2 : 1.0;
    // 督役严厉度
    var oversightMod = opts.oversightStrict ? 1.2 : opts.oversightLax ? 0.9 : 1.0;
    return Math.min(0.4, 0.005 * workMod * geoMod * seasonMod * foodMod * oversightMod);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  [10] B5 逃役五因子
  // ═══════════════════════════════════════════════════════════════════

  function computeEscapeFactorDetailed() {
    var G = global.GM;
    if (!G.population || !G.population.corvee) return 0;
    var burden = (G.population.corvee.annualCorveeDays || 30) / 30;
    var corruptLevel = (G.corruption && (G.corruption.overall || G.corruption.trueIndex)) || 30;
    var hwVal = (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.getHuangweiValue) ? global.AuthorityEngines.getHuangweiValue() : 50;
    var unrest = G.unrest || 30;
    var wars = (G.activeWars || []).length;
    // 1. 负担因子
    var burdenF = Math.max(0, Math.min(0.3, (burden - 1) * 0.5));
    // 2. 腐败因子（腐败高→监管弱→易逃）
    var corruptF = Math.max(0, corruptLevel / 400);
    // 3. 执法因子（皇威低→督役弱→易逃）
    var enforceF = hwVal < 40 ? 0.08 : hwVal < 60 ? 0.03 : 0;
    // 4. 治安因子
    var safetyF = unrest > 70 ? 0.1 : unrest > 50 ? 0.04 : 0;
    // 5. 机会因子（战乱→易出逃）
    var opportunityF = wars > 0 ? 0.05 + wars * 0.01 : 0.02;
    return Math.min(0.25, burdenF + corruptF + enforceF + safetyF + opportunityF);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  [11] D2 年龄金字塔精细化（11 层细分 + newlyAdult/leavingDing）
  // ═══════════════════════════════════════════════════════════════════

  function _initAgePyramidFine() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.agePyramidFine) return;
    var total = G.population.national.mouths;
    // 11 层（0-10 / 11-20 / ... / 71+）
    var distribution = [0.20, 0.18, 0.15, 0.13, 0.11, 0.10, 0.08, 0.05];
    var layers = ['age_0_10','age_11_20','age_21_30','age_31_40','age_41_50','age_51_60','age_61_70','age_71_plus'];
    G.population.agePyramidFine = {};
    layers.forEach(function(k, i) { G.population.agePyramidFine[k] = Math.round(total * distribution[i]); });
    G.population.agePyramidFine._newlyAdult = 0;   // 本回合新达丁龄
    G.population.agePyramidFine._leavingDing = 0;  // 本回合满 60 脱丁
  }

  function tickAgePyramidFine(mr) {
    _initAgePyramidFine();
    var G = global.GM;
    var pyramid = G.population.agePyramidFine;
    if (!pyramid) return;
    // 0.5 岁 / 月（简化）
    var totalMouths = G.population.national.mouths;
    var dingAgeMin = (G.population.corvee && G.population.corvee.dingAgeMin) || 16;
    // 计算新成丁（age_11_20 层中达到 dingAgeMin 的比例）
    var newlyAdultRate = mr / 120;
    var newlyAdult = Math.round(pyramid.age_11_20 * newlyAdultRate);
    pyramid._newlyAdult = newlyAdult;
    // 脱丁（age_51_60 层每月有部分满 60）
    var leavingDing = Math.round(pyramid.age_51_60 * (mr / 120));
    pyramid._leavingDing = leavingDing;
    // 更新总丁（如 G.population.ding 存在）
    if (G.population.national.ding !== undefined) {
      G.population.national.ding += newlyAdult - leavingDing;
      G.population.national.ding = Math.max(0, G.population.national.ding);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  [12] D5 迁徙通道成本
  // ═══════════════════════════════════════════════════════════════════

  var MIGRATION_PATHWAY_COST = {
    'central_jiangnan':   { distance:800, transport:'land',   banditry:0.05, cost:80 },
    'capital_surround':   { distance:200, transport:'land',   banditry:0.02, cost:20 },
    'north_northeast':    { distance:1500,transport:'pass',   banditry:0.15, cost:180 },
    'south_sw':           { distance:1200,transport:'land',   banditry:0.20, cost:150 },
    'yangtze_crossing':   { distance:0,   transport:'water',  banditry:0.10, cost:40 },
    'grand_canal':        { distance:1800,transport:'water',  banditry:0.03, cost:60 },
    'xibei_guanzhong':    { distance:1000,transport:'land',   banditry:0.12, cost:120 }
  };

  function computeMigrationCost(pathwayId, peopleCount) {
    var p = MIGRATION_PATHWAY_COST[pathwayId];
    if (!p) return peopleCount * 50;
    return peopleCount * p.cost * (1 + p.banditry);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  [13] D6 京畿虹吸四因子
  // ═══════════════════════════════════════════════════════════════════

  function computeCapitalPullDetailed() {
    var G = global.GM;
    var capital = G._capital || '京城';
    // 1. 官职吸力（大京官多 → 吸士人）
    var officialCount = (G.chars || []).filter(function(c) {
      return c.alive !== false && c.officialTitle && _isSameLocation(c.location, capital);
    }).length;
    var officialF = officialCount / 200;
    // 2. 商业吸力（都商税多 → 吸商人）
    var commerceF = G.currency && G.currency.market && G.currency.market.grainPrice < 120 ? 0.3 : 0.1;
    // 3. 文化吸力（太学/国子监 → 吸学子）
    var culturalF = (G.huangwei && G.huangwei.index > 70) ? 0.4 : 0.2;
    // 4. 治安吸力（京城治安好 → 吸流民）
    var safetyF = (G.unrest || 30) < 40 ? 0.3 : 0.1;
    return {
      officialPull: officialF,
      commercePull: commerceF,
      culturalPull: culturalF,
      safetyPull: safetyF,
      total: officialF * 0.3 + commerceF * 0.25 + culturalF * 0.25 + safetyF * 0.2
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  [14] 瘟疫 / 战亡独立字段
  // ═══════════════════════════════════════════════════════════════════

  function _initPlagueWarFields() {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.plagueEvents) G.population.plagueEvents = [];
    if (!G.population.warCasualties) G.population.warCasualties = [];
  }

  function recordPlague(scale, region, cause) {
    _initPlagueWarFields();
    var G = global.GM;
    G.population.plagueEvents.push({
      turn: G.turn || 0,
      scale: scale,
      region: region || 'national',
      cause: cause || '瘟疫',
      deaths: scale
    });
    G.population.national.mouths = Math.max(100000, G.population.national.mouths - scale);
    if (global.addEB) global.addEB('瘟疫', (region || '各地') + '大疫，殒 ' + Math.round(scale) + ' 口');
  }

  function recordWarCasualty(scale, warName, side) {
    _initPlagueWarFields();
    var G = global.GM;
    G.population.warCasualties.push({
      turn: G.turn || 0,
      scale: scale,
      warName: warName || '',
      side: side || 'own'
    });
    G.population.national.mouths = Math.max(100000, G.population.national.mouths - scale);
    if (G.population.national.ding) G.population.national.ding = Math.max(0, G.population.national.ding - Math.round(scale * 0.6));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  [15] 制度 7 阶段生命周期
  // ═══════════════════════════════════════════════════════════════════

  var INSTITUTION_LIFECYCLE_STAGES = {
    proposal:   { name:'提议',    nextStages:['tingyi','abolished'] },
    tingyi:     { name:'廷议',    nextStages:['trial','abolished'] },
    trial:      { name:'试行',    nextStages:['partial','national','abolished'] },
    partial:    { name:'部分推广',nextStages:['national','failing','abolished'] },
    national:   { name:'全国施行',nextStages:['failing','abolished'] },
    failing:    { name:'日渐松弛',nextStages:['abolished','national'] },
    abolished:  { name:'废止',    nextStages:[] }
  };

  function advanceInstitution(inst, newStage) {
    if (!inst || !INSTITUTION_LIFECYCLE_STAGES[inst.stage]) return false;
    var allowed = INSTITUTION_LIFECYCLE_STAGES[inst.stage].nextStages;
    if (allowed.indexOf(newStage) < 0) return false;
    inst.stage = newStage;
    inst.stageTurn = (global.GM && global.GM.turn) || 0;
    inst.history = inst.history || [];
    inst.history.push({ turn: inst.stageTurn, stage: newStage });
    if (global.addEB) global.addEB('制度', (inst.name || '某制度') + ' → ' + INSTITUTION_LIFECYCLE_STAGES[newStage].name);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  集成：主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { tickAgePyramidFine(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'hist] agePyramid:') : console.error('[hist] agePyramid:', e); }
    try { _initPlagueWarFields(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-historical-presets');}catch(_){}}
  }

  function init() {
    _initAgePyramidFine();
    _initPlagueWarFields();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文（富化版）
  // ═══════════════════════════════════════════════════════════════════

  function getHistoricalAIContext() {
    var G = global.GM;
    if (!G) return '';
    var lines = [];
    if (G.population && G.population.plagueEvents) {
      var recentPlagues = G.population.plagueEvents.filter(function(p) { return (G.turn - p.turn) < 12; });
      if (recentPlagues.length > 0) lines.push('【疫】近一年 ' + recentPlagues.length + ' 次，殒 ' + recentPlagues.reduce(function(s,p){return s+p.scale;},0) + ' 口');
    }
    if (G.population && G.population.warCasualties) {
      var recentWars = G.population.warCasualties.filter(function(w) { return (G.turn - w.turn) < 12; });
      if (recentWars.length > 0) lines.push('【战亡】近一年 ' + recentWars.reduce(function(s,w){return s+w.scale;},0) + ' 亡');
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  剧本覆盖 —— 允许 scriptData.customPresets 扩展/替换预设
  //  策略：若剧本提供同 id 则替换；剧本新增 id 则追加
  // ═══════════════════════════════════════════════════════════════════

  function _mergeArrayById(base, overrides) {
    if (!Array.isArray(overrides) || overrides.length === 0) return base;
    var map = {};
    base.forEach(function(x){ if (x && x.id) map[x.id] = x; });
    overrides.forEach(function(x){ if (x && x.id) map[x.id] = Object.assign({}, map[x.id]||{}, x); });
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  function _mergeObjectPresets(base, overrides) {
    if (!overrides || typeof overrides !== 'object') return base;
    var out = Object.assign({}, base);
    Object.keys(overrides).forEach(function(k){ out[k] = Object.assign({}, out[k]||{}, overrides[k]); });
    return out;
  }
  function getGreatCorveeProjects() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeArrayById(GREAT_CORVEE_PROJECTS, cps.corveeProjects);
  }
  function getMigrationEventsDetail() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeArrayById(MIGRATION_EVENTS_DETAIL, cps.migrationEvents);
  }
  function getMilitarySystemsDetail() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeObjectPresets(MILITARY_SYSTEMS_DETAIL, cps.militarySystems);
  }
  function getClassicalEdicts() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeArrayById(CLASSICAL_EDICTS, cps.classicalEdicts);
  }
  function getInstitutionTemplates() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeObjectPresets(INSTITUTION_TEMPLATES, cps.institutionTemplates);
  }
  function getAbductionCases() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeArrayById(ABDUCTION_CLASSICAL_CASES, cps.abductionCases);
  }
  function getEdictTemplates() {
    var sd = global.scriptData || {};
    var cps = sd.customPresets || {};
    return _mergeObjectPresets(EDICT_TEMPLATES, cps.edictTemplates);
  }

  global.HistoricalPresets = {
    init: init,
    tick: tick,
    getAIContext: getHistoricalAIContext,
    GREAT_CORVEE_PROJECTS: GREAT_CORVEE_PROJECTS,
    MIGRATION_EVENTS_DETAIL: MIGRATION_EVENTS_DETAIL,
    MILITARY_SYSTEMS_DETAIL: MILITARY_SYSTEMS_DETAIL,
    // 动态访问（支持剧本 scriptData.customPresets 覆盖）
    getGreatCorveeProjects: getGreatCorveeProjects,
    getMigrationEventsDetail: getMigrationEventsDetail,
    getMilitarySystemsDetail: getMilitarySystemsDetail,
    getClassicalEdicts: getClassicalEdicts,
    getInstitutionTemplates: getInstitutionTemplates,
    getAbductionCases: getAbductionCases,
    getEdictTemplates: getEdictTemplates,
    DYNASTY_CLASS_RATIOS: DYNASTY_CLASS_RATIOS,
    EDICT_TEMPLATES: EDICT_TEMPLATES,
    CLASSICAL_EDICTS: CLASSICAL_EDICTS,
    ABDUCTION_CLASSICAL_CASES: ABDUCTION_CLASSICAL_CASES,
    INSTITUTION_TEMPLATES: INSTITUTION_TEMPLATES,
    INSTITUTION_LIFECYCLE_STAGES: INSTITUTION_LIFECYCLE_STAGES,
    MIGRATION_PATHWAY_COST: MIGRATION_PATHWAY_COST,
    computeCorveeDeathRateDetailed: computeCorveeDeathRateDetailed,
    computeEscapeFactorDetailed: computeEscapeFactorDetailed,
    computeMigrationCost: computeMigrationCost,
    computeCapitalPullDetailed: computeCapitalPullDetailed,
    recordPlague: recordPlague,
    recordWarCasualty: recordWarCasualty,
    advanceInstitution: advanceInstitution,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
