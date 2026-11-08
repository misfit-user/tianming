/* ════════════════════════════════════════════════════════════════
   剧本工坊 · 页内适配层合集（2026-07-03 架构整备 R2：自 scenario-editor-reset-preview.html
   九个内联 <script> IIFE 按原序字节保真外提合并——执行顺序与原页内一致；
   各块自带原注释标题(3a-升总览/4国师坞/4b引擎合并/M2/M7/N2/P1/P2P3/boolsw)。
   均为「纯附加」适配：靠 DOM/事件/window._je* 协作·不与 app.js 共享闭包。
   ════════════════════════════════════════════════════════════════ */

    /* 重设 slice 3a-升 ·「总览」开关：全局控制台收成 overlay，默认单模块聚焦。
       纯附加：建浮按钮 + 背板，切换 body.je-deck-open，不碰 app.js 内部。 */
    (function () {
      function init() {
        if (document.querySelector('.je-deck-toggle')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'je-deck-toggle';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', '切换全局总览控制台');
        btn.textContent = '总览 · 全局控制台';
        var bd = document.createElement('div');
        bd.className = 'je-deck-backdrop';
        function sync(open) {
          btn.setAttribute('aria-pressed', open ? 'true' : 'false');
          btn.textContent = open ? '✕ 返回单模块' : '总览 · 全局控制台';
        }
        function close() { document.body.classList.remove('je-deck-open'); sync(false); }
        btn.addEventListener('click', function () {
          sync(document.body.classList.toggle('je-deck-open'));
        });
        bd.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && document.body.classList.contains('je-deck-open')) close();
        });
        document.body.appendChild(bd);
        document.body.appendChild(btn);
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
      else init();
    })();

    /* 重设 slice 4 ·「案侧国师」：把国师面板钉成工坊右侧常驻列。
       2026-10-15 国师重做：这一层只管停靠与宿主专属的「实时守护」。原先往面板里塞的
       测试连接/审阅/编排/体检/问答/讲解/撤销/导入/捆绑/批量按钮、快捷任务条、示例、计划模式与学范例勾选、
       估 token、API/约定/权限/模板/历史/检查点折叠块、第二套斜杠与 @、Ctrl+K 模态和快捷键速查
       都已收进面板自己的 ＋ 菜单、命令面板（Ctrl+K）、设置与改动史，这里不再重复挂（重复挂会抢同一个输入框的按键）。 */
    (function () {
      function dock() {
        var fab = document.getElementById('tm-aa-fab');
        if (!fab) return false;                         // adapter 未就绪 / 非编辑器页
        if (!document._jeGuoshiDockToggleBound) {
          document._jeGuoshiDockToggleBound = true;
          // × 会撤掉坞态并归还正文宽度；之后从入口重开时恢复工坊右栏，而不是退化成遮挡正文的悬浮窗。
          // 用 document 委托，兼容 launcher 被宿主重建；延后一拍读取 FAB 自己完成 toggle 后的最终状态。
          document.addEventListener('click', function (event) {
            if (!event.target || !event.target.closest || !event.target.closest('#tm-aa-fab')) return;
            setTimeout(function () {
              var livePanel = document.getElementById('tm-aa-panel');
              if (livePanel && livePanel.classList.contains('open')) document.body.classList.add('je-guoshi-docked');
              else document.body.classList.remove('je-guoshi-docked', 'je-guoshi-settings-open');
            }, 0);
          });
        }
        document.body.classList.add('je-guoshi-docked');   // 先声明坞态·再开面板（面板首开的自动展开据此让位于坞）
        var panel = document.getElementById('tm-aa-panel');
        if (!panel) { fab.click(); panel = document.getElementById('tm-aa-panel'); }
        if (!panel) return false;
        panel.classList.add('open');                    // 常驻打开
        installGuard();
        return true;
      }

      // 方向T · 一致性守护（实时·主动·零 token）：盯手工编辑（#save-indicator 的 data-save-state 变化），
      //   改完跑确定性 preflight 查死链/不一致，有会挡开局的问题就弹横幅。开关在国师「设置 · 偏好」，存 tm_aa_guard。
      function installGuard() {
        if (window._jeGuardInit) return;
        window._jeGuardInit = true;
        var guardOn = true;
        try { guardOn = localStorage.getItem('tm_aa_guard') !== '0'; } catch (e) {}
        var gToast = document.createElement('div');
        gToast.className = 'je-guard-toast'; gToast.hidden = true;
        gToast.innerHTML = '<div class="gt-body"></div><div class="gt-act"><button class="gt-detail" type="button">交给国师看看</button><button class="gt-x" type="button" title="关闭">×</button></div>';
        document.body.appendChild(gToast);
        var gBody = gToast.querySelector('.gt-body');
        gToast.querySelector('.gt-x').addEventListener('click', function () { gToast.hidden = true; });
        gToast.querySelector('.gt-detail').addEventListener('click', function () {
          gToast.hidden = true;
          var U = window.TM_AuthoringAgentUI; if (U && U.open) U.open(); if (U && U.preflight) U.preflight();
        });
        var escG = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var renderGuard = function (pf) {
          if (!pf || !pf.blockers || !pf.blockers.length) { gToast.hidden = true; return; }
          var top = pf.blockers.slice(0, 2).map(function (b) { return '<div class="gt-item">· ' + escG(String(b).replace(/^\[[^\]]*\]\s*/, '')) + '</div>'; }).join('');
          gBody.innerHTML = '<b>刚才的手工改动留下 ' + pf.blockers.length + ' 处会挡住开局的问题</b>' + top + (pf.blockers.length > 2 ? '<div class="gt-item">…还有 ' + (pf.blockers.length - 2) + ' 处</div>' : '');
          gToast.hidden = false;
        };
        var runGuardCheck = function () {
          if (!guardOn) { gToast.hidden = true; return; }
          var AA = window.TM && window.TM.AuthoringAgent, app = window.TM_SCENARIO_EDITOR_RESET_APP;
          if (!AA || !AA.preflight || !app || !app.state || !app.state.scenario) return;
          var pf; try { pf = AA.preflight(app.state.scenario); } catch (e) { return; }   // 只读·不 clone·零 token
          renderGuard(pf);
        };
        window._jeGuardRun = runGuardCheck;   // 供测试/手动触发
        window._jeGuardSetEnabled = function (v) { guardOn = !!v; try { localStorage.setItem('tm_aa_guard', guardOn ? '1' : '0'); } catch (e) {} if (!guardOn) gToast.hidden = true; };
        var gTimer = null;
        var scheduleGuard = function () { if (!guardOn) return; if (gTimer) clearTimeout(gTimer); gTimer = setTimeout(runGuardCheck, 700); };
        try { new MutationObserver(scheduleGuard).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-save-state'] }); } catch (e) {}
      }
      var tries = 0;
      function attempt() { if (!dock() && tries++ < 40) setTimeout(attempt, 80); }   // 等 agent init，约 3.2s
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attempt);
      else attempt();
    })();

    /* 重设 slice 4b · 真·引擎合并：把 in-app 的 AI「内容生成」按钮（per-chip 补字段 / 模块工具条
       生成·润色 / 各 workbench 的「AI 梳理X」derive / 批量）统一路由进案侧国师那条真·BYOK 管线，
       取代原 simulateAiDraft（模拟草稿）+ .ai-drawer。一条 AI 路，消灭两套。
       纯附加：捕获阶段同步注册（先于 app.js 的 DOMContentLoaded click 委托），
       stopImmediatePropagation 掐掉旧路径 → 预填国师指令并聚焦（不自动跑，保留人审才落）。
       只拦内容生成；validate（确定性校验 validateScenario）与 seed-*（迁移）留给 app.js 原逻辑。 */
    (function () {
      var GEN = { generate: 1, polish: 1, derive: 1, 'fill-field': 1, batch: 1, regenerate: 1 };
      var VERB = { 'fill-field': '补齐', generate: '生成并补齐', polish: '润色', derive: '推导梳理', batch: '批量生成', regenerate: '重写' };
      function activeModuleName() {
        var n = document.querySelector('#module-rail .module-tile.active .module-name');
        if (!n) return '';
        var t = n.childNodes[0] && n.childNodes[0].textContent;
        return (t || n.textContent || '').trim();
      }
      // 预置提示词：按 section 关键词匹配各部分的"好内容应有什么"，让生成更贴合（取代通用一句话）
      var SECTION_GUIDES = [
        { kw: ['人物', '角色', 'character', '武将', '文官'], guide: '人物要字段完整：姓名、字/号、势力归属(faction 用剧本已存在的势力)、官职、年龄、性格、能力数值(武力/统帅/智力/政治/魅力等)、AI 人格(性格+动机+处世)、与他人关系；动机要成立、忠奸不脸谱化、贴合时代。' },
        { kw: ['势力', '派系', 'faction', '阵营'], guide: '势力要含：名称、领袖、性质/政治立场、核心目标、与其它势力的关系、资源/兵力概况；强弱要平衡、避免一家独大、与玩家有可博弈空间。' },
        { kw: ['事件', 'event', '剧情'], guide: '事件要含：标题、触发条件、时间、涉及人物/势力、效果、叙事描述；贴合时代、有戏剧张力、后果可感知。' },
        { kw: ['关系', 'relation'], guide: '关系要双方明确(from/to 用已存在人物名)、类型具体(同党/政敌/师生/姻亲等)、强度合理、与人物设定自洽。' },
        { kw: ['开场', '背景', 'opening', 'background', 'overview', '总览'], guide: '开场/背景要文风生动克制、点明玩家处境与首要矛盾、给出可操作的抓手，但不剧透结局、不写死必胜必败。' },
        { kw: ['官制', 'office', '官职'], guide: '官制要层级清晰、holder 指向真实在世人物、品级/职掌贴合时代制度，避免空缺与幽灵任职。' },
        { kw: ['区划', '行政', 'admin', '地图'], guide: '行政区划要顶级完整、父级人口>=子级之和、末级在地图中有对应区域、归属势力为已存在势力。' },
        { kw: ['物品', '道具', 'item'], guide: '物品要名称、类型、效果/属性、获取或归属清晰，贴合时代不出戏。' },
        /* 2026-07-03 · 内容整备：补五个此前无领域指引的章（点「生成本章」不再退化成通用一句话·朝代中立） */
        { kw: ['军务', '军事', 'military', '兵', '边防', '战'], guide: '军事内容要成体系：兵种(名称/兵源/装备/长短)、军制与编制、补给与军饷、初始部队(归属势力/驻地/兵力数)、战役与边患；兵力军费与剧本人口财政规模自洽，避免凭空数字。' },
        { kw: ['财政', '财赋', '经济', '税', 'fiscal', 'econom', '人口', '户口'], guide: '财政经济要能跑通：税目与税率、货币单位与兑率、固定支出(俸禄/军饷/宫廷)、收支结构(平衡或有意亏空作开局难题)；人口/垦田/岁入相互自洽。' },
        { kw: ['变量', '规则', 'rule', 'variable', '机制', '提示词'], guide: '变量要可被机制消费：名称/初值/上下限/分类/说明齐全；全局规则写成可执行条款(条件+效果)而非口号；AI 提示词交代世界观边界与禁则。' },
        { kw: ['时间线', '编年', 'timeline', '大事', '编年史'], guide: '编年事件要有锚点：年月/触发条件/波及范围/长远后果；重大转折留玩家介入空间，不写死结局；与既有事件网时序不冲突。' },
        { kw: ['阶层', '党派', 'class', 'party', '社会'], guide: '阶层与党派要有张力：各自诉求/满意度基线/代表人物/与朝廷关系；党派之间至少一组结构性矛盾，避免铁板一块。' }
      ];
      function sectionGuide(modName, field) {
        var hay = ((modName || '') + ' ' + (field || '')).toLowerCase();
        for (var i = 0; i < SECTION_GUIDES.length; i++) {
          var g = SECTION_GUIDES[i];
          for (var k = 0; k < g.kw.length; k++) { if (hay.indexOf(g.kw[k].toLowerCase()) >= 0) return g.guide; }
        }
        return '';
      }
      function buildPrompt(trigger) {
        var verb = VERB[trigger.dataset.aiAction] || '处理';
        var field = trigger.getAttribute('data-field-ai') || '';
        var mod = activeModuleName();
        var guide = sectionGuide(mod, field);
        var tail = '；与当前剧本设定保持一致、中文显示名、缺口先补冲突先列，改动先入草稿待我确认。' + (guide ? '\n【本部分要点】' + guide : '');
        if (field) {
          return '请' + verb + '字段「' + field + '」' + (mod ? '（模块：' + mod + '）' : '') + tail;
        }
        return '请' + verb + '本模块' + (mod ? '「' + mod + '」' : '') + '的内容，补齐缺失字段' + tail;
      }
      window._jeBuildPrompt = function (action, field) { return buildPrompt({ dataset: { aiAction: action }, getAttribute: function (k) { return k === 'data-field-ai' ? (field || '') : null; } }); };   // 测试钩子
      function guoshiUi() { return (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui) || null; }
      function drive(trigger) {
        var U = window.TM_AuthoringAgentUI;
        if (U && typeof U.ask === 'function') { document.body.classList.add('je-guoshi-docked'); return U.ask(buildPrompt(trigger), { status: '这个 AI 操作交给国师了，看一眼指令再发送。' }); }
        var ui = guoshiUi();
        if (!ui || !ui.els || !ui.els.req) return false;
        var panel = document.getElementById('tm-aa-panel');
        if (panel) panel.classList.add('open');
        document.body.classList.add('je-guoshi-docked');
        ui.els.req.value = buildPrompt(trigger);
        if (ui.els.status) ui.els.status.textContent = '已接管该 AI 操作，确认指令后点「生成」。';
        try { ui.els.req.focus(); ui.els.req.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        ui.els.req.style.transition = 'box-shadow .2s ease';
        ui.els.req.style.boxShadow = '0 0 0 2px var(--gold-bright)';
        setTimeout(function () { ui.els.req.style.boxShadow = ''; }, 750);
        return true;
      }
      document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-ai-action]');
        if (!trigger) return;
        if (!GEN[trigger.dataset.aiAction]) return;                         // 非内容生成 → 放行给 app.js
        if (!document.body.classList.contains('je-guoshi-docked')) return;   // 国师未常驻 → 回退旧路径
        var ui = guoshiUi();
        if (!ui || !ui.els || !ui.els.req) return;                          // 国师未就绪 → 回退
        e.preventDefault();
        e.stopImmediatePropagation();                                       // 掐掉 app.js 的 simulateAiDraft + drawer
        drive(trigger);
      }, true);
    })();

    /* 重设 M2 · 折子复杂字段「展开编辑」→ 平滑滚动到下方专门 workbench + 闪烁高亮，让创作者视线跟过去。
       纯附加：监听 .folio-expand[data-field-pick] 点击；app.js 的 field-pick 委托会同步重建
       #module-detail，故 setTimeout(0) 待渲染稳定后再定位（被点元素已被替换，定位用重建后的 DOM）。 */
    (function () {
      document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.folio-expand[data-field-pick]');
        if (!btn) return;
        setTimeout(function () {
          var target = document.querySelector('#module-detail .workbench-mode-bar')
            || document.querySelector('#module-detail .detail-block[data-panel]');
          if (!target) return;
          try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { try { target.scrollIntoView(); } catch (e2) {} }
          target.classList.add('folio-reveal-flash');
          setTimeout(function () { target.classList.remove('folio-reveal-flash'); }, 1100);
        }, 0);
      });
    })();

    /* 重设 M7 · 折子组导航：点顶部组 chip → 展开该组并平滑滚到，闪烁高亮。 */
    (function () {
      document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.folio-groupnav-btn');
        if (!b) return;
        var i = b.getAttribute('data-folio-group-jump');
        var g = document.querySelector('.module-folio details.folio-group[data-folio-group="' + i + '"]');
        if (!g) return;
        g.open = true;
        try { g.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { try { g.scrollIntoView(); } catch (e2) {} }
        g.classList.add('folio-reveal-flash');
        setTimeout(function () { g.classList.remove('folio-reveal-flash'); }, 1000);
      });
    })();

    /* 重设 N2 · 国师↔折子双向跳转（编辑器→国师侧）：折子字段行「↗」+ 左 rail 模块「↗」
       → 选中该字段/模块(revealField/revealModule)并把它作上下文打开国师 + 预填作用域 prompt。 */
    (function () {
      function guoshi() { return (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui) || null; }
      function ask(prefill) {
        var U = window.TM_AuthoringAgentUI;
        if (U && typeof U.ask === 'function') { document.body.classList.add('je-guoshi-docked'); U.ask(prefill); return; }
        var ui = guoshi(); if (!ui || !ui.els || !ui.els.req) return;
        var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open');
        document.body.classList.add('je-guoshi-docked');
        ui.els.req.value = prefill;
        try { ui.els.req.focus(); ui.els.req.dispatchEvent(new Event('input', { bubbles: true })); ui.els.req.setSelectionRange(prefill.length, prefill.length); } catch (e) {}
        try { ui.els.req.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      }
      function injectRailAsk() {
        document.querySelectorAll('#module-rail .module-tile[data-module-id]').forEach(function (tile) {
          if (tile.querySelector('.tile-ask')) return;
          var b = document.createElement('span');
          b.className = 'tile-ask'; b.textContent = '↗';
          b.setAttribute('data-ask-guoshi-module', tile.getAttribute('data-module-id'));
          b.title = '让国师审本章';
          tile.appendChild(b);
        });
      }
      function boot() { setTimeout(injectRailAsk, 300); setTimeout(injectRailAsk, 1200); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

      document.addEventListener('click', function (e) {
        var fb = e.target.closest && e.target.closest('.folio-ask[data-ask-guoshi]');
        if (fb) {
          e.preventDefault(); e.stopPropagation();
          var field = fb.getAttribute('data-ask-guoshi');
          var row = fb.closest('.folio-row');
          var lab = row && row.querySelector('.folio-label') ? row.querySelector('.folio-label').textContent.trim() : field;
          var app = window.TM_SCENARIO_EDITOR_RESET_APP;
          if (app && app.revealField) app.revealField(field);
          ask('关于字段「' + lab + '」（' + field + '），我想：');
          return;
        }
        var mb = e.target.closest && e.target.closest('.tile-ask[data-ask-guoshi-module]');
        if (mb) {
          e.preventDefault(); e.stopPropagation();
          var mid = mb.getAttribute('data-ask-guoshi-module');
          var tile = mb.closest('.module-tile');
          var nameEl = tile && tile.querySelector('.module-name');
          var mname = nameEl ? ((nameEl.childNodes[0] && nameEl.childNodes[0].textContent.trim()) || nameEl.textContent.trim()) : mid;
          var app = window.TM_SCENARIO_EDITOR_RESET_APP;
          if (app && app.revealModule) app.revealModule(mid);
          ask('审阅本章「' + mname + '」，指出缺口与可完善处，并给出修改草案。');
          return;
        }
      }, true);
    })();

    /* 重设 P1 · 国师主动体检：加载时自动跑 app.healthCheck()，在案卷详情顶部显可见横幅(必填缺失/断裂引用/数值异常)，
       每条可「定位」(revealField/revealEntity·复用 N2) 或「交国师」(开国师预填修复指令)。 */
    (function () {
      function app() { return window.TM_SCENARIO_EDITOR_RESET_APP; }
      function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      function ensureEl() {
        var insp = document.querySelector('.inspector'); var md = document.getElementById('module-detail');
        if (!insp || !md) return null;
        var el = document.getElementById('je-health');
        if (!el) { el = document.createElement('div'); el.id = 'je-health'; el.className = 'je-health'; insp.insertBefore(el, md); el.addEventListener('click', onClick); }
        return el;
      }
      function render() {
        var el = ensureEl(); var a = app(); if (!el || !a || !a.healthCheck) return;
        var rep; try { rep = a.healthCheck(); } catch (e) { return; }
        if (!rep || rep.total === 0) { el.className = 'je-health je-health-ok'; el.innerHTML = '<div class="je-health-bar"><span class="je-health-ico">🩺</span><b>剧本体检通过</b><span class="je-health-sub">未发现待办</span><button type="button" class="je-health-mini" data-health-refresh>重新体检</button></div>'; return; }
        var open = el.getAttribute('data-open') === '1';
        el.className = 'je-health';
        var head = '<div class="je-health-bar"><span class="je-health-ico">🩺</span><b>剧本体检</b><span class="je-health-sub">' + rep.total + ' 处待办</span>' +
          rep.categories.map(function (c) { return '<span class="je-health-pill">' + esc(c.label) + ' ' + c.items.length + '</span>'; }).join('') +
          '<button type="button" class="je-health-mini" data-health-refresh>重新体检</button><button type="button" class="je-health-mini" data-health-toggle>' + (open ? '收起 ▴' : '展开 ▾') + '</button></div>';
        var body = open ? ('<div class="je-health-body">' + rep.categories.map(function (c) {
          return '<div class="je-health-cat"><div class="je-health-cat-h">' + esc(c.label) + '（' + c.items.length + '）</div>' +
            c.items.slice(0, 40).map(function (it) {
              var data = it.jumpField ? ('data-health-field="' + esc(it.jumpField) + '"') : ('data-health-ref="' + esc(it.refName || '') + '" data-health-kind="' + esc(it.refKind || '') + '"');
              return '<div class="je-health-row"><span>' + esc(it.label) + '</span><button type="button" class="je-health-jump mini-ai" ' + data + '>定位</button><button type="button" class="je-health-ask mini-ai" ' + data + '>交国师</button></div>';
            }).join('') + (c.items.length > 40 ? '<div class="je-health-more">… 还有 ' + (c.items.length - 40) + ' 项</div>' : '') + '</div>';
        }).join('') + '</div>') : '';
        el.innerHTML = head + body;
      }
      function onClick(e) {
        var a = app();
        if (e.target.closest('[data-health-refresh]')) { render(); return; }
        if (e.target.closest('[data-health-toggle]')) { var el = document.getElementById('je-health'); el.setAttribute('data-open', el.getAttribute('data-open') === '1' ? '0' : '1'); render(); return; }
        var jump = e.target.closest('.je-health-jump'), askb = e.target.closest('.je-health-ask');
        var btn = jump || askb; if (!btn || !a) return;
        var field = btn.getAttribute('data-health-field'), ref = btn.getAttribute('data-health-ref'), kind = btn.getAttribute('data-health-kind');
        function locate() { if (field && a.revealField) a.revealField(field); else if (ref && a.revealEntity) a.revealEntity(kind === 'faction' ? 'factions' : 'characters', ref); }
        if (jump) { locate(); return; }
        locate();
        var prompt = field ? ('补齐缺失的必填字段「' + field + '」，给出贴合本剧本的值。') : ('修复问题：' + (ref ? ('实体「' + ref + '」') : '') + '；补齐或修正相关字段。');
        var U = window.TM_AuthoringAgentUI;
        if (U && typeof U.ask === 'function') { document.body.classList.add('je-guoshi-docked'); U.ask(prompt); return; }
        var ui = (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui); if (!ui || !ui.els || !ui.els.req) return;
        var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open'); document.body.classList.add('je-guoshi-docked');
        ui.els.req.value = prompt; try { ui.els.req.focus(); ui.els.req.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {}
      }
      function boot() { setTimeout(render, 700); setTimeout(render, 1700); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
      window._jeHealthRefresh = render;
    })();

    /* 重设 P2/P3 · 玩家视角预览 + 数值体检：顶栏注入「👁 玩家视角」「📊 数值体检」启动钮，
       共享模态壳。P2 渲开局卡片+当前人物图志(御案样式·只读)；P3 渲全体人物能力值分布+异常。 */
    (function () {
      var STAT = { intelligence: '智谋', valor: '武勇', military: '军事', administration: '政务', management: '管理', charisma: '魅力', diplomacy: '外交', benevolence: '仁德', integrity: '廉节', loyalty: '忠诚' };
      var STAT8 = ['intelligence', 'valor', 'military', 'administration', 'charisma', 'diplomacy', 'benevolence', 'integrity'];
      function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      function sc() { var a = window.TM_SCENARIO_EDITOR_RESET_APP; return (a && a.state && a.state.scenario) || {}; }
      function modal(title, html) {
        var back = document.getElementById('je-pv-back');
        if (!back) {
          back = document.createElement('div'); back.id = 'je-pv-back'; back.className = 'je-pv-back';
          back.innerHTML = '<div class="je-pv-modal"><div class="je-pv-hd"><b id="je-pv-title"></b><button type="button" class="je-pv-x" title="关闭">×</button></div><div class="je-pv-body" id="je-pv-body"></div></div>';
          document.body.appendChild(back);
          back.addEventListener('click', function (e) {
            if (e.target === back || (e.target.closest && e.target.closest('.je-pv-x'))) { back.remove(); return; }
            var j = e.target.closest && e.target.closest('.je-pv-jump');
            if (j) { var nm = j.getAttribute('data-pv-char'); var a = window.TM_SCENARIO_EDITOR_RESET_APP; if (a && a.revealEntity) a.revealEntity('characters', nm); back.remove(); }
          });
        }
        back.querySelector('#je-pv-title').textContent = title;
        back.querySelector('#je-pv-body').innerHTML = html;
      }
      function bar(v) { var n = Math.max(0, Math.min(100, Number(v) || 0)); return '<span class="je-pv-bar"><i style="width:' + n + '%"></i></span><b>' + (typeof v === 'number' ? v : '—') + '</b>'; }
      // ---- P2 玩家视角 ----
      function curChar() {
        var a = window.TM_SCENARIO_EDITOR_RESET_APP, st = a && a.state, s = sc();
        var arr = s.characters || [];
        if (st && st.selectedField === 'characters' && arr[st.selectedEntityIndex]) return arr[st.selectedEntityIndex];
        return arr[0] || null;
      }
      function playerPreview() {
        var s = sc();
        var open = '<div class="je-pv-card je-pv-open"><div class="je-pv-era">' + esc((s.dynasty || '') + (s.era ? ' · ' + s.era : '')) + '</div>' +
          '<h2>' + esc(s.name || '未命名剧本') + '</h2>' +
          (s.role ? '<div class="je-pv-role">玩家身份 · ' + esc(s.role) + '</div>' : '') +
          '<div class="je-pv-narr">' + esc(String(s.background || s.overview || '（无背景叙述）')).slice(0, 600) + '</div>' +
          (s.opening ? '<div class="je-pv-open-letter"><div class="je-pv-open-h">开场</div>' + esc(String(s.opening).slice(0, 700)) + '</div>' : '') + '</div>';
        var c = curChar();
        var ch = '';
        if (c) {
          ch = '<div class="je-pv-card je-pv-char"><div class="je-pv-char-hd"><h3>' + esc(c.name || c.id || '无名') + '</h3><span>' + esc([c.zi ? '字' + c.zi : '', c.haoName || '', c.officialTitle || c.title || ''].filter(Boolean).join(' · ')) + '</span></div>' +
            '<div class="je-pv-stats">' + STAT8.map(function (k) { return '<div class="je-pv-stat"><label>' + STAT[k] + '</label>' + bar(c[k]) + '</div>'; }).join('') + '</div>' +
            (c.persona || c.personality ? '<div class="je-pv-persona">' + esc(String(c.persona || c.personality).slice(0, 300)) + '</div>' : '') + '</div>';
        }
        modal('👁 玩家视角预览', open + ch);
      }
      // ---- P3 数值体检 ----
      function statAudit() {
        var s = sc(); var chars = (s.characters || []).filter(function (c) { return c && typeof c === 'object'; });
        var dist = STAT8.map(function (k) {
          var vals = []; chars.forEach(function (c) { if (typeof c[k] === 'number') vals.push(c[k]); });
          var n = vals.length, sum = vals.reduce(function (a, b) { return a + b; }, 0);
          var avg = n ? Math.round(sum / n) : 0, mn = n ? Math.min.apply(null, vals) : 0, mx = n ? Math.max.apply(null, vals) : 0;
          return { k: k, label: STAT[k], n: n, avg: avg, min: mn, max: mx, cover: chars.length ? Math.round(n / chars.length * 100) : 0 };
        });
        var flags = [];
        chars.forEach(function (c, i) {
          var nm = c.name || c.id || ('#' + (i + 1));
          var vals = STAT8.map(function (k) { return typeof c[k] === 'number' ? c[k] : null; }).filter(function (v) { return v != null; });
          if (!vals.length) { flags.push({ nm: nm, t: '无能力值' }); return; }
          if (vals.length >= 4 && vals.every(function (v) { return v === vals[0]; })) flags.push({ nm: nm, t: '全同 ' + vals[0] + '（疑占位）' });
          else if (vals.every(function (v) { return v >= 85; })) flags.push({ nm: nm, t: '全项 ≥85（疑 OP）' });
        });
        var distHtml = '<div class="je-pv-dist"><div class="je-pv-dist-h">能力值分布（' + chars.length + ' 人）</div>' +
          dist.map(function (d) { return '<div class="je-pv-distrow"><label>' + d.label + '</label><span class="je-pv-bar je-pv-bar-avg"><i style="width:' + d.avg + '%"></i></span><b>均 ' + d.avg + '</b><em>' + d.min + '–' + d.max + ' · 覆盖 ' + d.cover + '%</em></div>'; }).join('') + '</div>';
        var flagHtml = '<div class="je-pv-flags"><div class="je-pv-dist-h">异常人物（' + flags.length + '）</div>' +
          (flags.length ? flags.slice(0, 40).map(function (f) { return '<div class="je-pv-flagrow"><span>' + esc(f.nm) + '</span><em>' + esc(f.t) + '</em><button type="button" class="mini-ai je-pv-jump" data-pv-char="' + esc(f.nm) + '">定位</button></div>'; }).join('') + (flags.length > 40 ? '<div class="je-pv-more">… 还有 ' + (flags.length - 40) + ' 人</div>' : '') : '<div class="je-pv-ok">未发现占位/OP 异常 ✓</div>') + '</div>';
        modal('📊 数值体检 · 人物能力分布', distHtml + flagHtml);
        // 定位由 modal() 那个一次性 back click 委托统一处理（修监听泄漏，不再每次 render 绑定）。
      }
      function injectLaunchers() {
        var bar = document.querySelector('.top-actions'); if (!bar || bar.querySelector('[data-pv-launch]')) return;
        var b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'icon-btn'; b1.textContent = '👁'; b1.title = '玩家视角预览'; b1.setAttribute('data-pv-launch', 'preview');
        var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'icon-btn'; b2.textContent = '📊'; b2.title = '数值体检'; b2.setAttribute('data-pv-launch', 'audit');
        bar.appendChild(b1); bar.appendChild(b2);
      }
      document.addEventListener('click', function (e) {
        var l = e.target.closest && e.target.closest('[data-pv-launch]'); if (!l) return;
        if (l.getAttribute('data-pv-launch') === 'preview') playerPreview(); else statAudit();
      });
      function boot() { setTimeout(injectLaunchers, 400); setTimeout(injectLaunchers, 1400); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    })();

/* 刀①·纯附加：启用系统「true/false」文本框 → 金色开关胶囊（写回字符串+派发事件→app 现成存档；点击后同步补开关消闪烁；不碰 app.js/数据语义） */
(function () {
  if (document.getElementById('je-boolsw-style')) return;
  var st = document.createElement('style'); st.id = 'je-boolsw-style';
  st.textContent = '.je-boolsw{font-family:var(--je-font-kai,inherit);font-size:12px;cursor:pointer;border-radius:var(--je-radius,4px);padding:4px 14px;border:1px solid var(--je-gold-500,#8a6d2b);background:rgba(184,154,83,.10);color:var(--je-ink-200,#d4c9b0);transition:background .12s,color .12s,opacity .12s;line-height:1.2}.je-boolsw[data-on="1"]{background:var(--je-gold-500,#8a6d2b);color:var(--je-ink-900,#0a0908);border-color:var(--je-gold-400,#b89a53)}.je-boolsw[data-on="0"]{opacity:.72}.je-boolsw:hover{filter:brightness(1.12)}';
  document.head.appendChild(st);
  function makeSwitch(inp) {
    if (inp.tagName !== 'INPUT' || (inp.type && inp.type !== 'text')) return;
    var v = (inp.value || '').trim().toLowerCase();
    if (v !== 'true' && v !== 'false') return;
    inp.setAttribute('data-bool-enh', '1');
    var sw = document.createElement('button'); sw.type = 'button'; sw.className = 'je-boolsw';
    function paint() { var on = (inp.value || '').trim().toLowerCase() === 'true'; sw.dataset.on = on ? '1' : '0'; sw.setAttribute('aria-pressed', on ? 'true' : 'false'); sw.textContent = on ? '启用' : '停用'; }
    sw.addEventListener('click', function () {
      var on = (inp.value || '').trim().toLowerCase() === 'true';
      inp.value = on ? 'false' : 'true';
      try { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      paint();
      enh();   // app 可能在 dispatch 时同步重渲染该字段 → 立即给新 input 补开关，消除闪烁
    });
    paint(); inp.style.display = 'none';
    if (inp.parentNode) inp.parentNode.insertBefore(sw, inp.nextSibling);
  }
  function enh() { var l = document.querySelectorAll('input.rwf2-ctl:not([data-bool-enh])'); for (var k = 0; k < l.length; k++) makeSwitch(l[k]); }
  var t = null; function sched() { if (t) return; t = setTimeout(function () { t = null; enh(); }, 120); }
  function boot() { enh(); try { var tgt = document.getElementById('editor-reset-shell') || document.body; new MutationObserver(sched).observe(tgt, { childList: true, subtree: true }); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ── 工坊案台（创意工坊连接三稿·2026-07-21 owner「全部开」·批一=淘剧本橱窗·批二=出品案台）──
   三稿拆两张全宽柜台：起本幕「淘剧本橱窗」管逛与改编（自动取目录·即输即滤·排序·可开性亮牌·
   详情=世界线+评论预览），出品幕「出品案台」管发布与经营（账号印徽·双轨发布=发新作/更新已有
   预填+ID锁+版本自动+1·预检牌先亮再让点·提交台账治「审核中失踪」=本地记账+与已上架对账·
   我的发布作品卡带经营数据）。在线客户端 ../tm-online-client.js 懒加载(零依赖 UMD·登录态经
   localStorage 与游戏同源互通)。留守三闸：脏稿确认/改编 parentId 世界线/与原作同 ID 拦截。 */
(function () {
  'use strict';
  var S = { clientLoading: false, clientFail: '', busy: false, msg: '', msgTone: '', msgZone: '',
            mine: null, mineLoading: false, mineAutoTried: false, mineX: {}, mineLin: '',
            cat: null, catLoading: false, catQuery: '', catSort: 'new', catType: 'scenario', catOpenOnly: false, catAutoTried: false,
            feat: null, favs: null, favAutoTried: false,
            expanded: '', detail: {}, forkFrom: null,
            pubMode: 'new', pubBase: null, pub: null, pf: null, pfAt: 0 };
  function app() { return window.TM_SCENARIO_EDITOR_RESET_APP || null; }
  function client() { return (window.TM && window.TM.OnlineClient) || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function ensureClient() {
    if (client() || S.clientLoading) return;
    S.clientLoading = true;
    var s = document.createElement('script');
    s.src = '../tm-online-client.js';
    s.onload = function () { S.clientLoading = false; S.clientFail = ''; render(); };
    s.onerror = function () { S.clientLoading = false; S.clientFail = '在线客户端载入失败（离线或路径异常）'; render(); };
    document.head.appendChild(s);
  }

  function setMsg(m, tone, zone) { S.msg = m || ''; S.msgTone = tone || ''; S.msgZone = zone || ''; render(); }
  function sessionUser() {
    var c = client(); if (!c) return null;
    var ses = c.getSession();
    return ses && ses.token ? (ses.user || { username: '作者' }) : null;
  }
  function userLabel(u) { return (u && (u.nickname || u.username || u.name)) || '作者'; }

  // ── 展示小工具 ─────────────────────────────────────────────────────────
  function fmtWhen(v) {
    if (!v) return '';
    var d = new Date(v); var t = d.getTime();
    if (!isFinite(t)) return '';
    var diff = Date.now() - t;
    if (diff < 0) return '';
    var day = Math.floor(diff / 86400000);
    if (day === 0) return '今日更新';
    if (day < 30) return '更新于 ' + day + ' 天前';
    if (day < 365) return '更新于 ' + Math.floor(day / 30) + ' 个月前';
    return '更新于 ' + Math.floor(day / 365) + ' 年前';
  }
  function fmtStamp(t) {
    var d = new Date(t);
    if (!isFinite(d.getTime())) return '';
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (!n) return '';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }
  // 可开性：纯文本剧本才能开进编辑器；.tm-pack/带资产打包件归游戏内工坊装
  function isOpenable(p) {
    if (!p) return false;
    if (p.type && p.type !== 'scenario') return false;
    var u = String(p.packageUrl || p.url || '');
    if (/\.tm-pack(\?|#|$)/i.test(u)) return false;
    if (Array.isArray(p.assets) && p.assets.length) return false;
    return true;
  }
  // 版本自动+1：末段数字进一（1.2.0→1.2.1·解析不动→1.0.1）
  function bumpVersion(v) {
    var m = String(v || '').match(/^(.*?)(\d+)\s*$/);
    if (!m) return '1.0.1';
    return m[1] + (parseInt(m[2], 10) + 1);
  }
  // 典籍封面（书肆化·批五）：无美术资产就用字造封面——玄底大字+竖排签条+印
  function coverHue(id) {
    var h = 0; var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % 5;
    return h;
  }
  function coverHtml(p, small) {
    // 真封面优先(服务器补丁后 catalog 带 coverUrl 即点亮)·无封面走典籍字封
    var cu = p && (p.coverUrl || p.cover);
    if (cu) {
      var cuR = String(cu);
      try { var c0 = client(); if (c0) cuR = new URL(cuR, c0.getApiUrl()).toString(); } catch (_eCu) {}
      var seal0 = '';
      if (S.feat && S.feat[p.id]) seal0 = '<span class="ws-cseal" data-k="feat">荐</span>';
      else if ((p.author || '') === '天命官方') seal0 = '<span class="ws-cseal" data-k="off">官</span>';
      return '<div class="ws-cover' + (small ? ' ws-cover--s' : '') + ' ws-cover--img" aria-hidden="true"><img src="' + esc(cuR) + '" alt="" loading="lazy">' + seal0 + '</div>';
    }
    var t = String(p.title || p.id || '');
    var m = t.match(/[一-鿿]/);
    var glyph = m ? m[0] : (t.charAt(0) || '书');
    var slip = (t.replace(/[（(].*$/, '').slice(0, 10) || t.slice(0, 10)).replace(/[·、，。—-]+$/, '');
    var seal = '';
    if (S.feat && S.feat[p.id]) seal = '<span class="ws-cseal" data-k="feat">荐</span>';
    else if ((p.author || '') === '天命官方') seal = '<span class="ws-cseal" data-k="off">官</span>';
    return '<div class="ws-cover' + (small ? ' ws-cover--s' : '') + '" data-hue="' + coverHue(p.id) + '" aria-hidden="true">' +
      '<span class="ws-glyph">' + esc(glyph) + '</span>' +
      '<span class="ws-slip">' + esc(slip) + '</span>' + seal + '</div>';
  }
  function statLine(p) {
    var bits = ['↓ ' + (p.downloads || 0)];
    if (p.rating) bits.push('<span class="ws-star">★ ' + esc(p.rating) + (p.ratingCount ? '（' + p.ratingCount + ' 人评）' : '') + '</span>');
    var when = fmtWhen(p.updatedAt || p.createdAt);
    if (when) bits.push(esc(when));
    var sz = fmtSize(p.size);
    if (sz) bits.push(esc(sz) + (isOpenable(p) ? '' : ' · 打包件'));
    return '<div class="ws-stat">' + bits.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div>';
  }
  // 详情取回（橱窗详情/我的世界线共用·缓存）
  function fetchDetail(packId) {
    var c = client();
    if (!c || S.detail[packId]) return;
    S.detail[packId] = { loading: true };
    Promise.all([
      c.lineage(packId).catch(function () { return { nodes: [] }; }),
      c.comments(packId).catch(function () { return { comments: [] }; })
    ]).then(function (rs) {
      S.detail[packId] = { loading: false, lineage: rs[0] || { nodes: [] }, comments: (rs[1] && rs[1].comments) || [] };
      render();
    });
  }
  function lineageHtml(p, d) {
    var lin = '';
    if (d && d.lineage && d.lineage.nodes && d.lineage.nodes.length) {
      lin = d.lineage.nodes.slice(0, 8).map(function (n) {
        return '<div class="ws-lin-row">└─ ' + esc(n.title || n.id || '?') + (n.author ? ' · ' + esc(n.author) : '') + (n.version ? ' · v' + esc(n.version) : '') + '</div>';
      }).join('');
      if (d.lineage.nodes.length > 8) lin += '<div class="ws-dim">…共 ' + d.lineage.nodes.length + ' 条改编分支</div>';
    } else lin = '<div class="ws-dim">尚无改编分支——从这里开出第一条世界线。</div>';
    return '<div class="ws-lin"><div class="ws-lin-row ws-lin-root">◆ ' + esc(p.title || p.id) + '</div>' + lin + '</div>';
  }

  // ── 提交台账（治「审核中失踪」：本地记账+与已上架对账·服务器零改） ────────────
  function loadLedger() { try { return JSON.parse(localStorage.getItem('tm_ws_submissions') || '[]') || []; } catch (_e) { return []; } }
  function saveLedger(l) { try { localStorage.setItem('tm_ws_submissions', JSON.stringify(l.slice(0, 20))); } catch (_e) {} }
  function reconcileLedger() {
    var mine = S.mine || [];
    var led = loadLedger(); var changed = false;
    led.forEach(function (en) {
      if (!en || en.st === 'live') return;
      var hit = mine.some(function (p) { return p && p.id === en.id && String(p.version || '') === String(en.version || ''); });
      if (hit) { en.st = 'live'; changed = true; }
      else if (en.st !== 'stale' && Date.now() - (en.t || 0) > 72 * 3600000) { en.st = 'stale'; changed = true; }
    });
    if (changed) saveLedger(led);
    return led;
  }

  // ── 发布表单状态（值住在 S.pub·不再被重渲冲掉） ─────────────────────────────
  function pubInit(force) {
    if (S.pub && !force) return;
    var sc = (app() && app().state && app().state.scenario) || {};
    if (S.pubMode === 'update' && S.pubBase) {
      var b = S.pubBase;
      S.pub = { title: b.title || '', id: b.id || '', version: bumpVersion(b.version),
                desc: String(b.description || '').slice(0, 300),
                tags: Array.isArray(b.tags) ? b.tags.join('，') : String(b.tags || '') };
    } else {
      S.pub = { title: sc.name || '', id: sc.id || '', version: '1.0.0',
                desc: String(sc.description || sc.overview || '').slice(0, 300),
                tags: Array.isArray(sc.tags) ? sc.tags.join('，') : '' };
    }
    try { S.pubSize = JSON.stringify(sc).length; } catch (_eSz) { S.pubSize = 0; }
  }
  // 预检牌：常驻先亮（4s 缓存·红牌封提交并给直达门）
  function preflightGate() {
    var a = app(); if (!a) return null;
    if (S.pf && Date.now() - S.pfAt < 4000) return S.pf;
    try { S.pf = a.runPreflight(); } catch (_e) { S.pf = null; }
    S.pfAt = Date.now();
    return S.pf;
  }

  // ── 橱窗渲染（起本幕） ──────────────────────────────────────────────────
  function catList() {
    var list = (S.cat || []).slice();
    // 批Ⅳ·类型页签过滤（默认剧本）
    var ct = S.catType || 'scenario';
    list = list.filter(function (p) { return p && (String(p.type || 'scenario') === ct); });
    var q = S.catQuery.trim().toLowerCase();
    if (q) list = list.filter(function (p) {
      if (!p) return false;
      var hay = ((p.title || '') + ' ' + (p.author || '') + ' ' + (p.description || '') + ' ' + (Array.isArray(p.tags) ? p.tags.join(' ') : '')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (S.catOpenOnly) list = list.filter(isOpenable);
    if (S.catSort === 'hot') list.sort(function (a, b) { return (b.downloads || 0) - (a.downloads || 0); });
    else if (S.catSort === 'rating') list.sort(function (a, b) { return (Number(b.rating) || 0) - (Number(a.rating) || 0) || (b.ratingCount || 0) - (a.ratingCount || 0); });
    else list.sort(function (a, b) { return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0); });
    // 精选置顶（排序内序不乱）
    if (S.feat) {
      var fed = list.filter(function (p) { return S.feat[p.id]; });
      if (fed.length) list = fed.concat(list.filter(function (p) { return !S.feat[p.id]; }));
    }
    return list;
  }
  function sortChip(key, label) {
    return '<button type="button" class="ws-chip" data-on="' + (S.catSort === key) + '" data-ws-act="cat-sort" data-ws-sort="' + key + '">' + label + '</button>';
  }
  function renderCard(p) {
    var open = isOpenable(p);
    var badge = open ? '<span class="ws-badge" data-kind="open">可直接改编</span>' : '<span class="ws-badge" data-kind="pack">须游戏内安装</span>';
    if (S.feat && S.feat[p.id]) badge = '<span class="ws-badge" data-kind="feat">本周精选</span>' + badge;
    badge = '<span class="ws-badges">' + badge + '</span>';
    var faved = !!(S.favs && S.favs[p.id]);
    var tags = Array.isArray(p.tags) && p.tags.length
      ? '<div class="ws-tags">' + p.tags.slice(0, 6).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '';
    var acts = '<div class="ws-act-row">' +
      (open ? '<button type="button" class="mini-ai" data-ws-act="cat-open" data-ws-pack="' + esc(p.id || '') + '">开进编辑器改编</button>'
            : '<a class="ws-golink" href="../index.html?tmOpenWorkshop=1">去游戏内安装 →</a>') +
      '<button type="button" class="mini-ai" data-ws-act="cat-detail" data-ws-pack="' + esc(p.id || '') + '">' + (S.expanded === p.id ? '收起详情' : '详情 / 世界线') + '</button>' +
      '<button type="button" class="mini-ai" data-ws-act="fav" data-ws-pack="' + esc(p.id || '') + '">' + (faved ? '★ 已藏' : '☆ 收藏') + '</button>' +
      '</div>';
    var detail = '';
    if (S.expanded === p.id) {
      var d = S.detail[p.id];
      if (!d || d.loading) detail = '<div class="ws-detail"><span class="ws-dim">正在取回世界线与评论…</span></div>';
      else {
        var cms = '';
        if (d.comments && d.comments.length) {
          cms = d.comments.slice(0, 3).map(function (cm) {
            return '<div class="ws-cmt"><b>' + esc(cm.author || cm.username || '匿名') + '</b>：' + esc(String(cm.text || cm.content || '').slice(0, 120)) + '</div>';
          }).join('');
        } else cms = '<div class="ws-dim">还没有评论。</div>';
        // 批Ⅳ·资产包详情附清单（服务器 v2 下发 assets 后点亮·剧本类无此段）
        var assetLine = '';
        if (p.type && p.type !== 'scenario' && Array.isArray(p.assets) && p.assets.length) {
          assetLine = '<div class="ws-detail-h">' + ({ music: '曲目', portrait: '立绘', map: '图幅' }[p.type] || '资源') + ' · ' + p.assets.length + '</div>' +
            '<div class="ws-dim">' + p.assets.slice(0, 12).map(function (a) {
              return esc((a && a.name) || '') + (a && a.duration ? '（' + esc(a.duration) + '）' : '');
            }).join(' · ') + (p.assets.length > 12 ? ' …' : '') + '</div>';
        }
        detail = '<div class="ws-detail">' +
          (p.description ? '<p class="ws-desc-full">' + esc(p.description) + '</p>' : '') +
          assetLine +
          '<div class="ws-detail-h">世界线谱系</div>' + lineageHtml(p, d) +
          '<div class="ws-detail-h">评论（前 3 条 · 长评去游戏内工坊）</div>' + cms +
          '<div class="ws-rate">我来打分：' + [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" class="ws-rate-star" data-ws-act="rate" data-ws-pack="' + esc(p.id || '') + '" data-ws-score="' + n + '" aria-label="' + n + ' 星">★</button>';
          }).join('') + '<span class="ws-dim">即点即评（登录后）</span></div>' +
          '</div>';
      }
    }
    return '<article class="ws-card" data-ws-card="' + esc(p.id || '') + '"' + (S.feat && S.feat[p.id] ? ' data-feat="true"' : '') + '>' +
      coverHtml(p) +
      '<div class="ws-card-main">' +
      '<div class="ws-card-hd"><b>' + esc(p.title || p.id) + '</b><span class="ws-v">v' + esc(p.version || '?') + '</span>' +
      (p.author ? '<span class="ws-au">' + esc(p.author) + '</span>' : '') + badge + '</div>' +
      (p.description ? '<p class="ws-desc">' + esc(p.description) + '</p>' : '') +
      tags + statLine(p) + acts + detail +
      '</div></article>';
  }
  function renderBrowse() {
    var box = document.getElementById('workshop-browse-body');
    if (!box) return;
    var c = client();
    if (!c) { box.innerHTML = '<p class="ws-dim">' + (S.clientFail ? esc(S.clientFail) : '正在接通在线服务…') + '</p>'; return; }
    // 批Ⅳ·类型页签（剧本/立绘/音乐/地图·目录里真有 mod 包才多出 mod 签·缓议类型不空造）
    var _ct = S.catType || 'scenario';
    var _typeTabs = [['scenario', '剧本'], ['portrait', '立绘'], ['music', '音乐'], ['map', '地图']];
    if ((S.cat || []).some(function (p) { return p && p.type === 'mod'; })) _typeTabs.push(['mod', 'MOD']);
    var _tabsHtml = _typeTabs.map(function (t) {
      var n = (S.cat || []).filter(function (p) { return p && String(p.type || 'scenario') === t[0]; }).length;
      return '<button type="button" class="ws-chip" data-on="' + (_ct === t[0]) + '" data-ws-act="cat-type" data-ws-type="' + t[0] + '">' + t[1] + (n ? ' ' + n : '') + '</button>';
    }).join('');
    var html = '<div class="ws-shop-bar">' + _tabsHtml + '<span class="ws-dim" style="margin:0 4px;">·</span>' +
      '<input id="ws-cat-q" class="ws-desk-input ws-grow" value="' + esc(S.catQuery) + '" placeholder="搜标题 / 作者 / 简介 / 标签…（即输即滤）">' +
      sortChip('new', '最新') + sortChip('hot', '最热') + sortChip('rating', '评分') +
      (_ct === 'scenario' ? '<button type="button" class="ws-chip" data-on="' + S.catOpenOnly + '" data-ws-act="cat-openonly">只看可改编</button>' : '') +
      '<button type="button" class="mini-ai" data-ws-act="cat-refresh">' + (S.catLoading ? '正在取回…' : '刷新') + '</button>' +
      '</div>';
    if (S.catLoading && !S.cat) html += '<p class="ws-dim">正在取回在线目录…</p>';
    else if (!S.cat) html += '<p class="ws-dim">目录尚未取回——点「刷新」重试（离线时不可用）。</p>';
    else {
      var list = catList();
      if (!list.length) html += '<p class="ws-dim">' + (S.cat.length ? ((S.catType && S.catType !== 'scenario') ? '这一类还没有上架条目——去游戏内创意工坊发第一个。' : '没有匹配的剧本——换个搜法。') : '目录还是空的——第一个上架的没准就是你。') + '</p>';
      else html += '<div class="ws-shop-grid">' + list.map(renderCard).join('') + '</div>';
    }
    if (S.msg && S.msgZone === 'browse') html += '<div class="ws-desk-msg" data-tone="' + esc(S.msgTone) + '">' + esc(S.msg) + '</div>';
    box.innerHTML = html;
  }

  // ── 案台渲染（出品幕·批六两层制·owner拍板：登录/注册一层·发布一层）──
  //    未登录=关防层(居中登录门卡·淘剧本无需登录)·登录后=发布案台层(账号条+正案+账房+书架)
  function renderDesk() {
    var box = document.getElementById('workshop-desk-body');
    if (!box) return;
    var c = client();
    if (!c) {
      ensureClient();
      box.innerHTML = '<p class="ws-dim">' + (S.clientFail ? esc(S.clientFail) : '正在接通在线服务…') + '</p>';
      return;
    }
    var u = sessionUser();
    var foot = '<div class="ws-desk-foot"><a href="../index.html?tmOpenWorkshop=1">去游戏内工坊（评分 / 评论 / 圈子）→</a></div>';
    var msg = (S.msg && S.msgZone !== 'browse') ? '<div class="ws-desk-msg" data-tone="' + esc(S.msgTone) + '">' + esc(S.msg) + '</div>' : '';
    // ── 第一层·关防 ──
    if (!u) {
      box.innerHTML = '<div class="ws-gatehouse"><div class="ws-gatecard">' +
        '<div class="ws-gseal">坊</div>' +
        '<div class="ws-gtitle">登录创意工坊</div>' +
        '<p class="ws-gnote">发布剧本、经营书架需要账号；<b>淘剧本与改编无需登录</b>，去起本幕就能逛。</p>' +
        '<input id="ws-login-user" class="ws-desk-input" placeholder="用户名" autocomplete="username">' +
        '<input id="ws-login-pass" class="ws-desk-input" type="password" placeholder="密码" autocomplete="current-password">' +
        '<div class="ws-gbtns"><button type="button" class="mini-ai primary" data-ws-act="login"' + (S.busy ? ' disabled' : '') + '>登录</button>' +
        '<button type="button" class="mini-ai" data-ws-act="register"' + (S.busy ? ' disabled' : '') + '>注册新号</button></div>' +
        '<p class="ws-gnote ws-dim">与游戏内工坊同一账号互通——游戏里登过号，这里自动带入。</p>' +
        msg +
        '</div></div>' + foot;
      return;
    }
    pubInit();
    // ── 第二层·发布案台 ──
    var label = userLabel(u);
    var acctBar = '<div class="ws-desk-sec ws-acct-bar"><div class="ws-acct"><div class="ws-seal">' + esc(label.charAt(0)) + '</div>' +
      '<div class="ws-who"><b>' + esc(label) + '</b><div class="ws-dim">已登录 · 与游戏内工坊同一账号互通</div></div>' +
      '<button type="button" class="mini-ai ws-right" data-ws-act="logout">登出</button></div></div>';
    var canUpdate = !!(S.mine && S.mine.length);
    var pubSec = '<div class="ws-desk-sec" id="ws-pub-sec"><div class="ws-desk-h">发布</div>' +
      '<div class="ws-track">' +
      '<button type="button" data-on="' + (S.pubMode === 'new') + '" data-ws-act="pub-mode" data-ws-mode="new">发新作</button>' +
      '<button type="button" data-on="' + (S.pubMode === 'update') + '" data-ws-act="pub-mode" data-ws-mode="update"' + (canUpdate ? '' : ' disabled title="尚无已上架条目"') + '>更新已有</button>' +
      '</div>';
    if (S.forkFrom) pubSec += '<div class="ws-desk-row" style="color:var(--je-gold-400,#b89a53);">改编自「' + esc(S.forkFrom.title || S.forkFrom.id) + '」——发布将记入其世界线（谱系有账）。<button type="button" class="mini-ai" data-ws-act="fork-clear">取消改编</button></div>';
    if (S.pubMode === 'update') {
      pubSec += '<div class="ws-desk-row"><label>条目</label><select id="ws-pub-base" class="ws-desk-input">' +
        (S.mine || []).map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (S.pubBase && S.pubBase.id === p.id ? ' selected' : '') + '>' + esc(p.title || p.id) + '（线上 v' + esc(p.version || '?') + '）</option>';
        }).join('') + '</select>' +
        '<span class="ws-lock">ID 锁定 ' + esc(S.pub.id || '?') + '</span></div>';
      // 稿版核对：编辑器里开的稿 ≠ 要更新的条目·先亮黄牌(提交时再 confirm 一道)
      var curScn = (app() && app().state && app().state.scenario) || {};
      if (curScn.id && S.pubBase && curScn.id !== S.pubBase.id) {
        pubSec += '<div class="ws-desk-row"><span class="ws-gate" data-tone="warn"><i></i>稿版核对：当前编辑的是「' + esc(curScn.name || curScn.id) + '」·要更新的条目是「' + esc(S.pubBase.title || S.pubBase.id) + '」——提交内容以当前稿为准</span></div>';
      }
    }
    pubSec += '<div class="ws-desk-row"><label>标题</label><input id="ws-pub-title" class="ws-desk-input ws-grow" value="' + esc(S.pub.title) + '"></div>';
    if (S.pubMode !== 'update') {
      pubSec += '<div class="ws-desk-row"><label>ID</label><input id="ws-pub-id" class="ws-desk-input" value="' + esc(S.pub.id) + '" placeholder="唯一英文id·同id再发=更新"><label>版本</label><input id="ws-pub-version" class="ws-desk-input" value="' + esc(S.pub.version) + '" style="width:5.5em;"></div>';
    } else {
      pubSec += '<div class="ws-desk-row"><label>版本</label><input id="ws-pub-version" class="ws-desk-input" value="' + esc(S.pub.version) + '" style="width:5.5em;"><span class="ws-dim">← 自动 +1 · 可改' + (S.pubBase ? '（线上 v' + esc(S.pubBase.version || '?') + '）' : '') + '</span></div>';
    }
    pubSec += '<div class="ws-desk-row"><label>简介</label><textarea id="ws-pub-desc" class="ws-desk-input ws-grow" rows="3">' + esc(S.pub.desc) + '</textarea></div>' +
      '<div class="ws-desk-row"><label>标签</label><input id="ws-pub-tags" class="ws-desk-input ws-grow" value="' + esc(S.pub.tags) + '" placeholder="以逗号分隔"></div>' +
      // 发布补齐：封面+版本说明(与游戏内工坊投稿同档·服务器补丁前先随包送达·不显示不误导)
      '<div class="ws-desk-row"><label>封面</label><input type="file" id="ws-pub-cover" accept="image/*" class="ws-desk-input">' +
      (S.pubCover ? '<span class="ws-dim">已选 ' + esc(S.pubCover.name) + '（' + Math.round((S.pubCover.size || 0) / 1024) + ' KB）</span><button type="button" class="mini-ai" data-ws-act="cover-clear">去掉</button>' : '<span class="ws-dim">可选·橱窗卡片展示用（无封面走典籍字封）</span>') + '</div>' +
      '<div class="ws-desk-row"><label>版本说明</label><textarea id="ws-pub-notes" class="ws-desk-input ws-grow" rows="2" placeholder="本版改了什么（可选·随条目展示）">' + esc(S.pub.notes || '') + '</textarea></div>';
    var pf = preflightGate();
    var pfBlock = !!(pf && !pf.canExport);
    if (!pf) pubSec += '<div class="ws-desk-row"><span class="ws-gate" data-tone="dim"><i></i>预检未跑——提交前会自动跑一遍守门。</span></div>';
    else if (pf.canExport) pubSec += '<div class="ws-desk-row"><span class="ws-gate" data-tone="good"><i></i>发布预检通过 · ' + (pf.errors || 0) + ' 错 ' + (pf.warnings || 0) + ' 提醒</span></div>';
    else pubSec += '<div class="ws-desk-row"><button type="button" class="ws-gate" data-tone="bad" data-editor-command="focus-runtime-panel" data-runtime-panel="preflight-gate"><i></i>预检 ' + (pf.errors || '?') + ' 项错误——点此直达「发布预检」清账</button></div>';
    pubSec += '<div class="ws-desk-row"><button type="button" class="mini-ai primary" data-ws-act="publish"' + (!S.busy && !pfBlock ? '' : ' disabled') + '>' +
      (S.busy ? '正在提交…' : (S.pubMode === 'update' ? '提交更新 v' + esc(S.pub.version) : '提交发布 v' + esc(S.pub.version) + '（过审后上架）')) + '</button>' +
      (S.pubSize ? '<span class="ws-dim">' + esc(fmtSize(S.pubSize)) + ' · 纯文本剧本 · 运行时私有字段(_开头)出门前自动剔除</span>' : '') + '</div>' +
      // 批Ⅲ(2026-07-22)：资产包发布指路——案台专营剧本·音乐/立绘/地图打包件归游戏内工坊发布口（勿重复建设）
      '<div class="ws-desk-row"><span class="ws-dim">发音乐 / 立绘 / 地图资产包？</span><a class="ws-golink" href="../index.html?tmOpenWorkshop=1">去游戏内创意工坊 · 发布 →</a></div>' +
      '</div>';
    var led = reconcileLedger();
    var ledSec = '';
    if (led.length) {
      ledSec = '<div class="ws-desk-sec"><div class="ws-desk-h">提交台账（审核中不再失踪）</div>' +
        '<table class="ws-ledger"><tr><th>时间</th><th>条目</th><th>版本</th><th>状态</th></tr>' +
        led.slice(0, 8).map(function (en) {
          var st = en.st === 'live' ? '<span class="ws-st" data-st="live">已上架 ✓</span>'
                 : en.st === 'stale' ? '<span class="ws-st" data-st="stale">久未上架 · 可能被驳</span>'
                 : '<span class="ws-st" data-st="wait">待审核</span>';
          return '<tr><td>' + esc(fmtStamp(en.t)) + '</td><td>' + esc(en.title || en.id) + '</td><td>v' + esc(en.version || '?') + '</td><td>' + st + '</td></tr>';
        }).join('') + '</table></div>';
    }
    var mineSec = '<div class="ws-desk-sec"><div class="ws-desk-h">我的发布 <button type="button" class="mini-ai" data-ws-act="refresh-mine">刷新</button></div>';
    if (S.mineLoading) mineSec += '<div class="ws-desk-row ws-dim">正在取回…</div>';
    else if (!S.mine || !S.mine.length) mineSec += '<div class="ws-desk-row ws-dim">尚无已上架作品（审核中的看提交台账·过审后出现在这里）。</div>';
    else {
      mineSec += '<div class="ws-mine-grid">' + S.mine.map(function (p) {
        var x = S.mineX[p.id] || {};
        var bits = ['↓ ' + (p.downloads || 0)];
        if (p.rating) bits.push('<span class="ws-star">★ ' + esc(p.rating) + (p.ratingCount ? '（' + p.ratingCount + ' 人评）' : '') + '</span>');
        if (x.comments != null) bits.push('评论 ' + x.comments);
        if (x.forks != null) bits.push('改编 ' + x.forks);
        var lin = '';
        if (S.mineLin === p.id) {
          var d = S.detail[p.id];
          lin = '<div class="ws-detail">' + (!d || d.loading ? '<span class="ws-dim">正在取回世界线…</span>' : lineageHtml(p, d)) + '</div>';
        }
        return '<article class="ws-card">' + coverHtml(p, true) + '<div class="ws-card-main">' +
          '<div class="ws-card-hd"><b>' + esc(p.title || p.id) + '</b><span class="ws-v">v' + esc(p.version || '?') + '</span></div>' +
          '<div class="ws-stat">' + bits.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div>' +
          '<div class="ws-act-row">' +
          '<button type="button" class="mini-ai" data-ws-act="mine-newver" data-ws-pack="' + esc(p.id) + '">发新版</button>' +
          '<button type="button" class="mini-ai" data-ws-act="mine-lineage" data-ws-pack="' + esc(p.id) + '">' + (S.mineLin === p.id ? '收起世界线' : '看世界线') + '</button>' +
          '<a class="ws-golink" href="../index.html?tmOpenWorkshop=1">去游戏看评论 →</a>' +
          '</div>' + lin + '</div></article>';
      }).join('') + '</div>';
    }
    mineSec += '</div>';
    // ── 组装：账号条通栏·正案+账房双栏(无台账则正案通栏)·书架·尾注 ──
    var mid = ledSec
      ? '<div class="ws-desk-cols"><div class="ws-desk-main">' + pubSec + '</div><div class="ws-desk-side">' + ledSec + '</div></div>'
      : pubSec;
    box.innerHTML = acctBar + mid + mineSec + msg + foot;
  }
  function render() { renderBrowse(); renderDesk(); maybeAutoCat(); maybeAutoMine(); maybeAutoFavs(); }

  // ── 动作 ──────────────────────────────────────────────────────────────
  function doLogin(isRegister) {
    var c = client(); if (!c) return;
    var user = (document.getElementById('ws-login-user') || {}).value || '';
    var pass = (document.getElementById('ws-login-pass') || {}).value || '';
    if (!user.trim() || !pass) { setMsg('用户名与密码都要填。', 'warn'); return; }
    S.busy = true; setMsg(isRegister ? '正在注册…' : '正在登录…');
    var call = isRegister ? c.register({ username: user, password: pass, nickname: user }) : c.login({ username: user, password: pass });
    call.then(function (res) {
      S.busy = false;
      if (res && res.success) {
        if (isRegister && !c.isLoggedIn()) return c.login({ username: user, password: pass }).then(function () { setMsg('注册并登录成功。', 'good'); refreshMine(); });
        setMsg(isRegister ? '注册并登录成功。' : '登录成功。', 'good'); refreshMine();
      } else setMsg((isRegister ? '注册失败：' : '登录失败：') + ((res && res.error) || '未知错误'), 'error');
    }).catch(function (e) { S.busy = false; setMsg('在线服务不可达：' + ((e && e.message) || e), 'error'); });
  }
  function doLogout() {
    var c = client(); if (!c) return;
    c.logout().then(function () { S.mine = null; S.mineX = {}; S.pubMode = 'new'; S.pubBase = null; pubInit(true); setMsg('已登出。', 'good'); });
  }
  function maybeAutoMine() {
    // 登录着就自动取一次我的发布（台账对账+更新已有下拉都要它·失败不重试）
    if (S.mineAutoTried || S.mine !== null || S.mineLoading) return;
    if (!client() || !sessionUser()) return;
    if (!document.getElementById('workshop-desk-body')) return;
    S.mineAutoTried = true;
    setTimeout(refreshMine, 0);
  }
  function refreshMine() {
    var c = client(); var u = sessionUser();
    if (!c || !u) { render(); return; }
    S.mineLoading = true; render();
    c.authorPacks(u.id != null ? { authorId: u.id } : { name: u.username || u.name || '' }).then(function (res) {
      S.mineLoading = false;
      S.mine = (res && res.packs) || [];
      // 经营数据：每件作品补评论数/被改编数（封顶 6 件·并行·失败静默）
      S.mine.slice(0, 6).forEach(function (p) {
        if (!p || !p.id || S.mineX[p.id]) return;
        S.mineX[p.id] = { loading: true };
        Promise.all([
          c.comments(p.id).catch(function () { return {}; }),
          c.lineage(p.id).catch(function () { return {}; })
        ]).then(function (rs) {
          S.mineX[p.id] = { comments: rs[0] && rs[0].count != null ? rs[0].count : ((rs[0] && rs[0].comments) || []).length,
                            forks: ((rs[1] && rs[1].nodes) || []).length };
          render();
        });
      });
      render();
    }).catch(function () { S.mineLoading = false; S.mine = []; render(); });
  }
  function doPublish() {
    var a = app(); var c = client();
    if (!a || !c) return;
    if (!c.isLoggedIn()) { setMsg('先登录。', 'warn'); return; }
    // 预检守门：canExport=false 一律拦（与「出」同一道门·不给半成品上架的口子）
    var report = null;
    try { report = a.runPreflight(); } catch (_e) {}
    if (!report || !report.canExport) {
      setMsg('发布已拦：发布预检有 ' + ((report && report.errors) || '?') + ' 项错误——先在「发布预检」面板清账再来。', 'error');
      return;
    }
    pubInit();
    var meta = {
      title: S.pub.title || '',
      id: S.pub.id || '',
      version: S.pub.version || '1.0.0',
      description: S.pub.desc || '',
      tags: S.pub.tags || '',
      type: 'scenario',
      releaseNotes: S.pub.notes || '',
      coverImage: S.pubCover || null
    };
    if (!meta.title.trim()) { setMsg('标题不能为空。', 'warn'); return; }
    if (!meta.id.trim()) { setMsg('ID 不能为空。', 'warn'); return; }
    // 发布健全化(批七·对齐游戏内工坊投稿的必填与校验档次)
    if (!/^[A-Za-z0-9._-]+$/.test(meta.id.trim())) { setMsg('ID 只能用英文字母、数字、点、横线、下划线（含中文或空格会在服务器端出岔）。', 'warn'); return; }
    if (!/^\d+(\.\d+){0,3}$/.test(meta.version.trim())) { setMsg('版本号请用数字点分格式（如 1.0.0）。', 'warn'); return; }
    if (!meta.description.trim()) { setMsg('简介不能为空——橱窗卡片上全靠它揽客。', 'warn'); return; }
    if (S.forkFrom) {
      meta.parentId = S.forkFrom.id;   // 改编谱系：记入原作世界线(服务器 lineage 已支持)
      if (meta.id === S.forkFrom.id) { setMsg('改编发布请换一个自己的 ID（与原作同 ID 会顶撞原作条目）。', 'warn'); return; }
    }
    // 稿版核对：更新轨下当前稿与所选条目对不上·confirm 一道再放行(内容永远以当前稿为准)
    if (S.pubMode === 'update' && S.pubBase) {
      var curId = (a.state.scenario || {}).id || '';
      if (curId && curId !== S.pubBase.id && typeof window.confirm === 'function' &&
          !window.confirm('稿版核对：编辑器里开的是「' + curId + '」，要更新的工坊条目是「' + S.pubBase.id + '」——上传内容以当前稿为准。确定把当前稿发成该条目的新版本？')) return;
    }
    // 与游戏侧发布同律：_ 前缀运行时/私有字段不出门
    var rawScn = a.state.scenario || {};
    var cleanScn = {};
    Object.keys(rawScn).forEach(function (k) { if (k.charAt(0) !== '_') cleanScn[k] = rawScn[k]; });
    S.busy = true; render();
    c.uploadScenario(meta, cleanScn).then(function (res) {
      S.busy = false;
      if (res && res.success) {
        var led = loadLedger();
        led.unshift({ t: Date.now(), id: meta.id, title: meta.title, version: meta.version, st: 'wait' });
        saveLedger(led);
        // 与游戏侧同律：发布后自动发一条「新作发布」动态(fire-and-forget·失败静默)
        try {
          c.postFeed({ type: 'publish', body: '发布了剧本《' + meta.title + '》。',
                       refs: { packId: (res.pack && res.pack.id) || meta.id, packTitle: meta.title } }).catch(function () {});
        } catch (_eFd) {}
        setMsg('已提交「' + meta.title + '」v' + meta.version + '——待审核·过审后上架在线目录（进度看提交台账）。', 'good');
      }
      else setMsg('提交失败：' + ((res && res.error) || '未知错误'), 'error');
    }).catch(function (e) { S.busy = false; setMsg('提交失败（网络）：' + ((e && e.message) || e), 'error'); });
  }

  // ── 淘剧本 ────────────────────────────────────────────────────────────
  function maybeAutoCat() {
    // 进场自动取目录：客户端一就位就取一次·失败不重试(手点「刷新」)
    if (S.catAutoTried || S.cat || S.catLoading) return;
    if (!client()) return;
    if (!document.getElementById('workshop-browse-body')) return;
    S.catAutoTried = true;
    doCatRefresh();
  }
  function doCatRefresh() {
    var c = client(); if (!c) return;
    S.catLoading = true; renderBrowse();
    // 精选位：与目录并行取(失败静默·纯加分项)
    c.featured().then(function (fr) {
      var ids = {};
      ((fr && fr.packs) || []).forEach(function (p) { if (p && p.id) ids[p.id] = 1; });
      S.feat = ids; renderBrowse();
    }).catch(function () {});
    c.catalog().then(function (cat) {
      S.catLoading = false;
      // 批Ⅳ(2026-07-22)：橱窗收全类·按 S.catType 页签分列——剧本可开进编辑器·
      // 立绘/音乐/地图打包件亮「须游戏内安装」牌引去游戏装（发现面在此·装载面在游戏）
      S.cat = ((cat && cat.packs) || []).filter(function (p) { return !!p; });
      render();
    }).catch(function (e) { S.catLoading = false; S.cat = null; setMsg('目录取回失败：' + ((e && e.message) || e), 'error', 'browse'); });
  }
  function doCatDetail(packId) {
    if (S.expanded === packId) { S.expanded = ''; render(); return; }
    S.expanded = packId;
    fetchDetail(packId);
    render();
  }
  // ── 社区信号：收藏/打分（批三·长评/圈子仍归游戏内工坊正门） ───────────────────
  function maybeAutoFavs() {
    if (S.favAutoTried || S.favs) return;
    if (!client() || !sessionUser()) return;
    S.favAutoTried = true;
    refreshFavs();
  }
  function refreshFavs() {
    var c = client(); if (!c || !sessionUser()) return;
    c.favoritesList().then(function (res) {
      var ids = {};
      var arr = (res && (res.favorites || res.packs)) || [];
      arr.forEach(function (it) { var id = typeof it === 'string' ? it : (it && it.id); if (id) ids[id] = 1; });
      S.favs = ids; renderBrowse();
    }).catch(function () {});
  }
  function doFav(packId) {
    var c = client(); if (!c) return;
    if (!sessionUser()) { setMsg('先登录（出品幕案台可登录·与游戏账号互通）再收藏。', 'warn', 'browse'); return; }
    c.favorite(packId).then(function (res) {
      if (res && res.success === false && res.error) { setMsg('收藏失败：' + res.error, 'error', 'browse'); return; }
      if (!S.favs) S.favs = {};
      if (S.favs[packId]) delete S.favs[packId]; else S.favs[packId] = 1;   // 乐观翻面
      renderBrowse();
      refreshFavs();   // 以服务器为准回对一次
    }).catch(function (e) { setMsg('收藏失败（网络）：' + ((e && e.message) || e), 'error', 'browse'); });
  }
  function doRate(packId, score) {
    var c = client(); if (!c || !(score >= 1 && score <= 5)) return;
    if (!sessionUser()) { setMsg('先登录（出品幕案台可登录）再打分。', 'warn', 'browse'); return; }
    c.ratePack(packId, score).then(function (res) {
      if (res && res.success) { setMsg('已评 ' + score + ' 星——多谢！评分聚合随目录刷新。', 'good', 'browse'); doCatRefresh(); }
      else setMsg('打分失败：' + ((res && res.error) || '未知错误'), 'error', 'browse');
    }).catch(function (e) { setMsg('打分失败（网络）：' + ((e && e.message) || e), 'error', 'browse'); });
  }
  function doCatOpen(packId) {
    var a = app(); var c = client();
    if (!a || !c || !S.cat) return;
    var p = null;
    for (var i = 0; i < S.cat.length; i++) if (S.cat[i] && S.cat[i].id === packId) { p = S.cat[i]; break; }
    if (!p) { setMsg('目录里找不到这个包·先刷新。', 'warn', 'browse'); return; }
    if (a.state && a.state.dirty && typeof window.confirm === 'function' &&
        !window.confirm('载入「' + (p.title || p.id) + '」将替换当前编辑中的剧本（当前草稿已自动存于浏览器/案卷）。继续？')) return;
    var pkgUrl = p.packageUrl || p.url || '';
    if (!pkgUrl) { setMsg('此包没有可下载地址。', 'error', 'browse'); return; }
    var resolved = pkgUrl;
    try { resolved = new URL(pkgUrl, c.getApiUrl()).toString(); } catch (_eU) {}
    setMsg('正在下载「' + (p.title || p.id) + '」…', '', 'browse');
    fetch(resolved, { mode: 'cors', cache: 'no-store' }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    }).then(function (text) {
      var data;
      try { data = JSON.parse(text); }
      catch (_eJ) { throw new Error('此包是打包资源（含立绘/音频等）·编辑器只能开纯文本剧本——请在游戏内工坊安装后再说。'); }
      a.loadScenario(data);
      S.forkFrom = { id: p.id, title: p.title || p.id };
      setMsg('已载入「' + (p.title || p.id) + '」·改编模式——发布前记得换成自己的 ID。', 'good');
    }).catch(function (e) { setMsg('载入失败：' + ((e && e.message) || e), 'error', 'browse'); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-ws-act]');
    if (!t) return;
    var act = t.getAttribute('data-ws-act');
    if (act === 'login') doLogin(false);
    else if (act === 'register') doLogin(true);
    else if (act === 'logout') doLogout();
    else if (act === 'publish') doPublish();
    else if (act === 'refresh-mine') refreshMine();
    else if (act === 'cat-refresh') doCatRefresh();
    else if (act === 'cat-open') doCatOpen(t.getAttribute('data-ws-pack'));
    else if (act === 'cat-detail') doCatDetail(t.getAttribute('data-ws-pack'));
    else if (act === 'cat-sort') { S.catSort = t.getAttribute('data-ws-sort') || 'new'; renderBrowse(); }
    else if (act === 'cat-type') { S.catType = t.getAttribute('data-ws-type') || 'scenario'; S.expanded = ''; renderBrowse(); }
    else if (act === 'cat-openonly') { S.catOpenOnly = !S.catOpenOnly; renderBrowse(); }
    else if (act === 'fav') doFav(t.getAttribute('data-ws-pack'));
    else if (act === 'rate') doRate(t.getAttribute('data-ws-pack'), parseInt(t.getAttribute('data-ws-score'), 10) || 0);
    else if (act === 'fork-clear') { S.forkFrom = null; render(); }
    else if (act === 'cover-clear') { S.pubCover = null; render(); }
    else if (act === 'pub-mode') {
      var mode = t.getAttribute('data-ws-mode') || 'new';
      if (mode === S.pubMode) return;
      S.pubMode = mode;
      if (mode === 'update' && !S.pubBase && S.mine && S.mine.length) S.pubBase = S.mine[0];
      pubInit(true); render();
    }
    else if (act === 'mine-newver') {
      var pid = t.getAttribute('data-ws-pack');
      var base = (S.mine || []).filter(function (p) { return p && p.id === pid; })[0];
      if (!base) return;
      S.pubMode = 'update'; S.pubBase = base; pubInit(true); render();
      var sec = document.getElementById('ws-pub-sec');
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    else if (act === 'mine-lineage') {
      var lid = t.getAttribute('data-ws-pack');
      if (S.mineLin === lid) { S.mineLin = ''; render(); return; }
      S.mineLin = lid;
      fetchDetail(lid);
      render();
    }
  });
  // 表单值住进 S：即输即存·重渲不再冲掉手改（旧版每次 render 用剧本字段覆盖输入框）
  document.addEventListener('input', function (e) {
    var el = e.target; if (!el || !el.id) return;
    if (el.id === 'ws-cat-q') {
      S.catQuery = el.value || '';
      var pos = el.selectionStart;
      renderBrowse();
      var q = document.getElementById('ws-cat-q');
      if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (_eSel) {} }
      return;
    }
    if (!S.pub) return;
    if (el.id === 'ws-pub-title') S.pub.title = el.value;
    else if (el.id === 'ws-pub-id') S.pub.id = el.value;
    else if (el.id === 'ws-pub-version') S.pub.version = el.value;
    else if (el.id === 'ws-pub-desc') S.pub.desc = el.value;
    else if (el.id === 'ws-pub-tags') S.pub.tags = el.value;
    else if (el.id === 'ws-pub-notes') S.pub.notes = el.value;
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'ws-pub-base') {
      var pid = e.target.value;
      var base = (S.mine || []).filter(function (p) { return p && p.id === pid; })[0];
      if (base) { S.pubBase = base; pubInit(true); render(); }
      return;
    }
    // 封面选择：读成 {name,type,size,contentBase64}（与游戏内工坊投稿同形·≤2MB 守门）
    if (e.target && e.target.id === 'ws-pub-cover') {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1048576) { setMsg('封面请压到 2MB 以内（当前 ' + Math.round(f.size / 1048576 * 10) / 10 + ' MB）。', 'warn'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var b64 = String(rd.result || '').split(',')[1] || '';
        S.pubCover = { name: String(f.name || 'cover'), type: String(f.type || 'image/*'), size: f.size || 0, contentBase64: b64 };
        render();
      };
      rd.readAsDataURL(f);
    }
  });

  // ── 面板注入（与 👁📊 注入器同范式·等 app 起完） ─────────────────────────
  function injectPanel() {
    var grid = document.querySelector('.runtime-grid');
    if (!grid) return;
    if (!grid.querySelector('[data-panel="workshop-browse"]')) {
      var bdiv = document.createElement('div');
      bdiv.setAttribute('data-panel', 'workshop-browse');
      bdiv.setAttribute('data-stage', 'qiben');          // 五幕：淘剧本=起本
      bdiv.className = 'ws-full';
      bdiv.innerHTML = '<h3>淘剧本橱窗 · 拿来改编</h3><div id="workshop-browse-body"><p>正在准备橱窗。</p></div>';
      grid.appendChild(bdiv);
    }
    if (!grid.querySelector('[data-panel="workshop-desk"]')) {
      var div = document.createElement('div');
      div.setAttribute('data-panel', 'workshop-desk');
      div.setAttribute('data-stage', 'chupin');          // 五幕：发布经营=出品
      div.className = 'ws-full';
      div.innerHTML = '<h3>创意工坊 · 出品案台</h3><div id="workshop-desk-body"><p>正在准备工坊案台。</p></div>';
      grid.appendChild(div);
    }
    if (!document.getElementById('ws-desk-style')) {
      var st = document.createElement('style');
      st.id = 'ws-desk-style';
      st.textContent =
        /* 批五·书肆化（owner「这块的ui重新设计」）：脱掉网页表单皮·换典籍语言——
           每包一张字造封面(玄底大字+竖排签条+朱印官/金印荐·id哈希五色墨彩)·橱窗=书架·
           案台=左发布正案+右账房(印徽/台账)+下我的书架。 */
        '.ws-full{grid-column:1/-1;}' +
        '.ws-dim{color:var(--je-tx-dim,#7b7264);font-size:.8rem;}' +
        '.ws-grow{flex:1;min-width:9em;}' +
        '.ws-right{margin-left:auto;}' +
        '[data-panel="workshop-browse"] .mini-ai,[data-panel="workshop-desk"] .mini-ai{min-height:30px;font-size:.8rem;padding:.28rem .9rem;border-radius:6px;}' +
        '[data-panel="workshop-desk"] .mini-ai.primary{font-size:.85rem;padding:.4rem 1.2rem;}' +
        '.ws-desk-input{font-family:inherit;font-size:.85rem;background:rgba(0,0,0,.28);border:1px solid rgba(184,154,83,.3);border-radius:6px;color:inherit;padding:.4rem .6rem;}' +
        '.ws-desk-input:focus-visible{outline:none;border-color:var(--je-gold-300,#d4be7a);}' +
        '.ws-desk-sec{background:var(--je-chrome-1,#1b1917);border:1px solid var(--je-hairline,rgba(245,240,232,.08));border-radius:9px;padding:.85rem 1rem;margin:0 0 .65rem;}' +
        '.ws-desk-h{display:flex;align-items:center;gap:.6rem;font-size:.82rem;color:var(--je-gold-400,#b89a53);margin-bottom:.55rem;letter-spacing:.12em;}' +
        '.ws-desk-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(184,154,83,.28),transparent);}' +
        '.ws-desk-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;font-size:.82rem;margin:.35rem 0;}' +
        '.ws-desk-row label{color:var(--je-tx-dim,#8a8378);min-width:3em;}' +
        '.ws-desk-cols{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,3fr);gap:.65rem;align-items:start;}' +
        '@media (max-width:1100px){.ws-desk-cols{grid-template-columns:1fr;}}' +
        '.ws-desk-msg{font-size:.8rem;margin-top:.5rem;padding:.5rem .7rem;border-radius:6px;background:rgba(184,154,83,.12);}' +
        '.ws-desk-msg[data-tone="error"]{background:rgba(169,79,63,.2);color:#ef9a86;}' +
        '.ws-desk-msg[data-tone="good"]{background:rgba(95,157,140,.16);color:#bde6d9;}' +
        '.ws-desk-msg[data-tone="warn"]{background:rgba(184,154,83,.18);}' +
        '.ws-desk-foot{margin-top:.6rem;font-size:.78rem;}.ws-desk-foot a{color:var(--je-gold-400,#b89a53);}' +
        // 关防层(批六两层制)
        '.ws-gatehouse{display:grid;place-items:center;padding:1.6rem 0 1.2rem;}' +
        '.ws-gatecard{width:min(440px,96%);background:var(--je-chrome-1,#1b1917);border:1px solid var(--je-hairline-2,rgba(245,240,232,.16));border-radius:11px;padding:1.3rem 1.5rem 1.1rem;display:grid;gap:.6rem;justify-items:center;box-shadow:0 10px 34px rgba(0,0,0,.32);}' +
        '.ws-gseal{width:52px;height:52px;border-radius:11px;display:grid;place-items:center;font-size:1.5rem;color:#2a2014;background:linear-gradient(180deg,#d4be7a,#b89a53);box-shadow:inset 0 1px rgba(255,255,255,.35);}' +
        '.ws-gtitle{font-family:var(--je-font-display,inherit);font-size:1.15rem;letter-spacing:.14em;color:var(--je-tx-hi,#f0e9d8);}' +
        '.ws-gnote{font-size:.8rem;line-height:1.65;color:var(--je-tx-mid,#a89f8d);margin:0;text-align:center;}' +
        '.ws-gnote b{color:var(--je-gold-300,#d4be7a);font-weight:400;}' +
        '.ws-gatecard .ws-desk-input{width:100%;box-sizing:border-box;}' +
        '.ws-gbtns{display:flex;gap:.6rem;width:100%;margin-top:.2rem;}' +
        '.ws-gbtns .mini-ai{flex:1;min-height:34px;font-size:.88rem;}' +
        '.ws-gatecard .ws-desk-msg{width:100%;box-sizing:border-box;text-align:center;}' +
        '.ws-acct-bar{padding:.6rem 1rem;}' +
        // 典籍封面
        '.ws-cover{position:relative;flex:0 0 96px;height:128px;border-radius:6px;overflow:hidden;border:1px solid rgba(184,154,83,.35);background:linear-gradient(160deg,#272218,#161310);box-shadow:inset 0 1px rgba(255,255,255,.05),0 2px 8px rgba(0,0,0,.3);}' +
        '.ws-cover::before{content:"";position:absolute;inset:5px;border:1px solid rgba(212,190,122,.22);border-radius:3px;pointer-events:none;}' +
        '.ws-cover[data-hue="1"]{background:linear-gradient(160deg,#1e2426,#121517);}' +
        '.ws-cover[data-hue="2"]{background:linear-gradient(160deg,#282020,#171212);}' +
        '.ws-cover[data-hue="3"]{background:linear-gradient(160deg,#232028,#141318);}' +
        '.ws-cover[data-hue="4"]{background:linear-gradient(160deg,#25231c,#151410);}' +
        '.ws-glyph{position:absolute;left:54%;top:50%;transform:translate(-50%,-50%);font-family:var(--je-font-display,inherit);font-size:3.2rem;line-height:1;color:rgba(212,190,122,.42);user-select:none;}' +
        '.ws-cover[data-hue="1"] .ws-glyph{color:rgba(126,184,167,.4);}' +
        '.ws-cover[data-hue="2"] .ws-glyph{color:rgba(212,112,106,.36);}' +
        '.ws-cover[data-hue="3"] .ws-glyph{color:rgba(130,148,196,.4);}' +
        '.ws-slip{position:absolute;top:7px;left:7px;max-height:104px;overflow:hidden;background:rgba(16,14,12,.88);border:1px solid rgba(184,154,83,.42);border-radius:2px;padding:.4rem .18rem;writing-mode:vertical-rl;font-size:.7rem;letter-spacing:.12em;color:var(--je-tx-hi,#f0e9d8);}' +
        '.ws-cseal{position:absolute;right:6px;bottom:6px;width:21px;height:21px;display:grid;place-items:center;font-size:.7rem;border-radius:4px;}' +
        '.ws-cseal[data-k="off"]{color:#f6e7e2;background:linear-gradient(180deg,#c04030,#8b2e25);box-shadow:inset 0 1px rgba(255,255,255,.25);}' +
        '.ws-cseal[data-k="feat"]{color:#2a2014;background:linear-gradient(180deg,#d4be7a,#b89a53);box-shadow:inset 0 1px rgba(255,255,255,.35);}' +
        '.ws-cover--s{flex-basis:64px;height:88px;}' +
        '.ws-cover--s .ws-glyph{font-size:2rem;}' +
        '.ws-cover--s .ws-slip{font-size:.6rem;padding:.28rem .12rem;max-height:70px;top:5px;left:5px;}' +
        '.ws-cover--s .ws-cseal{width:17px;height:17px;font-size:.6rem;right:4px;bottom:4px;}' +
        '.ws-cover--img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}' +
        // 账号印徽
        '.ws-acct{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;}' +
        '.ws-seal{width:40px;height:40px;border-radius:9px;display:grid;place-items:center;font-size:1.15rem;color:#2a2014;background:linear-gradient(180deg,#d4be7a,#b89a53);box-shadow:inset 0 1px rgba(255,255,255,.35);}' +
        '.ws-who b{font-size:.95rem;font-weight:400;color:var(--je-tx-hi,#f0e9d8);}' +
        // 双轨
        '.ws-track{display:flex;gap:2px;background:rgba(10,9,8,.55);border:1px solid var(--je-hairline,rgba(245,240,232,.08));border-radius:8px;padding:4px;width:max-content;margin:.25rem 0 .5rem;}' +
        '.ws-track button{font-family:inherit;font-size:.85rem;letter-spacing:.08em;color:var(--je-tx-mid,#a89f8d);cursor:pointer;border:1px solid transparent;border-radius:6px;background:transparent;padding:.35rem 1.1rem;}' +
        '.ws-track button[data-on="true"]{color:var(--je-gold-300,#d4be7a);border-color:rgba(184,154,83,.45);background:rgba(184,154,83,.12);}' +
        '.ws-track button[disabled]{opacity:.45;cursor:default;}' +
        '.ws-lock{font-size:.7rem;color:var(--je-tx-dim,#7b7264);border:1px solid var(--je-hairline,rgba(245,240,232,.08));border-radius:4px;padding:.08rem .5rem;}' +
        // 预检牌
        '.ws-gate{display:inline-flex;align-items:center;gap:.5rem;font-family:inherit;font-size:.8rem;border-radius:7px;padding:.35rem .8rem;border:1px solid var(--je-hairline-2,rgba(245,240,232,.16));color:var(--je-tx-dim,#7b7264);background:transparent;}' +
        '.ws-gate i{font-style:normal;width:8px;height:8px;border-radius:50%;background:currentColor;}' +
        '.ws-gate[data-tone="good"]{border-color:rgba(126,184,167,.4);background:rgba(126,184,167,.12);color:var(--je-celadon-300,#a3d4c7);}' +
        '.ws-gate[data-tone="warn"]{border-color:rgba(184,154,83,.45);background:rgba(184,154,83,.1);color:var(--je-gold-300,#d4be7a);}' +
        '.ws-gate[data-tone="bad"]{border-color:rgba(192,64,48,.45);background:rgba(192,64,48,.12);color:var(--je-vermillion-300,#d4706a);cursor:pointer;}' +
        // 台账
        '.ws-ledger{width:100%;border-collapse:collapse;font-size:.78rem;}' +
        '.ws-ledger th{text-align:left;font-weight:400;font-size:.68rem;letter-spacing:.14em;color:var(--je-tx-dim,#7b7264);border-bottom:1px solid var(--je-hairline-2,rgba(245,240,232,.16));padding:.2rem .5rem .35rem;}' +
        '.ws-ledger td{border-bottom:1px solid var(--je-hairline,rgba(245,240,232,.08));padding:.42rem .5rem;color:var(--je-tx-mid,#a89f8d);font-variant-numeric:tabular-nums;}' +
        '.ws-ledger tr:last-child td{border-bottom:none;}' +
        '.ws-st{font-size:.68rem;border-radius:4px;padding:.08rem .5rem;white-space:nowrap;}' +
        '.ws-st[data-st="wait"]{color:var(--je-gold-300,#d4be7a);border:1px solid rgba(184,154,83,.45);background:rgba(184,154,83,.1);}' +
        '.ws-st[data-st="live"]{color:var(--je-celadon-300,#a3d4c7);border:1px solid rgba(126,184,167,.45);background:rgba(126,184,167,.12);}' +
        '.ws-st[data-st="stale"]{color:var(--je-vermillion-300,#d4706a);border:1px solid rgba(192,64,48,.45);background:rgba(192,64,48,.12);}' +
        '.ws-mine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:.8rem;align-items:start;}' +
        // 橱窗书架
        '.ws-shop-bar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:.85rem;}' +
        '.ws-chip{font-family:inherit;font-size:.8rem;color:var(--je-tx-mid,#a89f8d);cursor:pointer;background:rgba(184,154,83,.06);border:1px solid rgba(184,154,83,.26);border-radius:999px;padding:.3rem 1rem;}' +
        '.ws-chip:hover{color:var(--je-gold-300,#d4be7a);}' +
        '.ws-chip[data-on="true"]{color:var(--je-gold-300,#d4be7a);background:rgba(184,154,83,.16);border-color:var(--je-gold-300,#d4be7a);}' +
        '.ws-shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:.8rem;align-items:start;}' +
        '.ws-card{background:var(--je-chrome-1,#1b1917);border:1px solid var(--je-hairline,rgba(245,240,232,.08));border-radius:9px;padding:.85rem;display:flex;flex-direction:row;gap:.9rem;transition:border-color .15s ease;}' +
        '.ws-card:hover{border-color:rgba(184,154,83,.45);}' +
        '.ws-card-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:.45rem;}' +
        '.ws-card[data-feat="true"]{grid-column:1/-1;border-color:rgba(184,154,83,.35);background:linear-gradient(180deg,rgba(184,154,83,.07),transparent 55%),var(--je-chrome-1,#1b1917);}' +
        '.ws-card[data-feat="true"] .ws-cover{flex-basis:112px;height:150px;}' +
        '.ws-card-hd{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;}' +
        '.ws-card-hd b{font-size:1.08rem;font-weight:400;color:var(--je-tx-hi,#f0e9d8);font-family:var(--je-font-display,inherit);letter-spacing:.03em;}' +
        '.ws-v{font-size:.78rem;color:var(--je-tx-dim,#7b7264);font-variant-numeric:tabular-nums;}' +
        '.ws-au{font-size:.8rem;color:var(--je-gold-400,#b89a53);}' +
        '.ws-badges{margin-left:auto;display:flex;gap:.35rem;flex-wrap:wrap;}' +
        '.ws-badge{font-size:.68rem;letter-spacing:.1em;border-radius:4px;padding:.08rem .55rem;white-space:nowrap;}' +
        '.ws-badge[data-kind="open"]{color:var(--je-celadon-300,#a3d4c7);border:1px solid rgba(126,184,167,.45);background:rgba(126,184,167,.12);}' +
        '.ws-badge[data-kind="pack"]{color:var(--je-tx-mid,#a89f8d);border:1px solid var(--je-hairline-2,rgba(245,240,232,.16));background:rgba(245,240,232,.04);}' +
        '.ws-badge[data-kind="feat"]{color:var(--je-gold-300,#d4be7a);border:1px solid rgba(184,154,83,.5);background:rgba(184,154,83,.1);}' +
        '.ws-desc{font-size:.82rem;line-height:1.6;color:var(--je-tx-mid,#a89f8d);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
        '.ws-desc-full{font-size:.82rem;line-height:1.65;color:var(--je-tx-mid,#a89f8d);margin:.2rem 0;}' +
        '.ws-tags{display:flex;flex-wrap:wrap;gap:.35rem;}' +
        '.ws-tags span{font-size:.68rem;color:var(--je-tx-dim,#7b7264);border:1px solid var(--je-hairline,rgba(245,240,232,.08));border-radius:4px;padding:.02rem .45rem;}' +
        '.ws-stat{display:flex;gap:1rem;font-size:.76rem;color:var(--je-tx-dim,#7b7264);font-variant-numeric:tabular-nums;flex-wrap:wrap;}' +
        '.ws-star{color:var(--je-gold-300,#d4be7a);}' +
        '.ws-act-row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:auto;align-items:center;padding-top:.15rem;}' +
        '.ws-golink{font-size:.8rem;color:var(--je-tx-mid,#a89f8d);align-self:center;}' +
        '.ws-golink:hover{color:var(--je-gold-300,#d4be7a);}' +
        '.ws-detail{border-top:1px solid var(--je-hairline,rgba(245,240,232,.08));margin-top:.35rem;padding-top:.6rem;display:grid;gap:.35rem;}' +
        '.ws-detail-h{font-size:.72rem;letter-spacing:.14em;color:var(--je-gold-400,#b89a53);margin-top:.25rem;}' +
        '.ws-lin{font-size:.8rem;color:var(--je-tx-mid,#a89f8d);line-height:1.85;}' +
        '.ws-lin-root{color:var(--je-gold-300,#d4be7a);}' +
        '.ws-cmt{font-size:.8rem;color:var(--je-tx-mid,#a89f8d);border-left:2px solid var(--je-hairline-2,rgba(245,240,232,.16));padding-left:.65rem;margin:.2rem 0;}' +
        '.ws-cmt b{color:var(--je-tx-hi,#f0e9d8);font-weight:400;}' +
        '.ws-rate{display:flex;align-items:center;gap:.2rem;font-size:.8rem;color:var(--je-tx-mid,#a89f8d);flex-wrap:wrap;}' +
        '.ws-rate-star{background:none;border:none;color:var(--je-gold-400,#b89a53);cursor:pointer;font-size:1.1rem;padding:0 .12rem;}' +
        '.ws-rate-star:hover{color:var(--je-gold-300,#d4be7a);}' +
        '@media (max-width:760px){.ws-card{flex-direction:column;}.ws-cover{flex-basis:auto;width:96px;}}' +
        '@media (prefers-reduced-motion:reduce){.ws-card{transition:none;}}';
      document.head.appendChild(st);
    }
    render();
  }
  function boot() { setTimeout(injectPanel, 600); setTimeout(injectPanel, 1800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
