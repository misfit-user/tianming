/* tm-custom-build-agent.js — 自拟营建 agent（A1 · 骨架 + 勘地 read 工具 + 单发核定）
 *
 * owner 拍板 2026-06-20：自拟营建改**真 agent**——按玩家描述，AI **当场**核定效果/工期/造价/可行性。
 *   闭环：玩家描述 →【请有司核议】→ 本 agent 当场核定 → 核议帖 → 玩家准奏即开工 → 注入回合推演。
 *   纪律（防玄幻）：**判断当场自由，落账走硬门**——agent 判断自由，effectsStructured 仍过
 *     sanitizeStructuredFx 白名单 + 费效封顶（A2）+ 工期 tick 完工入账（A3）。十两银修不出雄关，不因 agent 而废。
 *
 * A1 范围：
 *   · inspectRegion(divName, ctx) — 勘此地真实营建条件（确定性·node 可测）：地理/物产/已建/城防/边警/官缺/丁口/财力。
 *   · appraise(divName, req, ctx) — 单发核定：勘地注入 prompt + callAIWithTools(forceTool:submit_appraisal) → 结构化核议。
 *   read-tool / 单轮 agent 范式复用 tm-endturn-agent-read-tools.js / tm-office-recall-agent.js。
 *   A2 接硬门 + 核议帖卡片 UI；A3 接准奏开工 + 注入推演；A4 活字段 write 词汇表；A5 多步 + 对抗审。
 *
 * 开关 P.conf.customBuildAgentEnabled 默认开（玩家主动点按钮才调·无 API/关闭→回落原建议库路径·零额外成本）。
 * 跨朝代：巡检司/义仓/书院皆通用古制·引擎不认朝代专名（专名归剧本）。
 * 详设 web/docs/building-custom-construction-upgrade-2026-06.md §三/§四。
 */
