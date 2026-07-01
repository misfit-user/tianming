// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-f3-depth.js — F 阶段 ③：阶层流动多步骤 + B 历史细化
 *
 * 补完：
 *  - E2 阶层流动多步骤链（兼并→债务→破产 / 豪强三级转移）
 *  - E7 寺院会昌毁佛级联
 *  - F1.2 作物采用率运行时应用
 *  - F1.3 疫病民族易感 + 城市传播
 *  - F1.4 120 色职业户籍扩展
 *  - F1.7 路引运行时（迁徙拦截）
 *  - F1.8 婚育习俗（溺女/再嫁/汉胡通婚）
 *  - F1.9 少数民族动态（汉化/叛乱风险）
 *  - A6 侨置 qiaoFrom/土断流程
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  阶层流动多步骤链
  // ═══════════════════════════════════════════════════════════════════

  /** 兼并→债务→破产 链式流动 */
  function _tickClassMobilityChain(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass) return;
    var cl = G.population.byClass;
    var annex = G.landAnnexation && G.landAnnexation.concentration || 0.3;
    // 步骤 1：兼并加速（小地主被吞并）
    if (annex > 0.5 && cl.landlord && cl.peasant_self) {
      var annexSpeed = (annex - 0.5) * 0.002 * mr;
      var transferred = Math.floor((cl.peasant_self.mouths || 0) * annexSpeed);
      cl.peasant_self.mouths = Math.max(0, (cl.peasant_self.mouths || 0) - transferred);
      cl.peasant_tenant = cl.peasant_tenant || { mouths: 0 };
      cl.peasant_tenant.mouths = (cl.peasant_tenant.mouths || 0) + transferred;
    }
    // 步骤 2：佃农负债（租税重 + 粮价波动）
    if (cl.peasant_tenant && cl.peasant_tenant.mouths > 0) {
      var debtRatio = (G.fiscal && G.fiscal._peasantBurdenAvg) || 0.4;
      var defaulterRate = Math.max(0, (debtRatio - 0.4) * 0.005) * mr;
      var defaulters = Math.floor(cl.peasant_tenant.mouths * defaulterRate);
      if (defaulters > 0) {
        cl.peasant_tenant.mouths -= defaulters;
        // 步骤 3：破产后沦为流民/贱民
        cl.debased = cl.debased || { mouths: 0 };
        cl.debased.mouths = (cl.debased.mouths || 0) + Math.floor(defaulters * 0.6);
        // 一部分转逃户
        if (G.population.byLegalStatus && G.population.byLegalStatus.taoohu) {
          G.population.byLegalStatus.taoohu.mouths = (G.population.byLegalStatus.taoohu.mouths || 0) + Math.floor(defaulters * 0.4);
        }
        if (global.addEB && defaulters > 1000) global.addEB('阶层', defaulters + ' 口佃农破产');
      }
    }
  }

  /** 豪强三级转移链（自耕农→佃农→隐户） */
  function _tickMagnateAnnexation(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass) return;
    var cl = G.population.byClass;
    // 豪强（高 gentry + 大地主）势力
    var magnateStrength = ((cl.gentry_high && cl.gentry_high.mouths) || 0) +
                          ((cl.landlord && cl.landlord.mouths || 0) * 0.3);
    var totalPop = G.population.national.mouths || 1;
    var magnateRatio = magnateStrength / totalPop;
    if (magnateRatio < 0.05) return;  // 豪强弱，不触发
    // 级联：自耕农→佃农→隐户
    if (cl.peasant_self && cl.peasant_self.mouths > 0) {
      var level1 = Math.floor(cl.peasant_self.mouths * magnateRatio * 0.005 * mr);
      cl.peasant_self.mouths -= level1;
      cl.peasant_tenant = cl.peasant_tenant || { mouths: 0 };
      cl.peasant_tenant.mouths += level1;
    }
    if (cl.peasant_tenant && cl.peasant_tenant.mouths > 1000) {
      var level2 = Math.floor(cl.peasant_tenant.mouths * magnateRatio * 0.002 * mr);
      cl.peasant_tenant.mouths -= level2;
      G.population.hiddenCount = (G.population.hiddenCount || 0) + level2;
      // 豪强吸纳 harbored
      if (cl.landlord) cl.landlord.harboredHidden = (cl.landlord.harboredHidden || 0) + level2;
    }
  }

  /** 会昌毁佛（845年）级联 */
  function _checkHuichangDestructBuddhism(ctx) {
    var G = global.GM;
    if (!G) return;
    if (G._huichangDone) return;
    // 触发条件：唐朝 + year ≈ 845 + 玩家发废佛诏令
    if (G.dynasty !== '唐') return;
    if (!G._recentEdictText || !/(废佛|废寺|毁佛|还俗)/.test(G._recentEdictText || '')) return;
    G._huichangDone = true;
    var P = G.population;
    if (!P) return;
    // 拆寺院 4600+
    P.buddhistTemplesDestroyed = (P.buddhistTemplesDestroyed || 0) + 4600;
    // 还俗 26 万
    var monks = P.byCategory && P.byCategory.sengdao;
    if (monks) {
      var reducedMonks = Math.min(monks.mouths || 0, 260000);
      monks.mouths -= reducedMonks;
      if (P.byCategory.bianhu) P.byCategory.bianhu.mouths = (P.byCategory.bianhu.mouths || 0) + reducedMonks;
    }
    // 田收国库
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + 500000;
    if (G.guoku) G.guoku.grain = (G.guoku.grain || 0) + 200000;
    // 民心：佛徒阶层怨
    if (G.minxin && G.minxin.byClass && G.minxin.byClass.clergy) {
      G.minxin.byClass.clergy.index = Math.max(0, (G.minxin.byClass.clergy.index || 60) - 25);
    }
    if (global.addEB) global.addEB('会昌毁佛', '拆寺 4600，还俗 26 万，田归国库');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F1.2 作物采用率运行时应用
  // ═══════════════════════════════════════════════════════════════════

  function _applyCropYieldBoost(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.cropAdoption) return;
    var boost = G.population._cropYieldBoost || 0;
    if (boost <= 0) return;
    // 提升各 region 的 arable yield
    if (G.population.byRegion) {
      Object.keys(G.population.byRegion).forEach(function(rid) {
        var r = G.population.byRegion[rid];
        if (r && r.carryingCapacity) {
          r.carryingCapacity.arable = Math.floor(r.carryingCapacity.arable * (1 + boost * 0.1 * mr / 12));
        }
      });
    }
    // 增全国承载力：多养活 boost × pop
    G.population._extraSupport = Math.floor((G.population.national.mouths || 0) * boost * 0.15);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F1.3 疫病民族易感
  // ═══════════════════════════════════════════════════════════════════

  var DISEASE_ETHNIC_SUSCEPTIBILITY = {
    smallpox:     { han: 0.8, mongol: 1.6, tibetan: 1.5, tangut: 1.4, miao: 1.2 },
    plague:       { han: 1.0, mongol: 1.3, tibetan: 1.2, tangut: 1.1, miao: 1.0 },
    cholera:      { han: 1.0, mongol: 1.2, tibetan: 1.0, tangut: 1.0, miao: 0.8 },
    tuberculosis: { han: 1.0, mongol: 1.2, tibetan: 1.3, tangut: 1.2, miao: 0.9 },
    malaria:      { han: 1.0, mongol: 0.7, tibetan: 0.5, tangut: 0.6, miao: 1.3 }
  };

  /** 按地区族群分布调整疫病影响 */
  function _adjustPlagueByEthnicity(event) {
    var G = global.GM;
    if (!G.population || !G.population.byRegion || !event.region) return 1.0;
    var region = G.population.byRegion[event.region];
    if (!region || !region.byEthnicity) return 1.0;
    var susc = DISEASE_ETHNIC_SUSCEPTIBILITY[event.disease];
    if (!susc) return 1.0;
    var weightedSusc = 0;
    var hanRatio = region.byEthnicity.han || 0.9;
    var otherRatio = region.byEthnicity.other || 0.1;
    weightedSusc = hanRatio * (susc.han || 1.0) + otherRatio * 1.4;  // 非汉平均易感 1.4
    return weightedSusc;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F1.4 120 色职业户籍扩展
  // ═══════════════════════════════════════════════════════════════════

  var EXTENDED_CATEGORIES_120 = [
    // 核心 10 种（已在 HujiEngine 中）
    'bianhu','junhu','jianghu','ruhu','sengdao','yuehu','danhu','nubi','huangzhuang','touxia',
    // 工职户（20+）
    'yanhu','zaohu','lianghu','juanhu','fuhu','tiehu','yaohu','kuanghu','shihu','jihu',
    // 水陆户（15+）
    'chuanhu','quhu','yijiahu','zhanchuanhu','sha tanghu','sihu','tunhu','juntunhu','minunhu','putuohu',
    // 特贡户（15+）
    'chahu','shenghu','qihu','zhenzhuhu','yuehu','jixianghu','xiangmengu','jinlinghu','yuhu','shanghu',
    // 职业户（20+）
    'yihu','zhanhu','jianghu','ditianhu','mahu','toumuhu','lihu','gonghu','shenghu','renhu',
    // 贱色（10+）
    'guanhu','gaohu','shanhu','langhu','jiahu','daihu','jiefhu','siling','gongbo','dongshu',
    // 少数族裔（15+）
    'fanhu','manzhu','huihu','menguhu','tubohu','qiangu','yihu','nahu','miaohu','luohou',
    // 其他（15+）
    'sanjieshi','laifan','wangqi','zhenqi','tribuhu','qiaohu','yixiahu','liuhu','bianhu','jieshu'
  ];

  function _enable120Categories(G) {
    if (!G.population) return;
    if (!G.population.byCategory) G.population.byCategory = {};
    var enabledFor = (G.dynasty === '元' || G.dynasty === '明') ? EXTENDED_CATEGORIES_120 :
                     (G.dynasty === '宋' || G.dynasty === '清') ? EXTENDED_CATEGORIES_120.slice(0, 60) :
                     EXTENDED_CATEGORIES_120.slice(0, 30);
    enabledFor.forEach(function(cat) {
      if (!G.population.byCategory[cat]) {
        G.population.byCategory[cat] = { mouths: 0, households: 0, ding: 0, hereditary: true, taxExempt: false, corveeExempt: false };
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F1.7 路引运行时（迁徙拦截）
  // ═══════════════════════════════════════════════════════════════════

  function _applyTravelDocRestriction(migration) {
    var G = global.GM;
    if (!G.population || !G.population.travelDocs) return migration;
    var docs = G.population.travelDocs;
    if (!docs.required) return migration;
    // 按严格度减少通过的人数
    var strictness = docs.strictness || 0.5;
    var passed = migration.volume * (1 - strictness * 0.7);
    var violations = Math.floor(migration.volume - passed);
    docs.violations = (docs.violations || 0) + violations;
    return Object.assign({}, migration, { volume: Math.floor(passed), violations: violations });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F1.8 婚育习俗（溺女/再嫁/汉胡通婚）
  // ═══════════════════════════════════════════════════════════════════

  function _tickMarriageCulture(ctx, mr) {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.marriageCulture) {
      G.population.marriageCulture = {
        femaleInfanticideRate: 0.02,   // 溺女率
        widowRemarriageRate: 0.2,       // 寡妇再嫁率
        hanOtherIntermarriage: 0.01     // 汉胡通婚
      };
    }
    var mc = G.population.marriageCulture;
    // 宋明理学 → 溺女升、再嫁降
    if (G.dynasty === '宋' || G.dynasty === '明') {
      mc.femaleInfanticideRate = Math.min(0.1, mc.femaleInfanticideRate + 0.0003 * mr);
      mc.widowRemarriageRate = Math.max(0.05, mc.widowRemarriageRate - 0.0005 * mr);
    }
    // 唐代开放 → 再嫁高
    if (G.dynasty === '唐') {
      mc.widowRemarriageRate = Math.min(0.4, mc.widowRemarriageRate + 0.001 * mr);
    }
    // 元代多族 → 通婚升
    if (G.dynasty === '元' || G.dynasty === '清') {
      mc.hanOtherIntermarriage = Math.min(0.1, mc.hanOtherIntermarriage + 0.0005 * mr);
    }
    // 应用到人口（按溺女率影响性别比）
    if (G.population.byRegion) {
      Object.values(G.population.byRegion).forEach(function(r) {
        if (r.byGender) {
          // 溺女年度调整
          var lost = Math.floor((r.byGender.female || 0) * mc.femaleInfanticideRate * 0.001 * mr);
          r.byGender.female = Math.max(0, r.byGender.female - lost);
          r.byGender.sexRatio = (r.byGender.male || 0) / Math.max(1, r.byGender.female);
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F1.9 少数民族动态
  // ═══════════════════════════════════════════════════════════════════

  function _tickEthnicDynamics(ctx, mr) {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.ethnicDynamics) {
      G.population.ethnicDynamics = {
        sinicizationRate: 0.01,     // 汉化速率/年
        rebellionRisk: 0.05,         // 叛乱风险
        jimiLoyalty: 0.7             // 羁縻忠诚度
      };
    }
    var ed = G.population.ethnicDynamics;
    // 皇威影响：高皇威 → 汉化加速、羁縻忠；低皇威 → 叛乱
    var hw = G.huangwei && G.huangwei.index || 50;
    ed.sinicizationRate = Math.max(0.001, 0.005 + (hw - 50) / 5000);
    ed.rebellionRisk = Math.max(0, 0.15 - (hw / 500));
    ed.jimiLoyalty = Math.max(0.2, Math.min(1, 0.5 + hw / 200));
    // 汉化：非汉人口转汉
    if (G.population.byRegion) {
      Object.values(G.population.byRegion).forEach(function(r) {
        if (r.byEthnicity && r.byEthnicity.other > 0) {
          var sinicized = r.byEthnicity.other * ed.sinicizationRate * mr / 12;
          r.byEthnicity.other = Math.max(0, r.byEthnicity.other - sinicized);
          r.byEthnicity.han = Math.min(1, (r.byEthnicity.han || 0.9) + sinicized);
        }
      });
    }
    // 叛乱触发（仅羁縻区）
    if (G.population.jimiHoldings) {
      G.population.jimiHoldings.forEach(function(h) {
        if (h.loyalty < 30 && Math.random() < ed.rebellionRisk * 0.01 * mr) {
          // 触发羁縻叛乱
          if (G.minxin && !G.minxin.revolts) G.minxin.revolts = [];
          if (G.minxin) G.minxin.revolts.push({
            id: 'jimi_rev_' + (ctx.turn||0), region: h.region, turn: ctx.turn||0,
            cause: '羁縻', status:'ongoing', level: 3, scale: h.mouths * 0.05
          });
          if (global.addEB) global.addEB('羁縻', h.name + ' 反叛');
          h.loyalty = Math.max(0, h.loyalty - 15);
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A6 侨置 qiaoFrom / 土断流程
  // ═══════════════════════════════════════════════════════════════════

  function setupQiaozhiFromMigration(migrationEvent) {
    var G = global.GM;
    if (!G.population) return null;
    if (!G.population.qiaozhiJunxian) G.population.qiaozhiJunxian = [];
    var qz = {
      id: 'qz_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      name: migrationEvent.name + '侨',
      qiaoFrom: migrationEvent.from || 'unknown',
      hostRegion: migrationEvent.to || 'unknown',
      mouths: migrationEvent.volume || 100000,
      createdTurn: G.turn || 0,
      status: 'active',
      taxEvasionBonus: 0.3   // 侨民暂免税
    };
    G.population.qiaozhiJunxian.push(qz);
    if (global.addEB) global.addEB('侨置', '设 ' + qz.name + ' 于 ' + qz.hostRegion);
    return qz;
  }

  /** 土断：强制侨民入本地户籍 */
  function executeTuduan(qzId) {
    var G = global.GM;
    if (!G.population || !G.population.qiaozhiJunxian) return { ok: false };
    var qz = G.population.qiaozhiJunxian.find(function(q){return q.id===qzId;});
    if (!qz) return { ok: false };
    qz.status = 'tuduan_done';
    qz.taxEvasionBonus = 0;
    // 转入编户齐民
    if (G.population.byLegalStatus && G.population.byLegalStatus.huangji) {
      G.population.byLegalStatus.huangji.mouths = (G.population.byLegalStatus.huangji.mouths || 0) + qz.mouths;
    }
    if (G.population.byLegalStatus && G.population.byLegalStatus.qiaozhi) {
      G.population.byLegalStatus.qiaozhi.mouths = Math.max(0, (G.population.byLegalStatus.qiaozhi.mouths || 0) - qz.mouths);
    }
    if (global.addEB) global.addEB('土断', qz.name + ' 土断入编，侨民归本');
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  // ── C2·radicalFrac→流民外流（2026-06-16）：乱民高的阶层向逃户守恒失血（经济牙齿）。
  //    经 populationKeys（§7.2.② 固化）/ resolvePopulationKeys 找源格子；失血率 ∝(rf-0.4)·封顶 0.8%/回合。
  function _tickRadicalFlight(ctx, mr) {
    var G = global.GM;
    if (!G || !Array.isArray(G.classes) || !G.population || !G.population.byClass) return;
    var byClass = G.population.byClass;
    var CE = global.TM && global.TM.ClassEngine;
    G.classes.forEach(function(cls) {
      if (!cls || typeof cls !== 'object') return;
      var rf = Number(cls._radicalFrac) || 0;
      if (rf < 0.4) return;   // 乱民显著才失血（与起义阈对齐）
      var keys = (cls.populationKeys && cls.populationKeys.length) ? cls.populationKeys
               : (CE && typeof CE.resolvePopulationKeys === 'function' ? CE.resolvePopulationKeys(cls, G) : []);
      var srcKey = null, k;
      for (var i = 0; i < keys.length; i += 1) {
        k = keys[i];
        if (byClass[k] && Number(byClass[k].mouths) > 0) { srcKey = k; break; }
      }
      if (!srcKey) return;
      var src = byClass[srcKey];
      var rate = Math.min((rf - 0.4) * 0.012, 0.008) * (mr || 1);   // ∝乱民·封顶 0.8%/回合
      var flee = Math.floor(Number(src.mouths) * rate);
      if (flee < 1) return;
      G.population.byLegalStatus = G.population.byLegalStatus || {};
      var taoohu = G.population.byLegalStatus.taoohu || (G.population.byLegalStatus.taoohu = { mouths: 0, _radicalSink: true });
      src.mouths = Math.max(0, Number(src.mouths) - flee);
      taoohu.mouths = (Number(taoohu.mouths) || 0) + flee;   // 守恒：失血→逃户
      G.population.hiddenCount = (Number(G.population.hiddenCount) || 0) + flee;   // C3·财政牙齿：逃亡=隐于编氓外→huji fugitive/hidden 压力→税基↓（同豪强路机制）
      cls._fledTurn = G.turn;
      cls._fledMouths = (Number(cls._fledMouths) || 0) + flee;
      // C3·督抚奏报：起义阶层流民载道入邸报（玩家可见+史册；态/乱民已在阶层正册喂 LLM）
      if (global.addEB && flee >= 200 && cls.revoltState && cls.revoltState.phase === 'uprising') {
        global.addEB('民变', (cls.name || '某阶层') + '流民载道，约' + flee + '口逃亡，隐于编氓之外·税基亏折');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C4·流寇跨省凝聚（2026-06-16·未 ship 未 commit）
  //    民变→流寇军事实体的升级阶梯（接 C2/C3 的逃户底 taoohu）：起义阶层在场且逃户池够大→逃户守恒凝成流寇(roving)；
  //    不喂新血则自溃散（守恒回逃户）·势穷瓦解。镇压(suppress)耗军饷/战损·斩首者离籍·溃散者回逃户；
  //    招抚(pacify)守恒回编户/军户 + 开恶例（合法性代价·记账·不擅动刻意自由的皇威）。
  //    注：radicalFrac/逃户现为全国级（§7.5）→ C4 做全国蓄水凝聚 + 起义省份 best-effort 标记 regions；
  //    真·区域邻接凝聚待 radicalFrac 地域化。纯增量·朝代中立（流寇/逃户/编户皆通用词）。
  function _ensureRoving(G) { if (!Array.isArray(G.rovingRebels)) G.rovingRebels = []; return G.rovingRebels; }
  function _findRoving(G, ref) {
    var list = (G && G.rovingRebels) || [];
    if (ref && typeof ref === 'object') return ref;
    if (ref != null && ref !== '') { var m = list.filter(function(r){ return r && (r.id === ref || r.name === ref); })[0]; if (m) return m; }
    // 无 ref / 未命中 → 取首股在编流寇（AI 笼统下令「剿流寇」不给精确 id 亦可执行）
    return list.filter(function(r){ return r && !r.disbanded && (Number(r.strength) || 0) > 0; })[0] || null;
  }
  function _tickRovingCoalesce(ctx, mr) {
    var G = global.GM;
    if (!G || !Array.isArray(G.classes) || !G.population) return;
    mr = mr || 1;
    var bls = G.population.byLegalStatus = G.population.byLegalStatus || {};
    var taoohu = bls.taoohu || (bls.taoohu = { mouths: 0 });
    var rebels = _ensureRoving(G);
    var turn = G.turn || (ctx && ctx.turn) || 0;
    // ②·E↔C4：按 unrestArchetype 分化造反方式——只「暴烈/哗变/倒戈」(下层揭竿/军哗变)聚为流寇；
    //   「不合作/撤离/请愿」(上层安静而致命)走隐田/抗税(已由 flight→hiddenCount 承接)·不聚流寇；无描述符默认计入(回归安全)。
    function _isViolentArchetype(c) {
      var arch = (c && c.descriptor && c.descriptor.unrestArchetype) || '';
      return !arch || /暴烈|哗变|倒戈/.test(arch);
    }
    function _isViolentUprising(c) {
      var rf = Number(c && c._radicalFrac) || 0;
      if (!((c && c.revoltState && c.revoltState.phase === 'uprising') || rf >= 0.6)) return false;
      return _isViolentArchetype(c);
    }
    var violentUprising = 0;
    G.classes.forEach(function(c) { if (_isViolentUprising(c)) violentUprising += 1; });
    // ④·地域化：收集热区（暴烈类的 per-region radicalFrac≥0.5 地域·真跨省凝聚据此·非全国近似）
    var hotReg = {};
    G.classes.forEach(function(c) {
      if (!_isViolentArchetype(c)) return;
      ((c && c.regionalVariants) || []).forEach(function(v) {
        var vrf = Number(v && v._radicalFrac) || 0;
        if (v && v.region && vrf >= 0.5) hotReg[v.region] = Math.max(hotReg[v.region] || 0, vrf);
      });
    });
    var hotList = Object.keys(hotReg).sort(function(a, b) { return hotReg[b] - hotReg[a]; });
    var pool = Number(taoohu.mouths) || 0;
    var fervor = Math.max(violentUprising, hotList.length);   // 全国级暴烈起义阶层数 或 地域热区数（取大·愈多省糜烂愈盛）
    // ── 凝聚/壮大：暴烈起义在场(全国级 或 地域热区) + 逃户池够大 → 逃户守恒入伙 ──
    if (fervor >= 1 && pool >= 50000) {
      var recruit = Math.min(Math.floor(pool * Math.min(0.12 + 0.04 * fervor, 0.35) * mr), Math.floor(pool * 0.5));
      if (recruit > 0) {
        taoohu.mouths = pool - recruit;
        var active = rebels.filter(function(r){ return r && !r.disbanded; })[0];
        if (!active) {
          active = { id: 'roving_' + turn + '_' + rebels.length, name: '流寇', strength: 0, regions: [], _bornTurn: turn, _peakStrength: 0, _lastGrewTurn: turn, disbanded: false };
          rebels.push(active);
          if (global.addEB) global.addEB('民变', '流民聚为流寇，啸聚' + recruit + '众' + (hotList.length >= 2 ? '·' + hotList.slice(0, 3).join('、') + '跨省连结' : '') + '，势成燎原');
        }
        active.strength = (Number(active.strength) || 0) + recruit;
        active._lastGrewTurn = turn;
        if (active.strength > (active._peakStrength || 0)) active._peakStrength = active.strength;
        // ④·区域标记：优先 per-region 真热区（按乱民排序·真跨省）；无热区则回退 best-effort（暴烈起义类低满意省份）
        if (hotList.length) {
          hotList.slice(0, 5).forEach(function(rg) { if (active.regions.indexOf(rg) < 0) active.regions.push(rg); });
        } else {
          G.classes.forEach(function(c) {
            if (!_isViolentUprising(c)) return;
            ((c && c.regionalVariants) || []).forEach(function(v) {
              var s = (v && v.satisfaction != null) ? Number(v.satisfaction) : 50;
              if (v && v.region && s < 30 && active.regions.indexOf(v.region) < 0) active.regions.push(v.region);
            });
          });
        }
      }
    }
    // ── 溃散（未壮大者守恒回逃户）+ 势穷瓦解 ──
    rebels.forEach(function(r) {
      if (!r || r.disbanded) return;
      if (r._lastGrewTurn !== turn) {
        var loss = Math.floor((Number(r.strength) || 0) * 0.10 * mr);
        if (loss > 0) { r.strength = (Number(r.strength) || 0) - loss; taoohu.mouths = (Number(taoohu.mouths) || 0) + loss; }
      }
      if ((Number(r.strength) || 0) < 5000) {
        taoohu.mouths = (Number(taoohu.mouths) || 0) + Math.max(0, Number(r.strength) || 0);
        r.strength = 0; r.disbanded = true;
        if (global.addEB) global.addEB('民变', (r.name || '流寇') + '势穷瓦解，余众星散为逃户');
      }
    });
    G.rovingRebels = rebels.filter(function(r){ return r && !r.disbanded; });
  }
  // 镇压：force=投入兵力 → 斩首(离籍)+溃散(回逃户)·耗军饷/战损（确定性·供 UI/AI/诏令调）
  function suppressRovingRebel(ref, force) {
    var G = global.GM;
    var r = _findRoving(G, ref);
    if (!G || !r || r.disbanded) return { ok: false };
    force = Math.max(0, Number(force) || 0);
    G.population = G.population || {};
    var bls = G.population.byLegalStatus = G.population.byLegalStatus || {};
    var taoohu = bls.taoohu || (bls.taoohu = { mouths: 0 });
    var hit = Math.min(Number(r.strength) || 0, Math.floor(force * 1.2));
    var killed = Math.floor(hit * 0.5);          // 斩获/阵亡——离籍（人口净减·镇压之实）
    var scattered = hit - killed;                // 溃散——守恒回逃户
    r.strength = (Number(r.strength) || 0) - hit;
    taoohu.mouths = (Number(taoohu.mouths) || 0) + scattered;
    var ownLoss = Math.floor(force * 0.08);      // 官军战损
    var silver = Math.floor(force * 0.5);        // 军饷耗（best-effort 扣国库）
    if (G.fiscal && isFinite(Number(G.fiscal.treasury))) G.fiscal.treasury = Number(G.fiscal.treasury) - silver;
    var disbanded = false;
    if ((Number(r.strength) || 0) < 5000) {
      taoohu.mouths = (Number(taoohu.mouths) || 0) + Math.max(0, Number(r.strength) || 0);
      r.strength = 0; r.disbanded = true; disbanded = true;
      G.rovingRebels = (G.rovingRebels || []).filter(function(x){ return x && !x.disbanded; });
    }
    if (global.addEB) global.addEB('军务', '官军剿流寇，斩获' + killed + '·溃散' + scattered + (disbanded ? '·贼势瓦解' : ''));
    return { ok: true, killed: killed, scattered: scattered, ownLoss: ownLoss, silver: silver, disbanded: disbanded };
  }
  // 招抚：流寇守恒回编户/军户 + 开恶例（合法性代价·记账）
  function pacifyRovingRebel(ref, opts) {
    var G = global.GM;
    var r = _findRoving(G, ref);
    if (!G || !r || r.disbanded) return { ok: false };
    opts = opts || {};
    var absorbed = Math.max(0, Number(r.strength) || 0);
    G.population = G.population || {};
    var bls = G.population.byLegalStatus = G.population.byLegalStatus || {};
    var huangji = bls.huangji || (bls.huangji = { mouths: 0 });
    var toMil = Math.floor(absorbed * (opts.toMilitaryFrac != null ? Number(opts.toMilitaryFrac) : 0.3));
    var toBian = absorbed - toMil;
    huangji.mouths = (Number(huangji.mouths) || 0) + toBian;
    var byClass = G.population.byClass = G.population.byClass || {};
    if (byClass.military && isFinite(Number(byClass.military.mouths))) byClass.military.mouths = Number(byClass.military.mouths) + toMil;
    else huangji.mouths += toMil;   // 无军户格子则全入编户（守恒）
    r.strength = 0; r.disbanded = true;
    G.rovingRebels = (G.rovingRebels || []).filter(function(x){ return x && !x.disbanded; });
    G._amnestyPrecedent = (Number(G._amnestyPrecedent) || 0) + 1;   // 开赦贼之恶例（合法性代价·记账·不擅动皇威）
    if (global.addEB) global.addEB('招抚', '招抚流寇' + absorbed + '众，编户' + toBian + '·军户' + toMil + '·然开赦贼之恶例');
    return { ok: true, absorbed: absorbed, toBian: toBian, toMil: toMil };
  }

  // ═══ 刀三·流寇/民变劫掠据府（给乱党牙齿·闭合刀A：逃户喂流寇→流寇劫掠→更多逃户）═══
  //   流寇/民变 此前 strength/scale 算了却无每回合危害=死数字躺列表。此处令其据府每回合：
  //   ①挂「流寇劫掠/民变扰攘」负境况(复用 RegionStatus→cascade 减税·且联动刀一灾异→减粮产·status tick 减民心)
  //   ②驱民入既有逃户池(恶性循环·有界封顶防失控)。纯增量·朝代中立·门控(无乱党/无可解析地→no-op)。
  var PLUNDER_STRENGTH_SCALE = 200000; // 流寇强度达此→劫掠烈度饱和
  var PLUNDER_ECON = 0.18;             // 流寇劫掠 econPct 上限(×烈度·RegionStatus 再夹[-0.25,0.25])
  var PLUNDER_TAOOHU_RATE = 0.02;      // 劫掠驱民入逃户=强度×此(/回合)
  var PLUNDER_TAOOHU_CAP = 20000;      // 单股流寇单回合驱民封顶(防失控)
  var PLUNDER_MAX_REGIONS = 4;         // 单股流寇单回合最多劫掠府数
  var REVOLT_PLUNDER_ECON = 0.10;      // 民变扰攘 econPct 上限(轻于流寇)
  function _tickRovingPlunder(ctx, mr) {
    var G = global.GM;
    if (!G) return;
    mr = mr || 1;
    var RS = (typeof window !== 'undefined' && window.TM && window.TM.RegionStatus) || (typeof global !== 'undefined' && global.TM && global.TM.RegionStatus) || null;
    var PU = (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.PathUtils) || (typeof window !== 'undefined' && window.TM && window.TM.AIChange && window.TM.AIChange.PathUtils) || null;
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number(n) || 0)); }
    function findDiv(name) {
      if (!name || !PU) return null;
      try { if (PU.findDivisionByNameFuzzy) { var d = PU.findDivisionByNameFuzzy(G, name); if (d) return d; } } catch (_) {}
      try { if (PU.findDivisionByNameOrId) return PU.findDivisionByNameOrId(G, name); } catch (_) {}
      return null;
    }
    var bls = G.population && (G.population.byLegalStatus || (G.population.byLegalStatus = {}));
    var taoohu = bls && (bls.taoohu || (bls.taoohu = { mouths: 0 }));
    // ① 流寇劫掠据府
    var rebels = (G.rovingRebels || []).filter(function (r) { return r && !r.disbanded && (Number(r.strength) || 0) > 0; });
    rebels.forEach(function (r) {
      var sev = clamp((Number(r.strength) || 0) / PLUNDER_STRENGTH_SCALE, 0.1, 1);
      (r.regions || []).slice(0, PLUNDER_MAX_REGIONS).forEach(function (rn) {
        var div = findDiv(rn);
        if (div && RS && typeof RS.add === 'function') {
          try { RS.add(div, { kind: 'disaster', name: '流寇劫掠', econPct: -PLUNDER_ECON * sev, minxinPerTurn: -1.5 * sev, durationTurns: 2, desc: '流寇过境·焚掠乡里', source: 'roving' }, G); } catch (_) {}
        }
      });
      if (taoohu) {
        var swell = Math.min(Math.round((Number(r.strength) || 0) * PLUNDER_TAOOHU_RATE * mr), PLUNDER_TAOOHU_CAP);
        if (swell > 0) taoohu.mouths = (Number(taoohu.mouths) || 0) + swell; // 恶性循环·有界封顶
      }
      if (global.addEB && sev >= 0.3 && (r.regions || []).length) global.addEB('民变', (r.name || '流寇') + '劫掠' + (r.regions[0] || '') + '等地，焚庐舍、掠丁壮');
    });
    // ② 民变据府扰攘（轻于流寇·按级别）
    var revolts = (G.minxin && Array.isArray(G.minxin.revolts)) ? G.minxin.revolts.filter(function (rv) { return rv && rv.status === 'ongoing' && rv.region; }) : [];
    revolts.forEach(function (rv) {
      var div = findDiv(rv.region);
      if (div && RS && typeof RS.add === 'function') {
        var lv = clamp((Number(rv.level) || 1) / 5, 0.2, 1);
        try { RS.add(div, { kind: 'disaster', name: '民变扰攘', econPct: -REVOLT_PLUNDER_ECON * lv, minxinPerTurn: -1 * lv, durationTurns: 2, desc: '民变未靖·阡陌不宁', source: 'revolt' }, G); } catch (_) {}
      }
    });
  }

  // ═══ 刀四·欠军饷→兵变/逃营（串刀二：战耗→赤字→欠饷→morale↓→逃营哗变→逃户→流寇）═══
  //   既有破产阶段令 army.morale↓ 却与兵变脱钩(数值空跌)。此处令低 morale 真有后果：逃营(守恒入逃户)·极低则哗变溃散。
  //   纯增量·朝代中立·门控(无军/morale 正常→no-op)·有界。morale 由欠饷/破产/败仗等既有机制驱动·此处只接「效果」端。
  var MUTINY_REVOLT_MORALE = 12;   // morale 低于此 + 成军 → 哗变
  var MUTINY_DESERT_MORALE = 25;   // morale 低于此 → 逃营
  var DESERT_RATE = 0.06;          // 逃营率上限(×morale 缺口)
  var MUTINY_SCATTER = 0.7;        // 哗变溃散比
  var MUTINY_MIN_ARMY = 3000;      // 成军门槛(够大才哗变·零星不算)
  var MUTINY_DISBAND_FLOOR = 1000; // 哗变后残部不足此→全军瓦解
  function _troopsOf(a) { if (typeof a.soldiers === 'number') return Math.max(0, a.soldiers); if (typeof a.strength === 'number') return Math.max(0, a.strength); if (typeof a.size === 'number') return Math.max(0, a.size); return 0; }
  function _setTroops(a, v) { v = Math.max(0, Math.round(v)); if (typeof a.soldiers === 'number') a.soldiers = v; else if (typeof a.strength === 'number') a.strength = v; else if (typeof a.size === 'number') a.size = v; else a.soldiers = v; }
  function _tickArmyMutiny(ctx, mr) {
    var G = global.GM;
    if (!G || !Array.isArray(G.armies)) return;
    mr = mr || 1;
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number(n) || 0)); }
    var bls = G.population && (G.population.byLegalStatus || (G.population.byLegalStatus = {}));
    var taoohu = bls && (bls.taoohu || (bls.taoohu = { mouths: 0 }));
    G.armies.forEach(function (a) {
      if (!a || a.disbanded) return;
      var morale = Number(a.morale); if (!isFinite(morale)) return;
      var troops = _troopsOf(a); if (troops <= 0) return;
      if (morale < MUTINY_REVOLT_MORALE && troops >= MUTINY_MIN_ARMY) {
        // 哗变：大部溃散为乱(守恒入逃户→流寇之资)·残部不足则全军瓦解
        var scatter = Math.round(troops * MUTINY_SCATTER * mr), left = troops - scatter;
        if (left < MUTINY_DISBAND_FLOOR) { scatter = troops; left = 0; a.disbanded = true; }
        _setTroops(a, left);
        if (taoohu) taoohu.mouths = (Number(taoohu.mouths) || 0) + scatter;
        a._mutiniedTurn = G.turn;
        if (global.addEB) global.addEB('军务', (a.name || '某军') + '欠饷哗变，' + scatter + '众溃散' + (a.disbanded ? '·全军瓦解' : ''));
      } else if (morale < MUTINY_DESERT_MORALE) {
        // 逃营：按 morale 缺口逃散(守恒入逃户)
        var rate = clamp(DESERT_RATE * ((MUTINY_DESERT_MORALE - morale) / MUTINY_DESERT_MORALE) * mr, 0, DESERT_RATE);
        var flee = Math.floor(troops * rate);
        if (flee > 0) {
          _setTroops(a, troops - flee);
          if (taoohu) taoohu.mouths = (Number(taoohu.mouths) || 0) + flee;
          a._desertedTurn = G.turn;
          if (global.addEB && flee >= 500) global.addEB('军务', (a.name || '某军') + '欠饷逃营 ' + flee + ' 卒');
        }
      }
    });
  }

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tickClassMobilityChain(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] classChain:') : console.error('[phaseF3] classChain:', e); }
    try { _tickRadicalFlight(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] radicalFlight:') : console.error('[phaseF3] radicalFlight:', e); }
    try { _tickRovingCoalesce(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] roving:') : console.error('[phaseF3] roving:', e); }
    try { _tickRovingPlunder(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] plunder:') : console.error('[phaseF3] plunder:', e); }
    try { _tickArmyMutiny(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] mutiny:') : console.error('[phaseF3] mutiny:', e); }
    try { _tickMagnateAnnexation(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] magnate:') : console.error('[phaseF3] magnate:', e); }
    try { _applyCropYieldBoost(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] crops:') : console.error('[phaseF3] crops:', e); }
    try { _checkHuichangDestructBuddhism(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] huichang:') : console.error('[phaseF3] huichang:', e); }
    try { _tickMarriageCulture(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] marriage:') : console.error('[phaseF3] marriage:', e); }
    try { _tickEthnicDynamics(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF3] ethnic:') : console.error('[phaseF3] ethnic:', e); }
  }

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    _enable120Categories(G);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseF3 = {
    init: init,
    tick: tick,
    _tickRadicalFlight: _tickRadicalFlight,
    _tickRovingCoalesce: _tickRovingCoalesce,
    _tickRovingPlunder: _tickRovingPlunder,
    _tickArmyMutiny: _tickArmyMutiny,
    suppressRovingRebel: suppressRovingRebel,
    pacifyRovingRebel: pacifyRovingRebel,
    applyTravelDocRestriction: _applyTravelDocRestriction,
    adjustPlagueByEthnicity: _adjustPlagueByEthnicity,
    setupQiaozhiFromMigration: setupQiaozhiFromMigration,
    executeTuduan: executeTuduan,
    EXTENDED_CATEGORIES_120: EXTENDED_CATEGORIES_120,
    DISEASE_ETHNIC_SUSCEPTIBILITY: DISEASE_ETHNIC_SUSCEPTIBILITY,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
