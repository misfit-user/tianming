// 天启剧本·辽东都指挥使司·关宁东江 8 块（关宁七城堡，皮岛一块分四本账）
//
// 天启七年九月：辽东腹地早已尽失，明军只守山海关至锦州的关宁防线与朝鲜海外的东江诸岛。
// 今年正月后金兵入朝鲜（丁卯之役），东江陆上据点铁山等处被焚；五月皇太极攻宁远、锦州不克（宁锦之战），
// 七月袁崇焕去职。关宁与东江都是兵多民少、仰给辽饷与登莱海运的地方，没有州县户口可据。
// 本省权重：直接按驻军与随军家口、难民的估数给出，宁远、山海关最多，锦州次之，三座屯堡与觉华岛各一二万；
// 皮岛一块驻东江本营并收拢辽东难民，四本账按岛上本营、鸭绿江口诸岛、铁山、镇江堡的轻重分。
// 税粮与田亩按关外屯田：宁远、锦州两城屯田最多；东江诸岛少有耕地，粮饷靠海运。
// 剧本原来写在各块灾异里的「辽饷拖欠」「边民逃散」不是灾害，改写进描述，不再记为灾异。
// 盐、马两项省里只有零头，按沿海与骑兵驻地分给各块以守总数，不标产区（标了产区引擎会按人口重算产量）。
'use strict';

const { block } = require('./lib-blocks');

// 家口按每户约 5.2 口计；户数与口数同权
const unit = (name, mouths, grain, land, countyCount, extra) => Object.assign({
  name, countyCount, weights: { pop: mouths, households: mouths, grain, land }
}, extra || {});

const UNITS = [
  unit('山海关', 90000, 12, 12, 3, { basis: '关城驻军与关内外避难辽民约 9 万口；驿路三站。' }),
  unit('宁远城', 100000, 18, 20, 2, { basis: '宁远镇兵与屯田军户约 10 万口；袁崇焕以来屯田最多。' }),
  unit('锦州城', 60000, 10, 15, 1, { basis: '锦州守军与屯民约 6 万口；大凌河以南屯田。' }),
  unit('松山堡', 20000, 3, 4, 0.5, { basis: '屯堡守军与家口约 2 万口。' }),
  unit('杏山堡', 15000, 2, 3, 0.5, { basis: '屯堡守军与家口约 1.5 万口。' }),
  unit('塔山堡', 15000, 2, 3, 0.5, { basis: '屯堡守军与家口约 1.5 万口。' }),
  unit('觉华岛', 20000, 2, 1, 0.5, { basis: '海运粮储与水营约 2 万口；岛上少田。' }),
  unit('皮岛·原账分项', 180000, 8, 6, 1, { block: '皮岛·原账分项', basis: '东江本营与收拢的辽东难民约 18 万口；诸岛少田，粮饷仰给登莱海运。' })
];

