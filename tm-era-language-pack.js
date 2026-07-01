// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-era-language-pack.js
 * 朝代语言默认包 · 剧本数据层资产(非引擎逻辑)
 *
 * 命门服务:让任意剧本(哪怕没精填语料)都有「时代质感骨架」——
 *   引擎注入的史料底座字段(见 tm-endturn-prompt.js:2312-2324 · imperialAddress /
 *   periodVocabulary / writtenStyle / tabooWords …)若剧本未填,按剧本朝代(era)
 *   回退到本包,而不是塌成空白。
 *
 * ★ 跨朝代通用铁律(见 memory tianming-engine-cross-dynasty):
 *   本包是**剧本数据层**资产。朝代专名(锦衣卫 / 票拟 / 官家 …)写在这里是本分;
 *   引擎只做 eraLanguagePack(era) 这个**中立查表**,永不认识任何具体专名。
 *   加新朝代 = 加一个 key,不碰引擎逻辑。
 *
 * 用法(下一步在注入点接):
 *   _d.imperialAddress || eraLangField(P.scenario && P.scenario.era, 'imperialAddress')
 *
 * 字段对齐 tm-endturn-prompt.js 的史料底座注入位。
 *
 * ⚠️ 历史考据:称谓 / 公文 / 特色词等通识已填;**避讳字、具体跪拜礼数等易错项标了
 *    `[待校]`**,请 owner 核准后去标。宁缺勿错——错的时代质感比没有更砸招牌。
 */
(function() {
  'use strict';

  var ERA_PACKS = {

    // ───────────────────── 明 ─────────────────────
    ming: {
      label: '明',
      narrativeStyle: '半文言',
      sovereignAddress: '陛下',   // 单词·供 UI/模板对君上的称呼(臣民当面/文书首选)
      imperialAddress: '皇帝自称「朕」;臣民称「陛下」「皇上」「圣上」;太后称「圣母」;皇帝称臣下以官职或「卿」;宦官自称「奴婢」、称帝「皇爷」「万岁爷」。',
      officialAddress: '官场:称上司「老大人」「堂翁」「公祖」,自称「卑职」「下官」「晚生」;同年互称「年兄」;乡绅称「老先生」。',
      writtenStyle: '公文分题本(公事)、奏本(私事)、揭帖;起以「谨题为……事」,结以「伏乞圣裁」「谨具奏闻」;内阁票拟、司礼监批红。',
      periodVocabulary: '锦衣卫、东厂、廷杖、夺情、丁忧、起复、京营、太仓、边饷、那移侵克、缇骑、诏狱、考成、科道、票拟、批红、邸报、塘报。',
      etiquetteNorms: '御门听政;臣见君行拜叩之礼(明制为四拜 / 五拜三叩头,非清之三跪九叩)[具体场合礼数·待校];奏对自称「臣」或官职。',
      tabooWords: '避国讳(本朝帝王御名)。[明代具体避讳字较前代为宽·待校——勿臆造]',
      commonExpressions: '「这厮」「晓得」「省得」「敢是」「不打紧」等明代白话;书信「顿首」「敬启」。',
      sensoryDetails: '紫禁城朱墙黄瓦、廊下家、值房;江南漕运、九边烽燧、邸报塘报。'
    },

    // ───────────────────── 宋 (下一铲填实 · 先留骨架) ─────────────────────
    song: {
      label: '宋',
      narrativeStyle: '半文言',
      sovereignAddress: '官家',   // 单词·供 UI/模板对君上的称呼(宋朝堂面奏、口语首选「官家」·非「陛下」)
      imperialAddress: '君上称「官家」(朝堂面奏、口语最常用·首选);正式表奏亦作「陛下」;皇帝自称「朕」(对臣)、口语亦「我」;太上皇称「太上」。臣下奏对宜多用「官家」·勿一味「陛下」。',
      officialAddress: '称宰执「相公」,称侍从「待制」「学士」;自称「某」「下官」;同僚以「丈」「兄」相呼。[部分称谓·待校]',
      writtenStyle: '公文有札子、奏状、表、榜文;翰林拟诏之命曰「词头」;多起「臣某言」,结「取进止」「伏候敕旨」。[具体体例·待校]',
      periodVocabulary: '交子、会子、厢军、禁军、转运使、提点刑狱、通判、磨勘、堂除、宣抚使、经略安抚使、市舶司、糴粜。',
      etiquetteNorms: '[宋代朝仪·待校——勿臆造]',
      tabooWords: '避国讳(本朝帝王及圣祖御名,宋讳较严)[具体避讳字·待校]',
      commonExpressions: '「甚」「恁地」「作甚」「厮」等宋元白话;女子施礼曰「万福」。[部分·待校]',
      sensoryDetails: '汴京 / 临安的勾栏瓦舍、交子会子铺、漕船;市井繁华、夜市不禁。'
    }

    // 其余朝代(唐/汉/清…):加 key 即可扩展,不碰引擎。
  };

  // era 字符串归一 · 宽匹配(剧本 era 可能写「明末」「明·天启」「大明」)
  function _normEra(era) {
    var e = String(era || '').toLowerCase();
    if (/明|ming/.test(e)) return 'ming';
    if (/宋|song/.test(e)) return 'song';
    return null; // 未知朝代:返 null,注入处按现状(剧本值或空)走,不硬塞
  }

  function eraLanguagePack(era) {
    var key = _normEra(era);
    return key ? ERA_PACKS[key] : null;
  }

  // 取单字段:剧本值优先 → 回退朝代包 → 都无返空串(注入处以 if 判空跳过)
  function eraLangField(era, field, scenarioValue) {
    if (scenarioValue) return scenarioValue;
    var pack = eraLanguagePack(era);
    return (pack && pack[field]) || '';
  }

  if (typeof window !== 'undefined') {
    window.eraLanguagePack = eraLanguagePack;
    window.eraLangField = eraLangField;
    window.ERA_LANGUAGE_PACKS = ERA_PACKS; // 诊断 / 编辑器用
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      eraLanguagePack: eraLanguagePack,
      eraLangField: eraLangField,
      ERA_PACKS: ERA_PACKS,
      _normEra: _normEra
    };
  }
})();
