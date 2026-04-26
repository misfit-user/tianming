// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-editor-division-deep.js — 行政区划编辑器深化字段扩展
 *
 * 把方案要求的 region.population 三元/bySettlement/baojia/byAge/byGender/byEthnicity/
 * byFaith/carryingCapacity/minxin/corruption/fiscal/publicTreasury/regionType/
 * autonomyLevel 等字段挂到编辑器"行政单位编辑"上。
 *
 * 原则：
 *   - 不破坏原有 UI（保留基础字段）
 *   - 新增"深化配置"折叠区
 *   - 所有字段支持 AI 智能生成（按剧本朝代/地理/类型自动填充）
 */
(function(global) {
  'use strict';

  function _fmtNum(n) { return (n == null || isNaN(n)) ? '0' : String(n); }
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')); }

  // 初始化 division 深化字段默认值
  function _ensureDivisionDeepFields(node) {
    if (!node) return;
    if (!node.populationDetail) {
      var pop = node.population || 50000;
      node.populationDetail = {
        households: Math.floor(pop / 5),
        mouths: pop,
        ding: Math.floor(pop * 0.25),
        fugitives: 0,
        hiddenCount: 0
      };
    }
    if (!node.bySettlement) {
      var hh = node.populationDetail.households;
      var mo = node.populationDetail.mouths;
      node.bySettlement = {
        fang: { mouths: Math.floor(mo*0.08), households: Math.floor(hh*0.08) },
        shi:  { mouths: Math.floor(mo*0.05), households: Math.floor(hh*0.05) },
        zhen: { mouths: Math.floor(mo*0.15), households: Math.floor(hh*0.15) },
        cun:  { mouths: Math.floor(mo*0.72), households: Math.floor(hh*0.72) }
      };
    }
    if (!node.baojia) {
      node.baojia = {
        baoCount: Math.floor((node.populationDetail.households||10000) / 100),
        jiaCount: Math.floor((node.populationDetail.households||10000) / 10),
        paiCount: Math.floor((node.populationDetail.households||10000) / 10),
        leadingGentry: [],
        registerAccuracy: 0.75
      };
    }
    if (!node.byGender) {
      var mo2 = node.populationDetail.mouths || 50000;
      var ratio = 1.04;
      node.byGender = {
        male: Math.floor(mo2 * ratio / (1+ratio)),
        female: Math.floor(mo2 / (1+ratio)),
        sexRatio: ratio
      };
    }
    if (!node.byEthnicity) node.byEthnicity = { '汉': 0.95, '其他': 0.05 };
    if (!node.byFaith) node.byFaith = { '儒': 0.3, '佛': 0.2, '道': 0.15, '民间': 0.35 };
    if (!node.carryingCapacity) {
      node.carryingCapacity = {
        arable: node.populationDetail.mouths * 1.2,
        water: node.populationDetail.mouths * 1.1,
        climate: 1.0,
        historicalCap: node.populationDetail.mouths * 1.3,
        currentLoad: 0.8,
        carryingRegime: 'balanced'
      };
    }
    if (node.minxinLocal === undefined) node.minxinLocal = 60;
    if (node.corruptionLocal === undefined) node.corruptionLocal = 30;
    if (!node.fiscalDetail) {
      var pop3 = node.populationDetail.mouths;
      var annual = pop3 * 1.5;  // 按人头 1.5 两估
      node.fiscalDetail = {
        claimedRevenue: Math.round(annual),
        actualRevenue:  Math.round(annual * 0.85),
        remittedToCenter: Math.round(annual * 0.6),
        retainedBudget: Math.round(annual * 0.25),
        compliance: 0.7,
        skimmingRate: 0.1,
        autonomyLevel: 0.3
      };
    }
    if (!node.publicTreasuryInit) {
      node.publicTreasuryInit = {
        money: 100000, grain: 50000, cloth: 20000
      };
    }
    if (!node.regionType) node.regionType = 'normal';  // normal/jimi/tusi/fanbang/imperial_clan
    if (!node.byAge) {
      var tot = node.populationDetail.mouths;
      node.byAge = {
        old:   { count: Math.floor(tot*0.15), ratio: 0.15 },
        ding:  { count: Math.floor(tot*0.55), ratio: 0.55 },
        young: { count: Math.floor(tot*0.30), ratio: 0.30 }
      };
    }
  }

  // 深化字段 UI 渲染
  function renderDivisionDeepFieldsHTML(node) {
    _ensureDivisionDeepFields(node);
    var h = '<details open style="margin-top:12px;padding:8px;background:#222;border-left:3px solid #b89a53;border-radius:4px;">';
    h += '<summary style="cursor:pointer;color:#b89a53;font-weight:600;">深化配置（户口三元·承载力·民心·吏治·公库·区划类型 等）';
    h += ' <button type="button" onclick="event.preventDefault();aiGenDivisionDeep(this)" style="margin-left:8px;padding:3px 10px;background:#b89a53;color:#fff;border:none;border-radius:3px;cursor:pointer;">🪄 AI 智能填充</button>';
    h += '</summary>';

    // 区划类型
    h += '<div style="margin-top:10px;"><label style="color:#bbb;font-size:12px;">区划类型</label>';
    h += '<select id="dd-regionType" style="width:100%;padding:5px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;">';
    ['normal','jimi','tusi','fanbang','imperial_clan'].forEach(function(t) {
      var labels = {normal:'普通州县', jimi:'羁縻府州', tusi:'土司辖地', fanbang:'藩属/朝贡', imperial_clan:'宗藩王封'};
      h += '<option value="' + t + '"' + (node.regionType===t?' selected':'') + '>' + labels[t] + '</option>';
    });
    h += '</select></div>';

    // 自治度
    h += '<div style="margin-top:8px;"><label style="color:#bbb;font-size:12px;">自治度（0=中央直管，1=完全自治）</label>';
    h += '<input type="number" id="dd-autonomyLevel" step="0.05" min="0" max="1" value="' + (node.fiscalDetail && node.fiscalDetail.autonomyLevel || 0.3) + '" style="width:100%;padding:5px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';

    // 户口三元
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">户口三元</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">户数</label><input type="number" id="dd-households" value="' + _fmtNum(node.populationDetail.households) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">口数</label><input type="number" id="dd-mouths" value="' + _fmtNum(node.populationDetail.mouths) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">丁数</label><input type="number" id="dd-ding" value="' + _fmtNum(node.populationDetail.ding) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 逃隐
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">';
    h += '<div><label style="font-size:11px;">逃户</label><input type="number" id="dd-fugitives" value="' + _fmtNum(node.populationDetail.fugitives) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">隐户</label><input type="number" id="dd-hidden" value="' + _fmtNum(node.populationDetail.hiddenCount) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 民心 / 吏治
    h += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    h += '<div><label style="color:#bbb;font-size:12px;">地方民心（0-100）</label><input type="number" id="dd-minxin" min="0" max="100" value="' + _fmtNum(node.minxinLocal) + '" style="width:100%;padding:5px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="color:#bbb;font-size:12px;">地方腐败（0-100）</label><input type="number" id="dd-corr" min="0" max="100" value="' + _fmtNum(node.corruptionLocal) + '" style="width:100%;padding:5px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 财政
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">财政（本区年赋税）</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">名义</label><input type="number" id="dd-claimedRev" value="' + _fmtNum(node.fiscalDetail.claimedRevenue) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">实征</label><input type="number" id="dd-actualRev" value="' + _fmtNum(node.fiscalDetail.actualRevenue) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">起运</label><input type="number" id="dd-remitted" value="' + _fmtNum(node.fiscalDetail.remittedToCenter) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">';
    h += '<div><label style="font-size:11px;">留存</label><input type="number" id="dd-retained" value="' + _fmtNum(node.fiscalDetail.retainedBudget) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">合规率</label><input type="number" step="0.05" min="0" max="1" id="dd-compliance" value="' + (node.fiscalDetail.compliance || 0.7) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 公库初值
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">公库初值</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">银</label><input type="number" id="dd-pt-money" value="' + _fmtNum(node.publicTreasuryInit.money) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">粮</label><input type="number" id="dd-pt-grain" value="' + _fmtNum(node.publicTreasuryInit.grain) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">布</label><input type="number" id="dd-pt-cloth" value="' + _fmtNum(node.publicTreasuryInit.cloth) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 承载力
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">承载力</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">耕地养活</label><input type="number" id="dd-cc-arable" value="' + _fmtNum(node.carryingCapacity.arable) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">水源上限</label><input type="number" id="dd-cc-water" value="' + _fmtNum(node.carryingCapacity.water) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">气候系数</label><input type="number" step="0.05" id="dd-cc-climate" value="' + (node.carryingCapacity.climate || 1) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">当前负载</label><input type="number" step="0.05" id="dd-cc-load" value="' + (node.carryingCapacity.currentLoad || 0.8) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 族群 / 宗教（JSON）
    h += '<div style="margin-top:10px;">';
    h += '<label style="color:#bbb;font-size:12px;">族群比例 JSON</label>';
    h += '<textarea id="dd-ethnicity" rows="2" style="width:100%;padding:5px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;font-family:monospace;font-size:11px;">' + _esc(JSON.stringify(node.byEthnicity||{})) + '</textarea>';
    h += '</div>';
    h += '<div style="margin-top:6px;">';
    h += '<label style="color:#bbb;font-size:12px;">宗教比例 JSON</label>';
    h += '<textarea id="dd-faith" rows="2" style="width:100%;padding:5px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;font-family:monospace;font-size:11px;">' + _esc(JSON.stringify(node.byFaith||{})) + '</textarea>';
    h += '</div>';

    // 男女比
    h += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:12px;color:#bbb;">男</label><input type="number" id="dd-male" value="' + _fmtNum(node.byGender.male) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:12px;color:#bbb;">女</label><input type="number" id="dd-female" value="' + _fmtNum(node.byGender.female) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:12px;color:#bbb;">男女比</label><input type="number" step="0.01" id="dd-sexRatio" value="' + (node.byGender.sexRatio || 1.04) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // 保甲
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">保甲/里甲</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">保数</label><input type="number" id="dd-bao" value="' + _fmtNum(node.baojia.baoCount) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">甲数</label><input type="number" id="dd-jia" value="' + _fmtNum(node.baojia.jiaCount) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">牌数</label><input type="number" id="dd-pai" value="' + _fmtNum(node.baojia.paiCount) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">准确度</label><input type="number" step="0.05" min="0" max="1" id="dd-regAcc" value="' + (node.baojia.registerAccuracy || 0.75) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';

    // ★ 经济基础（嵌套折叠）·7 字段 + 5 boolean tag
    var eb = node.economyBase || {};
    var tg = node.tags || {};
    h += '<details style="margin-top:12px;padding:8px;background:#1d1d1d;border-left:3px solid #6aa88a;border-radius:4px;">';
    h += '<summary style="cursor:pointer;color:#6aa88a;font-weight:600;font-size:13px;">经济基础（田/商/矿/盐/马/渔/海贸·7 字段 + 5 区域标签）</summary>';
    // 5 boolean tags
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">区域属性标签</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;">';
    [['hasPort','沿海港(开市舶)'],['saltRegion','产盐区'],['mineralRegion','产矿区'],['horseRegion','草场马政'],['fishingRegion','渔区'],['imperialDomain','皇室直辖(皇庄/皇产)']].forEach(function(p) {
      h += '<label style="color:#bbb;display:flex;align-items:center;gap:4px;padding:3px;"><input type="checkbox" id="dd-tag-' + p[0] + '"' + (tg[p[0]] ? ' checked' : '') + '> ' + p[1] + '</label>';
    });
    h += '</div>';
    // 7 数值字段（commerceCoefficient 算第 8 个，但归商业组）
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">耕地·商业</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">耕地(亩)</label><input type="number" id="dd-eb-farmland" value="' + _fmtNum(eb.farmland) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">商业繁荣度</label><input type="number" id="dd-eb-commerce" value="' + _fmtNum(eb.commerceVolume) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">商业系数</label><input type="number" step="0.1" min="0.2" max="6" id="dd-eb-commCoef" value="' + (eb.commerceCoefficient != null ? eb.commerceCoefficient : 1.0) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;" title="0.3=边远·1.0=一般·3.0=大商埠·5.0=京师"></div>';
    h += '</div>';
    h += '<div style="margin-top:8px;color:#bbb;font-size:12px;">资源产能（仅当对应 tag 启用时计入）</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">海贸活动量</label><input type="number" id="dd-eb-maritime" value="' + _fmtNum(eb.maritimeTradeVolume) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">盐产(斤/年)</label><input type="number" id="dd-eb-salt" value="' + _fmtNum(eb.saltProduction) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px;">';
    h += '<div><label style="font-size:11px;">矿产(两/年)</label><input type="number" id="dd-eb-mineral" value="' + _fmtNum(eb.mineralProduction) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">年产马匹</label><input type="number" id="dd-eb-horse" value="' + _fmtNum(eb.horseProduction) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">渔产(两/年)</label><input type="number" id="dd-eb-fishing" value="' + _fmtNum(eb.fishingProduction) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';
    // 皇室直辖资产（imperialDomain tag 触发）
    h += '<div style="margin-top:10px;color:#bbb;font-size:12px;">皇室直辖（仅 imperialDomain 启用时计入内帑）</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">皇庄亩数</label><input type="number" id="dd-eb-impFarm" value="' + _fmtNum(eb.imperialFarmland) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    var ia = eb.imperialAssets || {};
    h += '<div><label style="font-size:11px;">织造局数</label><input type="number" id="dd-eb-impZhizao" min="0" value="' + _fmtNum(ia.zhizao) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">矿场数</label><input type="number" id="dd-eb-impKuang" min="0" value="' + _fmtNum(ia.kuangchang) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">御窑数</label><input type="number" id="dd-eb-impYao" min="0" value="' + _fmtNum(ia.yuyao) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';
    // 驿递·科举解额
    h += '<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    h += '<div><label style="font-size:11px;">驿站数</label><input type="number" id="dd-eb-postRelays" min="0" value="' + _fmtNum(eb.postRelays) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '<div><label style="font-size:11px;">科举解额</label><input type="number" id="dd-eb-kejuQuota" min="0" value="' + _fmtNum(eb.kejuQuota) + '" style="width:100%;padding:4px;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;"></div>';
    h += '</div>';
    h += '</details>';

    h += '</details>';
    return h;
  }

  // 从 UI 表单收集深化字段写回 node
  function collectDivisionDeepFromForm(node) {
    function val(id) { var el = document.getElementById(id); return el ? el.value : null; }
    function num(id) { var v = val(id); return v == null || v === '' ? null : Number(v); }
    _ensureDivisionDeepFields(node);
    // 区划类型
    var rt = val('dd-regionType'); if (rt) node.regionType = rt;
    var al = num('dd-autonomyLevel'); if (al !== null) (node.fiscalDetail = node.fiscalDetail || {}).autonomyLevel = al;
    // 户口
    var hh = num('dd-households'); if (hh !== null) node.populationDetail.households = hh;
    var mo = num('dd-mouths'); if (mo !== null) { node.populationDetail.mouths = mo; node.population = mo; }
    var dd = num('dd-ding'); if (dd !== null) node.populationDetail.ding = dd;
    var fg = num('dd-fugitives'); if (fg !== null) node.populationDetail.fugitives = fg;
    var hi = num('dd-hidden'); if (hi !== null) node.populationDetail.hiddenCount = hi;
    // 民心 / 吏治
    var mx = num('dd-minxin'); if (mx !== null) node.minxinLocal = mx;
    var co = num('dd-corr'); if (co !== null) node.corruptionLocal = co;
    // 财政
    var cr = num('dd-claimedRev'); if (cr !== null) node.fiscalDetail.claimedRevenue = cr;
    var ar = num('dd-actualRev'); if (ar !== null) node.fiscalDetail.actualRevenue = ar;
    var rm = num('dd-remitted'); if (rm !== null) node.fiscalDetail.remittedToCenter = rm;
    var rt2 = num('dd-retained'); if (rt2 !== null) node.fiscalDetail.retainedBudget = rt2;
    var cp = num('dd-compliance'); if (cp !== null) node.fiscalDetail.compliance = cp;
    // 公库
    var pm = num('dd-pt-money'); if (pm !== null) node.publicTreasuryInit.money = pm;
    var pg = num('dd-pt-grain'); if (pg !== null) node.publicTreasuryInit.grain = pg;
    var pc = num('dd-pt-cloth'); if (pc !== null) node.publicTreasuryInit.cloth = pc;
    // 承载力
    var ca = num('dd-cc-arable'); if (ca !== null) node.carryingCapacity.arable = ca;
    var cw = num('dd-cc-water'); if (cw !== null) node.carryingCapacity.water = cw;
    var cc = num('dd-cc-climate'); if (cc !== null) node.carryingCapacity.climate = cc;
    var cl = num('dd-cc-load'); if (cl !== null) node.carryingCapacity.currentLoad = cl;
    // 族群 / 宗教
    try { var et = val('dd-ethnicity'); if (et) node.byEthnicity = JSON.parse(et); } catch(e){}
    try { var ft = val('dd-faith'); if (ft) node.byFaith = JSON.parse(ft); } catch(e){}
    // 男女
    var ma = num('dd-male'); if (ma !== null) node.byGender.male = ma;
    var fe = num('dd-female'); if (fe !== null) node.byGender.female = fe;
    var sr = num('dd-sexRatio'); if (sr !== null) node.byGender.sexRatio = sr;
    // 保甲
    var bc = num('dd-bao'); if (bc !== null) node.baojia.baoCount = bc;
    var jc = num('dd-jia'); if (jc !== null) node.baojia.jiaCount = jc;
    var pac = num('dd-pai'); if (pac !== null) node.baojia.paiCount = pac;
    var ra = num('dd-regAcc'); if (ra !== null) node.baojia.registerAccuracy = ra;
    // ★ 经济基础·5 boolean tag + 7 数值
    if (!node.tags) node.tags = {};
    if (!node.economyBase) node.economyBase = {};
    function chk(id) { var el = document.getElementById(id); return el ? !!el.checked : null; }
    ['hasPort','saltRegion','mineralRegion','horseRegion','fishingRegion','imperialDomain'].forEach(function(k) {
      var v = chk('dd-tag-' + k); if (v !== null) node.tags[k] = v;
    });
    var ebF = num('dd-eb-farmland'); if (ebF !== null) node.economyBase.farmland = ebF;
    var ebC = num('dd-eb-commerce'); if (ebC !== null) node.economyBase.commerceVolume = ebC;
    var ebCc = num('dd-eb-commCoef'); if (ebCc !== null) node.economyBase.commerceCoefficient = ebCc;
    var ebM = num('dd-eb-maritime'); if (ebM !== null) node.economyBase.maritimeTradeVolume = ebM;
    var ebS = num('dd-eb-salt'); if (ebS !== null) node.economyBase.saltProduction = ebS;
    var ebMin = num('dd-eb-mineral'); if (ebMin !== null) node.economyBase.mineralProduction = ebMin;
    var ebH = num('dd-eb-horse'); if (ebH !== null) node.economyBase.horseProduction = ebH;
    var ebFsh = num('dd-eb-fishing'); if (ebFsh !== null) node.economyBase.fishingProduction = ebFsh;
    // 皇室直辖资产 / 驿递 / 科举
    var ebIF = num('dd-eb-impFarm'); if (ebIF !== null) node.economyBase.imperialFarmland = ebIF;
    if (!node.economyBase.imperialAssets) node.economyBase.imperialAssets = {};
    var ebIz = num('dd-eb-impZhizao'); if (ebIz !== null) node.economyBase.imperialAssets.zhizao = ebIz;
    var ebIk = num('dd-eb-impKuang'); if (ebIk !== null) node.economyBase.imperialAssets.kuangchang = ebIk;
    var ebIy = num('dd-eb-impYao'); if (ebIy !== null) node.economyBase.imperialAssets.yuyao = ebIy;
    var ebPr = num('dd-eb-postRelays'); if (ebPr !== null) node.economyBase.postRelays = ebPr;
    var ebKq = num('dd-eb-kejuQuota'); if (ebKq !== null) node.economyBase.kejuQuota = ebKq;
  }

  // AI 智能填充（按剧本朝代/区划名/地形 推断合理值）
  async function aiGenDivisionDeep(btn) {
    if (typeof global.callAI !== 'function') {
      if (global.toast) global.toast('未配置 AI');
      return;
    }
    btn.disabled = true;
    btn.textContent = '生成中…';
    try {
      // 读当前编辑中 node 的基本信息
      var name = (document.getElementById('division-name')||{}).value || '某区划';
      var level = (document.getElementById('division-level')||{}).value || 'province';
      var terrain = (document.getElementById('division-terrain')||{}).value || '平原';
      var pop = Number((document.getElementById('division-population')||{}).value) || 50000;
      var dynasty = (global.P && global.P.dynasty) || (global.scriptData && global.scriptData.dynasty) || '唐';
      var era = (global.scriptData && global.scriptData.era) || '';

      var prompt = '你是中国历史行政区划专家。按' + dynasty + '(' + era + ')时期的真实数据，为区划"' + _esc(name) + '"（级别:' + level + '，地形:' + terrain + '，总人口约' + pop + '）生成深化字段。\n\n要求严格返回 JSON：\n' +
        '{\n' +
        '  "households": 数字, "mouths": 数字, "ding": 数字,\n' +
        '  "fugitives": 数字, "hiddenCount": 数字,\n' +
        '  "minxinLocal": 0-100, "corruptionLocal": 0-100,\n' +
        '  "regionType": "normal|jimi|tusi|fanbang|imperial_clan",\n' +
        '  "autonomyLevel": 0-1,\n' +
        '  "claimedRevenue": 数字, "actualRevenue": 数字, "remittedToCenter": 数字, "retainedBudget": 数字, "compliance": 0-1,\n' +
        '  "publicTreasury": {"money":数字,"grain":数字,"cloth":数字},\n' +
        '  "carrying": {"arable":数字,"water":数字,"climate":0.7-1.3,"currentLoad":0.3-1.3},\n' +
        '  "byEthnicity": {"汉":比例,"其他":比例},\n' +
        '  "byFaith": {"儒":比例,"佛":比例,"道":比例,"民间":比例},\n' +
        '  "byGender": {"male":数字,"female":数字,"sexRatio":1.0-1.1},\n' +
        '  "baojia": {"baoCount":数字,"jiaCount":数字,"paiCount":数字,"registerAccuracy":0.5-0.95},\n' +
        '  "tags": {"hasPort":是否沿海港,"saltRegion":是否产盐,"mineralRegion":是否产矿,"horseRegion":是否草场,"fishingRegion":是否渔区,"imperialDomain":是否皇室直辖},\n' +
        '  "economyBase": {"farmland":亩数,"commerceVolume":商业绝对量,"commerceCoefficient":0.3边远~5.0京师,"maritimeTradeVolume":海贸量(无港=0),"saltProduction":年产盐斤(非产盐=0),"mineralProduction":两/年(非产矿=0),"horseProduction":年产马匹(非草场=0),"fishingProduction":两/年(非渔区=0),"imperialFarmland":皇庄亩数(非皇室直辖=0),"imperialAssets":{"zhizao":织造局数,"kuangchang":矿场数,"yuyao":御窑数},"postRelays":驿站数,"kejuQuota":解额数}\n' +
        '}\n\n必须符合历史：朝代族群（如唐西域有胡人羌人，宋江南以汉人为主，元有四等人，明清有满蒙回等）；宗教（唐佛道并盛，宋新儒学兴，元藏传佛教；外族地有伊斯兰/萨满）；边疆自治度高；繁荣地合规高；经济基础按地理特征（淮南/长芦/河东产盐；甘陕青草场；闽粤江浙渔区+沿海港；云贵川铜矿银矿）；commerceCoefficient 京师 4-5/江南苏扬 3-4/普通 1.0/边远 0.4-0.7。只输出 JSON。';

      var resp = await global.callAI(prompt, 1800);
      var jm = resp.match(/\{[\s\S]*\}/);
      if (!jm) throw new Error('未返回有效 JSON');
      var data = JSON.parse(jm[0]);

      // 填表单
      function setVal(id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; }
      setVal('dd-households', data.households);
      setVal('dd-mouths', data.mouths);
      setVal('dd-ding', data.ding);
      setVal('dd-fugitives', data.fugitives);
      setVal('dd-hidden', data.hiddenCount);
      setVal('dd-minxin', data.minxinLocal);
      setVal('dd-corr', data.corruptionLocal);
      setVal('dd-regionType', data.regionType);
      setVal('dd-autonomyLevel', data.autonomyLevel);
      setVal('dd-claimedRev', data.claimedRevenue);
      setVal('dd-actualRev', data.actualRevenue);
      setVal('dd-remitted', data.remittedToCenter);
      setVal('dd-retained', data.retainedBudget);
      setVal('dd-compliance', data.compliance);
      if (data.publicTreasury) {
        setVal('dd-pt-money', data.publicTreasury.money);
        setVal('dd-pt-grain', data.publicTreasury.grain);
        setVal('dd-pt-cloth', data.publicTreasury.cloth);
      }
      if (data.carrying) {
        setVal('dd-cc-arable', data.carrying.arable);
        setVal('dd-cc-water', data.carrying.water);
        setVal('dd-cc-climate', data.carrying.climate);
        setVal('dd-cc-load', data.carrying.currentLoad);
      }
      if (data.byEthnicity) setVal('dd-ethnicity', JSON.stringify(data.byEthnicity));
      if (data.byFaith) setVal('dd-faith', JSON.stringify(data.byFaith));
      if (data.byGender) {
        setVal('dd-male', data.byGender.male);
        setVal('dd-female', data.byGender.female);
        setVal('dd-sexRatio', data.byGender.sexRatio);
      }
      if (data.baojia) {
        setVal('dd-bao', data.baojia.baoCount);
        setVal('dd-jia', data.baojia.jiaCount);
        setVal('dd-pai', data.baojia.paiCount);
        setVal('dd-regAcc', data.baojia.registerAccuracy);
      }
      if (data.tags) {
        ['hasPort','saltRegion','mineralRegion','horseRegion','fishingRegion','imperialDomain'].forEach(function(k) {
          var el = document.getElementById('dd-tag-' + k);
          if (el) el.checked = !!data.tags[k];
        });
      }
      if (data.economyBase) {
        setVal('dd-eb-farmland', data.economyBase.farmland);
        setVal('dd-eb-commerce', data.economyBase.commerceVolume);
        setVal('dd-eb-commCoef', data.economyBase.commerceCoefficient);
        setVal('dd-eb-maritime', data.economyBase.maritimeTradeVolume);
        setVal('dd-eb-salt', data.economyBase.saltProduction);
        setVal('dd-eb-mineral', data.economyBase.mineralProduction);
        setVal('dd-eb-horse', data.economyBase.horseProduction);
        setVal('dd-eb-fishing', data.economyBase.fishingProduction);
        setVal('dd-eb-impFarm', data.economyBase.imperialFarmland);
        if (data.economyBase.imperialAssets) {
          setVal('dd-eb-impZhizao', data.economyBase.imperialAssets.zhizao);
          setVal('dd-eb-impKuang', data.economyBase.imperialAssets.kuangchang);
          setVal('dd-eb-impYao', data.economyBase.imperialAssets.yuyao);
        }
        setVal('dd-eb-postRelays', data.economyBase.postRelays);
        setVal('dd-eb-kejuQuota', data.economyBase.kejuQuota);
      }
      if (global.toast) global.toast('✓ 已智能填充');
    } catch(e) {
      console.error('[editor-div-deep] AI:', e);
      if (global.toast) global.toast('AI 生成失败：' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🪄 AI 智能填充';
    }
  }

  // Wrap openGenericModal/addAdminDivision/editAdminDivision 注入深化 UI + save 合并
  //
  // 注意：编辑器使用 #genericModalBody（由 editor-ai-gen.js.openGenericModal 管理），
  // 老版 hook 找 .modal-overlay 不存在的 selector，是无效的。
  // 改用：劫持 addAdminDivision/editAdminDivision，把 node 保存到 window._dd_currentNode，
  //       然后拦截 openGenericModal 在"添加行政单位"/"编辑行政单位"标题时追加深化字段；
  //       保存时 capture-阶段 collectDivisionDeepFromForm(node)。
  function installEditorHook() {
    if (global._editAdminDivisionEnhanced) return;
    // 兜住 add/edit，记录当前 node
    function _wrapFn(fnName, modeLabel) {
      if (typeof global[fnName] !== 'function') return;
      if (global['_' + fnName + '_enhanced']) return;
      var orig = global[fnName];
      global[fnName] = function() {
        if (modeLabel === 'add') {
          // addAdminDivision 形参 parentNode；新 node 尚未创建——等 onSave 时再合并到末尾
          global._dd_mode = 'add';
          global._dd_currentNode = null;
          global._dd_parentNode = arguments[0] || null;
        } else {
          global._dd_mode = 'edit';
          global._dd_currentNode = arguments[0] || null;
          global._dd_parentNode = null;
        }
        return orig.apply(this, arguments);
      };
      global['_' + fnName + '_enhanced'] = true;
    }
    _wrapFn('addAdminDivision', 'add');
    _wrapFn('editAdminDivision', 'edit');

    // 劫持 openGenericModal：仅处理区划 modal
    if (!global._openGenericModal_divDeepWrapped && typeof global.openGenericModal === 'function') {
      var origOpen = global.openGenericModal;
      global.openGenericModal = function(title, body, onOk) {
        var isDivModal = (title === '添加行政单位' || title === '编辑行政单位');
        if (!isDivModal) {
          return origOpen.call(this, title, body, onOk);
        }
        // 渲染原 body + 深化字段
        var nodeForDeep = global._dd_mode === 'edit' ? (global._dd_currentNode || {}) : {};
        var deepHtml = renderDivisionDeepFieldsHTML(nodeForDeep);
        var newBody = body + deepHtml;

        var origOk = onOk;
        var wrappedOk = function() {
          var r = origOk.apply(this, arguments);
          // 原 onSave 已把 newDivision push 或更新了 node
          setTimeout(function() {
            try {
              var target = null;
              if (global._dd_mode === 'edit') {
                target = global._dd_currentNode;
              } else if (global._dd_mode === 'add') {
                // 新增：从 parentNode.children 或 adminHierarchy.divisions 取末位
                if (global._dd_parentNode && Array.isArray(global._dd_parentNode.children)) {
                  target = global._dd_parentNode.children[global._dd_parentNode.children.length - 1] || null;
                } else if (typeof global.getCurrentAdminHierarchy === 'function') {
                  var ah = global.getCurrentAdminHierarchy();
                  if (ah && Array.isArray(ah.divisions)) target = ah.divisions[ah.divisions.length - 1] || null;
                }
              }
              if (target) collectDivisionDeepFromForm(target);
            } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'editor-div-deep] save merge:') : console.error('[editor-div-deep] save merge:', e); }
            global._dd_mode = null;
            global._dd_currentNode = null;
            global._dd_parentNode = null;
            if (typeof global.renderAdminTree === 'function') global.renderAdminTree();
          }, 30);
          return r;
        };
        return origOpen.call(this, title, newBody, wrappedOk);
      };
      global._openGenericModal_divDeepWrapped = true;
    }

    // 若 openGenericModal 或 *AdminDivision 尚未出现，重试一次
    if (typeof global.openGenericModal !== 'function' || typeof global.addAdminDivision !== 'function') {
      setTimeout(installEditorHook, 600);
      return;
    }
    global._editAdminDivisionEnhanced = true;
  }

  // 暴露
  global.aiGenDivisionDeep = aiGenDivisionDeep;
  global.renderDivisionDeepFieldsHTML = renderDivisionDeepFieldsHTML;
  global.collectDivisionDeepFromForm = collectDivisionDeepFromForm;
  global._ensureDivisionDeepFields = _ensureDivisionDeepFields;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installEditorHook);
    else installEditorHook();
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
