/**
 * tm-keju-activation.js
 * 科举 v7.1·Slice A1·制度激活 5 档 sc0 LLM
 *
 * 5 档 outcome·full / limited / delay / reform / reject
 * 替代旧二元 canEnable·让汉/魏晋朝代有政治深度
 *
 * 入口·
 *   _kjActivateRun({ mode: 'enable' | 'reform' }) — 替 requestEnableKeju + startKejuReform
 *
 * 依赖·
 *   - callAISmart (现 LLM 调度)
 *   - extractJSON / toast / showLoading / hideLoading (现工具)
 *   - GM.vars / GM.classes / P.keju / P.ai
 *
 * v7 注意·
 *   - 路径 A·玩家手动按按钮触发 (本 slice)
 *   - 路径 B (checkKejuTrigger·B3 完后) + 路径 C (J0 自然政治) 暂未集成·后续 slice 补
 *   - keyi `topicType='activation'` 路径·B3 未完时·outcome='reform' 走 stub (直应用)
 */
(function() {
  'use strict';

  /** 5 档 outcome 后果定义·所有数值参数化·勿 hardcode 路径 */
  var OUTCOME_HANDLERS = {
    full: function(data) {
      P.keju.enabled = true;
      P.keju.examIntervalNote = data.intervalNote || '三年一科';
      if (data.variableChanges) _applyVariableChanges(data.variableChanges);
      if (typeof addEB === 'function') addEB('科举·制度', '全准·' + (data.intervalNote || '三年一科'));
      _showOutcomeModal('🎉 全准·开科取士', data, { color: 'var(--celadon-400)', icon: '✓' });
    },
    limited: function(data) {
      P.keju.enabled = true;
      P.keju.examIntervalNote = data.intervalNote || '三年一科';
      P.keju.restrictions = {
        provinces: data.restrictions || [],
        yearsBeforeFull: data.yearsBeforeFull || 3,
        startYear: (GM.year || 0)
      };
      if (typeof _adjustMinxin === 'function') _adjustMinxin(5, '士林感念·有限开科');
      if (data.variableChanges) _applyVariableChanges(data.variableChanges);
      if (typeof addEB === 'function') addEB('科举·制度', '有限·' + (data.restrictions || []).join('、') + '·' + (data.yearsBeforeFull || 3) + '年后议全国');
      _showOutcomeModal('⚖ 有限·试点开科', data, { color: 'var(--gold)', icon: '⚖' });
    },
    delay: function(data) {
      P.keju._reformCooldown = (GM.year || 0) + (data.delayYears || 5);
      if (data.variableChanges) _applyVariableChanges(data.variableChanges);
      if (typeof addEB === 'function') addEB('科举·制度', '缓·' + (data.delayYears || 5) + '年后再议');
      _showOutcomeModal('⏸ 缓议·暂不开科', data, { color: 'var(--txt-d)', icon: '⏸' });
    },
    reform: function(data) {
      // B3 完后·走 keyi topicType='activation'·此处 stub·直接应用改革后果
      P.keju.enabled = true;
      P.keju.reformed = true;
      P.keju.examIntervalNote = data.intervalNote || '渐进开科';
      if (data.variableChanges) _applyVariableChanges(data.variableChanges);
      if (typeof addEB === 'function') addEB('科举·制度', '改·走渐进改革路径');
      _showOutcomeModal('⚙ 改·走渐进改革', data, { color: 'var(--celadon-400)', icon: '⚙' });
      // TODO·B3 完后·此处改为 openKeyiSession({ topicType: 'activation', topicData: data })
    },
    reject: function(data) {
      // 不启用·勋戚 satisfaction+5·prestige 概念由 sc1q 系统接管·此处不动 prestige
      if (typeof _adjustHuangwei === 'function') _adjustHuangwei(-5, '议开科被拒·勋戚抵触');
      _bumpClassSatisfaction('勋戚', 5, '议开科被拒');
      if (data.variableChanges) _applyVariableChanges(data.variableChanges);
      if (typeof addEB === 'function') addEB('科举·制度', '拒·' + (data.reason || '时机未至'));
      _showOutcomeModal('✗ 拒·时机未至', data, { color: 'var(--vermillion-400)', icon: '✗' });
    }
  };

  /** 构造 sc0 prompt·5 档评估 */
  function _buildPrompt(mode) {
    var scenario = (P.scenarios || []).find(function(s){ return s.id === GM.sid; }) || {};
    var era = scenario.era || scenario.dynasty || P.era || P.dynasty || '';
    var modeLabel = (mode === 'reform') ? '科举改革 (现行非科举制度)' : '请求启用科举制度';

    return '你是中国古代政治制度评估 AI。陛下欲' + modeLabel + '。请按 5 档评估，依本朝实情。\n\n' +
      '【朝代】' + era + '\n' +
      '【背景】' + ((scenario.background || '').substring(0, 200)) + '\n' +
      '【国库】' + (GM.vars && GM.vars['国库'] ? GM.vars['国库'].value : '未知') + '\n' +
      '【民心】' + (GM.vars && GM.vars['民心'] ? GM.vars['民心'].value : '未知') + '\n' +
      '【集权度】' + (GM.vars && GM.vars['集权度'] ? GM.vars['集权度'].value : '未知') + '\n' +
      '【现局势】' + (GM.situation || '正常') + '\n\n' +
      '【5 档】\n' +
      '· full — 时机成熟·全国开科\n' +
      '· limited — 部分省试点·士林尚薄·N 年后再议全国\n' +
      '· delay — 时机未至·N 年后再议\n' +
      '· reform — 应走渐进改革 (非直接启用·走 keyi)\n' +
      '· reject — 勋戚强反·时机不可\n\n' +
      '【返回 JSON·只输出 JSON】\n' +
      '{\n' +
      '  "outcome": "full" | "limited" | "delay" | "reform" | "reject",\n' +
      '  "reason": "评估理由 50-100 字 (半文言)",\n' +
      '  "narrative": "陛下视角的简短陈述 80-150 字 (半文言·邸报体)",\n' +
      '  "intervalNote": "三年一科 (仅 full/limited/reform 填)",\n' +
      '  "restrictions": ["北方 6 省" 等数组 (仅 limited 填)],\n' +
      '  "yearsBeforeFull": 3 (仅 limited 填),\n' +
      '  "delayYears": 5 (仅 delay 填),\n' +
      '  "affectedClasses": ["士林+3", "勋戚-5"] (描述阶层影响·非数值变量),\n' +
      '  "variableChanges": { "集权度": 5 } (可选·只 -10 到 +10 范围·勿改国库等大数)\n' +
      '}';
  }

  /** sc0 LLM 调度·失败 fallback 到 delay */
  async function _runSc0(mode) {
    if (typeof showLoading === 'function') showLoading('议开科取士·廷臣审议中...', 50);
    var prompt = _buildPrompt(mode);
    try {
      var tokBudget = (P.conf && P.conf.maxOutputTokens) || 1500;
      var raw = await callAISmart(prompt, Math.min(tokBudget, 1500), { maxRetries: 2 });
      var data = (typeof extractJSON === 'function') ? extractJSON(raw) : JSON.parse(String(raw).replace(/```json|```/g, '').trim());
      if (typeof hideLoading === 'function') hideLoading();
      if (!data || !data.outcome || !OUTCOME_HANDLERS[data.outcome]) {
        // LLM 返非 5 档之一·fallback delay
        console.warn('[科举·A1] LLM 返非 5 档·fallback delay', data);
        data = data || {};
        data.outcome = 'delay';
        data.reason = data.reason || '议未决·待时再议';
        data.delayYears = 3;
      }
      return data;
    } catch(e) {
      console.error('[科举·A1] sc0 失败', e);
      if (typeof hideLoading === 'function') hideLoading();
      return { outcome: 'delay', reason: 'LLM 评估失败·暂缓再议', delayYears: 3 };
    }
  }

  /** 5 档结果显示 modal */
  function _showOutcomeModal(title, data, style) {
    var modal = document.createElement('div');
    modal.className = 'modal-bg show';
    modal.style.zIndex = 4900;
    var clr = style && style.color ? style.color : 'var(--gold)';
    var ic = style && style.icon ? style.icon : '·';

    var detailHtml = '';
    if (data.narrative) detailHtml += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:6px;margin-bottom:0.8rem;font-size:0.88rem;line-height:1.8;color:var(--txt-s);font-style:italic;">「' + _esc(data.narrative) + '」</div>';
    if (data.reason) detailHtml += '<div style="margin-bottom:0.6rem;font-size:0.85rem;line-height:1.7;"><strong>评估·</strong>' + _esc(data.reason) + '</div>';
    if (data.restrictions && data.restrictions.length) detailHtml += '<div style="margin-bottom:0.4rem;font-size:0.82rem;"><strong>限制·</strong>' + data.restrictions.map(_esc).join('、') + (data.yearsBeforeFull ? '·' + data.yearsBeforeFull + '年后议全国' : '') + '</div>';
    if (data.delayYears) detailHtml += '<div style="margin-bottom:0.4rem;font-size:0.82rem;"><strong>缓议·</strong>' + data.delayYears + '年后再议</div>';
    if (data.affectedClasses && data.affectedClasses.length) detailHtml += '<div style="margin-bottom:0.4rem;font-size:0.82rem;color:var(--txt-d);"><strong>阶层影响·</strong>' + data.affectedClasses.map(_esc).join('·') + '</div>';

    modal.innerHTML =
      '<div style="background:var(--bg-1);border:1px solid ' + clr + ';border-radius:10px;width:90%;max-width:560px;padding:1.4rem 1.6rem;">' +
        '<div style="font-size:1.1rem;font-weight:700;color:' + clr + ';margin-bottom:0.8rem;">' + ic + ' ' + _esc(title) + '</div>' +
        detailHtml +
        '<div style="text-align:center;margin-top:1rem;">' +
          '<button class="bt bp" onclick="this.closest(\'.modal-bg\').remove();var p=document.getElementById(\'keju-panel-modal\');if(p)p.remove();">确认</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  /** 应用 variableChanges·只限 ±10 范围·防 LLM 写 +1000 */
  function _applyVariableChanges(changes) {
    if (!changes || typeof changes !== 'object') return;
    Object.keys(changes).forEach(function(name) {
      var v = changes[name];
      if (typeof v !== 'number') return;
      v = Math.max(-10, Math.min(10, v));
      if (GM.vars && GM.vars[name] && typeof GM.vars[name].value === 'number') {
        GM.vars[name].value = Math.max(0, Math.min(100, GM.vars[name].value + v));
      }
    });
  }

  /** 阶层 satisfaction 加减 */
  function _bumpClassSatisfaction(className, delta, reason) {
    if (!GM.classes || !Array.isArray(GM.classes)) return;
    var cls = GM.classes.find(function(c){ return c.name === className; });
    if (cls) {
      if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') {
        TM.ClassEngine.gateSatisfaction(GM, cls, delta, { turn: GM.turn, source: 'keju', reason: reason || '科举立制' });
      } else {
        cls.satisfaction = Math.max(0, Math.min(100, (cls.satisfaction || 50) + delta));
      }
      if (typeof addEB === 'function') addEB('阶层', className + (delta >= 0 ? '+' : '') + delta + '·' + (reason || ''));
    }
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /** 入口·替换旧 requestEnableKeju / startKejuReform */
  async function _kjActivateRun(opts) {
    opts = opts || {};
    var mode = opts.mode || 'enable';

    // 无 AI key·fallback 旧行为 (直接 enable·保留向后兼容)
    if (!P.ai || !P.ai.key) {
      P.keju.enabled = true;
      if (mode === 'reform') P.keju.reformed = true;
      P.keju.examIntervalNote = '三年一科';
      if (typeof toast === 'function') toast('✅ 科举' + (mode === 'reform' ? '改革' : '') + '已启用 (无 AI key·fallback)');
      var panel = document.getElementById('keju-panel-modal');
      if (panel) panel.remove();
      return;
    }

    var data = await _runSc0(mode);
    var handler = OUTCOME_HANDLERS[data.outcome];
    if (handler) {
      handler(data);
    } else {
      // 兜底·绝不应触发 (因 _runSc0 已 fallback)
      console.error('[科举·A1] handler 缺失·outcome=', data.outcome);
      OUTCOME_HANDLERS.delay({ outcome: 'delay', reason: 'handler 缺失·暂缓' });
    }
  }

  // 暴露
  if (typeof window !== 'undefined') {
    window._kjActivateRun = _kjActivateRun;
    window._kjActivateOutcomeHandlers = OUTCOME_HANDLERS;  // 测试用
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _kjActivateRun: _kjActivateRun, OUTCOME_HANDLERS: OUTCOME_HANDLERS };
  }
})();