const BLOCKS = {
  山海关: block({
    name: '山海关', terrain: '边塞', divisionType: '关', regionType: 'frontier_defense',
    officialPosition: '山海关总兵', governor: '赵率教', specialResources: '屯粮·商旅·海盐', tags: {},
    description: '天下第一关，关城北倚角山、南临渤海，是京师的东大门；督师与总兵驻节于此，关外辽民避难入关者络绎不绝，辽饷转运也从这里出关。',
    commerce: 1.4, fishing: 0, salt: 0.3, horse: 0.3, maritime: 0.1, corridor: 1.5, keju: 0,
    idx: [42, 58, 40, 40, 58, 50, 80, 54], fisc: [0.72, 0.18],
    notes: '山海关总兵赵率教（剧本人物）。'
  }),
  宁远城: block({
    name: '宁远城', terrain: '边塞', divisionType: '城', regionType: 'frontier_defense',
    officialPosition: '宁远总兵', governor: '满桂', specialResources: '屯粮·火炮·马', tags: {},
    description: '关外重镇。天启六年正月袁崇焕凭坚城与西洋大炮击退努尔哈赤，今年五月又挫皇太极于城下；袁崇焕已于七月去职，满桂以总兵守城，修城屯田不辍，欠饷之怨时起。',
    commerce: 1.2, fishing: 0, salt: 0.4, horse: 0.4, maritime: 0.1, corridor: 1.3, keju: 0,
    idx: [44, 56, 36, 36, 56, 50, 90, 54], fisc: [0.72, 0.18],
    notes: '宁远大捷（天启六年正月）；宁锦之战（天启七年五月）。'
  }),
  锦州城: block({
    name: '锦州城', terrain: '边塞', divisionType: '城', regionType: 'frontier_defense',
    officialPosition: '副总兵', specialResources: '屯粮·马', tags: {},
    description: '关宁防线的最前沿。今年五月皇太极以大军围城二十余日，赵率教、左辅等力战不下，城垣残破，正在修复；北面大凌河以外已是后金地界。',
    commerce: 0.8, fishing: 0, horse: 0.3, corridor: 1.2, keju: 0,
    idx: [36, 58, 26, 26, 64, 48, 95, 56], fisc: [0.70, 0.18],
    notes: '宁锦之战中锦州被围。'
  }),
  松山堡: block({
    name: '松山堡', terrain: '边塞', divisionType: '堡', regionType: 'frontier_defense',
    officialPosition: '守备', specialResources: '屯粮', tags: {},
    description: '锦州南面的屯堡，与杏山、塔山连成一线，是锦州与宁远之间的中继，屯军守备、转运粮草。',
    commerce: 0.6, fishing: 0, corridor: 1.2, keju: 0,
    idx: [36, 58, 24, 24, 62, 48, 88, 56], fisc: [0.70, 0.18],
    notes: '锦宁之间屯堡。'
  }),
  杏山堡: block({
    name: '杏山堡', terrain: '边塞', divisionType: '堡', regionType: 'frontier_defense',
    officialPosition: '守备', specialResources: '屯粮', tags: {},
    description: '松山与塔山之间的小堡，锦宁驿路所经，屯兵转运粮草，敌骑南下时首当其冲。',
    commerce: 0.6, fishing: 0, corridor: 1.2, keju: 0,
    idx: [36, 58, 24, 24, 62, 48, 86, 56], fisc: [0.70, 0.18],
    notes: '锦宁之间屯堡。'
  }),
  塔山堡: block({
    name: '塔山堡', terrain: '边塞', divisionType: '堡', regionType: 'frontier_defense',
    officialPosition: '守备', specialResources: '屯粮', tags: {},
    description: '宁远以北的屯堡，扼锦宁驿路，与杏山、松山互为声援。',
    commerce: 0.6, fishing: 0, corridor: 1.2, keju: 0,
    idx: [36, 58, 24, 24, 62, 48, 86, 56], fisc: [0.70, 0.18],
    notes: '锦宁之间屯堡。'
  }),
  觉华岛: block({
    name: '觉华岛', terrain: '岛屿', divisionType: '岛', regionType: 'frontier_defense',
    officialPosition: '游击', specialResources: '海运粮储', tags: { hasPort: true },
    description: '宁远海外的岛屿，关宁粮草由海运囤积于此。天启六年正月后金骑兵踏冰渡海，焚毁粮囤、屠戮守军与商民，至今仍在重建。',
    commerce: 0.8, fishing: 0, salt: 0.3, maritime: 0.3, corridor: 0.8, keju: 0,
    idx: [34, 58, 22, 22, 62, 48, 80, 56], fisc: [0.70, 0.18],
    notes: '天启六年觉华岛之役。'
  }),
  '皮岛·原账分项': block({
    name: '皮岛·原账分项', terrain: '岛屿', divisionType: '岛', regionType: 'frontier_defense',
    officialPosition: '东江总兵', governor: '毛文龙', specialResources: '海运粮饷·人参·貂皮', tags: { hasPort: true },
    description: '朝鲜西北海中的皮岛（椵岛），东江总兵毛文龙以此为根据，收拢辽东难民，时出偏师袭扰后金后方；今年正月后金兵入朝鲜，铁山等陆上据点被焚，军民退守海岛，粮饷仰给登莱海运，虚报兵额之议渐起。',
    commerce: 1.4, fishing: 0, maritime: 0.5, corridor: 1.0, keju: 0, flee: 2.0,
    idx: [34, 64, 30, 30, 70, 50, 85, 62], fisc: [0.68, 0.20],
    accounts: [
      { name: '皮岛', weight: 0.45, divisionType: '岛', terrain: '岛屿', officialPosition: '东江总兵', governor: '毛文龙',
        specialResources: '海运粮饷·人参·貂皮',
        description: '东江镇本营所在的海岛，毛文龙开府于此；登莱商船与朝鲜商旅往来，人参、貂皮在岛上转卖，军民杂处。' },
      { name: '鸭绿江口', weight: 0.30, divisionType: '要地', terrain: '岛屿', officialPosition: '游击',
        specialResources: '渔盐·海运',
        description: '鸭绿江入海口外的身弥岛、獐子岛诸岛，辽东难民聚居，以渔捞与海运接济为生，常受后金兵隔海窥伺。' },
      { name: '铁山', weight: 0.15, divisionType: '要地', terrain: '沿海', officialPosition: '游击',
        specialResources: '屯粮',
        description: '朝鲜平安道铁山一带，东江旧日屯驻之地；今年正月后金兵掠朝鲜时遭焚掠，残部散守沿海。' },
      { name: '镇江堡', weight: 0.10, divisionType: '堡', terrain: '边塞', officialPosition: '守备',
        specialResources: '屯粮',
        description: '鸭绿江西岸的旧堡，天启元年毛文龙奇袭夺回，旋即失守，此后为东江与后金反复争夺之地。' }
    ],
    notes: '东江镇；丁卯之役（天启七年正月）。'
  })
};

const regionMeans = { development: 32, unrest: 62, taxPressure: 49, armyPressure: 83, officeRisk: 56 };

module.exports = { province: '辽东都指挥使司·关宁东江', UNITS, BLOCKS, regionMeans };