(function (root) {
  'use strict';
  var TM = root.TM || (root.TM = {});

  function _num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function _conf() { return (root.P && root.P.conf) || {}; }

  // 开关：默认开·显式 false 才关（玩家点按钮才触发·成本可控）
  function enabled() { return _conf().customBuildAgentEnabled !== false; }

  // adminHierarchy 双源：代码库两套约定并存——建筑系统读 P.adminHierarchy（tm-building-works/tm-endturn-apply）、
  //   边警/官缺读 GM.adminHierarchy（tm-border-risk/tm-office-vacancy）。某些 save/剧本下二者不同步（真机逮到：
  //   无疆域 save 里 P.adminHierarchy={} 而 GM.adminHierarchy 缺）。故搜两者·非空·按引用去重（镜像 _adminHierarchySources 范式）。
  function _adminSources(P) {
    var srcs = [];
    function add(ah) { if (ah && typeof ah === 'object' && Object.keys(ah).length && srcs.indexOf(ah) < 0) srcs.push(ah); }
    add(P && P.adminHierarchy);
    add(root.GM && root.GM.adminHierarchy);
    add(root.P && root.P.adminHierarchy);
    return srcs;
  }

  // ── 找区划（按名·走 adminHierarchy 全 faction 下钻·跨 P/GM 双源·镜像 tm-endturn-apply 的 _walk）──
  function _findDivByName(P, name) {
    if (!name) return null;
    var sources = _adminSources(P);
    var target = null;
    sources.forEach(function (ah) {
      if (target) return;
      Object.keys(ah).forEach(function (fk) {
        if (target) return;
        var fh = ah[fk];
        var ds = fh && (fh.divisions || fh.children);
        if (!ds || !ds.length) return;
        (function walk(list) {
          for (var i = 0; i < list.length; i++) {
            if (target) return;
            var d = list[i];
            if (!d) continue;
            if (d.name === name) { target = d; return; }
            var kids = d.children || d.divisions;
            if (kids && kids.length) walk(kids);
          }
        })(ds);
      });
    });
    return target;
  }

  // ── S4·勘学统格局 + 士绅/旧学势力（供「教什么学/是否新范式/变革阻力」核议）──
  //   全国学统：既有人才范式（旧学正统存量 / 新学渗透档·读 GM._talentCohorts·读不写）——
  //     供 AI 判此校所教之「学」归入已有范式还是新立、并衡量旧学之庞大（数亿之国非几千新人能改变）。
  //   本地士绅/风土：div 氛围字段（leadingGentry/specialCulture/localFaction·有则 surface）——供衡变革阻力。
  function _talentScene(GM, div) {
    var out = { established: [], emergent: [], gentry: [] };
    var TC = root.TM && root.TM.TalentCohorts;
    var st = GM && GM._talentCohorts;
    if (TC && st && st.paradigms) {
      var pen = (typeof TC.penetration === 'function') ? TC.penetration(GM, root.P || {}, null) : { byParadigm: {} };
      Object.keys(st.paradigms).forEach(function (id) {
        var p = st.paradigms[id]; if (!p) return;
        if (p.kind === 'established') out.established.push({ label: p.label, stock: Math.round(_num(p.stock)) });
        else out.emergent.push({ label: p.label, pen: pen.byParadigm[id] || 0, tier: (typeof TC.tierOf === 'function') ? TC.tierOf(pen.byParadigm[id] || 0) : '' });
      });
    }
    if (div) {
      if (div.leadingGentry) out.gentry.push(String(div.leadingGentry));
      if (div.specialCulture) out.gentry.push(String(div.specialCulture));
      if (div.localFaction) out.gentry.push(String(div.localFaction));
    }
    return out;
  }

  // ── inspectRegion：勘此地真实营建条件（结构化 data + 人话 text）──
  //   地理(沿海/物产/田亩) · 现状(已建/城防/海防) · 军务(边警/驻军/战略价值/军压)
  //   · 吏治(官缺/长官/民心) · 民力(丁口/口/承载) · 财力(地方库银/岁留用) · S4 学统格局(既有范式/士绅)
  function inspectRegion(divName, ctx) {
    ctx = ctx || {};
    var P = ctx.P || root.P || {};
    var GM = ctx.GM || root.GM || null;
    var div = ctx.div || _findDivByName(P, divName);
    if (!div) return { ok: false, name: divName, text: '（未找到此地：' + divName + '·无从勘报，请按通则核议）', data: null };
    var scene = _talentScene(GM, div);
    var eb = div.economyBase || {};
    var pd = div.populationDetail || {};
    var pt = (div.publicTreasury && div.publicTreasury.money) || {};
    var fd = div.fiscalDetail || div.fiscal || {};
    var coastal = (div.coastalDefense != null && div.coastalDefense !== '') || _num(eb.maritimeTradeVolume) > 0;
    var products = [];
    if (_num(eb.saltProduction) > 0) products.push('盐');
    if (_num(eb.mineralProduction) > 0) products.push('矿');
    if (_num(eb.horseProduction) > 0) products.push('马');
    if (_num(eb.fishingProduction) > 0) products.push('渔');
    if (coastal) products.push('海贸');
    var builds = Array.isArray(div.buildings) ? div.buildings : [];
    var buildNames = builds.map(function (b) { return (b && b.name) || ''; }).filter(Boolean);

    var data = {
      name: div.name,
      regionType: div.regionType || div.level || div.type || '',
      geography: {
        coastal: !!coastal,
        products: products,
        farmland: _num(eb.farmland),
        commerceVolume: _num(eb.commerceVolume)
      },
      existing: {
        buildings: buildNames,
        fortLevel: _num(div.fortLevel),
        coastalDefense: _num(div.coastalDefense)
      },
      military: {
        borderRisk: _num(div.borderRisk),
        troops: _num(div.troops),
        strategicValue: (div.strategicValue != null ? div.strategicValue : null),
        armyPressure: _num(div.armyPressure)
      },
      governance: {
        officeVacancy: _num(div.officeVacancy),
        governor: div.governor || '',
        corruptionLocal: (div.corruptionLocal != null ? _num(div.corruptionLocal) : null),
        minxin: (div.minxin != null ? _num(div.minxin) : null)
      },
      population: {
        mouths: _num(pd.mouths),
        ding: _num(pd.ding),
        carryingCapacity: (pd.carryingCapacity != null ? _num(pd.carryingCapacity) : null)
      },
      fiscal: {
        localTreasury: _num(pt.stock != null ? pt.stock : pt.available),
        retainedBudget: _num(fd.retainedBudget)
      },
      talentScene: scene
    };

    var L = [];
    L.push('〔' + div.name + (data.regionType ? '·' + data.regionType : '') + ' 营建条件勘报〕');
    L.push('地理：' + (coastal ? '濒海' : '内陆') + (products.length ? ('·物产 ' + products.join('/')) : '·无显著物产') +
      '·田亩约 ' + data.geography.farmland + '·商贸约 ' + data.geography.commerceVolume);
    L.push('现状：' + (buildNames.length ? ('已建 ' + buildNames.slice(0, 8).join('、')) : '未有营造') +
      '·城防 ' + data.existing.fortLevel + ' 档' + (coastal ? ('·海防 ' + data.existing.coastalDefense + ' 档') : ''));
    L.push('军务：边警 ' + data.military.borderRisk + '·驻军 ' + data.military.troops +
      (data.military.strategicValue != null ? ('·战略价值 ' + data.military.strategicValue) : '') + '·军压 ' + data.military.armyPressure);
    L.push('吏治：官缺 ' + data.governance.officeVacancy + ' 员·长官 ' + (data.governance.governor || '空缺') +
      (data.governance.minxin != null ? ('·民心 ' + data.governance.minxin) : ''));
    L.push('民力：丁口约 ' + data.population.ding + '·口 ' + data.population.mouths +
      (data.population.carryingCapacity != null ? ('·承载 ' + data.population.carryingCapacity) : ''));
    L.push('财力：地方库银约 ' + data.fiscal.localTreasury + '·岁留用约 ' + data.fiscal.retainedBudget);
    // S4·学统格局（既有范式·供「教什么学/是否新范式」）+ 本地士绅（供「变革阻力」）
    if (scene.established.length || scene.emergent.length || scene.gentry.length) {
      var sl = '学统：';
      if (scene.established.length) sl += '旧学正统 ' + scene.established.map(function (e) { return e.label + '(存量约' + e.stock + ')'; }).join('、');
      if (scene.emergent.length) sl += (scene.established.length ? '；' : '') + '新学 ' + scene.emergent.map(function (e) { return e.label + '(' + e.tier + (e.pen ? '·' + (e.pen * 100).toFixed(1) + '%' : '') + ')'; }).join('、');
      if (scene.gentry.length) sl += '；本地士绅/风土 ' + scene.gentry.join('/');
      L.push(sl);
    } else {
      L.push('学统：尚无新学范式立籍（此校若开新学，乃首倡——可立新范式）');
    }
    return { ok: true, name: div.name, text: L.join('\n'), data: data };
  }

  // ── submit_appraisal 工具（结构化输出·forceTool 强制调用一次）──
  var APPRAISAL_TOOL = {
    name: 'submit_appraisal',
    description: '提交对此自拟工役的核议：可行性、估算造价/工期、结构化效果账、效果叙述、判语。必须调用此工具一次。',
    parameters: {
      type: 'object',
      properties: {
        feasibility: { type: 'string', description: '合理/勉强/不合理。据此地真实条件实判：沿海方可市舶、有矿方可矿场、内陆建海务则不合理；丁口竭则难成、库银匮则缓。', enum: ['合理', '勉强', '不合理'] },
        costActual: { type: 'number', description: '估算实际造价(两)·据规模与此地条件（灾年料贵、边地工险则增）。' },
        timeActual: { type: 'number', description: '工期(回合)·大役工长、小役速成；丁口不足则延。' },
        effectsStructured: {
          type: 'object',
          description: '结构化效果账·完工照此入账（judgedEffects 叙述不入账）。pct{白名单路径:小数}、abs{白名单路径:整数}、minxin(±2内)、corruption(±3内)、upkeepPerTurn(约造价2%/回合)。白名单：economyBase.{farmland,commerceVolume,commerceCoefficient,maritimeTradeVolume,saltProduction,mineralProduction,fishingProduction,horseProduction,postRelays,roadQuality,kejuQuota}、fortLevel、coastalDefense(海防档)、militaryRecruits、defenseBonus(边防工事档·降本地边警)、officialSupply(育才储官·补地方官缺)。名单外引擎丢弃。十两银修不出雄关——费效为度。'
        },
        globalRule: {
          type: 'object',
          description: '【全局之制·选填】仅当此工役非寻常钱粮工役，而在变更制度/风气/学统/社会结构时填（如实学馆/译书馆/算学馆/通商局/医学馆——为国持续输送某类人才、确立某种风气）。寻常仓/田/城/坊留空。此为持续生效之全局规则，不入钱粮账，潜移默化国是民风，且必招既得群体之阻力。',
          properties: {
            name: { type: 'string', description: '制名·中立古词（如「实学之制」「通商之制」「译书之制」），勿用朝代专名。' },
            tendencies: {
              type: 'array',
              description: '此制确立的持续倾向（1-4 条）。key 取通用义：reform_success(改革推行)/tech_promotion(实学技艺推广)/shixue_recognition(实学为世所重)/commerce_open(通商开放)/talent_supply(才俊辈出)/orthodoxy(正统维护) 等，亦可据实另拟。一制至多 1 条 major。',
              items: { type: 'object', properties: {
                key: { type: 'string' },
                label: { type: 'string', description: '人话(如「改革推行」)' },
                mag: { type: 'string', description: '档：minor(渐)/moderate(颇)/major(大)', enum: ['minor', 'moderate', 'major'] }
              }, required: ['key', 'label', 'mag'] }
            },
            resistance: {
              type: 'object',
              description: '此制招致之既得群体阻力（立新制几乎必有·勿讳言勿低估）。',
              properties: {
                from: { type: 'array', items: { type: 'string' }, description: '抵制群体（如「士绅」「旧学官」「海禁旧党」「勋贵」）' },
                intensity: { type: 'string', description: 'simmering(私议·微)/active(清议上疏·炽)/fierce(结党请罢·沸)——越动摇正统、越夺多数士绅之利则愈烈', enum: ['simmering', 'active', 'fierce'] },
                label: { type: 'string', description: '阻力情状一句（如「科举正途外别立旁门，物议沸然」）' }
              }
            }
          }
        },
        talentSource: {
          type: 'object',
          description: '【人才范式·选填】仅当此工役是持续培养某类新人才的学校（新式学堂/学馆/讲武堂/算学馆/医学馆/译书馆…）时填。引擎据此把毕业生注入「人才范式渗透漏斗」（招生→师资质量→产业吸纳→历练数年→制度空间→渗透），日积月累、瓶颈层层方显效——绝非即时加成；无师资/无对应产业之空壳学校，毕业即失业、徒增动荡。寻常仓/田/城/坊不填。此为学校「利于什么」的硬核载体——勿再于 globalRule 重复声明同义倾向。',
          properties: {
            paradigm: { type: 'string', description: '若所教之「学」已有范式（见勘报〔学统〕所列），填其名归入（共享既有渗透积累）；新创之学则留空、改填 newParadigm。' },
            newParadigm: {
              type: 'object',
              description: '若所教是前所未有之新「学」，在此命名并定性。',
              properties: {
                label: { type: 'string', description: '此学之名·中立古词（如「格致之学」「经世实学」「泰西算学」「武备新学」「岐黄新学」）·勿用朝代专名。' },
                influenceProfile: { type: 'object', description: '此学「利于什么」——稀疏键值 {维度:0~1}。维度取通用义：techPromotion(技艺推广)/industry(工矿)/commerce(商贸)/reformSuccess(改革推行)/governance(吏治)/military(武备)/medicine(医)/agriculture(农) 等，值为该学对此维度之偏重(0~1)。例 格致→{techPromotion:0.8,industry:0.6}；经世→{reformSuccess:0.7,governance:0.5}。此即新人才渗透后软推之全局倾向（经人才载体·非凭空+X）。' },
                absorptionKind: { type: 'array', items: { type: 'string' }, description: '此学人才需哪类岗位（决定产业吸纳瓶颈读哪些产业）：industry/craft/commerce/agriculture/governance/military/medicine。没对应产业 = 没岗位 = 毕业即失业。' },
                maturityTurns: { type: 'number', description: '毕业→成熟历练回合（约数年·缺省 60）。' }
              }
            },
            graduates: { type: 'number', description: '约略年毕业数（费效封顶按造价档：十万两巨学方可数千·小学堂数百）。' }
          }
        },
        judgedEffects: { type: 'string', description: '效果叙述(人话·给玩家读)。' },
        reason: { type: 'string', description: '判语：为何此可行性/造价/工期——须扣此地真实条件（勘报所见）。' }
      },
      required: ['feasibility', 'costActual', 'timeActual', 'judgedEffects', 'reason']
    }
  };

  // ── 核议 prompt：所拟工役 + 勘地 + 核议之制（白名单/费效尺度软约束·硬门在 A2 apply）──
  function _buildAppraisePrompt(req, inspection) {
    req = req || {};
    inspection = inspection || {};
    var L = [];
    L.push('【有司核议·自拟营建】你是本朝有司，奉命就玩家所拟工役，据此地真实条件，当场核定其可行性、造价、工期与实际效用。');
    L.push('');
    L.push('〔所拟工役〕');
    L.push('名目：' + (req.name || '(未名)'));
    L.push('类属：' + (req.category || 'economic'));
    L.push('规制与所求：' + (req.description || '(未述)'));
    L.push('');
    L.push(inspection.text || '（此地勘报缺失，请按通则审慎核议）');
    L.push('');
    L.push('〔核议之制〕');
    L.push('· 可行性据此地条件**实判**：沿海方可建市舶/港口、有矿方可建矿场、内陆建海务则不合理；丁口竭则工期延、库银匮则费增、已有雄城再修则边际递减。');
    L.push('· 效果只许落白名单账目（见 submit_appraisal 之 effectsStructured 说明）·白名单外引擎直接丢弃。');
    L.push('· 费效为度：千两以下至多 1-3% 微利；万两可至 8%；两万两以上方可 15% 或城防 +1；十万两巨役方可 25%。十两银修不出雄关。');
    L.push('· 大额营造（数万两以上）应给相称的**绝对值**经济产出（abs:economyBase.commerceVolume/mineralProduction/saltProduction/farmland 等直接增量），勿只给小比例。经济类年回报约造价 8%~15%。');
    L.push('· 活字段（拨动世界·须经源头叶）：边防工事(巡检/烽燧/堡台)给 defenseBonus 降本地边警；书院/学宫给 officialSupply 补地方官缺；军屯/养兵庄增 economyBase 田粮→地方留用增→军费负担间接降。勿直给 borderRisk/officeVacancy/armyPressure——那是派生值，引擎每回合重算，须经上述源头叶。');
    L.push('· 维护费 upkeepPerTurn 约为造价 2%/回合。');
    L.push('· **育才之学校（首选 talentSource·人才范式）**：若此工役是持续培养某类新人才的学校（新式学堂/学馆/讲武堂/算学馆/医学馆/译书馆…），填 talentSource——判它教的是哪一种「学」：归入勘报〔学统〕已列范式（paradigm=其名·共享渗透积累），还是前所未有当新立（newParadigm·命名 + 定 influenceProfile「利于哪些全局维度」+ absorptionKind「人才需何岗位」+ 约略年毕业数）。其全局之效**经人才渗透日积月累方显**（招生→师资→产业吸纳→历练→制度空间），非即时加成；勘报〔学统〕之旧学存量愈庞大，新学愈难骤显（数亿之国非几千新人能改变）。');
    L.push('· **学校之「利于什么」走 talentSource.influenceProfile，勿再于 globalRule 重复声明同义倾向（免双计）**。globalRule 仅用于：① 非育才的纯制度/风气变更（通商局/海禁开弛/某种国策之制）填其倾向 tendencies；② 承载「变革阻力」——凡新学新制动摇正统、夺士绅科举正途之利，必招阻力，于 globalRule.resistance（from/intensity/label）如实记其反对者与烈度（若仅承载阻力而无独立制度倾向，倾向可只填一条「此学统/风气之确立」，勿重述功能维度）。');
    L.push('· **凡立新制必招阻力**：动摇正统、夺既得之利者，士绅旧党必清议、上疏、乃至结党请罢。据其触动之深核定 resistance.intensity——此为实情，须如实，勿讳言、勿低估。逾分之制纵一时兴造，亦终为物议所夺。');
    L.push('');
    L.push('请调用 submit_appraisal 提交核议（必须调用一次）。');
    return L.join('\n');
  }

  // ── A5 配置（owner 拍板：默认走次要 API 优先）──
  function _TIER() { return _conf().customBuildAgentTier || 'secondary'; }        // 次要 API 优先·可配
  function _criticOn() { return _conf().customBuildCriticEnabled !== false; }     // 谏官对抗审·默认开
  function _maxRounds() { var r = _num(_conf().customBuildAgentRounds); return (r >= 1 && r <= 5) ? r : 3; }  // 多步轮数·默认 3·设 1 即单发

  // A5 多步工具：勘地(可比照他地) + 查史例(找依据)
  var INSPECT_TOOL = {
    name: 'inspect_region',
    description: '细勘某地营建条件(地理/物产/已建/城防/边警/官缺/丁口/财力)。要看更细、或比照他地宜建何处时调用。缺 divName 则勘本地。',
    parameters: { type: 'object', properties: { divName: { type: 'string', description: '地名·缺省为本地' } }, required: [] }
  };
  var RECALL_TOOL = {
    name: 'recall_precedent',
    description: '查史实先例与过往记忆(此类工役的成例/教训/相关大事)·为核定找依据。不确定可行性或效用尺度时调用。',
    parameters: { type: 'object', properties: { query: { type: 'string', description: '关键词(工役名/类属/相关地名)' } }, required: ['query'] }
  };
  // A5 谏官覆核工具
  var CRITIQUE_TOOL = {
    name: 'critique',
    description: '谏官覆核：此核议是否过誉(效果虚高于费用/此地条件)、工期是否虚短、造价是否失实。允当则 sound=true·否则给回调。',
    parameters: {
      type: 'object',
      properties: {
        sound: { type: 'boolean', description: '核议是否允当(效果不过誉、工期不虚短、造价不失实)' },
        effectScale: { type: 'number', description: '效果回调系数 0.3~1.0(过誉则<1·按此缩放结构化效果)·允当填 1' },
        minTimeActual: { type: 'number', description: '工期下限(回合)·虚短则提至此·允当填 0' },
        note: { type: 'string', description: '谏言一句(为何过誉/虚短·或允当之由)' }
      },
      required: ['sound', 'note']
    }
  };

  // 查史例（复用只读工具 recall_history → ②按需取数）
  async function _recallPrecedent(query, ctx) {
    query = String(query || '').trim();
    if (!query) return '(空查询)';
    var ART = root.TM && root.TM.Endturn && root.TM.Endturn.AgentReadTools;
    if (ART && typeof ART.handle === 'function') {
      try { var r = await ART.handle('recall_history', { query: query }, { GM: (ctx && ctx.GM) || root.GM }); return (r && r.text) || '(无相关先例)'; }
      catch (e) { return '(先例检索异常)'; }
    }
    return '(先例检索未就绪)';
  }

  // A5 多步核定：baseline 勘地注入 + 可调 inspect_region/recall_precedent → 末轮逼 submit_appraisal。
  //   callAIWithTools 单发·transcript 累积伪多轮（同 agent-mode S4 范式）·走次要 API。
  async function _decideMultiStep(divName, req, ctx, baseline) {
    var cawt = root.callAIWithTools;
    var tools = [INSPECT_TOOL, RECALL_TOOL, APPRAISAL_TOOL];
    var transcript = _buildAppraisePrompt(req, baseline);
    var maxR = _maxRounds();
    var stats = { rounds: 0, reads: 0 };
    var maxTok = (_conf().customBuildAgentMaxTok) || 1200;
    for (var round = 1; round <= maxR; round++) {
      stats.rounds = round;
      var forceLast = (round === maxR);   // 末轮逼核议·防空转
      var resp;
      try {
        resp = await cawt(transcript, tools, {
          maxTok: maxTok, tier: _TIER(), priority: 'normal',
          timeoutMs: 60000, maxRetries: 1,
          forceTool: forceLast ? 'submit_appraisal' : undefined,
          id: 'custom_build_appraise:r' + round
        });
      } catch (e) { return { error: 'call-failed:' + (e && e.message) }; }
      if (!resp) return { error: 'no-resp' };
      var calls = Array.isArray(resp.toolCalls) ? resp.toolCalls : [];
      var ap = null;
      for (var i = 0; i < calls.length; i++) { if (calls[i] && calls[i].name === 'submit_appraisal') { ap = calls[i].input || {}; break; } }
      if (ap) return { appraisal: ap, toolStats: stats, fallback: !!resp.fallback };
      // 执行 read 工具·结果 append 续轮（护栏 ≤4 调用/轮）
      var got = [];
      for (var j = 0; j < calls.length && got.length < 4; j++) {
        var c = calls[j]; if (!c) continue;
        if (c.name === 'inspect_region') { var dn = (c.input && c.input.divName) || divName; got.push('〔细勘 ' + dn + '〕\n' + (inspectRegion(dn, ctx).text || '')); stats.reads++; }
        else if (c.name === 'recall_precedent') { var q = (c.input && c.input.query) || req.name; got.push('〔史例「' + q + '」〕\n' + (await _recallPrecedent(q, ctx))); stats.reads++; }
      }
      if (got.length) transcript += '\n\n【你已查得】\n' + got.join('\n') + '\n\n（据此继续：可再查，或调用 submit_appraisal 提交核议）';
      else transcript += '\n\n（请据上述径直调用 submit_appraisal 核议）';
    }
    return { error: 'no-appraisal' };
  }

  // 缩放结构化效果（谏官回调过誉用·pct/abs 缩·minxin/corruption/upkeep/armory 不缩·abs 取整）
  function _scaleFx(fx, scale) {
    var out = {};
    if (fx.pct && typeof fx.pct === 'object') { out.pct = {}; Object.keys(fx.pct).forEach(function (k) { out.pct[k] = _num(fx.pct[k]) * scale; }); }
    if (fx.abs && typeof fx.abs === 'object') { out.abs = {}; Object.keys(fx.abs).forEach(function (k) { out.abs[k] = Math.round(_num(fx.abs[k]) * scale); }); }
    ['minxin', 'corruption', 'upkeepPerTurn', 'armoryProfile', 'label'].forEach(function (k) { if (fx[k] != null) out[k] = fx[k]; });
    return out;
  }

  // S4·校验 talentSource（AI 原拟 → 干净规整·费效封顶 graduates 留给 S2 bridge.capGraduates）。
  //   既非归入已有范式（paradigm）、也无新范式名（newParadigm.label）→ 非有效人才源，返 null。
  function _normalizeTalentSource(ts) {
    if (!ts || typeof ts !== 'object') return null;
    var hasRef = ts.paradigm && String(ts.paradigm).trim();
    var np = ts.newParadigm;
    var hasNew = np && typeof np === 'object' && np.label && String(np.label).trim();
    if (!hasRef && !hasNew) return null;
    var out = { graduates: Math.max(0, _num(ts.graduates, 0)) };
    if (hasRef) out.paradigm = String(ts.paradigm).trim();
    if (hasNew) {
      var ip = {};
      if (np.influenceProfile && typeof np.influenceProfile === 'object') {
        Object.keys(np.influenceProfile).forEach(function (k) {
          var v = _num(np.influenceProfile[k], 0);
          if (v) ip[String(k)] = Math.max(-1, Math.min(1, v));
        });
      }
      out.newParadigm = {
        label: String(np.label).trim(),
        influenceProfile: ip,
        absorptionKind: Array.isArray(np.absorptionKind) ? np.absorptionKind.map(String).filter(Boolean).slice(0, 6) : []
      };
      if (np.maturityTurns != null) out.newParadigm.maturityTurns = Math.max(1, Math.round(_num(np.maturityTurns, 60)));
    }
    return out;
  }

  // A5 谏官对抗审：审过誉/工期虚短·据评回调效果与工期（走次要 API·失败则不动·宁严勿宽）
  async function _critiqueAppraisal(req, ap, inspection, ctx) {
    var cawt = root.callAIWithTools;
    if (typeof cawt !== 'function') return null;
    var L = [];
    L.push('【谏官覆核·自拟营建】你是谏官，覆核有司对此工役的核议是否过誉(效果虚高于费用/此地条件)、工期是否虚短、造价是否失实。宁严勿宽。');
    L.push('〔工役〕' + (req.name || '') + '（' + (req.category || '') + '）：' + (req.description || ''));
    if (inspection && inspection.text) L.push(inspection.text);
    L.push('〔有司核议〕可行性' + (ap.feasibility || '') + '·造价' + _num(ap.costActual) + '两·工期' + _num(ap.timeActual) + '回合');
    L.push('效果：' + JSON.stringify(ap.effectsStructured || {}));
    L.push('判语：' + (ap.reason || ''));
    L.push('费效之度：经济类年回报约造价 8%~15%·城防/大效须万两以上·十两银修不出雄关。逾此即过誉，给 effectScale<1 回调；工期畸短给 minTimeActual。请调用 critique 提交覆核。');
    var resp;
    try {
      resp = await cawt(L.join('\n'), [CRITIQUE_TOOL], {
        maxTok: 500, tier: _TIER(), priority: 'normal', timeoutMs: 45000, maxRetries: 1,
        forceTool: 'critique', id: 'custom_build_critique'
      });
    } catch (e) { return null; }
    if (!resp) return null;
    var calls = Array.isArray(resp.toolCalls) ? resp.toolCalls : [];
    var cr = null;
    for (var i = 0; i < calls.length; i++) { if (calls[i] && calls[i].name === 'critique') { cr = calls[i].input || {}; break; } }
    if (!cr) return null;
    var sound = (cr.sound === true || cr.sound === 'true');
    var scale = _num(cr.effectScale, 1); if (!(scale > 0 && scale <= 1)) scale = sound ? 1 : 0.7;
    var minTime = Math.max(0, Math.round(_num(cr.minTimeActual)));
    var note = String(cr.note || '');
    var verdict = { sound: sound, effectScale: scale, minTimeActual: minTime, note: note };
    if (sound && scale >= 1 && minTime <= _num(ap.timeActual)) return { applied: false, verdict: verdict, adjusted: ap };  // 允当·不动
    var adj = {}; for (var k in ap) adj[k] = ap[k];
    if (scale < 1 && ap.effectsStructured && typeof ap.effectsStructured === 'object') adj.effectsStructured = _scaleFx(ap.effectsStructured, scale);
    if (minTime > _num(ap.timeActual)) adj.timeActual = minTime;
    adj.reason = (ap.reason || '') + '（谏官：' + (note || (scale < 1 ? '效用过誉已回调' : '工期虚短已延')) + '）';
    return { applied: true, verdict: verdict, adjusted: adj };
  }

  /**
   * appraise — 自拟营建 agent 核定（A5 多步 + 谏官对抗审）。
   *   勘地 baseline 注入 → 多步循环（agent 可再调 inspect_region/recall_precedent·末轮逼 submit_appraisal）
   *   → 谏官覆核（过誉回调效果/虚短延工期）→ A2 落账硬门（sanitizeStructuredFx 白名单+费效封顶）→ 徽签/维护。
   *   全程走次要 API（_TIER·默认 secondary·owner 拍板）。关闭/无 cawt/无 key/调用失败 → ok:false（上层回落原建议库路径）。
   * @param {string} divName
   * @param {{name:string,category:string,description:string}} req 玩家所拟工役
   * @param {object} [ctx] { P?, div?, GM? }
   * @returns {Promise<{ok:boolean, fallback:boolean, reason?:string, appraisal:object|null, inspection:object|null, toolStats?:object, critique?:object}>}
   */
  async function appraise(divName, req, ctx) {
    ctx = ctx || {};
    req = req || {};
    var out = { ok: false, fallback: false, appraisal: null, inspection: null };
    if (!enabled()) { out.reason = 'disabled'; return out; }
    var cawt = root.callAIWithTools;
    if (typeof cawt !== 'function') { out.reason = 'no-cawt'; return out; }
    var hasKey = !!(root.P && root.P.ai && root.P.ai.key);
    if (!hasKey) { out.reason = 'no-key'; return out; }

    var inspection = inspectRegion(divName, ctx);
    out.inspection = inspection;

    // A5 多步核定：baseline 勘地注入 + agent 可再调 inspect_region/recall_precedent → 末轮逼 submit_appraisal（走次要 API）
    var decided = await _decideMultiStep(divName, req, ctx, inspection);
    if (decided.error) { out.reason = decided.error; return out; }
    out.fallback = !!decided.fallback;
    out.toolStats = decided.toolStats;
    var ap = decided.appraisal;
    if (!ap) { out.reason = 'no-appraisal'; return out; }

    // A5 谏官对抗审：审过誉/工期虚短·据评回调效果与工期（默认开·tier:secondary·失败不动·宁严勿宽）
    if (_criticOn()) {
      try {
        var cri = await _critiqueAppraisal(req, ap, inspection, ctx);
        if (cri) { out.critique = cri.verdict; if (cri.applied) ap = cri.adjusted; }
      } catch (eC) {}
    }

    // A2 落账硬门：判断当场自由，落账走硬门——AI 拟的 effectsStructured 必过 sanitizeStructuredFx
    //   （白名单 + 费效封顶）削正后才认；人话徽签走 fxLabels（与真实建筑同一路径·保「所见即所得」）。
    //   十两银修不出雄关，不因 agent 而废。effectsRaw 留原拟（可观测·对照削了什么）。
    var cost = _num(ap.costActual);
    var rawFx = (ap.effectsStructured && typeof ap.effectsStructured === 'object') ? ap.effectsStructured : null;
    var BW = root.TM && root.TM.BuildingWorks;
    var sanitized = null, labels = [], upkeep = 0;
    if (BW && rawFx) {
      var _bld = { name: req.name, effectsStructured: rawFx, costActual: cost };
      try { if (typeof BW.sanitizeStructuredFx === 'function') sanitized = BW.sanitizeStructuredFx(rawFx, cost); } catch (e1) {}
      try { if (typeof BW.fxLabels === 'function') labels = BW.fxLabels(_bld, null) || []; } catch (e2) {}
      try { if (typeof BW.upkeepFor === 'function') upkeep = BW.upkeepFor(_bld, null); } catch (e3) {}
    }
    // S4·人才范式源：校验 AI 拟的 talentSource → 并入 effectsStructured（S2 bridge 在完工时路由进 talent-cohorts·
    //   费效封顶 graduates 由 bridge.capGraduates 据造价档处理；flag talentCohortEnabled 关时 bridge no-op·零回归）。
    var talentSrc = _normalizeTalentSource(ap.talentSource);
    if (talentSrc) { if (!sanitized || typeof sanitized !== 'object') sanitized = {}; sanitized.talentSource = talentSrc; }
    // 全局之制预览（B2·不写 GM·只供核议帖显示；倾向配额裁档后即「准奏将立之制」）。
    //   真正登记在 approveBuild → GlobalRules.register。preview 传定 id 以免触 _uid 改 GM。
    var grPreview = null;
    try {
      if (root.GlobalRules && ap.globalRule && typeof ap.globalRule === 'object' &&
          typeof root.GlobalRules._normalizeRule === 'function') {
        grPreview = root.GlobalRules._normalizeRule({
          id: 'preview', source: 'building',
          name: ap.globalRule.name || ((req.name || '此') + '之制'),
          tendencies: ap.globalRule.tendencies,
          resistance: ap.globalRule.resistance
        });
      }
    } catch (eGR) {}

    out.ok = true;
    out.appraisal = {
      feasibility: ap.feasibility || '合理',
      costActual: cost,
      timeActual: _num(ap.timeActual),
      effectsStructured: sanitized,          // 削正后（白名单 + 费效封顶）·A3 据此落库
      effectsRaw: rawFx,                      // AI 原拟（可观测·对照硬门削了什么）
      effectLabels: labels,                   // 人话徽签（核议帖显示·含维护·与真实建筑册页同源）
      upkeep: _num(upkeep),                   // 维护费 两/回合
      talentSource: talentSrc || null,        // S4·人才范式源（已并入 effectsStructured·null=非育才学校）·供核议帖显示
      globalRule: grPreview,                  // 全局之制（裁档后·null=寻常工役无此）·准奏据此 register
      globalRuleRaw: (ap.globalRule && typeof ap.globalRule === 'object') ? ap.globalRule : null,  // AI 原拟（可观测）
      judgedEffects: ap.judgedEffects || '',
      reason: ap.reason || ''
    };
    return out;
  }

  /**
   * approveBuild — A3 准奏开工：玩家准奏后即扣银 + 落库 + 注入回合推演（不隔绝）。
   *   · 扣银：从国库走 FiscalEngine.spendFromGuoku（硬核账·有欠账·不阻断·同募兵/军工用法）。
   *   · 落库：push division.buildings[] status=building（与 endturn-apply 同构）→ 过既有工期 tick → 完工入账
   *           （effectsStructured 已 A2 削正）。timeActual<1 → 钳为 1 回合（无瞬成魔法·保证过 tick 入账）。
   *   · 注入推演：记 GM._pendingCustomBuilds（推演 prompt「本回合玩家新营建及有司核议」段消费）→ AI 当现行事件织叙事/反应。
   *   判断当场自由（appraise），落账走硬门（A2）+ 走真引擎扣款（此处）——非侧信道孤岛。
   * @returns {{ok:boolean, building:object|null, spent:{money:number,deficit:number}|null, reason:string}}
   */
  function approveBuild(divName, appraisal, req, ctx) {
    ctx = ctx || {}; req = req || {}; appraisal = appraisal || {};
    var out = { ok: false, building: null, spent: null, reason: '' };
    var P = ctx.P || root.P || {};
    var GM = ctx.GM || root.GM;
    if (!GM) { out.reason = 'no-GM'; return out; }
    if (appraisal.feasibility === '不合理') { out.reason = 'infeasible'; return out; }
    var div = ctx.div || _findDivByName(P, divName);
    if (!div) { out.reason = 'no-div'; return out; }

    // 扣银（国库·皇帝准奏出帑）——走真引擎·有欠账不阻断（同募兵/军工）
    var cost = _num(appraisal.costActual);
    var spentMoney = 0, deficit = 0;
    var FE = root.FiscalEngine;
    if (cost > 0 && FE && typeof FE.spendFromGuoku === 'function') {
      try {
        var sp = FE.spendFromGuoku({ money: cost }, '营建·' + (req.name || divName));
        var dm = sp && sp.deducted && sp.deducted.money;
        if (dm) { spentMoney = _num(dm.deducted); deficit = _num(dm.deficit); }
      } catch (e) { out.reason = 'spend-failed:' + (e && e.message); }  // 扣款异常不阻断开工
    }

    // 落库（与 endturn-apply:3787 同构·过既有 tick）·timeActual≥1
    if (!Array.isArray(div.buildings)) div.buildings = [];
    var rt = Math.max(1, _num(appraisal.timeActual));
    var building = {
      name: req.name || '自拟工役', level: 1, isCustom: true,
      description: req.description || '',
      judgedEffects: appraisal.judgedEffects || '',
      effectsStructured: (appraisal.effectsStructured && typeof appraisal.effectsStructured === 'object') ? appraisal.effectsStructured : null,
      costActual: cost || null, timeActual: _num(appraisal.timeActual) || rt,
      status: 'building', remainingTurns: rt, startTurn: _num(GM.turn),
      _viaAgent: true   // 可观测：自拟营建 agent 准奏开工（非回合末 AI 核定）
    };
    div.buildings.push(building);
    out.building = building;

    // 全局之制登记（B2·如实学馆→「改革推行/实学推广」之持续全局规则·配套阻力）。
    //   判断在核议自由，落账走硬门：register 内倾向配额裁档 + 阻力规整。建筑挂名以备溯源。
    try {
      var GR = root.GlobalRules;
      var grIn = appraisal.globalRule || appraisal.globalRuleRaw;
      if (GR && typeof GR.register === 'function' && grIn && typeof grIn === 'object' && grIn.tendencies) {
        var enacted = GR.register({
          name: grIn.name || ((req.name || '此') + '之制'),
          source: 'building',
          sourceRef: { div: divName, bld: building.name },
          tendencies: grIn.tendencies,
          resistance: grIn.resistance
        });
        if (enacted) building._globalRule = enacted.name;
      }
    } catch (eReg) {}

    // 注入回合推演（不隔绝）：记本回合玩家新营建 + 有司核议·推演 prompt 段消费
    if (!Array.isArray(GM._pendingCustomBuilds)) GM._pendingCustomBuilds = [];
    GM._pendingCustomBuilds.push({
      divName: divName, name: building.name, category: req.category || '',
      feasibility: appraisal.feasibility || '', costActual: cost,
      timeActual: building.timeActual, judgedEffects: appraisal.judgedEffects || '',
      reason: appraisal.reason || '', turn: _num(GM.turn)
    });
    var curT = _num(GM.turn);
    GM._pendingCustomBuilds = GM._pendingCustomBuilds.filter(function (b) { return b && b.turn >= curT - 1; }).slice(-20);

    out.spent = { money: spentMoney, deficit: deficit };
    out.ok = true;
    return out;
  }

  TM.CustomBuildAgent = {
    inspectRegion: inspectRegion,
    appraise: appraise,
    approveBuild: approveBuild,
    enabled: enabled,
    APPRAISAL_TOOL: APPRAISAL_TOOL,
    _findDivByName: _findDivByName,
    _buildAppraisePrompt: _buildAppraisePrompt,
    _talentScene: _talentScene,                  // S4·勘学统格局/士绅（测试用）
    _normalizeTalentSource: _normalizeTalentSource, // S4·人才范式源校验（测试用）
    version: '0.3.0-S4-talent-paradigm'
  };
  root.CustomBuildAgent = TM.CustomBuildAgent;
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.CustomBuildAgent;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
