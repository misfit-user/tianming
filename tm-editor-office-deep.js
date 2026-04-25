// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-editor-office-deep.js
 * ============================================================
 * 官制 editor 深化：
 *   · 每个官职可配公库初值 (money/grain/cloth)
 *   · 绑定类型 (region / ministry / military / imperial)
 *   · 辟署权、荫补、合法陋规、监察权、弹劾权
 *   · 朝代特征官职 AI 一键生成（根据官职名自动推断）
 *
 * 不新增系统，只扩展 _govPosForm / _govPosFromForm。
 * ============================================================
 */
(function(global) {
  'use strict';

  var PATCHED = false;

  function _escAttr(s) { return String(s||'').replace(/"/g, '&quot;').replace(/</g,'&lt;'); }
  function _gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function _gvn(id, dflt) { var v = parseFloat(_gv(id)); return isNaN(v) ? (dflt||0) : v; }

  function _ensurePosDeep(pos) {
    pos = pos || {};
    if (!pos.publicTreasuryInit) {
      pos.publicTreasuryInit = {
        money: 0,     // 公库银初始额度
        grain: 0,     // 公廪米初始储量
        cloth: 0,     // 公廪布初始储量
        quotaMoney: 0,     // 每年额定
        quotaGrain: 0,
        quotaCloth: 0
      };
    }
    if (!pos.privateIncome) {
      pos.privateIncome = {
        legalSalary: pos.salary || pos.perPersonSalary || '',
        bonusType: '',   // 恩赏/冰敬/炭敬/养廉银/职田
        bonusNote: '',   // 合法陋规文字说明
        illicitRisk: 'medium'  // low/medium/high 腐败风险档
      };
    }
    if (!pos.bindingHint) {
      // 绑定默认：猜测
      var n = (pos.name||'').toLowerCase();
      var hint = '';
      if (/节度|布政|巡抚|知府|知州|县令|太守|刺史|郡守/.test(pos.name||'')) hint = 'region';
      else if (/尚书|侍郎|寺卿|监|院/.test(pos.name||'')) hint = 'ministry';
      else if (/将军|都督|元帅|提督|总兵/.test(pos.name||'')) hint = 'military';
      else if (/内.*(监|府|侍)|大内|奉宸|御前/.test(pos.name||'')) hint = 'imperial';
      pos.bindingHint = hint;
    }
    if (!pos.powers) {
      pos.powers = {
        appointment: false,   // 辟署权
        yinBu: false,         // 荫补权
        impeach: false,       // 弹劾权
        supervise: false,     // 监察权
        taxCollect: false,    // 征税权
        militaryCommand: false // 调兵权
      };
    }
    if (!pos.hooks) {
      pos.hooks = {
        triggerOnLowTreasury: '',    // 国库低于X时的触发行为 (AI 参考)
        triggerOnUnrest: '',          // 民变时触发
        triggerOnHeavenSign: '',      // 异象时触发
        tenureYears: 0                 // 任期年限 (0=无限)
      };
    }
    return pos;
  }

  // 追加表单 HTML
  function _renderPosDeepHTML(pos) {
    pos = _ensurePosDeep(pos);
    var pti = pos.publicTreasuryInit;
    var pi  = pos.privateIncome;
    var pw  = pos.powers;
    var hk  = pos.hooks;

    var h = '';
    h += '<details open style="margin-top:12px;border:1px solid var(--color-border-subtle);border-radius:6px;padding:8px 12px;background:rgba(184,154,83,0.04);">';
    h += '<summary style="cursor:pointer;font-weight:600;color:var(--gold-400);">▾ 深化配置（公库·私产·权限·钩子）</summary>';

    // 公库
    h += '<div style="margin-top:10px;padding:8px;border-left:3px solid var(--gold-400);background:rgba(0,0,0,0.15);border-radius:4px;">';
    h += '<div style="font-size:0.75rem;font-weight:600;color:var(--gold-400);margin-bottom:6px;">公库初值 · 单个官职接掌时的起始额度</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    h += '<div class="form-group" style="flex:1;min-width:120px;"><label style="font-size:0.7rem;">公库·银(两)</label><input type="number" id="pd_ptMoney" value="'+(pti.money||0)+'"></div>';
    h += '<div class="form-group" style="flex:1;min-width:120px;"><label style="font-size:0.7rem;">公廪·米(石)</label><input type="number" id="pd_ptGrain" value="'+(pti.grain||0)+'"></div>';
    h += '<div class="form-group" style="flex:1;min-width:120px;"><label style="font-size:0.7rem;">公廪·布(匹)</label><input type="number" id="pd_ptCloth" value="'+(pti.cloth||0)+'"></div>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    h += '<div class="form-group" style="flex:1;min-width:120px;"><label style="font-size:0.7rem;">年额·银</label><input type="number" id="pd_qMoney" value="'+(pti.quotaMoney||0)+'"></div>';
    h += '<div class="form-group" style="flex:1;min-width:120px;"><label style="font-size:0.7rem;">年额·米</label><input type="number" id="pd_qGrain" value="'+(pti.quotaGrain||0)+'"></div>';
    h += '<div class="form-group" style="flex:1;min-width:120px;"><label style="font-size:0.7rem;">年额·布</label><input type="number" id="pd_qCloth" value="'+(pti.quotaCloth||0)+'"></div>';
    h += '</div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">绑定类型 · AI 推演公库变化参考</label>';
    h += '<select id="pd_binding">';
    h += '<option value=""' + (pos.bindingHint===''?' selected':'') + '>（无公库）</option>';
    h += '<option value="region"' + (pos.bindingHint==='region'?' selected':'') + '>region · 地方公库（节度/知府/县令）</option>';
    h += '<option value="ministry"' + (pos.bindingHint==='ministry'?' selected':'') + '>ministry · 中央部公库（尚书/寺卿）</option>';
    h += '<option value="military"' + (pos.bindingHint==='military'?' selected':'') + '>military · 军饷公库（将军/都督）</option>';
    h += '<option value="imperial"' + (pos.bindingHint==='imperial'?' selected':'') + '>imperial · 内帑（内监/大内）</option>';
    h += '</select></div>';
    h += '</div>';

    // 私产
    h += '<div style="margin-top:10px;padding:8px;border-left:3px solid var(--celadon-400);background:rgba(0,0,0,0.15);border-radius:4px;">';
    h += '<div style="font-size:0.75rem;font-weight:600;color:var(--celadon-400);margin-bottom:6px;">私产/俸外收入 · 配合合法陋规模拟</div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">加给类型</label>';
    h += '<select id="pd_bonusType">';
    ['', '恩赏', '冰敬', '炭敬', '养廉银', '职田', '火耗', '漕规', '关规', '羡余'].forEach(function(t){
      h += '<option value="'+t+'"' + (pi.bonusType===t?' selected':'') + '>'+(t||'（无）')+'</option>';
    });
    h += '</select></div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">合法陋规说明 (AI 生成私产时参考)</label>';
    h += '<textarea id="pd_bonusNote" rows="2" style="font-size:0.7rem;">'+_escAttr(pi.bonusNote||'')+'</textarea></div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">腐败风险档</label>';
    h += '<select id="pd_illicitRisk">';
    h += '<option value="low"' + (pi.illicitRisk==='low'?' selected':'') + '>低 · 清要职</option>';
    h += '<option value="medium"' + (pi.illicitRisk==='medium'?' selected':'') + '>中 · 常规</option>';
    h += '<option value="high"' + (pi.illicitRisk==='high'?' selected':'') + '>高 · 肥缺（地方大员/漕盐关税）</option>';
    h += '</select></div>';
    h += '</div>';

    // 权限
    h += '<div style="margin-top:10px;padding:8px;border-left:3px solid var(--vermillion-400);background:rgba(0,0,0,0.15);border-radius:4px;">';
    h += '<div style="font-size:0.75rem;font-weight:600;color:var(--vermillion-400);margin-bottom:6px;">专项权限 · AI 推演时判定该官职能否发动对应行动</div>';
    h += '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.75rem;">';
    h += '<label><input type="checkbox" id="pd_pwAppoint" ' + (pw.appointment?'checked':'') + '> 辟署权</label>';
    h += '<label><input type="checkbox" id="pd_pwYin" ' + (pw.yinBu?'checked':'') + '> 荫补</label>';
    h += '<label><input type="checkbox" id="pd_pwImpeach" ' + (pw.impeach?'checked':'') + '> 弹劾</label>';
    h += '<label><input type="checkbox" id="pd_pwSuperv" ' + (pw.supervise?'checked':'') + '> 监察</label>';
    h += '<label><input type="checkbox" id="pd_pwTax" ' + (pw.taxCollect?'checked':'') + '> 征税</label>';
    h += '<label><input type="checkbox" id="pd_pwMil" ' + (pw.militaryCommand?'checked':'') + '> 调兵</label>';
    h += '</div>';
    h += '</div>';

    // 钩子 / 行为参考
    h += '<div style="margin-top:10px;padding:8px;border-left:3px solid var(--amber-400);background:rgba(0,0,0,0.15);border-radius:4px;">';
    h += '<div style="font-size:0.75rem;font-weight:600;color:var(--amber-400);margin-bottom:6px;">行为钩子 · AI 扮演时的参考（不强制）</div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">国库低于警戒线时倾向</label>'
      + '<input type="text" id="pd_hookLowT" placeholder="如：谏停大工/建议加派/抄没豪强" value="'+_escAttr(hk.triggerOnLowTreasury||'')+'"></div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">民变/动乱时倾向</label>'
      + '<input type="text" id="pd_hookUnrest" placeholder="如：请兵镇压/奏请赈济/请罪自劾" value="'+_escAttr(hk.triggerOnUnrest||'')+'"></div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">异象发生时倾向</label>'
      + '<input type="text" id="pd_hookHeaven" placeholder="如：请罪己诏/请修德政/指斥他人" value="'+_escAttr(hk.triggerOnHeavenSign||'')+'"></div>';
    h += '<div class="form-group"><label style="font-size:0.7rem;">任期年限 (0=无限)</label>'
      + '<input type="number" id="pd_tenure" min="0" value="'+(hk.tenureYears||0)+'"></div>';
    h += '</div>';

    // AI 生成
    h += '<div style="margin-top:10px;text-align:right;">';
    h += '<button type="button" id="pd_aiGen" style="padding:4px 10px;background:var(--gold-400);color:#111;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;">★ AI 一键生成（按官职名+朝代）</button>';
    h += '</div>';

    h += '</details>';
    return h;
  }

  function _collectPosDeepFromForm(pos) {
    pos = pos || {};
    pos.publicTreasuryInit = {
      money: _gvn('pd_ptMoney',0),
      grain: _gvn('pd_ptGrain',0),
      cloth: _gvn('pd_ptCloth',0),
      quotaMoney: _gvn('pd_qMoney',0),
      quotaGrain: _gvn('pd_qGrain',0),
      quotaCloth: _gvn('pd_qCloth',0)
    };
    pos.bindingHint = _gv('pd_binding');
    pos.privateIncome = {
      legalSalary: pos.perPersonSalary || pos.salary || '',
      bonusType: _gv('pd_bonusType'),
      bonusNote: _gv('pd_bonusNote'),
      illicitRisk: _gv('pd_illicitRisk') || 'medium'
    };
    var ck = function(id){ var el = document.getElementById(id); return !!(el && el.checked); };
    pos.powers = {
      appointment: ck('pd_pwAppoint'),
      yinBu: ck('pd_pwYin'),
      impeach: ck('pd_pwImpeach'),
      supervise: ck('pd_pwSuperv'),
      taxCollect: ck('pd_pwTax'),
      militaryCommand: ck('pd_pwMil')
    };
    pos.hooks = {
      triggerOnLowTreasury: _gv('pd_hookLowT'),
      triggerOnUnrest: _gv('pd_hookUnrest'),
      triggerOnHeavenSign: _gv('pd_hookHeaven'),
      tenureYears: _gvn('pd_tenure',0)
    };
    return pos;
  }

  // AI 生成
  function _aiGenPosDeep() {
    var posName = _gv('gm_name');
    if (!posName) { if (global.showToast) global.showToast('请先填写官职名'); return; }
    var sd = global.scriptData || {};
    var dyn = (sd.settings && sd.settings.dynasty) || sd.dynasty || '未指定朝代';
    var era = (sd.settings && sd.settings.era) || sd.era || '';
    var btn = document.getElementById('pd_aiGen');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }

    var prompt = '你是中国古代官制专家。根据以下信息，为该官职生成配置 JSON：\n'
      + '官职：' + posName + '\n'
      + '朝代：' + dyn + '\n'
      + (era ? '纪年：' + era + '\n' : '')
      + '品级：' + (_gv('gm_rank') || '未填') + '\n'
      + '\n'
      + '返回 JSON（仅此对象，无markdown）：\n'
      + '{\n'
      + '  "publicTreasuryInit": { "money": 银两, "grain": 米石, "cloth": 布匹, "quotaMoney": 年额银, "quotaGrain": 年额米, "quotaCloth": 年额布 },\n'
      + '  "bindingHint": "region|ministry|military|imperial|",\n'
      + '  "privateIncome": { "bonusType": "恩赏|冰敬|炭敬|养廉银|职田|火耗|漕规|关规|羡余", "bonusNote": "合法陋规说明30-60字", "illicitRisk": "low|medium|high" },\n'
      + '  "powers": { "appointment": bool, "yinBu": bool, "impeach": bool, "supervise": bool, "taxCollect": bool, "militaryCommand": bool },\n'
      + '  "hooks": { "triggerOnLowTreasury": "15字倾向", "triggerOnUnrest": "15字倾向", "triggerOnHeavenSign": "15字倾向", "tenureYears": 数字任期 }\n'
      + '}\n'
      + '要求：\n'
      + '1. 所有数值须符合该朝代该官职史实\n'
      + '2. 节度使/布政使/巡抚/知府等地方大员 money 通常数万至数十万\n'
      + '3. 尚书/侍郎等京官 money 较少（主要通过部银）\n'
      + '4. 清要职如翰林 illicitRisk=low；漕盐关税户部 illicitRisk=high\n'
      + '5. 权限根据史实勾选（如巡抚可征税+监察但不一定有辟署权）\n'
      + '6. 只返回 JSON';

    var callFn = global.callAI || global.callAISmart;
    if (!callFn) { if (global.showToast) global.showToast('AI 服务未就绪'); if (btn) { btn.disabled=false; btn.textContent='★ AI 一键生成（按官职名+朝代）'; } return; }

    callFn({ prompt: prompt, expectJson: true }).then(function(res) {
      try {
        var txt = (typeof res === 'string') ? res : (res.text || res.content || JSON.stringify(res));
        var m = txt.match(/\{[\s\S]*\}/);
        var data = JSON.parse(m ? m[0] : txt);
        // 回填
        var set = function(id, v){ var el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
        var ck  = function(id, v){ var el = document.getElementById(id); if (el) el.checked = !!v; };
        if (data.publicTreasuryInit) {
          set('pd_ptMoney', data.publicTreasuryInit.money);
          set('pd_ptGrain', data.publicTreasuryInit.grain);
          set('pd_ptCloth', data.publicTreasuryInit.cloth);
          set('pd_qMoney', data.publicTreasuryInit.quotaMoney);
          set('pd_qGrain', data.publicTreasuryInit.quotaGrain);
          set('pd_qCloth', data.publicTreasuryInit.quotaCloth);
        }
        set('pd_binding', data.bindingHint || '');
        if (data.privateIncome) {
          set('pd_bonusType', data.privateIncome.bonusType || '');
          set('pd_bonusNote', data.privateIncome.bonusNote || '');
          set('pd_illicitRisk', data.privateIncome.illicitRisk || 'medium');
        }
        if (data.powers) {
          ck('pd_pwAppoint', data.powers.appointment);
          ck('pd_pwYin', data.powers.yinBu);
          ck('pd_pwImpeach', data.powers.impeach);
          ck('pd_pwSuperv', data.powers.supervise);
          ck('pd_pwTax', data.powers.taxCollect);
          ck('pd_pwMil', data.powers.militaryCommand);
        }
        if (data.hooks) {
          set('pd_hookLowT', data.hooks.triggerOnLowTreasury || '');
          set('pd_hookUnrest', data.hooks.triggerOnUnrest || '');
          set('pd_hookHeaven', data.hooks.triggerOnHeavenSign || '');
          set('pd_tenure', data.hooks.tenureYears || 0);
        }
        if (global.showToast) global.showToast('已生成 ' + posName + ' 深化配置');
      } catch (e) {
        console.error('[pd_aiGen] parse failed', e);
        if (global.showToast) global.showToast('AI 返回无法解析');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '★ AI 一键生成（按官职名+朝代）'; }
      }
    }).catch(function(err) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(err, 'pd_aiGen') : console.error('[pd_aiGen] error', err);
      if (global.showToast) global.showToast('AI 请求失败');
      if (btn) { btn.disabled = false; btn.textContent = '★ AI 一键生成（按官职名+朝代）'; }
    });
  }

  // 安装：包装 openGenericModal 以注入深化字段
  function _install() {
    if (PATCHED) return;
    if (typeof global.openGenericModal !== 'function') {
      setTimeout(_install, 400);
      return;
    }
    var origOpen = global.openGenericModal;
    global.openGenericModal = function(title, body, onOk) {
      var isPosModal = (title === '添加官职' || title === '编辑官职');
      if (isPosModal) {
        var pos = global._pd_currentPos || {};
        body = body + _renderPosDeepHTML(pos);
        var origOk = onOk;
        onOk = function() {
          // 先读出深化表单
          var deep = _collectPosDeepFromForm({});
          // 运行原 onOk（它会 push/更新 node.positions[i]）
          var r = origOk.apply(this, arguments);
          // 原 onOk 已经修改了 positions；用 _pd_mode 找目标 pos merge
          setTimeout(function() {
            try {
              if (global._pd_mode === 'edit' && global._pd_currentPos) {
                _mergeDeep(global._pd_currentPos, deep);
              } else if (global._pd_mode === 'add') {
                // 新增：两种 getByPath 都尝试（_govGetByPath 剧本信息官制 / _officeGetByPath P.officeTree）
                var getBy = global._govGetByPath || global._officeGetByPath;
                if (getBy && global._pd_addPath) {
                  var node = getBy(global._pd_addPath);
                  if (node && node.positions && node.positions.length > 0) {
                    var newPos = node.positions[node.positions.length - 1];
                    _mergeDeep(newPos, deep);
                  }
                }
              }
            } catch(_e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'office-deep] merge') : console.warn('[office-deep] merge', _e); }
            global._pd_currentPos = null;
            global._pd_mode = null;
            global._pd_editPath = null;
            global._pd_editIndex = null;
            global._pd_addPath = null;
          }, 30);
          return r;
        };
      }
      var result = origOpen.call(this, title, body, onOk);
      if (isPosModal) {
        setTimeout(function() {
          var b = document.getElementById('pd_aiGen');
          if (b) b.onclick = _aiGenPosDeep;
        }, 30);
      }
      return result;
    };
    PATCHED = true;
  }

  // 包装 _govAddPos / _govEditPos 以设置 _pd_currentPos 并写回深化字段
  function _wrapGovFns() {
    // 这些函数是 IIFE 内部局部，外部不可直接访问。
    // 替代：劫持 Array.prototype.push 在 positions 上 —— 不可行。
    // 实际方案：修改 _govPosFromForm 的返回值：通过 monkey patch positions 数组 push。
    //
    // 简化：直接 hook document 事件，在 _govAddPos/_govEditPos 被调用后（onclick 冒泡），
    // 监听 modal close，写入 _pd_stagingDeep 到最近编辑/新增的 pos。
    //
    // 因 _govAddPos/_govEditPos 已经暴露到 window（onclick 使用），我们可包装它们：
    // 编辑器两套官制函数都要包装（editor-government._govEditPos + tm-audio-theme._officeEditPos）
    var editFns = ['_govEditPos', '_officeEditPos'];
    var addFns  = ['_govAddPos',  '_officeAddPos'];
    var getByPathFns = ['_govGetByPath', '_officeGetByPath'];

    function _findGetByPath() {
      for (var i = 0; i < getByPathFns.length; i++) {
        if (typeof global[getByPathFns[i]] === 'function') return global[getByPathFns[i]];
      }
      return null;
    }

    editFns.forEach(function(fn) {
      if (typeof global[fn] !== 'function' || global[fn].__deepWrapped) return;
      var orig = global[fn];
      global[fn] = function(path, pi) {
        var getBy = _findGetByPath();
        var node = getBy ? getBy(path) : null;
        if (node && node.positions && node.positions[pi]) {
          global._pd_currentPos = _ensurePosDeep(node.positions[pi]);
          global._pd_mode = 'edit';
          global._pd_editPath = path;
          global._pd_editIndex = pi;
        } else {
          global._pd_currentPos = _ensurePosDeep({});
          global._pd_mode = 'add';
        }
        return orig.apply(this, arguments);
      };
      global[fn].__deepWrapped = true;
    });

    addFns.forEach(function(fn) {
      if (typeof global[fn] !== 'function' || global[fn].__deepWrapped) return;
      var orig = global[fn];
      global[fn] = function(path) {
        global._pd_currentPos = _ensurePosDeep({});
        global._pd_mode = 'add';
        global._pd_addPath = path;
        return orig.apply(this, arguments);
      };
      global[fn].__deepWrapped = true;
    });
  }

  function _mergeDeep(pos, deep) {
    if (!pos || !deep) return;
    pos.publicTreasuryInit = deep.publicTreasuryInit;
    pos.bindingHint = deep.bindingHint;
    pos.privateIncome = deep.privateIncome;
    pos.powers = deep.powers;
    pos.hooks = deep.hooks;
  }

  // ==============================================================
  // 初始化
  // ==============================================================
  function boot() {
    _install();
    _wrapGovFns();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 500); });
  } else {
    setTimeout(boot, 500);
  }

  // 导出工具
  global.TM_OfficeDeep = {
    ensurePosDeep: _ensurePosDeep,
    renderHTML: _renderPosDeepHTML,
    collectFromForm: _collectPosDeepFromForm
  };

})(typeof window !== 'undefined' ? window : this);
