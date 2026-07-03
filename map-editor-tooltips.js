// map-editor-tooltips.js
// Phase 18.4·field tooltip + help dict
// 50+ 字段释义·hover 1s 显·tooltip 浮 box·panel.js 渲染后自动 attach
// dict 按 data-f 字段名索引·label 也可显·部分别名映射
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[tooltips] core not loaded'); return; }

  // ─── 释义 dict ─────────────────────────────────────────

  var DICT = {
    // basic
    'name': { t: '省名', d: '此区划的显示名·支持中文 / 拼音·建议简短' },
    'level': { t: '级别', d: '行政级别·按朝代不同·秦汉郡县·唐道州县·宋路府县·明清省府县' },
    'description': { t: '备注', d: '编辑器内部备注·不进游戏·只供考据 / 提醒' },
    'officialPosition': { t: '官职', d: '此区划主官职位·如·太守 / 刺史 / 节度使 / 知府' },
    'governor': { t: '当任长官', d: '当前主政人物名·真实历史 or 虚构·游戏中可被叛 / 升迁' },
    'dejureOwner': { t: '法定归属', d: '从法理上属哪派 / 国·与实控可能不同 (e.g., 北宋·辽实控但 dejure 宋)' },
    'regionType': { t: '区域类', d: '中央 / 边境 / 海外·影响戍兵·税法·任命规则' },
    'region': { t: '地理区', d: '更细的地区分类·如关中 / 江南 / 河北·用于 AI 决策' },
    'treats_as': { t: '边界类', d: '是否边境·影响军事·与 regionType 联动' },
    'treaty_year': { t: '条约年', d: '若此地在某条约中明确归属·填条约签订年' },
    'z_order': { t: '覆盖序', d: '渲染层级·高的覆盖低的·处理飞地遮挡' },
    'capitalChildId': { t: '首邑子', d: '此区划的首府所在子区划·继承 governor / tax 显示' },
    'crossDynastyId': { t: '跨朝同地', d: '若此地在多朝代地图中是同一处 (e.g., 长安在汉 / 唐 / 明)·填同 ID 链' },

    // pop tab
    'population': { t: '总人口', d: '此区划估计人口·单位·人·与税基 / 兵员相关' },
    'urbanRatio': { t: '城市化率', d: '城居 / 农居比例·0-1·影响商税·徭役' },
    'literacyRate': { t: '识字率', d: '0-1·影响科举·官僚选拔·文化软实力' },
    'byEthnicity': { t: '族群构成', d: '按族 dict·汉 / 蒙 / 藏 / 等·和 = 1·影响羁縻·叛乱风险' },
    'byFaith': { t: '信仰构成', d: '按信仰 dict·儒 / 佛 / 道 / 等·和 = 1·影响政策接受度' },
    'byClass': { t: '阶层构成', d: '士 / 农 / 工 / 商 比例·和 = 1·影响科举·税源' },
    'populationDetail.households': { t: '户数', d: '估计户数·人口 / 5-7 ≈ 户·影响兵员征集' },
    'populationDetail.adultMale': { t: '丁口', d: '15-60 岁男·真正可征兵 / 徭役者' },

    // econ tab
    'taxBase': { t: '税基', d: '基础税收·钱 / 粮 / 布·游戏中决定财政' },
    'taxableLand': { t: '可耕地', d: '亩·开垦土地·限制最大税基' },
    'commerceIndex': { t: '商业指数', d: '0-100·影响商税·商队 / 港口加成' },
    'crops': { t: '主作物', d: '粟 / 稻 / 麦 / 桑·影响税源类·灾种敏感' },
    'natural': { t: '天产', d: '盐 / 铁 / 茶 / 马·若有则该资源税重 / 走专卖' },
    'industry': { t: '工业', d: '冶 / 织 / 瓷 / 纸·影响匠籍·军备产能' },

    // gov tab
    'autonomy': { t: '自治', d: '直辖 / 番国 / 番镇 / 羁縻 / 朝贡·决定中央对此地的控制力' },
    'autonomy.type': { t: '自治类', d: 'zhixia 直 / fanguo 番 / fanzhen 镇 / jimi 羁 / chaogong 贡' },
    'autonomy.holder': { t: '自治持有者', d: '若 fanguo·王名·若 fanzhen·节度使姓名·若 jimi·部族名' },
    'autonomy.suzerain': { t: '宗主', d: '此自治体效忠谁·一般是某朝代·也可某番王' },
    'autonomy.tribute': { t: '贡赋', d: '每年应纳·朝贡 type 必填·番国可空' },
    'minxinLocal': { t: '民心 (本地)', d: '0-100·此地百姓对当政者的支持度·影响叛乱阈' },
    'orthodoxy': { t: '正统度', d: '0-100·此地对中央朝廷的认可度·与民心独立' },

    // history
    'sources': { t: '史源', d: '此区划数据来源·正史 / 方志 / 推测·影响游戏内显示可信度' },
    'timeline': { t: '时序快照', d: '此地不同年份的状态变迁·支持跨年代呈现' },

    // flags
    'flags': { t: '标记', d: '布尔标记·首都 / 沿海 / 战略要地等·AI 决策用' },
    'isCapital': { t: '是首都', d: '此朝代首都·特殊事件触发·gov 显金边' },
    'isCoastal': { t: '沿海', d: '可建港 / 接海贸·渡海事件起点' },
    'isStrategic': { t: '战略要地', d: '关隘 / 要冲·失则全境危' },
    'isFrontier': { t: '边塞', d: '与异族 / 番国接壤·常驻军' },
    'isHolyLand': { t: '圣地', d: '某宗教 / 文化的核心·影响信仰传播' },

    // 自治类型独立 (仅在 select 中)
    'zhixia': { t: '直辖', d: '中央直接管辖·全税·全征·标准郡县' },
    'fanguo': { t: '番国', d: '王自治·名义朝贡·税不上缴·内政自决·叛风险高' },
    'fanzhen': { t: '番镇', d: '节度使割据·自征自养·中央难调·安史之乱后大量' },
    'jimi': { t: '羁縻', d: '少数民族部族自治·名义臣服·几无税·重在边防' },
    'chaogong': { t: '朝贡', d: '远国 / 海外·定期遣使·礼物互赠·非实控' }
  };

  // ─── tooltip UI ─────────────────────────────────────────

  var _tip = null;
  var _hoverTimer = null;
  var _activeEl = null;

  function ensureTip(){
    if (_tip) return _tip;
    _tip = document.createElement('div');
    _tip.id = 'me-tooltip';
    _tip.style.cssText = [
      'position:fixed',
      'background:linear-gradient(180deg, var(--ink-3), var(--ink-1))',
      'border:1px solid var(--gold-3)',
      'border-radius:var(--rd-2)',
      'padding:8px 12px',
      'max-width:320px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.7), 0 0 0 1px rgba(217,181,102,0.08)',
      'font-family:var(--font-serif)',
      'font-size:var(--fs-xs)',
      'color:var(--paper-1)',
      'pointer-events:none',
      'z-index:1500',
      'opacity:0',
      'transform:translateY(-4px)',
      'transition:opacity var(--t-fast), transform var(--t-fast)',
      'line-height:var(--lh-loose)'
    ].join(';');
    document.body.appendChild(_tip);
    return _tip;
  }

  function showTip(entry, x, y){
    var t = ensureTip();
    t.innerHTML =
      '<div style="color:var(--gold-1); font-weight:var(--fw-sb); font-size:var(--fs-sm); letter-spacing:0.05em; margin-bottom:3px;">' + escHtml(entry.t) + '</div>' +
      '<div style="color:var(--paper-2);">' + escHtml(entry.d) + '</div>';
    // 定位·避免出 viewport
    var pad = 14;
    var tw = 320, th = 80;  // 估·实际由 css max-width
    var px = x + pad, py = y + pad;
    if (px + tw > window.innerWidth) px = x - tw - pad;
    if (py + th > window.innerHeight) py = y - th - pad;
    t.style.left = Math.max(4, px) + 'px';
    t.style.top = Math.max(4, py) + 'px';
    requestAnimationFrame(function(){
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });
  }

  function hideTip(){
    if (!_tip) return;
    _tip.style.opacity = '0';
    _tip.style.transform = 'translateY(-4px)';
  }

  // ─── lookup ─────────────────────────────────────────────

  function lookup(label, fieldKey){
    if (fieldKey && DICT[fieldKey]) return DICT[fieldKey];
    if (label){
      // 试·label 直 match (e.g., '级别' → 'level' label match)
      // 尝 label 中包含 ASCII 字段名 (e.g., 'officialPosition')
      var m = label.match(/[a-zA-Z][a-zA-Z0-9_.]+/);
      if (m && DICT[m[0]]) return DICT[m[0]];
      // 尝 label 中文匹配
      var lower = label.toLowerCase();
      var keys = Object.keys(DICT);
      for (var i = 0; i < keys.length; i++){
        if (DICT[keys[i]].t === label) return DICT[keys[i]];
        if (label.indexOf(DICT[keys[i]].t) >= 0) return DICT[keys[i]];
      }
    }
    return null;
  }

  // ─── 绑·panel labels ──────────────────────────────────

  function attachToPanel(){
    var panel = document.getElementById('right-panel');
    if (!panel) return;
    // delegated listener·只 mouseover 即查
    panel.addEventListener('mouseover', function(e){
      var lab = e.target.closest && e.target.closest('.me-label');
      if (!lab) return;
      if (_activeEl === lab) return;
      _activeEl = lab;
      // 找 data-f
      var ctrl = lab.parentElement && lab.parentElement.querySelector('[data-f]');
      var fkey = ctrl ? ctrl.getAttribute('data-f') : null;
      var label = lab.textContent.trim();
      var entry = lookup(label, fkey);
      if (!entry) return;
      if (_hoverTimer) clearTimeout(_hoverTimer);
      _hoverTimer = setTimeout(function(){
        if (_activeEl !== lab) return;
        var rect = lab.getBoundingClientRect();
        showTip(entry, rect.left, rect.bottom);
      }, 600);
    });
    panel.addEventListener('mouseout', function(e){
      var lab = e.target.closest && e.target.closest('.me-label');
      if (!lab) return;
      _activeEl = null;
      if (_hoverTimer){ clearTimeout(_hoverTimer); _hoverTimer = null; }
      hideTip();
    });
  }

  // ─── helpers ────────────────────────────────────────────

  function escHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── init ──────────────────────────────────────────────

  function init(){
    ensureTip();
    attachToPanel();
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.tooltips = {
    init: init,
    DICT: DICT,
    lookup: lookup
  };

})(typeof window !== 'undefined' ? window : this);
