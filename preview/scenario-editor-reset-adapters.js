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

    /* 重设 slice 4 ·「案侧国师」：把 BYOK authoring-agent 浮层钉成常驻列。
       纯附加：点一次 FAB 把面板建好并打开 → 加 body.je-guoshi-docked（CSS 接管布局/重皮）
       → 把标题改成「国师」。不碰共享的 editor-authoring-agent-ui.js。 */
    (function () {
      function dock() {
        var fab = document.getElementById('tm-aa-fab');
        if (!fab) return false;                         // adapter 未就绪 / 非编辑器页
        document.body.classList.add('je-guoshi-docked');   // 先声明坞态·再开面板（共创面板首开自动全屏据此让位于坞）
        var panel = document.getElementById('tm-aa-panel');
        if (!panel) { fab.click(); panel = document.getElementById('tm-aa-panel'); }
        if (!panel) return false;
        panel.classList.add('open');                    // 常驻打开
        var hd = panel.querySelector('#tm-aa-hd b');
        if (hd) hd.textContent = '国师 · AI 共创';
        var hdSub = panel.querySelector('#tm-aa-hd .sub');   // UI优化：⌘K 命令面板发现提示（点了也能开）
        if (hdSub && !hdSub._jeCmdkHint) {
          hdSub._jeCmdkHint = true;
          hdSub.textContent = '⌘K 命令';
          hdSub.style.cursor = 'pointer'; hdSub.title = '打开命令面板（⌘K / Ctrl+K）';
          hdSub.addEventListener('click', function () { if (window._jeCmdkOpen) window._jeCmdkOpen(); });
        }
        // 注入「测试连接」：一键自检中转 API 连通（成功调用中转的可点验证）
        var hdRow = panel.querySelector('#tm-aa-hd');
        /* 2026-07-03 · 新版面板头把 ✕ 包进 .tm-aa-hdbtns 嵌套 span——#tm-aa-x 不再是
           hdRow 直系子节点，直接 insertBefore 会抛 NotFoundError 且掐死 dock() 后半段。
           安全插入：✕ 仍是直系则插其前，否则追加到行尾。 */
        var hdIns = function (el) {
          var xb = hdRow && hdRow.querySelector('#tm-aa-x');
          if (xb && xb.parentNode === hdRow) hdRow.insertBefore(el, xb);
          else if (hdRow) hdRow.appendChild(el);
        };
        if (hdRow && !panel.querySelector('.je-aa-test')) {
          var tb = document.createElement('button');
          tb.type = 'button';
          tb.className = 'je-aa-test';
          tb.textContent = '测试连接';
          tb.title = '用最小调用自检 API / 第三方中转是否连通';
          tb.addEventListener('click', function () {
            var AA = window.TM && window.TM.AuthoringAgent;
            var st = panel.querySelector('#tm-aa-status');
            if (!AA || !AA.testConnection) { if (st) st.textContent = 'agent 未就绪'; return; }
            if (st) st.textContent = '测试连接中…';
            tb.disabled = true;
            AA.testConnection().then(function (r) {
              if (st) st.textContent = (r.ok ? '✓ ' : '✗ ') + r.detail + (r.ok && r.model ? '（' + r.provider + ' · ' + r.model + '）' : '');
            }).catch(function (e) {
              if (st) st.textContent = '✗ ' + ((e && e.message) || e);
            }).then(function () { tb.disabled = false; });
          });
          hdIns(tb);
        }
        // 方向D · 审阅按钮：一键让国师把整个剧本当作品体检（只读·出报告·不改剧本）
        if (hdRow && !panel.querySelector('.je-aa-review')) {
          var rvb = document.createElement('button');
          rvb.type = 'button'; rvb.className = 'je-aa-test je-aa-review'; rvb.textContent = '🔍 审阅';
          rvb.title = '让国师体检剧本：平衡性/史实/可玩性/死局/缺口 → 出带定位的报告（不改剧本）';
          rvb.addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            if (U && U.review) U.review(); else { var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = 'agent 未就绪'; }
          });
          hdIns(rvb);
        }
        // 方向H · 分解执行按钮：把输入框里的大需求分解成多个子任务、逐步执行（共享草稿合并）
        if (hdRow && !panel.querySelector('.je-aa-orch')) {
          var ob = document.createElement('button');
          ob.type = 'button'; ob.className = 'je-aa-test je-aa-orch'; ob.textContent = '🧩 分解执行';
          ob.title = '大需求拆成多个子任务、逐步聚焦执行（适合"建一整个势力/一批人物"这类大改）';
          ob.addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            if (U && U.orchestrate) U.orchestrate(); else { var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = 'agent 未就绪'; }
          });
          hdIns(ob);
        }
        // 方向E · 体检按钮：确定性运行时校验（无需 API）·报告剧本能否被游戏正常加载
        if (hdRow && !panel.querySelector('.je-aa-preflight')) {
          var pfb = document.createElement('button');
          pfb.type = 'button'; pfb.className = 'je-aa-test je-aa-preflight'; pfb.textContent = '🩺 体检';
          pfb.title = '运行时体检（不需 API）：检查角色/官制/势力引用/启动必备，报告剧本能否被游戏正常加载';
          pfb.addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            if (U && U.preflight) U.preflight(); else { var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = 'agent 未就绪'; }
          });
          hdIns(pfb);
        }
        // 方向L · 问答按钮：把输入框里的问题交给国师只读查证后回答（不改剧本）
        if (hdRow && !panel.querySelector('.je-aa-qa')) {
          var qab = document.createElement('button');
          qab.type = 'button'; qab.className = 'je-aa-test je-aa-qa'; qab.textContent = '💬 问答';
          qab.title = '把剧本当知识库随便问（如"有几个东林党？""崇祯的对手都有谁？"）·只读查证后回答，不改剧本';
          qab.addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            if (U && U.qa) U.qa(); else { var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = 'agent 未就绪'; }
          });
          hdIns(qab);
        }
        // 方向N · 讲解按钮：让国师讲解剧本设计与机制（只读·onboarding）
        if (hdRow && !panel.querySelector('.je-aa-explain')) {
          var exb = document.createElement('button');
          exb.type = 'button'; exb.className = 'je-aa-test je-aa-explain'; exb.textContent = '📖 讲解';
          exb.title = '让国师讲解这个剧本的设计意图、格局、关键人物与上手要点（只读，不改剧本）';
          exb.addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            if (U && U.explain) U.explain(); else { var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = 'agent 未就绪'; }
          });
          hdIns(exb);
        }
        // 维度3/方向G · 撤销按钮：有检查点时出现，点了弹栈回退（可见性由检查点变化回调驱动）
        if (hdRow && !panel.querySelector('.je-aa-undo')) {
          var ub = document.createElement('button');
          ub.type = 'button'; ub.className = 'je-aa-test je-aa-undo'; ub.textContent = '↩ 撤销'; ub.hidden = true;
          ub.title = '撤销：弹出并恢复最近的检查点（回到上次应用/回退前）';
          ub.addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            if (U && U.undo) U.undo();
          });
          hdIns(ub);
        }
        // 刀F · 快捷操作条：玩家一键常用任务（不用会写 prompt，点了直跑）
        var body = panel.querySelector('#tm-aa-body');
        var req = panel.querySelector('#tm-aa-req');
        if (body && req && !panel.querySelector('.je-aa-quick')) {
          var QUICK = [
            ['补齐缺失', '请用 listGaps 找出游戏运行时必需但缺失的字段，逐一补齐，让剧本完整可玩；改完用 validateDraft 自查。'],
            ['检查冲突', '请用 validateDraft 全面校验本剧本，列出所有引用冲突、人口/区划不一致等问题（先只报告，不要改）。'],
            ['润色开场', '请润色 background / overview / opening 的文风，使其更生动、贴合时代，但不改变设定与事实。'],
            ['加3名人物', '请新增 3 名贴合本剧本背景的人物：含姓名、势力归属、官职、性格与 AI 人格；势力名必须用剧本里已存在的势力。']
          ];
          var bar = document.createElement('div');
          bar.className = 'je-aa-quick';
          QUICK.forEach(function (q) {
            var b = document.createElement('button');
            b.type = 'button'; b.textContent = q[0]; b.title = q[1];
            b.addEventListener('click', function () {
              req.value = q[1];
              var go = panel.querySelector('#tm-aa-go');
              if (go && !go.disabled) go.click();   // 一键直跑
            });
            bar.appendChild(b);
          });
          body.insertBefore(bar, panel.querySelector('#tm-aa-composer') || req);
        }
        // 计划模式开关：勾上后「生成」先出计划、批准再执行（Claude code plan mode）
        if (body && req && !panel.querySelector('.je-aa-planmode')) {
          var pm = document.createElement('label');
          pm.className = 'je-aa-planmode';
          var pmcb = document.createElement('input'); pmcb.type = 'checkbox';
          pmcb.addEventListener('change', function () {
            var u = window.TM_AuthoringAgentUI;
            if (u && u._ui) u._ui.planMode = pmcb.checked;
          });
          pm.appendChild(pmcb);
          pm.appendChild(document.createTextNode(' 计划模式（先出计划，批准再改）'));
          var qbar2 = panel.querySelector('.je-aa-quick');
          if (qbar2) qbar2.insertAdjacentElement('afterend', pm); else body.insertBefore(pm, panel.querySelector('#tm-aa-composer') || req);
        }
        // 方向J · 从官方剧本学习（开关式·默认关）：勾上后注入剧本现有实体作 few-shot 范例（编辑官方剧本时即官方范例·会增 token）
        if (body && req && !panel.querySelector('.je-aa-fewshot')) {
          var fs = document.createElement('label');
          fs.className = 'je-aa-planmode je-aa-fewshot';
          var fscb = document.createElement('input'); fscb.type = 'checkbox';
          fscb.addEventListener('change', function () {
            var u = window.TM_AuthoringAgentUI, AA = window.TM && window.TM.AuthoringAgent;
            if (!u || !u._ui) return;
            if (fscb.checked && AA && AA.buildExemplars) {
              var sc = (window.TM_SCENARIO_EDITOR_RESET_APP && window.TM_SCENARIO_EDITOR_RESET_APP.state && window.TM_SCENARIO_EDITOR_RESET_APP.state.scenario) || (u._ui.adapter && u._ui.adapter.getScenario && u._ui.adapter.getScenario());
              var ex = sc ? AA.buildExemplars(sc) : '';
              u._ui.exemplars = ex || null;
              var st = panel.querySelector('#tm-aa-status');
              if (st) st.textContent = ex ? '已开启：生成时参考本剧本范例（编辑官方剧本即官方范例·会增 token）' : '本剧本暂无可作范例的实体';
            } else {
              u._ui.exemplars = null;
            }
            try { req.dispatchEvent(new Event('input')); } catch (e) {}   // 刷新 token 估算
          });
          fs.appendChild(fscb);
          fs.appendChild(document.createTextNode(' 📚 学官方范例（生成贴近官方笔法·会增 token）'));
          var pmRef = panel.querySelector('.je-aa-planmode:not(.je-aa-fewshot)');
          if (pmRef) pmRef.insertAdjacentElement('afterend', fs); else body.insertBefore(fs, panel.querySelector('#tm-aa-composer') || req);
        }
        // 跑前估 token：玩家心里有数（像 Claude code 跑前看上下文体量）。随输入防抖刷新；仅估算。
        var goForEst = panel.querySelector('#tm-aa-go');
        if (body && req && goForEst && !panel.querySelector('.je-aa-esttok')) {
          var est = document.createElement('div');
          est.className = 'je-aa-esttok'; est.hidden = true;
          body.insertBefore(est, panel.querySelector('#tm-aa-composer') || goForEst);
          var fmtTok = function (n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n); };
          var calcEst = function () {
            var AA = window.TM && window.TM.AuthoringAgent;
            var txt = (req.value || '').trim();
            if (!AA || !AA.estimateRun || !txt) { est.hidden = true; return; }
            var u = (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui) || {};
            var app = window.TM_SCENARIO_EDITOR_RESET_APP;
            var sc = (app && app.state && app.state.scenario) || (u.adapter && u.adapter.getScenario && u.adapter.getScenario());
            if (!sc) { est.hidden = true; return; }
            try {
              var draft = AA.makeDraft(sc);
              var ectx = (u.adapter && u.adapter.getContext) ? (u.adapter.getContext() || '') : '';
              var r = AA.estimateRun(draft, txt, { planOnly: !!u.planMode, priorConversation: (u.conversation && !u._pendingPlan) ? u.conversation : null, editorContext: ectx, exemplars: u.exemplars || null });
              est.textContent = '预计消耗 ≈ ' + fmtTok(r.low) + '–' + fmtTok(r.high) + ' tokens'
                + (r.planOnly ? '（计划模式·只读出计划）' : (r.continuing ? '（接上轮追问）' : ''))
                + ' · 仅估算，实际看改动复杂度';
              est.hidden = false;
            } catch (e) { est.hidden = true; }
          };
          var estTimer = null;
          var scheduleEst = function () { if (estTimer) clearTimeout(estTimer); estTimer = setTimeout(calcEst, 450); };
          req.addEventListener('input', scheduleEst);
          req.addEventListener('focus', scheduleEst);   // 示例/快捷填入后聚焦也刷新
          var pmEst = panel.querySelector('.je-aa-planmode input');
          if (pmEst) pmEst.addEventListener('change', calcEst);   // 切计划模式即时重估
        }
        // 刀F · 停止按钮：agent 跑动时出现，点了中断（轮间停）
        var goBtn = panel.querySelector('#tm-aa-go');
        if (goBtn && !panel.querySelector('.je-aa-stop')) {
          var stop = document.createElement('button');
          stop.type = 'button'; stop.className = 'je-aa-stop'; stop.textContent = '停止'; stop.hidden = true;
          stop.addEventListener('click', function () {
            var AA = window.TM && window.TM.AuthoringAgent;
            if (AA && AA.abort) AA.abort();
            var st = panel.querySelector('#tm-aa-status');
            if (st) st.textContent = '停止中…（本步完成后停下）';
          });
          goBtn.insertAdjacentElement('afterend', stop);
          try {
            new MutationObserver(function () { stop.hidden = !goBtn.disabled; })
              .observe(goBtn, { attributes: true, attributeFilter: ['disabled'] });
          } catch (e) {}
        }
        // 维度4 · 示例引导：点了填进输入框（玩家可改，不自动跑）
        if (body && req && !panel.querySelector('.je-aa-examples')) {
          var EX = ['给本剧本加 3 名东林党谏官', '把辽东局势设为开局危机', '为缺失的势力补齐领袖与外交'];
          var exWrap = document.createElement('div');
          exWrap.className = 'je-aa-examples';
          var exLab = document.createElement('span'); exLab.textContent = '试试：'; exWrap.appendChild(exLab);
          EX.forEach(function (t) {
            var c = document.createElement('button'); c.type = 'button'; c.textContent = t;
            c.addEventListener('click', function () { req.value = t; req.focus(); });
            exWrap.appendChild(c);
          });
          var exAnchor = panel.querySelector('#tm-aa-composer'); if (exAnchor) body.insertBefore(exWrap, exAnchor); else if (req.nextSibling) body.insertBefore(exWrap, req.nextSibling); else body.appendChild(exWrap);
        }
        // 维度4 · dock 内 API 设置（折叠）：玩家就地配置中转/密钥，不用找设置面板
        if (body && !panel.querySelector('.je-aa-apicfg')) {
          var acfg = {}; try { acfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch (e) {}
          var box = document.createElement('details');
          box.className = 'je-aa-apicfg';
          box.innerHTML = '<summary>⚙ API 设置（中转 / 密钥）</summary>'
            + '<label>地址<input class="je-api-url" placeholder="https://中转地址/v1"></label>'
            + '<label>密钥<input class="je-api-key" type="password" placeholder="sk-..."></label>'
            + '<label>模型<input class="je-api-model" placeholder="gpt-4o / claude-..."></label>'
            + '<button type="button" class="je-api-save">保存</button>';
          body.insertBefore(box, body.firstChild);
          box.querySelector('.je-api-url').value = acfg.url || '';
          box.querySelector('.je-api-key').value = acfg.key || '';
          box.querySelector('.je-api-model').value = acfg.model || '';
          box.querySelector('.je-api-save').addEventListener('click', function () {
            var u = box.querySelector('.je-api-url').value.trim();
            var k = box.querySelector('.je-api-key').value.trim();
            var m = box.querySelector('.je-api-model').value.trim();
            try { localStorage.setItem('tm_api', JSON.stringify({ key: k, url: u, model: m || 'gpt-4o', temp: 0.7 })); } catch (e) {}
            var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = 'API 已保存，可点「测试连接」验证';
          });
        }
        // 方向B · 剧本约定（折叠）：玩家写下一贯的创作偏好（风格/命名/难度…），每次 run 自动注入，越用越懂你
        if (body && !panel.querySelector('.je-aa-conv')) {
          var AAc = window.TM && window.TM.AuthoringAgent;
          var cbox = document.createElement('details');
          cbox.className = 'je-aa-apicfg je-aa-conv';
          cbox.innerHTML = '<summary>📜 剧本约定（每次都遵守的创作偏好）</summary>'
            + '<div class="je-conv-hint">写下你一贯的创作偏好，agent 每次都会遵守。例：文风暗黑写实；人名用明代官话；势力名带地名后缀；难度偏硬核、别给玩家开金手指。</div>'
            + '<textarea class="je-conv-text" placeholder="（留空则不注入）例：文风冷峻克制；忠奸不脸谱化；新增人物必配 AI 人格与动机…"></textarea>'
            + '<button type="button" class="je-api-save je-conv-save">保存约定</button>';
          var apiBox = panel.querySelector('.je-aa-apicfg:not(.je-aa-conv)');
          if (apiBox && apiBox.nextSibling) body.insertBefore(cbox, apiBox.nextSibling); else if (apiBox) body.appendChild(cbox); else body.insertBefore(cbox, body.firstChild);
          try { cbox.querySelector('.je-conv-text').value = (AAc && AAc.loadConventions) ? AAc.loadConventions() : (localStorage.getItem('tm_aa_conventions') || ''); } catch (e) {}
          cbox.querySelector('.je-conv-save').addEventListener('click', function () {
            var t = cbox.querySelector('.je-conv-text').value;
            var okSave = (AAc && AAc.saveConventions) ? AAc.saveConventions(t) : (function () { try { localStorage.setItem('tm_aa_conventions', t || ''); return true; } catch (e) { return false; } })();
            var st = panel.querySelector('#tm-aa-status');
            if (st) st.textContent = okSave ? ((t || '').trim() ? '剧本约定已保存，之后每次生成都会遵守 ✓' : '剧本约定已清空') : '保存失败';
            try { req.dispatchEvent(new Event('input')); } catch (e) {}   // 刷新 token 估算
          });
        }
        // 方向F · 权限 / 自主度（折叠）：玩家按信任度调 agent 放手程度（自主度档位 + 危险操作开关 + 范围沙箱）
        if (body && !panel.querySelector('.je-aa-perm')) {
          var pbox = document.createElement('details');
          pbox.className = 'je-aa-apicfg je-aa-perm';
          var collOpts = '';
          try {
            var psc = (window.TM_SCENARIO_EDITOR_RESET_APP && window.TM_SCENARIO_EDITOR_RESET_APP.state && window.TM_SCENARIO_EDITOR_RESET_APP.state.scenario) || {};
            var CN = { characters: '人物', factions: '势力', parties: '党派', events: '事件', items: '物品', families: '家族', relations: '关系', adminHierarchy: '区划', military: '军务', openingLetters: '开场信', cities: '城市', classes: '阶层', traitDefinitions: '特质', goals: '目标', variables: '变量' };
            Object.keys(psc).forEach(function (k) { if (Array.isArray(psc[k]) && psc[k].length) collOpts += '<label class="je-perm-coll"><input type="checkbox" value="' + k + '" checked> ' + (CN[k] || k) + '</label>'; });
          } catch (e) {}
          pbox.innerHTML = '<summary>🔐 权限 / 自主度</summary>'
            + '<label>自主度<select class="je-perm-auto"><option value="review">批量后审（默认·改完给你审）</option><option value="auto">全自动（校验通过自动应用）</option></select></label>'
            + '<label class="je-perm-danger"><input type="checkbox" class="je-perm-destructive" checked> 允许危险操作（删除 / 改名）</label>'
            + '<div class="je-perm-scope-hd">范围沙箱（勾＝允许 agent 改动·全勾＝不限制）</div>'
            + '<div class="je-perm-scope">' + (collOpts || '<span style="padding:0 10px;font-size:11px;color:var(--paper-dim)">（无集合）</span>') + '</div>';
          var ckRef = panel.querySelector('.je-aa-ckpt');
          if (ckRef) body.insertBefore(pbox, ckRef); else body.appendChild(pbox);
          var syncPerms = function () {
            var u = window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui; if (!u) return;
            u.autonomy = pbox.querySelector('.je-perm-auto').value;
            u.allowDestructive = pbox.querySelector('.je-perm-destructive').checked;
            var boxes = [].slice.call(pbox.querySelectorAll('.je-perm-coll input'));
            var checked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
            u.allowedCollections = (boxes.length && checked.length < boxes.length) ? checked : null;   // 全勾=不限制
          };
          pbox.addEventListener('change', syncPerms);
          syncPerms();
        }
        // 方向R · 模板/宏：玩家自定义、持久的常用指令库（一键载入输入框）
        if (body && req && !panel.querySelector('.je-aa-macro')) {
          var mbox = document.createElement('details');
          mbox.className = 'je-aa-apicfg je-aa-macro';
          mbox.innerHTML = '<summary>🧰 模板（0）</summary>'
            + '<div class="je-macro-save"><input class="je-macro-name" placeholder="给当前输入框内容起个名"><button type="button" class="je-macro-add">存为模板</button></div>'
            + '<div class="je-macro-list"></div>';
          body.appendChild(mbox);
          var mList = mbox.querySelector('.je-macro-list');
          var mName = mbox.querySelector('.je-macro-name');
          var mSummary = mbox.querySelector('summary');
          var escM = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
          var renderMacros = function () {
            var U = window.TM_AuthoringAgentUI; if (!U || !U.macros) return;
            var list = U.macros();
            mSummary.textContent = '🧰 模板（' + list.length + '）';
            if (!list.length) { mList.innerHTML = '<div class="je-macro-empty">（暂无模板·在输入框写好常用指令、起名后「存为模板」）</div>'; return; }
            mList.innerHTML = '';
            list.forEach(function (mc) {
              var row = document.createElement('div'); row.className = 'je-macro-row';
              var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = mc.name; nm.title = mc.prompt;
              nm.addEventListener('click', function () { var U2 = window.TM_AuthoringAgentUI; if (U2 && U2.applyMacro) U2.applyMacro(mc.id); });
              var del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '×'; del.title = '删除';
              del.addEventListener('click', function (e) { e.stopPropagation(); var U2 = window.TM_AuthoringAgentUI; if (U2 && U2.deleteMacro) U2.deleteMacro(mc.id); });
              row.appendChild(nm); row.appendChild(del); mList.appendChild(row);
            });
          };
          mbox.querySelector('.je-macro-add').addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI;
            var ok = U && U.saveMacro && U.saveMacro(mName.value, req.value);
            var st = panel.querySelector('#tm-aa-status');
            if (ok) { mName.value = ''; if (st) st.textContent = '已存为模板'; }
            else if (st) st.textContent = '请先在输入框写指令、并给模板起个名';
          });
          try { if (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui) window.TM_AuthoringAgentUI._ui._onMacrosChange = renderMacros; } catch (e) {}
          renderMacros();
        }
        // 方向M · 运行历史/审计日志：持久可搜的 run 记录（请求/摘要/token/时间/是否应用）
        if (body && !panel.querySelector('.je-aa-hist')) {
          var hbox = document.createElement('details');
          hbox.className = 'je-aa-apicfg je-aa-hist';
          hbox.innerHTML = '<summary>📋 历史（0）</summary>'
            + '<input class="je-hist-search" placeholder="搜索历史（请求 / 摘要 / 类型）">'
            + '<div class="je-hist-list"></div>'
            + '<button type="button" class="je-hist-changelog">📝 生成版本说明</button>'
            + '<button type="button" class="je-hist-clear">清空历史</button>';
          body.appendChild(hbox);
          var hList = hbox.querySelector('.je-hist-list');
          var hSearch = hbox.querySelector('.je-hist-search');
          var hSummary = hbox.querySelector('summary');
          var esc2 = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
          var renderHist = function () {
            var U = window.TM_AuthoringAgentUI;
            if (!U || !U.history) return;
            var all = U.history();
            var rows = U.history(hSearch.value);
            hSummary.textContent = '📋 历史（' + all.length + (hSearch.value.trim() ? ' · 筛 ' + rows.length : '') + '）';
            if (!rows.length) { hList.innerHTML = '<div class="je-hist-empty">' + (all.length ? '（无匹配）' : '（暂无历史·跑一次 agent 就有了）') + '</div>'; return; }
            hList.innerHTML = rows.map(function (r) {
              return '<div class="je-hist-row"><div class="hd"><span class="kind">' + esc2(r.kind) + '</span>'
                + (r.applied ? '<span class="ap">✓已应用</span>' : '')
                + '<span class="tm">' + esc2(r.when) + (r.tokensUsed ? ' · ' + (r.tokensUsed >= 1000 ? (Math.round(r.tokensUsed / 100) / 10) + 'k' : r.tokensUsed) + 't' : '') + '</span></div>'
                + (r.request ? '<div class="req">' + esc2(r.request) + '</div>' : '')
                + (r.summary ? '<div class="sm">' + esc2(r.summary) + '</div>' : '') + '</div>';
            }).join('');
          };
          hSearch.addEventListener('input', renderHist);
          hbox.querySelector('.je-hist-clear').addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI; if (U && U.clearHistory) U.clearHistory();
          });
          hbox.querySelector('.je-hist-changelog').addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI; if (U && U.runChangelog) U.runChangelog();
          });
          try { if (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui) window.TM_AuthoringAgentUI._ui._onHistoryChange = renderHist; } catch (e) {}
          renderHist();
        }
        // 方向G · 检查点列表：命名存档点 + 多级回退（应用前自动存点·随时回到任意点）
        if (body && !panel.querySelector('.je-aa-ckpt')) {
          var ckbox = document.createElement('details');
          ckbox.className = 'je-aa-apicfg je-aa-ckpt';
          ckbox.innerHTML = '<summary>🕓 检查点（0）</summary>'
            + '<button type="button" class="je-ckpt-add">＋ 存当前状态为检查点</button>'
            + '<div class="je-ckpt-list"></div>';
          body.appendChild(ckbox);
          var ckList = ckbox.querySelector('.je-ckpt-list');
          var ckSummary = ckbox.querySelector('summary');
          ckbox.querySelector('.je-ckpt-add').addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI; if (U && U.checkpoint) U.checkpoint();
          });
          var renderCkpts = function () {
            var U = window.TM_AuthoringAgentUI;
            var list = (U && U.checkpoints) ? U.checkpoints() : [];
            ckSummary.textContent = '🕓 检查点（' + list.length + '）';
            var undoBtn = panel.querySelector('.je-aa-undo');
            if (undoBtn) undoBtn.hidden = !list.length;
            if (!list.length) { ckList.innerHTML = '<div class="je-ckpt-empty">（暂无检查点·应用改动或点上方按钮会生成）</div>'; return; }
            ckList.innerHTML = '';
            list.forEach(function (c) {
              var row = document.createElement('div'); row.className = 'je-ckpt-row';
              var lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = c.label;
              var tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = c.when;
              var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = '回到';
              btn.addEventListener('click', function () { var U2 = window.TM_AuthoringAgentUI; if (U2 && U2.restore) U2.restore(c.id); });
              row.appendChild(lbl); row.appendChild(tm); row.appendChild(btn);
              ckList.appendChild(row);
            });
          };
          try { if (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui) window.TM_AuthoringAgentUI._ui._onCheckpointsChange = renderCkpts; } catch (e) {}
          renderCkpts();
        }
        // 维度 · @提实体：输入框打 @ 触发剧本实体（人物/势力）自动补全（玩家精准点名 + 发现实体）
        if (req && !req._jeMentionInit) {
          req._jeMentionInit = true;
          var menu = document.createElement('div');
          menu.className = 'je-aa-mention'; menu.hidden = true;
          document.body.appendChild(menu);
          var entityList = function () {
            var app = window.TM_SCENARIO_EDITOR_RESET_APP;
            var sc = (app && app.state && app.state.scenario) || {};
            var out = [];
            (sc.characters || []).forEach(function (c) { if (c && c.name) out.push({ name: c.name, kind: '人物' }); });
            (sc.factions || []).forEach(function (f) { if (f && f.name) out.push({ name: f.name, kind: '势力' }); });
            return out;
          };
          var curMention = function () {
            var v = req.value, pos = req.selectionStart || v.length;
            var m = v.slice(0, pos).match(/@([^\s@]*)$/);
            return m ? { q: m[1], start: pos - m[0].length, end: pos } : null;
          };
          var activeIdx = -1;   // 键盘高亮项（-1=未选）
          var hideMenu = function () { menu.hidden = true; activeIdx = -1; };
          // 高亮第 idx 项（循环），并滚入可视区
          var setActive = function (idx) {
            var btns = menu.querySelectorAll('button');
            var len = btns.length; if (!len) return;
            activeIdx = ((idx % len) + len) % len;
            Array.prototype.forEach.call(btns, function (b, i) {
              if (i === activeIdx) { b.classList.add('je-m-active'); try { b.scrollIntoView({ block: 'nearest' }); } catch (er) {} }
              else b.classList.remove('je-m-active');
            });
          };
          // 把名字插入到当前 @ 处（鼠标点击 / 键盘 Enter 共用；现读 mention 避免位置漂移）
          var insertEntity = function (name) {
            var mention = curMention();
            if (!mention) return hideMenu();
            var v = req.value;
            req.value = v.slice(0, mention.start) + name + ' ' + v.slice(mention.end);
            var np = mention.start + name.length + 1;
            try { req.setSelectionRange(np, np); } catch (er) {}
            req.focus(); hideMenu();
          };
          var showMenu = function () {
            var mention = curMention();
            if (!mention) return hideMenu();
            var q = mention.q.toLowerCase();
            var matches = entityList().filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
            if (!matches.length) return hideMenu();
            menu.innerHTML = ''; activeIdx = -1;
            matches.forEach(function (e) {
              var b = document.createElement('button'); b.type = 'button'; b._jeName = e.name;
              b.appendChild(document.createTextNode(e.name));
              var k = document.createElement('span'); k.className = 'je-m-kind'; k.textContent = e.kind; b.appendChild(k);
              b.addEventListener('mousedown', function (ev) { ev.preventDefault(); insertEntity(e.name); });
              menu.appendChild(b);
            });
            var r = req.getBoundingClientRect();
            menu.style.left = r.left + 'px';
            menu.style.top = (r.bottom + 2) + 'px';
            menu.style.width = Math.max(160, r.width) + 'px';
            menu.hidden = false;
          };
          req.addEventListener('input', showMenu);
          // 键盘操作：菜单开着时 ↑↓ 选、Enter 插入、Esc 关；菜单没开则不拦键（保留正常换行）
          req.addEventListener('keydown', function (e) {
            if (menu.hidden) return;
            if (e.key === 'Escape') { e.preventDefault(); hideMenu(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx <= 0 ? -1 : activeIdx - 1); return; }
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {   // Ctrl/⌘+Enter 放行给发送快捷键
              var btns = menu.querySelectorAll('button');
              var pick = btns[activeIdx < 0 ? 0 : activeIdx];   // 未高亮则取第一个匹配
              if (pick) { e.preventDefault(); insertEntity(pick._jeName); }
              return;
            }
          });
          req.addEventListener('blur', function () { setTimeout(hideMenu, 150); });
        }
        // 斜杠命令面板：输入框开头打 / 弹命令（补齐/校验/润色/加人物/改名/计划模式/帮助）——Claude code 招牌交互
        if (req && !req._jeSlashInit) {
          req._jeSlashInit = true;
          var SLASH = [
            { cmd: '/补齐', desc: '补齐缺失的必需字段', fill: '请用 listGaps 找出游戏运行时必需但缺失的字段，逐一补齐，让剧本完整可玩；改完用 validateDraft 自查。' },
            { cmd: '/校验', desc: '全面校验并列出问题', fill: '请用 validateDraft 全面校验本剧本，列出所有引用冲突、人口/区划不一致等问题（先只报告，不要改）。' },
            { cmd: '/润色', desc: '润色开场与背景文风', fill: '请润色 background / overview / opening 的文风，使其更生动、贴合时代，但不改变设定与事实。' },
            { cmd: '/加人物', desc: '新增 3 名贴合背景的人物', fill: '请新增 3 名贴合本剧本背景的人物：含姓名、势力归属、官职、性格与 AI 人格；势力名必须用剧本里已存在的势力。' },
            { cmd: '/改名', desc: '把某实体改名（填模板）', fill: '请把【实体名】改名为【新名】，并同步更新所有引用它的地方。' },
            { cmd: '/审阅', desc: 'AI 审阅剧本·出报告（不改）', action: 'review' },
            { cmd: '/体检', desc: '运行时校验·能否加载（不需 API）', action: 'preflight' },
            { cmd: '/讲解', desc: '讲解剧本设计与机制·onboarding', action: 'explain' },
            { cmd: '/计划模式', desc: '切换：先出计划再改', action: 'plan' },
            { cmd: '/帮助', desc: '列出所有斜杠命令', action: 'help' }
          ];
          var smenu = document.createElement('div');
          smenu.className = 'je-aa-mention je-aa-slash'; smenu.hidden = true;   // 复用 @下拉样式
          document.body.appendChild(smenu);
          var sIdx = -1;
          var hideSlash = function () { smenu.hidden = true; sIdx = -1; };
          var setSActive = function (idx) {
            var bs = smenu.querySelectorAll('button'); var len = bs.length; if (!len) return;
            sIdx = ((idx % len) + len) % len;
            Array.prototype.forEach.call(bs, function (b, i) { if (i === sIdx) { b.classList.add('je-m-active'); try { b.scrollIntoView({ block: 'nearest' }); } catch (er) {} } else b.classList.remove('je-m-active'); });
          };
          var statusMsg = function (t) { var st = panel.querySelector('#tm-aa-status'); if (st) st.textContent = t; };
          var applySlash = function (item) {
            if (!item) return;
            if (item.action === 'plan') {
              var cb = panel.querySelector('.je-aa-planmode input');
              if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
              req.value = ''; hideSlash(); req.focus();
              statusMsg('计划模式已' + (cb && cb.checked ? '开启（生成将先出计划）' : '关闭'));
              return;
            }
            if (item.action === 'help') {
              req.value = ''; hideSlash(); req.focus();
              statusMsg('命令：' + SLASH.map(function (s) { return s.cmd; }).join('  '));
              return;
            }
            if (item.action === 'review') {
              req.value = ''; hideSlash();
              var U = window.TM_AuthoringAgentUI;
              if (U && U.review) U.review(); else statusMsg('agent 未就绪');
              return;
            }
            if (item.action === 'preflight') {
              req.value = ''; hideSlash();
              var Up = window.TM_AuthoringAgentUI;
              if (Up && Up.preflight) Up.preflight(); else statusMsg('agent 未就绪');
              return;
            }
            if (item.action === 'explain') {
              req.value = ''; hideSlash();
              var Ux = window.TM_AuthoringAgentUI;
              if (Ux && Ux.explain) Ux.explain(); else statusMsg('agent 未就绪');
              return;
            }
            req.value = item.fill || ''; hideSlash(); req.focus();
            try { req.dispatchEvent(new Event('input')); } catch (er) {}   // 触发估算刷新
          };
          var showSlash = function () {
            var m = (req.value || '').match(/^\/(\S*)$/);   // 仅当整行是「/xxx」无空格时
            if (!m) return hideSlash();
            var q = m[1].toLowerCase();
            var hits = SLASH.filter(function (s) { return !q || s.cmd.toLowerCase().indexOf(q) >= 0 || s.desc.toLowerCase().indexOf(q) >= 0; });
            if (!hits.length) return hideSlash();
            smenu.innerHTML = ''; sIdx = -1;
            hits.forEach(function (s) {
              var b = document.createElement('button'); b.type = 'button'; b._jeItem = s;
              b.appendChild(document.createTextNode(s.cmd));
              var k = document.createElement('span'); k.className = 'je-m-kind'; k.textContent = s.desc; b.appendChild(k);
              b.addEventListener('mousedown', function (ev) { ev.preventDefault(); applySlash(s); });
              smenu.appendChild(b);
            });
            var r = req.getBoundingClientRect();
            smenu.style.left = r.left + 'px'; smenu.style.top = (r.bottom + 2) + 'px'; smenu.style.width = Math.max(160, r.width) + 'px';
            smenu.hidden = false;
          };
          req.addEventListener('input', showSlash);
          req.addEventListener('keydown', function (e) {
            if (smenu.hidden) return;   // 菜单没开不拦键（与 @下拉互斥，二者不同时开）
            if (e.key === 'Escape') { e.preventDefault(); hideSlash(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSActive(sIdx + 1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSActive(sIdx <= 0 ? -1 : sIdx - 1); return; }
            if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'Tab') {   // Ctrl/⌘+Enter 放行给发送
              var bs = smenu.querySelectorAll('button'); var pick = bs[sIdx < 0 ? 0 : sIdx];
              if (pick) { e.preventDefault(); applySlash(pick._jeItem); }
              return;
            }
          });
          req.addEventListener('blur', function () { setTimeout(hideSlash, 150); });
        }
        // 快捷键 + 指令历史：Ctrl/⌘+Enter 发送；空框（或已在浏览历史时光标在最前）按 ↑↓ 翻上次指令（shell 式·localStorage 持久）
        if (req && !req._jeHotkeyInit) {
          req._jeHotkeyInit = true;
          var HKEY = 'tm_aa_prompt_history';
          var loadHist = function () { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
          var saveHist = function (h) { try { localStorage.setItem(HKEY, JSON.stringify(h.slice(-20))); } catch (e) {} };
          var histNav = -1, draftBeforeNav = '';   // -1 = 不在浏览历史
          var goBtn = panel.querySelector('#tm-aa-go');
          // 记录已提交指令（捕获阶段，先于 onGenerate 清空输入框）
          if (goBtn) goBtn.addEventListener('click', function () {
            var v = (req.value || '').trim();
            if (!v || /^\//.test(v)) return;   // 空 / 斜杠命令本身不入历史
            var h = loadHist();
            if (h[h.length - 1] !== v) { h.push(v); saveHist(h); }
            histNav = -1;
          }, true);
          req.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {   // 发送快捷键
              e.preventDefault();
              var ms = document.querySelectorAll('.je-aa-mention'); Array.prototype.forEach.call(ms, function (m) { m.hidden = true; });   // 收起任何下拉
              if (goBtn && !goBtn.disabled) goBtn.click();
              return;
            }
            if (document.querySelector('.je-aa-mention:not([hidden])')) return;   // 下拉开着时把 ↑↓ 让给下拉
            var atStart = (req.selectionStart === 0 && req.selectionEnd === 0);
            var empty = !(req.value || '').length;
            if (e.key === 'ArrowUp' && (empty || (atStart && histNav >= 0))) {
              var h = loadHist(); if (!h.length) return;
              e.preventDefault();
              if (histNav === -1) { draftBeforeNav = req.value || ''; histNav = h.length - 1; }
              else if (histNav > 0) { histNav--; }
              req.value = h[histNav];
              try { req.setSelectionRange(0, 0); } catch (er) {}
              return;
            }
            if (e.key === 'ArrowDown' && histNav >= 0) {
              var h2 = loadHist();
              e.preventDefault();
              if (histNav < h2.length - 1) { histNav++; req.value = h2[histNav]; }
              else { histNav = -1; req.value = draftBeforeNav; }
              try { req.setSelectionRange(req.value.length, req.value.length); } catch (er) {}
              return;
            }
          });
        }
        // 方向T · 一致性守护（实时·主动·零 token）：盯玩家手动编辑（#save-indicator 的 data-save-state 变化），改完确定性 preflight 查死链/不一致，有阻塞主动弹横幅。
        if (!window._jeGuardInit) {
          window._jeGuardInit = true;
          var guardOn = true;
          var gToast = document.createElement('div');
          gToast.className = 'je-guard-toast'; gToast.hidden = true;
          gToast.innerHTML = '<div class="gt-body"></div><div class="gt-act"><button class="gt-detail" type="button">🔍 详查</button><button class="gt-x" type="button" title="关闭">×</button></div>';
          document.body.appendChild(gToast);
          var gBody = gToast.querySelector('.gt-body');
          gToast.querySelector('.gt-x').addEventListener('click', function () { gToast.hidden = true; });
          gToast.querySelector('.gt-detail').addEventListener('click', function () {
            gToast.hidden = true;
            var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open');
            var U = window.TM_AuthoringAgentUI; if (U && U.preflight) U.preflight();
          });
          var escG = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
          var renderGuard = function (pf) {
            if (!pf || !pf.blockers || !pf.blockers.length) { gToast.hidden = true; return; }
            var top = pf.blockers.slice(0, 2).map(function (b) { return '<div class="gt-item">· ' + escG(String(b).replace(/^\[[^\]]*\]\s*/, '')) + '</div>'; }).join('');
            gBody.innerHTML = '<b>⚠ 一致性：检测到 ' + pf.blockers.length + ' 处可能影响运行的问题</b>' + top + (pf.blockers.length > 2 ? '<div class="gt-item">…还有 ' + (pf.blockers.length - 2) + ' 处</div>' : '');
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
          var gTimer = null;
          var scheduleGuard = function () { if (!guardOn) return; if (gTimer) clearTimeout(gTimer); gTimer = setTimeout(runGuardCheck, 700); };
          try { new MutationObserver(scheduleGuard).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-save-state'] }); } catch (e) {}
          if (body && req && !panel.querySelector('.je-aa-guard-toggle')) {
            var gtog = document.createElement('label');
            gtog.className = 'je-aa-guard-toggle';
            var gcb = document.createElement('input'); gcb.type = 'checkbox'; gcb.checked = true;
            gcb.addEventListener('change', function () { guardOn = gcb.checked; if (!guardOn) gToast.hidden = true; });
            window._jeGuardSetEnabled = function (v) { guardOn = !!v; gcb.checked = !!v; if (!guardOn) gToast.hidden = true; };
            gtog.appendChild(gcb);
            gtog.appendChild(document.createTextNode(' 🛡 实时守护（手动编辑后自动查死链·不费 token）'));
            var gRef = panel.querySelector('.je-aa-fewshot') || panel.querySelector('.je-aa-planmode');
            if (gRef) gRef.insertAdjacentElement('afterend', gtog); else body.insertBefore(gtog, panel.querySelector('#tm-aa-composer') || req);
          }
        }
        // 方向U · 导入/转换：粘素材文本 → agent 抽取成实体入草稿（复用编辑流·走正常 diff/应用审）
        if (!window._jeImportInit) {
          window._jeImportInit = true;
          var iBack = document.createElement('div'); iBack.className = 'je-import-back'; iBack.hidden = true;
          iBack.innerHTML = '<div class="je-import"><h4>📥 导入 / 转换素材</h4>'
            + '<div class="je-import-hint">粘贴史料 / 设定 / 笔记，国师会从中抽取贴合本剧本的人物、势力、事件等，新增进草稿待你审。只新增、不改动已有内容。</div>'
            + '<textarea class="je-import-text" placeholder="在此粘贴素材文本…"></textarea>'
            + '<div class="je-import-act"><button type="button" class="je-import-cancel">取消</button><button type="button" class="je-import-go">抽取入草稿</button></div></div>';
          document.body.appendChild(iBack);
          var iText = iBack.querySelector('.je-import-text');
          var closeImport = function () { iBack.hidden = true; };
          var openImport = function () { iBack.hidden = false; setTimeout(function () { iText.focus(); }, 0); };
          window._jeOpenImport = openImport;
          iBack.querySelector('.je-import-cancel').addEventListener('click', closeImport);
          iBack.addEventListener('mousedown', function (e) { if (e.target === iBack) closeImport(); });
          iText.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeImport(); });
          iBack.querySelector('.je-import-go').addEventListener('click', function () {
            var text = (iText.value || '').trim();
            var st = panel.querySelector('#tm-aa-status');
            if (!text) { if (st) st.textContent = '请先粘贴素材文本'; return; }
            closeImport();
            var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open'); document.body.classList.add('je-guoshi-docked');
            var rq = panel.querySelector('#tm-aa-req');
            if (rq) {
              rq.value = '下面是一段素材（史料 / 设定 / 笔记），请从中抽取出贴合本剧本背景的人物、势力、事件等，新增进剧本草稿——与现有设定保持一致、字段尽量完整、中文显示名；只新增、不改动已有内容。素材如下：\n\n' + text;
              var go = panel.querySelector('#tm-aa-go'); if (go && !go.disabled) go.click();
            }
            iText.value = '';
          });
          var hdRowI = panel.querySelector('#tm-aa-hd');
          if (hdRowI && !panel.querySelector('.je-aa-import')) {
            var ibtn = document.createElement('button');
            ibtn.type = 'button'; ibtn.className = 'je-aa-test je-aa-import'; ibtn.textContent = '📥 导入';
            ibtn.title = '粘史料 / 文本 → 抽取成剧本实体入草稿';
            ibtn.addEventListener('click', openImport);
            (function(h,el){var xb=h.querySelector('#tm-aa-x');if(xb&&xb.parentNode===h)h.insertBefore(el,xb);else h.appendChild(el);})(hdRowI, ibtn);   /* 2026-07-03 · ✕ 已嵌套进 .tm-aa-hdbtns·安全插入 */
          }
        }
        // 方向W · 实体捆绑导出/导入（跨剧本复用·确定性·零 token）
        if (!window._jeBundleInit) {
          window._jeBundleInit = true;
          var bBack = document.createElement('div'); bBack.className = 'je-import-back'; bBack.hidden = true;
          bBack.innerHTML = '<div class="je-import je-bundle"><h4>📦 实体捆绑（跨剧本复用）</h4>'
            + '<div class="je-import-hint">导出：选一个势力，连带它的人物 / 关系打成包。导入：粘别处导出的包，合并进本剧本（势力去重、重名自动改名），走正常审阅后应用。</div>'
            + '<div class="je-bundle-export"><select class="je-bundle-fac"></select><button type="button" class="je-bundle-do-export">导出此势力</button><button type="button" class="je-bundle-download" hidden>下载 .json</button></div>'
            + '<textarea class="je-bundle-text" placeholder="导出的包会出现在这里（可复制）；或在此粘贴要导入的捆绑包 JSON"></textarea>'
            + '<div class="je-import-act"><button type="button" class="je-import-cancel">关闭</button><button type="button" class="je-import-go je-bundle-do-import">导入此包到本剧本</button></div></div>';
          document.body.appendChild(bBack);
          var bSel = bBack.querySelector('.je-bundle-fac'), bText = bBack.querySelector('.je-bundle-text'), bDl = bBack.querySelector('.je-bundle-download');
          var closeBundle = function () { bBack.hidden = true; };
          var openBundle = function () {
            var sc = (window.TM_SCENARIO_EDITOR_RESET_APP && window.TM_SCENARIO_EDITOR_RESET_APP.state && window.TM_SCENARIO_EDITOR_RESET_APP.state.scenario) || {};
            bSel.innerHTML = (sc.factions || []).filter(function (f) { return f && f.name; }).map(function (f) { return '<option>' + String(f.name).replace(/</g, '&lt;') + '</option>'; }).join('') || '<option value="">（无势力）</option>';
            bText.value = ''; bDl.hidden = true; bBack.hidden = false;
          };
          window._jeOpenBundle = openBundle;
          bBack.querySelector('.je-import-cancel').addEventListener('click', closeBundle);
          bBack.addEventListener('mousedown', function (e) { if (e.target === bBack) closeBundle(); });
          bBack.querySelector('.je-bundle-do-export').addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI; if (!U || !U.exportBundle) return;
            var b = U.exportBundle(bSel.value);
            if (!b) { bText.value = '导出失败（请选一个势力）'; return; }
            bText.value = JSON.stringify(b, null, 2); bDl.hidden = false; bDl._bundle = b;
          });
          bDl.addEventListener('click', function () {
            try {
              var blob = new Blob([bText.value], { type: 'application/json' });
              var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = '势力捆绑-' + (bSel.value || 'bundle') + '.json'; document.body.appendChild(a); a.click();
              setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
            } catch (e) {}
          });
          bBack.querySelector('.je-bundle-do-import').addEventListener('click', function () {
            var U = window.TM_AuthoringAgentUI, st = panel.querySelector('#tm-aa-status');
            var parsed; try { parsed = JSON.parse(bText.value); } catch (e) { if (st) st.textContent = '导入失败：不是合法 JSON'; return; }
            var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open'); document.body.classList.add('je-guoshi-docked');
            if (U && U.importBundle && U.importBundle(parsed)) closeBundle();
          });
          var hdRowB = panel.querySelector('#tm-aa-hd');
          if (hdRowB && !panel.querySelector('.je-aa-bundle')) {
            var bbtn = document.createElement('button');
            bbtn.type = 'button'; bbtn.className = 'je-aa-test je-aa-bundle'; bbtn.textContent = '📦 捆绑';
            bbtn.title = '导出/导入势力捆绑包·跨剧本复用';
            bbtn.addEventListener('click', openBundle);
            (function(h,el){var xb=h.querySelector('#tm-aa-x');if(xb&&xb.parentNode===h)h.insertBefore(el,xb);else h.appendChild(el);})(hdRowB, bbtn);   /* 2026-07-03 · ✕ 已嵌套进 .tm-aa-hdbtns·安全插入 */
          }
        }
        // 方向S · 批量扩写：选集合+数量+风格 → 构造批量提示词(内嵌该集合现有范例保持一致) → bulkAdd 一次性生成 → diff/应用审
        if (!window._jeBatchInit) {
          window._jeBatchInit = true;
          var BCN = { characters: '人物', factions: '势力', parties: '党派', events: '事件', items: '物品', families: '家族', relations: '关系', cities: '城市', classes: '阶层', traitDefinitions: '特质', goals: '目标', openingLetters: '开场信' };
          var batBack = document.createElement('div'); batBack.className = 'je-import-back'; batBack.hidden = true;
          batBack.innerHTML = '<div class="je-import je-batch"><h4>🔢 批量扩写</h4>'
            + '<div class="je-import-hint">批量新增某类实体，自动参考现有范例保持一致的笔法与字段完整度，改动先入草稿待审。</div>'
            + '<div class="je-batch-row"><select class="je-batch-coll"></select><input type="number" class="je-batch-n" min="1" max="50" value="5"><span style="font-size:12px;color:var(--paper-dim)">个</span></div>'
            + '<input type="text" class="je-batch-note" placeholder="风格 / 侧重（可选），如：偏武将、东林党背景、晚明世情…">'
            + '<div class="je-import-act"><button type="button" class="je-import-cancel">取消</button><button type="button" class="je-import-go je-batch-go">开始扩写</button></div></div>';
          document.body.appendChild(batBack);
          var batColl = batBack.querySelector('.je-batch-coll'), batN = batBack.querySelector('.je-batch-n'), batNote = batBack.querySelector('.je-batch-note');
          var closeBatch = function () { batBack.hidden = true; };
          var openBatch = function () {
            var sc = (window.TM_SCENARIO_EDITOR_RESET_APP && window.TM_SCENARIO_EDITOR_RESET_APP.state && window.TM_SCENARIO_EDITOR_RESET_APP.state.scenario) || {};
            batColl.innerHTML = Object.keys(sc).filter(function (k) { return Array.isArray(sc[k]); }).map(function (k) { return '<option value="' + k + '">' + (BCN[k] || k) + (sc[k].length ? '（现 ' + sc[k].length + '）' : '') + '</option>'; }).join('') || '<option value="characters">人物</option>';
            batBack.hidden = false; setTimeout(function () { batN.focus(); }, 0);
          };
          window._jeOpenBatch = openBatch;
          batBack.querySelector('.je-import-cancel').addEventListener('click', closeBatch);
          batBack.addEventListener('mousedown', function (e) { if (e.target === batBack) closeBatch(); });
          batBack.querySelector('.je-batch-go').addEventListener('click', function () {
            var AA = window.TM && window.TM.AuthoringAgent;
            var sc = (window.TM_SCENARIO_EDITOR_RESET_APP && window.TM_SCENARIO_EDITOR_RESET_APP.state && window.TM_SCENARIO_EDITOR_RESET_APP.state.scenario) || {};
            var coll = batColl.value, n = Math.max(1, Math.min(50, parseInt(batN.value, 10) || 5)), note = (batNote.value || '').trim();
            var collCN = BCN[coll] || coll;
            var ex = (AA && AA.buildExemplars) ? AA.buildExemplars(sc, { collections: [coll], perColl: 2 }) : '';
            var prompt = '请批量新增 ' + n + ' 个' + collCN + '（集合 ' + coll + '），与现有内容保持一致的笔法、字段完整度与设定风格' + (note ? ('；风格侧重：' + note) : '') + '。中文显示名，涉及引用（如 faction）必须用剧本已存在的；优先用 bulkAdd 一次性添加，改完用 validateDraft 自查。' + (ex ? '\n【参考现有范例·照其字段丰满度生成】\n' + ex : '');
            closeBatch();
            var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open'); document.body.classList.add('je-guoshi-docked');
            var rq = panel.querySelector('#tm-aa-req');
            if (rq) { rq.value = prompt; var go = panel.querySelector('#tm-aa-go'); if (go && !go.disabled) go.click(); }
          });
          var hdRowBt = panel.querySelector('#tm-aa-hd');
          if (hdRowBt && !panel.querySelector('.je-aa-batch')) {
            var batBtn = document.createElement('button');
            batBtn.type = 'button'; batBtn.className = 'je-aa-test je-aa-batch'; batBtn.textContent = '🔢 批量';
            batBtn.title = '批量新增某类实体（保持风格一致）';
            batBtn.addEventListener('click', openBatch);
            (function(h,el){var xb=h.querySelector('#tm-aa-x');if(xb&&xb.parentNode===h)h.insertBefore(el,xb);else h.appendChild(el);})(hdRowBt, batBtn);   /* 2026-07-03 · ✕ 已嵌套进 .tm-aa-hdbtns·安全插入 */
          }
        }
        // 方向V · 命令面板（⌘K / Ctrl+K）：模糊搜索 + 一键调用任意动作（所有能力一个入口）
        if (!window._jeCmdkInit) {
          window._jeCmdkInit = true;
          var escC = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
          var openP = function () { var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open'); document.body.classList.add('je-guoshi-docked'); };
          var Uu = function () { return window.TM_AuthoringAgentUI; };
          var pnl = document.getElementById('tm-aa-panel');
          var rq = pnl && pnl.querySelector('#tm-aa-req');
          var fillReq = function (t) { if (rq) { rq.value = t; rq.focus(); try { rq.dispatchEvent(new Event('input')); } catch (e) {} } };
          var toggleSel = function (sel) { var cb = pnl && pnl.querySelector(sel); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); } };
          var clickTest = function () { if (!pnl) return; var bs = pnl.querySelectorAll('.je-aa-test'); for (var i = 0; i < bs.length; i++) { if (/测试连接/.test(bs[i].textContent)) { bs[i].click(); break; } } };
          var CMDS = [
            { label: '生成 / 运行当前指令', hint: '⏎', run: function () { openP(); var go = pnl && pnl.querySelector('#tm-aa-go'); if (go && !go.disabled) go.click(); } },
            { label: '🔍 审阅剧本', hint: '挑毛病出报告', run: function () { openP(); var u = Uu(); if (u && u.review) u.review(); } },
            { label: '🩺 运行时体检', hint: '能否加载', run: function () { openP(); var u = Uu(); if (u && u.preflight) u.preflight(); } },
            { label: '💬 剧本问答', hint: '先在输入框写问题', run: function () { openP(); var u = Uu(); if (u && u.qa) u.qa(); } },
            { label: '📖 讲解剧本', hint: 'onboarding', run: function () { openP(); var u = Uu(); if (u && u.explain) u.explain(); } },
            { label: '🧩 分解执行', hint: '大需求拆步', run: function () { openP(); var u = Uu(); if (u && u.orchestrate) u.orchestrate(); } },
            { label: '🧠 记忆册', hint: '国师跨会话记忆', run: function () { openP(); var u = Uu(); if (u && u.showMemories) u.showMemories(); } },
            { label: '📖 技能册', hint: '操作指令包清单', run: function () { openP(); var u = Uu(); if (u && u.showSkills) u.showSkills(); } },
            { label: '🧩 能力包', hint: '启停/导入/导出', run: function () { openP(); var u = Uu(); if (u && u.showPacks) u.showPacks(); } },
            { label: '📊 用量·上下文', hint: 'token 构成与占比', run: function () { openP(); var u = Uu(); if (u && u.showUsage) u.showUsage(); } },
            { label: '📥 导入素材', hint: '文本→实体', run: function () { if (window._jeOpenImport) window._jeOpenImport(); } },
            { label: '📦 实体捆绑', hint: '跨剧本复用', run: function () { if (window._jeOpenBundle) window._jeOpenBundle(); } },
            { label: '🔢 批量扩写', hint: '保持风格', run: function () { if (window._jeOpenBatch) window._jeOpenBatch(); } },
            { label: '↩ 撤销上次应用', hint: '', run: function () { var u = Uu(); if (u && u.undo) u.undo(); } },
            { label: '📝 生成版本说明', hint: 'changelog', run: function () { openP(); var u = Uu(); if (u && u.runChangelog) u.runChangelog(); } },
            { label: '🧪 测试连接', hint: 'API / 中转', run: function () { openP(); clickTest(); } },
            { label: '⌨ 快捷键速查', hint: '⌘/ 或 ?', run: function () { if (window._jeCheatOpen) window._jeCheatOpen(); } },
            { label: '切换 · 计划模式', hint: '', run: function () { openP(); toggleSel('.je-aa-planmode:not(.je-aa-fewshot) input'); } },
            { label: '切换 · 学官方范例', hint: '', run: function () { openP(); toggleSel('.je-aa-fewshot input'); } },
            { label: '切换 · 实时守护', hint: '', run: function () { openP(); toggleSel('.je-aa-guard-toggle input'); } },
            { label: '指令 · 补齐缺失字段', hint: '填输入框', run: function () { openP(); fillReq('请用 listGaps 找出游戏运行时必需但缺失的字段，逐一补齐，让剧本完整可玩；改完用 validateDraft 自查。'); } },
            { label: '指令 · 检查冲突', hint: '填输入框', run: function () { openP(); fillReq('请用 validateDraft 全面校验本剧本，列出所有引用冲突、人口/区划不一致等问题（先只报告，不要改）。'); } },
            { label: '指令 · 润色开场', hint: '填输入框', run: function () { openP(); fillReq('请润色 background / overview / opening 的文风，使其更生动、贴合时代，但不改变设定与事实。'); } },
            { label: '指令 · 加 3 名人物', hint: '填输入框', run: function () { openP(); fillReq('请新增 3 名贴合本剧本背景的人物：含姓名、势力归属、官职、性格与 AI 人格；势力名必须用剧本里已存在的势力。'); } }
          ];
          var back = document.createElement('div'); back.className = 'je-cmdk-back'; back.hidden = true;
          back.innerHTML = '<div class="je-cmdk"><input type="text" placeholder="输入命令…（↑↓ 选 · ⏎ 执行 · Esc 关）"><div class="je-cmdk-list"></div></div>';
          document.body.appendChild(back);
          var cIn = back.querySelector('input'), cList = back.querySelector('.je-cmdk-list');
          var cActive = 0, cFiltered = CMDS.slice();
          var renderCmdk = function () {
            var q = cIn.value.trim().toLowerCase();
            cFiltered = q ? CMDS.filter(function (c) { return (c.label + ' ' + (c.hint || '')).toLowerCase().indexOf(q) >= 0; }) : CMDS.slice();
            cActive = 0;
            if (!cFiltered.length) { cList.innerHTML = '<div class="je-cmdk-empty">无匹配命令</div>'; return; }
            cList.innerHTML = cFiltered.map(function (c, i) { return '<div class="je-cmdk-item' + (i === 0 ? ' active' : '') + '" data-i="' + i + '"><span class="lbl">' + escC(c.label) + '</span>' + (c.hint ? '<span class="hint">' + escC(c.hint) + '</span>' : '') + '</div>'; }).join('');
            Array.prototype.forEach.call(cList.querySelectorAll('.je-cmdk-item'), function (el) { el.addEventListener('mousedown', function (e) { e.preventDefault(); runCmdk(+el.getAttribute('data-i')); }); });
          };
          var setCActive = function (i) {
            var items = cList.querySelectorAll('.je-cmdk-item'); if (!items.length) return;
            cActive = ((i % items.length) + items.length) % items.length;
            Array.prototype.forEach.call(items, function (el, k) { if (k === cActive) { el.classList.add('active'); try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {} } else el.classList.remove('active'); });
          };
          var runCmdk = function (i) { var c = cFiltered[i]; closeCmdk(); if (c && c.run) { try { c.run(); } catch (e) {} } };
          var openCmdk = function () { back.hidden = false; cIn.value = ''; renderCmdk(); setTimeout(function () { cIn.focus(); }, 0); };
          var closeCmdk = function () { back.hidden = true; };
          window._jeCmdkOpen = openCmdk; window._jeCmdkClose = closeCmdk;
          cIn.addEventListener('input', renderCmdk);
          cIn.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setCActive(cActive + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCActive(cActive - 1); }
            else if (e.key === 'Enter') { e.preventDefault(); if (cFiltered.length) runCmdk(cActive); }
          });
          back.addEventListener('mousedown', function (e) { if (e.target === back) closeCmdk(); });
          document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (back.hidden) openCmdk(); else closeCmdk(); }
          });
        }
        // UI·AG · 快捷键速查面板（Claude.ai/ChatGPT 的 ? / ⌘/ 招牌）：复用 Slice 68 孤儿 CSS（#shortcut-cheatsheet），文档国师面板热键
        if (!window._jeCheatInit) {
          window._jeCheatInit = true;
          var cheat = document.createElement('div');
          cheat.id = 'shortcut-cheatsheet'; cheat.setAttribute('data-active', 'false');
          var CHEAT_GROUPS = [
            { title: '召唤', items: [['⌘ K', '命令面板（模糊搜全部能力）'], ['⌘ /', '这张快捷键速查'], ['?', '速查（输入框外按）'], ['Esc', '关闭面板 / 下拉']] },
            { title: '输入与发送', items: [['⌘ ⏎', '发送 / 生成当前指令'], ['/', '行首打斜杠 → 命令（补齐/校验/审阅…）'], ['@', '提及剧本实体（人物 / 势力）'], ['↑ ↓', '空输入框时翻上一条指令']] },
            { title: '阅读', items: [['⌘ F', '在结果/过程区里查找（面板内）'], ['⛶', '国师面板全屏 / 还原']] }
          ];
          var escK = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
          var cheatGroups = CHEAT_GROUPS.map(function (g) {
            return '<div class="shortcut-cheatsheet-group"><h3>' + escK(g.title) + '</h3><ul>' +
              g.items.map(function (it) { return '<li><kbd>' + escK(it[0]) + '</kbd><span>' + escK(it[1]) + '</span></li>'; }).join('') + '</ul></div>';
          }).join('');
          cheat.innerHTML = '<div class="shortcut-cheatsheet-backdrop"></div><div class="shortcut-cheatsheet-card">' +
            '<div class="shortcut-cheatsheet-head"><h2>快捷键</h2><button type="button" class="shortcut-cheatsheet-close" aria-label="关闭" style="background:none;border:none;color:#caa94a;font-size:22px;line-height:1;cursor:pointer">×</button></div>' +
            '<div class="shortcut-cheatsheet-grid">' + cheatGroups + '</div>' +
            '<p class="shortcut-cheatsheet-foot">⌘/ 或 ? 随时唤出 · Esc 关闭</p></div>';
          document.body.appendChild(cheat);
          var cheatOpen = function () { cheat.setAttribute('data-active', 'true'); };
          var cheatClose = function () { cheat.setAttribute('data-active', 'false'); };
          window._jeCheatOpen = cheatOpen; window._jeCheatClose = cheatClose;
          cheat.querySelector('.shortcut-cheatsheet-backdrop').addEventListener('click', cheatClose);
          cheat.querySelector('.shortcut-cheatsheet-close').addEventListener('click', cheatClose);
          document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); (cheat.getAttribute('data-active') === 'true') ? cheatClose() : cheatOpen(); return; }
            var ae = document.activeElement || {};
            if (e.key === '?' && !/^(input|textarea)$/i.test(ae.tagName || '') && !ae.isContentEditable) { e.preventDefault(); cheatOpen(); return; }
            if (e.key === 'Escape' && cheat.getAttribute('data-active') === 'true') { e.preventDefault(); cheatClose(); }
          });
        }
        // 对话优先：标题栏加「⚙ 设置」键，切换 body.je-guoshi-settings-open（展开/收起所有设置类 chrome）
        var hdRow2 = panel.querySelector('#tm-aa-hd'), xb2 = hdRow2 && hdRow2.querySelector('#tm-aa-x');
        if (hdRow2 && xb2 && !hdRow2.querySelector('#tm-aa-settings')) {
          var sgear = document.createElement('button');
          sgear.id = 'tm-aa-settings'; sgear.type = 'button'; sgear.title = '设置 / 高级：API · 权限 · 模板 · 历史 · 检查点 · 计划/范例/守护 · 更多模式';
          sgear.textContent = '⚙';
          sgear.addEventListener('click', function () { document.body.classList.toggle('je-guoshi-settings-open'); });
          if (xb2.parentNode === hdRow2) hdRow2.insertBefore(sgear, xb2); else hdRow2.appendChild(sgear);   /* 2026-07-03 · ✕ 已嵌套进 .tm-aa-hdbtns·安全插入 */
            // 刀·收放常驻：toggle 作者自己的 body.je-guoshi-docked → 收起还正文满宽，国师转浮层仍可用
            try {
              if (!hdRow2.querySelector('#tm-aa-dockcollapse')) {
                var dcol = document.createElement('button');
                dcol.id = 'tm-aa-dockcollapse'; dcol.type = 'button';
                dcol.style.cssText = 'background:none;border:none;color:inherit;font:inherit;font-size:13px;cursor:pointer;line-height:1;padding:0 4px;opacity:.72';
                var _setDcol = function () { var on = document.body.classList.contains('je-guoshi-docked'); dcol.textContent = on ? '\u21e5' : '\u21e4'; dcol.title = on ? '\u6536\u8d77\u5e38\u9a7b\u00b7\u8fd8\u6b63\u6587\u6ee1\u5bbd\uff08\u56fd\u5e08\u8f6c\u6d6e\u5c42\u4ecd\u53ef\u7528\uff09' : '\u9760\u8fb9\u5e38\u9a7b\u00b7\u9489\u4e3a\u53f3\u4fa7\u6848\u4fa7\u9762\u677f'; dcol.setAttribute('aria-label', on ? '\u6536\u8d77\u5e38\u9a7b\u56fd\u5e08' : '\u9760\u8fb9\u5e38\u9a7b\u56fd\u5e08'); };
                dcol.addEventListener('click', function () { document.body.classList.toggle('je-guoshi-docked'); _setDcol(); });
                hdRow2.insertBefore(dcol, sgear); _setDcol();
              }
            } catch (_eDcol) {}
        }
        /* 2026-07-03 · 旧「＋ 模式」注入菜单退役（owner 指认重复）：
           审阅/体检/问答/讲解/分解已收进共创面板 composer 的＋能力菜单（agent-ui 原生），
           导入素材/实体捆绑/批量扩写在 ⌘K 命令面板有入口——不失能力，去重复。 */
        return true;
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
        var ui = (window.TM_AuthoringAgentUI && window.TM_AuthoringAgentUI._ui); if (!ui || !ui.els || !ui.els.req) return;
        var p = document.getElementById('tm-aa-panel'); if (p) p.classList.add('open'); document.body.classList.add('je-guoshi-docked');
        var prompt = field ? ('补齐缺失的必填字段「' + field + '」，给出贴合本剧本的值。') : ('修复问题：' + (ref ? ('实体「' + ref + '」') : '') + '；补齐或修正相关字段。');
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