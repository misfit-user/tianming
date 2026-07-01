// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-reform-presets-history.js — Stage 2·Phase L·Slice L10·历史改革 trigger pack
 *
 * 13 个真历史改革 hardcode preset·跨 6 era (han/tang/song/yuan/ming/qing)·
 * user 一键 fill 入 L2 改革面板 draft·走现 L7 commit / L8 evolve / L9 命名 path。
 *
 * 暴露·
 *   L10_PRESETS                — 13 preset array
 *   ERA_LABEL_ZH               — era → 中文 label map
 *   _kjpL10FilterByEra(eraKey) — filter helper·invalid era fallback all
 *   _kjpL10EraLabel(eraKey)    — era → 中文 display
 *
 * red line·
 *   - 复用·preset 跟 L7 entry schema + L9 canonicalName 兼容
 *   - 失败禁玄幻·13 preset 全真历史 (王安石/张相/戊戌等)·无虚构
 *   - 工具型·preset 是 zero-cost fill·后续走 L7 系统型 commit·两者分明
 *   - flag gate·P.conf.useNewKejuL10 !== false（默认开）·仅显式设 =false 才全 no-op
 *
 * 跟 L7 entry shape 兼容·apply 后 entry.canonicalName / historicalEvaluation 直 set·skip L9 LLM
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·ERA_LABEL_ZH·v2·B3 fix·era key → 中文 display
  // ════════════════════════════════════════════════════════════════

  var ERA_LABEL_ZH = {
    han: '汉', tang: '唐', song: '宋',
    yuan: '元', ming: '明', qing: '清'
  };

  // ════════════════════════════════════════════════════════════════
  // §1·L10_PRESETS·13 真历史改革 hardcode
  //   schema 跟 L7 entry 兼容·L9 canonicalName 跟 historicalEvaluation 直 set
  //   magnitudeParsed 必 ship·v2·C2 fix·skip L3 LLM 重解
  // ════════════════════════════════════════════════════════════════

  var L10_PRESETS = [

    // 1·汉武帝察举·-134·科举之祖·孝廉为科·郡国岁举
    {
      id: 'han_chaju',
      era: 'han',
      canonicalName: '察举孝廉立',
      historicalEvaluation: '汉武元光·郡国岁举孝廉·士庶通显之始·后世科举之祖',
      by: '汉武帝',
      year: -134,
      method: 'edict',
      magnitudeDescriptor: '立察举孝廉·郡国岁举二人',
      magnitudeDescriptorPreset: 'han_chaju',
      magnitudeParsed: {
        scale: 'major', radical: 60, years: 100, reversible: false,
        tags: ['institution_init', 'recruit_reform'],
        paraphrase: '岁郡国举孝廉'
      },
      diff: {
        subjects: {
          added: [
            { id: 'xiaolian', name: '孝廉', weight: 60, ideology: 'traditional',
              format: '郡国岁举·选孝行廉洁', historicalAnalog: '汉武帝·元光元年' }
          ]
        },
        ideology: 'traditional'
      },
      _l10HistoricalContext: '武帝元光元年·令郡国岁举孝廉各一人·察举制立'
    },

    // 2·唐德宗建中四科·783·选举多元
    {
      id: 'tang_jianzhong4',
      era: 'tang',
      canonicalName: '建中四科',
      historicalEvaluation: '德宗建中·诏举四科·选才有方·然制久而玩·士虚名·不重实',
      by: '唐德宗',
      year: 783,
      method: 'council',
      magnitudeDescriptor: '加四科·体用·经史·吏理·隐逸',
      magnitudeDescriptorPreset: 'tang_jianzhong4',
      magnitudeParsed: {
        scale: 'moderate', radical: 35, years: 15, reversible: true,
        tags: ['multi_subject', 'recruit_diversify'],
        paraphrase: '诏举四科'
      },
      diff: {
        subjects: {
          added: [
            { id: 'tiyong', name: '体用科', weight: 15, ideology: 'practical',
              format: '论体用兼茂', historicalAnalog: '德宗·建中四年' },
            { id: 'jingshi', name: '经史科', weight: 15, ideology: 'traditional',
              format: '经史教化', historicalAnalog: '德宗·建中四年' },
            { id: 'liili', name: '吏理科', weight: 15, ideology: 'practical',
              format: '详闲吏理', historicalAnalog: '德宗·建中四年' },
            { id: 'yinyi', name: '隐逸科', weight: 10, ideology: 'traditional',
              format: '隐居丘园·荐举', historicalAnalog: '德宗·建中四年' }
          ]
        }
      },
      _l10HistoricalContext: '建中四年·德宗诏举四科·然士虚名·制久而玩'
    },

    // 3·宋范仲淹庆历新政·1043·重经术轻诗赋·一年罢
    {
      id: 'song_qingli',
      era: 'song',
      canonicalName: '庆历新政',
      historicalEvaluation: '范仲淹主十事·新政·重经术轻诗赋·一年而罢·士论惜之',
      by: '范仲淹',
      year: 1043,
      method: 'council',
      magnitudeDescriptor: '改科举·重策论·明经术',
      magnitudeDescriptorPreset: 'song_qingli',
      magnitudeParsed: {
        scale: 'moderate', radical: 45, years: 1, reversible: true,
        tags: ['examiner_reform', 'short_lived', 'ideology_shift'],
        paraphrase: '重经术轻诗赋'
      },
      diff: {
        ideology: 'practical'
      },
      _l10HistoricalContext: '庆历三年·范仲淹献十事疏·新政推 7 月而罢·新法仅存科举改'
    },

    // 4·宋王安石熙宁变法·1071·三经新义·罢诗赋
    {
      id: 'song_xining',
      era: 'song',
      canonicalName: '熙宁变法',
      historicalEvaluation: '王安石主新法·三经新义·罢诗赋·朝议沸·元祐尽罢·后世评两极',
      by: '王安石',
      year: 1071,
      method: 'edict',
      magnitudeDescriptor: '罢诗赋·改新义·急除积弊',
      magnitudeDescriptorPreset: 'song_xining',
      magnitudeParsed: {
        scale: 'major', radical: 85, years: 30, reversible: true,
        tags: ['radical', 'subject_change', 'ideology_shift'],
        paraphrase: '罢诗赋·改三经新义'
      },
      diff: {
        subjects: {
          added: [
            { id: 'sjxy', name: '三经新义', weight: 35, ideology: 'reformist',
              format: '新经义·政论', historicalAnalog: '熙宁·王安石' }
          ],
          removed: [{ id: 'shi', name: '诗赋' }]
        },
        ideology: 'reformist'
      },
      _l10HistoricalContext: '熙宁四年·王安石以参知政事推新法·三经新义出·罢诗赋'
    },

    // 5·宋司马光元祐更化·1086·罢新法·复诗赋
    {
      id: 'song_yuanyou_genghua',
      era: 'song',
      canonicalName: '元祐更化',
      historicalEvaluation: '司马光主·罢新法·复诗赋·熙宁尽颠·后嗣崇宁党禁起·北宋衰',
      by: '司马光',
      year: 1086,
      method: 'edict',
      magnitudeDescriptor: '罢新义·复诗赋·全面更化',
      magnitudeDescriptorPreset: 'song_yuanyou_genghua',
      magnitudeParsed: {
        scale: 'major', radical: 80, years: 8, reversible: true,
        tags: ['rollback', 'restoration', 'ideology_shift'],
        paraphrase: '罢新义·复诗赋'
      },
      diff: {
        subjects: {
          added: [
            { id: 'shi', name: '诗赋', weight: 35, ideology: 'traditional',
              format: '诗赋古文', historicalAnalog: '唐宋·诗赋' }
          ],
          removed: [{ id: 'sjxy', name: '三经新义' }]
        },
        ideology: 'traditional'
      },
      _l10HistoricalContext: '元祐元年·哲宗即位·宣仁后听政·司马光罢相·更化'
    },

    // 6·宋章惇绍圣新法·1094·复王安石·激党争
    {
      id: 'song_shaosheng_xinfa',
      era: 'song',
      canonicalName: '绍圣新法',
      historicalEvaluation: '章惇主·复王安石新法·罢元祐·绍圣绍述新法·激党争·终北宋衰',
      by: '章惇',
      year: 1094,
      method: 'edict',
      magnitudeDescriptor: '复新义·罢诗赋·绍述熙宁',
      magnitudeDescriptorPreset: 'song_shaosheng_xinfa',
      magnitudeParsed: {
        scale: 'major', radical: 80, years: 10, reversible: true,
        tags: ['rollback', 're_reform', 'radical', 'ideology_shift'],
        paraphrase: '复熙宁新义'
      },
      diff: {
        subjects: {
          added: [
            { id: 'sjxy', name: '三经新义', weight: 35, ideology: 'reformist',
              format: '新经义·政论', historicalAnalog: '绍圣·章惇' }
          ],
          removed: [{ id: 'shi', name: '诗赋' }]
        },
        ideology: 'reformist'
      },
      _l10HistoricalContext: '绍圣元年·哲宗亲政·章惇主国·绍述熙宁新法'
    },

    // 7·宋蔡京崇宁党禁·1102·元祐党人碑·禁党人应举
    {
      id: 'song_chongning_dangren',
      era: 'song',
      canonicalName: '崇宁党禁',
      historicalEvaluation: '蔡京立元祐党人碑·禁党人子孙应举·政争入科·终北宋衰',
      by: '蔡京',
      year: 1102,
      method: 'defy',
      magnitudeDescriptor: '禁党人应举·立党人碑',
      magnitudeDescriptorPreset: 'song_chongning_dangren',
      magnitudeParsed: {
        scale: 'major', radical: 90, years: 25, reversible: true,
        tags: ['party_persecution', 'exclusion', 'radical'],
        paraphrase: '禁党人应举'
      },
      diff: {
        ideology: 'reformist'
      },
      _l10HistoricalContext: '崇宁元年·蔡京立元祐党人碑·禁党人子孙应举·凡 309 人'
    },

    // 8·元仁宗延祐复科·1313·朱熹四书·南北分
    {
      id: 'yuan_yanyou',
      era: 'yuan',
      canonicalName: '延祐复科',
      historicalEvaluation: '元仁宗复科举·朱熹四书·南北分科·夷夏并取·百年废而复行',
      by: '元仁宗',
      year: 1313,
      method: 'edict',
      magnitudeDescriptor: '复科举·朱熹四书·南北分',
      magnitudeDescriptorPreset: 'yuan_yanyou',
      magnitudeParsed: {
        scale: 'major', radical: 60, years: 50, reversible: false,
        tags: ['institution_restore', 'ideology_shift', 'quota_geo'],
        paraphrase: '复科举·四书取士'
      },
      diff: {
        subjects: {
          added: [
            { id: 'zxss', name: '朱熹四书', weight: 50, ideology: 'traditional',
              format: '四书·朱注', historicalAnalog: '元仁宗·延祐二年' }
          ]
        },
        ideology: 'traditional'
      },
      _l10HistoricalContext: '延祐二年·元仁宗复科举·定朱熹四书为本·南北分榜'
    },

    // 9·明朱元璋洪武三场·1370·定三场·定四书五经
    {
      id: 'ming_hongwu',
      era: 'ming',
      canonicalName: '洪武三场',
      historicalEvaluation: '朱元璋定科举三场·乡试会试殿试·定四书五经·明清取士基',
      by: '朱元璋',
      year: 1370,
      method: 'edict',
      magnitudeDescriptor: '立三场·乡会殿·定四书五经',
      magnitudeDescriptorPreset: 'ming_hongwu',
      magnitudeParsed: {
        scale: 'major', radical: 75, years: 100, reversible: false,
        tags: ['institution_init', 'tier_structure'],
        paraphrase: '立三场·定四书五经'
      },
      diff: {
        subjects: {
          added: [
            { id: 'ssws', name: '四书五经', weight: 70, ideology: 'traditional',
              format: '四书五经·八股', historicalAnalog: '洪武三年' }
          ]
        },
        ideology: 'traditional',
        examInterval: 3,
        retakePolicy: 'free'
      },
      _l10HistoricalContext: '洪武三年·朱元璋诏开科·定乡会殿三场·明清取士基'
    },

    // 10·明张居正考成法·1573·吏治肃·身死翻案
    {
      id: 'ming_kaocheng',
      era: 'ming',
      canonicalName: '张居正考成法',
      historicalEvaluation: '张相考成法·吏治肃·张相身死翻案·考成废·万历怠政',
      by: '张居正',
      year: 1573,
      method: 'council',
      magnitudeDescriptor: '考成纲领·吏治严·一岁数考',
      magnitudeDescriptorPreset: 'ming_kaocheng',
      magnitudeParsed: {
        scale: 'major', radical: 70, years: 10, reversible: true,
        tags: ['examiner_reform', 'accountability', 'short_lived'],
        paraphrase: '考成纲领·考效'
      },
      diff: {
        ideology: 'practical'
      },
      _l10HistoricalContext: '万历元年·张居正以首辅推考成法·六部都察院皆设考成簿'
    },

    // 11·清雍正南北榜调·1729·中卷·均地·缓党争
    {
      id: 'qing_yongzheng_nb',
      era: 'qing',
      canonicalName: '雍正南北榜调',
      historicalEvaluation: '雍正调南北榜·加中卷·西北边远卷·均一·缓南北党争',
      by: '雍正',
      year: 1729,
      method: 'edict',
      magnitudeDescriptor: '南北中三卷·均地缓争',
      magnitudeDescriptorPreset: 'qing_yongzheng_nb',
      magnitudeParsed: {
        scale: 'moderate', radical: 40, years: 50, reversible: true,
        tags: ['quota_geo', 'balance', 'party_appease'],
        paraphrase: '南北中分卷'
      },
      diff: {
        ideology: 'practical'
      },
      _l10HistoricalContext: '雍正七年·分中卷·缓南北榜党争·后改南北中三卷'
    },

    // 12·清光绪戊戌变法·1898·西学算学·百日罢
    {
      id: 'qing_wuxu',
      era: 'qing',
      canonicalName: '戊戌变法',
      historicalEvaluation: '光绪戊戌·康梁主·加西学算学译学·百日而罢·六君子戮·维新而败',
      by: '光绪',
      year: 1898,
      method: 'defy',
      magnitudeDescriptor: '加西学·算学·译学·急修制',
      magnitudeDescriptorPreset: 'qing_wuxu',
      magnitudeParsed: {
        scale: 'major', radical: 90, years: 1, reversible: true,
        tags: ['radical', 'modernization', 'short_lived', 'ideology_shift'],
        paraphrase: '加西学算学译学'
      },
      diff: {
        subjects: {
          added: [
            { id: 'xx', name: '西学', weight: 20, ideology: 'modern',
              format: '西政·西史', historicalAnalog: '戊戌·康梁' },
            { id: 'sx_l10', name: '算学', weight: 15, ideology: 'modern',
              format: '算学·几何', historicalAnalog: '戊戌·康梁' },
            { id: 'yix', name: '译学', weight: 10, ideology: 'modern',
              format: '译·英法德文', historicalAnalog: '戊戌·京师同文馆' }
          ]
        },
        ideology: 'modern'
      },
      _l10HistoricalContext: '光绪二十四年戊戌·明定国是诏·百日维新·9 月 21 日政变罢'
    },

    // 13·清·1905 罢科举·袁世凯张之洞合奏·千年科举终
    {
      id: 'qing_keju_abolish',
      era: 'qing',
      canonicalName: '一九零五罢科举',
      historicalEvaluation: '袁世凯张之洞合奏·罢科举·立学堂·千年科举终·士林震动',
      by: '袁世凯·张之洞',
      year: 1905,
      method: 'edict',
      magnitudeDescriptor: '罢科举·立学堂·变士林',
      magnitudeDescriptorPreset: 'qing_keju_abolish',
      magnitudeParsed: {
        scale: 'major', radical: 100, years: 0, reversible: false,
        tags: ['institution_abolish', 'radical', 'final'],
        paraphrase: '罢科举·立学堂'
      },
      diff: {
        ideology: 'modern',
        examInterval: 0
      },
      _l10HistoricalContext: '光绪三十一年·袁世凯张之洞合奏·上谕罢科举·千年制度终'
    }

  ];

  // ════════════════════════════════════════════════════════════════
  // §2·filter helper·v2·B2 fix·invalid era → fallback all
  // ════════════════════════════════════════════════════════════════

  function _kjpL10FilterByEra(eraKey) {
    if (!Array.isArray(L10_PRESETS)) return [];
    if (!eraKey) return L10_PRESETS.slice();
    var matched = L10_PRESETS.filter(function(p) { return p.era === eraKey; });
    // B2·invalid era (无 match) → fallback all·user 仍可选
    if (!matched.length) return L10_PRESETS.slice();
    return matched;
  }

  function _kjpL10EraLabel(eraKey) {
    if (!eraKey) return '';
    return ERA_LABEL_ZH[eraKey] || eraKey;
  }

  // ════════════════════════════════════════════════════════════════
  // §3·expose
  // ════════════════════════════════════════════════════════════════

  global.L10_PRESETS         = L10_PRESETS;
  global.ERA_LABEL_ZH        = ERA_LABEL_ZH;
  global._kjpL10FilterByEra  = _kjpL10FilterByEra;
  global._kjpL10EraLabel     = _kjpL10EraLabel;

  global.TM = global.TM || {};
  global.TM.Keju = global.TM.Keju || {};
  global.TM.Keju.L10 = {
    PRESETS: L10_PRESETS,
    ERA_LABEL_ZH: ERA_LABEL_ZH,
    filterByEra: _kjpL10FilterByEra,
    eraLabel: _kjpL10EraLabel
  };

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
