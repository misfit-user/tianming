// Settings-only controls; values are drafts until the existing settings save owner commits them.
(function(global) {
  'use strict';
  var active = {};
  function node(tag, text, cls) {
    var el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el;
  }
  function button(text) { var el = node('button', text, 'bt bs bsm'); el.type = 'button'; return el; }
  function close() {
    Object.keys(active).forEach(function(key) { active[key].cancel(); }); active = {};
  }
  function mount() {
    close(); ['primary', 'secondary'].forEach(mountOne);
  }
  function mountOne(tier) {
    var prefix = tier === 'secondary' ? 's-sec-' : 's-';
    var model = document.getElementById(prefix + 'model'); if (!model) return;
    var field = model.parentElement, bg = document.getElementById('settings-bg');
    var cfg = (tier === 'secondary' ? P.ai.secondary : P.ai) || {};
    var pull = button('拉取模型'), label = field.querySelector('label');
    pull.id = prefix + 'models-fetch'; pull.style.cssText = 'margin-left:auto;white-space:nowrap;';
    label.style.cssText = 'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;'; label.appendChild(pull);
    var box = node('div'); box.style.cssText = 'margin-top:.5rem;min-width:0;'; field.appendChild(box);
    var search = node('input'); search.type = 'search'; search.placeholder = '搜索已拉取的模型'; search.setAttribute('aria-label', '搜索模型'); search.hidden = true;
    var list = node('div'); list.id = prefix + 'models';
    list.style.cssText = 'display:flex;flex-direction:column;gap:.3rem;max-height:14rem;overflow:auto;margin-top:.3rem;';
    var status = node('div'); status.id = prefix + 'models-status'; status.setAttribute('role', 'status');
    status.style.cssText = 'color:var(--txt-d);font-size:.78rem;line-height:1.6;overflow-wrap:anywhere;';
    box.append(search, list, status);
    var options = node('div'); options.style.cssText = 'margin-top:.6rem;border-top:1px solid var(--bdr);padding-top:.5rem;'; field.appendChild(options);
    var thinkingLabel = node('label'); thinkingLabel.style.cssText = 'display:flex;align-items:center;gap:.4rem;';
    var check = node('input'); check.type = 'checkbox'; check.id = prefix + 'thinking'; check.style.width = 'auto';
    check.indeterminate = typeof cfg.thinking !== 'boolean'; check.checked = cfg.thinking === true;
    var caption = node('span', '开启模型 thinking'); thinkingLabel.append(check, caption);
    var reset = button('恢复模型默认'); reset.style.marginLeft = 'auto'; thinkingLabel.appendChild(reset);
    var protocolLabel = node('label', '思考协议（中转使用别名时可手动指定）'); protocolLabel.style.marginTop = '.3rem';
    var protocol = node('select'); protocol.id = prefix + 'thinking-protocol';
    [['auto','自动识别'],['openai','OpenAI · reasoning_effort'],['deepseek','DeepSeek · thinking'],['qwen','Qwen · enable_thinking'],['openrouter','OpenRouter · reasoning'],['gemini','Gemini · thinking_config'],['anthropic','Claude 原生 · thinking']].forEach(function(pair) {
      var opt = node('option', pair[1]); opt.value = pair[0]; protocol.appendChild(opt);
    });
    protocol.value = cfg.thinkingProtocol || 'auto'; if (!protocol.value) protocol.value = 'auto';
    var hint = node('div'); hint.style.cssText = 'color:var(--txt-d);font-size:.76rem;line-height:1.6;margin-top:.3rem;';
    options.append(thinkingLabel, protocolLabel, protocol, hint);
    var controller = null, serial = 0, rows = [];
    function current() { return bg && bg.classList.contains('show') && model.isConnected && active[tier] === owner; }
    function draft() {
      return { url: document.getElementById(prefix+'url').value.trim(), key: document.getElementById(prefix+'key').value.trim(),
        model: model.value.trim(), thinking: check.indeterminate ? undefined : check.checked, thinkingProtocol: protocol.value };
    }
    function explain() {
      protocol.disabled = check.indeterminate;
      caption.textContent = check.indeterminate ? '模型 thinking · 默认' : '开启模型 thinking';
      if (check.indeterminate) { hint.textContent = '当前：模型默认。不添加思考参数；勾选开启、取消勾选关闭。保存后生效。'; return; }
      var config = draft();
      try {
        var wire = TM.APIModels.endpoint(config).mode;
        TM.AIOptions.apply({ model:config.model, max_tokens:4000 }, config, wire);
        hint.textContent = (check.checked ? '当前：请求开启思考。' : '当前：请求关闭思考。') + '保存后生效；需服务商支持所选协议。不会缩减游戏提示词或输出上限。';
      } catch(e) { hint.textContent = e.message; }
    }
    function cancel() {
      serial++; if (controller) controller.abort(); controller = null; pull.disabled = false; pull.textContent = '拉取模型';
    }
    function invalidate() { cancel(); rows = []; list.replaceChildren(); search.hidden = true; status.textContent = ''; explain(); }
    function render() {
      var q = search.value.trim().toLowerCase(), filtered = rows.filter(function(row) { return row.id.toLowerCase().indexOf(q) >= 0; });
      list.replaceChildren();
      filtered.forEach(function(row) {
        var pick = button(row.id); pick.style.cssText = 'text-align:left;white-space:normal;overflow-wrap:anywhere;flex-shrink:0;';
        pick.classList.toggle('bp', model.value === row.id); pick.setAttribute('aria-pressed', String(model.value === row.id));
        pick.addEventListener('click', function() { model.value = row.id; model.dispatchEvent(new Event('input', { bubbles:true })); model.focus(); });
        list.appendChild(pick);
      });
      if (!filtered.length && rows.length) list.appendChild(node('div', '没有匹配的模型'));
    }
    async function detect() {
      cancel(); var ticket = serial, config = draft(); controller = new AbortController();
      pull.disabled = true; pull.textContent = '拉取中…'; status.textContent = '正在读取此地址和 Key 的模型列表…';
      rows = []; list.replaceChildren(); search.hidden = true;
      try {
        var result = await TM.APIModels.list(config, { signal:controller.signal });
        if (!current() || ticket !== serial) return;
        rows = result.models; search.value = ''; search.hidden = !rows.length; render();
        status.textContent = rows.length ? '已读取 '+rows.length+' 个模型'+(result.partial?'（接口分页未全部展开）':'')+'。点击选择，保存后生效；列表不代表有推理额度。' : '接口返回空列表；仍可手动填写 Model_ID。';
      } catch(e) { if (current() && ticket === serial) status.textContent = e.message; }
      finally { if (current() && ticket === serial) { controller = null; pull.disabled = false; pull.textContent = '拉取模型'; } }
    }
    var owner = { cancel:cancel, detect:detect, read: function(target) {
      if (check.indeterminate) delete target.thinking; else target.thinking = check.checked;
      target.thinkingProtocol = protocol.value || 'auto';
    } };
    active[tier] = owner;
    pull.addEventListener('click', detect); search.addEventListener('input', render);
    check.addEventListener('change', explain); protocol.addEventListener('change', explain);
    reset.addEventListener('click', function() { check.indeterminate = true; check.checked = false; explain(); });
    model.addEventListener('input', function() { render(); explain(); });
    ['url','key','prov'].forEach(function(name) {
      var el = document.getElementById(prefix+name); if (el) { el.addEventListener('input', invalidate); el.addEventListener('change', invalidate); }
    });
    explain();
  }
  global.TM = global.TM || {};
  global.TM.APISettings = {
    mount:mount, close:close,
    read:function(tier, target) { if (active[tier]) active[tier].read(target); },
    detect:function(tier) { return active[tier] ? active[tier].detect() : Promise.resolve(); }
  };
})(window);
